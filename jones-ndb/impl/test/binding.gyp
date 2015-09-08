
{
 
  'targets': 
  [ 
    {
      'target_name': "api_mapper_test",

      'include_dirs':
      [
        '../include/common'
      ],

      'sources':
      [
         "c-api.cc",
         "api-mapper.cc",
         "../src/common/async_common.cpp",
         "../src/common/unified_debug.cpp"
      ]
    },
    {
      'target_name' : "debug_dlopen",
      'sources'     : [ "debug_dlopen.cpp"  ],
      'include_dirs': [ "../include/common" ],
    }
  ]
}
