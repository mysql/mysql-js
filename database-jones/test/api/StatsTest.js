/*
 Copyright (c) 2012, 2016, Oracle and/or its affiliates. All rights
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

/** This is the smoke test for the spi suite.
    We go just as far as getDBServiceProvider().
    This tests the loading of required compiled code in shared library files.
 */

"use strict";

var http = require("http");
var jones = require("database-jones");
var harness = require("jones-test");

var test = new harness.SerialTest("statsServer");

var stats_server_port = 15301;

test.run = function() {

  function onClose() {
    test.failOnError();
  }

  function onResult(response) {
    test.errorIfNotEqual("statusCode", response.statusCode, 200);
    jones.stats.stopServers(onClose);
  }

  function statsQuery() {
    var requestParams = {
      host: 'localhost',
      port: stats_server_port,
      path: '/'
    };

    var req = http.get(requestParams, onResult);
    req.on('error', function() {
      test.appendErrorMessage("connect error");
      jones.stats.stopServers(onClose);
    });
  }

  jones.stats.startServer(stats_server_port, "localhost", statsQuery);
};

module.exports.tests = [ test ] ;

