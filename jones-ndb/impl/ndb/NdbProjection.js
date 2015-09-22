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

var util = require("util"),
    assert = require("assert"),
    conf = require("./path_config"),
    adapter = require(conf.binary).ndb,
    udebug = unified_debug.getLogger("NdbProjection.js"),
    stats = { "rootProjectionsCreated" : 0, "rewrittenToScan" : 0 };

require(jones.api.stats).register(stats, "spi","ndb","NdbProjection");

function blah() {
  console.log("BLAH");
  console.log.apply(null, arguments);
  console.trace();
  process.exit();
}

function mockKeys(columnNames) {
  var mock_keys = {};
  columnNames.forEach(function(field) {
    mock_keys[field] = "_";
  });
  return mock_keys;
}

function buildJoinTableResultRecord(dbTableHandler) {
  if(! dbTableHandler.resultRecord) {
    dbTableHandler.resultRecord = adapter.impl.DBDictionary.getRecordForMapping(
        dbTableHandler.dbTable,
        dbTableHandler.dbTable.per_table_ndb,
        dbTableHandler.getNumberOfColumns(),
        dbTableHandler.getAllColumns()
    );
  }
}

function NdbProjection(tableHandler, indexHandler, parent) {
  this.root           = parent ? parent.root : this;    // root of chain
  this.depth          = parent ? parent.depth + 1 : 0;
  this.next           = null;                           // next in chain
  this.error          = null;
  this.hasScan        = null;
  this.tableHandler   = tableHandler;
  this.rowRecord      = tableHandler.resultRecord;
  this.indexHandler   = indexHandler;
  this.keyRecord      = indexHandler.dbIndex.record;
  this.isPrimaryKey   = indexHandler.dbIndex.isPrimaryKey || false;
  this.isUniqueKey    = indexHandler.dbIndex.isUnique;

  if(parent) { parent.next = this; } 
}


// parentSectorIndex : index into sectors array of parent sector
// childSectorIndexes:  array of ...
// recommended: change relatedField to parentField
function ndbRootProjection(sector, indexHandler) {
  var p;

  udebug.log("Root", sector);
  stats.rootProjectionsCreated++;

  p = new NdbProjection(sector.tableHandler, indexHandler);
  p.keyFields    = sector.keyFieldNames;
  p.joinTo       = null;
  p.relatedField = sector.parentFieldMapping;  // should be unused!
  p.hasScan      = ! (p.isPrimaryKey || p.isUniqueKey);
  return p;
}

function ndbProjectionToJoinTable(sector, parentProjection) {
  var mock_keys, indexHandler, p;
  udebug.log("ToJoinTable:", sector);

  mock_keys = mockKeys(sector.parentFieldMapping.thisForeignKey.columnNames);
  indexHandler = sector.joinTableHandler.getOrderedIndexHandler(mock_keys);

  buildJoinTableResultRecord(sector.joinTableHandler);

  p = new NdbProjection(sector.joinTableHandler, indexHandler, parentProjection);
  p.keyFields    = sector.parentFieldMapping.thisForeignKey.columnNames;
  p.joinTo       = sector.parentFieldMapping.thisForeignKey.targetColumnNames;
  p.relatedField = null;   // No result fields come from the join table
  p.root.hasScan = true;
  return p;
}

function ndbProjectionFromJoinTable(sector, parentProjection) {
  var mock_keys, indexHandler, p;
  udebug.log("FromJoinTable:", sector);

  mock_keys = mockKeys(sector.parentFieldMapping.otherForeignKey.targetColumnNames);
  indexHandler = sector.tableHandler.getIndexHandler(mock_keys);

  p = new NdbProjection(sector.tableHandler, indexHandler, parentProjection);
  p.keyFields    = sector.parentFieldMapping.otherForeignKey.targetColumnNames;
  p.joinTo       = sector.parentFieldMapping.otherForeignKey.columnNames;
  p.relatedField = sector.parentFieldMapping;
  return p;
}

function createNdbProjection(sector, parentProjection) {
  var indexHandler, p;

  if(sector.joinTableHandler) {
    p = ndbProjectionToJoinTable(sector, parentProjection);
    return ndbProjectionFromJoinTable(sector, p);
  }

  udebug.log(sector);
  indexHandler = sector.tableHandler.getIndexHandler(mockKeys(sector.thisJoinColumns));

  p = new NdbProjection(sector.tableHandler, indexHandler, parentProjection);
  p.keyFields    = sector.thisJoinColumns;
  p.joinTo       = sector.otherJoinColumns;
  p.relatedField = sector.parentFieldMapping;

  if(! (p.isPrimaryKey || p.isUniqueKey)) {
    p.root.hasScan = true;
  }
  return p;
}

/* If the root operation is a find, but some child operation is a scan,
   NdbQueryBuilder.cpp says "Scan with root lookup operation has not been
   implemented" and returns QRY_WRONG_OPERATION_TYPE error 4820. 
   We have to work around this now by rewriting the root to use a scan.

   NOTE: The server uses a different strategy here.  Divides the tree after
   the last consecutive lookup then runs all lookups.
*/
NdbProjection.prototype.rewriteAsScan = function(sector) {
  var mock_keys = mockKeys(sector.keyFieldNames);
  this.indexHandler = this.tableHandler.getOrderedIndexHandler(mock_keys);
  if(this.indexHandler) {
    this.isPrimaryKey = false;
    this.isUniqueKey = false;
    stats.rewrittenToScan++;
  } else {
    this.error = new Error("Could not rewrite NdbProjection to use scan");
  }
};


function initializeProjection(sectors, indexHandler) {
  var projection, i;
  projection = ndbRootProjection(sectors[0], indexHandler);
  for (i = 1 ; i < sectors.length ; i++) {
    projection = createNdbProjection(sectors[i], projection);
  }

  if(projection.root.hasScan &&
     (projection.root.isPrimaryKey || projection.root.isUniqueKey))
  {
    udebug.log("Rewriting to scan");
    projection.root.rewriteAsScan(sectors[0]);
  }

  return projection;
}

exports.initialize = initializeProjection;

