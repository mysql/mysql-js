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

/*global adapter */

"use strict";

var path    = require("path"),
    fs      = require("fs"),
    assert  = require("assert"),
    jones   = require("database-jones"),
    udebug  = unified_debug.getLogger("utilities.js"),
    test_conn_properties,
    dbServiceProvider,
    metadataManager;


/* Manage test_connection.js file:
   Read it if it exists.
   If it doesn't exist, copy it from the standard template
*/
function getTestConnectionProperties(base_dir) {
  var props_file     = path.join(base_dir, "test_connection.js");
  var props_template = path.join(base_dir, "test_connection_defaults.js");
  var existsSync     = fs.existsSync || path.existsSync;
  var properties     = null;
  var f1, f2; 
  
  if(! existsSync(props_file)) {
    try {
      f1 = fs.createReadStream(props_template);
      f2 = fs.createWriteStream(props_file);
      f1.pipe(f2);
      f1.on('end', function() {});
    }
    catch(e1) {
      console.log(e1);
    }
  }

  return require(props_file);
}

function getConnectionProperties(adapter, base_dir) {
  var testEnvProperties = getTestConnectionProperties(base_dir);
  testEnvProperties.implementation = adapter;

  dbServiceProvider = jones.getDBServiceProvider(adapter);
  test_conn_properties = new jones.ConnectionProperties(testEnvProperties);
  metadataManager = dbServiceProvider.getDBMetadataManager(test_conn_properties);

  return test_conn_properties;
}


/** Metadata management */
global.sqlCreate = function(suite, callback) {
  metadataManager.createTestTables(suite.name, suite.path, callback);
};

global.sqlDrop = function(suite, callback) {
  metadataManager.dropTestTables(suite.name, suite.path, callback);
};


function tryCallback(result, testCase, callback) {
  if (typeof callback !== 'function') {
    return;
  }
  try {
    callback(result, testCase);
  }
  catch(e) {
    testCase.appendErrorMessage(e);
    testCase.stack = e.stack;
    testCase.failOnError();
  }
}

/** Open a session or fail the test case */
global.fail_openSession = function(testCase, callback) {
  var promise;
  if (arguments.length < 1 || arguments.length > 2) {
    throw new Error('Fatal internal exception: fail_openSession must have  1 or 2 parameters: testCase, callback');
  }
  promise = jones.openSession(test_conn_properties, testCase.mappings, function(err, session) {
    if (callback && err) {
      testCase.fail(err);
      return;   // why?
    }
    testCase.session = session;
    tryCallback(session, testCase, callback);
  });
  return promise;
};

/** Connect or fail the test case */
global.fail_connect = function(testCase, callback) {
  var promise;
  if (arguments.length === 0) {
    throw new Error('Fatal internal exception: fail_connect must have  1 or 2 parameters: testCase, callback');
  }
  var properties = test_conn_properties;
  var mappings = testCase.mappings;
  promise = jones.connect(properties, mappings, function(err, sessionFactory) {
    if (callback && err) {
      testCase.fail(err);
      return;   // why?
    }
    testCase.sessionFactory = sessionFactory;
    tryCallback(sessionFactory, testCase, callback);
  });
  return promise;
};


exports.getConnectionProperties = getConnectionProperties;

