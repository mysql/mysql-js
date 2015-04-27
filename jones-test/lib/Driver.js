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

var skipFilePatterns = [
  /^\./,        // skip files starting with .
  /~[1-9]~$/    // bzr leaves these around
];


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
  this.suitesToRun           = "";
  this.skipSmokeTest         = false;
  this.skipClearSmokeTest    = false;
  this.onReportCallback      = null;    // callback at report 
  this.closeResources        = null;    // callback at exit 
  this.abortAndExit          = false;   // --help option
  this.timeoutMillis         = 0;       // no timeout
  this.numberOfRunningSuites = 0;

  if(! baseDirectory) {
    this.baseDirectory = path.dirname(module.parent.parent.filename);
  }
  this.setCommandLineFlags();
}

Driver.prototype.addCommandLineOption = function(shortForm, longForm, helpText, callback) {
  this.flagHandler.addOption(new CommandLine.Option(shortForm, longForm, helpText, callback));
};

Driver.prototype.processCommandLineOptions = function() {
  if(! this.flagHandler.done) {
    this.flagHandler.processArguments();
  }
};

Driver.prototype.addLintTestsForDirectory = function(directory) {
  var suite, files, file, i, useFile;

  directory = path.resolve(this.baseDirectory, directory);
  for(i = 1 ; i < arguments.length ; i++) {
    directory = path.resolve(directory, arguments[i]);
  }

  suite = new Suite(this, "lint");

  /* Add the smoke test */
  suite.addTest(directory, new LintTest.LintSmokeTest());

  /* Add the individual file lint tests */
  files = fs.readdirSync(directory);
  while(file = files.pop()) {
    useFile = false;
    for(i = 0 ; i < skipFilePatterns.length ; i++) {
      if( (file.match(/\.js$/) && (! file.match(skipFilePatterns[i])))) {
        useFile = true;
      }
    }
    if(useFile) {
      suite.addTest(file, new LintTest.LintTest(directory, file));
    }
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
  var files, f, i, st, suite, nsuites;
  nsuites = 0;

  directory = path.resolve(this.baseDirectory, directory);

  if(this.fileToRun) {
    nsuites++;
    if(! this.fileToRun.match(/\.js$/)) {
      if(this.fileToRun.match(/Test$/)) {
        this.fileToRun += ".js";
      } else {
        this.fileToRun += "Test.js";
      }
    }
    var suitename = path.dirname(this.fileToRun);
    var pathname = path.join(directory, this.fileToRun); 
    suite = new Suite(this, suitename, pathname);
    this.suites.push(suite);
  }
  else { 
    /* Read the test directory, building list of suites */
    files = fs.readdirSync(directory);
    for(i = 0; i < files.length ; i++) {
      f = files[i];
      st = fs.statSync(path.join(directory, f));
      if (st.isDirectory() && this.isSuiteToRun(f)) {
        nsuites++;
        suite = new Suite(this, f, path.join(directory, f));
        this.suites.push(suite);
      }
    }
  }
  udebug.log_detail("Added", nsuites, "suites.");
  return nsuites;
};

Driver.prototype.isSuiteToRun = function(directoryName) {
  return (this.suitesToRun === "" || this.suitesToRun.indexOf(directoryName) > -1);
};

Driver.prototype.testCompleted = function(testCase) {
  var suite = testCase.suite;
  if (suite.testCompleted(testCase)) {
    // this suite is done; remove it from the list of running suites
    if (--this.numberOfRunningSuites === 0) {
      // no more running suites; report and exit
      this.reportResultsAndExit();
    }
  } 
};

Driver.prototype.reportResultsAndExit = function() {
  var driver = this;

  console.log("Started: ", this.result.listener.started);
  console.log("Passed:  ", this.result.passed.length);
  console.log("Failed:  ", this.result.failed.length);
  console.log("Skipped: ", this.result.skipped.length);

  if(this.onReportCallback) {
    this.onReportCallback();
  }

  if(this.closeResources) {
    this.closeResources(function() {
      process.exit(driver.result.failed.length > 0);     
    });
  } else {
    process.exit(driver.result.failed.length > 0);    
  }
};

Driver.prototype.runAllTests = function() {
  var i;
  var driver = this;

  this.numberOfRunningSuites = this.suites.length;

  /* Should we show the help text and exit? */
  if(this.abortAndExit) {
    this.flagHandler.usage(0);
  }

  /* Create tests */
  for(i = 0; i < this.suites.length ; i++) {
    this.suites[i].createTests();
  }

  /* Set Timeout */
  function onTimeout() { 
    var nwait = driver.result.listener.started - driver.result.listener.ended;
    var tests = (nwait === 1 ? " test:" : " tests:");
    console.log('TIMEOUT: still waiting for', nwait, tests);
    driver.result.listener.listRunningTests();
    driver.reportResultsAndExit();
  }

  if(this.timeoutMillis > 0) {
    setTimeout(onTimeout, this.timeoutMillis);
  }

  /* Now start running tests */
  udebug.log_detail("Starting tests from", this.suites.length, "suites");
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
      return 1;
    }
  ));

  opts.addOption(new CommandLine.Option(
     "-d", "--debug", "enable debug output",
     function() {
       unified_debug.level_debug();
       unified_debug.on();
       return 1;
     }
  ));

  opts.addOption(new CommandLine.Option(
     null, "--detail", "enable detailed debug output",
     function() {
       unified_debug.level_detail();
       unified_debug.on();
       return 1;
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
      return 1;
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null,  "--skip-smoke", "do not run SmokeTest",
    function() {
      driver.skipSmokeTest = true;
      return 1;
    }
  ));

  opts.addOption(new CommandLine.Option(
    null, "--skip-clear", "do not run ClearSmokeTest",
    function() {
      driver.skipClearSmokeTest = true;
      return 1;      
    }
  ));
  
  // --timeout takes a value in milliseconds
  opts.addOption(new CommandLine.Option(
    null, "--timeout <msec>", "set timeout in msec.",
    function(thisArg, nextArg) {
      if(thisArg) {
        driver.timeoutMillis = thisArg;
        return 1;
      }
      if(nextArg) {
        driver.timeoutMillis = nextArg;
        return 2;
      }
      return 0;
    }
  ));
  
  // --failed and --quiet both imply 10 sec. timeout:  
  opts.addOption(new CommandLine.Option(
    "-q", "--quiet", "do not print individual test results",
    function() {
      driver.result.listener = new Listener.QuietListener();
      driver.timeoutMillis = 10000;
      return 1;
    }
  ));

  opts.addOption(new CommandLine.Option(
    "-f", "--failed", "suppress passed tests, print failures only",
    function() {
      driver.result.listener = new Listener.FailOnlyListener();
      driver.timeoutMillis = 10000;
      return 1;
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null, "--suite <suite>", "only run the named suite",
    function(thisArg, nextArg) {
      if(thisArg) {
        driver.suitesToRun = thisArg;
        return 1;
      }
      driver.suitesToRun = nextArg;
      return 2;
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null, "--suites <suite,suite,...>", "only run the named suites",
    function(thisArg, nextArg) {
      if(thisArg) {
        driver.suitesToRun = thisArg;
        return 1;
      }
      driver.suitesToRun = nextArg;
      return 2;
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null, "--test <testFile>", "only run the named test file",
    function(thisArg, nextArg) {
      if(thisArg) {  // --test=x
        driver.fileToRun = thisArg;
        return 1;
      }
      driver.fileToRun = nextArg; // --test x
      return 2;
    }
  ));
  
  opts.addOption(new CommandLine.Option(
    null, "--case <n,m,...>","only run test cases numbered n, m, etc. in <testFile>\n",
     function(thisArg, nextArg) {
      driver.testInFile = nextArg;
      return 2;
    }
  ));
};

module.exports = Driver;
