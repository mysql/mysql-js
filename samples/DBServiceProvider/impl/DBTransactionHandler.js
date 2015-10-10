"use strict";

var assert          = require("assert"),
    serial          = 1;


function DBTransactionHandler(dbsession) {
  this.dbSession          = dbsession;
  this.autocommit         = true;
  this.error              = null;
  this.executedOperations = [];  // All finished operations
  this.serial             = serial++;
}

/* setPartitionKey(TableHandler Table, Array partitionKey)
  IMMEDIATE
  
 */
DBTransactionHandler.prototype.setPartitionKey = function (tableHandler, partitionKey) {
};

/* execute(DBOperation[] dbOperationList,
           function(error, DBTransactionHandler) callback)
   ASYNC
   
   Executes the DBOperations in dbOperationList.
   Commits the transaction if autocommit is true.
*/
DBTransactionHandler.prototype.execute = function(dbOperationList, userCallback) {
};


/* commit(function(error, DBTransactionHandler) callback)
   ASYNC 
   
   Commit work.
*/
DBTransactionHandler.prototype.commit = function commit(userCallback) {
};


/* rollback(function(error, DBTransactionHandler) callback)
   ASYNC 
   
   Roll back all previously executed operations.
*/
DBTransactionHandler.prototype.rollback = function rollback(userCallback) {
};

exports.DBTransactionHandler = DBTransactionHandler;

