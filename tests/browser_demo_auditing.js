/* Access-mode auditing demos (auditing-health-llms): the Section 5.5 overlap
 * procedure on illustrative citation lists, and the Tables A1–A3 explorer.
 * Run against the local preview with: agent-browser eval --stdin < tests/browser_demo_auditing.js
 * Expected values are transcribed here from the paper's PDF (arXiv 2609.16590 v1,
 * Tables A1–A3 on pp. 15–17), and the Jaccard procedure is reimplemented here,
 * independently of the page configuration. There is no motion to test beyond
 * confirming that nothing animates, so the suite is the same under reduced motion.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:1280px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async () => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/auditing-health-llms.html?test=${Date.now()}`; });
    return frame.contentDocument;
  };
  const text = (root, selector) => (root.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const visible = el => Boolean(el) && el.getClientRects().length > 0;
  const act = (root, action, value) => root.querySelector(`[data-demo-action="${action}"][data-value="${value}"]`).click();
  const pressed = (root, action) => [...root.querySelectorAll(`[data-demo-action="${action}"]`)]
    .filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.value);

  /* ------------------------------------------------------------ Transcribed from the paper */
  // Table A2: Δ (p) for GPT-5.3 C vs A, H vs A, H vs C, and GPT-5.4 C vs A.
  const A2 = {
    'length': ['+109 (<0.001)', '+103 (<0.001)', '−8 (0.132)', '+26 (0.003)'],
    'length-final': ['—', '—', '—', '−45 (<0.001)'],
    'readability': ['−0.89 (<0.001)', '−1.38 (<0.001)', '−0.54 (<0.001)', '+0.90 (<0.001)'],
    'headings-any': ['+7.3 (0.004)', '+7.9 (0.008)', 'n.t.', '−43.3 (<0.001)'],
    'headings-density': ['+1.56 (<0.001)', '+1.82 (<0.001)', '+0.28 (0.024)', '−0.19 (<0.001)'],
    'lists-any': ['+1.3 (0.500)', '+1.6 (0.500)', 'n.t.', '−48.0 (<0.001)'],
    'lists-density': ['+2.29 (<0.001)', '+2.69 (<0.001)', '+0.39 (0.060)', '−1.25 (<0.001)'],
    'emphasis-any': ['+57.3 (<0.001)', '+57.1 (<0.001)', 'n.t.', '−0.7 (1.000)'],
    'emphasis-density': ['+2.93 (<0.001)', '+3.03 (<0.001)', '+0.20 (0.171)', '−2.09 (<0.001)'],
    'emoji': ['+36.0 (<0.001)', '+28.6 (<0.001)', '−6.3 (0.336)', 'n.t.'],
    'webpages': ['—', '—', '—', '−0.27 (0.109)'],
    'domains': ['—', '—', '—', '−0.04 (0.820)'],
    'disclaimer': ['−4.0 (0.391)', '−10.3 (0.047)', '−4.8 (0.250)', '−17.3 (<0.001)'],
    'asks': ['+22.0 (<0.001)', '+31.0 (<0.001)', '+11.1 (<0.001)', '−24.7 (<0.001)'],
    'offers': ['+11.3 (0.014)', '−0.8 (0.861)', '−10.3 (0.043)', '−7.3 (0.046)'],
    'continuation': ['+27.3 (<0.001)', '+23.8 (<0.001)', 'n.t.', '−31.3 (<0.001)'],
    'concepts': ['+0.73 (<0.001)', '+0.09 (0.900)', '−0.56 (<0.001)', '−0.73 (0.005)'],
    'care-levels': ['−0.23 (0.213)', '−0.29 (0.333)', '+0.05 (0.693)', '−0.11 (0.627)'],
  };
  // Table A1: mean (SD) for GPT-5.3 API, ChatGPT, Health, GPT-5.4 API, ChatGPT (spot checks).
  const A1 = {
    'asks': ['54.0 (35.6)', '76.0 (33.0)', '91.3 (22.2)', '76.7 (33.8)', '52.0 (37.0)'],
    'length-final': ['—', '—', '—', '425 (113)', '380 (103)'],
    'readability': ['8.9 (1.2)', '8.0 (1.2)', '7.4 (0.9)', '10.9 (1.6)', '11.8 (1.6)'],
    'care-levels': ['3.0 (1.4)', '2.8 (1.1)', '2.8 (1.3)', '4.2 (1.5)', '4.1 (1.8)'],
  };
  // Table A3: n, cross, within, Δ, p.
  const A3 = [
    ['50', '0.109', '0.175', '+0.066', '<0.001'], ['50', '0.298', '0.389', '+0.091', '<0.001'],
    ['49', '0.615', '0.653', '+0.038', '0.012'], ['41', '0.614', '0.662', '+0.048', '0.002'],
    ['41', '0.645', '0.654', '+0.010', '0.617'], ['49', '0.586', '0.619', '+0.033', '0.013'],
    ['47', '0.664', '0.696', '+0.032', '0.342'], ['40', '0.710', '0.727', '+0.017', '0.734'],
    ['40', '0.681', '0.723', '+0.042', '0.067'], ['48', '0.714', '0.740', '+0.026', '0.313'],
  ];
  const below = (p, cut) => p.startsWith('<') ? Number(p.slice(1)) <= cut : Number(p) < cut;
  const expectedState = (cell, cut) => {
    if (cell === '—') return 'absent';
    if (cell === 'n.t.') return 'nt';
    const [delta, p] = cell.split(' ');
    if (!below(p.slice(1, -1), cut)) return 'ns';
    return delta.startsWith('+') ? 'pos' : 'neg';
  };

  /* ------------------------------------------------------------ Placement */
  let doc = await load();
  const overlap = doc.querySelector('[data-paper-demo="auditing-overlap"]');
  const contrasts = doc.querySelector('[data-paper-demo="auditing-contrasts"]');
  const lead = doc.querySelector('.lead-visual');
  check(lead && lead.querySelector('img[src="assets/auditing-health-llms-examples.png"]') && lead.querySelector('.primary-figure'), 'Lead: the paper\'s Figure 2 is the primary figure');
  const methodFigure = doc.querySelector('#method .method-demo .au-figure img[src="assets/auditing-health-llms-access.png"]');
  check(methodFigure && doc.querySelectorAll('#method .method-lead p').length === 1, 'Method: Figure 1 follows the first mechanism paragraph');
  check(overlap && overlap.closest('#method') && !overlap.closest('.method-demo') &&
    (doc.querySelector('#method .method-reading').compareDocumentPosition(overlap) & Node.DOCUMENT_POSITION_FOLLOWING), 'Method: the overlap explorer closes the section, after the prose and steps');
  const findings = doc.querySelector('#findings');
  check(contrasts && contrasts.closest('#findings .evidence-demo') &&
    (findings.querySelector('.findings-grid').compareDocumentPosition(contrasts) & Node.DOCUMENT_POSITION_FOLLOWING) &&
    (contrasts.compareDocumentPosition(findings.querySelector('.evidence-narrative')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Evidence: explorer between findings and narrative');
  check(!doc.querySelector('#explore') && doc.querySelectorAll('.results-table tbody tr').length === 10, 'No Explore section; Table 1 results table with 10 rows');
  check(text(overlap, '.au-eyebrow') === 'Section 5.5 procedure · illustrative citation lists' && text(contrasts, '.au-eyebrow') === 'Measured · Tables A1–A3', 'Eyebrows name the provenance');

  /* ------------------------------------------------------------ Initialization */
  for (const root of [overlap, contrasts]) {
    check(root.dataset.demoReady === 'true', `${root.dataset.paperDemo}: initializes`);
    check([...root.querySelectorAll('[data-demo-controls]')].every(visible), `${root.dataset.paperDemo}: controls revealed`);
    check(![...root.querySelectorAll('[data-au-static]')].some(visible), `${root.dataset.paperDemo}: static counterparts hidden`);
    check([...root.querySelectorAll('[data-demo-action]')].every(el => el.tagName === 'BUTTON' && el.type === 'button' && el.hasAttribute('aria-pressed') && visible(el)), `${root.dataset.paperDemo}: native toggle buttons with aria-pressed`);
    check([...root.querySelectorAll('.au-table-wrap')].every(wrap => wrap.tabIndex === 0 && wrap.getAttribute('role') === 'region'), `${root.dataset.paperDemo}: scroll regions are focusable`);
  }

  /* ------------------------------------------------------------ Section 5.5 procedure */
  const jac = (a, b) => {
    const union = new Set([...a, ...b]);
    if (!union.size) return null;
    return a.filter(x => b.includes(x)).length / union.size;
  };
  const avg = values => { const d = values.filter(v => v !== null); return d.length ? d.reduce((s, v) => s + v, 0) / d.length : null; };
  const procedure = (api, chat) => {
    const pairs = [[0, 1], [0, 2], [1, 2]];
    const wa = avg(pairs.map(([i, j]) => jac(api[i], api[j])));
    const wc = avg(pairs.map(([i, j]) => jac(chat[i], chat[j])));
    const cross = avg(api.flatMap(a => chat.map(c => jac(a, c))));
    const within = wa === null || wc === null ? null : (wa + wc) / 2;
    return { wa, wc, within, cross, delta: within === null || cross === null ? null : within - cross };
  };
  const f3 = v => v === null ? '—' : (Math.abs(v) + 1e-9).toFixed(3);
  const sign3 = v => { if (v === null) return '—'; const t = f3(v); return Number(t) === 0 ? '0.000' : (v > 0 ? '+' : '−') + t; };
  const readout = () => ['within_api', 'within_chatgpt', 'within', 'cross', 'delta'].map(k => text(overlap, `[data-au-out="${k}"]`));
  const expectReadout = (api, chat, label) => {
    const r = procedure(api, chat);
    const expected = [f3(r.wa), f3(r.wc), f3(r.within), f3(r.cross), sign3(r.delta)];
    check(readout().join('|') === expected.join('|'), `${label}: readout ${expected.join(' ')} (got ${readout().join(' ')})`);
    return r;
  };
  const presets = {
    specific: [[[1, 2, 3, 4], [1, 2, 3, 5], [1, 4, 5, 6]], [[3, 4, 6, 7], [3, 6, 7, 8], [4, 5, 7, 8]]],
    pool: [[[1, 2, 5, 8], [1, 3, 6, 8], [2, 3, 4, 5]], [[1, 3, 4, 7], [2, 4, 7, 8], [3, 5, 6, 7]]],
    fixed: [[[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]], [[3, 4, 5, 6], [3, 4, 5, 6], [3, 4, 5, 6]]],
  };
  const cites = key => [...overlap.querySelectorAll(`[data-au-run="${key}"] [data-demo-action="au-cite"]`)]
    .filter(b => b.getAttribute('aria-pressed') === 'true').map(b => Number(b.dataset.source));
  check(pressed(overlap, 'au-preset').join() === 'specific', 'Overlap: opens on the mode-specific preset');
  check(cites('api-0').join() === '1,2,3,4' && cites('chatgpt-2').join() === '4,5,7,8', 'Overlap: preset citations shown in the grid');
  let r = expectReadout(...presets.specific, 'Mode-specific preset');
  check(text(overlap, '[data-au-out="within"]') === '0.422' && text(overlap, '[data-au-out="cross"]') === '0.206' && text(overlap, '[data-au-out="delta"]') === '+0.216', 'Mode-specific preset: 0.422 within, 0.206 cross, +0.216');
  check(text(overlap, '[data-au-calc-status]').includes('share fewer sources across access modes'), 'Mode-specific preset: positive gap explained');
  // Pair matrix: 15 lower-triangle cells, 6 within and 9 cross, values from the procedure.
  const pairCells = [...overlap.querySelectorAll('[data-au-pair]')];
  check(pairCells.length === 15 && overlap.querySelectorAll('.au-pair.is-within').length === 6 && overlap.querySelectorAll('.au-pair.is-cross').length === 9, 'Pair matrix: 6 within-mode and 9 cross-mode cells');
  const runsOf = ([api, chat]) => [...api, ...chat];
  const matrixOk = preset => pairCells.every(cell => {
    const [i, j] = cell.dataset.auPair.split('-').map(Number);
    const all = runsOf(preset);
    const v = jac(all[i], all[j]);
    return cell.textContent.trim() === (v === null ? '—' : (v + 1e-9).toFixed(2));
  });
  check(matrixOk(presets.specific), 'Pair matrix values match the Jaccard of each pair (mode-specific)');
  act(overlap, 'au-preset', 'pool');
  r = expectReadout(...presets.pool, 'Shared-pool preset');
  check(text(overlap, '[data-au-out="cross"]') === '0.270' && text(overlap, '[data-au-out="delta"]') === '0.000' && text(overlap, '[data-au-calc-status]').includes('low cross-mode overlap on its own does not show an access-mode effect'), 'Shared pool: low overlap, zero gap, explained');
  check(matrixOk(presets.pool) && pressed(overlap, 'au-preset').join() === 'pool', 'Shared pool: matrix and pressed preset');
  act(overlap, 'au-preset', 'fixed');
  r = expectReadout(...presets.fixed, 'Repeated-list preset');
  check(text(overlap, '[data-au-out="cross"]') === '0.333' && text(overlap, '[data-au-out="delta"]') === '+0.667', 'Repeated lists: higher cross-mode overlap (0.333) than the pool, yet a +0.667 gap');
  // Single citations: switch one off and on again.
  act(overlap, 'au-preset', 'pool');
  overlap.querySelector('[data-au-run="api-0"] [data-demo-action="au-cite"][data-source="1"]').click();
  const edited = [[[2, 5, 8], [1, 3, 6, 8], [2, 3, 4, 5]], presets.pool[1]];
  expectReadout(...edited, 'Edited citation');
  check(pressed(overlap, 'au-preset').length === 0 && text(overlap, '[data-au-run="api-0"] [data-au-count]') === '3' && cites('api-0').join() === '2,5,8', 'Edited citation: no preset pressed, count updated');
  check(matrixOk(edited), 'Edited citation: matrix recomputed');
  overlap.querySelector('[data-au-run="api-0"] [data-demo-action="au-cite"][data-source="1"]').click();
  check(pressed(overlap, 'au-preset').join() === 'pool' && readout()[4] === '0.000', 'Re-adding the citation restores the preset');
  // Empty runs: Jaccard is undefined and excluded (Section 5.5).
  for (const key of ['api-0', 'api-1', 'api-2']) {
    [...overlap.querySelectorAll(`[data-au-run="${key}"] [data-demo-action="au-cite"][aria-pressed="true"]`)].forEach(b => b.click());
  }
  expectReadout([[], [], []], presets.pool[1], 'All API runs empty');
  check(readout()[0] === '—' && readout()[4] === '—' && text(overlap, '[data-au-calc-status]').startsWith('Overlap is undefined'), 'Empty API runs: undefined within-API overlap and gap');
  check(overlap.querySelector('[data-au-pair="1-0"]').textContent.trim() === '—' && overlap.querySelector('[data-au-pair="3-0"]').textContent.trim() === '0.00', 'Empty runs: undefined pair shown as a dash, empty-versus-cited pair as 0');
  overlap.querySelector('[data-au-run="api-0"] [data-demo-action="au-cite"][data-source="3"]').click();
  expectReadout([[3], [], []], presets.pool[1], 'One API citation');
  act(overlap, 'au-preset', 'specific');
  check(readout()[4] === '+0.216', 'Preset restores the initial lists');

  /* ------------------------------------------------------------ Tables A1–A3 explorer */
  const cell = (feature, column) => contrasts.querySelector(`[data-au-feature="${feature}"] [data-au-cell="${column}"]`);
  const columns = ['c53', 'h53', 'hc53', 'c54'];
  const cellText = el => {
    const delta = text(el, '.au-delta');
    const p = text(el, '.au-p');
    return p ? `${delta} (${p.replace('p < ', '<').replace('p = ', '')})` : delta;
  };
  check(contrasts.querySelectorAll('[data-au-feature]').length === 18, 'Explorer: all 18 measures of Table A2');
  let allCells = true;
  for (const [feature, values] of Object.entries(A2)) {
    values.forEach((value, i) => { if (cellText(cell(feature, columns[i])) !== value) { allCells = false; failures.push(`A2 ${feature} ${columns[i]}: ${cellText(cell(feature, columns[i]))} ≠ ${value}`); } });
  }
  check(allCells, 'Explorer: every Table A2 cell as printed');
  const statesOk = cut => Object.entries(A2).every(([feature, values]) => values.every((value, i) => cell(feature, columns[i]).dataset.state === expectedState(value, cut)));
  const direction = feature => text(contrasts, `[data-au-feature="${feature}"] [data-au-direction]`);
  // Independent count of reversals between the two ChatGPT-vs-API columns.
  const versionCount = cut => {
    let both = 0, flips = 0;
    for (const values of Object.values(A2)) {
      const a = expectedState(values[0], cut), b = expectedState(values[3], cut);
      if (['pos', 'neg'].includes(a) && ['pos', 'neg'].includes(b)) { both++; if (a !== b) flips++; }
    }
    return [both, flips];
  };
  check(pressed(contrasts, 'au-threshold').join() === '0.05' && statesOk(0.05), 'p < 0.05: every cell marked from its printed p-value');
  check(versionCount(0.05).join() === '10,9', 'Independent count at p < 0.05: 10 measures in both versions, 9 reversals');
  let summary = text(contrasts, '[data-au-summary]');
  check(summary.includes('12 of 15 tested measures differ for GPT-5.3 ChatGPT vs API') && summary.includes('11 of 15 for GPT-5.3 Health vs API') &&
    summary.includes('5 of 11 for GPT-5.3 Health vs ChatGPT') && summary.includes('13 of 17 for GPT-5.4 ChatGPT vs API'), 'p < 0.05: per-contrast counts');
  check(summary.includes('Of the 10 measures that pass in both versions') && summary.includes('9 change direction') && summary.includes('only length (words, counting the GPT-5.4 interface preamble) keeps its direction'), 'p < 0.05: reversal summary');
  check(direction('asks') === 'Reverses' && direction('length') === 'Same' && direction('emoji') === '5.3 only' && direction('disclaimer') === '5.4 only' && direction('care-levels') === 'Neither' && direction('webpages') === '—', 'p < 0.05: direction column');
  act(contrasts, 'au-threshold', '0.001');
  check(statesOk(0.001) && versionCount(0.001).join() === '6,6', 'p < 0.001: cells re-marked; 6 of 6 reverse');
  summary = text(contrasts, '[data-au-summary]');
  check(summary.includes('10 of 15 tested measures differ for GPT-5.3 ChatGPT vs API') && summary.includes('all 6 change direction') && !summary.includes('keeps its direction'), 'p < 0.001: summary');
  check(cell('offers', 'c53').dataset.state === 'ns' && cell('offers', 'c54').dataset.state === 'ns' && direction('length') === '5.3 only', 'p < 0.001: borderline contrasts drop out; length passes in GPT-5.3 only');
  act(contrasts, 'au-threshold', '0.01');
  check(statesOk(0.01) && versionCount(0.01).join() === '9,8' && text(contrasts, '[data-au-summary]').includes('Of the 9 measures'), 'p < 0.01: cells and summary');
  // Overlap rows follow the cut-off.
  const overlapRows = [...contrasts.querySelectorAll('[data-au-overlap]')];
  const overlapCells = row => [...row.querySelectorAll('td.au-num')].map(td => td.textContent.trim());
  check(overlapRows.length === 10 && overlapRows.every((row, i) => {
    const [n, cross, within, delta, p] = A3[i];
    return overlapCells(row).join('|') === [within, cross, delta, p].join('|') &&
      text(row, 'th small').endsWith(`n = ${n}`);
  }), 'Table A3: all ten rows as printed, with n');
  const sigRows = () => overlapRows.filter(row => row.dataset.state === 'sig').map(row => row.dataset.auOverlap).join();
  check(sigRows() === '0,1,3' && text(contrasts, '[data-au-overlap-status]').includes('3 of 10'), 'p < 0.01: three overlap gaps pass');
  act(contrasts, 'au-threshold', '0.05');
  check(sigRows() === '0,1,2,3,5' && text(contrasts, '[data-au-overlap-status]').includes('5 of 10') && text(contrasts, '[data-au-overlap-status]').includes('from +0.010 to +0.091'), 'p < 0.05: five overlap gaps pass; all gaps positive');
  // Measure detail: Table A1 means.
  const means = () => [...contrasts.querySelectorAll('[data-au-means] tr')].map(tr => tr.querySelector('td.au-num').textContent.replace(/\s+/g, ' ').trim());
  check(pressed(contrasts, 'au-feature').join() === 'asks' && means().join('|') === A1.asks.join('|'), 'Detail opens on requests for information with Table A1 means');
  check(text(contrasts, '[data-au-detail-status]').includes('GPT-5.4 ChatGPT vs API: −24.7 pp, p < 0.001; ChatGPT asks for information in fewer runs') && text(contrasts, '[data-au-detail-status]').includes('reverses direction'), 'Detail: reading of the reversal');
  act(contrasts, 'au-feature', 'length-final');
  check(text(contrasts, '[data-au-detail-title]') === 'Length without preamble' && means().join('|') === A1['length-final'].join('|') && text(contrasts, '[data-au-detail-status]').includes('−45 words, p < 0.001; ChatGPT gives shorter answers'), 'Detail: final-answer length reverses the sign');
  check(contrasts.querySelector('[data-au-feature="length-final"]').classList.contains('is-selected') && !contrasts.querySelector('[data-au-feature="asks"]').classList.contains('is-selected'), 'Detail: selected row marked');
  act(contrasts, 'au-feature', 'readability');
  check(means().join('|') === A1.readability.join('|') && text(contrasts, '[data-au-detail-status]').includes('ChatGPT Health is easier to read'), 'Detail: readability means and direction words');
  act(contrasts, 'au-feature', 'care-levels');
  check(means().join('|') === A1['care-levels'].join('|') && text(contrasts, '[data-au-detail-status]').includes('Neither version'), 'Detail: levels of care do not differ');
  const bars = [...contrasts.querySelectorAll('[data-au-means] .au-bar i')].map(i => parseFloat(i.style.width));
  check(Math.abs(bars[3] - 100) < 0.01 && Math.abs(bars[0] - 100 * 3.0 / 4.2) < 0.01, 'Detail: count bars scaled to the largest mean');

  /* ------------------------------------------------------------ Visual rules */
  for (const root of [overlap, contrasts]) {
    const view = doc.defaultView;
    const h3 = view.getComputedStyle(root.querySelector('header h3'));
    check(h3.fontFamily.startsWith('Georgia') && h3.fontWeight === '400', `${root.dataset.paperDemo}: serif heading`);
    const elements = [root, ...root.querySelectorAll('*')];
    check(!elements.some(el => parseFloat(view.getComputedStyle(el).borderTopLeftRadius) > 0), `${root.dataset.paperDemo}: square corners`);
    check(!elements.some(el => view.getComputedStyle(el).boxShadow !== 'none'), `${root.dataset.paperDemo}: no shadows`);
    check(!elements.some(el => view.getComputedStyle(el).backgroundImage !== 'none'), `${root.dataset.paperDemo}: no gradients or background images`);
    check(!elements.some(el => { const s = view.getComputedStyle(el); return s.animationName !== 'none' || s.transitionDuration.split(',').some(d => parseFloat(d) > 0); }), `${root.dataset.paperDemo}: no motion`);
    check(root.querySelectorAll('[role="status"][aria-live="polite"]').length >= 1, `${root.dataset.paperDemo}: live status region`);
  }

  /* ------------------------------------------------------------ Narrow layouts */
  for (const width of [390, 320]) {
    frame.style.width = `${width}px`;
    doc = await load();
    const demo = doc.querySelector('[data-paper-demo="auditing-contrasts"]');
    act(demo, 'au-feature', 'length-final');
    act(demo, 'au-threshold', '0.001');
    const calc = doc.querySelector('[data-paper-demo="auditing-overlap"]');
    act(calc, 'au-preset', 'fixed');
    check(doc.documentElement.scrollWidth <= width + 1, `${width}px: no page overflow after interaction`);
    const scroller = doc.querySelector('.au-figure-scroll');
    check(scroller.scrollWidth > scroller.clientWidth && doc.querySelector('.au-figure img').getBoundingClientRect().width >= 590, `${width}px: Figure 1 keeps a legible width and scrolls in its frame`);
    check([...doc.querySelectorAll('.auditing-demo p, .auditing-demo h3, .auditing-demo h4')].every(el => el.scrollWidth <= el.clientWidth + 2), `${width}px: no clipped demo text`);
  }
  frame.style.width = '1280px';

  /* ------------------------------------------------------------ Script-free fallback */
  {
    const html = await fetch('/papers/auditing-health-llms.html').then(response => response.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    frame.style.width = '390px';
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    const calc = doc.querySelector('[data-paper-demo="auditing-overlap"]');
    const table = doc.querySelector('[data-paper-demo="auditing-contrasts"]');
    for (const root of [calc, table]) {
      check(![...root.querySelectorAll('[data-demo-action]')].some(visible), `${root.dataset.paperDemo} (no JS): controls hidden`);
      check([...root.querySelectorAll('[data-demo-state]')].filter(visible).length > 0 && [...root.querySelectorAll('[data-demo-state]')].filter(visible).every(el => el.textContent.trim().length > 20), `${root.dataset.paperDemo} (no JS): readable state`);
    }
    check([...calc.querySelectorAll('[data-au-static]')].filter(visible).length === 48 && text(calc, '[data-au-out="delta"]') === '+0.216' && text(calc, '[data-au-out="cross"]') === '0.206', 'Overlap (no JS): the mode-specific lists and their computed overlap');
    check(text(table, '[data-au-summary]').includes('12 of 15 tested measures differ') && table.querySelectorAll('[data-au-feature] .au-row-label').length === 18 && [...table.querySelectorAll('.au-row-label')].every(visible), 'Explorer (no JS): every measure and the p < 0.05 summary');
    check([...table.querySelectorAll('[data-au-means] tr td.au-num')].map(td => td.textContent.replace(/\s+/g, ' ').trim()).join('|') === A1.asks.join('|'), 'Explorer (no JS): Table A1 means for the initial measure');
    check(visible(doc.querySelector('.au-figure img')) && doc.documentElement.scrollWidth <= 391, 'No JS: Figure 1 visible and no phone overflow');
  }
  frame.remove();
  return { assertions, failures };
})();
