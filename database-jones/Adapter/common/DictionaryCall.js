/*
 Copyright (c) 2015, Oracle and/or its affiliates. All rights
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

var unified_debug   = require("unified_debug"),
    udebug          = unified_debug.getLogger("DictionaryCall.js"),
    assert          = require("assert"),
    QueuedAsyncCall = require("./QueuedAsyncCall").QueuedAsyncCall;


/* Calls into the data dictionary often arrive as a large number of
   accesses to the same item all at once.  Queue() provides a way
   to serialize all calls into the dictionary, run each call once, and
   distribute the results to every caller.
*/

function Call() {
  this.callbacks = {};
  this.apiCall   = null;
}

Call.prototype.makeGroupCallback = function(key) {
  var callbackList = this.callbacks[key];
  var owner = this;
  return function(param1, param2) {
    var i;
    udebug.log("GroupCallback for", key, "with", callbackList.length, "user",
               callbackList.length == 1 ? "" : "s");
    for(i = 0 ; i < callbackList.length ; i++) {
      callbackList[i](param1, param2);
    }
    owner.callbacks[key] = [];   // Clear the list
  };
};

Call.prototype.queueExecCall = function(execQueue, impl, arg, masterCallback) {
  var apiCall = new QueuedAsyncCall(execQueue, masterCallback);
  apiCall.impl = impl;
  apiCall.arg = arg;
  apiCall.run = function() {
    this.impl(this.arg, this.callback);
  };
  this.apiCall = apiCall;
  this.apiCall.enqueue();
};

/* add() returns true if the exec call should be created,
   false if it already exists
*/
Call.prototype.add = function(key, callback) {
  if(this.callbacks[key] && this.callbacks[key].length) {
    this.callbacks[key].push(callback);
    return false;
  }
  this.callbacks[key] = [ callback ];
  return true;
};


/* Queue() manages the common case for Call() by providing its own
   execQueue and using the default GroupCallback
*/
function Queue() {
  this.execQueue = [];
  this.call = new Call();
}

Queue.prototype.add = function(key, impl, arg, callback) {
  if(this.call.add(key, callback)) {
    this.call.queueExecCall(this.execQueue, impl, arg,
                            this.call.makeGroupCallback(key));
  }
};


exports.Call  = Call;
exports.Queue = Queue;
