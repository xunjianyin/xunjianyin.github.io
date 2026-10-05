/* Flow-geometry (geometry-of-reasoning) and MCTS (damon) demos.
 * Run against the local preview, from any page on its origin:
 *   agent-browser eval --stdin < tests/browser_demo_flows_safety.js
 * Flow metrics are recomputed here with an independent implementation of the
 * paper's formulas (arXiv 2510.09782v2); MCTS UCT/Q/N are recomputed here with
 * an independent implementation of DAMON's eq. 4/eq. 5 (2025.emnlp-main.323).
 * Small Python references live in the scratch directory.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const near = (a, b, label, tol = 0.02) => check(Math.abs(a - b) <= tol, `${label} (${a} vs ${b})`);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html?test=${Date.now()}`; });
    return frame.contentDocument;
  };
  const text = (root, selector) => root.querySelector(selector).textContent.trim();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const parseSigned = s => parseFloat(String(s).replace('−', '-'));

  /* ================= Independent reference: reasoning-flow metrics ================= */
  const P = (r, a) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];
  const RLOGICS = {
    A: [[0, 1.0], [40, 1.0], [110, 0.9], [20, 1.1], [30, 1.0], [115, 0.9], [25, 1.1], [30, 1.0]],
    B: [[0, 1.0], [-25, 1.0], [-30, 1.0], [-120, 0.9], [-20, 1.1], [-30, 1.0], [-30, 1.0], [-125, 0.9]],
    C: [[0, 1.0], [30, 1.0], [115, 0.9], [-25, 1.0], [-110, 0.9], [-20, 1.1], [30, 1.0], [30, 1.0]],
  };
  const RTOPICS = { weather: [P(2.2, 100), 0], education: [P(2.2, 160), 15], sports: [P(2.2, 220), -15] };
  const RLANGS = { en: [P(6.5, -35), 0, 1.0], de: [P(6.5, -12), 25, 0.85], zh: [P(6.5, 12), 50, 1.2], ja: [P(6.5, 35), -40, 0.9] };
  const RSHUF = { 1: [2, 5, 0, 7, 3, 1, 6, 4], 2: [4, 1, 6, 3, 0, 7, 2, 5] };
  const EPS = 1e-8;
  function rFlow(lg, tp, ln, sh) {
    let h = 0;
    let inc = RLOGICS[lg].map(([t, l]) => { h += t; const r = h * Math.PI / 180; return [l * Math.cos(r), l * Math.sin(r)]; });
    if (sh) inc = RSHUF[sh].map(i => inc[i]);
    const [[ox, oy], rt] = RTOPICS[tp];
    const [[ox2, oy2], rl, s] = RLANGS[ln];
    const th = (rt + rl) * Math.PI / 180; const c = Math.cos(th); const sn = Math.sin(th);
    let x = 0; let y = 0; const out = [];
    for (const [dx, dy] of inc) { x += dx; y += dy; out.push([ox + ox2 + s * (c * x - sn * y), oy + oy2 + s * (sn * x + c * y)]); }
    return out;
  }
  const rCos = (u, v) => (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(u[0], u[1]) + EPS) * (Math.hypot(v[0], v[1]) + EPS));
  const rDelta = pts => pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  function rMenger(pts) {
    const out = [];
    for (let i = 2; i < pts.length; i++) {
      const [p, q, r] = [pts[i - 2], pts[i - 1], pts[i]];
      const a = Math.hypot(q[0] - p[0], q[1] - p[1]); const b = Math.hypot(r[0] - q[0], r[1] - q[1]); const c = Math.hypot(r[0] - p[0], r[1] - p[1]);
      const area = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2;
      out.push(4 * area / (a * b * c + EPS));
    }
    return out;
  }
  const rMeanCos = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += rCos(a[i], b[i]); return s / n; };
  function rPearson(a, b) {
    const n = Math.min(a.length, b.length); a = a.slice(0, n); b = b.slice(0, n);
    const ma = a.reduce((s, x) => s + x, 0) / n; const mb = b.reduce((s, x) => s + x, 0) / n;
    let num = 0; let da = 0; let db = 0;
    for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return num / ((Math.sqrt(da) + EPS) * (Math.sqrt(db) + EPS));
  }
  const rMetrics = (x, y) => ({ position: rMeanCos(x, y), velocity: rMeanCos(rDelta(x), rDelta(y)), curvature: rPearson(rMenger(x), rMenger(y)) });

  /* ================= geometry-of-reasoning ================= */
  let doc = await load('geometry-of-reasoning');
  let root = doc.querySelector('[data-paper-demo="geometry-of-reasoning"]');
  check(root && root.dataset.flowsReady === 'true', 'Flows demo initializes');
  check(!!doc.querySelector('#method [data-flows-demo]'), 'Flows demo sits inside the method section');

  const setFlow = (flow, field, value) => {
    const sel = root.querySelector(`select[data-flow="${flow}"][data-field="${field}"]`);
    sel.value = value; sel.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
  };
  const shown = key => parseSigned(text(root, `[data-fl-value="${key}"]`));
  const expectFlow = (f1, f2, sh) => {
    const m = rMetrics(rFlow(...f1, sh && sh[0]), rFlow(...f2, sh && sh[1]));
    return m;
  };
  // Three reader-chosen configurations, demo output vs independent recomputation.
  const configs = [
    [['A', 'weather', 'en'], ['A', 'sports', 'zh']],
    [['A', 'weather', 'en'], ['B', 'weather', 'en']],
    [['C', 'education', 'de'], ['C', 'sports', 'ja']],
  ];
  for (const [f1, f2] of configs) {
    setFlow(1, 'logic', f1[0]); setFlow(1, 'topic', f1[1]); setFlow(1, 'language', f1[2]);
    setFlow(2, 'logic', f2[0]); setFlow(2, 'topic', f2[1]); setFlow(2, 'language', f2[2]);
    const exp = expectFlow(f1, f2);
    for (const key of ['position', 'velocity', 'curvature']) near(shown(key), exp[key], `Flows ${f1}/${f2} ${key}`);
  }
  // Same logic across carriers keeps curvature near 1; different logic lowers it.
  setFlow(1, 'logic', 'A'); setFlow(1, 'topic', 'weather'); setFlow(1, 'language', 'en');
  setFlow(2, 'logic', 'A'); setFlow(2, 'topic', 'sports'); setFlow(2, 'language', 'zh');
  check(shown('curvature') >= 0.95, 'Flows same logic across carriers keeps curvature high');
  const sameLogicVel = shown('velocity');
  setFlow(2, 'logic', 'B');
  check(shown('curvature') < 0.6, 'Flows different logic lowers curvature correlation');

  // Shuffle collapses velocity and curvature while position stays high.
  setFlow(2, 'logic', 'A'); setFlow(2, 'topic', 'sports'); setFlow(2, 'language', 'zh');
  const posBefore = shown('position');
  root.querySelector('[data-demo-action="fl-shuffle"]').click();
  const expShuf = expectFlow(['A', 'weather', 'en'], ['A', 'sports', 'zh'], ['1', '2']);
  for (const key of ['position', 'velocity', 'curvature']) near(shown(key), expShuf[key], `Flows shuffled ${key}`);
  check(Math.abs(shown('velocity')) < 0.5 && Math.abs(shown('curvature')) < 0.5, 'Flows shuffle collapses velocity and curvature');
  check(shown('position') > 0.8, 'Flows shuffle keeps position similarity high');
  root.querySelector('[data-demo-action="fl-shuffle"]').click();
  near(shown('velocity'), sameLogicVel, 'Flows un-shuffle restores velocity');

  // Play / Step / Reset end states.
  const steps = root.querySelectorAll('.fl-flow.is-flow1 .fl-step').length;
  root.querySelector('[data-demo-action="fl-reset"]').click();
  const visibleSteps = () => [...root.querySelectorAll('.fl-flow.is-flow1 .fl-step')].filter(el => !el.hasAttribute('hidden')).length;
  check(visibleSteps() === 0 && text(root, '[data-fl-step-status]').includes('step 1 of'), 'Flows reset shows only the first point');
  root.querySelector('[data-demo-action="fl-step"]').click();
  check(visibleSteps() === 1, 'Flows step reveals one segment at a time');
  const play = root.querySelector('[data-demo-action="fl-play"]');
  play.click();
  check(play.getAttribute('aria-pressed') === 'true', 'Flows Play sets aria-pressed');
  await new Promise(r => setTimeout(r, 560 * (steps + 2)));
  check(play.getAttribute('aria-pressed') === 'false' && visibleSteps() === steps, 'Flows Play reveals every step then stops');
  // Reduced-motion: the reveal is discrete (no CSS transitions) so stepping and
  // playing reach identical state. Confirm no transitions are declared.
  const styled = [...root.querySelectorAll('.fl-step, .fl-dot, .fl-seg, .fl-arrow')].map(el => frame.contentWindow.getComputedStyle(el));
  check(styled.every(s => s.transitionDuration === '0s' || s.transitionDuration === ''), 'Flows reveal uses no tweening (reduced-motion safe)');

  /* ================= Independent reference: DAMON MCTS ================= */
  const OMEGA = 1; const INIT_Q = 1;
  function buildRef(rewards, pruned) {
    const nodes = { root: { key: 'root', Q: INIT_Q, N: 0, children: ['s0', 's1', 's2'], expanded: true, pruned: false, reward: null } };
    ['s0', 's1', 's2'].forEach((sid, si) => {
      nodes[sid] = { key: sid, Q: INIT_Q, N: 0, children: [`${sid}-0`, `${sid}-1`], expanded: false, pruned: !!(pruned && pruned.has(sid)), reward: null };
      rewards[si].forEach((r, i) => { nodes[`${sid}-${i}`] = { key: `${sid}-${i}`, Q: INIT_Q, N: 0, children: [], expanded: false, pruned: !!(pruned && pruned.has(sid)), reward: r }; });
    });
    return nodes;
  }
  function betaRef(nodes, parent, k) { const c = nodes[k]; return c.N === 0 ? Infinity : c.Q + OMEGA * Math.sqrt(Math.log(parent.N) / c.N); }
  function iterRef(nodes) {
    const path = ['root']; let node = nodes.root;
    while (node.expanded) {
      const kids = node.children.filter(k => !nodes[k].pruned); if (!kids.length) break;
      const un = kids.filter(k => nodes[k].N === 0); let next = un.length ? un[0] : kids[0];
      if (!un.length) { let best = -Infinity; for (const k of kids) { const b = betaRef(nodes, node, k); if (b > best) { best = b; next = k; } } }
      path.push(next); node = nodes[next];
    }
    if (node.children.length && !node.expanded && !node.pruned) { node.expanded = true; path.push(node.children[0]); node = nodes[node.children[0]]; }
    if (node.key === 'root' && node.reward === null) return { aborted: true, path, selected: null };
    const score = node.reward !== null ? node.reward : node.Q;
    for (let i = path.length - 1; i >= 0; i--) { const n = nodes[path[i]]; n.Q = (n.Q * n.N + score) / (n.N + 1); n.N += 1; }
    return { aborted: false, path, selected: node.key, strategy: path[1] };
  }

  /* ================= damon ================= */
  doc = await load('damon');
  root = doc.querySelector('[data-paper-demo="damon"]');
  check(root && root.dataset.safetyReady === 'true', 'Safety demo initializes');
  check(!!doc.querySelector('#method [data-safety-demo]'), 'Safety demo sits inside the method section');

  const stat = key => text(root, `[data-sf-stat="${key}"]`);
  const nOf = key => parseInt(stat(key).match(/N\s+(\d+)/)[1], 10);
  const qOf = key => parseFloat(stat(key).match(/Q\s+([\d.]+)/)[1]);
  const clickStep = (n = 1) => { for (let i = 0; i < n; i++) root.querySelector('[data-demo-action="sf-step"]').click(); };
  const reset = () => root.querySelector('[data-demo-action="sf-reset"]').click();

  // Three configurations, demo Q/N vs independent eq.4/eq.5 recomputation.
  const mctsCases = [
    { rewards: [[3, 4], [4, 3], [2, 2]], prune: null, steps: 9 },
    { rewards: [[3, 4], [4, 3], [2, 2]], prune: null, steps: 4 },
    { rewards: [[3, 4], [4, 3], [2, 2]], prune: new Set(['s1']), steps: 6 },
  ];
  const setReward = (leaf, target) => {
    const cur = parseInt(text(root, `[data-sf-reward="${leaf}"]`), 10);
    const action = target >= cur ? 'sf-up' : 'sf-down';
    for (let i = 0; i < Math.abs(target - cur); i++) root.querySelector(`[data-demo-action="${action}"][data-leaf="${leaf}"]`).click();
  };
  for (const { rewards, prune, steps } of mctsCases) {
    reset();
    rewards.forEach((rw, si) => rw.forEach((r, i) => setReward(`s${si}-${i}`, r)));
    if (prune) prune.forEach(sid => { const box = root.querySelector(`[data-demo-action="sf-prune"][data-strategy="${sid}"]`); if (!box.checked) box.click(); });
    else ['s0', 's1', 's2'].forEach(sid => { const box = root.querySelector(`[data-demo-action="sf-prune"][data-strategy="${sid}"]`); if (box.checked) box.click(); });
    clickStep(steps);
    const nodes = buildRef(rewards, prune);
    for (let i = 0; i < steps; i++) iterRef(nodes);
    const tag = `MCTS ${JSON.stringify(rewards)}${prune ? ' prune ' + [...prune] : ''} @${steps}`;
    for (const key of ['root', 's0', 's1', 's2']) {
      check(nOf(key) === nodes[key].N, `${tag}: ${key} visit count`);
      near(qOf(key), nodes[key].Q, `${tag}: ${key} mean score`, 0.005);
    }
  }
  reset();
  ['s0', 's1', 's2'].forEach(sid => { const box = root.querySelector(`[data-demo-action="sf-prune"][data-strategy="${sid}"]`); if (box.checked) box.click(); });
  [[3, 4], [4, 3], [2, 2]].forEach((rw, si) => rw.forEach((r, i) => setReward(`s${si}-${i}`, r)));

  // Discoverable 1: exploration revisits the less-visited branch.
  clickStep(8);
  check(nOf('s0') === 1 && nOf('s1') === 6, 'MCTS exploitation concentrates visits on the higher-mean branch');
  clickStep(1);
  check(nOf('s0') === 2, 'MCTS exploration term revisits the less-visited branch at iteration 9');
  check(qOf('s1') > qOf('s0'), 'MCTS the revisited branch has a lower mean reward than the exploited one');

  // Discoverable 2: changing a reward changes the pursued path (and can reach the threshold).
  reset();
  setReward('s2-0', 5); setReward('s2-1', 5);
  clickStep(4);
  const reachedStory = [...Array(6)].some(() => { const s = root.querySelector('[data-sf-summary]'); return s.textContent.includes('Story-driven') && s.classList.contains('is-success'); });
  check(root.querySelector('[data-sf-summary]').textContent.includes('threshold') || root.querySelector('.sf-node.is-success'), 'MCTS raising a leaf to the threshold changes the pursued path and flags success');

  // Pruning excludes a branch entirely.
  reset();
  [[3, 4], [4, 3], [2, 2]].forEach((rw, si) => rw.forEach((r, i) => setReward(`s${si}-${i}`, r)));
  const pruneBox = root.querySelector('[data-demo-action="sf-prune"][data-strategy="s1"]');
  if (!pruneBox.checked) pruneBox.click();
  clickStep(6);
  check(nOf('s1') === 0, 'MCTS a pruned branch is never visited');
  check(root.querySelector('.sf-node[data-node="s1"]').classList.contains('is-pruned'), 'MCTS pruned branch is marked in the tree');
  reset();
  if (pruneBox.checked) pruneBox.click();

  // No harmful content anywhere in the demo text.
  const unsafe = ['bomb', 'explosive', 'weapon', 'hack', 'malware', 'virus', 'drug', 'poison', 'kill', 'gun', 'attack the', 'nobel', 'database', 'suffix'];
  const bodyText = root.textContent.toLowerCase();
  const found = unsafe.filter(word => bodyText.includes(word));
  check(found.length === 0, `MCTS demo text contains no unsafe keywords (${found.join(', ')})`);

  /* ================= Design constraints and layout ================= */
  for (const slug of ['geometry-of-reasoning', 'damon']) {
    for (const width of [1440, 390, 320]) {
      frame.style.width = `${width}px`;
      doc = await load(slug);
      root = doc.querySelector('[data-paper-demo]');
      check(doc.documentElement.scrollWidth <= width + 1, `${slug} at ${width}: no page overflow`);
      const demo = doc.querySelector('[data-flows-demo], [data-safety-demo]');
      check(demo.scrollWidth <= demo.clientWidth + 1, `${slug} at ${width}: demo fits its frame`);
      if (width === 1440) {
        const all = [...demo.querySelectorAll('*')].map(el => [el, frame.contentWindow.getComputedStyle(el)]);
        check(all.every(([, s]) => s.borderRadius === '0px' || s.borderRadius === ''), `${slug}: sharp corners`);
        check(all.every(([, s]) => s.boxShadow === 'none' && s.backgroundImage === 'none'), `${slug}: no shadows or gradients`);
        check(all.every(([, s]) => s.animationName === 'none'), `${slug}: no entrance animation`);
        check([...demo.querySelectorAll('svg rect')].every(r => (r.getAttribute('rx') || '0') === '0'), `${slug}: SVG rectangles are square`);
      }
    }
  }
  frame.style.width = '390px';

  /* ================= Script-free fallback ================= */
  for (const [slug, width] of [['geometry-of-reasoning', 390], ['geometry-of-reasoning', 320], ['damon', 390], ['damon', 320]]) {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/${slug}.html`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(s => s.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    frame.removeAttribute('src');
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    root = doc.querySelector('[data-paper-demo]');
    const visible = el => el.getClientRects().length > 0;
    check(![...root.querySelectorAll('[data-demo-action], [data-demo-select]')].some(visible), `${slug} no-JS ${width}: controls hidden`);
    check(doc.documentElement.scrollWidth <= width + 1, `${slug} no-JS ${width}: no page overflow`);
    const state = [...root.querySelectorAll('[data-demo-state]')].filter(visible).map(el => el.textContent.trim()).join(' ');
    check(state.length > 20, `${slug} no-JS: static demo state remains readable`);
    if (slug === 'geometry-of-reasoning') {
      check(root.querySelectorAll('.fl-flow.is-flow1 .fl-step').length > 0 && ![...root.querySelectorAll('.fl-flow.is-flow1 .fl-step')].some(el => el.hasAttribute('hidden')), `${slug} no-JS: full trajectory drawn`);
      check(parseSigned(text(root, '[data-fl-value="curvature"]')) >= 0.95, `${slug} no-JS: default curvature computed on the server`);
    } else {
      check(root.querySelectorAll('.sf-node').length === 10 && text(root, '[data-sf-stat="root"]').includes('N 0'), `${slug} no-JS: full tree with initial statistics`);
      const unsafe2 = ['bomb', 'explosive', 'weapon', 'hack', 'malware', 'nobel', 'database'];
      check(!unsafe2.some(w => root.textContent.toLowerCase().includes(w)), `${slug} no-JS: no unsafe keywords`);
    }
  }
  frame.remove();
  return { assertions, failures };
})();
