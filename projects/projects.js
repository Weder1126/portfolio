import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

renderProjects(projects ?? [], projectsContainer, 'h2');

// Step 1.6: the count updates by itself when projects.json changes
if (projectsTitle) {
  projectsTitle.textContent = `${projects?.length ?? 0} Projects`;
}
