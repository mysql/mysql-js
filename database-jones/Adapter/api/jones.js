/*
 Copyright (c) 2014, 2016, Oracle and/or its affiliates. All rights
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
    assert         = require("assert"),
    util           = require("util"),

    conf           = require("../adapter_config"),
    UserContext    = null,   // loaded later to prevent circular dependency

    unified_debug  = require("unified_debug"),
    stats_module   = require("./stats"),
    udebug         = unified_debug.getLogger("jones.js"),
    existsSync     = fs.existsSync || path.existsSync,

    privateModuleRegistry  = {},
    deploymentSearchPath   = [],
    resolvedDeployments    = {};

function common(file) { return path.join(conf.spi_common_dir, file); }
function api_dir(file) { return path.join(conf.api_dir, file); }
function api_doc_dir(file) { return path.join(conf.api_doc_dir, file); }
function spi_doc_dir(file) { return path.join(conf.spi_doc_dir, file); }
function converter(file) { return path.join(conf.converters_dir, file); }

exports.common = {
  "BitMask"                   : common("BitMask"),
  "DBTableHandler"            : common("DBTableHandler"),
  "IndexBounds"               : common("IndexBounds"),
  "QueuedAsyncCall"           : common("QueuedAsyncCall"),
  "MySQLTime"                 : common("MySQLTime"),
  "SQLBuilder"                : common("SQLBuilder"),
  "SQLTransactionHandler"     : common("SQLTransactionHandler"),
  "FieldValueDefinedListener" : common("FieldValueDefinedListener"),
  "DictionaryCall"            : common("DictionaryCall"),
  "MySQLSerialize"            : common("MySQLSerialize")
};

exports.api = {
  "TableMapping"              : api_dir("TableMapping"),
  "stats"                     : api_dir("stats"),
  "UserContext"               : api_dir("UserContext"),
  "Meta"                      : api_dir("Meta")
};

exports.spi_doc = {
  "DBOperation"               : spi_doc_dir("DBOperation"),
  "DBConnectionPool"          : spi_doc_dir("DBConnectionPool"),
  "DBServiceProvider"         : spi_doc_dir("DBServiceProvider"),
  "DBTransactionHandler"      : spi_doc_dir("DBTransactionHandler")
};

exports.api_doc = {
  "TableMetadata"             : api_doc_dir("TableMetadata"),
  "TableMapping"              : api_doc_dir("TableMapping"),
  "Jones"                     : api_doc_dir("Jones")
};

exports.meta = require(exports.api.Meta);

exports.fs = conf;    // Export path helpers under jones.fs

exports.TableMapping = require("./TableMapping").TableMapping;

exports.Projection   = require("./Projection").Projection;

stats_module.register(resolvedDeployments,
  "api", "ConnectionProperties", "ResolvedDeployments");
stats_module.register(deploymentSearchPath,
  "api", "ConnectionProperties", "DeploymentSearchPath");

/* getDBServiceProviderModule()
   The usual way to load SPI module "x" is to require("jones-x").

   For bootstrapping during development of x, though, it is possible to use
   jones.registerDBServiceProvider("x", x_module);
   getDBServiceProviderModule() will then return the registered object.
*/
function getDBServiceProviderModule(impl_name) {
  var externalModule, service;

  externalModule = "jones-" + impl_name;
  service = privateModuleRegistry[impl_name];
  if(! service) {
    try {
      service = require(externalModule);
    }
    catch(e) {
      console.log("Cannot load module " + externalModule);
      throw e;
    }
  }

  return service;
}

exports.registerDBServiceProvider = function(name, module) {
  privateModuleRegistry[name] = module;
};

function getDBServiceProvider(impl_name) {
  var service = getDBServiceProviderModule(impl_name);
  /* Now verify that the module can load its dependencies.
     This will throw an exception if it fails.
  */
  service.loadRequiredModules();
  
  return service;
}

exports.getDBServiceProvider = getDBServiceProvider;

exports.converters = {
  "JSONConverter"             : require(converter("JSONConverter")),
  "NumericConverter"          : require(converter("NumericConverter")),
  "SerializedObjectConverter" : require(converter("SerializedObjectConverter"))
};

/* Build the jones_deployment.js search path.
   This is done once at startup time.
*/
function buildSearchPath() {
  var mod, sourceDir, oldDir;
  assert(deploymentSearchPath.length === 0);

  // (1) Look in the same directory as the main JS script (require.main)
  // (2) Walk the chain of required modules from the main script towards jones.js
  mod = module;  // node.js file-scope "module"
  do {
    sourceDir = path.dirname(mod.filename);
    deploymentSearchPath.unshift(sourceDir);
    mod = mod.parent;
  } while(mod);

  // (3) Walk the filesystem from the main script to the root directory
  // TODO: Test this on Windows
  sourceDir = path.dirname(sourceDir);
  while(oldDir !== sourceDir) {  // these become equal at "/"
    deploymentSearchPath.push(sourceDir);
    oldDir = sourceDir;
    sourceDir = path.dirname(sourceDir);
  }

  // (4) Finally look in the current working directory
  if(deploymentSearchPath.indexOf(process.env.PWD) < 0) {
    deploymentSearchPath.push(process.env.PWD);
  }
}

buildSearchPath();   // once at startup

function DeploymentPathIterator() {
  this.index = 0;
}

DeploymentPathIterator.prototype.next = function() {
  var file;
  while(this.index < deploymentSearchPath.length) {
    file = path.join(deploymentSearchPath[this.index++], "jones_deployments.js");
    if(existsSync(file)) {
      return file;
    }
  } // fall through, return undefined
};

function findNamedDeployment(deploymentName) {
  var iter, deploymentFile, deploymentModule, deploymentFn;

  iter = new DeploymentPathIterator();
  while((deploymentFile = iter.next()) !== undefined) {
    deploymentModule = require(deploymentFile);
    deploymentFn = deploymentModule[deploymentName];
    if(typeof deploymentFn === 'function') {
      resolvedDeployments[deploymentName] = deploymentFile;  // global stat
      return deploymentFn;
    }
  }
  assert(false, "Named deployment " + deploymentName + " not found in "
    + deploymentSearchPath.join(":"));
}

function getDeploymentsFunction(deployment) {
  switch(typeof deployment) {
    case 'string':
      return findNamedDeployment(deployment);

    case 'function':
      return deployment;

    default:
      assert(false, "deployment must be a string or function");
  }
}

function mergeSuppliedProperties(newProperties, propertiesToMerge) {
  var key;
  for(key in propertiesToMerge) {
    if(propertiesToMerge.hasOwnProperty(key)) {
      newProperties[key] = propertiesToMerge[key];
    }
  }
}

function cloneDefaultPropertiesForServiceProvider(impl) {
  var serviceProvider, defaultProperties;

  /* Fetch the default connection properties */
  serviceProvider = getDBServiceProviderModule(impl);
  defaultProperties = serviceProvider.getDefaultConnectionProperties();

  /* Sanity Check */
  assert.strictEqual(defaultProperties.implementation, impl,
                     "invalid implementation name in default connection properties");

  /* Clone them */
  return JSON.parse(JSON.stringify(defaultProperties));
}

exports.ConnectionProperties = function(nameOrProperties, deployment) {
  var impl, properties, deploymentFn;

  if(typeof nameOrProperties === 'string') {
    impl = nameOrProperties;
    properties = cloneDefaultPropertiesForServiceProvider(impl);
  } else if(typeof nameOrProperties === 'object') {
    impl = nameOrProperties.implementation;
    if(impl) {
      properties = cloneDefaultPropertiesForServiceProvider(impl);
      mergeSuppliedProperties(properties, nameOrProperties);
    } else {
      properties = nameOrProperties;
    }
  } else {
    assert.ok(false,
      "ConnectionProperties() first parameter must be an adapter name or properties object");
  }
  udebug.log("ConnectionProperties", impl || "impl deferred to deployment");

  /* Apply deployment */
  if(deployment !== undefined) {
    deploymentFn = getDeploymentsFunction(deployment);
    properties = deploymentFn(properties) || properties; // Use properties if returned
  }

  /* After applying deployment, check that properties.implementation is set 
     and that the DBServiceProvider module can be loaded
  */
  impl = properties.implementation;
  assert.equal(typeof impl, 'string', "Properties object must include implementation name");
  getDBServiceProviderModule(impl);

  /* "Normally constructors don't return a value, but they can choose to" */
  udebug.log_detail(properties);
  return properties;
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
