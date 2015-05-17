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


var jones = require("database-jones");
var udebug = unified_debug.getLogger("ScanWithBlobTest.js");

var t1 = new harness.ConcurrentTest("ScanWithBlob");

t1.run = function() {
  fail_openSession(t1, function(session) {
    session.createQuery("int_after_blob", function(err, query) {
      t1.errorIfError(err);
      query.where(query.id.isNotNull());
      query.execute({}, function(err, resultArray) {
        t1.errorIfNotEqual("Expected length 9", resultArray.length, 9);
        resultArray.forEach(function(result) {
          udebug.log(result.id, result.text_col, result.int_col);
          t1.errorIfNotEqual("Expected id == int_col", result.id, result.int_col);
          if(result.id == 5) {
            t1.errorIfNotNull("Expected null text for 5", result.text_col);
          } else {
            t1.errorIfNull("Expected non-null text", result.text_col);
          }
        });
        t1.failOnError();
      });
    });
  });
};


exports.tests = [ t1 ];
