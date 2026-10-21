// Interactive companion to Figures 1 and 2: the same 178 countries, with the
// axis scale, breakpoint and U.S. outlier under the reader's control.

const DATA_URL = 'countries_2018.csv';
const FOCUS_CODE = 'USA';
const DAYS_PER_YEAR = 365.25;
const WIDTH = 760;
const HEIGHT = 420;
const MARGIN = { top: 16, right: 24, bottom: 48, left: 52 };
const SPEND_DOMAIN = [15, 11200];
const LIFE_DOMAIN = [50, 88];
const LOG_TICKS = [25, 100, 400, 1600, 6400];
const LINEAR_TICKS = [0, 2000, 4000, 6000, 8000, 10000];
const LINE_SAMPLES = 80;
const DURATION = 750;
const COLORS = {
  dot: '#b9b8b1',
  focus: '#0b0b0b',
  logFit: '#2a78d6',
  below: '#898781',
  above: '#eb6834',
  grid: '#e1e0d9',
  text: '#52514e',
};

const usd = (value) => `$${d3.format(',.0f')(value)}`;
const corr = (r) => d3.format('.2f')(r).replace('-', '−');

// Least-squares line of y on x; null when x has no spread.
function fitLine(points, x, y) {
  const n = points.length;
  if (n < 2) return null;
  const meanX = d3.mean(points, x);
  const meanY = d3.mean(points, y);
  const sxx = d3.sum(points, (d) => (x(d) - meanX) ** 2);
  const syy = d3.sum(points, (d) => (y(d) - meanY) ** 2);
  const sxy = d3.sum(points, (d) => (x(d) - meanX) * (y(d) - meanY));
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: meanY - slope * meanX, r: syy ? sxy / Math.sqrt(sxx * syy) : 0, n };
}

function describeFits(rows, breakpoint) {
  const log2 = (d) => Math.log2(d.spend);
  const life = (d) => d.life;
  const spend = (d) => d.spend;
  const below = rows.filter((d) => d.spend < breakpoint);
  const above = rows.filter((d) => d.spend >= breakpoint);
  return {
    log: { fit: fitLine(rows, log2, life), extent: d3.extent(rows, spend) },
    below: { fit: fitLine(below, spend, life), extent: d3.extent(below, spend) },
    above: { fit: fitLine(above, spend, life), extent: d3.extent(above, spend) },
  };
}

// Sample a fitted line so it bends correctly on either axis scale.
function samplePath(extent, predict) {
  const [lo, hi] = extent;
  if (lo === undefined) return [];
  return d3.range(LINE_SAMPLES + 1).map((i) => {
    const spend = lo * (hi / lo) ** (i / LINE_SAMPLES);
    return { spend, life: predict(spend) };
  });
}

function buildChart(container) {
  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
    .attr('role', 'img')
    .attr('aria-label', 'Scatter plot of health spending per person against life expectancy for 178 countries');
  const y = d3.scaleLinear(LIFE_DOMAIN, [HEIGHT - MARGIN.bottom, MARGIN.top]);

  svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).tickValues([50, 60, 70, 80]).tickSize(-(WIDTH - MARGIN.left - MARGIN.right)))
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('line').attr('stroke', COLORS.grid))
    .call((g) => g.selectAll('text').attr('fill', COLORS.text));
  svg
    .append('text')
    .attr('transform', `translate(14,${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', COLORS.text)
    .text('Life expectancy (years)');

  return {
    svg,
    y,
    xAxis: svg.append('g').attr('transform', `translate(0,${HEIGHT - MARGIN.bottom})`),
    xLabel: svg
      .append('text')
      .attr('x', (MARGIN.left + WIDTH - MARGIN.right) / 2)
      .attr('y', HEIGHT - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.text),
    lines: svg.append('g').attr('fill', 'none').attr('stroke-linecap', 'round'),
    dots: svg.append('g'),
    breakLine: svg
      .append('line')
      .attr('y1', MARGIN.top)
      .attr('y2', HEIGHT - MARGIN.bottom)
      .attr('stroke', COLORS.above)
      .attr('stroke-dasharray', '4 4'),
  };
}

function xScaleFor(kind) {
  const range = [MARGIN.left, WIDTH - MARGIN.right];
  return kind === 'log'
    ? d3.scaleLog(SPEND_DOMAIN, range).base(2)
    : d3.scaleLinear([0, SPEND_DOMAIN[1]], range);
}

function drawAxis(chart, x, kind) {
  const ticks = kind === 'log' ? LOG_TICKS : LINEAR_TICKS;
  chart.xAxis
    .transition()
    .duration(DURATION)
    .call(d3.axisBottom(x).tickValues(ticks).tickFormat(usd).tickSizeOuter(0))
    .call((g) => g.selectAll('text').attr('fill', COLORS.text));
  chart.xLabel.text(kind === 'log' ? 'Health spending per person (log scale)' : 'Health spending per person');
}

function drawLines(chart, x, fits) {
  const line = d3
    .line()
    .x((d) => x(d.spend))
    .y((d) => chart.y(d.life));
  const segments = [
    { key: 'log', color: COLORS.logFit, ...fits.log, x: Math.log2 },
    { key: 'below', color: COLORS.below, ...fits.below, x: (v) => v },
    { key: 'above', color: COLORS.above, ...fits.above, x: (v) => v },
  ].filter((s) => s.fit);
  chart.lines
    .selectAll('path')
    .data(segments, (s) => s.key)
    .join('path')
    .attr('stroke', (s) => s.color)
    .attr('stroke-width', (s) => (s.key === 'log' ? 2 : 2.4))
    .transition()
    .duration(DURATION)
    .attr('d', (s) => line(samplePath(s.extent, (v) => s.fit.intercept + s.fit.slope * s.x(v))));
}

function drawDots(chart, x, rows) {
  chart.dots
    .selectAll('circle')
    .data(rows, (d) => d.code)
    .join(
      (enter) =>
        enter
          .append('circle')
          .attr('r', 0)
          .attr('stroke', 'white')
          .call((c) => c.append('title')),
      (update) => update,
      (exit) => exit.transition().duration(DURATION / 2).attr('r', 0).remove(),
    )
    .attr('fill', (d) => (d.code === FOCUS_CODE ? COLORS.focus : COLORS.dot))
    .call((c) => c.select('title').text((d) => `${d.country}: ${d.life.toFixed(1)} years on ${usd(d.spend)}`))
    .transition()
    .duration(DURATION)
    .attr('cx', (d) => x(d.spend))
    .attr('cy', (d) => chart.y(d.life))
    .attr('r', (d) => (d.code === FOCUS_CODE ? 5.5 : 4));
}

function readout(fits, breakpoint, rowCount) {
  const parts = [`<strong>${rowCount} countries.</strong>`];
  const log = fits.log.fit;
  if (log) {
    parts.push(
      `<span style="color:${COLORS.logFit}">Log fit: +${log.slope.toFixed(2)} years per doubling (r = ${corr(log.r)}).</span>`,
    );
  }
  const above = fits.above.fit;
  if (above) {
    const days = above.slope * 1000 * DAYS_PER_YEAR;
    const sign = days >= 0 ? '+' : '−';
    parts.push(
      `<span style="color:#b4461b">Above ${usd(breakpoint)} (${above.n} countries): ${sign}${Math.abs(days).toFixed(0)} days per extra $1,000 (r = ${corr(above.r)}).</span>`,
    );
  }
  return parts.join(' ');
}

function init(rows) {
  const chart = buildChart('#explorer-chart');
  let state = { scale: 'log', breakpoint: 2000, dropFocus: false };
  const buttons = d3.selectAll('.explorer-controls button[data-scale]');
  const slider = d3.select('#explorer-break');
  const sliderValue = d3.select('#explorer-break-value');

  function render() {
    const visible = state.dropFocus ? rows.filter((d) => d.code !== FOCUS_CODE) : rows;
    const fits = describeFits(visible, state.breakpoint);
    const x = xScaleFor(state.scale);
    buttons.attr('aria-pressed', function () {
      return String(this.dataset.scale === state.scale);
    });
    sliderValue.text(usd(state.breakpoint));
    drawAxis(chart, x, state.scale);
    drawLines(chart, x, fits);
    drawDots(chart, x, visible);
    chart.breakLine.transition().duration(DURATION).attr('x1', x(state.breakpoint)).attr('x2', x(state.breakpoint));
    d3.select('#explorer-readout').html(readout(fits, state.breakpoint, visible.length));
  }

  buttons.on('click', function () {
    state = { ...state, scale: this.dataset.scale };
    render();
  });
  slider.on('input', function () {
    state = { ...state, breakpoint: Number(this.value) };
    render();
  });
  d3.select('#explorer-drop-us').on('change', function () {
    state = { ...state, dropFocus: this.checked };
    render();
  });
  render();
}

function parseRow(d) {
  const spend = Number(d.spend);
  const life = Number(d.life);
  return Number.isFinite(spend) && spend > 0 && Number.isFinite(life)
    ? { country: d.country, code: d.code, spend, life }
    : null;
}

d3.csv(DATA_URL, parseRow)
  .then((rows) => {
    if (!rows.length) throw new Error('no usable rows');
    init(rows);
  })
  .catch((error) => {
    console.error('Explorer failed to load', error);
    d3.select('#explorer-chart').text('The interactive chart could not load its data.');
  });
