/**
 * Main JavaScript file for rendering content on the website
 */

let detailIdCounter = 0;
const detailToggleRegistry = [];

function closeOtherDetails(activeToggle) {
  detailToggleRegistry.forEach(({ toggle, content, label }) => {
    if (toggle !== activeToggle && toggle.getAttribute('aria-expanded') === 'true') {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = label;
      content.hidden = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Homepage: single selected papers list (preprints + conference papers, both filtered to isSelected)
  if (document.getElementById('selected-papers-list')) {
    const selected = [...getSelectedPreprints(), ...getSelectedPublications()];
    populatePublications(selected, 'selected-papers-list');
  }

  // Full publications page: every paper, grouped by year, with topic, type and authorship filters
  const publicationIndex = document.getElementById('publication-index');
  if (publicationIndex) {
    renderPublicationIndex(publicationIndex);
  }

  // Other sections (used on homepage or other pages if present)
  populateProjects();
  populateResearchExperience();
  populateAcademicServices();
  populateTeaching();
  populateTalks();
  populateHonors();

  // Initialize dark mode toggle
  initializeDarkMode();

  // Initialize back to top button
  initializeBackToTop();

  // Update last modified time
  const lastModifiedElement = document.getElementById('last-modified-time');
  if (lastModifiedElement) {
    const lastModified = new Date(document.lastModified);
    const options = { year: 'numeric', month: 'long' };
    lastModifiedElement.textContent = `Last Modified: ${lastModified.toLocaleDateString('en-US', options)}`;
  }
});

/**
 * Populate publications in the specified list element
 */
function populatePublications(publications, listId) {
  const list = document.getElementById(listId);
  if (!list) return;

  publications.forEach(pub => {
    const li = document.createElement('li');
    li.dataset.topics = (pub.topics || []).join(' ');
    li.dataset.type = publicationType(pub);
    li.dataset.lead = String(isLeadAuthor(pub));

    const titleDiv = document.createElement('div');
    titleDiv.className = 'papertitle';
    titleDiv.innerHTML = (pub.isNew ? '<span class="new-badge">New</span>' : '') + pub.title;

    const restDiv = document.createElement('div');
    restDiv.className = 'paper_rest';
    restDiv.innerHTML = `${pub.authors}<br />`;

    const venueSpan = document.createElement('span');
    venueSpan.className = 'paper-venue';
    venueSpan.innerHTML = `<i>${pub.venue}</i>`;
    restDiv.appendChild(venueSpan);

    const linksWrapper = document.createElement('span');
    linksWrapper.className = 'paper-links';
    linksWrapper.appendChild(document.createTextNode('[ '));

    const linkElements = pub.links.map(link => {
      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.textContent = link.text;
      if (/^https?:\/\//i.test(link.url)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener';
      }
      return anchor;
    });

    const createDetailToggle = (label, contentValue, fallbackText, baseClass) => {
      const container = document.createElement('div');
      container.className = `${baseClass}-container detail-container`;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `${baseClass}-toggle detail-toggle`;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = label;

      const content = document.createElement('div');
      content.className = `${baseClass}-content detail-content`;
      const hasContent = typeof contentValue === 'string' && contentValue.trim().length > 0;
      content.innerHTML = hasContent ? contentValue : fallbackText;
      content.hidden = true;
      const contentId = `detail-content-${detailIdCounter++}`;
      content.id = contentId;
      content.setAttribute('role', 'region');
      content.setAttribute('aria-label', `${pub.title} ${label.toLowerCase()}`);
      toggle.setAttribute('aria-controls', contentId);

      toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        if (!isExpanded) {
          closeOtherDetails(toggle);
        }
        const nextState = !isExpanded;
        toggle.setAttribute('aria-expanded', String(nextState));
        content.hidden = !nextState;
        toggle.textContent = nextState ? `Hide ${label}` : label;
      });

      container.appendChild(content);
      detailToggleRegistry.push({ toggle, content, label });
      return { container, toggle };
    };

    const { container: abstractContainer, toggle: abstractToggle } =
      createDetailToggle('Abstract', pub.abstract, 'Abstract coming soon.', 'abstract');
    const { container: citationContainer, toggle: citationToggle } =
      createDetailToggle('Citation', pub.citation, 'Citation coming soon.', 'citation');

    const interactiveItems = [];
    if (linkElements.length > 0) {
      interactiveItems.push(linkElements[0]);
    }
    interactiveItems.push(abstractToggle);
    if (linkElements.length > 1) {
      linkElements.slice(1).forEach(linkElement => {
        interactiveItems.push(linkElement);
      });
    }
    interactiveItems.push(citationToggle);

    interactiveItems.forEach((item, index) => {
      if (index > 0) {
        linksWrapper.appendChild(document.createTextNode(' | '));
      }
      linksWrapper.appendChild(item);
    });
    linksWrapper.appendChild(document.createTextNode(' ]'));

    restDiv.appendChild(document.createTextNode(' '));
    restDiv.appendChild(linksWrapper);

    const bottomSpaceDiv = document.createElement('div');
    bottomSpaceDiv.className = 'paper_bottom_space';

    li.appendChild(titleDiv);
    li.appendChild(restDiv);
    li.appendChild(abstractContainer);
    li.appendChild(citationContainer);
    li.appendChild(bottomSpaceDiv);
    list.appendChild(li);
  });
}

const PUBLICATION_TYPES = [
  { id: 'conference', label: 'Conference & journal' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'preprint', label: 'Preprint' }
];

/** 'preprint', 'workshop', or 'conference' (conference and journal papers). */
function publicationType(pub) {
  if (pub.isPreprint) return 'preprint';
  return /workshop/i.test(pub.venue) ? 'workshop' : 'conference';
}

/** The year printed in the venue, e.g. 2026 for "SPOT Workshop, ICLR 2026" or "arXiv preprint 2026". */
function publicationYear(pub) {
  const years = pub.venue.match(/(?:19|20)\d{2}/g);
  return years ? Number(years[years.length - 1]) : 0;
}

/** First author, or co-first author (the name carries the equal-contribution mark). */
function isLeadAuthor(pub) {
  return /^<b>Xunjian Yin/.test(pub.authors) || /<b>Xunjian Yin\*<\/b>|<b>Xunjian Yin<\/b>\*/.test(pub.authors);
}

/**
 * Render the publications page: year sections (published papers first, then preprints,
 * data.js order within each), filter rows for topic, type and authorship, and a status
 * line. The filter state is kept in the query string (?topic=…&type=…&author=lead).
 */
function renderPublicationIndex(container) {
  const filtersRoot = container.querySelector('[data-pub-filters]');
  const statusLine = container.querySelector('[data-pub-status]');
  const yearsRoot = container.querySelector('[data-pub-years]');
  const emptyLine = container.querySelector('[data-pub-empty]');

  const ordered = [...getPublications(), ...getPreprints()];
  const years = [...new Set(ordered.map(publicationYear))].sort((a, b) => b - a);
  years.forEach(year => {
    const section = document.createElement('section');
    section.className = 'pub-year';
    section.innerHTML = `<h2 class="pub-year-heading">${year}</h2><ul id="pubs-${year}" class="publication-list"></ul>`;
    yearsRoot.appendChild(section);
    populatePublications(ordered.filter(pub => publicationYear(pub) === year), `pubs-${year}`);
  });

  const facets = [
    { key: 'topic', param: 'topic', label: 'Topic', options: PUBLICATION_TOPICS, matches: (pub, id) => (pub.topics || []).includes(id) },
    { key: 'type', param: 'type', label: 'Type', options: PUBLICATION_TYPES, matches: (pub, id) => publicationType(pub) === id },
    { key: 'lead', param: 'author', label: 'Author', options: [{ id: 'true', label: 'First or co-first' }], matches: (pub, id) => String(isLeadAuthor(pub)) === id }
  ];
  // A rendered paper matches a facet when the facet is "all" or the paper carries the chosen value.
  const itemMatches = {
    topic: (li, id) => li.dataset.topics.split(' ').includes(id),
    type: (li, id) => li.dataset.type === id,
    lead: (li, id) => li.dataset.lead === id
  };
  const params = new URLSearchParams(window.location.search);
  const state = {};
  facets.forEach(facet => {
    const requested = facet.key === 'lead' ? (params.get(facet.param) === 'lead' ? 'true' : 'all') : params.get(facet.param);
    state[facet.key] = facet.options.some(option => option.id === requested) ? requested : 'all';
  });

  facets.forEach(facet => {
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Filter by ${facet.label.toLowerCase()}`);
    const label = document.createElement('span');
    label.className = 'filter-label';
    label.textContent = facet.label;
    row.appendChild(label);
    [{ id: 'all', label: 'All' }, ...facet.options].forEach(option => {
      const count = option.id === 'all' ? ordered.length : ordered.filter(pub => facet.matches(pub, option.id)).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-option';
      button.dataset.key = facet.key;
      button.dataset.value = option.id;
      button.innerHTML = `${option.label}<span class="filter-count">${count}</span>`;
      button.addEventListener('click', () => { state[facet.key] = option.id; apply(); });
      row.appendChild(button);
    });
    filtersRoot.appendChild(row);
  });

  function apply() {
    let shown = 0;
    yearsRoot.querySelectorAll('.pub-year').forEach(section => {
      let visible = 0;
      section.querySelectorAll('.publication-list > li').forEach(li => {
        const match = ['topic', 'type', 'lead'].every(key => state[key] === 'all' || itemMatches[key](li, state[key]));
        li.hidden = !match;
        if (match) visible++;
      });
      section.hidden = visible === 0;
      shown += visible;
    });
    filtersRoot.querySelectorAll('.filter-option').forEach(button => {
      button.setAttribute('aria-pressed', String(state[button.dataset.key] === button.dataset.value));
    });
    const topic = PUBLICATION_TOPICS.find(option => option.id === state.topic);
    statusLine.innerHTML = `${shown === ordered.length ? `${shown} papers` : `${shown} of ${ordered.length} papers`}`
      + (topic ? `<span class="filter-question">${topic.question}</span>` : '')
      + '<span class="filter-note">* Equal contribution</span>';
    emptyLine.hidden = shown > 0;

    const query = new URLSearchParams();
    if (state.topic !== 'all') query.set('topic', state.topic);
    if (state.type !== 'all') query.set('type', state.type);
    if (state.lead !== 'all') query.set('author', 'lead');
    const search = query.toString();
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
  }
  apply();
}

/**
 * Populate projects (only selected ones for homepage)
 */
function populateProjects() {
  const list = document.getElementById('projects-list');
  if (!list) return;

  getSelectedProjects().forEach(project => {
    const li = document.createElement('li');
    // The repository named by the project's shields.io star badge, e.g. "Arvid-pku/Godel_Agent".
    const starBadge = project.badges.find(b => b.img.includes('/github/stars/'));
    const repo = starBadge ? starBadge.img.split('/github/stars/')[1].split(/[?#]/)[0] : '';
    const stars = repo ? ` <a class="project-stars" href="https://github.com/${repo}" target="_blank" rel="noopener" hidden></a>` : '';
    const name = project.url ? `<a class="project-link" href="${project.url}" target="_blank" rel="noopener">${project.title}</a>` : project.title;
    li.innerHTML = `<strong>${name}</strong>${stars}<br>${project.description}`;
    list.appendChild(li);
    if (repo) renderStarCount(li.querySelector('.project-stars'), repo);
  });
}

/**
 * Show a repository's GitHub star count as plain text ("★ 228").
 * Counts come from the GitHub API and are cached for the browser session;
 * if the request fails, the element stays hidden.
 */
function renderStarCount(element, repo) {
  const key = `github-stars:${repo}`;
  const show = count => {
    const label = count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(count);
    element.textContent = `\u2605 ${label}`;
    element.setAttribute('aria-label', `${count} GitHub stars`);
    element.hidden = false;
  };
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (cached && typeof cached.count === 'number') { show(cached.count); return; }
  } catch (error) { /* storage unavailable */ }
  fetch(`https://api.github.com/repos/${repo}`)
    .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then(data => {
      if (typeof data.stargazers_count !== 'number') return;
      show(data.stargazers_count);
      try { sessionStorage.setItem(key, JSON.stringify({ count: data.stargazers_count })); } catch (error) { /* storage unavailable */ }
    })
    .catch(() => { /* leave the count hidden */ });
}

/**
 * Populate research experience
 */
function populateResearchExperience() {
  const list = document.getElementById('research-experience-list');
  if (!list) return;

  researchExperience.forEach(exp => {
    const li = document.createElement('li');
    li.innerHTML = `
      <p>
        <strong>${exp.period},   ${exp.institution}</strong><br>
        ${exp.mentorLabel || 'Mentor'}: ${exp.mentor}<br>
        ${exp.description}
      </p>
    `;
    list.appendChild(li);
  });
}

/**
 * Populate academic services
 */
function populateAcademicServices() {
  const list = document.getElementById('academic-services-list');
  if (!list) return;

  academicServices.forEach(service => {
    const li = document.createElement('li');
    li.innerHTML = `<p>${service}</p>`;
    list.appendChild(li);
  });
}

/**
 * Populate teaching
 */
function populateTeaching() {
  const list = document.getElementById('teaching-list');
  if (!list) return;

  teaching.forEach(teachingItem => {
    const li = document.createElement('li');
    li.innerHTML = `<p>${teachingItem}</p>`;
    list.appendChild(li);
  });
}

/**
 * Populate talks
 */
function populateTalks() {
  const list = document.getElementById('talks-list');
  if (!list) return;

  talks.forEach(talk => {
    const li = document.createElement('li');
    const attachmentLinks = talk.attachments.map(attachment =>
      `<a href="${attachment.url}" target="_blank">${attachment.text}</a>`
    ).join(' | ');

    li.innerHTML = `<p>${talk.title}, ${talk.venue}, ${talk.date} [ ${attachmentLinks} ]</p>`;
    list.appendChild(li);
  });
}

/**
 * Populate honors
 */
function populateHonors() {
  const list = document.getElementById('honors-list');
  if (!list) return;

  honors.forEach(honor => {
    const li = document.createElement('li');
    li.innerHTML = `<p>${honor}</p>`;
    list.appendChild(li);
  });
}
