Driver
======

A "driver" is the executable program that finds all of your test programs and runs
them.  Jones-Test encapsulates all of the logic of a driver into class Driver, so
that the driver script itself may be very small.  The most common driver script
should look much like this one:

    var Driver = require("jones-test").Driver;
    var driver = new Driver();  
    driver.processCommandLineOptions();
    driver.addSuitesFromDirectory("tests"); 
    driver.runAllTests();

A driver script supports a large set of command-line options provided by the
Driver class.  It is also possible for the user to add custom command-line options.

Driver API
----------
```JavaScript

/* Driver constructor.
   baseDirectory will be used as a root directory for supplied path names.
   If baseDirectory is not supplied, it defaults to the directory of the
   file that calls require("jones-test") -- normally expected to be
   the driver executable script.
*/
function Driver(baseDirectory);

/* Add a command-line option to the driver script.
   First three arguments are the short form option, long form option,
   and option help text.
   The last argument is the callback that processes the option.
   The callback receives the argument "nextArg".  
   If the option was invoked with an equals sign, as in "--stats=/root", 
   then nextArg contains the text following the "=" character.  Otherwise,
   nextArg contains the next command-line parameter after the current one.

   If the callback succesfully consumes nextArg, it must return 1.
   If the callback succesfully processes the option, without consuming nextArg,
   it must return 0.
   Otherwise, the callback must return -1, to indicate an error.
   
   See also: Option() in CommandLine.js
*/
function addCommandLineOption(shortForm, longForm, helpText, callback);

/* Examine process.argv and handle command-line option processing.
   It is helpful to do this as early as possible in a script, since debugging
   output will not be available until after the "--debug" or "--detail" flags
   have been processed.
*/
function processCommandLineOptions();

/* Run tests and report results. 
*/
function runAllTests();
```

### Driver callbacks
```JavaScript
/* The Driver provides several standard callbacks that can be overridden by
   the user.

   Set driver.onAllTestsCompleteCallback() to an async function that will
   be called after all tests have run (but before results are reported).
*/
function onAllTestsCompleteCallback(userCallback) {
  userCallback();
};

/*  Set driver.onReportCallback to an immediate, synchronous function that
    will be called after all tests are complete and results have been
    reported.
*/
function onReportCallback() {
  return;
};

```

### Adding functional test
```JavaScript
/* Create a test suite named *suitename* containing the test in *filename*.
*/
function addSuiteFromFile(suitename, filename);

/* Starting at directory (under baseDirectory), attempt to add each
   subdirectory as a suite of functional tests. 
   Tests are files whose filename ends with Test.js,
   and a suite is any directory containing tests.
*/
function addSuitesFromDirectory(directory);
```

### Disabling tests
```JavaScript
/* In file testFileName in suite suiteName,
   disable all tests matching testNamePattern (which must be a RegExp)
*/
function disableTest(suiteName, testFileName, testNamePattern);


/* Specify disabled tests in a file.
   The file is a JavaScript source file read using require().
   It should export a single function which calls driver.disableTest()
   for each test to be disabled.
*/
function disableTestsFromFile(directoryName, fileName);
```


### Creating Lint Tests
```JavaScript
/* Create a suite called "lint" consisting of LintTests for each JavaScript 
   source file in directory.  If directory is unrooted, it is interpreted 
   relative to baseDirectory.  Additional arguments are interpreted as pathname
   components beyond directory.
   After the directory name is fully resolved, a LintTest is created for every 
   file in that directory whose name ends in .js and does not begin with a dot.
*/
function addLintTestsForDirectory(directory, ... );

/* Tell the linter to ignore an error in filename, at position
   horizontalPos, matching the message message, and (optionally)
   repeated count times.
*/
function ignoreLint(filename, horizontalPos, message, count);

/* In the jslint options, pass keywordArray as an array of predefined global
   values.
*/
function predefineLint(keywordArray);

```

Standard Command-Line Options
-----------------------------

*  `--help` / `-h`        print this message
*  `--debug` / `-d`        enable debug output
*  `--detail`            enable detailed debug output
*  `-df <sourcefile>`    enable all debug output from *sourcefile*
*  `--trace` / `-t`        print stack trace from failing tests
*  `--skip-smoke`         do not run SmokeTest
*  `--skip-clear`         do not run ClearSmokeTest
*  `--timeout <msec>`     set timeout in msec.
*  `--quiet` / `-q`         do not print individual test results
*  `--failed` / `-f`        suppress passed tests, print failures only
*  `--suite <suite>`      only run the named suite
*  `--suites <suite,suite,...>` only run the named suites
*  `--test <testFile>`     only run the named test file
*  `--case <n,m,...>`      only run test cases numbered n, m, etc. in *testFile*



