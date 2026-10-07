/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes about a minute and a half: tests/run_easter_suites.sh lens_chalk starts it as a
 * background promise and polls for it.
 * Tests lens VII (Chalkboard) through the lenses core, in a frame at 1440 x 900 unless noted:
 *   home (light): the registration; the enter sampled every frame (a sheet of slate fades in
 *     and the style switches only once it is opaque; chalk dust falls while the text is
 *     written; the caption is chalk on a slate halo while the slate comes in, and on a lighter
 *     halo once settled; the sheet is gone once settled); the settled board (classes, the tiles
 *     as data URLs in the lens's own stylesheet and nothing on <html style>, the chalk colours,
 *     the grain mask on the text blocks and not on the fixed buttons' containers, the
 *     hand-drawn rules); the layout, text and elements unchanged;
 *     links and the theme toggle clickable and focusable; the portrait drawn in chalk over a
 *     hidden original; no frame callback while the board rests; the board tile kept in
 *     sessionStorage; the switch back to normal only under a complete sheet of the eraser;
 *     exact restoration; then, at a third of the speed (so that a frame stalled by a busy
 *     machine cannot hide the order), the order of the writing and the eraser's three zig-zag
 *     passes (top band left to right, middle right to left, bottom left to right, in that
 *     order); Esc and an instant reset mid-enter; an instant reset mid-exit (gone at once); a
 *     page hidden mid-enter and mid-exit for longer than the core's limit (both wait, are not
 *     marked failed, and go on where they were once the page shows rather than jumping to
 *     their end; no state left); an instant reset in a page hidden mid-exit (gone at once);
 *     the grain at 1x (never deep enough to cut a thin stem); mask-clip: no-clip on the blocks;
 *   home (dark): the same board in the dark site theme; exact restoration;
 *   reduced motion: the settled board at once with no sheet and no frames; an instant exit;
 *   photography: an overlay on every visible same-origin photo near the viewport, chalk
 *     drawings (a light layer of chalk, bare slate in the shadows), originals hidden; the
 *     lightbox photo drawn in chalk in the media helper's fixed layer over the hidden original
 *     and a slate backdrop, its arrow keeping the pointer; on the next photo the previous
 *     drawing hidden at once and the new one fading in, and going back the first one shown
 *     again with its fade; the drawing going with the lightbox; scrolling the gallery without
 *     long tasks, exact restoration;
 *   a photo's drawing on a synthetic scene: a flat sky stays a quiet, smooth haze, no band of
 *     hatching beside busy leaves, a thin dark twig stays darker than its sky, a small dark bird
 *     slate in an outline, the borders fade out, the same drawing at 1x and 2x; on a second
 *     scene, low midtones keep a visible rub rising with the tone, and a dark busy texture is a
 *     faint mottled rub, not white specks;
 *   godel-agent (a paper page): the paper class, the colour matrix on the scope, the link
 *     colour that the matrix turns into yellow chalk, the caption at the viewport's foot on a
 *     patch of wiped slate, overlays on its figures, filled controls drawn as outlines, exact
 *     restoration;
 *   SummEval's paper page: a pressed heat-map cell keeps its own fill, the pressed chips are
 *     outlines; exact restoration;
 *   the longest paper page: frame callbacks during the enter (budget 4 ms on average), a full
 *     scroll without long tasks, the exit's first step short and no long task while erasing,
 *     exact restoration;
 *   arrival from sessionStorage on a fresh load (godel-agent and photography): settled at once
 *     without a sheet or a caption, within 350 ms of the lens's files; on photography every
 *     photo in view rubbed or drawn soon after, the drawings landing with a short fade and no
 *     rub left once they have; Esc restoring the page as a normal load has it;
 *   390 x 844: enter and exit on home and photography without horizontal overflow.
 * Prints assertions, failures, enter and exit times, arrival times, frame statistics, long
 * tasks and the choreography samples.
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
  const ID = 'chalk';
  const GROUND = '#1f2b26';
  const SLATE = 'rgb(31, 43, 38)';
  const TEXT = 'rgb(228, 223, 210)';
  const YELLOW = 'rgb(238, 216, 156)';
  const BLUE = 'rgb(169, 205, 227)';
  const LONGEST_PAPER = '/papers/auditing-health-llms.html';
  const SLOW = 3;                    // the choreography is sampled at a third of the speed
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = [sessionStorage.getItem('lenses-active'), sessionStorage.getItem('lenses-ground')];
  localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  const errors = []; const warnings = [];
  const report = { enterMs: {}, exitMs: {}, arrivalMs: {}, reducedMs: {}, frameStats: {}, longTasks: {}, overlays: {}, writing: {}, erasing: {} };
  let doc; let win; let longTasks = []; let reduced = false; let queries = []; const pending = new Set();

  // Opens a page in the frame (theme, size and an arriving lens as given) and waits for it.
  const load = async (path, { width = 1440, height = 900, theme = 'light', lens = null, reduce = false } = {}) => {
    localStorage.setItem('theme', theme);
    if (lens) { sessionStorage.setItem('lenses-active', lens); sessionStorage.setItem('lenses-ground', GROUND); } else { sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground'); }
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
    // Reduced motion through matchMedia (the core reads it when it loads), and pending frames.
    reduced = reduce; queries = [];
    const match = win.matchMedia.bind(win);
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') { Object.defineProperty(result, 'matches', { get: () => reduced }); queries.push(result); }
      return result;
    };
    const raf = win.requestAnimationFrame.bind(win); const cancel = win.cancelAnimationFrame.bind(win);
    pending.clear();
    win.requestAnimationFrame = callback => { const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    win.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    if (!lens) {
      let last = ''; let since = performance.now();
      await until(() => {
        const now = doc.getElementById('main-content').innerHTML;
        if (now !== last) { last = now; since = performance.now(); }
        return performance.now() - since > 500;
      }, `${path}: the page to settle`, 10000);
    }
  };
  const core = () => win.SiteLensesBoot.loadCore();
  const state = () => win.SiteLenses._debug.state;
  const lens = () => win.SiteLenses._debug.lens(ID);
  const idle = () => until(() => !win.SiteLenses || !win.SiteLenses.busy, 'the lenses to settle', 20000);
  const nextPaint = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  const escape = () => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const cls = () => doc.documentElement.classList;
  const css = (el, name) => win.getComputedStyle(el).getPropertyValue(name);
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  // Everything a lens could leave behind (the core's own assets may stay once loaded).
  // A lens module's <script> is in <head> only while it loads (the core removes it, and it
  // prefetches the next lens after an enter), so it is not counted either.
  const ours = el => /easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '') ||
    (el.tagName === 'SCRIPT' && /easter\/lenses\/[a-z]+\.js/.test(el.getAttribute('src') || ''));
  const snapshot = () => ({
    main: doc.getElementById('main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlAttrs: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    headKids: [...doc.head.children].filter(el => !ours(el)).map(el => el.outerHTML).join('\n'),
    scroll: Math.round(win.scrollY),
    focus: doc.activeElement
  });
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return `at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const compare = (before, label) => {
    const now = snapshot();
    check(now.main === before.main, `${label}: #main-content markup is byte-identical (${firstDiff(before.main, now.main)})`);
    check(now.nav === before.nav && now.footer === before.footer, `${label}: nav and footer markup are byte-identical (${firstDiff(before.nav, now.nav)}${firstDiff(before.footer, now.footer)})`);
    check(now.htmlAttrs === before.htmlAttrs, `${label}: <html> attributes restored (${now.htmlAttrs.slice(0, 160)})`);
    check(now.bodyAttrs === before.bodyAttrs, `${label}: <body> attributes restored (${now.bodyAttrs})`);
    check(now.bodyKids === before.bodyKids, `${label}: no node left in <body> (${now.bodyKids})`);
    check(now.headKids === before.headKids, `${label}: no <style>, <link> or <script> left in <head> (${firstDiff(before.headKids, now.headKids)})`);
    check(now.scroll === before.scroll, `${label}: scroll position unchanged (${now.scroll} vs ${before.scroll})`);
    check(now.focus === before.focus, `${label}: focus unchanged`);
    check(!doc.querySelector('.lenses-layer, .lenses-caption, .lenses-media') && !/(^| )lens-chalk/.test(doc.documentElement.className),
      `${label}: no lens layer, overlay, caption or class remains`);
    check(state().frames === 0 && !state().raf, `${label}: no frame callback is left`);
  };
  // The boxes of a sample of elements: the lens paints only, so none may move.
  const layoutOf = () => [...doc.querySelectorAll('#main-content :is(h1, h2, p, li, img, figure, table), #site-nav a, #site-footer p')]
    .slice(0, 120).map(el => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top + win.scrollY)},${Math.round(r.width)},${Math.round(r.height)}`; }).join(';');
  const tags = root => [...root.querySelectorAll('*')].map(el => el.tagName).join(',');
  const sameOrigin = img => !/^(https?:)?\/\//i.test(img.getAttribute('src') || '');
  const scopeImages = () => [...doc.querySelectorAll('#site-nav img, #main-content img, #site-footer img, body > header.site-header img, body > footer.paper-footer img')];
  // Images the media helper should be drawing now: loaded, same origin, at least 24 x 24, and
  // within 1.5 viewports of the view (its NEAR_MARGIN).
  const nearImages = () => scopeImages().filter(img => {
    if (!sameOrigin(img) || !img.complete || !img.naturalWidth) return false;
    const r = img.getBoundingClientRect();
    const h = win.innerHeight; const w = doc.documentElement.clientWidth;
    return r.width >= 24 && r.height >= 24 && r.bottom > -1.5 * h && r.top < 2.5 * h && r.right > -1.5 * w && r.left < 2.5 * w;
  });
  const media = () => lens()._test.state && lens()._test.state.media;
  const mediaSettled = async label => {
    await until(() => { const m = media(); if (!m) return false; const s = m._state; return !s.busy && !s.queued && !s.unseen; }, `${label}: the drawings`, 20000);
    await delay(200);
  };
  // Alpha statistics of an overlay canvas: shares of clear and of chalked pixels.
  const alphaStats = canvas => {
    const g = canvas.getContext('2d');
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0; let chalk = 0; let n = 0;
    let sum = 0;
    for (let i = 3; i < data.length; i += 4 * 7) { n++; sum += data[i]; if (data[i] < 8) clear++; else if (data[i] > 120) chalk++; }
    return { clear: clear / n, chalk: chalk / n, mean: sum / n / 255 };
  };
  const sheets = () => [...doc.querySelectorAll('.lens-chalk-sheet')];
  const alphaAt = (canvas, x, y) => {
    const k = canvas.width / parseFloat(canvas.style.width);
    const left = parseFloat(canvas.style.left) - win.scrollX; const top = parseFloat(canvas.style.top) - win.scrollY;
    try { return canvas.getContext('2d').getImageData(Math.round((x - left) * k), Math.round((y - top) * k), 1, 1).data[3]; } catch (error) { return -1; }
  };
  const statsDelta = (before, after) => {
    const frames = after.frames - before.frames;
    return frames > 0 ? { frames, avgMs: +((after.avgMs * after.frames - before.avgMs * before.frames) / frames).toFixed(3), maxMs: after.maxMs } : { frames: 0, avgMs: 0, maxMs: 0 };
  };
  const chalkStats = () => JSON.parse(JSON.stringify(state().frameStats[ID] || { frames: 0, avgMs: 0, maxMs: 0 }));
  // A step through the whole page: no long task may come from the lens.
  const scrollThrough = async (label, steps = 40, pause = 60) => {
    const since = win.performance.now();
    const height = doc.documentElement.scrollHeight - win.innerHeight;
    for (let k = 0; k <= steps; k++) { win.scrollTo({ top: (k / steps) * height, behavior: 'instant' }); await delay(pause); }
    await delay(600);
    win.scrollTo({ top: 0, behavior: 'instant' });
    await delay(300);
    const tasks = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
    report.longTasks[label] = tasks;
    check(tasks.length === 0, `${label}: no task over 50 ms while scrolling (${tasks.join(', ')} ms)`);
  };

  try {
    /* 1. Home, light: registration, the enter's choreography, the settled board, the exit. */
    await load('/');
    let c = await core();
    await c._debug.loadAll();
    const L = lens();
    check(!!L && L.order === 7 && L.numeral === 'VII' && L.label === 'Chalkboard' && L.line === 'Every result was once erasable.' && L.ground === GROUND && L.css === true,
      'chalk registers as VII · Chalkboard — Every result was once erasable., ground #1f2b26, with a stylesheet');
    check(c._debug.lenses.indexOf(ID) === 6, 'chalk is the seventh lens of the cycle');
    const base = snapshot(); const baseLayout = layoutOf(); const baseText = doc.getElementById('main-content').textContent; const baseTags = tags(doc.getElementById('main-content'));
    {
      // Sample every frame: the sheet, the switch, the dust. (The order of the writing is
      // checked below at a slower pace, where a stalled frame cannot hide it.)
      const samples = { switchOpacity: null, dust: false, sheetSeen: false, slateCaption: null, switchHalo: null };
      let sampling = true;
      const sample = () => {
        if (!sampling) return;
        const sheet = sheets()[0];
        const cap = doc.querySelector('.lenses-caption');
        if (sheet) samples.sheetSeen = true;
        // The caption while the slate comes in (before the switch) and at the switch.
        if (sheet && cap && !samples.slateCaption && !cls().contains('lens-chalk-on')) samples.slateCaption = css(cap, 'color');
        if (doc.querySelector('.lens-chalk-dust')) samples.dust = true;
        if (cls().contains('lens-chalk-on') && samples.switchOpacity === null) {
          samples.switchOpacity = sheet ? +win.getComputedStyle(sheet).opacity : -1;
          samples.switchHalo = cap ? css(cap, '-webkit-text-stroke-color') : null;
        }
        win.requestAnimationFrame(sample);
      };
      win.requestAnimationFrame(sample);
      const statsBefore = chalkStats();
      const began = performance.now();
      await c._debug.goto(ID);
      report.enterMs.home = Math.round(performance.now() - began);
      sampling = false;
      report.writing = { switchOpacity: samples.switchOpacity, dust: samples.dust };
      report.frameStats.homeEnter = statsDelta(statsBefore, chalkStats());
      check(c.current === ID, 'home: chalk enters');
      check(report.enterMs.home > 1100 && report.enterMs.home < 2600, `home: the enter takes about 1.5 s (${report.enterMs.home} ms)`);
      check(samples.sheetSeen && samples.switchOpacity !== null && samples.switchOpacity >= 0.99, `home: the style switches under an opaque sheet of slate (opacity ${samples.switchOpacity})`);
      check(samples.dust, 'home: chalk dust falls while the text is written');
      // The caption is chalk on a slate halo from the start, never the page's grey in a white
      // halo over the sheet; settled, its halo is the lighter one (the board's clouds).
      check(samples.slateCaption === 'rgba(228, 223, 210, 0.76)' && samples.switchHalo === 'rgb(31, 43, 38)',
        `home: the caption is chalk on a slate halo while the slate comes in (${samples.slateCaption}, halo ${samples.switchHalo} at the switch)`);
      await delay(320);
      const cap = doc.querySelector('.lenses-caption');
      report.captionHalo = cap ? css(cap, '-webkit-text-stroke-color') : null;
      check(report.captionHalo === 'rgba(31, 43, 38, 0.5)', `home: once settled the caption's halo is the slate at half strength (${report.captionHalo})`);
      check(report.frameStats.homeEnter.avgMs < 4, `home: frame callbacks average under 4 ms while entering (${report.frameStats.homeEnter.avgMs} ms)`);
    }
    // The settled board.
    await nextPaint(); await nextPaint();
    const root = doc.documentElement;
    check(!doc.querySelector('.lens-chalk-sheet, .lens-chalk-dust'), 'home: no sheet or dust is left once settled');
    check(['lens-chalk', 'lens-chalk-on', 'lens-chalk-shell', 'lens-chalk-home'].every(name => cls().contains(name)), `home: the board classes are on (${root.className})`);
    {
      // The tiles are data URLs in the lens's own <style> (in its layer), never on <html>.
      const tiles = doc.querySelector('.lenses-layer style.lens-chalk-tiles');
      check(!!tiles && /url\("data:image\/jpeg/.test(tiles.textContent) && /url\("data:image\/png/.test(tiles.textContent) && !/blob:/.test(tiles.textContent),
        'home: the board and grain tiles are data URLs in the lens\'s own stylesheet');
      check(root.getAttribute('style') === null || !/lens-chalk/.test(root.getAttribute('style')), `home: nothing of the lens is written on <html style> (${root.getAttribute('style')})`);
      check(/url\("data:image\/jpeg/.test(css(root, 'background-image')), 'home: the root background is the board tile');
    }
    check(css(root, 'background-color') === SLATE && /url\(/.test(css(root, 'background-image')), `home: the ground is the slate tile (${css(root, 'background-color')})`);
    const boardKey = Object.keys(win.sessionStorage).find(key => key.startsWith('lenses-chalk-board@'));
    check(!!boardKey && win.sessionStorage.getItem(boardKey).startsWith('data:image/jpeg'), `home: the board tile is kept in sessionStorage (${boardKey})`);
    const main = doc.getElementById('main-content');
    check(css(doc.querySelector('#main-content .bio'), 'color') === TEXT, `home: body text is white chalk (${css(doc.querySelector('#main-content .bio'), 'color')})`);
    check(css(doc.querySelector('#main-content .bio a'), 'color') === YELLOW, `home: links are yellow chalk (${css(doc.querySelector('#main-content .bio a'), 'color')})`);
    check(css(doc.querySelector('#site-nav .nav-button[aria-current="page"]'), 'color') === BLUE, 'home: the current page in the nav is pale blue chalk');
    check(/url\(/.test(css(main, 'mask-image') || css(main, '-webkit-mask-image')), 'home: the text blocks carry the chalk grain mask');
    check(/^none$/.test(css(doc.getElementById('site-footer'), 'mask-image') || 'none') && /^none$/.test(css(doc.getElementById('site-nav'), 'mask-image') || 'none'),
      'home: #site-nav and #site-footer themselves are not masked (their skip link and back-to-top button are fixed)');
    check(!win.CSS.supports('mask-clip', 'no-clip') || css(main, 'mask-clip') === 'no-clip',
      `home: the grain does not clip what overflows a masked block (mask-clip ${css(main, 'mask-clip')})`);
    {
      // At one device px per css px a speck is as wide as a thin stem: none may cut it.
      const tile = new win.Image(); tile.src = L._test.makeGrain().url; await tile.decode();
      const probe = doc.createElement('canvas'); probe.width = tile.width; probe.height = tile.height;
      const pg = probe.getContext('2d'); pg.drawImage(tile, 0, 0);
      const px = pg.getImageData(0, 0, tile.width, tile.height).data;
      let least = 255; for (let i = 3; i < px.length; i += 4) least = Math.min(least, px[i]);
      report.grainLeast = { dpr: win.devicePixelRatio, alpha: +(least / 255).toFixed(2) };
      check(win.devicePixelRatio >= 1.5 || least / 255 > 0.55, `home: at 1x the grain never takes more than about 40 % of a thin stem away (least alpha ${(least / 255).toFixed(2)})`);
    }
    const rule = doc.querySelector('#main-content .homepage-section h2');
    check(/svg/.test(css(rule, 'background-image')) && css(rule, 'border-bottom-color') === 'rgba(0, 0, 0, 0)', 'home: the section rules are hand-drawn chalk lines');
    check(layoutOf() === baseLayout, 'home: the layout is unchanged (paint only)');
    check(main.textContent === baseText && tags(main) === baseTags, 'home: the text and elements of #main-content are unchanged');
    // Links and the theme toggle stay usable.
    for (const link of [doc.querySelector('#main-content .bio a[href]'), doc.querySelector('#site-nav .nav-button:not([aria-current])'), doc.querySelector('#main-content .profile-links a[href]')]) {
      const at = centre(link); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === link, `home: the link "${link.textContent.trim()}" is clickable (hit ${hit && hit.tagName})`);
    }
    {
      const toggle = doc.getElementById('theme-toggle'); const at = centre(toggle); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('#theme-toggle') === toggle, 'home: the theme toggle is clickable');
      const link = doc.querySelector('#main-content .bio a[href]'); link.focus();
      check(doc.activeElement === link, 'home: keyboard focus reaches a link');
      link.blur();
    }
    // The portrait in chalk.
    await mediaSettled('home');
    {
      const photo = doc.querySelector('#main-content .profile-photo');
      const overlay = media().overlays.find(o => o.img === photo);
      check(!!overlay && overlay.kind === 'photo', 'home: the portrait has a chalk drawing');
      check(css(photo, 'opacity') === '0', 'home: the original portrait gives way (opacity 0)');
      if (overlay) {
        const s = alphaStats(overlay.canvas);
        report.overlays.portrait = s;
        check(s.clear > 0.05 && s.chalk > 0.05, `home: the portrait is chalk strokes with slate between them (clear ${s.clear.toFixed(2)}, chalk ${s.chalk.toFixed(2)})`);
        const r = photo.getBoundingClientRect(); const o = overlay.canvas.getBoundingClientRect();
        check(Math.abs(r.left - o.left) < 2.5 && Math.abs(r.top - o.top) < 2.5 && Math.abs(r.width - o.width) < 5, 'home: the drawing sits on the portrait');
      }
      check(media().overlays.length === nearImages().length, `home: one drawing per visible same-origin image (${media().overlays.length} of ${nearImages().length})`);
    }
    await nextPaint(); await nextPaint(); await nextPaint();
    check(state().frames === 0 && !state().raf, 'home: no frame callback runs while the board rests');
    // The exit: the page returns to normal only under a complete sheet.
    {
      const w = doc.documentElement.clientWidth; const h = win.innerHeight;
      const points = [[0.12 * w, 0.17 * h], [0.88 * w, 0.17 * h], [0.12 * w, 0.5 * h], [0.88 * w, 0.5 * h], [0.12 * w, 0.83 * h], [0.88 * w, 0.83 * h]];
      const at = { switchOff: null, sheetFullAtSwitch: null }; let t0 = 0; let sampling = true;
      const sample = time => {
        if (!sampling) return;
        if (!t0) t0 = time;
        const sheet = sheets()[0];
        if (at.switchOff === null && !cls().contains('lens-chalk-on')) {
          at.switchOff = Math.round(time - t0);
          at.sheetFullAtSwitch = !!sheet && points.every(([x, y]) => alphaAt(sheet, x, y) > 250);
        }
        win.requestAnimationFrame(sample);
      };
      win.requestAnimationFrame(sample);
      const began = performance.now();
      escape(); await idle();
      report.exitMs.home = Math.round(performance.now() - began);
      sampling = false;
      report.erasing = { ...at };
      check(report.exitMs.home > 550 && report.exitMs.home < 1300, `home: the exit takes about 0.8 s (${report.exitMs.home} ms)`);
      check(at.sheetFullAtSwitch === true, `home: the page returns to normal only under a complete sheet (switch at ${at.switchOff} ms)`);
      await nextPaint(); await nextPaint();
      compare(base, 'home after exit');
      check(layoutOf() === baseLayout, 'home after exit: the layout is as before');
    }
    // The choreography, at a third of the speed so that a frame stalled by a busy machine
    // cannot hide the order: the writing (a line from left to right, a lower line after a
    // higher one) and the eraser's three zig-zag passes (top band left to right, middle right
    // to left, bottom left to right, from top to bottom).
    {
      L._test.pace.slow = SLOW;
      const bio = doc.querySelector('#main-content .bio');
      const range = doc.createRange(); range.selectNodeContents(bio);
      const first = [...range.getClientRects()].filter(r => r.width > 100)[0];
      const lower = doc.querySelector('#main-content .homepage-section h2').getBoundingClientRect();
      const writePoints = { left: [first.left + 8, first.top + first.height / 2], right: [first.right - 8, first.top + first.height / 2], lower: [lower.left + 8, lower.top + lower.height / 2] };
      const w = doc.documentElement.clientWidth; const h = win.innerHeight;
      const erasePoints = { topLeft: [0.12 * w, 0.17 * h], topRight: [0.88 * w, 0.17 * h], midLeft: [0.12 * w, 0.5 * h], midRight: [0.88 * w, 0.5 * h], bottomLeft: [0.12 * w, 0.83 * h], bottomRight: [0.88 * w, 0.83 * h] };
      const cleared = {}; const erased = {}; let mode = 'write'; let t0 = 0; let sampling = true;
      const sample = time => {
        if (!sampling) return;
        if (!t0) t0 = time;
        const sheet = sheets()[0];
        if (sheet && mode === 'write' && cls().contains('lens-chalk-on')) {
          for (const [name, [x, y]] of Object.entries(writePoints)) if (!(name in cleared) && alphaAt(sheet, x, y) < 40) cleared[name] = Math.round(time - t0);
        }
        if (sheet && mode === 'erase') {
          for (const [name, [x, y]] of Object.entries(erasePoints)) if (!(name in erased) && alphaAt(sheet, x, y) > 250) erased[name] = Math.round(time - t0);
        }
        win.requestAnimationFrame(sample);
      };
      win.requestAnimationFrame(sample);
      try {
        await c._debug.goto(ID);
        mode = 'erase'; t0 = 0;
        escape(); await idle();
      } finally { sampling = false; L._test.pace.slow = 1; }
      report.writing = { ...report.writing, ...cleared };
      report.erasing = { ...report.erasing, ...erased };
      check('left' in cleared && 'right' in cleared && cleared.left < cleared.right, `home: a line is written from left to right (${cleared.left} ms, then ${cleared.right} ms, at 1/${SLOW} speed)`);
      check('lower' in cleared && cleared.lower > cleared.left, `home: a lower line is written after a higher one (${cleared.left} ms, then ${cleared.lower} ms, at 1/${SLOW} speed)`);
      const e = erased;
      check(e.topLeft < e.topRight && e.midRight < e.midLeft && e.bottomLeft < e.bottomRight,
        `home: the eraser zig-zags (top left to right, middle right to left, bottom left to right: ${JSON.stringify(e)})`);
      check(e.topRight <= e.midRight && e.midLeft <= e.bottomLeft, 'home: the passes go from top to bottom');
      await nextPaint(); await nextPaint();
      compare(base, 'home after the slow enter and exit');
    }
    // Esc and an instant reset while entering.
    {
      const before = snapshot();
      c._debug.goto(ID);
      await until(() => state().phase === 'entering' && doc.querySelector('.lens-chalk-sheet'), 'chalk to start entering');
      await delay(500);
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(before, 'home: Esc while entering');
      c._debug.goto(ID);
      await until(() => cls().contains('lens-chalk-on'), 'chalk to switch while entering');
      await delay(150);
      const began = performance.now();
      await c.reset({ instant: true });
      check(performance.now() - began < 900, `home: an instant reset while writing finishes at once (${Math.round(performance.now() - began)} ms)`);
      await nextPaint(); await nextPaint();
      compare(before, 'home: instant reset while entering');
    }
    // An instant reset while erasing (pagehide before the back-forward cache): the lens is gone
    // at once, wherever the eraser is, rather than after its passes and its fade.
    report.instantExitMs = {};
    for (const ms of [100, 300, 560]) {
      const before = snapshot();
      await c._debug.goto(ID);
      escape(); await delay(ms);
      const began = performance.now();
      await c.reset({ instant: true });
      report.instantExitMs[ms] = Math.round(performance.now() - began);
      check(report.instantExitMs[ms] < 250, `home: an instant reset ${ms} ms into the exit finishes at once (${report.instantExitMs[ms]} ms)`);
      await nextPaint(); await nextPaint();
      compare(before, `home: instant reset ${ms} ms into the exit`);
    }
    // A hidden page: the core's frame loop pauses there, and so do the writing and the eraser
    // (their clocks are the loop's steps); the core's limits pause with them. An enter or an exit
    // hidden midway for longer than the (shortened) limit must not be marked failed, and must go
    // on where it was once the page shows again (the rest of the writing, the rest of the passes:
    // not a jump to the end), leaving nothing behind. An instant reset while the page is hidden
    // midway through the exit ends it at once (no frame comes there: a timer looks).
    {
      let hidden = false;
      const setHidden = value => { hidden = value; doc.dispatchEvent(new win.Event('visibilitychange')); };
      Object.defineProperty(doc, 'hidden', { get: () => hidden, configurable: true });
      const limits = { ...c._debug.limits };
      // Longer than a whole enter (about 1.7 s of visible time) or exit, shorter than the time
      // hidden plus visible.
      c._debug.limits.enter = 2600; c._debug.limits.exit = 1400;
      try {
        const before = snapshot();
        const entering = c._debug.goto(ID);
        await until(() => cls().contains('lens-chalk-on'), 'chalk to switch before the page is hidden');
        await delay(200);
        setHidden(true);
        await delay(3000);
        check(state().phase === 'entering' && !state().failed.includes(ID) && !!doc.querySelector('.lens-chalk-sheet'),
          `home: an enter hidden midway waits for the page (phase ${state().phase}, failed ${state().failed})`);
        setHidden(false);
        let began = performance.now();
        await Promise.race([entering, delay(5000)]);
        report.hiddenMs = { enter: Math.round(performance.now() - began) };
        check(c.current === ID && state().phase === 'active' && !state().failed.includes(ID),
          `home: the enter goes on once the page shows again (${report.hiddenMs.enter} ms, phase ${state().phase}, failed ${state().failed})`);
        check(report.hiddenMs.enter > 600, `home: the enter resumes where it was rather than jumping to its end (${report.hiddenMs.enter} ms after the page shows)`);
        await nextPaint(); await nextPaint();
        check(!doc.querySelector('.lens-chalk-sheet, .lens-chalk-dust'), 'home: no sheet is left by an enter hidden midway');
        escape(); await delay(150);
        setHidden(true);
        await delay(2000);
        check(c.busy && !state().failed.includes(ID), `home: an exit hidden midway waits for the page (failed ${state().failed})`);
        setHidden(false);
        began = performance.now();
        await until(() => !c.busy, 'the exit to end once the page shows again', 5000);
        report.hiddenMs.exit = Math.round(performance.now() - began);
        check(c.current === null && lens()._test.state === null && !warnings.some(w => /chalk/.test(w)),
          `home: the exit goes on once the page shows again and keeps no state (${report.hiddenMs.exit} ms)`);
        check(report.hiddenMs.exit > 350, `home: the exit resumes where it was rather than jumping to its end (${report.hiddenMs.exit} ms after the page shows)`);
        await nextPaint(); await nextPaint();
        compare(before, 'home: enter and exit hidden midway');
        // An instant reset while hidden midway through the exit.
        await c._debug.goto(ID);
        escape(); await delay(200);
        setHidden(true);
        began = performance.now();
        await c.reset({ instant: true });
        report.hiddenMs.instantExit = Math.round(performance.now() - began);
        setHidden(false);
        check(report.hiddenMs.instantExit < 300 && !warnings.some(w => /chalk/.test(w)),
          `home: an instant reset in a page hidden midway through the exit ends it at once (${report.hiddenMs.instantExit} ms)`);
        await nextPaint(); await nextPaint();
        compare(before, 'home: instant reset in a hidden page mid-exit');
      } finally { delete doc.hidden; Object.assign(c._debug.limits, limits); }
    }

    /* 2. Home, dark site theme: the same board. */
    await load('/', { theme: 'dark' });
    c = await core();
    {
      const before = snapshot();
      await c._debug.goto(ID);
      await nextPaint();
      check(css(doc.documentElement, 'background-color') === SLATE && css(doc.body, 'background-color') === 'rgba(0, 0, 0, 0)', 'dark: the ground is the same slate (the body is transparent)');
      check(css(doc.querySelector('#main-content .bio'), 'color') === TEXT && css(doc.querySelector('#main-content .bio a'), 'color') === YELLOW, 'dark: the same chalk colours');
      check(css(doc.querySelector('#main-content .homepage-section h2'), 'border-bottom-color') === 'rgba(0, 0, 0, 0)', 'dark: the rules are chalk lines too');
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(before, 'dark after exit');
      check(doc.documentElement.dataset.theme === 'dark', 'dark: the site theme is kept');
    }

    /* 3. Reduced motion: the settled board at once, no sheet, no frames; an instant exit. */
    await load('/', { reduce: true });
    c = await core();
    await c._debug.loadAll();
    {
      await c._debug.goto(ID); await c.reset();          // a first visit loads the assets
      const before = snapshot();
      let sheetSeen = false;
      const watch = new win.MutationObserver(() => { if (doc.querySelector('.lens-chalk-sheet, .lens-chalk-dust')) sheetSeen = true; });
      watch.observe(doc.body, { childList: true, subtree: true });
      let began = performance.now();
      await c._debug.goto(ID);
      report.reducedMs.enter = Math.round(performance.now() - began);
      check(c.current === ID && report.reducedMs.enter < 400, `reduced motion: the board at once (${report.reducedMs.enter} ms)`);
      await nextPaint(); await nextPaint(); await nextPaint();
      check(state().frames === 0 && !state().raf, 'reduced motion: no animation frames');
      began = performance.now();
      await c.reset();
      report.reducedMs.exit = Math.round(performance.now() - began);
      check(report.reducedMs.exit < 300, `reduced motion: the exit is instant (${report.reducedMs.exit} ms)`);
      watch.disconnect();
      check(!sheetSeen, 'reduced motion: no sheet of slate and no dust');
      compare(before, 'reduced motion after exit');
    }

    /* 4. Photography: every visible photo drawn in chalk, originals hidden, smooth scrolling. */
    await load('/photography.html');
    c = await core();
    {
      const before = snapshot(); const beforeLayout = layoutOf();
      const began = performance.now();
      await c._debug.goto(ID);
      report.enterMs.photography = Math.round(performance.now() - began);
      await mediaSettled('photography');
      const near = nearImages();
      const drawn = media().overlays.filter(o => near.includes(o.img));
      report.overlays.photography = { near: near.length, drawn: drawn.length, all: media().overlays.length };
      check(near.length >= 3 && drawn.length === near.length, `photography: every visible same-origin photo near the view is drawn (${drawn.length} of ${near.length})`);
      check(drawn.every(o => o.kind === 'photo'), 'photography: the gallery photos are drawn as photos');
      // A drawing, not a photo: mostly a light layer of chalk (its mean opacity well under
      // an opaque print), with bare slate in its shadows and dense marks in its lights.
      const s = drawn.map(o => alphaStats(o.canvas));
      report.overlays.photographyStats = s.map(v => `${v.clear.toFixed(2)}/${v.chalk.toFixed(2)}/${v.mean.toFixed(2)}`);
      // (A night photo, The Two-Dimensional Tower, is mostly bare slate: its mean is about 0.05.)
      check(s.every(v => v.mean > 0.03 && v.mean < 0.5) && s.filter(v => v.clear > 0.05).length >= s.length / 2 && s.filter(v => v.chalk > 0.01).length >= s.length / 2,
        `photography: the drawings are chalk on slate (clear/chalk/mean ${report.overlays.photographyStats.join(', ')})`);
      check(scopeImages().filter(sameOrigin).every(img => css(img, 'opacity') === '0'), 'photography: the original photos give way');
      check(layoutOf() === beforeLayout, 'photography: the layout is unchanged');
      // The lightbox (outside the scope, position: fixed): its photo is drawn in chalk too, in
      // the media helper's fixed layer over a slate backdrop; the drawing follows the next
      // photo and goes with the lightbox; its arrows and close button keep the pointer.
      {
        const box = doc.getElementById('lightbox'); const boxImg = doc.getElementById('lightbox-img');
        const fixedOverlay = () => media().overlays.find(o => o.img === boxImg && o.fixed);
        const placed = o => { const a = boxImg.getBoundingClientRect(); const b = o.canvas.getBoundingClientRect(); return Math.abs(a.left - b.left) < 2.5 && Math.abs(a.top - b.top) < 2.5 && Math.abs(a.width - b.width) < 3 && Math.abs(a.height - b.height) < 3; };
        doc.querySelector('.photo-item').click();
        await until(() => box.classList.contains('active') && boxImg.complete && boxImg.naturalWidth > 0, 'the lightbox to open');
        await until(() => fixedOverlay() && placed(fixedOverlay()), 'the lightbox photo to be drawn', 15000);
        const first = fixedOverlay(); const firstCanvas = first.canvas;   // the overlay record is live: keep its canvas
        check(first.kind === 'photo' && css(boxImg, 'opacity') === '0', `photography: the lightbox photo is drawn in chalk over the hidden original (${first.kind}, opacity ${css(boxImg, 'opacity')})`);
        const ls = alphaStats(first.canvas);
        check(ls.mean > 0.05 && ls.mean < 0.5, `photography: the lightbox drawing is chalk on slate (clear ${ls.clear.toFixed(2)}, chalk ${ls.chalk.toFixed(2)}, mean ${ls.mean.toFixed(2)})`);
        check(css(box, 'background-color') === 'rgba(31, 43, 38, 0.98)', `photography: the lightbox's backdrop is the slate (${css(box, 'background-color')})`);
        const next = doc.getElementById('lightbox-next'); const at = centre(next); const hit = doc.elementFromPoint(at.x, at.y);
        check(hit === next, `photography: the lightbox's arrow keeps the pointer over the drawing (hit ${hit && (hit.id || hit.tagName)})`);
        const src = boxImg.getAttribute('src');
        // The next photo: the previous drawing goes at once (its title is the next photo's),
        // the slate shows until the new drawing lands, and that fades in.
        next.click();
        await null;
        const stale = fixedOverlay();
        check(!stale || stale.canvas !== firstCanvas || stale.canvas.style.opacity === '0',
          `photography: the previous photo's drawing is hidden as soon as the lightbox changes photo (opacity ${stale && stale.canvas.style.opacity})`);
        await until(() => boxImg.getAttribute('src') !== src && boxImg.complete, 'the next photo');
        await until(() => { const o = fixedOverlay(); return o && o.canvas !== firstCanvas && placed(o); }, 'the next photo to be drawn', 15000);
        const second = fixedOverlay().canvas;
        check(second.getAnimations().some(a => a.playState === 'running' || a.playState === 'finished') && second.style.opacity !== '0',
          'photography: the drawing follows the lightbox to the next photo and fades in');
        // Back to the first photo (its drawing is cached): shown again, and faded in again.
        doc.getElementById('lightbox-prev').click();
        await null;
        await until(() => boxImg.getAttribute('src') === src && boxImg.complete, 'the previous photo');
        await until(() => { const o = fixedOverlay(); return o && o.canvas !== second && placed(o); }, 'the previous photo to be drawn again', 15000);
        const third = fixedOverlay().canvas;
        check(third.style.opacity !== '0' && third.getAnimations().length > 0, `photography: going back, the first photo's drawing shows again with its fade (opacity ${third.style.opacity})`);
        doc.getElementById('close-lightbox').click();
        await until(() => !box.classList.contains('active'), 'the lightbox to close');
        await until(() => !media().overlays.some(o => o.fixed), 'the lightbox drawing to go', 5000);
        check(!doc.querySelector('.lenses-media-fixed .lenses-media'), 'photography: the lightbox drawing goes with the lightbox');
      }
      await scrollThrough('photography');
      await nextPaint(); await nextPaint();
      check(state().frames === 0 && !state().raf, 'photography: no frame callback runs after scrolling');
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(before, 'photography after exit');
    }

    /* 4b. A photo's drawing, on a synthetic scene (deterministic): a sky of 0.75-0.9 grey with a
       little noise, busy leaves on its left third, a thin dark twig across it and a small dark
       bird. The sky must be a quiet, smooth haze (never static: no grain of dense specks, a
       small spread), the leaves must not leave a band of hatching in the sky beside them, the
       twig must stay a dark line darker than its sky (not a white one), the bird slate inside a
       chalk outline, the borders fade to nothing, and the drawing must be the same at 1x and
       2x. */
    {
      const W = 320; const H = 220;
      const hashf = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const onTwig = (x, y) => { const t = Math.max(0, Math.min(1, ((x - 180) * 120 + (y - 30) * 90) / 22500)); return Math.hypot(x - (180 + 120 * t), y - (30 + 90 * t)); };
      const scene = dpr => {
        const canvas = doc.createElement('canvas'); canvas.width = W * dpr; canvas.height = H * dpr;
        const g = canvas.getContext('2d', { willReadFrequently: true });
        const image = g.createImageData(W * dpr, H * dpr); const d = image.data;
        for (let y = 0; y < H * dpr; y++) {
          for (let x = 0; x < W * dpr; x++) {
            const cx = x / dpr; const cy = y / dpr;
            let l = 0.75 + (0.15 * cy) / H + (hashf(cx | 0, cy | 0) - 0.5) * 0.03;
            if (cx < 120) l = 0.2 + 0.7 * hashf((cx / 5) | 0, (cy / 5) | 0);
            if (onTwig(cx, cy) < 0.9) l = 0.15;
            if (Math.hypot(cx - 250, cy - 175) < 4.5) l = 0.1;
            const i = (y * W * dpr + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.round(l * 255); d[i + 3] = 255;
          }
        }
        g.putImageData(image, 0, 0);
        return { img: null, canvas, ctx2d: g, width: W * dpr, height: H * dpr, dpr, cssWidth: W, cssHeight: H, readable: true, kind: 'photo' };
      };
      // The drawing's alpha per css px (a 2x drawing averaged over its 2 x 2 device px).
      const alphas = async dpr => {
        // The lens of the page now in the frame: a function of a page that has gone (L, from
        // home) would wait forever on its yields, whose MessageChannel belongs to a detached
        // document.
        const out = await lens()._test.drawPhoto(scene(dpr), new win.AbortController().signal);
        const d = out.getContext('2d').getImageData(0, 0, out.width, out.height).data;
        const a = new Float32Array(W * H);
        for (let y = 0; y < H * dpr; y++) for (let x = 0; x < W * dpr; x++) a[((y / dpr) | 0) * W + ((x / dpr) | 0)] += d[(y * W * dpr + x) * 4 + 3] / 255 / (dpr * dpr);
        return a;
      };
      const region = (a, x0, x1, y0, y1, skip = () => false) => {
        let sum = 0; let squares = 0; let n = 0; let lit = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (skip(x, y)) continue; const v = a[y * W + x]; sum += v; squares += v * v; n++; if (v > 0.5) lit++; }
        return { mean: +(sum / n).toFixed(3), lit: +(lit / n).toFixed(3), std: +Math.sqrt(Math.max(0, squares / n - (sum / n) ** 2)).toFixed(3) };
      };
      const one = await alphas(1); const two = await alphas(2);
      const apart = (x, y) => onTwig(x, y) < 12 || Math.hypot(x - 250, y - 175) < 14;
      const sky = region(one, 135, 300, 20, 200, apart); const sky2 = region(two, 135, 300, 20, 200, apart);
      const beside = region(one, 124, 140, 20, 200, apart); const away = region(one, 150, 170, 120, 200, apart);
      const leaves = region(one, 10, 110, 20, 200);
      let centre = 0; let flank = 0; let n = 0;
      for (let t = 0.1; t <= 0.9; t += 0.02, n++) {
        const x = 180 + 120 * t; const y = 30 + 90 * t;
        centre += one[Math.round(y) * W + Math.round(x)];
        let m = 0; for (let k = -4; k <= 4; k++) m = Math.max(m, one[Math.round(y + 0.8 * k) * W + Math.round(x - 0.6 * k)]);
        flank += m;
      }
      let ring = 0; for (let a = 0; a < 6.28; a += 0.2) { let m = 0; for (let r = 4; r <= 8; r++) m = Math.max(m, one[Math.round(175 + r * Math.sin(a)) * W + Math.round(250 + r * Math.cos(a))]); ring += m / 32; }
      let border = 0; let bn = 0;
      for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) { border += one[y * W + x]; bn++; }
      for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) { border += one[y * W + x]; bn++; }
      let diff = 0; for (let i = 0; i < W * H; i++) diff += Math.abs(one[i] - two[i]);
      const r = { sky, sky2, beside, away, leaves, twigCentre: +(centre / n).toFixed(3), twigFlank: +(flank / n).toFixed(3), bird: +one[175 * W + 250].toFixed(3), ring: +ring.toFixed(3), border: +(border / bn).toFixed(4), dprDiff: +(diff / (W * H)).toFixed(4) };
      report.synthetic = r;
      check(sky.lit < 0.02 && sky.std < 0.09 && sky.mean > 0.12 && sky.mean < 0.45, `photo drawing: a flat bright sky is a quiet, smooth haze, not static (mean ${sky.mean}, spread ${sky.std}, dense ${sky.lit})`);
      check(Math.abs(beside.mean - away.mean) < 0.06 && beside.lit < 0.02, `photo drawing: no band of hatching in the sky beside busy leaves (${beside.mean} beside, ${away.mean} away)`);
      check(leaves.mean > 0.2 && leaves.lit > 0.15, `photo drawing: busy highlights are drawn with dense marks (mean ${leaves.mean}, dense ${leaves.lit})`);
      check(r.twigCentre < 0.12 && r.twigCentre < sky.mean - 0.15 && r.twigFlank < 0.75, `photo drawing: a thin dark twig stays a dark line in its sky, not a white one (centre ${r.twigCentre}, flanks ${r.twigFlank}, sky ${sky.mean})`);
      check(r.bird < 0.15 && r.ring > 0.5, `photo drawing: a small dark bird stays slate inside a chalk outline (${r.bird}, ring ${r.ring})`);
      check(r.border < 0.03, `photo drawing: the drawing fades out at its edges (border ${r.border})`);
      check(r.dprDiff < 0.08 && Math.abs(sky.mean - sky2.mean) < 0.04, `photo drawing: the same drawing at 1x and 2x (mean difference ${r.dprDiff}, sky ${sky.mean} / ${sky2.mean})`);
    }

    /* 4c. The low midtones and a dark busy place, on a second synthetic scene: a flat field whose
       tone rises from 0.15 to 0.5 (storm clouds, a dim lit wall) must keep a visible, rising
       rub from its darkest part on (not bare slate), and a dark busy texture (tones 0.02-0.3,
       a shaded slope, a dark crown) must be a faint mottled rub, not a scatter of white specks.
       A white and a black strip pin the levels. */
    {
      const W = 320; const H = 220;
      const hashf = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const tone = (x, y) => {
        if (y >= 200) return x < W / 2 ? 1 : 0;
        if (x < 190) return 0.15 + 0.35 * (y / 200) + (hashf(x, y) - 0.5) * 0.01;
        return 0.02 + 0.28 * hashf((x / 4) | 0, (y / 4) | 0);
      };
      const canvas = doc.createElement('canvas'); canvas.width = W; canvas.height = H;
      const g = canvas.getContext('2d', { willReadFrequently: true }); const image = g.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(tone(x, y) * 255); image.data[i + 3] = 255; }
      g.putImageData(image, 0, 0);
      const out = await lens()._test.drawPhoto({ img: null, canvas, ctx2d: g, width: W, height: H, dpr: 1, cssWidth: W, cssHeight: H, readable: true, kind: 'photo' }, new win.AbortController().signal);
      const d = out.getContext('2d').getImageData(0, 0, W, H).data;
      const region = (x0, x1, y0, y1) => { let sum = 0; let n = 0; let lit = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = d[(y * W + x) * 4 + 3] / 255; sum += v; n++; if (v > 0.5) lit++; } return { mean: +(sum / n).toFixed(3), lit: +(lit / n).toFixed(3) }; };
      const bands = [[20, 50], [60, 90], [100, 130], [140, 170]].map(([a, b]) => region(30, 160, a, b));
      const dark = region(200, 300, 20, 180);
      report.lowMidtones = { bands: bands.map(b => b.mean), dark };
      check(bands[0].mean > 0.045 && bands.every((b, k) => !k || b.mean > bands[k - 1].mean + 0.01) && bands[3].mean - bands[0].mean > 0.06,
        `photo drawing: low midtones (0.2-0.45) keep a visible rub that rises with the tone (${bands.map(b => b.mean).join(', ')})`);
      check(dark.mean > 0.03 && dark.lit < 0.01, `photo drawing: a dark busy place is a faint mottled rub, not white specks (mean ${dark.mean}, dense ${dark.lit})`);
    }

    /* 5. A paper page: the colour matrix, the link colour, figures drawn. */
    await load('/papers/godel-agent.html');
    c = await core();
    {
      const before = snapshot();
      const began = performance.now();
      await c._debug.goto(ID);
      report.enterMs.godel = Math.round(performance.now() - began);
      check(cls().contains('lens-chalk-paper') && !cls().contains('lens-chalk-shell'), 'godel: the paper-page mode');
      // A caption the core sets as a subtitle at the viewport's foot (no room by the trigger,
      // as for this long centred title at some sizes) is written on a feathered patch of wiped
      // slate, so no text shows through it. Checked on a stand-in, wherever the real one went.
      {
        const cap = doc.querySelector('.lenses-caption');
        report.caption = cap ? cap.className : null;
        const probe = doc.createElement('div');
        probe.className = 'lenses-caption is-fixed';
        probe.textContent = 'VII';
        doc.body.append(probe);
        const patch = css(probe, 'background-color'); const mask = css(probe, 'mask-image') || css(probe, '-webkit-mask-image');
        probe.remove();
        check(patch === 'rgba(31, 43, 38, 0.97)' && /gradient/.test(mask), `godel: a caption at the viewport's foot lies on a feathered patch of wiped slate (${patch})`);
      }
      const scope = [doc.querySelector('body > header.site-header'), doc.getElementById('main-content'), doc.querySelector('body > footer.paper-footer')];
      check(scope.every(el => css(el, 'filter') === 'url("#lens-chalk-matrix")'), 'godel: the colour matrix is on the header, main and footer');
      const matrix = doc.querySelector('#lens-chalk-matrix feColorMatrix');
      check(!!matrix && matrix.getAttribute('values').split(' ').length === 20, 'godel: the matrix is defined (4 x 5)');
      const onBoard = lens()._test.onBoard;
      const white = onBoard(1, 1, 1).map(v => Math.round(v * 255)); const black = onBoard(0, 0, 0).map(v => Math.round(v * 255));
      check(white.join() === '31,43,38', `godel: the matrix maps white to the slate (${white})`);
      check(black.every(v => v > 225), `godel: the matrix maps black to white chalk (${black})`);
      const link = doc.querySelector('#main-content .paper-authors a');
      const linkRgb = (css(link, 'color').match(/\d+/g) || []).map(Number);
      const seen = onBoard(...linkRgb.map(v => v / 255)).map(v => Math.round(v * 255));
      check(seen[0] > 215 && seen[1] > 190 && seen[2] < 185 && seen[0] - seen[2] > 50, `godel: a text link comes out of the matrix as yellow chalk (${seen})`);
      await mediaSettled('godel');
      const near = nearImages();
      const drawn = media().overlays.filter(o => near.includes(o.img));
      report.overlays.godel = { near: near.length, drawn: drawn.length };
      check(near.length > 0 && drawn.length === near.length, `godel: its visible figures are drawn (${drawn.length} of ${near.length})`);
      check(drawn.every(o => o.kind === 'graphic'), 'godel: the figures are drawn as graphics');
      const g = drawn.map(o => alphaStats(o.canvas));
      check(g.every(v => v.clear > 0.2), `godel: a figure's own background becomes the slate (clear ${g.map(v => v.clear.toFixed(2)).join(', ')})`);
      const paperLink = doc.querySelector('#main-content .paper-authors a'); const at = centre(paperLink); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === paperLink, 'godel: an author link is clickable');
      // Filled controls are drawn as outlines on the board, not slabs of chalk.
      const filled = [...doc.querySelectorAll('#main-content :is(.resource-link.primary, .godel-form button, button[aria-pressed="true"])')];
      const slabs = filled.filter(el => css(el, 'background-color') !== 'rgba(0, 0, 0, 0)').map(el => el.textContent.trim().slice(0, 24));
      check(filled.length >= 3 && slabs.length === 0, `godel: the primary button, the demo's submit button and the pressed chips are outlines (${filled.length} controls; filled: ${slabs.join(', ')})`);
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(before, 'godel after exit');
    }

    /* 5b. Data cells that are buttons keep their own fills when pressed (SummEval's heat map):
       only the chips and toggles of the control rows (buttons without a class) become outlines. */
    await load('/papers/chatgpt-summarization-evaluation.html');
    c = await core();
    {
      const behind = doc.querySelector('#main-content .se-cell.is-behind');
      check(!!behind, 'summeval: a heat-map cell marked behind');
      if (behind) {
        // The demo draws its cells again on a click: the selected one is found afresh.
        const label = behind.getAttribute('aria-label');
        behind.click(); await delay(300);
        const cell = [...doc.querySelectorAll('#main-content .se-cell')].find(el => el.getAttribute('aria-label') === label) || behind;
        const normal = css(cell, 'background-color');
        const before = snapshot();
        await c._debug.goto(ID);
        const chalked = css(cell, 'background-color');
        report.seCell = { pressed: cell.getAttribute('aria-pressed'), normal, chalked };
        check(cell.getAttribute('aria-pressed') === 'true' && chalked === normal && chalked !== 'rgba(0, 0, 0, 0)',
          `summeval: the selected cell keeps its "behind" fill under chalk (${normal} vs ${chalked})`);
        const chips = [...doc.querySelectorAll('#main-content button[aria-pressed="true"]:not([class])')];
        check(chips.length >= 1 && chips.every(b => css(b, 'background-color') === 'rgba(0, 0, 0, 0)'), `summeval: the pressed chips are outlines (${chips.length})`);
        escape(); await idle(); await nextPaint(); await nextPaint();
        compare(before, 'summeval after exit');
      }
    }

    /* 6. The longest paper page: frame budget while entering, a full scroll without long tasks. */
    await load(LONGEST_PAPER);
    c = await core();
    {
      // A first enter loads and parses the lens's files and the media helper on this page; the
      // second one is measured.
      await c._debug.goto(ID); await c.reset({ instant: true }); await delay(400);
      const before = snapshot();
      const statsBefore = chalkStats();
      const began = performance.now();
      const since = win.performance.now();
      await c._debug.goto(ID);
      report.enterMs.longest = Math.round(performance.now() - began);
      report.frameStats.longestEnter = statsDelta(statsBefore, chalkStats());
      const enterTasks = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
      report.longTasks.longestEnter = enterTasks;
      check(report.frameStats.longestEnter.avgMs < 4, `longest paper: frame callbacks average under 4 ms while entering (${report.frameStats.longestEnter.avgMs} ms over ${report.frameStats.longestEnter.frames} frames)`);
      check(enterTasks.length === 0, `longest paper: no task over 50 ms while entering, files loaded (${enterTasks.join(', ')})`);
      await scrollThrough('longest paper', 50, 50);
      await nextPaint(); await nextPaint();
      check(state().frames === 0 && !state().raf, 'longest paper: no frame callback while the board rests');
      const exitSince = win.performance.now();
      escape();
      report.exitFirstStepMs = +(win.performance.now() - exitSince).toFixed(1);
      await idle(); await nextPaint(); await nextPaint();
      const exitTasks = longTasks.filter(task => task.at >= exitSince && task.ms > 50).map(task => task.ms);
      check(exitTasks.length === 0, `longest paper: no task over 50 ms while erasing (${exitTasks.join(', ')})`);
      // The eraser's sheet, its board and its smears are made in slices: Esc itself is short.
      check(report.exitFirstStepMs < 20, `longest paper: the exit's first step is short (${report.exitFirstStepMs} ms)`);
      compare(before, 'longest paper after exit');
    }

    /* 7. Arrival from sessionStorage on a fresh load: settled at once, quietly, quickly. */
    for (const path of ['/papers/godel-agent.html', '/photography.html']) {
      await load(path);
      const normal = snapshot();
      await load(path, { lens: ID });
      await until(() => win.SiteLenses && win.SiteLenses.current === ID && !win.SiteLenses.busy && !doc.documentElement.hasAttribute('data-lens-arriving'), `${path}: chalk to arrive`);
      const settledAt = win.performance.now();
      const files = win.performance.getEntriesByType('resource').filter(entry => /easter\/lenses\/chalk\.(js|css)/.test(entry.name));
      const ready = Math.max(...files.map(entry => entry.responseEnd));
      report.arrivalMs[path] = Math.round(settledAt - ready);
      check(files.length >= 2 && settledAt - ready < 350 + 30, `${path}: arrives within 350 ms of the lens's files (${report.arrivalMs[path]} ms)`);
      check(!doc.querySelector('.lens-chalk-sheet, .lens-chalk-dust, .lenses-caption'), `${path}: arrives without a sheet, dust or caption`);
      check(cls().contains('lens-chalk-on') && css(doc.documentElement, 'background-color') === SLATE, `${path}: the board is there`);
      if (path === '/photography.html') {
        // Every photo in view has its first rub (or already its drawing) soon after arriving,
        // so no frame stands empty while the drawings are made.
        const inView = () => scopeImages().filter(img => {
          if (!sameOrigin(img) || !img.complete || !img.naturalWidth) return false;
          const r = img.getBoundingClientRect();
          return r.width >= 48 && r.height >= 48 && r.bottom > 0 && r.top < win.innerHeight;
        });
        const covered = img => (media() && media().overlays.some(o => o.img === img)) || (lens()._test.state && lens()._test.state.rubs && lens()._test.state.rubs.shown.has(img));
        await until(() => inView().length > 0 && inView().every(covered), `${path}: every photo in view rubbed or drawn`, 5000);
        report.rubbedMs = Math.round(win.performance.now() - settledAt);
        check(report.rubbedMs < 900, `${path}: every photo in view has a first rub or its drawing soon after arriving (${report.rubbedMs} ms after settling)`);
        await until(() => media() && media().overlays.length > 0, `${path}: a first drawing`);
        const first = media().overlays[0].canvas;
        check(first.getAnimations().some(a => a.playState === 'running' || a.playState === 'finished') || +css(first, 'opacity') < 1,
          `${path}: a drawing lands with a short fade rather than popping in`);
      }
      await mediaSettled(path);
      if (path === '/photography.html') {
        await delay(500);
        check(!doc.querySelector('.lens-chalk-rub'), `${path}: the first rubs are gone once the drawings have landed`);
      }
      const near = nearImages();
      check(media().overlays.filter(o => near.includes(o.img)).length === near.length, `${path}: its visible images are drawn after arriving`);
      escape(); await idle(); await nextPaint(); await nextPaint();
      const now = snapshot();
      check(now.main === normal.main && now.htmlAttrs === normal.htmlAttrs && now.bodyKids === normal.bodyKids && now.headKids === normal.headKids,
        `${path}: Esc after arriving leaves the page as a normal load has it (${firstDiff(normal.htmlAttrs, now.htmlAttrs)}${firstDiff(normal.headKids, now.headKids)})`);
    }

    /* 8. 390 x 844: enter and exit without horizontal overflow. */
    for (const path of ['/', '/photography.html']) {
      await load(path, { width: 390, height: 844 });
      c = await core();
      const before = snapshot();
      await c._debug.goto(ID);
      check(c.current === ID && doc.documentElement.scrollWidth <= 391, `390x844 ${path}: chalk enters without horizontal overflow (${doc.documentElement.scrollWidth})`);
      const link = [...doc.querySelectorAll('#main-content a[href], #site-nav a[href]')].find(a => { const r = a.getBoundingClientRect(); return r.width > 4 && r.top > 0 && r.bottom < win.innerHeight; });
      if (link) { const at = centre(link); const hit = doc.elementFromPoint(at.x, at.y); check(hit && hit.closest('a') === link, `390x844 ${path}: a link is clickable`); }
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(before, `390x844 ${path} after exit`);
    }
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens[0] === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens[0]);
    if (storedLens[1] === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedLens[1]);
  }
  /* 9. No uncaught errors or console.error calls, and no warning about chalk. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  assertions++;
  const ownWarnings = warnings.filter(w => /chalk/.test(w));
  if (ownWarnings.length) failures.push(`Warnings: ${[...new Set(ownWarnings)].slice(0, 6).join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
