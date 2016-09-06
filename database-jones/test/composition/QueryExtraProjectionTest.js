/*
 Copyright (c) 2016, Oracle and/or its affiliates. All rights
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

var lib = require('./lib.js');
var util = require('util');
var udebug = unified_debug.getLogger("QueryExtraProjectionTest.js");
lib.mapShop();
var t1 = new harness.ConcurrentTest('t1 Query IdAndNameExist');
var t2 = new harness.ConcurrentTest('t2 Query IdExistAndNameNotExist');
var t3 = new harness.ConcurrentTest('t2 Query IdExistAndNameEQ');
var t4 = new harness.ConcurrentTest('t3 Query IdProjectionTestDefaultEmptyArray');
var t5 = new harness.ConcurrentTest('t4 Query UKProjectionTest');
var t6 = new harness.ConcurrentTest('t5 Query UKProjectionTestNullBetween');
var t7 = new harness.ConcurrentTest('t6 Query UKProjectionTestNotNull');
var t8 = new harness.ConcurrentTest('t7 Query UKProjectionTestRelationshipFieldEQ');
var t9 = new harness.ConcurrentTest('t9 Query IdProjectionTestStringFieldBetween');
var t10 = new harness.ConcurrentTest('t9 Query ComplexQueryFieldAndQueryRelationshipTypes');

/** query with projection for complex customer by primary key
 * id exists and name exists
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment */
t1.run = function() {
  var testCase = this;
  var session, query;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      query = q;
      q.where(q.id.eq(q.param('p1')).
        and(q.firstName.eq(q.param('p2'))));
      return q.execute({"p1": 100, p2: "Craig"});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('query type', 2, query.jones_query_domain_type.queryType);
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[100], actualCustomers[0]);
      testCase.failOnError();}).
      then(null, function(err) {
        testCase.fail(err);
    });
  });
};

/** query with projection for complex customer by primary key
 * id exists and name does not exist
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment */
t2.run = function() {
  var testCase = this;
  var session, query;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      query = q;
      q.where(q.id.eq(q.param('p1')).
        and(q.firstName.eq(q.param('p2'))));
      return q.execute({"p1": 100, p2: "Sam"});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('query type', 2, query.jones_query_domain_type.queryType);
      testCase.errorIfNotEqual('result length', 0, actualCustomers.length);
      testCase.failOnError();}).
      then(null, function(err) {
        testCase.fail(err);
    });
  });
};

/** Projection test default null mapping.
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 * Customer 101 has no shopping cart. */
t3.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')).
        and(q.firstName.eq(q.param('p2'))));
      return q.execute({"p1": 101, p2: 'Sam'});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[101], actualCustomers[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test empty array mapping. Use primary key plus field to find customer.
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 * Shopping cart 1003 has no line items */
t4.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')).
        and(q.firstName.eq(q.param('p2'))));
      return q.execute({"p1": 103, 'p2': 'Burn'});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[103], actualCustomers[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/**  Use unique key to find customer.
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 */
t5.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
    q.where(q.unikey.eq(q.param('p1')).
      and(q.firstName.eq(q.param('p2'))));
    return q.execute({"p1": 100, 'p2': 'Craig'});
    }).
    then(function(actualCustomers) {
    testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
    lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[100], actualCustomers[0]);
    testCase.failOnError();}).
    then(null, function(err) {
      console.log('QueryMultipleRelationshipProjectionTest.t1 err', err);
      testCase.fail(err);
    });
  });
};

/** Projection test default null mapping. Use UK to find customer.
 * Customer 101 has no shopping cart. */
t6.run = function() {
  var testCase = this;
  var session;

  var t5expectedCustomer = new lib.Customer(101, 'Sam', 'Burton');
  t5expectedCustomer.shoppingCart = null;

  fail_openSession(testCase, function(s) {
    session = s;
    // query with projection with default null value for shoppingCart
    // Customer -> ShoppingCart -> LineItem -> Item
    session.createQuery(lib.simpleCustomerProjection).
    then(function(q) {
      q.where(q.unikey.eq(q.param('p1')).
        and(q.firstName.isNotNull()).
        and(q.lastName.between(q.param('p2'), q.param('p3'))));
        return q.execute({"p1": 101, "p2": 'A', "p3": 'C'});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, t5expectedCustomer, actualCustomers[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test default null mapping. Use UK to find customer.
 * ShoppingCart relationship is one-to-one with foreign key on the other side */
t7.run = function() {
  var testCase = this;
  var session;

  var t6expectedShoppingCart = new lib.ShoppingCart(1000, 100);
  var t6expectedCustomer = new lib.Customer(100, 'Craig', 'Walton');
  t6expectedCustomer.shoppingCart = t6expectedShoppingCart;

  fail_openSession(testCase, function(s) {
    session = s;
    // query with projection with default null value for shoppingCart
    // Customer -> ShoppingCart -> LineItem -> Item
    session.createQuery(lib.simpleCustomerProjection).
    then(function(q) {
      q.where(q.unikey.eq(q.param('p1')).
        and(q.firstName.isNotNull()).
        and(q.shoppingCart.isNotNull()));
        return q.execute({"p1": 100});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, t6expectedCustomer, actualCustomers[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test default null mapping. Use UK and relationship field to find customer.
 * ShoppingCart relationship is one-to-one with foreign key on the other side */
t8.run = function() {
  var testCase = this;
  var session;

  var t7expectedShoppingCart = new lib.ShoppingCart(1000, 100);
  var t7expectedCustomer = new lib.Customer(100, 'Craig', 'Walton');
  t7expectedCustomer.shoppingCart = t7expectedShoppingCart;

  fail_openSession(testCase, function(s) {
    session = s;
    // query with projection with default null value for shoppingCart
    // Customer -> ShoppingCart -> LineItem -> Item
    session.createQuery(lib.simpleCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')).
        and(q.firstName.isNotNull()).
        and(q.shoppingCart.id.eq(q.param('p2'))));
        return q.execute({"p1": 100, "p2": 1000});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, t7expectedCustomer, actualCustomers[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test default null mapping. Use UK and string field between to find customer.
 * ShoppingCart relationship is one-to-one with foreign key on the other side
 */
t9.run = function() {
  var testCase = this;
  var session;

  var t7expectedShoppingCart = new lib.ShoppingCart(1000, 100);
  var t7expectedCustomer = new lib.Customer(100, 'Craig', 'Walton');
  t7expectedCustomer.shoppingCart = t7expectedShoppingCart;

  fail_openSession(testCase, function(s) {
    session = s;
    // query with projection with default null value for shoppingCart
    // Customer -> ShoppingCart -> LineItem -> Item
    session.createQuery(lib.simpleCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')).
        and(q.firstName.between(q.param('p2'), q.param('p3')).
        and(q.shoppingCart.id.eq(q.param('p4')))));
        return q.execute({"p1": 100, "p2": "C", "p3": "D", "p4": 1000});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, t7expectedCustomer, actualCustomers[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test complex projection relationship types
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 * Customer 101 has no shopping cart. */
t10.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      testCase.errorIfNotEqual('typeof q.id', 'QueryField', q.id.constructor.name);
      testCase.errorIfNotEqual('typeof q.id.columnName', 'string', typeof q.id.columnName);
      testCase.errorIfNotEqual('q.id.columnName', 'id', q.id.columnName);

      testCase.errorIfNotEqual('typeof q.shoppingCart', 'QueryRelationship', q.shoppingCart.constructor.name);
      testCase.errorIfNotEqual('typeof q.shoppingCartid.id.columnName', 'string', typeof q.shoppingCart.id.columnName);
      testCase.errorIfNotEqual('q.shoppingCart.id.columnName', 'id', q.shoppingCart.id.columnName);
      testCase.errorIfNotEqual('typeof q.shoppingCart.id.columnName.eq', 'function', typeof q.shoppingCart.id.eq);

      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems', 'QueryRelationship', q.shoppingCart.lineItems.constructor.name);
      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems.line', 'QueryField', q.shoppingCart.lineItems.line.constructor.name);
      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems.quantity', 'QueryField', q.shoppingCart.lineItems.quantity.constructor.name);
      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems.itemid', 'QueryField', q.shoppingCart.lineItems.itemid.constructor.name);

      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems.item', 'QueryRelationship', q.shoppingCart.lineItems.item.constructor.name);
      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems.item.id', 'QueryField', q.shoppingCart.lineItems.item.id.constructor.name);
      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems.item.description', 'QueryField', q.shoppingCart.lineItems.item.description.constructor.name);
      testCase.errorIfNotEqual('typeof q.shoppingCart.lineItems.item.description.eq', 'function', typeof q.shoppingCart.lineItems.item.description.eq);

      testCase.errorIfNotEqual('typeof q.discounts', 'QueryRelationship', q.discounts.constructor.name);
      testCase.errorIfNotEqual('typeof q.discounts.id', 'QueryField', q.discounts.id.constructor.name);
      testCase.errorIfNotEqual('q.discounts.id.columnName', 'id', q.discounts.id.columnName);

      testCase.errorIfNotEqual('typeof q.shipments', 'QueryRelationship', q.discounts.constructor.name);
      testCase.errorIfNotEqual('typeof q.shipments.id', 'QueryField', q.shipments.id.constructor.name);
      testCase.errorIfNotEqual('typeof q.shipments.value', 'QueryField', q.shipments.value.constructor.name);
    }).
    then(function() {
      testCase.failOnError();
    },
    function(err) {
      testCase.fail(err);
    });
  });
};


exports.tests = [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10];
