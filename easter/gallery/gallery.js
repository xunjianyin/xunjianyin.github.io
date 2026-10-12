/**
 * Print Gallery. Look into the eye in the homepage photo: in its pupil is the page as it was
 * one version before; in the eye of that page's photo, the version before it; and so on, back
 * through every version of the site that looked different, to the first, whose eye holds the
 * page you are on. After Escher's Print Gallery (1956) and the Droste effect.
 *
 * At each version the camera rests on the page as it was, the photo as it was (its wall label:
 * date, how far back, the commit's own words). Then it turns to the face and dives into the
 * viewer's left eye: past the photo's own sharpness the picture goes out of focus and dark, as
 * a lens would, the pupil opens as an eye's does in the dark, and the earlier page brightens in
 * it until it fills the screen. Round the cycle without end, until Return.
 *
 * Depth d: 0 is the live page, 1..N the prints (1 the newest), at N + 1 the live page again
 * (in the first version's eye); the depth wraps there. At an integer the level fits the
 * viewport. Between k and k + 1 (u, sine-eased, so each dive starts and ends at rest) the scale
 * grows exponentially to the one that fits the next level, and the eye glides to the centre
 * over the first 60 %.
 *
 * Each portrait is drawn from its full-resolution file over the photo's box (the page's own
 * pixels stop being enough at once); defocus is a blend of smaller copies (mip levels), so it is
 * cheap and smooth. The live page is the real DOM: the body carries the CSS transform that
 * puts it where the camera wants it (until its photo covers the screen), and inside the first
 * version's eye the canvas leaves a hole for it; the dialog is in the top layer, so the
 * transform never moves it. Closing restores the body's style exactly.
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
  const FIRST_REST = 1.6;              // s: the camera rests on the live page first
  const TRAVEL = 4.0;                  // s: one dive, version to version
  const REST = 1.2;                    // s: the rest at each version
  const PAN_END = 0.6;                 // the eye reaches the centre at this share of a dive
  const PUPIL = [0.42, 0.92];          // the pupil's radius, in iris radii, at rest and opened
  const DILATE = [0.45, 0.9];          // the pupil opens over this part of a dive ...
  const LIGHT = [0.35, 0.85];          // ... and the earlier page brightens in it over this part
  const DEFOCUS_FROM = 2.0;            // a picture blurs once magnified past this x its file's pixels ...
  const DARK = [4, 24, 0.92];          // ... and darkens from 4x to 24x, to 92 %
  const PUPIL_COLOUR = 'rgb(10, 10, 12)';
  const IDLE = 1.4;                    // s after the reader's last push, the camera's own dives resume
  const WHEEL_GAIN = 0.003;            // levels per second per wheel pixel
  const DECAY = 0.45;                  // s: a push from the wheel or a drag dies away
  const MAX_SPEED = 5;                 // levels per second
  const DRAG_LEVELS = 0.8;             // levels per viewport height dragged
  const STEP_TIME = 2.0;               // s: the arrows move one version
  const HOME_TIME = [1.2, 0.08];       // s: Return rushes home in a + b per level
  const CAPTION_FADE = [0.04, 0.16];   // a level's label fades as the camera leaves it
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
  // A dive's pace: at rest at both ends, never more than pi / 2 times its mean speed.
  const easeSine = u => (1 - Math.cos(Math.PI * clamp(u, 0, 1))) / 2;
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  // A similarity x -> a x + b (a scalar scale, b a point).
  const sim = (a, bx, by) => ({ a, bx, by });
  const compose = (S, M) => sim(S.a * M.a, S.a * M.bx + S.bx, S.a * M.by + S.by);   // S after M
  const apply = (S, x, y) => [S.a * x + S.bx, S.a * y + S.by];

  // Smaller and smaller copies of an image, for defocus: level n is 1 / 2^n of the first.
  function mipsOf(image, smallest = 16) {
    const levels = [image];
    let w = image.naturalWidth || image.width; let h = image.naturalHeight || image.height;
    let source = image;
    while (Math.min(w, h) / 2 >= smallest) {
      w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      g.drawImage(source, 0, 0, w, h);
      levels.push(c); source = c;
    }
    return levels;
  }

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
   * Opens the gallery. Options: photo (the live page's photo; default the homepage photo),
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
      if (!manifest.prints || !manifest.prints.length || !manifest.portraits) throw new Error('No prints.');
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
    const dark = (() => {
      const c = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(getComputedStyle(body).backgroundColor) || [0, 255, 255, 255];
      return (0.299 * c[1] + 0.587 * c[2] + 0.114 * c[3]) < 128;
    })();

    /* ---- Geometry ---------------------------------------------------------- */
    // A print's units: width 1, height 1 / PRINT_ASPECT. The live page's: CSS px of the viewport.
    let vw = innerWidth; let vh = innerHeight;
    const bodyOrigin = (() => { const b = body.getBoundingClientRect(); return { x: b.left, y: b.top }; })();
    const liveBox = (() => {
      const b = photo.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(photo).borderTopWidth) || 0;
      return { x: b.left + border, y: b.top + border, w: b.width - 2 * border, h: b.height - 2 * border, round: false };
    })();
    const index = i => ((i % M) + M) % M;
    const isLive = j => j === 0;
    const widthOf = j => (isLive(j) ? vw : 1);
    const heightOf = j => (isLive(j) ? vh : 1 / PRINT_ASPECT);
    const boxOf = j => {
      if (isLive(j)) return liveBox;
      const p = prints[j - 1].portal; const h = 1 / PRINT_ASPECT;
      return { x: p[0], y: p[1] * h, w: p[2], h: p[3] * h, round: prints[j - 1].round };
    };
    const portraitKey = j => (isLive(j) ? manifest.live.portrait : prints[j - 1].portrait);
    // The eye, in the level's units: its centre and the iris's radius.
    const eyeOf = j => {
      const box = boxOf(j); const p = manifest.portraits[portraitKey(j)];
      return { x: box.x + p.eye[0] * box.w, y: box.y + p.eye[1] * box.h, r: p.iris * box.w };
    };
    // Where the next level sits in level j's pupil, opened to `open` iris radii: inscribed in the
    // pupil's circle; a similarity from its units to j's.
    function placeIn(j, open) {
      const e = eyeOf(j); const next = index(j + 1);
      const a = widthOf(next) / heightOf(next);
      const R = open * e.r;
      const w = 2 * R / Math.sqrt(1 + 1 / (a * a)); const h = w / a;
      return sim(w / widthOf(next), e.x - w / 2, e.y - h / 2);
    }
    function fitOf(j) {
      if (isLive(j)) return sim(1, 0, 0);
      const a = Math.min(vw, vh * PRINT_ASPECT);
      return sim(a, (vw - a) / 2, (vh - a / PRINT_ASPECT) / 2);
    }
    // The camera at depth d: level k, its similarity, and the dive's eased progress u.
    function camera(d) {
      const k = Math.floor(d); const j = index(k);
      const u = easeSine(d - k);
      const S0 = fitOf(j);
      const F1 = fitOf(index(k + 1)); const m = placeIn(j, PUPIL[1]);
      const a1 = F1.a / m.a;
      const e = eyeOf(j);
      const [ex, ey] = apply(S0, e.x, e.y);
      const a = S0.a * Math.pow(a1 / S0.a, u);
      const g = smooth(0, PAN_END, u);
      // The end framing puts the eye exactly where the fitted next level's centre is.
      const [cx, cy] = apply(F1, widthOf(index(k + 1)) / 2, heightOf(index(k + 1)) / 2);
      const px = ex + (cx - ex) * g; const py = ey + (cy - ey) * g;
      return { k, u, S: sim(a, px - a * e.x, py - a * e.y) };
    }

    /* ---- Images ------------------------------------------------------------ */
    const images = prints.map(p => ({ small: null, large: null, mips: null, smallLoading: false, largeLoading: false, file: p.file }));
    function loadImage(j, size) {
      const record = images[j - 1];
      const key = size === 'large' ? 'largeLoading' : 'smallLoading';
      if (record[size] || record[key]) return;
      record[key] = true;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const done = () => { record[size] = img; record[key] = false; record[size === 'small' ? 'smallMips' : 'largeMips'] = mipsOf(img, 32); };
        if (img.decode) img.decode().then(done, done); else done();
      };
      img.onerror = () => { record[key] = false; };
      img.src = new URL(`${record.file}-${size === 'large' ? 'l' : 's'}.webp`, BASE).href;
    }
    for (let j = 1; j <= N; j++) loadImage(j, 'small');
    function feedImages(d) {
      const k = Math.floor(d);
      const near = new Set([-1, 0, 1, 2].map(n => index(k + n)));
      images.forEach((record, i) => { if (near.has(i + 1)) loadImage(i + 1, 'large'); else if (record.large) { record.large = null; record.largeMips = null; } });
    }
    const portraits = {};
    for (const key of Object.keys(manifest.portraits)) {
      portraits[key] = { mips: null };
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { const done = () => { portraits[key].mips = mipsOf(img); }; if (img.decode) img.decode().then(done, done); else done(); };
      img.src = new URL(`portrait-${key}.webp`, BASE).href;
    }
    const ready = j => (isLive(j) || !!images[j - 1].small) && !!portraits[portraitKey(j)].mips;

    /* ---- DOM ------------------------------------------------------------- */
    const dialog = document.createElement('dialog');
    dialog.id = 'gallery';
    dialog.tabIndex = -1;
    dialog.autofocus = true;
    dialog.setAttribute('aria-label', 'Print Gallery: every earlier version of this page, each in the eye of the next');
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
    let restUntil = still ? Infinity : FIRST_REST;
    let raf = 0; let lastNow = 0; let clock = 0;
    let closed = false; let leaving = false; let movedIn = false;
    let phase = 'falling';
    let drag = null;
    let liveShown = 'page';                // where the DOM is drawn: 'page' (the outer level), 'inside' (in an eye) or null
    const fixedSpeed = Number.isFinite(options.speed) ? options.speed : null;
    const auto = options.auto !== false;
    const stats = { frames: 0, avgMs: 0, maxMs: 0 };

    function placeBody(S) {
      if (!S) { body.style.setProperty('transform', 'translate(-200vw, 0) scale(0.01)'); return; }
      // S maps viewport px of the live page to the screen.
      body.style.setProperty('transform', `translate(${S.bx - bodyOrigin.x * (1 - S.a)}px, ${S.by - bodyOrigin.y * (1 - S.a)}px) scale(${S.a})`);
    }

    /* ---- Drawing ----------------------------------------------------------- */
    // An image (its mip levels) into a rect on screen, out of focus past its own sharpness.
    function drawMips(mips, x, y, w, h, alpha = 1) {
      if (!mips || w < 0.5 || x > vw || y > vh || x + w < 0 || y + h < 0) return;
      const full = mips[0].naturalWidth || mips[0].width;
      const level = clamp(Math.log2((w * dpr) / full / DEFOCUS_FROM), 0, mips.length - 1);
      const lo = Math.floor(level); const hi = Math.min(mips.length - 1, lo + 1); const f = level - lo;
      ctx.globalAlpha = alpha;
      ctx.drawImage(mips[lo], x, y, w, h);
      if (f > 0.01 && hi !== lo) { ctx.globalAlpha = alpha * f; ctx.drawImage(mips[hi], x, y, w, h); }
      ctx.globalAlpha = 1;
    }
    // A print's page: the large file when sharp enough, its smaller copies when out of focus.
    function drawPage(j, S, alpha = 1) {
      const record = images[j - 1];
      const w = S.a; const h = w / PRINT_ASPECT;
      if (S.bx > vw || S.by > vh || S.bx + w < 0 || S.by + h < 0) return;
      if (record.large && w * dpr <= record.large.naturalWidth * DEFOCUS_FROM) {
        ctx.globalAlpha = alpha; ctx.drawImage(record.large, S.bx, S.by, w, h); ctx.globalAlpha = 1;
      } else if (record.largeMips) {
        drawMips(record.largeMips, S.bx, S.by, w, h, alpha);
      } else if (record.small) {
        drawMips(record.smallMips || [record.small], S.bx, S.by, w, h, alpha);
      }
    }
    // The portrait over the photo's box (round if the photo was).
    function drawPortrait(j, S) {
      const box = boxOf(j); const p = portraits[portraitKey(j)];
      if (!p.mips) return;
      const [x, y] = apply(S, box.x, box.y); const w = S.a * box.w; const h = S.a * box.h;
      if (x > vw || y > vh || x + w < 0 || y + h < 0) return;
      ctx.save();
      ctx.beginPath();
      if (box.round) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(x, y, w, h);
      ctx.clip();
      drawMips(p.mips, x, y, w, h);
      ctx.restore();
    }
    // How much the camera has magnified level j's portrait: screen px per pixel of its file.
    const magnification = (j, S) => {
      const p = portraits[portraitKey(j)];
      const full = p.mips ? (p.mips[0].naturalWidth || p.mips[0].width) : 1000;
      return (S.a * boxOf(j).w * dpr) / full;
    };
    function draw(d) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const { k, u, S } = camera(d);
      const j = index(k); const next = index(k + 1);
      let liveAt = null;
      // The level: the live page (the DOM, until its photo covers the screen) or a print.
      if (isLive(j)) {
        ctx.clearRect(0, 0, vw, vh);
        const [bx, by] = apply(S, liveBox.x, liveBox.y);
        const covered = bx <= 0 && by <= 0 && bx + S.a * liveBox.w >= vw && by + S.a * liveBox.h >= vh;
        if (!covered) liveAt = S;
      } else {
        ctx.fillStyle = PUPIL_COLOUR; ctx.fillRect(0, 0, vw, vh);
        drawPage(j, S);
      }
      drawPortrait(j, S);
      // Past the photo's own sharpness, the dark of the eye closes in.
      const darkness = DARK[2] * smooth(DARK[0], DARK[1], magnification(j, S));
      if (darkness > 0.002) { ctx.globalAlpha = darkness; ctx.fillStyle = PUPIL_COLOUR; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1; }
      // The pupil, opening, and the earlier version in it, brightening.
      const open = PUPIL[0] + (PUPIL[1] - PUPIL[0]) * smooth(DILATE[0], DILATE[1], u);
      const e = eyeOf(j);
      const [ex, ey] = apply(S, e.x, e.y); const R = S.a * open * e.r;
      if (R > 0.6 && ready(next)) {
        ctx.save();
        ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = PUPIL_COLOUR; ctx.fillRect(ex - R, ey - R, 2 * R, 2 * R);
        const C = compose(S, placeIn(j, open));
        const cw = C.a * widthOf(next); const ch = C.a * heightOf(next);
        if (cw > 2) {
          const light = smooth(LIGHT[0], LIGHT[1], u);
          if (isLive(next)) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#000'; ctx.fillRect(C.bx, C.by, cw, ch);
            ctx.globalCompositeOperation = 'source-over';
            liveAt = C;
          } else {
            drawPage(next, C);
            drawPortrait(next, C);
          }
          if (light < 0.999) { ctx.globalAlpha = 1 - light; ctx.fillStyle = PUPIL_COLOUR; ctx.fillRect(C.bx, C.by, cw, ch); ctx.globalAlpha = 1; }
        }
        ctx.restore();
      }
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
          labelText.textContent = 'Look into the eye: every page this one used to be.';
        } else if (isLive(j)) {
          labelDate.textContent = 'Today';
          labelText.textContent = 'The first version was looking at this one.';
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
        const from = depth; const to = Math.floor(depth + 1e-6) + 1;
        if (ready(index(to - 1)) && ready(index(to))) seek = { from, to, start: clock, duration: TRAVEL * (to - from) };
      }
      if (depth < 0 && !leaving) { depth = 0; speed = 0; }
      arrive(before, depth);           // before the wrap, so today at the end of a cycle sounds
      if (depth >= M) { depth -= M; loops++; if (seek) { seek.from -= M; seek.to -= M; } }
    }
    // Crossing an integer (either way) is an arrival: its note.
    function arrive(before, after) {
      if (before === after) return;
      if (after > before && Math.floor(after + 1e-9) > Math.floor(before + 1e-9)) note(index(Math.floor(after + 1e-9)), Math.floor(after + 1e-9));
      else if (after < before && Math.ceil(after - 1e-9) < Math.ceil(before - 1e-9)) note(index(Math.ceil(after - 1e-9)), Math.ceil(after - 1e-9));
    }
    function frame(now) {
      raf = 0;
      if (closed || held) return;
      const began = performance.now();
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now; clock += dt;
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
      get portraitsReady() { return Object.values(portraits).every(p => !!p.mips); },
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
