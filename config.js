/**
 * Website Configuration
 * Centralized configuration for colors, spacing, and other design tokens
 */

const CONFIG = {
  // Color scheme
  colors: {
    primary: '#0065C0',
    secondary: '#f09228',
    text: '#000000',
    background: '#FFFFFF',
    border: '#bbb',
    accent: '#B31B1B'
  },
  
  // Typography
  typography: {
    fontFamily: "'Lato', Verdana, Helvetica, sans-serif",
    baseFontSize: '16px',
    lineHeight: 1.7,
    headingFontSize: '22px',
    nameFontSize: '32px'
  },
  
  // Spacing
  spacing: {
    sectionMargin: '1px',
    listItemMargin: '8px',
    publicationItemMargin: '12px',
    headingMargin: '15px',
    containerMaxWidth: '1050px',
    containerPadding: '20px'
  },
  
  // Navigation
  navigation: {
    gap: '18px',
    padding: '20px 35px',
    buttonPadding: '6px 12px',
    fontSize: '14px'
  },
  
  // Responsive breakpoints
  breakpoints: {
    mobile: '600px',
    tablet: '768px',
    desktop: '992px'
  },
  
  // Animation
  animation: {
    transitionDuration: '0.25s',
    hoverTransform: 'scale(1.05)'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} 