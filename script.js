'use strict';
const KEYS = ['active', 'recovered', 'deaths'];
const COLORS = ['#a4c5c6', '#d4ebd0', '#f78259'];
const MIN_CASES_TO_DISPLAY = 20;

document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);

function onDOMContentLoaded() {
  fetch('https://api.covid19api.com/countries')
    .then((res) => res.json())
    .then((data) =>
      data.map((elem) => {
        let option = document.createElement('option');
        option.text = elem.Country;
        option.value = elem.Slug;
        document.getElementById('countryFilter').append(option);
      })
    );

  createChart();
}

async function createChart() {
  let country = document.getElementById('countryFilter').value;
  let apiRequests = [
    `https://api.covid19api.com/total/country/${country}/status/confirmed`,
    `https://api.covid19api.com/total/country/${country}/status/deaths`,
    `https://api.covid19api.com/total/country/${country}/status/recovered`,
  ];

  let data = await Promise.all(
    apiRequests.map((url) => fetch(url).then((res) => res.json()))
  ).then((dataArrays) => mergeAndFormatDataArrays.apply(this, dataArrays));

  data.length > 0 ? drawChart(data) : drawEmptyChart();
}

function mergeAndFormatDataArrays(confirmedData, deathsData, recoveredData) {
  return confirmedData
    .map((confElem) => {
      let deaths =
        deathsData.find(
          (deathElem) => deathElem.Date === confElem.Date && deathElem
        ).Cases || 0;

      let recovered =
        recoveredData.find(
          (recovElem) => recovElem.Date === confElem.Date && recovElem
        ).Cases || 0;

      return {
        date: new Date(confElem.Date),
        active: confElem.Cases - recovered - deaths,
        deaths,
        recovered,
      };
    })
    .filter(
      (elem) =>
        elem.active + elem.recovered + elem.deaths > MIN_CASES_TO_DISPLAY
    );
}

function drawEmptyChart() {
  updateMainStats({ active: '-', recovered: '-', deaths: '-' });
  d3.select('#chart__area').selectAll('svg > *').remove();
}

function updateMainStats(data) {
  KEYS.map(
    (key) =>
      (document.getElementById(`total-${key}`).innerHTML = data[key]
        .toString()
        .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'))
  );
}

function drawChart(data) {
  updateMainStats(data[data.length - 1]);

  let stackedData = d3.stack().keys(KEYS)(data);
  let svg = d3.select('#chart__area');
  let margin = { top: 10, right: 30, bottom: 30, left: 50 },
    width = 700,
    height = 400 - margin.top - margin.bottom;

  svg.selectAll('svg > *').remove();
  svg
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 700 400')
    .append('g');

  // X-Axis
  let xAxis = (svg) =>
    svg
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g.selectAll('.tick line').attr('stroke', '#ccc').attr('opacity', 0.5)
      )
      .call((g) =>
        g.selectAll('.tick text').attr('fill', '#ccc').attr('opacity', 0.9)
      );

  let x = d3
    .scaleTime()
    .domain(
      d3.extent(data, function (d) {
        return d.date;
      })
    )
    .range([0, width]);

  svg
    .append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x))
    .call(xAxis);

  // Y-Axis
  let yAxis = (svg) =>
    svg
      .call(d3.axisRight(y).tickSize(width))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick:first-of-type line').attr('opacity', 0))
      .call((g) =>
        g
          .selectAll('.tick:not(:first-of-type) line')
          .attr('stroke-opacity', 0.3)
          .attr('stroke-dasharray', '2,2')
          .attr('stroke', '#ccc')
      )
      .call((g) =>
        g
          .selectAll('.tick text')
          .attr('opacity', 0.9)
          .attr('fill', '#ccc')
          .attr('x', 4)
          .attr('dy', -4)
      );

  let y = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(data, function (d) {
        return d.active + d.recovered + d.deaths;
      }),
    ])
    .range([height, 0]);
  svg.append('g').call(yAxis);

  // chart areas
  let area = d3
    .area()
    .x(function (d) {
      return x(d.data.date);
    })
    .y0(function (d) {
      return y(d[0]);
    })
    .y1(function (d) {
      return y(d[1]);
    });

  svg
    .append('g')
    .selectAll('mylayers')
    .data(stackedData)
    .enter()
    .append('path')
    .style('fill', (d, i) => {
      return COLORS[i];
    })
    .attr('opacity', 0.75)
    .attr('d', area);
}
