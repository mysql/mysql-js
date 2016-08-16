/*
 Copyright (c) 2012, 2016, Oracle and/or its affiliates. All rights
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

/* Requires version 2.0 of Felix Geisendoerfer's MySQL client */

"use strict";

var path = require("path");
var util = require('util');

var session_stats = {
	"created" : 0,
	"closed"  : 0	
};

var transaction_stats = {
	"execute"   : { "commit": 0, "no_commit" : 0},
	"closed"    : 0,
	"commit"    : 0,
	"rollback"  : 0
};

var op_stats = {
	"read"				: 0,
	"insert"			: 0,
	"update"			: 0,
	"write"				: 0,
	"delete"			: 0,
	"scan_read"		: 0,
	"scan_count"	: 0,
	"scan_delete" : 0
};

var mysql  = require("mysql"),
    udebug = unified_debug.getLogger("MySQLConnection.js"),
    stats_module  = require(jones.api.stats),
    mysql_code_to_sqlstate_map = require("./MysqlErrToSQLStateMap"),
    FieldValueDefinedListener = require(jones.common.FieldValueDefinedListener);

stats_module.register(session_stats, "spi","mysql","DBSession");
stats_module.register(transaction_stats, "spi","mysql","DBTransactionHandler");
stats_module.register(op_stats, "spi","mysql","DBOperation");
    
/** Convert the raw data in the driver to the type expected by the adapter.
 * Felix driver would normally convert DATE, DATETIME, and TIMESTAMP to
 * javascript Date on reading. But the driver does not currently support
 * fractional seconds. This type converter overrides the default and
 * passes the raw string value to the adapter.
 * @param field the field being processed in the driver
 * @param next the next type converter in the chain
 * @return the value to be passed to the adapter from the driver
 */
function driverTypeConverter(field, next) {
  switch (field.type) {
  case 'DATE':
    return field.string();
  case 'TIMESTAMP':
    return field.string();
  case 'DATETIME':
    return field.string();
  default:
    return next();
  }
}

/** MySQLConnection wraps a mysql connection and implements the DBSession contract.
 *  @param pooledConnection the felix connection to wrap
 *  @param connectionPool the associated connection pool
 *  @param index the index into connectionPool.openConnections for the pooledConnection;
 *    also the index of the Session in SessionFactory.sessions
 *  @return nothing
 */
exports.DBSession = function(pooledConnection, connectionPool, index) {
  if (arguments.length !== 3) {
    throw new Error('Fatal internal exception: expected 3 arguments; got ' + arguments.length);
  }
  if (pooledConnection === undefined) {
    throw new Error('Fatal internal exception: got undefined for pooledConnection');
  }
  if (pooledConnection === null) {
    throw new Error('Fatal internal exception: got null for pooledConnection');
  }
  this.pooledConnection = pooledConnection;
  this.connectionPool = connectionPool;
  this.transactionHandler = null;
  this.autocommit = true;
  this.index = index;
  session_stats.created++;
};

/** Construct an operation that when executed reports the error code */
var ErrorOperation = function (err, callback) {
  this.err = err;
  this.result = {};
  this.result.error = err;
  this.result.success = false;
  this.callback = callback;
};

ErrorOperation.prototype.execute = function(connection, operationCompleteCallback) {
  // call UserContext callback
  if (typeof(this.callback) == 'function') {
    this.callback(null, this);
  }
  // call execute callback
  operationCompleteCallback(this);
};

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
exports.DBSession.prototype.TransactionHandler = function(dbSession) {
  udebug.log('new TransactionHandler');
  var TransactionRolledBackError = function(err) {
    this.cause = err;
    this.sqlstate = 'HY000';
    this.message = 'Transaction was aborted due to operation failure. See this.cause for underlying error.';
  };

  var transactionHandler = this;
  this.isOpen = true;
  this.dbSession = dbSession;
  this.executedOperations = [];
  this.firstTime = !dbSession.autocommit;
  this.autocommit = dbSession.autocommit;
  this.pendingBatches = [];

  this.executeOperations = function() {
//    var operationTypes = [];
//    for (var o = 0; o < transactionHandler.operationsList.length; ++o) {
//      operationTypes.push(transactionHandler.operationsList[o].type);
//    }
//    udebug.log('TransactionHandler.executeOperations with', transactionHandler.operationsList.length,
//        'operations:', operationTypes);
    // transactionHandler.operationsList must have been set before calling executeOperations
    // transactionHandler.transactionExecuteCallback must also have been set
    transactionHandler.isCommitting = false;
    transactionHandler.numberOfOperations = transactionHandler.operationsList.length;
    udebug.log('MySQLConnection.TransactionHandler.executeOperations numberOfOperations: ',
        transactionHandler.numberOfOperations);
    // make sure that the connection is still valid
    if (transactionHandler.dbSession.pooledConnection === null) {
      throw new Error(
          'Fatal internal exception: MySQLConnection.TransactionHandler.executeOperations ' +
          'got null for pooledConnection');
      }
    // execute the first operation; the operationCompleteCallback will execute each successive operation
    transactionHandler.currentOperation = 0;
    transactionHandler.operationsList[transactionHandler.currentOperation]
        .execute(transactionHandler.dbSession.pooledConnection, transactionHandler.operationCompleteCallback);
  };

  this.execute = function(operationsList, transactionExecuteCallback) {
//    var operationTypes = [];
//    for (var o = 0; o < operationsList.length; ++o) {
//      operationTypes.push(operationsList[o].type);
//    }
//    udebug.log('TransactionHandler.execute with', operationsList.length, 'operations:', operationTypes);
    transactionHandler = this;
    
    var executeOnBegin = function(err) {
      if (err) {
        transactionHandler.transactionExecuteCallback(err);
      }
      transactionHandler.firstTime = false;
      transactionHandler.executeOperations();
    };

    // execute begin operation the first time for non-autocommit
    if (this.firstTime) {
      transaction_stats.execute.no_commit++;
      transactionHandler.operationsList = operationsList;
      transactionHandler.transactionExecuteCallback = transactionExecuteCallback;
      this.dbSession.pooledConnection.query('begin', executeOnBegin);
    } else {
      transaction_stats.execute.commit++;
      if (transactionHandler.numberOfOperations > 0) {
        // there are pending batches, so just put this request on the list
        transactionHandler.pendingBatches.push(
            {list: operationsList, 
             callback: transactionExecuteCallback
            });
      } else {
        // this is the first (only) so execute it now
        transactionHandler.operationsList = operationsList;
        transactionHandler.transactionExecuteCallback = transactionExecuteCallback;
        transactionHandler.executeOperations();
      }
    }
  };

  
  this.close = function() {
    transaction_stats.closed++;
  };

  this.batchComplete = function() {
    if (typeof(transactionHandler.transactionExecuteCallback) === 'function') {
      transactionHandler.transactionExecuteCallback(transactionHandler.error, transactionHandler);
    } 
    // reset executedOperations if the transaction execute callback did not pop them
    transactionHandler.executedOperations = [];
    // reset number of operations (after callbacks are done)
    transactionHandler.numberOfOperations = 0;
    // if we committed the transaction, tell dbSession we are gone
    if (transactionHandler.isCommitting) {
      transactionHandler.dbSession.transactionHandler = null;
    }
    // see if there are any pending batches to execute
    // each pending batch consists of an operation list and a callback
    if (transactionHandler.pendingBatches.length !== 0) {
      // remove the first pending batch from the list (FIFO)
      var nextBatch = transactionHandler.pendingBatches.shift();
      transactionHandler.operationsList = nextBatch.list;
      transactionHandler.transactionExecuteCallback = nextBatch.callback;
      delete transactionHandler.error;
      transactionHandler.executeOperations();
    }
  };

  this.operationCompleteCallback = function(completedOperation) {
    var operation, operationCallback;
    udebug.log('TransactionHandler.operationCompleteCallback', completedOperation.type);
    // analyze the completed operation to see if it had an error
    if (completedOperation.result.error) {
      // this is AbortOnError behavior
      // propagate the error to the transaction object
      transactionHandler.error = new TransactionRolledBackError(completedOperation.result.error);
    }
    transactionHandler.executedOperations.push(completedOperation);
    var complete = transactionHandler.executedOperations.length;
    if (complete === transactionHandler.numberOfOperations) {
      udebug.log_detail('MySQLConnection.TransactionHandler.operationCompleteCallback completed',
                 complete, 'of', transactionHandler.numberOfOperations);
      transactionHandler.batchComplete();
    } else {
      // there are more operations to execute in this batch
      udebug.log_detail('MySQLConnection.TransactionHandler.operationCompleteCallback ',
          ' completed ', complete, ' of ', transactionHandler.numberOfOperations);
      if (transactionHandler.error) {
        // do not execute the remaining operations, but call their callbacks with the propagated error
        // transactionHandler.currentOperation refers to the current (error) operation
        transactionHandler.currentOperation++;
        for (transactionHandler.currentOperation;
            transactionHandler.currentOperation < transactionHandler.numberOfOperations;
            transactionHandler.currentOperation++) {
          udebug.log_detail('transactionHandler error aborting operation ' + transactionHandler.currentOperation);
          operation = transactionHandler.operationsList[transactionHandler.currentOperation];
          operationCallback = operation.callback;
          operation.result.error = transactionHandler.error;
          if (typeof operationCallback === 'function') {
            // call the UserContext callback
            operationCallback(transactionHandler.error, operation);
          }
          transactionHandler.executedOperations.push(operation);
        }
        // finally, execute the batch complete function
        transactionHandler.batchComplete();
      } else {
        // execute the next operation in the current batch
        transactionHandler.currentOperation++;
        transactionHandler.operationsList[transactionHandler.currentOperation]
            .execute(transactionHandler.dbSession.pooledConnection, transactionHandler.operationCompleteCallback);
      }
    }
  };

  this.commit = function(callback) {
    udebug.log('MySQLConnection.TransactionHandler.commit.');
    transaction_stats.commit++;
    this.dbSession.pooledConnection.query('commit', callback);
    this.autocommit = true;
  };

  this.rollback = function(callback) {
    udebug.log('MySQLConnection.TransactionHandler.rollback.');
    transaction_stats.rollback++;
    this.dbSession.pooledConnection.query('rollback', callback);
    this.autocommit = true;
  };
};


exports.DBSession.prototype.createTransactionHandler = function() {
  this.transactionHandler = new this.TransactionHandler(this);
  return this.transactionHandler;
};

exports.DBSession.prototype.getTransactionHandler = function() {
  if (this.transactionHandler === null) {
    this.createTransactionHandler();
  }
  return this.transactionHandler;
};

// Create a DBOperationError from a mysql driver err.
var DBOperationError = function(cause) {
  // the cause is the mysql driver error
  // the code from the driver is the string form of the mysql error, e.g. ER_DUP_ENTRY
  this.code = mysql_code_to_sqlstate_map[cause.code];
  if (this.code === undefined) {
    this.code = 0;
    this.sqlstate = 'HY000';
  } else {
    this.sqlstate = mysql_code_to_sqlstate_map[this.code];
    cause.sqlstate = this.sqlstate;
  }
  this.message = cause.message;
  this.cause = cause;
  udebug.log('MySQLConnection DBOperationError constructor', this);
};

function InsertOperation(sql, data, callback) {
  udebug.log('dbSession.InsertOperation with', sql, data);
  var op = this;
  this.type = 'insert';
  this.sql = sql;
  this.data = data;
  this.callback = callback;
  this.result = {};
  op_stats.insert++;

  function onInsert(err, status) {
    if (err) {
      op.result.error = new DBOperationError(err);
      udebug.log('dbSession.InsertOperation err code:', err.code, op.result.error.code);
      op.result.success = false;
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(op.result.error, null);
      }
    } else {
      op.result.value = op.data;
      op.result.success = true;
      // get autoincrement value
      op.result.autoincrementValue = status.insertId;
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(null, op);
      }
    }
    // now call the transaction operation complete callback
    op.operationCompleteCallback(op);
  }

  this.execute = function(connection, operationCompleteCallback) {
    op.operationCompleteCallback = operationCompleteCallback;
    connection.query(this.sql, this.data, onInsert);
  };
}

function WriteOperation(sql, data, callback) {
  udebug.log('dbSession.WriteOperation with', sql, data);
  var op = this;
  this.type = 'write';
  this.sql = sql;
  this.data = data;
  this.callback = callback;
  this.result = {};
  op_stats.write++;

  function onWrite(err, status) {
    if (err) {
      udebug.log('dbSession.WriteOperation err code:', err.code);
      op.result.error = new DBOperationError(err);
      op.result.success = false;
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(op.result.error, null);
      }
    } else {
      op.result.value = op.data;
      op.result.success = true;
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(null, op);
      }
    }
    // now call the transaction operation complete callback
    op.operationCompleteCallback(op);
  }

  this.execute = function(connection, operationCompleteCallback) {
    op.operationCompleteCallback = operationCompleteCallback;
    connection.query(this.sql, this.data, onWrite);
  };
}

function DeleteOperation(sql, keys, callback) {
  udebug.log('dbSession.DeleteOperation with ', sql, keys);
  var op = this;
  this.type = 'delete';
  this.sql = sql;
  this.keys = keys;
  this.callback = callback;
  this.result = {};
  op_stats["delete"]++;

  function onDelete(err, status) {
    if (err) {
      udebug.log('dbSession.DeleteOperation err callback:', err);
      op.result.error = new DBOperationError(err);
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(op.result.error, op);
      }
    } else {
      udebug.log('dbSession.DeleteOperation NO ERROR callback:', status);
      if (status.affectedRows === 1) {
        op.result.success = true;
      } else {
        udebug.log('dbSession.DeleteOperation NO ERROR callback with no deleted rows');
        op.result.success = false;
        op.result.error = {};
        op.result.error.sqlstate = "02000";
        op.result.error.code = 1032;
      }
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(null, op);
      }
    }
    // now call the transaction operation complete callback
    op.operationCompleteCallback(op);
  }

  this.execute = function(connection, operationCompleteCallback) {
    op.operationCompleteCallback = operationCompleteCallback;
    connection.query(this.sql, this.keys, onDelete);
  };
}

function ReadOperation(dbSession, dbTableHandler, sql, keys, loadObject, callback) {
  udebug.log('dbSession.ReadOperation with', sql, keys);
  var op = this;
  this.type = 'read';
  this.sql = sql;
  this.keys = keys;
  this.callback = callback;
  this.result = {};
  if (typeof loadObject == 'object') {
    this.result.value = loadObject;  // operation is "load" rather than "find"
  }
  op_stats.read++;

  function onRead(err, rows) {
    var property;
    if (err) {
      udebug.log('dbSession.ReadOperation err callback:', err);
      op.result.error = new DBOperationError(err);
      op.result.success = false;
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(op.result.error, op);
      }
    } else {
      if (rows.length > 1) {
        err = new Error('Too many results from read: ' + rows.length);
        if (typeof(op.callback) === 'function') {
          // call the UserContext callback
          op.callback(err, op);
        }
      } else if (rows.length === 1) {
        udebug.log('dbSession.ReadOperation ONE RESULT callback:', rows[0]);
        op.result.success = true;
        if(op.result.value === undefined) {
          // convert the felix result into the user result
          op.result.value = dbTableHandler.newResultObject(rows[0]);
        } else {
          // load the result into the user's supplied object
          for(property in rows[0]) {
            if(rows[0].hasOwnProperty(property)) {
              op.result.value[property] = rows[0][property];
            }
          }
        }
        if (typeof(op.callback) === 'function') {
          // call the UserContext callback
          op.callback(null, op);
        }
      } else {
        udebug.log('dbSession.ReadOperation NO RESULTS callback.');
        op.result.value = null;
        op.result.success = false;
        op.result.error = {};
        op.result.error.code = 1032;
        op.result.error.sqlstate = "02000";
        if (typeof(op.callback) === 'function') {
          // call the UserContext callback
          op.callback(null, op);
        }
      }
    }
    // now call the transaction operation complete callback
    op.operationCompleteCallback(op);
  }

  this.execute = function(connection, operationCompleteCallback) {
    op.operationCompleteCallback = operationCompleteCallback;
    connection.query(
        {sql: this.sql, 
          values: this.keys,
          typeCast: driverTypeConverter
        }, 
        onRead);
  };
}

function ScanOperation(dbSession, dbTableHandler, sql, parameters, callback) {
  udebug.log_detail('dbSession.ScanOperation with sql', sql, '\nparameters', parameters);
  var op = this;
  this.type = 'scan';
  this.sql = sql;
  this.parameters = parameters;
  this.callback = callback;
  this.result = {};
  op_stats.scan_read++;

  function onScan(err, rows) {
    var i;
    if (err) {
      udebug.log('dbSession.ScanOperation err callback:', err);
      op.result.error = new DBOperationError(err);
      op.result.value = null;
      op.result.success = false;
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(op.result.error, op);
      }
    } else {
      op.result.value = rows;
      op.result.success = true;
      // convert the felix result into the user result
      for (i = 0; i < rows.length; ++i) {
        rows[i] = dbTableHandler.newResultObject(rows[i]);
      }
      op.callback(err, op);
    }
    // now call the transaction operation complete callback
    op.operationCompleteCallback(op);
  }

  this.execute = function(connection, operationCompleteCallback) {
    op.operationCompleteCallback = operationCompleteCallback;
    connection.query(
        {sql: this.sql, 
          values: this.parameters,
          typeCast: driverTypeConverter
        },
        onScan);
  };
}

function showProjection(projections, msg) {
  var projection, next;
  if (projections.length > 0) {
    projection = projections.shift();
    next = projection.firstNestedProjection;
    msg += '\nprojection name: ' + projection.name + ' for ' + projection.domainObject.name;
    msg += ' with ' + projection.sectors.length + ' sectors.';
    if (next) {
      msg += '\n    ' + next.domainObject.name;
      projections.push(next);
    }
    showProjection(projections, msg);
  } else {
    console.log(msg);
    return msg;
  }
}

/** Initialize the projection object for use with mysql adapter.
 * The projection object is organized into sectors, one for each domain object.
 * A sector contains a count of fields, a list of field names, and the offset column 
 * corresponding to the first column mapped to the first field.
 * All primary key fields are always included, plus any fields identified in the fields array
 * of the corresponding projection for the domain object.
 * Build the sql statement to use for the projection. SELECT... FROM... WHERE... ORDER BY...
 * For each sector, add the mapped table to the FROM clause including the join condition.
 * Add the key and non-key columns to the SELECT clause.
 * Add ORDER BY key columns for multi-value relationships.
 */
function initializeProjection(projection) {
  var mysql = {};
  projection.mysql = mysql;
  var i, j;
  var sector, sectorName;
  var parentSectorName;
  var select, from, on, alias, order;
  var thisOn, otherOn, and;

  var selectDelimiter, fromDelimiter, orderDelimiter;
  var columnName;
  var joinType, joinIndex;
  var offset;
  var keyField, nonKeyField;

  // create the sql query for the find method.
  select = 'SELECT ';
  from = ' FROM ';
  order = '';
  selectDelimiter = '';
  fromDelimiter = '';
  orderDelimiter = '';
  alias = 0;
  offset = 0;

  // always order by first table primary key to avoid duplicates in scan results

  for (i = 0; i < projection.sectors.length; ++i) {
    sector = projection.sectors[i];
    udebug.log_detail('initializeProjection for sector\n', sector);
    // offset of each sector into column in row
    sector.offset = offset;
    offset += sector.keyFields.length + sector.nonKeyFields.length;

    // set up the table names
    sector.tableName = sector.tableHandler.dbTable.database + '.' + sector.tableHandler.dbTable.name;
    sectorName = 't' + i;
    parentSectorName = 't' + sector.parentSectorIndex;
    joinType = '';
    on = '';
    if (sector.parentFieldMapping && i > 0) {
      if (sector.parentFieldMapping.toMany && sector.parentFieldMapping.manyTo) {
        // join table mapping
        // create a join table reference based on current table name
        // join tables are "between" tables that are joined for many-to-many relationships
        // ... t1 LEFT OUTER JOIN customerdiscount AS t15 on [t1.k = t15.k and...] 
        //     LEFT OUTER JOIN discount AS t2 on [t15.k = t2.k and ...]
        sector.joinTableName = sector.joinTableHandler.dbTable.database + '.' + sector.joinTableHandler.dbTable.name;
        sector.joinTableAlias = sectorName + 'JOIN';
        udebug.log_detail('initializeProjection join table handling for', sector.joinTableName, 'AS', sector.joinTableAlias,
            'thisForeignKey.columnNames', sector.parentFieldMapping.thisForeignKey.columnNames,
            'otherForeignKey.columnNames', sector.parentFieldMapping.otherForeignKey.columnNames);
        // generate the join from the previous domain table to the join table
        joinType = ' LEFT OUTER JOIN ';
        thisOn = ' ON ';
        and = '';
        for (joinIndex = 0; joinIndex < sector.parentFieldMapping.thisForeignKey.columnNames.length; ++joinIndex) {
          thisOn += and + parentSectorName + '.' + sector.parentFieldMapping.thisForeignKey.targetColumnNames[joinIndex] + ' = ' +
              sector.joinTableAlias + '.' + sector.parentFieldMapping.thisForeignKey.columnNames[joinIndex];
          and = ' AND ';
        }
        from += fromDelimiter + joinType + sector.joinTableName + ' AS ' + sector.joinTableAlias + thisOn;

        // generate the join from the join table to this domain table
        otherOn = ' ON ';
        and = '';
        for (joinIndex = 0; joinIndex < sector.parentFieldMapping.otherForeignKey.columnNames.length; ++joinIndex) {
          otherOn += and + sector.joinTableAlias + '.' + sector.parentFieldMapping.otherForeignKey.columnNames[joinIndex] + ' = ' +
          sectorName + '.' + sector.parentFieldMapping.otherForeignKey.targetColumnNames[joinIndex];
          and = ' AND ';
        }
        from += fromDelimiter + joinType + sector.tableName + ' AS ' + sectorName + otherOn;

      } else {
        // foreign key mapping for one-to-one, one-to-many, and many-to-one relationships
        joinType = ' LEFT OUTER JOIN ';
        on = ' ON ';
        and = '';
        for (joinIndex = 0; joinIndex < sector.thisJoinColumns.length; ++joinIndex) {
          on += and + parentSectorName + '.' + sector.otherJoinColumns[joinIndex] + ' = ' +
                sectorName + '.' + sector.thisJoinColumns[joinIndex];
          and = ' AND ';
        }
        from += fromDelimiter + joinType + sector.tableName + ' AS ' + sectorName + on;
      }
    } else {
      // first table is always t0
      from += sector.tableName + ' AS ' + sectorName;
      fromDelimiter = ' ';
    }
    if (i == 0 || sector.parentFieldMapping.toMany) {
      // order by key columns that can have multiple values (toMany relationships and first sector)
      for (j = 0; j < sector.keyFields.length; ++j) {
        keyField = sector.keyFields[j];
        columnName = keyField.columnName;
        order += orderDelimiter + sectorName + '.' + columnName;
        orderDelimiter = ', ';
      }
    }
    // add key column names to SELECT clause
    for (j = 0; j < sector.keyFields.length; ++j) {
      keyField = sector.keyFields[j];
      columnName = keyField.columnName;
      select += selectDelimiter + sectorName + '.' + columnName + ' AS \'' + alias++ + '\'';
      selectDelimiter = ', ';
    }
    // add non-key column names to SELECT clause
    for (j = 0; j < sector.nonKeyFields.length; ++j) {
      nonKeyField = sector.nonKeyFields[j];
      columnName = nonKeyField.columnName;
      select += selectDelimiter + sectorName + '.' + columnName + ' AS \'' + alias++ + '\'';
      selectDelimiter = ', ';
    }
  }
  mysql.select = select;
  mysql.from = from;
  mysql.sectors = projection.sectors;
  if (order) {
    mysql.order = ' ORDER BY ' + order;
  } else {
    mysql.order = '';
  }
  // mark this as having been processed
  projection.mysql.id = projection.id;
  if (udebug.is_debug()) {udebug.log_detail('initializeProjection', select, from);}
}

/** Is the key of the sector in this row null? */
function isRowSectorKeyNull(row, sector) {
  var keyRowIndex;
  var offset = sector.offset;
  for (keyRowIndex = 0; keyRowIndex < sector.keyFields.length; ++keyRowIndex) {
    if (row[offset + keyRowIndex] !== null) {
      return false;
    }
  }
  return true;
}

/** Is the key of the sector in this row equal to the key of the tuple? */
function isRowSectorKeyEqual(row, sector, tuple) {
  var keyRowIndex;
  var offset = sector.offset;
  var rowValue;
  var tupleValue;
  if (tuple) {
    for (keyRowIndex = 0; keyRowIndex < sector.keyFields.length; ++keyRowIndex) {
      rowValue = row[offset + keyRowIndex];
      tupleValue = tuple[sector.keyFields[keyRowIndex].fieldName];
      if (rowValue !== tupleValue) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/** Find the tuple corresponding to this row in the parent field. For each candidate
 * object in the parent field, compare keys in the row with key fields in the object.
 * Return null if none of the parent field elements matches this row.
 */
function findResultTupleInParent(op, row, sector) {
  var result = null;
  var parent = op.sectors[sector.parentSectorIndex];
  if (udebug.is_detail()) {udebug.log_detail('onResult.findResultTupleInParent parent', parent);}
  var candidates = op.tuples[sector.parentSectorIndex][sector.parentFieldMapping.fieldName];
  var i, candidate;
  if (candidates) {
    for (i = 0; i < candidates.length; ++i) {
      candidate = candidates[i];
      if (isRowSectorKeyEqual(row, sector, candidate)) {
        result = candidate;
        break;
      }
    }
  }
  return result;
}

/** Set to null the children of this sector recursively */
function resetTuples(op, sectorIndex) {
  op.sectors[sectorIndex].childSectorIndexes.forEach(
    function(childSectorIndex) {
      op.tuples[childSectorIndex] = null;
      resetTuples(op, childSectorIndex);
  });
}

/** Process this sector (recursively) [experimental] */
function processSector(op, sector, row) {
  // process this sector with data from the row
  op.sectors[sector].childSectorIndexes.forEach(function(sectorIndex) {
    processSector(op, sectorIndex, row);
  });
}


/** Read projection executes sql with parameters and creates results according to the projection.
 * Each row returned from felix contains results for possibly many objects.
 * Each sector may create a new domain object (tuple) using the DBTableHandler constructor.
 * The results are kept in a tuple array in which each domain object is contained in the object to its left.
 * When analyzing rows, starting with the leftmost object in the tuple array, the key values in each tuple
 * are compared to the corresponding key values in the row. If the keys are the same, processing
 * continues with the next object in the tuple array. If the keys are different, or no object exists,
 * a new object is created and processing continues with the next object in the tuple.
 * In this case, the tuples to the "right" of the newly created tuple belong to the previous tuple and are discarded.
 * [Processing the last tuple in the row will always create a new object.]
 * Once the last sector is processed, the function returns and the next row will be processed.
 * At the end of the last row, the callback is called, which will return the result.value to the user.
 * This function is used for primary and unique key operations and index and table scan operations.
 * If used for scans, multiple root objects can be returned. If used for read, zero or one object will be returned.
 * Scans will set the isScan flag to true.
 */
function ReadProjectionOperation(dbSession, dbTableHandler, projection, where, keys, isScan, callback) {
  var op = this;
  this.selectSQL = projection.mysql.select + projection.mysql.from + where + projection.mysql.order;
  var query;
  this.type = 'read';
  this.keys = keys;
  this.callback = callback;
  this.result = {};
  this.err = null;
  this.tuples = [];
  this.sectors = projection.mysql.sectors;
  this.rows = 0;
  this.roots = [];
  op_stats.read++;

  function onResult(row) {
    var i;
    var sector;
    var tuple = null;
    var parentSectorIndex;
    var relationship;
    var nullValue;
    op.rows++;
    // process the row by sector, left to right
    if (udebug.is_detail()) {udebug.log_detail('onResult processing row with', op.sectors.length, 'sectors:\n', row);}
    processSector(op, 0, row); // experimental for now
    // do each sector in turn; the parent sector will always be processed before any of its children
    for (i = 0; i < op.sectors.length; ++i) {
      sector = op.sectors[i];
      udebug.log_detail('onResult sector:', i, sector.projection.name);
      tuple = op.tuples[i];
      if (i == 0) {
        // root object handling; root will never be null
        if (!isRowSectorKeyEqual(row, sector, tuple)) {
          // create a new domain object from this row
          if (op.tuples[0] !== undefined) {
            // collect the current root object before creating a new root object
            op.roots.push(op.tuples[0]);
          }
          op.tuples[0] = sector.tableHandler.newResultObjectFromRow(row,
              sector.offset, sector.keyFields, sector.nonKeyFields,
              sector.toManyRelationships, sector.toOneRelationships);
          // the child tuples belong to the previous tuple
          resetTuples(op, 0);
        }
        // we are done with this (root) sector
        continue;
      }
      parentSectorIndex = sector.parentSectorIndex;
      // if the keys in the row for this sector are null set the parent field to default
      if (isRowSectorKeyNull(row, sector)) {
        if (op.tuples[parentSectorIndex] != null) {
        // if there is a parent, set the parent relationship value to the default
          if (sector.parentFieldMapping.toMany) {
            // null toMany relationships are represented by an empty array
            nullValue = [];
          } else {
            nullValue = null;
          }
          op.tuples[parentSectorIndex][sector.parentFieldMapping.fieldName] = nullValue;
        }
        // reset the children of this tuple since they belong to the previous value
        op.tuples[i] = null;
        resetTuples(op, i);
        // and we are done with this sector
        continue;
      }
      // compare the keys of the row with the keys of the current object
      if (isRowSectorKeyEqual(row, sector, tuple)) {
        // we have already processed this object
        continue;
      }
      // keys do not match the current object; see if it matches one of the parent objects
      if (sector.parentFieldMapping.toMany) {
        tuple = findResultTupleInParent(op, row, sector);
      } else {
        tuple = op.tuples[parentSectorIndex][sector.parentFieldMapping.fieldName];
      }
      if (tuple == null) {
        // haven't seen this before; create a new tuple from the row
        tuple = sector.tableHandler.newResultObjectFromRow(row,
            sector.offset, sector.keyFields, sector.nonKeyFields,
            sector.toManyRelationships, sector.toOneRelationships);
        // the rest of the tuples belong to the previous object
        // assign the new object to the relationship field of the previous object
        if (sector.parentFieldMapping.toMany) {
          // relationship is an array
          relationship = op.tuples[parentSectorIndex][sector.parentFieldMapping.fieldName];
          if (!relationship) {
            relationship = op.tuples[parentSectorIndex][sector.parentFieldMapping.fieldName] = [];
          }
          relationship.push(tuple);
        } else {
          // relationship is a reference
          op.tuples[parentSectorIndex][sector.parentFieldMapping.fieldName] = tuple;
        }
      }
      op.tuples[i] = tuple;
      resetTuples(op, i);
    }
  }

  function onError(e) {
    // remember the error; the error will be returned at onEnd
    e.message += '\nsql:\n' + op.selectSQL + '\nwith keys: ' + op.keys;
    op.result.error = e;
    op.result.error.sqlstate = 'HY000';
  }

  function onEnd() {
    // done processing all the rows
    if (op.tuples.length !== 0) {
      // we had a result
      op.roots.push(op.tuples[0]);
      op.result.value = op.tuples[0];
      op.result.success = true;
    } else if (!op.result.error) {
      if (op.rows > 0) {
        throw new Error(op.rows + ' were processed but no tuples were returned. Sectors:\n' + op.sectors);
      }
      // no error was reported, but there is no result, so make up a "row not found" error
      op.result.value = null;
      op.result.success = false;
      op.result.error = {};
      op.result.error.code = 1032;
      op.result.error.sqlstate = "02000";
    }
    // if this was a scan, return the roots object instead of the single value
    if (isScan) {
      op.result.value = op.roots;
    }
    if (typeof(op.callback) === 'function') {
    // call the UserContext callback
    op.callback(op.result.error, op);
    }
    // now call the transaction operation complete callback
    op.operationCompleteCallback(op);
    udebug.log_detail('ReadProjectionOperation.onEnd rows processed:', op.rows);
  }
  
  this.execute = function(connection, operationCompleteCallback) {
    udebug.log('ReadProjectionOperation.execute with SQL:\n ', op.selectSQL, '\nkeys: ', op.keys);
    op.operationCompleteCallback = operationCompleteCallback;
    // we have to format the query string ourselves because the variant of connection.query
    // with no callback does not allow formatting parameters
    var formattedSQL = connection.format(this.selectSQL, this.keys);
    query = connection.query(
        {sql: formattedSQL,
          typeCast: driverTypeConverter
        });
    query.
    on('end', onEnd).
    on('error', onError).
    on('result', onResult);
  };
}

function UpdateOperation(sql, keys, values, callback) {
  udebug.log('dbSession.UpdateOperation with', sql, values, keys);
  var op = this;
  this.type = 'update';
  this.sql = sql;
  this.keys = keys;
  this.values = values;
  this.callback = callback;
  this.result = {};
  op_stats.update++;

  function onUpdate(err, status) {
    if (err) {
      udebug.log('dbSession.UpdateOperation err callback:', err);
      op.result.error = new DBOperationError(err);
      op.result.success = false;
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(op.result.error, op);
      }
    } else {
      udebug.log('dbSession.UpdateOperation NO ERROR callback:', status);
      if (status.affectedRows === 1) {
        op.result.success = true;
      } else {
        udebug.log('dbSession.UpdateOperation NO ERROR callback with no updated rows');
        op.result.success = false;
        op.result.error = {};
        op.result.error.sqlstate = "02000";
        op.result.error.code = 1032;
      }
      if (typeof(op.callback) === 'function') {
        // call the UserContext callback
        op.callback(null, op);
      }
    }
    // now call the transaction operation complete callback
    op.operationCompleteCallback(op);
  }

  this.execute = function(connection, operationCompleteCallback) {
    op.operationCompleteCallback = operationCompleteCallback;
    connection.query(this.sql, this.values.concat(this.keys), onUpdate);
  };
}

/** Create the INSERT and INSERT... DUPLICATE SQL statements corresponding to the fieldValueDefinedKey.
 * If fieldValueDefinedKey is undefined, include all columns in the statements.
 * If fieldValueDefinedKey contains a string, e.g. 'DUUUD', include only those
 * columns that have a 'D' in the corresponding position.
 */
function createInsertSQL(dbTableHandler, fieldValueDefinedKey) {
  // create the insert SQL statement from the table metadata and field values defined key
  var insertSQL = 'INSERT INTO ' + dbTableHandler.dbTable.database + '.' + dbTableHandler.dbTable.name + ' (';
  var valuesSQL = ' VALUES (';
  var duplicateSQL = ' ON DUPLICATE KEY UPDATE ';
  var columns = dbTableHandler.getAllColumnMetadata();
  udebug.log_detail('getMetadata with columns', columns);
  // loop over the columns and extract the column name
  var columnSeparator = '';
  var duplicateSeparator = '';
  var i, column;  
  for (i = 0; i < columns.length; ++i) {
    if ((!fieldValueDefinedKey) || fieldValueDefinedKey[i] === 'D') {
      column = columns[i];
      insertSQL += columnSeparator + column.name;
      valuesSQL += columnSeparator + '?';
      columnSeparator = ', ';
      if (!column.isInPrimaryKey) {
        duplicateSQL += duplicateSeparator + column.name + ' = VALUES (' + column.name + ') ';
        duplicateSeparator = ', ';
      }
    }
  }
  valuesSQL += ')';
  insertSQL += ')' + valuesSQL;
  if (fieldValueDefinedKey === undefined) {
    dbTableHandler.mysql.insertSQL = insertSQL;
    dbTableHandler.mysql.duplicateSQL = insertSQL + duplicateSQL;
    udebug.log_detail('insertSQL:', insertSQL);
    udebug.log_detail('duplicateSQL:', insertSQL + duplicateSQL);
  } else {
    dbTableHandler.mysql.insertPartialSQL[fieldValueDefinedKey] = insertSQL;
    dbTableHandler.mysql.duplicatePartialSQL[fieldValueDefinedKey] = insertSQL + duplicateSQL;
    udebug.log_detail('insertPartialSQL[', fieldValueDefinedKey, ']:', insertSQL);
    udebug.log_detail('duplicatePartialSQL[', fieldValueDefinedKey, ']:', insertSQL + duplicateSQL);
  }
}

/** Get the INSERT SQL corresponding to the fieldValueDefinedKey which is a string
 * with a 'D' for each defined value and 'U' for each undefined value.
 * For example, for a table with 5 columns, if the first and last columns have values
 * the value of fieldValueDefinedKey is 'DUUUD'.
 */
function getInsertSQL(dbTableHandler, fieldValueDefinedKey) {
  var insertSQL = dbTableHandler.mysql.insertPartialSQL[fieldValueDefinedKey];
  if (insertSQL) {
    // insert all columns
    return insertSQL;
  }
  // create the partial SQL for fieldValueDefinedKey
  createInsertSQL(dbTableHandler, fieldValueDefinedKey);
  return dbTableHandler.mysql.insertPartialSQL[fieldValueDefinedKey];
}

/** Get the INSERT... DUPLICATE SQL corresponding to the fieldValueDefinedKey which is a string
 * with a 'D' for each defined value and 'U' for each undefined value.
 * For example, for a table with 5 columns, if the first and last columns have values
 * the value of fieldValueDefinedKey is 'DUUUD'.
 */
function getDuplicateSQL(dbTableHandler, fieldValueDefinedKey) {
  var duplicateSQL = dbTableHandler.mysql.duplicatePartialSQL[fieldValueDefinedKey];
  if (duplicateSQL) {
    // insert all columns on duplicate key update
    return duplicateSQL;
  }
  // create the duplicate partial SQL for fieldValueDefinedKey
  createInsertSQL(dbTableHandler, fieldValueDefinedKey);
  return dbTableHandler.mysql.duplicatePartialSQL[fieldValueDefinedKey];
}

function createDeleteSQL(dbTableHandler, index) {
  // create the delete SQL statement from the table metadata for the named index
  var deleteSQL;
  if (!index) {
    deleteSQL = 'DELETE FROM ' + dbTableHandler.dbTable.database + '.' + dbTableHandler.dbTable.name;
    // return non-index delete statement
  } else {
    deleteSQL = dbTableHandler.mysql.deleteTableScanSQL + ' WHERE ';
    // find the index metadata from the dbTableHandler index section
    // loop over the columns in the index and extract the column name
    var indexHandlers = dbTableHandler.dbIndexHandlers;
    var columns = dbTableHandler.getAllColumnMetadata();
    var separator = '';
    var i, j, indexColumns;
    for (i = 0; i < indexHandlers.length; ++i) {
      if (indexHandlers[i].dbIndex.name === index) {
        indexColumns = indexHandlers[i].indexColumnNumbers;
        for (j = 0; j < indexColumns.length; ++j) {
          deleteSQL += separator + columns[indexColumns[j]].name + ' = ?';
          separator = ' AND ';
        }
        // for unique btree indexes the first one is the unique index we are interested in
        break;
      }
    }
  }
  udebug.log_detail('getMetadata deleteSQL for', index, ':', deleteSQL);
  return deleteSQL;
}

function createSelectSQL(dbTableHandler, index) {
  var selectSQL;
  var whereSQL;
  var separator = '';
  var i, j, columns;
  var indexHandlers, indexColumns;
  columns = dbTableHandler.getAllColumnMetadata();
  if (!index) {
    selectSQL = 'SELECT ';
    var fromSQL = ' FROM ' + dbTableHandler.dbTable.database + '.' + dbTableHandler.dbTable.name;
    // loop over the mapped column names in order
    for (i = 0; i < columns.length; ++i) {
      selectSQL += separator + columns[i].name;
      separator = ', ';
    }
    selectSQL += fromSQL;
  } else {
    // create the select SQL statement from the table metadata for the named index
    selectSQL = dbTableHandler.mysql.selectTableScanSQL;
    whereSQL = ' WHERE ';

    // loop over the index columns
    // find the index metadata from the dbTableHandler index section
    // loop over the columns in the index and extract the column name
    indexHandlers = dbTableHandler.dbIndexHandlers;
    separator = '';
    for (i = 0; i < indexHandlers.length; ++i) {
      if (indexHandlers[i].dbIndex.name === index) {
        indexColumns = indexHandlers[i].indexColumnNumbers;
        for (j = 0; j < indexColumns.length; ++j) {
          whereSQL += separator + columns[indexColumns[j]].name + ' = ? ';
          separator = ' AND ';
        }
        // for unique btree indexes the first one is the unique index we are interested in
        break;
      }
    }
    selectSQL += whereSQL;
  }
  udebug.log_detail('getMetadata selectSQL for', index +':', selectSQL);
  return selectSQL;
}

function createWhereSQL(dbTableHandler, index) {
  var whereSQL;
  var separator = '';
  var i, j, columns;
  var indexHandlers, indexColumns;
  columns = dbTableHandler.getAllColumnMetadata();
  if (index) {
    // create the where SQL clause from the table metadata for the named index
    whereSQL = ' WHERE ';

    // loop over the index columns
    // find the index metadata from the dbTableHandler index section
    // loop over the columns in the index and extract the column name
    indexHandlers = dbTableHandler.dbIndexHandlers;
    separator = '';
    for (i = 0; i < indexHandlers.length; ++i) {
      if (indexHandlers[i].dbIndex.name === index) {
        indexColumns = indexHandlers[i].indexColumnNumbers;
        for (j = 0; j < indexColumns.length; ++j) {
          whereSQL += separator + 't0.' + columns[indexColumns[j]].name + ' = ? ';
          separator = ' AND ';
        }
        // for unique btree indexes the first one is the unique index we are interested in
        break;
      }
    }
  }
  return whereSQL;
}

function getMetadata(dbTableHandler) {
  if (dbTableHandler.mysql) {
    return;
  }
  udebug.log_detail('getMetadata with dbTableHandler', dbTableHandler.dbTable.name);
  dbTableHandler.mysql = {};
  dbTableHandler.mysql.indexes = {};
  dbTableHandler.mysql.deleteSQL = {};
  dbTableHandler.mysql.deleteTableScanSQL= createDeleteSQL(dbTableHandler);
  dbTableHandler.mysql.selectSQL = {};
  dbTableHandler.mysql.selectTableScanSQL = createSelectSQL(dbTableHandler);
  dbTableHandler.mysql.whereSQL = {};
  dbTableHandler.mysql.insertPartialSQL = {};
  dbTableHandler.mysql.duplicatePartialSQL = {};
  
  createInsertSQL(dbTableHandler);
  var i, indexes, index;
  // create a delete statement and select statement per index
  indexes = dbTableHandler.dbTable.indexes;
  for (i = 0; i < indexes.length; ++i) {
    index = dbTableHandler.dbTable.indexes[i];
    dbTableHandler.mysql.deleteSQL[index.name] = createDeleteSQL(dbTableHandler, index.name);
    dbTableHandler.mysql.selectSQL[index.name] = createSelectSQL(dbTableHandler, index.name);
    dbTableHandler.mysql.whereSQL[index.name] = createWhereSQL(dbTableHandler, index.name);
  }
}

function extractValues(fieldValues, fieldValueDefinedKey) {
  var statementValues = [];
  var fieldIndex;
  for (fieldIndex = 0; fieldIndex < fieldValueDefinedKey.length; ++fieldIndex) {
    if (fieldValueDefinedKey.charAt(fieldIndex) === 'D') {
      // field is defined
      statementValues.push(fieldValues[fieldIndex]);
    }
  }
  return statementValues;
}

exports.DBSession.prototype.buildInsertOperation = function(dbTableHandler, object, transaction, callback) {
  udebug.log_detail('dbSession.buildInsertOperation with tableHandler:', 
                    dbTableHandler.dbTable.name, 'object:', object);
  getMetadata(dbTableHandler);
  var fieldValueDefinedListener = new FieldValueDefinedListener();
  var fieldValues = dbTableHandler.getColumns(object, fieldValueDefinedListener);
  if (fieldValueDefinedListener.errors) {
    // error during preparation of column values
    udebug.log('MySQLConnection.buildInsertOperation error', fieldValueDefinedListener.errors[0]);
    return new ErrorOperation(fieldValueDefinedListener.errors[0], callback);
  }
  var fieldValueDefinedKey = fieldValueDefinedListener.key;
  udebug.log_detail('MySQLConnection.buildWriteOperation', fieldValueDefinedKey);
  if (fieldValueDefinedKey === undefined) {
    // all fields are defined; use the standard generated INSERT... DUPLICATE SQL statement
    return new InsertOperation(dbTableHandler.mysql.insertSQL, fieldValues, callback);
  }
  var insertSQL = getInsertSQL(dbTableHandler, fieldValueDefinedKey);
  // extract the field values that were defined
  var statementValues = extractValues(fieldValues, fieldValueDefinedKey);
  
  return new InsertOperation(insertSQL, statementValues, callback);
};


exports.DBSession.prototype.buildDeleteOperation = function(dbIndexHandler, keys, transaction, callback) {
  udebug.log_detail('dbSession.buildDeleteOperation with indexHandler:', dbIndexHandler.dbIndex.name, 'keys: ', keys);
  var keysArray = dbIndexHandler.getColumns(keys);
  var dbTableHandler = dbIndexHandler.tableHandler;
  getMetadata(dbTableHandler);
  var deleteSQL = dbTableHandler.mysql.deleteSQL[dbIndexHandler.dbIndex.name];

  return new DeleteOperation(deleteSQL, keysArray, callback);
};


exports.DBSession.prototype.buildReadOperation = function(dbIndexHandler, keys, transaction, isLoad, callback) {
  udebug.log_detail('dbSession.buildReadOperation with indexHandler:', dbIndexHandler.dbIndex.name, 'keys:', keys);
  var keysArray;
  if (!Array.isArray(keys)) {
    // the keys object is a domain object or value object from which we need to extract the array of keys
    keysArray = dbIndexHandler.getColumns(keys);
  } else {
    keysArray = keys;
  }
  var dbTableHandler = dbIndexHandler.tableHandler;
  getMetadata(dbTableHandler);
  var selectSQL = dbTableHandler.mysql.selectSQL[dbIndexHandler.dbIndex.name];
  return new ReadOperation(this, dbTableHandler, selectSQL, keysArray,
                           isLoad && keys, callback);
};

exports.DBSession.prototype.buildReadProjectionOperation = 
    function(dbIndexHandler, keys, projection, transaction, callback) {
  udebug.log_detail('dbSession.buildReadProjectionOperation with indexHandler:\n', dbIndexHandler.dbIndex.name,
      'keys:\n', keys);

  // process the projection object if it has not been processed since it was last changed
  if (!projection.mysql || (projection.mysql.id !== projection.id)) {
    // we need to (re-)initialize the projection object for use with mysql adapter
    initializeProjection(projection);
  }
    
  var keysArray;
  if (!Array.isArray(keys)) {
    // the keys object is a domain object or value object from which we need to extract the array of keys
    keysArray = dbIndexHandler.getColumns(keys);
  } else {
    keysArray = keys;
  }
  var dbTableHandler = dbIndexHandler.tableHandler;
  getMetadata(dbTableHandler);
  var whereSQL = dbTableHandler.mysql.whereSQL[dbIndexHandler.dbIndex.name];
  return new ReadProjectionOperation(this, dbTableHandler, projection, whereSQL, keysArray, false, callback);
};

/** maximum limit parameter is some large number */
var MAX_LIMIT = Math.pow(2, 52);
exports.DBSession.prototype.buildScanOperation = function(queryDomainType, parameterValues, transaction, callback) {
	if (udebug.is_debug()) { udebug.log_detail('dbSession.buildScanOperation with queryDomainType:\n', queryDomainType,
      '\nparameterValues:', parameterValues); }
  var dbTableHandler = queryDomainType.jones_query_domain_type.dbTableHandler;
  var queryHandler = queryDomainType.jones_query_domain_type.queryHandler;
  var predicate = queryDomainType.jones_query_domain_type.predicate;
  var projection;
  var order = parameterValues.order;
  var skip = parameterValues.skip;
  var limit = parameterValues.limit;
  var err;
  var parameterName, value;
  getMetadata(dbTableHandler);
  var scanSQL = '';
  var whereSQL = '';
  var sql = {};
  var sqlParameters = [];
  // resolve parameters if predicate is specified
  if (predicate !== undefined) {
    sql = predicate.getSQL();
    udebug.log_detail('buildScanOperation with sql:', sql.formalParameters, '\n', predicate);
    var formalParameters = sql.formalParameters;
    var i;
    for (i = 0; i < formalParameters.length; ++i) {
      parameterName = formalParameters[i].name;
      value = parameterValues[parameterName];
      sqlParameters.push(value);
    }
  }
  // projection scans use SELECT and FROM from Projection and construct WHERE differently
  if (queryDomainType.isQueryProjectionDomainType) {
    projection = queryDomainType.projection;
    // process the projection object if it has not been processed since it was last changed
    if (!projection.mysql || (projection.mysql.id !== projection.id)) {
      // we need to (re-)initialize the projection object for use with mysql adapter
      initializeProjection(projection);
    }
    if (predicate !== undefined) {
      whereSQL = ' WHERE ' + sql.sqlText;
    }
    return new ReadProjectionOperation(this, dbTableHandler, projection, whereSQL, sqlParameters, true, callback);
  }
  // non-projection scan
  scanSQL = dbTableHandler.mysql.selectTableScanSQL;
  // add the WHERE clause to the sql if the user specified a predicate
  if (queryDomainType.jones_query_domain_type.predicate !== undefined) {
    whereSQL = ' WHERE ' + sql.sqlText;
    scanSQL += whereSQL;
    udebug.log_detail('dbSession.buildScanOperation sql:', scanSQL, '\nparameter values:', parameterValues);
    // handle order: must be an index scan and specify ignoreCase 'Asc' or 'Desc'
    if (order) {
      // validate this is an index scan
      if (queryHandler.queryType !== 2) {
        err = new Error('Bad order parameter; must be used only with index scans');
        return new ErrorOperation(err, callback);
      }
      // validate parameter; must be ignoreCase Asc or Desc
      if (typeof order === 'string') {
        if (order.toUpperCase() === 'ASC') {
          scanSQL += ' ORDER BY ';
          scanSQL += queryHandler.dbIndexHandler.getColumnMetadata(0).name;
          scanSQL += ' ASC ';
        } else if (order.toUpperCase() === 'DESC') {
          scanSQL += ' ORDER BY ';
          scanSQL += queryHandler.dbIndexHandler.getColumnMetadata(0).name;
          scanSQL += ' DESC ';
        } else {
          err = new Error('Bad order parameter \'' + order + '\'; order must be ignoreCase asc or desc.');
          return new ErrorOperation(err, callback);
        }
      } else {
        // bad order parameter; not ASC or DESC
        err = new Error('Bad order parameter \'' + order + '\'; order must be ignoreCase asc or desc.');
        return new ErrorOperation(err, callback);
      }
    }
  }
  // handle SKIP and LIMIT; must use index or table scan
  if (skip !== undefined || limit !== undefined) {
    if (skip !== undefined && (queryHandler.queryType < 2)) {
      err = new Error('Bad skip parameter \'' + skip + '\'; must be used only with index or table scan.');
      return new ErrorOperation(err, callback);
    }
    // set default values if not provided
    if (skip === undefined)  {skip = 0;}
    if (limit === undefined) {limit = MAX_LIMIT;}

    scanSQL += ' LIMIT ' + skip + ' , ' + limit;
  }
  return new ScanOperation(this, dbTableHandler, scanSQL, sqlParameters, callback);
};


exports.DBSession.prototype.buildUpdateOperation = function(dbIndexHandler, keys, values, transaction, callback) {
  udebug.log('dbSession.buildUpdateOperation with indexHandler:', dbIndexHandler.dbIndex, keys, values);
  var dbTableHandler = dbIndexHandler.tableHandler;
  getMetadata(dbTableHandler);
  // build the SQL Update statement along with the data values
  var updateSetSQL = 'UPDATE ' + dbTableHandler.dbTable.database + '.' + dbTableHandler.dbTable.name + ' SET ';
  var updateWhereSQL = ' WHERE ';
  var separatorWhereSQL = '';
  var separatorUpdateSetSQL = '';
  var updateFields = [];

  var i, columnName;
  // construct the WHERE clause for all key columns in the index
  for(i = 0 ; i < dbIndexHandler.getNumberOfColumns() ; i++) {
    columnName = dbIndexHandler.getColumnMetadata(i).name;
    updateWhereSQL += separatorWhereSQL + columnName + ' = ? ';
    separatorWhereSQL = 'AND ';
  }

  values = dbIndexHandler.tableHandler.getColumns(values);
  for(i = 0 ; i < values.length ; i++) {
    if(values[i] !== undefined) {
      if(! dbIndexHandler.columnMask.bitIsSet(i)) {
        // add the value in the object to the updateFields
        updateFields.push(values[i]);
        // add the value field to the SET clause
        columnName = dbTableHandler.getColumnMetadata(i).name;
        updateSetSQL += separatorUpdateSetSQL + columnName + ' = ?';
        separatorUpdateSetSQL = ', ';
      }
    }
  }

  updateSetSQL += updateWhereSQL;
  udebug.log('dbSession.buildUpdateOperation SQL:', updateSetSQL);
  var keysArray = dbIndexHandler.getColumns(keys);
  return new UpdateOperation(updateSetSQL, keysArray, updateFields, callback);
};

exports.DBSession.prototype.buildWriteOperation = function(dbIndexHandler, values, transaction, callback) {
  udebug.log_detail('buildWriteOperation with indexHandler:', dbIndexHandler, values);
  var dbTableHandler = dbIndexHandler.tableHandler;
  getMetadata(dbTableHandler);
  var fieldValueDefinedListener = new FieldValueDefinedListener();
  var fieldValues = dbTableHandler.getColumns(values, fieldValueDefinedListener);
  if (fieldValueDefinedListener.errors) {
    // error during preparation of field values
    udebug.log('MySQLConnection.buildWriteOperation error', fieldValueDefinedListener.errors[0]);
    return new ErrorOperation(fieldValueDefinedListener.errors[0], callback);
  }
  var fieldValueDefinedKey = fieldValueDefinedListener.key;
  if (fieldValueDefinedKey === undefined) {
    // all fields are defined; use the standard generated INSERT... DUPLICATE SQL statement
    return new WriteOperation(dbTableHandler.mysql.duplicateSQL, fieldValues, callback);
  }

  var writeSQL = getDuplicateSQL(dbTableHandler, fieldValueDefinedKey);
  // extract the field values that were defined
  var statementValues = extractValues(fieldValues, fieldValueDefinedKey);
  udebug.log_detail('dbSession.buildWriteOperation SQL:', writeSQL, 'using values', statementValues);

  return new WriteOperation(writeSQL, statementValues, callback);
};

exports.DBSession.prototype.begin = function() {
  udebug.log('dbSession.begin');
  this.autocommit = false;
  this.transactionHandler = this.getTransactionHandler();
  this.transactionHandler.autocommit = false;
};

exports.DBSession.prototype.commit = function(callback) {
  this.transactionHandler.commit(callback);
  this.autocommit = true;
};

exports.DBSession.prototype.rollback = function(callback) {
  this.transactionHandler.rollback(callback);
  this.autocommit = true;
};

exports.DBSession.prototype.close = function(callback) {
  udebug.log('MySQLConnection.close');
  session_stats.closed++;
  this.connectionPool.closeConnection(this, callback);
};

exports.DBSession.prototype.getConnectionPool = function() {
  return this.connectionPool;
};
