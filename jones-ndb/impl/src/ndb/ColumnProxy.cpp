/*
 Copyright (c) 2013, Oracle and/or its affiliates. All rights
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

#include "adapter_global.h"
#include "unified_debug.h"
#include "ColumnProxy.h"
#include "JsWrapper.h"

using namespace v8;

// TODO: Assure that caller has a HandleScope
Handle<Value> ColumnProxy::get(v8::Isolate *isolate, char *buffer) {
  Handle<Value> val = ToLocal(& jsValue);

  if(! isLoaded) {
    val = handler->read(buffer, ToLocal(& blobBuffer));
    jsValue.Reset(isolate, val);
    isLoaded = true;
  }
  return val;
}

void ColumnProxy::set(v8::Isolate *isolate, Handle<Value> newValue) {
  isNull = (newValue->IsNull());
  isLoaded = isDirty = true;
  blobBuffer.Reset();
  jsValue.Reset(isolate, newValue);
  DEBUG_PRINT("set %s", handler->column->getName());
}

Handle<Value> ColumnProxy::write(v8::Isolate *isolate, char *buffer) {
  Handle<Value> rval = Undefined(isolate);

  /* Write dirty, non-blob values */
  if(isDirty && blobBuffer.IsEmpty()) {
    rval = handler->write(ToLocal(& jsValue), buffer);
    DEBUG_PRINT("write %s", handler->column->getName());
    isDirty = false;
  }
  return rval;
}

BlobWriteHandler * ColumnProxy::createBlobWriteHandle(int i) {
  BlobWriteHandler * b = 0;
  if(isDirty && ! isNull) {
    DEBUG_PRINT("createBlobWriteHandle %s", handler->column->getName());
    b = handler->createBlobWriteHandle(ToLocal(& blobBuffer), i);
  }
  isDirty = false;
  return b;
}

void ColumnProxy::setBlobBuffer(v8::Isolate *isolate, Handle<Object> buffer) {
  DEBUG_ENTER();
  blobBuffer.Reset(isolate, buffer);
}
