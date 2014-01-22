var width = 960;
var height = 300;
var padding = 10;
//var dataUrl = 'https://crash-stats.allizom.org/api/CrashTrends/?end_date=2014-01-21&product=Firefox&start_date=2014-01-01&version=29.0a1' ;
var dataUrl = 'crashdata.json';

d3.json(dataUrl, function(err, jsonData) {
  if (err) {
    console.error(err);
    return;
  }

  var i;
  var timeFormatter = d3.time.format('%Y-%m-%d');

  var data = jsonData.crashtrends.map(function(d) {
    d.build_date = timeFormatter.parse(d.build_date);
    d.report_date = timeFormatter.parse(d.report_date);
    return d;
  });

  var datesSeen = {};
  data = data.filter(function(d) {
    if (d.report_date in datesSeen) {
      return false;
    } else {
      datesSeen[d.report_date] = true;
      return true;
    }
  });

  // Sort by report date.
  data.sort(function(a, b) {
    if (a.report_date < b.report_date) return -1;
    if (a.report_date > b.report_date) return 1;
    return 0;
  });

  // some of this data is crap.
  data = data.slice(2);
  var colors = ['#e5e4e6', '#d1c2ef', '#d4d984', '#88d7b2'];
  // var colors = ['rgba(255, 0, 0, 0.5)','rgba(0, 255, 0, 0.5)','rgba(0, 0, 255, 0.5)','rgba(0, 0, 0, 0.5)'];

  // Make some fake data.
  var series = [3, 0.3, 0.1, 0.1].map(function(scale, i) {
    return {
      'color': colors[i],
      'data': data.map(function(d) {
        return {
          x: d.report_date,
          y: d.report_count * scale,
        };
      }),
    };
  });

  // // Really fake data.
  // series = [];
  // for (i = 0; i < 3; i++) {
  //   var l = [];
  //   for (j = 0; j < 4; j++) {
  //     l.push({x: j, y: Math.pow(j, i)});
  //   }
  //   series.push({color: colors[i], data: l});
  // }

  // Jenga!
  var firstStack = 2;

  for (i = 0; i < series.length; i++) {
    var line = series[i];
    console.log('a', line);
    if (i < firstStack) {
      line.data = line.data.map(function(d) {
        d.y0 = 0;
        d.y1 = d.y;
        return d;
      });
    } else {
      line.data = line.data.map(function(d, j) {
        d.y0 = series[i - 1].data[j].y1;
        d.y1 = d.y0 + d.y;
        return d;
      });
    }
    console.log('z', line);
  }

  // d3 stuff.
  var svg = d3.select("body").append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g");

  var first = series[0].data[0];
  var xscale = d3.scale.linear()
    .domain([first.x, first.x])
    .range([padding, width - padding]);

  var yscale = d3.scale.linear()
    .domain([first.y0, first.y0])
    .range([height - padding, padding]);

  series.forEach(function(line) {
    var extentx = d3.extent(line.data, G.get('x'));
    var maxy = d3.max(line.data, G.get('y1'));
    var domainx = xscale.domain();
    var domainy = yscale.domain();

    xscale.domain([Math.min(extentx[0], domainx[0]), Math.max(extentx[1], domainx[1])]);
    yscale.domain([0, Math.max(maxy, domainy[1])]);
  });

  console.log(xscale.domain());
  console.log(yscale.domain());

  var areaGenerator = d3.svg.area()
    .x(G.compose(G.get('x'), xscale))
    .y0(G.compose(G.get('y0'), yscale))
    .y1(G.compose(G.get('y1'), yscale));

  var zeroAreaGenerator = d3.svg.area()
    .x(G.compose(G.get('x'), xscale))
    .y0(yscale(0))
    .y1(yscale(0));

  var animStep = 600;

  svg.selectAll('path')
    .data(series)
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
});
