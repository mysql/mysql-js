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

/**********************
  This Converter can read and write binary columns using MySQL's 
  wl#8132 "Binary JSON" encoding -- including JSON columns,
  introduced in MySQL 5.7, which natively use this format.

  It functions as a drop-in replacement for the Jones JSONConverter.

  Reading from DB to JavaScript, this converter takes a node Buffer, 
  attempts to parse it, and, if succesful, returns the deserialized 
  JavaScript value.
************************/

"use strict";

var jones = require("database-jones"),
    unified_debug = require("unified_debug"),
    udebug = unified_debug.getLogger("SerializedObjectConverter.js"),
    wl8132 = require(jones.common.MySQLSerialize);

/* Takes a JavaScript value,
   returns a node Buffer containing the value serialized to binary form.
*/
exports.toDB = function(jsValue) {
  return wl8132.serialize(jsValue);
};

/* Takes a buffer read from a binary database column,
   returns a JavaScript value
*/
exports.fromDB = function(binaryBuffer) {
  return wl8132.parse(binaryBuffer);
};
