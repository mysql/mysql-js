/*
 Copyright (c) 2014, 2016, Oracle and/or its affiliates. All rights
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
var udebug = unified_debug.getLogger("composition/lib.js");
var util = require("util");

function Customer(id, first, last) {
  if (id !== undefined) {
    this.id = id;
    this.unikey = id;
    this.firstName = first;
    this.lastName = last;
  }
}

function ShoppingCart(id, customerid) {
  if (id !== undefined) {
    this.id = id;
    this.customerid = customerid;
  }
}

function LineItem(line, shoppingcartid, quantity, itemid) {
  if (line !== undefined) {
    this.line = line;
    this.shoppingcartid = shoppingcartid;
    this.quantity = quantity;
    this.itemid = itemid;
  }  
}

function Item(id, description) {
  if (id !== undefined) {
    this.id = id;
    this.description = description;
  }  
}

function Discount(id, description, percent) {
  if (id !== undefined) {
    this.id = id;
    this.description = description;
    this.percent = percent;
  }  
}

function Shipment(id, customerid, value) {
  if (id != undefined) {
    this.id = id;
    this.customerid = customerid;
    this.value = value;
  }
}

function mapCustomer() {
  // map customer
  var customerMapping = new mynode.TableMapping('customer');
  customerMapping.mapField('id');
  customerMapping.mapField('unikey');
  customerMapping.mapField('firstName', 'firstname');
  customerMapping.mapField('lastName', 'lastname');
  customerMapping.mapOneToOne( {
    fieldName:  'shoppingCart',
    target:      ShoppingCart,
    targetField: 'customer'
  } );
  customerMapping.mapOneToMany( {
    fieldName:  'shipments',
    target:      Shipment,
    targetField: 'customer'
  } ); 
  customerMapping.mapManyToMany( {
    fieldName:   'discounts',
    target:      Discount,
    targetField: 'customers'
  } );

  customerMapping.applyToClass(Customer);
}

function mapShipment() {
  var shipmentMapping = new mynode.TableMapping('shipment');
  shipmentMapping.mapField('id');
  shipmentMapping.mapField('value', mynode.converters.NumericConverter);
  shipmentMapping.mapManyToOne( {
    fieldName:  'customer',
    foreignKey: 'fkshipmentcustomerid',
    target:     Customer
  });

  shipmentMapping.applyToClass(Shipment);
}

function mapShoppingCart() {
  // map shopping cart
  var shoppingCartMapping = new mynode.TableMapping('shoppingcart');
  shoppingCartMapping.mapField('id');

  shoppingCartMapping.mapOneToOne( { 
    fieldName:  'customer', 
    foreignKey: 'fkshoppingcartcustomerid',
    target:     Customer
  } );

  shoppingCartMapping.mapOneToMany( { 
    fieldName:  'lineItems', 
    targetField: 'shoppingCart', 
    target:     LineItem
  } );

  shoppingCartMapping.applyToClass(ShoppingCart);
}

function mapLineItem() {
  // map line item
  var lineItemMapping = new mynode.TableMapping('lineitem');
  lineItemMapping.mapField('line');
  lineItemMapping.mapField('quantity');
  lineItemMapping.mapField('shoppingcartid');
  lineItemMapping.mapField('itemid');
  
  lineItemMapping.mapManyToOne( {
    fieldName:  'shoppingCart',
    foreignKey: 'fklineitemshoppingcartid',
    target:     ShoppingCart
  });

  lineItemMapping.mapManyToOne( {
    fieldName:  'item',
    foreignKey: 'fklineitemitemid',
    target:     Item
  });

  lineItemMapping.applyToClass(LineItem);
}

function mapItem() {
  var itemMapping = new mynode.TableMapping('item');
  itemMapping.mapField('id');
  itemMapping.mapField('description');

  itemMapping.mapOneToMany( { 
    fieldName:  'lineItems',
    target:      LineItem, 
    targetField: 'item' 
  } ); 
  
  itemMapping.applyToClass(Item);
}

function mapDiscount() {
  var discountMapping = new mynode.TableMapping('discount');
  discountMapping.mapField('id');
  discountMapping.mapField('description');
  discountMapping.mapField('percent');

  discountMapping.mapManyToMany( { 
    fieldName:  'customers',
    target:      Customer,
    joinTable:  'customerdiscount'
  } ); 

  discountMapping.applyToClass(Discount);
}

function CustomerDiscount(customerid, discountid) {
  if (customerid !== undefined) {
    this.customerid = customerid;
    this.discountid = discountid;
  }
}

function mapCustomerDiscount() {
  var customerDiscountMapping = new mynode.TableMapping('customerdiscount');
  customerDiscountMapping.mapField('customerid');
  customerDiscountMapping.mapField('discountid');
  customerDiscountMapping.applyToClass(CustomerDiscount);
}

function FkDifferentDb(id) {
  if (id !== undefined) {
    this.id = id;
  }
}

function mapFkDifferentDb() {
  var fkDifferentDbMapping = new mynode.TableMapping('testfk.fkdifferentdb');
  fkDifferentDbMapping.mapField('id');
  fkDifferentDbMapping.applyToClass(FkDifferentDb);
}

function verifyFK(testCase, tableMetadata, fks) {
  function verify(name, expected, actual) {
    var expectedValue = expected[name];
    var actualValue = actual[name];
    if (actualValue === undefined) {
      testCase.appendErrorMessage('\nExpected ' + name + ' was undefined');
      return;
    }
    switch(typeof expectedValue) {
    case 'string':
      if (expectedValue !== actualValue) {
        testCase.appendErrorMessage('\nMismatch on ' + name + '; expected: ' + expectedValue + '; actual: ' + actualValue);
      }
      break;
    case 'object':
      if (!Array.isArray(actualValue)) {
        testCase.appendErrorMessage('\nUnexpected not an array: ' + util.inspect(actualValue));
      } else {
        expectedValue.forEach(function(element) {
          if (actualValue.indexOf(element) == -1) {
            testCase.appendErrorMessage('\nExpected element missing from ' + name + ': ' + element + ' in ' + util.inspect(actualValue));
          }
        });
      }
      break;
    }
  }
  if (!tableMetadata.foreignKeys) {
    testCase.appendErrorMessage('\nMetadata for ' + tableMetadata.name + ' did not include foreignKeys.');
  } else {
    fks.forEach(function(fkexpected) {
      var found = false;
      tableMetadata.foreignKeys.forEach(function(fkactual) {
        if (fkexpected.name === fkactual.name) {
          found = true;
          verify('targetTable', fkexpected, fkactual);
          verify('targetDatabase', fkexpected, fkactual);
          verify('columnNames', fkexpected, fkactual);
          verify('targetColumnNames', fkexpected, fkactual);
        }
      });
      if (!found) {
        testCase.appendErrorMessage('\nNo foreign key ' + fkexpected.name + ' in table metadata for ' + tableMetadata.name);
      }
    });
  }
}

function mapShop() {
  mapCustomer();
  mapShoppingCart();
  mapLineItem();
  mapItem();
  mapDiscount();
  mapCustomerDiscount();
  mapShipment();
}

var shopDomainObjects = [Customer, ShoppingCart, LineItem, Item, Discount, CustomerDiscount, Shipment];

function createLineItem(line, quantity, itemid, item) {
  var result = new LineItem();
  result.line = line;
  result.quantity = quantity;
  result.itemid = itemid;
  if (item) { result.item = item; }
  return result;
}

function sortFunction(a, b) {
  // sort based on id if it exists, or on line if it exists or throw an exception
  if (a.id !== undefined && b.id !== undefined) {
    return a.id - b.id;
  }
  if (a.line !== undefined && b.line !== undefined) {
    return a.line - b.line;
  }
  throw new Error('Error: can only sort objects containing properties id or line.');
}

function verifyProjection(tc, p, e, a) {
  var testCase = tc;
  var projectionVerifications;
  var projectionVerification;
  var i;
  
  function verifyOneProjection() {
    udebug.log_detail('verifyOneProjection with', projectionVerifications.length, 'waiting:\n', projectionVerifications[0]);
    var projection, expected, actual, domainObjectName, expectedField;
    var actualField, expectedRelationship, actualRelationship;

    function verifyProjectionField(fieldName) {
      expectedField = expected[fieldName];
      actualField = actual[fieldName];
      if (expectedField !== actualField) {
        testCase.appendErrorMessage('\n' + testCase.name +
            ' VerifyProjection failure for ' + domainObjectName + ' field ' + fieldName +
            '\nexpected: (' + typeof expectedField + ') ' + expectedField +
            '\nactual: (' + typeof actualField + ') ' + actualField);
        }
    }

    function verifyProjectionRelationships(relationshipName) {
      expectedRelationship = expected[relationshipName];
      actualRelationship = actual[relationshipName];
      if (Array.isArray(expectedRelationship)) {
        if (Array.isArray(actualRelationship)) {
          // we need to sort the actual array
          // TODO let the user provide a sort function
          actualRelationship.sort(sortFunction);
          if (expectedRelationship.length === actualRelationship.length) {
            // check each value in turn
            for (i = 0; i < expectedRelationship.length; ++i) {
              projectionVerifications.push([projection.relationships[relationshipName],
                  expectedRelationship[i], actualRelationship[i]]);
            }
          } else {
            testCase.appendErrorMessage('\n' + testCase.name +
              ' VerifyProjection failure for ' + domainObjectName +
              ' relationship ' + relationshipName +
              ' expected relationship length: ' + expectedRelationship.length +
              ' actual relationship length: ' + actualRelationship.length);
          }
        } else {
          testCase.appendErrorMessage('\n' + testCase.name +
              ' VerifyProjection failure for ' + domainObjectName +
              ' relationship ' + relationshipName +
              ' actual relationship is not an array: ' + actualRelationship);
        }
      } else {
        // expected value is an object
        if ((expectedRelationship === undefined && actualRelationship !== undefined) ||
            (expectedRelationship === null && actualRelationship !== null) ||
            (expectedRelationship !== undefined & actualRelationship === undefined) ||
            (expectedRelationship !== null && actualRelationship === null)) {
          // error
          testCase.appendErrorMessage('\n' + testCase.name +
              ' VerifyProjection failure for ' + domainObjectName +
              ' relationship ' + relationshipName +
              '\nexpected relationship: ' + util.inspect(expectedRelationship) +
              '\nactual relationship: ' + util.inspect(actualRelationship));
        } else {
          if (!((expectedRelationship === undefined && actualRelationship === undefined) ||
                (expectedRelationship === null && actualRelationship === null))) {
            // we need to check the values
            projectionVerifications.push([projection.relationships[relationshipName],
              expectedRelationship, actualRelationship]);
          }
        }
      }
    }

    while (projectionVerifications.length > 0) {
      projectionVerification = projectionVerifications.shift();
      projection = projectionVerification[0];
      expected = projectionVerification[1];
      actual = projectionVerification[2];
      domainObjectName = projection.domainObject.prototype.constructor.name;
      // check that the actual object exists and is unexpected
      if ((expected !== null && actual === null) ||
           (expected !== undefined && actual === undefined)) {
        testCase.appendErrorMessage('\n' + testCase.name +
              ' VerifyProjection failure for ' + domainObjectName +
              '\nexpected: ' + util.inspect(expected) + '\nactual: ' + actual);
        continue;
      }
      // check for null and undefined 
      if ((expected === undefined && actual === undefined) ||
          (expected === null && actual === null)) {
        continue;
      }
      // verify the fields first
      projection.fields.forEach(verifyProjectionField);
      // now verify the relationships (iteratively)
      if (projection.relationships) {
        Object.keys(projection.relationships).forEach(verifyProjectionRelationships);
      }
      verifyOneProjection();
    }
  }
  // verifyProjection starts here
  projectionVerifications = [[p, e, a]];
  verifyOneProjection();
}

mapShop();

// Complex Customer projection
var itemProjection = new mynode.Projection(Item)
.addFields('id', 'description');
//LineItem -> Item
var lineItemProjection = new mynode.Projection(LineItem)
.addFields('line', ['quantity', 'itemid'])
.addRelationship('item', itemProjection);
//ShoppingCart -> LineItem -> Item
var shoppingCartProjection = new mynode.Projection(ShoppingCart)
.addFields('id')
.addRelationship('lineItems', lineItemProjection);
//Discount
var discountProjection = new mynode.Projection(Discount)
.addField('id', 'description');
//Shipment
var shipmentProjection = new mynode.Projection(Shipment)
.addField('id', 'value');
//Customer -> ShoppingCart -> LineItem -> Item
//        \-> Discount
//        \-> Shipment
var complexCustomerProjection = new mynode.Projection(Customer)
.addFields('id', 'firstName', 'lastName')
.addRelationship('shoppingCart', shoppingCartProjection)
.addRelationship('discounts', discountProjection)
.addRelationship('shipments', shipmentProjection);

// Complex Discount projection
var discountItemProjection = new mynode.Projection(Item)
.addFields('id', 'description');
//LineItem -> Item
var discountLineItemProjection = new mynode.Projection(LineItem)
.addFields('line', ['quantity', 'itemid'])
.addRelationship('item', discountItemProjection);
//ShoppingCart -> LineItem -> Item
var discountShoppingCartProjection = new mynode.Projection(ShoppingCart)
.addFields('id')
.addRelationship('lineItems', discountLineItemProjection);
//Customer -> ShoppingCart -> LineItem -> Item
var discountCustomerProjection = new mynode.Projection(Customer)
.addField('id', 'firstName', 'lastName')
.addRelationship('shoppingCart', discountShoppingCartProjection);
//Discount -> Customer -> ShoppingCart -> LineItem -> Item

var complexDiscountProjection = new mynode.Projection(Discount)
.addField('id', 'description', 'percent')
.addRelationship('customers',discountCustomerProjection);

// Expected results from complex customer queries
var expectedDiscount0 = new Discount(0, 'new customer', 10);
var expectedDiscount1 = new Discount(1, 'good customer', 15);
var expectedDiscount2 = new Discount(2, 'spring sale', 10);
var expectedDiscount3 = new Discount(3, 'internet special', 20);
var expectedDiscount4 = new Discount(4, 'closeout', 50);

var expectedItem10000 = new Item(10000, 'toothpaste');
var expectedItem10001 = new Item(10001, 'razor blade 10 pack');
var expectedItem10002 = new Item(10002, 'deodorant');
var expectedItem10003 = new Item(10003, 'hatchet');
var expectedItem10004 = new Item(10004, 'weed-b-gon');
var expectedItem10005 = new Item(10005, 'cola 24 pack');
var expectedItem10006 = new Item(10006, 'diet cola 24 pack');
var expectedItem10007 = new Item(10007, 'diet root beer 12 pack');
var expectedItem10008 = new Item(10008, 'whole wheat bread');
var expectedItem10009 = new Item(10009, 'raisin bran');
var expectedItem10010 = new Item(10010, 'milk gallon');
var expectedItem10011 = new Item(10011, 'half and half');
var expectedItem10012 = new Item(10012, 'tongue depressor');
var expectedItem10013 = new Item(10013, 'smelling salt');
var expectedItem10014 = new Item(10014, 'holy bible');

var expectedShoppingCart1000 = new ShoppingCart(1000, 100);
expectedShoppingCart1000.lineItems = [
  createLineItem(0, 1, 10000, expectedItem10000),
  createLineItem(1, 5, 10014, expectedItem10014),
  createLineItem(2, 2, 10011, expectedItem10011)
  ];
var expectedShoppingCart1002 = new ShoppingCart(1002, 102);
expectedShoppingCart1002.lineItems = [
	createLineItem(0, 10, 10008, expectedItem10008),
	createLineItem(1, 4, 10010, expectedItem10010),
	createLineItem(2, 40, 10002, expectedItem10002),
	createLineItem(3, 100, 10011, expectedItem10011),
	createLineItem(4, 1, 10013, expectedItem10013),
	createLineItem(5, 8, 10005, expectedItem10005)
	];
var expectedShoppingCart1003 = new ShoppingCart(1003, 103);
expectedShoppingCart1003.lineItems = [];

var expectedShipment10000 = new Shipment(10000, undefined, 120.99);
var expectedShipment10001 = new Shipment(10001, undefined, 130);
var expectedShipment10100 = new Shipment(10100, undefined, 1320.87);
var expectedShipment10102 = new Shipment(10102, undefined, 144.44);
var expectedShipment10200 = new Shipment(10200, undefined, 45.87);
var expectedShipment10201 = new Shipment(10201, undefined, 67.44);
var expectedShipment10202 = new Shipment(10202, undefined, 80.89);
var expectedShipment10203 = new Shipment(10203, undefined, 1045.87);

// expected Customer using complex projection
// Customer -> ShoppingCart -> LineItem -> Item
//          \-> Discount
//          \-> Shipment
var expectedCustomer100 = new Customer(100, 'Craig', 'Walton');
expectedCustomer100.shoppingCart = expectedShoppingCart1000;
expectedCustomer100.shipments = [expectedShipment10000, expectedShipment10001];
expectedCustomer100.discounts = [expectedDiscount0];

var expectedCustomer101 = new Customer(101, 'Sam', 'Burton');
expectedCustomer101.shoppingCart = null;
expectedCustomer101.shipments = [expectedShipment10100, expectedShipment10102];
expectedCustomer101.discounts = [expectedDiscount1, expectedDiscount3, expectedDiscount4];

var expectedCustomer102 = new Customer(102, 'Wal', 'Greeton');
expectedCustomer102.shoppingCart = expectedShoppingCart1002;
expectedCustomer102.shipments = 
	  [expectedShipment10200, expectedShipment10201, expectedShipment10202, expectedShipment10203];
expectedCustomer102.discounts = [expectedDiscount2];

var expectedCustomer103 = new Customer(103, 'Burn', 'Sexton');
expectedCustomer103.shoppingCart = expectedShoppingCart1003;
expectedCustomer103.shipments = [];
expectedCustomer103.discounts = [expectedDiscount3];

var expectedCustomers = 
  {'100': expectedCustomer100,'101': expectedCustomer101,'102': expectedCustomer102,'103': expectedCustomer103};

var expectedShipments =
	{ '10000': expectedShipment10000, '10001': expectedShipment10001,
    '10100': expectedShipment10100, '10102': expectedShipment10102,
    '10200': expectedShipment10200, '10201': expectedShipment10201,'10202': expectedShipment10202, '10203': expectedShipment10203};
exports.Customer = Customer;
exports.mapCustomer = mapCustomer;
exports.ShoppingCart = ShoppingCart;
exports.mapShoppingCart = mapShoppingCart;
exports.LineItem = LineItem;
exports.mapLineItem = mapLineItem;
exports.Item = Item;
exports.mapItem = mapItem;
exports.Discount = Discount;
exports.mapDiscount = mapDiscount;
exports.CustomerDiscount = CustomerDiscount;
exports.mapCustomerDiscount = mapCustomerDiscount;
exports.FkDifferentDb = FkDifferentDb;
exports.mapFkDifferentDb = mapFkDifferentDb;
exports.mapShop = mapShop;
exports.verifyFK = verifyFK;
exports.verifyProjection = verifyProjection;
exports.shopDomainObjects = shopDomainObjects;
exports.createLineItem = createLineItem;
exports.Shipment = Shipment;
exports.sortFunction = sortFunction;
exports.complexCustomerProjection = complexCustomerProjection;
exports.complexDiscountProjection = complexDiscountProjection;
exports.expectedCustomers = expectedCustomers;
exports.expectedShipments = expectedShipments;