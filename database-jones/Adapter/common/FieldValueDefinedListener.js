/*
 Copyright (c) 2014, 2015, Oracle and/or its affiliates. All rights
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

var udebug = unified_debug.getLogger("FieldValueDefinedListener"),
    assert = require("assert");


/** Track field values defined. An instance of this is passed to DBTableHandler.getColumns.
 * It constructs a key that indicates which field values are defined in the object.
 * After getColumns returns, the value of key is either undefined, meaning that
 * all fields had values, or a string that indicates which fields had defined values
 * and which did not. For example, if fields 0, 1, and 3 were defined and field 2 was not,
 * the key would be 'DDUD'.
 */
function FieldValueDefinedListener() {
}

FieldValueDefinedListener.prototype.setDefined = function(fieldNumber) {
  if (this.key !== undefined) {
    this.key += 'D';
  }
};

FieldValueDefinedListener.prototype.setUndefined = function(fieldNumber) {
  if (this.key === undefined) {
    // first undefined value; create the key for all previous defined values e.g. 'DDDDDDDDD'
    this.key = '';
    var i; 
    for (i = 0; i < fieldNumber; ++i) {
      this.key += 'D';
    }
  }
  this.key += 'U';
};

FieldValueDefinedListener.prototype.setError = function(columnName, sqlState, message) {
  var error = new Error(message);
  error.columnName = columnName;
  error.sqlstate = sqlState;
  if(this.errors === undefined) {
    this.errors = [];
  }
  this.errors.push(error);
};

module.exports = FieldValueDefinedListener;
