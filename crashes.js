var width = 960;
var height = 300;
var padding = 10;
//var dataUrl = 'https://crash-stats.allizom.org/api/CrashTrends/?end_date=2014-01-21&product=Firefox&start_date=2014-01-01&version=29.0a1' ;
var dataUrl = 'crashdata.json';
var colors = ['#88d7b2', '#d4d984', '#d1c2ef', '#e5e4e6'];
//var colors = ['rgba(255, 0, 0, 0.5)', 'rgba(0, 255, 0, 0.5)', 'rgba(0, 0, 255, 0.5)', 'rgba(255, 255, 0, 0.5)'];

d3.json(dataUrl, function(err, jsonData) {
  if (err) {
    console.error(err);
    return;
  }

  pipeline([prepareData, jsonData],
           [makeSeries],
           [normalizeSeries],
           [stackData, 1],
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

// Clean and translate the raw incoming data.
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

// (For now, fake the data.)
// Turn the prepared data into series, tagged with colors.
function makeSeries(data) {
  return [0.3, 0.1, 0.1, 3].map(function(scale, i) {
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

// Replace the data in a series with x and y coords.
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

// series -- [{color: '#abc', data: [{x: 4, y: 6},
//                                   ...]},
//            ...], in bottom-to-top order
// aboveGroundSer -- The 0-based index of the series that is just above the
//     straight horizontal axis.
function stackData(aboveGroundSeriesIndex, series) {
  var i;
  var aboveGroundSeries = series.slice(aboveGroundSeriesIndex);
  var belowGroundSeries = series.slice(0, aboveGroundSeriesIndex).reverse();

  var sliceSums = [];
  belowGroundSeries.forEach(function(ser) {
    ser.data.forEach(function(d, i) {
      sliceSums[i] = (sliceSums[i] || 0) + d.y;
    });
  });
  var groundLevel = d3.max(sliceSums);

  for (i = 0; i < aboveGroundSeries.length; i++) {
    var ser = aboveGroundSeries[i];

    // Add y0 and y1 fields to each datum:
    if (i === 0) {
      ser.data = ser.data.map(
        function (d) {
          d.y0 = groundLevel;
          d.y1 = d.y0 + d.y;
          return d;
        })
    } else {
      ser.data = ser.data.map(
        function (d, j) {
          d.y0 = aboveGroundSeries[i - 1].data[j].y1;
          d.y1 = d.y0 + d.y;
          return d;
        })
    }
  }

  for (i = 0; i < belowGroundSeries.length; i++) {
    var ser = belowGroundSeries[i];

    // Add y0 and y1 fields to each datum:
    if (i === 0) {
      ser.data = ser.data.map(
        function (d) {
          d.y1 = groundLevel;
          d.y0 = d.y1 - d.y;
          return d;
        })
    } else {
      ser.data = ser.data.map(
        function (d, j) {
          d.y1 = belowGroundSeries[i - 1].data[j].y0;
          d.y0 = d.y1 - d.y;
          return d;
        })
    }
  }

  return series;
}

// Do the D3 magick.
function draw(stackedSeries) {
  var animStep = 500;

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
    var miny = d3.min(line.data, G.get('y0'));
    var maxy = d3.max(line.data, G.get('y1'));
    var domainx = xscale.domain();
    var domainy = yscale.domain();

    xscale.domain([Math.min(extentx[0], domainx[0]), Math.max(extentx[1], domainx[1])]);
    yscale.domain([Math.min(miny, domainy[0]), Math.max(maxy, domainy[1])]);
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
        .attr('d', G.compose(G.get('data'), areaGenerator));
}
