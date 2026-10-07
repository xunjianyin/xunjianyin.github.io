/**
 * Lenses. Double-click (or double-tap) a name or a page title ([data-lens-trigger]) and the
 * page is seen through another lens; the content never changes, only how it is drawn. The
 * cycle is LENSES below (normal → the first lens → … → the last → normal); Esc returns to
 * normal from any lens. easter/README.md is the map of the eggs; this header is the contract.
 * The active lens follows the reader across the site: it is kept in sessionStorage
 * ('lenses-active', with its ground in 'lenses-ground'), every page's <head> marks
 * html[data-lens-arriving] before the first paint and paints the ground (#lenses-prepaint),
 * and easter/boot.js calls SiteLenses.arrive(id), which enters silently and quickly.
 *
 * This file is the core: the cycle, the lens contract, the caption, the bell, one shared
 * animation loop, and the bookkeeping that restores the page exactly. Each lens lives in
 * easter/lenses/<id>.js (plus easter/lenses/<id>.css when it declares css: true) and is
 * loaded the first time it is needed; after a lens has entered, the next one is prefetched.
 * A lens whose module is missing or fails is skipped with one console warning.
 *
 * Lens contract:
 *   SiteLenses.register({ id, order, numeral, label, line, ground, css, supported(), enter(ctx),
 *                         exit(ctx), arrive(ctx), caption(ctx) })
 *   id, order   the id as listed in LENSES, and its 1-based place there
 *   numeral, label, line   the caption: "numeral · label — line"
 *   ground      '#rrggbb': the colour a page opening with this lens is painted with until the
 *               lens has arrived (the page is hidden over it); null: the page shows at once.
 *               It may be a getter (Shannon's is the page's own background): the core stores
 *               it when the lens has entered, and again whenever html[data-theme] changes while
 *               the lens is active, so the next page is hidden over the current theme's colour.
 *   css         true when easter/lenses/<id>.css exists (attached per activation)
 *   supported() optional: false (or a throw) skips the lens silently on this device or page
 *   enter(ctx)  builds the lens and plays its entering transition; resolves when settled. An
 *               enter() that has not settled after ENTER_LIMIT_MS of visible time counts as a
 *               failure (time in a hidden tab, where ctx.frame pauses, does not count).
 *   arrive(ctx) optional: the lens on a page opened while it is active, at most 350 ms, with
 *               the ground already painted. Without it the core calls enter(ctx) with
 *               ctx.arriving = true.
 *   exit(ctx)   plays the leaving transition and restores everything the lens changed. After
 *               every exit (animated or instant) the core finishes the CSS transitions still
 *               running on <html>, <body> and in the scope, and the CSS animations named
 *               lens-*: a running transition outlives the rule that made it (an animated exit
 *               may resolve with one a hair from done).
 *   caption(ctx) optional: the caption's line (a string; text after a '\n', or { line, note },
 *               adds a second line). Returning null defers the caption: the core asks again
 *               every CAPTION_RETRY_MS while enter() runs and shows it as soon as it is ready,
 *               and once more when enter() resolves (then the line is used if it is still null).
 *
 * The caption sits by the trigger, over no text: beside it, above it (CAPTION_ABOVE_GAP clear
 * of the trigger's glyphs, as measured in its font, and of what precedes it), beside its last
 * line, in the page margin, or centred in the free band of the viewport nearest it (on a paper
 * page, between the nav and the eyebrow); only when none of these fits is it squeezed above
 * the trigger, and as the last resort it is a subtitle at the viewport's foot. There, or
 * wherever it lies over text, a rounded halo of the ground behind its glyphs keeps it
 * legible. The ground is read from the page under the caption (or the lens's ground, whichever
 * contrasts with the caption's colour); a lens can name it with --lenses-caption-ground, as it
 * names the caption's colour with --lenses-caption-color, or set it at once with
 * ctx.captionGround(). While a view transition runs (a lens may call
 * document.startViewTransition), the caption keeps its place and is placed again when the
 * transition has finished.
 *
 * Keys: Esc returns to normal from any lens, and the digits jump (README); while a page modal
 * is open (MODAL_SELECTOR: a dialog, an aria-modal element, the photography lightbox) both
 * belong to the page (Esc closes the lightbox and does not also leave the lens).
 *
 * ctx (one per activation):
 *   page         { kind: 'home' | 'site' | 'blog' | 'paper', path } (path from the site root)
 *   arriving     true when the lens arrives with a page rather than by a trigger
 *   scope        the page's own text: the nav (#site-nav, or a paper's header.site-header),
 *                #main-content, and the footer (#site-footer, or footer.paper-footer)
 *   motion       the reduced-motion query; read ctx.motion.matches live. It also reads true
 *                while an instant reset (the first egg, pagehide) needs the lens gone at once,
 *                so a lens that honours reduced motion in exit() also leaves instantly then.
 *   instant      true while the current exit must finish without animation
 *   signal       aborted when exit() begins (or when a reset interrupts enter())
 *   root         the site root URL, for assets: new URL('easter/lenses/data/x.txt', ctx.root)
 *   pointer      the last known pointer position { x, y } in viewport px, or null
 *   hideGlyphs(on)  toggles html.lenses-hide-glyphs: transparent glyphs in the scope. That
 *                includes the text of ::before and ::after (it inherits the transparent
 *                -webkit-text-fill-color: CSS-generated labels, separators, placeholders) and
 *                of ::marker (list numbers and letters), which Chrome does not let a lens make
 *                visible again. A lens that hides glyphs draws those too (Stardust draws the
 *                markers itself) or accepts that they vanish; shapes (disc bullets, the
 *                <summary> triangle) are painted as shapes and stay.
 *   layer(kind)  'fixed' (viewport) or 'page' (document, scrolls with it) container on <body>,
 *                pointer-events none, z-index 900 unless the lens changes it; removed after exit
 *   bell(step)   a soft pentatonic bell, step 0..9; silent when the sound is off
 *   captionGround(colour)  the caption's halo ground, set at once (no 250 ms re-reading of the
 *                page, no easing): for a lens whose ground changes while its caption shows, it
 *                may be called every frame. null returns to the ground the core reads.
 *   onContentChange(fn)  fn(elements) after the scope's content changes (nodes, text, or the
 *                hidden / open / src / aria-expanded attributes), debounced 150 ms (at most
 *                1 s apart while changes continue). Late markdown, star counts, toggled
 *                abstracts and demos all report here. Returns an unsubscribe function.
 *   onLayoutChange(fn)  fn() after the scope's layout may have moved without a DOM change: an
 *                img / video / iframe in the scope loaded (or failed), web fonts finished
 *                loading, a scope element changed size (its content box or its border box, so
 *                a padding or border change counts), a <details> toggled, or the window
 *                resized. Debounced 120 ms (at most 500 ms apart while changes continue); never
 *                called once exit() has begun. Returns an unsubscribe function.
 *                Both watchers start when the ctx is made, before enter(): changes that come
 *                before a lens subscribes are reported to its first subscription (debounced as
 *                usual), so a lens may measure first and subscribe later. Neither calls back
 *                once exit() has begun.
 *   media(options)  a Promise of a media handle that redraws the scope's images on canvases
 *                laid over them (easter/lenses/media.js, loaded once; see its header):
 *                options { render(source), ground, select, fixed }; the handle has overlays,
 *                ready, refresh(), each(fn) and dispose(), and is disposed after exit() resolves.
 *                fixed: true also redraws images inside a position: fixed container (the
 *                photography lightbox), in a fixed layer above that container.
 *   mediaKit()   a Promise of window.SiteLensesMedia alone (readable, draw, drawAsync, sample,
 *                classify, stats), for a lens that only needs pixels and makes no overlays.
 *   frame(fn)   fn(dt, now) runs once per animation frame (dt in s, at most 0.1). Return false
 *                to stop. Registering the same fn again only wakes the loop, so a lens may call
 *                ctx.frame(tick) from any event. Returns an unregister function. Callbacks keep
 *                running during exit() and are dropped once exit() resolves. The one shared
 *                loop stops when no callback is left and pauses while the tab is hidden.
 *
 * After exit() resolves the core disposes the media handles, removes the layers, the lens
 * stylesheet, the glyph class and any html class that starts with lens-<id>, and restores the
 * root attributes (class and style of <html> and <body>). A lens owns only its class tokens
 * there (lens-*, lenses-*) and the custom properties (--*) it added; the rest is the page's,
 * which may change it while a lens is on (the photography lightbox locks the body's scroll).
 * Without such a change the attribute is put back byte for byte; with one, the page's value
 * stays and only the lens's parts are removed. Lens parts the core had to remove (beyond the
 * lens-<id> classes) are warned about once.
 */
(() => {
  'use strict';
  if (window.SiteLenses) return;

  /* ---------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------- */
  const VERSION = 'lenses-v3';        // the ?v= of every lens asset; bump it when any lens file changes
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = new URL('../../', SCRIPT_SRC).href;            // easter/lenses/core.js → the site root
  const LENS_DIR = 'easter/lenses/';  // <id>.js, <id>.css and media.js, from the site root
  // The cycle, in order: the only list of lenses on the site. Keys 1-9 jump to these places.
  const LENSES = ['stardust', 'tokens', 'blueprint', 'acta', 'lamplight', 'ink', 'chalk', 'shannon', 'darkroom'];
  // The scope: nav, main and footer, as the site shell or a paper page builds them.
  const SCOPE_SELECTORS = ['#site-nav, body > header.site-header', '#main-content', '#site-footer, body > footer.paper-footer'];
  const GLYPH_CLASS = 'lenses-hide-glyphs';
  const TRIGGER_SELECTOR = '[data-lens-trigger]';
  const NAME_SELECTOR = '.profile-text .name';
  const STORE_KEY = 'lenses-active';  // sessionStorage: the lens that follows the reader
  const GROUND_KEY = 'lenses-ground'; // sessionStorage: its ground ('#rrggbb'), absent for none
  const GROUND_FORMAT = /^#[0-9a-f]{6}$/i;
  const ARRIVING_ATTR = 'data-lens-arriving';
  const REVEALING_ATTR = 'data-lens-revealing';
  const PREPAINT_ID = 'lenses-prepaint';  // the <style> that paints the ground before a lens arrives
  const REVEAL_MS = 180;              // the body fades in this fast once a lens has arrived
  const CONTENT_DEBOUNCE_MS = 150;
  const CONTENT_MAX_WAIT_MS = 1000;
  const CONTENT_ATTRIBUTES = ['hidden', 'open', 'src', 'aria-expanded'];
  const LAYOUT_DEBOUNCE_MS = 120;
  const LAYOUT_MAX_WAIT_MS = 500;
  const LAYOUT_MEDIA = new Set(['IMG', 'VIDEO', 'IFRAME']);
  // Digit keys jump to a lens; never while typing, inside a paper's demo, or with a modal open.
  const JUMP_IGNORE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-paper-demo], .paper-demo';
  // A page modal: while one is open, Esc and the digit keys are the page's (not the lenses').
  const MODAL_SELECTOR = 'dialog[open], [aria-modal="true"], .lightbox.active';

  // Transitions and limits (ms). The two limits count visible time only (a hidden tab pauses
  // them, as it pauses the frame loop); the graces count wall-clock time.
  const ENTER_LIMIT_MS = 20000;       // an enter() that never settles counts as a failure
  const ENTER_GRACE_MS = 1500;        // a reset gives an unfinished enter() this long
  const EXIT_LIMIT_MS = 5000;         // an exit() that never settles is cleaned up after this
  const INSTANT_GRACE_MS = 800;       // an instant reset waits at most this long for a lens
  const LOAD_LIMIT_MS = 15000;        // a lens module that has not loaded by then has failed
  // After an instant exit these CSS animations (by name) are finished with the transitions;
  // the core's own arrival animations (lenses-reveal, lenses-failsafe) are not lens animations.
  const LENS_ANIMATION = /^lens-/;

  // Caption
  const CAPTION_MS = 3200;            // fully shown for this long
  const CAPTION_FADE_MS = 450;
  const CAPTION_GAP = 20;             // px between the name and a caption beside it
  const CAPTION_SIDE_MIN = 240;       // px of free width beside the name needed to sit there
  const CAPTION_ABOVE_GAP = 9;        // px clear above and below a caption above the name (to its glyphs) or in a free band
  const CAPTION_ABOVE_MIN_GAP = 3;    // ... squeezed to this only when no other placement fits
  const CAPTION_FOOT = 24;            // px from the viewport's foot for a subtitle
  const CAPTION_EDGE = 12;            // px from the viewport edges for a caption above the name
  const CAPTION_MAX_WIDTH = 560;
  const CAPTION_COMPACT_BELOW = 600;  // viewport px under which the caption uses compact type
  const CAPTION_MARGIN_MIN = 200;     // px of page margin a caption needs to sit there as a side note
  const CAPTION_RETRY_MS = 150;       // a deferred caption (caption() null) is asked again this often while enter() runs
  const CAPTION_HALO_MS = 250;        // the halo's ground is read again this often while the caption shows
  const HALO_CONTRAST_MIN = 3;        // a ground the caption's colour contrasts with at least this much (WCAG ratio)
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
  let queuedTarget;                    // undefined: the next lens; an id: that lens (arrive, _debug.goto)
  let queuedArrival = false;           // the queued target arrives with the page (no caption, no bell)
  let resetWanted = false;
  let instantWanted = false;
  let idleWaiters = [];
  const pointer = { x: 0, y: 0, known: false };
  let triggerEl = null;                // the element the last trigger was given on (the caption sits by it)
  let holdArrival = false;             // pagehide kept html[data-lens-arriving] for a back/forward return
  let jumpSeq = 0;                     // a digit's jump waits for its module; any later step cancels it
  const limits = { enter: ENTER_LIMIT_MS, exit: EXIT_LIMIT_MS };   // the suites shorten them (_debug.limits)
  const page = pageKind();

  // The page kind and its path from the site root.
  function pageKind() {
    const rootPath = new URL(ROOT).pathname;
    let path = location.pathname.startsWith(rootPath) ? location.pathname.slice(rootPath.length) : location.pathname.replace(/^\//, '');
    if (!path || path.endsWith('/')) path += 'index.html';
    const kind = path === 'index.html' ? 'home' : path.startsWith('papers/') ? 'paper' : path.startsWith('blogs/') ? 'blog' : 'site';
    return Object.freeze({ kind, path });
  }
  const scopeElements = () => [...new Set(SCOPE_SELECTORS.map(selector => document.querySelector(selector)).filter(Boolean))];

  // The lens that follows the reader from page to page, with the ground the next page is
  // painted with before it arrives (read by the <head> snippet, LENSES_PREPAINT in
  // scripts/build_papers.py).
  const groundOf = lens => (lens && typeof lens.ground === 'string' && GROUND_FORMAT.test(lens.ground) ? lens.ground : null);
  const remember = lens => {
    try {
      sessionStorage.setItem(STORE_KEY, lens.id);
      const ground = groundOf(lens);
      if (ground) sessionStorage.setItem(GROUND_KEY, ground); else sessionStorage.removeItem(GROUND_KEY);
    } catch (error) { /* storage is optional */ }
  };
  const forget = () => { try { sessionStorage.removeItem(STORE_KEY); sessionStorage.removeItem(GROUND_KEY); } catch (error) { /* storage is optional */ } };

  // The pre-paint ground, as the <head> snippet writes it (the same rules; keep them equal).
  // Its rules are keyed on the arrival attributes, so removing html[data-lens-arriving] alone
  // already shows the page; the element itself goes once the reveal is over.
  function prepaint(ground) {
    let style = document.getElementById(PREPAINT_ID);
    if (!ground) { if (style) style.remove(); return; }
    if (!style) { style = document.createElement('style'); style.id = PREPAINT_ID; document.head.append(style); }
    style.textContent = `html[data-lens-arriving],html[data-lens-revealing]{background:${ground}!important}html[data-lens-arriving] body{opacity:0;animation:lenses-failsafe 0s linear 3s forwards}@keyframes lenses-failsafe{to{opacity:1}}`;
  }

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
          resetWanted = false; queued = false; queuedTarget = undefined; queuedArrival = false;
          if (active) await leave(active);
          if (!resetWanted) instantWanted = false;
          continue;
        }
        if (queued) {
          queued = false;
          const target = queuedTarget; const arrival = queuedArrival;
          queuedTarget = undefined; queuedArrival = false;
          await step(target, arrival);
          continue;
        }
        break;
      }
    } catch (error) {
      warnOnce('core', error);
    } finally {
      working = false; instantWanted = false;
    }
    // Nothing arrived (a reset, or a lens that failed): show the page as it is.
    if (!active && !holdArrival) reveal(true);
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

  async function step(target, arrival = false) {
    const from = active ? active.lens.id : null;
    if (target !== undefined && target === from) return;
    if (active) { await leave(active); if (resetWanted) return; }
    if (target !== undefined) {                 // an arrival or a test jump: no skipping
      if (!(await arrive(target, arrival)) && !resetWanted) forget();
      return;
    }
    for (let id = following(from), tries = 0; id && tries < LENSES.length; tries++) {
      if (await arrive(id) || resetWanted) return;
      id = following(id);
    }
    if (!resetWanted) forget();                 // back to normal: the next page opens normal too
  }

  // Resolves with { value } | { error } | { timeout }. A reset can shorten the wait.
  // The limit counts visible time only: the shared frame loop pauses while the tab is hidden,
  // so a lens driven by ctx.frame cannot move on there, and its clock stops with it (the time
  // left resumes when the tab returns). A reset's grace replaces the limit and counts
  // wall-clock time, so a pagehide or the first egg still ends the lens promptly when hidden.
  function settle(promise, limit, graceFor) {
    return new Promise(resolve => {
      let done = false; let timer = 0;
      let left = limit; let since = 0;           // the limit's time left, and when it last resumed
      let grace = false;                         // a reset's wall-clock grace has replaced the limit
      const finish = result => {
        if (done) return;
        done = true; clearTimeout(timer); interrupts.delete(onInterrupt);
        document.removeEventListener('visibilitychange', onVisibility);
        resolve(result);
      };
      const expire = () => finish({ timeout: true });
      const resume = () => { since = performance.now(); timer = setTimeout(expire, left); };
      const onVisibility = () => {
        if (done || grace) return;
        if (!document.hidden) { if (!timer) resume(); return; }
        if (!timer) return;
        clearTimeout(timer); timer = 0;
        left = Math.max(0, left - (performance.now() - since));
      };
      const onInterrupt = instant => {
        const ms = graceFor(instant);
        if (ms === null) return;
        grace = true;
        clearTimeout(timer);
        timer = setTimeout(expire, ms);
      };
      interrupts.add(onInterrupt);
      document.addEventListener('visibilitychange', onVisibility);
      if (!document.hidden) resume();            // a hidden tab starts with the limit paused
      if (resetWanted || instantWanted) onInterrupt(instantWanted);
      promise.then(value => finish({ value }), error => finish({ error }));
    });
  }
  const enterGrace = instant => (instant ? INSTANT_GRACE_MS : ENTER_GRACE_MS);
  const exitGrace = instant => (instant ? INSTANT_GRACE_MS : null);
  const call = (fn, ctx) => { try { return Promise.resolve(fn(ctx)); } catch (error) { return Promise.reject(error); } };

  // A lens may decline this device or page (lens.supported() false, or a throw): it is then
  // skipped silently, like a lens that is not there, but it is not counted as failed.
  function supported(lens) {
    if (typeof lens.supported !== 'function') return true;
    try { return lens.supported() !== false; } catch (error) { return false; }
  }

  // Loads, styles and enters one lens. True when it entered (or a reset made trying moot).
  // An arrival comes with a page load: silent, without a caption, through lens.arrive().
  async function arrive(id, arrival = false) {
    const lens = await loadModule(id);
    if (resetWanted) return true;
    if (!lens || !supported(lens)) return false;
    const ctx = createContext(lens, arrival);
    const book = contexts.get(ctx);
    if (lens.css) {
      const styled = await attachStyle(lens, book);
      if (resetWanted || !styled) {
        if (!styled) { failed.add(id); warnOnce(id, new Error(`${LENS_DIR}${id}.css did not load`)); }
        finish(ctx);
        return resetWanted;
      }
    }
    const entry = { lens, ctx, phase: 'entering' };
    active = entry;
    if (!arrival) ctx.bell(lens.order);
    let shown = arrival || showCaption(lens, ctx, false);
    // A deferred caption (caption() not ready yet) is asked again while enter() runs, so it
    // shows as soon as the lens can say it, not only once enter() has resolved.
    const retry = shown ? 0 : setInterval(() => {
      if (shown || entry.phase !== 'entering' || resetWanted || ctx.signal.aborted) return;
      shown = showCaption(lens, ctx, false);
    }, CAPTION_RETRY_MS);
    const run = arrival && typeof lens.arrive === 'function' ? lens.arrive : lens.enter;
    const outcome = await settle(call(run.bind(lens), ctx), limits.enter, enterGrace);
    clearInterval(retry);
    if (outcome.error || (outcome.timeout && !resetWanted)) {
      failed.add(id);
      warnOnce(id, outcome.error || new Error('enter() did not settle'));
      await leave(entry);
      return resetWanted;
    }
    if (entry.phase === 'entering') entry.phase = 'active';
    if (!resetWanted) {
      remember(lens);
      if (arrival) reveal();
      else if (!shown) showCaption(lens, ctx, true);
      else placeCaption();                      // the lens may have moved the trigger
      prefetch(following(id));
    }
    return true;
  }

  // The page was marked before the first paint (html[data-lens-arriving]) until the lens
  // arrived. When it was hidden over a ground (#lenses-prepaint), the body fades in over that
  // ground (html[data-lens-revealing], core.css), and the ground goes after the fade; a lens
  // without a ground showed the page all along. Every path that ends an arrival (a reset, a
  // failure, an unknown id) comes through here.
  let revealTimer = 0;
  function reveal(instant = motionView.matches) {
    const id = html.getAttribute(ARRIVING_ATTR);
    const ground = document.getElementById(PREPAINT_ID);
    html.removeAttribute(ARRIVING_ATTR);
    if (id === null || instant || !ground) {
      if (ground && !html.hasAttribute(REVEALING_ATTR)) ground.remove();
      return;
    }
    clearTimeout(revealTimer);
    html.setAttribute(REVEALING_ATTR, id);
    revealTimer = setTimeout(() => { html.removeAttribute(REVEALING_ATTR); prepaint(null); }, REVEAL_MS + 60);
  }

  // Plays the lens's exit, then removes everything the core added for it.
  async function leave(entry) {
    entry.phase = 'exiting';
    const { lens, ctx } = entry;
    const book = contexts.get(ctx);
    book.controller.abort();
    hideCaption(instantWanted || motionView.matches);
    const outcome = await settle(call(lens.exit.bind(lens), ctx), limits.exit, exitGrace);
    if (outcome.error) warnOnce(lens.id, outcome.error);
    else if (outcome.timeout && !instantWanted) warnOnce(lens.id, new Error('exit() did not settle'));
    finish(ctx);
    endTransitions(ctx.scope);
    if (active === entry) active = null;
  }

  // After an exit nothing the lens started may still be moving. Chrome lets a running CSS
  // transition go on after the rule that declared it is gone (its class or its stylesheet
  // removed), so the value would keep animating after the lens has left: after an instant
  // exit, and after an animated one that resolves while a transition is a hair from done.
  // Every running CSSTransition on <html>, <body> or in the scope is finished, and every
  // CSSAnimation named lens-*; the page's own CSS animations (a paper's demos) are left alone.
  // document.getAnimations() brings the style up to date first, so the transitions the
  // restoration itself started are among them.
  function endTransitions(scope) {
    if (typeof document.getAnimations !== 'function') return;
    const Transition = window.CSSTransition; const Named = window.CSSAnimation;
    const ours = el => el === html || el === document.body || scope.some(root => root.contains(el));
    for (const animation of document.getAnimations()) {
      const transition = typeof Transition === 'function' && animation instanceof Transition;
      const named = typeof Named === 'function' && animation instanceof Named && LENS_ANIMATION.test(String(animation.animationName));
      const target = animation.effect && animation.effect.target;
      if ((!transition && !named) || !target || !ours(target)) continue;
      try { animation.finish(); } catch (error) {
        try { animation.cancel(); } catch (ignored) { /* already gone */ }   // an endless animation cannot finish
      }
    }
  }

  // Core-owned restoration: frames, layers, the stylesheet, the glyph class, lens classes.
  function finish(ctx) {
    const book = contexts.get(ctx);
    if (!book || book.dead) return;
    book.dead = true;
    book.controller.abort();
    stopContentWatch(book);
    stopLayoutWatch(book);
    book.media.forEach(handle => { try { handle.dispose(); } catch (error) { warnOnce(`${book.lens.id}:media`, error, 'media handle failed to dispose'); } });
    book.media.clear();
    frames.forEach((owner, fn) => { if (owner === book) frames.delete(fn); });
    book.layers.forEach(layer => { pageLayers.delete(layer); layer.remove(); });
    book.layers.length = 0;
    if (!pageLayers.size && pageObserver) { pageObserver.disconnect(); pageObserver = null; }
    if (book.style) { book.style.remove(); book.style = null; }
    if (book.glyphs) { book.glyphs = false; html.classList.remove(GLYPH_CLASS); }
    const prefix = `lens-${book.lens.id}`;
    [...html.classList].forEach(name => { if (name === prefix || name.startsWith(`${prefix}-`)) html.classList.remove(name); });
    restoreRoot(book);
    removeCaption();
  }

  // The root attributes (class and style of <html> and <body>) after a lens. A lens owns only
  // its class tokens (lens-*, lenses-*) and the custom properties (--*) it added there; the
  // rest is the page's, which may change it while a lens is active (the photography lightbox
  // locks the body's scroll with body.style.overflow while it is open). So the lens's parts
  // are taken out of the value now: when what remains is the value from before the lens, that
  // value is put back byte for byte; otherwise the page changed the attribute, and its value
  // stays with only the lens's parts removed (classList.remove, style.removeProperty: the rest
  // is not rewritten), without a warning. Lens parts the core had to remove here (beyond the
  // lens-<id> classes and the glyph class, which it removes by design) are warned about once.
  const LENS_TOKEN = /^lenses?-/;
  const tokensOf = value => (value === null ? [] : String(value).split(/\s+/).filter(Boolean));
  const declarationsOf = value => {               // a style value as its declaration block
    const probe = document.createElement('div');
    if (value !== null) probe.setAttribute('style', value);
    return probe.style;
  };
  function restoreRoot(book) {
    const left = [];
    ROOT_ATTRS.forEach(([el, name], i) => {
      const was = book.attrs[i]; const now = el.getAttribute(name);
      if (now === was) return;
      let owned; let same;
      if (name === 'class') {
        const before = new Set(tokensOf(was));
        owned = tokensOf(now).filter(token => LENS_TOKEN.test(token) && !before.has(token));
        same = tokensOf(now).filter(token => !owned.includes(token)).sort().join(' ') === tokensOf(was).sort().join(' ');
      } else {
        const before = declarationsOf(was);
        const after = declarationsOf(now);
        owned = [...after].filter(property => property.startsWith('--') && !before.getPropertyValue(property));
        owned.forEach(property => after.removeProperty(property));
        same = after.cssText === before.cssText;
      }
      if (owned.length) left.push(`${el.tagName.toLowerCase()} ${name === 'class' ? owned.map(token => `.${token}`).join(' ') : owned.join(' ')}`);
      if (same) { if (was === null) el.removeAttribute(name); else el.setAttribute(name, was); }
      else if (name === 'class') owned.forEach(token => el.classList.remove(token));
      else owned.forEach(property => el.style.removeProperty(property));
    });
    if (left.length) warnOnce(`${book.lens.id}:leak`, new Error(left.join('; ')), 'left a class or custom property behind (removed)');
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
        if (!lens) { failed.add(id); warnOnce(id, error || new Error(`${LENS_DIR}${id}.js did not register`)); }
        resolve(lens);
      };
      script.onload = () => done(null);
      script.onerror = () => done(new Error(`${LENS_DIR}${id}.js could not be loaded`));
      timer = setTimeout(() => done(new Error(`${LENS_DIR}${id}.js timed out`)), LOAD_LIMIT_MS);
      script.src = asset(`${LENS_DIR}${id}.js`);
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
      link.href = asset(`${LENS_DIR}${lens.id}.css`);
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
      if (lens && lens.css && supported(lens)) fetch(asset(`${LENS_DIR}${id}.css`)).catch(() => {});
    });
  }

  // The media helper (easter/lenses/media.js), loaded the first time a lens asks for it.
  let mediaLoading = null;
  function loadMedia() {
    if (window.SiteLensesMedia) return Promise.resolve(window.SiteLensesMedia);
    if (mediaLoading) return mediaLoading;
    mediaLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const done = error => {
        script.onload = script.onerror = null;
        script.remove();
        if (!error && window.SiteLensesMedia) { resolve(window.SiteLensesMedia); return; }
        mediaLoading = null;                     // a later call may try again
        reject(error || new Error(`${LENS_DIR}media.js did not initialize`));
      };
      script.onload = () => done(null);
      script.onerror = () => done(new Error(`${LENS_DIR}media.js could not be loaded`));
      script.src = asset(`${LENS_DIR}media.js`);
      document.head.append(script);
    });
    return mediaLoading;
  }

  /* ---------------------------------------------------------------------------
   * ctx
   * ------------------------------------------------------------------------- */
  function createContext(lens, arrival = false) {
    const controller = new AbortController();
    const book = {
      lens, controller, dead: false, layers: [], style: null, glyphs: false,
      captionGround: null,                     // the halo's ground named by ctx.captionGround()
      content: null,                           // { fns, observer, changed, timer, first, schedule }
      layout: null,                            // { fns, timer, first, pending, stop, schedule }
      media: new Set(),                        // media handles, disposed after exit
      // The root attributes as they were, restored exactly after exit (a safety net).
      attrs: ROOT_ATTRS.map(([el, name]) => el.getAttribute(name))
    };
    const ctx = {
      page,
      arriving: arrival,
      scope: scopeElements(),
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
      // The caption's halo ground, set now (a lens whose ground changes while its caption
      // shows calls this every frame); null returns to the ground the core reads.
      captionGround(colour) {
        if (book.dead) return;
        book.captionGround = typeof colour === 'string' && colour.trim() ? colour.trim() : null;
        if (caption && captionBook === book) groundCaption(caption, book.captionGround);
      },
      // Both watchers run from the ctx's creation; a subscription receives what changed
      // before it, if nothing has been reported yet (see watchContent and watchLayout).
      onContentChange(fn) {
        if (book.dead || typeof fn !== 'function') return () => {};
        const watch = watchContent(book, ctx.scope);
        watch.fns.add(fn);
        watch.schedule();
        return () => { if (book.content) book.content.fns.delete(fn); };
      },
      onLayoutChange(fn) {
        if (book.dead || controller.signal.aborted || typeof fn !== 'function') return () => {};
        const watch = watchLayout(book, ctx.scope);
        watch.fns.add(fn);
        if (watch.pending) watch.schedule();
        return () => { if (book.layout) book.layout.fns.delete(fn); };
      },
      media(options) {
        if (book.dead) return Promise.reject(new Error('media() after exit'));
        return loadMedia().then(helper => {
          if (book.dead) throw new Error('media() after exit');
          const handle = helper.create(ctx, options || {});
          book.media.add(handle);
          return handle;
        });
      },
      mediaKit() {
        if (book.dead) return Promise.reject(new Error('mediaKit() after exit'));
        return loadMedia();
      },
      frame(fn) {
        if (book.dead || typeof fn !== 'function') return () => {};
        if (!frames.has(fn)) frames.set(fn, book);
        wakeLoop();
        return () => { if (frames.get(fn) === book) frames.delete(fn); };
      }
    };
    contexts.set(ctx, book);
    // The watchers start now, so a lens that measures before it subscribes misses nothing.
    watchContent(book, ctx.scope);
    watchLayout(book, ctx.scope);
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
   * Content changes in the scope (late markdown, star counts, abstracts, demos), debounced.
   * Lens layers and the caption live outside the scope; anything inside them is ignored.
   * The watch starts with the ctx. Until a lens subscribes, changes are only collected (no
   * timer runs); the first subscription schedules them, so they reach it debounced as usual.
   * ------------------------------------------------------------------------- */
  const outsideContent = node => {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !el || !!el.closest('.lenses-layer, .lenses-caption');
  };
  function watchContent(book, scope) {
    if (book.content) return book.content;
    const watch = { fns: new Set(), observer: null, changed: new Set(), timer: 0, first: 0, schedule: null };
    book.content = watch;
    const flush = () => {
      watch.timer = 0; watch.first = 0;
      if (book.dead || book.controller.signal.aborted || !watch.fns.size) return;   // kept for a subscriber
      const changed = [...watch.changed].filter(el => el.isConnected);
      watch.changed.clear();
      watch.fns.forEach(fn => {
        try { fn(changed); } catch (error) { warnOnce(`${book.lens.id}:content`, error, 'threw in onContentChange'); }
      });
    };
    // Trailing debounce, but never more than CONTENT_MAX_WAIT_MS behind a stream of changes;
    // a subscription that comes while a flush is due joins it.
    watch.schedule = ({ restart = false } = {}) => {
      if (!watch.changed.size || !watch.fns.size || !watch.observer) return;
      if (watch.timer && !restart) return;
      const now = performance.now();
      if (!watch.first) watch.first = now;
      clearTimeout(watch.timer);
      watch.timer = setTimeout(flush, Math.max(0, Math.min(CONTENT_DEBOUNCE_MS, watch.first + CONTENT_MAX_WAIT_MS - now)));
    };
    watch.observer = new MutationObserver(records => {
      for (const record of records) {
        if (outsideContent(record.target)) continue;
        const el = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (el) watch.changed.add(el);
      }
      watch.schedule({ restart: true });
    });
    scope.forEach(root => watch.observer.observe(root, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: CONTENT_ATTRIBUTES
    }));
    book.controller.signal.addEventListener('abort', () => stopContentWatch(book), { once: true });
    return watch;
  }
  function stopContentWatch(book) {
    const watch = book.content;
    if (!watch) return;
    clearTimeout(watch.timer);
    if (watch.observer) watch.observer.disconnect();
    watch.observer = null; watch.changed.clear(); watch.fns.clear();
  }

  /* ---------------------------------------------------------------------------
   * Layout changes in the scope without a DOM change (images, video and frames loading, web
   * fonts, element resizes, <details> toggles, window resizes), debounced. One set of
   * listeners and one timer per ctx, all removed when exit() begins. The watch starts with
   * the ctx (so the size baseline is the page before the lens); a change before the first
   * subscription is kept as pending and reported to that subscription.
   * ------------------------------------------------------------------------- */
  function watchLayout(book, scope) {
    if (book.layout) return book.layout;
    const watch = { fns: new Set(), timer: 0, first: 0, pending: false, stop: null, schedule: null };
    book.layout = watch;
    const signal = book.controller.signal;
    const inScope = node => scope.some(root => root.contains(node));
    const flush = () => {
      watch.timer = 0; watch.first = 0;
      if (book.dead || signal.aborted) return;
      if (!watch.fns.size) { watch.pending = true; return; }
      watch.pending = false;
      watch.fns.forEach(fn => {
        try { fn(); } catch (error) { warnOnce(`${book.lens.id}:layout`, error, 'threw in onLayoutChange'); }
      });
    };
    // Trailing debounce, but never more than LAYOUT_MAX_WAIT_MS behind a stream of changes.
    // Without a subscriber no timer runs: the change waits as pending.
    const schedule = () => {
      if (book.dead || signal.aborted) return;
      if (!watch.fns.size) { watch.pending = true; return; }
      const now = performance.now();
      if (!watch.first) watch.first = now;
      clearTimeout(watch.timer);
      watch.timer = setTimeout(flush, Math.max(0, Math.min(LAYOUT_DEBOUNCE_MS, watch.first + LAYOUT_MAX_WAIT_MS - now)));
    };
    watch.schedule = schedule;
    // load / error / loadedmetadata and toggle do not bubble: one capturing listener each.
    const onMedia = event => { const el = event.target; if (el && LAYOUT_MEDIA.has(el.tagName) && inScope(el)) schedule(); };
    const onToggle = event => { const el = event.target; if (el && el.tagName === 'DETAILS' && inScope(el)) schedule(); };
    const options = { capture: true, passive: true, signal };
    ['load', 'error', 'loadedmetadata'].forEach(type => document.addEventListener(type, onMedia, options));
    document.addEventListener('toggle', onToggle, options);
    window.addEventListener('resize', schedule, { passive: true, signal });
    if (document.fonts && typeof document.fonts.addEventListener === 'function') document.fonts.addEventListener('loadingdone', schedule, { signal });
    // Size changes of the scope elements, of the content box and of the border box (a padding
    // or border change moves the content without changing the content box). A ResizeObserver
    // reports every element once when it starts: only later sizes count.
    let observers = [];
    if (typeof ResizeObserver !== 'undefined') {
      observers = ['content-box', 'border-box'].map(box => {
        const sizes = new Map();
        const observer = new ResizeObserver(entries => {
          let changed = false;
          for (const entry of entries) {
            const border = box === 'border-box' && entry.borderBoxSize && entry.borderBoxSize[0];
            const size = border ? `${Math.round(border.inlineSize)}x${Math.round(border.blockSize)}`
              : `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
            if (sizes.has(entry.target) && sizes.get(entry.target) !== size) changed = true;
            sizes.set(entry.target, size);
          }
          if (changed) schedule();
        });
        scope.forEach(root => { try { observer.observe(root, { box }); } catch (error) { observer.observe(root); } });
        return observer;
      });
    }
    watch.stop = () => { observers.forEach(observer => observer.disconnect()); observers = []; };
    signal.addEventListener('abort', () => stopLayoutWatch(book), { once: true });
    return watch;
  }
  function stopLayoutWatch(book) {
    const watch = book.layout;
    if (!watch) return;
    clearTimeout(watch.timer); watch.timer = 0;
    if (watch.stop) watch.stop();
    watch.stop = null; watch.fns.clear();
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
   * Beside the name when there is room on its line, otherwise above it or in a free band near
   * it (placeCaption); positioned in document coordinates, so it scrolls away with the name.
   * ------------------------------------------------------------------------- */
  let caption = null; let captionTimer = 0; let captionRemoveTimer = 0;
  let captionObserver = null;
  let captionLens = null;             // the lens whose caption shows (its ground is a halo candidate)
  let captionBook = null;             // ... and its activation's bookkeeping (ctx.captionGround)
  let captionPlaced = false;          // placed once: a view transition keeps that placement
  let captionWaits = null;            // the view transition the caption waits for, to be placed again
  let captionStep = '';               // the placement layOut() chose last (_debug.state.captionStep)
  let haloTimer = 0;
  let triggerType = '';               // 'mouse' or 'touch': how the last trigger was given (for the hint)

  // View transitions. While one runs the page is drawn by the ::view-transition overlay, so
  // elementFromPoint returns <html> everywhere and the caption's hit tests would find free
  // space over the nav or a title. document.activeViewTransition names the running one where
  // the browser has it; elsewhere the core wraps document.startViewTransition to see the ones
  // lenses (or the page) start from now on. A transition counts as running until its finished
  // promise settles.
  const transitions = new Set();
  const transitionsEnded = new WeakSet();
  const runningTransition = () => {
    const vt = document.activeViewTransition || transitions.values().next().value || null;
    return vt && !transitionsEnded.has(vt) ? vt : null;
  };
  if (!('activeViewTransition' in document) && typeof document.startViewTransition === 'function') {
    const start = document.startViewTransition;
    document.startViewTransition = function startViewTransition(...args) {
      const vt = start.apply(this, args);
      if (vt && vt.finished && typeof vt.finished.then === 'function') {
        transitions.add(vt);
        const end = () => { transitions.delete(vt); transitionsEnded.add(vt); };
        vt.finished.then(end, end);
      }
      return vt;
    };
  }

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
    caption = el; captionLens = lens; captionBook = contexts.get(ctx) || null;
    if (captionBook && captionBook.captionGround) groundCaption(el, captionBook.captionGround);
    placeCaption();
    // A lens may reflow the page (fonts) while its caption shows: follow the trigger.
    const anchor = captionAnchor();
    if (anchor && typeof ResizeObserver !== 'undefined') {
      captionObserver = new ResizeObserver(() => placeCaption());
      captionObserver.observe(anchor);
    }
    // The ground under the caption changes while the lens comes in: the halo follows it.
    haloTimer = setInterval(tintCaption, CAPTION_HALO_MS);
    void el.offsetWidth;                       // commit opacity 0 before the fade
    el.classList.add('is-shown');
    captionTimer = setTimeout(() => hideCaption(false), CAPTION_MS + (motionView.matches ? 0 : CAPTION_FADE_MS));
    return true;
  }

  // The caption's halo (core.css): a soft glow of the ground behind its glyphs, so it stays
  // legible where it lies over text, with no band, border or box. The ground is the first of
  // these the caption's colour contrasts with by HALO_CONTRAST_MIN: the page's background
  // under the caption (the first opaque background-color from the element there up), then
  // the lens's ground; failing both, the one with more contrast. A lens's own
  // --lenses-caption-ground (core.css) wins over it. Canvases in lens layers do not take the
  // pointer, so a ground a lens paints there is not seen here; its registered ground is.
  const rgbaOf = value => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(String(value));
    if (!m) return null;
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], a];
  };
  const hexRgba = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(1);
  const luminance = ([r, g, b]) => {
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function pageGround(x, y) {
    let el = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? document.elementFromPoint(x, y) : null;
    if (!el || el === html) el = document.body;
    for (; el; el = el.parentElement) {
      const c = rgbaOf(getComputedStyle(el).backgroundColor);
      if (c && c[3] >= 0.5) return c;
    }
    return html.getAttribute('data-theme') === 'dark' ? [17, 24, 39, 1] : [255, 255, 255, 1];
  }
  function tintCaption() {
    const el = caption;
    if (!el || !el.isConnected) return;
    const ink = rgbaOf(getComputedStyle(el).color);
    if (!ink) return;
    const box = el.getBoundingClientRect();
    const candidates = [pageGround(box.left + box.width / 2, box.top + box.height / 2)];
    const ground = groundOf(captionLens);
    if (ground) candidates.push(hexRgba(ground));
    const best = candidates.find(c => contrast(ink, c) >= HALO_CONTRAST_MIN) ||
      candidates.reduce((a, b) => (contrast(ink, b) > contrast(ink, a) ? b : a));
    const halo = `rgb(${best.slice(0, 3).map(Math.round).join(', ')})`;
    if (el.style.getPropertyValue('--lenses-caption-halo') !== halo) el.style.setProperty('--lenses-caption-halo', halo);
  }

  // ctx.captionGround(colour): the lens names the halo's ground itself, on the caption (an
  // inline --lenses-caption-ground wins over the lens's sheet and over the ground the core
  // reads), and the halo follows it at once (is-grounded drops the halo's 250 ms easing).
  function groundCaption(el, colour) {
    if (colour) {
      if (el.style.getPropertyValue('--lenses-caption-ground') !== colour) el.style.setProperty('--lenses-caption-ground', colour);
      el.classList.add('is-grounded');
    } else {
      el.style.removeProperty('--lenses-caption-ground');
      el.classList.remove('is-grounded');
    }
  }

  // The element the caption sits by: the trigger that was used, else the page's own.
  function captionAnchor() {
    if (triggerEl && triggerEl.isConnected) return triggerEl;
    return document.querySelector(NAME_SELECTOR) || document.querySelector(`#main-content ${TRIGGER_SELECTOR}`) ||
      document.querySelector(TRIGGER_SELECTOR) || document.querySelector('#main-content h1');
  }

  // The lowest content above `top` across the caption's columns (elementFromPoint, so
  // whatever is drawn there counts; the anchor and its containers do not). Blind (during a
  // view transition, when every hit is <html>) the band above counts as taken.
  function ceilingAbove(anchor, left, width, top, need, blind) {
    if (blind) return top;
    let ceiling = -Infinity;
    for (const share of [0.08, 0.5, 0.92]) {
      const x = left + width * share;
      for (let y = top - 2; y >= top - need && y >= 0; y -= 3) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit === html || hit === document.body || hit.contains(anchor) || anchor.contains(hit)) continue;
        ceiling = Math.max(ceiling, y);
        break;
      }
    }
    return ceiling;
  }

  // Beside a one-line trigger when its line has room; else above it, in the free band under
  // whatever precedes it, CAPTION_ABOVE_GAP clear on both sides; else beside its last line;
  // else as a side note in the page margin (right, then left) at the trigger's first line;
  // else centred in the free band of the viewport nearest the trigger; else squeezed above it
  // (CAPTION_ABOVE_MIN_GAP), or in a band that tight; else a subtitle at the viewport's foot
  // (over whatever is there: its halo keeps it legible). layOut() has the details.
  // While a view transition runs the caption keeps its placement (hit tests are blind then)
  // and is placed again once the transition has finished; a caption first placed during one
  // is placed without the band above (blind), then again at its end.
  function placeCaption() {
    const el = caption;
    if (!el) return;
    const vt = runningTransition();
    if (vt) {
      if (captionWaits !== vt) {
        captionWaits = vt;
        const again = () => {
          transitionsEnded.add(vt);
          if (captionWaits !== vt) return;
          captionWaits = null;
          if (caption === el) placeCaption();
        };
        vt.finished.then(again, again);
      }
      if (captionPlaced) return;
    }
    captionPlaced = true;
    layOut(el, !!vt);
    tintCaption();
  }
  const PLACEMENTS = ['is-beside', 'is-above', 'is-centred', 'is-compact', 'is-fixed', 'is-band', 'is-margin', 'is-margin-right', 'is-margin-left'];
  const clearPlacement = el => { el.classList.remove(...PLACEMENTS); el.style.left = el.style.top = el.style.width = ''; };
  function layOut(el, blind) {
    clearPlacement(el);
    const anchor = captionAnchor();
    const range = document.createRange();
    if (anchor) range.selectNodeContents(anchor);
    const rects = anchor ? [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0) : [];
    if (!rects.length) { el.classList.add('is-fixed', 'is-centred'); captionStep = 'foot'; return; }
    const box = anchor.getBoundingClientRect();
    const glyphs = range.getBoundingClientRect();
    const style = getComputedStyle(anchor);
    const centred = style.textAlign === 'center';
    const compact = innerWidth < CAPTION_COMPACT_BELOW;
    const fontSize = parseFloat(style.fontSize) || 16;
    const firstTop = Math.min(...rects.map(r => r.top));
    const lastTop = Math.max(...rects.map(r => r.top));
    const lastLine = rects.filter(r => r.top > lastTop - 2);
    const lastRight = Math.max(...lastLine.map(r => r.right));
    const lastHeight = Math.max(...lastLine.map(r => r.height));
    const viewport = document.documentElement.clientWidth || innerWidth;
    const baselineOf = (top, height) => top + (height + fontSize * 0.75) / 2;   // Lato-like: ascent ~0.99 em of a 1.2 em box
    const besideAt = (right, top, height, centreMultiline) => {
      el.classList.add('is-beside');
      el.style.left = `${right + CAPTION_GAP + scrollX}px`;
      el.style.width = `${box.right - right - CAPTION_GAP}px`;
      const firstLine = el.firstElementChild.getBoundingClientRect();
      const own = el.getBoundingClientRect().height;
      const single = own <= firstLine.height + 1;
      if (!single && !centreMultiline) return false;
      const y = single ? baselineOf(top, height) - (firstLine.height / 2 + 13 * 0.36) : top + height / 2 - own / 2;
      el.style.top = `${y + scrollY}px`;
      return true;
    };
    // 1. Beside a one-line trigger (the homepage name, a short page title).
    if (!centred && lastTop - firstTop < 2 && box.right - glyphs.right - CAPTION_GAP >= CAPTION_SIDE_MIN) {
      besideAt(glyphs.right, glyphs.top, glyphs.height, true);
      captionStep = 'beside';
      return;
    }
    // 2. Above it, aligned like it (centred on narrow screens), compact on a phone, with
    //    CAPTION_ABOVE_GAP clear above and below (to the top of its first line's glyphs, as
    //    measured in its font). A tighter band is not taken now: the later placements come
    //    first, and the band squeezed (6.) only when none of them fits.
    const above = () => {
      el.classList.add('is-above');
      el.classList.toggle('is-compact', compact);
      if (centred) el.classList.add('is-centred');
      const width = centred ? Math.min(viewport - 2 * CAPTION_EDGE, CAPTION_MAX_WIDTH) : Math.min(box.width, CAPTION_MAX_WIDTH);
      const left = centred ? Math.max(CAPTION_EDGE, Math.min(viewport - CAPTION_EDGE - width, box.left + box.width / 2 - width / 2)) : box.left;
      el.style.left = `${left + scrollX}px`;
      el.style.width = `${width}px`;
      return { left, width, height: el.getBoundingClientRect().height };
    };
    const capTop = glyphTop(anchor, firstTop, fontSize);
    const band = above();
    const ceiling = ceilingAbove(anchor, band.left, band.width, capTop, band.height + 2 * CAPTION_ABOVE_GAP, blind);
    const room = capTop - ceiling;
    if (room >= band.height + 2 * CAPTION_ABOVE_GAP) {
      el.style.top = `${capTop - CAPTION_ABOVE_GAP - band.height + scrollY}px`;
      captionStep = 'above';
      return;
    }
    const squeezed = room >= band.height + 2 * CAPTION_ABOVE_MIN_GAP ? capTop - (room - band.height) / 2 - band.height : null;
    // 3. Beside the last line of a long title, when the caption fits on one line there.
    clearPlacement(el);
    if (box.right - lastRight - CAPTION_GAP >= CAPTION_SIDE_MIN && besideAt(lastRight, lastTop, lastHeight, false)) { captionStep = 'beside-last'; return; }
    // 4. A side note in the page margin, level with the trigger's first line.
    clearPlacement(el);
    const column = (anchor.closest('#main-content') || anchor.parentElement || anchor).getBoundingClientRect();
    const firstLine = rects.filter(r => r.top < firstTop + 2);
    const firstHeight = Math.max(...firstLine.map(r => r.height));
    for (const side of ['right', 'left']) {
      const from = side === 'right' ? Math.max(box.right, column.right) + CAPTION_GAP : CAPTION_EDGE;
      const room = side === 'right' ? viewport - CAPTION_EDGE - from : Math.min(box.left, column.left) - CAPTION_GAP - CAPTION_EDGE;
      if (room < CAPTION_MARGIN_MIN) continue;
      el.classList.add('is-margin', `is-margin-${side}`);
      el.style.left = `${from + scrollX}px`;
      el.style.width = `${Math.min(room, CAPTION_MAX_WIDTH)}px`;
      const own = el.firstElementChild.getBoundingClientRect();
      el.style.top = `${baselineOf(firstTop, firstHeight) - (own.height / 2 + 13 * 0.36) + scrollY}px`;
      captionStep = 'margin';
      return;
    }
    // 5. In a free band of the viewport, centred: the band nearest the trigger (above or
    //    below it) that holds no text, image or rule across the caption's width, with
    //    CAPTION_ABOVE_GAP clear above and below (on a paper page, the band between the nav
    //    and the eyebrow). It is laid in the document, so nothing slides under it on a scroll.
    const trigger = { top: firstTop, bottom: Math.max(...lastLine.map(r => r.bottom)) };
    const bandWidth = Math.min(viewport - 2 * CAPTION_EDGE, CAPTION_MAX_WIDTH);
    const bandLeft = (viewport - bandWidth) / 2;
    let found = null;                            // the obstacles across the band's width, read once
    // inset: px of the caption's own box kept free of its glyphs (its half-leading), which may
    // lie over a neighbour's empty half-leading in the tightest band.
    const subtitle = (gap, inset = 0) => {
      clearPlacement(el);
      el.classList.add('is-band', 'is-centred', ...(compact ? ['is-compact'] : []));
      el.style.left = `${bandLeft + scrollX}px`;
      el.style.width = `${bandWidth}px`;
      const height = el.getBoundingClientRect().height;
      found = found || obstacles({ left: bandLeft, right: bandLeft + bandWidth, top: -CAPTION_ABOVE_GAP, bottom: innerHeight + CAPTION_ABOVE_GAP });
      const y = freeBand(found, height - 2 * inset, 0, innerHeight - CAPTION_FOOT, gap, trigger);
      if (y === null) return false;
      el.style.top = `${y - inset + scrollY}px`;
      return true;
    };
    const leading = () => {
      const line = getComputedStyle(el.firstElementChild);
      return Math.max(0, ((parseFloat(line.lineHeight) || 0) - (parseFloat(line.fontSize) || 0)) / 2);
    };
    if (subtitle(CAPTION_ABOVE_GAP)) { captionStep = 'band'; return; }
    // 6. Above it, squeezed: closer to its neighbours, but over nothing.
    if (squeezed !== null) {
      clearPlacement(el);
      above();
      el.style.top = `${squeezed + scrollY}px`;
      captionStep = 'above-squeezed';
      return;
    }
    // 7. A subtitle in a band clear by CAPTION_ABOVE_MIN_GAP; failing that, one its box fits
    //    with no gap, or its lines' glyphs do (its own half-leading over the band's edges).
    if (subtitle(CAPTION_ABOVE_MIN_GAP) || subtitle(0) || subtitle(0, leading())) { captionStep = 'band-squeezed'; return; }
    // 8. The last resort: a subtitle at the foot of the viewport, over whatever is there (the
    //    halo keeps it legible).
    clearPlacement(el);
    el.classList.add('is-fixed', 'is-centred', ...(compact ? ['is-compact'] : []));
    captionStep = 'foot';
  }

  // The top of the trigger's first line of glyphs, in viewport px: each text node's part on
  // that line measured in its own font (canvas measureText: actualBoundingBoxAscent above the
  // baseline), its baseline found from its text box (the font's ascent over its descent).
  // Without those metrics, the cap height estimated for Lato (0.26 em below the line's top).
  let measurer = null;
  const fontOf = (s, size = s.fontSize) => [s.fontStyle, s.fontWeight, s.fontStretch && s.fontStretch !== '100%' ? s.fontStretch : '', size, s.fontFamily].filter(Boolean).join(' ');
  // The size the browser draws a font-size-adjust font at (the canvas knows no font-size-adjust):
  // the size whose x-height (or cap height) is that share of the computed size.
  function adjusted(s) {
    const value = String(s.fontSizeAdjust || 'none');
    const share = parseFloat(value.replace(/^[a-z-]+\s+/, ''));
    if (!(share > 0)) return s.fontSize;
    measurer.font = fontOf(s);
    const glyph = /^cap-height/.test(value) ? 'H' : 'x';
    const height = measurer.measureText(glyph).actualBoundingBoxAscent;
    const size = parseFloat(s.fontSize);
    return height > 0 ? `${(size * share * size) / height}px` : s.fontSize;
  }
  const transformed = (text, s) => (s.textTransform === 'uppercase' ? text.toUpperCase() : s.textTransform === 'lowercase' ? text.toLowerCase() : text);
  // The vertical metrics of `text` in an element's font (canvas measureText), or null. The
  // last INKS_KEPT are kept (a caption is placed again on resizes and transitions), until a
  // web font finishes loading (a family's metrics change when it arrives).
  const inks = new Map();
  const INKS_KEPT = 400;
  if (document.fonts && typeof document.fonts.addEventListener === 'function') document.fonts.addEventListener('loadingdone', () => inks.clear());
  function inkOf(text, s) {
    const key = `${fontOf(s)}|${s.fontSizeAdjust}|${s.textTransform}|${text}`;
    if (inks.has(key)) return inks.get(key);
    let ink = null;
    try {
      if (!measurer) measurer = document.createElement('canvas').getContext('2d');
      measurer.font = fontOf(s, adjusted(s));
      const m = measurer.measureText(transformed(text, s));
      if (Number.isFinite(m.actualBoundingBoxAscent) && Number.isFinite(m.fontBoundingBoxAscent)) {
        ink = { actualBoundingBoxAscent: m.actualBoundingBoxAscent, actualBoundingBoxDescent: m.actualBoundingBoxDescent,
          fontBoundingBoxAscent: m.fontBoundingBoxAscent, fontBoundingBoxDescent: m.fontBoundingBoxDescent };
      }
    } catch (error) { ink = null; }
    if (inks.size >= INKS_KEPT) inks.delete(inks.keys().next().value);
    inks.set(key, ink);
    return ink;
  }
  // A text box (a fragment's client rect: the font's ascent over its descent) narrowed to the
  // glyphs: from the baseline up by the ascent they reach, down by their descent.
  function inkBox(r, m) {
    const baseline = r.top + (r.height - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent;
    return { left: r.left, right: r.right, top: baseline - m.actualBoundingBoxAscent, bottom: baseline + m.actualBoundingBoxDescent };
  }
  function glyphTop(anchor, firstTop, fontSize) {
    const estimate = firstTop + fontSize * 0.26;
    try {
      if (!measurer) measurer = document.createElement('canvas').getContext('2d');
      if (!measurer || typeof measurer.measureText('x').actualBoundingBoxAscent !== 'number') return estimate;
      const onFirst = r => r.width > 0 && r.height > 0 && r.top < firstTop + 2;
      const range = document.createRange();
      const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
      let top = Infinity;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.data.trim() || !node.parentElement) continue;
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        if (!rects.length) continue;
        if (!onFirst(rects[0])) break;                 // the first line has ended
        // The node's part on the first line (it may go on to the next): bisected by offset.
        let end = node.length;
        if (!rects.every(onFirst)) {
          let lo = 1; let hi = node.length;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            range.setStart(node, 0); range.setEnd(node, mid);
            const parts = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
            if (parts.length && parts.every(onFirst)) lo = mid; else hi = mid - 1;
          }
          end = lo;
        }
        const s = getComputedStyle(node.parentElement);
        measurer.font = fontOf(s, adjusted(s));
        const m = measurer.measureText(transformed(node.data.slice(0, end), s));
        const ascent = m.fontBoundingBoxAscent; const descent = m.fontBoundingBoxDescent;
        const rect = rects[0];
        const baseline = rect.top + (rect.height - ascent - descent) / 2 + ascent;
        if (Number.isFinite(baseline) && Number.isFinite(m.actualBoundingBoxAscent)) top = Math.min(top, baseline - m.actualBoundingBoxAscent);
      }
      return Number.isFinite(top) ? top : estimate;
    } catch (error) { return estimate; }
  }

  // What a caption must not lie over, in a region of the viewport: the scope's glyphs (each
  // text box narrowed to the ascent and descent its glyphs reach, measured in its font: a tall
  // line box's empty top is free), its replaced elements (images, SVG, canvases, video,
  // frames, form controls, rules) and the visible borders of its elements (the lines of framed
  // figures and buttons, a rule drawn as a border; what is inside them is judged on its own).
  // Elements wholly outside the region are skipped with their subtrees.
  const REPLACED = /^(img|svg|canvas|video|iframe|object|embed|input|textarea|select|button|hr|picture)$/i;
  function obstacles(region) {
    const out = [];
    const meets = r => r.width > 0 && r.height > 0 && r.right > region.left && r.left < region.right && r.bottom > region.top && r.top < region.bottom;
    const range = document.createRange();
    const shows = (s, side) => parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== 'none' && !/^(transparent|rgba\([^)]*,\s*0\))$/.test(s[`border${side}Color`]);
    const borders = (r, s) => {
      const w = side => parseFloat(s[`border${side}Width`]) || 0;
      if (shows(s, 'Top')) out.push({ left: r.left, right: r.right, top: r.top, bottom: r.top + w('Top') });
      if (shows(s, 'Bottom')) out.push({ left: r.left, right: r.right, top: r.bottom - w('Bottom'), bottom: r.bottom });
      if (shows(s, 'Left')) out.push({ left: r.left, right: r.left + w('Left'), top: r.top, bottom: r.bottom });
      if (shows(s, 'Right')) out.push({ left: r.right - w('Right'), right: r.right, top: r.top, bottom: r.bottom });
    };
    const visit = el => {
      const s = getComputedStyle(el);
      if (s.display === 'none') return;
      if (s.display !== 'contents') {
        const r = el.getBoundingClientRect();
        if (!meets(r)) return;
        if (s.visibility === 'visible') { if (REPLACED.test(el.localName)) out.push(r); else borders(r, s); }
        if (REPLACED.test(el.localName)) return;
      }
      for (const child of el.childNodes) {
        if (child.nodeType === 1) visit(child);
        else if (child.nodeType === 3 && child.data.trim() && s.visibility === 'visible') {
          range.selectNodeContents(child);
          const rects = [...range.getClientRects()].filter(meets);
          if (!rects.length) continue;
          const m = inkOf(child.data.trim(), s);
          for (const r of rects) out.push(m ? inkBox(r, m) : r);
        }
      }
    };
    scopeElements().forEach(visit);
    return out;
  }
  // The top (viewport px) for a caption `height` px tall in the free band between `from` and
  // `to` nearest the trigger ({ top, bottom }): a band that holds none of the obstacles (read
  // across the caption's width) and keeps `gap` px clear of them (the trigger's own text is one
  // of them); null when there is none. In a tight band the caption is centred (even gaps); in
  // a wider one it sits as near the trigger as the gap allows.
  function freeBand(found, height, from, to, gap, trigger) {
    if (to - from < height) return null;
    const spans = found
      .map(r => [Math.max(from, r.top - gap), Math.min(to, r.bottom + gap)]).filter(([a, b]) => b > a)
      .sort((a, b) => a[0] - b[0]);
    const taken = [];                                // the spans merged
    for (const [a, b] of spans) {
      const last = taken[taken.length - 1];
      if (last && a <= last[1]) last[1] = Math.max(last[1], b); else taken.push([a, b]);
    }
    let best = null;
    let at = from;
    for (const [a, b] of [...taken, [to, to]]) {
      if (a - at >= height) {
        const below = at >= trigger.bottom;
        const distance = below ? at - trigger.bottom : Math.max(0, trigger.top - a);
        const slack = a - at - height;
        const y = slack <= 2 * gap ? at + slack / 2 : below ? at : a - height;
        if (!best || distance < best.distance) best = { distance, y };
      }
      at = Math.max(at, b);
    }
    return best ? best.y : null;
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
    clearTimeout(captionTimer); clearTimeout(captionRemoveTimer); clearInterval(haloTimer);
    if (captionObserver) { captionObserver.disconnect(); captionObserver = null; }
    if (caption) { caption.remove(); caption = null; }
    captionLens = null; captionBook = null; captionPlaced = false; captionWaits = null;
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
  // options: { pointerType, trigger } from boot (the trigger element anchors the caption).
  function next(options) {
    if (options && options.pointerType) triggerType = String(options.pointerType);
    if (options && options.trigger instanceof Element) triggerEl = options.trigger;
    wakeAudio();
    jumpSeq++;
    queued = true; queuedTarget = undefined; queuedArrival = false;
    kick();
    return whenIdle();
  }

  // A page opened while a lens is active (boot calls this when html[data-lens-arriving] is
  // set): the lens enters silently, without a caption, then the body fades in.
  function arriveWith(id) {
    holdArrival = false;
    jumpSeq++;
    if (!LENSES.includes(id)) { forget(); reveal(true); return Promise.resolve(); }   // also lifts the ground
    queued = true; queuedTarget = id; queuedArrival = true;
    kick();
    return whenIdle().then(() => reveal());
  }

  // Back to normal. { instant: true } aborts at once and restores without animation;
  // { keep: true } keeps the lens for the next page (pagehide).
  function reset(options) {
    const instant = !!(options && options.instant);
    jumpSeq++;                                  // a digit typed earlier does not outlive a reset
    if (!(options && options.keep)) forget();
    if (!active && !working) { removeCaption(); if (!holdArrival) reveal(true); return Promise.resolve(); }
    resetWanted = true; queued = false; queuedTarget = undefined; queuedArrival = false;
    if (instant) { instantWanted = true; removeCaption(); }
    if (active && active.phase === 'entering') contexts.get(active.ctx).controller.abort();
    interrupts.forEach(fn => fn(instant));
    kick();
    return whenIdle();
  }

  // Straight to a lens from a key: the module loads first, so a digit for a lens that is not
  // there (or declines this page) changes nothing. Runs inside the key gesture for the bell.
  // The last key wins: a trigger, a reset (0, Esc) or another digit while the module loads
  // cancels this jump.
  function jump(id) {
    wakeAudio();
    const seq = ++jumpSeq;
    loadModule(id).then(lens => {
      if (seq !== jumpSeq || !lens || !supported(lens) || (!active && !working)) return;
      queued = true; queuedTarget = id; queuedArrival = false;
      kick();
    });
  }

  // While a page modal is open (a dialog, an aria-modal element that shows, the photography
  // lightbox), Esc and the digit keys are the page's: Esc closes the lightbox, and must not
  // also leave the lens. The page's own handler may close the modal before the core's (on
  // window, last) sees the key, so whether one was open is noted as the key event begins (a
  // capturing listener on window runs first).
  const modalKeys = new WeakSet();     // keydown events that began while a page modal was open
  const modalOpen = () => [...document.querySelectorAll(MODAL_SELECTOR)].some(el =>
    !el.closest('.lenses-layer, .lenses-caption') && (el.matches('dialog[open]') || el.getClientRects().length > 0));
  window.addEventListener('keydown', event => { if ((active || working) && modalOpen()) modalKeys.add(event); }, true);
  const forPage = event => modalKeys.has(event) || modalOpen();

  // Esc returns to normal (a lens can consume Esc first with preventDefault on document).
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || (!active && !working)) return;
    if (forPage(event)) return;
    reset();
  });

  // While a lens is active (or a transition runs), keys 1-9 go to that place in LENSES and 0
  // returns to normal. On a normal page digits do nothing here.
  window.addEventListener('keydown', event => {
    const key = event.key;
    if (typeof key !== 'string' || key.length !== 1 || key < '0' || key > '9' || (!active && !working)) return;
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if ((target && target.closest(JUMP_IGNORE)) || forPage(event)) return;
    if (key === '0') { reset(); return; }
    const id = LENSES[Number(key) - 1];
    if (id && !failed.has(id)) jump(id);
  });

  // Leaving the page: the lens must be gone before the page is frozen or restored, but it
  // stays the reader's lens. A page kept for back/forward returns hidden over the lens's
  // ground until boot brings the lens back (pageshow), so the normal page never flashes.
  window.addEventListener('pagehide', event => {
    const lens = active ? active.lens : null;
    if (event.persisted && lens) {
      holdArrival = true;
      clearTimeout(revealTimer); html.removeAttribute(REVEALING_ATTR);
      html.setAttribute(ARRIVING_ATTR, lens.id);
      prepaint(groundOf(lens));
    }
    if (active || working) reset({ instant: true, keep: true });
    if (audio.context && audio.context.state === 'running') audio.context.suspend().catch(() => {});
  });

  // A lens's ground may follow the theme (Shannon's is a getter: the page's own background).
  // The ground is stored when a lens has entered; while it stays, a theme change stores it
  // again, so the next page is hidden over the new theme's colour, not the old one's.
  new MutationObserver(() => {
    if (active && active.phase === 'active' && !resetWanted) remember(active.lens);
  }).observe(html, { attributes: true, attributeFilter: ['data-theme'] });

  // The last pointer position, for lenses that start where the pointer is.
  const notePointer = event => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true; };
  window.addEventListener('pointermove', notePointer, { passive: true, capture: true });
  window.addEventListener('pointerdown', notePointer, { passive: true, capture: true });

  window.addEventListener('resize', () => { placeCaption(); sizePageLayers(); });

  const api = {
    register,
    next,
    reset,
    arrive: arriveWith,
    get current() { return active ? active.lens.id : null; },
    get page() { return page; },
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
        jumpSeq++;
        queued = true; queuedTarget = id; queuedArrival = false;
        kick();
        return whenIdle();
      },
      // Loads every lens module that exists; resolves with the registered ids in cycle order.
      loadAll() { return Promise.all(LENSES.map(loadModule)).then(() => LENSES.filter(id => registry.has(id))); },
      lens(id) { return registry.get(id) || null; },
      get ctx() { return active ? active.ctx : null; },
      // The enter and exit limits in ms ({ enter, exit }); a suite may shorten them and restore them.
      limits,
      // The view transition the core sees running (the caption waits for it), or null.
      get viewTransition() { return runningTransition(); },
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
          captionStep: caption ? captionStep : null,
          audio: audio.context ? audio.context.state : null,
          page,
          stored: (() => { try { return sessionStorage.getItem(STORE_KEY); } catch (error) { return null; } })(),
          storedGround: (() => { try { return sessionStorage.getItem(GROUND_KEY); } catch (error) { return null; } })(),
          prepaint: !!document.getElementById(PREPAINT_ID),
          media: active ? contexts.get(active.ctx).media.size : 0,
          frameStats: Object.fromEntries(Object.entries(frameStats).map(([id, s]) => [id, {
            frames: s.frames, avgMs: +(s.totalMs / Math.max(1, s.frames)).toFixed(3), maxMs: +s.maxMs.toFixed(3)
          }]))
        };
      }
    }
  };
  window.SiteLenses = api;
})();
