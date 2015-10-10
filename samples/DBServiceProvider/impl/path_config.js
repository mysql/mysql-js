
"use strict";

var path = require("path");

var config = {};

config.impl_dir   = __dirname;
config.root_dir   = path.dirname(config.impl_dir);          // jones-sample

module.exports = config;
