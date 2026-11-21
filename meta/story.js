import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';
import { computeFiles } from './files.js';

function formatWhen(commit) {
  return commit.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' });
}

function commitLink(commit, text) {
  return `<a href="${commit.url}" target="_blank" rel="noopener">${text}</a>`;
}

// Lab 8, Step 3.2: one paragraph per commit
function scatterStepHtml(commit, i) {
  const fileCount = d3.rollups(commit.lines, (v) => v.length, (d) => d.file).length;
  const linkText = i === 0 ? 'my first commit, and it was glorious' : 'another glorious commit';
  return `<p>On ${formatWhen(commit)}, I made ${commitLink(commit, linkText)}.
    I edited ${commit.totalLines} lines across ${fileCount} files.
    Then I looked over all I had made, and I saw that it was very good.</p>`;
}

// Lab 8, Step 4: the same commits, told through file sizes
function filesStepHtml(commit, i, commits) {
  const files = computeFiles(commits.slice(0, i + 1));
  const totalLines = d3.sum(files, (d) => d.lines.length);
  const biggest = files[0];
  return `<p>By ${formatWhen(commit)}, after ${commitLink(commit, `commit ${commit.id}`)},
    the site had ${totalLines} lines across ${files.length} files.
    The biggest was <code>${biggest.name}</code> with ${biggest.lines.length} lines.</p>`;
}

function renderSteps(selector, commits, toHtml) {
  d3.select(selector)
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    // d3 passes (datum, index, nodes); the step text needs the commit list instead
    .html((commit, i) => toHtml(commit, i, commits));
}

// Lab 8, Step 3.3: tell the page which commit just scrolled into view
function watchSteps(container, onCommitEnter) {
  scrollama()
    .setup({ container, step: `${container} .step` })
    .onStepEnter((response) => onCommitEnter(response.element.__data__));
}

export function setupStories(commits, onCommitEnter) {
  renderSteps('#scatter-story', commits, scatterStepHtml);
  renderSteps('#files-story', commits, filesStepHtml);
  watchSteps('#scrolly-1', onCommitEnter);
  watchSteps('#scrolly-2', onCommitEnter);
}
