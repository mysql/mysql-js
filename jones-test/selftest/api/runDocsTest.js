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

var jonesTest = require("../..");

var t1 = new jonesTest.DocsTest("../API-Documentation/Test.md");
var t2 = new jonesTest.DocsTest("../API-Documentation/Driver.md");

t1.addTestObject(new jonesTest.ConcurrentTest(), "ConcurrentTest", true);
t2.addTestObject(new jonesTest.Driver(), "Driver", true);

exports.tests = [ t1, t2 ];

