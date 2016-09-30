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
var jones = require("database-jones");
var unified_debug = require("unified_debug");
var harness = require("jones-test");
var util    = require("util");
var udebug  = unified_debug.getLogger("json/WriteReadTest.js");

function Hybrid(id, unstruct_json, unstruct_varchar, a) {
  if (id !== undefined) {
    this.id = id;
    this.unstruct_json = unstruct_json;
    this.unstruct_varchar = unstruct_varchar;
    this.a = a;
  }
}

var hybrids = 
	[
	 new Hybrid(100), // undefined
	 new Hybrid(101, null, null), // null
	 new Hybrid(102, true, true), // boolean
	 new Hybrid(103, 103.333, 103.333), // number
	 new Hybrid(104, '104', '104'), // string
	 new Hybrid(105, ['105', 105], ['105', 105]), // array
	 new Hybrid(106, {'106': 106}, {'106': 106})  // object
  ];

/** Try to write JavaScript objects and read back using both a varchar column and a json column.
 * The JSONConverter is used for both columns.
 * More data types can be added by adding them to the hybrids array.
 * Data types: 
 *   undefined (becomes null by default in database)
 *   null
 *   boolean
 *   numeric
 *   string
 *   array object
 *   non-array object
 */
var t1 = new harness.SerialTest("WriteReadTest");
t1.run = function() {
  var testCase = this;
  var hybridMapping = new jones.TableMapping('json_hybrid');
  hybridMapping.mapField('id');
  hybridMapping.mapField('unstruct_json');
  hybridMapping.mapField('unstruct_varchar', jones.converters.JSONConverter);
  hybridMapping.mapSparseFields('SPARSE_FIELDS');
  hybridMapping.applyToClass(Hybrid);

  testCase.mappings = Hybrid;
  
  fail_openSession(testCase, function(session) {
  	udebug.log_detail('WriteReadTest.openSession');
    testCase.session = session;
  })
  .then(function() {
  	udebug.log_detail('WriteReadTest.persist');
  	var batch = testCase.session.createBatch();
    batch.persist(hybrids[0]);
    batch.persist(hybrids[1]);
    batch.persist(hybrids[2]);
    batch.persist(hybrids[3]);
    batch.persist(hybrids[4]);
    batch.persist(hybrids[5]);
    batch.persist(hybrids[6]);
    return batch.execute();
  })
  .then(function() {
  	udebug.log_detail('WriteReadTest.createQuery');
  	return testCase.session.createQuery(Hybrid);
  })
  .then(function(q) {
  	q.where(q.id.ge(100));
  	return q.execute({"order": "asc"});
  })
  .then(function(found) {
  	var i, j, prop, expected, actual;
    // verify found
    udebug.log_detail("WriteReadTest found: " + util.inspect(found));
    for (i = 0; i < hybrids.length; ++i) {
    	expected = hybrids[i];
    	actual = found[i];
      testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify id", expected.id, actual.id);
    	// most types can be compared directly via === except for array and object
      if (expected.unstruct_json === undefined || expected.unstruct_json === null) {
      	// undefined values come back as null for varchar and JSON types
        testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_json",
            null, actual.unstruct_json);
        testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_varchar",
            null, actual.unstruct_varchar);      	
      } else if (Array.isArray(expected.unstruct_json)) {
      	// compare arrays
      	for (j = 0; j < expected.unstruct_json.length; ++j) {
          testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_json",
          		expected.unstruct_json[j], actual.unstruct_json[j]);
          testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_varchar",
          		expected.unstruct_varchar[j], actual.unstruct_varchar[j]);      	
      	}
      } else if (expected.unstruct_json.constructor.name === 'Object') {
      	// compare objects
      	for (prop in expected.unstruct_json) {
      		if (expected.unstruct_json.hasOwnProperty(prop)) {
            testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_json",
            		expected.unstruct_json[prop], actual.unstruct_json[prop]);
            testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_varchar",
            		expected.unstruct_varchar[prop], actual.unstruct_varchar[prop]);      	
      		}
      	}
      } else {
      	// compare directly
        testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_json",
            expected.unstruct_json, actual.unstruct_json);
        testCase.errorIfNotEqual('\n' + testCase.name + ' index ' + i + " failed to verify unstruct_varchar",
            expected.unstruct_varchar, actual.unstruct_varchar);
      }
    }
  })
  // clean up and report errors
  .then(function() {
    return testCase.session.close();
  })
  .then(function() {testCase.failOnError();}, function(err) {testCase.fail(err.stack);}
  );
};



exports.tests = [t1];
