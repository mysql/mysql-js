/*
Copyright (c) 2015, 2016 Oracle and/or its affiliates. All rights
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

var harness = require("jones-test");
var config = require("jones-mysql").config;
var test_root = config.suites_dir;
var tests = [ new harness.LintSmokeTest() ];

function more(more_tests) {
  if(harness.linterAvailable) {
    Array.prototype.push.apply(tests, more_tests);
  }
}

more(harness.getLintTestsForDirectory(config.impl_dir));
more(harness.getLintTestsForDirectory(test_root, "stringtypes"));
more(harness.getLintTestsForDirectory(test_root, "mysql56types"));
more(harness.getLintTestsForDirectory(test_root, "temporaltypes"));
more(harness.getLintTestsForDirectory(test_root, "read_write"));

//mysql
harness.ignoreLint("MySQLConnection.js", 9, "Unexpected 'continue'.");
harness.ignoreLint("MySQLConnection.js", 9, "Unexpected 'continue'.");
harness.ignoreLint("MySQLConnection.js", 9, "Unexpected 'continue'.");

// impl
harness.ignoreLint("MySQLDictionary.js",7,"Missing 'break' after 'case'.");
harness.ignoreLint("MysqlErrToSQLStateMap.js", 57, "Unexpected ','");

//stringtypes
harness.ignoreLint("CharsetTest.js", 27, "Missing \'new\'.");
harness.ignoreLint("CharsetTest.js", 26, "Missing \'new\'.", 14);

//mysql56types
harness.ignoreLint("CharsetTest.js", 0, "Unsafe character.");


module.exports.tests = tests;
