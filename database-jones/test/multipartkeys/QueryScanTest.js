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

var QueryTest = require("../lib/QueryTestLib.js");

var q1 = {
  name: 'q1',
  queryType: 2,  /* index scan */
  expected: [4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
  predicate: function(q) {
    return q.k1.isNotNull();
  }
};

var q2 = {
  name: 'q2',
  queryType: 2,  /* index scan */
  expected: [16, 17, 18, 19, 20, 21],
  predicate: function(q) {
    return q.k3.isNull();
  }
};

var q3 = { 
  name: 'q3',
  queryType: 2, 
  expected: [8,9,10,11,12,13,14,15,16,17,18,19,20],
  p1: 1,
  predicate: function(q) {
    return q.k1.gt(q.param("p1"));
  }
};

var q4 = { 
  name: 'q4',
  queryType: 2,
  expected: [11,12,13,14,15],
  p1: 1010,
  predicate: function(q) {
    return q.k3.gt(q.param("p1"));
  }
};

var q5 = {
  name: 'q5',
  queryType: 2,
  expected: [6,7,10,11,14,15,18,19],
  p1: 1,
  predicate: function(q) {
    return q.k1.ge(q.param("p1")).and(q.k2.gt(q.param("p1")));
  }
};

var q6 = {
  // (k1 = 1 and k2 = 1) OR (k1 >= 2 and k2 >= 2)
  // We can do this as a multi-range index scan
  name: 'q6',
  queryType: 2,
  expected: [5,10,11,14,15,18,19],
  p1: 1, p2: 2,
  predicate: function(q) {
    return (q.k1.eq(q.param("p1")).and(q.k2.eq(q.param("p1"))))
           .or(q.k1.ge(q.param("p2")).and(q.k2.ge(q.param("p2"))));
  }
};

var q7 = {
  /* id NOT EQUAL TO X.  This should scan two ranges on PRIMARY */
  name: 'q7',
  queryType: 2,
  expected: [1,2,3,  5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21],
  p1: 4,
  predicate: function(q) {
    return q.id.ne(q.param("p1"));
  }
};

var q8 = {
  /* k1 = p1 and (k2 = p1 or k2 = p3) */
  name: 'q8',
  queryType: 2,
  expected: [5,7],
  p1: 1, p3: 3,
  predicate: function(q) {
    return q.k1.eq(q.param("p1")).and(q.k2.eq(q.param("p1")).or(q.k2.eq(q.param("p3"))));
  }
};

var q9 = {
  /* (k1 = 2 and k2 = 1) OR (k1 = 4 and k2 = 3) */
  name: 'q9',
  queryType: 2,
  expected: [ 10, 11, 17, 18 ],
  p1: 2, p2: 1, p3: 4, p4: 3,
  predicate: function(q) {
    return (q.k1.eq(q.param("p1")).and(q.k2.gt(q.param("p2")))).
         or(q.k1.eq(q.param("p3")).and(q.k2.lt(q.param("p4"))));
  }
};

var q10 = {
  /* k1 is Not Null */
  name: 'q10',
  queryType: 2,
  expected: [4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
  predicate: function(q) {
    return q.k1.isNotNull();
  }
};

var q11 = {
  /* k1 = 2 and k2 is null */
  name: 'q11',
  queryType: 2,
  expected: [ 8 ],
  p1: 2,
  predicate: function(q) {
    return q.k1.eq(q.param("p1")).and(q.k2.isNull());
  }
};

var q12 = {
  /* k1 = 2 and k2 is not null */
  name: 'q12',
  queryType: 2,
  expected: [ 9,10,11 ],
  p1: 2,
  predicate: function(q) {
    return q.k1.eq(q.param("p1")).and(q.k2.isNotNull());
  }
};


// TODO: q9 and q12 fail.
var queryTests = [ q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12 ];

/** Set up domain type */
function mpk1() {};
new mynode.TableMapping('mpk1').applyToClass(mpk1);

/** Define test */
var testQueries = new QueryTest("QueryScanTest", mpk1, queryTests);

module.exports.tests = [testQueries];

