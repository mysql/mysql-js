/*
 Copyright (c) 2012, 2015, Oracle and/or its affiliates. All rights
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


/* This is a common internal run-time debugging package for C and JavaScript. 
 * In the spirit of Fred Fish's dbug package, which is widely used in the 
 * MySQL server, this package manages "printf()-style" debugging of source 
 * code.  
 *
 * It allows a JavaScript user to control debugging output both from 
 * JavaScript code and from compiled C code. The user can direct the debugging
 * output to a particular file, and can enable output from indiviual source code 
 * files.
 * 
 * SUMMARY:
 * 
 * var unified_debug = require("unified_debug.js");
 *
 * var udebug = unified_debug.getLogger("myFilename.js");
 * 
 * udebug.log(<message>)             // write message (at DEBUG level)
 * udebug.log_urgent(<message>)      // write message at URGENT level
 * udebug.log_notice(<message>)      // write message at NOTICE level
 * udebug.log_info(<message>)        // write message at INFO level
 * udebug.log_debug(<message>)       // write message at DEBUG level
 * udebug.log_detail(<message>)      // write message at DETAIL level
 * udebug.set_file_level(level)      // override output level for this file
 *
 *
 * unified_debug.on()                // turn debugging on
 * unified_debug.off()               // turn debugging off
 * unified_debug.level_urgent()      // set output level to URGENT
 * unified_debug.level_notice()      // set output level to NOTICE
 * unified_debug.level_info()        // set output level to INFO
 * unified_debug.level_debug()       // set output level to DEBUG
 * unified_debug.level_detail()      // set output level to DETAIL
 * unified_debug.close()             // close the destination stream
 * 
 *   // Set the destination stream for debugging messages:
 * unified_debug.set_destination(writeableStream) 
 *
 *   // Register a native code module, which must export setLogger(), 
 *   // setLevel(), and setFileLevel() functions to JavaScript:
 * unified_debug.register_client(module)    
 *
 *   // Set a per-filename output level:
 * unifed_debug.set_file_level(filename, level) 
 *
 *   // Register a receiver function which will be called with 
 *   // arguments (level, filename, message) whenever a message is logged.
 * unified_debug.register_receiver(receiverFunction);
 *
 */


/*jslint vars: true, white: true, node: true, nomen: true, unparam: true,
         plusplus: true
*/
/*global global_unified_debug: true */

"use strict";

var path = require("path"),
    util = require("util"),
    assert = require("assert"),

    UDEB_OFF      = 0,
    UDEB_URGENT   = 1,
    UDEB_NOTICE   = 2,
    UDEB_INFO     = 3,
    UDEB_DEBUG    = 4,
    UDEB_DETAIL   = 5,
    write_log_message,
    _global_;


// This is the default logListener; it writes the message on destinationStream.
write_log_message = function(level, file, message) {
  message += "\n";
  _global_.destinationStream.write(message, 'ascii');
};

/* NPM can cause problems.
   It is possible that one module loads unified_debug from one path, but
   another module loads it from a different path.  Setting the debug level in
   one copy would do nothing to enable messages from the other copy. We work
   around this by holding some state at global scope.
*/
if(global.global_unified_debug === undefined) {
  global.global_unified_debug = {
    on                 : 1,                 // initially on
    level              : UDEB_NOTICE,       // initial level
    destinationStream  : process.stderr,    // initial message destination
    nativeCodeClients  : [],
    logListeners       : [],
    fileLoggers        : {},
    presetPerFileLevel : {}
  };

  // INITIALIZATION TIME: REGISTER write_log_message as a listener:
  global.global_unified_debug.logListeners.push(write_log_message);
}

_global_ = global.global_unified_debug;


// Send a log message to all listeners.
function handle_log_event(level, file, message) {
  var i;
  for(i = 0 ; i < _global_.logListeners.length ; i++) {
    _global_.logListeners[i](level, file, message);
  }
}


// Customize the destination stream
exports.set_destination = function(writableStream) {
  _global_.destinationStream = writableStream;
};


// close the destination stream
exports.close = function() {
  if(_global_.destinationStream !== process.stderr &&
     _global_.destinationStream !== process.stdout)
    {
       _global_.destinationStream.end();
    }
};

/* Register a log receiver 
*/
exports.register_receiver = function(rFunc) {
  _global_.logListeners.push(rFunc);
};

/* Set per-file debugging level
*/
exports.set_file_level = function(filename, level) {
  var i, client;
  if(_global_.fileLoggers[filename]) {
    _global_.fileLoggers[filename].set_file_level(level);
  }
  else {
    /* Maybe a  file not yet registered */
    _global_.presetPerFileLevel[filename] = level;

    /* Maybe a C++ file */
    for(i = 0 ; i < _global_.nativeCodeClients.length ; i++) {
      client = _global_.nativeCodeClients[i];
      client.setFileLevel(filename, level);
    }
  }
};

/* Tell native code logging clients about the level 
*/
function clientSetLevel(l) {
  var i, client;
  for(i = 0 ; i < _global_.nativeCodeClients.length ; i++) {
    client = _global_.nativeCodeClients[i];
    client.setLevel(l);
  }
}

/* Turn debugging output on.
*/
exports.on = function() {
  clientSetLevel(_global_.level);
  if(! _global_.on) {
    _global_.on = 1;
    handle_log_event(_global_.level, "unified_debug.js", "unified debug enabled");
  }
};

/* Turn debugging output off.
*/
exports.off = function() {
  _global_.on = 0;
  clientSetLevel(UDEB_OFF);
};


/* Set the logging level
*/
function udeb_set_level(lvl) {
  _global_.level = lvl;
  clientSetLevel(_global_.level);
}

exports.level_urgent = function() {
  udeb_set_level(UDEB_URGENT);
};

exports.level_notice = function() {
  udeb_set_level(UDEB_NOTICE);
};

exports.level_info = function() {
  udeb_set_level(UDEB_INFO);
};

exports.level_debug = function() {
  udeb_set_level(UDEB_DEBUG);
};

exports.level_detail = function() {
  udeb_set_level(UDEB_DETAIL);
};



/* Register a C client so that it can send debugging output up to JavaScript
*/
exports.register_client = function(client) {
  var fileName;
  assert(typeof client.setLogger    === 'function');
  assert(typeof client.setLevel     === 'function');
  assert(typeof client.setFileLevel === 'function');
  
  client.setLogger(handle_log_event);
  client.setLevel(_global_.level);
  
  _global_.nativeCodeClients.push(client);
  
  /* Register per-file logging levels */
  for(fileName in _global_.presetPerFileLevel) {
    if(_global_.presetPerFileLevel.hasOwnProperty(fileName)) {
      client.setFileLevel(fileName, _global_.presetPerFileLevel[fileName]);
    }
  }
};


function dispatch_log_message(level, filename, msg_array) {
  var message = util.format.apply(null, msg_array);
  if(level > UDEB_NOTICE) {            
    message = filename + " " + message;
  }
  handle_log_event(level, filename, message);  
}


function Logger() {
  this.file_level = 0;
}

Logger.prototype = {
  URGENT         : UDEB_URGENT,
  NOTICE         : UDEB_NOTICE,
  INFO           : UDEB_INFO,
  DEBUG          : UDEB_DEBUG,
  DETAIL         : UDEB_DETAIL,
  set_file_level : function(x) { this.file_level = x; }
};

/***********************************************************
 * get a custom logger class for a source file
 *
 ***********************************************************/
exports.getLogger = function(filename) {
  if (_global_.fileLoggers[filename]) {
    throw new Error('The file name ' + filename + ' has already been registered.');
  }
//  assert(! _global_.fileLoggers[filename]); // A file cannot be registered twice

  function makeLogFunction(level) {
    return function() {      
      if((global_unified_debug.level >= level) || (this.file_level >= level))
      {
        dispatch_log_message(level, filename, arguments);
      }
    };
  }

  function makeIsFunction(level) {
    return function() {      
      return (global_unified_debug.level >= level) || (this.file_level >= level);
    };
  }

  var theLogger = new Logger();

  if(_global_.presetPerFileLevel[filename]) {
    theLogger.file_level = _global_.presetPerFileLevel[filename];
    delete _global_.presetPerFileLevel[filename];
  } else {
    theLogger.file_level = UDEB_URGENT;
  }

  theLogger.log_urgent     = makeLogFunction(1);
  theLogger.log_notice     = makeLogFunction(2);
  theLogger.log_info       = makeLogFunction(3);
  theLogger.log_debug      = makeLogFunction(4);
  theLogger.log_detail     = makeLogFunction(5);
  theLogger.log            = theLogger.log_debug;
  
  theLogger.is_urgent     = makeIsFunction(1);
  theLogger.is_notice     = makeIsFunction(2);
  theLogger.is_info       = makeIsFunction(3);
  theLogger.is_debug      = makeIsFunction(4);
  theLogger.is_detail     = makeIsFunction(5);

  _global_.fileLoggers[filename] = theLogger;
  
  return theLogger;
};


