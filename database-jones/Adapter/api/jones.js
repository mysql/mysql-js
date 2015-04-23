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

var path           = require("path"),
    fs             = require("fs"),

    conf           = require("../adapter_config"),
    UserContext    = null,   // loaded later to prevent circular dependency

    udebug         = unified_debug.getLogger("jones.js"),
    existsSync     = fs.existsSync || path.existsSync;


function common(file) { return path.join(conf.spi_common_dir, file); }
function api_dir(file) { return path.join(conf.api_dir, file); }
function api_doc_dir(file) { return path.join(conf.api_doc_dir, file); }
function spi_doc_dir(file) { return path.join(conf.spi_doc_dir, file); }

exports.common = {
  "BitMask"                   : common("BitMask"),
  "DBTableHandler"            : common("DBTableHandler"),
  "IndexBounds"               : common("IndexBounds"),
  "QueuedAsyncCall"           : common("QueuedAsyncCall"),
  "MySQLTime"                 : common("MySQLTime"),
  "SQLBuilder"                : common("SQLBuilder"),
  "SQLTransactionHandler"     : common("SQLTransactionHandler"),
  "FieldValueDefinedListener" : common("FieldValueDefinedListener")
};

exports.api = {
  "TableMapping"              : api_dir("TableMapping"),
  "stats"                     : api_dir("stats"),
  "UserContext"               : api_dir("UserContext"),
  "Meta"                      : api_dir("Meta"),
};

exports.spi_doc = {
  "DBOperation"               : spi_doc_dir("DBOperation"),
  "DBConnectionPool"          : spi_doc_dir("DBConnectionPool"),
  "DBServiceProvider"         : spi_doc_dir("DBServiceProvider"),
  "DBTransactionHandler"      : spi_doc_dir("DBTransactionHandler")
};

exports.api_doc = {
  "TableMetadata"             : api_doc_dir("TableMetadata"),
  "TableMapping"              : api_doc_dir("TableMapping")
};

exports.fs = conf;    // Export path helpers under jones.fs

exports.TableMapping = require("./TableMapping").TableMapping;

exports.Projection   = require("./Projection").Projection;

function getDBServiceProvider(impl_name) {
  var externalModule = "jones-" + impl_name;
  var service;
  
  try {
    service = require(externalModule);
  }
  catch(e) {
    console.log("Cannot load module " + externalModule);
    throw e;
  }

  /* Now verify that the module can load its dependencies.  
     This will throw an exception if it fails.
  */
  service.loadRequiredModules();  
  
  return service;
}

exports.getDBServiceProvider = getDBServiceProvider;


/*jslint forin: true */
exports.ConnectionProperties = function(nameOrProperties) {
  var serviceProvider, newProperties, key, value;
  if(typeof nameOrProperties === 'string') {
    udebug.log("ConnectionProperties [default for " + nameOrProperties + "]");
    serviceProvider = getDBServiceProvider(nameOrProperties);
    newProperties = serviceProvider.getDefaultConnectionProperties();
  }
  else if(typeof nameOrProperties === 'object' && 
          typeof nameOrProperties.implementation === 'string') {
    udebug.log("ConnectionProperties [copy constructor]");
    newProperties = {};
    for(key in nameOrProperties) {
      value = nameOrProperties[key];
      if(typeof value === 'string' || typeof value === 'number') {
        newProperties[key] = value;
      }
      else {
        udebug.log(" .. not copying property:",  key);
      }
    }
  }
  return newProperties;
};


function requireUserContext() {
  if(! UserContext) {
    UserContext = require("./UserContext").UserContext;
  }
}

/** Methods implemented in UserContext **/

exports.connect = function(properties, annotations, user_callback) {
  requireUserContext();
  var context = new UserContext(arguments, 3, 2, null, null);
  return context.connect();
};

exports.openSession = function() {
  requireUserContext();
  var context = new UserContext(arguments, 3, 2, null, null);
  return context.openSession();
};

exports.getOpenSessionFactories = function() {
  requireUserContext();
  var context = new UserContext(arguments, 0, 0);
  return context.getOpenSessionFactories();
};

exports.closeAllOpenSessionFactories = function() {
  requireUserContext();
  var context = new UserContext(arguments, 1, 1);
  return context.closeAllOpenSessionFactories();
};


/* Make it all global */
global.jones = exports;
