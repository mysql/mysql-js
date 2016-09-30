/*
 Copyright (c) 2014, Oracle and/or its affiliates. All rights
 reserved.
 
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation; version 2 of
 the License.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 02110-1301  USA
 */

"use strict";

var stats = {
	"execute"   : { "commit": 0, "no_commit" : 0},
	"closed"    : 0,
	"commit"    : 0,
	"rollback"  : 0
};

var jones         = require("database-jones"),
    unified_debug = require("unified_debug"),
    udebug        = unified_debug.getLogger("SQLTransactionHandler.js"),
    stats_module  = require(jones.api.stats);

stats_module.register(stats, "spi", "SQLTransactionHandler");


/**
 * TransactionHandler is responsible for executing operations that were defined
 * via DBSession.buildXXXOperation. UserContext is responsible for creating the
 * operations and for calling TransactionHandler.execute when they are ready for execution.
 * 
 * A batch of operations is executed in sequence. Each batch is defined by a closure
 * which contains an operationsList and a callback. The callback is the function
 * that is to be called once all operations in the operationsList have been completely
 * executed including the user callback for each operation.
 * 
 * The list of closures is contained in the pendingBatches list. If the pendingBatches list
 * is non-empty at the time execute is called, a batch closure is created with the parameters
 * to the execute function (operationsList and executionCompleteCallback) and the closure is
 * pushed onto the pendingBatches list. In the fullness of time, the operations will be executed
 * and the callback will be called.
 * 
 * Within the execution of a single batch as defined by execute, each operation is executed
 * in sequence. With AbortOnError set to true, an error returned by any operation aborts the
 * transaction. This implies that a failure to insert a row due to duplicate key exception,
 * or a failure to delete a row due to row not found will fail the transaction. This is the only
 * implementable strategy for dealing with the mysql server due to the error handling at the
 * server. The server will decide to roll back a transaction on certain errors, but will not
 * notify the client that it has done so. The client will behave as if operations that succeeded
 * will be effective upon commit, but in fact, some operations that succeeded will be rolled back
 * if a subsequent operation fails. Therefore, AbortOnError is the only strategy that will detect
 * errors and report them to the user.
 * 
 * The implementation strategy involves keeping track for each transaction if there has been an error
 * reported, and returning an error on all subsequent operations. This is accomplished by setting
 * RollbackOnly on failed transactions, and keeping track of the error that caused the RollbackOnly
 * status to be set. Since users can also call setRollbackOnly, a different Error object is created
 * that indicates UserError. For errors reported by the mysql adapter, the original Error is
 * reported to the operation that caused it, and a different TransactionRolledBackError error
 * that includes the original error is created and reported to subsequent operations as well as
 * to the transaction.execute callback.
 * 
 * Errors reported in the transaction callback contain the cause of the transaction error. A member
 * property of error, cause, is introduced to contain the underlying cause. A transaction error
 * caused by a duplicate key error on insert will contain the DBOperationError as the cause.
 */

function TransactionRolledBackError(err) {
  this.cause = err;
  this.sqlstate = 'HY000';
  this.message = 'Transaction was aborted due to operation failure. See this.cause for underlying error.';
}


function SQLTransactionHandler(dbSession, sqlSocket, autocommit) {
  udebug.log('new TransactionHandler');

  this.dbSession                  = dbSession;
  this.sqlSocket                  = sqlSocket;
  this.autocommit                 = autocommit;
  this.firstTime                  = ! autocommit;
  this.numberOfOperations         = 0;
  this.currentOperation           = 0;
  this.operationsList             = null;
  this.executedOperations         = [];
  this.pendingBatches             = [];
  this.isCommitting               = false;
  this.transactionExecuteCallback = null;
}

SQLTransactionHandler.prototype.executeOperations = function() {
  var transactionHandler = this;

  this.isCommitting = false;
  this.numberOfOperations = this.operationsList.length;
  udebug.log('executeOperations numberOfOperations: ', this.numberOfOperations);

  // execute the first operation; the operationCompleteCallback will execute each successive operation
  this.currentOperation = 0;
  this.operationsList[0].execute(this.sqlSocket, function(op) {
    transactionHandler.operationCompleteCallback(op);
  });
};

SQLTransactionHandler.prototype.execute = function(operationsList, transactionExecuteCallback) {
  var transactionHandler = this;
  
  function executeOnBegin(err) {
    if (err) {
      transactionHandler.transactionExecuteCallback(err);
    }
    transactionHandler.firstTime = false;
    transactionHandler.executeOperations();
  }

  // execute begin operation the first time for non-autocommit
  if (this.firstTime) {
    stats.execute.no_commit++;
    this.operationsList = operationsList;
    this.transactionExecuteCallback = transactionExecuteCallback;
    this.begin(executeOnBegin);
  } else {
    stats.execute.commit++;
    if (this.numberOfOperations > 0) {
      // there are pending batches, so just put this request on the list
      this.pendingBatches.push(
          {list: operationsList, 
           callback: transactionExecuteCallback
          });
    } else {
      // this is the first (only) so execute it now
      this.operationsList = operationsList;
      this.transactionExecuteCallback = transactionExecuteCallback;
      this.executeOperations();
    }
  }
};

SQLTransactionHandler.prototype.close = function() {
  stats.closed++;
};

SQLTransactionHandler.prototype.batchComplete = function() {
  var nextBatch;

  if (typeof(this.transactionExecuteCallback) === 'function') {
    this.transactionExecuteCallback(this.error, this);
  } 

  // reset executedOperations if the transaction execute callback did not pop them
  this.executedOperations = [];
  // reset number of operations (after callbacks are done)
  this.numberOfOperations = 0;
  // if we committed the transaction, tell dbSession we are gone
  if (this.isCommitting) {

//HELP ME!
    this.dbSession.transactionHandler = null;
//HELP ME!

  }
  // see if there are any pending batches to execute
  // each pending batch consists of an operation list and a callback
  if (this.pendingBatches.length !== 0) {
    // remove the first pending batch from the list (FIFO)
    nextBatch = this.pendingBatches.shift();
    this.operationsList = nextBatch.list;
    this.transactionExecuteCallback = nextBatch.callback;
    delete this.error;
    this.executeOperations();
  }
};

SQLTransactionHandler.prototype.operationCompleteCallback = function(completedOperation) {
  var transactionHandler = this;
  var complete, operation;

  udebug.log("operationCompleteCallback", completedOperation.type);
  // analyze the completed operation to see if it had an error
  if (completedOperation.result.error) {
    // this is AbortOnError behavior
    // propagate the error to the transaction object
    this.error = new TransactionRolledBackError(completedOperation.result.error);
  }
  this.executedOperations.push(completedOperation);
  complete = this.executedOperations.length;
  udebug.log_detail("Completed", complete, "of", this.numberOfOperations);
  if (complete === this.numberOfOperations) {
    this.batchComplete();
  } else {
    // there are more operations to execute in this batch
    if (this.error) {
      // do not execute the remaining operations, but call their callbacks with the propagated error
      // transactionHandler.currentOperation refers to the current (error) operation
      this.currentOperation++;
      for (this.currentOperation;
          this.currentOperation < this.numberOfOperations;
          this.currentOperation++) {
        udebug.log_detail('error aborting operation ' + this.currentOperation);
        operation = this.operationsList[this.currentOperation];
        operation.result.error = this.error;
        if (typeof(operation.callback) === 'function') {
          operation.callback(this.error, operation);
        }
        this.executedOperations.push(operation);
      }
      // finally, execute the batch complete function
      this.batchComplete();
    } else {
      // execute the next operation in the current batch
      this.currentOperation++;
      this.operationsList[this.currentOperation].execute(this.sqlSocket, function(op) {
        transactionHandler.operationCompleteCallback(op);
      });
    }
  }
};

SQLTransactionHandler.prototype.begin = function(callback) {
  this.sqlSocket.query("begin", callback);
};

SQLTransactionHandler.prototype.commit = function(callback) {
  udebug.log('SQLTransactionHandler.commit.');
  stats.commit++;
  this.autocommit = true;
  this.sqlSocket.query("commit", callback);
};

SQLTransactionHandler.prototype.rollback = function(callback) {
  udebug.log('SQLTransactionHandler.rollback.');
  stats.rollback++;
  this.autocommit = true;
  this.sqlSocket.query("rollback", callback);
};


module.exports = SQLTransactionHandler;

