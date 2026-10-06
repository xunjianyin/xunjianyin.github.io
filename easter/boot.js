/**
 * Lenses boot, on every page (loaded by site-shell.js, or by a paper page's <head>).
 *
 * - Triggers: a double-click or a double-tap on any [data-lens-trigger] (the homepage name,
 *   the footer name, a page's title) moves to the next lens. The core (easter/lenses.css and
 *   easter/lenses.js) loads on the first trigger.
 * - Arrival: the reader's lens follows them across the site. The <head> of every page marks
 *   html[data-lens-arriving] from sessionStorage before the first paint (the page stays
 *   hidden over the lens's ground); boot loads the core and calls SiteLenses.arrive(id).
 *   A page restored from the back/forward cache arrives again on pageshow.
 * - Sound starts only inside a trigger gesture; an arrival is silent.
 */
(() => {
  'use strict';
  if (window.SiteLensesBoot) return;

  const VERSION = 'lenses-v2';
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = new URL('../', SCRIPT_SRC).href;                 // easter/boot.js → the site root
  const LENS_ID = /^(stardust|tokens|blueprint|acta|lamplight)$/;
  const STORE_KEY = 'lenses-active';
  const ARRIVING = 'data-lens-arriving';
  const TRIGGER = '[data-lens-trigger]';
  // A double-click on a link or a control inside a trigger keeps its own meaning.
  const INTERACTIVE = 'a, button, input, select, textarea, summary, label, [contenteditable]:not([contenteditable="false"])';
  const DOUBLE_TAP_MS = 320;
  const DOUBLE_TAP_PX = 24;
  const TAP_DBLCLICK_GUARD_MS = 700;  // a double-tap may also synthesize a dblclick: count it once
  const FAILSAFE_MS = 2500;           // an arrival that takes longer shows the page as it is
  const FONTS_WAIT_MS = 800;          // an arrival waits this long at most for web fonts

  const html = document.documentElement;
  const storedLens = () => {
    try { const id = sessionStorage.getItem(STORE_KEY); return LENS_ID.test(id || '') ? id : null; } catch (error) { return null; }
  };
  const whenReady = () => new Promise(resolve => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    else resolve();
  });

  /* The core, loaded once ------------------------------------------------------ */
  let coreLoading = null;
  function loadCore() {
    if (window.SiteLenses) return Promise.resolve(window.SiteLenses);
    if (coreLoading) return coreLoading;
    const style = document.createElement('link');
    const script = document.createElement('script');
    style.rel = 'stylesheet';
    style.href = new URL(`easter/lenses.css?v=${VERSION}`, ROOT).href;
    script.src = new URL(`easter/lenses.js?v=${VERSION}`, ROOT).href;
    coreLoading = Promise.all([style, script].map(asset => new Promise((resolve, reject) => {
      asset.onload = resolve;
      asset.onerror = reject;
      document.head.append(asset);
    }))).then(() => {
      if (!window.SiteLenses) throw new Error('Lenses did not initialize.');
      return window.SiteLenses;
    }).catch(error => {
      // Leave nothing behind, so a later trigger can try again.
      script.remove();
      style.remove();
      coreLoading = null;
      throw error;
    });
    return coreLoading;
  }

  /* Triggers ------------------------------------------------------------------- */
  // The bell needs an AudioContext created inside the gesture; the core adopts it.
  function primeAudio() {
    try {
      if (window.SiteLenses || window.__lensesAudioContext || localStorage.getItem('spira-sound') === 'off') return;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const context = new Context();
      if (context.resume) context.resume().catch(() => {});
      window.__lensesAudioContext = context;
    } catch (error) { /* sound is optional */ }
  }

  function triggerLens(element, pointerType) {
    if (window.SiteLenses) { window.SiteLenses.next({ pointerType, trigger: element }); return; }
    primeAudio();
    loadCore().then(lenses => lenses.next({ pointerType, trigger: element }), () => {
      try { window.__lensesAudioContext?.close().catch(() => {}); } catch (error) { /* already closed */ }
      window.__lensesAudioContext = undefined;
    });
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

  /* Arrival -------------------------------------------------------------------- */
  let failsafe = 0;
  function arrive() {
    const id = storedLens();
    if (!id) { html.removeAttribute(ARRIVING); return; }
    html.setAttribute(ARRIVING, id);
    clearTimeout(failsafe);
    failsafe = setTimeout(() => { if (html.getAttribute(ARRIVING) === id) html.removeAttribute(ARRIVING); }, FAILSAFE_MS);
    const fonts = document.fonts && document.fonts.ready
      ? Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, FONTS_WAIT_MS))])
      : Promise.resolve();
    // The page's own scripts fill it on DOMContentLoaded; the lens arrives after them.
    Promise.all([loadCore(), whenReady().then(() => fonts)]).then(([lenses]) => {
      if (storedLens() !== id) { html.removeAttribute(ARRIVING); return null; }   // the reader left the lens meanwhile
      return lenses.arrive(id);
    }).catch(() => html.removeAttribute(ARRIVING)).finally(() => clearTimeout(failsafe));
  }
  if (html.hasAttribute(ARRIVING)) arrive();
  window.addEventListener('pageshow', event => { if (event.persisted) arrive(); });

  window.SiteLensesBoot = { version: VERSION, root: ROOT, loadCore };
})();
