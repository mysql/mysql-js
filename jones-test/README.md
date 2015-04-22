Jones Test 
==========

Jones-test is an asynchronous test harness for node.js.  For independent tests
that require file or network I/O, it can run many tests at once. It originated
from the "Database Jones" project at  github.com/mysql/mysql-js, where it is
used to run several hundred tests in just a few seconds.


Using Jones Test
----------------

Tests are organized by suites.  Normally, each suite is contained in a directory
under the main test directory.  Suites can contain the following four sorts of
functional tests:

* **SmokeTest**: set up and verify the test environment (create tables, populate
  data in tables, open a connection to the database, etc.).  If a SmokeTest
  fails, then the remaining tests in a suite will not be run.
* **ConcurrentTest**: tests to be run concurrently, using the test setup
  (test schema and test data) and having no side effects (do not insert
  or delete any rows in the database)
* **SerialTest**: tests to be run serially, using the test setup. These tests
  can have side effects, except for changing schema or databases that other
  tests depend on. Tests that change schema should generally be in their own
  test suite.
* **ClearSmokeTest**: tear down the test environment (drop tables, databases)

A functional test is created by using one of the four constructors in the list 
above, and defining a run() method, in a file whose name ends with "Test.js". 

In addition to the functional tests, suites may contain two sorts of static code
analysis tests.
* **LintTest**: tests that run a lint utility, such as jslint, on a project's source 
  files.
* **DocsTest**: tests that verify the methods stated in a documentation file 
  against the methods provided by an implementation object.  The documentation
  may be a JavaScript file, or it may be the JavaScript content within a
  Markdown file. If a documented function is not provided by the implementation,
  the test fails.

### The run() function

Functional tests are either synchronous or asynchronous depending on the 
behavior of the run() function.

Synchronous tests must return true from the run() function. They are
considered to pass if the errorMessages string is empty, and considered 
to fail if the errorMessages string is not empty. An error may be appended
to the errorMessages string by calling the function appendErrorMessage().
A synchronous test that throws an exception is also considered to fail.

Asynchronous tests need not return anything from the run() function and must
not return true. They must call the pass or fail function when they complete.
This can be done explicitly or by using one of the functions declared in Test:

    test.fail('failure message'); // fails with the failure message as the reason
    test.failOnError(); // fails test if the errorMessages string is not empty

Error messages can be appended based on conditions, by using helper
functions, e.g.

    test.errorIfNotEqual(message, object1, object2)

### Exporting tests from test files

Test programs that implement one test can export that test:

    module.exports = test1;

Test programs that implement multiple tests should export the array of tests:

    module.exports.tests = [test1, test2];

