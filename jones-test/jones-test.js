/*
 Copyright (c) 2015 Oracle and/or its affiliates. All rights
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

var Driver         = require("./lib/Driver"),
    CommandLine    = require("./lib/CommandLine"),
    _test          = require("./lib/Test"),
    DocsTest       = require("./lib/DocsTest"),
    LintTest       = require("./lib/LintTest");

module.exports = { 
  "Driver"                   : Driver,
  "CommandLine"              : CommandLine,
  "SmokeTest"                : _test.SmokeTest,
  "SerialTest"               : _test.SerialTest,
  "ConcurrentTest"           : _test.ConcurrentTest,
  "ClearSmokeTest"           : _test.ClearSmokeTest,
  "DocsTest"                 : DocsTest,
  "getLintTestsForDirectory" : LintTest.forDirectory,
  "LintSmokeTest"            : LintTest.LintSmokeTest,
  "ignoreLint"               : LintTest.ignore,
  "predefineLint"            : LintTest.predefine,
  "linterAvailable"          : LintTest.isAvailable
};

