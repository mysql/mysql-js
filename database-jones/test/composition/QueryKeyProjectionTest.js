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

var jones = require("database-jones");
var unified_debug = require("unified_debug");
var harness = require("jones-test");
var lib = require('./lib.js');
var udebug = unified_debug.getLogger("QueryKeyProjectionTest.js");

lib.mapShop();

var t1 = new harness.ConcurrentTest('t1 Query IdProjectionTest');
var t2 = new harness.ConcurrentTest('t2 Query IdProjectionTestDefaultNull');
var t3 = new harness.ConcurrentTest('t3 Query IdProjectionTestDefaultEmptyArray');
var t4 = new harness.ConcurrentTest('t4 Query UKProjectionTest');
var t5 = new harness.ConcurrentTest('t5 Query UKProjectionTestDefaultNull');
var t6 = new harness.ConcurrentTest('t6 Query IdProjectionTestManyToMany');
var t7 = new harness.ConcurrentTest('t7 Query IdProjectionTestManyToManyOtherSide');
var t8 = new harness.ConcurrentTest('t8 Query IdProjectionTestNoCustomer');
var t9 = new harness.ConcurrentTest('t9 Query IdProjectionTestMultipleRelationships');

/** query with projection for complex customer by primary key
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment */
t1.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')));
      return q.execute({"p1": 100});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[100], actualCustomers[0]);
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
t2.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')));
      return q.execute({"p1": 101});
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

/** Projection test empty array mapping
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 * Shopping cart 1003 has no line items */
t3.run = function() {
  var testCase = this;
  var session;
    
  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')));
      return q.execute({"p1": 103});
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
t4.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
    q.where(q.unikey.eq(q.param('p1')));
    return q.execute({"p1": 100});
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
t5.run = function() {
    var testCase = this;
    var session;

    fail_openSession(testCase, function(s) {
      session = s;
      // query with projection with default null value for shoppingCart
      // Customer -> ShoppingCart -> LineItem -> Item
      session.createQuery(lib.complexCustomerProjection).
      then(function(q) {
        q.where(q.unikey.eq(q.param('p1')));
        return q.execute({"p1": 101});
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


/** Projection test many to many with join table defined on "left side".
 * Shopping cart 1003 has no line items.
 * Customer 101 has no shopping cart. */
t6.run = function() {
  var testCase = this;
  var session;

  var expectedShoppingCart1003 = new lib.ShoppingCart(1003);
  expectedShoppingCart1003.lineItems = [];
  var expectedCustomer103 = new lib.Customer(103, 'Burn', 'Sexton');
  var expectedCustomer101 = new lib.Customer(101, 'Sam', 'Burton');
  expectedCustomer103.shoppingCart = expectedShoppingCart1003;
  expectedCustomer101.shoppingCart = null;
  var t6expectedDiscount = new lib.Discount(3, 'internet special', 20);
  t6expectedDiscount.customers = [expectedCustomer101, expectedCustomer103];
  fail_openSession(testCase, function(s) {
    session = s;
    // customer 103 has shopping cart 1003 which has no line items
    // customer 101 has no shopping cart
    // Discount -> Customer -> ShoppingCart -> LineItem -> Item
    session.createQuery(lib.complexDiscountProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')));
      return q.execute({"p1": 3});
    }).
    then(function(actualDiscounts) {
      testCase.errorIfNotEqual('result length', 1, actualDiscounts.length);
      lib.verifyProjection(testCase, lib.complexDiscountProjection, t6expectedDiscount, actualDiscounts[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test many to many with join table defined on "other side"
 */
t7.run = function() {
  var testCase = this;
  var session;

  var expectedDiscount1 = new lib.Discount(1, 'good customer');
  var expectedDiscount3 = new lib.Discount(3, 'internet special');
  var expectedDiscount4 = new lib.Discount(4, 'closeout');
  var t7discountProjection = new jones.Projection(lib.Discount)
    .addFields('description');
  t7discountProjection.name = 't7discountProjection';
  var t7customerProjection = new jones.Projection(lib.Customer)
    .addFields('id', 'firstName', 'lastName')
    .addRelationship('discounts', t7discountProjection);
  t7customerProjection.name = 't7customerProjection';
  var expectedCustomer101 = new lib.Customer(101, 'Sam', 'Burton');
  expectedCustomer101.discounts = [expectedDiscount1, expectedDiscount3, expectedDiscount4];
  fail_openSession(testCase, function(s) {
    session = s;
    // customer 101 has three discounts
    // Customer -> Discount
    session.createQuery(t7customerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')));
      return q.execute({"p1": 101});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, t7customerProjection, expectedCustomer101, actualCustomers[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** query with projection for complex customer by primary key
 * Customer does not exist
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment */
t8.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')));
      return q.execute({"p1": 99});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 0, actualCustomers.length);
      testCase.failOnError();}).
    then(null, function(err) { testCase.fail(err); });
  });
};

/** Projection test multiple relationships with string key
 */
t9.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.eq(q.param('p1')));
      return q.execute({"p1": '100'});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 1, actualCustomers.length);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[100], actualCustomers[0]);
      testCase.failOnError();}).
      then(null, function(err) {
        testCase.fail(err);
    });
  });
};



exports.tests = [t1, t2, t3, t4, t5, t6, t7, t8, t9];
