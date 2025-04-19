/**
 * Main JavaScript file for rendering content on the website
 * This file contains all formatting and rendering functions
 */

// Wait for DOM to be ready before manipulating
document.addEventListener('DOMContentLoaded', function() {
  // Populate publications and other sections
  populatePublications(preprints, 'preprints-tbody');
  populatePublications(selectedPublications, 'selected-publications-tbody');
  populateProjects();
  populateResearchExperience();
  populateTeaching();
  populateHonors();
  
  // Add smooth scrolling to outline links
  document.querySelectorAll('#outline-list a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 50,
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Update last modified time
  const lastModified = new Date(document.lastModified);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = lastModified.toLocaleDateString('en-US', options);
  document.getElementById('last-modified-time').textContent = `Last Modified: ${formattedDate}`;
});

/**
 * Function to populate publications in the specified tbody element
 * @param {Array} publications - Array of publication objects
 * @param {string} tbodyId - ID of the tbody element to populate
 */
function populatePublications(publications, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  
  publications.forEach(pub => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('valign', 'top');

    // Paper title with "New" badge if applicable
    const titleDiv = document.createElement('div');
    titleDiv.className = 'papertitle';
    titleDiv.innerHTML = (pub.isNew ? '<span style="color:red">New!</span>   ' : '') + pub.title;
    
    // Paper details (authors, venue, links)
    const restDiv = document.createElement('div');
    restDiv.className = 'paper_rest';
    restDiv.innerHTML = pub.authors + '<br />' +
      '<span style="color:#CC0000"><i>' + pub.venue + '</i></span>   [ ' +
      pub.links.map(link => `<a href="${link.url}">${link.text}</a>`).join(' | ') +
      ' ]';
    
    // Bottom spacing
    const bottomSpaceDiv = document.createElement('div');
    bottomSpaceDiv.className = 'paper_bottom_space';
    
    // Append elements
    td.appendChild(titleDiv);
    td.appendChild(restDiv);
    td.appendChild(bottomSpaceDiv);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

/**
 * Function to populate projects
 */
function populateProjects() {
  const list = document.getElementById('projects-list');
  if (!list) return;
  
  projects.forEach(project => {
    const li = document.createElement('li');
    li.innerHTML = `
      <p><strong>${project.title}</strong><br>${project.description}</p>
      <p>${project.badges.map(badge => 
        `<a href="${badge.url}"><img alt="${badge.img.split('-').slice(1).join(' ')}" src="${badge.img}" loading="lazy" /></a>`
      ).join(' ')}</p>
    `;
    list.appendChild(li);
  });
}

/**
 * Function to populate research experience
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
 * Function to populate teaching
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
 * Function to populate honors
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