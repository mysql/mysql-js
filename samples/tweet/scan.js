/* This script provides an example of the Jones Query API. */

"use strict";

var jones = require("database-jones");
// require("unified_debug").level_detail();

//  see find.js for more information about ConnectionProperties
var connectionProperties = new jones.ConnectionProperties("ndb", "test");

var session;            // our Jones session
var p1, p2;             // some promises

function processExit() {
  process.exit(0);
}

function handleError(error) {
  console.log("Error", error);
  if(session) {
    session.close().then(function() { process.exit(1); });
  } else {
    process.exit(1);
  }
}

/* By default, we will query the "tweet" table */
var queryTable = process.argv[2] || "tweet";

//  Use the promise from openSession(), as in find.js:
jones.openSession(connectionProperties).
  then(function(s) {
    session = s;
    return session.createQuery(queryTable);
  }).
  then(function(query) {
    /* Here we can define query conditions.  If no conditions are defined,
       the query will execute as a full table scan.
       For more details see API-documentation/Query
    */
    // query.where(query.tweets.lt(10));   // users with less than 10 tweets
    // query.where(query.user_name.gt("m"));  // second half of alphabet

    // var params = { "skip" : 0 , "a" : 1 };   // parameters used to execute the query
    var params = {};

    /* Then execute the query  */
    return query.execute(params);
  }).
  then(function(resultsArray) {
    console.log("a", resultsArray);
    return session.close();
  }).
  then(processExit, handleError);
