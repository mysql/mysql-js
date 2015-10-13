
"use strict";

var path = require("path");

var config = {};

config.impl_dir   = __dirname;
config.root_dir   = path.dirname(config.impl_dir);
config.suites_dir = path.join(config.root_dir, "test");

module.exports = config;
