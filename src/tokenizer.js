/// tokenizer.js: Transforms a string of QuasiScript into a stream of tokens
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
/// 

var reportError = require('./utility').reportError;

var dialect = require('./dialect');
var isPunctuation = dialect.isPunctuation;

//--------------------------------------------------------------------------------
// Basic syntax: whitespace, comments, strings, braces
//--------------------------------------------------------------------------------

// Is 'ch' a space, tab or end-of-line character?
//
var isWhiteSpace = function(ch) { return ' \t\n\r'.indexOf(ch) > -1; }

// Does 'ch' start a comment?
//
var isComment = function(ch) { return ch === ';'; }

// Does 'ch' start (or end) a string?
//
var isStringDelimiter = function(ch) { return ch === '"'; }

// Is 'ch' a recognised opening bracket?
//
var isOpenBracket = function(ch) { return '([{'.indexOf(ch) > -1; }

// Is 'ch' a recognised closing bracket?
//
var isCloseBracket = function(ch) { return ')]}'.indexOf(ch) > -1; }

// What's the matching closing bracket for 'ch'? .
//
var matchingBracket = { '(':')', '[':']', '{':'}' }

//--------------------------------------------------------------------------------
// Tokenizing
//--------------------------------------------------------------------------------


// makeTokenizer: string -> { eos: -> boolean, 
//                            next: () ->  {string token, 
//                                          string type - STRING COMMENT PUNCTUATION OPEN-BRACKET CLOSE-BRACKET ATOM, 
//                                          number line,
//                                          number column, 
//                                          (optional) string error }
//
var makeTokenizer = function(s)
{
    var line = 1;
    var column = 1;
    var index = 0;
    var length = s.length;

    // End of stream?
    //
    var atEOS = function() { return index >= length; }

    var checkEOS = function(result, EOSok)
    {
	if (atEOS() && !EOSok) result.error = reportError(line, column, 'Unexpected end-of-stream');

	return atEOS();
    }

    // Get the next character without popping it off.  Assumes not atEOS.
    //
    var nextChar = function() { return s[index]; } 

    // Pop the next character off the stream and advance the cursor.
    //
    var pop = function() 
    { 
	var result = nextChar();
	index++;

	if (result == '\t') column += 4;
	else if (result == '\n') { line += 1; column = 1; }
	else if (result == '\r') { /* Ignored */ }
	else column++;

	return result;
    }

    var skipWhiteSpace = function()
    {
	while (!atEOS() && isWhiteSpace(nextChar())) pop();
    }

    // Read the next character as a token of type 'type' 
    //
    var readChar = function(result, type)
    {
	result.type = type;
	result.token = pop();
    }

    // Build a token, ignoring the first character, and reading until 'endChar' or the end-of-stream is reached.
    // Excludes the end characters.  E.g. "stuff" -> stuff.
    //
    // Flags
    //     EOSok: Don't record an error if end-of-stream is reached before an 'endChar'.
    //     escapeCharacter: Allows escape character (otherwise pass in null).  
    //                      Currently: \endChar, \n, \t, otherwise ignored.
    //
    var readTo = function(result, endChar, type, escCharacter, EOSok)
    {
	result.type = type;
	var token = '';
	var escaped = false;

	pop();
	while (true)
	{
	    if (checkEOS(result, EOSok)) break;

	    var ch = pop();
	    
	    if (escaped && escCharacter)
	    {
		token += (ch === 'n') ? '\n' :
	                 (ch === 't') ? '\t' : ch;

		escaped = false;
	    }
	    else
	    {
		if (ch === endChar) break;
		else if (ch === escCharacter) escaped = true;
		else token += ch;
	    }
	}

	result.token = token;

	if (result.error)
	{
	    result.error = reportError(result.line, result.column, 'Started reading ' + type, result.error);
	}
    }
    
    // Read in an atom as a token from the stream. 
    // Record an error if an illegal character is encountered, typically punctuation or string quotation ("). 
    //
    var readAtom = function(result)
    {
	result.type = 'ATOM';
	var token = '';

	var ch = nextChar();
	while (!atEOS() && !isWhiteSpace(ch) && !isCloseBracket(ch) && !isComment(ch))
	{
	    if (isPunctuation(ch) || isStringDelimiter(ch) || isOpenBracket(ch))
	    {
		result.error = reportError(line, column, 'Illegal character ' + ch + ' encountered.  Missing a space?');
		break;
	    }

	    pop();
	    token += ch;

	    ch = nextChar();
	}

	result.token = token;
    }

    // Read from the longest match in the set of completions, or a single character.
    //
    var readFromSet = function(result, set, type)
    {
	result.type = type;

	var found = false;

	for (var i=0; i<set.length; i++)
	{
	    var item = set[i];
	    var len = item.length;
	    if (item === s.substr(index, len))
	    {
		result.token = item;
		index += len;
		found = true;
		break;
	    }
	}

	if (!found) result.token = pop();
    }

    return { 
	eos: atEOS,
	next: function()
	{
	    skipWhiteSpace();

	    var result = { token: '', type: '', line: line, column: column };

	    if (!checkEOS(result))
	    {
		var ch = nextChar();
	
		if (isStringDelimiter(ch)) readTo(result, '"', 'STRING', '\\', false);
		else if (isComment(ch)) readTo(result, '\n', 'COMMENT', null, true);
		else if (isPunctuation(ch)) readFromSet(result, dialect.longPunctuation, 'PUNCTUATION');
		else if (isOpenBracket(ch)) readChar(result, 'OPEN-BRACKET');
		else if (isCloseBracket(ch)) readChar(result, 'CLOSE-BRACKET');
		else readAtom(result);
	    }
	
	    return result;
	}	
    };
}

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------

exports.makeTokenizer = makeTokenizer;
exports.matchingBracket = matchingBracket;
exports.isCloseBracket = isCloseBracket;