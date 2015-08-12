Test
====

Functional Tests
----------------

There are four varieties of functional tests.

```JavaScript
/* SmokeTest: set up and verify the environment for a test suite.
  If a SmokeTest fails, or is skipped by calling skip(), then 
  the remaining Serial and Concurrent tests in a suite will not be run;
  They will be accounted as not started and as skipped.
*/
function SmokeTest(name);

/* Tear down the suite's test environment.
*/
function ClearSmokeTest(name);

/* SerialTest: tests to be run serially, using the test setup. These tests
  can have side effects, except for changing schema or databases that other
  tests depend on. Tests that change schema should generally be in their own
  test suite.
*/
function SerialTest(name);

/* ConcurrentTest: tests to be run concurrently, using the test setup
   and having no side effects which might effect other concurrently running 
   tests (such as inserting or deleting database records).  
*/
function ConcurrentTest(name);
```

Create a test case from its constructor, then define its *run()* method.
If a test runs synchronously (i.e. entirely within its run() function),
*run()* must return true. Here is a synchronous example:

    var t1 = new ConcurrentTest("Synchronous Example Test");
    t1.run = function() {
      var x = getUserError();
      if(x) this.appendErrorMessage(x);
      return true;
    };

If *run()* does not return true, the test is assumed to be async, and the
framework will wait for a report.  The driver will assume that the test 
continues to run until the user calls one of *fail()*, *pass()*, *skip()*,
or *failOnError()*.

    var t2 = new ConcurrentTest("Async Example Test");
    t2.run = function() {
      getUserErrorAsync(function(error) {
        // You cannot use "this", but note closure over t2
        t2.errorIfNotNull("User Error", error);
        t2.failOnError();
      });
      // no defined return value from run()
    };

### Test Methods 

These methods are common to SmokeTest, ConcurrentTest, SerialTest, and ClearSmokeTest


```JavaScript
/*  Append an error message to the current test result.
    This causes the test to fail.
*/
function appendErrorMessage(message);


////////
/// FUNCTIONS THAT CAUSE ASYNCHRONOUS TESTS TO END.
///////

/* If a test is async (i.e. if its run() function did not return the value true),
   then the driver will assume it continues to run until the user calls one 
   of these four functions.
*/

/* Pass this test.
*/
function pass();

/* Report errorMessage as an error and fail this test.
*/
function fail(errorMessage);

/* Skip this test.
   The test will be reported as started and then skipped. 
*/
function skip();

/* Fail the test if any errors have been reported; otherwise pass.
*/
function failOnError();

////////
/// CONDITIONAL TEST FUNCTIONS FOR TEST CASES:
///////

/* Compare o1 to o2.  If the two values are not equal, fail the test using 
   the error in <errorMssage>.
   The comparison algorithm used is:
      if(o1 == o2), return true.
      if o1 and o2 are both null, return true.
      if o1 and o2 are both undefined, return true.
      if typeof 01 === typeof o2, and o1.toString() === o2.toString(), return true.
      Otherwise return false.
*/
function errorIfNotEqual(errorMessage, o1, o2); 

/* Fail test with errorMessage if(o1 !== o2)
*/
function errorIfNotStringEqual(errorMessage, o1, o2);

/* Fail test with errorMessage if o1 is "truthy"
*/
function errorIfTrue(errorMessage, val);

/* Fail test with errorMessage if val is not strictly true,
   i.e. if(val !== true)
*/
function errorIfNotTrue(errorMessage, val);

/* Fail test with errorMessage in case of strict comparison (val === null).
*/
function errorIfNull(errorMessage, val);

/* Fail test with errorMessage in case of strict comparison (val !== null).
*/
function errorIfNotNull(errorMessage, val);

/* val is the first argument of a typical node callback: it is expected to
   be null or undefined on success, and to itself contain an error message 
   on failure.  If(val !== undefined && val !== null), fail the test using
   the error contained in val itself.
*/
function errorIfError(val);

/* val is expected to contain an error object. 
   If it does not, fail the test using errorMessage.
   In implementation, val is tested for falsiness, i.e. if(! val)
*/
function errorIfNotError(errorMessage, val);

/* Like errorIfError(), errorIfUnset() tests (val !== undefined && val !== null).
   However errorIfUnset() uses the user-supplied error message rather than 
   val itself.
*/
function errorIfUnset(errorMessage, val);

/* value must be of type 'number' and must be strictly less than cmp.
   Otherwise fail with errorMessage
*/
function errorIfLessThan(errorMessage, cmp, val);

/* value must be of type 'number' and must be strictly greater than cmp.
   Otherwise fail with errorMessage
*/
function errorIfGreaterThan(errorMessage, cmp, val);


////////
/// INTROSPECTION OF TEST RESULTS
///////

/* Returns true if a test has no errors; 
   false if errors have been set.
*/
function hasNoErrors();


////////
/// TEST CASE CALLBACKS
///////

/*  Once the user has ended an async test, using one of the four completion
    functions, the driver will call onComplete() if it has been defined.
*/
function onComplete();
```


Static Tests
------------

### Lint Tests


A LintTest is a test that runs JSLint against a source file.
JSLint is not treated as a dependency; if a usable jslint implementation
is not available in the user's environment, then the LintSmokeTest will
cause lint tests to be skipped.

LintTests are created using *Driver.addLintTestsForDirectory()*.


### Documentation Tests

DocsTests compare a documentation file such as this one against an 
actual JavaScript object.
If a documented method exists where the supplied object does not 
provide a function of the same name, the test fails.
Optionally, if the object supplies functions that are not documented, 
the test may fail.

Unlike functional tests, DocsTests are run by the test framework; the user
may not supply a run() method for them.

```JavaScript 
/* Create a DocsTest for the documentation file docFileName.
   <docFileName> is a pathname relative to the baseDirectory of the Test Driver.
*/
function DocsTest(docFileName);

// DocsTest methods:

/* Test the documentation provided for className against the actual JavaScript
   object testObject.  If undocFlag is set to true, also test for 
   functions that are provided by testObject but missing from the documentation.
*/
function addTestObject(testObject, className, undocFlag);


```
