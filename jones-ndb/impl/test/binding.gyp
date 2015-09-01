
{
 
  'targets': 
  [ 
    {
      'target_name': "api_mapper_test",

      'include_dirs':
      [
        '../include/common',
        '../include/ndb'
      ],

      'sources':
      [
         "c-api.cc",
         "api-mapper.cc",
         "../src/common/async_common.cpp"
      ]
    }
  ]
}
