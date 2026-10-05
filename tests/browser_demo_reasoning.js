/* Reasoning demos (ContraSolver, Atomic to Composite).
 * Run against the local preview, from any page on its origin:
 *   agent-browser eval --stdin < tests/browser_demo_reasoning.js
 * Run it once more under `agent-browser set media light reduced-motion`; the
 * motion checks switch to the reduced-motion expectations automatically.
 * ContraSolver expectations were computed with an independent Python
 * implementation of Algorithm 1 (arXiv 2406.08842v1) and checked by hand.
 * Atomic values are Figure 1(a), Table 1(b) and Table 2 of arXiv 2512.01970v1.
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
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (condition, timeout = 4000) => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) await wait(20);
    return condition();
  };
  const text = (root, selector) => root.querySelector(selector).textContent.trim();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ContraSolver: algorithm on hand-verified graphs ---------- */
  let doc = await load('contrasolver');
  let root = doc.querySelector('[data-reasoning-demo="preference-graph"]');
  const api = frame.contentWindow.ReasoningDemo;
  const solve = api.solveContraSolver;
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
    // A strong edge closes an undirected triangle before the tree is complete: Kruskal must skip it.
    kruskalSkip: {
      edges: [['A','B',95],['A','C',90],['B','C',85],['A','D',60],['B','D',55],['C','D',55],['A','E',70],['B','E',65],['C','E',60],['D','E',52]],
      // Descending: A>B .95, A>C .90, B>C .85 (skip), A>E .70, B>E .65 (skip), A>D .60 completes the tree.
      expect: { tree: ['A>B','A>C','A>E','A>D'], skips: ['B>C','B>E'] },
    },
  };
  const bySet = pairs => [...pairs].map(pair => pair.join('@')).sort();
  for (const [name, { edges, expect }] of Object.entries(cases)) {
    const input = edges.map(([winner, loser, weight]) => ({ winner, loser, weight }));
    const result = solve(input);
    const name_ = i => `${input[i].winner}>${input[i].loser}`;
    const byStage = stage => [...result.stage].filter(([, s]) => s === stage).map(([i]) => [name_(i), result.passOf.get(i)]);
    check(same(result.tree.map(name_), expect.tree), `ContraSolver ${name}: Kruskal tree in weight order`);
    if (name !== 'kruskalSkip') {
      check(same(bySet(byStage('added')), bySet(expect.added)), `ContraSolver ${name}: forward-loop additions and passes`);
      check(same(bySet(byStage('implied')), bySet(expect.implied)), `ContraSolver ${name}: untopological edges skipped`);
      check(same(bySet(byStage('contradictory')), bySet(expect.contradictory)), `ContraSolver ${name}: contradictory edges and passes`);
      check(same([...result.heuristic].sort((a, b) => a - b).map(name_), expect.heuristic), `ContraSolver ${name}: heuristic edges (DPO pairs)`);
      check(result.order.join('') === expect.order, `ContraSolver ${name}: resolved order`);
      check(result.passes.length === expect.passes, `ContraSolver ${name}: number of passes`);
    } else {
      check(same(result.events.filter(e => e.type === 'tree-skip').map(e => name_(e.edge)), expect.skips), 'ContraSolver kruskalSkip: the replay shows the rejected tree edge');
    }
    // Paper properties: local optimality and global consistency (Section 3.4).
    const contradictory = [...result.stage].filter(([, s]) => s === 'contradictory').map(([i]) => i);
    check(contradictory.every(i => [...result.heuristic].every(j => input[j].weight > input[i].weight)), `ContraSolver ${name}: contradictions weaker than heuristic edges`);
    const rank = Object.fromEntries(result.order.map((node, k) => [node, k]));
    const resolved = input.map((edge, i) => result.stage.get(i) === 'contradictory' ? [edge.loser, edge.winner] : [edge.winner, edge.loser]);
    check(resolved.every(([w, l]) => rank[w] < rank[l]), `ContraSolver ${name}: reversed contradictions agree with the order`);

    /* Replay consistency: the event list is Algorithm 1's order, and replaying it rebuilds the result. */
    const frames = api.replayFrames(result);
    check(frames[0].type === 'start' && frames[frames.length - 1].type === 'done' && frames.length === result.events.length + 2, `ContraSolver ${name}: replay frames wrap the event list`);
    const treeWeights = result.events.filter(e => e.type === 'tree' || e.type === 'tree-skip').map(e => input[e.edge].weight);
    check(treeWeights.every((w, k) => k === 0 || w <= treeWeights[k - 1]), `ContraSolver ${name}: Kruskal frames strongest first`);
    check(same(result.events.filter(e => e.type === 'tree').map(e => e.edge), result.tree), `ContraSolver ${name}: tree frames equal the tree`);
    for (const record of result.passes) {
      const inPass = result.events.filter(e => e.pass === record.number);
      const reverse = inPass.filter(e => e.type === 'contradiction').map(e => input[e.edge].weight);
      const forward = inPass.filter(e => e.type === 'implied' || e.type === 'added');
      check(reverse.every((w, k) => k === 0 || w >= reverse[k - 1]), `ContraSolver ${name} pass ${record.number}: reverse loop weakest first`);
      check(forward.every((e, k) => k === 0 || input[e.edge].weight <= input[forward[k - 1].edge].weight), `ContraSolver ${name} pass ${record.number}: forward loop strongest first`);
      const firstForward = inPass.findIndex(e => ['implied', 'added', 'no-edges'].includes(e.type));
      check(inPass.slice(0, firstForward).every(e => e.type === 'contradiction' || e.type === 'no-cycle'), `ContraSolver ${name} pass ${record.number}: reverse loop before forward loop`);
      check(!forward.some((e, k) => e.type === 'added' && k !== forward.length - 1), `ContraSolver ${name} pass ${record.number}: the forward loop stops after one addition`);
      check(same(inPass.filter(e => e.type === 'contradiction').map(e => e.edge), record.contradictions.map(c => c.edge)), `ContraSolver ${name} pass ${record.number}: replayed contradictions match the record`);
    }
    const final = api.replayState(input, frames, frames.length - 1);
    check(input.every((_, i) => final.classes[i] === (result.heuristic.has(i) ? 'heuristic' : ['tree', 'added'].includes(result.stage.get(i)) ? 'kept' : result.stage.get(i))), `ContraSolver ${name}: replayed final classes equal the computed result`);
    check(same([...final.heuristic].sort(), [...result.heuristic].sort()) && input.every((_, i) => final.stage.get(i) === result.stage.get(i)), `ContraSolver ${name}: replayed stages and heuristic set equal the result`);
    check(api.replayState(input, frames, 0).classes.every(c => c === 'pending'), `ContraSolver ${name}: first frame has every judgment unexamined`);
  }

  /* ---------- ContraSolver: page placement, state and controls ---------- */
  check(doc.querySelector('#method .section-demo.method-demo [data-reasoning-demo="preference-graph"]') && doc.querySelector('#method .method-lead + .section-demo'), 'ContraSolver mechanism demo sits after the first Method paragraph');
  const evidence = doc.querySelector('#findings .section-demo.evidence-demo [data-reasoning-demo="contrasolver-evidence"]');
  check(evidence && doc.querySelector('#findings .findings-grid + .section-demo') && evidence.closest('.section-demo').nextElementSibling.classList.contains('evidence-narrative'), 'ContraSolver Table 4 sits after the findings, before the narrative');
  check(!doc.querySelector('#explore'), 'ContraSolver has no separate Explore section');
  check(text(root, '.rd-eyebrow') === 'Algorithm 1 · illustrative judgments' && text(evidence, '.rd-eyebrow') === 'Measured · Table 4', 'ContraSolver eyebrows name the evidence');
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
  const region = root.querySelector('.cs-result-region');
  check(region.getAttribute('role') === 'status' && region.getAttribute('aria-live') === 'polite' && region.contains(root.querySelector('[data-cs-pairs]')), 'ContraSolver result is a polite live region');
  const flipButtons = [...root.querySelectorAll('[data-demo-action="cs-flip"]')];
  check(flipButtons.length === 10 && flipButtons.every(b => b.tagName === 'BUTTON' && !b.hidden && b.tabIndex === 0 && b.getAttribute('aria-label').startsWith('Flip the judgment')), 'ContraSolver ten keyboard-operable flip buttons');
  check(marker(5) === 'start' && marker(4) === 'end', 'ContraSolver arrows point to the less preferred response');
  const staticHtml = await fetch('/papers/contrasolver.html').then(r => r.text());
  const staticDoc = new DOMParser().parseFromString(staticHtml, 'text/html');
  check(text(staticDoc, '.cs-log') === text(root, '.cs-log') && text(staticDoc, '[data-cs-pairs]') === pairs(), 'ContraSolver server state equals the browser computation');

  /* ---------- ContraSolver: replay controls ---------- */
  const control = name => root.querySelector(`[data-demo-action="cs-run-${name}"]`);
  const status = () => root.querySelector('[data-player-status="cs-run"]').textContent;
  const state = () => root.dataset.playerState;
  const classes = () => [...root.querySelectorAll('[data-edge-row]')].map(row => row.dataset.edgeClass).join(',');
  const completeClasses = classes();
  const group = root.querySelector('.rd-player');
  check(group.getAttribute('role') === 'group' && !group.hidden && ['play', 'pause', 'step', 'reset'].every(name => control(name).tagName === 'BUTTON'), 'ContraSolver replay controls are native buttons in a labelled group');
  const playerStatus = root.querySelector('[data-player-status="cs-run"]');
  check(playerStatus.getAttribute('role') === 'status' && playerStatus.getAttribute('aria-live') === 'polite' && !playerStatus.hidden, 'ContraSolver replay status is a polite live region');
  check(state() === 'complete' && control('play').getAttribute('aria-pressed') === 'false' && control('pause').disabled && status() === '', 'ContraSolver nothing moves before the reader starts it');
  await wait(300);
  check(state() === 'complete' && classes() === completeClasses, 'ContraSolver no autoplay');
  control('step').click();
  check(root.dataset.playerFrame === '0' && classes().split(',').every(c => c === 'pending') && status().startsWith('Step 1 of 13 · 10 judgments'), 'ContraSolver frame 1: every judgment unexamined');
  check(root.classList.contains('is-replaying') && region.getAttribute('aria-busy') === 'true' && order() === 'Known after the last pass', 'ContraSolver readout is provisional during a replay');
  for (let k = 0; k < 4; k++) control('step').click();
  check(classes() === 'pending,pending,pending,kept,kept,pending,kept,kept,pending,pending', 'ContraSolver after Kruskal: exactly the four tree edges are kept');
  check(rowOf(7).classList.contains('is-current') && root.querySelector('.cs-edge[data-edge="7"]').classList.contains('is-current') && status().includes('add C ≻ D 0.88'), 'ContraSolver frame 5 highlights the fourth tree edge');
  check(root.querySelector('.cs-log li:nth-child(1) span').classList.contains('is-current') && root.querySelector('.cs-log li:nth-child(2)').classList.contains('is-future'), 'ContraSolver log marks the tree sentence and dims later passes');
  control('step').click();
  check(rowOf(5).dataset.edgeClass === 'contradictory' && rowOf(4).dataset.edgeClass === 'heuristic' && rowOf(7).dataset.edgeClass === 'heuristic' && rowOf(9).dataset.edgeClass === 'pending', 'ContraSolver frame 6: D ≻ B contradicts, B ≻ C and C ≻ D become heuristic');
  check(pairs() === 'B ≻ C, C ≻ D' && contradictions() === 'D ≻ B' && text(rowOf(5), '[data-cs-outcome]') === 'Contradictory, pass 1' && text(rowOf(9), '[data-cs-outcome]') === 'Not yet examined', 'ContraSolver readout fills in as the run proceeds');
  check(root.querySelector('.cs-log li:nth-child(2) span').classList.contains('is-current') && root.querySelector('.cs-log li:nth-child(2) span:nth-of-type(2)').classList.contains('is-future'), 'ContraSolver log marks the pass 1 reverse loop');
  control('step').click();
  check(rowOf(9).dataset.edgeClass === 'kept' && status().includes('Pass 1, forward loop: add D ≻ E 0.86'), 'ContraSolver frame 7: the forward loop adds D ≻ E');
  control('step').click(); control('step').click(); control('step').click(); control('step').click();
  check(rowOf(2).dataset.edgeClass === 'implied' && status().includes('skip A ≻ D 0.76'), 'ContraSolver frame 11: A ≻ D is skipped as implied');
  control('step').focus();
  control('step').click(); control('step').click();
  check(root.dataset.playerFrame === '12' && classes() === completeClasses && order() === 'A ≻ B ≻ C ≻ D ≻ E' && status().startsWith('Step 13 of 13 · Done after 3 passes'), 'ContraSolver last frame equals the completed result');
  check(control('step').disabled && doc.activeElement === control('play'), 'ContraSolver Step is disabled at the end and focus moves to Play');
  check(region.getAttribute('aria-busy') === 'false' && !root.querySelector('.cs-log .is-current, .cs-log .is-future'), 'ContraSolver last frame clears the provisional marks');
  control('reset').click();
  check(state() === 'complete' && classes() === completeClasses && status() === '' && !root.classList.contains('is-replaying'), 'ContraSolver Reset returns to the completed run');
  root.dataset.frameMs = '25';
  control('play').click();
  check(control('play').getAttribute('aria-pressed') === 'true' && !control('pause').disabled && state() === 'playing', 'ContraSolver Play sets aria-pressed and enables Pause');
  await waitFor(() => Number(root.dataset.playerFrame) >= 3);
  control('pause').click();
  const pausedAt = root.dataset.playerFrame;
  await wait(150);
  check(state() === 'paused' && root.dataset.playerFrame === pausedAt && control('play').getAttribute('aria-pressed') === 'false', 'ContraSolver Pause holds the frame');
  control('play').click();
  check(await waitFor(() => state() === 'paused' && root.dataset.playerFrame === '12'), 'ContraSolver Play resumes and stops on the last frame');
  check(classes() === completeClasses && control('pause').disabled, 'ContraSolver played run ends in the computed result');
  control('play').click();
  check(root.dataset.playerFrame === '0' && state() === 'playing', 'ContraSolver Play after the end restarts the run');
  control('pause').click();
  // An edit during a replay ends it and shows the completed run of the new graph.
  rowOf(5).querySelector('[data-demo-action="cs-flip"]').click();
  check(state() === 'complete' && pairs() === 'C ≻ D, D ≻ E' && contradictions() === 'E ≻ C', 'ContraSolver editing during a replay recomputes and ends the replay');
  for (let k = 0; k < 30 && !control('step').disabled; k++) control('step').click();
  const flipped = solve(cases.flipDB.edges.map(([winner, loser, weight]) => ({ winner, loser, weight })));
  check(root.dataset.playerFrame === String(flipped.events.length + 1) && text(rowOf(5), '[data-cs-outcome]') === 'Implied, skipped in pass 4', 'ContraSolver replays the edited graph to its own result');
  control('reset').click();
  act('cs-reset');
  check(pairs() === 'B ≻ C, C ≻ D, D ≻ E' && marker(5) === 'start', 'ContraSolver restore example after a replay');
  delete root.dataset.frameMs;

  /* ---------- ContraSolver: editing (unchanged behaviour) ---------- */
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
  const table4 = [...evidence.querySelectorAll('.cs-measured .rd-dumbbell-values')].map(el => el.textContent);
  check(same(table4, ['13.30% → 10.40%', '17.50% → 14.30%', '22.10% → 19.70%', '14.70% → 12.00%', '30.60% → 18.90%', '26.60% → 15.30%', '32.80% → 26.60%', '19.80% → 14.30%']), 'ContraSolver Table 4 measured values');
  check(text(evidence, 'h3') === 'How often a prompt’s self-judged preference graph contains a cycle' && root.textContent.includes('illustrative'), 'ContraSolver labels measured and illustrative data');

  /* ---------- Atomic to Composite ---------- */
  doc = await load('atomic-to-composite');
  root = doc.querySelector('[data-reasoning-demo="atomic-trace"]');
  const results = doc.querySelector('[data-reasoning-demo="atomic-evidence"]');
  check(doc.querySelector('#method .method-lead + .section-demo [data-reasoning-demo="atomic-trace"]'), 'Atomic path demo sits after the first Method paragraph');
  check(doc.querySelector('#findings .findings-grid + .section-demo [data-reasoning-demo="atomic-evidence"]') && !doc.querySelector('#explore'), 'Atomic measured charts sit in the evidence section');
  check(text(root, '.rd-eyebrow') === 'Published example · Figure 1(a)' && text(results, '.rd-eyebrow') === 'Measured · Tables 1(b) and 2', 'Atomic eyebrows name the evidence');
  check(!results.querySelector('table') && doc.querySelectorAll('.results-table').length === 1, 'Atomic charts do not duplicate the static Table 7');
  const scores = { iid: ['35.18', '90.30'], composition: ['28.20', '76.25'], zero: ['24.07', '18.41'] };
  for (const [split, [atomic, composite]] of Object.entries(scores)) {
    check(text(results, `[data-atomic-score="${split}-atomic"]`) === atomic && text(results, `[data-atomic-score="${split}-composite"]`) === composite, `Atomic ${split} shows Table 1(b) SFT accuracies`);
    const bars = results.querySelectorAll(`[data-split="${split}"] .ac-bar-track i`);
    check(parseFloat(bars[0].style.width) === Number(atomic) && parseFloat(bars[1].style.width) === Number(composite), `Atomic ${split} bar lengths equal the values`);
  }
  check(results.querySelectorAll('.ac-split').length === 3, 'Atomic all three splits are visible');
  check(text(results, '[data-atomic-gap="iid"]') === 'Composite SFT leads by 55.12 points' && text(results, '[data-atomic-gap="composition"]') === 'Composite SFT leads by 48.05 points', 'Atomic familiar-split gaps');
  check(text(results, '[data-atomic-gap="zero"]') === 'Order reverses: atomic SFT leads by 5.66 points', 'Atomic zero-shot reversal is stated');
  const errors = [...results.querySelectorAll('.ac-errors .rd-dumbbell-values')].map(el => el.textContent);
  check(same(errors, ['90% → 86%', '86% → 30%', '54.5% → 45.0%', '18.5% → 71.8%']), 'Atomic Table 2 error-location values');
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

  /* ---------- Atomic: hop-by-hop replay ---------- */
  const atomicControl = name => root.querySelector(`[data-demo-action="atomic-run-${name}"]`);
  const atomicStatus = () => root.querySelector('[data-player-status="atomic-run"]').textContent;
  const hopClass = () => [...root.querySelectorAll('[data-atomic-trace] li')].map(li => (li.classList.contains('is-current') ? 'C' : li.classList.contains('is-future') ? '-' : 'D')).join('');
  const currentFact = () => [...root.querySelectorAll('.ac-fact.is-current')].map(f => f.dataset.fact).join();
  check(root.dataset.playerState === 'complete' && atomicStatus() === '' && atomicControl('pause').disabled, 'Atomic replay waits for the reader');
  atomicControl('step').click();
  check(hopClass() === '---' && text(root, '[data-atomic-answer]') === '?' && atomicStatus() === 'Step 1 of 5 · The question names the start of the path; the answer needs 3 hops.', 'Atomic frame 1: the question only');
  atomicControl('step').click();
  check(hopClass() === 'C--' && currentFact() === 'context-0' && root.querySelector('[data-source-panel="context"]').classList.contains('is-current') && atomicStatus().includes('Hop 1, supplied document: Global View chief editor → Amina Khan.'), 'Atomic hop 1 reads the document fact');
  atomicControl('step').click();
  check(hopClass() === 'DC-' && currentFact() === 'memory-0' && root.querySelector('.ac-fact[data-fact="context-0"]').classList.contains('is-used') && atomicStatus().includes('The path crosses from the document into the model’s stored facts.'), 'Atomic hop 2 crosses into parametric memory');
  atomicControl('step').click();
  check(hopClass() === 'DDC' && currentFact() === 'memory-1' && !atomicStatus().includes('crosses'), 'Atomic hop 3 stays in memory');
  atomicControl('step').click();
  check(hopClass() === 'DDD' && text(root, '[data-atomic-answer]') === 'Research Analyst' && atomicStatus() === 'Step 5 of 5 · Answer: Research Analyst, reached through 1 document hop and 2 memory hops.' && atomicControl('step').disabled, 'Atomic last frame gives the answer and its sources');
  atomicControl('reset').click();
  check(root.dataset.playerState === 'complete' && hopClass() === 'DDD' && !root.querySelector('.ac-fact.is-current, .ac-fact.is-used') && atomicStatus() === '', 'Atomic Reset restores the full path');
  root.querySelector('[data-task="context"]').click();
  root.dataset.frameMs = '25';
  atomicControl('play').click();
  const seen = new Set();
  await waitFor(() => { seen.add(atomicStatus()); return root.dataset.playerState === 'paused'; });
  check(![...seen].some(s => s.includes('crosses')) && atomicStatus() === 'Step 4 of 4 · Answer: Chloe Davis, reached through 2 document hops.', 'Atomic context task never crosses sources');
  atomicControl('play').click();
  root.querySelector('[data-task="memory"]').click();
  check(root.dataset.playerState === 'complete' && text(root, '[data-atomic-answer]') === 'Research Analyst' && hopClass() === 'DD', 'Atomic switching task during a replay shows the new complete path');
  delete root.dataset.frameMs;

  /* ---------- Design constraints and layout ---------- */
  for (const slug of ['contrasolver', 'atomic-to-composite']) {
    for (const width of [1440, 390, 320]) {
      frame.style.width = `${width}px`;
      doc = await load(slug);
      check(doc.documentElement.scrollWidth <= width + 1, `${slug} at ${width}: no page overflow`);
      for (const demo of doc.querySelectorAll('[data-paper-demo]')) {
        // Check the replay mid-way too: it reveals different text.
        const step = demo.querySelector('[data-demo-action$="-run-step"]');
        for (const replaying of step ? [false, true] : [false]) {
          if (replaying) { step.click(); step.click(); step.click(); }
          check(demo.scrollWidth <= demo.clientWidth + 1, `${slug} at ${width}${replaying ? ' replay' : ''}: demo fits its frame`);
          const clipped = [...demo.querySelectorAll('p,h3,h4,h5,li,dd,button,span')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2 && frame.contentWindow.getComputedStyle(el).display !== 'inline');
          check(clipped.length === 0, `${slug} at ${width}${replaying ? ' replay' : ''}: no clipped text ${clipped.map(el => el.className).join(' ')}`);
        }
        if (width === 1440) {
          const styled = [...demo.querySelectorAll('*')].map(el => [el, frame.contentWindow.getComputedStyle(el)]);
          check(styled.every(([, s]) => s.borderRadius === '0px' || s.borderRadius === ''), `${slug}: sharp corners`);
          check(styled.every(([, s]) => s.boxShadow === 'none' && s.backgroundImage === 'none'), `${slug}: no shadows or gradients`);
          check(styled.every(([, s]) => s.animationName === 'none'), `${slug}: no keyframe animation`);
          const longest = Math.max(0, ...styled.flatMap(([, s]) => s.transitionDuration.split(',').map(parseFloat)));
          check(reduced ? longest === 0 : longest <= 0.6, `${slug}: transitions ${reduced ? 'removed under reduced motion' : 'at most 600 ms'} (${longest}s)`);
          check(styled.every(([el, s]) => !el.matches('button') || s.transform === 'none'), `${slug}: no transforms on controls`);
          check([...demo.querySelectorAll('svg rect')].every(rect => (rect.getAttribute('rx') || '0') === '0'), `${slug}: SVG rectangles are square`);
        }
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
    const visible = el => el.getClientRects().length > 0;
    check(![...doc.querySelectorAll('[data-demo-action]')].some(visible) && ![...doc.querySelectorAll('[data-player-status]')].some(visible), `${slug} no-JS ${width}: controls and replay status hidden`);
    check(doc.documentElement.scrollWidth <= width + 1, `${slug} no-JS ${width}: no page overflow`);
    check(doc.querySelectorAll('#method [data-paper-demo]').length === 1 && doc.querySelectorAll('#findings [data-paper-demo]').length === 1, `${slug} no-JS ${width}: both demo blocks render`);
    if (slug === 'contrasolver') {
      root = doc.querySelector('[data-reasoning-demo="preference-graph"]');
      check([...root.querySelectorAll('[data-cs-static]')].filter(visible).length === 10 && text(root, '[data-cs-static="5"]') === 'D ≻ B', `${slug} no-JS: every judgment is readable`);
      check(visible(root.querySelector('.cs-graph')) && root.querySelectorAll('.cs-edge.is-heuristic').length === 3 && root.querySelectorAll('.cs-edge.is-contradictory').length === 2 && !root.querySelector('.cs-edge.is-pending'), `${slug} no-JS: graph shows the computed classes`);
      check(root.querySelectorAll('.cs-log li').length === 4 && text(root, '[data-cs-pairs]') === 'B ≻ C, C ≻ D, D ≻ E', `${slug} no-JS: algorithm readout is complete`);
      check(!visible(root.querySelector('.cs-legend .is-pending')), `${slug} no-JS: replay-only legend entry hidden`);
      check(doc.querySelectorAll('.cs-measured .rd-dumbbell-row:not(.rd-axis-row)').length === 8, `${slug} no-JS: Table 4 chart`);
    } else {
      root = doc.querySelector('[data-reasoning-demo="atomic-trace"]');
      check(root.querySelectorAll('[data-atomic-trace] li').length === 3 && text(root, '[data-atomic-answer]') === 'Research Analyst', `${slug} no-JS: complete worked trace`);
      check(doc.querySelectorAll('.ac-split').length === 3 && text(doc, '[data-atomic-score="zero-atomic"]') === '24.07', `${slug} no-JS: all measured splits`);
    }
  }
  frame.remove();
  return { assertions, failures, reducedMotion: reduced };
})();
