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
  This utility Converter can be used whenever the intermediate type for
  a stored field is non-numeric, but the user desires to treat the value
  as a JavaScript Number.

  No conversion is performed when writing to the database.
************************/

"use strict";

exports.toDB = function(jsValue) {
  return jsValue;
};

exports.fromDB = function(dbValue) {
  return Number(dbValue);
};
