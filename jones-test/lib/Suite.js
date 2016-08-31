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

var path   = require("path"),
    fs     = require("fs"),
    assert = require("assert"),
    udebug = require("unified_debug").getLogger("Suite.js");

var re_matching_test_case = /Test\.js$/;

/** Suite
  *  A suite consists of all test cases in all tests in a single directory 
  *
  */
function Suite(driver, name, suiteDir) {
  this.driver = driver;
  this.name = name;
  this.path = "";

  this.tests = [];
  this.smokeTest = {};
  this.smokeTestHasFailed = null;
  this.serialTests = [];
  this.clearSmokeTest = {};
  this.concurrentTests = [];

  this.firstConcurrentTestIndex = -1;
  this.firstSerialTestIndex = -1;
  this.nextSerialTestIndex = -1;

  this.currentTest = 0;
  this.numberOfConcurrentTests = 0;
  this.numberOfConcurrentTestsCompleted = 0;
  this.numberOfSerialTests = 0;

  if(typeof suiteDir === 'string') {
    this.path = path.resolve(driver.baseDirectory, suiteDir);
  }
  udebug.log_detail("New Suite:", this.name, "from", this.path);
}

Suite.prototype.addTest = function(filename, test) {
  udebug.log(this.name, "adding test", test.name);
  test.filename = path.resolve(this.path, filename);
  test.suite = this;
  test.reset();
  this.tests.push(test);  // should check if test has been disabled
};

/* addTestsFromFile(f, onlyTests)
   f is a fully resolved pathname
   onlyTests is a string containing a comma separated list of 
   test numbers.  If set, only those elements of the test array are added.
*/
Suite.prototype.addTestsFromFile = function(f, onlyTests) {
  var t, i, j, k, testList, testHash;
  if(onlyTests) {
    onlyTests = String(onlyTests);
    testList = onlyTests.split(",");
    testHash = [];
    for(i = 0 ; i < testList.length ; i ++) {
      k = Number(testList[i]) - 1;
      testHash[k] = 1;
    }
  }
  if(re_matching_test_case.test(f)) {
    t = require(f);
    if(typeof(t.tests) === 'object' && t.tests instanceof Array) {
      for(j = 0 ; j < t.tests.length ; j++) {
        if(onlyTests === null || testHash[j] === 1) {
          this.addTest(f, t.tests[j]);
        }
      }
    }      
    else if(typeof(t.isTest) === 'function' && t.isTest()) {
      this.addTest(f, t);
    }
    else { 
      console.log("Warning: " + f + " does not export a Test.");
    }
  }
};

Suite.prototype.createTests = function() {
  var stat, suite, i;

  udebug.log_detail("createTests for", this.name, "in", this.path);
  if(this.path.length) {
    stat = fs.statSync(this.path);
    if(stat.isFile()) {
      var testFile = this.path;
      this.path = path.dirname(testFile);
      try {
        this.addTestsFromFile(path.join(this.path, "SmokeTest.js"), null);
      } catch(ignore) {}
      this.addTestsFromFile(testFile, this.driver.testInFile);
      try {
        this.addTestsFromFile(path.join(this.path, "ClearSmokeTest.js"), null);
      } catch(ignore) {}
    }
    else if(stat.isDirectory()) {
      var files = fs.readdirSync(this.path);
      for(i = 0; i < files.length ; i++) {
        this.addTestsFromFile(path.join(this.path, files[i]), null);
      }
    }
  }

  this.tests.forEach(function(t, index) {
    t.original = index;
  });

  this.tests.sort(function(a,b) {
    // sort the tests by phase, preserving the original order within each phase
    if(a.phase < b.phase)  { return -1; }
    if(a.phase === b.phase) { return (a.original < b.original)?-1:1;  }
    return 1;
  });

  suite = this;
  this.tests.forEach(function(t, index) {
    t.index = index;
    t.suite = suite;
    switch(t.phase) {
      case 0:
        suite.smokeTest = t;
        break;
      case 1:
        suite.concurrentTests.push(t);
        if (suite.firstConcurrentTestIndex === -1) {
          suite.firstConcurrentTestIndex = t.index;
        }
        break;
      case 2:
        suite.serialTests.push(t);
        if (suite.firstSerialTestIndex === -1) {
          suite.firstSerialTestIndex = t.index;
        }
        break;
      case 3:
        suite.clearSmokeTest = t;
        break;
    }
  });
  this.numberOfConcurrentTests = this.concurrentTests.length;
  this.numberOfSerialTests = this.serialTests.length;
  udebug.log_detail("Suite", this.name, "has",
                    this.numberOfConcurrentTests, "concurrent tests;",
                    this.numberOfSerialTests, "serial tests.");
};


Suite.prototype.runTests = function(result) {
  var tc;
  udebug.log_detail("runTests for", this.name, ":", this.tests.length, "tests");
  if (this.tests.length === 0) {
    return false;
  }
  this.currentTest = 0;
  tc = this.tests[this.currentTest];
  switch (tc.phase) {
    case 0:
      // smoke test
      // start the smoke test
      if(this.driver.skipSmokeTest) {
        tc.skip("skipping SmokeTest", result);
      }
      else {
        tc.test(result);
      }
      break;
    case 1:
      // concurrent test is the first test
      // start all concurrent tests
      this.startConcurrentTests(result);
      break;
    case 2:
      // serial test is the first test
      this.startSerialTests(result);
      break;
    case 3:
      // clear smoke test is the first test
      if(this.driver.skipClearSmokeTest) {
       tc.skip("skipping ClearSmokeTest", result);
      }
      else {
        tc.test(result);
      }
      break;
  }
  return true;
};


Suite.prototype.startConcurrentTests = function(result) {
  var skip = this.smokeTestHasFailed;
  if (this.firstConcurrentTestIndex !== -1) {
    this.concurrentTests.forEach(function(testCase) {
      if(skip) {
        testCase.skip("(failed SmokeTest)", result);
      } else {
        testCase.test(result);
      }
    });
    return false;    
  } 
  // else:
  return this.startSerialTests(result);
};


Suite.prototype.startSerialTests = function(result) {
  if (this.firstSerialTestIndex !== -1) {
    this.startNextSerialTest(this.firstSerialTestIndex, result);
    return false;
  } 
  // else:
  return this.startClearSmokeTest(result);
};


Suite.prototype.startClearSmokeTest = function(result) {
  if (this.driver.skipClearSmokeTest) {
    this.clearSmokeTest.skip("skipping ClearSmokeTest", result);
  }
  else if (this.clearSmokeTest && this.clearSmokeTest.test) {
    this.clearSmokeTest.test(result);
    return false;
  } 
  return true;
};


Suite.prototype.startNextSerialTest = function(index, result) {
  var testCase = this.tests[index];
  if(this.smokeTestHasFailed) {
    testCase.skip("(failed SmokeTest)", result);
  } else {
    testCase.test(result);
  }
};


/* Notify the suite that a test has completed.
   Returns false if there are more tests to be run,
   true if suite is complete.
 */
Suite.prototype.testCompleted = function(testCase) {
  var tc, index;
  var result = testCase.result;
  switch (testCase.phase) {
    case 0:     // the smoke test completed
      this.smokeTestHasFailed = testCase.failed || testCase.skipped;
      return this.startConcurrentTests(result);

    case 1:     // one of the concurrent tests completed
      if (++this.numberOfConcurrentTestsCompleted === this.numberOfConcurrentTests) {
        return this.startSerialTests(result);   // go on to the serial tests
      }
      return false;

    case 2:     // one of the serial tests completed
      index = testCase.index + 1;
      if (index < this.tests.length) {
        tc = this.tests[index];
        if (tc.phase === 2) {
          this.startNextSerialTest(index, result);
        }
        else if (tc.phase === 3) {
          this.startClearSmokeTest(result);
        }
        return false;
      }
      /* Done */
      return true;

    case 3:   // the clear smoke test completed
      return true;
  }
};

module.exports = Suite;

