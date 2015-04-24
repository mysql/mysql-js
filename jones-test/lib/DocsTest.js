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

var fs   = require("fs"),
    path = require("path"),
    Test = require("./Test"),
    unified_debug = require("unified_debug"),
    udebug = unified_debug.getLogger("DocsTest.js");

function DocumentedFunction(className, functionName) {
  this.className    = className;
  this.functionName = functionName;
}

/* Extract code from markdown.
   Only extract code that is delimited above and below by ``` 
*/
function extractCodeFromMarkdown(text) {
  var result = "";
  var lines = text.split("\n");
  var isCodeBlock = false;
  var i, line;
  
  for(i = 0; i < lines.length ; i++) {
    line = lines[i];
    if(isCodeBlock) {
      result += line;
    }
    if(line.match(/^```/)) { 
      isCodeBlock = ! isCodeBlock;
    }
  }
  return result;
}


/* Returns a list of function definitions from JavaScript code
*/
function scan(text) { 
  var i = 0;                  // the index of the current character 
  var c = text.charAt(i);     // the current character
  var list = [];              // functions found in the file
  var constructor = 0;        // constructor function found in file
  var tok;                    // the current token

  function isUpper(c)   { return (c >= 'A' && c <= 'Z'); }
  function isLower(c)   { return (c >= 'a' && c <= 'z'); }
  function isAlpha(c)   { return (isUpper(c) || isLower(c)); }
  function isNumeric(c) { return (c >= '0' && c <= '9'); }
  function isJsFunctionName(c) { 
    return( isAlpha(c) || isNumeric(c) || (c == '_'));
  }
  
  function peek() {
    return text.charAt(i + 1);
  }

  function advance(n) {       // Advance to next character
    var amt = n || 1;
    if(i + amt >= text.length) {
      i = text.length;
      c = '';
    }
    else { 
      i += amt;
      c = text.charAt(i);
    }
  }

  function Token() {
    this.str = c;
    advance();
  }
    
  Token.prototype.consume = function() {
    this.str += c;
    advance();
  };
    
  Token.prototype.commit = function() {
    var docFunction;
    if(isUpper(this.str.charAt(0))) { 
      constructor = this.str;
    } else {
      docFunction = new DocumentedFunction(constructor, this.str);
      list.push(docFunction);
    }
  };

  // Start scanning
  while(c) {
  
    while(c != '' && c <= ' ') { advance(); }          // whitespace
     
    if(c == '/' && peek() == '/') {                    // comment to EOL  
      advance(2);
      while(c !== '\n' && c !== '\r' && c !== '') {
        advance();
      }
    }
    
    else if (c === '/' && peek() === '*') {            // comment to */
      advance(2); 
      while(! (c == '*' && peek() == '/')) {
        advance();
      }
      if(c === '') { throw new Error("Unterminated comment"); }
      advance(2);
    }
 
    else if(isAlpha(c)) {                              // candidate functions
      tok = new Token();
      while(isJsFunctionName(c)) {
        tok.consume();
      }
      if(c == '(') {  // IT WAS A FUNCTION
        tok.commit();
        advance();   
        /* Now, there may be more functions (callbacks) defined as arguments,
           so we skip to the next semicolon */
        while(c && c !== ';') {
          advance();
        }
      }
      // delete tok;
    }
    
    else {
      advance();
    }
  }
  return list;
}


/// PUBLIC API: 

function DocsTest(docFileName) {
  this.phase        = 1;   // ConcurrentTest
  this.name         = "Documentation: " + path.basename(docFileName);
  this.docFileName  = docFileName;
  this.testClassMap = {};
  this.undocMap     = {};
  this.hasTests     = false;
  this.isMarkdown   = (docFileName.match(/\.md$/));
}

DocsTest.prototype = new Test.Test();

DocsTest.prototype.fullName = function() {
  return this.suite.name + " " + this.name;
};

DocsTest.prototype.addTestObject = function(testObject, className, undocFlag) {
  this.hasTests = true;
  if(className === undefined) {
    className = 0;
  }
  this.testClassMap[className] = testObject;
  if(undocFlag) {
    this.undocMap[className] = testObject;
  }
};

DocsTest.prototype.testObjectsVsFunctionList = function(functionList) {
  var docFunction, testObject, func, name, msg, _class;
  var verified = {};
  var missing = 0;
  var firstMissing = null;
  var i;

  function verify(docFunc) {
    if(! verified[docFunc.className]) {
      verified[docFunc.className] = {};
    }
    verified[docFunc.className][docFunc.functionName] = true;
    // udebug.log_detail("verified %s.%s", docFunc.className, docFunc.functionName);
  }

  // Verify documented functions from list
  for(i = 0 ; i < functionList.length ; i++) {
    docFunction = functionList[i];
    name = docFunction.className;
    testObject = this.testClassMap[name];
    if(testObject) { 
      func = testObject[docFunction.functionName];
      if(typeof func === 'function') {
        verify(docFunction);
      } else {
        udebug.log_detail("Missing", docFunction);
        if(! firstMissing) { firstMissing = name; }
        missing += 1;      
      }
    }
  }

  if(missing) {
    msg = "Missing " + firstMissing;
    if(missing > 1)  { msg += " and " + (missing-1) + " other function"; }
    if(missing > 2)  { msg += "s"; }
    this.appendErrorMessage(msg);
  }
  
  // Test undocumented functions
  for(_class in this.undocMap) {
    if(this.undocMap.hasOwnProperty(_class)) {
      testObject = this.undocMap[_class];
      for(name in testObject) { 
        if(testObject.hasOwnProperty(name)) {
          if(typeof testObject[name] === 'function') {
            if((! verified[_class]) || (!verified[_class][name])) {
              this.appendErrorMessage(_class + "." + name + " undocumented");    
            }
          }
        }
      }
    }
  }
};

DocsTest.prototype.runDocsTest = function() {
  var file = path.resolve(this.suite.driver.baseDirectory, this.docFileName);
  var text = fs.readFileSync(file, 'utf8');
  if(this.isMarkdown){
    text = extractCodeFromMarkdown(text);
  }
  var functionList = scan(text);
  if(this.hasTests) {
    this.testObjectsVsFunctionList(functionList);
  } else {
    this.appendErrorMessage("Use DocsTest.addTestObject to supply a testObject");
  }
  return true;          // Synchronous tests return true from run()
};

// Run can be overriden by a particular test if needed;
// the test should call runDocsTest()
DocsTest.prototype.run = function() {
  return this.runDocsTest();
};


module.exports = DocsTest;
