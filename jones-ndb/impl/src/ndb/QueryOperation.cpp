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

#include <NdbApi.hpp>
#include "ndb_util/NdbQueryOperation.hpp"

#include <node.h>

#include "adapter_global.h"
#include "unified_debug.h"

#include "QueryOperation.h"

QueryOperation::QueryOperation() {
  DEBUG_MARKER(UDEB_DEBUG);
  ndbQueryBuilder = NdbQueryBuilder::create();
}

QueryOperation::~QueryOperation() {
  ndbQueryBuilder->destroy();
}

void QueryOperation::prepare(const NdbQueryOperationDef * root) {
  DEBUG_MARKER(UDEB_DEBUG);
  operationTree = root;
  definedQuery = ndbQueryBuilder->prepare();
}


const NdbQueryOperationDef *
  QueryOperation::defineOperation(const NdbDictionary::Index * index,
                                  const NdbDictionary::Table * table,
                                  const NdbQueryOperand* const keys[]) {
  DEBUG_PRINT("index: %p", index);
  if(! index) {
    return ndbQueryBuilder->readTuple(table, keys);
  }
  switch(index->getType()) {
    case NdbDictionary::Index::UniqueHashIndex:
      return ndbQueryBuilder->readTuple(index, table, keys);

    case NdbDictionary::Index::OrderedIndex:
      return ndbQueryBuilder->scanIndex(index, table,
                                        new NdbQueryIndexBound(keys));

    default:
      return 0;
  }
}
