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

/** This is the smoke test for the db suite.
 */

var test = new harness.SmokeTest("SmokeTest");

test.run = function() {
  var t = this;
  try {
    var p = Proxy.create(t);  // If Proxy is not available, fail the SmokeTest
  } catch(e) {
    t.appendErrorMessage("Proxy is not available (use node --harmony)");
    return true;
  }

  sqlCreate(this.suite, function(error) {
    if (error) {
      t.appendErrorMessage('createSQL failed: ' + error);
    }
    t.failOnError();
  });
};

module.exports.tests = [test];
