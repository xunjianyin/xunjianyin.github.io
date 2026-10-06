/**
 * Lens I · Stardust: "Every letter is made of smaller things."
 *
 * Every glyph in the lens scope is redrawn as fine luminous particles on a night
 * ground. Each word is rendered offscreen in its exact computed font and sampled on
 * a grid of about 0.09 em; a particle sits at the ink centroid of every covered cell,
 * so letters keep their shape and stay readable. The portrait becomes a point cloud
 * of its own luminance.
 *
 * The page DOM is never edited. The core hides the glyphs (links stay clickable under
 * the particles); this lens adds classes on <html> for the night ground and draws on
 * two canvases in the core's fixed layer:
 *   - ink (Canvas2D), used in transitions only: crisp word sprites in device pixels,
 *     identical to the page's glyphs, dissolve into dust on enter and condense back
 *     on exit. It also draws the faint shockwave rings.
 *   - dust (WebGL2, else WebGL1): one draw call of points. Home positions, colours and
 *     seeds are static buffers; the vertex shader computes the shimmer, the enter puff,
 *     the exit condensation, shockwaves, the scroll lag and link highlights from
 *     uniforms. Only the pointer wind is simulated on the CPU, for the particles it
 *     has disturbed, and only that range of the offset buffer is uploaded.
 *     Without WebGL, a Canvas2D pixel plotter draws the same particles more simply.
 */
(() => {
  'use strict';

  /* ---------------------------------------------------------------------------
   * Constants. Lengths are CSS px, times are seconds unless marked ms.
   * ------------------------------------------------------------------------- */
  const NIGHT_RGB = [6, 8, 12];          // the ground, #06080c (stardust.css uses the same)
  const PHOTO_SELECTOR = '.profile-photo';
  const CLASS_NIGHT = 'lens-stardust';           // night colours (the ground's target)
  const CLASS_GROUND = 'lens-stardust-ground';   // transitions for the ground; kept through the exit
  const CLASS_LEAVING = 'lens-stardust-leaving'; // the shorter exit duration
  const CLASS_PHOTO = 'lens-stardust-photo';     // hides the portrait under its point cloud
  const CLASS_STILL = 'lens-stardust-still';     // no colour fades at all (reduced motion, instant exit)
  const CLASS_CAPTION = 'lens-stardust-caption'; // the core's caption in a light tone, once the ground is dark
  const MARKS = '.homepage-section h2, .project-link, #theme-toggle, .footer-social a, .back-to-top, .nav-button';

  // Sampling the glyphs
  const STEP_EM = 0.09;                  // grid step as a fraction of the font size ...
  const STEP_MIN = 1.1;                  // ... never finer than this ...
  const STEP_MAX = 2;                    // ... nor coarser (large type stays dense and readable)
  const SUPER = 2;                       // subsamples per cell side (coverage and centroid)
  const COVER_MIN = 0.16;                // cells with less ink coverage make no particle
  const COVER_FULL = 0.62;               // coverage at which a particle is at full size and alpha
  const JITTER = [0.1, 0.3];             // of a step, at the rim and inside a stroke: breaks up the lattice
  const GRAIN = 0.3;                     // static brightness variation between particles (darker only)
  const SIZE_MIN = 0.9;                  // particle diameter at DPR 1, for faint and full cells
  const SIZE_MAX = 1.5;
  const ALPHA_MIN = 0.42;                // alpha of the faintest particle
  const ATLAS_W = 2048;                  // sampling and sprite atlases
  const ATLAS_H = 2048;
  const SAMPLE_PAGE_H = 512;             // the enter samples in pages this tall, yielding between them
  const PARTICLE_CAP = 200000;           // a safety bound; the homepage needs about a third
  const LINE_SLACK = 3;                  // baselines within this many px form one line

  // The portrait as a point cloud
  const PHOTO_STEP = 1.6;                // px between samples
  const PHOTO_MIN_LUMA = 0.07;           // darker cells stay empty: the night shows through
  const PHOTO_DESATURATE = 0.6;          // share of grey in the cloud's colour
  const PHOTO_LIFT = 1.18;               // brightening of the cloud on the night ground
  const PHOTO_FONT = 9;                  // the "font size" that scales the portrait's puff
  const PHOTO_STRIP = 3;                 // px: the portrait dissolves in strips this tall

  // Choreography (the ground's durations must match stardust.css)
  const GROUND_IN = 0.8;
  const GROUND_OUT = 0.7;
  const ENTER_START = 0.12;              // the first line starts once the ground is moving
  const ENTER_SWEEP = 0.85;              // top to bottom of the viewport, line by line
  const ENTER_DUR = 1.0;                 // a line puffs into dust and settles in this long
  const EXIT_SWEEP = 0.25;
  const EXIT_DUR = 0.45;                 // a line stirs, condenses and becomes ink
  const SETTLE_SLACK = 0.45;             // extra wait for the CSS ground before giving up

  // Ambient and interaction
  const SHIMMER = 0.08;                  // per-particle alpha jitter, +-8 %
  const SHIMMER_FPS = 15;                // the slow shimmer alone redraws at this rate
  const WIND_RADIUS = 90;
  const WIND_ACCEL = 2000;               // px/s^2 at the pointer for a gust of 1
  const WIND_SPEED_REF = 1000;           // pointer px/s for a gust of 1 ...
  const WIND_GUST_MAX = 1.6;             // ... capped here
  const WIND_ALONG = 0.4;                // share of push along the pointer's motion
  const WIND_SWIRL = 0.85;               // random sideways share: dust, not a rigid bulge
  const SPRING = 34;                     // 1/s^2: pull home (scaled 0.6-1.4 per particle)
  const DAMPING = 5.4;                   // 1/s
  const DRIFT_MAX = 70;                  // px: soft bound of a particle's displacement
  const SLEEP_OFFSET = 0.04;             // px and px/s below which a particle rests at home
  const SLEEP_SPEED = 0.6;
  const POINTER_TAU = 0.07;              // the pointer's speed fades this fast when it stops
  const RING_MAX = 3;
  const RING_SPEED = 480;                // px/s
  const RING_WIDTH = 26;                 // px: width of the travelling front
  const RING_PUSH = 7;                   // px of outward displacement at the front
  const RING_DECAY = 0.7;                // s: e-folding of the ring's strength
  const RING_LIFE = 1.8;
  const RING_ALPHA = 0.1;                // the faint drawn circle
  const LAG_TAU = 0.075;                 // scroll lag settles in about 4 tau (0.3 s)
  const LAG_MAX = 28;                    // px: soft bound of the lag
  const HOVER_TAU = 0.08;
  const REBUILD_MS = 220;                // after a resize or a theme switch

  // Rendering budget (as the first egg)
  const DPR_MAX = 2;
  const MAX_BACKING_PIXELS = 8.3e6;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // The shader's per-line timing, mirrored in JS for the ink sprites.
  const inkEnter = e => 1 - smooth(0, 0.22, e);
  const inkExit = x => smooth(0.45, 0.95, x);

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function parseColour(text) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?/.exec(text || '');
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1)];
    const h = /^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(text || '');
    if (!h) return null;
    const hex = h[1].length === 3 ? h[1].replace(/./g, c => c + c) : h[1];
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(1);
  }
  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }
  /*
   * Night colours. Greys become pale cool greys that keep their emphasis (dark body
   * text bright, muted text dimmer, headings and bold brightest); saturated colours
   * (links) become a pale tint of their own hue.
   */
  function nightColour([r, g, b], emphasis, darkSite) {
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    if ((max - min) / 255 < 0.16) {
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const strength = darkSite ? luma : 1 - luma;
      const level = emphasis ? 1.07 : 0.55 + 0.45 * strength;
      return [226, 233, 242].map(v => Math.min(255, v * level));
    }
    let hue;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    return hsl((hue * 60 + 360) % 360, 0.82, emphasis ? 0.86 : 0.8);
  }
  // Draw a word with its letter-spacing; fall back to measured per-glyph advances.
  function fillSpaced(g, text, x, y, spacing, native) {
    if (native || !spacing) { g.fillText(text, x, y); return; }
    for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + spacing; }
  }
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ---------------------------------------------------------------------------
   * Capture: every visible word of the scope, with exact typography and colour
   * ------------------------------------------------------------------------- */
  function capture(scope) {
    const words = [];
    const links = new Map();             // link or button element -> id (1-based)
    const styles = new Map(); const opacities = new Map(); const sizes = new Map();
    const html = document.documentElement;
    const darkSite = html.dataset.theme === 'dark';
    const sx = window.scrollX; const sy = window.scrollY;
    const range = document.createRange();
    const measure = makeCanvas(1, 1).getContext('2d');
    // Opacity multiplies down the tree (the footer copyright is at 0.6).
    const opacityOf = el => {
      if (!el || el === html) return 1;
      if (opacities.has(el)) return opacities.get(el);
      const value = (parseFloat(getComputedStyle(el).opacity) || 0) * opacityOf(el.parentElement);
      opacities.set(el, value);
      return value;
    };
    const styleOf = el => {
      if (styles.has(el)) return styles.get(el);
      const cs = getComputedStyle(el);
      const rgba = parseColour(cs.color);
      const alpha = rgba ? rgba[3] * opacityOf(el) : 0;
      let info = null;
      if (cs.visibility === 'visible' && alpha > 0.02) {
        const size = parseFloat(cs.fontSize) || 16;
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const emphasis = weight >= 600 || !!el.closest('h1, h2, h3, h4, h5, h6');
        const caps = cs.fontVariantCaps === 'small-caps' ? 'small-caps ' : '';
        const font = `${cs.fontStyle} ${caps}${cs.fontWeight} ${size}px ${cs.fontFamily}`;
        measure.font = font;
        const metrics = measure.measureText('Hg');
        const day = [rgba[0], rgba[1], rgba[2], alpha];
        info = {
          font, size, step: clamp(STEP_EM * size, STEP_MIN, STEP_MAX),
          spacing: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0,
          transform: cs.textTransform,
          ascent: metrics.fontBoundingBoxAscent || size * 0.8,
          day, night: nightColour(day, emphasis, darkSite).concat(alpha),
          dayCss: `rgba(${day[0]},${day[1]},${day[2]},${alpha.toFixed(3)})`
        };
        info.nightCss = `rgba(${info.night.slice(0, 3).map(Math.round).join(',')},${alpha.toFixed(3)})`;
      }
      styles.set(el, info);
      return info;
    };
    // Visually hidden text (a 1 px clip box) is not drawn by the page either.
    const tiny = el => {
      if (sizes.has(el)) return sizes.get(el);
      const r = el.getBoundingClientRect();
      const value = r.width <= 1 || r.height <= 1;
      sizes.set(el, value);
      return value;
    };
    const linkOf = el => {
      const a = el.closest('a[href], button');
      if (!a || !scope.some(root => root.contains(a))) return 0;
      if (!links.has(a)) links.set(a, links.size + 1);
      return links.get(a);
    };
    const transform = (text, mode, atStart) => {
      if (mode === 'uppercase') return text.toUpperCase();
      if (mode === 'lowercase') return text.toLowerCase();
      if (mode === 'capitalize' && atStart) return text.charAt(0).toUpperCase() + text.slice(1);
      return text;
    };
    for (const root of scope) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || !/\S/.test(node.data) || parent.closest('script, style, noscript, template')) continue;
        const style = styleOf(parent);
        if (!style || tiny(parent)) continue;
        const link = linkOf(parent);
        const take = (start, end, atStart) => {
          range.setStart(node, start); range.setEnd(node, end);
          const r = range.getBoundingClientRect();
          // The skip link waits above the page; nothing outside the document is drawn.
          if (!r.width || !r.height || r.bottom + sy < 0 || r.right + sx < 0) return;
          words.push({
            text: transform(node.data.slice(start, end), style.transform, atStart),
            left: r.left, top: r.top, width: r.width, height: r.height,
            docLeft: r.left + sx, docTop: r.top + sy, style, link, line: -1
          });
        };
        for (const match of node.data.matchAll(/\S+/gu)) {
          const from = match.index; const to = from + match[0].length;
          range.setStart(node, from); range.setEnd(node, to);
          const rects = range.getClientRects();
          let single = true;
          for (let i = 1; i < rects.length; i++) if (Math.abs(rects[i].top - rects[0].top) >= 1) single = false;
          if (single) { take(from, to, true); continue; }
          // A word wrapped across lines (at a hyphen) is taken once per line.
          let start = from; let offset = from; let top = null;
          for (const character of match[0]) {
            range.setStart(node, offset); range.setEnd(node, offset + character.length);
            const r = range.getBoundingClientRect();
            if (top !== null && Math.abs(r.top - top) > 1) { take(start, offset, start === from); start = offset; }
            top = r.top; offset += character.length;
          }
          take(start, offset, start === from);
        }
      }
    }
    range.detach();
    return { words, links, darkSite, lines: groupLines(words) };
  }

  // Visual lines: words whose baselines agree, in reading order from the top.
  function groupLines(words) {
    const order = words.map((w, i) => i);
    const base = i => words[i].docTop + words[i].style.ascent;
    order.sort((a, b) => base(a) - base(b) || words[a].docLeft - words[b].docLeft);
    const lines = []; let current = null;
    for (const i of order) {
      const w = words[i]; const b = base(i);
      if (!current || b - current.base > LINE_SLACK) {
        current = { base: b, top: w.docTop, bottom: w.docTop + w.height, words: [], delayIn: -10, delayOut: 0 };
        lines.push(current);
      }
      current.words.push(w);
      current.top = Math.min(current.top, w.docTop);
      current.bottom = Math.max(current.bottom, w.docTop + w.height);
      w.line = lines.length - 1;
    }
    for (const line of lines) line.mid = (line.top + line.bottom) / 2;
    return lines;
  }

  /* ---------------------------------------------------------------------------
   * Particles: sampled glyphs and the portrait, sorted into a spatial grid
   * ------------------------------------------------------------------------- */
  // A growable list of particles: 7 floats (x, y, seed, size, link, font, row tag) and
  // 8 bytes (day and night rgba) each, in strides of 8.
  function particleList() {
    return { n: 0, f: new Float32Array(8 * 4096), c: new Uint8ClampedArray(8 * 4096) };
  }
  function pushParticle(list, x, y, seed, size, link, font, rowY, day, night, alpha, dayAlpha) {
    if (list.n >= PARTICLE_CAP) return;
    if (list.n * 8 >= list.f.length) {
      const f = new Float32Array(list.f.length * 2); f.set(list.f); list.f = f;
      const c = new Uint8ClampedArray(list.c.length * 2); c.set(list.c); list.c = c;
    }
    const k = list.n * 8;
    list.f[k] = x; list.f[k + 1] = y; list.f[k + 2] = seed; list.f[k + 3] = size;
    list.f[k + 4] = link; list.f[k + 5] = font; list.f[k + 6] = rowY;
    list.c[k] = day[0]; list.c[k + 1] = day[1]; list.c[k + 2] = day[2]; list.c[k + 3] = 255 * dayAlpha;
    list.c[k + 4] = night[0]; list.c[k + 5] = night[1]; list.c[k + 6] = night[2]; list.c[k + 7] = 255 * alpha;
    list.n++;
  }

  /*
   * Render every word, white on transparent, into a sampling atlas at SUPER pixels
   * per grid step, then read the alpha back once per atlas page: each cell's mean
   * alpha is its ink coverage, and the alpha-weighted mean of its subsamples is the
   * ink centroid, where the particle goes.
   */
  async function sampleWords(words, list, random, pause) {
    const canvas = makeCanvas(ATLAS_W, 1);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const native = 'letterSpacing' in g;
    let i = 0;
    while (i < words.length) {
      let x = 0; let y = 0; let shelf = 0; const start = i;
      for (; i < words.length; i++) {
        const w = words[i]; const st = w.style;
        const padX = Math.ceil(0.4 * st.size + Math.abs(st.spacing)); const padY = Math.ceil(0.2 * st.size);
        const cols = Math.ceil((w.width + 2 * padX) / st.step); const rows = Math.ceil((w.height + 2 * padY) / st.step);
        const pw = cols * SUPER; const ph = rows * SUPER;
        w.slot = null;
        if (pw > ATLAS_W || ph > SAMPLE_PAGE_H) continue;
        if (x + pw > ATLAS_W) { x = 0; y += shelf + 2; shelf = 0; }
        if (y + ph > SAMPLE_PAGE_H) break;
        w.slot = [x, y, cols, rows, padX, padY];
        x += pw + 2; shelf = Math.max(shelf, ph);
      }
      if (i === start) { i++; continue; }
      const height = y + shelf;
      canvas.height = height;            // also clears the page
      g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      for (let k = start; k < i; k++) {
        const w = words[k]; if (!w.slot) continue;
        const [ax, ay, cols, rows, padX, padY] = w.slot; const st = w.style; const s = SUPER / st.step;
        g.save();
        g.beginPath(); g.rect(ax, ay, cols * SUPER, rows * SUPER); g.clip();
        g.setTransform(s, 0, 0, s, ax - (w.left - padX) * s, ay - (w.top - padY) * s);
        g.font = st.font;
        if (native) g.letterSpacing = `${st.spacing}px`;
        // The page paints each baseline on a whole CSS pixel (as measured for the first egg).
        fillSpaced(g, w.text, w.left, Math.round(w.top + st.ascent), st.spacing, native);
        g.restore();
      }
      // One 32-bit read per subsample; alpha is the top byte (little-endian RGBA).
      const pixels = new Uint32Array(g.getImageData(0, 0, ATLAS_W, height).data.buffer);
      const minSum = COVER_MIN * 255 * SUPER * SUPER;
      for (let k = start; k < i; k++) {
        const w = words[k]; if (!w.slot) continue;
        const [ax, ay, cols, rows, padX, padY] = w.slot; const st = w.style; const s = SUPER / st.step;
        const x0 = w.docLeft - padX; const y0 = w.docTop - padY;
        for (let cy = 0; cy < rows; cy++) {
          const rowBase = (ay + cy * SUPER) * ATLAS_W + ax;
          for (let cx = 0; cx < cols; cx++) {
            const base = rowBase + cx * SUPER;
            // Most cells are empty: sum first, centroid only for the kept ones.
            let sum = 0;
            for (let j = 0, p = base; j < SUPER; j++, p += ATLAS_W) for (let q = 0; q < SUPER; q++) sum += pixels[p + q] >>> 24;
            if (sum < minSum) continue;
            let mx = 0; let my = 0;
            for (let j = 0, p = base; j < SUPER; j++, p += ATLAS_W) {
              for (let q = 0; q < SUPER; q++) { const a = pixels[p + q] >>> 24; mx += a * (q + 0.5); my += a * (j + 0.5); }
            }
            const cover = sum / (255 * SUPER * SUPER);
            const b = smooth(COVER_MIN, COVER_FULL, cover);
            // Rim particles stay on the outline; inside a stroke they scatter more, like dust.
            const jitter = (JITTER[0] + (JITTER[1] - JITTER[0]) * b) * st.step;
            const px = x0 + (cx * SUPER + mx / sum) / s + (random() - 0.5) * 2 * jitter;
            const py = y0 + (cy * SUPER + my / sum) / s + (random() - 0.5) * 2 * jitter;
            // Larger type gets slightly larger grains (up to 1.4x for the name).
            const grain = clamp(st.step / (STEP_EM * 16), 1, 1.4);
            const size = grain * (SIZE_MIN + (SIZE_MAX - SIZE_MIN) * clamp(b + (random() - 0.5) * 0.25, 0, 1));
            const alpha = st.day[3] * (ALPHA_MIN + (1 - ALPHA_MIN) * b) * (1 - GRAIN * random());
            // The row tag (>= 0) is the word's line; freeze() turns it into the line's middle.
            pushParticle(list, px, py, random(), size, w.link, st.size, w.line, st.day, st.night, alpha, alpha);
          }
        }
      }
      if (pause && i < words.length && await pause()) return;
    }
  }

  // The portrait: luminance sampled into a point cloud in desaturated original colour.
  function samplePhoto(img, list, random) {
    if (!img || !img.complete || !img.naturalWidth) return null;
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    if (cs.visibility !== 'visible' || r.width < 8 || r.height < 8) return null;
    const px = n => parseFloat(cs[n]) || 0;
    const box = {
      left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height,
      border: [px('borderTopWidth'), px('borderRightWidth'), px('borderBottomWidth'), px('borderLeftWidth')],
      pad: [px('paddingTop'), px('paddingRight'), px('paddingBottom'), px('paddingLeft')],
      borderColour: cs.borderTopColor, opacity: parseFloat(cs.opacity) || 1, img
    };
    const cx = box.left + box.border[3] + box.pad[3]; const cy = box.top + box.border[0] + box.pad[0];
    const cw = box.width - box.border[1] - box.border[3] - box.pad[1] - box.pad[3];
    const ch = box.height - box.border[0] - box.border[2] - box.pad[0] - box.pad[2];
    const cols = Math.max(1, Math.round(cw / PHOTO_STEP)); const rows = Math.max(1, Math.round(ch / PHOTO_STEP));
    const g = makeCanvas(cols, rows).getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    let data;
    try { g.drawImage(img, 0, 0, cols, rows); data = g.getImageData(0, 0, cols, rows).data; } catch (error) { return null; }
    const dx = cw / cols; const dy = ch / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4;
        const cr = data[k]; const cg = data[k + 1]; const cb = data[k + 2];
        const luma = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;
        // Brightness by luminance with a little more contrast; the square's edges
        // fade into the night, so the cloud is an oval with soft borders.
        const vignette = 1 - smooth(0.68, 1.08, Math.hypot((i + 0.5) / cols * 2 - 1, (j + 0.5) / rows * 2 - 1));
        const glow = Math.pow(smooth(PHOTO_MIN_LUMA, 0.82, luma), 0.85) * vignette;
        if (glow < 0.04) continue;
        const grey = luma * 255;
        const night = [cr, cg, cb].map(v => Math.min(255, (grey + (v - grey) * (1 - PHOTO_DESATURATE)) * PHOTO_LIFT + 18));
        const x = cx + (i + 0.5 + (random() - 0.5) * 0.6) * dx;
        const y = cy + (j + 0.5 + (random() - 0.5) * 0.6) * dy;
        const size = 0.85 + 0.7 * glow;
        // Full alpha on the day page (it dissolves out of the photo), luminance at night.
        pushParticle(list, x, y, random(), size, 0, PHOTO_FONT, -1 - y, [cr, cg, cb], night,
          (0.12 + 0.88 * glow) * box.opacity, box.opacity);
      }
    }
    return box;
  }

  /*
   * Freeze the list into GPU-ready arrays, sorted by grid cell (row-major) so that
   * the wind's neighbourhood is a few contiguous index ranges: one per cell row.
   */
  const CELL = 24;
  function freeze(list, lines) {
    const n = list.n;
    let maxX = 1; let maxY = 1;
    for (let i = 0; i < n; i++) { maxX = Math.max(maxX, list.f[i * 8]); maxY = Math.max(maxY, list.f[i * 8 + 1]); }
    const cols = Math.ceil((maxX + 1) / CELL) + 1; const rows = Math.ceil((maxY + 1) / CELL) + 1;
    const cellOf = new Int32Array(n); const counts = new Int32Array(cols * rows + 1);
    for (let i = 0; i < n; i++) {
      const cx = clamp(Math.floor(list.f[i * 8] / CELL), 0, cols - 1);
      const cy = clamp(Math.floor(list.f[i * 8 + 1] / CELL), 0, rows - 1);
      cellOf[i] = cy * cols + cx; counts[cellOf[i] + 1]++;
    }
    for (let k = 1; k <= cols * rows; k++) counts[k] += counts[k - 1];
    const cellStart = counts.slice();
    const fill = counts.slice(0, cols * rows);
    const statics = new Float32Array(n * 6);   // x, y, seed, size, link, font
    const colours = new Uint8ClampedArray(n * 8);  // day rgba, night rgba
    const rowY = new Float32Array(n);          // y that times the sweep (the line's middle, or own y)
    for (let i = 0; i < n; i++) {
      const to = fill[cellOf[i]]++;
      const f = i * 8; const s6 = to * 6; const c8 = to * 8;
      for (let k = 0; k < 6; k++) statics[s6 + k] = list.f[f + k];
      for (let k = 0; k < 8; k++) colours[c8 + k] = list.c[f + k];
      const tag = list.f[f + 6];
      rowY[to] = tag >= 0 ? lines[tag].mid : -1 - tag;
    }
    return { n, statics, colours, rowY, cellStart, cols, rows };
  }

  /* ---------------------------------------------------------------------------
   * WebGL renderer: one program, one draw call of points
   * ------------------------------------------------------------------------- */
  const VERTEX = `
precision highp float;
attribute vec2 aHome;
attribute vec4 aMeta;   // seed, size (css px), link id (0: none), font size (css px)
attribute vec4 aDay;    // colour on the day page, premultiplied in the shader
attribute vec4 aNight;  // colour on the night ground
attribute vec2 aOff;    // wind displacement (CPU, sparse)
attribute vec2 aDelay;  // start of this particle's line: enter, exit (s)
uniform vec4 uView;     // viewport w, h; scroll x, y
uniform vec4 uClock;    // shimmer time, shimmer amplitude, night mix, scroll lag
uniform vec3 uPhase;    // time since the enter began, since the exit began (<0: not leaving), dpr
uniform vec4 uHover;    // link id, amount; previous link id, amount
uniform vec4 uRing[${RING_MAX}];  // x, y (document), age (s), strength
varying vec4 vColour;
varying vec2 vDot;      // radius and sprite size, device px
void main() {
  float seed = aMeta.x;
  float h1 = fract(seed * 7.13 + 0.17);
  float h2 = fract(seed * 13.71 + 0.53);
  float h3 = fract(seed * 31.37 + 0.71);
  float e = clamp((uPhase.x - aDelay.x) / ${ENTER_DUR.toFixed(3)}, 0.0, 1.0);
  float x = uPhase.y < 0.0 ? 0.0 : clamp((uPhase.y - aDelay.y) / ${EXIT_DUR.toFixed(3)}, 0.0, 1.0);
  float home = 1.0 - smoothstep(0.0, 0.7, x);         // the exit pulls every displacement home
  float angle = seed * 6.2831853;
  vec2 dir = vec2(cos(angle), sin(angle) - 0.5);       // dust lifts a little
  float reach = aMeta.w * (0.15 + 0.5 * h1);
  float puff = 6.75 * e * (1.0 - e) * (1.0 - e);        // out fast, settle slowly (peak at e = 1/3)
  float stir = 0.18 * sin(3.14159265 * min(x / 0.7, 1.0));
  vec2 p = aHome + aOff * home + dir * reach * (puff * home + stir);
  float glow = 0.0;
  for (int k = 0; k < ${RING_MAX}; k++) {
    vec4 r = uRing[k];
    vec2 d = aHome - r.xy;
    float dist = length(d) + 0.001;
    float q = (dist - r.z * ${RING_SPEED.toFixed(1)}) / ${RING_WIDTH.toFixed(1)};
    float g = r.w * exp(-q * q - r.z / ${RING_DECAY.toFixed(3)}) / (1.0 + dist / 600.0);
    p += d / dist * g * ${RING_PUSH.toFixed(1)};
    glow += g;
  }
  // Scroll: the grains lag by an amount that grows down the screen, like sand.
  float sy = p.y - uView.w;
  float lag = clamp(0.25 + 0.55 * sy / uView.y + 0.2 * h2, 0.0, 1.0);
  vec2 s = vec2(p.x - uView.z, sy - uClock.w * lag);
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
  vec4 c = mix(aDay, aNight, uClock.z);
  float hover = (abs(aMeta.z - uHover.x) < 0.5 ? uHover.y : 0.0) + (abs(aMeta.z - uHover.z) < 0.5 ? uHover.w : 0.0);
  hover *= uClock.z;
  c.rgb = mix(c.rgb, vec3(1.0), 0.45 * hover);
  float a = c.a * (1.0 + uClock.y * sin(uClock.x * (0.5 + 0.9 * h2) + h3 * 6.2831853));
  a *= smoothstep(0.0, 0.15, e) * (1.0 - smoothstep(0.6, 1.0, x)) * (1.0 - 0.3 * puff);
  a = min(1.0, a * (1.0 + 0.5 * hover) + 0.3 * glow);
  float size = aMeta.y * (1.0 + 0.35 * (1.0 - smoothstep(0.0, 0.3, e)) + 0.35 * smoothstep(0.3, 0.85, x) + 0.15 * hover);
  // An antialiased disc at its sub-pixel position: the sprite has a pixel of margin.
  float radius = 0.5 * size * uPhase.z;
  gl_PointSize = 2.0 * radius + 2.0;
  vDot = vec2(radius, gl_PointSize);
  vColour = vec4(c.rgb * a, a);
}`;
  const FRAGMENT = `
precision mediump float;
varying vec4 vColour;
varying vec2 vDot;
void main() {
  // Coverage of a disc of radius vDot.x by this pixel (a one-pixel ramp at the rim);
  // discs smaller than a pixel give up brightness instead of size.
  float d = length(gl_PointCoord - 0.5) * vDot.y;
  gl_FragColor = vColour * (clamp(vDot.x + 0.5 - d, 0.0, 1.0) * min(1.0, 2.0 * vDot.x));
}`;

  function glRenderer(canvas) {
    const options = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', options);
    const v2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
    if (!gl) return null;
    const shader = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const attr = name => gl.getAttribLocation(program, name);
    const A = { home: attr('aHome'), meta: attr('aMeta'), day: attr('aDay'), night: attr('aNight'), off: attr('aOff'), delay: attr('aDelay') };
    const U = {};
    for (const name of ['uView', 'uClock', 'uPhase', 'uHover', 'uRing']) U[name] = gl.getUniformLocation(program, name);
    const buffers = { statics: gl.createBuffer(), colours: gl.createBuffer(), off: gl.createBuffer(), delay: gl.createBuffer() };
    const bind = (buffer, loc, size, type, normalised, stride, offset) => {
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, type, normalised, stride, offset);
    };
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied "over"
    gl.clearColor(0, 0, 0, 0);
    let count = 0;
    return {
      kind: v2 ? 'webgl2' : 'webgl1',
      upload(data, offsets, delays) {
        count = data.n;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.statics); gl.bufferData(gl.ARRAY_BUFFER, data.statics, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colours); gl.bufferData(gl.ARRAY_BUFFER, data.colours, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.off); gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.delay); gl.bufferData(gl.ARRAY_BUFFER, delays, gl.DYNAMIC_DRAW);
        bind(buffers.statics, A.home, 2, gl.FLOAT, false, 24, 0);
        bind(buffers.statics, A.meta, 4, gl.FLOAT, false, 24, 8);
        bind(buffers.colours, A.day, 4, gl.UNSIGNED_BYTE, true, 8, 0);
        bind(buffers.colours, A.night, 4, gl.UNSIGNED_BYTE, true, 8, 4);
        bind(buffers.off, A.off, 2, gl.FLOAT, false, 8, 0);
        bind(buffers.delay, A.delay, 2, gl.FLOAT, false, 8, 0);
      },
      uploadDelays(delays) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.delay); gl.bufferSubData(gl.ARRAY_BUFFER, 0, delays);
      },
      // Only the disturbed range of the offsets goes to the GPU.
      uploadOffsets(offsets, lo, hi) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.off);
        if (v2) gl.bufferSubData(gl.ARRAY_BUFFER, lo * 8, offsets, lo * 2, (hi - lo + 1) * 2);
        else gl.bufferSubData(gl.ARRAY_BUFFER, lo * 8, offsets.subarray(lo * 2, (hi + 1) * 2));
      },
      draw(u) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (!count) return;
        gl.uniform4f(U.uView, u.w, u.h, u.scrollX, u.scrollY);
        gl.uniform4f(U.uClock, u.time, u.shimmer, u.night, u.lag);
        gl.uniform3f(U.uPhase, u.enterT, u.exitT, u.dpr);
        gl.uniform4f(U.uHover, u.hoverId, u.hoverAmount, u.prevId, u.prevAmount);
        gl.uniform4fv(U.uRing, u.rings);
        gl.drawArrays(gl.POINTS, 0, count);
      },
      clear() { gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT); },
      lost: () => gl.isContextLost(),
      dispose() {
        for (const b of Object.values(buffers)) gl.deleteBuffer(b);
        gl.deleteProgram(program);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    };
  }

  /*
   * Canvas2D fallback: plots the particles of the visible cell rows into an ImageData
   * at DPR 1 (wind, scroll lag, fades and colours; no puff, rings or shimmer).
   */
  function pixelRenderer(canvas, state) {
    const g = canvas.getContext('2d');
    if (!g) return null;
    let image = null; let pixels = null;
    return {
      kind: 'canvas2d',
      upload() {}, uploadDelays() {}, uploadOffsets() {},
      draw(u) {
        const w = canvas.width; const h = canvas.height;
        if (!image || image.width !== w || image.height !== h) { image = g.createImageData(w, h); pixels = new Uint32Array(image.data.buffer); }
        pixels.fill(0);
        const d = state.data; const off = state.off; const delays = state.delays;
        const r0 = clamp(Math.floor((u.scrollY - LAG_MAX) / CELL) - 1, 0, d.rows - 1);
        const r1 = clamp(Math.ceil((u.scrollY + h + LAG_MAX) / CELL) + 1, 0, d.rows - 1);
        const from = d.cellStart[r0 * d.cols]; const to = d.cellStart[(r1 + 1) * d.cols];
        const n = u.night;
        for (let i = from; i < to; i++) {
          const e = clamp((u.enterT - delays[i * 2]) / ENTER_DUR, 0, 1);
          const x = u.exitT < 0 ? 0 : clamp((u.exitT - delays[i * 2 + 1]) / EXIT_DUR, 0, 1);
          const k = i * 8; const c = d.colours;
          let a = ((c[k + 3] + (c[k + 7] - c[k + 3]) * n) / 255) * smooth(0, 0.15, e) * (1 - smooth(0.6, 1, x));
          if (a < 0.02) continue;
          const settle = 1 - smooth(0, 0.7, x);
          const px = Math.round(d.statics[i * 6] + off[i * 2] * settle - u.scrollX);
          const py = Math.round(d.statics[i * 6 + 1] + off[i * 2 + 1] * settle - u.scrollY - u.lag * 0.5);
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const hover = (d.statics[i * 6 + 4] === u.hoverId ? u.hoverAmount : 0) * n;
          a = Math.min(1, a * (1 + 0.5 * hover));
          const mix = ch => (c[k + ch] + (c[k + 4 + ch] - c[k + ch]) * n) * (1 - 0.45 * hover) + 255 * 0.45 * hover;
          const p = py * w + px; const old = pixels[p];
          const keep = 1 - a;
          const rr = mix(0) * a + (old & 255) * keep; const gg = mix(1) * a + ((old >>> 8) & 255) * keep;
          const bb = mix(2) * a + ((old >>> 16) & 255) * keep; const aa = 255 * a + (old >>> 24) * keep;
          pixels[p] = ((aa & 255) << 24 | (bb & 255) << 16 | (gg & 255) << 8 | (rr & 255)) >>> 0;
        }
        g.putImageData(image, 0, 0);
      },
      clear() { g.clearRect(0, 0, canvas.width, canvas.height); },
      lost: () => false,
      dispose() { image = null; pixels = null; }
    };
  }

  /* ---------------------------------------------------------------------------
   * Ink: crisp sprites of the page's words (and the portrait) for the transitions
   * ------------------------------------------------------------------------- */
  // Day and night sprites of every word on the lines near the viewport, in device
  // pixels, so that at full alpha each sprite is blitted 1:1 onto its glyphs.
  function buildInk(state) {
    const dpr = state.dpr; const sx = window.scrollX; const sy = window.scrollY;
    const top = sy - 0.25 * state.H; const bottom = sy + 1.25 * state.H;
    const lines = state.lines.filter(line => line.bottom > top && line.top < bottom);
    const measure = makeCanvas(1, 1).getContext('2d');
    const native = 'letterSpacing' in measure;
    const heights = [0]; let page = 0; let x = 0; let y = 0; let shelf = 0;
    const place = (w, h) => {
      if (x + w > ATLAS_W) { x = 0; y += shelf + 2; shelf = 0; }
      if (y + h > ATLAS_H) { page++; heights.push(0); x = 0; y = 0; shelf = 0; }
      const spot = [page, x, y];
      x += w + 2; shelf = Math.max(shelf, h); heights[page] = Math.max(heights[page], y + h);
      return spot;
    };
    const items = [];
    for (const line of lines) {
      line.ink = [];
      for (const w of line.words) {
        const size = w.style.size;
        const left = w.docLeft - sx; const wtop = w.docTop - sy;
        const padX = Math.ceil((2 + 0.3 * size) * dpr); const padY = Math.ceil((2 + 0.25 * size) * dpr);
        const ox = Math.floor(left * dpr) - padX; const oy = Math.floor(wtop * dpr) - padY;
        const sw = Math.ceil((left + w.width) * dpr) + padX - ox; const sh = Math.ceil((wtop + w.height) * dpr) + padY - oy;
        if (sw > ATLAS_W || sh > ATLAS_H) continue;
        const item = { w, left, top: wtop, ox, oy, sw, sh, day: place(sw, sh), night: place(sw, sh) };
        line.ink.push(item); items.push(item);
      }
    }
    const atlases = heights.map(h => makeCanvas(ATLAS_W, Math.max(1, h)));
    const contexts = atlases.map(c => c.getContext('2d'));
    for (const item of items) {
      const style = item.w.style;
      for (const [spot, colour] of [[item.day, style.dayCss], [item.night, style.nightCss]]) {
        const g = contexts[spot[0]];
        g.save();
        g.beginPath(); g.rect(spot[1], spot[2], item.sw, item.sh); g.clip();
        g.setTransform(dpr, 0, 0, dpr, spot[1] - item.ox, spot[2] - item.oy);
        g.font = style.font; g.fillStyle = colour; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        if (native) g.letterSpacing = `${style.spacing}px`;
        fillSpaced(g, item.w.text, item.left, Math.round(item.top + style.ascent), style.spacing, native);
        g.restore();
      }
    }
    // The portrait with its border, pre-scaled to device pixels and drawn in strips.
    let photo = null;
    const box = state.photo;
    if (box && box.top + box.height > top && box.top < bottom) {
      const left = Math.round((box.left - sx) * dpr); const ptop = Math.round((box.top - sy) * dpr);
      const w = Math.round(box.width * dpr); const h = Math.round(box.height * dpr);
      const c = makeCanvas(w, h); const g = c.getContext('2d');
      g.globalAlpha = box.opacity;
      g.fillStyle = box.borderColour; g.fillRect(0, 0, w, h);
      const [bt, br, bb, bl] = box.border.map(v => Math.round(v * dpr));
      g.clearRect(bl, bt, w - bl - br, h - bt - bb);
      const [pt, pr, pb, pl] = box.pad.map(v => v * dpr);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      try { g.drawImage(box.img, bl + pl, bt + pt, w - bl - br - pl - pr, h - bt - bb - pt - pb); } catch (error) { /* drawn blank */ }
      const strip = Math.max(1, Math.round(PHOTO_STRIP * dpr));
      const strips = [];
      for (let s = 0; s < h; s += strip) strips.push({ y: s, h: Math.min(strip, h - s), docY: box.top + (s + strip / 2) / dpr, delayIn: -10, delayOut: 0 });
      photo = { canvas: c, left, top: ptop, w, h, strips };
    }
    return { lines, atlases, photo, scrollX: sx, scrollY: sy };
  }

  /* ---------------------------------------------------------------------------
   * The lens
   * ------------------------------------------------------------------------- */
  let st = null;                         // the live activation
  let lastPerf = null;

  async function enter(ctx) {
    if (st && !st.dead) finishExit(st);  // a previous activation that was never exited
    const state = st = createState(ctx);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      if (state.dead || ctx.signal.aborted) return;
      if (!(await build(state, true)) || state.dead || ctx.signal.aborted) return;
      await new Promise(resolve => setTimeout(resolve, 0));
      if (state.dead || ctx.signal.aborted) return;
      mount(state);
      listen(state);
      const reduced = ctx.motion.matches;
      state.dayGround = dayGround();
      if (reduced) {
        // Instant: no ground transition, no ink, particles at rest.
        state.enterT = 1e4; state.night = 1; state.phase = 'live';
        swapIn(state, false);
        captionTone(state, 1);
        render(state, performance.now());
        return;
      }
      // Sweep timing: line by line from the top of the viewport.
      const y0 = state.enterScroll = window.scrollY; const H = state.H;
      const delayIn = y => ENTER_START + ENTER_SWEEP * clamp((y - y0) / H, 0, 1);
      for (const line of state.lines) line.delayIn = delayIn(line.mid);
      const d = state.data;
      for (let i = 0; i < d.n; i++) state.delays[i * 2] = delayIn(d.rowY[i]);
      state.renderer.uploadDelays(state.delays);
      const inkAt = performance.now();
      state.ink = buildInk(state);
      state.perf.enterInk = performance.now() - inkAt;
      if (state.ink.photo) for (const strip of state.ink.photo.strips) strip.delayIn = delayIn(strip.docY);
      state.enterEnd = Math.max(ENTER_START + ENTER_SWEEP + ENTER_DUR, GROUND_IN);
      state.enterAt = performance.now(); state.enterT = 0; state.night = 0;
      // The swap: the ink sprites are exactly the page's glyphs, drawn in the same task.
      drawInk(state);
      swapIn(state, true);
      state.phase = 'entering';
      wake(state);
      await new Promise(resolve => {
        state.entered = resolve;
        // Leaving (or a reset) before the enter has settled resolves it at once.
        ctx.signal.addEventListener('abort', () => { if (state.entered) { state.entered(); state.entered = null; } }, { once: true });
      });
    } catch (error) {
      // Never leave the page with hidden glyphs: restore, then let the core skip the lens.
      if (!state.dead) { finishExit(state); throw error; }
    }
  }

  function createState(ctx) {
    return {
      ctx, phase: 'build', dead: false, applied: new Set(), glyphs: false,
      W: 0, H: 0, dpr: 1, data: null, off: null, vel: null, delays: null,
      awake: null, awakeList: null, awakeCount: 0,
      words: [], lines: [], links: new Map(), photo: null,
      layer: null, renderer: null, canvas: null, inkCanvas: null, ink: null, inkG: null,
      enterAt: 0, enterT: 0, enterEnd: 0, exitAt: 0, exitT: -1, exitEnd: 0,
      night: 0, dayGround: [255, 255, 255], startedAt: performance.now(),
      pointer: { in: false, x: 0, y: 0, vx: 0, vy: 0, at: 0 },
      rings: new Float32Array(RING_MAX * 4), ringAt: new Float64Array(RING_MAX), ringNext: 0,
      hover: { id: -1, amount: 0, prevId: -1, prevAmount: 0, target: -1 },
      scrollSmooth: window.scrollY, lag: 0, lastScrollY: window.scrollY,
      ticking: false, unframe: null, frameToken: 0, lastRender: 0, dirty: true, ringsDrawn: false,
      rebuildTimer: 0, rebuildWanted: false, shimmerTimer: 0,
      perf: { frames: 0, total: 0, max: 0, last: 0, uploads: 0, uploaded: 0, render: 0, byPhase: {} },
      uniforms: {
        w: 0, h: 0, scrollX: 0, scrollY: 0, time: 0, shimmer: 0, night: 0, lag: 0,
        enterT: 0, exitT: -1, dpr: 1, hoverId: -1, hoverAmount: 0, prevId: -1, prevAmount: 0, rings: null
      }
    };
  }

  /*
   * Capture and sample the whole scope, then commit. With `chunked` (the enter) the work
   * yields to the event loop between atlas pages, so no single task is long; it resolves
   * false if the activation ended meanwhile. Allocates the simulation arrays.
   */
  async function build(state, chunked) {
    let busy = 0; let t0 = performance.now(); const began = t0;
    // Resolves true when the activation has ended (the caller stops).
    const pause = chunked ? () => new Promise(resolve => {
      busy += performance.now() - t0;
      setTimeout(() => { t0 = performance.now(); resolve(state.dead); }, 0);
    }) : null;
    const random = seeded(0x5eed);
    const captured = capture(state.ctx.scope);
    const t1 = performance.now();
    const list = particleList();
    await sampleWords(captured.words, list, random, pause);
    if (state.dead || (pause && await pause())) return false;
    const t2 = performance.now();
    const img = state.ctx.scope.map(root => root.querySelector(PHOTO_SELECTOR)).find(Boolean);
    const photo = samplePhoto(img, list, random);
    const t3 = performance.now();
    const data = freeze(list, captured.lines);
    state.words = captured.words; state.lines = captured.lines; state.links = captured.links;
    state.photo = photo; state.data = data;
    state.perf.steps = { capture: t1 - began, photo: t3 - t2, freeze: performance.now() - t3 };
    const n = state.data.n;
    state.off = new Float32Array(n * 2); state.vel = new Float32Array(n * 2);
    state.delays = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) state.delays[i * 2] = -10;
    state.awake = new Uint8Array(n); state.awakeList = new Int32Array(n); state.awakeCount = 0;
    state.perf.build = busy + performance.now() - t0;     // main-thread time, without the yields
    state.perf.particles = n; state.perf.words = state.words.length; state.perf.lines = state.lines.length;
    return true;
  }

  // The canvases fill the core's fixed layer; its size is the viewport they cover (on a
  // phone it follows the URL bar).
  function measureViewport(state) {
    const html = document.documentElement; const layer = state.layer;
    state.W = (layer && layer.clientWidth) || html.clientWidth || window.innerWidth;
    state.H = (layer && layer.clientHeight) || html.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    if (state.W * state.H * dpr * dpr > MAX_BACKING_PIXELS) dpr = Math.sqrt(MAX_BACKING_PIXELS / (state.W * state.H));
    state.dpr = dpr;
  }
  function sizeCanvases(state) {
    measureViewport(state);
    const dpr = state.renderer && state.renderer.kind === 'canvas2d' ? 1 : state.dpr;
    state.canvas.width = Math.max(1, Math.round(state.W * dpr)); state.canvas.height = Math.max(1, Math.round(state.H * dpr));
    state.inkCanvas.width = Math.max(1, Math.round(state.W * state.dpr)); state.inkCanvas.height = Math.max(1, Math.round(state.H * state.dpr));
  }
  function canvasEl() {
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    return c;
  }
  function mount(state) {
    const layer = state.layer = state.ctx.layer('fixed');
    state.inkCanvas = canvasEl(); state.canvas = canvasEl();
    layer.append(state.inkCanvas, state.canvas);
    state.inkG = state.inkCanvas.getContext('2d');
    measureViewport(state);
    let renderer = null;
    try { renderer = glRenderer(state.canvas); } catch (error) { renderer = null; }
    if (!renderer) {
      // A canvas keeps its first context type: the fallback needs a fresh one.
      const fresh = canvasEl(); state.canvas.replaceWith(fresh); state.canvas = fresh;
      renderer = pixelRenderer(fresh, state);
    }
    state.renderer = renderer;
    sizeCanvases(state);
    renderer.upload(state.data, state.off, state.delays);
    state.uniforms.rings = state.rings;
    state.perf.renderer = renderer.kind;
  }

  // Hide the glyphs (and the portrait) and turn the ground to night.
  function swapIn(state, animate) {
    const html = document.documentElement;
    state.hadClass = html.hasAttribute('class');
    const add = name => { html.classList.add(name); state.applied.add(name); };
    add(animate ? CLASS_GROUND : CLASS_STILL);
    add(CLASS_NIGHT);
    if (state.photo) add(CLASS_PHOTO);
    state.ctx.hideGlyphs(true); state.glyphs = true;
  }

  // The day ground under the lens: the theme's background colour.
  function dayGround() {
    const html = document.documentElement;
    const value = getComputedStyle(html).getPropertyValue('--bg-color').trim();
    const rgb = parseColour(value) || parseColour(getComputedStyle(document.body).backgroundColor);
    return rgb && rgb[3] > 0 ? rgb.slice(0, 3) : [255, 255, 255];
  }
  // How far the body's background has travelled from day to night (0..1), read from
  // the running CSS transition so that the ink and particles stay in step with it.
  function groundProgress(state) {
    const now = parseColour(getComputedStyle(document.body).backgroundColor);
    const day = state.dayGround;
    if (!now) return state.phase === 'exiting' ? 0 : 1;
    let num = 0; let den = 0;
    for (let k = 0; k < 3; k++) { const d = NIGHT_RGB[k] - day[k]; num += (now[k] - day[k]) * d; den += d * d; }
    return den < 1 ? (state.phase === 'exiting' ? 0 : 1) : clamp(num / den, 0, 1);
  }
  // The caption turns light when the ground passes mid-grey (it fades in on the day page).
  function captionTone(state, p) {
    if (p < 0.5 || state.applied.has(CLASS_CAPTION)) return;
    document.documentElement.classList.add(CLASS_CAPTION); state.applied.add(CLASS_CAPTION);
  }
  // Text colour follows the ground. On a light page it flips quickly as the ground passes
  // mid-grey, so the text is always on the far side of the ground and stays legible.
  function nightMix(state, p) {
    const day = state.dayGround;
    const light = (0.2126 * day[0] + 0.7152 * day[1] + 0.0722 * day[2]) / 255 > 0.5;
    return light ? smooth(0.44, 0.56, p) : p;
  }

  /* ---------------------------------------------------------------------------
   * Interaction
   * ------------------------------------------------------------------------- */
  function listen(state) {
    const { ctx } = state; const signal = ctx.signal;
    const opts = { passive: true, signal };
    const pointer = state.pointer;
    window.addEventListener('pointermove', event => {
      const now = performance.now();
      const dt = Math.max(0.004, (now - pointer.at) / 1000);
      if (pointer.in && now - pointer.at < 120) {
        // Smoothed client-space velocity of the pointer.
        const k = 0.5;
        pointer.vx += ((event.clientX - pointer.x) / dt - pointer.vx) * k;
        pointer.vy += ((event.clientY - pointer.y) / dt - pointer.vy) * k;
      } else { pointer.vx = 0; pointer.vy = 0; }
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.at = now; pointer.in = true;
      if (!ctx.motion.matches) wake(state);
    }, opts);
    const leave = () => { pointer.in = false; pointer.vx = 0; pointer.vy = 0; };
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) leave(); }, opts);
    window.addEventListener('blur', leave, opts);
    window.addEventListener('pointerup', event => { if (event.pointerType === 'touch') leave(); }, opts);
    window.addEventListener('pointercancel', leave, opts);
    window.addEventListener('pointerdown', event => {
      if (ctx.motion.matches || state.phase === 'exiting') return;
      const k = state.ringNext; state.ringNext = (k + 1) % RING_MAX;
      state.rings[k * 4] = event.clientX + window.scrollX; state.rings[k * 4 + 1] = event.clientY + window.scrollY;
      state.rings[k * 4 + 2] = 0; state.rings[k * 4 + 3] = 1; state.ringAt[k] = performance.now();
      wake(state);
    }, opts);
    window.addEventListener('scroll', () => wake(state), opts);
    window.addEventListener('resize', () => {
      // The canvases follow at once. Text reflows only with the width, so only then are the
      // particles re-sampled (a phone's URL bar changes the height alone).
      const width = state.W;
      sizeCanvases(state); state.dirty = true; wake(state);
      if (state.W !== width) scheduleRebuild(state);
    }, opts);
    // Links brighten under the pointer and with keyboard focus.
    const target = el => {
      const a = el && el.closest ? el.closest('a[href], button') : null;
      return a && state.links.has(a) ? state.links.get(a) : -1;
    };
    const setHover = id => {
      const h = state.hover;
      if (id === h.target) return;
      if (h.id !== id) { h.prevId = h.id; h.prevAmount = h.amount; h.id = id; h.amount = 0; }
      h.target = id;
      if (ctx.motion.matches) { h.amount = id > 0 ? 1 : 0; h.prevAmount = 0; }
      state.dirty = true; wake(state);
    };
    document.addEventListener('pointerover', event => setHover(target(event.target)), opts);
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) setHover(-1); }, opts);
    document.addEventListener('focusin', event => setHover(target(event.target)), opts);
    document.addEventListener('focusout', () => setHover(-1), opts);
    // Reduced motion switched on mid-lens: everything comes to rest at once.
    const onMotion = () => {
      if (ctx.motion.matches) { calm(state); state.dirty = true; }
      wake(state);
    };
    if (ctx.motion.addEventListener) ctx.motion.addEventListener('change', onMotion, { signal });
    // A theme switch changes the text colours; a reflow moves the words.
    const observer = new MutationObserver(() => scheduleRebuild(state));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let first = true;
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (first) { first = false; return; }
      scheduleRebuild(state);
    }) : null;
    if (resized) resized.observe(document.body);
    signal.addEventListener('abort', () => { observer.disconnect(); if (resized) resized.disconnect(); clearTimeout(state.rebuildTimer); }, { once: true });
    // Lost GPU context: fall back to drawing nothing until it is restored, then rebuild.
    state.canvas.addEventListener('webglcontextlost', event => event.preventDefault(), { signal });
    state.canvas.addEventListener('webglcontextrestored', () => scheduleRebuild(state, true), { signal });
  }

  function calm(state) {
    state.off.fill(0); state.vel.fill(0); state.awake.fill(0); state.awakeCount = 0;
    if (state.data.n) state.renderer.uploadOffsets(state.off, 0, state.data.n - 1);
    state.rings.fill(0); state.lag = 0; state.scrollSmooth = window.scrollY;
  }

  // Rebuild after a resize, a theme switch or a reflow (only while live).
  function scheduleRebuild(state, hard) {
    if (state.dead) return;
    if (hard) state.hardRebuild = true;
    clearTimeout(state.rebuildTimer);
    state.rebuildTimer = setTimeout(() => {
      if (state.dead || state.phase === 'exiting') return;
      if (state.phase !== 'live') { state.rebuildWanted = true; return; }
      rebuild(state);
    }, REBUILD_MS);
  }
  async function rebuild(state) {
    state.rebuildWanted = false;
    // Capture needs the page's own styles; the hidden glyphs keep their colours, so
    // only the portrait class (visibility) has to be lifted while it is measured.
    const html = document.documentElement;
    const photoHidden = html.classList.contains(CLASS_PHOTO);
    if (photoHidden) html.classList.remove(CLASS_PHOTO);
    const built = await build(state, false);   // not chunked: no frame passes before the class returns
    if (photoHidden) html.classList.add(CLASS_PHOTO);
    if (!built || state.dead) return;
    state.dayGround = dayGround();
    if (!state.photo) html.classList.remove(CLASS_PHOTO);
    else if (state.glyphs) { html.classList.add(CLASS_PHOTO); state.applied.add(CLASS_PHOTO); }
    if (state.hardRebuild || (state.renderer && state.renderer.lost && state.renderer.lost())) {
      state.hardRebuild = false;
      try { state.renderer.dispose(); } catch (error) { /* already gone */ }
      const layer = state.canvas.parentNode;
      const fresh = canvasEl(); layer.replaceChild(fresh, state.canvas); state.canvas = fresh;
      let renderer = null;
      try { renderer = glRenderer(fresh); } catch (error) { renderer = null; }
      if (!renderer) { const c2 = canvasEl(); layer.replaceChild(c2, fresh); state.canvas = c2; renderer = pixelRenderer(c2, state); }
      state.renderer = renderer;
    }
    sizeCanvases(state);
    state.renderer.upload(state.data, state.off, state.delays);
    state.dirty = true; wake(state);
  }

  /* ---------------------------------------------------------------------------
   * The frame
   * ------------------------------------------------------------------------- */
  // The core's shared loop calls tick() while it is registered; when nothing moves the
  // lens unregisters. Each registration carries a token, so a stale callback (if the
  // core keeps one) does nothing.
  function wake(state) {
    if (state.dead || state.ticking) return;
    state.ticking = true;
    const token = ++state.frameToken;
    const off = state.ctx.frame(dt => (token === state.frameToken ? tick(state, dt) : false));
    state.unframe = typeof off === 'function' ? off : null;
  }
  function sleep(state) {
    state.frameToken++;
    if (state.unframe) { state.unframe(); state.unframe = null; }
    state.ticking = false;
  }

  function tick(state, dt) {
    if (state.dead) return false;
    const began = performance.now();
    dt = clamp(dt > 0 ? dt : 1 / 60, 0, 0.05);
    const reduced = state.ctx.motion.matches;
    const phaseAtStart = state.phase;
    let busy = false;
    // Transitions
    if (state.phase === 'entering') {
      state.enterT = (began - state.enterAt) / 1000;
      const p = groundProgress(state);
      state.night = nightMix(state, p);
      captionTone(state, p);
      busy = true;
      if (state.enterT >= state.enterEnd && (p > 0.995 || state.enterT > state.enterEnd + SETTLE_SLACK)) finishEnter(state);
    } else if (state.phase === 'exiting') {
      state.exitT = (began - state.exitAt) / 1000;
      const p = groundProgress(state);
      state.night = nightMix(state, p);
      busy = true;
      if (state.exitT >= state.exitEnd && (p < 0.005 || state.exitT > state.exitEnd + SETTLE_SLACK)) {
        // The ink now shows every glyph in its day colour: swap back to the page itself.
        finishExit(state);
        if (lastPerf) lastPerf.finalFrameMs = performance.now() - began;
        return false;
      }
    }
    // Scroll lag: a smoothed scroll position trails the real one.
    const scrollY = window.scrollY;
    if (reduced) { state.scrollSmooth = scrollY; state.lag = 0; } else {
      state.scrollSmooth += (scrollY - state.scrollSmooth) * (1 - Math.exp(-dt / LAG_TAU));
      let lag = state.scrollSmooth - scrollY;
      if (Math.abs(lag) < 0.05) { state.scrollSmooth = scrollY; lag = 0; }
      state.lag = lag / (1 + Math.abs(lag) / LAG_MAX);
      if (lag) busy = true;
    }
    if (scrollY !== state.lastScrollY) { state.lastScrollY = scrollY; state.dirty = true; }
    // Wind (while leaving, disturbed particles only spring home)
    if ((state.awakeCount || (!reduced && state.pointer.in)) && stepWind(state, dt, reduced)) busy = true;
    // Rings
    let ringsLive = false;
    for (let k = 0; k < RING_MAX; k++) {
      if (state.rings[k * 4 + 3] <= 0) continue;
      const age = (began - state.ringAt[k]) / 1000;
      if (age > RING_LIFE || reduced) { state.rings[k * 4 + 3] = 0; state.rings[k * 4 + 2] = 0; state.dirty = true; continue; }
      state.rings[k * 4 + 2] = age; busy = true; ringsLive = true;
    }
    // Hover
    const h = state.hover;
    const goal = h.id > 0 ? 1 : 0;
    if (h.amount !== goal || h.prevAmount > 0) {
      const k = reduced ? 1 : 1 - Math.exp(-dt / HOVER_TAU);
      h.amount += (goal - h.amount) * k;
      h.prevAmount -= h.prevAmount * k;
      if (h.prevAmount < 0.01) { h.prevAmount = 0; h.prevId = -1; }
      if (Math.abs(h.amount - goal) < 0.01) h.amount = goal;
      busy = true; state.dirty = true;
    }
    if (state.phase === 'entering' || state.phase === 'exiting' || ringsLive || state.ringsDrawn) drawInk(state);
    const shimmer = !reduced && state.phase !== 'build';
    if (busy || state.dirty || (shimmer && began - state.lastRender >= 1000 / SHIMMER_FPS - 4)) render(state, began);
    const spent = performance.now() - began;
    const perf = state.perf;
    perf.frames++; perf.total += spent; perf.last = spent; if (spent > perf.max) perf.max = spent;
    const by = perf.byPhase[phaseAtStart] || (perf.byPhase[phaseAtStart] = { frames: 0, total: 0, max: 0 });
    by.frames++; by.total += spent; if (spent > by.max) by.max = spent;
    if (busy || state.dirty) return true;
    // Nothing moves. The slow shimmer alone needs SHIMMER_FPS frames: the shared loop rests
    // in between, and a timer wakes the lens for the next one.
    sleep(state);
    if (shimmer) {
      clearTimeout(state.shimmerTimer);
      state.shimmerTimer = setTimeout(() => wake(state), Math.max(0, 1000 / SHIMMER_FPS - (performance.now() - state.lastRender)));
    }
    return false;
  }

  function render(state, now) {
    const u = state.uniforms; const r0 = performance.now();
    u.w = state.W; u.h = state.H; u.scrollX = window.scrollX; u.scrollY = window.scrollY;
    u.time = (now - state.startedAt) / 1000; u.shimmer = state.ctx.motion.matches ? 0 : SHIMMER;
    u.night = state.night; u.lag = state.lag;
    u.enterT = state.phase === 'live' || state.phase === 'exiting' && state.enterT >= state.enterEnd ? 1e4 : state.enterT;
    u.exitT = state.phase === 'exiting' ? state.exitT : -1;
    u.dpr = state.renderer.kind === 'canvas2d' ? 1 : state.dpr;
    const h = state.hover;
    u.hoverId = h.id; u.hoverAmount = h.amount; u.prevId = h.prevId; u.prevAmount = h.prevAmount;
    state.renderer.draw(u);
    state.lastRender = now; state.dirty = false;
    state.perf.render = performance.now() - r0;
  }

  /*
   * The pointer as a gentle wind: particles within WIND_RADIUS are pushed away (and
   * along the pointer's motion) in proportion to its speed, then spring home with
   * damping. Only awake particles are integrated, and only their index range of the
   * offset buffer is uploaded.
   */
  function stepWind(state, dt, reduced) {
    const d = state.data; const off = state.off; const vel = state.vel; const st6 = d.statics;
    const awake = state.awake; const list = state.awakeList;
    const pointer = state.pointer;
    let lo = d.n; let hi = -1;
    // The pointer's speed fades when it stops moving.
    const quiet = (performance.now() - pointer.at) / 1000;
    if (quiet > 0.03) { const k = Math.exp(-dt / POINTER_TAU); pointer.vx *= k; pointer.vy *= k; }
    const speed = Math.hypot(pointer.vx, pointer.vy);
    const gust = reduced || state.phase === 'exiting' || !pointer.in ? 0 : Math.min(speed / WIND_SPEED_REF, WIND_GUST_MAX);
    if (gust > 0.02) {
      const px = pointer.x + window.scrollX; const py = pointer.y + window.scrollY;
      const ux = pointer.vx / (speed || 1); const uy = pointer.vy / (speed || 1);
      const R = WIND_RADIUS; const R2 = R * R; const reach = R + 8;
      const c0 = clamp(Math.floor((px - reach) / CELL), 0, d.cols - 1); const c1 = clamp(Math.floor((px + reach) / CELL), 0, d.cols - 1);
      const r0 = clamp(Math.floor((py - reach) / CELL), 0, d.rows - 1); const r1 = clamp(Math.floor((py + reach) / CELL), 0, d.rows - 1);
      const push = WIND_ACCEL * gust * dt;
      for (let row = r0; row <= r1; row++) {
        const from = d.cellStart[row * d.cols + c0]; const to = d.cellStart[row * d.cols + c1 + 1];
        for (let i = from; i < to; i++) {
          const x = st6[i * 6] + off[i * 2]; const y = st6[i * 6 + 1] + off[i * 2 + 1];
          const dx = x - px; const dy = y - py; const d2 = dx * dx + dy * dy;
          if (d2 >= R2) continue;
          const dist = Math.sqrt(d2) + 0.01; const fall = 1 - dist / R;
          const seed = st6[i * 6 + 2];
          const f = push * fall * fall * (0.3 + 1.4 * ((seed * 7.13) % 1));
          const nx = dx / dist; const ny = dy / dist;
          const swirl = WIND_SWIRL * (((seed * 31.37) % 1) - 0.5) * 2;
          vel[i * 2] += f * (nx * (1 - WIND_ALONG) + ux * WIND_ALONG - ny * swirl);
          vel[i * 2 + 1] += f * (ny * (1 - WIND_ALONG) + uy * WIND_ALONG + nx * swirl);
          if (!awake[i]) { awake[i] = 1; list[state.awakeCount++] = i; }
        }
      }
    }
    // Integrate the awake particles (semi-implicit Euler) and put the settled to sleep.
    let kept = 0;
    const damp = Math.exp(-DAMPING * dt);
    for (let k = 0; k < state.awakeCount; k++) {
      const i = list[k];
      const seed = st6[i * 6 + 2];
      const spring = SPRING * (0.6 + 0.8 * ((seed * 13.71) % 1));
      let vx = vel[i * 2]; let vy = vel[i * 2 + 1]; let ox = off[i * 2]; let oy = off[i * 2 + 1];
      vx = (vx - spring * ox * dt) * damp; vy = (vy - spring * oy * dt) * damp;
      ox += vx * dt; oy += vy * dt;
      // A soft bound keeps a hard flick from throwing dust across the page.
      const r = Math.hypot(ox, oy);
      if (r > DRIFT_MAX) { const s = DRIFT_MAX / r; ox *= s; oy *= s; vx *= 0.5; vy *= 0.5; }
      if (i < lo) lo = i; if (i > hi) hi = i;
      if (Math.abs(ox) < SLEEP_OFFSET && Math.abs(oy) < SLEEP_OFFSET && Math.abs(vx) < SLEEP_SPEED && Math.abs(vy) < SLEEP_SPEED) {
        off[i * 2] = 0; off[i * 2 + 1] = 0; vel[i * 2] = 0; vel[i * 2 + 1] = 0; awake[i] = 0;
        continue;
      }
      off[i * 2] = ox; off[i * 2 + 1] = oy; vel[i * 2] = vx; vel[i * 2 + 1] = vy;
      list[kept++] = i;
    }
    state.awakeCount = kept;
    if (hi >= lo) {
      state.renderer.uploadOffsets(off, lo, hi);
      state.perf.uploads++; state.perf.uploaded += hi - lo + 1;
      return true;
    }
    return gust > 0.02;
  }

  // The ink canvas: word sprites and portrait strips in transitions, rings while live.
  function drawInk(state) {
    const g = state.inkG; const ink = state.ink;
    const cw = state.inkCanvas.width; const ch = state.inkCanvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.clearRect(0, 0, cw, ch);
    state.ringsDrawn = false;
    if (ink && (state.phase === 'entering' || state.phase === 'exiting')) {
      const n = state.night;
      const dx = Math.round((ink.scrollX - window.scrollX) * state.dpr);
      const dy = Math.round((ink.scrollY - window.scrollY) * state.dpr);
      const eT = state.enterT;            // frozen once the exit begins
      const xT = state.phase === 'exiting' ? state.exitT : -1;
      const alphaOf = (delayIn, delayOut) => {
        const e = clamp((eT - delayIn) / ENTER_DUR, 0, 1);
        const x = xT < 0 ? 0 : clamp((xT - delayOut) / EXIT_DUR, 0, 1);
        return Math.max(inkEnter(e), inkExit(x));
      };
      for (const line of ink.lines) {
        const a = alphaOf(line.delayIn, line.delayOut);
        if (a < 0.004) continue;
        const dayA = a * (1 - n); const nightA = a * n;
        for (const item of line.ink) {
          const x = item.ox + dx; const y = item.oy + dy;
          if (x > cw || y > ch || x + item.sw < 0 || y + item.sh < 0) continue;
          if (dayA > 0.004) { g.globalAlpha = dayA; g.drawImage(ink.atlases[item.day[0]], item.day[1], item.day[2], item.sw, item.sh, x, y, item.sw, item.sh); }
          if (nightA > 0.004) { g.globalAlpha = nightA; g.drawImage(ink.atlases[item.night[0]], item.night[1], item.night[2], item.sw, item.sh, x, y, item.sw, item.sh); }
        }
      }
      const photo = ink.photo;
      if (photo) {
        for (const strip of photo.strips) {
          const a = alphaOf(strip.delayIn, strip.delayOut);
          if (a < 0.004) continue;
          g.globalAlpha = a;
          g.drawImage(photo.canvas, 0, strip.y, photo.w, strip.h, photo.left + dx, photo.top + dy + strip.y, photo.w, strip.h);
        }
      }
      g.globalAlpha = 1;
    }
    // Faint circles for the shockwaves.
    if (state.phase !== 'exiting' && !state.ctx.motion.matches) {
      const dpr = state.dpr;
      for (let k = 0; k < RING_MAX; k++) {
        const strength = state.rings[k * 4 + 3]; if (strength <= 0) continue;
        const age = state.rings[k * 4 + 2];
        const radius = age * RING_SPEED; if (radius < 1) continue;
        const a = RING_ALPHA * state.night * Math.exp(-age / RING_DECAY) * (1 - smooth(RING_LIFE * 0.6, RING_LIFE, age));
        if (a < 0.003) continue;
        g.globalAlpha = a;
        g.strokeStyle = 'rgb(205,218,236)'; g.lineWidth = dpr;
        g.beginPath();
        g.arc((state.rings[k * 4] - window.scrollX) * dpr, (state.rings[k * 4 + 1] - window.scrollY) * dpr, radius * dpr, 0, TAU);
        g.stroke();
        state.ringsDrawn = true;
      }
      g.globalAlpha = 1;
    }
  }

  function finishEnter(state) {
    state.phase = 'live'; state.enterT = 1e4; state.night = 1;
    captionTone(state, 1);
    state.ink = null;                    // the sprites are no longer needed
    drawInk(state);
    state.dirty = true;
    if (state.entered) { state.entered(); state.entered = null; }
    if (state.rebuildWanted) rebuild(state);
  }

  async function exit(ctx) {
    const state = st;
    if (!state || state.dead) return;
    if (state.entered) { state.entered(); state.entered = null; }   // an enter in progress gives way
    const instant = ctx.instant === true || ctx.motion.matches || !state.data || !state.renderer || state.phase === 'build';
    if (instant) { finishExit(state); return; }
    if (state.phase === 'exiting') return state.exited;
    // Freeze the enter where it stands; a line still in ink stays ink.
    const wasEntering = state.phase === 'entering';
    if (!wasEntering) state.enterT = 1e4;
    state.phase = 'exiting';
    const y0 = window.scrollY; const H = state.H;
    const delayOut = y => EXIT_SWEEP * clamp((y - y0) / H, 0, 1);
    for (const line of state.lines) line.delayOut = delayOut(line.mid);
    const d = state.data;
    for (let i = 0; i < d.n; i++) state.delays[i * 2 + 1] = delayOut(d.rowY[i]);
    state.renderer.uploadDelays(state.delays);
    // Fresh ink for the current viewport (the night classes leave the text colours alone).
    const inkAt = performance.now();
    state.ink = buildInk(state);
    state.perf.exitBuild = performance.now() - inkAt;
    if (state.ink.photo) {
      const delayIn = y => (wasEntering ? ENTER_START + ENTER_SWEEP * clamp((y - state.enterScroll) / H, 0, 1) : -10);
      for (const strip of state.ink.photo.strips) { strip.delayIn = delayIn(strip.docY); strip.delayOut = delayOut(strip.docY); }
    }
    state.exitEnd = Math.max(EXIT_SWEEP + EXIT_DUR, GROUND_OUT);
    state.exitAt = performance.now(); state.exitT = 0;
    const html = document.documentElement;
    html.classList.add(CLASS_GROUND, CLASS_LEAVING); state.applied.add(CLASS_GROUND); state.applied.add(CLASS_LEAVING);
    html.classList.remove(CLASS_NIGHT);
    state.exited = new Promise(resolve => { state.resolveExit = resolve; });
    wake(state);
    // If frames stop (a hidden tab), finish on a timer.
    state.exitTimer = setTimeout(() => finishExit(state), (state.exitEnd + SETTLE_SLACK + 0.6) * 1000);
    return state.exited;
  }

  // Complete restoration: glyphs back, classes off, canvases cleared, GPU released.
  function finishExit(state) {
    if (state.dead) return;
    state.dead = true;
    clearTimeout(state.exitTimer); clearTimeout(state.rebuildTimer); clearTimeout(state.shimmerTimer);
    if (state.glyphs) { state.ctx.hideGlyphs(false); state.glyphs = false; }
    const html = document.documentElement;
    if (html.classList.contains(CLASS_NIGHT)) {
      // An instant exit: the day returns without the site's own colour fades. The still
      // class stays until the change is flushed. (An animated exit has finished its fades.)
      html.classList.add(CLASS_STILL);
      for (const name of state.applied) if (name !== CLASS_STILL) html.classList.remove(name);
      for (const el of document.querySelectorAll(MARKS)) void getComputedStyle(el).color;
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLASS_STILL);
    } else {
      for (const name of state.applied) html.classList.remove(name);
    }
    state.applied.clear();
    if (!state.hadClass && html.hasAttribute('class') && !html.classList.length) html.removeAttribute('class');
    // The canvases vanish at once; the GPU and backing stores are released just after.
    const renderer = state.renderer; const canvases = [state.canvas, state.inkCanvas].filter(Boolean);
    canvases.forEach(c => { c.style.display = 'none'; });
    setTimeout(() => {
      if (renderer) { try { renderer.dispose(); } catch (error) { /* context gone */ } }
      canvases.forEach(c => { c.width = 1; c.height = 1; });
    }, 0);
    sleep(state);
    state.ink = null; state.data = null; state.off = state.vel = state.delays = null;
    state.phase = 'done';
    lastPerf = { byPhase: state.perf.byPhase, exitBuildMs: state.perf.exitBuild, buildMs: state.perf.build, enterInkMs: state.perf.enterInk };
    if (state.entered) { state.entered(); state.entered = null; }
    if (state.resolveExit) { state.resolveExit(); state.resolveExit = null; }
    if (st === state) st = null;
  }

  const lens = {
    id: 'stardust', order: 1, numeral: 'I', label: 'Stardust',
    line: 'Every letter is made of smaller things.',
    css: true,
    enter, exit,                          // no caption(): the static line shows as the enter begins
    // Test hook: counts and frame timing of the live activation.
    get _stats() {
      if (!st) return null;
      const p = st.perf;
      return {
        phase: st.phase, renderer: p.renderer, particles: p.particles, words: p.words, lines: p.lines,
        buildMs: +(p.build || 0).toFixed(1), frames: p.frames, avgMs: p.frames ? +(p.total / p.frames).toFixed(3) : 0,
        maxMs: +p.max.toFixed(2), lastMs: +p.last.toFixed(3), awake: st.awakeCount,
        uploads: p.uploads, avgUploaded: p.uploads ? Math.round(p.uploaded / p.uploads) : 0, renderMs: +p.render.toFixed(3),
        exitBuildMs: +(p.exitBuild || 0).toFixed(1), enterInkMs: +(p.enterInk || 0).toFixed(1),
        steps: p.steps && Object.fromEntries(Object.entries(p.steps).map(([k, v]) => [k, +v.toFixed(1)])),
        byPhase: Object.fromEntries(Object.entries(p.byPhase).map(([k, v]) => [k, { frames: v.frames, avgMs: +(v.total / v.frames).toFixed(3), maxMs: +v.max.toFixed(2) }]))
      };
    },
    _reset() { if (st) { Object.assign(st.perf, { frames: 0, total: 0, max: 0, uploads: 0, uploaded: 0, byPhase: {} }); } },
    // Test hook: the timing of the last activation, kept after its exit.
    get _lastPerf() { return lastPerf; }
  };

  if (window.SiteLenses && typeof window.SiteLenses.register === 'function') window.SiteLenses.register(lens);
})();
