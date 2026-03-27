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
  // Homepage: single selected papers list
  if (document.getElementById('selected-papers-list')) {
    const selected = [...getSelectedPreprints(), ...getSelectedPublications()];
    populatePublications(selected, 'selected-papers-list');
  }

  // Full publications page
  if (document.getElementById('preprints-list')) {
    populatePublications(getSelectedPreprints(), 'preprints-list');
  }
  if (document.getElementById('selected-publications-list')) {
    populatePublications(getSelectedPublications(), 'selected-publications-list');
  }

  // Other sections (used on homepage or other pages if present)
  populateProjects(false);
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

    const titleDiv = document.createElement('div');
    titleDiv.className = 'papertitle';
    titleDiv.innerHTML = (pub.isNew ? '<span style="color:red">New!</span>   ' : '') + pub.title;

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

/**
 * Populate projects (only selected ones for homepage)
 */
function populateProjects(showAllBadges) {
  const list = document.getElementById('projects-list');
  if (!list) return;

  getSelectedProjects().forEach(project => {
    const li = document.createElement('li');
    const badges = showAllBadges
      ? project.badges
      : project.badges.filter(b => b.img.includes('/github/stars/'));
    const badgeHtml = badges.map(badge =>
      `<a href="${badge.url}"><img alt="stars" src="${badge.img}" loading="lazy" style="vertical-align:middle;" /></a>`
    ).join(' ');
    li.innerHTML = `<strong>${project.title}</strong> ${badgeHtml}<br>${project.description}`;
    list.appendChild(li);
  });
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
        Mentor: ${exp.mentor}<br>
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
