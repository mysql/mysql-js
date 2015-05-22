# Some help:
#  Microsoft linker options:  
#     http://msdn.microsoft.com/en-us/library/4khtbfyf.aspx
#  
#  Misc.:
#     https://github.com/mapnik/node-mapnik/issues/74 --  /FORCE:MULTIPLE
#     https://github.com/TooTallNate/node-gyp/wiki/%22binding.gyp%22-files-out-in-the-wild
#     https://github.com/TooTallNate/node-gyp/blob/master/addon.gypi

{
 
  'targets': 
  [ 
    {
      'target_name': "ndb_adapter",

      'include_dirs':
      [
        '<(mysql_path)/include',
        '<(mysql_path)/include/mysql',
        '<(mysql_path)/include/mysql/storage/ndb',
        '<(mysql_path)/include/mysql/storage/ndb/ndbapi',
        '<(mysql_path)/include/storage/ndb',
        '<(mysql_path)/include/storage/ndb/ndbapi',
        'impl/include/common',
        'impl/include/ndb'
      ],
        
      'sources': 
      [
         "impl/src/common/async_common.cpp",
         "impl/src/common/unified_debug.cpp",
         "impl/src/common/common_v8_values.cpp",

         "impl/src/ndb/AsyncNdbContext_wrapper.cpp",
         "impl/src/ndb/AsyncNdbContext.cpp",
         "impl/src/ndb/BlobHandler.cpp",
         "impl/src/ndb/ColumnHandler.cpp",
         "impl/src/ndb/ColumnProxy.cpp",
         "impl/src/ndb/DBDictionaryImpl.cpp",
         "impl/src/ndb/DBOperationHelper.cpp",
         "impl/src/ndb/BatchImpl_wrapper.cpp",
         "impl/src/ndb/BatchImpl.cpp",
         "impl/src/ndb/SessionImpl_wrapper.cpp",
         "impl/src/ndb/SessionImpl.cpp",
         "impl/src/ndb/TransactionImpl_wrapper.cpp",
         "impl/src/ndb/TransactionImpl.cpp",
         "impl/src/ndb/EncoderCharset.cpp",
         "impl/src/ndb/IndexBoundHelper.cpp",
         "impl/src/ndb/KeyOperation.cpp",
         "impl/src/ndb/Ndb_cluster_connection_wrapper.cpp",
         "impl/src/ndb/Ndb_init_wrapper.cpp",
         "impl/src/ndb/Ndb_util_wrapper.cpp",
         "impl/src/ndb/Ndb_wrapper.cpp",
         "impl/src/ndb/NdbError_wrapper.cpp",
         "impl/src/ndb/NdbInterpretedCode_wrapper.cpp",
         "impl/src/ndb/NdbRecordObject.cpp",
         "impl/src/ndb/NdbScanFilter_wrapper.cpp",
         "impl/src/ndb/NdbTypeEncoders.cpp",
         "impl/src/ndb/Record_wrapper.cpp",
         "impl/src/ndb/Record.cpp",
         "impl/src/ndb/ScanOperation_wrapper.cpp",
         "impl/src/ndb/ScanOperation.cpp", 
         "impl/src/ndb/ValueObject.cpp",
         "impl/src/ndb/node_module.cpp"
        ],

      'conditions': 
      [
        ['OS=="win"', 
          # Windows 
          {
            'libraries':
            [
              '-l<(mysql_path)/lib/ndbclient_static.lib',
              '-l<(mysql_path)/lib/mysqlclient.lib',
            ],
            'msvs_settings':
            {
              'VCLinkerTool':
                {
                  'AdditionalOptions': 
                  [
                    '/FORCE:MULTIPLE',
                    '/NODEFAULTLIB:LIBCMT'
                  ]
                }
            }
          },
          # Not Windows
          {
            'sources' : 
            [
               "impl/src/ndb/mysqlclient_wrapper.cpp"
            ],
            'libraries':
            [
              "-L<(mysql_path)/lib",
              "-L<(mysql_path)/lib/mysql",
              "-lndbclient",
              "-lmysqlclient"
            ]
          }
        ]
      ] 
      # End of conditions
    }
  ]
}

