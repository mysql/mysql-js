
"use strict";

var assert = require("assert"),
    path   = require("path"),
    config = require("./path_config"),
    DBConnectionPool = require("./DBConnectionPool.js");


try {
  /* Attempt to load all dependencies here, but rather than failing on 
     error, let the unmet module dependencies be caught by loadRequiredModules() 
     so that the user can get a customized (and appropriately-timed) error.
  */

}
catch(ignore) {
}


/* loadRequiredModules() should attempt to load all dependencies, and return 
   helpful error messages for any that cannot be loaded.
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
  var pool = new DBConnectionPool(properties);
  pool.connect(userCallback);
};


exports.getDBMetadataManager = function(properties) {
};

exports.config = config;

