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

var unified_debug = require("unified_debug"),
    udebug        = unified_debug.getLogger("Projection.js"),
    path          = require("path"),
    jones         = require("database-jones"),
    doc           = require(path.join(jones.fs.api_doc_dir, "Projection"));

function Projection(domainObject) {
  if (typeof domainObject === 'function' && domainObject.prototype.jones && domainObject.prototype.jones.mapping) {
    this.domainObject = domainObject;
    this.name = domainObject.name + 'Projection';
    this.validated = false; // this projection has not been validated or has changed since validation
    this.id = 0;            // initial value for projection id; when validated it will be 1
    this.fields = [];
    this.relationships = {};
    this.usedBy = [];
    this.fetchSparseFields = false;
    this.error = '';
  } else {
    // there is nothing that we can do with a Projection with an invalid domain object
    throw new Error(
        'The parameter of Projection constructor must be a mapped domain object (constructor function). ' +
        '@See TableMapping.applyToClass');
  }
}

/** Invalidate this projection and all projections used by this projection.
 * The function recursively adds projections used by this projection
 * and invalidates them one by one. The parameter is modified by this function.
 * @param toBeInvalidated an array of projections to be invalidated.
 */
function invalidateAll(toBeInvalidated) {
  if (toBeInvalidated.length === 0) {return;}
  var projection = toBeInvalidated.shift();
  if (projection.error != '') {return;}
  projection.validated = false;
  projection.usedBy.forEach(function(used) {
    toBeInvalidated.push(used);
  });
  invalidateAll(toBeInvalidated);
}

Projection.prototype.addSparseFields = function() {
  this.fetchSparseFields = true;
  return this;
};

Projection.prototype.addFields = function() {
  var projection = this;
  // if this projection is in error just return
  if (projection.error != '') {return;}
  var toBeInvalidated = [this];
  invalidateAll(toBeInvalidated);
  var i, j;
  var argument;
  var field;
  // iterate the arguments of the function
  for (i = 0; i < arguments.length; ++i) {
    argument = arguments[i];
    if (typeof argument === 'string') {
      projection.fields.push(argument);
    } else if (Array.isArray(argument)) {
      for (j = 0; j < argument.length; ++j) {
        field = argument[j];
        if (typeof field === 'string') {
          projection.fields.push(field);
        } else {
          projection.error += '\nError in addFields for ' + projection.domainObject.prototype.constructor.name +
          ' Field names must be strings or arrays of strings ' + field;
        }
      }
    } else {
      projection.error += '\nError in addFields for ' + projection.domainObject.prototype.constructor.name +
          ' Field names must be strings or arrays of strings ' + argument;
    }
  }

  return this;
};

/** addField is an alias for addFields for usability */
Projection.prototype.addField = Projection.prototype.addFields;

Projection.prototype.addRelationship = function(fieldName, relationshipProjection) {
  var projection = this;
  // if this projection is in error just return
  if (projection.error != '') {return;}
  var toBeInvalidated = [this];
  invalidateAll(toBeInvalidated);
  if (typeof fieldName !== 'string') {
    projection.error += '\nError in addRelationship for ' + projection.domainObject.prototype.constructor.name +
        'fieldName must be a string ' + fieldName;
  }
  if (typeof relationshipProjection !== 'object' ||
      relationshipProjection.constructor.name !== 'Projection') {
    projection.error += '\nError in addRelationship for ' + projection.domainObject.prototype.constructor.name +
        ' parameter relationshipProjection must be a projection for field ' + fieldName;
  }
  if (projection.error == '') {
    projection.relationships[fieldName] = relationshipProjection;
    // establish the used-by relationship
    relationshipProjection.usedBy.push(this);
  }

  return this;
};

/* Public exports of this module: */
exports.Projection = Projection;
