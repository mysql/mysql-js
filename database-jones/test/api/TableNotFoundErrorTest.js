/*
 Copyright (c) 2015, Oracle and/or its affiliates. All rights
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

'use strict';

var util = require('util');

/** Error conditions tested:
 * t1 table not found on persist domainObject
 * t2 table not found on remove domainObject
 * t3 table not found on save domainObject
 * t4 table not found on query domainObject
 * t5 table not found on find domainObject
 * t6 table not found on update domainObject
 * t7 table not found on getMmapping domainObject
 * t8 table not found on load domainObject
 * t9 table not found on getTableMetadata
 * t10 table not found on persist table
 * t11 table not found on remove table
 * t12 table not found on save table
 * t13 table not found on query table
 * t14 table not found on find table
 * t15 table not found on update table
 */

function checkErrorMessage(tc, err) {
  if (!err) {
    tc.error('No error was reported for ' + tc.name);
  } else {
    tc.errorIfNotEqual('sqlState mismatch', '42S02', err.sqlState);
  }
  tc.failOnError();
}

var domainClass = function(id, name) {
  this.id = id;
  this.name = name;
};

var tableMapping = new mynode.TableMapping('test.DoesNotExist');
tableMapping.applyToClass(domainClass);

var t1 = new harness.ConcurrentTest('t1 table not found on persist domainObject');
t1.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.persist(domainClass, {'id': 1, name: 'Employee 1'}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};


var t2 = new harness.ConcurrentTest('t2 table not found on remove domainObject');
t2.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.remove(domainClass, {'id': 1}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t3 = new harness.ConcurrentTest('t3 table not found on save domainObject');
t3.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.save(domainClass, {'id': 1, name: 'Employee 1'}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t4 = new harness.ConcurrentTest('t4 table not found on createQuery domainObject');
t4.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.createQuery(domainClass, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t5 = new harness.ConcurrentTest('t5 table not found on find domainObject');
t5.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.find(domainClass, {'id': 1}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t6 = new harness.ConcurrentTest('t6 table not found on update domainObject');
t6.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.update(domainClass, {'id': 1}, {'name': 'Woger Wabbit'}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t7 = new harness.ConcurrentTest('t7 table not found on getMapping domainObject');
t7.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.getMapping(domainClass, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t8 = new harness.ConcurrentTest('t8 table not found on load domainObject');
t8.run = function() {
  var testCase = this;
  var instance = new domainClass(1, 'Tham Thnead');
  fail_openSession(testCase, function(session) {
    session.load(instance, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t9 = new harness.ConcurrentTest('t9 table not found on getTableMetadata');
t9.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.getTableMetadata('test', 'DoesNotExist', function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t10 = new harness.ConcurrentTest('t10 table not found on persist table');
t10.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.persist('test.DoesNotExist', {'id': 1, name: 'Employee 1'}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};


var t11 = new harness.ConcurrentTest('t11 table not found on remove table');
t11.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.remove('test.DoesNotExist', {'id': 1}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t12 = new harness.ConcurrentTest('t12 table not found on save table');
t12.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.save('test.DoesNotExist', {'id': 1, name: 'Employee 1'}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t13 = new harness.ConcurrentTest('t13 table not found on createQuery table');
t13.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.createQuery('test.DoesNotExist', function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t14 = new harness.ConcurrentTest('t14 table not found on find table');
t14.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.find('test.DoesNotExist', {'id': 1}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};

var t15 = new harness.ConcurrentTest('t15 table not found on update table');
t15.run = function() {
  var testCase = this;
  fail_openSession(testCase, function(session) {
    session.update('test.DoesNotExist', {'id': 1}, {'name': 'Woger Wabbit'}, function(err) {
      checkErrorMessage(testCase, err);
    });
  });
};


module.exports.tests = [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15];
