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

// ****** SOURCES FILES TO CHECK ********** //

checkDirectory(mynode.fs.adapter_dir, "impl/common");
checkDirectory(mynode.fs.adapter_dir, "impl/mysql");
checkDirectory(mynode.fs.adapter_dir, "impl/ndb");
checkDirectory(mynode.fs.adapter_dir, "api");

checkFile(mynode.fs.suites_dir, "lint", "LintTest.js");
checkFile(mynode.fs.suites_dir, "", "driver.js");
checkFile(mynode.fs.suites_dir, "lib", "harness.js");
checkFile(mynode.fs.suites_dir, "", "utilities.js");

checkDirectory(mynode.fs.suites_dir, "spi");
checkDirectory(mynode.fs.suites_dir, "numerictypes");
checkDirectory(mynode.fs.suites_dir, "stringtypes");
checkDirectory(mynode.fs.suites_dir, "autoincrement");
checkDirectory(mynode.fs.suites_dir, "multidb");
checkDirectory(mynode.fs.suites_dir, "t_basic");
checkDirectory(mynode.fs.suites_dir, "composition");
checkDirectory(mynode.fs.suites_dir, "freeform");

checkDirectory(mynode.fs.samples_dir, "loader", "lib");
checkDirectory(mynode.fs.samples_dir, "tweet");

/**** ERRORS TO IGNORE:
   ignore(filename, startpos, message) 
   Ignores error in <filename> starting at character <startpos> of any line
   and matching <message>.
   If multiple errors are declared for one file, they must match in the order declared.
***/

// Adapter/impl/common
ignore("IndexBounds.js", 11, "Expected a conditional expression and instead saw an assignment.");
ignore("IndexBounds.js", 13, "Expected a conditional expression and instead saw an assignment.");

// Adapter/impl/ndb
ignore("NdbOperation.js", 22, "Use the array literal notation [].");  // 374
ignore("NdbOperation.js",27,"\'gather\' was used before it was defined."); //550

ignore("NdbConnectionPool.js",15,"Expected a conditional expression and instead saw an assignment.");
ignore("NdbConnectionPool.js",17,"Expected a conditional expression and instead saw an assignment.");

ignore("LintTest.js",14,"Expected a conditional expression and instead saw an assignment.");
ignore("TableMapping.js",3,"The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype.");
ignore("stats.js",13,"Expected '{' and instead saw 'r'.");
ignore("MySQLDictionary.js",7,"Missing 'break' after 'case'.");

ignore("UserContext.js", 33, "Unexpected \'\\.\'.");
ignore("UserContext.js", 7, "Confusing use of \'!\'.");

ignore("NdbTransactionHandler.js", 32, "Expected \'{\' and instead saw \'scans\'.");
ignore("NdbScanFilter.js", 34, "Expected \'{\' and instead saw \'return\'.");

// spi
ignore("BasicVarcharTest.js", 19, "Expected \'{\' and instead saw \'onSession\'.");
ignore("BasicVarcharTest.js", 10, "Expected \'{\' and instead saw \'connection\'.");
ignore("SmokeTest.js", 13, "Expected \'{\' and instead saw \'test\'.");
ignore("SmokeTest.js", 10, "Expected \'{\' and instead saw \'test\'.");

//stringtypes
ignore("CharsetTest.js", 27, "Missing \'new\'.");
ignore("CharsetTest.js", 26, "Missing \'new\'.", 14);

//numerictypes
ignore("QueryKeywordTest.js", 95, "Expected \'String\' and instead saw \'\'\'\'.");
ignore("lib.js", 95, "Expected \'String\' and instead saw \'\'\'\'.");

// t_basic
ignore("BatchTest.js", 6, "Don't make functions within a loop.");
ignore("ParallelOperationTest.js", 6, "Don't make functions within a loop.");
ignore("SaveTest.js", 8, "Don't make functions within a loop.");
ignore("SaveTest.js", 8, "Don't make functions within a loop.");
ignore("SaveTest.js", 10, "Don't make functions within a loop.");
ignore("UpdateTest.js", 8, "Don't make functions within a loop.");
ignore("UpdateTest.js", 10, "Don't make functions within a loop.");
ignore("UpdateTest.js", 8, "Don't make functions within a loop.");
ignore("UpdateTest.js", 10, "Don't make functions within a loop.");
ignore("UpdateTest.js", 8, "Don't make functions within a loop.");
ignore("UpdateTest.js", 10, "Don't make functions within a loop.");
ignore("UpdateTest.js", 8, "Don't make functions within a loop.");
ignore("UpdateTest.js", 10, "Don't make functions within a loop.");

// multidb
ignore("ConnectTest.js", 42,  "Unexpected \'\\.\'.");
ignore("ConnectTest.js", 42,  "Unexpected \'\\.\'.");
