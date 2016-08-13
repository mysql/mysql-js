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

var util = require("util");
var lib = require('./lib.js');

/** Error conditions to be tested:
 * t1 projection field that does not exist in the mapping
 * t2 relationship field that does not exist in the mapping
 * t3 projected field that is a relationship in the mapping
 * t4 projected relationship field that is a non-relationship field in the mapping
 * t5 relationship field that would cause a recursion
 * t6 projection domain object that is not mapped
 * t7 many-to-many relationship with a bad join table name
 * t8 many-to-many relationship with no join table
 * t9 many-to-many relationship is not mapped
 * t10 many-to-many relationship neither side defines joinTable
 * t11 one-to-one relationship neither side defined foreignKey
 * t12 reuse projection in two different projections
 * t13 projection query relationship with illegal operation eq
 * t14 projection query relationship with illegal operation ne
 * t15 projection query relationship with illegal operation lt
 * t16 projection query relationship with illegal operation le
 * t17 projection query relationship with illegal operation gt
 * t18 projection query relationship with illegal operation ge
 * t19 projection query relationship with illegal operation between
 */
var t1 = new harness.ConcurrentTest('t1 ProjectionFieldNotMapped');
var t2 = new harness.ConcurrentTest('t2 ProjectionRelationshipNotMapped');
var t3 = new harness.ConcurrentTest('t3 ProjectionFieldIsRelationship');
var t4 = new harness.ConcurrentTest('t4 ProjectionRelationshipIsField');
var t5 = new harness.ConcurrentTest('t5 ProjectionRecursion');
var t6 = new harness.ConcurrentTest('t6 ProjectionUnmappedDomainObject');
var t7 = new harness.ConcurrentTest('t7 ProjectionManyToManyBadJoinTable');
var t8 = new harness.ConcurrentTest('t8 ProjectionManyToManyNoJoinTableSpecified');
var t9 = new harness.ConcurrentTest('t9 ProjectionManyToManyRelationshipFieldNotMapped');
var t10 = new harness.ConcurrentTest('t10 ProjectionManyToManyRelationshipNoJoinTable');
var t11 = new harness.ConcurrentTest('t11 ProjectionOneToOneRelationshipNoForeignKey');
var t12 = new harness.ConcurrentTest('t12 ProjectionReuseProjection');
var t13 = new harness.ConcurrentTest('t13 ProjectionQueryRelationshipIllegalOpEQ');
var t14 = new harness.ConcurrentTest('t14 ProjectionQueryRelationshipIllegalOpNE');
var t15 = new harness.ConcurrentTest('t15 ProjectionQueryRelationshipIllegalOpLT');
var t16 = new harness.ConcurrentTest('t16 ProjectionQueryRelationshipIllegalOpLE');
var t17 = new harness.ConcurrentTest('t17 ProjectionQueryRelationshipIllegalOpGT');
var t18 = new harness.ConcurrentTest('t18 ProjectionQueryRelationshipIllegalOpGE');
var t19 = new harness.ConcurrentTest('t19 ProjectionQueryRelationshipIllegalOpBetween');

t1.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'unmappedField is not mapped';
  var customerProjection = new mynode.Projection(lib.Customer);
  customerProjection.addFields('unmappedField');

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(customerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t1 Unexpected success of find with error projection.');
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t1 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t2.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'unmappedRelationship is not mapped';
  var customerProjection = new mynode.Projection(lib.Customer);
  var shoppingCartProjection = new mynode.Projection(lib.ShoppingCart);
  customerProjection.addRelationship('unmappedRelationship', shoppingCartProjection);

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(customerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t2 Unexpected success of find with error projection.');
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t2 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t3.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'shoppingCart must not be a relationship';
  var customerProjection = new mynode.Projection(lib.Customer);
  customerProjection.addField('shoppingCart');

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(customerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t3 Unexpected success of find with error projection.');
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t3 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t4.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'shoppingCart must not be a relationship';
  var customerProjection = new mynode.Projection(lib.Customer);
  customerProjection.addField('shoppingCart');

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(customerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t4 Unexpected success of find with error projection.');
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t4 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t5.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'Recursive projection for Customer';
  var customerProjection = new mynode.Projection(lib.Customer);
  var shoppingCartProjection = new mynode.Projection(lib.ShoppingCart);
  customerProjection.addRelationship('shoppingCart', shoppingCartProjection);
  shoppingCartProjection.addRelationship('customer', customerProjection);

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(customerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t5 Unexpected success of find with error projection.');
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t5 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t6.run = function() {
  var testCase = this;
  var expectedErrorMessage = 'mapped domain object';
  var unmapped;
  function Unmapped() {}
  try {
    unmapped = new mynode.Projection(Unmapped);
    testCase.fail('unexpected success for unmapped domain object: ' + unmapped);
  } catch(err) {
    // good catch; make sure error message is right
    if (err.message.indexOf(expectedErrorMessage) === -1) {
      testCase.fail('t6 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
    } else {
      testCase.pass();
    }
  }
};

t7.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'field discounts join table customerdishcount failed';
  function BadCustomer() {}
  var badCustomerMapping = new mynode.TableMapping('customer');
  badCustomerMapping.mapField('id');
  badCustomerMapping.mapManyToMany( {
    fieldName:   'discounts',
    target:      lib.Discount,
    joinTable:   'customerdishcount'
  } );

  badCustomerMapping.applyToClass(BadCustomer);

  var badCustomerProjection = new mynode.Projection(BadCustomer);

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(badCustomerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t6 Unexpected success of find with error projection.');
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t7 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t8.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'targetField, foreignKey, or joinTable is a required field';
  function BadCustomer() {}
  var badCustomerMapping = new mynode.TableMapping('customer');
  badCustomerMapping.mapField('id');
  badCustomerMapping.mapManyToMany( {
    fieldName:   'discounts',
    target:      lib.Discount
  } );

  badCustomerMapping.applyToClass(BadCustomer);

  var badCustomerProjection = new mynode.Projection(BadCustomer);

  fail_openSession(testCase, function(s) {
    session = s;
    if (badCustomerMapping.error.indexOf(expectedErrorMessage) === -1) {
      testCase.appendErrorMessage('t8 Expected error message ' + expectedErrorMessage +
          ' was not reported in badCustomerMapping.error:' + badCustomerMapping.error);
    }
    session.find(badCustomerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t8 Unexpected success of find with error projection.');
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t8 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t9.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'field discount is not mapped';
  var badDiscountProjection = new mynode.Projection(lib.Discount);
  var badCustomerProjection = new mynode.Projection(lib.Customer);
  badCustomerProjection.addRelationship('discount', badDiscountProjection);

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(badCustomerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t9 Unexpected success of find with error projection.' + util.inspect(actualCustomer));
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t9 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t10.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'neither side defined the join table';
  function BadCustomer() {}
  function BadDiscount() {}
  var badCustomerMapping = new mynode.TableMapping('customer');
  badCustomerMapping.mapField('id');
  badCustomerMapping.mapManyToMany( {
    fieldName:   'discounts',
    targetField: 'customers',
    target:      BadDiscount
  } );
  var badDiscountMapping = new mynode.TableMapping('discount');
  badDiscountMapping.mapField('id');
  badDiscountMapping.mapManyToMany( {
    fieldName:   'customers',
    targetField: 'discounts',
    target:      BadCustomer
  } );

  badCustomerMapping.applyToClass(BadCustomer);
  badDiscountMapping.applyToClass(BadDiscount);
  var badDiscountProjection = new mynode.Projection(BadDiscount);
  var badCustomerProjection = new mynode.Projection(BadCustomer);
  badCustomerProjection.addRelationship('discounts', badDiscountProjection);

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(badCustomerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t10 Unexpected success of find with error projection.' + util.inspect(actualCustomer));
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t10 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t11.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'neither side defined the foreign key';
  function BadCustomer() {}
  function BadShoppingCart() {}
  var badCustomerMapping = new mynode.TableMapping('customer');
  badCustomerMapping.mapField('id');
  badCustomerMapping.mapOneToOne( {
    fieldName:   'shoppingCart',
    targetField: 'customer',
    target:      BadShoppingCart
  } );
  var badShoppingCartMapping = new mynode.TableMapping('shoppingcart');
  badShoppingCartMapping.mapField('id');
  badShoppingCartMapping.mapManyToMany( {
    fieldName:   'customer',
    targetField: 'shoppingCart',
    target:      BadCustomer
  } );

  badCustomerMapping.applyToClass(BadCustomer);
  badShoppingCartMapping.applyToClass(BadShoppingCart);
  var badShoppingCartProjection = new mynode.Projection(BadShoppingCart);
  var badCustomerProjection = new mynode.Projection(BadCustomer);
  badCustomerProjection.addRelationship('shoppingCart', badShoppingCartProjection);

  fail_openSession(testCase, function(s) {
    session = s;
    session.find(badCustomerProjection, '100').
    then(function(actualCustomer) {
      testCase.fail('t11 Unexpected success of find with error projection.' + util.inspect(actualCustomer));
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t11 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

t12.run = function() {
  var testCase = this;
  var session;
  var expectedErrorMessage = 'in use by a different projection';

  var badShoppingCartProjection = new mynode.Projection(lib.ShoppingCart);
  var badCustomerProjection1 = new mynode.Projection(lib.Customer);
  var badCustomerProjection2 = new mynode.Projection(lib.Customer);
  badCustomerProjection1.addRelationship('shoppingCart', badShoppingCartProjection);
  badCustomerProjection2.addRelationship('shoppingCart', badShoppingCartProjection);

  fail_openSession(testCase, function(s) {
    session = s;
    return session.find(badCustomerProjection1, '100').
    then(function(actualCustomer) {
      // should succeed, but not the second projection that uses the same shopping cart projection
      return session.find(badCustomerProjection2, '101');
    }).
    then(function(actualCustomer) {
      testCase.fail('t12 Unexpected success of find with error projection.' + util.inspect(actualCustomer));
    }, function(err) {
      if (err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t12 Wrong error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
};

function illegalOperation(testCase, domainObject, expectedErrorMessage, whereFunction) {
	var session;
	fail_openSession(testCase, function(s) {
		session = s;
		session.createQuery(domainObject).
    then(function(q) {
      // illegal operation eq for relationship shoppingCart
      q.where(whereFunction(q));
    }).
    then(function() {
      testCase.fail('Unexpected success of bad operation on relationship; expected error containing  ' + expectedErrorMessage);
    },
	  function(err) {
      if(err.message.indexOf(expectedErrorMessage) === -1) {
        testCase.fail('t13 Unexpected error message; does not include ' + expectedErrorMessage + ' in ' + err.message);
      } else {
        testCase.pass();
      }
    });
  });
}

t13.run = function() {
	illegalOperation(this, lib.simpleCustomerProjection, 'illegal operation eq', function(qdt) {
		return qdt.where(qdt.shoppingCart.eq(qdt.param('p1')));
	});
};

t14.run = function() {
	illegalOperation(this, lib.simpleCustomerProjection, 'illegal operation ne', function(qdt) {
		return qdt.where(qdt.shoppingCart.ne(qdt.param('p1')));
	});
};

t15.run = function() {
	illegalOperation(this, lib.simpleCustomerProjection, 'illegal operation lt', function(qdt) {
		return qdt.where(qdt.shoppingCart.lt(qdt.param('p1')));
	});
};

t16.run = function() {
	illegalOperation(this, lib.simpleCustomerProjection, 'illegal operation le', function(qdt) {
		return qdt.where(qdt.shoppingCart.le(qdt.param('p1')));
	});
};

t17.run = function() {
	illegalOperation(this, lib.simpleCustomerProjection, 'illegal operation gt', function(qdt) {
		return qdt.where(qdt.shoppingCart.gt(qdt.param('p1')));
	});
};

t18.run = function() {
	illegalOperation(this, lib.simpleCustomerProjection, 'illegal operation ge', function(qdt) {
		return qdt.where(qdt.shoppingCart.ge(qdt.param('p1')));
	});
};

t19.run = function() {
	illegalOperation(this, lib.simpleCustomerProjection, 'illegal operation between', function(qdt) {
		return qdt.where(qdt.shoppingCart.between(qdt.param('p1'),qdt.param('p2')));
	});
};


exports.tests = [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19];
