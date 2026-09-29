/* Run against the local preview with agent-browser eval --stdin.
 * Checks explanatory behavior, not just the existence of clickable controls.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html`; });
    return frame.contentDocument;
  };
  const click = (root, value) => root.querySelector(`[data-demo-action="${value}"]`).click();
  const range = (root, selector, value) => {
    const el = root.querySelector(selector); el.value = value;
    el.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
  };

  let doc;
  let root;
  doc = await load('context-aware-evaluation'); root = doc.querySelector('[data-paper-demo]');
  click(root, 'previous');
  check(![...root.querySelectorAll('.eval-context-row.is-selected')].some(el => el.querySelector('.eval-position').textContent.startsWith('+')), 'Cont-COMET excludes following sentences');
  click(root, 'both'); range(root, '[data-demo-range="decay"]', 100);
  check([...root.querySelectorAll('.eval-context-row.is-selected')].some(el => el.querySelector('.eval-position').textContent === '−3'), 'Cont-COMET distant evidence competes without decay');

  doc = await load('godel-agent'); root = doc.querySelector('[data-paper-demo]');
  const input = root.querySelector('#godel-numbers');
  const solve = value => { input.value = value; root.querySelector('form').dispatchEvent(new frame.contentWindow.Event('submit', { bubbles: true, cancelable: true })); };
  for (const [numbers, expression] of [['3,3,8,8', '8 ÷ (3 − (8 ÷ 3)) = 24'], ['1,3,4,6', '6 ÷ (1 − (3 ÷ 4)) = 24']]) {
    solve(numbers);
    check(root.querySelector('.godel-expression').textContent === expression, `Godel computes exact solution for ${numbers}`);
    check(root.querySelector('.godel-arithmetic').children.length === 3, 'Godel displays all three arithmetic operations');
    check(root.querySelector('.godel-arithmetic li:last-child').textContent.includes(' = 24'), 'Godel operation trace reaches24');
  }
  solve('1,1,1,1');
  check(root.querySelector('[data-demo-state]').dataset.outcome === 'unsolved' && root.querySelector('.godel-arithmetic').children.length === 0, 'Godel impossible input has no fabricated solution');
  for (const invalid of ['1,2,3', '1,2,3,14', '1,2,3,0', '1,2,3,4.5', 'alert(1)']) {
    solve(invalid);
    check(input.getAttribute('aria-invalid') === 'true' && root.querySelector('[data-demo-state]').dataset.outcome === 'invalid', `Godel rejects invalid input ${invalid}`);
  }
  solve('2 3 4 5');
  check(input.getAttribute('aria-invalid') === 'false' && root.querySelector('[data-demo-state]').dataset.outcome === 'solved', 'Godel accepts user-entered numbers after invalid input');
  check(doc.querySelectorAll('.godel-results tbody tr').length === 9, 'Godel comparison preserves every constrained baseline');
  check(doc.querySelector('.godel-result-focus').textContent.includes('64.2') && doc.querySelector('.godel-result-focus').textContent.includes('3.4'), 'Godel displays MGSM score and confidence interval');
  check(doc.querySelector('.godel-protocol').textContent.includes('GPT-4o-2024-05-13') && doc.querySelector('.godel-protocol').textContent.includes('GPT-3.5-turbo-0125'), 'Godel distinguishes optimizer and evaluated policy models');
  const figure = doc.querySelector('.godel-figure-scroll');
  check(figure.scrollWidth >= 760 && figure.clientWidth < 390, 'Godel mobile chart preserves readable scale within a scroll region');

  doc = await load('knowledge-interplay'); root = doc.querySelector('[data-paper-demo]');
  click(root, 'echo-with-context');
  check(root.querySelector('[data-echo-entity]').textContent === 'Myotis nattereri' && root.querySelector('[data-echo-answer]').textContent === 'Unknown', 'EchoQA recorded context response identifies entity but abstains');
  check(root.querySelector('[data-echo-second-hop]').classList.contains('is-blocked'), 'EchoQA marks the failed memory link');
  click(root, 'echo-no-context');
  check(root.querySelector('[data-echo-entity]').textContent === 'Myotis lucifugus' && root.querySelector('[data-echo-answer]').textContent === 'Noctuidae', 'EchoQA recorded no-context answer takes the unsupported shortcut');
  check(root.querySelector('[data-echo-diagnosis]').textContent.includes('unsupported shortcut'), 'EchoQA distinguishes correct choice from correct reasoning');
  click(root, 'echo-with-context');
  for (const [condition, rate] of [['none','23.89%'], ['neutral','62.72%'], ['trust','23.88%'], ['gold','0.08%']]) {
    root.querySelector(`[data-condition="${condition}"]`).click();
    check(root.querySelector('[data-echo-aggregate]').textContent.includes(rate), `EchoQA ${condition} shows measured aggregate rate`);
    check(root.querySelector('[data-echo-answer]').textContent === 'Unknown', 'EchoQA aggregate selection does not fabricate case-specific outputs');
  }

  // Readable, script-free copies of every page: check semantic content and hidden controls.
  const metadata = await fetch('/papers/content/metadata.json').then(response => response.json());
  frame.removeAttribute('src');
  let fallbackPages = 0;
  for (const slug of Object.keys(metadata)) {
    const html = await fetch(`/papers/${slug}.html`).then(response => response.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    check(doc.querySelectorAll('.narrative p').length >= 6, `${slug}: static research explanation`);
    check(doc.documentElement.scrollWidth <= 391, `${slug}: no-script phone layout`);
    const visibleControl = [...doc.querySelectorAll('[data-demo-action],[data-demo-range],[data-demo-select]')].some(el => el.getClientRects().length > 0);
    check(!visibleControl, `${slug}: inactive demo controls hidden without scripts`);
    for (const demo of doc.querySelectorAll('[data-paper-demo]')) {
      const readableState = [...demo.querySelectorAll('[data-demo-state]')]
        .filter(el => el.getClientRects().length > 0).map(el => el.textContent.trim()).join(' ');
      check(readableState.length > 20, `${slug}: static demo state remains readable`);
    }
    fallbackPages++;
  }
  frame.remove();
  return { assertions, fallbackPages, failures };
})();
