/**
 * Lens V · Lamplight: "Read by the light you carry."
 *
 * The page falls into a warm dark, except for a circle of lamplight that follows the pointer
 * (or the finger, or keyboard focus). Under the lamp the page keeps its own colours, a little
 * warmed; out in the dark the links glow faintly, like embers, so they can still be found.
 *
 * Drawing: one fixed layer from the core. The lamp is a translated wrapper (compositor-only
 * movement) holding the night, a solid #0b0806 sheet with a radial-gradient mask centred on
 * the lamp, and the glow, a warm tint whose backdrop-filter warms the page under the light
 * (sepia 0.2 there; a filter on the scope itself would trap the links below the night). A
 * static grain sheet lies over the night. The candle flicker is a CSS animation (scale and
 * alpha, at most 1.5 %), so no frame runs while the lamp rests.
 *
 * Links are lifted above the night by html.lens-lamplight (position and z-index) and coloured
 * by two inline custom properties: --ll-link (their own colour, read on entry) and --ll-near
 * (0 in the dark, 1 under the lamp). Exit restores every link's style attribute exactly.
 */
(() => {
  'use strict';
  if (!window.SiteLenses) return;

  /* Constants ---------------------------------------------------------------- */
  const RADIUS = 230;                  // px: the lamp's reach on a wide screen ...
  const RADIUS_MIN = 160;              // ... and at least this on a phone,
  const RADIUS_VW = 0.5;               // ... where it is half the viewport width
  const GLOW_SCALE = 1.1;              // the warm glow reaches a little past the lamp
  const SMOOTH_TAU = 0.08;             // s: the lamp eases after the pointer (exponential)
  const SETTLE_PX = 0.25;              // closer than this, the lamp is where it should be
  const DUSK_S = 0.8;                  // dusk closes in from the edges
  const DUSK_FAR = 3;                  // the dusk starts with its reach this many times the farthest corner's distance
  const LIFT_S = 0.5;                  // the dark lifts
  const LIFT_GROW = 1.8;               // the light widens this much while the dark lifts
  const ARRIVE_S = 0.3;                // on a page opened with the lens: the lamp's warmth comes up
  // Links whose content is a picture are lit by the lamp like the page, not lifted as embers.
  const PICTURE_LINK = 'img, picture, video, canvas';
  const NIGHT_PAD = 48;                // px of extra night beyond the viewport (flicker, rounding)
  const LAYER_Z = 1001;                // above the back-to-top button (999) and the skip link (1000)
  const GRAIN_SIZE = 128;              // px: one tile of paper grain, generated once
  const GRAIN_DENSITY = 0.16;          // share of grain pixels that carry a fleck
  const GRAIN_ALPHA = [0.012, 0.055];  // a fleck's alpha range: very faint
  const NEAR_STEPS = 64;               // --ll-near is written in 1/64 steps, from a table
  const EMBER_BAND = [0.35, 0.8];      // a link turns from its own colour to an ember across this band of light
  // The dark's profile from the lamp's centre (u = 0) to its reach (u = 1), as mask alpha.
  // The CSS mask and the links' ember blend both read it, so they always agree.
  const PROFILE_U = [0, 0.22, 0.42, 0.58, 0.74, 0.88, 1];
  const PROFILE_A = [0, 0.03, 0.17, 0.4, 0.68, 0.9, 1];

  const html = document.documentElement;
  const NEAR_TEXT = Array.from({ length: NEAR_STEPS + 1 }, (_, k) => String(+(k / NEAR_STEPS).toFixed(4)));
  let grainUrl = '';

  /* Helpers ------------------------------------------------------------------ */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeInOut = t => (1 - Math.cos(Math.PI * t)) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  // Darkness at u = distance / reach (piecewise linear over the profile; 1 beyond the reach).
  function darkness(u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let k = 1;
    while (PROFILE_U[k] < u) k++;
    const t = (u - PROFILE_U[k - 1]) / (PROFILE_U[k] - PROFILE_U[k - 1]);
    return PROFILE_A[k - 1] + (PROFILE_A[k] - PROFILE_A[k - 1]) * t;
  }
  const maskGradient = () => `radial-gradient(circle var(--ll-r) at 50% 50%, ${PROFILE_U.map((u, i) => `rgba(0,0,0,${PROFILE_A[i]}) ${u * 100}%`).join(', ')})`;

  // Paper grain: sparse warm flecks on transparency, visible on the dark only.
  function makeGrain() {
    if (grainUrl) return grainUrl;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = GRAIN_SIZE;
      const g = canvas.getContext('2d');
      const image = g.createImageData(GRAIN_SIZE, GRAIN_SIZE);
      const data = image.data;
      let seed = 1692;
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < data.length; i += 4) {
        if (random() > GRAIN_DENSITY) continue;
        data[i] = 255; data[i + 1] = 228 + Math.round(random() * 20); data[i + 2] = 196 + Math.round(random() * 30);
        data[i + 3] = Math.round(255 * (GRAIN_ALPHA[0] + random() * (GRAIN_ALPHA[1] - GRAIN_ALPHA[0])));
      }
      g.putImageData(image, 0, 0);
      grainUrl = canvas.toDataURL('image/png');
    } catch (error) {
      grainUrl = 'none';
    }
    return grainUrl;
  }

  /* The lens ------------------------------------------------------------------ */
  let state = null;                    // one activation at a time

  function element(className, parent) {
    const el = document.createElement('div');
    el.className = className;
    parent.append(el);
    return el;
  }

  // The links the lamp lifts: every text link in the scope, with its own style attribute kept.
  const liftable = el => !el.querySelector(PICTURE_LINK);
  const linkEntry = el => ({ el, style: el.getAttribute('style'), near: -1, x0: 0, y0: 0, x1: 0, y1: 0, shown: false });
  function collectLinks(scope) {
    const links = [];
    scope.forEach(root => root.querySelectorAll('a[href]').forEach(el => { if (liftable(el)) links.push(linkEntry(el)); }));
    return links;
  }

  // Late content (markdown, star counts, demos): new links join, removed ones are dropped.
  function refreshLinks(s, scope) {
    const known = new Set(s.links.map(link => link.el));
    const added = [];
    scope.forEach(root => root.querySelectorAll('a[href]').forEach(el => {
      if (!known.has(el) && liftable(el)) { const link = linkEntry(el); s.links.push(link); added.push(link); }
    }));
    const kept = s.links.filter(link => link.el.isConnected);
    if (kept.length !== s.links.length) s.links = kept;
    if (added.length) readLinkColours(s, added);
    s.measured = false; s.dirtyLinks = true;
  }

  // Each link's own colour, read with the lens class off (so it is the page's colour) and
  // without transitions (the site eases link colours, which would return a midway colour).
  function readLinkColours(s, links = s.links) {
    const had = html.classList.contains('lens-lamplight');
    html.classList.add('lens-lamplight-measure');
    if (had) html.classList.remove('lens-lamplight');
    // A link drawn as a button (a background or a border) keeps them under the lamp; in the
    // dark only an ember outline is left.
    const looks = links.map(link => {
      const cs = getComputedStyle(link.el);
      const bordered = ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none');
      return { color: cs.color, bg: /^rgba\(.*,\s*0\)$|^transparent$/.test(cs.backgroundColor) ? '' : cs.backgroundColor, border: bordered ? cs.borderTopColor : '' };
    });
    if (had) html.classList.add('lens-lamplight');
    html.classList.remove('lens-lamplight-measure');
    links.forEach((link, i) => {
      const look = looks[i];
      link.el.style.setProperty('--ll-link', look.color);
      if (look.bg) link.el.style.setProperty('--ll-bg', look.bg);
      if (look.border) link.el.style.setProperty('--ll-bd', look.border);
    });
  }

  // Link boxes in document coordinates (refreshed on resize and reflow, not per frame).
  function measureLinks(s) {
    const sx = window.scrollX; const sy = window.scrollY;
    for (const link of s.links) {
      const r = link.el.getBoundingClientRect();
      link.shown = r.width > 0 && r.height > 0;
      link.x0 = r.left + sx; link.y0 = r.top + sy; link.x1 = r.right + sx; link.y1 = r.bottom + sy;
    }
    s.measured = true;
  }

  // --ll-near per link from its distance to the lamp: 1 under the light, 0 in the dark.
  function updateLinks(s) {
    if (!s.measured) measureLinks(s);
    const sx = window.scrollX; const sy = window.scrollY;
    const lx = s.x + sx; const ly = s.y + sy;
    const reach = s.r; const night = s.night;
    for (let i = 0; i < s.links.length; i++) {
      const link = s.links[i];
      let near = 1;
      if (link.shown) {
        const dx = lx < link.x0 ? link.x0 - lx : lx > link.x1 ? lx - link.x1 : 0;
        const dy = ly < link.y0 ? link.y0 - ly : ly > link.y1 ? ly - link.y1 : 0;
        const light = 1 - darkness(Math.sqrt(dx * dx + dy * dy) / reach) * night;
        // A quick turn between lit and ember, so few links sit in a muddy blend.
        const t = clamp((light - EMBER_BAND[0]) / (EMBER_BAND[1] - EMBER_BAND[0]), 0, 1);
        near = t * t * (3 - 2 * t);
      }
      const step = Math.round(near * NEAR_STEPS);
      if (step !== link.near) { link.near = step; link.el.style.setProperty('--ll-near', NEAR_TEXT[step]); }
    }
  }

  function viewport(s) {
    s.w = document.documentElement.clientWidth || window.innerWidth;
    s.h = window.innerHeight;
    s.base = clamp(Math.round(s.w * RADIUS_VW), RADIUS_MIN, RADIUS);
    s.layer.style.setProperty('--ll-w', `${s.w + NIGHT_PAD}px`);
    s.layer.style.setProperty('--ll-h', `${s.h + NIGHT_PAD}px`);
    s.layer.style.setProperty('--ll-gr', `${Math.round(s.base * GLOW_SCALE)}px`);
  }

  // Writes the lamp's state to the layer's custom properties (only what changed).
  function apply(s) {
    const { layer } = s;
    if (s.x !== s.shownX || s.y !== s.shownY) {
      layer.style.setProperty('--ll-x', `${s.x.toFixed(1)}px`);
      layer.style.setProperty('--ll-y', `${s.y.toFixed(1)}px`);
      s.shownX = s.x; s.shownY = s.y; s.dirtyLinks = true;
    }
    if (s.r !== s.shownR) { layer.style.setProperty('--ll-r', `${s.r.toFixed(1)}px`); s.shownR = s.r; s.dirtyLinks = true; }
    if (s.night !== s.shownNight) { layer.style.setProperty('--ll-o', s.night.toFixed(3)); s.shownNight = s.night; s.dirtyLinks = true; }
    if (s.glow !== s.shownGlow) { layer.style.setProperty('--ll-g', s.glow.toFixed(3)); s.shownGlow = s.glow; }
    if (s.dirtyLinks) { s.dirtyLinks = false; updateLinks(s); }
  }

  // The farthest viewport corner from the lamp, for the dusk's starting reach.
  const farthest = s => Math.hypot(Math.max(s.x, s.w - s.x), Math.max(s.y, s.h - s.y));

  // One frame: the dusk or lift animation, the lamp easing after its target. Returns false
  // when nothing moves, so the shared loop can stop.
  function tick(s, dt) {
    let moving = false;
    const anim = s.anim;
    if (anim) {
      anim.t = s.quick() ? 1 : Math.min(1, anim.t + dt / anim.duration);
      anim.step(anim.t);
      if (anim.t >= 1) { s.anim = null; anim.done(); } else moving = true;
    }
    if (s.quick()) { s.x = s.tx; s.y = s.ty; }
    else {
      const k = 1 - Math.exp(-dt / SMOOTH_TAU);
      s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
      if (Math.abs(s.tx - s.x) < SETTLE_PX && Math.abs(s.ty - s.y) < SETTLE_PX) { s.x = s.tx; s.y = s.ty; }
      else moving = true;
    }
    apply(s);
    return moving ? undefined : false;
  }

  // Plays an animation over `duration` s; resolves at its end (at once under reduced motion).
  function animate(s, duration, step) {
    return new Promise(resolve => {
      if (s.anim) s.anim.done();
      s.anim = { t: 0, duration, step, done: resolve };
      if (s.quick()) { s.anim = null; step(1); apply(s); resolve(); return; }
      s.wake();
    });
  }

  function aim(s, x, y) {
    s.tx = clamp(x, 0, s.w); s.ty = clamp(y, 0, s.h);
    s.wake();
  }

  // Where the lamp starts: at the pointer, else on the page's name or title when it is in
  // view (the homepage name, a page title, a paper's title), else a little above the centre.
  function startPoint(ctx, s) {
    const known = ctx.pointer;
    if (known) return known;
    for (const el of document.querySelectorAll('.profile-text .name, #main-content [data-lens-trigger], #main-content h1')) {
      const range = document.createRange(); range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < s.h) return { x: r.left + Math.min(r.width, 320) / 2, y: r.top + Math.min(r.height, 80) / 2 };
    }
    return { x: s.w / 2, y: s.h * 0.4 };
  }

  function listen(ctx, s) {
    const { signal } = ctx;
    const options = { passive: true, signal };
    // Mouse and pen move the lamp; a touch puts it under the finger and it stays when lifted.
    document.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') aim(s, event.clientX, event.clientY); }, options);
    document.addEventListener('pointerdown', event => aim(s, event.clientX, event.clientY), options);
    const touch = event => { const t = event.touches[0]; if (t) aim(s, t.clientX, t.clientY); };
    document.addEventListener('touchstart', touch, options);
    document.addEventListener('touchmove', touch, options);
    // Keyboard focus carries the lamp to the focused element.
    document.addEventListener('focusin', event => {
      const target = event.target;
      if (!(target instanceof Element) || !target.matches(':focus-visible')) return;
      const r = target.getBoundingClientRect();
      aim(s, r.left + r.width / 2, r.top + r.height / 2);
    }, { signal });
    // The lamp stays in the viewport; links move under it when the page scrolls.
    window.addEventListener('scroll', () => { s.dirtyLinks = true; s.wake(); }, options);
    window.addEventListener('resize', () => {
      viewport(s); s.measured = false; s.dirtyLinks = true;
      if (!s.anim) s.r = s.base;
      aim(s, s.tx, s.ty);
    }, options);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => { s.measured = false; s.dirtyLinks = true; s.wake(); });
      ctx.scope.forEach(root => observer.observe(root));
      signal.addEventListener('abort', () => observer.disconnect());
    }
    ctx.onContentChange(() => { refreshLinks(s, ctx.scope); s.wake(); });
    // A theme switch changes the links' own colours.
    const themes = new MutationObserver(() => { readLinkColours(s); s.dirtyLinks = true; s.wake(); });
    themes.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    signal.addEventListener('abort', () => themes.disconnect());
    ctx.motion.addEventListener('change', () => {
      s.still = ctx.motion.matches;
      html.classList.toggle('lens-lamplight-still', s.still);
      s.wake();
    }, { signal });
  }

  function restore(s) {
    if (s.restored) return;
    s.restored = true;
    s.anim = null;
    for (const link of s.links) {
      // Read first: Chrome syncs CSSOM writes into the attribute lazily, and removing it
      // unsynced would leave style="" in the markup.
      link.el.getAttribute('style');
      if (link.style === null) link.el.removeAttribute('style');
      else link.el.setAttribute('style', link.style);
    }
    html.classList.remove('lens-lamplight', 'lens-lamplight-still', 'lens-lamplight-measure');
  }

  // The lamp's state, layer, links and listeners, shared by enter and arrive.
  function build(ctx) {
    const s = {
      layer: ctx.layer('fixed'), links: collectLinks(ctx.scope), still: ctx.motion.matches,
      x: 0, y: 0, tx: 0, ty: 0, r: RADIUS, base: RADIUS, night: 1, glow: 1, w: 0, h: 0,
      shownX: NaN, shownY: NaN, shownR: NaN, shownNight: NaN, shownGlow: NaN,
      anim: null, measured: false, dirtyLinks: true, restored: false, wake: null,
      quick: () => s.still || ctx.instant      // no animation: reduced motion, or an instant reset
    };
    state = s;
    const frame = dt => tick(s, dt);
    s.wake = () => ctx.frame(frame);

    // The lamp (glow under night), then the grain.
    const { layer } = s;
    layer.classList.add('lamplight-layer');
    layer.style.zIndex = String(LAYER_Z);
    layer.style.setProperty('--ll-mask', maskGradient());
    layer.style.setProperty('--ll-grain', `url("${makeGrain()}")`);
    const lamp = element('lamplight-lamp', layer);
    element('lamplight-glow', element('lamplight-flame', lamp));
    element('lamplight-night', element('lamplight-flicker', lamp));
    element('lamplight-grain', layer);
    viewport(s);

    measureLinks(s);                     // while layout is clean, so no frame has to force it
    readLinkColours(s);
    html.classList.add('lens-lamplight');
    html.classList.toggle('lens-lamplight-still', s.still);
    const start = startPoint(ctx, s);
    s.x = s.tx = clamp(start.x, 0, s.w); s.y = s.ty = clamp(start.y, 0, s.h);
    listen(ctx, s);
    // An interrupted entrance ends where it is; exit takes it from there.
    ctx.signal.addEventListener('abort', () => { if (s.anim) { const a = s.anim; s.anim = null; a.done(); } }, { once: true });
    return s;
  }

  window.SiteLenses.register({
    id: 'lamplight',
    order: 5,
    numeral: 'V',
    label: 'Lamplight',
    line: 'Read by the light you carry.',
    css: true,

    // Dusk: the dark closes in from the edges until only the lamp is left.
    async enter(ctx) {
      const s = build(ctx);
      const from = Math.max(s.base, farthest(s) * DUSK_FAR);
      const logFrom = Math.log(from); const logTo = Math.log(s.base);
      s.r = from; s.glow = 0; s.night = 1;
      apply(s);
      await animate(s, DUSK_S, t => {
        const e = easeInOut(t);
        s.r = Math.exp(logFrom + (logTo - logFrom) * e);
        s.glow = e;
      });
    },

    // A page opened in lamplight: the dark is already there (the pre-paint ground), so the
    // lamp is lit at once and only its warmth comes up.
    async arrive(ctx) {
      const s = build(ctx);
      s.r = s.base; s.glow = 0; s.night = 1;
      apply(s);
      await animate(s, ARRIVE_S, t => { s.glow = easeOut(t); });
    },

    async exit(ctx) {
      const s = state;
      if (!s) return;
      s.still = ctx.motion.matches;
      if (!s.quick()) {
        // The dark lifts: it fades while the light widens.
        const r0 = s.r; const night0 = s.night; const glow0 = s.glow;
        await animate(s, LIFT_S, t => {
          const e = easeOut(t);
          s.r = r0 * (1 + (LIFT_GROW - 1) * e);
          s.night = night0 * (1 - e);
          s.glow = glow0 * (1 - e);
        });
      }
      restore(s);
      if (state === s) state = null;
    }
  });
})();
