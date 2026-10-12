/* Run with agent-browser eval --stdin against a local static preview of the site.
 * Tests Murmuration, the third egg (easter/murmur/): lazy loading on the password, no DOM
 * mutation while it is open and exact restoration after it, the model (letters per unit, order
 * at low noise, disorder at high noise, the cooling schedule), every close path (Escape, a
 * second close, pagehide, resize, Return), the last frame of the flight home on the glyphs,
 * the homepage photo (it opens Self-portrait, not the flock), reduced motion, an active lens reset first, other pages (the
 * publications, the blogs, a paper page without the egg), frame timing and errors.
 * Resolves with assertions, failures, notes and frame timing.
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
  const storedLens = sessionStorage.getItem('lenses-active'); const storedGround = sessionStorage.getItem('lenses-ground');
  sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
  const notes = [];
  const errors = [];
  let frameStats = { frames: 0, avgMs: 0, maxMs: 0 };
  let doc; let win;
  let reduced = false; let queries = [];
  const pending = new Set();
  // Pages with the site shell wait for its footer; a paper page only for the boot.
  const shellReady = () => doc.querySelector('.easter-egg-footnote') && win.SiteLensesBoot;
  const load = async (path = '/', ready = shellReady) => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(ready, `${path}: the page and the egg boot`);
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
  const type = (text = 'aiai', target = doc.body, extra = {}) => {
    for (const key of text) target.dispatchEvent(new win.KeyboardEvent('keydown', {
      key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...extra
    }));
  };
  const egg = () => doc.querySelector('#murmur');
  const hook = () => egg()?.murmur;
  const assets = () => doc.querySelectorAll('script[src*="easter/murmur/"],link[href*="easter/murmur/"]');
  // Each dialog's frameStats object is live until it closes: keep them all and merge at the end.
  const statObjects = new Set();
  const opened = async (label, limit = 12000) => {
    await until(() => egg()?.open && hook(), label, limit);
    statObjects.add(hook().frameStats);
  };
  const mergeStats = () => {
    for (const stats of statObjects) {
      if (!stats.frames) continue;
      const frames = frameStats.frames + stats.frames;
      frameStats = { frames, avgMs: +((frameStats.avgMs * frameStats.frames + stats.avgMs * stats.frames) / frames).toFixed(2),
        maxMs: +Math.max(frameStats.maxMs, stats.maxMs).toFixed(2) };
    }
  };
  // The <html> attributes, names and values; `loose` drops what the egg owns while it is open
  // (the murmur-hide-text token and the scrollbar-gutter declaration) and attributes left empty.
  const htmlAttributes = (loose = false) => [...doc.documentElement.attributes].map(attribute => {
    let value = attribute.value;
    if (loose && attribute.name === 'class') value = value.split(/\s+/).filter(token => token && token !== 'murmur-hide-text').join(' ');
    if (loose && attribute.name === 'style') value = value.replace(/\s*scrollbar-gutter:\s*stable;?/, '').trim();
    return [attribute.name, value];
  }).filter(([name, value]) => !(loose && (name === 'class' || name === 'style') && !value))
    .map(([name, value]) => `${name}="${value}"`).sort().join(' ');
  // What a close must give back, taken just before an opening.
  const snapshot = () => ({
    className: doc.documentElement.className, bodyCss: doc.body.style.cssText, htmlCss: doc.documentElement.style.cssText,
    main: doc.querySelector('#main-content')?.innerHTML, scrollY: win.scrollY, focus: doc.activeElement
  });
  const restored = (label, before, { frames = true } = {}) => {
    check(!egg() && !doc.documentElement.classList.contains('murmur-hide-text'), `${label}: dialog and class removed`);
    check(win.SiteMurmuration.active === false, `${label}: SiteMurmuration.active is false`);
    check(doc.documentElement.className === before.className && doc.body.style.cssText === before.bodyCss &&
      doc.documentElement.style.cssText === before.htmlCss,
      `${label}: html class, body style and html style restored ("${doc.documentElement.className}", "${doc.body.style.cssText}", "${doc.documentElement.style.cssText}")`);
    check(win.scrollY === before.scrollY, `${label}: scroll restored (${win.scrollY} of ${before.scrollY})`);
    check(doc.activeElement === before.focus, `${label}: focus restored (${doc.activeElement && doc.activeElement.tagName})`);
    check(doc.querySelector('#main-content')?.innerHTML === before.main, `${label}: page markup unchanged`);
    if (frames) check(pending.size === 0, `${label}: no pending animation frame`);
  };
  // Opens the flock through the test hook, at a faster schedule.
  const openFast = async (timeScale = 8) => {
    const result = win.SiteMurmuration.open({ timeScale, seed: 7 });
    await opened('the flock to open');
    return result;
  };
  // Two close requests: the flight home, then at once.
  const closeNow = () => { const h = hook(); if (h) { h.close(); h.close(); } };
  // A real double-click on the homepage photo: two clicks, then dblclick (as in the Spira suite).
  const doubleClick = () => {
    const photo = doc.querySelector('.profile-photo[data-egg-trigger]');
    const mouse = (type, detail) => photo.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, detail }));
    mouse('mousedown', 1); mouse('mouseup', 1); mouse('click', 1); mouse('mousedown', 2); mouse('mouseup', 2); mouse('click', 2); mouse('dblclick', 2);
  };
  // Where two strings first differ, with some context, for a failure label.
  const firstDifference = (a = '', b = '') => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i === a.length && i === b.length ? 'identical' : `at ${i}: "${a.slice(Math.max(0, i - 60), i + 60)}" vs "${b.slice(Math.max(0, i - 60), i + 60)}"`;
  };
  const resized = () => new Promise(resolve => win.addEventListener('resize', resolve, { once: true }));

  try {
    /* 1. Lazy loading: nothing before the password; the password outside a text field. */
    await load('/');
    const main = doc.querySelector('#main-content');
    const pristine = { main: main.innerHTML, attributes: htmlAttributes() };
    check(assets().length === 0 && !win.SiteMurmuration, 'No Murmuration asset loads before the password');
    const input = doc.createElement('input');
    doc.body.append(input); input.focus(); type('aiai', input); input.remove();
    await delay(400);
    check(assets().length === 0 && !egg(), 'The password typed in an input opens and loads nothing');
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { repeat: true }]) type('aiai', doc.body, extra);
    await delay(200);
    check(assets().length === 0 && !egg(), 'Modifier shortcuts and repeated keys do not count');

    const toggle = doc.querySelector('#theme-toggle');
    if (toggle) toggle.focus();
    win.scrollTo({ top: 200, behavior: 'instant' });
    const first = snapshot();
    check(first.scrollY === 200, `The page scrolls by 200 px before the first opening (${first.scrollY})`);
    type();
    await opened('the password to open the flock');
    const scripts = doc.querySelectorAll('script[src*="easter/murmur/murmur.js"]');
    const sheets = doc.querySelectorAll('link[href*="easter/murmur/murmur.css"]');
    check(scripts.length === 1 && sheets.length === 1, 'The password loads the script and the stylesheet once');
    const version = win.SiteLensesBoot.murmurVersion;
    check(/^murmur-v\d+$/.test(version) && [...assets()].every(asset => (asset.src || asset.href).includes(`v=${version}`)),
      `Asset URLs carry the boot's Murmuration version (v=${version})`);
    check(egg().open && egg().matches(':modal'), 'The flock is an open native modal dialog');
    check(doc.documentElement.classList.contains('murmur-hide-text'), '<html> carries murmur-hide-text while open');
    check(doc.body.style.overflow === 'hidden', 'The body does not scroll while open');
    check(egg().contains(doc.activeElement), 'Focus is inside the dialog');
    check(win.SiteMurmuration.active === true, 'SiteMurmuration.active is true while open');
    check(win.SiteMurmuration.open() === false && doc.querySelectorAll('#murmur').length === 1, 'A second opening is refused (no stacked dialogs)');

    /* 2. No DOM mutation while open. */
    check(main.innerHTML === pristine.main, '#main-content markup is byte-identical while open');
    const during = htmlAttributes(true);
    check(during === pristine.attributes,
      `<html> attributes are unchanged while open, but for murmur-hide-text and the scrollbar gutter (${during} vs ${pristine.attributes}; raw ${htmlAttributes()})`);

    /* 3. The model: per letter at 1280x900; order at low noise, disorder at high noise. */
    const model = hook();
    check(model.count > 0 && model.units >= model.count, `Units fly (${model.count} of ${model.units})`);
    check(model.perLetter === true, 'The homepage flies letter by letter');
    notes.push(`/: perLetter ${model.perLetter}, count ${model.count}, units ${model.units}`);
    model.setNoise(0.15);
    check(Math.abs(model.noise - 0.15) < 1e-9, `setNoise sets the noise (${model.noise})`);
    await delay(6000);
    // About 6 s: the order parameter fluctuates near its plateau, so allow up to 2 s more.
    try { await until(() => model.order > 0.7, 'the flock to order', 4000); } catch (error) { /* reported below */ }
    check(model.phase === 'flock', `After 6 s the phase is flock (${model.phase})`);
    check(model.order > 0.7, `At noise 0.15 the flock orders (phi ${model.order.toFixed(3)})`);
    notes.push(`order at noise 0.15 after 6 s: ${model.order.toFixed(3)} (t ${model.time.toFixed(1)} s)`);
    model.setNoise(1);
    await delay(4000);
    check(model.order < 0.5, `At noise 1 the flock disorders (phi ${model.order.toFixed(3)})`);
    check(model.noise === 1, `A held noise does not cool (${model.noise})`);
    notes.push(`order at noise 1 after 4 s: ${model.order.toFixed(3)}`);

    /* 4a and 5. Escape: the flight home, within about 5 s, ending on the glyphs. */
    const escapeAt = performance.now();
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(model.phase === 'home', `Escape starts the flight home (${model.phase})`);
    check(egg() && egg().open, 'The dialog stays during the flight home');
    let last = null;
    while (egg() && performance.now() - escapeAt < 6000) {
      if (model.phase === 'home') last = model.positions();
      await delay(20);
    }
    const homeTook = performance.now() - escapeAt;
    check(!egg() && homeTook < 5000, `The flight home ends within 5 s (${Math.round(homeTook)} ms)`);
    let worst = Infinity;
    if (last) {
      worst = 0;
      for (let i = 0; i < last.x.length; i++) worst = Math.max(worst, Math.abs(last.x[i] - last.homeX[i]), Math.abs(last.y[i] - last.homeY[i]));
    }
    check(worst < 1.5, `The last readable positions of the flight home lie on the glyphs (max offset ${worst.toFixed(3)} px)`);
    notes.push(`last flight-home sample: max offset ${worst.toFixed(3)} px`);
    check(model.phase === 'closed', `The hook reports closed (${model.phase})`);
    restored('Escape', first);
    check(htmlAttributes() === pristine.attributes, `<html> attributes are byte-identical after the close (${htmlAttributes()} vs ${pristine.attributes})`);

    /* 3 (cont.) The schedule cools the noise when it is not held; 4b a second close. */
    let before = snapshot();
    check(await openFast(8) === true, 'SiteMurmuration.open returns true when it opens');
    await delay(4000);
    check(hook().noise < 0.5, `Unheld, the noise cools on its own (${hook().noise.toFixed(3)} at t ${hook().time.toFixed(1)} s)`);
    hook().close();
    check(hook().phase === 'home', 'close() starts the flight home');
    hook().close();
    check(!egg(), 'close() during the flight home finishes at once');
    restored('Second close', before);

    /* 4c. pagehide finishes at once. */
    before = snapshot();
    await openFast(8);
    await delay(300);
    win.dispatchEvent(new win.PageTransitionEvent('pagehide', { persisted: false }));
    check(!egg(), 'pagehide removes the dialog at once');
    restored('pagehide', before);

    /* 4d. A resize finishes at once. */
    before = snapshot();
    await openFast(8);
    await delay(300);
    const narrower = resized();
    frame.style.width = '1180px';
    await narrower; await delay(0);
    check(!egg(), 'A resize removes the dialog at once');
    restored('Resize', before);
    const wider = resized();
    frame.style.width = '1280px';
    await wider; await delay(50);

    /* 4e. Return starts the flight home. */
    before = snapshot();
    await openFast(8);
    await delay(300);
    const returnButton = egg().querySelector('.murmur-return');
    check(!!returnButton && returnButton.textContent.trim() === 'Return', 'The dialog has a Return button');
    returnButton.click();
    check(hook().phase === 'home', 'Return starts the flight home');
    await until(() => !egg(), 'Return to finish', 5000);
    restored('Return', before);

    /* 6. The photo opens Self-portrait, never the flock. */
    check(!!doc.querySelector('.profile-photo[data-egg-trigger]'), 'The homepage photo is an egg trigger');
    doubleClick();
    await until(() => doc.querySelector('#portrait')?.open, 'the photo to open Self-portrait');
    check(!egg(), 'The photo opens Self-portrait, not the flock');
    doc.querySelector('#portrait').portrait.close(); doc.querySelector('#portrait')?.portrait.close();
    await until(() => !doc.querySelector('#portrait'), 'Self-portrait to close');

    /* 8. An active lens is reset (and forgotten) before the flock opens. */
    const lenses = await win.SiteLensesBoot.loadCore();
    await lenses.next({ pointerType: 'mouse', trigger: doc.querySelector('[data-lens-trigger]') });
    await until(() => !lenses.busy, 'the lens to settle', 15000);
    check(!!lenses.current, `A lens is active before the password (${lenses.current})`);
    type();
    await opened('the password to open the flock over a lens', 15000);
    check(lenses.current === null && sessionStorage.getItem('lenses-active') === null,
      `The lens is reset and forgotten first (${lenses.current}, ${sessionStorage.getItem('lenses-active')})`);
    await delay(300);
    closeNow();
    check(!egg() && main.innerHTML === pristine.main, 'After the lens and the flock the homepage markup is restored');

    /* 7. Reduced motion: no password, and a change closes the flock. */
    await load('/');
    setReduced(true);
    type();
    await delay(600);
    check(assets().length === 0 && !egg(), 'Reduced motion: the password opens and loads nothing');
    setReduced(false);
    type();
    await opened('the password to open the flock after reduced motion');
    await delay(300);
    setReduced(true);
    check(!egg() && !doc.documentElement.classList.contains('murmur-hide-text') && win.SiteMurmuration.active === false,
      'A change to reduced motion closes the flock at once');
    setReduced(false);

    /* 9. Other pages. */
    for (const path of ['/publications.html', '/blogs.html']) {
      // The blogs fill their list after the load (a "Loading blog posts..." item until then).
      await load(path, () => shellReady() && !doc.querySelector('#main-content .loading'));
      const pageMain = doc.querySelector('#main-content')?.innerHTML;
      type();
      await opened(`${path}: the password to open the flock`, 15000);
      check(egg().open && hook().count > 0, `${path}: the password opens the flock`);
      notes.push(`${path}: perLetter ${hook().perLetter}, count ${hook().count}, units ${hook().units}`);
      await delay(1000);
      closeNow();
      check(!egg() && !doc.documentElement.classList.contains('murmur-hide-text'), `${path}: the close removes the dialog and the class`);
      const afterMain = doc.querySelector('#main-content')?.innerHTML;
      check(afterMain === pageMain, `${path}: the page markup is unchanged after the close (${firstDifference(pageMain, afterMain)})`);
    }
    await load('/papers/godel-agent.html', () => win.SiteLensesBoot && doc.readyState === 'complete');
    check(!doc.querySelector('#site-footer') && typeof win.SiteLensesBoot.openMurmur === 'function',
      'A paper page has no site footer, but the boot exposes openMurmur');
    type();
    await delay(600);
    check(!egg() && assets().length === 0, 'A paper page: the password opens and loads nothing');
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    if (storedLens === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens);
    if (storedGround === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedGround);
  }
  /* 10. Frame timing over every dialog. */
  mergeStats();
  check(frameStats.frames > 0 && frameStats.avgMs < 8, `Frames take under 8 ms on average (${frameStats.avgMs} ms avg, ${frameStats.maxMs} ms max, ${frameStats.frames} frames)`);
  /* 11. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${errors.join(' | ')}`);
  return { assertions, failures, notes, frameStats, errors };
})();
