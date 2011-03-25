/// compiler.js: Converts ASTs into idiomatic JavaScript
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
///

var utility = require('./utility');
var dialect = require('./dialect');
var parser = require('./parser');

var reportError = utility.reportError;

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

var each = utility.each;
var rest = utility.rest;
var drop = utility.drop;


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

    var seqForm = function(seq, implicitReturn, prepend)
    {
	out('{ ');
	indent();

	if (prepend)
	{
	    out(prepend);  newLine();
	}

	var i=0;
	while(true)
	{
	    if (implicitReturn && i === seq.length-1) out('return ');
	    comp(seq[i], env);
	    out(';');
	    i++;
	    if (i === seq.length) break;
	    newLine();
	}

	out(' }');
	unindent();
    }

    var lambdaForm = function(args, body)
    {
	var rest;

	out('function(');
	for (var i=0; i<args.length; i++)
	{
	    var tok = args[i].token;
	    if (tok == '.')
	    {
		// TODO: Error if there's not exactly one argument remaining
		rest = 'var ' + translate(args[i+1].token) + ' =  Array.prototype.slice.call(arguments, '+ i +');';
		break;
	    }
	    else
	    {
		if (i > 0) out(', ');
		out(translate(tok));
	    }
	}
	out(') ');

	// TODO: Introduce new scope

	seqForm(body, true, rest);  
    }

    var intersperse = function(inter, seq, left, right)
    {
	left = left || '';
	right = right || '';

	out(left);
	var i=0;
	while(true)
	{
	    comp(seq[i], env);
	    i++;
	    if (i == seq.length) break;
	    out(inter);
	}
	out(right);
    }

    var objectForm = function(seq)
    {
	out('{');
	indent();  newLine();
	var i=0;
	while(true)
	{
	    out(translate(seq[i].token)); // TODO: quote where appropriate 
	    out(': ');
	    comp(seq[i+1], env);
	    i+= 2;
	    if (i >= seq.length) break;
	    out(','); newLine();
	}
	unindent();  newLine();
	out('}');
    }

    if (utility.isList(exp))
    {
	if (exp.length == 0) {}	    // TODO: Is this an error?
	else
	{
	    arg = exp[0].token;
	    var argType = dialect.specialForms[arg];

	    if(argType)
	    {
		switch(argType)
		{
		case 'DECLARATION':
		    // TODO: error if there aren't 2 or 3 arguments
		    // TODO: error if exp[1] cannot be declared, or has already been declared
		    // TODO: error if exp[2] expands to an invalid form, e.g. an assignment 
		    env.symbols[exp[1]] = 'VARIABLE';
		    out('var ');
		    if (exp.length == 2) out(translate(exp[1].token))
		    else assign(exp[1], exp[2]);
		    break;
		case 'ASSIGNMENT':
		    // TODO: error if there aren't 3 arguments
		    // TODO: error if exp[1] cannot be assigned to
		    // TODO: error if exp[2] expands to an invalid form, e.g. an assignment or a declaration
		    assign(exp[1], exp[2]);
		    break;
		case 'SEQUENCE':
		    // TODO: error if there aren't > 1 argument
		    seqForm(rest(exp));
		    break;
		case 'WHEN':
		    // TODO: error if there aren't 3 or more arguments
		    out('if (');  comp(exp[1], env); out(') ');
		    seqForm(drop(2, exp));
		    break;
		case 'LAMBDA':
	  	    // TODO: error if there aren't at least 3 arguments
		    // TODO: error if exp[1] isn't a list of arguments
		    lambdaForm(exp[1], drop(2, exp));
		    break;   
		case 'ARRAY':
		    // TODO: error if any arguments aren't expressions
		    intersperse(', ', rest(exp), '[', ']');
		break;
		case 'OBJECT':
		    // TODO: error if total # arguments isn't odd
		    // TODO: error if there are duplicate keys
		    // TODO: keys which are not valid names get quoted, including reserved words
		    // TODO: keys which are lists are errors
		    // TODO: all values must be expressions
		    objectForm(rest(exp));
		break;
		case 'EXISTENCE':
		    // TODO: error if not 2 args
		    // TODO: error if not exp[1] isn't a declared variable
		    // TODO: rewrite as a macro
		    var exArg = translate(exp[1].token);
		    out(['typeof', exArg, '!== "undefined" &&', exArg,'!== null'].join(' '));
		    break;
		case 'FOR':
		    // TODO: error if not at least 4 args
		    // TODO: error if 1st arg isn't a variable name
		    // TODO: error if 2nd & 3rd args
		    var forVar = translate(exp[1].token);
		    out('for(var ' + forVar +'=');
		    comp(exp[2]);
		    out('; ' + forVar + '<=');
		    comp(exp[3]);
		    out('; ' + forVar + '++) ');
		    seqForm(drop(4, exp));
		    break;
		default: // TODO: no code yet for this special form
		}
	    }

//
// TODO: Other special forms
//
	    else if (isMacro(arg)) 
	    {
		expandMacro(arg); // TODO: Macro-expansion
	    }
	    else if (arg in dialect.binaryOperator)
	    {
		// TODO: Error if < 3 arguments
		intersperse(dialect.binaryOperator[arg], rest(exp), '(', ')');
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

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------

exports.compile = compile;