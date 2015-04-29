/*
 Copyright (c) 2013, 2014, Oracle and/or its affiliates. All rights
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


var path                  = require("path");
var fs                    = require("fs");
var jones, parent_dir, udebug_module;

jones                     = {};
jones.fs                  = {};
parent_dir                = path.dirname(__dirname);

jones.fs.adapter_dir      = __dirname;
jones.fs.super_dir        = path.dirname(parent_dir);

jones.fs.api_dir          = path.join(jones.fs.adapter_dir, "api");
jones.fs.spi_common_dir   = path.join(jones.fs.adapter_dir, "common");

jones.fs.spi_doc_dir      = path.join(parent_dir, "SPI-documentation");
jones.fs.api_doc_dir      = path.join(parent_dir, "API-documentation");

jones.fs.converters_dir   = path.join(parent_dir, "Converters");

jones.fs.api_module       = path.join(jones.fs.api_dir, "jones.js");

jones.fs.suites_dir       = path.join(parent_dir, "test");

jones.fs.test_driver      = path.join(parent_dir, "test", "JonesTestDriver");

/* Some compatibility with older versions of node */
if(typeof global.setImmediate !== 'function') {
  global.setImmediate = process.nextTick;
}

/* Export the filesystem config */
module.exports = jones.fs;

/* Also make it available globally */
if(!global.jones) { global.jones = {} };
global.jones.fs = jones.fs;

/* And export unified_debug globally */
global.unified_debug   = require("unified_debug");


