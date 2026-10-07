/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes a few minutes: tests/run_easter_suites.sh lens_stardust starts it as a
 * background promise (one eval stores the result on window when the promise resolves) and
 * polls for it.
 * Tests Stardust (easter/lenses/stardust.js), the lens that redraws every glyph and every
 * readable image as particles: on the homepage, the photography page, a paper page and the
 * longest paper page it enters, settles, keeps links clickable, turns every loaded
 * same-origin image on screen into particles that sit in the image's box (the image itself
 * hidden by opacity, a cross-origin badge never; a figure on a white ground shown inverted
 * under its particles, with the column on a light page and by its own filter on a dark one),
 * and leaves the page byte for byte as it was; a reader arriving with the lens stored in sessionStorage sees it settle within 350 ms;
 * the photography masonry that reflows after the lens has measured it (photos that were not
 * loaded, simulated by a stylesheet in <head> that collapses them, then a real lazy photo
 * with a fresh URL) is measured again, so every caption's particles end up on the caption's
 * real text box; photos that load just after an arrival (their src held back as the page is
 * parsed) move the masonry, and no caption is drawn away from its text for more than a
 * moment, nor waits for the arrival's rest to be drawn on it; an exit in the middle of the
 * enter restores the page, and so does an instant reset in the middle of the exit (at once,
 * no transition left running); an exit right after an arrival starts at once; content
 * rendered while the lens measures (the blog list after its fetch) is drawn; the content of
 * a closed <details> is not drawn until it opens; a night photo gets a finer grid (its lit
 * windows survive) and thin dark structure (bare branches, a gull) carves a photo's stars;
 * the lightbox photo is drawn as stars on a canvas over it that follows it to the next photo
 * and goes when it closes (the photo under it hidden under the backdrop, the previous photo's
 * stars hidden in the task that changes it, no frame of the night drawn while the lightbox
 * covers the page, no long task); on a phone and a tablet both arrows and the close control
 * take the pointer over the photo and a tap on next shows the next photo; leaving with the
 * lightbox open fades its stars out, and entering with it open draws its photo;
 * on a light page every photo's counter-filter eases with the column as the lens leaves (no
 * negative), and the images still shown are nearly transparent while the ground passes
 * mid-grey (no grey slab), entering and leaving; entering, every photo goes out once (into
 * its stars) and does not come back, and leaving, its night patch or the returning photo
 * always covers its middle (no tonal negative); a text-heavy figure gets a step fine enough
 * for its labels, its grounds other than white are sparse fills at their own hues (Figure 1
 * of the longest paper: grey boxes filled, panels faint, white empty), a thumbnail's border
 * is drawn as dust, text that CSS generates keeps its glyphs, and a list's numbers are drawn
 * as dust before their items; arriving on the gallery at 1440 and 390, no frame shows a photo
 * before its stars; reduced motion enters and leaves at once and runs no frame while resting; the
 * dark site theme (the column never shows as a box while the ground changes, and no
 * transition the lens started outlives its exit); a 390 x 844
 * phone (a paper's figure labels get a fine step; a figure in a scrolling .figure-scroll is
 * clipped to it); and the budgets: no long task
 * caused by the lens while scrolling the photography page and the longest paper page
 * (attributed with the Long Animation Frames API, observed on this top-level page, where a
 * frame's long animation frames are reported: scripts of easter/lenses/ over 50 ms; and no
 * frame callback of the lens over 50 ms),
 * building slices within 8 ms (at most 5% over, while arriving and while scrolling), frame
 * callbacks under 4 ms on average, and
 * at most the 15 Hz shimmer when nothing moves. Prints assertions, failures, image counts,
 * arrival times, budgets and every long task.
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
  // A fast yield (setTimeout is clamped to 4 ms), to catch a new document right away.
  const channel = new MessageChannel();
  const yieldNow = () => new Promise(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
  const median = list => {
    const s = [...list].sort((a, b) => a - b); const m = s.length >> 1;
    return !s.length ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const ID = 'stardust';
  const GROUND = '#06080c';
  const LONGEST_PAPER = '/papers/auditing-health-llms.html';
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = [sessionStorage.getItem('lenses-active'), sessionStorage.getItem('lenses-ground')];
  localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  const errors = []; const warnings = [];
  const report = { images: {}, arrivalMs: {}, layout: {}, budgets: {}, longTasks: {}, idle: {}, reduced: {}, lightbox: {}, markers: {}, tints: {} };
  let doc; let win; let longTasks = []; let reduced = false; let queries = [];
  // The long tasks the lens caused: scripts of easter/lenses/ (the lens, the media helper, the
  // core's frame loop) that ran over 50 ms, attributed by the Long Animation Frames API. A
  // same-origin frame's long animation frames are reported to the top-level page, not to the
  // frame, so they are observed here, once, on this window's clock (performance.now() here).
  // Other agents' browsers share this machine, so a long task of the page or the browser alone
  // does not count against the lens (the frame's raw long tasks are reported as well).
  let lensTasks = null;
  try {
    const found = [];
    new PerformanceObserver(list => list.getEntries().forEach(entry => {
      for (const script of entry.scripts || []) {
        if (script.duration > 50 && /easter\/lenses\//.test(script.sourceURL || '')) found.push({ at: entry.startTime, ms: Math.round(script.duration), what: `${script.invoker} ${(script.sourceURL || '').split('/').pop()}:${script.sourceCharPosition}` });
      }
    })).observe({ type: 'long-animation-frame' });
    lensTasks = found;
  } catch (error) { lensTasks = null; }
  const lensTasksSince = at => (lensTasks ? lensTasks.filter(task => task.at >= at).map(task => `${task.ms} ms ${task.what}`) : null);

  // Error, warning, long-task and reduced-motion hooks for the page now in the frame. Reduced
  // motion is simulated through matchMedia (the core reads it when it loads, so only for a
  // page whose core loads after the hook: entered through _debug.goto, not arriving).
  const hook = path => {
    doc = frame.contentDocument; win = frame.contentWindow;
    if (win.__stardustSuiteHooked) return;
    win.__stardustSuiteHooked = true;
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
    const match = win.matchMedia.bind(win); queries = [];
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') { Object.defineProperty(result, 'matches', { get: () => reduced }); queries.push(result); }
      return result;
    };
  };
  const setReduced = value => { reduced = value; queries.forEach(query => query.dispatchEvent(new win.Event('change'))); };

  // Opens a page in the frame. lens: arrive with it (stored as the core stores it). early(d):
  // runs on the new document as soon as its <head> exists, before any lens can measure it.
  const load = async (path, { lens = null, width = 1280, height = 900, theme = 'light', early = null } = {}) => {
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:200000;border:0;background:white`;
    localStorage.setItem('theme', theme);
    if (lens) { sessionStorage.setItem('lenses-active', lens); sessionStorage.setItem('lenses-ground', GROUND); } else { sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground'); }
    const old = frame.contentDocument;
    frame.src = `${path}${path.includes('?') ? '&' : '?'}r=${Math.random().toString(36).slice(2)}`;
    const began = performance.now();
    while (performance.now() - began < 10000) {
      const d = frame.contentDocument;
      if (d && d !== old && d.documentElement && frame.contentWindow.location.href !== 'about:blank') {
        if (early) { while (!d.head) await yieldNow(); early(d, frame.contentWindow); }
        break;
      }
      await yieldNow();
    }
    await until(() => frame.contentDocument && frame.contentDocument.readyState === 'complete', `${path} to load`);
    hook(path);
    await until(() => win.SiteLensesBoot && doc.getElementById('main-content'), `${path}: the page and the boot`);
    if (!lens) await settled(path);
  };
  // The page's own late content (markdown, star counts) settles first.
  const settled = async path => {
    let last = ''; let since = performance.now();
    await until(() => {
      const main = doc.getElementById('main-content');
      const now = main ? main.innerHTML : '';
      if (now !== last) { last = now; since = performance.now(); }
      return now && performance.now() - since > 500;
    }, `${path}: the page to settle`, 10000);
  };
  const lenses = () => win.SiteLenses;
  const lens = () => lenses()._debug.lens(ID);
  const stats = () => lens()._stats;
  const idle = () => until(() => !lenses() || !lenses().busy, 'the lenses to settle', 20000);
  const arrived = () => until(() => lenses() && lenses().current === ID && !lenses().busy &&
    !doc.documentElement.hasAttribute('data-lens-arriving') && !doc.documentElement.hasAttribute('data-lens-revealing'), `${ID} to arrive`, 15000);
  const enter = async () => { await (await win.SiteLensesBoot.loadCore())._debug.goto(ID); await idle(); };
  const escape = () => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const leave = async () => { escape(); await idle(); await delay(60); };
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  // A tap at an element's centre, on whatever is hit there (as a finger would): returns that.
  const tapAt = el => {
    const at = centre(el); const hit = doc.elementFromPoint(at.x, at.y);
    if (!hit) return null;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: at.x, clientY: at.y, pointerId: 7, pointerType: 'touch', isPrimary: true, view: win };
    hit.dispatchEvent(new win.PointerEvent('pointerdown', opts)); hit.dispatchEvent(new win.PointerEvent('pointerup', opts));
    hit.dispatchEvent(new win.MouseEvent('click', opts));
    return hit;
  };
  const nextFrame = () => new Promise(resolve => win.requestAnimationFrame(resolve));
  // The lightbox's star canvases (the media helper's fixed overlays) that can be seen.
  const fixedCanvases = () => [...doc.querySelectorAll('.lenses-media-fixed canvas.lenses-media')].filter(c => c.isConnected && c.getBoundingClientRect().width > 0);
  const seenCanvas = () => fixedCanvases().find(c => win.getComputedStyle(c).visibility !== 'hidden' && win.getComputedStyle(c).opacity === '1') || null;
  const scrollTo = async y => { win.scrollTo({ top: y, behavior: 'instant' }); await delay(30); };

  // What a lens could leave behind (the core's own assets may stay once loaded).
  const ours = el => /easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '');
  const snapshot = () => ({
    main: doc.getElementById('main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlAttrs: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    headKids: [...doc.head.children].filter(el => !ours(el)).map(el => el.outerHTML).join('\n'),
    opacities: scopeImages().map(img => win.getComputedStyle(img).opacity).join(','),
    // The computed look the lens's classes change (no transition may be left running).
    look: (() => {
      const main = doc.getElementById('main-content'); const cs = win.getComputedStyle(main);
      return [win.getComputedStyle(doc.documentElement).backgroundColor, win.getComputedStyle(doc.body).backgroundColor, cs.filter, cs.backgroundColor,
        ...scopeImages().map(img => win.getComputedStyle(img).filter)].join('|');
    })(),
    scroll: `${win.scrollX},${win.scrollY}`
  });
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return `at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const compare = (before, label) => {
    const now = snapshot();
    for (const key of Object.keys(before)) check(now[key] === before[key], `${label}: ${key} is restored exactly (${firstDiff(before[key], now[key])})`);
    check(!doc.querySelector('.lenses-layer, .lenses-caption, link[href*="lenses/stardust.css"]'), `${label}: no lens layer, caption or stylesheet is left`);
    check(!doc.documentElement.className.includes('lens-stardust'), `${label}: no lens-stardust class is left`);
  };
  // A link in view whose centre is not covered by anything: the lens must not take the click.
  // (required false: a view of figures may hold no link.)
  const clickable = (label, required = true) => {
    const links = [...doc.querySelectorAll('#main-content a[href], #site-nav a[href], body > header.site-header a[href]')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top > 0 && r.bottom < win.innerHeight && r.left > 0 && r.right < win.innerWidth;
    }).slice(0, 4);
    if (required) check(links.length > 0, `${label}: a link is in view`);
    for (const link of links) {
      const at = centre(link); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === link, `${label}: the link "${link.textContent.trim().slice(0, 30)}" is clickable (hit ${hit && hit.tagName})`);
    }
  };

  // Images: what the lens should turn into particles (as its header says).
  const scopeImages = () => [...doc.querySelectorAll('#site-nav img, #main-content img, #site-footer img, body > header.site-header img, body > footer.paper-footer img')];
  const sameOrigin = img => { try { return new URL(img.currentSrc || img.src, win.location.href).origin === win.location.origin; } catch (error) { return false; } };
  const insideFixed = img => { for (let el = img; el && el !== doc.body; el = el.parentElement) if (win.getComputedStyle(el).position === 'fixed') return true; return false; };
  const contentBox = img => {
    const r = img.getBoundingClientRect(); const cs = win.getComputedStyle(img); const px = name => parseFloat(cs[name]) || 0;
    const left = r.left + px('borderLeftWidth') + px('paddingLeft'); const top = r.top + px('borderTopWidth') + px('paddingTop');
    const right = r.right - px('borderRightWidth') - px('paddingRight'); const bottom = r.bottom - px('borderBottomWidth') - px('paddingBottom');
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const eligible = img => {
    if (!img.complete || !(img.naturalWidth > 0) || !sameOrigin(img) || !img.getClientRects().length || insideFixed(img)) return false;
    if (win.getComputedStyle(img).visibility !== 'visible') return false;
    const box = contentBox(img);
    return box.width >= 24 && box.height >= 24;
  };
  const onScreen = img => { const r = img.getBoundingClientRect(); return r.bottom > 1 && r.top < win.innerHeight - 1 && r.right > 1 && r.left < win.innerWidth - 1; };
  const nameOf = img => (img.getAttribute('src') || '').split('/').pop();
  const imageInfo = () => new Map(lens()._images.map(item => [item.img, item]));
  // Waits until every eligible image on screen has become particles (or failed).
  const imagesSettle = async label => {
    await until(() => {
      const info = imageInfo();
      return !stats().building && scopeImages().filter(img => eligible(img) && onScreen(img))
        .every(img => { const i = info.get(img); return i && (i.built || i.failed) && !i.queued; });
    }, `${label}: the images on screen to become particles`, 20000);
    await delay(450);                  // a late image crossfades in 0.25 s
  };
  const checkImages = label => {
    const info = imageInfo();
    const want = scopeImages().filter(img => eligible(img) && onScreen(img));
    for (const img of want) {
      const i = info.get(img);
      check(i && i.built && i.particles > 0, `${label}: ${nameOf(img)} on screen became particles (${JSON.stringify(i && { built: i.built, n: i.particles, failed: i.failed, kind: i.kind })})`);
      if (!i || !i.built) continue;
      check(win.getComputedStyle(img).opacity === '0', `${label}: ${nameOf(img)} is hidden under its particles (opacity ${win.getComputedStyle(img).opacity})`);
      const box = contentBox(img);
      const inside = lens()._particlesIn({ left: box.left - 4, top: box.top - 4, right: box.right + 4, bottom: box.bottom + 4 });
      check(inside.n >= i.particles * 0.97, `${label}: ${nameOf(img)}'s ${i.particles} particles sit in its box (${inside.n} there)`);
      // A photo: at least 1.6 px between samples, about 14 k particles at most; a graphic
      // (labels, thin lines): at least 1.25 px, about 56 k at most for its ink (a fill's inside
      // sparse), and about 11 k more for its tinted grounds.
      const rule = i.kind === 'graphic' ? { step: 1.25, most: 78000 } : { step: 1.6, most: 16500 };
      check(i.step >= rule.step - 1e-6 && i.particles <= rule.most, `${label}: ${nameOf(img)} keeps the density rule (${i.kind}, step ${i.step}, ${i.particles} particles)`);
      // A graphic on a light ground is shown inverted, as its particles draw it, while it
      // dissolves: with the column on a light page (no filter of its own), by its own filter
      // on a dark one. The lens's rule must win over the sheet's media rules to do so.
      if (i.base) {
        const filter = win.getComputedStyle(img).filter;
        const inverted = doc.documentElement.classList.contains('lens-stardust-invert');
        check(i.kind === 'graphic' && (inverted ? filter === 'none' : filter.includes('invert')), `${label}: ${nameOf(img)} is shown inverted under its particles (${i.kind}, filter ${filter})`);
      }
    }
    // No more than that: every image with particles on screen is one of them.
    const extra = lens()._images.filter(i => i.built && onScreen(i.img) && !want.includes(i.img)).map(i => nameOf(i.img));
    check(extra.length === 0, `${label}: only eligible images become particles (${extra.join(', ')})`);
    // A cross-origin image (a badge), an image in a fixed ancestor or a tiny one keeps itself.
    for (const img of scopeImages().filter(img => !sameOrigin(img) || insideFixed(img))) {
      check(win.getComputedStyle(img).opacity !== '0', `${label}: ${nameOf(img)} (cross-origin or in a fixed ancestor) is not hidden`);
    }
    const kinds = {};
    for (const i of lens()._images) if (i.built) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
    report.images[label] = { onScreen: want.length, built: lens()._images.filter(i => i.built).length, model: lens()._images.length, kinds };
  };
  // The words the lens holds for an element sit on its real text (within px).
  const wordsOnText = (el, px = 2) => {
    const words = lens()._wordsIn(el);
    const range = doc.createRange(); range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    if (!words.length || !rects.length) return { ok: false, words: words.length, rects: rects.length };
    const near = w => rects.some(r => Math.abs(r.top - w.top) <= px && w.left >= r.left - px && w.left + w.width <= r.right + px);
    const bad = words.filter(w => !near(w));
    return { ok: bad.length === 0, words: words.length, bad: bad.slice(0, 2).map(w => `${w.text}@${Math.round(w.left)},${Math.round(w.top)}`), real: rects.slice(0, 2).map(r => `${Math.round(r.left)},${Math.round(r.top)}`) };
  };
  const frameStats = () => (lenses()._debug.state.frameStats[ID] || { frames: 0, avgMs: 0, maxMs: 0 });
  // A photo's thin dark structure against a lighter ground: on 6 px blocks of the image as
  // displayed, the star density where the block's darkest pixel lies 0.12 or more below its
  // neighbourhood's mean (5 x 5 blocks), over the density in plain blocks of a ground as
  // light (darkest within 0.05 of it); both only where the neighbourhood is light (>= 0.3).
  const thinRatio = img => {
    const pts = lens()._pointsOf(img);
    if (!pts) return null;
    const W = Math.round(pts.w); const H = Math.round(pts.h); const B = 6;
    const c = doc.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const bw = Math.floor(W / B); const bh = Math.floor(H / B);
    const mean = new Float32Array(bw * bh); const min = new Float32Array(bw * bh).fill(1); const count = new Float32Array(bw * bh);
    for (let y = 0; y < bh * B; y++) for (let x = 0; x < bw * B; x++) {
      const k = (y * W + x) * 4; const l = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255;
      const b = Math.floor(y / B) * bw + Math.floor(x / B); mean[b] += l / (B * B); if (l < min[b]) min[b] = l;
    }
    const around = new Float32Array(bw * bh);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      let sum = 0; let n = 0;
      for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) { const a = i + u; const b = j + v; if (a >= 0 && b >= 0 && a < bw && b < bh) { sum += mean[b * bw + a]; n++; } }
      around[j * bw + i] = sum / n;
    }
    for (let p = 0; p < pts.points.length; p += 2) { const i = Math.floor(pts.points[p] / B); const j = Math.floor(pts.points[p + 1] / B); if (i >= 0 && j >= 0 && i < bw && j < bh) count[j * bw + i]++; }
    let sS = 0; let nS = 0; let sP = 0; let nP = 0;
    for (let b = 0; b < bw * bh; b++) {
      if (around[b] < 0.3) continue;
      if (around[b] - min[b] > 0.12) { sS += count[b]; nS++; } else if (around[b] - min[b] < 0.05 && Math.abs(mean[b] - around[b]) < 0.03) { sP += count[b]; nP++; }
    }
    return { structure: nS, plain: nP, ratio: nS > 50 && nP > 50 && sP > 0 ? +((sS / nS) / (sP / nP)).toFixed(3) : null };
  };

  try {
    /* 1. Enter, settle, images, links, exit and exact restoration on four page kinds. */
    const PAGES = [
      ['home', '/', null],
      ['photography', '/photography.html', null],
      ['paper', '/papers/godel-agent.html', '#main-content img'],
      ['longest paper', LONGEST_PAPER, '#main-content img']
    ];
    for (const [name, path, target] of PAGES) {
      await load(path);
      if (target) { doc.querySelector(target).scrollIntoView({ block: 'start' }); await delay(400); }
      await settled(path);
      const before = snapshot();
      await enter();
      check(lenses().current === ID && stats().phase === 'live', `${name}: Stardust enters and settles (${stats().phase})`);
      check(doc.documentElement.classList.contains('lens-stardust') && doc.documentElement.classList.contains('lenses-hide-glyphs'), `${name}: the night and the hidden glyphs are on`);
      check(stats().particles > 1000 && stats().missing === 0, `${name}: particles on screen (${stats().particles}, ${stats().missing} bands missing)`);
      await imagesSettle(name);
      checkImages(name);
      if (name === 'paper') check(lens()._images.some(i => i.built && i.kind === 'graphic' && i.base === 'filter:none!important;'), `paper: the white figures follow the inverted column (${JSON.stringify(lens()._images.filter(i => i.built).map(i => i.base))})`);
      if (name === 'photography') {
        // A night photo of thin lit windows gets a finer grid within the same budget, so its
        // windows survive (they were averaged away at the area's step: about 1100 particles).
        const tower = doc.querySelector('#photo-grid img[src*="Two-Dimensional"]');
        tower.scrollIntoView({ block: 'center' }); await delay(300);
        await imagesSettle('photography tower');
        const info = imageInfo().get(tower);
        const box = contentBox(tower); const areaStep = Math.sqrt((box.width * box.height) / 14000);
        report.images.tower = info && { step: info.step, particles: info.particles, areaStep: +areaStep.toFixed(2) };
        check(info && info.built && info.step < areaStep * 0.6 && info.particles >= 5000, `photography: the night photo gets a finer grid and keeps its lit windows (${JSON.stringify(report.images.tower)})`);
        // The lightbox (outside the scope, in a fixed container): its photo is drawn as stars on
        // a canvas the media helper lays over it, which follows it to the next photo and goes
        // when it closes; the photo under it is dimmed, the close glyph keeps the pointer.
        const shown = doc.getElementById('lightbox-img');
        const overlay = () => [...doc.querySelectorAll('.lenses-media-fixed canvas.lenses-media')].find(c => c.isConnected && c.getBoundingClientRect().width > 0) || null;
        const covers = canvas => { const a = canvas.getBoundingClientRect(); const b = contentBox(shown); return Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)); };
        const starry = canvas => {
          const g = canvas.getContext('2d'); const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
          let bright = 0; let dark = 0; let n = 0;
          for (let i = 0; i < d.length; i += 4 * 97) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > 90) bright++; else if (l < 20) dark++; n++; }
          return { bright: bright / n, dark: dark / n };
        };
        const rendersBefore = stats().renders; const lightboxSince = performance.now();
        tower.click();
        await until(() => { const c = overlay(); return c && win.getComputedStyle(c).opacity === '1'; }, 'the lightbox stars', 10000);
        const first = overlay(); const firstStars = starry(first);
        check(doc.getElementById('lightbox').classList.contains('active') && covers(first) < 1.5, `photography: the lightbox photo is drawn as stars over it (off by ${covers(first).toFixed(1)} px)`);
        check(firstStars.bright > 0.02 && firstStars.dark > 0.2, `photography: the lightbox canvas holds stars on the night (${JSON.stringify(firstStars)})`);
        check(win.getComputedStyle(shown).opacity === '0' && win.getComputedStyle(shown).filter === 'none', `photography: the lightbox photo stays under the dark backdrop, never shown as a colour photo (opacity ${win.getComputedStyle(shown).opacity}, filter ${win.getComputedStyle(shown).filter})`);
        // The night under the lightbox is not drawn while the lightbox covers the page.
        check(stats().covered && stats().renders === rendersBefore, `photography: no frame of the night is drawn under the open lightbox (${stats().renders - rendersBefore} renders, covered ${stats().covered})`);
        for (const id of ['close-lightbox', 'lightbox-prev', 'lightbox-next']) {
          const at = centre(doc.getElementById(id)); const hit = doc.elementFromPoint(at.x, at.y);
          check(hit && hit.id === id, `photography: the lightbox's ${id} keeps the pointer (${hit && (hit.id || hit.tagName)})`);
        }
        // Next, as a tap at the arrow's centre: the old photo's stars are hidden in the same task.
        const firstSrc = shown.currentSrc;
        const tapped = tapAt(doc.getElementById('lightbox-next'));
        await Promise.resolve();         // (the lens's observer runs as a microtask of that task)
        const stale = fixedCanvases().filter(c => c === first && win.getComputedStyle(c).visibility !== 'hidden').length;
        check(tapped && tapped.id === 'lightbox-next' && stale === 0, `photography: tapping next hides the previous photo's stars at once (tapped ${tapped && (tapped.id || tapped.tagName)}, ${stale} still seen)`);
        await until(() => { const c = overlay(); return c && c !== first && shown.currentSrc !== firstSrc && win.getComputedStyle(c).opacity === '1'; }, 'the next photo as stars', 10000);
        check(covers(overlay()) < 1.5 && stats().fixedOverlays === 1, `photography: the stars follow the lightbox to the next photo (off by ${covers(overlay()).toFixed(1)} px, ${stats().fixedOverlays} overlays)`);
        check(stats().renders === rendersBefore, `photography: still no frame of the night under the lightbox after next (${stats().renders - rendersBefore} renders)`);
        report.images.lightbox = { renders: stats().lightboxRenders, stars: firstStars };
        doc.getElementById('close-lightbox').click();
        await Promise.resolve();
        check(!seenCanvas(), 'photography: closing the lightbox hides its stars in the same task');
        await until(() => !overlay(), 'the lightbox stars to go', 5000).catch(() => {});
        check(!overlay() && stats().fixedOverlays === 0, `photography: closing the lightbox removes its stars (${stats().fixedOverlays} overlays)`);
        await until(() => stats().renders > rendersBefore, 'a frame after the lightbox closed', 3000).catch(() => {});
        check(!stats().covered && stats().renders > rendersBefore, `photography: the night is drawn again once the lightbox closes (${stats().renders - rendersBefore} renders)`);
        const lightboxLong = lensTasksSince(lightboxSince);
        report.lightbox.longTasks = lightboxLong;
        check(lightboxLong !== null && lightboxLong.length === 0, `photography: no task over 50 ms caused by the lens while the lightbox opens, changes photo and closes (${(lightboxLong || ['not observable']).join(' / ') || '-'})`);
        // Thin dark structure carves the stars: bare branches against the sky (Leaves are
        // Birds), a gull (Ceaseless Motion). Where a 6 px block's darkest pixel lies well below
        // its neighbourhood, there are clearly fewer stars than in plain sky as bright.
        for (const [file, most] of [['Leaves are Birds', 0.82], ['Ceaseless Motion', 0.82]]) {
          const img = doc.querySelector(`#photo-grid img[src*="${file}"]`);
          img.scrollIntoView({ block: 'center' }); await delay(300);
          await imagesSettle(`photography ${file}`);
          const ratio = thinRatio(img);
          report.images[`thin ${file}`] = ratio;
          check(ratio && ratio.ratio !== null && ratio.ratio <= most, `photography: ${file}'s thin dark structure carves its stars (star density there ${ratio && ratio.ratio} of plain sky; at most ${most})`);
        }
        win.scrollTo({ top: 0, behavior: 'instant' }); await delay(300);
      }
      if (name === 'paper') {
        // The content of a closed <details> (laid out, not painted) has no words; opened, its
        // words sit on its text; closed again, they are gone.
        const closed = [...doc.querySelectorAll('#main-content details:not([open])')];
        const hidden = d => [...d.children].filter(k => k.tagName !== 'SUMMARY').reduce((n, k) => n + lens()._wordsIn(k).length, 0);
        check(closed.length > 0, 'paper: the page has closed <details>');
        const d0 = closed[0];
        d0.scrollIntoView({ block: 'center' }); await delay(300);
        await until(() => !stats().building, 'the build near the details', 15000); await delay(300);
        const near = closed.filter(d => { const r = d.getBoundingClientRect(); return r.bottom > -win.innerHeight && r.top < 2 * win.innerHeight; });
        check(near.length > 0 && near.every(d => hidden(d) === 0), `paper: closed <details> content is not drawn (${near.map(hidden).join(', ')} words)`);
        check(near.every(d => lens()._wordsIn(d.querySelector('summary')).length > 0), 'paper: the summaries of closed <details> are drawn');
        d0.open = true;
        await until(() => hidden(d0) > 0, 'the opened details to be measured', 5000).catch(() => {});
        await until(() => !stats().building, 'the re-measure', 15000); await delay(200);
        const inner = d0.querySelector('.abstract-content p, .citation-content, pre, p');
        const opened = inner ? wordsOnText(inner, 2.5) : { ok: false };
        check(opened.ok, `paper: an opened <details> is drawn on its text (${JSON.stringify(opened)})`);
        d0.open = false;
        await until(() => hidden(d0) === 0, 'the closed details to be dropped', 5000).catch(() => {});
        check(hidden(d0) === 0, `paper: closed again, its content is not drawn (${hidden(d0)} words)`);
        doc.querySelector(target).scrollIntoView({ block: 'start' }); await delay(300);
      }
      clickable(name, !target);
      await leave();
      check(lenses().current === null, `${name}: Esc returns to normal`);
      compare(before, `${name} after Esc`);
    }
    // The enter interrupted halfway: the images return from their masks, the page is exact.
    {
      await load('/photography.html');
      const before = snapshot();
      const core = await win.SiteLensesBoot.loadCore();
      core._debug.goto(ID);
      await until(() => lens() && stats() && stats().phase === 'entering', 'the enter to begin', 15000);
      await delay(500);
      const masked = lens()._images.filter(i => i.rule && i.rule.includes('mask-image')).length;
      report.images.midEnterMasks = masked;
      await leave();
      compare(before, 'photography after an Esc halfway through the enter');
    }
    // An instant reset (the first egg, pagehide) during an animated exit: the exit ends at
    // once, its transitions finished, and the page is exact.
    {
      await load('/photography.html');
      const before = snapshot();
      await enter();
      escape();
      await until(() => stats() && stats().phase === 'exiting' && stats().exitT > 0.1, 'the exit to run', 5000);
      const began = performance.now();
      await lenses().reset({ instant: true });
      await idle();
      report.instantResetMs = Math.round(performance.now() - began);
      check(report.instantResetMs < 200, `An instant reset during the exit ends it at once (${report.instantResetMs} ms)`);
      compare(before, 'photography after an instant reset during the exit');
    }

    /* 1a. The lightbox on a phone and a tablet, where its arrows sit over the photo: both
     * arrows and the close control take the pointer (the photo, hidden under the backdrop, is
     * a stacking context of its own and would paint and hit-test over the arrows before it in
     * the tree), and a tap on next shows the next photo. Then: leaving with the lightbox open
     * (its stars fade out over the photo), and entering with it open (its photo is drawn). */
    for (const [w, h] of [[390, 844], [768, 1024]]) {
      await load('/photography.html', { width: w, height: h });
      await enter(); await imagesSettle(`${w} lightbox`);
      const shown = doc.getElementById('lightbox-img');
      const item = doc.querySelector('#photo-grid .photo-item');
      item.click();
      await until(() => !!seenCanvas(), `${w}: the lightbox stars`, 10000);
      const hits = {}; let changed = 0;
      for (let k = 0; k < 3; k++) {
        for (const id of ['lightbox-prev', 'lightbox-next', 'close-lightbox']) {
          const at = centre(doc.getElementById(id)); const hit = doc.elementFromPoint(at.x, at.y);
          hits[id] = (hits[id] || 0) + (hit && hit.id === id ? 1 : 0);
        }
        const src = shown.getAttribute('src');
        const tapped = tapAt(doc.getElementById('lightbox-next'));
        await until(() => shown.getAttribute('src') !== src, 'the next photo', 3000).catch(() => {});
        if (shown.getAttribute('src') !== src && tapped && tapped.id === 'lightbox-next') changed++;
        await until(() => !!seenCanvas(), `${w}: the next photo's stars`, 10000).catch(() => {});
      }
      report.lightbox[`${w}x${h}`] = { hits, changed };
      check(hits['lightbox-prev'] === 3 && hits['lightbox-next'] === 3 && hits['close-lightbox'] === 3, `${w}x${h} lightbox: both arrows and the close control take the pointer over the photo (${JSON.stringify(hits)} of 3)`);
      check(changed === 3, `${w}x${h} lightbox: a tap on the next arrow shows the next photo (${changed} of 3)`);
      tapAt(doc.getElementById('close-lightbox'));
      await until(() => !doc.getElementById('lightbox').classList.contains('active'), 'the lightbox to close', 3000).catch(() => {});
      check(!doc.getElementById('lightbox').classList.contains('active'), `${w}x${h} lightbox: a tap on the close control closes it`);
      await leave();
    }
    {
      // Entering with the lightbox open (keys 1-9 jump to a lens from anywhere) draws its photo,
      // and leaving with it still open fades its stars out over the photo. (The lightbox writes
      // <body>'s style, which the core restores at the end of a lens to what it was when the
      // lens began: so it is opened before, and closed after. One round of the page's own
      // first, as the media suite does, so the snapshot holds the style attribute it leaves.)
      await load('/photography.html');
      doc.querySelector('#photo-grid .photo-item').click(); await delay(100); doc.getElementById('close-lightbox').click(); await delay(100);
      const before = snapshot();
      doc.querySelector('#photo-grid .photo-item:nth-child(2)').click(); await delay(200);
      await enter();
      await until(() => stats().lightboxRenders >= 1 && !!seenCanvas(), 'the open lightbox photo as stars', 10000).catch(() => {});
      check(stats().fixedOverlays === 1 && stats().lightboxRenders >= 1 && !!seenCanvas(), `Entering with the lightbox open: its photo is drawn as stars (${stats().fixedOverlays} overlays, ${stats().lightboxRenders} renders)`);
      const canvas = seenCanvas(); const ops = [];
      lenses()._debug.goto(null);        // (Esc would close the lightbox as well: the page listens for it)
      const began = performance.now();
      while (performance.now() - began < 2500) {
        ops.push(canvas.isConnected ? +win.getComputedStyle(canvas).opacity : -1);
        if (!canvas.isConnected && !lenses().busy) break;
        await nextFrame();
      }
      await idle();
      const fading = ops.filter(v => v > 0.15 && v < 0.85).length;
      report.lightbox.exitOpacity = ops.filter((v, k) => k % 4 === 0).map(v => +v.toFixed(2));
      check(ops.length > 5 && ops[0] > 0.95 && fading >= 3, `Leaving with the lightbox open: its stars fade out over the photo (${JSON.stringify(report.lightbox.exitOpacity)})`);
      check(win.getComputedStyle(doc.getElementById('lightbox-img')).opacity === '1' && !fixedCanvases().length, 'Leaving with the lightbox open: the photo is back and its stars are gone');
      doc.getElementById('close-lightbox').click(); await delay(100);
      compare(before, 'photography after entering and leaving with the lightbox open');
    }

    /* 1b. A light page's transitions. While the lens leaves, every photo that became particles
     * keeps its counter-filter to the column's inversion, easing with the column: the two hue
     * rotations cancel at every moment (no negative, no mauve sky). While the ground passes
     * mid-grey (the column's inversion and a photo's counter-inversion flatten it there to
     * |1 - 2p| |1 - 1.88p| of its contrast) the images still shown are nearly transparent,
     * entering and leaving (no grey slab). */
    {
      await load('/photography.html');
      const main = doc.getElementById('main-content');
      const hue = text => { const m = /hue-rotate\(([-\d.e]+)deg\)/.exec(text || ''); return m ? Number(m[1]) : 0; };
      const shownOf = img => {
        const cs = win.getComputedStyle(img); const mask = cs.webkitMaskImage || cs.maskImage || 'none';
        const alphas = mask === 'none' ? [1] : [...mask.matchAll(/rgba?\(0, 0, 0(?:, ([\d.]+))?\)/g)].map(m => (m[1] === undefined ? 1 : Number(m[1])));
        return Number(cs.opacity) * Math.max(0, ...alphas);
      };
      // The same at a share of the image's height (its mask's stops, interpolated).
      const shownAt = (img, share) => {
        const cs = win.getComputedStyle(img); const mask = cs.webkitMaskImage || cs.maskImage || 'none';
        if (mask === 'none') return Number(cs.opacity);
        const stops = [...mask.matchAll(/rgba?\(0, 0, 0(?:, ([\d.]+))?\) ([\d.]+)%/g)].map(m => [m[1] === undefined ? 1 : Number(m[1]), Number(m[2]) / 100]);
        if (!stops.length) return Number(cs.opacity);
        let a = stops[stops.length - 1][0];
        for (let k = 1; k < stops.length; k++) {
          if (share <= stops[k][1]) { const [a0, t0] = stops[k - 1]; const [a1, t1] = stops[k]; a = a0 + (a1 - a0) * clampShare((share - t0) / Math.max(1e-6, t1 - t0)); break; }
        }
        return Number(cs.opacity) * a;
      };
      const clampShare = v => Math.min(1, Math.max(0, v));
      // The lens's ink canvas (the first canvas of its own layer) at a viewport point: alpha.
      const inkAlpha = (x, y) => {
        const canvas = doc.querySelector('.lenses-layer:not(.lenses-media-layer) canvas');
        if (!canvas) return 0;
        const k = canvas.width / win.innerWidth;
        return canvas.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data[3] / 255;
      };
      const groundOf = () => { const c = win.getComputedStyle(doc.body).backgroundColor.match(/[\d.]+/g).map(Number); return (255 - c[0]) / (255 - 6); };
      const photos = () => lens()._images.filter(i => i.built && i.kind === 'photo' && onScreen(i.img)).map(i => i.img);
      // Entering: sample every frame.
      const core = await win.SiteLensesBoot.loadCore();
      const flat = []; let enterSamples = 0;
      // The photos the sweep dissolves (their rules are set at the swap): each must go out
      // once, into its stars, and not come back (it used to fade out at the flat moment and
      // return before the sweep reached it).
      const swept = new Set(); const lowest = new Map(); const comeback = new Map();
      core._debug.goto(ID);
      await until(() => lens() && stats() && stats().phase === 'entering', 'the enter to begin', 15000);
      while (stats() && stats().phase === 'entering') {
        await new Promise(resolve => win.requestAnimationFrame(resolve));
        const p = groundOf(); const contrast = Math.abs(1 - 2 * p) * Math.abs(1 - 2 * 0.94 * p);
        // (Every photo in view: those that became particles and those still being sampled.)
        const inView = [...main.querySelectorAll('img')].filter(img => onScreen(img) && img.complete && img.naturalWidth > 0);
        if (contrast < 0.2 && inView.length) flat.push(Math.max(...inView.map(shownOf)));
        if (!swept.size) for (const i of lens()._images) if (i.rule !== null && i.kind === 'photo' && onScreen(i.img)) swept.add(i.img);
        for (const img of swept) {
          const v = shownOf(img); const low = Math.min(lowest.has(img) ? lowest.get(img) : 1, v);
          lowest.set(img, low);
          if (low < 0.12) comeback.set(img, Math.max(comeback.get(img) || 0, v));
        }
        enterSamples++;
      }
      await idle(); await imagesSettle('light transitions');
      const back = Math.max(0, ...comeback.values());
      report.transitions = { enterSamples, enterFlat: flat.map(v => +v.toFixed(2)), swept: swept.size, wentOut: comeback.size, comeback: +back.toFixed(2) };
      check(flat.length > 0 && Math.max(...flat) <= 0.35, `Light page, entering: images still shown are nearly transparent while the ground passes mid-grey (${flat.length} frames, most shown ${flat.length ? Math.max(...flat).toFixed(2) : '-'})`);
      check(swept.size >= 2 && comeback.size === swept.size && back <= 0.3, `Light page, entering: every photo goes out once, into its stars, and does not come back (${JSON.stringify({ swept: swept.size, wentOut: comeback.size, mostAfter: +back.toFixed(2) })})`);
      // Leaving: the photos' counter-filters follow the column.
      const watched = photos();
      check(watched.length >= 2, `Light page: photos on screen became particles (${watched.length})`);
      escape();
      const pairs = []; const flatOut = []; let leastCover = 1; let coverAt = null; let covers = 0;
      while (stats() && stats().phase === 'exiting') {
        await new Promise(resolve => win.requestAnimationFrame(resolve));
        // Each photo's middle is covered at every moment: by its night patch under its stars,
        // or by the photo itself as it returns (never the light page through its dark parts).
        // (Only once the ground has begun to lift: on the night nothing shows through.)
        for (const img of groundOf() < 0.9 ? watched : []) {
          // (The middle of the part on screen.)
          const r = img.getBoundingClientRect(); const y0 = Math.max(0, r.top); const y1 = Math.min(win.innerHeight, r.bottom);
          if (y1 - y0 < 16) continue;
          const y = (y0 + y1) / 2;
          const cover = Math.min(1, inkAlpha(r.left + r.width / 2, y) + shownAt(img, (y - r.top) / r.height)); covers++;
          if (cover < leastCover) { leastCover = cover; coverAt = { t: stats() ? stats().exitT : null, ground: +groundOf().toFixed(2), img: nameOf(img) }; }
        }
        const column = win.getComputedStyle(main).filter;
        if (column === 'none') continue;
        for (const img of watched) pairs.push([hue(column), hue(win.getComputedStyle(img).filter), win.getComputedStyle(img).filter !== 'none']);
        const p = groundOf(); const contrast = Math.abs(1 - 2 * p) * Math.abs(1 - 2 * 0.94 * p);
        const inView = [...main.querySelectorAll('img')].filter(img => onScreen(img) && img.complete && img.naturalWidth > 0);
        if (contrast < 0.2) flatOut.push(Math.max(...inView.map(shownOf)));
      }
      await idle();
      const worst = pairs.reduce((m, [a, b]) => Math.max(m, Math.abs(a + b)), 0);
      report.transitions.exit = { samples: pairs.length, worstHueSum: +worst.toFixed(1), unfiltered: pairs.filter(q => !q[2]).length, flat: flatOut.map(v => +v.toFixed(2)) };
      check(pairs.length >= 10 && pairs.every(q => q[2]) && worst <= 8, `Light page, leaving: each photo's counter-filter eases with the column (${JSON.stringify(report.transitions.exit)})`);
      check(flatOut.length > 0 && Math.max(...flatOut) <= 0.35, `Light page, leaving: images are nearly transparent while the ground passes mid-grey (${flatOut.length} frames, most shown ${flatOut.length ? Math.max(...flatOut).toFixed(2) : '-'})`);
      report.transitions.exit.leastCover = { cover: +leastCover.toFixed(2), at: coverAt, samples: covers };
      check(covers >= 20 && leastCover >= 0.6, `Light page, leaving: a photo's dark parts never show the light page (its night patch or the photo cover its middle: least ${leastCover.toFixed(2)} at ${JSON.stringify(coverAt)} over ${covers} samples)`);
    }

    /* 1c. Graphics: a text-heavy figure is sampled finely enough to read its labels (about
     * page text's step), within its own budget; an image's own border is drawn as faint dust;
     * text that CSS generates (::before, ::after) keeps its glyphs. */
    {
      await load(LONGEST_PAPER);
      const figure = doc.querySelector('#main-content img[src*="access"]');
      figure.scrollIntoView({ block: 'start' }); await delay(400);
      await enter(); await imagesSettle('figure labels');
      const info = imageInfo().get(figure);
      report.images.accessFigure = info && { step: info.step, particles: info.particles };
      check(info && info.built && info.kind === 'graphic' && info.step <= 1.6 && info.particles <= 66000, `Longest paper: the text-heavy figure is sampled finely for its labels (${JSON.stringify(report.images.accessFigure)})`);
      // Its grounds (Figure 1 groups its boxes in tinted panels, marks provider-managed boxes
      // grey, and its legend tells the box kinds apart by those fills): the commonest ground,
      // white, stays empty; every other is a sparse fill at its own hue, denser as it stands
      // further from white. Measured on 4 px blocks of the figure as displayed, each wholly one
      // ground with its neighbours (no ink near): particles per block and their mean colour.
      {
        const pts = lens()._pointsOf(figure);
        const W = Math.round(pts.w); const H = Math.round(pts.h); const B = 4;
        const canvas = doc.createElement('canvas'); canvas.width = W; canvas.height = H;
        const g = canvas.getContext('2d', { willReadFrequently: true }); g.drawImage(figure, 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data;
        const GROUNDS = { white: [254, 254, 254], grey: [217, 217, 217], legend: [239, 239, 239], blue: [222, 232, 249], lavender: [234, 231, 242], green: [217, 234, 211] };
        const names = Object.keys(GROUNDS); const bw = Math.floor(W / B); const bh = Math.floor(H / B);
        const own = new Int8Array(bw * bh).fill(-1);
        for (let j = 0; j < bh; j++) {
          for (let i = 0; i < bw; i++) {
            let cls = -2;
            for (let y = j * B; y < j * B + B && cls !== -1; y++) {
              for (let x = i * B; x < i * B + B; x++) {
                const k = (y * W + x) * 4;
                const q = names.findIndex(n => Math.abs(d[k] - GROUNDS[n][0]) + Math.abs(d[k + 1] - GROUNDS[n][1]) + Math.abs(d[k + 2] - GROUNDS[n][2]) <= 9);
                if (q < 0 || (cls >= 0 && q !== cls)) { cls = -1; break; }
                cls = q;
              }
            }
            own[j * bw + i] = cls;
          }
        }
        const counts = new Float32Array(bw * bh); const colours = new Float32Array(bw * bh * 3);
        for (let p = 0, q = 0; p < pts.points.length; p += 2, q += 4) {
          const i = Math.floor(pts.points[p] / B); const j = Math.floor(pts.points[p + 1] / B);
          if (i < 0 || j < 0 || i >= bw || j >= bh) continue;
          counts[j * bw + i]++; for (let k = 0; k < 3; k++) colours[(j * bw + i) * 3 + k] += pts.night[q + k];
        }
        // (strict: a block whose 3 x 3 neighbourhood is the same ground; loose: the block alone,
        // for the legend's small box, which holds two lines of text)
        const measureBlocks = strict => {
          const blocks = names.map(() => 0); const sum = names.map(() => 0); const rgb = names.map(() => [0, 0, 0]);
          for (let j = 1; j < bh - 1; j++) {
            for (let i = 1; i < bw - 1; i++) {
              const c = own[j * bw + i]; if (c < 0) continue;
              let same = true;
              for (let v = -1; v <= 1 && same && strict; v++) for (let u = -1; u <= 1; u++) if (own[(j + v) * bw + i + u] !== c) { same = false; break; }
              if (!same) continue;
              blocks[c]++; sum[c] += counts[j * bw + i]; for (let k = 0; k < 3; k++) rgb[c][k] += colours[(j * bw + i) * 3 + k];
            }
          }
          const t = {};
          names.forEach((n, c) => { t[n] = { blocks: blocks[c], density: blocks[c] ? +(sum[c] / blocks[c]).toFixed(3) : null, rgb: sum[c] ? rgb[c].map(v => Math.round(v / sum[c])) : null }; });
          return t;
        };
        const t = measureBlocks(true); const loose = measureBlocks(false);
        t.legend = loose.legend; t.whiteLoose = loose.white;
        report.tints.figure1 = t;
        const dens = n => t[n].density || 0;
        check(names.every(n => t[n].blocks >= 20), `Figure 1: every ground of it is found in the figure (${names.map(n => `${n} ${t[n].blocks}`).join(', ')})`);
        const looseWhite = t.whiteLoose.density || 0;
        check(dens('white') <= 0.05, `Figure 1: its commonest ground, white, stays empty (${dens('white')} particles per 16 px²)`);
        check(dens('grey') >= 0.5 && dens('grey') >= 1.5 * dens('blue') && dens('grey') >= 1.5 * dens('lavender'), `Figure 1: a grey (provider-managed) box is a clear fill, denser than the pale panels (grey ${dens('grey')}, blue ${dens('blue')}, lavender ${dens('lavender')})`);
        check(dens('legend') >= 0.3 && dens('legend') >= 4 * looseWhite, `Figure 1: the legend's provider-managed box is filled, its researcher-specified box empty (${dens('legend')} against white ${looseWhite}, blocks alone)`);
        check(['blue', 'lavender', 'green'].every(n => dens(n) >= 0.12 && dens(n) >= 4 * dens('white')), `Figure 1: the column panels are a faint fill each (${['blue', 'lavender', 'green'].map(n => `${n} ${dens(n)}`).join(', ')})`);
        const hue = n => t[n].rgb || [0, 0, 0];
        const greyish = c => Math.max(...c) - Math.min(...c) <= 20;
        check(hue('blue')[2] - hue('blue')[0] >= 12 && hue('green')[1] - hue('green')[0] >= 12 && hue('green')[1] - hue('green')[2] >= 12 && greyish(hue('grey')) && greyish(hue('legend')),
          `Figure 1: each panel keeps its hue, the greys stay grey (blue ${hue('blue')}, green ${hue('green')}, grey ${hue('grey')}, legend ${hue('legend')})`);
      }
      await leave();
      await load('/projects.html');
      await enter(); await imagesSettle('thumbnails');
      const thumb = [...doc.querySelectorAll('#main-content img')].find(img => eligible(img) && onScreen(img) && parseFloat(win.getComputedStyle(img).borderTopWidth) >= 1);
      if (thumb) {
        const r = thumb.getBoundingClientRect();
        const top = lens()._particlesIn({ left: r.left, top: r.top - 1.5, right: r.right, bottom: r.top + 1.5 });
        const left = lens()._particlesIn({ left: r.left - 1.5, top: r.top + 3, right: r.left + 1.5, bottom: r.bottom - 3 });
        check(top.n >= 0.6 * r.width / 2.4 && left.n >= 0.6 * (r.height - 6) / 2.4, `Projects: a thumbnail's border is drawn as dust along its edge (${top.n} on the top edge, ${left.n} on the left)`);
      } else check(false, 'Projects: a thumbnail with a border is on screen');
      await leave();
      await load('/publications.html');
      await enter();
      const note = doc.querySelector('#main-content .filter-note');
      const pseudo = note ? win.getComputedStyle(note, '::before') : null;
      check(pseudo && /·/.test(pseudo.content) && pseudo.webkitTextFillColor !== 'rgba(0, 0, 0, 0)', `Publications: text that CSS generates keeps its glyphs in the lens (${pseudo && pseudo.content} ${pseudo && pseudo.webkitTextFillColor})`);
      check(win.getComputedStyle(note).webkitTextFillColor === 'rgba(0, 0, 0, 0)', 'Publications: the element\'s own glyphs stay hidden (drawn as dust)');
      await leave();
      // A list's numbers (::marker, hidden with the glyphs) are drawn as dust where the browser
      // puts them: the blog post's Contents, an ordered list with outside markers. Each item's
      // number ends a space before its first line begins, on that line, and holds particles.
      await load('/blogs/agents-that-learn-after-deployment.html');
      const toc = doc.querySelector('#main-content .article-toc');
      toc.scrollIntoView({ block: 'center' }); await delay(300);
      await enter();
      const marks = [...toc.querySelectorAll('li')].map((li, k) => {
        const cs = win.getComputedStyle(li); const r = li.getBoundingClientRect();
        const start = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
        const words = lens()._wordsIn(li); const mark = words.find(w => w.marker); const first = words.find(w => !w.marker);
        const inside = mark ? lens()._particlesIn({ left: mark.left - 1, top: mark.top - 1, right: mark.left + mark.width + 1, bottom: mark.top + mark.height + 1 }) : { n: 0 };
        return {
          want: `${k + 1}.`, text: mark ? mark.text : null, markers: words.filter(w => w.marker).length, particles: inside.n,
          gap: mark ? +(start - (mark.left + mark.width)).toFixed(1) : null,
          off: mark && first ? +Math.abs(mark.top + mark.height / 2 - (first.top + first.height / 2)).toFixed(1) : null
        };
      });
      report.markers.contents = marks;
      check(marks.length >= 3 && marks.every(m => m.markers === 1 && m.text === m.want), `Blog: every Contents item's number is drawn (${marks.map(m => `${m.want}=${m.text}`).join(' ')})`);
      check(marks.every(m => m.gap !== null && m.gap > 0 && m.gap < 8 && m.off !== null && m.off <= 3 && m.particles >= 8), `Blog: each number sits before its item's first line, on it, as dust (${JSON.stringify(marks.map(m => ({ gap: m.gap, off: m.off, n: m.particles })))})`);
      await leave();
    }

    /* 2. Arrival: a page opened with the lens stored settles within 350 ms, without a caption. */
    for (const [name, path] of [['photography', '/photography.html'], ['paper', '/papers/godel-agent.html'], ['home', '/']]) {
      await load(path);
      const before = snapshot();
      await load(path, { lens: ID });
      await arrived();
      const took = stats().arriveMs;
      report.arrivalMs[name] = took;
      check(took !== null && took <= 350, `${name}: the lens arrives settled within 350 ms (${took} ms)`);
      check(stats().phase === 'live' && !doc.querySelector('.lenses-caption'), `${name}: arrival is silent and settled (${stats().phase})`);
      check(win.getComputedStyle(doc.documentElement).backgroundColor === 'rgb(6, 8, 12)', `${name}: the night ground is on after arrival`);
      await imagesSettle(`${name} arrival`);
      checkImages(`${name} arrival`);
      await leave();
      compare(before, `${name} after an arrival and Esc`);
    }
    // Arriving on the gallery (the way a reader usually comes to it in this lens: from the nav):
    // no frame shows a photo on screen before its stars exist. The photos on screen are waited
    // for until shortly before the arrival's limit; a later one waits hidden under the night
    // and its stars fade in. Sampled on every frame of the new document from its first.
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const frames = [];
      await load('/photography.html', {
        lens: ID, width: w, height: h,
        early: (d, fw) => {
          const watch = () => {
            if (fw.document !== d) return;
            try { sample(); } catch (error) { frames.push({ error: String(error) }); }
            if (frames.length < 360) fw.requestAnimationFrame(watch);
          };
          const sample = () => {
            if (d.body) {
              const visible = !d.documentElement.hasAttribute('data-lens-arriving') && +fw.getComputedStyle(d.body).opacity > 0.05;
              const l = fw.SiteLenses && fw.SiteLenses._debug ? fw.SiteLenses._debug.lens('stardust') : null;
              const built = new Set(l && l._images ? l._images.filter(i => i.built).map(i => i.img) : []);
              let shown = 0; let total = 0;
              for (const img of d.querySelectorAll('#photo-grid img')) {
                const r = img.getBoundingClientRect();
                if (!img.complete || r.width < 24 || r.bottom <= 0 || r.top >= fw.innerHeight) continue;
                total++;
                if (+fw.getComputedStyle(img).opacity > 0.02 && !built.has(img)) shown++;
              }
              frames.push({ t: fw.performance.now(), visible, shown, total, built: [...built].length });
            }
          };
          fw.requestAnimationFrame(watch);
        }
      });
      await arrived();
      await imagesSettle(`photography ${w} arrival`);
      const firstVisible = frames.find(f => f.visible);
      const bad = frames.filter(f => f.visible && f.shown > 0);
      const allStars = frames.find(f => f.visible && f.total > 0 && f.shown === 0 && f.built >= f.total);
      const sampleErrors = [...new Set(frames.filter(f => f.error).map(f => f.error))];
      report.arrivalMs[`photography ${w} photos`] = { frames: frames.length, colourFrames: bad.length, starsAfterVisibleMs: firstVisible && allStars ? Math.round(allStars.t - firstVisible.t) : null, arriveMs: stats().arriveMs, sampleErrors };
      check(firstVisible && frames.length >= 30 && bad.length === 0, `photography ${w}x${h} arrival: no frame shows a photo on screen before its stars (${JSON.stringify(report.arrivalMs[`photography ${w} photos`])})`);
      check(stats().arriveMs !== null && stats().arriveMs <= 350, `photography ${w}x${h} arrival: settles within 350 ms (${stats().arriveMs} ms)`);
      await leave();
    }
    // Esc at once after an arrival: the exit runs at once (the arrival's rest gives way).
    for (const path of ['/', '/photography.html']) {
      await load(path, { lens: ID });
      await arrived();
      escape();
      const began = performance.now(); let moved = null;
      while (performance.now() - began < 400) {
        const s = stats();
        if (!s || (s.phase === 'exiting' && s.exitT > 0)) { moved = Math.round(performance.now() - began); break; }
        await delay(5);
      }
      check(moved !== null && moved <= 120, `${path}: an exit right after the arrival starts at once (${moved} ms)`);
      await idle();
    }
    // Content that changes while the lens measures: the blog list is rendered after its fetch
    // (delayed here by a task, so it lands while the arriving lens builds its model). Every
    // post title gets its words, and the footer's words sit on its text.
    for (const [w, h, theme] of [[1440, 900, 'dark'], [390, 844, 'light']]) {
      await load('/blogs.html', {
        lens: ID, width: w, height: h, theme,
        early: (d, fw) => { const fetch = fw.fetch.bind(fw); fw.fetch = (...args) => new Promise(resolve => fw.setTimeout(resolve, 0)).then(() => fetch(...args)); }
      });
      await arrived();
      await until(() => doc.querySelector('.blog-post'), 'the blog list', 10000);
      await delay(800);
      await until(() => !stats().building, 'the re-measure', 15000); await delay(300);
      const titles = [...doc.querySelectorAll('.blog-post')].map(post => post.querySelector('h2, h3, a')).filter(el => {
        const r = el && el.getBoundingClientRect(); return r && r.top > 0 && r.bottom < win.innerHeight;
      });
      const missing = titles.filter(el => lens()._wordsIn(el).length === 0).map(el => el.textContent.trim().slice(0, 24));
      check(titles.length > 0 && !missing.length, `blogs ${w}x${h} ${theme}: every post title in view is drawn (${missing.length} of ${titles.length} missing: ${missing.slice(0, 2).join(' | ')})`);
      const foot = doc.querySelector('#site-footer p');
      if (foot) { const at = wordsOnText(foot); check(at.ok, `blogs ${w}x${h} ${theme}: the footer's words sit on its text (${JSON.stringify(at)})`); }
      await leave();
    }

    /* 3. Layout that moves after the lens measured it, without a DOM change in the scope. The
     * photos are collapsed by a stylesheet in <head> before the lens arrives (as if they had
     * not loaded: every caption sits at the top of its column), then the stylesheet goes and
     * the masonry reflows. Every caption's words and particles must follow. */
    {
      const COLLAPSE = 'stardust-suite-collapse';
      await load('/photography.html', {
        lens: ID,
        early: d => { const style = d.createElement('style'); style.id = COLLAPSE; style.textContent = '#photo-grid img { display: none !important; }'; d.head.append(style); }
      });
      await arrived();
      await until(() => !stats().building, 'the first build', 15000);
      await delay(300);
      const titles = () => [...doc.querySelectorAll('#photo-grid .photo-item:not(.hidden) .photo-title, #photo-grid .photo-item:not(.hidden) .photo-meta')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < win.innerHeight; });
      const collapsed = titles();
      const measuredCollapsed = collapsed.filter(el => wordsOnText(el).ok).length;
      check(!!doc.getElementById(COLLAPSE) && collapsed.length >= 6 && measuredCollapsed === collapsed.length,
        `Layout: the lens measured the collapsed masonry first (${measuredCollapsed} of ${collapsed.length} captions on their text)`);
      const layoutsBefore = stats().layouts;
      doc.getElementById(COLLAPSE).remove();
      await until(() => stats().layouts > layoutsBefore, 'a layout change to reach the lens', 5000);
      await until(() => !stats().building, 'the re-measure', 15000);
      await imagesSettle('layout');
      await delay(300);
      const moved = titles();
      const results = moved.map(el => ({ el, ...wordsOnText(el) }));
      const misplaced = results.filter(result => !result.ok);
      report.layout.captions = moved.length;
      report.layout.misplaced = misplaced.map(result => `${result.el.textContent.trim().slice(0, 24)} ${JSON.stringify(result.bad)} real ${JSON.stringify(result.real)}`);
      check(moved.length >= 3 && misplaced.length === 0, `Layout: after the photos appear every caption's words sit on its real text (${misplaced.length} of ${moved.length} off: ${report.layout.misplaced.slice(0, 2).join(' | ')})`);
      for (const el of moved) {
        const range = doc.createRange(); range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        const inside = lens()._particlesIn({ left: r.left - 3, top: r.top - 3, right: r.right + 3, bottom: r.bottom + 3 });
        check(inside.n >= 10 && inside.y0 >= r.top - 3 && inside.y1 <= r.bottom + 3, `Layout: "${el.textContent.trim().slice(0, 24)}" has particles on its text box (${inside.n})`);
      }
      checkImages('layout');
      check(stats().changes >= 1 && stats().layouts >= 1, `Layout: the change came through onLayoutChange (${stats().layouts} layout calls)`);
      // A real lazy photo with a fresh URL at the end of the grid: it loads when scrolled to,
      // the masonry reflows again, and it becomes particles.
      const item = doc.querySelector('#photo-grid .photo-item').cloneNode(true);
      const img = item.querySelector('img');
      img.loading = 'lazy'; img.src = `${img.getAttribute('src')}?lazy=${Math.random().toString(36).slice(2)}`;
      doc.getElementById('photo-grid').append(item);
      await delay(400);
      item.scrollIntoView({ block: 'center' });
      await until(() => img.complete && img.naturalWidth > 0, 'the lazy photo to load', 20000);
      await until(() => { const i = imageInfo().get(img); return i && (i.built || i.failed); }, 'the lazy photo to become particles', 20000);
      await until(() => !stats().building, 'the re-measure after the lazy photo', 15000);
      await delay(400);
      const lazy = imageInfo().get(img);
      check(lazy && lazy.built && lazy.particles > 0 && win.getComputedStyle(img).opacity === '0', `Layout: a lazy photo that loads late becomes particles (${JSON.stringify(lazy && { built: lazy.built, n: lazy.particles })})`);
      const near = titles().map(el => ({ el, ...wordsOnText(el) })).filter(result => !result.ok);
      check(near.length === 0, `Layout: after the lazy photo every caption in view sits on its text (${near.length} off)`);
      // (The photos near the end of the grid come into the window with it: they crossfade in.)
      await imagesSettle('lazy photo');
      checkImages('lazy photo');
      await leave();
      item.remove();
    }

    /* 3b. The photos load just after the arrival, during its rest (no frame runs then): their
     * src is held back as the page is parsed and set again 100 ms after the lens has arrived.
     * The masonry moves with the load events; the captions' old drawings stop at once and
     * their new ones show without waiting for the rest to end: no frame draws a caption
     * away from its text for more than a moment, and every caption is drawn on its text
     * soon after. */
    {
      const held = [];
      await load('/photography.html', {
        lens: ID,
        early: d => {
          const take = img => { if (img.closest('#photo-grid') && img.getAttribute('src')) { img.dataset.suiteSrc = img.getAttribute('src'); img.removeAttribute('src'); held.push(img); } };
          d.querySelectorAll('img').forEach(take);
          const watch = new d.defaultView.MutationObserver(records => records.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1) (n.matches('img') ? [n] : [...n.querySelectorAll('img')]).forEach(take); })));
          watch.observe(d, { childList: true, subtree: true });
          d.defaultView.addEventListener('DOMContentLoaded', () => setTimeout(() => watch.disconnect(), 0));
        }
      });
      await arrived();
      const arrivedAt = stats().arrivedAt;
      await delay(Math.max(0, 100 - (win.performance.now() - arrivedAt)));
      const restoredAt = win.performance.now();
      held.forEach(img => { img.setAttribute('src', img.dataset.suiteSrc); delete img.dataset.suiteSrc; });
      const captions = () => [...doc.querySelectorAll('#photo-grid .photo-item:not(.hidden) .photo-title, #photo-grid .photo-item:not(.hidden) .photo-meta')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < win.innerHeight; });
      let badUntil = -1; let okAt = -1; let samples = 0;
      while (win.performance.now() - restoredAt < 1500) {
        await yieldNow(); await delay(4);
        const at = win.performance.now() - restoredAt;
        const states = captions().map(el => { const w = wordsOnText(el); return w.ok ? 'ok' : w.words ? 'bad' : 'none'; });
        samples++;
        if (states.includes('bad')) badUntil = at;
        if (okAt < 0 && states.length && states.every(v => v === 'ok') && held.every(img => img.complete)) okAt = at;
      }
      report.layout.arrivalLoad = { held: held.length, samples, badUntilMs: Math.round(badUntil), allOnTextMs: Math.round(okAt), restRenders: stats().restRenders, restEndsMs: Math.round(arrivedAt + 600 - restoredAt) };
      check(held.length >= 10 && badUntil < 120, `Arrival: captions are never drawn away from their text for more than a moment after the photos load (${JSON.stringify(report.layout.arrivalLoad)})`);
      check(okAt >= 0 && okAt < 450 && okAt < arrivedAt + 600 - restoredAt + 50, `Arrival: every caption is drawn on its text soon after the photos load, within the arrival's rest (${JSON.stringify(report.layout.arrivalLoad)})`);
      await imagesSettle('arrival load'); checkImages('arrival load');
      await leave();
    }

    /* 4. Reduced motion: at once in, at once out, no frame while resting. */
    {
      await load('/photography.html');
      const before = snapshot();
      setReduced(true);
      const began = performance.now();
      await enter();
      const took = Math.round(performance.now() - began);
      report.reduced.enterMs = took;
      check(!doc.documentElement.classList.contains('lens-stardust-ground'), 'Reduced motion: no ground transition');
      await imagesSettle('reduced');
      const rules = lens()._images.filter(i => i.built).map(i => i.rule || '');
      check(rules.length > 0 && rules.every(rule => rule.startsWith('opacity:0') && rule.includes('transition:none')), `Reduced motion: images give way at once, without masks or fades (${[...new Set(rules)].join(' | ')})`);
      await delay(500);
      const a = frameStats().frames; await delay(1000); const b = frameStats().frames;
      report.reduced.restingFrames = b - a;
      check(b - a === 0, `Reduced motion: no frame callback while the lens rests (${b - a} in 1 s)`);
      const leaving = performance.now();
      await leave();
      report.reduced.exitMs = Math.round(performance.now() - leaving);
      check(report.reduced.exitMs < 400, `Reduced motion: the lens leaves at once (${report.reduced.exitMs} ms)`);
      compare(before, 'Reduced motion after Esc');
      setReduced(false);
    }

    /* 5. Dark site theme (the site's own pages; a paper page has one design): no inversion;
     * the portrait and the photos still become particles. */
    for (const [name, path, target] of [['dark home', '/', null], ['dark photography', '/photography.html', null], ['dark blog', '/blogs/agents-that-learn-after-deployment.html', null]]) {
      await load(path, { theme: 'dark' });
      if (target) { doc.querySelector(target).scrollIntoView({ block: 'start' }); await delay(400); }
      const before = snapshot();
      // The column paints its own background in the dark theme: while the ground turns to
      // night it must not show as a lighter box (the same colour as the body at every moment).
      const main = doc.getElementById('main-content');
      const gap = () => {
        const a = win.getComputedStyle(main).backgroundColor.match(/[\d.]+/g).map(Number); const b = win.getComputedStyle(doc.body).backgroundColor.match(/[\d.]+/g).map(Number);
        const alpha = a.length > 3 ? a[3] : 1;
        return Math.max(...[0, 1, 2].map(k => Math.abs(a[k] * alpha + b[k] * (1 - alpha) - b[k])));
      };
      const widest = async busy => {
        let worst = 0; const began = performance.now();
        do { worst = Math.max(worst, gap()); await delay(25); } while (busy() && performance.now() - began < 15000);
        return worst;
      };
      (await win.SiteLensesBoot.loadCore())._debug.goto(ID);
      const entering = await widest(() => lenses().current !== ID || lenses().busy);
      await idle();
      check(entering < 1.5, `${name}: the column turns to night with the ground, never as a box (largest difference ${entering.toFixed(1)})`);
      check(doc.documentElement.getAttribute('data-theme') === 'dark' && !doc.documentElement.classList.contains('lens-stardust-invert'), `${name}: the dark page is not inverted`);
      await imagesSettle(name);
      checkImages(name);
      if (name === 'dark blog') {
        // The blog's figures are below the fold: one of them, in view, is inverted by its own filter.
        const figure = doc.querySelector('#main-content img');
        if (figure) {
          figure.scrollIntoView({ block: 'center' });
          await until(() => figure.complete && figure.naturalWidth > 0, 'the blog figure to load', 15000);
          await delay(300); await imagesSettle('dark blog figure'); checkImages('dark blog figure');
        }
        check(lens()._images.some(i => i.built && i.kind === 'graphic' && i.base.includes('invert')), `dark blog: a white figure is inverted by its own filter on the dark page (${JSON.stringify(lens()._images.filter(i => i.built).map(i => i.base))})`);
        win.scrollTo({ top: 0, behavior: 'instant' }); await delay(200);
      }
      clickable(name);
      escape();
      const leaving = await widest(() => lenses().busy);
      await idle();
      // The transitions the lens's classes started end with it (the back-to-top control's
      // border and the toggle's colour ease over 0.8 s, longer than the exit; a transition
      // names its longhands: border-top-color, not border-color).
      const MARKS = '.homepage-section h2, .project-link, #theme-toggle, .footer-social a, .back-to-top, .nav-button';
      const lingering = doc.getAnimations().filter(a => a.transitionProperty && a.playState === 'running' && a.effect && a.effect.target &&
        (a.effect.target === doc.documentElement || a.effect.target === doc.body || a.effect.target.id === 'main-content' || a.effect.target.matches(MARKS)))
        .map(a => `${a.effect.target.id || a.effect.target.className || a.effect.target.tagName}:${a.transitionProperty}`);
      check(lingering.length === 0, `${name}: no transition the lens started outlives its exit (${lingering.join(', ')})`);
      await delay(60);
      check(leaving < 1.5, `${name}: the column returns with the ground, never as a box (largest difference ${leaving.toFixed(1)})`);
      compare(before, `${name} after Esc`);
    }

    /* 6. A phone: the photography column, and a figure in a scrolling .figure-scroll. */
    {
      await load('/photography.html', { width: 390, height: 844 });
      const before = snapshot();
      await enter();
      await imagesSettle('390 photography');
      checkImages('390 photography');
      check(doc.documentElement.scrollWidth <= 391, `390 photography: no horizontal overflow (${doc.documentElement.scrollWidth})`);
      await leave();
      compare(before, '390 photography after Esc');
      // A paper's figures on a phone: their small labels are sampled about as finely as text.
      await load('/papers/godel-agent.html', { width: 390, height: 844 });
      doc.querySelector('#main-content img').scrollIntoView({ block: 'start' }); await delay(400);
      await enter(); await imagesSettle('390 figures');
      const figures = lens()._images.filter(i => i.built && i.kind === 'graphic' && onScreen(i.img));
      report.images.phoneFigures = figures.map(i => `${nameOf(i.img)} ${i.step}`);
      check(figures.length > 0 && figures.every(i => i.step <= 1.3), `390 paper: the figures' small labels get a fine step (${report.images.phoneFigures.join(', ')})`);
      await leave();
      await load(LONGEST_PAPER, { width: 390, height: 844 });
      const scroller = [...doc.querySelectorAll('.figure-scroll')].find(el => el.querySelector('img') && el.scrollWidth > el.clientWidth + 1);
      if (scroller) {
        scroller.scrollIntoView({ block: 'center' }); await delay(400);
        const img = scroller.querySelector('img');
        const before2 = snapshot();
        await enter();
        await imagesSettle('390 figure-scroll');
        const info = imageInfo().get(img);
        check(info && info.built && info.boxed, `390 figure-scroll: the scrolling figure is a group of its scroller (${JSON.stringify(info && { built: info.built, boxed: info.boxed })})`);
        const clip = scroller.getBoundingClientRect();
        const box = contentBox(img);
        const inside = lens()._particlesIn({ left: clip.left, top: box.top - 4, right: clip.right, bottom: box.bottom + 4 });
        const all = lens()._particlesIn({ left: -1e5, top: box.top - 4, right: 1e5, bottom: box.bottom + 4 });
        check(inside.n > 0 && all.n > inside.n && info.clipped, `390 figure-scroll: the figure's particles extend past the scroller, which clips them (${inside.n} inside of ${all.n}; clipped ${info.clipped})`);
        scroller.scrollLeft = 200; await delay(200);
        const shifted = lens()._particlesIn({ left: -1e5, top: box.top - 4, right: 1e5, bottom: box.bottom + 4 });
        const moved = all.x0 - shifted.x0;
        check(shifted.n === all.n && Math.abs(moved - scroller.scrollLeft) < 3, `390 figure-scroll: the particles follow the scroller (moved ${moved.toFixed(1)} px for a ${scroller.scrollLeft} px scroll)`);
        scroller.scrollLeft = 0; await delay(100);
        await leave();
        compare(before2, '390 figure-scroll after Esc');
      } else {
        check(false, '390: the longest paper has a scrolling .figure-scroll with an image');
      }
    }

    /* 7. Budgets: scrolling the photography page and the longest paper page, then resting. */
    for (const [name, path] of [['photography', '/photography.html'], ['longest paper', LONGEST_PAPER]]) {
      const runs = [];
      for (let run = 0; run < 2; run++) {
        await load(path, { lens: ID });
        await arrived();
        await delay(800);
        await until(() => !stats().building, 'the first build', 15000);
        // The arrival's own build (the photos decoded and sampled, the bands near the viewport).
        const built = stats();
        const arrival = { slices: built.slices, slicesOver: built.slicesOver, sliceMaxMs: built.sliceMaxMs, imageSliceMaxMs: built.imageSliceMaxMs, sliceTags: built.sliceTags };
        lens()._reset();
        const before = frameStats();
        const since = win.performance.now(); const sinceTop = performance.now();
        const height = doc.documentElement.scrollHeight - win.innerHeight;
        for (let k = 0; k <= 60; k++) {
          doc.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 200 + (k % 20) * 30, clientY: 150 + (k % 10) * 50 }));
          if (k % 3 === 0) win.scrollTo({ top: Math.min(height, (k / 60) * height), behavior: 'instant' });
          await delay(40);
        }
        await until(() => !stats().building, 'the builder after the scroll', 20000);
        await delay(400);
        const after = frameStats();
        const frames = after.frames - before.frames;
        const avg = frames > 0 ? (after.avgMs * after.frames - before.avgMs * before.frames) / frames : 0;
        const s = stats();
        const tasks = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
        const ours = lensTasksSince(sinceTop) || tasks;
        const lensMaxMs = s.maxMs;          // the lens's own longest frame callback since _reset()
        // Resting (once the dust the pointer stirred has settled, and over a window in which
        // nothing was built, e.g. by a late photo): the 15 Hz shimmer at most.
        let rest0 = 0; let rest1 = 0;
        for (let attempt = 0; attempt < 3; attempt++) {
          await until(() => stats().awake === 0 && !stats().building, 'the stirred dust to settle', 10000);
          await delay(300);
          const work = () => `${stats().builds}|${stats().changes}`;
          const before = work();
          rest0 = frameStats().frames; await delay(2000); rest1 = frameStats().frames;
          if (work() === before) break;
        }
        runs.push({ frames, avgMs: +avg.toFixed(3), maxMs: after.maxMs, lensMaxMs, longTasks: tasks, lensLongTasks: ours, sliceMaxMs: s.sliceMaxMs, imageSliceMaxMs: s.imageSliceMaxMs, sliceTags: s.sliceTags,
          slices: s.slices, slicesOver: s.slicesOver, images: s.images, particles: s.particles, restingHz: (rest1 - rest0) / 2, arriveMs: s.arriveMs, arrival });
        await leave();
      }
      report.budgets[name] = runs;
      const avg = median(runs.map(r => r.avgMs)); const hz = median(runs.map(r => r.restingHz));
      const over = median(runs.map(r => r.slices ? r.slicesOver / r.slices : 0));
      check(lensTasks !== null, `${name}: long animation frames are observable on the top-level page`);
      check(runs.every(r => r.lensLongTasks.length === 0), `${name}: no task over 50 ms caused by the lens while scrolling (${runs.map(r => r.lensLongTasks.join('/') || '-').join(', ')}; all long tasks: ${runs.map(r => r.longTasks.join('/') || '-').join(', ')})`);
      check(runs.every(r => r.lensMaxMs < 50), `${name}: no frame callback of the lens over 50 ms while scrolling (longest ${runs.map(r => r.lensMaxMs).join(', ')} ms)`);
      check(avg < 4, `${name}: frame callbacks average ${avg} ms while scrolling (median of ${runs.length}; budget 4 ms)`);
      check(over <= 0.05, `${name}: building slices stay within 8 ms while scrolling (median ${(over * 100).toFixed(1)}% over; longest ${runs.map(r => r.sliceMaxMs).join(', ')} ms)`);
      const overArriving = median(runs.map(r => r.arrival.slices ? r.arrival.slicesOver / r.arrival.slices : 0));
      check(overArriving <= 0.05, `${name}: building slices stay within 8 ms while arriving (median ${(overArriving * 100).toFixed(1)}% over; longest ${runs.map(r => r.arrival.sliceMaxMs).join(', ')} ms, images ${runs.map(r => r.arrival.imageSliceMaxMs).join(', ')} ms)`);
      check(hz <= 16.5, `${name}: at rest at most the 15 Hz shimmer runs (${hz} Hz)`);
    }
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens[0] === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens[0]);
    if (storedLens[1] === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedLens[1]);
  }
  /* 8. No uncaught errors, console.error calls, or lens warnings. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  const lensWarnings = warnings.filter(w => /stardust|media/i.test(w));
  assertions++;
  if (lensWarnings.length) failures.push(`Warnings: ${[...new Set(lensWarnings)].slice(0, 8).join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
