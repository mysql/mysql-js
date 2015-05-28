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
  const NdbQueryOperationDef * rval;
  NdbQueryIndexBound * bound;
  DEBUG_MARKER(UDEB_DEBUG);

  if(index) {
    switch(index->getType()) {
      case NdbDictionary::Index::UniqueHashIndex:
        rval = ndbQueryBuilder->readTuple(index, table, keys);
        DEBUG_PRINT("Using UniqueHashIndex");
        break;

      case NdbDictionary::Index::OrderedIndex:
        bound = new NdbQueryIndexBound(keys);
        rval = ndbQueryBuilder->scanIndex(index, table, bound);
        DEBUG_PRINT("Using OrderedIndex");
        break;
      default:
        DEBUG_PRINT("ERROR: default case");
        rval = 0;
        break;
    }
  }
  else {
    rval = ndbQueryBuilder->readTuple(table, keys);
    DEBUG_PRINT("Using PrimaryKey");
  }

  if(rval == 0) {
    const NdbError & err = ndbQueryBuilder->getNdbError();
    DEBUG_PRINT("Error %d %s", err.code, err.message);
  }
  return rval;
}
