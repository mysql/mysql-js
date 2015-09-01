console.log("line 1");
// var udebug = require("../../api/unified_debug.js").getLogger("maptest.js");
// var dmapper = require("../build/Release/test/outermapper.node");

var mapper = require("./build/Release/api_mapper_test");
// var mapper = require("./build/Debug/api_mapper_test");

// udebug.on();
// udebug.all_files();

console.log("line 4");
console.log("%d ", mapper.whatnumber(3, "cowboy"));

console.log("line 7");
var p = new mapper.Point(1, 6);
console.log("p:");
console.dir(p);
// process.exit();

console.log("line 10");
console.log("quadrant: %d", p.quadrant());

console.log("line 13");
var c = new mapper.Circle(p, 2.5);

console.log("line 16");
console.log("area: %d", c.area());

var d = c;
console.dir(d);
console.log("d area: %d", d.area());

c.areaAsync(function(err, val) {
  console.log("Got Async Area callback", err, val);
});

// var x = dmapper.doubleminus(4);
// console.log("doubleminus 4: %d", x);

