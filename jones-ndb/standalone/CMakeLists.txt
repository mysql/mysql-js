# Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
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

cmake_minimum_required (VERSION 2.8.12.2)
project (JONES_NDB_STANDALONE)

# The build environment depends on WITH_NODEJS_INCLUDE_PATH

set(WITH_NODEJS_INCLUDE_PATH "" CACHE PATH "location of node.js header files")
set(WITH_MYSQL "" CACHE PATH "location of mysql")

if(WITH_NODEJS_INCLUDE_PATH)
  MESSAGE(STATUS "Building jones-ndb to install in share/nodejs")
  MESSAGE(STATUS "Using node.js from " ${WITH_NODEJS_INCLUDE_PATH})
else()
  MESSAGE(STATUS "Skipping jones-ndb")
  RETURN()
endif()


# Build rules.
#
include_directories(
  ${WITH_NODEJS_INCLUDE_PATH}
  ${WITH_MYSQL}/include
  ${WITH_MYSQL}/include/mysql
  ${WITH_MYSQL}/include/storage/ndb
  ${WITH_MYSQL}/include/storage/ndb/ndbapi
  ../impl/include/common
  ../impl/include/ndb
  ../impl/include/ndb/ndb_util
)

link_directories(${WITH_MYSQL}/lib)

add_definitions(-DNODE_GYP_MODULE_NAME=ndb_adapter)
add_definitions(-DBUILDING_NODE_EXTENSION)

set(ADAPTER_SOURCE_FILES
  ../impl/src/common/async_common.cpp
  ../impl/src/common/unified_debug.cpp
  ../impl/src/ndb/AsyncNdbContext_wrapper.cpp
  ../impl/src/ndb/AsyncNdbContext.cpp
  ../impl/src/ndb/BlobHandler.cpp
  ../impl/src/ndb/ColumnHandler.cpp
  ../impl/src/ndb/ColumnProxy.cpp
  ../impl/src/ndb/DBDictionaryImpl.cpp
  ../impl/src/ndb/DBOperationHelper.cpp
  ../impl/src/ndb/BatchImpl_wrapper.cpp
  ../impl/src/ndb/BatchImpl.cpp
  ../impl/src/ndb/SessionImpl_wrapper.cpp
  ../impl/src/ndb/SessionImpl.cpp
  ../impl/src/ndb/TransactionImpl_wrapper.cpp
  ../impl/src/ndb/TransactionImpl.cpp
  ../impl/src/ndb/EncoderCharset.cpp
  ../impl/src/ndb/IndexBoundHelper.cpp
  ../impl/src/ndb/KeyOperation.cpp  
  ../impl/src/ndb/Ndb_cluster_connection_wrapper.cpp
  ../impl/src/ndb/Ndb_init_wrapper.cpp
  ../impl/src/ndb/Ndb_util_wrapper.cpp
  ../impl/src/ndb/Ndb_wrapper.cpp
  ../impl/src/ndb/NdbError_wrapper.cpp
  ../impl/src/ndb/NdbInterpretedCode_wrapper.cpp
  ../impl/src/ndb/NdbRecordObject.cpp
  ../impl/src/ndb/NdbScanFilter_wrapper.cpp
  ../impl/src/ndb/NdbTypeEncoders.cpp
  ../impl/src/ndb/Record_wrapper.cpp
  ../impl/src/ndb/Record.cpp
  ../impl/src/ndb/ScanOperation_wrapper.cpp
  ../impl/src/ndb/ScanOperation.cpp
  ../impl/src/ndb/ValueObject.cpp
  ../impl/src/ndb/node_module.cpp
  ../impl/src/ndb/QueryOperation.cpp
  ../impl/src/ndb/QueryOperation_wrapper.cpp
)

# Enable asserts:
remove_definitions(-DNDEBUG)

# Turn off MySQL's DBUG library
add_definitions(-DDBUG_OFF)

if(WIN32) 
  set(ADAPTER_REQUIRED_LIBS ndbclient node)
  add_definitions(-DWIN32)
  add_definitions(-D_CRT_SECURE_NO_DEPRECATE -D_CRT_NONSTDC_NO_DEPRECATE)
  if(CMAKE_CL_64)
    link_directories(${NODE_GYP}/x64)
  else()
    link_directories(${NODE_GYP}/ia32) 
  endif()
else()
  set(ADAPTER_REQUIRED_LIBS ndbclient)
  add_definitions(-D_GNU_SOURCE -D_LARGEFILE_SOURCE -D_FILE_OFFSET_BITS=64)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=gnu++0x")
endif()

add_library(ndb_adapter MODULE ${ADAPTER_SOURCE_FILES})

target_link_libraries(ndb_adapter ${ADAPTER_REQUIRED_LIBS})


if(APPLE) 
  set(FINAL_LINK_FLAGS "-undefined dynamic_lookup")
elseif(WIN32)
  set(FINAL_LINK_FLAGS "/FORCE:MULTIPLE")
endif()

set_target_properties(ndb_adapter PROPERTIES
                      PREFIX ""
                      SUFFIX ".node"
                      LINK_FLAGS "${FINAL_LINK_FLAGS}")

# INSTALL RULE
INSTALL(
  TARGETS ndb_adapter
  DESTINATION ${CMAKE_SOURCE_DIR}/../build/Static
)