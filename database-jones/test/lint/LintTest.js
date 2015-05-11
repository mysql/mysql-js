/*
Copyright (c) 2015 Oracle and/or its affiliates. All rights
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

// ****** SOURCES FILES TO CHECK ********** //

"use strict";

var tests = [ new harness.LintSmokeTest() ];

function more(more_tests) {
  Array.prototype.push.apply(tests, more_tests);
}

harness.predefineLint(["unified_debug", "harness", "mynode", "adapter", "jones",
                      "fail_openSession", "sqlCreate", "sqlDrop"]);

more(harness.getLintTestsForDirectory(mynode.fs.api_dir));
more(harness.getLintTestsForDirectory(mynode.fs.spi_common_dir));

more(harness.getLintTestsForDirectory(mynode.fs.suites_dir));

more(harness.getLintTestsForDirectory(mynode.fs.suites_dir, "spi"));
more(harness.getLintTestsForDirectory(mynode.fs.suites_dir, "autoincrement"));
more(harness.getLintTestsForDirectory(mynode.fs.suites_dir, "multidb"));
more(harness.getLintTestsForDirectory(mynode.fs.suites_dir, "t_basic"));
more(harness.getLintTestsForDirectory(mynode.fs.suites_dir, "composition"));
more(harness.getLintTestsForDirectory(mynode.fs.suites_dir, "freeform"));

// harness.getLintTestsForDirectory(mynode.fs.super_dir, "samples", "loader", "lib");
more(harness.getLintTestsForDirectory(mynode.fs.super_dir, "samples", "tweet"));

/**** ERRORS TO IGNORE:
 ignore(filename, startpos, message) 
 Ignores error in <filename> starting at character <startpos> of any line
 and matching <message>.
 If multiple errors are declared for one file, they must match in the order declared.
***/

// Adapter/impl/common
harness.ignoreLint("IndexBounds.js", 11, /Expected a conditional expression/, 2);


harness.ignoreLint("LintTest.js",14,"Expected a conditional expression and instead saw an assignment.");
harness.ignoreLint("TableMapping.js",3,"The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype.");
harness.ignoreLint("stats.js",13,"Expected '{' and instead saw 'r'.");

harness.ignoreLint("UserContext.js", 33, "Unexpected \'\\.\'.");
harness.ignoreLint("UserContext.js", 7, "Confusing use of \'!\'.");


// spi
harness.ignoreLint("BasicVarcharTest.js", 19, "Expected \'{\' and instead saw \'onSession\'.");
harness.ignoreLint("BasicVarcharTest.js", 10, "Expected \'{\' and instead saw \'connection\'.");
harness.ignoreLint("SmokeTest.js", 13, "Expected \'{\' and instead saw \'test\'.");
harness.ignoreLint("SmokeTest.js", 10, "Expected \'{\' and instead saw \'test\'.");

// t_basic
harness.ignoreLint("BatchTest.js", 6, "Don't make functions within a loop.");
harness.ignoreLint("ParallelOperationTest.js", 6, "Don't make functions within a loop.");
harness.ignoreLint("SaveTest.js", 8, "Don't make functions within a loop.", 2);
harness.ignoreLint("SaveTest.js", 10, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
harness.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");

// multidb
harness.ignoreLint("ConnectTest.js", 42,  "Unexpected \'\\.\'.");
harness.ignoreLint("ConnectTest.js", 42,  "Unexpected \'\\.\'.");

// API
harness.ignoreLint("ProxyFactory.js", 47, /Unexpected/);
harness.ignoreLint("ProxyFactory.js", 6,  /The body of a/);

// Composition
harness.ignoreLint("lib.js", 9, "Unexpected 'continue'", 2);
harness.ignoreLint("lib.js", 8, /Don\'t make functions/);
harness.ignoreLint("lib.js", 10, /Don\'t make functions/);

module.exports.tests = tests;
