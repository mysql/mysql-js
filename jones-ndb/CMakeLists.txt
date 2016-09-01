# Copyright (c) 2008, 2016, Oracle and/or its affiliates. All rights reserved.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; version 2 of the License.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

# Install rule for source distribution

INSTALL(
  DIRECTORY . 
  DESTINATION ${INSTALL_MYSQLSHAREDIR}/nodejs
  COMPONENT nodejs)


# Build rules.
#
# The build environment depends on NDB_NODEJS_EXTRAS_PATH

IF(NDB_NODEJS_EXTRAS_PATH)
  MESSAGE(STATUS "Building mysql-js using " ${NDB_NODEJS_EXTRAS_PATH})
ELSE()
  MESSAGE(STATUS "Skipping mysql-js (NO NDB_NODEJS_EXTRAS_PATH)")
  RETURN()
ENDIF()

set(NODE_VERSION 4.4.7)
set(NODE_GYP ${NDB_NODEJS_EXTRAS_PATH}/node-gyp/${NODE_VERSION})
set(NODE_INCLUDES ${NODE_GYP}/include/node)

include_directories(${NODE_INCLUDES})
include_directories(impl/include/common)
include_directories(impl/include/ndb) 

link_directories(
  ${NDB_SOURCE_DIR}/src
  ${MYSQL_HOME}/lib)

add_definitions(-DNODE_GYP_MODULE_NAME=ndb_adapter)
add_definitions(-DBUILDING_NODE_EXTENSION)

set(ADAPTER_SOURCE_FILES
  impl/src/common/async_common.cpp
  impl/src/common/unified_debug.cpp
  impl/src/ndb/AsyncNdbContext_wrapper.cpp
  impl/src/ndb/AsyncNdbContext.cpp
  impl/src/ndb/BlobHandler.cpp
  impl/src/ndb/ColumnHandler.cpp
  impl/src/ndb/ColumnProxy.cpp
  impl/src/ndb/DBDictionaryImpl.cpp
  impl/src/ndb/DBOperationHelper.cpp
  impl/src/ndb/BatchImpl_wrapper.cpp
  impl/src/ndb/BatchImpl.cpp
  impl/src/ndb/SessionImpl_wrapper.cpp
  impl/src/ndb/SessionImpl.cpp
  impl/src/ndb/TransactionImpl_wrapper.cpp
  impl/src/ndb/TransactionImpl.cpp
  impl/src/ndb/EncoderCharset.cpp
  impl/src/ndb/IndexBoundHelper.cpp
  impl/src/ndb/KeyOperation.cpp  
  impl/src/ndb/Ndb_cluster_connection_wrapper.cpp
  impl/src/ndb/Ndb_init_wrapper.cpp
  impl/src/ndb/Ndb_util_wrapper.cpp
  impl/src/ndb/Ndb_wrapper.cpp
  impl/src/ndb/NdbError_wrapper.cpp
  impl/src/ndb/NdbInterpretedCode_wrapper.cpp
  impl/src/ndb/NdbRecordObject.cpp
  impl/src/ndb/NdbScanFilter_wrapper.cpp
  impl/src/ndb/NdbTypeEncoders.cpp
  impl/src/ndb/Record_wrapper.cpp
  impl/src/ndb/Record.cpp
  impl/src/ndb/ScanOperation_wrapper.cpp
  impl/src/ndb/ScanOperation.cpp
  impl/src/ndb/ValueObject.cpp
  impl/src/ndb/node_module.cpp
  impl/src/ndb/QueryOperation.cpp
  impl/src/ndb/QueryOperation_wrapper.cpp
)

# Enable asserts:
remove_definitions(-DNDEBUG)

if(WIN32) 
  set(ADAPTER_REQUIRED_LIBS ndbclient_static node)
  add_definitions(-DWIN32)
  add_definitions(-D_CRT_SECURE_NO_DEPRECATE -D_CRT_NONSTDC_NO_DEPRECATE)
  if(CMAKE_CL_64)
    link_directories(${NODE_GYP}/x64)
  else()
    link_directories(${NODE_GYP}/ia32) 
  endif()
else()
  set(ADAPTER_REQUIRED_LIBS ndbclient_so)
  add_definitions(-D_GNU_SOURCE -D_LARGEFILE_SOURCE -D_FILE_OFFSET_BITS=64)
  STRING(REPLACE "-Wvla"    "" CMAKE_CXX_FLAGS ${CMAKE_CXX_FLAGS})
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")
endif()
 

add_library(ndb_adapter MODULE ${ADAPTER_SOURCE_FILES})

target_link_libraries(ndb_adapter ${ADAPTER_REQUIRED_LIBS})

# target_compile_features(ndb_adapter PRIVATE cxx_alias_templates cxx_deleted_functions cxx_nullptr)
# set_property(TARGET ndb_adapter PROPERTY CXX_STANDARD 11)


if(APPLE) 
  set(FINAL_LINK_FLAGS "-undefined dynamic_lookup")
elseif(WIN32)
  set(FINAL_LINK_FLAGS "/FORCE:MULTIPLE")
endif()

set_target_properties(ndb_adapter PROPERTIES
                      PREFIX ""
                      SUFFIX ".node"
                      LINK_FLAGS "${FINAL_LINK_FLAGS}")

