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

  doc = await load('godel-agent');
  // Placement: the runtime loop and the Game of 24 case in Method; Figure 5 and the results in Evidence.
  root = doc.querySelector('[data-paper-demo="godel-runtime"]');
  check(!!root && !!root.closest('#method .method-demo'), 'Godel runtime loop placed after the first Method paragraph');
  check(!!doc.querySelector('[data-paper-demo="godel-search"]').closest('#method') && !!doc.querySelector('.godel-observed-run').closest('#findings .evidence-demo') && !!doc.querySelector('.godel-results').closest('#findings'), 'Godel case in Method; Figure 5 and results in Evidence');
  check(!doc.querySelector('#explore') && !doc.querySelector('.godel-change-table') && doc.querySelectorAll('.godel-strip').length === 1 && doc.querySelectorAll('img[src="assets/godel-game24.svg"]').length === 1, 'Godel: no Explore section, nothing shown twice');
  check(doc.querySelector('#method .source-figure').compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING, 'Godel loop follows the paper\'s Figure 3');
  // Runtime states: bindings, created objects, call stack and feedback for each executed action.
  const gd = {
    goto: i => root.querySelector(`[data-demo-action="gd-goto"][data-frame="${i}"]`),
    bound: name => root.querySelector(`[data-gd-binding="${name}"] li.is-bound`).dataset.gdObject,
    absent: key => root.querySelector(`[data-gd-object="${key}"]`).hasAttribute('data-absent'),
    slot: name => root.querySelector(`[data-gd-binding="${name}"] .gd-slots`).style.getPropertyValue('--gd-slot'),
    mark: name => root.querySelector(`[data-gd-binding="${name}"]`).dataset.mark,
    stack: () => [...root.querySelectorAll('[data-gd-stack] li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    action: () => root.querySelector('[data-gd-action]').textContent,
    code: () => root.querySelector('[data-gd-code]').textContent,
    feedback: () => root.querySelector('[data-gd-feedback]').textContent,
    status: () => root.querySelector('[data-gd-status]').textContent,
    pressed: () => [...root.querySelectorAll('[data-demo-action="gd-goto"]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.frame).join()
  };
  const paperActions = ['self_inspect', 'interact', 'self_update', 'continue_improve'];
  check([...root.querySelectorAll('[data-demo-action="gd-goto"]')].slice(1).every(b => paperActions.includes(b.textContent.replace(' ✗', ''))), 'Godel actions are named as in Algorithm 1');
  check(gd.pressed() === '0' && gd.bound('solver') === 'solver_v0' && gd.absent('solver_v1') && gd.absent('self_improve_v1') && gd.stack().length === 1, 'Godel loop opens at the designer-supplied start');
  check(root.querySelector('.demo-tag').textContent.startsWith('Illustrative') && root.querySelector('[data-gd-status]').getAttribute('aria-live') === 'polite', 'Godel loop labelled illustrative; live status');
  gd.goto(1).click();
  check(gd.action() === 'self_inspect' && gd.mark('solver') === 'read' && gd.mark('self_improve') === 'read', 'Godel self_inspect reads both functions, including the running improver');
  gd.goto(2).click();
  check(gd.action() === 'interact' && gd.mark('solver') === 'call' && gd.feedback().includes('validation'), 'Godel interact turns validation results into feedback');
  gd.goto(3).click();
  check(gd.action() === 'self_update' && gd.bound('solver') === 'solver_v1' && gd.slot('solver') === '1' && !gd.absent('solver_v1') && root.querySelector('[data-gd-object="solver_v0"]').className === 'is-unbound', 'Godel self_update rebinds solver to the new function');
  check(gd.code().includes('+  if not check_with_code') && gd.code().includes('agent_module.solver = solver'), 'Godel self_update shows the diff and the monkey patch');
  gd.goto(4).click();
  check(gd.mark('solver') === 'error' && gd.feedback().includes('SyntaxError') && gd.bound('solver') === 'solver_v1' && gd.stack().length === 1, 'Godel failed edit is caught: error carried forward, solver still v1');
  gd.goto(5).click();
  check(gd.action() === 'continue_improve' && gd.stack().length === 2 && gd.stack().every(f => f.startsWith('self_improve v0')), 'Godel continue_improve recurses into the unchanged improver');
  gd.goto(6).click();
  check(gd.bound('self_improve') === 'self_improve_v1' && gd.slot('self_improve') === '1' && gd.stack().every(f => f.startsWith('self_improve v0')) && gd.code().includes('traceback.format_exc()'), 'Godel improver rebound while running frames keep v0');
  gd.goto(7).click();
  check(gd.stack().length === 3 && gd.stack()[0].startsWith('self_improve v1') && gd.status().includes('4%'), 'Godel next recursive call enters self_improve v1');
  check(root.querySelector('[data-demo-action="gd-step"]').disabled, 'Godel Step disabled at the last action');
  root.querySelector('[data-demo-action="gd-reset"]').click();
  check(gd.pressed() === '0' && gd.bound('self_improve') === 'self_improve_v0' && gd.absent('self_improve_v1'), 'Godel Reset restores the start');
  root.querySelector('[data-demo-action="gd-step"]').click();
  check(gd.pressed() === '1' && gd.action() === 'self_inspect', 'Godel Step advances one action');
  const gdPlay = root.querySelector('[data-demo-action="gd-play"]');
  gdPlay.click();
  check(gdPlay.getAttribute('aria-pressed') === 'true' && gdPlay.textContent === 'Pause' && gd.pressed() === '2', 'Godel Play advances and becomes Pause');
  gdPlay.click();
  await new Promise(resolve => setTimeout(resolve, 2500));
  check(gdPlay.getAttribute('aria-pressed') === 'false' && gd.pressed() === '2', 'Godel Pause holds the state');
  check([...root.querySelectorAll('[data-demo-action]')].every(b => b.tagName === 'BUTTON' && b.type === 'button'), 'Godel loop controls are keyboard-operable buttons');
  // Game of 24 search policy (Listing 6), executed locally.
  root = doc.querySelector('[data-paper-demo="godel-search"]');
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
  // Script-free: the final runtime state and the whole action trace stay readable.
  {
    const html = await fetch('/papers/godel-agent.html').then(response => response.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    const loop = frame.contentDocument.querySelector('[data-paper-demo="godel-runtime"]');
    const items = [...loop.querySelectorAll('[data-gd-trace] li')];
    check(items.length === 8 && items.every(li => li.getClientRects().length > 0) && items[4].textContent.includes('does not compile'), 'Godel static: full action trace readable');
    check(loop.querySelector('[data-gd-binding="self_improve"] li.is-bound').dataset.gdObject === 'self_improve_v1' && loop.querySelectorAll('[data-gd-stack] li').length === 3, 'Godel static: final runtime state');
    check(loop.querySelector('[data-gd-controls]').getClientRects().length === 0, 'Godel static: controls hidden');
    // Leave srcdoc mode before the next src navigation (srcdoc takes precedence over src).
    await Promise.race([new Promise(resolve => { frame.onload = resolve; frame.removeAttribute('srcdoc'); }), new Promise(resolve => setTimeout(resolve, 3000))]);
  }

  doc = await load('knowledge-interplay'); root = doc.querySelector('[data-paper-demo]');
  click(root, 'echo-with-context');
  check(root.querySelector('[data-echo-entity]').textContent === 'Myotis nattereri' && root.querySelector('[data-echo-answer]').textContent === 'Unknown', 'EchoQA recorded context response identifies entity but abstains');
  check(root.querySelector('[data-echo-second-hop]').classList.contains('is-blocked'), 'EchoQA marks the failed memory link');
  click(root, 'echo-no-context');
  check(root.querySelector('[data-echo-entity]').textContent === 'Myotis lucifugus' && root.querySelector('[data-echo-answer]').textContent === 'Noctuidae', 'EchoQA recorded no-context answer takes the unsupported shortcut');
  check(root.querySelector('[data-echo-diagnosis]').textContent.includes('unsupported shortcut'), 'EchoQA distinguishes correct choice from correct reasoning');
  click(root, 'echo-with-context');
  check(root.querySelector('[data-echo-answer]').textContent === 'Unknown' && root.closest('#method'), 'EchoQA recorded case returns to the published context response, in Method');
  // Aggregate abstention rates live in the page's six-model results table, not in repeated bars.
  check(!root.querySelector('[data-condition]') && doc.querySelector('.results-table').textContent.includes('62.72'), 'EchoQA leaves measured rates to the results table');

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
