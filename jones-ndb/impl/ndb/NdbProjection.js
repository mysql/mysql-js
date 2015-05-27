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

  this.next         = null;
  this.tableHandler = sector.tableHandler;
  if(parentProjection) {
    parentProjection.next = this;
    this.parent       = parentProjection;
    this.keyFields    = sector.thisJoinColumns;
    this.joinTo       = sector.otherJoinColumns;
    this.depth        = parentProjection.depth - 1;
    this.keyFields.forEach(function(field) {
      mock_keys[field] = "_";
    });
    this.indexHandler = this.tableHandler.getIndexHandler(mock_keys, false);
    if(! this.indexHandler) blah(this.tableHandler.dbTable.indexes);
  } else {
    this.parent       = null;
    this.keyFields    = sector.keyFieldNames;
    this.joinTo       = null;
    this.depth        = 0;
    this.indexHandler = indexHandler;
   }
  this.opNumber       = null;
  this.ndbQueryDef    = null;
  this.rowRecord      = this.tableHandler.dbTable.record;
  this.rowBuffer      = new Buffer(this.rowRecord.getBufferSize());
  this.keyRecord      = this.indexHandler.dbIndex.record;
  this.isPrimaryKey   = this.indexHandler.dbIndex.isPrimaryKey || false;

  console.log("Got NdbProjection for ", this.tableHandler.dbTable.name);
}


function initializeProjection(sectors, indexHandler) {
  var top, projection, i;
  projection = top = new NdbProjection(sectors[0], indexHandler);
  top.depth = sectors.length;
  for (i = 1 ; i < sectors.length ; i++) {
    projection = new NdbProjection(sectors[i], null, projection);
  }
  return top;
}

exports.initialize = initializeProjection;

