/*
 Copyright (c) 2013, 2015, Oracle and/or its affiliates. All rights
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
#include "ColumnHandler.h"
#include "BlobHandler.h"
#include "JsWrapper.h"
#include "js_wrapper_macros.h"

using namespace v8;

class Keys {
public:
  Eternal<String> toDB;
  Eternal<String> fromDB;
  Keys() {
    HandleScope scope(Isolate::GetCurrent());
    toDB.Set(Isolate::GetCurrent(), NEW_SYMBOL("toDB"));
    fromDB.Set(Isolate::GetCurrent(), NEW_SYMBOL("fromDB"));
  }
};

Keys keys;

ColumnHandler::ColumnHandler() :
  column(0), offset(0), 
  converterClass(), converterReader(), converterWriter(),
  hasConverterReader(false), hasConverterWriter(false),
  isLob(false), isText(false)
{
}


ColumnHandler::~ColumnHandler() {
  // Persistent handles will be disposed by calling of their destructors
}

void ColumnHandler::init(v8::Isolate * isolate,
                         const NdbDictionary::Column *_column,
                         size_t _offset,
                         Handle<Value> typeConverter) {
  EscapableHandleScope scope(isolate);
  column = _column;
  encoder = getEncoderForColumn(column);
  offset = _offset;
  Local<Object> t;
  Local<Object> converter;

  switch(column->getType()) {
    case NDB_TYPE_TEXT: 
      isText = true;   // fall through to also set isLob
    case NDB_TYPE_BLOB:
      isLob = true;
      break;
    default:
      break;
  }

  if(typeConverter->IsObject()) {
    converter = typeConverter->ToObject();
    converterClass.Reset(isolate, converter);

    if(converter->Has(keys.toDB.Get(isolate))) {
      t = converter->Get(keys.toDB.Get(isolate))->ToObject();
      if(t->IsFunction()) {
        converterWriter.Reset(isolate, t);
        hasConverterWriter = true;
      }
    }

    if(converter->Has(keys.fromDB.Get(isolate))) {
      t = converter->Get(keys.fromDB.Get(isolate))->ToObject();
      if(t->IsFunction()) {
        converterReader.Reset(isolate, t);
        hasConverterReader = true;
      }
    }
  }
}


Handle<Value> ColumnHandler::read(char * rowBuffer, Handle<Object> blobBuffer) const {
  Handle<Value> val;  // HandleScope is in ValueObject.cpp nroGetter

  if(isText) {
    DEBUG_PRINT("text read");
    val = getTextFromBuffer(column, blobBuffer);
  } else if(isLob) {
    DEBUG_PRINT("blob read");
    val = Handle<Value>(blobBuffer);
  } else {
    val = encoder->read(column, rowBuffer, offset);
  }

  if(hasConverterReader) {
    TryCatch tc;
    Handle<Value> arguments[1];
    arguments[0] = val;
    val = ToLocal(& converterReader)->CallAsFunction(ToLocal(& converterClass), 1, arguments);
    if(tc.HasCaught()) tc.ReThrow();
  }
  return val;
}

// If column is a blob, val is the blob buffer
Handle<Value> ColumnHandler::write(Handle<Value> val, char *buffer) const {
  Handle<Value> writeStatus;

  DEBUG_PRINT("write %s", column->getName());
  if(hasConverterWriter) {
    TryCatch tc;
    Handle<Value> arguments[1];
    arguments[0] = val;
    val = ToLocal(& converterWriter)->CallAsFunction(ToLocal(& converterClass), 1, arguments);
    if(tc.HasCaught())
      return tc.Exception();
   }
  
  writeStatus = encoder->write(column, val, buffer, offset);
  return writeStatus;
}

BlobWriteHandler * ColumnHandler::createBlobWriteHandle(Local<Value> val,
                                                        int fieldNo) const {
  DEBUG_MARKER(UDEB_DETAIL);
  BlobWriteHandler * b = 0;
  Handle<Object> nodeBuffer;
  if(isLob) {
    nodeBuffer = (isText && val->IsString()) ?
       getBufferForText(column, val->ToString()) :  // TEXT
       val->ToObject();                             // BLOB
    b = new BlobWriteHandler(column->getColumnNo(), fieldNo, nodeBuffer);
  }
  return b;
}

