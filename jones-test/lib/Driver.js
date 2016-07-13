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

var unified_debug = require("unified_debug"),
    udebug        = unified_debug.getLogger("Driver.js"),
    CommandLine   = require("./CommandLine"),
    Listener      = require("./Listener"),
    LintTest      = require("./LintTest"),
    Result        = require("./Result"),
    Suite         = require("./Suite"),
    path          = require("path"),
    fs            = require("fs");


/** Driver 
*/
function Driver(baseDirectory) {
  this.baseDirectory         = baseDirectory;   // See default value, below
  this.flagHandler           = new CommandLine.FlagHandler();
  this.result                = new Result(this);
  this.result.listener       = new Listener.Listener();
  this.suites                = [];
  this.fileToRun             = "";
  this.testInFile            = null;
  this.suitesToRun           = null;
  this.skipSmokeTest         = false;
  this.skipClearSmokeTest    = false;
  this.onReportCallback      = null;    // callback at report 
  this.abortAndExit          = false;   // --help option
  this.timeoutMillis         = 0;       // no timeout
  this.numberOfRunningSuites = 0;
  this.exitStatus            = 0;

  if(! baseDirectory) {
    this.baseDirectory = path.dirname(module.parent.parent.filename);
  }
  this.setCommandLineFlags();
}

Driver.prototype.resetSuites = function() {this.suites = [];}

Driver.prototype.addCommandLineOption = function(shortForm, longForm, helpText, callback) {
  this.flagHandler.addOption(new CommandLine.Option(shortForm, longForm, helpText, callback));
};

Driver.prototype.processCommandLineOptions = function() {
  if(! this.flagHandler.done) {
    this.flagHandler.processArguments();
  }
};

Driver.prototype.addLintTestsForDirectory = function(directory) {
  var suite, tests, i, useFile;

  directory = path.resolve(this.baseDirectory, directory);
  for(i = 1 ; i < arguments.length ; i++) {
    directory = path.resolve(directory, arguments[i]);
  }

  suite = new Suite(this, "lint");

  /* Add the smoke test */
  suite.addTest(directory, new LintTest.LintSmokeTest());

  /* Add the individual file lint tests */
  tests = LintTest.forDirectory(directory);
  for(i = 0 ; i < tests.length ; i++) {
    suite.addTest(directory, tests[i]);
  }

  this.suites.push(suite);
};

Driver.prototype.ignoreLint = function(a, b, c, d) {
  LintTest.ignore(a, b, c, d);
};

Driver.prototype.predefineLint = function(keywords) {
  LintTest.predefine(keywords);
};

Driver.prototype.addSuiteFromFile = function(suitename, filename) {
  this.suites.push(new Suite(this, suitename, filename));
};

Driver.prototype.addSuitesFromDirectory = function(directory) {
  var files, f, i, st, suite, nsuites, dir;
  nsuites = 0;

  directory = path.resolve(this.baseDirectory, directory);
  udebug.log_detail("addSuitesFromDirectory:", directory);

  /* Read the test directory, building list of suites */
  files = fs.readdirSync(directory);
  for(i = 0; i < files.length ; i++) {
    f = files[i];
    st = fs.statSync(path.join(directory, f));
    if (st.isDirectory() && this.isSuiteToRun(f)) {
      nsuites++;
      dir = path.join(directory, f);
      if(this.fileToRun) {
        dir = path.join(dir, this.fileToRun);
      }
      suite = new Suite(this, f, dir);
      this.suites.push(suite);
    }
  }
  udebug.log_detail("Added", nsuites, "suites.");
  return nsuites;
};

Driver.prototype.setSuitesToRun = function(suites) {
  if(typeof suites === 'string') {
    this.suitesToRun = suites.split(",");
    return 1;
  }
  return -1;
};

Driver.prototype.isSuiteToRun = function(directoryName) {
  var runSuite = false;

  if(this.suitesToRun === null) {
    return true;
  }

  this.suitesToRun.forEach(function(s) {
    if((s === directoryName) || (s === directoryName + path.sep)) {
      runSuite = true;
      udebug.log_detail("isSuiteToRun:", directoryName);
    }
  });
  return runSuite;
};

Driver.prototype.listSuites = function() {
  this.suites.forEach(function(s) {
    var component = path.basename(path.dirname(path.dirname(s.path)));
    console.log(component,"\t\t",s.name);
  });
};

Driver.prototype.testCompleted = function(testCase) {
  var suite = testCase.suite;
  if (suite.testCompleted(testCase)) {
    // this suite is done; remove it from the list of running suites
    if (--this.numberOfRunningSuites === 0) {
      // no more running suites; report and exit
      clearTimeout(this.timerId);
      this.allTestsCompleted();
    }
  } 
};

Driver.prototype.onReportCallback = function() {
  return;
};

Driver.prototype.onAllTestsCompleteCallback = function(userCallback) {
  userCallback();
};

Driver.prototype.allTestsCompleted = function() {
  var driver = this;
  driver.onAllTestsCompleteCallback(function() {
    driver.reportResultsAndExit();
  });
};

Driver.prototype.reportResultsAndExit = function() {
  var driver = this;
  driver.exitStatus |= driver.result.report();
  this.onReportCallback();
  this.result.reset();
  if (driver.allTestsCallback) {
    driver.allTestsCallback(driver.exitStatus);
  } else {
    process.exit(driver.exitStatus);
  }
};

Driver.prototype.runAllTests = function(allTestsCallback) {
  this.allTestsCallback = allTestsCallback;
  var i;
  var driver = this;

  /* Should we show the help text and exit? */
  if(this.abortAndExit) {
    this.flagHandler.usage(0);
  }

  /* Or list suites and exit? */
  if(this.listSuitesAndExit) {
    this.listSuites();
    process.exit(0);
  }

  /* Create tests */
  for(i = 0; i < this.suites.length ; i++) {
    this.suites[i].createTests();
  }

  /* Set Timeout */
  function onTimeout() { 
    console.log("DRIVER TIMED OUT after", driver.timeoutMillis, "msec.");
    driver.reportResultsAndExit();
  }

  if(this.timeoutMillis > 0) {
    this.timerId = setTimeout(onTimeout, this.timeoutMillis);
  }

  /* Now start running tests */
  udebug.log_detail("Starting tests from", this.suites.length, "suites");
  this.numberOfRunningSuites = this.suites.length;
  for(i = 0; i < this.suites.length ; i++) {
    if (! this.suites[i].runTests(this.result)) {
      this.numberOfRunningSuites--;
    }
  }

  /* If we did not start any suites, exit now */
  if (this.numberOfRunningSuites === 0) {
    this.reportResultsAndExit();
  }
};

Driver.prototype.setCommandLineFlags = function() {
  var opts = this.flagHandler,
      driver = this;
  
  opts.addOption(new CommandLine.Option( 
    "-h", "--help", "print this message",
    function() {
      driver.abortAndExit = true;
      return 0;
    }
  ));

  opts.addOption(new CommandLine.Option(
   "-l", "--list", "just list test suites",
   function() {
     driver.listSuitesAndExit = true;
     return 0;
    }
  ));

  opts.addOption(new CommandLine.Option(
     "-d", "--debug", "enable debug output",
     function() {
       unified_debug.level_debug();
       unified_debug.on();
       return 0;
     }
  ));

  opts.addOption(new CommandLine.Option(
     null, "--detail", "enable detailed debug output",
     function() {
       unified_debug.level_detail();
       unified_debug.on();
       return 0;
     }
  ));

  opts.addOption(new CommandLine.Option(
     "-df=<sourcefile>", null, "enable all debug output from <sourcefile>",
     function(thisArg) {
       unified_debug.on();
       unified_debug.set_file_level(thisArg, 5);
       return 1;
     }
  ));

  
  opts.addOption(new CommandLine.Option(
    "-t", "--trace", "print stack trace from failing tests",
    function() {
      driver.result.listener.printStackTraces = true;
      return 0;
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null,  "--skip-smoke", "do not run SmokeTest",
    function() {
      driver.skipSmokeTest = true;
      return 0;
    }
  ));

  opts.addOption(new CommandLine.Option(
    null, "--skip-clear", "do not run ClearSmokeTest",
    function() {
      driver.skipClearSmokeTest = true;
      return 0;
    }
  ));
  
  // --timeout takes a value in milliseconds
  opts.addOption(new CommandLine.Option(
    null, "--timeout <msec>", "set timeout in msec.",
    function(thisArg) {
      if(thisArg) {
        driver.timeoutMillis = thisArg;
        return 1;
      }
      return -1;  // timeout value is required
    }
  ));
  
  // --failed and --quiet both imply 10 sec. timeout:  
  opts.addOption(new CommandLine.Option(
    "-q", "--quiet", "do not print individual test results",
    function() {
      driver.result.listener = new Listener.QuietListener();
      driver.timeoutMillis = 10000;
      return 0;
    }
  ));

  opts.addOption(new CommandLine.Option(
    "-f", "--failed", "suppress passed tests, print failures only",
    function() {
      driver.result.listener = new Listener.FailOnlyListener();
      driver.timeoutMillis = 10000;
      return 0;
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null, "--suite <suite>", "only run the named suite",
    function(thisArg) {
      return driver.setSuitesToRun(thisArg);
    }
  ));

  opts.addOption(new CommandLine.Option(
    null, "--suites <suite,suite,...>", "only run the named suites",
    function(thisArg) {
      return driver.setSuitesToRun(thisArg);
    }
  ));

  opts.addOption(new CommandLine.Option(
    null, "--test <testFile>", "only run the named test file",
    function(thisArg) {
      var suite;
      if(thisArg) {
        if(! thisArg.match(/\.js$/)) {
          if(thisArg.match(/Test$/)) {
            thisArg += ".js";
          } else {
            thisArg += "Test.js";
          }
        }
        driver.fileToRun = path.basename(thisArg);
        suite = path.dirname(thisArg);
        if(suite) {
          driver.suitesToRun = [ suite ];
        }
        return 1;
      }
      return -1;  // argument is required
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null, "--case <n,m,...>","only run test cases numbered n, m, etc. in <testFile>\n",
     function(thisArg) {
      if(thisArg) {
        driver.testInFile = thisArg;
        return 1;
      }
      return -1;  // test number is required
    }
  ));
};

module.exports = Driver;
