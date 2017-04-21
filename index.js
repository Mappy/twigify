/* global Buffer */

'use strict';

var twig = require('twig').twig;
var through = require('through2');
var minify = require('html-minifier').minify;
var path = require('path');

var extension = /\.(twig)$/;
var templatesDir;

var minifyDefaults = {
    removeComments: true,
    collapseWhitespace: true,
    ignoreCustomFragments: [ /\{%[\s\S]*?%\}/, /\{\{[\s\S]*?\}\}/ ]
};

function compile(id, str) {
    var minified = minify(str, minifyDefaults);

    var template = twig({
        id: templatesDir ? path.relative(path.resolve(templatesDir), id) : id,
        data: minified
    });

    // the id will be the filename and path relative to the require()ing module
    return 'twig({ id: "./' + template.id + '",  data:' + JSON.stringify(template.tokens) + ', precompiled: true, allowInlineIncludes: true })';
}

function _process(source, deps) {
    var out = ['var twig = require(\'twig\').twig;\n'];

    if (deps instanceof Array) {
        deps.forEach(function (dep) {
            out.push('require("./' + dep + '");\n');
        });
    }

    out.push('module.exports = ' + source + ';\n');

    return out.join('');
}

function twigify(file, opts) {
    if (!extension.test(file)) return through();
    if (!opts) opts = {};

    var id = file;
    // @TODO: pass a path via CLI to use for relative file paths
    // opts.path ? file.replace(opts.path, '') : file;

    var buffers = [];

    function push(chunk, enc, next) {
        buffers.push(chunk);
        next();
    }

    function end(next) {
        var str = Buffer.concat(buffers).toString();

        var depRe = /\{%\s*(?:extends|include)\s*(['"])(.+?)\1/g;
        var deps = [];
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

        this.push(_process(compiledTwig, deps));
        next();
    }

    return through(push, end);
}

function configure(options) {
    if (options.extension) {
        extension = options.extension;
    }

    if (options.templatesDir) {
        templatesDir = options.templatesDir;
    }

    return twigify;
}

module.exports = twigify;
module.exports.compile = compile;
module.exports.configure = configure;

