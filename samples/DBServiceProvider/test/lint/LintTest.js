
"use strict";

var tests = [ new harness.LintSmokeTest() ];

function more(more_tests) {
  Array.prototype.push.apply(tests, more_tests);
}

/*
 * Run lint tests on the impl/ directory
 */
more(harness.getLintTestsForDirectory(this_module.fs.impl_dir));

/* ignoreLint(filename, column, error message */
// harness.ignoreLint("NdbOperation.js", 22, "Use the array literal notation");

module.exports.tests = tests;
