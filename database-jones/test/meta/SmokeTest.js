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

var jones = require('database-jones'),
    meta  = require(jones.api.Meta),
    test  = new harness.SmokeTest('SmokeTest');

function mapCharacterTypes() {
  var t = new jones.TableMapping('test.chartypes',
      meta.index(['char30both'], 'idx_both_char30').unique(),
      meta.index(['char30btree'], 'idx_btree_char30'),
      meta.hashKey(['char30hash'], 'idx_hash_char30'));
  t.mapField('id', meta.int().notNull().primaryKey());
  t.mapField('char30none', meta.char(30).charset('utf8'));
  t.mapField('char30hash', meta.char(30).charset('', 'utf8_swedish_ci'));
  t.mapField('char30btree', meta.char(30).charset('utf8', 'utf8_swedish_ci'));
  t.mapField('char30both', meta.char(30).charset('utf8', 'utf8_swedish_ci'));
  t.mapField('varchar130none', meta.char(130).charset('utf8'));
  t.mapField('varchar130hash', meta.char(130).charset('', 'utf8_swedish_ci'));
  t.mapField('varchar130both', meta.char(130).charset('utf8', 'utf8_swedish_ci'));
  t.mapField('text10none', meta.varchar(10).charset('utf8').lob());
  t.mapField('text1000none', meta.varchar(1000).charset('utf8').lob());
  t.mapField('text1000000none', meta.varchar(1000000).charset('utf8').lob());
  t.mapField('text100000000none', meta.varchar(100000000).charset('utf8').lob());
  return t;
}

function mapDecimalTypes() {
  var t = new jones.TableMapping('test.decimaltypes');
  t.mapField('id', meta.int().primaryKey());
  t.mapField('decimal_1_1', meta.decimal(1, 1));
  t.mapField('decimal_65_30', meta.decimal(65, 30));
  return t;
}

test.run = function() {
  var session, chartypesMapping, decimaltypesMapping;
  chartypesMapping = mapCharacterTypes();
  decimaltypesMapping = mapDecimalTypes();

  jones.openSession(global.test_conn_properties).
    then(function(s) {
      session = s;
      return session.sessionFactory.dropAndCreateTable(chartypesMapping);
    }).
    then(function() {
      return session.sessionFactory.dropAndCreateTable(decimaltypesMapping);
    }).
    then(function()    { return session.close(); }).
    then(function()    { test.pass();    },
         function(err) { test.fail(err); });
};

module.exports.tests = [test];
