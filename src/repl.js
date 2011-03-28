/// repl.js: A simple interactive Read-Eval-Print-Loop for QuasiScript
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
///
/// Note: Adapted (and simplified) from the CoffeeScript repl.

var qs = require('./qs')
var readline = require('readline')

// Input and output
//
var stdin = process.openStdin();
var stdout = process.stdout;

// Error-reporting
//
var error = function(err)
{
    stdout.write('\033[31m' + (err.stack || err.toString()) + '\033[0m\n\n');  // Color: red
}

// Backlog from multiline input
//
var backlog = '';

// Main REPL function.  'run' is called every time a line is input.
// Attempts to evaluate, prints exceptions rather than exiting.
//
// If the last character of the input is a '\', prompts for another line.
//
// TODO: Get the parser to detect an incomplete expression instead.
//
var run = function (buffer)
{

    backlog += (backlog.length > 0 ? '\n' : '') + buffer.toString();
    var code = backlog;

    if (code[code.length-1] == '\\') 
    { 
	stdout.write('... ');
	backlog = backlog.slice(0, backlog.length-1);
	return backlog;
    }

    backlog = '';
    try 
    {
	var p = qs.parse(code);
	if (p.error)
	{
	    error(p.error);
	}
	else
	{
	    var c = qs.compile(p.exp);
	    // TODO: Abort and report compilation errors

	    stdout.write('\033[33m' + c + '\033[0m');   // Color: yellow
	    var val = eval(c);
	    if (val !== undefined) 
	    {
		stdout.write('\033[32m');               // Color: green
		console.log(val); 
		stdout.write('\033[0m');
	    }
	}
    } 
    catch (err) 
    {
	error(err);
    }

    repl.prompt();
}

var autocomplete = function (text)
{
    // TODO: Beef up autocomplete
    return [[], text];
}

process.on('uncaughtException', error);

repl = readline.createInterface(stdin, stdout, autocomplete);
repl.setPrompt('qs> ');
repl.on('close', function() { stdout.write('\n');  return stdin.destroy(); });
repl.on('line', run);
repl.prompt();
