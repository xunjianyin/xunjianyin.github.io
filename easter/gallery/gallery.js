/**
 * Print Gallery. The homepage photo holds the page as it was before; that page's photo holds
 * the page before it; and so on, back through every version of the site that looked
 * different, to the first one, whose photo holds the page you are on, whose photo holds ...
 * An endless fall, after Escher's Print Gallery (1956) and the Droste effect.
 *
 * Each print is a square cut around its version's photo, the photo at its centre, CROP photo
 * widths a side (scripts/build_print_gallery.py), so every level nests in the photo of the one
 * before at the same scale, about CROP times smaller, around the same centre. Five or six
 * levels are on screen at once, and the camera falls through them at a steady exponential
 * rate along one straight line: depth d gains one level per 1 / SPEED s, the zoom about the
 * point the level and its photo share (the centre, up to the capture's rounding).
 *
 * Levels: 0 is the live page, 1..N the prints (1 the newest), and the cycle repeats (the live
 * page sits in the first version's photo). Depth below 0 is the way in: from the page as it is
 * (d = START, the identity) to the live page's square filling the screen (d = 0), the photo
 * gliding to the centre at the same zoom rate. Past N + 1 the depth wraps by N + 1.
 *
 * The live page is the real DOM: wherever it is drawn (the way in, and once a cycle inside the
 * first version's photo) the body carries the CSS transform that puts its square there, and
 * the canvas leaves a hole; the dialog is in the top layer, so the transform never moves it.
 * Closing restores the body's style exactly; the page DOM is never mutated otherwise.
 *
 * Sound: a Shepard chord (Shepard 1964; Risset's endless glissando), which falls for ever as
 * the camera falls and rises as it rises: half an octave a level.
 */
(() => {
  'use strict';
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const BASE = new URL('./prints/', SCRIPT_SRC).href;

  /* ---------------------------------------------------------------------------
   * Tunable constants. Times are seconds unless named _MS.
   * ------------------------------------------------------------------------- */
  const SPEED = 0.42;                  // levels per second, the camera's own fall
  const START_HOLD = 0.7;              // s: the photo opens into the gallery before the fall
  const START_EASE = 1.6;              // s: the fall eases in to SPEED
  const RELAX = 0.8;                   // s: a push from the wheel or a drag relaxes to the camera's own speed
  const WHEEL_GAIN = 0.004;            // levels per second per wheel pixel
  const MAX_SPEED = 6;                 // levels per second
  const DRAG_LEVELS = 1.2;             // levels per viewport height dragged
  const STEP_TIME = 0.9;               // s: the arrows move one level
  const HOME_TIME = [1.0, 0.06];       // s: Return rushes home in a + b per level
  const MIN_PORTAL_PX = 1.5;           // nesting stops below this size on screen
  const LARGE_FROM = 360;              // device px: a print drawn wider uses its large file
  const CAPTION_FADE = [0.24, 0.44];   // a level's label fades out as the camera leaves it
  const CHROME_REGION = [260, 120];
  const CHROME_HIDE_MS = 1800;
  const CHROME_TAP_MS = 3500;
  // Sound (Web Audio, synthesized; the site's preference, as for the other eggs).
  const SOUND_KEY = 'spira-sound';
  const SHEPARD = {
    base: 27.5,                        // Hz: the lowest partial's octave (A0)
    octaves: 9,                        // partials a voice, an octave apart
    centre: 3.1,                       // octaves above base: the spectral envelope's peak (about 235 Hz)
    width: 1.05,                       // octaves: its standard deviation
    perLevel: 0.5,                     // octaves the chord falls a level
    voices: [[0, 1], [7 / 12, 0.55], [4 / 12, 0.3]],   // root, fifth, major third: an endless falling chord
    gain: 0.05, glide: 0.03, cutoff: 1800, master: 0.5, fadeIn: 1.6
  };
  const LOOP_CHORD = [55, 62, 67, 71, 74];                   // G D G B D: a cycle passes today

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
   * and test hooks: auto (false: the camera does not fall of its own), speed (levels per
   * second, fixed). Resolves true when it opened.
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
    const still = motion.matches;          // reduced motion: no fall; one level at a time
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
    const CROP = manifest.crop || 3.6;
    const pageStyle = getComputedStyle(body);
    const wallRGB = (() => { const c = parseColour(pageStyle.backgroundColor); return c && c[3] > 0.5 ? c : parseColour(getComputedStyle(html).backgroundColor) || [255, 255, 255, 1]; })();
    const wall = `rgb(${wallRGB.slice(0, 3).join(',')})`;
    const dark = (0.299 * wallRGB[0] + 0.587 * wallRGB[1] + 0.114 * wallRGB[2]) < 128;

    /* ---- Geometry: every level is a unit square ------------------------------ */
    let vw = innerWidth; let vh = innerHeight;
    const bodyOrigin = (() => { const b = body.getBoundingClientRect(); return { x: b.left, y: b.top }; })();
    // The live page's square, in viewport px: centred on its photo, CROP photo widths a side.
    const live = (() => {
      const b = photo.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(photo).borderTopWidth) || 0;
      const side = CROP * b.width;
      const x = b.left + b.width / 2 - side / 2; const y = b.top + b.height / 2 - side / 2;
      return { x, y, side, centre: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
        portal: { x: (b.left + border - x) / side, y: (b.top + border - y) / side, w: (b.width - 2 * border) / side, round: false } };
    })();
    const index = i => ((i % M) + M) % M;            // a depth's level: 0 the live page
    const portalOf = j => (j === 0 ? live.portal : { x: prints[j - 1].portal[0], y: prints[j - 1].portal[1], w: prints[j - 1].portal[2], round: prints[j - 1].round });
    const mountOf = j => { const P = portalOf(j); return sim(P.w, P.x, P.y); };   // the next level's square, in this one's units
    const cover = () => Math.max(vw, vh);
    const framing = () => sim(cover(), (vw - cover()) / 2, (vh - cover()) / 2);   // a level's square filling the screen
    // The camera between level j at k (framed) and level j + 1 at k + 1 (framed): an
    // exponential zoom about the one point the two framings share.
    function fall(j, t) {
      const S0 = framing(); const m = mountOf(j); const F = framing();
      const a1 = F.a / m.a;
      const S1 = sim(a1, F.bx - a1 * m.bx, F.by - a1 * m.by);
      const zx = (S0.bx - S1.bx) / (a1 - S0.a); const zy = (S0.by - S1.by) / (a1 - S0.a);
      const a = S0.a * Math.pow(a1 / S0.a, t);
      const fx = S0.a * zx + S0.bx; const fy = S0.a * zy + S0.by;
      return sim(a, fx - a * zx, fy - a * zy);
    }
    // The way in: from the page as it is (START, the identity) to its square filling the screen
    // (0), at the fall's own zoom rate; the photo glides to the centre.
    const startScale = live.side;
    const zoomPerLevel = 1 / live.portal.w;
    const START = cover() > startScale ? -Math.log(cover() / startScale) / Math.log(zoomPerLevel) : -0.25;
    function wayIn(d) {
      const u = clamp((d - START) / -START, 0, 1);
      const a = startScale * Math.pow(cover() / startScale, u);
      const g = easeInOut(u);
      const cx = live.centre.x + (vw / 2 - live.centre.x) * g; const cy = live.centre.y + (vh / 2 - live.centre.y) * g;
      return sim(a, cx - a / 2, cy - a / 2);
    }
    const camera = d => (d < 0 ? { k: 0, S: wayIn(d) } : { k: Math.floor(d), S: fall(index(Math.floor(d)), d - Math.floor(d)) });

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
    // Large files for the level under the camera and the three after it; others are let go.
    function feedImages(d) {
      const k = Math.floor(Math.max(0, d));
      const near = new Set([0, 1, 2, 3].map(n => index(k + n)));
      images.forEach((record, i) => {
        const j = i + 1;
        if (near.has(j)) loadImage(j, 'large');
        else if (record.large) record.large = null;
      });
    }
    const ready = j => j === 0 || !!images[j - 1].small;

    /* ---- DOM ------------------------------------------------------------- */
    const dialog = document.createElement('dialog');
    dialog.id = 'gallery';
    dialog.tabIndex = -1;
    dialog.autofocus = true;
    dialog.setAttribute('aria-label', 'Print Gallery: every earlier version of this page, each inside the photo of the next, without end');
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
    let depth = still ? 1 : START;
    let speed = 0;                         // levels per second, now
    let loops = 0;                         // cycles completed (the label says so)
    let paused = false; let held = false;
    let seek = null;                       // { from, to, start, duration }
    let raf = 0; let lastNow = 0; let clock = 0;
    let closed = false;
    let phase = 'opening';                 // opening -> falling -> (closed)
    let drag = null;
    let liveShown = 'page';                // where the DOM is: 'page' (the way in or a framed live level), 'inside' (a print's photo), null
    let opening = 0;                       // 0..1: the photo opens into the gallery
    const fixedSpeed = Number.isFinite(options.speed) ? options.speed : null;
    const auto = options.auto !== false;
    const stats = { frames: 0, avgMs: 0, maxMs: 0 };

    function placeBody(S) {
      if (!S) { body.style.setProperty('transform', 'translate(-200vw, 0) scale(0.01)'); return; }
      // S maps the live square's units to the screen; the body maps viewport px through it.
      const a = S.a / live.side;
      const bx = S.bx - a * live.x; const by = S.by - a * live.y;
      body.style.setProperty('transform', `translate(${bx - bodyOrigin.x * (1 - a)}px, ${by - bodyOrigin.y * (1 - a)}px) scale(${a})`);
    }

    /* ---- Drawing ----------------------------------------------------------- */
    function clipPortal(P, S) {
      const x = S.a * P.x + S.bx; const y = S.a * P.y + S.by; const w = S.a * P.w;
      ctx.beginPath();
      if (P.round) ctx.ellipse(x + w / 2, y + w / 2, w / 2, w / 2, 0, 0, Math.PI * 2);
      else ctx.rect(x, y, w, w);
    }
    // Level i (an absolute depth) drawn at S, and everything inside its photo. Returns where the
    // live page is drawn, if it is.
    function drawLevel(i, S, alpha, outer) {
      const j = index(i);
      let liveAt = null;
      if (j === 0) {
        // The live page: the DOM, through a hole (the outer level's canvas is clear already).
        if (!outer) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = alpha; ctx.fillStyle = '#000';
          ctx.fillRect(S.bx, S.by, S.a, S.a);
          ctx.globalCompositeOperation = 'source-over';
        }
        liveAt = S;
      } else {
        const record = images[j - 1];
        const img = record.large && S.a * dpr > LARGE_FROM ? record.large : record.small || record.large;
        ctx.globalAlpha = alpha;
        if (img) ctx.drawImage(img, S.bx, S.by, S.a, S.a);
        else { ctx.fillStyle = '#f4f4f2'; ctx.fillRect(S.bx, S.by, S.a, S.a); }
      }
      const P = portalOf(j);
      if (S.a * P.w < MIN_PORTAL_PX || !ready(index(i + 1))) { ctx.globalAlpha = 1; return liveAt; }
      ctx.save();
      clipPortal(P, S);
      ctx.clip();
      // The live page's photo opens into the gallery at the start.
      const inner = drawLevel(i + 1, compose(S, mountOf(j)), j === 0 && outer ? alpha * opening : alpha, false);
      ctx.restore();
      ctx.globalAlpha = 1;
      return liveAt || inner;
    }
    function draw(d) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const { k, S } = camera(d);
      const j = index(k);
      if (j === 0) ctx.clearRect(0, 0, vw, vh);
      else { ctx.fillStyle = wall; ctx.fillRect(0, 0, vw, vh); }
      const liveAt = drawLevel(k, S, 1, true);
      const where = !liveAt ? null : j === 0 ? 'page' : 'inside';
      if (where || where !== liveShown) placeBody(liveAt);
      liveShown = where;
      return k;
    }

    /* ---- The label --------------------------------------------------------- */
    let labelFor = ''; let announcedFor = '';
    const ago = n => (n === 1 ? '1 version ago' : `${n} versions ago`);
    function describe(d) {
      const nearest = Math.round(Math.max(d, 0));
      const j = index(nearest);
      const away = d < 0 ? 0 : Math.abs(d - nearest);
      const opacity = 1 - smooth(CAPTION_FADE[0], CAPTION_FADE[1], away);
      label.style.opacity = String(opacity);
      const again = loops > 0 || nearest >= M;
      const key = `${j}:${again ? 1 : 0}`;
      if (key !== labelFor) {
        labelFor = key;
        label.classList.toggle('is-title', j === 0);
        if (j === 0 && !again) {
          labelDate.textContent = 'Print Gallery';
          labelText.textContent = 'Inside its photo, this page keeps every page it used to be.';
        } else if (j === 0) {
          labelDate.textContent = 'Today';
          labelText.textContent = 'The first version held this one. And on.';
        } else {
          const p = prints[j - 1];
          labelDate.textContent = `${p.date} · ${j === N ? 'the first version' : ago(j)}`;
          labelText.textContent = p.message;
        }
      }
      if (opacity > 0.9 && announcedFor !== key) { announcedFor = key; announce(`${labelDate.textContent}. ${labelText.textContent}`); }
      // The marker: today (left) to the first version (right), within the cycle.
      const u = clamp((((Math.max(d, 0) % M) + M) % M) / N, 0, 1);
      marker.style.left = `${(u * 100).toFixed(2)}%`;
    }
    let liveTimer = 0;
    function announce(text) { clearTimeout(liveTimer); liveTimer = setTimeout(() => { announcer.textContent = text; }, 400); }

    /* ---- Motion ------------------------------------------------------------- */
    function target() {
      if (fixedSpeed !== null) return fixedSpeed;
      if (!auto || paused) return 0;
      return SPEED * easeInOut((clock - START_HOLD) / START_EASE);
    }
    let movedIn = false; let leaving = false;
    function step(dt) {
      if (seek) {
        const u = clamp((clock - seek.start) / seek.duration, 0, 1);
        depth = seek.from + (seek.to - seek.from) * easeInOut(u);
        if (u >= 1) { depth = seek.to; seek = null; speed = 0; }
      } else if (!drag) {
        if (fixedSpeed !== null) speed = fixedSpeed;
        else speed += (target() - speed) * (1 - Math.exp(-dt / RELAX));
        speed = clamp(speed, -MAX_SPEED, MAX_SPEED);
        let next = depth + speed * dt;
        // Never into a level whose print has not arrived.
        const k = Math.floor(Math.max(0, depth));
        if (next > k + 0.98 && !ready(index(k + 2))) next = Math.min(next, k + 0.98);
        depth = next;
      }
      if (depth >= M) { depth -= M; loops++; if (seek) { seek.from -= M; seek.to -= M; } if (audio && soundOn) audio.chord(); }
      depth = Math.max(depth, START);
    }
    function frame(now) {
      raf = 0;
      if (closed || held) return;
      const began = performance.now();
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now; clock += dt;
      opening = still ? 1 : smooth(0, START_HOLD, clock);
      if (phase === 'falling' && !still) step(dt);
      feedImages(depth);
      draw(depth);
      describe(depth);
      listen(depth);
      const took = performance.now() - began;
      stats.frames++; stats.avgMs += (took - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, took);
      // Out where it began: the page as it is.
      if (!still && depth <= START + 1e-6 && (leaving || movedIn)) { cleanup(); return; }
      if (depth > START + 0.02) movedIn = true;
      schedule();
    }
    function schedule() { if (!raf && !closed && !held) raf = requestAnimationFrame(frame); }
    function seekTo(to, duration) {
      seek = { from: depth, to, start: clock, duration };
      schedule();
    }
    function push(levelsPerSecond) {
      if (still) return;
      seek = null;
      speed = clamp(speed + levelsPerSecond, -MAX_SPEED, MAX_SPEED);
      schedule();
    }

    /* ---- Still (reduced motion): one level at a time ----------------------- */
    function showStill(j) {
      depth = j;
      draw(depth); describe(depth); listen(depth);
      backButton.disabled = depth <= 1;
    }
    function stepStill(delta) {
      if (depth + delta < 1) { cleanup(); return; }
      showStill(depth + delta > N ? 1 : depth + delta);
    }

    /* ---- Sound ------------------------------------------------------------- */
    let soundOn = true;
    try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (error) { soundOn = true; }
    let audio = null;
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
    function listen(d) { if (audio) audio.fall(d + loops * M, phase === 'falling' ? opening : 0); }
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
      seekTo(START, HOME_TIME[0] + HOME_TIME[1] * (depth - START));
    }

    /* ---- Chrome ------------------------------------------------------------- */
    let chromeTimer = 0; let chromeHover = false;
    const showChrome = ms => {
      chrome.classList.add('is-shown');
      clearTimeout(chromeTimer);
      if (ms && !still) chromeTimer = setTimeout(() => { if (!chromeHover) chrome.classList.remove('is-shown'); }, ms);
    };

    /* ---- Events ------------------------------------------------------------ */
    const nextLevel = () => (still ? stepStill(1) : seekTo(Math.floor(Math.max(0, depth) + 1e-3) + 1, STEP_TIME));
    const previousLevel = () => (still ? stepStill(-1) : seekTo(Math.max(START, Math.ceil(depth - 1e-3) - 1), STEP_TIME));
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup);
    on(returnButton, 'click', () => close());
    on(soundButton, 'click', () => setSound(!soundOn));
    on(nextButton, 'click', nextLevel);
    on(backButton, 'click', previousLevel);
    on(window, 'pagehide', cleanup);
    on(window, 'resize', () => {
      // The live page reflows: its square no longer holds. Out at once while it shows.
      if (liveShown) { cleanup(); return; }
      vw = innerWidth; vh = innerHeight; sizeCanvas(); schedule();
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
      depth = Math.max(START, depth + dd);
      if (depth >= M) { depth -= M; loops++; }
      drag.v = 0.7 * drag.v + 0.3 * (dd / Math.max(1e-3, (now - drag.t) / 1000));
      drag.y = event.clientY; drag.t = now; movedIn = true;
      schedule();
    });
    const release = event => {
      if (!drag || event.pointerId !== drag.id) return;
      speed = clamp(drag.v, -MAX_SPEED, MAX_SPEED);
      drag = null;
    };
    on(dialog, 'pointerup', release);
    on(dialog, 'pointercancel', release);
    on(dialog, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const k = event.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'ArrowRight') { event.preventDefault(); nextLevel(); }
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'ArrowLeft') { event.preventDefault(); previousLevel(); }
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
      get start() { return START; },
      get levels() { return N; },
      get loops() { return loops; },
      get still() { return still; },
      get live() { return liveShown; },
      get sound() { return soundOn; },
      get frameStats() { return stats; },
      get loaded() { return images.map(r => (r.large ? 'l' : r.small ? 's' : '-')).join(''); },
      label: () => ({ date: labelDate.textContent, message: labelText.textContent }),
      setDepth(value) { seek = null; speed = 0; depth = Math.max(START, value); if (depth >= M) { depth -= M; loops++; } movedIn = true; schedule(); },
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
        const begin = () => { if (closed) return; phase = 'falling'; showStill(1); };
        if (ready(1)) begin(); else { const wait = setInterval(() => { if (ready(1) || closed) { clearInterval(wait); begin(); } }, 50); }
      } else {
        body.style.setProperty('will-change', 'transform');
        phase = 'falling';
        lastNow = 0;
        schedule();
      }
    } catch (error) { cleanup(); throw error; }
    return true;
  }

  /* ---------------------------------------------------------------------------
   * Sound: a Shepard chord. Each voice is nine sines an octave apart under one bell-shaped
   * spectral envelope (in log frequency); as the phase falls, every partial glides down, the
   * low ones fade out and new high ones fade in, so the chord falls without end.
   * ------------------------------------------------------------------------- */
  function createGalleryAudio(context, options = {}) {
    const offline = typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext;
    const rate = context.sampleRate;
    let enabled = true; let closed = false;
    const audio = { context, scheduled: 0 };
    const out = context.createDynamicsCompressor(); out.threshold.value = -16; out.ratio.value = 3; out.connect(context.destination);
    const master = context.createGain(); master.connect(out);
    const t0 = context.currentTime;
    if (options.fadeIn === false) master.gain.value = SHEPARD.master;
    else { master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(SHEPARD.master, t0 + SHEPARD.fadeIn); }
    const tone = context.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = SHEPARD.cutoff; tone.Q.value = 0.3;
    tone.connect(master);
    // A short, soft room: stereo noise decaying over 2.2 s.
    const convolver = context.createConvolver(); convolver.connect(master);
    const send = context.createGain(); send.gain.value = 0.28; send.connect(convolver);
    tone.connect(send);
    {
      const length = Math.round(2.2 * rate); const ir = context.createBuffer(2, length, rate); let s = 7;
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch); let low = 0;
        for (let i = 0; i < length; i++) { s = (s * 1664525 + 1013904223) >>> 0; low += 0.45 * ((s / 4294967296) * 2 - 1 - low); data[i] = low * Math.exp(-i / (rate * 0.32)); }
      }
      convolver.buffer = ir;
    }
    const level = context.createGain(); level.gain.value = options.fadeIn === false ? 1 : 0; level.connect(tone);
    const partials = [];
    for (const [offset, weight] of SHEPARD.voices) {
      for (let n = 0; n < SHEPARD.octaves; n++) {
        const o = context.createOscillator(); o.type = 'sine';
        const g = context.createGain(); g.gain.value = 0;
        o.connect(g); g.connect(level); o.start(t0);
        partials.push({ o, g, n, offset, weight, x: -1 });
      }
    }
    const envelope = x => Math.exp(-0.5 * Math.pow((x - SHEPARD.centre) / SHEPARD.width, 2));
    const OCT = SHEPARD.octaves;
    // Each partial sweeps the whole range and comes round only at its ends, where the envelope
    // has silenced it (there it jumps, rather than gliding through the range).
    function tune(phase, t, glide) {
      for (const p of partials) {
        const x = (((p.n + phase + p.offset) % OCT) + OCT) % OCT;   // octaves above base
        const f = SHEPARD.base * Math.pow(2, x); const g = SHEPARD.gain * p.weight * envelope(x);
        if (p.x < 0 || Math.abs(x - p.x) > OCT / 2) {
          p.o.frequency.cancelScheduledValues(t); p.o.frequency.setValueAtTime(f, t);
          p.g.gain.cancelScheduledValues(t); p.g.gain.setValueAtTime(g, t);
        } else {
          p.o.frequency.setTargetAtTime(f, t, glide);
          p.g.gain.setTargetAtTime(g, t, glide);
        }
        p.x = x;
      }
    }
    tune(0, t0, 0.001);
    let lastPhase = 0;
    const ready = () => enabled && !closed && (offline || context.state === 'running');
    const ramp = (value, seconds) => { const p = master.gain; const t = context.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(value, t + seconds); };
    function bell(m, t, g) {
      [[1, 1, 2.4], [2, 0.3, 1.4], [2.76, 0.16, 1.0]].forEach(([ratio, share, decay]) => {
        const o = context.createOscillator(); o.type = 'sine'; o.frequency.value = midiHz(m) * ratio;
        const amp = context.createGain();
        amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(g * share, t + 0.006);
        amp.gain.exponentialRampToValueAtTime(g * share * 1e-3, t + decay);
        o.connect(amp); amp.connect(tone); o.start(t); o.stop(t + decay + 0.05); audio.scheduled++;
      });
    }
    Object.assign(audio, {
      get ready() { return ready(); },
      // The chord at depth d (unwrapped; falling half an octave a level), at presence 0..1.
      fall(d, presence = 1, t = context.currentTime) {
        if (closed) return;
        const phase = -d * SHEPARD.perLevel;
        // A jump (a seek, a still step) glides; the fall itself follows closely.
        const glide = Math.abs(phase - lastPhase) > 0.25 ? 0.25 : SHEPARD.glide;
        lastPhase = phase;
        tune(phase, t, glide);
        level.gain.setTargetAtTime(presence, t, 0.4);
      },
      chord(t = context.currentTime) { if (ready()) LOOP_CHORD.forEach((m, i) => bell(m, t + i * 0.14, 0.05 * (1 - i * 0.1))); },
      setEnabled(value) {
        if (closed || enabled === value) return;
        enabled = value;
        if (enabled && !offline && context.state === 'suspended') context.resume().catch(() => {});
        ramp(enabled ? SHEPARD.master : 0, 0.25);
      },
      suspend() { if (!offline && context.state === 'running') context.suspend().catch(() => {}); },
      resume() { if (!offline && enabled && context.state === 'suspended') context.resume().catch(() => {}); },
      close() {
        if (closed) return;
        closed = true;
        if (offline) return;
        ramp(0, 0.5);
        setTimeout(() => { try { context.close().catch(() => {}); } catch (error) { /* closed */ } }, 700);
      }
    });
    return audio;
  }

  window.SiteGallery = { open, get active() { return active; }, createAudio: (context, options) => createGalleryAudio(context, options) };
})();
