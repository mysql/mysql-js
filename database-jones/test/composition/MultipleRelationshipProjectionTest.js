/*
 Copyright (c) 2015, Oracle and/or its affiliates. All rights
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
var udebug = unified_debug.getLogger("MultipleProjectionTest.js");
lib.mapShop();
var t1 = new harness.ConcurrentTest('t1 ProjectionTest');
var t2 = new harness.ConcurrentTest('t2 ProjectionTestDefaultNull');
var t3 = new harness.ConcurrentTest('t3 ProjectionTestDefaultEmptyArray');
var t6 = new harness.ConcurrentTest('t6 ProjectionTestManyToMany');
var t7 = new harness.ConcurrentTest('t7 ProjectionTestManyToManyOtherSide');
var t9 = new harness.ConcurrentTest('t9 ProjectionTestMultipleRelationships');

var itemProjection = new mynode.Projection(lib.Item);
itemProjection.addFields('id', 'description');
// LineItem -> Item
var lineItemProjection = new mynode.Projection(lib.LineItem);
lineItemProjection.addFields('line', ['quantity', 'itemid']);
lineItemProjection.addRelationship('item', itemProjection);
// ShoppingCart -> LineItem -> Item
var shoppingCartProjection = new mynode.Projection(lib.ShoppingCart);
shoppingCartProjection.addFields('id');
shoppingCartProjection.addRelationship('lineItems', lineItemProjection);
//Discount
var discountProjection = new mynode.Projection(lib.Discount);
discountProjection.addField('id', 'description');
// Shipment
var shipmentProjection = new mynode.Projection(lib.Shipment);
shipmentProjection.addField('id', 'value');
// Customer -> ShoppingCart -> LineItem -> Item
//          \> Discount
//          \> Shipment
var complexCustomerProjection = new mynode.Projection(lib.Customer);
complexCustomerProjection.addFields('id', 'firstName', 'lastName');
complexCustomerProjection.addRelationship('shoppingCart', shoppingCartProjection);
complexCustomerProjection.addRelationship('discounts', discountProjection);
complexCustomerProjection.addRelationship('shipments', shipmentProjection);

var expectedDiscount0 = new lib.Discount(0, 'new customer', 10);
var expectedDiscount1 = new lib.Discount(1, 'good customer');
var expectedDiscount3 = new lib.Discount(3, 'internet special');
var expectedDiscount4 = new lib.Discount(4, 'closeout');

var expectedItem10000 = new lib.Item(10000, 'toothpaste');
var expectedItem10011 = new lib.Item(10011, 'half and half');
var expectedItem10014 = new lib.Item(10014, 'holy bible');

var expectedShipment10000 = new lib.Shipment(10000, undefined, 120.99);
var expectedShipment10001 = new lib.Shipment(10001, undefined, 130);
var expectedShipment10100 = new lib.Shipment(10100, undefined, 1320.87);
var expectedShipment10102 = new lib.Shipment(10102, undefined, 144.44);
var expectedShipment10200 = new lib.Shipment(10200, undefined, 45.87);
var expectedShipment10201 = new lib.Shipment(10201, undefined, 67.44);
var expectedShipment10202 = new lib.Shipment(10202, undefined, 80.89);
var expectedShipment10203 = new lib.Shipment(10203, undefined, 1045.87);

t1.run = function() {
  var testCase = this;
  var session;

  var expectedCustomer = new lib.Customer(100, 'Craig', 'Walton');
  var expectedShoppingCart = new lib.ShoppingCart(1000);
  var expectedLineItem0 = lib.createLineItem(0, 1, 10000);
  var expectedLineItem1 = lib.createLineItem(1, 5, 10014);
  var expectedLineItem2 = lib.createLineItem(2, 2, 10011);
  var expectedLineItems = [expectedLineItem0,
                           expectedLineItem1,
                           expectedLineItem2
                         ];
  expectedLineItem0.item = expectedItem10000;
  expectedLineItem1.item = expectedItem10014;
  expectedLineItem2.item = expectedItem10011;
  expectedShoppingCart.lineItems = expectedLineItems;
  expectedCustomer.shoppingCart = expectedShoppingCart;
  expectedCustomer.discounts = [expectedDiscount0];
  expectedCustomer.shipments = [expectedShipment10000, expectedShipment10001];

  fail_openSession(testCase, function(s) {
    session = s;
    // find with projection for customer
    // Customer -> ShoppingCart -> LineItem -> Item
    session.find(complexCustomerProjection, '100').
    then(function(actualCustomer) {
      lib.verifyProjection(testCase, complexCustomerProjection, expectedCustomer, actualCustomer);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test default null mapping.
 * Customer 101 has no shopping cart. */
t2.run = function() {
  var testCase = this;
  var session;

  var expectedCustomer = new lib.Customer(101, 'Sam', 'Burton');
  expectedCustomer.shoppingCart = null;
  expectedCustomer.shipments = [expectedShipment10100, expectedShipment10102];
  expectedCustomer.discounts = [expectedDiscount1, expectedDiscount3, expectedDiscount4];
  fail_openSession(testCase, function(s) {
    session = s;
    // find with projection with default null value for shoppingCart
    // Customer -> ShoppingCart -> LineItem -> Item
    session.find(complexCustomerProjection, '101').
    then(function(actualCustomer) {
      lib.verifyProjection(testCase, complexCustomerProjection, expectedCustomer, actualCustomer);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test empty array mapping 
 * Shopping cart 1003 has no line items */
t3.run = function() {
  var testCase = this;
  var session;

  var expectedShoppingCart = new lib.ShoppingCart(1003);
  expectedShoppingCart.lineItems = [];
  var expectedCustomer = new lib.Customer(103, 'Burn', 'Sexton');
  expectedCustomer.shoppingCart = expectedShoppingCart;
  expectedCustomer.discounts = [expectedDiscount3];
  expectedCustomer.shipments = [];
  fail_openSession(testCase, function(s) {
    session = s;
    // find with projection with default null value for shoppingCart
    // shopping cart 1003 has no line items
    // Customer -> ShoppingCart -> LineItem -> Item
    session.find(complexCustomerProjection, '103').
    then(function(actualCustomer) {
      lib.verifyProjection(testCase, complexCustomerProjection, expectedCustomer, actualCustomer);
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
  var t6expectedDiscount = new lib.Discount(3, 'internet special');
  t6expectedDiscount.customers = [expectedCustomer101, expectedCustomer103];
  fail_openSession(testCase, function(s) {
    session = s;
    // customer 103 has shopping cart 1003 which has no line items
    // customer 101 has no shopping cart
    // Discount -> Customer -> ShoppingCart -> LineItem -> Item
    session.find(discountProjection, '3').
    then(function(actualDiscount) {
      lib.verifyProjection(testCase, discountProjection, t6expectedDiscount, actualDiscount);
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

  var t7discountProjection = new mynode.Projection(lib.Discount);
  t7discountProjection.addFields('description');
  t7discountProjection.name = 't7discountProjection';
  var t7customerProjection = new mynode.Projection(lib.Customer);
  t7customerProjection.addFields('id', 'firstName', 'lastName');
  t7customerProjection.addRelationship('discounts', t7discountProjection);
  t7customerProjection.name = 't7customerProjection';
  var expectedCustomer101 = new lib.Customer(101, 'Sam', 'Burton');
  expectedCustomer101.discounts = [expectedDiscount1, expectedDiscount3, expectedDiscount4];
  fail_openSession(testCase, function(s) {
    session = s;
    // customer 101 has three discounts
    // Customer -> Discount
    session.find(t7customerProjection, '101').
    then(function(actualCustomer) {
      lib.verifyProjection(testCase, t7customerProjection, expectedCustomer101, actualCustomer);
      testCase.failOnError();}).
    then(null, function(err) {
      testCase.fail(err);
    });
  });
};

/** Projection test multiple relationships
 * customer-> shoppingCart -> lineItem 
 *         \> discount
 */
t9.run = function() {
  var testCase = this;
  var session;

  var t9expectedCustomer100 = new lib.Customer(100, 'Craig', 'Walton');
  var t9expectedShoppingCart = new lib.ShoppingCart(1000);
  var t9expectedLineItem0 = lib.createLineItem(0, 1, 10000);
  var t9expectedLineItem1 = lib.createLineItem(1, 5, 10014);
  var t9expectedLineItem2 = lib.createLineItem(2, 2, 10011);
  var t9expectedLineItems = [t9expectedLineItem0,
                             t9expectedLineItem1,
                             t9expectedLineItem2
                             ];
  var t9expectedItem10000 = new lib.Item(10000, 'toothpaste');
  var t9expectedItem10011 = new lib.Item(10011, 'half and half');
  var t9expectedItem10014 = new lib.Item(10014, 'holy bible');
  t9expectedLineItem0.item = t9expectedItem10000;
  t9expectedLineItem1.item = t9expectedItem10014;
  t9expectedLineItem2.item = t9expectedItem10011;
  var t9expectedDiscount = new lib.Discount(0, 'new customer', 10);
  t9expectedShoppingCart.lineItems = t9expectedLineItems;
  t9expectedCustomer100.shoppingCart = t9expectedShoppingCart;
  t9expectedCustomer100.discounts = [t9expectedDiscount]; 
  t9expectedCustomer100.shipments = [expectedShipment10000, expectedShipment10001];

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(complexCustomerProjection, 100).
    then(function(actualCustomer) {
      lib.verifyProjection(testCase, complexCustomerProjection, t9expectedCustomer100, actualCustomer);
      testCase.failOnError();}).
      then(null, function(err) {
        testCase.fail(err);
    });
  });
};



exports.tests = [t1, t2, t3, t6, t7, t9];
