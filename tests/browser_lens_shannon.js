/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes about a minute: tests/run_easter_suites.sh lens_shannon starts it as a
 * background promise and polls for the result.
 * Tests lens VIII (Shannon, 1951) through the lenses core: the model against an independent
 * reference PPM (escape method C, exclusion, update exclusion, orders 5..0, a uniform fallback
 * over 65,536 code units), the caption's bits per character (the short note on a phone), the
 * text it reads (hidden text and the body of a closed <details> skipped, an opened one read),
 * the ink levels as CSS highlights (one per colour pair and level, their rule colours on a
 * concave curve, level 0 at a WCAG contrast of 3:1 or more, quantised pairs and the share of
 * letters they cover, the ranges of the blocks near the viewport only, what the browser paints
 * at a letter), the emergent behaviour (the owner's name fades after its first occurrence, word
 * beginnings are darker than word endings), the images (a photograph as the residual map of the
 * median edge detector, its tones held as greys and painted by its ink filter, the small
 * portrait read through a 1-2-1 blur, a figure faded toward its own ground with its strokes kept
 * and its grey lines and labels at the letters' floor, both pixel for pixel; a white figure
 * stays white with legible labels in the dark theme; in the dark theme a photo's tones stand
 * off the ground about as far as in the light one; the originals hidden under their drawings,
 * painted as their framed blank sheets), the photography
 * lightbox (its photograph drawn pale on the backdrop through the helper's fixed layer, the
 * arrows usable, next and previous, close), the hover tooltip, a hovered link in its own
 * colours, links reachable, the reading front half way (enter; the phone portrait turns before
 * the text below it) and the ink three quarters returned (exit), reduced motion, the dark theme
 * and a theme toggle while active (the rules, every run on screen in its own new colours, merged
 * pairs too, the drawings on screen and the stored ground follow before the next frame; on the
 * home page and a blog post, both ways; the toggle's task within 8 ms on photography), late
 * content, jumps (the blocks a jump lands on, by a fragment link or a scroll, are inked in its
 * first frame, and its figures show their drawings or their own originals, never a blank
 * sheet), exact restoration, arrival from sessionStorage on photography and two papers (the
 * page hidden over its own ground at first, then no frame with a colour photograph, a blank
 * hole for an image (a pending one is a framed sheet) or letters in full ink; a drawing ready
 * before the page shows is not faded in over the reveal; arrive() within 350 ms; no long
 * task while reading and scrolling, as the median of three passes since other browsers share
 * the machine; frame callbacks only while something moves; work slices within 8 ms and a short
 * commit), arrival over a ground that is not the page's own (dark theme to a paper page: the
 * colours are read from the paper), the same pages entered by a trigger and left byte for byte,
 * phone widths (390 and 320 px; the caption's line breaks after its dash when it must break),
 * and the caption at the viewport's foot on a paper page (its band on the page's own ground
 * covers whole lines of the text beneath it, none cut).
 * Prints assertions, failures and timings.
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
  const ID = 'shannon';
  const LINE = 'VIII · Shannon, 1951 — Each letter is as dark as it was surprising.';
  const LONGEST_PAPER = '/papers/auditing-health-llms.html';
  const report = { timings: {}, stats: {}, bpc: {}, ranges: {}, longTasks: {}, frames: {}, coverage: {}, contrast: {}, levels: {} };
  const errors = []; const warnings = [];

  // The lens files may sit in the HTTP cache from an older run (the asset key changes only
  // when the version is bumped): fetch them once more so the frame gets the files on disk.
  const version = window.SiteLensesBoot ? window.SiteLensesBoot.version : null;
  if (version) {
    await Promise.all(['shannon.js', 'shannon.css'].map(file => fetch(`/easter/lenses/${file}?v=${version}`, { cache: 'reload' }).catch(() => {})));
  }

  const frame = document.createElement('iframe');
  document.body.append(frame);
  const stored = Object.fromEntries(['theme', 'lenses-seen', 'spira-sound'].map(key => [key, localStorage.getItem(key)]));
  const storedLens = sessionStorage.getItem('lenses-active');
  const storedGround = sessionStorage.getItem('lenses-ground');
  localStorage.setItem('theme', 'light'); localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
  let doc; let win; let reduced = false; let longTasks = []; let pending = new Set();

  // Opens a page in the frame. lens: the lens arrives with the page (sessionStorage), with
  // ground, the colour the core stored with it.
  // Arrival: every frame from the end of parsing: whether the page is hidden (body opacity 0,
  // over the ground), and, once it shows, the frames with an image in view that shows its
  // colour original (loaded, not hidden, and no drawing shown over it) and the frames whose
  // letters are not inked yet (no highlight range).
  let imageWatch = null;
  const watchImages = () => {
    const watch = { frames: 0, colour: 0, first: null, stop: false, hidden: 0, plain: 0, firstState: null, drawn: null, blank: 0, framed: 0, fadingAtReveal: null };
    // The hairline colour of the sheet a pending image is painted as (shannon.css, SVG filter).
    const flood = () => { const f = doc.getElementById('lens-shannon-sheet'); const el = f && f.querySelector('feFlood'); return el ? el.getAttribute('flood-color') : ''; };
    const tick = () => {
      if (watch.stop || !doc) return;
      watch.frames++;
      const bodyOpacity = +win.getComputedStyle(doc.body).opacity;
      if (!watch.firstState) {
        watch.firstState = { arriving: doc.documentElement.getAttribute('data-lens-arriving'), revealing: doc.documentElement.getAttribute('data-lens-revealing'), body: bodyOpacity, ground: win.getComputedStyle(doc.documentElement).backgroundColor };
      }
      if (bodyOpacity < 0.01) { watch.hidden++; win.requestAnimationFrame(tick); return; }
      const active = win.SiteLenses && win.SiteLenses._debug && win.SiteLenses._debug.lens(ID) && win.SiteLenses._debug.lens(ID)._state;
      if (!active || !(active.ranges > 0)) watch.plain++;
      const canvases = [...doc.querySelectorAll('canvas.lenses-media')];
      // A drawing ready before the page showed is shown at once (no fade over the reveal).
      if (watch.fadingAtReveal === null) watch.fadingAtReveal = canvases.filter(c => +win.getComputedStyle(c).opacity < 0.99).length;
      const shownOverlays = canvases.filter(c => +win.getComputedStyle(c).opacity > 0.99).map(c => c.getBoundingClientRect());
      // Each loaded image in view shows its drawing, or its framed blank sheet (its original
      // painted through the sheet filter, with a hairline colour); never its colour original,
      // and never a blank hole (hidden, or a sheet without a hairline).
      let colour = 0; let blank = 0; let framed = 0;
      const line = flood();
      for (const img of doc.querySelectorAll('#main-content img')) {
        const r = img.getBoundingClientRect();
        if (!(r.bottom > 0 && r.top < win.innerHeight && r.width > 24) || !img.complete || !img.naturalWidth || /\/\//.test(img.getAttribute('src') || '')) continue;
        if (shownOverlays.some(b => Math.abs(b.left - r.left) < 3 && Math.abs(b.top - r.top) < 3)) continue;
        const s = win.getComputedStyle(img);
        const sheet = +s.opacity === 1 && /lens-shannon-sheet/.test(s.filter);
        if (sheet && /^rgb/.test(line)) framed++;
        else if (sheet || +s.opacity === 0) blank++;
        else colour++;
      }
      if (blank) watch.blank++;
      if (framed) watch.framed++;
      if (colour) { watch.colour++; if (watch.first === null) watch.first = Math.round(win.performance.now()); }
      // Reported: when every loaded image in view first shows its drawing (from navigation start).
      if (watch.drawn === null) {
        const inView = [...doc.querySelectorAll('#main-content img')].filter(img => { const r = img.getBoundingClientRect(); return r.bottom > 0 && r.top < win.innerHeight && r.width > 24 && img.complete && img.naturalWidth > 0 && !/\/\//.test(img.getAttribute('src') || ''); });
        if (inView.length && inView.every(img => { const r = img.getBoundingClientRect(); return shownOverlays.some(b => Math.abs(b.left - r.left) < 3 && Math.abs(b.top - r.top) < 3); })) watch.drawn = Math.round(win.performance.now());
      }
      win.requestAnimationFrame(tick);
    };
    win.requestAnimationFrame(tick);
    return watch;
  };
  const load = async (path, { width = 1440, height = 900, lens = null, ground = null, settle = true, watch = false } = {}) => {
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:200000;border:0;background:white`;
    if (lens) sessionStorage.setItem('lenses-active', lens); else sessionStorage.removeItem('lenses-active');
    if (lens && ground) sessionStorage.setItem('lenses-ground', ground); else sessionStorage.removeItem('lenses-ground');
    const old = frame.contentDocument;
    frame.src = `${path}${path.includes('?') ? '&' : '?'}r=${Math.random().toString(36).slice(2)}`;
    await until(() => frame.contentDocument && frame.contentDocument !== old && frame.contentWindow.location.href !== 'about:blank', `${path} to start`);
    // Hooks as early as possible: errors, reduced motion (before the core reads it), frames.
    win = frame.contentWindow; doc = frame.contentDocument;
    const hook = () => {
      win = frame.contentWindow; doc = frame.contentDocument;
      if (win.__shannonHooked) return;
      win.__shannonHooked = true;
      win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
      win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
      const consoleError = win.console.error.bind(win.console);
      win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
      const consoleWarn = win.console.warn.bind(win.console);
      win.console.warn = (...args) => { warnings.push(`${path}: ${args.map(String).join(' ')}`); consoleWarn(...args); };
      const match = win.matchMedia.bind(win);
      win.matchMedia = query => {
        const result = match(query);
        if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { get: () => reduced });
        return result;
      };
      const raf = win.requestAnimationFrame.bind(win); const cancel = win.cancelAnimationFrame.bind(win);
      pending = new Set();
      win.requestAnimationFrame = callback => { const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
      win.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
      longTasks = [];
      try {
        new win.PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push({ at: entry.startTime, ms: Math.round(entry.duration) })))
          .observe({ type: 'longtask', buffered: true });
      } catch (error) { /* not observable */ }
    };
    await until(() => frame.contentDocument.readyState !== 'loading', `${path} to parse`);
    hook();
    if (imageWatch) imageWatch.stop = true;
    imageWatch = watch ? watchImages() : null;
    await until(() => frame.contentDocument.readyState === 'complete' && win.SiteLensesBoot, `${path} to load`);
    if (settle) {
      // The page's own late content (star counts, markdown) settles first.
      let last = ''; let since = performance.now();
      await until(() => {
        const main = doc.getElementById('main-content');
        const now = main ? main.innerHTML : '';
        if (now !== last) { last = now; since = performance.now(); }
        return now && performance.now() - since > 500;
      }, `${path} to settle`, 10000);
    }
    if (lens) await arrived();
    else await win.SiteLensesBoot.loadCore();
    await win.SiteLenses._debug.loadAll();
    if (!win.SiteLenses._debug.lens(ID)) throw new Error('easter/lenses/shannon.js did not register');
  };
  const lenses = () => win.SiteLenses;
  const state = () => win.SiteLenses._debug.state;
  const lens = () => lenses()._debug.lens(ID);
  const st = () => lens()._state;
  const model = () => lens()._model;
  const idle = () => until(() => lenses() && !lenses().busy, 'the lenses to settle', 20000);
  const arrived = () => until(() => win.SiteLenses && win.SiteLenses.current === ID && !win.SiteLenses.busy &&
    !doc.documentElement.hasAttribute('data-lens-arriving') && !doc.documentElement.hasAttribute('data-lens-revealing'), 'the lens to arrive', 15000);
  const nextFrames = (n = 2) => new Promise(resolve => { const step = k => (k ? win.requestAnimationFrame(() => step(k - 1)) : resolve()); step(n); });
  const escape = () => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const pointer = (type, x, y, pointerType = 'mouse') => doc.dispatchEvent(new win.PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerType }));

  // Everything the lens could leave behind.
  const snapshot = () => ({
    main: doc.getElementById('main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlClass: doc.documentElement.getAttribute('class'), htmlStyle: doc.documentElement.getAttribute('style'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children], headKids: [...doc.head.children].filter(el => !/easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '')),
    sheets: doc.styleSheets.length, adopted: doc.adoptedStyleSheets.length, fonts: doc.fonts.size,
    scroll: win.scrollY, focus: doc.activeElement
  });
  // The same, as text: to compare a page opened with the lens against the page opened without it.
  const ours = el => /easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '');
  const textual = () => ({
    main: doc.getElementById('main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlAttrs: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).filter(a => !a.startsWith('data-theme')).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    headKids: [...doc.head.children].filter(el => !ours(el)).map(el => el.outerHTML).join('\n')
  });
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return `at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const ourHighlights = () => [...win.CSS.highlights.keys()].filter(name => name.startsWith('lens-shannon'));
  const ourRules = () => [...doc.styleSheets].reduce((n, sheet) => { try { return n + [...sheet.cssRules].filter(rule => rule.cssText.includes('lens-shannon-')).length; } catch (error) { return n; } }, 0);
  const sameText = (before, label) => {
    const now = textual();
    check(now.main === before.main, `${label}: #main-content markup is byte-identical to the page without the lens (${firstDiff(before.main, now.main)})`);
    check(now.nav === before.nav && now.footer === before.footer, `${label}: nav and footer markup are byte-identical`);
    check(now.htmlAttrs === before.htmlAttrs, `${label}: <html> attributes as without the lens (${now.htmlAttrs})`);
    check(now.bodyAttrs === before.bodyAttrs, `${label}: <body> attributes as without the lens (${now.bodyAttrs})`);
    check(now.bodyKids === before.bodyKids, `${label}: no node left in <body> (${now.bodyKids})`);
    check(now.headKids === before.headKids, `${label}: no node left in <head> (${firstDiff(before.headKids, now.headKids)})`);
    check(ourHighlights().length === 0 && ourRules() === 0, `${label}: no highlight or rule left`);
    check(!state().glyphs && state().layers === 0 && !state().caption && state().frames === 0, `${label}: core state is clean`);
  };
  const restored = (before, label) => {
    const now = snapshot();
    check(now.main === before.main, `${label}: #main-content markup is byte-identical (${firstDiff(before.main, now.main)})`);
    check(now.nav === before.nav && now.footer === before.footer, `${label}: nav and footer markup are byte-identical`);
    check(now.htmlClass === before.htmlClass && now.htmlStyle === before.htmlStyle, `${label}: <html> class and style restored (${now.htmlClass} / ${now.htmlStyle})`);
    check(now.bodyAttrs === before.bodyAttrs, `${label}: <body> attributes restored (${now.bodyAttrs})`);
    check(now.bodyKids.length === before.bodyKids.length && now.bodyKids.every((el, i) => el === before.bodyKids[i]), `${label}: no node left in <body>`);
    check(now.headKids.length === before.headKids.length && now.headKids.every((el, i) => el === before.headKids[i]), `${label}: no node left in <head>`);
    check(now.sheets === before.sheets && now.adopted === before.adopted, `${label}: stylesheets restored (${now.sheets} vs ${before.sheets})`);
    check(now.fonts === before.fonts, `${label}: document.fonts unchanged`);
    check(Math.abs(now.scroll - before.scroll) < 1, `${label}: scroll unchanged (${now.scroll} vs ${before.scroll})`);
    check(now.focus === before.focus, `${label}: focus unchanged`);
    check(ourHighlights().length === 0, `${label}: no lens-shannon highlight left (${ourHighlights().join(', ')})`);
    check(ourRules() === 0, `${label}: no ::highlight rule left`);
    check(!state().glyphs && state().layers === 0 && !state().caption && state().frames === 0, `${label}: core state is clean`);
  };
  // Links and the theme toggle are hit-testable at their centres.
  const clickable = label => {
    const links = [...doc.querySelectorAll('#main-content a[href], #site-nav a[href], body > header.site-header a[href]')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top > 0 && r.bottom < win.innerHeight && r.left > 0 && r.right < win.innerWidth;
    }).slice(0, 6);
    check(links.length > 0, `${label}: a link is in view`);
    for (const link of links) {
      const at = centre(link); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === link, `${label}: the link "${link.textContent.trim().slice(0, 30)}" is clickable (hit ${hit && hit.tagName})`);
    }
    const toggle = doc.querySelector('#theme-toggle');
    const toggleBox = toggle && toggle.getBoundingClientRect();
    if (toggle && toggleBox.width > 0 && toggleBox.right <= win.innerWidth) { const at = centre(toggle); const hit = doc.elementFromPoint(at.x, at.y); check(hit && hit.closest('#theme-toggle') === toggle, `${label}: the theme toggle is clickable`); }
  };
  // The images the media helper should redraw: readable, rendered, near the viewport.
  const expectedImages = () => {
    const scope = [doc.querySelector('#site-nav, body > header.site-header'), doc.getElementById('main-content'), doc.querySelector('#site-footer, body > footer.paper-footer')].filter(Boolean);
    const H = win.innerHeight; const Wd = win.innerWidth;
    return scope.flatMap(root => [...root.querySelectorAll('img')]).filter(img => {
      if (!img.complete || !img.naturalWidth) return false;
      let url; try { url = new URL(img.currentSrc || img.src, win.location.href); } catch (error) { return false; }
      if (url.origin !== win.location.origin && url.protocol !== 'data:') return false;
      const s = win.getComputedStyle(img);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      for (let el = img; el && el !== doc.body; el = el.parentElement) if (win.getComputedStyle(el).position === 'fixed') return false;
      const r = img.getBoundingClientRect();
      if (r.width < 26 || r.height < 26) return false;
      return r.bottom >= -1.5 * H && r.top <= 2.5 * H && r.right >= -1.5 * Wd && r.left <= 2.5 * Wd;
    });
  };
  const overlays = () => [...doc.querySelectorAll('canvas.lenses-media')];
  const imagesRendered = async label => {
    try {
      await until(() => { const want = expectedImages(); const have = overlays(); return have.length === want.length && have.every(c => +win.getComputedStyle(c).opacity > 0.99); }, `${label}: overlays`, 12000);
    } catch (error) { /* reported below */ }
    const want = expectedImages(); const have = overlays();
    check(have.length === want.length, `${label}: one residual overlay per readable image near the viewport (${have.length} vs ${want.length})`);
    check(have.every(c => +win.getComputedStyle(c).opacity > 0.99), `${label}: every overlay is shown`);
    return have;
  };
  // The ink the browser paints at a letter: the lens highlight under its centre (or none).
  const highlightAt = (node, offset) => {
    const range = doc.createRange(); range.setStart(node, offset); range.setEnd(node, offset + 1);
    const r = range.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return undefined;
    const hits = win.CSS.highlights.highlightsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const names = [...win.CSS.highlights.entries()].filter(([, h]) => hits.some(hit => (hit.highlight || hit) === h)).map(([name]) => name);
    return names.filter(name => name.startsWith('lens-shannon'));
  };
  const parseRgb = value => (/rgba?\(([^)]+)\)/.exec(value) || [, '0,0,0'])[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);
  const close = (a, b, tolerance = 2) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
  // A photo's overlay holds its tones as greys, 255 * (1 - tone); its ink filter (an SVG
  // feComponentTransfer in the lens's layer, named by the canvas's own filter) colours them as
  // they are painted. inkOf(canvas) is the colour painted for a grey v, read from the filter's
  // own tables (null without one).
  const toneGrey = t => Math.round(255 * (1 - t));
  const inkOf = canvas => {
    const m = /url\("?#([^")]+)"?\)/.exec(canvas.style.filter || '');
    const filter = m && doc.getElementById(m[1]);
    if (!filter || !filter.querySelector('feFuncR')) return null;
    const tables = ['feFuncR', 'feFuncG', 'feFuncB'].map(tag => filter.querySelector(tag).getAttribute('tableValues').trim().split(/\s+/).map(Number));
    return v => tables.map(t => Math.round(255 * t[v]));
  };
  // The documented colour of a photo's tone t: its ink mixed toward its ground in OKLab, by t
  // steepened where the ink spans less than PHOTO_SPAN of OKLab lightness off the ground.
  const photoWant = ({ bg, ink }, t) => {
    const span = Math.abs(model().oklab(ink)[0] - model().oklab(bg)[0]);
    return model().mix(bg, ink, Math.min(1, t * Math.max(1, lens()._image.PHOTO_SPAN / Math.max(0.05, span))));
  };
  // An original painted as its blank sheet: through the lens's sheet filter, whose flood (the
  // hairline) is a colour; it shows none of its own pixels.
  const sheetOnly = (img, id = 'lens-shannon-sheet') => {
    const s = win.getComputedStyle(img); const f = doc.getElementById(id); const flood = f && f.querySelector('feFlood');
    return s.opacity === '0' || (s.filter === `url("#${id}")` && !!flood && /^rgb/.test(flood.getAttribute('flood-color')) && !f.querySelector('[in="SourceGraphic"], [in2="SourceGraphic"]'));
  };
  // The mean painted value of a photo's overlay (its greys through its ink filter).
  const paintedMean = canvas => {
    const paint = inkOf(canvas); const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    if (!paint) return NaN;
    const lut = Array.from({ length: 256 }, (_, v) => paint(v).reduce((a, b) => a + b, 0) / 3);
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += lut[d[i]];
    return sum / (d.length / 4);
  };

  // An independent reference model: strings for contexts, Maps for counts, Sets for exclusion.
  const reference = text => {
    const ORDER = 5; const ALPHABET = 65536;
    const contexts = Array.from({ length: ORDER + 1 }, () => new Map());
    const seen = new Set(); const bits = []; let total = 0;
    for (let i = 0; i < text.length; i++) {
      const x = text[i]; const excluded = new Set(); let cost = 0; let coded = -1;
      const top = Math.min(ORDER, i);
      for (let k = top; k >= 0; k--) {
        const counts = contexts[k].get(text.slice(i - k, i));
        if (!counts) continue;
        const live = [...counts].filter(([y]) => !excluded.has(y));
        if (!live.length) continue;
        const n = live.reduce((sum, [, c]) => sum + c, 0); const q = live.length;
        const hit = live.find(([y]) => y === x);
        if (hit) { cost += Math.log2((n + q) / hit[1]); coded = k; break; }
        cost += Math.log2((n + q) / q);
        live.forEach(([y]) => excluded.add(y));
      }
      if (coded < 0) { cost += Math.log2(ALPHABET - seen.size); seen.add(x); }
      bits.push(cost); total += cost;
      for (let k = Math.max(coded, 0); k <= top; k++) {
        const key = text.slice(i - k, i);
        let counts = contexts[k].get(key);
        if (!counts) contexts[k].set(key, counts = new Map());
        counts.set(x, (counts.get(x) || 0) + 1);
      }
    }
    return { bits, total };
  };
  const compareModels = (text, label) => {
    const ours = model().run(text); const ref = reference(text);
    let worst = 0;
    for (let i = 0; i < text.length; i++) worst = Math.max(worst, Math.abs(ours.bits[i] - ref.bits[i]));
    check(worst < 1e-4 && Math.abs(ours.total - ref.total) < 1e-6 * Math.max(1, ref.total), `${label}: the model matches the reference PPM (worst ${worst.toExponential(2)} bits, totals ${ours.total.toFixed(4)} vs ${ref.total.toFixed(4)})`);
    return ours;
  };

  // The median edge detector's |error| for every pixel of RGBA data (composed over `under`
  // where transparent), read through a 1-2-1 blur first when `blur`: an independent version.
  const residualMap = (a, W, H, { blur = false, under = [255, 255, 255] } = {}) => {
    const rgb = new Uint8Array(W * H * 3); const Y = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const k = a[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = k === 1 ? a[i * 4 + c] : Math.floor(a[i * 4 + c] * k + under[c] * (1 - k) + 0.5);
      Y[i] = (54 * rgb[i * 3] + 183 * rgb[i * 3 + 1] + 19 * rgb[i * 3 + 2] + 128) >> 8;
    }
    if (blur) {
      const at = (x, y) => Y[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
      const T = new Uint16Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) T[y * W + x] = at(x - 1, y) + 2 * at(x, y) + at(x + 1, y);
      const tt = (x, y) => T[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) Y[y * W + x] = (tt(x, y - 1) + 2 * tt(x, y) + tt(x, y + 1) + 8) >> 4;
    }
    const E = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let pred;
      if (y === 0) pred = x ? Y[i - 1] : Y[i]; else if (x === 0) pred = Y[i - W];
      else { const pa = Y[i - 1]; const pb = Y[i - W]; const pc = Y[i - W - 1]; const lo = Math.min(pa, pb); const hi = Math.max(pa, pb); pred = pc >= hi ? lo : pc <= lo ? hi : pa + pb - pc; }
      E[i] = Math.abs(Y[i] - pred);
    }
    return { rgb, Y, E };
  };
  const lin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const enc = l => { const c = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };
  // The commonest colour (4 bits a channel) of an image's border ring, averaged: its own ground.
  const borderGround = (rgb, W, H) => {
    const ring = Math.max(2, Math.round(0.03 * Math.min(W, H)));
    const bins = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!(y < ring || y >= H - ring || x < ring || x >= W - ring)) continue;
      const i = (y * W + x) * 3; const key = (rgb[i] >> 4) << 8 | (rgb[i + 1] >> 4) << 4 | (rgb[i + 2] >> 4);
      const bin = bins.get(key) || [0, 0, 0, 0]; bin[0]++; bin[1] += rgb[i]; bin[2] += rgb[i + 1]; bin[3] += rgb[i + 2]; bins.set(key, bin);
    }
    const best = [...bins.values()].sort((a, b) => b[0] - a[0])[0];
    return [best[1] / best[0], best[2] / best[0], best[3] / best[0]].map(Math.round);
  };
  // A graphic's overlay against the documented rule, on sampled pixels: each channel mixed toward
  // the graphic's own ground (in the cube root of linear light) by max(keep(|error|), stroke).
  const checkGraphic = async (overlay, label) => {
    const canvas = overlay.canvas; const W = canvas.width; const H = canvas.height;
    const kit = await lenses()._debug.ctx.mediaKit();
    const fit = win.getComputedStyle(overlay.img);
    const source = await kit.drawAsync(overlay.img, parseFloat(canvas.style.width), parseFloat(canvas.style.height), canvas.pixelRatio || win.devicePixelRatio, { objectFit: fit.objectFit, objectPosition: fit.objectPosition });
    check(source.width === W && source.height === H, `${label}: the figure's overlay is its own size (${W}x${H})`);
    const a = source.getContext('2d').getImageData(0, 0, W, H).data;
    const b = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    const { bg } = lens()._image.colours(overlay.img);
    const { rgb, Y, E } = residualMap(a, W, H, { under: bg });
    const rec = lens()._image.record(canvas);
    const ground = borderGround(rgb, W, H);
    check(!!rec && rec.ground && close(rec.ground, ground, 2), `${label}: the figure's ground is the commonest colour of its border (${rec && rec.ground} vs ${ground})`);
    const I = lens()._image; const m = model(); const light = v => Math.cbrt(lin(v));
    const gL = light((54 * ground[0] + 183 * ground[1] + 19 * ground[2] + 128) >> 8);
    // The letters' floor, by the pixel's luma (a grey that light): the least share of its ink
    // whose mix keeps floorContrast(own) against the figure's ground; in full from FLOOR_TO
    // (WCAG ratio), not at all below FLOOR_FROM (pale fills still fade).
    const gY = 0.2126 * lin(ground[0]) + 0.7152 * lin(ground[1]) + 0.0722 * lin(ground[2]);
    const ratio = l => (Math.max(l, gY) + 0.05) / (Math.min(l, gY) + 0.05);
    const floorTarget = own => Math.max(Math.min(m.CONTRAST_MIN, own ** m.CONTRAST_LOW), own ** m.CONTRAST_KEEP);
    const floors = new Map();
    const floorOfY = v => {
      if (floors.has(v)) return floors.get(v);
      const own = ratio(lin(v)); const u = Math.min(1, Math.max(0, (own - I.FLOOR_FROM) / (I.FLOOR_TO - I.FLOOR_FROM)));
      let keep = 0;
      if (u > 0) {
        let lo = 0; let hi = 1;
        for (let k = 0; k < 14; k++) { const w = (lo + hi) / 2; if (ratio((gL + (light(v) - gL) * w) ** 3) >= floorTarget(own)) hi = w; else lo = w; }
        keep = u * u * (3 - 2 * u) * hi;
      }
      floors.set(v, keep);
      return keep;
    };
    let worst = 0; let edges = 0; let flat = 0; let solid = 0;
    for (let k = 0; k < 800; k++) {
      const x = 1 + ((k * 37) % (W - 2)); const y = 1 + ((k * 53) % (H - 2)); const i = y * W + x;
      const e = E[i];
      const keep = I.GRAPHIC_FLOOR + (1 - I.GRAPHIC_FLOOR) * I.tone(e);
      const stroke = I.strokeKeep(Math.abs(light(Y[i]) - gL));
      const w = Math.max(keep, stroke, floorOfY(Y[i]));
      for (let c = 0; c < 3; c++) {
        const g0 = light(ground[c]); const want = enc((g0 + (light(rgb[i * 3 + c]) - g0) * w) ** 3);
        worst = Math.max(worst, Math.abs(want - b[i * 4 + c]));
      }
      if (e > 40) edges++; else if (e === 0) flat++;
      if (e === 0 && stroke >= 1) solid++;
    }
    check(worst <= 2, `${label}: figure pixels fade toward the figure's own ground by max(their |error|, their contrast, the letters' floor) (worst channel difference ${worst})`);
    check(edges > 0 && flat > 100, `${label}: the figure has contours and flat ground (${edges} edge, ${flat} flat samples)`);
    // Grey line art and labels (near-grey pixels 1.8:1 or more off the ground) keep the letters'
    // floor, as a letter at level 0 does: the least drawn contrast over the floor's target.
    let floorWorst = Infinity; let greys = 0; let labelMin = Infinity;
    const lum = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    for (let i = 0; i < W * H; i += 3) {
      const r = rgb[i * 3]; const g = rgb[i * 3 + 1]; const bl = rgb[i * 3 + 2];
      if (Math.max(r, g, bl) - Math.min(r, g, bl) > 12) continue;
      const own = ratio(lum([r, g, bl]));
      if (own < I.FLOOR_TO) continue;
      greys++;
      const drawn = ratio(lum([b[i * 4], b[i * 4 + 1], b[i * 4 + 2]]));
      floorWorst = Math.min(floorWorst, drawn / floorTarget(own));
      if (own >= 2.35 && own <= 2.6) labelMin = Math.min(labelMin, drawn);
    }
    return { ground, rec, solid, floorWorst, greys, labelMin };
  };

  // Every run on screen is drawn in its own colours now: its highlight's rule mixes its own text
  // colour (over its own background) toward that background by its level's share, within 0.1 of
  // OKLab distance (pairs merge colours within PAIR_MERGE = 0.03). After a theme toggle this
  // holds before the next frame, for every member of a merged pair, not only its representative.
  const ruleErrors = () => {
    const M = model(); const s = st(); const h = win.innerHeight;
    const ruleCol = new Map(); for (const r of s.rules) ruleCol.set(r.shannon.pair * 7 + r.shannon.level, parseRgb(r.style.getPropertyValue('color')));
    const rgbaOf = v => { const m = /rgba?\(([^)]+)\)/.exec(v); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
    const bgOf = el => {
      const stack = [];
      for (let e = el; e; e = e.parentElement) { const c = rgbaOf(win.getComputedStyle(e).backgroundColor); stack.push(c); if (c[3] > 0.995) break; }
      let out = doc.documentElement.dataset.theme === 'dark' ? [18, 18, 18] : [255, 255, 255];
      for (let i = stack.length - 1; i >= 0; i--) { const c = stack[i]; out = out.map((v, k) => c[k] * c[3] + v * (1 - c[3])); }
      return out.map(Math.round);
    };
    let n = 0; let over = 0; let worst = 0; const examples = [];
    for (const block of s.page.inked) {
      const r = block.el.getBoundingClientRect();
      if (!(r.bottom > 0 && r.top < h)) continue;
      for (const run of block.runs) {
        if (!run.on) continue;
        const el = run.node.parentElement; const c = rgbaOf(win.getComputedStyle(el).color); const bg = bgOf(el);
        const ink = c[3] > 0.995 ? c.slice(0, 3) : c.slice(0, 3).map((v, k) => Math.round(v * c[3] + bg[k] * (1 - c[3])));
        const want = M.mix(bg, ink, M.inkAt(run.hl % 7, M.floorOf({ ink, bg })));
        const got = ruleCol.get(run.hl);
        if (!got) continue;
        const a = M.oklab(want); const g = M.oklab(got);
        const d = Math.hypot(a[0] - g[0], a[1] - g[1], a[2] - g[2]);
        n++; worst = Math.max(worst, d);
        if (d > 0.1) { over++; if (examples.length < 3) examples.push(`"${run.node.data.slice(run.from, run.to)}" ${el.tagName}: rgb(${got}) vs rgb(${want})`); }
      }
    }
    return { n, over, worst: +worst.toFixed(3), examples };
  };

  // The runs a shown block holds are in their highlights, with the levels of their letters.
  const checkRanges = label => {
    const s = st(); const page = s.page; const H = win.innerHeight; const near = model().NEAR_SCREENS;
    let shown = 0; let inHighlights = 0; let levelsOk = true; let farShown = 0; let nearHidden = 0; let total = 0;
    for (const block of page.blocks) {
      if (!block.runs.length) continue;
      const r = block.el.getBoundingClientRect();
      const clearlyNear = (r.width > 0 || r.height > 0) && r.bottom >= -H * near * 0.8 && r.top <= H * (1 + near * 0.8);
      const clearlyFar = r.bottom < -H * (near + 0.3) || r.top > H * (1 + near + 0.3);
      if (block.shown) {
        shown++;
        if (clearlyFar) farShown++;
        for (const run of block.runs) {
          total++;
          if (run.range && s.highlights[run.hl].has(run.range)) inHighlights++;
          const level = run.hl % (model().LEVELS - 1);
          for (let c = run.c0; c <= run.c1; c++) {
            const code = page.text.charCodeAt(c);
            if (code !== 32 && code !== 160 && code !== 10 && page.levels[c] !== level) levelsOk = false;
          }
        }
      } else if (clearlyNear) nearHidden++;
    }
    const registered = [...s.highlights].reduce((sum, h) => sum + h.size, 0);
    check(shown > 0 && inHighlights === total, `${label}: every run of a shown block is in its highlight (${inHighlights}/${total})`);
    check(levelsOk, `${label}: each run's letters have the run's level`);
    check(farShown === 0 && nearHidden === 0, `${label}: ranges exist for the blocks near the viewport only (${farShown} far shown, ${nearHidden} near hidden)`);
    check(registered === s.ranges && registered === total, `${label}: the highlights hold exactly those ranges (${registered}, ${s.ranges}, ${total})`);
    report.ranges[label] = registered;
    return registered;
  };
  const checkRules = label => {
    const s = st();
    const rules = [...doc.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules]; } catch (error) { return []; } }).filter(rule => rule.selectorText && rule.selectorText.includes('::highlight(lens-shannon-'));
    const names = ourHighlights();
    check(names.length > 0 && names.length <= 63 && names.every(name => /^lens-shannon-\d-\d$/.test(name)), `${label}: at most 63 highlights, named lens-shannon-<pair>-<level> (${names.length})`);
    check(rules.length === s.pairs.length * 7, `${label}: one rule per pair and level below 7 (${rules.length} for ${s.pairs.length} pairs)`);
    let ok = true;
    for (const rule of rules) {
      const [, p, level] = /lens-shannon-(\d)-(\d)/.exec(rule.selectorText).map(Number);
      const pair = s.pairs[p];
      const want = model().mix(pair.bg, pair.ink, model().inkAt(level, model().floorOf(pair)));
      if (!close(parseRgb(rule.style.color), want, 1)) { ok = false; failures.push(`${label}: rule ${rule.selectorText} is ${rule.style.color}, expected rgb(${want})`); }
    }
    check(ok, `${label}: each rule mixes its pair's ink toward its ground by the level's share`);
    const m = model();
    check(Math.abs(m.inkAt(0, 0.5) - 0.5) < 1e-9 && Math.abs(m.inkAt(7, 0.5) - 1) < 1e-9 && m.inkAt(1, 0.5) > 0.5 + 0.5 / 7 + 0.05 && m.inkAt(4, 0.5) > 0.5 + 0.5 * 4 / 7,
      `${label}: ink runs from the floor at level 0 to the original colour at level 7, on a concave curve (level 1 at ${m.inkAt(1, 0.5).toFixed(2)} of a 0.5 floor)`);
    // Legibility: level 0 keeps 3:1 against its ground (a pair with less keeps own^0.8), and at
    // least own^0.5; every level is at least as dark as level 0.
    const report0 = [];
    let legible = true;
    s.pairs.forEach(pair => {
      const own = m.contrast(pair.ink, pair.bg);
      const floor = m.floorOf(pair);
      const c0 = m.contrast(m.mix(pair.bg, pair.ink, m.inkAt(0, floor)), pair.bg);
      const want = Math.max(Math.min(m.CONTRAST_MIN, own ** m.CONTRAST_LOW), own ** m.CONTRAST_KEEP);
      report0.push(`${own.toFixed(1)}→${c0.toFixed(1)}`);
      if (c0 < want - 0.03 || (own >= 2.4 && c0 < 2)) legible = false;
      for (let level = 1; level < 7; level++) if (m.contrast(m.mix(pair.bg, pair.ink, m.inkAt(level, floor)), pair.bg) < c0 - 0.01) legible = false;
    });
    check(legible, `${label}: level 0 keeps a WCAG contrast of 3:1 (or own^0.8 below it, and own^0.5 at least) against its ground (own → level 0: ${report0.join(', ')})`);
    report.contrast[label] = report0;
    // Quantised colours: no two pairs are one colour on one ground (within PAIR_MERGE in OKLab).
    const lab = s.pairs.map(pair => [model().oklab(pair.ink), model().oklab(pair.bg)]);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    let twins = 0;
    for (let i = 0; i < lab.length; i++) for (let j = i + 1; j < lab.length; j++) if (dist(lab[i][0], lab[j][0]) <= model().PAIR_MERGE && dist(lab[i][1], lab[j][1]) <= model().PAIR_MERGE) twins++;
    check(twins === 0, `${label}: the colour pairs are quantised (${twins} near-identical pairs)`);
    // Coverage: nearly every letter read is drawn by its level (rarer colours keep their own).
    const page = s.page; let letters = 0; let own = 0;
    for (let n = 0; n < page.nodes.length; n++) {
      for (let c = page.nodeStart[n]; c < page.nodeEnd[n]; c++) {
        const code = page.text.charCodeAt(c);
        if (code === 32 || code === 160 || code === 10) continue;
        letters++; if (page.nodePair[n] < 0) own++;
      }
    }
    report.coverage[label] = +(1 - own / Math.max(1, letters)).toFixed(4);
    check(own <= 0.01 * letters, `${label}: at most 1 % of the letters keep their own colour (${own} of ${letters})`);
  };
  // What the browser paints: letters of level 0 and level 7 in view.
  const checkPaint = label => {
    const s = st(); const page = s.page; const H = win.innerHeight; const W = win.innerWidth;
    let low = 0; let lowOk = 0; let top = 0; let topOk = 0;
    for (let n = 0; n < page.nodes.length && (low < 30 || top < 30); n++) {
      if (page.nodePair[n] < 0) continue;
      const block = page.blocks[page.nodeBlock[n]];
      if (!block.shown) continue;
      for (let c = page.nodeStart[n]; c < page.nodeEnd[n]; c++) {
        const code = page.text.charCodeAt(c);
        if (code === 32 || code === 160) continue;
        const level = page.levels[c];
        if (level !== 0 && level !== 7) continue;
        const range = doc.createRange(); range.setStart(page.nodes[n], page.charOff[c]); range.setEnd(page.nodes[n], page.charOff[c] + 1);
        const r = range.getBoundingClientRect();
        if (r.top < 2 || r.bottom > H - 2 || r.left < 2 || r.right > W - 2 || r.width < 2) continue;
        const names = highlightAt(page.nodes[n], page.charOff[c]);
        if (names === undefined) continue;
        if (level === 0 && low < 30) { low++; if (names.length === 1 && names[0] === `lens-shannon-${page.nodePair[n]}-0`) lowOk++; }
        if (level === 7 && top < 30) { top++; if (names.length === 0) topOk++; }
      }
    }
    check(low >= 3 && lowOk === low, `${label}: the browser paints level-0 letters with their pair's faintest highlight (${lowOk}/${low})`);
    check(top >= 3 && topOk === top, `${label}: level-7 letters keep their own colour (${topOk}/${top})`);
  };

  try {
    /* 1. The model, on its own: exclusion, astral characters, and a repeated phrase. */
    await load('/');
    {
      compareModels('abracadabra abracadabra, cadabra abra! '.repeat(6), 'abracadabra');
      compareModels('Gödel, Escher, Bach — 𝔾ödel 𝔾ödel. Shwen-Jyen 尹訓健 尹訓健', 'astral and CJK');
      const two = model().run('xx');
      check(Math.abs(two.bits[0] - 16) < 1e-9, `the first symbol costs log2(65,536) = 16 bits (${two.bits[0]})`);
      check(Math.abs(two.bits[1] - 1) < 1e-9, `the second x: order 1 unseen, order 0 gives 1 / (1 + 1), 1 bit (${two.bits[1]})`);
      check(model().levelOf(0.99) === 0 && model().levelOf(1) === 1 && model().levelOf(6.5) === 6 && model().levelOf(7) === 7 && model().levelOf(19) === 7, 'levels: floor(bits), clamped to 0..7');
    }

    /* 2. Home, light, 1440x900: enter, the model, the ink, the images, hover, exit. */
    {
      const before = snapshot();
      const main = doc.getElementById('main-content');
      const textBefore = main.textContent;
      let began = performance.now();
      await lenses()._debug.goto(ID);
      report.timings.homeEnterMs = Math.round(performance.now() - began);
      check(lenses().current === ID, 'home: the lens enters');
      check(main.textContent === textBefore && main.innerHTML === before.main, 'home: the page text and markup are unchanged while active');
      const s = st(); const page = s.page;
      const caption = state().caption || [];
      check(caption[0] === LINE, `home: caption line (${caption[0]})`);
      check(caption[1] === `This page: ${s.bpc.toFixed(2)} bits per character, read top to bottom by an adaptive model.`, `home: caption note with the page's bits per character (${caption[1]})`);
      check(Math.abs(s.bpc - page.total / page.text.length) < 1e-9 && s.bpc > 2 && s.bpc < 6, `home: a plausible rate (${s.bpc.toFixed(3)} bits per character)`);
      report.bpc.home = +s.bpc.toFixed(3);
      compareModels(page.text, 'home: the page text');
      // What it reads: the visible text, in order; hidden text is not read.
      check(page.text.startsWith('Home\n'), `home: reading starts at the nav (${JSON.stringify(page.text.slice(0, 40))})`);
      const hidden = [...main.querySelectorAll('*')].find(el => win.getComputedStyle(el).display === 'none' && el.textContent.trim().length > 40);
      if (hidden) check(!page.text.includes(hidden.textContent.trim().slice(0, 40).replace(/\s+/g, ' ')), 'home: text that is not rendered is not read');
      check(!/ {2}| \n|\n /.test(page.text), 'home: whitespace collapses as rendered');
      const scope = ['site-nav', 'main-content', 'site-footer'].map(id => doc.getElementById(id));
      check(page.nodes.every(node => node.isConnected && scope.some(root => root.contains(node))), 'home: every text node read is in the scope');
      checkRules('home');
      checkRanges('home');
      checkPaint('home');
      // Emergent: the owner's name fades after its first occurrence; word beginnings are darker.
      const name = 'Xunjian Yin';
      const hits = []; for (let at = page.text.indexOf(name); at >= 0; at = page.text.indexOf(name, at + 1)) hits.push(at);
      const cost = at => { let sum = 0; for (let k = at; k < at + name.length; k++) sum += page.bits[k]; return sum; };
      const later = hits.slice(2).map(cost).sort((a, b) => a - b);
      const median = later.length ? later[later.length >> 1] : Infinity;
      report.timings.nameBits = { first: +cost(hits[0]).toFixed(1), second: hits[1] ? +cost(hits[1]).toFixed(1) : null, laterMedian: +median.toFixed(1), occurrences: hits.length };
      check(hits.length >= 4 && cost(hits[0]) > 4 * median, `home: "${name}" costs ${cost(hits[0]).toFixed(1)} bits at first and ${median.toFixed(1)} (median) later`);
      const words = [...page.text.matchAll(/\p{L}{4,}/gu)];
      const firstBits = words.reduce((sum, w) => sum + page.bits[w.index], 0) / words.length;
      const lastBits = words.reduce((sum, w) => sum + page.bits[w.index + w[0].length - 1], 0) / words.length;
      report.timings.wordEnds = { first: +firstBits.toFixed(2), last: +lastBits.toFixed(2), words: words.length };
      check(firstBits > 2 * lastBits, `home: word beginnings (${firstBits.toFixed(2)} bits) are darker than word endings (${lastBits.toFixed(2)} bits)`);
      // Images: the portrait as the residual of the median edge detector, pixel for pixel.
      const shown = await imagesRendered('home');
      const portrait = doc.querySelector('#main-content .profile-photo');
      const overlay = s.media && s.media.overlays.find(o => o.img === portrait);
      check(!!overlay && overlay.kind === 'photo', 'home: the portrait has a residual overlay');
      if (overlay) {
        const canvas = overlay.canvas; const W = canvas.width; const H = canvas.height;
        const kit = await lenses()._debug.ctx.mediaKit();
        const s2 = win.getComputedStyle(portrait);
        const source = await kit.drawAsync(portrait, parseFloat(canvas.style.width), parseFloat(canvas.style.height), canvas.pixelRatio || win.devicePixelRatio, { objectFit: s2.objectFit, objectPosition: s2.objectPosition });
        check(source.width === W && source.height === H, `home: the overlay is the image's own size (${W}x${H})`);
        const rec = lens()._image.record(canvas);
        check(!!rec && rec.small === true && parseFloat(canvas.style.width) < lens()._image.SMALL_PHOTO, 'home: the portrait (under 300 CSS px) is read through a 1-2-1 blur');
        const a = source.getContext('2d').getImageData(0, 0, W, H).data;
        const b = canvas.getContext('2d').getImageData(0, 0, W, H).data;
        const { E } = residualMap(a, W, H, { blur: true });
        const colours = lens()._image.colours(portrait);
        const paint = inkOf(canvas);
        check(!!paint, `home: the portrait's drawing is coloured by its ink filter (${canvas.style.filter})`);
        let worst = 0; let worstGrey = 0; let blank = 0; let inked = 0;
        for (let k = 0; k < 400 && paint; k++) {
          const x = 2 + ((k * 37) % (W - 4)); const y = 2 + ((k * 53) % (H - 4)); const i = y * W + x;
          const t = lens()._image.tone(E[i]); const v = b[i * 4];
          worstGrey = Math.max(worstGrey, Math.abs(v - toneGrey(t)), Math.abs(b[i * 4 + 1] - v), Math.abs(b[i * 4 + 2] - v));
          const want = photoWant(colours, t);
          worst = Math.max(worst, ...want.map((w, c) => Math.abs(w - paint(v)[c])));
          if (E[i] <= 3) blank++; else inked++;
        }
        check(worstGrey <= 1, `home: the overlay holds the tones of the median edge detector's |error| as greys (worst difference ${worstGrey})`);
        check(worst <= 2, `home: overlay pixels are painted as the inked |error| of the median edge detector (worst channel difference ${worst})`);
        check(blank > 20 && inked > 20, `home: the residual has both bare ground and ink (${blank} blank, ${inked} inked samples)`);
        // Speckle: the blurred read leaves most of the portrait bare (the raw read inks a third).
        const raw = residualMap(a, W, H).E;
        let bare = 0; let rawBare = 0;
        for (let i = 0; i < W * H; i++) { if (E[i] <= 3) bare++; if (raw[i] <= 3) rawBare++; }
        report.timings.portraitBare = { blurred: +(bare / (W * H)).toFixed(2), raw: +(rawBare / (W * H)).toFixed(2) };
        check(bare / (W * H) > 0.8 && bare > rawBare, `home: the portrait is a drawing, not a speckle (${(100 * bare / (W * H)).toFixed(0)} % bare ground; ${(100 * rawBare / (W * H)).toFixed(0)} % without the blur)`);
      }
      check(shown.every(c => c.dataset.kind === 'photo' || c.dataset.kind === 'graphic'), 'home: overlays are classified');
      // The original goes under its drawing once the drawings have faded in.
      await until(() => doc.documentElement.classList.contains('lens-shannon-covered'), 'the originals to be covered', 4000).catch(() => {});
      check(doc.documentElement.classList.contains('lens-shannon-covered') && sheetOnly(portrait), `home: the original portrait is hidden under its drawing, painted as its blank sheet (${win.getComputedStyle(portrait).filter})`);

      clickable('home');
      // Hover: the bits of "Duke", letter by letter, and their total.
      const duke = [...doc.querySelectorAll('#main-content a')].find(a => a.textContent.trim() === 'Duke University');
      const node = duke.firstChild;
      const range = doc.createRange(); range.setStart(node, 1); range.setEnd(node, 2);
      const box = range.getBoundingClientRect();
      pointer('pointermove', box.left + box.width / 2, box.top + box.height / 2);
      await nextFrames(3);
      const tip = doc.querySelector('.lens-shannon-tip');
      const at = page.nodes.indexOf(node);
      const c0 = page.nodeStart[at];
      const letters = [...tip.querySelectorAll('.lens-shannon-tip-letter')].map(el => el.textContent).join('');
      const values = [...tip.querySelectorAll('.lens-shannon-tip-bits')].map(el => el.textContent);
      const expectBits = [0, 1, 2, 3].map(k => page.bits[c0 + k].toFixed(1));
      const total = [0, 1, 2, 3].reduce((sum, k) => sum + page.bits[c0 + k], 0);
      check(win.getComputedStyle(tip).visibility === 'visible' && letters === 'Duke' && JSON.stringify(values) === JSON.stringify(expectBits), `home: hovering "Duke" shows each letter's bits (${letters}: ${values.join(' ')} vs ${expectBits.join(' ')})`);
      check(tip.querySelector('.lens-shannon-tip-total').textContent === `= ${total.toFixed(1)} bits`, `home: and the word's total (${tip.querySelector('.lens-shannon-tip-total').textContent})`);
      const tipBox = tip.getBoundingClientRect();
      check(tipBox.left >= 0 && tipBox.right <= win.innerWidth && tipBox.bottom <= box.top, 'home: the tooltip sits above the word, inside the viewport');
      check(win.getComputedStyle(tip).fontFamily.includes('Palatino') && win.getComputedStyle(tip).borderRadius === '0px', 'home: a square serif tooltip');
      const hit = doc.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      check(hit && hit.closest('a') === duke, 'home: the hovered link stays clickable');
      // The link under the mouse drops its highlights: the site's hover colour shows on all of
      // its letters; leaving it brings them back.
      const dukeRuns = () => st().page.inked.flatMap(block => block.runs).filter(run => duke.contains(run.node));
      const onBefore = dukeRuns().filter(run => run.on).length;
      duke.dispatchEvent(new win.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      const onHover = dukeRuns().filter(run => run.on).length;
      const paintedHover = [...Array(node.length).keys()].every(k => { const names = highlightAt(node, k); return !names || names.length === 0; });
      doc.querySelector('#main-content').dispatchEvent(new win.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      const onAfter = dukeRuns().filter(run => run.on).length;
      check(onBefore > 0 && onHover === 0 && paintedHover && onAfter === onBefore, `home: a hovered link shows its own colours, and its ink returns when left (${onBefore} → ${onHover} → ${onAfter} runs)`);
      check(st().ranges === [...st().highlights].reduce((sum, h) => sum + h.size, 0), 'home: the range count follows the hovered link');
      pointer('pointermove', 5, win.innerHeight - 5);
      await nextFrames(3);
      check(win.getComputedStyle(tip).visibility === 'hidden', 'home: the tooltip goes off the text');
      // At rest: no frame callback runs.
      await nextFrames(4); await delay(100);
      check(state().frames === 0 && !state().raf && pending.size === 0, `home: no frame callback runs while nothing moves (${state().frames} frames, raf ${state().raf})`);
      // Scrolling: no long task, ranges follow the viewport.
      const since = win.performance.now();
      for (let k = 1; k <= 12; k++) { win.scrollTo({ top: k * 160, behavior: 'instant' }); await delay(60); }
      await delay(300);
      checkRanges('home scrolled');
      report.longTasks.homeScroll = longTasks.filter(t => t.at >= since && t.ms > 50).map(t => t.ms);
      check(report.longTasks.homeScroll.length === 0, `home: no task over 50 ms while scrolling (${report.longTasks.homeScroll.join(', ')})`);
      win.scrollTo({ top: 0, behavior: 'instant' }); await delay(200);
      const beforeExit = { ...before, scroll: win.scrollY };
      began = performance.now();
      await lenses().reset(); await idle(); await nextFrames(2);
      report.timings.homeExitMs = Math.round(performance.now() - began);
      restored(beforeExit, 'home after exit');
      check(win.getComputedStyle(doc.querySelector('#main-content .profile-photo')).opacity === '1' && win.getComputedStyle(doc.querySelector('#main-content .profile-photo')).filter === 'none', 'home: the original portrait returns after exit');
      report.stats.home = { ...lens()._stats };
    }

    /* 3. The reading front half way, and the ink half returned. */
    {
      const before = snapshot();
      lens()._hold = 0.45;
      lenses()._debug.goto(ID);
      await until(() => st() && st().page && Number.isFinite(st().front) && st().front > 0, 'the reading front');
      await nextFrames(3);
      const s = st(); const page = s.page; const f = s.front;
      const { band } = s.sweepInfo;
      const all = page.blocks.filter(block => block.held).flatMap(block => block.runs);
      const behind = all.filter(run => run.c1 < f - band);
      const ahead = all.filter(run => run.c0 > f + 1);
      check(all.length > 0 && behind.length > 0 && ahead.length > 0, `enter: half way, the front has text behind and ahead of it (${behind.length} behind, ${ahead.length} ahead)`);
      check(behind.every(run => run.range && s.highlights[run.hl].has(run.range)), 'enter: letters well behind the front have settled to their levels');
      check(ahead.every(run => !run.range || !s.highlights[run.hl].has(run.range)), 'enter: letters ahead of the front keep their full ink');
      // A letter just behind the front is drawn at an intermediate level: darker than its own.
      let between = 0;
      for (let c = Math.floor(f) - 1; c > f - band && c > 0; c--) {
        const n = page.charNode[c];
        if (n < 0 || page.nodePair[n] < 0 || page.levels[c] > 3) continue;
        const names = highlightAt(page.nodes[n], page.charOff[c]);
        if (!names || !names.length) continue;
        const shown = +names[0].split('-').pop();
        if (shown > page.levels[c]) between++;
      }
      check(between > 0, `enter: letters inside the soft front are drawn between full ink and their level (${between})`);
      lens()._hold = null;
      await idle();
      check(lenses().current === ID && !st().page.blocks.some(block => block.held), 'enter: the sweep completes');
      checkRanges('after the sweep');
      // Exit, frozen half way (p = 0.5, eased 1 - (1 - p)^2 = 0.75): every rule is three
      // quarters of the way from its level's colour to its pair's ink, in OKLab. A level near
      // the ink (level 6 of a pale pair) moves less than a byte step, so the check is the
      // colour itself, within byte rounding, and the rules that have room to move have moved.
      lens()._hold = 0.5;
      const leaving = lenses().reset();
      await delay(150);
      const s3 = st();
      let ok = s3 && s3.rules.length > 0; let moved = 0; let room = 0; let worstExit = 0; let worstAt = '';
      for (const rule of (s3 ? s3.rules : [])) {
        const { pair, level } = rule.shannon;
        const p = s3.pairs[pair];
        // From the level's share w of the way from ground to ink, three quarters of the rest.
        const w = model().inkAt(level, model().floorOf(p));
        const now = parseRgb(rule.style.color);
        const want = model().mix(p.bg, p.ink, w + (1 - w) * 0.75);
        const off = Math.max(...now.map((v, i) => Math.abs(v - want[i])));
        if (off > worstExit) { worstExit = off; worstAt = `pair ${pair} (${p.ink} on ${p.bg}) level ${level}: ${rule.style.color} vs rgb(${want})`; }
        if (off > 1) ok = false;
        const from = model().oklab(model().mix(p.bg, p.ink, w))[0]; const to = model().oklab(p.ink)[0]; const L = model().oklab(now)[0];
        if (Math.abs(to - from) > 0.03) { room++; if (Math.abs(L - from) > 0.5 * Math.abs(to - from)) moved++; }
      }
      check(ok && room > 0 && moved === room, `exit: half way, each rule is three quarters of the way from its level's colour to its pair's ink (worst channel difference ${worstExit} at ${worstAt}; ${moved} of ${room} rules with room have moved)`);
      lens()._hold = null;
      await leaving; await idle(); await nextFrames(2);
      restored({ ...before, scroll: win.scrollY }, 'after a held enter and exit');
    }

    /* 4. Reduced motion: the settled state at once, no transition, no frames at rest. */
    {
      reduced = true;
      const before = snapshot();
      const sweeps = lens()._stats.sweepFrames;
      const began = performance.now();
      await lenses()._debug.goto(ID);
      const took = Math.round(performance.now() - began);
      report.timings.reducedEnterMs = took;
      check(took < 400, `reduced motion: enters at once (${took} ms)`);
      check(lens()._stats.sweepFrames === sweeps, 'reduced motion: no reading front');
      checkRanges('reduced motion');
      const shown = await imagesRendered('reduced motion');
      check(shown.every(c => !c.style.transition || /^(none|all 0s)/.test(c.style.transition) || c.style.transition === ''), 'reduced motion: overlays appear without a fade');
      await nextFrames(3);
      check(pending.size === 0 && !state().raf, 'reduced motion: no animation loop at rest');
      const leaving = performance.now();
      await lenses().reset(); await idle();
      check(performance.now() - leaving < 300, `reduced motion: leaves at once (${Math.round(performance.now() - leaving)} ms)`);
      await nextFrames(2);
      restored(before, 'reduced motion');
      reduced = false;
    }

    /* 5. Dark theme, and the theme toggled while the lens is on. */
    {
      doc.documentElement.dataset.theme = 'dark'; localStorage.setItem('theme', 'dark');
      await delay(100);
      const before = snapshot();
      await lenses()._debug.goto(ID);
      const s = st();
      const ground = model().oklab(s.pairs[0].bg)[0];
      check(ground < 0.3, `dark: the pairs mix toward the dark ground (L ${ground.toFixed(2)})`);
      check(doc.documentElement.classList.contains('lens-shannon-dark'), 'dark: the tooltip is dark');
      checkRules('dark');
      checkPaint('dark');
      const shown = await imagesRendered('dark');
      if (shown.length) {
        const c = shown[0]; const mean = paintedMean(c);
        const colours = lens()._image.colours(s.media.overlays.find(o => o.canvas === c).img);
        const { bg, ink } = colours;
        check(model().oklab(bg)[0] < 0.3, 'dark: images are inked on the dark ground');
        check(mean < 110, `dark: the residual is light ink on the dark ground (mean ${mean.toFixed(0)})`);
        // The dark theme's grey ink spans 0.62 of OKLab lightness off its ground, black on white
        // 1.0: a photo's tones are steepened so a given |error| stands nearly as far off the
        // ground as in the light theme (at least 0.85 of it up to tone 0.6), up to the ink.
        const paint = inkOf(c); const L = rgb => model().oklab(rgb)[0];
        const ratios = [0.1, 0.2, 0.3, 0.45, 0.6].map(t => Math.abs(L(paint(toneGrey(t))) - L(bg)) / t);
        report.timings.darkToneSpan = { span: +Math.abs(L(ink) - L(bg)).toFixed(3), perTone: ratios.map(r => +r.toFixed(2)) };
        check(!!paint && ratios.every(r => r >= 0.85), `dark: a photo's tones stand off the dark ground about as far as on the light one (${ratios.map(r => r.toFixed(2)).join(', ')} of the light theme's)`);
      }
      // The toggle, back to light while active. Before the next frame is painted the rules carry
      // the light theme's colours (read from each pair's element), the tooltip follows, the
      // drawings on screen are on the light ground, and no colour transition of the site runs
      // (the lens read the new colours in one still style pass). No drawing is missing in any frame.
      const shownCount = () => overlays().filter(c => +win.getComputedStyle(c).opacity > 0.99).length;
      const shownBefore = shownCount();
      let missing = 0; let watched = 0; let watching = true;
      const watchFrames = () => { if (!watching) return; watched++; if (shownCount() < shownBefore) missing++; win.requestAnimationFrame(watchFrames); };
      win.requestAnimationFrame(watchFrames);
      const commits = lens()._stats.commits;
      doc.documentElement.dataset.theme = 'light'; localStorage.setItem('theme', 'light');
      await Promise.resolve();                    // the lens's MutationObserver has run; nothing is painted yet
      {
        const s2 = st();
        const want = s2.rules.map(rule => { const pair = s2.pairs[rule.shannon.pair]; return model().mix(pair.bg, pair.ink, model().inkAt(rule.shannon.level, model().floorOf(pair))); });
        const rulesNow = s2.rules.length > 0 && s2.rules.every((rule, i) => close(parseRgb(rule.style.color), want[i], 1));
        const inks = s2.pairs.filter(pair => /^rgb\(/.test(win.getComputedStyle(pair.el).color));
        const inksNow = inks.every(pair => close(pair.ink, parseRgb(win.getComputedStyle(pair.el).color), 2));
        check(rulesNow && inksNow && s2.pairs.every(pair => model().oklab(pair.bg)[0] > 0.9),
          `theme toggle: before the next frame, every rule mixes the light theme's ink toward the light ground (${s2.pairs.map(pair => pair.bg.join(',')).join(' | ')})`);
        check(!doc.documentElement.classList.contains('lens-shannon-dark') && !doc.documentElement.classList.contains('lens-shannon-still'), 'theme toggle: the tooltip follows at once, and the still pass is over');
        const errs = ruleErrors();
        report.timings.themeRuns = { home: errs };
        check(errs.n > 50 && errs.over === 0, `theme toggle: before the next frame every run on screen is in its own new colours, merged pairs too (${errs.over} of ${errs.n} runs off by more than 0.1 OKLab, worst ${errs.worst}; ${errs.examples.join('; ')})`);
        check(sessionStorage.getItem('lenses-active') === ID && sessionStorage.getItem('lenses-ground') === '#ffffff' && lens().ground === '#ffffff',
          `theme toggle: the ground the next page is hidden over follows the theme (${sessionStorage.getItem('lenses-ground')}, ${lens().ground})`);
        const onScreen = overlays().filter(c => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < win.innerHeight; });
        const means = onScreen.map(paintedMean);
        check(onScreen.length > 0 && means.every(m => m > 150), `theme toggle: the drawings on screen are painted on the light ground before the next frame (means ${means.map(m => m.toFixed(0)).join(', ')})`);
        report.timings.themeMs = lens()._stats.themeMs;
      }
      await nextFrames(1);
      const running = doc.getAnimations().filter(a => a.transitionProperty && /color/.test(a.transitionProperty));
      check(running.length === 0, `theme toggle: no colour transition of the site runs under the lens (${running.length})`);
      await until(() => lens()._stats.commits > commits && !st().building, 'the page model to be rebuilt', 5000);
      await nextFrames(2);
      watching = false;
      check(watched > 2 && missing === 0, `theme toggle: no drawing is missing in any frame (${missing} of ${watched} frames)`);
      checkRules('after the theme toggle');
      doc.documentElement.dataset.theme = 'dark'; localStorage.setItem('theme', 'dark');
      await Promise.resolve();
      check(model().oklab(st().pairs[0].bg)[0] < 0.3 && doc.documentElement.classList.contains('lens-shannon-dark'), 'theme toggle: and back to dark at once');
      await lenses().reset(); await idle(); await nextFrames(2);
      restored(before, 'dark theme');
      doc.documentElement.dataset.theme = 'light'; localStorage.setItem('theme', 'light');
    }

    /* 5b. A white figure on the dark theme stays a white figure: its own ground, legible labels. */
    {
      doc.documentElement.dataset.theme = 'dark'; localStorage.setItem('theme', 'dark');
      await load('/blogs/agents-that-learn-after-deployment.html');
      const figure = doc.querySelector('#main-content img[src$=".svg"]');
      win.scrollTo(0, figure.getBoundingClientRect().top + win.scrollY - 80);
      await delay(200);
      const before = snapshot();
      await lenses()._debug.goto(ID);
      await imagesRendered('dark blog');
      const overlay = st().media.overlays.find(o => o.img === figure);
      check(!!overlay && overlay.kind === 'graphic', 'dark blog: the SVG figure has a graphic overlay');
      if (overlay) {
        const { ground, floorWorst, greys, labelMin } = await checkGraphic(overlay, 'dark blog figure');
        report.timings.blogGreys = { greys, floorWorst: +floorWorst.toFixed(3), labelMin: +labelMin.toFixed(2) };
        check(greys > 50 && floorWorst >= 0.97, `dark blog: grey lines and labels keep the letters' floor (${greys} grey pixels; least drawn contrast ${floorWorst.toFixed(3)} of the floor's target)`);
        check(!(labelMin < 1.95), `dark blog: a 2.35-2.6:1 grey label keeps 2:1 or more (least ${labelMin.toFixed(2)}:1)`);
        const page = lens()._image.colours(figure).bg;
        check(model().oklab(page)[0] < 0.3 && model().oklab(ground)[0] > 0.9, `dark blog: the figure fades toward its own white ground (${ground}), not the dark page (${page})`);
        // The ground is one colour, and the labels stand clearly off it.
        const c = overlay.canvas; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let atGround = 0; let ink = 0; const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const px = [d[i], d[i + 1], d[i + 2]];
          if (close(px, ground, 3)) atGround++;
          else if (model().contrast(px, ground) >= 4.5) ink++;
        }
        check(atGround / n > 0.5, `dark blog: the figure's ground is a single colour (${(100 * atGround / n).toFixed(0)} % of its pixels)`);
        check(ink / n > 0.01, `dark blog: its labels and contours stand off the ground at 4.5:1 or more (${(100 * ink / n).toFixed(1)} % of its pixels)`);
      }
      // The theme toggled on the post (dark to light, then back): every run's colour follows
      // before the next frame (the post's body text and its strong text merge in one theme).
      for (const theme of ['light', 'dark']) {
        const commits = lens()._stats.commits;
        doc.documentElement.dataset.theme = theme;
        await Promise.resolve();
        const errs = ruleErrors();
        report.timings.themeRuns[`blog to ${theme}`] = errs;
        check(errs.n > 50 && errs.over === 0, `dark blog: toggled to ${theme}, every run on screen is in its own new colours before the next frame (${errs.over} of ${errs.n} off by more than 0.1, worst ${errs.worst}; ${errs.examples.join('; ')})`);
        await until(() => lens()._stats.commits > commits && !st().building, 'the page model to be rebuilt', 5000).catch(() => {});
        await nextFrames(2);
      }
      await lenses().reset(); await idle(); await nextFrames(2);
      restored({ ...before, scroll: win.scrollY }, 'dark blog');
      doc.documentElement.dataset.theme = 'light'; localStorage.setItem('theme', 'light');
    }

    /* 6. Late content: an abstract opened on publications is read. */
    {
      await load('/publications.html');
      // The page's own toggle moves the hidden attribute to the end of the list on its first
      // close: one open-and-close cycle first, so the markup compared is the page's own.
      const first = doc.querySelector('#main-content .detail-toggle');
      first.click(); await delay(700); first.click(); await delay(400);
      const before = snapshot();
      await lenses()._debug.goto(ID);
      const length = st().page.text.length;
      const toggle = doc.querySelector('#main-content .detail-toggle');
      toggle.click();
      await until(() => st().page.text.length > length + 100, 'the opened abstract to be read', 5000);
      check(st().page.text.length > length + 100, `late content: the opened abstract is read (${length} → ${st().page.text.length} characters)`);
      checkRanges('publications with an abstract open');
      await delay(700);                          // the page's own opening animation ends first
      toggle.click();
      await until(() => st().page.text.length === length, 'the closed abstract to be dropped', 5000);
      check(st().page.text.length === length, 'late content: the closed abstract is no longer read');
      report.bpc.publications = +st().bpc.toFixed(3);
      await lenses().reset(); await idle(); await nextFrames(2);
      restored(before, 'publications');
    }

    /* 7. Arrival with the page: photography, a paper, the longest paper. */
    for (const path of ['/photography.html', '/papers/godel-agent.html', LONGEST_PAPER]) {
      await load(path);
      const before = textual();
      // The lens's ground is the page's own (read when the core remembers the lens).
      const ground = lens().ground;
      const own = [doc.documentElement, doc.body].map(el => win.getComputedStyle(el).backgroundColor).find(c => /^rgb\(/.test(c));
      check(/^#[0-9a-f]{6}$/.test(ground) && own && close(parseRgb(own), [1, 3, 5].map(i => parseInt(ground.slice(i, i + 2), 16)), 0), `${path}: the lens's ground is the page's own (${ground}, ${own})`);
      // Arrival: sessionStorage carries the lens and its ground; the page is hidden over that
      // ground until the lens has arrived, then shows settled.
      await load(path, { lens: ID, ground, settle: false, watch: true });
      const first = imageWatch.firstState;
      check(first && (first.arriving === ID || first.revealing === ID) && first.body === 0 && close(parseRgb(first.ground), parseRgb(own), 0), `${path}: the first frame is hidden over the page's own ground (${JSON.stringify(first)})`);
      check(win.getComputedStyle(doc.body).opacity === '1' && !doc.getElementById('lenses-prepaint'), `${path}: the page shows once the lens has arrived, and the ground is lifted`);
      const arrivedAt = Math.round(win.performance.now());
      report.timings[`arrival ${path}`] = arrivedAt;
      check(!state().caption, `${path}: no caption on arrival`);
      check(lens()._stats.arriveMs !== null && lens()._stats.arriveMs <= 350, `${path}: arrive() settles within 350 ms (${lens()._stats.arriveMs} ms)`);
      report.timings[`arrive() ${path}`] = lens()._stats.arriveMs;
      check(lenses().current === ID && st().page && st().ranges > 0, `${path}: the lens has arrived with its highlights`);
      report.bpc[path] = +st().bpc.toFixed(3);
      // Let the page settle, then check the ink and the images.
      let last = ''; let since = performance.now();
      await until(() => { const now = doc.getElementById('main-content').innerHTML; if (now !== last) { last = now; since = performance.now(); } return performance.now() - since > 600; }, `${path} to settle`, 10000);
      await delay(300);
      checkRanges(path);
      checkRules(path);
      checkPaint(path);
      {
        // A whole page stays readable: the share of its letters at each level, and how many are
        // drawn under 2:1 (none: a pair of less than 2.4:1 of its own keeps its ratio to the 0.8).
        const s = st(); const page = s.page; const m = model();
        const counts = new Array(8).fill(0); let letters = 0; let under2 = 0; const ratios = [];
        const ratioAt = s.pairs.map(pair => [...Array(7).keys()].map(level => m.contrast(m.mix(pair.bg, pair.ink, m.inkAt(level, m.floorOf(pair))), pair.bg)));
        for (let n = 0; n < page.nodes.length; n++) {
          const p = page.nodePair[n];
          for (let c = page.nodeStart[n]; c < page.nodeEnd[n]; c++) {
            const code = page.text.charCodeAt(c);
            if (code === 32 || code === 160 || code === 10) continue;
            letters++; counts[page.levels[c]]++;
            if (p < 0) continue;
            const own = m.contrast(s.pairs[p].ink, s.pairs[p].bg);
            const r = page.levels[c] < 7 ? ratioAt[p][page.levels[c]] : own;
            ratios.push(r);
            if (r < 2 && own >= 2.4) under2++;
          }
        }
        ratios.sort((a, b) => a - b);
        report.levels[path] = { shares: counts.map(k => +(100 * k / letters).toFixed(1)), medianContrast: +ratios[ratios.length >> 1].toFixed(2), under3: +(100 * ratios.filter(r => r < 3).length / ratios.length).toFixed(1) };
        check(under2 === 0, `${path}: no letter is drawn under 2:1 against its ground (${under2}; median ${report.levels[path].medianContrast}:1)`);
      }
      const shown = await imagesRendered(path);
      if (imageWatch) {
        imageWatch.stop = true;
        report.timings[`colour frames on arrival ${path}`] = `${imageWatch.colour} of ${imageWatch.frames} (${imageWatch.hidden} hidden)`;
        report.timings[`drawings in view shown on arrival ${path}`] = imageWatch.drawn;
        check(imageWatch.frames > 5 && imageWatch.colour === 0, `${path}: no frame of the arrival shows a colour original (${imageWatch.colour} of ${imageWatch.frames} frames, first at ${imageWatch.first} ms)`);
        report.timings[`framed sheets on arrival ${path}`] = `${imageWatch.framed} frames`;
        check(imageWatch.blank === 0, `${path}: no frame of the arrival shows an image as a blank hole: a pending image is a framed sheet (${imageWatch.blank} blank frames, ${imageWatch.framed} with a framed sheet)`);
        check(imageWatch.fadingAtReveal === 0, `${path}: a drawing ready before the page shows is shown at once, not faded in over the reveal (${imageWatch.fadingAtReveal} fading)`);
        check(imageWatch.hidden > 0 && imageWatch.plain === 0, `${path}: no frame of the arrival shows letters in full ink (${imageWatch.plain} of ${imageWatch.frames - imageWatch.hidden} shown frames; ${imageWatch.hidden} hidden)`);
        imageWatch = null;
      }
      if (path === '/photography.html') {
        check(shown.length >= 4 && shown.every(c => c.dataset.kind === 'photo'), `${path}: the photographs are redrawn (${shown.length})`);
        // The first photograph's sky is flat: bare ground, inside a hairline frame.
        const first = shown.map(c => ({ c, r: c.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)[0].c;
        const g = first.getContext('2d'); const paint = inkOf(first) || (v => [v, v, v]);
        const sky = paint(g.getImageData(Math.floor(first.width * 0.7), Math.floor(first.height * 0.08), 1, 1).data[0]);
        const edge = paint(g.getImageData(Math.floor(first.width / 2), 0, 1, 1).data[0]);
        check(sky[0] > 235 && sky[1] > 235 && sky[2] > 235, `${path}: a flat sky stays blank (${sky.join(',')})`);
        check(edge[0] < 235, `${path}: a hairline keeps the photograph's edge (${edge[0]})`);
        // The theme toggled with the gallery on screen: the drawings follow by their ink filters
        // (a style write each), so the toggle's task stays short at any pixel ratio.
        const times = [];
        for (const theme of ['dark', 'light', 'dark', 'light']) {
          const commits = lens()._stats.commits;
          doc.documentElement.dataset.theme = theme;
          await Promise.resolve();
          times.push(lens()._stats.themeMs);
          if (theme === 'dark') {
            const c = overlays().find(canvas => { const r = canvas.getBoundingClientRect(); return r.bottom > 0 && r.top < win.innerHeight; });
            check(!!c && paintedMean(c) < 110, `${path}: toggled dark, a drawing on screen is painted on the dark ground before the next frame (mean ${c && paintedMean(c).toFixed(0)})`);
          }
          await until(() => lens()._stats.commits > commits && !st().building, 'the page model to be rebuilt', 5000).catch(() => {});
          await nextFrames(2);
        }
        times.sort((a, b) => a - b);
        report.timings.photographyThemeMs = times;
        check(times[times.length >> 1] <= 8 && times[times.length - 1] <= 16, `${path}: a theme toggle takes ${times.join(', ')} ms (median within 8 ms)`);
      }
      if (path === '/papers/godel-agent.html') {
        // A figure (a graphic): its own colours faded toward its own ground, pixel for pixel; a
        // bold label's or a thick stroke's flat interior keeps its ink.
        const s = st();
        const overlay = s.media && s.media.overlays.find(o => o.kind === 'graphic' && o.canvas.width > 40 && o.canvas.height > 40);
        check(!!overlay, `${path}: a figure has a residual overlay (kinds ${s.media && s.media.overlays.map(o => o.kind).join(', ')})`);
        if (overlay) {
          const { solid } = await checkGraphic(overlay, path);
          check(solid > 0, `${path}: predictable pixels of solid strokes keep their ink (${solid} samples)`);
        }
        // The body of a closed <details> is not read; opened, it is.
        const details = [...doc.querySelectorAll('#main-content details')].find(d => !d.open && d.querySelector(':scope > :not(summary)') && d.textContent.length > 200);
        if (details) {
          const body = [...details.children].filter(el => el.tagName !== 'SUMMARY').map(el => el.textContent).join(' ').replace(/\s+/g, ' ').trim().slice(0, 30);
          check(body.length > 10 && !st().page.text.includes(body), `${path}: the body of a closed <details> is not read ("${body}")`);
          details.open = true;
          await until(() => st().page.text.includes(body), 'the opened details to be read', 5000).catch(() => {});
          check(st().page.text.includes(body), `${path}: an opened <details> is read`);
          details.open = false;
          await until(() => !st().page.text.includes(body), 'the closed details to be dropped', 5000).catch(() => {});
          await delay(300);
        }
        // Jumps: the paper's section links and a jump of the scrollbar land on inked text in
        // their first frame (scroll events come before the paint; the observer only after it).
        const unshownOnScreen = () => st().page.inked.filter(block => {
          const r = block.el.getBoundingClientRect();
          return r.bottom > 0 && r.top < win.innerHeight && r.height > 0 && !block.shown;
        }).length;
        // An image on screen in that frame shows its drawing or, until the helper attaches it (a
        // frame or two later), its own original (a graphic): never its blank sheet.
        const blankImages = () => [...doc.querySelectorAll('#main-content img')].filter(img => {
          const r = img.getBoundingClientRect();
          if (!(r.bottom > 0 && r.top < win.innerHeight && r.width > 24 && r.height > 24) || !img.complete || /\/\//.test(img.getAttribute('src') || '')) return false;
          const drawn = overlays().some(c => { const b = c.getBoundingClientRect(); return Math.abs(b.left - r.left) < 3 && Math.abs(b.top - r.top) < 3 && +win.getComputedStyle(c).opacity > 0.99; });
          const look = win.getComputedStyle(img);
          return !drawn && !(look.opacity === '1' && look.filter === 'none');
        }).map(img => img.getAttribute('src').split('/').pop());
        const firstFrame = () => new Promise(resolve => win.requestAnimationFrame(() => { const blocks = unshownOnScreen(); const images = blankImages(); resolve([blocks, images]); }));
        // A fragment link scrolls in the frame's own layout pass, after the frame callbacks,
        // and reports the scroll only a frame later: nothing here reads the layout between
        // the click and the frame (that read would make the jump at once), as a reader's click.
        const jumps = [];
        const citation = doc.getElementById('citation');
        const citationOpen = citation ? citation.open : null;
        for (const hash of ['#findings', '#citation', '#method']) {
          const link = doc.querySelector(`header.site-header a[href="${hash}"]`);
          if (!link) continue;
          link.click();
          jumps.push([hash, ...await firstFrame()]);
          await delay(250);
        }
        for (const y of [doc.documentElement.scrollHeight, 2500, 0]) { win.scrollTo(0, y); jumps.push([y, ...await firstFrame()]); await delay(250); }
        report.timings.jumps = jumps.map(([at, blocks, images]) => `${at}: ${blocks} blocks, ${images.length} images`);
        check(jumps.length >= 6 && jumps.every(([, n]) => n === 0), `${path}: every block a jump lands on is inked in the jump's first frame (${jumps.map(j => `${j[0]}: ${j[1]}`).join(', ')})`);
        check(jumps.every(([, , images]) => images.length === 0), `${path}: every figure a jump lands on shows its drawing or its own original in the jump's first frame, never a blank sheet (${jumps.filter(j => j[2].length).map(j => `${j[0]}: ${j[2].join(' ')}`).join(', ') || 'none blank'})`);
        // Once the helper has attached them, the originals go under their drawings again.
        await delay(700);
        const still = st().media.overlays.map(o => o.img.getAttribute('src')).filter(src => st().unveiled.has(src));
        check(still.length === 0, `${path}: after the jumps no drawn figure keeps its original unveiled (${still.join(', ') || 'none'}; ${st().unveiled.size} unveiled, not drawn yet)`);
        // The page's own Cite link opened the citation: closed again, as the reader found it.
        if (citation && citation.open !== citationOpen) {
          const length = st().page.text.length;
          citation.open = citationOpen;
          await until(() => st().page.text.length !== length && !st().building, 'the closed citation to be dropped', 5000).catch(() => {});
        }
        await delay(300);
        checkRanges(`${path} after jumps`);
      }
      clickable(path);
      // Reading and scrolling the page: no long task, frame callbacks within budget. Other
      // browsers share this machine, so the pass runs three times and the median counts.
      const passes = [];
      for (let run = 0; run < 3; run++) {
        const frames0 = JSON.parse(JSON.stringify(state().frameStats[ID] || { frames: 0, avgMs: 0 }));
        const since2 = win.performance.now();
        const height = doc.documentElement.scrollHeight;
        for (let k = 0; k <= 30; k++) {
          pointer('pointermove', 300 + (k * 23) % 700, 200 + (k * 37) % 500);
          if (k % 3 === 0) win.scrollTo({ top: Math.min(height, (k / 30) * height * 0.9), behavior: 'instant' });
          await delay(40);
        }
        win.scrollTo({ top: 0, behavior: 'instant' }); await delay(400);
        const frames1 = state().frameStats[ID] || { frames: 0, avgMs: 0, maxMs: 0 };
        const count = frames1.frames - frames0.frames;
        const avg = count > 0 ? +((frames1.avgMs * frames1.frames - frames0.avgMs * frames0.frames) / count).toFixed(3) : 0;
        passes.push({ frames: count, avgMs: avg, tasks: longTasks.filter(t => t.at >= since2 && t.ms > 50).map(t => t.ms) });
      }
      const median = values => values.slice().sort((a, b) => a - b)[values.length >> 1];
      const longCount = median(passes.map(p => p.tasks.length));
      const avg = median(passes.map(p => p.avgMs));
      report.frames[path] = { passes, medianAvgMs: avg, hoverMaxMs: lens()._stats.hoverMaxMs, intersectMaxMs: lens()._stats.intersectMaxMs };
      report.longTasks[path] = passes.map(p => p.tasks);
      check(longCount === 0, `${path}: no task over 50 ms while reading and scrolling (median of 3 passes: ${passes.map(p => `[${p.tasks.join(', ')}]`).join(' ')})`);
      check(avg < 4, `${path}: frame callbacks average ${avg} ms (median of 3 passes; budget 4 ms)`);
      await nextFrames(4); await delay(150);
      check(state().frames === 0 && !state().raf, `${path}: no frame callback once nothing moves`);
      // Work slices: none over 8 ms (one is allowed, for a task preempted on a shared machine),
      // and the synchronous commit of a page model is short too.
      const work = lens()._stats;
      check(work.slicesOver <= 1 && work.sliceMaxMs <= 25, `${path}: work slices stay within 8 ms (${work.slicesOver} of ${work.slices} over; longest by phase ${JSON.stringify(work.phaseMaxMs)}; the helper's draw flush ${work.flushMaxMs} ms)`);
      check(work.commitMs <= 8, `${path}: committing a page model takes ${work.commitMs} ms (budget 8 ms)`);
      report.stats[path] = { ...lens()._stats };
      escape(); await idle(); await nextFrames(2);
      check(sessionStorage.getItem('lenses-active') === null, `${path}: Esc forgets the lens`);
      sameText(before, `${path} after Esc`);
      // The same page entered by a trigger (the reading front), then left: byte for byte.
      const here = snapshot();
      const began = performance.now();
      await lenses()._debug.goto(ID);
      report.timings[`enter ${path}`] = Math.round(performance.now() - began);
      check(lenses().current === ID && st().ranges > 0 && !st().page.blocks.some(block => block.held), `${path}: enters by a trigger and settles`);
      checkRanges(`${path} entered`);
      await imagesRendered(`${path} entered`);
      await lenses().reset(); await idle(); await nextFrames(2);
      restored({ ...here, scroll: win.scrollY }, `${path} after enter and exit`);
    }

    /* 7c. A ground that is not the page's own: from a dark-theme page (#1f1f1f) to a paper
       page (always light, #fbfcfa). The page is hidden over the dark ground until the lens has
       arrived, but every colour the lens reads is the paper's own (the pre-paint ground on the
       root is set aside), so the ink mixes toward the light paper. */
    {
      localStorage.setItem('theme', 'dark');
      await load('/papers/godel-agent.html', { lens: ID, ground: '#1f1f1f', settle: false, watch: true });
      const first = imageWatch.firstState;
      imageWatch.stop = true; imageWatch = null;
      check(first && first.body === 0 && close(parseRgb(first.ground), [31, 31, 31], 0), `dark to paper: the first frame is hidden over the stored ground (${JSON.stringify(first)})`);
      const s = st();
      check(s.pairs.length > 0 && model().oklab(s.pairs[0].bg)[0] > 0.9 && !s.pairs.some(pair => close(pair.bg, [31, 31, 31], 3)) && !doc.documentElement.classList.contains('lens-shannon-dark'),
        `dark to paper: the colour pairs lie on the paper, not on the stored ground (${s.pairs.map(pair => pair.bg.join(',')).join(' | ')})`);
      check(lens().ground === '#fbfcfa' && !doc.getElementById('lenses-prepaint'), `dark to paper: the lens's ground is the paper's own once arrived (${lens().ground})`);
      await imagesRendered('dark to paper');
      const graphic = s.media && s.media.overlays.find(o => o.kind === 'graphic');
      if (graphic) check(model().oklab(lens()._image.colours(graphic.img).bg)[0] > 0.9, 'dark to paper: the figures are drawn on the paper');
      escape(); await idle(); await nextFrames(2);
      localStorage.setItem('theme', 'light');
    }

    /* 7b. The photography lightbox (position: fixed, outside the scope): its photograph is drawn
       as the gallery's are (fixed: true), pale on the black backdrop, over the original, which
       is hidden; the arrows and the close glyph keep the pointer; the next and previous photos
       get their own drawings, the drawing goes with the lightbox, and the page is restored. */
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const label = `lightbox ${width}`;
      await load('/photography.html', { width, height });
      await until(() => [...doc.querySelectorAll('.photo-item img')].slice(0, 3).every(img => img.complete), `${label}: the first photos`, 15000);
      const box = doc.getElementById('lightbox'); const shown = doc.getElementById('lightbox-img');
      // Opening and closing leaves the site's own empty style attribute on <body>: the
      // snapshot is taken after one opening.
      doc.querySelector('.photo-item').click();
      await until(() => shown.complete && shown.naturalWidth > 0, `${label}: the photo without the lens`, 8000);
      await nextFrames(2);
      doc.getElementById('close-lightbox').click(); await nextFrames(2);
      const before = snapshot();
      await lenses()._debug.goto(ID); await idle();
      await until(() => doc.documentElement.classList.contains('lens-shannon-covered'), 'the originals to be covered', 4000).catch(() => {});
      const drawing = () => st().media && st().media.overlays.find(o => o.img === shown && o.canvas.isConnected);
      doc.querySelector('.photo-item').click();
      await until(() => drawing() && +win.getComputedStyle(drawing().canvas).opacity > 0.99, `${label}: the drawing`, 8000).catch(() => {});
      const o = drawing();
      check(!!o && o.fixed && o.kind === 'photo', `${label}: the photo is drawn as the gallery's are, in the helper's fixed layer (${o ? `${o.kind}, fixed ${o.fixed}` : 'none'})`);
      check(sheetOnly(shown, 'lens-shannon-sheet-fixed'), `${label}: the original photograph is hidden under its drawing, painted as its blank sheet (${win.getComputedStyle(shown).filter})`);
      if (o) {
        const r = shown.getBoundingClientRect(); const c = o.canvas.getBoundingClientRect();
        check(Math.abs(c.left - r.left) < 1.5 && Math.abs(c.top - r.top) < 1.5 && Math.abs(c.width - r.width) < 1.5 && Math.abs(c.height - r.height) < 1.5, `${label}: the drawing lies on the photo`);
        const z = parseInt(win.getComputedStyle(o.canvas.closest('.lenses-layer')).zIndex, 10);
        check(z > (parseInt(win.getComputedStyle(box).zIndex, 10) || 0), `${label}: the drawing lies above the lightbox (${z})`);
        // Pale ink on the backdrop: the residual of the median edge detector, pixel for pixel.
        const { bg, ink } = lens()._image.colours(shown);
        check(model().oklab(bg)[0] < 0.25 && model().contrast(ink, bg) >= 3, `${label}: pale ink on the black backdrop (ink ${ink}, ground ${bg})`);
        const W = o.canvas.width; const H = o.canvas.height;
        const kit = await lenses()._debug.ctx.mediaKit();
        const source = await kit.drawAsync(shown, parseFloat(o.canvas.style.width), parseFloat(o.canvas.style.height), o.canvas.pixelRatio || win.devicePixelRatio, 'fill');
        if (source.width === W && source.height === H) {
          const a = source.getContext('2d').getImageData(0, 0, W, H).data;
          const b = o.canvas.getContext('2d').getImageData(0, 0, W, H).data;
          const small = Math.max(parseFloat(o.canvas.style.width), parseFloat(o.canvas.style.height)) < lens()._image.SMALL_PHOTO;
          const { E } = residualMap(a, W, H, { blur: small });
          const paint = inkOf(o.canvas);
          let worst = paint ? 0 : Infinity; let inked = 0;
          for (let k = 0; k < 600 && paint; k++) {
            const x = 2 + ((k * 37) % (W - 4)); const y = 2 + ((k * 53) % (H - 4)); const i = y * W + x;
            const t = lens()._image.tone(E[i]);
            const want = photoWant({ bg, ink }, t);
            worst = Math.max(worst, Math.abs(b[i * 4] - toneGrey(t)), ...want.map((v, ch) => Math.abs(v - paint(b[i * 4])[ch])));
            if (E[i] > 3) inked++;
          }
          check(worst <= 2 && inked > 20, `${label}: the drawing is the photograph's inked |error|, painted through its ink filter (worst channel difference ${worst}; ${inked} inked samples)`);
        } else check(false, `${label}: the drawing is the photograph's own size (${W}x${H} vs ${source.width}x${source.height})`);
        for (const id of ['lightbox-prev', 'lightbox-next', 'close-lightbox']) {
          const control = doc.getElementById(id); const at = centre(control); const hit = doc.elementFromPoint(at.x, at.y);
          check(hit === control, `${label}: ${id} keeps the pointer (hit ${hit && (hit.id || hit.tagName)})`);
        }
      }
      const first = o && o.canvas; const firstSrc = shown.currentSrc;
      doc.getElementById('lightbox-next').click();
      let next = null;
      await until(() => (next = drawing()) && next.canvas !== first && shown.currentSrc !== firstSrc && +win.getComputedStyle(next.canvas).opacity > 0.99, `${label}: the next drawing`, 8000).catch(() => {});
      check(!!next && next.canvas !== first && next.kind === 'photo', `${label}: the next photo gets its own drawing`);
      doc.getElementById('lightbox-prev').click();
      await until(() => drawing() && shown.currentSrc === firstSrc, `${label}: the drawing again`, 8000).catch(() => {});
      check(!!drawing() && shown.currentSrc === firstSrc, `${label}: the previous photo is drawn again`);
      doc.getElementById('close-lightbox').click();
      await until(() => !drawing(), `${label}: the drawing to go with the lightbox`, 3000).catch(() => {});
      check(!drawing(), `${label}: the drawing goes with the lightbox`);
      await lenses().reset(); await idle(); await nextFrames(2);
      restored({ ...before, scroll: win.scrollY }, `${label} after exit`);
      check(win.getComputedStyle(shown).opacity === '1' && win.getComputedStyle(shown).filter === 'none', `${label}: the lightbox's own photograph returns after exit`);
    }

    /* 8. Phone widths: no overflow, the ink, the images, links. */
    for (const [width, height] of [[390, 844], [320, 640]]) {
      await load('/', { width, height });
      if (width === 390) {
        // The reading front reaches the portrait (above the text on a phone) before the text below it.
        lens()._hold = 0.3;
        lenses()._debug.goto(ID);
        await until(() => st() && st().page && Number.isFinite(st().front) && st().front > 0, 'the reading front');
        const portrait = doc.querySelector('#main-content .profile-photo');
        await until(() => st().media && st().media.overlays.some(o => o.img === portrait), 'the portrait drawing', 8000).catch(() => {});
        await nextFrames(2);
        const overlay = st().media && st().media.overlays.find(o => o.img === portrait);
        const page = st().page; const pr = portrait.getBoundingClientRect(); const probe = doc.createRange();
        let aheadBelow = 0;
        for (let n = 0; n < page.nodes.length; n++) {
          probe.selectNodeContents(page.nodes[n]); const r = probe.getBoundingClientRect();
          if (r.height > 0 && r.top >= pr.bottom && r.top < win.innerHeight && page.nodeStart[n] > st().front) aheadBelow++;
        }
        check(!!overlay && overlay.canvas.style.opacity === '1' && aheadBelow > 3, `390x844: the portrait turns before the text below it (${aheadBelow} text nodes below it still ahead of the front)`);
        lens()._hold = null;
        await idle();
        await lenses().reset(); await idle(); await nextFrames(2);
      }
      const before = snapshot();
      await lenses()._debug.goto(ID);
      check(doc.documentElement.scrollWidth <= width + 1, `${width}x${height}: no horizontal overflow (${doc.documentElement.scrollWidth})`);
      const caption = doc.querySelector('.lenses-caption');
      if (caption) { const box = caption.getBoundingClientRect(); check(box.left >= 0 && box.right <= width + 1, `${width}x${height}: the caption fits`); }
      const lines = state().caption || [];
      check(lines[1] === `This page: ${st().bpc.toFixed(2)} bits per character (adaptive model).`, `${width}x${height}: the short caption note on a phone (${lines[1]})`);
      if (caption && width < lens()._image.CAPTION_BREAK_BELOW) {
        // The narrowest screens: the first line breaks after its dash, not inside the line.
        const text = caption.querySelector('.lenses-caption-line').firstChild;
        const at = text.data.indexOf('Each'); const probe = doc.createRange();
        const top = k => { probe.setStart(text, k); probe.setEnd(text, k + 1); return probe.getBoundingClientRect().top; };
        const dash = text.data.indexOf('—');
        const oneLine = top(text.data.length - 1) - top(0) < 2;
        const afterDash = top(dash) - top(0) < 2 && top(at) > top(dash) + 4 && top(text.data.length - 1) - top(at) < 2;
        check(at > 0 && (oneLine || afterDash) && text.data.replace(/\u00a0/g, ' ').endsWith(LINE.split(' — ')[1]),
          `${width}x${height}: the caption's line fits on one line or breaks after its dash (line tops: start ${Math.round(top(0))}, dash ${Math.round(top(dash))}, "Each" ${Math.round(top(at))}, end ${Math.round(top(text.data.length - 1))})`);
      }
      checkRanges(`${width}x${height}`);
      checkPaint(`${width}x${height}`);
      await imagesRendered(`${width}x${height}`);
      clickable(`${width}x${height}`);
      await lenses().reset(); await idle(); await nextFrames(2);
      restored(before, `${width}x${height}`);
    }
    /* 8b. On a paper page a caption entered without a trigger lies over no text: the core
       places it in a free band (between the nav and the eyebrow) when there is one. Only as
       the core's last resort is it a subtitle at the viewport's foot, over the body text; then
       it lies on the page's own ground, feathered, so no text shows between its lines (and it
       keeps inside the viewport). At a phone's width and a desk's. */
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      await load('/papers/godel-agent.html', { width, height });
      const before = snapshot();
      const entering = lenses()._debug.goto(ID);
      await until(() => doc.querySelector('.lenses-caption.is-shown'), 'the caption', 4000).catch(() => {});
      await delay(500);                          // the caption's fade
      const foot = doc.querySelector('.lenses-caption');
      const look = foot && win.getComputedStyle(foot);
      const page = win.getComputedStyle(doc.documentElement).backgroundColor;
      check(!!foot, `${width}x${height} paper: the caption shows`);
      if (foot && !foot.classList.contains('is-fixed')) {
        // Placed by the core over free space: no glyph box of the page meets its own lines.
        const own = [...foot.children].map(span => span.getBoundingClientRect());
        const over = [];
        const walker = doc.createTreeWalker(doc.body, win.NodeFilter.SHOW_TEXT); const probe = doc.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.data.trim() || node.parentElement.closest('.lenses-caption, .lenses-layer')) continue;
          probe.selectNodeContents(node);
          for (const f of probe.getClientRects()) {
            if (f.width > 0 && f.height > 0 && own.some(c => f.bottom > c.top + 1 && f.top < c.bottom - 1 && f.right > c.left && f.left < c.right)) over.push(`${node.data.trim().slice(0, 24)} [${Math.round(f.top)}..${Math.round(f.bottom)}]`);
          }
        }
        report.caption = report.caption || {};
        report.caption[`${width} placed`] = { step: lenses()._debug.state.captionStep, className: foot.className };
        check(over.length === 0, `${width}x${height} paper: the caption lies over no text (${foot.className}; over: ${over.slice(0, 4).join(', ') || 'none'})`);
      }
      if (foot && foot.classList.contains('is-fixed')) {
        // Its band (::before) lies on the ground of the text beneath, and covers whole lines:
        // every glyph box it touches is inside it, none is cut.
        const band = win.getComputedStyle(foot, '::before');
        const box0 = foot.getBoundingClientRect();
        const px = name => parseFloat(band[name]) || 0;
        const B = { top: box0.top + px('top'), bottom: box0.bottom - px('bottom'), left: box0.left + px('left'), right: box0.right - px('right') };
        let inside = 0; const cut = [];
        const walker = doc.createTreeWalker(doc.body, win.NodeFilter.SHOW_TEXT); const probe = doc.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.data.trim() || node.parentElement.closest('.lenses-caption, .lenses-layer')) continue;
          probe.selectNodeContents(node);
          for (const f of probe.getClientRects()) {
            if (!(f.width > 0 && f.height > 0 && f.bottom > B.top && f.top < B.bottom && f.right > B.left && f.left < B.right)) continue;
            if (f.top >= B.top - 0.5 && f.bottom <= B.bottom + 0.5 && f.left >= B.left - 0.5 && f.right <= B.right + 0.5) inside++;
            else cut.push(`${node.data.trim().slice(0, 24)} [${Math.round(f.top)}..${Math.round(f.bottom)}]`);
          }
        }
        report.caption = report.caption || {};
        report.caption[`${width} band`] = { band: [Math.round(B.left), Math.round(B.top), Math.round(B.right), Math.round(B.bottom)], lines: inside };
        check(band.content !== 'none' && +band.opacity === 1 && close(parseRgb(band.backgroundColor), parseRgb(page), 1) && look.borderTopWidth === '0px' && look.borderRadius === '0px' && look.backgroundColor === 'rgba(0, 0, 0, 0)',
          `${width}x${height} paper: over text the caption's band lies on the page's own ground (${page}), with no border or box of its own (${band.backgroundColor}, opacity ${band.opacity})`);
        check(inside > 0 && cut.length === 0, `${width}x${height} paper: the band covers whole lines of the text beneath it, none cut (${inside} glyph boxes inside; cut: ${cut.join(', ') || 'none'})`);
        check(B.top <= box0.top + 0.5 && B.bottom >= box0.bottom - 0.5 && B.left <= box0.left + 0.5 && B.right >= box0.right - 0.5, `${width}x${height} paper: the caption's own lines lie on its band`);
        const box = foot.getBoundingClientRect();
        check(box.bottom <= height && box.top > height / 2 && box.left >= 8 && box.right <= width - 8, `${width}x${height} paper: and keeps inside the viewport's foot (${Math.round(box.left)}..${Math.round(box.right)}, ${Math.round(box.top)}..${Math.round(box.bottom)})`);
        // The page under the caption keeps the pointer (the caption covers its letters only).
        const probes = [0.25, 0.5, 0.75].flatMap(fx => [0.3, 0.7].map(fy => [box.left + fx * box.width, box.top + fy * box.height]));
        const under = probes.filter(([x, y]) => { const hit = doc.elementFromPoint(x, y); return hit && !hit.closest('.lenses-caption'); });
        report.caption = report.caption || {};
        report.caption[`${width}`] = { lines: foot.querySelectorAll('span').length, box: [Math.round(box.width), Math.round(box.height)] };
        check(look.pointerEvents === 'none' && under.length === probes.length, `${width}x${height} paper: the caption leaves the page under it hit-testable`);
      }
      await entering; await idle();
      await lenses().reset(); await idle(); await nextFrames(2);
      restored({ ...before, scroll: win.scrollY }, `${width}x${height} paper caption`);
    }
    await load('/photography.html', { width: 390, height: 844 });
    {
      const before = snapshot();
      await lenses()._debug.goto(ID);
      check(doc.documentElement.scrollWidth <= 391, `390x844 photography: no horizontal overflow (${doc.documentElement.scrollWidth})`);
      await imagesRendered('390x844 photography');
      await lenses().reset(); await idle(); await nextFrames(2);
      restored(before, '390x844 photography');
    }
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    if (win && win.SiteLenses && win.SiteLenses._debug.lens(ID)) win.SiteLenses._debug.lens(ID)._hold = null;
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens);
    if (storedGround === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedGround);
  }
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  const lensWarnings = warnings.filter(w => /shannon/i.test(w));
  assertions++;
  if (lensWarnings.length) failures.push(`Warnings: ${lensWarnings.slice(0, 6).join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
