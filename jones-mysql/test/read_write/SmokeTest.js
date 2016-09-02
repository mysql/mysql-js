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

var jones = require("database-jones"),
    meta  = require(jones.api.Meta),
    t_read_write = require("./lib_read_write").t_read_write,
    test  = new harness.SmokeTest("SmokeTest");


function mapTReadWrite() {
  var t = new jones.TableMapping("t_read_write",
                                 meta.index(["age"], "idx_btree_age"));
  t.mapField("id", meta.int().notNull().primaryKey());
  t.mapField("name", meta.varchar(32).defaultValue("Employee 666"));
  t.mapField("age", meta.int());
  t.mapField("magic", meta.int().notNull().uniqueKey());
  t.applyToClass(t_read_write);
  return t;
}

test.run = function() {
  var session, tableMapping;
  tableMapping = mapTReadWrite();

  jones.openSession(global.test_conn_properties).
    then(function(s) {
      session = s;
      return session.sessionFactory.dropAndCreateTable(tableMapping);
    }).
    then(function()    { return session.close(); }).
    then(function()    { test.pass();    },
         function(err) { test.fail(err); });
};

module.exports.tests = [test];
