#include "c-api.h"
#include "cxx-api.hpp"

#include "JsConverter.h"
#include "js_wrapper_macros.h"
#include "NativeMethodCall.h"

using namespace v8;


/*  C function wrapper 
*/
void whatnumber_wrapper(const Arguments & args) {
  REQUIRE_ARGS_LENGTH(2);
  
  JsValueConverter<int>           arg0(args[0]);
  JsValueConverter<const char *>  arg1(args[1]);
    
  args.GetReturnValue().Set(whatnumber(arg0.toC(), arg1.toC()));
}



//   c++ class wrapper...


/* Implementation of JS "new Point"
*/

V8WrapperFn Point_quadrant_wrapper;

class PointEnvelopeClass : public Envelope {
public:
  PointEnvelopeClass(): Envelope("Point") {
    addMethod("quadrant", Point_quadrant_wrapper);
  }
};

PointEnvelopeClass PointEnvelope;

void Point_new_wrapper(const Arguments &args) {
  REQUIRE_CONSTRUCTOR_CALL();
  REQUIRE_ARGS_LENGTH(2);

  JsValueConverter<double>  arg0(args[0]);
  JsValueConverter<double>  arg1(args[1]);

  Point * p = new Point(arg0.toC(), arg1.toC());

  Local<Object> jsObject = PointEnvelope.wrap(p);

  args.GetReturnValue().Set(jsObject);
}


/* Point::quadrant() 
*/
void Point_quadrant_wrapper(const Arguments &args) {
  REQUIRE_ARGS_LENGTH(0);

  Point *p = unwrapPointer<Point *>(args.Holder());
  
  args.GetReturnValue().Set(p->quadrant());
}



/* Circle */

V8WrapperFn Circle_area_wrapper;
V8WrapperFn Circle_area_async_wrapper;

class CircleEnvelopeClass : public Envelope {
public:
  CircleEnvelopeClass() : Envelope("Circle") {
    addMethod("area", Circle_area_wrapper);
    addMethod("areaAsync", Circle_area_async_wrapper);
  }
};

CircleEnvelopeClass CircleEnvelope;

void Circle_new_wrapper(const Arguments &args) {
  REQUIRE_CONSTRUCTOR_CALL();
  REQUIRE_ARGS_LENGTH(2);

  JsValueConverter<Point *> arg0(args[0]);
  JsValueConverter<double>  arg1(args[1]);

  Circle * c = new Circle(* arg0.toC(), arg1.toC());

  Local<Object> jsObject = CircleEnvelope.wrap(c);

  args.GetReturnValue().Set(jsObject);
 }


void Circle_area_wrapper(const Arguments  &args) {
  REQUIRE_ARGS_LENGTH(0);
  Circle *c = unwrapPointer<Circle *>(args.Holder());
  args.GetReturnValue().Set(c->area());
}

void Circle_area_async_wrapper(const Arguments &args) {
  REQUIRE_ARGS_LENGTH(1);
  typedef NativeMethodCall_0_<double, Circle> MCALL;
  MCALL * mcallptr = new MCALL(& Circle::area, args);
  mcallptr->runAsync();
  args.GetReturnValue().SetUndefined();
}

/* Initializer for the whole module
*/
void initAllOnLoad(Handle<Object> target) {
  DEFINE_JS_FUNCTION(target, "Circle", Circle_new_wrapper);
  DEFINE_JS_FUNCTION(target, "Point", Point_new_wrapper);
  DEFINE_JS_FUNCTION(target, "whatnumber", whatnumber_wrapper);
}


/*  FINAL STEP.
    This macro associates the module name with its initializer function 
*/
NODE_MODULE(mapper, initAllOnLoad)
