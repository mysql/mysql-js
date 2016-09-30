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
"use strict";

var jones = require("database-jones");

/* Mapping1:
     fields are deliberately not mapped in column order.
     "oneToTwo" is a field mapped to the two columns magic and name.
     "magic" is Not Null with no default, so persist() would fail if it was unmapped.
     "misc" is a non-persistent field.
*/
function Mapping1() {}

var mapping = new jones.TableMapping("t_basic");
mapping.mapAllColumns = false;
mapping.mapField("oneToTwo", ["magic","name"]);  // one field to many columns
mapping.mapField("misc", false);  // non-persistent
mapping.mapField("id");
mapping.applyToClass(Mapping1);

// test expected object structure
var t1 = new harness.ConcurrentTest("mapping1-find-by-pk");
t1.run = function() {
  fail_openSession(t1, function(session) {
    session.find(Mapping1, 1, function(err, value) {
      t1.errorIfError(err);
      if(t1.hasNoErrors()) {
        t1.errorIfNotEqual("Value type", 'object', typeof value);
        t1.errorIfNull("Null value", value);
      }
      if(t1.hasNoErrors()) {
        t1.errorIfNotEqual("id", 1, value.id);
        t1.errorIfNotEqual("oneToTwo type", 'object', typeof value.oneToTwo);
      }
      if(t1.hasNoErrors()) {
        t1.errorIfNotEqual("magic", 1, value.oneToTwo.magic);
        t1.errorIfNotEqual("name", 'Employee 1', value.oneToTwo.name);
      }
      t1.failOnError();
    });
  });
};

// Test load() of an object with misc set and see that misc remains set.
var t2 = new harness.ConcurrentTest("mapping1-load-by-pk");
t2.run = function() {
  fail_openSession(t2, function(session) {
    var item = new Mapping1();
    item.id = 2;
    item.misc = "mary";
    session.load(item, function(err) {
      t2.errorIfError(err);
      if(t2.hasNoErrors()) {
        t2.errorIfNotEqual("Value type", 'object', typeof item);
        t2.errorIfNull("Null value", item);
      }
      if(t2.hasNoErrors()) {
        t2.errorIfNotEqual("id", 2, item.id);
        t2.errorIfNotEqual("misc", "mary", item.misc);
        t2.errorIfNotEqual("oneToTwo type", 'object', typeof item.oneToTwo);
      }
      if(t2.hasNoErrors()) {
        t2.errorIfNotEqual("magic", 2, item.oneToTwo.magic);
      }
      t2.failOnError();
    });
  });
};

// test persist()
var t3 = new harness.ConcurrentTest("mapping1-persist-and-find");
t3.run = function() {
  fail_openSession(t3, function(session) {
    var item = new Mapping1();
    item.id = 5903;
    item.misc = 5903;  // not persistent
    item.oneToTwo = { "magic" : 19, "name" : "Sue" };
    session.persist(item, function(err) {
      t3.errorIfError(err);
      session.find(Mapping1, {"id":5903}, function(err, value) {
        t3.errorIfError(err);
        if(t3.hasNoErrors()) {
          t3.errorIfNotEqual("Value type", 'object', typeof value);
          t3.errorIfNull("Null value", value);
        }
        if(t3.hasNoErrors()) {
          t3.errorIfNotEqual("id", 5903, value.id);
          t3.errorIfNotEqual("oneToTwo type", 'object', typeof value.oneToTwo);
          t3.errorIfNotEqual("misc", undefined, value.misc);
        }
        if(t3.hasNoErrors()) {
          t3.errorIfNotEqual("magic", 19, value.oneToTwo.magic);
          t3.errorIfNotEqual("name", "Sue", value.oneToTwo.name);
        }
        t3.failOnError();
      });
    });
  });
};

// Test find() using the unique index on magic by way of the oneToTwo field
var t4 = new harness.ConcurrentTest("mapping1-find-by-magic");
t4.run = function() {
  fail_openSession(t4, function(session) {
    var keys = {};
    keys.oneToTwo = {};
    keys.oneToTwo.magic = 4;
    session.find(Mapping1, keys, function(err, value) {
      t4.errorIfError(err);
      if(t4.hasNoErrors()) {
        t4.errorIfNotEqual("Value type", 'object', typeof value);
        t4.errorIfNull("Null value", value);
      }
      if(t4.hasNoErrors()) {
        t4.errorIfNotEqual("id", 4, value.id);
        t4.errorIfNotEqual("oneToTwo type", 'object', typeof value.oneToTwo);
      }
      if(t4.hasNoErrors()) {
        t4.errorIfNotEqual("magic", 4, value.oneToTwo.magic);
        t4.errorIfNotEqual("name", 'Employee 4', value.oneToTwo.name);
      }
      t4.failOnError();
    });
  });
};


/* Mapping2 tests a case where column "magic" is mapped to a field "age".
   This prevents column age from being mapped (despite mapAllColumns)
   due to the field name conflict, resulting in a mapping with three fields:
      id  (col. id)
      age (col. magic)
      name (col. name)
*/
function Mapping2() {}
var mapping2 = new jones.TableMapping("t_basic");
mapping2.mapAllColumns = true;
mapping2.mapField("age", "magic");
mapping2.applyToClass(Mapping2);

// test expected object structure
var t5 = new harness.ConcurrentTest("mapping2-find-by-id");
t5.run = function() {
  fail_openSession(t5, function(session) {
    session.find(Mapping2, 5, function(err, value) {
      t5.errorIfError(err);
      if(t5.hasNoErrors()) {
        t5.errorIfNotEqual("Value type", 'object', typeof value);
        t5.errorIfNull("Null value", value);
      }
      if(t5.hasNoErrors()) {
        t5.errorIfNotEqual("id", 5, value.id);
        t5.errorIfNotEqual("name", 'Employee 5', value.name);
        t5.errorIfNotEqual("age", 5, value.age);
        t5.errorIfNotStrictEqual("Magic [unmapped]", undefined, value.magic);
      }
      t5.failOnError();
    });
  });
};

var t6 = new harness.ConcurrentTest("persist-mapping1-find-mapping2");
t6.run = function() {
  fail_openSession(t6, function(session) {
    var item = new Mapping1();
    item.id = 5906;
    item.oneToTwo = { "magic" : 21, "name" : "Sue" };
    session.persist(item, function(err) {
      t6.errorIfError(err);
      session.find(Mapping2, 5906, function(err, value) {
        t6.errorIfError(err);
        if(t6.hasNoErrors()) {
          t6.errorIfNotEqual("Value type", 'object', typeof value);
          t6.errorIfNull("Null value", value);
        }
        if(t6.hasNoErrors()) {
          t6.errorIfNotEqual("id",   5906, value.id);
          t6.errorIfNotEqual("age",  21,   value.age);  // column = magic
          t6.errorIfNotEqual("name", "Sue", value.name);
        }
        t6.failOnError();
      });
    });
  });
};

// test find by unique key on magic via column "age"
var t7 = new harness.ConcurrentTest("mapping2-find-by-magic");
t7.run = function() {
  fail_openSession(t7, function(session) {
    var keys = {};
    keys.age = 7;  // column = magic
    session.find(Mapping2, keys, function(err, value) {
      t7.errorIfError(err);
      if(t7.hasNoErrors()) {
        t7.errorIfNotEqual("Value type", 'object', typeof value);
        t7.errorIfNull("Null value", value);
      }
      if(t7.hasNoErrors()) {
        t7.errorIfNotEqual("id",   7, value.id);
        t7.errorIfNotEqual("name", "Employee 7", value.name);
      }
      t7.failOnError();
    });
  });
};


// In Mapping3, age and magic are swapped.
function Mapping3() {}
var mapping3 = new jones.TableMapping("t_basic");
mapping3.mapAllColumns = true;
mapping3.mapField("age", "magic");
mapping3.mapField("magic", "age");
mapping3.applyToClass(Mapping3);


// test expected object structure
var t8 = new harness.ConcurrentTest("persist-by-tablename-load-mapping3");
t8.run = function() {
  fail_openSession(t8, function(session) {
    var item = {};
    item.id = 5908;
    item.magic = 8088;
    item.age = 31;
    session.persist("t_basic", item, function(err) {
      t8.errorIfError(err);
      var loadItem = new Mapping3();
      loadItem.id = 5908;
      session.load(loadItem, function(err) {
        t8.errorIfError(err);
        if(t8.hasNoErrors()) {
          t8.errorIfNotEqual("age", 8088, loadItem.age);   // column = magic
          t8.errorIfNotEqual("magic", 31, loadItem.magic);   // column = age
        }
        t8.failOnError();
      });
    });
  });
};


exports.tests = [ t1 , t2 , t3 , t4 , t5 , t6 , t7 , t8 ];
