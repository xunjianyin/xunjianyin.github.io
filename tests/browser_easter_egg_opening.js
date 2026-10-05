/* Run with agent-browser eval --stdin on the local site. No network dependencies.
 * Covers opening lifecycle and its handoff to the existing interactive atlas.
 */
(async () => {
  const failures = []; let assertions = 0;
  const check = (value, label) => { assertions++; if (!value) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let i = 0; i < 340; i++) { if (predicate()) return; await delay(25); }
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
    const main = doc.querySelector('#main-content'); const originalMain = main.innerHTML;
    const focus = doc.querySelector('#theme-toggle'); focus.focus();
    win.scrollTo({ top: 380, behavior: 'instant' }); const scroll = win.scrollY;
    const theme = doc.documentElement.dataset.theme;
    doc.body.style.setProperty('overflow', 'auto', 'important');
    await start();
    check(phase() === 'gather' && !!modal().querySelector('.atlas-opening'), 'Discovery starts with the opening');
    check(sheet().inert && getComputedStyle(modal()).overflowY === 'hidden', 'Opening locks atlas input and modal scrolling');
    check(doc.activeElement.matches('[data-enter]'), 'Opening focuses the skip control');
    check(modal().querySelector('.atlas-opening').querySelectorAll('button').length === 2, 'Skip and close are the only opening controls');
    check(main.innerHTML === originalMain, 'Text capture leaves the live page unchanged');
    await dismiss();
    check(!pending.size && !doc.querySelector('.atlas-opening'), 'Early Escape cancels all frames and removes the opening');
    check(doc.activeElement === focus && win.scrollY === scroll, 'Early Escape restores focus and scroll');
    check(doc.body.style.getPropertyValue('overflow') === 'auto' && doc.body.style.getPropertyPriority('overflow') === 'important', 'Early Escape restores overflow priority');
    check(doc.documentElement.dataset.theme === theme, 'Opening never changes the page theme');

    await start(); await enter();
    check(!sheet().inert && modal().querySelectorAll('canvas').length === 1, 'Skip removes the opening canvas and enables the atlas');
    check(doc.activeElement.matches('[data-close]') && !pending.size, 'Skip hands off focus and leaves no idle animation');
    modal().querySelector('[data-thread="0"]').click(); modal().querySelector('[data-thread="3"]').click();
    const selectedQuestion = modal().querySelector('#atlas-question').textContent;
    check(selectedQuestion.includes('forgetting'), 'The original atlas interaction works after skipping');
    modal().querySelector('[data-replay]').click();
    check(phase() === 'gather' && sheet().inert, 'Replay restarts the opening');
    await until(() => phase() === 'burst'); await enter();
    check(modal().dataset.selection === '0-3' && modal().querySelector('#atlas-question').textContent === selectedQuestion, 'Replay and skip preserve the existing map selection');
    await dismiss();

    const began = performance.now(); await start();
    await until(() => phase() === 'burst');
    check(sheet().inert && modal().querySelector('.atlas-opening-canvas').width > 0, 'Burst phase is drawn while atlas controls stay inert');
    await until(() => phase() === 'settle');
    check(modal().querySelectorAll('canvas').length === 2, 'Settlement overlaps the opening with the actual atlas canvas');
    await until(() => phase() === 'atlas');
    const duration = performance.now() - began;
    check(duration >= 5000 && duration < 6700, 'Natural completion takes about five seconds');
    await delay(80);
    check(!sheet().inert && !modal().querySelector('.atlas-opening') && !pending.size, 'Natural completion removes the overlay and stops animation');
    check(main.innerHTML === originalMain, 'The full opening preserves the source page');

    modal().querySelector('[data-replay]').click();
    await until(() => phase() === 'burst');
    setReduced(true); await until(() => phase() === 'atlas'); await delay(80);
    check(!sheet().inert && !pending.size && modal().querySelector('[data-replay]').hidden, 'Enabling reduced motion mid-show enters the atlas immediately');
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

    await load('/blogs/agents-that-learn-after-deployment.html');
    win.scrollTo({ top: doc.body.scrollHeight, behavior: 'instant' });
    await start(); await until(() => phase() === 'burst'); await enter();
    check(modal().querySelector('[data-readout-link]').pathname === '/blogs/agents-that-learn-after-deployment.html', 'A nested-page footer launch reaches the same atlas');
    await dismiss(); check(!pending.size, 'Nested-page cleanup releases its frames');
  } catch (error) { failures.push(error.stack); }
  finally { frame.remove(); }
  return { assertions, failures };
})();
