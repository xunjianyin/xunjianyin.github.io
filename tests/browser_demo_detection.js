/* AGENT-X demos: steering calibration (Method) and accuracy against AUROC (Evidence).
 * Run against the local preview: agent-browser eval --stdin < tests/browser_demo_detection.js
 * Expected printed values are typed in here from Tables 1, 2, 5 and 6 of arXiv 2505.15261v1,
 * and every computed number (calibration quantities, ranks, contrasts) is recomputed here
 * independently of papers/demos/detection.js.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:1200px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html?t=${Date.now()}`; });
    return frame.contentDocument;
  };
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const noOverflow = (doc, width) => doc.documentElement.scrollWidth <= width + 1;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let doc = await load('agent-x');
  let win = frame.contentWindow;

  /* ---------------- Calibration: Section 4.2 equations ---------------- */
  let root = doc.querySelector('[data-paper-demo="agent-x-calibration"]');
  check(!!root && root.dataset.demoReady === 'true' && !root.querySelector('[data-demo-controls]').hidden, 'Calibration controls initialize');
  check(!!root.closest('#method .method-demo'), 'Calibration demo sits in Inside the method');
  check(doc.querySelectorAll('#method .method-lead p').length === 2, 'Calibration demo follows the second mechanism paragraph (the equations)');
  check([...root.querySelectorAll('[data-demo-action]')].every(b => b.tagName === 'BUTTON' && b.type === 'button'), 'Calibration actions are keyboard-operable buttons');
  check(root.querySelector('.dt-kicker').textContent.includes('illustrative'), 'Calibration labels its inputs illustrative');
  const prompts = ['Very cautious', 'Cautious', 'Vanilla', 'Confident', 'Very confident'];
  check(prompts.every((name, k) => text(root.querySelector(`[data-dt-row="${k}"] .dt-steer-name`)).startsWith(name)), 'Calibration lists the five steering prompts in Appendix G order');
  check(text(root).includes('Make your confidence low.') && text(root).includes('Report your true confidence.'), 'Calibration quotes the steering instructions');

  // Independent implementation of Section 4.2.
  const expected = outputs => {
    const c = outputs.map(([, h]) => h / 100);
    const ai = outputs.filter(([l]) => l === 'AI').length;
    const majority = ai >= 3 ? 'AI' : 'Human';
    const kAns = Math.max(ai, 5 - ai) / 5;
    const mu = c.reduce((a, b) => a + b, 0) / 5;
    const sigma = Math.sqrt(c.reduce((a, b) => a + (b - mu) ** 2, 0) / 5);
    const kConf = 1 / (1 + sigma / mu);
    const cal = mu * kAns * kConf;
    const d = c.map(v => Math.abs(v - cal));
    const best = Math.min(...d);
    const kStar = d.findIndex(v => v <= best + 1e-12);
    const tie = d.filter(v => v <= best + 1e-9).length > 1;
    return { majority, kAns, mu, sigma, kConf, cal, kStar, tie, label: outputs[kStar][0], dist: d };
  };
  const readout = () => [...root.querySelectorAll('.dt-readout dd')].map(dd => text(dd));
  const lastNumber = s => Number(s.replace('−', '-').match(/(-?\d+\.\d+)(?!.*\d)/)[1]);
  const selectedRow = () => [...root.querySelectorAll('.dt-steer-row')].findIndex(r => r.classList.contains('is-selected'));
  const near = (shown, value) => Math.abs(shown - value) <= 0.0005 + 1e-9;
  const verifyState = (outputs, label) => {
    const e = expected(outputs);
    const dd = readout();
    check(near(lastNumber(dd[0]), e.kAns) && near(lastNumber(dd[1]), e.mu) && near(lastNumber(dd[2]), e.sigma) && near(lastNumber(dd[3]), e.kConf) && near(lastNumber(dd[4]), e.cal),
      `${label}: readout ${dd.slice(0, 5).join(' | ')} vs μ ${e.mu.toFixed(4)} σ ${e.sigma.toFixed(4)} c_cal ${e.cal.toFixed(4)}`);
    if (!e.tie) {
      check(selectedRow() === e.kStar && dd[5].startsWith(e.label), `${label}: k* = ${prompts[e.kStar]}, reported ${e.label} (page: row ${selectedRow()}, ${dd[5]})`);
      const v = text(root.querySelector('[data-dt-verdict]'));
      check(v.includes(`Majority label ${e.majority}`) && v.includes(`reports ${e.label}`) && v.includes(e.label === e.majority ? 'agrees with the majority' : 'minority label'), `${label}: verdict "${v}"`);
    }
    outputs.forEach(([l, h], k) => {
      const row = root.querySelector(`[data-dt-row="${k}"]`);
      check(row.querySelector('.dt-mark').classList.contains(l === 'AI' ? 'is-ai' : 'is-human') && Math.abs(parseFloat(row.querySelector('.dt-mark').style.left) - h) < 0.01, `${label}: marker ${k} shape and position`);
    });
    check(Math.abs(parseFloat(root.querySelector('.dt-tick-cal').style.left) - e.cal * 100) < 0.01, `${label}: c_cal tick position`);
  };
  const setOutputs = outputs => {
    outputs.forEach(([l, h], k) => {
      root.querySelector(`[data-demo-action="label:${k}:${l}"]`).click();
      const range = root.querySelector(`[data-demo-range="conf:${k}"]`);
      range.value = String(h);
      range.dispatchEvent(new win.Event('input', { bubbles: true }));
    });
  };
  const presets = {
    agree: [['AI', 30], ['AI', 45], ['AI', 60], ['AI', 75], ['AI', 90]],
    'cautious-dissent': [['Human', 30], ['AI', 45], ['AI', 60], ['AI', 75], ['AI', 90]],
    'confident-dissent': [['AI', 30], ['AI', 45], ['AI', 60], ['Human', 75], ['Human', 90]],
  };
  verifyState(presets.agree, 'Default state');
  check(readout()[4].endsWith('0.443') && readout()[5].startsWith('AI, from the cautious'), 'Default: c_cal 0.443 from the cautious prompt');
  root.querySelector('[data-demo-action="preset:cautious-dissent"]').click();
  verifyState(presets['cautious-dissent'], 'Preset: very cautious dissents');
  check(root.dataset.reported === 'Human' && root.dataset.cCal === '0.355', 'One cautious dissent flips the reported label to Human (c_cal 0.355)');
  root.querySelector('[data-demo-action="preset:confident-dissent"]').click();
  verifyState(presets['confident-dissent'], 'Preset: confident prompts dissent');
  check(root.dataset.reported === 'AI' && root.dataset.cCal === '0.266', 'Two confident dissents leave the label AI (c_cal 0.266)');
  // The reader's own edits: from the default, switch only the very cautious prompt.
  root.querySelector('[data-demo-action="preset:agree"]').click();
  root.querySelector('[data-demo-action="label:0:Human"]').click();
  check(root.dataset.reported === 'Human' && ![...root.querySelectorAll('[data-demo-action^="preset:"]')].some(b => b.getAttribute('aria-pressed') === 'true'), 'Editing a label recomputes and clears the preset');
  check(root.querySelector('[data-demo-action="label:0:Human"]').getAttribute('aria-pressed') === 'true' && root.querySelector('[data-demo-action="label:0:AI"]').getAttribute('aria-pressed') === 'false', 'Label toggles expose aria-pressed');
  // Identical confidences: no spread, so c_cal equals the mean times answer consistency.
  setOutputs([['AI', 70], ['AI', 70], ['AI', 70], ['AI', 70], ['AI', 70]]);
  check(root.dataset.cCal === '0.700' && readout()[2].endsWith('0.000'), 'Equal confidences: σ_c = 0 and c_cal = μ_c');
  // Deterministic pseudo-random configurations.
  let seed = 20250521;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let trial = 0; trial < 25; trial++) {
    const outputs = Array.from({ length: 5 }, () => [rand() < 0.5 ? 'AI' : 'Human', 5 * (1 + Math.floor(rand() * 20))]);
    setOutputs(outputs);
    verifyState(outputs, `Random trial ${trial}`);
    check(expected(outputs).cal <= expected(outputs).mu + 1e-12, `Random trial ${trial}: c_cal never exceeds μ_c`);
  }
  const range = root.querySelector('[data-demo-range="conf:0"]');
  check(range.min === '5' && range.max === '100' && range.step === '5', 'Confidence range 0.05–1 in steps of 0.05');

  /* ---------------- Metrics: printed values, ranks, contrasts ---------------- */
  root = doc.querySelector('[data-paper-demo="agent-x-metrics"]');
  check(!!root && root.dataset.demoReady === 'true' && !root.querySelector('[data-demo-controls]').hidden, 'Metrics controls initialize');
  check(!!root.closest('#findings .section-demo.evidence-demo'), 'Metrics explorer sits in Reading the evidence');
  check(root.querySelector('.dt-kicker').textContent.startsWith('Measured · Tables 1, 2, 5 and 6'), 'Metrics eyebrow names the source tables');
  const act = action => root.querySelector(`[data-demo-action="${action}"]`).click();
  const show = (model, dataset, sort = 'acc') => { act(`model:${model}`); act(`dataset:${dataset}`); act(`sort:${sort}`); };
  const row = method => root.querySelector(`.dt-bars [data-method="${method}"]`);
  const val = (method, metric) => text(row(method)?.querySelector(`[data-dt-${metric}]`));
  // Printed values, typed in from the PDF tables (accuracy, AUROC).
  const printed = [
    ['gpt4', 'pubmed', { 'agent-x': ['0.8446', '0.8447'], 'fast-detect': ['0.5267', '0.8503'], gptzero: ['not printed', '0.8482'], likelihood: ['0.7233', '0.8104'] }, 'Table 1 and Table 5'],
    ['chatgpt', 'xsum', { 'fast-detect': ['0.9467', '0.9907'], gptzero: ['not printed', '0.9952'], 'agent-x': ['0.8967', '0.9628'], entropy: ['0.3800', '0.3305'] }, 'Table 1 and Table 5'],
    ['chatgpt', 'pubmed', { likelihood: ['0.7633', '0.8775'], 'agent-x': ['0.7604', '0.8195'], 'dna-gpt': ['0.5000', '0.7959'] }, 'Table 1 and Table 5'],
    ['opus', 'writing', { npr: ['0.9233', '0.9764'], 'fast-detect': ['0.9400', '0.9832'], 'fast-detect-llama': ['not printed', '0.9377'] }, 'Table 2 and Table 6'],
    ['sonnet', 'avg', { 'agent-x': ['0.8000', '0.8666'], likelihood: ['0.7856', '0.8902'], detectgpt: ['0.5522', '0.8057'] }, 'Table 2 and Table 6'],
    ['sonnet', 'xsum', { detectgpt: ['0.5000', '0.8150'], 'roberta-base': ['0.7000', '0.7511'] }, 'Table 2 and Table 6'],
    ['gpt4', 'avg', { 'agent-x': ['0.8592', '0.9007'], 'fast-detect': ['0.6656', '0.9061'], 'fast-detect-phi2': ['not printed', '0.5727'] }, 'Table 1 and Table 5'],
  ];
  for (const [model, dataset, values, tables] of printed) {
    show(model, dataset);
    for (const [method, [acc, auroc]] of Object.entries(values)) {
      check(val(method, 'acc') === acc && val(method, 'auroc') === auroc, `${model}/${dataset} ${method}: printed ${acc}/${auroc}, page ${val(method, 'acc')}/${val(method, 'auroc')}`);
    }
    check(text(root.querySelector('[data-dt-title]')).includes(`Measured · ${tables}`), `${model}/${dataset}: names ${tables}`);
  }
  // Every column: ranks and contrasts recomputed from the displayed values.
  const models = ['chatgpt', 'gpt4', 'opus', 'sonnet'];
  const datasets = ['xsum', 'writing', 'pubmed', 'avg'];
  let accFirst = 0; let aurocFirst = 0;
  for (const model of models) {
    for (const dataset of datasets) {
      show(model, dataset, 'auroc');
      const rows = [...root.querySelectorAll('.dt-bars .dt-bar-row')];
      const label = `${model}/${dataset}`;
      check(rows.length === (model === 'chatgpt' || model === 'gpt4' ? 16 : 15), `${label}: every detector the AUROC table prints`);
      const data = rows.map(r => ({ id: r.dataset.method, acc: Number(text(r.querySelector('[data-dt-acc]'))), auroc: Number(text(r.querySelector('[data-dt-auroc]'))) }));
      const auroc = data.map(d => d.auroc);
      check(auroc.every((v, i) => i === 0 || auroc[i - 1] >= v), `${label}: sorted by AUROC`);
      const ours = data.find(d => d.id === 'agent-x');
      const withAcc = data.filter(d => !Number.isNaN(d.acc));
      check(withAcc.length === 12, `${label}: 12 detectors with an accuracy`);
      const accRank = 1 + withAcc.filter(d => d.acc > ours.acc).length;
      const aurocRank = 1 + data.filter(d => d.auroc > ours.auroc).length;
      if (accRank === 1) accFirst++;
      if (aurocRank === 1) aurocFirst++;
      const cell = text(root.querySelector(`[data-dt-cell="${model}:${dataset}"]`));
      check(cell === `${accRank} / ${aurocRank}`, `${label}: board "${cell}" vs ${accRank} / ${aurocRank}`);
      check(root.querySelector(`[data-dt-cell="${model}:${dataset}"]`).classList.contains('is-selected') && root.querySelectorAll('.dt-board .is-selected').length === 1, `${label}: selected cell outlined`);
      const v = text(root.querySelector('[data-dt-verdict]'));
      check(v.includes(`Accuracy: AGENT-X ranks ${accRank} of 12 (`) && v.includes(`AUROC: AGENT-X ranks ${aurocRank} of ${data.length} (`), `${label}: verdict ranks "${v}"`);
      const contrast = withAcc.filter(d => d.id !== 'agent-x' && d.auroc > ours.auroc && d.acc < ours.acc).map(d => d.id).sort();
      const marked = rows.filter(r => r.classList.contains('is-contrast')).map(r => r.dataset.method).sort();
      check(JSON.stringify(contrast) === JSON.stringify(marked), `${label}: contrast rows ${marked} vs ${contrast}`);
      check(contrast.length ? v.includes('Higher AUROC but lower accuracy than AGENT-X') : v.includes('No baseline here'), `${label}: contrast sentence`);
      act('sort:acc');
      const accs = [...root.querySelectorAll('.dt-bars .dt-bar-row')].map(r => Number(text(r.querySelector('[data-dt-acc]'))));
      const firstMissing = accs.findIndex(Number.isNaN);
      check(firstMissing === 12 && accs.slice(0, 12).every((x, i) => i === 0 || accs[i - 1] >= x) && accs.slice(12).every(Number.isNaN), `${label}: sorted by accuracy, AUROC-only rows last`);
    }
  }
  check(accFirst === 9 && aurocFirst === 0, `AGENT-X is most accurate in 9 of 16 columns and has the top AUROC in none (page: ${accFirst}, ${aurocFirst})`);
  show('gpt4', 'pubmed');
  check(row('fast-detect').classList.contains('is-contrast') && row('agent-x').classList.contains('is-ours'), 'GPT-4 PubMed: Fast-DetectGPT has higher AUROC but lower accuracy');
  check(['model:gpt4', 'dataset:pubmed', 'sort:acc'].every(a => root.querySelector(`[data-demo-action="${a}"]`).getAttribute('aria-pressed') === 'true'), 'Metrics toggles expose aria-pressed');

  /* ---------------- No motion; flat styling ---------------- */
  for (const demo of doc.querySelectorAll('.detection-demo')) {
    const moving = [...demo.querySelectorAll('*')].filter(el => { const cs = win.getComputedStyle(el); return parseFloat(cs.transitionDuration) > 0 || cs.animationName !== 'none'; });
    check(!moving.length, `${demo.dataset.paperDemo}: no transitions or animations${reduced ? ' (reduced motion)' : ''}`);
    check(![...demo.querySelectorAll('*')].some(el => { const cs = win.getComputedStyle(el); return parseFloat(cs.borderTopLeftRadius) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage.includes('gradient'); }), `${demo.dataset.paperDemo}: square, flat styling`);
    check(!demo.querySelector('[data-demo-action*="play"]'), `${demo.dataset.paperDemo}: no Play control, nothing moves on its own`);
  }

  /* ---------------- No-JS state and phone layouts ---------------- */
  const staticDoc = async width => {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/agent-x.html?t=${Date.now()}`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script:not([type="application/json"])').forEach(s => s.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    return frame.contentDocument;
  };
  const staticText = {};
  for (const width of [390, 320]) {
    doc = await staticDoc(width);
    const calibration = doc.querySelector('[data-paper-demo="agent-x-calibration"]');
    const metrics = doc.querySelector('[data-paper-demo="agent-x-metrics"]');
    check(text(calibration.querySelector('[data-demo-state]')).includes('0.443') && text(calibration.querySelector('[data-demo-state]')).includes('agrees with the majority'), `No-JS calibration state readable at ${width}`);
    check(text(metrics.querySelector('[data-demo-state]')).includes('GPT-4 · PubMed') && text(metrics.querySelector('[data-demo-state]')).includes('0.5267'), `No-JS metrics state readable at ${width}`);
    for (const demo of [calibration, metrics]) {
      check(demo.querySelector('[data-demo-controls]').hidden && ![...demo.querySelectorAll('button,input,select')].some(el => el.getClientRects().length > 0), `${demo.dataset.paperDemo}: no-JS controls hidden at ${width}`);
      staticText[demo.dataset.paperDemo] = text(demo.querySelector('[data-demo-state]'));
    }
    check(noOverflow(doc, width), `No-JS layout fits ${width}px`);
  }
  frame.removeAttribute('srcdoc');
  frame.style.width = '1200px';
  doc = await load('agent-x');
  for (const demo of doc.querySelectorAll('.detection-demo')) {
    check(text(demo.querySelector('[data-demo-state]')) === staticText[demo.dataset.paperDemo], `${demo.dataset.paperDemo}: browser initial state matches the Python-rendered state`);
  }
  for (const width of [390, 320]) {
    frame.style.width = `${width}px`;
    doc = await load('agent-x');
    win = frame.contentWindow;
    const metrics = doc.querySelector('[data-paper-demo="agent-x-metrics"]');
    metrics.querySelector('[data-demo-action="model:sonnet"]').click();
    metrics.querySelector('[data-demo-action="dataset:writing"]').click();
    const calibration = doc.querySelector('[data-paper-demo="agent-x-calibration"]');
    calibration.querySelector('[data-demo-action="preset:cautious-dissent"]').click();
    check(noOverflow(doc, width), `Enhanced layout fits ${width}px`);
    for (const demo of [calibration, metrics]) {
      const clipped = [...demo.querySelectorAll('h3,h4,p,dt,dd,td,th,li > span:not(.dt-track):not(.dt-axis)')].filter(el => el.scrollWidth > el.clientWidth + 2);
      check(!clipped.length, `${demo.dataset.paperDemo}: no clipped text at ${width}px (${clipped.map(el => el.className || el.tagName).slice(0, 3)})`);
      check(demo.getBoundingClientRect().right <= width + 1, `${demo.dataset.paperDemo}: inside the ${width}px viewport`);
    }
    const track = calibration.querySelector('.dt-track');
    check(track.getBoundingClientRect().width >= 180, `Calibration axis keeps a usable width at ${width}px (${Math.round(track.getBoundingClientRect().width)}px)`);
  }
  frame.remove();
  return { assertions, reducedMotion: reduced, failures };
})();
