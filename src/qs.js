/// qs: Lisp to idiomatic JavaScript compiler
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
///

var parse = require('./parser').parse;
var compile = require('./compiler').compile;

//--------------------------------------------------------------------------------
// Evaluation
//--------------------------------------------------------------------------------

var run = function (s)
{
    console.log('----');
    var c = compile(parse(s));
    console.log(c);
    console.log('----');

    return eval(c);
}

//--------------------------------------------------------------------------------
// Exports
//--------------------------------------------------------------------------------

exports.run = run;
exports.parse = parse;
exports.compile = compile;