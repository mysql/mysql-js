"use strict";

var jones = require("database-jones");

/* This script shows an example persist() operation using a table name and
   primary key, and working with callbacks. 
   
   For a similar example using promises rather than callbacks, see find.js
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

/* handleError() exits if "error" is set (closing the session, if needed)
   or simply returns on no error.
*/
function handleError(error) {
  if(error) {
    console.log(error);
    if(session) {
      session.close(function() {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  }
}

/* The "insert" script takes two arguments:
   arg0: "node"
   arg1: "find.js"
   arg2: table name
   arg3: a JSON object
*/
if (process.argv.length !== 4) {
  handleError("Usage: node insert <table> <JSON_object>\n");
}

var table_name = process.argv[2],
    object     = JSON.parse(process.argv[3]);

/* This version of openSession() takes three arguments:
     ConnectionProperties
     A table name, which will be validated upon connecting
     A callback
   (Compare vs. the one-argument openSession() in find.js)
*/
jones.openSession(connectionProperties, table_name, function(err, s) {
  handleError(err);
  session = s;

  /* The callback to persist() only gets one argument */
  session.persist(table_name, object, function(err) {
    handleError(err);
    console.log("Inserted: ", object);

    /* Finally close the session */
    session.close(function() {
      process.exit(0);
    });
  });
});

