/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes a few minutes: tests/run_easter_suites.sh lens_ink starts it as a background
 * promise (one eval stores the result on window when the promise resolves) and polls for it.
 * Tests lens VI (Ink, easter/lenses/ink.js) through the lenses core, in a frame:
 *   home (light and dark theme): the paper (the page's background, the tile kept in
 *     sessionStorage), the five tones by role and cinnabar links, no other colour on the page,
 *     the painted portrait (one overlay, monochrome ink on paper), the seal pressed after the
 *     name once the caption has left, the veil gone and no frame callback once settled, links
 *     and the theme toggle reachable, exact restoration;
 *   reduced motion: the settled state at once, no veil, no frame, and back at once;
 *   photography: one painting per readable image near the viewport, no long task while
 *     scrolling the masonry, exact restoration;
 *   a paper page and the longest paper page: the wash filter on the outermost demos and
 *     figures only, cinnabar links outside them, the filter's tones of the demos' green and
 *     rust codes apart (drawn through the same SVG filter on a canvas), the seal after the
 *     title, the frame budget of the bloom, no long task while scrolling, exact restoration;
 *   arrival with the lens stored in sessionStorage on fresh page loads: settled within 350 ms,
 *     no caption, no veil, the seal already pressed, Esc restores; also when the paper tile is
 *     no longer kept (the ground at once, the paper following, kept again);
 *   390 x 844 and 320 x 640: no horizontal overflow, the seal inside the viewport; on every paper
 *     page at 390 and 320 the seal keeps at least 4 px from every letter of the title;
 *   the seal of a blog post whose markdown (and so its title) comes 1.2 s late;
 *   the paintings: the colour-coded fills of a blog figure stay apart in tone (12 levels or
 *     more), the pale route tints of the auditing paper's access figure stay 15 levels or more
 *     lighter than its grey provider bars, a white strip in a figure with a grey ground is
 *     paper, a painting moved by a relayout is laid on the sheet again (with a control: held,
 *     the measure sees it stray), and so is one in a phone's figure scroller once it rests;
 *   the photography lightbox (1440 and 390): its photo painted by the media helper's fixed
 *     option above the lightbox and under the veil, on the photo, which keeps its size, at the
 *     resolution it is shown at (not a small wash stretched); next and previous photos painted,
 *     with no frame showing the last photo's painting or the new photo's print (its paper shows
 *     until the painting soaks in), the arrows keep the pointer (and are cut out of the painting
 *     where they lie over it), the painting goes with the lightbox, exact restoration;
 *   arrival on photography: the photos are printed through the wash's tone curve until painted,
 *     close to their paintings in tone;
 *   the seal pressed as the bloom's last beat, the caption beside the name making room for it;
 *   the dark theme's whitening shows no caption halo; the back-to-top button keeps its paper
 *     fill and its fade, the footer icons their transitions; an exit during the whitening fades
 *     the veil from where it is; an instant reset while an exit is paused in a hidden tab ends
 *     the exit and lets the activation go;
 *   the bloom: the veil's paper pattern is a canvas (not a JPEG-decoded bitmap) and the bloom
 *     keeps the frame rate (rAF intervals; run the suite at a device scale of 2 too), a caption's
 *     line is reached at one time over its height; the veil covers the site's fixed chrome; the
 *     skip link is legible; the sheet's pixels are given back after the exit.
 * Prints assertions, failures, timings (enter and arrival durations, frame budget, long tasks, and
 * the scripts of the long animation frames that held them).
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

  const PAPER = [243, 239, 228];
  const TONES = { jiao: [18, 18, 18], nong: [46, 44, 41], zhong: [74, 70, 64], dan: [109, 104, 95] };
  const CINNABAR = [163, 56, 42];
  const LONGEST_PAPER = '/papers/auditing-health-llms.html';
  const PAPER_KEY = 'lenses-ink-paper-v2';   // the lens keeps its tile under this key, per pixel ratio
  const PAPER_PAGES = ['agent-x', 'alcuna', 'atomic-to-composite', 'auditing-health-llms', 'chatgpt-summarization-evaluation', 'chemagent',
    'coding-agents-long-context', 'context-aware-evaluation', 'contextual-asr', 'contrasolver', 'coral', 'damon', 'derl', 'dsgram', 'eama',
    'epistemic-context-learning', 'error-robust-retrieval', 'geometry-of-reasoning', 'godel-agent', 'history-matters', 'knowledge-boundary',
    'knowledge-interplay', 'lazy-grounding', 'mc-mke', 'nlg-evaluation-survey', 'reverse-lm', 'self-generated-documents', 'seq2seq-data2text', 'themis'];
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = sessionStorage.getItem('lenses-active');
  const storedGround = sessionStorage.getItem('lenses-ground');
  localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
  const errors = []; const warnings = [];
  const report = { enterMs: {}, arriveMs: {}, budget: {}, longTasks: {}, longFrames: {}, overlays: {}, tones: {}, figures: {}, seals: {} };
  const quantile = (values, q) => { const v = values.slice().sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : 0; };
  let doc; let win; let reduced = false; let longTasks = []; let longFrames = [];

  // Opens a page in the frame (optionally with the lens stored, as an arrival).
  const load = async (path, { width = 1440, height = 900, theme = 'light', lens = null } = {}) => {
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:200000;border:0;background:white`;
    localStorage.setItem('theme', theme);
    if (lens) { sessionStorage.setItem('lenses-active', lens); sessionStorage.setItem('lenses-ground', '#f3efe4'); }
    else { sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground'); }
    const url = `${path}${path.includes('?') ? '&' : '?'}r=${Math.random().toString(36).slice(2)}`;
    await new Promise(resolve => { frame.onload = resolve; frame.src = url; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.readyState === 'complete' && doc.getElementById('main-content') && win.SiteLensesBoot, `${path}: the page and the boot`);
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
    const consoleWarn = win.console.warn.bind(win.console);
    win.console.warn = (...args) => { warnings.push(`${path}: ${args.map(String).join(' ')}`); consoleWarn(...args); };
    longTasks = []; longFrames = [];
    try {
      new win.PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push({ at: entry.startTime, ms: Math.round(entry.duration) })))
        .observe({ type: 'longtask', buffered: true });
    } catch (error) { /* long tasks are not observable here */ }
    // Long animation frames, with the scripts that ran in them: who a long task belongs to.
    try {
      new win.PerformanceObserver(list => list.getEntries().forEach(entry => {
        if (entry.duration <= 50) return;
        const scripts = (entry.scripts || []).map(script => `${(script.sourceURL || '').split('/').pop().split('?')[0] || '?'}:${script.sourceFunctionName || script.invoker || '?'} ${Math.round(script.duration)} ms`);
        longFrames.push({ at: entry.startTime, ms: Math.round(entry.duration), scripts });
      })).observe({ type: 'long-animation-frame', buffered: true });
    } catch (error) { /* long animation frames are not observable here */ }
    // Reduced motion is simulated through matchMedia (the core reads it when it loads).
    const match = win.matchMedia.bind(win);
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { get: () => reduced });
      return result;
    };
    if (!lens) {
      // The page's own late content (star counts, markdown) settles before any snapshot.
      let last = ''; let since = performance.now();
      await until(() => {
        const now = doc.getElementById('main-content').innerHTML;
        if (now !== last) { last = now; since = performance.now(); }
        return performance.now() - since > 500;
      }, `${path}: the page to settle`, 10000);
    }
  };
  const core = () => win.SiteLensesBoot.loadCore();
  const lenses = () => win.SiteLenses;
  const state = () => win.SiteLenses._debug.state;
  const ink = () => win.SiteLenses._debug.lens('ink');
  const idle = () => until(() => !win.SiteLenses || !win.SiteLenses.busy, 'the lenses to settle', 20000);
  const nextPaint = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  const escape = () => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const rgb = value => (String(value).match(/[\d.]+/g) || []).map(Number);
  const near = (value, want, tolerance = 2) => { const c = rgb(value); return want.every((v, i) => Math.abs(c[i] - v) <= tolerance); };
  const scopeRoots = () => [...new Set(['#site-nav, body > header.site-header', '#main-content', '#site-footer, body > footer.paper-footer'].map(s => doc.querySelector(s)).filter(Boolean))];

  // Everything the lens could leave behind (the core's own assets may stay once loaded).
  const ours = el => /easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '');
  const snapshot = () => ({
    main: doc.querySelector('#main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlAttrs: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    headKids: [...doc.head.children].filter(el => !ours(el)).map(el => el.outerHTML).join('\n'),
    sheets: [...doc.styleSheets].filter(sheet => !ours(sheet.ownerNode)).length,
    fonts: doc.fonts.size,
    scroll: Math.round(win.scrollY),
    focus: doc.activeElement ? `${doc.activeElement.tagName}#${doc.activeElement.id}.${doc.activeElement.className}` : ''
  });
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return `at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const compare = (before, label) => {
    const now = snapshot();
    check(now.main === before.main, `${label}: #main-content markup is byte-identical (${firstDiff(before.main, now.main)})`);
    check(now.nav === before.nav && now.footer === before.footer, `${label}: nav and footer markup are byte-identical`);
    check(now.htmlAttrs === before.htmlAttrs, `${label}: <html> attributes restored (${now.htmlAttrs})`);
    check(now.bodyAttrs === before.bodyAttrs, `${label}: <body> attributes restored (${now.bodyAttrs})`);
    check(now.bodyKids === before.bodyKids, `${label}: no node left in <body> (${now.bodyKids})`);
    check(now.headKids === before.headKids, `${label}: no node left in <head> (${firstDiff(before.headKids, now.headKids)})`);
    check(now.sheets === before.sheets && now.fonts === before.fonts, `${label}: stylesheets and fonts restored (${now.sheets}/${before.sheets}, ${now.fonts}/${before.fonts})`);
    check(Math.abs(now.scroll - before.scroll) < 1, `${label}: scroll unchanged (${now.scroll} vs ${before.scroll})`);
    check(now.focus === before.focus, `${label}: focus unchanged`);
    check(!doc.querySelector('.lenses-layer, .lenses-caption, .lens-ink-seal, .lens-ink-veil') && !/(^| )lens-ink/.test(doc.documentElement.className), `${label}: no layer, seal, veil or lens class left`);
    check(state().frames === 0 && !state().glyphs && state().layers === 0, `${label}: the core is clean (frames ${state().frames})`);
  };
  // Links in view are hit-testable at their centres; the theme toggle too on shell pages.
  const clickable = label => {
    const links = [...doc.querySelectorAll('#main-content a[href], #site-nav a[href], body > header.site-header a[href]')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top > 0 && r.bottom < win.innerHeight && r.left > 0 && r.right < win.innerWidth;
    }).slice(0, 5);
    check(links.length > 0, `${label}: a link is in view`);
    for (const link of links) {
      const at = centre(link); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === link, `${label}: the link "${link.textContent.trim().slice(0, 30)}" is clickable (hit ${hit && hit.tagName}.${hit && hit.className})`);
    }
    const toggle = doc.querySelector('#theme-toggle');
    if (toggle) {
      const at = centre(toggle); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('#theme-toggle') === toggle, `${label}: the theme toggle is clickable`);
    }
  };
  // The images the media helper should paint now: in the scope, loaded, readable, rendered,
  // at least 24 x 24, not in a fixed ancestor, within `reach` viewports of the viewport (the
  // helper makes overlays within 1.5 viewports and drops them beyond 4).
  const eligible = (reach = 1.5) => {
    const w = win.innerWidth; const h = win.innerHeight; const out = [];
    for (const root of scopeRoots()) {
      for (const img of root.querySelectorAll('img')) {
        const svg = /\.svgz?(?:[?#]|$)|^data:image\/svg\+xml/i.test(img.currentSrc || img.src);
        if (!img.complete || !(img.naturalWidth || (svg && img.currentSrc)) || !win.SiteLensesMedia || !win.SiteLensesMedia.readable(img)) continue;
        const r = img.getBoundingClientRect(); const s = win.getComputedStyle(img);
        if (r.width < 24 || r.height < 24 || s.display === 'none' || s.visibility === 'hidden') continue;
        let fixed = false;
        for (let el = img; el && el !== doc.body; el = el.parentElement) if (win.getComputedStyle(el).position === 'fixed') fixed = true;
        if (fixed) continue;
        if (r.bottom < -reach * h || r.top > (1 + reach) * h || r.right < -reach * w || r.left > (1 + reach) * w) continue;
        out.push(img);
      }
    }
    return out;
  };
  // Every image near the viewport has its painting, and no painting is far from it.
  const paintedAll = label => {
    const overlays = ink()._state.media.overlays; const shown = new Set(overlays.map(o => o.img));
    const nearby = eligible(1.5); const reachable = new Set(eligible(4));
    report.overlays[label] = { overlays: overlays.length, near: nearby.length, far: reachable.size };
    check(nearby.length > 0 || overlays.length === 0, `${label}: images near the viewport are found`);
    check(nearby.every(img => shown.has(img)) && overlays.every(o => reachable.has(o.img)),
      `${label}: one painting per readable image near the viewport (${overlays.length} paintings, ${nearby.length} near, ${reachable.size} within reach)`);
    return overlays;
  };
  // Waits until the helper has painted what it will (nothing queued, nothing being drawn).
  const mediaSettled = async label => {
    const st = ink()._state;
    await until(() => st && st.media, `${label}: the media handle`, 8000);
    await st.media.ready;
    let last = -1; let since = performance.now();
    await until(() => {
      const s = st.media._state; const n = st.media.overlays.length;
      if (n !== last || s.busy || s.queued) { last = n; since = performance.now(); }
      return performance.now() - since > 700;
    }, `${label}: the paintings to settle`, 20000);
  };
  // A painting is ink on paper: every sampled pixel nearly neutral (paper itself spreads 15).
  const monochrome = canvas => {
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const step = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 40));
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let worst = 0; let dark = 0; let n = 0;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const i = (y * canvas.width + x) * 4; const c = [data[i], data[i + 1], data[i + 2]];
        worst = Math.max(worst, Math.max(...c) - Math.min(...c)); n++;
        if (c[0] < 120) dark++;
      }
    }
    return { worst, darkShare: dark / Math.max(1, n) };
  };
  // Long tasks while scrolling the page down and back, in steps.
  const scrollTasks = async label => {
    const since = win.performance.now();
    const height = doc.documentElement.scrollHeight - win.innerHeight;
    for (let k = 0; k <= 24; k++) { win.scrollTo({ top: Math.round((k / 24) * height), behavior: 'instant' }); await delay(110); }
    for (let k = 24; k >= 0; k -= 4) { win.scrollTo({ top: Math.round((k / 24) * height), behavior: 'instant' }); await delay(110); }
    await delay(400);
    const tasks = longTasks.filter(task => task.at >= since && task.ms > 50).map(task => task.ms);
    report.longTasks[label] = tasks;
    report.longFrames[label] = longFrames.filter(entry => entry.at >= since).map(entry => `${entry.ms} ms: ${entry.scripts.join(', ') || 'no script (style, layout, paint)'}`);
    return tasks;
  };
  const enterInk = async label => {
    const began = performance.now();
    await (await core())._debug.goto('ink');
    report.enterMs[label] = { total: Math.round(performance.now() - began), lens: ink()._state ? ink()._state.took : null };
    check(lenses().current === 'ink', `${label}: Ink enters (at ${lenses().current})`);
  };
  const leave = async () => { await lenses().reset(); await idle(); await nextPaint(); await nextPaint(); };
  // Waits (up to 2 s) for the seal to be pressed and settled.
  const pressed = label => until(() => {
    const seal = doc.querySelector('.lens-ink-seal');
    return seal && seal.classList.contains('is-stamped') && win.getComputedStyle(seal).opacity === '1';
  }, `${label}: the seal to be pressed`, 2000).catch(() => {});
  // Where the seal lies against the trigger's text: its least distance from any of the title's
  // line boxes (negative: an overlap), whether it follows the last line on that line or sits
  // under the line's end, and any other text within 4 px of it.
  const sealPlace = (seal, trigger) => {
    const range = doc.createRange(); range.selectNodeContents(trigger);
    const rects = [...range.getClientRects()].filter(r => r.width && r.height);
    const lastTop = Math.max(...rects.map(r => r.top));
    const line = rects.filter(r => r.top > lastTop - 2);
    const right = Math.max(...line.map(r => r.right));
    const top = Math.min(...line.map(r => r.top)); const bottom = Math.max(...line.map(r => r.bottom));
    const box = seal.getBoundingClientRect(); const mid = (box.top + box.bottom) / 2;
    const onLine = box.left >= right + 3.5 && box.left - right < 24 && mid > top && mid < bottom;
    const under = box.top >= bottom + 2 && box.top - bottom < 16 && box.right <= right + 1;
    const distance = r => {
      const dx = Math.max(r.left - box.right, box.left - r.right); const dy = Math.max(r.top - box.bottom, box.top - r.bottom);
      return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
    };
    // The last line's letters (and, for a seal under it, every line) at least 4 px away; the
    // line boxes above at least 2 px (a line box holds its descenders' room).
    const gap = Math.min(...(under ? rects : line).map(distance));
    const above = Math.min(...rects.filter(r => !line.includes(r)).map(distance), Infinity);
    const others = [];
    const walker = doc.createTreeWalker(doc.body, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.data.trim() || trigger.contains(node) || node.parentElement.closest('.lenses-layer, .lenses-caption, script, style')) continue;
      const rr = doc.createRange(); rr.selectNodeContents(node);
      if ([...rr.getClientRects()].some(r => r.width && r.left < box.right + 4 && r.right > box.left - 4 && r.top < box.bottom + 4 && r.bottom > box.top - 4)) others.push(node.data.trim().slice(0, 16));
    }
    return { box, gap, above, onLine, under, others };
  };
  // The seal: pressed, after the trigger's last line on that line (or under its end), never
  // within 4 px of a letter.
  const sealCheck = (label, selector) => {
    const seal = doc.querySelector('.lens-ink-seal');
    const trigger = doc.querySelector(selector);
    check(!!seal && seal.classList.contains('is-stamped') && win.getComputedStyle(seal).opacity === '1', `${label}: the seal is pressed`);
    if (!seal || !trigger) return;
    const { box, gap, above, onLine, under, others } = sealPlace(seal, trigger);
    check(onLine || under, `${label}: the seal follows the trigger's last line, or sits under its end (${Math.round(box.left)}, ${Math.round(box.top)})`);
    check(gap >= 4 && above >= 2 && others.length === 0, `${label}: the seal keeps clear of every letter (gap ${gap.toFixed(1)} px, ${above.toFixed(1)} px from the lines above, other text: ${others.join(', ')})`);
    check(box.width >= 16 && box.width <= 30 && Math.abs(box.width - box.height) < 0.5, `${label}: the seal is a small square (${Math.round(box.width)} px)`);
    check(box.right <= win.innerWidth && box.left >= 0, `${label}: the seal is inside the viewport`);
    check(seal.closest('.lenses-layer') && win.getComputedStyle(seal).pointerEvents === 'none', `${label}: the seal lives in a lens layer and takes no pointer`);
  };
  // Tone checks on a site-shell page.
  const shellTones = label => {
    const html = doc.documentElement; const hs = win.getComputedStyle(html);
    check(html.classList.contains('lens-ink') && html.classList.contains('lens-ink-shell'), `${label}: the shell classes are on`);
    check(near(hs.backgroundColor, PAPER) && /url\(/.test(hs.backgroundImage), `${label}: the page is xuan paper (${hs.backgroundColor}, ${hs.backgroundImage.slice(0, 30)})`);
    const colour = selector => { const el = doc.querySelector(selector); return el ? win.getComputedStyle(el).color : null; };
    const tones = {
      name: colour('.profile-text .name'), bio: colour('.bio'), rest: colour('.paper_rest'), pron: colour('.pronunciation'),
      link: colour('.bio a[href]'), heading: colour('.homepage-section h2')
    };
    report.tones[label] = tones;
    check(near(tones.name, TONES.jiao) && near(tones.heading, TONES.jiao), `${label}: the name and headings are 焦 (${tones.name}, ${tones.heading})`);
    check(near(tones.bio, TONES.nong), `${label}: running text is 浓 (${tones.bio})`);
    check(near(tones.rest, TONES.zhong), `${label}: the author lines are 重 (${tones.rest})`);
    check(near(tones.pron, TONES.dan), `${label}: muted text is 淡 (${tones.pron})`);
    check(near(tones.link, CINNABAR), `${label}: links are cinnabar (${tones.link})`);
    const rule = win.getComputedStyle(doc.querySelector('.homepage-section h2'));
    check(/rgba\(42, 40, 37, 0\.17\)/.test(rule.borderBottomColor), `${label}: rules are 清 (${rule.borderBottomColor})`);
    // No colour but cinnabar: every text in the scope is a neutral ink, or cinnabar (the skip
    // link, shown on focus, has paper letters on a cinnabar block: section 12 checks it).
    const odd = [];
    for (const root of scopeRoots()) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (el.matches('.skip-link') || ![...el.childNodes].some(node => node.nodeType === 3 && node.data.trim())) continue;
        const s = win.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const c = rgb(s.color);
        const spread = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
        const red = c[0] > c[1] + 60 && c[0] > c[2] + 60 && Math.abs(c[1] - c[2]) < 30;
        if (spread > 14 && !red) odd.push(`${el.tagName.toLowerCase()}.${el.className} ${s.color}`);
      }
    }
    check(odd.length === 0, `${label}: no colour but the ink tones and cinnabar (${odd.slice(0, 5).join(' ; ')})`);
  };
  // The veil is gone and nothing moves once the lens has settled.
  const restful = async label => {
    await nextPaint(); await nextPaint(); await delay(60);
    const veil = doc.querySelector('.lens-ink-veil');
    check(!veil || win.getComputedStyle(veil).opacity === '0', `${label}: the veil is gone`);
    check(state().frames === 0 && !state().raf, `${label}: no frame callback runs while the lens rests (frames ${state().frames})`);
  };

  // How far a painting's bare paper lies from the page's paper under it: the mean difference
  // (levels) between its light pixels and the tile pixel the page's background shows there.
  let tileCache = null;
  const paperMismatch = overlay => {
    const p = ink()._paper; const k = p.k; const n = Math.round(600 * k);
    if (!tileCache || tileCache.source !== p.source) {
      const tc = doc.createElement('canvas'); tc.width = tc.height = n;
      const tg = tc.getContext('2d', { willReadFrequently: true }); tg.drawImage(p.source, 0, 0, n, n);
      tileCache = { source: p.source, data: tg.getImageData(0, 0, n, n).data };
    }
    const tile = tileCache.data;
    const cv = overlay.canvas; const r = cv.getBoundingClientRect(); const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
    const s = cv.width / r.width; let sum = 0; let count = 0;
    for (let y = 2; y < cv.height - 2; y += 3) {
      for (let x = 2; x < cv.width - 2; x += 3) {
        const i = (y * cv.width + x) * 4; if (d[i] < 225) continue;
        // The tile pixel under the painting pixel's centre, as the page's background takes it.
        const tx = Math.floor((((r.left + win.scrollX + (x + 0.5) / s) % 600 + 600) % 600) * k); const ty = Math.floor((((r.top + win.scrollY + (y + 0.5) / s) % 600 + 600) % 600) * k);
        const t = (Math.min(n - 1, ty) * n + Math.min(n - 1, tx)) * 4;
        sum += (Math.abs(d[i] - tile[t]) + Math.abs(d[i + 1] - tile[t + 1]) + Math.abs(d[i + 2] - tile[t + 2])) / 3; count++;
      }
    }
    return count > 200 ? sum / count : null;
  };
  // Samples fn() once per frame of the page until the returned stop() is called (which returns
  // the samples).
  const everyFrame = fn => {
    const seen = []; let on = true;
    const tick = () => { if (!on) return; seen.push(fn()); win.requestAnimationFrame(tick); };
    win.requestAnimationFrame(tick);
    return () => { on = false; return seen; };
  };
  // The caption's letters (its text nodes' line boxes, not its blocks).
  const letters = el => {
    const out = []; const walker = doc.createTreeWalker(el, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) { const r = doc.createRange(); r.selectNodeContents(node); out.push(...[...r.getClientRects()].filter(b => b.width && b.height)); }
    return out;
  };
  // The seal is pressed as the enter ends, and the caption beside the trigger (if it is still
  // there) keeps its letters 4 px or more from it.
  const pressedWithCaption = label => {
    const seal = doc.querySelector('.lens-ink-seal'); const caption = doc.querySelector('.lenses-caption');
    check(!!seal && seal.classList.contains('is-stamped'), `${label}: the seal is pressed as the enter ends (caption ${caption ? caption.className : 'gone'})`);
    if (!seal || !caption) return;
    const b = seal.getBoundingClientRect();
    const close = letters(caption).filter(r => r.left < b.right + 4 && r.right > b.left - 4 && r.top < b.bottom + 4 && r.bottom > b.top - 4);
    report.seals[`${label} caption`] = `${win.getComputedStyle(caption).paddingLeft} room, letters from ${Math.round(Math.min(...letters(caption).map(r => r.left)))}, seal to ${Math.round(b.right)}`;
    check(close.length === 0, `${label}: the caption's letters keep clear of the seal (${close.length} within 4 px)`);
  };

  try {
    /* 1. Home, light theme: enter, the settled state, exit. */
    await load('/');
    await core();
    const homeBase = snapshot();
    const homeText = doc.getElementById('main-content').textContent;
    await enterInk('home');
    pressedWithCaption('home');
    check(Math.abs(win.scrollY - homeBase.scroll) < 1, 'home: entering keeps the scroll position');
    check(doc.getElementById('main-content').textContent === homeText, 'home: the text is unchanged');
    const k = Math.min(win.devicePixelRatio || 1, 2);
    const keptPaper = sessionStorage.getItem(`${PAPER_KEY}@${k}`) || '';
    check(keptPaper.startsWith('data:image/') || !!ink()._paper, `home: the paper tile is kept in sessionStorage (${keptPaper.length} chars)`);
    shellTones('home');
    await mediaSettled('home');
    const homeOverlays = paintedAll('home');
    check(homeOverlays.length === 1, `home: the portrait is painted (${homeOverlays.length})`);
    if (homeOverlays[0]) {
      const m = monochrome(homeOverlays[0].canvas);
      check(m.worst <= 18 && m.darkShare > 0.05, `home: the portrait is ink on paper (channel spread ${m.worst}, dark share ${m.darkShare.toFixed(2)})`);
      const box = homeOverlays[0].canvas.getBoundingClientRect(); const img = doc.querySelector('.profile-photo').getBoundingClientRect();
      check(Math.abs(box.left - img.left) < 3 && Math.abs(box.top - img.top) < 3, 'home: the painting lies on the portrait');
    }
    clickable('home');
    await restful('home');
    // The veil covers the site's fixed chrome (the back-to-top button at 999, the progress bar
    // at 1000) while the page whitens.
    {
      const layer = doc.querySelector('.lens-ink-veil-layer');
      const chrome = Math.max(...[...doc.querySelectorAll('.back-to-top, .scroll-progress')].map(el => parseInt(win.getComputedStyle(el).zIndex, 10) || 0), 0);
      check(layer && parseInt(win.getComputedStyle(layer).zIndex, 10) > chrome, `home: the veil lies above the site's fixed chrome (${layer && win.getComputedStyle(layer).zIndex} over ${chrome})`);
    }
    // The paper pattern is a canvas: a JPEG-decoded ImageBitmap as a pattern's source is
    // decoded again on every draw at a pixel ratio of 2.
    check(ink()._paper && ink()._paper.source instanceof win.HTMLCanvasElement, `home: the paper's pattern source is a canvas (${ink()._paper && ink()._paper.source && ink()._paper.source.constructor.name})`);
    // Once the caption has left, the seal stays where it was pressed, after the name.
    await until(() => !doc.querySelector('.lenses-caption'), 'home: the caption to leave', 8000);
    await pressed('home');
    sealCheck('home', '.profile-text .name');
    await leave();
    compare(homeBase, 'home after exit');
    check(ink()._sheet === null && !!ink()._paper && !ink()._paper.source, 'home: after the exit the sheet\'s pixels and the decoded tile are given back');

    /* 2. Home, dark theme, scrolled: the lens is still paper and ink. */
    await load('/', { theme: 'dark' });
    await core();
    win.scrollTo({ top: 220, behavior: 'instant' }); await delay(80);
    const darkBase = snapshot();
    await enterInk('home dark');
    check(Math.abs(win.scrollY - darkBase.scroll) < 1, 'home dark: entering keeps the scroll position');
    shellTones('home dark');
    await restful('home dark');
    await leave();
    compare(darkBase, 'home dark after exit');

    /* 3. Reduced motion: the settled state at once, no veil, no frame; and back at once. */
    await load('/');
    reduced = true;
    await core();
    await enterInk('reduced warm-up'); await leave();
    const reducedBase = snapshot();
    const began = performance.now();
    await (await core())._debug.goto('ink');
    const took = Math.round(performance.now() - began);
    report.enterMs.reduced = took;
    check(lenses().current === 'ink' && took < 400, `reduced motion: enters at once (${took} ms)`);
    const veil = doc.querySelector('.lens-ink-veil');
    check(!veil || win.getComputedStyle(veil).opacity === '0', 'reduced motion: no veil');
    await restful('reduced motion');
    const seal = doc.querySelector('.lens-ink-seal');
    check(!seal || seal.classList.contains('is-still') || win.getComputedStyle(seal).transitionDuration === '0s', 'reduced motion: the seal is not animated');
    const leaving = performance.now();
    await lenses().reset();
    const left = Math.round(performance.now() - leaving);
    report.exitMs = { reduced: left };
    check(left < 300, `reduced motion: leaves at once (${left} ms)`);
    await leave();
    compare(reducedBase, 'reduced motion after exit');
    reduced = false;

    /* 4. Photography: a painting per photo near the viewport; scrolling stays smooth. */
    await load('/photography.html');
    await core();
    await until(() => [...doc.querySelectorAll('.photo-item img')].slice(0, 3).every(img => img.complete), 'photography: the first photos', 15000);
    const photoBase = snapshot();
    await enterInk('photography');
    pressedWithCaption('photography');
    // The bloom reaches a caption's line at one time over its height: no neighbour's margin
    // gives part of the line an earlier time (which cut the glyphs across). Field cells are
    // 6 px (CELL in ink.js), in viewport px at the scroll of the enter.
    {
      const f = ink()._state.field; let worst = 0; let lines = 0;
      if (f && Math.abs(win.scrollY - f.scroll) < 1) {
        for (const el of doc.querySelectorAll('.photo-item .photo-title, .photo-item .photo-meta')) {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > win.innerHeight || r.height > 30 || r.height < 6) continue;
          lines++;
          for (let i = Math.ceil(r.left / 6 - 0.5); i <= Math.floor(r.right / 6 - 0.5); i++) {
            const times = [];
            for (let j = Math.ceil(r.top / 6 - 0.5); j <= Math.floor(r.bottom / 6 - 0.5); j++) times.push(f.field[(j + f.extra) * f.cols + i]);
            if (times.length > 1 && times.every(Number.isFinite)) worst = Math.max(worst, Math.max(...times) - Math.min(...times));
          }
        }
      }
      report.budget.captionSpread = +worst.toFixed(3);
      check(lines > 0 && worst <= 0.12, `photography: a caption's line is reached at one time over its height (spread ${worst.toFixed(3)} s over ${lines} lines)`);
    }
    await mediaSettled('photography');
    const photoOverlays = paintedAll('photography');
    check(photoOverlays.length >= 3, `photography: the photos in view are painted (${photoOverlays.length})`);
    check(photoOverlays.every(o => o.kind === 'photo'), 'photography: the photos are painted as photos (ink wash)');
    const firstPhoto = photoOverlays.find(o => o.canvas.getBoundingClientRect().top < win.innerHeight);
    if (firstPhoto) {
      const m = monochrome(firstPhoto.canvas);
      check(m.worst <= 18, `photography: a photo is ink on paper (channel spread ${m.worst})`);
    }
    await until(() => !doc.querySelector('.lenses-caption'), 'photography: the caption to leave', 8000);
    await pressed('photography');
    sealCheck('photography', '#main-content h1[data-lens-trigger]');
    clickable('photography');
    const photoTasks = await scrollTasks('photography scroll');
    check(photoTasks.length === 0, `photography: no task over 50 ms while scrolling (${photoTasks.join(', ')} ms)`);
    await mediaSettled('photography after scrolling');
    paintedAll('photography after scrolling');
    win.scrollTo({ top: photoBase.scroll, behavior: 'instant' }); await delay(100);
    await restful('photography');
    await leave();
    compare(photoBase, 'photography after exit');

    /* 4b. The photography lightbox (fixed, outside the scope): a sheet of the same paper, and
       its photo painted like the gallery's by the media helper (fixed: true) in a layer above
       the lightbox and under the veil, lying on the photo, which keeps its own size; the next
       and previous photos get their own paintings, the arrows keep the pointer, the painting
       goes with the lightbox, and the page is restored after the exit. At 390 px the arrows
       lie over the photo: the painting is cut out along them. */
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const label = `lightbox ${width}`;
      await load('/photography.html', { width, height });
      await core();
      await until(() => [...doc.querySelectorAll('.photo-item img')].slice(0, 3).every(img => img.complete), `${label}: the first photos`, 15000);
      const box = doc.getElementById('lightbox'); const shown = doc.getElementById('lightbox-img');
      // The photo's box without the lens (opening and closing leaves the site's own empty
      // style attribute on <body>, so the snapshot is taken after one opening). The second
      // photo: a wide one (984 x 738 css px at 1440), the largest box the lightbox shows.
      const pick = () => doc.querySelectorAll('.photo-item')[1];
      pick().click();
      await until(() => shown.complete && shown.naturalWidth > 0, `${label}: the photo without the lens`, 8000);
      await nextPaint();
      const plain = shown.getBoundingClientRect();
      doc.getElementById('close-lightbox').click(); await nextPaint();
      const lightBase = snapshot();
      await enterInk(label);
      const painting = () => ink()._state.media.overlays.find(o => o.img === shown && o.canvas.isConnected);
      pick().click();
      check(win.getComputedStyle(box).display !== 'none' && /url\(/.test(win.getComputedStyle(box).backgroundImage) && near(win.getComputedStyle(box).backgroundColor, PAPER), `${label}: it opens on the paper`);
      await until(() => painting(), `${label}: the painting`, 8000).catch(() => {});
      const o = painting();
      check(!!o && o.fixed && o.kind === 'photo', `${label}: the photo is painted as the gallery's are, in the helper's fixed layer (${o ? `${o.kind}, fixed ${o.fixed}` : 'none'})`);
      const r = shown.getBoundingClientRect();
      check(Math.abs(r.width - plain.width) < 1 && Math.abs(r.height - plain.height) < 1 && win.getComputedStyle(shown).content === 'normal',
        `${label}: the photo keeps its own size (${Math.round(r.width)} x ${Math.round(r.height)} vs ${Math.round(plain.width)} x ${Math.round(plain.height)})`);
      if (o) {
        const c = o.canvas.getBoundingClientRect();
        check(Math.abs(c.left - r.left) < 1.5 && Math.abs(c.top - r.top) < 1.5 && Math.abs(c.width - r.width) < 1.5 && Math.abs(c.height - r.height) < 1.5, `${label}: the painting lies on the photo`);
        // Painted at the resolution it is shown at: the wash's own pixels are at least the box's
        // css px (or the canvas's, when it holds fewer), not a small wash stretched.
        const made = typeof ink()._made === 'function' ? ink()._made(o.canvas) : null;
        const want = Math.min(o.canvas.width, Math.round(r.width)) - 1;
        report.overlays[`${label} work`] = made ? `${made.w}x${made.h} for ${Math.round(r.width)}x${Math.round(r.height)} css, canvas ${o.canvas.width}x${o.canvas.height}` : null;
        check(!!made && made.w >= want, `${label}: the painting is computed at the size it is shown (${made ? `${made.w} work px` : 'none'} for ${Math.round(r.width)} css px)`);
        // The photo itself is hidden under its painting: the lightbox's paper, not its print.
        check(win.getComputedStyle(shown).opacity === '0', `${label}: the photo under its painting is hidden (the paper shows; opacity ${win.getComputedStyle(shown).opacity})`);
        const m = monochrome(o.canvas);
        check(m.worst <= 18 && m.darkShare > 0.02, `${label}: the painting is ink on paper (channel spread ${m.worst}, dark share ${m.darkShare.toFixed(2)})`);
        const z = parseInt(win.getComputedStyle(o.canvas.closest('.lenses-layer')).zIndex, 10);
        const veilLayer = doc.querySelector('.lens-ink-veil-layer');
        const veilZ = veilLayer ? parseInt(win.getComputedStyle(veilLayer).zIndex, 10) : Infinity;
        check(z > (parseInt(win.getComputedStyle(box).zIndex, 10) || 0) && z < veilZ, `${label}: the painting lies above the lightbox and under the veil (${z}, veil ${veilZ})`);
        // Each arrow keeps the pointer; where it lies over the photo, the painting is cut out along it.
        for (const id of ['lightbox-prev', 'lightbox-next']) {
          const arrow = doc.getElementById(id); const at = centre(arrow); const hit = doc.elementFromPoint(at.x, at.y);
          check(hit === arrow, `${label}: the ${id.slice(9)} arrow keeps the pointer (hit ${hit && hit.id})`);
          const a = arrow.getBoundingClientRect();
          if (a.right > r.left && a.left < r.right) check(/url\(/.test(o.canvas.style.maskImage || o.canvas.style.webkitMaskImage || ''), `${label}: the painting is cut out along the ${id.slice(9)} arrow over the photo`);
        }
      }
      const first = o && o.canvas; const firstSrc = shown.currentSrc;
      // From the click to the new painting: no frame shows the last photo's painting (under the
      // new caption) or the new photo's print; the new painting soaks in from paper.
      const opacity = el => +win.getComputedStyle(el).opacity;
      const stop = everyFrame(() => ({ stale: !!first && first.isConnected && opacity(first) > 0.02, print: opacity(shown) > 0.01 }));
      doc.getElementById('lightbox-next').click();
      let next = null;
      await until(() => (next = painting()) && next.canvas !== first && shown.currentSrc !== firstSrc, `${label}: the next painting`, 8000).catch(() => {});
      await delay(500);
      const frames = stop();
      check(!!next && next.canvas !== first && next.kind === 'photo', `${label}: the next photo gets its own painting`);
      report.overlays[`${label} next`] = `${frames.length} frames, ${frames.filter(f => f.stale).length} stale, ${frames.filter(f => f.print).length} printed`;
      check(frames.length > 5 && !frames.some(f => f.stale) && !frames.some(f => f.print),
        `${label}: next: no frame shows the last painting or the new photo's print (${frames.filter(f => f.stale).length} stale, ${frames.filter(f => f.print).length} printed of ${frames.length})`);
      check(!doc.documentElement.classList.contains('lens-ink-awaiting'), `${label}: next: the painting is shown (no longer awaited)`);
      doc.getElementById('lightbox-prev').click();
      await until(() => painting() && shown.currentSrc === firstSrc, `${label}: the painting again`, 8000).catch(() => {});
      check(!!painting() && shown.currentSrc === firstSrc, `${label}: the previous photo is painted again`);
      doc.getElementById('close-lightbox').click();
      await until(() => !painting(), `${label}: the painting to go with the lightbox`, 3000).catch(() => {});
      check(!painting(), `${label}: the painting goes with the lightbox`);
      await restful(label);
      await leave();
      compare(lightBase, `${label} after exit`);
    }

    /* 5. A paper page: the wash filter, cinnabar links, the seal after the title. */
    await load('/papers/godel-agent.html');
    await core();
    const paperBase = snapshot();
    await enterInk('godel');
    const html = doc.documentElement;
    check(html.classList.contains('lens-ink-paper') && !html.classList.contains('lens-ink-shell'), 'godel: the paper-page classes are on');
    check(near(win.getComputedStyle(html).backgroundColor, PAPER), 'godel: the page is xuan paper');
    check(near(win.getComputedStyle(doc.querySelector('#main-content h1')).color, TONES.jiao), 'godel: the title is 焦');
    check(near(win.getComputedStyle(doc.querySelector('#main-content .paper-authors a, #main-content a[href]')).color, CINNABAR), 'godel: links are cinnabar');
    const washed = [...doc.querySelectorAll('#main-content *')].filter(el => /lens-ink-wash/.test(win.getComputedStyle(el).filter));
    check(washed.length > 0, `godel: demos and figures are washed into ink (${washed.length})`);
    check(washed.every(el => !washed.some(other => other !== el && other.contains(el))), 'godel: no ink is filtered twice (outermost elements only)');
    // The filter itself, on the demos' green and rust codes (equal in luminance), and on
    // white and the page's ink: drawn through #lens-ink-wash on a canvas over white.
    {
      const c = doc.createElement('canvas'); c.width = 100; c.height = 10;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.filter = 'url(#lens-ink-wash)';
      // The auditing demo's codes: within a mode rgb(43 97 81 / a), across modes rgb(143 79 49 / a),
      // its legend keys at a = .35, its heatmap cells at a = shade / 2 (a 0.33 cell: 0.165), and
      // its contrast cells' washes #e2ede6 and #f6ebe4. One alpha unit is about 0.86 levels on
      // the paper, so 14 units are 12 levels.
      [['#ffffff', 0], ['#2b6151', 10], ['#8f4f31', 20], ['#202a26', 30], ['rgba(43,97,81,0.35)', 40], ['rgba(143,79,49,0.35)', 50],
        ['rgba(43,97,81,0.165)', 60], ['rgba(143,79,49,0.165)', 70], ['#e2ede6', 80], ['#f6ebe4', 90]].forEach(([fill, x]) => { g.fillStyle = fill; g.fillRect(x, 0, 10, 10); });
      const px = x => [...g.getImageData(x + 5, 5, 1, 1).data];
      const alpha = x => px(x)[3];
      report.tones.wash = { white: alpha(0), green: alpha(10), rust: alpha(20), ink: alpha(30), greenKey: alpha(40), rustKey: alpha(50), greenCell: alpha(60), rustCell: alpha(70), posWash: alpha(80), negWash: alpha(90) };
      check(alpha(0) <= 3, `godel: the wash makes white clear paper (alpha ${alpha(0)})`);
      check(alpha(30) >= 210, `godel: the page's ink stays dense (alpha ${alpha(30)})`);
      check(Math.abs(alpha(10) - alpha(20)) >= 25, `godel: green and rust codes print as different tones (${alpha(10)} vs ${alpha(20)})`);
      check(Math.abs(alpha(40) - alpha(50)) >= 20, `godel: the within/across legend keys stay apart (${alpha(40)} vs ${alpha(50)})`);
      check(Math.abs(alpha(60) - alpha(70)) >= 14, `godel: shaded within/across cells (0.33) stay a step apart (${alpha(60)} vs ${alpha(70)})`);
      check(Math.abs(alpha(80) - alpha(90)) >= 14 && alpha(90) >= 8, `godel: the pale higher/lower washes stay apart, and visible (${alpha(80)} vs ${alpha(90)})`);
      const ink0 = px(30);
      check(Math.max(ink0[0], ink0[1], ink0[2]) - Math.min(ink0[0], ink0[1], ink0[2]) <= 4, 'godel: the wash is one ink (neutral)');
    }
    await mediaSettled('godel');
    paintedAll('godel');
    await pressed('godel');
    sealCheck('godel', '#main-content h1[data-lens-trigger]');
    clickable('godel');
    await restful('godel');
    // A relayout that moves the figures without resizing them (a narrower window): each
    // painting is laid on the sheet again, so its bare paper matches the page's paper there.
    {
      const mismatch = paperMismatch;
      const graphics = () => ink()._state.media.overlays.filter(o => o.kind === 'graphic');
      const kept = new Map(graphics().map(o => [o.img, o.canvas]));
      const before = graphics().map(mismatch).filter(v => v !== null);
      const realigned = () => !ink()._state.realigning && !ink()._state.realignTimer;
      // The control: with the realignment held (the lens's own flag), the moved paintings no
      // longer match the paper under them, so the measure sees a stray painting.
      ink()._state.realigning = true;
      frame.style.width = '1240px';
      await delay(400); await mediaSettled('godel narrower');
      const stray = graphics().filter(o => kept.get(o.img) === o.canvas).map(mismatch).filter(v => v !== null);
      ink()._state.realigning = false;
      win.dispatchEvent(new win.Event('resize'));      // a layout change: the realignment runs
      await delay(400); await until(realigned, 'godel: the paintings to be laid again', 8000); await delay(300);
      const moved = graphics().filter(o => kept.get(o.img) === o.canvas).map(mismatch).filter(v => v !== null);
      const fixed = list => list.map(v => v.toFixed(2)).join(', ');
      report.budget.realigned = { before: before.map(v => +v.toFixed(2)), held: stray.map(v => +v.toFixed(2)), after: moved.map(v => +v.toFixed(2)) };
      check(before.length > 0 && before.every(v => v < 0.3), `godel: the paintings lie on the page's paper (mean difference ${fixed(before)} levels)`);
      check(stray.length > 0 && stray.every(v => v > 0.6), `godel: held, the moved paintings no longer match their paper (${fixed(stray)} levels): the measure sees a stray painting`);
      check(moved.length > 0 && moved.every(v => v < 0.3), `godel: paintings moved by a relayout lie on the page's paper again (mean difference ${fixed(moved)} levels)`);
      frame.style.width = '1440px';
      await delay(400); await mediaSettled('godel wide again');
    }
    await leave();
    compare(paperBase, 'godel after exit');

    /* 6. The longest paper page: the bloom's frame budget, scrolling, restoration. */
    await load(LONGEST_PAPER);
    await core();
    const longBase = snapshot();
    const statsBefore = JSON.parse(JSON.stringify(state().frameStats.ink || { frames: 0, avgMs: 0, maxMs: 0 }));
    const enterSince = win.performance.now();
    // The frame rate of the bloom: rAF intervals while the ink blooms (at a device scale of 2 a
    // JPEG-decoded pattern source held it to 30 ms and more).
    const intervals = []; let lastFrame = 0; let sampling = true;
    const sample = now => {
      const st = ink() && ink()._state;
      if (st && st.blooming && !st.settled) { if (lastFrame) intervals.push(now - lastFrame); lastFrame = now; }
      if (sampling) win.requestAnimationFrame(sample);
    };
    await core();
    win.requestAnimationFrame(sample);
    await enterInk('longest paper');
    sampling = false;
    report.budget.bloomRaf = { dpr: win.devicePixelRatio, frames: intervals.length, p50: +quantile(intervals, 0.5).toFixed(1), p90: +quantile(intervals, 0.9).toFixed(1) };
    check(intervals.length > 30 && quantile(intervals, 0.5) <= 20 && quantile(intervals, 0.9) <= 34, `longest paper: the bloom keeps the frame rate at a device scale of ${win.devicePixelRatio} (rAF p50 ${quantile(intervals, 0.5).toFixed(1)} ms, p90 ${quantile(intervals, 0.9).toFixed(1)} ms over ${intervals.length} frames)`);
    const after = state().frameStats.ink || { frames: 0, avgMs: 0, maxMs: 0 };
    const frames = after.frames - statsBefore.frames;
    const avg = frames > 0 ? +((after.avgMs * after.frames - statsBefore.avgMs * statsBefore.frames) / frames).toFixed(3) : 0;
    report.budget.bloom = { frames, avgMs: avg, maxMs: after.maxMs };
    report.longTasks['longest paper enter'] = longTasks.filter(task => task.at >= enterSince && task.ms > 50).map(task => task.ms);
    report.longFrames['longest paper enter'] = longFrames.filter(entry => entry.at >= enterSince).map(entry => `${entry.ms} ms: ${entry.scripts.join(', ') || 'no script (style, layout, paint)'}`);
    check(frames > 20, `longest paper: the bloom runs as frames (${frames})`);
    check(avg < 4, `longest paper: the bloom's frame callbacks average ${avg} ms (budget 4 ms)`);
    await mediaSettled('longest paper');
    const longTasksScroll = await scrollTasks('longest paper scroll');
    check(longTasksScroll.length === 0, `longest paper: no task over 50 ms while scrolling (${longTasksScroll.join(', ')} ms)`);
    await mediaSettled('longest paper after scrolling');
    paintedAll('longest paper after scrolling');
    win.scrollTo({ top: 0, behavior: 'instant' }); await delay(100);
    await restful('longest paper');
    await leave();
    compare(longBase, 'longest paper after exit');

    /* 7. Arrival: the lens stored in sessionStorage, fresh page loads. */
    for (const [path, trigger] of [['/publications.html', '#main-content h1[data-lens-trigger]'], ['/photography.html', '#main-content h1[data-lens-trigger]'], ['/papers/godel-agent.html', '#main-content h1[data-lens-trigger]'], ['/', '.profile-text .name']]) {
      await load(path);
      const base = snapshot();
      await load(path, { lens: 'ink' });
      await until(() => win.SiteLenses && win.SiteLenses.current === 'ink' && !win.SiteLenses.busy && !doc.documentElement.hasAttribute('data-lens-arriving') && !doc.documentElement.hasAttribute('data-lens-revealing'), `${path}: Ink to arrive`, 15000);
      const st = ink()._state;
      report.arriveMs[path] = st ? { took: st.took, marks: st.marks } : null;
      check(st && st.took <= 350, `${path}: arrival settles within 350 ms (${st && st.took} ms)`);
      check(!doc.querySelector('.lenses-caption'), `${path}: no caption on arrival`);
      check(win.getComputedStyle(doc.body).opacity === '1' && !doc.getElementById('lenses-prepaint'), `${path}: the page shows, the ground is lifted`);
      const v = doc.querySelector('.lens-ink-veil');
      check(!v || win.getComputedStyle(v).opacity === '0', `${path}: no veil on arrival`);
      const s = doc.querySelector('.lens-ink-seal');
      check(s && s.classList.contains('is-stamped') && s.classList.contains('is-still'), `${path}: the seal is already pressed`);
      if (path === '/') sealCheck('arrival home', trigger); else sealCheck(`arrival ${path}`, trigger);
      await mediaSettled(`${path} arrival`);
      paintedAll(`${path} arrival`);
      if (path === '/photography.html') {
        // Until painted, a photo is printed through the wash's own tone curve: the painting that
        // replaces it is a small step (a linear print is much darker: the control).
        const photos = ink()._state.media.overlays.filter(o => o.kind === 'photo' && !o.fixed && o.canvas.getBoundingClientRect().top < win.innerHeight).slice(0, 5);
        const diff = (o, filter) => {
          const r = o.img.getBoundingClientRect(); const w = Math.max(8, Math.round(r.width / 4)); const h = Math.max(8, Math.round(r.height / 4));
          const grab = f => { const c = doc.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); if (f) g.filter = f; g.drawImage(f ? o.img : o.canvas, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
          const a = grab(null); const b = grab(filter); let sum = 0;
          for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]);
          return sum / (a.length / 4);
        };
        const wash = photos.map(o => diff(o, 'url(#lens-ink-print-wash)')); const linear = photos.map(o => diff(o, 'url(#lens-ink-print)'));
        const mean = list => list.reduce((x, y) => x + y, 0) / Math.max(1, list.length);
        report.tones.printVsPainting = { wash: wash.map(v => +v.toFixed(1)), linear: linear.map(v => +v.toFixed(1)) };
        check(photos.length >= 3 && photos.every(o => /lens-ink-print-wash/.test(win.getComputedStyle(o.img).filter)), `photography arrival: the photos are printed through the wash's curve (${photos.length})`);
        check(mean(wash) <= 15 && mean(wash) < mean(linear) / 2, `photography arrival: a photo's print is close to its painting in tone (mean difference ${mean(wash).toFixed(1)} levels; a linear print ${mean(linear).toFixed(1)})`);
      }
      clickable(`${path} arrival`);
      await restful(`${path} arrival`);
      escape(); await idle(); await nextPaint(); await nextPaint();
      check(sessionStorage.getItem('lenses-active') === null, `${path}: Esc forgets the lens`);
      compare(base, `${path}: after Esc on arrival`);
    }

    /* 7b. Arrival when the paper tile is no longer kept (sessionStorage cleared or full): the
       style switches within 350 ms over the plain ground, and the paper follows; also on the
       photography page, whose paintings share the budget with the paper being made again. */
    for (const path of ['/publications.html', '/photography.html']) {
      await load(path);
      const base = snapshot();
      sessionStorage.removeItem(`${PAPER_KEY}@${k}`);
      await load(path, { lens: 'ink' });
      await until(() => win.SiteLenses && win.SiteLenses.current === 'ink' && !win.SiteLenses.busy && !doc.documentElement.hasAttribute('data-lens-arriving') && !doc.documentElement.hasAttribute('data-lens-revealing'), `${path}: Ink to arrive without a kept paper`, 15000);
      const st = ink()._state;
      report.arriveMs[`${path} (paper made again)`] = st ? { took: st.took, marks: st.marks } : null;
      check(st && st.took <= 350, `${path} without a kept paper: arrival settles within 350 ms (${st && st.took} ms)`);
      check(near(win.getComputedStyle(doc.documentElement).backgroundColor, PAPER), `${path} without a kept paper: the ground is the paper's colour at once`);
      let followed = true;
      await until(() => /url\(/.test(win.getComputedStyle(doc.documentElement).backgroundImage), `${path}: the paper to follow`, 5000).catch(() => { followed = false; });
      check(followed, `${path} without a kept paper: the paper follows the switch`);
      let kept = true;
      await until(() => (sessionStorage.getItem(`${PAPER_KEY}@${k}`) || '').startsWith('data:image/'), `${path}: the paper to be kept again`, 5000).catch(() => { kept = false; });
      check(kept, `${path} without a kept paper: the new paper is kept for the next page`);
      escape(); await idle(); await nextPaint(); await nextPaint();
      compare(base, `${path}: after Esc on an arrival without a kept paper`);
    }

    /* 8. Phones (390 x 844 and 320 x 640): no horizontal overflow, the seal inside the viewport. */
    const phones = [
      ['/', '.profile-text .name', 390, 844], ['/papers/godel-agent.html', '#main-content h1[data-lens-trigger]', 390, 844],
      ['/photography.html', '#main-content h1[data-lens-trigger]', 390, 844],
      ['/', '.profile-text .name', 320, 640], ['/papers/auditing-health-llms.html', '#main-content h1[data-lens-trigger]', 320, 640]
    ];
    for (const [path, trigger, width, height] of phones) {
      const size = `${width}x${height}`;
      await load(path, { width, height });
      await core();
      const base = snapshot();
      await enterInk(`${width} ${path}`);
      check(doc.documentElement.scrollWidth <= width + 1, `${size} ${path}: no horizontal overflow (${doc.documentElement.scrollWidth})`);
      await until(() => !doc.querySelector('.lenses-caption'), `${size} ${path}: the caption to leave`, 8000);
      await pressed(`${size} ${path}`);
      sealCheck(`${size} ${path}`, trigger);
      await mediaSettled(`${size} ${path}`);
      paintedAll(`${size} ${path}`);
      clickable(`${size} ${path}`);
      await leave();
      compare(base, `${size} ${path} after exit`);
    }

    /* 9. Every paper page at 390 and 320 (as arrivals): the seal keeps 4 px from every letter
       of the title, however its last line falls. */
    for (const [width, height] of [[390, 844], [320, 640]]) {
      const tight = [];
      for (const name of PAPER_PAGES) {
        const path = `/papers/${name}.html`;
        await load(path, { width, height, lens: 'ink' });
        await until(() => win.SiteLenses && win.SiteLenses.current === 'ink' && !win.SiteLenses.busy && !doc.documentElement.hasAttribute('data-lens-arriving'), `${width} ${path}: Ink to arrive`, 15000);
        await delay(150);
        const seal = doc.querySelector('.lens-ink-seal'); const trigger = doc.querySelector('#main-content h1');
        if (!seal || !trigger || seal.style.display === 'none') { tight.push(`${name}: no seal`); continue; }
        const { box, gap, above, onLine, under, others } = sealPlace(seal, trigger);
        if (!(onLine || under) || gap < 4 || above < 2 || others.length || box.right > width || box.left < 0) tight.push(`${name}: gap ${gap.toFixed(1)}, ${Math.round(box.width)} px at ${Math.round(box.left)}${others.length ? `, over ${others.join(',')}` : ''}`);
        report.seals[`${width} ${name}`] = `${Math.round(box.width)} px, gap ${gap.toFixed(1)}${under ? ', under' : ''}`;
      }
      check(tight.length === 0, `${width} px: on every paper page the seal keeps clear of the title (${tight.join(' ; ')})`);
    }
    sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');

    /* 10. A blog post whose markdown, and so its title, comes 1.2 s after the lens arrived: the
       seal is pressed once the title is there. */
    {
      sessionStorage.setItem('lenses-active', 'ink'); sessionStorage.setItem('lenses-ground', '#f3efe4');
      frame.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:900px;z-index:200000;border:0;background:white';
      frame.src = `/blog-post.html?id=self-referential-agent&r=${Math.random().toString(36).slice(2)}`;
      // Delay the markdown: patch the frame's fetch as soon as its window exists.
      let patched = false; const began = performance.now();
      while (!patched && performance.now() - began < 5000) {
        try {
          const w = frame.contentWindow; const d = frame.contentDocument;
          if (d && d.URL.includes('blog-post.html') && w.fetch && !w.__inkSlow) {
            const real = w.fetch.bind(w);
            w.fetch = (url, options) => (/\.md\b/.test(String(url)) ? new Promise(resolve => setTimeout(resolve, 1200)).then(() => real(url, options)) : real(url, options));
            w.__inkSlow = true; patched = true;
          }
        } catch (error) { /* not yet */ }
        if (!patched) await delay(0);
      }
      doc = frame.contentDocument; win = frame.contentWindow;
      await until(() => win.SiteLenses && win.SiteLenses.current === 'ink' && !win.SiteLenses.busy && !doc.documentElement.hasAttribute('data-lens-arriving'), 'late title: Ink to arrive', 15000);
      const early = !doc.querySelector('#main-content h1');
      await until(() => doc.querySelector('#main-content h1'), 'late title: the title', 8000);
      await pressed('late title');
      const seal = doc.querySelector('.lens-ink-seal');
      check(patched && early, `late title: the title came after the arrival (${patched}, ${early})`);
      check(seal && seal.style.display !== 'none' && seal.classList.contains('is-stamped') && win.getComputedStyle(seal).opacity === '1', 'late title: the seal is pressed once the title is there');
      escape(); await idle();
      sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
    }

    /* 11. Graphics: the colour-coded fills of a figure stay apart in tone, and a figure's white
       strip on a grey ground is paper (not a band of ink). The original pixels of each colour
       are found in the helper's own drawing of the image; the painting is read there. */
    for (const [path, name, colours, rule] of [
      ['/blogs/agents-that-learn-after-deployment.html', 'self-modification-levels', { human: [239, 239, 239], fixed: [224, 237, 249], recursive: [253, 244, 218], white: [255, 255, 255] }, 'apart'],
      ['/papers/auditing-health-llms.html', 'auditing-health-llms-access', { white: [255, 255, 255], api: [222, 232, 250], health: [217, 234, 211], chatgpt: [235, 232, 243], provider: [217, 217, 217] }, 'routes'],
      ['/papers/godel-agent.html', 'godel-agent-overview', { white: [255, 255, 255], panel: [237, 237, 237] }, 'paper']
    ]) {
      await load(path);
      await core();
      const img = [...doc.querySelectorAll('#main-content img')].find(el => (el.currentSrc || el.src).includes(name));
      if (!img) { check(false, `${name}: the figure is on ${path}`); continue; }
      img.scrollIntoView({ block: 'center' }); await delay(300);
      await enterInk(name);
      await mediaSettled(name);
      const overlay = ink()._state.media.overlays.find(o => o.img === img);
      check(!!overlay && overlay.kind === 'graphic', `${name}: the figure is painted as a drawing`);
      if (overlay) {
        const cv = overlay.canvas; const r = img.getBoundingClientRect();
        const drawn = win.SiteLensesMedia.draw(img, r.width, r.height, cv.width / r.width, 'fill', '#ffffff');
        const sd = drawn.getContext('2d').getImageData(0, 0, drawn.width, drawn.height).data;
        const pd = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
        const tone = {};
        for (const [key, c] of Object.entries(colours)) {
          const values = [];
          for (let i = 0; i < sd.length && i < pd.length; i += 12) if (Math.abs(sd[i] - c[0]) <= 2 && Math.abs(sd[i + 1] - c[1]) <= 2 && Math.abs(sd[i + 2] - c[2]) <= 2) values.push(pd[i]);
          tone[key] = values.length > 50 ? quantile(values, 0.5) : null;
        }
        report.figures[name] = tone;
        if (rule === 'apart') {
          const fills = [tone.recursive, tone.human, tone.fixed];
          check(fills.every(v => v !== null) && fills[0] - fills[1] >= 12 && fills[1] - fills[2] >= 12 && tone.white - fills[0] >= 12,
            `${name}: the yellow, grey and blue fills (and the paper) stay apart by 12 levels or more (${tone.white} / ${fills.join(' / ')})`);
        } else if (rule === 'routes') {
          // The legend codes provider-managed parts grey (217): the pale route columns (API blue,
          // Health green, ChatGPT lavender) must stay lighter than those grey bars.
          const routes = [tone.api, tone.health, tone.chatgpt];
          check(routes.every(v => v !== null) && tone.provider !== null && tone.api - tone.provider >= 15 && tone.health - tone.provider >= 15 && tone.chatgpt - tone.provider >= 15,
            `${name}: the route tints stay 15 levels or more lighter than the grey provider bars (API ${tone.api}, Health ${tone.health}, ChatGPT ${tone.chatgpt}, provider ${tone.provider})`);
          check(tone.white > Math.max(...routes) + 10, `${name}: the white boxes stay paper above the tints (${tone.white})`);
        } else {
          check(tone.white !== null && tone.panel !== null && Math.abs(tone.white - tone.panel) <= 4 && tone.white >= 235, `${name}: white and the grey ground are both paper (${tone.white}, ${tone.panel})`);
        }
      }
      await leave();
    }

    /* 12. The skip link (shown on focus) on a site-shell page: paper letters on cinnabar, light
       and dark theme. */
    for (const theme of ['light', 'dark']) {
      await load('/publications.html', { theme });
      await core();
      await enterInk(`skip link ${theme}`);
      const link = doc.querySelector('#site-nav .skip-link, .skip-link');
      if (!link) { check(false, 'skip link: present'); await leave(); continue; }
      link.focus();
      const s = win.getComputedStyle(link);
      const lum = c => { const v = rgb(c).slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const a = lum(s.color); const b = lum(s.backgroundColor);
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      check(contrast >= 4.5, `skip link ${theme}: legible on focus (${s.color} on ${s.backgroundColor}, contrast ${contrast.toFixed(2)})`);
      link.blur();
      await leave();
    }

    /* 13. The back-to-top button (in the footer) keeps its fill of paper, so text and paintings
       do not show through it, and its own fade; the footer's icons keep their transitions. */
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const label = `back-to-top ${width}`;
      await load('/', { width, height });
      await core();
      const button = doc.querySelector('.back-to-top');
      const icon = doc.querySelector('.footer-social a');
      const own = el => (el ? win.getComputedStyle(el).transitionProperty : '');
      const before = { button: own(button), icon: own(icon) };
      await enterInk(label);
      win.scrollTo({ top: 700, behavior: 'instant' }); await delay(500);
      if (!button) { check(false, `${label}: the button is there`); await leave(); continue; }
      const bs = win.getComputedStyle(button); const fill = rgb(bs.backgroundColor);
      check(near(bs.backgroundColor, PAPER) && (fill.length < 4 || fill[3] === 1), `${label}: the button is a square of paper (${bs.backgroundColor})`);
      check(/opacity/.test(bs.transitionProperty) && /visibility/.test(bs.transitionProperty), `${label}: the button keeps its fade (${bs.transitionProperty}; was ${before.button})`);
      if (icon) check(/opacity/.test(own(icon)), `${label}: the footer's icons keep their transitions (${own(icon)}; was ${before.icon})`);
      win.scrollTo({ top: 0, behavior: 'instant' }); await delay(100);
      await leave();
    }

    /* 14. The dark theme: while the page whitens (before the switch) the caption has no halo;
       after it, the core's halo returns. */
    {
      await load('/publications.html', { theme: 'dark' });
      await core();
      const going = (await core())._debug.goto('ink');
      await until(() => doc.querySelector('.lenses-caption') && doc.documentElement.classList.contains('lens-ink-pending'), 'dark whiten: the caption while the page whitens', 4000).catch(() => {});
      const caption = doc.querySelector('.lenses-caption');
      const during = caption ? win.getComputedStyle(caption).getPropertyValue('--lenses-caption-ground').trim() : null;
      check(doc.documentElement.classList.contains('lens-ink-pending') && during === 'transparent', `dark whiten: no caption halo while the page whitens (${during})`);
      await going;
      const after = doc.querySelector('.lenses-caption');
      check(!after || win.getComputedStyle(after).getPropertyValue('--lenses-caption-ground').trim() === '', 'dark whiten: after the switch the caption has its halo again');
      await leave();
    }

    /* 15. An exit during the whitening (the style not switched yet) fades the veil from where
       it is, with no frame of full paper. */
    for (const at of [110, 190]) {
      const label = `exit while whitening (${at} ms)`;
      await load('/', { theme: 'dark' });
      await core();
      await enterInk(`${label} warm-up`); await leave();
      const base = snapshot();
      const going = (await core())._debug.goto('ink');
      const veilOpacity = () => { const v = doc.querySelector('.lens-ink-veil'); return v ? +win.getComputedStyle(v).opacity : 0; };
      const stop = everyFrame(() => [performance.now(), veilOpacity()]);
      await delay(at);
      const applied = ink()._state && ink()._state.applied;
      const from = veilOpacity();
      const t0 = performance.now();
      escape();
      await going; await idle();
      const after = stop().filter(([t]) => t >= t0).map(([, v]) => v);
      const peak = Math.max(0, ...after);
      report.budget[label] = { from: +from.toFixed(2), peak: +peak.toFixed(2), applied };
      check(!applied && peak <= from + 0.1, `${label}: the veil fades from where it was (${from.toFixed(2)}, at most ${peak.toFixed(2)} after the Esc)`);
      await nextPaint(); await nextPaint();
      compare(base, `${label} after exit`);
    }

    /* 16. An instant reset while the exit's wash waits for frames in a hidden tab (the frame
       loop pauses; pagehide resets at once): the exit ends and the activation is let go. */
    {
      await load('/photography.html');
      await core();
      let hidden = false;
      Object.defineProperty(doc, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
      await enterInk('paused exit');
      await delay(400);
      const leaving = lenses().reset();
      await delay(150);
      hidden = true; doc.dispatchEvent(new win.Event('visibilitychange'));
      await delay(100);
      win.dispatchEvent(new win.PageTransitionEvent('pagehide', { persisted: false }));
      await idle(); await leaving;
      await delay(1500);
      hidden = false; doc.dispatchEvent(new win.Event('visibilitychange'));
      await delay(600);
      const st = ink()._state;
      check(st === null && ink()._sheet === null, `paused exit: the activation is let go (state ${st ? 'kept' : 'null'}, sheet ${ink()._sheet ? 'kept' : 'null'})`);
      check(!/(^| )lens-ink/.test(doc.documentElement.className) && !doc.querySelector('.lenses-layer, .lens-ink-seal, .lens-ink-veil'), `paused exit: no lens class, layer or seal is left (${doc.documentElement.className})`);
    }

    /* 17. A figure in a phone's horizontal scroller: once the scroller rests after a scroll, its
       painting lies on the page's paper again (with a control: held, the measure sees it stray). */
    {
      await load(LONGEST_PAPER, { width: 390, height: 844 });
      await core();
      const scroller = [...doc.querySelectorAll('#main-content .au-figure-scroll, #main-content .figure-scroll')].find(el => el.scrollWidth > el.clientWidth + 20 && el.querySelector('img'));
      if (!scroller) check(false, 'scroller: a figure scroller on the longest paper at 390');
      else {
        scroller.scrollIntoView({ block: 'center', behavior: 'instant' }); await delay(300);
        await enterInk('scroller');
        const st = ink()._state;
        await until(() => st.media && st.media.overlays.some(o => scroller.contains(o.img)), 'scroller: its painting', 8000).catch(() => {});
        await mediaSettled('scroller'); await delay(300);
        const painting = () => st.media.overlays.find(o => scroller.contains(o.img));
        const before = painting() ? paperMismatch(painting()) : null;
        st.realigning = true;                            // the control: held
        scroller.scrollLeft = 150; await delay(500);
        const held = painting() ? paperMismatch(painting()) : null;
        st.realigning = false;
        scroller.scrollLeft = 170; await delay(900);
        const after = painting() ? paperMismatch(painting()) : null;
        report.budget.scroller = { before, held, after };
        check(before !== null && held !== null && held > before + 1, `scroller: held, the scrolled painting no longer matches its paper (${before && before.toFixed(2)} -> ${held && held.toFixed(2)} levels)`);
        check(after !== null && after < before + 0.6, `scroller: once the scroller rests, the painting lies on the page's paper again (${after && after.toFixed(2)} vs ${before && before.toFixed(2)} levels)`);
        await leave();
      }
    }
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens);
    if (storedGround === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedGround);
  }
  /* 9. No uncaught errors or console.error calls; no warning from the ink lens. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  assertions++;
  const inkWarnings = warnings.filter(w => /"ink"|ink\./.test(w));
  if (inkWarnings.length) failures.push(`Warnings from the ink lens: ${inkWarnings.slice(0, 6).join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
