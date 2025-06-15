/**
 * Main JavaScript file for rendering content on the website
 * This file contains all formatting and rendering functions
 */

// Wait for DOM to be ready before manipulating
document.addEventListener('DOMContentLoaded', function() {
  // Add publication styles to ensure consistent indentation
  const publicationStyles = `
    .publication-list {
      list-style-type: disc;
      padding-left: 30px;
      margin: 0 auto 20px;
    }
    .publication-list li {
      margin-bottom: 16px;
    }
    .papertitle {
      margin-bottom: 6px;
    }
    .paper_rest {
      margin-bottom: 6px;
    }
  `;
  
  // Apply the styles
  const styleEl = document.createElement('style');
  styleEl.textContent = publicationStyles;
  document.head.appendChild(styleEl);
  
  // Populate publications and other sections
  populatePublications(getSelectedPreprints(), 'preprints-list');
  populatePublications(getSelectedPublications(), 'selected-publications-list');
  populateProjects();
  populateResearchExperience();
  populateAcademicServices();
  populateTeaching();
  populateHonors();
  
  // Add smooth scrolling to outline links
  document.querySelectorAll('#outline-list a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        // Get the offsetTop of the table that contains the section heading
        const tableContainer = targetElement.closest('table');
        if (tableContainer) {
          window.scrollTo({
            top: tableContainer.offsetTop - 50,
            behavior: 'smooth'
          });
        } else {
          // Fallback if table not found
          window.scrollTo({
            top: targetElement.offsetTop - 50,
            behavior: 'smooth'
          });
        }
      }
    });
  });
  
  // Update last modified time
  const lastModified = new Date(document.lastModified);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = lastModified.toLocaleDateString('en-US', options);
  const lastModifiedElement = document.getElementById('last-modified-time');
  if (lastModifiedElement) {
    lastModifiedElement.textContent = `Last Modified: ${formattedDate}`;
  }
});

/**
 * Function to populate publications in the specified list element
 * @param {Array} publications - Array of publication objects
 * @param {string} listId - ID of the ul element to populate
 */
function populatePublications(publications, listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  
  publications.forEach(pub => {
    const li = document.createElement('li');
    
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
    li.appendChild(titleDiv);
    li.appendChild(restDiv);
    li.appendChild(bottomSpaceDiv);
    list.appendChild(li);
  });
}

/**
 * Function to populate projects (only selected ones for homepage)
 */
function populateProjects() {
  const list = document.getElementById('projects-list');
  if (!list) return;
  
  getSelectedProjects().forEach(project => {
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
 * Function to populate academic services
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