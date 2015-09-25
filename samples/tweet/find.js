/* This script shows an example find() operation using a table name and 
   primary key, and working with promises.

   For a similar example using callbacks rather than promises, see insert.js
*/

"use strict";
var jones = require("database-jones");

/*  new ConnectionProperties(adapter, deployment)

    The first argument names a database backend, e.g. "ndb", "mysql", etc.

    The second argument names a "deployment" defined in a jones_deployments.js 
    file.  (A default file can be found two directories up from here).
    jones_deployments.js is the preferred place to customize the host, username, 
    password, and other parameters of the database connection.
*/
var connectionProperties = new jones.ConnectionProperties("mysql", "test");

/* node     find.js     table_name      primary_key_value
   argv[0]  argv[1]     argv[2]         argv[3]             */

if (process.argv.length !== 4) {
  console.err("Usage: node find <table> <key>\n");
  process.exit(1);
}

var table_name = process.argv[2],
    find_key   = process.argv[3],
    session;   // our Jones session


/* This version of openSession() takes one argument and returns a promise.
   The argument is the set of connection properties obtained above.

   Other versions of openSession() can validate table mappings and take
   callbacks; these are documented in database-jones/API-documentation/Jones.
   Once the session is open, use it to find an object.
   find() is a Jones API call that takes a primary key or unique key and,
   on success, returns *only one object*.
*/
jones.openSession(connectionProperties).
  then(function(s) {
    session = s;
    return session.find(table_name, find_key);
  }).
  then(console.log, console.trace).    // log the result or error
  then(function() { if(session) { return session.close(); }}).  // close this session
  then(function() { return jones.closeAllOpenSessionFactories(); }).  // disconnect
  then(process.exit);
