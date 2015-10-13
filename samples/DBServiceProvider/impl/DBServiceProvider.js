
"use strict";

var assert = require("assert"),
    path   = require("path"),
    config = require("./path_config");


/* loadRequiredModules() should attempt to load all dependencies, and return
   helpful error messages for any that cannot be loaded.

   We assume that requiring DBConnectionPool.js will require the dependencies
   in fact, so that is deferred until connect().
*/
exports.loadRequiredModules = function() {
  var error;
  try {
    /* Load external dependencies here */

  }
  catch(e) {
    error = new Error("Error loading dependencies: " + e.message);
    throw error;
  }

  return true;
};


/* getDefaultConnectionProperties() should return the default properties
   object exported by DefaultConnectionProperties.js
*/
exports.getDefaultConnectionProperties = function() {
  return require(path.join(config.root_dir, "DefaultConnectionProperties"));
};


/* getFactoryKey() should take a set of connection properties and return a
   URI-like string identifying that specific database connection. For example,
   the MySQL version returns "mysql://server_host_name:port/user_name".
*/
exports.getFactoryKey = function(properties) {
  assert(properties.implementation === "sample");
  return properties.implementation +"://";
};


exports.connect = function(properties, userCallback) {
  var DBConnectionPool = require("./DBConnectionPool");
  var pool = new DBConnectionPool(properties);
  pool.connect(userCallback);
};


exports.getDBMetadataManager = function(properties) {
};

exports.fs = config;

