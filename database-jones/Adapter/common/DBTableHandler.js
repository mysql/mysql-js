/*
 Copyright (c) 2012, 2015, Oracle and/or its affiliates. All rights
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
	"constructor_calls"      : 0,
	"created"                : {},
	"default_mappings"       : 0,
	"explicit_mappings"      : 0,
	"return_null"            : 0,
	"result_objects_created" : 0,
	"DBIndexHandler_created" : 0
};

var assert          = require("assert"),
    TableMapping    = jones.TableMapping,
    FieldMapping    = require(jones.api.TableMapping).FieldMapping,
    stats_module    = require(jones.api.stats),
    BitMask         = require(jones.common.BitMask),
    util            = require("util"),
    udebug          = unified_debug.getLogger("DBTableHandler.js");

var DBIndexHandler;

stats_module.register(stats,"spi","DBTableHandler");

/* A DBTableHandler (DBT) combines dictionary metadata with user mappings.  
   It manages setting and getting of columns based on the fields of a 
   user's domain object.  It can also choose an index access path by 
   comapring user-supplied key fields of a domain object with a table's indexes.
   
   These are the structural parts of a DBT: 
     * mapping, an API TableMapping, either created explicitly or by default.
     * A TableMetadata object, obtained from the data dictionary.
     * An internal set of maps between Fields and Columns
     
    The mapping and TableMetadata are supplied as arguments to the 
    constructor, which creates the maps.
    
    Some terms: 
      column number: column order in table as supplied by DataDictionary
      field number: an arbitrary ordering of only the mapped fields 
*/


/* getColumnByName() is a utility function used in the building of maps.
*/
function getColumnByName(dbTable, colName) {
  udebug.log_detail("getColumnByName", colName);
  var i, col;
  
  for(i = 0 ; i < dbTable.columns.length ; i++) {
    col = dbTable.columns[i];
    if(col.name === colName) {
      return col;
    }
  }
  udebug.log("getColumnByName", colName, "NOT FOUND.");
  return null;
}


function DBTableHandlerPrivate() {
  this.resolvedMapping        = null;
  this.columnNumberToFieldMap = [];
  this.fieldNumberToColumnMap = [];
  this.fieldNumberToFieldMap  = [];
  this.fieldNameToFieldMap    = {};
  this.foreignKeyMap          = {};
}

DBTableHandlerPrivate.prototype.inspect = function() {
  return "";
};


/* DBTableHandler() constructor
   IMMEDIATE

   Create a DBTableHandler for a table and a mapping.

   If dbtable is null or has no columns, this function returns null.

   If the tablemapping is null, default mapping behavior will be used.
   Default mapping behavior is to:
     select all columns when reading
     use default domainTypeConverters for all data types
     perform no remapping between field names and column names
*/
function DBTableHandler(dbtable, tablemapping, ctor) {
  var i,               // an iterator
      f,               // a FieldMapping
      c,               // a ColumnMetadata
      n,               // a field or column number
      index,           // a DBIndex
      stubFields,      // fields created through default mapping
      stubFieldNames=[], // names of fields created through default mapping
      foreignKey,      // foreign key object from dbTable
      nMappedFields,
      priv,
      numberOfNotPersistentFields = 0,
      ctorName = 'none';

  stats.constructor_calls++;

  if(! ( dbtable && dbtable.columns)) {
    stats.return_null++;
    return null;
  }

 if(stats.created[dbtable.name] === undefined) {
		stats.created[dbtable.name] = 1;
	} else { 
		stats.created[dbtable.name]++;
	}
  
  /* Default properties */
  priv                        = new DBTableHandlerPrivate();
  this._private               = priv;
  this.dbTable                = dbtable;
  this.ValueObject            = null;
  this.errorMessages          = '\n';
  this.isValid                = true;
  this.autoIncFieldName       = null;
  this.autoIncColumnNumber    = null;
  this.numberOfLobColumns     = 0;
  this.newObjectConstructor   = ctor || null;

  /* New Arrays */
  this.dbIndexHandlers        = [];
  this.relationshipFields     = [];

  /* this.mapping */
  if(tablemapping) {
    if(tablemapping.isValid) {
      stats.explicit_mappings++;
      this.mapping = tablemapping;
    } else {
      this.err = new Error(tablemapping.error || "Invalid TableMapping");
      this.isValid = false;
    }
  }
  else {                                          // Create a default mapping
    stats.default_mappings++;
    this.mapping          = new TableMapping(this.dbTable.name);
    this.mapping.database = this.dbTable.database;
  }

  /* Build the first draft of the columnNumberToFieldMap, using only the
     explicitly mapped fields. */
  if (this.mapping.fields === undefined) {
    this.mapping.fields = [];
  }
  for(i = 0 ; i < this.mapping.fields.length ; i++) {
    f = this.mapping.fields[i];
    udebug.log_detail('DBTableHandler<ctor> field:', f, 'persistent', f.persistent,
                      'relationship', f.relationship);
    if(f && f.persistent) {
      if (!f.relationship) {
        c = getColumnByName(this.dbTable, f.columnName);
        if(c) {
          n = c.columnNumber;
          priv.columnNumberToFieldMap[n] = f;
          f.columnNumber = n;
          f.defaultValue = c.defaultValue;
          f.databaseTypeConverter = c.databaseTypeConverter;
          // use converter or default domain type converter
          if (f.converter) {
            udebug.log_detail('domain type converter for ', f.columnName, ' is user-specified ', f.converter);
            f.domainTypeConverter = f.converter;
          } else {
            udebug.log_detail('domain type converter for ', f.columnName, ' is system-specified ', c.domainTypeConverter);
            f.domainTypeConverter = c.domainTypeConverter;
          }
        } else {
          this.appendErrorMessage(
              'for table ' + dbtable.name + ', field ' + f.fieldName + ': column ' + f.columnName + ' does not exist.');
        }
      } else {
        // relationship field
        this.relationshipFields.push(f);
      }
    } else {
      // increment not-persistent field count
      ++numberOfNotPersistentFields;
    }
  }

  /* Now build the implicitly mapped fields and add them to the map */
  stubFields = [];
  if(this.mapping.mapAllColumns) {
    for(i = 0 ; i < this.dbTable.columns.length ; i++) {
      if(! priv.columnNumberToFieldMap[i]) {
        c = this.dbTable.columns[i];
        udebug.log_detail('DBTableHandler adding unmapped column', c.name);
        f = new FieldMapping(c.name);
        stubFields.push(f);
        stubFieldNames.push(c.name);
        priv.columnNumberToFieldMap[i] = f;
        f.columnNumber = i;
        f.defaultValue = c.defaultValue;
        f.databaseTypeConverter = c.databaseTypeConverter;
        // use converter or default domain type converter
        if (f.converter) {
          udebug.log_detail('domain type converter for ', f.columnName, ' is user-specified ', f.converter);
          f.domainTypeConverter = f.converter;
        } else {
          udebug.log_detail('domain type converter for ', f.columnName, ' is system-specified ', c.domainTypeConverter);
          f.domainTypeConverter = c.domainTypeConverter;
        }
      }
    }
    this.mapping.excludeFields(stubFieldNames);
  }

  /* Total number of mapped fields */
  nMappedFields = this.mapping.fields.length + stubFields.length - numberOfNotPersistentFields;
         
  /* Create the resolved mapping to be returned by getMapping() */
  priv.resolvedMapping = {};
  priv.resolvedMapping.database = this.dbTable.database;
  priv.resolvedMapping.table = this.dbTable.name;
  priv.resolvedMapping.fields = [];

  /* Build fieldNumberToColumnMap, establishing field order.
     Detect the autoincrement column.
     Also build the remaining fieldNameToFieldMap and fieldNumberToFieldMap. */
  for(i = 0 ; i < this.dbTable.columns.length ; i++) {
    c = this.dbTable.columns[i];
    f = priv.columnNumberToFieldMap[i];
    if(c.isAutoincrement) { 
      this.autoIncColumnNumber = i;
      this.autoIncFieldName = f.fieldName;
    }
    if(c.isLob) {
      this.numberOfLobColumns++;
    }    
    priv.resolvedMapping.fields[i] = {};
    if(f) {
      f.fieldNumber = i;
      priv.fieldNumberToColumnMap.push(c);
      priv.fieldNumberToFieldMap.push(f);
      priv.fieldNameToFieldMap[f.fieldName] = f;
      priv.resolvedMapping.fields[i].columnName = f.columnName;
      priv.resolvedMapping.fields[i].fieldName = f.fieldName;
      priv.resolvedMapping.fields[i].persistent = true;
    }
  }
  var map = priv.fieldNameToFieldMap;
  // add the relationship fields that are not mapped to columns
  this.relationshipFields.forEach(function(relationship) {
    map[relationship.fieldName] = relationship;
  });
  
  if (nMappedFields !== priv.fieldNumberToColumnMap.length + this.relationshipFields.length) {
    if (ctor && ctor.name) {
      ctorName = (ctor.name.length === 0)?'anonymous '+ctor:ctor.name;
    }
    this.appendErrorMessage(
        'Mismatch between number of mapped fields and columns for ' + ctorName + 
        '\n mapped fields: ' + nMappedFields +
        ', mapped columns: ' + priv.fieldNumberToColumnMap.length +
        ', mapped relationships: ' + this.relationshipFields.length);
  }

  // build dbIndexHandlers; one for each dbIndex, starting with primary key index 0
  for (i = 0; i < this.dbTable.indexes.length; ++i) {
    // a little fix-up for primary key unique index:
    index = this.dbTable.indexes[i];
    udebug.log_detail('DbTableHandler<ctor> creating DBIndexHandler for', index);
    if (index.name === undefined) {
      index.name = 'PRIMARY';
    }
    // make sure all index columns are mapped
    this.dbIndexHandlers.push(new DBIndexHandler(this, index));
  }
  // build foreign key map
  for (i = 0; i < this.dbTable.foreignKeys.length; ++i) {
    foreignKey = this.dbTable.foreignKeys[i];
    priv.foreignKeyMap[foreignKey.name] = foreignKey;
  }

  if (!this.isValid) {
    this.err = new Error(this.errorMessages);
  }
  
  if (ctor) {
    // cache this in ctor.prototype.jones.dbTableHandler
    if (!ctor.prototype.jones) {
      ctor.prototype.jones = {};
    }
    if (!ctor.prototype.jones.dbTableHandler) {
      ctor.prototype.jones.dbTableHandler = this;
    }
  }
  udebug.log("new completed");
  udebug.log_detail("DBTableHandler<ctor>:\n", this);
}

DBTableHandler.prototype.getResolvedMapping = function() {
  return this._private.resolvedMapping;
};

DBTableHandler.prototype.getColumn = function(i) {
  return this._private.fieldNumberToColumnMap[i];
};

DBTableHandler.prototype.getAllColumns = function() {
  return this._private.fieldNumberToColumnMap;
};

DBTableHandler.prototype.getNumberOfColumns = function() {
  return this._private.fieldNumberToColumnMap.length;
};

DBTableHandler.prototype.getField = function(i) {
  switch(typeof i) {
    case 'number':
      return this._private.fieldNumberToFieldMap[i];
    case 'string':
      return this._private.fieldNameToFieldMap[i];
  }
};

DBTableHandler.prototype.getAllFields = function() {
  return this._private.fieldNumberToFieldMap;
};

DBTableHandler.prototype.getFieldForColumn = function(i) {
  return this._private.columnNumberToFieldMap[i];
};

DBTableHandler.prototype.getNumberOfFields = function() {
  return this._private.fieldNumberToFieldMap.length;
};

DBTableHandler.prototype.describe = function() {
  var s = "DBTableHandler for table " + this.dbTable.name +
          " with " + this.getNumberOfFields() + " mapped fields ";
  return s;
};

/** Append an error message and mark this DBTableHandler as invalid.
 */
DBTableHandler.prototype.appendErrorMessage = function(msg) {
  this.errorMessages += '\n' + msg;
  this.isValid = false;
};


/* DBTableHandler.newResultObject
   IMMEDIATE
   
   Create a new object using the constructor function (if set).
*/
DBTableHandler.prototype.newResultObject = function(values, adapter) {
  udebug.log("newResultObject");
  stats.result_objects_created++;
  var newDomainObj;
  
  if(this.newObjectConstructor && this.newObjectConstructor.prototype) {
    newDomainObj = Object.create(this.newObjectConstructor.prototype);
  }
  else {
    newDomainObj = {};
  }
  
  if(this.newObjectConstructor) {
    udebug.log("newResultObject calling user constructor");
    this.newObjectConstructor.call(newDomainObj);
  }

  if (typeof values === 'object') {
    // copy values into the new domain object
    this.setFields(newDomainObj, values, adapter);
  }
  udebug.log("newResultObject done", newDomainObj);
  return newDomainObj;
};


/* DBTableHandler.newResultObjectFromRow
 * IMMEDIATE

 * Create a new object using the constructor function (if set).
 * Values for the object's fields come from the row; first the key fields
 * and then the non-key fields. The row contains items named '0', '1', etc.
 * The value for the first key field is in row[offset]. Values obtained
 * from the row are first processed by the db converter and type converter
 * if present.
 */
DBTableHandler.prototype.newResultObjectFromRow = function(row, adapter,
    offset, keyFields, nonKeyFields) {
  var fieldIndex;
  var rowValue;
  var field;
  var newDomainObj;

  udebug.log("newResultObjectFromRow");
  stats.result_objects_created++;

  if(this.newObjectConstructor && this.newObjectConstructor.prototype) {
    newDomainObj = Object.create(this.newObjectConstructor.prototype);
  } else {
    newDomainObj = {};
  }

  if(this.newObjectConstructor) {
    udebug.log("newResultObject calling user constructor");
    this.newObjectConstructor.call(newDomainObj);
  }
  // set key field values from row using type converters

  for (fieldIndex = 0; fieldIndex < keyFields.length; ++fieldIndex) {
    rowValue = row[offset + fieldIndex];
    field = keyFields[fieldIndex];
    this.set(newDomainObj, field.fieldNumber, rowValue, adapter);
  }
  
  // set non-key field values from row using type converters
  offset += keyFields.length;
  for (fieldIndex = 0; fieldIndex < nonKeyFields.length; ++fieldIndex) {
    rowValue = row[offset + fieldIndex];
    field = nonKeyFields[fieldIndex];
    this.set(newDomainObj, field.fieldNumber, rowValue, adapter);
  }
  
  udebug.log("newResultObjectFromRow done", newDomainObj.constructor.name, newDomainObj);
  return newDomainObj;
};

/** applyMappingToResult(object)
 * IMMEDIATE
 * Apply the table mapping to the result object. The result object
 * has properties corresponding to field names whose values came
 * from the database. If a domain object is needed, a new domain
 * object is created and values are copied from the result object.
 * The result (either the original result object or a new domain
 * object) is returned.
 * @param obj the object to which to apply mapping
 * @return the object to return to the user
 */
DBTableHandler.prototype.applyMappingToResult = function(obj, adapter) {
  if (this.newObjectConstructor) {
    // create the domain object from the result
    obj = this.newResultObject(obj, adapter);
  } else {
    this.applyFieldConverters(obj, adapter);
  }
  return obj;
};


/** applyFieldConverters(object) 
 *  IMMEDIATE
 *  Apply the field converters to an existing object
 */ 
DBTableHandler.prototype.applyFieldConverters = function(obj, adapter) {
  var i, f, value, convertedValue;
  var databaseTypeConverter;
  for (i = 0; i < this.getNumberOfFields(); i++) {
    f = this.getField(i);
    databaseTypeConverter = f.databaseTypeConverter && f.databaseTypeConverter[adapter];
    if (databaseTypeConverter) {
      value = obj[f.fieldName];
      convertedValue = databaseTypeConverter.fromDB(value);
      obj[f.fieldName] = convertedValue;
    }
    if(f.domainTypeConverter) {
      value = obj[f.fieldName];
      convertedValue = f.domainTypeConverter.fromDB(value, obj, f);
      if (convertedValue !== undefined) {
        obj[f.fieldName] = convertedValue;
      }
    }
  }
};


/* setAutoincrement(object, autoincrementValue) 
 * IMMEDIATE
 * Store autoincrement value into object
 */
DBTableHandler.prototype.setAutoincrement = function(object, autoincrementValue) {
  if(typeof this.autoIncColumnNumber === 'number') {
    object[this.autoIncFieldName] = autoincrementValue;
    udebug.log("setAutoincrement", this.autoIncFieldName, ":=", autoincrementValue);
  }
};


/* getMappedFieldCount()
   IMMEDIATE   
   Returns the number of fields mapped to columns in the table 
*/
DBTableHandler.prototype.getMappedFieldCount = function() {
  udebug.log_detail("getMappedFieldCount");
  return this._private.fieldNumberToColumnMap.length;
};


/* allColumnsMapped()
   IMMEDIATE   
   Boolean: returns True if all columns are mapped
*/
DBTableHandler.prototype.allColumnsMapped = function() {
  return (this.dbTable.columns.length === this._private.fieldNumberToColumnMap.length);
};

/** allFieldsIncluded(values)
 *  IMMEDIATE
 *  returns array of indexes of fields included in values
 */
DBTableHandler.prototype.allFieldsIncluded = function(values) {
  // return a list of fields indexes that are found
  // the caller can easily construct the appropriate database statement
  var i, result = [];
  for (i = 0; i < this.getNumberOfFields(); ++i) {
    if (values[i] !== undefined) {
      result.push(i);
    }
  }
  return result;
};

/* getColumnMetadata() 
   IMMEDIATE 
   
   Returns an array containing ColumnMetadata objects in field order
*/   
DBTableHandler.prototype.getColumnMetadata = function() {
  return this._private.fieldNumberToColumnMap;
};


/* chooseIndex(keys, allowUnique, allowScan)
 Returns a preferred DBIndexHandler, or null if none available.
 From API Context.find():
   * The parameter "keys" may be of any type. Keys must uniquely identify
   * a single row in the database. If keys is a simple type
   * (number or string), then the parameter type must be the 
   * same type as or compatible with the primary key type of the mapped object.
   * Otherwise, properties are taken
   * from the parameter and matched against property names in the
   * mapping.
*/
DBTableHandler.prototype.chooseIndex = function(keys, allowUnique, allowScan) {
  var indexHandler, fieldName, field, predicate, ncol, pkcol0;

  udebug.log("chooseIndex for:", keys);
  indexHandler = null;
  ncol = this.getNumberOfColumns();

  /* Create bitmasks over the key columns */
  predicate = {
    "usedColumnMask"  : new BitMask(ncol),   // all keys
    "equalColumnMask" : new BitMask(ncol)    // only non-null keys
  };

  if((typeof keys === 'number' || typeof keys === 'string')) {
    /* A simple key value represents first column of primary key */
    pkcol0 = this.dbTable.indexes[0].columnNumbers[0];
    predicate.usedColumnMask.set(pkcol0);
    predicate.equalColumnMask.set(pkcol0);
  }
  else {
    for (fieldName in keys) {
      if (keys.hasOwnProperty(fieldName) && keys[fieldName] !== undefined ) {
        field = this.getField(fieldName);
        if(field) {
          predicate.usedColumnMask.set(field.columnNumber);
          if(keys[fieldName] !== null) {
            predicate.equalColumnMask.set(field.columnNumber);
          }
        }
      }
    }
  }
  udebug.log("KeyMasks:", predicate);

  /* Look for a unique index */
  if(allowUnique) {
    indexHandler = this.chooseUniqueIndexForPredicate(predicate);
  }

  /* Look for an ordered index */
  if(allowScan && ! indexHandler) {
    indexHandler = this.chooseOrderedIndexForPredicate(predicate);
  }

  return indexHandler;
};

/* Return the first unique index that matches all predicate columns
*/
DBTableHandler.prototype.chooseUniqueIndexForPredicate = function(predicate) {
  var i, idxs, indexHandler, columnMask;
  columnMask = predicate.equalColumnMask;
  idxs = this.dbTable.indexes;
  for(i = 0 ; i < idxs.length ; i++) {
    if(idxs[i].isUnique) {
      indexHandler = this.getHandlerForIndex(i);
      if(columnMask.and(indexHandler.columnMask).isEqualTo(indexHandler.columnMask)) {
        return indexHandler;
      }
    }
  }
  return null;
};

/* Score all ordered indexes and return the one with the best score
*/
DBTableHandler.prototype.chooseOrderedIndexForPredicate = function(predicate) {
  var i, idxs, indexHandler, score, highScore, highScorer;
  idxs = this.dbTable.indexes;
  highScore = 0;
  highScorer = null;
  for(i = 0 ; i < idxs.length ; i++) {
    if(idxs[i].isOrdered) {
      indexHandler = this.getHandlerForIndex(i);
      score = indexHandler.score(predicate);
      udebug.log("Ordered index", i, "scored", score);
      if(score > highScore) {
        highScore = score;
        highScorer = indexHandler;
      }
    }
  }
  return highScorer;
};

/** Return the property of obj corresponding to fieldNumber.
 * If a domain type converter and/or database type converter is defined, convert the value here.
 * If a fieldValueDefinedListener is passed, notify it via setDefined or setUndefined for each column.
 * Call setDefined if a column value is defined in the object and setUndefined if not.
 */
DBTableHandler.prototype.get = function(obj, fieldNumber, adapter, fieldValueDefinedListener) { 
  udebug.log_detail("get", fieldNumber);
  if (typeof obj === 'string' || typeof obj === 'number') {
    if (fieldValueDefinedListener) {
      fieldValueDefinedListener.setDefined(fieldNumber);
    }
    return obj;
  }
  var f = this.getField(fieldNumber);
  var result;
  if (!f) {
    throw new Error('FatalInternalError: field number does not exist: ' + fieldNumber);
  }
  if(f.domainTypeConverter) {
    result = f.domainTypeConverter.toDB(obj[f.fieldName], obj, f);
  }
  else {
    result = obj[f.fieldName];
  }
  var databaseTypeConverter = f.databaseTypeConverter && f.databaseTypeConverter[adapter];
  if (databaseTypeConverter && result !== undefined) {
    result = databaseTypeConverter.toDB(result);
  }
  if (fieldValueDefinedListener) {
    if (result === undefined) {
      fieldValueDefinedListener.setUndefined(fieldNumber);
    } else {
      if (this._private.fieldNumberToColumnMap[fieldNumber].isBinary && result.constructor && result.constructor.name !== 'Buffer') {
        var err = new Error('Binary field with non-Buffer data for field ' + f.fieldName);
        err.sqlstate = '22000';
        fieldValueDefinedListener.err = err;
      }
      fieldValueDefinedListener.setDefined(fieldNumber);
    }
  }
  return result;
};


/** Return the property of obj corresponding to fieldNumber.
*/
DBTableHandler.prototype.getFieldsSimple = function(obj, fieldNumber) {
  var f = this._private.fieldNumberToFieldMap[fieldNumber];
  if(f.domainTypeConverter) {
    return f.domainTypeConverter.toDB(obj[f.fieldName], obj, f);
  }
  return obj[f.fieldName];
};
  
  
/* Return an array of values in field order */
DBTableHandler.prototype.getFields = function(obj) {
  var i, n, fields;
  fields = [];
  n = this.getMappedFieldCount();
  switch(typeof obj) {
    case 'number':
    case 'string':
      fields.push(obj);
      break;
    default: 
      for(i = 0 ; i < n ; i++) { fields.push(this.getFieldsSimple(obj, i)); }
  }
  return fields;
};


/* Return an array of values in field order */
DBTableHandler.prototype.getFieldsWithListener = function(obj, adapter, fieldValueDefinedListener) {
  var i, fields = [];
  for( i = 0 ; i < this.getMappedFieldCount() ; i ++) {
    fields[i] = this.get(obj, i, adapter, fieldValueDefinedListener);
  }
  return fields;
};


/* Set field to value */
DBTableHandler.prototype.set = function(obj, fieldNumber, value, adapter) {
  udebug.log_detail("set", fieldNumber);
  var f = this.getField(fieldNumber);
  var userValue = value;
  var databaseTypeConverter;
  if(f) {
    databaseTypeConverter = f.databaseTypeConverter && f.databaseTypeConverter[adapter];
    if (databaseTypeConverter) {
      userValue = databaseTypeConverter.fromDB(value);
    }
    if(f.domainTypeConverter) {
      userValue = f.domainTypeConverter.fromDB(userValue, obj, f);
    }
    udebug.log_detail('DBTableHandler.set', f.fieldName, 'value', userValue);
    if (userValue === undefined) {
      delete obj[f.fieldName];
    } else {
      obj[f.fieldName] = userValue;
    }
    return true; 
  }
  return false;
};


/* Set all member values of object from a value object, which
 * has properties corresponding to field names. 
 * User-defined column conversion is handled in the set method.
*/
DBTableHandler.prototype.setFields = function(obj, values, adapter) {
  var i, f, value, fieldName;
  for (i = 0; i < this.getNumberOfFields(); ++i) {
    f = this.getField(i);
    fieldName = f.fieldName;
    value = values[fieldName];
    if (value !== undefined) {
      this.set(obj, i, value, adapter);
    }
  }
};

/* Functions to get IndexHandlers 
*/
DBTableHandler.prototype.getHandlerForIndex = function(n) {
  return this.dbIndexHandlers[n];
};


/* DBTableHandler getIndexHandler(Object keys)
   IMMEDIATE

   Given an object containing keys as defined in API Context.find(),
   choose an index to use as an access path for the operation,
   and return a DBIndexHandler for that index.
*/
DBTableHandler.prototype.getIndexHandler = function(keys) {
  return this.chooseIndex(keys, true, true);
};

DBTableHandler.prototype.getUniqueIndexHandler = function(keys) {
  return this.chooseIndex(keys, true, false);
};

DBTableHandler.prototype.getOrderedIndexHandler = function(keys) {
  return this.chooseIndex(keys, false, true);
};

DBTableHandler.prototype.getForeignKey = function(foreignKeyName) {
  return this._private.foreignKeyMap[foreignKeyName];
};

DBTableHandler.prototype.getForeignKeyNames = function() {
  return Object.keys(this._private.foreignKeyMap);
};


//////// DBIndexHandler             /////////////////

DBIndexHandler = function(parent, dbIndex) {
  udebug.log("DBIndexHandler constructor");
  stats.DBIndexHandler_created++;
  var i, colNo, mask;

  this.tableHandler = parent;
  this.dbIndex = dbIndex;
  this.indexColumnNumbers = dbIndex.columnNumbers;
  this.columnMask = null;
  this.singleColumn = null;
  this._private = {};
  this._private.fieldNumberToColumnMap = [];
  this._private.fieldNumberToFieldMap  = [];

  /* Create a bitmask representing the columns in this index */
  mask = new BitMask(parent.dbTable.columns.length);
  this.indexColumnNumbers.forEach(function(columnNumber) {
    mask.set(columnNumber);
  });
  this.columnMask = mask;

  for(i = 0 ; i < dbIndex.columnNumbers.length ; i++) {
    colNo = dbIndex.columnNumbers[i];
    this._private.fieldNumberToFieldMap[i]  = parent._private.columnNumberToFieldMap[colNo];
    this._private.fieldNumberToColumnMap[i] = parent.dbTable.columns[colNo];
  }
  
  if(i === 1) {this.singleColumn = this.getColumn(0);}   // One-column index
};

/* DBIndexHandler inherits some methods from DBTableHandler 
*/
DBIndexHandler.prototype = {
  getMappedFieldCount    : DBTableHandler.prototype.getMappedFieldCount,   
  get                    : DBTableHandler.prototype.get,   
  getFieldsSimple        : DBTableHandler.prototype.getFieldsSimple,
  getFields              : DBTableHandler.prototype.getFields,
  getColumnMetadata      : DBTableHandler.prototype.getColumnMetadata,
  getColumn              : DBTableHandler.prototype.getColumn,
  getNumberOfColumns     : DBTableHandler.prototype.getNumberOfColumns,
  getNumberOfFields      : DBTableHandler.prototype.getNumberOfFields,
  getField               : DBTableHandler.prototype.getField
};

/* Determine whether index is usable for a particular Query predicate
*/
DBIndexHandler.prototype.isUsable = function(predicate) {
  var usable = false;
  if(this.dbIndex.isUnique) {
    usable = predicate.equalColumnMask.and(this.columnMask).isEqualTo(this.columnMask);
  } else if(this.dbIndex.isOrdered) {
    usable = predicate.usedColumnMask.bitIsSet(this.indexColumnNumbers[0]);
  }
  return usable;
};

/* Score an index for a Query predicate.
   Score 1 point for each consecutive key part used plus 1 more point
   if the column is in QueryEq. 
*/
DBIndexHandler.prototype.score = function(predicate) {
  var score, point, i, colNo;
  score = 0;
  i = 0;
  do {
    colNo = this.indexColumnNumbers[i];
    point = predicate.usedColumnMask.bitIsSet(colNo);
    if(point) { 
      score += 1;
      if(predicate.equalColumnMask.bitIsSet(colNo)) {
        score += 1;
      }
    }
    i++;
  } while(point && i < this.indexColumnNumbers.length);

  udebug.log_detail('score', this.dbIndex.name, 'is', score);
  return score;
};



exports.DBTableHandler = DBTableHandler;
