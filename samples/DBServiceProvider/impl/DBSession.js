"use strict";

var assert               = require("assert"),
    unified_debug        = require("unified_debug"),
    udebug               = unified_debug.getLogger("DBSession.js"),
    DBOperation          = require("./DBOperation").DBOperation,
    DBTransactionHandler = require("./DBTransactionHandler");


/** 
  A session has a single transaction visible to the user at any time,
  which is created in DbSession.getTransactionHandler() and persists
  until the user initiates a commit or rollback of the transaction.
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
  this.detachTransaction();
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
    udebug.log("Read", dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  return new DBOperation().read(dbIndexHandler, keys, tx, callback);
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
  return new DBOperation().insert(tableHandler, row, tx, callback);
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
    udebug.log("Write to", dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  return new DBOperation().write(dbIndexHandler, row, tx, callback);
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
                                                    keys, row, tx, callback) {
  if(udebug.is_debug()) {
    udebug.log("Update", dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  return new DBOperation().update(dbIndexHandler, keys, row, tx, callback);
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
    udebug.log("Delete from", dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  return new DBOperation().remove(dbIndexHandler, keys, tx, callback);
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
  return new DBOperation().scan(queryHandler, properties, tx, callback);
};


/* buildReadProjectionOperation
   IMMEDIATE
*/
DBSession.prototype.buildReadProjectionOperation = function(dbIndexHandler,
                                                            keys, projection,
                                                            tx, callback) {
  if(udebug.is_debug()) {
    udebug.log("Projection Read from", dbIndexHandler.tableHandler.dbTable.name,
               "using", dbIndexHandler.dbIndex.name);
  }
  return new DBOperation().readProjection(dbIndexHandler,
                                          keys, projection,
                                          tx, callback);
};


/* getTransactionHandler() 
   IMMEDIATE
   
   RETURNS the current transaction handler, creating it if necessary
*/
DBSession.prototype.getTransactionHandler = function() {
  if(! this.transactionHandler) {
    this.transactionHandler = new DBTransactionHandler(this);
  }
  return this.trasactionHandler;
};


/* detachTransaction()
   IMMEDIATE

   Detaches a transaction from the session that created it.
   The user has initiated commit or rollback of the transaction.
   The transaction itself still exists and may have active callbacks,
   but the session is now free from it and able to begin another.
*/
DBSession.prototype.detachTransaction = function() {
  this.transactionHandler = null;
};


/* begin() 
   IMMEDIATE
*/
DBSession.prototype.begin = function() {
  return this.getTransactionHandler().begin();
};


/* commit(callback) 
   ASYNC
   
   Commit a user transaction.
   Callback is optional; if supplied, will receive (err).
*/
DBSession.prototype.commit = function(userCallback) {
  var tx = this.transactionHandler;
  this.detachTransaction();
  return tx.commit(userCallback);
};


/* rollback(callback) 
   ASYNC
   
   Roll back a user transaction.
   Callback is optional; if supplied, will receive (err).
*/
DBSession.prototype.rollback = function (userCallback) {
  var tx = this.transactionHandler;
  this.detachTransaction();
  return tx.rollback(userCallback);
};


module.exports = DBSession;
