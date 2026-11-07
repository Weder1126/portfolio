console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 2 (replaced by Step 3, which marks the current link while building the nav)
// let navLinks = $$('nav a');
// let currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname,
// );
// currentLink?.classList.add('current');

// Step 3: automatic navigation menu
const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/' // Local server
    : '/portfolio/'; // GitHub Pages repo name

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'meta/', title: 'Meta' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/Weder1126', title: 'GitHub' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = !p.url.startsWith('http') ? BASE_PATH + p.url : p.url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = p.title;

  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );
  if (a.host !== location.host) {
    a.target = '_blank';
  }

  nav.append(a);
}

// Step 4: dark mode switch
let prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;

document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic (${prefersDark ? 'Dark' : 'Light'})</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

// Step 5: better contact form (percent-encode fields instead of using "+")
let form = document.querySelector('form');

form?.addEventListener('submit', function (event) {
  event.preventDefault();

  let data = new FormData(form);
  let params = [];

  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }

  let url = `${form.action}?${params.join('&')}`;
  location.href = url;
});

// Lab 4, Step 1.2: load a JSON file (local or from an API)
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
    return null;
  }
}

// Paths in projects.json are relative to the site root, so they work on any page
function resolveUrl(path) {
  return /^https?:\/\//.test(path) ? path : BASE_PATH + path;
}

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

function createProjectArticle(project, headingLevel) {
  const article = document.createElement('article');

  const heading = document.createElement(headingLevel);
  const title = project.title ?? 'Untitled project';
  if (project.url) {
    const link = document.createElement('a');
    link.href = resolveUrl(project.url);
    link.textContent = title;
    if (link.host !== location.host) {
      link.target = '_blank';
    }
    heading.append(link);
  } else {
    heading.textContent = title;
  }

  const img = document.createElement('img');
  img.src = resolveUrl(project.image ?? 'https://dsc106.com/labs/lab02/images/empty.svg');
  img.alt = project.alt ?? '';

  const text = document.createElement('div');
  const description = document.createElement('p');
  description.textContent = project.description ?? '';
  text.append(description);
  if (project.year) {
    const year = document.createElement('p');
    year.className = 'project-year';
    year.textContent = `c. ${project.year}`;
    text.append(year);
  }

  article.append(heading, img, text);
  return article;
}

// Lab 4, Step 1.4: draw a list of projects into a container
export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!(containerElement instanceof Element)) {
    console.error('renderProjects: containerElement is not a DOM element', containerElement);
    return;
  }

  const level = HEADING_LEVELS.includes(headingLevel) ? headingLevel : 'h2';
  if (level !== headingLevel) {
    console.warn(`renderProjects: "${headingLevel}" is not a heading, using h2`);
  }

  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'projects-empty';
    empty.textContent = 'No projects match.';
    containerElement.append(empty);
    return;
  }

  for (const project of projects) {
    containerElement.appendChild(createProjectArticle(project, level));
  }
}

// Lab 4, Step 3.2: public profile data from the GitHub API
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
}
