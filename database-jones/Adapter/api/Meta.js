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

var util = require('util');

/** Meta allow users to define the metadata of a field or table to create tables.
 *  meta is exported and functions return a new object of type Meta.
 *  DBConnection pool uses meta to map metadata to database-specific schema.
 */

function Meta() {
  this.isNullable = true;
}

Meta.prototype.isMeta = function() {
  return true;
};

Meta.prototype.sparseContainer = function() {
  this.isSparseContainer = true;
  return this;
};

Meta.prototype.generated = function() {
  this.isGenerated = true;
  return this;
};

Meta.prototype.autoincrement = function() {
  this.isAutoincrement = true;
  this.isGenerated = true;
  return this;
};

Meta.prototype.charset = function(characterset, collate) {
  if (characterset) {this.characterset = characterset;}
  if (collate) {this.collate = collate;}
  return this;
};

Meta.prototype.hash = function() {
  this.isHash = true;
  return this;
};

Meta.prototype.lob = function() {
  this.isLob = true;
  return this;
};

Meta.prototype.notNull = function() {
  this.isNullable = false;
  return this;
};

Meta.prototype.primaryKey = function() {
  this.isPrimaryKey = true;
  this.isNullable = false;
  return this;
};
Meta.prototype.primary = Meta.prototype.primaryKey;

Meta.prototype.uniqueKey = function() {
  this.hasIndex = true;
  this.isUnique = true;
  return this;
};
Meta.prototype.unique = Meta.prototype.uniqueKey;

Meta.prototype.unsigned = function() {
  this.isUnsigned = true;
  return this;
};

Meta.prototype.defaultValue = function(val) {
  this.defaultVal = val;
  return this;
};


// Meta Factory
var meta = {};

meta.binary = function(length) {
  var result = new Meta();
  result.length = length;
  result.doit = function(callback) {
    return callback.binary(this.length, this.isLob, this.isNullable, this.isGenerated);
  };
  return result;
};

meta.char = function(length) {
  var result = new Meta();
  result.length = length;
  result.doit = function(callback) {
    return callback.char(this.length, this.isLob, this.isNullable, this.isGenerated, this.characterset, this.collate);
  };
  return result;
};

meta.date = function() {
  var result = new Meta();
  result.doit = function(callback) {
    return callback.date(this.isNullable);
  };
  return result;
};

meta.datetime = function(fsp) {
  var result = new Meta();
  result.fsp = fsp;
  result.doit = function(callback) {
    return callback.datetime(this.fsp, this.isNullable, this.isGenerated);
  };
  return result;
};

meta.decimal = function(precision, scale) {
  var result = new Meta();
  result.isNumeric = true;
  result.precision = precision;
  result.scale = scale || 0;
  result.doit = function(callback) {
    return callback.decimal(this.precision, this.scale, this.isNullable);
  };
  return result;
};

meta.double = function() {
  var result = new Meta();
  result.isNumeric = true;
  result.doit = function(callback) {
    return callback.double(this.isNullable);
  };
  return result;
};

meta.float = function() {
  var result = new Meta();
  result.isNumeric = true;
  result.doit = function(callback) {
    return callback.float(this.isNullable);
  };
  return result;
};

meta.hashKey = function(columns, name) {
  var result = new Meta();
  result.name = name;
  result.isIndex = true;
  result.isHash = true;
  result.columns = columns;
  result.isUnique = true;
  result.isOrdered = false;
  return result;
};

meta.index = function(columns, name) {
  var result = new Meta();
  result.name = name;
  result.isIndex = true;
  result.isUnique = false;
  result.columns = columns;
  return result;
};

meta.integer = function(bits) {
  var result = new Meta();
  result.isNumeric = true;
  result.isInteger = true;
  result.bits = isFinite(bits) ? bits : 32;
  result.doit = function(callback) {
    return callback.integer(this.bits, this.isUnsigned, this.isNullable, this.isGenerated);
  };
  return result;
};
meta.int = meta.integer;

meta.interval = function(fsp) {
  var result = new Meta();
  result.fsp = fsp;
  result.doit = function(callback) {
    return callback.interval(this.fsp, this.isNullable);
  };
};
meta.number = meta.decimal;

meta.orderedIndex = meta.index;

meta.primaryKey = function(columns) {
  var result = new Meta();
  result.isIndex = true;
  result.isPrimaryKey = true;
  result.columns = columns;
  return result;
};

meta.time = function(fsp) {
  var result = new Meta();
  result.fsp = fsp;
  result.doit = function(callback) {
    return callback.timestamp(this.fsp, this.isNullable);
  };
  return result;
};

meta.timestamp = function(fsp) {
  var result = new Meta();
  result.fsp = fsp;
  result.doit = function(callback) {
    return callback.timestamp(this.fsp, this.isNullable, this.isGenerated);
  };
  return result;
};

meta.uniqueIndex = function(columns, name) {
  var result = new Meta();
  result.name = name;
  result.isIndex = true;
  result.unique = true;
  result.columns = columns;
  return result;
};

meta.varbinary = function(length) {
  var result = new Meta();
  result.length = length;
  result.doit = function(callback) {
    return callback.varbinary(this.length, this.isLob, this.isNullable);
  };
  return result;
};

meta.varchar = function(length) {
  var result = new Meta();
  result.length = length;
  result.doit = function(callback) {
    return callback.varchar(this.length, this.isLob, this.isNullable, this.characterset, this.collate);
  };
  return result;
};

meta.year = function() {
  var result = new Meta();
  result.isNumeric = true;
  result.doit = function(callback) {
    return callback.year(this.isNullable);
  };
  return result;
};

meta.fromLiteralMeta = function(literal) {
  var p, result;
  result = new Meta();
  for(p in literal) {
    if(literal.hasOwnProperty(p)) {
      result.p = literal.p;
    }
  }
  return result;
};

module.exports = meta;
