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

exports.defineLintTests = function(driver) {

  driver.predefineLint(["unified_debug", "harness", "mynode", "adapter", "jones",
                        "fail_openSession", "sqlCreate", "sqlDrop"]);

  driver.addLintTestsForDirectory(mynode.fs.api_dir);
  driver.addLintTestsForDirectory(mynode.fs.spi_common_dir);

  driver.addLintTestsForDirectory(mynode.fs.suites_dir);

  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "spi");
  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "numerictypes");
  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "stringtypes");
  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "autoincrement");
  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "multidb");
  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "t_basic");
  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "composition");
  driver.addLintTestsForDirectory(mynode.fs.suites_dir, "freeform");

 // driver.addLintTestsForDirectory(mynode.fs.super_dir, "samples", "loader", "lib");
  driver.addLintTestsForDirectory(mynode.fs.super_dir, "samples", "tweet");

/**** ERRORS TO IGNORE:
   ignore(filename, startpos, message) 
   Ignores error in <filename> starting at character <startpos> of any line
   and matching <message>.
   If multiple errors are declared for one file, they must match in the order declared.
***/

// Adapter/impl/common
  driver.ignoreLint("IndexBounds.js", 11, /Expected a conditional expression/, 2);

// Adapter/impl/ndb -- FIXME move to jones-ndb/test
  driver.ignoreLint("NdbOperation.js", 22, "Use the array literal notation [].");  // 374
  driver.ignoreLint("NdbOperation.js",27,"\'gather\' was used before it was defined."); //550

  driver.ignoreLint("NdbConnectionPool.js",15,"Expected a conditional expression and instead saw an assignment.");
  driver.ignoreLint("NdbConnectionPool.js",17,"Expected a conditional expression and instead saw an assignment.");

  driver.ignoreLint("LintTest.js",14,"Expected a conditional expression and instead saw an assignment.");
  driver.ignoreLint("TableMapping.js",3,"The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype.");
  driver.ignoreLint("stats.js",13,"Expected '{' and instead saw 'r'.");
  driver.ignoreLint("MySQLDictionary.js",7,"Missing 'break' after 'case'.");

  driver.ignoreLint("UserContext.js", 33, "Unexpected \'\\.\'.");
  driver.ignoreLint("UserContext.js", 7, "Confusing use of \'!\'.");

  driver.ignoreLint("NdbTransactionHandler.js", 32, "Expected \'{\' and instead saw \'scans\'.");
  driver.ignoreLint("NdbScanFilter.js", 34, "Expected \'{\' and instead saw \'return\'.");

// spi
  driver.ignoreLint("BasicVarcharTest.js", 19, "Expected \'{\' and instead saw \'onSession\'.");
  driver.ignoreLint("BasicVarcharTest.js", 10, "Expected \'{\' and instead saw \'connection\'.");
  driver.ignoreLint("SmokeTest.js", 13, "Expected \'{\' and instead saw \'test\'.");
  driver.ignoreLint("SmokeTest.js", 10, "Expected \'{\' and instead saw \'test\'.");

//stringtypes
  driver.ignoreLint("CharsetTest.js", 27, "Missing \'new\'.");
  driver.ignoreLint("CharsetTest.js", 26, "Missing \'new\'.", 14);

//numerictypes
  driver.ignoreLint("QueryKeywordTest.js", 95, "Expected \'String\' and instead saw \'\'\'\'.");
  driver.ignoreLint("lib.js", 95, "Expected \'String\' and instead saw \'\'\'\'.");

// t_basic
  driver.ignoreLint("BatchTest.js", 6, "Don't make functions within a loop.");
  driver.ignoreLint("ParallelOperationTest.js", 6, "Don't make functions within a loop.");
  driver.ignoreLint("SaveTest.js", 8, "Don't make functions within a loop.");
  driver.ignoreLint("SaveTest.js", 8, "Don't make functions within a loop.");
  driver.ignoreLint("SaveTest.js", 10, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 8, "Don't make functions within a loop.");
  driver.ignoreLint("UpdateTest.js", 10, "Don't make functions within a loop.");

// multidb
  driver.ignoreLint("ConnectTest.js", 42,  "Unexpected \'\\.\'.");
  driver.ignoreLint("ConnectTest.js", 42,  "Unexpected \'\\.\'.");

// API
  driver.ignoreLint("ProxyFactory.js", 47, /Unexpected/);
  driver.ignoreLint("ProxyFactory.js", 6,  /The body of a/);

// Composition
  driver.ignoreLint("lib.js", 9, "Unexpected 'continue'", 2);
  driver.ignoreLint("lib.js", 8, /Don\'t make functions/);
  driver.ignoreLint("lib.js", 10, /Don\'t make functions/);
};

