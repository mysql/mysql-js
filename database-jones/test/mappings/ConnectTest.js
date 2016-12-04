/*
 Copyright (c) 2016, Oracle and/or its affiliates. All rights
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

var util    = require("util"),
    jones   = require("database-jones"),
    harness = require("jones-test");


var verifyTableMetadataCached = function(testCase, sessionFactory, qualifiedTableName) {
  // look in sessionFactory to see if there is a cached table metadata
  var split = qualifiedTableName.split(".");
  var databaseName = split[0];
  var tableName = split[1];
  var tableMetadata = sessionFactory.tableMetadatas[qualifiedTableName];
  if (tableMetadata === undefined) {
    testCase.appendErrorMessage(tableName + ' was not cached in session factory.');
  } else {
    testCase.errorIfNotEqual('verifyTableMetadataCached mismatch database name', tableMetadata.database, databaseName);
    testCase.errorIfNotEqual('verifyTableMetadataCached mismatch table name', tableMetadata.name, tableName);
  }
};

var verifyTableHandlerCachedInSessionFactory = function(testCase, sessionFactory, qualifiedTableName) {
  // look in sessionFactory to see if there is a cached table handler
  var split = qualifiedTableName.split(".");
  var databaseName = split[0];
  var tableName = split[1];
  var tableHandler = sessionFactory.tableHandlers[qualifiedTableName];
  if (tableHandler === undefined) {
    testCase.appendErrorMessage('DBTableHandler for ' + qualifiedTableName + ' was not cached in session factory.');
  } else {
    testCase.errorIfNotEqual('verifyTableMetadataCached mismatch database name', databaseName, tableHandler.dbTable.database);
    testCase.errorIfNotEqual('verifyTableMetadataCached mismatch table name', tableName, tableHandler.dbTable.name);
  }
};

var verifyTableHandlerCachedInSession = function(testCase, session, qualifiedTableName) {
  // look in session to see if there is a cached table handler
  var split = qualifiedTableName.split(".");
  var databaseName = split[0];
  var tableName = split[1];
  var tableHandler = session.tableHandlers[qualifiedTableName];
  if (tableHandler === undefined) {
    testCase.appendErrorMessage('DBTableHandler for ' + tableName + ' was not cached in session.');
  } else {
    testCase.errorIfNotEqual('verifyTableHandlerCachedInSession mismatch database name', tableHandler.dbTable.database, databaseName);
    testCase.errorIfNotEqual('verifyTableHandlerCachedInSession mismatch table name', tableHandler.dbTable.name, tableName);
  }
};

var verifyConstructorMetadataCached = function(testCase, sessionFactory, qualifiedTableName, constructor) {
  verifyTableMetadataCached(testCase, sessionFactory, qualifiedTableName);
    // look in constructor to see if there is a cached table handler
  var split = qualifiedTableName.split(".");
  var databaseName = split[0];
  var tableName = split[1];
  var tableHandler = constructor.prototype.jones.dbTableHandler;
  if (tableHandler === undefined) {
    testCase.appendErrorMessage(tableName + ' table handler was not cached in constructor.');
  } else {
    testCase.errorIfNotEqual('verifyConstructorMetadataCached mismatch database name', tableHandler.dbTable.database, databaseName);
    testCase.errorIfNotEqual('verifyConstructorMetadataCached mismatch table name', tableHandler.dbTable.name, tableName);
  }
};

var basicMapping = new jones.TableMapping(
    {
    "database" : "test",
    "table" : "mappings_basic",
    "mapAllColumns" : false,
    "fields" : [
      {"fieldName" : "id", "columnName" : "id", "persistent" : true}
    ]
    }
  );

var nameMapping = new jones.TableMapping(
    {
    "table" : "mappings_basic",
    "mapAllColumns" : false,
    "fields" : [
      {"fieldName" : "id", "columnName" : "id", "persistent" : true},
      {"fieldName" : "name", "columnName" : "name", "persistent" : true}
    ]
    }
  );

var t1 = new harness.SerialTest('testConnectCallbackButNoMapping');
var t2 = new harness.SerialTest('testConnectWithTableName');
var t3 = new harness.SerialTest('testConnectWithTableMapping');
var t4 = new harness.SerialTest('testConnectWithTableMappingOpenSessionFind');
var t5 = new harness.SerialTest('testConnectWithTableMappingOpenSessionOverrideFind');
var t6 = new harness.SerialTest('testConnectWithTableMappingOpenSessionFindOverride');


t1.run = function() {
  var testCase = this;
  var onConnectCalled = false;
  function onConnect(err, session) {
    onConnectCalled = true;
    if (err) {
      testCase.appendErrorMessage('t1 error reported by onConnect: ' + err);
    }
  }
  function checkResult(factory) {
    if (!onConnectCalled) {
      testCase.appendErrorMessage('t1 callback not called');
    }
    testCase.failOnError();
  }
  function failTest(err) {
    testCase.fail('t1 error reported by promise.then: ' + err.message);
  }
  var promise = jones.connect(global.test_conn_properties, onConnect);
  promise.then(checkResult, failTest);
};

t2.run = function() {
  var testCase = this;
  var onConnectCalled = false;
  function onConnect(err, session) {
    onConnectCalled = true;
    if (err) {
      testCase.appendErrorMessage('t2 error reported by onConnect: ' + err);
    }
  }
  function checkResult(factory) {
    if (!onConnectCalled) {
      testCase.appendErrorMessage('t2 callback not called');
    }
    verifyTableMetadataCached(testCase, factory, 'test.mappings_basic');
    verifyTableHandlerCachedInSessionFactory(testCase, factory, 'test.mappings_basic')
    testCase.failOnError();
  }
  function failTest(err) {
    testCase.fail('t1 error reported by promise.then: ' + err.message);
  }
  var promise = jones.connect(global.test_conn_properties, 'test.mappings_basic', onConnect);
  promise.then(checkResult, failTest);
};

t3.run = function() {
  var testCase = this;
  var onConnectCalled = false;
  function onConnect(err, session) {
    onConnectCalled = true;
    if (err) {
      testCase.appendErrorMessage('t3 error reported by onConnect: ' + err);
    }
  }
  function checkResult(factory) {
    if (!onConnectCalled) {
      testCase.appendErrorMessage('t3 callback not called');
    }
    verifyTableMetadataCached(testCase, factory, 'test.mappings_basic');
    verifyTableHandlerCachedInSessionFactory(testCase, factory, 'test.mappings_basic');
    testCase.failOnError();
  }
  function failTest(err) {
    testCase.fail('t3 error reported by promise.then: ' + err.message);
  }
  var promise = jones.connect(global.test_conn_properties, basicMapping, onConnect);
  promise.then(checkResult, failTest);
};

/** Test that when connecting with basicMapping, find returns an instance with id but no name
 * because basicMapping is set as default for the table name and basicMapping has no name.
 */
t4.run = function() {
  var testCase = this;
  function onConnect(factory) {
    return factory.openSession();
  }
  function onSession(session) {
    return session.find('test.mappings_basic', 0);
  }
  function checkResult(instance) {
    testCase.errorIfNotEqual('t4 result mismatch id', 0, instance.id);
    testCase.errorIfNotEqual('t4 result mismatch name', undefined, instance.name);
    testCase.failOnError();
  }
  function failTest(err) {
    testCase.fail('t4 error reported by promise.then: ' + err.message);
  }
  jones.connect(global.test_conn_properties, basicMapping)
    .then(onConnect)
    .then(onSession)
    .then(checkResult, failTest);
};

/** Test that when connecting with basicMapping, find with override returns an instance with id and name
 * because nameMapping overrides the default for the table name and nameMapping has id and name.
 */
t5.run = function() {
  var testCase = this;
  function onConnect(factory) {
    return factory.openSession(nameMapping);
  }
  function onSession(session) {
    verifyTableHandlerCachedInSession(testCase, session, 'test.mappings_basic');
    return session.find('test.mappings_basic', 1);
  }
  function checkResult(instance) {
    testCase.errorIfNotEqual('t5 result mismatch id', 1, instance.id);
    testCase.errorIfNotEqual('t5 result mismatch name', 'Employee 1', instance.name);
    testCase.failOnError();
  }
  function failTest(err) {
    testCase.fail('t5 error reported by promise.then: ' + err.message);
  }
  jones.connect(global.test_conn_properties, basicMapping)
    .then(onConnect)
    .then(onSession)
    .then(checkResult, failTest);
};

/** Test that when connecting with basicMapping, find with override returns an instance with id and name
 * because nameMapping overrides the default for the table name and nameMapping has id and name.
 */
t6.run = function() {
  var testCase = this;
  function onConnect(factory) {
    return factory.openSession(basicMapping);
  }
  function onSession(session) {
    verifyTableHandlerCachedInSession(testCase, session, 'test.mappings_basic');
    return session.find(nameMapping, 1);
  }
  function checkResult(instance) {
    testCase.errorIfNotEqual('t6 result mismatch id', 1, instance.id);
    testCase.errorIfNotEqual('t6 result mismatch name', 'Employee 1', instance.name);
    testCase.failOnError();
  }
  function failTest(err) {
    testCase.fail('t6 error reported by promise.then: ' + err.message);
  }
  jones.connect(global.test_conn_properties)
    .then(onConnect)
    .then(onSession)
    .then(checkResult, failTest);
};


/*************** EXPORT THE TOP-LEVEL GROUP ********/
module.exports.tests = [t1, t2, t3, t4, t5, t6];
