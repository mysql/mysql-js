Database Jones
==============

Introduction
------------
This package provides a fast, easy, and safe framework for building 
database applications in Node.js.  It is organized around the concept
of a database *session*, which allows standard JavaScript objects to be
read from and written to a database.

This example uses a session to store a single object into an existing MySQL table:
```
var jones = require("database-jones");

var connectionProperties = new jones.ConnectionProperties("mysql");

jones.openSession(connectionProperties).then(
  function(session) {
    var user = { id: 1, name: "Database Jones"};
    return session.persist("user", user);
  }
).then(
  function success() { 
    console.log("Complete");
    jones.closeAllOpenSessionFactories();
  },
  function failure(error) { 
    console.log("Error", error);l
  }
);
```

Key features include:

+ Simple API for create, read, update, delete
+ Bulk operations for high performance
+ Support for ACID transactions, both explicit and implicit
+ Flexible mapping from JavaScript objects to relational tables
+ A fluent Query language using domain model tokens
+ Default mapping of a relational table to a simple object 
+ Complex mapping of relational tables to complex objects
+ Asynchronous API using well-known node.js callback patterns
+ Promises/A+, allowing easier management of callbacks
+ Connection pooling, allowing in-process scale up

Quick Install
-------------
The whole project can be used directly from a clone of github if *core.symlinks* 
is set to true.
```
git config --add core.symlinks true
git clone http://github.com/mysql/mysql-js
```

More information
----------------
See the complete README.md file under [database-jones](database-jones/README.md)


Directory Structure
-------------------


* database-jones

  Lightweight object mapping layer for SQL and NoSQL databases.  
  
* jones-mysql

  Jones adapter for MySQL.  Licensed GPL v2.  Requires node-mysql.
  
* jones-ndb

  Native Jones adapter for MySQL Cluster.  Licensed GPL v2. 
  Uses the low-level NDBAPI for data operations, but requires jones-mysql
  for certain metadata operations such as creating tables.

* jones-test

  A high-performance stand-alone test harness.  Jones-test is able to manage
  concurrent and serial tests, run hundreds of tests per second, and run 
  combined test suites from several projects (for instance, running both 
  the common database-jones tests and the jones-mysql specific tests all
  from a single test driver).   
  
* jones-promises

  An implementation of Promises/A+ used by database-jones. 
  
* unified\_debug 

  A printf-style debug library providing a single diagnostic 
  environment for both C and JavaScript. 

* perftest

  Contains jscrund, a simple benchmarking tool for Jones.
  
* loader

  A data loader implemented as a Jones application

* samples 

  Sample code using Jones

* shell

  A database command shell based on Jones


