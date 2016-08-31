/*
 Copyright (c) 2013, 2015 Oracle and/or its affiliates. All rights
 reserved.
 
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation; version 2 of
 the License.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 02110-1301  USA
 */

"use strict";

var path   = require("path"),
    fs     = require("fs"),
    util   = require("util"),
    assert = require("assert"),
    unified_debug = require("unified_debug"),
    udebug = unified_debug.getLogger("LintTest.js"),
    Test   = require("./Test");

var skipTests = false;
var haveJsLint = false;
var ignoredErrors = {};  // File-scope, for all tests
var workingIgnoredErrors = {}; // working copy of ignored errors
var lintModule, linter;

var lintOptions = {
  "vars"      : true,     // allow multiple var declarations
  "plusplus"  : true,     // allow ++ and -- operators
  "white"     : true,     // misc. white space
  "stupid"    : true,     // sync methods
  "node"      : true,     // node.js globals
  "nomen"     : true,     // allow dangling underscore
  "eqeq"      : true,     // allow ==
  "bitwise"   : true,     // allow bitwise operators
  "ass"       : true,     // allow assignment expressions
  "todo"      : true,     // allow TODO comments
  "regexp"    : true,     // allow . and [^ ...] in regular expressions
  "unparam"   : true,     // allow unused parameters,
  "debug"     : true      // allows empty blocks
};

var jslintLoaderError;

try { 
  lintModule = require("jslint/lib/linter");
  linter = lintModule.lint;
  assert(typeof linter === 'function');
  haveJsLint = true;  // older node-jslint
}
catch(e1) {
  jslintLoaderError = e1.message;
  try {
    lintModule = require("jslint");
    linter = lintModule.load("es5");
    assert(typeof linter === 'function');
    haveJsLint = true;  // newer node-jslint
  }
  catch(e2) {
    jslintLoaderError = e2.message;
  }
}
if(! haveJsLint) { 
  skipTests = true;
}

// LintTest

function LintTest(basePath, sourceFile) {
  this.sourceFileName = path.basename(sourceFile);
  this.sourceFile     = path.resolve(basePath, sourceFile);
  this.name           = path.basename(basePath) + "/" + path.basename(sourceFile);
}

LintTest.prototype = new Test.Test();

LintTest.prototype.fullName = function() {
  return this.suite.name + " " + this.name;
};


// LintSmokeTest

function LintSmokeTest() {
  this.phase = 0;
  this.name = "LintSmokeTest";
}

LintSmokeTest.prototype = new Test.Test();

LintSmokeTest.prototype.run = function() {
  if(skipTests) {
    this.fail("linter is not available: " + jslintLoaderError);
  } else {
    // there is one copy of workingIgnoredErrors for all lint tests
    // so before each series of lint tests,
    // deep copy ignoredErrors to workingIgnoredErrors
    workingIgnoredErrors = JSON.parse(JSON.stringify(ignoredErrors));
    this.pass();
  }
};

function isIgnored(file, pos, msg) {
  var list;
  var ignoreAlways = "Expected \'{\' and instead saw";
  list = workingIgnoredErrors[file];
  if(list && list[0] && (list[0].pos === pos) && (msg.search(list[0].msg) > -1)) {
    list.shift();
    return true;
  }
  if(msg.indexOf(ignoreAlways) === 0) {
    return true;
  }
  return false;
}

/// run() method for LintTest 

LintTest.prototype.run = function() {
  if(skipTests) { return this.skip("jslint not avaliable"); }

  var e, i, n=0;
  var ok, errors, msg = "";
  var data = fs.readFileSync(this.sourceFile, "utf8");  
  var result = linter(data, lintOptions);
  var nIgnored = 0;

  /* Adapt to differing APIs of jslint and jshint */
  if(typeof result === 'boolean') {
    /* We are using jshint */
    ok = result;
    errors = linter.errors;
  }
  else {
    /* jslint */
    ok = result.ok;
    errors = result.errors;
  }

  try {
    nIgnored = ignoredErrors[this.sourceFileName].length;
  } catch(ignore) { }

  if(! ok) {
    udebug.log(this.sourceFileName, "errors:", errors.length, "ignored:", nIgnored);
    for (i = 0; i < errors.length; i += 1) {
      e = errors[i];
      if(e && ! isIgnored(this.sourceFileName, e.character, e.reason)) {
        n += 1;
        msg += util.format('\n * Line %d[%d]: %s', e.line, e.character, e.reason);
      }
    }
    msg = util.format("%d lint error%s", n, n===1 ? '':'s') + msg;
    if (n > 0) {
      this.appendErrorMessage(msg);
    }
  }
  return true;
};

function ignore(file, pos, msg, count) {
  var i;
  var list = ignoredErrors[file];
  if(! list) {
    list = []; ignoredErrors[file] = list;
    workingIgnoredErrors[file] = list;
  }
  if(count === undefined) {
    list.push({ 'pos': pos, 'msg': msg});
  }
  else {
    for(i = 0 ; i < count ; i++) {
      list.push({ 'pos': pos, 'msg': msg});
    }
  }
  udebug.log("ignore:", file, pos, msg, count ? "x"+count : "");
}

function predefine(keywordArray) {
  lintOptions.predef = keywordArray;
}

var skipFilePatterns = [
  /^\./,        // skip files starting with .
  /~[1-9]~$/    // bzr leaves these around
];

function getLintTestsForDirectory(directory) {
  var tests, files, file, i, useFile;
  tests = [];

  for(i = 1 ; i < arguments.length ; i++) {
    directory = path.resolve(directory, arguments[i]);
  }

  /* Add the individual file lint tests */
  files = fs.readdirSync(directory);
  while(file = files.pop()) {
    useFile = false;
    for(i = 0 ; i < skipFilePatterns.length ; i++) {
      if( (file.match(/\.js$/) && (! file.match(skipFilePatterns[i])))) {
        useFile = true;
      }
    }
    if(useFile) {
      tests.push(new LintTest(directory, file));
    }
  }

  return tests;
}


exports.forDirectory           = getLintTestsForDirectory;
exports.LintTest               = LintTest;
exports.LintSmokeTest          = LintSmokeTest;
exports.ignore                 = ignore;
exports.predefine              = predefine;
