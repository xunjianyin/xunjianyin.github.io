/**
 * Lenses. Double-click (or double-tap) the name and the homepage is seen through another
 * lens; the content never changes, only how it is drawn:
 *   normal → I Stardust → II Through a model's eyes → III Blueprint → IV Acta Eruditorum, 1692
 *   → V Lamplight → normal → …   Esc returns to normal from any lens.
 *
 * This file is the core: the cycle, the lens contract, the caption, the bell, one shared
 * animation loop, and the bookkeeping that restores the page exactly. Each lens lives in
 * easter/<id>.js (plus easter/<id>.css when it declares css: true) and is loaded the first
 * time it is needed; after a lens has entered, the next one is prefetched.
 *
 * Lens contract:
 *   SiteLenses.register({ id, order, numeral, label, line, css, enter(ctx), exit(ctx), caption(ctx) })
 *   enter(ctx)  builds the lens and plays its entering transition; resolves when settled.
 *   exit(ctx)   plays the leaving transition and restores everything the lens changed.
 *   caption(ctx) optional: the caption's line (a string; text after a '\n', or { line, note },
 *               adds a second line). Returning null before enter() resolves defers the caption.
 *
 * ctx (one per activation):
 *   scope        the elements among #site-nav, #main-content, #site-footer that exist
 *   motion       the reduced-motion query; read ctx.motion.matches live. It also reads true
 *                while an instant reset (the first egg, pagehide) needs the lens gone at once,
 *                so a lens that honours reduced motion in exit() also leaves instantly then.
 *   instant      true while the current exit must finish without animation
 *   signal       aborted when exit() begins (or when a reset interrupts enter())
 *   root         the site root URL, for assets: new URL('easter/x.txt', ctx.root)
 *   pointer      the last known pointer position { x, y } in viewport px, or null
 *   hideGlyphs(on)  toggles html.lenses-hide-glyphs: transparent glyphs in the scope
 *   layer(kind)  'fixed' (viewport) or 'page' (document, scrolls with it) container on <body>,
 *                pointer-events none, z-index 900 unless the lens changes it; removed after exit
 *   bell(step)   a soft pentatonic bell, step 0..9; silent when the sound is off
 *   frame(fn)    fn(dt, now) runs once per animation frame (dt in s, at most 0.1). Return false
 *                to stop. Registering the same fn again only wakes the loop, so a lens may call
 *                ctx.frame(tick) from any event. Returns an unregister function. Callbacks keep
 *                running during exit() and are dropped once exit() resolves. The one shared
 *                loop stops when no callback is left and pauses while the tab is hidden.
 *
 * After exit() resolves the core removes the layers, the lens stylesheet, the glyph class and
 * any html class that starts with lens-<id>.
 */
(() => {
  'use strict';
  if (window.SiteLenses) return;

  /* ---------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------- */
  const VERSION = 'lenses-v1';
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = new URL('../', SCRIPT_SRC).href;               // easter/lenses.js → the site root
  const LENSES = ['stardust', 'tokens', 'blueprint', 'acta', 'lamplight'];   // the cycle, in order
  const SCOPE_IDS = ['site-nav', 'main-content', 'site-footer'];
  const GLYPH_CLASS = 'lenses-hide-glyphs';
  const NAME_SELECTOR = '.profile-text .name';

  // Transitions and limits (ms)
  const ENTER_LIMIT_MS = 20000;       // an enter() that never settles counts as a failure
  const ENTER_GRACE_MS = 1500;        // a reset gives an unfinished enter() this long
  const EXIT_LIMIT_MS = 5000;         // an exit() that never settles is cleaned up after this
  const INSTANT_GRACE_MS = 800;       // an instant reset waits at most this long for a lens
  const LOAD_LIMIT_MS = 15000;        // a lens module that has not loaded by then has failed

  // Caption
  const CAPTION_MS = 3200;            // fully shown for this long
  const CAPTION_FADE_MS = 450;
  const CAPTION_GAP = 20;             // px between the name and a caption beside it
  const CAPTION_SIDE_MIN = 240;       // px of free width beside the name needed to sit there
  const CAPTION_ABOVE_GAP = 9;        // px between a caption above the name and the name's capitals
  const CAPTION_ABOVE_MIN_GAP = 3;    // ... squeezed to this when the space above is tight
  const CAPTION_EDGE = 12;            // px from the viewport edges for a caption above the name
  const CAPTION_MAX_WIDTH = 560;
  const CAPTION_COMPACT_BELOW = 600;  // viewport px under which the caption uses compact type
  const SEEN_KEY = 'lenses-seen';
  const HINT_POINTER = 'Double-click the name for the next lens · Esc returns';
  const HINT_TOUCH = 'Double-tap the name for the next lens';

  // Sound: the first egg's bell (four sine partials, 4 ms attack, exponential decays) on a
  // D major pentatonic ladder; the worst-case peak is BELL_GAIN x 1.65 = 0.165.
  const SOUND_KEY = 'spira-sound';
  const LADDER = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
  const BELL_RATIOS = [1, 2, 2.76, 4.07];
  const BELL_GAINS = [1, 0.35, 0.22, 0.08];
  const BELL_DECAYS = [2.4, 1.4, 1.1, 0.7];
  const BELL_GAIN = 0.1;
  const BELL_ATTACK = 0.004;
  const BELL_MIN_GAP_MS = 60;
  const AUDIO_IDLE_MS = 3500;         // the context is suspended this long after the last bell

  // Animation loop
  const DT_MAX = 0.1;

  /* ---------------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------------- */
  const html = document.documentElement;
  const ROOT_ATTRS = [[html, 'class'], [html, 'style'], [document.body, 'class'], [document.body, 'style']];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const registry = new Map();          // id -> lens
  const failed = new Set();            // ids that failed to load or to enter (skipped)
  const loading = new Map();           // id -> Promise<lens | null>
  const warned = new Set();
  const contexts = new WeakMap();      // ctx -> its bookkeeping
  const interrupts = new Set();        // pending settle() waits a reset can shorten
  let active = null;                   // { lens, ctx, phase: 'entering' | 'active' | 'exiting' }
  let working = false;                 // the transition worker is running
  let queued = false;                  // one step waits (a trigger during a transition)
  let queuedTarget;                    // undefined: the next lens; an id: that lens (_debug.goto)
  let resetWanted = false;
  let instantWanted = false;
  let idleWaiters = [];
  const pointer = { x: 0, y: 0, known: false };

  // One console warning per lens (or for the core, or the sound), then silence.
  const warnOnce = (key, error, note = 'failed and is skipped') => {
    if (warned.has(key)) return;
    warned.add(key);
    const who = key === 'core' || key === 'sound' ? key : `lens "${key.split(':')[0]}"`;
    console.warn(`Lenses: ${who} ${note}.`, error);
  };
  const asset = path => new URL(`${path}?v=${VERSION}`, ROOT).href;

  // ctx.motion: the reduced-motion query, which also reads true during an instant reset.
  const motionView = {
    get matches() { return instantWanted || motion.matches; },
    get media() { return motion.media; },
    addEventListener(type, listener, options) { motion.addEventListener(type, listener, options); },
    removeEventListener(type, listener, options) { motion.removeEventListener(type, listener, options); },
    addListener(listener) { motion.addListener(listener); },
    removeListener(listener) { motion.removeListener(listener); }
  };

  /* ---------------------------------------------------------------------------
   * The transition worker: one step at a time, a reset wins over a queued step.
   * ------------------------------------------------------------------------- */
  function kick() { if (!working) work(); }

  async function work() {
    working = true;
    try {
      for (;;) {
        if (resetWanted) {
          resetWanted = false; queued = false; queuedTarget = undefined;
          if (active) await leave(active);
          if (!resetWanted) instantWanted = false;
          continue;
        }
        if (queued) {
          queued = false;
          const target = queuedTarget; queuedTarget = undefined;
          await step(target);
          continue;
        }
        break;
      }
    } catch (error) {
      warnOnce('core', error);
    } finally {
      working = false; instantWanted = false;
    }
    const waiters = idleWaiters; idleWaiters = [];
    waiters.forEach(resolve => resolve());
  }

  const whenIdle = () => (working ? new Promise(resolve => idleWaiters.push(resolve)) : Promise.resolve());

  // The lens after `id` in the cycle that has not failed, or null (back to normal).
  function following(id) {
    for (let k = (id ? LENSES.indexOf(id) : -1) + 1; k < LENSES.length; k++) {
      if (!failed.has(LENSES[k])) return LENSES[k];
    }
    return null;
  }

  async function step(target) {
    const from = active ? active.lens.id : null;
    if (target !== undefined && target === from) return;
    if (active) { await leave(active); if (resetWanted) return; }
    if (target !== undefined) { await arrive(target); return; }   // a test jump: no skipping
    for (let id = following(from), tries = 0; id && tries < LENSES.length; tries++) {
      if (await arrive(id) || resetWanted) return;
      id = following(id);
    }
  }

  // Resolves with { value } | { error } | { timeout }. A reset can shorten the wait.
  function settle(promise, limit, graceFor) {
    return new Promise(resolve => {
      let done = false; let timer = 0;
      const finish = result => {
        if (done) return;
        done = true; clearTimeout(timer); interrupts.delete(onInterrupt); resolve(result);
      };
      const onInterrupt = instant => {
        const grace = graceFor(instant);
        if (grace === null) return;
        clearTimeout(timer);
        timer = setTimeout(() => finish({ timeout: true }), grace);
      };
      interrupts.add(onInterrupt);
      timer = setTimeout(() => finish({ timeout: true }), limit);
      if (resetWanted || instantWanted) onInterrupt(instantWanted);
      promise.then(value => finish({ value }), error => finish({ error }));
    });
  }
  const enterGrace = instant => (instant ? INSTANT_GRACE_MS : ENTER_GRACE_MS);
  const exitGrace = instant => (instant ? INSTANT_GRACE_MS : null);
  const call = (fn, ctx) => { try { return Promise.resolve(fn(ctx)); } catch (error) { return Promise.reject(error); } };

  // Loads, styles and enters one lens. True when it entered (or a reset made trying moot).
  async function arrive(id) {
    const lens = await loadModule(id);
    if (resetWanted) return true;
    if (!lens) return false;
    const ctx = createContext(lens);
    const book = contexts.get(ctx);
    if (lens.css) {
      const styled = await attachStyle(lens, book);
      if (resetWanted || !styled) {
        if (!styled) { failed.add(id); warnOnce(id, new Error(`easter/${id}.css did not load`)); }
        finish(ctx);
        return resetWanted;
      }
    }
    const entry = { lens, ctx, phase: 'entering' };
    active = entry;
    ctx.bell(lens.order);
    const shown = showCaption(lens, ctx, false);
    const outcome = await settle(call(lens.enter.bind(lens), ctx), ENTER_LIMIT_MS, enterGrace);
    if (outcome.error || (outcome.timeout && !resetWanted)) {
      failed.add(id);
      warnOnce(id, outcome.error || new Error('enter() did not settle'));
      await leave(entry);
      return resetWanted;
    }
    if (entry.phase === 'entering') entry.phase = 'active';
    if (!resetWanted) {
      if (!shown) showCaption(lens, ctx, true); else placeCaption();   // the lens may have moved the name
      prefetch(following(id));
    }
    return true;
  }

  // Plays the lens's exit, then removes everything the core added for it.
  async function leave(entry) {
    entry.phase = 'exiting';
    const { lens, ctx } = entry;
    const book = contexts.get(ctx);
    book.controller.abort();
    hideCaption(instantWanted || motionView.matches);
    const outcome = await settle(call(lens.exit.bind(lens), ctx), EXIT_LIMIT_MS, exitGrace);
    if (outcome.error) warnOnce(lens.id, outcome.error);
    else if (outcome.timeout && !instantWanted) warnOnce(lens.id, new Error('exit() did not settle'));
    finish(ctx);
    if (active === entry) active = null;
  }

  // Core-owned restoration: frames, layers, the stylesheet, the glyph class, lens classes.
  function finish(ctx) {
    const book = contexts.get(ctx);
    if (!book || book.dead) return;
    book.dead = true;
    book.controller.abort();
    frames.forEach((owner, fn) => { if (owner === book) frames.delete(fn); });
    book.layers.forEach(layer => { pageLayers.delete(layer); layer.remove(); });
    book.layers.length = 0;
    if (!pageLayers.size && pageObserver) { pageObserver.disconnect(); pageObserver = null; }
    if (book.style) { book.style.remove(); book.style = null; }
    if (book.glyphs) { book.glyphs = false; html.classList.remove(GLYPH_CLASS); }
    const prefix = `lens-${book.lens.id}`;
    [...html.classList].forEach(name => { if (name === prefix || name.startsWith(`${prefix}-`)) html.classList.remove(name); });
    ROOT_ATTRS.forEach(([el, name], i) => {
      const was = book.attrs[i]; const now = el.getAttribute(name);
      if (now === was) return;
      if (was === null && now !== '') warnOnce(`${book.lens.id}:leak`, new Error(`${el.tagName.toLowerCase()}[${name}="${now}"]`), 'left an attribute behind (restored)');
      if (was === null) el.removeAttribute(name); else el.setAttribute(name, was);
    });
    removeCaption();
  }

  /* ---------------------------------------------------------------------------
   * Loading
   * ------------------------------------------------------------------------- */
  function register(lens) {
    if (!lens || typeof lens.enter !== 'function' || typeof lens.exit !== 'function' || !LENSES.includes(lens.id)) {
      warnOnce(lens && lens.id ? String(lens.id) : 'core', new Error('register() needs a known id, enter() and exit()'));
      return;
    }
    if (!registry.has(lens.id)) registry.set(lens.id, lens);
  }

  function loadModule(id) {
    if (registry.has(id)) return Promise.resolve(registry.get(id));
    if (failed.has(id)) return Promise.resolve(null);
    if (loading.has(id)) return loading.get(id);
    const promise = new Promise(resolve => {
      const script = document.createElement('script');
      let timer = 0;
      const done = error => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        script.remove();                       // the module has run; no node is left behind
        loading.delete(id);
        const lens = registry.get(id) || null;
        if (!lens) { failed.add(id); warnOnce(id, error || new Error(`easter/${id}.js did not register`)); }
        resolve(lens);
      };
      script.onload = () => done(null);
      script.onerror = () => done(new Error(`easter/${id}.js could not be loaded`));
      timer = setTimeout(() => done(new Error(`easter/${id}.js timed out`)), LOAD_LIMIT_MS);
      script.src = asset(`easter/${id}.js`);
      document.head.append(script);
    });
    loading.set(id, promise);
    return promise;
  }

  // The lens stylesheet is attached for each activation and removed after its exit.
  function attachStyle(lens, book) {
    return new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = asset(`easter/${lens.id}.css`);
      link.onload = () => { link.onload = link.onerror = null; resolve(true); };
      link.onerror = () => { link.onload = link.onerror = null; link.remove(); book.style = null; resolve(false); };
      book.style = link;
      document.head.append(link);
    });
  }

  // Warms the next lens: its module registers now, its stylesheet lands in the HTTP cache.
  function prefetch(id) {
    if (!id) return;
    loadModule(id).then(lens => {
      if (lens && lens.css) fetch(asset(`easter/${id}.css`)).catch(() => {});
    });
  }

  /* ---------------------------------------------------------------------------
   * ctx
   * ------------------------------------------------------------------------- */
  function createContext(lens) {
    const controller = new AbortController();
    const book = {
      lens, controller, dead: false, layers: [], style: null, glyphs: false,
      // The root attributes as they were, restored exactly after exit (a safety net).
      attrs: ROOT_ATTRS.map(([el, name]) => el.getAttribute(name))
    };
    const ctx = {
      scope: SCOPE_IDS.map(id => document.getElementById(id)).filter(Boolean),
      motion: motionView,
      signal: controller.signal,
      root: ROOT,
      get instant() { return instantWanted; },
      get pointer() { return pointer.known ? { x: pointer.x, y: pointer.y } : null; },
      hideGlyphs(on) {
        if (book.dead) return;
        book.glyphs = !!on;
        html.classList.toggle(GLYPH_CLASS, book.glyphs);
      },
      layer(kind = 'fixed') {
        const page = kind === 'page';
        const layer = document.createElement('div');
        layer.className = `lenses-layer lenses-layer-${page ? 'page' : 'fixed'}`;
        layer.setAttribute('aria-hidden', 'true');
        if (book.dead) return layer;           // a late call gets a detached element
        document.body.append(layer);
        book.layers.push(layer);
        if (page) { pageLayers.add(layer); sizePageLayers(); watchPage(); }
        return layer;
      },
      bell(stepIndex) { if (!book.dead) playBell(stepIndex); },
      frame(fn) {
        if (book.dead || typeof fn !== 'function') return () => {};
        if (!frames.has(fn)) frames.set(fn, book);
        wakeLoop();
        return () => { if (frames.get(fn) === book) frames.delete(fn); };
      }
    };
    contexts.set(ctx, book);
    return ctx;
  }

  // Page layers cover the document. They are measured at height 0, so they never keep the
  // document taller than its content.
  const pageLayers = new Set();
  let pageObserver = null;
  function sizePageLayers() {
    if (!pageLayers.size) return;
    pageLayers.forEach(layer => { layer.style.height = '0px'; });
    const height = Math.max(html.scrollHeight, document.body.scrollHeight);
    pageLayers.forEach(layer => { layer.style.height = `${height}px`; });
  }
  function watchPage() {
    if (pageObserver || typeof ResizeObserver === 'undefined') return;
    pageObserver = new ResizeObserver(() => sizePageLayers());
    pageObserver.observe(document.body);
  }

  /* ---------------------------------------------------------------------------
   * One shared animation loop
   * ------------------------------------------------------------------------- */
  const frames = new Map();            // fn -> the bookkeeping of the ctx that registered it
  const frameStats = {};               // lens id -> { frames, totalMs, maxMs }
  let raf = 0; let lastNow = 0; let frameDt = 0; let frameNow = 0; let frameOwner = null;

  function wakeLoop() {
    if (!raf && frames.size && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function runOne(book, fn) {
    let keep;
    try { keep = fn(frameDt, frameNow); } catch (error) { keep = false; warnOnce(`${book.lens.id}:frame`, error, 'threw in a frame callback (dropped)'); }
    if (keep === false) frames.delete(fn);
    frameOwner = book;
  }
  function tick(now) {
    raf = 0;
    frameDt = lastNow ? Math.min(DT_MAX, Math.max(0, (now - lastNow) / 1000)) : 1 / 60;
    frameNow = now; lastNow = now; frameOwner = null;
    const began = performance.now();
    frames.forEach(runOne);
    if (frameOwner) {
      const spent = performance.now() - began;
      const id = frameOwner.lens.id;
      const stats = frameStats[id] || (frameStats[id] = { frames: 0, totalMs: 0, maxMs: 0 });
      stats.frames++; stats.totalMs += spent; if (spent > stats.maxMs) stats.maxMs = spent;
    }
    if (!frames.size || document.hidden) lastNow = 0;
    else if (!raf) raf = requestAnimationFrame(tick);   // a callback may already have woken it
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      lastNow = 0;
      if (audio.context && audio.context.state === 'running') audio.context.suspend().catch(() => {});
    } else {
      wakeLoop();
    }
  });

  /* ---------------------------------------------------------------------------
   * Caption: "I · Stardust — Every letter is made of smaller things."
   * Beside the name when there is room on its line, otherwise just above it; positioned in
   * document coordinates, so it scrolls away with the name.
   * ------------------------------------------------------------------------- */
  let caption = null; let captionTimer = 0; let captionRemoveTimer = 0;
  let captionObserver = null;
  let triggerType = '';               // 'mouse' or 'touch': how the last trigger was given (for the hint)

  function captionLines(lens, ctx, late) {
    let line = lens.line; let note = null;
    if (typeof lens.caption === 'function') {
      let dynamic = null;
      try { dynamic = lens.caption(ctx); } catch (error) { warnOnce(`${lens.id}:caption`, error, 'threw in caption() (its line is used)'); }
      if (dynamic === null || dynamic === undefined || dynamic === '') {
        if (!late) return null;                // not ready yet: try again once enter() settles
      } else if (typeof dynamic === 'object') {
        line = dynamic.line || line; note = dynamic.note || null;
      } else {
        const parts = String(dynamic).split('\n');
        line = parts[0] || line; note = parts.slice(1).join(' ') || null;
      }
    }
    const lines = [`${lens.numeral} · ${lens.label} — ${line}`];
    if (note) lines.push(note);
    let seen = true;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; if (!seen) localStorage.setItem(SEEN_KEY, '1'); } catch (error) { seen = true; }
    const touch = triggerType ? triggerType !== 'mouse' : window.matchMedia('(hover: none)').matches;
    if (!seen) lines.push(touch ? HINT_TOUCH : HINT_POINTER);
    return lines;
  }

  function showCaption(lens, ctx, late) {
    const lines = captionLines(lens, ctx, late);
    if (!lines) return false;
    removeCaption();
    const el = document.createElement('div');
    el.className = 'lenses-caption';
    el.setAttribute('role', 'status');
    if (motionView.matches) el.classList.add('is-still');
    lines.forEach((text, i) => {
      const span = document.createElement('span');
      span.className = i === 0 ? 'lenses-caption-line' : 'lenses-caption-note';
      span.textContent = text;
      el.append(span);
    });
    document.body.append(el);
    caption = el;
    placeCaption();
    // A lens may reflow the page (fonts) while its caption shows: follow the name.
    const name = document.querySelector(NAME_SELECTOR);
    if (name && typeof ResizeObserver !== 'undefined') {
      captionObserver = new ResizeObserver(() => placeCaption());
      captionObserver.observe(name);
    }
    void el.offsetWidth;                       // commit opacity 0 before the fade
    el.classList.add('is-shown');
    captionTimer = setTimeout(() => hideCaption(false), CAPTION_MS + (motionView.matches ? 0 : CAPTION_FADE_MS));
    return true;
  }

  function placeCaption() {
    const el = caption;
    if (!el) return;
    const name = document.querySelector(NAME_SELECTOR) || document.querySelector('#main-content h1');
    el.classList.remove('is-beside', 'is-above', 'is-centred', 'is-compact');
    el.style.left = el.style.top = el.style.width = '';
    if (!name) {
      el.classList.add('is-above');
      el.style.left = `${scrollX + 24}px`; el.style.top = `${scrollY + 24}px`; el.style.width = `${Math.min(560, innerWidth - 48)}px`;
      return;
    }
    const box = name.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(name);
    const glyphs = range.getBoundingClientRect();
    const centred = getComputedStyle(name).textAlign === 'center';
    const side = box.right - glyphs.right - CAPTION_GAP;
    const fontSize = parseFloat(getComputedStyle(name).fontSize) || 28;
    if (!centred && side >= CAPTION_SIDE_MIN) {
      // Beside the name. One line shares the name's baseline; more lines centre on its glyphs.
      el.classList.add('is-beside');
      el.style.left = `${glyphs.right + CAPTION_GAP + scrollX}px`;
      el.style.width = `${side}px`;
      const first = el.firstElementChild.getBoundingClientRect();
      const height = el.getBoundingClientRect().height;
      const nameBaseline = glyphs.top + (glyphs.height + fontSize * 0.75) / 2;   // Lato: ascent ~0.99 em of a 1.2 em box
      const lineBaseline = first.height / 2 + 13 * 0.36;
      const top = height <= first.height + 1 ? nameBaseline - lineBaseline : glyphs.top + glyphs.height / 2 - height / 2;
      el.style.top = `${top + scrollY}px`;
    } else {
      // Above the name, aligned like it (centred on narrow screens), in compact type on a
      // phone, between the name and whatever is above it (the photo, on a phone).
      el.classList.add('is-above');
      el.classList.toggle('is-compact', innerWidth < CAPTION_COMPACT_BELOW);
      if (centred) el.classList.add('is-centred');
      const viewport = document.documentElement.clientWidth || innerWidth;
      const width = centred ? Math.min(viewport - 2 * CAPTION_EDGE, CAPTION_MAX_WIDTH) : Math.min(box.width, CAPTION_MAX_WIDTH);
      const left = centred ? Math.max(CAPTION_EDGE, Math.min(viewport - CAPTION_EDGE - width, box.left + box.width / 2 - width / 2)) : box.left;
      el.style.left = `${left + scrollX}px`;
      el.style.width = `${width}px`;
      const height = el.getBoundingClientRect().height;
      const capTop = glyphs.top + fontSize * 0.26;                              // Lato: cap height ~0.72 em
      let ceiling = -Infinity;                                                  // the bottom of what sits above the name
      for (const above of document.querySelectorAll('.profile-photo, #site-nav nav')) {
        const r = above.getBoundingClientRect();
        if (r.height && r.bottom <= glyphs.top + 1 && r.right > left && r.left < left + width) ceiling = Math.max(ceiling, r.bottom);
      }
      const gap = Math.max(CAPTION_ABOVE_MIN_GAP, Math.min(CAPTION_ABOVE_GAP, (capTop - ceiling - height) / 2));
      el.style.top = `${capTop - gap - height + scrollY}px`;
    }
  }

  function hideCaption(instant) {
    const el = caption;
    if (!el) return;
    clearTimeout(captionTimer);
    if (instant || el.classList.contains('is-still')) { removeCaption(); return; }
    el.classList.remove('is-shown');
    clearTimeout(captionRemoveTimer);
    captionRemoveTimer = setTimeout(() => { if (caption === el) removeCaption(); }, CAPTION_FADE_MS + 50);
  }

  function removeCaption() {
    clearTimeout(captionTimer); clearTimeout(captionRemoveTimer);
    if (captionObserver) { captionObserver.disconnect(); captionObserver = null; }
    if (caption) { caption.remove(); caption = null; }
  }

  /* ---------------------------------------------------------------------------
   * Sound
   * ------------------------------------------------------------------------- */
  const audio = { context: null, last: -1e9, idle: 0 };
  const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch (error) { return true; } };

  // Runs inside the trigger gesture: adopt the context the site shell primed, or create one,
  // and resume it, so later bells can play.
  function wakeAudio() {
    if (!soundOn()) return;
    try {
      if (!audio.context || audio.context.state === 'closed') {
        const primed = window.__lensesAudioContext;
        if (primed !== undefined) { try { delete window.__lensesAudioContext; } catch (error) { window.__lensesAudioContext = undefined; } }
        if (primed && primed.state !== 'closed') audio.context = primed;
        else {
          const Context = window.AudioContext || window.webkitAudioContext;
          if (!Context) return;
          audio.context = new Context();
        }
      }
      if (audio.context.state === 'suspended' && !document.hidden) audio.context.resume().catch(() => {});
    } catch (error) {
      audio.context = null;
    }
  }

  // One bell into any context (an OfflineAudioContext in the tests).
  function ringBell(context, destination, stepIndex, t) {
    const midi = LADDER[Math.max(0, Math.min(LADDER.length - 1, Math.round(Number(stepIndex) || 0)))];
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    for (let k = 0; k < BELL_RATIOS.length; k++) {
      const fk = f * BELL_RATIOS[k];
      if (fk > context.sampleRate * 0.45) continue;
      const peak = BELL_GAIN * BELL_GAINS[k];
      const amp = context.createGain();
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(peak, t + BELL_ATTACK);
      amp.gain.exponentialRampToValueAtTime(peak * 1e-3, t + BELL_ATTACK + BELL_DECAYS[k]);
      amp.connect(destination);
      const osc = context.createOscillator();
      osc.type = 'sine'; osc.frequency.value = fk;
      osc.connect(amp);
      osc.start(t); osc.stop(t + BELL_ATTACK + BELL_DECAYS[k] + 0.05);
    }
  }

  function playBell(stepIndex) {
    if (!soundOn()) return;
    const context = audio.context;
    if (!context || context.state === 'closed') return;
    const now = performance.now();
    if (now - audio.last < BELL_MIN_GAP_MS) return;
    audio.last = now;
    try {
      if (context.state === 'suspended' && !document.hidden) context.resume().catch(() => {});
      ringBell(context, context.destination, stepIndex, context.currentTime + 0.02);
      clearTimeout(audio.idle);
      audio.idle = setTimeout(() => { if (context.state === 'running') context.suspend().catch(() => {}); }, AUDIO_IDLE_MS);
    } catch (error) {
      warnOnce('sound', error);
    }
  }

  /* ---------------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------------- */
  // Advance one step in the cycle. Call it inside the trigger gesture, so the bell can sound.
  function next(options) {
    if (options && options.pointerType) triggerType = String(options.pointerType);
    wakeAudio();
    queued = true; queuedTarget = undefined;
    kick();
    return whenIdle();
  }

  // Back to normal. { instant: true } aborts at once and restores without animation.
  function reset(options) {
    const instant = !!(options && options.instant);
    if (!active && !working) { removeCaption(); return Promise.resolve(); }
    resetWanted = true; queued = false; queuedTarget = undefined;
    if (instant) { instantWanted = true; removeCaption(); }
    if (active && active.phase === 'entering') contexts.get(active.ctx).controller.abort();
    interrupts.forEach(fn => fn(instant));
    kick();
    return whenIdle();
  }

  // Esc returns to normal (a lens can consume Esc first with preventDefault on document).
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || (!active && !working)) return;
    if (document.querySelector('dialog[open]')) return;
    reset();
  });

  // Leaving the page: the lens must be gone before the page is frozen or restored.
  window.addEventListener('pagehide', () => {
    if (active || working) reset({ instant: true });
    if (audio.context && audio.context.state === 'running') audio.context.suspend().catch(() => {});
  });

  // The last pointer position, for lenses that start where the pointer is.
  const notePointer = event => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true; };
  window.addEventListener('pointermove', notePointer, { passive: true, capture: true });
  window.addEventListener('pointerdown', notePointer, { passive: true, capture: true });

  window.addEventListener('resize', () => { placeCaption(); sizePageLayers(); });

  const api = {
    register,
    next,
    reset,
    get current() { return active ? active.lens.id : null; },
    get busy() { return working; },
    // Test-only hooks.
    _debug: {
      lenses: LENSES.slice(),
      root: ROOT,
      version: VERSION,
      // Straight to a lens (or null for normal), through exit and enter as usual.
      goto(id) {
        if (id === null || id === undefined) return reset();
        if (!LENSES.includes(id)) return Promise.reject(new Error(`Unknown lens ${id}`));
        queued = true; queuedTarget = id;
        kick();
        return whenIdle();
      },
      // Loads every lens module that exists; resolves with the registered ids in cycle order.
      loadAll() { return Promise.all(LENSES.map(loadModule)).then(() => LENSES.filter(id => registry.has(id))); },
      lens(id) { return registry.get(id) || null; },
      ringBell,
      bellGain: BELL_GAIN,
      get state() {
        return {
          current: active ? active.lens.id : null,
          phase: active ? active.phase : (working ? 'loading' : 'idle'),
          busy: working,
          queued,
          registered: LENSES.filter(id => registry.has(id)),
          failed: [...failed],
          frames: frames.size,
          raf: !!raf,
          layers: active ? contexts.get(active.ctx).layers.length : 0,
          glyphs: html.classList.contains(GLYPH_CLASS),
          caption: caption ? [...caption.children].map(span => span.textContent) : null,
          audio: audio.context ? audio.context.state : null,
          frameStats: Object.fromEntries(Object.entries(frameStats).map(([id, s]) => [id, {
            frames: s.frames, avgMs: +(s.totalMs / Math.max(1, s.frames)).toFixed(3), maxMs: +s.maxMs.toFixed(3)
          }]))
        };
      }
    }
  };
  window.SiteLenses = api;
})();
