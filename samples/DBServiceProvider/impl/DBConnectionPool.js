
"use strict";

var jones            = require("database-jones"),
    assert           = require("assert"),
    DBSession        = require("./DBSession"),
    DBDictionary     = require("./DBDictionary"),
    DBOperationError = require("./DBOperation").DBOperationError,
    DictionaryCall   = require(jones.common.DictionaryCall);


/* DBConnectionPool constructor.
   IMMEDIATE.
   Does not perform any IO. 
   Throws an exception if the Properties object is not valid.
*/   
function DBConnectionPool(properties) {
  assert(properties.implementation === "sample");
  this.properties       = properties;
  this.typeConverterMap = {};
  this.dictionaryQueue  = new DictionaryCall.Queue();
}


/* Async connect 
*/
DBConnectionPool.prototype.connect = function(userCallback) {
  var error = new DBOperationError().fromSqlState("0A000");
  userCallback(error);
};


/* DBConnection.isConnected() method.
   IMMEDIATE
   Returns bool true/false
 */
DBConnectionPool.prototype.isConnected = function() {
  return false;
};


/* close()
   ASYNC
*/
DBConnectionPool.prototype.close = function(userCallback) {
  userCallback();
};


/* Creates and opens a new DBSession.
   ASYNC.
   Users's callback receives (error, DBSession)
*/
DBConnectionPool.prototype.getDBSession = function(index, userCallback) {
  userCallback(null, new DBSession(this));
};


/** List all tables in the schema.
  * ASYNC
  * 
  */
DBConnectionPool.prototype.listTables = function(databaseName, dbSession,
                                                 userCallback) {
  var key, args;
  key = "listTables:" + databaseName;
  args = { "databaseName" : databaseName,
           "dbSession"    : dbSession
         };
  this.dictionaryQueue.add(key, DBDictionary.listTables, args, userCallback);
};


/** Fetch metadata for a table
  * ASYNC
  * 
  */
DBConnectionPool.prototype.getTableMetadata = function(databaseName, tableName,
                                                       dbSession, userCallback) {
  var key, args;
  key = databaseName + "." + tableName;
  args = {  "databaseName" : databaseName,
            "tableName"    : tableName,
            "dbSession"    : dbSession
         };
  this.dictionaryQueue.add(key, DBDictionary.getTableMetadata, args, userCallback);
};


/* registerTypeConverter(typeName, converterObject) 
   IMMEDIATE
*/
DBConnectionPool.prototype.registerTypeConverter = function(typeName, converter) {
  this.typeConverterMap[typeName] = converter;
};


/** Create a table
  * ASYNC
  * 
  * tableMapping is a TableMapping with possible Meta annotations 
  * indicating column types and indexes.
  */
DBConnectionPool.prototype.createTable = function(tableMapping,
                                                  dbSession,
                                                  userCallback) {
  var key, args;
  key = "createTable:" + tableMapping.table + "." + tableMapping.database;
  args = { "tableMapping" : tableMapping,
           "dbSession"    : dbSession
         };
  this.dictionaryQueue.add(key, DBDictionary.createTable, args, userCallback);
};

module.exports = DBConnectionPool;

