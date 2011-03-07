/// sjs: (Simplified) Scheme in JavaScript interpreter
///
/// (c) Daniel Prager, 2011
///
/// A port of Peter Norvig's lis.py sub-100 line Lisp in Python interpreter: norvig.com/lispy.html
///
/// I use Node.js for implementation and nodeunit for testing.  
/// Could use underscore.js for more functional goodness.
///

var sys = require('sys');

//--------------------------------------------------------------------------------
// Symbols and lists
//--------------------------------------------------------------------------------

// Symbols are just strings.
//
var isSymbol = function(s) { return toString.call(s) === '[object String]'; };

// Lists are arrays.
//
var isList = function(a) { return toString.call(a) === '[object Array]'; };
var first = function(a) { return a[0]; }

var rest = function(a) { return a.slice(1); }

var map = function(arr, fn)
{
    var result, i;
    
    for(i=0, result=[]; i<arr.length; i++) 
	result.push(fn(arr[i]));

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
    env.symbols = {
	'+': function(a,b) { return a+b; },
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

    return env;
}

var $globalEnv$ = setGlobals(makeEnv());

//--------------------------------------------------------------------------------
// Evaluations
//--------------------------------------------------------------------------------

// evaluate (Note: eval is already used in js.)
//
var evaluate = function(x, env)
{
    var result = x;    // Unless otherwise determined, assume that x is a literal (string, boolean, number) 
    var i, exps;       // Auxiliary variables
    var env = env || $globalEnv$;

    if (isSymbol(x))
    {
	result = env.find(x)[x];    // Variable look-up
    }
    else if (isList(x) && x.length > 0)  // Special forms: [quote, if, ...], or default is a proc
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
    
    return result;
}

//--------------------------------------------------------------------------------
// Parsing
//--------------------------------------------------------------------------------

// Tokenize and parse a string.
//
var parse=function(s)
{
    return read_from(tokenize(s));
}

// Convert a string into a list of tokens.
//
var tokenize = function(s)
{
    return s.replace(/\(/g, ' ( ')
	    .replace(/\)/g,' ) ')
	    .replace(/\s+/g,' ')      // Convert all whitespace to singles spaces
	    .replace(/^\s\s*/, '')    // Trim front
	    .replace(/\s\s*$/, '')    // Trim ends
	    .split(' ');
}

// Convert a list of tokens into nested arrays.
//
var read_from = function(tokens)
{
    var token, L;

    if (tokens.length == 0) throw('Unexpected EOF while reading');

    token = tokens.shift();
    switch(token)
    {
    case '(':
   	L = [];
	while (tokens[0] != ')') L.push(read_from(tokens));
	tokens.shift(); // Pop off the final ')'
	return L;
    case ')':
	throw ('Unexpected ) while reading');
    default:
	return atom(token);
    }
}

// Convert a string to a number or symbol
//
var atom = function(s) 
{
    var result = Number(s);

    if (isNaN(result)) result = s;

    return result;
}

//--------------------------------------------------------------------------------
// Execute
//--------------------------------------------------------------------------------

// Convert a JS object back into a Lisp-readable string.
//
var to_string = function(exp)
{
    return isList(exp) ? '(' + map(exp, to_string).join(' ') + ')' : exp;
}

var execute = function(s)
{
    return to_string(evaluate(parse(s)));
}

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------

exports.isSymbol = isSymbol;
exports.isList = isList;
exports.first = first;
exports.rest = rest;
exports.makeEnv = makeEnv;
exports.$globalEnv$ = $globalEnv$;
exports.evaluate = evaluate;
exports.tokenize = tokenize;
exports.parse = parse;
exports.execute = execute;