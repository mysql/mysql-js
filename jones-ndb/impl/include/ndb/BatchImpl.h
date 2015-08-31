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

#ifndef nodejs_adapter_BatchImpl_h
#define nodejs_adapter_BatchImpl_h

#include "KeyOperation.h"
#include "TransactionImpl.h"
#include "BlobHandler.h"

class BatchImpl {
friend class TransactionImpl;
public:
  BatchImpl(TransactionImpl *, int size);
  ~BatchImpl();
  void setError(int n, const NdbError &);
  const NdbError * getError(int n);
  KeyOperation * getKeyOperation(int n);
  bool tryImmediateStartTransaction();
  int execute(int execType, int abortOption, int forceSend);
  int executeAsynch(int execType, int abortOption, int forceSend,
                    v8::Handle<v8::Function> execCompleteCallback);
  void prepare(NdbTransaction *);
  const NdbError & getNdbError();
  void registerClosedTransaction();
  BlobHandler * getBlobHandler(int);
  bool hasBlobReadOperations();

private:
  KeyOperation * keyOperations;
  const NdbOperation ** const ops;
  const NdbError ** const errors;
  int size;
  bool doesReadBlobs;
  TransactionImpl *transactionImpl;
};

inline void BatchImpl::setError(int n, const NdbError & err) {
  errors[n] = & err;
  ops[n] = NULL;
}

inline const NdbError * BatchImpl::getError(int n) {
  if(size > n) {
    return (ops[n] ? & ops[n]->getNdbError() : errors[n]);
  }
  return 0;
}

inline KeyOperation * BatchImpl::getKeyOperation(int n) {
  return & keyOperations[n];
}

inline int BatchImpl::execute(int execType, int abortOption, int forceSend) {
  return transactionImpl->execute(this, execType, abortOption, forceSend);
}

inline int BatchImpl::executeAsynch(int execType, int abortOption, int forceSend,
                                   v8::Handle<v8::Function> callback) {
  return transactionImpl->executeAsynch(this, execType, abortOption, forceSend, callback);
}

inline const NdbError & BatchImpl::getNdbError() {
  return transactionImpl->getNdbError();
}

inline void BatchImpl::registerClosedTransaction() {
  transactionImpl->registerClose();
}

inline BlobHandler * BatchImpl::getBlobHandler(int n) {
  return keyOperations[n].blobHandler;
}

inline bool BatchImpl::hasBlobReadOperations() {
  return doesReadBlobs;
}

#endif
