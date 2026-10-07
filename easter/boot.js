/**
 * The easter eggs' boot, on every page (loaded by site-shell.js, or by a paper page's <head>).
 * It binds both eggs' triggers and loads nothing else until a visitor asks for an egg.
 * easter/README.md is the map.
 *
 * Lenses (the second egg, easter/lenses/):
 * - Triggers: a double-click or a double-tap on any [data-lens-trigger] (the homepage name,
 *   the footer name, a page's title) moves to the next lens. The core
 *   (easter/lenses/core.css and core.js) loads on the first trigger.
 * - Arrival: the reader's lens follows them across the site. The <head> of every page marks
 *   html[data-lens-arriving] from sessionStorage before the first paint and hides the page
 *   over the lens's ground (#lenses-prepaint); boot loads the core and calls
 *   SiteLenses.arrive(id). Boot knows no lens: the core forgets an id it does not know and
 *   shows the page. A page restored from the back/forward cache arrives again on pageshow.
 * - Sound starts only inside a trigger gesture; an arrival is silent.
 *
 * Spira (the first egg, easter/spira/), on pages with the site shell's footer (#site-footer):
 * - The footer's "*" (.easter-egg-footnote) or typing the password outside a text field opens
 *   it; easter/spira/spira.{js,css} load on the first opening, and an active lens is reset at
 *   once (and forgotten) first. Its AudioContext is primed inside the gesture.
 */
(() => {
  'use strict';
  if (window.SiteLensesBoot) return;

  const VERSION = 'lenses-v3';        // the ?v= of the lenses core (easter/lenses/core.*)
  const SPIRA_VERSION = 'spira-v10';  // the ?v= of easter/spira/spira.*
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = new URL('../', SCRIPT_SRC).href;                 // easter/boot.js → the site root
  const STORE_KEY = 'lenses-active';
  const GROUND_KEY = 'lenses-ground';
  const GROUND_FORMAT = /^#[0-9a-f]{6}$/i;
  const ARRIVING = 'data-lens-arriving';
  const PREPAINT_ID = 'lenses-prepaint';
  const TRIGGER = '[data-lens-trigger]';
  // A double-click on a link or a control inside a trigger keeps its own meaning.
  const INTERACTIVE = 'a, button, input, select, textarea, summary, label, [contenteditable]:not([contenteditable="false"])';
  const DOUBLE_TAP_MS = 320;
  const DOUBLE_TAP_PX = 24;
  const TAP_DBLCLICK_GUARD_MS = 700;  // a double-tap may also synthesize a dblclick: count it once
  const FAILSAFE_MS = 2500;           // an arrival that takes longer shows the page as it is
  const FONTS_WAIT_MS = 800;          // an arrival waits this long at most for web fonts
  // Spira
  const SITE_FOOTER = '#site-footer';
  const FOOTNOTE = '.easter-egg-footnote';
  const PASSWORD = 'yxjgogogo';
  const PASSWORD_GAP_MS = 1800;       // a longer pause between keys starts the password over
  const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], dialog[open]';

  const html = document.documentElement;
  const storage = (fn, fallback = null) => { try { return fn(sessionStorage); } catch (error) { return fallback; } };
  const storedLens = () => storage(store => store.getItem(STORE_KEY) || null);
  const whenReady = () => new Promise(resolve => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    else resolve();
  });
  // Browsers start audio only inside a user gesture: create and resume an AudioContext there,
  // unless the visitor turned the sound off. The egg adopts it (and creates its own if this fails).
  function primeAudio(name) {
    try {
      if (window[name] || localStorage.getItem('spira-sound') === 'off') return;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const context = new Context();
      if (context.resume) context.resume().catch(() => {});
      window[name] = context;
    } catch (error) { /* sound is optional */ }
  }
  function dropAudio(name) {
    try { window[name]?.close().catch(() => {}); } catch (error) { /* already closed */ }
    window[name] = undefined;
  }
  // Loads stylesheets and scripts (in that order of insertion); rejects when any fails.
  const loadAll = assets => Promise.all(assets.map(asset => new Promise((resolve, reject) => {
    asset.onload = resolve;
    asset.onerror = reject;
    document.head.append(asset);
  })));
  const stylesheet = href => Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
  const script = src => Object.assign(document.createElement('script'), { src });

  /* Lenses: the core, loaded once ---------------------------------------------- */
  let coreLoading = null;
  function loadCore() {
    if (window.SiteLenses) return Promise.resolve(window.SiteLenses);
    if (coreLoading) return coreLoading;
    const assets = [stylesheet(new URL(`easter/lenses/core.css?v=${VERSION}`, ROOT).href),
      script(new URL(`easter/lenses/core.js?v=${VERSION}`, ROOT).href)];
    coreLoading = loadAll(assets).then(() => {
      if (!window.SiteLenses) throw new Error('Lenses did not initialize.');
      return window.SiteLenses;
    }).catch(error => {
      // Leave nothing behind, so a later trigger can try again.
      assets.forEach(asset => asset.remove());
      coreLoading = null;
      throw error;
    });
    return coreLoading;
  }

  /* Lenses: triggers ----------------------------------------------------------- */
  // The bell needs an AudioContext created inside the gesture; the core adopts it.
  function triggerLens(element, pointerType) {
    if (window.SiteLenses) { window.SiteLenses.next({ pointerType, trigger: element }); return; }
    primeAudio('__lensesAudioContext');
    loadCore().then(lenses => lenses.next({ pointerType, trigger: element }), () => dropAudio('__lensesAudioContext'));
  }

  const triggerOf = target => {
    const el = target instanceof Element ? target : target && target.parentElement;
    const trigger = el && el.closest(TRIGGER);
    if (!trigger) return null;
    const control = el.closest(INTERACTIVE);
    return control && trigger.contains(control) ? null : trigger;
  };

  let lastTap = null;
  let tappedAt = -Infinity;
  // A double-click would select the word under the pointer: keep the selection as it was.
  document.addEventListener('mousedown', event => {
    if (event.detail > 1 && triggerOf(event.target)) event.preventDefault();
  });
  document.addEventListener('dblclick', event => {
    const trigger = triggerOf(event.target);
    if (!trigger) return;
    event.preventDefault();
    if (performance.now() - tappedAt < TAP_DBLCLICK_GUARD_MS) return;
    triggerLens(trigger, 'mouse');
  });
  // Touch and pen: two taps on the same trigger within 320 ms and 24 px.
  document.addEventListener('pointerup', event => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    const trigger = triggerOf(event.target);
    if (!trigger) { lastTap = null; return; }
    const now = performance.now();
    if (lastTap && lastTap.trigger === trigger && now - lastTap.at <= DOUBLE_TAP_MS &&
        Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= DOUBLE_TAP_PX) {
      lastTap = null;
      tappedAt = now;
      event.preventDefault();
      triggerLens(trigger, event.pointerType);
    } else {
      lastTap = { trigger, at: now, x: event.clientX, y: event.clientY };
    }
  });
  // Cancelling the second tap's touchend stops its synthesized click and dblclick; the
  // double-tap zoom is stopped by touch-action: manipulation on [data-lens-trigger].
  document.addEventListener('touchend', event => {
    if (performance.now() - tappedAt < 60 && event.cancelable && triggerOf(event.target)) event.preventDefault();
  }, { passive: false });

  /* Lenses: arrival ------------------------------------------------------------ */
  // The ground the page is hidden over until the lens arrives: the <head> snippet's rules
  // (LENSES_PREPAINT in scripts/build_papers.py; keep them equal), written again here for a
  // back/forward return, since the reader may have changed lens on another page meanwhile.
  function prepaint() {
    const ground = storage(store => store.getItem(GROUND_KEY));
    let style = document.getElementById(PREPAINT_ID);
    if (!ground || !GROUND_FORMAT.test(ground)) { if (style) style.remove(); return; }
    if (!style) { style = document.createElement('style'); style.id = PREPAINT_ID; document.head.append(style); }
    style.textContent = `html[data-lens-arriving],html[data-lens-revealing]{background:${ground}!important}html[data-lens-arriving] body{opacity:0;animation:lenses-failsafe 0s linear 3s forwards}@keyframes lenses-failsafe{to{opacity:1}}`;
  }

  // Ends an arrival on the boot's side (no lens, the core did not come in time or at all, or
  // the reader left the lens meanwhile): the page shows as it is and the ground goes with the
  // mark, so <head> is as the page wrote it, less the snippet's style.
  const unmark = () => { html.removeAttribute(ARRIVING); document.getElementById(PREPAINT_ID)?.remove(); };

  let failsafe = 0;
  function arrive(restored = false) {
    const id = storedLens();
    if (!id) { unmark(); return; }
    html.setAttribute(ARRIVING, id);
    if (restored) prepaint();
    clearTimeout(failsafe);
    // The core's reveal removes the mark itself (and keeps the ground for its fade): only a
    // mark that is still this arrival's is ended here.
    failsafe = setTimeout(() => { if (html.getAttribute(ARRIVING) === id) unmark(); }, FAILSAFE_MS);
    const fonts = document.fonts && document.fonts.ready
      ? Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, FONTS_WAIT_MS))])
      : Promise.resolve();
    // The page's own scripts fill it on DOMContentLoaded; the lens arrives after them.
    Promise.all([loadCore(), whenReady().then(() => fonts)]).then(([lenses]) => {
      if (storedLens() !== id) { unmark(); return null; }   // the reader left the lens meanwhile
      return lenses.arrive(id);
    }).catch(unmark).finally(() => clearTimeout(failsafe));
  }
  if (html.hasAttribute(ARRIVING)) arrive();
  window.addEventListener('pageshow', event => { if (event.persisted) arrive(true); });

  /* Spira (the first egg) ------------------------------------------------------- */
  let spiraLoading = null;
  let spiraReady = false;
  function openSpira() {
    const footnote = document.querySelector(FOOTNOTE);
    // A lens restyles the page the egg captures: return to normal first, without animation,
    // and forget it, so the next page opens normal too.
    const lenses = window.SiteLenses;
    const lensesSettled = lenses && (lenses.current || lenses.busy) ? lenses.reset({ instant: true }) : null;
    if (!lensesSettled) {
      storage(store => { store.removeItem(STORE_KEY); store.removeItem(GROUND_KEY); });
      unmark();
    }
    primeAudio('__spiraAudioContext');
    if (spiraReady) {
      if (lensesSettled) lensesSettled.then(() => window.SiteEasterEgg.open());
      else window.SiteEasterEgg.open();
      return;
    }
    if (spiraLoading) return;
    const assets = [script(new URL(`easter/spira/spira.js?v=${SPIRA_VERSION}`, ROOT).href),
      stylesheet(new URL(`easter/spira/spira.css?v=${SPIRA_VERSION}`, ROOT).href)];
    if (footnote) footnote.setAttribute('aria-busy', 'true');
    spiraLoading = Promise.all([loadAll(assets)].concat(lensesSettled || [])).then(() => {
      if (!window.SiteEasterEgg) throw new Error('Easter egg did not initialize.');
      spiraReady = true;
      window.SiteEasterEgg.open();
    }).catch(() => {
      assets.forEach(asset => asset.remove());
      dropAudio('__spiraAudioContext');
      if (footnote) footnote.title = 'Could not load. Click to try again.';
    }).finally(() => {
      spiraLoading = null;
      if (footnote) footnote.removeAttribute('aria-busy');
    });
  }

  // The footer is injected by the site shell, possibly after this runs: one delegated click
  // listener, and the password listener, once the page shows it has the site shell's footer.
  function bindSpira() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && target.closest(FOOTNOTE)) openSpira();
    });
    let sequence = '';
    let lastKeyAt = 0;
    document.addEventListener('keydown', event => {
      const target = event.target;
      if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
          target.closest?.(TYPING)) {
        sequence = '';
        return;
      }
      const now = performance.now();
      if (now - lastKeyAt > PASSWORD_GAP_MS) sequence = '';
      lastKeyAt = now;
      const key = event.key?.toLowerCase();
      sequence += key?.length === 1 ? key : '\0';
      while (sequence && !PASSWORD.startsWith(sequence)) sequence = sequence.slice(1);
      if (sequence === PASSWORD) { sequence = ''; openSpira(); }
    });
  }
  whenReady().then(() => { if (document.querySelector(SITE_FOOTER)) bindSpira(); });

  window.SiteLensesBoot = { version: VERSION, spiraVersion: SPIRA_VERSION, root: ROOT, loadCore, openSpira };
})();
