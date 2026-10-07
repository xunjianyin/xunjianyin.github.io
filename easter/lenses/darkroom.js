/**
 * Lens IX · Darkroom: "A print develops darkest tones first."
 *
 * The page is developed like a gelatin silver print in a darkroom tray and left as a finished,
 * warm-toned fibre print. Photographic density follows the Hurter–Driffield characteristic
 * curve (1890): under the developer, the areas that received the most light (the print's
 * darkest tones) gain density first, and the highlights come last.
 *
 * Settled state: warm white paper (#f4f0e6) with a very fine paper texture; text in a
 * selenium-toned black, muted text in warm greys, links in the same ink with a thin
 * warm-grey underline (the colour is gone, so the underline carries the link).
 * Every image is a silver print (ctx.media), the photograph in the photography lightbox too:
 * grey through a print curve (gentle auto levels, a soft S, rich blacks, clean highlights)
 * with fine grain that is strongest in the midtones. The print is made in slices of at most
 * a few ms, the auto levels read in the same pass over the pixels. Until its print is made,
 * an image shows the bare paper (the page's own images and the lightbox's are veiled, masked
 * to their border), and a print that arrives after the page is printed develops in over
 * 0.3 s, so a photo never changes tone in place.
 * One toning curve, from the paper through warm highlights to cool selenium shadows, colours
 * text and images alike, so the images are split-toned by the same chemistry as the type.
 *
 * Drawing: only colour changes, and nothing in the page is touched. A fixed layer over the
 * page carries a backdrop filter (SVG) that prints everything under it: an feColorMatrix
 * projects each colour onto one grey and an feComponentTransfer table maps that grey to the
 * toned print. The projection is a red filter, as in black-and-white photography, so the
 * paper pages' green and rust (equal in luminance, and the two categories of their data
 * cells) print apart. In the dark site theme the projection is inverted and levelled, so the
 * print is still a light sheet with dark ink (the scope's own images are inverted back
 * first, and the site's light-blue link colours are mapped to the text's colour), and its
 * table thins the antialiased edges of the type, which Chrome draws heavier for light text on
 * a dark ground, so both themes give the same print. Paper pages get a stronger red filter
 * and a lifted toe, so their light data washes, told apart by hue alone, print as distinct
 * tints. A page layer above the print layer carries the paper's texture (a small tile
 * generated once per page, in a few milliseconds), drawn as it is and not printed, so it is
 * the same in both themes. The images' silver prints lie above both, in the media helper's
 * layer (the lightbox's in its fixed layer, above the lightbox), under a second filter with
 * the same toning. The caption is not printed: its halo is named as the paper, which the
 * safelight multiplies as it does the sheet. The filter is not put on the page's own
 * elements: Chrome loads every lazy image under an element with a reference filter at once,
 * and the gallery would download in full. Engines that do not render an SVG filter in backdrop-filter (WebKit) get
 * the scoped mode instead: the same filters on the nav, main and the footer's children, and
 * the root painted as paper (while the filters mix, an underlay fades the root to paper with
 * them).
 *
 * Enter (about 2.9 s, the longest lens):
 *   1. Lights out (0.5 s). A safelight layer (multiply blend, a deep amber-red vignette with a
 *      paler centre where the sheet lies) fades in, and the page crossfades to a blank sheet
 *      (a mixing filter: an feComposite between the page and the blank print).
 *   2. Development (1.8 s), after at most 0.6 s in the dark while the images near the
 *      viewport are prepared. The tables are recomputed each frame (one string per channel,
 *      set on the filters; no per-element work). A tone of final density d starts to develop at
 *      ONSET * (1 - d)^ONSET_POWER of the development time and gains density along
 *      1 - (1 - p)^RISE_POWER. Text and the darkest parts of images appear first, mid-greys
 *      next, highlights last. One faint band of reflected safelight crosses the sheet, as when
 *      the tray is rocked (a compositor animation inside the safelight layer).
 *   3. Lights on (0.6 s). The safelight fades and the print is seen in white light.
 * Exit (0.6 s): a view-transition crossfade from the print to the page (without view
 * transitions, the filters crossfade back). In the dark theme a straight crossfade between
 * dark ink on paper and light type on a dark ground passes through a grey where the type
 * vanishes, so there the ink first goes back into the paper (0.25 s, the development in
 * reverse) and the blank sheet crossfades to the page (0.35 s). An instant reset during the
 * exit (ctx.instant, read live) skips what is left of it. Arrive: the finished print at
 * once, under the pre-painted paper, without the safelight; the images develop in as their
 * prints arrive. Reduced motion: the settled state at once, both ways. A tab hidden mid-enter
 * finishes the enter at once (the frame loop pauses while hidden). No frame callback runs
 * once the print has settled.
 */
(() => {
  'use strict';
  if (!window.SiteLenses) return;

  /* ---------- constants ---------- */

  // Choreography (ms)
  const LIGHTS_OUT_MS = 500;
  const DEVELOP_MS = 1800;
  const LIGHTS_ON_MS = 600;
  const HOLD_MS = 600;                // in the dark, the images near the viewport get this long at most
  const EXIT_MS = 600;                // the crossfade back (darkroom.css holds the view-transition timing)
  // The dark theme's exit: the ink first goes back into the paper (the development in reverse),
  // then the blank sheet crossfades to the page (darkroom.css holds that view transition's timing).
  const UNDEVELOP_MS = 250;
  const BLANK_FADE_MS = 350;
  const DEVELOP_IN_MS = 300;          // an image's silver print that arrives late develops in over this long
  const SETTLE_WAIT_MS = 120;         // arrival and reduced motion wait this long for the images at most
  const RIPPLE_MS = 2600;             // the band of reflected safelight crossing the sheet

  // Development. A tone of final density d (0 bare paper … 1 deepest black) starts at
  // ONSET * (1 - d)^ONSET_POWER of the development time and then gains density along
  // 1 - (1 - p)^RISE_POWER: quickly at first, then saturating, as a print in the tray does.
  const ONSET = 0.55;
  const ONSET_POWER = 1.2;
  const RISE_POWER = 2.2;

  // The toning curve: density → sRGB colour of the finished print. Warm highlights, warm
  // neutral midtones, cool (purplish) selenium shadows: a split-toned warm-tone fibre paper.
  const PAPER_RGB = [244, 240, 230];  // #f4f0e6, the paper base
  const TONES = [
    [0.0, PAPER_RGB],
    [0.1, [230, 223, 209]],           // highlights: warm
    [0.45, [152, 143, 134]],          // midtones: warm neutral
    [0.78, [82, 72, 78]],             // shadows: selenium, cool purple
    [1.0, [33, 26, 31]]               // Dmax: selenium-toned black
  ];
  const TABLE_SIZE = 64;              // entries of each feComponentTransfer table
  // The page's paper grade: densities are stretched so that dark grey type (#374151 is the
  // homepage's body text) prints as a rich black, with a soft shoulder; the toe is left
  // straight, so light tints (a paper page's data cells) keep their differences.
  const GRADE_BLACK = 0.82;           // density that prints as Dmax
  const GRADE_S = 0.25;               // the shoulder: a blend toward smoothstep above mid-grey
  // Paper pages only: a lifted toe. Their data are light washes of a green and a rust (the
  // two categories of auditing-health-llms's cells and Jaccard matrix, coded by hue alone),
  // which the straight toe prints within 2 to 3 L* of each other and of the paper. Each lift
  // [lift, end] adds lift * x * (1 - x / end)^2 to a stretched density x below end (zero at
  // both ends, so the curve joins smoothly; the sum stays monotonic): the first parts the
  // faintest washes from the paper, the second the tints up to mid-grey. Denser tones are
  // unchanged, and white stays bare paper. On that page, through PAPER_WEIGHTS: the rust and
  // green cell washes print 3.7 and 12.3 L* under the paper, and Jaccard cells of equal
  // overlap 0.14, 0.33 and 0.60 print 3.1, 5.3 and 5.6 L* apart (with the page's weights and
  // a single toe lift, 2.2, 2.7 and 4.3); the cost is a 1 px rule (#dce2dc) 3.8 L* darker.
  const TOE_LIFTS = [[0.8, 0.24], [1.0, 0.5]];

  // Projection of colour onto grey (weights of sRGB R, G, B). The page and its figures are
  // printed as through a red filter, which darkens greens and blues: the paper pages' green
  // and rust (equal in luminance, and the two categories of their data) print apart, the
  // green near black, the rust mid-grey, and their light tints as two distinct tints. Paper
  // pages get a stronger red filter (PAPER_WEIGHTS), as their light tints carry data; their
  // figures keep PAGE_WEIGHTS, like the site's.
  const PAGE_WEIGHTS = [0.6, 0.3, 0.1];
  const PAPER_WEIGHTS = [0.7, 0.24, 0.06];
  const PHOTO_WEIGHTS = [0.3, 0.59, 0.11];    // photographs: a panchromatic emulsion
  const WHITE_POINT = 0.97;           // greys above this print as bare paper (near-white panels)
  // The dark site theme, inverted: its ground (#1f1f1f, projected grey 0.12) prints as bare
  // paper and its body text (#d4d4d4, 0.83) at the density the light theme's body text has
  // (#374151: 0.75), so both themes give the same print.
  const DARK_GROUND = 0.12;
  const DARK_TEXT = 0.83;
  const TEXT_DENSITY = 0.75;
  // Chrome draws light text on a dark ground with heavier antialiased edges than dark text on
  // a light one, so the inverted type would print bolder. The dark theme's table lowers the
  // densities under the body text's along d' = TEXT_DENSITY * (d / TEXT_DENSITY)^DARK_EDGE:
  // the edges thin, the body text keeps its density (measured against the light theme's print
  // of the homepage at 1440 x 900).
  const DARK_EDGE = 1.5;

  // Silver prints of the images
  const S_CURVE = 0.35;               // the print curve's S: a blend toward smoothstep
  const TOE = 0.02;                   // tones this close to black or white print as Dmax or paper
  const LEVELS_CLIP = 0.005;          // auto levels clip this share of the points at each end ...
  const LEVELS_MAX = 0.06;            // ... moving the black or white point at most this far
  const GRAIN_PHOTO = 7;              // grain σ at the midtones, in 8-bit grey: photographs ...
  const GRAIN_GRAPHIC = 2.5;          // ... and figures, finer, so labels stay clean
  const NOISE_SIZE = 256;             // the grain's noise tile (device px, a power of two)
  const STRIP_PX = 32768;             // pixels per strip (the print reads, then writes, in strips)
  const SLICE_MS = 5;                 // longest stretch of work between yields (the contract: 8)

  // Paper texture: a tile (css px) of fine noise and faint mottling (the baryta layer of a
  // fibre print hides its fibres), laid over the print as a warm brown at a few alpha steps.
  // It only darkens: a lighter grain would also lighten the type under it, speckling large
  // black headings. On the paper it measures σ ≈ 1.1 levels and darkens it by 0.8 on average.
  const TEXTURE_TILE = 256;
  const TEXTURE_FINE = 3;             // fine noise σ (alpha steps, of which the darker half shows)
  const TEXTURE_MOTTLE = 1.4;         // mottling amplitude (alpha steps)
  const TEXTURE_CELL = 32;            // mottling scale (css px; divides the tile)
  const SEED = 1890;                  // Hurter and Driffield's paper

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const IDS = {
    page: 'lens-darkroom-page', pageDark: 'lens-darkroom-page-dark',
    mix: 'lens-darkroom-mix', mixDark: 'lens-darkroom-mix-dark', media: 'lens-darkroom-media'
  };
  const CLS = {
    on: 'lens-darkroom', print: 'lens-darkroom-print', mixing: 'lens-darkroom-mixing',
    shell: 'lens-darkroom-shell', paper: 'lens-darkroom-paper', vtOut: 'lens-darkroom-vt-out',
    vtBlank: 'lens-darkroom-vt-blank', scoped: 'lens-darkroom-scoped', veil: 'lens-darkroom-veil'
  };
  const MIN_SIDE = 24;                // CSS px: the media helper leaves smaller images alone

  const html = document.documentElement;
  let state = null;                   // the running activation, or null
  let texture = null;                 // Promise<url | null> of the paper texture (kept for later activations)
  let noise = null;                   // the grain's noise tile (kept likewise)

  /* ---------- small helpers ---------- */

  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const ease = t => t * t * (3 - 2 * t);
  // A small seeded generator, so the texture and the grain are the same every time.
  const random = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Resolves after ms, or at once when the signal aborts (never rejects).
  const sleep = (ms, signal) => new Promise(resolve => {
    if (signal && signal.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  // A fast yield to the event loop (a message, not a clamped timer).
  let channel = null; const waiting = [];
  const yieldTask = () => new Promise(resolve => {
    if (!channel) { channel = new MessageChannel(); channel.port1.onmessage = () => { const next = waiting.shift(); if (next) next(); }; }
    waiting.push(resolve);
    channel.port2.postMessage(0);
  });
  const svg = (name, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const key in attrs) node.setAttribute(key, String(attrs[key]));
    if (parent) parent.appendChild(node);
    return node;
  };

  /* ---------- the print: tone, development, filters ---------- */

  // The colour of density d in the finished print (sRGB 0..255), piecewise linear.
  function tone(d) {
    for (let k = 1; k < TONES.length; k++) {
      if (d > TONES[k][0]) continue;
      const [d0, c0] = TONES[k - 1]; const [d1, c1] = TONES[k];
      const t = (d - d0) / (d1 - d0);
      return c0.map((v, c) => v + (c1[c] - v) * t);
    }
    return TONES[TONES.length - 1][1];
  }
  // The share of its final density that a tone of density d has at development time tau.
  function developed(d, tau) {
    if (tau >= 1) return 1;
    const onset = ONSET * Math.pow(1 - d, ONSET_POWER);
    const p = (tau - onset) / (1 - onset);
    return p <= 0 ? 0 : 1 - Math.pow(1 - p, RISE_POWER);
  }
  // The page's grade: density in → density printed (straight below mid-grey, a shoulder above;
  // on paper pages, lifted is true and the toe is lifted).
  function grade(d, lifted) {
    const stretched = clamp01(d / GRADE_BLACK);
    let x = stretched;
    if (lifted) for (const [lift, end] of TOE_LIFTS) if (stretched < end) x += lift * stretched * (1 - stretched / end) ** 2;
    return x <= 0.5 ? x : x + GRADE_S * (x * x * (3 - 2 * x) - x);
  }
  // The dark theme's edge curve (below the body text's density only).
  const thin = d => (d < TEXT_DENSITY ? TEXT_DENSITY * Math.pow(d / TEXT_DENSITY, DARK_EDGE) : d);
  // The three tables (R, G, B) at development tau: 0 a blank sheet, 1 the finished print.
  // Entry i is the colour of the grey i / (TABLE_SIZE - 1), whose density is 1 - grey. mode
  // 'page' grades it for the page, 'dark' also thins the dark theme's edges first, 'media'
  // leaves it as it is (the images' overlays carry their own print curve). lifted: a paper page.
  function tables(tau, mode, lifted) {
    const columns = [[], [], []];
    for (let i = 0; i < TABLE_SIZE; i++) {
      const raw = 1 - i / (TABLE_SIZE - 1);
      const d = mode === 'media' ? raw : grade(mode === 'dark' ? thin(raw) : raw, lifted);
      const colour = tone(d * developed(d, tau));
      for (let c = 0; c < 3; c++) columns[c].push((colour[c] / 255).toFixed(4));
    }
    return columns.map(column => column.join(' '));
  }
  // The finished prints of a site-shell page and of a paper page.
  const finals = lifted => ({ page: tables(1, 'page', lifted), dark: tables(1, 'dark', lifted), media: tables(1, 'media') });
  const FINAL = { shell: finals(false), paper: finals(true) };
  const BLANK = tables(0, 'media');

  // The grey projection as a colour matrix: light pages print white as paper (with a white
  // point, so near-white panels are bare paper); the dark theme is inverted, its ground
  // printing as paper and its text as ink.
  function projection(weights, mode) {
    const k = TEXT_DENSITY / (DARK_TEXT - DARK_GROUND);
    const row = mode === 'dark' ? [...weights.map(w => -w * k), 0, 1 + k * DARK_GROUND]
      : mode === 'page' ? [...weights.map(w => w / WHITE_POINT), 0, 0] : [...weights, 0, 0];
    return [...row, ...row, ...row, 0, 0, 0, 1, 0].map(v => +v.toFixed(5)).join(' ');
  }

  // The filters, in a 0 x 0 svg in the print layer. A mixing filter adds a crossfade between
  // the print and the page itself (the lights going out, and the exit without view
  // transitions); the others are colour-only and cheap to keep while the print rests.
  function buildDefs(st, parent) {
    const defs = svg('svg', { class: 'lens-darkroom-defs', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' }, parent);
    const make = (id, values, mixing) => {
      // The region is the filtered box itself (the viewport, or the images' layer).
      const filter = svg('filter', { id, 'color-interpolation-filters': 'sRGB', x: 0, y: 0, width: 1, height: 1 }, defs);
      svg('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values, result: 'grey' }, filter);
      const transfer = svg('feComponentTransfer', { in: 'grey', result: 'print' }, filter);
      const funcs = ['feFuncR', 'feFuncG', 'feFuncB'].map(name => svg(name, { type: 'table', tableValues: '1 1' }, transfer));
      const mix = mixing ? svg('feComposite', { in: 'print', in2: 'SourceGraphic', operator: 'arithmetic', k1: 0, k2: 0, k3: 1, k4: 0 }, filter) : null;
      return { funcs, mix, shown: null };
    };
    const weights = st.kind === 'paper' ? PAPER_WEIGHTS : PAGE_WEIGHTS;
    st.prints = {
      page: [make(IDS.page, projection(weights, 'page'))],
      dark: [make(IDS.pageDark, projection(weights, 'dark'))],
      media: [make(IDS.media, projection(PHOTO_WEIGHTS, 'grey'))]
    };
    st.mixes = {
      page: [make(IDS.mix, projection(weights, 'page'), true)],
      dark: [make(IDS.mixDark, projection(weights, 'dark'), true)]
    };
  }
  const setTables = (filters, columns) => filters.forEach(f => {
    if (f.shown === columns) return;
    f.shown = columns;
    f.funcs.forEach((fn, c) => fn.setAttribute('tableValues', columns[c]));
  });
  // The print at development tau: the page's filters (both themes) and the images' filter,
  // one toning.
  function develop(st, tau) {
    if (tau === st.tau) return;
    st.tau = tau;
    const lifted = st.kind === 'paper';
    for (const mode of ['page', 'dark', 'media']) setTables(st.prints[mode], tau >= 1 ? FINAL[st.kind][mode] : tau <= 0 ? BLANK : tables(tau, mode, lifted));
  }
  // The mixing filters' tables: the blank sheet, or the finished print of each theme.
  const mixTables = (st, blank) => { setTables(st.mixes.page, blank ? BLANK : FINAL[st.kind].page); setTables(st.mixes.dark, blank ? BLANK : FINAL[st.kind].dark); };
  // The mixing filters: w = 0 the page itself, 1 the print. In the scoped mode the underlay
  // (the paper, under the page) follows, so the page's own background around the filtered
  // elements turns to paper with them.
  function mix(st, w) {
    const k2 = +w.toFixed(4); const k3 = +(1 - w).toFixed(4);
    [...st.mixes.page, ...st.mixes.dark].forEach(f => { f.mix.setAttribute('k2', k2); f.mix.setAttribute('k3', k3); });
    if (st.underlay) st.underlay.style.opacity = String(k2);
  }

  /* ---------- silver prints of the images ---------- */

  // Gaussian noise (σ = 32 in Int8 units) on a NOISE_SIZE square, made once.
  function noiseTile() {
    if (noise) return noise;
    const rand = random(SEED + 1);
    noise = new Int8Array(NOISE_SIZE * NOISE_SIZE);
    for (let i = 0; i < noise.length; i++) {
      const g = (rand() + rand() + rand() + rand() - 2) * Math.sqrt(3);   // Irwin–Hall: σ = 1
      noise[i] = Math.max(-127, Math.min(127, Math.round(g * 32)));
    }
    return noise;
  }
  // Integer weights out of 256 (so a grey is a shift, not a division).
  const fixed = weights => {
    const w = weights.map(v => Math.round(v * 256));
    w[1] += 256 - w[0] - w[1] - w[2];
    return w;
  };

  // The black and white points of a photograph, from the histogram of its greys (every point,
  // counted by the print's first pass as it reads the strips; no resampled copy, which at a
  // DPR of 2 or 3 took 10-24 ms in one task), clipping LEVELS_CLIP at each end and moving
  // neither point more than LEVELS_MAX (a high-key or low-key photograph keeps its key). On
  // the gallery's photographs this gives the points of the earlier 96 px sample within 1/255.
  function levels(bins) {
    let total = 0;
    for (let b = 0; b < 256; b++) total += bins[b];
    const at = share => { let sum = 0; for (let b = 0; b < 256; b++) { sum += bins[b]; if (sum >= share * total) return b / 255; } return 1; };
    return [Math.min(LEVELS_MAX, at(LEVELS_CLIP)), Math.max(1 - LEVELS_MAX, at(1 - LEVELS_CLIP))];
  }

  // The print curve as lookup tables: grey in → grey out, and the grain's σ (×8) at that tone.
  function curve(photo, lo, hi) {
    const out = new Uint8ClampedArray(256); const amp = new Uint8Array(256);
    const grain = photo ? GRAIN_PHOTO : GRAIN_GRAPHIC;
    for (let i = 0; i < 256; i++) {
      let x = i / 255;
      if (photo) {
        x = clamp01((x - lo) / Math.max(0.05, hi - lo));
        x += S_CURVE * (x * x * (3 - 2 * x) - x);
      } else x = Math.min(1, x / WHITE_POINT);
      x = clamp01((x - TOE) / (1 - 2 * TOE));
      out[i] = Math.round(x * 255);
      amp[i] = Math.round(grain * 8 * 4 * x * (1 - x));   // strongest in the midtones, none at paper or Dmax
    }
    return { out, amp };
  }

  // The print work's tasks: how many, the longest (ms) and the strips it held (the suite reads
  // them through _test.perf; the contract allows 8 ms per task).
  const perf = { slices: 0, maxMs: 0, maxStrips: 0 };
  // render() for the media helper: the image as displayed (source.canvas) becomes its silver
  // print in place, in two passes over strips of STRIP_PX: the first reads each point's grey
  // and counts the greys (a photograph's auto levels), the second writes the print. The
  // work starts in a task of its own (not in the helper's, which has just drawn the image)
  // and yields before a task would pass SLICE_MS. The grey goes to all three channels; the
  // media filter tones it. Unreadable (cross-origin) images are left to the page filter,
  // which prints them without grain. A readable image always gets an overlay (the veil hides
  // it until then): if its pixels cannot be read after all, the canvas is shown as drawn,
  // and the media filter still prints it, without grain.
  async function silverPrint(st, source) {
    const { signal } = st.ctx;
    if (!source.readable || signal.aborted) return null;
    const { canvas, ctx2d: g, width: W, height: H } = source;
    const photo = source.kind === 'photo';
    let began = 0; let stripAt = 0; let stripMs = 0; let strips = 0;
    const lap = () => {
      const ms = performance.now() - began;
      perf.slices++;
      if (ms > perf.maxMs) { perf.maxMs = ms; perf.maxStrips = strips; }
    };
    // Before each strip: yields when the strip would end past SLICE_MS of work (the strip is
    // expected to take as long as the last one), and before the first; false when the
    // activation has ended meanwhile.
    const pace = async first => {
      const now = performance.now();
      if (!first) stripMs = now - stripAt;
      if (!first && now - began + stripMs <= SLICE_MS) { stripAt = now; strips++; return true; }
      if (!first) lap();
      await yieldTask();
      began = stripAt = performance.now();
      strips = 1;
      return !signal.aborted;
    };
    if (!(await pace(true))) return null;
    noiseTile();                      // made once per page (a few ms), before any strip is due
    const [wr, wg, wb] = fixed(photo ? PHOTO_WEIGHTS : PAGE_WEIGHTS);
    const rows = Math.max(1, Math.floor(STRIP_PX / W));
    const greys = new Uint8Array(W * H);
    const bins = new Uint32Array(256);
    // 1. Read: the greys, and their histogram.
    for (let y0 = 0; y0 < H; y0 += rows) {
      if (!(await pace(false))) return null;
      const h = Math.min(rows, H - y0);
      let d;
      try { d = g.getImageData(0, y0, W, h).data; } catch (error) { lap(); return canvas; }
      for (let i = 0, k = y0 * W, end = k + W * h; k < end; i += 4, k++) {
        const grey = (d[i] * wr + d[i + 1] * wg + d[i + 2] * wb) >> 8;
        greys[k] = grey;
        bins[grey]++;
      }
    }
    const { out, amp } = curve(photo, ...(photo ? levels(bins) : [0, 1]));
    // 2. Write: the print curve and the grain, strongest in the midtones.
    const grain = noiseTile();
    const mask = NOISE_SIZE - 1;
    // The grain tile is offset per image size, so neighbouring prints do not share a pattern.
    const ox = (W * 7 + H * 13) & mask; const oy = (W * 11 + H * 5) & mask;
    let strip = null;
    for (let y0 = 0; y0 < H; y0 += rows) {
      if (!(await pace(false))) return null;
      const h = Math.min(rows, H - y0);
      if (!strip || strip.height !== h) strip = new ImageData(W, h);
      const d = strip.data;
      for (let y = 0, i = 0, k = y0 * W; y < h; y++) {
        const ny = ((y0 + y + oy) & mask) * NOISE_SIZE;
        for (let x = 0; x < W; x++, i += 4, k++) {
          const grey = greys[k];
          const v = out[grey] + ((grain[ny + ((x + ox) & mask)] * amp[grey]) >> 8);
          d[i] = d[i + 1] = d[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
          d[i + 3] = 255;
        }
      }
      g.putImageData(strip, 0, y0);
    }
    lap();
    return canvas;
  }

  /* ---------- paper texture ---------- */

  // The tile as an image URL, generated in slices (a few ms) on the first activation of each
  // page and encoded off the main thread (toBlob). One texture pixel per CSS px at any DPR:
  // the grain is the paper's, not the screen's, and the tile stays small (no storage needed).
  async function makeTexture() {
    const n = TEXTURE_TILE;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const g = canvas.getContext('2d');
    const image = g.createImageData(n, n);
    const d = image.data;
    const rand = random(SEED);
    // Mottling: a wrapped lattice of random values, smoothly interpolated (seamless).
    const cells = TEXTURE_TILE / TEXTURE_CELL;
    const lattice = Float32Array.from({ length: cells * cells }, () => rand() * 2 - 1);
    const cellPx = n / cells;
    let began = performance.now();
    for (let y = 0; y < n; y++) {
      const gy = y / cellPx; const y0 = Math.floor(gy); const fy = gy - y0; const sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cells) * cells; const r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < n; x++) {
        const gx = x / cellPx; const x0 = Math.floor(gx); const fx = gx - x0; const sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % cells; const c1 = (x0 + 1) % cells;
        const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * sx;
        const bottom = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * sx;
        const fine = (rand() + rand() + rand() - 1.5) * 2;                // σ = 1
        const v = fine * TEXTURE_FINE + (top + (bottom - top) * sy) * TEXTURE_MOTTLE;
        const i = (y * n + x) * 4;
        // The darker grain, in a warm brown; the lighter half is left clear.
        d[i] = 92; d[i + 1] = 74; d[i + 2] = 60; d[i + 3] = v < 0 ? Math.round(-v) : 0;
      }
      if (performance.now() - began > SLICE_MS) { await yieldTask(); began = performance.now(); }
    }
    g.putImageData(image, 0, 0);
    const blob = canvas.toBlob ? await new Promise(resolve => canvas.toBlob(resolve, 'image/png')) : null;
    return blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
  }
  function lay(st) {
    if (!texture) texture = makeTexture().catch(() => null);
    return texture.then(url => {
      if (!url || state !== st) return;
      st.texture.style.backgroundImage = `url("${url}")`;
      st.texture.style.backgroundSize = `${TEXTURE_TILE}px ${TEXTURE_TILE}px`;
    });
  }

  /* ---------- activation ---------- */

  // Plays an animation of ms (wall clock) through ctx.frame; step(t) gets t in 0..1. Resolves
  // at its end, at once (after step(1)) under reduced motion or in a hidden tab, and at once
  // without step(1) when the enter is interrupted (unless it belongs to the exit). The shared
  // frame loop pauses while the tab is hidden, so a tab hidden mid-animation finishes it at
  // once (step(1)) rather than leaving the enter unsettled; the frame callback then stays
  // registered and is dropped, without a step, at the first frame after the tab returns.
  function animate(st, ms, step, leaving = false) {
    const { ctx } = st;
    return new Promise(resolve => {
      if (!leaving && ctx.signal.aborted) { resolve(); return; }
      let start = -1; let done = false;
      const events = new AbortController();
      const finish = complete => {
        if (done) return;
        done = true;
        events.abort();
        if (complete) step(1);
        resolve();
      };
      if (document.hidden) { finish(true); return; }
      document.addEventListener('visibilitychange', () => { if (document.hidden) finish(leaving || !ctx.signal.aborted); }, { signal: events.signal });
      if (!leaving) ctx.signal.addEventListener('abort', () => finish(false), { signal: events.signal });
      const tick = (dt, now) => {
        if (done) return false;
        if (!leaving && ctx.signal.aborted) { finish(false); return false; }
        if (start < 0) start = now;
        const t = ctx.motion.matches ? 1 : Math.min(1, (now - start) / ms);
        step(t);
        if (t < 1) return undefined;
        finish(false);
        return false;
      };
      ctx.frame(tick);
    });
  }

  function build(ctx) {
    const kind = ctx.page && ctx.page.kind === 'paper' ? 'paper' : 'shell';
    const scoped = !navigator.userAgentData;      // Chromium only (see kindClasses)
    const st = { ctx, kind, scoped, tau: -1, prints: null, mixes: null, ripple: null, media: null, underlay: null, veil: true, seen: new WeakMap(), followed: new WeakSet() };
    state = st;
    // The scoped mode's underlay: the paper under the page, shown while the filters mix.
    if (scoped) {
      st.underlay = ctx.layer('fixed');
      st.underlay.classList.add('lens-darkroom-underlay');
    }
    // The print layer, whose backdrop filter prints everything below it (the page and its own
    // background); over it, at the same z-index and later in the document, the paper's
    // texture (scrolls with the page, drawn as it is) and then the images' layer (made by
    // ctx.media below, with its own filter); the safelight is over everything.
    st.print = ctx.layer('fixed');
    st.print.classList.add('lens-darkroom-sheet');
    buildDefs(st, st.print);
    st.texture = ctx.layer('page');
    st.texture.classList.add('lens-darkroom-texture');
    st.safelight = ctx.layer('fixed');
    st.safelight.classList.add('lens-darkroom-safelight');
    st.band = document.createElement('div');
    st.band.className = 'lens-darkroom-band';
    st.safelight.append(st.band);
    lay(st);
    // The silver prints: made as the images come near, hidden until the print is shown, and
    // for the photograph in the photography lightbox too (fixed: the helper's fixed layer,
    // which follows the lightbox as it opens, changes photo and closes). Each develops in as
    // it arrives; the veil is checked whenever images may have come or changed (an image
    // outside the scope, in the lightbox, reports only its own load or failure).
    st.media = ctx.media({ render: source => silverPrint(st, source), ground: '#ffffff', fixed: true }).catch(() => null);
    st.media.then(handle => {
      if (state !== st || ctx.signal.aborted) return;
      if (!handle) { lift(st); return; }
      handle.each(overlay => { developIn(st, overlay); follow(st, handle, overlay); });
      guardVeil(st);
    });
    ctx.onLayoutChange(() => guardVeil(st));
    ctx.onContentChange(() => guardVeil(st));
    const loaded = event => {
      const img = event.target;
      if (img instanceof HTMLImageElement && !ctx.scope.some(el => el.contains(img))) guardVeil(st);
    };
    ['load', 'error'].forEach(type => document.addEventListener(type, loaded, { capture: true, passive: true, signal: ctx.signal }));
    return st;
  }
  // The classes that stay on while the lens is on: the page kind, and the scoped mode where a
  // backdrop filter cannot print the page. Only Chromium renders an SVG filter in
  // backdrop-filter (WebKit drops the whole list, and CSS.supports() accepts it everywhere,
  // so it cannot be detected); elsewhere the filter goes on the scope's own elements and the
  // root is painted as paper (darkroom.css, lens-darkroom-scoped).
  const kindClasses = st => [st.kind === 'paper' ? CLS.paper : CLS.shell, ...(st.scoped ? [CLS.scoped] : [])];
  // The classes of the shown print: the print, and the veil over the page's own images.
  const printClasses = st => [CLS.print, ...(st.veil ? [CLS.veil] : [])];
  // The images near the viewport are ready, or ms have passed (or the activation ended).
  const imagesReady = (st, ms) => Promise.race([st.media.then(handle => handle && handle.ready), sleep(ms, st.ctx.signal)]);

  /* ---------- the veil and the late prints ---------- */

  // While the print is shown, the scope's same-origin images and the lightbox's photograph are
  // veiled (darkroom.css: masked to their border), so an image shows the bare paper (in the
  // lightbox, its dark ground) until its silver print arrives, never first the page filter's
  // print of it, whose tone differs. A print that arrives then develops in (an opacity
  // animation of its canvas, on the compositor); an image whose print is only remade (a new
  // size) keeps it at once. The lightbox has one img for every photograph, so a print is new
  // when its img shows a source it has not shown.
  function developIn(st, overlay) {
    const src = overlay.img.currentSrc || overlay.img.src;
    if (st.seen.get(overlay.img) === src) return;
    st.seen.set(overlay.img, src);
    if (st.ctx.motion.matches || document.hidden || typeof overlay.canvas.animate !== 'function') return;
    overlay.canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DEVELOP_IN_MS, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' });
  }
  // A fixed container's img that changes photograph (the lightbox's next and previous) keeps
  // the last print placed over it, stretched to the new photograph's box, until the helper has
  // made the new one (0.1-0.3 s). That print is hidden as soon as the img's source changes:
  // the veil shows the lightbox's dark ground, and the new print develops in. (A print shown
  // again is given its style afresh by the helper, so the hidden one comes back with it.)
  function follow(st, handle, overlay) {
    if (!overlay.fixed || st.followed.has(overlay.img)) return;
    st.followed.add(overlay.img);
    const img = overlay.img;
    // (currentSrc follows the new src only once the image loads: the attribute is read. A
    // develop-in still running would override the hidden style: it is cancelled.)
    const watch = new MutationObserver(() => {
      for (const shown of handle.overlays) {
        if (shown.img !== img || st.seen.get(img) === img.src) continue;
        if (typeof shown.canvas.getAnimations === 'function') shown.canvas.getAnimations().forEach(animation => animation.cancel());
        shown.canvas.style.opacity = '0';
      }
    });
    watch.observe(img, { attributes: true, attributeFilter: ['src', 'srcset'] });
    st.ctx.signal.addEventListener('abort', () => watch.disconnect(), { once: true });
  }
  function lift(st) {
    st.veil = false;
    html.classList.remove(CLS.veil);
  }
  // The veil may only cover images that get a print. One the media helper leaves alone (its
  // pixels cannot be read, it is smaller than MIN_SIDE) or one that failed to load (its alt
  // text must show) lifts the veil for the whole page: those images then print through the
  // page filter, as all images did before the veil (the lightbox's through the media filter).
  function guardVeil(st) {
    if (!st.veil || state !== st || !html.classList.contains(CLS.veil)) return;
    const kit = window.SiteLensesMedia;
    for (const img of document.body.querySelectorAll('img')) {
      if (!img.complete || img.closest('.lenses-layer')) continue;   // the helper picks it up when it loads
      const s = window.getComputedStyle(img);
      const mask = s.maskImage || s.webkitMaskImage;
      if (s.display === 'none' || s.visibility === 'hidden' || !mask || mask === 'none') continue;   // not veiled
      const r = img.getBoundingClientRect();
      if (!r.width && !r.height) continue;               // not rendered
      const px = name => parseFloat(s[name]) || 0;
      const w = r.width - px('borderLeftWidth') - px('borderRightWidth') - px('paddingLeft') - px('paddingRight');
      const h = r.height - px('borderTopWidth') - px('borderBottomWidth') - px('paddingTop') - px('paddingBottom');
      const svgSource = /\.svgz?(?:[?#]|$)/i.test(img.currentSrc || img.src);
      if (w < MIN_SIDE || h < MIN_SIDE || (!img.naturalWidth && !svgSource) || (kit && !kit.readable(img))) { lift(st); return; }
    }
  }

  /* ---------- the choreography ---------- */

  // The finished print in white light.
  function settle(st) {
    develop(st, 1);
    st.safelight.style.display = 'none';
    if (st.ripple) { st.ripple.cancel(); st.ripple = null; }
    html.classList.add(CLS.on, ...printClasses(st), ...kindClasses(st));
    html.classList.remove(CLS.mixing);
    guardVeil(st);
  }

  // Everything the lens changed, gone (its layers stay invisible until the core removes them).
  function teardown(st) {
    if (st.ripple) { st.ripple.cancel(); st.ripple = null; }
    st.safelight.style.display = 'none';
    html.classList.remove(CLS.on, CLS.print, CLS.veil, CLS.mixing, CLS.shell, CLS.paper, CLS.scoped);
  }

  // The tray is rocked once: a faint band of reflected safelight drifts across the sheet.
  function rock(st) {
    if (typeof st.band.animate !== 'function') return;
    st.ripple = st.band.animate([
      { transform: 'translateX(-130%) skewX(-18deg)', opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { opacity: 1, offset: 0.75 },
      { transform: 'translateX(230%) skewX(-18deg)', opacity: 0 }
    ], { duration: RIPPLE_MS, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'both' });
  }

  async function enter(ctx) {
    const st = build(ctx);
    if (ctx.motion.matches || document.hidden) {
      settle(st);
      await imagesReady(st, SETTLE_WAIT_MS);
      return;
    }
    // 1. Lights out: the room turns to safelight, the page to a blank sheet of paper.
    mixTables(st, true);
    mix(st, 0);
    st.safelight.style.opacity = '0';
    st.safelight.style.display = 'block';
    html.classList.add(CLS.on, CLS.mixing, ...kindClasses(st));
    await animate(st, LIGHTS_OUT_MS, t => {
      st.safelight.style.opacity = ease(Math.min(1, t * 1.3)).toFixed(3);
      mix(st, ease(clamp01((t - 0.15) / 0.85)));
    });
    if (ctx.signal.aborted) return;
    // The sheet is blank: the print's styles (the veil, and the images' overlays) change
    // nothing visible now. The veil is checked at once: the layout and media reports that came
    // while the lights went out found no veil to check. In the dark, the images near the
    // viewport are prepared.
    develop(st, 0);
    html.classList.add(...printClasses(st));
    html.classList.remove(CLS.mixing);
    guardVeil(st);
    if (!ctx.motion.matches && !document.hidden) await imagesReady(st, HOLD_MS);
    if (ctx.signal.aborted) return;
    // 2. Development: darkest tones first.
    if (!ctx.motion.matches && !document.hidden) rock(st);
    await animate(st, DEVELOP_MS, t => develop(st, t));
    if (ctx.signal.aborted) return;
    // 3. Lights on.
    await animate(st, LIGHTS_ON_MS, t => { st.safelight.style.opacity = (1 - ease(t)).toFixed(3); });
    if (ctx.signal.aborted) return;
    settle(st);
  }

  // A page opened while the lens is on: the paper is already painted (the pre-paint ground),
  // so the finished print appears at once; the images show the paper until their prints
  // arrive and develop in.
  async function arrive(ctx) {
    const st = build(ctx);
    settle(st);
    await imagesReady(st, SETTLE_WAIT_MS);
  }

  // Without view transitions: the filters crossfade from the print (or, blank, from the blank
  // sheet) back to the page, with the page's own images shown again under their prints.
  async function fadeBack(st, blank) {
    const layer = document.querySelector('body > .lenses-media-layer');
    mixTables(st, blank);
    mix(st, 1);
    html.classList.add(CLS.mixing);
    html.classList.remove(CLS.veil);
    await animate(st, blank ? BLANK_FADE_MS : EXIT_MS, t => {
      const w = 1 - ease(t);
      mix(st, w);
      st.texture.style.opacity = w.toFixed(3);
      if (layer) layer.style.opacity = w.toFixed(3);
    }, true);
  }

  async function exit(ctx) {
    const st = state;
    if (!st) return;
    // Read live: an instant reset (the first egg, pagehide) may come during the exit.
    const hurried = () => ctx.instant || ctx.motion.matches || document.hidden;
    const quick = hurried() || !html.classList.contains(CLS.on);
    // In the dark theme the page is light type on a dark ground and the print the reverse, so
    // a straight crossfade would pass through a grey in which the type vanishes. There the ink
    // first goes back into the paper (the development in reverse: highlights first, the
    // darkest tones last), and the blank sheet then crossfades to the page.
    const blank = !quick && html.dataset.theme === 'dark' && html.classList.contains(CLS.print) && !html.classList.contains(CLS.mixing);
    if (blank && st.tau > 0) {
      const from = st.tau;
      await animate(st, UNDEVELOP_MS, t => develop(st, from * (1 - t)), true);
    }
    if (quick || hurried()) teardown(st);
    else if (typeof document.startViewTransition === 'function') {
      // The print (or the blank sheet) is the old snapshot, the page the new one; darkroom.css
      // times the crossfade. An instant reset meanwhile skips to its end (a frame callback
      // watches for it while the transition runs).
      html.classList.add(CLS.vtOut, ...(blank ? [CLS.vtBlank] : []));
      let vt = null;
      try { vt = document.startViewTransition(() => teardown(st)); } catch (error) { teardown(st); }
      if (vt) {
        vt.ready.catch(() => {});
        vt.updateCallbackDone.catch(() => {});
        let running = true;
        ctx.frame(() => {
          if (!running) return false;
          if (!hurried()) return undefined;
          try { vt.skipTransition(); } catch (error) { /* already finished */ }
          return false;
        });
        await vt.finished.catch(() => {});
        running = false;
      }
      html.classList.remove(CLS.vtOut, CLS.vtBlank);
    } else {
      await fadeBack(st, blank);
      teardown(st);
    }
    if (state === st) state = null;
  }

  window.SiteLenses.register({
    id: 'darkroom',
    order: 9,
    numeral: 'IX',
    label: 'Darkroom',
    line: 'A print develops darkest tones first.',
    ground: '#f4f0e6',               // the paper, painted before a page arrives
    css: true,
    enter,
    arrive,
    exit,
    // Test-only hooks (tests/browser_lens_darkroom.js): a silver print of any source, as the
    // media helper would ask for it, and the print work's longest task.
    _test: {
      print: (source, signal = new AbortController().signal) => silverPrint({ ctx: { signal } }, source),
      perf,
      resetPerf() { perf.slices = 0; perf.maxMs = 0; perf.maxStrips = 0; }
    }
  });
})();
