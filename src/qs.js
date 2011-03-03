/// qs: Lisp to idiomatic JavaScript compiler
///
/// (c) Daniel Prager, 2011
///
/// I use Node.js for implementation and nodeunit for testing.  
/// Could use underscore.js for more functional goodness.
///

//--------------------------------------------------------------------------------
// Tokenizing
//--------------------------------------------------------------------------------

var makeTokenizer = function(s)
{
    var line = 1;
    var column = 1;
    var index = 0;
    var length = s.length;

    // End of stream?
    //
    var atEOS = function() { return index >= length; }

    // Does 'ch' start a comment?
    //
    var isComment = function(ch) { return ch === ';'; }

    // Does 'ch' start (or end) a string?
    //
    var isString = function(ch) { return ch === '"'; }

    // Is 'ch' a recognised bracket?
    //
    var isBracket = function(ch) { return '()[]{}'.indexOf(ch) > -1; }

    // Is 'ch' a reserved punctuation character?
    //
    var isPunctuation = function(ch) { return "'`,@#~:".indexOf(ch) > -1; }

    // is 'ch' a space, tab or end-of-line character.  Tabs are assumed to be 4 chars wide.
    //
    var isWhiteSpace = function(ch) { return ' \t\n\r'.indexOf(ch) > -1; }

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

    var getTokenResult = function(type)
    {
	return { token: '', type: type, line: line, column: column }; 
    }

    // Read the next character as a token of type 'type' 
    //
    var readChar = function(type)
    {
	var result = getTokenResult(type);
	result.token = pop();

	return result;
    }

    // Build a token, ignoring the first character, and reading until 'endChar' or the end-of-stream is reached.
    // Excludes the end characters.  E.g. "stuff" -> stuff.
    //
    // Flags
    //     EOSok: Don't record an error if end-of-stream is reached before an 'endChar'.
    //     escapeCharacter: Allows escape character (otherwise pass in null).  
    //                      Currently: \endChar, \n, \t, otherwise ignored.
    //
    var readTo = function(endChar, type, escCharacter, EOSok)
    {
	var result = getTokenResult(type);
	var token = '';
	var escaped = false;

	pop();
	while (true)
	{
	    if (atEOS())
	    {
		if (!EOSok) result.error = "Unexpected end-of-stream."
		break;
	    }

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
	return result;
    }
    
    // Read in an atom as a token from the stream. 
    // Record an error if it is illegally terminated, typically by punctuation or string quotation ("). 
    //
    var readAtom = function()
    {
	var result = getTokenResult('ATOM');
	var token = '';

	var ch = nextChar();
	while (!atEOS() && !isWhiteSpace(ch) && !isBracket(ch) && !isComment(ch))
	{
	    if (isPunctuation(ch) || isString(ch))
	    {
		result.error = 'Illegal character (' + ch + ') encountered.  Missing a space?';
		break;
	    }

	    pop();
	    token += ch;
	    ch = nextChar();
	}

	result.token = token;
	return result;
    }

    return { 
	isEOS: function() { skipWhiteSpace();  return atEOS(); },
	next: function()
	{
	    var result, ch;
	
	    skipWhiteSpace();
	    ch = nextChar();

	    if (isString(ch)) result = readTo('"', 'STRING', '\\', false);
	    else if (isComment(ch)) result = readTo('\n', 'COMMENT', null, true);
	    else if (isPunctuation(ch)) result = readChar('PUNCTUATION');
	    else if (isBracket(ch)) result = readChar('BRACKET');
	    else result = readAtom();
	
	    return result;
	}
    };
}

//
// 
var tokenize = function(s)
{
    var t = makeTokenizer(s);

    var result = [];

    while (!t.isEOS()) 
	result.push(t.next().token);

    return result;
}


//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------
exports.makeTokenizer = makeTokenizer;
exports.tokenize = tokenize;