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


/* Listener
*/
function Listener() {
  this.printStackTraces = false;
}

Listener.prototype.pass = function(t) {
  console.log("[pass]", t.fullName() );
};

Listener.prototype.skip = function(t, message) {
  console.log("[skipped]", t.fullName(), "\t", message);
};

Listener.prototype.fail = function(t, e) {
  var message = "";
  if (e) {
    if (e.stack !== undefined) {
      t.stack = e.stack;
    }
    if (e.message !== undefined) {
      message = e.message;
    } else {
      message = e.toString();
    }
  }
  if ((this.printStackTraces) && t.stack !== undefined) {
    message = t.stack;
  }

  console.log("[FAIL]", t.fullName(), "\t", message);
};

Listener.prototype.listRunningTests = function(tests) {
  console.log(tests);
};

Listener.prototype.reportResult  = function(result) {
  console.log("Started: ", result.started);
  console.log("Passed:  ", result.passed.length);
  console.log("Failed:  ", result.failed.length);
  console.log("Skipped: ", result.skipped.length);
};


/* QuietListener */

function nil() {
}

function QuietListener() {
  this.pass = nil;
  this.skip = nil;
  this.fail = nil;
}

QuietListener.prototype = new Listener();


/* FailOnlyListener */

function FailOnlyListener() {
  this.pass = nil;
  this.skip = nil;
}

FailOnlyListener.prototype = new Listener();


exports.Listener          = Listener;
exports.QuietListener     = QuietListener;
exports.FailOnlyListener  = FailOnlyListener;
