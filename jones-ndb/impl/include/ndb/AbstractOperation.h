/*
 Copyright (c) 2015, Oracle and/or its affiliates. All rights
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

#ifndef NODEJS_ADAPTER_NDB_INCLUDE_ABSTRACTOPERATION_H
#define NODEJS_ADAPTER_NDB_INCLUDE_ABSTRACTOPERATION_H

#include "adapter_global.h"
#include "unified_debug.h"

/* All Forward Declarations */
class KeyOperation;
class ScanOperation;
class QueryOperation;

class AbstractOperation {
public:
  AbstractOperation(KeyOperation *);
  AbstractOperation(ScanOperation *);
  AbstractOperation(QueryOperation *);

  KeyOperation * getKeyOperation() const;
  ScanOperation * getScanOperation() const;
  QueryOperation * getQueryOperation() const;

private:
  int type;
  union {
    KeyOperation * op_key;
    ScanOperation * op_scan;
    QueryOperation * op_query;
  } op;
};

inline AbstractOperation::AbstractOperation(KeyOperation *o) :
  type(1), op.op_key(o)
{
  DEBUG_PRINT("New AbstractOperation (Key)");
}

inline AbstractOperation::AbstractOperation(ScanOperation *o) :
  type(2), op.op_scan(o)
{
  DEBUG_PRINT("New AbstractOperation (Scan)");
}

inline AbstractOperation::AbstractOperation(QueryOperation *o) :
  type(3), op.op_query(o)
{
  DEBUG_PRINT("New AbstractOperation (Query)");
}

inline KeyOperation * AbstractOperation::getKeyOperation() {
  return type == 1 ? op.op_key : 0;
}

inline ScanOperation * AbstractOperation::getScanOperation() {
  return type == 2 ? op.op_scan : 0;
}

inline QueryOperation * AbstractOperation::getQueryOperation() {
  return type == 3 ? op.op_query : 0;
}


#endif
