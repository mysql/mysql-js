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
    unified_debug  = require("./unified_debug"),
    UserContext    = null,   // loaded later to prevent circular dependency

    udebug         = unified_debug.getLogger("jones.js"),
    existsSync     = fs.existsSync || path.existsSync;


exports.fs = conf;    // Export path helpers under jones.fs

exports.TableMapping = require("./TableMapping").TableMapping;

exports.Projection   = require("./Projection").Projection;

exports.common = {
  "BitMask"          : path.join(conf.spi_common_dir, "BitMask"),
  "DBTableHandler"   : path.join(conf.spi_common_dir, "DBTableHandler"),
  "IndexBounds"      : path.join(conf.spi_common_dir, "IndexBounds"),
  "QueuedAsyncCall"  : path.join(conf.spi_common_dir, "QueuedAsyncCall"),
  "MySQLTime"        : path.join(conf.spi_common_dir, "MySQLTime"),
  "SQLBuilder"       : path.join(conf.spi_common_dir, "SQLBuilder"),
  "SQLTransactionHandler" : path.join(conf.spi_common_dir, "SQLTransactionHandler"),
  "FieldValueDefinedListener" : path.join(conf.spi_common_dir, "FieldValueDefinedListener"),
};

exports.api = {
  "TableMapping"     : path.join(conf.api_dir, "TableMapping"),
  "unified_debug"    : path.join(conf.api_dir, "unified_debug"),
  "stats"            : path.join(conf.api_dir, "stats"),
  "UserContext"      : path.join(conf.api_dir, "UserContext")
};

exports.require = function(module) {
  var r;

  try {
    r = require(module);
  } catch(e) {
    r = require(path.join(conf.super_dir, module));
  }
  return r;
}


function getDBServiceProvider(impl_name) {
  var externalModule = "beta-jones-" + impl_name;
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
