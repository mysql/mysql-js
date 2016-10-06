/*
 Copyright (c) 2013, 2015, Oracle and/or its affiliates. All rights
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

// implement Promises/A+ http://promises-aplus.github.io/promises-spec/

var unified_debug = global.unified_debug ? global.unified_debug :
                    require("unified_debug");
var udebug        = unified_debug.getLogger("Promise.js");

function Promise() {
  // until then is called, this is an empty promise with no performance impact
}

function emptyFulfilledCallback(result) {
  return result;
}

function emptyRejectedCallback(err) {
  throw err;
}

/** Fulfill or reject the original promise via "The Promise Resolution Procedure".
 * original_promise is the Promise from this implementation on which "then" was called
 * new_promise is the Promise from this implementation returned by "then"
 * if the fulfilled or rejected callback provided by "then" returns a promise, wire the new_result (thenable)
 *  to fulfill the new_promise when new_result is fulfilled
 *  or reject the new_promise when new_result is rejected
 * otherwise, if the callback provided by "then" returns a value, fulfill the new_promise with that value
 * if the callback provided by "then" throws an Error, reject the new_promise with that Error
 */
function thenPromiseFulfilledOrRejected(original_promise, 
                                        fulfilled_or_rejected_callback, 
                                        new_promise, result, isRejected) {
  var new_result;
  try {
    if (fulfilled_or_rejected_callback) {
      new_result = fulfilled_or_rejected_callback.call(undefined, result);
    } else {
      if (isRejected) {
        // 2.2.7.4 If onRejected is not a function and promise1 is rejected, promise2 must be rejected with the same reason.
        new_promise.reject(result);
      } else {
        // 2.2.7.3 If onFulfilled is not a function and promise1 is fulfilled, promise2 must be fulfilled with the same value.
        new_promise.fulfill(result);
      }
      return;
    }
    var new_result_type = typeof new_result;
    if ((new_result_type === 'object' && new_result_type != null) | new_result_type === 'function') { 
      // 2.3.3 if result is an object or function
      // 2.3 The Promise Resolution Procedure
      // 2.3.1 If promise and x refer to the same object, reject promise with a TypeError as the reason.
      if (new_result === original_promise) {
        throw new Error('TypeError: Promise Resolution Procedure 2.3.1');
      }
      // 2.3.2 If x is a promise, adopt its state; but we don't care since it's also a thenable
      var then;
      try {
        then = new_result.then;
      } catch (thenE) {
        // 2.2.3.2 If retrieving the property x.then results in a thrown exception e, 
        // reject promise with e as the reason.
        new_promise.reject(thenE);
        return;
      }
      if (typeof then === 'function') {
        // 2.3.3.3 If then is a function, call it with x as this, first argument resolvePromise, 
        // and second argument rejectPromise
        // 2.3.3.3.3 If both resolvePromise and rejectPromise are called, 
        // or multiple calls to the same argument are made, the first call takes precedence, 
        // and any further calls are ignored.
        try {
          then.call(new_result,
            // 2.3.3.3.1 If/when resolvePromise is called with a value y, run [[Resolve]](promise, y).
            function(result) {
            if(udebug.is_detail()) { udebug.log(original_promise.name, 'thenPromiseFulfilledOrRejected deferred fulfill callback', new_result); }
              if (!new_promise.resolved) {
                new_promise.fulfill(result);
              }
            },
            // 2.3.3.3.2 If/when rejectPromise is called with a reason r, reject promise with r.
            function(err) {
              if(udebug.is_detail()) { udebug.log(original_promise.name, 'thenPromiseFulfilledOrRejected deferred reject callback', new_result); }
              if (!new_promise.resolved) {
                new_promise.reject(err);
              }
            }
          );
        } catch (callE) {
          // 2.3.3.3.4 If calling then throws an exception e,
          // 2.3.3.3.4.1 If resolvePromise or rejectPromise have been called, ignore it.
          if (!new_promise.resolved) {
            // 2.3.3.3.4.2 Otherwise, reject promise with e as the reason.
            new_promise.reject(callE);
          }
        }
      } else {
        // 2.3.3.4 If then is not a function, fulfill promise with x.
        new_promise.fulfill(new_result);
      }
    } else {
      // 2.3.4 If x is not an object or function, fulfill promise with x.
      new_promise.fulfill(new_result);
    }
  } catch (fulfillE) {
    // 2.2.7.2 If either onFulfilled or onRejected throws an exception e,
    // promise2 must be rejected with e as the reason.
    new_promise.reject(fulfillE);
  }
  
};

Promise.prototype.then = function(fulfilled_callback, rejected_callback, progress_callback) {
  var self = this;
  // create a new promise to return from the "then" method
  var new_promise = new Promise();
  if (typeof self.fulfilled_callbacks === 'undefined') {
    self.fulfilled_callbacks = [];
    self.rejected_callbacks = [];
    self.progress_callbacks = [];
  }
  if (self.resolved) {
    var resolved_result;
    if(udebug.is_detail()) { udebug.log(this.name, 'Promise.then resolved; err:', self.err); }
    if (self.err) {
      // this promise was already rejected
      if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then resolved calling (delayed) rejected_callback', rejected_callback); }
      global.setImmediate(function() {
        if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then resolved calling rejected_callback', fulfilled_callback); }
        thenPromiseFulfilledOrRejected(self, rejected_callback, new_promise, self.err, true);
      });
    } else {
      // this promise was already fulfilled, possibly with a null or undefined result
      if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then resolved calling (delayed) fulfilled_callback', fulfilled_callback); }
      global.setImmediate(function() {
        if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then resolved calling fulfilled_callback', fulfilled_callback); }
        thenPromiseFulfilledOrRejected(self, fulfilled_callback, new_promise, self.result);
      });
    }
    return new_promise;
  }
  // create a closure for each fulfilled_callback
  // the closure is a function that when called, calls setImmediate to call the fulfilled_callback with the result
  if (typeof fulfilled_callback === 'function') {
    if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then with fulfilled_callback', fulfilled_callback); }
    // the following function closes (this, fulfilled_callback, new_promise)
    // and is called asynchronously when this promise is fulfilled
    this.fulfilled_callbacks.push(function(result) {
      global.setImmediate(function() {
        thenPromiseFulfilledOrRejected(self, fulfilled_callback, new_promise, result);
      });
    });
  } else {
    if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then with no fulfilled_callback'); }
    // create a dummy function for a missing fulfilled callback per 2.2.7.3 
    // If onFulfilled is not a function and promise1 is fulfilled, promise2 must be fulfilled with the same value.
    this.fulfilled_callbacks.push(function(result) {
      global.setImmediate(function() {
        thenPromiseFulfilledOrRejected(self, emptyFulfilledCallback, new_promise, result);
      });
    });
  }

  // create a closure for each rejected_callback
  // the closure is a function that when called, calls setImmediate to call the rejected_callback with the error
  if (typeof rejected_callback === 'function') {
    if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then with rejected_callback', rejected_callback); }
    this.rejected_callbacks.push(function(err) {
      global.setImmediate(function() {
        thenPromiseFulfilledOrRejected(self, rejected_callback, new_promise, err);
      });
    });
  } else {
    if(udebug.is_detail()) { udebug.log(self.name, 'Promise.then with no rejected_callback');  }
    // create a dummy function for a missing rejected callback per 2.2.7.4 
    // If onRejected is not a function and promise1 is rejected, promise2 must be rejected with the same reason.
    this.rejected_callbacks.push(function(err) {
      global.setImmediate(function() {
        thenPromiseFulfilledOrRejected(self, emptyRejectedCallback, new_promise, err);
      });
    });
  }
  // todo: progress_callbacks
  if (typeof progress_callback === 'function') {
    this.progress_callbacks.push(progress_callback);
  }

  return new_promise;
};

Promise.prototype.fulfill = function(result) {
  var name; 
  if (udebug.is_detail()) {
    name = this?this.name: 'no this'; 
    udebug.log_detail("<-- Text below is not an actual Error, just an informative stack trace -->");
    udebug.log_detail(new Error(name, 'Promise.fulfill').stack);
  }
  if (this.resolved) {
    throw new Error('Fatal User Exception: fulfill called after fulfill or reject');
  }
  if(udebug.is_detail()) { 
    udebug.log(name, 'Promise.fulfill with result', result, 'fulfilled_callbacks length:', 
      this.fulfilled_callbacks?  this.fulfilled_callbacks.length: 0); 
  }
  this.resolved = true;
  this.result = result;
  var fulfilled_callback;
  if (this.fulfilled_callbacks) {
    while(this.fulfilled_callbacks.length > 0) {
      fulfilled_callback = this.fulfilled_callbacks.shift();
      if(udebug.is_detail()) { udebug.log('Promise.fulfill for', result); }
      fulfilled_callback(result);
    }
  }
};

Promise.prototype.reject = function(err) {
  var name;
  if (this.resolved) {
    throw new Error('Fatal User Exception: reject called after fulfill or reject');
  }
  if(udebug.is_detail()) {
    name = this?this.name: 'no this';
    udebug.log(name, 'Promise.reject with err', err, 'rejected_callbacks length:', 
      this.rejected_callbacks?  this.rejected_callbacks.length: 0);
  }
  this.resolved = true;
  this.err = err;
  var rejected_callback;
  if (this.rejected_callbacks) {
    while(this.rejected_callbacks.length > 0) {
      rejected_callback = this.rejected_callbacks.shift();
      if(udebug.is_detail()) { udebug.log('Promise.reject for', err); }
      rejected_callback(err);
    }
  }
//  throw err;
};

module.exports = Promise;
