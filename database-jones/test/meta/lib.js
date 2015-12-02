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

'use strict';

var jones  = require('database-jones'),
    util   = require("util"),
    udebug = unified_debug.getLogger("meta/lib.js");

var metaLib = {};

/** Create a map from an array of the same size. Each element of inArray
 * is used to create an element of a map using inArray[i].selector as a key
 * and inArray[i] as the value.
 * @param inArray
 * @param selector
 */
var createMap = function createMap(inArray, selector, secondary) {
  var result = {}, i, element, fieldName;
  for (i = 0; i < inArray.length; ++i) {
    element = inArray[i];
    fieldName = element[selector];
    if (secondary !== undefined && element[secondary] !== undefined) {
      fieldName += '_' + secondary + '_' + element[secondary].toString();
    }
    result[fieldName] = element;
  }
  return result;
};

/** For indexes, we do not rely on the index name, but construct a key 
 *  that describes the column names of the index.
 */
function createIndexMap(indexes,columns) {
  var result = { "ordered" : {}, "unique" : {} };
  indexes.forEach(function(index) {
    var indexKey = "";
    index.columnNumbers.forEach(function(colNo, posInIdx) {
      if(posInIdx > 0) {
        indexKey += ".";
      }
      indexKey += columns[colNo].name;
    });
    if(index.isOrdered) {
      result.ordered[indexKey] = 1;
    }
    if(index.isUnique) {
      result.unique[indexKey] = 1;
    }
    if(index.isPrimaryKey) {
      result.pk = indexKey;
    }
  });
  return result;
}


metaLib.verifyMetadata = function verifyMetadata(testCase, expected, result) {
  var expectedFieldName, expectedMap, expectedKey, expectedValue, expectedElement, expectedElementName, resultValue, i, k;
  udebug.log('GetMetadataTest result: ', util.inspect(result));
  // convert result columns into hashmap
  result.columnMap = createMap(result.columns, 'name');
  result.indexMap = createIndexMap(result.indexes, result.columns);
  result.foreignKeyMap = createMap(result.foreignKeys, 'name');
  // iterate the expected and make sure result matches
  for (expectedFieldName in expected) {
    if (expected.hasOwnProperty(expectedFieldName)) {
      expectedValue = expected[expectedFieldName];
      switch (typeof expectedValue) {
      case 'string':
        testCase.errorIfNotEqual('Metadata mismatch ' + expectedFieldName, expectedValue, result[expectedFieldName]);
        break;
      case 'number':
        testCase.errorIfNotEqual('Metadata mismatch ' + expectedFieldName, expectedValue, result[expectedFieldName]);
        break;
      case 'object':
        if (Array.isArray(expectedValue)) {
          // object is an array with required order of elements
          for (i = 0; i < expectedValue.length; ++i) {
            for (k in expectedValue[i]) {
              if (expectedValue[i].hasOwnProperty(k)) {
                testCase.errorIfNotEqual('Metadata mismatch ' + expectedValue[i][k],
                    expectedValue[i][k], result[expectedFieldName][i][k]);              
              }
            }
          }
        } else {
          expectedMap = expectedValue;
          // object is a map with keys and values
          for (expectedKey in expectedMap) {
            if (expectedMap.hasOwnProperty(expectedKey)) {
              expectedElement = expectedMap[expectedKey];
              for (expectedElementName in expectedElement) {
                if (expectedElement.hasOwnProperty(expectedElementName)) {
                  resultValue = result[expectedFieldName] && result[expectedFieldName][expectedKey] &&
                      result[expectedFieldName][expectedKey][expectedElementName];
                  udebug.log('meta/lib.js result', expectedFieldName, '[', expectedKey, '].', expectedElementName,
                      ':', resultValue);
                  testCase.errorIfNotEqual('Metadata mismatch ' + expectedFieldName + '[' +
                      expectedKey + '].' + expectedElementName,
                      expectedMap[expectedKey][expectedElementName], resultValue);              
                }
              }
            }
          }
        }
        break;
      default:
        throw new Error('Expected value must be a string, number, array, or map.');
      }
    }
  }
};

module.exports = metaLib;