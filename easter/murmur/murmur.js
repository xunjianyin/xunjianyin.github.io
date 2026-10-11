/**
 * Murmuration. The page's letters loosen from their lines and become a flock: each
 * letter follows three local rules (keep apart, fly with the neighbours, stay with
 * them), under a noise that cools with time. At a critical noise the flock orders
 * all at once, as in the Vicsek model; the order parameter phi jumps from near 0 to
 * near 1. The way back is the same kind of rule: each letter keeps to the letter that
 * came before it in the text, and words, lines and the page grow back from that.
 *
 * One Canvas2D canvas draws everything on the page's own paper. The page DOM is never
 * mutated: one class on <html> hides its glyphs while sprites stand in their exact
 * places; links, the photo and the nav stay where they are.
 *
 * Model (continuous-time topological boids with Vicsek noise). Each letter interacts with
 * its k = 7 nearest neighbours whatever their distance, as starlings do (Ballerini et al.,
 * PNAS 2008: six to seven), so a thinned flock still holds together and a scattered one
 * regathers. For letter i with heading h_i (a unit vector) and its k nearest j:
 *   target  = wA * unit(sum h_j) + wC * min(1, |c - p_i| / L) * unit(c - p_i)   (c the centroid)
 *             + wS * sum over the j closer than s of (p_i - p_j) / |p_i - p_j|^2
 *             + walls + roost + pointer
 *   h_i    <- unit(h_i + k dt (unit(target) - h_i)), then rotated by a eta^2 pi g sqrt(dt / tau)
 *             (g standard normal: the Vicsek angular noise; eta in [0, 1] is the readout's
 *             noise, squared so that the ordering falls near the middle of its range)
 *   p_i    <- p_i + v h_i dt
 *   phi     = mean over i of |h_i + sum h_j| / (1 + k)   (the local polarization: 1 when every
 *             letter flies with its seven, about 0.35 in the disordered gas; a flock that
 *             wheels as one is ordered locally while its global sum cancels)
 */
(() => {
  'use strict';
  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------------------------
   * Tunable constants. Times are seconds; lengths CSS px.
   * ------------------------------------------------------------------------- */
  // Choreography
  const T_LOOSEN = 2.6;                // letters leave their lines: speed and rotation ramp in
  const NOISE_START = 1.0;             // eta at the start: every letter for itself
  const NOISE_FLOOR = 0.04;            // eta the schedule cools to
  const T_COOL = [3.0, 30.0];          // the schedule cools eta from NOISE_START to NOISE_FLOOR over this span
  const T_HOME = 3.4;                  // the flight home, from the close request to the swap
  const HOME_LOCAL = [0.0, 2.3];       // the home rule follows the previous letter ... then the place itself
  const HOME_FINAL = [2.7, 3.4];       // the last stretch eases exactly onto the page
  const HOME_UNWIND = [1.6, 2.6];      // letters turn upright over this span
  // The flock
  const K = 7;                         // the topological neighbourhood: the k nearest letters
  const CELL = 24;                     // px: the grid cell of the nearest-neighbour search ...
  const MAX_RING = 6;                  // ... searched up to this many rings out (144 px)
  const SEPARATION = 14;               // letters closer than this push apart
  const W_ALIGN = 1.0;
  const W_COHESION = 0.55;             // cohesion grows with the distance to the seven's centroid ...
  const COHESION_SCALE = 48;           // ... up to full weight at this distance
  const W_SEPARATION = 3.5;
  const W_CENTRE = 0.35;               // a weak pull toward the viewport centre (the roost), growing with distance
  const TURN_RATE = 6.0;               // 1/s: how fast a heading follows its target
  const NOISE_TAU = 1 / 15;            // s: one Vicsek step
  const NOISE_AMP = 0.4;               // a: the angular noise at eta = 1 is 0.4 pi per step
  const SPEED = 92;                    // px/s cruising speed
  const SPEED_SPREAD = 0.12;           // each letter's own speed is within this share of SPEED
  const WALL_MARGIN = 90;              // px from the viewport edge where the wall begins to turn a letter
  const W_WALL = 3.5;
  const HOME_SPRING = 42;              // 1/s^2: the flight home is a damped spring toward the goal ...
  const HOME_DAMPING = 11;             // 1/s ... with this damping (a little under critical)
  const HOME_MAX_SPEED = 900;          // px/s
  const POINTER_RADIUS = 120;          // the pointer scatters letters within this radius ...
  const W_POINTER = 3.2;               // ... turning them away this strongly (fading with distance) ...
  const POINTER_PUSH = 320;            // ... and pushing them, px/s at the pointer, so the gas parts too
  const MAX_LETTERS = 2600;            // more letters than this: the units are words
  const MAX_LETTERS_COARSE = 1500;     // ... on a touch device
  const MAX_WORDS = 900;               // words beyond this stay printed in their places
  const MAX_BACKING_PIXELS = 8.3e6;    // full DPR 2 up to 1728 x 1117; reduced beyond
  const ATLAS_SIZE = 2048;
  const ATLAS_PAD = 2;
  const FLIP_RATE = 9;                 // 1/s: a letter turns to stay upright this fast
  // Chrome (the readout and Return) stays hidden until intent.
  const CHROME_REGION = [240, 120];    // px: the bottom-right region that reveals it
  const CHROME_HIDE_MS = 1800;         // hide this long after the pointer leaves the region
  const CHROME_TAP_MS = 3500;          // a tap on the flock (or a key) shows it this long
  const NOISE_STEP = 0.05;             // one key press or wheel notch
  const WHEEL_STEP = 0.0007;           // eta per wheel pixel

  /* ---------------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------------- */
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const easeOut = u => { u = clamp(u, 0, 1); return 1 - (1 - u) * (1 - u) * (1 - u); };
  const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const span = (t, [a, b]) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1));
  // A seeded generator (mulberry32), so a replay with the same seed flies the same way.
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gaussian(random) {
    let u = 0; let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------------------------------------------------------------------------
   * Capture: the visible words of the page, in reading order, with exact typography,
   * and the letters inside each, with their exact advance boxes
   * ------------------------------------------------------------------------- */
  const EXCLUDE = 'script, style, nav, #site-nav, [hidden], [aria-hidden="true"], dialog, .skip-link';
  function captureRoots() {
    const main = document.getElementById('main-content') || document.querySelector('main');
    const footer = document.getElementById('site-footer');
    const roots = [main, footer].filter(Boolean);
    return roots.length ? roots : [document.body];
  }
  function parseColour(text) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?/.exec(text || '');
    if (!m) return null;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
    return [+m[1], +m[2], +m[3], a];
  }
  function captureWords() {
    const words = [];
    const vw = innerWidth; const vh = innerHeight;
    const styles = new Map(); const blocks = new Map();
    const range = document.createRange();
    const styleOf = el => {
      if (styles.has(el)) return styles.get(el);
      const cs = getComputedStyle(el);
      const rgba = parseColour(cs.color);
      let info = null;
      if (cs.visibility === 'visible' && Number(cs.opacity) > 0 && rgba && rgba[3] > 0.02) {
        const size = parseFloat(cs.fontSize) || 16;
        const caps = cs.fontVariantCaps === 'small-caps' ? 'small-caps ' : '';
        info = {
          font: `${cs.fontStyle} ${caps}${cs.fontWeight} ${size}px ${cs.fontFamily}`, size,
          spacing: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0,
          transform: cs.textTransform, colour: cs.color
        };
      }
      styles.set(el, info);
      return info;
    };
    const blockOf = el => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        if (blocks.has(node)) return blocks.get(node);
        const display = getComputedStyle(node).display;
        if (!display.startsWith('inline') && display !== 'contents') { blocks.set(node, blocks.size + 1); return blocks.size; }
      }
      return 0;
    };
    const transform = (text, mode, atStart) => {
      if (mode === 'uppercase') return text.toUpperCase();
      if (mode === 'lowercase') return text.toLowerCase();
      if (mode === 'capitalize' && atStart) return text.charAt(0).toUpperCase() + text.slice(1);
      return text;
    };
    for (const root of captureRoots()) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || !/\S/.test(node.data) || parent.closest(EXCLUDE)) continue;
        const box = parent.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh || box.right < 0 || box.left > vw) continue;
        const style = styleOf(parent);
        if (!style) continue;
        const block = blockOf(parent);
        // One word per visible line: a word wrapped across lines (hyphenation) is split by line.
        const capture = (start, end, atStart) => {
          range.setStart(node, start); range.setEnd(node, end);
          const r = range.getBoundingClientRect();
          if (!r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
          // The letters: each character's advance box on this line. A transform (uppercase) that
          // changes a character's length is drawn per word, so the letters keep the source text.
          const letters = [];
          let offset = start;
          for (const character of node.data.slice(start, end)) {
            range.setStart(node, offset); range.setEnd(node, offset + character.length);
            const lr = range.getBoundingClientRect();
            letters.push({ text: transform(character, style.transform, atStart && offset === start), left: lr.left, width: lr.width });
            offset += character.length;
          }
          words.push({ text: transform(node.data.slice(start, end), style.transform, atStart),
            left: r.left, top: r.top, width: r.width, height: r.height, style, block, letters });
        };
        for (const match of node.data.matchAll(/\S+/gu)) {
          const from = match.index; const to = from + match[0].length;
          range.setStart(node, from); range.setEnd(node, to);
          const rects = range.getClientRects();
          let single = true;
          for (let i = 1; i < rects.length; i++) if (Math.abs(rects[i].top - rects[0].top) >= 1) single = false;
          if (single) { capture(from, to, true); continue; }
          let start = from; let offset = from; let top = null;
          for (const character of match[0]) {
            range.setStart(node, offset); range.setEnd(node, offset + character.length);
            const r = range.getBoundingClientRect();
            if (top !== null && Math.abs(r.top - top) > 1) { capture(start, offset, start === from); start = offset; }
            top = r.top; offset += character.length;
          }
          capture(start, offset, start === from);
        }
      }
    }
    range.detach();
    return words;
  }

  // Draw a word with its letter-spacing; fall back to measured per-glyph advances.
  function fillSpaced(g, text, x, y, spacing, native) {
    if (!spacing || native) { g.fillText(text, x, y); return; }
    for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + spacing; }
  }

  /**
   * Shelf-pack one sprite per word into 2048 px atlases, drawn in device pixels so that at rest
   * each sprite is blitted 1:1 onto its glyphs (the page paints each baseline on a whole CSS
   * pixel, x sub-pixel; so does the sprite). Then cut each word into its units: one slice per
   * letter (the slices tile the word exactly, so at rest the composition is the word), or the
   * whole word. Returns the atlases and the units in reading order.
   */
  function buildUnits(words, dpr, perLetter) {
    const measure = makeCanvas(1, 1).getContext('2d');
    const native = 'letterSpacing' in measure;
    const heights = [0];
    let page = 0; let x = 0; let y = 0; let shelf = 0;
    const place = (w, h) => {
      if (x + w > ATLAS_SIZE) { x = 0; y += shelf + ATLAS_PAD; shelf = 0; }
      if (y + h > ATLAS_SIZE) { page++; heights.push(0); x = 0; y = 0; shelf = 0; }
      const spot = [page, x, y];
      x += w + ATLAS_PAD; shelf = Math.max(shelf, h); heights[page] = Math.max(heights[page], y + h);
      return spot;
    };
    const kept = [];
    for (const word of words) {
      const size = word.style.size;
      measure.font = word.style.font;
      if (native) measure.letterSpacing = `${word.style.spacing}px`;
      const metrics = measure.measureText(word.text);
      word.ascent = metrics.fontBoundingBoxAscent || size * 0.8;
      const padX = Math.ceil((2 + 0.3 * size) * dpr); const padY = Math.ceil((2 + 0.25 * size) * dpr);
      word.ox = Math.floor(word.left * dpr) - padX;
      word.oy = Math.floor(word.top * dpr) - padY;
      word.sw = Math.ceil((word.left + word.width) * dpr) + padX - word.ox;
      word.sh = Math.ceil((word.top + word.height) * dpr) + padY - word.oy;
      if (word.sw > ATLAS_SIZE || word.sh > ATLAS_SIZE) continue;
      word.spot = place(word.sw, word.sh);
      kept.push(word);
    }
    const atlases = heights.map(h => makeCanvas(ATLAS_SIZE, Math.max(1, h)));
    const contexts = atlases.map(c => c.getContext('2d'));
    for (const word of kept) {
      const g = contexts[word.spot[0]];
      g.save();
      g.beginPath(); g.rect(word.spot[1], word.spot[2], word.sw, word.sh); g.clip();
      g.setTransform(dpr, 0, 0, dpr, word.spot[1] - word.ox, word.spot[2] - word.oy);
      g.font = word.style.font; g.fillStyle = word.style.colour; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      fillSpaced(g, word.text, word.left, Math.round(word.top + word.ascent), word.style.spacing, native);
      g.restore();
    }
    // Units: slices of the word sprites, in device pixels of the atlas.
    const units = [];
    for (const word of kept) {
      const [atlas, ax, ay] = word.spot;
      const push = (from, to, text) => {
        if (to <= from) return;
        units.push({ atlas, sx: ax + from, sy: ay, sw: to - from, sh: word.sh,
          // The rest position of the slice's centre, in CSS px.
          cx: (word.ox + (from + to) / 2) / dpr, cy: (word.oy + word.sh / 2) / dpr,
          word, text, line: word.top, block: word.block });
      };
      if (!perLetter || word.letters.length < 2) { push(0, word.sw, word.text); continue; }
      // Slice boundaries at each letter's left edge (device px, relative to the sprite).
      const bounds = word.letters.map(l => clamp(Math.round(l.left * dpr) - word.ox, 0, word.sw));
      for (let i = 0; i < bounds.length; i++) {
        const from = i === 0 ? 0 : bounds[i];
        const to = i === bounds.length - 1 ? word.sw : bounds[i + 1];
        push(from, to, word.letters[i].text);
      }
    }
    return { atlases, units };
  }

  /* ---------------------------------------------------------------------------
   * The egg
   * ------------------------------------------------------------------------- */
  let active = false;

  /**
   * Opens the flock. Options (test hooks): timeScale (the schedule runs this many times
   * faster), seed (the generator's seed). Under reduced motion, or when the page holds no
   * letters, nothing opens.
   */
  function open(options) {
    if (active) return false;
    options = options || {};
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return false;
    active = true;
    try { return start(options, motion); } catch (error) { active = false; console.warn('The flock could not open.', error); return false; }
  }

  function start(options, motion) {
    const timeScale = Number.isFinite(options.timeScale) && options.timeScale > 0 ? options.timeScale : 1;
    const html = document.documentElement;
    const body = document.body;
    const previousFocus = document.activeElement;
    const scroll = { x: scrollX, y: scrollY };
    const overflow = body.style.getPropertyValue('overflow');
    const overflowPriority = body.style.getPropertyPriority('overflow');
    const gutter = html.style.getPropertyValue('scrollbar-gutter');
    const gutterPriority = html.style.getPropertyPriority('scrollbar-gutter');
    // Attributes the opening creates (an empty class or style) are removed again at the end,
    // so the root is restored byte for byte.
    const hadAttribute = { htmlClass: html.hasAttribute('class'), htmlStyle: html.hasAttribute('style'), bodyStyle: body.hasAttribute('style') };
    const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
    const random = seeded(Number.isFinite(options.seed) ? options.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const events = new AbortController();
    const on = (target, type, fn, extra) => target.addEventListener(type, fn, Object.assign({ signal: events.signal }, extra));

    /* ---- Capture --------------------------------------------------------- */
    const vw = innerWidth; const vh = innerHeight;
    let dpr = Math.max(1, devicePixelRatio || 1);
    if (vw * vh * dpr * dpr > MAX_BACKING_PIXELS) dpr = Math.max(1, Math.sqrt(MAX_BACKING_PIXELS / (vw * vh)));
    const words = captureWords();
    const letterCount = words.reduce((n, w) => n + w.letters.length, 0);
    const maxLetters = coarse ? MAX_LETTERS_COARSE : MAX_LETTERS;
    const perLetter = letterCount <= maxLetters;
    const built = buildUnits(words, dpr, perLetter);
    const units = built.units;
    const N = units.length;
    if (!N) { active = false; return false; }
    const M = Math.min(N, perLetter ? maxLetters : MAX_WORDS);   // the units that fly; the rest stay printed
    // The chain: unit i follows unit i-1 when both lie on one line of one block, left to right
    // (a word's letters, then the words of a line); a line's first unit has no predecessor.
    const pred = new Int32Array(N).fill(-1);
    for (let i = 1; i < M; i++) {
      const a = units[i - 1]; const b = units[i];
      if (a.block === b.block && Math.abs(a.line - b.line) < 1 && b.cx > a.cx) pred[i] = i - 1;
    }

    /* ---- State ------------------------------------------------------------ */
    const px = new Float32Array(N); const py = new Float32Array(N);     // position (slice centre)
    const hx = new Float32Array(N); const hy = new Float32Array(N);     // heading (unit)
    const ang = new Float32Array(N);                                    // drawn angle
    const spd = new Float32Array(N);                                    // own cruising speed
    const vx = new Float32Array(N); const vy = new Float32Array(N);     // velocity on the flight home
    const homeX = new Float32Array(N); const homeY = new Float32Array(N);
    const offX = new Float32Array(N); const offY = new Float32Array(N); // offset from the predecessor at rest
    for (let i = 0; i < N; i++) {
      px[i] = homeX[i] = units[i].cx; py[i] = homeY[i] = units[i].cy;
      const a = random() * TAU; hx[i] = Math.cos(a); hy[i] = Math.sin(a);
      spd[i] = SPEED * (1 + SPEED_SPREAD * (2 * random() - 1));
      if (pred[i] >= 0) { offX[i] = homeX[i] - homeX[pred[i]]; offY[i] = homeY[i] - homeY[pred[i]]; }
    }
    // The grid for neighbour queries (cell = R).
    const cols = Math.max(1, Math.ceil(vw / CELL) + 2); const rows = Math.max(1, Math.ceil(vh / CELL) + 2);
    const head = new Int32Array(cols * rows); const next = new Int32Array(N);
    const bestD = new Float32Array(K); const bestJ = new Int32Array(K);   // the k nearest of one letter
    const roost = Math.min(vw, vh) / 2;
    const cellOf = (x, y) => clamp(Math.floor(x / CELL) + 1, 0, cols - 1) + cols * clamp(Math.floor(y / CELL) + 1, 0, rows - 1);

    let phase = 'loosen';              // loosen -> flock -> home -> (closed)
    let time = 0;                      // active seconds since the opening (scaled)
    let homeAt = -1;                   // the time the close was requested
    let noise = NOISE_START;           // eta
    let noiseHeld = false;             // the reader set eta: the schedule stops
    let order = 0;                     // phi
    let closed = false; let leaving = false;
    let raf = 0; let lastNow = 0; let paused = false;
    const pointer = { x: -1e4, y: -1e4, in: false, vx: 0, vy: 0, at: 0 };
    const stats = { frames: 0, avgMs: 0, maxMs: 0 };

    /* ---- DOM ------------------------------------------------------------- */
    const dialog = document.createElement('dialog');
    dialog.id = 'murmur';
    dialog.setAttribute('aria-label', 'Murmuration: the page’s letters as a flock');
    const canvas = document.createElement('canvas');
    canvas.className = 'murmur-canvas';
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    const chrome = document.createElement('div');
    chrome.className = 'murmur-chrome';
    const readout = document.createElement('p');
    readout.className = 'murmur-readout';
    readout.setAttribute('aria-live', 'off');
    const returnButton = document.createElement('button');
    returnButton.type = 'button'; returnButton.className = 'murmur-return'; returnButton.textContent = 'Return';
    const status = document.createElement('p');
    status.className = 'murmur-status'; status.setAttribute('aria-live', 'polite');
    chrome.append(readout, returnButton);
    dialog.append(canvas, chrome, status);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) { active = false; return false; }

    const describe = () => {
      readout.innerHTML = `noise <i>η</i> ${noise.toFixed(2)} · order <i>φ</i> ${order.toFixed(2)}`;
    };
    let chromeTimer = 0; let chromeHover = false;
    const showChrome = ms => {
      chrome.classList.add('is-shown');
      clearTimeout(chromeTimer);
      if (ms) chromeTimer = setTimeout(() => { if (!chromeHover) chrome.classList.remove('is-shown'); }, ms);
    };
    const hideChrome = () => { clearTimeout(chromeTimer); chrome.classList.remove('is-shown'); };

    /* ---- The model ------------------------------------------------------- */
    function step(dt) {
      const t = time;
      const loosen = phase === 'loosen' ? smooth(t / T_LOOSEN) : 1;
      const since = phase === 'home' ? t - homeAt : -1;
      // The schedule cools the noise unless the reader holds it.
      if (!noiseHeld && phase !== 'home') noise = NOISE_START + (NOISE_FLOOR - NOISE_START) * smooth(span(t, T_COOL));
      const eta = phase === 'home' ? noise * (1 - smooth(since / 0.5)) : noise;
      const social = phase === 'home' ? 1 - smooth(since / 0.6) : 1;
      // Grid
      head.fill(-1);
      for (let i = 0; i < M; i++) { const c = cellOf(px[i], py[i]); next[i] = head[c]; head[c] = i; }
      const S2 = SEPARATION * SEPARATION;
      let polar = 0;
      const pointerOn = pointer.in && phase !== 'home';
      const pMag = pointerOn ? W_POINTER * (0.55 + 0.45 * clamp(Math.hypot(pointer.vx, pointer.vy) / 600, 0, 1)) : 0;
      for (let i = 0; i < M; i++) {
        const x = px[i]; const y = py[i];
        let ax = 0; let ay = 0; let cx = 0; let cy = 0; let sx = 0; let sy = 0; let n = 0;
        if (social > 0) {
          // The k nearest: rings of cells outward, until the k-th found is nearer than any cell
          // of the next ring can be (a cell on ring r + 1 lies at least r cells away).
          const col = clamp(Math.floor(x / CELL) + 1, 0, cols - 1); const row = clamp(Math.floor(y / CELL) + 1, 0, rows - 1);
          const visit = (c, r) => {
            if (c < 0 || c >= cols || r < 0 || r >= rows) return;
            for (let j = head[c + cols * r]; j >= 0; j = next[j]) {
              if (j === i) continue;
              const dx = px[j] - x; const dy = py[j] - y; const d2 = dx * dx + dy * dy;
              if (n === K && d2 >= bestD[K - 1]) continue;
              // Insert, keeping bestD ascending.
              let q = n < K ? n++ : K - 1;
              while (q > 0 && bestD[q - 1] > d2) { bestD[q] = bestD[q - 1]; bestJ[q] = bestJ[q - 1]; q--; }
              bestD[q] = d2; bestJ[q] = j;
            }
          };
          visit(col, row);
          for (let ring = 1; ring <= MAX_RING; ring++) {
            // The k-th found is nearer than any cell of this ring can be: done.
            if (n === K && bestD[K - 1] <= (ring - 1) * CELL * (ring - 1) * CELL) break;
            for (let c = col - ring; c <= col + ring; c++) { visit(c, row - ring); visit(c, row + ring); }
            for (let r = row - ring + 1; r <= row + ring - 1; r++) { visit(col - ring, r); visit(col + ring, r); }
          }
          for (let q = 0; q < n; q++) {
            const j = bestJ[q]; const d2 = bestD[q];
            ax += hx[j]; ay += hy[j]; cx += px[j] - x; cy += py[j] - y;
            if (d2 < S2 && d2 > 1e-4) { sx -= (px[j] - x) / d2; sy -= (py[j] - y) / d2; }
          }
        }
        let tx = 0; let ty = 0;
        if (n) {
          const al = Math.hypot(ax, ay) || 1;
          tx += W_ALIGN * social * ax / al; ty += W_ALIGN * social * ay / al;
          const cl = Math.hypot(cx, cy) / n;   // the distance to the centroid of the seven
          if (cl > 1e-3) { const w = W_COHESION * social * Math.min(1, cl / COHESION_SCALE) / (cl * n); tx += w * cx; ty += w * cy; }
          const sl = Math.hypot(sx, sy);
          if (sl > 0) { const s = W_SEPARATION * Math.min(1, sl * SEPARATION) / sl; tx += s * sx; ty += s * sy; }
        }
        // Walls: a soft turn back inside the margin.
        if (x < WALL_MARGIN) { const u = 1 - x / WALL_MARGIN; tx += W_WALL * u * u; }
        else if (x > vw - WALL_MARGIN) { const u = 1 - (vw - x) / WALL_MARGIN; tx -= W_WALL * u * u; }
        if (y < WALL_MARGIN) { const u = 1 - y / WALL_MARGIN; ty += W_WALL * u * u; }
        else if (y > vh - WALL_MARGIN) { const u = 1 - (vh - y) / WALL_MARGIN; ty -= W_WALL * u * u; }
        // The pointer scatters the letters near it.
        if (pointerOn) {
          const dx = x - pointer.x; const dy = y - pointer.y; const d = Math.hypot(dx, dy);
          if (d < POINTER_RADIUS && d > 1e-3) { const u = 1 - d / POINTER_RADIUS; tx += pMag * u * dx / d; ty += pMag * u * dy / d; }
        }
        // The roost: a weak pull toward the viewport centre, so the flock stays in view.
        if (phase !== 'home') {
          const dx = vw / 2 - x; const dy = vh / 2 - y; const d = Math.hypot(dx, dy);
          const u = d / roost;
          if (d > 1e-3) { tx += W_CENTRE * u * u * dx / d; ty += W_CENTRE * u * u * dy / d; }
        }
        // Heading follows the target, then the Vicsek noise.
        const tl = Math.hypot(tx, ty);
        let nx = hx[i]; let ny = hy[i];
        if (tl > 1e-6) { const k = Math.min(1, TURN_RATE * dt); nx += k * (tx / tl - nx); ny += k * (ty / tl - ny); }
        if (eta > 0) {
          const a = NOISE_AMP * eta * eta * Math.PI * gaussian(random) * Math.sqrt(dt / NOISE_TAU);
          const ca = Math.cos(a); const sa = Math.sin(a);
          const rx = nx * ca - ny * sa; ny = nx * sa + ny * ca; nx = rx;
        }
        const nl = Math.hypot(nx, ny) || 1;
        hx[i] = nx / nl; hy[i] = ny / nl;
        polar += Math.hypot(ax + hx[i], ay + hy[i]) / (n + 1);
      }
      order = M ? polar / M : 0;
      // Move
      if (phase === 'home') {
        // A damped spring toward the goal: the letter before this one in the text, at the rest
        // offset (so words gather first, then lines), blending into the place itself.
        const w = smooth(span(since, HOME_LOCAL));
        for (let i = 0; i < M; i++) {
          const p = pred[i];
          const gx = p < 0 ? homeX[i] : w * homeX[i] + (1 - w) * (px[p] + offX[i]);
          const gy = p < 0 ? homeY[i] : w * homeY[i] + (1 - w) * (py[p] + offY[i]);
          vx[i] += (HOME_SPRING * (gx - px[i]) - HOME_DAMPING * vx[i]) * dt;
          vy[i] += (HOME_SPRING * (gy - py[i]) - HOME_DAMPING * vy[i]) * dt;
          const v = Math.hypot(vx[i], vy[i]);
          if (v > HOME_MAX_SPEED) { vx[i] *= HOME_MAX_SPEED / v; vy[i] *= HOME_MAX_SPEED / v; }
          px[i] += vx[i] * dt; py[i] += vy[i] * dt;
          if (v > 1) { hx[i] = vx[i] / v; hy[i] = vy[i] / v; }
        }
      }
      for (let i = 0; i < M; i++) {
        if (phase !== 'home') {
          const v = spd[i] * loosen;
          px[i] += hx[i] * v * dt; py[i] += hy[i] * v * dt;
          if (pointerOn) {
            const dx = px[i] - pointer.x; const dy = py[i] - pointer.y; const d = Math.hypot(dx, dy);
            if (d < POINTER_RADIUS && d > 1e-3) { const u = 1 - d / POINTER_RADIUS; px[i] += POINTER_PUSH * u * u * dx / d * dt; py[i] += POINTER_PUSH * u * u * dy / d * dt; }
          }
          px[i] = clamp(px[i], -40, vw + 40); py[i] = clamp(py[i], -40, vh + 40);
        }
        // The drawn angle follows the heading but keeps the letter upright: a heading that
        // points left is drawn turned by pi (the letter flies backwards), and it turns between
        // the two smoothly. During the flight home the letters unwind to upright.
        let target = Math.atan2(hy[i], hx[i]);
        if (target > Math.PI / 2) target -= Math.PI; else if (target < -Math.PI / 2) target += Math.PI;
        const upright = phase === 'home' ? 1 - smooth(span(since, HOME_UNWIND)) : loosen;
        target *= upright;
        let d = target - ang[i];
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        ang[i] += d * Math.min(1, FLIP_RATE * dt);
      }
      // The last stretch eases exactly onto the page.
      if (phase === 'home') {
        const u = smooth(span(since, HOME_FINAL));
        if (u > 0) {
          for (let i = 0; i < M; i++) {
            px[i] += (homeX[i] - px[i]) * u; py[i] += (homeY[i] - py[i]) * u; ang[i] *= 1 - u;
          }
        }
      }
    }

    /* ---- Drawing ----------------------------------------------------------- */
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const atlases = built.atlases;
      for (let i = 0; i < N; i++) {
        const u = units[i];
        const w = u.sw / dpr; const h = u.sh / dpr;
        if (i >= M || (phase === 'loosen' && time <= 0)) {
          // At rest: blitted 1:1 onto its glyphs.
          ctx.drawImage(atlases[u.atlas], u.sx, u.sy, u.sw, u.sh, u.cx - w / 2, u.cy - h / 2, w, h);
          continue;
        }
        const a = ang[i];
        if (Math.abs(a) < 1e-3) {
          ctx.drawImage(atlases[u.atlas], u.sx, u.sy, u.sw, u.sh, px[i] - w / 2, py[i] - h / 2, w, h);
        } else {
          const c = Math.cos(a); const s = Math.sin(a);
          ctx.setTransform(dpr * c, dpr * s, -dpr * s, dpr * c, dpr * px[i], dpr * py[i]);
          ctx.drawImage(atlases[u.atlas], u.sx, u.sy, u.sw, u.sh, -w / 2, -h / 2, w, h);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
    }
    // Rest positions, drawn exactly, for the first frame and the last.
    function drawAtRest() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      for (let i = 0; i < N; i++) {
        const u = units[i];
        ctx.drawImage(built.atlases[u.atlas], u.sx, u.sy, u.sw, u.sh, u.cx - u.sw / dpr / 2, u.cy - u.sh / dpr / 2, u.sw / dpr, u.sh / dpr);
      }
    }

    /* ---- Loop -------------------------------------------------------------- */
    const MAX_DT = 1 / 30;
    function frame(now) {
      raf = 0;
      if (closed || paused) return;
      const began = performance.now();
      let dt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
      lastNow = now;
      dt = Math.min(MAX_DT, Math.max(0, dt)) * timeScale;
      // A long frame is run as several steps, so the model stays stable.
      const steps = Math.max(1, Math.min(4, Math.ceil(dt / MAX_DT)));
      for (let s = 0; s < steps; s++) { time += dt / steps; step(dt / steps); }
      if (phase === 'loosen' && time >= T_LOOSEN) phase = 'flock';
      if (phase === 'home' && time - homeAt >= T_HOME) { finish(); return; }
      draw();
      if (chrome.classList.contains('is-shown')) describe();
      const took = performance.now() - began;
      stats.frames++; stats.avgMs += (took - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, took);
      schedule();
    }
    function schedule() { if (!raf && !closed && !paused) raf = requestAnimationFrame(frame); }

    /* ---- Close and restore ------------------------------------------------- */
    function cleanup() {
      if (closed) return;
      closed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      events.abort();
      clearTimeout(chromeTimer);
      html.classList.remove('murmur-hide-text');
      try { if (dialog.open) dialog.close(); } catch (error) { /* already closed */ }
      dialog.remove();
      if (overflow) body.style.setProperty('overflow', overflow, overflowPriority);
      else body.style.removeProperty('overflow');
      if (gutter) html.style.setProperty('scrollbar-gutter', gutter, gutterPriority);
      else html.style.removeProperty('scrollbar-gutter');
      if (!hadAttribute.htmlClass && html.getAttribute('class') === '') html.removeAttribute('class');
      if (!hadAttribute.htmlStyle && html.getAttribute('style') === '') html.removeAttribute('style');
      if (!hadAttribute.bodyStyle && body.getAttribute('style') === '') body.removeAttribute('style');
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      if (scrollX !== scroll.x || scrollY !== scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      active = false;
    }
    // The final frame: every unit at rest on the canvas, then the swap (glyphs back, dialog
    // gone) in one paint.
    function finish() {
      drawAtRest();
      cleanup();
    }
    /**
     * The flight home. The noise goes, the flock's rules fade, and each letter keeps to the
     * letter before it in the text, so words form first, then lines, then the page; the last
     * stretch eases exactly onto the glyphs. A second request, a hidden tab or pagehide finish
     * at once.
     */
    function close() {
      if (closed) return;
      if (leaving || document.hidden || paused) { cleanup(); return; }
      leaving = true;
      phase = 'home'; homeAt = time;
      for (let i = 0; i < M; i++) { vx[i] = hx[i] * spd[i]; vy[i] = hy[i] * spd[i]; }
      hideChrome();
      status.textContent = 'The letters are returning to the page.';
      schedule();
    }

    /* ---- Events ------------------------------------------------------------ */
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup);
    on(returnButton, 'click', () => close());
    on(window, 'pagehide', cleanup);
    // The page reflows on a resize: the captured places no longer hold. Finish at once.
    on(window, 'resize', () => { if (innerWidth !== vw || innerHeight !== vh) cleanup(); });
    on(document, 'visibilitychange', () => {
      if (document.hidden) { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; }
      else { paused = false; lastNow = 0; schedule(); }
    });
    on(motion, 'change', () => { if (motion.matches) cleanup(); });
    // The pointer: where it is and how fast it moves; the corner reveals the chrome.
    on(dialog, 'pointermove', event => {
      const now = performance.now();
      if (pointer.in && pointer.at) {
        const s = Math.max(1e-3, (now - pointer.at) / 1000);
        pointer.vx = (event.clientX - pointer.x) / s; pointer.vy = (event.clientY - pointer.y) / s;
      }
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.at = now; pointer.in = true;
      const inCorner = event.clientX > vw - CHROME_REGION[0] && event.clientY > vh - CHROME_REGION[1];
      if (inCorner) { chromeHover = true; showChrome(0); }
      else if (chromeHover) { chromeHover = false; showChrome(CHROME_HIDE_MS); }
    });
    on(dialog, 'pointerleave', () => { pointer.in = false; pointer.vx = pointer.vy = 0; });
    on(dialog, 'pointerdown', event => {
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.at = performance.now(); pointer.in = true;
      if (!chrome.contains(event.target)) showChrome(CHROME_TAP_MS);
    });
    // A finger scatters the letters while it is down; the mouse wherever it is over the page.
    const lift = event => { if (event.pointerType !== 'mouse') { pointer.in = false; pointer.vx = pointer.vy = 0; } };
    on(dialog, 'pointerup', lift);
    on(dialog, 'pointercancel', lift);
    // Keys: Esc goes home (the dialog's cancel), the arrows warm or cool the noise, a digit sets it.
    on(dialog, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        setNoise(noise + (event.key === 'ArrowUp' ? NOISE_STEP : -NOISE_STEP));
      } else if (event.key === 'Home') { event.preventDefault(); setNoise(NOISE_START); }
      else if (event.key === 'End') { event.preventDefault(); setNoise(0); }
    });
    // The wheel cools (down) or warms (up) the flock.
    on(dialog, 'wheel', event => { event.preventDefault(); setNoise(noise - event.deltaY * WHEEL_STEP); }, { passive: false });
    function setNoise(value) {
      if (phase === 'home' || closed) return;
      noise = clamp(value, 0, 1); noiseHeld = true;
      describe(); showChrome(CHROME_TAP_MS);
    }

    /* ---- Debug and test hooks (never UI) ---------------------------------- */
    dialog.murmur = {
      get phase() { return closed ? 'closed' : phase; },
      get time() { return time; },
      get noise() { return noise; },
      get order() { return order; },
      get count() { return M; },
      get units() { return N; },
      get perLetter() { return perLetter; },
      get frameStats() { return stats; },
      setNoise,
      close,
      // Positions, for a test of the model (copies).
      positions: () => ({ x: Float32Array.from(px.subarray(0, M)), y: Float32Array.from(py.subarray(0, M)), homeX: Float32Array.from(homeX.subarray(0, M)), homeY: Float32Array.from(homeY.subarray(0, M)) })
    };

    /* ---- Open ---------------------------------------------------------------- */
    try {
      html.style.setProperty('scrollbar-gutter', 'stable');
      body.style.setProperty('overflow', 'hidden', 'important');
      body.append(dialog);
      dialog.showModal();
      drawAtRest();
      // The swap in: the canvas shows the glyphs at rest, then the page's own go transparent.
      html.classList.add('murmur-hide-text');
      describe();
      status.textContent = `${M} ${perLetter ? 'letters' : 'words'} of the page have become a flock. Escape returns them.`;
      dialog.focus({ preventScroll: true });
      lastNow = 0;
      schedule();
    } catch (error) { cleanup(); throw error; }
    return true;
  }

  window.SiteMurmuration = { open, get active() { return active; } };
})();
