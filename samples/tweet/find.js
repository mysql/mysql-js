"use strict";

var jones = require("database-jones");


/* This script shows an example find() operation using a table name and 
   primary key, and working with promises.

   For a similar example using callbacks rather than promises, see the
   insert.js example.
*/


/*  new ConnectionProperties(adapter, deployment)

    The first argument names a database backend, e.g. "ndb", "mysql", etc.

    The second argument names a "deployment" as defined in the file
    jones_deployments.js (found two directories up from this one).  The 
    preferred way to customize the host, username, password, schema, etc., 
    used for the database connection is to edit the deployments file.
*/
var connectionProperties =
  new jones.ConnectionProperties("ndb", "test");

var session;   // our Jones session

var p1, p2, p3, p4;    // some promises returned by Jones API calls

function handleError(error) {
  console.log(error);
  if(session) {
    session.close().then(function() { process.exit(1); });
  } else {
    process.exit(1);
  }
}

/* The "find" script takes two arguments:
   arg0: "node"
   arg1: "find.js"
   arg2: table name
   arg3: primary key value
*/
if (process.argv.length !== 4) {
  handleError("Usage: node find <table> <key>\n");
};

var table_name = process.argv[2],
    find_key   = process.argv[3];


/* This version of openSession() takes one argument and returns a promise.
   The argument is the set of connection properties obtained above.

   Other versions of openSession() can validate table mappings and take
   callbacks; these are documented in database-jones/API-documentation/Jones.
*/
p1 = jones.openSession(connectionProperties);


/* Here is the function that will display a result after it has been read.
*/
function displayResult(object) {
  console.log('Found: ' + JSON.stringify(object));
  return session.close();  // returns a promise
}


/* Once the session is open, use it to find an object.
   find() is a Jones API call that takes a primary key or unique key and,
   on success, returns *only one object*.
*/
p2 = p1.then(function(s) {
  session = s;
  p3 = session.find(table_name, find_key);
  p4 = p3.then(displayResult, handleError);
  p4.then(function() { process.exit(0); });   // success
});




