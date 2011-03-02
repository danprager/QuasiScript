/// qs: Lisp to idiomatic JavaScript compiler
///
/// (c) Daniel Prager, 2011
///
/// I use Node.js for implementation and nodeunit for testing.  
/// Could use underscore.js for more functional goodness.
///

var sys = require('sys');

//--------------------------------------------------------------------------------
// Parsing
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

    // Is 'ch' a recognised bracket?
    //
    var isBracket = function(ch) { return '()[]{}'.indexOf(ch) > -1; }

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

    var readChar = function(type)
    {
	var result = getTokenResult(type);
	result.token = pop();

	return result;
    }

    var readTo = function(endChar, type)
    {
	// TODO: Add ability to escape certain sequences, e.g. \" -> "
	//
	var result = getTokenResult(type);
	var token = '';

	pop();
	while (!atEOS())
	{
	    var ch = pop();
	    if (ch === endChar) break;
	    token += ch;
	}

	result.token = token;
	return result;
    }
    
    var readAtom = function()
    {
	var result = getTokenResult('ATOM');
	var token = '';

	var ch = nextChar();
	while (!atEOS() && !isWhiteSpace(ch) && !isBracket(ch))
	{
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

	    if (ch === '"') result = readTo('"', 'STRING');
	    else if (ch === ';') result = readTo('\n', 'COMMENT');
	    else if (ch === "'") result = readChar('QUOTE');
	    else if (ch === ',') result = readChar('QUASIQUOTE');
	    else if (isBracket(ch)) result = readChar('BRACKET');
	    else result = readAtom();
	
	    return result;
	}
    };
}


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