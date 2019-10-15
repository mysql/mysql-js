/*
 Copyright (c) 2013, Oracle and/or its affiliates. All rights
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
var assert = require("assert");


function RandomIntGenerator(min, max) {
  assert(max > min);
  var range = max - min;
  this.next = function() {
    var x = Math.floor(Math.random() * range);
    return min + x;
  };
}


function SequentialIntGenerator(startSeq) {
  var seq = startSeq - 1;
  this.next = function() {
    seq += 1;
    return seq;
  };
}


function RandomFloatGenerator(min, max, prec, scale) {
  assert(max > min);
  this.next = function() {
    var x = Math.random();
    /* fixme! */
    return 100 * x;
  };
}


function RandomCharacterGenerator() {
  var intGenerator = new RandomIntGenerator(32, 126);
  this.next = function() {
    return String.fromCharCode(intGenerator.next());
  };
}


function RandomVarcharGenerator(length) {
  var lengthGenerator = new RandomIntGenerator(0, length),
      characterGenerator = new RandomCharacterGenerator();
  this.next = function() {
    var i,
        str = "",
        len = lengthGenerator.next();
    for(i = 0; i < len ; i++) { str += characterGenerator.next(); }
    return str;
  };
}


function RandomVarbinaryGenerator(length) {
  var lengthGenerator = new RandomIntGenerator(0, length),
      byteGenerator = new RandomIntGenerator(0, 255);
  this.next = function() {
    var i,
        sz = lengthGenerator.next(),
        buffer = Buffer.alloc(sz);
    for(i = 0; i < sz ; i++) { buffer[i] = byteGenerator.next(); }
    return buffer;
  };
}


function RandomCharGenerator(length) {
  var characterGenerator = new RandomCharacterGenerator();
  this.next = function() {
    var i,
        str = "";
    for(i = 0; i < length ; i++) { str += characterGenerator.next(); }
    return str;
  };
}


function RandomBinaryGenerator(length) {
  var byteGenerator = new RandomIntGenerator(0, 255);
  this.next = function() {
    var i,
        buffer = Buffer.alloc(length);
    for(i = 0; i < length ; i++) { buffer[i] = byteGenerator.next(); }
    return buffer;
  };
}


function RandomDateGenerator() {
  var generator = new RandomIntGenerator(0, Date.now());
  this.next = function() {
    return new Date(generator.next());
  };
}


function getRandomGeneratorForColumn(column) {
  var g = {},
      min, max, bits;

  // TODO: This should rely on generic metadata rather than
  // MySQL-specific column type names
  switch(column.columnType.toLocaleUpperCase()) {
    case "TINYINT":
    case "SMALLINT":
    case "MEDIUMINT":
    case "INT":
    case "BIGINT":
      if(column.isInPrimaryKey) {
        g = new SequentialIntGenerator(0);
      }
      else {
        bits = column.intSize * 8;
        max = column.isUnsigned ? Math.pow(2,bits)-1 : Math.pow(2, bits-1);
        min = column.isUnsigned ?                  0 : 1 - max;
        g = new RandomIntGenerator(min, max);
      }
      break;
    case "FLOAT":
    case "DOUBLE":
    case "DECIMAL":
      g = new RandomFloatGenerator(0, 100000); // fixme
      break;
    case "BINARY":
      g = new RandomBinaryGenerator(column.length);
      break;
    case "CHAR":
      g = new RandomCharGenerator(column.length);
      break;
    case "VARBINARY":
      g = new RandomVarbinaryGenerator(column.length);
      break;
    case "VARCHAR":
      g = new RandomVarcharGenerator(column.length);
      break;
    case "TIMESTAMP":
      g = new RandomIntGenerator(0, Math.pow(2,32)-1);
      break;
    case "YEAR":    
      g = new RandomIntGenerator(1900, 2155);
      break;
    case "DATE":
    case "TIME":
    case "DATETIME":
      g = new RandomDateGenerator();
      break;
    // case "BLOB":
    // case "TEXT":
    // case "BIT":
    default:
      throw("UNSUPPORTED COLUMN TYPE " + column.columnType);
  }

  return g;
}

function DummyConstructor() { }

function RandomRowGenerator(tableHandler) {
  var i, column, names, generators, Ctor;
  generators = [];
  names = [];
  Ctor = tableHandler.newObjectConstructor || DummyConstructor;

  for(i = 0; i < tableHandler.getNumberOfColumns() ; i++) {
    column        = tableHandler.getColumnMetadata(i);
    names[i]      = tableHandler.getField(i).fieldName;   // FIXME
    generators[i] = getRandomGeneratorForColumn(column);
  }

  this.newRow = function() {
    var n, row;
    row = new Ctor();
    for(n = 0; n < names.length ; n++) {
      row[names[n]] = generators[n].next();
    }
    return row;
  };
}

exports.RandomRowGenerator = RandomRowGenerator;
exports.RandomGeneratorForColumn = getRandomGeneratorForColumn;
