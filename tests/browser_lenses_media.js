/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes about a minute: tests/run_easter_suites.sh runs it as a background promise.
 * Tests the lenses media helper (easter/lenses/media.js) through a real lens ctx
 * (SiteLenses._debug.goto('tokens'), then ctx.media({ render: invert })): on photography.html
 * and a paper page the overlays are exactly the loaded same-origin images near the viewport,
 * each over its image's content box, inverted, never taking the pointer; render() runs once
 * per image and size; media.ready resolves as soon as exit begins; lazy images that load
 * later get overlays; overlays far from the viewport are dropped; after a resize, overlays
 * made earlier farther than 1.5 screens away are drawn again at their new size when they
 * come near; at a high device pixel ratio the render cache evicts within its budget
 * and never blanks an overlay on screen; images in a fixed ancestor or under 24 px are skipped;
 * an overlay is rounded like its image's content box; object-position calc() is honoured (and
 * plan() is public); with fixed: true an image in a fixed ancestor is redrawn in a fixed layer,
 * and the photography lightbox (outside the scope) gets an overlay above it that follows next,
 * previous, close and the exit, never takes the pointer and is cut out along the arrows that
 * cross the photo on a phone (1280 and 390 px wide); at a
 * phone width a .figure-scroll overlay is clipped to the scroller and follows its horizontal
 * scroll; dispose() and the lens's exit remove everything (the page is byte-identical); no long
 * task while scrolling; draw() honours its size cap; classify() calls the portrait and the
 * photographs photos, and the paper figures and the dark app screenshots graphics.
 * Prints assertions, failures, overlay counts, classification misses and long tasks.
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
  const NEAR = 1.5;                  // screens: overlays are made this close to the viewport
  const FAR = 4;                     // screens: overlays farther than this are dropped
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = [sessionStorage.getItem('lenses-active'), sessionStorage.getItem('lenses-ground')];
  localStorage.setItem('theme', 'light'); localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  const errors = []; const warnings = [];
  const report = { overlays: {}, renders: {}, misclassified: [], longTasks: {}, kinds: {} };
  let doc; let win; let longTasks = []; let frames = [];

  const load = async (path, width = 1280, height = 900) => {
    sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:200000;border:0;background:white`;
    await new Promise(resolve => { frame.onload = resolve; frame.src = `${path}${path.includes('?') ? '&' : '?'}r=${Math.random().toString(36).slice(2)}`; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => win.SiteLensesBoot && doc.getElementById('main-content'), `${path}: the page and the boot`);
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
    const consoleWarn = win.console.warn.bind(win.console);
    win.console.warn = (...args) => { warnings.push(`${path}: ${args.map(String).join(' ')}`); consoleWarn(...args); };
    longTasks = [];
    try {
      new win.PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push({ at: entry.startTime, ms: Math.round(entry.duration) })))
        .observe({ type: 'longtask', buffered: true });
    } catch (error) { /* long tasks are not observable here */ }
    // Long animation frames, with the scripts that ran in them (who caused a long task).
    frames = [];
    try {
      new win.PerformanceObserver(list => list.getEntries().forEach(entry => frames.push({
        at: entry.startTime, ms: Math.round(entry.duration),
        scripts: (entry.scripts || []).map(x => ({ src: String(x.sourceURL || ''), fn: String(x.sourceFunctionName || ''), invoker: String(x.invoker || ''), ms: Math.round(x.duration) }))
      }))).observe({ type: 'long-animation-frame', buffered: true });
    } catch (error) { frames = null; }
    let last = ''; let since = performance.now();
    await until(() => {
      const now = doc.getElementById('main-content').innerHTML;
      if (now !== last) { last = now; since = performance.now(); }
      return performance.now() - since > 500;
    }, `${path}: the page to settle`, 10000);
  };
  const lenses = () => win.SiteLenses;
  // The long tasks since `since` (over 50 ms), and those the lenses' own scripts caused: a long
  // animation frame in which scripts from easter/ (the core, the helper, the lens, and the
  // render() the helper calls) ran 50 ms or more. null when long animation frames are not
  // observable here.
  const longSince = since => longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
  const ownLongSince = since => (frames ? frames.filter(f => f.at >= since && f.ms > 50)
    .map(f => ({ ms: f.ms, own: f.scripts.filter(x => /\/easter\//.test(x.src)).reduce((sum, x) => sum + x.ms, 0), scripts: f.scripts.slice(0, 4) }))
    .filter(f => f.own >= 50) : null);
  const snapshot = () => ({
    main: doc.getElementById('main-content').innerHTML,
    headKids: [...doc.head.children].filter(el => !/easter\/(boot|lenses\/core)\./.test(el.getAttribute('src') || el.getAttribute('href') || '')).map(el => el.outerHTML).join('\n'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    htmlAttrs: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|')
  });
  const same = (before, label) => {
    const now = snapshot();
    for (const key of Object.keys(before)) check(now[key] === before[key], `${label}: ${key} is byte-identical`);
    check(!doc.querySelector('.lenses-media, .lenses-media-clip, .lenses-media-layer, .lenses-layer'), `${label}: no overlay, clip or layer is left`);
  };
  // The inverting render() of the brief: every channel flipped, alpha kept.
  let renders = new Map();
  const invert = source => {
    const key = `${source.img.getAttribute('src')}|${source.width}x${source.height}`;
    renders.set(key, (renders.get(key) || 0) + 1);
    if (!source.readable) return source.canvas;
    const data = source.ctx2d.getImageData(0, 0, source.width, source.height);
    for (let i = 0; i < data.data.length; i += 4) { data.data[i] = 255 - data.data[i]; data.data[i + 1] = 255 - data.data[i + 1]; data.data[i + 2] = 255 - data.data[i + 2]; }
    source.ctx2d.putImageData(data, 0, 0);
    return source.canvas;
  };
  const sameOrigin = img => { try { return new URL(img.currentSrc || img.src, win.location.href).origin === win.location.origin; } catch (error) { return false; } };
  const insideFixed = img => { for (let el = img; el && el !== doc.body; el = el.parentElement) if (win.getComputedStyle(el).position === 'fixed') return true; return false; };
  const scopeImages = () => [...doc.querySelectorAll('#site-nav img, #main-content img, #site-footer img, body > header.site-header img, body > footer.paper-footer img')];
  const within = (rect, screens) => rect.bottom >= -screens * win.innerHeight && rect.top <= (1 + screens) * win.innerHeight &&
    rect.right >= -screens * win.innerWidth && rect.left <= (1 + screens) * win.innerWidth;
  // The images the helper should cover now: loaded, same origin, at least 24 x 24, not in a
  // fixed ancestor, within NEAR screens (images just at the band's edge are left out of the
  // comparison either way).
  const eligible = img => {
    const r = img.getBoundingClientRect();
    return img.complete && img.naturalWidth > 0 && sameOrigin(img) && r.width >= 24 && r.height >= 24 && !insideFixed(img);
  };
  const expected = () => scopeImages().filter(img => eligible(img) && within(img.getBoundingClientRect(), NEAR - 0.05));
  const borderline = img => eligible(img) && within(img.getBoundingClientRect(), NEAR + 0.05) && !within(img.getBoundingClientRect(), NEAR - 0.05);
  // Waits until the helper is idle and neither the loaded near images nor the overlays have
  // changed for 600 ms (lazy photos keep arriving for a while after a scroll).
  const stable = async (media, label) => {
    let last = ''; let since = performance.now();
    await until(() => {
      const s = media._state;
      const now = `${expected().length}|${media.overlays.length}|${s.queued}|${s.busy}|${s.unseen}`;
      if (now !== last) { last = now; since = performance.now(); }
      return !s.busy && s.queued === 0 && s.unseen === 0 && performance.now() - since > 600;
    }, `${label}: the overlays to settle`, 25000);
  };
  // Every overlay sits over its image's content box. Before any scroll (exact) the overlays are
  // exactly the expected images; after a scroll, overlays made earlier may stay until their
  // image is FAR screens away.
  const compareOverlays = (media, label, exact = false) => {
    const shown = new Set(media.overlays.map(o => o.img));
    const want = expected();
    const missing = want.filter(img => !shown.has(img)).map(img => img.getAttribute('src'));
    const extra = [...shown].filter(img => !want.includes(img) && !borderline(img) && (exact || !(eligible(img) && within(img.getBoundingClientRect(), FAR + 0.05)))).map(img => img.getAttribute('src'));
    check(missing.length === 0 && extra.length === 0, `${label}: an overlay for each loaded same-origin image near the viewport${exact ? ' and no other' : ''} (${want.length} expected; missing ${missing.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'})`);
    check(doc.querySelectorAll('canvas.lenses-media').length === media.overlays.length, `${label}: media.overlays lists every overlay canvas`);
    let off = 0;
    for (const o of media.overlays) {
      const a = o.canvas.getBoundingClientRect(); const s = win.getComputedStyle(o.img); const r = o.img.getBoundingClientRect();
      const px = name => parseFloat(s[name]) || 0;
      const box = { left: r.left + px('borderLeftWidth') + px('paddingLeft'), top: r.top + px('borderTopWidth') + px('paddingTop'),
        right: r.right - px('borderRightWidth') - px('paddingRight'), bottom: r.bottom - px('borderBottomWidth') - px('paddingBottom') };
      if (Math.abs(a.left - box.left) > 0.6 || Math.abs(a.top - box.top) > 0.6 || Math.abs(a.right - box.right) > 0.6 || Math.abs(a.bottom - box.bottom) > 0.6) off++;
    }
    check(off === 0, `${label}: every overlay covers its image's content box exactly (${off} off)`);
    check(media.overlays.every(o => o.canvas.classList.contains('lenses-media') && (o.canvas.dataset.kind === 'photo' || o.canvas.dataset.kind === 'graphic') && o.kind === o.canvas.dataset.kind),
      `${label}: overlays carry class lenses-media and data-kind`);
    report.overlays[label] = media.overlays.length;
  };
  // An overlay's centre is the inverse of the image's (drawn the same way by draw()), compared
  // as the mean of a 9 x 9 block, so resampling differences do not count.
  const inverted = o => {
    const M = win.SiteLensesMedia;
    const r = o.img.getBoundingClientRect();
    const plain = M.draw(o.img, r.width, r.height, o.canvas.width / r.width, win.getComputedStyle(o.img));
    const mean = (canvas, x, y) => {
      const d = canvas.getContext('2d').getImageData(Math.max(0, x - 4), Math.max(0, y - 4), 9, 9).data; const m = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k] / (d.length / 4);
      return m;
    };
    const x = Math.floor(o.canvas.width / 2); const y = Math.floor(o.canvas.height / 2);
    const a = mean(o.canvas, x, y); const b = mean(plain, Math.min(x, plain.width - 5), Math.min(y, plain.height - 5));
    return [0, 1, 2].every(k => Math.abs(a[k] + b[k] - 255) <= 24);
  };

  try {
    /* 0. First, on a fresh cache: a phone-width gallery (one column, many screens): photos that
     * have not loaded get no overlay; scrolling down, lazy photos load and get overlays; those left 4 screens behind
     * are dropped. */
    {
      await load('/photography.html', 390, 844);
      await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
      const gallery = await lenses()._debug.ctx.media({ render: invert });
      await gallery.ready; await stable(gallery, 'phone gallery (top)');
      compareOverlays(gallery, 'phone gallery (top)', true);
      const photos = [...doc.querySelectorAll('#main-content img')];
      check(doc.documentElement.scrollHeight > 5 * win.innerHeight, `390 px: the gallery is long (${doc.documentElement.scrollHeight} px)`);
      const height = doc.documentElement.scrollHeight;
      const since = win.performance.now();
      for (let k = 1; k <= 16; k++) { win.scrollTo({ top: Math.min(height, (k / 16) * height), behavior: 'instant' }); await delay(200); }
      await stable(gallery, 'phone gallery (bottom)');
      compareOverlays(gallery, 'phone gallery (bottom)');
      const tasks = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
      report.longTasks['phone gallery'] = tasks;
      check(tasks.length === 0, `390 px: no long task while scrolling the gallery as photos are drawn (${tasks.join(', ')} ms)`);
      const top = photos[0];
      check(!within(top.getBoundingClientRect(), FAR) && !gallery.overlays.some(o => o.img === top), '390 px: the first photo, more than 4 screens behind, has no overlay any more');
      check(gallery.overlays.every(o => within(o.img.getBoundingClientRect(), FAR + 0.05)), '390 px: no overlay is kept farther than 4 screens from the viewport');
      win.scrollTo({ top: 0, behavior: 'instant' });
      await stable(gallery, 'phone gallery (back to top)');
      compareOverlays(gallery, 'phone gallery (back to top)');
      check(gallery.overlays.some(o => o.img === top), '390 px: back at the top, the first photo has its overlay again (from the cache)');
      // A late image: added without a source (no overlay), then given one; it loads and is covered.
      const holder = doc.querySelector('#main-content .gallery-intro');
      const late2 = doc.createElement('img');
      late2.alt = ''; late2.width = 160; late2.height = 160; late2.loading = 'lazy';
      holder.after(late2);
      await delay(300);
      check(!gallery.overlays.some(o => o.img === late2), '390 px: an image that has not loaded has no overlay');
      late2.src = `/figures/me-320.jpg?late=${Math.random().toString(36).slice(2)}`;
      await until(() => gallery.overlays.some(o => o.img === late2), 'the late image to get an overlay', 8000).catch(() => {});
      check(gallery.overlays.some(o => o.img === late2), '390 px: an image that loads later gets an overlay (ctx.onLayoutChange)');
      late2.remove();
      await until(() => !gallery.overlays.some(o => o.img === late2), 'the removed image to lose its overlay', 4000).catch(() => {});
      check(!gallery.overlays.some(o => o.img === late2) && doc.querySelectorAll('canvas.lenses-media').length === gallery.overlays.length, '390 px: a removed image loses its overlay');
      // Lazy images far below: the gallery's own lazy photos all load at once (before they load
      // they have no height, so all of them are near the viewport), so two lazy images with a
      // size and a fresh URL at the end of the page stand in for photos that load only when
      // scrolled to. (Added after the long-task check: a photo the browser decodes for display
      // while the page scrolls can hold a frame's commit, which is not the helper's work.)
      const pending = [0, 1].map(k => {
        const img = doc.createElement('img');
        img.alt = ''; img.loading = 'lazy'; img.width = 300; img.height = 200; img.style.display = 'block';
        img.src = `/figures/me-320.jpg?lazy${k}=${Math.random().toString(36).slice(2)}`;
        doc.getElementById('main-content').append(img);
        return img;
      });
      await delay(400);
      report.pendingAtStart = pending.filter(img => !img.complete).length;
      check(pending.every(img => !img.complete) && !gallery.overlays.some(o => pending.includes(o.img)),
        '390 px: lazy images at the end of the page have not loaded (and have no overlay) before they are scrolled to');
      pending[1].scrollIntoView({ block: 'center' });
      await until(() => pending.every(img => img.complete && gallery.overlays.some(o => o.img === img)), 'the lazy images to get overlays', 10000).catch(() => {});
      const late = pending.filter(img => img.complete && img.naturalWidth > 0 && gallery.overlays.some(o => o.img === img));
      check(late.length === pending.length, `390 px: lazy images that load when scrolled to get overlays (${late.length} of ${pending.length})`);
      pending.forEach(img => img.remove());
      win.scrollTo({ top: 0, behavior: 'instant' });
      await lenses()._debug.goto(null);
    }

    /* 0b. A phone with a high device pixel ratio: every overlay is large (up to 1.6 MP, 6.4 MB),
     * so the renders pass the cache budget. Scrolling the gallery and resizing never leave an
     * overlay without pixels (a render on screen is never evicted), the renders off screen stay
     * within the 64 MB budget, and the cache does evict. */
    {
      await load('/photography.html', 412, 892);
      Object.defineProperty(win, 'devicePixelRatio', { configurable: true, get: () => 3.5 });
      await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
      let rendered = 0;
      const sharp = await lenses()._debug.ctx.media({ render: source => { rendered++; return source.canvas; }, ground: '#ffffff' });
      await sharp.ready;
      const blank = new Set();
      const settle = async () => {
        const began = performance.now();
        while (performance.now() - began < 6000 && (sharp._state.busy || sharp._state.queued)) await delay(50);
        sharp.overlays.forEach(o => { if (!o.canvas.width || !o.canvas.height) blank.add(o.img.getAttribute('src')); });
      };
      await settle();
      const height = doc.documentElement.scrollHeight;
      for (let k = 1; k <= 12; k++) { win.scrollTo({ top: Math.min(height, (k / 12) * height), behavior: 'instant' }); await delay(200); await settle(); }
      for (const width of [396, 380, 364]) { frame.style.width = `${width}px`; await delay(300); await settle(); }
      const s = sharp._state;
      report.eviction = { rendered, cached: s.cached, cacheMB: +(s.cacheBytes / 1048576).toFixed(1), spareMB: +(s.spareBytes / 1048576).toFixed(1), overlays: sharp.overlays.length };
      check(sharp.overlays.length > 0 && blank.size === 0 && sharp.overlays.every(o => o.canvas.width > 0 && o.canvas.height > 0),
        `dpr 3.5: no overlay is ever left without pixels by the cache (${[...blank].join(', ') || 'none blank'})`);
      check(s.spareBytes <= 64 * 1024 * 1024, `dpr 3.5: the renders off screen stay within the 64 MB budget (${report.eviction.spareMB} MB)`);
      check(s.cached < rendered, `dpr 3.5: the cache evicts old renders (${s.cached} kept of ${rendered} made)`);
      await lenses()._debug.goto(null);
    }

    /* 1. Photography at 1280 x 900: overlays, pixels, pointer, the render cache. */
    await load('/photography.html');
    const before = snapshot();
    await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
    check(lenses().current === 'tokens', 'The tokens lens is active (the helper is used through its ctx)');
    renders = new Map();
    const ctx = lenses()._debug.ctx;
    const drawnSince = win.performance.now();
    const media = await ctx.media({ render: invert });
    check(win.SiteLensesMedia && typeof win.SiteLensesMedia.classify === 'function', 'ctx.media loads easter/lenses/media.js (window.SiteLensesMedia)');
    check(!doc.querySelector('script[src*="easter/lenses/media.js"]'), 'The media script element is removed once it has run');
    const readyBy = await Promise.race([media.ready.then(() => true), delay(15000).then(() => false)]);
    check(readyBy, 'media.ready resolves');
    await stable(media, 'photography');
    const drawTasks = longTasks.filter(task => task.at >= drawnSince && task.ms > 50).map(task => task.ms);
    report.longTasks['photography (drawing)'] = drawTasks;
    check(drawTasks.length === 0, `No long task while the gallery's photos are drawn (${drawTasks.join(', ')} ms)`);
    compareOverlays(media, 'photography (top)', true);
    check(media.overlays.length >= 3, `photography: several photos are covered (${media.overlays.length})`);
    check(media.overlays.every(o => o.kind === 'photo'), `photography: every photo is classified a photo (${media.overlays.filter(o => o.kind !== 'photo').map(o => o.img.getAttribute('src')).join(', ') || 'all photos'})`);
    check(media.overlays.length > 0 && media.overlays.every(inverted), 'photography: overlays hold the inverted image');
    check(media.overlays.every(o => o.canvas.closest('.lenses-layer-page')), 'Overlays live in a page layer');
    const firstOverlay = media.overlays[0];
    if (firstOverlay) {
      const r = firstOverlay.canvas.getBoundingClientRect();
      const hit = doc.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, win.innerHeight - 4));
      check(hit && (hit === firstOverlay.img || hit.contains(firstOverlay.img) || firstOverlay.img.contains(hit)), `An overlay does not take the pointer (hit ${hit && hit.tagName})`);
    }
    check([...renders.values()].every(count => count === 1), `render() runs once per image and size (${JSON.stringify([...renders.values()])})`);
    const rendered = renders.size;
    media.refresh(); await delay(400); await stable(media, 'photography refresh');
    check(renders.size === rendered && [...renders.values()].every(count => count === 1), 'refresh() re-places overlays without rendering again');
    report.renders.photography = rendered;
    check(typeof media.kindOf === 'function' && media.overlays.every(o => media.kindOf(o.img) === o.kind) && media.kindOf(new win.Image()) === null,
      'M6: media.kindOf(img) gives the helper\'s classification of an image it has classified, null for one it has not');

    /* 2. Scrolling the gallery keeps the overlays exact and raises no long task. */
    const since = win.performance.now();
    const height = doc.documentElement.scrollHeight;
    for (let k = 1; k <= 12; k++) {
      win.scrollTo({ top: Math.min(height, (k / 12) * height), behavior: 'instant' });
      await delay(250);
    }
    await stable(media, 'photography (bottom)');
    compareOverlays(media, 'photography (bottom)');
    check(media.overlays.every(o => within(o.img.getBoundingClientRect(), FAR + 0.05)), 'No overlay is kept farther than 4 screens from the viewport');
    const scrollTasks = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
    report.longTasks.photography = scrollTasks;
    check(scrollTasks.length === 0, `No long task while scrolling the photography page with overlays (${scrollTasks.join(', ')} ms)`);
    win.scrollTo({ top: 0, behavior: 'instant' }); await delay(300); await stable(media, 'photography (back to top)');
    compareOverlays(media, 'photography (back to top)');

    report.slices = { photography: media._state };   // a paper's (with SVGs) is reported in section 5
    check(media._state.maxSliceMs <= 8, `The helper's own work stays within 8 ms per task (max ${media._state.maxSliceMs} ms over ${media._state.slices} slices)`);

    /* 3. dispose() removes the overlays and the layer; the exit leaves the page as it was. */
    media.dispose();
    check(media.overlays.length === 0 && !doc.querySelector('.lenses-media, .lenses-media-layer'), 'dispose() removes every overlay and the layer');
    await lenses()._debug.goto(null);
    same(before, 'photography after dispose and exit');

    /* 4. Without dispose(), the lens's exit disposes the handle. */
    await lenses()._debug.goto('tokens');
    const auto = await lenses()._debug.ctx.media({ render: invert });
    await auto.ready; await stable(auto, 'photography (auto)');
    check(auto.overlays.length > 0 && lenses()._debug.state.media === 1, 'A second handle draws again (the ctx tracks it)');
    await lenses()._debug.goto(null);
    check(auto.disposed && auto.overlays.length === 0, 'The exit disposes the handle');
    same(before, 'photography after an exit without dispose');

    /* 4a. media.ready settles as soon as exit begins (the ctx signal aborts), not only when the
     * core disposes the handle after exit(): an enter() that awaits it never holds a reset. */
    {
      await lenses()._debug.goto('tokens');
      const lensCtx = lenses()._debug.ctx;
      let abortAt = 0; let readyAt = 0; let disposedAtReady = null;
      const slow = await lensCtx.media({ render: async source => { await delay(150); return source.canvas; } });
      slow.ready.then(() => { readyAt = win.performance.now(); disposedAtReady = slow.disposed; });
      lensCtx.signal.addEventListener('abort', () => { abortAt = win.performance.now(); });
      await delay(100);
      const early = readyAt;
      const leaving = lenses()._debug.goto(null);
      await until(() => readyAt, 'media.ready after the abort', 3000).catch(() => {});
      check(!early && abortAt > 0 && readyAt > 0 && readyAt - abortAt < 50 && disposedAtReady === false,
        `media.ready resolves when exit begins, before the handle is disposed (${readyAt && abortAt ? Math.round(readyAt - abortAt) : 'never'} ms after the abort)`);
      await leaving;
      check(slow.disposed && slow.overlays.length === 0, 'The handle whose ready resolved early is still disposed after the exit');
    }

    /* 4b. Skips and boxes: an image in a position: fixed ancestor and a 20 x 20 image get no
     * overlay; a bordered, padded, rounded image's overlay is rounded like its content box; an
     * object-position given as offsets from the right and bottom (computed as calc()) places
     * the image as the browser does. */
    {
      const holder = doc.createElement('div');
      holder.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;padding:12px';
      const fixed = doc.createElement('div');
      fixed.style.cssText = 'position:fixed;right:12px;bottom:12px;width:120px;height:90px;z-index:5';
      const image = css => {
        const img = doc.createElement('img');
        img.alt = ''; img.style.cssText = `display:block;${css}`;
        img.src = `/figures/me-320.jpg?edge=${Math.random().toString(36).slice(2)}`;
        return img;
      };
      const pinned = image('width:120px;height:90px');
      const tiny = image('width:20px;height:20px');
      const rounded = image('width:160px;height:120px;border:3px solid #888;padding:5px;border-radius:12px;box-sizing:content-box');
      const placed = image('width:240px;height:120px;object-fit:contain;object-position:right 10px bottom 5px');
      fixed.append(pinned); holder.append(fixed, tiny, rounded, placed);
      doc.getElementById('main-content').prepend(holder);
      await Promise.all([pinned, tiny, rounded, placed].map(img => img.decode().catch(() => {})));
      win.scrollTo({ top: 0, behavior: 'instant' });
      await lenses()._debug.goto('tokens');
      const edge = await lenses()._debug.ctx.media({ render: source => source.canvas, ground: '#ffffff' });
      await edge.ready; await stable(edge, 'edge cases');
      const overlayOf = img => edge.overlays.find(o => o.img === img);
      check(!overlayOf(pinned), 'An image inside a position: fixed ancestor gets no overlay');
      check(!overlayOf(tiny), 'An image smaller than 24 x 24 CSS px gets no overlay');
      const round = overlayOf(rounded);
      const radius = round && win.getComputedStyle(round.canvas).borderTopLeftRadius;
      check(radius === '4px', `A bordered, padded, rounded image's overlay has its content box's radius (12 - 3 - 5 = 4 px; got ${radius})`);
      const M = win.SiteLensesMedia;
      check(typeof M.plan === 'function' && M._plan === M.plan, 'plan() is a public utility (_plan stays as its alias)');
      const computed = win.getComputedStyle(placed);
      const scale = Math.min(240 / placed.naturalWidth, 120 / placed.naturalHeight);
      const free = [240 - placed.naturalWidth * scale, 120 - placed.naturalHeight * scale];
      const got = M.plan(placed, 240, 120, 1, computed);
      const want = M.plan(placed, 240, 120, 1, { objectFit: 'contain', objectPosition: `${free[0] - 10}px ${free[1] - 5}px` });
      check(!!overlayOf(placed) && /calc\(/.test(computed.objectPosition) && ['dx', 'dy', 'sx', 'sy', 'dw', 'dh'].every(k => Math.abs(got[k] - want[k]) < 0.5),
        `object-position as calc() (${computed.objectPosition}) places the image (dx ${got.dx && got.dx.toFixed(1)}, expected ${want.dx && want.dx.toFixed(1)})`);
      // With fixed: true the image in the fixed ancestor is redrawn, in the fixed layer.
      const pinnedToo = await lenses()._debug.ctx.media({ render: source => source.canvas, ground: '#ffffff', fixed: true });
      await pinnedToo.ready; await stable(pinnedToo, 'edge cases (fixed)');
      const pinnedOverlay = pinnedToo.overlays.find(o => o.img === pinned);
      const pinnedBox = pinned.getBoundingClientRect(); const pinnedAt = pinnedOverlay && pinnedOverlay.canvas.getBoundingClientRect();
      check(!!pinnedOverlay && pinnedOverlay.fixed && pinnedOverlay.canvas.closest('.lenses-media-fixed.lenses-layer-fixed') &&
        Math.abs(pinnedAt.left - pinnedBox.left) < 0.6 && Math.abs(pinnedAt.top - pinnedBox.top) < 0.6,
        'fixed: true redraws an image in a position: fixed ancestor of the scope, over it, in the fixed layer');
      pinnedToo.dispose();
      check(!doc.querySelector('.lenses-media-fixed'), 'dispose() removes the fixed layer');
      edge.dispose();
      await lenses()._debug.goto(null);
      holder.remove();
    }

    /* 4c. fixed: true and the photography lightbox (outside the scope, position: fixed, opened
     * by a click on a photo): its photo is redrawn in a fixed layer stacked above the lightbox,
     * over the photo's content box; the overlay follows next and previous, never takes the
     * pointer (the photo and the arrows are hit), keeps the arrows visible where they cross the
     * photo (a mask cut along their glyphs, on a phone), and is gone after close and after the
     * exit. A handle without the option leaves the lightbox alone. At 1280 x 900 and 390 x 844. */
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const label = `lightbox ${width}`;
      await load('/photography.html', width, height);
      const box = doc.getElementById('lightbox'); const big = doc.getElementById('lightbox-img');
      const open = async index => { doc.querySelectorAll('#main-content .photo-item')[index].click(); await until(() => box.classList.contains('active'), `${label}: the lightbox to open`); };
      const close = () => doc.getElementById('close-lightbox').click();
      // The lightbox writes the body's style and its own image: one round first, so the
      // snapshot is the page as the reader leaves it after a look at a photo.
      await open(0); close(); await delay(50);
      const before = snapshot();
      await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
      const ctx = lenses()._debug.ctx;
      const plain = await ctx.media({ render: invert });
      const drawn = new WeakMap();       // a render's canvas -> the src of the photo it holds
      const lit = await ctx.media({ render: source => { const canvas = invert(source); drawn.set(canvas, source.img.getAttribute('src')); return canvas; }, fixed: true });
      await Promise.all([plain.ready, lit.ready]);
      check(!lit.overlays.some(o => o.img === big) && !doc.querySelector('.lenses-media-fixed canvas'), `${label}: while the lightbox is closed it has no overlay`);
      const of = handle => handle.overlays.find(o => o.img === big);
      // The overlay is current: placed over the photo and holding the photo now shown, inverted.
      const current = () => { const o = of(lit); return !!o && o.canvas.isConnected && inverted(o); };
      const onPhoto = async (index, step) => {
        if (step) doc.getElementById(step).click(); else if (index !== null) await open(index);
        const src = big.getAttribute('src');
        // Polled slowly: current() draws the photo again to compare (a large draw).
        for (const began = performance.now(); performance.now() - began < 15000; await delay(150)) {
          if (big.complete && big.getAttribute('src') === src && current()) break;
        }
        return src;
      };
      const first = await onPhoto(1);
      const o = of(lit);
      check(!!o && current(), `${label}: the open lightbox's photo gets an overlay holding it, inverted (${first})`);
      if (o) {
        const a = o.canvas.getBoundingClientRect(); const r = big.getBoundingClientRect();
        const layer = o.canvas.closest('.lenses-layer');
        check(o.fixed && layer && layer.classList.contains('lenses-layer-fixed') && layer.classList.contains('lenses-media-fixed') && layer.classList.contains('lenses-media-layer'),
          `${label}: the overlay lives in a fixed layer (lenses-media-layer lenses-media-fixed)`);
        check(Math.abs(a.left - r.left) < 0.6 && Math.abs(a.top - r.top) < 0.6 && Math.abs(a.width - r.width) < 0.6 && Math.abs(a.height - r.height) < 0.6,
          `${label}: the overlay covers the photo's box in viewport coordinates`);
        check(+win.getComputedStyle(layer).zIndex > +win.getComputedStyle(box).zIndex, `${label}: the fixed layer is stacked above the lightbox (${win.getComputedStyle(layer).zIndex} > ${win.getComputedStyle(box).zIndex})`);
        const hit = doc.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
        const arrows = ['lightbox-prev', 'lightbox-next', 'close-lightbox'].map(id => doc.getElementById(id));
        const hits = arrows.map(el => { const c = el.getBoundingClientRect(); return doc.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2) === el; });
        check(hit === big && hits.every(Boolean) && win.getComputedStyle(o.canvas).pointerEvents === 'none', `${label}: the overlay never takes the pointer (the photo, the arrows and the close control are hit)`);
        // Arrows over the photo are cut out of the overlay along their glyphs; none: no mask.
        const crossing = arrows.filter(el => { const c = el.getBoundingClientRect(); return c.right > r.left && c.left < r.right && c.bottom > r.top && c.top < r.bottom; });
        const mask = win.getComputedStyle(o.canvas).maskImage;
        const holes = (mask.match(/url\(/g) || []).length;
        report.lightboxMask = report.lightboxMask || {};
        report.lightboxMask[width] = { crossing: crossing.map(el => el.id), holes };
        check(crossing.length ? holes >= crossing.length : mask === 'none', `${label}: the overlay is cut out where the lightbox's controls cross the photo (${crossing.map(el => el.id).join(', ') || 'none cross'}; ${holes} holes)`);
      }
      check(!of(plain), `${label}: a handle without the fixed option leaves the lightbox alone`);
      // M2. Next and previous: in the first frame after the click no render of the photo
      // before (stretched over the new one's box) shows; the new one shows once it is ready.
      // (The gallery's photos are loaded, so the lightbox's img is complete at once.)
      const shownStale = () => [...doc.querySelectorAll('.lenses-media-fixed canvas.lenses-media')].filter(c => {
        const look = win.getComputedStyle(c);
        return look.display !== 'none' && look.visibility !== 'hidden' && +look.opacity > 0 && drawn.get(c) !== big.getAttribute('src');
      }).map(c => `${c.width}x${c.height} of ${drawn.get(c)}`);
      const firstFrame = step => new Promise(resolve => { doc.getElementById(step).click(); win.requestAnimationFrame(() => resolve(shownStale())); });
      const staleNext = await firstFrame('lightbox-next');
      const second = await onPhoto(null, null);
      check(second !== first && current() && lit.overlays.filter(x => x.img === big).length === 1, `${label}: the overlay follows the next photo (${second})`);
      check(big.complete && staleNext.length === 0, `M2 ${label}: in the first frame after next, no render of the photo before shows (${staleNext.join(', ') || 'none'})`);
      const stalePrev = await firstFrame('lightbox-prev');
      const back = await onPhoto(null, null);
      check(back === first && current(), `${label}: the overlay follows the previous photo`);
      check(stalePrev.length === 0, `M2 ${label}: in the first frame after previous, no render of the photo before shows (${stalePrev.join(', ') || 'none'})`);
      close();
      await until(() => !of(lit), `${label}: the overlay to go with the lightbox`, 4000).catch(() => {});
      check(!of(lit) && !doc.querySelector('.lenses-media-fixed canvas'), `${label}: closing the lightbox removes its overlay`);
      await onPhoto(2);
      check(current(), `${label}: reopened, the lightbox has its overlay again`);
      report.slices[label] = lit._state.maxSliceMs;
      // M3. A handle made while the lightbox is already open (and nothing in it changes) draws
      // it at once; here it selects the lightbox's image alone, so no in-scope image's
      // observer wakes the queue.
      if (width === 1280) {
        const late = await ctx.media({ select: '#lightbox img', fixed: true, render: source => source.canvas });
        await until(() => late.overlays.some(x => x.img === big), 'the late handle to draw the open lightbox', 4000).catch(() => {});
        check(late.overlays.some(x => x.img === big && x.canvas.isConnected), `M3 ${label}: a handle made with the lightbox already open draws its photo without a change in the lightbox`);
        late.dispose();
      }
      // The exit with the lightbox open: every overlay and both layers go.
      await lenses()._debug.goto(null);
      check(lit.disposed && !doc.querySelector('.lenses-media-fixed, .lenses-layer'), `${label}: the exit removes the lightbox overlay and the fixed layer`);
      close(); await delay(50);
      same(before, `${label} after the exit and a closed lightbox`);
    }

    /* 4c'. M4. At a device pixel ratio of 2 the lightbox's photo (a landscape one fills about
     * 984 x 738 CSS px at 1280 x 900) is drawn at full device resolution: images in a fixed
     * container may take up to 3.2 MP (other images 1.6 MP), and each task stays under 8 ms. */
    {
      await load('/photography.html');
      Object.defineProperty(win, 'devicePixelRatio', { configurable: true, get: () => 2 });
      const box = doc.getElementById('lightbox'); const big = doc.getElementById('lightbox-img');
      const items = [...doc.querySelectorAll('#main-content .photo-item')];
      let wide = -1;
      for (let k = 0; k < items.length && wide < 0; k++) {
        items[k].click(); await until(() => box.classList.contains('active') && big.complete, 'the lightbox to open (M4)');
        const r = big.getBoundingClientRect();
        if (r.width * r.height * 4 > 1.6e6 * 1.2) wide = k;
        else doc.getElementById('close-lightbox').click();
      }
      await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
      const sharp = await lenses()._debug.ctx.media({ render: source => source.canvas, fixed: true });
      await until(() => sharp.overlays.some(x => x.img === big), 'the lightbox overlay at dpr 2', 8000).catch(() => {});
      const o = sharp.overlays.find(x => x.img === big);
      const r = big.getBoundingClientRect();
      const want = [Math.round(r.width * 2), Math.round(r.height * 2)];
      report.lightboxDpr2 = { photo: wide, css: [Math.round(r.width), Math.round(r.height)], canvas: o ? [o.canvas.width, o.canvas.height] : null, maxSliceMs: sharp._state.maxSliceMs };
      check(wide >= 0 && !!o && o.canvas.width === want[0] && o.canvas.height === want[1] && o.canvas.width * o.canvas.height <= 3.2e6,
        `M4: at dpr 2 the lightbox photo is drawn at its full device size, not upscaled (${JSON.stringify(report.lightboxDpr2)})`);
      check(sharp._state.maxSliceMs <= 8, `M4: drawing it keeps the helper within 8 ms per task (max ${sharp._state.maxSliceMs} ms)`);
      await lenses()._debug.goto(null);
      doc.getElementById('close-lightbox').click();
      delete win.devicePixelRatio;
    }

    /* 4d. M1. Order and decodes: the photos near the viewport are drawn nearest first by where
     * they are when the next one is picked (not where they were when they were queued), and up
     * to two file decodes run at once. A slow render() keeps the queue long; one screen down
     * while the first renders, the photos now in view must all be drawn before any of those
     * now off screen (the ones that were at the top). */
    {
      await load('/photography.html');
      await Promise.all([...doc.querySelectorAll('#main-content img')].map(img => img.decode().catch(() => {})));
      win.scrollTo({ top: 0, behavior: 'instant' });
      await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
      const began = new Map();
      const ordered = await lenses()._debug.ctx.media({ render: async source => { began.set(source.img, win.performance.now()); await delay(90); return source.canvas; } });
      await until(() => ordered._state.unseen === 0 && began.size >= 1, 'the first render');
      win.scrollTo({ top: win.innerHeight, behavior: 'instant' });
      const scrolledAt = win.performance.now();
      await stable(ordered, 'photography one screen down');
      const inView = img => { const r = img.getBoundingClientRect(); return r.bottom > 0 && r.top < win.innerHeight; };
      const after = [...began].filter(([, at]) => at > scrolledAt + 20).sort((a, b) => a[1] - b[1]).map(([img]) => inView(img));
      const firstOff = after.indexOf(false);
      const late = firstOff < 0 ? 0 : after.slice(firstOff).filter(Boolean).length;
      report.order = { renders: after.map(v => (v ? 'in' : 'off')).join(' '), decodes: ordered._state.decodes };
      check(after.some(Boolean) && late === 0, `M1: one screen down, the photos now in view are drawn before those now off screen (${report.order.renders})`);
      const decodes = ordered._state.decodes;
      check(!!decodes && decodes.peak === 2 && decodes.ahead > 0 && decodes.used > 0, `M1: up to two file decodes run at once, started ahead for the next photos (${JSON.stringify(decodes)})`);
      await lenses()._debug.goto(null);
    }


    /* 5. A paper page: figures (SVG and PNG) are graphics; the longest paper scrolls without a long task. */
    await load('/papers/godel-agent.html');
    const paperBefore = snapshot();
    await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
    renders = new Map();
    const paper = await lenses()._debug.ctx.media({ render: invert, ground: '#ffffff' });
    await paper.ready; await stable(paper, 'godel-agent');
    compareOverlays(paper, 'godel-agent', true);
    check(paper.overlays.length > 0 && paper.overlays.every(o => o.kind === 'graphic'), `godel-agent: the figures are graphics (${paper.overlays.map(o => `${o.img.getAttribute('src')}=${o.kind}`).join(', ')})`);
    report.renders['godel-agent'] = renders.size;
    /* M5. A jump back to figures whose overlays were dropped (more than 4 screens away): their
     * cached renders are back in the first frame after the scroll (put back by the scroll
     * event, before the paint), not one or two frames later when the observers report. */
    {
      const robots = [...doc.querySelectorAll('#main-content img')].filter(img => /godel-robot-\d\.svg/.test(img.getAttribute('src')));
      robots[0]?.scrollIntoView({ block: 'center' });
      await delay(200); await stable(paper, 'godel-agent (the robots)');
      const at = win.scrollY;
      const target = robots.find(img => { const r = img.getBoundingClientRect(); return r.top > 0 && r.bottom < win.innerHeight && paper.overlays.some(o => o.img === img); });
      win.scrollTo({ top: doc.documentElement.scrollHeight, behavior: 'instant' });
      await delay(300); await stable(paper, 'godel-agent (the end)');
      const dropped = !!target && !paper.overlays.some(o => o.img === target);
      const back = await new Promise(resolve => {
        win.scrollTo({ top: at, behavior: 'instant' });
        win.requestAnimationFrame(() => resolve(!!target && paper.overlays.some(o => o.img === target && o.canvas.isConnected)));
      });
      check(dropped && back, `M5: after a jump back, a figure whose overlay was dropped has it again in the first frame (dropped ${dropped}, back in the first frame ${back})`);
      await stable(paper, 'godel-agent (the robots again)');
      compareOverlays(paper, 'godel-agent (after the jump)');
      win.scrollTo({ top: 0, behavior: 'instant' });
      await delay(200); await stable(paper, 'godel-agent (top after the jump)');
    }
    // A resize (a rotated phone, a zoom): overlays made earlier, now between NEAR and FAR
    // screens below, keep their old size until they come near; scrolled into view, each is
    // drawn again for its new content box.
    {
      const robots = paper.overlays.map(o => o.img).filter(img => /godel-robot-\d\.svg/.test(img.getAttribute('src')));
      robots[robots.length - 1]?.scrollIntoView({ block: 'center' });
      await delay(200); await stable(paper, 'godel-agent (robots)');
      win.scrollTo({ top: 0, behavior: 'instant' });
      await delay(200); await stable(paper, 'godel-agent (back to top)');
      frame.style.width = '700px';
      await delay(300); await stable(paper, 'godel-agent at 700 px');
      const content = img => {
        const r = img.getBoundingClientRect(); const s = win.getComputedStyle(img); const px = name => parseFloat(s[name]) || 0;
        return [r.width - px('borderLeftWidth') - px('borderRightWidth') - px('paddingLeft') - px('paddingRight'),
          r.height - px('borderTopWidth') - px('borderBottomWidth') - px('paddingTop') - px('paddingBottom'), s];
      };
      const current = o => { const [w, h, s] = content(o.img); return o.canvas.width === win.SiteLensesMedia._plan(o.img, w, h, win.devicePixelRatio || 1, s).width; };
      const band = paper.overlays.filter(o => o.img.getBoundingClientRect().top > (1 + NEAR) * win.innerHeight && !current(o)).map(o => o.img);
      report.resizeBand = band.map(img => img.getAttribute('src'));
      check(band.length > 0, `After a resize to 700 px, overlays between ${NEAR} and ${FAR} screens below keep their old size for now (${band.length})`);
      const stale = [];
      for (const img of band) {
        img.scrollIntoView({ block: 'center' });
        await delay(150); await stable(paper, 'godel-agent (scrolled after the resize)');
        const o = paper.overlays.find(x => x.img === img);
        if (!o || !current(o)) stale.push(`${img.getAttribute('src')}: ${o ? `${o.canvas.width} px for ${Math.round(content(img)[0])} CSS px` : 'no overlay'}`);
      }
      check(stale.length === 0, `Scrolled into view after a resize, each of those overlays is drawn again at its new size (${stale.join('; ') || 'all current'})`);
      frame.style.width = '1280px';
      win.scrollTo({ top: 0, behavior: 'instant' });
      await delay(300); await stable(paper, 'godel-agent at 1280 px again');
    }
    await lenses()._debug.goto(null);
    same(paperBefore, 'godel-agent after exit');

    await load('/papers/auditing-health-llms.html');
    await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
    const longest = await lenses()._debug.ctx.media({ render: invert, ground: '#ffffff' });
    await longest.ready; await stable(longest, 'auditing-health-llms');
    compareOverlays(longest, 'auditing-health-llms (top)', true);
    // Two passes down the page (the second after a return to the top). A long task the lenses'
    // own scripts caused (long animation frame attribution) fails the check at once; one of
    // the browser's own (its decode, raster or layout, slowed by a loaded machine) fails it
    // only if both passes have one. Both passes are reported.
    const paperHeight = doc.documentElement.scrollHeight;
    const passes = [];
    for (let pass = 0; pass < 2; pass++) {
      if (pass) { win.scrollTo({ top: 0, behavior: 'instant' }); await delay(300); await stable(longest, 'auditing-health-llms (top again)'); }
      const paperSince = win.performance.now();
      for (let k = 1; k <= 16; k++) { win.scrollTo({ top: Math.min(paperHeight, (k / 16) * paperHeight), behavior: 'instant' }); await delay(200); }
      await stable(longest, 'auditing-health-llms (bottom)');
      if (!pass) compareOverlays(longest, 'auditing-health-llms (bottom)');
      passes.push({ tasks: longSince(paperSince), own: ownLongSince(paperSince) });
      if (!passes[0].tasks.length) break;
    }
    report.longTasks['auditing-health-llms'] = passes;
    // Reported, not checked: the first draw of an SVG includes the browser's one-time layout of
    // the SVG document (see the header of media.js).
    report.slices['auditing-health-llms'] = longest._state;
    const ownTasks = passes.flatMap(x => x.own || []);
    check(ownTasks.length === 0 && (passes.length < 2 || passes[1].tasks.length === 0),
      `No long task while scrolling the longest paper page with overlays (${passes.map((x, i) => `pass ${i + 1}: ${x.tasks.join(', ') || 'none'} ms, ${x.own ? `${x.own.length} by the lenses' scripts` : 'unattributed'}`).join('; ')})`);
    await lenses()._debug.goto(null);

    /* 6. Phone width: a wide figure scrolls sideways in .figure-scroll; its overlay is clipped
     * to the scroller and follows the scroll. */
    await load('/papers/auditing-health-llms.html', 390, 844);
    const phoneBefore = snapshot();
    await (await win.SiteLensesBoot.loadCore())._debug.goto('tokens');
    const phone = await lenses()._debug.ctx.media({ render: invert, ground: '#ffffff' });
    await phone.ready; await stable(phone, 'phone');
    const scroller = doc.querySelector('.wide-figure .figure-scroll');
    const wide = phone.overlays.find(o => scroller && scroller.contains(o.img));
    check(scroller && scroller.scrollWidth > scroller.clientWidth + 20, `390 px: the lead figure scrolls sideways (${scroller && scroller.scrollWidth} > ${scroller && scroller.clientWidth})`);
    check(!!wide, '390 px: the scrolling figure has an overlay');
    if (wide && scroller) {
      const clip = wide.canvas.closest('.lenses-media-clip');
      const c = clip && clip.getBoundingClientRect(); const s = scroller.getBoundingClientRect();
      const inner = { left: s.left + scroller.clientLeft, top: s.top + scroller.clientTop, width: scroller.clientWidth, height: scroller.clientHeight };
      check(clip && win.getComputedStyle(clip).overflow === 'hidden' && Math.abs(c.left - inner.left) < 0.6 && Math.abs(c.top - inner.top) < 0.6 &&
        Math.abs(c.width - inner.width) < 0.6 && Math.abs(c.height - inner.height) < 0.6, '390 px: the overlay is clipped to the scroller\'s box');
      const at = () => { const a = wide.canvas.getBoundingClientRect(); const r = wide.img.getBoundingClientRect(); return Math.abs(a.left - r.left) < 0.6 && Math.abs(a.top - r.top) < 0.6; };
      check(at(), '390 px: the overlay starts over the figure');
      scroller.scrollLeft = 160;
      await delay(150);
      check(scroller.scrollLeft > 100 && at(), `390 px: the overlay follows the horizontal scroll (scrollLeft ${scroller.scrollLeft})`);
      scroller.scrollLeft = 0; await delay(100);
    }
    compareOverlays(phone, 'phone');
    await lenses()._debug.goto(null);
    same(phoneBefore, 'phone after exit');

    /* 7. Utilities: draw() sizes and its cap; readable(); classify() on the site's images.
     * They run in the page now in the frame (a function of an unloaded page never resolves). */
    const truth = { photo: ['/figures/me-320.jpg', '/figures/me.png'], graphic: [] };
    // The truth: the portrait and the photography page's photos; every figure of every paper.
    const gallery = await (await fetch('/photography.html')).text();
    truth.photo.push(...new Set([...gallery.matchAll(/<img[^>]+src="(photos\/[^"]+)"/g)].map(match => `/${match[1]}`)));
    await load('/publications.html');
    const papers = [...new Set([...doc.querySelectorAll('#main-content a[href*="papers/"]')].map(a => new URL(a.href).pathname))];
    const figures = new Set();
    for (const page of papers) {
      const html = await (await fetch(page)).text();
      for (const match of html.matchAll(/<img[^>]+src="(assets\/[^"]+)"/g)) figures.add(`/papers/${match[1]}`);
    }
    // Dark app screenshots (a near-black UI background, 83-117 colours) are graphics too.
    truth.graphic = [...figures, ...['nnviz.png', 'CodeRead.png', 'Bouncing Ball.png', 'Tower of Babel.png', 'games.png'].map(name => `/photos/project-demo/${name}`)];
    await new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = `/easter/lenses/media.js?v=${win.SiteLensesBoot.version}`;
      script.onload = resolve; script.onerror = reject;
      doc.head.append(script);
    });
    const M = win.SiteLensesMedia;
    const portrait = new win.Image(); portrait.src = '/figures/me-320.jpg'; await portrait.decode();
    const small = M.draw(portrait, 100, 80, 2);
    check(small.width === 200 && small.height === 160 && small.pixelRatio === 2, `draw() makes round(css x dpr) canvases (${small.width} x ${small.height})`);
    const capped = M.draw(portrait, 2000, 1500, 2);
    check(capped.width * capped.height <= 1.6e6 && capped.pixelRatio < 2 && Math.abs(capped.width / capped.height - 4 / 3) < 0.01, `draw() caps the backing store at 1.6 MP and reports the scale (${capped.width} x ${capped.height}, ${capped.pixelRatio.toFixed(3)} px/css px)`);
    const cover = M.draw(portrait, 200, 100, 1, { objectFit: 'cover', objectPosition: '50% 50%' });
    const coverPixel = cover.getContext('2d').getImageData(0, 0, 1, 1).data;
    check(cover.width === 200 && cover.height === 100 && coverPixel[3] === 255, 'draw() honours object-fit: cover (the box is filled)');
    const contain = M.draw(portrait, 200, 100, 1, 'contain');
    const containEdge = contain.getContext('2d').getImageData(10, 50, 1, 1).data;
    check(containEdge[3] === 0, 'draw() honours object-fit: contain (the sides stay empty)');
    check(M.readable(portrait), 'readable() is true for a same-origin image');
    for (const [kind, urls] of Object.entries(truth)) {
      for (const url of urls) {
        const img = new win.Image(); img.src = encodeURI(decodeURI(url));
        try { await img.decode(); } catch (error) { report.misclassified.push(`${url}: did not load`); continue; }
        const data = await M.sample(img);
        const got = M.classify(data, img);
        const pixelsOnly = M.classify(data);
        report.kinds[url.split('/').pop()] = { got, pixelsOnly, ...M.stats(data) };
        if (got !== kind) report.misclassified.push(`${url}: ${got}`);
        if (kind === 'graphic' && !/\.svg$/.test(url) && pixelsOnly !== 'graphic') report.misclassified.push(`${url}: pixels alone say ${pixelsOnly}`);
      }
    }
    check(truth.photo.length >= 10 && truth.graphic.length >= 20, `classify() is tested on the site's images (${truth.photo.length} photos, ${truth.graphic.length} figures)`);
    check(report.misclassified.length === 0, `classify(): the portrait and the photographs are photos, the paper figures and the dark app screenshots graphics (${report.misclassified.join('; ') || 'none wrong'})`);
    check(M.classify(new win.ImageData(8, 8)) === 'graphic', 'classify(): a transparent image is a graphic');
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    ['lenses-active', 'lenses-ground'].forEach((key, i) => { if (storedLens[i] === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, storedLens[i]); });
  }
  /* 8. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
