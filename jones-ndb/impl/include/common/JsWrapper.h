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

#ifndef NODEJS_ADAPTER_INCLUDE_JSWRAPPER_H
#define NODEJS_ADAPTER_INCLUDE_JSWRAPPER_H

#include <node.h>
#include "unified_debug.h"

using v8::Isolate;
using v8::Persistent;
using v8::Eternal;
using v8::ObjectTemplate;
using v8::EscapableHandleScope;
using v8::Handle;
using v8::Local;
using v8::Object;
using v8::Value;
using v8::Exception;
using v8::String;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::PropertyCallbackInfo;

/* A Persistent<T> can be cast to a Local<T>.  See:
   https://groups.google.com/forum/#!msg/v8-users/6kSAbnUb-rQ/9G5RmCpsDIMJ
*/
template<class T>
inline Local<T> ToLocal(Persistent<T>* p_) {
  return *reinterpret_cast<Local<T>*>(p_);
}

template<class T>
inline Local<T> ToLocal(const Persistent<T>* p_) {
  return *reinterpret_cast<const Local<T>*>(p_);
}

/* Recast the new (node 0.12) API in terms of the 
   Arguments type from the previous API
*/
typedef FunctionCallbackInfo<Value> Arguments;

/* Signature of a V8 function wrapper
*/
typedef void V8WrapperFn(const Arguments &);
typedef Handle<Value> V8Accessor(Local<String>, const PropertyCallbackInfo<Value> &);

/*****************************************************************
 Code to confirm that C++ types wrapped as JavaScript values
 are unwrapped back to the original type. This can be disabled.
 ENABLE_WRAPPER_TYPE_CHECKS is defined in adapter_global.h
 ******************************************************************/

#if ENABLE_WRAPPER_TYPE_CHECKS
#include <typeinfo>
inline void check_class_id(const char *a, const char *b) {
  if(a != b) {
    fprintf(stderr, " !!! Expected %s but unwrapped %s !!!\n", b, a);
    assert(a == b);
  }
}
#define TYPE_CHECK_T(x) const char * x
#define SET_CLASS_ID(env, PTR) env.class_id = typeid(PTR).name()
#define CHECK_CLASS_ID(env, PTR) check_class_id(env->class_id, typeid(PTR).name()) 
#else
#define TYPE_CHECK_T(x)
#define SET_CLASS_ID(env, PTR)
#define CHECK_CLASS_ID(env, PTR)
#endif


/*****************************************************************
 An Envelope is a simple structure providing some safety 
 & convenience for wrapped classes.

 All objects are wrapped using two internal fields.
 The first points to the envelope; the second to the object itself.
 ******************************************************************/
class Envelope {
public:
  /* Instance variables */
  int magic;                            // for safety when unwrapping 
  TYPE_CHECK_T(class_id);               // for checking type of wrapped object
  const char * classname;               // for debugging output
  Eternal<ObjectTemplate> stencil;      // for creating JavaScript objects
  Isolate * isolate;

  /* Constructor */
  Envelope(const char *name) :
    magic(0xF00D), 
    classname(name),
    isolate(Isolate::GetCurrent())
  {
    EscapableHandleScope scope(isolate);
    Local<ObjectTemplate> proto = ObjectTemplate::New();
    proto->SetInternalFieldCount(2);
    stencil.Set(isolate, proto);
  }

  /* Instance Methods */
  Local<Object> newWrapper() { 
    return stencil.Get(isolate)->NewInstance();
  }

  void addMethod(const char *name, V8WrapperFn wrapper) {
    stencil.Get(isolate)->Set(
      String::NewFromUtf8(isolate, name, v8::String::kInternalizedString),
      FunctionTemplate::New(isolate, wrapper)->GetFunction()
    );
  }

//  void addAccessor(const char *name, V8Accessor accessor) {
//    ToLocal(& stencil)->SetAccessor(
//      String::NewFromUtf8(isolate, name, v8::String::kInternalizedString),
//      accessor
//    );
//  }
};



/*****************************************************************
 Construct a wrapped object. 
 arg0: pointer to the object to be wrapped.
 arg1: an Envelope reference
 arg2: a reference to a v8 object, which must have already been 
       initialized from a proper ObjectTemplate.
******************************************************************/
template <typename PTR>
void wrapPointerInObject(PTR ptr,
                         Envelope & env,
                         Handle<Object> obj) {
  DEBUG_PRINT("Constructor wrapping %s: %p", env.classname, ptr);
  DEBUG_ASSERT(obj->InternalFieldCount() == 2);
  SET_CLASS_ID(env, PTR);
  obj->SetAlignedPointerInInternalField(0, (void *) & env);
  obj->SetAlignedPointerInInternalField(1, (void *) ptr);
}

/* Specializations for non-pointers reduce gcc warnings.
   Only specialize over primitive types. */
template <> inline void wrapPointerInObject(int, Envelope &, Handle<Object>) {
  assert(0);
}
template <> inline void wrapPointerInObject(unsigned long long int, Envelope &, Handle<Object>) {
  assert(0);
}
template <> inline void wrapPointerInObject(unsigned int, Envelope &, Handle<Object>) {
  assert(0);
}
template <> inline void wrapPointerInObject(double, Envelope &, Handle<Object>) {
  assert(0);
}

/*****************************************************************
 Unwrap a native pointer from a JavaScript object
 arg0: a reference to a v8 object, which must have already been 
       initialized from a proper ObjectTemplate.
TODO: Find a way to prevent wrapping a pointer as one
      type and unwrapping it as another.
******************************************************************/
template <typename PTR> 
PTR unwrapPointer(Handle<Object> obj) {
  PTR ptr;
  DEBUG_ASSERT(obj->InternalFieldCount() == 2);
  ptr = static_cast<PTR>(obj->GetAlignedPointerFromInternalField(1));
#ifdef UNIFIED_DEBUG
  Envelope * env = static_cast<Envelope *>(obj->GetAlignedPointerFromInternalField(0));
  assert(env->magic == 0xF00D);
  CHECK_CLASS_ID(env, PTR);
  DEBUG_PRINT_DETAIL("Unwrapping %s: %p", env->classname, ptr);
#endif
  return ptr;
}


/*****************************************************************
 Capture an error message from a C++ routine 
 Provide a method to run later (in the v8 main JavaScript thread) 
 and generate a JavaScript Error object from the message
******************************************************************/
class NativeCodeError {
public:
  const char * message;

  NativeCodeError(const char * msg) : message(msg) {}
  virtual ~NativeCodeError() {}
  
  virtual Local<Value> toJS() {
    EscapableHandleScope scope(Isolate::GetCurrent());
    return scope.Escape(Exception::Error(
      String::NewFromUtf8(Isolate::GetCurrent(), message)));
  }
};


#endif

