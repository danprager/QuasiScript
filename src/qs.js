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
var isWhen = function (arg) { return arg == 'when'; }
var isLambda = function (arg) { return arg == 'fn'; }     // Scheme: 'lambda'
var isSequence = function (arg) { return arg == 'do'; }    // Scheme: 'begin'
var isQuotation = function (arg) { return arg == 'quote'; }

// Binary operators
var binaryOperator = { '+': '+', '-':'-', '*':'*', '/': '/',
		       'and': '&&', 'or': '||' };

var isBinaryOperator = function(arg) { return arg in binaryOperator };
//--------------------------------------------------------------------------------
// Utility functions
//--------------------------------------------------------------------------------

// Lists are arrays.
//
var isList = function(a) { return toString.call(a) === '[object Array]'; };
var first = function(a) { return a[0]; }

var rest = function(a) { return a.slice(1); }
var drop = function(n, a) { return a.slice(n); }

// Use underscore library instead?
//
var map = function(arr, fn)
{
    var result, i;
    
    for(i=0, result=[]; i<arr.length; i++) 
	result.push(fn(arr[i]));

    return result;
}

var each = function(arr, fn)
{  
    for(var i=0; i<arr.length; i++) fn(arr[i]);
}

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
	eos: atEOS,
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
var parse = function(s)
{
    var t = makeTokenizer(s);

    var result = { exp: [], error: '' };
    
    do
    {
	var r = readFrom(t);

	if (r.error) result.error = r;
	else result.exp.push(r);
    } while (!t.eos() && !result.error);
    
    return result;
}

// Convert a list of tokens into nested arrays.
//
// 'oneAhead' is an optional parameter that's used by readFrom in recursive calls 
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
// Environments
//--------------------------------------------------------------------------------

// An environment consists of a dictionary of 'symbols', plus a reference to an 'outer' environment.
//
var makeEnv = function(params, args, outer) 
{
    params = params || []; 
    args = args || []; 
    var symbols = {}, i;

    for (i = 0; i<params.length; i++) { symbols[params[i]] = args[i]; }

    return { symbols: symbols, 
	     outer: outer, 
	     find: function(sym) { return sym in this.symbols ? this.symbols : this.outer.find(sym); }
	   }
}

// Set up some standard scheme procedures in the environment 'env'.
//
var setGlobals = function(env)
{
    env.symbols = {};
/*	'+': function(a,b) { return a+b; },
	'-': function(a,b) { return a-b; },
	'*': function(a,b) { return a*b; },
	'/': function(a,b) { return a/b; },
	'not': function(a) { return !a; },
	'>': function(a,b) { return a>b; },
	'<': function(a,b) { return a<b; },
	'>=': function(a,b) { return a>=b; },
	'<=': function(a,b) { return a<=b; },
	'=': function(a,b) { return a===b; },
	'equal?': function(a,b) { return a===b; },
	'length': function(a) { return a.length; },
	'cons': function(a,b) { return b.unshift(a); },
	'car': first,
	'cdr': rest,
	'append': function(a,b) { return a.concat(b); },
	'list' : function() { return Array.prototype.slice.call(arguments); },
	'empty?' : function(a) { return a.length === 0; },
	'null?': function(a) { return a===null; },
	'list?': function(a) { return isList(a); },
	'symbol?': function(a) { return isSymbol(a); } };
*/
    return env;
}


//--------------------------------------------------------------------------------
// Compile from Lisp to JavaScript
//--------------------------------------------------------------------------------

// Pretty printing helpers
//
var code;                // This is where we accumulate the JavaScript
var startOfLine;         // Are we at the start of a line;
var indentation;         // Number of spaces to indent at the start of each line
var newLine = function() { code += '\n'; startOfLine = true; }
var indent = function() { indentation = indentation + '  '; }
var unindent = function() { indentation = indentation.slice(2); }
var out = function(s) 
{ if (startOfLine)
  { 
      startOfLine = false;
      code += indentation;
  }
  code += s; 
}

// Convert array of expressions into JavaScript.
//
var compile = function(exps)
{
    startOfLine = false;
    indentation = '';
    code = '';

    var globalEnv = setGlobals(makeEnv());

    each(exps, function(x) { 
	comp(x, globalEnv); 
	out(';'); newLine(); });

    return code;
}

// Detailed compilation into JS.
//
// 'exp' is the parse tree.
// 'env' is the environment (for enforcing scoping rules)
//
var comp = function comp(exp, env)
{
    var arg;
 
    var assign = function(target, value)
    {
	out(translate(target.token) + ' = ');
	comp(value, env);
    }

    var declare = function(target, value)
    {
	env.symbols[target] = 'VARIABLE';

	out('var ');
	if (value) assign(target, value);
	else out(translate(target.token));
    }

    var seqForm = function(seq, implicitReturn)
    {
	out('{ ');
	indent();

	var i=0;
	while(true)
	{
	    newLine();
	    if (implicitReturn && i === seq.length-1) out('return ');
	    comp(seq[i], env);
	    out(';');
	    i++;
	    if (i === seq.length) break;
	}

	out(' }');
	unindent();
    }

    var whenForm = function(test, actions)
    {
	out('if (');  comp(test, env); out(') ');
	seqForm(actions);
    }

    var lambdaForm = function(args, body)
    {
	out('function(');
	out(map(args, function(x) { return translate(x.token); }).join(', '));
	out(') ');

	// TODO: Introduce new scope.  Handle return.
	seqForm(body, true);  
    }

    var intersperse = function(inter, seq)
    {
	var i=0;
	while(true)
	{
	    comp(seq[i], env);
	    i++;
	    if (i == seq.length) break;
	    out(inter);
	}
    }

    var expandBinary = function(op, args)
    {
	out('(');
	intersperse(op, args);
	out(')');
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
		declare(exp[1], exp[2]);
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
	    else if (isWhen(arg))
	    {
		// TODO: error if there aren't 3 or more arguments
		whenForm(exp[1], drop(2, exp));
	    }
	    else if (isLambda(arg))
	    {
		// TODO: error if there aren't at least 3 arguments
		// TODO: error if exp[1] isn't a list of arguments
		lambdaForm(exp[1], drop(2, exp));
	    }
//
// TODO: Other special forms
//
	    else if (isMacro(arg)) result = expandMacro(arg); // TODO: Macro-expansion
	    else if (isBinaryOperator(arg))
	    {
		// TODO: Error if < 4 arguments
		expandBinary(binaryOperator[arg], rest(exp));
	    }
	    else // TODO: Procedure call
	    {		
		out(translate(arg) + '(');
		intersperse(', ', rest(exp));
		out(')');
	    } 
	}
    }
    else
    {
	out(translate(exp.token));     // TODO: Translate token, add error-checking
    }
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
    console.log('----');
    var c = compile(parse(s).exp);
    console.log(c);
    console.log('----');

    return eval(c);
}

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------
exports.makeTokenizer = makeTokenizer;
exports.parse = parse;
exports.compile = compile;
exports.run = run;