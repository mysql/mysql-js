/*
 Copyright (c) 2012, 2015 Oracle and/or its affiliates. All rights
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

var path   = require("path"),
    assert = require("assert");

function Option(shortForm, longForm, helpText, callback) {
  this.shortForm  = shortForm;
  this.longForm   = longForm;
  this.helpText   = helpText;
  this.callback   = callback;
}

Option.prototype.isOption = true;

function FlagHandler() {
  this.flags = {};
  this.helpText = "";
  this.done = false;
}

FlagHandler.prototype.addOption = function(option) {
  assert(option.isOption);
  var shortFlag, longFlag, key, helpText;
  helpText = "";
 
  /* Split the flags, and use the part to the left of any
     character that is not a dash or an alphanumeric character
     as a key in FlagHandler.flags
  */
  if(option.shortForm) {
    shortFlag = option.shortForm;
    key = shortFlag.split(/[^\-\w]/)[0];
    this.flags[key] = option;
  }
  if(option.longForm) {
    longFlag = option.longForm;
    key = longFlag.split(/[^\-\w]/)[0];
    this.flags[key] = option;
  }

  /* Build the help text
  */
  if(shortFlag && longFlag) {
    helpText = "  " + longFlag + "\n" +
               "  " + shortFlag + "     " + option.helpText + "\n";
  } else if(shortFlag) {
    helpText = "  " + shortFlag + "     " + option.helpText + "\n";
  } else if (longFlag) {
    helpText = "  " + longFlag + "  " +     option.helpText + "\n";
  }

  this.helpText += helpText;
};

/* Handle arguments and invoke their callbacks.
   Callbacks must return 1, 0, or -1.
*/
FlagHandler.prototype.processArguments = function() {
  var i, len, opts, optHasEq, thisArg, nextArg, flag, consumed;
  len = process.argv.length;
  for (i = 2; i < len; i++) {
    thisArg = process.argv[i];
    opts = thisArg.split("=",2);
    flag = this.flags[opts[0]];

    if(flag) {
      optHasEq = (opts[1] !== undefined);
      nextArg = optHasEq ? opts[1] : process.argv[i+1];

      consumed = flag.callback(nextArg);    // invoke callback
      switch(consumed) {
        case 1:  // nextArg was consumed
          if(! optHasEq) { i++; }
          break;
        case 0:  // nextArg was not consumed
          if(optHasEq) {  // user said opt=value, but option did not use value
            console.log(thisArg, "is not a valid usage for option", flag);
            this.usage(1);
          }
          break;
        case -1:
          console.log("Error processing option", thisArg);
          this.usage(1);
          break;
        default:
          console.log("Erroneous return from option handler ", thisArg,
                      " -- this is a bug.");
          process.exit(1);
      }
    } else {
      console.log("Invalid option:", thisArg, opts);
      this.usage(1);
    }
  }
  this.done = true;
};

FlagHandler.prototype.usage = function(exitValue) {
  var msg;
  var myself = path.basename(process.argv[1]);
  msg = "Usage:  " + process.argv[0] + " " + myself + " [options]\n" +
        "  Options:\n" + this.helpText;
  console.log(msg);
  process.exit(exitValue);
};

exports.Option = Option;
exports.FlagHandler = FlagHandler;
