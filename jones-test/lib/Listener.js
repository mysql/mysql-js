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
  this.started = 0;
  this.ended   = 0;
  this.printStackTraces = false;
  this.runningTests = {};
}

Listener.prototype.startTest = function(t) { 
  this.started++;
  this.runningTests[t.fullName()] = 1;
};

Listener.prototype.pass = function(t) {
  this.ended++;
  delete this.runningTests[t.fullName()];
  console.log("[pass]", t.fullName() );
};

Listener.prototype.skip = function(t, message) {
  this.skipped++;
  delete this.runningTests[t.fullName()];
  console.log("[skipped]", t.fullName(), "\t", message);
};

Listener.prototype.fail = function(t, e) {
  var message = "";
  this.ended++;
  delete this.runningTests[t.fullName()];
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

  if(t.phase === 0) {
    console.log("[FailSmokeTest]", t.fullName(), "\t", message);
  }
  else {
    console.log("[FAIL]", t.fullName(), "\t", message);
  }
};

Listener.prototype.listRunningTests = function() {
  console.log(this.runningTests);
};


/* QuietListener */
function QuietListener() {
  this.started = 0;
  this.ended   = 0;
  this.runningTests = {};
}

QuietListener.prototype.startTest = Listener.prototype.startTest;

QuietListener.prototype.pass = function(t) {
  this.ended++;
  delete this.runningTests[t.fullName()];
};

QuietListener.prototype.skip = QuietListener.prototype.pass;
QuietListener.prototype.fail = QuietListener.prototype.pass;

QuietListener.prototype.listRunningTests = Listener.prototype.listRunningTests;

/* FailOnlyListener */
function FailOnlyListener() {
  this.fail = Listener.prototype.fail;
}

FailOnlyListener.prototype = new QuietListener();

exports.Listener          = Listener;
exports.QuietListener     = QuietListener;
exports.FailOnlyListener  = FailOnlyListener;
