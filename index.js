import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const GITHUB_USERNAME = 'Weder1126';
const LATEST_COUNT = 3;

const projects = await fetchJSON('./lib/projects.json');
const latestProjects = (projects ?? []).slice(0, LATEST_COUNT);
const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h3');

const profileStats = document.querySelector('#profile-stats');
const githubData = await fetchGitHubData(GITHUB_USERNAME);

if (profileStats) {
  profileStats.innerHTML = githubData
    ? `
      <h2>My GitHub Stats</h2>
      <dl>
        <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
        <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
        <dt>Followers</dt><dd>${githubData.followers}</dd>
        <dt>Following</dt><dd>${githubData.following}</dd>
      </dl>`
    : `
      <h2>My GitHub Stats</h2>
      <p>Couldn't load GitHub data right now. Try refreshing in a minute.</p>`;
}
