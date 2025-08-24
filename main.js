/**
 * Main JavaScript file for rendering content on the website
 * This file contains all formatting and rendering functions
 */

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
  
  // Initialize mobile hamburger menu
  initializeMobileMenu();
  
  // Initialize outline navigation
  initializeOutlineNavigation();
  
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

/**
 * Initialize dark mode functionality
 */
function initializeDarkMode() {
  const themeToggle = document.getElementById('theme-toggle');
  
  if (!themeToggle) return;
  
  // Check for saved theme preference or default to 'light'
  const currentTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  // Apply the saved theme
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeLabel(currentTheme, themeToggle);
  
  // Add click event listener
  themeToggle.addEventListener('click', () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeLabel(newTheme, themeToggle);
  });
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateThemeLabel(newTheme, themeToggle);
    }
  });
}

/**
 * Update theme button label based on current theme
 */
function updateThemeLabel(theme, toggleElement) {
  toggleElement.setAttribute('aria-label', 
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  toggleElement.setAttribute('title', 
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

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
      
      if (targetElement) {
        // Find the section container (div with section-spacing class)
        const sectionContainer = targetElement.closest('.section-spacing');
        let scrollTarget = targetElement;
        
        if (sectionContainer) {
          scrollTarget = sectionContainer;
        } else {
          // Try to find the table container
          const tableContainer = targetElement.closest('table');
          if (tableContainer) {
            scrollTarget = tableContainer;
          }
        }
        
        // Calculate the scroll position with offset for navigation and sidebar
        const rect = scrollTarget.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top - 100;
        
        window.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
        
        // Update URL hash without triggering default scroll
        history.pushState(null, null, targetId);
        
        // Close mobile menu if it's open
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        if (mobileMenuToggle && mobileMenuToggle.classList.contains('active')) {
          const sidebar = document.getElementById('outline-sidebar');
          const overlay = document.getElementById('mobile-sidebar-overlay');
          
          mobileMenuToggle.classList.remove('active');
          sidebar.classList.remove('mobile-active');
          overlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });
  });
}