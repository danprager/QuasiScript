/// qs: Lisp to idiomatic JavaScript compiler
///
/// (c) Daniel Prager, 2011
///
/// I use Node.js for implementation and nodeunit for testing.  
/// Could use underscore.js for more functional goodness.
///

//--------------------------------------------------------------------------------
// Syntax for our Lisp.
//--------------------------------------------------------------------------------

// Boolean constants
//
var trueValue = 'true';       // Scheme: #t
var falseValue = 'false';     // Scheme: #f

// Is 'ch' a space, tab or end-of-line character.  Tabs are assumed to be 4 chars wide.
//
var isWhiteSpace = function(ch) { return ' \t\n\r'.indexOf(ch) > -1; }

// Does 'ch' start a comment?
//
var isComment = function(ch) { return ch === ';'; }

// Is 'ch' a reserved punctuation character?
//
var isPunctuation = function(ch) { return "'`,@#~:".indexOf(ch) > -1; }

// Does 'ch' start (or end) a string?
//
var isString = function(ch) { return ch === '"'; }

// Is 'ch' a recognised opening bracket?
//
var isOpenBracket = function(ch) { return '([{'.indexOf(ch) > -1; }

// Is 'ch' a recognised closing bracket?
//
var isCloseBracket = function(ch) { return ')]}'.indexOf(ch) > -1; }

// What's the matching closing bracket for 'ch'?  Otherwise return null.
//
var matchingBracket = function(ch) 
{
    switch (ch)
    {
    case '(': return ')';
    case '[': return ']';
    case '{': return '}';
    default: return null;
    }
}

// The special forms of our Lisp
// 
var isDeclaration = function (arg) { return arg == 'def'; } // Scheme: 'define'
var isAssignment = function (arg) { return arg == '='; }  // Scheme: 'set!'
var isConditional = function (arg) { return arg == 'if'; }
var isLambda = function (arg) { return arg == 'fn'; }     // Scheme: 'lambda'
var isSequence = function (arg) { return arg == 'do'; }    // Scheme: 'begin'
var isQuotation = function (arg) { return arg == 'quote'; }

//--------------------------------------------------------------------------------
// Utility function
//--------------------------------------------------------------------------------

// Lists are arrays.
//
var isList = function(a) { return toString.call(a) === '[object Array]'; };
var first = function(a) { return a[0]; }

var rest = function(a) { return a.slice(1); }

//--------------------------------------------------------------------------------
// Error reporting
//--------------------------------------------------------------------------------

var reportError = function(line, column, message, innerErrors)
{
    var result = 'Line ' + line + ', column ' + column + ': ' + message;

    if (innerErrors) result += '\n' + innerErrors

    return result;
}

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
	    if (isPunctuation(ch) || isString(ch) || isOpenBracket(ch))
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

    return { 
	next: function()
	{
	    skipWhiteSpace();

	    var result = { token: '', type: '', line: line, column: column };

	    if (!checkEOS(result))
	    {
		var ch = nextChar();
	
		if (isString(ch)) readTo(result, '"', 'STRING', '\\', false);
		else if (isComment(ch)) readTo(result, '\n', 'COMMENT', null, true);
		else if (isPunctuation(ch)) readChar(result, 'PUNCTUATION');
		else if (isOpenBracket(ch)) readChar(result, 'OPEN-BRACKET');
		else if (isCloseBracket(ch)) readChar(result, 'CLOSE-BRACKET');
		else readAtom(result);
	    }
	
	    return result;
	}	
    };
}


//--------------------------------------------------------------------------------
// Parsing
//--------------------------------------------------------------------------------

// Tokenize and parse a string.
//
// Note: Currently only grabs the first complete expression.  TODO: Process subsequent expressions.
//
var parse = function(s)
{
    var t = makeTokenizer(s);

    var result = {};
    var r = readFrom(t);

    if (r.error) result.error = r;
    else result.exp = r;
    
    return result;
}

// Convert a list of tokens into nested arrays.
//
// 'oneAhead' is an optional parameter that's used by readFrom in recursive calls when 
//
var readFrom = function(tokenizer, oneAhead)
{
    var result = oneAhead || tokenizer.next();
    var u, v, L;

    var bracketError = function(b, type, message, inner)
    {
	return reportError(b.line, b.column, type + ' bracket "' + b.token + '" ' + message, inner);
    }


    if (!result.error)
    {
	if (result.type == 'OPEN-BRACKET')
	{
	    L = [];
	    u = tokenizer.next();
	    
	    while (u.token != matchingBracket(result.token))
	    {
		if (u.error)
		{
		    result.error = bracketError(result, 'Open', 'lacks matching closing bracket.', u.error);
		    break;
		}

		if (isCloseBracket(u.token))
		{
		    result.error = bracketError(result, 'Open', '', 
						bracketError(u, 'Close', 'does not match open bracket'));
		    break;
		}
		
		v = readFrom(tokenizer, u);

		if (v.error)
		{ 
		    u = v;
		}
		else
		{
		    L.push(v);
		    u = tokenizer.next();
		}
	    }
	
	    if (!result.error) result = L;
	}
	else if (result.type == 'CLOSE-BRACKET')
	{
	    result.error = bracketError(result, 'Close', 'unexpected.  No matching opening bracket.');
	}
	else if (result.type == 'STRING')
	{
	    // No processing.
	}
	else if (result.type == 'COMMENT')
	{
	    result = readFrom(tokenizer);  // Skip the comment
	}
	else if (result.type == 'PUNCTUATION')
	{
	    result = readFrom(tokenizer); // Skip.  TODO: Pay attention to punctuation.
	}
	else
	{
	    result.atom = atom(result.token);
	}
    }
	
    return result;
}

// Convert a string to a number or boolean or symbol.  
//
// TODO
//    ... or regex.
//    check for legality of symbols.
//
var atom = function(s) 
{
    var result = Number(s);

    if (isNaN(result))
    {
	if (result === trueValue) result = true;
	else if (result === falseValue) result = false;
	else result = s;
    }

    return result;
}

//--------------------------------------------------------------------------------
// Compile from Lisp to JavaScript
//--------------------------------------------------------------------------------


// Convert expression 'x' into JavaScript.
//
var compile = function(exp)
{
    var result = '';
    var body = [];
    var vars = []; 
    var arg;

    var hoist = function(v)
    {
	if (vars.indexOf(v) == -1) vars.push(v);
    }

    var assign = function(target, value)
    {
	body.push(translate(target.token) + ' = ' + compile(value) + ';');
    }

    var seqForm = function(seq)
    {
	body.push('function() {');
	for (var i=0; i<seq.length-1; i++) body.push(compile(seq[i]));
	body.push('return ' + compile(seq[i]) + ' }();');
    }

    var condForm = function(seq)
    {
	body.push('function() {');
	body.push('if (' + compile(seq[0]) + ') {');
	body.push('return ' + compile(seq[1]) + ' }');
	if (seq.length === 3)
	{
	    body.push('else {');
	    body.push('return ' + compile(seq[2]) + ' }');
	}
	body.push('} ();');
    }

    if (isList(exp))
    {
	if (exp.length == 0) {}	    // TODO: Is this an error?
	else
	{
	    arg = exp[0].token;
	    if (isDeclaration(arg))
	    {
		// TODO: error if there aren't 2 or 3 arguments
		// TODO: error if exp[1] cannot be declared, or has already been declared
		// TODO: error if exp[2] expands to an invalid form, e.g. an assignment 
		hoist(exp[1].token);
		if (exp.length == 3) assign(exp[1], exp[2]);
	    }
	    else if (isAssignment(arg))
	    {
		// TODO: error if there aren't 3 arguments
		// TODO: error if exp[1] cannot be assigned to
		// TODO: error if exp[2] expands to an invalid form, e.g. an assignment or a declaration
		assign(exp[1], exp[2]);
	    }
	    else if (isSequence(arg))
	    {
		// TODO: error if there aren't > 1 argument
		seqForm(rest(exp));
	    }
	    else if (isConditional(arg))
	    {
		// TODO: error if there aren't 3 or more arguments
		// TODO: implement the arc else-if pattern for 5+ arguments
		condForm(rest(exp));
	    }
//
// TODO: Other special forms
//
	    else if (isMacro(arg)) result = expandMacro(arg); // TODO: Macro-expansion
	    else {} // TODO: Procedure call
	}
    }
    else
    {
	body.push(translate(exp.token));     // TODO: Translate token, add error-checking
    }

    // Declare the hoisted variables at the top of the scope.
    // TODO: Sort out lexical scoping rules.
    if (vars.length > 0)
    {
	vars.sort();
	result = 'var ' + vars.join(', ') + ';\n';
    }

    result += body.join('\n');

    return result;
}


var isMacro = function (arg)
{
    return false;   // No macros yet
}

var translate = function (arg)
{
    return arg; // TODO: Translate lispy tokens to valid JS
}

/*   
    if (isList(x) && x.length > 0)  // Special forms: [quote, if, ...], or default is a proc
    {
	switch(first(x)) 
	{
	case 'quote':                         // (quote exp) 
	    result = x[1]; break;
	case 'if':                            // (if test conseq alternative)
	    result = evaluate(evaluate(x[1], env) ? x[2] : x[3], env); break;
	case 'define':                        // (define var exp)
	    env.symbols[x[1]] = evaluate(x[2], env); break;
	case 'set!':                          // (set! var exp)
	    env.find(x[1])[x[1]] = evaluate(x[2], env); break;
	case 'lambda':                        // (lambda (var*) exp)
	    result = function () 
	    {  var args = Array.prototype.slice.call(arguments);
	       return evaluate(x[2], makeEnv(x[1], args, env));
	    }; break;
	case 'begin':                         // (begin exp*)
	    for(i=1; i<x.length; i++) result = evaluate(x[i], env); 
	    break;
	default:                              // (proc exp*)
	    exps = map(x, function(a) { return evaluate(a, env); });
	    result = first(exps).apply(null, rest(exps));
	}
    }
    
*/

//--------------------------------------------------------------------------------
// Evaluation
//--------------------------------------------------------------------------------

var run = function (s)
{
    var c = compile(parse(s).exp);
    console.log(c);

    return eval(c);
}

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------
exports.makeTokenizer = makeTokenizer;
exports.parse = parse;
exports.compile = compile;
exports.run = run;