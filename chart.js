'use strict';
const KEYS = ['active', 'recovered', 'deaths'];
const COLORS = ['#a4c5c6', '#d4ebd0', '#f78259'];
const FAV_COUNTRIES = [
  'Germany',
  'Spain',
  'Italy',
  'China',
  'United States of America',
  'United Kingdom',
  'Viet Nam',
];
const MIN_CASES_TO_DISPLAY = 20;
const MAX_AUTOCOMPLETE_RESULTS = 20;

document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);

async function onDOMContentLoaded() {
  let countryFilter = document.getElementById('countryFilter');
  let countries = await fetch('https://api.covid19api.com/countries')
    .then((res) => res.json())
    .then((data) => data.map((elem) => elem.Country));

  // let dumpData = [
  //   'Germany',
  //   'Georgia',
  //   'Georg',
  //   'Golf',
  //   'Georgia',
  //   'Georg',
  //   'Golf',
  //   'Georgia',
  //   'Georg',
  //   'Golf',
  //   'Georgia',
  //   'Georg',
  //   'Golf',
  //   'Georgia',
  //   'Georg',
  //   'Golf',
  //   'Georgia',
  //   'Georg',
  //   'Golf',
  //   'Georgia',
  //   'Georg',
  //   'Golf',
  // ];

  addAutocomplete(countryFilter, 'country-filter', countries, FAV_COUNTRIES);
  createChart();
}

function showFavourites() {
  const countryFilter = document.getElementById('countryFilter');
  countryFilter.focus();
  countryFilter.value = '';
  countryFilter.dispatchEvent(new Event('input'));
  event.stopPropagation();
}

async function createChart() {
  let country = document.getElementById('countryFilter').value;
  let apiRequests = [
    `https://api.covid19api.com/total/country/${country}/status/confirmed`,
    `https://api.covid19api.com/total/country/${country}/status/deaths`,
    `https://api.covid19api.com/total/country/${country}/status/recovered`,
  ];

  displayLoadingScreen(true);
  displayLoadingScreenError(false);
  try {
    let data = await Promise.all(
      apiRequests.map((url) => fetch(url).then((res) => res.json()))
    ).then((dataArrays) => mergeAndFormatDataArrays.apply(this, dataArrays));

    data.length > 0 ? drawChart(data) : drawEmptyChart();
    displayLoadingScreen(false);
  } catch (err) {
    // TODO: stop svg animation
    displayLoadingScreenError(
      true,
      country
        ? `Data for <strong>${country}</strong> could not be loaded.`
        : 'Data could not be loaded.'
    );
  }
}

function displayLoadingScreenError(displayError, errMsg) {
  const loadingBars = document.getElementsByClassName('chart__loading-bar');
  const errMsgDisplay = document.getElementById('chart__err-msg');

  for (const bar of loadingBars) {
    displayError
      ? bar.classList.add('chart__loading--red')
      : bar.classList.remove('chart__loading--red');
  }

  if (errMsg && displayError) {
    errMsgDisplay.innerHTML = errMsg;
    errMsgDisplay.style.visibility = 'visible';
  } else if (!displayError) {
    errMsgDisplay.style.visibility = 'hidden';
  }
}

function displayLoadingScreen(displayLoadingScreen) {
  document.getElementById('chart__loading').hidden = !displayLoadingScreen;
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
  let margin = { top: 10, right: 20, bottom: 30, left: 20 },
    width = 700 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  svg.selectAll('svg > *').remove();
  svg
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} 400 `)
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
    .range([margin.left, width - margin.right]);

  svg
    .append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x))
    .call(xAxis);

  // Y-Axis
  let yAxis = (svg) =>
    svg
      .call(d3.axisRight(y).tickSize(width - margin.right))
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
    .range([height, margin.top + margin.bottom]);
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
