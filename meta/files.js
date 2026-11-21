import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Lab 8, Step 2.1 + 2.3: one entry per file, biggest first
export function computeFiles(commits) {
  const lines = commits.flatMap((d) => d.lines);
  return d3
    .groups(lines, (d) => d.file)
    .map(([name, fileLines]) => ({ name, lines: fileLines }))
    .sort((a, b) => b.lines.length - a.lines.length);
}

// Lab 8, Step 2.4: one stable color per technology
export function createTypeColors(data) {
  const types = Array.from(new Set(data.map((d) => d.type))).sort();
  return d3.scaleOrdinal(d3.schemeTableau10).domain(types);
}

// Lab 8, Step 2: unit visualization, one dot per line of code
export function updateFileDisplay(commits, colors) {
  const filesContainer = d3
    .select('#files')
    .selectAll('div.file')
    .data(computeFiles(commits), (d) => d.name)
    .join((enter) =>
      enter.append('div').attr('class', 'file').call((div) => {
        div.append('dt');
        div.append('dd');
      }),
    )
    .order();

  filesContainer.select('dt').each(function (d) {
    const dt = d3.select(this);
    dt.selectAll('*').remove();
    dt.append('code').text(d.name);
    dt.append('small').text(`${d.lines.length} lines`);
  });

  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}
