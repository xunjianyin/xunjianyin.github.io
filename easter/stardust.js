/**
 * Lens I · Stardust: "Every letter is made of smaller things."
 *
 * Every glyph in the lens scope is redrawn as fine luminous particles on a night
 * ground. Each word is rendered offscreen in its exact computed font and sampled on
 * a grid of about 0.09 em; a particle sits at the ink centroid of every covered cell,
 * so letters keep their shape and stay readable. The homepage portrait becomes a
 * point cloud of its own luminance.
 *
 * The page DOM is never edited. The core hides the glyphs (links, buttons and demo
 * controls stay usable under the particles); this lens adds classes on <html> for the
 * night ground and draws on two canvases in the core's fixed layer:
 *   - ink (Canvas2D), used in transitions only: crisp word sprites in device pixels,
 *     identical to the page's glyphs, dissolve into dust on enter and condense back
 *     on exit. It also draws the faint shockwave rings.
 *   - dust (WebGL2, else WebGL1; a Canvas2D pixel plotter without WebGL): points in
 *     groups, one draw call each. Home positions, colours and seeds are static buffers;
 *     the vertex shader computes the shimmer, the enter puff, the exit condensation,
 *     shockwaves, the scroll lag and link highlights from uniforms. Only the pointer
 *     wind is simulated on the CPU, for the particles it has disturbed, and only that
 *     range of the offsets is uploaded.
 *
 * Long pages are windowed. Text in normal flow is cut into bands of the document,
 * built for the viewport and 1.5 screens either side in slices of a few milliseconds
 * and evicted far away. Text inside a container that clips and scrolls (a wide table
 * on a phone, a citation block) or that is fixed or sticky forms its own group, which
 * follows the container and is clipped to it. Late content (rendered markdown, demos,
 * toggled abstracts) is re-measured; only groups whose words changed are re-sampled.
 *
 * On a light page the main column is inverted (hue kept): light panels sink into the
 * night, borders become faint, colour tints that carry data stay distinguishable, and
 * SVG figures turn into light ink. Images, canvases and video are filtered back and
 * dimmed, so they show as dimmed originals.
 */
(() => {
  'use strict';

  /* ---------------------------------------------------------------------------
   * Constants. Lengths are CSS px, times are seconds unless marked ms.
   * ------------------------------------------------------------------------- */
  const NIGHT_RGB = [6, 8, 12];          // the ground, #06080c (stardust.css and the pre-paint rule use it)
  const PHOTO_SELECTOR = '.profile-photo';
  const CLASS_NIGHT = 'lens-stardust';           // the night (ground, inversion, marks)
  const CLASS_BODY = 'lens-stardust-body';       // the body paints its own ground: turn it to night too
  const CLASS_INVERT = 'lens-stardust-invert';   // a light page: the main column is inverted
  const CLASS_GROUND = 'lens-stardust-ground';   // transitions for the ground; kept through the exit
  const CLASS_LEAVING = 'lens-stardust-leaving'; // the shorter exit duration
  const CLASS_PHOTO = 'lens-stardust-photo';     // hides the portrait under its point cloud
  const CLASS_STILL = 'lens-stardust-still';     // no transitions at all (reduced motion, arrival, instant exit)
  const CLASS_CAPTION = 'lens-stardust-caption'; // the core's caption in a light tone, once the ground is dark
  // Never drawn as particles: SVG text (painted with fill), form controls and editable text.
  const EXCLUDE = 'script, style, noscript, template, svg, textarea, select, option, input, [contenteditable]:not([contenteditable="false"])';
  // Marks whose colours stardust.css changes (flushed without transitions on an instant exit).
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
  const SAMPLE_PAGE_H = 64;              // one sampling pass renders this tall a strip of words (a taller word: its own)
  const LINE_SLACK = 3;                  // baselines within this many px form one line
  const THIN_ERODE = 0.28;               // css px shaved off ink sprites of antialiased (thinner) page text

  // Windowing
  const BAND_H = 512;                    // document bands for text in normal flow
  const BUILD_SCREENS = 1.5;             // build the viewport and this many screens either side ...
  const KEEP_SCREENS = 3.5;              // ... and evict groups farther than this
  const PARTICLE_CAP = 160000;           // live particles at most; the nearest groups win
  const SLICE_MS = 5;                    // building yields to the page after this much work (a step past it stays under 8 ms)
  const GROUP_FADE = 0.25;               // a group built while live fades in (it may be on screen)
  const ARRIVE_REST_MS = 600;            // arriving: after the first frame, the page's first paint goes first
  const CONTENT_MS = 200;                // class and style changes in the scope settle this long

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

  // Rendering budget (as the first egg)
  const DPR_MAX = 2;
  const MAX_BACKING_PIXELS = 8.3e6;
  const CELL = 24;                       // the wind's spatial grid

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
  const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }
  /*
   * Night colours. Greys become pale cool greys that keep their emphasis (dark body
   * text bright, muted text dimmer, headings and bold brightest); saturated colours
   * (links) become a pale tint of their own hue. On a light page, near-white text sits on
   * a dark fill that the inversion turns light, so it turns dark as well.
   */
  function nightColour([r, g, b], emphasis, darkPage) {
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    if ((max - min) / 255 < 0.16) {
      const l = luma([r, g, b]);
      if (!darkPage && l > 0.82) return [30, 33, 38];
      const strength = darkPage ? l : 1 - l;
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
  function fillSpaced(g, text, x, y, spacing, native, stroke = false) {
    const draw = stroke ? (t, px) => g.strokeText(t, px, y) : (t, px) => g.fillText(t, px, y);
    if (native || !spacing) { draw(text, x); return; }
    for (const ch of text) { draw(ch, x); x += g.measureText(ch).width + spacing; }
  }
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Yield to the page between slices of work (a message is not clamped like a timeout).
  let channel = null; const waiting = [];
  function nextTask() {
    if (!channel) { channel = new MessageChannel(); channel.port1.onmessage = () => { const go = waiting.shift(); if (go) go(); }; }
    return new Promise(resolve => { waiting.push(resolve); channel.port2.postMessage(0); });
  }
  function hashString(text, h = 2166136261) {
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  /* ---------------------------------------------------------------------------
   * The page model: every visible text node of the scope, where it is and how it
   * looks, rebuilt (in slices) whenever the content or the layout changes.
   * ------------------------------------------------------------------------- */
  // Is the page light (dark text)? Read from the main text, which no pre-paint rule touches.
  function pageIsLight(scope) {
    const main = document.getElementById('main-content') || scope[0] || document.body;
    const colour = parseColour(getComputedStyle(main).color);
    return !colour || luma(colour) < 0.5;
  }

  async function buildModel(state) {
    const scope = state.ctx.scope;
    const model = {
      gen: ++state.gen, entries: [], boxes: new Map(), words: new Map(),
      styles: new Map(), opacities: new Map(), anchors: new Map(), excluded: new Map(), sizes: new Map(),
      darkPage: !state.light, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight
    };
    const html = document.documentElement;
    const sx = window.scrollX; const sy = window.scrollY;
    const measure = state.measure || (state.measure = makeCanvas(1, 1).getContext('2d'));
    // (The body's own opacity is left out: it is 0 while a lens arrives with the page.)
    const opacityOf = el => {
      if (!el || el === html || el === document.body) return 1;
      if (model.opacities.has(el)) return model.opacities.get(el);
      const value = (parseFloat(getComputedStyle(el).opacity) || 0) * opacityOf(el.parentElement);
      model.opacities.set(el, value);
      return value;
    };
    const styleOf = el => {
      if (model.styles.has(el)) return model.styles.get(el);
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
          thin: cs.webkitFontSmoothing === 'antialiased',
          ascent: metrics.fontBoundingBoxAscent || size * 0.8,
          day, night: nightColour(day, emphasis, model.darkPage).concat(alpha),
          dayCss: `rgba(${day[0]},${day[1]},${day[2]},${alpha.toFixed(3)})`
        };
        info.nightCss = `rgba(${info.night.slice(0, 3).map(Math.round).join(',')},${alpha.toFixed(3)})`;
        info.key = `${font}|${info.dayCss}|${info.spacing}|${info.transform}`;
      }
      model.styles.set(el, info);
      return info;
    };
    const excluded = el => {
      if (model.excluded.has(el)) return model.excluded.get(el);
      const value = !!el.closest(EXCLUDE);
      model.excluded.set(el, value);
      return value;
    };
    // Visually hidden text (a 1 px clip box) is not drawn by the page either.
    const tiny = el => {
      if (model.sizes.has(el)) return model.sizes.get(el);
      const r = el.getBoundingClientRect();
      const value = r.width <= 1 || r.height <= 1 ? null : [r.top + sy, r.bottom + sy];
      model.sizes.set(el, value);
      return value;
    };
    // A box anchors text that does not move with the page alone: the innermost ancestor
    // that is fixed, sticky (and can stick), or that clips content which overflows it.
    const clips = cs => cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    const overflows = el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    const ownAnchor = (el, root) => {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return true;
      if (cs.position === 'sticky') {
        for (let a = el.parentElement; a && a !== html; a = a.parentElement) {
          if (clips(getComputedStyle(a))) return overflows(a);
          if (a === root) break;
        }
        return true;                   // it sticks to the page
      }
      return clips(cs) && overflows(el);
    };
    const anchorOf = (el, root) => {
      if (model.anchors.has(el)) return model.anchors.get(el);
      let value = null;
      if (ownAnchor(el, root)) value = el;
      else if (el !== root && el.parentElement) value = anchorOf(el.parentElement, root);
      model.anchors.set(el, value);
      return value;
    };
    let began = performance.now();
    for (const root of scope) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (performance.now() - began > SLICE_MS) {
          if (performance.now() - began > (state.perf.sliceMax || 0)) state.perf.sliceMax = performance.now() - began;
          await nextTask();
          if (state.dead || state.gen !== model.gen) return null;
          began = performance.now();
        }
        const parent = node.parentElement;
        if (!parent || !/\S/.test(node.data) || excluded(parent)) continue;
        const style = styleOf(parent);
        if (!style) continue;
        const span = tiny(parent);
        if (!span) continue;
        const entry = { node, parent, style, link: linkId(state, parent), anchor: anchorOf(parent, root), top: span[0], bottom: span[1] };
        if (entry.anchor) {
          let box = model.boxes.get(entry.anchor);
          if (!box) box = makeBox(entry.anchor, root);
          model.boxes.set(entry.anchor, box);
          box.entries.push(entry);
        } else {
          model.entries.push(entry);
        }
      }
    }
    // Box placement on the page (for windowing) and its clip chain.
    for (const box of model.boxes.values()) {
      const r = box.el.getBoundingClientRect();
      box.top = r.top + sy; box.bottom = r.bottom + sy;
      if (box.fixed) { box.top = -Infinity; box.bottom = Infinity; }
    }
    model.entries.sort((a, b) => a.top - b.top);
    return model;
  }

  // A box group's anchor: what clips it, whether it lags with the page scroll, and whether
  // it hides what scrolls beneath it (a sticky table column with its own background).
  function makeBox(el, root) {
    const html = document.documentElement;
    const clipEls = []; let fixed = false; let rigid = false;
    const own = getComputedStyle(el);
    const bg = parseColour(own.backgroundColor);
    const occludes = (own.position === 'sticky' || own.position === 'fixed') && !!bg && bg[3] > 0.9;
    for (let a = el; a && a !== html; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') clipEls.push(a);
      if (cs.position === 'fixed') { fixed = true; rigid = true; }
      if (cs.position === 'sticky') rigid = true;
      if (a === root) break;
    }
    return { el, clipEls, fixed, occludes, lagShare: rigid ? 0 : 1, entries: [], top: 0, bottom: 0 };
  }

  // A link (or button) gets a stable id for the hover highlight.
  function linkId(state, el) {
    const a = el.closest('a[href], button, summary, [role="button"]');
    if (!a || !state.ctx.scope.some(root => root.contains(a))) return 0;
    let id = state.linkIds.get(a);
    if (!id) { id = ++state.linkCount; state.linkIds.set(a, id); }
    return id;
  }

  // The origin of a box's coordinates in the viewport: its content, as scrolled now.
  function boxOrigin(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + el.clientLeft - el.scrollLeft, y: r.top + el.clientTop - el.scrollTop };
  }

  /*
   * The words of a text node, measured once per model: text, box and style. x and y are
   * in the group's coordinates: the document for text in flow, a box's scrolled content
   * otherwise. `mid` is the document y of the word's middle (it picks the band).
   */
  function wordsOf(state, model, entry) {
    const cached = model.words.get(entry.node);
    if (cached) return cached;
    const words = [];
    const node = entry.node; const style = entry.style;
    const range = state.range || (state.range = document.createRange());
    const sx = window.scrollX; const sy = window.scrollY;
    const origin = entry.anchor ? boxOrigin(entry.anchor) : { x: -sx, y: -sy };
    const transform = (text, atStart) => {
      const mode = style.transform;
      if (mode === 'uppercase') return text.toUpperCase();
      if (mode === 'lowercase') return text.toLowerCase();
      if (mode === 'capitalize' && atStart) return text.charAt(0).toUpperCase() + text.slice(1);
      return text;
    };
    const take = (start, end, atStart) => {
      range.setStart(node, start); range.setEnd(node, end);
      const r = range.getBoundingClientRect();
      // The skip link waits above the page; nothing outside the document is drawn.
      if (!r.width || !r.height || r.bottom + sy < 0 || r.right + sx < 0) return;
      words.push({
        text: transform(node.data.slice(start, end), atStart),
        x: r.left - origin.x, y: r.top - origin.y, width: r.width, height: r.height,
        mid: (r.top + r.bottom) / 2 + sy, style, link: entry.link, line: -1
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
    model.words.set(entry.node, words);
    return words;
  }

  // Visual lines of a group: words whose baselines agree, in reading order from the top.
  function groupLines(words) {
    const order = words.map((w, i) => i);
    const base = i => words[i].y + words[i].style.ascent;
    order.sort((a, b) => base(a) - base(b) || words[a].x - words[b].x);
    const lines = []; let current = null;
    for (const i of order) {
      const w = words[i]; const b = base(i);
      if (!current || b - current.base > LINE_SLACK) {
        current = { base: b, top: w.y, bottom: w.y + w.height, words: [], delayIn: -10, delayOut: 0 };
        lines.push(current);
      }
      current.words.push(w);
      current.top = Math.min(current.top, w.y);
      current.bottom = Math.max(current.bottom, w.y + w.height);
      w.line = lines.length - 1;
    }
    for (const line of lines) line.mid = (line.top + line.bottom) / 2;
    return lines;
  }

  // A cheap fingerprint of what a group would draw: unchanged groups are kept.
  function signature(words, extra = '') {
    let h = hashString(extra);
    for (const w of words) h = hashString(`${w.text}|${Math.round(w.x * 4)}|${Math.round(w.y * 4)}|${w.style.key}|${w.link}`, h);
    return h;
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
   * One sampling pass, from words[from]: render a strip of words, white on transparent,
   * at SUPER pixels per grid step, read the alpha back once, and harvest. Each cell's
   * mean alpha is its ink coverage; the alpha-weighted mean of its subsamples is the ink
   * centroid, where the particle goes. Returns the index of the next word.
   */
  let sampler = null;
  function samplePass(words, from, list, random) {
    if (!sampler) {
      const canvas = makeCanvas(ATLAS_W, 1);
      const g = canvas.getContext('2d', { willReadFrequently: true });
      sampler = { canvas, g, native: 'letterSpacing' in g };
    }
    const { canvas, g, native } = sampler;
    let x = 0; let y = 0; let shelf = 0; let i = from; let pageH = SAMPLE_PAGE_H;
    for (; i < words.length; i++) {
      const w = words[i]; const st = w.style;
      const padX = Math.ceil(0.4 * st.size + Math.abs(st.spacing)); const padY = Math.ceil(0.2 * st.size);
      const cols = Math.ceil((w.width + 2 * padX) / st.step); const rows = Math.ceil((w.height + 2 * padY) / st.step);
      const pw = cols * SUPER; const ph = rows * SUPER;
      w.slot = null;
      if (pw > ATLAS_W || ph > ATLAS_H) continue;
      if (i === from && ph > pageH) pageH = ph;
      if (x + pw > ATLAS_W) { x = 0; y += shelf + 2; shelf = 0; }
      if (y + ph > pageH) break;
      w.slot = [x, y, cols, rows, padX, padY];
      x += pw + 2; shelf = Math.max(shelf, ph);
    }
    const height = y + shelf;
    if (!height) return Math.max(i, from + 1);
    canvas.height = height;              // also clears the strip
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    for (let k = from; k < i; k++) {
      const w = words[k]; if (!w.slot) continue;
      const [ax, ay, cols, rows, padX, padY] = w.slot; const st = w.style; const s = SUPER / st.step;
      g.save();
      g.beginPath(); g.rect(ax, ay, cols * SUPER, rows * SUPER); g.clip();
      g.setTransform(s, 0, 0, s, ax - (w.x - padX) * s, ay - (w.y - padY) * s);
      g.font = st.font;
      if (native) g.letterSpacing = `${st.spacing}px`;
      // The page paints each baseline on a whole CSS pixel (as measured for the first egg).
      fillSpaced(g, w.text, w.x, Math.round(w.y + st.ascent), st.spacing, native);
      g.restore();
    }
    // One 32-bit read per subsample; alpha is the top byte (little-endian RGBA).
    const pixels = new Uint32Array(g.getImageData(0, 0, ATLAS_W, height).data.buffer);
    const minSum = COVER_MIN * 255 * SUPER * SUPER;
    for (let k = from; k < i; k++) {
      const w = words[k]; if (!w.slot) continue;
      const [ax, ay, cols, rows, padX, padY] = w.slot; const st = w.style; const s = SUPER / st.step;
      const x0 = w.x - padX; const y0 = w.y - padY;
      // Larger type gets slightly larger grains (up to 1.4x for a name).
      const grain = clamp(st.step / (STEP_EM * 16), 1, 1.4);
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
          const b = smooth(COVER_MIN, COVER_FULL, sum / (255 * SUPER * SUPER));
          // Rim particles stay on the outline; inside a stroke they scatter more, like dust.
          const jitter = (JITTER[0] + (JITTER[1] - JITTER[0]) * b) * st.step;
          const px = x0 + (cx * SUPER + mx / sum) / s + (random() - 0.5) * 2 * jitter;
          const py = y0 + (cy * SUPER + my / sum) / s + (random() - 0.5) * 2 * jitter;
          const size = grain * (SIZE_MIN + (SIZE_MAX - SIZE_MIN) * clamp(b + (random() - 0.5) * 0.25, 0, 1));
          const alpha = st.day[3] * (ALPHA_MIN + (1 - ALPHA_MIN) * b) * (1 - GRAIN * random());
          // The row tag (>= 0) is the word's line; freeze() turns it into the line's middle.
          pushParticle(list, px, py, random(), size, w.link, st.size, w.line, st.day, st.night, alpha, alpha);
        }
      }
    }
    return i;
  }

  // The homepage portrait: luminance sampled into a point cloud in desaturated original colour.
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
        const l = luma([cr, cg, cb]);
        // Brightness by luminance with a little more contrast; the square's edges
        // fade into the night, so the cloud is an oval with soft borders.
        const vignette = 1 - smooth(0.68, 1.08, Math.hypot((i + 0.5) / cols * 2 - 1, (j + 0.5) / rows * 2 - 1));
        const glow = Math.pow(smooth(PHOTO_MIN_LUMA, 0.82, l), 0.85) * vignette;
        if (glow < 0.04) continue;
        const grey = l * 255;
        const night = [cr, cg, cb].map(v => Math.min(255, (grey + (v - grey) * (1 - PHOTO_DESATURATE)) * PHOTO_LIFT + 18));
        const x = cx + (i + 0.5 + (random() - 0.5) * 0.6) * dx;
        const y = cy + (j + 0.5 + (random() - 0.5) * 0.6) * dy;
        // Full alpha on the day page (it dissolves out of the photo), luminance at night.
        pushParticle(list, x, y, random(), 0.85 + 0.7 * glow, 0, PHOTO_FONT, -1 - y, [cr, cg, cb], night,
          (0.12 + 0.88 * glow) * box.opacity, box.opacity);
      }
    }
    return box;
  }

  /*
   * Freeze a list into GPU-ready arrays, sorted by grid cell (row-major over the group's
   * bounding box) so that the wind's neighbourhood is a few contiguous index ranges.
   */
  function freeze(list, lines) {
    const n = list.n;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = list.f[i * 8]; const y = list.f[i * 8 + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!n) { minX = minY = 0; maxX = maxY = 1; }
    const gx0 = Math.floor(minX / CELL) * CELL; const gy0 = Math.floor(minY / CELL) * CELL;
    const cols = Math.floor((maxX - gx0) / CELL) + 1; const rows = Math.floor((maxY - gy0) / CELL) + 1;
    const cellOf = new Int32Array(n); const counts = new Int32Array(cols * rows + 1);
    for (let i = 0; i < n; i++) {
      const cx = clamp(Math.floor((list.f[i * 8] - gx0) / CELL), 0, cols - 1);
      const cy = clamp(Math.floor((list.f[i * 8 + 1] - gy0) / CELL), 0, rows - 1);
      cellOf[i] = cy * cols + cx; counts[cellOf[i] + 1]++;
    }
    for (let k = 1; k <= cols * rows; k++) counts[k] += counts[k - 1];
    const cellStart = counts.slice();
    const fill = counts.slice(0, cols * rows);
    const statics = new Float32Array(n * 6);       // x, y, seed, size, link, font
    const colours = new Uint8ClampedArray(n * 8);  // day rgba, night rgba
    const rowY = new Float32Array(n);              // y that times the sweep (the line's middle, or own y)
    for (let i = 0; i < n; i++) {
      const to = fill[cellOf[i]]++;
      const f = i * 8; const s6 = to * 6; const c8 = to * 8;
      for (let k = 0; k < 6; k++) statics[s6 + k] = list.f[f + k];
      for (let k = 0; k < 8; k++) colours[c8 + k] = list.c[f + k];
      const tag = list.f[f + 6];
      rowY[to] = tag >= 0 ? lines[tag].mid : -1 - tag;
    }
    return { n, statics, colours, rowY, cellStart, cols, rows, gx0, gy0, x0: minX, y0: minY, x1: maxX, y1: maxY };
  }

  /* ---------------------------------------------------------------------------
   * WebGL renderer: one program; one draw call per group of points
   * ------------------------------------------------------------------------- */
  const VERTEX = `
precision highp float;
attribute vec2 aHome;
attribute vec4 aMeta;   // seed, size (css px), link id (0: none), font size (css px)
attribute vec4 aDay;    // colour on the day page, premultiplied in the shader
attribute vec4 aNight;  // colour on the night ground
attribute vec2 aOff;    // wind displacement (CPU, sparse)
attribute vec2 aDelay;  // start of this particle's line: enter, exit (s)
uniform vec4 uView;     // viewport w, h (css px)
uniform vec4 uGroup;    // the group's origin in the viewport (x, y), its share of the scroll lag, alpha
uniform vec4 uClock;    // shimmer time, shimmer amplitude, night mix, scroll lag
uniform vec3 uPhase;    // time since the enter began, since the exit began (<0: not leaving), dpr
uniform vec4 uHover;    // link id, amount; previous link id, amount
uniform vec4 uRing[${RING_MAX}];  // x, y (viewport), age (s), strength
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
  vec2 base = aHome + uGroup.xy;
  vec2 p = base + aOff * home + dir * reach * (puff * home + stir);
  float glow = 0.0;
  for (int k = 0; k < ${RING_MAX}; k++) {
    vec4 r = uRing[k];
    vec2 d = base - r.xy;
    float dist = length(d) + 0.001;
    float q = (dist - r.z * ${RING_SPEED.toFixed(1)}) / ${RING_WIDTH.toFixed(1)};
    float g = r.w * exp(-q * q - r.z / ${RING_DECAY.toFixed(3)}) / (1.0 + dist / 600.0);
    p += d / dist * g * ${RING_PUSH.toFixed(1)};
    glow += g;
  }
  // Scroll: the grains lag by an amount that grows down the screen, like sand.
  float lag = clamp(0.25 + 0.55 * p.y / uView.y + 0.2 * h2, 0.0, 1.0) * uGroup.z;
  vec2 s = vec2(p.x, p.y - uClock.w * lag);
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
  vec4 c = mix(aDay, aNight, uClock.z);
  float hover = (abs(aMeta.z - uHover.x) < 0.5 ? uHover.y : 0.0) + (abs(aMeta.z - uHover.z) < 0.5 ? uHover.w : 0.0);
  hover *= uClock.z;
  c.rgb = mix(c.rgb, vec3(1.0), 0.45 * hover);
  float a = c.a * (1.0 + uClock.y * sin(uClock.x * (0.5 + 0.9 * h2) + h3 * 6.2831853));
  a *= smoothstep(0.0, 0.15, e) * (1.0 - smoothstep(0.6, 1.0, x)) * (1.0 - 0.3 * puff) * uGroup.w;
  a = min(1.0, a * (1.0 + 0.5 * hover) + 0.3 * glow * uGroup.w);
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
    for (const loc of Object.values(A)) if (loc >= 0) gl.enableVertexAttribArray(loc);
    const U = {};
    for (const name of ['uView', 'uGroup', 'uClock', 'uPhase', 'uHover', 'uRing']) U[name] = gl.getUniformLocation(program, name);
    const pointer = (buffer, loc, size, type, normalised, stride, offset) => {
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(loc, size, type, normalised, stride, offset);
    };
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied "over"
    gl.clearColor(0, 0, 0, 0);
    const array = (data, usage) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b; };
    return {
      kind: v2 ? 'webgl2' : 'webgl1',
      // A group's buffers: statics and colours once, offsets and delays as they change.
      create(group) {
        const d = group.data;
        group.buf = {
          statics: array(d.statics, gl.STATIC_DRAW), colours: array(d.colours, gl.STATIC_DRAW),
          off: array(group.off, gl.DYNAMIC_DRAW), delay: array(group.delays, gl.DYNAMIC_DRAW)
        };
      },
      release(group) {
        if (!group.buf) return;
        for (const b of Object.values(group.buf)) gl.deleteBuffer(b);
        group.buf = null;
      },
      uploadDelays(group) {
        if (!group.buf) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, group.buf.delay); gl.bufferSubData(gl.ARRAY_BUFFER, 0, group.delays);
      },
      // Only the disturbed range of a group's offsets goes to the GPU.
      uploadOffsets(group, lo, hi) {
        if (!group.buf) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, group.buf.off);
        if (v2) gl.bufferSubData(gl.ARRAY_BUFFER, lo * 8, group.off, lo * 2, (hi - lo + 1) * 2);
        else gl.bufferSubData(gl.ARRAY_BUFFER, lo * 8, group.off.subarray(lo * 2, (hi + 1) * 2));
      },
      begin(u) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.SCISSOR_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform4f(U.uView, u.w, u.h, 0, 0);
        gl.uniform4f(U.uClock, u.time, u.shimmer, u.night, u.lag);
        gl.uniform3f(U.uPhase, u.enterT, u.exitT, u.dpr);
        gl.uniform4f(U.uHover, u.hoverId, u.hoverAmount, u.prevId, u.prevAmount);
        gl.uniform4fv(U.uRing, u.rings);
      },
      draw(group, u) {
        const b = group.buf; if (!b || !group.data.n) return;
        pointer(b.statics, A.home, 2, gl.FLOAT, false, 24, 0);
        pointer(b.statics, A.meta, 4, gl.FLOAT, false, 24, 8);
        pointer(b.colours, A.day, 4, gl.UNSIGNED_BYTE, true, 8, 0);
        pointer(b.colours, A.night, 4, gl.UNSIGNED_BYTE, true, 8, 4);
        pointer(b.off, A.off, 2, gl.FLOAT, false, 8, 0);
        pointer(b.delay, A.delay, 2, gl.FLOAT, false, 8, 0);
        gl.uniform4f(U.uGroup, group.origin.x, group.origin.y, group.lagShare, group.alpha);
        const c = group.clip;
        if (c) {
          // The scissor box is in device pixels from the bottom-left.
          const k = u.dpr; const x0 = Math.max(0, Math.floor(c.x0 * k)); const x1 = Math.min(canvas.width, Math.ceil(c.x1 * k));
          const y0 = Math.max(0, Math.floor((u.h - c.y1) * k)); const y1 = Math.min(canvas.height, Math.ceil((u.h - c.y0) * k));
          if (x1 <= x0 || y1 <= y0) return;
          gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
        } else {
          gl.disable(gl.SCISSOR_TEST);
        }
        gl.drawArrays(gl.POINTS, 0, group.data.n);
      },
      // Clear a box (viewport css px) of everything drawn so far.
      occlude(c, u) {
        const k = u.dpr; const x0 = Math.max(0, Math.floor(c.x0 * k)); const x1 = Math.min(canvas.width, Math.ceil(c.x1 * k));
        const y0 = Math.max(0, Math.floor((u.h - c.y1) * k)); const y1 = Math.min(canvas.height, Math.ceil((u.h - c.y0) * k));
        if (x1 <= x0 || y1 <= y0) return;
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0); gl.clear(gl.COLOR_BUFFER_BIT);
      },
      end() {},
      clear() { gl.viewport(0, 0, canvas.width, canvas.height); gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT); },
      lost: () => gl.isContextLost(),
      dispose(groups) {
        for (const group of groups) this.release(group);
        gl.deleteProgram(program);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    };
  }

  /*
   * Canvas2D fallback: plots the particles of the visible part of each group into an
   * ImageData at DPR 1 (wind, scroll lag, fades and colours; no puff, rings or shimmer).
   */
  function pixelRenderer(canvas) {
    const g = canvas.getContext('2d');
    if (!g) return null;
    let image = null; let pixels = null;
    return {
      kind: 'canvas2d',
      create() {}, release() {}, uploadDelays() {}, uploadOffsets() {},
      begin() {
        const w = canvas.width; const h = canvas.height;
        if (!image || image.width !== w || image.height !== h) { image = g.createImageData(w, h); pixels = new Uint32Array(image.data.buffer); }
        pixels.fill(0);
      },
      draw(group, u) {
        const d = group.data; if (!d.n) return;
        const w = canvas.width; const h = canvas.height; const off = group.off; const delays = group.delays;
        const ox = group.origin.x; const oy = group.origin.y - u.lag * 0.5 * group.lagShare;
        const c = group.clip || { x0: 0, y0: 0, x1: w, y1: h };
        const r0 = clamp(Math.floor((-oy - d.gy0 - LAG_MAX) / CELL) - 1, 0, d.rows - 1);
        const r1 = clamp(Math.ceil((h - oy - d.gy0 + LAG_MAX) / CELL) + 1, 0, d.rows - 1);
        const from = d.cellStart[r0 * d.cols]; const to = d.cellStart[(r1 + 1) * d.cols];
        const n = u.night; const col = d.colours;
        for (let i = from; i < to; i++) {
          const e = clamp((u.enterT - delays[i * 2]) / ENTER_DUR, 0, 1);
          const x = u.exitT < 0 ? 0 : clamp((u.exitT - delays[i * 2 + 1]) / EXIT_DUR, 0, 1);
          const k = i * 8;
          let a = ((col[k + 3] + (col[k + 7] - col[k + 3]) * n) / 255) * smooth(0, 0.15, e) * (1 - smooth(0.6, 1, x)) * group.alpha;
          if (a < 0.02) continue;
          const home = 1 - smooth(0, 0.7, x);
          const px = Math.round(d.statics[i * 6] + off[i * 2] * home + ox);
          const py = Math.round(d.statics[i * 6 + 1] + off[i * 2 + 1] * home + oy);
          if (px < c.x0 || py < c.y0 || px >= c.x1 || py >= c.y1 || px < 0 || py < 0 || px >= w || py >= h) continue;
          const hover = (d.statics[i * 6 + 4] === u.hoverId ? u.hoverAmount : 0) * n;
          a = Math.min(1, a * (1 + 0.5 * hover));
          const mix = ch => (col[k + ch] + (col[k + 4 + ch] - col[k + ch]) * n) * (1 - 0.45 * hover) + 255 * 0.45 * hover;
          const p = py * w + px; const old = pixels[p]; const keep = 1 - a;
          const rr = mix(0) * a + (old & 255) * keep; const gg = mix(1) * a + ((old >>> 8) & 255) * keep;
          const bb = mix(2) * a + ((old >>> 16) & 255) * keep; const aa = 255 * a + (old >>> 24) * keep;
          pixels[p] = ((aa & 255) << 24 | (bb & 255) << 16 | (gg & 255) << 8 | (rr & 255)) >>> 0;
        }
      },
      occlude(c) {
        const w = canvas.width; const h = canvas.height;
        const x0 = clamp(Math.floor(c.x0), 0, w); const x1 = clamp(Math.ceil(c.x1), 0, w);
        for (let y = clamp(Math.floor(c.y0), 0, h); y < clamp(Math.ceil(c.y1), 0, h); y++) pixels.fill(0, y * w + x0, y * w + x1);
      },
      end() { g.putImageData(image, 0, 0); },
      clear() { g.clearRect(0, 0, canvas.width, canvas.height); },
      lost: () => false,
      dispose() { image = null; pixels = null; }
    };
  }

  /* ---------------------------------------------------------------------------
   * Groups: a band of the document, or a box that follows its own container
   * ------------------------------------------------------------------------- */
  // Word lists for a band (text in flow whose middle falls in it) or a box (its text),
  // measured in slices. Resolves null if the build stopped.
  async function groupWords(state, model, spec, pause) {
    const words = [];
    const entries = spec.kind === 'band' ? model.entries : spec.box.entries;
    const y0 = spec.y0; const y1 = spec.y1;
    for (const entry of entries) {
      if (spec.kind === 'band') {
        if (entry.top > y1 + 40) break;
        if (entry.bottom < y0 - 40) continue;
      }
      for (const w of wordsOf(state, model, entry)) if (spec.kind !== 'band' || (w.mid >= y0 && w.mid < y1)) words.push(w);
      if (await pause()) return null;
    }
    return words;
  }

  // Build (or confirm) one group, in slices. Resolves with the group, or null if stopped.
  async function buildGroup(state, model, spec, old) {
    let began = state.sliceAt = performance.now();
    const pause = async () => {
      const spent = performance.now() - began;
      if (spent > (state.perf.sliceMax || 0)) state.perf.sliceMax = spent;
      if (spent < SLICE_MS) return false;
      await nextTask();
      began = state.sliceAt = performance.now();
      return state.dead || state.gen !== model.gen || state.phase === 'exiting';
    };
    const words = await groupWords(state, model, spec, pause);
    if (!words) return null;
    const lines = groupLines(words);
    // The homepage portrait belongs to the band that holds its middle.
    let photoImg = null;
    if (spec.kind === 'band' && state.photoImg) {
      const r = state.photoImg.getBoundingClientRect(); const mid = (r.top + r.bottom) / 2 + window.scrollY;
      if (mid >= spec.y0 && mid < spec.y1) photoImg = state.photoImg;
    }
    const sig = signature(words, photoImg ? `photo:${Math.round(photoImg.getBoundingClientRect().top + window.scrollY)}` : '');
    if (old && old.sig === sig && old.data) {
      // Nothing it draws has changed: keep the particles, take the fresh word records.
      old.gen = model.gen; old.words = words; old.lines = lines; old.spec = spec;
      if (spec.kind === 'box') old.box = spec.box;
      return old;
    }
    const random = seeded(spec.kind === 'band' ? 0x5eed + spec.k : hashString(spec.key));
    const list = particleList();
    for (let i = 0; i < words.length;) {
      i = samplePass(words, i, list, random);
      if (i < words.length && await pause()) return null;
    }
    let photo = null;
    if (photoImg) { if (await pause()) return null; photo = samplePhoto(photoImg, list, random); }
    if (await pause()) return null;
    const data = freeze(list, lines);
    // The upload that follows starts a slice of its own.
    await nextTask();
    state.sliceAt = performance.now();
    if (state.dead || state.gen !== model.gen || state.phase === 'exiting') return null;
    const n = data.n;
    const group = {
      key: spec.key, kind: spec.kind, spec, k: spec.k, box: spec.box || null, gen: model.gen, sig,
      words, lines, data, photo,
      off: new Float32Array(n * 2), vel: new Float32Array(n * 2), delays: new Float32Array(n * 2),
      awake: new Uint8Array(n), awakeList: new Int32Array(n), awakeCount: 0,
      buf: null, bornAt: performance.now(), fade: 0, alpha: 1,
      origin: { x: 0, y: 0 }, clip: null, visible: false, lagShare: spec.kind === 'box' ? spec.box.lagShare : 1
    };
    for (let i = 0; i < n; i++) group.delays[i * 2] = -10;
    return group;
  }

  // The groups the window needs, nearest first: bands in reach of the viewport, and boxes.
  function neededGroups(state, model) {
    const H = state.H; const sy = window.scrollY;
    const top = sy - BUILD_SCREENS * H; const bottom = sy + H + BUILD_SCREENS * H;
    const centre = sy + H / 2;
    // Distance: the gap between a group and the viewport (0 on screen), shorter ahead of the
    // scroll than behind it; ties go to the centre.
    const ahead = state.scrollDir || 1;
    const gap = (a, b) => {
      const below = a - (sy + H); const above = sy - b;
      if (below > 0) return below * (ahead > 0 ? 0.6 : 1.4);
      if (above > 0) return above * (ahead < 0 ? 0.6 : 1.4);
      return 0;
    };
    const near = (a, b) => Math.abs((a + b) / 2 - centre);
    const specs = [];
    const k0 = Math.max(0, Math.floor(top / BAND_H)); const k1 = Math.floor(Math.min(bottom, model.docH + BAND_H) / BAND_H);
    for (let k = k0; k <= k1; k++) {
      const y0 = k * BAND_H; const y1 = y0 + BAND_H;
      specs.push({ kind: 'band', key: `b${k}`, k, y0, y1, distance: gap(y0, y1), order: near(y0, y1) });
    }
    for (const box of model.boxes.values()) {
      if (!box.el.isConnected) continue;
      const fixedTop = box.fixed ? sy : box.top; const fixedBottom = box.fixed ? sy + H : box.bottom;
      if (fixedBottom < top || fixedTop > bottom) continue;
      let id = state.boxIds.get(box.el);
      if (!id) { id = ++state.boxCount; state.boxIds.set(box.el, id); }
      specs.push({ kind: 'box', key: `x${id}`, box, distance: gap(fixedTop, fixedBottom), order: near(Math.max(fixedTop, top), Math.min(fixedBottom, bottom)) });
    }
    specs.sort((a, b) => a.distance - b.distance || a.order - b.order);
    return specs;
  }

  // A new group in the window (it fades in), or a re-sampled one in place of the old.
  function addGroup(state, group, replaced, fade) {
    if (replaced) removeGroup(state, replaced);
    if (state.renderer) state.renderer.create(group);
    group.fade = fade && !replaced && !state.ctx.motion.matches ? GROUP_FADE : 0;
    group.bornAt = performance.now();
    state.groups.set(group.key, group);
    state.particles += group.data.n;
    state.dirty = true;
  }
  function removeGroup(state, group) {
    if (state.groups.get(group.key) === group) state.groups.delete(group.key);
    state.particles -= group.data ? group.data.n : 0;
    if (state.renderer) state.renderer.release(group);
    group.data = null;
  }

  /*
   * The builder: one at a time, brings the window up to date with the model (new bands,
   * re-measured groups after a change), nearest first, under the particle cap, and evicts
   * far groups. Re-run whenever the window or the content changes.
   */
  function schedule(state) {
    if (state.dead || state.phase === 'exiting') return;
    state.buildWanted = true;
    if (!state.building) runBuilder(state);
  }
  async function runBuilder(state) {
    state.building = true;
    try {
      while (state.buildWanted && !state.dead && state.phase !== 'exiting') {
        state.buildWanted = false;
        if (!state.model || state.modelStale) {
          state.modelStale = false;
          const m0 = performance.now();
          const model = await buildModel(state);
          state.perf.models = (state.perf.models || 0) + 1; state.perf.modelMs = performance.now() - m0;
          if (!model) { state.buildWanted = true; continue; }
          state.model = model;
        }
        await fillWindow(state, state.model, true);
      }
    } finally {
      state.building = false;
    }
  }
  async function fillWindow(state, model, fade) {
    const specs = neededGroups(state, model);
    const needed = new Set(specs.map(spec => spec.key));
    // Evict first what lies beyond reach (or whose container is gone) ...
    const sy = window.scrollY; const H = state.H;
    const keepTop = sy - KEEP_SCREENS * H; const keepBottom = sy + H + KEEP_SCREENS * H;
    const evict = force => {
      const far = [...state.groups.values()].filter(group => !needed.has(group.key))
        .map(group => { const [top, bottom] = groupSpan(group); return { group, top, bottom, d: Math.max(top - sy, sy - bottom) }; })
        .sort((a, b) => b.d - a.d);
      for (const { group, top, bottom } of far) {
        const gone = group.kind === 'box' && !group.box.el.isConnected;
        if (gone || bottom < keepTop || top > keepBottom || (force && state.particles > PARTICLE_CAP)) removeGroup(state, group);
      }
    };
    evict(false);
    // ... then build the window, nearest first. Near the cap a farther group (behind the
    // scroll, usually) makes room for a nearer one, or the window stops growing.
    const distanceOf = new Map(specs.map(spec => [spec.key, spec.distance]));
    for (const spec of specs) {
      if (state.dead || state.phase === 'exiting' || state.gen !== model.gen) return;
      const old = state.groups.get(spec.key) || null;
      if (old && old.gen === model.gen) continue;
      while (!old && spec.distance > 0 && state.particles > PARTICLE_CAP * 0.88) {
        let farthest = null; let far = spec.distance;
        for (const group of state.groups.values()) {
          const d = distanceOf.has(group.key) ? distanceOf.get(group.key) : Infinity;
          if (d > far) { far = d; farthest = group; }
        }
        if (!farthest) break;
        removeGroup(state, farthest);
      }
      if (!old && spec.distance > 0 && state.particles > PARTICLE_CAP * 0.88) break;
      const b0 = performance.now();
      const group = await buildGroup(state, model, spec, old);
      if (!group || state.dead || state.gen !== model.gen) return;
      if (group !== old) {
        state.perf.builds = (state.perf.builds || 0) + 1; state.perf.buildWall = (state.perf.buildWall || 0) + performance.now() - b0;
        addGroup(state, group, state.groups.get(spec.key) || null, fade);
        if (state.phase === 'entering') enterDelays(state, group, true);
      }
      if (state.particles > PARTICLE_CAP) trimToCap(state);
      // The slice that finished this group (freeze and upload included).
      state.perf.sliceMax = Math.max(state.perf.sliceMax || 0, performance.now() - state.sliceAt);
      await nextTask();
      wake(state);
    }
  }
  // Over the cap: drop the groups farthest from the viewport, never one on screen.
  function trimToCap(state) {
    const sy = window.scrollY; const H = state.H;
    const far = [...state.groups.values()]
      .map(group => { const [top, bottom] = groupSpan(group); return { group, d: Math.max(top - (sy + H), sy - bottom) }; })
      .filter(item => item.d > 0).sort((a, b) => b.d - a.d);
    for (const { group } of far) { if (state.particles <= PARTICLE_CAP) break; removeGroup(state, group); }
  }
  // A group's extent in document y (for eviction).
  function groupSpan(group) {
    if (group.kind === 'band') return [group.spec.y0, group.spec.y1];
    if (group.box.fixed) return [-Infinity, Infinity];
    const r = group.box.el.getBoundingClientRect();
    return [r.top + window.scrollY, r.bottom + window.scrollY];
  }

  // Where each group is this frame: its origin in the viewport, clip and visibility.
  function placeGroups(state) {
    const W = state.W; const H = state.H; const sx = window.scrollX; const sy = window.scrollY;
    const now = performance.now();
    for (const group of state.groups.values()) {
      const d = group.data; if (!d) continue;
      if (group.kind === 'band') {
        group.origin.x = -sx; group.origin.y = -sy; group.clip = null; group.cover = null;
        group.visible = d.y1 - sy > -LAG_MAX - 20 && d.y0 - sy < H + LAG_MAX + 20 && d.x1 - sx > -20 && d.x0 - sx < W + 20;
      } else {
        const el = group.box.el;
        if (!el.isConnected) { group.visible = false; continue; }
        const o = boxOrigin(el);
        group.origin.x = o.x; group.origin.y = o.y;
        let clip = null;
        for (const c of group.box.clipEls) {
          const r = c.getBoundingClientRect();
          const box = { x0: r.left + c.clientLeft, y0: r.top + c.clientTop, x1: r.left + c.clientLeft + c.clientWidth, y1: r.top + c.clientTop + c.clientHeight };
          clip = clip ? { x0: Math.max(clip.x0, box.x0), y0: Math.max(clip.y0, box.y0), x1: Math.min(clip.x1, box.x1), y1: Math.min(clip.y1, box.y1) } : box;
        }
        group.clip = clip;
        if (group.box.occludes) {
          const r = el.getBoundingClientRect();
          let c = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
          if (clip) c = { x0: Math.max(c.x0, clip.x0), y0: Math.max(c.y0, clip.y0), x1: Math.min(c.x1, clip.x1), y1: Math.min(c.y1, clip.y1) };
          group.cover = c;
        } else {
          group.cover = null;
        }
        const x0 = d.x0 + o.x; const x1 = d.x1 + o.x; const y0 = d.y0 + o.y; const y1 = d.y1 + o.y;
        group.visible = y1 > -LAG_MAX - 20 && y0 < H + LAG_MAX + 20 && x1 > -20 && x0 < W + 20 &&
          (!clip || (clip.x1 > clip.x0 && clip.y1 > clip.y0 && clip.y1 > 0 && clip.y0 < H));
      }
      group.alpha = group.fade > 0 ? clamp((now - group.bornAt) / 1000 / group.fade, 0, 1) : 1;
    }
  }

  // Enter timing for a group: line by line from the top of the viewport (or settled).
  function enterDelays(state, group, settled) {
    const d = group.data; if (!d) return;
    const oy = group.kind === 'band' ? -window.scrollY : boxOrigin(group.box.el).y;
    const H = state.H;
    const delay = y => (settled ? -10 : ENTER_START + ENTER_SWEEP * clamp((y + oy) / H, 0, 1));
    for (const line of group.lines) line.delayIn = delay(line.mid);
    for (let i = 0; i < d.n; i++) group.delays[i * 2] = delay(d.rowY[i]);
    state.renderer.uploadDelays(group);
  }
  function exitDelays(state, group) {
    const d = group.data; if (!d) return;
    const oy = group.origin.y; const H = state.H;
    const delay = y => EXIT_SWEEP * clamp((y + oy) / H, 0, 1);
    for (const line of group.lines) line.delayOut = delay(line.mid);
    for (let i = 0; i < d.n; i++) group.delays[i * 2 + 1] = delay(d.rowY[i]);
    state.renderer.uploadDelays(group);
  }

  /* ---------------------------------------------------------------------------
   * Ink: crisp sprites of the visible words (and the portrait) for the transitions
   * ------------------------------------------------------------------------- */
  // Day and night sprites of every word on visible lines, in device pixels, so that at
  // full alpha each sprite is blitted 1:1 onto its glyphs. Per group, as placed now.
  function buildInk(state) {
    const dpr = state.dpr; const H = state.H;
    const measure = state.measure || (state.measure = makeCanvas(1, 1).getContext('2d'));
    const native = 'letterSpacing' in measure;
    const heights = [0]; let page = 0; let x = 0; let y = 0; let shelf = 0;
    const place = (w, h) => {
      if (x + w > ATLAS_W) { x = 0; y += shelf + 2; shelf = 0; }
      if (y + h > ATLAS_H) { page++; heights.push(0); x = 0; y = 0; shelf = 0; }
      const spot = [page, x, y];
      x += w + 2; shelf = Math.max(shelf, h); heights[page] = Math.max(heights[page], y + h);
      return spot;
    };
    placeGroups(state);
    const items = []; const sets = [];
    for (const group of state.groups.values()) {
      if (!group.visible) continue;
      const o = { x: group.origin.x, y: group.origin.y };
      const set = { group, origin: o, lines: [] };
      for (const line of group.lines) {
        if (line.bottom + o.y < -0.25 * H || line.top + o.y > 1.25 * H) continue;
        line.ink = [];
        for (const w of line.words) {
          const size = w.style.size;
          const left = w.x + o.x; const top = w.y + o.y;
          const padX = Math.ceil((2 + 0.3 * size) * dpr); const padY = Math.ceil((2 + 0.25 * size) * dpr);
          const ox = Math.floor(left * dpr) - padX; const oy = Math.floor(top * dpr) - padY;
          const sw = Math.ceil((left + w.width) * dpr) + padX - ox; const sh = Math.ceil((top + w.height) * dpr) + padY - oy;
          if (sw > ATLAS_W || sh > ATLAS_H) continue;
          const item = { w, left, top, ox, oy, sw, sh, day: place(sw, sh), night: place(sw, sh) };
          line.ink.push(item); items.push(item);
        }
        set.lines.push(line);
      }
      if (set.lines.length || group.photo) sets.push(set);
    }
    sets.sort((a, b) => (a.group.cover ? 1 : 0) - (b.group.cover ? 1 : 0));
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
        const baseline = Math.round(item.top + style.ascent);
        fillSpaced(g, item.w.text, item.left, baseline, style.spacing, native);
        if (style.thin) {
          // -webkit-font-smoothing: antialiased draws thinner than canvas text: shave the rim.
          g.globalCompositeOperation = 'destination-out';
          g.lineWidth = THIN_ERODE; g.strokeStyle = '#000';
          fillSpaced(g, item.w.text, item.left, baseline, style.spacing, native, true);
        }
        g.restore();
      }
    }
    // The portrait with its border, pre-scaled to device pixels and drawn in strips.
    let photo = null;
    for (const group of state.groups.values()) {
      const box = group.photo;
      if (!box || !group.visible) continue;
      const sx = window.scrollX; const sy = window.scrollY;
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
      photo = { canvas: c, left, top: ptop, w, h, strips, scrollX: sx, scrollY: sy };
    }
    return { sets, atlases, photo };
  }

  /* ---------------------------------------------------------------------------
   * The lens
   * ------------------------------------------------------------------------- */
  let st = null;                         // the live activation
  let lastPerf = null;

  function createState(ctx) {
    return {
      ctx, phase: 'build', dead: false, applied: new Set(), glyphs: false, hadClass: false,
      W: 0, H: 0, dpr: 1, layer: null, renderer: null, canvas: null, inkCanvas: null, ink: null, inkG: null,
      gen: 0, model: null, modelStale: false, groups: new Map(), particles: 0, building: false, buildWanted: false,
      linkIds: new WeakMap(), linkCount: 0, boxIds: new WeakMap(), boxCount: 0, photoImg: null, light: true,
      enterAt: 0, enterT: 0, enterEnd: 0, exitAt: 0, exitT: -1, exitEnd: 0, enterScroll: 0,
      night: 0, dayGround: [255, 255, 255], groundBody: true, startedAt: performance.now(),
      pointer: { in: false, x: 0, y: 0, vx: 0, vy: 0, at: 0 },
      rings: new Float32Array(RING_MAX * 4), ringAt: new Float64Array(RING_MAX), ringNext: 0,
      ringView: new Float32Array(RING_MAX * 4),
      hover: { id: -1, amount: 0, prevId: -1, prevAmount: 0, target: -1 },
      scrollSmooth: window.scrollY, lag: 0, lastScrollY: window.scrollY, scrollDir: 1, lastScrollX: window.scrollX, windowAt: window.scrollY,
      ticking: false, unframe: null, frameToken: 0, lastRender: 0, dirty: true, ringsDrawn: false,
      shimmerTimer: 0, exitTimer: 0, contentTimer: 0, restTimer: 0,
      perf: { frames: 0, total: 0, max: 0, last: 0, uploads: 0, uploaded: 0, render: 0, byPhase: {} },
      uniforms: {
        w: 0, h: 0, time: 0, shimmer: 0, night: 0, lag: 0,
        enterT: 0, exitT: -1, dpr: 1, hoverId: -1, hoverAmount: 0, prevId: -1, prevAmount: 0, rings: null
      }
    };
  }

  // Prepare an activation: the model and the groups on screen, the canvases, the listeners.
  async function prepare(ctx) {
    if (st && !st.dead) finishExit(st);  // a previous activation that was never exited
    const state = st = createState(ctx);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (state.dead || ctx.signal.aborted) return null;
    const t0 = performance.now();
    state.light = pageIsLight(ctx.scope);
    state.photoImg = ctx.scope.map(root => root.querySelector(PHOTO_SELECTOR)).find(Boolean) || null;
    measureViewport(state);
    const model = await buildModel(state);
    if (!model || state.dead || ctx.signal.aborted) return null;
    state.model = model;
    // Only what is on screen before the swap; the rest of the window follows.
    const specs = neededGroups(state, model).filter(spec => spec.distance === 0);
    const groups = [];
    for (const spec of specs) {
      const group = await buildGroup(state, model, spec, null);
      if (!group || state.dead || ctx.signal.aborted) return null;
      groups.push(group);
    }
    mount(state);
    for (const group of groups) addGroup(state, group, null, false);
    listen(state);
    state.perf.prepareMs = performance.now() - t0;
    return state;
  }

  async function enter(ctx) {
    let state = null;
    try {
      state = await prepare(ctx);
      if (!state) return;
      // Read the day before anything changes it.
      readDay(state, false);
      if (ctx.motion.matches) {
        // Instant: no ground transition, no ink, particles at rest.
        state.enterT = 1e4; state.night = 1; state.phase = 'live';
        swapIn(state, false);
        captionTone(state, 1);
        render(state, performance.now());
        schedule(state);
        return;
      }
      // Sweep timing: line by line from the top of the viewport.
      state.enterScroll = window.scrollY;
      placeGroups(state);
      for (const group of state.groups.values()) enterDelays(state, group, false);
      const inkAt = performance.now();
      state.ink = buildInk(state);
      state.perf.enterInk = performance.now() - inkAt;
      const H = state.H;
      if (state.ink.photo) for (const strip of state.ink.photo.strips) strip.delayIn = ENTER_START + ENTER_SWEEP * clamp((strip.docY - window.scrollY) / H, 0, 1);
      state.enterEnd = Math.max(ENTER_START + ENTER_SWEEP + ENTER_DUR, GROUND_IN);
      state.enterAt = performance.now(); state.enterT = 0; state.night = 0;
      // The swap: the ink sprites are exactly the page's glyphs, drawn in the same task.
      drawInk(state);
      swapIn(state, true);
      state.phase = 'entering';
      wake(state);
      schedule(state);
      await new Promise(resolve => {
        state.entered = resolve;
        // Leaving (or a reset) before the enter has settled resolves it at once.
        ctx.signal.addEventListener('abort', () => { if (state.entered) { state.entered(); state.entered = null; } }, { once: true });
      });
    } catch (error) {
      // Never leave the page with hidden glyphs: restore, then let the core skip the lens.
      if (st && !st.dead && st.ctx === ctx) { finishExit(st); throw error; }
    }
  }

  // Arriving with a page: the ground is already night; the particles fade in, no sweep.
  async function arrive(ctx) {
    try {
      const state = await prepare(ctx);
      if (!state) return;
      readDay(state, false);             // the body's own ground (the root's is the pre-paint night)
      state.enterT = 1e4; state.night = 1; state.phase = 'live';
      // The particles are there in the first frame; they appear as the core fades the page in.
      for (const group of state.groups.values()) group.fade = 0;
      swapIn(state, false);
      captionTone(state, 1);
      placeGroups(state);
      render(state, performance.now());
      state.perf.arrivedAt = performance.now();
      // Then the page appears (the core fades the body in) and paints itself for the first
      // time, which can keep the GPU busy (the photography page's photos); a WebGL frame then
      // would wait for it on the main thread. The next frame waits until that has passed,
      // unless the reader moves first.
      state.restUntil = performance.now() + ARRIVE_REST_MS;
      state.restTimer = setTimeout(() => { state.restUntil = 0; wake(state); schedule(state); }, ARRIVE_REST_MS);
    } catch (error) {
      if (st && !st.dead && st.ctx === ctx) { finishExit(st); throw error; }
    }
  }

  function measureViewport(state) {
    const html = document.documentElement; const layer = state.layer;
    // The canvases fill the core's fixed layer (on a phone it follows the URL bar).
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
  function makeRenderer(state) {
    let renderer = null;
    try { renderer = glRenderer(state.canvas); } catch (error) { renderer = null; }
    if (!renderer) {
      // A canvas keeps its first context type: the fallback needs a fresh one.
      const fresh = canvasEl(); state.canvas.replaceWith(fresh); state.canvas = fresh;
      renderer = pixelRenderer(fresh);
    }
    return renderer;
  }
  function mount(state) {
    const layer = state.layer = state.ctx.layer('fixed');
    state.inkCanvas = canvasEl(); state.canvas = canvasEl();
    layer.append(state.inkCanvas, state.canvas);
    state.inkG = state.inkCanvas.getContext('2d');
    measureViewport(state);
    state.renderer = makeRenderer(state);
    sizeCanvases(state);
    state.uniforms.rings = state.ringView;
    state.perf.renderer = state.renderer.kind;
  }

  // Night: the ground, the main column's inversion on a light page, the hidden glyphs.
  function swapIn(state, animate) {
    const html = document.documentElement;
    state.hadClass = html.hasAttribute('class');
    const add = name => { html.classList.add(name); state.applied.add(name); };
    add(animate ? CLASS_GROUND : CLASS_STILL);
    if (state.groundBody) add(CLASS_BODY);
    if (state.light) add(CLASS_INVERT);
    add(CLASS_NIGHT);
    if (state.photoImg) add(CLASS_PHOTO);
    state.ctx.hideGlyphs(true); state.glyphs = true;
    if (!animate) {
      // Settle without transitions, then let the page's own transitions run again.
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLASS_STILL); state.applied.delete(CLASS_STILL);
    }
  }

  /*
   * The day as it is under the lens: the ground's colour and whether the body paints its
   * own. Read with the night lifted for a moment (without transitions) when it is on.
   */
  function readDay(state, lifted) {
    const html = document.documentElement;
    const removed = [];
    if (lifted) {
      html.classList.add(CLASS_STILL);
      for (const name of [CLASS_NIGHT, CLASS_BODY, CLASS_INVERT]) if (html.classList.contains(name)) { html.classList.remove(name); removed.push(name); }
    }
    const body = parseColour(getComputedStyle(document.body).backgroundColor);
    const root = parseColour(getComputedStyle(html).backgroundColor);
    state.groundBody = !!(body && body[3] > 0.5);
    const ground = state.groundBody ? body : root;
    const isNight = ground && Math.abs(ground[0] - NIGHT_RGB[0]) + Math.abs(ground[1] - NIGHT_RGB[1]) + Math.abs(ground[2] - NIGHT_RGB[2]) < 3;
    state.dayGround = ground && ground[3] > 0.5 && !isNight ? ground.slice(0, 3) : (state.light === false ? [31, 31, 31] : [255, 255, 255]);
    state.light = pageIsLight(state.ctx.scope);
    if (lifted) {
      for (const name of removed) html.classList.add(name);
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLASS_STILL);
    }
  }
  // How far the ground has travelled from day to night (0..1), read from the running CSS
  // transition so that the ink and particles stay in step with it.
  function groundProgress(state) {
    const el = state.groundBody ? document.body : document.documentElement;
    const now = parseColour(getComputedStyle(el).backgroundColor);
    const day = state.dayGround;
    if (!now) return state.phase === 'exiting' ? 0 : 1;
    // A transparent root turning to night: weigh its colour by its alpha over the day.
    const a = now[3];
    let num = 0; let den = 0;
    for (let k = 0; k < 3; k++) { const d = NIGHT_RGB[k] - day[k]; num += (now[k] * a + day[k] * (1 - a) - day[k]) * d; den += d * d; }
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
    return luma(state.dayGround) > 0.5 ? smooth(0.44, 0.56, p) : p;
  }

  /* ---------------------------------------------------------------------------
   * Interaction and change
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
        pointer.vx += ((event.clientX - pointer.x) / dt - pointer.vx) * 0.5;
        pointer.vy += ((event.clientY - pointer.y) / dt - pointer.vy) * 0.5;
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
    // The page and any container inside it (a wide table on a phone) scroll.
    document.addEventListener('scroll', () => wake(state), { passive: true, capture: true, signal });
    window.addEventListener('resize', () => {
      // The canvases follow at once. Text reflows only with the width, so only then is the
      // page re-measured (a phone's URL bar changes the height alone).
      const width = state.W;
      sizeCanvases(state); state.dirty = true; wake(state);
      if (state.W !== width) contentChanged(state, 0);
      else schedule(state);
    }, opts);
    // Links brighten under the pointer and with keyboard focus.
    const target = el => {
      const a = el && el.closest ? el.closest('a[href], button, summary, [role="button"]') : null;
      return (a && state.linkIds.get(a)) || -1;
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
    // Late content (markdown, star counts, abstracts, demos) and layout changes.
    if (typeof ctx.onContentChange === 'function') ctx.onContentChange(() => contentChanged(state, 0));
    const observer = new MutationObserver(records => {
      // Class and style changes in the scope (a demo's state, a toggled section); a theme
      // switch on <html>; and, without the core's watcher, any text change.
      for (const record of records) {
        if (record.target === document.documentElement && record.attributeName !== 'data-theme') continue;
        contentChanged(state, CONTENT_MS);
        return;
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const watchText = typeof ctx.onContentChange !== 'function';
    for (const root of ctx.scope) observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class', 'style'], childList: watchText, characterData: watchText });
    let first = true;
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (first) { first = false; return; }
      contentChanged(state, CONTENT_MS);
    }) : null;
    if (resized) resized.observe(document.body);
    signal.addEventListener('abort', () => { observer.disconnect(); if (resized) resized.disconnect(); clearTimeout(state.contentTimer); }, { once: true });
    state.canvas.addEventListener('webglcontextlost', event => event.preventDefault(), { signal });
    state.canvas.addEventListener('webglcontextrestored', () => restoreContext(state), { signal });
  }

  // The content or the layout changed: re-measure (soon); unchanged groups are kept.
  function contentChanged(state, wait) {
    if (state.dead) return;
    state.perf.changes = (state.perf.changes || 0) + 1;
    clearTimeout(state.contentTimer);
    state.contentTimer = setTimeout(() => {
      if (state.dead || state.phase === 'exiting') return;
      const light = pageIsLight(state.ctx.scope);
      if (light !== state.light && state.applied.has(CLASS_NIGHT)) {
        // The site theme switched: the inversion follows the page's lightness.
        state.light = light;
        document.documentElement.classList.toggle(CLASS_INVERT, light);
        if (light) state.applied.add(CLASS_INVERT);
      }
      state.gen++;                        // the current model is stale; groups refresh in place
      state.modelStale = true;
      schedule(state);
    }, wait);
  }

  // A lost GPU context: a fresh renderer, with every group uploaded again.
  function restoreContext(state) {
    if (state.dead) return;
    const old = state.canvas;
    const fresh = canvasEl(); old.replaceWith(fresh); state.canvas = fresh;
    state.renderer = makeRenderer(state);
    sizeCanvases(state);
    for (const group of state.groups.values()) { group.buf = null; state.renderer.create(group); }
    state.dirty = true; wake(state);
  }

  function calm(state) {
    for (const group of state.groups.values()) {
      if (!group.data) continue;
      group.off.fill(0); group.vel.fill(0); group.awake.fill(0); group.awakeCount = 0;
      if (group.data.n) state.renderer.uploadOffsets(group, 0, group.data.n - 1);
    }
    state.rings.fill(0); state.lag = 0; state.scrollSmooth = window.scrollY;
  }

  /* ---------------------------------------------------------------------------
   * The frame
   * ------------------------------------------------------------------------- */
  // The core's shared loop calls tick() while it is registered; when nothing moves the
  // lens unregisters. Each registration carries a token, so a stale callback does nothing.
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
    if (scrollY !== state.lastScrollY || window.scrollX !== state.lastScrollX) {
      if (scrollY !== state.lastScrollY) state.scrollDir = scrollY > state.lastScrollY ? 1 : -1;
      state.lastScrollY = scrollY; state.lastScrollX = window.scrollX; state.dirty = true;
      // The window moved far enough: build ahead (the builder runs between frames).
      if (Math.abs(scrollY - state.windowAt) > BAND_H / 2) { state.windowAt = scrollY; schedule(state); }
    }
    placeGroups(state);
    // Wind (while leaving, disturbed particles only spring home)
    if (stepWind(state, dt, reduced)) busy = true;
    // Rings, in viewport coordinates for the shader
    let ringsLive = false;
    for (let k = 0; k < RING_MAX; k++) {
      state.ringView[k * 4 + 3] = 0;
      if (state.rings[k * 4 + 3] <= 0) continue;
      const age = (began - state.ringAt[k]) / 1000;
      if (age > RING_LIFE || reduced) { state.rings[k * 4 + 3] = 0; state.dirty = true; continue; }
      state.rings[k * 4 + 2] = age;
      state.ringView[k * 4] = state.rings[k * 4] - window.scrollX; state.ringView[k * 4 + 1] = state.rings[k * 4 + 1] - scrollY;
      state.ringView[k * 4 + 2] = age; state.ringView[k * 4 + 3] = 1;
      busy = true; ringsLive = true;
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
    // Groups still fading in
    for (const group of state.groups.values()) if (group.visible && group.alpha < 1) { busy = true; break; }
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
    u.w = state.W; u.h = state.H;
    u.time = (now - state.startedAt) / 1000; u.shimmer = state.ctx.motion.matches ? 0 : SHIMMER;
    u.night = state.night; u.lag = state.lag;
    u.enterT = state.phase === 'live' || state.phase === 'exiting' && state.enterT >= state.enterEnd ? 1e4 : state.enterT;
    u.exitT = state.phase === 'exiting' ? state.exitT : -1;
    u.dpr = state.renderer.kind === 'canvas2d' ? 1 : state.dpr;
    const h = state.hover;
    u.hoverId = h.id; u.hoverAmount = h.amount; u.prevId = h.prevId; u.prevAmount = h.prevAmount;
    const renderer = state.renderer;
    renderer.begin(u);
    let drawn = 0;
    // Groups that hide what scrolls beneath them go last, over a cleared box.
    for (const group of state.groups.values()) if (group.visible && group.data && !group.cover) { renderer.draw(group, u); drawn++; }
    for (const group of state.groups.values()) {
      if (!group.visible || !group.data || !group.cover) continue;
      renderer.occlude(group.cover, u); renderer.draw(group, u); drawn++;
    }
    renderer.end();
    state.lastRender = now; state.dirty = false;
    state.perf.render = performance.now() - r0; state.perf.drawn = drawn;
  }

  /*
   * The pointer as a gentle wind: particles within WIND_RADIUS are pushed away (and
   * along the pointer's motion) in proportion to its speed, then spring home with
   * damping. Only awake particles are integrated, and only their index range of each
   * group's offsets is uploaded.
   */
  function stepWind(state, dt, reduced) {
    const pointer = state.pointer;
    const quiet = (performance.now() - pointer.at) / 1000;
    if (quiet > 0.03) { const k = Math.exp(-dt / POINTER_TAU); pointer.vx *= k; pointer.vy *= k; }
    const speed = Math.hypot(pointer.vx, pointer.vy);
    const gust = reduced || state.phase === 'exiting' || !pointer.in ? 0 : Math.min(speed / WIND_SPEED_REF, WIND_GUST_MAX);
    let moving = false;
    const R = WIND_RADIUS; const R2 = R * R; const reach = R + 8;
    const ux = pointer.vx / (speed || 1); const uy = pointer.vy / (speed || 1);
    const push = WIND_ACCEL * gust * dt;
    const damp = Math.exp(-DAMPING * dt);
    for (const group of state.groups.values()) {
      const d = group.data; if (!d || !d.n) continue;
      const off = group.off; const vel = group.vel; const st6 = d.statics;
      const awake = group.awake; const list = group.awakeList;
      let lo = d.n; let hi = -1;
      if (gust > 0.02 && group.visible) {
        // The pointer in the group's coordinates
        const px = pointer.x - group.origin.x; const py = pointer.y - group.origin.y;
        if (px + reach >= d.x0 && px - reach <= d.x1 && py + reach >= d.y0 && py - reach <= d.y1) {
          const c0 = clamp(Math.floor((px - reach - d.gx0) / CELL), 0, d.cols - 1); const c1 = clamp(Math.floor((px + reach - d.gx0) / CELL), 0, d.cols - 1);
          const r0 = clamp(Math.floor((py - reach - d.gy0) / CELL), 0, d.rows - 1); const r1 = clamp(Math.floor((py + reach - d.gy0) / CELL), 0, d.rows - 1);
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
              if (!awake[i]) { awake[i] = 1; list[group.awakeCount++] = i; }
            }
          }
          moving = true;
        }
      }
      if (!group.awakeCount) continue;
      // Integrate the awake particles (semi-implicit Euler) and put the settled to sleep.
      let kept = 0;
      for (let k = 0; k < group.awakeCount; k++) {
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
      group.awakeCount = kept;
      if (hi >= lo) {
        state.renderer.uploadOffsets(group, lo, hi);
        state.perf.uploads++; state.perf.uploaded += hi - lo + 1;
        moving = true;
      }
    }
    return moving;
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
      const n = state.night; const dpr = state.dpr;
      const eT = state.enterT;            // frozen once the exit begins
      const xT = state.phase === 'exiting' ? state.exitT : -1;
      const alphaOf = (delayIn, delayOut) => {
        const e = clamp((eT - delayIn) / ENTER_DUR, 0, 1);
        const x = xT < 0 ? 0 : clamp((xT - delayOut) / EXIT_DUR, 0, 1);
        return Math.max(inkEnter(e), inkExit(x));
      };
      for (const set of ink.sets) {
        const group = set.group;
        if (group.cover) g.clearRect(group.cover.x0 * dpr, group.cover.y0 * dpr, (group.cover.x1 - group.cover.x0) * dpr, (group.cover.y1 - group.cover.y0) * dpr);
        // A band follows the scroll even if it was re-sampled meanwhile; a box its container.
        const now = group.kind === 'band' ? { x: -window.scrollX, y: -window.scrollY } : group.origin;
        const dx = Math.round((now.x - set.origin.x) * dpr);
        const dy = Math.round((now.y - set.origin.y) * dpr);
        const clip = group.kind === 'box' ? group.clip : null;
        if (clip) { g.save(); g.beginPath(); g.rect(clip.x0 * dpr, clip.y0 * dpr, (clip.x1 - clip.x0) * dpr, (clip.y1 - clip.y0) * dpr); g.clip(); }
        for (const line of set.lines) {
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
        if (clip) g.restore();
      }
      const photo = ink.photo;
      if (photo) {
        const dx = Math.round((photo.scrollX - window.scrollX) * dpr); const dy = Math.round((photo.scrollY - window.scrollY) * dpr);
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
        if (state.rings[k * 4 + 3] <= 0) continue;
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
    schedule(state);
  }

  async function exit(ctx) {
    const state = st;
    if (!state || state.dead) return;
    if (state.entered) { state.entered(); state.entered = null; }   // an enter in progress gives way
    const instant = ctx.instant === true || ctx.motion.matches || !state.renderer || state.phase === 'build' || !state.groups.size;
    if (instant) { finishExit(state); return; }
    if (state.phase === 'exiting') return state.exited;
    // Freeze the enter where it stands; a line still in ink stays ink.
    const wasEntering = state.phase === 'entering';
    if (!wasEntering) state.enterT = 1e4;
    state.phase = 'exiting';
    readDay(state, true);
    placeGroups(state);
    for (const group of state.groups.values()) if (group.visible) exitDelays(state, group);
    // Fresh ink for the current viewport (the night classes leave the text colours alone).
    const inkAt = performance.now();
    state.ink = buildInk(state);
    state.perf.exitBuild = performance.now() - inkAt;
    if (state.ink.photo) {
      const H = state.H;
      const delayIn = y => (wasEntering ? ENTER_START + ENTER_SWEEP * clamp((y - state.enterScroll) / H, 0, 1) : -10);
      for (const strip of state.ink.photo.strips) { strip.delayIn = delayIn(strip.docY); strip.delayOut = EXIT_SWEEP * clamp((strip.docY - window.scrollY) / H, 0, 1); }
    }
    state.exitEnd = Math.max(EXIT_SWEEP + EXIT_DUR, GROUND_OUT);
    state.exitAt = performance.now(); state.exitT = 0;
    const html = document.documentElement;
    html.classList.add(CLASS_GROUND, CLASS_LEAVING); state.applied.add(CLASS_GROUND); state.applied.add(CLASS_LEAVING);
    html.classList.remove(CLASS_NIGHT, CLASS_INVERT);
    state.exited = new Promise(resolve => { state.resolveExit = resolve; });
    wake(state);
    // If frames stop (a hidden tab), finish on a timer.
    state.exitTimer = setTimeout(() => finishExit(state), (state.exitEnd + SETTLE_SLACK + 0.6) * 1000);
    return state.exited;
  }

  // Complete restoration: glyphs back, classes off, canvases gone, GPU released.
  function finishExit(state) {
    if (state.dead) return;
    state.dead = true;
    clearTimeout(state.exitTimer); clearTimeout(state.contentTimer); clearTimeout(state.shimmerTimer); clearTimeout(state.restTimer);
    if (state.glyphs) { state.ctx.hideGlyphs(false); state.glyphs = false; }
    const html = document.documentElement;
    if (html.classList.contains(CLASS_NIGHT)) {
      // An instant exit: the day returns without colour fades. The still class stays until
      // the change is flushed. (An animated exit has finished its fades by now.)
      html.classList.add(CLASS_STILL);
      for (const name of state.applied) if (name !== CLASS_STILL) html.classList.remove(name);
      for (const el of document.querySelectorAll(MARKS)) void getComputedStyle(el).color;
      const main = document.getElementById('main-content');
      if (main) void getComputedStyle(main).filter;
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLASS_STILL);
    } else {
      for (const name of state.applied) html.classList.remove(name);
    }
    state.applied.clear();
    if (!state.hadClass && html.hasAttribute('class') && !html.classList.length) html.removeAttribute('class');
    // The canvases vanish at once; the GPU and backing stores are released just after.
    const renderer = state.renderer; const groups = [...state.groups.values()];
    const canvases = [state.canvas, state.inkCanvas].filter(Boolean);
    canvases.forEach(c => { c.style.display = 'none'; });
    setTimeout(() => {
      if (renderer) { try { renderer.dispose(groups); } catch (error) { /* context gone */ } }
      canvases.forEach(c => { c.width = 1; c.height = 1; });
    }, 0);
    sleep(state);
    state.ink = null; state.model = null; state.groups = new Map();
    state.phase = 'done';
    lastPerf = { byPhase: state.perf.byPhase, exitBuildMs: state.perf.exitBuild, prepareMs: state.perf.prepareMs, enterInkMs: state.perf.enterInk };
    if (state.entered) { state.entered(); state.entered = null; }
    if (state.resolveExit) { state.resolveExit(); state.resolveExit = null; }
    if (st === state) st = null;
  }

  const lens = {
    id: 'stardust', order: 1, numeral: 'I', label: 'Stardust',
    line: 'Every letter is made of smaller things.',
    css: true,
    enter, exit, arrive,                  // no caption(): the static line shows as the enter begins
    // Test hook: counts and frame timing of the live activation.
    get _stats() {
      if (!st) return null;
      const p = st.perf;
      let visible = 0; let awake = 0;
      for (const g of st.groups.values()) { if (g.visible) visible++; awake += g.awakeCount || 0; }
      // Bands on screen that hold text but are not built (yet), or still fading in.
      let missing = 0;
      if (st.model) {
        const sy = window.scrollY;
        for (let k = Math.floor(sy / BAND_H); k * BAND_H < sy + st.H; k++) {
          const y0 = k * BAND_H; const y1 = y0 + BAND_H;
          const hasText = st.model.entries.some(e => e.top < y1 && e.bottom > y0);
          const g = st.groups.get(`b${k}`);
          if (hasText && (!g || g.alpha < 0.5)) missing++;
        }
      }
      return {
        phase: st.phase, renderer: p.renderer, particles: st.particles, groups: st.groups.size, visibleGroups: visible, missing,
        boxes: [...st.groups.values()].filter(g => g.kind === 'box').length, building: st.building, gen: st.gen,
        prepareMs: +(p.prepareMs || 0).toFixed(1), arrivedAt: p.arrivedAt ? Math.round(p.arrivedAt) : null, frames: p.frames, avgMs: p.frames ? +(p.total / p.frames).toFixed(3) : 0,
        maxMs: +p.max.toFixed(2), lastMs: +p.last.toFixed(3), awake,
        uploads: p.uploads, avgUploaded: p.uploads ? Math.round(p.uploaded / p.uploads) : 0, renderMs: +p.render.toFixed(3),
        exitBuildMs: +(p.exitBuild || 0).toFixed(1), enterInkMs: +(p.enterInk || 0).toFixed(1),
        sliceMaxMs: +(p.sliceMax || 0).toFixed(1), changes: p.changes || 0, models: p.models || 0, modelMs: +(p.modelMs || 0).toFixed(1), builds: p.builds || 0, buildWallMs: p.builds ? +(p.buildWall / p.builds).toFixed(1) : 0,
        byPhase: Object.fromEntries(Object.entries(p.byPhase).map(([k, v]) => [k, { frames: v.frames, avgMs: +(v.total / v.frames).toFixed(3), maxMs: +v.max.toFixed(2) }]))
      };
    },
    _reset() { if (st) { Object.assign(st.perf, { frames: 0, total: 0, max: 0, uploads: 0, uploaded: 0, byPhase: {}, sliceMax: 0 }); } },
    // Test hook: the timing of the last activation, kept after its exit.
    get _lastPerf() { return lastPerf; }
  };

  if (window.SiteLenses && typeof window.SiteLenses.register === 'function') window.SiteLenses.register(lens);
})();
