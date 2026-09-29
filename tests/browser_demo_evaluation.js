/* Evaluation demos (DSGram, data-to-text MQM, Cont-COMET, RERIC).
 * Run against the local preview: agent-browser eval --stdin < tests/browser_demo_evaluation.js
 * Every expected number is recomputed here independently of papers/demos/evaluation.js:
 * AHP weights use the row geometric mean and lambda_max the closed form for 3 x 3
 * reciprocal matrices (both exact for n = 3), while the page uses power iteration.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html?t=${Date.now()}`; });
    return frame.contentDocument;
  };
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const click = (root, value) => root.querySelector(`[data-demo-action="${value}"]`).click();
  const setValue = (el, value) => { el.value = value; el.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true })); };
  const fmt = (value, digits = 3) => value.toFixed(digits).replace('-', '−');
  const noOverflow = (doc, width) => doc.documentElement.scrollWidth <= width + 1;

  /* ---------------- DSGram: AHP ---------------- */
  const saaty = p => (p <= 0 ? 1 - p : 1 / (1 + p));
  const expectedAhp = ([p12, p13, p23]) => {
    const a12 = saaty(p12), a13 = saaty(p13), a23 = saaty(p23);
    const g = [Math.cbrt(a12 * a13), Math.cbrt(a23 / a12), Math.cbrt(1 / (a13 * a23))];
    const total = g[0] + g[1] + g[2];
    const rho = a13 / (a12 * a23);
    const lambda = 1 + Math.cbrt(rho) + 1 / Math.cbrt(rho);
    const ci = Math.max(0, (lambda - 3) / 2);
    return { w: g.map(x => x / total), lambda, ci, cr: ci / 0.58 };
  };
  let doc = await load('dsgram');
  let root = doc.querySelector('[data-paper-demo="dsgram"]');
  check(root.dataset.demoReady === 'true' && !root.querySelector('[data-demo-controls]').hidden, 'DSGram controls initialize');
  const sliders = [0, 1, 2].map(k => root.querySelector(`[data-demo-range="judgment-${k}"]`));
  const setJudgments = values => values.forEach((v, k) => setValue(sliders[k], v));
  const shown = () => ({
    w: [0, 1, 2].map(k => text(root.querySelector(`[data-eval-weight="${k}"]`))),
    lambda: text(root.querySelector('[data-eval-lambda]')),
    ci: text(root.querySelector('[data-eval-ci]')),
    cr: text(root.querySelector('[data-eval-cr]')),
    totals: [0, 1].map(k => text(root.querySelector(`[data-eval-total="${k}"]`))),
  });
  const cards = { a: [[8, 8, 9], [2, 10, 5]], b: [[8, 8, 3], [9, 6, 8]] };
  const verifyAhp = (values, context, label) => {
    const e = expectedAhp(values), s = shown();
    check(s.w.join() === e.w.map(x => fmt(x)).join(), `${label}: weights ${s.w} vs ${e.w.map(x => fmt(x))}`);
    check(s.lambda === fmt(e.lambda) && s.ci === fmt(e.ci) && s.cr === fmt(e.cr), `${label}: lambda/CI/CR ${s.lambda}/${s.ci}/${s.cr}`);
    const totals = cards[context].map(sc => fmt(sc.reduce((sum, x, k) => sum + x * e.w[k], 0), 2));
    check(s.totals.join() === totals.join(), `${label}: weighted scores ${s.totals} vs ${totals}`);
    const flag = root.querySelector('[data-eval-consistency]');
    check(flag.classList.contains(e.cr < 0.1 ? 'is-ok' : 'is-bad'), `${label}: consistency flag follows CR < 0.1`);
    return e;
  };
  // Initial state: Figure 5(a) with the closest consistent Saaty judgments (SC:EL 1, SC:F 1/2, EL:F 1).
  let e = verifyAhp([0, 1, 0], 'a', 'DSGram initial (a)');
  check(fmt(e.w[0]) === '0.260' && fmt(e.w[1]) === '0.327' && fmt(e.w[2]) === '0.413' && fmt(e.cr) === '0.046', 'DSGram initial numbers match hand calculation');
  check(text(root).includes('0.268') && text(root).includes('0.295') && text(root).includes('0.437') && text(root).includes('8.44'), 'DSGram shows Figure 5(a) weights and score');
  check(root.querySelector('[data-eval-cell="02"]').textContent === '1/2' && root.querySelector('[data-eval-cell="20"]').textContent === '2', 'DSGram matrix is reciprocal');
  for (const values of [[4, 2, 0], [8, 1, -4], [-3, -1, 2], [2, -5, -6], [0, 0, 0], [-8, 8, -8], [5, 5, 5]]) {
    setJudgments(values); verifyAhp(values, 'a', `DSGram judgments ${values}`);
  }
  // Inconsistency: a cycle SC > EL > F > SC gives equal weights but CR = 1.149.
  click(root, 'preset-cyclic');
  e = verifyAhp([-2, 2, -2], 'a', 'DSGram cyclic preset');
  check(fmt(e.cr) === '1.149' && fmt(e.w[0]) === '0.333', 'DSGram cyclic judgments: equal weights, CR 1.149');
  const verdict = () => text(root.querySelector('[data-eval-verdict]'));
  check(verdict().includes('cycle') && verdict().includes('Inconsistent') && verdict().includes('rejects'), 'DSGram flags the cyclic matrix');
  check(root.querySelector('[data-demo-action="preset-cyclic"]').getAttribute('aria-pressed') === 'true', 'DSGram cyclic preset is pressed');
  // Inconsistent without a cycle: SC 3x EL, SC = F, EL 3x F.
  setJudgments([-2, 0, -2]);
  e = verifyAhp([-2, 0, -2], 'a', 'DSGram inconsistent magnitudes');
  check(e.cr > 0.1 && verdict().includes('Inconsistent') && !verdict().includes('cycle'), 'DSGram flags inconsistent magnitudes without claiming a cycle');
  click(root, 'preset-equal');
  check(shown().cr === '0.000' && shown().w.every(x => x === '0.333'), 'DSGram equal preset');
  // Reversal: edit-level dominant but consistent judgments prefer the meaning-destroying output #4.
  setJudgments([8, 1, -4]);
  check(root.querySelector('[data-eval-card="1"]').classList.contains('is-preferred') && verdict().includes('prefer DSGram-Eval #4') && verdict().includes('Consistent'), 'DSGram consistent edit-level weights reverse the preference');
  // Context changes the judgments (Figure 5(b)) and the paper's weights.
  click(root, 'context-b');
  e = verifyAhp([4, 2, 0], 'b', 'DSGram context (b)');
  check(sliders.map(s => s.value).join() === '4,2,0', 'DSGram context (b) loads its closest-match judgments');
  check(text(root).includes('0.118') && text(root).includes('0.487') && text(root).includes('0.396') && text(root).includes('6.02'), 'DSGram shows Figure 5(b) weights and score');
  check(root.querySelector('[data-demo-action="context-b"]').getAttribute('aria-pressed') === 'true' && root.querySelector('[data-demo-action="context-a"]').getAttribute('aria-pressed') === 'false', 'DSGram context buttons expose state');
  check(text(root).includes('Formal expression') && text(root).includes('forest had swung'), 'DSGram shows the Figure 5(b) pair');
  setJudgments([8, 1, -4]);
  check(root.querySelector('[data-eval-card="0"]').classList.contains('is-preferred'), 'DSGram edit-level weights prefer the Figure 5(b) correction over #11');
  setJudgments([0, 3, 3]);
  check(root.querySelector('[data-eval-card="1"]').classList.contains('is-preferred'), 'DSGram fluency weights prefer #11');
  check(sliders[0].getAttribute('aria-valuetext') === 'Equal importance (1)' && sliders[1].getAttribute('aria-valuetext').startsWith('Fluency 4×'), 'DSGram sliders have readable values');
  check(root.querySelector('[data-eval-verdict]').getAttribute('role') === 'status' && root.querySelector('[data-eval-verdict]').getAttribute('aria-live') === 'polite', 'DSGram live verdict');
  check(!text(root).includes('NaN') && !text(root).includes('Infinity'), 'DSGram has no invalid numbers');

  /* ---------------- Data-to-text: annotation score ---------------- */
  doc = await load('seq2seq-data2text');
  root = doc.querySelector('[data-paper-demo="seq2seq-data2text"]');
  const type = root.querySelector('[data-demo-select="type"]');
  const word = i => root.querySelector(`[data-d2t-word="${i}"]`);
  const triple = i => root.querySelector(`[data-d2t-triple="${i}"]`);
  const severity = name => root.querySelector(`[data-severity="${name}"]`).click();
  const score = () => text(root.querySelector('[data-eval-score]'));
  const mqm = penalty => fmt((1 - penalty / 20) * 100, 1);
  const pick = name => { type.value = name; type.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true })); };
  check(root.querySelectorAll('button[data-d2t-word]').length === 20, 'Data2text: 20 keyboard-accessible word buttons');
  check(word(20).textContent === 'Georgetown' && triple(4).closest('li').textContent.includes('county Seat'), 'Data2text uses the Table 2 output and triples');
  check(score() === '100.0', 'Data2text starts unannotated');
  pick('Inaccuracy Intrinsic'); severity('Major'); word(20).click();
  check(score() === mqm(3) && word(20).getAttribute('aria-pressed') === 'true', 'Data2text one Major word: (1 - 3/20) x 100');
  triple(4).click();
  check(score() === mqm(6) && score() === '70.0' && triple(4).getAttribute('aria-pressed') === 'true', 'Data2text omission has length 1: score 70.0');
  pick('Addition'); severity('Minor'); word(8).click(); word(9).click();
  check(score() === mqm(8), 'Data2text two-word Minor segment adds 2');
  check([...root.querySelectorAll('.eval-annotation tbody tr')].some(tr => tr.textContent.includes('the English') && tr.textContent.includes('Addition')), 'Data2text merges adjacent words into one segment');
  // Changing only the type leaves the score unchanged: the formula has no type weight.
  pick('Word Form'); word(8).click(); word(9).click();
  check(score() === mqm(8), 'Data2text type change keeps the score');
  word(9).click();
  check(score() === mqm(7), 'Data2text selecting the same label again removes it');
  // Critical errors over a long span push one output below zero.
  pick('Inaccuracy Extrinsic'); severity('Critical');
  for (const i of [13, 14, 15, 16, 17, 18, 19]) word(i).click();
  const penalty = 3 + 3 + 1 + 7 * 7;
  check(score() === mqm(penalty) && score().startsWith('−'), `Data2text negative score ${score()} vs ${mqm(penalty)}`);
  check(text(root.querySelector('[data-eval-verdict]')).includes('negative'), 'Data2text explains the negative score');
  click(root, 'clear');
  check(score() === '100.0' && !root.querySelector('[data-d2t-word][aria-pressed="true"]'), 'Data2text clear');
  // Reveal the paper's annotation after matching it with Major severities.
  pick('Inaccuracy Intrinsic'); severity('Major'); word(20).click(); triple(4).click();
  click(root, 'reveal');
  const paper = root.querySelector('[data-eval-paper]');
  check(paper && text(paper).includes('Georgetown') && text(paper).includes('Inaccuracy Intrinsic') && text(paper).includes('Omission') && text(paper).includes('not reported'), 'Data2text reveal shows the paper annotation');
  check(text(paper).includes('you agree (Major)'), 'Data2text reveal compares with the reader');
  const grid = (r, c) => text(root.querySelector(`[data-eval-grid="${r}-${c}"]`));
  const alpha = { Minor: 1, Major: 3, Critical: 7 };
  for (const r of Object.keys(alpha)) for (const c of Object.keys(alpha)) check(grid(r, c) === mqm(alpha[r] + alpha[c]), `Data2text paper annotation score ${r}/${c}`);
  check(root.querySelector('[data-eval-grid="Major-Major"]').classList.contains('is-active'), 'Data2text highlights the reader severities');
  check(word(20).classList.contains('is-paper') && triple(4).closest('li').classList.contains('is-paper') && !triple(4).closest('li').querySelector('[data-eval-paper-note]').hidden, 'Data2text marks the paper spans');
  check(text(root).includes('5.97') && text(root).includes('Table 6'), 'Data2text shows measured Table 6');
  check(root.querySelector('[data-demo-action="reveal"]').getAttribute('aria-pressed') === 'true', 'Data2text reveal toggle state');
  click(root, 'reveal');
  check(!root.querySelector('[data-eval-paper]'), 'Data2text hides the paper annotation again');

  /* ---------------- Cont-COMET: selection ---------------- */
  doc = await load('context-aware-evaluation');
  root = doc.querySelector('[data-paper-demo="context-aware-evaluation"]');
  const contConfig = JSON.parse(root.querySelector('.eval-config').textContent);
  const selectedIds = () => [...root.querySelectorAll('.eval-context-row.is-selected .eval-position')].map(el => el.textContent).sort().join();
  const expectSelection = (budget, decay, previousOnly) => contConfig.sentences
    .filter(s => !previousOnly || s.side === 'previous')
    .map(s => ({ id: s.id, score: s.similarity * decay ** s.distance }))
    .sort((a, b) => b.score - a.score).slice(0, budget).map(s => s.id).sort().join();
  for (const [budget, decay] of [[2, 80], [2, 100], [3, 50], [1, 100], [4, 30], [5, 90]]) {
    setValue(root.querySelector('[data-demo-range="budget"]'), budget);
    setValue(root.querySelector('[data-demo-range="decay"]'), decay);
    check(selectedIds() === expectSelection(budget, decay / 100, false), `Cont-COMET selection budget ${budget}, alpha ${decay / 100}`);
    const scores = [...root.querySelectorAll('.eval-context-number')].map(el => el.firstChild.textContent);
    const expected = contConfig.sentences.map(s => (s.similarity * (decay / 100) ** s.distance).toFixed(3));
    check(scores.join() === expected.join(), `Cont-COMET scores = cos x alpha^distance at ${decay / 100}`);
  }
  setValue(root.querySelector('[data-demo-range="budget"]'), 2);
  setValue(root.querySelector('[data-demo-range="decay"]'), 100);
  check(selectedIds() === ['+1', '−3'].sort().join() && text(root.querySelector('[data-eval-verdict]')).includes('swap 1 sentence'), 'Cont-COMET no decay selects the distant canoe sentence, unlike a window');
  setValue(root.querySelector('[data-demo-range="decay"]'), 20);
  check(text(root.querySelector('[data-eval-verdict]')).includes('matches an adjacent window'), 'Cont-COMET strong decay reduces to an adjacent window');
  click(root, 'previous');
  check(selectedIds() === expectSelection(2, 0.2, true) && !selectedIds().includes('+'), 'Cont-COMET previous-only selection');

  /* ---------------- RERIC: Equation 11 ---------------- */
  doc = await load('error-robust-retrieval');
  root = doc.querySelector('[data-paper-demo="error-robust-retrieval"]');
  const rConfig = JSON.parse(root.querySelector('.eval-config').textContent);
  const rows = () => [...root.querySelectorAll('tbody tr')].map(tr => ({ name: [...tr.querySelectorAll('.eval-character')].map(c => c.textContent).join(''), cells: [...tr.querySelectorAll('td')].map(td => text(td)) }));
  const expectReric = (distances, w, rerank = true) => rConfig.candidates.map((c, i) => {
    const overlap = c.tokens.reduce((sum, t, k) => sum + (t === rConfig.query[k] ? w[k] : 0), 0) / 3;
    return { name: c.tokens.join(''), cells: [fmt(distances[i]), fmt(overlap), fmt(rerank ? (1 - overlap) * distances[i] : distances[i])], key: rerank ? (1 - overlap) * distances[i] : distances[i] };
  }).sort((a, b) => a.key - b.key);
  const setReric = (neighbor, center, distances) => {
    setValue(root.querySelector('[data-demo-range="neighbor"]'), neighbor);
    setValue(root.querySelector('[data-demo-range="center"]'), center);
    distances.forEach((d, i) => setValue(root.querySelector(`[data-demo-range="distance-${i}"]`), d));
  };
  const verifyReric = (neighbor, center, distances, label, rerank = true) => {
    const w = [neighbor / 100, center / 100, neighbor / 100];
    const got = rows(), want = expectReric(distances, w, rerank);
    check(got.map(r => r.name).join() === want.map(r => r.name).join(), `${label}: order ${got.map(r => r.name)}`);
    check(got.map(r => r.cells.join('|')).join() === want.map(r => r.cells.join('|')).join(), `${label}: alpha and adjusted distances`);
    return got[0].name;
  };
  check(text(root).includes('1.68') && text(root).includes('0.68'), 'RERIC starts from Table 3 weights');
  check(verifyReric(168, 68, [0.2, 0.3, 0.5], 'RERIC Table 3 weights') === '这几个', 'RERIC Table 3 weights: farther double match ranks first');
  check(rows()[0].cells[1] === '1.120' && rows()[0].cells[2] === '−0.060', 'RERIC alpha 1.12 makes the adjusted distance negative');
  check(text(root.querySelector('[data-eval-verdict]')).includes('exceeds 1') && text(root.querySelector('[data-eval-verdict]')).includes('Figure 1'), 'RERIC explains alpha above 1');
  click(root, 'weights-equal');
  check(verifyReric(100, 100, [0.2, 0.3, 0.5], 'RERIC equal weights') === '这以后', 'RERIC equal weights keep the center-copy error');
  check(root.querySelector('[data-demo-action="weights-equal"]').getAttribute('aria-pressed') === 'true', 'RERIC equal weights pressed');
  setReric(140, 68, [0.2, 0.3, 0.5]);
  check(verifyReric(140, 68, [0.2, 0.3, 0.5], 'RERIC neighbor 1.40') === '这一个', 'RERIC alpha below 1 lets the nearer double match win');
  setReric(168, 68, [0.2, 0.6, 0.5]);
  check(verifyReric(168, 68, [0.2, 0.6, 0.5], 'RERIC user distances') === '这一个', 'RERIC reader distances change the winner');
  setReric(168, 20, [0.25, 0.4, 0.9]);
  verifyReric(168, 20, [0.25, 0.4, 0.9], 'RERIC center 0.20');
  click(root, 'raw');
  check(verifyReric(168, 20, [0.25, 0.4, 0.9], 'RERIC raw retrieval', false) === '这以后' && text(root.querySelector('[data-eval-verdict]')).includes('repeats the input error'), 'RERIC raw retrieval copies the error');
  click(root, 'rerank');
  const input = root.querySelector('[data-demo-range="distance-1"]');
  setValue(input, '');
  check(input.getAttribute('aria-invalid') === 'true' && !text(root).includes('NaN'), 'RERIC rejects an empty distance without NaN');

  /* ---------------- Initial JS state equals the server-rendered state; no-JS fallback ---------------- */
  const staticDoc = async (slug, width) => {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/${slug}.html?t=${Date.now()}`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script:not([type="application/json"])').forEach(s => s.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    return frame.contentDocument;
  };
  const fallback = {
    'dsgram': ['0.260', '0.327', '0.413', '3.054', '0.046', 'Consistent', '8.41', '8.44', '0.268', 'Figure 5', 'Measured', 'Adapted'],
    'seq2seq-data2text': ['Georgetown', 'county Seat', 'Inaccuracy Intrinsic', 'Omission', 'not reported', '70.0', '30.0', '90.0', '5.97', 'Measured', 'Adapted'],
    'context-aware-evaluation': ['0.560', '0.704', 'Selected', 'Illustrative', 'Adapted'],
    'error-robust-retrieval': ['这几个', '−0.060', '1.120', 'Nearest candidate: 这几个', 'Illustrative', 'Adapted'],
  };
  const staticResults = {};
  for (const width of [390, 320]) {
    for (const [slug, needles] of Object.entries(fallback)) {
      doc = await staticDoc(slug, width);
      const demo = doc.querySelector('[data-paper-demo]');
      const state = demo.querySelector('[data-demo-state]');
      for (const needle of needles) check(text(state).includes(needle), `${slug} no-JS state at ${width} contains ${needle}`);
      check(demo.querySelector('[data-demo-controls]').hidden && ![...demo.querySelectorAll('button,input,select')].some(el => el.getClientRects().length > 0), `${slug} no-JS controls hidden at ${width}`);
      check(noOverflow(doc, width), `${slug} no-JS layout fits ${width}px`);
      staticResults[slug] = text(demo.querySelector('[data-eval-results]')) + ' ' + text(demo.querySelector('[data-eval-verdict]'));
    }
  }
  for (const slug of ['dsgram', 'context-aware-evaluation', 'error-robust-retrieval']) {
    frame.removeAttribute('srcdoc');
    doc = await load(slug);
    const demo = doc.querySelector('[data-paper-demo]');
    const live = text(demo.querySelector('[data-eval-results]')) + ' ' + text(demo.querySelector('[data-eval-verdict]'));
    check(live === staticResults[slug], `${slug}: browser initial state matches the Python-rendered state`);
  }

  /* ---------------- Enhanced layout at 320px after interaction ---------------- */
  frame.style.width = '320px';
  for (const slug of Object.keys(fallback)) {
    frame.removeAttribute('srcdoc');
    doc = await load(slug);
    const demo = doc.querySelector('[data-paper-demo]');
    if (slug === 'seq2seq-data2text') { demo.querySelector('[data-d2t-word="20"]').click(); demo.querySelector('[data-d2t-triple="4"]').click(); demo.querySelector('[data-demo-action="reveal"]').click(); }
    if (slug === 'dsgram') demo.querySelector('[data-demo-action="preset-cyclic"]').click();
    check(noOverflow(doc, 320), `${slug}: enhanced layout fits 320px`);
    const clipped = [...demo.querySelectorAll('h3,h4,p')].filter(el => el.scrollWidth > el.clientWidth + 2);
    check(!clipped.length, `${slug}: no clipped text at 320px`);
    check(![...demo.querySelectorAll('*')].some(el => { const cs = doc.defaultView.getComputedStyle(el); return parseFloat(cs.borderTopLeftRadius) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage.includes('gradient') || parseFloat(cs.transitionDuration) > 0; }), `${slug}: square, flat, static styling`);
  }
  frame.remove();
  return { assertions, failures };
})();
