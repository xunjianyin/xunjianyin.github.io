/* Run with agent-browser eval --stdin against the local site preview.
 * Exercises lazy loading and restoration on real pages, plus small-screen layouts.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let attempt = 0; attempt < 160; attempt++) {
      if (predicate()) return;
      await delay(25);
    }
    throw new Error('Timed out waiting for an easter egg state.');
  };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const storedTheme = localStorage.getItem('theme');
  let doc;
  let win;
  const load = async (path = '/') => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument;
    win = frame.contentWindow;
    await until(() => doc.querySelector('.easter-egg-footnote'));
  };
  const type = (text = 'yxjgogogo', target = doc.body, extra = {}) => {
    for (const key of text) target.dispatchEvent(new win.KeyboardEvent('keydown', {
      key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...extra
    }));
  };
  const garden = () => doc.querySelector('#secret-garden');
  const open = async () => { type(); await until(() => garden()?.open); };
  const close = async () => {
    garden().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    await until(() => !garden());
  };
  const assets = () => doc.querySelectorAll('script[src*="easter-egg.js"],link[href*="easter-egg.css"]');
  const names = ['Furong', 'Flora', 'Furong Jia', 'Flora Jia', 'Yeye'];

  try {
    await load();
    check(assets().length === 0, 'No easter egg JS or CSS loaded before discovery');
    type('yxjgogo');
    check(assets().length === 0, 'A partial password does not download assets');
    type('x');
    for (const tag of ['input', 'textarea', 'select', 'div']) {
      const control = doc.createElement(tag);
      if (tag === 'div') control.contentEditable = 'true';
      doc.body.append(control);
      type('yxjgogogo', control);
      control.remove();
    }
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { repeat: true }]) {
      type('yxjgogogo', doc.body, extra);
    }
    check(assets().length === 0, 'Typing, composition, repeated keys and modifier shortcuts are ignored');
    type('yxj'); await delay(1850); type('gogogo');
    check(assets().length === 0, 'A paused partial sequence expires');

    // An expanded publication and a dark theme must survive opening and closing.
    const disclosure = doc.querySelector('[aria-expanded="false"]');
    disclosure?.click();
    const focus = doc.querySelector('#theme-toggle');
    focus.focus();
    doc.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    doc.body.style.setProperty('overflow', 'auto', 'important');
    const main = doc.querySelector('#main-content');
    const before = main.innerHTML;
    win.scrollTo({ top: 410, behavior: 'instant' });
    const beforeScroll = win.scrollY;
    let pendingFrames = 0;
    const originalRAF = win.requestAnimationFrame.bind(win);
    const originalCancel = win.cancelAnimationFrame.bind(win);
    const pending = new Set();
    win.requestAnimationFrame = callback => {
      const id = originalRAF(time => { pending.delete(id); pendingFrames = pending.size; callback(time); });
      pending.add(id); pendingFrames = pending.size;
      return id;
    };
    win.cancelAnimationFrame = id => { pending.delete(id); pendingFrames = pending.size; originalCancel(id); };

    await open();
    check(assets().length === 2, 'The first complete password loads exactly one script and stylesheet');
    check(garden().matches(':modal'), 'The garden is a native modal; the background is inert');
    check(garden().contains(doc.activeElement), 'Focus moves inside the modal');
    check(main.innerHTML === before, 'Opening leaves publication text, disclosure state and styles intact');
    check(garden().querySelectorAll('.garden-seed').length === 5, 'Every original personal name has an interactive petal');
    await close();
    check(main.innerHTML === before, 'Early dismissal preserves the complete live page');
    check(doc.documentElement.dataset.theme === 'dark' && localStorage.getItem('theme') === 'dark', 'Dark theme and saved preference are preserved');
    check(doc.activeElement === focus, 'Dismissal restores the previously focused control');
    check(win.scrollY === beforeScroll, 'Dismissal restores the reading position');
    check(doc.body.style.getPropertyValue('overflow') === 'auto' && doc.body.style.getPropertyPriority('overflow') === 'important', 'Original body overflow value and priority are restored');
    check(pendingFrames === 0, 'Early dismissal cancels outstanding animation frames');
    await delay(100);
    check(!garden(), 'No delayed operation recreates the dismissed modal');

    await open();
    win.SiteEasterEgg.open();
    check(doc.querySelectorAll('#secret-garden').length === 1, 'Repeated triggers cannot stack dialogs');
    for (let i = 0; i < 5; i++) {
      garden().querySelector(`[data-petal="${i}"]`).click();
      check(garden().querySelector('[data-garden-name]').textContent === names[i], `Petal ${i + 1} reveals ${names[i]}`);
      check(garden().querySelectorAll('[aria-pressed="true"]').length === 1, 'Only the chosen petal is selected');
    }
    check(garden().querySelector('[role="status"]').textContent.includes('All five names discovered'), 'Discovering all names is announced');
    garden().querySelector('[data-garden-replay]').click();
    check(garden().querySelectorAll('[aria-pressed="true"]').length === 0, 'Replay clears prior selection');
    check(garden().querySelector('[data-garden-name]').textContent === 'Look a little closer.', 'Replay restores the opening note');
    await delay(6600);
    check(pendingFrames === 0, 'The completed drawing does not keep a continuous animation loop');
    check(garden().classList.contains('is-bloomed'), 'The finished flower exposes the five points');
    await close();
    check(assets().length === 2, 'Repeated visits reuse the loaded assets');
    check(main.innerHTML === before, 'Complete animation and replay preserve the original page');
    win.requestAnimationFrame = originalRAF;
    win.cancelAnimationFrame = originalCancel;

    // Emulate reduced motion while retaining a real MediaQueryList event target.
    const originalMedia = win.matchMedia.bind(win);
    win.matchMedia = query => {
      const result = originalMedia(query);
      if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
    doc.querySelector('.easter-egg-footnote').click();
    await until(() => garden()?.classList.contains('is-bloomed'));
    check(garden().open, 'The footer provides a password-free touch entry');
    garden().querySelector('[data-garden-replay]').click();
    await delay(60);
    check(garden().classList.contains('is-bloomed'), 'Reduced motion also skips the replay animation');

    for (const [width, height] of [[1440, 900], [768, 1024], [700, 800], [390, 844], [320, 568], [844, 390]]) {
      frame.style.width = `${width}px`; frame.style.height = `${height}px`;
      // Wait for ResizeObserver, not a fixed sleep that races under browser load.
      await until(() => {
        const rect = garden().querySelector('.garden-stage').getBoundingClientRect();
        const canvas = garden().querySelector('canvas');
        const dpr = Math.min(win.devicePixelRatio || 1, 2);
        return canvas.width === Math.round(rect.width * dpr) && canvas.height === Math.round(rect.height * dpr);
      });
      await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
      const modal = garden();
      check(modal.scrollWidth <= width + 1, `${width}×${height}: no horizontal overflow`);
      const stageRect = modal.querySelector('.garden-stage').getBoundingClientRect();
      const copy = modal.querySelector('.garden-copy').getBoundingClientRect();
      const note = modal.querySelector('.garden-note').getBoundingClientRect();
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      for (const seed of modal.querySelectorAll('.garden-seed')) {
        const rect = seed.getBoundingClientRect();
        check(rect.left >= -1 && rect.right <= width + 1, `${width}×${height}: ${seed.dataset.petal} touch target stays on screen`);
        check(rect.top >= stageRect.top && rect.bottom <= stageRect.bottom, `${width}×${height}: ${seed.dataset.petal} stays in drawing`);
        check(!overlaps(rect, copy) && !overlaps(rect, note), `${width}×${height}: ${seed.dataset.petal} does not overlap text`);
        check(rect.width >= 44 && rect.height >= 44, `${width}×${height}: ${seed.dataset.petal} has a usable touch target`);
      }
    }
    await close();
    win.matchMedia = originalMedia;

    // The shared shell is also used in nested articles, with relative assets.
    await load('/blogs/agents-that-learn-after-deployment.html');
    await open();
    check([...assets()].every(asset => new URL(asset.src || asset.href).pathname.startsWith('/easter-egg.')), 'Nested page loads assets from the website root');
    await close();

    // Simulate a single failed script download, then let the real assets load on retry.
    await load();
    const append = doc.head.append.bind(doc.head);
    let failOnce = true;
    doc.head.append = (...nodes) => {
      const script = nodes.find(node => node.tagName === 'SCRIPT' && node.src.includes('easter-egg.js'));
      if (script && failOnce) { failOnce = false; setTimeout(() => script.onerror(new win.Event('error')), 0); }
      else append(...nodes);
    };
    type();
    await delay(150);
    check(!garden() && assets().length === 0, 'Failed loading removes partial assets');
    doc.head.append = append;
    await open();
    check(garden().open, 'The next complete password retries after a download failure');
    garden().querySelector('[data-garden-close]').click();
    await until(() => !garden());
    check(!doc.body.style.overflow, 'Close button restores an originally absent overflow style');
  } catch (error) {
    failures.push(error.stack);
  } finally {
    frame.remove();
    if (storedTheme === null) localStorage.removeItem('theme');
    else localStorage.setItem('theme', storedTheme);
  }
  return { assertions, failures };
})();
