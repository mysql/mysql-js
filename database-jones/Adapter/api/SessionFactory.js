/*
 Copyright (c) 2013, 2016, Oracle and/or its affiliates. All rights
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
  "TableHandler" : {
    "success"    : 0,
    "idempotent" : 0,
    "cache_hit"  : 0
    },
  "tables_created" : 0
};

var session        = require("./Session.js"),
    util           = require("util"),
    jones          = require("database-jones"),
    unified_debug  = require("unified_debug"),
    udebug         = unified_debug.getLogger("SessionFactory.js"),
    UserContext    = require("./UserContext.js"),
    meta           = require("./Meta.js"),
    TableMapping   = require("./TableMapping.js"),
    DBTableHandler = require(jones.common.DBTableHandler).DBTableHandler,
    stats_module   = require(jones.api.stats),
    Db             = require("./Db.js");

stats_module.register(stats, "api", "SessionFactory");

  var SessionFactory = function(key, dbConnectionPool, properties, mappings, delete_callback) {
  if (!dbConnectionPool) {
    throw new Error("Fatal internal error; dbConnectionPool must not be null or undefined");
  }
  this.key = key;
  this.dbConnectionPool = dbConnectionPool;
  this.properties = properties;
  this.mappings = mappings;
  this.delete_callback = delete_callback;
  this.sessions = [];
  this.tableHandlers = {};
  this.tableMetadatas = {};
  this.tableMappings  = {}; // mappings for tables
  this.capabilities = dbConnectionPool.getCapabilities();
};

SessionFactory.prototype[util.inspect.custom] = function() {
  var numberOfMappings = this.mappings? this.mappings.length: 0;
  var numberOfSessions = this.sessions? this.sessions.length: 0;
  return "[[API SessionFactory with key:" + this.key + ", " + 
  numberOfMappings + " mappings, " + numberOfSessions + " sessions.]]\n";
};

/** openSession(Object mappings, Function(Object error, Session session, ...) callback, ...);
 * Open new session or get one from a pool.
 * @param mappings a table name, mapped constructor, or array of them
 * @return promise
 */
SessionFactory.prototype.openSession = function(mappings, callback) {
  // if only one argument, it might be a mappings or a callback
  var args = arguments;
  if (arguments.length === 1 && !jones.isMappings(mappings)) {
    args[1] = mappings;
    args[0] = null;
  }
  var context = new UserContext.UserContext(args, 2, 2, null, this);
  context.cacheTableHandlerInSession = true;
  context.user_mappings = args[0];
  // delegate to context for execution
  if(udebug.is_detail()) {udebug.log_detail('SessionFactory.openSession with mappings ', context.user_mappings);}
  return context.openSession();
};


/** Allocate a slot in the sessions array for a new session. 
 * If there are no empty slots, extend the
 * sessions array. Assign a placeholder
 * and return the index into the array. 
 */
SessionFactory.prototype.allocateSessionSlot = function() {
  // allocate a new session slot in sessions
  var i;
  for (i = 0; i < this.sessions.length; ++i) {
    if (this.sessions[i] === null) {
      break;
    }
  }
  this.sessions[i] = {
      'placeholder': true, 
      'index': i,
      // dummy callback in case the session is closed prematurely
      close: function(callback) {
        callback();
      }
  };
  return i;
};


/** Create table ("IF NOT EXISTS") for a table mapping.
 * @param tableMapping
 * @param callback
 * @return promise
 */
SessionFactory.prototype.createTable = function(tableMapping, callback) {
  var context = new UserContext.UserContext(arguments, 2, 1, null, this);
  return context.createTable();
};


/** Drop table ("IF EXISTS")
 *  @param tableNameOrMapping
 *  @param callback
 *  @return promise
 */
SessionFactory.prototype.dropTable = function(tableNameOrMapping, callback) {
  var context = new UserContext.UserContext(arguments, 2, 1, null, this);
  return context.dropTable();
};


/** Drop and create table for a table mapping.
 * @param tableMapping
 * @param callback
 * @return promise
 */
SessionFactory.prototype.dropAndCreateTable = function(tableMapping, callback) {
  var context = new UserContext.UserContext(arguments, 2, 1, null, this);
  return context.dropAndCreateTable();
};


// FIXME: close() should return a promise.
SessionFactory.prototype.close = function(user_callback) {
  var self = this;
  udebug.log('close for key', self.key, 'database', self.properties.database);
  var i;
  var tableKey;
  var numberOfSessionsToClose = 0;
  var closedSessions = 0;

  function closeOnConnectionClose() {
    if(typeof user_callback === 'function') {
      udebug.log_detail('closeOnConnectionClose calling user_callback');
      user_callback();
    }
  }
    
  function closeConnection() {
    if(udebug.is_detail()) {udebug.log_detail(
        'closeConnection calling jones.delete_callback for key', self.key, 'database', self.properties.database);
    }
    self.delete_callback(self.key, self.properties.database, closeOnConnectionClose);
  }

  var onSessionClose = function(err) {
    if (++closedSessions === numberOfSessionsToClose) {
      closeConnection();
    }
  };
  
  // SessionFactory.close starts here
  // invalidate all table metadata objects
  for (tableKey in this.tableMetadatas) {
    if (this.tableMetadatas.hasOwnProperty(tableKey)) {
      this.tableMetadatas[tableKey].invalidate();
    }
  }
  // count the number of sessions to close
  for (i = 0; i < self.sessions.length; ++i) {
    if (self.sessions[i]) {
      ++numberOfSessionsToClose;
    }
  }
  udebug.log('session factory', self.key, 'found', numberOfSessionsToClose, 'sessions to close.'); 
  // if no sessions to close, go directly to close dbConnectionPool
  if (numberOfSessionsToClose === 0) {
    closeConnection();
  }    
  // close the sessions
  for (i = 0; i < self.sessions.length; ++i) {
    if (self.sessions[i]) {
      self.sessions[i].close(onSessionClose);
      self.sessions[i] = null;
    }
  }
};


SessionFactory.prototype.closeSession = function(index, session) {
  this.sessions[index] = null;
};


SessionFactory.prototype.getOpenSessions = function() {
  var result = [];
  var i;
  for (i = 0; i < this.sessions.length; ++i) {
    if (this.sessions[i]) {
      result.push(this.sessions[i]);
    }
  }
  return result;
};


SessionFactory.prototype.registerTypeConverter = function(type, converter) {
  return this.dbConnectionPool.registerTypeConverter(type, converter);
};

/** Get a proxy for a db object similar to "easy to use" api.
 * 
 * @param db_name optional database name to use
 * @return db
 */
SessionFactory.prototype.db = function(db_name) {
  return new Db(this, db_name);
};

/** Associate a table mapping with a table name. This is used for cases where users
 * prefer to use their own table mapping and possibly specify forward mapping meta.
 * This function is immediate.
 */
SessionFactory.prototype.mapTable = function(tableMapping) {
  var database = tableMapping.database || this.properties.database;
  var qualifiedTableName = database + '.' + tableMapping.table;
  this.tableMappings[qualifiedTableName] = tableMapping;
  udebug.log('mapTable', tableMapping, this.properties, qualifiedTableName);
};

/** Create a table mapping for the default case (id, sparse_fields)
 */
function createDefaultTableMapping(qualified_table_name) {
  var tableMapping;
  udebug.log('createDefaultTableMapping for', qualified_table_name);
  tableMapping = new TableMapping.TableMapping(qualified_table_name);
  tableMapping.mapField('id', meta.int(32).primaryKey().autoincrement());
  tableMapping.mapSparseFields('SPARSE_FIELDS', meta.varchar(11111).sparseContainer());
  return tableMapping;
}

/** Create a struct containing database name, unqualified, and qualified table name
 */
function getTableSpecification(defaultDatabaseName, tableName) {
  var split = tableName.split(".");
  var result = {};
  if (split.length == 2) {
    result.dbName = split[0];
    result.unqualifiedTableName = split[1];
    result.qualifiedTableName = tableName;
  } else {
    // if split.length is not 1 then this error will be caught later
    result.dbName = defaultDatabaseName;
    result.unqualifiedTableName = tableName;
    result.qualifiedTableName = defaultDatabaseName + '.' + tableName;
  }
  udebug.log_detail('getTableSpecification for', defaultDatabaseName, ',', tableName, 'returned', result);
  return result;
}

/** Create a table based on the table mapping, which might be user-specified or default mapping
 * This function must not be used by applications.
 */
function createTableInternal(tableMapping, sessionFactory, session, callback) {
  var connectionPool = sessionFactory.dbConnectionPool;

  function createTableOnTableCreated(err) {
    if (err) {
      callback(err);
    } else {
      stats.tables_created++;
      callback();
    }
  }

  // start of createTableInternal
  udebug.log('createTableInternal with tableMapping:', tableMapping);
  connectionPool.createTable(tableMapping, session, createTableOnTableCreated);
}

/** Get the table handler for a table name, constructor, or domain object.
 * This function is used internally by most user-visible functions on Session.
 * Table handler merges table mapping with table metadata from database.
 * The passed userContext is used to store tableSpecification and constructor
 *   between execution of asynchronous functions.
 * The algorithm depends on the type of the first user argument:
 * - Table Name: check session factory for cached table handler. if cached, return it.
 *     if table handler is not cached, get metadata for table;
 *       if exists, create table handler
 *       if table does not exist, check session factory for cached table metadata.
 *         if cached table metadata, create the table.
 *         if no cached table metadata, and session.allowCreateUnmappedTable, create the table.
 *           otherwise, error.
 * - Constructor: check constructor for table handler in constructor.prototype.jones.dbTableHandler
 *     if table handler is cached, return it.
 *     if no table handler, check for table mapping
 *       if no user-specified table mapping, use default table mapping and continue
 *       if user-specified table mapping, create DBTableHandler and cache it in the constructor
 *         otherwise, error.
 * - Domain Object:
 *     get constructor from domain object prototype. goto constructor algorithm.
 * - TableMapping:
 *     get table name from mapping. get metadata for table. get DBTableHandler for mapping.
 */
SessionFactory.prototype.getTableHandler = function(userContext, domainObjectTableNameOrConstructor, session, onTableHandler) {
  var sessionFactory = this;
  var dbTableHandler;
  var tableSpecification;
  var tableMetadata;
  var tableMapping;
  var err;
  var constructor;
  var tableIndicatorType;
  var databaseDotTable;
  var constructorJones;
  var tableKey;

  function onExistingTableMetadata(err, tableMetadata) {
    tableSpecification = userContext.tableSpecification;
    constructor = userContext.handlerCtor;
    var invalidateCallback;

    tableKey = tableSpecification.qualifiedTableName;
    if(udebug.is_detail()) {
      udebug.log_detail('onExistingTableMetadata for ', tableSpecification.qualifiedTableName + ' with err: ' + err);
    }
    if (err) {
      onTableHandler(err, null);
    } else {
      // check to see if the metadata has already been cached
      if (sessionFactory.tableMetadatas[tableKey] === undefined) {
        // put the table metadata into the table metadata map
        sessionFactory.tableMetadatas[tableKey] = tableMetadata;
        invalidateCallback = function() {
          // use " = undefined" here to keep tableKey in the tableMetadatas object
          udebug.log('invalidateCallback called for session factory table metadata for', tableKey);
          sessionFactory.tableMetadatas[tableKey] = undefined;
        };
        tableMetadata.registerInvalidateCallback(invalidateCallback);
      }
      // we have the table metadata; now create the default table handler if not cached
      // do not use the existing cached table handler if processing a new table mapping
      if (userContext.tableIndicatorType === 'tablemapping' ||
          (session.tableHandlers[tableKey] === undefined &&
          sessionFactory.tableHandlers[tableKey] === undefined)) {
        if(udebug.is_detail()) { udebug.log_detail('creating the default table handler for ', tableKey); }
        dbTableHandler = new DBTableHandler(tableMetadata, tableMapping);
        if (dbTableHandler.isValid) {
          // cache the table handler for the table name and table mapping cases
          if (userContext.cacheTableHandlerInSessionFactory) {
            udebug.log('caching the default table handler in the session factory for', tableKey);
            sessionFactory.tableHandlers[tableKey] = dbTableHandler;
            invalidateCallback = function() {
              // use " = undefined" here to keep tableKey in the tableHandlers object
              udebug.log('invalidateCallback called for session factory default table handlers for', tableKey);
              sessionFactory.tableHandlers[tableKey] = undefined;
            };
            tableMetadata.registerInvalidateCallback(invalidateCallback);
          }
          if (userContext.cacheTableHandlerInSession) {
            udebug.log('caching the default table handler in the session for', tableKey);
            session.tableHandlers[tableKey] = dbTableHandler;
            invalidateCallback = function() {
              // use " = undefined" here to keep tableKey in the tableHandlers object
              udebug.log('invalidateCallback called for session default table handlers for', tableKey);
              session.tableHandlers[tableKey] = undefined;
            };
            tableMetadata.registerInvalidateCallback(invalidateCallback);
          }
        } else {
          err = new Error(dbTableHandler.errorMessages);
          udebug.log('onExistingTableMetadata got invalid dbTableHandler', dbTableHandler.errorMessages);
        }
      } else {
        dbTableHandler = session.tableHandlers[tableKey] || sessionFactory.tableHandlers[tableKey];
        udebug.log('onExistingTableMetadata got default dbTableHandler but' +
            ' someone else put it in the cache first for ', tableKey);
      }
      if (constructor) {
        constructorJones = constructor.prototype.jones;
        if (constructorJones === undefined) {
          onTableHandler(new Error('Internal error: constructor.prototype.jones is undefined.'));
          return;
        }
        dbTableHandler = constructorJones.dbTableHandler;
        if (dbTableHandler === undefined) {
          // if a domain object mapping, cache the table handler in the prototype
          tableMapping = constructorJones.mapping;
          dbTableHandler = new DBTableHandler(tableMetadata, tableMapping, constructor);
          if (dbTableHandler.isValid) {
            stats.TableHandler.success++;
            constructorJones.dbTableHandler = dbTableHandler;
            invalidateCallback = function() {
              if(udebug.is_detail()) {
                  udebug.log_detail('invalidateCallback called for constructor', constructor.name,
                  'for table', tableMetadata.database+'.'+tableMetadata.name);
                  constructorJones.dbTableHandler = null;
              }
            };
            tableMetadata.registerInvalidateCallback(invalidateCallback);
            if(udebug.is_detail()) {
              udebug.log('caching the table handler in the prototype for constructor.');
            }
          } else {
            err = new Error(dbTableHandler.errorMessages);
            if(udebug.is_detail()) { udebug.log_detail('got invalid dbTableHandler', dbTableHandler.errorMessages); }
          }
        } else {
          stats.TableHandler.idempotent++;
          if(udebug.is_detail()) {
            if(udebug.is_detail()) { udebug.log_detail('got dbTableHandler but someone else put it in the prototype first.'); }
          }
        }
      }
      userContext.handlerCtor = undefined;
      onTableHandler(err, dbTableHandler);
    }
  }

  function onCreateTable(err) {
    if (err) {
      onExistingTableMetadata(err, null);
    } else {
      sessionFactory.dbConnectionPool.getTableMetadata(tableSpecification.dbName,
          tableSpecification.unqualifiedTableName, session.dbSession, onExistingTableMetadata);
    }
  }

  function onTableMetadata(err, tableMetadata) {
    if (err) {
      // get default tableMapping if not already specified
      tableMapping = tableMapping || sessionFactory.tableMappings[tableSpecification.qualifiedTableName];
      // create the schema if it does not already exist and user flag allows it
      if (!tableMapping && session.allowCreateUnmappedTable) {
        udebug.log('getTableHandler.onTableMetadata creating table for',tableSpecification.qualifiedTableName);
        // create the table from the default table mapping
        tableMapping = createDefaultTableMapping(tableSpecification.qualifiedTableName);
        // cache the default tableMapping
        sessionFactory.tableMappings[tableSpecification.qualifiedTableName] = tableMapping;
      }
      if (tableMapping) {
        createTableInternal(tableMapping, sessionFactory, session, onCreateTable);
        return;
      }
    }
    onExistingTableMetadata(err, tableMetadata);
  }

  function createTableHandler(tableSpecification, dbSession, onTableHandler) {
    userContext.tableSpecification = tableSpecification;
    // first get the table metadata from the cache of table metadatas in session factory
    tableMetadata = sessionFactory.tableMetadatas[tableSpecification.qualifiedTableName];
    if (tableMetadata) {
      // we already have cached the table metadata
      onExistingTableMetadata(null, tableMetadata);
    } else {
      // get the table metadata from the db connection pool
      // getTableMetadata(dbSession, databaseName, tableName, callback(error, DBTable));
      if(udebug.is_detail()) {
        udebug.log_detail('getTableHandler.createTableHandler did not find cached tableMetadata for',
          tableSpecification.qualifiedTableName);
      }
      sessionFactory.dbConnectionPool.getTableMetadata(
          tableSpecification.dbName, tableSpecification.unqualifiedTableName, dbSession, onTableMetadata);
    }

  }

  // handle the case where the parameter is the (possibly unqualified) table name
  function tableIndicatorTypeString() {
    if(udebug.is_detail()) { udebug.log_detail('tableIndicatorTypeString for table', domainObjectTableNameOrConstructor); }

    tableSpecification = getTableSpecification(sessionFactory.properties.database, domainObjectTableNameOrConstructor);
    tableKey = tableSpecification.qualifiedTableName;
    // look up in table name to default table handler hash in session and session factory
    dbTableHandler = session.tableHandlers[tableKey] || sessionFactory.tableHandlers[tableKey];
    if (dbTableHandler === undefined) {
      if(udebug.is_detail()) {
        udebug.log_detail('tableIndicatorTypeString for table name did not find cached dbTableHandler for table', tableKey);
      }
      // create a new table handler for the table
      createTableHandler(tableSpecification, session.dbSession, onTableHandler);
    } else {
      stats.TableHandler.cache_hit++;
      if(udebug.is_detail()) {udebug.log_detail(
          'getTableHandler for table name found cached dbTableHandler for table', tableKey);
      }
      // send back the dbTableHandler to the caller
      onTableHandler(null, dbTableHandler);
    }
  }

  // handle the case where the parameter is the user-defined TableMapping
  function tableIndicatorTypeTableMapping() {
    if(udebug.is_detail()) { udebug.log_detail('tableIndicatorTypeTableMapping for', domainObjectTableNameOrConstructor); }
    tableMapping = domainObjectTableNameOrConstructor;
    if (tableMapping.database) {
      databaseDotTable = tableMapping.database + '.' + tableMapping.table;
    } else {
      databaseDotTable = tableMapping.table;
    }
    tableSpecification = getTableSpecification(sessionFactory.properties.database, databaseDotTable);
    tableKey = tableSpecification.qualifiedTableName;
    // create a new table handler for the table with the user-defined TableHandler
    createTableHandler(tableSpecification, session.dbSession, onTableHandler);
  }

  function tableIndicatorTypeFunction() {
    constructorJones = userContext.handlerCtor.prototype.jones;
    // parameter is a constructor; it must have been annotated already
    if (constructorJones === undefined) {
      err = new Error('User exception: constructor for ' + userContext.handlerCtor.name +
          ' must have been annotated (call TableMapping.applyToClass).');
      onTableHandler(err, null);
    } else {
      dbTableHandler = constructorJones.dbTableHandler;
      if (dbTableHandler === undefined) {
        // create the dbTableHandler from the mapping in the constructor
        if (!constructorJones.mapping.isValid()) {
          udebug.log('tableIndicatorTypeFunction found invalid table mapping:', constructorJones.mapping.error);
          err = new Error(constructorJones.mapping.error);
          onTableHandler(err);
          return;
        }
        databaseDotTable = constructorJones.mapping.database ?
            constructorJones.mapping.database + '.' + constructorJones.mapping.table :
            constructorJones.mapping.table;
        tableSpecification = getTableSpecification(sessionFactory.properties.database, databaseDotTable);
        createTableHandler(tableSpecification, session.dbSession, onTableHandler);
      } else {
        stats.TableHandler.cache_hit++;
        if(udebug.is_detail()) {
            udebug.log('tableIndicatorTypeFunction found cached dbTableHandler in constructor:', dbTableHandler); }
        userContext.handlerCtor = undefined;
        onTableHandler(null, dbTableHandler);
      }
    }
  }


  // start of getTableHandler
  tableIndicatorType = typeof domainObjectTableNameOrConstructor;
  if (tableIndicatorType === 'object' && domainObjectTableNameOrConstructor.constructor.name === 'TableMapping') {
    tableIndicatorType = 'tablemapping';
  }
  userContext.tableIndicatorType = tableIndicatorType;
  if (tableIndicatorType === 'string') {
    userContext.handlerCtor = undefined;
    tableIndicatorTypeString();
  } else if (tableIndicatorType === 'function') {
    userContext.handlerCtor = domainObjectTableNameOrConstructor;
    tableIndicatorTypeFunction();
  } else if (tableIndicatorType === 'object') {
    userContext.handlerCtor = domainObjectTableNameOrConstructor.constructor;
    tableIndicatorTypeFunction();
  } else if (tableIndicatorType === 'tablemapping') {
    userContext.handlerCtor = undefined;
    tableIndicatorTypeTableMapping();
  } else {
    err = new Error('User error: parameter must be a domain object, string, TableMapping or constructor function.');
    onTableHandler(err, null);
  }
};

SessionFactory.prototype.userSessionFactory = function() {
  var sf = this;
  return {
    tableMetadatas:          sf.tableMetadatas,
    database:                sf.database,
    key:                     sf.key,

    db:                      function() {return sf.db.apply(sf,arguments);},
    close:                   function() {return sf.close.apply(sf, arguments);},
    mapTable:                function() {return sf.mapTable.apply(sf, arguments);},
    getTableMetadata:        function() {return sf.getTableMetadata.apply(sf, arguments);},
    openSession:             function() {return sf.openSession.apply(sf, arguments);},
    registerTypeConverter:   function() {return sf.registerTypeConverter.apply(sf, arguments);}
  };
};

exports.SessionFactory = SessionFactory;
