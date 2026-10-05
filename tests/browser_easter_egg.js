/* Run with agent-browser eval --stdin against the local site preview.
 * Checks the puzzle's causal behavior as well as modal/loading restoration.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let i = 0; i < 240; i++) { if (predicate()) return; await delay(25); }
    throw new Error('Timed out waiting for the self-reference experiment.');
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
  const lab = () => doc.querySelector('#self-reference-lab');
  const scene = () => lab().querySelector('.lab-scene');
  const state = () => scene().dataset.state;
  const rule = () => lab().querySelector('[data-rule]');
  const agentX = () => Number(lab().querySelector('[data-agent]').getAttribute('transform').match(/translate\(([^,]+)/)[1]);
  const open = async () => { type(); await until(() => lab()?.open); };
  const close = async () => { lab().dispatchEvent(new win.Event('cancel', { cancelable: true })); await until(() => !lab()); };
  const press = (key, extra = {}) => rule().dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
  const assets = () => doc.querySelectorAll('script[src*="easter-egg.js"],link[href*="easter-egg.css"]');
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
    check(assets().length === 0, 'No puzzle assets load before discovery');
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
    check(lab().matches(':modal'), 'Native modal prevents interaction with the background');
    check(lab().contains(doc.activeElement), 'Opening focuses a modal control');
    check(main.innerHTML === before, 'Opening does not rewrite the live page');
    check(lab().textContent.includes('Gödel Agent') && lab().querySelector('a').pathname === '/papers/godel-agent.html', 'The idea links to the author’s real Gödel Agent paper');
    check(!/flora|furong|yeye|petal|serendipity/i.test(lab().textContent), 'The unrelated botanical/name concept is gone');
    await close();
    check(main.innerHTML === before, 'Early dismissal preserves text, styles and disclosure state');
    check(doc.documentElement.dataset.theme === 'dark' && localStorage.getItem('theme') === 'dark', 'Dark theme and saved preference survive');
    check(doc.activeElement === focus && win.scrollY === beforeScroll, 'Focus and reading position are restored');
    check(doc.body.style.getPropertyValue('overflow') === 'auto' && doc.body.style.getPropertyPriority('overflow') === 'important', 'Original body overflow and priority are restored');
    check(pending.size === 0, 'Early dismissal cancels all animation frames');

    await open(); win.SiteEasterEgg.open();
    check(doc.querySelectorAll('#self-reference-lab').length === 1, 'Repeated triggers cannot stack dialogs');
    await until(() => state() === 'blocked');
    const stoppedAt = agentX(); await delay(120);
    check(agentX() === stoppedAt && pending.size === 0, 'Without a bridge the agent stops, with no idle animation loop');
    check(lab().querySelector('[data-revised]').disabled, 'A revised policy cannot run before the visitor makes an edit');
    const firstPosition = rule().getBoundingClientRect(); press('ArrowDown');
    check(rule().getBoundingClientRect().top > firstPosition.top, 'Arrow keys move the instruction');
    press('Enter');
    await until(() => state() === 'solved');
    const placed = rule().getBoundingClientRect(); const gap = lab().querySelector('.lab-drop-zone').getBoundingClientRect();
    check(Math.abs(placed.x - gap.x) < 1 && Math.abs(placed.y - gap.y) < 1, 'The instruction physically occupies the bridge position');
    check(agentX() > stoppedAt + 100, 'The agent crosses only after a bridge exists');
    check(rule().textContent.includes('Build a way. Then walk.'), 'Success changes the instruction');
    check(!lab().querySelector('[data-revised]').disabled, 'The changed instruction can be executed');
    check(lab().querySelector('[data-message]').textContent.includes('You changed'), 'The puzzle credits the visitor’s edit');
    const oldX = agentX(); press('ArrowLeft');
    check(Math.abs(rule().getBoundingClientRect().x - placed.x) < 1 && agentX() === oldX, 'A completed bridge cannot be removed beneath the agent');

    lab().querySelector('[data-revised]').focus();
    lab().querySelector('[data-revised]').click();
    check(doc.activeElement === lab().querySelector('[data-revised]'), 'Starting the revised run preserves keyboard focus');
    check(state() === 'building' && !lab().classList.contains('has-bridge'), 'The revised run resets the physical scene and builds first');
    const startX = agentX(); const startRuleY = rule().getBoundingClientRect().y;
    await delay(250);
    check(agentX() === startX && rule().getBoundingClientRect().y > startRuleY + 5, 'The revised rule moves itself while the agent waits');
    await until(() => state() === 'solved');
    check(lab().querySelector('[data-agent-version]').textContent === 'v2', 'The new run visibly uses the revised policy');
    check(lab().querySelector('[data-message]').textContent.includes('before taking the first step'), 'The second-run result explains the changed order of actions');
    await delay(80); check(pending.size === 0, 'Solved state stops scheduling animation frames');
    lab().querySelector('[data-reset]').click();
    check(!lab().classList.contains('has-bridge') && rule().textContent.includes('Walk to the paper.'), 'Start over removes the bridge and resets the original rule');
    check(lab().querySelector('[data-agent-version]').textContent === 'v1' && lab().querySelector('[data-revised]').disabled, 'Start over clears the revised policy');
    await close(); check(main.innerHTML === before && assets().length === 2, 'Both runs preserve the source page and reuse assets');
    win.requestAnimationFrame = originalRAF; win.cancelAnimationFrame = originalCancel;

    reducedMotion(); doc.querySelector('.easter-egg-footnote').click(); await until(() => state() === 'blocked');
    check(lab().open, 'Touch entry does not require the password');
    press('Enter'); await until(() => state() === 'solved');
    lab().querySelector('[data-revised]').click(); await until(() => state() === 'solved');
    check(lab().querySelector('[data-agent-version]').textContent === 'v2', 'Reduced motion retains the complete puzzle and revised behavior');
    for (const [width, height] of [[1440, 900], [768, 1024], [700, 800], [390, 844], [320, 568], [844, 390]]) {
      frame.style.width = `${width}px`; frame.style.height = `${height}px`;
      await until(() => Math.abs(scene().getBoundingClientRect().width - scene().querySelector('svg').viewBox.baseVal.width) < 1);
      await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
      check(lab().scrollWidth <= width + 1, `${width}×${height}: no horizontal overflow`);
      const s = scene().getBoundingClientRect(); const r = rule().getBoundingClientRect();
      check(r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom, `${width}×${height}: bridge stays in scene after resizing`);
      check(r.width >= 44 && r.height >= 44, `${width}×${height}: instruction has a usable touch target`);
      const a = lab().querySelector('[data-agent]').getBoundingClientRect();
      check(a.left >= s.left && a.right <= s.right, `${width}×${height}: the agent stays visible`);
      const z = lab().querySelector('.lab-drop-zone').getBoundingClientRect();
      check(Math.abs(r.x-z.x)<1 && Math.abs(r.y-z.y)<1, `${width}×${height}: the installed bridge remains aligned`);
    }
    await close();
    await load('/blogs/agents-that-learn-after-deployment.html'); reducedMotion(); await open();
    check([...assets()].every(asset => new URL(asset.src || asset.href).pathname.startsWith('/easter-egg.')), 'Nested articles load the assets from the site root');
    check(lab().querySelector('a').pathname === '/papers/godel-agent.html', 'The paper link also resolves from nested articles');
    await close();

    await load();
    const append = doc.head.append.bind(doc.head); let failOnce = true;
    doc.head.append = (...nodes) => {
      const script = nodes.find(node => node.tagName === 'SCRIPT' && node.src.includes('easter-egg.js'));
      if (script && failOnce) { failOnce = false; setTimeout(() => script.onerror(new win.Event('error')), 0); }
      else append(...nodes);
    };
    type(); await delay(150);
    check(!lab() && assets().length === 0, 'Download failure removes partial assets');
    doc.head.append = append; reducedMotion(); await open();
    check(lab().open, 'A failed download can be retried');
    lab().querySelector('[data-lab-close]').click(); await until(() => !lab());
    check(!doc.body.style.overflow, 'The close button restores an originally absent overflow style');
  } catch (error) { failures.push(error.stack); }
  finally { frame.remove(); if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme); }
  return { assertions, failures };
})();
