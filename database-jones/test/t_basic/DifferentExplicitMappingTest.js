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
"use strict";

var unified_debug = require("unified_debug"),
    harness = require("jones-test"),
    jones = require("database-jones"),
    udebug = unified_debug.getLogger("t_basic/DifferentExplicitMappingTest.js"),
    util = require('util');

// Map a domain class with field names different from column names
var Different = function(id, name, age, magic) {
  this.getId = function() { return this.fid; };
  if (id !== undefined)    { this.fid = id;       }
  if (name !== undefined)  { this.fname = name;   }
  if (age !== undefined)   { this.fage = age;     }
  if (magic !== undefined) { this.fmagic = magic; }
};

var differentMapping = new jones.TableMapping('t_basic').
  mapField('fid', 'id').
  mapField('fname', 'name').
  mapField('fage', 'age').
  mapField('fmagic', 'magic');

differentMapping.applyToClass(Different);

/** Verify the instance or fail the test case */
var fail_verify_Different = function(err, instance, id, testCase, domainObject) {
  if (err) {
    testCase.fail(util.inspect(err));
    return;
  }
  if (typeof instance !== 'object') {
    testCase.fail(new Error('Result for id ' + id + ' is not an object: ' + typeof instance));
  }
  if (instance === null) {
    testCase.fail(new Error('Result for id ' + id + ' is null.'));
    return;
  }
  if (domainObject) {
    if (typeof(instance.getId) !== 'function') {
      testCase.fail(new Error('Result for id ' + id + ' is not a Different domain object'));
      return;
    }
  }
  udebug.log_detail('instance:', instance);
  var message = '';
  if (instance.fid != id) {
    message += 'fail to verify id: expected: ' + id + ', actual: ' + instance.fid + '\n';
  }
  if (instance.fage != id) {
    message += 'fail to verify age: expected: ' + id + ', actual: ' + instance.fage + '\n';
  }
  if (instance.fmagic != id) {
    message += 'fail to verify magic: expected: ' + id + ', actual: ' + instance.fmagic + '\n';
  }
  if (instance.fname !== "Employee " + id) {
    message += 'fail to verify name: expected: ' + "Employee " + id + ', actual: ' + instance.fname + '\n';
  }
  if (message == '') {
    testCase.pass();
  } else {
    testCase.fail(message);
  }
};

/***** Persist Different Find by number ***/
var t1 = new harness.ConcurrentTest("persistFindNumberDifferent");
t1.run = function() {
  var testCase = this;
  // create the domain object 6101
  var different = new Different(6101, 'Employee 6101', 6101, 6101);
  fail_openSession(testCase, function(session) {
    // key and testCase are passed to fail_verify_Different as extra parameters
    session.persist(differentMapping, different, function(err, session2) {
      if (err) {
        testCase.fail(util.inspect(err));
        return;
      }
      session2.find(differentMapping, 6101, fail_verify_Different, 6101, testCase, false);
    }, session);
  });
};

/***** Save Different Find by literal ***/
var t2 = new harness.ConcurrentTest("saveFindLiteralDifferent");
t2.run = function() {
  var testCase = this;
  // create the domain object 6102
  var different = new Different(6102, 'Employee 6102', 6102, 6102);
  fail_openSession(testCase, function(session) {
    // key and testCase are passed to fail_verify_Different as extra parameters
    session.save(differentMapping, different, function(err, session2) {
      if (err) {
        testCase.fail(util.inspect(err));
        return;
      }
      session2.find(differentMapping, {fid: 6102}, fail_verify_Different, 6102, testCase, false);
    }, session);
  });
};

/***** Save Different Find by object ***/
var t3 = new harness.ConcurrentTest("saveFindObjectDifferent");
t3.run = function() {
  var testCase = this;
  // create the domain object 6103
  var different = new Different(6103, 'Employee 6103', 6103, 6103);
  fail_openSession(testCase, function(session) {
    // key and testCase are passed to fail_verify_Different as extra parameters
    session.save(differentMapping, different, function(err, session2) {
      if (err) {
        testCase.fail(util.inspect(err));
        return;
      }
      var different2 = new Different(6103);
      session2.find(differentMapping, different2, fail_verify_Different, 6103, testCase, false);
    }, session);
  });
};

/***** Persist Save (Update) Load ***/
var t4 = new harness.ConcurrentTest("testPersistSaveLoadNumber");
t4.run = function() {
  var testCase = this;
  // save the domain object 6104
  var object = new Different(6104, 'Employee 6104', 6104, 6104);
  var object2;
  fail_openSession(testCase, function(session) {
    // save object 6104
    session.persist(differentMapping, object, function(err, session2) {
      if (err) {
        testCase.fail(util.inspect(err));
        return;
      }
      // now save an object with the same primary key but different magic
      object2 = new Different(6104, 'Employee 6104', 6104, 6109);
      session2.save(differentMapping, object2, function(err, session3) {
        if (err) {
          testCase.fail(util.inspect(err));
          return;
        }
        var object3 = new Different(6104);
        session3.load(object3, function(err, object4) {
          // verify that object3 has updated magic field from object2
          testCase.errorIfNotEqual('testSaveLoad mismatch on magic', 6109, object4.fmagic);
          testCase.failOnError();
        }, object3);
      }, session2);
    }, session);
  });
};

/***** Persist Update Find by literal ***/
var t5 = new harness.ConcurrentTest("testPersistUpdateFindLiteral");
t5.run = function() {
  var testCase = this;
  var object = new Different(6105, 'Employee 6105', 6105, 6105);
  var object2;
  fail_openSession(testCase, function(session) {
    session.persist(differentMapping, object, function(err, session2) {
      if (err) {
        testCase.fail(util.inspect(err));
        return;
      }
      // now update the object with the same primary key but different name
      object2 = new Different(6105, 'Employee 6109', 6105, 6105);
      session2.update(differentMapping, object2, object2, function(err, session3) {
        if (err) {
          testCase.fail(util.inspect(err));
          return;
        }
        session3.find(differentMapping, {fid: 6105}, function(err, object3) {
          // verify that object3 has updated name field from object2
          testCase.errorIfNotEqual('testSaveUpdate mismatch on fname', 'Employee 6109', object3.fname);
          testCase.failOnError();
        });
      }, session2);
    }, session);
  });
};


/***** Persist Remove Find by literal ***/
var t6 = new harness.ConcurrentTest("testPersistRemoveFindLiteral");
t6.run = function() {
  var testCase = this;
  var object = new Different(6106, 'Employee 6106', 6106, 6106);
  var object2;
  fail_openSession(testCase, function(session) {
    session.persist(differentMapping, object, function(err, session2) {
      if (err) {
        testCase.fail(err);
        return;
      }
      // now remove the object
      object2 = new Different(6106);
      session2.remove(differentMapping, object2, function(err, session3) {
        if (err) {
          testCase.fail(util.inspect(err));
          return;
        }
        session3.find(differentMapping, {fid: 6106}, function(err, object3) {
          if (err) {
            testCase.fail(util.inspect(err));
          } else {
            if (object3) {
              testCase.fail(new Error('Find after remove should return null.'));
            } else {
              testCase.pass();
            }
          }
        });
      }, session2);
    }, session);
  });
};


module.exports.tests = [t1, t2, t3, t4, t5, t6];
