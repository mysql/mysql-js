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

require("./lib.js");

var jones = require("database-jones"),
    meta  = require(jones.api.Meta),
    test  = new harness.SmokeTest("SmokeTest");


function TBasic(number) {
  if(number !== undefined) {
    this.id = number;
    this.name = "Employee " + number;
    this.age = number;
    this.magic = number;
  }
}

function mapTBasic() {
  var t = new jones.TableMapping("test.t_basic",
                                 meta.index(["age"], "idx_btree_age"));
  t.mapField("id", meta.int().notNull().primaryKey());
  t.mapField("name", meta.varchar(32).defaultValue("Employee 666"));
  t.mapField("age", meta.int());
  t.mapField("magic", meta.int().notNull().uniqueKey());
  t.applyToClass(TBasic);
  return t;
}

test.run = function() {
  var session, tableMapping;
  tableMapping = mapTBasic();

  jones.openSession(global.test_conn_properties).
    then(function(s) {
      session = s;
      session.sessionFactory.dropTable(tableMapping);
    }).
    then(function() {
      return session.sessionFactory.createTable(tableMapping);
    }).
    then(function() {
      var batch = session.createBatch();
      batch.persist(new TBasic(0));
      batch.persist(new TBasic(1));
      batch.persist(new TBasic(2));
      batch.persist(new TBasic(3));
      batch.persist(new TBasic(4));
      batch.persist(new TBasic(5));
      batch.persist(new TBasic(6));
      batch.persist(new TBasic(7));
      batch.persist(new TBasic(8));
      batch.persist(new TBasic(9));
      return batch.execute();
  }).
    then(function()    { return session.close(); }).
    then(function()    { test.pass();    },
         function(err) { test.fail(err); });
};

module.exports.tests = [test];
