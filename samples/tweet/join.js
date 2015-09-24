"use strict";

var jones = require("database-jones");

//  see find.js for more information about ConnectionProperties
var connectionProperties = new jones.ConnectionProperties("ndb", "test");

/* Here are some constructors for application objects */
function Tweet() { }

function Author() { }

/* 
 "new TableMapping(t)" returns a default mapping for a table.
  applyToClass() associates the table with a JavaScript constructor.
  mapManyToOne() & friends take a literal object that describing 
  a relationship to another table.
*/
var tweetMapping = new jones.TableMapping("tweet");
tweetMapping.applyToClass(Tweet);

var authorMapping = new jones.TableMapping("author");
authorMapping.applyToClass(Hashtag);

authorMapping.mapOneToMany(
  { fieldName:  "tweets",        // field in the Hashtag object
    foreignKey: "author_fk",     // foreign key defined in the SQL DDL
    target:     Tweet            // mapped constructor of relationship target
  });


/* This script takes one argument, the user name.  e.g.:
   "node join.js uncle_claudius"
*/
if (process.argv.length !== 3) {
  handleError("Usage: node join.js <user_name>\n");
};
var find_key   = process.argv[2];


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




