
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
  this.dictDbSession    = null;
}

/* Capabilities provided by this connection.
*/
DBConnectionPool.prototype.getCapabilities = function() {
  return {
    "UniqueIndexes"     : false,   //  Tables can have secondary unique keys
    "TableScans"        : false,   //  Query can scan a table
    "OrderedIndexScans" : false,   //  Query can scan an index
    "ForeignKeys"       : false    //  Named foreign key relationships
  };
};

/* Async connect 
*/
DBConnectionPool.prototype.connect = function(userCallback) {
  var self, errorNotImplemented;
  self = this;
  errorNotImplemented = new DBOperationError().fromSqlState("0A000");
  this.getDbSession(function(err, dbSession) {
    self.dictDbSession = dbSession;
    userCallback(errorNotImplemented);
  });
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
  * We must check whether dbSession is null, and, if so, provide a dbSession.
  *
  */
DBConnectionPool.prototype.listTables = function(databaseName, dbSession,
                                                 userCallback) {
  var key, args;
  key = "listTables:" + databaseName;
  args = {  "databaseName" : databaseName,
            "dbSession"    : dbSession || this.dictDbSession
         };
  this.dictionaryQueue.add(key, DBDictionary.listTables, args, userCallback);
};


/** Fetch metadata for a table
  * ASYNC
  * We must check whether dbSession is null, and, if so, provide a dbSession.
  *
  */
DBConnectionPool.prototype.getTableMetadata = function(databaseName, tableName,
                                                       dbSession, userCallback) {
  var key, args;
  key = databaseName + "." + tableName;
  args = {  "databaseName" : databaseName,
            "tableName"    : tableName,
            "dbSession"    : dbSession || this.dictDbSession
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
  *
  * We must check whether dbSession is null, and, if so, provide a dbSession.
  */
DBConnectionPool.prototype.createTable = function(tableMapping,
                                                  dbSession,
                                                  userCallback) {
  var key, args;
  key = "createTable:" + tableMapping.database + "." + tableMapping.table;
  args = {  "tableMapping" : tableMapping,
            "dbSession"    : dbSession || this.dictDbSession
         };
  this.dictionaryQueue.add(key, DBDictionary.createTable, args, userCallback);
};


/** Drop a table
  * ASYNC
  *
  * We must check whether dbSession is null, and, if so, provide a dbSession.
  */
DBConnectionPool.prototype.dropTable = function(dbName, tableName, dbSession, userCallback) {
  var key, args;
  key = "dropTable:" + dbName + "." + tableName;
  args = {  "databaseName" : dbName,
            "tableName"    : tableName,
            "dbSession"    : dbSession || this.dictDbSession
         };
  this.dictionaryQueue.add(key, DBDictionary.dropTable, args, userCallback);
};

module.exports = DBConnectionPool;

