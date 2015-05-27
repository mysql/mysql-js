/*
 Copyright (c) 2014, Oracle and/or its affiliates. All rights
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

#include "adapter_global.h"
#include "js_wrapper_macros.h"
#include "TransactionImpl.h"
#include "QueryOperation.h"
#include "SessionImpl.h"
#include "NativeCFunctionCall.h"
#include "NativeMethodCall.h"
#include "NdbWrappers.h"

using namespace v8;

Handle<Value> newSessionImpl(const Arguments &);
Handle<Value> seizeTransaction(const Arguments &);
Handle<Value> releaseTransaction(const Arguments &);
Handle<Value> freeTransactions(const Arguments &);
Handle<Value> SessionImplDestructor(const Arguments &);

class SessionImplEnvelopeClass : public Envelope {
public:
  SessionImplEnvelopeClass() : Envelope("SessionImpl") {
    DEFINE_JS_FUNCTION(Envelope::stencil, "seizeTransaction", seizeTransaction);
    DEFINE_JS_FUNCTION(Envelope::stencil, "releaseTransaction", releaseTransaction);
    DEFINE_JS_FUNCTION(Envelope::stencil, "freeTransactions", freeTransactions);
    DEFINE_JS_FUNCTION(Envelope::stencil, "destroy", SessionImplDestructor);
  }
};

SessionImplEnvelopeClass SessionImplEnvelope;

Handle<Value> SessionImpl_Wrapper(SessionImpl *dbsi) {
  HandleScope scope;

  if(dbsi) {
    Local<Object> jsobj = SessionImplEnvelope.newWrapper();
    wrapPointerInObject(dbsi, SessionImplEnvelope, jsobj);
    freeFromGC(dbsi, jsobj);
    return scope.Close(jsobj);
  }
  return Null();
}

SessionImpl * asyncNewSessionImpl(Ndb_cluster_connection *conn,
                                      AsyncNdbContext *ctx,
                                      const char *db, int maxTx) {
  return new SessionImpl(conn, ctx, db, maxTx);
}


Handle<Value> newSessionImpl(const Arguments & args) {
  DEBUG_MARKER(UDEB_DETAIL);
  HandleScope scope;
  
  PROHIBIT_CONSTRUCTOR_CALL();
  REQUIRE_ARGS_LENGTH(5);

  typedef NativeCFunctionCall_4_<SessionImpl *, Ndb_cluster_connection *,
                                 AsyncNdbContext *, const char *, int> MCALL;
  MCALL * mcallptr = new MCALL(& asyncNewSessionImpl, args);
  mcallptr->wrapReturnValueAs(& SessionImplEnvelope);
  mcallptr->runAsync();
  return Undefined();
}

/* The seizeTransaction() wrapper is unusual because a 
   TransactionImpl holds a reference to its own JS wrapper
*/   
Handle<Value> seizeTransaction(const Arguments & args) {
  SessionImpl * session = unwrapPointer<SessionImpl *>(args.Holder());
  TransactionImpl * ctx = session->seizeTransaction();
  if(ctx) return ctx->getJsWrapper();
  return Null();
}

Handle<Value> releaseTransaction(const Arguments & args) {
  HandleScope scope;
  typedef NativeMethodCall_1_<bool, SessionImpl, TransactionImpl *> MCALL;
  MCALL mcall(& SessionImpl::releaseTransaction, args);
  mcall.run();
  return scope.Close(mcall.jsReturnVal());
}

Handle<Value> freeTransactions(const Arguments & args) {
  HandleScope scope;
  SessionImpl * session = unwrapPointer<SessionImpl *>(args.Holder());
  session->freeTransactions();
  return Undefined();
}

Handle<Value> SessionImplDestructor(const Arguments &args) {
  DEBUG_MARKER(UDEB_DETAIL);
  typedef NativeDestructorCall<SessionImpl> DCALL;
  DCALL * dcall = new DCALL(args);
  dcall->runAsync();
  return Undefined();
}

void SessionImpl_initOnLoad(Handle<Object> target) {
  HandleScope scope;

  Persistent<String> jsKey = Persistent<String>(String::NewSymbol("DBSession"));
  Persistent<Object> jsObj = Persistent<Object>(Object::New());

  target->Set(jsKey, jsObj);

  DEFINE_JS_FUNCTION(jsObj, "create", newSessionImpl);
}


