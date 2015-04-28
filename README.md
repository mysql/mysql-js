* database-jones
  Lightweight object mapping layer for SQL and NoSQL databases.  
  
* jones-mysql
  Jones adapter for MySQL.  Licensed GPL v2.  Requires node-mysql.
  
* jones-ndb
  Native Jones adapater for MySQL Cluster.  Licensed GPL v2. 
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

  
  
