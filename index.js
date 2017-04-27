/* global Buffer */

'use strict';

var twig    = require('twig').twig;
var through = require('through2');
var minify  = require('html-minifier').minify;
var path    = require('path');

var extension = /\.(twig)$/;

var minifyDefaults = {
    removeComments: true,
    collapseWhitespace: true,
    ignoreCustomFragments: [ /\{%[\s\S]*?%\}/, /\{\{[\s\S]*?\}\}/ ]
};

function replaceIncludePath (p, str) {
    var depRe = /\{%\s*(?:extends|include)\s*(['"])(.+?)\1/g;
    var m;

    while (m = depRe.exec(str)) {
        const replaceValue = path.resolve(path.dirname(path.resolve(p)), m[2]);
        str = str.replace(m[2], replaceValue);
    }

    return str;
}

function compile (id, str) {
    var template = twig({
        id: id,
        data: replaceIncludePath(id, minify(str, minifyDefaults))
    });

    // the id will be the filename and path relative to the require()ing module
    return `twig({id: '${id}', data:${JSON.stringify(template.tokens)}, allowInlineIncludes: true, precompiled: true})`;
}

function _process (source, deps, id) {
    var out = ['var twig = require(\'twig\').twig;\n'];

    if (deps instanceof Array) {
        deps.forEach(function (dep) {
            var u = path.resolve(path.dirname(path.resolve(id)), dep);
            out.push('require("' + u + '");\n');
        });
    }

    out.push('module.exports = ' + source + ';\n');

    return out.join('');
}

function twigify (file, opts) {
    if (!extension.test(file)) return through();
    if (!opts) opts = {};

    var id = file;

    var buffers = [];

    function push (chunk, enc, next) {
        buffers.push(chunk);
        next();
    }

    function end (next) {
        var str = Buffer.concat(buffers).toString();

        var depRe = /\{%\s*(?:extends|include)\s*(['"])(.+?)\1/g;
        var deps  = [];
        var m;

        while (m = depRe.exec(str)) {
            deps.push(m[2]);
        }

        var compiledTwig;

        try {
            compiledTwig = compile(id, str);
        } catch (e) {
            return this.emit('error', e);
        }

        this.push(_process(compiledTwig, deps, id));
        next();
    }

    return through(push, end);
}

module.exports         = twigify;
module.exports.compile = compile;

