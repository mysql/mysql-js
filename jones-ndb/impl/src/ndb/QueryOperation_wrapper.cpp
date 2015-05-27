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

#include "JsWrapper.h"
#include "js_wrapper_macros.h"
#include "QueryOperation.h"
#include "ndb_util/NdbQueryOperation.hpp"
#include "node_buffer.h"

using namespace v8;


Handle<String>    /* keys of NdbProjection */
  K_next,
  K_parent,
  K_keyFields,
  K_joinTo,
  K_depth,
  K_opNumber,
  K_ndbQueryDef,
  K_tableHandler,
  K_rowRecord,
  K_rowBuffer,
  K_indexHandler,
  K_keyRecord,
  K_isPrimaryKey,
  K_dbTable,
  K_dbIndex;


class QueryOperationEnvelopeClass : public Envelope {
public:
  QueryOperationEnvelopeClass() : Envelope("QueryOperation") {
  }
};

QueryOperationEnvelopeClass QueryOperationEnvelope;

Handle<Value> QueryOperation_Wrapper(QueryOperation *queryOp) {
  HandleScope scope;

  if(queryOp) {
    Local<Object> jsobj = QueryOperationEnvelope.newWrapper();
    wrapPointerInObject(queryOp, QueryOperationEnvelope, jsobj);
    freeFromGC(queryOp, jsobj);
    return scope.Close(jsobj);
  }
  return Null();
}

const NdbQueryOperationDef * createTopLevelQuery(NdbQueryBuilder *builder,
                                                 Handle<Object> spec,
                                                 Handle<Object> keyBuffer) {
  const NdbQueryOperationDef * thisOp;

  /* Pull values out of the JavaScript object */
  const Record * keyRecord = unwrapPointer<const Record *>
    (spec->Get(K_keyRecord)->ToObject());
  const NdbDictionary::Table * table = unwrapPointer<const NdbDictionary::Table *>
    (spec->Get(K_tableHandler)->ToObject()->Get(K_dbTable)->ToObject());
  bool isPrimaryKey = spec->Get(K_isPrimaryKey)->BooleanValue();
  const char * key_buffer = node::Buffer::Data(keyBuffer);

  /* Build the key */
  int nKeyParts = keyRecord->getNoOfColumns();
  const NdbQueryOperand * key_parts[nKeyParts+1];

  for(int i = 0; i < nKeyParts ; i++) {
    size_t offset = keyRecord->getColumnOffset(i);
    size_t length = keyRecord->getValueLength(i, key_buffer + offset);
    offset += keyRecord->getValueOffset(i);  // accounts for length bytes
    key_parts[i] = builder->constValue(key_buffer + offset, length);
  }
  key_parts[nKeyParts] = 0;

  /* Build the operation */
  if(isPrimaryKey) {
    thisOp = builder->readTuple(table, key_parts);
  } else {
    const NdbDictionary::Index * index =
      unwrapPointer<const NdbDictionary::Index *>
        (spec->Get(K_indexHandler)->ToObject()->Get(K_dbIndex)->ToObject());
    thisOp = builder->readTuple(index, table, key_parts);
  }

  return thisOp;
}

const NdbQueryOperationDef * createNextLevel(Handle<Value> spec,
                                             const NdbQueryOperationDef * parent) {
  const NdbQueryOperationDef * thisOp = 0;


  return thisOp;
}


Handle<Value> createQueryOperation(NdbQueryBuilder *builder,
                                   const Arguments & args) {
  Local<Object> spec = args[0]->ToObject();
  const NdbQueryOperationDef * root, * current;

  current = root = createTopLevelQuery(builder,
                                       args[0]->ToObject(),
                                       args[1]->ToObject());

  while(! (spec = spec->Get(K_next)->ToObject())->IsNull()) {
    current = createNextLevel(spec, current);
  }

  return QueryOperation_Wrapper(new QueryOperation(root));
}


#define JSSTRING(a) Persistent<String>::New(String::NewSymbol(a))

void QueryOperation_initOnLoad(Handle<Object> target) {
  HandleScope scope;
  K_next          = JSSTRING("next");
  K_parent        = JSSTRING("parent");
  K_keyFields     = JSSTRING("keyFields");
  K_joinTo        = JSSTRING("joinTo");
  K_depth         = JSSTRING("depth");
  K_opNumber      = JSSTRING("opNumber");
  K_ndbQueryDef   = JSSTRING("ndbQueryDef");
  K_tableHandler  = JSSTRING("tableHandler");
  K_rowRecord     = JSSTRING("rowRecord"),
  K_rowBuffer     = JSSTRING("rowBuffer"),
  K_indexHandler  = JSSTRING("indexHandler");
  K_keyRecord     = JSSTRING("keyRecord");
  K_isPrimaryKey  = JSSTRING("isPrimaryKey");

  K_dbTable       = JSSTRING("dbTable");
  K_dbIndex       = JSSTRING("dbIndex");
}

