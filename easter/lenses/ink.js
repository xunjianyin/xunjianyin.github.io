/**
 * Lens VI · Ink: "Ink has five colours (墨分五色)."
 *
 * The page as ink on xuan paper (宣纸). Chinese painting teaches that one black ink, diluted,
 * gives five colours: 焦 scorched, 浓 thick, 重 heavy, 淡 light and 清 clear. The lens sets
 * the page in exactly that palette, with cinnabar (朱砂, the seal paste) as the only colour:
 * headings in 焦, running text in 浓, secondary text in 重, muted text in 淡, rules and
 * borders in 清, links in cinnabar. Every image is painted as an ink wash (水墨), and one
 * small cinnabar seal, carved in relief (朱文) with a logarithmic spiral (the first egg's
 * motif), is pressed after the page's name or title. No word changes and the layout is
 * identical: only colours, the paper, the paintings and the seal.
 *
 * Drawing:
 *   the paper   a seamless tile generated once in slices (a cloudy formation of periodic
 *               lattice noise, fine grain, long sparse wandering fibres that taper), kept in
 *               sessionStorage per pixel ratio as a JPEG data URL, so the next page arrives at
 *               once. It is the page's background (a rule inserted into ink.css's own sheet, so
 *               nothing is written on <html>); the veil and the paintings use the same JPEG,
 *               decoded once into a canvas, laid on its own pixels aligned to the document: one
 *               sheet. A painting whose image moves (without changing size) is laid again.
 *   the text    explicit colour rules in ink.css. Site-shell pages: every element in the
 *               scope inherits its tone from the nearest role rule, so the site's own colours
 *               give way; paper pages: their palette variables, a few explicit rules, and an
 *               SVG filter (#lens-ink-wash) on the demos, figures and charts that turns every
 *               colour into ink of the same darkness laid on the paper (white becomes clear
 *               paper). Its grey weights favour red over green, and cool colours take a little
 *               more ink (a capped term), so the demos' codes of one luminance (green and rust,
 *               and their pale tints) stay apart in tone. A soft, tiny halo lets the ink feather
 *               into the paper at glyph edges.
 *   the images  ctx.media overlays, computed in slices of at most 6 ms. Photos, on as many
 *               pixels as the box shows (up to 1.5 per css px, 1.2 MP in all): darkness,
 *               levels, an edge-preserving (guided) filter on either side of a local contrast
 *               taken against an edge-aware base (calm washes with crisp shapes, as a brush lays
 *               them, with no halo along strong edges), tones moved toward the five inks with
 *               soft, wet steps, ink pooled at the edges of washes, the sheet's light fibres
 *               resisting the palest ink, granulation, and highlights left as bare paper (留白).
 *               Graphics: ink where a pixel is darker than the graphic's own background (on a
 *               dark background: where it differs), by luminance through a curve that is steep
 *               over pale fills, so pale codes keep their order and stay apart (a grey, a blue
 *               and a yellow box; route tints lighter than grey bars), hue moving a tint by a
 *               small step at most; dark strokes become ink, the background (and anything
 *               lighter) paper, labels stay crisp. Unreadable images (another origin) keep a
 *               CSS print of ink on paper (#lens-ink-print), as every image does until its
 *               painting is ready; photos are printed through the wash's own tone curve
 *               (#lens-ink-print-wash), so the painting that replaces the print is a small
 *               step; a painting finished after the bloom has begun soaks in (a 420 ms fade).
 *               The photography lightbox is a sheet of the same paper, and its photo is painted
 *               like the gallery's (the helper's fixed option), on the lightbox's own paper;
 *               while the photo now shown has no painting yet (it opens, or shows the next
 *               photo) the lightbox shows its bare paper, and the painting soaks in from it.
 *   the seal    a canvas in a page layer after the trigger's last line; nearer the line, then
 *               smaller, when the line ends near the viewport's edge, or under its end; never on
 *               a letter. A caption beside the trigger makes room for it (its letters move along
 *               their line by the seal's width, when they still fit); a caption that cannot,
 *               the seal waits for until it begins to fade; and for its title if that comes
 *               late (markdown).
 *
 * Enter (about 1.45 s): a veil of the same paper fades in over the page (0.28 s; the paintings
 * are made meanwhile), the style switches under it, then the ink blooms: each text block's ink
 * spreads outward from a few soft blots and each painting from its darkest tones first,
 * sweeping top to bottom. The time each 6 px cell of the viewport is reached is a field: the
 * block's start, plus its squared distance from the nearest blot (diffusing ink slows), plus
 * gradient noise for a ragged wet edge; for a painting, its own darkness decides most of the
 * order. A cell inside a block's box keeps that block's time (a neighbour's margin never cuts
 * its lines). The veil is that field thresholded with a feathered edge on 6 px cells, smoothed
 * as it is scaled up, cutting the paper pattern: one small putImageData and two canvas draws
 * per frame. The seal is pressed last. Exit (0.6 s): the paper washes down over the ink (0.36 s),
 * the page is switched back under it, and the veil fades (0.24 s); an exit during the whitening
 * fades the veil from where it is. Arrive: the settled state at once over the pre-painted paper.
 * Reduced motion or an instant exit: the settled state at once, and back at once; an instant
 * reset during the exit (pagehide, a hidden tab) cuts it short, and a play that gets no frames
 * still ends in real time.
 */
(() => {
  'use strict';
  if (!window.SiteLenses) return;

  /* ---------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------- */
  // Paper: xuan, warm off-white. The tile (css px) holds whole noise periods, so it repeats
  // without a seam; it is drawn at min(devicePixelRatio, 2) device px per css px.
  const PAPER_HEX = '#f3efe4';
  const PAPER_RGB = [243, 239, 228];
  const TILE = 600;
  const FORMATION = [[3, 1], [6, 0.6], [15, 0.3], [40, 0.12]];   // [cells per tile, weight]
  const FORMATION_DEPTH = 0.03;       // ± lightness of the cloudy formation
  const GRAIN_DEPTH = 0.012;          // ± per-pixel grain
  const FIBRES = 110;                 // fibres per tile (60 % long, the rest short and fine) ...
  const FIBRE_LENGTH = [60, 320];     // ... the long ones, css px
  const FIBRE_WIDTH = [0.4, 0.95];    // css px
  const SEED = 1931;                  // a fixed sheet: the same paper every time
  // sessionStorage: the tile as a data URL, per pixel ratio (v2: the sheet has no specks, whose
  // dots marked the tile's 600 px period as a lattice)
  const PAPER_KEY = 'lenses-ink-paper-v2';
  const SLICE_MS = 6;                 // longest stretch of work between yields

  // Ink. Densities of the five inks over paper (as alpha), lightest first: 清 淡 重 浓 焦.
  const INK_RGB = [24, 22, 20];       // the stick's black, as the paintings use it
  const INK_PALE_RGB = [70, 72, 76];  // diluted ink reads a little cooler
  const DENSITY = [0, 0.12, 0.3, 0.52, 0.76, 0.95];   // paper, then the five inks
  // Colour into ink on paper pages (the wash filter #lens-ink-wash over demos and charts). The
  // grey: weights on R, G, B (sum 1); red counts more than luminance would give it, so the
  // demos' green and rust codes of one luminance print as different tones.
  const WASH_WEIGHTS = [0.5, 0.36, 0.14];
  const WASH_GAIN = 1.06;             // ink alpha = gain x (1 - grey), so the page's ink reads as 浓
  const WASH_INK = [22, 21, 19];
  // Cool colours print a little denser: ink + min(COOL_CAP, COOL_GAIN x ((G + B) / 2 - R)), in
  // channel units of [0, 1], when positive. A pale green and a pale rust tint of one strength
  // (the demos' within/across codes, their legend keys) then lie an ink step apart, while a
  // saturated colour moves at most COOL_CAP and no warm code loses ink (red stays red's tone).
  const COOL_GAIN = 2;
  const COOL_CAP = 0.08;

  // Photos (ink wash), in css px where a length.
  const WORK_DENSITY = 1.5;           // the wash is computed on at most this many pixels per css px
                                      // of the image's box (the source's own pixels at most) ...
  const WORK_MAX = 1.2e6;             // ... and on at most this many in all (the lightbox), then scaled
  const LOCAL_RADIUS = 14;            // local contrast: radius of the edge-aware base
  const LOCAL_EPS = 0.02;             // ... whose edges (variance above this, in darkness^2) are
                                      // kept, so no halo rings a dark head against a pale sky
  const LOCAL_BASE = 0.97;            // darkness kept from the photo (large dark masses stay 焦/浓) ...
  const LOCAL_DETAIL = 0.9;           // ... plus this much of its local contrast
  const BRUSH_RADIUS = 2.5;           // the guided filter's box radius (css px): the scale of a wash ...
  const BRUSH_SHARE = 0.009;          // ... at most this share of the shorter side (at least 1 px)
  const BRUSH_EPS = 0.006;            // variance (in darkness^2) below which texture becomes wash
  const TONE_GAMMA = 1.25;            // > 1 lets the light middle tones fall to paper
  const PAPER_CUT = [0.15, 0.38];     // darkness below this is bare paper (留白), smoothly
  const SOFT_STEP = 0.24;             // half-width of a wet step between two inks (in steps)
  const QUANTISE = 0.72;              // how far tones move to the five inks (graded washes keep some grade)
  const WET_RADIUS = 0.7;             // the steps are softened this much (css px)
  const POOL_RADIUS = 3;              // ink pools at the edge of a wash ...
  const POOL = 0.32;                  // ... this strongly
  const FIBRE_INK = 0.08;             // the sheet's light fibres take up to 8 % less of the palest
                                      // ink, falling as (1 - ink)^2 (a face's middle tones show
                                      // no fibre crossing them; dense ink covers them)
  const GRANULATION = 0.035;          // pigment grain ±3.5 %
  const SHEET_UNDER_INK = 0.15;       // under ink the sheet's own texture (its long light fibres)
                                      // fades out by this density, so none crosses a face; bare
                                      // paper (留白) keeps it, matching the page around it
  // Graphics (ink line drawings). On a light ground: ink where a pixel is darker than the
  // ground (lighter is paper too: a white strip in a grey figure), by its luminance through a
  // curve that is steep over the palest fills and even beyond them, so a figure's pale codes
  // keep their order of lightness and stay apart (a grey, a pale yellow and a pale blue box;
  // pale route tints and the darker grey bars between them). Hue moves a tint by a small step
  // at most: cool tints take a little more ink, warm ones a little less, in proportion to the
  // tint's own ink while it is very pale. On a dark ground (a screenshot of a dark UI): ink
  // where a pixel differs from it.
  const GRAPHIC_FLOOR = [0.012, 0.03];    // darkness below this is paper (compression noise)
  const GRAPHIC_PALE = [2.6, 0.16];       // ink = 2.6 x darkness up to darkness 0.16, then evenly to 1
  const GRAPHIC_HUE = [0.38, 0.05];       // ink + 0.38 x ((G + B) / 2 - R) (channels in [0, 1], against
                                          // the ground's), within ± 0.05 ...
  const GRAPHIC_HUE_FULL = 0.06;          // ... in full from this much ink (less below: paper stays paper)
  const GRAPHIC_DARK_GROUND = 0.5;        // a ground whose luminance is below this is dark ...
  const GRAPHIC_GAIN = 1.08;              // ... and ink is this per unit of difference from it,
  const GRAPHIC_DARK_FLOOR = [0.025, 0.075];   // differences below this being paper

  // The bloom (enter) and the wash (exit), times in s, lengths in css px.
  const WHITEN_MS = 280;              // the veil of paper fades in
  const MEDIA_BY_MS = 340;            // the paintings (begun with the enter) get until this long
                                      // after it began, at least MEDIA_GRACE_MS after the whiten;
  const MEDIA_GRACE_MS = 30;          // later ones soak in (no still blank paper is held)
  const CELL = 6;                     // the veil's field is drawn on cells of this size
  const SWEEP = 0.42;                 // blocks start top to bottom over this long ...
  const JITTER = 0.08;                // ... each a little early or late
  const SPREAD = 0.44;                // a block's ink reaches its farthest cell after this long
  const MEDIA_SPREAD = 0.56;          // a painting's lightest tones after this long
  const FIELD_NOISE = 0.075;          // ragged wet edge (s of the field)
  const FEATHER = 0.085;              // the edge's softness (s)
  const REST = [0.74, 1.08];          // what no block covers (borders, panels) clears in this span
  const BLOOM = 1.08;                 // the bloom's length
  const WASH = 0.36;                  // exit: the paper washes down ...
  const WASH_SWEEP = 0.2;             // ... top to bottom over this long ...
  const WASH_NOISE = 0.1;             // ... with a ragged front (s)
  const OUT_MS = 240;                 // ... then the veil fades from the normal page
  const PLAY_SLACK_MS = 200;          // a play with no frames (a hidden tab) ends this long after its length
  const BLOCK_LIMIT = 600;            // text blocks considered for the bloom at most
  const BLOT_EVERY = 240;             // one blot per this much block width (1 to 4 blots)
  const ARRIVE_PAPER_MS = 120;        // arrival: the paper gets this long (it is recalled in a few
                                      // ms; a paper made again follows the switch) ...
  const ARRIVE_BUDGET_MS = 280;       // ... and the paintings what is left of this, from the start
                                      // (later ones soak in), so an arrival keeps within 350 ms
  const REALIGN_DELAY_MS = 60;        // a painting just shown is checked against its paper after this
  const SCROLL_REST_MS = 120;         // a scroller holding paintings (a figure strip) rests this long
  const AWAIT_LIMIT_MS = 4000;        // the lightbox shows its paper at most this long for a painting
  const PRINT_TABLE = 33;             // entries of the photo print's tone table ...
  const PRINT_LIFT = 0.12;            // ... whose darkness below this is paper (the gallery's prints
                                      // then match their paintings' tone, on average, within 1 level)

  // The seal, as fractions of the trigger's font size (css px).
  const SEAL_SCALE = 0.78;
  const SEAL_SIZE = [16, 30];
  const SEAL_GAP = 0.24;
  const SEAL_MIN_GAP = 4;             // css px: the seal never comes closer to a letter than this
  const SEAL_EDGE = 3;                // css px kept free at the viewport's right edge
  const SEAL_RGB = [176, 54, 40];     // cinnabar paste, a touch brighter than the links
  const SEAL_TILT = -0.035;           // rad
  const SEAL_WAIT_MS = 6000;          // the longest the seal waits for an overlapping caption
  const SEAL_CAPTION_GAP = 14;        // css px between the seal and a caption's letters beside it
  const SEAL_CAPTION_PAD = 4;         // css px: the caption's halo around its letters

  const CLS = {
    on: 'lens-ink', shell: 'lens-ink-shell', paper: 'lens-ink-paper', home: 'lens-ink-home',
    caption: 'lens-ink-caption', pending: 'lens-ink-pending', leaving: 'lens-ink-leaving', instant: 'lens-ink-instant',
    awaiting: 'lens-ink-awaiting', print: 'lens-ink-lightbox-print'
  };
  const TRIGGER = '.profile-text .name, #main-content [data-lens-trigger], #main-content h1';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SHEET = 'easter/lenses/ink.css';

  const html = document.documentElement;
  let state = null;                   // the running activation, or null
  let paper = null;                   // { url, source, k } once made (kept for later activations)
  const seals = new Map();            // "size@k" -> canvas
  const blotsOf = new WeakMap();      // a painting's canvas -> { blots, grid, gw, gh }

  /* ---------------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------------- */
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ratio = () => Math.min(window.devicePixelRatio || 1, 2);
  // A small seeded generator, so the paper and the seal are the same every time.
  const random = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Gradient (Perlin) noise from an integer hash: smooth, about [0, 1], any scale, no table,
  // and free of the square lattice that value noise shows when it is thresholded.
  const hash = (x, y, s) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const corner = (ix, iy, s, dx, dy) => { const a = hash(ix, iy, s) * 6.283185; return Math.cos(a) * dx + Math.sin(a) * dy; };
  function noise(x, y, s) {
    const x0 = Math.floor(x); const y0 = Math.floor(y);
    const fx = x - x0; const fy = y - y0;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10); const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = corner(x0, y0, s, fx, fy); const b = corner(x0 + 1, y0, s, fx - 1, fy);
    const c = corner(x0, y0 + 1, s, fx, fy - 1); const d = corner(x0 + 1, y0 + 1, s, fx - 1, fy - 1);
    return 0.5 + 0.75 * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
  }

  // Resolves after ms, or at once when the signal aborts (never rejects).
  const sleep = (ms, signal) => new Promise(resolve => {
    if (signal && signal.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });

  // A task boundary: a message, not a timer (timers are clamped and throttled).
  const channel = new MessageChannel();
  const waiting = [];
  channel.port1.onmessage = () => { const resolve = waiting.shift(); if (resolve) resolve(); };
  const yieldTask = () => new Promise(resolve => { waiting.push(resolve); channel.port2.postMessage(0); });

  // Runs a generator in slices of SLICE_MS; null when the signal aborted on the way.
  async function runSliced(steps, signal) {
    let began = performance.now();
    for (;;) {
      const step = steps.next();
      if (step.done) return step.value;
      if (performance.now() - began > SLICE_MS) {
        await yieldTask();
        if (signal && signal.aborted) return null;
        began = performance.now();
      }
    }
  }

  // Separable box blur of a w x h field (edges clamped), one row or column per yield.
  function* blur(src, w, h, r) {
    if (r < 1) return src;
    const tmp = new Float32Array(w * h); const out = new Float32Array(w * h); const span = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const row = y * w; let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / span;
        sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
      if ((y & 7) === 7) yield;
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / span;
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
      if ((x & 7) === 7) yield;
    }
    return out;
  }
  // Two box passes: close to a Gaussian.
  function* soften(src, w, h, r) {
    const once = yield* blur(src, w, h, r);
    return yield* blur(once, w, h, r);
  }

  // Self-guided filter (He, Sun and Tang, "Guided Image Filtering", 2010) of a w x h field:
  // each pixel becomes a x v + b, with a and b fitted in the (2r + 1)^2 box around it and
  // averaged over the boxes that hold it. Where the box varies less than eps (grain, noise,
  // a plaster wall) a goes to 0 and the box mean is left; across a real edge a goes to 1 and
  // the edge stays. Calm washes with crisp shapes, and no blocks (a Kuwahara filter's square
  // quadrants leave them on low-contrast texture). Four box blurs; one row or column per yield.
  function* guided(src, w, h, r, eps) {
    const N = w * h; const sq = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      sq[i] = src[i] * src[i];
      if ((i & 0x3ffff) === 0x3ffff) yield;
    }
    const mean = yield* blur(src, w, h, r);
    const meanSq = yield* blur(sq, w, h, r);
    const a = sq; const b = new Float32Array(N);            // sq is no longer needed: reuse it
    for (let i = 0; i < N; i++) {
      const variance = Math.max(0, meanSq[i] - mean[i] * mean[i]);
      a[i] = variance / (variance + eps); b[i] = mean[i] - a[i] * mean[i];
      if ((i & 0x1ffff) === 0x1ffff) yield;
    }
    const meanA = yield* blur(a, w, h, r);
    const meanB = yield* blur(b, w, h, r);
    for (let i = 0; i < N; i++) {
      meanA[i] = meanA[i] * src[i] + meanB[i];
      if ((i & 0x3ffff) === 0x3ffff) yield;
    }
    return meanA;
  }

  // The page kind from the core, or worked out here.
  function pageKind(ctx) {
    if (ctx.page && ctx.page.kind) return ctx.page.kind;
    if (document.querySelector('#main-content.paper-container')) return 'paper';
    return document.querySelector('#main-content .profile-section') ? 'home' : 'site';
  }

  /* ---------------------------------------------------------------------------
   * The paper
   * ------------------------------------------------------------------------- */
  function* paperSteps(k) {
    const n = Math.round(TILE * k);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const g = canvas.getContext('2d', { willReadFrequently: true });   // in memory: putImageData is a copy
    const image = g.createImageData(n, n);
    const d = image.data;
    const rand = random(SEED);
    // The formation: octaves of wrapped lattices, bilinearly smoothed (periodic in the tile).
    const octaves = FORMATION.map(([cells, weight]) => ({
      cells, weight, cellPx: n / cells, lattice: Float32Array.from({ length: cells * cells }, () => rand() * 2 - 1)
    }));
    const total = FORMATION.reduce((sum, [, weight]) => sum + weight, 0);
    const rows = octaves.map(() => ({ r0: 0, r1: 0, sy: 0 }));
    for (let y = 0; y < n; y++) {
      octaves.forEach((o, i) => {
        const gy = y / o.cellPx; const y0 = Math.floor(gy); const fy = gy - y0;
        rows[i].r0 = (y0 % o.cells) * o.cells; rows[i].r1 = ((y0 + 1) % o.cells) * o.cells; rows[i].sy = fy * fy * (3 - 2 * fy);
      });
      for (let x = 0; x < n; x++) {
        let v = 0;
        for (let i = 0; i < octaves.length; i++) {
          const o = octaves[i]; const row = rows[i];
          const gx = x / o.cellPx; const x0 = Math.floor(gx); let fx = gx - x0; fx = fx * fx * (3 - 2 * fx);
          const c0 = x0 % o.cells; const c1 = (x0 + 1) % o.cells; const L = o.lattice;
          const top = L[row.r0 + c0] + (L[row.r0 + c1] - L[row.r0 + c0]) * fx;
          const bottom = L[row.r1 + c0] + (L[row.r1 + c1] - L[row.r1 + c0]) * fx;
          v += (top + (bottom - top) * row.sy) * o.weight;
        }
        const l = (v / total) * FORMATION_DEPTH + (rand() - 0.5) * GRAIN_DEPTH;
        const i4 = (y * n + x) * 4;
        // Thicker flocs read a little greyer and warmer, as the sheet does against the light.
        d[i4] = PAPER_RGB[0] * (1 + l);
        d[i4 + 1] = PAPER_RGB[1] * (1 + l * 1.05);
        d[i4 + 2] = PAPER_RGB[2] * (1 + l * 1.18);
        d[i4 + 3] = 255;
      }
      yield;
    }
    g.putImageData(image, 0, 0);
    yield;

    // Fibres: long, sparse, wandering, tapering at both ends; most a little lighter than the
    // sheet, some darker. A fibre that crosses the tile's edge is drawn at its wrapped copies
    // too, so the tile stays seamless.
    g.lineCap = 'round';
    const strokeFibre = (points, widths, alphas, light, ox, oy) => {
      for (let p = 1; p < points.length; p++) {
        g.strokeStyle = light ? `rgba(255, 254, 249, ${alphas[p].toFixed(3)})` : `rgba(122, 110, 92, ${alphas[p].toFixed(3)})`;
        g.lineWidth = widths[p];
        g.beginPath();
        g.moveTo(points[p - 1][0] + ox, points[p - 1][1] + oy);
        g.lineTo(points[p][0] + ox, points[p][1] + oy);
        g.stroke();
      }
    };
    for (let f = 0; f < FIBRES; f++) {
      const fine = f >= FIBRES * 0.6;                    // the rest: shorter, finer, fainter
      const length = (fine ? 20 + rand() * 70 : FIBRE_LENGTH[0] + Math.pow(rand(), 1.6) * (FIBRE_LENGTH[1] - FIBRE_LENGTH[0])) * k;
      let x = rand() * n; let y = rand() * n; let angle = rand() * Math.PI * 2; let turn = 0;
      const stepPx = 3 * k; const steps = Math.max(2, Math.round(length / stepPx));
      const light = rand() < 0.7;
      const peak = (light ? 0.22 + rand() * 0.3 : 0.04 + rand() * 0.06) * (fine ? 0.6 : 1);
      const width = (FIBRE_WIDTH[0] + rand() * (FIBRE_WIDTH[1] - FIBRE_WIDTH[0])) * k * (fine ? 0.7 : 1);
      const points = [[x, y]]; const widths = [width]; const alphas = [0];
      let x0 = x; let x1 = x; let y0 = y; let y1 = y;
      for (let s = 1; s <= steps; s++) {
        // A wandering heading: the turn itself drifts, so bends come and go.
        turn = turn * 0.85 + (rand() - 0.5) * 0.035;
        angle += turn;
        x += Math.cos(angle) * stepPx; y += Math.sin(angle) * stepPx;
        const t = s / steps; const taper = Math.sin(Math.PI * t);
        points.push([x, y]); widths.push(width * (0.45 + 0.55 * taper)); alphas.push(peak * Math.pow(taper, 0.6));
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const pad = width + 2;
      const xs = [0, ...(x0 - pad < 0 ? [n] : []), ...(x1 + pad > n ? [-n] : [])];
      const ys = [0, ...(y0 - pad < 0 ? [n] : []), ...(y1 + pad > n ? [-n] : [])];
      for (const ox of xs) for (const oy of ys) strokeFibre(points, widths, alphas, light, ox, oy);
      yield;
    }
    return canvas;
  }

  // The tile as { url, source, k }: from sessionStorage or generated in slices (the generated
  // tile is encoded off the main thread and kept as a data URL). url is the page's background;
  // source is the same JPEG decoded (so the page, the paintings and the veil show exactly the
  // same sheet) and drawn into a canvas once. Not the decoded ImageBitmap itself: as a
  // CanvasPattern's source a JPEG-decoded bitmap costs the GPU a decode on every draw, which at
  // a pixel ratio of 2 held the veil to 20-30 frames a second; a canvas pattern draws at full rate.
  async function tileCanvas(url, n) {
    let image = null;
    try {
      if (typeof createImageBitmap === 'function') image = await createImageBitmap(await (await fetch(url)).blob());
    } catch (error) { image = null; }
    if (!image) { image = new Image(); image.src = url; await image.decode(); }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    canvas.getContext('2d').drawImage(image, 0, 0, n, n);
    if (typeof image.close === 'function') image.close();
    return canvas;
  }
  // A new paper replaces an old one (the pixel ratio changed): the running activation's
  // background rule follows, and the old tile's object URL is let go.
  function replacePaper(next) {
    const old = paper;
    paper = next;
    if (state && state.rule) { dropRule(state); paperRule(state); }
    if (old && old !== next && old.url.startsWith('blob:')) URL.revokeObjectURL(old.url);
    return next;
  }
  async function makeSheet(signal) {
    const k = ratio(); const n = Math.round(TILE * k);
    // Known, with its decoded pixels given back after the last exit: decoded again.
    if (paper && paper.k === k) {
      if (!paper.source) paper.source = await tileCanvas(paper.url, n);
      return paper;
    }
    const key = `${PAPER_KEY}@${k}`;
    let kept = null;
    try { kept = sessionStorage.getItem(key); } catch (error) { kept = null; }
    if (kept && kept.startsWith('data:image/')) {
      try { return replacePaper({ url: kept, source: await tileCanvas(kept, n), k }); } catch (error) { /* draw it again */ }
    }
    const canvas = await runSliced(paperSteps(k), signal);
    if (!canvas) return null;
    const blob = canvas.toBlob ? await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9)) : null;
    if (!blob) {
      const url = canvas.toDataURL('image/jpeg', 0.9);
      try { sessionStorage.setItem(key, url); } catch (error) { /* full or unavailable */ }
      return replacePaper({ url, source: canvas, k });
    }
    const url = URL.createObjectURL(blob);
    const reader = new FileReader();
    reader.onload = () => { try { sessionStorage.setItem(key, reader.result); } catch (error) { /* full or unavailable */ } };
    reader.readAsDataURL(blob);
    let source = canvas;
    try { source = await tileCanvas(url, n); } catch (error) { source = canvas; }
    return replacePaper({ url, source, k });
  }

  // One making at a time: an enter, the paintings and a later activation share it.
  let making = null;
  function makePaper(signal) {
    if (paper && paper.k === ratio() && paper.source) return Promise.resolve(paper);
    if (!making) making = makeSheet(signal).finally(() => { making = null; });
    return making;
  }
  // After the last exit nothing is painted until the next activation: the sheet's pixel arrays
  // (about 10 MB at a pixel ratio of 2) and the decoded tile are given back; the tile's URL is
  // kept, and decoding it again takes a few ms.
  function releasePaper() {
    sheet = null;
    if (paper && !making) paper.source = null;
  }

  // The paper as a pattern for a canvas whose pixel (0, 0) lies at document (x, y) css px,
  // r canvas px per css px: the same sheet as the page's background. One pattern per context.
  const patterns = new WeakMap();      // 2D context -> { source, pattern }
  function paperPattern(g, x, y, r) {
    let kept = patterns.get(g);
    if (!kept || kept.source !== paper.source) {
      kept = { source: paper.source, pattern: g.createPattern(paper.source, 'repeat') };
      patterns.set(g, kept);
    }
    const s = r / paper.k;
    if (kept.pattern && typeof kept.pattern.setTransform === 'function') kept.pattern.setTransform(new DOMMatrix([s, 0, 0, s, -x * r, -y * r]));
    return kept.pattern;
  }

  /* ---------------------------------------------------------------------------
   * The paintings (media overlays)
   * ------------------------------------------------------------------------- */
  // The outermost position: fixed ancestor of img below <body> (the photography lightbox), or null.
  function fixedRoot(img) {
    let root = null;
    for (let el = img; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (getComputedStyle(el).position === 'fixed') root = el;
    }
    return root;
  }
  // Where the image's content box lies on the paper (css px), and its size. In the page the
  // paper is the document's background, so this is the box's document position; in a fixed
  // container (the lightbox) the paper is the container's own background, its tile starting at
  // the container's padding box, so it is the box's position there.
  function origin(img) {
    const r = img.getBoundingClientRect();
    const s = getComputedStyle(img);
    const px = name => parseFloat(s[name]) || 0;
    const left = px('borderLeftWidth') + px('paddingLeft'); const top = px('borderTopWidth') + px('paddingTop');
    const root = fixedRoot(img);
    const b = root ? root.getBoundingClientRect() : null;
    const x0 = root ? -(b.left + root.clientLeft) : scrollX; const y0 = root ? -(b.top + root.clientTop) : scrollY;
    return {
      x: r.left + x0 + left, y: r.top + y0 + top,
      width: r.width - left - px('borderRightWidth') - px('paddingRight'), height: r.height - top - px('borderBottomWidth') - px('paddingBottom')
    };
  }

  // The darkest places of a w x h density field: up to three blots (fractions of the box)
  // and a coarse grid (one value per bloom cell) for the bloom.
  function shape(dens, w, h, cssW, cssH) {
    const gw = Math.max(1, Math.round(cssW / CELL)); const gh = Math.max(1, Math.round(cssH / CELL));
    const grid = new Float32Array(gw * gh); const count = new Float32Array(gw * gh);
    const step = Math.max(2, Math.round(Math.sqrt((w * h) / 60000)));   // about 60 k samples
    for (let y = 0; y < h; y += step) {
      const gy = Math.min(gh - 1, Math.floor((y / h) * gh));
      for (let x = 0; x < w; x += step) {
        const at = gy * gw + Math.min(gw - 1, Math.floor((x / w) * gw));
        grid[at] += dens[y * w + x]; count[at]++;
      }
    }
    for (let i = 0; i < grid.length; i++) grid[i] = count[i] ? grid[i] / count[i] : 0;
    // Blots: the darkest cells of a 6 x 6 coarsening, kept apart.
    const C = 6; const coarse = [];
    for (let cy = 0; cy < C; cy++) {
      for (let cx = 0; cx < C; cx++) {
        let sum = 0; let n = 0;
        for (let y = Math.floor((cy * gh) / C); y < Math.floor(((cy + 1) * gh) / C); y++) {
          for (let x = Math.floor((cx * gw) / C); x < Math.floor(((cx + 1) * gw) / C); x++) { sum += grid[y * gw + x]; n++; }
        }
        coarse.push({ x: (cx + 0.5) / C, y: (cy + 0.5) / C, v: n ? sum / n : 0 });
      }
    }
    coarse.sort((a, b) => b.v - a.v);
    const blots = [];
    for (const c of coarse) {
      if (blots.length >= 3) break;
      if (blots.every(b => Math.hypot(b.x - c.x, b.y - c.y) > 0.3)) blots.push({ x: c.x, y: c.y });
    }
    return { blots, grid, gw, gh };
  }

  // The paper tile's pixels, and its lightness as a deviation from its mean in [-1, 1]
  // (fibres are bright, specks dark), read once per tile in slices: the paintings are laid on
  // these pixels, and the fibres modulate their ink.
  let sheet = null;
  function* sheetSteps() {
    if (sheet && sheet.paper === paper) return sheet;
    const n = Math.round(TILE * paper.k);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(paper.source, 0, 0, n, n);
    yield;
    const rgb = new Uint8ClampedArray(n * n * 3); const dev = new Float32Array(n * n);
    let sum = 0; let sq = 0;
    for (let y = 0; y < n; y += 32) {
      const d = g.getImageData(0, y, n, Math.min(32, n - y)).data;
      for (let i = 0, o = y * n; i < d.length; i += 4, o++) {
        rgb[o * 3] = d[i]; rgb[o * 3 + 1] = d[i + 1]; rgb[o * 3 + 2] = d[i + 2];
        const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
        dev[o] = l; sum += l; sq += l * l;
      }
      yield;
    }
    const mean = sum / (n * n); const spread = Math.sqrt(Math.max(1e-8, sq / (n * n) - mean * mean)) * 2.5;
    const flat = [0, 0, 0];
    for (let i = 0; i < n * n; i++) {
      flat[0] += rgb[i * 3]; flat[1] += rgb[i * 3 + 1]; flat[2] += rgb[i * 3 + 2];
      if ((i & 0x3ffff) === 0x3ffff) yield;
    }
    for (let i = 0; i < n * n; i++) {
      const v = (dev[i] - mean) / spread;
      dev[i] = v < -1 ? -1 : v > 1 ? 1 : v;
      if ((i & 0x1ffff) === 0x1ffff) yield;
    }
    sheet = { paper, n, k: n / TILE, rgb, dev, flat: flat.map(c => c / (n * n)) };
    return sheet;
  }
  // The tile pixel under document position (x, y) css px.
  const tileAt = (sh, x, y) => Math.min(sh.n - 1, Math.floor((((y % TILE) + TILE) % TILE) * sh.k)) * sh.n +
    Math.min(sh.n - 1, Math.floor((((x % TILE) + TILE) % TILE) * sh.k));

  // The painting itself: ink of density dens (w x h, scaled bilinearly to the canvas) laid on
  // the sheet's own pixels under the image's content box at document position at, written in
  // strips of about 64 k pixels, into a new canvas or again into `into`. dens is a Float32Array
  // in [0, 1], or a Uint8Array of 255ths (as kept for a repaint). Pale ink reads a little
  // cooler than dense ink. The canvas stays in memory (willReadFrequently), so writing a strip
  // is a copy.
  function* paintSteps(source, dens, w, h, at, into = null) {
    const { width: W, height: H } = source;
    const sh = yield* sheetSteps();
    const r = W / source.cssWidth;
    const unit = dens instanceof Uint8Array ? 1 / 255 : 1;
    const { flat } = sh;
    const out = into || document.createElement('canvas');
    if (!into) { out.width = W; out.height = H; }
    const g = out.getContext('2d', { willReadFrequently: true });
    const rows = Math.max(1, Math.floor(65536 / W));
    const strip = new ImageData(W, rows); const o = strip.data;
    // Per column: the source column pair and weight, and the tile column.
    const fx = W === w ? null : new Float32Array(W); const x0s = new Int32Array(W);
    for (let x = 0; x < W; x++) {
      const sx = W === w ? x : Math.max(0, Math.min(w - 1, (x + 0.5) * (w / W) - 0.5));
      x0s[x] = Math.min(w - 2 < 0 ? 0 : w - 2, Math.floor(sx));
      if (fx) fx[x] = sx - x0s[x];
    }
    for (let y0 = 0; y0 < H; y0 += rows) {
      const count = Math.min(rows, H - y0);
      for (let dy = 0; dy < count; dy++) {
        const y = y0 + dy;
        const sy = H === h ? y : Math.max(0, Math.min(h - 1, (y + 0.5) * (h / H) - 0.5));
        const ya = Math.min(h - 2 < 0 ? 0 : h - 2, Math.floor(sy)); const fy = sy - ya; const yb = Math.min(h - 1, ya + 1);
        const docY = at.y + (y + 0.5) / r;
        for (let x = 0; x < W; x++) {
          let v;
          if (fx) {
            const xa = x0s[x]; const xb = Math.min(w - 1, xa + 1); const t = fx[x];
            const top = dens[ya * w + xa] + (dens[ya * w + xb] - dens[ya * w + xa]) * t;
            const bottom = dens[yb * w + xa] + (dens[yb * w + xb] - dens[yb * w + xa]) * t;
            v = (top + (bottom - top) * fy) * unit;
          } else v = dens[y * w + x] * unit;
          const p = tileAt(sh, at.x + (x + 0.5) / r, docY) * 3;
          const pale = 1 - Math.min(1, v * 1.25);
          const keep = v >= SHEET_UNDER_INK ? 0 : 1 - smooth(0, SHEET_UNDER_INK, v);
          const pr = flat[0] + (sh.rgb[p] - flat[0]) * keep; const pg = flat[1] + (sh.rgb[p + 1] - flat[1]) * keep; const pb = flat[2] + (sh.rgb[p + 2] - flat[2]) * keep;
          const j = (dy * W + x) * 4;
          o[j] = pr + (INK_RGB[0] + (INK_PALE_RGB[0] - INK_RGB[0]) * pale - pr) * v;
          o[j + 1] = pg + (INK_RGB[1] + (INK_PALE_RGB[1] - INK_RGB[1]) * pale - pg) * v;
          o[j + 2] = pb + (INK_RGB[2] + (INK_PALE_RGB[2] - INK_RGB[2]) * pale - pb) * v;
          o[j + 3] = 255;
        }
      }
      g.putImageData(strip, 0, y0, 0, 0, W, count);
      yield;
    }
    return out;
  }

  // The darkness of the image (1 - luminance) at w x h, averaged over the source pixels each
  // work pixel covers (the source is the canvas the helper drew, kept in memory).
  function* darknessSteps(source, w, h) {
    const { width: W, height: H } = source;
    const sum = new Float32Array(w * h); const count = new Float32Array(w * h);
    const rows = Math.max(1, Math.floor(65536 / W));
    for (let y0 = 0; y0 < H; y0 += rows) {
      const n = Math.min(rows, H - y0);
      const d = source.ctx2d.getImageData(0, y0, W, n).data;
      for (let dy = 0; dy < n; dy++) {
        const row = Math.min(h - 1, Math.floor(((y0 + dy) * h) / H)) * w;
        for (let x = 0; x < W; x++) {
          const i = (dy * W + x) * 4; const at = row + Math.min(w - 1, Math.floor((x * w) / W));
          sum[at] += (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255; count[at]++;
        }
      }
      yield;
    }
    for (let i = 0; i < w * h; i++) sum[i] = 1 - (count[i] ? sum[i] / count[i] : 1);
    return sum;
  }

  // The wash's tone curve: darkness (0..1) to ink density. The light middle tones fall to
  // bare paper (留白), then the five inks: a staircase with soft, wet risers, kept partly graded.
  function washInk(dark) {
    let v = clamp01(dark);
    v = Math.pow(v, TONE_GAMMA) * smooth(PAPER_CUT[0], PAPER_CUT[1], v);
    const x = v * 5; const f = Math.min(4, Math.floor(x)); const q = f + smooth(0.5 - SOFT_STEP, 0.5 + SOFT_STEP, x - f);
    const lower = Math.floor(q); const t = q - lower;
    const stepped = DENSITY[lower] + (DENSITY[Math.min(5, lower + 1)] - DENSITY[lower]) * t;
    const graded = DENSITY[f] + (DENSITY[f + 1] - DENSITY[f]) * (x - f);
    return graded + QUANTISE * (stepped - graded);
  }
  // Ink of density v on flat paper, channel c (0..255): pale ink reads a little cooler, as in
  // paintSteps.
  const inkOnPaper = (v, c) => {
    const pale = 1 - Math.min(1, v * 1.25);
    return PAPER_RGB[c] + (INK_RGB[c] + (INK_PALE_RGB[c] - INK_RGB[c]) * pale - PAPER_RGB[c]) * v;
  };

  // A photo as an ink wash.
  function* washSteps(source, at) {
    const { width: W, height: H, cssWidth, cssHeight } = source;
    // As fine as the box is shown (a lightbox photo is as crisp as its print), within budget.
    const budget = Math.min(WORK_MAX, cssWidth * cssHeight * WORK_DENSITY);
    const s = Math.min(1, Math.sqrt(budget / (W * H)));
    const w = Math.max(1, Math.round(W * s)); const h = Math.max(1, Math.round(H * s));
    const perCss = w / cssWidth;
    const dark = yield* darknessSteps(source, w, h);
    // Levels, from the 2nd to the 98th percentile of the darkness.
    const N = w * h; const bins = new Uint32Array(256);
    for (let i = 0; i < N; i++) {
      bins[Math.min(255, (dark[i] * 256) | 0)]++;
      if ((i & 0x3ffff) === 0x3ffff) yield;
    }
    const level = share => { let sum = 0; for (let b = 0; b < 256; b++) { sum += bins[b]; if (sum >= share * N) return b / 256; } return 1; };
    const lo = level(0.02); const hi = Math.max(lo + 0.08, level(0.98));
    for (let i = 0; i < N; i++) {
      dark[i] = clamp01((dark[i] - lo) / (hi - lo));
      if ((i & 0x3ffff) === 0x3ffff) yield;
    }
    yield;
    // Calm washes with crisp shapes, as a brush lays them: an edge-preserving filter before the
    // local contrast (so grain and noise are not sharpened) and after it (so the contrast
    // settles into washes).
    const brush = Math.min(BRUSH_RADIUS, Math.max(1, BRUSH_SHARE * Math.min(cssWidth, cssHeight)));
    const radius = Math.max(1, Math.round(brush * perCss));
    const calm = yield* guided(dark, w, h, radius, BRUSH_EPS);
    // Local contrast: the darkness kept, plus its difference from the neighbourhood, an
    // edge-aware one (a wide guided filter): the base follows a strong edge, so the contrast
    // gives no halo along it, and inside a large dark mass there is no contrast to take away.
    const wide = yield* guided(calm, w, h, Math.max(2, Math.round(LOCAL_RADIUS * perCss)), LOCAL_EPS);
    for (let i = 0; i < N; i++) {
      calm[i] = clamp01(LOCAL_BASE * calm[i] + LOCAL_DETAIL * (calm[i] - wide[i]));
      if ((i & 0xffff) === 0xffff) yield;
    }
    yield;
    const flat = yield* guided(calm, w, h, radius, BRUSH_EPS);
    const ink = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      ink[i] = washInk(flat[i]);
      if ((i & 0x3fff) === 0x3fff) yield;
    }
    yield;
    // Wet: the risers soften, and ink pools where a wash meets lighter paper.
    const wet = yield* soften(ink, w, h, Math.max(1, Math.round(WET_RADIUS * perCss)));
    const pool = yield* soften(wet, w, h, Math.max(1, Math.round(POOL_RADIUS * perCss / 2)));
    // The sheet's own light fibres resist the ink, and the pigment granulates a little.
    const sh = yield* sheetSteps();
    const seed = (W * 73856093) ^ (H * 19349663);
    for (let y = 0; y < h; y++) {
      const docY = at.y + (y + 0.5) / perCss;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let v = wet[i] + POOL * Math.max(0, wet[i] - pool[i]);
        const pale = 1 - Math.min(1, wet[i]);
        v *= 1 - FIBRE_INK * pale * pale * Math.max(0, sh.dev[tileAt(sh, at.x + (x + 0.5) / perCss, docY)]) + GRANULATION * (hash(x, y, seed) * 2 - 1);
        dark[i] = clamp01(v);
      }
      if ((y & 31) === 31) yield;
    }
    const painted = yield* paintSteps(source, dark, w, h, at);
    yield;
    blotsOf.set(painted, shape(dark, w, h, cssWidth, cssHeight));
    yield* keepSteps(painted, source, dark, w, h, at);
    return painted;
  }

  // Colour into ink for graphics: luminance (channels 0..255, result in [0, 1]), and the hue
  // that moves a tint (cool positive, warm negative).
  const luma = (r, g, b) => (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
  const hueOf = (r, g, b) => ((g + b) / 2 - r) / 255;
  // The pale-fill curve of graphics: steep over the palest darkness, then even up to 1.
  const PALE_TOP = GRAPHIC_PALE[0] * GRAPHIC_PALE[1];
  const paleCurve = d => (d < GRAPHIC_PALE[1] ? d * GRAPHIC_PALE[0] : PALE_TOP + ((d - GRAPHIC_PALE[1]) * (1 - PALE_TOP)) / (1 - GRAPHIC_PALE[1]));
  // The ink of one graphic pixel on a light ground of luminance groundLuma and hue groundHue.
  // Monotonic in luminance but for the hue's small step; nothing lighter than the ground inks.
  function graphicInk(r, g, b, groundLuma, groundHue) {
    const dark = (groundLuma - luma(r, g, b)) / groundLuma;          // darker than the ground, 0..1
    if (dark <= GRAPHIC_FLOOR[0]) return 0;
    const ink = paleCurve(Math.min(1, dark));
    const tint = Math.max(-GRAPHIC_HUE[1], Math.min(GRAPHIC_HUE[1], GRAPHIC_HUE[0] * (hueOf(r, g, b) - groundHue)));
    return clamp01(ink + tint * Math.min(1, ink / GRAPHIC_HUE_FULL)) * smooth(GRAPHIC_FLOOR[0], GRAPHIC_FLOOR[1], dark);
  }

  // A graphic as an ink drawing: ink where it is darker than its own background colour (or,
  // on a dark ground, where it differs from it).
  function* drawingSteps(source, at) {
    const { width: W, height: H, cssWidth, cssHeight } = source;
    // The background: the commonest colour (4 bits a channel) on a sparse grid.
    const bins = new Map(); const step = Math.max(1, Math.round(Math.sqrt((W * H) / 40000)));
    for (let y = 0; y < H; y += step) {
      const px = source.ctx2d.getImageData(0, y, W, 1).data;
      for (let x = 0; x < W; x += step) {
        const i = x * 4;
        const key = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4);
        const bin = bins.get(key);
        if (bin) { bin.n++; bin.r += px[i]; bin.g += px[i + 1]; bin.b += px[i + 2]; } else bins.set(key, { n: 1, r: px[i], g: px[i + 1], b: px[i + 2] });
      }
      if ((y & 63) === 0) yield;
    }
    let bg = { n: 0, r: 255, g: 255, b: 255 };
    for (const bin of bins.values()) if (bin.n > bg.n) bg = bin;
    const br = bg.n ? bg.r / bg.n : 255; const bgG = bg.n ? bg.g / bg.n : 255; const bb = bg.n ? bg.b / bg.n : 255;
    const bl = luma(br, bgG, bb);
    // The ground, as the light-ground rule sees it: anything at least as light is paper, so a
    // white strip in a figure on a grey panel is paper too.
    const groundLuma = Math.max(0.05, bl); const groundHue = hueOf(br, bgG, bb);
    const darkGround = bl < GRAPHIC_DARK_GROUND;
    yield;
    const dens = new Float32Array(W * H);
    const rows = Math.max(1, Math.floor(65536 / W));
    for (let y0 = 0; y0 < H; y0 += rows) {
      const n = Math.min(rows, H - y0);
      const px = source.ctx2d.getImageData(0, y0, W, n).data;
      for (let i = 0, o = y0 * W; i < px.length; i += 4, o++) {
        const r = px[i]; const g = px[i + 1]; const b = px[i + 2];
        if (!darkGround) { dens[o] = graphicInk(r, g, b, groundLuma, groundHue); continue; }
        const dl = Math.abs(luma(r, g, b) - bl);
        const dc = Math.sqrt((r - br) * (r - br) + (g - bgG) * (g - bgG) + (b - bb) * (b - bb)) / 441.7;
        const v = Math.max(dl * 1.1, dc * 0.9);
        dens[o] = clamp01(v * GRAPHIC_GAIN) * smooth(GRAPHIC_DARK_FLOOR[0], GRAPHIC_DARK_FLOOR[1], v);
      }
      yield;
    }
    const painted = yield* paintSteps(source, dens, W, H, at);
    yield;
    blotsOf.set(painted, shape(dens, W, H, cssWidth, cssHeight));
    yield* keepSteps(painted, source, dens, W, H, at);
    return painted;
  }

  // What each painting was made from (canvas -> { dens, w, h, at, size }), kept as 255ths, so
  // it can be laid on the sheet again where its image has moved without changing size (the
  // helper then reuses the canvas): the paper in a painting and the page's paper stay one
  // sheet. Entries go with their canvases.
  const madeOf = new WeakMap();
  function* keepSteps(painted, source, dens, w, h, at) {
    const kept = new Uint8Array(w * h);
    for (let i = 0; i < kept.length; i++) {
      kept[i] = Math.round(dens[i] * 255);
      if ((i & 0x3ffff) === 0x3ffff) yield;
    }
    madeOf.set(painted, { dens: kept, w, h, at, size: { width: source.width, height: source.height, cssWidth: source.cssWidth, cssHeight: source.cssHeight } });
  }
  // The shown painting whose image now lies elsewhere on the paper (by half a css px or more)
  // at the same size (a new size brings a new painting from the helper), or null.
  function strayPainting(st) {
    for (const overlay of st.media.overlays) {
      const made = madeOf.get(overlay.canvas);
      if (!made || !overlay.img.isConnected) continue;
      const at = origin(overlay.img);
      if (Math.abs(at.x - made.at.x) < 0.5 && Math.abs(at.y - made.at.y) < 0.5) continue;
      if (Math.abs(at.width - made.size.cssWidth) > 1 || Math.abs(at.height - made.size.cssHeight) > 1) continue;
      return { overlay, made, at };
    }
    return null;
  }
  // After a layout change, when a scroller holding paintings comes to rest, and when the helper
  // shows a painting (again, from its cache, maybe where its image has moved meanwhile): the
  // paintings that no longer lie on their own paper are laid on the sheet again in place, one
  // after another, in slices, until none is left (an image that moves again while it is
  // repainted is found on the next pass; a call during a pass asks for one more).
  function realign(st) {
    if (!st.media || st.ctx.signal.aborted || state !== st) return;
    if (st.realigning) { st.realignAgain = true; return; }
    st.realigning = true; st.realignAgain = false;
    (async () => {
      for (let job = strayPainting(st); job; job = strayPainting(st)) {
        const done = await runSliced(paintSteps(job.made.size, job.made.dens, job.made.w, job.made.h, job.at, job.overlay.canvas), st.ctx.signal);
        if (!done || st.ctx.signal.aborted || state !== st) return;
        job.made.at = job.at;
      }
    })().catch(() => {}).finally(() => {
      st.realigning = false;
      if (st.realignAgain) { st.realignAgain = false; realign(st); }
    });
  }
  // The same, a little later: a painting the helper has just shown is placed within its task.
  function realignSoon(st) {
    if (st.realignTimer) return;
    st.realignTimer = setTimeout(() => { st.realignTimer = 0; realign(st); }, REALIGN_DELAY_MS);
  }

  // render() for ctx.media: one painting per image, in slices; null leaves the image to its
  // CSS print (an unreadable image, or the lens has begun to leave).
  function painter(ctx) {
    return async source => {
      if (!source.readable || ctx.signal.aborted || !await makePaper(ctx.signal) || ctx.signal.aborted) return null;
      const at = origin(source.img);
      const steps = source.kind === 'photo' ? washSteps(source, at) : drawingSteps(source, at);
      return runSliced(steps, ctx.signal);
    };
  }

  /* ---------------------------------------------------------------------------
   * The seal: 朱文, a logarithmic spiral in a square, cinnabar paste on paper.
   * ------------------------------------------------------------------------- */
  function drawSeal(size, k) {
    const key = `${size}@${k}`;
    if (seals.has(key)) return seals.get(key);
    const n = Math.round(size * k);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const g = canvas.getContext('2d');
    const rand = random(1692);
    const colour = `rgb(${SEAL_RGB.join(',')})`;
    g.translate(n / 2, n / 2); g.rotate(SEAL_TILT); g.translate(-n / 2, -n / 2);
    g.strokeStyle = colour; g.lineCap = 'round'; g.lineJoin = 'round';
    // The border: four slightly wavering edges, a little heavier than the spiral.
    const inset = n * 0.08; const side = n - 2 * inset; const wobble = n * 0.011;
    g.lineWidth = n * 0.1;
    g.beginPath();
    const corners = [[inset, inset], [inset + side, inset], [inset + side, inset + side], [inset, inset + side]];
    for (let c = 0; c < 4; c++) {
      const [x0, y0] = corners[c]; const [x1, y1] = corners[(c + 1) % 4];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8; const nx = -(y1 - y0) / side; const ny = (x1 - x0) / side;
        const j = s === 0 || s === 8 ? 0 : (rand() - 0.5) * 2 * wobble;
        const x = x0 + (x1 - x0) * t + nx * j; const y = y0 + (y1 - y0) * t + ny * j;
        if (c === 0 && s === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    }
    g.closePath(); g.stroke();
    // The spiral r = a e^(b θ), about two and a half turns, its outer end running into the
    // border (carvers join a figure to the frame).
    const b = 0.13; const rMin = n * 0.075; const rMax = n * 0.35;
    const span = Math.log(rMax / rMin) / b;
    g.lineWidth = n * 0.085;
    g.beginPath();
    let last = null;
    for (let s = 0; s <= 200; s++) {
      const theta = (s / 200) * span; const r = rMin * Math.exp(b * theta); const a = theta + 2.2;
      const x = n / 2 + r * Math.cos(a); const y = n / 2 + r * Math.sin(a);
      if (s === 0) g.moveTo(x, y); else g.lineTo(x, y);
      last = [x, y, a];
    }
    const [lx, ly, la] = last;
    const tx = Math.cos(la + Math.PI / 2 - Math.atan(b)); const ty = Math.sin(la + Math.PI / 2 - Math.atan(b));
    const reach = [inset - lx, inset + side - lx].map(d => d / (tx || 1e-6)).concat([inset - ly, inset + side - ly].map(d => d / (ty || 1e-6)))
      .filter(d => d > 0).reduce((m, d) => Math.min(m, d), Infinity);
    if (Number.isFinite(reach)) g.lineTo(lx + tx * reach, ly + ty * reach);
    g.stroke();
    // Two chips bitten out of the border's outer edge, where the stone has broken.
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0, 0, 0, 0.9)';
    for (let c = 0; c < 2; c++) {
      const edge = c === 0 ? 1 : 3; const t = 0.3 + rand() * 0.4;
      const [x0, y0] = corners[edge]; const [x1, y1] = corners[(edge + 1) % 4];
      const nx = (y1 - y0) / side; const ny = -(x1 - x0) / side;      // outward normal
      const out = n * 0.05;
      g.beginPath();
      g.ellipse(x0 + (x1 - x0) * t + nx * out, y0 + (y1 - y0) * t + ny * out, n * 0.045, n * 0.035, Math.atan2(y1 - y0, x1 - x0), 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // Uneven paste: the colour thins in places, and the paper shows through a few gaps.
    const image = g.getImageData(0, 0, n, n); const d = image.data; const seed = 77;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        if (!d[i + 3]) continue;
        const press = noise(x / (n * 0.16), y / (n * 0.16), seed);
        const fine = hash(x, y, seed + 1);
        let a = d[i + 3] / 255 * (0.74 + 0.3 * press + 0.08 * (fine - 0.5));
        if (noise(x / (n * 0.07), y / (n * 0.07), seed + 2) > 0.8) a *= 0.3;
        d[i + 3] = Math.round(255 * clamp01(a) * 0.95);
      }
    }
    g.putImageData(image, 0, 0);
    canvas.className = 'lens-ink-seal';
    canvas.setAttribute('aria-hidden', 'true');
    seals.set(key, canvas);
    return canvas;
  }

  // True when no text other than the trigger's lies within SEAL_MIN_GAP of box (viewport px):
  // the text after the trigger in document order, until it lies well below the box.
  function clearOfText(box, trigger) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    walker.currentNode = trigger;
    const range = document.createRange(); const pad = SEAL_MIN_GAP;
    for (let node = walker.nextNode(), seen = 0; node && seen < 60; node = walker.nextNode()) {
      if (trigger.contains(node) || !node.data.trim() || node.parentElement.closest('.lenses-layer, script, style')) continue;
      seen++;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (!r.width || !r.height) continue;
        if (r.top > box.bottom + 80) return true;
        if (r.left < box.right + pad && r.right > box.left - pad && r.top < box.bottom + pad && r.bottom > box.top - pad) return false;
      }
    }
    return true;
  }

  // The seal's place (viewport px), or null for none: after the trigger's last line, centred
  // on it; when the line ends too near the viewport's edge, closer to it (never nearer than
  // SEAL_MIN_GAP), then smaller (down to SEAL_SIZE[0]); when even that does not fit, under the
  // line's end if nothing is written there. It never covers a letter.
  function sealBox(trigger) {
    const range = document.createRange();
    range.selectNodeContents(trigger);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    if (!rects.length) return null;
    const fontSize = parseFloat(getComputedStyle(trigger).fontSize) || 24;
    const lastTop = Math.max(...rects.map(r => r.top));
    const line = rects.filter(r => r.top > lastTop - 2);
    const right = Math.max(...line.map(r => r.right));
    const top = Math.min(...line.map(r => r.top)); const bottom = Math.max(...line.map(r => r.bottom));
    let size = Math.round(Math.max(SEAL_SIZE[0], Math.min(SEAL_SIZE[1], fontSize * SEAL_SCALE)));
    const gap = Math.max(SEAL_MIN_GAP, fontSize * SEAL_GAP);
    const free = (document.documentElement.clientWidth || innerWidth) - SEAL_EDGE - right;
    const onLine = (left, s) => ({ left, top: (top + bottom) / 2 - s / 2 + fontSize * 0.03, size: s });
    if (free >= size + gap) return onLine(right + gap, size);
    if (free >= size + SEAL_MIN_GAP) return onLine(right + free - size, size);
    if (free >= SEAL_SIZE[0] + SEAL_MIN_GAP) { size = Math.floor(free - SEAL_MIN_GAP); return onLine(right + free - size, size); }
    const under = { left: Math.max(SEAL_EDGE, Math.min(right, right + free) - size), top: bottom + Math.max(SEAL_MIN_GAP, fontSize * 0.12), size };
    return clearOfText({ left: under.left, top: under.top, right: under.left + size, bottom: under.top + size }, trigger) ? under : null;
  }

  // Places the seal (drawn for its size); returns its box, or null when there is none.
  function placeSeal(st) {
    const trigger = document.querySelector(TRIGGER);
    const box = trigger ? sealBox(trigger) : null;
    if (!box) { if (st.seal) st.seal.style.display = 'none'; return null; }
    const { left, top, size } = box;
    const canvas = drawSeal(size, ratio());
    if (st.seal !== canvas) {
      if (st.seal) { canvas.className = st.seal.className; st.seal.remove(); }
      st.seal = canvas; st.page.append(canvas);
    }
    Object.assign(canvas.style, { display: 'block', left: `${left + scrollX}px`, top: `${top + scrollY}px`, width: `${size}px`, height: `${size}px` });
    return { left, top, right: left + size, bottom: top + size };
  }

  // The caption's letters (viewport px), and whether a box lies within pad of one of them.
  const letterRects = el => {
    const out = []; const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNodeContents(node);           // a text node: its line boxes, not its block's
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push(r);
    }
    return out;
  };
  const near = (r, box, pad) => r.left < box.right + pad && r.right > box.left - pad && r.top < box.bottom + pad && r.bottom > box.top - pad;

  // A caption beside the trigger begins where the seal goes after it. When its letters can
  // move along their own line by the seal's room and still fit in the caption's box (unwrapped),
  // they do (padding, from a rule in this lens's sheet, before the caption is first painted), so
  // the seal is pressed as the bloom's last beat between the name and the caption. Otherwise
  // the seal waits for the caption to begin fading.
  function makeRoom(st) {
    const caption = document.querySelector('.lenses-caption.is-beside');
    const trigger = document.querySelector(TRIGGER);
    const sheet = ownSheet();
    if (!caption || !trigger || !sheet || st.captionRule) return;
    const place = sealBox(trigger);
    if (!place) return;
    const seal = { left: place.left, top: place.top, right: place.left + place.size, bottom: place.top + place.size };
    const letters = letterRects(caption);
    if (!letters.length || !letters.some(r => near(r, seal, SEAL_CAPTION_PAD))) return;
    const room = Math.ceil(seal.right + SEAL_CAPTION_GAP - Math.min(...letters.map(r => r.left)));
    const box = caption.getBoundingClientRect();
    if (room <= 0 || Math.max(...letters.map(r => r.right)) + room > box.right - 1) return;
    try {
      st.captionRule = sheet.cssRules[sheet.insertRule(`html.lens-ink-caption .lenses-caption.is-beside { padding-left: ${room}px; }`, sheet.cssRules.length)];
    } catch (error) { st.captionRule = null; }
  }

  // Presses the seal: at once, or once the caption's letters no longer cover its place (they
  // make room, or the caption begins to fade). Without a place yet (the title comes with late
  // markdown, or there is no room), it is pending, and the next content or layout change tries
  // again.
  function stamp(st) {
    if (st.stamped || st.sealWatch || st.ctx.signal.aborted) return;
    const box = placeSeal(st);
    st.sealPending = !box || !st.seal;
    if (st.sealPending) return;
    // A seal canvas is kept between activations: it starts unpressed each time.
    st.seal.classList.remove('is-stamped');
    st.seal.classList.toggle('is-still', !!st.ctx.arriving || st.ctx.motion.matches);
    void st.seal.offsetWidth;
    const covered = () => {
      const caption = document.querySelector('.lenses-caption');
      if (!caption || !caption.classList.contains('is-shown')) return false;     // gone, or fading
      const now = st.seal.getBoundingClientRect();
      return letterRects(caption).some(r => near(r, now, SEAL_CAPTION_PAD));
    };
    const press = () => {
      st.stamped = true;
      if (st.sealWatch) { st.sealWatch.disconnect(); st.sealWatch = null; }
      clearTimeout(st.sealTimer);
      placeSeal(st);
      if (st.seal) st.seal.classList.add('is-stamped');
    };
    if (!covered()) { press(); return; }
    st.sealWatch = new MutationObserver(() => { if (!covered()) press(); });
    st.sealWatch.observe(document.body, { childList: true });
    const caption = document.querySelector('.lenses-caption');
    if (caption) st.sealWatch.observe(caption, { attributes: true, attributeFilter: ['class', 'style'] });
    st.sealTimer = setTimeout(press, SEAL_WAIT_MS);
  }

  /* ---------------------------------------------------------------------------
   * The veil: the same paper over the viewport, opened by the bloom, closed by the wash.
   * ------------------------------------------------------------------------- */
  function sizeVeil(st) {
    const v = st.veil;
    const w = document.documentElement.clientWidth || innerWidth; const h = innerHeight;
    const r = ratio();
    v.r = r; v.w = w; v.h = h;
    v.canvas.width = Math.max(1, Math.round(w * r)); v.canvas.height = Math.max(1, Math.round(h * r));
    v.cols = Math.ceil(w / CELL) + 1; v.rows = Math.ceil(h / CELL) + 1;
    const n = v.cols * v.rows;
    v.mask.width = v.cols; v.mask.height = v.rows;
    v.maskData = new ImageData(v.cols, v.rows);
    for (let i = 0; i < n; i++) v.maskData.data[i * 4] = v.maskData.data[i * 4 + 1] = v.maskData.data[i * 4 + 2] = 255;
    v.alpha = new Float32Array(n).fill(1);     // what the veil shows now, per cell
    // The wash's front: top to bottom, ragged by noise (fixed per viewport).
    v.washAt = new Float32Array(n);
    for (let j = 0; j < v.rows; j++) {
      for (let c = 0; c < v.cols; c++) {
        const ragged = noise(c * 0.16, j * 0.16, 911) * 0.65 + noise(c * 0.45, j * 0.45, 912) * 0.35 - 0.5;
        v.washAt[j * v.cols + c] = WASH_SWEEP * (j / v.rows) + WASH_NOISE * ragged + 0.05;
      }
    }
  }

  // Paper where v.alpha says (per cell): the low-resolution mask, smoothed as it is scaled
  // up, cuts the paper pattern.
  function paintVeil(st) {
    const v = st.veil; const g = v.g; const n = v.cols * v.rows;
    const m = v.maskData.data;
    for (let i = 0; i < n; i++) m[i * 4 + 3] = v.alpha[i] * 255;
    v.mask.getContext('2d').putImageData(v.maskData, 0, 0);
    g.save();
    g.globalCompositeOperation = 'copy';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium';
    g.drawImage(v.mask, 0, 0, v.cols * CELL * v.r, v.rows * CELL * v.r);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = paperPattern(g, scrollX, scrollY, v.r) || PAPER_HEX;
    g.fillRect(0, 0, v.canvas.width, v.canvas.height);
    g.restore();
  }
  const paperVeil = st => { st.veil.alpha.fill(1); paintVeil(st); };

  // The text blocks in and near the viewport: the nearest non-inline box of every visible
  // text, found by walking the scope and skipping subtrees that lie far from the viewport.
  function* blockSteps(st) {
    const vh = innerHeight; const vw = document.documentElement.clientWidth || innerWidth;
    const far = vh * 0.5;
    const found = new Map();
    const blockOf = el => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        if (getComputedStyle(e).display !== 'inline') return e;
      }
      return el;
    };
    const stack = st.ctx.scope.filter(el => el.isConnected).slice().reverse();
    let visited = 0;
    while (stack.length && found.size < BLOCK_LIMIT) {
      const el = stack.pop();
      const r = el.getBoundingClientRect();
      if (r.bottom < -far || r.top > vh + far || r.right < 0 || r.left > vw) continue;
      if (!r.width && !r.height && !el.getClientRects().length && getComputedStyle(el).display !== 'contents') continue;   // display: none
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && node.data.trim()) {
          const block = blockOf(el);
          if (!found.has(block)) found.set(block, block.getBoundingClientRect());
          break;
        }
      }
      for (let c = el.children.length - 1; c >= 0; c--) stack.push(el.children[c]);
      if ((++visited & 31) === 0) yield;
    }
    return [...found.values()].filter(r => r.width > 0 && r.height > 0);
  }

  // The bloom's field: for each cell of the viewport (and half a screen around it), the time
  // its ink arrives. Built in viewport coordinates at the scroll offset of the start.
  function* fieldSteps(st, textRects) {
    const v = st.veil; const vh = v.h;
    const extra = Math.ceil((vh * 0.5) / CELL);
    const cols = v.cols; const rows = v.rows + 2 * extra;
    const field = new Float32Array(cols * rows).fill(Infinity);
    const seed = 4117;
    const rand = random(seed);
    const startOf = r => SWEEP * clamp01((r.top + Math.min(r.height, vh) * 0.25) / vh) + rand() * JITTER;
    const ragged = new Float32Array(cols * rows).fill(NaN);   // the wet edge's noise, per cell, made once
    const noiseAt = (i, j) => {
      const k = j * cols + i;
      if (Number.isNaN(ragged[k])) ragged[k] = noise(i * 0.3, j * 0.3, seed) * 0.6 + noise(i * 0.9, j * 0.9, seed + 1) * 0.4 - 0.5;
      return ragged[k];
    };
    // A block covers the cells over its rect and one more on every side (so a glyph's edge is
    // never left under paper). A cell whose centre lies in some block's rect belongs to the
    // blocks that hold it; the margin of another block never gives it an earlier time, which
    // would cut a caption across its glyphs. Margin cells take the earliest margin time.
    const margin = new Float32Array(cols * rows).fill(Infinity);
    const cover = (r, fn) => {
      const i0 = Math.max(0, Math.floor(r.left / CELL) - 1); const i1 = Math.min(cols - 1, Math.ceil(r.right / CELL));
      const j0 = Math.max(0, Math.floor(r.top / CELL) + extra - 1); const j1 = Math.min(rows - 1, Math.ceil(r.bottom / CELL) + extra);
      for (let j = j0; j <= j1; j++) {
        const y = (j - extra + 0.5) * CELL; const inY = y >= r.top && y <= r.bottom;
        for (let i = i0; i <= i1; i++) {
          const x = (i + 0.5) * CELL; const k = j * cols + i;
          const t = fn(x, y) + FIELD_NOISE * noiseAt(i, j);
          const into = inY && x >= r.left && x <= r.right ? field : margin;
          if (t < into[k]) into[k] = t;
        }
      }
    };
    // Text blocks: blots along the block, the ink spreading as the square root of time.
    for (const r of textRects) {
      const count = Math.max(1, Math.min(4, Math.round(r.width / BLOT_EVERY)));
      const blots = Array.from({ length: count }, (_, k) => ({
        x: r.left + r.width * ((k + 0.2 + rand() * 0.6) / count), y: r.top + r.height * (0.2 + rand() * 0.6)
      }));
      const start = startOf(r);
      let reach = 1;
      for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom], [(r.left + r.right) / 2, r.top], [(r.left + r.right) / 2, r.bottom]]) {
        reach = Math.max(reach, Math.min(...blots.map(b => Math.hypot(x - b.x, y - b.y))));
      }
      cover(r, (x, y) => {
        let d = Infinity;
        for (const b of blots) { const dd = (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y); if (dd < d) d = dd; }
        return start + SPREAD * (d / (reach * reach));
      });
      yield;
    }
    // Images: a painting's darkest tones first, spreading from its darkest places; an image
    // not painted yet (it soaks in later) from its middle.
    const painted = new Map();
    if (st.media) st.media.overlays.forEach(overlay => painted.set(overlay.img, overlay.canvas));
    const images = [];
    st.ctx.scope.forEach(root => root.querySelectorAll('img').forEach(img => images.push(img)));
    for (const img of images) {
      const canvas = painted.get(img);
      const r = (canvas || img).getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5 || r.width < 2 || r.height < 2) continue;
      const info = (canvas && blotsOf.get(canvas)) || null;
      const blots = (info ? info.blots : [{ x: 0.5, y: 0.45 }]).map(b => ({ x: r.left + b.x * r.width, y: r.top + b.y * r.height }));
      const reach = Math.hypot(r.width, r.height) * 0.75;
      const start = startOf(r);
      cover(r, (x, y) => {
        let d = Infinity;
        for (const b of blots) d = Math.min(d, Math.hypot(x - b.x, y - b.y));
        let tone = 0.5;
        if (info) {
          const gx = Math.min(info.gw - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * info.gw)));
          const gy = Math.min(info.gh - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * info.gh)));
          tone = info.grid[gy * info.gw + gx];
        }
        return start + MEDIA_SPREAD * (0.62 * (1 - tone) + 0.38 * Math.min(1, d / reach));
      });
      yield;
    }
    for (let k = 0; k < field.length; k++) if (field[k] === Infinity) field[k] = margin[k];
    return { field, cols, rows, extra, scroll: scrollY };
  }

  // One frame of the bloom at time t (s): the veil opens where the field has passed.
  function bloomFrame(st, t) {
    const v = st.veil; const f = st.field; const cols = v.cols;
    const shift = Math.round((scrollY - f.scroll) / CELL);
    const rest = 1 - smooth(REST[0], REST[1], t);
    for (let j = 0; j < v.rows; j++) {
      const row = j + f.extra + shift;
      for (let c = 0; c < cols; c++) {
        const i = j * cols + c;
        const at = row >= 0 && row < f.rows ? f.field[row * cols + c] : Infinity;
        const open = at === Infinity ? 0 : smooth(at - FEATHER, at + FEATHER, t);
        v.alpha[i] = (1 - open) * rest;
      }
    }
    paintVeil(st);
  }

  // One frame of the wash at time t (s): paper flows down over the ink, from what the veil
  // showed when it began (an exit during the bloom closes from there).
  function washFrame(st, t, from) {
    const v = st.veil; const n = v.cols * v.rows;
    for (let i = 0; i < n; i++) {
      const at = v.washAt[i];
      v.alpha[i] = Math.max(from ? from[i] : 0, smooth(at - FEATHER * 0.8, at + FEATHER * 0.8, t));
    }
    paintVeil(st);
  }

  // Plays fn(t) once per frame for `seconds`; resolves at the end, or at once on abort/stop.
  // When quit() turns true (an instant reset is wanted) it jumps to its end. Without frames (a
  // hidden tab pauses them; a reset that has finished the lens drops them) it still ends, in
  // real time, PLAY_SLACK_MS after its length, with its last frame drawn.
  function play(st, seconds, fn, signal, quit = null) {
    return new Promise(resolve => {
      const began = performance.now();
      const anim = {};
      st.anim = anim;
      let timer = 0;
      const finish = () => { clearTimeout(timer); if (st.anim === anim) st.anim = null; resolve(); };
      const tick = () => {
        if (st.anim !== anim || (signal && signal.aborted)) { finish(); return false; }
        const t = quit && quit() ? seconds : Math.min(seconds, (performance.now() - began) / 1000);
        try { fn(t); } catch (error) { finish(); throw error; }
        if (t >= seconds) { finish(); return false; }
        return undefined;
      };
      anim.stop = finish;
      timer = setTimeout(() => {
        if (st.anim === anim && !(signal && signal.aborted)) { try { fn(seconds); } catch (error) { /* the end is shown anyway */ } }
        finish();
      }, seconds * 1000 + PLAY_SLACK_MS);
      st.ctx.frame(tick);
    });
  }

  // The veil element's own opacity, eased by a CSS transition (no frame runs for it).
  function fadeVeil(st, to, ms, signal) {
    const el = st.veil.canvas;
    if (!ms) { el.style.transition = 'none'; el.style.opacity = String(to); return Promise.resolve(); }
    el.style.transition = 'none';
    void el.offsetWidth;
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = String(to);
    return sleep(ms + 20, signal);
  }

  /* ---------------------------------------------------------------------------
   * Activation
   * ------------------------------------------------------------------------- */
  // This lens's own stylesheet (attached by the core for the activation).
  const ownSheet = () => [...document.styleSheets].find(sheet => (sheet.href || '').includes(SHEET)) || null;

  function build(ctx) {
    const kind = pageKind(ctx);
    const st = {
      ctx, kind, media: null, applied: false, anim: null, field: null, stamped: false, blooming: false, settled: false,
      seal: null, sealWatch: null, sealTimer: 0, sealPending: false, rule: null, captionRule: null, offs: [],
      realigning: false, realignAgain: false, realignTimer: 0, scrollTimer: 0,
      lightbox: null, lightboxWatch: null, awaitSrc: '', awaitExpired: false, awaitTimer: 0,
      began: performance.now(), took: 0, marks: {}     // ms to each phase and to the end (read by the tests)
    };
    state = st;
    html.classList.add(CLS.caption);
    // The page layer: the seal and the filters. The veil: a fixed layer above the paintings.
    st.page = ctx.layer('page');
    st.page.classList.add('lens-ink-page');
    const defs = document.createElementNS(SVG_NS, 'svg');
    defs.setAttribute('class', 'lens-ink-defs'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.setAttribute('aria-hidden', 'true');
    const [wr, wg, wb] = WASH_WEIGHTS;
    const g = WASH_GAIN; const ink = WASH_INK.map(c => +(c / 255).toFixed(4));
    const paperOf = PAPER_RGB.map(c => c / 255);
    // #lens-ink-wash: over white, then ink whose alpha is the darkness (white is clear paper).
    // #lens-ink-print: opaque ink on paper of the same darkness (for images under paintings).
    const print = PAPER_RGB.map((p, c) => {
      const pc = paperOf[c]; const ic = ink[c];
      return [(pc - ic) * wr, (pc - ic) * wg, (pc - ic) * wb, 0, ic].map(v => +v.toFixed(4)).join(' ');
    }).join(' ');
    // #lens-ink-wash in two matrices: the first puts the cool share (COOL_GAIN / COOL_CAP x
    // ((G + B) / 2 - R), clamped to [0, 1] as every matrix result is) in red and the darkness
    // (1 - grey) in blue; the second makes ink of alpha COOL_CAP x red + gain x blue.
    const share = +(COOL_GAIN / COOL_CAP).toFixed(4);
    // #lens-ink-print-wash: a photo printed through the wash's own tone curve (its light middle
    // tones bare paper, its darks the five inks), luminance to ink by a table: what a photo
    // shows until its painting is there, so the painting soaks in as a small step.
    const lum = '0.2126 0.7152 0.0722 0 0';
    // (Its darkness first lifted by PRINT_LIFT, as the wash's levels lift a typical photo.)
    const printed = dark => washInk(clamp01((dark - PRINT_LIFT) / (1 - PRINT_LIFT)));
    const table = c => Array.from({ length: PRINT_TABLE }, (_, k) => +(inkOnPaper(printed(1 - k / (PRINT_TABLE - 1)), c) / 255).toFixed(4)).join(' ');
    defs.innerHTML =
      `<filter id="lens-ink-wash" color-interpolation-filters="sRGB">` +
        `<feFlood flood-color="#ffffff" result="white"/>` +
        `<feComposite in="SourceGraphic" in2="white" operator="over" result="flat"/>` +
        `<feColorMatrix in="flat" type="matrix" result="tones" values="${-share} ${share / 2} ${share / 2} 0 0 0 0 0 0 0 ${-wr} ${-wg} ${-wb} 0 1 0 0 0 0 1"/>` +
        `<feColorMatrix in="tones" type="matrix" values="0 0 0 0 ${ink[0]} 0 0 0 0 ${ink[1]} 0 0 0 0 ${ink[2]} ${COOL_CAP} 0 ${g} 0 0"/>` +
      `</filter>` +
      `<filter id="lens-ink-print" color-interpolation-filters="sRGB">` +
        `<feColorMatrix type="matrix" values="${print} 0 0 0 1 0"/>` +
      `</filter>` +
      `<filter id="lens-ink-print-wash" color-interpolation-filters="sRGB">` +
        `<feColorMatrix type="matrix" values="${lum} ${lum} ${lum} 0 0 0 1 0"/>` +
        `<feComponentTransfer><feFuncR type="table" tableValues="${table(0)}"/><feFuncG type="table" tableValues="${table(1)}"/>` +
        `<feFuncB type="table" tableValues="${table(2)}"/></feComponentTransfer>` +
      `</filter>`;
    st.page.append(defs);
    if (!ctx.arriving) makeRoom(st);
    const veilLayer = ctx.layer('fixed');
    veilLayer.classList.add('lens-ink-veil-layer');
    const canvas = document.createElement('canvas');
    canvas.className = 'lens-ink-veil';
    veilLayer.append(canvas);
    // The low-resolution mask is written with putImageData every frame: kept on the CPU
    // (willReadFrequently), so a write is a copy, not a GPU upload and flush.
    const small = () => { const c = document.createElement('canvas'); c.getContext('2d', { willReadFrequently: true }); return c; };
    st.veil = { canvas, g: canvas.getContext('2d'), mask: small() };
    canvas.style.opacity = '0';
    return st;
  }

  // Switches the style with every transition held (the site eases its link colours), so the
  // new colours are there in the same frame: under the veil, or on an arriving page.
  function switchStyle(change) {
    html.classList.add(CLS.instant);
    change();
    void document.body.offsetWidth;            // the styles are resolved with transitions off
    html.classList.remove(CLS.instant);
  }

  // The paper as the page's background: one rule in this lens's own sheet (the core removes
  // the sheet after the exit). Until it is there the page shows the plain ground colour.
  function paperRule(st) {
    if (st.rule || !paper) return;
    const sheet = ownSheet();
    if (!sheet) return;
    try { st.rule = sheet.cssRules[sheet.insertRule(`html.lens-ink { --lens-ink-paper: url("${paper.url}"); }`, sheet.cssRules.length)]; } catch (error) { st.rule = null; }
  }

  function dropRule(st) {
    if (!st.rule) return;
    const owner = st.rule.parentStyleSheet;
    const index = owner ? [...owner.cssRules].indexOf(st.rule) : -1;
    if (index >= 0) owner.deleteRule(index);
    st.rule = null;
  }

  // The style switch: classes, and the paper as the page's background.
  function apply(st) {
    if (st.applied) return;
    paperRule(st);
    switchStyle(() => {
      html.classList.add(CLS.on, st.kind === 'paper' ? CLS.paper : CLS.shell);
      if (st.kind === 'home') html.classList.add(CLS.home);
    });
    st.applied = true;
  }

  function remove(st) {
    dropRule(st);
    st.applied = false;
    // The core has already finished this activation (an instant reset stopped waiting for the
    // exit): its layers and classes are gone, and nothing is written again.
    if (!st.page.isConnected) return;
    switchStyle(() => {
      html.classList.remove(CLS.on, CLS.shell, CLS.paper, CLS.home, CLS.pending, CLS.awaiting, CLS.print);
      html.classList.add(CLS.leaving);
    });
  }

  // Every watcher of the activation stops (the exit has begun).
  function stopWatching(st) {
    if (st.sealWatch) { st.sealWatch.disconnect(); st.sealWatch = null; }
    if (st.lightboxWatch) { st.lightboxWatch.disconnect(); st.lightboxWatch = null; }
    clearTimeout(st.sealTimer); clearTimeout(st.realignTimer); clearTimeout(st.scrollTimer); clearTimeout(st.awaitTimer);
    st.offs.forEach(off => off()); st.offs = [];
  }

  // Paintings for every image, the photography lightbox's too (fixed: the helper lays its
  // paintings in a fixed layer above the lightbox, follows it as it opens, changes photo and
  // closes, and keeps its arrows visible over the photo). Late ones (scrolled to, lazy, the
  // next photo in the lightbox) soak in once the lens is settled; a painting shown again where
  // its image has moved is laid on its own paper again.
  async function startMedia(st) {
    try {
      st.media = await st.ctx.media({ render: painter(st.ctx), ground: '#ffffff', fixed: true });
    } catch (error) {
      st.media = null;
      if (state === st && !st.ctx.signal.aborted) html.classList.add(CLS.print);   // no paintings: the lightbox prints
      return;
    }
    if (state !== st || st.ctx.signal.aborted) return;
    st.media.each(overlay => {
      if ((st.blooming || st.settled) && !st.ctx.motion.matches) overlay.canvas.classList.add('lens-ink-fresh');
      shownSrc.set(overlay.canvas, srcOf(overlay.img));
      if (overlay.fixed && st.lightbox) awaitLightbox(st);
      realignSoon(st);
    });
    watchLightbox(st);
  }

  // The photography lightbox: when it opens or its photo changes, the helper keeps showing
  // the last painting until the new one is made, over the new photo. The photo itself is
  // hidden (ink.css), so the lightbox's own paper shows under its painting; until the painting
  // of the photo now shown is there, html.lens-ink-awaiting hides the last painting too, and the
  // new one soaks in from paper. A photo that will not be painted (unreadable, or no painting
  // after AWAIT_LIMIT_MS) is printed instead (html.lens-ink-lightbox-print).
  const shownSrc = new WeakMap();       // a shown painting's canvas -> the src of the image it painted
  const srcOf = img => img.currentSrc || img.src || '';
  function watchLightbox(st) {
    const box = document.getElementById('lightbox');
    if (!box || st.lightboxWatch) return;
    st.lightbox = box;
    st.lightboxWatch = new MutationObserver(() => awaitLightbox(st));
    st.lightboxWatch.observe(box, { subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'class', 'style', 'hidden'] });
    box.addEventListener('load', () => awaitLightbox(st), { capture: true, signal: st.ctx.signal });
    awaitLightbox(st);
  }
  function awaitLightbox(st) {
    const box = st.lightbox;
    if (state !== st || st.ctx.signal.aborted || !box) return;
    const img = box.querySelector('img');
    const open = !!img && img.getAttribute('src') !== null && img.getClientRects().length > 0;
    const src = open ? img.src : '';
    if (src !== st.awaitSrc) { st.awaitSrc = src; st.awaitExpired = false; clearTimeout(st.awaitTimer); st.awaitTimer = 0; }
    const unreadable = open && img.complete && !!window.SiteLensesMedia && !window.SiteLensesMedia.readable(img);
    // The painting shown must be of the src now asked for (not of the photo before it).
    const painted = open && !!st.media && st.media.overlays.some(o => o.img === img && o.canvas.isConnected && shownSrc.get(o.canvas) === src);
    const waiting = open && !painted && !unreadable && !st.awaitExpired;
    if (waiting && !st.awaitTimer) st.awaitTimer = setTimeout(() => { st.awaitExpired = true; awaitLightbox(st); }, AWAIT_LIMIT_MS);
    if (!waiting && !st.awaitExpired) { clearTimeout(st.awaitTimer); st.awaitTimer = 0; }
    html.classList.toggle(CLS.awaiting, waiting);
    html.classList.toggle(CLS.print, open && !painted && !waiting);
  }
  const mediaReady = (st, ms) => Promise.race([st.mediaStarted.then(() => (st.media ? st.media.ready : null)), sleep(ms, st.ctx.signal)]);

  // After the switch: the seal follows the layout and the content (a pending seal is pressed
  // once its title is there); nothing else needs to.
  function bind(st) {
    const { ctx } = st;
    if (ctx.signal.aborted) return;
    const again = () => {
      if (state !== st || !st.applied || ctx.signal.aborted) return;
      if (st.stamped) placeSeal(st); else if (st.sealPending) stamp(st);
    };
    st.offs.push(ctx.onLayoutChange(() => { again(); realign(st); }), ctx.onContentChange(again));
    window.addEventListener('resize', again, { passive: true, signal: ctx.signal });
    // A scroller (a paper's figure strip on a phone) carries its paintings over the paper with
    // no layout change: once it rests they are laid on the sheet again. The page's own scroll
    // moves the paper with them.
    document.addEventListener('scroll', event => {
      const el = event.target;
      if (el === document || !(el instanceof Element) || state !== st || !st.media) return;
      if (!st.media.overlays.some(o => el.contains(o.img))) return;
      clearTimeout(st.scrollTimer);
      st.scrollTimer = setTimeout(() => realign(st), SCROLL_REST_MS);
    }, { passive: true, capture: true, signal: ctx.signal });
  }

  // The settled state at once (reduced motion, a hidden tab, an arrival). The paper is
  // recalled from sessionStorage in a few ms; when it has to be made again (the storage was
  // full or cleared) the style switches over the plain ground and the paper follows.
  async function settleNow(st) {
    const { signal } = st.ctx;
    const made = await Promise.race([makePaper(signal), sleep(ARRIVE_PAPER_MS, signal)]);
    st.marks = { paper: Math.round(performance.now() - st.began) };
    if (signal.aborted || state !== st) return;
    apply(st);
    if (!made) makePaper(signal).then(() => { if (state === st && st.applied && !signal.aborted) paperRule(st); });
    st.mediaStarted = startMedia(st);
    stamp(st);
    bind(st);
    st.marks.switched = Math.round(performance.now() - st.began);
    // The paintings get what is left of the budget (the paper may have taken its share).
    await mediaReady(st, Math.max(0, ARRIVE_BUDGET_MS - (performance.now() - st.began)));
    st.settled = true;
  }

  async function enter(ctx) {
    const st = build(ctx);
    if (ctx.motion.matches || document.hidden) { await settleNow(st); st.took = Math.round(performance.now() - st.began); return; }
    const { signal } = ctx;
    // The paintings start at once, hidden until the switch; the paper is made (or recalled).
    html.classList.add(CLS.pending);
    st.mediaStarted = startMedia(st);
    if (!await makePaper(signal) || signal.aborted || state !== st) return;
    // 1. The page whitens into paper.
    sizeVeil(st);
    paperVeil(st);
    const textRects = runSliced(blockSteps(st), signal);
    await fadeVeil(st, 1, WHITEN_MS, signal);
    st.marks = { whitened: Math.round(performance.now() - st.began) };
    if (signal.aborted || state !== st) return;
    // 2. Under the paper: the switch, the paintings, the field.
    apply(st);
    html.classList.remove(CLS.pending);
    bind(st);
    // The paintings have been made since the enter began; the bloom does not wait long for them.
    await mediaReady(st, Math.max(MEDIA_GRACE_MS, MEDIA_BY_MS - (performance.now() - st.began)));
    st.marks.media = Math.round(performance.now() - st.began);
    const rects = await textRects;
    if (signal.aborted || state !== st || !rects) return;
    st.field = await runSliced(fieldSteps(st, rects), signal);
    if (!st.field || signal.aborted) return;
    st.marks.field = Math.round(performance.now() - st.began);
    // 3. The ink blooms (paintings finished from now on soak in); the seal is pressed last.
    st.blooming = true;
    await play(st, BLOOM, t => bloomFrame(st, t), signal);
    if (signal.aborted || state !== st) return;
    // The veil is spent: hidden, and its viewport-sized backing store given back (an exit
    // sizes it again).
    st.veil.canvas.style.transition = 'none';
    st.veil.canvas.style.opacity = '0';
    st.veil.canvas.width = st.veil.canvas.height = 1;
    st.settled = true;
    st.took = Math.round(performance.now() - st.began);
    stamp(st);
  }

  // A page opened while the lens is on: the paper is already painted (the ground); the style
  // switches at once and the seal is there.
  async function arrive(ctx) {
    const st = build(ctx);
    await settleNow(st);
    st.took = Math.round(performance.now() - st.began);
  }

  async function exit(ctx) {
    const st = state;
    if (!st) return;
    // An instant exit, reduced motion, or a hidden tab: back at once. Read again after every
    // wait, since an instant reset (pagehide, the first egg) can come during the wash.
    const quick = () => ctx.instant || ctx.motion.matches || document.hidden;
    // Whatever was playing stops where it is; a veil still showing (the page whitening, the
    // paintings awaited, the bloom under way) is where the wash starts from.
    const veil = st.veil.canvas;
    const veilShown = parseFloat(veil.style.opacity || '0') > 0;
    const from = veilShown && st.veil.alpha ? st.veil.alpha.slice() : null;
    if (st.anim) st.anim.stop();
    stopWatching(st);
    try {
      if (!quick() && (st.applied || veilShown) && paper) {
        if (!from) sizeVeil(st);               // the viewport may have changed since the enter
        if (st.applied) {
          // 1. The paper washes down over the ink (or over what the bloom has opened so far).
          veil.style.transition = 'none';
          veil.style.opacity = '1';
          await play(st, WASH, t => washFrame(st, t, from), null, quick);
          // 2. Under it the page returns; 3. the paper lifts.
          remove(st);
          if (!quick()) await fadeVeil(st, 0, OUT_MS, null);
        } else {
          // Still whitening (the style has not switched): the veil fades from where it is.
          const now = parseFloat(getComputedStyle(veil).opacity) || 0;
          veil.style.transition = 'none';
          veil.style.opacity = String(now);
          paperVeil(st);
          remove(st);
          if (!quick()) await fadeVeil(st, 0, Math.round(OUT_MS * now), null);
        }
      } else {
        remove(st);
      }
    } finally {
      // Back at once where a wait was cut short, and the activation let go.
      veil.style.transition = 'none'; veil.style.opacity = '0';
      veil.width = veil.height = 1;
      if (st.seal) { st.seal.remove(); st.seal.classList.remove('is-stamped', 'is-still'); }
      st.sealPending = false;
      if (state === st) state = null;
      if (!state) releasePaper();
    }
  }

  window.SiteLenses.register({
    id: 'ink',
    order: 6,
    numeral: 'VI',
    label: 'Ink',
    line: 'Ink has five colours (墨分五色).',
    ground: PAPER_HEX,              // xuan paper, painted before a page arrives
    css: true,
    enter,
    arrive,
    exit,
    // Test hooks: the running activation (veil, field, seal, media), the paper, the sheet's
    // pixel arrays (null after the last exit), a painting's making and the key the tile is kept
    // under.
    get _state() { return state; },
    get _paper() { return paper; },
    get _sheet() { return sheet; },
    _made: canvas => madeOf.get(canvas) || null,     // what a painting was made from (its work size)
    _paperKey: PAPER_KEY
  });
})();
