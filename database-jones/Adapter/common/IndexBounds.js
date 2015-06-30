/*
 Copyright (c) 2013, Oracle and/or its affiliates. All rights
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
var assert     = require("assert"),
     util       = require("util"),
     udebug     = unified_debug.getLogger("IndexBounds.js"),
     NumberLine,
     NumberLineStack;


/* Evaluation of Column Bounds from a Query

   An expression like "age < 30" defines a boundary on the value of age. 
   We can express that boundary as an interval (-Infinity, 30).
   The expression "state = 'SC'" does not define a boundary on age, 
   but nonetheless can be evaluated (with regard to age) as the interval 
   (-Infinity, +Infinity).  Knowing this, we can evaluate a query tree with 
   respect to "age" and generate an interval from every comparator node.
   
   If expressions are represented as intervals, then logical operations on 
   them can be translated into operations on the intervals:  conjunction as 
   intersection, disjunction as union, and negation as a complement.
   If comparator A returns interval Ia, and comparator B returns interval Ib,
   then the conjuction (A AND B) evaluates to the intersection of Ia and Ib.
   The disjunction (A OR B) evaluates to the union of Ia and Ib.  If Ia and Ib
   do not intersect, this union is the set {Ia, Ib}; if they do, it is the one
   segment that spans from the least lower bound to the greater upper bound.

   The NOT operator evaluates to the complement of an interval.  If Ia is 
   a finite inclusive interval [0, 30], then its complement is the pair of
   exclusive intervals (-Infinity, 0) and (30, +Infinity).

   Of course -Infinity and +Infinity don't really represent infinite values,
   only the lowest and highest values of the index.  NULLs sort low, so 
   JavaScript null is equivalent to -Infinity.

   The end result is that a predicate tree, evaluated with regard to an 
   index column, is transformed into the set of ranges (segments) of the index
   which must be scanned to evaluate the predicate.
   
   Calculating the intersections and unions of intervals requires us to 
   compare two values for an indexed column.  Implementing this would be 
   easy if all indexed columns were numbers, but in fact we also have 
   at least strings and dates to deal with.  JavaScript has a funny answer 
   when you compare strings and dates to Infinity:
      ("a" < Infinity) == false
      (Date() < Infinity) == false 
   isFinite() also cannot be used with strings and dates.

   In some cases, JavaScript simply cannot compare two values at all:
   for instance, it cannot compare two strings according to particular
   MySQL collation rules.  So, we introduce the concept of an EncodedValue,
   for values that JavaScript cannot compare and whose comparison is delegated 
   elsewhere.
*/

/* Utility functions 
*/
function blah() {
  console.log("BLAH");
  console.log.apply(null, arguments);
  console.trace();
  process.exit();
}

//////// EncodedValue             /////////////////

/*
  EncodedValue.compare(otherValue) should return -1, 0, or +1 according to 
  whether the stored value compares less, equal, or greater than otherValue.
  We don't implement compare() here.
*/
function EncodedValue() {
}

EncodedValue.prototype = {
  isNonSimple    : true,
  isEncodedValue : true,  
  inspect : function() { return "<ENCODED>"; },
  compare : function() { blah("EncodedValue must implement compare()"); }
};


/* compareValues() takes two values which are either JS Values or EncodedValues.
   Returns -1, 0, or +1 as the first is less, equal to, or greater than the 
   second.
   NULLs sort low and we say that two NULLs are equal.
*/
function compareValues(a, b) {
  var cmp;
  
  /* First compare to infinity */
  if(a === -Infinity || b === Infinity) {
    return -1;
  }

  if(a === Infinity || b === -Infinity) {
    return 1;
  }

  /* Then compare to null */
  if(a == null || b === null) {
    if(a === b) return 0;
    if(a === null) return -1;
    return 1;
  }

  if(typeof a === 'object' && typeof a.compare === 'function') {
    cmp = a.compare(b);
  }
  else {
    /* Compare JavaScript values */
    if(a == b) cmp = 0;
    else if (a < b) cmp = -1;
    else cmp = 1;
  }

  return cmp;
}


//////// IndexValue             /////////////////

/* IndexValue represents the multi-part value of an index.
   It is implemented as an array where each member is either a JS value or an
   EncodedValue.  Like other values, it can be used in endpoints and
   segments.
*/

function IndexValue(val) {
  this.size = 0;
  this.parts = [];
  if(val !== undefined)  {
    this.pushColumnValue(val);
  }
}

IndexValue.prototype = {
  isNonSimple      : true,
  isIndexValue     : true
};

IndexValue.prototype.pushColumnValue = function(v) {
  this.size++;
  this.parts.push(v);
};

IndexValue.prototype.copy = function() {
  var that = new IndexValue();
  that.size = this.size;
  that.parts = this.parts.slice();
  return that;
};

IndexValue.prototype.compare = function(that) {
  var n, len, cmp, v1, v2;

  assert(that.isIndexValue);
  len = this.size < that.size ? this.size : that.size;
  
  for(n = 0 ; n < len ; n++) {
    v1 = this.parts[n];
    v2 = that.parts[n];
    cmp = compareValues(v1, v2);
    if(cmp != 0) {
      return cmp;
    }
  }
  return 0; 
};

IndexValue.prototype.isFinite = function() {
  var v;
  if(this.size == 0) return false;
  v = this.parts[this.size - 1];
  if(v === null) return false;
  return (typeof v === 'number') ?  isFinite(v) : true;
};

IndexValue.prototype.inspect = function() {
  var i, result;
  result = "idx" + this.size + "pt:";
  for(i = 0 ; i < this.size ; i++) {
    if(i) result += ",";
    result += this.parts[i];
  }
  return result;
};


//////// Endpoint                  /////////////////

/* An Endpoint holds a value (plain JavaScript value, EncodedValue, 
   or IndexValue), and, as the endpoint of a range of values, is either 
   inclusive of the point value itself or not.  "inclusive" defaults to true.
*/
function Endpoint(value, inclusive, isLow) {
  this.value = value;
  this.inclusive = (inclusive === false) ? false : true;
  this.isLow = null;

  if(value === null) {
    this.isFinite = false;
  } else if(value.isIndexValue) {
    this.isFinite = value.isFinite();
  } else if(typeof value === 'number') {
    this.isFinite = isFinite(value);
  } else {
    this.isFinite = true;
  }
  if(typeof isLow === 'boolean') {
    this.isLow = isLow;
  }
}

Endpoint.prototype.isEndpoint = true;

/* copy() can be used only when value is an IndexValue */
Endpoint.prototype.copy = function() {
  return new Endpoint(this.value.copy(), this.inclusive, this.isLow);
};

/* Returns an IndexValue Endpoint
*/
Endpoint.prototype.toIndexValueEndpoint = function() {
  return new Endpoint(new IndexValue(this.value), this.inclusive, this.isLow);
};

Endpoint.prototype.inspect = function() {
  var s = "";
  var value = util.inspect(this.value);
  if(this.isLow === false) {
    s += value;
    s += (this.inclusive ? "]" : ")");
  } else {
    s += (this.inclusive ? "[" : "(");
    s += value;
  }
  return s;
};

/* Compare two Endpoints.  Returns -1, +1, or 0. 
   But behavior is undefined if isLow is still set to null.
*/
Endpoint.prototype.compare = function(that) {
  var cmp;
  assert(that.isEndpoint);
 
  if(this.value !== null && this.value.isNonSimple) {
    cmp = this.value.compare(that.value);
  }
  else {
    cmp = compareValues(this.value, that.value);
  }

  if(cmp === 0) {                             // Values are equal.
    if((this.isLow && that.isLow) &&                // both low bounds
       (this.inclusive !== that.inclusive))
    {
      cmp = (this.inclusive ? -1 : 1);
    }
    else if((this.isLow === that.isLow) &&          // both high bounds
            (this.inclusive !== that.inclusive))
    {
      cmp = (this.inclusive ? 1 : -1);
    }
    else if(this.inclusive && that.inclusive)       // both inclusive
    {
      cmp = (this.isLow ? -1 : 1);
    }
    else
    {
      cmp = (this.isLow ? 1 : -1);
    }
  }

  return cmp;
};

/* complement flips Endpoint between inclusive and exclusive.
   Used in complementing number lines.
   e.g. the complement of [4,10] is [-Inf, 4) and (10, Inf]
*/
Endpoint.prototype.complement = function() {
  if(this.isFinite) {
    this.inclusive = ! this.inclusive;
  }
  if(this.isLow !== null) {
    this.isLow = ! this.isLow;
  }
};

Endpoint.prototype.low = function() {
  this.isLow = true;
  return this;
};

Endpoint.prototype.high = function() {
  this.isLow = false;
  return this;
};

/* push() is used only for endpoints that contain IndexValues
*/
Endpoint.prototype.push = function(e) { 
  this.value.pushColumnValue(e.value);
  this.isFinite = e.isFinite;
  this.inclusive = e.inclusive;
};


/* Inclusive endpoints for negative and positive infinity
*/
function negInf()  { return new Endpoint(-Infinity).low();   }
function posInf()  { return new Endpoint(Infinity).high();   }

/* Endpoints for NULL and NOT NULL
*/
function negInfNonNull() { return new Endpoint(null, false); }
function nullInc()       { return new Endpoint(null, true);  }
function nullExc()       { return new Endpoint(null, false); }



//////// Segment                   /////////////////

/* A Segment is created from two endpoints on the line.
*/
function Segment(point1, point2) {
  assert(point1.isEndpoint && point2.isEndpoint);

  if(point1.compare(point2) === -1) {
    this.low = point1.low();
    this.high = point2.high();
  }
  else {
    this.low = point2.low();
    this.high = point1.high();
  }
}

Segment.prototype.isSegment = true;

Segment.prototype.inspect = function() {
  return this.low.inspect() + " -- " + this.high.inspect();
};

Segment.prototype.copy = function() {
  return new Segment(this.low.copy(), this.high.copy());
};

Segment.prototype.getIterator = function() {
  return this.toNumberLine().getIterator();
};

/* Returns a segment composed of one-part IndexValues.
*/
Segment.prototype.toIndexValues = function() {
  return new Segment(this.low.toIndexValueEndpoint(),
                     this.high.toIndexValueEndpoint());
};

Segment.prototype.toNumberLine = function() {
  var line = new NumberLine();
  line.transitions[0] = this.low;
  line.transitions[1] = this.high;
  return line;
};

/* Complement a Segment
*/
Segment.prototype.complement = function() {
  return this.toNumberLine().complement();
};


/* Create a segment between two points (inclusively) 
*/
function createSegmentBetween(a, b) {
  var p1 = new Endpoint(a);
  var p2 = new Endpoint(b);
  return new Segment(p1, p2);
}

/* Create a segment for a comparison expression */
function createSegmentForComparator(operator, value) {
  switch(operator) {   // operation codes are from api/Query.js
    case 0:   // LE
      return new Segment(negInfNonNull(), new Endpoint(value, true));
    case 1:   // LT
      return new Segment(negInfNonNull(), new Endpoint(value, false));
    case 2:   // GE
      return new Segment(new Endpoint(value, true), posInf());
    case 3:   // GT
      return new Segment(new Endpoint(value, false), posInf());
    case 4:   // EQ
      return new Segment(new Endpoint(value), new Endpoint(value));
    case 5:   // NE
      return new Segment(new Endpoint(value), new Endpoint(value)).complement().nonNull();
    default:
      return null;
  }
}

/* A segment from -Inf to +Inf
*/
function unboundedSegment() { return new Segment(negInf(), posInf()); }


//////// NumberLine                 /////////////////

/* A number line represents an ordered set of line segments 
   on a key space stretching from -Infinity to +Infinity
   
   The line is stored as an ordered list of transition points. 
   
   The segments on the line are from P0 to P1, P2 to P3, etc.
 
   The constructor "new NumberLine()" returns an empty NumberLine
*/

NumberLine = function() {
  this.transitions = [];
} 

NumberLine.prototype.isNumberLine = true;

NumberLine.prototype.inspect = function() {
  var it, str, segment;
  it = this.getIterator();
  str = "{ ";
  while((segment = it.next()) !== null) {
    if(it.n > 2) str += ",";
    str += segment.inspect();
  }
  str += " }";
  return str;  
};

NumberLine.prototype.isEmpty = function() {
  return (this.transitions.length == 0);
};

NumberLine.prototype.toNumberLine = function() {
  return this;
};

NumberLine.prototype.setEqualTo = function(that) {
  this.transitions = that.transitions;
};

NumberLine.prototype.upperBound = function() {
  if(this.isEmpty()) return negInf().high();
  return this.transitions[this.transitions.length - 1];
};

NumberLine.prototype.lowerBound = function() {
  if(this.isEmpty()) return posInf.low();
  return this.transitions[0];
};

/* A NumberLineIterator can iterate over the segments of a NumberLine 
*/
function NumberLineIterator(numberLine) {
  this.line = numberLine;
  this.list = numberLine.transitions;
  this.n = 0;
}

NumberLineIterator.prototype.next = function() {
  var s = null;
  if(this.n < this.list.length) {
    s = new Segment(this.list[this.n], this.list[this.n+1]);
    this.n += 2;
  }
  return s;    
};

NumberLine.prototype.getIterator = function() { 
  return new NumberLineIterator(this);
};


/* Complement of a number line (Negation of an expression)
*/
NumberLine.prototype.complement = function() {
  this.transitions.forEach(function(p) { p.complement(); });

  if(! this.lowerBound().isFinite) {
    this.transitions.shift();
  }
  else {
    this.transitions.unshift(negInf());
  }
  
  if(! this.upperBound().isFinite) {
    this.transitions.pop();
  }
  else {
    this.transitions.push(posInf());
  }

  assert(this.transitions.length % 2 == 0);
  return this;
};

/* Insert a segment into a number line.
   Assume as a given that the segment does not intersect any existing one.
*/
NumberLine.prototype.insertSegment = function(segment) {
  var stack = new NumberLineStack([ this, segment.toNumberLine() ]);
  this.setEqualTo(stack.union());
};


/* Creates a NumberLine formed of IndexValues
*/
NumberLine.prototype.toIndexValues = function() {
  var line, i;
  line = new NumberLine();
  for(i = 0 ; i < this.transitions.length ; i++) {
    line.transitions[i] = this.transitions[i].toIndexValueEndpoint();
  }
  return line;
};

/* Exclude Nulls; used for != */
NumberLine.prototype.nonNull = function() {
  this.transitions[0] = nullExc().low();
  return this;
};


//////// NumberLineStack             /////////////////

/* A NumberLineStack is created from a set of NumberLines.  It holds all their
   transition points in a single sorted list, and enables us to use a
   "sweep" algorithm to find unions and intersections.
*/


/* NumberLineStack constructor.  Takes an array of NumberLines.
   Uses iterative mergesort to form a single combined list of endpoints.
*/
NumberLineStack = function(lines) {
  var ins, arrays;
  arrays = lines.map(function(numberLine) {
    return numberLine.transitions;
  });
  this.size = arrays.length;

  if(this.size < 2) {
    this.list = arrays[0];
  } else {
    this.list = arrays.pop();
    while((ins = arrays.pop()) !== undefined) {
      this.list = this.mergeSortEndpoints(this.list, ins);
    }
  }
  udebug.log("NumberLineStack", this.list);
}

NumberLineStack.prototype.mergeSortEndpoints = function(list1, list2) {
  var result  = [],
      idx1    = 0,
      idx2    = 0;
  while(idx1 < list1.length && idx2 < list2.length) {
    if(list1[idx1].compare(list2[idx2]) < 1) {
      result.push(list1[idx1++]);
    } else {
      result.push(list2[idx2++]);
    }
  }
  return result.concat(list1.slice(idx1)).concat(list2.slice(idx2));
};


/* Sweep algorithm
*/
NumberLineStack.prototype.sweep = function(targetDepth) {
  var depth = 0,
      result = [],
      i, point;
  for(i = 0 ; i < this.list.length ; i++) {
    point = this.list[i];
    assert.strictEqual(typeof point.isLow, 'boolean');
    if(point.isLow) {
      if(++depth == targetDepth) result.push(point);
    } else {
      if(depth-- == targetDepth) result.push(point);
    }
  }
  udebug.log("sweep", result);
  return result;
};

/* Compute the intersection of all lines. Returns a NumberLine.
*/
NumberLineStack.prototype.intersection = function() {
  var line = new NumberLine();
  line.transitions = this.sweep(this.size);
  return line;
};

/* Compute the union of all lines. Returns a NumberLine.
*/
NumberLineStack.prototype.union = function() {
  var line = new NumberLine();
  line.transitions = this.sweep(1);
  return line;
};


//////// Query Node Evaluators                 /////////////////

/* Returns the columnBound already stored in the node,
   or an unboundedSegment.
*/
function evaluateNodeForColumn(node, columnNumber) {
  var segment = node.columnBound[columnNumber];
  if(segment === undefined) {
    segment = unboundedSegment();
  }
  return segment;
}

/* Returns the indexBound already stored in the node,
   or an unbounded index segment.
*/
function evaluateNodeForIndex(node, firstIndexColumn) {
  var segment = node.indexRange;
  if(segment === undefined) {
    segment = evaluateNodeForColumn(node, firstIndexColumn).toIndexValues();
  }
  udebug.log("Evaluate", firstIndexColumn, node, segment);
  return segment;
}

/* Returns a NumberLine 
*/
function intersectionForColumn(predicates, columnNumber) {
  var segments = predicates.map(function(node) {
    return evaluateNodeForColumn(node, columnNumber).toNumberLine();
  });
  return new NumberLineStack(segments).intersection();
}

/* Returns a NumberLine
*/
function unionForColumn(predicates, columnNumber) {
  var segments = predicates.map(function(node) {
    return evaluateNodeForColumn(node, columnNumber).toNumberLine();
  });
  return new NumberLineStack(segments).union();
}

/******** This is a map operationCode => function 
*/
var queryNaryFunctions = [ null , intersectionForColumn , unionForColumn ] ;


/****************************************** ColumnBoundVisitor ************
 *
 * Given a set of actual parameter values, visit the query tree and store
 * a segment for every comparator, BETWEEN, and IS NULL / NOT NULL node.
 * 
 * For grouping nodes AND, OR, NOT, store the intersection, union, or complement
 * over the nodes grouped, for every column referenced in that group.
 *
 *
 */
function ColumnBoundVisitor(params) {
  this.params = params;
}

/* Store a single segment at a node
*/
ColumnBoundVisitor.prototype.store = function(node, segment) {
  node.columnBound = {};
  node.columnBound[node.queryField.field.columnNumber] = segment;
};

/** AND/OR nodes */
ColumnBoundVisitor.prototype.visitQueryNaryPredicate = function(node) {
  var i, c, unionOrIntersection, doColumns;
  unionOrIntersection = queryNaryFunctions[node.operationCode]; 

  for(i = 0 ; i < node.predicates.length ; i++) {
    node.predicates[i].visit(this);
  }
  node.columnBound = {};
  doColumns = node.usedColumnMask.toArray();
  while(doColumns.length) {
    c = doColumns.pop();
    node.columnBound[c] = unionOrIntersection(node.predicates, c);
  }
};

/** NOT node */
ColumnBoundVisitor.prototype.visitQueryUnaryPredicate = function(node) {
  var c, doColumns;
  node.predicates[0].visit(this);
  doColumns = node.usedColumnMask.toArray();
  node.columnBound = {};
  while(doColumns.length) {
    c = doColumns.pop();
    node.columnBound[c] = node.predicates[0].columnBound[c].complement();
  }
};

/** Handle nodes QueryEq, QueryNe, QueryLt, QueryLe, QueryGt, QueryGe */
ColumnBoundVisitor.prototype.visitQueryComparator = function(node) {
  var segment = createSegmentForComparator(node.operationCode, 
                                           this.params[node.parameter.name]);
  this.store(node, segment);
};

/** Handle node QueryBetween */
ColumnBoundVisitor.prototype.visitQueryBetweenOperator = function(node) {
  var ep1, ep2, segment;  
  ep1 = this.params[node.parameter1.name];
  ep2 = this.params[node.parameter2.name];
  segment = createSegmentBetween(ep1, ep2);
  this.store(node, segment);
};

/** Handle nodes QueryIsNull, QueryIsNotNull 
    NULLS sort low.
*/
ColumnBoundVisitor.prototype.visitQueryUnaryOperator = function(node) {
  var segment;
  if(node.operationCode == 7) {  // IsNull
    segment = new Segment(nullInc(), nullInc());
  }
  else {   // IsNotNull
    assert(node.operationCode == 8);
    segment = new Segment(nullExc(), posInf());
  }
  this.store(node, segment);
};



/****************************************** IndexBoundVisitor ************
 *
 * Visit a tree that has already been marked by a ColumnBoundVisitor, and
 * construct a set of IndexBounds for a particular index.
 *
 * For each "AND" node, take the known ranges for the individual columns
 * of the index and assemble them into a set of ranges, each range being an
 * n-part IndexValue using the longest possible prefix set of index parts.
 * (This is called "consolidation," below).
 *
 * For each "OR" node, assemble index values for the child nodes of the OR,
 * and then construct the union of those ranges.  Note that if there is an AND 
 * somewhere above the OR in the tree, this result will be discarded.
 * 
 * For any other sort of node, if that node has a bounded range for the first 
 * column of the index, construct a range of 1-part IndexValues from that.
 *
 */
function IndexBoundVisitor(queryHandler, dbIndex) {
  this.index = dbIndex;
  this.ncol = this.index.columnNumbers.length;
  this.firstColumnNumber = this.index.columnNumbers[0];
}


/* Consolidation.
   This here is difficult.
   Each single-column value is represented by a Consolidator that builds
   its part of the conslidated index bound.
*/

var initialIndexBounds = 
  new Segment(new Endpoint(new IndexValue()), new Endpoint(new IndexValue()));

IndexBoundVisitor.prototype.consolidate = function(node) {
  var i, allBounds, thisColumn, nextColumn;

  function Consolidator(node, idxPartNo, colNo, nextColumnConsolidator) {
    this.columnBounds = node.columnBound[colNo];
    this.skip = this.columnBounds ? false : true;
    this.nextColumnConsolidator = nextColumnConsolidator;
    udebug.log("Consolidator for part", idxPartNo, "col", colNo, this.columnBounds, "skip:", this.skip);
  }

  /* Take the partially completed bounds object that is passed in.
     For each segment in this column's own bound, make a copy of
     the partialBounds, and try to add the segment to it.  If the
     segment endpoint is exclusive or infinite, stop there; otherwise,
     pass the partialBounds along to the next column.
  */
  Consolidator.prototype.consolidate = function(partialBounds, doLow, doHigh) {
    var boundsIterator, segment, idxBounds;

    boundsIterator = this.columnBounds.getIterator();
    segment = boundsIterator.next();
    while(segment) {
      idxBounds = partialBounds.copy();

      if(doLow) {
        idxBounds.low.push(segment.low);  // push new part onto IndexValue
        doLow = segment.low.inclusive && segment.low.isFinite;
      }
      if(doHigh) {
        idxBounds.high.push(segment.high); // push new part onto IndexValue
        doHigh = segment.high.inclusive && segment.high.isFinite;
      }

      if(this.nextColumnConsolidator && (doLow || doHigh)
          && (! this.nextColumnConsolidator.skip))
      {
        this.nextColumnConsolidator.consolidate(idxBounds, doLow, doHigh);
      }
      else {
        allBounds.insertSegment(idxBounds);
      }

      segment = boundsIterator.next();
    }
  };

  /* consolidate() starts here */
  if(! node.indexRange) {
    allBounds = new NumberLine();
    nextColumn = null;

    for(i = this.ncol - 1; i >= 0 ; i--) {
      thisColumn = new Consolidator(node, i, this.index.columnNumbers[i], nextColumn);
      nextColumn = thisColumn;
    }
    /* nextColumn is now the first column. consolidate left-to-right. */
    nextColumn.consolidate(initialIndexBounds, true, true);
    udebug.log("consolidate out:", allBounds);
    node.indexRange = allBounds;
  }
};


/** Handle nodes QueryAnd, QueryOr 
    To evaluate AND: Start with an empty index segment, and consolidate.
    To evaluate OR:  Get consolidated values for all children, then construct 
                     the union of the consolidations.
*/
IndexBoundVisitor.prototype.visitQueryNaryPredicate = function(node) {
  var i, segments, col1, result;
  for(i = 0 ; i < node.predicates.length ; i++) {
    node.predicates[i].visit(this);
  }

  switch(node.operationCode) {
    case 1:  // AND
      this.consolidate(node);
      break;
    case 2:
      col1 = this.firstColumnNumber;
      segments = node.predicates.map(function(n) {
        return evaluateNodeForIndex(n, col1).toNumberLine();
      });
      result = new NumberLineStack(segments).union();
      node.indexRange = result;
      udebug.log("Index union result", result);
      break;
  }
};

/** Handle node QueryNot */
IndexBoundVisitor.prototype.visitQueryUnaryPredicate = function(node) {
  node.predicates[0].visit(this);
  if(node.predicates[0].indexRange) {
    node.indexRange = node.predicates[0].indexRange.complement();
  }
};


/* Construct an exported IndexBound from a segment
*/
function IndexBoundEndpoint(endpoint) {
  this.inclusive = endpoint.inclusive;
  this.key = endpoint.value.parts;
}

IndexBoundEndpoint.prototype.inspect = function() {
  var i, str = "";
  for(i = 0 ; i < this.key.length ; i++) {
    if(i) str += ",";
    str += this.key[i];
  }
  return str;
};

function IndexBound(segment) {
  this.low = new IndexBoundEndpoint(segment.low);
  this.high = new IndexBoundEndpoint(segment.high);
}

IndexBound.prototype.inspect = function() {
  var str = this.low.inclusive ? "[" : "(";
  str += this.low.inspect() + " -- " + this.high.inspect();
  str += this.high.inclusive ? "]" : ")";
  return str;
};

/* getIndexBounds()

   Evaluate each node of the tree to construct bounds for columns.
   Then combine the column bounds into a set of bounds on the index.

   @arg queryHandler:  query 
   @arg dbIndex:       IndexMetadata of index to evaluate
   @arg params:        params to substitute into query

   Returns an array of IndexBounds   
*/
function getIndexBounds(queryHandler, dbIndex, params) {
  var indexVisitor, queryIndexRange, it, segment, bounds, topNode;
  topNode = queryHandler.predicate;

  /* Evaluate the query tree using the actual parameters */
  topNode.visit(new ColumnBoundVisitor(params));

  /* Then analyze it for this particular index */
  queryIndexRange = evaluateNodeForIndex(topNode, dbIndex.columnNumbers[0]);

  if(dbIndex.columnNumbers.length > 1) {
    indexVisitor = new IndexBoundVisitor(queryHandler, dbIndex);
    topNode.visit(indexVisitor);
    queryIndexRange = topNode.indexRange || queryIndexRange;
  }
  udebug.log("Index range for query:", queryIndexRange);

  /* Transform NumberLine to array of IndexBound */
  bounds = [];
  it = queryIndexRange.getIterator();
  while((segment = it.next()) !== null) {
    bounds.push(new IndexBound(segment));
  }
  
  return bounds;  
}

exports.getIndexBounds = getIndexBounds;

