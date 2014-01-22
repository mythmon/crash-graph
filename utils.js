window.G = window.G || {};

G.get = function(key) {
  return function(d) {
    return d[key];
  };
};

G.compose = function() {
  var funcs = Array.prototype.slice.call(arguments);
  return function(d) {
    var ret = d;
    funcs.forEach(function(fn) {
      ret = fn(ret);
    });
    return ret;
  };
};

G.mult = function(/* *functors */) {
  var functors = Array.prototype.slice.call(arguments);
  var funcs = functors.map(d3.functor);
  return function(d, i) {
    var product = 1;
    funcs.forEach(function(func) {
      product *= func(d, i);
    });
    return product;
  };
};
