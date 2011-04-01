/// parser.js: Take a stream of tokens and incrementally parse it into an Abstract Syntax Tree (AST), 
///            represented as nested JavaScript arrays.
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
/// 

var utility = require('./utility');
var dialect = require('./dialect');
var tokenizer = require('./tokenizer');

var reportError = utility.reportError;

// Tokenize and parse a string.
//
var parse = function(s)
{
    var result = [];
    var t = tokenizer.makeTokenizer(s);
    
    while (!t.eos) do
    { 
	result.push(r);
    }
    
    return result;
}

// Convert a list of tokens into nested arrays.
//
// 'oneAhead' is an optional parameter that's used by readFrom in recursive calls 
//
var readFrom = function(t, oneAhead)
{
    var result = oneAhead || t.next();
    var u, v, b, L;

    var bracketError = function(b, type, message, inner)
    {
	return reportError(b.line, b.column, type + ' bracket "' + b.token + '" ' + message, inner);
    }

    if (result.type === 'OPEN-BRACKET')
    {
	L = [];
	u = t.next();
	b = result;  // Record the bracket, in case we need to desugar it.
	
	while (u.token != tokenizer.matchingBracket[result.token])
	{
	    if (u.error)
            {
		throw bracketError(result, 'Open', 'lacks matching closing bracket.', u.error);
	    }

	    if (tokenizer.isCloseBracket(u.token))
	    {
		throw bracketError(result, 'Open', '', 
					    bracketError(u, 'Close', 'does not match open bracket'));
	    }

	    v = readFrom(t, u);
	    L.push(v);
	    u = t.next();
	}
	
	result = L;
		
	// Some kinds of brackets, typically [...] and {...}, are syntactic sugar for (op1 ...) & (op2 ...).
	// This is where we remove the sugar.
	//
	var desugared = dialect.bracketSugar[b.token];
	if (desugared)
	{
	    b.atom = desugared;  b.type = 'ATOM'; 
	    result.unshift(b);
	}
    }
    else if (result.type === 'CLOSE-BRACKET')
    {
	throw bracketError(result, 'Close', 'unexpected.  No matching opening bracket.');
    }
    else if (result.type === 'STRING')
    {
	// No processing.
    }
    else if (result.type === 'COMMENT')
    {
	result = readFrom(t);  // Skip the comment
    }
    else if (result.type === 'PUNCTUATION')
    {
	var punc = result;
	desugared = dialect.punctuationSugar[punc.token];
	
	if (desugared)
	{
	    punc.atom = desugared;  punc.type = 'ATOM';
	    result = [punc, readFrom(t)];
	}
	else
	{
	    result.atom = result.token;
	}	
    }
    else
    {
	result.atom = atom(result.token);
    }
        
    return result;
}

// Convert a string to a number or boolean or symbol.  
//
// TODO ... or regex.
// TODO check for legality of symbols.
//
var atom = function(s) 
{
    var result = s === '' ? '' : Number(s);

    if (isNaN(result))
    {
	result = s in dialect.constants ? dialect.constants[s] : s;
    }
    
    return result;
}

// Convert an AST representation into S-expression form
//
var unparse = function (ast)
{
    var U = function (exp)
    {
	return Array.isArray(exp) ? '(' + exp.map(U).join(' ') + ')' :
            exp.type === 'STRING' ? '"' + exp.token + '"' :
	    exp.atom; 
    }

    return ast.map(U).join('\n');
}

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------

exports.parse = parse;
exports.unparse = unparse;