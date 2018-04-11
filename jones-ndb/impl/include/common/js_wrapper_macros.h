/*
 Copyright (c) 2013, 2018, Oracle and/or its affiliates. All rights reserved.
 
 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License, version 2.0,
 as published by the Free Software Foundation.

 This program is also distributed with certain software (including
 but not limited to OpenSSL) that is licensed under separate terms,
 as designated in a particular file or component or in included license
 documentation.  The authors of MySQL hereby grant you an additional
 permission to link the program and your derivative works with the
 separately licensed software that they have included with MySQL.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License, version 2.0, for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301  USA
 */

#include <node.h>

#define STRING(I, S) v8::String::NewFromUtf8(I, S)

#define NEW_STRING(S) STRING(v8::Isolate::GetCurrent(), S)

#define SYMBOL(I, S) v8::String::NewFromUtf8(I, S, v8::String::kInternalizedString)

#define NEW_SYMBOL(S) SYMBOL(v8::Isolate::GetCurrent(), S)

#define REQUIRE_ARGS_LENGTH(N) \
  if(args.Length() != N) { \
    args.GetIsolate()->ThrowException(Exception::TypeError( \
      STRING(args.GetIsolate(), "Requires " #N " arguments"))); \
  }

#define REQUIRE_MIN_ARGS(N) \
  if(args.Length() < N) { \
    args.GetIsolate()->ThrowException(Exception::TypeError( \
      STRING(args.GetIsolate(), "Requires at least " #N " arguments"))); \
  }

#define REQUIRE_MAX_ARGS(N) \
  if(args.Length() > N) { \
    args.GetIsolate()->ThrowException(Exception::TypeError( \
      STRING(args.GetIsolate(), "Requires no more than " #N " arguments"))); \
  }

#define REQUIRE_CONSTRUCTOR_CALL() assert(args.IsConstructCall()) 

#define PROHIBIT_CONSTRUCTOR_CALL() assert(! args.IsConstructCall())

#define NEW_FN_TEMPLATE(FN) \
  v8::FunctionTemplate::New(v8::Isolate::GetCurrent(), FN)

#define DEFINE_JS_FUNCTION(TARGET, NAME, FN) \
  TARGET->Set(NEW_SYMBOL(NAME), NEW_FN_TEMPLATE(FN)->GetFunction())


/* Some compatibility */
#if NODE_MAJOR_VERSION > 3
#define V8_PROPERTY_NAME_T Local<Name>
#define DEFINE_JS_ACCESSOR(isolate, TARGET, property, getter)   \
  (TARGET)->SetAccessor((target)->CreationContext(),            \
                        SYMBOL(isolate, property),              \
                        getter).IsJust()
#define SET_PROPERTY(target, symbol, value, flags) \
  (target)->DefineOwnProperty((target)->CreationContext(), \
                               symbol, value, static_cast<v8::PropertyAttribute>\
                               (flags)).IsJust()
#else
#define V8_PROPERTY_NAME_T Local<String>
#define DEFINE_JS_ACCESSOR(isolate, TARGET, property, getter)                 \
  (TARGET)->SetAccessor(SYMBOL(isolate, property), getter)
#define SET_RO_PROPERTY(target, symbol, value, flags) \
  (target)->ForceSet(symbol, value, static_cast<v8::PropertyAttribute>(flags));
#endif

#define SET_RO_PROPERTY(target, symbol, value) \
  SET_PROPERTY(target, symbol, value, (v8::ReadOnly|v8::DontDelete))

#define DEFINE_JS_INT(TARGET, name, value) \
  SET_RO_PROPERTY(TARGET, NEW_SYMBOL(name), \
                  v8::Integer::New(v8::Isolate::GetCurrent(), value))

#define DEFINE_JS_CONSTANT(TARGET, constant) \
   DEFINE_JS_INT(TARGET, #constant, constant)

   
