/**
 * Shared Utility Functions
 * Common functionality used across all pages
 */

/**
 * Initialize dark mode functionality
 */
function initializeDarkMode() {
  const themeToggle = document.getElementById('theme-toggle');

  if (!themeToggle) return;

  // Safe localStorage access (handles private browsing, disabled storage, etc.)
  function getStoredTheme() {
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Check for saved theme preference or default to 'light'
  const currentTheme = getStoredTheme() ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  // Apply the saved theme
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme, themeToggle);

  // Add click event listener
  themeToggle.addEventListener('click', () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    setStoredTheme(newTheme);
    updateThemeIcon(newTheme, themeToggle);
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getStoredTheme()) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateThemeIcon(newTheme, themeToggle);
    }
  });
}

/**
 * Update theme button icon and label based on current theme
 */
function updateThemeIcon(theme, toggleElement) {
  // Update aria-label and title
  toggleElement.setAttribute('aria-label',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  toggleElement.setAttribute('title',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');

  // Update icon (sun for dark mode, moon for light mode)
  toggleElement.innerHTML = theme === 'dark'
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

/**
 * Initialize back to top button
 */
function initializeBackToTop() {
  const backToTopBtn = document.getElementById('back-to-top');

  if (!backToTopBtn) return;

  // Show/hide button based on scroll position
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  });

  // Scroll to top on click
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Legacy function name for backward compatibility
function updateThemeLabel(theme, toggleElement) {
  updateThemeIcon(theme, toggleElement);
}
