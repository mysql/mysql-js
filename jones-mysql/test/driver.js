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

// Setup globals:
global.mynode     = require("database-jones");
global.adapter    = "mysql";

var jonesMysql    = require("jones-mysql");
var driver        = require(mynode.fs.test_driver);
var storageEngine = null;

driver.addCommandLineOption("-e", "--engine", "use named mysql storage engine",
  function(thisArg) {
    storageEngine = thisArg;
    return 1;
  });

driver.processCommandLineOptions();
driver.loadUtilities();

/* Set storage engine from command-line options 
   This has to happen *after* loadUtilities()
*/
if(storageEngine && global.test_conn_properties) {
   global.test_conn_properties.mysql_storage_engine = storageEngine;
}

/* Find and run all tests */
driver.addSuitesFromDirectory(mynode.fs.suites_dir);
driver.addSuitesFromDirectory(jonesMysql.config.suites_dir);
driver.runAllTests();

