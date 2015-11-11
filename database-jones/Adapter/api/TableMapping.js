/*
 Copyright (c) 2015, Oracle and/or its affiliates. All rights
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

var udebug       = unified_debug.getLogger("TableMapping.js"),
    path         = require("path"),
    util         = require("util"),
    assert       = require("assert"),
    Meta         = require("./Meta");

/* file scope mapping id used to uniquely identify a mapped domain object */
var mappingId = 0;


//////// FieldMapping             /////////////////

function FieldMapping(fieldName) {
  this.fieldName        = fieldName;
  this.persistent       = true;
}


//////// Relationship             /////////////////

function Relationship() {
  this.relationship = true;
  this.persistent   = true;
  this.toMany       = false;
  this.manyTo       = false;
  this.target       = null;   // a mapped constructor
  this.targetField  = "";
  this.columnName   = "";
  this.foreignKey   = "";
  this.converter    = null;
  this.error        = "";
}

function OneToOneMapping() {
  Relationship.call(this);
}

function OneToManyMapping() {
  Relationship.call(this);
  this.toMany     = true;
}

function ManyToOneMapping() {
  Relationship.call(this);
  this.manyTo     = true;
}

function ManyToManyMapping() {
  Relationship.call(this);
  this.toMany     = true;
  this.manyTo     = true;
  this.joinTable  = "";
}



//////// Functions to verify the validity of an object literal

function noCheck() {
  return true;
}

function isString(value) { 
  return (typeof value === 'string');
}

function isNonEmptyString(value) {
  return (typeof value === 'string' && value.length > 0);
}

function isEmptyString(value) {
  return (value === "");
}

function isBool(value) {
  return (value === true || value === false);
}

function isBoolOrNull(value) {
  return (value === true || value === false || value === null);
}

function isConverter(converter) {
  return ((converter === null) || 
            (typeof converter === 'object'
             && typeof converter.toDB === 'function' 
             && typeof converter.fromDB === 'function'));
}

function isConverterMap(obj) {
  var property;
  for(property in obj) {
    if(obj.hasOwnProperty(property)) {
      if(! isConverter(obj[property])) {
        return false;
      }
    }
  }
  return true;
}

function isFunction(value) {
  return (typeof value === 'function');
}

function isMeta(value) {
  return (value && value.isMeta && value.isMeta());
}

function isLiteralMeta(value) {
  return (value && typeof value === 'object' && typeof value.isNullable === 'boolean');
}

function isMetaOrLiteral(value) {
  return (isMeta(value) || isLiteralMeta(value));
}

function isMinimalField(value) {
  return (typeof value === 'object' && value !== null
          && typeof value.fieldName === 'string');
}

function isArrayOf(elementVerifier) {
  assert.equal(typeof elementVerifier, "function");

  return function(value) {
    var i;
    if(! Array.isArray(value)) { return false; }
    for(i = 0 ; i < value.length ; i++) {
      if(! elementVerifier(value[i])) { return false; }
    }
    return true;
  };
}

function isElementOrArrayOf(elementVerifier) {
  var arrayVerifier;

  assert.equal(typeof elementVerifier, "function");
  arrayVerifier = isArrayOf(elementVerifier);

  return function(value) {
    return Array.isArray(value) ? arrayVerifier(value) : elementVerifier(value);
  };
}

function LiteralObjectVerifier() {
  this.requiredProperties = [];   // List of property names
  this.allowedProperties  = [];   // List of property names
  this.verifiers          = {};   // Map property name => verifier function
  // Any literal object can have a property "user" which we ignore
  this.set("user", noCheck);
}

LiteralObjectVerifier.prototype.set = function(name, verifier) {
  this.allowedProperties.push(name);
  this.verifiers[name] = verifier;
  return this;  // chainable
};

LiteralObjectVerifier.prototype.setRequired = function(property) {
  this.requiredProperties.push(property);
  return this;  // chainable
};

// These functions return error message, or empty string if valid
LiteralObjectVerifier.prototype.checkProperty = function(property, value) {
  var msg = "";
  if(typeof this.verifiers[property] === 'function') {
    if(! this.verifiers[property](value)) {
      msg = "property " + property + " invalid: " + JSON.stringify(value);
    }
  } else {
    msg = "unknown property " + property + "; " ;
  }
  return msg;
};

LiteralObjectVerifier.prototype.getErrors = function(literal) {
  var property, msg, i, req;
  msg = "";
  for(property in literal) {
    if(literal.hasOwnProperty(property)) {
      msg += this.checkProperty(property, literal[property]);
    }
  }
  for(i = 0; i < this.requiredProperties.length ; i++) {
    req = this.requiredProperties[i];
    if(! literal.hasOwnProperty(req)) {
      msg += "Required property '" + req + "' is missing; ";
    }
  }
  return msg;
};

LiteralObjectVerifier.prototype.buildObjectFromLiteral = function(object, literal) {
  var i, key, errors;
  errors = this.getErrors(literal);
  if(! errors.length) {
    for(i = 0 ; i < this.allowedProperties.length ; i++) {
      key = this.allowedProperties[i];
      if(literal[key] !== undefined) {
        object[key] = literal[key];
      }
    }
  }
  return errors;
};

function getValidator(literalObjectVerifier) {
  return function(value) {
    var errors = literalObjectVerifier.getErrors(value);
    return (errors.length === 0);
  };
}


//////// Allowed properties in literal values

function BasicFieldVerifier() {
  var that = new LiteralObjectVerifier();
  // properties that can be present in any field-related literal
  that.set("fieldName", isNonEmptyString);
  that.set("columnName", isString);
  that.set("persistent", isBool);
  that.set("converter", isConverter);
  that.set("relationship", isBool);
  that.setRequired("fieldName");
  return that;
}

/* A FieldMapping literal can have any of the basic properties, plus "meta" */
var fieldMappingProperties =
  new BasicFieldVerifier().
    set("toManyColumns", isArrayOf(isString)).
    set("meta", isMetaOrLiteral);

function RelationshipVerifier(type, ctor) {
  var that = new BasicFieldVerifier();
  that.type = type;
  that.ctor = ctor;
  // properties that can be present in any relationship literal:
  that.set("target", isFunction);
  that.setRequired("target");
  that.set("targetField", isNonEmptyString);
  return that;
}

var manyToOneMappingProperties =
  new RelationshipVerifier("ManyToOne", ManyToOneMapping).
    set("foreignKey", isNonEmptyString);

var oneToManyMappingProperties =
  new RelationshipVerifier("OneToMany", OneToManyMapping);

var manyToManyMappingProperties =
  new RelationshipVerifier("ManyToMany", ManyToManyMapping).
    set("joinTable", isNonEmptyString);

var oneToOneMappingProperties =
  new RelationshipVerifier("OneToOne", OneToOneMapping).
    set("foreignKey", isNonEmptyString);




//////// TableMapping             /////////////////

/* Table Mapping literal properties */
var tableMappingProperties =
  new LiteralObjectVerifier().
    set("table",              isNonEmptyString).
    set("database",           isString).
    set("mapAllColumns",      isBool).
    set("fields",             isArrayOf(isMinimalField)).
    set("excludedFieldNames", isArrayOf(isNonEmptyString)).
    set("meta",               isElementOrArrayOf(isMetaOrLiteral)).
    set("sparseContainer",    getValidator(fieldMappingProperties)).
    set("error",              isEmptyString).
    set("columnConverterMap", isConverterMap).
    setRequired("table");


function TableMapping(tableNameOrLiteral) {
  this.table              = "";
  this.database           = "";
  this.mapAllColumns      = true;
  this.fields             = [];
  this.excludedFieldNames = [];
  this.meta               = [];
  this.columnConverterMap = {};
  this.error              = "";

  switch(typeof tableNameOrLiteral) {
    case 'object':
      this.constructFromObject(tableNameOrLiteral);
      break;
    case 'string':
      this.constructFromTableName(tableNameOrLiteral);
      break;
    default:
      this.error = "TableMapping(): string tableName or " +
                   "literal tableMapping is a required parameter.";
      return;
  }

  if (arguments.length > 1) {   // Each additional argument is a Meta
    this.assignMeta(arguments);
  }
}

TableMapping.prototype.isValid = function() {
  return (this.error.length === 0);
};


TableMapping.prototype.constructFromObject = function(literal) {
  if(literal.field && ! literal.fields) {
    literal.fields = [ literal.field ];
  } else if(literal.fields && ! Array.isArray(literal.fields)) {
    literal.fields = [ literal.fields ];
  }
  this.error = tableMappingProperties.buildObjectFromLiteral(this, literal);
  if(this.isValid()) {  // Build arrays that are independent from the original
    this.fields = this.fields.slice();
    this.excludedFieldNames = this.excludedFieldNames.slice();
  }
};

TableMapping.prototype.constructFromTableName = function(tableName) {
   var parts = tableName.split(".");
   if (parts[2] || tableName.indexOf(' ') !== -1) {
     this.error = 'MappingError: tableName must contain one or two parts: [database.]table';
   } else if(parts[0] && parts[1]) {
     this.database = parts[0];
     this.table    = parts[1];
   } else {
     this.table    = parts[0];
   }
};

TableMapping.prototype.assignMeta = function(args) {
  var i, arg;
  for (i = 1; i < args.length; i++) {
    arg = args[i];
    if(isMeta(arg)) {
      this.meta.push(arg);
    } else if(isLiteralMeta(arg)) {
      this.meta.push(Meta.fromLiteralMeta(arg));
    } else {
      this.error += 'MappingError: valid arguments are meta; invalid argument '
        + i + ': (' + typeof arg + ') ' + arg;
    }
  }
};

TableMapping.prototype.getFieldMapping = function(fieldName) {
  var fm, j;
  for(j = 0 ; j < this.fields.length ; j++) {
    fm = this.fields[j];
    if(fm.fieldName === fieldName) {
        return fm;
    }
  }
};


/* mapField(fieldName, [columnName], [converter], [meta], [persistent])
   mapField(literalFieldMapping)
   IMMEDIATE

   Create FieldMapping for fieldName
*/
TableMapping.prototype.mapField = function(nameOrLiteral) {
  var i, arg, fieldMapping, fieldName, fieldMappingLiteral, errors;

  switch(typeof nameOrLiteral) {
    case 'string':
      fieldMappingLiteral = { "fieldName" : nameOrLiteral };
      for(i = 1; i < arguments.length ; i++) {
        arg = arguments[i];
        switch(typeof arg) {
          case 'string':
            fieldMappingLiteral.columnName = arg;
            break;
          case 'boolean':
            fieldMappingLiteral.persistent = arg;
            break;
          case 'object':
            if (isMeta(arg)) {
              fieldMappingLiteral.meta = arg;
            } else if(isLiteralMeta(arg)) {
              fieldMappingLiteral.meta = Meta.fromLiteralMeta(arg);
            } else if(isConverter(arg)) {
              fieldMappingLiteral.converter = arg;
            } else if(isArrayOf(isString)(arg)) {
              fieldMappingLiteral.toManyColumns = arg;
            } else {
              this.error += "mapField(): Invalid argument " + arg;
            }
            break;
          default:
            this.error += "mapField(): Invalid argument " + arg;
        }
      }
      break;

    case 'object':
      fieldMappingLiteral = nameOrLiteral;
      break;

    default:
      this.error += "mapField() expects a literal FieldMapping or valid arguments list";
      return this;
  }

  errors = fieldMappingProperties.getErrors(fieldMappingLiteral);

  if(errors.length) {
    this.error += errors;
    udebug.log("mapField() Errors: ", errors);
  } else {
    fieldName = fieldMappingLiteral.fieldName;
    if(this.getFieldMapping(fieldName)) {
      udebug.log("mapField(): Duplicate fieldName error");
      this.error += '\nmapField(): "' + fieldName + '" is duplicated; it cannot replace an existing field.';
    } else {
      fieldMapping = new FieldMapping(fieldName);
      fieldMappingProperties.buildObjectFromLiteral(fieldMapping, fieldMappingLiteral);
      this.fields.push(fieldMapping);
      if (!fieldMapping.persistent) {
        this.excludedFieldNames.push(fieldMapping.fieldName);
      }
      udebug.log("mapField success: field", fieldMapping);
    }
  }

  return this;
};


TableMapping.prototype.createRelationshipField = function(verifier, literal) {
  var relationship = new verifier.ctor();
  var errorMessage = verifier.getErrors(literal);

  if (!literal.targetField && !literal.foreignKey && !literal.joinTable) {
    errorMessage += "\nMappingError: targetField, foreignKey, or joinTable is a required field for relationship mapping";
  }
  if(this.getFieldMapping(literal.fieldName)) {
    errorMessage += '\nMappingError: relationship field "' + literal.fieldName + '" is duplicated.';
  }

  if (errorMessage) {
    this.error += errorMessage;
  } else {
    verifier.buildObjectFromLiteral(relationship, literal);
    return relationship;
  }
};


TableMapping.prototype.mapRelationship = function(relationshipVerifier, literalMapping) {
  var mapping;
  if (typeof literalMapping !== 'object') {
    this.error += "\nMappingError: map" + relationshipVerifier.type +
                  " supports only literal field mapping";
    return this;
  }

  if(this.getFieldMapping(literalMapping.fieldName)) {
    this.error += '"' + literalMapping.fieldName + '" is duplicated; ' +
      "it cannot replace an existing field.";
    return this;
  }

  mapping = this.createRelationshipField(relationshipVerifier, literalMapping);
  if(mapping) {
    this.fields.push(mapping);
  }
  return this;
};

/* mapOneToOne(literalFieldMapping)
 * IMMEDIATE
 */
TableMapping.prototype.mapOneToOne = function(literalMapping) {
  return this.mapRelationship(oneToOneMappingProperties, literalMapping);
};

/* mapManyToOne(literalFieldMapping)
 * IMMEDIATE
 */
TableMapping.prototype.mapManyToOne = function(literalMapping) {
  return this.mapRelationship(manyToOneMappingProperties, literalMapping);
};

/* mapOneToMany(literalFieldMapping)
 * IMMEDIATE
 */
TableMapping.prototype.mapOneToMany = function(literalMapping) {
  return this.mapRelationship(oneToManyMappingProperties, literalMapping);
 };

/* mapManyToMany(literalFieldMapping)
 * IMMEDIATE
 */
TableMapping.prototype.mapManyToMany = function(literalMapping) {
  return this.mapRelationship(manyToManyMappingProperties, literalMapping);
};

/** fieldIsNotSparse(name)
 *  Exclude a field from sparse field handling.
 */
TableMapping.prototype.fieldIsNotSparse = function(fieldName) {
  if (this.excludedFieldNames.indexOf(fieldName) === -1) {
    this.excludedFieldNames.push(fieldName);
  }
};

/** excludeFields(fieldNames)
 * Exclude a list or array of named field(s) from being persisted.
 */
TableMapping.prototype.excludeFields = function() {
  var i, j, fieldName, fieldNames;
  for (i = 0; i < arguments.length; ++i) {
    fieldNames = arguments[i];
    if (typeof fieldNames === 'string') {
      this.fieldIsNotSparse(fieldNames);
    } else if (Array.isArray(fieldNames)) {
      for (j = 0; j < fieldNames.length; ++j) {
        fieldName = fieldNames[j];
        if (typeof fieldName === 'string') {
          this.fieldIsNotSparse(fieldName);
        } else {
          this.error += '\nMappingError: excludeFields argument must be a field name or an array or list of field names: \"' +
              fieldName + '\"';
        }
      }
    } else {
      this.error += '\nMappingError: excludeFields argument must be a field name or an array or list of field names: \"' +
          fieldNames + '\"';
    }
  }
};


/* mapSparseFields(columnName, converter)
 * columnName: required
 * converter: optional converter function default Converters/JSONConverter
 */
TableMapping.prototype.mapSparseFields = function(columnName) {
  var i, arg, fieldMapping;

  if(typeof columnName === 'string') {
    fieldMapping = new FieldMapping(columnName);
    fieldMapping.columnName = columnName;
    for(i = 1; i < arguments.length ; i++) {
      arg = arguments[i];
      switch(typeof arg) {
        case 'object':          // argument is a meta or converter
          if(isMeta(arg)) {
            fieldMapping.meta = arg;
          } else if(isLiteralMeta(arg)) {
            fieldMapping.meta = Meta.fromLiteralMeta(arg);
          } else if (isConverter(arg)) {    // validate converter
              fieldMapping.converter = arg;
          } else {
              this.error += "\nmapSparseFields Argument is an object " +
                  "that is not a meta or a converter object: \"" + util.inspect(arg) + "\"";
          }
          break;
        default:
          this.error += "\nmapSparseFields: Argument must be a meta or converter object: \"" +
              util.inspect(arg) + "\"";
      }
    }
    if (!fieldMapping.converter) {                   // default JSON converter
      fieldMapping.converter = jones.converters.JSONConverter;
    }
    this.sparseContainer = fieldMapping;
  } else {
    this.error +="\nmapSparseFields() requires a valid arguments list with column name as the first argument";
  }
  return this;
};

/* registerColumnConverter(name, converter): register a Converter for a named column
   IMMEDIATE
*/
TableMapping.prototype.registerColumnConverter = function(name, converter) {
  var error;
  if(isConverter(converter)) {
    this.columnConverterMap[name] = converter;
  } else {
    error = "registerColumnConverter() for column " + name + ": not a converter";
    this.error += error;
  }
  return error;
};

/* applyToClass(constructor) 
   IMMEDIATE
*/
TableMapping.prototype.applyToClass = function(ctor) {
  if (typeof ctor === 'function') {
    ctor.prototype.jones = {};
    ctor.prototype.jones.mapping = this;
    ctor.prototype.jones.constructor = ctor;
    ctor.prototype.jones.mappingId = ++mappingId;
  } else {
    this.error += '\nMappingError: applyToClass() parameter must be constructor';
  }
  return ctor;
};


/* Public exports of this module: */
exports.TableMapping = TableMapping;
exports.FieldMapping = FieldMapping;
exports.isValidConverterObject = isConverter;
