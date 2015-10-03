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
#include "TransactionImpl.h"

QueryOperation::QueryOperation(int sz) :
  depth(sz),
  buffers(new QueryBuffer[sz]),
  operationTree(0),
  definedQuery(0),
  ndbQuery(0),
  transaction(0),
  results(0),
  nresults(0),
  nheaders(0),
  nextHeaderAllocationSize(1024)
{
  ndbQueryBuilder = NdbQueryBuilder::create();
  DEBUG_PRINT("Depth: %d", depth);
}

QueryOperation::~QueryOperation() {
  ndbQueryBuilder->destroy();
  delete[] buffers;
  free(results);
}

void QueryOperation::createRowBuffer(int level, Record *record) {
  buffers[level].record = record;
  buffers[level].buffer = new char[record->getBufferSize()];
  buffers[level].size   = record->getBufferSize();
}

void QueryOperation::levelIsJoinTable(int level) {
  DEBUG_PRINT("Level %d is join table", level);
  buffers[level].flags |= 2;
}

void QueryOperation::prepare(const NdbQueryOperationDef * root) {
  DEBUG_MARKER(UDEB_DEBUG);
  operationTree = root;
  definedQuery = ndbQueryBuilder->prepare();
}

int QueryOperation::prepareAndExecute() {
  return transaction->prepareAndExecuteQuery(this);
}

bool QueryOperation::pushResultForTable(int level) {
  char * & temp_result = buffers[level].buffer;
  size_t & size = buffers[level].size;
  int lastCopy = buffers[level].lastCopy;

  if(level == 0)
  {
    nullLevel = depth;  // reset for new root result
  }

  if(ndbQuery->getQueryOperation(level)->isRowNULL())
  {
    if(nullLevel < level)
    {
      return true;   /* skip */
    }
    nullLevel = level;
    return pushResultNull(level);
  }

  if(lastCopy > 0 && (! (memcmp(results[lastCopy-1].data, temp_result, size))))
  {
    return true;    /* skip */
  }
  else
  {
    return pushResultValue(level);
  }
}

bool QueryOperation::pushResultNull(int level) {
  DEBUG_ENTER();
  bool ok = true;
  size_t n = nresults;

  if(n == nheaders) {
    ok = growHeaderArray();
  }
  if(ok) {
    results[n].depth = level;
    results[n].tag = 1 | buffers[level].flags;
    results[n].data = 0;
    nresults++;
  }
  return ok;
}

bool QueryOperation::pushResultValue(int level) {
  DEBUG_ENTER();
  bool ok = true;
  size_t n = nresults;
  size_t & size = buffers[level].size;
  char * & temp_result = buffers[level].buffer;

  if(n == nheaders) {
    ok = growHeaderArray();
  }
  if(ok) {
    nresults++;

    /* Allocate space for the new result */
    results[n].data = (char *) malloc(size);
    if(! results[n].data) return false;

    /* Copy from the holding buffer to the new result */
    memcpy(results[n].data, temp_result, size);

    /* Set the level and tag in the header */
    results[n].depth = level;
    results[n].tag = buffers[level].flags;

    /* Record that this result has been copied out */
    buffers[level].lastCopy = nresults;
  }
  return ok;
}

QueryResultHeader * QueryOperation::getResult(size_t id) {
  return (id < nresults) ?  & results[id] : 0;
}

inline bool more(int status) {  /* 0 or 2 */
  return ((status == NdbQuery::NextResult_gotRow) ||
          (status == NdbQuery::NextResult_bufferEmpty));
}

inline bool isError(int status) { /* -1 */
  return (status == NdbQuery::NextResult_error);
}


/* Returns number of results, or an error code < 0
*/
int QueryOperation::fetchAllResults() {
  int status = NdbQuery::NextResult_bufferEmpty;

  while(more(status)) {
    status = ndbQuery->nextResult();
    switch(status) {
      case NdbQuery::NextResult_gotRow:
        /* New results at every level */
        DEBUG_PRINT_DETAIL("NextResult_gotRow");
        for(int level = 0 ; level < depth ; level++) {
          if(! pushResultForTable(level)) return -1;
        }
        break;

      case NdbQuery::NextResult_scanComplete:
        DEBUG_PRINT_DETAIL("NextResult_scanComplete");
        break;

      default:
        assert(status == NdbQuery::NextResult_error);
        latest_error = & ndbQuery->getNdbError();
        DEBUG_PRINT("%d %s", latest_error->code, latest_error->message);
        return -1;
    }
  }
  /* All done with the query now. */
  ndbQuery->close();
  ndbQuery = 0;

  return nresults;
}

bool QueryOperation::growHeaderArray() {
  DEBUG_PRINT("growHeaderArray %d => %d", nheaders, nextHeaderAllocationSize);
  QueryResultHeader * old_results = results;

  results = (QueryResultHeader *) calloc(nextHeaderAllocationSize, sizeof(QueryResultHeader));
  if(results) {
    memcpy(results, old_results, nheaders * sizeof(QueryResultHeader));
    free(old_results);
    nheaders = nextHeaderAllocationSize;
    nextHeaderAllocationSize *= 2;
    return true;
  }
  return false; // allocation failed
}

const NdbQueryOperationDef *
  QueryOperation::defineOperation(const NdbDictionary::Index * index,
                                  const NdbDictionary::Table * table,
                                  const NdbQueryOperand* const keys[]) {
  const NdbQueryOperationDef * rval = 0;
  NdbQueryIndexBound * bound;

  if(index) {
    switch(index->getType()) {
      case NdbDictionary::Index::UniqueHashIndex:
        rval = ndbQueryBuilder->readTuple(index, table, keys);
        DEBUG_PRINT("defineOperation using UniqueHashIndex %s", index->getName());
        break;

      case NdbDictionary::Index::OrderedIndex:
        bound = new NdbQueryIndexBound(keys);
        rval = ndbQueryBuilder->scanIndex(index, table, bound);
        DEBUG_PRINT("defineOperation using OrderedIndex %s", index->getName());
        break;
      default:
        DEBUG_PRINT("defineOperation ERROR: default case");
        return 0;
    }
  }
  else {
    rval = ndbQueryBuilder->readTuple(table, keys);
    DEBUG_PRINT("defineOperation using PrimaryKey");
  }

  if(rval == 0) {
    const NdbError & err = ndbQueryBuilder->getNdbError();
    DEBUG_PRINT("defineOperation: Error %d %s", err.code, err.message);
  }
  return rval;
}

bool QueryOperation::createNdbQuery(NdbTransaction *tx) {
  DEBUG_MARKER(UDEB_DEBUG);
  ndbQuery = tx->createQuery(definedQuery);
  if(! ndbQuery) {
    DEBUG_PRINT("createQuery returned null");
    return false;
  }

  for(int i = 0 ; i < depth ; i++) {
    NdbQueryOperation * qop = ndbQuery->getQueryOperation(i);
    if(! qop) {
      DEBUG_PRINT("No Query Operation at index %d", i);
      return -1;
    }
    assert(buffers[i].record);
    qop->setResultRowBuf(buffers[i].record->getNdbRecord(), buffers[i].buffer);
  }
  return true;
}

void QueryOperation::setTransactionImpl(TransactionImpl *tx) {
  transaction = tx;
}

void QueryOperation::close() {
  DEBUG_ENTER();
  definedQuery->destroy();
}

const NdbError & QueryOperation::getNdbError() {
  return ndbQueryBuilder->getNdbError();
}
