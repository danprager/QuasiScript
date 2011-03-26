/// utility.js: Common utility functions for QuasiScript
///
/// Repository: https://github.com/danprager/QuasiScript
///
/// (c) Daniel Prager, 2011
///

//--------------------------------------------------------------------------------
// Error reporting
//--------------------------------------------------------------------------------

exports.reportError = function(line, column, message, innerErrors)
{
    var result = 'Line ' + line + ', column ' + column + ': ' + message;

    if (innerErrors) result += '\n' + innerErrors

    return result;
}

//--------------------------------------------------------------------------------
// Lists (as arrays)
//--------------------------------------------------------------------------------

// Lists are arrays.
//
exports.isList = function(a) { return Array.isArray(a); };

// List manipulation
//
exports.first = function(a) { return a[0]; }
exports.rest = function(a) { return a.slice(1); }
exports.drop = function(n, a) { return a.slice(n); }

//--------------------------------------------------------------------------------
// Higher order functions
//--------------------------------------------------------------------------------

// Use underscore library instead?
//
exports.map = function(arr, fn)
{
    var result, i;
    
    for(i=0, result=[]; i<arr.length; i++) 
	result.push(fn(arr[i]));

    return result;
}

exports.each = function(arr, fn)
{  
    for(var i=0; i<arr.length; i++) fn(arr[i]);
}
