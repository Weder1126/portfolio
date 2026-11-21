import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { createTypeColors, updateFileDisplay } from './files.js';
import { setupStories } from './story.js';

const REPO_URL = 'https://github.com/Weder1126/portfolio';
const WIDTH = 1000;
const HEIGHT = 600;
const MARGIN = { top: 10, right: 10, bottom: 30, left: 40 };
const USABLE = {
  left: MARGIN.left,
  right: WIDTH - MARGIN.right,
  top: MARGIN.top,
  bottom: HEIGHT - MARGIN.bottom,
  width: WIDTH - MARGIN.left - MARGIN.right,
  height: HEIGHT - MARGIN.top - MARGIN.bottom,
};

// Step 5.4: global so the brush logic can map pixels back to data
let xScale;
let yScale;
let rScale;

// Lab 8, Step 1: everything on the page is drawn from the commits up to commitMaxTime
const PROGRESS_MAX = 100;
let commits = [];
let filteredCommits = [];
let commitProgress = PROGRESS_MAX;
let commitMaxTime;
let timeScale;
let typeColors;
let brushSelection = null;

// Step 1.1: load loc.csv and convert numbers and dates
async function loadData() {
  return d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
}

// Step 1.2: one object per commit, with its lines kept as a hidden property
function processCommits(data) {
  const grouped = d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
    const { author, date, time, timezone, datetime } = lines[0];
    const ret = {
      id: commit,
      url: `${REPO_URL}/commit/${commit}`,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    Object.defineProperty(ret, 'lines', {
      value: lines,
      enumerable: false,
      writable: false,
      configurable: false,
    });

    return ret;
  });

  // Lab 8, Step 3.3: chronological, so the story reads in order
  return d3.sort(grouped, (d) => d.datetime);
}

function periodOfDay(hour) {
  if (hour < 6) return 'Night';
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

// Step 1.3: summary stats
function computeStats(data, commits) {
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const [busiestPeriod] = d3.greatest(
    d3.rollups(data, (v) => v.length, (d) => periodOfDay(d.datetime.getHours())),
    (d) => d[1],
  );
  const [busiestDay] = d3.greatest(
    d3.rollups(data, (v) => v.length, (d) =>
      d.datetime.toLocaleString('en', { weekday: 'long' }),
    ),
    (d) => d[1],
  );

  return [
    ['Total <abbr title="Lines of code">LOC</abbr>', data.length],
    ['Commits', commits.length],
    ['Files', d3.group(data, (d) => d.file).size],
    ['Longest file (lines)', d3.max(fileLengths, (d) => d[1])],
    ['Longest line (chars)', d3.max(data, (d) => d.length)],
    ['Average depth', d3.format('.2f')(d3.mean(data, (d) => d.depth))],
    ['Busiest time of day', busiestPeriod],
    ['Busiest weekday', busiestDay],
  ];
}

// Lab 8, Step 1.2: safe to call again whenever the filter changes
function renderCommitInfo(shownCommits) {
  const data = shownCommits.flatMap((d) => d.lines);
  if (data.length === 0) return;

  const items = d3
    .select('#stats')
    .selectAll('dl.stats')
    .data([null])
    .join('dl')
    .attr('class', 'stats')
    .selectAll('div')
    .data(computeStats(data, shownCommits))
    .join((enter) =>
      enter.append('div').call((div) => {
        div.append('dt');
        div.append('dd');
      }),
    );
  items.select('dt').html((d) => d[0]);
  items.select('dd').text((d) => d[1]);
}

// Step 3.1: fill the tooltip
function renderTooltipContent(commit) {
  if (!commit) return;
  const link = document.getElementById('commit-link');
  link.href = commit.url;
  link.textContent = commit.id;
  document.getElementById('commit-date').textContent =
    commit.datetime.toLocaleString('en', { dateStyle: 'full' });
  document.getElementById('commit-time').textContent =
    commit.datetime.toLocaleString('en', { timeStyle: 'short' });
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

// Step 3.3
function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

// Step 3.4: follow the cursor
function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

// Step 2.3: cooler colors at night, warmer during the day
function timeColor(hour) {
  const distanceFromNoon = Math.abs(hour - 12) / 12;
  return d3.interpolateRgb('#f4a261', '#3d5a80')(distanceFromNoon);
}

function drawAxes(svg) {
  // Step 2.3: gridlines first so they sit behind the dots
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${USABLE.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-USABLE.width));

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${USABLE.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${USABLE.left}, 0)`)
    .call(
      d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
    );
}

function drawDots(svg, shownCommits) {
  // Step 4.3: big dots first, so small ones end up on top
  const sortedCommits = d3.sort(shownCommits, (d) => -d.totalLines);

  svg
    .select('g.dots')
    .selectAll('circle')
    // Lab 8, Step 1.3: key by commit id so each circle stays the same commit
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .order()
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    // Lab 8, Step 1.4: lets CSS scale the entry animation with the dot's size
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => timeColor(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

// Step 2: scatterplot of commits by date and hour
function renderScatterPlot(allCommits) {
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(allCommits, (d) => d.datetime))
    .range([USABLE.left, USABLE.right])
    .nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([USABLE.bottom, USABLE.top]);
  // Step 4.2: sqrt scale so area, not radius, tracks lines edited.
  // Built from all commits so a dot keeps its size as the timeline moves.
  rScale = d3
    .scaleSqrt()
    .domain(d3.extent(allCommits, (d) => d.totalLines))
    .range([4, 30]);

  drawAxes(svg);
  svg.append('g').attr('class', 'dots');
  drawDots(svg, allCommits);

  // Step 5.1 + 5.2: brush, then raise dots above its overlay so tooltips still work
  svg.call(d3.brush().on('start brush end', brushed));
  svg.select('.dots').raise();
}

// Lab 8, Step 1.2: redraw inside the existing svg instead of appending a new one
function updateScatterPlot(shownCommits) {
  const svg = d3.select('#chart').select('svg');

  xScale = xScale.copy().domain(d3.extent(shownCommits, (d) => d.datetime)).nice();

  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  drawDots(svg, shownCommits);
  applyBrushSelection();
}

// Step 5.4
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function brushed(event) {
  brushSelection = event.selection;
  applyBrushSelection();
}

function applyBrushSelection() {
  d3.selectAll('#chart circle').classed('selected', (d) =>
    isCommitSelected(brushSelection, d),
  );
  const selected = filteredCommits.filter((d) => isCommitSelected(brushSelection, d));
  renderSelectionCount(selected);
  renderLanguageBreakdown(selected);
}

// Step 5.5
function renderSelectionCount(selected) {
  document.getElementById('selection-count').textContent =
    `${selected.length || 'No'} commits selected`;
}

// Step 5.6: share of lines by language among the selected commits
function renderLanguageBreakdown(selected) {
  const container = document.getElementById('language-breakdown');
  container.innerHTML = '';
  if (selected.length === 0) return;

  const lines = selected.flatMap((d) => d.lines);
  const breakdown = d3.rollup(lines, (v) => v.length, (d) => d.type);

  for (const [language, count] of breakdown) {
    const proportion = d3.format('.1~%')(count / lines.length);
    container.insertAdjacentHTML(
      'beforeend',
      `<div><dt>${language}</dt><dd>${count} lines (${proportion})</dd></div>`,
    );
  }
}

// Lab 8, Step 1: one place that redraws everything for a point in time
function showCommitsUntil(maxTime) {
  commitMaxTime = maxTime;
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  document.getElementById('commit-max-time').textContent = commitMaxTime.toLocaleString(
    'en',
    { dateStyle: 'long', timeStyle: 'short' },
  );
  renderCommitInfo(filteredCommits);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits, typeColors);
}

// Lab 8, Step 1.1
function onTimeSliderChange() {
  commitProgress = Number(document.getElementById('commit-progress').value);
  showCommitsUntil(timeScale.invert(commitProgress));
}

// Lab 8, Step 3.3: a story step scrolled into view; keep the slider in sync
function onCommitEnter(commit) {
  commitProgress = timeScale(commit.datetime);
  document.getElementById('commit-progress').value = commitProgress;
  showCommitsUntil(commit.datetime);
}

async function main() {
  try {
    const data = await loadData();
    commits = processCommits(data);
    filteredCommits = commits;
    typeColors = createTypeColors(data);
    timeScale = d3
      .scaleTime()
      .domain(d3.extent(commits, (d) => d.datetime))
      .range([0, PROGRESS_MAX]);

    renderScatterPlot(commits);
    document
      .getElementById('commit-progress')
      .addEventListener('input', onTimeSliderChange);
    onTimeSliderChange();
    setupStories(commits, onCommitEnter);
  } catch (error) {
    console.error('Failed to load or draw commit data:', error);
    document.getElementById('stats').insertAdjacentHTML(
      'beforeend',
      '<p>Could not load the commit data.</p>',
    );
  }
}

main();
