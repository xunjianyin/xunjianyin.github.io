/* Run with agent-browser eval --stdin against a local site preview.
 * Tests the research atlas, corpus coverage, and modal/loading restoration.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let i = 0; i < 240; i++) { if (predicate()) return; await delay(25); }
    throw new Error('Timed out waiting for the research atlas.');
  };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const storedTheme = localStorage.getItem('theme');
  let doc;
  let win;
  const load = async (path = '/') => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.querySelector('.easter-egg-footnote'));
  };
  const type = (text = 'yxjgogogo', target = doc.body, extra = {}) => {
    for (const key of text) target.dispatchEvent(new win.KeyboardEvent('keydown', {
      key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...extra
    }));
  };
  const atlas = () => doc.querySelector('#research-atlas');
  const stage = () => atlas().querySelector('.atlas-stage');
  const threads = () => [...atlas().querySelectorAll('[data-thread]')];
  const reset = () => atlas().querySelector('[data-reset]').click();
  const question = () => atlas().querySelector('#atlas-question').textContent;
  const workLinks = () => [...atlas().querySelectorAll('.atlas-work-list a')];
  const open = async () => { type(); await until(() => atlas()?.open); };
  const close = async () => { atlas().dispatchEvent(new win.Event('cancel', { cancelable: true })); await until(() => !atlas()); };
  const assets = () => doc.querySelectorAll('script[src*="easter-egg.js"],link[href*="easter-egg.css"]');
  const nextPaint = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  const reducedMotion = () => {
    const original = win.matchMedia.bind(win);
    win.matchMedia = query => {
      const result = original(query);
      if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
  };
  try {
    await load();
    check(assets().length === 0, 'No atlas assets load before discovery');
    type('yxjgogo'); check(assets().length === 0, 'Partial password does not download assets'); type('x');
    for (const tag of ['input', 'textarea', 'select', 'div']) {
      const control = doc.createElement(tag); if (tag === 'div') control.contentEditable = 'true';
      doc.body.append(control); type('yxjgogogo', control); control.remove();
    }
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { repeat: true }]) type('yxjgogogo', doc.body, extra);
    check(assets().length === 0, 'Editable fields, composition, repeated keys and modifier shortcuts are ignored');
    type('yxj'); await delay(1850); type('gogogo'); check(assets().length === 0, 'An old partial sequence expires');

    doc.querySelector('[aria-expanded="false"]')?.click();
    const focus = doc.querySelector('#theme-toggle'); focus.focus();
    doc.documentElement.dataset.theme = 'dark'; localStorage.setItem('theme', 'dark');
    doc.body.style.setProperty('overflow', 'auto', 'important');
    const main = doc.querySelector('#main-content'); const before = main.innerHTML;
    win.scrollTo({ top: 410, behavior: 'instant' }); const beforeScroll = win.scrollY;
    const pending = new Set();
    const originalRAF = win.requestAnimationFrame.bind(win); const originalCancel = win.cancelAnimationFrame.bind(win);
    win.requestAnimationFrame = callback => { const id = originalRAF(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    win.cancelAnimationFrame = id => { pending.delete(id); originalCancel(id); };
    await open();
    check(assets().length === 2, 'First complete password loads the script and stylesheet once');
    check(atlas().matches(':modal'), 'Native modal prevents interaction with the background');
    check(atlas().contains(doc.activeElement), 'Opening focuses a modal control');
    check(main.innerHTML === before, 'Opening does not rewrite the live page');
    check(!/flora|furong|yeye|petal|serendipity/i.test(atlas().textContent), 'Unrelated botanical names are absent');
    await close();
    check(main.innerHTML === before, 'Early dismissal preserves text, styles and disclosure state');
    check(doc.documentElement.dataset.theme === 'dark' && localStorage.getItem('theme') === 'dark', 'Dark theme and saved preference survive');
    check(doc.activeElement === focus && win.scrollY === beforeScroll, 'Focus and reading position are restored');
    check(doc.body.style.getPropertyValue('overflow') === 'auto' && doc.body.style.getPropertyPriority('overflow') === 'important', 'Original body overflow and priority are restored');
    check(pending.size === 0, 'Early dismissal cancels all animation frames');

    await open(); win.SiteEasterEgg.open();
    check(doc.querySelectorAll('#research-atlas').length === 1, 'Repeated triggers cannot stack dialogs');
    await delay(2000);
    check(pending.size === 0, 'The introduction stops scheduling frames when settled');
    const metadata = await (await fetch('/papers/content/metadata.json')).json();
    const allLinks = workLinks();
    const slugs = allLinks.map(a => a.pathname.split('/').pop().replace('.html', ''));
    check(slugs.length === 23 && new Set(slugs).size === 23, 'Each of the 23 papers appears exactly once');
    check(JSON.stringify([...slugs].sort()) === JSON.stringify(Object.keys(metadata).sort()), 'The atlas covers the complete local paper corpus');
    const pageResults = await Promise.all(allLinks.map(async a => {
      const response = await fetch(a.href);
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const normalize = text => text.replace(/\s+/g, ' ').trim();
      return response.ok && normalize(page.querySelector('h1')?.textContent || '') === normalize(a.textContent);
    }));
    check(pageResults.every(Boolean), 'Every paper link resolves and its title matches the linked page');
    check(threads().length === 5 && atlas().querySelectorAll('.atlas-work-list section').length === 5, 'Five research threads cover the work');
    check(atlas().querySelector('[data-readout-link]').pathname === '/blogs/agents-that-learn-after-deployment.html', 'The broader research direction is linked');
    const questions = new Set();
    const counts = [4, 4, 7, 3, 5];
    for (let a = 0; a < 5; a++) {
      reset(); threads()[a].click();
      check(workLinks().length === counts[a] && threads()[a].getAttribute('aria-pressed') === 'true', `Thread ${a}: matching papers and pressed state`);
      for (let b = a + 1; b < 5; b++) {
        reset(); threads()[a].click(); threads()[b].click();
        questions.add(question());
        check(atlas().dataset.selection === `${a}-${b}` && atlas().querySelector('[data-readout-label]').textContent.startsWith('Open question'), `Pair ${a}-${b}: explicitly framed as an open question`);
        check(workLinks().length === counts[a] + counts[b], `Pair ${a}-${b}: the two paper groups are available`);
      }
    }
    check(questions.size === 10, 'Every pair offers its own research question');
    reset(); threads()[0].click(); threads()[3].click(); threads()[4].click();
    check(atlas().dataset.selection === '3-4' && threads().filter(b => b.getAttribute('aria-pressed') === 'true').length === 2, 'Choosing a third thread retains only the latest two');
    threads()[3].click(); check(atlas().dataset.selection === '4', 'A selected thread can be deselected');
    atlas().querySelector('[data-readout-link]').click();
    const details = atlas().querySelector('#atlas-works');
    check(details.open && doc.activeElement === details.querySelector('summary'), 'Explore papers opens the disclosure and moves keyboard focus');
    details.open = false; atlas().scrollTop = 0;
    threads()[1].click(); atlas().querySelector('[data-horizon]').click();
    check(atlas().classList.contains('is-frontier') && atlas().querySelector('[data-horizon]').getAttribute('aria-pressed') === 'true', 'Step back opens the wider horizon');
    check(question().includes('lifetime') && atlas().querySelector('[data-readout-text]').textContent.includes('open research direction'), 'The future agenda is distinct from existing results');
    check(atlas().dataset.selection === '4-1' && atlas().querySelector('[data-readout-link]').pathname.startsWith('/blogs/'), 'Step back reveals the larger agenda even when a pair is selected');
    await delay(1100); check(pending.size === 0, 'The horizon transition also settles without an idle loop');
    reset(); await delay(1100);
    check(!atlas().classList.contains('is-frontier') && !atlas().dataset.selection && workLinks().length === 23, 'Reset clears selection, horizon, and paper filters');
    const imageBefore = atlas().querySelector('canvas').toDataURL();
    stage().focus(); stage().dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await nextPaint();
    check(atlas().querySelector('canvas').toDataURL() !== imageBefore, 'Arrow keys rotate the rendered map');
    await delay(80); check(pending.size === 0, 'Keyboard rotation stops after drawing');
    await close(); check(main.innerHTML === before && assets().length === 2, 'Exploration preserves the source page and reuses assets');
    win.requestAnimationFrame = originalRAF; win.cancelAnimationFrame = originalCancel;

    reducedMotion(); doc.querySelector('.easter-egg-footnote').click(); await until(() => atlas()?.open); await nextPaint();
    check(atlas().open, 'Touch entry does not require the password');
    threads()[1].click(); threads()[4].click(); await nextPaint();
    check(question().includes('actions') && atlas().classList.contains('has-pair'), 'Reduced motion retains the paired-question interaction');
    for (const [width, height] of [[1440, 900], [768, 1024], [700, 800], [390, 844], [320, 568], [844, 390]]) {
      frame.style.width = `${width}px`; frame.style.height = `${height}px`;
      await until(() => Math.abs(atlas().querySelector('canvas').width - stage().getBoundingClientRect().width * Math.min(win.devicePixelRatio, 2)) < 1);
      await nextPaint();
      check(atlas().scrollWidth <= width + 1, `${width}×${height}: no horizontal overflow`);
      const s = stage().getBoundingClientRect();
      const rectangles = threads().map(b => b.getBoundingClientRect());
      check(rectangles.every(r => r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top && r.bottom <= s.bottom + 1), `${width}×${height}: all thread controls stay in the scene`);
      check(rectangles.every(r => r.width >= 44 && r.height >= 44), `${width}×${height}: touch targets meet 44px`);
      const overlap = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      check(!rectangles.some((a,i) => rectangles.some((b,j) => i < j && overlap(a,b))), `${width}×${height}: thread controls do not overlap`);
      const label = atlas().querySelector('.atlas-frontier-label').getBoundingClientRect();
      check(!rectangles.some(r => overlap(r,label)), `${width}×${height}: the open-question label is not covered`);
    }
    await close();
    await load('/blogs/agents-that-learn-after-deployment.html'); reducedMotion(); await open();
    check([...assets()].every(asset => new URL(asset.src || asset.href).pathname.startsWith('/easter-egg.')), 'Nested articles load the assets from the site root');
    check(workLinks().every(a => a.pathname.startsWith('/papers/')) && atlas().querySelector('[data-readout-link]').pathname.startsWith('/blogs/'), 'Paper and research-direction links resolve from nested articles');
    await close();

    await load();
    const append = doc.head.append.bind(doc.head); let failOnce = true;
    doc.head.append = (...nodes) => {
      const script = nodes.find(node => node.tagName === 'SCRIPT' && node.src.includes('easter-egg.js'));
      if (script && failOnce) { failOnce = false; setTimeout(() => script.onerror(new win.Event('error')), 0); }
      else append(...nodes);
    };
    type(); await delay(150);
    check(!atlas() && assets().length === 0, 'Download failure removes partial assets');
    doc.head.append = append; reducedMotion(); await open();
    check(atlas().open, 'A failed download can be retried');
    atlas().querySelector('[data-close]').click(); await until(() => !atlas());
    check(!doc.body.style.overflow, 'The close button restores an originally absent overflow style');
  } catch (error) { failures.push(error.stack); }
  finally { frame.remove(); if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme); }
  return { assertions, failures };
})();
