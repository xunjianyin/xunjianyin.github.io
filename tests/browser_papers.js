/* Run in a local preview using agent-browser eval --stdin < tests/browser_papers.js.
 * Uses same-origin frames to check every route at desktop and phone widths.
 */
(async () => {
  const metadata = await fetch('/papers/content/metadata.json').then(response => response.json());
  const failures = [];
  const results = [];
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  for (const width of [1440, 390, 320]) {
    frame.style.width = `${width}px`;
    for (const slug of Object.keys(metadata)) {
      await new Promise((resolve, reject) => {
        frame.onload = resolve;
        frame.onerror = reject;
        frame.src = `/papers/${slug}.html`;
      });
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (doc.documentElement.scrollWidth > width + 1) failures.push(`${slug} at ${width}: horizontal overflow`);
      const visibleWords = doc.body.innerText.trim().split(/\s+/).length;
      // Hidden figures must also load when the native disclosure is opened.
      doc.querySelectorAll('details').forEach(details => { details.open = true; });
      for (const image of doc.images) {
        image.loading = 'eager';
        try { await image.decode(); } catch { failures.push(`${slug}: broken image ${image.src}`); }
      }
      if (doc.documentElement.scrollWidth > width + 1) failures.push(`${slug} at ${width}: disclosure overflow`);
      const longElements = [...doc.querySelectorAll('h1,h2,h3,p,.token-sequence')].filter(el => el.scrollWidth > el.clientWidth + 2);
      for (const el of longElements) failures.push(`${slug} at ${width}: clipped text ${el.className || el.tagName}`);
      if (slug === 'reverse-lm') {
        const forward = doc.querySelector('[data-direction="forward"]');
        forward.click();
        if (forward.getAttribute('aria-pressed') !== 'true' || !doc.querySelector('.token').classList.contains('known')) failures.push('Forward demo failed');
        doc.querySelector('[data-direction="reverse"]').click();
        if (!doc.querySelector('.token').classList.contains('predicted')) failures.push('Reverse demo failed');
      }
      const citation = doc.querySelector('#citation');
      citation.open = false;
      doc.querySelector('a[href="#citation"]').click();
      if (!citation.open) failures.push(`${slug}: citation anchor did not expand`);
      // Exercise both clipboard success and denied-permission fallback deterministically.
      Object.defineProperty(win.navigator, 'clipboard', { configurable: true, value: { writeText: async text => { win.__copiedCitation = text; } } });
      doc.querySelector('.copy-citation-btn').click();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (!win.__copiedCitation?.startsWith('@')) failures.push(`${slug}: copy failed`);
      Object.defineProperty(win.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } } });
      doc.querySelector('.copy-citation-btn').click();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (!doc.querySelector('.copy-status').textContent.includes('Citation selected')) failures.push(`${slug}: clipboard fallback failed`);
      results.push({ slug, width, visibleWords });
    }
  }
  frame.remove();
  return { pages: Object.keys(metadata).length, viewportChecks: results.length, failures, results };
})();
