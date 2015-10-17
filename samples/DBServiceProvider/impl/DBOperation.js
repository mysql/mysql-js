"use strict";

/* Standard representation of errors
*/
function DBOperationError() {
  this.sqlstate  = null;    // Standardized error; see API-documentation/Errors
  this.message   = null;    // User-friendly error message string
  this.cause     = null;    // Optional, backend-specific error
}

DBOperationError.prototype.fromSqlState = function(state) {
  var msgForState = {
    "0A000" : "Operation not supported by DBServiceProvider"
  };
  this.sqlstate = state;
  this.message = msgForState[state];
  return this;
};


/* Result of a database operation
*/
function DBResult() {
  this.success   = null;  // boolean indicating whether the operation succeeded
  this.error     = null;  // a DBOperationError object
  this.value     = null;  // Result of the operation
  this.insert_id = null;  // Value of generated fields on insert (e.g. Auto-increment)
}

DBResult.prototype.setError = function(sqlState) {
  this.success = false;
  this.error = new DBOperationError().fromSqlState(sqlState);
};

DBResult.prototype.setValue = function(value) {
  this.success = true;
  this.value = value;
};


/* A DBOperation is an opaque object created and used by the DBServiceProvider.
   It has one required property, result, which should hold a DBOperationResult.
   Other properties may be defined by the DBServiceProvider.
*/
function DBOperation () {
  this.result        = new DBResult(); // will hold the operation result
  this.key           = null;
}

DBOperation.prototype.assign = function(tableHandler, transaction, callback) {
  this.tableHandler  = tableHandler;
  this.tx            = transaction;
  this.callback      = callback;
};

DBOperation.prototype.insert = function(tableHandler, row, transaction, callback) {
  this.assign(tableHandler, transaction, callback);
  this.value         = row;
  this.execute       = this.executeInsert;
  return this;
};

DBOperation.prototype.write = function(dbIndexHandler, row, transaction, callback) {
  this.assign(dbIndexHandler.tableHandler, transaction, callback);
  this.index         = dbIndexHandler;
  this.value         = row;
  this.execute       = this.executeWrite;
  return this;
};

DBOperation.prototype.read = function(dbIndexHandler, keys, transaction, callback) {
  this.assign(dbIndexHandler.tableHandler, transaction, callback);
  this.index         = dbIndexHandler;
  this.key           = keys;
  this.lockMode      = "SHARED";
  this.execute       = this.executeRead;
  return this;
};

DBOperation.prototype.readProjection = function(dbIndexHandler, keys, values,
                                                transaction, callback) {
  this.assign(dbIndexHandler.tableHandler, transaction, callback);
  this.index         = dbIndexHandler;
  this.key           = keys;
  this.params        = values;
  this.execute       = this.executeReadProjection;
  return this;
};

DBOperation.prototype.scan = function(queryHandler, params, transaction, callback) {
  this.assign(queryHandler.dbTableHandler, transaction, callback);
  this.query         = queryHandler;
  this.params        = params;
  this.execute       = this.executeScan;
  return this;
};

DBOperation.prototype.remove = function(dbIndexHandler, keys, transaction, callback) {
  this.assign(dbIndexHandler.tableHandler, transaction, callback);
  this.index         = dbIndexHandler;
  this.key           = keys;
  this.execute       = this.executeRemove;
  return this;
};

DBOperation.prototype.getTransactionHandler = function() {
  return this.tx;
};


/* This function would only ever be called if someone were attempting
   to execute a DBOperation without first defining a valid execute
   method for it.  This would be a bug in the DBServiceProvider,
   so we throw an exception.
*/
DBOperation.prototype.executeUndefined = function() {
  throw new Error("Illegal call to DBOperation.executeUndefined");
};

DBOperation.prototype.execute = DBOperation.prototype.executeUndefined;


/* Execute functions for specific operations.
   Implementation code goes here.
*/

DBOperation.prototype.executeInsert = function(commitFlag, userCallback) {
  this.result.setError("0A000");   // not supported
  userCallback(this.result.error, this.result);
};

DBOperation.prototype.executeWrite = function(commitFlag, userCallback) {
  this.result.setError("0A000");   // not supported
  userCallback(this.result.error, this.result);
};

DBOperation.prototype.executeRead = function(commitFlag, userCallback) {
  this.result.setError("0A000");   // not supported
  userCallback(this.result.error, this.result);
};

DBOperation.prototype.executeReadProjection = function(commitFlag, userCallback) {
  this.result.setError("0A000");   // not supported
  userCallback(this.result.error, this.result);
};

DBOperation.prototype.executeScan = function(commitFlag, userCallback) {
  this.result.setError("0A000");   // not supported
  userCallback(this.result.error, this.result);
};

DBOperation.prototype.executeRemove = function(commitFlag, userCallback) {
  this.result.setError("0A000");   // not supported
  userCallback(this.result.error, this.result);
};


exports.DBOperation = DBOperation;
exports.DBOperationError = DBOperationError;
