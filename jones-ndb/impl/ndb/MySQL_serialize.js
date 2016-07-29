/*
 Copyright (c) 2016, Oracle and/or its affiliates. All rights
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

"use strict";

/* wl#8132 JSON binary encoding */

var assert = require("assert"),
    unified_debug = require("unified_debug"),
    udebug = unified_debug.getLogger("MySQL_serialize.js"),

    TYPE_SMALL_OBJ       =  0x00,
    TYPE_LARGE_OBJ       =  0x01,
    TYPE_SMALL_ARRAY     =  0x02,
    TYPE_LARGE_ARRAY     =  0x03,
    TYPE_LITERAL         =  0x04,
    TYPE_INT16           =  0x05,
    TYPE_UINT16          =  0x06,
    TYPE_INT32           =  0x07,
    TYPE_UINT32          =  0x08,
    TYPE_INT64           =  0x09,
    TYPE_UINT64          =  0x0A,
    TYPE_DOUBLE          =  0x0B,
    TYPE_STRING          =  0x0C,

    LITERAL_NULL         =  0x00,
    LITERAL_TRUE         =  0x01,
    LITERAL_FALSE        =  0x02,

    BINARY_KEY           =  99,

    binaryNull,
    binaryTrue,
    binaryFalse,
    binaryUndefined,

    inlineBufsize,
    serialize;

inlineBufsize = {
  TYPE_LITERAL : 1, TYPE_INT16   : 2, TYPE_UINT16  : 2,
  TYPE_INT32   : 4, TYPE_UINT32  : 4
};

function Binary(type, jsValue, buffer) {
  assert.notStrictEqual(type, undefined);
  this.type = type;
  this.jsValue = jsValue;
  this.buffer  = buffer || null;
  this.isLarge = (type == TYPE_LARGE_OBJ || type == TYPE_LARGE_ARRAY);
  this.isUndefined = (type === TYPE_LITERAL && jsValue === undefined);
}

/* element-count ::= uint16 | uint32 
   size ::= uint16 | uint32
*/
Binary.prototype.writeElementCountAndSize = function(count, size) {
  var buffer = new Buffer(this.isLarge ? 8 : 4);
  if(this.isLarge) {
    buffer.writeUInt32LE(count, 0);
    buffer.writeUInt32LE(size, 4);
  } else {
    buffer.writeUInt16LE(count, 0);
    buffer.writeUInt16LE(size, 2);
  }
  return buffer;
};

Binary.prototype.readElementCount = function() {
  return this.isLarge ?
    this.buffer.readUInt32LE(0) : this.buffer.readUInt16LE(0);
};

Binary.prototype.readSizeAndTruncateBuffer = function() {
  var size = this.isLarge ?
    this.buffer.readUInt32LE(4) : this.buffer.readUInt16LE(2);
  var offset = this.isLarge ? 8 : 4;
  this.buffer = this.buffer.slice(0, offset + size);
  return size;
};

Binary.prototype.isInline = function(isLarge) {
  var sz = inlineBufsize[this.type];
  return((sz !== undefined) && (isLarge || sz < 4));
};

Binary.prototype.writeInline = function(writeBuffer, offset) {
  return this.buffer.copy(writeBuffer, offset);
};

Binary.prototype.readInline = function(sourceBuffer, offset, isLarge) {
  this.buffer = sourceBuffer.slice(offset, offset + inlineBufsize[this.type]);
};

Binary.prototype.setLarge = function() {
  this.type += 1;      // e.g. from TYPE_SMALL_OBJ to TYPE_LARGE_OBJ
  this.isLarge = true;
};

Binary.prototype.write = function() {
  return Buffer.concat([ new Buffer([this.type]), this.buffer ], this.buffer.length+1);
 };


function VariableLength(length) {
  this.length = length || 0;
  this.nBytes = 0;
}

VariableLength.prototype.parse = function(buffer, offset) {
  var i, n;
  for(i = 0 ; i < 5 ; i++) {
    n = buffer[i+offset];
    this.length |= (n & 0x7f) << (7 * i);
    if((n & 0x80) == 0) {
      /* This is the last byte */
      this.nBytes = i+1;
      return true;  // success
    }
  }
  this.length = 0;  // failure
  return false;
};

VariableLength.prototype.serialize = function() {
  var length = this.length;
  var lengthArray = [];
  var byte;
  do {
    byte = length & 0x7f;  // get the seven LSBs of length
    length = length >> 7;  // right shift to drop them
    if(length) {
      byte = byte | 0x80;  // set the high bit to indicate more
    }
    lengthArray.push(byte);
  } while(length);

  return new Buffer(lengthArray);
};


// string ::= data-length utf8-data
function serializeString(jsString) {
  var stringBuffer, lengthBuffer, binary, vlen;

  binary = new Binary(TYPE_STRING, jsString);
  stringBuffer = new Buffer(jsString, 'utf8');
  vlen = new VariableLength(stringBuffer.length);
  lengthBuffer = vlen.serialize();
  binary.buffer = Buffer.concat([ lengthBuffer, stringBuffer ]);
  return binary;
}

function serializeDouble(jsNumber) {
  var binary = new Binary(TYPE_DOUBLE, jsNumber, new Buffer(8));
  binary.buffer.writeDoubleLE(jsNumber, 0);
  return binary;
}

function serializeInt16(jsNumber) {
  var binary = new Binary(TYPE_INT16, jsNumber, new Buffer(2));
  if(jsNumber < 32768) {
    binary.buffer.writeInt16LE(jsNumber, 0);
  } else {
    binary.type = TYPE_UINT16;
    binary.buffer.writeUInt16LE(jsNumber, 0);
  }
  return binary;
}

function serializeInt32(jsNumber) {
  var binary = new Binary(TYPE_INT32, jsNumber, new Buffer(4));
  if(jsNumber < 2147483648) {
    binary.buffer.writeInt32LE(jsNumber, 0);
  } else {
    binary.type = TYPE_UINT32;
    binary.buffer.writeUInt32LE(jsNumber, 0);
  }
  return binary;
}

function serializeInt64(jsNumber) {
  var binary = new Binary(TYPE_INT64, jsNumber);
  binary.buffer = new Buffer([0,0,0,0, 0,0,0,0]);
  if(jsNumber < 0) {
    assert.ifError("Encoding of large negative values is not implemented");
  } else {
    binary.type = TYPE_UINT64;
    binary.buffer.writeUIntLE(jsNumber, 2, 6);  // CORRECT?  VERIFY ME!
  }
  return binary;
}

/* Begin Polyfill */
Number.isInteger = Number.isInteger || function(value) {
  return typeof value === "number" && 
    isFinite(value) && 
    Math.floor(value) === value;
};
/* End Polyfill */

function serializeNumber(jsNumber) {
  if(! Number.isInteger(jsNumber)) {
    return serializeDouble(jsNumber);
  }

  if(jsNumber < 0) {
    if(jsNumber >= -32768) {
      return serializeInt16(jsNumber);
    }
    if(jsNumber >= -2147483648) {
      return serializeInt32(jsNumber);
    }
  } else {
    if(jsNumber <= 65535) {
      return serializeInt16(jsNumber);
    }
    if(jsNumber <= 4294967295) {
      return serializeInt32(jsNumber);
    }
  }

  return serializeInt64(jsNumber);
}


function ValueEntry(binary, offset) {
  this.binary = binary;
  this.offset = offset;
}

ValueEntry.prototype.getSize = function(isLarge) {
  return (isLarge ? 5 : 3);
};

/* value-entry ::= type offset-or-inlined-value */
ValueEntry.prototype.write = function(buffer, cursor, isLarge) {
  buffer[cursor++] = this.binary.type;
  if(this.binary.isInline(isLarge)) {
    this.binary.writeInline(buffer, cursor);
  } else if(isLarge) {
    buffer.writeUInt32LE(this.offset, cursor);
  } else {
    buffer.writeUInt16LE(this.offset, cursor);
  }
};

ValueEntry.prototype.read = function(entryBuffer, cursor, valueBuffer, isLarge) {
  this.binary = new Binary(entryBuffer[cursor++]);
  if(this.binary.isInline(isLarge)) {
    this.binary.readInline(entryBuffer, cursor);
  } else {
    this.offset = isLarge ?
      entryBuffer.readUInt32LE(cursor) : entryBuffer.readUInt16LE(cursor);
    this.binary.buffer = valueBuffer.slice(this.offset);
  }
};

ValueEntry.prototype.parse = function() {
  return this.binary.parse();
};

function List(binary, itemConstructor) {
  this.parent = binary;
  this.ItemConstructor = itemConstructor;
  this.list = [];
  this.buffer = new Buffer("");
}

List.prototype.push = function(binaryForm) {
  var item = new this.ItemConstructor(binaryForm, this.buffer.length);
  this.list.push(item);
  this.buffer = Buffer.concat( [this.buffer, binaryForm.buffer] );
};

List.prototype.writeEntries = function() {
  var buffer, elemSize, cursor, isLarge;

  elemSize = this.getSerializedSize();
  buffer = new Buffer(this.list.length * elemSize);
  cursor = 0;
  isLarge = this.parent.isLarge;

  this.list.forEach(function(entry) {
    entry.write(buffer, cursor, isLarge);
    cursor += elemSize;
  });

  return buffer;
};

List.prototype.readEntries = function(offset, count) {
  var elemSize, index;
  elemSize = this.getSerializedSize();
  for(index = 0; index < count ; index++) {
    this.list[index] = new this.ItemConstructor();
    this.list[index].read(this.parent.buffer,
                          offset + (index * elemSize),
                          this.buffer, this.parent.isLarge);
  }
};

List.prototype.getSerializedSize = function() {
  return new this.ItemConstructor().getSize(this.parent.isLarge);
};

List.prototype.getTotalSize = function() {
  if(this.list.length) {
    return this.buffer.length + (this.getSerializedSize() * this.list.length);
  }
  return 0;
};

List.prototype.parse = function() {
  var result = [];
  this.list.forEach(function(item) {
    result.push(item.parse());
  });
  return result;
};

/* Serialize an array.
   Following the behavior of JSON.stringify(),
   if an array element is undefined, replace it with Null.
*/
function serializeArray(jsArray) {
  var binary = new Binary(TYPE_SMALL_ARRAY, jsArray);
  var valueList = new List(binary, ValueEntry);
  var size, i;

  jsArray.forEach(function(item) {
    var bin = serialize(item);
    if(bin.isUndefined) bin = binaryNull;
    valueList.push(bin);
  });

  size = valueList.getTotalSize();
  if(size > 65535) {
    binary.setLarge();
    size = valueList.getTotalSize();  // recalculates with isLarge=true
  }

  /* array ::= element-count size value-entries values */
  binary.buffer = Buffer.concat( [
    binary.writeElementCountAndSize(valueList.list.length, size),
    valueList.writeEntries(),
    valueList.buffer
  ] );

  return binary;
}


function KeyEntry(binary, offset) {
  this.binary = binary;
  this.offset = offset;
  this.length = 0;
  this.key = "";
}

KeyEntry.prototype.getSize = function(isLarge) {
  return (isLarge ? 6 : 4);
};

/* key-entry ::= key-offset key-length */
KeyEntry.prototype.write = function(buffer, cursor, isLarge) {
  if(isLarge) {
    buffer.writeUInt32LE(this.offset, cursor);
    cursor += 4;
  } else {
    buffer.writeUInt16LE(this.offset, cursor);
    cursor += 2;
  }
  buffer.writeUInt16LE(this.binary.buffer.length, cursor);
};

KeyEntry.prototype.read = function(entryBuffer, cursor, valueBuffer, isLarge) {
  if(isLarge) {
    this.offset = entryBuffer.readUInt32LE(cursor);
    cursor += 4;
  } else {
    this.offset = entryBuffer.readUInt16LE(cursor);
    cursor += 2;
  }
  this.length = entryBuffer.readUInt16LE(cursor);
  this.key = valueBuffer.toString('utf8', this.offset, this.offset + this.length);
};

/* When serializing an object, keys are sorted on length, and keys 
   with the same length are sorted lexicographically */
function sortKeys(a,b) {
  if(a.length > b.length) {
    return -1;
  }
  if(a.length === b.length) {
    return (a < b) ? -1 : 1;
  }
  return 1;
}

/* key ::= utf8-data */
function serializeKey(jsString) {
  return new Binary(BINARY_KEY, jsString, new Buffer(jsString, 'utf8'));
}

function serializeObject(jsObject) {
  var binary = new Binary(TYPE_SMALL_OBJ, jsObject);
  var keyList = new List(binary, KeyEntry);
  var valueList = new List(binary, ValueEntry);
  var sortedKeys;
  var sortedValues = [];
  var validityCheck = [];
  var size;

  /* Build an ordered list of keys */
  sortedKeys = Object.keys(jsObject).sort(sortKeys);

  /* Build a list of values in key order */
  sortedKeys.forEach(function(key, index) {
    sortedValues[index] = jsObject[key];
  });

  /* Encode the values, skipping those that cannot be serialized */
  sortedValues.forEach(function(item, index) {
    var bin = serialize(item);
    var valid = ! bin.isUndefined;
    validityCheck[index] = valid;
    if(valid) {
      valueList.push(bin);
    }
  });

  /* Encode the keys */
  sortedKeys.forEach(function(key, index) {
    if(validityCheck[index]) {
      keyList.push(serializeKey(key));
    }
  });

  size = valueList.getTotalSize() + keyList.getTotalSize();
  if(size > 65535) {
    binary.setLarge();
    size = valueList.getTotalSize() + keyList.getTotalSize();
  }

  /* object ::=  element-count size key-entries value-entries keys values */
  binary.buffer = Buffer.concat( [
    binary.writeElementCountAndSize(valueList.list.length, size),
    keyList.writeEntries(),
    valueList.writeEntries(),
    keyList.buffer,
    valueList.buffer
  ] );

  return binary;
}


/* Some pre-fabricated Binary values */
binaryNull =  new Binary(TYPE_LITERAL, null,  new Buffer( [LITERAL_NULL]  ));
binaryTrue =  new Binary(TYPE_LITERAL, true,  new Buffer( [LITERAL_TRUE]  ));
binaryFalse = new Binary(TYPE_LITERAL, false, new Buffer( [LITERAL_FALSE] ));
binaryUndefined = new Binary(TYPE_LITERAL);


/* internal serialize() returns a Binary.
   Behavior should follow Crockford's reference implementation
   of JSON.stringify() in json2.js where possible.
*/
serialize = function(jsValue) {
  switch(typeof jsValue) {
    case 'undefined':
    case 'function':
      return binaryUndefined;

    case 'boolean':
      return jsValue ? binaryTrue : binaryFalse;

    case 'number':
      return serializeNumber(jsValue);

    case 'string':
      return serializeString(jsValue);

    case 'object':
      if(jsValue === null) {
        return binaryNull;
      }
      if(Array.isArray(jsValue)) {
        return serializeArray(jsValue);
      }
      if(typeof jsValue.toJSON === 'function') {
        return serialize(jsValue.toJSON());
      }
      return serializeObject(jsValue);

    default:
      assert.ifError("Unsupported data type" + typeof jsValue);
  }
};


//////////// Parser

Binary.prototype.parse = function() {
  switch(this.type) {
    case TYPE_LITERAL:
      return this.parseLiteral();

    case TYPE_INT16:
    case TYPE_UINT16:
      return this.parse16();

    case TYPE_INT32:
    case TYPE_UINT32:
      return this.parse32();

    case TYPE_DOUBLE:
      return this.parseDouble();

    case TYPE_STRING:
      return this.parseString();

    case TYPE_SMALL_ARRAY:
    case TYPE_LARGE_ARRAY:
      return this.parseArray();

    case TYPE_SMALL_OBJ:
    case TYPE_LARGE_OBJ:
      return this.parseObject();

    default:
      assert.ifError("Parser for type not implemented " + this.type);
  }
};

Binary.prototype.parseLiteral = function() {
  if(Buffer.isBuffer(this.buffer)) {
    switch(this.buffer[0]) {
      case LITERAL_NULL:
        return null;

      case LITERAL_TRUE:
        return true;

      case LITERAL_FALSE:
        return false;

      default:
        assert.ifError("Parser Error; badly formed literal");
    }
  } // if buffer is null, return undefined
};

Binary.prototype.parseDouble = function() {
  return this.buffer.readDoubleLE(0);
};

Binary.prototype.parse16 = function() {
  if(this.type == TYPE_INT16) {
    return this.buffer.readInt16LE(0);
  }
  return this.buffer.readUInt16LE(0);
};

Binary.prototype.parse32 = function() {
  if(this.type == TYPE_INT32) {
    return this.buffer.readInt32LE(0);
  }
  return this.buffer.readUInt32LE(0);
};

Binary.prototype.parseString = function() {
  var len = new VariableLength();
  len.parse(this.buffer, 0);
  return this.buffer.toString('utf8', len.nBytes, len.nBytes + len.length);
};

/* array ::= element-count size value-entries values */
Binary.prototype.parseArray = function() {
  var elementCount, valueList, valueEntryStart, valueEntryLen;

  elementCount = this.readElementCount();
  this.readSizeAndTruncateBuffer();
  valueList = new List(this, ValueEntry);
  valueEntryStart = this.isLarge ? 8 : 4;
  valueEntryLen = valueList.getSerializedSize() * elementCount;
  valueList.buffer = this.buffer.slice(valueEntryStart + valueEntryLen);
  valueList.readEntries(valueEntryStart, elementCount);
  return valueList.parse();
};


/* object ::=  element-count size key-entries value-entries keys values */
Binary.prototype.parseObject = function() {
  var elementCount;
  var keyList, keyEntryStart, keyEntryLen, keyStart;
  var valueList, valueEntryStart, valueEntryLen, valueStart;
  var finalKey, result, i;

  elementCount = this.readElementCount();
  this.readSizeAndTruncateBuffer();
  result = {};

  keyEntryStart = this.isLarge ? 8 : 4;
  keyList = new List(this, KeyEntry);
  keyEntryLen = keyList.getSerializedSize() * elementCount;

  valueEntryStart = keyEntryStart + keyEntryLen;
  valueList = new List(this, ValueEntry);
  valueEntryLen = valueList.getSerializedSize() * elementCount;

  keyStart = valueEntryStart + valueEntryLen;
  keyList.buffer = this.buffer.slice(keyStart);
  keyList.readEntries(keyEntryStart, elementCount);

  if(elementCount > 0) {
    finalKey = keyList.list[elementCount - 1];
    valueStart = keyStart + finalKey.offset + finalKey.length;
    valueList.buffer = this.buffer.slice(valueStart);
    valueList.readEntries(valueEntryStart, elementCount);
  }

  for(i = 0 ; i < elementCount ; i++) {
    result[keyList.list[i].key] = valueList.list[i].parse();
  }

  return result;
};

/* public serialize()
   returns a Buffer containing rfc#8132 serialization of a JS object 
*/
exports.serialize = function(jsValue) {
  return serialize(jsValue).write();
};

/* parseBlob() takes a buffer, returns a Binary
*/
function parseBlob(sourceBuffer) {
  return new Binary(sourceBuffer[0], undefined, sourceBuffer.slice(1));
}
exports.parseBlob = parseBlob;

/* public parse()
   takes a buffer
   returns a JS object
*/
exports.parse = function(sourceBuffer) {
  return parseBlob(sourceBuffer).parse();
};

exports.getSmallTestValues = function() {
  function TestItem() {
    this.a = 1;
  };
  TestItem.prototype.b = 2;

  return [
    true,
    false,
    null,
    undefined,
    0,
    1,
    Math.sqrt(3),
    "fred",
    "",
    [ 1 ],
    [],
    [ [1,2] , ["a","b"] ],
    { },
    { "a" : 1 },
    [ {}, {"b" : 2 }, null, 4, "george" ],
    50000,                            // 16-bit unsigned number
    70000,                            // 32-bit number
    2147500000,                       // 32-bit unsigned number
    -1,                               // signed number
    -30000,                           // signed 16-bit number
    -50000,                           // signed 32-bit number
    new Date(0),                      // call toJSON() and serialize that
    { "a" : undefined , "b" : 2 },    // omit undefined properties
    [ null, true, undefined, 4],      // replace array gap with null
    function() {},                    // undefined
    new TestItem(),                   // omit prototype properties
    Math                              // language-defined object
  ];
};

exports.getLargeTestValues = function() {
  var longValue = "abc".repeat(10000);
  var largeObject = { "a" : longValue, "b" : longValue, "c" : longValue };
  var largeArray = [ 1, longValue, 2, longValue, 3 , longValue , 4];
  return [ largeObject, largeArray ];
};

exports.runUnitTests = function() {
  var s;

  exports.getSmallTestValues().forEach(function(t) {
    s = serialize(t);
    console.log(t, s.parse());
  });

  exports.getLargeTestValues().forEach(function(t) {
    s = serialize(t);
    console.log(s.type, s.buffer.length);
    s.parse();
  });
};

// exports.runUnitTests();

