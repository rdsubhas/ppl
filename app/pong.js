var width = 480,
  height = 480,
  innerRadius = Math.min(width, height) * 0.35,
  outerRadius = innerRadius * 1.1;

var tmpl = _.template($('#league-template').text());

var fill     = d3.scale.category10();
var groupArc = d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius);
var chordArc = d3.svg.chord().radius(innerRadius);
var darker   = function(c) { return d3.rgb(c).darker().toString() };
var extractProperty = function(props) {
  props = _.flatten([props]);
  return function(memo) {
    return _.reduce(props, function(memo, prop) {
      return memo[prop]
    }, memo)
  }
}

d3.json("data/league1.json", function(leagues) {

  _.each(leagues, function(league, index) {

    var data    = league.data;
    var players = _.chain(league.players)
      .map(function(p, i) {
        return {
          index: i,
          name: p,
          score: _.reduce(data[i], function(memo, value, j) {
            return memo + (
              value == null ? 0 :
              value == data[j][i] ? 0 :
              value > data[j][i] ? 1 : 0
            )
          }, 0),
          average: _.reduce(data[i], function(memo, value, j) {
            return memo + (
              value == null ? 0 :
              value == data[j][i] ? 0 :
              value - data[j][i]
            )
          }, 0),
          matches: _.reduce(data[i], function(memo, value, j) {
            return memo + (value > 0 ? 1 : 0)
          }, 0)
        }
      })
      .sortBy(function(p) { return -((37*p.score)+p.average) })
      .map(function(p, i) { p.newIndex = i; return p })
      .value();

    data = _.map(players, function(p1) {
      return _.map(players, function(p2) {
        return data[p1.index][p2.index];
      })
    });

    var results = _.compact(_.flatten(_.map(data, function(row, i) {
      return _.map(row, function(value, j) {
        return (i == j || value == null || value < data[j][i]) ? false : {
          winner: players[i],
          winPoints: value,
          against: players[j],
          againstPoints: data[j][i]
        }
      });
    })));

    var schedules = _.compact(_.flatten(_.map(data, function(row, i) {
      return _.map(row, function(value, j) {
        return !(i != j && value == null && i < j) ? false : {
          player1: players[i],
          player2: players[j]
        }
      });
    })));

    var template = $(tmpl({ league: league, index: index, players: players, results: results, schedules: schedules }))
      .appendTo('.main .container');

    template
      .find('ul.nav a')
        .click(function(e) {
          e.preventDefault();
          $(this).tab('show');
        })
        .filter(':first')
          .tab('show');

    var matrix = _.map(data, function(row, i) {
      return _.map(row, function(cell, j) {
        if (i == j)
          return 0;
        else if (cell == null)
          return 0.5;
        else
          return (cell > data[j][i] ? 3 : 1);
      })
    });

    var container = d3.select('#league' + index).select('.d3graph');

    var vis = container.append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .append('g')
        .classed('graph', true)
        .attr('transform', 'translate(' + width/2 + ',' + height/2 + ')');

    var svg = vis.append('g');

    svg.append('circle')
      .classed('bg', true)
      .attr('r', width/2);

    var chord = d3.layout.chord()
      .padding(.05)
      .sortSubgroups(d3.descending)
      .matrix(matrix);

    function rotateGroup(g) {
      svg.transition().duration(500).attr('transform', 'rotate(' + (-((g.startAngle+g.endAngle)/2) * 180.0 / Math.PI) + ')')
    }

    rotateGroup(chord.groups()[0]);

    var playerGroups = svg.append('g')
      .selectAll('g')
      .data(chord.groups)
      .enter()
        .append('g')
        .classed('group', true)
        .on('mouseover', highlightGroup)
        .on('mouseout', unhighlightGroup)
        .on('click', rotateGroup);

    var playerGroupPaths = playerGroups
      .append('path')
      .attr('id', function(g, i) { return 'group_' + players[i].name })
      .style('fill', function(g) { return fill(g.index) })
      .style('stroke', function(g) { return fill(g.index) })
      .attr('d', groupArc);

    var playerTexts = playerGroups.append('text')
      .attr('fill', function(g) { return fill(g.index) })
      .attr('text-anchor', 'middle')
      .attr('dy', -15)
      .append('textPath')
        .attr('startOffset', '24.5%')
        .attr('xlink:href', function(g, i) { return '#group_' + players[i].name })
        .text(function(g, i) { return players[i].name });

    var playerPaths = svg.append('g')
      .attr('class', 'chords')
      .selectAll('g')
      .data(chord.chords)
      .enter()
        .append('g')
        .classed('chord', true)
        .classed('fixture', function(d) { return d.source.value == d.target.value })
        .classed('result', function(d) { return d.source.value != d.target.value })

    var playerChords = playerPaths
      .append('path')
        .attr('d', chordArc)
        .style('opacity', 1)
        .style('fill', function(d) {
          return (d.source.value == d.target.value) ? '#636363' : 
                 (d.source.value >  d.target.value) ? fill(d.source.index) : fill(d.target.index)
        });

    var pointOffset = function(which) {
      return function(d) {
        var g = chord.groups()[d[which].index], s = d[which]; return ((s.startAngle+s.endAngle-g.startAngle*2)/2)/(g.endAngle-g.startAngle)*50 + '%'
      }
    }

    playerPaths
      .filter('.result')
      .append('text')
        .attr('dy', 35)
        .attr('dx', -5)
        .attr('text-anchor', 'middle')
        .append('textPath')
          .attr('startOffset', pointOffset('source'))
          .attr('xlink:href', function(d) { return '#group_' + players[d.source.index].name })
          .text(function(d, i) { return data[d.source.index][d.target.index] });

    playerPaths
      .filter('.result')
      .append('text')
        .attr('dy', 35)
        .attr('dx', -5)
        .attr('text-anchor', 'middle')
        .append('textPath')
          .attr('startOffset', pointOffset('target'))
          .attr('xlink:href', function(d) { return '#group_' + players[d.target.index].name })
          .text(function(d, i) { return data[d.target.index][d.source.index] });

    d3.select('#standings' + index)
      .selectAll('tbody tr')
      .data(players)
      .on('mouseover', highlightAndRotateGroup)
      .on('mouseout', unhighlightGroup)

    d3.select('#results' + index)
      .selectAll('tbody tr')
      .data(results)
      .on('mouseover', function(r) { highlightPath(r.winner.newIndex, r.against.newIndex) })
      .on('mouseout', unhighlightGroup);

    d3.select('#schedule' + index)
      .selectAll('tbody tr')
      .data(schedules)
      .on('mouseover', function(r) { highlightPath(r.player1.newIndex, r.player2.newIndex) })
      .on('mouseout', unhighlightGroup);

    function highlightPath(p1, p2) {
      svg.classed('focus', true);
      playerGroups.classed('highlight', function(g, i) { return i == p1 || i == p2 });
      playerPaths.classed('highlight', function(d) {
        return (d.source.index == p1 && d.target.index == p2) || (d.source.index == p2 && d.target.index == p1);
      });
    }

    function highlightGroup(g, i) {
      svg.classed('focus', true);
      playerGroups.classed('highlight', function(g, j) { return i == j });
      playerPaths.classed('highlight', function(d) { return d.source.index == i || d.target.index == i });
    }

    function unhighlightGroup() {
      highlightGroup(null, -1);
      svg.classed('focus', false);
    }

    function highlightAndRotateGroup(p, i) {
      var g = chord.groups()[i];
      rotateGroup(g, i);
      highlightGroup(g, i);
    }

  });

});
