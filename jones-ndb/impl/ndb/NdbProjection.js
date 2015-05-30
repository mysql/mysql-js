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
    assert = require("assert");

function blah() {
  console.log("BLAH");
  console.log.apply(null, arguments);
  console.trace();
  process.exit();
}

function NdbProjection(sector, indexHandler, parentProjection) {
  var mock_keys = {};
  console.log("New NdbProjection from:", sector);

  if(parentProjection) {
    sector.thisJoinColumns.forEach(function(field) {
      mock_keys[field] = "_";
    });
  }

  this.next           = null;
  this.tableHandler   = sector.tableHandler;
  this.error          = null;
  if(parentProjection) {
    parentProjection.next = this;
    this.root         = parentProjection.root;
    this.keyFields    = sector.thisJoinColumns;
    this.joinTo       = sector.otherJoinColumns;
    this.depth        = parentProjection.depth + 1;
    this.indexHandler = this.tableHandler.getIndexHandler(mock_keys);
    this.hasScan      = null;   // unused except in root
  } else {
    this.root         = this;
    this.keyFields    = sector.keyFieldNames;
    this.joinTo       = null;
    this.depth        = 0;
    this.indexHandler = indexHandler;
    this.hasScan      = false;
  }
  this.ndbQueryDef    = null;
  this.rowRecord      = this.tableHandler.resultRecord;
  this.keyRecord      = this.indexHandler.dbIndex.record;
  this.isPrimaryKey   = this.indexHandler.dbIndex.isPrimaryKey || false;
  this.isUniqueKey    = this.indexHandler.dbIndex.isUnique;

  if(! (this.isPrimaryKey || this.isUniqueKey)) {
    this.root.hasScan = true;
  }
}


/* If the root operation is a find, but some child operation is a scan,
   NdbQueryBuilder.cpp says "Scan with root lookup operation has not been
   implemented" and returns QRY_WRONG_OPERATION_TYPE error 4820. 
   We have to work around this now by rewriting the root to use a scan.
*/
NdbProjection.prototype.rewriteAsScan = function(sector) {
  var new_index, mock_keys;

  mock_keys = {};
  sector.keyFieldNames.forEach(function(field) {
    mock_keys[field] = "_";
  });

  this.indexHandler = this.tableHandler.getOrderedIndexHandler(mock_keys);
  if(this.indexHandler) {
    this.isPrimaryKey = false;
    this.isUniqueKey = false;
  } else {
    this.error = new Error("Could not rewrite NdbProjection to use scan");
  }
};


function initializeProjection(sectors, indexHandler) {
  var projection, i;
  projection = new NdbProjection(sectors[0], indexHandler);
  for (i = 1 ; i < sectors.length ; i++) {
    projection = new NdbProjection(sectors[i], null, projection);
  }

  if(projection.root.hasScan &&
     (projection.root.isPrimaryKey || projection.root.isUniqueKey))
  {
    console.log("Rewriting to scan");
    projection.root.rewriteAsScan(sectors[0]);
  }

  return projection.root;
}

exports.initialize = initializeProjection;

