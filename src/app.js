'use strict';

import * as d3 from 'd3';
import { addAutocomplete } from './autocomplete';
import * as Constants from './constants';
import './style.scss';

document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);

async function onDOMContentLoaded() {
  const countryFilter = document.getElementById('countryFilter');
  try {
    const countries = await fetch('https://api.covid19api.com/countries')
      .then(handleHttpErrors)
      .then((res) => res.json())
      .then((data) => data.map((elem) => elem.Country));

    addAutocomplete(
      countryFilter,
      'country-filter',
      countries,
      createChart,
      Constants.FAV_COUNTRIES
    );

    createChart();
  } catch (err) {
    displayLoadingScreenError(true, `${err} - Data could not be loaded.`);
  }
}

window.showFavourites = function () {
  const countryFilter = document.getElementById('countryFilter');
  countryFilter.focus();
  countryFilter.value = '';
  countryFilter.dispatchEvent(new Event('input'));
  event.stopPropagation();
};

window.createChart = async function () {
  const country = document.getElementById('countryFilter').value;
  const apiRequests = [
    `https://api.covid19api.com/total/country/${country}/status/confirmed`,
    `https://api.covid19api.com/total/country/${country}/status/deaths`,
    `https://api.covid19api.com/total/country/${country}/status/recovered`,
  ];

  displayLoadingScreen(true);
  displayLoadingScreenError(false);

  try {
    const data = await Promise.all(
      apiRequests.map((url) =>
        fetch(url)
          .then(handleHttpErrors)
          .then((res) => res.json())
      )
    ).then((dataArrays) => mergeAndFormatDataArrays.apply(this, dataArrays));

    data.length > 0 ? drawChart(data) : drawEmptyChart();
    displayLoadingScreen(false);
  } catch (err) {
    displayLoadingScreenError(true, `${err} - Data could not be loaded.`);
  }
};

function handleHttpErrors(response) {
  if (!response.ok) {
    throw Error(response.status);
  }
  return response;
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
    errMsgDisplay.style.opacity = 1;
  } else if (!displayError) {
    errMsgDisplay.style.visibility = 0;
  }
}

function displayLoadingScreen(displayLoadingScreen) {
  document.getElementById('chart__loading').hidden = !displayLoadingScreen;
}

function mergeAndFormatDataArrays(confirmedData, deathsData, recoveredData) {
  return confirmedData
    .map((confElem) => {
      const deaths =
        deathsData.find(
          (deathElem) => deathElem.Date === confElem.Date && deathElem
        ).Cases || 0;

      const recovered =
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
        elem.active + elem.recovered + elem.deaths >
        Constants.MIN_CASES_TO_DISPLAY
    );
}

function drawEmptyChart() {
  updateMainStats({ active: '-', recovered: '-', deaths: '-' });
  d3.select('#chart__area').selectAll('svg > *').remove();
}

function updateMainStats(data) {
  Constants.KEYS.map(
    (key) =>
      (document.getElementById(`total-${key}`).innerHTML = data[key]
        .toString()
        .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'))
  );
}

function drawChart(data) {
  updateMainStats(data[data.length - 1]);

  const stackedData = d3.stack().keys(Constants.KEYS)(data);
  const svg = d3.select('#chart__area');
  const margin = { top: 10, right: 20, bottom: 30, left: 20 },
    width = 700 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  svg.selectAll('svg > *').remove();
  svg
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} 400 `)
    .append('g');

  // X-Axis
  const xAxis = (svg) =>
    svg
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g.selectAll('.tick line').attr('stroke', '#ccc').attr('opacity', 0.5)
      )
      .call((g) =>
        g.selectAll('.tick text').attr('fill', '#ccc').attr('opacity', 0.9)
      );

  const x = d3
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
  const yAxis = (svg) =>
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

  const y = d3
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
  const area = d3
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
      return Constants.COLORS[i];
    })
    .attr('opacity', 0.75)
    .attr('d', area);
}
