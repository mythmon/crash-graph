var width = 960;
var height = 300;
var padding = 10;
//var dataUrl = 'https://crash-stats.allizom.org/api/CrashTrends/?end_date=2014-01-21&product=Firefox&start_date=2014-01-01&version=29.0a1' ;
var dataUrl = 'crashdata.json';
var colors = ['#e5e4e6', '#d1c2ef', '#d4d984', '#88d7b2'];

d3.json(dataUrl, function(err, jsonData) {
  if (err) {
    console.error(err);
    return;
  }

  pipeline([prepareData, jsonData],
           [makeSeries],
           [normalizeSeries],
           [stackData],
           [draw]);
});

function pipeline(/* ...funcsAndArgs */) {
  var funcsAndArgs = Array.prototype.slice.call(arguments);
  var ret = funcsAndArgs[0][0].apply(null, funcsAndArgs[0].slice(1));

  funcsAndArgs.slice(1).forEach(function(funcAndArgs) {
    var func = funcAndArgs[0];
    var args = funcAndArgs.slice(1);
    args.push(ret);
    ret = func.apply(null, args);
  });

  return ret;
}

function prepareData(jsonData) {
  var timeFormatter = d3.time.format('%Y-%m-%d');
  var datesSeen = {};

  // Get the right fields
  var data = jsonData.crashtrends
    // Convert from YYYY-MM-DD to Datetime objects.
    .map(function(d) {
      d.build_date = timeFormatter.parse(d.build_date);
      d.report_date = timeFormatter.parse(d.report_date);
      return d;
    })
    // Filter duplicate days.
    .filter(function(d) {
      if (d.report_date in datesSeen) {
        return false;
      } else {
        datesSeen[d.report_date] = true;
        return true;
      }
    });

  // Sort data by report_date
  data.sort(function(a, b) {
    if (a.report_date < b.report_date) return -1;
    if (a.report_date > b.report_date) return 1;
    return 0;
  });

  // The first couple of points are crap.
  return data.slice(2);
}

function makeSeries(data) {
  return [3, 0.3, 0.1, 0.1].map(function(scale, i) {
    return {
      color: colors[i],
      data: data.map(function(d) {
        return {
          report_date: d.report_date,
          report_count: d.report_count * scale,
        };
      }),
    };
  });
}

function normalizeSeries(series) {
  return series.map(function(ser) {
    ser.data = ser.data.map(function(d) {
      return {
        x: d.report_date,
        y: d.report_count,
      };
    });
    return ser;
  });
}

function stackData(series) {
  var skipStacking = 1;
  var i;

  for (i = 0; i < series.length; i++) {
    var ser = series[i];
    if (i <= skipStacking) {
      ser.data = ser.data.map(function(d) {
        d.y0 = 0;
        d.y1 = d.y;
        return d;
      });
    } else {
      ser.data = ser.data.map(function(d, j) {
        d.y0 = series[i - 1].data[j].y1;
        d.y1 = d.y0 + d.y;
        return d;
      });
    }
  }

  return series;
}

function draw(stackedSeries) {
  var animStep = 600;

  var svg = d3.select("body").append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g");

  var first = stackedSeries[0].data[0];
  var xscale = d3.scale.linear()
    .domain([first.x, first.x])
    .range([padding, width - padding]);

  var yscale = d3.scale.linear()
    .domain([first.y0, first.y0])
    .range([height - padding, padding]);

  // find total range of all series.
  stackedSeries.forEach(function(line) {
    var extentx = d3.extent(line.data, G.get('x'));
    var maxy = d3.max(line.data, G.get('y1'));
    var domainx = xscale.domain();
    var domainy = yscale.domain();

    xscale.domain([Math.min(extentx[0], domainx[0]), Math.max(extentx[1], domainx[1])]);
    yscale.domain([0, Math.max(maxy, domainy[1])]);
  });

  var areaGenerator = d3.svg.area()
    .x(G.compose(G.get('x'), xscale))
    .y0(G.compose(G.get('y0'), yscale))
    .y1(G.compose(G.get('y1'), yscale));

  var zeroAreaGenerator = d3.svg.area()
    .x(G.compose(G.get('x'), xscale))
    .y0(yscale(0))
    .y1(yscale(0));

  svg.selectAll('path')
    .data(stackedSeries)
    .enter()
      .append('path')
      .attr('d', G.compose(G.get('data'), zeroAreaGenerator))
      .attr('fill', G.get('color'))
      .transition()
        .duration(animStep)
        .delay(function(d, i) {
          if (i === 0) return 0;
          return i * animStep;
        })
        .attr('d', G.compose(G.get('data'), areaGenerator));
}
