
/* This script provides an example of the Jones Projection API.

   Functionally it is identical to both "node tweet.js get tweets-by <author>"
   and to "node scan.js <author>". It produces a list of tweets by
   a particular user.
   
   However, where scan.js works by using a Query to scan the tweet table,
   join.js works by describing a one-to-many Projection from Author to
   Tweet, and then executing a find() on the Projection.
   
   In Jones, find() only returns a single result. In this case the result is
   an instance of an Author having an array of Tweets.

   Expressed in terms of SQL, scan.js is like "SELECT FROM tweet" using an
   ordered index, while join.js is like "SELECT FROM author" on primary key
   with "JOIN tweet on tweet.author = author.user_name".

   There are two steps to this. First, TableMappings describe the relationships
   of JavaScript objects to the two SQL tables and to each other. Then, a
   Projection describes the desired shape of the result, referring to the mapped
   constructors.
*/

"use strict";
var jones = require("database-jones");

//  see find.js for more information about ConnectionProperties
var connectionProperties = new jones.ConnectionProperties("ndb", "test");

/* Constructors for application objects */
function Tweet() { }

function Author() { }

/* 
  TableMappings describe the structure of the data.
  "new TableMapping(t)" returns a default mapping for table t.
  applyToClass() associates the table with a JavaScript constructor.
  mapManyToOne() & friends take a literal object that describing 
  a relationship to another table.
*/
var authorMapping = new jones.TableMapping("author");
authorMapping.applyToClass(Author);

var tweetMapping = new jones.TableMapping("tweet");
tweetMapping.applyToClass(Tweet);

authorMapping.mapOneToMany(
  { fieldName:  "user_name",      // field in the Author object
    targetField: "author",        // foreign key defined in the SQL DDL
    target:     Tweet             // mapped constructor of relationship target
  });


/* 
   Projections describe the structure to be returned from find().
*/
var tweetProjection = new jones.Projection(Tweet);
var authorProjection = new jones.Projection(Author);
authorProjection.addRelationship("tweets", tweetProjection);


/* This script takes one argument, the user name.  e.g.:
   "node join.js uncle_claudius"
*/
if (process.argv.length !== 3) {
  console.err("Usage: node join.js <user_name>\n");
  process.exit(1);
}
var find_key = process.argv[2];
var session;


/* The rest of this example looks like find.js, only using find() with 
   a projection, rather than a table name.
*/
jones.openSession(connectionProperties).
  then(function(s) {
    session = s;
    return session.find(authorProjection, find_key);
  }).
  then(console.log, console.trace).    // log the result or error
  then(function() { if(session) { return session.close(); }}).  // close this session
  then(function() { return jones.closeAllOpenSessionFactories(); }).  // disconnect
  then(process.exit);

