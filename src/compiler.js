/// compiler.js: Converts ASTs into idiomatic JavaScript
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
///

var _ = require('./underscore');
var utility = require('./utility');
var dialect = require('./dialect');
var parser = require('./parser');

var last = utility.last;
var dropLast = utility.dropLast;
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
    var symbols = {};

    for (var i=0; i<params.length; i++) { symbols[params[i]] = args[i]; }

    return { symbols: symbols, 
	     outer: outer, 
	     find: function(sym) { return sym in this.symbols ? this.symbols : this.outer.find(sym); }
	   }
}

var makeAncestor = function (name, parent)
{
    return { name: name,
	     parent: parent,
	     hasAncestor: function (n) { return this.name===n ? true :
				                this.parent===undefined ? false :
 				                this.parent.hasAncestor(n); }
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

var check = function(test, op, message)
{
    if (!test) 
    {
	while (_.isArray(op)) op = op[0];
	throw reportError(op.line, op.column, message);
    }
}

// Is 'name' a valid name for a symbol?
//
var validSymbol = function (name)
{
    return _.isString(name) &&
	name.length > 0;         

    // TODO: prevent re-use of reserved words
    // TODO: check for malformed symbols
}

// Is 'x' an (as-yet) undeclared symbol in the current environment?
//
var checkExpectedOp = function (arr, op)
{
    // require: 'arr' is an array

    check(arr[0].atom === op, arr[0], 'Expected operator ' + op + ', not ' + arr[0].atom);
}

// Is 'x' a statement?
//
var isStatement = function(s)
{
    return _.contains(['=', 'break', 'continue', 'delete', 'for', 'if', 'label', 'return', 'var', 'while'], s);
}

// Is 'x' an expression?
//
var isExpression = function(x)
{
    var result = true;

    if (_.isArray(x))
    {
	if (x.length === 0 || _.isArray(x[0]) || isStatement(x[0].atom))
	{
	    result = false;
	}
    }

    return result;
}

// Add 'x' to environment 'env'
//
var declare = function (x, env)
{
    var t = x.atom, old;

    if (t in env.symbols)
    {
	old = env.symbols[t];

	check(false, x, 'Symbol "' + x.atom + '" was previously declared at line ' + old.line + ', column ' +  old.column);
    }

    env.symbols[t] = x;
}

var intersperse = function(inter, seq, env, parent, left, right)
{
    left = left || '';
    right = right || '';
    
    out(left);
    var i=0;
    while(true)
    {
	comp(seq[i], env, parent);
	i++;
	if (i == seq.length) break;
	out(inter);
    }
    out(right);
}

var seqForm = function(seq, env, parent, implicitReturn, prepend)
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
	if (implicitReturn && i === seq.length-1) 
	{
	    out('return ');
	    parent = makeAncestor(parent, 'return');
	}
	comp(seq[i], env, parent);
	out(';');
	i++;
	if (i === seq.length) break;
	newLine();
    }
    
    out(' }');
    unindent();
}

var pluralize = function (s, n)
{
    return s + (n === 1 ? '' : 's');
}

var checkArgs = function (op, args, min, max)
{
    var n = args.length;

    if (min == max)
    {
	check(n === min, op, op.atom + ' takes exactly' + min + pluralize(' argument', min) + '; ' + n + ' given.');
    }
    else if (max === undefined)
    {
	check(n >= min, op, op.atom + ' takes at least ' +  min + pluralize(' argument', min) + '; ' + n + ' given.');
    }
    else
    {
	check(min <= n && n <= max, op, op.atom + ' takes ' +  min + ' to ' + max + pluralize(' argument', max) + '; ' + n + ' given.');
    }
}

// Special forms
//
var specialForm =
    {
	'var': function (op, args, env, parent)
	{
	    checkArgs(op, args, 1);
	    _.each(args, function (x) 
		   { 
		       if (_.isArray(x)) checkExpectedOp(x, '=');
		   });
	    out('var ');
	    intersperse(', ', args, env, makeAncestor('var', parent));
	},
	'=': function (op, args, env, parent)
	{
	    checkArgs(op, args, 2);
	    check(isExpression(_.last(args)), _.last(args),  'Expression expected.');

	    _.each(dropLast(args), function(x)
		   {
		       check(validSymbol(x.atom), x, 'Illegal symbol name.');
		       if (parent.name === 'var')
		       {
			   declare(x, env); 
		       }
		       else
		       {
			   check(x.atom in env.symbols, x, 'Undeclared variable ' + x.atom);
		       } 
		   });

	    intersperse(' = ', args, env, makeAncestor('=', parent));
	},
	'begin': function (op, args, env, parent)
	{
	    checkArgs(op, args, 1);
	    seqForm(args, env, makeAncestor(parent, 'begin'));
	},
	'if': function (op, args, env, parent)
	{
	    checkArgs(op, args, 1);
	    var p = makeAncestor('if', parent);
	    for (var i=0; i<args.length; i++)
	    {
		var clause = args[i];

		check(_.isArray(clause), clause, '(...) expected.');
		check(args[i].length >= 2, op, 'Clause ' + (i+1) + ' of the if-statement needs at least two arguments.'); // TODO: How do we report the line & col numbers?
		check(isExpression(clause[0]), 'Expression expected.');
		if (args[i][0].atom === 'else')
		{
		    check(i > 0, clause[0], 'else is not allowed in the first clause of an if-statement.');
		}
		else
		{
		    out('if (');
		    comp(clause[0], env, p);
		    out(') ');
		}

		seqForm(_.rest(clause), env, p);

		if (i < args.length-1)
		{
		    newLine();
		    out('else ');
		}
	    }
	}
    }


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
    var adam = makeAncestor('*adam*');      // The first ancestor

    _.each(exps, function(x) { 
	comp(x, globalEnv, adam); 
	out(';'); newLine(); });

    return code;
}

// Detailed compilation into JS.
//
// 'exp' is the parse tree.
// 'env' is the environment (for enforcing scoping rules)
//
var comp = function comp(exp, env, parent)
{

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

    if (_.isArray(exp))
    {
	if (exp.length == 0) {}	    // TODO: Is this an error?
	else
	{
	    var first = _.first(exp);
	    var arg = first.token;
	    
	    if (arg in specialForm)
	    {
		specialForm[arg](first, _.rest(exp), env, parent);
	    }

	    /*var argType = dialect.specialForms[arg];

	    if(argType)
	    {
		switch(argType)
		{

		case 'LAMBDA':
	  	    // TODO: error if there aren't at least 3 arguments
		    // TODO: error if exp[1] isn't a list of arguments
		    lambdaForm(exp[1], drop(exp, 2));
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
		    seqForm(drop(exp, 4));
		    break;
		default: // TODO: no code yet for this special form
		}
	    }
*/
//
// TODO: Other special forms
//
	    else if (isMacro(arg)) 
	    {
		expandMacro(arg); // TODO: Macro-expansion
	    }
	    else if (arg in dialect.binaryOperator)
	    {
		checkArgs(op, args, 2);
		var binOp = dialect.binaryOperator[arg];
		var left, right;
		if (!isStatement(parent.name) && parent.parent !== undefined)
		{
		    left = '(';  right = ')';
		}

		intersperse(binOp, _.rest(exp), env, makeAncestor(arg, parent), left, right);
	    }
	    else // Procedure call
	    {		
		out(translate(arg));
		intersperse(', ',  _.rest(exp), env, makeAncestor(arg, parent),'(', ')');
	    } 
	}
    }
    else
    {
	if (parent.name === 'var')
	{
	    declare(exp, env);
	}

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