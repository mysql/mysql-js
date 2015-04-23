/*
 Copyright (c) 2012, 2013, 2014 Oracle and/or its affiliates. All rights
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

// Setup globals:
global.mynode     = require("database-jones");
global.adapter    = "ndb";
global.harness    = require("jones-test");

var stats_module = require(mynode.api.stats);


/*****************************************************************************
 ********************** main process *****************************************
 *****************************************************************************/
var storageEngine = null;

var driver = new harness.Driver(mynode.fs.suites_dir);

driver.addCommandLineOption("-a", "--adapter", "only run on the named adapter",
  function(nextArg) {
    global.adapter = nextArg;
    return 2;
  });

driver.addCommandLineOption("-e", "--engine", "use named mysql storage engine",
  function(nextArg) {
    storageEngine = nextArg;
    return 2;
  });

driver.addCommandLineOption("", "--set <var>=<value>", "set a global variable",
  function(nextArg) {
    pair = nextArg.split('=');
    if(pair.length === 2) {
      udebug.log_detail("Setting global:", pair[0], "=", pair[1]);
      global[pair[0]] = pair[1];
    }
    else {
      console.log("Invalid --set option " + process.argv[i]);
      exit = true;
    }
    return 2;
  });

driver.addCommandLineOption("", "--stats <query>",
  "show server statistics after test run",
  function(nextArg) {
    driver.doStats = true;
    driver.statsDomain = nextArg;
    return 2;
  });

driver.processCommandLineOptions();


/* global.adapter is now set.  Read in the utilities library for the test suite; 
   it may set some additional globals.
*/
require("./utilities.js");


/* Set storage engine from command-line options */
if(storageEngine && global.test_conn_properties) {
  global.test_conn_properties.mysql_storage_engine = storageEngine;
}


/* Find and run all tests */
driver.runAllTests();

