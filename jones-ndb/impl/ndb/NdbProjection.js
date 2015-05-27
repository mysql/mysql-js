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

function NdbProjection(sector, parentProjection) {
  this.next         = null;
  if(parentProjection) {
    parentProjection.next = this;
    this.parent     = parentProjection;
    this.keyFields  = sector.thisJoinColumns;
    this.joinTo     = sector.otherJoinColumns;
    this.depth      = parentProjection.depth - 1;
  } else {
    this.parent     = null;
    this.keyFields  = sector.keyFieldNames;
    this.joinTo     = null;
    this.depth      = 0;
  }
  this.opNumber     = null;
  this.ndbQueryDef  = null;
  this.tableHandler = sector.tableHandler;
  this.rowRecord    = this.tableHandler.dbTable.record;
  this.rowBuffer    = new Buffer(this.rowRecord.getBufferSize());
  this.indexHandler = this.tableHandler.getIndexHandler(this.keys, false);
  this.keyRecord    = this.indexHandler.record;
  this.isPrimaryKey = this.indexHandler.dbIndex.isPrimaryKey || false;
};


function initializeProjection(projection) {
  var top, projection, i;
  projection = top = new NdbProjection(sectors[0]);
  top.depth = sectors.length;
  for (i = 1 ; i < sectors.length ; i++) {
    projection = new NdbProjection(sectors[i], projection);
  }
  return top;
}

exports.initialize = initializeProjection;

