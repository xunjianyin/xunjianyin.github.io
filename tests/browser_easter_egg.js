/* Run with agent-browser eval --stdin against a local static preview of the site.
 * Tests the spira easter egg: lazy loading, capture without DOM mutation, the phase
 * sequence, skip, restoration on every exit path, the chart, reduced motion, resize,
 * nested routes and load failure. Prints assertions, failures and frame timing.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (predicate, label = 'condition', limit = 12000) => {
    const began = performance.now();
    while (performance.now() - began < limit) { if (predicate()) return; await delay(10); }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const storedTheme = localStorage.getItem('theme');
  const errors = [];
  const frameStats = {};
  let doc; let win;
  let reduced = false; let queries = [];
  const pending = new Set();
  const load = async (path = '/') => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.querySelector('.easter-egg-footnote'), 'the site shell');
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
    // Reduced motion is simulated through matchMedia; change events reach the egg.
    const match = win.matchMedia.bind(win); queries = [];
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') {
        Object.defineProperty(result, 'matches', { get: () => reduced }); queries.push(result);
      }
      return result;
    };
    // Track pending animation frames.
    const raf = win.requestAnimationFrame.bind(win); const cancel = win.cancelAnimationFrame.bind(win);
    pending.clear();
    win.requestAnimationFrame = callback => { const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    win.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
  };
  const setReduced = value => { reduced = value; queries.forEach(query => query.dispatchEvent(new win.Event('change'))); };
  const type = (text = 'yxjgogogo', target = doc.body, extra = {}) => {
    for (const key of text) target.dispatchEvent(new win.KeyboardEvent('keydown', {
      key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...extra
    }));
  };
  const egg = () => doc.querySelector('#spira');
  const phase = () => egg()?.spira?.phase;
  const assets = () => doc.querySelectorAll('script[src*="easter-egg.js"],link[href*="easter-egg.css"]');
  const nextPaint = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  const openFast = async (scale = 4) => { win.SiteEasterEgg.open({ timeScale: scale }); await until(() => egg()?.open, 'the dialog'); };
  const dismiss = async () => { keepStats(); egg().dispatchEvent(new win.Event('cancel', { cancelable: true })); await until(() => !egg(), 'the dialog to close'); };
  // Each dialog's frameStats object stays live until it closes, so closing frames count too.
  const statObjects = new Set();
  const keepStats = () => { const stats = egg()?.spira?.frameStats; if (stats) statObjects.add(stats); };
  const mergeStats = () => {
    for (const stats of statObjects) {
      for (const [name, entry] of Object.entries(stats.byPhase)) {
        if (!entry.frames) continue;
        const kept = frameStats[name] || { frames: 0, avgMs: 0, maxMs: 0 };
        const frames = kept.frames + entry.frames;
        frameStats[name] = { frames, avgMs: +((kept.avgMs * kept.frames + entry.avgMs * entry.frames) / frames).toFixed(2), maxMs: +Math.max(kept.maxMs, entry.maxMs).toFixed(2) };
      }
    }
  };
  const normalise = text => text.replace(/\s+/g, ' ').trim();

  try {
    /* 1. Cold password trigger: assets load once, with the spira version. */
    await load('/');
    check(assets().length === 0, 'No egg assets load before discovery');
    type('yxjgogo'); check(assets().length === 0, 'A partial password does not download assets'); type('x');
    for (const tag of ['input', 'textarea', 'div']) {
      const control = doc.createElement(tag); if (tag === 'div') control.contentEditable = 'true';
      doc.body.append(control); type('yxjgogogo', control); control.remove();
    }
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }]) type('yxjgogogo', doc.body, extra);
    check(assets().length === 0, 'Editable fields, repeated keys and modifier shortcuts are ignored');

    /* The key sentence of the bio is found among the captured words (top of '/'). */
    win.scrollTo({ top: 0, behavior: 'instant' });
    type();
    await until(() => egg()?.open, 'the password to open the egg');
    check(assets().length === 2, 'The full password loads the script and stylesheet once');
    check([...assets()].every(asset => (asset.src || asset.href).includes('v=spira-v2')), 'Asset URLs carry v=spira-v2');
    check(egg().spira.keyCount === 24, `The key sentence is found in full (${egg().spira.keyCount} of 24 tokens)`);
    await dismiss();

    const main = doc.querySelector('#main-content');
    const focus = doc.querySelector('#theme-toggle'); focus.focus();
    doc.documentElement.dataset.theme = 'dark'; localStorage.setItem('theme', 'dark');
    doc.body.style.setProperty('overflow', 'auto', 'important');
    win.scrollTo({ top: 410, behavior: 'instant' });
    const before = { html: main.innerHTML, scroll: win.scrollY };
    const walker = doc.createTreeWalker(main, win.NodeFilter.SHOW_TEXT); const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const identitiesIntact = () => textNodes.every(node => node.isConnected && main.contains(node));
    const restored = label => {
      check(!egg() && !doc.documentElement.classList.contains('spira-hide-text'), `${label}: dialog and class removed`);
      check(doc.body.style.getPropertyValue('overflow') === 'auto' && doc.body.style.getPropertyPriority('overflow') === 'important', `${label}: body overflow value and priority restored`);
      check(win.scrollY === before.scroll, `${label}: scroll restored`);
      check(doc.activeElement === focus, `${label}: focus restored`);
      check(doc.documentElement.dataset.theme === 'dark' && localStorage.getItem('theme') === 'dark', `${label}: site theme unchanged`);
      check(main.innerHTML === before.html && identitiesIntact(), `${label}: page markup and text nodes unchanged`);
      check(pending.size === 0, `${label}: no pending animation frame`);
    };

    win.SiteEasterEgg.open();
    await until(() => egg()?.open, 'the egg to reopen');
    check(assets().length === 2, 'Reopening does not load the assets again');
    check(egg().matches(':modal'), 'The egg is a native modal dialog');

    /* 2. Capture: words from the real page, glyphs hidden by one class, DOM untouched. */
    check(egg().spira.wordCount > 40, `Capture finds more than 40 visible words (found ${egg().spira.wordCount})`);
    check(doc.documentElement.classList.contains('spira-hide-text'), '<html> carries spira-hide-text while open');
    check(main.innerHTML === before.html, '#main-content markup is byte-identical while open');
    check(identitiesIntact(), 'Original text nodes stay connected in place');
    check(egg().contains(doc.activeElement) && doc.activeElement.matches('[data-skip]'), 'Focus starts on Skip');
    const canvas = egg().querySelector('.spira-canvas');
    check(canvas.width * canvas.height <= 8.3e6 + 1, 'The canvas backing store stays within 8.3 megapixels');
    keepStats();
    await dismiss();
    restored('Early Escape');

    /* The footnote also opens the egg; repeated triggers do not stack dialogs. */
    doc.querySelector('.easter-egg-footnote').click();
    await until(() => egg()?.open, 'the footnote to open the egg');
    win.SiteEasterEgg.open();
    check(doc.querySelectorAll('#spira').length === 1, 'Repeated triggers cannot stack dialogs');
    check(assets().length === 2, 'Reopening reuses the loaded assets');
    keepStats();
    await dismiss();

    /* 3. Phases in order; the chart UI is inert until the chart. */
    await openFast(6);
    const inertBlocks = () => ['.spira-plate', '.spira-themes', '.spira-actions'].map(selector => egg().querySelector(selector));
    check(inertBlocks().every(el => el.inert), 'Plate, themes and actions are inert during the opening');
    const seen = [phase()];
    await until(() => { const now = phase(); if (now && now !== seen[seen.length - 1]) seen.push(now); return now === 'chart'; }, 'the chart phase', 15000);
    check(JSON.stringify(seen) === JSON.stringify(['dusk', 'gather', 'wind', 'ignite', 'chart']), `Phases run dusk > gather > wind > ignite > chart (saw ${seen.join(' > ')})`);
    check(inertBlocks().every(el => !el.inert), 'Plate, themes and actions are interactive in the chart');
    check(egg().querySelector('.spira-opening').hidden, 'Opening controls are removed from the chart');
    await delay(300);
    keepStats();

    /* 6. The chart: index, themes and star selection. */
    const links = [...egg().querySelectorAll('.spira-index-link')];
    const slugs = links.map(a => new URL(a.href).pathname.split('/').pop().replace('.html', ''));
    check(links.length === 23 && new Set(slugs).size === 23, 'The index lists 23 distinct papers');
    const metadata = await (await fetch('/papers/content/metadata.json')).json();
    check(JSON.stringify([...slugs].sort()) === JSON.stringify(Object.keys(metadata).sort()), 'The index covers the complete local paper corpus');
    const pages = await Promise.all(links.map(async a => {
      const response = await fetch(a.href);
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      return response.status === 200 && normalise(page.querySelector('h1')?.textContent || '') === normalise(a.title);
    }));
    check(pages.every(Boolean), 'Every index link returns 200 and its title matches the paper page');
    check(links.every(a => new URL(a.href).pathname.startsWith('/papers/')), 'Index links resolve under /papers/');
    const themes = [...egg().querySelectorAll('.spira-theme')];
    check(themes.length === 5, 'Five theme buttons');
    themes[4].click();
    check(themes[4].getAttribute('aria-pressed') === 'true' && themes.filter(b => b.getAttribute('aria-pressed') === 'true').length === 1, 'A theme button is pressed alone');
    check(egg().querySelector('.spira-plate').textContent.includes('Can experience change the learner?'), 'The plate shows the theme question');
    themes[1].click();
    check(themes[1].getAttribute('aria-pressed') === 'true' && themes[4].getAttribute('aria-pressed') === 'false', 'Choosing another theme releases the first');
    themes[1].click();
    check(themes.every(b => b.getAttribute('aria-pressed') === 'false'), 'A pressed theme toggles off');
    check(!egg().querySelector('#spira-text').closest('[hidden]'), 'The default plate text returns');
    await nextPaint();
    const stage = egg().querySelector('.spira-stage');
    const star = egg().spira.projectStar('godel-agent');
    const pointer = (type, x, y) => stage.dispatchEvent(new win.PointerEvent(type, { pointerId: 7, pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    pointer('pointerdown', star.x, star.y); pointer('pointerup', star.x, star.y);
    const plate = egg().querySelector('.spira-plate');
    check(plate.textContent.includes('2025 · Self-improvement'), 'Clicking the Gödel Agent star shows "2025 · Self-improvement"');
    check(plate.querySelector('.spira-link')?.pathname === '/papers/godel-agent.html', 'The plate links to papers/godel-agent.html');
    check(plate.querySelector('.spira-plate-title')?.textContent.startsWith('Gödel Agent'), 'The plate shows the full paper title');
    pointer('pointerdown', 4, 4); pointer('pointerup', 4, 4);
    check(!egg().querySelector('#spira-text').closest('[hidden]'), 'Clicking empty space deselects the star');
    const indexButton = egg().querySelector('[data-index]');
    indexButton.click();
    check(!egg().querySelector('.spira-index').hidden && indexButton.getAttribute('aria-expanded') === 'true', 'All works opens the index');
    indexButton.click();
    check(egg().querySelector('.spira-index').hidden, 'All works closes the index');
    const chartCanvas = egg().querySelector('.spira-canvas');
    const image = chartCanvas.toDataURL(); const beforeKey = egg().spira.projectStar('godel-agent');
    stage.focus(); stage.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await nextPaint();
    const afterKey = egg().spira.projectStar('godel-agent');
    check(chartCanvas.toDataURL() !== image && Math.hypot(afterKey.x - beforeKey.x, afterKey.y - beforeKey.y) > 5, 'Arrow keys turn the rendered spiral');
    keepStats();
    await dismiss();
    restored('Escape in the chart');

    /* 4. Skip by button and by Enter. */
    await openFast(4);
    await until(() => phase() === 'gather', 'gather before skipping');
    egg().querySelector('[data-skip]').click();
    check(phase() === 'chart' && doc.activeElement === egg().querySelector('[data-close]'), 'Skip button reaches the chart and focuses Close');
    await delay(450);
    check(!egg().classList.contains('is-fading-skip'), 'The skip fade finishes');
    keepStats();
    await dismiss();
    await openFast(4);
    egg().dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    check(phase() === 'chart' && doc.activeElement === egg().querySelector('[data-close]'), 'Enter skips to the chart and focuses Close');
    await dismiss();
    restored('Escape after Enter skip');

    /* Closing is a bookend: a 'closing' phase, glyphs back at once, full restoration after. */
    await openFast(8);
    egg().querySelector('[data-skip]').click();
    await delay(150);
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(phase() === 'closing' && !doc.documentElement.classList.contains('spira-hide-text'), 'Close enters the closing phase with the page glyphs restored first');
    await until(() => !egg(), 'the closing to finish');
    restored('After the closing animation');
    await openFast(1);
    egg().querySelector('[data-skip]').click();
    await delay(100);
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(phase() === 'closing', 'A first Escape starts the closing');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!egg(), 'A second Escape during the closing finishes it immediately');
    restored('Second Escape during the closing');

    /* Core view: the page at the centre of the galaxy. */
    await openFast(8);
    egg().querySelector('[data-skip]').click();
    await delay(450);
    const core = egg().spira.projectCore();
    const coreStage = egg().querySelector('.spira-stage');
    const press = (x, y) => {
      for (const type of ['pointerdown', 'pointerup']) coreStage.dispatchEvent(new win.PointerEvent(type, { pointerId: 9, pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    };
    press(core.x, core.y);
    const detail = () => egg().querySelector('.spira-plate-detail');
    check(egg().spira.view === 'core' && !detail().hidden && detail().textContent.includes('The page you came from.'), 'Clicking the centre opens the core view and its plate');
    check(doc.activeElement && doc.activeElement.textContent === 'Back out', 'Focus moves to Back out');
    await delay(500);
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!!egg() && egg().open && phase() === 'chart', 'Escape in the core view backs out instead of closing');
    await until(() => egg().spira.view === 'chart', 'the flight back to the chart');
    check(!egg().querySelector('#spira-text').closest('[hidden]'), 'Backing out restores the default plate');
    egg().querySelector('.spira-centre').click();
    check(egg().spira.view === 'core', 'The centre control opens the core view too');
    egg().querySelector('.spira-back').click();
    await until(() => egg().spira.view === 'chart', 'Back out');
    check(doc.activeElement === egg().querySelector('.spira-centre'), 'Back out returns focus to the centre control');
    keepStats();
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(phase() === 'closing', 'A second Escape (back in the chart) closes');
    await until(() => !egg(), 'the closing after core view');
    restored('Escape after the core view');

    /* 5. Escape during each phase restores everything. */
    for (const target of ['dusk', 'gather', 'wind', 'ignite', 'chart']) {
      await openFast(target === 'dusk' ? 2 : 8);
      await until(() => phase() === target, `phase ${target}`, 15000);
      keepStats();
      await dismiss();
      restored(`Escape during ${target}`);
    }

    /* Replay restarts the opening from the chart. */
    await openFast(8);
    egg().querySelector('[data-skip]').click();
    await delay(400);
    egg().querySelector('[data-replay]').click();
    await until(() => phase() === 'dusk', 'replay to restart the opening');
    check(egg().querySelector('.spira-plate').inert && !egg().querySelector('.spira-opening').hidden, 'Replay restarts with inert chart UI and opening controls');
    check(main.innerHTML === before.html, 'Replay leaves the page markup unchanged');
    await until(() => phase() === 'chart', 'the replayed opening to finish', 15000);
    keepStats();
    await dismiss();
    restored('Escape after replay');

    /* 7. Reduced motion: straight to the chart, no idle loop, no Replay. */
    setReduced(true);
    win.SiteEasterEgg.open();
    await until(() => egg()?.open, 'the reduced-motion dialog');
    check(phase() === 'chart', 'Reduced motion opens directly in the chart');
    check(!doc.documentElement.classList.contains('spira-hide-text'), 'Reduced motion leaves page glyphs visible');
    await nextPaint(); await nextPaint();
    check(pending.size === 0, 'Reduced motion leaves no pending animation frame after two frames');
    check(egg().querySelector('[data-replay]').hidden, 'Replay is hidden under reduced motion');
    const rmCore = egg().spira.projectCore();
    const rmStage = egg().querySelector('.spira-stage');
    for (const type of ['pointerdown', 'pointerup']) rmStage.dispatchEvent(new win.PointerEvent(type, { pointerId: 11, pointerType: 'mouse', button: 0, clientX: rmCore.x, clientY: rmCore.y, bubbles: true, cancelable: true }));
    check(egg().spira.view === 'core', 'Reduced motion: the core opens at once');
    await nextPaint(); await nextPaint();
    check(pending.size === 0, 'Reduced motion: the core view keeps no running loop');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(egg().spira.view === 'chart', 'Reduced motion: Escape backs out of the core at once');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!egg(), 'Reduced motion: closing is instant');
    setReduced(false);
    await openFast(1);
    await until(() => phase() === 'gather', 'gather before reduced motion');
    setReduced(true);
    check(phase() === 'chart', 'Turning on reduced motion mid-opening skips to the chart');
    await nextPaint(); await nextPaint();
    check(pending.size === 0 && egg().querySelector('[data-replay]').hidden, 'Mid-opening reduced motion stops frames and hides Replay');
    await dismiss();
    setReduced(false);
    restored('Escape after reduced motion');

    /* 8. Resize during the gather skips to the chart. */
    await openFast(4);
    await until(() => phase() === 'gather', 'gather before resizing');
    const errorsBefore = errors.length;
    frame.style.width = '390px'; frame.style.height = '844px';
    await until(() => phase() === 'chart', 'resize to skip to the chart');
    await delay(450);
    check(errors.length === errorsBefore, 'Resizing during the gather raises no errors');
    check(egg().scrollWidth <= 391 && egg().scrollHeight <= 845, '390x844: the dialog does not scroll');
    const narrowBlocks = ['.spira-head', '.spira-plate', '.spira-themes', '.spira-actions'].map(selector => egg().querySelector(selector).getBoundingClientRect());
    check(narrowBlocks.every(r => r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844), '390x844: UI blocks fit the viewport');
    check(egg().querySelector('.spira-hint').textContent.includes('Tap a star'), '390x844: the touch hint is shown');
    keepStats();
    await dismiss();
    frame.style.width = '1280px'; frame.style.height = '900px';
    await delay(100);

    /* 9. Nested route: assets and paper links resolve from the site root. */
    await load('/blogs/agents-that-learn-after-deployment.html');
    doc.querySelector('.easter-egg-footnote').click();
    await until(() => egg()?.open, 'the egg on a nested route');
    check([...assets()].every(asset => new URL(asset.src || asset.href).pathname.startsWith('/easter-egg.')), 'Nested routes load the assets from the site root');
    check([...egg().querySelectorAll('.spira-index-link')].every(a => new URL(a.href).pathname.startsWith('/papers/')), 'Nested routes link papers from the site root');
    check(egg().spira.wordCount > 10, 'Nested routes capture their own words');
    keepStats();
    await dismiss();

    /* 10. A failed download can be retried. */
    await load('/');
    const append = doc.head.append.bind(doc.head); let failOnce = true;
    doc.head.append = (...nodes) => {
      const script = nodes.find(node => node.tagName === 'SCRIPT' && node.src.includes('easter-egg.js'));
      if (script && failOnce) { failOnce = false; setTimeout(() => script.onerror(new win.Event('error')), 0); }
      else append(...nodes);
    };
    type(); await delay(200);
    check(!egg() && assets().length === 0, 'A failed download removes partial assets');
    doc.head.append = append;
    type(); await until(() => egg()?.open, 'the retried egg');
    check(egg().open, 'A failed download can be retried');
    egg().querySelector('[data-opening-close]').click();
    await until(() => !egg(), 'the opening close button');
    check(!doc.body.style.overflow && !doc.documentElement.classList.contains('spira-hide-text'), 'The opening Close restores an absent overflow style and the glyphs');
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme);
  }
  /* 11. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${errors.join(' | ')}`);
  mergeStats();
  return { assertions, failures, frameStats };
})();
