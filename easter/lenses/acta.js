/**
 * Lens IV · Acta Eruditorum, 1692: "As it might have been printed when Bernoulli named the
 * spira mirabilis." (Jacob Bernoulli named the logarithmic spiral in the Acta in 1692.)
 *
 * Any page of the site, set as a 17th-century learned journal: IM Fell English (Google
 * Fonts) with small capitals, a three-line drop cap on the first paragraph of running text,
 * engraved rules, iron-gall ink on laid paper, every photograph as a copperplate engraving,
 * and sepia plates for the other images (figures, diagrams, screenshots). No word changes:
 * only fonts, colours and ornaments (acta.css), plus the paper, the engravings and the drop
 * cap rule made here.
 *
 * The engravings share one tone pipeline (toneSteps): luminance, levels stretched over the
 * 2–98 % range, local contrast (darkness minus its blur) and a tone curve. The homepage
 * portrait is drawn from it as filled hatching paths in an oval with a thin double frame (its
 * own page-layer canvas). Every other photograph (the media helper, media.js, classifies it
 * 'photo') becomes a plate: the helper lays a canvas over the image, and the render here
 * draws the same three hatches pixel by pixel (each pixel's ink is its coverage by the
 * nearest line of each hatch, whose half-width follows the darkness there), wider apart and
 * finer than the portrait's so a large photo reads as line work, printed on the laid paper
 * aligned with the sheet, inside a thick-and-thin double rule. In the deepest shadows the
 * main hatch swells until only thin white lines are left between its lines, and the third
 * hatch joins only there, so the darks close up to ink, as on a copper plate, instead of
 * leaving a lattice of white dots (a halftone screen). The pixel form is cut
 * into slices of a few milliseconds (a gallery photo is a million device px or more), and its
 * tone field is computed at PLATE_TONE_DENSITY px per css px (finer on a dense screen, so the
 * outlines do not step). One press makes every plate, one at a time, nearest the reader
 * first by a fresh measure before each plate (the gallery's masonry moves its photos as they
 * load): the lightbox's photo, then the photographs in the viewport, then the others. It does
 * not wait for the helper to ask: a photograph within PRESS_NEAR screens is printed at the
 * size the helper will ask for and laid on its blank at once, and handed over as the helper's
 * plate when the helper asks (the press section below). The helper keeps only the plates
 * near the viewport. Graphics and images whose pixels may not be
 * read keep the sepia plate of acta.css, as do the app screenshots of projects.html (not
 * photographs, though the classifier takes two of them for photos). The photography lightbox
 * (a fixed box on <body>, outside the scope) becomes a full page of the book: acta.css lays
 * the sheet behind it and sets its caption, and the helper's fixed option redraws its photo
 * as a plate too, printed on the same sheet (aligned with the viewport, as that sheet is).
 *
 * A photograph is never seen as a photograph while the style is on. The site keeps its
 * photographs in photos/, so the ones that will become plates are known before the helper
 * has read them: a rule this lens adds to its own sheet hides them, and a blank plate (the
 * plate tone and the double rule, acta.css) stands on each until its engraving is inked in
 * over it. Arriving, entering after the band's wait, or scrolling fast, the reader sees blank
 * plates being printed, never a toned photograph turning into an engraving. A photo the helper
 * declines (a graphic, unreadable pixels, a skipped image) is released to its sepia plate.
 * In the lightbox the photograph is hidden the same way and its blank is a layer of the
 * sheet, placed before the first frame that shows it; when it changes in place (next,
 * previous) the plate of the one before goes at once and the next blank stands in its place.
 *
 * Site-shell pages (home, site pages, blog posts) are coloured by explicit rules, their
 * images by a sepia filter and the SVG colour matrix that prints white as paper and black as
 * ink; paper pages, with their own design and many-coloured demos, by that matrix as a whole
 * (acta.css explains both). Their header becomes a running head.
 *
 * Enter: the fonts load first (no flash of unstyled text) while the paper, the portrait and
 * the plates in the viewport are engraved (the band waits for those plates at most
 * PLATE_WAIT_MS), then a soft band of paper colour descends over the page (a view transition
 * whose old and new snapshots are masked on either side of the band), leaving the Acta style,
 * plates included, above it. A plate finished after that is inked in (a short fade). The
 * caption shows once the band has passed, by the title as Acta sets it (caption() is null
 * until then); on a paper page the eyebrow is drawn a little higher so that it has room
 * there. Exit: the band rises. Arrive (a page opened while the lens is on): the style
 * switches at once under the pre-painted paper, and the plates are inked in on their blanks
 * as they are made. The tile is kept in sessionStorage, so that is quick; without one (a
 * first page, a cleared session) the style switches on the flat ground of the paper's colour
 * and the tile is laid under it once made. The fonts are waited for ARRIVE_FONT_MS at most;
 * faces that come later are swapped in while the reader is still at the top and has not
 * touched the page (lateFonts). The layout reflows with the fonts; the scroll
 * position is restored on exit if the reader did not scroll. Without view transitions the
 * page crossfades through a paper veil. The portrait and the drop cap follow the layout
 * (resizes, late content, ctx.onLayoutChange: lazy photos, fonts, toggled details); the
 * plates follow it through the helper, and the blanks and prints with the portrait.
 */
(() => {
  'use strict';

  // The band descends in 900 ms and rises in 600 ms: those timings live in acta.css.
  const VEIL_IN_MS = 300;             // fallback without view transitions: veil fades in…
  const VEIL_OUT_MS = 450;            // …and out again
  const FONT_TIMEOUT_MS = 4000;       // give up waiting for the fonts (slow network) after this
  const ARRIVE_FONT_MS = 200;         // the same on arrival, while the page is still hidden (the
                                      // ground is paper already: the fallback serif costs little).
                                      // Faces that come later are swapped in while the reader has
                                      // not moved yet (lateFonts)
  const ARRIVE_BY_MS = 300;           // arrive: the tile's decode is waited for until this long after
                                      // the arrival began (the contract's budget is 350 ms)
  // Google Fonts' stylesheet for the two IM Fell families. It is read with fetch() and its
  // faces are added through the FontFace API, so no <link> is involved and a blocked Google
  // only means fallback serif faces (lens-acta-fallback), never a failed lens.
  const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=block';

  // Laid paper, drawn once into a tile (css px). The tile holds whole chain-line and
  // laid-line periods, so it repeats without a seam.
  const PAPER_RGB = [242, 232, 211];  // #f2e8d3
  const TILE = 624;                   // 24 chain intervals
  const CHAIN_STEP = 26;              // vertical chain lines
  const LAID_STEP = 3.12;             // fine horizontal laid lines (624 / 200)
  const CHAIN_DEPTH = 0.02;           // darkening at a chain line (varies ±35 % along it)
  const CHAIN_SIGMA = 1.5;            // chain line softness (css px)
  const CHAIN_WANDER = 0.9;           // sideways wander of each chain line (css px)
  const LAID_DEPTH = 0.012;           // darkening at a laid line
  const CLOUD_DEPTH = 0.018;          // slow mottling of the sheet
  const CLOUD_CELL = 48;              // mottling scale (divides TILE)
  const GRAIN_DEPTH = 0.016;          // per-pixel fibre noise
  const FOXING_SPOTS = 3;             // per tile: sparse
  const SEED = 1692;
  const SLICE_MS = 6;                 // longest stretch of generation work between yields
  const PAPER_KEY = 'lenses-acta-paper';   // sessionStorage: the tile as a data URL, per tile
                                           // scale (tileScale: 1 or 2), so the next page of the
                                           // site arrives at once

  // The engravings: luminance-modulated hatching (css px spacing, degrees). The portrait's is
  // clipped to an oval; the plates use the same hatches, scaled (PLATE_*).
  const INK_RGB = [42, 29, 18];       // #2a1d12
  const HATCHES = [
    { angle: -16, spacing: 1.9, from: 0.0, to: 1.0, width: 0.46 },    // the main tone
    { angle: 44, spacing: 2.2, from: 0.45, to: 1.0, width: 0.42 },    // cross-hatching in the darks
    { angle: -76, spacing: 2.6, from: 0.74, to: 1.0, width: 0.36 }    // the deepest shadows
  ];
  const MIN_SPACING = 2.7;            // device px: closer lines would alias into a halftone
  const LOCAL_CONTRAST = 0.9;         // unsharp mask on darkness, so the features carry
  const LOCAL_RADIUS = 5;             // its blur radius (css px)
  const TONE_GAMMA = 0.8;             // < 1 lifts the mid-tones into visible lines
  const OVAL_RX = 0.43;               // oval radii as fractions of the photo box
  const OVAL_RY = 0.475;
  const BACKGROUND_LIFT = 0.35;       // lightens the photo's background away from the sitter
  const ENGRAVINGS_KEPT = 3;          // portrait engravings kept for later (one per photo size)

  // Plates: every other photograph, engraved with the same hatches on a rectangular plate.
  // Not the portrait (it keeps its own oval engraving), nor the app screenshots of
  // projects.html (photos/project-demo/), which stay sepia thumbnails like their neighbours.
  const PLATE_SELECT = 'img:not(.profile-photo, [src*="project-demo/"])';
  // The photographs expected to become plates, known before the helper has read them (the
  // site keeps its photographs in photos/): hidden under blank plates while the style is on.
  const EXPECT_SELECT = 'img[src*="photos/"]:not(.profile-photo, [src*="project-demo/"])';
  const LIGHTBOX = '#lightbox';       // photography.html's lightbox: a fixed box outside the scope
  const PLATE_SCALE = 1.7;            // the plates' hatching is this much wider than the
                                      // portrait's (css px), so a large photo reads as line work …
  const PLATE_SMALL = [100, 275];     // … from this plate size (css px, the square root of its
                                      // area) up; a vignette below it keeps the portrait's spacing
  const PLATE_WEIGHT = 0.65;          // … and its lines this much thinner at full tone, so the
                                      // dark mid-tones keep white between the crossed lines …
  const PLATE_CLOSE = [0.8, 1];       // … until, over this darkness, the main hatch's lines swell
  const PLATE_SHUT = 0.9;             // … to about this share of their spacing: the deepest
                                      // shadows close up to ink ruled by thin white lines along the
                                      // main hatch, not a lattice of white dots
  const PLATE_THIRD = 0.93;           // the third hatch (−76°) joins only from this darkness, to
                                      // break those white lines (not as a third screen)
  const PLATE_RADIUS = 0.04;          // local-contrast blur radius, as a share of the plate's shorter side
  const PLATE_CONTRAST = 0.5;         // local contrast: gentler than the portrait's (no halos on skies)
  const PLATE_GAMMA = 1;              // tone curve: a whole photograph needs no lifted mid-tones
  const PLATE_MIN_HALF = 0.025;       // css px: a line of a smaller half-width is not cut (it would
                                      // ink 5 % of a pixel at most)
  const PLATE_RULE_OUTER = 1.1;       // css px: the outer rule, at the plate's edge …
  const PLATE_RULE_GAP = 2.4;         // … the gap to the inner rule …
  const PLATE_RULE_INNER = 0.55;      // … the inner rule …
  const PLATE_MARGIN = 1.6;           // … and the gap from it to the engraving
  const PLATE_TONE = 0.025;           // the wiped plate's faint film of ink, inside the outer rule
                                      // (the blank plates take the rules and the tone from these
                                      // constants too: blankRules())
  const PLATE_TONE_DENSITY = [1, 2];  // the plates' tone field, px per css px: on a 1x screen, and
                                      // from 2x up (bilinear steps of 1 css px show at 3x)
  const PLATE_BAND = 64;              // rows read or written per call (getImageData, putImageData)
  const PLATE_WAIT_MS = 900;          // enter: the band waits at most this long for the plates
                                      // in the viewport (they are made while the fonts load;
                                      // a later one is inked in on its blank). Arriving, the
                                      // page shows at once with blanks: no wait.
  const INK_MS = 700;                 // a plate inks in over this long (acta.css lens-acta-ink)
  const PRESS_NEAR = 1.5;             // the press prints the photographs within this many
                                      // viewport heights of the viewport (the helper's NEAR_MARGIN)
  const PRESS_POKE_MS = 90;           // after a scroll, the press looks for photographs this soon
  const PRESS_HOLD_MS = 500;          // a plate outside the viewport waits at most this long for a
                                      // photograph in the viewport that is still loading

  const CLS = {
    on: 'lens-acta', portrait: 'lens-acta-portrait', vtIn: 'lens-acta-vt-in', vtOut: 'lens-acta-vt-out',
    hold: 'lens-acta-hold', fallback: 'lens-acta-fallback', home: 'lens-acta-home', shell: 'lens-acta-shell', paper: 'lens-acta-paper'
  };
  // Blocks that can hold the reader's place while the type reflows.
  const ANCHORS = '#main-content :is(h1, h2, h3, p, li, figure, .pronunciation, .profile-links, .view-all), #site-footer .site-footer, body > footer.paper-footer';
  // Where the drop cap's paragraph is not looked for.
  const NOT_PROSE = 'figure, [data-paper-demo], .paper-demo, header, nav, aside, table, li, dd, blockquote, .article-note, .paper-header';
  const PRINT_ID = 'lens-acta-print';
  const ROOT_VAR = '--lens-acta-paper';

  const html = document.documentElement;
  let state = null;                   // the running activation, or null
  let paper = null;                   // { url } once generated (kept for later activations)
  let fell = null;                    // the loaded IM Fell FontFaces (kept likewise)
  const engravings = new Map();       // "W×H" in device px → canvas (or null), kept likewise,
                                      // the last ENGRAVINGS_KEPT sizes only
  let sheet = null;                   // { url, pixels: Promise } of the paper tile's pixels, for
                                      // the plates (several MB: dropped on exit)

  /* ---------- small helpers ---------- */

  // Resolves after ms, or at once when the signal aborts (never rejects).
  const sleep = (ms, signal) => new Promise(resolve => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  // A small seeded generator, so the paper is the same sheet every time.
  const random = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const shown = el => !!el && el.getClientRects().length > 0;

  // The page kind from the core (ctx.page), or worked out here for an older core.
  function pageKind(ctx) {
    if (ctx.page && ctx.page.kind) return ctx.page.kind;
    if (document.querySelector('#main-content.paper-container')) return 'paper';
    if (document.querySelector('#main-content .profile-section')) return 'home';
    return /\/blogs\//.test(location.pathname) ? 'blog' : 'site';
  }

  // The print colour matrix (sRGB): each channel maps 0 → ink and 1 → paper, so white panels
  // become the sheet, black becomes ink, and colours keep their hue, printed.
  function printMatrix() {
    const rows = PAPER_RGB.map((p, c) => {
      const row = [0, 0, 0, 0, +(INK_RGB[c] / 255).toFixed(4)];
      row[c] = +((p - INK_RGB[c]) / 255).toFixed(4);
      return row;
    });
    return [...rows.flat(), 0, 0, 0, 1, 0].join(' ');
  }

  // Float fields: fresh ones (the portrait), or the plates' scratch fields, reused from plate
  // to plate (a gallery would otherwise allocate tens of megabytes of short-lived arrays, and
  // collecting them can pause the page). Every taken field is written before it is read.
  const fresh = n => new Float32Array(n);
  const scratch = {
    fields: [], next: 0, busy: false,
    begin() { if (this.busy) return fresh; this.busy = true; this.next = 0; return n => this.take(n); },
    take(n) {
      let field = this.fields[this.next];
      if (!field || field.length < n) { field = new Float32Array(n); this.fields[this.next] = field; }
      this.next++;
      return field.subarray(0, n);
    },
    end() { this.busy = false; },
    clear() { this.fields = []; this.busy = false; }
  };

  // Separable box blur of a W×H field (edges clamped), as steps: a yield after every row of
  // each pass. Returns the blurred field.
  function* boxBlurSteps(src, W, H, r, alloc = fresh) {
    if (r < 1) return src;
    const tmp = alloc(W * H); const out = alloc(W * H); const span = 2 * r + 1;
    for (let y = 0; y < H; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = sum / span;
        sum += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
      }
      yield;
    }
    // The vertical pass row by row (a running sum per column), so memory is read in order.
    const sums = new Float64Array(W);
    for (let y = -r; y <= r; y++) {
      const row = Math.min(H - 1, Math.max(0, y)) * W;
      for (let x = 0; x < W; x++) sums[x] += tmp[row + x];
    }
    for (let y = 0; y < H; y++) {
      const at = y * W; const add = Math.min(H - 1, y + r + 1) * W; const sub = Math.max(0, y - r) * W;
      for (let x = 0; x < W; x++) {
        out[at + x] = sums[x] / span;
        sums[x] += tmp[add + x] - tmp[sub + x];
      }
      yield;
    }
    return out;
  }

  // The engravings' tone pipeline, from a luminance field (0 black … 1 white) of W×H device
  // px to darkness (0 paper … 1 ink): a light blur so line widths swell smoothly, levels
  // stretched over the 2–98 % range (from a histogram), an optional lift of the background
  // away from the sitter (the portrait's oval), local contrast (darkness plus `contrast`
  // times its difference from a blur of `radius` device px), so the features carry, and a
  // tone curve (darkness to the power `gamma`; below 1 it lifts the mid-tones into lines).
  // pool > 1 computes the local-contrast blur at 1/pool of the resolution (large plates).
  function* toneSteps(lum, W, H, { radius, lift = 0, contrast, gamma, pool = 1, alloc = fresh }) {
    const soft = yield* boxBlurSteps(lum, W, H, 1, alloc);
    const bins = new Uint32Array(1024);
    for (let y = 0; y < H; y++) {
      for (let i = y * W, end = i + W; i < end; i++) bins[Math.min(1023, (soft[i] * 1024) | 0)]++;
      yield;
    }
    const level = share => { let sum = 0; for (let b = 0; b < 1024; b++) { sum += bins[b]; if (sum >= share * W * H) return b / 1024; } return 1; };
    const lo = level(0.02); const hi = level(0.98);
    const raw = alloc(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let l = clamp01((soft[y * W + x] - lo) / Math.max(0.01, hi - lo));
        if (lift) {
          const dx = (x / W - 0.5) / 0.36; const dy = (y / H - 0.5) / 0.5;
          l += (1 - l) * lift * smooth(0.75, 1.15, Math.sqrt(dx * dx + dy * dy));
        }
        raw[y * W + x] = 1 - l;
      }
      yield;
    }
    const wide = pool > 1 ? yield* pooledBlurSteps(raw, W, H, radius, pool, alloc)
      : yield* boxBlurSteps(yield* boxBlurSteps(raw, W, H, radius, alloc), W, H, radius, alloc);
    const dark = alloc(W * H);
    for (let y = 0; y < H; y++) {
      if (gamma === 1) for (let i = y * W, end = i + W; i < end; i++) dark[i] = clamp01(raw[i] + contrast * (raw[i] - wide[i]));
      else for (let i = y * W, end = i + W; i < end; i++) dark[i] = Math.pow(clamp01(raw[i] + contrast * (raw[i] - wide[i])), gamma);
      yield;
    }
    return dark;
  }

  // The local-contrast blur of a large field, at 1/f of its resolution: block means of f×f
  // px, the box blur applied twice there (radius / f), then read back bilinearly. The same
  // smooth field (the radius is several blocks) at about 1/f² of the work.
  function* pooledBlurSteps(src, W, H, radius, f, alloc = fresh) {
    const w = Math.ceil(W / f); const h = Math.ceil(H / f);
    const small = alloc(w * h).fill(0);
    const block = new Int32Array(W);
    for (let x = 0; x < W; x++) block[x] = (x / f) | 0;
    for (let y = 0; y < H; y++) {
      const row = ((y / f) | 0) * w;
      for (let x = 0, i = y * W; x < W; x++, i++) small[row + block[x]] += src[i];
      yield;
    }
    for (let by = 0; by < h; by++) {
      const rows = Math.min(f, H - by * f);
      for (let bx = 0; bx < w; bx++) small[by * w + bx] /= rows * Math.min(f, W - bx * f);
    }
    const r = Math.max(1, Math.round(radius / f));
    const blurred = yield* boxBlurSteps(yield* boxBlurSteps(small, w, h, r, alloc), w, h, r, alloc);
    const out = alloc(W * H);
    const xs0 = new Int32Array(W); const xs1 = new Int32Array(W); const txs = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1, Math.max(0, (x + 0.5) / f - 0.5));
      xs0[x] = sx | 0; xs1[x] = Math.min(w - 1, xs0[x] + 1); txs[x] = sx - xs0[x];
    }
    for (let y = 0; y < H; y++) {
      const sy = Math.min(h - 1, Math.max(0, (y + 0.5) / f - 0.5)); const y0 = (sy | 0) * w; const y1 = Math.min(h - 1, (sy | 0) + 1) * w; const ty = sy - (sy | 0);
      for (let x = 0, i = y * W; x < W; x++, i++) {
        const a = blurred[y0 + xs0[x]]; const b = blurred[y0 + xs1[x]]; const c = blurred[y1 + xs0[x]]; const d = blurred[y1 + xs1[x]];
        const top = a + (b - a) * txs[x];
        out[i] = top + (c + (d - c) * txs[x] - top) * ty;
      }
      yield;
    }
    return out;
  }

  // The paper URL lives in a custom property on <html>. The original style attribute (or its
  // absence) is saved first and put back verbatim on exit; reading the attribute before
  // removing it matters, as Chrome otherwise keeps serializing an empty style="".
  const rootVar = {
    saved: undefined,                 // undefined: nothing set; null: there was no attribute
    set(value) {
      if (this.saved === undefined) this.saved = html.getAttribute('style');
      html.style.setProperty(ROOT_VAR, value);
    },
    restore() {
      if (this.saved === undefined) return;
      if (this.saved === null) { html.getAttribute('style'); html.removeAttribute('style'); } else html.setAttribute('style', this.saved);
      this.saved = undefined;
    }
  };

  /* ---------- incremental work ---------- */

  // The paper and the engravings are generators that yield between pieces of work. The enter
  // runs them in slices of SLICE_MS while the fonts load, so no frame is blocked for long;
  // a later resize that needs a new portrait engraving runs it to the end at once (it is
  // small). The plates are always sliced.
  function runNow(steps) {
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  }
  // The next task, by a message (timers are clamped to 4 ms once nested). One message per
  // waiter, so two slicers never share a task.
  const tasks = new MessageChannel();
  const waiting = [];
  tasks.port1.onmessage = () => { const resume = waiting.shift(); if (resume) resume(); };
  const nextTask = () => new Promise(resolve => { waiting.push(resolve); tasks.port2.postMessage(0); });
  // The longest slice and the plates made so far (read by tests/browser_lens_acta.js).
  // The longest single step (between two yields) is named too: label#step.
  const stats = { slices: 0, longSlices: 0, maxSliceMs: 0, maxStepMs: 0, maxStepAt: '', plates: 0, plateMs: 0, plateMaxMs: 0, arriveMs: null };
  async function runSliced(steps, signal, label = '') {
    let began = performance.now();
    const close = () => {
      const ms = performance.now() - began;
      stats.slices++;
      if (ms > 8) stats.longSlices++;
      if (ms > stats.maxSliceMs) stats.maxSliceMs = ms;
    };
    for (let index = 0; ; index++) {
      const at = performance.now();
      const step = steps.next();
      const ms = performance.now() - at;
      if (ms > stats.maxStepMs) { stats.maxStepMs = ms; stats.maxStepAt = `${label}#${index}`; }
      if (step.done) { close(); return step.value; }
      if (performance.now() - began > SLICE_MS) {
        close();
        await nextTask();
        if (signal?.aborted) return null;
        began = performance.now();
      }
    }
  }

  /* ---------- laid paper ---------- */

  // The tile's px per css px: 1 or 2, the two tiles that differ. A zoomed 1x screen (1.1,
  // 1.25) takes the 1x tile and a 1.5x or 3x screen the 2x one, so a reader who changes the
  // zoom or moves the window to another screen finds a tile kept for the next page.
  const tileScale = () => Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));

  function* paperSteps() {
    const k = tileScale();
    const n = Math.round(TILE * k);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const g = canvas.getContext('2d');
    const image = g.createImageData(n, n);
    const d = image.data;
    const rand = random(SEED);

    // Mottling: a wrapped lattice of random values, bilinearly interpolated.
    const cells = TILE / CLOUD_CELL;
    const lattice = new Float32Array(cells * cells).map(() => rand() * 2 - 1);
    const cellPx = n / cells;
    // Chain lines: each wanders a little sideways and varies in depth along its length
    // (periodic over the tile height, so the tile still repeats without a seam).
    const chains = TILE / CHAIN_STEP; const chainPx = CHAIN_STEP * k; const sigma = CHAIN_SIGMA * k;
    const chainPos = new Float32Array(chains * n); const chainDepth = new Float32Array(chains * n);
    for (let j = 0; j < chains; j++) {
      const p1 = rand() * 6.283; const p2 = rand() * 6.283; const p3 = rand() * 6.283;
      for (let y = 0; y < n; y++) {
        const a = (2 * Math.PI * y) / n;
        chainPos[j * n + y] = j * chainPx + CHAIN_WANDER * k * (0.7 * Math.sin(a + p1) + 0.3 * Math.sin(3 * a + p2));
        chainDepth[j * n + y] = CHAIN_DEPTH * (1 + 0.35 * Math.sin(2 * a + p3));
      }
    }
    const laidPx = LAID_STEP * k; const rowLaid = new Float32Array(n);
    for (let y = 0; y < n; y++) rowLaid[y] = LAID_DEPTH * (0.5 + 0.5 * Math.cos((2 * Math.PI * y) / laidPx));
    const reach = 3 * sigma;                       // a chain line's darkening is negligible beyond
    for (let y = 0; y < n; y++) {
      const gy = y / cellPx; const y0 = Math.floor(gy); const fy = gy - y0;
      const r0 = (y0 % cells) * cells; const r1 = ((y0 + 1) % cells) * cells;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < n; x++) {
        const gx = x / cellPx; const x0 = Math.floor(gx); const fx = gx - x0;
        const c0 = x0 % cells; const c1 = (x0 + 1) % cells;
        const sx = fx * fx * (3 - 2 * fx);
        const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * sx;
        const bottom = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * sx;
        let v = (top + (bottom - top) * sy) * CLOUD_DEPTH + (rand() - 0.5) * GRAIN_DEPTH - rowLaid[y];
        const j = Math.round(x / chainPx);
        const at = (j % chains) * n + y;
        const dx = x - (chainPos[at] + (j >= chains ? n : 0));
        if (dx < reach && dx > -reach) { const dc = dx / sigma; v -= chainDepth[at] * Math.exp(-dc * dc); }
        // Darker fibres turn slightly browner, as old paper does.
        const i = (y * n + x) * 4;
        d[i] = PAPER_RGB[0] * (1 + v);
        d[i + 1] = PAPER_RGB[1] * (1 + v * 1.12);
        d[i + 2] = PAPER_RGB[2] * (1 + v * 1.3);
        d[i + 3] = 255;
      }
      yield;
    }
    g.putImageData(image, 0, 0);
    yield;

    // Foxing: a few faint brown spots, each drawn at its wrapped copies too.
    g.globalCompositeOperation = 'multiply';
    for (let s = 0; s < FOXING_SPOTS; s++) {
      const x = rand() * n; const y = rand() * n; const r = (3 + rand() * 9) * k; const a = 0.05 + rand() * 0.06;
      for (const ox of [-n, 0, n]) {
        for (const oy of [-n, 0, n]) {
          const gradient = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          gradient.addColorStop(0, `rgba(150, 96, 42, ${a})`);
          gradient.addColorStop(0.55, `rgba(160, 108, 52, ${a * 0.45})`);
          gradient.addColorStop(1, 'rgba(160, 108, 52, 0)');
          g.fillStyle = gradient;
          g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
        }
      }
    }
    return canvas;
  }

  // The tile kept in sessionStorage by an earlier page: the one of this screen's tile scale,
  // else the other one (a little softer or finer, but the same sheet), or null.
  function storedPaper() {
    const k = tileScale();
    for (const scale of [k, 3 - k]) {
      try { const kept = sessionStorage.getItem(`${PAPER_KEY}@${scale}`); if (kept && kept.startsWith('data:image/')) return { url: kept }; } catch (error) { return null; }
    }
    return null;
  }
  // The tile as an image URL: encoded off the main thread (toBlob) where possible, and kept
  // in sessionStorage as a data URL so the next page of the site does not draw it again.
  async function makePaper(signal) {
    const key = `${PAPER_KEY}@${tileScale()}`;
    const kept = storedPaper();
    if (kept) return kept;
    const canvas = await runSliced(paperSteps(), signal, 'paper');
    if (!canvas) return null;
    const blob = canvas.toBlob ? await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9)) : null;
    if (!blob) {
      const url = canvas.toDataURL('image/jpeg', 0.9);
      try { sessionStorage.setItem(key, url); } catch (error) { /* full or unavailable */ }
      return { url };
    }
    const reader = new FileReader();
    reader.onload = () => { try { sessionStorage.setItem(key, reader.result); } catch (error) { /* full or unavailable */ } };
    reader.readAsDataURL(blob);
    return { url: URL.createObjectURL(blob) };
  }

  /* ---------- the engraved portrait ---------- */

  // Hatching whose line width follows the photo's darkness, clipped to an oval with a thin
  // double frame. Returns null when the photo cannot be read.
  function* engraveSteps(img, W, H, k) {
    // Luminance field at the canvas resolution.
    const source = document.createElement('canvas');
    source.width = W; source.height = H;
    const sg = source.getContext('2d');
    sg.drawImage(img, 0, 0, W, H);
    let pixels;
    try { pixels = sg.getImageData(0, 0, W, H).data; } catch (error) { return null; }
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = (pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722) / 255;
    yield;
    const dark = yield* toneSteps(lum, W, H, { radius: Math.round(LOCAL_RADIUS * k), lift: BACKGROUND_LIFT, contrast: LOCAL_CONTRAST, gamma: TONE_GAMMA });

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    const cx = W / 2; const cy = H / 2; const rx = W * OVAL_RX; const ry = H * OVAL_RY;
    g.save();
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = `rgb(${INK_RGB.join(',')})`;
    const reach = Math.hypot(W, H) / 2; const stepAlong = 0.6 * k; const minHalf = 0.08 * k;
    const tops = []; const bottoms = [];
    const flush = () => {
      if (tops.length > 2) {
        g.moveTo(tops[0], tops[1]);
        for (let i = 2; i < tops.length; i += 2) g.lineTo(tops[i], tops[i + 1]);
        for (let i = bottoms.length - 2; i >= 0; i -= 2) g.lineTo(bottoms[i], bottoms[i + 1]);
        g.closePath();
      }
      tops.length = 0; bottoms.length = 0;
    };
    for (const hatch of HATCHES) {
      const a = (hatch.angle * Math.PI) / 180;
      const ux = Math.cos(a); const uy = Math.sin(a); const nx = -uy; const ny = ux;
      const spacing = Math.max(hatch.spacing * k, (MIN_SPACING * hatch.spacing) / HATCHES[0].spacing);
      const maxHalf = hatch.width * spacing;
      g.beginPath();
      for (let t = -reach; t <= reach; t += spacing) {
        for (let m = -reach; m <= reach; m += stepAlong) {
          const px = cx + nx * t + ux * m; const py = cy + ny * t + uy * m;
          const ex = (px - cx) / (rx + 2); const ey = (py - cy) / (ry + 2);
          if (ex * ex + ey * ey > 1) { flush(); continue; }       // outside the oval
          const xi = px | 0; const yi = py | 0;
          const tone = xi < 0 || yi < 0 || xi >= W || yi >= H ? 0 : clamp01((dark[yi * W + xi] - hatch.from) / (hatch.to - hatch.from));
          const half = maxHalf * tone;
          if (half < minHalf) { flush(); continue; }
          tops.push(px + nx * half, py + ny * half);
          bottoms.push(px - nx * half, py - ny * half);
        }
        flush();
      }
      g.fill();
      yield;
    }
    g.restore();
    // The thin double frame.
    g.strokeStyle = `rgb(${INK_RGB.join(',')})`;
    g.lineWidth = 1.1 * k;
    g.beginPath(); g.ellipse(cx, cy, rx + 3.4 * k, ry + 3.4 * k, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 0.55 * k;
    g.beginPath(); g.ellipse(cx, cy, rx + 0.9 * k, ry + 0.9 * k, 0, 0, Math.PI * 2); g.stroke();
    canvas.className = 'lens-acta-engraving';
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  }

  // The engraving for a photo box of w×h css px, cached per device size. Sliced when a signal
  // is given (the enter), otherwise computed at once (a resize to a new photo size).
  function engravingKey(w, h) {
    const k = Math.min(window.devicePixelRatio || 1, 2);
    return { k, W: Math.max(1, Math.round(w * k)), H: Math.max(1, Math.round(h * k)) };
  }
  // Keeps an engraving, dropping the oldest beyond ENGRAVINGS_KEPT (a resize that moves
  // through many sizes would otherwise keep one canvas for each).
  function keepEngraving(key, canvas) {
    engravings.delete(key);
    engravings.set(key, canvas);
    while (engravings.size > ENGRAVINGS_KEPT) engravings.delete(engravings.keys().next().value);
  }
  function engrave(img, w, h) {
    if (!img.complete || !img.naturalWidth) return null;
    const { k, W, H } = engravingKey(w, h);
    const key = `${W}x${H}`;
    if (!engravings.has(key)) keepEngraving(key, runNow(engraveSteps(img, W, H, k)));
    return engravings.get(key);
  }
  async function prepareEngraving(signal) {
    const img = document.querySelector('#main-content .profile-photo');
    if (!img || !img.complete || !img.naturalWidth || !img.getClientRects().length) return;
    const r = img.getBoundingClientRect();
    const { k, W, H } = engravingKey(r.width, r.height);
    const key = `${W}x${H}`;
    if (engravings.has(key)) return;
    const canvas = await runSliced(engraveSteps(img, W, H, k), signal, 'portrait');
    if (!signal?.aborted) keepEngraving(key, canvas);
  }

  /* ---------- the plates ---------- */

  // The paper tile's pixels, read once from its image, so a plate is printed on the same
  // sheet: { data, n (tile side, px), k (tile px per css px) }, or null. Read band by band
  // through a canvas one band tall (copying the whole tile into a readable canvas at once
  // takes 20–30 ms); the image is a bitmap decoded off the main thread where possible.
  function* sheetSteps(image, n) {
    const canvas = document.createElement('canvas');
    canvas.width = n; canvas.height = PLATE_BAND;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const data = new Uint8ClampedArray(n * n * 4);
    for (let y0 = 0; y0 < n; y0 += PLATE_BAND) {
      const rows = Math.min(PLATE_BAND, n - y0);
      g.clearRect(0, 0, n, PLATE_BAND);
      g.drawImage(image, 0, y0, n, rows, 0, 0, n, rows);
      data.set(g.getImageData(0, 0, n, rows).data, y0 * n * 4);
      yield;
    }
    if (typeof image.close === 'function') image.close();
    return { data, n, k: n / TILE };
  }
  async function readSheet(url, signal) {
    let image = null;
    try {
      if (typeof createImageBitmap === 'function') image = await createImageBitmap(await (await fetch(url)).blob());
    } catch (error) { image = null; }
    if (!image) {
      image = new Image();
      image.src = url;
      try { await image.decode(); } catch (error) { return null; }
    }
    const n = image.naturalWidth || image.width;
    if (!n || signal?.aborted) { if (typeof image.close === 'function') image.close(); return null; }
    return runSliced(sheetSteps(image, n), signal, 'sheet');
  }
  // Kept for later activations; an abandoned read is tried again next time.
  function sheetFor(url, signal) {
    if (!sheet || sheet.url !== url) {
      const entry = { url, pixels: readSheet(url, signal).then(pixels => { if (!pixels && sheet === entry) sheet = null; return pixels; }) };
      sheet = entry;
    }
    return sheet.pixels;
  }

  // The photograph as displayed, for its tone: on a canvas of PLATE_TONE_DENSITY px per css px
  // (the darkness changes slowly beside the hatching, so a 3x screen needs no 3x tone field),
  // whose first read is cheap. The file is decoded again here, off the main thread, at the
  // tone field's size and without colour management (luminance needs none), at the crop the
  // helper uses (SiteLensesMedia.plan): a few ms to read. The helper's canvas holds the photo
  // too, but Chrome converts an image's embedded colour profile lazily, so the first read of
  // that canvas converts the whole photo on the main thread (5–15 ms for a gallery photo at
  // 2x): it is the fallback (job.photo, when the helper made the job), then the displayed
  // image itself. One canvas serves every plate (the press makes them one at a time).
  // job: { img, width, height (device px), cssWidth, cssHeight, photo }. Returns { g, w, h }:
  // the tone canvas's 2D context and size, or null when the signal aborted.
  let toneCanvas = null;
  async function photoPixels(job, signal) {
    const { img, width: W, height: H } = job;
    const f = Math.min(1, PLATE_TONE_DENSITY[job.dpr >= 2 ? 1 : 0] / job.dpr);
    const w = Math.max(1, Math.round(W * f)); const h = Math.max(1, Math.round(H * f));
    const kit = window.SiteLensesMedia;
    let bitmap = null; let at = null; let p = null;
    try {
      const s = getComputedStyle(img);
      p = kit && typeof kit.plan === 'function'
        ? kit.plan(img, job.cssWidth, job.cssHeight, window.devicePixelRatio || 1, { objectFit: s.objectFit, objectPosition: s.objectPosition }) : null;
      if (p && (p.empty || p.width !== W || p.height !== H)) p = null;       // not this canvas's crop
      if (p && !p.whole && typeof createImageBitmap === 'function') {
        const response = await fetch(img.currentSrc || img.src, { cache: 'force-cache', credentials: 'same-origin' });
        if (response.ok && !signal.aborted) {
          bitmap = await createImageBitmap(await response.blob(), Math.round(p.sx), Math.round(p.sy), Math.round(p.sw), Math.round(p.sh), {
            imageOrientation: 'from-image', resizeWidth: Math.max(1, Math.round(p.dw * f)), resizeHeight: Math.max(1, Math.round(p.dh * f)),
            resizeQuality: 'high', colorSpaceConversion: 'none'
          });
          at = [Math.round(p.dx * f), Math.round(p.dy * f)];
        }
      }
    } catch (error) { bitmap = null; }
    if (signal.aborted) { if (bitmap) bitmap.close(); return null; }
    toneCanvas = toneCanvas || document.createElement('canvas');
    toneCanvas.width = w; toneCanvas.height = h;          // also clears it
    const g = toneCanvas.getContext('2d', { willReadFrequently: true });
    try {
      if (bitmap) g.drawImage(bitmap, at[0], at[1]);
      else if (job.photo) g.drawImage(job.photo, 0, 0, w, h);                // the helper's canvas
      else if (p && p.whole) g.drawImage(img, 0, 0, w, h);
      else if (p) g.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx * f, p.dy * f, p.dw * f, p.dh * f);
      else g.drawImage(img, 0, 0, w, h);
    } catch (error) { /* not drawable: an empty field, a blank engraving */ }
    if (bitmap) bitmap.close();
    return { g, w, h };
  }

  // The share of a pixel that a hatch line covers: the overlap of the pixel, one device px
  // across the line and centred d px from the line's centre, with the line, half px on either
  // side of its centre. A line thinner than a pixel covers at most twice its half-width, so
  // the lightest tones fade out line by line instead of ending in a visible contour.
  const cover = (half, d) => (d + 0.5 < half ? d + 0.5 : half) - (d - 0.5 > -half ? d - 0.5 : -half);

  // A photograph as a copperplate engraving on a rectangular plate, drawn into the job's
  // canvas (job.canvas: W×H device px, k device px per css px). The darkness comes from the
  // portrait's tone pipeline, run on the photo in `tone` ({ g, w, h }: its canvas at the tone
  // field's size) and read back bilinearly; each pixel's ink is its coverage by the nearest
  // line of each hatch, a line whose half-width follows the darkness there (the portrait's
  // swelling lines, drawn per pixel so the work can be sliced), composited over the paper
  // tile at the plate's place on the sheet (origin, the image's content box in document css
  // px) with a faint plate tone; then the double rule (only its inner rule when the image has
  // a border of its own, which stands for the outer one). Returns the plate's canvas.
  function* plateSteps(tone, job, paperPx, origin, bordered) {
    const { width: W, height: H, dpr: k } = job;
    const { g: tg, w, h } = tone;
    const alloc = scratch.begin();
    // Luminance, read in bands; a see-through pixel counts as paper.
    const lum = alloc(w * h);
    for (let y0 = 0; y0 < h; y0 += PLATE_BAND) {
      const rows = Math.min(PLATE_BAND, h - y0);
      const px = tg.getImageData(0, y0, w, rows).data;
      for (let i = 0, j = y0 * w; i < px.length; i += 4, j++) {
        lum[j] = 1 - (px[i + 3] / 255) * (1 - (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255);
      }
      yield;
    }
    const radius = Math.max(1, Math.round(PLATE_RADIUS * Math.min(w, h)));
    const field = yield* toneSteps(lum, w, h, { radius, contrast: PLATE_CONTRAST, gamma: PLATE_GAMMA, pool: Math.max(1, Math.floor(radius / 6)), alloc });
    // The plate is drawn into the job's canvas (the helper's, which holds the photo, or a
    // fresh one). Clearing all of it first lets the canvas drop a photo it holds unread (no
    // colour conversion is paid for it).
    const { canvas, ctx2d: g } = job;
    g.clearRect(0, 0, W, H);
    // Where each plate pixel reads the tone field (bilinear; the identity at the same size).
    const fx0 = new Int32Array(W); const fx1 = new Int32Array(W); const ftx = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / W - 0.5));
      fx0[x] = sx | 0; fx1[x] = Math.min(w - 1, fx0[x] + 1); ftx[x] = sx - fx0[x];
    }
    const darkRow = new Float32Array(W);

    // The three hatches in device px, their lines anchored at the plate's centre: as wide
    // apart as PLATE_SCALE on a gallery photo, as the portrait's on a small vignette.
    const cx = W / 2; const cy = H / 2;
    const size = Math.sqrt(job.cssWidth * job.cssHeight);
    const scale = 1 + (PLATE_SCALE - 1) * clamp01((size - PLATE_SMALL[0]) / (PLATE_SMALL[1] - PLATE_SMALL[0]));
    // The third hatch joins later than on the portrait (PLATE_THIRD). The main hatch's lines
    // swell by up to `swell` in the deepest shadows (a half-width of spacing / 2 + 0.5 px would
    // cover every pixel up to the next line; PLATE_SHUT of it leaves a thin white line).
    const hatches = HATCHES.map((hatch, i) => {
      const a = (hatch.angle * Math.PI) / 180;
      const spacing = Math.max(hatch.spacing * scale * k, (MIN_SPACING * hatch.spacing) / HATCHES[0].spacing);
      const from = i === 2 ? PLATE_THIRD : hatch.from;
      const maxHalf = hatch.width * PLATE_WEIGHT * spacing;
      return { nx: -Math.sin(a), ny: Math.cos(a), spacing, inv: 1 / spacing, maxHalf, from, span: hatch.to - from, u0: 0,
        swell: i === 0 ? Math.max(0, (spacing / 2 + 0.5) * PLATE_SHUT - maxHalf) : 0 };
    });
    const [h0, h1, h2] = hatches;
    const minHalf = PLATE_MIN_HALF * k;
    const [close0, close1] = PLATE_CLOSE;
    // The engraving's inset: the two rules, the gap between them and the margin inside.
    const ruleOuter = PLATE_RULE_OUTER * k; const ruleInner = PLATE_RULE_INNER * k;
    const innerAt = ruleOuter + PLATE_RULE_GAP * k;
    const inset = Math.round(innerAt + ruleInner + PLATE_MARGIN * k);

    // The paper under each column and row (nearest tile pixel).
    const { data: P, n, k: pk } = paperPx;
    const col = new Int32Array(W); const row = new Int32Array(H);
    const wrap = v => ((v % n) + n) % n;
    for (let x = 0; x < W; x++) col[x] = wrap(Math.floor((origin.x + (x + 0.5) / k) * pk)) * 4;
    for (let y = 0; y < H; y++) row[y] = wrap(Math.floor((origin.y + (y + 0.5) / k) * pk)) * n * 4;
    const [ir, ig, ib] = INK_RGB;

    const out = g.createImageData(W, Math.min(PLATE_BAND, H));
    const o = out.data;
    for (let y0 = 0; y0 < H; y0 += PLATE_BAND) {
      const rows = Math.min(PLATE_BAND, H - y0);
      for (let y = y0; y < y0 + rows; y++) {
        const engraved = y >= inset && y < H - inset;
        const py = y + 0.5 - cy;
        if (engraved) {
          // This row of the darkness, read from the tone field.
          const sy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / H - 0.5)); const ya = (sy | 0) * w; const yb = Math.min(h - 1, (sy | 0) + 1) * w; const ty = sy - (sy | 0);
          for (let x = 0; x < W; x++) {
            const a = field[ya + fx0[x]]; const b = field[ya + fx1[x]];
            const top = a + (b - a) * ftx[x];
            const c = field[yb + fx0[x]];
            darkRow[x] = top + (c + (field[yb + fx1[x]] - c) * ftx[x] - top) * ty;
          }
        }
        for (const hatch of hatches) hatch.u0 = hatch.nx * (0.5 - cx) + hatch.ny * py;
        for (let x = 0, q = (y - y0) * W * 4; x < W; x++, q += 4) {
          let keep = 1;
          if (engraved && x >= inset && x < W - inset) {
            const v = darkRow[x];
            // Hatch by hatch: tone in its window, half-width (the main hatch swells in the
            // deepest shadows), distance to its nearest line.
            let t = (v - h0.from) / h0.span;
            if (t > 0) {
              const half = h0.maxHalf * (t < 1 ? t : 1) + (v > close0 ? h0.swell * smooth(close0, close1, v) : 0);
              if (half >= minHalf) { const u = h0.u0 + h0.nx * x; const c = cover(half, Math.abs(u - h0.spacing * Math.round(u * h0.inv))); if (c > 0) keep *= c >= 1 ? 0 : 1 - c; }
            }
            t = (v - h1.from) / h1.span;
            if (t > 0) {
              const half = h1.maxHalf * (t < 1 ? t : 1);
              if (half >= minHalf) { const u = h1.u0 + h1.nx * x; const c = cover(half, Math.abs(u - h1.spacing * Math.round(u * h1.inv))); if (c > 0) keep *= c >= 1 ? 0 : 1 - c; }
            }
            t = (v - h2.from) / h2.span;
            if (t > 0) {
              const half = h2.maxHalf * (t < 1 ? t : 1);
              if (half >= minHalf) { const u = h2.u0 + h2.nx * x; const c = cover(half, Math.abs(u - h2.spacing * Math.round(u * h2.inv))); if (c > 0) keep *= c >= 1 ? 0 : 1 - c; }
            }
          }
          // Paper, toned by the plate, then the ink over it.
          const p = row[y] + col[x];
          const pr = P[p] + (ir - P[p]) * PLATE_TONE; const pg = P[p + 1] + (ig - P[p + 1]) * PLATE_TONE; const pb = P[p + 2] + (ib - P[p + 2]) * PLATE_TONE;
          const a = 1 - keep;
          o[q] = pr + (ir - pr) * a; o[q + 1] = pg + (ig - pg) * a; o[q + 2] = pb + (ib - pb) * a; o[q + 3] = 255;
        }
        yield;
      }
      g.putImageData(out, 0, y0, 0, 0, W, rows);
      yield;
    }

    // The double rule: a thick outer rule at the edge, a thin inner one. A rule thinner than
    // a device pixel is drawn one pixel wide, lighter.
    const frame = (at, width) => {
      const px = Math.max(1, Math.round(width)); const x0 = Math.round(at);
      g.globalAlpha = Math.min(1, width / px);
      g.fillRect(x0, x0, W - 2 * x0, px);
      g.fillRect(x0, H - x0 - px, W - 2 * x0, px);
      g.fillRect(x0, x0 + px, px, H - 2 * x0 - 2 * px);
      g.fillRect(W - x0 - px, x0 + px, px, H - 2 * x0 - 2 * px);
    };
    g.save();
    g.fillStyle = `rgb(${INK_RGB.join(',')})`;
    if (!bordered) frame(0, ruleOuter);
    frame(innerAt, ruleInner);
    g.restore();
    scratch.end();
    return canvas;
  }

  // Whether an element lies in a position: fixed box (the lightbox).
  function inFixedBox(el) {
    for (; el && el !== document.body && el !== html; el = el.parentElement) if (getComputedStyle(el).position === 'fixed') return true;
    return false;
  }
  // An image's content box in viewport px (its box less border and padding), and whether it
  // has a border of its own.
  function contentBox(img, r = img.getBoundingClientRect(), s = getComputedStyle(img)) {
    const px = name => parseFloat(s[name]) || 0;
    const left = r.left + px('borderLeftWidth') + px('paddingLeft'); const top = r.top + px('borderTopWidth') + px('paddingTop');
    return {
      left, top, width: r.right - px('borderRightWidth') - px('paddingRight') - left, height: r.bottom - px('borderBottomWidth') - px('paddingBottom') - top,
      bordered: ['Top', 'Right', 'Bottom', 'Left'].some(side => px(`border${side}Width`) > 0)
    };
  }
  const plateSources = new WeakMap();        // plate canvas -> the src (img.src) it was engraved from

  /* ---------- the press ---------- */

  // Every plate is engraved by the press, one at a time, the photograph nearest the reader
  // first. Before each plate it measures every photograph waiting again (the gallery's
  // masonry moves its photos as they load, so a distance measured earlier is stale): the
  // lightbox's photo first, then the photographs in the viewport, nearest its middle first,
  // then the others, nearest the viewport first. Two kinds of job:
  //   a print   an expected photograph within PRESS_NEAR screens of the viewport, before the
  //             helper has asked for it: engraved at the size the helper will ask for (its
  //             plan) and shown at once on the photograph's blank plate, in this lens's page
  //             layer. The reader never waits for the helper's own order (it decodes each
  //             photo before asking for it, nearest first by a distance it measured when the
  //             photo came near). When the helper asks for that photograph at that size, the
  //             print is handed over as its plate (render() returns it) and leaves the blank.
  //   a render  a photograph the helper asks for without a print of its size (the lightbox's
  //             photo, a photograph drawn again after a resize, a photo outside photos/):
  //             render() waits for it, so the helper's earlier plate stays until it is done.
  const FAR = 1e6;                           // a rank beyond any in the viewport
  // A job's rank: lower is pressed first.
  function rankOf(img, pinned) {
    if (pinned) return -1;
    const r = img.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) return Math.abs(r.top + r.height / 2 - innerHeight / 2);
    return FAR + Math.max(r.top - innerHeight, -r.bottom, 0);
  }
  // The expected photographs the press may print now: loaded, shown, within PRESS_NEAR screens,
  // plateable, with no plate, print or job yet, and not released. Needs the helper's plan
  // (the kit), so that the print has the size the helper will ask for.
  function printables(st) {
    const main = document.getElementById('main-content');
    const kit = window.SiteLensesMedia;
    if (!main || st.plateless || !kit || typeof kit.plan !== 'function') return [];
    const reach = PRESS_NEAR * innerHeight;
    const out = [];
    for (const img of main.querySelectorAll(EXPECT_SELECT)) {
      if (st.plated.has(img) || st.prints.has(img) || st.decided.has(img) || !img.complete || !img.naturalWidth) continue;
      if (st.released.has(img.getAttribute('src')) || !img.getClientRects().length) continue;
      const r = img.getBoundingClientRect();
      if (r.width < 24 || r.height < 24 || r.bottom < -reach || r.top > innerHeight + reach) continue;
      if (!plateable(img, r, getComputedStyle(img))) continue;
      let asked = false;
      for (const job of st.jobs) if (job.img === img) { asked = true; break; }
      if (!asked) out.push(img);
    }
    return out;
  }
  // Whether an expected photograph in the viewport is still loading (a lazy photo not loaded
  // yet has no height: its place in the viewport counts).
  function loadingInView(st) {
    const main = document.getElementById('main-content');
    for (const img of main ? main.querySelectorAll(EXPECT_SELECT) : []) {
      if (img.complete || st.released.has(img.getAttribute('src')) || !img.getClientRects().length) continue;
      const r = img.getBoundingClientRect();
      if (r.bottom >= 0 && r.top <= innerHeight && r.right > 0 && r.left < innerWidth) return true;
    }
    return false;
  }
  // A print of img: a canvas of the helper's size for it (SiteLensesMedia.plan of its content box).
  function printJob(st, img) {
    const s = getComputedStyle(img);
    const box = contentBox(img, img.getBoundingClientRect(), s);
    const p = window.SiteLensesMedia.plan(img, box.width, box.height, window.devicePixelRatio || 1, { objectFit: s.objectFit, objectPosition: s.objectPosition });
    const canvas = document.createElement('canvas');
    canvas.width = p.width; canvas.height = p.height;
    canvas.className = 'lens-acta-print';
    canvas.setAttribute('aria-hidden', 'true');
    const job = newJob(st, { img, width: p.width, height: p.height, dpr: p.ratio, cssWidth: box.width, cssHeight: box.height,
      canvas, ctx2d: canvas.getContext('2d'), photo: null, pinned: false, print: true });
    st.prints.set(img, job);
    return job;
  }
  function newJob(st, fields) {
    const job = { ...fields, src: fields.img.src, plate: null, done: false, inkedAt: null, resolve: null, promise: null };
    job.promise = new Promise(resolve => { job.resolve = resolve; });
    st.pending.add(job);
    return job;
  }
  // The next job: the best ranked of the helper's and of the photographs to print.
  function nextJob(st) {
    let best = null; let bestRank = Infinity;
    for (const job of st.jobs) { const rank = rankOf(job.img, job.pinned); if (rank < bestRank) { best = job; bestRank = rank; } }
    let print = null;
    for (const img of printables(st)) { const rank = rankOf(img, false); if (rank < bestRank) { print = img; bestRank = rank; } }
    // Nothing outside the viewport is begun while a photograph in it is still loading (its
    // load wakes the press), for PRESS_HOLD_MS at most.
    if (bestRank >= FAR && (print || best) && loadingInView(st)) {
      const now = performance.now();
      if (!st.holdSince) st.holdSince = now;
      const left = st.holdSince + PRESS_HOLD_MS - now;
      if (left > 0) { clearTimeout(st.holdTimer); st.holdTimer = setTimeout(() => press(st), left + 5); return null; }
    } else st.holdSince = 0;
    const job = print ? printJob(st, print) : best;
    if (!print && best) st.jobs.delete(best);
    if (job) {
      pressLog.push({ at: Math.round(performance.now()), src: decodeURIComponent(job.src.split('/').pop()), print: job.print, rank: Math.round(bestRank) });
      if (pressLog.length > 64) pressLog.shift();
    }
    return job;
  }
  const pressLog = [];                       // the last picks (read by tests/browser_lens_acta.js)
  // Runs the press until no job is left (it is started again by the helper's renders, the
  // photos' loads, layout changes and scrolling).
  function press(st) {
    if (st.pressing || st.ctx.signal.aborted || state !== st || st.plateless) return;
    st.pressing = true;
    (async () => {
      try {
        for (;;) {
          if (st.ctx.signal.aborted || state !== st) break;
          const job = nextJob(st);
          if (!job) break;
          let plate = null;
          try { plate = await pressJob(st, job); } catch (error) { plate = null; }
          finishJob(st, job, plate);
        }
      } finally { st.pressing = false; }
    })();
  }
  // A photograph as a plate, on the paper at its place on the sheet: the page's sheet (the
  // html background) starts at the document's origin, the lightbox's at the viewport's.
  async function pressJob(st, job) {
    const { signal } = st.ctx;
    const made = await st.paperReady;
    const paperPx = made && !signal.aborted ? await sheetFor(made.url, signal) : null;
    if (!paperPx || signal.aborted || !job.img.isConnected) return null;
    const box = contentBox(job.img);
    const origin = { x: box.left + (job.pinned ? 0 : scrollX), y: box.top + (job.pinned ? 0 : scrollY) };
    const began = performance.now();
    const tone = await photoPixels(job, signal);
    if (!tone) return null;
    job.photo = null;
    const plate = await runSliced(plateSteps(tone, job, paperPx, origin, box.bordered), signal, job.print ? 'print' : 'plate');
    if (plate) {
      const ms = performance.now() - began;
      stats.plates++; stats.plateMs += ms; if (ms > stats.plateMaxMs) stats.plateMaxMs = ms;
    }
    return plate;
  }
  function finishJob(st, job, plate) {
    st.pending.delete(job);
    job.done = true; job.plate = plate;
    if (plate) { plateSources.set(plate, job.src); st.plated.add(job.img); }
    if (job.print) {
      if (plate) { st.decided.add(job.img); attachPrint(st, job); }
      else if (st.prints.get(job.img) === job) st.prints.delete(job.img);
      if (st.onDecided) st.onDecided();
    }
    job.resolve(plate);
  }

  // A finished print on its photograph's blank (once there is one: placeBlanks calls this too),
  // above the blank's rules; inked in when the style is already on.
  function attachPrint(st, job) {
    const blank = st.blanks.get(job.img);
    if (!blank || !job.plate || job.plate.parentNode === blank) return;
    blank.appendChild(job.plate);
    st.inked.add(job.img);
    if (st.switched && !st.ctx.motion.matches) { inkIn(job.plate); job.inkedAt = performance.now(); }
  }
  function dropPrint(st, job) {
    if (st.prints.get(job.img) === job) st.prints.delete(job.img);
    if (job.plate && !st.handed.has(job.plate)) { job.plate.remove(); job.plate.width = job.plate.height = 0; }
  }
  // The ink-in fade (acta.css), once: the class goes when it ends, so a plate the helper shows
  // again (scrolled back into view) does not ink in a second time.
  function inkIn(canvas) {
    canvas.classList.add('lens-acta-inking');
    canvas.addEventListener('animationend', () => { canvas.classList.remove('lens-acta-inking'); canvas.style.animationDelay = ''; }, { once: true });
  }

  // The media helper's render(): a photograph becomes a plate (its print, or a job of the
  // press); a graphic, or an image whose pixels may not be read, is left to the sepia plate of
  // acta.css (null: no overlay), and released if it was expected to become a plate.
  function renderPlate(st, source) {
    const { img } = source;
    if (source.kind !== 'photo' || !source.readable || st.ctx.signal.aborted) { decide(st, img, null); return null; }
    const print = st.prints.get(img);
    if (print && print.src === img.src && print.width === source.width && print.height === source.height) {
      source.canvas.width = source.canvas.height = 0;            // the helper's drawing is not needed
      return print.promise.then(plate => {
        if (plate && st.prints.get(img) === print) { st.prints.delete(img); plate.remove(); st.handed.set(plate, print); }
        decide(st, img, plate);
        return plate;
      });
    }
    const job = newJob(st, { img, width: source.width, height: source.height, dpr: source.dpr, cssWidth: source.cssWidth, cssHeight: source.cssHeight,
      canvas: source.canvas, ctx2d: source.ctx2d, photo: source.canvas, pinned: inFixedBox(img), print: false });
    st.jobs.add(job);
    press(st);
    return job.promise.then(plate => { decide(st, img, plate); return plate; });
  }
  function decide(st, img, plate) {
    st.decided.add(img);
    if (plate) st.plated.add(img);
    else if (!st.ctx.signal.aborted) release(st, img);
    if (st.onDecided) st.onDecided();
  }

  /* ---------- activation ---------- */

  // The reader's place on exit: the first block whose bottom is in the viewport, and its offset.
  function readingAnchor() {
    if (scrollY <= 0) return null;
    for (const el of document.querySelectorAll(ANCHORS)) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > 0) return { el, top: r.top };
    }
    return null;
  }
  function realign(anchor) {
    if (!anchor || !anchor.el.isConnected) return;
    const dy = anchor.el.getBoundingClientRect().top - anchor.top;
    if (Math.abs(dy) >= 0.5) window.scrollTo({ top: scrollY + dy, behavior: 'instant' });
  }
  const nextFrame = () => new Promise(resolve => {
    const timer = setTimeout(resolve, 50);
    requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
  });

  // Loads the IM Fell faces once (fetch the Google stylesheet, build FontFaces, load them).
  async function fetchFell() {
    const response = await fetch(FONT_CSS, { credentials: 'omit' });
    const css = response.ok ? await response.text() : '';
    const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => {
      const get = name => { const m = body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`)); return m ? m[1].trim() : ''; };
      const family = get('font-family').replace(/['"]/g, ''); const src = get('src');
      if (!family || !src) return null;
      return new FontFace(family, src, {
        style: get('font-style') || 'normal', weight: get('font-weight') || '400',
        unicodeRange: get('unicode-range') || 'U+0-10FFFF', display: 'block'
      });
    }).filter(Boolean);
    await Promise.all(faces.map(face => face.load()));
    return faces.length ? faces : null;
  }

  // Resolves true once the faces are in document.fonts, false on failure or after `limit` ms.
  // A load that outlasts the limit goes on (fellLoading), for lateFonts() and the next
  // activation; a failed one is tried again by the next activation.
  let fellLoading = null;
  async function loadFonts(signal, limit = FONT_TIMEOUT_MS) {
    if (!fell && typeof FontFace === 'function' && document.fonts) {
      if (!fellLoading) {
        fellLoading = fetchFell().then(faces => { fell = fell || faces; return !!faces; }, () => false)
          .then(ok => { if (!ok) fellLoading = null; return ok; });
      }
      if (!await Promise.race([fellLoading, sleep(limit, signal).then(() => false)])) return false;
    }
    if (!fell || signal?.aborted) return false;
    fell.forEach(face => document.fonts.add(face));
    return true;
  }
  const unloadFonts = () => { if (fell && document.fonts) fell.forEach(face => document.fonts.delete(face)); };
  // The style switched in the fallback serif (lens-acta-fallback): faces that come later are
  // swapped in while the reader is still at the top of the page and has not touched it (the
  // page is then set again in IM Fell, as a page whose fonts arrive late is); otherwise they
  // are kept for the next page.
  function lateFonts(st) {
    if (!fellLoading) return;
    const { signal } = st.ctx;
    let touched = false;
    const touch = () => { touched = true; };
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(type, touch, { capture: true, passive: true, once: true, signal });
    fellLoading.then(ok => {
      if (!ok || !fell || touched || signal.aborted || state !== st || scrollY > 1 || !html.classList.contains(CLS.fallback)) return;
      fell.forEach(face => document.fonts.add(face));
      html.classList.remove(CLS.fallback);
      window.dispatchEvent(new Event('resize'));     // the portrait, drop cap, blanks and caption follow the new type
    });
  }

  // The drop cap's paragraph: the first narrative paragraph of a paper page, elsewhere the
  // first paragraph of running text in main (long, upright, starting with a letter). The
  // homepage has its own rule in acta.css.
  function dropCapParagraph(st) {
    if (st.kind === 'home') return null;
    const main = document.getElementById('main-content');
    if (!main) return null;
    const pick = list => [...list].find(p => {
      if (!shown(p) || p.closest(NOT_PROSE)) return false;
      const text = p.textContent.trim();
      return text.length >= 120 && /^[A-Za-z]/.test(text) && getComputedStyle(p).fontStyle === 'normal';
    });
    return (st.kind === 'paper' && pick(main.querySelectorAll('.narrative p'))) || pick(main.querySelectorAll('p')) || null;
  }

  // A selector for one element of main, by position: #main-content > div:nth-child(2) > p:nth-child(1).
  function pathTo(el) {
    const parts = [];
    for (let node = el; node && node.id !== 'main-content'; node = node.parentElement) {
      if (!node.parentElement) return null;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${[...node.parentElement.children].indexOf(node) + 1})`);
    }
    return `#main-content > ${parts.join(' > ')}`;
  }

  // This lens's own stylesheet (the core attaches it before enter or arrive): the drop cap and
  // the hiding rule are written into it, so they go with it after exit.
  const ownSheet = () => [...document.styleSheets].find(sh => (sh.href || '').includes('easter/lenses/acta.css')) || null;

  // Writes the drop cap rule into this lens's own stylesheet (removed with it after exit).
  function setDropCap(st) {
    const sheet = ownSheet();
    if (!sheet) return;
    const target = dropCapParagraph(st);
    const path = target && pathTo(target);
    if (path === st.dropCapPath) return;
    clearDropCap(st);
    if (!path) return;
    const initial = CSS.supports('initial-letter', '3') || CSS.supports('-webkit-initial-letter', '3');
    const shape = initial
      ? '-webkit-initial-letter: 3; initial-letter: 3; margin-right: 0.14em;'
      : 'float: left; font-size: 4.05em; line-height: 0.8; padding: 0.08em 0.12em 0 0;';
    try {
      // font-size-adjust off: Chrome sizes an initial letter wrongly with it.
      const index = sheet.insertRule(`html.lens-acta ${path}::first-letter { ${shape} font-family: var(--lens-acta-serif); font-style: normal; font-size-adjust: none; color: var(--lens-acta-dropcap); }`, sheet.cssRules.length);
      st.dropCap = { sheet, rule: sheet.cssRules[index] };
      st.dropCapPath = path;
    } catch (error) { /* an odd path: no drop cap */ }
  }
  function clearDropCap(st) {
    if (st.dropCap) {
      const { sheet, rule } = st.dropCap;
      const index = [...sheet.cssRules].indexOf(rule);
      if (index >= 0) sheet.deleteRule(index);
    }
    st.dropCap = null; st.dropCapPath = null;
  }

  /* ---------- blank plates ---------- */

  // The rule that hides the expected photographs (in main and in the lightbox) while the
  // style is on, less the released ones (by their src attribute): rewritten when one is
  // released, absent once the plates are given up (no media helper). opacity, not
  // visibility: the helper skips hidden images.
  function setHideRule(st) {
    clearHideRule(st);
    const sheet = ownSheet();
    if (!sheet || st.plateless) return;
    const released = [...st.released].map(src => `[src="${CSS.escape(src)}"]`);
    const which = `${EXPECT_SELECT}${released.length ? `:not(${released.join(', ')})` : ''}`;
    const selector = `html.${CLS.on} #main-content ${which}, html.${CLS.on} ${LIGHTBOX} ${which}`;
    try {
      const index = sheet.insertRule(`${selector} { opacity: 0; }`, sheet.cssRules.length);
      st.hideRule = { sheet, rule: sheet.cssRules[index] };
    } catch (error) { givePlatesUp(st); }               // an odd src: no blanks, the photos show
  }
  function clearHideRule(st) {
    if (st.hideRule) {
      const { sheet, rule } = st.hideRule;
      const index = [...sheet.cssRules].indexOf(rule);
      if (index >= 0) sheet.deleteRule(index);
    }
    st.hideRule = null;
  }
  function dropBlanks(st) {
    st.blanks.forEach(blank => blank.remove());
    st.blanks.clear();
  }
  // No plates this activation (the media helper is missing or failed): every photo shows.
  function givePlatesUp(st) {
    st.plateless = true;
    clearHideRule(st);
    dropBlanks(st);
  }
  // An expected photograph that will not become a plate shows again, with its sepia plate.
  function release(st, img) {
    const src = img.getAttribute('src');
    if (st.plateless || src === null || st.released.has(src) || !img.matches(EXPECT_SELECT)) return;
    st.released.add(src);
    const blank = st.blanks.get(img);
    if (blank) { blank.remove(); st.blanks.delete(img); }
    const print = st.prints.get(img);
    if (print) dropPrint(st, print);
    setHideRule(st);
  }

  // Whether the helper will make a plate of this expected photograph, as far as its own skips
  // go (media.js): not broken, not visibility: hidden, at least 24 css px once loaded, not in
  // a fixed box, and not in a clipping or scrolling box (a blank there would not be clipped
  // as the helper clips its overlay). r: the image's box.
  const boxed = new WeakMap();
  function plateable(img, r, s) {
    if (img.complete && !img.naturalWidth) return false;
    if (s.visibility === 'hidden') return false;
    if (img.complete && (r.width < 24 || r.height < 24)) return false;
    if (!boxed.has(img)) {
      let inBox = false;
      for (let el = img; el && el !== document.body && el !== html; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || (el !== img && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible'))) { inBox = true; break; }
      }
      boxed.set(img, inBox);
    }
    return !boxed.get(img);
  }

  // The blanks' double rule, snapped to device pixels as plateSteps() draws the plates' (a rule
  // thinner than a device pixel is one pixel wide, lighter), so a plate inks in over its blank
  // without a rule doubling: custom properties on the layer, read by acta.css.
  function blankRules(layer) {
    const k = window.devicePixelRatio || 1;
    const rule = width => { const px = Math.max(1, Math.round(width * k)); return { css: `${px / k}px`, alpha: +Math.min(1, (width * k) / px).toFixed(3) }; };
    const outer = rule(PLATE_RULE_OUTER); const inner = rule(PLATE_RULE_INNER);
    const values = {
      '--lens-acta-rule-outer': outer.css, '--lens-acta-rule-outer-alpha': outer.alpha,
      '--lens-acta-rule-at': `${Math.round((PLATE_RULE_OUTER + PLATE_RULE_GAP) * k) / k}px`,
      '--lens-acta-rule-inner': inner.css, '--lens-acta-rule-inner-alpha': inner.alpha, '--lens-acta-plate-tone': PLATE_TONE
    };
    for (const [name, value] of Object.entries(values)) layer.style.setProperty(name, String(value));
  }

  // A blank plate on every expected photograph that is shown (a lazy photo not yet loaded has
  // no size: it gets its blank when it takes its space), on its content box, in this lens's
  // page layer, below the helper's plates; called at the switch and whenever the layout may
  // have moved. A finished print lies on its blank. Releases the photos the helper would skip.
  function placeBlanks(st) {
    if (st.plateless) return;
    blankRules(st.page);
    const main = document.getElementById('main-content');
    const o = st.page.getBoundingClientRect();
    const kept = new Set();
    for (const img of main ? main.querySelectorAll(EXPECT_SELECT) : []) {
      if (st.released.has(img.getAttribute('src')) || !img.getClientRects().length) continue;
      const r = img.getBoundingClientRect(); const s = getComputedStyle(img);
      if (!plateable(img, r, s)) { release(st, img); continue; }
      const { left, top, width, height, bordered } = contentBox(img, r, s);
      if (width < 1 || height < 1) continue;
      let blank = st.blanks.get(img);
      if (!blank) {
        blank = document.createElement('div');
        blank.className = 'lens-acta-blank';
        blank.setAttribute('aria-hidden', 'true');
        st.page.appendChild(blank);
        st.blanks.set(img, blank);
      }
      blank.classList.toggle('is-bordered', bordered);
      Object.assign(blank.style, { left: `${left - o.left}px`, top: `${top - o.top}px`, width: `${width}px`, height: `${height}px`, borderRadius: s.borderRadius });
      const print = st.prints.get(img);
      if (print && print.done) attachPrint(st, print);
      kept.add(img);
    }
    st.blanks.forEach((blank, img) => { if (!kept.has(img)) { blank.remove(); st.blanks.delete(img); } });
  }

  // Puts the engraving over the (hidden) photo; called whenever the layout may have moved.
  function placePortrait(st) {
    const photo = document.querySelector('#main-content .profile-photo');
    if (!photo || !photo.getClientRects().length) { if (st.portrait) st.portrait.style.display = 'none'; return; }
    const r = photo.getBoundingClientRect();
    const o = st.page.getBoundingClientRect();
    const canvas = engrave(photo, r.width, r.height);
    if (!canvas) { html.classList.remove(CLS.portrait); return; }
    if (st.portrait !== canvas) { st.portrait?.remove(); st.portrait = canvas; st.page.appendChild(canvas); }
    Object.assign(canvas.style, { display: 'block', left: `${r.left - o.left}px`, top: `${r.top - o.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    html.classList.add(CLS.portrait);
  }

  // The style switch itself: classes, paper, portrait. The synthetic resize lets the core
  // re-place its caption beside the name, whose width changes with the new font.
  // Scroll: the browser's own anchoring is off (lens-acta-hold) while the lens is on, so
  // entering keeps the scroll offset (the trigger, the name, is at the top of the page).
  // Leaving returns to the exact offset when the reader did not scroll, and otherwise keeps
  // the block they were reading in place.
  // The plates (the media helper's overlays) are visible only while html.lens-acta is on
  // (acta.css), so they come and go with the style; after the switch they are placed again at
  // once, since the type has reflowed.
  function apply(st, on) {
    if (on) {
      if (paper) rootVar.set(`url("${paper.url}")`);  // else the flat ground until laterPaper()
      setDropCap(st);
      html.classList.add(CLS.on);
      st.scrollAfter = scrollY;                // the offset an untouched exit returns from
      placePortrait(st);
      placeBlanks(st);
      st.switched = true;
      if (st.media) st.media.refresh();
    } else {
      const untouched = st.scrollAfter !== null && Math.abs(scrollY - st.scrollAfter) < 1;
      const anchor = untouched ? null : readingAnchor();
      html.classList.remove(CLS.on, CLS.portrait);
      rootVar.restore();
      if (st.portrait) st.portrait.style.display = 'none';
      st.vignette.classList.remove('is-on');
      if (untouched) window.scrollTo({ top: st.scrollBefore, behavior: 'instant' });
      else realign(anchor);
    }
    window.dispatchEvent(new Event('resize'));
  }

  // Runs the switch inside a view transition styled by acta.css (the band), or through the
  // paper veil when view transitions are unavailable.
  async function transition(st, on, signal) {
    if (typeof document.startViewTransition === 'function') {
      const cls = on ? CLS.vtIn : CLS.vtOut;
      html.classList.add(cls);
      let vt;
      try {
        vt = document.startViewTransition(() => apply(st, on));
      } catch (error) {
        html.classList.remove(cls);
        apply(st, on);
        return;
      }
      st.vt = vt;
      // A skipped transition rejects these; the switch itself still happens.
      vt.ready.catch(() => {});
      vt.updateCallbackDone.catch(() => {});
      const skip = () => vt.skipTransition();
      signal?.addEventListener('abort', skip, { once: true });
      await vt.finished.catch(() => {});
      signal?.removeEventListener('abort', skip);
      if (st.vt === vt) st.vt = null;
      html.classList.remove(cls);
      return;
    }
    st.veil.classList.add('is-on');
    await sleep(VEIL_IN_MS, signal);
    apply(st, on);
    st.veil.classList.remove('is-on');
    await sleep(signal?.aborted ? 0 : VEIL_OUT_MS, signal);
  }

  function bind(st) {
    const { signal } = st.ctx;
    if (signal.aborted) return;                // a reset arrived during the transition
    let pending = false;
    // Re-place the engraving and the blanks, and find the drop cap's paragraph again, when the
    // layout or the content moves (resize, late markdown, lazy photos, toggled details, demos),
    // once per frame.
    const update = () => {
      pending = false;
      if (state === st && html.classList.contains(CLS.on)) { setDropCap(st); placePortrait(st); placeBlanks(st); }
      return false;
    };
    const schedule = () => { if (!pending && !signal.aborted) { pending = true; st.ctx.frame(update); } };
    window.addEventListener('resize', schedule, { passive: true, signal });
    if (typeof st.ctx.onContentChange === 'function') st.ctx.onContentChange(schedule);
    // Layout that moves without a DOM change or a change of main's size: photos loading above
    // the portrait or the drop cap, fonts arriving, a toggled <details>.
    if (typeof st.ctx.onLayoutChange === 'function') st.ctx.onLayoutChange(schedule);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      const main = document.getElementById('main-content');
      if (main) observer.observe(main);
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    }
  }

  // The print matrix as an SVG filter (#lens-acta-print): the whole of a paper page goes
  // through it, and the images of the other pages (a filter, unlike mix-blend-mode, also
  // prints white as paper inside a box that isolates its blending, such as a transformed one).
  function printFilter() {
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'svg');
    defs.setAttribute('class', 'lens-acta-defs'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', PRINT_ID); filter.setAttribute('color-interpolation-filters', 'sRGB');
    const matrix = document.createElementNS(ns, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix'); matrix.setAttribute('values', printMatrix());
    filter.appendChild(matrix); defs.appendChild(filter);
    return defs;
  }

  // The activation's layers, the print filter, the page-kind classes and the hiding rule.
  function build(ctx) {
    const kind = pageKind(ctx);
    scratch.clear();                         // an abandoned plate may have left it taken
    const st = {
      ctx, kind, vt: null, portrait: null, scrollBefore: scrollY, scrollAfter: null, dropCap: null, dropCapPath: null,
      paperReady: null, media: null, switched: false, inked: new WeakSet(), decided: new WeakSet(), onDecided: null,
      blanks: new Map(), released: new Set(), hideRule: null, lbRule: null, plateless: false, captionReady: false,
      // the press: the helper's jobs waiting, every job not finished, the prints by photograph
      // (until handed over), the prints handed over (by canvas), the photographs with a plate
      jobs: new Set(), pending: new Set(), prints: new Map(), handed: new WeakMap(), plated: new WeakSet(), pressing: false, poke: 0,
      holdSince: 0, holdTimer: 0
    };
    state = st;
    // The press wakes when a photo loads, when the layout moves and soon after a scroll.
    const { signal } = ctx;
    const poke = () => { if (!st.poke && !signal.aborted) st.poke = setTimeout(() => { st.poke = 0; press(st); }, PRESS_POKE_MS); };
    window.addEventListener('scroll', poke, { passive: true, signal });
    document.addEventListener('load', event => { if (event.target instanceof HTMLImageElement) press(st); }, { capture: true, passive: true, signal });
    if (typeof ctx.onLayoutChange === 'function') ctx.onLayoutChange(poke);
    signal.addEventListener('abort', () => {
      clearTimeout(st.poke); clearTimeout(st.holdTimer);
      st.pending.forEach(job => job.resolve(null));            // the helper's renders return
      st.pending.clear(); st.jobs.clear();
    }, { once: true });
    // The page layer (portrait, blanks, the print filter) is made before the helper's, so the
    // plates lie above the blanks; the fixed layer (the vignette) is lifted above both, so the
    // plates take the vignette like the paper does.
    st.page = ctx.layer('page');
    const fixed = ctx.layer('fixed');
    fixed.style.zIndex = '901';
    st.vignette = document.createElement('div'); st.vignette.className = 'lens-acta-vignette';
    st.veil = document.createElement('div'); st.veil.className = 'lens-acta-veil';
    fixed.append(st.vignette, st.veil);
    st.page.appendChild(printFilter());
    html.classList.add(kind === 'paper' ? CLS.paper : CLS.shell);
    if (kind === 'home') html.classList.add(CLS.home);
    setHideRule(st);
    return st;
  }

  // Resolves once every image in the viewport that may become a plate has been engraved or
  // declined by renderPlate(), so the band reveals finished plates (or at once on abort).
  function visiblePlates(st) {
    const waiting = () => {
      const out = [];
      for (const root of st.ctx.scope) {
        for (const img of root.querySelectorAll(PLATE_SELECT)) {
          if (st.decided.has(img) || !img.complete || !img.naturalWidth) continue;
          const r = img.getBoundingClientRect();
          if (r.width < 24 || r.height < 24 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
          if (getComputedStyle(img).visibility === 'hidden') continue;
          out.push(img);
        }
      }
      return out;
    };
    return new Promise(resolve => {
      const test = () => { if (st.ctx.signal.aborted || !waiting().length) { st.onDecided = null; resolve(); } };
      st.onDecided = test;
      test();
    });
  }

  // The plates: one media handle for the activation, which also redraws the lightbox's photo
  // (fixed: true). A plate made before the switch appears with the style; one made after it
  // is inked in (acta.css), unless motion is reduced: in the page once per photograph, in the
  // lightbox every time it shows a photograph.
  function startPlates(st) {
    const { ctx } = st;
    if (typeof ctx.media !== 'function') { givePlatesUp(st); return Promise.resolve(null); }
    return ctx.media({ select: PLATE_SELECT, fixed: true, render: source => renderPlate(st, source) }).then(media => {
      if (state !== st || ctx.signal.aborted) return media;
      st.media = media;
      media.each(overlay => {
        const print = st.handed.get(overlay.canvas);
        if (print) {
          // A print handed over: moving it restarted its ink-in, which goes on where it was.
          st.handed.delete(overlay.canvas);
          const left = print.inkedAt === null ? 0 : print.inkedAt + INK_MS - performance.now();
          if (left > 0 && !ctx.motion.matches) { overlay.canvas.style.animationDelay = `${Math.round(left - INK_MS)}ms`; inkIn(overlay.canvas); }
          else overlay.canvas.classList.remove('lens-acta-inking');
          return;
        }
        if (!overlay.fixed) {
          const stale = st.prints.get(overlay.img);       // a print of another size, under this plate
          if (stale && stale.done) dropPrint(st, stale);
          if (st.inked.has(overlay.img)) return;         // drawn again (a resize) or back in view
          st.inked.add(overlay.img);
        }
        if (st.switched && !ctx.motion.matches) inkIn(overlay.canvas);
      });
      watchLightbox(st);
      press(st);                                         // the helper's plan is there now: prints can start
      return media;
    }, () => { givePlatesUp(st); return null; });       // no helper: the sepia plates of acta.css stay
  }

  // The lightbox opens and changes its photograph in place (next, previous). The helper
  // follows it, but until the new plate is engraved it would keep the old plate over the new
  // photograph: the plate of another src is hidden at once (and shown again if its photograph
  // comes back before the next plate is made). Meanwhile the photograph's blank plate stands
  // on the sheet (placeLightboxBlank), placed in the same task as the change, so the next
  // plate inks in over its blank as in the gallery.
  function watchLightbox(st) {
    const box = document.querySelector(LIGHTBOX);
    if (!box || typeof MutationObserver !== 'function') return;
    const { signal } = st.ctx;
    const observer = new MutationObserver(() => {
      for (const overlay of st.media.overlays) {
        if (!overlay.fixed || !plateSources.has(overlay.canvas)) continue;
        overlay.canvas.style.visibility = plateSources.get(overlay.canvas) === overlay.img.src ? '' : 'hidden';
      }
      placeLightboxBlank(st);
    });
    observer.observe(box, { subtree: true, attributes: true, attributeFilter: ['src', 'class'] });
    // A photograph not decoded yet takes its box when its size is known, before it has
    // loaded: the blank follows the box (a ResizeObserver reports it before the next paint).
    const big = box.querySelector('img');
    const sized = big && typeof ResizeObserver === 'function' ? new ResizeObserver(() => placeLightboxBlank(st)) : null;
    if (sized) sized.observe(big);
    if (big) big.addEventListener('load', () => placeLightboxBlank(st), { signal });
    window.addEventListener('resize', () => placeLightboxBlank(st), { passive: true, signal });
    signal.addEventListener('abort', () => { observer.disconnect(); if (sized) sized.disconnect(); }, { once: true });
    placeLightboxBlank(st);
  }

  // The blank plate of a photograph seen in the lightbox: the plate's tone and its double
  // rule, as plateSteps() draws them, in the plate's own pixels (the helper's plan of the
  // photograph's content box), as an SVG image.
  function blankImage(W, H, k, bordered) {
    const rects = [`<rect width="${W}" height="${H}" fill-opacity="${PLATE_TONE}"/>`];
    const frame = (at, width) => {
      const px = Math.max(1, Math.round(width)); const x0 = Math.round(at);
      rects.push(`<g fill-opacity="${Math.min(1, width / px).toFixed(3)}">` +
        `<rect x="${x0}" y="${x0}" width="${W - 2 * x0}" height="${px}"/><rect x="${x0}" y="${H - x0 - px}" width="${W - 2 * x0}" height="${px}"/>` +
        `<rect x="${x0}" y="${x0 + px}" width="${px}" height="${H - 2 * x0 - 2 * px}"/><rect x="${W - x0 - px}" y="${x0 + px}" width="${px}" height="${H - 2 * x0 - 2 * px}"/></g>`);
    };
    if (!bordered) frame(0, PLATE_RULE_OUTER * k);
    frame((PLATE_RULE_OUTER + PLATE_RULE_GAP) * k, PLATE_RULE_INNER * k);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="rgb(${INK_RGB.join(',')})">${rects.join('')}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  // The lightbox's blank plate, as one layer of its background (acta.css: under its hidden
  // photograph and its controls), set through custom properties by a rule in this lens's own
  // sheet: none while it is closed or shows a photograph that will not become a plate.
  function placeLightboxBlank(st) {
    dropRule(st, 'lbRule');
    const box = document.querySelector(LIGHTBOX); const img = box && box.querySelector('img');
    const sheet = ownSheet(); const kit = window.SiteLensesMedia;
    if (!sheet || !img || st.plateless || st.ctx.signal.aborted || !kit || typeof kit.plan !== 'function') return;
    if (!img.matches(EXPECT_SELECT) || st.released.has(img.getAttribute('src')) || !img.naturalWidth || !img.getClientRects().length) return;
    const s = getComputedStyle(img);
    const c = contentBox(img, img.getBoundingClientRect(), s); const b = box.getBoundingClientRect();
    if (c.width < 24 || c.height < 24) return;
    const p = kit.plan(img, c.width, c.height, window.devicePixelRatio || 1, { objectFit: s.objectFit, objectPosition: s.objectPosition });
    const px = v => `${v.toFixed(2)}px`;
    const rule = `html.${CLS.on} ${LIGHTBOX} { --lens-acta-lb-blank: ${blankImage(p.width, p.height, p.ratio, c.bordered)}; ` +
      `--lens-acta-lb-at: ${px(c.left - b.left - box.clientLeft)} ${px(c.top - b.top - box.clientTop)}; --lens-acta-lb-size: ${px(c.width)} ${px(c.height)}; }`;
    try { const index = sheet.insertRule(rule, sheet.cssRules.length); st.lbRule = { sheet, rule: sheet.cssRules[index] }; } catch (error) { /* the bare sheet */ }
  }
  function dropRule(st, name) {
    const held = st[name];
    if (held) { const index = [...held.sheet.cssRules].indexOf(held.rule); if (index >= 0) held.sheet.deleteRule(index); }
    st[name] = null;
  }

  // Fonts, paper, the portrait's engraving and the plates in the viewport, all but the fonts
  // in slices while the fonts load (at most fontLimit ms). Nothing changes on screen until the
  // first three are ready and the tile is decoded (until `by`); the plates are waited for at
  // most plateWait ms more. Arriving (early) without a tile kept from an earlier page, the style
  // does not wait for the tile: it switches on the flat ground, which is the paper's colour
  // (the pre-paint), and the tile is laid under the page once made (laterPaper). False when
  // the activation was abandoned.
  async function prepare(st, { fontLimit, plateWait, by = Infinity, early = false }) {
    const { signal } = st.ctx;
    const kept = paper || storedPaper();
    const making = kept ? Promise.resolve(kept) : makePaper(signal);
    const later = early && !kept;
    st.paperReady = making;
    // The tile decoded before the switch, while the fonts load (on arrival, where the flat
    // ground is already paper coloured, until `by` at the latest: the photos of the page may
    // hold the decoder up).
    const decoded = making.then(tile => {
      if (!tile) return;
      const probe = new Image(); probe.src = tile.url;
      return probe.decode().catch(() => {});
    });
    const plates = startPlates(st);
    press(st);
    const [fonts, made] = await Promise.all([loadFonts(signal, fontLimit), later ? null : making, prepareEngraving(signal)]);
    if (signal.aborted || state !== st || (!later && !made)) return false;
    if (made) paper = made;
    if (!fonts) { html.classList.add(CLS.fallback); lateFonts(st); }
    if (later) making.then(tile => laterPaper(st, tile));
    else await Promise.race([decoded, sleep(Math.max(0, Math.min(FONT_TIMEOUT_MS, by - performance.now())), signal)]);
    if (plateWait > 0) await Promise.race([plates.then(media => media && visiblePlates(st)), sleep(plateWait, signal)]);
    if (signal.aborted || state !== st) return false;
    st.vignette.classList.add('is-on');
    st.scrollBefore = scrollY;
    html.classList.add(CLS.hold);
    return true;
  }
  // The tile made after an early switch: decoded, then laid under the page in one step.
  async function laterPaper(st, tile) {
    if (!tile || st.ctx.signal.aborted || state !== st) return;
    paper = tile;
    const probe = new Image(); probe.src = tile.url;
    await probe.decode().catch(() => {});
    if (!st.ctx.signal.aborted && state === st && html.classList.contains(CLS.on)) rootVar.set(`url("${tile.url}")`);
  }

  // The caption waits for the switch: it is shown once, by the title as Acta sets it, after
  // the band (caption() is null until then; the core asks again while enter() runs).
  async function enter(ctx) {
    const st = build(ctx);
    if (!await prepare(st, { fontLimit: FONT_TIMEOUT_MS, plateWait: PLATE_WAIT_MS })) return;
    if (ctx.motion.matches || document.hidden || ctx.arriving) apply(st, true);
    else await transition(st, true, ctx.signal);
    if (state !== st) return;
    st.captionReady = true;
    st.scrollAfter = scrollY;
    bind(st);
  }

  // A page opened while the lens is on: the ground is already paper (pre-paint rule), so the
  // style switches at once, as soon as the fonts are ready (or ARRIVE_FONT_MS has passed);
  // the photographs show as blank plates, inked in as their engravings are made.
  async function arrive(ctx) {
    const began = performance.now();
    const st = build(ctx);
    if (!await prepare(st, { fontLimit: ARRIVE_FONT_MS, plateWait: 0, by: began + ARRIVE_BY_MS, early: true })) return;
    apply(st, true);
    st.scrollAfter = scrollY;
    bind(st);
    stats.arriveMs = performance.now() - began;
  }

  async function exit(ctx) {
    const st = state;
    if (!st) return;
    if (st.vt) { st.vt.skipTransition(); await st.vt.finished.catch(() => {}); }
    if (html.classList.contains(CLS.on)) {
      if (ctx.instant || ctx.motion.matches || document.hidden) apply(st, false);
      else await transition(st, false, null);
    }
    html.classList.remove(CLS.on, CLS.portrait, CLS.vtIn, CLS.vtOut, CLS.fallback, CLS.home, CLS.shell, CLS.paper);
    rootVar.restore();
    clearDropCap(st);
    clearHideRule(st);
    dropRule(st, 'lbRule');
    st.prints.forEach(job => dropPrint(st, job));
    st.prints.clear();
    dropBlanks(st);
    unloadFonts();
    scratch.clear();
    toneCanvas = null;
    sheet = null;                            // the tile's pixels; read again next time
    st.portrait?.remove();
    // Re-enable scroll anchoring only once the restored layout has been used for a frame.
    if (html.classList.contains(CLS.hold)) { await nextFrame(); html.classList.remove(CLS.hold); }
    if (state === st) state = null;
  }

  const LINE = 'As it might have been printed when Bernoulli named the spira mirabilis.';
  window.SiteLenses?.register({
    id: 'acta',
    order: 4,
    numeral: 'IV',
    label: 'Acta Eruditorum, 1692',
    line: LINE,
    ground: '#f2e8d3',           // laid paper, painted before a page arrives
    css: true,
    enter,
    arrive,
    exit,
    // Null (not yet) until the Acta style is on and the band has passed: the caption shows
    // once, at its place by the title in Acta's type, never first on the page before the band.
    caption: ctx => (state && state.ctx === ctx && state.captionReady ? LINE : null),
    // Test hook: slices (longSlices: over 8 ms) and plates so far (a plate's time runs from
    // its render() call to its last slice, waits included) and the last arrival's time, in ms.
    get _stats() {
      return { slices: stats.slices, longSlices: stats.longSlices, maxSliceMs: +stats.maxSliceMs.toFixed(2), maxStepMs: +stats.maxStepMs.toFixed(2), maxStepAt: stats.maxStepAt, plates: stats.plates,
        avgPlateMs: +(stats.plateMs / Math.max(1, stats.plates)).toFixed(1), maxPlateMs: +stats.plateMaxMs.toFixed(1),
        arriveMs: stats.arriveMs === null ? null : +stats.arriveMs.toFixed(1) };
    },
    // Test hook: the press's last picks: { at (ms), src (file name), print, rank }.
    get _press() { return pressLog.slice(); },
    // Test hook: the press now: helper jobs waiting, jobs not finished, prints not handed over.
    get _pressState() {
      const st = state;
      return st ? { jobs: st.jobs.size, pending: st.pending.size, prints: st.prints.size, pressing: st.pressing, media: st.media ? st.media._state : null } : null;
    }
  });
})();
