/*
 Copyright (c) 2012, Oracle and/or its affiliates. All rights
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

var userContext = require("./UserContext.js"),
    udebug      = unified_debug.getLogger("Session.js"),
    transaction = require('./Transaction.js'),
    batch       = require('./Batch.js');

function Session(index, sessionFactory, dbSession) {
  this.index = index;
  this.sessionFactory = sessionFactory;
  this.dbSession = dbSession;
  this.dbSession.index = index;
  this.closed = false;
  this.tx = new transaction.Transaction(this);
  this.projections = {};
}


exports.Session = Session;

exports.Session.prototype.getTableMetadata = function() {
  var context = new userContext.UserContext(arguments, 3, 2, this, this.sessionFactory);
  // delegate to context's getTableMetadata for execution
  return context.getTableMetadata();
};


exports.Session.prototype.listTables = function() {
  var context = new userContext.UserContext(arguments, 2, 2, this, this.sessionFactory);
  // delegate to context's getTableMetadata for execution
  return context.listTables();
};

exports.Session.prototype.getMapping = function() {
  var context = new userContext.UserContext(arguments, 2, 2, this, this.sessionFactory);
  return context.getMapping();
};


exports.Session.prototype.find = function() {
  var context = new userContext.UserContext(arguments, 3, 2, this, this.sessionFactory);
  // delegate to context's find function for execution
  return context.find();
};


exports.Session.prototype.load = function() {
  var context = new userContext.UserContext(arguments, 2, 1, this, this.sessionFactory);
  // delegate to context's load function for execution
  return context.load();
};


exports.Session.prototype.persist = function(tableIndicator) {
  var context;
  if (typeof(tableIndicator) === 'object') {
    // persist(domainObject, callback)
    context = new userContext.UserContext(arguments, 2, 1, this, this.sessionFactory);
  } else {
    // persist(tableNameOrConstructor, values, callback)
    context = new userContext.UserContext(arguments, 3, 1, this, this.sessionFactory);
  }
  // delegate to context's persist function for execution
  return context.persist();
};


exports.Session.prototype.remove = function(tableIndicator) {
  var context;
  if (typeof(tableIndicator) === 'object') {
    // remove(domainObject, callback)
    context = new userContext.UserContext(arguments, 2, 1, this, this.sessionFactory);
  } else {
    // remove(tableNameOrConstructor, keys, callback)
    context = new userContext.UserContext(arguments, 3, 1, this, this.sessionFactory);
  }    
  // delegate to context's remove function for execution
  return context.remove();
};


exports.Session.prototype.update = function(tableIndicator) {
  var context;
  if (typeof(tableIndicator) === 'object') {
    // update(domainObject, callback)
    context = new userContext.UserContext(arguments, 2, 1, this, this.sessionFactory);
  } else {
    // update(tableNameOrConstructor, keys, values, callback)
    context = new userContext.UserContext(arguments, 4, 1, this, this.sessionFactory);
  }
  // delegate to context's update function for execution
  return context.update();
};


exports.Session.prototype.save = function(tableIndicator) {
  var context;
  if (typeof(tableIndicator) === 'object') {
    // save(domainObject, callback)
    context = new userContext.UserContext(arguments, 2, 1, this, this.sessionFactory);
  } else {
    // save(tableNameOrConstructor, values, callback)
    context = new userContext.UserContext(arguments, 3, 1, this, this.sessionFactory);
  }
  // delegate to context's save function for execution
  return context.save();
};


exports.Session.prototype.createQuery = function() {
  // createQuery(tableIndicator, callback)
  var context = new userContext.UserContext(arguments, 2, 2, this, this.sessionFactory);
  return context.createQuery();
};


exports.Session.prototype.close = function() {
  var context = new userContext.UserContext(arguments, 1, 1, this, this.sessionFactory);
  return context.closeSession();
};


exports.Session.prototype.createBatch = function() {
  return new batch.Batch(this);
};

exports.Session.prototype.isBatch = function() {
  this.assertOpen();
  return false;
};


exports.Session.prototype.isClosed = function() {
  return this.closed;
};

exports.Session.prototype.currentTransaction = function() {
  return this.tx;
};

exports.Session.prototype.toString = function() {
  return 'Session ' + this.index + ' for ' + this.sessionFactory.key;
};

/** userSession implements all of the functionality of Session without
 * exposing internal implementation details (e.g connect string of 
 * session factory.
 */
exports.Session.prototype.userSession = function() {
  var s = this;
  return {
    sessionFactory:     s.sessionFactory.userSessionFactory(),
    index:              s.index,

    allowCreateUnmappedTable: s.allowCreateUnmappedTable,
  
    close:              function() {return s.close.apply(s, arguments);},
    createBatch:        function() {return s.createBatch.apply(s, arguments);},
    createQuery:        function() {return s.createQuery.apply(s, arguments);},
    currentTransaction: function() {return s.currentTransaction(s, arguments);},
    find:               function() {return s.find.apply(s, arguments);},
    getMapping:         function() {return s.getMapping.apply(s, arguments);},
    getTableMetadata:   function() {return s.getTableMetadata.apply(s, arguments);},
    isBatch:            function() {return s.isBatch(s, arguments);},
    isClosed:           function() {return s.isClosed(s, arguments);},
    listTables:         function() {return s.listTables.apply(s, arguments);},
    load:               function() {return s.load.apply(s, arguments);},
    persist:            function() {return s.persist.apply(s, arguments);},
    remove:             function() {return s.remove.apply(s, arguments);},
    save:               function() {return s.save.apply(s, arguments);},
    toString:           function() {return s.toString.apply(s, arguments);},
    update:             function() {return s.update.apply(s, arguments);}
  };
};
