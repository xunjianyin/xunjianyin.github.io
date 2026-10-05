/* Run with agent-browser eval --stdin on the local site. No network dependencies.
 * Covers opening lifecycle and its handoff to the existing interactive atlas.
 */
(async () => {
  const failures = []; let assertions = 0;
  const check = (value, label) => { assertions++; if (!value) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let i = 0; i < 520; i++) { if (predicate()) return; await delay(25); }
    throw new Error('Opening did not reach its expected state.');
  };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  let win; let doc; let reduced = false; let queries = [];
  const pending = new Set(); let originalRAF; let originalCancel;
  const load = async (path = '/') => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    win = frame.contentWindow; doc = frame.contentDocument;
    await until(() => doc.querySelector('.easter-egg-footnote'));
    const match = win.matchMedia.bind(win); queries = [];
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') {
        Object.defineProperty(result, 'matches', { get: () => reduced }); queries.push(result);
      }
      return result;
    };
    originalRAF = win.requestAnimationFrame.bind(win); originalCancel = win.cancelAnimationFrame.bind(win);
    win.requestAnimationFrame = callback => {
      const id = originalRAF(time => { pending.delete(id); callback(time); }); pending.add(id); return id;
    };
    win.cancelAnimationFrame = id => { pending.delete(id); originalCancel(id); };
  };
  const modal = () => doc.querySelector('#research-atlas');
  const sheet = () => modal().querySelector('.atlas-sheet');
  const phase = () => modal()?.dataset.phase;
  const start = async () => { doc.querySelector('.easter-egg-footnote').click(); await until(() => modal()?.open); };
  const enter = async () => { modal().querySelector('[data-enter]').click(); await until(() => phase() === 'atlas'); await delay(60); };
  const dismiss = async () => { modal().dispatchEvent(new win.Event('cancel', { cancelable: true })); await until(() => !modal()); };
  const setReduced = value => { reduced = value; queries.forEach(query => query.dispatchEvent(new win.Event('change'))); };
  try {
    await load();
    const main = doc.querySelector('#main-content'); const originalMain = main.innerHTML; const originalText = main.textContent;
    const identityWalker = doc.createTreeWalker(main, win.NodeFilter.SHOW_TEXT); const originalNodes = [];
    while (identityWalker.nextNode()) originalNodes.push(identityWalker.currentNode);
    const originalLinks = [...main.querySelectorAll('a')];
    const identitiesIntact = () => originalNodes.every(node => node.isConnected && main.contains(node)) && originalLinks.every(node => node.isConnected && main.contains(node));
    const focus = doc.querySelector('#theme-toggle'); focus.focus();
    win.scrollTo({ top: 380, behavior: 'instant' }); const scroll = win.scrollY;
    const theme = doc.documentElement.dataset.theme;
    doc.body.style.setProperty('overflow', 'auto', 'important');
    await start();
    check(phase() === 'gather' && !!modal().querySelector('.atlas-opening'), 'Discovery starts with the opening');
    check(sheet().inert && getComputedStyle(modal()).overflowY === 'hidden', 'Opening locks atlas input and modal scrolling');
    check(doc.activeElement.matches('[data-enter]'), 'Opening focuses the skip control');
    check(modal().querySelector('.atlas-opening').querySelectorAll('button').length === 2, 'Skip and close are the only opening controls');
    check(main.textContent === originalText && identitiesIntact(), 'Lifting preserves actual text and existing node identities');
    const lifted = [...modal().querySelectorAll('.atlas-lift-word')];
    check(lifted.length > 40 && doc.querySelectorAll('[data-atlas-source]').length > 0, 'Visible homepage words are lifted from their real source nodes');
    const first = lifted.find(word => word.textContent.length > 5); const initialBox = first.getBoundingClientRect();
    const initialSize = parseFloat(win.getComputedStyle(first).fontSize);
    check(Number(win.getComputedStyle(first).opacity) === 1 && initialSize >= 12, 'Words begin at readable size and full opacity');
    await delay(1900);
    const movedBox = first.getBoundingClientRect();
    check(Math.hypot(movedBox.x - initialBox.x, movedBox.y - initialBox.y) > 15 && phase() === 'gather', 'The actual words visibly travel while the gathering phase continues');
    check(parseFloat(win.getComputedStyle(first).fontSize) === initialSize && Number(win.getComputedStyle(first).opacity) > .95, 'Words remain readable through the early gathering');
    await dismiss();
    check(!pending.size && !doc.querySelector('.atlas-opening'), 'Early Escape cancels all frames and removes the opening');
    check(doc.activeElement === focus && win.scrollY === scroll, 'Early Escape restores focus and scroll');
    check(doc.body.style.getPropertyValue('overflow') === 'auto' && doc.body.style.getPropertyPriority('overflow') === 'important', 'Early Escape restores overflow priority');
    check(doc.documentElement.dataset.theme === theme, 'Opening never changes the page theme');
    check(main.innerHTML === originalMain && identitiesIntact() && !doc.querySelector('[data-atlas-source]'), 'Early Escape restores exact markup and original Text/link nodes');

    await start(); await enter();
    check(!sheet().inert && !modal().querySelector('.atlas-opening-canvas') && !!modal().querySelector('.atlas-stage canvas'), 'Skip removes the opening canvas and enables the atlas');
    check(doc.activeElement.matches('[data-close]') && !pending.size, 'Skip hands off focus and leaves no idle animation');
    check(main.innerHTML === originalMain && identitiesIntact(), 'Skip restores original text, links and node identities');
    check(win.getComputedStyle(modal()).backgroundColor === 'rgb(7, 15, 27)' && !!modal().querySelector('.atlas-sky'), 'The destination is a dark atlas with its own starfield');
    modal().querySelector('[data-thread="0"]').click(); modal().querySelector('[data-thread="3"]').click();
    const selectedQuestion = modal().querySelector('#atlas-question').textContent;
    check(selectedQuestion.includes('forgetting'), 'The original atlas interaction works after skipping');
    modal().querySelector('[data-replay]').click();
    check(phase() === 'gather' && sheet().inert, 'Replay restarts the opening');
    check([...main.querySelectorAll('[data-atlas-source]')].length > 0 && !sheet().querySelector('[data-atlas-source]'), 'Replay gathers the original page text, not the atlas footer');
    check([...modal().querySelectorAll('.atlas-lift-word')].every(word => {
      const r = word.getBoundingClientRect(); return r.bottom >= 0 && r.top <= win.innerHeight;
    }), 'Replay word origins remain in the visible viewport');
    await until(() => phase() === 'burst'); await enter();
    check(modal().dataset.selection === '0-3' && modal().querySelector('#atlas-question').textContent === selectedQuestion, 'Replay and skip preserve the existing map selection');
    await dismiss();

    const began = performance.now(); await start();
    await until(() => phase() === 'burst');
    check(sheet().inert && modal().querySelector('.atlas-opening-canvas').width > 0, 'Burst phase is drawn while atlas controls stay inert');
    await until(() => phase() === 'settle');
    check(!!modal().querySelector('.atlas-stage canvas') && !!modal().querySelector('.atlas-opening-canvas'), 'Settlement overlaps the opening with the actual atlas canvas');
    await until(() => Number(modal().style.getPropertyValue('--atlas-reveal')) > .4);
    check(win.getComputedStyle(modal()).backgroundColor === 'rgb(7, 15, 27)', 'Settlement keeps an opaque dark background without revealing the restored homepage');
    await until(() => phase() === 'atlas');
    const duration = performance.now() - began;
    check(duration >= 9000 && duration < 11000, 'Natural completion includes the longer gathering at about nine seconds');
    await delay(80);
    check(!sheet().inert && !modal().querySelector('.atlas-opening') && !pending.size, 'Natural completion removes the overlay and stops animation');
    check(main.innerHTML === originalMain && identitiesIntact(), 'The full opening restores the exact original page and node identities');

    modal().querySelector('[data-replay]').click();
    await until(() => phase() === 'burst');
    setReduced(true); await until(() => phase() === 'atlas'); await delay(80);
    check(!sheet().inert && !pending.size && modal().querySelector('[data-replay]').hidden, 'Enabling reduced motion mid-show enters the atlas immediately');
    check(!doc.querySelector('[data-atlas-source]'), 'Reduced-motion handoff restores all lifted text');
    await dismiss(); await start();
    check(phase() === 'atlas' && !modal().querySelector('.atlas-opening'), 'Reduced motion bypasses the opening on discovery');
    await delay(80); check(!pending.size, 'Reduced-motion entry does not start a hidden animation loop');
    await dismiss(); setReduced(false);

    // Resizing while sparks are moving must keep both coordinate systems current.
    await start(); await until(() => phase() === 'burst');
    for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
      frame.style.width = `${width}px`; frame.style.height = `${height}px`; await delay(80);
      const canvas = modal().querySelector('.atlas-opening-canvas');
      check(canvas.width === Math.round(width * Math.min(win.devicePixelRatio, 2)) && canvas.height === Math.round(height * Math.min(win.devicePixelRatio, 2)), `${width}×${height}: the opening resizes to the viewport`);
      check(modal().scrollWidth <= width + 1 && modal().scrollTop === 0, `${width}×${height}: no scroll or horizontal overflow during opening`);
      const buttons = [...modal().querySelectorAll('.atlas-opening button')].map(button => button.getBoundingClientRect());
      check(buttons.every(r => r.left >= 0 && r.right <= width && r.height >= 44), `${width}×${height}: skip and close stay usable`);
    }
    await enter(); await dismiss();

    // A real line wrap must produce separate moving fragments at the original glyph positions.
    frame.style.width = '390px'; frame.style.height = '844px'; await delay(80);
    const wrapped = doc.createElement('p'); wrapped.textContent = 'self-referential';
    wrapped.style.cssText = 'position:fixed;left:12px;top:100px;width:90px;font:16px/24px Arial;white-space:normal;hyphens:none;margin:0';
    main.prepend(wrapped);
    const sourceRange = doc.createRange(); sourceRange.selectNodeContents(wrapped);
    const originalLines = [...sourceRange.getClientRects()];
    await start();
    const lineWords = [...modal().querySelectorAll('.atlas-lift-word')].filter(word => ['self-', 'referential'].includes(word.textContent));
    check(originalLines.length === 2 && lineWords.length === 2, 'A hyphenated word spanning two lines is lifted as two fragments');
    check(lineWords.every((word, i) => {
      const r = word.getBoundingClientRect(); const source = originalLines[i];
      return source && Math.abs(r.left - source.left) < 1 && Math.abs(r.top - source.top) < 1 && r.height < 24;
    }), 'Wrapped fragments start at their actual line positions without a tall bounding box');
    await dismiss(); wrapped.remove();

    // Switching away pauses active time; returning cannot leap across the show.
    frame.style.width = '1280px'; frame.style.height = '900px';
    await start();
    Object.defineProperty(doc, 'hidden', { configurable: true, value: true });
    doc.dispatchEvent(new win.Event('visibilitychange'));
    await delay(150); check(!pending.size && phase() === 'gather', 'Hidden documents pause all opening frames');
    delete doc.hidden; doc.dispatchEvent(new win.Event('visibilitychange')); await delay(80);
    check(phase() === 'gather' && pending.size > 0, 'Returning resumes the current phase without a time jump');
    modal().querySelector('[data-opening-close]').click(); await until(() => !modal());
    check(!pending.size, 'The opening close button also releases every frame');

    const originalContext = win.HTMLCanvasElement.prototype.getContext;
    win.HTMLCanvasElement.prototype.getContext = function (...args) {
      return this.classList.contains('atlas-opening-canvas') ? null : originalContext.apply(this, args);
    };
    await start(); await delay(80);
    check(phase() === 'atlas' && !sheet().inert && !modal().querySelector('.atlas-opening'), 'A missing opening context falls back to the atlas');
    win.HTMLCanvasElement.prototype.getContext = originalContext;
    await dismiss();

    // Constructor failures can happen after originals have been hidden.
    const measure = win.Range.prototype.getBoundingClientRect;
    win.Range.prototype.getBoundingClientRect = function () {
      if (doc.querySelector('[data-atlas-source]')) {
        win.Range.prototype.getBoundingClientRect = measure;
        throw new Error('Injected measurement failure after text lifting');
      }
      return measure.call(this);
    };
    await start(); await delay(80);
    check(phase() === 'atlas' && main.innerHTML === originalMain && identitiesIntact(), 'A constructor failure restores every original text node before entering the atlas');
    win.Range.prototype.getBoundingClientRect = measure;
    const skyBefore = modal().querySelector('.atlas-sky').toDataURL();
    modal().dispatchEvent(new win.PointerEvent('pointermove', { pointerType: 'mouse', clientX: 1000, clientY: 220, bubbles: true }));
    await delay(1250);
    check(modal().querySelector('.atlas-sky').toDataURL() !== skyBefore && !pending.size, 'Starfield parallax reacts to the pointer and stops drawing at rest');
    setReduced(true); await delay(100);
    const stillSky = modal().querySelector('.atlas-sky').toDataURL();
    modal().dispatchEvent(new win.PointerEvent('pointermove', { pointerType: 'mouse', clientX: 200, clientY: 660, bubbles: true }));
    await delay(100);
    check(modal().querySelector('.atlas-sky').toDataURL() === stillSky && !pending.size, 'Reduced motion disables background parallax');
    await dismiss(); setReduced(false);

    await load('/blogs/agents-that-learn-after-deployment.html');
    win.scrollTo({ top: doc.body.scrollHeight, behavior: 'instant' });
    await start(); await until(() => phase() === 'burst'); await enter();
    check(modal().querySelector('[data-readout-link]').pathname === '/blogs/agents-that-learn-after-deployment.html', 'A nested-page footer launch reaches the same atlas');
    await dismiss(); check(!pending.size, 'Nested-page cleanup releases its frames');
  } catch (error) { failures.push(error.stack); }
  finally { frame.remove(); }
  return { assertions, failures };
})();
