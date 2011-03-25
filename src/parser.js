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
    var t = tokenizer.makeTokenizer(s);

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
var readFrom = function(t, oneAhead)
{
    var result = oneAhead || t.next();
    var u, v, b, L;

    var bracketError = function(b, type, message, inner)
    {
	return reportError(b.line, b.column, type + ' bracket "' + b.token + '" ' + message, inner);
    }

    if (!result.error)
    {
	if (result.type === 'OPEN-BRACKET')
	{
	    L = [];
	    u = t.next();
	    b = result;  // Record the bracket, in case we need to desugar it.
	    
	    while (u.token != tokenizer.matchingBracket[result.token])
	    {
		if (u.error)
		{
		    result.error = bracketError(result, 'Open', 'lacks matching closing bracket.', u.error);
		    break;
		}

		if (tokenizer.isCloseBracket(u.token))
		{
		    result.error = bracketError(result, 'Open', '', 
						bracketError(u, 'Close', 'does not match open bracket'));
		    break;
		}
		
		v = readFrom(t, u);

		if (v.error)
		{ 
		    u = v;
		}
		else
		{
		    L.push(v);
		    u = t.next();
		}
	    }
	
	    if (!result.error) 
	    {
		result = L;

		// Some kinds of brackets, typically [...] and {...}, are syntactic sugar for (op1 ...) & (op2 ...).
		// This is where we remove the sugar.
		//
		var desugared = dialect.bracketSugar[b.token];
		if (desugared)
		{
		    b.token = desugared;  b.type = 'ATOM'; 
		    result.unshift(b);
		}
	    }
	}
	else if (result.type === 'CLOSE-BRACKET')
	{
	    result.error = bracketError(result, 'Close', 'unexpected.  No matching opening bracket.');
	}
	else if (result.type === 'STRING')
	{
	    // No processing.
	}
	else if (result.type === 'COMMENT')
	{
	    result = readFrom(tokenizer);  // Skip the comment
	}
	else if (result.type === 'PUNCTUATION')
	{
	    var firstPunc = result;
	    var punc = '';
	    while (result.type === 'PUNCTUATION' && !result.error)
	    {
		punc += result.token;
		result = readFrom(t);
	    }

	    if (!result.error) 
	    {
		console.log("Punctuation: " + punc);
		desugared = dialect.punctuationSugar[firstPunc.token];
		if (desugared)
		{
		    console.log("Desugared: " + desugared);
		    console.log("Result:", result);
		    firstPunc.token = desugared;  firstPunc.type = 'ATOM';
		    result = [firstPunc, result];
		}
		else
		{
		    result.error = reportError(firstPunc.line, firstPunc.column, 'Unrecognized punctuation: ' + punc);
		}
	    }
		
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
// TODO ... or regex.
// TODO check for legality of symbols.
//
var atom = function(s) 
{
    var result = Number(s);

    if (isNaN(result) 
        && s in dialect.constants)
    {
	result = dialect.constants[s];
    }
    else
    {
	result = s;
    }

    return result;
}

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------

exports.parse = parse;