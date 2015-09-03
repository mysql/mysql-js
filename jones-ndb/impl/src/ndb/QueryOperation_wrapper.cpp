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

#include "ndb_util/NdbQueryOperation.hpp"

#include "TransactionImpl.h"
#include "QueryOperation.h"

#include "node_buffer.h"

#include "JsWrapper.h"
#include "js_wrapper_macros.h"
#include "NativeMethodCall.h"
#include "NdbWrapperErrors.h"

using namespace v8;


Handle<String>    /* keys of NdbProjection */
  K_next,
  K_root,
  K_hasScan,
  K_keyFields,
  K_joinTo,
  K_depth,
  K_tableHandler,
  K_rowRecord,
  K_indexHandler,
  K_keyRecord,
  K_isPrimaryKey,
  K_relatedField,
  K_dbTable,
  K_dbIndex,
  K_level,
  K_data,
  K_tag;


V8WrapperFn queryPrepareAndExecute,
            querySetTransactionImpl,
            queryFetchAllResults,
            queryGetResult,
            queryClose;


class QueryOperationEnvelopeClass : public Envelope {
public:
  QueryOperationEnvelopeClass() : Envelope("QueryOperation") {
    addMethod("prepareAndExecute", queryPrepareAndExecute);
    addMethod("setTransactionImpl", querySetTransactionImpl);
    addMethod("fetchAllResults", queryFetchAllResults);
    addMethod("getResult", queryGetResult);
    addMethod("close", queryClose);
  }
};

QueryOperationEnvelopeClass QueryOperationEnvelope;

Handle<Value> QueryOperation_Wrapper(QueryOperation *queryOp) {
  if(queryOp) {
    Local<Object> jsobj = QueryOperationEnvelope.wrap(queryOp);
    QueryOperationEnvelope.freeFromGC(queryOp, jsobj);
    return jsobj;
  }
  return QueryOperationEnvelope.getNull();
}


void setRowBuffers(QueryOperation *queryOp, Handle<Object> spec) {
  Record * record = 0;
  int level = spec->Get(K_depth)->Int32Value();
  if(spec->Get(K_rowRecord)->IsObject()) {
    record = unwrapPointer<Record *>(spec->Get(K_rowRecord)->ToObject());
  }
  queryOp->createRowBuffer(level, record);

  if(spec->Get(K_relatedField)->IsNull()) {
    queryOp->levelIsJoinTable(level);
  }
}


const NdbQueryOperationDef * createTopLevelQuery(QueryOperation *queryOp,
                                                 Handle<Object> spec,
                                                 Handle<Object> keyBuffer) {
  DEBUG_ENTER();
  NdbQueryBuilder *builder = queryOp->getBuilder();

  /* Pull values out of the JavaScript object */
  Local<Value> v;
  const Record * keyRecord = 0;
  const NdbDictionary::Table * table = 0;
  const NdbDictionary::Index * index = 0;

  v = spec->Get(K_keyRecord);
  if(v->IsObject()) {
    keyRecord = unwrapPointer<const Record *>(v->ToObject());
  };
  v = spec->Get(K_tableHandler);
  if(v->IsObject()) {
    v = v->ToObject()->Get(K_dbTable);
    if(v->IsObject()) {
      table = unwrapPointer<const NdbDictionary::Table *>(v->ToObject());
    }
  }
  bool isPrimaryKey = spec->Get(K_isPrimaryKey)->BooleanValue();
  const char * key_buffer = node::Buffer::Data(keyBuffer);
  if(! isPrimaryKey) {
    v = spec->Get(K_indexHandler);
    if(v->IsObject()) {
      v = v->ToObject()->Get(K_dbIndex);
      if(v->IsObject()) {
        index = unwrapPointer<const NdbDictionary::Index *> (v->ToObject());
      }
    }
    assert(index);
  }

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

  return queryOp->defineOperation(index, table, key_parts);
}

const NdbQueryOperationDef * createNextLevel(QueryOperation *queryOp,
                                             Handle<Object> spec,
                                             const NdbQueryOperationDef * parent) {
  NdbQueryBuilder *builder = queryOp->getBuilder();

  /* Pull values out of the JavaScript object */
  Local<Value> v;
  const NdbDictionary::Table * table = 0;
  const NdbDictionary::Index * index = 0;
  int depth = spec->Get(K_depth)->Int32Value();
  DEBUG_PRINT("Creating QueryOperationDef at level %d",depth);

  v = spec->Get(K_tableHandler);
  if(v->IsObject()) {
    v = v->ToObject()->Get(K_dbTable);
    if(v->IsObject()) {
      table = unwrapPointer<const NdbDictionary::Table *>(v->ToObject());
    }
  }
  bool isPrimaryKey = spec->Get(K_isPrimaryKey)->BooleanValue();

  if(! isPrimaryKey) {
    v = spec->Get(K_indexHandler);
    if(v->IsObject()) {
      v = v->ToObject()->Get(K_dbIndex);
      if(v->IsObject()) {
        index = unwrapPointer<const NdbDictionary::Index *> (v->ToObject());
      }
    }
    assert(index);
  }

  v = spec->Get(K_joinTo);
  Local<Array> joinColumns = Array::Cast(*v);

  /* Build the key */
  int nKeyParts = joinColumns->Length();
  const NdbQueryOperand * key_parts[nKeyParts+1];

  for(int i = 0 ; i < nKeyParts ; i++) {
    String::Utf8Value column_name(joinColumns->Get(i));
    key_parts[i] = builder->linkedValue(parent, *column_name);
  }
  key_parts[nKeyParts] = 0;

  return queryOp->defineOperation(index, table, key_parts);
}


void createQueryOperation(const Arguments & args) {
  DEBUG_MARKER(UDEB_DEBUG);
  REQUIRE_ARGS_LENGTH(3);

  int size = args[2]->Int32Value();
  QueryOperation * queryOperation = new QueryOperation(size);
  const NdbQueryOperationDef * root, * current;

  Local<Value> v;
  Local<Object> spec = args[0]->ToObject();

  setRowBuffers(queryOperation, spec);
  current = root = createTopLevelQuery(queryOperation, spec,
                                       args[1]->ToObject());

  while(! (v = spec->Get(K_next))->IsNull()) {
    spec = v->ToObject();
    current = createNextLevel(queryOperation, spec, current);
    assert(current->getOpNo() == spec->Get(K_depth)->Uint32Value());
    setRowBuffers(queryOperation, spec);
  }
  queryOperation->prepare(root);
  args.GetReturnValue().Set(QueryOperation_Wrapper(queryOperation));
}

void querySetTransactionImpl(const Arguments &args) {
  REQUIRE_ARGS_LENGTH(1);

  typedef NativeVoidMethodCall_1_<QueryOperation, TransactionImpl *> MCALL;
  MCALL mcall(& QueryOperation::setTransactionImpl, args);
  mcall.run();
  
  args.GetReturnValue().SetUndefined();
}

// void prepareAndExecute() 
// ASYNC
void queryPrepareAndExecute(const Arguments &args) {
  EscapableHandleScope scope(args.GetIsolate());
  DEBUG_MARKER(UDEB_DEBUG);
  REQUIRE_ARGS_LENGTH(1);
  typedef NativeMethodCall_0_<int, QueryOperation> MCALL;
  MCALL * mcallptr = new MCALL(& QueryOperation::prepareAndExecute, args);
  mcallptr->errorHandler = getNdbErrorIfLessThanZero;
  mcallptr->runAsync();
  args.GetReturnValue().SetUndefined();
}

// fetchAllResults()
// ASYNC
void queryFetchAllResults(const Arguments &args) {
  EscapableHandleScope scope(args.GetIsolate());
  REQUIRE_ARGS_LENGTH(1);
  typedef NativeMethodCall_0_<int, QueryOperation> MCALL;
  MCALL * mcallptr = new MCALL(& QueryOperation::fetchAllResults, args);
  mcallptr->errorHandler = getNdbErrorIfLessThanZero;
  mcallptr->runAsync();
  args.GetReturnValue().SetUndefined();
}

void freeQueryResultAtGC(char *data, void *hint) {
  (void) hint;   // unused
  free(data);
}

void doNotFreeQueryResultAtGC(char *data, void *hint) {
  (void) hint;
  (void) data;
}

// getResult(id, objectWrapper):  IMMEDIATE
void queryGetResult(const Arguments & args) {
  REQUIRE_ARGS_LENGTH(2);
  v8::Isolate * isolate = args.GetIsolate();

  QueryOperation * op = unwrapPointer<QueryOperation *>(args.Holder());
  size_t id = args[0]->Uint32Value();
  Handle<Object> wrapper = args[1]->ToObject();

  QueryResultHeader * header = op->getResult(id);

  if(header) {
    if(header->data) {
      wrapper->Set(K_data, node::Buffer::New(header->data,
                                             op->getResultRowSize(header->depth),
                                             doNotFreeQueryResultAtGC, 0));
    } else {
      wrapper->Set(K_data, Null(isolate));
    }
    wrapper->Set(K_level, v8::Uint32::New(isolate, header->depth));
    wrapper->Set(K_tag,   v8::Uint32::New(isolate, header->tag));
    args.GetReturnValue().Set(true);
  } else {
    args.GetReturnValue().Set(false);
  }
}

// void close()
// ASYNC
void queryClose(const Arguments & args) {
  typedef NativeVoidMethodCall_0_<QueryOperation> NCALL;
  NCALL * ncallptr = new NCALL(& QueryOperation::close, args);
  ncallptr->runAsync();
  args.GetReturnValue().SetUndefined();
}

void QueryOperation_initOnLoad(Handle<Object> target) {
  Local<Object> ibObj = Object::New(Isolate::GetCurrent());
  Local<String> ibKey = NEW_SYMBOL("QueryOperation");
  target->Set(ibKey, ibObj);

  DEFINE_JS_FUNCTION(ibObj, "create", createQueryOperation);

  K_next          = NEW_SYMBOL("next");
  K_root          = NEW_SYMBOL("root");
  K_hasScan       = NEW_SYMBOL("hasScan");
  K_keyFields     = NEW_SYMBOL("keyFields");
  K_joinTo        = NEW_SYMBOL("joinTo");
  K_depth         = NEW_SYMBOL("depth");
  K_tableHandler  = NEW_SYMBOL("tableHandler");
  K_rowRecord     = NEW_SYMBOL("rowRecord"),
  K_indexHandler  = NEW_SYMBOL("indexHandler");
  K_keyRecord     = NEW_SYMBOL("keyRecord");
  K_isPrimaryKey  = NEW_SYMBOL("isPrimaryKey");
  K_relatedField  = NEW_SYMBOL("relatedField");

  K_dbTable       = NEW_SYMBOL("dbTable");
  K_dbIndex       = NEW_SYMBOL("dbIndex");

  K_level         = NEW_SYMBOL("level");
  K_data          = NEW_SYMBOL("data");
  K_tag           = NEW_SYMBOL("tag");
}

