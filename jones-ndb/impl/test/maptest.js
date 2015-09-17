console.log("line 1");

var mapper = require("./build/Release/api_mapper_test");
// var mapper = require("./build/Debug/api_mapper_test");

console.log("line6");
console.log("%d ", mapper.whatnumber(3, "cowboy"));

console.log("line 9");
var p = new mapper.Point(1, 6);
console.log("p:");
console.dir(p);

console.log("line 14");
console.log("quadrant: %d", p.quadrant());

console.log("line 17");
var c = new mapper.Circle(p, 2.5);

console.log("line 20");
console.log("area: %d", c.area());

var d = c;
console.dir(d);
console.log("d area: %d", d.area());

c.areaAsync(function(err, val) {
  console.log("Got Async Area callback", err, val);
});
