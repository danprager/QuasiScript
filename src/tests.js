/// Tests for QuasiScript Lisp-to-idiomatic-Javascript compiler.
///
/// (c) Daniel Prager, 2011
///
/// Run these tests using the nodeunit testing framework: https://github.com/caolan/nodeunit
///
/// Installation> npm install node unit
/// Command-line> nodeunit tests.js
///

var qs = require('qs');

//--------------------------------------------------------------------------------
// Tokenizing
//--------------------------------------------------------------------------------
exports.testTokenize = function(test)
{                           //1234567890123456789012345678901234567890
    var t = qs.makeTokenizer('(quick? 123.4 ["brown [] fox" jump-ed!\n,');
    test.deepEqual(t.next(), { token:'(', type:'OPEN-BRACKET', line: 1, column: 1 });
    test.deepEqual(t.next(), { token:'quick?', type:'ATOM', line: 1 , column: 2 });
    test.deepEqual(t.next(), { token:'123.4', type:'ATOM', line: 1 , column: 9 });
    test.deepEqual(t.next(), { token:'[', type:'OPEN-BRACKET', line: 1, column: 15 });
    test.deepEqual(t.next(), { token:'brown [] fox', type:'STRING', line: 1, column: 16 });
    test.deepEqual(t.next(), { token:'jump-ed!', type:'ATOM', line: 1, column: 31 });
    test.deepEqual(t.next(), { token:',', type:'PUNCTUATION', line: 2, column: 1 });
    test.equal(t.next().error, 'Line 2, column 2: Unexpected end-of-stream');

    t = qs.makeTokenizer('"No closing\nquotes');
    test.ok(t.next().error);

    t = qs.makeTokenizer('foo;bar\n;goo;zar');
    test.deepEqual(t.next(), { token:'foo', type:'ATOM', line: 1, column: 1 });
    test.deepEqual(t.next(), { token:'bar', type:'COMMENT', line: 1, column: 4 });
    test.deepEqual(t.next(), { token:'goo;zar', type:'COMMENT', line: 2, column: 1 });

    t = qs.makeTokenizer('foo"bar');
    test.ok(t.next().error);

    t = qs.makeTokenizer('"A string with ;(stuff) in \\"it\\"."');
    test.equal(t.next().token, 'A string with ;(stuff) in "it".');

    test.done();
}

//--------------------------------------------------------------------------------
// Parsing
//--------------------------------------------------------------------------------

exports.testParse = function(test)
{
    var p = qs.parse(''); test.ok(p.error);
    p = qs.parse('('); test.ok(p.error);
    p = qs.parse(')'); test.ok(p.error);
    p = qs.parse('(]'); test.ok(p.error);
    p = qs.parse('(('); test.ok(p.error);

// TODO: Include some positive tests of parsing.

    test.done();
}

//--------------------------------------------------------------------------------
// Compiling
//--------------------------------------------------------------------------------
exports.testCompile = function(test)
{
    var p = qs.parse('(def number 42)');
    test.equal(qs.compile(p.exp).indexOf('var number = 42'), 0);

    test.done();
}

//--------------------------------------------------------------------------------
// Matching CoffeeScript
//--------------------------------------------------------------------------------

exports.testDeclaration = function(test)
{
    test.equal(qs.run('(def number 42) number'), 42);
    test.equal(qs.run('(def opposite true) opposite'), true);
    test.done();
}

exports.testDo = function(test)
{
    var p = 
'(do (def number 42) \
     (def opposite true) \
     (when opposite \
         (= number -42)))';

    test.equal(qs.run(p), -42);
    test.done();
}

exports.testFn = function(test)
{
    var p =
'(def sqr (fn (x) \
              (* x x))) \
 (sqr 5)';
    test.equal(qs.run(p), 25);
    test.done();
}
