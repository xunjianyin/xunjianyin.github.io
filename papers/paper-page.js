/**
 * Shared Paper Page JavaScript
 * Copy-to-clipboard, abstract toggle
 */

document.addEventListener('DOMContentLoaded', function() {
  // === Copy Citation Button ===
  const copyBtn = document.querySelector('.copy-citation-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      const citationEl = document.querySelector('.paper-citation');
      if (!citationEl) return;
      const text = citationEl.textContent.trim();
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.classList.add('copied');
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = originalHTML;
        }, 2000);
      });
    });
  }

  // === Abstract Toggle ===
  const abstractBtn = document.querySelector('.abstract-toggle-btn');
  if (abstractBtn) {
    abstractBtn.addEventListener('click', function() {
      const content = document.querySelector('.abstract-content');
      if (!content) return;
      const expanded = content.classList.toggle('expanded');
      abstractBtn.classList.toggle('expanded', expanded);
      abstractBtn.querySelector('.btn-text').textContent = expanded ? 'Hide Abstract' : 'Show Abstract';
    });
  }
});
