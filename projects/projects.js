import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = (await fetchJSON('../lib/projects.json')) ?? [];
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');

// Lab 4, Step 1.6: the count updates by itself when projects.json changes
if (projectsTitle) {
  projectsTitle.textContent = `${projects.length} Projects`;
}

// Both filters live here. Every change goes through applyFilters(), so the
// search and the selected year always combine (Lab 5, Step 5.4 fix).
let query = '';
let selectedYear = null; // a year label like '2026', or null for "all years"

// Give each year a fixed color, so a year keeps its color when the pie is filtered
const allYears = [...new Set(projects.map((p) => p.year))].sort();
const colors = d3.scaleOrdinal(allYears, d3.schemeTableau10);

const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().value((d) => d.value).sort(null);

function matchesQuery(project, text) {
  const values = Object.values(project).join('\n').toLowerCase();
  return values.includes(text.toLowerCase());
}

function countByYear(projectsGiven) {
  return d3
    .rollups(projectsGiven, (v) => v.length, (d) => d.year)
    .map(([year, count]) => ({ label: year, value: count }))
    .sort((a, b) => d3.ascending(a.label, b.label));
}

function toggleYear(year) {
  selectedYear = selectedYear === year ? null : year;
  applyFilters();
}

function renderPieChart(projectsGiven) {
  const data = countByYear(projectsGiven);
  const arcs = sliceGenerator(data).map((d) => arcGenerator(d));

  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  data.forEach((d, i) => {
    const isSelected = d.label === selectedYear;
    const label = `${d.label}: ${d.value} project${d.value === 1 ? '' : 's'}`;

    svg
      .append('path')
      .attr('d', arcs[i])
      .attr('fill', colors(d.label))
      .attr('class', isSelected ? 'selected' : null)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-pressed', isSelected)
      .attr('aria-label', label)
      .on('click', () => toggleYear(d.label))
      .on('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleYear(d.label);
        }
      })
      .append('title')
      .text(label);

    legend
      .append('li')
      .attr('style', `--color:${colors(d.label)}`)
      .attr('class', isSelected ? 'legend-item selected' : 'legend-item')
      .on('click', () => toggleYear(d.label))
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

function applyFilters() {
  // The pie shows every year that matches the search, so you can switch years
  const searched = projects.filter((p) => matchesQuery(p, query));
  // The list also applies the selected year on top of the search
  const visible =
    selectedYear === null ? searched : searched.filter((p) => p.year === selectedYear);

  renderPieChart(searched);
  renderProjects(visible, projectsContainer, 'h2');
}

searchInput?.addEventListener('input', (event) => {
  query = event.target.value;
  applyFilters();
});

applyFilters();
