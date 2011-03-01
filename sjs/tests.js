/// Test for sjs simple-scheme-in-javascript interpreter.
///
/// (c) Daniel Prager, 2011
///
/// Run these tests using the nodeunit testing framework: https://github.com/caolan/nodeunit
///
/// Installation> npm install node unit
/// Command-line> nodeunit tests.js
///

var sjs = require('sjs');

exports.testSymbols = function(test) 
{
    test.ok(sjs.isSymbol('blah'));
    test.done();
}

exports.testLists = function(test)
{
    var list = ['+', 1, 2];

    test.ok(sjs.isList([]));
    test.ok(sjs.isList(list));
    test.equal(sjs.first(list), '+');
    test.deepEqual(sjs.rest(list), [1, 2]);
    test.done();
}

exports.testEnvironments = function(test) 
{
    var e1 = sjs.makeEnv(['x', 'y'],[1, 10]);
    var e2 = sjs.makeEnv(['x'],[2], e1);
    test.equal(e2.find('x')['x'], 2);
    test.equal(e2.find('y')['y'], 10);
    test.ok(sjs.$globalEnv$.find('symbol?'));
    test.done();
}

exports.testSpecialForms = function(test)
{
    // quote
    test.deepEqual(sjs.evaluate(['quote',1]), 1);
    test.deepEqual(sjs.evaluate(['quote',[1,2]]), [1,2]);

    // if
    test.equal(sjs.evaluate(['if',true,1,2]), 1);
    test.equal(sjs.evaluate(['if',false,1,2]), 2);
    test.equal(sjs.execute('(if (> 100 0) 1 2)'), 1);
    test.equal(sjs.execute('(if (< 100 0) 1 2)'), 2);
    test.equal(sjs.execute('(if (empty? (list)) 1 2)'), 1);
    test.equal(sjs.execute('(if (not (empty? (list))) 1 2)'), 2);

    // define
    sjs.evaluate(['define','x',99]);
    test.equal(sjs.evaluate('x'), 99);

    // set!
    sjs.evaluate(['set!','x',55]);
    test.equal(sjs.evaluate('x'), 55);

    //lambda
    sjs.evaluate(['define','sqr',['lambda',['x'],['*','x','x']]]);
    test.equal(sjs.evaluate(['sqr', 5]), 25);

    //begin
    test.equal(sjs.evaluate(['begin',['define','y',12],['*','y','y']]), 144);

    test.done();
}

exports.testProcs = function(test)
{
    test.equal(sjs.evaluate(['+',1,2]), 3);
    
    test.done();
}

exports.testParsing = function(test)
{
    test.deepEqual(sjs.tokenize('(a b c (2))'),['(', 'a','b','c','(','2',')', ')']);
    test.deepEqual(sjs.parse('((1)(2)(3 3 frog))'), [[1],[2],[3,3,'frog']]);
    test.done();
}

exports.testExecute = function(test)
{
    // Area of a circle
    //
    sjs.execute('(define area (lambda (r) (* 3.141592653 (* r r))))');
    test.equal(sjs.execute('(area 3)'), 28.274333877);

    // Factorial function
    //
    sjs.execute('(define fact (lambda (n) (if (<= n 1) 1 (* n (fact (- n 1))))))');
    test.equal(sjs.execute('(fact 10)'), 3628800);
    
    // First class functions and a little recursive counting algorithm
    //
    sjs.execute('(define first car)');
    sjs.execute('(define rest cdr)');
    sjs.execute('(define count (lambda (item L) (if (empty? L) 0 (+ (equal? item (first L)) (count item (rest L))) )))');
    test.equal(sjs.execute('(count 0 (list 0 1 2 3 0 0))'), 3);
    test.equal(sjs.execute('(count (quote the) (quote (the more the merrier the bigger the better)))'), 4);
    test.done();
}
