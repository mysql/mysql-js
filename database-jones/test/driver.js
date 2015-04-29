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
global.adapter    = "ndb";

var driver       = require(mynode.fs.test_driver);

// The --adapter option only applies when you are here in database-jones/test
driver.addCommandLineOption("-a", "--adapter", "only run on the named adapter",
  function(thisArg) {
    if(thisArg) {
      global.adapter = thisArg;
      return 1;
    }
    return -1;  // adapter is required
  });

driver.processCommandLineOptions();
driver.loadUtilities();
driver.addSuitesFromDirectory(mynode.fs.suites_dir);
driver.runAllTests();

