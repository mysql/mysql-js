/*
 Copyright (c) 2012, 2015 Oracle and/or its affiliates. All rights
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

/* Result 
*/
function Result(driver) {
  this.driver = driver;
  this.listener = null;
  this.reset();
}

Result.prototype.reset = function() {
  this.name = 'Result:';
  this.passed = [];
  this.failed  = [];
  this.skipped = [];
  this.started = 0;
  this.ended   = 0;
  this.runningTests = {};
  this.startTime = process.hrtime();
  this.elapsed = 0;
};

Result.prototype.startTest = function(t) {
  this.started++;
  this.runningTests[t.fullName()] = 1;
};

Result.prototype.pass = function(t) {
  this.ended++;
  delete this.runningTests[t.fullName()];
  this.passed.push(t.name);
  this.listener.pass(t);
  this.driver.testCompleted(t);
};

Result.prototype.fail = function(t, e) {
  this.ended++;
  delete this.runningTests[t.fullName()];
  this.failed.push(t.name);
  this.listener.fail(t, e);
  this.driver.testCompleted(t);
};

Result.prototype.skipStarted = function(t, reason) {
  this.ended++;
  delete this.runningTests[t.fullName()];
  this.skipped.push(t.name);
  this.listener.skip(t, reason);
  this.driver.testCompleted(t);
};

Result.prototype.skipNotStarted = function(t, reason) {
  this.skipped.push(t.name);
  this.listener.skip(t, reason);
  this.driver.testCompleted(t);
};

/* Returns exit status:
   0 (success) if no tests failed or timed out
   1 if any tests failed
   2 if any tests timed out
   3 if some test failed *and* some test timed out
 */
Result.prototype.report = function() {
  var nwait, tests, exitStatus, hrend;
  exitStatus = 0;
  hrend = process.hrtime(this.startTime);
  console.log(this.driver.name);
  console.info("Elapsed:  %d.%d sec.", hrend[0], (hrend[1]/1000000).toFixed(0));
  nwait = this.started - this.ended;
  if(nwait > 0) {
    tests = (nwait === 1 ? "test:" : "tests:");
    console.log("Still waiting for", nwait, tests);
    console.log(this.runningTests);
  }
  if(nwait > 0) {
    exitStatus = 2; // timed out
  }
  if(this.failed.length > 0) {
    exitStatus += 1; // failed
  }

  this.listener.reportResult(this);
  return exitStatus;
};

module.exports = Result;
