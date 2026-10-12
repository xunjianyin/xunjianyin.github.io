/**
 * Self-portrait. A small program paints the homepage photograph from nothing, square by
 * square, and rewrites itself as it goes. It has two parts, both shown as they change:
 *
 *   paint     where to put the next square, how large, in what colour, how opaque
 *   improve   how often to try an edit to paint, how to choose it, when to keep it,
 *             and how often to edit improve itself (that rule included)
 *
 * Every edit is tried from the same canvas: the current program and the edited one each paint
 * the next window of proposals on a copy (with the same random numbers), and the edited one is
 * kept only if it paints at least as well, so the program only switches to a self that has
 * shown it does no worse (after the Gödel machine, which asks for a proof instead). An edit to
 * paint is judged over one window; an edit to improve over the next HORIZON windows of tests,
 * since what it changes is how paint gets edited. The winner's copy is the canvas that goes on,
 * so no work is thrown away but the loser's.
 *
 * When the portrait is done, the sitter changes: the target becomes the program's own text.
 * Each copy is judged against the text of its own program, so an edit now also changes the
 * picture it must match; once the painting is close, an edit costs more than it can repay and
 * the program stops changing: the picture is the program that paints it.
 *
 * Model. The canvas is GRID x GRID cells of RGB in [0, 1], starting as the page's paper.
 * A proposal is one square (side z, colour c, opacity a) over the cells Q; its change of the
 * squared error against the target t, summed over Q and the channels, is
 *   dE = sum 2a (p - t)(c - p) + a^2 (c - p)^2,
 * computed in closed form from the sums of p, p^2 and p t over Q. A square is drawn when the
 * best of `tries` proposals has dE < 0. "The colour that fits best" minimises dE:
 *   c* = (mean t - (1 - a) mean p) / a, clamped to [0, 1].
 * PSNR = 10 log10(3 GRID^2 / E), with E the total squared error.
 *
 * The simulation runs ahead of the display (a generator, sliced across frames); the display
 * replays the timeline that won, at a steady pace, and reveals each test's verdict when the
 * test's window has been shown. One dialog; the page DOM is never mutated (the photo is read,
 * not moved), and closing restores the page exactly.
 */
(() => {
  'use strict';
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = new URL('../../', SCRIPT_SRC).href;   // easter/portrait/portrait.js → the site root

  /* ---------------------------------------------------------------------------
   * Tunable constants. Times are ms unless named _S; lengths CSS px.
   * ------------------------------------------------------------------------- */
  const GRID = 160;                    // the painting's cells per side; the photo is drawn at this size
  const CELL = 10;                     // cells per side of one square of the error map ("where the error is largest")
  const HORIZON = 4;                   // an edit to improve is judged over this many windows of its own tests
  const SAMPLE = 50;                   // proposals between PSNR samples (window lengths are multiples of it)
  const SLICE = 12000;                 // cells visited between the simulation's yields (well under 1 ms)
  const SIM_MS = 5;                    // the simulation's share of one frame, at most
  const LOOKAHEAD = 16000;             // proposals the simulation keeps ahead of the display
  const RATE = [320, 960];             // proposals shown per second at the start, and ...
  const RATE_RAMP = 48000;             // ... from this many proposals on
  const MIN_TEST_S = [1.25, 0.65];     // a test of paint is shown at least this long, at the start and ...
  const MIN_TEST_RAMP = 40000;         // ... from this many proposals on (a visitor who stays sees it quicken)
  const FINALE_PSNR = 34;              // dB: the portrait is done at this PSNR ...
  const FINALE_AT = 60000;             // ... or after this many proposals
  const SETTLE = 10;                   // the self-portrait has settled after this many tests that left the program as it was ...
  const SETTLE_PSNR = 19.5;            // ... once it matches its own text this well (dB)
  const FINALE_MAX = 64000;            // proposals of the self-portrait before it stops, unsettled
  const T_LIFT = 650;                  // the photo flies from the page into the figure
  const T_GROUND = 420;                // the page fades under the paper
  const T_SHOW = 360;                  // the program, the charts and the caption fade in
  const T_FORGET = 700;                // the photo fades to blank paper
  const T_RETURN = 560;                // the way back
  const VERDICT_MS = 1700;             // a verdict stays this long beside its line (an edit to improve: twice)
  const CHROME_REGION = [240, 120];    // px: the bottom-right region that reveals the Return button
  const CHROME_HIDE_MS = 1800;
  const CHROME_TAP_MS = 3500;
  const TEXT_FONT = '700 11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const TEXT_LINE = 13;                // px per line of the program's own text, as the sitter

  /* ---------------------------------------------------------------------------
   * The program: ten lines, each one of a few values. `say` is the listing's wording,
   * `short` the program's own text (the sitter of the finale).
   * ------------------------------------------------------------------------- */
  const words = map => v => map[v];
  const LINES = [
    { id: 'size', fn: 'paint', values: [40, 28, 20, 14, 10, 7, 5, 4, 3, 2], say: String },
    { id: 'where', fn: 'paint', values: ['anywhere', 'error', 'edges', 'near'],
      say: words({ anywhere: 'anywhere', error: 'where the error is largest', edges: 'on the sitter’s edges', near: 'near the last square' }) },
    { id: 'colour', fn: 'paint', values: ['random', 'centre', 'mean', 'best'],
      say: words({ random: 'a random colour', centre: 'the sitter at its centre', mean: 'the sitter’s mean', best: 'the best fit' }) },
    { id: 'alpha', fn: 'paint', values: [0.9, 0.7, 0.5, 0.35, 0.2, 0.1], say: String },
    { id: 'tries', fn: 'paint', values: [1, 2, 4, 8, 16], say: v => `best of ${v}`, rest: () => ', drawn if it helps' },
    { id: 'every', fn: 'improve', values: [200, 400, 800, 1600], say: v => `${v} proposals`, rest: () => ': edit one line of paint' },
    { id: 'step', fn: 'improve', values: ['notch', 'jump'], say: words({ notch: 'one notch', jump: 'to any value' }) },
    { id: 'pick', fn: 'improve', values: ['any', 'stale'], say: words({ any: 'any line', stale: 'the line edited longest ago' }) },
    { id: 'keep', fn: 'improve', values: ['noworse', 'always'], say: words({ noworse: 'if no worse', always: 'always' }),
      rest: v => (v === 'noworse' ? ', tried from the same canvas' : ''), short: words({ noworse: 'no worse', always: 'always' }) },
    { id: 'self', fn: 'improve', values: [3, 6, 12], say: v => `every ${v} edits`, rest: () => ': edit improve, this line too' }
  ];
  const LINE = Object.fromEntries(LINES.map(line => [line.id, line]));
  const PAINT = LINES.filter(line => line.fn === 'paint').map(line => line.id);
  const IMPROVE = LINES.filter(line => line.fn === 'improve').map(line => line.id);
  // The first self: crude squares, careful edits.
  const FIRST = { size: 0, where: 0, colour: 1, alpha: 0, tries: 0, every: 2, step: 0, pick: 1, keep: 0, self: 1 };
  const val = (prog, id) => LINE[id].values[prog[id]];
  const shortOf = (id, index) => { const line = LINE[id]; const v = line.values[index]; return line.short ? line.short(v) : String(v); };
  // The program's own text: what the finale paints.
  const textOf = prog => ['paint', ...PAINT.map(id => ` ${id} ${shortOf(id, prog[id])}`),
    'improve', ...IMPROVE.map(id => ` ${id} ${shortOf(id, prog[id])}`)].join('\n');

  /* ---------------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------------- */
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function parseColour(text) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?/.exec(text || '');
    if (!m) return null;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
    return [+m[1], +m[2], +m[3], a];
  }
  const group = n => Math.round(n).toLocaleString('en-US');
  const signed = (v, digits = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;

  /* ---------------------------------------------------------------------------
   * The simulation (no DOM but the text sitter's canvas)
   * ------------------------------------------------------------------------- */
  const N3 = GRID * GRID * 3;
  const CW = Math.ceil(GRID / CELL);
  const psnrOf = E => 10 * Math.log10(N3 / Math.max(E, 1e-9));

  // A target ("world"): its pixels, their integral image (for means), an edge CDF.
  function makeWorld(T) {
    const IW = GRID + 1;
    const integ = new Float64Array(IW * IW * 3);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        for (let c = 0; c < 3; c++) {
          integ[((y + 1) * IW + x + 1) * 3 + c] = T[(y * GRID + x) * 3 + c] + integ[(y * IW + x + 1) * 3 + c] +
            integ[((y + 1) * IW + x) * 3 + c] - integ[(y * IW + x) * 3 + c];
        }
      }
    }
    // Edge strength: a Sobel filter on luminance, plus a floor, as a CDF for sampling.
    const L = new Float32Array(GRID * GRID);
    for (let i = 0; i < L.length; i++) L[i] = 0.299 * T[i * 3] + 0.587 * T[i * 3 + 1] + 0.114 * T[i * 3 + 2];
    const at = (x, y) => L[clamp(y, 0, GRID - 1) * GRID + clamp(x, 0, GRID - 1)];
    const cdf = new Float64Array(GRID * GRID);
    let acc = 0;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
        const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
        acc += Math.hypot(gx, gy) + 0.02;
        cdf[y * GRID + x] = acc;
      }
    }
    return { T, integ, cdf };
  }

  // The error of the canvas P against a world, per cell of the error map and in total.
  function measure(w, P, cellErr) {
    cellErr.fill(0);
    let E = 0;
    for (let y = 0; y < GRID; y++) {
      const row = Math.floor(y / CELL) * CW;
      for (let x = 0; x < GRID; x++) {
        const i = (y * GRID + x) * 3;
        const e = (P[i] - w.T[i]) ** 2 + (P[i + 1] - w.T[i + 1]) ** 2 + (P[i + 2] - w.T[i + 2]) ** 2;
        cellErr[row + Math.floor(x / CELL)] += e; E += e;
      }
    }
    return E;
  }
  function blankState(w, paper, seed) {
    const P = new Float32Array(N3);
    for (let i = 0; i < N3; i += 3) { P[i] = paper[0]; P[i + 1] = paper[1]; P[i + 2] = paper[2]; }
    const cellErr = new Float64Array(CW * CW);
    return { P, cellErr, E: measure(w, P, cellErr), rng: seed >>> 0, lastX: -1, lastY: -1, proposals: 0, sampled: 0, strokes: 0 };
  }
  // A copy of a state; with a world, measured against that world (the finale's other sitter).
  function fork(s, w) {
    const copy = { ...s, P: s.P.slice(), cellErr: s.cellErr.slice() };
    if (w) copy.E = measure(w, copy.P, copy.cellErr);
    return copy;
  }
  // mulberry32, kept in the state so that two copies draw the same numbers.
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function gauss(s) { let u = 0; while (u === 0) u = rand(s); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand(s)); }

  // One proposal: a square chosen by paint, and its dE.
  const sums = new Float64Array(9);
  function propose(w, s, prog, out) {
    const { T, integ, cdf } = w;
    const IW = GRID + 1;
    const z = val(prog, 'size'); const a = val(prog, 'alpha');
    const where = val(prog, 'where');
    let cx; let cy;
    if (where === 'error') {
      let u = rand(s) * s.E; let k = 0;
      const n = s.cellErr.length;
      for (; k < n - 1; k++) { u -= s.cellErr[k]; if (u <= 0) break; }
      cx = ((k % CW) + rand(s)) * CELL; cy = (Math.floor(k / CW) + rand(s)) * CELL;
    } else if (where === 'edges') {
      const u = rand(s) * cdf[cdf.length - 1];
      let lo = 0; let hi = cdf.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
      cx = (lo % GRID) + rand(s); cy = Math.floor(lo / GRID) + rand(s);
    } else if (where === 'near' && s.lastX >= 0) {
      cx = s.lastX + gauss(s) * z * 1.5; cy = s.lastY + gauss(s) * z * 1.5;
    } else {
      cx = rand(s) * GRID; cy = rand(s) * GRID;
    }
    const x0 = clamp(Math.round(cx - z / 2), 0, GRID - z);
    const y0 = clamp(Math.round(cy - z / 2), 0, GRID - z);
    const n = z * z;
    sums.fill(0);   // sum p, sum p^2, sum p t, per channel
    const P = s.P;
    for (let y = y0; y < y0 + z; y++) {
      let i = (y * GRID + x0) * 3;
      for (let x = 0; x < z; x++, i += 3) {
        const p0 = P[i]; const p1 = P[i + 1]; const p2 = P[i + 2];
        sums[0] += p0; sums[1] += p1; sums[2] += p2;
        sums[3] += p0 * p0; sums[4] += p1 * p1; sums[5] += p2 * p2;
        sums[6] += p0 * T[i]; sums[7] += p1 * T[i + 1]; sums[8] += p2 * T[i + 2];
      }
    }
    const colour = val(prog, 'colour');
    let d = 0;
    for (let c = 0; c < 3; c++) {
      const st = integ[((y0 + z) * IW + x0 + z) * 3 + c] - integ[(y0 * IW + x0 + z) * 3 + c] -
        integ[((y0 + z) * IW + x0) * 3 + c] + integ[(y0 * IW + x0) * 3 + c];
      let k;
      if (colour === 'random') k = rand(s);
      else if (colour === 'centre') k = T[(clamp(Math.floor(cy), 0, GRID - 1) * GRID + clamp(Math.floor(cx), 0, GRID - 1)) * 3 + c];
      else if (colour === 'mean') k = st / n;
      else k = clamp((st / n - (1 - a) * sums[c] / n) / a, 0, 1);
      k = Math.round(k * 255) / 255;   // the display's colours are bytes: paint with what it can show
      out.c[c] = k;
      const sp = sums[c]; const spp = sums[3 + c]; const spt = sums[6 + c];
      d += 2 * a * (k * sp - spp - k * st + spt) + a * a * (k * k * n - 2 * k * sp + spp);
    }
    out.x = x0; out.y = y0; out.z = z; out.a = a; out.d = d;
    return out;
  }
  function draw(w, s, q) {
    const { T } = w;
    let total = 0;
    for (let y = q.y; y < q.y + q.z; y++) {
      const row = Math.floor(y / CELL) * CW;
      let i = (y * GRID + q.x) * 3;
      for (let x = q.x; x < q.x + q.z; x++, i += 3) {
        let de = 0;
        for (let c = 0; c < 3; c++) {
          const p = s.P[i + c]; const v = (1 - q.a) * p + q.a * q.c[c]; const t = T[i + c];
          de += (v - t) * (v - t) - (p - t) * (p - t);
          s.P[i + c] = v;
        }
        s.cellErr[row + Math.floor(x / CELL)] += de; total += de;
      }
    }
    s.E += total; s.lastX = q.x + q.z / 2; s.lastY = q.y + q.z / 2; s.strokes++;
  }

  const proposal = { x: 0, y: 0, z: 0, a: 0, d: 0, c: [0, 0, 0] };
  const chosen = { x: 0, y: 0, z: 0, a: 0, d: 0, c: [0, 0, 0] };
  // Paint `budget` proposals with one program. Logs the squares drawn and a PSNR sample every
  // SAMPLE proposals; yields every SLICE proposals.
  function* paintFor(w, s, prog, budget, log) {
    const end = s.proposals + budget;
    const tries = val(prog, 'tries');
    // The work of one proposal, in cells visited: its square, the error map's scan, a constant.
    const work = val(prog, 'size') ** 2 + (val(prog, 'where') === 'error' ? CW * CW / 2 : 0) + 16;
    let done = 0;
    while (s.proposals < end) {
      const k = Math.min(tries, end - s.proposals);
      chosen.d = Infinity;
      for (let j = 0; j < k; j++) {
        propose(w, s, prog, proposal);
        if (proposal.d < chosen.d) {
          chosen.x = proposal.x; chosen.y = proposal.y; chosen.z = proposal.z; chosen.a = proposal.a; chosen.d = proposal.d;
          chosen.c[0] = proposal.c[0]; chosen.c[1] = proposal.c[1]; chosen.c[2] = proposal.c[2];
        }
      }
      s.proposals += k;
      if (chosen.d < -1e-9) {
        draw(w, s, chosen);
        log.push({ k: 's', at: s.proposals, x: chosen.x, y: chosen.y, z: chosen.z, a: chosen.a,
          r: Math.round(chosen.c[0] * 255), g: Math.round(chosen.c[1] * 255), b: Math.round(chosen.c[2] * 255) });
      }
      while (s.sampled + SAMPLE <= s.proposals) { s.sampled += SAMPLE; log.push({ k: 'p', at: s.sampled, v: psnrOf(s.E) }); }
      done += k * work;
      if (done >= SLICE) { done = 0; yield; }
    }
  }

  // Which line improve edits, and to what.
  function pickLine(s, prog, meta, ids) {
    if (val(prog, 'pick') === 'stale') {
      let pick = ids[0]; let oldest = Infinity;
      for (const id of ids) { const at = (meta.editedAt[id] ?? -1) + rand(s) * 0.5; if (at < oldest) { oldest = at; pick = id; } }
      return pick;
    }
    return ids[Math.floor(rand(s) * ids.length)];
  }
  function stepValue(s, prog, id) {
    const n = LINE[id].values.length; const now = prog[id];
    if (val(prog, 'step') === 'jump') { let v = Math.floor(rand(s) * (n - 1)); if (v >= now) v++; return v; }
    let v = now + (rand(s) < 0.5 ? -1 : 1);
    if (v < 0) v = 1; else if (v >= n) v = n - 2;
    return v;
  }
  const copyMeta = meta => ({ ...meta, editedAt: { ...meta.editedAt } });
  // The PSNR difference (edited − current) at each shared sample of two copies' logs.
  function differences(logA, logB) {
    const a = new Map();
    for (const e of logA) if (e.k === 'p') a.set(e.at, e.v);
    const out = [];
    for (const e of logB) if (e.k === 'p' && a.has(e.at)) out.push(e.v - a.get(e.at));
    return Float32Array.from(out);
  }

  // A test of paint: improve edits one line; both selves paint one window from the same canvas.
  function* testPaint(env, st, prog, meta, limit, log) {
    const id = pickLine(st, prog, meta, PAINT); const to = stepValue(st, prog, id);
    const next = { ...prog, [id]: to };
    const len = Math.min(val(prog, 'every'), limit);
    const wA = env.worldFor(prog); const wB = env.worldFor(next);
    const A = fork(st); const B = fork(st, wB === wA ? null : wB);
    const logA = []; const logB = [];
    yield* paintFor(wA, A, prog, len, logA);
    yield* paintFor(wB, B, next, len, logB);
    yield;
    const keep = val(prog, 'keep') === 'always' || B.E <= A.E;
    meta.editedAt[id] = meta.tests++;
    log.push({ k: 't', level: 1, at: st.proposals, end: st.proposals + len, line: id, from: prog[id], to, keep,
      gain: psnrOf(B.E) - psnrOf(A.E), diff: differences(logA, logB) });
    for (const e of keep ? logB : logA) log.push(e);
    return keep ? [B, next] : [A, prog];
  }

  // A test of improve: improve edits one of its own lines; both selves run HORIZON windows of
  // tests of paint from the same canvas, with the same number of proposals.
  function* testImprove(env, st, prog, meta, log) {
    const id = pickLine(st, prog, meta, IMPROVE); const to = stepValue(st, prog, id);
    const next = { ...prog, [id]: to };
    const budget = HORIZON * val(prog, 'every');
    const end = st.proposals + budget;
    function* run(p) {
      const w = env.worldFor(p);
      let s = fork(st, w === env.worldFor(prog) ? null : w); let q = p;
      const m = copyMeta(meta); const sub = [];
      while (s.proposals < end) [s, q] = yield* testPaint(env, s, q, m, end - s.proposals, sub);
      return { s, q, m, sub };
    }
    const a = yield* run(prog);
    const b = yield* run(next);
    yield;
    const keep = val(prog, 'keep') === 'always' || b.s.E <= a.s.E;
    const won = keep ? b : a;
    log.push({ k: 't', level: 2, at: st.proposals, end, line: id, from: prog[id], to, keep,
      gain: psnrOf(b.s.E) - psnrOf(a.s.E), diff: differences(a.sub, b.sub) });
    yield;
    for (const e of won.sub) log.push(e);
    Object.assign(meta, won.m);
    meta.editedAt = { ...won.m.editedAt, [id]: meta.tests };
    meta.since = 0;
    return [won.s, won.q];
  }

  // The whole life: tests of paint, a test of improve every `self` of them, then the finale.
  function* life(env) {
    while (!env.done) {
      if (!env.finale && (psnrOf(env.state.E) >= FINALE_PSNR || env.state.proposals >= env.finaleProposals)) {
        env.finale = true; env.finaleAt = env.state.proposals;
        env.state = fork(env.state, env.worldFor(env.prog));
        env.live.push({ k: 'f', at: env.finaleAt });
      }
      const before = textOf(env.prog);
      const log = [];
      let result;
      if (env.meta.since >= val(env.prog, 'self')) result = yield* testImprove(env, env.state, env.prog, env.meta, log);
      else { result = yield* testPaint(env, env.state, env.prog, env.meta, Infinity, log); env.meta.since++; }
      [env.state, env.prog] = result;
      yield;
      for (const e of log) env.live.push(e);
      env.committed = env.state.proposals;
      if (env.finale) {
        env.calm = textOf(env.prog) === before ? env.calm + 1 : 0;
        const settled = env.calm >= SETTLE && psnrOf(env.state.E) >= SETTLE_PSNR;
        if (settled || env.committed - env.finaleAt >= FINALE_MAX) {
          env.live.push({ k: 'e', at: env.committed, settled });
          env.done = true;
        }
      }
    }
  }

  /* ---------------------------------------------------------------------------
   * Targets: the photo, and the program's own text
   * ------------------------------------------------------------------------- */
  function pixelsOf(canvas) {
    const data = canvas.getContext('2d').getImageData(0, 0, GRID, GRID).data;
    const T = new Float32Array(N3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) { T[j] = data[i] / 255; T[j + 1] = data[i + 1] / 255; T[j + 2] = data[i + 2] / 255; }
    return T;
  }
  // The photo's pixels at GRID x GRID: from the page's own <img> when it has loaded, else from
  // a fresh load of its file (a load event, since decode() can wait for a hidden tab).
  async function photoTarget(photo, src) {
    let image = photo;
    if (!(photo && photo.complete && photo.naturalWidth)) {
      image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = src; });
    }
    const canvas = makeCanvas(GRID, GRID);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    // A centred square crop, as the page's object-fit would show it.
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, GRID, GRID);
    return pixelsOf(canvas);
  }
  function textTarget(text, paper, ink) {
    const canvas = makeCanvas(GRID, GRID);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.fillStyle = `rgb(${paper.map(v => Math.round(v * 255)).join(',')})`;
    g.fillRect(0, 0, GRID, GRID);
    g.fillStyle = ink; g.font = TEXT_FONT; g.textBaseline = 'alphabetic';
    const lines = text.split('\n');
    const top = Math.round((GRID - lines.length * TEXT_LINE) / 2) + 10;
    lines.forEach((line, i) => g.fillText(line, 10, top + i * TEXT_LINE));
    return pixelsOf(canvas);
  }

  /* ---------------------------------------------------------------------------
   * Sound (Web Audio, synthesized): a sonification of the process, on D major pentatonic as
   * Spira and the lenses are.
   *   the brush   band-passed noise, as loud as the paint laid each second (cells x alpha) and
   *               as high as the squares are small: broad low strokes at first, a fine hiss later
   *   the beat    two sines on D3, one detuned by the distance to the goal (the portrait's
   *               FINALE_PSNR, then the program's own text), so they beat slower as it nears;
   *               at the fixed point the beat stops and the tone stands still
   *   a verdict   kept: a bell on the line's degree (paint in octave 5, improve a dyad in
   *               octave 4); not kept: a damped pluck an octave lower; the rule that rewrote
   *               itself plays its motif, then the motif again twice, each time twice as fast
   *               and an octave higher
   *   the finale  a swell as the sitter changes; the end a rising arpeggio when it settles, an
   *               open suspended chord when it does not, then silence
   * The site's sound preference holds (localStorage SOUND_KEY, shared with Spira and the
   * lenses); M or the Sound button switches it. The synthesizer runs on any BaseAudioContext,
   * so an OfflineAudioContext renders exactly the cues the egg plays (the tests measure them).
   *   voice -> panner -> dry -------------------------> master -> compressor -> out
   *                   \-> reverb send -> convolver --/
   * ------------------------------------------------------------------------- */
  const SOUND_KEY = 'spira-sound';
  const AUDIO_MASTER = 0.8;
  const AUDIO_FADE_IN = 1.5;            // s
  const AUDIO_TOGGLE = 0.25;            // s: the ramp when the sound is switched or held
  const AUDIO_COMPRESSOR = { threshold: -18, ratio: 4, knee: 12 };
  const AUDIO_VOICES = 48;              // one-shot voices beyond this are dropped
  const REVERB = { seconds: 2.6, predelay: 0.02, send: 0.3 };
  const PENTATONIC = [0, 2, 4, 7, 9];   // semitones above D
  const BEAT = { root: 50, fifth: 57, gain: 0.035, fifthGain: 0.015, max: 2.4, glide: 0.6, cutoff: 900, attack: 2.5 };
  const BEAT_GOAL_FINALE = 25;          // dB: the beat's goal against the program's own text (it stops at the fixed point)
  const BRUSH = { gain: 0.09, low: 280, high: 2400, q: 1.1, glide: 0.18, full: 5000, curve: 0.35 };
  const NOTE = { kept: 0.07, not: 0.05, improve: 0.055, motif: 0.24, gapMs: 70 };
  const BELL_RATIOS = [1, 2, 2.76, 4.07];
  const BELL_GAINS = [1, 0.35, 0.22, 0.08];
  const BELL_DECAYS = [2.2, 1.3, 1.0, 0.6];   // s to near silence
  const SWELL = { attack: 1.4, hold: 0.6, release: 3, gain: 0.022, cutoff: 1400, detune: 6 };
  const FINALE_CHORD = [62, 66, 69, 76];      // D4 F#4 A4 E5
  const SETTLED_CHORD = [50, 62, 66, 69, 76]; // D add9, arpeggiated: resolved
  const UNSETTLED_CHORD = [45, 52, 54, 59, 62]; // A6sus, left open
  const WHOOSH = { gain: 0.075, low: 300, high: 1800, q: 0.8 };
  const REST = { after: 5, fade: 6 };         // s: after the ending, the sound fades to silence
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  // A line's degree: its place in its part (paint: size D ... tries B; improve: every D ... self B).
  const degreeOf = id => (LINE[id].fn === 'paint' ? PAINT : IMPROVE).indexOf(id);

  function createPortraitAudio(context, options = {}) {
    const offline = typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext;
    const rate = context.sampleRate;
    let enabled = true; let closed = false; let held = false;
    const audio = { context, offline, scheduled: 0, alive: 0 };
    let seed = 0x5eed;
    const random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = AUDIO_COMPRESSOR.threshold; compressor.ratio.value = AUDIO_COMPRESSOR.ratio; compressor.knee.value = AUDIO_COMPRESSOR.knee;
    compressor.connect(context.destination);
    const master = context.createGain(); master.connect(compressor);
    const start0 = context.currentTime;
    if (options.fadeIn === false) master.gain.value = AUDIO_MASTER;
    else { master.gain.setValueAtTime(0, start0); master.gain.linearRampToValueAtTime(AUDIO_MASTER, start0 + AUDIO_FADE_IN); }
    const dry = context.createGain(); dry.connect(master);
    const convolver = context.createConvolver(); convolver.connect(master);
    const send = context.createGain(); send.gain.value = REVERB.send; send.connect(convolver);
    const noise = context.createBuffer(1, Math.round(2 * rate), rate);
    { const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1; }
    // Reverb: stereo noise decaying to -60 dB in REVERB.seconds, a lowpass closing along the tail.
    function buildImpulse() {
      if (closed) return;
      const pre = Math.round(REVERB.predelay * rate); const length = pre + Math.round(REVERB.seconds * rate);
      const ir = context.createBuffer(2, length, rate); const tau = REVERB.seconds / 6.91;
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch); let low = 0;
        for (let i = pre; i < length; i++) {
          const t = (i - pre) / rate;
          low += (0.75 - 0.6 * Math.min(1, t / REVERB.seconds)) * ((random() * 2 - 1) - low);
          data[i] = low * Math.exp(-t / tau);
        }
      }
      try { convolver.buffer = ir; } catch (error) { /* a closed context */ }
    }
    if (offline) buildImpulse(); else setTimeout(buildImpulse, 40);

    const ready = () => enabled && !closed && !held && (offline || context.state === 'running');
    const roomFor = () => audio.alive < AUDIO_VOICES;
    const at = t => Math.max(t, context.currentTime);
    function panned(node, pan, wet = true) {
      const panner = context.createStereoPanner(); panner.pan.value = clamp(pan || 0, -1, 1);
      node.connect(panner); panner.connect(dry);
      if (wet) panner.connect(send);
      return panner;
    }
    function voice(source, t, end) {
      audio.scheduled++; audio.alive++;
      source.onended = () => { audio.alive--; };
      source.start(t); source.stop(end);
    }
    function noiseSource() {
      const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
      return source;
    }

    /* Continuous voices: the beat and the brush (silent until set) ------------- */
    const beatOut = context.createGain(); beatOut.gain.value = 0;
    const beatTone = context.createBiquadFilter(); beatTone.type = 'lowpass'; beatTone.frequency.value = BEAT.cutoff;
    beatOut.connect(beatTone); panned(beatTone, 0, true);
    const beatVoices = [[BEAT.root, BEAT.gain / 2], [BEAT.root, BEAT.gain / 2], [BEAT.fifth, BEAT.fifthGain]].map(([m, g]) => {
      const o = context.createOscillator(); o.type = 'sine'; o.frequency.value = midiHz(m);
      const amp = context.createGain(); amp.gain.value = g;
      o.connect(amp); amp.connect(beatOut); o.start(start0);
      return { o, amp };
    });
    let beatStill = false;
    const brushSource = noiseSource();
    const brushBand = context.createBiquadFilter(); brushBand.type = 'bandpass'; brushBand.frequency.value = BRUSH.low; brushBand.Q.value = BRUSH.q;
    const brushOut = context.createGain(); brushOut.gain.value = 0;
    brushSource.connect(brushBand); brushBand.connect(brushOut); panned(brushOut, -0.15, false);
    brushSource.start(start0);

    /* One-shot voices ---------------------------------------------------------- */
    // A bell: four sine partials, a 4 ms attack, exponential decays (as Spira's).
    function bell(m, t, g, pan = 0, stretch = 1) {
      if (!ready() || !roomFor() || !(g > 0)) return;
      t = at(t);
      const sum = context.createGain(); const out = panned(sum, pan);
      const f = midiHz(m);
      for (let k = 0; k < BELL_RATIOS.length; k++) {
        const fk = f * BELL_RATIOS[k]; if (fk > rate * 0.45) continue;
        const amp = context.createGain(); amp.connect(out);
        const peak = g * BELL_GAINS[k]; const decay = BELL_DECAYS[k] * stretch;
        amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(peak, t + 0.004);
        amp.gain.exponentialRampToValueAtTime(peak * 1e-3, t + 0.004 + decay);
        const o = context.createOscillator(); o.type = 'sine'; o.frequency.value = fk; o.connect(amp);
        voice(o, t, t + 0.05 + decay);
      }
    }
    // A damped pluck: a triangle through a lowpass, gone in a fifth of a second.
    function pluck(m, t, g, pan = 0) {
      if (!ready() || !roomFor()) return;
      t = at(t);
      const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 900; lowpass.Q.value = 0.5;
      const amp = context.createGain(); amp.connect(lowpass); panned(lowpass, pan, false);
      amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(g, t + 0.003);
      amp.gain.exponentialRampToValueAtTime(g * 1e-3, t + 0.2);
      const o = context.createOscillator(); o.type = 'triangle'; o.frequency.value = midiHz(m); o.connect(amp);
      voice(o, t, t + 0.25);
    }
    // A swell: a soft chord of detuned triangle pairs through a lowpass.
    function swell(chord, t, g = SWELL.gain) {
      if (!ready()) return;
      t = at(t);
      const end = t + SWELL.attack + SWELL.hold + SWELL.release;
      const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = SWELL.cutoff; lowpass.Q.value = 0.3;
      const amp = context.createGain(); amp.connect(lowpass); panned(lowpass, 0);
      amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(g, t + SWELL.attack);
      amp.gain.setValueAtTime(g, t + SWELL.attack + SWELL.hold); amp.gain.linearRampToValueAtTime(0, end);
      for (const m of chord) {
        for (const cents of [-SWELL.detune, SWELL.detune]) {
          if (!roomFor()) return;
          const o = context.createOscillator(); o.type = 'triangle'; o.frequency.value = midiHz(m); o.detune.value = cents; o.connect(amp);
          voice(o, t, end + 0.05);
        }
      }
    }
    function whoosh(t, up, duration) {
      if (!ready() || !roomFor()) return;
      t = at(t);
      const source = noiseSource();
      const band = context.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = WHOOSH.q;
      const [from, to] = up ? [WHOOSH.low, WHOOSH.high] : [WHOOSH.high, WHOOSH.low];
      band.frequency.setValueAtTime(from, t); band.frequency.exponentialRampToValueAtTime(to, t + duration);
      const amp = context.createGain();
      amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(WHOOSH.gain, t + duration * 0.45);
      amp.gain.linearRampToValueAtTime(0, t + duration);
      source.connect(band); band.connect(amp); panned(amp, 0);
      voice(source, t, t + duration + 0.05);
    }

    function rampMaster(value, t, seconds) {
      const p = master.gain; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(value, t + seconds);
    }
    let lastNote = -1e9;
    Object.assign(audio, {
      get ready() { return ready(); },
      get enabled() { return enabled; },
      get state() { return offline ? 'offline' : context.state; },
      now: () => context.currentTime,
      // The beat: its presence (0..1) and its rate in Hz, gliding. At a rate of zero the two
      // roots would meet at whatever phase the glide left them (even cancelling), so the
      // detuned one fades and the other takes its share: the tone stands still at full strength.
      beat(level, hz, t = context.currentTime) {
        if (closed) return;
        t = at(t);
        beatOut.gain.setTargetAtTime(clamp(level, 0, 1), t, level > beatOut.gain.value ? BEAT.attack / 3 : 0.4);
        const still = hz <= 0.001;
        if (still !== beatStill) {
          beatStill = still;
          beatVoices[0].amp.gain.setTargetAtTime(still ? BEAT.gain : BEAT.gain / 2, t, BEAT.glide);
          beatVoices[1].amp.gain.setTargetAtTime(still ? 0 : BEAT.gain / 2, t, BEAT.glide);
        }
        beatVoices[1].o.frequency.setTargetAtTime(midiHz(BEAT.root) + clamp(hz, 0, BEAT.max), t, BEAT.glide);
      },
      // The brush: paint laid per second (cells x alpha) and the mean side of its squares.
      brush(perSecond, side, t = context.currentTime) {
        if (closed) return;
        t = at(t);
        const level = perSecond > 0 ? BRUSH.gain * Math.pow(clamp(perSecond / BRUSH.full, 0, 1), BRUSH.curve) : 0;
        const f = clamp(BRUSH.low * Math.pow(40 / Math.max(1, side || 40), 0.65), BRUSH.low, BRUSH.high);
        brushOut.gain.setTargetAtTime(level, t, BRUSH.glide);
        if (perSecond > 0) brushBand.frequency.setTargetAtTime(f, t, BRUSH.glide);
      },
      cue: {
        // A verdict: level 1 or 2, the line's degree, kept or not, the rule rewriting itself.
        verdict(t, level, degree, kept, itself = false) {
          const now = context.currentTime;
          if (now - lastNote < NOTE.gapMs / 1000 && !itself) return;
          lastNote = now;
          const pan = level === 2 ? 0.25 : -0.05;
          const m = (level === 2 ? 50 : 74) + PENTATONIC[degree];
          if (!kept) { pluck(m - 12, t, NOTE.not, pan); return; }
          if (level === 1) { bell(m, t, NOTE.kept, pan); return; }
          if (!itself) { bell(m, t, NOTE.improve, pan, 1.3); bell(m + 7, t + 0.09, NOTE.improve * 0.7, pan, 1.3); return; }
          // The motif, then itself again: twice as fast and an octave higher, twice.
          let start = t; let step = NOTE.motif; let g = NOTE.improve;
          for (let k = 0; k < 3; k++) {
            bell(m + 12 * k, start, g, pan, 1.1); bell(m + 12 * k + 7, start + step, g * 0.7, pan, 1.1);
            start += 2 * step; step /= 2; g *= 0.6;
          }
        },
        finale(t) { swell(FINALE_CHORD, t); bell(62, t, NOTE.improve * 0.8, 0, 1.4); },
        ending(t, settled) {
          if (settled) {
            SETTLED_CHORD.forEach((m, i) => bell(m, t + i * 0.24, NOTE.kept * (1 - i * 0.1), (i - 2) * 0.15, 1.4));
            swell(SETTLED_CHORD.slice(0, 3), t, SWELL.gain * 0.8);
          } else {
            swell(UNSETTLED_CHORD, t, SWELL.gain);
          }
        },
        whoosh(t, up, duration) { whoosh(t, up, duration); }
      },
      // Everything fades to silence (after the end); a live context is then suspended.
      rest(t = context.currentTime, seconds = REST.fade) {
        if (closed) return;
        rampMaster(0, at(t), seconds);
        if (!offline) setTimeout(() => { if (!closed && context.state === 'running') context.suspend().catch(() => {}); }, (at(t) - context.currentTime + seconds) * 1000 + 100);
      },
      // Held (Space, a hidden tab): the master drops; released, it returns.
      hold(value) {
        if (closed || held === value) return;
        held = value;
        if (!enabled) return;
        rampMaster(held ? 0 : AUDIO_MASTER, context.currentTime, AUDIO_TOGGLE);
      },
      setEnabled(value) {
        if (closed || enabled === value) return;
        enabled = value;
        const t = context.currentTime;
        if (enabled) {
          if (!offline && context.state === 'suspended') context.resume().catch(() => {});
          if (!held) rampMaster(AUDIO_MASTER, t, AUDIO_TOGGLE);
        } else {
          rampMaster(0, t, AUDIO_TOGGLE);
          if (!offline) setTimeout(() => { if (!enabled && !closed && context.state === 'running') context.suspend().catch(() => {}); }, AUDIO_TOGGLE * 1000 + 80);
        }
      },
      // Fade (unless fast) and close the context.
      close(fast) {
        if (closed) return;
        const t = context.currentTime;
        if (!fast && !offline && context.state === 'running') rampMaster(0, t, 0.3);
        closed = true;
        if (offline) return;
        setTimeout(() => { try { context.close().catch(() => {}); } catch (error) { /* already closed */ } }, fast ? 0 : 360);
      }
    });
    return audio;
  }

  /* ---------------------------------------------------------------------------
   * The egg
   * ------------------------------------------------------------------------- */
  let active = false;

  /**
   * Opens the self-portrait. Options: photo (the <img> to paint; default the homepage photo),
   * and test hooks: seed, rate (proposals shown per second, fixed and uncapped), finaleAt
   * (proposals before the finale), simMs (the simulation's share of a frame). Resolves true
   * when it opened.
   */
  async function open(options) {
    if (active) return false;
    options = options || {};
    const photo = options.photo || document.querySelector('[data-egg-trigger]');
    const src = photo && (photo.currentSrc || photo.src);
    if (!src) return false;
    active = true;
    try {
      const target = await photoTarget(photo, src);
      return start(options, photo, src, target);
    } catch (error) {
      active = false;
      console.warn('The self-portrait could not open.', error);
      return false;
    }
  }

  function start(options, photo, src, target) {
    const html = document.documentElement;
    const body = document.body;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let still = motion.matches;          // reduced motion: no flight, and the tests advance one at a time
    const previousFocus = document.activeElement;
    const scroll = { x: scrollX, y: scrollY };
    const overflow = body.style.getPropertyValue('overflow');
    const overflowPriority = body.style.getPropertyPriority('overflow');
    const gutter = html.style.getPropertyValue('scrollbar-gutter');
    const gutterPriority = html.style.getPropertyPriority('scrollbar-gutter');
    const hadAttribute = { htmlStyle: html.hasAttribute('style'), bodyStyle: body.hasAttribute('style') };
    const events = new AbortController();
    const on = (target, type, fn, extra) => target.addEventListener(type, fn, Object.assign({ signal: events.signal }, extra));

    // The page's colours: its paper, its ink, its accent.
    const pageStyle = getComputedStyle(body);
    const paperRGBA = parseColour(pageStyle.backgroundColor);
    const paperRGB = paperRGBA && paperRGBA[3] > 0.5 ? paperRGBA : parseColour(getComputedStyle(html).backgroundColor) || [255, 255, 255, 1];
    const paper = paperRGB.slice(0, 3).map(v => v / 255);
    const ink = pageStyle.color || '#000';
    const dark = (0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2]) < 0.5;

    /* ---- The simulation's environment --------------------------------------- */
    const seed = Number.isFinite(options.seed) ? options.seed >>> 0 : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const photoWorld = makeWorld(target);
    const textWorlds = new Map();
    const env = {
      live: [], committed: 0, done: false, finale: false, finaleAt: 0, calm: 0,
      finaleProposals: Number.isFinite(options.finaleAt) ? options.finaleAt : FINALE_AT,
      prog: { ...FIRST }, meta: { tests: 0, editedAt: {}, since: 0 },
      state: blankState(photoWorld, paper, seed),
      worldFor(prog) {
        if (!env.finale) return photoWorld;
        const text = textOf(prog);
        let w = textWorlds.get(text);
        if (!w) {
          if (textWorlds.size > 48) textWorlds.delete(textWorlds.keys().next().value);
          w = makeWorld(textTarget(text, paper, ink));
          textWorlds.set(text, w);
        }
        return w;
      }
    };
    const sim = life(env);

    /* ---- DOM ------------------------------------------------------------- */
    const dialog = document.createElement('dialog');
    dialog.id = 'portrait';
    dialog.tabIndex = -1;
    dialog.autofocus = true;             // showModal() focuses the dialog, not the caption's link (and keeps the scroll)
    dialog.setAttribute('aria-label', 'Self-portrait: a program paints the photograph and rewrites itself');
    if (dark) dialog.classList.add('is-dark');
    const ground = document.createElement('div');
    ground.className = 'portrait-ground';
    const figure = document.createElement('figure');
    figure.className = 'portrait-figure';
    const frame = document.createElement('div');
    frame.className = 'portrait-frame';
    const canvas = document.createElement('canvas');
    canvas.className = 'portrait-paint';
    const photoCopy = document.createElement('img');
    photoCopy.className = 'portrait-photo'; photoCopy.alt = ''; photoCopy.src = src;
    frame.append(canvas, photoCopy);

    // The listing: two functions, one row per line.
    const code = document.createElement('div');
    code.className = 'portrait-code';
    const rows = {};
    for (const fn of ['paint', 'improve']) {
      const head = document.createElement('div');
      head.className = 'pl-fn'; head.textContent = fn;
      code.append(head);
      for (const line of LINES.filter(l => l.fn === fn)) {
        const row = document.createElement('div');
        row.className = 'pl'; row.dataset.line = line.id;
        // key | value, the value under test, the rest of the sentence | the verdict
        const key = document.createElement('span'); key.className = 'pl-key'; key.textContent = line.id;
        const text = document.createElement('span'); text.className = 'pl-text';
        const value = document.createElement('span'); value.className = 'pl-val';
        const trial = document.createElement('span'); trial.className = 'pl-new';
        const rest = document.createElement('span'); rest.className = 'pl-rest';
        const verdict = document.createElement('span'); verdict.className = 'pl-verdict';
        text.append(value, trial, rest);
        row.append(key, text, verdict);
        code.append(row);
        rows[line.id] = { row, value, trial, rest, verdict, timer: 0 };
      }
    }
    const curveBox = document.createElement('div');
    curveBox.className = 'portrait-chart portrait-curve';
    const curveLabel = document.createElement('p');
    curveLabel.className = 'portrait-chart-label';
    curveLabel.textContent = 'PSNR against the sitter, dB';
    const curveCanvas = document.createElement('canvas');
    curveBox.append(curveLabel, curveCanvas);
    const testBox = document.createElement('div');
    testBox.className = 'portrait-chart portrait-test';
    const testLabel = document.createElement('p');
    testLabel.className = 'portrait-chart-label';
    testLabel.textContent = 'This test: edited − current, dB';
    const testCanvas = document.createElement('canvas');
    testBox.append(testLabel, testCanvas);
    const caption = document.createElement('figcaption');
    caption.className = 'portrait-caption';
    const story = document.createElement('p');
    story.className = 'portrait-story';
    const status = document.createElement('p');
    status.className = 'portrait-status';
    const note = document.createElement('p');
    note.className = 'portrait-note';
    const paperLink = document.createElement('a');
    paperLink.href = new URL('papers/godel-agent.html', ROOT).href;
    paperLink.textContent = 'Gödel Agent';
    note.append('A toy: each line chooses among a few fixed values; no model writes the edits. After the Gödel machine (Schmidhuber, 2003) and ', paperLink, '.');
    caption.append(story, status, note);
    figure.append(frame, code, curveBox, testBox, caption);
    const chrome = document.createElement('div');
    chrome.className = 'portrait-chrome';
    const stepButton = document.createElement('button');
    stepButton.type = 'button'; stepButton.className = 'portrait-button portrait-step'; stepButton.textContent = 'Next test';
    const returnButton = document.createElement('button');
    returnButton.type = 'button'; returnButton.className = 'portrait-button'; returnButton.textContent = 'Return';
    const soundButton = document.createElement('button');
    soundButton.type = 'button'; soundButton.className = 'portrait-button portrait-sound';
    const soundLabel = document.createElement('span');
    const soundKey = document.createElement('span'); soundKey.className = 'portrait-key'; soundKey.setAttribute('aria-hidden', 'true'); soundKey.textContent = 'm';
    soundButton.append(soundLabel, ' ', soundKey);
    chrome.append(stepButton, soundButton, returnButton);
    const live = document.createElement('p');
    live.className = 'portrait-live'; live.setAttribute('aria-live', 'polite');
    dialog.append(ground, figure, chrome, live);

    const STORIES = {
      portrait: '<b>Self-portrait.</b> A program paints my photograph from nothing, square by square, and rewrites itself as it goes: <code>improve</code> edits <code>paint</code>, and every few edits it edits <code>improve</code>, the rule that schedules this included. An edit is kept only if the edited program paints at least as well as the current one, both tried from the same canvas.',
      finale: '<b>Self-portrait.</b> It has painted me. Now it is its own sitter: the target is the text of its program, which it is still rewriting, so an edit also changes the picture it must match.',
      settled: '<b>Self-portrait.</b> It has stopped changing itself. The picture is the program that paints it: a fixed point.',
      unsettled: '<b>Self-portrait.</b> It has not settled: each edit it kept changed the picture it was trying to match.'
    };
    story.innerHTML = STORIES.portrait;

    /* ---- Display state ------------------------------------------------------ */
    const ctx = canvas.getContext('2d', { alpha: false });
    let scale = 1;                       // canvas pixels per cell
    let cursor = 0;                      // the proposals shown
    let next = 0;                        // the next event of env.live to show
    const shown = { ...FIRST };          // the program as shown
    let psnrShown = psnrOf(env.state.E);
    const curve = [];                    // [at, PSNR] pairs shown
    const kept = [];                     // [at, level] of the kept edits shown
    let finaleShownAt = -1;
    let finaleIndex = -1;                // where the curve starts again, against the new sitter
    let test1 = null; let test2 = null;  // the tests on screen
    let lastTest = null;                 // the last test of paint, for the chart after its end ...
    let previousTest = null;             // ... and the one before, until the new one has a sample
    let ending = null;                   // the end event, once shown
    const counts = { tests: 0, kept: 0, improveKept: 0, selfKept: 0 };
    const verdicts = [];                 // every verdict shown, for the test hooks
    let phase = 'opening';               // opening -> painting -> (ended) -> closing -> closed
    let closed = false; let raf = 0; let lastNow = 0;
    let paused = false;                  // the tab is hidden
    let held = false;                    // the visitor paused (Space)
    let rateFixed = Number.isFinite(options.rate) && options.rate > 0 ? options.rate : 0;
    const stats = { frames: 0, avgMs: 0, maxMs: 0, simMs: 0, sliceMs: 0 };
    // Sound: the synthesizer (adopted from the boot's gesture, or created on one), the site's
    // preference, a cue log for the tests, and the paint laid since the brush last listened.
    let audio = null; let audioBroken = false; let audioRested = false;
    let soundOn = true;
    try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (error) { soundOn = true; }
    const audioCues = [];
    let laid = 0; let laidSides = 0; let listenedAt = performance.now();
    const simMs = Number.isFinite(options.simMs) && options.simMs > 0 ? options.simMs : SIM_MS;

    function paintPaper() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgb(${paperRGB.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    function setRow(id) {
      const line = LINE[id]; const v = line.values[shown[id]];
      rows[id].value.textContent = line.say(v);
      rows[id].rest.textContent = line.rest ? line.rest(v) : '';
    }
    LINES.forEach(line => setRow(line.id));

    // A test begins: the line shows its proposed value beside the current one.
    function beginTest(e) {
      const r = rows[e.line];
      clearTimeout(r.timer);
      r.row.classList.remove('was-kept', 'was-reverted');
      r.row.classList.add(e.level === 2 ? 'is-testing-improve' : 'is-testing');
      r.verdict.textContent = '';
      r.trial.textContent = ` → ${LINE[e.line].say(LINE[e.line].values[e.to])}`;
      r.verdict.textContent = e.level === 2 ? `testing, ${HORIZON} windows` : 'testing';
      if (e.level === 1) { test1 = e; previousTest = lastTest; lastTest = e; } else test2 = e;
    }
    // A test ends: the verdict, then the line settles.
    function endTest(e) {
      const r = rows[e.line];
      const itself = e.level === 2 && e.line === 'self' && e.keep;
      cue(`verdict ${e.level} ${e.line} ${e.keep ? 'kept' : 'not'}${itself ? ' itself' : ''}`,
        a => a.cue.verdict(a.now(), e.level, degreeOf(e.line), e.keep, itself));
      counts.tests++;
      verdicts.push(`${e.level} ${e.line} ${e.from}>${e.to} ${e.keep ? 'kept' : 'not'}`);
      r.row.classList.remove('is-testing', 'is-testing-improve');
      const same = Math.abs(e.gain) < 0.005;
      if (e.keep) {
        counts.kept++;
        if (e.level === 2) { counts.improveKept++; if (e.line === 'self') counts.selfKept++; }
        shown[e.line] = e.to;
        setRow(e.line);
        kept.push([e.end, e.level]);
        r.row.classList.add('was-kept');
        r.trial.textContent = '';
        r.verdict.textContent = e.level === 2 && e.line === 'self' ? 'kept: it rewrote itself'
          : same ? 'kept, no worse' : e.gain < 0 ? `kept anyway, ${signed(e.gain)} dB` : `kept, ${signed(e.gain)} dB`;
      } else {
        r.row.classList.add('was-reverted');
        r.verdict.textContent = `not kept, ${signed(e.gain)} dB`;
      }
      r.timer = setTimeout(() => {
        r.row.classList.remove('was-kept', 'was-reverted');
        r.trial.textContent = ''; r.verdict.textContent = '';
      }, e.level === 2 ? VERDICT_MS * 2 : VERDICT_MS);
      if (e.level === 1) test1 = null; else test2 = null;
    }
    function stroke(e) {
      const paint = e.z * e.z * e.a;
      laid += paint; laidSides += e.z * paint;
      ctx.fillStyle = `rgba(${e.r},${e.g},${e.b},${e.a})`;
      ctx.fillRect(e.x * scale, e.y * scale, e.z * scale, e.z * scale);
    }
    // Shows every event up to `to` proposals, in order. A test's window ends with the squares and
    // the sample at its last proposal; it ends before any later event.
    const after = (e, test) => e.at > test.end || (e.at === test.end && e.k !== 's' && e.k !== 'p');
    function advance(to) {
      const events_ = env.live;
      while (next < events_.length && events_[next].at <= to) {
        const e = events_[next];
        if (test1 && after(e, test1)) endTest(test1);
        if (test2 && !test1 && after(e, test2)) endTest(test2);
        next++;
        if (e.k === 's') stroke(e);
        else if (e.k === 'p') { curve.push(e.at, e.v); psnrShown = e.v; }
        else if (e.k === 't') beginTest(e);
        else if (e.k === 'f') {
          finaleShownAt = e.at; finaleIndex = curve.length; story.innerHTML = STORIES.finale;
          announce('The portrait is done. Now it paints its own program.');
          cue('finale', a => a.cue.finale(a.now()));
        }
        else if (e.k === 'e') ending = e;
      }
      if (test1 && to >= test1.end) endTest(test1);
      if (test2 && !test1 && to >= test2.end) endTest(test2);
      if (ending && to >= ending.at && phase === 'painting' && !test1 && !test2) {
        phase = 'ended';
        cue(`ending ${ending.settled ? 'settled' : 'unsettled'}`, a => a.cue.ending(a.now(), ending.settled));
        listen(true);
        restTimer = setTimeout(() => { audioRested = true; if (audio) audio.rest(); }, REST.after * 1000);
        story.innerHTML = ending.settled ? STORIES.settled : STORIES.unsettled;
        announce(ending.settled ? 'It has stopped changing itself: the picture is the program that paints it.' : 'It has not settled.');
      }
      // Drop what has been shown, now and then.
      if (next > 4096) { events_.splice(0, next); next = 0; }
    }
    let described = '';
    function describe() {
      const improveKept = counts.improveKept;
      const text = `${group(cursor)} proposals · PSNR ${psnrShown.toFixed(1)} dB · ${counts.kept} of ${counts.tests} edits kept · improve rewrote itself ${improveKept} time${improveKept === 1 ? '' : 's'}`;
      if (text !== described) { described = text; status.textContent = text; }
    }
    let liveTimer = 0;
    function announce(text) { clearTimeout(liveTimer); liveTimer = setTimeout(() => { live.textContent = text; }, 60); }

    /* ---- Charts ------------------------------------------------------------- */
    const colours = () => {
      const cs = getComputedStyle(dialog);
      return { ink: cs.getPropertyValue('--pt-ink').trim() || ink, muted: cs.getPropertyValue('--pt-muted').trim() || '#888',
        rule: cs.getPropertyValue('--pt-rule').trim() || '#ddd', accent: cs.getPropertyValue('--pt-accent').trim() || '#004A8C' };
    };
    let palette = null;
    // Chart sizes are measured on open and on a resize, not every frame.
    const chartSize = new Map();
    function measureCharts() {
      for (const c of [curveCanvas, testCanvas]) {
        const dpr = Math.max(1, devicePixelRatio || 1);
        const w = c.clientWidth; const h = c.clientHeight;
        c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
        chartSize.set(c, [w, h, dpr]);
      }
    }
    function sizeChart(c) {
      const [w, h, dpr] = chartSize.get(c) || [1, 1, 1];
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [g, w, h];
    }
    const Y_MAX = 45;
    const CHART_FONT = '10px Lato, "Helvetica Neue", Arial, sans-serif';
    // The PSNR over the whole life: gridlines every 10 dB, the finale's change of sitter, and a
    // tick for each kept edit (an edit to improve longer, in the accent).
    function drawCurve() {
      const [g, w, h] = sizeChart(curveCanvas);
      g.clearRect(0, 0, w, h);
      const left = 20;
      const span = Math.max(12000, cursor * 1.08);
      const X = at => left + (at / span) * (w - left - 1);
      const Y = v => h - 10 - (clamp(v, 0, Y_MAX) / Y_MAX) * (h - 16);
      g.lineWidth = 1; g.font = CHART_FONT; g.textBaseline = 'middle';
      g.strokeStyle = palette.rule; g.fillStyle = palette.muted;
      for (const v of [10, 20, 30, 40]) {
        const y = Math.round(Y(v)) + 0.5;
        g.beginPath(); g.moveTo(left, y); g.lineTo(w, y); g.stroke();
        g.fillText(String(v), 0, y);
      }
      if (finaleShownAt >= 0) {
        const x = Math.round(X(finaleShownAt)) + 0.5;
        g.strokeStyle = palette.muted;
        g.beginPath(); g.moveTo(x, 2); g.lineTo(x, h - 8); g.stroke();
        const label = 'sitter: itself';
        const room = x + 4 + g.measureText(label).width <= w;
        g.textBaseline = 'top'; g.textAlign = room ? 'left' : 'right';
        g.fillText(label, room ? x + 4 : x - 4, 1);
        g.textAlign = 'left';
      }
      for (const [at, level] of kept) {
        const x = Math.round(X(at)) + 0.5;
        g.strokeStyle = level === 2 ? palette.accent : palette.muted;
        g.beginPath(); g.moveTo(x, h - (level === 2 ? 8 : 4)); g.lineTo(x, h); g.stroke();
      }
      g.strokeStyle = palette.ink; g.lineWidth = 1.25;
      g.beginPath();
      let started = false;
      for (let i = 0; i < curve.length; i += 2) {
        if (i === finaleIndex) { g.stroke(); g.beginPath(); started = false; }
        const x = X(curve[i]); const y = Y(curve[i + 1]);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke();
    }
    // The test on screen: the edited program's PSNR minus the current one's, from the same
    // canvas, revealed as its window is shown; the verdict at the end.
    let testLabelFor = null;
    function drawTest() {
      const [g, w, h] = sizeChart(testCanvas);
      g.clearRect(0, 0, w, h);
      const e = test1 && cursor - test1.at < SAMPLE && previousTest ? previousTest : test1 || lastTest;
      const running = e === test1;
      if (e !== testLabelFor) {
        testLabelFor = e;
        testLabel.textContent = e ? `This test: ${e.line} ${shortOf(e.line, e.from)} → ${shortOf(e.line, e.to)}; edited − current, dB` : 'This test: edited − current, dB';
      }
      const right = 56;
      const mid = Math.round(h / 2) + 0.5;
      g.lineWidth = 1; g.strokeStyle = palette.rule; g.font = CHART_FONT; g.textBaseline = 'middle';
      g.beginPath(); g.moveTo(14, mid); g.lineTo(w - right, mid); g.stroke();
      g.fillStyle = palette.muted; g.fillText('0', 0, mid);
      if (!e || !e.diff.length) return;
      const n = e.diff.length;
      const count = running ? clamp(Math.floor((cursor - e.at) / SAMPLE), 0, n) : n;
      let range = 0.02;
      for (let i = 0; i < n; i++) range = Math.max(range, Math.abs(e.diff[i]));
      range *= 1.1;
      const X = i => 14 + ((i + 1) / n) * (w - right - 14);
      const Y = v => mid - (v / range) * (mid - 4);
      g.strokeStyle = palette.accent; g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(14, mid);
      for (let i = 0; i < count; i++) g.lineTo(X(i), Y(e.diff[i]));
      g.stroke();
      if (!running) {
        g.fillStyle = e.keep ? palette.accent : palette.muted;
        g.fillText(e.keep ? 'kept' : 'not kept', w - right + 8, Y(e.diff[n - 1]));
      }
    }

    /* ---- Layout ------------------------------------------------------------- */
    function layoutCanvas() {
      const dpr = Math.max(1, devicePixelRatio || 1);
      const side = frame.clientWidth || 320;
      scale = Math.max(1, Math.round((side * dpr) / GRID));
      canvas.width = canvas.height = GRID * scale;
    }

    /* ---- Loop -------------------------------------------------------------- */
    function rate() {
      if (rateFixed) return rateFixed;
      const base = RATE[0] + (RATE[1] - RATE[0]) * smooth(cursor / RATE_RAMP);
      const span = test1 ? test1.end - test1.at : 800;
      const shortest = MIN_TEST_S[0] + (MIN_TEST_S[1] - MIN_TEST_S[0]) * smooth(cursor / MIN_TEST_RAMP);
      return Math.min(base, span / shortest);
    }
    function simulate(budgetMs) {
      const began = performance.now();
      while (!env.done && env.committed < cursor + LOOKAHEAD && performance.now() - began < budgetMs) {
        const t0 = performance.now();
        if (sim.next().done) env.done = true;
        stats.sliceMs = Math.max(stats.sliceMs, performance.now() - t0);
      }
      stats.simMs = Math.max(stats.simMs, performance.now() - began);
    }
    function frameLoop(now) {
      raf = 0;
      if (closed || paused || held) return;
      const began = performance.now();
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now;
      simulate(simMs);
      if (phase === 'painting' && !still) {
        cursor = Math.min(env.committed, cursor + rate() * dt);
        advance(cursor);
      }
      drawCurve(); drawTest(); describe();
      listen();
      const took = performance.now() - began;
      stats.frames++; stats.avgMs += (took - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, took);
      // At rest once the end has been shown and nothing remains to compute.
      if (phase === 'ended' && env.done) return;
      schedule();
    }
    function schedule() { if (!raf && !closed && !paused && !held) raf = requestAnimationFrame(frameLoop); }
    function hold(value) {
      held = value;
      if (audio) audio.hold(held);
      if (held) { if (raf) cancelAnimationFrame(raf); raf = 0; } else { lastNow = 0; schedule(); }
    }
    // One test at a time: show up to the end of the test of paint after the cursor (reduced
    // motion's Next test, or the right arrow).
    function skip() {
      if (closed || phase !== 'painting' && phase !== 'ended') return;
      simulate(250);
      let to = env.committed;
      for (let i = next; i < env.live.length; i++) {
        const e = env.live[i];
        if (e.k === 't' && e.level === 1) { to = Math.min(e.end, env.committed); break; }
      }
      if (test1) to = Math.min(test1.end, env.committed);
      cursor = Math.max(cursor, to);
      advance(cursor);
      drawCurve(); drawTest(); describe();
      schedule();
    }

    /* ---- Sound ------------------------------------------------------------- */
    let restTimer = 0; let lastListen = 0;
    function audioFailed(error) {
      if (!audioBroken) console.warn('The self-portrait\'s sound is unavailable.', error);
      audioBroken = true;
      const failed = audio; audio = null;
      if (failed) { try { failed.close(true); } catch (closing) { /* already closed */ } }
    }
    // The boot primes a context inside the double-click; without one (or with the sound off
    // then) a context is created on the next gesture inside the dialog.
    function adoptAudio() {
      if (audio || closed || audioBroken) return;
      const primed = window.__portraitAudioContext;
      if (primed !== undefined) { try { delete window.__portraitAudioContext; } catch (error) { window.__portraitAudioContext = undefined; } }
      if (!soundOn) { if (primed && primed.state !== 'closed') primed.close().catch(() => {}); return; }
      try {
        let context = primed && primed.state !== 'closed' ? primed : null;
        if (!context) {
          const Context = window.AudioContext || window.webkitAudioContext;
          if (!Context) return;
          context = new Context();
        }
        if (context.state === 'suspended' && !document.hidden) context.resume().catch(() => {});
        audio = createPortraitAudio(context);
        if (held) audio.hold(true);
        if (audioRested) audio.rest(audio.now(), 0.01);
      } catch (error) { audioFailed(error); }
    }
    function unlockAudio() {
      if (!soundOn || closed || closing) return;
      if (!audio) { adoptAudio(); return; }
      if (audio.state === 'suspended' && !document.hidden && !audioRested) audio.context.resume().catch(() => {});
    }
    // A cue: logged (test hook) whenever the sound is on; played when the context runs.
    function cue(name, play) {
      if (!soundOn) return;
      if (audioCues.length < 800) audioCues.push(name);
      if (!audio || !audio.ready) return;
      try { play(audio); } catch (error) { audioFailed(error); }
    }
    // The beat's rate: the distance to the goal (the portrait's PSNR, then its own text's);
    // none at a settled end.
    function beatHz() {
      if (ending && phase === 'ended' && ending.settled) return 0;
      const u = finaleShownAt >= 0 ? (BEAT_GOAL_FINALE - psnrShown) / 12 : (FINALE_PSNR - psnrShown) / 16;
      return BEAT.max * clamp(u, 0, 1);
    }
    // Every 120 ms (or now): the brush hears the paint laid since, the beat the distance.
    function listen(now = false) {
      const t = performance.now();
      if (!now && t - lastListen < 120) return;
      const seconds = Math.max(0.016, (t - listenedAt) / 1000);
      const perSecond = laid / seconds; const side = laid > 0 ? laidSides / laid : 0;
      laid = 0; laidSides = 0; listenedAt = t; lastListen = t;
      if (!audio || audioBroken) return;
      const sounding = phase === 'painting' || phase === 'ended';
      try {
        audio.brush(phase === 'painting' ? perSecond : 0, side);
        audio.beat(sounding ? 1 : 0, beatHz());
      } catch (error) { audioFailed(error); }
    }
    function labelSound() {
      soundButton.setAttribute('aria-pressed', String(soundOn));
      soundLabel.textContent = soundOn ? 'Sound on' : 'Sound off';
    }
    // The visitor switches the sound (the Sound button or M); the choice is the site's.
    function setSound(value) {
      soundOn = value;
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (error) { /* private mode */ }
      labelSound();
      if (soundOn) { if (!audio) adoptAudio(); if (audio) { audio.setEnabled(true); listen(true); } }
      else if (audio) audio.setEnabled(false);
    }

    /* ---- Open, close, restore ---------------------------------------------- */
    function cleanup() {
      if (closed) return;
      closed = true; phase = 'closed';
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      events.abort();
      clearTimeout(chromeTimer); clearTimeout(liveTimer);
      Object.values(rows).forEach(r => clearTimeout(r.timer));
      clearTimeout(restTimer);
      if (audio) { try { audio.close(!closing); } catch (error) { /* already closed */ } audio = null; }
      else if (window.__portraitAudioContext) { try { window.__portraitAudioContext.close().catch(() => {}); } catch (error) { /* closed */ } window.__portraitAudioContext = undefined; }
      try { if (dialog.open) dialog.close(); } catch (error) { /* already closed */ }
      dialog.remove();
      if (overflow) body.style.setProperty('overflow', overflow, overflowPriority);
      else body.style.removeProperty('overflow');
      if (gutter) html.style.setProperty('scrollbar-gutter', gutter, gutterPriority);
      else html.style.removeProperty('scrollbar-gutter');
      if (!hadAttribute.htmlStyle && html.getAttribute('style') === '') html.removeAttribute('style');
      if (!hadAttribute.bodyStyle && body.getAttribute('style') === '') body.removeAttribute('style');
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      if (scrollX !== scroll.x || scrollY !== scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      active = false;
    }
    // The flight between the page's photo and the frame, as a transform of the frame.
    function flight() {
      const from = photo && photo.isConnected ? photo.getBoundingClientRect() : null;
      const to = frame.getBoundingClientRect();
      if (!from || !from.width || !to.width || from.bottom < 0 || from.top > innerHeight) return null;
      return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    }
    const fade = (el, from, to, duration, delay = 0) => el.animate([{ opacity: from }, { opacity: to }], { duration, delay, easing: 'linear', fill: 'both' });
    let closing = false;
    /**
     * The way back: the program and the charts fade, the painting gives way to the photo, and
     * the photo flies home into the page while the paper lifts. A second request, a hidden tab
     * or reduced motion close at once.
     */
    function close() {
      if (closed) return;
      if (closing || document.hidden || still) { cleanup(); return; }
      closing = true; phase = 'closing';
      if (audio) {
        try { audio.brush(0, 0); audio.beat(0, 0); audio.cue.whoosh(audio.now() + 0.2, false, T_RETURN / 1000); } catch (error) { audioFailed(error); }
      }
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      hideChrome();
      const parts = [code, curveBox, testBox, caption];
      parts.forEach(el => fade(el, 1, 0, 220));
      fade(photoCopy, 0, 1, 260);
      const path = flight();
      const fly = path ? frame.animate([{ transform: 'none' }, { transform: path }], { duration: T_RETURN, delay: 200, easing: EASE, fill: 'both' }) : fade(frame, 1, 0, T_RETURN, 200);
      fade(ground, 1, 0, T_RETURN - 120, 300);
      fly.finished.then(cleanup, cleanup);
    }

    /* ---- Chrome: Return (and Next test under reduced motion), shown on intent ---- */
    let chromeTimer = 0; let chromeHover = false;
    const showChrome = ms => {
      chrome.classList.add('is-shown');
      clearTimeout(chromeTimer);
      if (ms && !still) chromeTimer = setTimeout(() => { if (!chromeHover) chrome.classList.remove('is-shown'); }, ms);
    };
    const hideChrome = () => { clearTimeout(chromeTimer); if (!still) chrome.classList.remove('is-shown'); };
    function setStill(value) {
      still = value;
      dialog.classList.toggle('is-still', still);
      if (still) showChrome(0); else { hideChrome(); lastNow = 0; schedule(); }
    }

    /* ---- Events ------------------------------------------------------------ */
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup);
    on(returnButton, 'click', () => close());
    on(stepButton, 'click', () => skip());
    on(window, 'pagehide', cleanup);
    on(window, 'resize', () => { measureCharts(); drawCurve(); drawTest(); });
    on(document, 'visibilitychange', () => {
      if (audio && !audioBroken) {
        try {
          if (document.hidden) { if (audio.state === 'running') audio.context.suspend().catch(() => {}); }
          else if (soundOn && audio.enabled && !audioRested && audio.state === 'suspended') audio.context.resume().catch(() => {});
        } catch (error) { audioFailed(error); }
      }
      if (document.hidden) { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; }
      else { paused = false; lastNow = 0; schedule(); }
    });
    on(motion, 'change', () => setStill(motion.matches));
    on(dialog, 'pointermove', event => {
      const inCorner = event.clientX > innerWidth - CHROME_REGION[0] && event.clientY > innerHeight - CHROME_REGION[1];
      if (inCorner) { chromeHover = true; showChrome(0); }
      else if (chromeHover) { chromeHover = false; showChrome(CHROME_HIDE_MS); }
    });
    on(dialog, 'pointerdown', event => { unlockAudio(); if (!chrome.contains(event.target)) showChrome(CHROME_TAP_MS); });
    on(soundButton, 'click', () => setSound(!soundOn));
    // Keys: Esc returns (the dialog's cancel); Space pauses; the right arrow shows the next test.
    on(dialog, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === ' ' && !event.target.closest('button, a')) {
        event.preventDefault();
        if (still) skip(); else hold(!held);
      } else if (event.key === 'ArrowRight') { event.preventDefault(); skip(); }
      else if ((event.key === 'm' || event.key === 'M') && !event.repeat) { event.preventDefault(); setSound(!soundOn); }
      if (event.key !== 'm' && event.key !== 'M') unlockAudio();
      showChrome(CHROME_TAP_MS);
    });

    /* ---- Debug and test hooks (never UI) ---------------------------------- */
    dialog.portrait = {
      get phase() { return phase; },
      get cursor() { return cursor; },
      get committed() { return env.committed; },
      get program() { return { ...env.prog }; },
      get shown() { return { ...shown }; },
      get psnr() { return psnrShown; },
      get finale() { return finaleShownAt >= 0; },
      get finaleAt() { return env.finale ? env.finaleAt : null; },
      get ending() { return ending && { ...ending }; },
      get counts() { return { ...counts }; },
      get still() { return still; },
      get frameStats() { return stats; },
      get scale() { return scale; },
      text: () => textOf(env.prog),
      shownText: () => textOf(shown),
      verdicts: () => verdicts.slice(),
      listing: () => [...code.querySelectorAll('.pl')].map(row => row.querySelector('.pl-val').textContent),
      setRate(value) { rateFixed = value > 0 ? value : 0; },
      get sound() { return soundOn; },
      get audioState() { return audio ? audio.state : null; },
      audioCues: () => audioCues.slice(),
      get held() { return held; },
      pause() { hold(true); },
      resume() { hold(false); },
      skip,
      close
    };

    /* ---- Open ---------------------------------------------------------------- */
    try {
      html.style.setProperty('scrollbar-gutter', 'stable');
      body.style.setProperty('overflow', 'hidden', 'important');
      body.append(dialog);
      dialog.showModal();
      dialog.scrollTop = 0;
      dialog.classList.toggle('is-still', still);
      layoutCanvas();
      paintPaper();
      measureCharts();
      palette = colours();
      describe();
      announce('A program is painting the photograph and rewriting itself as it goes. Escape returns.');
      dialog.focus({ preventScroll: true });
      const parts = [code, curveBox, testBox, caption];
      labelSound();
      adoptAudio();
      const begin = () => {
        if (closed || closing) return;
        phase = 'painting';
        lastNow = 0;
        schedule();
      };
      if (still) {
        ground.style.opacity = '1';
        photoCopy.style.opacity = '0';
        begin();
        showChrome(0);
      } else {
        const path = flight();
        parts.forEach(el => { el.style.opacity = '0'; });
        fade(ground, 0, 1, T_GROUND);
        if (path) cue('whoosh up', a => a.cue.whoosh(a.now(), true, T_LIFT / 1000));
        const lift = path ? frame.animate([{ transform: path }, { transform: 'none' }], { duration: T_LIFT, easing: EASE, fill: 'none' })
          : fade(frame, 0, 1, T_LIFT);
        lift.finished.then(() => {
          if (closed || closing) return;
          parts.forEach(el => { el.style.removeProperty('opacity'); fade(el, 0, 1, T_SHOW); });
          const forget = fade(photoCopy, 1, 0, T_FORGET, T_SHOW);
          // The simulation starts during the flight; the painting once the photo has gone.
          forget.finished.then(begin, () => {});
        }, () => {});
        simulate(12);
        lastNow = 0;
        schedule();
      }
    } catch (error) { cleanup(); throw error; }
    return true;
  }

  window.SitePortrait = { open, get active() { return active; }, createAudio: (context, options) => createPortraitAudio(context, options) };
})();
