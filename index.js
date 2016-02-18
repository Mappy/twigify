'use strict';

var twig    = require('twig').twig;
var through = require('through2');
var isExist = false;
var ext = /\.(twig)$/;

function compile(id, str) {
  var template = twig({
    ref: id
  });

  var minified = minifyTwig(str.toString());
  if (!template) {
    template = twig({
      id: id,
      data: minified
    });
  }

  var tokens = JSON.stringify(template.tokens);

  var refName = getRefName(id);

  // the id will be the filename and path relative to the require()ing module
  return {
      src: 'twig({ id: "' + refName + '", data:' + tokens + ', precompiled: true, allowInlineIncludes: true })',
      dependencies: getDepencies(str, refName)
  };
}

function getDepencies (str, refName) {
    var includes = getPath(str);

    var pathDepth = refName.split('/').length;
    return includes.map(function(include) {
        var ret = '';
        for (var i = 1; i < pathDepth; i++) {
            ret += '../';
        }
        return ret + include;
    });
}
function process(source) {
    var str = source.dependencies.map(function (depency) {
        return 'require("' + depency + '");\n';
    }).join(" ");

  return str + 'module.exports = ' + source.src + ';\n';
}

function twigify(file, opts) {
  if (!ext.test(file)) return through();
  if (!opts) opts = {};

  var id = file;
  // @TODO: pass a path via CLI to use for relative file paths
  //opts.path ? file.replace(opts.path, '') : file;

  var buffers = [];

  function push(chunk, enc, next) {
    buffers.push(chunk);
    next();
  }

  function end(next) {
    var str = Buffer.concat(buffers).toString();
    var compiledTwig;

    try {
      compiledTwig = compile(id, str);
    } catch(e) {
      return this.emit('error', e);
    }

    this.push(process(compiledTwig));
    next();
  }

  return through(push, end);
}

function getRefName(path) {
    var refName = path;
    var match =  getPath(path);
    if (match) {
        refName = match[0];
    }

    return refName;
}

function getPath(str) {
    return str.match(/(FastBundle\/.*\/?.+\.twig)/g) || [];
}

function minifyTwig(str) {
    return str.replace(/\n/g, '');
}

module.exports = twigify;
module.exports.compile = compile;
