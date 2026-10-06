/**
 * Lens IV · Acta Eruditorum, 1692: "As it might have been printed when Bernoulli named the
 * spira mirabilis." (Jacob Bernoulli named the logarithmic spiral in the Acta in 1692.)
 *
 * Any page of the site, set as a 17th-century learned journal: IM Fell English (Google
 * Fonts) with small capitals, a three-line drop cap on the first paragraph of running text,
 * engraved rules, iron-gall ink on laid paper, sepia plates for images, and on the homepage
 * the portrait as a copperplate engraving. No word changes: only fonts, colours and
 * ornaments (acta.css), plus the paper, the engraving and the drop cap rule made here.
 *
 * Site-shell pages (home, site pages, blog posts) are coloured by explicit rules; paper
 * pages, with their own design and many-coloured demos, by one SVG colour matrix that
 * prints white as paper and black as ink (acta.css explains both). Their header becomes a
 * running head.
 *
 * Enter: the fonts load first (no flash of unstyled text), then a soft band of paper colour
 * descends over the page (a view transition whose old and new snapshots are masked on either
 * side of the band), leaving the Acta style above it. Exit: the band rises. Arrive (a page
 * opened while the lens is on): the style switches at once under the pre-painted paper; the
 * tile is kept in sessionStorage, so that is quick. The layout reflows with the fonts; the
 * scroll position is restored on exit if the reader did not scroll. Without view transitions
 * the page crossfades through a paper veil.
 */
(() => {
  'use strict';

  // The band descends in 900 ms and rises in 600 ms: those timings live in acta.css.
  const VEIL_IN_MS = 300;             // fallback without view transitions: veil fades in…
  const VEIL_OUT_MS = 450;            // …and out again
  const FONT_TIMEOUT_MS = 4000;       // give up waiting for the fonts (slow network) after this
  const ARRIVE_FONT_MS = 1500;        // the same on arrival, while the page is still hidden
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
  const PAPER_KEY = 'lenses-acta-paper';   // sessionStorage: the tile as a data URL, per DPR,
                                           // so the next page of the site arrives at once

  // The engraving: luminance-modulated hatching (css px spacing, degrees), clipped to an oval.
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
  const engravings = new Map();       // "W×H" in device px → canvas (or null), kept likewise

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

  // The paper-page colour matrix (sRGB): each channel maps 0 → ink and 1 → paper, so white
  // panels become the sheet, black becomes ink, and colours keep their hue, printed.
  function printMatrix() {
    const rows = PAPER_RGB.map((p, c) => {
      const row = [0, 0, 0, 0, +(INK_RGB[c] / 255).toFixed(4)];
      row[c] = +((p - INK_RGB[c]) / 255).toFixed(4);
      return row;
    });
    return [...rows.flat(), 0, 0, 0, 1, 0].join(' ');
  }

  // Separable box blur of a W×H field (edges clamped).
  function boxBlur(src, W, H, r) {
    if (r < 1) return src;
    const tmp = new Float32Array(W * H); const out = new Float32Array(W * H); const span = 2 * r + 1;
    for (let y = 0; y < H; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = sum / span;
        sum += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        out[y * W + x] = sum / span;
        sum += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
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

  // The paper and the engraving are generators that yield between pieces of work. The enter
  // runs them in slices of SLICE_MS while the fonts load, so no frame is blocked for long;
  // a later resize that needs a new engraving runs it to the end at once.
  function runNow(steps) {
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  }
  async function runSliced(steps, signal) {
    let began = performance.now();
    for (;;) {
      const step = steps.next();
      if (step.done) return step.value;
      if (performance.now() - began > SLICE_MS) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (signal?.aborted) return null;
        began = performance.now();
      }
    }
  }

  /* ---------- laid paper ---------- */

  function* paperSteps() {
    const k = Math.min(window.devicePixelRatio || 1, 2);
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

  // The tile as an image URL: encoded off the main thread (toBlob) where possible, and kept
  // in sessionStorage as a data URL so the next page of the site does not draw it again.
  async function makePaper(signal) {
    const key = `${PAPER_KEY}@${Math.min(window.devicePixelRatio || 1, 2)}`;
    try { const kept = sessionStorage.getItem(key); if (kept && kept.startsWith('data:image/')) return { url: kept }; } catch (error) { /* storage unavailable */ }
    const canvas = await runSliced(paperSteps(), signal);
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
    // Luminance field at the canvas resolution, lightly blurred so line widths swell smoothly.
    const source = document.createElement('canvas');
    source.width = W; source.height = H;
    const sg = source.getContext('2d');
    sg.drawImage(img, 0, 0, W, H);
    let pixels;
    try { pixels = sg.getImageData(0, 0, W, H).data; } catch (error) { return null; }
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = (pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722) / 255;
    const soft = boxBlur(lum, W, H, 1);
    yield;
    // Levels: stretch the 2–98 % range (from a histogram); lift the background away from the sitter.
    const bins = new Uint32Array(1024);
    for (let i = 0; i < W * H; i++) bins[Math.min(1023, (soft[i] * 1024) | 0)]++;
    const level = share => { let sum = 0; for (let b = 0; b < 1024; b++) { sum += bins[b]; if (sum >= share * W * H) return b / 1024; } return 1; };
    const lo = level(0.02); const hi = level(0.98);
    const raw = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let l = clamp01((soft[y * W + x] - lo) / Math.max(0.01, hi - lo));
        const dx = (x / W - 0.5) / 0.36; const dy = (y / H - 0.5) / 0.5;
        l += (1 - l) * BACKGROUND_LIFT * smooth(0.75, 1.15, Math.sqrt(dx * dx + dy * dy));
        raw[y * W + x] = 1 - l;
      }
    }
    yield;
    // Local contrast (darkness minus its blur), then a tone curve that lifts the mid-tones.
    const radius = Math.round(LOCAL_RADIUS * k);
    const wide = boxBlur(boxBlur(raw, W, H, radius), W, H, radius);
    const dark = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) dark[i] = Math.pow(clamp01(raw[i] + LOCAL_CONTRAST * (raw[i] - wide[i])), TONE_GAMMA);
    yield;

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
  function engrave(img, w, h) {
    if (!img.complete || !img.naturalWidth) return null;
    const { k, W, H } = engravingKey(w, h);
    const key = `${W}x${H}`;
    if (!engravings.has(key)) engravings.set(key, runNow(engraveSteps(img, W, H, k)));
    return engravings.get(key);
  }
  async function prepareEngraving(signal) {
    const img = document.querySelector('#main-content .profile-photo');
    if (!img || !img.complete || !img.naturalWidth || !img.getClientRects().length) return;
    const r = img.getBoundingClientRect();
    const { k, W, H } = engravingKey(r.width, r.height);
    const key = `${W}x${H}`;
    if (engravings.has(key)) return;
    const canvas = await runSliced(engraveSteps(img, W, H, k), signal);
    if (!signal?.aborted) engravings.set(key, canvas);
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

  // Resolves true once the faces are in document.fonts, false on failure or after
  // FONT_TIMEOUT_MS (a late arrival is kept for the next activation, never swapped in mid-lens).
  async function loadFonts(signal, limit = FONT_TIMEOUT_MS) {
    if (!fell && typeof FontFace === 'function' && document.fonts) {
      const fetched = fetchFell().then(faces => { fell = fell || faces; return !!faces; }, () => false);
      if (!await Promise.race([fetched, sleep(limit, signal).then(() => false)])) return false;
    }
    if (!fell || signal?.aborted) return false;
    fell.forEach(face => document.fonts.add(face));
    return true;
  }
  const unloadFonts = () => { if (fell && document.fonts) fell.forEach(face => document.fonts.delete(face)); };

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

  // Writes the drop cap rule into this lens's own stylesheet (removed with it after exit).
  function setDropCap(st) {
    const sheet = [...document.styleSheets].find(sh => (sh.href || '').includes('easter/acta.css'));
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
  function apply(st, on) {
    if (on) {
      rootVar.set(`url("${paper.url}")`);
      setDropCap(st);
      html.classList.add(CLS.on);
      st.scrollAfter = scrollY;                // the offset an untouched exit returns from
      placePortrait(st);
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
    // Re-place the engraving, and find the drop cap's paragraph again, when the layout or the
    // content moves (resize, late markdown, toggled details, demos), once per frame.
    const update = () => {
      pending = false;
      if (state === st && html.classList.contains(CLS.on)) { setDropCap(st); placePortrait(st); }
      return false;
    };
    const schedule = () => { if (!pending && !signal.aborted) { pending = true; st.ctx.frame(update); } };
    window.addEventListener('resize', schedule, { passive: true, signal });
    if (typeof st.ctx.onContentChange === 'function') st.ctx.onContentChange(schedule);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      const main = document.getElementById('main-content');
      if (main) observer.observe(main);
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    }
  }

  // The activation's layers, the page-kind classes and (paper pages) the print matrix.
  function build(ctx) {
    const kind = pageKind(ctx);
    const st = { ctx, kind, vt: null, portrait: null, scrollBefore: scrollY, scrollAfter: null, dropCap: null, dropCapPath: null };
    state = st;
    st.page = ctx.layer('page');
    const fixed = ctx.layer('fixed');
    st.vignette = document.createElement('div'); st.vignette.className = 'lens-acta-vignette';
    st.veil = document.createElement('div'); st.veil.className = 'lens-acta-veil';
    fixed.append(st.vignette, st.veil);
    if (kind === 'paper') {
      const ns = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(ns, 'svg');
      defs.setAttribute('class', 'lens-acta-defs'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', PRINT_ID); filter.setAttribute('color-interpolation-filters', 'sRGB');
      const matrix = document.createElementNS(ns, 'feColorMatrix');
      matrix.setAttribute('type', 'matrix'); matrix.setAttribute('values', printMatrix());
      filter.appendChild(matrix); defs.appendChild(filter); st.page.appendChild(defs);
    }
    html.classList.add(kind === 'paper' ? CLS.paper : CLS.shell);
    if (kind === 'home') html.classList.add(CLS.home);
    return st;
  }

  // Fonts, paper and engraving, the latter two in slices while the fonts load. Nothing
  // changes on screen until all three are ready. False when the activation was abandoned.
  async function prepare(st, fontLimit) {
    const { signal } = st.ctx;
    const making = paper ? Promise.resolve(paper) : makePaper(signal);
    const [fonts, made] = await Promise.all([loadFonts(signal, fontLimit), making, prepareEngraving(signal)]);
    if (signal.aborted || state !== st || !made) return false;
    paper = made;
    if (!fonts) html.classList.add(CLS.fallback);
    try { const probe = new Image(); probe.src = paper.url; await probe.decode(); } catch (error) { /* drawn anyway */ }
    if (signal.aborted || state !== st) return false;
    st.vignette.classList.add('is-on');
    st.scrollBefore = scrollY;
    html.classList.add(CLS.hold);
    return true;
  }

  async function enter(ctx) {
    const st = build(ctx);
    if (!await prepare(st, FONT_TIMEOUT_MS)) return;
    if (ctx.motion.matches || document.hidden || ctx.arriving) apply(st, true);
    else await transition(st, true, ctx.signal);
    if (state !== st) return;
    st.scrollAfter = scrollY;
    bind(st);
  }

  // A page opened while the lens is on: the ground is already paper (pre-paint rule), so the
  // style switches at once, as soon as the fonts and the paper are ready.
  async function arrive(ctx) {
    const st = build(ctx);
    if (!await prepare(st, ARRIVE_FONT_MS)) return;
    apply(st, true);
    st.scrollAfter = scrollY;
    bind(st);
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
    unloadFonts();
    st.portrait?.remove();
    // Re-enable scroll anchoring only once the restored layout has been used for a frame.
    if (html.classList.contains(CLS.hold)) { await nextFrame(); html.classList.remove(CLS.hold); }
    if (state === st) state = null;
  }

  window.SiteLenses?.register({
    id: 'acta',
    order: 4,
    numeral: 'IV',
    label: 'Acta Eruditorum, 1692',
    line: 'As it might have been printed when Bernoulli named the spira mirabilis.',
    css: true,
    enter,
    arrive,
    exit
  });
})();
