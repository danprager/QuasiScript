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

// Tokenizing and parsing
//
exports.testTokenize = function(test)
{                           //1234567890123456789012345678901234567890
    var t = qs.makeTokenizer('(quick? 123.4 ["brown [] fox" jump-ed!\n,');
    test.deepEqual(t.next(), { token:'(', type:'BRACKET', line: 1, column: 1 });
    test.deepEqual(t.next(), { token:'quick?', type:'ATOM', line: 1 , column: 2 });
    test.deepEqual(t.next(), { token:'123.4', type:'ATOM', line: 1 , column: 9 });
    test.deepEqual(t.next(), { token:'[', type:'BRACKET', line: 1, column: 15 });
    test.deepEqual(t.next(), { token:'brown [] fox', type:'STRING', line: 1, column: 16 });
    test.deepEqual(t.next(), { token:'jump-ed!', type:'ATOM', line: 1, column: 31 });
    test.deepEqual(t.next(), { token:',', type:'PUNCTUATION', line: 2, column: 1 });
    test.ok(t.isEOS());

    t = qs.makeTokenizer('"No closing\nquotes');
    test.deepEqual(t.next(), {token: 'No closing\nquotes', type: 'STRING', line: 1, column: 1, 
			      error: 'Unexpected end-of-stream.'}); 
    

    test.deepEqual(qs.tokenize('(a "bat" clan (2 21.78))'),['(', 'a','bat','clan','(','2','21.78',')', ')']);
    //test.deepEqual(qs.parse('((1)(2)(3 3 frog))'), [[1],[2],[3,3,'frog']]);
    test.done();
}


// Matching CoffeeScript
//
exports.testAssignment = function(test)
{
    //test.equal(qs.run('(= number 42)'), 42);
    test.done();
}
