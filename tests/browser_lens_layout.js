/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes about three minutes: tests/run_easter_suites.sh lens_layout starts it as a
 * background promise and polls for it.
 * Stale geometry: the lenses that draw on the page's own elements (tokens: a tile on every
 * token; blueprint: dimension lines, type specs and the grid; lamplight: the ember links;
 * acta: the engraved plates, the engraved portrait and the drop cap) must follow the layout
 * when it moves without a DOM change in the scope. Three moves, for each of these lenses:
 *   1. Lazy photos loading. The lens arrives on photography.html (stored in sessionStorage,
 *      as if the reader came from another page) while the gallery's photos are held back: a
 *      stylesheet in the frame's <head> (outside the scope) is in place before the first
 *      layout and keeps the lazy photos from rendering, so they take no space when the lens
 *      arrives and, unless the browser's cache already holds them, have not loaded either.
 *      Then the hold is lifted, the photos load (or simply take their space) and the masonry
 *      reflows: every caption moves, without a DOM change in the scope.
 *      Only the first lens of a run can meet the photos cold (the later ones find them
 *      cached), so the first lens is Acta, whose plates and blanks depend on the photos'
 *      loads the most, and the suite fails when the first lens finds the photos already
 *      loaded (run it in a fresh browser session, as tests/run_easter_suites.sh does). For a
 *      later lens that finds them loaded, the load itself is reported as not tested
 *      (report.untested); the reflow is still checked. To meet each lens cold, run the suite
 *      once per lens, each in a fresh session, with window.__lensLayoutOnly = [id].
 *      For Acta, while the photos load no photograph may be seen as a photograph: each is
 *      hidden under a blank plate until its engraving is inked in.
 *   2. A padding change of #main-content (again from a stylesheet in <head>): everything in
 *      main moves, while main's content box keeps its size (a ResizeObserver on its content
 *      box sees nothing; ctx.onLayoutChange reports it). On the homepage for acta (the
 *      portrait) and on photography for the others.
 *   3. A <details> opened, then closed again, on a paper page (/papers/godel-agent.html):
 *      what follows it moves (the toggle is both a content change, the open attribute, and
 *      a layout change). The lens arrives on the page, as in 1.
 * After each move: tokens' tiles in the viewport lie on text and every caption in view has
 * tiles; blueprint's drawing and grid equal a fresh measurement (its _current() hook) and the
 * drawing spans the document; lamplight lights the footer link under the lamp and leaves it
 * an ember when the lamp is far; acta's plates lie on their photos' content boxes (one for
 * every photo near the viewport), a blank plate on every shown photograph with the photographs
 * hidden, the plates in view shown first while the photos load (no plate out of sight is shown
 * while a photo in view has waited on its blank for over ORDER_GRACE_MS), the portrait's engraving
 * on the photo, and the drop cap
 * rule (required on the paper page) matches its one paragraph, whose first letter it sets at
 * the paragraph's start. The lens then leaves without leaving a layer behind.
 * Without ctx.onLayoutChange, the padding change of 2 leaves every one of these lenses'
 * drawings stale (checked by disabling it), so each check below can fail.
 * Prints assertions, failures, per lens how many photos had loaded when it arrived, and what
 * could not be tested in this run.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (predicate, label = 'condition', limit = 15000) => {
    const began = performance.now();
    while (performance.now() - began < limit) { if (predicate()) return; await delay(10); }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  // Polls a measurement until it passes or time is up; returns the last value.
  const settleOn = async (measure, ok, limit = 4000) => {
    const began = performance.now();
    let value = measure();
    while (!ok(value) && performance.now() - began < limit) { await delay(100); value = measure(); }
    return value;
  };
  const channel = new MessageChannel();
  const yieldNow = () => new Promise(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });

  // Acta first: only the first lens meets the photos cold (see the header). (A subset, for a quick run.)
  const LENSES = window.__lensLayoutOnly || ['acta', 'tokens', 'blueprint', 'lamplight'];
  const HOLD = '#main-content .photo-item img { display: none !important; }';
  const PAD = '#main-content { padding-top: 180px !important; }';
  const PAPER = '/papers/godel-agent.html';   // a paper page with <details> and running text
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = [sessionStorage.getItem('lenses-active'), sessionStorage.getItem('lenses-ground')];
  localStorage.setItem('theme', 'light'); localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  const errors = [];
  const report = { loadedAtArrival: {}, untested: [], tokens: {}, lamplight: {}, acta: {} };
  let doc; let win;

  const hook = path => {
    doc = frame.contentDocument; win = frame.contentWindow;
    if (win.__layoutSuiteHooked) return;
    win.__layoutSuiteHooked = true;
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
  };
  // A stylesheet of the test's own in the frame's <head> (outside the lens scope).
  const addStyle = (d, css, id) => { const style = d.createElement('style'); style.id = id; style.textContent = css; (d.head || d.documentElement).append(style); return style; };
  // Opens path with the lens stored; `early` runs on the new document as soon as it exists.
  const open = async (path, lens, ground, early = () => {}) => {
    if (lens) sessionStorage.setItem('lenses-active', lens); else sessionStorage.removeItem('lenses-active');
    if (lens && ground) sessionStorage.setItem('lenses-ground', ground); else sessionStorage.removeItem('lenses-ground');
    const old = frame.contentDocument;
    frame.src = `${path}?r=${Math.random().toString(36).slice(2)}`;
    const began = performance.now();
    for (;;) {
      const d = frame.contentDocument;
      if (d && d !== old && d.documentElement && frame.contentWindow.location.href !== 'about:blank') { early(d); break; }
      if (performance.now() - began > 10000) throw new Error(`${path} did not open`);
      await yieldNow();
    }
    await until(() => frame.contentDocument.readyState === 'complete', `${path} to load`);
    hook(path);
  };
  const arrived = id => until(() => win.SiteLenses && win.SiteLenses.current === id && !win.SiteLenses.busy &&
    !doc.documentElement.hasAttribute('data-lens-arriving') && !doc.documentElement.hasAttribute('data-lens-revealing'), `${id} to arrive`, 15000);
  const photos = () => [...doc.querySelectorAll('#main-content .photo-item img')];
  const loaded = img => img.complete && img.naturalWidth > 0;
  const inView = r => r.bottom > 0 && r.top < win.innerHeight && r.right > 0 && r.left < win.innerWidth && r.width > 0 && r.height > 0;
  // Waits until the photos have loaded and the page's height has not changed for a while.
  const quiet = async (ms = 900) => {
    let last = -1; let since = performance.now();
    await until(() => {
      const h = doc.documentElement.scrollHeight;
      if (h !== last) { last = h; since = performance.now(); }
      return performance.now() - since > ms;
    }, 'the layout to settle', 15000);
  };

  /* The checks, per lens --------------------------------------------------------------- */
  // tokens: the tiles in the viewport lie on text; every caption in view has a tile.
  const textAt = (x, y) => doc.elementsFromPoint(x, y).some(el => {
    if (el.closest('.lenses-layer')) return false;
    const walker = doc.createTreeWalker(el, win.NodeFilter.SHOW_TEXT);
    const range = doc.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (x >= r.left - 1.5 && x <= r.right + 1.5 && y >= r.top - 1.5 && y <= r.bottom + 1.5) return true;
    }
    return false;
  });
  const tokenCheck = () => {
    // Tiles whose centre is in the viewport (elementsFromPoint sees nothing outside it).
    const centred = r => r.top + r.height / 2 > 0 && r.top + r.height / 2 < win.innerHeight && r.left + r.width / 2 > 0 && r.left + r.width / 2 < win.innerWidth;
    const all = [...doc.querySelectorAll('.tk-tile')].map(t => t.getBoundingClientRect()).filter(inView);
    const tiles = all.filter(centred);
    const off = tiles.filter(r => !textAt(r.left + r.width / 2, r.top + r.height / 2));
    const onText = tiles.length - off.length;
    const captions = [...doc.querySelectorAll('#main-content .photo-title')].map(c => { const range = doc.createRange(); range.selectNodeContents(c); return range.getBoundingClientRect(); }).filter(inView);
    const covered = captions.filter(c => all.some(t => t.right > c.left && t.left < c.right && t.bottom > c.top && t.top < c.bottom)).length;
    return { tiles: tiles.length, onText, captions: captions.length, covered, off: off.slice(0, 4).map(r => `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`) };
  };
  const tokensOk = v => v.tiles > 0 && v.onText / v.tiles >= 0.98 && v.covered === v.captions;
  // blueprint: the drawing equals a fresh one, and spans the document.
  const blueprintCheck = () => {
    const current = win.SiteLenses._debug.lens('blueprint')._current();
    const svg = doc.querySelector('.lens-bp-svg');
    return { current, height: svg ? +svg.getAttribute('height') : 0, doc: doc.documentElement.scrollHeight };
  };
  const blueprintOk = v => v.current && v.current.drawing && v.current.grid && Math.abs(v.height - v.doc) <= 2;
  // lamplight: the lamp on a link lights it; far from the lamp a link is an ember.
  const lampAt = async (x, y) => {
    doc.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y }));
    await delay(80);
    await until(() => win.SiteLenses._debug.state.frames === 0, 'the lamp to rest', 5000);
  };
  const near = el => parseFloat(el.style.getPropertyValue('--ll-near'));
  const lampCheck = async label => {
    // A link low on the page (moved the most), centred in the viewport.
    const links = [...doc.querySelectorAll('#site-footer a[href], body > footer.paper-footer a[href]')].filter(a => a.getClientRects().length && !a.querySelector('img'));
    const link = links[0];
    if (!link) { check(false, `${label}: lamplight has a footer link to light`); return; }
    link.scrollIntoView({ block: 'center', behavior: 'instant' });
    await delay(150);
    const r = link.getBoundingClientRect();
    await lampAt(r.left + r.width / 2, r.top + r.height / 2);
    const lit = near(link);
    // Far away: the opposite corner of the viewport.
    const far = { x: r.left + r.width / 2 > win.innerWidth / 2 ? 10 : win.innerWidth - 10, y: r.top > win.innerHeight / 2 ? 10 : win.innerHeight - 10 };
    await lampAt(far.x, far.y);
    const dark = near(link);
    report.lamplight[label] = { lit, dark, at: Math.round(r.top + win.scrollY) };
    check(lit >= 0.9, `${label}: lamplight lights the footer link under the lamp (--ll-near ${lit})`);
    check(dark <= 0.1, `${label}: lamplight leaves the footer link an ember when the lamp is far (--ll-near ${dark})`);
  };
  // acta: plates on their photos, one for every photo near the viewport.
  const contentBox = img => {
    const r = img.getBoundingClientRect(); const s = win.getComputedStyle(img); const px = n => parseFloat(s[n]) || 0;
    return { left: r.left + px('borderLeftWidth') + px('paddingLeft'), top: r.top + px('borderTopWidth') + px('paddingTop'),
      right: r.right - px('borderRightWidth') - px('paddingRight'), bottom: r.bottom - px('borderBottomWidth') - px('paddingBottom') };
  };
  const plateCheck = () => {
    const overlays = [...doc.querySelectorAll('.lenses-media')];
    const media = win.SiteLenses._debug.ctx ? [...doc.querySelectorAll('#main-content img:not(.profile-photo)')] : [];
    const nearby = media.filter(img => {
      if (!loaded(img)) return false;
      const r = img.getBoundingClientRect();
      return r.width >= 24 && r.height >= 24 && r.bottom > -win.innerHeight * 1.4 && r.top < win.innerHeight * 2.4;
    });
    let placed = 0; let worst = 0;
    const handle = win.SiteLenses._debug.ctx;
    for (const canvas of overlays) {
      // The overlay's image: the one whose content box it covers, or the nearest by area.
      const c = canvas.getBoundingClientRect();
      const offBy = img => { const b = contentBox(img); return Math.max(Math.abs(b.left - c.left), Math.abs(b.top - c.top), Math.abs(b.right - c.right), Math.abs(b.bottom - c.bottom)); };
      const best = media.reduce((m, img) => Math.min(m, offBy(img)), Infinity);
      worst = Math.max(worst, best);
      if (best <= 1) placed++;
    }
    return { overlays: overlays.length, placed, worst: +worst.toFixed(2), nearby: nearby.length, handle: !!handle };
  };
  const platesOk = v => v.overlays > 0 && v.placed === v.overlays && v.overlays >= v.nearby;
  // acta: the photographs to be engraved (acta.js EXPECT_SELECT) are hidden, each shown one
  // under a blank plate on its content box.
  const EXPECT = '#main-content img[src*="photos/"]:not(.profile-photo, [src*="project-demo/"])';
  const blankCheck = () => {
    const expected = [...doc.querySelectorAll(EXPECT)];
    const shown = expected.filter(img => img.getClientRects().length && img.getBoundingClientRect().height > 0);
    const boxes = [...doc.querySelectorAll('.lens-acta-blank')].map(b => b.getBoundingClientRect());
    const offBy = img => { const c = contentBox(img); return Math.min(Infinity, ...boxes.map(b => Math.max(Math.abs(b.left - c.left), Math.abs(b.top - c.top), Math.abs(b.right - c.right), Math.abs(b.bottom - c.bottom)))); };
    return { blanks: boxes.length, shown: shown.length, worst: +Math.max(0, ...shown.map(offBy)).toFixed(2),
      hidden: expected.filter(img => win.getComputedStyle(img).opacity === '0').length, expected: expected.length };
  };
  const blanksOk = v => v.shown > 0 && v.blanks === v.shown && v.worst <= 1 && v.hidden === v.expected;
  // From now until stop(): whether a photograph to be engraved is ever seen as a photograph
  // (loaded, in view, not hidden) while the Acta style shows.
  const watchPhotographs = () => {
    let stop = false; const seen = { samples: 0, shown: 0 };
    (async () => {
      while (!stop) {
        if (doc.documentElement.classList.contains('lens-acta')) {
          seen.samples++;
          if ([...doc.querySelectorAll(EXPECT)].some(img => { const r = img.getBoundingClientRect(); return loaded(img) && r.height > 1 && r.bottom > 0 && r.top < win.innerHeight && win.getComputedStyle(img).opacity !== '0'; })) seen.shown++;
        }
        await delay(8);
      }
    })();
    return () => { stop = true; return seen; };
  };
  // acta: the order in which the plates show while the photos load. From now until stop():
  // when each photo's plate first shows (a print on its blank, or the helper's overlay on it),
  // and every time a plate shows for a photo outside the viewport, the photos in the viewport
  // that have been loaded there for over ORDER_GRACE_MS and still show a blank (the reader
  // would watch an empty frame while a plate out of sight is made).
  const ORDER_GRACE_MS = 400;        // a plate takes 0.05–0.3 s in this frame (a photo that came
                                     // into view while a plate out of view was being made may wait
                                     // for it); the reviewed defect left them waiting 1–4 s
  const watchPlateOrder = () => {
    let stop = false; const first = new Map(); const since = new Map(); const late = []; let samples = 0;
    (async () => {
      while (!stop) {
        samples++;
        const now = performance.now();
        const shown = [...doc.querySelectorAll('canvas.lenses-media, .lens-acta-blank > canvas.lens-acta-print')]
          .filter(c => !c.closest('.lenses-media-fixed') && win.getComputedStyle(c).visibility !== 'hidden').map(c => c.getBoundingClientRect());
        const fresh = [];
        for (const img of photos()) {
          const r = img.getBoundingClientRect();
          const seen = loaded(img) && inView(r);
          if (!seen) since.delete(img); else if (!since.has(img)) since.set(img, now);
          if (first.has(img) || !loaded(img)) continue;
          const b = contentBox(img);
          if (shown.some(c => Math.abs(c.left - b.left) < 2 && Math.abs(c.top - b.top) < 2 && Math.abs(c.right - b.right) < 2 && Math.abs(c.bottom - b.bottom) < 2)) {
            first.set(img, now); fresh.push([img, seen]);
          }
        }
        for (const [img, seen] of fresh) {
          if (seen) continue;
          const waiting = photos().filter(p => since.has(p) && !first.has(p) && now - since.get(p) > ORDER_GRACE_MS);
          if (waiting.length) late.push(`${img.alt} shown while ${waiting.map(p => `${p.alt} (${Math.round(now - since.get(p))} ms)`).join(', ')} waited`);
        }
        await delay(16);
      }
    })();
    return () => { stop = true; return { first, late, samples }; };
  };
  const portraitCheck = () => {
    const photo = doc.querySelector('#main-content .profile-photo');
    const engraving = doc.querySelector('.lens-acta-engraving');
    if (!photo || !engraving) return { off: Infinity };
    const a = photo.getBoundingClientRect(); const b = engraving.getBoundingClientRect();
    return { off: +Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)).toFixed(2) };
  };
  const dropCapCheck = () => {
    const sheet = [...doc.styleSheets].find(s => (s.href || '').includes('easter/lenses/acta.css'));
    const rules = sheet ? [...sheet.cssRules].filter(r => r.selectorText && r.selectorText.includes('::first-letter') && r.selectorText.includes(':nth-child')) : [];
    if (!rules.length) return { rules: 0 };
    const target = rules[0].selectorText.replace(/^html\.lens-acta\s+/, '').replace(/::first-letter$/, '');
    const matches = doc.querySelectorAll(target);
    // The cap sits on its paragraph: its first letter starts at the paragraph's left edge, at
    // its first line, and the text beside the cap is set in by the cap's width.
    let sits = false;
    const p = matches[0];
    if (p) {
      const walker = doc.createTreeWalker(p, win.NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n && !n.data.trim()) n = walker.nextNode();
      if (n) {
        const i = n.data.search(/\S/);
        const box = (from, to) => { const range = doc.createRange(); range.setStart(n, from); range.setEnd(n, to); return range.getBoundingClientRect(); };
        const first = box(i, i + 1); const next = box(i + 1, Math.min(n.data.length, i + 2)); const r = p.getBoundingClientRect();
        const line = parseFloat(win.getComputedStyle(p).lineHeight) || 24;
        sits = Math.abs(first.left - r.left) <= 6 && Math.abs(first.top - r.top) <= line && next.left - r.left >= 20;
      }
    }
    return { rules: rules.length, matches: matches.length, prose: matches.length === 1 && matches[0].tagName === 'P' && matches[0].textContent.trim().length >= 120, sits };
  };

  // After a move: every check of `id`, with the label of the move.
  // dropCap: the page has running text, so Acta must have placed its drop cap rule.
  const verify = async (id, label, { dropCap = false } = {}) => {
    if (id === 'tokens') {
      const v = await settleOn(tokenCheck, tokensOk);
      report.tokens[label] = v;
      check(v.tiles > 0 && v.onText / v.tiles >= 0.98, `${label}: the token tiles in view lie on text (${v.onText} of ${v.tiles})`);
      check(v.covered === v.captions, `${label}: every caption in view has its tiles (${v.covered} of ${v.captions})`);
    } else if (id === 'blueprint') {
      const v = await settleOn(blueprintCheck, blueprintOk);
      check(v.current && v.current.drawing, `${label}: the blueprint drawing equals a fresh measurement`);
      check(v.current && v.current.grid, `${label}: the blueprint grid is aligned to the column as it is now`);
      check(Math.abs(v.height - v.doc) <= 2, `${label}: the blueprint drawing spans the document (${v.height} of ${v.doc} px)`);
    } else if (id === 'lamplight') {
      await lampCheck(label);
    } else if (id === 'acta') {
      if (doc.querySelector('#main-content .photo-item')) {
        const v = await settleOn(plateCheck, platesOk, 8000);
        report.acta[label] = v;
        check(v.overlays > 0 && v.placed === v.overlays, `${label}: every plate lies on its photo's content box (${v.placed} of ${v.overlays}, worst ${v.worst} px)`);
        check(v.overlays >= v.nearby, `${label}: a plate for every photo near the viewport (${v.overlays} for ${v.nearby})`);
        const b = await settleOn(blankCheck, blanksOk);
        report.acta[`${label} blanks`] = b;
        check(b.hidden === b.expected, `${label}: every photograph to be engraved is hidden (${b.hidden} of ${b.expected})`);
        check(b.shown > 0 && b.blanks === b.shown && b.worst <= 1, `${label}: a blank plate on every shown photograph (${b.blanks} for ${b.shown}, worst ${b.worst} px)`);
      }
      if (doc.querySelector('#main-content .profile-photo')) {
        const v = await settleOn(portraitCheck, p => p.off <= 1);
        check(v.off <= 1, `${label}: the engraved portrait lies on the photo (off by ${v.off} px)`);
      }
      const cap = dropCapCheck();
      report.acta[`${label} drop cap`] = cap;
      if (dropCap) check(cap.rules === 1, `${label}: Acta has set its drop cap (${cap.rules} rules)`);
      if (cap.rules) {
        check(cap.rules === 1 && cap.prose, `${label}: the drop cap rule matches its one paragraph of running text`);
        check(cap.sits, `${label}: the drop cap sits at the start of its paragraph`);
      }
    }
  };
  const leave = async (id, label) => {
    doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(() => !win.SiteLenses.busy && win.SiteLenses.current === null, `${id} to leave`, 10000);
    check(!doc.querySelector('.lenses-layer'), `${label}: no lens layer is left after the exit`);
  };

  try {
    // The lenses and their grounds.
    await open('/', null, null);
    const lenses = await win.SiteLensesBoot.loadCore();
    const registered = await lenses._debug.loadAll();
    const ids = LENSES.filter(id => registered.includes(id));
    check(ids.length === LENSES.length, `The four lenses under audit are registered (${ids.join(', ')})`);
    const grounds = Object.fromEntries(ids.map(id => [id, lenses._debug.lens(id).ground || null]));

    for (const id of ids) {
      /* 1. Arrive on photography with the photos held back; then let them load. */
      let hold = null;
      await open('/photography.html', id, grounds[id], d => { hold = addStyle(d, HOLD, 'layout-suite-hold'); });
      await arrived(id);
      await delay(400);
      const atArrival = photos().filter(loaded).length;
      const cold = atArrival < photos().length;
      report.loadedAtArrival[id] = `${atArrival} of ${photos().length}`;
      if (id === ids[0]) {
        check(cold, `photography, ${id}: the first lens arrives before the photos have loaded (${atArrival} of ${photos().length} had; run the suite in a fresh browser session)`);
      } else if (!cold) report.untested.push(`photography, ${id}: the photos were cached, so they did not load after the lens arrived (only the reflow is checked)`);
      const captionTop = doc.querySelectorAll('#main-content .photo-caption')[3].getBoundingClientRect().top;
      const watching = id === 'acta' ? watchPhotographs() : null;
      const ordering = id === 'acta' ? watchPlateOrder() : null;
      const released = performance.now();
      hold.remove();
      await until(() => photos().every(loaded), 'the photos to load', 20000);
      await quiet();
      if (watching) {
        await settleOn(plateCheck, platesOk, 8000);
        const seen = watching();
        check(seen.samples > 20 && seen.shown === 0, `photography, acta: while the photos load, none is seen as a photograph (${seen.shown} of ${seen.samples} samples)`);
        // The plates in view come first: no plate out of sight is shown while a photo in view
        // waits on its blank; and in the settled layout every photo in view has its plate no
        // later than the first photo out of view (reported).
        const order = ordering();
        const inViewNow = photos().filter(img => inView(img.getBoundingClientRect()));
        const at = img => (order.first.has(img) ? Math.round(order.first.get(img) - released) : null);
        const lastIn = Math.max(...inViewNow.map(img => at(img) ?? Infinity));
        const outs = photos().filter(img => !inViewNow.includes(img) && order.first.has(img)).map(at);
        report.acta.plateOrder = { inView: inViewNow.map(img => `${img.alt}@${at(img)}`), outOfView: photos().filter(img => !inViewNow.includes(img)).map(img => `${img.alt}@${at(img)}`),
          lastInView: lastIn, firstOutOfView: outs.length ? Math.min(...outs) : null, late: order.late };
        check(order.samples > 20 && inViewNow.length > 0 && inViewNow.every(img => order.first.has(img)), `photography, acta: every photo in view gets its plate (${inViewNow.filter(img => order.first.has(img)).length} of ${inViewNow.length})`);
        check(!order.late.length, `photography, acta: no plate out of view is shown while a photo in view waits on its blank (${order.late.slice(0, 3).join('; ')})`);
      }
      const moved = doc.querySelectorAll('#main-content .photo-caption')[3].getBoundingClientRect().top - captionTop;
      check(moved > 100, `photography, ${id}: the photos took their space after the lens arrived (a caption moved ${Math.round(moved)} px)`);
      await verify(id, `photography after the photos loaded, ${id}`);

      /* 2. A padding change of main (its content box keeps its size). */
      if (id === 'acta') { await leave(id, `photography, ${id}`); await open('/', id, grounds[id]); await arrived(id); await delay(400); }
      win.scrollTo({ top: 0, behavior: 'instant' });
      const page = id === 'acta' ? 'home' : 'photography';
      const pad = addStyle(doc, PAD, 'layout-suite-pad');
      await delay(700);
      await verify(id, `${page} with main's padding changed, ${id}`);
      pad.remove();
      await delay(700);
      await verify(id, `${page} with main's padding back, ${id}`);
      await leave(id, `${page}, ${id}`);

      /* 3. A <details> opened and closed again on a paper page: everything below it moves
         (the toggle is reported as a content change, the open attribute, and as a layout
         change). The details is scrolled to the top, so the text it moves is in view. */
      await open(PAPER, id, grounds[id]);
      await arrived(id);
      await delay(400);
      const details = [...doc.querySelectorAll('#main-content details')].find(d => !d.open && d.textContent.length > 400);
      check(!!details, `${PAPER}: a closed <details> with a long text to open`);
      if (details) {
        details.scrollIntoView({ block: 'start', behavior: 'instant' });
        win.scrollBy(0, -80);
        await delay(400);
        const footer = doc.querySelector('body > footer.paper-footer');
        const footerTop = footer.getBoundingClientRect().top;
        details.open = true;
        await delay(700);
        check(footer.getBoundingClientRect().top - footerTop > 100, `paper page, ${id}: opening the details moved what follows it (${Math.round(footer.getBoundingClientRect().top - footerTop)} px)`);
        await verify(id, `paper page with a details opened, ${id}`, { dropCap: true });
        details.open = false;
        await delay(700);
        await verify(id, `paper page with the details closed again, ${id}`, { dropCap: true });
      }
      await leave(id, `paper page, ${id}`);
    }
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens[0] === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens[0]);
    if (storedLens[1] === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedLens[1]);
  }
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  return { assertions, failures, ...report };
})();
