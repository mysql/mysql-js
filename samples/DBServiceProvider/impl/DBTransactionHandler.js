"use strict";

var assert           = require("assert"),
    DBOperationError = require("./DBOperation").DBOperationError,
    serial           = 1;


function DBTransactionHandler(dbsession) {
  this.dbSession          = dbsession;
  this.autocommit         = true;
  this.error              = null;
  this.executedOperations = [];  // All finished operations
  this.serial             = serial++;
}


DBTransactionHandler.prototype.setErrorFromOperation = function(op) {
  if(op.result.error) {
    this.error = new DBOperationError();
    this.error.sqlstate = op.result.error.sqlstate;
    this.error.message  = op.result.error.message;
    this.error.cause    = op.result.error;
  }
};


/* setPartitionKey(TableHandler Table, Array partitionKey)
  IMMEDIATE
 */
DBTransactionHandler.prototype.setPartitionKey = function (tableHandler, partitionKey) {
};


DBTransactionHandler.prototype.begin = function() {
  assert.equal(this.autocommit, true);
  this.autocommit = false;
};


/* execute(DBOperation[] dbOperationList,
           function(error, DBTransactionHandler) callback)
   ASYNC
   
   Executes the DBOperations in dbOperationList.
   Commits the transaction if autocommit is true.
*/
DBTransactionHandler.prototype.execute = function(dbOperationList, userCallback) {
  var nOperations, tx;
  tx = this;
  nOperations = dbOperationList.length;

  if(this.autocommit) {
    this.dbSession.detachTransaction();
  }

  dbOperationList.forEach(function(op) {
    op.execute(tx.autocommit, function() {
      tx.executedOperations.push(op);
      tx.setErrorFromOperation(op);
      if(--nOperations === 0) {
        userCallback(tx.error, tx);
      }
    });
  });
};


/* commit(function(error, DBTransactionHandler) callback)
   ASYNC 
   
   Commit work.
*/
DBTransactionHandler.prototype.commit = function commit(userCallback) {
  userCallback(new DBOperationError().fromSqlState("0A000"));
};


/* rollback(function(error, DBTransactionHandler) callback)
   ASYNC 
   
   Roll back all previously executed operations.
*/
DBTransactionHandler.prototype.rollback = function rollback(userCallback) {
  userCallback(new DBOperationError().fromSqlState("0A000"));
};


exports.DBTransactionHandler = DBTransactionHandler;

