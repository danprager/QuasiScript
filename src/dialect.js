/// dialect.js: Defines the lisp dialect of QuasiScript
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
///

// The special forms of our Lisp
// 
exports.specialForms = {
    'var': 'DECLARATION',
    '=': 'ASSIGNMENT',
    'fun': 'LAMBDA',
    'begin': 'SEQUENCE',
    'when': 'WHEN',
    'array': 'ARRAY',
    'object': 'OBJECT',
    'exists?': 'EXISTENCE',
    'for': 'FOR',
    'while': 'WHILE',
    'until': 'UNTIL',
    'quote': 'QUOTE' };

// Is 'ch' a reserved punctuation character?
//
exports.isPunctuation = function(ch) { return "'`,@#~:".indexOf(ch) > -1; }

// List of long punctuation symbols that the tokenizer should clump together.
// Note: Be sure to put longer ones with the same prefix before shorter ones.
//
exports.longPunctuation = [',@'];

// Syntactic sugar
//
exports.bracketSugar = { 
    '[': 'fn', 
    '{': 'object' };

exports.punctuationSugar = {
    "'": 'quote',
    '`': 'quasiquote',
    ',': 'unquote',
    ',@': 'unquote-splicing' };

// Special values get mapped to the constants of JS: true, false, null, etc.
//
exports.constants = {
    'true': true,              // Scheme: #t
    'false': false,            // Scheme: #f
    'null': null,              // Scheme: nil
    'undefined': undefined, 
    'NaN': NaN,
    'Infinity': Infinity,
    '-Infinity': -Infinity
}

// Binary operators
//
exports.binaryOperator = { 
    '+': '+', 
    '-':'-', 
    '*':'*', 
    '/': '/',
    'and': '&&', 
    'or': '||',
    'mod': '%'     // not associative 
 };

// Unary operators
//
exports.unaryOperator = {
    'not': '!' }

// Comparisons
//
exports.comparisonOperators = {
    'equal?': '===',
    'unequal?': '!==',   // but (unequal? a b c) -> (not (equal? a b c))
    '<': '<',
    '>': '>',
    '<=': '<=',
    '>=': '>=' }


