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

var jonesMysql = require("jones-mysql");
var tests = [ new harness.LintSmokeTest() ];

function more(more_tests) {
  Array.prototype.push.apply(tests, more_tests);
}

more(harness.getLintTestsForDirectory(jonesMysql.fs.suites_dir, "numerictypes"));
more(harness.getLintTestsForDirectory(jonesMysql.fs.suites_dir, "stringtypes"));
more(harness.getLintTestsForDirectory(jonesMysql.fs.suites_dir, "mysql56types"));

//stringtypes
harness.ignoreLint("CharsetTest.js", 27, "Missing \'new\'.");
harness.ignoreLint("CharsetTest.js", 26, "Missing \'new\'.", 14);

//numerictypes
harness.ignoreLint("QueryKeywordTest.js", 95, "Expected \'String\' and instead saw \'\'\'\'.");
harness.ignoreLint("lib.js", 95, "Expected \'String\' and instead saw \'\'\'\'.");

module.exports.tests = tests;
