Unified Debug 
=============

Unified Debug is an internal run-time debugging package for C and JavaScript.
In the spirit of Fred Fish's dbug package, which is widely used in the MySQL
server, this package manages "printf()-style" trace debugging of source code.  

It allows a JavaScript user to set a debug output level, enabling trace messages
at that level and above from both native code and JavaScript source files.
Additionally, the user can also enable all messages from individual source files.

By default, messages are written to stderr.  They can be redirected to any
Node WritableStream, with some limitations.  The current implementation does
not allow redirection when messages originate from C code running in a UV
worker thread.

Package Contents
----------------

* unified\_debug.js: Node.JS module which declares, documents, and implements
  the Unified Debug API for JavaScript. 
* example-c/unified\_debug.h: header file declaring the C and C++ APIs.  The 
  API is based on preprocessor macros. If the symbol UNIFIED\_DEBUG is *not*
  defined at compile-time, a stub API is substituted so that debugging is 
  disabled entirely.
* example-c/unified\_debug.cpp: source file which implements both the C API
  and the C-to-JavaScript bridge.


The JavaScript API
------------------
```JavaScript 
  /* Turn debug output on 
  */
  function on();
  
  /* Turn debug output off 
  */
  function off();
  
  /* Functions for setting the output level for debug messages
  */
  function level_urgent();
  function level_notice();
  function level_info();
  function level_debug();
  function level_detail();
  
  /* Set a per-file debugging level.  
     This can be used to enable messages from particular source files.
     To enable all messages from a file, use level=5 (DETAIL).
  */
  function set_file_level(filename, level);
  

  /* Obtain a Logger for JavaScript source file.
     filename is used as a hash key, so no two files may register the same
     filename. 
     Returns a Logger.
  */
  function getLogger();
```

### Example of the Logger API
To write messages, use getLogger() to obtain a Logger, then use the Logger to
write messages.
```
   var unified_debug = require("unified_debug"),
       udebug = unified_debug.getLogger("ThisFile.js");

   udebug.log("a debug message");  // same as log_debug()

   udebug.log_urgent("urgent message");
   udebug.log_notice("notice message");
   udebug.log_info("info message");
   udebug.log_debug("debug message");
   udebug.log_detail("detail message");

   udebug.URGENT;      // numeric constant values for log levels
   udebug.NOTICE;
   udebug.INFO;
   udebug.DEBUG;
   udebug.DETAIL;

   udebug.is_urgent();  // returns true if current output level is >= URGENT
   udebug.is_notice();  // returns true if current output level is >= NOTICE
   udebug.is_info();    // returns true if current output level is >= INFO
   udebug.is_debug();   // returns true if current output level is >= DEBUG
   udebug.is_detail();  // returns true if current output level is == DETAIL

   udebug.set_file_level(x);  // Set our own per-file output level to x
```


Using Unified Debug with C/C++
------------------------------

* Copy unified\_debug.h and unified\_debug.cpp from example-c into your own
  project and build system.
* #DEFINE UNIFIED\_DEBUG 1 to enable debugging at compile time.


The C and C++ APIs
------------------   

In these macros *message* expands to any printf()-style set of arguments.
The maximum allowed size for a debug message is defined in unified\_debug.h;
messages longer than the maximum size will be truncated.

```C
DEBUG_PRINT(message);          // print message at DEBUG level
DEBUG_PRINT_DETAIL(message);   // print message at DETAIL level
DEBUG_PRINT_INFO(message);     // print message at INFO level
DEBUG_TRACE();                 // print filename and line number
DEBUG_ENTER();                 // print "Entering" message for function
DEBUG_LEAVE();                 // print "Leaving" message for function

// C++ only: create a stack-allocated marker that will print an "Entering"
// message from its constructor and a "Leaving" message from its destructor,
// with both messages written at debug level udeb_level
DEBUG_MARKER(udeb_level);
