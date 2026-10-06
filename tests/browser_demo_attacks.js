/* Attack-paper demos (Lazy Grounding: the 12 settings of Tables 1 and 7).
 * Run against the local preview: agent-browser eval --stdin < tests/browser_demo_attacks.js
 * Expected values are typed in here from arXiv 2608.30303v2 (Table 1, Section 3.2; Table 7,
 * Appendix C.4). Every computed statement (counts, the mean drop, interval classes, orderings,
 * per-benchmark comparisons, plot positions) is recomputed here independently of
 * papers/demos/attacks.js. Run once more after `set media light reduced-motion`.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:1200px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async () => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/lazy-grounding.html?t=${Date.now()}`; });
    return frame.contentDocument;
  };
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const noOverflow = (doc, width) => doc.documentElement.scrollWidth <= width + 1;
  const neg = s => s.replace('-', '−');

  // Table 1 (clean, aug, RAA, RAA-C, RAA-F; mean then SD) and Table 7 (drop, SD, CI low, CI high), as printed.
  const printed = {
    'tongyi-xbench':       ['Tongyi Deep Research', 'XBench',      '69.3 2.1 52.0 6.1 27.0 5.6 20.7 5.5 41.3 9.8 17.3 6.8 10.7 24.0'],
    'tongyi-gaia':         ['Tongyi Deep Research', 'GAIA',        '66.0 6.6 57.3 0.6 17.7 3.1 14.1 3.0 24.5 4.0 8.7 7.0 1.0 16.3'],
    'tongyi-browsecomp':   ['Tongyi Deep Research', 'BrowseComp+', '27.0 8.2 19.3 0.6 36.3 24.0 28.4 19.9 39.3 25.4 7.7 7.8 0.7 14.7'],
    'tongyi-hle':          ['Tongyi Deep Research', 'HLE',         '28.7 6.1 26.7 5.1 17.7 3.1 25.6 4.8 14.5 2.5 2.0 1.0 -5.0 9.0'],
    'gpt5mini-xbench':     ['GPT-5 Mini', 'XBench',      '65.0 6.0 52.7 1.5 23.0 3.6 19.0 3.2 30.5 14.0 12.3 4.5 5.7 19.0'],
    'gpt5mini-gaia':       ['GPT-5 Mini', 'GAIA',        '59.0 4.4 53.3 5.8 22.0 9.6 14.7 7.5 32.5 13.1 5.7 1.5 -2.7 14.0'],
    'gpt5mini-browsecomp': ['GPT-5 Mini', 'BrowseComp+', '31.7 3.2 22.0 8.2 29.0 2.6 33.7 10.6 26.8 2.6 9.7 7.6 1.7 18.0'],
    'gpt5mini-hle':        ['GPT-5 Mini', 'HLE',         '30.7 5.5 24.3 3.1 15.0 2.6 13.0 3.1 15.9 2.7 6.3 3.5 1.3 11.7'],
    'gemini-xbench':       ['Gemini 3 Flash', 'XBench',      '74.3 2.1 71.0 1.7 7.7 2.1 6.7 4.7 10.4 5.9 3.3 3.1 -2.0 9.0'],
    'gemini-gaia':         ['Gemini 3 Flash', 'GAIA',        '62.3 8.5 57.0 4.6 10.7 3.1 9.6 2.4 12.4 4.4 5.3 6.7 -1.0 11.7'],
    'gemini-browsecomp':   ['Gemini 3 Flash', 'BrowseComp+', '43.0 6.1 52.3 2.3 5.0 2.6 6.2 3.0 4.1 4.2 -9.3 3.8 -17.0 -1.7'],
    'gemini-hle':          ['Gemini 3 Flash', 'HLE',         '46.7 2.5 44.7 2.5 13.7 5.5 10.0 6.5 16.9 8.8 2.0 4.4 -4.3 8.0'],
  };
  const fields = ['clean', 'cleanSd', 'aug', 'augSd', 'raa', 'raaSd', 'raac', 'raacSd', 'raaf', 'raafSd', 'drop', 'dropSd', 'lo', 'hi'];
  const S = Object.entries(printed).map(([id, [model, bench, values]], index) => {
    const row = {id, model, bench, index, name: `${model} on ${bench}`};
    values.split(' ').forEach((v, i) => { row[fields[i]] = v; });
    return row;
  });
  const byId = Object.fromEntries(S.map(s => [s.id, s]));
  const t = v => Math.round(parseFloat(v) * 10);
  const cls = s => (t(s.lo) > 0 ? 'above' : t(s.hi) < 0 ? 'below' : 'spans');

  let doc = await load();
  let root = doc.querySelector('[data-paper-demo="lazy-grounding"]');
  const act = action => { const el = root.querySelector(`[data-demo-action="${action}"]`); if (!el) throw new Error(`missing ${action}`); el.click(); };
  const rows = () => [...root.querySelectorAll('.at-rows .at-row')];
  const rowIds = () => rows().map(r => r.dataset.setting);
  const strong = id => text(root.querySelector(`.at-row[data-setting="${id}"] .at-row-value strong`));
  const small = id => text(root.querySelector(`.at-row[data-setting="${id}"] .at-row-value small`));
  const verdict = () => text(root.querySelector('[data-at-verdict]'));
  const detail = () => text(root.querySelector('[data-at-detail]'));
  const select = id => root.querySelector(`.at-row[data-setting="${id}"]`).click();
  const leftOf = el => parseFloat(el.style.left);

  /* ---------------- Placement and initialization ---------------- */
  check(root && root.dataset.demoReady === 'true' && !root.querySelector('[data-demo-controls]').hidden, 'Lazy grounding controls initialize');
  check(Boolean(root.closest('#findings .section-demo.evidence-demo')), 'Explorer sits in Reading the evidence');
  check(root.compareDocumentPosition(doc.querySelector('.evidence-narrative')) & Node.DOCUMENT_POSITION_FOLLOWING, 'Explorer precedes the evidence narrative');
  check(text(root.querySelector('.at-kicker')) === 'Measured · Tables 1 and 7', 'Eyebrow names the measured source tables');
  check(doc.querySelector('.lead-visual .primary-figure img[src="assets/lazy-grounding-overview.png"]') !== null, 'Lead visual is the paper\'s Figure 1');
  const table = doc.querySelector('#findings .results-table');
  check(table && text(table).includes('Constraint checking') && text(table).includes('11.4/19.6') && !text(root).includes('Constraint checking'), 'Table 5 is the results table and is not repeated by the explorer');

  /* ---------------- Drop view (default): Table 7 values, classes, positions ---------------- */
  check(rows().length === 12 && rowIds().join() === S.map(s => s.id).join(), 'Default order is the paper\'s row order');
  for (const s of S) {
    check(strong(s.id) === neg(s.drop) && small(s.id) === `[${neg(s.lo)}, ${neg(s.hi)}]`, `${s.id}: drop and interval as printed`);
    const row = root.querySelector(`.at-row[data-setting="${s.id}"]`);
    check(row.classList.contains(`is-${cls(s)}`), `${s.id}: interval class ${cls(s)}`);
    const dot = row.querySelector('.at-mark.at-fill');
    const line = row.querySelector('.at-line');
    const pos = v => (t(v) + 200) / 450 * 100;
    check(Math.abs(leftOf(dot) - pos(s.drop)) < 0.01 && Math.abs(leftOf(line) - pos(s.lo)) < 0.01 && Math.abs(parseFloat(line.style.width) - (t(s.hi) - t(s.lo)) / 450 * 100) < 0.01, `${s.id}: drop and interval plotted at their values`);
  }
  const counts = {above: S.filter(s => cls(s) === 'above').length, spans: S.filter(s => cls(s) === 'spans').length, below: S.filter(s => cls(s) === 'below')};
  const meanDrop = Math.round(S.reduce((a, s) => a + t(s.drop), 0) / 12);
  check(counts.above === 6 && counts.spans === 5 && counts.below.length === 1 && meanDrop === 59, 'Independent counts: 6 above, 5 spanning, 1 below; mean 5.9');
  check(verdict().startsWith(`Accuracy falls in ${S.filter(s => t(s.drop) > 0).length} of 12 settings; the mean of the 12 printed drops is 5.9 pp.`), 'Drop verdict: 11 of 12 and the 5.9 pp mean (abstract value)');
  check(verdict().includes(`lies above zero in ${counts.above}, includes zero in ${counts.spans}, and lies below zero in 1 (Gemini 3 Flash on BrowseComp+).`), 'Drop verdict: interval classification');
  const statusText = {above: 'lies above zero', spans: 'includes zero', below: 'lies below zero, an accuracy gain'};
  for (const s of S) {
    select(s.id);
    const row = root.querySelector(`.at-row[data-setting="${s.id}"]`);
    check(row.getAttribute('aria-pressed') === 'true' && root.querySelectorAll('.at-row[aria-pressed="true"]').length === 1 && row.classList.contains('is-selected'), `${s.id}: selection is pressed and unique`);
    check(verdict().endsWith(`Selected: ${s.name}, drop ${neg(s.drop)} pp, interval [${neg(s.lo)}, ${neg(s.hi)}], which ${statusText[cls(s)]}.`), `${s.id}: selected-setting verdict`);
    const d = detail();
    check(text(root.querySelector('[data-at-detail] h4')) === s.name, `${s.id}: detail heading`);
    for (const needle of [`${s.clean} ± ${s.cleanSd}`, `${s.aug} ± ${s.augSd}`, `${neg(s.drop)} ± ${s.dropSd} pp`, `[${neg(s.lo)}, ${neg(s.hi)}]`, `${s.raa} ± ${s.raaSd}`, `${s.raac} ± ${s.raacSd} / ${s.raaf} ± ${s.raafSd}`]) {
      check(d.includes(needle), `${s.id}: detail shows ${needle}`);
    }
    check(doc.activeElement && doc.activeElement.dataset.setting === s.id, `${s.id}: focus stays on the selected row`);
  }
  check(rows().every(r => r.tagName === 'BUTTON' && r.type === 'button'), 'Rows are keyboard-operable buttons');

  /* ---------------- Orders ---------------- */
  const sortedBy = field => S.slice().sort((a, b) => t(b[field]) - t(a[field]) || a.index - b.index).map(s => s.id).join();
  act('order:value');
  check(rowIds().join() === sortedBy('drop'), 'Largest first sorts by printed drop');
  check(text(root.querySelector('[data-at-view-title]')).endsWith('largest drop first'), 'Title names the drop ordering');
  act('order:benchmark');
  const benchOrder = ['XBench', 'GAIA', 'BrowseComp+', 'HLE'];
  check(rowIds().join() === S.slice().sort((a, b) => benchOrder.indexOf(a.bench) - benchOrder.indexOf(b.bench) || a.index - b.index).map(s => s.id).join(), 'Grouped by benchmark');
  check(root.querySelector('[data-demo-action="order:benchmark"]').getAttribute('aria-pressed') === 'true' && root.querySelector('[data-demo-action="order:model"]').getAttribute('aria-pressed') === 'false', 'Order buttons report their state');

  /* ---------------- Accuracy view: Table 1 values and the per-benchmark comparison ---------------- */
  act('view:accuracy');
  act('order:model');
  for (const s of S) {
    check(strong(s.id) === `${s.clean} → ${s.aug}` && small(s.id) === `drop ${neg(s.drop)}`, `${s.id}: clean → augmented as printed`);
    const row = root.querySelector(`.at-row[data-setting="${s.id}"]`);
    check(row.classList.contains(t(s.aug) > t(s.clean) ? 'is-gain' : 'is-loss'), `${s.id}: gain or loss class`);
    const [hollow, fill] = row.querySelectorAll('.at-mark');
    check(Math.abs(leftOf(hollow) - t(s.clean) / 8) < 0.01 && Math.abs(leftOf(fill) - t(s.aug) / 8) < 0.01, `${s.id}: accuracy marks at their values`);
  }
  check(S.filter(s => t(s.aug) > t(s.clean)).map(s => s.id).join() === 'gemini-browsecomp', 'Only Gemini 3 Flash on BrowseComp+ gains accuracy');
  act('order:value');
  check(rowIds().join() === sortedBy('clean'), 'Largest first sorts by clean accuracy');
  const relations = {};
  for (const bench of benchOrder) {
    const peers = S.filter(s => s.bench === bench).sort((a, b) => t(b.clean) - t(a.clean) || a.index - b.index);
    const drops = peers.map(s => t(s.drop));
    const top = drops[0];
    const relation = top === Math.min(...drops) ? (drops.filter(d => d === top).length > 1 ? 'shares the smallest drop' : 'has the smallest drop')
      : top === Math.max(...drops) ? 'has the largest drop' : 'has neither the smallest nor the largest drop';
    relations[bench] = relation;
    select(peers[2].id);
    const listed = peers.map(s => `${s.model} ${s.clean}% (drop ${neg(s.drop)} pp)`).join(', ');
    check(verdict() === `On ${bench}, ordered by clean accuracy: ${listed}. The most accurate agent without nearby evidence ${relation} on this benchmark. Accuracy is lower with nearby evidence in 11 of 12 settings.`, `${bench}: accuracy verdict "${verdict()}"`);
  }
  check(relations.XBench === 'has the smallest drop' && relations.GAIA === 'has the largest drop' && relations.HLE === 'shares the smallest drop', 'Clean accuracy orders robustness differently across benchmarks');
  check(text(root.querySelector('.at-caution')).includes('30.7 − 24.3 = 6.4, printed drop 6.3'), 'Accuracy view explains the rounded Table 7 drop');

  /* ---------------- Adoption view: RAA-C, RAA-F and RAA ---------------- */
  act('view:adoption');
  act('order:model');
  for (const s of S) {
    check(strong(s.id) === `${s.raac} / ${s.raaf}` && small(s.id) === `RAA ${s.raa}`, `${s.id}: RAA-C / RAA-F as printed`);
    const row = root.querySelector(`.at-row[data-setting="${s.id}"]`);
    check(row.classList.contains(t(s.raaf) > t(s.raac) ? 'is-f-higher' : 'is-c-higher'), `${s.id}: adoption class`);
    check(Math.abs(leftOf(row.querySelector('.at-tick')) - t(s.raa) / 5) < 0.01, `${s.id}: RAA tick at its value`);
  }
  const exceptions = S.filter(s => t(s.raaf) <= t(s.raac));
  check(exceptions.map(s => s.id).join() === 'tongyi-hle,gpt5mini-browsecomp,gemini-browsecomp', 'Independent: three settings with RAA-C at least RAA-F');
  const lowRaa = S.slice().sort((a, b) => t(a.raa) - t(b.raa) || a.index - b.index);
  check(verdict().startsWith(`Nearby-answer adoption is above zero in 12 of 12 settings, from ${lowRaa[0].raa}% (${lowRaa[0].name}) to ${lowRaa[11].raa}% (${lowRaa[11].name}). RAA-F exceeds RAA-C in ${12 - exceptions.length} of 12 settings; the exceptions are Tongyi Deep Research on HLE (RAA-C 25.6%, RAA-F 14.5%), GPT-5 Mini on BrowseComp+ (RAA-C 33.7%, RAA-F 26.8%), and Gemini 3 Flash on BrowseComp+ (RAA-C 6.2%, RAA-F 4.1%).`), `Adoption verdict "${verdict()}"`);
  act('order:value');
  check(rowIds().join() === sortedBy('raa'), 'Largest first sorts by RAA, ties in paper order');
  check(root.querySelectorAll('[data-demo-action^="view:"][aria-pressed="true"]').length === 1 && root.querySelector('[data-demo-action="view:adoption"]').getAttribute('aria-pressed') === 'true', 'View buttons report their state');
  check([...root.querySelectorAll('[data-demo-action]')].every(b => b.tagName === 'BUTTON' && b.type === 'button'), 'Every control is a button');
  check(root.querySelector('[data-at-verdict]').getAttribute('aria-live') === 'polite', 'Live summary');

  /* ---------------- No motion, with or without reduced motion ---------------- */
  const reduced = doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moving = [...root.querySelectorAll('*')].filter(el => { const cs = doc.defaultView.getComputedStyle(el); return parseFloat(cs.transitionDuration) > 0 || cs.animationName !== 'none'; });
  check(!moving.length, `No transitions or animations (reduced motion: ${reduced})`);

  /* ---------------- No-JS state, live initial state, phone layout ---------------- */
  const staticDoc = async width => {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/lazy-grounding.html?t=${Date.now()}`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script:not([type="application/json"])').forEach(s => s.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    return frame.contentDocument;
  };
  let staticText = '';
  for (const width of [390, 320]) {
    doc = await staticDoc(width);
    const demo = doc.querySelector('[data-paper-demo="lazy-grounding"]');
    const state = text(demo.querySelector('[data-demo-state]'));
    for (const needle of ['17.3', '[10.7, 24.0]', '[−17.0, −1.7]', 'Measured · Table 7', 'Computed', '69.3 ± 2.1', 'Accuracy falls in 11 of 12 settings', 'includes zero in 5']) {
      check(state.includes(needle), `No-JS state at ${width} contains ${needle}`);
    }
    check(demo.querySelector('[data-demo-controls]').hidden && ![...demo.querySelectorAll('button,input,select')].some(el => el.getClientRects().length > 0), `No-JS controls hidden at ${width}`);
    check(noOverflow(doc, width), `No-JS layout fits ${width}px`);
    staticText = text(demo.querySelector('[data-at-results]')) + ' ' + text(demo.querySelector('[data-at-verdict]'));
  }
  frame.removeAttribute('srcdoc');
  frame.style.width = '1200px';
  doc = await load();
  root = doc.querySelector('[data-paper-demo="lazy-grounding"]');
  check(text(root.querySelector('[data-at-results]')) + ' ' + verdict() === staticText, 'Browser initial state matches the Python-rendered state');
  for (const width of [390, 320]) {
    frame.style.width = `${width}px`;
    doc = await load();
    root = doc.querySelector('[data-paper-demo="lazy-grounding"]');
    for (const view of ['drop', 'accuracy', 'adoption']) {
      act(`view:${view}`);
      act('order:value');
      select('tongyi-browsecomp');
      check(noOverflow(doc, width), `${view}: enhanced layout fits ${width}px`);
      const clipped = [...root.querySelectorAll('h3,h4,p,dt,dd,.at-row-name,.at-row-value,.at-axis-label')].filter(el => el.scrollWidth > el.clientWidth + 2);
      check(!clipped.length, `${view}: no clipped text at ${width}px (${clipped.map(el => el.className || el.tagName).slice(0, 3)})`);
      const labels = [...root.querySelectorAll('.at-axis-label')].map(el => el.getBoundingClientRect());
      const box = root.getBoundingClientRect();
      check(labels.every(r => r.left >= box.left && r.right <= box.right), `${view}: axis labels stay inside the demo at ${width}px`);
    }
    check(![...root.querySelectorAll('*')].some(el => { const cs = doc.defaultView.getComputedStyle(el); return parseFloat(cs.borderTopLeftRadius) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage.includes('gradient'); }), `Square, flat styling at ${width}px`);
    check(doc.defaultView.getComputedStyle(root.querySelector('h3')).fontFamily.includes('Georgia'), 'Georgia demo heading');
  }
  frame.remove();
  return { assertions, failures };
})();
