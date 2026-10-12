/**
 * Print Gallery. The homepage photo holds the page as it was before; that page's photo holds
 * the page before it; and so on, back through every version of the site that looked
 * different, to the first one, whose photo holds the page you started on. The camera dives
 * from the live page into its photo, through the prints, and comes out on the live page
 * again: a strange loop, after Escher's Print Gallery (1956).
 *
 * Depth d is continuous: 0 is the live page, 1..N the prints (1 the newest, N the first
 * version), N + 1 the live page again. At an integer the level fits the viewport; between
 * k and k + 1 the camera zooms exponentially about the one point that the two framings share
 * (so a dive is a straight fall, whatever the portal's place). A level's photo shows its own
 * portrait until the camera starts into it (d > k + 0.05), then dissolves into the next print
 * on a white mount. Near the end of a segment, whatever lies outside the next level fades to
 * the wall, so a level is framed alike whether the camera arrives or leaves.
 *
 * The live page is the real DOM: while it is on screen (the first segment, and inside the
 * first version's photo at the end) the body carries a CSS transform that puts it where the
 * camera wants it, and the canvas leaves a hole there. The dialog is in the top layer, so the
 * transform never moves it. Closing restores the body's style exactly; the page DOM is
 * never mutated otherwise.
 *
 * Sound, only on arrival: a music-box note per version, stepping down D major pentatonic as
 * the camera goes back in time (an octave lower beneath it when the year changes), and a
 * rising arpeggio when the loop closes on today.
 *
 * Prints: easter/gallery/prints/ (built by scripts/build_print_gallery.py): manifest.json and
 * two WebP sizes per print, the small ones loaded at once, the large ones as the camera nears.
 * A print's portal is the photo's box inside its border.
 */
(() => {
  'use strict';
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const BASE = new URL('./prints/', SCRIPT_SRC).href;

  /* ---------------------------------------------------------------------------
   * Tunable constants. Times are seconds unless named _MS.
   * ------------------------------------------------------------------------- */
  const PRINT_ASPECT = 1.6;            // the prints are 1280 x 800 captures
  const MOUNT = 0.86;                  // a print fills this share of a square portal's width ...
  const MOUNT_ROUND = 0.9;             // ... or of the largest rectangle inside a round one
  const DISSOLVE = [0.05, 0.35];       // a portrait dissolves into the next print over this part of a segment
  const WALL_FADE = [0.62, 1];         // outside the next level fades to the wall over this part
  const AUTO_SPEED = 1.15;             // levels per second at the middle of a segment, before easing ...
  const AUTO_REST = 0.08;              // ... and this share of it at a level (the camera settles there)
  const WHEEL_GAIN = 0.0045;           // levels per second per wheel pixel
  const USER_DECAY = 0.35;             // s: the wheel's push fades this fast
  const MAX_SPEED = 7;                 // levels per second
  const AUTO_IDLE = 2.2;               // s after the reader's last push, the camera dives again
  const HOME_TIME = 1.8;               // s: Return rushes back to the present from any depth
  const DRAG_LEVELS = 0.9;             // levels per viewport height dragged
  const MIN_PORTAL_PX = 2;             // nested prints stop below this size on screen
  const LARGE_FROM = 1.1;              // the large file once a print is drawn this much wider than the small one
  const SMALL_WIDTH = 512;
  const ARRIVE = 0.02;                 // the camera has arrived at a level this close to it
  const CAPTION_FADE = [0.2, 0.42];    // a level's label fades out as the camera leaves it
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
  // A similarity x -> a x + b (a scalar scale, b a point), composed and inverted.
  const sim = (a, bx, by) => ({ a, bx, by });
  const compose = (S, M) => sim(S.a * M.a, S.a * M.bx + S.bx, S.a * M.by + S.by);   // S after M

  let manifestPromise = null;
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(new URL('manifest.json', BASE).href, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`manifest ${r.status}`); return r.json(); })
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
   * and test hooks: auto (false: no dive of its own), speed (levels per second, fixed).
   * Resolves true when it opened.
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
    const still = motion.matches;          // reduced motion: no zoom; one print at a time
    const previousFocus = document.activeElement;
    const scroll = { x: scrollX, y: scrollY };
    const saved = {};
    for (const [el, props] of [[body, ['overflow', 'transform', 'transform-origin', 'will-change']], [html, ['scrollbar-gutter']]]) {
      for (const prop of props) saved[`${el === body ? 'body' : 'html'}:${prop}`] = [el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
    }
    const hadAttribute = { htmlStyle: html.hasAttribute('style'), bodyStyle: body.hasAttribute('style') };
    const events = new AbortController();
    const on = (target, type, fn, extra) => target.addEventListener(type, fn, Object.assign({ signal: events.signal }, extra));

    const prints = manifest.prints;
    const N = prints.length;
    const pageStyle = getComputedStyle(body);
    const wallRGB = (() => { const c = parseColour(pageStyle.backgroundColor); return c && c[3] > 0.5 ? c : parseColour(getComputedStyle(html).backgroundColor) || [255, 255, 255, 1]; })();
    const wall = `rgb(${wallRGB.slice(0, 3).join(',')})`;
    const dark = (0.299 * wallRGB[0] + 0.587 * wallRGB[1] + 0.114 * wallRGB[2]) < 128;

    /* ---- Geometry ---------------------------------------------------------- */
    let vw = innerWidth; let vh = innerHeight;
    // The live page's portal, in viewport px (measured with the body untransformed).
    const livePortal = (() => {
      const b = photo.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(photo).borderTopWidth) || 0;
      return { x: b.left + border, y: b.top + border, w: b.width - 2 * border, h: b.height - 2 * border, round: false };
    })();
    const bodyOrigin = (() => { const b = body.getBoundingClientRect(); return { x: b.left, y: b.top }; })();
    // A print's portal in print units (width 1, height 1 / PRINT_ASPECT), inside its border.
    const portalOf = j => {
      if (j === 0) return livePortal;
      const p = prints[j - 1].portal; const hgt = 1 / PRINT_ASPECT;
      return { x: p[0], y: p[1] * hgt, w: p[2], h: p[3] * hgt, round: prints[j - 1].round };
    };
    const isLive = j => j === 0 || j === N + 1;
    const widthOf = j => (isLive(j) ? vw : 1);                 // a level's width in its own units
    const aspectOf = j => (isLive(j) ? vw / vh : PRINT_ASPECT);
    // Where level j + 1 sits inside level j's portal: a similarity from j + 1's units to j's.
    function mountOf(j) {
      const P = portalOf(j); const a = aspectOf(j + 1);
      let w;
      if (P.round) { const D = Math.min(P.w, P.h); w = MOUNT_ROUND * D / Math.sqrt(1 + 1 / (a * a)); }
      else w = MOUNT * Math.min(P.w, P.h * a);
      const h = w / a;
      return { rect: { x: P.x + (P.w - w) / 2, y: P.y + (P.h - h) / 2, w, h }, M: sim(w / widthOf(j + 1), P.x + (P.w - w) / 2, P.y + (P.h - h) / 2) };
    }
    // Level j fitted into the viewport.
    function fitOf(j) {
      if (isLive(j)) return sim(1, 0, 0);
      const a = Math.min(vw, vh * PRINT_ASPECT);
      return sim(a, (vw - a) / 2, (vh - a / PRINT_ASPECT) / 2);
    }
    let mounts = [];
    const remount = () => { mounts = Array.from({ length: N + 1 }, (_, j) => mountOf(j)); };
    remount();
    // The camera at depth d: the outer level k and its similarity (level-k units to CSS px).
    function camera(d) {
      const k = clamp(Math.floor(d), 0, N);
      const t = clamp(d - k, 0, 1);
      const S0 = fitOf(k);
      const { M } = mounts[k];
      const F1 = fitOf(k + 1);
      const a1 = F1.a / M.a;
      const S1 = sim(a1, F1.bx - a1 * M.bx, F1.by - a1 * M.by);
      if (Math.abs(a1 - S0.a) < 1e-12) return { k, t, S: S0 };
      // The shared point z: S0(z) = S1(z); zoom about it exponentially.
      const zx = (S0.bx - S1.bx) / (a1 - S0.a); const zy = (S0.by - S1.by) / (a1 - S0.a);
      const a = S0.a * Math.pow(a1 / S0.a, t);
      const fx = S0.a * zx + S0.bx; const fy = S0.a * zy + S0.by;
      return { k, t, S: sim(a, fx - a * zx, fy - a * zy) };
    }

    /* ---- Images ------------------------------------------------------------ */
    const images = prints.map(p => ({ small: null, large: null, smallLoading: false, largeLoading: false, failed: false, file: p.file }));
    const loadImage = (j, size) => {
      const record = images[j - 1];
      const key = size === 'large' ? 'largeLoading' : 'smallLoading';
      if (record[size] || record[key] || record.failed) return;
      record[key] = true;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const ready = () => { record[size] = img; record[key] = false; };
        if (img.decode) img.decode().then(ready, ready); else ready();
      };
      img.onerror = () => { record[key] = false; if (size === 'small') record.failed = true; };
      img.src = new URL(`${record.file}-${size === 'large' ? 'l' : 's'}.webp`, BASE).href;
    };
    // The small prints, nearest first; the large ones around the camera.
    for (let j = 1; j <= Math.min(N, 4); j++) loadImage(j, 'small');
    let smallQueued = 4;
    function feedImages(d) {
      while (smallQueued < N && images.filter(r => r.smallLoading).length < 3) loadImage(++smallQueued, 'small');
      const k = Math.floor(d);
      for (let j = Math.max(1, k); j <= Math.min(N, k + 2); j++) loadImage(j, 'large');
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
    const live = document.createElement('p');
    live.className = 'gallery-live'; live.setAttribute('aria-live', 'polite');
    dialog.append(canvas, label, chrome, live);
    const ctx = canvas.getContext('2d', { alpha: true });
    let dpr = 1;
    function sizeCanvas() {
      dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    }

    /* ---- State ------------------------------------------------------------- */
    let depth = still ? 1 : 0;
    let userSpeed = 0;
    let lastPush = -1e9;
    let paused = false; let held = false;
    let seek = null;                     // { from, to, start, duration }: a timed move (keys, Return)
    let raf = 0; let lastNow = 0; let clock = 0;
    let closed = false; let finishing = false;
    let phase = 'opening';               // opening -> diving -> (closed)
    let drag = null;
    let liveShown = 'page';              // where the DOM is drawn: 'page' (level 0), 'loop' (inside level N), or null
    const fixedSpeed = Number.isFinite(options.speed) ? options.speed : null;
    const auto = options.auto !== false;
    const stats = { frames: 0, avgMs: 0, maxMs: 0 };

    /* ---- The live page under the camera ------------------------------------ */
    function placeBody(S) {
      if (!S) { body.style.setProperty('transform', 'translate(-200vw, 0) scale(0.01)'); return; }
      const tx = S.bx - bodyOrigin.x * (1 - S.a); const ty = S.by - bodyOrigin.y * (1 - S.a);
      body.style.setProperty('transform', `translate(${tx}px, ${ty}px) scale(${S.a})`);
    }

    /* ---- Drawing ----------------------------------------------------------- */
    function drawPrint(j, S, alpha) {
      const record = images[j - 1];
      const w = S.a; const h = S.a / PRINT_ASPECT;
      if (S.bx > vw || S.by > vh || S.bx + w < 0 || S.by + h < 0) return;
      const img = record.large && w * dpr > SMALL_WIDTH * LARGE_FROM ? record.large : record.small || record.large;
      const before = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      if (img) ctx.drawImage(img, S.bx, S.by, w, h);
      else { ctx.fillStyle = '#f4f4f2'; ctx.fillRect(S.bx, S.by, w, h); }
      ctx.globalAlpha = before;
    }
    function portalPath(P, S) {
      const x = S.a * P.x + S.bx; const y = S.a * P.y + S.by; const w = S.a * P.w; const h = S.a * P.h;
      ctx.beginPath();
      if (P.round) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else ctx.rect(x, y, w, h);
      return { x, y, w, h };
    }
    // Level j's portal at depth d: the mount and the level inside it (and so on inward).
    // Returns the live page's similarity when it is drawn there (the DOM shows through a hole).
    function drawInside(j, S, d, alpha) {
      if (j > N) return null;
      const fade = smooth(j + DISSOLVE[0], j + DISSOLVE[1], d) * alpha;
      if (fade <= 0.001) return null;
      const P = portalOf(j);
      const box = portalPath(P, S);
      if (box.w < MIN_PORTAL_PX || box.x > vw || box.y > vh || box.x + box.w < 0 || box.y + box.h < 0) return null;
      if (!ready(j + 1)) return null;
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      const { rect, M } = mounts[j];
      const C = compose(S, M);
      const cx = S.a * rect.x + S.bx; const cy = S.a * rect.y + S.by; const cw = S.a * rect.w; const ch = S.a * rect.h;
      let livePlace = null;
      if (isLive(j + 1)) {
        // The live page shows through: a hole as opaque as the mount.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        ctx.fillRect(cx, cy, cw, ch);
        ctx.globalCompositeOperation = 'source-over';
        livePlace = C;
      } else {
        // The print inside, with a hairline, as opaque as the mount.
        drawPrint(j + 1, C, fade);
        ctx.globalAlpha = fade;
        ctx.lineWidth = 1 / dpr; ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.strokeRect(cx, cy, cw, ch);
        ctx.globalAlpha = 1;
        livePlace = drawInside(j + 1, C, d, fade);
      }
      ctx.restore();
      // The portal's edge, so the mount reads as inside the photo's frame.
      portalPath(P, S);
      ctx.globalAlpha = fade; ctx.lineWidth = 1 / dpr; ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.stroke();
      ctx.globalAlpha = 1;
      return livePlace;
    }
    function draw(d) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const { k, t, S } = camera(d);
      let liveAt = null;
      if (isLive(k)) {
        // The live page is the outer level: the canvas is clear but for its portal.
        ctx.clearRect(0, 0, vw, vh);
        liveAt = S;
        drawInside(k, S, d, 1);
      } else {
        ctx.fillStyle = wall; ctx.fillRect(0, 0, vw, vh);
        drawPrint(k, S, 1);
        liveAt = drawInside(k, S, d, 1);
      }
      // Near the end of the segment, outside the next level fades to the wall.
      const w = smooth(WALL_FADE[0], WALL_FADE[1], t);
      if (w > 0 && k <= N) {
        const { rect } = mounts[k];
        const x = S.a * rect.x + S.bx; const y = S.a * rect.y + S.by; const cw = S.a * rect.w; const ch = S.a * rect.h;
        ctx.globalAlpha = w; ctx.fillStyle = wall;
        if (y > 0) ctx.fillRect(0, 0, vw, y);
        if (y + ch < vh) ctx.fillRect(0, y + ch, vw, vh - y - ch);
        if (x > 0) ctx.fillRect(0, Math.max(0, y), x, Math.min(vh, y + ch) - Math.max(0, y));
        if (x + cw < vw) ctx.fillRect(x + cw, Math.max(0, y), vw - x - cw, Math.min(vh, y + ch) - Math.max(0, y));
        ctx.globalAlpha = 1;
      }
      const where = isLive(k) ? 'page' : liveAt ? 'loop' : null;
      if (where !== liveShown || where) { placeBody(liveAt); liveShown = where; }
      return k;
    }

    /* ---- The label --------------------------------------------------------- */
    let labelFor = -1; let announcedFor = -1;
    const plural = n => (n === 1 ? '1 version ago' : `${n} versions ago`);
    function describe(d) {
      const j = clamp(Math.round(d), 0, N + 1);
      const away = Math.abs(d - j);
      const opacity = 1 - smooth(CAPTION_FADE[0], CAPTION_FADE[1], away);
      label.style.opacity = String(opacity);
      if (j !== labelFor) {
        labelFor = j;
        label.classList.toggle('is-title', j === 0);
        if (j === 0) {
          labelDate.textContent = 'Print Gallery';
          labelText.textContent = 'Inside its photo, this page keeps every page it used to be.';
        } else if (j === N + 1) {
          labelDate.textContent = 'Today';
          labelText.textContent = 'The first version held this one.';
        } else {
          const p = prints[j - 1];
          labelDate.textContent = `${p.date} · ${j === N ? 'the first version' : plural(j)}`;
          labelText.textContent = p.message;
        }
      }
      if (opacity > 0.9 && announcedFor !== j) { announcedFor = j; announce(`${labelDate.textContent}. ${labelText.textContent}`); }
      // The marker: from today (left) to the first version (right), and back again at the loop.
      const u = d <= N ? clamp(d / N, 0, 1) : 1 - clamp(d - N, 0, 1);
      marker.style.left = `${(u * 100).toFixed(2)}%`;
    }
    let liveTimer = 0;
    function announce(text) { clearTimeout(liveTimer); liveTimer = setTimeout(() => { live.textContent = text; }, 400); }

    /* ---- Motion ------------------------------------------------------------- */
    // The camera's own dive: fast between levels, slow at each, where it settles.
    const autoSpeed = d => AUTO_SPEED * (AUTO_REST + Math.pow(Math.sin(Math.PI * (d - Math.floor(d))), 2));
    function step(dt) {
      if (seek) {
        const u = clamp((clock - seek.start) / seek.duration, 0, 1);
        depth = seek.from + (seek.to - seek.from) * easeInOut(u);
        if (u >= 1) { depth = seek.to; seek = null; userSpeed = 0; }
      } else {
        userSpeed *= Math.exp(-dt / USER_DECAY);
        const idle = clock - lastPush > AUTO_IDLE;
        let v = userSpeed;
        if (fixedSpeed !== null) v += fixedSpeed;
        else if (auto && !paused && idle) v += autoSpeed(depth);
        v = clamp(v, -MAX_SPEED, MAX_SPEED);
        let next = depth + v * dt;
        // Do not enter a segment whose next print has not arrived.
        const k = Math.floor(depth);
        if (next > k + DISSOLVE[0] && !ready(k + 1)) next = Math.min(next, k + DISSOLVE[0]);
        depth = next;
      }
      depth = clamp(depth, 0, N + 1);
    }
    function frame(now) {
      raf = 0;
      if (closed || held) return;
      const began = performance.now();
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now; clock += dt;
      if (phase === 'diving' && !still) step(dt);
      feedImages(depth);
      draw(depth);
      describe(depth);
      listen(depth);
      const took = performance.now() - began;
      stats.frames++; stats.avgMs += (took - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, took);
      // Out at either end: the present, from above (Return) or from below (the loop).
      if (phase === 'diving' && !still && ((depth <= 0 && (seek === null) && movedIn) || depth >= N + 1)) { finish(depth >= N + 1); return; }
      if (depth > 0.02) movedIn = true;
      schedule();
    }
    let movedIn = false;
    function schedule() { if (!raf && !closed && !held) raf = requestAnimationFrame(frame); }
    function seekTo(target, duration) {
      seek = { from: depth, to: clamp(target, 0, N + 1), start: clock, duration };
      lastPush = clock;
      schedule();
    }
    function push(levelsPerSecond) {
      if (still) return;
      userSpeed = clamp(userSpeed + levelsPerSecond, -MAX_SPEED, MAX_SPEED);
      lastPush = clock; seek = null;
      schedule();
    }

    /* ---- Still (reduced motion): one print at a time ----------------------- */
    function showStill(j) {
      const before = depth;
      depth = clamp(j, 1, N);
      draw(depth); describe(depth);
      if (before !== depth) note(depth);
      backButton.disabled = depth <= 1; nextButton.disabled = false;
    }
    function stepStill(delta) {
      if (depth + delta > N) { finish(true); return; }
      if (depth + delta < 1) { finish(false); return; }
      showStill(depth + delta);
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
    // An arrival: the camera comes within ARRIVE of a level, or passes through it in one frame
    // (a fast wheel or drag). Each level sounds once until the camera reaches another.
    let heard = 0; let heardFrom = 0;
    function listen(d) {
      const before = heardFrom; heardFrom = d;
      if (phase !== 'diving' || still) return;
      let j = Math.round(d);
      if (Math.abs(d - j) >= ARRIVE) {
        j = d > before ? Math.floor(d) : Math.ceil(d);
        if (!(d > before ? before < j : before > j)) return;
      }
      if (j === heard) return;
      heard = j;
      note(j);
    }
    // The note of an arrival at print j: a step down the melody per version back, an octave
    // below it as well when the year changes. The live page's arpeggio is the loop's (finish).
    function note(j) {
      if (!soundOn || isLive(j)) return;
      const now = performance.now();
      if (now - lastNote < NOTE_GAP_MS) return;
      lastNote = now;
      if (notes.length < 400) notes.push(`${j}`);
      if (!audio || !audio.ready) return;
      const m = MELODY[(j - 1) % MELODY.length];
      const year = p => p.date.slice(0, 4);
      const newYear = j > 1 && year(prints[j - 1]) !== year(prints[j - 2]);
      audio.tine(m, 1);
      if (newYear) audio.tine(m - 12, 0.6);
    }
    function labelSound() {
      soundButton.setAttribute('aria-pressed', String(soundOn));
      soundLabel.textContent = soundOn ? 'Sound on' : 'Sound off';
    }
    function setSound(value) {
      soundOn = value;
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (error) { /* private mode */ }
      labelSound();
      if (soundOn) { adoptAudio(); if (audio) audio.setEnabled(true); }
      else if (audio) audio.setEnabled(false);
    }

    /* ---- Open, close, restore ---------------------------------------------- */
    function restoreStyles() {
      for (const [el, prop, value, priority] of Object.values(saved)) {
        if (value) el.style.setProperty(prop, value, priority); else el.style.removeProperty(prop);
      }
      if (!hadAttribute.htmlStyle && html.getAttribute('style') === '') html.removeAttribute('style');
      if (!hadAttribute.bodyStyle && body.getAttribute('style') === '') body.removeAttribute('style');
    }
    let lingering = 0;                   // s the sound may ring on after the close (the loop's arpeggio)
    function cleanup() {
      if (closed) return;
      closed = true; phase = 'closed';
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      events.abort();
      clearTimeout(chromeTimer); clearTimeout(liveTimer);
      if (audio) { try { audio.close(lingering); } catch (error) { /* closed */ } audio = null; }
      try { if (dialog.open) dialog.close(); } catch (error) { /* already closed */ }
      dialog.remove();
      restoreStyles();
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      if (scrollX !== scroll.x || scrollY !== scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      active = false;
    }
    // Out on the live page (depth 0 or N + 1, where the body's transform is the identity).
    function finish(looped) {
      if (finishing) return;
      finishing = true;
      if (looped && soundOn) {
        if (notes.length < 400) notes.push('today');
        if (audio && audio.ready) { audio.arpeggio(TODAY); lingering = 2.5; }
      }
      cleanup();
    }
    /** Return: a rush back up to the present from any depth; a second request closes at once. */
    function close() {
      if (closed) return;
      if (still || document.hidden || seek && seek.to === 0) { cleanup(); return; }
      movedIn = true;
      seekTo(0, Math.min(HOME_TIME, 0.5 + depth * 0.25));
    }

    /* ---- Chrome ------------------------------------------------------------- */
    let chromeTimer = 0; let chromeHover = false;
    const showChrome = ms => {
      chrome.classList.add('is-shown');
      clearTimeout(chromeTimer);
      if (ms && !still) chromeTimer = setTimeout(() => { if (!chromeHover) chrome.classList.remove('is-shown'); }, ms);
    };

    /* ---- Events ------------------------------------------------------------ */
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup);
    on(returnButton, 'click', () => close());
    on(soundButton, 'click', () => setSound(!soundOn));
    on(nextButton, 'click', () => (still ? stepStill(1) : seekTo(Math.floor(depth) + 1, 1.1)));
    on(backButton, 'click', () => (still ? stepStill(-1) : seekTo(Math.ceil(depth) - 1, 1.1)));
    on(window, 'pagehide', cleanup);
    on(window, 'resize', () => {
      // The live page reflows: its portal no longer holds. Out at once from a live segment.
      if (depth < 1 || depth > N - 1) { cleanup(); return; }
      vw = innerWidth; vh = innerHeight; sizeCanvas(); remount(); schedule();
    });
    on(document, 'visibilitychange', () => {
      if (document.hidden) { held = true; if (raf) cancelAnimationFrame(raf); raf = 0; if (audio) audio.suspend(); }
      else { held = false; lastNow = 0; if (audio && soundOn) audio.resume(); schedule(); }
    });
    on(motion, 'change', () => { if (motion.matches) cleanup(); });
    on(dialog, 'wheel', event => {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * vh : event.deltaY;
      if (still) { if (Math.abs(delta) > 20 && !wheelLock) { wheelLock = true; setTimeout(() => { wheelLock = false; }, 450); stepStill(delta > 0 ? 1 : -1); } return; }
      push(delta * WHEEL_GAIN);
    }, { passive: false });
    let wheelLock = false;
    on(dialog, 'pointerdown', event => {
      if (chrome.contains(event.target)) return;
      unlockAudio();
      showChrome(CHROME_TAP_MS);
      if (still) return;
      drag = { id: event.pointerId, y: event.clientY, t: performance.now(), v: 0 };
      try { dialog.setPointerCapture(event.pointerId); } catch (error) { /* not capturable */ }
    });
    on(dialog, 'pointermove', event => {
      const inCorner = event.clientX > vw - CHROME_REGION[0] && event.clientY > vh - CHROME_REGION[1];
      if (inCorner) { chromeHover = true; showChrome(0); } else if (chromeHover) { chromeHover = false; showChrome(CHROME_HIDE_MS); }
      if (!drag || event.pointerId !== drag.id) return;
      const now = performance.now();
      const dy = drag.y - event.clientY;
      const dd = (dy / vh) * DRAG_LEVELS;
      depth = clamp(depth + dd, 0, N + 1);
      drag.v = 0.7 * drag.v + 0.3 * (dd / Math.max(1e-3, (now - drag.t) / 1000));
      drag.y = event.clientY; drag.t = now;
      lastPush = clock; seek = null; userSpeed = 0; movedIn = true;
      schedule();
    });
    const release = event => {
      if (!drag || event.pointerId !== drag.id) return;
      userSpeed = clamp(drag.v, -MAX_SPEED, MAX_SPEED);
      drag = null;
    };
    on(dialog, 'pointerup', release);
    on(dialog, 'pointercancel', release);
    on(dialog, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const k = event.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'ArrowRight') { event.preventDefault(); still ? stepStill(1) : seekTo(Math.floor(depth + 0.001) + 1, 1.1); }
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'ArrowLeft') { event.preventDefault(); still ? stepStill(-1) : seekTo(Math.ceil(depth - 0.001) - 1, 1.1); }
      else if (k === ' ' && !event.target.closest('button, a')) { event.preventDefault(); if (still) stepStill(1); else { paused = !paused; lastPush = paused ? clock : -1e9; } }
      else if (k === 'Home') { event.preventDefault(); close(); }
      else if (k === 'End') { event.preventDefault(); if (!still) seekTo(N + 1, Math.min(6, 0.6 + (N + 1 - depth) * 0.3)); }
      else if ((k === 'm' || k === 'M') && !event.repeat) { event.preventDefault(); setSound(!soundOn); }
      if (k !== 'm' && k !== 'M') unlockAudio();
      showChrome(CHROME_TAP_MS);
    });
    function unlockAudio() {
      if (!soundOn || closed) return;
      if (!audio) adoptAudio();
      else if (audio.context.state === 'suspended' && !document.hidden) audio.context.resume().catch(() => {});
    }

    /* ---- Debug and test hooks (never UI) ---------------------------------- */
    dialog.gallery = {
      get phase() { return phase; },
      get depth() { return depth; },
      get levels() { return N; },
      get still() { return still; },
      get live() { return liveShown; },
      get sound() { return soundOn; },
      get frameStats() { return stats; },
      get loaded() { return images.map(r => (r.large ? 'l' : r.small ? 's' : '-')).join(''); },
      label: () => ({ date: labelDate.textContent, message: labelText.textContent }),
      notes: () => notes.slice(),
      setDepth(value) { seek = null; userSpeed = 0; lastPush = clock; depth = clamp(value, 0, N + 1); movedIn = true; schedule(); },
      seekTo,
      pause() { paused = true; },
      resume() { paused = false; lastPush = -1e9; schedule(); },
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
      describe(depth);                   // the label is there from the first paint
      adoptAudio();
      dialog.focus({ preventScroll: true });
      if (still) {
        showChrome(0);
        const begin = () => { if (closed) return; showStill(1); phase = 'diving'; };
        if (ready(1)) begin(); else { const wait = setInterval(() => { if (ready(1) || closed) { clearInterval(wait); begin(); } }, 50); }
      } else {
        body.style.setProperty('will-change', 'transform');
        phase = 'diving';
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
      // Fade and close; `linger` s first, so a last cue (the loop's arpeggio) can ring out.
      close(linger = 0) {
        if (closed) return;
        closed = true;
        if (offline) return;
        setTimeout(() => ramp(0, 0.6), 400 + linger * 1000);
        setTimeout(() => { try { context.close().catch(() => {}); } catch (error) { /* closed */ } }, 1200 + linger * 1000);
      }
    });
    return audio;
  }

  window.SiteGallery = { open, get active() { return active; }, createAudio: (context, options) => createGalleryAudio(context, options) };
})();
