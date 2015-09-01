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


#include <NdbApi.hpp>

#include "adapter_global.h"
#include "js_wrapper_macros.h"
#include "Record.h"
#include "NativeMethodCall.h"

#include "NdbTypeEncoders.h"

using namespace v8;

V8WrapperFn getColumnOffset_wrapper,
            getBufferSize_wrapper,
            setNull_wrapper,
            setNotNull_wrapper,
            isNull_wrapper,
            record_encoderRead,
            record_encoderWrite;

class RecordEnvelopeClass : public Envelope {
public:
  RecordEnvelopeClass() : Envelope("Record") {
    HandleScope scope;
    addMethod("getColumnOffset", getColumnOffset_wrapper);
    addMethod("getBufferSize", getBufferSize_wrapper);
    addMethod("setNull", setNull_wrapper);
    addMethod("isNull", isNull_wrapper);
    addMethod("encoderRead", record_encoderRead);
    addMethod("encoderWrite", record_encoderWrite);
  }
};

RecordEnvelopeClass RecordEnvelope;


/****  CALL THIS FROM C++ CODE TO CREATE A WRAPPED RECORD OBJECT. 
*****/
Handle<Value> Record_Wrapper(const Record *rec) {
  EscapableHandleScope scope(args.GetIsolate());
  
  Local<Object> js_record = RecordEnvelope.newWrapper();
  wrapPointerInObject(rec, RecordEnvelope, js_record);
  freeFromGC(rec, js_record);
  return scope.Close(js_record);
}


Handle<Value> getColumnOffset_wrapper(const Arguments &args) {
  DEBUG_MARKER(UDEB_DETAIL);
  EscapableHandleScope scope(args.GetIsolate());
  
  REQUIRE_ARGS_LENGTH(1);

  typedef NativeConstMethodCall_1_<size_t, const Record, int> NCALL;

  NCALL ncall(& Record::getColumnOffset, args);
  ncall.run();
  
  return scope.Close(ncall.jsReturnVal());
}


Handle<Value> getBufferSize_wrapper(const Arguments &args) {
  DEBUG_MARKER(UDEB_DETAIL);
  EscapableHandleScope scope(args.GetIsolate());
  
  REQUIRE_ARGS_LENGTH(0);

  typedef NativeConstMethodCall_0_<size_t, const Record> NCALL;

  NCALL ncall(& Record::getBufferSize, args);
  ncall.run();
  
  return scope.Close(ncall.jsReturnVal());
}

Handle<Value> setNull_wrapper(const Arguments &args) {
  DEBUG_MARKER(UDEB_DEBUG);
  EscapableHandleScope scope(args.GetIsolate());
  
  REQUIRE_ARGS_LENGTH(2);

  typedef NativeVoidConstMethodCall_2_<const Record, int, char *> NCALL;

  NCALL ncall(& Record::setNull, args);
  ncall.run();
  
  return scope.Close(ncall.jsReturnVal());
}

Handle<Value> isNull_wrapper(const Arguments &args) {
  DEBUG_MARKER(UDEB_DETAIL);
  EscapableHandleScope scope(args.GetIsolate());
  
  REQUIRE_ARGS_LENGTH(2);

  typedef NativeConstMethodCall_2_<uint32_t, const Record, int, char *> NCALL;

  NCALL ncall(& Record::isNull, args);
  ncall.run();
  
  return scope.Close(ncall.jsReturnVal());
}


/* read(columnNumber, buffer)
*/
Handle<Value> record_encoderRead(const Arguments & args) {
  EscapableHandleScope scope(args.GetIsolate());
  const Record * record = unwrapPointer<Record *>(args.Holder());
  int columnNumber = args[0]->Uint32Value();
  char * buffer = node::Buffer::Data(args[1]->ToObject());

  const NdbDictionary::Column * col = record->getColumn(columnNumber);
  size_t offset = record->getColumnOffset(columnNumber);

  const NdbTypeEncoder * encoder = getEncoderForColumn(col);
  
  return encoder->read(col, buffer, offset);
}


/* write(columnNumber, buffer, value)
*/
Handle<Value> record_encoderWrite(const Arguments & args) {
  EscapableHandleScope scope(args.GetIsolate());

  const Record * record = unwrapPointer<const Record *>(args.Holder());
  int columnNumber = args[0]->Uint32Value();
  char * buffer = node::Buffer::Data(args[1]->ToObject());

  record->setNotNull(columnNumber, buffer);

  const NdbDictionary::Column * col = record->getColumn(columnNumber);
  size_t offset = record->getColumnOffset(columnNumber);

  const NdbTypeEncoder * encoder = getEncoderForColumn(col);
  Handle<Value> error = encoder->write(col, args[2], buffer, offset);

  return scope.Close(error);
}

