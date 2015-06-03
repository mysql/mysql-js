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

class QueryBuffer {
public:
  Record      * record;
  char        * buffer;
  size_t        size;
  size_t        lastCopy;
  uint16_t      flags;
  QueryBuffer() : record(0), buffer(0), size(0) , lastCopy(0), flags(0) {};
  ~QueryBuffer()                       { if(size) delete[] buffer; };
};

class QueryResultHeader {
public:
  char        * data;
  uint16_t      depth;
  uint16_t      tag;
};

class QueryOperation {
public:
  QueryOperation(int);
  ~QueryOperation();
  void createRowBuffer(int level, Record *);
  void levelIsJoinTable(int level);
  int prepareAndExecute();
  void setTransactionImpl(TransactionImpl *);
  bool createNdbQuery(NdbTransaction *);
  void prepare(const NdbQueryOperationDef * root);
  int fetchAllResults();
  NdbQueryBuilder * getBuilder() { return ndbQueryBuilder; }
  const NdbQueryOperationDef * defineOperation(const NdbDictionary::Index * index,
                                               const NdbDictionary::Table * table,
                                               const NdbQueryOperand* const keys[]);
  QueryResultHeader * getResult(size_t);
  size_t getResultRowSize(int depth);
  void close();
  const NdbError & getNdbError();

protected:
  bool growHeaderArray();
  bool pushResultValue(int);
  bool pushResultNull(int);
  bool pushResultForTable(int);

private:
  int                           depth;
  int                           nullLevel;
  QueryBuffer * const           buffers;
  NdbQueryBuilder             * ndbQueryBuilder;
  const NdbQueryOperationDef  * operationTree;
  const NdbQueryDef           * definedQuery;
  NdbQuery                    * ndbQuery;
  TransactionImpl             * transaction;
  QueryResultHeader           * results;
  const NdbError              * latest_error;
  size_t                        nresults, nheaders;
  size_t                        nextHeaderAllocationSize;
};

inline size_t QueryOperation::getResultRowSize(int depth) {
  return buffers[depth].size;
};

#endif
