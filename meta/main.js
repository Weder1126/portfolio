import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
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

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  for (const [label, value] of computeStats(data, commits)) {
    const item = dl.append('div');
    item.append('dt').html(label);
    item.append('dd').text(value);
  }
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
    .attr('transform', `translate(0, ${USABLE.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('transform', `translate(${USABLE.left}, 0)`)
    .call(
      d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
    );
}

function drawDots(svg, commits) {
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  // Step 4.2: sqrt scale so area, not radius, tracks lines edited
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 30]);
  // Step 4.3: big dots first, so small ones end up on top
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  svg
    .append('g')
    .attr('class', 'dots')
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
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
function renderScatterPlot(commits) {
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([USABLE.left, USABLE.right])
    .nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([USABLE.bottom, USABLE.top]);

  drawAxes(svg);
  drawDots(svg, commits);

  // Step 5.1 + 5.2: brush, then raise dots above its overlay so tooltips still work
  svg.call(d3.brush().on('start brush end', (event) => brushed(event, commits)));
  svg.select('.dots').raise();
}

// Step 5.4
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function brushed(event, commits) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(selection, d));
  const selected = commits.filter((d) => isCommitSelected(selection, d));
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

async function main() {
  try {
    const data = await loadData();
    const commits = processCommits(data);
    renderCommitInfo(data, commits);
    renderScatterPlot(commits);
  } catch (error) {
    console.error('Failed to load or draw commit data:', error);
    document.getElementById('stats').insertAdjacentHTML(
      'beforeend',
      '<p>Could not load the commit data.</p>',
    );
  }
}

main();
