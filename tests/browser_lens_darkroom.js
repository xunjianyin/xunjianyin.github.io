/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes one to three minutes: tests/run_easter_suites.sh lens_darkroom starts it as a
 * background promise and polls for it.
 * Tests lens IX (Darkroom) through the lenses core, in a frame at 1440 x 900 unless noted:
 *   home (light): the enter's choreography sampled every frame (the lights go out through the
 *     mixing filter under a multiplying safelight above the caption; then development, where
 *     the page filter's table shows the darkest tones developing first; then the lights come
 *     on), the settled print (classes, the print layer's backdrop filter over the whole page
 *     and no filter on the page itself, the final table, the texture over the print layer,
 *     the images' layer above both and its filter), the text, elements and layout unchanged
 *     (the fixed back-to-top button too), links clickable and focusable, their underline
 *     (a third of the ink, full on focus), the portrait's overlay grey and
 *     opaque over its content box, no frame callback while the print rests, the exit (a view
 *     transition) restoring the page byte for byte, Esc and an instant reset mid-enter; the
 *     caption's halo the paper in every frame (light), none while the lights go out and the
 *     paper from the blank sheet on (dark);
 *   a tab hidden mid-enter: the enter finishes at once (the frame loop pauses while hidden),
 *     the lens stays current and is not marked failed, and the print stays finished when the
 *     tab returns;
 *   an instant reset and a pagehide 0.1 s into a normal exit (light and dark): the exit ends
 *     at once (the view transition skipped), the page restored;
 *   a 16 px image and a broken one loaded before a triggered enter: the veil is lifted when
 *     the sheet is blank (the alt text stays);
 *   the scoped mode for engines that cannot print through a backdrop filter (light and dark):
 *     the filters on the scope's own elements, the root as paper, the underlay following the
 *     mixing weight while the lights go out and in the fade back (no view transitions; in the
 *     dark theme from the blank sheet), exact restoration;
 *   home (dark): the inverted projection, the dark table thinning faint tones only, the
 *     stronger underline, the scope's images inverted back, the theme toggle switching the
 *     filter while the lens is on, the exit (the ink going back into the paper, darkest last,
 *     then the blank sheet crossfading to the page);
 *   publications: an unpressed filter button prints in the same dark ink in both themes;
 *   reduced motion: the settled print at once, no safelight, no frames, an instant exit;
 *   photography: an overlay on every visible same-origin photo (and no other), grey prints,
 *     the print work in tasks of at most 8 ms (at this DPR, and on canvases of the gallery's
 *     DPR 2 and 3 sizes), the page's photos veiled (masked to their border, still
 *     hit-testable), lazy photos still loading only when they come near (no eager download),
 *     the lightbox's photograph veiled, then a silver print developing in above the lightbox
 *     (next, previous, never the last print stretched over the new photograph, the controls
 *     keeping the pointer, gone on close), scrolling the gallery
 *     without long tasks, a small image lifting the veil, exact restoration, and the lens
 *     entered and left with the lightbox open;
 *   godel-agent (a paper page): the paper class and filters, overlays on its figures, a
 *     button-like link keeping its own colours, exact restoration;
 *   the longest paper page: frame callbacks during the enter (budget 4 ms on average), its
 *     data washes and its Jaccard matrix (two categories coded by hue) printing as distinct
 *     tints (the stronger red filter and the lifted toe), near-white panels as bare paper, a
 *     full scroll without long tasks, exact restoration;
 *   arrival from sessionStorage on a fresh load (godel-agent and photography): settled at once
 *     without safelight or caption, within 350 ms of the lens's files, no image showing
 *     unprinted (veiled until its print arrives, each print developing in), Esc restoring the
 *     page as a normal load has it;
 *   390 x 844: enter and exit on home and photography without horizontal overflow.
 * Prints assertions, failures, enter and exit times, arrival times, frame statistics, long
 * tasks, the development samples, the filter buttons' printed ink (L*), the paper page's
 * printed tints (L*) and whether each arriving print developed in.
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
  const ID = 'darkroom';
  const PAPER_R = 244 / 255;
  const LONGEST_PAPER = '/papers/auditing-health-llms.html';
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = [sessionStorage.getItem('lenses-active'), sessionStorage.getItem('lenses-ground')];
  localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  const errors = []; const warnings = [];
  const report = { enterMs: {}, exitMs: {}, arrivalMs: {}, reducedMs: {}, frameStats: {}, longTasks: {}, overlays: {}, development: [] };
  let doc; let win; let longTasks = []; let reduced = false; let queries = []; const pending = new Set();

  // Opens a page in the frame (theme, size and an arriving lens as given) and waits for it to settle.
  const load = async (path, { width = 1440, height = 900, theme = 'light', lens = null, reduce = false } = {}) => {
    localStorage.setItem('theme', theme);
    if (lens) { sessionStorage.setItem('lenses-active', lens); sessionStorage.setItem('lenses-ground', '#f4f0e6'); } else { sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground'); }
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
  const idle = () => until(() => !win.SiteLenses || !win.SiteLenses.busy, 'the lenses to settle', 20000);
  const nextPaint = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  const escape = () => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const cls = () => doc.documentElement.classList;
  const SCOPE = '#site-nav, #main-content, #site-footer, #site-footer > *, body > header.site-header, body > footer.paper-footer';
  const sheet = () => doc.querySelector('.lens-darkroom-sheet');
  const backdropOf = el => win.getComputedStyle(el).backdropFilter;
  const filterOf = el => win.getComputedStyle(el).filter;
  const through = (el, id) => filterOf(el) === `url("#${id}")`;

  // Everything a lens could leave behind (the core's own assets may stay once loaded).
  const ours = el => /easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '');
  const snapshot = () => ({
    main: doc.getElementById('main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlAttrs: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    headKids: [...doc.head.children].filter(el => !ours(el)).map(el => el.outerHTML).join('\n'),
    scroll: Math.round(win.scrollY)
  });
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return `at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const compare = (before, label) => {
    const now = snapshot();
    for (const key of Object.keys(before)) check(now[key] === before[key], `${label}: ${key} is restored (${firstDiff(String(before[key]), String(now[key]))})`);
    check(!doc.querySelector('.lenses-layer, .lenses-caption, .lenses-media'), `${label}: no lens layer, overlay or caption is left`);
    check(!/(^| )lens-/.test(doc.documentElement.className), `${label}: no lens class is left on <html>`);
  };
  const clean = label => check(!state().glyphs && state().layers === 0 && state().frames === 0 && pending.size === 0, `${label}: core state is clean and no frame is pending (${pending.size})`);
  // Positions of a sample of elements: a filter must move nothing.
  const layout = () => [...doc.querySelectorAll('#main-content *, #site-nav *, #site-footer *')].filter((el, i) => i % 3 === 0).slice(0, 600)
    .map(el => { const r = el.getBoundingClientRect(); return `${Math.round(r.left * 2)},${Math.round(r.top * 2)},${Math.round(r.width * 2)},${Math.round(r.height * 2)}`; }).join(';');
  // Links in view whose centres are not covered: the lens never takes the click.
  const clickable = label => {
    const links = [...doc.querySelectorAll('#main-content a[href], #site-nav a[href], body > header.site-header a[href]')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top > 0 && r.bottom < win.innerHeight && r.left > 0 && r.right < win.innerWidth;
    }).slice(0, 5);
    check(links.length > 0, `${label}: a link is in view`);
    for (const link of links) {
      const r = link.getBoundingClientRect();
      const hit = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      check(hit && hit.closest('a') === link, `${label}: the link "${link.textContent.trim().slice(0, 30)}" is clickable (hit ${hit && hit.tagName}.${hit && hit.className})`);
    }
    if (links[0]) { links[0].focus(); check(doc.activeElement === links[0], `${label}: keyboard focus reaches a link`); links[0].blur(); }
  };
  // The page filter's red table, as numbers.
  const table = (id = 'lens-darkroom-page') => {
    const fn = doc.querySelector(`#${id} feFuncR`);
    return fn ? fn.getAttribute('tableValues').split(' ').map(Number) : [];
  };
  // The print of a flat colour (a computed 'rgb(...)') through filter id, modelled as the filter
  // computes it: the colour matrix's first row gives the grey, each channel's table (linear
  // between entries) its printed value. Returns sRGB 0..1, and its CIE L*.
  const rgbOf = colour => (/rgba?\(([^)]+)\)/.exec(colour) || [0, '0 0 0'])[1].split(/[\s,/]+/).slice(0, 3).map(v => Number(v) / 255);
  const printOf = (colour, id) => {
    const [r, g, b] = rgbOf(colour);
    const row = doc.querySelector(`#${id} feColorMatrix`).getAttribute('values').split(' ').map(Number);
    const grey = Math.min(1, Math.max(0, row[0] * r + row[1] * g + row[2] * b + row[3] + row[4]));
    return ['R', 'G', 'B'].map(c => {
      const t = doc.querySelector(`#${id} feFunc${c}`).getAttribute('tableValues').split(' ').map(Number);
      const at = grey * (t.length - 1); const i = Math.min(t.length - 2, Math.floor(at));
      return t[i] + (t[i + 1] - t[i]) * (at - i);
    });
  };
  const lightness = rgb => {
    const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const y = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
  };
  // The caption's halo as drawn (core.css: the stroke under its glyphs), [r, g, b, alpha], or
  // null without a caption.
  const halo = () => {
    const cap = doc.querySelector('.lenses-caption');
    if (!cap) return null;
    const m = /rgba?\(([^)]+)\)/.exec(win.getComputedStyle(cap).webkitTextStrokeColor || '');
    if (!m) return null;
    const v = m[1].split(/[\s,/]+/).map(Number);
    return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
  };
  const paperHalo = h => h && h[0] === 244 && h[1] === 240 && h[2] === 230;
  // An image is veiled: masked to its border while its silver print is (or will be) over it.
  const veiled = img => { const s = win.getComputedStyle(img); const mask = s.maskImage || s.webkitMaskImage; return !!mask && mask !== 'none'; };
  // Every same-origin image in the scope that is visible in the viewport (as the media helper
  // would redraw it) and the overlays over their content boxes.
  const insideFixed = el => { for (let a = el; a && a !== doc.body; a = a.parentElement) if (win.getComputedStyle(a).position === 'fixed') return true; return false; };
  const contentBox = img => {
    const r = img.getBoundingClientRect(); const s = win.getComputedStyle(img); const px = n => parseFloat(s[n]) || 0;
    return { left: r.left + px('borderLeftWidth') + px('paddingLeft'), top: r.top + px('borderTopWidth') + px('paddingTop'),
      right: r.right - px('borderRightWidth') - px('paddingRight'), bottom: r.bottom - px('borderBottomWidth') - px('paddingBottom') };
  };
  const visibleImages = () => [...doc.querySelectorAll('#site-nav img, #main-content img, #site-footer img, body > header.site-header img')].filter(img => {
    if (!img.complete || !(img.naturalWidth || /\.svg/i.test(img.currentSrc || img.src))) return false;
    const box = contentBox(img);
    if (box.right - box.left < 24 || box.bottom - box.top < 24) return false;
    if (box.bottom <= 0 || box.top >= win.innerHeight || box.right <= 0 || box.left >= win.innerWidth) return false;
    const s = win.getComputedStyle(img);
    if (s.display === 'none' || s.visibility === 'hidden' || insideFixed(img)) return false;
    return new URL(img.currentSrc || img.src, win.location.href).origin === win.location.origin;
  });
  const overlayOf = img => {
    const box = contentBox(img);
    return [...doc.querySelectorAll('.lenses-media')].find(canvas => {
      const r = canvas.getBoundingClientRect();
      return Math.abs(r.left - box.left) < 1.5 && Math.abs(r.top - box.top) < 1.5 && Math.abs(r.right - box.right) < 1.5 && Math.abs(r.bottom - box.bottom) < 1.5;
    }) || null;
  };
  // An overlay is a grey, opaque silver print (the media filter tones it).
  const grey = canvas => {
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
    const step = Math.max(4, Math.floor(data.length / 4 / 400)) * 4;
    for (let i = 0; i < data.length; i += step) {
      if (Math.abs(data[i] - data[i + 1]) > 1 || Math.abs(data[i + 1] - data[i + 2]) > 1 || data[i + 3] !== 255) return false;
    }
    return true;
  };
  const overlaysMatch = async (label, limit = 12000) => {
    let images = [];
    try {
      await until(() => { images = visibleImages(); return images.length > 0 && images.every(overlayOf); }, `${label}: overlays on the visible images`, limit);
    } catch (error) { /* reported below */ }
    images = visibleImages();
    const missing = images.filter(img => !overlayOf(img));
    report.overlays[label] = { images: images.length, overlays: doc.querySelectorAll('.lenses-media').length, missing: missing.length };
    check(images.length > 0 && missing.length === 0, `${label}: every visible same-origin image has its silver print (${images.length - missing.length} of ${images.length}; missing ${missing.map(img => (img.currentSrc || img.src).split('/').pop()).join(', ')})`);
    const shown = images.map(overlayOf).filter(Boolean);
    check(shown.every(grey), `${label}: the overlays are grey and opaque (toned by the media filter)`);
    const foreign = [...doc.querySelectorAll('#main-content img')].filter(img => new URL(img.currentSrc || img.src, win.location.href).origin !== win.location.origin && overlayOf(img));
    check(foreign.length === 0, `${label}: no cross-origin image is redrawn`);
  };
  // The settled print: classes, filters, layers, no frames.
  const settledPrint = async (label, { kind = 'shell', dark = false } = {}) => {
    check(cls().contains('lens-darkroom') && cls().contains('lens-darkroom-print') && cls().contains(`lens-darkroom-${kind}`) && !cls().contains('lens-darkroom-mixing'),
      `${label}: the print classes are on (${doc.documentElement.className})`);
    const want = dark ? 'lens-darkroom-page-dark' : 'lens-darkroom-page';
    const layer = sheet();
    const box = layer ? layer.getBoundingClientRect() : null;
    check(layer && backdropOf(layer) === `url("#${want}")` && box.left <= 0 && box.top <= 0 && box.right >= win.innerWidth && box.bottom >= win.innerHeight,
      `${label}: the print layer covers the viewport with the backdrop filter #${want} (${layer && backdropOf(layer)})`);
    check(Number(win.getComputedStyle(layer).zIndex) === 999 && win.getComputedStyle(layer).pointerEvents === 'none', `${label}: the print layer sits over the page (999) and takes no pointer`);
    const scoped = [...doc.querySelectorAll(SCOPE)];
    check(scoped.length >= 3 && scoped.every(el => filterOf(el) === 'none'), `${label}: the page itself carries no filter (${scoped.map(el => filterOf(el)).join(' | ')})`);
    const t = table(want);
    check(t.length === 64 && Math.abs(t[0] - 33 / 255) < 0.003 && Math.abs(t[63] - PAPER_R) < 0.003, `${label}: the table is the finished print (black ${t[0]}, paper ${t[63]})`);
    const texture = doc.querySelector('.lens-darkroom-texture');
    await until(() => texture && /url\(/.test(win.getComputedStyle(texture).backgroundImage), `${label}: the paper texture`, 5000).catch(() => {});
    check(texture && /url\(/.test(win.getComputedStyle(texture).backgroundImage) && win.getComputedStyle(texture).display === 'block', `${label}: the paper texture lies over the page`);
    // The texture is drawn as it is (the same in both themes): over the print layer, under the images.
    check(texture && layer.compareDocumentPosition(texture) === Node.DOCUMENT_POSITION_FOLLOWING && win.getComputedStyle(texture).zIndex === '999' && win.getComputedStyle(texture).pointerEvents === 'none',
      `${label}: the paper texture lies over the print layer (999, after it) and takes no pointer`);
    const safelight = doc.querySelector('.lens-darkroom-safelight');
    check(safelight && win.getComputedStyle(safelight).display === 'none', `${label}: the safelight is off`);
    // The page's own images are veiled under their prints (every image here is same-origin and large).
    const own = visibleImages();
    check(cls().contains('lens-darkroom-veil') && own.every(veiled), `${label}: the veil is on and covers the visible images (${own.filter(veiled).length} of ${own.length})`);
    const media = doc.querySelector('.lenses-media-layer');
    check(!media || (win.getComputedStyle(media).visibility === 'visible' && through(media, 'lens-darkroom-media') && media.compareDocumentPosition(layer) === Node.DOCUMENT_POSITION_PRECEDING && (!texture || media.compareDocumentPosition(texture) === Node.DOCUMENT_POSITION_PRECEDING) && win.getComputedStyle(media).zIndex === '999'),
      `${label}: the images' layer is shown above the print layer and the texture, through #lens-darkroom-media`);
    await nextPaint(); await nextPaint(); await nextPaint();
    check(state().frames === 0 && !state().raf, `${label}: no frame callback runs while the print rests`);
  };

  try {
    /* 1. Home, light: the choreography, the print, restoration. */
    await load('/');
    const base = snapshot();
    const main = doc.getElementById('main-content');
    const textBefore = main.textContent; const tagsBefore = [...main.querySelectorAll('*')].map(el => el.tagName).join(',');
    const layoutBefore = layout();
    const backToTop = doc.getElementById('back-to-top').getBoundingClientRect();
    const lenses = await core();
    const samples = [];
    let sampling = true;
    const sample = () => {
      if (!sampling) return;
      const safelight = doc.querySelector('.lens-darkroom-safelight');
      const mix = doc.querySelector('#lens-darkroom-mix feComposite');
      samples.push({
        t: performance.now(), mixing: cls().contains('lens-darkroom-mixing'), print: cls().contains('lens-darkroom-print'),
        safelight: safelight ? +win.getComputedStyle(safelight).opacity * (win.getComputedStyle(safelight).display === 'none' ? 0 : 1) : 0,
        k2: mix ? +mix.getAttribute('k2') : 0, table: table(), halo: halo()
      });
      win.requestAnimationFrame(sample);
    };
    const began = performance.now();
    const entering = lenses._debug.goto(ID);
    await until(() => cls().contains('lens-darkroom'), 'the lens to begin');
    sample();
    await entering;
    sampling = false;
    report.enterMs.home = Math.round(performance.now() - began);
    check(report.enterMs.home > 2400 && report.enterMs.home < 6000, `The enter takes about 3 s (${report.enterMs.home} ms)`);
    check(lenses.current === ID, 'Darkroom is the current lens');
    check(state().caption && state().caption[0] === 'IX · Darkroom — A print develops darkest tones first.', `The caption reads "IX · Darkroom — A print develops darkest tones first." (${state().caption && state().caption[0]})`);
    const safelightEl = doc.querySelector('.lens-darkroom-safelight');
    check(safelightEl && win.getComputedStyle(safelightEl).mixBlendMode === 'multiply' && Number(win.getComputedStyle(safelightEl).zIndex) > 2147483000,
      'The safelight multiplies over everything, the caption too');
    // Lights out: the mixing filter goes from the page (k2 0) to the blank sheet (k2 1) as the safelight rises.
    const out = samples.filter(s => s.mixing);
    check(out.length >= 5 && out[0].k2 < 0.2 && out[out.length - 1].k2 > 0.8 && out.every((s, i) => i === 0 || s.k2 >= out[i - 1].k2 - 1e-6),
      `Lights out: the page crossfades to a blank sheet (${out.length} frames, k2 ${out.length ? out[0].k2 : '-'} → ${out.length ? out[out.length - 1].k2 : '-'})`);
    check(out.length > 0 && out[out.length - 1].safelight > 0.95, 'Lights out: the safelight is fully up when the sheet is blank');
    // Development: under the safelight, the darkest tones develop first.
    const final = table();
    const fraction = (s, i) => (PAPER_R - s.table[i]) / Math.max(1e-6, PAPER_R - final[i]);
    const dev = samples.filter(s => s.print && s.safelight > 0.95 && s.table.length === 64);
    const BLACK = 0; const MID = 32; const LIGHT = 56;   // greys 0, 0.51, 0.89
    report.development = dev.filter((s, i) => i % 6 === 0).map(s => [BLACK, MID, LIGHT].map(i => +fraction(s, i).toFixed(2)));
    check(dev.length >= 20, `Development is drawn over many frames (${dev.length})`);
    check(dev.some(s => fraction(s, BLACK) > 0.6 && fraction(s, LIGHT) < 0.15), 'Development: black has more than 60 % of its density while a light grey has under 15 %');
    check(dev.some(s => fraction(s, MID) > 0.3 && fraction(s, MID) < 0.8 && fraction(s, LIGHT) < fraction(s, MID) - 0.15), 'Development: mid-greys come before the highlights');
    check(dev.every(s => fraction(s, BLACK) >= fraction(s, MID) - 0.02 && fraction(s, MID) >= fraction(s, LIGHT) - 0.02), 'Development: at every frame a darker tone is at least as developed as a lighter one');
    const lightsOn = samples.filter(s => s.print && s.safelight < 0.95 && s.safelight > 0.05);
    check(lightsOn.length >= 3 && lightsOn.every(s => Math.abs(fraction(s, MID) - 1) < 0.01), `Lights on: the safelight fades over the finished print (${lightsOn.length} frames)`);
    {
      // The caption's halo is the paper (which the safelight multiplies as it does the sheet)
      // in every frame where it shows, never the page's white.
      const shown = samples.filter(s => s.halo && s.halo[3] > 0);
      const others = shown.filter(s => !paperHalo(s.halo)).map(s => s.halo.join(','));
      check(shown.length >= 20 && others.length === 0 && paperHalo(halo()) && halo()[3] === 1,
        `Light theme: the caption's halo is the paper throughout the enter (${shown.length} frames; other colours ${[...new Set(others)].slice(0, 3).join(' | ')})`);
    }
    await settledPrint('home');
    {
      // The veil hides the portrait itself, not its border (which prints as before).
      const portrait = doc.querySelector('#main-content img');
      const s = win.getComputedStyle(portrait);
      check(veiled(portrait) && parseFloat(s.borderTopWidth) > 0 && /^content-box, border-box$/.test(s.maskClip || s.webkitMaskClip) && /exclude/.test(s.maskComposite || ''),
        `The veil masks the portrait to its border (${s.maskClip}, ${s.maskComposite})`);
    }
    check(main.textContent === textBefore && [...main.querySelectorAll('*')].map(el => el.tagName).join(',') === tagsBefore, 'The text and elements of #main-content are unchanged in the print');
    check(layout() === layoutBefore, 'The print moves nothing (element boxes unchanged)');
    const top = doc.getElementById('back-to-top').getBoundingClientRect();
    check(Math.abs(top.left - backToTop.left) < 0.5 && Math.abs(top.top - backToTop.top) < 0.5, 'The fixed back-to-top button stays where it was (its footer is not filtered)');
    const textureStyle = win.getComputedStyle(doc.querySelector('.lens-darkroom-texture'));
    check(/url\("(blob|data):/.test(textureStyle.backgroundImage) && textureStyle.backgroundSize === '256px 256px', `The paper texture is a generated 256 px tile (${textureStyle.backgroundImage.slice(0, 30)}, ${textureStyle.backgroundSize})`);
    clickable('home');
    const inline = doc.querySelector('#main-content .bio a[href]');
    const deco = win.getComputedStyle(inline);
    check(deco.textDecorationLine.includes('underline') && deco.textDecorationThickness === '1px', 'A text link carries a thin underline');
    {
      // The underline is a third of the ink, and the full ink on keyboard focus.
      const alpha = colour => { const m = /\/\s*([\d.]+)\s*\)$/.exec(colour); return m ? +m[1] : 1; };
      const resting = alpha(deco.textDecorationColor);
      inline.focus();
      const focused = alpha(win.getComputedStyle(inline).textDecorationColor);
      inline.blur();
      check(Math.abs(resting - 0.32) < 0.01 && focused === 1, `A text link's underline is 32 % of its ink, full on focus (${resting} → ${focused})`);
    }
    await overlaysMatch('home');
    {
      const t0 = performance.now();
      await lenses.reset(); await idle(); await nextPaint(); await nextPaint();
      report.exitMs.home = Math.round(performance.now() - t0);
      check(report.exitMs.home >= 400 && report.exitMs.home < 1500, `The exit crossfades in about 0.6 s (${report.exitMs.home} ms)`);
      compare(base, 'home after the exit');
      clean('home after the exit');
    }

    /* 1b. Esc mid-development, an instant reset while the lights go out. */
    {
      const entering2 = lenses._debug.goto(ID);
      await until(() => cls().contains('lens-darkroom-print') && doc.querySelector('.lens-darkroom-safelight') && win.getComputedStyle(doc.querySelector('.lens-darkroom-safelight')).display === 'block', 'development to begin', 8000);
      await delay(300);
      escape(); await entering2; await idle(); await nextPaint(); await nextPaint();
      compare(base, 'home: Esc while developing');
      clean('home: Esc while developing');
      const entering3 = lenses._debug.goto(ID);
      await until(() => cls().contains('lens-darkroom-mixing'), 'the lights to go out', 8000);
      await delay(150);
      const t0 = performance.now();
      await lenses.reset({ instant: true });
      check(performance.now() - t0 < 900, `An instant reset while the lights go out finishes within 0.9 s (${Math.round(performance.now() - t0)} ms)`);
      await entering3; await nextPaint();
      compare(base, 'home: instant reset while the lights go out');
    }

    /* 1b'. A tab hidden mid-enter: the frame loop pauses, so the enter finishes at once rather
     * than running into the core's 20 s limit (which would mark the lens failed). */
    {
      const entering4 = lenses._debug.goto(ID);
      await until(() => cls().contains('lens-darkroom-print'), 'development to begin', 8000);
      await delay(200);
      Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'hidden' });
      doc.dispatchEvent(new win.Event('visibilitychange'));
      const t0 = performance.now();
      const settled = await Promise.race([entering4.then(() => true), delay(3000).then(() => false)]);
      report.hiddenEnterMs = Math.round(performance.now() - t0);
      check(settled, `A tab hidden mid-enter: the enter finishes at once (${report.hiddenEnterMs} ms)`);
      check(lenses.current === ID && state().failed.length === 0, `A tab hidden mid-enter: Darkroom is current and not failed (${lenses.current}, failed ${state().failed.join(',')})`);
      const final = table();
      check(cls().contains('lens-darkroom-print') && !cls().contains('lens-darkroom-mixing') && win.getComputedStyle(doc.querySelector('.lens-darkroom-safelight')).display === 'none' && Math.abs(final[0] - 33 / 255) < 0.003,
        'A tab hidden mid-enter: the finished print in white light');
      delete doc.hidden; delete doc.visibilityState;
      doc.dispatchEvent(new win.Event('visibilitychange'));
      await nextPaint(); await nextPaint(); await nextPaint();
      check(table().join(' ') === final.join(' ') && state().frames === 0, `The tab back: the print stays finished and no frame callback is left (${state().frames})`);
      await lenses.reset(); await idle(); await nextPaint(); await nextPaint();
      compare(base, 'home: a tab hidden mid-enter, after the exit');
      clean('home: a tab hidden mid-enter, after the exit');
    }

    /* 1b''. An instant reset (the first egg) and a pagehide during a normal exit cut it short:
     * the view transition is skipped (light theme), the ink's return to the paper is cut short
     * (dark theme), and the page is restored as after any exit. */
    for (const theme of ['light', 'dark']) {
      for (const how of ['instant', 'pagehide']) {
        await load('/', { theme });
        const itBase = snapshot();
        const lensesI = await core();
        await lensesI._debug.goto(ID);
        const exiting = lensesI.reset();
        await delay(how === 'instant' ? 150 : 120);
        const running = !!lensesI._debug.viewTransition;
        const t0 = performance.now();
        if (how === 'instant') await lensesI.reset({ instant: true });
        else win.dispatchEvent(new win.PageTransitionEvent('pagehide', { persisted: false }));
        await exiting; await idle();
        const ms = Math.round(performance.now() - t0);
        report.exitMs[`${how} during the exit (${theme})`] = ms;
        check(ms < 250, `${theme} theme: ${how === 'instant' ? 'an instant reset' : 'a pagehide'} 0.1 s into the exit finishes it at once (${ms} ms; view transition running: ${running})`);
        await nextPaint(); await nextPaint();
        if (how === 'pagehide') { doc.documentElement.removeAttribute('data-lens-arriving'); const pre = doc.getElementById('lenses-prepaint'); if (pre) pre.remove(); }
        compare(itBase, `${theme} theme: ${how} during the exit`);
        clean(`${theme} theme: ${how} during the exit`);
      }
    }

    /* 1b'''. Images the helper leaves alone (a 16 px image, a broken one with alt text) that
     * have loaded before a triggered enter: the veil is lifted as soon as the sheet is blank,
     * so the alt text never vanishes from the print. */
    {
      await load('/');
      const tiny = doc.createElement('img');
      tiny.alt = ''; tiny.width = 16; tiny.height = 16; tiny.src = `/figures/me-320.jpg?tiny=${Math.random().toString(36).slice(2)}`;
      const broken = doc.createElement('img');
      broken.alt = 'A broken image keeps its alt text'; broken.width = 220; broken.height = 60;
      broken.src = `/figures/missing-${Math.random().toString(36).slice(2)}.png`;
      const para = doc.querySelector('#main-content p');
      para.append(tiny, broken);
      await Promise.all([tiny, broken].map(img => new Promise(resolve => { if (img.complete) resolve(); else { img.onload = resolve; img.onerror = resolve; } })));
      await delay(800);                   // the layout watcher's debounce has passed
      const guardBase = snapshot();
      const lensesG = await core();
      const enteringG = lensesG._debug.goto(ID);
      await until(() => cls().contains('lens-darkroom-print'), 'the blank sheet', 8000);
      await nextPaint();
      const during = { veil: cls().contains('lens-darkroom-veil'), tiny: veiled(tiny), broken: veiled(broken) };
      await enteringG;
      check(!during.veil && !during.tiny && !during.broken && !veiled(broken) && !veiled(tiny),
        `Images left alone and loaded before the enter lift the veil when the sheet is blank (during: veil ${during.veil}, tiny ${during.tiny}, broken ${during.broken})`);
      await lensesG.reset(); await idle(); await nextPaint(); await nextPaint();
      compare(guardBase, 'home with a small and a broken image, after the exit');
      clean('home with a small and a broken image, after the exit');
    }

    /* 1c. The scoped mode (engines without SVG filters in backdrop-filter; Chromium is told so by
     * hiding navigator.userAgentData): the filters on the scope's own elements, the root as
     * paper, the same print, exact restoration. Light, then dark. */
    for (const theme of ['light', 'dark']) {
      await load('/', { theme });
      const scopedBase = snapshot();
      Object.defineProperty(win.navigator, 'userAgentData', { value: undefined, configurable: true });
      const lensesS = await core();
      // While the filters mix, the underlay (the paper under the page) follows their weight, and
      // the root keeps the page's own background (only the finished print paints it as paper).
      const mixId = theme === 'dark' ? 'lens-darkroom-mix-dark' : 'lens-darkroom-mix';
      const mixSamples = []; let mixing = true;
      const sampleMix = () => {
        if (!mixing) return;
        const under = doc.querySelector('.lens-darkroom-underlay'); const comp = doc.querySelector(`#${mixId} feComposite`);
        if (cls().contains('lens-darkroom-mixing') && under && comp) {
          mixSamples.push({ shown: win.getComputedStyle(under).display === 'block' && win.getComputedStyle(under).zIndex === '-1', opacity: +win.getComputedStyle(under).opacity, k2: +comp.getAttribute('k2'),
            root: win.getComputedStyle(doc.documentElement).backgroundColor, body: win.getComputedStyle(doc.body).backgroundColor, blank: Math.abs(table(mixId)[0] - PAPER_R) < 0.003 });
        }
        win.requestAnimationFrame(sampleMix);
      };
      const enteringS = lensesS._debug.goto(ID);
      await until(() => cls().contains('lens-darkroom'), 'the scoped lens to begin');
      sampleMix();
      await enteringS;
      mixing = false;
      const themeGround = theme === 'dark' ? 'rgb(31, 31, 31)' : 'rgb(255, 255, 255)';
      check(mixSamples.length >= 5 && mixSamples.every(m => m.shown && Math.abs(m.opacity - m.k2) < 0.02 && m.root !== 'rgb(244, 240, 230)' && m.body === themeGround) && mixSamples[mixSamples.length - 1].opacity > 0.8,
        `Scoped mode (${theme}): while the lights go out the underlay follows the mixing weight over the page's own ground (${mixSamples.length} frames, last ${mixSamples.length ? mixSamples[mixSamples.length - 1].opacity : '-'})`);
      const want = theme === 'dark' ? 'lens-darkroom-page-dark' : 'lens-darkroom-page';
      check(cls().contains('lens-darkroom-scoped') && cls().contains('lens-darkroom-print'), `Scoped mode (${theme}): the scoped class is on`);
      check(backdropOf(sheet()) === 'none', `Scoped mode (${theme}): the print layer has no backdrop filter`);
      const scoped = [...doc.querySelectorAll('#site-nav, #main-content, #site-footer > *')];
      check(scoped.every(el => through(el, want)), `Scoped mode (${theme}): the nav, main and the footer's children go through #${want} (${scoped.map(el => filterOf(el)).join(' | ')})`);
      check(win.getComputedStyle(doc.documentElement).backgroundColor === 'rgb(244, 240, 230)' && win.getComputedStyle(doc.body).backgroundColor === 'rgba(0, 0, 0, 0)', `Scoped mode (${theme}): the root is painted as paper`);
      const btt = doc.getElementById('back-to-top');
      check(btt && win.getComputedStyle(btt).position === 'fixed' && btt.getBoundingClientRect().bottom <= win.innerHeight, `Scoped mode (${theme}): the back-to-top button stays fixed to the viewport`);
      await overlaysMatch(`scoped mode (${theme})`);
      clickable(`scoped mode (${theme})`);
      // The exit without view transitions (the fade back), sampled the same way: in the dark
      // theme it starts from the blank sheet, after the ink has gone back into the paper.
      Object.defineProperty(doc, 'startViewTransition', { value: undefined, configurable: true });
      mixSamples.length = 0; mixing = true; sampleMix();
      const t0 = performance.now();
      await lensesS.reset(); await idle();
      mixing = false;
      report.exitMs[`scoped ${theme}, fade back`] = Math.round(performance.now() - t0);
      check(mixSamples.length >= 5 && mixSamples.every(m => m.shown && Math.abs(m.opacity - m.k2) < 0.02 && m.root !== 'rgb(244, 240, 230)' && m.body === themeGround && m.blank === (theme === 'dark')) && mixSamples[mixSamples.length - 1].opacity < 0.2,
        `Scoped mode (${theme}): the fade back lowers the underlay with the filters over the page's own ground${theme === 'dark' ? ', from the blank sheet' : ''} (${mixSamples.length} frames)`);
      delete doc.startViewTransition;
      await nextPaint(); await nextPaint();
      compare(scopedBase, `scoped mode (${theme}) after the exit`);
      clean(`scoped mode (${theme}) after the exit`);
    }

    /* 2. Home, dark theme: the inverted projection; the theme toggle while the lens is on. */
    await load('/', { theme: 'dark' });
    {
      const darkBase = snapshot();
      const lenses2 = await core();
      // The caption's halo: none while the dark page is still going to the blank sheet (paper
      // there would be a bright label on the darkening room), the paper from the blank sheet on.
      const halos = []; let sampling3 = true;
      const sample3 = () => { if (!sampling3) return; halos.push({ mixing: cls().contains('lens-darkroom-mixing'), print: cls().contains('lens-darkroom-print'), halo: halo() }); win.requestAnimationFrame(sample3); };
      const enteringDark = lenses2._debug.goto(ID);
      await until(() => cls().contains('lens-darkroom'), 'the dark lens to begin');
      sample3();
      await enteringDark;
      sampling3 = false;
      {
        const mixing = halos.filter(s => s.mixing && s.halo);
        const after = halos.filter(s => !s.mixing && s.print && s.halo);
        check(mixing.length >= 5 && mixing.every(s => s.halo[3] === 0), `Dark theme: no caption halo while the lights go out (${mixing.length} frames; ${[...new Set(mixing.map(s => s.halo.join(',')))].slice(0, 3).join(' | ')})`);
        check(after.length >= 20 && after.every(s => paperHalo(s.halo) || s.halo[3] === 0) && paperHalo(halo()) && halo()[3] === 1,
          `Dark theme: the caption's halo is the paper from the blank sheet on (${after.length} frames; ${[...new Set(after.filter(s => !paperHalo(s.halo)).map(s => s.halo.join(',')))].slice(0, 3).join(' | ')})`);
      }
      await settledPrint('home (dark)', { dark: true });
      const img = doc.querySelector('#main-content img');
      check(img && win.getComputedStyle(img).filter === 'invert(1)', 'Dark theme: the scope\'s images are inverted back before the inverted projection');
      // The inversion takes the portrait's border (#374151 in the dark theme) along: it is given
      // as its inverse, so it prints as faintly as the light theme's.
      check(img && win.getComputedStyle(img).borderTopColor === 'rgb(200, 190, 174)', `Dark theme: an inverted image's border is given as its inverse (${img && win.getComputedStyle(img).borderTopColor})`);
      const matrix = doc.querySelector('#lens-darkroom-page-dark feColorMatrix').getAttribute('values').split(' ').map(Number);
      check(matrix[0] < 0 && matrix[4] > 1, 'Dark theme: the projection is inverted and levelled (the dark ground prints as paper)');
      // The dark table thins faint tones (the heavier edges of light-on-dark type) and keeps the
      // body text's density and everything darker: entries 0-15 (density 0.76 and up) as the
      // light table's, a light grey (entry 40, density 0.37) paler.
      const light = table('lens-darkroom-page'); const darkTable = table('lens-darkroom-page-dark');
      check(light.slice(0, 16).every((v, i) => Math.abs(v - darkTable[i]) < 1e-4) && darkTable[40] > light[40] + 0.02 && Math.abs(darkTable[63] - light[63]) < 1e-4,
        `Dark theme: the table thins faint tones only (entry 40: ${darkTable[40]} against ${light[40]})`);
      const link = doc.querySelector('#main-content .bio a[href]');
      check(/\/\s*0\.45\s*\)$/.test(win.getComputedStyle(link).textDecorationColor), `Dark theme: the underline is mixed stronger (${win.getComputedStyle(link).textDecorationColor})`);
      await overlaysMatch('home (dark)');
      clickable('home (dark)');
      const mainEl = doc.getElementById('main-content');
      doc.getElementById('theme-toggle').click();
      await nextPaint();
      check(doc.documentElement.dataset.theme === 'light' && backdropOf(sheet()) === 'url("#lens-darkroom-page")', `The theme toggle switches the print to the light projection (${backdropOf(sheet())})`);
      check(!img || win.getComputedStyle(img).filter === 'none', 'Light theme: the scope\'s images are not inverted');
      doc.getElementById('theme-toggle').click();
      await nextPaint();
      check(doc.documentElement.dataset.theme === 'dark' && backdropOf(sheet()) === 'url("#lens-darkroom-page-dark")', `The theme toggle switches back (${backdropOf(sheet())})`);
      void mainEl;
      // The exit: the ink goes back into the paper (darkest last), then the blank sheet
      // crossfades to the page, so no frame mixes dark ink with the light type.
      const finalDark = table('lens-darkroom-page-dark');
      const back = []; let sampling2 = true; let atCrossfade = null;
      const sample2 = () => { if (!sampling2) return; if (!cls().contains('lens-darkroom-vt-out')) back.push(table('lens-darkroom-page-dark')); win.requestAnimationFrame(sample2); };
      const watch = new win.MutationObserver(() => {
        if (atCrossfade === null && cls().contains('lens-darkroom-vt-out')) atCrossfade = { blank: cls().contains('lens-darkroom-vt-blank'), table: table('lens-darkroom-page-dark') };
      });
      watch.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
      const t0 = performance.now();
      sample2();
      escape(); await idle(); await nextPaint(); await nextPaint();
      sampling2 = false; watch.disconnect();
      await nextPaint();
      report.exitMs['home (dark)'] = Math.round(performance.now() - t0);
      check(report.exitMs['home (dark)'] >= 450 && report.exitMs['home (dark)'] < 1600, `Dark theme: the exit takes about 0.6 s (${report.exitMs['home (dark)']} ms)`);
      check(atCrossfade && atCrossfade.blank && Math.abs(atCrossfade.table[0] - PAPER_R) < 0.003 && Math.abs(atCrossfade.table[40] - PAPER_R) < 0.003,
        `Dark theme: the crossfade starts from the blank sheet (${atCrossfade ? atCrossfade.table[0] : '-'})`);
      const fractionDark = (t, i) => (PAPER_R - t[i]) / Math.max(1e-6, PAPER_R - finalDark[i]);
      const midway = back.filter(t => t.length === 64 && fractionDark(t, 0) < 0.999 && fractionDark(t, 0) > 0.001);
      check(midway.length >= 3 && midway.some(t => fractionDark(t, 0) > fractionDark(t, 40) + 0.2),
        `Dark theme: the ink goes back into the paper over several frames, the darkest last (${midway.length} frames)`);
      compare(darkBase, 'home (dark) after Esc');
      clean('home (dark) after Esc');
    }

    /* 2b. Publications: the filter buttons use the site's link colour, a light blue in the dark
     * theme; they print in the same dark ink as the light theme's. */
    await load('/publications.html');
    {
      const pubBase = snapshot();
      const lensesP = await core();
      await lensesP._debug.goto(ID);
      const chip = doc.querySelector('#main-content button.filter-option:not([aria-pressed="true"])');
      const ink = { light: lightness(printOf(win.getComputedStyle(chip).color, 'lens-darkroom-page')) };
      doc.getElementById('theme-toggle').click();
      await delay(400);                 // the buttons' own colour transition (0.2 s)
      const text = win.getComputedStyle(doc.body).color;
      ink.dark = lightness(printOf(win.getComputedStyle(chip).color, 'lens-darkroom-page-dark'));
      report.chipInk = { light: +ink.light.toFixed(1), dark: +ink.dark.toFixed(1) };
      check(win.getComputedStyle(chip).color === text, `Dark theme: an unpressed filter button takes the text's colour (${win.getComputedStyle(chip).color}, text ${text})`);
      check(ink.light < 25 && ink.dark < 25 && Math.abs(ink.dark - ink.light) < 6, `Publications: a filter button prints in the same dark ink in both themes (L* ${ink.light.toFixed(1)} light, ${ink.dark.toFixed(1)} dark)`);
      doc.getElementById('theme-toggle').click();
      await nextPaint();
      await lensesP.reset(); await idle(); await nextPaint(); await nextPaint();
      compare(pubBase, 'publications after the exit');
      clean('publications after the exit');
    }

    /* 3. Reduced motion: the print at once, no safelight, no frames; an instant exit. */
    await load('/', { reduce: true });
    {
      const reducedBase = snapshot();
      const lenses3 = await core();
      await lenses3._debug.goto(ID);   // a first visit may load assets; the second is measured
      await lenses3.reset();
      const t0 = performance.now();
      await lenses3._debug.goto(ID);
      report.reducedMs.enter = Math.round(performance.now() - t0);
      check(report.reducedMs.enter < 400, `Reduced motion: the print appears at once (${report.reducedMs.enter} ms)`);
      await settledPrint('reduced motion');
      check(pending.size === 0, 'Reduced motion: no animation frame is pending');
      const t1 = performance.now();
      await lenses3.reset();
      report.reducedMs.exit = Math.round(performance.now() - t1);
      check(report.reducedMs.exit < 300, `Reduced motion: the exit is instant (${report.reducedMs.exit} ms)`);
      await nextPaint();
      compare(reducedBase, 'reduced motion after the exit');
      reduced = false;
    }

    /* 4. Photography: silver prints of the gallery, the lightbox, a scroll, restoration. */
    await load('/photography.html');
    {
      // The gallery is seen once before the lens: at a DPR of 2 the page's own first rendering
      // of its large photos takes 70-290 ms tasks with or without a lens (all of it rendering,
      // no script), which the scroll below must not count against the lens.
      for (let y = 0; y < doc.documentElement.scrollHeight; y += win.innerHeight * 0.6) { win.scrollTo({ top: y, behavior: 'instant' }); await delay(120); }
      win.scrollTo({ top: 0, behavior: 'instant' }); await delay(400);
      const photoBase = snapshot();
      const lenses4 = await core();
      await lenses4._debug.goto(ID);
      await settledPrint('photography');
      await overlaysMatch('photography');
      // The silver prints are made in tasks of at most 8 ms (the contract), here at this
      // frame's DPR, and on canvases the size the gallery's photographs have at a DPR of 2 and
      // 3 (the helper's 1.6 MP cap), whatever the DPR here: the print reads its own levels in
      // the same pass (no resampled copy on the main thread).
      {
        const test = lenses4._debug.lens(ID)._test;
        report.printTasks = { dpr: win.devicePixelRatio, enter: { tasks: test.perf.slices, maxMs: +test.perf.maxMs.toFixed(2), stripsInLongest: test.perf.maxStrips } };
        check(test.perf.slices > 0 && test.perf.maxMs < 8, `Photography (DPR ${win.devicePixelRatio}): the silver prints run in tasks of at most 8 ms (${test.perf.slices} tasks, longest ${test.perf.maxMs.toFixed(1)} ms)`);
        for (const [w, h] of [[880, 1564], [1095, 1461], [1460, 1095]]) {
          const canvas = doc.createElement('canvas'); canvas.width = w; canvas.height = h;
          const g = canvas.getContext('2d', { willReadFrequently: true });
          const gradient = g.createLinearGradient(0, 0, w, h);
          gradient.addColorStop(0, '#0b1c3a'); gradient.addColorStop(0.5, '#c8743a'); gradient.addColorStop(1, '#f2f6ee');
          g.fillStyle = gradient; g.fillRect(0, 0, w, h);
          test.resetPerf();
          const out = await test.print({ img: null, canvas, ctx2d: g, width: w, height: h, dpr: 2, cssWidth: w / 2, cssHeight: h / 2, readable: true, kind: 'photo' });
          report.printTasks[`${w}x${h}`] = { tasks: test.perf.slices, maxMs: +test.perf.maxMs.toFixed(2), stripsInLongest: test.perf.maxStrips };
          check(out === canvas && grey(canvas) && test.perf.maxMs < 8, `A ${w} x ${h} photograph prints in tasks of at most 8 ms, grey and opaque (${test.perf.slices} tasks, longest ${test.perf.maxMs.toFixed(1)} ms)`);
        }
      }
      // A lazy photo far below the viewport still waits until it comes near.
      {
        const spacer = doc.createElement('div'); spacer.style.height = '6000px';
        const lazy = doc.createElement('img');
        lazy.alt = ''; lazy.loading = 'lazy'; lazy.width = 320; lazy.height = 320;
        lazy.src = `/figures/me-320.jpg?lazy=${Math.random().toString(36).slice(2)}`;
        doc.getElementById('main-content').append(spacer, lazy);
        await delay(900);
        check(!lazy.complete || lazy.naturalWidth === 0, 'Photography: a lazy image 6000 px below the viewport has not loaded (nothing loads eagerly under the print)');
        spacer.remove(); lazy.remove();
        await delay(300);
      }
      clickable('photography');
      // A veiled photo still takes the click (the mask hides it, it does not remove it).
      {
        const veiledPhoto = visibleImages().find(veiled);
        const r = veiledPhoto ? veiledPhoto.getBoundingClientRect() : null;
        const hit = r ? doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        check(veiledPhoto && hit === veiledPhoto, `Photography: a veiled photo is hit-tested as itself (${hit && hit.tagName})`);
      }
      // The lightbox (outside the scope, above the print layer) shows its photograph as a silver
      // print in the helper's fixed layer, veiled until then, developing in; it follows the
      // lightbox to the next and the previous photograph and goes when it closes; the arrows
      // and the close glyph keep the pointer.
      {
        const lightbox = doc.getElementById('lightbox'); const boxImg = doc.getElementById('lightbox-img');
        const boxPrint = () => [...doc.querySelectorAll('.lenses-media-fixed canvas.lenses-media')].find(canvas => {
          const r = canvas.getBoundingClientRect(); const q = contentBox(boxImg);
          return Math.abs(r.left - q.left) < 1.5 && Math.abs(r.top - q.top) < 1.5 && Math.abs(r.right - q.right) < 1.5 && Math.abs(r.bottom - q.bottom) < 1.5;
        });
        const fades = [];
        const watchBox = new win.MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.matches('canvas.lenses-media') && node.closest('.lenses-media-fixed')) fades.push(node.getAnimations().length);
        })));
        watchBox.observe(doc.body, { childList: true, subtree: true });
        const opened = performance.now();
        doc.querySelector('#main-content .photo-item').click();
        await nextPaint();
        check(lightbox.classList.contains('active') && veiled(boxImg) && filterOf(boxImg) === 'none', `Lightbox: the photograph is veiled (its dark ground shows) until its print is made (veiled ${veiled(boxImg)}, filter ${filterOf(boxImg)})`);
        await until(() => boxPrint(), 'the lightbox print', 8000).catch(() => {});
        report.lightboxMs = Math.round(performance.now() - opened);
        const first = boxPrint();
        const fixedLayer = first && first.closest('.lenses-media-fixed');
        check(first && grey(first) && through(fixedLayer, 'lens-darkroom-media') && win.getComputedStyle(fixedLayer).visibility === 'visible' && Number(win.getComputedStyle(fixedLayer).zIndex) > 1000,
          `Lightbox: a grey silver print lies over the photograph, above the lightbox, through #lens-darkroom-media (${report.lightboxMs} ms; z ${fixedLayer && win.getComputedStyle(fixedLayer).zIndex})`);
        for (const id of ['lightbox-next', 'lightbox-prev', 'close-lightbox']) {
          const r = doc.getElementById(id).getBoundingClientRect();
          const hit = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          check(hit && hit.id === id, `Lightbox: #${id} keeps the pointer over the print (hit ${hit && (hit.id || hit.tagName)})`);
        }
        for (const id of ['lightbox-next', 'lightbox-prev']) {
          const was = boxImg.src; const old = boxPrint();
          // Every frame until the new print is there: no print is seen stretched (the last
          // photograph's print over the new photograph's box).
          const stretched = []; let watching = true;
          const watchFrames = () => {
            if (!watching) return;
            for (const canvas of doc.querySelectorAll('.lenses-media-fixed canvas.lenses-media')) {
              const r = canvas.getBoundingClientRect();
              if (+win.getComputedStyle(canvas).opacity > 0.01 && r.height > 0 && Math.abs(canvas.width / canvas.height - r.width / r.height) > 0.05) stretched.push(`${canvas.width}x${canvas.height} as ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
            win.requestAnimationFrame(watchFrames);
          };
          doc.getElementById(id).click();
          watchFrames();
          await nextPaint();
          const hidden = !!old && (!old.isConnected || +win.getComputedStyle(old).opacity <= 0.01);
          await until(() => boxImg.src !== was && boxPrint() && boxPrint() !== old, `the print after #${id}`, 8000).catch(() => {});
          await delay(350);
          watching = false;
          check(boxImg.src !== was && boxPrint() && grey(boxPrint()) && veiled(boxImg), `Lightbox: #${id} shows the next photograph's silver print (${boxImg.src.split('/').pop()})`);
          check(hidden && stretched.length === 0, `Lightbox: after #${id} the last photograph's print is hidden at once, never seen stretched over the new one (hidden ${hidden}; ${stretched.slice(0, 2).join(', ')})`);
        }
        watchBox.disconnect();
        report.lightboxFades = fades.slice();
        check(fades.length >= 3 && fades.slice(0, 3).every(n => n > 0), `Lightbox: each photograph's print develops in as it arrives (${fades.join(',')})`);
        doc.getElementById('close-lightbox').click();
        await delay(300);
        check(!lightbox.classList.contains('active') && !doc.querySelector('.lenses-media-fixed canvas.lenses-media'), 'Lightbox: its print goes when it closes');
      }
      // A reader scrolls the gallery: new prints are made with no long task.
      const since = win.performance.now();
      const height = doc.documentElement.scrollHeight;
      for (let y = 0; y < height; y += win.innerHeight * 0.6) { win.scrollTo({ top: y, behavior: 'instant' }); await delay(160); }
      await delay(800);
      const tasks = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
      report.longTasks.photography = tasks;
      check(tasks.length === 0, `Photography: no task over 50 ms while scrolling (${tasks.join(', ')} ms)`);
      await overlaysMatch('photography (scrolled)');
      await nextPaint(); await nextPaint();
      check(state().frames === 0, 'Photography: no frame callback after the scroll');
      win.scrollTo({ top: 0, behavior: 'instant' }); await delay(200);
      // An image the media helper leaves alone (here smaller than 24 px) must not stay veiled:
      // it lifts the veil for the page.
      {
        const tiny = doc.createElement('img');
        tiny.alt = ''; tiny.width = 16; tiny.height = 16;
        tiny.src = `/figures/me-320.jpg?tiny=${Math.random().toString(36).slice(2)}`;
        doc.querySelector('#main-content h1, #main-content h2, #main-content p').append(tiny);
        let lifted = false;
        try { await until(() => !cls().contains('lens-darkroom-veil'), 'the veil to lift', 4000); lifted = true; } catch (error) { /* reported below */ }
        check(lifted && !veiled(tiny) && cls().contains('lens-darkroom-print'), 'Photography: a 16 px image lifts the veil (the print stays)');
        tiny.remove();
        await delay(300);
      }
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(photoBase, 'photography after Esc');
      clean('photography after Esc');
      // The lens entered and left with the lightbox open: its photograph is printed, and the
      // exit leaves the open lightbox as it was.
      doc.querySelectorAll('#main-content .photo-item')[2].click();
      await delay(300);
      const openBase = snapshot();
      const boxImg = doc.getElementById('lightbox-img');
      await lenses4._debug.goto(ID);
      let printed = false;
      try {
        await until(() => [...doc.querySelectorAll('.lenses-media-fixed canvas.lenses-media')].some(canvas => Math.abs(canvas.getBoundingClientRect().width - contentBox(boxImg).right + contentBox(boxImg).left) < 1.5), 'the open lightbox print', 8000);
        printed = true;
      } catch (error) { /* reported below */ }
      check(printed && veiled(boxImg), 'Photography: a lightbox open when the lens enters shows its photograph\'s silver print');
      await lenses4.reset(); await idle(); await nextPaint(); await nextPaint();
      compare(openBase, 'photography: the exit with the lightbox open');
      clean('photography: the exit with the lightbox open');
      check(doc.getElementById('lightbox').classList.contains('active') && filterOf(boxImg) === 'none' && !veiled(boxImg), 'Photography: the lightbox stays open, its photograph as the page has it');
      doc.getElementById('close-lightbox').click();
      await delay(200);
    }

    /* 5. A paper page: its own classes, figures, a button-like link, restoration. */
    await load('/papers/godel-agent.html');
    {
      const paperBase = snapshot();
      const primary = doc.querySelector('.resource-link.primary');
      const primaryColour = primary ? win.getComputedStyle(primary).color : null;
      const lenses5 = await core();
      await lenses5._debug.goto(ID);
      await settledPrint('godel-agent', { kind: 'paper' });
      check(!primary || win.getComputedStyle(primary).color === primaryColour, 'A button-like link keeps its own colours (its text stays light on its dark fill)');
      clickable('godel-agent');
      const figure = doc.querySelector('#main-content .godel-strip img');
      if (figure) { figure.scrollIntoView({ block: 'center' }); await delay(400); }
      await overlaysMatch('godel-agent (figures)');
      win.scrollTo({ top: 0, behavior: 'instant' }); await delay(200);
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(paperBase, 'godel-agent after Esc');
      clean('godel-agent after Esc');
    }

    /* 6. The longest paper page: frame callbacks during the enter, a full scroll, restoration. */
    await load(LONGEST_PAPER);
    {
      const longBase = snapshot();
      const lenses6 = await core();
      const before = JSON.parse(JSON.stringify(state().frameStats[ID] || { frames: 0, avgMs: 0, maxMs: 0 }));
      const since = win.performance.now();
      await lenses6._debug.goto(ID);
      const after = state().frameStats[ID];
      const frames = after.frames - before.frames;
      const avg = frames > 0 ? +((after.avgMs * after.frames - before.avgMs * before.frames) / frames).toFixed(3) : 0;
      report.frameStats.longest = { frames, avgMs: avg, maxMs: after.maxMs };
      report.longTasks.longestEnter = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
      check(frames > 60 && avg < 4, `Longest paper: frame callbacks average ${avg} ms over ${frames} frames of the enter (budget 4 ms)`);
      await settledPrint('longest paper', { kind: 'paper' });
      // Its data cells: a green wash (first-named mode higher) and a rust wash (lower) print as
      // two distinct tints, both clearly darker than the paper (the lifted toe of paper pages).
      {
        const pos = doc.querySelector('.au-cell[data-state="pos"]'); const neg = doc.querySelector('.au-cell[data-state="neg"]');
        if (pos && neg) {
          const L = el => lightness(printOf(win.getComputedStyle(el).backgroundColor, 'lens-darkroom-page'));
          const tints = { paper: lightness(printOf('rgb(255, 255, 255)', 'lens-darkroom-page')), lower: L(neg), higher: L(pos) };
          report.tints = Object.fromEntries(Object.entries(tints).map(([k, v]) => [k, +v.toFixed(1)]));
          check(tints.paper - tints.lower >= 3.5 && tints.lower - tints.higher >= 5,
            `Longest paper: the data washes print as distinct tints (L* paper ${tints.paper.toFixed(1)}, lower ${tints.lower.toFixed(1)}, higher ${tints.higher.toFixed(1)})`);
        } else check(false, 'Longest paper: the data cells are there');
        // The Jaccard matrix codes its two categories by hue alone (green within a mode, rust
        // across modes; the overlap by strength): equal overlaps print at least 5 L* apart, on
        // the cells shown and on the demo's own colour rule for overlaps 0.33 and 0.60 (rgb at
        // shade / 2 over the demo's white), and so do the legend's keys. Near-white panels
        // stay bare paper, and a mean bar stays apart from its track.
        const over = (rgba, bg = [255, 255, 255]) => { const a = rgba.length > 3 ? rgba[3] : 1; return [0, 1, 2].map(k => bg[k] * (1 - a) + rgba[k] * a); };
        const rgba = colour => (/rgba?\(([^)]+)\)/.exec(colour) || [0, '0 0 0'])[1].split(/[\s,/]+/).map(Number);
        const P = c => lightness(printOf(`rgb(${over(c).join(', ')})`, 'lens-darkroom-page'));
        const cells = {};
        for (const td of doc.querySelectorAll('.au-pair')) {
          const shade = td.style.getPropertyValue('--au-shade');
          (cells[shade] = cells[shade] || {})[td.classList.contains('is-within') ? 'within' : 'cross'] = +P(rgba(win.getComputedStyle(td).backgroundColor)).toFixed(1);
        }
        const pairs = Object.entries(cells).filter(([, v]) => v.within !== undefined && v.cross !== undefined);
        const rule = Object.fromEntries([0.143, 0.333, 0.6].map(s => [s, +(P([143, 79, 49, s / 2]) - P([43, 97, 81, s / 2])).toFixed(1)]));
        const keys = ['within', 'cross'].map(k => P(rgba(win.getComputedStyle(doc.querySelector(`.au-key-${k}`), '::before').backgroundColor)));
        const bar = doc.querySelector('.au-bar'); const fill = bar && bar.querySelector('i');
        report.jaccard = { cells, rule, keys: keys.map(v => +v.toFixed(1)), bar: bar ? [P(rgba(win.getComputedStyle(bar).backgroundColor)), P(rgba(win.getComputedStyle(fill).backgroundColor))].map(v => +v.toFixed(1)) : null };
        check(pairs.length > 0 && pairs.every(([, v]) => v.cross - v.within >= 5), `Longest paper: Jaccard cells of equal overlap print at least 5 L* apart (${pairs.map(([s, v]) => `${s}: ${v.within} / ${v.cross}`).join('; ')})`);
        check(rule[0.333] >= 5 && rule[0.6] >= 5 && rule[0.143] >= 2.5, `Longest paper: the demo's colour rule prints within and across 5 L* apart at overlaps 0.33 and 0.60 (${rule[0.143]}, ${rule[0.333]}, ${rule[0.6]} L* at 0.14, 0.33, 0.60)`);
        check(keys[1] - keys[0] >= 5, `Longest paper: the legend's two keys print apart (${keys.map(v => v.toFixed(1)).join(' / ')} L*)`);
        check(Math.abs(P([255, 255, 255]) - P([251, 252, 250])) < 0.05 && Math.abs(printOf('rgb(251, 252, 250)', 'lens-darkroom-page')[0] - PAPER_R) < 0.003, 'Longest paper: white and the paper page\'s near-white ground print as bare paper');
        check(report.jaccard.bar && report.jaccard.bar[0] - report.jaccard.bar[1] > 40, `Longest paper: a mean bar prints apart from its track (${report.jaccard.bar && report.jaccard.bar.join(' / ')} L*)`);
      }
      const scrollFrom = win.performance.now();
      const height = doc.documentElement.scrollHeight;
      for (let y = 0; y < height; y += win.innerHeight * 0.7) { win.scrollTo({ top: y, behavior: 'instant' }); await delay(120); }
      await delay(800);
      const tasks = longTasks.filter(task => task.at >= scrollFrom && task.ms > 50).map(task => task.ms);
      report.longTasks.longestScroll = tasks;
      check(tasks.length === 0, `Longest paper: no task over 50 ms while scrolling (${tasks.join(', ')} ms)`);
      check(state().frames === 0, 'Longest paper: no frame callback after the scroll');
      win.scrollTo({ top: 0, behavior: 'instant' }); await delay(200);
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(longBase, 'longest paper after Esc');
      clean('longest paper after Esc');
    }

    /* 7. Arrival from sessionStorage on a fresh load: the print at once, no safelight, no caption. */
    // Opens a page with the lens remembered and notes, in the new document's own clock, when
    // the core lifts the arrival mark (a MutationObserver set up as soon as the document exists).
    const arriveOn = async page => {
      sessionStorage.setItem('lenses-active', ID); sessionStorage.setItem('lenses-ground', '#f4f0e6');
      const old = frame.contentDocument;
      const channel = new MessageChannel();
      const yieldNow = () => new Promise(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
      frame.src = `${page}?r=${Math.random().toString(36).slice(2)}`;
      let lifted = null; let marked = null; const fades = [];
      for (const began = performance.now(); performance.now() - began < 10000; await yieldNow()) {
        const d = frame.contentDocument;
        if (d && d !== old && d.documentElement && frame.contentWindow.location.href !== 'about:blank') {
          const w = frame.contentWindow;
          // The head snippet may not have run yet: the mark may come after this point.
          const note = () => {
            const value = d.documentElement.getAttribute('data-lens-arriving');
            if (value !== null) marked = value; else if (marked !== null && lifted === null) lifted = w.performance.now();
          };
          note();
          new w.MutationObserver(note).observe(d.documentElement, { attributes: true, attributeFilter: ['data-lens-arriving'] });
          // Each silver print, when it is laid over its image: does it develop in (an animation)?
          new w.MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            (node.matches('canvas.lenses-media') ? [node] : [...node.querySelectorAll('canvas.lenses-media')]).forEach(canvas => fades.push(canvas.getAnimations().length));
          }))).observe(d.documentElement, { childList: true, subtree: true });
          break;
        }
      }
      await until(() => frame.contentDocument.readyState === 'complete' && frame.contentWindow.SiteLensesBoot, `${page}: the page`);
      doc = frame.contentDocument; win = frame.contentWindow;
      win.addEventListener('error', event => errors.push(`${page}: ${event.message}`));
      win.addEventListener('unhandledrejection', event => errors.push(`${page}: ${event.reason}`));
      pending.clear();
      await until(() => win.SiteLenses && win.SiteLenses.current === ID && !win.SiteLenses.busy && lifted !== null, `${page}: the arrival`);
      return { marked, lifted, fades };
    };
    for (const page of ['/papers/godel-agent.html', '/photography.html']) {
      await load(page);
      const normal = snapshot();
      const { marked, lifted, fades } = await arriveOn(page);
      check(marked === ID, `${page}: the page is marked as arriving with the lens before it is painted (${marked})`);
      // No image shows the page filter's print of it: each is veiled until its silver print lies over it.
      const bare = visibleImages().filter(img => !overlayOf(img) && !veiled(img));
      check(bare.length === 0, `${page}: on arrival, every visible image is veiled or printed (${bare.length} bare)`);
      // The lens's own time: from its files' arrival to the end of the arrival mark.
      const files = win.performance.getEntriesByType('resource').filter(entry => /easter\/lenses\/darkroom\.(js|css)/.test(entry.name));
      const ready = Math.max(...files.map(entry => entry.responseEnd));
      report.arrivalMs[page] = Math.round(lifted - ready);
      check(files.length === 2 && lifted - ready < 350, `${page}: the print arrives within 350 ms of the lens's files (${Math.round(lifted - ready)} ms)`);
      check(!doc.querySelector('.lenses-caption'), `${page}: no caption on arrival`);
      const safelight = doc.querySelector('.lens-darkroom-safelight');
      check(safelight && win.getComputedStyle(safelight).display === 'none', `${page}: no safelight on arrival`);
      await settledPrint(`${page} (arrival)`, { kind: page.includes('papers/') ? 'paper' : 'shell' });
      await overlaysMatch(`${page} (arrival)`);
      report.arrivalFades = report.arrivalFades || {};
      report.arrivalFades[page] = fades.slice();
      // (A print remade later for a new size is shown at once: only the first prints are checked.)
      const first = fades.slice(0, Math.min(fades.length, visibleImages().length));
      check(first.length > 0 && first.every(n => n > 0), `${page}: each silver print develops in as it arrives (${fades.join(',')})`);
      escape(); await idle(); await nextPaint(); await nextPaint();
      check(sessionStorage.getItem('lenses-active') === null, `${page}: Esc forgets the lens`);
      const now = snapshot();
      for (const key of ['main', 'nav', 'footer', 'htmlAttrs', 'bodyAttrs', 'bodyKids']) check(now[key] === normal[key], `${page}: after the arrival and Esc, ${key} is as a normal load has it (${firstDiff(normal[key], now[key])})`);
      check(!doc.querySelector('.lenses-layer, .lenses-media'), `${page}: no lens layer is left after the arrival and Esc`);
    }

    /* 8. A phone, 390 x 844: home and photography. */
    for (const page of ['/', '/photography.html']) {
      await load(page, { width: 390, height: 844 });
      const phoneBase = snapshot();
      const lenses8 = await core();
      await lenses8._debug.goto(ID);
      check(doc.documentElement.scrollWidth <= 391, `390x844 ${page}: no horizontal overflow (${doc.documentElement.scrollWidth})`);
      await settledPrint(`390x844 ${page}`);
      await overlaysMatch(`390x844 ${page}`);
      clickable(`390x844 ${page}`);
      await lenses8.reset(); await idle(); await nextPaint(); await nextPaint();
      compare(phoneBase, `390x844 ${page} after the exit`);
      clean(`390x844 ${page} after the exit`);
    }
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens[0] === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens[0]);
    if (storedLens[1] === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedLens[1]);
  }
  /* 9. No uncaught errors or console.error calls; no warning about this lens. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  assertions++;
  const ownWarnings = warnings.filter(w => /darkroom|media/.test(w));
  if (ownWarnings.length) failures.push(`Warnings: ${[...new Set(ownWarnings)].slice(0, 8).join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
