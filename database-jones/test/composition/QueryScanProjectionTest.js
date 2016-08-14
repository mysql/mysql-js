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
var udebug = unified_debug.getLogger("QueryScanProjectionTest.js");
lib.mapShop();
var t1 = new harness.ConcurrentTest('t1 Query IndexScanProjectionTest');
var t2 = new harness.ConcurrentTest('t2 Query PartialIndexScanProjectionTestDefaultNull');
var t3 = new harness.ConcurrentTest('t3 Query TableScanProjectionTestDefaultEmptyArray');
var t4 = new harness.ConcurrentTest('t4 Query IndexScanProjectionTestMultipleResults');
var t6 = new harness.ConcurrentTest('t6 Query IndexScanProjectionTestManyToMany');
var t7 = new harness.ConcurrentTest('t7 Query TableScanProjectionTestManyToMany');
var t8 = new harness.ConcurrentTest('t8 Query TableScanProjectionTestNoResults');
var t9 = new harness.ConcurrentTest('t9 Query TableScanProjectionTestManyToManyRelationshipFilter');


/** All key columns specified for index on lastname, firstname.
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 */
t1.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    // query with projection for customer
    // Customer -> ShoppingCart -> LineItem -> Item
    //          \-> Discount
    //          \-> Shipment
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.lastName.eq(q.param('p1')).and(q.firstName.eq(q.param('p2'))));
      return q.execute({"p1": 'Walton', "p2": 'Craig'});
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

/** Projection test default null mapping. Partial index scan on last name.
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 * Customer 101 has no shopping cart. 
 */
t2.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    // query with projection with default null value for shoppingCart
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.lastName.eq(q.param('p1')));
      return q.execute({"p1": 'Burton'});
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

/** Projection test empty array mapping. Table scan using first name, not indexed.
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 * Shopping cart 1003 has no line items 
 */
t3.run = function() {
  var testCase = this;
  var session;
    
  fail_openSession(testCase, function(s) {
    session = s;
    // find with projection with default null value for shoppingCart
    // shopping cart 1003 has no line items
    // Customer -> ShoppingCart -> LineItem -> Item
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.firstName.eq(q.param('p1')));
      return q.execute({"p1": 'Burn'});
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

/** Primary key index scan on id with multiple objects returned. 
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
      q.where(q.id.ge(q.param('p1')).and(q.id.le(q.param('p2'))));
      return q.execute({"p1": 100, "p2": 103});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 4, actualCustomers.length);
      // sort the results
      actualCustomers.sort(lib.sortFunction);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[100], actualCustomers[0]);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[101], actualCustomers[1]);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[102], actualCustomers[2]);
      lib.verifyProjection(testCase, lib.complexCustomerProjection, lib.expectedCustomers[103], actualCustomers[3]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test many to many with join table defined on "left side".
 * Table scan on discount name (not indexed).
 * customer 103 has shopping cart 1003 which has no line item
 * customer 101 has no shopping cart
 * Discount -> Customer -> ShoppingCart -> LineItem -> Item
 */
t6.run = function() {
  var testCase = this;
  var session;

  var t6lineItemProjection = new mynode.Projection(lib.LineItem)
  .addField('line');
var t6shoppingCartProjection = new mynode.Projection(lib.ShoppingCart)
  .addField('id')
  .addRelationship('lineItems', t6lineItemProjection);
var t6customerProjection = new mynode.Projection(lib.Customer)
  .addField('id', 'lastName', 'firstName')
  .addRelationship('shoppingCart', t6shoppingCartProjection);
var t6discountProjection = new mynode.Projection(lib.Discount)
  .addField('id', 'description', 'percent')
  .addRelationship('customers', t6customerProjection);

  var expectedShoppingCart1003 = new lib.ShoppingCart(1003);
  expectedShoppingCart1003.lineItems = [];
  var expectedCustomer103 = new lib.Customer(103, 'Burn', 'Sexton');
  var expectedCustomer101 = new lib.Customer(101, 'Sam', 'Burton');
  expectedCustomer103.shoppingCart = expectedShoppingCart1003;
  expectedCustomer101.shoppingCart = null;
  var t6expectedDiscount = new lib.Discount(3, 'internet special');
  t6expectedDiscount.percent = 20;
  t6expectedDiscount.customers = [expectedCustomer101, expectedCustomer103];
  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(t6discountProjection).
    then(function(q) {
      q.where(q.description.eq(q.param('p1')));
      return q.execute({"p1": 'internet special'});
    }).
    then(function(actualDiscounts) {
      testCase.errorIfNotEqual('result length', 1, actualDiscounts.length);
      lib.verifyProjection(testCase, t6discountProjection, t6expectedDiscount, actualDiscounts[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test many to many with join table defined on "left side".
 * Index scan on percent.
 * Customer 101 has no shopping cart.
 * Customer 103 has shopping cart 1003 which has no line items
 * Discount -> Customer -> ShoppingCart -> LineItem -> Item
 */
t7.run = function() {
  var testCase = this;
  var session;

  var expectedShoppingCart1003 = new lib.ShoppingCart(1003);
  expectedShoppingCart1003.lineItems = [];
  var expectedCustomer103 = new lib.Customer(103, 'Burn', 'Sexton');
  var expectedCustomer101 = new lib.Customer(101, 'Sam', 'Burton');
  expectedCustomer103.shoppingCart = expectedShoppingCart1003;
  expectedCustomer101.shoppingCart = null;
  var t7expectedDiscount = new lib.Discount(3, 'internet special');
  t7expectedDiscount.percent = 20;
  t7expectedDiscount.customers = [expectedCustomer101, expectedCustomer103];
  
  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexDiscountProjection).
    then(function(q) {
      q.where(q.percent.eq(q.param('p1')));
      return q.execute({"p1": 20});
    }).
    then(function(actualDiscounts) {
      testCase.errorIfNotEqual('result length', 1, actualDiscounts.length);
      lib.verifyProjection(testCase, lib.complexDiscountProjection, t7expectedDiscount, actualDiscounts[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Primary key index scan on id with no objects returned.
 * Customer -> ShoppingCart -> LineItem -> Item
 *         \-> Discount
 *         \-> Shipment
 */
t8.run = function() {
  var testCase = this;
  var session;

  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(lib.complexCustomerProjection).
    then(function(q) {
      q.where(q.id.ge(q.param('p1')).and(q.id.le(q.param('p2'))));
      return q.execute({"p1": 55, "p2": 99});
    }).
    then(function(actualCustomers) {
      testCase.errorIfNotEqual('result length', 0, actualCustomers.length);
      // sort the results
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test many to many with join table defined on "left side".
 * Table scan on discount name (not indexed).
 * Filter on item 10014.
 * customer 103 has shopping cart 1003 which has no line item
 * customer 101 has no shopping cart
 * Discount -> Customer -> ShoppingCart -> LineItem -> Item
 */
t9.run = function() {
  var testCase = this;
  var session;

  var t9itemProjection = new mynode.Projection(lib.Item)
  .addField('id');
  var t9lineItemProjection = new mynode.Projection(lib.LineItem)
  .addField('line')
  .addRelationship('item', t9itemProjection);
var t9shoppingCartProjection = new mynode.Projection(lib.ShoppingCart)
  .addField('id')
  .addRelationship('lineItems', t9lineItemProjection);
var t9customerProjection = new mynode.Projection(lib.Customer)
  .addField('id', 'lastName', 'firstName')
  .addRelationship('shoppingCart', t9shoppingCartProjection);
var t9discountProjection = new mynode.Projection(lib.Discount)
  .addField('id', 'description', 'percent')
  .addRelationship('customers', t9customerProjection);

  var expectedItem10014 = new lib.Item(10014);
  var expectedShoppingCart1000 = new lib.ShoppingCart(1000, 100);
  expectedShoppingCart1000.lineItems = [lib.createLineItem(1, 5, 10014, expectedItem10014)];
  var expectedCustomer100 = new lib.Customer(100, 'Craig', 'Walton');
  expectedCustomer100.shoppingCart = expectedShoppingCart1000;
  var expectedDiscount = new lib.Discount(0, 'new customer');
  expectedDiscount.percent = 10;
  expectedDiscount.customers = [expectedCustomer100];
  fail_openSession(testCase, function(s) {
    session = s;
    session.createQuery(t9discountProjection).
    then(function(q) {
      q.where(q.description.eq('new customer').
        and(q.customers.shoppingCart.lineItems.item.id.eq(10014)));
      return q.execute({});
    }).
    then(function(actualDiscounts) {
      var actualDiscount = actualDiscounts[0];
      var actualShoppingCart = actualDiscount.customers[0].shoppingCart;
      var actualItem = actualShoppingCart.lineItems[0].item;
      udebug.log(actualDiscounts[0], actualShoppingCart, actualItem);
      testCase.errorIfNotEqual('result length', 1, actualDiscounts.length);
      lib.verifyProjection(testCase, t9discountProjection, expectedDiscount, actualDiscounts[0]);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};



exports.tests = [t1, t2, t3, t4, t6, t7, t8, t9];
