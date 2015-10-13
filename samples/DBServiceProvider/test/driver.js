
"use strict";

var jones       = require("database-jones"),
    driver      = require(jones.fs.test_driver),
    this_module = require("../.."),
    properties;


// Setup globals:
global.adapter       = "sample";
global.this_module   = this_module;
global.mynode        = jones;

jones.registerDBServiceProvider(global.adapter, this_module);

driver.processCommandLineOptions();

properties = driver.getConnectionProperties(global.adapter);

global.test_conn_properties = properties;

/* Find and run all tests */
driver.addSuitesFromDirectory(this_module.fs.suites_dir);
driver.addSuitesFromDirectory(jones.fs.suites_dir);
driver.runAllTests();

