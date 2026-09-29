/* Progressive enhancements: all research content is already in the HTML. */
(() => {
  'use strict';
  const citation = document.getElementById('citation');
  const revealAnchor = () => {
    if (location.hash === '#citation' && citation) citation.open = true;
  };
  revealAnchor();
  window.addEventListener('hashchange', revealAnchor);
  document.querySelectorAll('a[href="#citation"]').forEach(link => {
    link.addEventListener('click', () => { if (citation) citation.open = true; });
  });
  const copyButton = document.querySelector('.copy-citation-btn');
  if (copyButton) {
    copyButton.hidden = false;
    copyButton.addEventListener('click', async () => {
      const code = document.querySelector('.paper-citation code');
      const status = document.querySelector('.copy-status');
      if (!code || !status) return;
      let timeout;
      try {
        if (!navigator.clipboard) throw new Error('Clipboard is unavailable');
        // Some browsers leave clipboard permission requests pending indefinitely.
        await Promise.race([
          navigator.clipboard.writeText(code.textContent.trim()),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Clipboard permission pending')), 2000);
          })
        ]);
        status.textContent = 'Citation copied.';
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = 'Citation selected. Press Ctrl+C or ⌘C to copy.';
      } finally {
        clearTimeout(timeout);
      }
    });
  }
  const demo = document.querySelector('[data-direction-demo]');
  if (demo) {
    demo.querySelector('.direction-controls').hidden = false;
    const buttons = demo.querySelectorAll('[data-direction]');
    const tokens = demo.querySelectorAll('.token');
    buttons.forEach(button => button.addEventListener('click', () => {
      const reverse = button.dataset.direction === 'reverse';
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      tokens.forEach((token, index) => {
        const predicted = reverse ? index < 3 : index >= 3;
        token.classList.toggle('predicted', predicted);
        token.classList.toggle('known', !predicted);
      });
      demo.querySelector('.direction-formula').textContent = reverse
        ? 'P(earlier text | later text)' : 'P(later text | earlier text)';
      demo.querySelector('.direction-description').textContent = reverse
        ? 'Given the ending, predict what comes before it.'
        : 'Given the beginning, predict what comes after it.';
      demo.querySelector('.token-sequence').setAttribute('aria-label', reverse
        ? 'Reverse generation predicts earlier words from later context'
        : 'Forward generation predicts later words from earlier context');
    }));
  }
})();
