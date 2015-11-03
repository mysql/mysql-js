/*
 Copyright (c) 2014, 2015, Oracle and/or its affiliates. All rights
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

var udebug = unified_debug.getLogger("SQLBuilder.js"),
    assert = require("assert");


function SQLBuilder() {
}


/** Create the INSERT and INSERT... DUPLICATE SQL statements corresponding to the fieldValueDefinedKey.
 * If fieldValueDefinedKey is undefined, include all columns in the statements.
 * If fieldValueDefinedKey contains a string, e.g. 'DUUUD', include only those
 * columns that have a 'D' in the corresponding position.
 */
SQLBuilder.prototype.createInsertSQL = function (dbTableHandler, fieldValueDefinedKey) {
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
    dbTableHandler[this.name].insertSQL = insertSQL;
    dbTableHandler[this.name].duplicateSQL = insertSQL + duplicateSQL;
    udebug.log_detail('insertSQL:', insertSQL);
    udebug.log_detail('duplicateSQL:', insertSQL + duplicateSQL);
  } else {
    dbTableHandler[this.name].insertPartialSQL[fieldValueDefinedKey] = insertSQL;
    dbTableHandler[this.name].duplicatePartialSQL[fieldValueDefinedKey] = insertSQL + duplicateSQL;
    udebug.log_detail('insertPartialSQL[', fieldValueDefinedKey, ']:', insertSQL);
    udebug.log_detail('duplicatePartialSQL[', fieldValueDefinedKey, ']:', insertSQL + duplicateSQL);
  }
};

/** Get the INSERT SQL corresponding to the fieldValueDefinedKey which is a string
 * with a 'D' for each defined value and 'U' for each undefined value.
 * For example, for a table with 5 columns, if the first and last columns have values
 * the value of fieldValueDefinedKey is 'DUUUD'.
 */
SQLBuilder.prototype.getInsertSQL = function(dbTableHandler, fieldValueDefinedKey) {
  var insertSQL = dbTableHandler[this.name].insertPartialSQL[fieldValueDefinedKey];
  if (insertSQL) {
    // insert all columns
    return insertSQL;
  }
  // create the partial SQL for fieldValueDefinedKey
  this.createInsertSQL(dbTableHandler, fieldValueDefinedKey);
  return dbTableHandler[this.name].insertPartialSQL[fieldValueDefinedKey];
};

/** Get the INSERT... DUPLICATE SQL corresponding to the fieldValueDefinedKey which is a string
 * with a 'D' for each defined value and 'U' for each undefined value.
 * For example, for a table with 5 columns, if the first and last columns have values
 * the value of fieldValueDefinedKey is 'DUUUD'.
 */
SQLBuilder.prototype.getDuplicateSQL = function(dbTableHandler, fieldValueDefinedKey) {
  var duplicateSQL = dbTableHandler[this.name].duplicatePartialSQL[fieldValueDefinedKey];
  if (duplicateSQL) {
    // insert all columns on duplicate key update
    return duplicateSQL;
  }
  // create the duplicate partial SQL for fieldValueDefinedKey
  this.createInsertSQL(dbTableHandler, fieldValueDefinedKey);
  return dbTableHandler[this.name].duplicatePartialSQL[fieldValueDefinedKey];
};

SQLBuilder.prototype.createDeleteSQL = function(dbTableHandler, index) {
  // create the delete SQL statement from the table metadata for the named index
  var deleteSQL;
  if (!index) {
    deleteSQL = 'DELETE FROM ' + dbTableHandler.dbTable.database + '.' + dbTableHandler.dbTable.name;
    // return non-index delete statement
  } else {
    deleteSQL = dbTableHandler[this.name].deleteTableScanSQL + ' WHERE ';
    // find the index metadata from the dbTableHandler index section
    // loop over the columns in the index and extract the column name
    var indexMetadatas = dbTableHandler.dbTable.indexes;
    var columns = dbTableHandler.getAllColumnMetadata();
    var separator = '';
    var i, j, indexMetadata;
    for (i = 0; i < indexMetadatas.length; ++i) {
      if (indexMetadatas[i].name === index) {
        indexMetadata = indexMetadatas[i];
        udebug.log_detail('createDeleteSQL indexMetadata: ', indexMetadata);
        for (j = 0; j < indexMetadata.columnNumbers.length; ++j) {
          deleteSQL += separator + columns[indexMetadata.columnNumbers[j]].name + ' = ?';
          separator = ' AND ';
        }
        // for unique btree indexes the first one is the unique index we are interested in
        break;
      }
    }
  }
  udebug.log_detail('getMetadata deleteSQL for', index, ':', deleteSQL);
  return deleteSQL;
};

SQLBuilder.prototype.createSelectSQL = function (dbTableHandler, index) {
  var selectSQL;
  var whereSQL;
  var separator = '';
  var i, j, columns;
  var indexMetadatas, indexMetadata;
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
    indexMetadatas = dbTableHandler.dbTable.indexes;
    separator = '';
    for (i = 0; i < indexMetadatas.length; ++i) {
      if (indexMetadatas[i].name === index) {
        indexMetadata = indexMetadatas[i];
        for (j = 0; j < indexMetadata.columnNumbers.length; ++j) {
          whereSQL += separator + columns[indexMetadata.columnNumbers[j]].name + ' = ? ';
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
};

SQLBuilder.prototype.createWhereSQL = function(dbTableHandler, index) {
  var whereSQL = '';
  var separator = '';
  var i, j, columns;
  columns = dbTableHandler.getAllColumnMetadata();
  if (index) {
    // create the where SQL clause from the table metadata for the named index
    whereSQL = ' WHERE ';

    // loop over the index columns
    // find the index metadata from the dbTableHandler index section
    // loop over the columns in the index and extract the column name
    var indexMetadatas = dbTableHandler.dbTable.indexes;
    var indexMetadata;
    separator = '';
    for (i = 0; i < indexMetadatas.length; ++i) {
      if (indexMetadatas[i].name === index) {
        indexMetadata = indexMetadatas[i];
        for (j = 0; j < indexMetadata.columnNumbers.length; ++j) {
          whereSQL += separator + 't0.' + columns[indexMetadata.columnNumbers[j]].name + ' = ? ';
          separator = ' AND ';
        }
        // for unique btree indexes the first one is the unique index we are interested in
        break;
      }
    }
  }
  return whereSQL;
};

SQLBuilder.prototype.getMetadata = function(dbTableHandler) {
  if (dbTableHandler[this.name]) {
    return;
  }
  udebug.log_detail('getMetadata with dbTableHandler', dbTableHandler.dbTable.name);
  dbTableHandler[this.name] = {};
  dbTableHandler[this.name].indexes = {};
  dbTableHandler[this.name].deleteSQL = {};
  dbTableHandler[this.name].deleteTableScanSQL= this.createDeleteSQL(dbTableHandler);
  dbTableHandler[this.name].selectSQL = {};
  dbTableHandler[this.name].selectTableScanSQL = this.createSelectSQL(dbTableHandler);
  dbTableHandler[this.name].whereSQL = {};
  dbTableHandler[this.name].insertPartialSQL = {};
  dbTableHandler[this.name].duplicatePartialSQL = {};
  
  this.createInsertSQL(dbTableHandler);
  var i, indexes, index;
  // create a delete statement and select statement per index
  indexes = dbTableHandler.dbTable.indexes;
  for (i = 0; i < indexes.length; ++i) {
    index = dbTableHandler.dbTable.indexes[i];
    dbTableHandler[this.name].deleteSQL[index.name] = this.createDeleteSQL(dbTableHandler, index.name);
    dbTableHandler[this.name].selectSQL[index.name] = this.createSelectSQL(dbTableHandler, index.name);
    dbTableHandler[this.name].whereSQL[index.name] = this.createWhereSQL(dbTableHandler, index.name);
  }
};

/** Initialize the projection object for use with a SQL adapter.
 * The projection object is organized into sectors, one for each domain object.
 * A sector contains a count of fields, a list of field names, and the offset
 * column corresponding to the first column mapped to the first field.  All
 * primary key fields are always included, plus any fields identified in the
 * fields array of the corresponding projection for the domain object.
 * Build the sql statement to use for the projection:
 *       SELECT... FROM... WHERE... ORDER BY...
 * For each sector, add the mapped table to the FROM clause including the 
 * join condition. Add the key and non-key columns to the SELECT clause.
 * Add ORDER BY key columns for multi-value relationships.
 */
SQLBuilder.prototype.initializeProjection = function(projection) {
  var i, j;
  var sector, sectorName;
  var relatedSectorName;
  var select, from, on, alias, order;
  var thisOn, otherOn, and;
  var selectDelimiter, fromDelimiter, orderDelimiter;
  var columnName;
  var joinType, joinIndex;
  var offset;
  var keyField, nonKeyField;
  var mysql = {};

  projection[this.name] = mysql;

  // create the sql query for the find method.
  select = 'SELECT ';
  from = ' FROM ';
  order = '';
  selectDelimiter = '';
  fromDelimiter = '';
  orderDelimiter = '';
  alias = 0;
  offset = 0;

  for (i = 0; i < projection.sectors.length; ++i) {
    sector = projection.sectors[i];
    udebug.log_detail('initializeProjection for sector\n', sector);
    // offset of each sector into column in row
    sector.offset = offset;
    offset += sector.keyFields.length + sector.nonKeyFields.length;

    // set up the table names
    sector.tableName = sector.tableHandler.dbTable.database + '.' + sector.tableHandler.dbTable.name;
    sectorName = 't' + i;
    relatedSectorName = 't' + (i - 1);
    joinType = '';
    on = '';
    if (sector.relatedFieldMapping && i > 0) {
      sector.relatedTableName = sector.relatedTableHandler.dbTable.database + '.' + sector.relatedTableHandler.dbTable.name;
      if (sector.relatedFieldMapping.toMany && sector.relatedFieldMapping.manyTo) {
        // join table mapping
        // create a join table reference based on current table name
        // join tables are "between" tables that are joined for many-to-many relationships
        // ... t1 LEFT OUTER JOIN customerdiscount AS t15 on [t1.k = t15.k and...] 
        //     LEFT OUTER JOIN discount AS t2 on [t15.k = t2.k and ...]
        sector.joinTableName = sector.joinTableHandler.dbTable.database + '.' + sector.joinTableHandler.dbTable.name;
        sector.joinTableAlias = relatedSectorName + 'J';
        udebug.log_detail('initializeProjection join table handling for', sector.joinTableName, 'AS', sector.joinTableAlias,
            'thisForeignKey.columnNames', sector.relatedFieldMapping.thisForeignKey.columnNames,
            'otherForeignKey.columnNames', sector.relatedFieldMapping.otherForeignKey.columnNames);
        // generate the join from the previous domain table to the join table
        joinType = ' LEFT OUTER JOIN ';
        thisOn = ' ON ';
        and = '';
        for (joinIndex = 0; joinIndex < sector.relatedFieldMapping.thisForeignKey.columnNames.length; ++joinIndex) {
          thisOn += and + relatedSectorName + '.' + sector.relatedFieldMapping.thisForeignKey.targetColumnNames[joinIndex] + ' = ' +
              sector.joinTableAlias + '.' + sector.relatedFieldMapping.thisForeignKey.columnNames[joinIndex];
          and = ' AND ';
        }
        from += fromDelimiter + joinType + sector.joinTableName + ' AS ' + sector.joinTableAlias + thisOn;

        // generate the join from the join table to this domain table
        otherOn = ' ON ';
        and = '';
        for (joinIndex = 0; joinIndex < sector.relatedFieldMapping.otherForeignKey.columnNames.length; ++joinIndex) {
          otherOn += and + sector.joinTableAlias + '.' + sector.relatedFieldMapping.otherForeignKey.columnNames[joinIndex] + ' = ' +
          sectorName + '.' + sector.relatedFieldMapping.otherForeignKey.targetColumnNames[joinIndex];
          and = ' AND ';
        }
        from += fromDelimiter + joinType + sector.tableName + ' AS ' + sectorName + otherOn;
        
      } else {
        // foreign key mapping for one-to-one, one-to-many, and many-to-one relationships
        joinType = ' LEFT OUTER JOIN ';
        on = ' ON ';
        and = '';
        for (joinIndex = 0; joinIndex < sector.thisJoinColumns.length; ++joinIndex) {
          on += and + relatedSectorName + '.' + sector.otherJoinColumns[joinIndex] + ' = ' + 
                sectorName + '.' + sector.thisJoinColumns[joinIndex];
          and = ' AND ';
        }
        if (sector.relatedFieldMapping.toMany) {
          // order by key columns that can have multiple values (toMany relationships)
          for (j = 0; j < sector.keyFields.length; ++j) {
            keyField = sector.keyFields[j];
            columnName = keyField.columnName;
            order += orderDelimiter + sectorName + '.' + columnName;
            orderDelimiter = ', ';
          }
        }
        from += fromDelimiter + joinType + sector.tableName + ' AS ' + sectorName + on;
      }
    } else {
      // first table is always t0
      from += sector.tableName + ' AS ' + sectorName;
      fromDelimiter = ' ';
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
    mysql.order = 'ORDER BY ' + order;
  } else {
    mysql.order = '';
  }
  // mark this as having been processed
  mysql.id = projection.id;
};


function defaultFieldMeta(fieldMapping) {
  if (fieldMapping.fieldName == 'id') {
    return 'id INT PRIMARY KEY';
  }
  return fieldMapping.fieldName + ' VARCHAR(32) ';
}

function pn(nullable) {return nullable? '': ' NOT NULL ';}
function pu(unsigned) {return unsigned? ' UNSIGNED' : '';}

var translateMeta = {};

translateMeta.binary = function(length, nullable) {return 'BINARY(' + length + ')' +  pn(nullable);};
translateMeta.char = function(length, nullable) {return 'CHAR(' + length + ')' +  pn(nullable);};
translateMeta.date = function(nullable) {return 'DATE' +  pn(nullable);};
translateMeta.datetime = function(fsp, nullable, generated) {
  var sql = 'DATETIME(' +  fsp + ')' + pn(nullable);
  if(generated) { sql += ' DEFAULT CURRENT_TIMESTAMP'; }
  return sql;
};
translateMeta.decimal = function(precision, scale, nullable) {return 'DECIMAL(' + precision + ', ' + scale + ')' +  pn(nullable);};
translateMeta.double = function(nullable) {return 'DOUBLE' +  pn(nullable);};
translateMeta.float = function(nullable) {return 'FLOAT' +  pn(nullable);};
translateMeta.integer = function(bits, unsigned, nullable, generated) {
  var u = pu(unsigned);
  var n = pn(nullable);
  var autoinc = generated ? " AUTO_INCREMENT" : "";
  if (bits < 8)   {return 'BIT' + u + n;}
  if (bits == 8)  {return 'TINYINT' + u + n + autoinc;}
  if (bits <= 16) {return 'SMALLINT' + u + n + autoinc;}
  if (bits <= 24) {return 'MEDIUMINT' + u + n + autoinc;}
  if (bits <= 32) {return 'INT' + u + n + autoinc;}
  /* else */       return 'BIGINT' + u + n + autoinc;
};
translateMeta.interval = function(fsp, nullable) {return 'TIME' + pn(nullable);};
translateMeta.time = function(fsp, nullable) {return 'TIME' + pn(nullable);};
translateMeta.timestamp = function(fsp, nullable, generated) {
  var sql = 'TIMESTAMP' + pn(nullable);
  if(generated) { sql += ' DEFAULT CURRENT_TIMESTAMP'; }
  return sql;
};
translateMeta.varbinary = function(length, lob, nullable) {
  if (lob) {
    return 'BLOB(' + length + ')' + pn(nullable);
  }
  return 'VARBINARY(' + length + ')' + pn(nullable);
};
translateMeta.varchar = function(length, lob, nullable) {
  if (lob) {
    return 'TEXT(' + length + ')' + pn(nullable);
  }
  return 'VARCHAR(' + length + ')' + pn(nullable);
};
translateMeta.year = function(nullable) {return 'YEAR' + pn(nullable);};


SQLBuilder.prototype.getSqlForTableCreation = function (tableMapping, engine) {
  udebug.log('sqlForTableCreation tableMapping', tableMapping, engine);
  var i, field, delimiter = '';
  var meta, tableMeta, columnMeta;
  var sql = 'CREATE TABLE ';
  sql += tableMapping.database;
  sql += '.';
  sql += tableMapping.table;
  sql += '(';
  for (i = 0; i < tableMapping.fields.length; ++i) {
    sql += delimiter;
    delimiter = ', ';
    field = tableMapping.fields[i];
    sql += field.columnName || field.fieldName;
    sql += ' ';
    meta = field.meta;
    if (meta) {
      columnMeta = meta.doit(translateMeta);
      if(meta.defaultVal) {
        columnMeta += ' DEFAULT "' + meta.defaultVal + '"';
      }
      sql += columnMeta;
      if(meta.hasIndex) {
        sql += meta.indexIsUnique ? ' UNIQUE' : '';
        sql += ' KEY ';
      } else {
        sql += meta.isPrimaryKey? ' PRIMARY KEY' : '';
      }
      udebug.log('sqlForTableCreation field:', field.fieldName, 'column:', field.columnName, 'meta:', meta, 'columnMeta:', columnMeta);
    } else {
      sql += defaultFieldMeta(field);
    }
  }
  // process meta for the table
  // need to support PRIMARY and HASH
  for (i = 0; i < tableMapping.meta.length; ++i) {
    tableMeta = tableMapping.meta[i];
    if (tableMeta.isIndex) {
      sql += delimiter;
      if(tableMeta.isPrimaryKey) {
        sql += ' PRIMARY KEY ';
      } else {
        sql += (tableMeta.unique?' UNIQUE ': ' ') + 'INDEX ';
        sql += tableMeta.name || "";
      }
      if(tableMeta.isHash) { sql += "USING HASH"; }
      sql += ' ( ' + tableMeta.columns + ') ';
    }
  }
  sql += ")";
  if(engine) {
    sql += ' ENGINE=' + engine;
  }
  sql += ";";
  udebug.log('sqlForTableMapping sql: ', sql);
  return sql;
};

module.exports = SQLBuilder;

