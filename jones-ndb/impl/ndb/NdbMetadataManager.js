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

var path         = require("path"),
    assert       = require("assert"),
    fs           = require("fs"),
    existsSync   = fs.existsSync || path.existsSync,
    jones        = require("database-jones"),
    jonesMysql   = require("jones-mysql"),
    ndb_test_dir = require("./path_config").suites_dir,
    udebug       = unified_debug.getLogger("NdbMetadataManager.js");


function findMetadataScript(suite, file) {
  var path1, path2, path3, path4;
  path1 = path.join(ndb_test_dir, suite, file);   // NDB
  path2 = path.join(jonesMysql.config.suites_dir, suite, file);  // MySQL
  path3 = path.join(jonesMysql.config.suites_dir, "standard", suite + "-" + file);

  if(existsSync(path1)) return path1;
  if(existsSync(path2)) return path2;
  if(existsSync(path3)) return path3;

  console.log("No path to:", suite, file);
}


function NdbMetadataManager() {
}


NdbMetadataManager.prototype.runSQL = function(properties, sqlPath, callback) {
  properties.implementation = "mysql";
  assert(sqlPath);
  var statement = "set storage_engine=ndbcluster;\n";
  statement += fs.readFileSync(sqlPath, "ASCII");
  jones.openSession(properties).then(function(session) {
    udebug.log("onSession");
    var driver = session.dbSession.pooledConnection;
    assert(driver);
    driver.query(statement, function(err) {
      udebug.log("onQuery");
      session.close();
      callback(err);
    })
  });
};


NdbMetadataManager.prototype.createTestTables = function(properties, suite, callback) {
  udebug.log("createTestTables", suite);
  var sqlPath = findMetadataScript(suite, "create.sql");
  this.runSQL(properties, sqlPath, callback);
};


NdbMetadataManager.prototype.dropTestTables = function(properties, suite, callback) {
  udebug.log("dropTestTables", suite);
  var sqlPath = findMetadataScript(suite,  "drop.sql");
  this.runSQL(properties, sqlPath, callback);
};


module.exports = new NdbMetadataManager();

