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

#ifndef NODEJS_ADAPTER_NDB_INCLUDE_QUERYOPERATION_H
#define NODEJS_ADAPTER_NDB_INCLUDE_QUERYOPERATION_H


#include "KeyOperation.h"

class NdbQueryBuilder;
class NdbQueryOperationDef;
class NdbQueryDef;
class TransactionImpl;
class NdbQueryOperand;

class QueryOperation : public KeyOperation {
public:
  QueryOperation(TransactionImpl *);
  ~QueryOperation();
  int prepareAndExecute();
  void createNdbQuery(NdbTransaction *);
  void prepare(const NdbQueryOperationDef * root);
  NdbQueryBuilder * getBuilder() { return ndbQueryBuilder; }
  const NdbQueryOperationDef * defineOperation(const NdbDictionary::Index * index,
                                               const NdbDictionary::Table * table,
                                               const NdbQueryOperand* const keys[]);
  const NdbError & getNdbError();

private:
  NdbQueryBuilder             * ndbQueryBuilder;
  const NdbQueryOperationDef  * operationTree;
  const NdbQueryDef           * definedQuery;
  TransactionImpl             * transaction;
};

#endif
