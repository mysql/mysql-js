/*
 Copyright (c) 2012, 2018, Oracle and/or its affiliates. All rights
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


/* Requires version 2.0 of Felix Geisendoerfer's MySQL client */

var util   = require('util'),
    path   = require("path"),
    fs     = require("fs"),
    assert = require("assert"),
    config = require("./path_config"),
    jones  = require("database-jones"),
    child_process = require("child_process"),
    existsSync = fs.existsSync || path.existsSync,
    udebug = unified_debug.getLogger("MySQLDictionary.js");

exports.DataDictionary = function(pooledConnection, dbConnectionPool) {
  this.connection = pooledConnection;
  // need connection pool only for type converters
  this.dbConnectionPool = dbConnectionPool;
};

exports.DataDictionary.prototype.listTables = function(databaseName, user_callback) {
  var callback = user_callback;
  var showTables_callback = function(err, rows) {
    if (err) {
      err.sqlstate = err.sqlState;
      callback(err);
    } else {
      var result = [];
      var propertyName = 'Tables_in_' + databaseName;
      rows.forEach(function(row) {
        result.push(row[propertyName]);
      });
      udebug.log('listTables function result:', result);
      callback(err, result);
    }
  };
  this.connection.query('show tables', showTables_callback);
};


function getChainedConverter(databaseTypeConverter, domainTypeConverter) {
  var converter = {};
  if(databaseTypeConverter === undefined) {
    return domainTypeConverter;
  }
  if(domainTypeConverter === undefined) {
    return databaseTypeConverter;
  }
  converter.fromDB = function(value) {
    return domainTypeConverter.fromDB(databaseTypeConverter.fromDB(value));
  };
  converter.toDB = function(value) {
    return databaseTypeConverter.toDB(domainTypeConverter.toDB(value));
  };
  return converter;
}


exports.DataDictionary.prototype.getTableMetadata = function(databaseName, tableName, user_callback) {
  var dbConnectionPool = this.dbConnectionPool;

  // get precision from columnSize e.g. 10,2
  var getPrecision = function(columnSize) {
    var precision = columnSize.split(',')[0];
    return parseInt(precision, 10);
  };

  // get scale from columnSize e.g. 10,2
  var getScale = function(columnSize) {
    var scale = columnSize.split(',')[1];
    return parseInt(scale, 10);
  };

  var decodeIndexColumnNames = function(columnNames) {
    var columnNamesSplit = columnNames.split('`');
    var indexColumnNames = [];
    var k;
    udebug.log_detail('decodeIndexColumnNames columnNamesSplit: ',
                       columnNamesSplit.length, ' ', columnNamesSplit);
    for (k = 1; k < columnNamesSplit.length; k += 2) {
      indexColumnNames.push(columnNamesSplit[k]);
    }
    udebug.log_detail('decodeIndexColumnNames indexColumnNames:', indexColumnNames);
    return indexColumnNames;
  };

  var convertColumnNamesToNumbers = function(columnNames, columns) {
    var result = [];
    var i, j;
    for (i = 0; i < columnNames.length; ++i) {
      udebug.log_detail('convertColumnNamesToNumbers looking for: ', columnNames[i]);
      for (j = 0; j < columns.length; ++j) {
        if (columnNames[i] === columns[j].name) {
          result.push(j);
          break;
        }
      }
    }
    return result;
  };

  var parseCreateTable = function(tableName, statement) {
    udebug.log_detail('parseCreateTable: ', statement);
    var columns = [];
    var indexes = [];
    var foreignKeys = [];
    // PRIMARY unique index must be the first index
    indexes.push({'name': 'PRIMARY PLACEHOLDER'});
    var index, indexName, usingHash;
    var result = {'name' : tableName,
        'database' : databaseName,
        'columns' : columns,
        'indexes' : indexes,
        'foreignKeys': foreignKeys,
        'sparseContainer': null,
        'invalidateCallbacks': [],
        'registerInvalidateCallback': function(cb) {
          result.invalidateCallbacks.push(cb);
        },
        'invalidate': function() {
          result.invalidateCallbacks.forEach(function (cb) {
            cb(result);
          });
          result.invalidateCallbacks = [];
        }
    };
    
    // split lines by '\n'
    var lines = statement.split('\n');
    var i;
    var foreignKey, foreignKeyName, foreignKeyColumnNames;
    var foreignKeyTargetTable, foreignKeyTargetDatabase, foreignKeyTargetWithDatabase;
    var foreignKeyTargetColumnNames;
    var columnNumber = 0;
    var columnNames, indexColumnNames, indexColumnNumbers;
    var column, columnName, columnNumberIndex,
      columnTypeAndSize, columnTypeAndSizeSplit, columnSize, columnType,
      unsigned, nullable, defaultValue, rawDefaultValue, line, tokens, token, j, unique;
    var databaseTypeConverter, domainTypeConverter, charset, collation;
    // first line has table name which we ignore because we already know it
    for (i = 1; i < lines.length; ++i) {
      // var defaultValue;    // if DEFAULT is not specified, defaultValue is undefined
      // var rawDefaultValue; // if DEFAULT is specified, this is the raw text following DEFAULT
      line = lines[i];
      if (line[line.length - 1] === ',') {
        // remove trailing comma from line
        line = line.substr(0, line.length - 1);
      }
      udebug.log_detail('\n parseCreateTable:', line);
      tokens = line.split(' ');
      j = 0; // index into tokens in the line
      token = tokens[j];
      // remove empty tokens
      while (token.length === 0) {
        token = tokens[++j];
      }
      unique = false;
      udebug.log_detail('parseCreateTable token:', token);
      switch (token) {
      case 'PRIMARY':
        // found primary key definition
        j+= 2; // skip 'PRIMARY KEY'
        index = {};
        index.name = 'PRIMARY';
        udebug.log_detail('parseCreateTable PRIMARY:', token);
        index.isPrimaryKey = true;
        index.isUnique = true;
        index.isOrdered = true;
        columnNames = tokens[j];
        indexColumnNames = decodeIndexColumnNames(columnNames);
        udebug.log_detail('parseCreateTable PRIMARY indexColumnNames:', indexColumnNames);
        indexColumnNumbers = convertColumnNamesToNumbers(indexColumnNames, result.columns);
        udebug.log_detail('parseCreateTable PRIMARY indexColumnNumbers: ', indexColumnNumbers);
        index.columnNumbers = indexColumnNumbers;
        // mark primary key index columns with 'isInPrimaryKey'
        for (columnNumberIndex = 0; columnNumberIndex < indexColumnNumbers.length; ++columnNumberIndex) {
          columnNumber = indexColumnNumbers[columnNumberIndex];
          column = columns[columnNumber];
          udebug.log_detail('parseCreateTable marking column', columnNumber,
                             columns[columnNumber].name);
          column.isInPrimaryKey = true;
        }
        indexes[0] =index;
        break;

      case 'UNIQUE':
        // found unique key definition
        udebug.log_detail('parseCreateTable UNIQUE:', token);
        unique = true;
        ++j;
        // continue with KEY handling

      case 'KEY':
        ++j;
        // found key definition, same as unique
        index = {};
        indexName = tokens[j].split('`')[1];
        index.name = indexName;
        if (unique) {
          index.isUnique = true;
        }
        // get column names
        columnNames = tokens[++j];
        indexColumnNames = decodeIndexColumnNames(columnNames);
        udebug.log_detail('parseCreateTable KEY indexColumnNames:', indexColumnNames);
        indexColumnNumbers = convertColumnNamesToNumbers(indexColumnNames, result.columns);
        udebug.log_detail('parseCreateTable KEY indexColumnNumbers:', indexColumnNumbers);
        index.columnNumbers = indexColumnNumbers;

        usingHash = false;
        index.isOrdered = false;
        // get using statement
        if (++j < tokens.length) {
          // more tokens
          usingHash = -1 !== tokens[++j].indexOf('HASH');
        }
        if (!usingHash) {
          // TODO create two index objects for unique btree index
          index.isOrdered = true;
        }
        udebug.log_detail('parseCreateTable for ', indexName, 'KEY USING HASH:', usingHash);
        indexes.push(index);
        break;

      case ')':
        // TODO found engine; get default charset
        break;

      case 'CONSTRAINT':
        foreignKey = {};
        ++j;
        foreignKeyName = tokens[j++].split('`')[1]; // remove surrounding ticks
        foreignKey.name = foreignKeyName;
        // verify it is a FOREIGN KEY
        if (tokens[j] !== 'FOREIGN') {
          // unknown CONSTRAINT type; ignore it for now
          udebug.log_detail('ignoring unknown CONSTRAINT type: ', tokens[j], tokens[j+1], '...');
          break;
        }
        j += 1; // skip past FOREIGN
        if (tokens[j] === 'KEY') {j += 1;} // there may be an extra blank after FOREIGN KEY before column names
        columnNames = tokens[j];
        foreignKeyColumnNames = decodeIndexColumnNames(columnNames);
        udebug.log_detail('parseCreateTable FOREIGN KEY foreignKeyColumnNames:', foreignKeyColumnNames);
        foreignKey.columnNames = foreignKeyColumnNames;
        j += 1; // skip past (`columnName`, ...)
        if (tokens[j] !== 'REFERENCES') {
          // error
          udebug.log_detail('unexpected missing REFERENCES clause for FOREIGN KEY', tokens[j], tokens[j+1], tokens[j+2]);
          break;
          }
        j += 1; // skip past REFERENCES
        foreignKeyTargetWithDatabase = tokens[j].split('.'); // split database and table from `database`.`table`
        if (foreignKeyTargetWithDatabase.length == 2) {
          foreignKeyTargetDatabase = foreignKeyTargetWithDatabase[0].split('`')[1]; // remove surrounding ticks
          foreignKeyTargetTable = foreignKeyTargetWithDatabase[1].split('`')[1]; // remove surrounding ticks
        } else {
          foreignKeyTargetDatabase = databaseName;
          foreignKeyTargetTable = foreignKeyTargetWithDatabase[0].split('`')[1]; // remove surrounding ticks
        }
        foreignKey.targetDatabase = foreignKeyTargetDatabase;
        foreignKey.targetTable = foreignKeyTargetTable; 
        j += 1; // skip past target table name
        columnNames = tokens[j];
        foreignKeyTargetColumnNames =  decodeIndexColumnNames(columnNames);
        udebug.log_detail('parseCreateTable REFERENCES foreignKeyTargetColumnNames:', foreignKeyTargetColumnNames);
        foreignKey.targetColumnNames = foreignKeyTargetColumnNames;
        foreignKeys.push(foreignKey);
        break;

      default:
        // found column definition?
        columnName = (token.split('`'))[1];
        if (columnName === undefined) {
          // not a column; might be e.g. /*!50100 PARTITION BY KEY(i) */
          udebug.log_detail('parseCreateTable ignoring token', token);
          break;
        }
        udebug.log_detail('parseCreateTable: columnName:', columnName);
        nullable = true; // default if no 'NOT NULL' clause
        unsigned = false; // default if no 'unsigned' clause
        column = {};

        column.columnNumber = columnNumber++;
        // decode the column name
        column.name = columnName;
        if(columnName === "SPARSE_FIELDS") {
          // Note: NDB also requires (VARCHAR + UNICODE) or (VARBINARY)
          result.sparseContainer = columnName;
        }
        // analyze column type
        columnTypeAndSize = tokens[++j];
        udebug.log_detail('parseCreateTable: columnDefinition:', columnTypeAndSize);
        columnTypeAndSizeSplit = columnTypeAndSize.split('(');
        columnType = columnTypeAndSizeSplit[0];
        udebug.log_detail('parseCreateTable for: ', columnName, ': columnType: ', columnType);
        column.columnType = columnType.toLocaleUpperCase();
        if (columnTypeAndSizeSplit.length > 1) {
          columnSize = columnTypeAndSizeSplit[1].split(')')[0];
          udebug.log_detail('parseCreateTable for: ', columnName, ': columnSize: ', columnSize);
        }
        ++j;

        // check for unsigned
        if (tokens[j] === 'unsigned') {
          unsigned = true;
          ++j;
        }
        udebug.log_detail('parseCreateTable for:', columnName, ': unsigned: ', unsigned);
        column.isUnsigned = unsigned;

        // add extra metadata specific to type
        switch (columnType) {
        case 'tinyint':   column.intSize = 1; column.isIntegral = true; break;
        case 'smallint':  column.intSize = 2; column.isIntegral = true; break;
        case 'mediumint': column.intSize = 3; column.isIntegral = true; break;
        case 'int':       column.intSize = 4; column.isIntegral = true; break;
        case 'bigint':    column.intSize = 8; column.isIntegral = true; break;
        case 'json':      break;
        case 'decimal' :
          column.precision = getPrecision(columnSize); 
          column.scale = getScale(columnSize); 
          break;
        case 'binary':
        case 'varbinary':
          column.isBinary = true;
          column.length = parseInt(columnSize, 10);
          break;
        case 'char':
        case 'varchar':
          column.length = parseInt(columnSize, 10);
          break;
        case 'blob':
          column.isBinary = true;
          break;
        case 'bit':
          column.length = parseInt(columnSize, 10);
          column.isIntegral = true;
          break;
        default: udebug.log('unknown column type', columnType, '\n', column);
        }
        
        // set the type converter for the column type
        databaseTypeConverter = dbConnectionPool.getDatabaseTypeConverter(column.columnType);
        domainTypeConverter = dbConnectionPool.getDomainTypeConverter(column.columnType);
        if (databaseTypeConverter || domainTypeConverter) {
          column.typeConverter = getChainedConverter(databaseTypeConverter, domainTypeConverter);
        }

        // continue parsing the rest of the column definition line

        // check for character set
        if (tokens[j] === 'CHARACTER') {
          charset = tokens[j + 2];
          udebug.log_detail('parseCreateTable for:', columnName, ': charset: ', charset);
          j += 3; // skip 'CHARACTER SET charset'
          column.charsetName = charset;
          // check for collation
          if (tokens[j] === 'COLLATE') {
            collation = tokens[j + 1];
            udebug.log_detail('parseCreateTable for: ', columnName, ': collation: ', collation);
            column.collationName = collation;
            j+= 2; // skip 'COLLATE collation'
          }
        }
        if (tokens[j] === 'NOT') { // 'NOT NULL' clause
          nullable = false;
          j += 2; // skip 'not null'
        }
        udebug.log_detail('parseCreateTable for: ', columnName, ' NOT NULL: ', !nullable);
        column.isNullable = nullable;
        if (tokens[j] === 'DEFAULT') {
          rawDefaultValue = tokens[j + 1];
          if (rawDefaultValue === 'NULL') {
            // default value is null
            defaultValue = null;
          } else {
            // default value is a quoted string, so separate by \'
            // this will return the first (and presumed only) quoted string in the line
            rawDefaultValue = line.split('\'')[1];
            if (column.isIntegral) {
              defaultValue = parseInt(rawDefaultValue, 10);
            } else {
              defaultValue = rawDefaultValue;
            }
          }
          udebug.log_detail('parseCreateTable for:', columnName,
              'DEFAULT:', rawDefaultValue, 'defaultValue: (', typeof defaultValue, ')', defaultValue);
          // add defaultValue to model
          column.defaultValue = defaultValue;
          j += 2; // skip 'DEFAULT <value>'
        }
        
        if (tokens[j] === 'AUTO_INCREMENT') {
          column.isAutoincrement = true;
          j++; // skip 'AUTO_INCREMENT'
        }

        // add the column description metadata
        columns.push(column);
        break;
      }
    }
    // for each index that is both unique and ordered, make one ordered and a second index unique
    var ordered;
    for (i = 0; i < result.indexes.length; ++i) {
      index = result.indexes[i];
      if (index.isUnique && index.isOrdered) {
        index.isOrdered = false;
        ordered = {};
        ordered.isOrdered = true;
        ordered.isUnique = false;
        ordered.name = index.name;
        ordered.columnNames = index.columnNames;
        ordered.indexColumnNames = index.indexColumnNames;
        ordered.indexColumnNumbers = index.indexColumnNumbers;
        ordered.columnNumbers = index.columnNumbers;
        udebug.log_detail('MySQLDictionary creating second ordered index from unique btree index', index.name);
        indexes.push(ordered);
      }
    }

    return result;
  };

  var callback = user_callback;
  var showCreateTable_callback = function(err, rows) {
    var result;
    if (err) {
      err.sqlstate = err.sqlState;
      udebug.log_detail('MySQLDictonary error from SHOW CREATE TABLE: ' + err);
      callback(err);
    } else {
      udebug.log_detail(rows);
      var row = rows[0];
      // result of show create table is of the form:
      // [ { Table: 'tbl1',
      // 'Create Table': 'CREATE TABLE `tbl1` (\n  `i` int(11) NOT NULL,\n  `j` int(11) DEFAULT NULL,\n  PRIMARY KEY (`i`)\n) ENGINE=ndbcluster DEFAULT CHARSET=latin1' } ]
      // the create table statement is the attribute named 'Create Table'
      var createTableStatement = row['Create Table'];
      var metadata = parseCreateTable(tableName, createTableStatement);
      udebug.log_detail('showCreateTable_callback.forEach metadata:', metadata);
      result = metadata;
      
      callback(null, result);
    }
  };
  this.connection.query('show create table ' + databaseName + '.' + tableName, showCreateTable_callback);
};


/* SQL DDL Utilities
*/
function runSQL(connectionProperties, sqlPath, callback) {
  var engine = connectionProperties.mysql_storage_engine || "ndb";
  var statement = "set default_storage_engine=" + engine + ";\n";
  statement += fs.readFileSync(sqlPath, "ASCII");

  jones.openSession(connectionProperties, function(err, session) {
    udebug.log("MySQLMetadataManager::onSession");
    if(session) {
      var driver = session.dbSession.pooledConnection;
      assert(driver);
      driver.query(statement, function(err) {
        udebug.log("MySQLMetadataManager::onQuery // err:", err);
        session.close();
        callback(err);
      });
    }
    else {
      callback(err);
    }
  });
}

function findMetadataScript(suiteName, suitePath, file) {
  var path1, path2, path3;
  path1 = path.join(config.suites_dir, "standard", suiteName + "-" + file);
  path2 = path.join(config.suites_dir, suiteName, file);
  path3 = path.join(suitePath, file);
  if(existsSync(path1)) {return path1;}
  if(existsSync(path2)) {return path2;}
  if(existsSync(path3)) {return path3;}

  console.log("No path to:", suiteName, file);
}

function MySQLMetadataManager(properties) {
  this.sqlConnectionProperties = new jones.ConnectionProperties(properties);
  this.sqlConnectionProperties.isMetadataOnlyConnection = true;
}

MySQLMetadataManager.prototype.createTestTables = function(suiteName, suitePath, callback) {
  udebug.log("createTestTables", suiteName);
  var sqlPath = findMetadataScript(suiteName, suitePath, 'create.sql');
  runSQL(this.sqlConnectionProperties, sqlPath, callback);
};

MySQLMetadataManager.prototype.dropTestTables = function(suiteName, suitePath, callback) {
  udebug.log("dropTestTables", suiteName);
  var sqlPath = findMetadataScript(suiteName, suitePath, 'drop.sql');
  runSQL(this.sqlConnectionProperties, sqlPath, callback);
};

exports.MetadataManager = function(properties) {
  return new MySQLMetadataManager(properties);
};
