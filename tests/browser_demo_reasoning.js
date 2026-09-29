/* Reasoning demos (ContraSolver, Atomic to Composite).
 * Run against the local preview, from any page on its origin:
 *   agent-browser eval --stdin < tests/browser_demo_reasoning.js
 * ContraSolver expectations were computed with an independent Python
 * implementation of Algorithm 1 (arXiv 2406.08842v1) and checked by hand.
 * Atomic values are Table 1(b) and Table 2 of arXiv 2512.01970v1.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html?test=${Date.now()}`; });
    return frame.contentDocument;
  };
  const text = (root, selector) => root.querySelector(selector).textContent.trim();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* ---------- ContraSolver: algorithm on hand-verified graphs ---------- */
  let doc = await load('contrasolver');
  let root = doc.querySelector('[data-paper-demo="contrasolver"]');
  const solve = frame.contentWindow.ReasoningDemo.solveContraSolver;
  const cases = {
    default: {
      edges: [['A','B',70],['A','C',80],['A','D',76],['A','E',95],['B','C',90],['D','B',59],['B','E',92],['C','D',88],['E','C',64],['D','E',86]],
      expect: { tree: ['A>E','B>E','B>C','C>D'], added: [['D>E',1],['A>C',2],['A>B',3]], implied: [['A>D',3]], contradictory: [['D>B',1],['E>C',2]], heuristic: ['B>C','C>D','D>E'], order: 'ABCDE', passes: 3 },
    },
    flipDB: {
      edges: [['A','B',70],['A','C',80],['A','D',76],['A','E',95],['B','C',90],['B','D',59],['B','E',92],['C','D',88],['E','C',64],['D','E',86]],
      expect: { tree: ['A>E','B>E','B>C','C>D'], added: [['D>E',1],['A>C',2],['A>B',3]], implied: [['A>D',3],['B>D',4]], contradictory: [['E>C',2]], heuristic: ['C>D','D>E'], order: 'ABCDE', passes: 4 },
    },
    consistent: {
      edges: [['A','B',70],['A','C',80],['A','D',76],['A','E',95],['B','C',90],['B','D',59],['B','E',92],['C','D',88],['C','E',64],['D','E',86]],
      expect: { tree: ['A>E','B>E','B>C','C>D'], added: [['D>E',1],['A>C',2],['A>B',3]], implied: [['A>D',3],['C>E',4],['B>D',4]], contradictory: [], heuristic: [], order: 'ABCDE', passes: 4 },
    },
    confidentError: {
      edges: [['A','B',70],['A','C',80],['A','D',76],['A','E',95],['B','C',90],['D','B',59],['B','E',92],['C','D',88],['E','C',89],['D','E',86]],
      expect: { tree: ['A>E','B>E','B>C','C>D'], added: [['E>C',1],['A>B',2]], implied: [['A>C',2],['A>D',2]], contradictory: [['D>B',1],['D>E',2]], heuristic: ['B>C','C>D','E>C'], order: 'ABECD', passes: 2 },
    },
    errorInTree: {
      edges: [['A','B',70],['A','C',80],['A','D',76],['A','E',95],['B','C',90],['D','B',94],['B','E',92],['C','D',88],['E','C',64],['D','E',86]],
      expect: { tree: ['A>E','D>B','B>E','B>C'], added: [['A>C',1],['A>D',2],['E>C',3]], implied: [['D>E',1],['A>B',3]], contradictory: [['C>D',1]], heuristic: ['B>C','D>B'], order: 'ADBEC', passes: 3 },
    },
    // Two kept paths D -> C -> A and D -> C -> E -> A: every edge on both becomes heuristic.
    multiPath: {
      edges: [['B','A',56],['C','A',95],['A','D',55],['E','A',82],['C','B',79],['D','B',76],['B','E',61],['D','C',63],['C','E',67],['D','E',59]],
      expect: { tree: ['C>A','E>A','C>B','D>B'], added: [['C>E',1],['D>C',2],['B>E',3]], implied: [['D>E',4],['B>A',4]], contradictory: [['A>D',3]], heuristic: ['C>A','E>A','D>C','C>E'], order: 'DCBEA', passes: 4 },
    },
  };
  const bySet = pairs => [...pairs].map(pair => pair.join('@')).sort();
  for (const [name, { edges, expect }] of Object.entries(cases)) {
    const input = edges.map(([winner, loser, weight]) => ({ winner, loser, weight }));
    const result = solve(input);
    const name_ = i => `${input[i].winner}>${input[i].loser}`;
    const byStage = stage => [...result.stage].filter(([, s]) => s === stage).map(([i]) => [name_(i), result.passOf.get(i)]);
    check(same(result.tree.map(name_), expect.tree), `ContraSolver ${name}: Kruskal tree in weight order`);
    check(same(bySet(byStage('added')), bySet(expect.added)), `ContraSolver ${name}: forward-loop additions and passes`);
    check(same(bySet(byStage('implied')), bySet(expect.implied)), `ContraSolver ${name}: untopological edges skipped`);
    check(same(bySet(byStage('contradictory')), bySet(expect.contradictory)), `ContraSolver ${name}: contradictory edges and passes`);
    check(same([...result.heuristic].sort((a, b) => a - b).map(name_), expect.heuristic), `ContraSolver ${name}: heuristic edges (DPO pairs)`);
    check(result.order.join('') === expect.order, `ContraSolver ${name}: resolved order`);
    check(result.passes.length === expect.passes, `ContraSolver ${name}: number of passes`);
    // Paper properties: local optimality and global consistency (Section 3.4).
    const contradictory = [...result.stage].filter(([, s]) => s === 'contradictory').map(([i]) => i);
    check(contradictory.every(i => [...result.heuristic].every(j => input[j].weight > input[i].weight)), `ContraSolver ${name}: contradictions weaker than heuristic edges`);
    const rank = Object.fromEntries(result.order.map((node, k) => [node, k]));
    const resolved = input.map((edge, i) => result.stage.get(i) === 'contradictory' ? [edge.loser, edge.winner] : [edge.winner, edge.loser]);
    check(resolved.every(([w, l]) => rank[w] < rank[l]), `ContraSolver ${name}: reversed contradictions agree with the order`);
  }

  /* ---------- ContraSolver: page state and controls ---------- */
  const rowOf = i => root.querySelector(`[data-edge-row="${i}"]`);
  const act = (action, i, times = 1) => {
    const selector = i === undefined ? `[data-demo-action="${action}"]` : `[data-demo-action="${action}"][data-edge="${i}"]`;
    for (let k = 0; k < times; k++) root.querySelector(selector).click();
  };
  const pairs = () => text(root, '[data-cs-pairs]');
  const contradictions = () => text(root, '[data-cs-contradictions]');
  const order = () => text(root, '[data-cs-order]');
  const marker = i => { const line = root.querySelector(`.cs-edge[data-edge="${i}"] .cs-line`); return line.hasAttribute('marker-end') ? 'end' : line.hasAttribute('marker-start') ? 'start' : 'none'; };
  check(root.dataset.reasoningReady === 'true', 'ContraSolver demo initializes');
  check(pairs() === 'B ≻ C, C ≻ D, D ≻ E' && contradictions() === 'D ≻ B, E ≻ C' && order() === 'A ≻ B ≻ C ≻ D ≻ E', 'ContraSolver default readout');
  check(rowOf(5).dataset.edgeClass === 'contradictory' && rowOf(4).dataset.edgeClass === 'heuristic' && rowOf(3).dataset.edgeClass === 'kept' && rowOf(2).dataset.edgeClass === 'implied', 'ContraSolver default edge classes');
  check(text(rowOf(2), '[data-cs-outcome]') === 'Implied, skipped in pass 3' && text(rowOf(9), '[data-cs-outcome]') === 'Added, pass 1 · DPO pair', 'ContraSolver outcome text');
  check(root.querySelectorAll('.cs-log li').length === 4 && text(root, '.cs-log li:nth-child(3)').includes('E ≻ C 0.64 contradicts the kept chain C ≻ D ≻ E'), 'ContraSolver pass log lists the tree and three passes');
  check(root.querySelector('[role="status"][aria-live="polite"]') && root.querySelector('[role="status"]').contains(root.querySelector('[data-cs-pairs]')), 'ContraSolver result is a polite live region');
  // Keyboard: every edge has native, labelled buttons that keep focus across re-renders.
  const flipButtons = [...root.querySelectorAll('[data-demo-action="cs-flip"]')];
  check(flipButtons.length === 10 && flipButtons.every(b => b.tagName === 'BUTTON' && !b.hidden && b.tabIndex === 0 && b.getAttribute('aria-label').startsWith('Flip the judgment')), 'ContraSolver ten keyboard-operable flip buttons');
  // Edge 5 joins B and D; its path runs B to D, so D ≻ B uses the start marker.
  check(marker(5) === 'start' && marker(4) === 'end', 'ContraSolver arrows point to the less preferred response');
  const flip5 = rowOf(5).querySelector('[data-demo-action="cs-flip"]');
  flip5.focus(); flip5.click();
  check(doc.activeElement === flip5 && flip5.isConnected, 'ContraSolver focus stays on the flipped edge control');
  check(flip5.textContent === 'B ≻ D' && flip5.getAttribute('aria-label').includes('currently B ≻ D'), 'ContraSolver flip updates label and accessible name');
  check(pairs() === 'C ≻ D, D ≻ E' && contradictions() === 'E ≻ C' && text(rowOf(5), '[data-cs-outcome]') === 'Implied, skipped in pass 4', 'ContraSolver flipping D ≻ B removes one contradiction and one pair');
  check(marker(5) === 'end', 'ContraSolver graph arrow reverses with the flip');
  act('cs-flip', 8);
  check(pairs() === 'none' && contradictions() === 'none' && text(root, '[data-cs-pair-count]') === '0 of 10 judgments', 'ContraSolver a consistent graph contributes no DPO pairs');
  act('cs-reset');
  check(pairs() === 'B ≻ C, C ≻ D, D ≻ E' && marker(5) === 'start' && text(rowOf(5), 'output') === '0.59', 'ContraSolver reset restores the example');
  act('cs-up', 8, 5);
  check(text(rowOf(8), 'output') === '0.89', 'ContraSolver confidence steps by 0.05');
  check(pairs() === 'B ≻ C, C ≻ D, E ≻ C' && contradictions() === 'D ≻ B, D ≻ E' && order() === 'A ≻ B ≻ E ≻ C ≻ D', 'ContraSolver a confident error becomes a DPO pair and flags a correct judgment');
  check(root.querySelector('.cs-edge[data-edge="8"]').classList.contains('is-heuristic') && root.querySelector('.cs-edge[data-edge="9"]').classList.contains('is-contradictory'), 'ContraSolver graph classes follow the recomputation');
  check(root.querySelector('.cs-lines').lastElementChild.classList.contains('is-heuristic'), 'ContraSolver draws emphasised edges on top');
  act('cs-reset'); act('cs-up', 5, 7);
  check(text(rowOf(5), 'output') === '0.94' && rowOf(5).dataset.edgeStage === 'tree' && contradictions() === 'C ≻ D' && order() === 'A ≻ D ≻ B ≻ E ≻ C', 'ContraSolver raising an error above the tree changes the tree');
  act('cs-up', 5, 3);
  check(text(rowOf(5), 'output') === '0.99' && root.querySelector('[data-demo-action="cs-up"][data-edge="5"]').disabled, 'ContraSolver confidence clamps at 0.99');
  act('cs-reset'); act('cs-down', 5, 3);
  check(text(rowOf(5), 'output') === '0.51' && root.querySelector('[data-demo-action="cs-down"][data-edge="5"]').disabled, 'ContraSolver confidence clamps at the paper filter 0.51');
  act('cs-reset');
  root.querySelector('.cs-edge[data-edge="8"] .cs-hit').dispatchEvent(new frame.contentWindow.MouseEvent('click', { bubbles: true }));
  check(text(rowOf(8), '[data-cs-static]') === 'C ≻ E' && contradictions() === 'D ≻ B', 'ContraSolver clicking an arrow flips it');
  act('cs-reset');
  const staticHtml = await fetch('/papers/contrasolver.html').then(r => r.text());
  const staticDoc = new DOMParser().parseFromString(staticHtml, 'text/html');
  check(text(staticDoc, '.cs-log') === text(root, '.cs-log') && text(staticDoc, '[data-cs-pairs]') === pairs(), 'ContraSolver server state equals the browser computation');
  const table4 = [...root.querySelectorAll('.cs-measured .rd-dumbbell-values')].map(el => el.textContent);
  check(same(table4, ['13.30% → 10.40%', '17.50% → 14.30%', '22.10% → 19.70%', '14.70% → 12.00%', '30.60% → 18.90%', '26.60% → 15.30%', '32.80% → 26.60%', '19.80% → 14.30%']), 'ContraSolver Table 4 measured values');
  check(text(root, '.cs-measured').includes('Table 4') && text(root, '.cs-edges').length > 0 && root.textContent.includes('illustrative'), 'ContraSolver labels measured and illustrative data');

  /* ---------- Atomic to Composite ---------- */
  doc = await load('atomic-to-composite');
  root = doc.querySelector('[data-paper-demo="atomic-to-composite"]');
  const scores = { iid: ['35.18', '90.30'], composition: ['28.20', '76.25'], zero: ['24.07', '18.41'] };
  for (const [split, [atomic, composite]] of Object.entries(scores)) {
    check(text(root, `[data-atomic-score="${split}-atomic"]`) === atomic && text(root, `[data-atomic-score="${split}-composite"]`) === composite, `Atomic ${split} shows Table 1(b) SFT accuracies`);
    const bars = root.querySelectorAll(`[data-split="${split}"] .ac-bar-track i`);
    check(parseFloat(bars[0].style.width) === Number(atomic) && parseFloat(bars[1].style.width) === Number(composite), `Atomic ${split} bar lengths equal the values`);
  }
  check(root.querySelectorAll('.ac-split').length === 3 && !root.querySelector('[data-demo-action="atomic-split"]'), 'Atomic all three splits are visible without split buttons');
  check(text(root, '[data-atomic-gap="iid"]') === 'Composite SFT leads by 55.12 points' && text(root, '[data-atomic-gap="composition"]') === 'Composite SFT leads by 48.05 points', 'Atomic familiar-split gaps');
  check(text(root, '[data-atomic-gap="zero"]') === 'Order reverses: atomic SFT leads by 5.66 points', 'Atomic zero-shot reversal is stated');
  const errors = [...root.querySelectorAll('.ac-errors .rd-dumbbell-values')].map(el => el.textContent);
  check(same(errors, ['90% → 86%', '86% → 30%', '54.5% → 45.0%', '18.5% → 71.8%']), 'Atomic Table 2 error-location values');
  check(!root.querySelector('[data-demo-action="atomic-next"]'), 'Atomic has no fact-by-fact stepper');
  const hops = () => [...root.querySelectorAll('[data-atomic-trace] li')].map(li => li.dataset.source).join(',');
  const pressed = () => [...root.querySelectorAll('[data-demo-action="atomic-task"]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.task).join();
  check(hops() === 'context,memory,memory' && text(root, '[data-atomic-answer]') === 'Research Analyst' && pressed() === 'combined', 'Atomic complementary task shows the full three-hop trace');
  root.querySelector('[data-task="context"]').click();
  check(hops() === 'context,context' && text(root, '[data-atomic-answer]') === 'Chloe Davis' && text(root, '[data-atomic-memory]').startsWith('Not needed') && pressed() === 'context', 'Atomic context task stays inside the document');
  root.querySelector('[data-task="memory"]').click();
  check(hops() === 'memory,memory' && text(root, '[data-atomic-question]').includes('Amina Khan?') && text(root, '[data-atomic-context]').startsWith('None') && pressed() === 'memory', 'Atomic parametric task needs no document');
  check(text(root, '[data-atomic-status]').startsWith('Two hops, both from parametric memory') && root.querySelector('[data-atomic-status]').getAttribute('aria-live') === 'polite', 'Atomic live status describes the selected task');
  root.querySelector('[data-task="combined"]').click();
  check(text(root, '[data-atomic-trace] li:first-child') === 'ContextGlobal View chief editor → Amina Khan', 'Atomic first hop reads the supplied document');

  /* ---------- Design constraints and layout ---------- */
  for (const slug of ['contrasolver', 'atomic-to-composite']) {
    for (const width of [1440, 390, 320]) {
      frame.style.width = `${width}px`;
      doc = await load(slug);
      root = doc.querySelector('[data-paper-demo]');
      check(doc.documentElement.scrollWidth <= width + 1, `${slug} at ${width}: no page overflow`);
      check(root.scrollWidth <= root.clientWidth + 1, `${slug} at ${width}: demo fits its frame`);
      const clipped = [...root.querySelectorAll('p,h3,h4,h5,li,dd,button,span')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2 && frame.contentWindow.getComputedStyle(el).display !== 'inline');
      check(clipped.length === 0, `${slug} at ${width}: no clipped text ${clipped.map(el => el.className).join(' ')}`);
      if (width === 1440) {
        const styled = [...root.querySelectorAll('*')].map(el => [el, frame.contentWindow.getComputedStyle(el)]);
        check(styled.every(([, s]) => s.borderRadius === '0px' || s.borderRadius === ''), `${slug}: sharp corners`);
        check(styled.every(([, s]) => s.boxShadow === 'none' && s.backgroundImage === 'none'), `${slug}: no shadows or gradients`);
        check(styled.every(([, s]) => s.animationName === 'none' && (s.transitionDuration === '0s' || s.transitionDuration === '')), `${slug}: no motion`);
        check([...root.querySelectorAll('svg rect')].every(rect => (rect.getAttribute('rx') || '0') === '0'), `${slug}: SVG rectangles are square`);
      }
    }
  }
  frame.style.width = '390px';

  /* ---------- Script-free fallback ---------- */
  for (const [slug, width] of [['contrasolver', 390], ['contrasolver', 320], ['atomic-to-composite', 390], ['atomic-to-composite', 320]]) {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/${slug}.html`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    frame.removeAttribute('src');
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    root = doc.querySelector('[data-paper-demo]');
    const visible = el => el.getClientRects().length > 0;
    check(![...root.querySelectorAll('[data-demo-action]')].some(visible), `${slug} no-JS ${width}: controls hidden`);
    check(doc.documentElement.scrollWidth <= width + 1, `${slug} no-JS ${width}: no page overflow`);
    if (slug === 'contrasolver') {
      check([...root.querySelectorAll('[data-cs-static]')].filter(visible).length === 10 && text(root, '[data-cs-static="5"]') === 'D ≻ B', `${slug} no-JS: every judgment is readable`);
      check(visible(root.querySelector('.cs-graph')) && root.querySelectorAll('.cs-edge.is-heuristic').length === 3 && root.querySelectorAll('.cs-edge.is-contradictory').length === 2, `${slug} no-JS: graph shows the computed classes`);
      check(root.querySelectorAll('.cs-log li').length === 4 && text(root, '[data-cs-pairs]') === 'B ≻ C, C ≻ D, D ≻ E', `${slug} no-JS: algorithm readout is complete`);
    } else {
      check(root.querySelectorAll('[data-atomic-trace] li').length === 3 && text(root, '[data-atomic-answer]') === 'Research Analyst', `${slug} no-JS: complete worked trace`);
      check(root.querySelectorAll('.ac-split').length === 3 && text(root, '[data-atomic-score="zero-atomic"]') === '24.07', `${slug} no-JS: all measured splits`);
    }
  }
  frame.remove();
  return { assertions, failures };
})();
