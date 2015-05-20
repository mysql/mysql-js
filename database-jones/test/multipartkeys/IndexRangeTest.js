/*
 Copyright (c) 2013, Oracle and/or its affiliates. All rights
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

/* Test getIndexBounds(queryHandler, dbIndex, params).
   In this test we create queries, but don't actually execute them.
   Rather, we calculate the index bounds from the query and compare 
   those to expected values
*/


var util           = require("util"),
    jones          = require("database-jones"),
    getIndexBounds = require(jones.common.IndexBounds).getIndexBounds,
    udebug         = unified_debug.getLogger("IndexRangeTest.js"),
    testNumber     = 1,
    allParams      =  { "p1" : 1,
                        "p2" : 2,
                        "p3" : 3,
                        "p4" : 4,
                        "p5" : 5 };

exports.tests = [];

function runTest(name, buildPredicate, expectedBounds) {
  var test;
  name = "t" + testNumber++ + ": " + name;
  expectedBounds = "[ " + expectedBounds + " ]";  // it's an array

  test = new harness.ConcurrentTest(name);
  test.run = function() {
    var t = this;
    fail_openSession(t, function(session) {
      session.createQuery("mpk1", function(err, query) {
        var bounds, handler;
        query.where(buildPredicate(query));
        handler = query.jones_query_domain_type.queryHandler;
        udebug.log(t.name);
        bounds = getIndexBounds(handler, handler.dbIndexHandler.dbIndex, allParams);
        t.errorIfNotEqual("Bounds", expectedBounds, util.inspect(bounds));
        session.close( function() {
          t.failOnError();
        });
      });
    });
  };
  exports.tests.push(test);
}

// FAILURES: 12, 17

/* t1 to t9: one column tests with a single condition */

runTest("k1 isNull",
  function(q) { return q.k1.isNull(); },
  "[null -- null]");

runTest("k1 isNotNull",
  function(q) { return q.k1.isNotNull(); },
  "(null -- Infinity]");

runTest("k1=1",
  function(q) { return q.k1.eq(q.param("p1")); },
  "[1 -- 1]");

runTest("k1>1",
  function(q) { return q.k1.gt(q.param("p1")); },
  "(1 -- Infinity]");

runTest("k1>=1",
  function(q) { return q.k1.ge(q.param("p1")); },
  "[1 -- Infinity]");

runTest("k1<1",
  function(q) { return q.k1.lt(q.param("p1")); },
  "(null -- 1)");

runTest("k1<=1",
  function(q) { return q.k1.le(q.param("p1")); },
  "(null -- 1]");

runTest("k1!=1",   // also implies NOT NULL
  function(q) { return q.k1.ne(q.param("p1")); },
  "(null -- 1), (1 -- Infinity]");

runTest("k1 between 2 and 3",
   function(q) { return q.k1.between(q.param("p2"), q.param("p3")); },
   "[2 -- 3]");


/* t10: one column tests with multiple conditions */

runTest("k1>2 and k2<5",
  function(q) { return q.k1.gt(q.param("p1")).and(q.k1.lt(q.param("p5"))); },
  "(1 -- 5)");

runTest("k1=1 or k1 isNull",
  function(q) { return q.k1.eq(q.param("p1")).or(q.k1.isNull()); },
  "[null -- null], [1 -- 1]");

runTest("k1=1 and k1 isNotNull",
  function(q) { return q.k1.eq(q.param("p1")).and(q.k1.isNotNull()); },
  "[1 -- 1]");

runTest("k1<2 or k1>3",
  function(q) { return q.k1.lt(q.param("p2")).or(q.k1.gt(q.param("p3"))); },
  "(null -- 2), (3 -- Infinity]");


/* t14: two column tests */

runTest("k1=1 and k2>1",
  function(q) { return q.k1.eq(q.param("p1")).and(q.k2.gt(q.param("p1"))); },
  "(1,1 -- 1,Infinity]");

runTest("k1=1 and k2 isNull",
  function(q) { return q.k1.eq(q.param("p1")).and(q.k2.isNull()); },
  "[1,null -- 1,null]");

runTest("k1=1 and k2 isNotNull",
  function(q) { return q.k1.eq(q.param("p1")).and(q.k2.isNotNull()); },
  "(1,null -- 1,Infinity]");

runTest("k2>2 AND (k1=2 OR K1=4)",
  function(q) { return q.k2.gt(q.param("p2")).and(q.k1.eq(q.param("p2")).or(q.k1.eq(q.param("p4")))); },
  "(2,2 -- 2,Infinity], (4,2 -- 4,Infinity]");

runTest("k1=1 OR (k1=2 and K2=3)",
  function(q) { return q.k1.eq(q.param("p1")).or(q.k1.eq(q.param("p2")).and(q.k2.eq(q.param("p3")))); },
  "[1 -- 1], [2,3 -- 2,3]");

/* t19 several BETWEEN conditions; returns a single range. */
runTest("k1 between 1 and 2 AND k2 between 2 and 3",
  function(q) { return q.k1.between(q.param("p1"), q.param("p2")).and(
    q.k2.between(q.param("p2"), q.param("p3"))); },
  "[1,2 -- 2,3]");

