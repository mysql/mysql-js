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

/* wl#8132 JSON binary encoding 
   https://dev.mysql.com/worklog/task/?id=8132
*/

var assert = require("assert"),
    unified_debug = require("unified_debug"),
    udebug = unified_debug.getLogger("MySQLSerialize.js"),

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
    keyEntrySizeArray, valueEntrySizeArray, headerSizeArray,
    serialize;


/* Begin Polyfill */
Number.isInteger = Number.isInteger || function(value) {
  return typeof value === "number" &&
    isFinite(value) &&
    Math.floor(value) === value;
};

if(!String.prototype.repeat) {
  String.prototype.repeat = function(count) {
    var str = "";
    while(count-- > 0) { str += this; }
    return str;
  };
}
/* End Polyfill */

inlineBufsize = { 4:1, 5:2, 6:2, 7:4, 8:4 };  // decimal type => inline size
keyEntrySizeArray   = [ 4,6 ];       // small object, large object
valueEntrySizeArray = [ 3,5,3,5 ];   // sm object, lg object, sm array, lg array
headerSizeArray     = [ 4,8,4,8 ];   // sm object, lg object, sm array, lg array

/* Binary representation of a JavaScript value
*/
function Binary(type, jsValue, buffer) {
  assert.notStrictEqual(type, undefined);
  assert(type <= TYPE_STRING || type === BINARY_KEY);
  this.type = type;
  this.jsValue = jsValue;
  this.buffer  = buffer || null;
  this.isUndefined = (type === TYPE_LITERAL && jsValue === undefined);
  if(this.type <= TYPE_LARGE_ARRAY) {
    this.isLarge = (type == TYPE_LARGE_OBJ || type == TYPE_LARGE_ARRAY);
    this.keyEntrySize = keyEntrySizeArray[this.type];
    this.valueEntrySize = valueEntrySizeArray[this.type];
    this.headerSize = headerSizeArray[this.type];
  }
}

/* element-count ::= uint16 | uint32 
   size ::= uint16 | uint32
*/
Binary.prototype.writeHeader = function(count, size) {
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

Binary.prototype.readHeader = function() {
  var recSize;

  if((this.elementCount !== undefined)  // Already read
     || (this.type > TYPE_LARGE_ARRAY))  // Value is a scalar
  {
    return;
  }

  if(this.isLarge) {
    this.elementCount = this.buffer.readUInt32LE(0);
    recSize = this.buffer.readUInt32LE(4);
  } else {
    this.elementCount = this.buffer.readUInt16LE(0);
    recSize = this.buffer.readUInt16LE(2);
  }

  this.buffer = this.buffer.slice(0, recSize); // truncate buffer

  if(this.type <= TYPE_LARGE_OBJ) {                         /* Object */
    this.valueEntryStartPos = this.headerSize +
      (this.keyEntrySize * this.elementCount);
  }
};

Binary.prototype.isInline = function(isLarge) {
  var sz = inlineBufsize[this.type];
  return((sz !== undefined) && (isLarge || sz < 4));
};

Binary.prototype.writeInline = function(writeBuffer, offset) {
  return this.buffer.copy(writeBuffer, offset);
};

Binary.prototype.readInline = function(sourceBuffer, offset) {
  this.buffer = sourceBuffer.slice(offset, offset + inlineBufsize[this.type]);
  udebug.log_detail("readInline", this.buffer);
};

Binary.prototype.setLarge = function() {
  this.type += 1;      // e.g. from TYPE_SMALL_OBJ to TYPE_LARGE_OBJ
  this.isLarge = true;
  this.keyEntrySize = keyEntrySizeArray[this.type];
  this.valueEntrySize = valueEntrySizeArray[this.type];
  this.headerSize = headerSizeArray[this.type];
};

Binary.prototype.write = function() {
  return this.isUndefined ? null :
    Buffer.concat([new Buffer([this.type]), this.buffer], this.buffer.length+1);
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

/* value-entry ::= type offset-or-inlined-value */
// write = function(buffer, offset, cursor, isLarge) {
ValueEntry.prototype.write = function(buffer, dataStartPos, cursor, isLarge) {
  buffer[cursor++] = this.binary.type;
  if(this.binary.isInline(isLarge)) {
    this.binary.writeInline(buffer, cursor);
  } else if(isLarge) {
    buffer.writeUInt32LE(dataStartPos + this.offset, cursor);
  } else {
    buffer.writeUInt16LE(dataStartPos + this.offset, cursor);
  }
};

ValueEntry.prototype.read = function(buffer, cursor, isLarge) {
  this.binary = new Binary(buffer[cursor++]);
  if(this.binary.isInline(isLarge)) {
    this.binary.readInline(buffer, cursor);
  } else {
    this.offset = isLarge ?
      buffer.readUInt32LE(cursor) : buffer.readUInt16LE(cursor);
    this.binary.buffer = buffer.slice(this.offset);
  }
};

ValueEntry.prototype.parse = function() {
  return this.binary.parse();
};


function KeyEntry(binary, offset) {
  this.binary = binary;
  this.offset = offset;
  this.length = 0;
  this.key = "";
}

/* key-entry ::= key-offset key-length */
KeyEntry.prototype.write = function(buffer, dataStartPos, cursor, isLarge) {
  if(isLarge) {
    buffer.writeUInt32LE(dataStartPos + this.offset, cursor);
    cursor += 4;
  } else {
    buffer.writeUInt16LE(dataStartPos + this.offset, cursor);
    cursor += 2;
  }
  buffer.writeUInt16LE(this.binary.buffer.length, cursor);
};

KeyEntry.prototype.read = function(buffer, cursor, isLarge) {
  if(isLarge) {
    this.offset = buffer.readUInt32LE(cursor);
    cursor += 4;
  } else {
    this.offset = buffer.readUInt16LE(cursor);
    cursor += 2;
  }
  this.length = buffer.readUInt16LE(cursor);
  this.key = buffer.toString('utf8', this.offset, this.offset + this.length);
};


function List(binary, entrySizeArray, itemConstructor, dataBuffer) {
  this.parent = binary;
  this.entrySizeArray = entrySizeArray;
  this.entrySize = entrySizeArray[this.parent.type];
  this.ItemConstructor = itemConstructor;
  this.entries = [];
  this.data = dataBuffer || new Buffer("");
}

List.prototype.push = function(binaryForm) {
  var item = new this.ItemConstructor(binaryForm, this.data.length);
  this.entries.push(item);
  this.data = Buffer.concat( [this.data, binaryForm.buffer] );
};

List.prototype.writeEntries = function(dataStartPos) {
  var buffer, elemSize, cursor, isLarge;

  elemSize = this.entrySize;
  buffer = new Buffer(this.entries.length * elemSize);
  cursor = 0;
  isLarge = this.parent.isLarge;

  this.entries.forEach(function(entry) {
    entry.write(buffer, dataStartPos, cursor, isLarge);
    cursor += elemSize;
  });

  return buffer;
};

List.prototype.readEntries = function(offset, count) {
  var index;
  for(index = 0; index < count ; index++) {
    this.entries[index] = new this.ItemConstructor();
    this.entries[index].read(this.parent.buffer,
                          offset + (index * this.entrySize),
                          this.parent.isLarge);
  }
};

List.prototype.getSizeOfEntries = function() {
  return this.entrySize * this.entries.length;
};

List.prototype.getTotalSize = function() {
  this.entrySize = this.entrySizeArray[this.parent.type];  // recalculate
  return this.getSizeOfEntries() + this.data.length;
};

List.prototype.parse = function() {
  var result = [];
  this.entries.forEach(function(item) {
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
  var valueList = new List(binary, valueEntrySizeArray, ValueEntry);
  var size;

  jsArray.forEach(function(item) {
    var bin = serialize(item);
    if(bin.isUndefined) { bin = binaryNull; }
    valueList.push(bin);
  });

  size = binary.headerSize + valueList.getTotalSize();
  if(size > 65535) {
    binary.setLarge();
    size = binary.headerSize + valueList.getTotalSize();  // recalculates
  }

  /* array ::= element-count size value-entries values */
  binary.buffer = Buffer.concat( [
    binary.writeHeader(valueList.entries.length, size),
    valueList.writeEntries(binary.headerSize + valueList.getSizeOfEntries()),
    valueList.data
  ] );

  return binary;
}


/* When serializing an object, keys are sorted on length, and keys
   with the same length are sorted lexicographically */
function sortKeys(a,b) {
  if(a.length > b.length) {
    return 1;
  }
  if(a.length === b.length) {
    return (a < b) ? -1 : 1;
  }
  return -1;
}

/* key ::= utf8-data */
function serializeKey(jsString) {
  return new Binary(BINARY_KEY, jsString, new Buffer(jsString, 'utf8'));
}

function serializeObject(jsObject) {
  var binary = new Binary(TYPE_SMALL_OBJ, jsObject);
  var keyList = new List(binary, keyEntrySizeArray, KeyEntry);
  var valueList = new List(binary, valueEntrySizeArray, ValueEntry);
  var sortedKeys;
  var sortedValues = [];
  var validityCheck = [];
  var size;
  var valueEntryStartPos, keyDataStartPos, valueDataStartPos;

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

  size = binary.headerSize + valueList.getTotalSize() + keyList.getTotalSize();
  if(size > 65535) {
    binary.setLarge();  // then recalculate sizes:
    size = binary.headerSize + valueList.getTotalSize() + keyList.getTotalSize();
  }

  /* object ::=  element-count size key-entries value-entries keys values */
  valueEntryStartPos = binary.headerSize + keyList.getSizeOfEntries();
  keyDataStartPos = valueEntryStartPos+ valueList.getSizeOfEntries();
  valueDataStartPos = keyDataStartPos + keyList.data.length;
  binary.buffer = Buffer.concat( [
    binary.writeHeader(valueList.entries.length, size),
    keyList.writeEntries(keyDataStartPos),
    valueList.writeEntries(valueDataStartPos),
    keyList.data,
    valueList.data
  ] );
  assert.equal(binary.buffer.length, size);
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

/* Set up parser for serialized arrays and objects.
   array ::= element-count size value-entries values
   object ::=  element-count size key-entries value-entries keys values
*/

Binary.prototype.parseArray = function() {
  var valueList;

  this.readHeader();
  valueList = new List(this, valueEntrySizeArray, ValueEntry);
  valueList.readEntries(this.headerSize, this.elementCount);
  return valueList.parse();
};

Binary.prototype.parseObject = function() {
  var keyList, valueList, result, i;

  this.readHeader();
  valueList = new List(this, valueEntrySizeArray, ValueEntry);
  keyList = new List(this, keyEntrySizeArray, KeyEntry);

  if(this.elementCount > 0) {
    keyList.readEntries(this.headerSize, this.elementCount);
    valueList.readEntries(this.valueEntryStartPos, this.elementCount);
  }

  result = {};
  for(i = 0 ; i < this.elementCount ; i++) {
    result[keyList.entries[i].key] = valueList.entries[i].parse();
  }
  udebug.log_detail("parseObject result:", result);
  return result;
};

Binary.prototype.getValueForKey = function(key) {
  this.setupParser();
  if(this.type <= TYPE_LARGE_OBJ) {
    return this.getNamedValue(key);
  }
  return this.getIndexedValue(key);
};

Binary.prototype.getIndexedValue = function(key) {
  var valueEntry, offset, valueBuffer;
  valueEntry = new ValueEntry();
  offset = this.valueEntryStartPos + (key * this.valueEntrySize);
  valueBuffer = this.buffer.slice(this.valueDataStartPos);
  valueEntry.read(this.buffer, offset, valueBuffer, this.isLarge);
  return valueEntry.binary;
};

/* getNamedValue(): 
   Keys are sorted by length, and then key string.
   TODO: First conduct a binary search of the key space to find all keys of the
   appropriate length; then search that set for the actual key string.
*/
Binary.prototype.getNamedValue = function(key) {
  var index=0;
  return this.getIndexedValue(index);
};

/* public serialize()
   returns a Buffer containing rfc#8132 serialization of a JS object 
*/
exports.serialize = function(jsValue) {
  return serialize(jsValue).write();
};

function getBinaryForBuffer(sourceBuffer) {
  if(Buffer.isBuffer(sourceBuffer) && sourceBuffer.length > 1) {
    return new Binary(sourceBuffer[0], undefined, sourceBuffer.slice(1));
  }
  return binaryUndefined;
}

/* public parse()
   takes a buffer
   returns a JS object
*/
exports.parse = function(sourceBuffer) {
  return Buffer.isBuffer(sourceBuffer) ?
    getBinaryForBuffer(sourceBuffer).parse() : null;
};

exports.getUnitTestValues = function() {
  var longValue = "abc".repeat(10000);
  var largeObject = { "a" : longValue, "b" : longValue, "c" : longValue };
  var largeArray = [ 1, longValue, 2, longValue, 3 , longValue , 4];
  var longString = "abcd_".repeat(40);  // variable length is two bytes
  function TestItem() {
    this.a = 1;
  }
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
    [ "Peter" , true , "Paul" ,
      false, 1, 90000, 1 ],           // mix inlined and non-inlined values
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
    Math,                             // language-defined object
    largeObject,
    largeArray,
    longString,
    {"a":[{"a10":"a10"},{"a11":"a11"}],"name":"Name 1","number":1}
  ];
};


function runUnitTests() {
  exports.getUnitTestValues().forEach(function(t) {
    var t1, r, s, r1;
    t1 = JSON.stringify(t);
    s = serialize(t);
    r = s.parse();
    r1 = JSON.stringify(r);
    if(t1 === undefined || t1.length < 40) {
      console.log(t, r);
    } else {
      console.log(s.type, s.buffer.length);
    }
    assert.equal(t1, r1);
  });
}

// runUnitTests();
