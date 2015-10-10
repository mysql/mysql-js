"use strict";


var assert          = require("assert"),
    unified_debug   = require("unified_debug"),
    udebug          = unified_debug.getLogger("DBSession.js");


/** 
  A session has a single transaction visible to the user at any time,
  which is created in DbSession.getTransactionHandler() and persists
  until the user performs an execute commit or rollback.
*/


/* DBSession Constructor. Undocumented - private to DBConnectionPool.
*/
function DBSession(pool) {
  this.parentPool            = pool;
  this.transactionHandler    = null;
}



/*  getConnectionPool() 
    IMMEDIATE
    RETURNS the DBConnectionPool from which this DBSession was created.
*/
DBSession.prototype.getConnectionPool = function() {
  return this.parentPool;
};


/* close() 
   ASYNC. Optional callback.
*/
DBSession.prototype.close = function(callback) {
  udebug.log("close");
  this.parentPool.closeDbSession(this, callback);
};


/* buildReadOperation(DBIndexHandler dbIndexHandler, 
                      Object keys,
                      DBTransactionHandler transaction,
                      function(error, DBOperation) userCallback)
   IMMEDIATE
   Define an operation which when executed will fetch a row.

   RETURNS a DBOperation 
*/
DBSession.prototype.buildReadOperation = function(dbIndexHandler, keys,
                                                   tx, callback) {
  if(udebug.is_debug()) {
    udebug.log("Read",
               dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  var op = {};    // this function should create and return a DBOperation
  return op;
};


/* buildInsertOperation(DBTableHandler tableHandler, 
                        Object row,
                        DBTransactionHandler transaction,
                        function(error, DBOperation) userCallback)
   IMMEDIATE
   Define an operation which when executed will insert a row.
 
   RETURNS a DBOperation 
*/
DBSession.prototype.buildInsertOperation = function(tableHandler, row,
                                                    tx, callback) {
  assert.equal(typeof row, "object");
  if(udebug.is_debug()) {
    udebug.log("Insert into", tableHandler.dbTable.name);
  }
  var op = {};    // this function should create and return a DBOperation
  return op;
};


/* buildWriteOperation(DBIndexHandler dbIndexHandler, 
                       Object row,
                       DBTransactionHandler transaction,
                       function(error, DBOperation) userCallback)
   IMMEDIATE
   Define an operation which when executed will update or insert
 
   RETURNS a DBOperation 
*/
DBSession.prototype.buildWriteOperation = function(dbIndexHandler, row, 
                                                    tx, callback) {
  if(udebug.is_debug()) {
    udebug.log("Write to",
               dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  var op = {};    // this function should create and return a DBOperation
  return op;
};


/* buildUpdateOperation(DBIndexHandler dbIndexHandler,
                        Object keys, 
                        Object values,
                        DBTransactionHandler transaction,
                        function(error, DBOperation) userCallback)
   IMMEDIATE
   Define an operation which when executed will access a row using the keys
   object and update the values provided in the values object.
  
   RETURNS a DBOperation 
*/
DBSession.prototype.buildUpdateOperation = function(dbIndexHandler, 
                                                     keys, row, tx, userData) {
  if(udebug.is_debug()) {
    udebug.log("Update",
               dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  var op = {};    // this function should create and return a DBOperation
  return op;
};


/* buildDeleteOperation(DBIndexHandler dbIndexHandler, 
                        Object keys,
                        DBTransactionHandler transaction,
                        function(error, DBOperation) userCallback)
   IMMEDIATE 
   Define an operation which when executed will delete a row
 
   RETURNS a DBOperation 
*/  
DBSession.prototype.buildDeleteOperation = function(dbIndexHandler, keys,
                                                     tx, callback) {
  if(udebug.is_debug()) {
    udebug.log("Delete from",
               dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  var op = {};    // this function should create and return a DBOperation
  return op;
};

/* buildScanOperation(QueryHandler queryHandler,
                      Object properties,
                      DBTransactionHandler transaction,
                      function(error, result) userCallback)
   IMMEDIATE
*/
DBSession.prototype.buildScanOperation = function(queryHandler, properties, 
                                                   tx, callback) {
  udebug.log("buildScanOperation");
  var op = {};    // this function should create and return a DBOperation
  return op;
};

/* buildReadProjectionOperation
   IMMEDIATE
*/
DBSession.prototype.buildReadProjectionOperation = function(dbIndexHandler,
                                            keys, projection, tx, callback) {
  if(udebug.is_debug()) {
    udebug.log("Projection Read from",
               dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  var op = {};    // this function should create and return a DBOperation
  return op;
};


/* getTransactionHandler() 
   IMMEDIATE
   
   RETURNS the current transaction handler, creating it if necessary
*/
DBSession.prototype.getTransactionHandler = function() {
  // return this.trasactionHandler;
};


/* begin() 
   IMMEDIATE
   
   Begin a user transaction context; exit autocommit mode.
*/
DBSession.prototype.begin = function() {
  var tx = this.getTransactionHandler();
  assert(tx.executedOperations.length === 0);
};


/* commit(callback) 
   ASYNC
   
   Commit a user transaction.
   Callback is optional; if supplied, will receive (err).
*/
DBSession.prototype.commit = function(userCallback) {
  this.trasactionHandler.commit(userCallback);
};


/* rollback(callback) 
   ASYNC
   
   Roll back a user transaction.
   Callback is optional; if supplied, will receive (err).
*/
DBSession.prototype.rollback = function (userCallback) {
  this.trasactionHandler.rollback(userCallback);
};


exports.DBSession = DBSession;
