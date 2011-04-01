/// Tests for QuasiScript Lisp-to-idiomatic-Javascript compiler.
///
/// (c) Daniel Prager, 2011
///
/// Run these tests using the nodeunit testing framework: https://github.com/caolan/nodeunit
///
/// Installation> npm install node unit
/// Command-line> nodeunit tests.js
///

//--------------------------------------------------------------------------------
// Tokenizing
//--------------------------------------------------------------------------------
var makeTokenizer = require('tokenizer').makeTokenizer;

exports.testTokenize = function(test)
{                        //1234567890123456789012345678901234567890
    var t = makeTokenizer('(quick? 123.4 ["brown [] fox" jump-ed!\n,');
    test.deepEqual(t.next(), { token:'(', type:'OPEN-BRACKET', line: 1, column: 1 });
    test.deepEqual(t.next(), { token:'quick?', type:'ATOM', line: 1 , column: 2 });
    test.deepEqual(t.next(), { token:'123.4', type:'ATOM', line: 1 , column: 9 });
    test.deepEqual(t.next(), { token:'[', type:'OPEN-BRACKET', line: 1, column: 15 });
    test.deepEqual(t.next(), { token:'brown [] fox', type:'STRING', line: 1, column: 16 });
    test.deepEqual(t.next(), { token:'jump-ed!', type:'ATOM', line: 1, column: 31 });
    test.deepEqual(t.next(), { token:',', type:'PUNCTUATION', line: 2, column: 1 });
    test.equal(t.next().error, 'Line 2, column 2: Unexpected end-of-stream');

    t = makeTokenizer('"No closing\nquotes');
    test.ok(t.next().error);

    t = makeTokenizer('foo;bar\n;goo;zar');
    test.deepEqual(t.next(), { token:'foo', type:'ATOM', line: 1, column: 1 });
    test.deepEqual(t.next(), { token:'bar', type:'COMMENT', line: 1, column: 4 });
    test.deepEqual(t.next(), { token:'goo;zar', type:'COMMENT', line: 2, column: 1 });

    t = makeTokenizer('foo"bar');
    test.ok(t.next().error);

    t = makeTokenizer('"A string with ;(stuff) in \\"it\\"."');
    test.equal(t.next().token, 'A string with ;(stuff) in "it".');

    test.done();
}

//--------------------------------------------------------------------------------
// Parsing
//--------------------------------------------------------------------------------

var parser = require('./parser');
var parse = parser.parse;
var unparse = parser.unparse;

exports.testParse = function(test)
{
    // Error-inducing examples
    //
    var perror = function(s) { test.throws(function () { parse(s); }); }

    perror('(');
    perror(')');
    perror('(]');
    perror('((');
    perror('(()');

    // Parse/unparse combos
    //
    var pup = function (s, t) { test.equal(unparse(parse(s)), t || s); }
   
    pup('');
    pup('a b','a\nb');
    pup('(a b c 1 "2" (3))');
    pup("'a", '(quote a)');
    pup("''a", '(quote (quote a))');
    pup('`(a b ,c ,@(d e))', '(quasiquote (a b (unquote c) (unquote-splicing (d e))))');
    pup('[* _ _]', '(fn * _ _)');
    pup('#');
    pup(':');
    pup('{a 1 b 2}', '(object a 1 b 2)');
    pup('123');
    pup('"123"');
    pup('true');

    test.done();
}

exports.testBracketDesugaring = function(test)
{
    var p = parse('[1 2 3]')[0];
    test.equal(p.length, 4);
    test.equal(p[0].token, '[');
    test.equal(p[0].atom, 'fn');

    p = parse('{1 2 3}')[0];
    test.equal(p.length, 4);
    test.equal(p[0].token, '{');
    test.equal(p[0].atom, 'object');
    test.done();
}



//--------------------------------------------------------------------------------
// Compiling
//--------------------------------------------------------------------------------
var compile = require('compiler').compile;

exports.testCompile = function(test)
{
    test.equal(compile(parse('(var number 42)')).indexOf('var number = 42'), 0);

    test.done();
}

//--------------------------------------------------------------------------------
// Matching CoffeeScript
//--------------------------------------------------------------------------------

var run = require('qs').run;

exports.testDeclaration = function(test)
{
    test.equal(run('(var number 42) number'), 42);
    test.equal(run('(var opposite true) opposite'), true);
    test.done();
}

exports.testSequence = function(test)
{
    var p = 
'(begin (var number 42) \
     (var opposite true) \
     (when opposite \
         (= number -42)))';

    test.equal(run(p), -42);
    test.done();
}

exports.testFn = function(test)
{
    var p =
'(var sqr (fun (x) \
              (* x x))) \
 (sqr 5)';
    test.equal(run(p), 25);
    test.done();
}

exports.testArray = function(test)
{
    test.equal(compile(parse('(array 1 2 3 4 5)')).indexOf('[1, 2, 3, 4, 5]'), 0);
    test.done();
}

exports.testObject = function(test)
{
    var p = 
'(var square (fun (x) (* x x))) \
(var m (object \
           root   Math.sqrt \
           square square \
           cube   (fun (x) (* x (square x))))) \
(m.root 9)';

    test.equal(run(p), 3);
    test.done();
}

exports.testRestParameters = function(test)
{
    var p = 
'(var args (fun (x y . z) \
              (+ 2 z.length))) \
(args 1 2 3 4 5)';

    test.equal(run(p), 5);
    test.done();
}

exports.testExistentialOperator = function(test)
{
    test.ok(run('(var a 5) (exists? a)'));
    test.equal(run('(exists? b)'), false);
    test.done();
}

//--------------------------------------------------------------------------------
// Matching arc
//--------------------------------------------------------------------------------

// Iteration operators
//
exports.for = function(test)
{
    test.equal(run('(var j 1) (for i 1 6 (= j (* i j)))'), 720);
    test.done();
}


// Optional arguments
//

// Currying
//

// Negation
//

// Macros
