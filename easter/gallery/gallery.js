/**
 * Print Gallery. The homepage photo holds the page as it was before, mounted like a print;
 * that page's photo holds the page before it; and so on, back through every version of the
 * site that looked different, to the first, whose photo holds the page you are on, whose
 * photo holds ... After Escher's Print Gallery (1956) and the Droste effect.
 *
 * Every photo always shows the version before it, so the tunnel is on screen at once: the
 * page, the print in its photo, the print in that one's photo, down to a pixel. The camera
 * rests at each version (its wall label: date, how far back, the commit's own words), then
 * dives into its photo until the print there fills the screen, and rests again; round the
 * cycle without end, until Return.
 *
 * Depth d: 0 is the live page, 1..N the prints (1 the newest), and at N + 1 the live page
 * again (it sits in the first version's photo); the depth wraps there. At an integer the level
 * fits the viewport; between k and k + 1 the camera zooms exponentially about the one point
 * the two framings share, eased so it starts and stops at rest (no turn is ever seen moving).
 * Where a level does not cover the viewport, the level around it is drawn, as it really is.
 *
 * The live page is the real DOM: where it is drawn (at the start, and inside the first
 * version's photo) the body carries the CSS transform that puts it there, and the canvas
 * leaves a hole; the dialog is in the top layer, so the transform never moves it. Closing
 * restores the body's style exactly; the page DOM is never mutated otherwise.
 *
 * Sound, only on arrival: a music-box note per version, stepping down D major pentatonic as
 * the camera goes back in time (an octave lower beneath it when the year changes), and a
 * rising arpeggio at today.
 */
(() => {
  'use strict';
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const BASE = new URL('./prints/', SCRIPT_SRC).href;

  /* ---------------------------------------------------------------------------
   * Tunable constants. Times are seconds unless named _MS.
   * ------------------------------------------------------------------------- */
  const PRINT_ASPECT = 1.6;            // the prints are 1280 x 800 captures
  const MOUNT = 0.9;                   // a print fills this share of a square photo's width ...
  const MOUNT_ROUND = 0.92;            // ... or of the largest rectangle inside a round one
  const OPEN_TIME = 0.8;               // s: the photo opens into the gallery
  const FIRST_REST = 1.4;              // s: the camera rests on the live page first
  const TRAVEL = 2.1;                  // s: one dive, version to version
  const REST = 1.0;                    // s: the rest at each version
  const IDLE = 1.4;                    // s after the reader's last push, the camera's own dive resumes
  const WHEEL_GAIN = 0.004;            // levels per second per wheel pixel
  const DECAY = 0.45;                  // s: a push from the wheel or a drag dies away
  const MAX_SPEED = 6;                 // levels per second
  const DRAG_LEVELS = 1.1;             // levels per viewport height dragged
  const STEP_TIME = 1.3;               // s: the arrows move one version
  const HOME_TIME = [1.0, 0.07];       // s: Return rushes home in a + b per level
  const MIN_PORTAL_PX = 2;             // nesting stops below this size on screen
  const LARGE_FROM = 1.1;              // a print drawn wider than this x its small file uses the large one
  const SMALL_WIDTH = 512;
  const CAPTION_FADE = [0.06, 0.2];    // a level's label fades as the camera leaves it
  const CHROME_REGION = [260, 120];
  const CHROME_HIDE_MS = 1800;
  const CHROME_TAP_MS = 3500;
  // Sound (Web Audio, synthesized; the site's preference, as for the other eggs).
  const SOUND_KEY = 'spira-sound';
  const MELODY = [86, 83, 81, 78, 76, 74, 71, 69, 66, 64, 62];   // D6 down to D4, D major pentatonic
  const TODAY = [62, 66, 69, 74];                                 // D4 F#4 A4 D5, rising
  const NOTE_GAIN = 0.09;
  const NOTE_GAP_MS = 90;
  // A music box's tine: the fundamental and a few soft overtones, the high ones dying first.
  const TINE = [[1, 1, 1.9], [2, 0.16, 0.8], [3, 0.07, 0.4], [4.2, 0.04, 0.22]];

  /* ---------------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------------- */
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  function parseColour(text) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?/.exec(text || '');
    if (!m) return null;
    return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1)];
  }
  // A similarity x -> a x + b (a scalar scale, b a point).
  const sim = (a, bx, by) => ({ a, bx, by });
  const compose = (S, M) => sim(S.a * M.a, S.a * M.bx + S.bx, S.a * M.by + S.by);   // S after M
  const unmount = (S, M) => sim(S.a / M.a, S.bx - (S.a * M.bx) / M.a, S.by - (S.a * M.by) / M.a);   // S after M^-1

  let manifestPromise = null;
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(new URL('manifest.json', BASE).href, { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error(`manifest ${r.status}`); return r.json(); })
        .catch(error => { manifestPromise = null; throw error; });
    }
    return manifestPromise;
  }

  /* ---------------------------------------------------------------------------
   * The egg
   * ------------------------------------------------------------------------- */
  let active = false;

  /**
   * Opens the gallery. Options: photo (the live page's portal; default the homepage photo),
   * and test hooks: auto (false: the camera does not move of its own), speed (levels per
   * second, fixed, no rests). Resolves true when it opened.
   */
  async function open(options) {
    if (active) return false;
    options = options || {};
    const photo = options.photo || document.querySelector('[data-egg-trigger]');
    if (!photo || !photo.isConnected) return false;
    active = true;
    try {
      const manifest = await loadManifest();
      if (!manifest.prints || !manifest.prints.length) throw new Error('No prints.');
      return start(options, photo, manifest);
    } catch (error) {
      active = false;
      console.warn('The gallery could not open.', error);
      return false;
    }
  }

  function start(options, photo, manifest) {
    const html = document.documentElement;
    const body = document.body;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const still = motion.matches;          // reduced motion: no zoom; one version at a time
    const previousFocus = document.activeElement;
    const scroll = { x: scrollX, y: scrollY };
    const saved = [];
    for (const [el, props] of [[body, ['overflow', 'transform', 'transform-origin', 'will-change']], [html, ['scrollbar-gutter']]]) {
      for (const prop of props) saved.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
    }
    const hadAttribute = { htmlStyle: html.hasAttribute('style'), bodyStyle: body.hasAttribute('style') };
    const events = new AbortController();
    const on = (target, type, fn, extra) => target.addEventListener(type, fn, Object.assign({ signal: events.signal }, extra));

    const prints = manifest.prints;
    const N = prints.length;
    const M = N + 1;                       // the cycle: the live page and the prints
    const pageStyle = getComputedStyle(body);
    const wallRGB = (() => { const c = parseColour(pageStyle.backgroundColor); return c && c[3] > 0.5 ? c : parseColour(getComputedStyle(html).backgroundColor) || [255, 255, 255, 1]; })();
    const wall = `rgb(${wallRGB.slice(0, 3).join(',')})`;
    const dark = (0.299 * wallRGB[0] + 0.587 * wallRGB[1] + 0.114 * wallRGB[2]) < 128;

    /* ---- Geometry ---------------------------------------------------------- */
    // A print's units: width 1, height 1 / PRINT_ASPECT. The live page's: CSS px of the viewport.
    let vw = innerWidth; let vh = innerHeight;
    const bodyOrigin = (() => { const b = body.getBoundingClientRect(); return { x: b.left, y: b.top }; })();
    const livePortal = (() => {
      const b = photo.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(photo).borderTopWidth) || 0;
      return { x: b.left + border, y: b.top + border, w: b.width - 2 * border, h: b.height - 2 * border, round: false };
    })();
    const index = i => ((i % M) + M) % M;
    const isLive = j => j === 0;
    const widthOf = j => (isLive(j) ? vw : 1);
    const heightOf = j => (isLive(j) ? vh : 1 / PRINT_ASPECT);
    const portalOf = j => {
      if (isLive(j)) return livePortal;
      const p = prints[j - 1].portal; const h = 1 / PRINT_ASPECT;
      return { x: p[0], y: p[1] * h, w: p[2], h: p[3] * h, round: prints[j - 1].round };
    };
    // Where level j + 1 sits in level j's photo, mounted: a similarity from its units to j's.
    function mountOf(j) {
      const P = portalOf(j); const next = index(j + 1);
      const a = widthOf(next) / heightOf(next);
      let w;
      if (P.round) { const D = Math.min(P.w, P.h); w = MOUNT_ROUND * D / Math.sqrt(1 + 1 / (a * a)); }
      else w = MOUNT * Math.min(P.w, P.h * a);
      const h = w / a;
      return { rect: { x: P.x + (P.w - w) / 2, y: P.y + (P.h - h) / 2, w, h }, M: sim(w / widthOf(next), P.x + (P.w - w) / 2, P.y + (P.h - h) / 2) };
    }
    let mounts = [];
    const remount = () => { mounts = Array.from({ length: M }, (_, j) => mountOf(j)); };
    remount();
    // Level j fitted into the viewport (the live page as it is).
    function fitOf(j) {
      if (isLive(j)) return sim(1, 0, 0);
      const a = Math.min(vw, vh * PRINT_ASPECT);
      return sim(a, (vw - a) / 2, (vh - a / PRINT_ASPECT) / 2);
    }
    // The camera at depth d: level k = floor(d) and its similarity, between its own framing and
    // the next level's, zooming about the point they share; u is the eased progress.
    function camera(d) {
      const k = Math.floor(d); const j = index(k);
      const u = easeInOut(d - k);
      const S0 = fitOf(j); const { M: m } = mounts[j];
      const F1 = fitOf(index(k + 1));
      const a1 = F1.a / m.a;
      const S1 = sim(a1, F1.bx - a1 * m.bx, F1.by - a1 * m.by);
      if (Math.abs(a1 - S0.a) < 1e-12) return { k, S: S0 };
      const zx = (S0.bx - S1.bx) / (a1 - S0.a); const zy = (S0.by - S1.by) / (a1 - S0.a);
      const a = S0.a * Math.pow(a1 / S0.a, u);
      const fx = S0.a * zx + S0.bx; const fy = S0.a * zy + S0.by;
      return { k, S: sim(a, fx - a * zx, fy - a * zy) };
    }
    const covers = (j, S) => S.bx <= 0.5 && S.by <= 0.5 && S.bx + S.a * widthOf(j) >= vw - 0.5 && S.by + S.a * heightOf(j) >= vh - 0.5;

    /* ---- Images ------------------------------------------------------------ */
    const images = prints.map(p => ({ small: null, large: null, smallLoading: false, largeLoading: false, file: p.file }));
    function loadImage(j, size) {
      const record = images[j - 1];
      const key = size === 'large' ? 'largeLoading' : 'smallLoading';
      if (record[size] || record[key]) return;
      record[key] = true;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { const done = () => { record[size] = img; record[key] = false; }; if (img.decode) img.decode().then(done, done); else done(); };
      img.onerror = () => { record[key] = false; };
      img.src = new URL(`${record.file}-${size === 'large' ? 'l' : 's'}.webp`, BASE).href;
    }
    for (let j = 1; j <= N; j++) loadImage(j, 'small');
    // Large files around the camera (the level before, this one, the two after); others let go.
    function feedImages(d) {
      const k = Math.floor(d);
      const near = new Set([-1, 0, 1, 2].map(n => index(k + n)));
      images.forEach((record, i) => { if (near.has(i + 1)) loadImage(i + 1, 'large'); else if (record.large) record.large = null; });
    }
    const ready = j => isLive(j) || !!images[j - 1].small;

    /* ---- DOM ------------------------------------------------------------- */
    const dialog = document.createElement('dialog');
    dialog.id = 'gallery';
    dialog.tabIndex = -1;
    dialog.autofocus = true;
    dialog.setAttribute('aria-label', 'Print Gallery: every earlier version of this page, each inside the photo of the next');
    if (dark) dialog.classList.add('is-dark');
    if (still) dialog.classList.add('is-still');
    const canvas = document.createElement('canvas');
    canvas.className = 'gallery-canvas';
    const label = document.createElement('figure');
    label.className = 'gallery-label';
    const labelDate = document.createElement('p'); labelDate.className = 'gallery-date';
    const labelText = document.createElement('p'); labelText.className = 'gallery-message';
    const track = document.createElement('div'); track.className = 'gallery-track';
    const marker = document.createElement('span'); marker.className = 'gallery-marker';
    track.append(marker);
    label.append(labelDate, labelText, track);
    const chrome = document.createElement('div');
    chrome.className = 'gallery-chrome';
    const button = (text, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = `gallery-button ${cls || ''}`.trim(); b.textContent = text; return b; };
    const backButton = button('Newer', 'gallery-step');
    const nextButton = button('Older', 'gallery-step');
    const soundButton = button('', 'gallery-sound');
    const soundLabel = document.createElement('span');
    const soundKey = document.createElement('span'); soundKey.className = 'gallery-key'; soundKey.setAttribute('aria-hidden', 'true'); soundKey.textContent = 'm';
    soundButton.append(soundLabel, ' ', soundKey);
    const returnButton = button('Return');
    chrome.append(backButton, nextButton, soundButton, returnButton);
    const announcer = document.createElement('p');
    announcer.className = 'gallery-live'; announcer.setAttribute('aria-live', 'polite');
    dialog.append(canvas, label, chrome, announcer);
    const ctx = canvas.getContext('2d', { alpha: true });
    let dpr = 1;
    function sizeCanvas() {
      dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    }

    /* ---- State ------------------------------------------------------------- */
    let depth = still ? 1 : 0;
    let loops = 0;
    let speed = 0;                         // levels per second, from the reader (wheel, drag)
    let lastPush = -1e9;
    let paused = false; let held = false;
    let seek = null;                       // { from, to, start, duration }: a timed move
    let restUntil = still ? Infinity : FIRST_REST;   // the camera rests until this clock time
    let raf = 0; let lastNow = 0; let clock = 0;
    let closed = false; let leaving = false; let movedIn = false;
    let phase = 'falling';
    let drag = null;
    let liveShown = 'page';                // where the DOM is drawn: 'page' (outermost), 'inside' (in a photo) or null
    let opening = still ? 1 : 0;           // 0..1: the photo opens into the gallery
    const fixedSpeed = Number.isFinite(options.speed) ? options.speed : null;
    const auto = options.auto !== false;
    const stats = { frames: 0, avgMs: 0, maxMs: 0 };

    function placeBody(S) {
      if (!S) { body.style.setProperty('transform', 'translate(-200vw, 0) scale(0.01)'); return; }
      // S maps viewport px of the live page to the screen.
      body.style.setProperty('transform', `translate(${S.bx - bodyOrigin.x * (1 - S.a)}px, ${S.by - bodyOrigin.y * (1 - S.a)}px) scale(${S.a})`);
    }

    /* ---- Drawing ----------------------------------------------------------- */
    function portalPath(P, S) {
      const x = S.a * P.x + S.bx; const y = S.a * P.y + S.by; const w = S.a * P.w; const h = S.a * P.h;
      ctx.beginPath();
      if (P.round) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else ctx.rect(x, y, w, h);
      return w;
    }
    function visible(j, S) {
      return S.bx < vw && S.by < vh && S.bx + S.a * widthOf(j) > 0 && S.by + S.a * heightOf(j) > 0;
    }
    // Level i (an absolute depth) at S, and the levels inside its photo. Returns where the live
    // page is drawn, when it is.
    function drawLevel(i, S, alpha, outer) {
      const j = index(i);
      let liveAt = null;
      if (isLive(j)) {
        liveAt = S;
        if (!outer) {
          // The live page shows through a hole in the mount.
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = alpha; ctx.fillStyle = '#000';
          ctx.fillRect(S.bx, S.by, S.a * vw, S.a * vh);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (visible(j, S)) {
        const record = images[j - 1];
        const w = S.a;
        const img = record.large && w * dpr > SMALL_WIDTH * LARGE_FROM ? record.large : record.small || record.large;
        ctx.globalAlpha = alpha;
        if (img) ctx.drawImage(img, S.bx, S.by, w, w / PRINT_ASPECT);
        else { ctx.fillStyle = '#f4f4f2'; ctx.fillRect(S.bx, S.by, w, w / PRINT_ASPECT); }
      }
      const P = portalOf(j);
      const next = index(i + 1);
      if (S.a * P.w < MIN_PORTAL_PX || !ready(next)) { ctx.globalAlpha = 1; return liveAt; }
      // The photo: a white mount, and the version before it, with a hairline.
      const fade = isLive(j) && outer ? alpha * opening : alpha;
      if (fade > 0.001) {
        ctx.save();
        portalPath(P, S);
        ctx.clip();
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(S.a * P.x + S.bx, S.a * P.y + S.by, S.a * P.w, S.a * P.h);
        const { rect, M: m } = mounts[j];
        const inner = drawLevel(i + 1, compose(S, m), fade, false);
        ctx.globalAlpha = fade * 0.5; ctx.lineWidth = 1 / dpr; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.strokeRect(S.a * rect.x + S.bx, S.a * rect.y + S.by, S.a * rect.w, S.a * rect.h);
        ctx.restore();
        liveAt = liveAt || inner;
      }
      ctx.globalAlpha = 1;
      return liveAt;
    }
    function draw(d) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      let { k, S } = camera(d);
      // Where this level leaves the viewport uncovered, draw the level around it (twice at most).
      for (let up = 0; up < 2 && !covers(index(k), S); up++) { S = unmount(S, mounts[index(k - 1)].M); k -= 1; }
      const j = index(k);
      if (isLive(j)) ctx.clearRect(0, 0, vw, vh);
      else { ctx.fillStyle = wall; ctx.fillRect(0, 0, vw, vh); }
      const liveAt = drawLevel(k, S, 1, true);
      const where = !liveAt ? null : isLive(j) ? 'page' : 'inside';
      if (where || where !== liveShown) placeBody(liveAt);
      liveShown = where;
    }

    /* ---- The label --------------------------------------------------------- */
    let labelFor = ''; let announcedFor = '';
    const ago = n => (n === 1 ? '1 version ago' : `${n} versions ago`);
    function describe(d) {
      const nearest = Math.round(d);
      const j = index(nearest);
      const opacity = 1 - smooth(CAPTION_FADE[0], CAPTION_FADE[1], Math.abs(d - nearest));
      label.style.opacity = String(opacity);
      const again = loops > 0 || nearest >= M;
      const key = `${j}:${again ? 1 : 0}`;
      if (key !== labelFor) {
        labelFor = key;
        label.classList.toggle('is-title', isLive(j));
        if (isLive(j) && !again) {
          labelDate.textContent = 'Print Gallery';
          labelText.textContent = 'Inside its photo, this page keeps every page it used to be.';
        } else if (isLive(j)) {
          labelDate.textContent = 'Today';
          labelText.textContent = 'The first version held this one.';
        } else {
          const p = prints[j - 1];
          labelDate.textContent = `${p.date} · ${j === N ? 'the first version' : ago(j)}`;
          labelText.textContent = p.message;
        }
      }
      if (opacity > 0.9 && announcedFor !== key) { announcedFor = key; announce(`${labelDate.textContent}. ${labelText.textContent}`); }
      const u = clamp((((d % M) + M) % M) / N, 0, 1);
      marker.style.left = `${(u * 100).toFixed(2)}%`;
    }
    let liveTimer = 0;
    function announce(text) { clearTimeout(liveTimer); liveTimer = setTimeout(() => { announcer.textContent = text; }, 400); }

    /* ---- Motion ------------------------------------------------------------- */
    function seekTo(to, duration) { seek = { from: depth, to, start: clock, duration }; restUntil = -1; schedule(); }
    function step(dt) {
      const before = depth;
      if (seek) {
        const u = clamp((clock - seek.start) / seek.duration, 0, 1);
        // The eased camera is inside camera(); a seek runs straight in depth.
        depth = seek.from + (seek.to - seek.from) * u;
        if (u >= 1) { depth = seek.to; seek = null; restUntil = clock + REST; }
      } else if (drag) {
        // The drag moves the depth itself (pointermove).
      } else if (fixedSpeed !== null) {
        depth += fixedSpeed * dt;
      } else if (Math.abs(speed) > 0.02 || clock - lastPush < IDLE) {
        speed *= Math.exp(-dt / DECAY);
        depth += speed * dt;
      } else if (auto && !paused && clock >= restUntil) {
        // The camera's own dive: to the next version, from wherever it is.
        const from = depth; const to = Math.floor(depth + 1e-6) + 1;
        seek = { from, to, start: clock, duration: TRAVEL * (to - from) };
      }
      if (depth < 0 && !leaving) { depth = 0; speed = 0; }
      arrive(before, depth);           // before the wrap, so today at the end of a cycle sounds
      if (depth >= M) { depth -= M; loops++; if (seek) { seek.from -= M; seek.to -= M; } }
    }
    // Crossing an integer (either way) is an arrival: its note.
    function arrive(before, after) {
      if (before === after) return;
      const a = Math.floor(before + 1e-9); const b = Math.floor(after + 1e-9);
      if (after > before && b > a) note(index(b), b);
      else if (after < before && Math.ceil(after - 1e-9) < Math.ceil(before - 1e-9)) note(index(Math.ceil(after - 1e-9)), Math.ceil(after - 1e-9));
    }
    function frame(now) {
      raf = 0;
      if (closed || held) return;
      const began = performance.now();
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now; clock += dt;
      if (!still) opening = smooth(0.1, OPEN_TIME, clock);
      if (!still) step(dt);
      feedImages(depth);
      draw(depth);
      describe(depth);
      const took = performance.now() - began;
      stats.frames++; stats.avgMs += (took - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, took);
      // Out on the page as it is: Return's rush home, or the reader rising back to it.
      if (!still && depth <= 0 && (leaving || movedIn)) { cleanup(); return; }
      if (depth > 0.02) movedIn = true;
      schedule();
    }
    function schedule() { if (!raf && !closed && !held) raf = requestAnimationFrame(frame); }
    function push(levelsPerSecond) {
      if (still) return;
      seek = null;
      speed = clamp(speed + levelsPerSecond, -MAX_SPEED, MAX_SPEED);
      lastPush = clock;
      schedule();
    }

    /* ---- Still (reduced motion): one version at a time --------------------- */
    function showStill(j) {
      const before = depth;
      depth = j;
      draw(depth); describe(depth);
      if (before !== depth) note(index(depth), depth);
      backButton.disabled = depth <= 1;
    }
    function stepStill(delta) {
      if (depth + delta < 1) { cleanup(); return; }
      showStill(depth + delta > N ? 1 : depth + delta);
    }

    /* ---- Sound ------------------------------------------------------------- */
    let soundOn = true;
    try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (error) { soundOn = true; }
    let audio = null; let lastNote = -1e9;
    const notes = [];                      // test hook: the arrivals sounded
    function adoptAudio() {
      const primed = window.__galleryAudioContext;
      window.__galleryAudioContext = undefined;
      if (audio || closed || !soundOn) { if (primed && primed.state !== 'closed' && (!audio || primed !== audio.context)) primed.close().catch(() => {}); return; }
      try {
        let context = primed && primed.state !== 'closed' ? primed : null;
        if (!context) { const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return; context = new Context(); }
        if (context.state === 'suspended' && !document.hidden) context.resume().catch(() => {});
        audio = createGalleryAudio(context);
      } catch (error) { console.warn('The gallery\'s sound is unavailable.', error); audio = null; }
    }
    // The note of an arrival at level j: a step down the melody per version back, an octave
    // below it as well when the year changes; today, a rising arpeggio.
    function note(j, absolute) {
      if (!soundOn) return;
      const now = performance.now();
      if (now - lastNote < NOTE_GAP_MS) return;
      lastNote = now;
      if (notes.length < 400) notes.push(isLive(j) ? 'today' : `${j}`);
      if (!audio || !audio.ready) return;
      if (isLive(j)) { if (absolute > 0) audio.arpeggio(TODAY); return; }
      const m = MELODY[(j - 1) % MELODY.length];
      const year = p => p.date.slice(0, 4);
      const newYear = j > 1 && year(prints[j - 1]) !== year(prints[j - 2]);
      audio.tine(m, 1);
      if (newYear) audio.tine(m - 12, 0.6);
    }
    function labelSound() { soundButton.setAttribute('aria-pressed', String(soundOn)); soundLabel.textContent = soundOn ? 'Sound on' : 'Sound off'; }
    function setSound(value) {
      soundOn = value;
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (error) { /* private mode */ }
      labelSound();
      if (soundOn) { adoptAudio(); if (audio) audio.setEnabled(true); } else if (audio) audio.setEnabled(false);
    }
    function unlockAudio() {
      if (!soundOn || closed) return;
      if (!audio) adoptAudio();
      else if (audio.context.state === 'suspended' && !document.hidden) audio.context.resume().catch(() => {});
    }

    /* ---- Open, close, restore ---------------------------------------------- */
    function cleanup() {
      if (closed) return;
      closed = true; phase = 'closed';
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      events.abort();
      clearTimeout(chromeTimer); clearTimeout(liveTimer);
      if (audio) { try { audio.close(); } catch (error) { /* closed */ } audio = null; }
      try { if (dialog.open) dialog.close(); } catch (error) { /* already closed */ }
      dialog.remove();
      for (const [el, prop, value, priority] of saved) { if (value) el.style.setProperty(prop, value, priority); else el.style.removeProperty(prop); }
      if (!hadAttribute.htmlStyle && html.getAttribute('style') === '') html.removeAttribute('style');
      if (!hadAttribute.bodyStyle && body.getAttribute('style') === '') body.removeAttribute('style');
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      if (scrollX !== scroll.x || scrollY !== scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      active = false;
    }
    /** Return: a rush back up to the page as it is; a second request (or reduced motion) closes at once. */
    function close() {
      if (closed) return;
      if (still || document.hidden || leaving) { cleanup(); return; }
      leaving = true;
      seekTo(0, HOME_TIME[0] + HOME_TIME[1] * depth);
    }

    /* ---- Chrome ------------------------------------------------------------- */
    let chromeTimer = 0; let chromeHover = false;
    const showChrome = ms => {
      chrome.classList.add('is-shown');
      clearTimeout(chromeTimer);
      if (ms && !still) chromeTimer = setTimeout(() => { if (!chromeHover) chrome.classList.remove('is-shown'); }, ms);
    };

    /* ---- Events ------------------------------------------------------------ */
    const nextVersion = () => (still ? stepStill(1) : seekTo(Math.floor(depth + 1e-6) + 1, STEP_TIME));
    const previousVersion = () => (still ? stepStill(-1) : seekTo(Math.max(0, Math.ceil(depth - 1e-6) - 1), STEP_TIME));
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup);
    on(returnButton, 'click', () => close());
    on(soundButton, 'click', () => setSound(!soundOn));
    on(nextButton, 'click', nextVersion);
    on(backButton, 'click', previousVersion);
    on(window, 'pagehide', cleanup);
    on(window, 'resize', () => {
      // The live page reflows: its photo is not where it was. Out at once while it shows.
      if (liveShown) { cleanup(); return; }
      vw = innerWidth; vh = innerHeight; sizeCanvas(); remount(); schedule();
    });
    on(document, 'visibilitychange', () => {
      if (document.hidden) { held = true; if (raf) cancelAnimationFrame(raf); raf = 0; if (audio) audio.suspend(); }
      else { held = false; lastNow = 0; if (audio && soundOn) audio.resume(); schedule(); }
    });
    on(motion, 'change', () => { if (motion.matches) cleanup(); });
    let wheelLock = false;
    on(dialog, 'wheel', event => {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * vh : event.deltaY;
      if (still) { if (Math.abs(delta) > 20 && !wheelLock) { wheelLock = true; setTimeout(() => { wheelLock = false; }, 450); stepStill(delta > 0 ? 1 : -1); } return; }
      push(delta * WHEEL_GAIN);
      movedIn = true;
    }, { passive: false });
    on(dialog, 'pointerdown', event => {
      if (chrome.contains(event.target)) return;
      unlockAudio();
      showChrome(CHROME_TAP_MS);
      if (still) return;
      drag = { id: event.pointerId, y: event.clientY, t: performance.now(), v: 0 };
      seek = null;
      try { dialog.setPointerCapture(event.pointerId); } catch (error) { /* not capturable */ }
    });
    on(dialog, 'pointermove', event => {
      const inCorner = event.clientX > vw - CHROME_REGION[0] && event.clientY > vh - CHROME_REGION[1];
      if (inCorner) { chromeHover = true; showChrome(0); } else if (chromeHover) { chromeHover = false; showChrome(CHROME_HIDE_MS); }
      if (!drag || event.pointerId !== drag.id) return;
      const now = performance.now();
      const dd = ((drag.y - event.clientY) / vh) * DRAG_LEVELS;
      const before = depth;
      depth = Math.max(0, depth + dd);
      arrive(before, depth);
      if (depth >= M) { depth -= M; loops++; }
      drag.v = 0.7 * drag.v + 0.3 * (dd / Math.max(1e-3, (now - drag.t) / 1000));
      drag.y = event.clientY; drag.t = now; movedIn = true; lastPush = clock;
      schedule();
    });
    const release = event => {
      if (!drag || event.pointerId !== drag.id) return;
      speed = clamp(drag.v, -MAX_SPEED, MAX_SPEED); lastPush = clock;
      drag = null;
    };
    on(dialog, 'pointerup', release);
    on(dialog, 'pointercancel', release);
    on(dialog, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const k = event.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'ArrowRight') { event.preventDefault(); nextVersion(); }
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'ArrowLeft') { event.preventDefault(); previousVersion(); }
      else if (k === ' ' && !event.target.closest('button, a')) { event.preventDefault(); if (still) stepStill(1); else paused = !paused; }
      else if (k === 'Home') { event.preventDefault(); close(); }
      else if ((k === 'm' || k === 'M') && !event.repeat) { event.preventDefault(); setSound(!soundOn); }
      if (k !== 'm' && k !== 'M') unlockAudio();
      showChrome(CHROME_TAP_MS);
    });

    /* ---- Debug and test hooks (never UI) ---------------------------------- */
    dialog.gallery = {
      get phase() { return phase; },
      get depth() { return depth; },
      get levels() { return N; },
      get loops() { return loops; },
      get still() { return still; },
      get live() { return liveShown; },
      get sound() { return soundOn; },
      get frameStats() { return stats; },
      get loaded() { return images.map(r => (r.large ? 'l' : r.small ? 's' : '-')).join(''); },
      notes: () => notes.slice(),
      label: () => ({ date: labelDate.textContent, message: labelText.textContent }),
      setDepth(value) { seek = null; speed = 0; lastPush = clock; depth = Math.max(0, value); if (depth >= M) { depth -= M; loops++; } movedIn = true; restUntil = clock + REST; schedule(); },
      seekTo,
      pause() { paused = true; },
      resume() { paused = false; schedule(); },
      close
    };

    /* ---- Open ---------------------------------------------------------------- */
    try {
      html.style.setProperty('scrollbar-gutter', 'stable');
      body.style.setProperty('overflow', 'hidden', 'important');
      body.style.setProperty('transform-origin', '0 0');
      body.append(dialog);
      dialog.showModal();
      dialog.scrollTop = 0;
      sizeCanvas();
      labelSound();
      describe(depth);
      adoptAudio();
      dialog.focus({ preventScroll: true });
      if (still) {
        showChrome(0);
        const begin = () => { if (closed) return; showStill(1); };
        if (ready(1)) begin(); else { const wait = setInterval(() => { if (ready(1) || closed) { clearInterval(wait); begin(); } }, 50); }
      } else {
        body.style.setProperty('will-change', 'transform');
        lastNow = 0;
        schedule();
      }
    } catch (error) { cleanup(); throw error; }
    return true;
  }

  /* ---------------------------------------------------------------------------
   * Sound: music-box tines, and a soft room.
   * ------------------------------------------------------------------------- */
  function createGalleryAudio(context, options = {}) {
    const offline = typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext;
    const rate = context.sampleRate;
    let enabled = true; let closed = false;
    const audio = { context, scheduled: 0 };
    const out = context.createDynamicsCompressor(); out.threshold.value = -16; out.ratio.value = 3; out.connect(context.destination);
    const master = context.createGain(); master.gain.value = 0.9; master.connect(out);
    const tone = context.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3800; tone.Q.value = 0.4;
    tone.connect(master);
    const convolver = context.createConvolver(); convolver.connect(master);
    const send = context.createGain(); send.gain.value = 0.3; send.connect(convolver);
    tone.connect(send);
    {
      const length = Math.round(1.8 * rate); const ir = context.createBuffer(2, length, rate); let s = 11;
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch); let low = 0;
        for (let i = 0; i < length; i++) { s = (s * 1664525 + 1013904223) >>> 0; low += 0.5 * ((s / 4294967296) * 2 - 1 - low); data[i] = low * Math.exp(-i / (rate * 0.28)); }
      }
      convolver.buffer = ir;
    }
    const ready = () => enabled && !closed && (offline || context.state === 'running');
    const ramp = (value, seconds) => { const p = master.gain; const t = context.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(value, t + seconds); };
    function tine(m, share = 1, t = context.currentTime) {
      if (!ready()) return;
      const f = midiHz(m);
      for (const [ratio, part, decay] of TINE) {
        if (f * ratio > rate * 0.45) continue;
        const o = context.createOscillator(); o.type = 'sine'; o.frequency.value = f * ratio;
        const amp = context.createGain(); const g = NOTE_GAIN * share * part;
        amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(g, t + 0.003);
        amp.gain.exponentialRampToValueAtTime(g * 1e-3, t + 0.003 + decay);
        o.connect(amp); amp.connect(tone); o.start(t); o.stop(t + decay + 0.05);
        audio.scheduled++;
      }
    }
    Object.assign(audio, {
      get ready() { return ready(); },
      tine,
      arpeggio(chord, t = context.currentTime) { chord.forEach((m, i) => tine(m, 0.85, t + i * 0.13)); },
      setEnabled(value) {
        if (closed || enabled === value) return;
        enabled = value;
        if (enabled && !offline && context.state === 'suspended') context.resume().catch(() => {});
        ramp(enabled ? 0.9 : 0, 0.2);
      },
      suspend() { if (!offline && context.state === 'running') context.suspend().catch(() => {}); },
      resume() { if (!offline && enabled && context.state === 'suspended') context.resume().catch(() => {}); },
      close() {
        if (closed) return;
        closed = true;
        if (offline) return;
        // Let the last note ring a little, then go.
        setTimeout(() => ramp(0, 0.6), 400);
        setTimeout(() => { try { context.close().catch(() => {}); } catch (error) { /* closed */ } }, 1200);
      }
    });
    return audio;
  }

  window.SiteGallery = { open, get active() { return active; }, createAudio: (context, options) => createGalleryAudio(context, options) };
})();
