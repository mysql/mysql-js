/*
 Copyright (c) 2014, Oracle and/or its affiliates. All rights
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

var path = require("path");
var fs = require("fs");

var ndb_dir        = __dirname;   /* /impl/ndb */
var impl_dir       = path.dirname(ndb_dir);  /* /impl */
var root_dir       = path.dirname(impl_dir); /* / */
var converters_dir = path.join(root_dir, "Converters");
var docs_dir       = path.join(root_dir, "Documentation");

/* Find the build directory */
var binary_dir;
var build1 = path.join(root_dir, "build");   // gyp builds under root dir
var build2 = path.join(impl_dir, "build");   // waf builds under impl dir
var existsSync = fs.existsSync || path.existsSync;

if(existsSync(path.join(build1, "Release", "ndb_adapter.node"))) {
  binary_dir = path.join(build1, "Release");
}
else if(existsSync(path.join(build2, "Release", "ndb_adapter.node"))) {
  binary_dir = path.join(build2, "Release");
}
else if(existsSync(path.join(build1, "Debug", "ndb_adapter.node"))) {
  binary_dir = path.join(build1, "Debug");
}
else if(existsSync(path.join(build2, "Debug", "ndb_adapter.node"))) {
  binary_dir = path.join(build2, "Debug");
}

module.exports = {
  "binary"         : path.join(binary_dir, "ndb_adapter.node"),
  "root_dir"       : root_dir,
  "impl_dir"       : impl_dir,
  "docs_dir"       : docs_dir,
  "converters_dir" : converters_dir
};

