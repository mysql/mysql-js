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

"use strict";

var LintTests = require("./JonesLintTests.js");

var driver = new harness.Driver();

driver.addCommandLineOption("-a", "--adapter", "only run on the named adapter",
  function(thisArg, nextArg) {
    global.adapter = nextArg;
    return 2;
  });

// THIS SHOULD MOVE INTO jones-mysql driver
//driver.addCommandLineOption("-e", "--engine", "use named mysql storage engine",
//  function(thisArg, nextArg) {
//    storageEngine = nextArg;
//    return 2;
//  });

driver.addCommandLineOption("", "--set <var>=<value>", "set a global variable",
  function(thisArg, nextArg) {
    var pair = nextArg.split('=');
    if(pair.length === 2) {
      global[pair[0]] = pair[1];
    }
    else {
      console.log("Invalid --set option " + nextArg);
      return 0;
    }
    return 2;
  });

driver.addCommandLineOption("", "--stats=<query>",
  "show server statistics after test run",
  function(thisArg) {
    driver.doStats = true;
    driver.statsDomain = thisArg || "/";
    return 1;
  });



LintTests.defineLintTests(driver);

module.exports = driver;

