/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes about two minutes: tests/run_easter_suites.sh lens_acta starts it as a
 * background promise and polls for it.
 * Tests Lens IV, Acta Eruditorum (easter/lenses/acta.js): on the homepage, the band enters
 * and leaves, the caption shows once, after the band (never on the page before the switch nor
 * during the band; on photography too, where the band waits for the plates), the portrait
 * keeps its oval engraving (no plate is laid over it), links stay
 * clickable, no frame callback runs once settled, and the page is restored byte for byte; on
 * photography.html every photo near the viewport becomes a plate laid exactly over its
 * content box (an opaque engraving in ink on paper, with a thick outer and a thin inner
 * rule), every photograph is hidden under a blank plate (below its plate) while the style is
 * on, a photo that cannot become a plate (a broken one, added for the test) is released to
 * its sepia plate, in the fallback serif the title and nav are small capitals, the photos stay
 * clickable and the lightbox opens above the plates as a page of the book (on the sheet, its
 * photograph hidden, its blank plate on the sheet within the first frames, then engraved as a
 * plate above it; next and previous drop the plate before at once and stand the next blank in
 * its place; closing it removes its plate),
 * scrolling the page holds no frame up over 50 ms (long animation frames, with the scripts that ran in
 * them; plain long tasks are reported) and the engraving's slices stay short, and the exit removes
 * every plate; the plates and blanks are hidden whenever the Acta style is off; the app
 * screenshots of projects.html stay sepia thumbnails (no plate); a blog post's images are
 * printed through the print matrix (also inside its transformed wide figure); on a paper page the
 * figures (graphics) keep the sepia plate of acta.css and get no overlay; on the longest
 * paper page reading costs no long task and the frame budget holds; a page opened with the
 * lens stored in sessionStorage (dark site theme, 390 x 844) arrives silently and quickly,
 * shows no photograph at any moment (only blanks, then plates inked in on them), has no
 * horizontal overflow, and Esc restores it exactly; under reduced motion the switch is
 * immediate both ways, with no band and no inking; on a phone the caption sits above
 * photography's title clear of the nav, the lightbox's arrows stay visible over its plate;
 * on a paper page (1440, 390, 320) and a blog post (390, 320) the caption sits above the
 * title, clear of the eyebrow (kicker) and the title's capitals (not at the viewport's foot
 * over the text); arriving without a paper tile kept for the session settles within 350 ms
 * and lays the tile once made; arriving with the fonts held back 900 ms settles within
 * 350 ms in the fallback serif with small capitals, and IM Fell is swapped in when it comes
 * unless the reader has touched the page; a lightbox opened while the caption shows hides
 * it; leaving with the lightbox open gives the site's own lightbox back at once.
 * Prints assertions, failures, enter and exit times, plate statistics and long tasks.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  // The first frame painted after now (a blank placed by a ResizeObserver before that paint is there).
  const painted = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())));
  const channel = new MessageChannel();
  const yieldNow = () => new Promise(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
  const until = async (predicate, label = 'condition', limit = 15000) => {
    const began = performance.now();
    while (performance.now() - began < limit) { if (predicate()) return; await delay(10); }
    throw new Error(`Timed out waiting for ${label}.`);
  };

  const PAPER = [242, 232, 211];     // #f2e8d3, the lens's ground
  // The photographs expected to become plates (acta.js EXPECT_SELECT).
  const EXPECT = '#main-content img[src*="photos/"]:not(.profile-photo, [src*="project-demo/"])';
  const INK = [42, 29, 18];          // #2a1d12
  const LONGEST_PAPER = '/papers/auditing-health-llms.html';
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = [sessionStorage.getItem('lenses-active'), sessionStorage.getItem('lenses-ground')];
  localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  const errors = []; const warnings = [];
  const report = { enterMs: {}, exitMs: {}, plates: {}, stats: null, arriveMs: null, longTasks: {}, frameBudget: null };
  let doc; let win; let reduced = false; let longTasks = []; let frames = [];

  // Opens a page in the frame. With `core`, loads the lenses core as a trigger would; without
  // it, the page's own boot brings the core (an arrival with the stored lens).
  // `early(win)` runs on the new window as soon as it exists, before the page's scripts.
  const load = async (path, { width = 1440, height = 900, theme = 'light', core = true, lens = null, early = null } = {}) => {
    localStorage.setItem('theme', theme);
    if (lens) { sessionStorage.setItem('lenses-active', lens); sessionStorage.setItem('lenses-ground', '#f2e8d3'); }
    else { sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground'); }
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:200000;border:0;background:white`;
    const old = frame.contentDocument;
    const onload = new Promise(resolve => { frame.onload = resolve; });
    frame.src = `${path}${path.includes('?') ? '&' : '?'}r=${Math.random().toString(36).slice(2)}`;
    if (early) {
      const began = performance.now();
      for (;;) {
        const d = frame.contentDocument;
        if (d && d !== old && d.documentElement && frame.contentWindow.location.href !== 'about:blank') { early(frame.contentWindow); break; }
        if (performance.now() - began > 10000) throw new Error(`${path} did not open`);
        await yieldNow();
      }
    }
    await onload;
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.readyState === 'complete' && doc.getElementById('main-content') && win.SiteLensesBoot, `${path}: the page and the boot`);
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
    const consoleWarn = win.console.warn.bind(win.console);
    win.console.warn = (...args) => { warnings.push(`${path}: ${args.map(String).join(' ')}`); consoleWarn(...args); };
    longTasks = []; frames = [];
    try {
      new win.PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push({ at: entry.startTime, ms: Math.round(entry.duration) })))
        .observe({ type: 'longtask', buffered: true });
    } catch (error) { /* long tasks are not observable here */ }
    // Long animation frames name the scripts that ran in them (for the report).
    try {
      new win.PerformanceObserver(list => list.getEntries().forEach(entry => frames.push({ at: entry.startTime, ms: Math.round(entry.duration),
        scripts: entry.scripts.map(sc => `${(sc.sourceURL || '').split('/').pop()} ${sc.sourceFunctionName || sc.invoker} ${Math.round(sc.duration)} ms`) })))
        .observe({ type: 'long-animation-frame', buffered: true });
    } catch (error) { /* not observable here */ }
    if (core) {
      // Reduced motion is simulated through matchMedia, before the core reads it.
      const match = win.matchMedia.bind(win);
      win.matchMedia = query => {
        const result = match(query);
        if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { get: () => reduced });
        return result;
      };
      await settled();
      await win.SiteLensesBoot.loadCore();
    }
  };
  // The page's own late content (markdown, star counts) settles first.
  const settled = async () => {
    let last = ''; let since = performance.now();
    await until(() => {
      const now = doc.getElementById('main-content').innerHTML;
      if (now !== last) { last = now; since = performance.now(); }
      return performance.now() - since > 500;
    }, 'the page to settle', 10000);
  };
  const lenses = () => win.SiteLenses;
  const state = () => win.SiteLenses._debug.state;
  const acta = () => win.SiteLenses._debug.lens('acta');
  const html = () => doc.documentElement;
  const go = async id => { const began = performance.now(); await lenses()._debug.goto(id); return Math.round(performance.now() - began); };
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const ours = el => /easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '');
  const snapshot = () => ({
    main: doc.getElementById('main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlAttrs: [...html().attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    headKids: [...doc.head.children].filter(el => !ours(el)).map(el => el.outerHTML).join('\n'),
    scroll: Math.round(win.scrollY)
  });
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return ` at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const compare = (before, label) => {
    const now = snapshot();
    for (const key of ['main', 'nav', 'footer', 'htmlAttrs', 'bodyAttrs', 'bodyKids', 'headKids']) {
      check(now[key] === before[key], `${label}: ${key} restored byte for byte${firstDiff(String(before[key]), String(now[key]))}`);
    }
    check(now.scroll === before.scroll, `${label}: the scroll position is unchanged (${before.scroll} → ${now.scroll})`);
    check(!doc.querySelector('.lenses-layer, .lenses-media, .lens-acta-engraving, .lenses-caption'), `${label}: no layer, plate, engraving or caption is left`);
    check(![...doc.styleSheets].some(s => (s.href || '').includes('easter/lenses/acta.css')), `${label}: the lens stylesheet is gone`);
  };
  const clickable = label => {
    const links = [...doc.querySelectorAll('#main-content a[href], #site-nav a[href], body > header.site-header a[href]')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top > 0 && r.bottom < win.innerHeight && r.left > 0 && r.right < win.innerWidth;
    }).slice(0, 4);
    check(links.length > 0, `${label}: a link is in view`);
    for (const link of links) {
      const at = centre(link); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === link, `${label}: the link "${link.textContent.trim().slice(0, 30)}" is clickable (hit ${hit && hit.tagName})`);
    }
  };
  const idleFrames = async label => {
    await delay(400);
    check(state().frames === 0 && !state().raf, `${label}: no frame callback runs once settled (${state().frames} registered)`);
  };

  /* Plates ---------------------------------------------------------------------------- */
  const loaded = img => img.complete && img.naturalWidth > 0;
  const contentBox = img => {
    const r = img.getBoundingClientRect(); const s = win.getComputedStyle(img); const px = n => parseFloat(s[n]) || 0;
    return { left: r.left + px('borderLeftWidth') + px('paddingLeft'), top: r.top + px('borderTopWidth') + px('paddingTop'),
      right: r.right - px('borderRightWidth') - px('paddingRight'), bottom: r.bottom - px('borderBottomWidth') - px('paddingBottom') };
  };
  // The photos the media helper engraves now: loaded, rendered, 24 px or more, outside a fixed
  // box, within 1.5 screens of the viewport (its NEAR_MARGIN).
  const nearPhotos = () => [...doc.querySelectorAll('#main-content .photo-item img')].filter(img => {
    if (!loaded(img) || !img.getClientRects().length) return false;
    const r = img.getBoundingClientRect();
    return r.width >= 24 && r.height >= 24 && r.bottom > -1.5 * win.innerHeight + 2 && r.top < 2.5 * win.innerHeight - 2;
  });
  const plates = () => [...doc.querySelectorAll('.lenses-media')];
  // The plates the press made before the helper asked for them, on their blanks.
  const prints = () => [...doc.querySelectorAll('.lens-acta-blank > canvas.lens-acta-print')];
  // Every canvas that played the ink-in fade (lens-acta-ink) since the frame's page loaded:
  // a print is inked in on its blank and keeps its place in the fade when the helper takes it.
  const inked = () => (win.__inked || new Set());
  const recordInk = () => {
    win.__inked = new Set();
    doc.addEventListener('animationstart', event => { if (event.animationName === 'lens-acta-ink') win.__inked.add(event.target); }, true);
  };
  // From now until stop(): the caption's shown samples, by when they came: before the Acta style
  // is on, during the band, after it.
  const watchCaption = () => {
    let stop = false; const seen = { before: 0, band: 0, after: 0, samples: 0 };
    (async () => {
      while (!stop) {
        const cap = doc.querySelector('.lenses-caption');
        seen.samples++;
        if (cap && +win.getComputedStyle(cap).opacity > 0.02) {
          if (!html().classList.contains('lens-acta')) seen.before++;
          else if (html().classList.contains('lens-acta-vt-in')) seen.band++;
          else seen.after++;
        }
        await delay(8);
      }
    })();
    return () => { stop = true; return seen; };
  };
  // Each plate's image (by its content box), and how far the plate is from it.
  const placement = () => {
    const images = [...doc.querySelectorAll('#main-content img')];
    return plates().map(canvas => {
      const c = canvas.getBoundingClientRect();
      let best = Infinity; let img = null;
      for (const candidate of images) {
        const b = contentBox(candidate);
        const off = Math.max(Math.abs(b.left - c.left), Math.abs(b.top - c.top), Math.abs(b.right - c.right), Math.abs(b.bottom - c.bottom));
        if (off < best) { best = off; img = candidate; }
      }
      return { canvas, img, off: best };
    });
  };
  const checkPlacement = label => {
    const placed = placement();
    const near = nearPhotos();
    const worst = Math.max(0, ...placed.map(p => p.off));
    check(placed.length > 0 && worst <= 1, `${label}: every plate lies on its photo's content box (worst ${worst.toFixed(2)} px over ${placed.length})`);
    check(near.every(img => placed.some(p => p.img === img)), `${label}: every photo near the viewport has its plate (${placed.length} plates, ${near.length} photos near)`);
    check(placed.every(p => p.canvas.dataset.kind === 'photo' && p.canvas.getAttribute('aria-hidden') === 'true' && win.getComputedStyle(p.canvas).pointerEvents === 'none'),
      `${label}: the plates are photos, hidden from assistive technology and never take the pointer`);
    return placed;
  };
  // Blank plates: every photograph to be engraved is hidden while the style is on, and each one
  // that is shown (loaded, rendered) has a blank on its content box, below the plates' layer.
  const expected = () => [...doc.querySelectorAll(EXPECT)];
  const blanks = () => [...doc.querySelectorAll('.lens-acta-blank')];
  const checkBlanks = label => {
    const shown = expected().filter(img => img.getClientRects().length && img.getBoundingClientRect().height > 0);
    check(expected().length > 0 && expected().every(img => win.getComputedStyle(img).opacity === '0'),
      `${label}: every photograph to be engraved is hidden while the style is on (${expected().filter(img => win.getComputedStyle(img).opacity !== '0').length} of ${expected().length} shown)`);
    const boxes = blanks().map(b => b.getBoundingClientRect());
    const offBy = img => { const c = contentBox(img); return Math.min(Infinity, ...boxes.map(b => Math.max(Math.abs(b.left - c.left), Math.abs(b.top - c.top), Math.abs(b.right - c.right), Math.abs(b.bottom - c.bottom)))); };
    const worst = Math.max(0, ...shown.map(offBy));
    check(shown.length > 0 && boxes.length === shown.length && worst <= 1, `${label}: a blank plate on every shown photograph (${boxes.length} blanks for ${shown.length} photos, worst ${worst.toFixed(2)} px)`);
    const blankLayer = blanks().length ? blanks()[0].closest('.lenses-layer') : null;
    const mediaLayer = doc.querySelector('.lenses-media-layer');
    check(blankLayer && mediaLayer && blankLayer !== mediaLayer && (blankLayer.compareDocumentPosition(mediaLayer) & 4) && blanks().every(b => b.getAttribute('aria-hidden') === 'true'),
      `${label}: the blanks lie below the plates and are hidden from assistive technology`);
  };
  // From now until stop(): samples, every few ms, whether a photograph to be engraved is seen
  // as a photograph (loaded, in view, not hidden) while the Acta style shows.
  const watchPhotographs = () => {
    let stop = false; const seen = { samples: 0, shown: 0, at: [] };
    (async () => {
      while (!stop) {
        const d = frame.contentDocument; const w = frame.contentWindow;
        if (d && d.documentElement && w && d.getElementById('main-content') && d.documentElement.classList.contains('lens-acta') && !d.documentElement.hasAttribute('data-lens-arriving')) {
          seen.samples++;
          const bare = [...d.querySelectorAll(EXPECT)].filter(img => {
            const r = img.getBoundingClientRect();
            return img.complete && img.naturalWidth > 0 && r.height > 1 && r.bottom > 0 && r.top < w.innerHeight && w.getComputedStyle(img).opacity !== '0';
          });
          if (bare.length) { seen.shown++; if (seen.at.length < 4) seen.at.push(`${Math.round(w.performance.now())} ms: ${bare.length}`); }
        }
        await delay(8);
      }
    })();
    return () => { stop = true; return seen; };
  };
  const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // The lightbox (photography.html, a fixed box outside the scope): its plates live in the
  // helper's fixed layer. visible: only those shown (a plate of the photograph before is
  // hidden while the next one is engraved).
  const lightboxPlates = (all = false) => [...doc.querySelectorAll('.lenses-media-fixed canvas.lenses-media')]
    .filter(c => all || win.getComputedStyle(c).visibility !== 'hidden');
  const offBox = (canvas, img) => {
    const c = canvas.getBoundingClientRect(); const b = contentBox(img);
    return Math.max(Math.abs(b.left - c.left), Math.abs(b.top - c.top), Math.abs(b.right - c.right), Math.abs(b.bottom - c.bottom));
  };
  // The open lightbox as a page of the book: the sheet behind it, its photograph hidden and
  // engraved as a plate on it (above the lightbox, inked in, ink on paper with the double
  // rule); next and previous: the plate of the photograph before goes at once (a blank sheet
  // until the next is inked in), and each photograph gets its own plate.
  // The lightbox's blank plate: the first layer of its background, an SVG image laid on the
  // photograph's content box (off: the worst edge, in css px; null without a blank).
  const lightboxBlank = () => {
    const box = doc.getElementById('lightbox'); const big = doc.getElementById('lightbox-img');
    const s = win.getComputedStyle(box);
    if (!/^url\("data:image\/svg\+xml/.test(s.backgroundImage)) return null;
    const [x, y] = s.backgroundPosition.split(',')[0].trim().split(/\s+/).map(parseFloat);
    const [w, h] = s.backgroundSize.split(',')[0].trim().split(/\s+/).map(parseFloat);
    const b = box.getBoundingClientRect(); const c = contentBox(big);
    return { off: Math.max(Math.abs(b.left + x - c.left), Math.abs(b.top + y - c.top), Math.abs(b.left + x + w - c.right), Math.abs(b.top + y + h - c.bottom)) };
  };
  const checkLightbox = async label => {
    const box = doc.getElementById('lightbox'); const big = doc.getElementById('lightbox-img');
    const since = win.performance.now();
    check(win.getComputedStyle(box).backgroundColor === `rgb(${PAPER.join(', ')})`, `${label}: the lightbox lies on the sheet (${win.getComputedStyle(box).backgroundColor})`);
    check(win.getComputedStyle(big).opacity === '0', `${label}: its photograph is hidden while the style is on`);
    await until(() => lightboxPlates().length === 1 && offBox(lightboxPlates()[0], big) <= 1, `${label}: its plate`, 8000).catch(() => {});
    let plate = lightboxPlates()[0];
    const layer = plate ? plate.closest('.lenses-media-fixed') : null;
    check(lightboxPlates().length === 1 && offBox(plate, big) <= 1, `${label}: its photograph becomes a plate on it (${lightboxPlates().length} plates, off by ${plate ? offBox(plate, big).toFixed(2) : '-'} px)`);
    check(layer && +win.getComputedStyle(layer).zIndex > +win.getComputedStyle(box).zIndex, `${label}: the plate lies above the lightbox`);
    check(plate && plate.dataset.kind === 'photo' && (plate.classList.contains('lens-acta-inking') || inked().has(plate)), `${label}: the plate is inked in`);
    if (plate) checkPixels(plate, label);
    for (const id of ['lightbox-next', 'lightbox-prev']) {
      const was = plate;
      doc.getElementById(id).click();
      await delay(0);
      check(!lightboxPlates().length, `${label}, ${id}: the plate of the photograph before goes at once (${lightboxPlates().length} shown)`);
      await painted();
      const blank = lightboxBlank();
      check(blank && blank.off <= 1, `${label}, ${id}: the next photograph's blank plate stands on the sheet at once (off by ${blank ? blank.off.toFixed(2) : '-'} px)`);
      await until(() => lightboxPlates().length === 1 && lightboxPlates()[0] !== was && offBox(lightboxPlates()[0], big) <= 1, `${label}, ${id}: the next plate`, 8000).catch(() => {});
      plate = lightboxPlates()[0];
      check(lightboxPlates().length === 1 && plate !== was && offBox(plate, big) <= 1, `${label}, ${id}: the next photograph gets its own plate (${lightboxPlates().length} shown)`);
    }
    // The lightbox's plates are the largest (up to the helper's 1.6 MP): still sliced.
    const held = frames.filter(f => f.at >= since && f.ms > 50 && f.scripts.some(sc => /acta|media/.test(sc)));
    check(!held.length, `${label}: no lens script holds a frame up over 50 ms while its plates are made (${held.map(f => `${f.ms} ms [${f.scripts.join('; ')}]`).join(', ')})`);
    const st = acta()._stats;
    report.lightboxStats = st;
    check(st.longSlices <= Math.max(1, 0.05 * st.slices) && st.maxSliceMs < 50, `${label}: the engraving's slices stay short (${st.longSlices} of ${st.slices} over 8 ms, longest ${st.maxSliceMs} ms)`);
  };
  // The plate's pixels: opaque, every colour on the line from ink to paper (no colour of the
  // photo is left), both ink and paper present, the thick outer rule along every edge and the
  // thin inner rule inside it with paper between them.
  const checkPixels = (canvas, label) => {
    const g = canvas.getContext('2d');
    const { width: W, height: H } = canvas;
    const data = g.getImageData(0, 0, W, H).data;
    let opaque = true; let offLine = 0; let ink = 0; let paper = 0; let samples = 0;
    const span = INK.map((c, i) => PAPER[i] - c);
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        const i = (y * W + x) * 4;
        if (data[i + 3] !== 255) opaque = false;
        // The nearest point on the ink-paper line (the paper's own fibres vary it a little).
        const t = Math.max(0, Math.min(1.05, ((data[i] - INK[0]) * span[0] + (data[i + 1] - INK[1]) * span[1] + (data[i + 2] - INK[2]) * span[2]) / span.reduce((s, v) => s + v * v, 0)));
        const d = Math.hypot(...[0, 1, 2].map(c => data[i + c] - (INK[c] + span[c] * t)));
        if (d > 18) offLine++;
        const l = lum(data[i], data[i + 1], data[i + 2]);
        if (l < 0.35) ink++; else if (l > 0.75) paper++;
        samples++;
      }
    }
    check(opaque, `${label}: the plate is opaque (it covers the photo)`);
    check(offLine / samples < 0.01, `${label}: the plate is printed in ink on paper only (${(100 * offLine / samples).toFixed(2)} % of points off the ink–paper line)`);
    check(ink / samples > 0.03 && paper / samples > 0.03, `${label}: the plate holds both ink and bare paper (${(100 * ink / samples).toFixed(1)} % ink, ${(100 * paper / samples).toFixed(1)} % paper)`);
    // The rules, read along the middle of each edge.
    const k = canvas.width / canvas.getBoundingClientRect().width;
    const at = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return lum(data[i], data[i + 1], data[i + 2]); };
    const edges = [[0, H / 2], [W - 1, H / 2], [W / 2, 0], [W / 2, H - 1]];
    check(edges.every(([x, y]) => at(x, y) < 0.35), `${label}: the outer rule runs along every edge (${edges.map(([x, y]) => at(x, y).toFixed(2)).join(', ')})`);
    // From the left edge inwards at mid-height: the outer rule, paper, the inner rule.
    const row = [...Array(Math.round(7 * k))].map((_, x) => at(x, H / 2));
    const gap = row.findIndex((v, x) => x > 0 && v > 0.7);
    const inner = gap < 0 ? -1 : row.findIndex((v, x) => x > gap && v < row[gap] - 0.12);
    check(gap > 0 && inner > gap, `${label}: a thin inner rule lies inside the outer one, with paper between (${row.map(v => v.toFixed(2)).join(' ')})`);
  };

  try {
    /* 1. The homepage: the band in and out, the portrait, links, idle frames, restoration. */
    await load('/');
    let before = snapshot();
    // The caption shows once, after the band, beside the name as Acta sets it: never on the
    // page before the switch, nor during the band.
    const began = performance.now();
    let captionSeen = watchCaption();
    const entering = go('acta');
    await until(() => html().classList.contains('lens-acta') && html().classList.contains('lens-acta-vt-in'), 'the band', 8000).catch(() => {});
    check(html().classList.contains('lens-acta-vt-in'), 'home: the band runs');
    await entering;
    report.enterMs.home = Math.round(performance.now() - began);
    await delay(600);
    let capSeen = captionSeen();
    report.captionHome = capSeen;
    check(capSeen.before === 0 && capSeen.band === 0 && capSeen.after > 0, `home: the caption shows once, after the band (shown samples before the switch ${capSeen.before}, during the band ${capSeen.band}, after ${capSeen.after})`);
    const shownCap = doc.querySelector('.lenses-caption');
    if (shownCap) {
      const c = shownCap.getBoundingClientRect();
      const range = doc.createRange(); range.selectNodeContents(doc.querySelector('#main-content .profile-text .name'));
      const clear = [...range.getClientRects()].every(r => r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom);
      check(win.getComputedStyle(shownCap).opacity === '1' && clear, `home: after the band the caption shows beside the name, clear of it (${shownCap.className})`);
    } else check(false, 'home: the caption shows after the band');
    check(lenses().current === 'acta', `home: Acta is the lens (${lenses().current})`);
    check(['lens-acta', 'lens-acta-home', 'lens-acta-shell'].every(c => html().classList.contains(c)), 'home: the Acta style is on');
    const photo = doc.querySelector('#main-content .profile-photo');
    const engraving = doc.querySelector('.lens-acta-engraving');
    const a = photo.getBoundingClientRect(); const b = engraving ? engraving.getBoundingClientRect() : null;
    check(b && Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) <= 1, 'home: the engraved portrait lies on the photo');
    check(win.getComputedStyle(photo).visibility === 'hidden', 'home: the photo gives way to its engraving');
    await delay(800);
    check(plates().length === 0, `home: the portrait keeps its own oval engraving (no plate over it; ${plates().length} plates)`);
    clickable('home');
    await idleFrames('home');
    report.exitMs.home = await go(null);
    compare(before, 'home after the exit');

    /* 2. Photography: plates on every photo near the viewport, pixels, the lightbox, scrolling. */
    await load('/photography.html');
    recordInk();
    before = snapshot();
    captionSeen = watchCaption();
    report.enterMs.photography = await go('acta');
    await delay(600);
    capSeen = captionSeen();
    report.captionPhotography = capSeen;
    check(capSeen.before === 0 && capSeen.band === 0 && capSeen.after > 0, `photography: the caption shows once, after the band (shown samples before the switch ${capSeen.before}, during the band ${capSeen.band}, after ${capSeen.after})`);
    await until(() => nearPhotos().every(img => placement().some(p => p.img === img && p.off <= 1)), 'the plates near the viewport', 15000).catch(() => {});
    let placed = checkPlacement('photography');
    report.plates.photography = placed.length;
    if (placed.length) checkPixels(placed[0].canvas, 'photography');
    const layer = placed.length ? placed[0].canvas.closest('.lenses-media-layer') : null;
    check(layer && win.getComputedStyle(layer).visibility === 'visible', 'photography: the plates show while the Acta style is on');
    checkBlanks('photography');
    const vignette = doc.querySelector('.lens-acta-vignette');
    check(vignette && +win.getComputedStyle(vignette.closest('.lenses-layer')).zIndex > +win.getComputedStyle(layer).zIndex, 'photography: the vignette lies over the plates, as over the paper');
    html().classList.remove('lens-acta');
    check(layer && win.getComputedStyle(layer).visibility === 'hidden', 'photography: the plates hide when the Acta style is off (the band shows the page without them)');
    check(blanks().every(b => win.getComputedStyle(b).visibility === 'hidden') && expected().every(img => win.getComputedStyle(img).opacity === '1'),
      'photography: with the Acta style off the blanks hide and the photographs show');
    html().classList.add('lens-acta');
    // A photograph that cannot become a plate (a broken one, added for the test and removed
    // again) is released: it shows (here, its broken box) instead of a blank that never fills.
    const ghost = doc.createElement('img');
    ghost.src = 'photos/lens-acta-test-missing.jpg'; ghost.alt = ''; ghost.style.cssText = 'display:block;width:200px;height:120px';
    doc.getElementById('main-content').append(ghost);
    await until(() => ghost.complete, 'the broken photo to fail', 5000).catch(() => {});
    await delay(900);
    const ghostBox = contentBox(ghost);
    check(win.getComputedStyle(ghost).opacity === '1' && !blanks().some(b => { const r = b.getBoundingClientRect(); return Math.abs(r.left - ghostBox.left) < 1 && Math.abs(r.top - ghostBox.top) < 1; }),
      `photography: a photograph that cannot become a plate is released (opacity ${win.getComputedStyle(ghost).opacity})`);
    check(expected().filter(img => img !== ghost).every(img => win.getComputedStyle(img).opacity === '0'), 'photography: releasing one photograph leaves the others hidden');
    ghost.remove();
    await delay(400);
    clickable('photography');
    // Without IM Fell (lens-acta-fallback), the title and the other small-capital labels are set
    // in synthesized small capitals of the fallback serif.
    html().classList.add('lens-acta-fallback');
    const smallCaps = ['#main-content .page-title', '#site-nav .nav-button'].map(sel => doc.querySelector(sel)).filter(Boolean);
    check(smallCaps.length === 2 && smallCaps.every(el => win.getComputedStyle(el).fontVariantCaps === 'small-caps'), `photography: in the fallback serif the title and the nav are small capitals (${smallCaps.map(el => win.getComputedStyle(el).fontVariantCaps).join(', ')})`);
    html().classList.remove('lens-acta-fallback');
    await idleFrames('photography');
    // Scrolling through the page: no task over 50 ms, short slices, plates on their photos.
    const since = win.performance.now();
    const height = html().scrollHeight;
    for (let y = 0; y <= height; y += 140) { win.scrollTo({ top: y, behavior: 'instant' }); await delay(32); }
    await delay(1500);
    await until(() => nearPhotos().every(img => placement().some(p => p.img === img && p.off <= 1)), 'the plates at the bottom', 15000).catch(() => {});
    checkPlacement('photography at the bottom');
    for (let y = height; y >= 0; y -= 280) { win.scrollTo({ top: y, behavior: 'instant' }); await delay(32); }
    win.scrollTo({ top: 0, behavior: 'instant' });
    await delay(1200);
    // Jank is a long animation frame (a task that held a frame up, with the scripts that ran
    // in it). Long tasks are reported too; on a busy machine the page's own image decoding
    // makes some outside any frame, with or without a lens.
    const scrollTasks = longTasks.filter(task => task.at >= since && task.ms > 50);
    const scrollFrames = frames.filter(f => f.at >= since && f.ms > 50);
    report.longTasks.photography = scrollTasks.map(task => task.ms);
    report.longFrames = scrollFrames;
    check(scrollFrames.length === 0, `photography: no frame held up over 50 ms while scrolling (${scrollFrames.map(f => `${f.ms} ms [${f.scripts.join('; ')}]`).join(', ')})`);
    check(!scrollFrames.some(f => f.scripts.some(sc => /acta|media/.test(sc))), 'photography: no lens script runs in a long frame');
    report.stats = acta()._stats;
    // Slices aim at 6 ms; a busy machine (garbage collection, other processes) stretches a few.
    check(report.stats.plates > 0 && report.stats.longSlices <= Math.max(1, 0.05 * report.stats.slices) && report.stats.maxSliceMs < 50,
      `photography: the engraving's slices stay short (${report.stats.longSlices} of ${report.stats.slices} over 8 ms, longest ${report.stats.maxSliceMs} ms; ${report.stats.plates} plates)`);
    await idleFrames('photography after scrolling');
    // A photo stays clickable through its plate, and the lightbox opens above the plates.
    placed = placement();
    const item = placed.length ? placed[0].img.closest('.photo-item') : null;
    const hit = item ? doc.elementFromPoint(centre(placed[0].img).x, centre(placed[0].img).y) : null;
    check(hit && hit.closest('.photo-item') === item, `photography: the photo under its plate takes the click (hit ${hit && hit.tagName})`);
    if (hit) {
      // The blank stands from the first frames (once the photograph's size is known, a frame
      // or two), long before the plate.
      const opened = win.performance.now();
      hit.click();
      let blank = null; let blankAt = null;
      while (win.performance.now() - opened < 400 && !lightboxPlates().length) {
        await painted();
        blank = lightboxBlank();
        if (blank && blank.off <= 1) { blankAt = Math.round(win.performance.now() - opened); break; }
      }
      report.lightboxBlankMs = blankAt;

      const big = doc.getElementById('lightbox-img');
      check(blankAt !== null && blankAt <= 100 && !lightboxPlates().length, `lightbox: opening it, its photograph's blank plate stands on the sheet within 100 ms, before the plate (${blankAt} ms, off by ${blank ? blank.off.toFixed(2) : '-'} px; photograph ${big.naturalWidth}x${big.naturalHeight}, complete ${big.complete})`);
      await delay(300);
      const box = doc.getElementById('lightbox');
      const top = doc.elementFromPoint(win.innerWidth / 2, win.innerHeight / 2);
      check(box && box.classList.contains('active') && top && top.closest('.lightbox'), 'photography: the lightbox opens above the plates (and keeps the pointer)');
      await checkLightbox('lightbox');
      doc.getElementById('close-lightbox').click();
      await until(() => !lightboxPlates(true).length, 'the lightbox plate to go', 4000).catch(() => {});
      check(!lightboxPlates(true).length && !box.classList.contains('active'), 'lightbox: closing it removes its plate');
    }
    report.exitMs.photography = await go(null);
    compare(before, 'photography after the exit');

    /* 2b. Projects: the app screenshots stay sepia thumbnails, with no plate and no blank. */
    await load('/projects.html');
    before = snapshot();
    await go('acta');
    await delay(1500);
    const shots = [...doc.querySelectorAll('#main-content img[src*="project-demo/"]')].filter(img => loaded(img) && img.getClientRects().length);
    check(shots.length > 0 && shots.every(img => /grayscale/.test(win.getComputedStyle(img).filter) && /lens-acta-print/.test(win.getComputedStyle(img).filter) && win.getComputedStyle(img).opacity === '1'),
      `projects: the app screenshots keep the sepia plate, printed in ink on the paper (${shots.length})`);
    check(plates().length === 0 && blanks().length === 0, `projects: no app screenshot becomes a plate (${plates().length} plates, ${blanks().length} blanks)`);
    await go(null);
    compare(before, 'projects after the exit');

    /* 2c. A blog post: its images are printed through the print matrix (a filter, so the
       transformed wide figure, which isolates blending, is printed on the paper too). */
    await load('/blogs/agents-that-learn-after-deployment.html');
    before = snapshot();
    await go('acta');
    const figs = [...doc.querySelectorAll('#main-content img')].filter(img => img.getClientRects().length);
    check(!!doc.getElementById('lens-acta-print') && figs.length > 0 && figs.every(img => /lens-acta-print/.test(win.getComputedStyle(img).filter) && win.getComputedStyle(img).mixBlendMode === 'normal'),
      `blog post: the images are printed through the print matrix (${figs.length})`);
    check(!!doc.querySelector('#main-content figure.article-figure-wide img'), 'blog post: a wide figure is among them');
    await go(null);
    compare(before, 'blog post after the exit');

    /* 3. A paper page: figures are graphics, they keep the sepia plate of acta.css. */
    await load('/papers/godel-agent.html');
    before = snapshot();
    report.enterMs.paper = await go('acta');
    check(html().classList.contains('lens-acta-paper') && /lens-acta-print/.test(win.getComputedStyle(doc.getElementById('main-content')).filter), 'paper page: the print matrix colours the page');
    await delay(1200);
    const figures = [...doc.querySelectorAll('#main-content img')].filter(img => loaded(img) && img.getClientRects().length);
    check(figures.length > 0 && figures.every(img => /sepia/.test(win.getComputedStyle(img).filter)), `paper page: the figures keep the sepia plate (${figures.length} figures)`);
    check(plates().length === 0, `paper page: no figure becomes a plate (${plates().length} plates)`);
    clickable('paper page');
    await idleFrames('paper page');
    report.exitMs.paper = await go(null);
    compare(before, 'paper page after the exit');

    /* 4. The longest paper page: reading costs no long task; the frame budget holds. */
    await load(LONGEST_PAPER);
    before = snapshot();
    await go('acta');
    const budgetBefore = JSON.parse(JSON.stringify(state().frameStats.acta || { frames: 0, avgMs: 0, maxMs: 0 }));
    const readFrom = win.performance.now();
    const long = html().scrollHeight;
    for (let k = 0; k <= 40; k++) {
      doc.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 200 + k * 20, clientY: 150 + (k % 10) * 50 }));
      if (k % 4 === 0) win.scrollTo({ top: Math.min(long, (k / 40) * long * 0.9), behavior: 'instant' });
      await delay(40);
    }
    win.scrollTo({ top: 0, behavior: 'instant' }); await delay(500);
    const readTasks = longTasks.filter(task => task.at >= readFrom && task.ms > 50);
    const readFrames = frames.filter(f => f.at >= readFrom && f.ms > 50);
    report.longTasks.longest = readTasks.map(task => task.ms);
    check(readFrames.length === 0, `longest paper: no frame held up over 50 ms while reading (${readFrames.map(f => `${f.ms} ms [${f.scripts.join('; ')}]`).join(', ')})`);
    const budget = state().frameStats.acta;
    const counted = budget ? budget.frames - budgetBefore.frames : 0;
    const avg = counted > 0 ? (budget.avgMs * budget.frames - budgetBefore.avgMs * budgetBefore.frames) / counted : 0;
    report.frameBudget = { frames: counted, avgMs: +avg.toFixed(3) };
    check(avg < 4, `longest paper: frame callbacks average ${avg.toFixed(3)} ms (budget 4 ms)`);
    await idleFrames('longest paper');
    await go(null);
    compare(before, 'longest paper after the exit');

    /* 5. Arrival: dark site theme, 390 x 844, the lens stored as the core stores it. */
    await load('/photography.html', { width: 390, height: 844, theme: 'dark', core: false });
    await settled();
    before = snapshot();
    const watching = watchPhotographs();
    await load('/photography.html', { width: 390, height: 844, theme: 'dark', core: false, lens: 'acta', early: w => {
      w.__inked = new Set();
      w.document.addEventListener('animationstart', event => { if (event.animationName === 'lens-acta-ink') w.__inked.add(event.target); }, true);
    } });
    await until(() => lenses() && lenses().current === 'acta' && !lenses().busy && !html().hasAttribute('data-lens-arriving') && !html().hasAttribute('data-lens-revealing'), 'Acta to arrive', 15000);
    report.arriveMs = acta()._stats.arriveMs;
    check(report.arriveMs !== null && report.arriveMs <= 350, `arrival: Acta settles within 350 ms (${report.arriveMs} ms)`);
    check(!doc.querySelector('.lenses-caption'), 'arrival: no caption (it arrives silently)');
    check(html().getAttribute('data-theme') === 'dark' && html().classList.contains('lens-acta'), 'arrival: the Acta style is on over the dark site theme');
    const ground = win.getComputedStyle(html()).backgroundColor;
    check(ground === `rgb(${PAPER.join(', ')})`, `arrival: the dark theme shows paper (${ground})`);
    const text = win.getComputedStyle(doc.querySelector('#main-content .gallery-intro')).color;
    check(text === 'rgba(42, 29, 18, 0.76)' || text === `rgb(${INK.join(', ')})`, `arrival: the text is ink (${text})`);
    await settled();
    await until(() => nearPhotos().every(img => placement().some(p => p.img === img && p.off <= 1)), 'the plates after arrival', 15000).catch(() => {});
    placed = checkPlacement('arrival');
    check(placed.length > 0 && placed.every(p => inked().has(p.canvas)), `arrival: the plates made after the switch are inked in (${placed.filter(p => inked().has(p.canvas)).length} of ${placed.length})`);
    await delay(800);
    const watched = watching();
    check(watched.samples > 20 && watched.shown === 0,
      `arrival: no photograph is ever seen as a photograph, only blanks and the plates inked in on them (${watched.shown} of ${watched.samples} samples${watched.at.length ? `: ${watched.at.join(', ')}` : ''})`);
    checkBlanks('arrival');
    check(html().scrollWidth <= 391, `arrival: no horizontal overflow at 390 px (${html().scrollWidth})`);
    clickable('arrival');
    await idleFrames('arrival');
    doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(() => !lenses().busy && lenses().current === null, 'Esc to leave', 10000);
    compare(before, 'arrival after Esc');

    /* 6. Reduced motion: the switch at once, both ways; no band, no inking. */
    reduced = true;
    await load('/photography.html');
    recordInk();
    before = snapshot();
    const banded = [];
    const watch = new win.MutationObserver(() => { if (/lens-acta-vt-/.test(html().className)) banded.push(html().className); });
    watch.observe(html(), { attributes: true, attributeFilter: ['class'] });
    report.enterMs.reduced = await go('acta');
    await until(() => nearPhotos().every(img => placement().some(p => p.img === img && p.off <= 1)), 'the plates under reduced motion', 15000).catch(() => {});
    placed = checkPlacement('reduced motion');
    check(placed.every(p => !p.canvas.classList.contains('lens-acta-inking')) && inked().size === 0, `reduced motion: no plate is inked in (they appear at once; ${inked().size} fades)`);
    const exitBegan = performance.now();
    await go(null);
    report.exitMs.reduced = Math.round(performance.now() - exitBegan);
    watch.disconnect();
    check(banded.length === 0, `reduced motion: no band (${banded.length} view-transition classes seen)`);
    check(report.exitMs.reduced < 200, `reduced motion: the exit is immediate (${report.exitMs.reduced} ms)`);
    compare(before, 'reduced motion after the exit');
    reduced = false;

    /* 7. Phones: the caption sits above photography's title, clear of the nav; on a paper page,
       where the core sets it at the viewport's foot, it is on a slip of paper. */
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    await load('/photography.html', { width: 390, height: 844 });
    before = snapshot();
    await go('acta');
    let cap = doc.querySelector('.lenses-caption');
    if (cap) {
      const c = cap.getBoundingClientRect();
      const nav = [...doc.querySelectorAll('#site-nav a, #site-nav button')].map(a => a.getBoundingClientRect()).filter(r => r.width > 0 && r.bottom > 0);
      const range = doc.createRange(); range.selectNodeContents(doc.querySelector('#main-content h1'));
      const title = [...range.getClientRects()];
      // Above the title: aligned with it (is-above) or centred in the free band between the nav
      // and the title (is-band), whichever the core finds room for under the phone's two-row nav.
      check((cap.classList.contains('is-above') || cap.classList.contains('is-band')) && c.bottom <= Math.min(...title.map(r => r.top)) + 0.5 && !nav.some(r => overlaps(r, c)) && !title.some(r => overlaps(r, c)),
        `phone, photography: the caption sits above the title, clear of the nav (${cap.className}, ${Math.round(c.top)}–${Math.round(c.bottom)} px)`);
    } else check(false, 'phone, photography: the caption shows after the enter');
    // The lightbox on a phone: its arrows cross the photograph, and stay visible over the
    // plate (the helper cuts the plate out along their glyphs).
    await delay(1500);
    doc.querySelectorAll('#main-content .photo-item')[0].click();
    await until(() => lightboxPlates().length === 1, 'the phone lightbox plate', 8000).catch(() => {});
    const phonePlate = lightboxPlates()[0];
    const arrows = ['lightbox-prev', 'lightbox-next'].map(id => doc.getElementById(id).getBoundingClientRect());
    const crossing = phonePlate ? arrows.filter(r => overlaps(r, phonePlate.getBoundingClientRect())).length : 0;
    check(!!phonePlate && (!crossing || /url\(/.test(phonePlate.style.maskImage || phonePlate.style.webkitMaskImage || '')),
      `phone, lightbox: the arrows over the plate stay visible (${crossing} cross it; mask ${phonePlate ? (phonePlate.style.maskImage || '').slice(0, 40) : '-'})`);
    doc.getElementById('close-lightbox').click();
    await until(() => !lightboxPlates(true).length, 'the phone lightbox plate to go', 4000).catch(() => {});
    await go(null);
    compare(before, 'phone, photography after the exit');
    // A paper page: the caption sits above the title, in the band Acta leaves under the
    // eyebrow, clear of the eyebrow and of the title's glyphs by the core's usual gap (not at
    // the viewport's foot over the text, nor squeezed), at every width.
    // A blog post on a phone likewise, between its kicker and its title.
    for (const [path, width, height, above, kind] of [['/papers/godel-agent.html', 1440, 900, '.paper-eyebrow', 'paper page'], ['/papers/godel-agent.html', 390, 844, '.paper-eyebrow', 'paper page'],
      ['/papers/godel-agent.html', 320, 640, '.paper-eyebrow', 'paper page'], ['/blogs/agents-that-learn-after-deployment.html', 390, 844, '.article-kicker', 'blog post'],
      ['/blogs/agents-that-learn-after-deployment.html', 320, 640, '.article-kicker', 'blog post']]) {
      await load(path, { width, height });
      before = snapshot();
      await go('acta');
      await delay(300);
      cap = doc.querySelector('.lenses-caption');
      const label = `${kind} at ${width}`;
      if (cap) {
        const c = cap.getBoundingClientRect();
        const eyebrow = doc.querySelector(above).getBoundingClientRect();
        const h1 = doc.querySelector('#main-content h1');
        const range = doc.createRange(); range.selectNodeContents(h1);
        const firstTop = Math.min(...[...range.getClientRects()].map(r => r.top));
        const capTop = firstTop + parseFloat(win.getComputedStyle(h1).fontSize) * 0.26;     // the title's capitals (as the core reads them)
        report[`caption ${kind} ${width}`] = { cls: cap.className, top: +c.top.toFixed(1), bottom: +c.bottom.toFixed(1), eyebrow: +eyebrow.bottom.toFixed(1), capTop: +capTop.toFixed(1) };
        check(cap.classList.contains('is-above') && c.top - eyebrow.bottom >= 6 && capTop - c.bottom >= 6,
          `${label}: the caption sits above the title, clear of the ${above} and the title (${cap.className}; ${(c.top - eyebrow.bottom).toFixed(1)} px below it, ${(capTop - c.bottom).toFixed(1)} px above the capitals)`);
      } else check(false, `${label}: the caption shows after the enter`);
      check(html().scrollWidth <= width + 1, `${label}: no horizontal overflow (${html().scrollWidth})`);
      await go(null);
      compare(before, `${label} after the exit`);
    }

    /* 7b. Arrival without a paper tile kept for the session: the style switches at once on the
       flat paper ground (no wait for the tile), and the tile is laid under the page once made. */
    await load('/cv.html', { core: false });
    await settled();
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('lenses-acta-paper')) sessionStorage.removeItem(key);
    await load('/cv.html', { core: false, lens: 'acta' });
    await until(() => lenses() && lenses().current === 'acta' && !lenses().busy && !html().hasAttribute('data-lens-arriving'), 'Acta to arrive without a tile', 15000);
    report.arriveNoTileMs = acta()._stats.arriveMs;
    check(report.arriveNoTileMs !== null && report.arriveNoTileMs <= 350, `arrival without a kept tile: Acta settles within 350 ms (${report.arriveNoTileMs} ms)`);
    await until(() => /--lens-acta-paper/.test(html().getAttribute('style') || ''), 'the tile to be laid', 10000).catch(() => {});
    check(/--lens-acta-paper/.test(html().getAttribute('style') || '') && Object.keys(sessionStorage).some(key => /^lenses-acta-paper@[12]$/.test(key)),
      `arrival without a kept tile: the tile is made, laid under the page and kept (keys ${Object.keys(sessionStorage).filter(key => key.startsWith('lenses-acta')).join(', ')})`);
    doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(() => !lenses().busy && lenses().current === null, 'Esc to leave', 10000);

    /* 7c. Arrival with the fonts late (Google's stylesheet held back 900 ms): the style switches
       in the fallback serif within the arrival's budget, with small capitals, and IM Fell is
       swapped in when it comes while the reader has not touched the page; once the reader has
       (a key), it is kept for the next page. */
    const slowFonts = w => {
      const fetch0 = w.fetch.bind(w);
      w.fetch = (url, ...rest) => (/fonts\.googleapis\.com/.test(String(url)) ? new Promise(r => setTimeout(r, 900)).then(() => fetch0(url, ...rest)) : fetch0(url, ...rest));
    };
    for (const touch of [false, true]) {
      await load('/photography.html', { core: false, lens: 'acta', early: slowFonts });
      await until(() => lenses() && lenses().current === 'acta' && !lenses().busy && !html().hasAttribute('data-lens-arriving'), 'Acta to arrive with late fonts', 15000);
      const ms = acta()._stats.arriveMs;
      const fallback = html().classList.contains('lens-acta-fallback');
      const title = win.getComputedStyle(doc.querySelector('#main-content .page-title')).fontVariantCaps;
      if (touch) doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Shift', bubbles: true, cancelable: true }));
      await delay(1800);
      const label = touch ? 'arrival with late fonts, the reader active' : 'arrival with late fonts';
      report[touch ? 'lateFontsTouched' : 'lateFonts'] = { ms, fallback, title, after: html().classList.contains('lens-acta-fallback') };
      check(ms !== null && ms <= 350 && fallback && title === 'small-caps', `${label}: the style switches within 350 ms in the fallback serif, the title in small capitals (${ms} ms, fallback ${fallback}, ${title})`);
      if (touch) check(html().classList.contains('lens-acta-fallback'), `${label}: the fallback serif is kept once the reader has touched the page`);
      else check(!html().classList.contains('lens-acta-fallback') && [...win.document.fonts].some(f => /IM Fell/.test(f.family) && f.status === 'loaded'), `${label}: IM Fell is swapped in when it comes`);
      doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await until(() => !lenses().busy && lenses().current === null, 'Esc to leave', 10000);
    }

    /* 8. Leaving with the lightbox open: it is the site's black box again at once, its
       photograph shows, and no plate or layer is left. */
    await load('/photography.html');
    await go('acta');
    await delay(1500);
    const pageCaption = doc.querySelector('.lenses-caption');
    check(!!pageCaption && +win.getComputedStyle(pageCaption).opacity > 0.5, 'lightbox opened soon after the enter: the caption still shows by the title');
    doc.querySelectorAll('#main-content .photo-item')[2].click();
    await painted();
    check(!pageCaption || !pageCaption.isConnected || win.getComputedStyle(pageCaption).opacity === '0', 'lightbox opened soon after the enter: the page\'s caption hides while the lightbox is open');
    await until(() => lightboxPlates().length === 1, 'the lightbox plate before the exit', 8000).catch(() => {});
    check(lightboxPlates().length === 1, 'exit with the lightbox open: it has its plate first');
    await go(null);
    const box = doc.getElementById('lightbox'); const big = doc.getElementById('lightbox-img');
    check(box.classList.contains('active') && win.getComputedStyle(box).backgroundColor === 'rgba(0, 0, 0, 0.95)' && win.getComputedStyle(big).opacity === '1' && win.getComputedStyle(big).filter === 'none',
      `exit with the lightbox open: the lightbox is the site's own again (${win.getComputedStyle(box).backgroundColor}, opacity ${win.getComputedStyle(big).opacity}, filter ${win.getComputedStyle(big).filter})`);
    check(!doc.querySelector('.lenses-layer, .lenses-media'), 'exit with the lightbox open: no plate or layer is left');
    doc.getElementById('close-lightbox').click();
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens[0] === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens[0]);
    if (storedLens[1] === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedLens[1]);
  }
  /* 7. No uncaught errors, console.error calls or lens warnings. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  // Leaving with the lightbox open (section 8), the core restores <body>'s style attribute
  // to what it was before the lens, removing the lightbox's own overflow: hidden, and names
  // the lens for it: the page's change, not the lens's (reported, not counted).
  const pageOwn = w => /left an attribute behind \(restored\)\. Error: body\[style="overflow: hidden;"\]/.test(w);
  report.coreNotes = [...new Set(warnings.filter(pageOwn))];
  const lensWarnings = warnings.filter(w => /acta|media/.test(w) && !pageOwn(w));
  assertions++;
  if (lensWarnings.length) failures.push(`Warnings: ${[...new Set(lensWarnings)].slice(0, 6).join(' | ')}`);
  return { assertions, failures, ...report };
})();
