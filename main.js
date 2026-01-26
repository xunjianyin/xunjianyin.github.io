/**
 * Main JavaScript file for rendering content on the website
 * This file contains all formatting and rendering functions
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

// Wait for DOM to be ready before manipulating
document.addEventListener('DOMContentLoaded', function() {
  // Populate publications and other sections
  populatePublications(getSelectedPreprints(), 'preprints-list');
  populatePublications(getSelectedPublications(), 'selected-publications-list');
  populateProjects();
  populateResearchExperience();
  populateAcademicServices();
  populateTeaching();
  populateTalks();
  populateHonors();
  
  // Initialize lazy loading for visitor map
  initializeLazyVisitorMap();
  
  // Copy citation functionality removed per user request
  
  // Initialize scroll progress indicator
  initializeScrollProgress();
  
  // Initialize dark mode toggle
  initializeDarkMode();

  // Initialize back to top button
  initializeBackToTop();
  
  // Initialize mobile hamburger menu
  initializeMobileMenu();
  
  // Initialize outline navigation
  initializeOutlineNavigation();
  
  // Update last modified time
  const lastModified = new Date(document.lastModified);
  const options = { year: 'numeric', month: 'long' };
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
    
    // Bottom spacing
    const bottomSpaceDiv = document.createElement('div');
    bottomSpaceDiv.className = 'paper_bottom_space';
    
    // Append elements
    li.appendChild(titleDiv);
    li.appendChild(restDiv);
    li.appendChild(abstractContainer);
    li.appendChild(citationContainer);
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
 * Function to populate talks
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

/**
 * Initialize lazy loading for visitor map
 */
function initializeLazyVisitorMap() {
  const placeholder = document.getElementById('visitor-map-placeholder');
  if (!placeholder) return;
  
  let mapLoaded = false;
  
  function loadVisitorMap() {
    if (mapLoaded) return;
    mapLoaded = true;
    
    // Replace placeholder with actual map
    placeholder.innerHTML = '';
    
    // Create script element for the visitor map (no need for email decode script)
    const mapScript = document.createElement('script');
    mapScript.type = 'text/javascript';
    mapScript.id = 'clstr_globe';
    mapScript.async = true;
    mapScript.src = '//clustrmaps.com/globe.js?d=FtefwNT63Wx_0gBCBN3XnQmRNAp1TN3HO-j7pLKNwo4';
    
    // Add error handling
    mapScript.onerror = function() {
      placeholder.innerHTML = '<span style="font-size:12px; color:var(--placeholder-text);">Map unavailable</span>';
    };
    
    placeholder.appendChild(mapScript);
  }
  
  // Load map on click
  placeholder.addEventListener('click', loadVisitorMap);
  
  // Load map when it comes into viewport (intersection observer)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadVisitorMap();
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    observer.observe(placeholder);
  } else {
    // Fallback for older browsers - load after 2 seconds
    setTimeout(loadVisitorMap, 2000);
  }
}



/**
 * Initialize scroll progress indicator
 */
function initializeScrollProgress() {
  const progressBar = document.getElementById('scroll-progress');
  if (!progressBar) return;
  
  function updateScrollProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / scrollHeight) * 100;
    
    progressBar.style.width = Math.min(scrollPercent, 100) + '%';
  }
  
  // Update on scroll with throttling
  let ticking = false;
  function handleScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateScrollProgress();
        ticking = false;
      });
      ticking = true;
    }
  }
  
  window.addEventListener('scroll', handleScroll);
  window.addEventListener('resize', updateScrollProgress);
  
  // Initial update
  updateScrollProgress();
}

// Dark mode functions are now in utils.js
// The functions initializeDarkMode() and updateThemeLabel() are loaded from utils.js

/**
 * Initialize mobile hamburger menu
 */
function initializeMobileMenu() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('outline-sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  
  if (!menuToggle || !sidebar || !overlay) {
    return;
  }
  
  // Toggle menu function
  function toggleMobileMenu() {
    const isActive = menuToggle.classList.contains('active');
    
    if (isActive) {
      // Close menu
      menuToggle.classList.remove('active');
      sidebar.classList.remove('mobile-active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    } else {
      // Open menu
      menuToggle.classList.add('active');
      sidebar.classList.add('mobile-active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
  }
  
  // Add event listeners
  menuToggle.addEventListener('click', toggleMobileMenu);
  overlay.addEventListener('click', toggleMobileMenu);
  
  // Close menu when clicking on sidebar links
  sidebar.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      toggleMobileMenu();
    }
  });
  
  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuToggle.classList.contains('active')) {
      toggleMobileMenu();
    }
  });
  
  // Close menu on window resize if it gets too wide
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && menuToggle.classList.contains('active')) {
      toggleMobileMenu();
    }
  });
}

/**
 * Initialize outline navigation with smooth scrolling
 */
function initializeOutlineNavigation() {
  document.querySelectorAll('#outline-list a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (!targetElement) {
        return;
      }

      const sectionContainer = targetElement.closest('.section-spacing');
      let scrollTarget = targetElement;

      if (sectionContainer) {
        scrollTarget = sectionContainer;
      } else {
        const tableContainer = targetElement.closest('table');
        if (tableContainer) {
          scrollTarget = tableContainer;
        }
      }

      const link = this;
      const scrollToTarget = () => {
        const rect = scrollTarget.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top - 100;

        window.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });

        history.pushState(null, '', targetId);
        link.blur();
      };

      const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
      if (mobileMenuToggle && mobileMenuToggle.classList.contains('active')) {
        const sidebar = document.getElementById('outline-sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');

        mobileMenuToggle.classList.remove('active');
        if (sidebar) {
          sidebar.classList.remove('mobile-active');
        }
        if (overlay) {
          overlay.classList.remove('active');
        }
        document.body.style.overflow = '';

        setTimeout(scrollToTarget, 50);
      } else {
        scrollToTarget();
      }
    });
  });
}
