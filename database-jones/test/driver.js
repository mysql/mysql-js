/*
 Copyright (c) 2012, 2015 Oracle and/or its affiliates. All rights
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

var jones       = require("database-jones"),
    driver      = require(jones.fs.test_driver),
    adapter     = "ndb",
    extra,
    a_module,
    properties;


driver.addCommandLineOption("-a", "--adapter", "only run on the named adapter",
  function(thisArg) {
    var split;
    if(thisArg) {
      split   = thisArg.split("/");
      adapter = split[0];
      extra   = split[1];
      return 1;
    }
    return -1;  // adapter is required
  });

driver.processCommandLineOptions();


/* Add the standard Jones test suites */
driver.addSuitesFromDirectory(jones.fs.suites_dir);


/* Add the test suite for the specified adapter, and
   set the Connection Properties for the specified adapter. */
a_module = require ("jones-" + adapter);
driver.addSuitesFromDirectory(a_module.config.suites_dir);
properties = driver.getConnectionProperties(adapter, a_module.config.suites_dir);


/* Adapter-specific code goes here */
switch(adapter) {
  case "ndb":           /* NDB also runs the MySQL Test suite */
    a_module = require("jones-mysql");
    driver.addSuitesFromDirectory(a_module.config.suites_dir);
    break;
  case "mysql":         /* MySQL uses the extra argument to set engine */
    if(extra) properties.mysql_storage_engine = extra;
    break;
  default:
    break;
}


/* Set globals */
global.mynode               = jones;
global.adapter              = adapter;
global.test_conn_properties = properties;


/* Run all tests */
driver.runAllTests();
