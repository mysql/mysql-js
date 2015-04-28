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

var assert = require("assert"),
    path   = require("path"),
    util   = require("util");

function Test() {
  this.filename = "";
  this.name     = "";       // This is set by the derived constructor
  this.phase    = 2;        // Serial Test (default)
  this.errorMessages = '';
  this.suite    = null;     // will be set by Suite.addTest()
  this.index    = 0;        // index in suite; will be set by Suite.createTest()
  this.original = 0;        // used by Suite when sorting tests
  this.failed   = null;     // will be set to true by fail(), or false by pass()
  this.skipped  = false;
  this.result   = null;     // will be set by Test.test()
}

Test.prototype.test = function(result) {
  var runReturnCode;
  this.result = result;
  result.listener.startTest(this);

  try {
    runReturnCode = this.run();
  }
  catch(e) {
    console.log(this.name, 'threw exception & failed\n', e.stack);
    this.failed = true;
    result.fail(this, e);
    return;
  }

  if(! runReturnCode) {
    // async test must call Test.pass or Test.fail when done
    return;
  }

  // Test ran synchronously.  Fail if any error messages have been reported.
  if(! this.skipped) {
    if (this.errorMessages === '') {
      result.pass(this);
    } else {
      this.failed = true;
      result.fail(this, this.errorMessages);
    }
  }
};

Test.prototype.onComplete = function() {
  return;
};

Test.prototype.pass = function() {
  if (this.failed !== null) {
    console.log('Error: pass called with status already '
                + (this.failed?'failed ':'passed ') + this.suite.name +"."+ this.name);
    assert(this.failed === null);
  } else {
    this.onComplete();
    this.failed = false;
    this.result.pass(this);
  }
};

Test.prototype.fail = function(message) {
  if (this.failed !== null) {
    console.log('Error: pass called with status already '
                + (this.failed?'failed ':'passed ') + this.suite.name +"."+ this.name);
    assert(this.failed === null);
  } else {
    this.onComplete();
    this.failed = true;
    if (message) {
      this.appendErrorMessage(message);
      this.stack = message.stack;
    }
    this.result.fail(this, { 'message' : this.errorMessages, 'stack': this.stack});
  }
};

Test.prototype.appendErrorMessage = function(message) {
  this.errorMessages += message;
  this.errorMessages += '\n';
};

Test.prototype.error = Test.prototype.appendErrorMessage;

Test.prototype.failOnError = function() {
  if (this.errorMessages !== '') {
    this.fail();
  } else {
    this.pass();
  }
};

Test.prototype.skip = function(message) {
  this.skipped = true;
  this.result.skip(this, message);
  return true;
};

Test.prototype.isTest = function() { return true; };

Test.prototype.fullName = function() {
  var n = "";
  if(this.suite)    { n = n + this.suite.name + " "; }
  if(this.filename) { n = n + path.basename(this.filename) + " "; }
  return n + this.name;
};

Test.prototype.run = function() {
  throw {
    "name" : "unimplementedTest",
    "message" : "this test does not have a run() method"
  };
};

function getType(obj) {
  var type = typeof obj;
  if (type === 'object') {
    return obj.constructor.name;
  }
  return type;
}

function compare(o1, o2) {
  if (o1 == o2)                               { return true;  }
  if (o1 == null && o2 == null)               { return true;  }
  if (o1 === undefined && o2 === undefined)   { return true;  }
  if (typeof o1 !== typeof o2)                { return false; }
  if (o1.toString() === o2.toString())        { return true;  }
  return false;
}

Test.prototype.errorIfNotEqual = function(message, o1, o2) {
	if (!compare(o1, o2)) {
	  var o1type = getType(o1);
	  var o2type = getType(o2);
    message += ': expected (' + o1type + ') ' + o1 + '; actual (' + o2type + ') ' + o2 + '\n';
		this.errorMessages += message;
	}
};

Test.prototype.errorIfNotStrictEqual = function(message, o1, o2) {
  if(o1 !== o2) {
    var o1type = getType(o1);
    var o2type = getType(o2);
    message += ': expected (' + o1type + ') ' + o1 + '; actual (' + o2type + ') ' + o2 + '\n';
		this.errorMessages += message;
	}
};

Test.prototype.errorIfTrue = function(message, o1) {
  if (o1) {
    message += ': expected not true; actual ' + o1 + '\n';
    this.errorMessages += message;
  }
};

Test.prototype.errorIfNotTrue = function(message, o1) {
  if (o1 !== true) {
    message += ': expected true; actual ' + o1 + '\n';
    this.errorMessages += message;
  }
};

Test.prototype.errorIfNotError = function(message, o1) {
  if (!o1) {
    message += ' did not occur.\n';
    this.errorMessages += message;
  }
};

Test.prototype.errorIfNull = function(message, val) {
  if(val === null) {
    this.errorMessages += message;
  }
};

Test.prototype.errorIfNotNull = function(message, val) {
  if(val !== null) {
    this.errorMessages += message;
  }
};

/* Use this with the error argument in a callback */
Test.prototype.errorIfError = function(val) {
  if(val !== undefined && val !== null) {
    this.errorMessages += util.inspect(val);
  }
};

/* Value must be defined and not-null 
   Function returns true if there was no error; false on error 
*/
Test.prototype.errorIfUnset = function(message, value) {
  var r = (value === undefined || value === null); 
  if(r) {
    this.errorMessages += message;
  }
  return ! r;
};

Test.prototype.errorIfLessThan = function(message, cmp, value) {
  if((typeof value !== 'number' || value < cmp)) {
    this.errorMessages += message;
  }
};

Test.prototype.errorIfGreaterThan = function(message, cmp, value) {
  if((typeof value !== 'number' || value > cmp)) {
    this.errorMessages += message;
  }
};

Test.prototype.hasNoErrors = function() {
  return this.errorMessages.length === 0;
};


/* Derived Classes */

function SmokeTest(name) {
  this.name = name;
  this.phase = 0;
}
SmokeTest.prototype = new Test();

function ClearSmokeTest(name) {
  this.name = name;
  this.phase = 3;
}
ClearSmokeTest.prototype = new Test();

function ConcurrentTest(name) {
  this.name = name;
  this.phase = 1;
}
ConcurrentTest.prototype = new Test();

function SerialTest(name) {
  this.name = name;
  this.phase = 2;
}
SerialTest.prototype = new Test();


/* Exports from this module */
exports.Test              = Test;
exports.SmokeTest         = SmokeTest;
exports.ClearSmokeTest    = ClearSmokeTest;
exports.ConcurrentTest    = ConcurrentTest;
exports.SerialTest        = SerialTest;
