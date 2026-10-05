/* Judge and generation demos (Themis, NLG evaluation survey, EAMA, contextual ASR).
 * Run against the local preview: agent-browser eval --stdin < tests/browser_demo_judges.js
 * Expected values are typed in here from the papers' tables, and every computed number
 * (differences, statuses, gap shares, datastore states) is recomputed independently of
 * papers/demos/judges.js.
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
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const act = (root, action) => { const el = root.querySelector(`[data-demo-action="${action}"]`); if (!el) throw new Error(`missing ${action}`); el.click(); };
  const pressed = (root, action) => root.querySelector(`[data-demo-action="${action}"]`).getAttribute('aria-pressed') === 'true';
  const verdict = root => text(root.querySelector('[data-jd-verdict]'));
  const noOverflow = (doc, width) => doc.documentElement.scrollWidth <= width + 1;
  const m = s => Math.round(Number(String(s).replace('−', '-')) * 1000);

  /* ---------------- Themis: exact printed values, differences, navigation ---------------- */
  let doc = await load('themis');
  let root = doc.querySelector('[data-paper-demo="themis"]');
  check(root.dataset.demoReady === 'true' && !root.querySelector('[data-demo-controls]').hidden, 'Themis controls initialize');
  check(Boolean(root.closest('#findings .section-demo.evidence-demo')), 'Themis explorer sits in Reading the evidence');
  check(!root.closest('#findings').querySelector('.results-table') || !text(root).includes('67K raw data'), 'Themis explorer does not repeat the Table 3 ablation rows');
  const bar = key => text(root.querySelector(`.jd-bars [data-value="${key}"]`));
  const openView = (bench, view, measure) => {
    act(root, `bench:${bench}`);
    if (view) act(root, `view:${view}`);
    if (measure) act(root, `measure:${measure}`);
  };
  // Spot checks against the printed tables (value strings exactly as printed, with a typographic minus).
  const printed = [
    ['summeval', '', 'ρ', { themis: '0.553', gpt4: '0.511', geval4: '0.523', unieval: '0.474', bleu: '0.075' }, 'Table 2'],
    ['summeval', '', 'τ', { themis: '0.499', gpt4: '0.423', geval4: '0.423' }, 'Table 2'],
    ['topical', '', 'r', { themis: '0.733', gpt4: '0.770', geval35: '0.574' }, 'Table 2'],
    ['wmt', '', 'ρ', { themis: '0.405', gpt4: '0.437', cometkiwi: '0.343' }, 'Table 2'],
    ['wmt', '', 'τ', { themis: '0.357', gpt4: '0.361', bleu: '0.018' }, 'Table 26'],
    ['wmt', '', 'r', { bleu: '−0.130', themis: '0.431' }, 'Table 2'],
    ['summeval', 'summeval-relevance', 'ρ', { hdeval: '0.599', autocalibrate: '0.560', themis: '0.474', gpt4: '0.491' }, 'Table 21'],
    ['sf', 'sf-sfhot-informativeness', 'ρ', { gpt4: '0.302', themis: '0.259', autocalibrate: '0.357' }, 'Table 23'],
    ['qags', 'qags-xsum', 'r', { instructscore: '−0.096', themis: '0.599', autocalibrate: '0.662' }, 'Table 24'],
    ['mans', 'mans-wp', 'ρ', { themis: '0.495', gpt4: '0.368', rouge: '−0.004' }, 'Table 25'],
    ['topical', 'topical-knowledge-use', 'ρ', { xeval: '0.728', gpt4: '0.786', themis: '0.761' }, 'Table 22'],
    ['unseen', 'unseen-com', 'ρ', { gpt4: '0.653', themis: '0.381', autoj: '0.562' }, 'Table 4'],
    ['unseen', '', 'ρ', { themis: '0.545', gpt4: '0.442', tigerscore: '0.106' }, 'Table 4'],
    ['average', '', 'τ', { themis: '0.486', gpt4: '0.417', autoj: '0.211' }, 'Table 3'],
    ['average', '', 'ρ', { themis: '0.542', gpt4: '0.521', gpt35: '0.401' }, 'Table 2'],
  ];
  for (const [bench, view, measure, values, table] of printed) {
    openView(bench, view, measure);
    const label = `Themis ${bench}/${view || 'benchmark'}/${measure}`;
    check(Object.entries(values).every(([key, value]) => bar(key) === value), `${label}: printed values ${JSON.stringify(Object.fromEntries(Object.keys(values).map(k => [k, bar(k)])))}`);
    check(text(root).includes(`Measured · ${table}`), `${label}: names ${table}`);
    const shown = [...root.querySelectorAll('.jd-bars .jd-bar-value')].map(el => m(el.textContent));
    check(shown.every((v, i) => i === 0 || shown[i - 1] >= v), `${label}: bars sorted highest first`);
    if ('themis' in values && 'gpt4' in values) {
      const diff = m(values.themis) - m(values.gpt4);
      const lead = diff > 0 ? `Themis-8B leads by ${(diff / 1000).toFixed(3)}` : `GPT-4 leads by ${(-diff / 1000).toFixed(3)}`;
      check(verdict(root).includes(lead), `${label}: verdict "${lead}"`);
    }
  }
  // Measure availability follows what the paper prints.
  act(root, 'bench:topical');
  const measureButton = key => root.querySelector(`[data-demo-action="measure:${key}"]`);
  check(measureButton('τ').disabled && !measureButton('r').disabled && !measureButton('ρ').disabled, 'Themis Topical-Chat prints r and ρ only');
  act(root, 'bench:qags');
  check(!measureButton('τ').disabled && measureButton('r').disabled, 'Themis QAGS benchmark level prints ρ and τ only');
  act(root, 'view:qags-cnn-dm');
  check(!measureButton('r').disabled && pressed(root, 'view:qags-cnn-dm'), 'Themis QAGS subsets add r');
  // Cautions next to printed inconsistencies.
  openView('mans', '', 'τ');
  check(text(root.querySelector('[data-jd-caution]')).includes('0.427') && bar('gpt4') === '0.260', 'Themis flags the MANS τ average that is not the mean of ROC and WP');
  openView('qags', '', 'ρ');
  check(text(root.querySelector('[data-jd-caution]')).includes('other way round'), 'Themis flags the swapped G-Eval rows of Table 24');
  // Every difference cell equals Themis minus GPT-4 in its own column; warm cells are GPT-4 wins.
  const expectedLosses = { 'ρ': 11, 'τ': 2, 'r': 6 };
  for (const measure of ['ρ', 'τ', 'r']) {
    openView('summeval', '', 'ρ');
    if (measure !== 'ρ') { act(root, measure === 'r' ? 'bench:topical' : 'bench:summeval'); act(root, `measure:${measure}`); }
    const ids = [...root.querySelectorAll('.jd-board .jd-cell')].map(el => el.dataset.jdView);
    let losses = 0;
    let consistent = true;
    for (const id of ids) {
      root.querySelector(`.jd-board .jd-cell[data-jd-view="${id}"]`).click();
      const cell = root.querySelector(`.jd-board .jd-cell[data-jd-view="${id}"]`);
      const diff = m(bar('themis')) - m(bar('gpt4'));
      const shown = text(cell.querySelector('strong'));
      const expected = `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${(Math.abs(diff) / 1000).toFixed(3)}`;
      if (shown !== expected || cell.classList.contains('is-gpt4-win') !== diff < 0 || cell.getAttribute('aria-pressed') !== 'true') consistent = false;
      if (diff < 0) losses++;
    }
    check(consistent, `Themis ${measure}: every grid cell equals Themis − GPT-4 of its column`);
    check(losses === expectedLosses[measure] && text(root.querySelector('.jd-board')).includes(`${losses} of ${ids.length} columns`), `Themis ${measure}: GPT-4 leads in ${losses} of ${ids.length} columns (expected ${expectedLosses[measure]})`);
    check(verdict(root).includes(`GPT-4 is higher than Themis in ${losses} of the ${ids.length} columns`), `Themis ${measure}: verdict counts the GPT-4 columns`);
  }
  // The non-obvious reading: SummEval relevance goes to GPT-4 under ρ but to Themis under τ.
  openView('summeval', 'summeval-relevance', 'ρ');
  check(verdict(root).includes('GPT-4 leads by 0.017') && verdict(root).includes('HD-EVAL-NN 0.599'), 'Themis SummEval relevance ρ: GPT-4 and appendix-only evaluators lead');
  act(root, 'measure:τ');
  check(verdict(root).includes('Themis-8B leads by 0.017'), 'Themis SummEval relevance τ: Themis leads');
  check(root.querySelector('[data-jd-verdict]').getAttribute('role') === 'status' && root.querySelector('[data-jd-verdict]').getAttribute('aria-live') === 'polite', 'Themis live verdict');
  check(!text(root).includes('NaN') && !text(root).includes('undefined'), 'Themis has no invalid values');

  /* ---------------- NLG survey: every cell traceable, situations, orderings ---------------- */
  doc = await load('nlg-evaluation-survey');
  root = doc.querySelector('[data-paper-demo="nlg-evaluation-survey"]');
  check(root.dataset.demoReady === 'true', 'Survey controls initialize');
  check(Boolean(root.closest('#findings .section-demo.evidence-demo')), 'Survey table sits in Reading the evidence');
  const cells = [...root.querySelectorAll('.jd-paradigms tbody tr:not(.jd-measured-row) td')];
  check(cells.length === 24 && cells.every(td => /\((§\d|Table \d)/.test(text(td))), `Survey: all ${cells.length} cells cite a section or table`);
  const headers = [...root.querySelectorAll('.jd-paradigms thead th[data-paradigm]')].map(th => th.dataset.paradigm);
  check(headers.join() === 'derived,prompting,finetuning,collab', 'Survey: the four paradigms in the survey order');
  const best = id => text(root.querySelector(`[data-jd-best="${id}"]`));
  check(best('derived') === '0.436' && best('prompting') === '0.523' && best('finetuning') === '0.553' && best('collab') === '0.725', 'Survey: best SummEval overall per paradigm (Table 4)');
  check(text(root).includes('range 0.258–0.553 over 5 rows') && text(root).includes('GPTScore (Qwen-2.5)') && text(root).includes('InteractEval (GPT-4 2nd)'), 'Survey: Table 4 ranges and best rows');
  // Independent statement of which situations restrict which paradigms.
  const effects = {
    noref: { finetuning: 'caveat' }, closed: { derived: 'out', prompting: 'caveat', finetuning: 'out' },
    notrain: { finetuning: 'caveat' }, nohumans: { collab: 'out' },
    reproducible: { prompting: 'caveat', finetuning: 'caveat', collab: 'caveat' },
    criteria: { derived: 'caveat', finetuning: 'caveat' }, medium: { prompting: 'caveat' },
  };
  const rank = { fits: 0, caveat: 1, out: 2 };
  const statusOf = id => ['fits', 'caveat', 'out'].find(s => root.querySelector(`.jd-paradigms thead th[data-paradigm="${id}"]`).classList.contains(`jd-status-${s}`)) || 'none';
  const expectStatus = active => Object.fromEntries(headers.map(id => [id, active.reduce((worst, f) => (rank[effects[f][id] || 'fits'] > rank[worst] ? effects[f][id] : worst), 'fits')]));
  const setFilters = active => Object.keys(effects).forEach(f => { if (pressed(root, `filter:${f}`) !== active.includes(f)) act(root, `filter:${f}`); });
  check(headers.every(id => statusOf(id) === 'none') && verdict(root).startsWith('No situation selected'), 'Survey: no situation marks no column');
  for (const active of [['noref'], ['closed'], ['nohumans'], ['closed', 'nohumans'], ['notrain', 'reproducible'], ['criteria', 'medium', 'noref'], Object.keys(effects)]) {
    setFilters(active);
    const want = expectStatus(active);
    check(headers.every(id => statusOf(id) === want[id]), `Survey ${active}: statuses ${headers.map(statusOf)} vs ${headers.map(id => want[id])}`);
    check(Object.keys(effects).every(f => pressed(root, `filter:${f}`) === active.includes(f)), `Survey ${active}: toggles expose aria-pressed`);
    const reasons = root.querySelectorAll('.jd-reasons li').length;
    const expectedReasons = active.reduce((n, f) => n + Object.values(effects[f]).filter(s => s !== 'fits').length, 0);
    check(reasons === expectedReasons, `Survey ${active}: ${reasons} caveats listed vs ${expectedReasons}`);
  }
  setFilters(['closed', 'nohumans']);
  check(verdict(root).startsWith('Fit with a caveat: Prompting LLMs. Ruled out: LLM-derived metrics, Fine-tuning LLMs, Human–LLM collaboration.'), 'Survey: a closed judge without human experts leaves only prompting, with its caveat');
  check([...root.querySelectorAll('.jd-reasons li')].every(li => /\((§\d|Table \d)/.test(text(li))), 'Survey: every caveat cites a section');
  setFilters(Object.keys(effects));
  check(verdict(root).startsWith('Fit with a caveat: Prompting LLMs. Ruled out: LLM-derived metrics, Fine-tuning LLMs, Human–LLM collaboration.'), 'Survey: with every situation selected only prompting remains, with caveats');
  setFilters([]);
  act(root, 'order:reproducibility');
  check(pressed(root, 'order:reproducibility') && text(root.querySelector('.jd-orderings .is-current')).includes('LLM-derived metrics ≈ Prompting LLMs > Fine-tuning LLMs > Human–LLM collaboration'), 'Survey: reproducibility ordering as printed in §6.2');
  check(text(root.querySelector('thead th[data-paradigm="derived"] .jd-rank')) === 'Reproducibility: 1st (tie)' && text(root.querySelector('thead th[data-paradigm="collab"] .jd-rank')) === 'Reproducibility: 3rd', 'Survey: column ranks follow the selected ordering');
  act(root, 'order:cost');
  check(text(root.querySelector('thead th[data-paradigm="prompting"] .jd-rank')).includes('open-source LLM') && text(root.querySelector('thead th[data-paradigm="prompting"] .jd-rank')).includes('proprietary LLM'), 'Survey: cost ranks prompting twice, open and proprietary');
  check(root.querySelectorAll('.jd-orderings li').length === 4, 'Survey: all four §6.2 orderings listed');

  /* ---------------- EAMA: printed ladder, recomputed changes and gap ---------------- */
  doc = await load('eama');
  root = doc.querySelector('[data-paper-demo="eama"]');
  check(root.dataset.demoReady === 'true' && Boolean(root.closest('#findings .section-demo.evidence-demo')), 'EAMA explorer initializes in Reading the evidence');
  const table = {   // BLEU-4, METEOR, ROUGE, CIDEr, P, R as printed in Tables 2 and 4 (arXiv v5)
    osft: [10.05, 13.63, 25.45, 75.95, 27.39, 30.37], base: [10.88, 14.09, 26.60, 82.70, 29.22, 31.32],
    sent: [10.92, 14.08, 26.68, 83.60, 29.42, 31.45], ent: [10.97, 14.20, 26.87, 84.28, 29.26, 31.58],
    align: [10.80, 14.08, 26.80, 84.45, 29.15, 31.45], eama: [11.03, 14.22, 27.15, 87.00, 29.79, 32.24],
    full: [10.76, 13.84, 26.18, 83.17, 27.71, 30.03], 'base-longer': [10.60, 13.80, 26.28, 81.75, 28.95, 30.57],
    'align-longer': [10.75, 14.00, 26.70, 83.50, 29.25, 31.16], 'oracle-sent': [11.24, 14.50, 27.70, 87.56, 33.42, 34.80],
    'oracle-ent': [11.63, 14.76, 27.90, 90.44, 32.04, 34.24], oracle: [11.89, 15.07, 28.79, 94.27, 35.71, 37.10],
  };
  const parents = { base: 'osft', sent: 'base', ent: 'base', align: 'base', eama: 'align', full: 'base', 'base-longer': 'base', 'align-longer': 'align', 'oracle-sent': 'base', 'oracle-ent': 'base', oracle: 'base' };
  const columns = ['bleu', 'meteor', 'rouge', 'cider', 'p', 'r'];
  const c100 = v => Math.round(v * 100);
  const sgn = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${(Math.abs(v) / 100).toFixed(2)}`;
  for (const metric of ['cider', 'bleu', 'meteor', 'rouge', 'p', 'r']) {
    act(root, `metric:${metric}`);
    const k = columns.indexOf(metric);
    check(pressed(root, `metric:${metric}`), `EAMA ${metric} pressed`);
    check(Object.entries(table).every(([id, row]) => text(root.querySelector(`[data-value="${id}"]`)) === row[k].toFixed(2)), `EAMA ${metric}: all twelve printed values`);
    check(Object.entries(parents).every(([id, parent]) => text(root.querySelector(`[data-delta="${id}"]`)).startsWith(sgn(c100(table[id][k]) - c100(table[parent][k])))), `EAMA ${metric}: every change against its named row`);
    const base = c100(table.base[k]), eama = c100(table.eama[k]), oracle = c100(table.oracle[k]);
    const share = Math.round((eama - base) / (oracle - base) * 100);
    check(text(root.querySelector('[data-jd-gap="share"]')) === `${share}%` && text(root.querySelector('[data-jd-gap="remaining"]')) === sgn(oracle - eama), `EAMA ${metric}: closes ${share}% of the Base-to-oracle gap`);
    const variants = ['sent', 'ent', 'align'];
    const top = variants.reduce((a, b) => (table[b][k] > table[a][k] ? b : a));
    check(verdict(root).includes(top === 'align' ? 'together beat either task alone' : 'combining both tasks is not best on this metric'), `EAMA ${metric}: verdict on the alignment variants (${top})`);
  }
  act(root, 'metric:cider');
  check(text(root.querySelector('[data-jd-gap="share"]')) === '37%' && verdict(root).includes('changes Base by +0.47') && verdict(root).includes('+4.30'), 'EAMA CIDEr: 37% of the gap; full article +0.47 vs +4.30');
  act(root, 'metric:p');
  check(verdict(root).includes('Align (SENT + CAP) scores highest') && verdict(root).includes('lowers entity precision below Base'), 'EAMA entity precision: joint alignment is not best and lowers precision');

  /* ---------------- Contextual ASR: datastore states, animation, reduced motion ---------------- */
  doc = await load('contextual-asr');
  root = doc.querySelector('[data-paper-demo="contextual-asr"]');
  check(root.dataset.demoReady === 'true' && Boolean(root.closest('#method .section-demo.method-demo')), 'ASR walk-through initializes in Inside the method');
  const play = root.querySelector('[data-asr-play]'), stepButton = root.querySelector('[data-asr-step]'), reset = root.querySelector('[data-asr-reset]');
  const stateOf = cell => root.querySelector(`[data-cell="${cell}"]`).dataset.state;
  const stepText = () => text(root.querySelector('[data-asr-status]'));
  // Independent statement of Section 3.4: online stores earlier steps only; offline the finished store;
  // document scope searches document A, dataset scope every document; the current sentence is separate.
  const expectState = (doc_, pos, step, timing, scope) => {
    if (step && doc_ === 'A' && pos === step) return 'current';
    if (!(timing === 'offline' || pos < step)) return 'pending';
    if (scope === 'document' && doc_ !== 'A') return 'outside';
    return doc_ === 'A' ? 'same' : 'other';
  };
  check(stepText() === 'Step 0 of 5' && verdict(root).includes('online datastore is empty'), 'ASR starts at step 0 with an empty online store');
  check(play.getAttribute('aria-pressed') === 'false' && play.textContent === 'Play', 'ASR Play starts paused');
  for (const [timing, scope] of [['online', 'document'], ['online', 'dataset'], ['offline', 'document'], ['offline', 'dataset']]) {
    act(root, `timing:${timing}`); act(root, `scope:${scope}`);
    reset.click();
    for (let step = 0; step <= 5; step++) {
      const ok = ['A', 'B', 'C'].every(d => [1, 2, 3, 4, 5].every(p => stateOf(`${d}${p}`) === expectState(d, p, step, timing, scope)));
      const same = [1, 2, 3, 4, 5].filter(p => expectState('A', p, step, timing, scope) === 'same').length;
      const other = ['B', 'C'].reduce((n, d) => n + [1, 2, 3, 4, 5].filter(p => expectState(d, p, step, timing, scope) === 'other').length, 0);
      check(ok && text(root.querySelector('[data-jd-count="same"]')) === String(same) && text(root.querySelector('[data-jd-count="other"]')) === String(other), `ASR ${timing}/${scope} step ${step}: every cell state and the counts`);
      if (step < 5) stepButton.click();
    }
    check(stepText() === 'Step 5 of 5' && stepButton.disabled, `ASR ${timing}/${scope}: Step stops at the last sentence`);
  }
  // The cue: Table 1 (same document) and Table 4 (another document), before or after the target.
  const cueAt = (caseId, cue, timing, scope) => {
    act(root, `case:${caseId}`); act(root, `cue:${cue}`); act(root, `timing:${timing}`); act(root, `scope:${scope}`);
    reset.click(); stepButton.click(); stepButton.click(); stepButton.click();
    return verdict(root);
  };
  const cueCases = [
    ['pronoun', 'before', 'online', 'document', 'The cue A2 is searchable'],
    ['pronoun', 'after', 'online', 'document', 'The cue A4 is not searchable (not processed yet)'],
    ['pronoun', 'after', 'offline', 'document', 'The cue A4 is searchable'],
    ['dataset', 'before', 'online', 'document', 'The cue B2 is not searchable (in another document)'],
    ['dataset', 'before', 'online', 'dataset', 'The cue B2 is searchable'],
    ['dataset', 'after', 'online', 'dataset', 'The cue B4 is not searchable (not processed yet)'],
    ['dataset', 'after', 'offline', 'document', 'The cue B4 is not searchable (in another document)'],
    ['dataset', 'after', 'offline', 'dataset', 'The cue B4 is searchable'],
  ];
  for (const [caseId, cue, timing, scope, expected] of cueCases) check(cueAt(caseId, cue, timing, scope).includes(expected), `ASR ${caseId}/${cue}/${timing}/${scope}: ${expected}`);
  act(root, 'case:pronoun'); act(root, 'cue:before');
  check(text(root).includes('本场比赛朱婷三七次扣球得到二十一分。') && text(root).includes('他还凭借拦网和发球分别拿到七分和一分。') && text(root).includes('她还凭借拦网和发球分别拿到七分和一分。'), 'ASR shows the Table 1 sentences verbatim');
  act(root, 'case:dataset');
  check(text(root).includes('深入贯彻落实科学发展观。') && text(root).includes('编者按：为深入管撤落实中央八项规定精神。'), 'ASR shows the Table 4 sentences verbatim');
  const summary = () => [...root.querySelectorAll('.jd-asr-summary tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.firstChild.textContent).join('|'));
  check(summary().join(';') === 'No|No|3.412;Yes|No|3.379;No|No|3.407;Yes|Yes|3.336*', `ASR Table 4 case summary ${summary().join(';')}`);
  act(root, 'case:pronoun');
  check(summary().join(';') === 'Yes|No|3.412;Yes|No|3.379;Yes|Yes|3.407;Yes|Yes|3.336*', `ASR Table 1 case summary ${summary().join(';')}`);
  check(['case:pronoun', 'cue:before'].every(a => pressed(root, a)) && !pressed(root, 'case:dataset'), 'ASR toggles expose aria-pressed');
  // Play runs to the end; Pause holds; Reset returns to step 0.
  act(root, 'timing:online'); act(root, 'scope:document');
  root.dataset.stepMs = '40';
  root.dataset.reducedMotion = 'false';
  reset.click();
  play.click();
  check(play.getAttribute('aria-pressed') === 'true' && play.textContent === 'Pause' && stepText() === 'Step 1 of 5', 'ASR Play advances at once and shows Pause');
  await wait(400);
  check(stepText() === 'Step 5 of 5' && play.getAttribute('aria-pressed') === 'false' && play.textContent === 'Play', 'ASR Play ends at the last step and stops');
  check(verdict(root).includes('Correcting A5'), 'ASR end state verdict');
  play.click();
  check(stepText() === 'Step 1 of 5', 'ASR Play at the end restarts from the beginning');
  play.click();
  const held = stepText();
  await wait(200);
  check(stepText() === held && play.getAttribute('aria-pressed') === 'false', 'ASR Pause holds the current step');
  reset.click();
  check(stepText() === 'Step 0 of 5' && verdict(root).includes('online datastore is empty') && [1, 2, 3, 4, 5].every(p => stateOf(`A${p}`) === 'pending'), 'ASR Reset returns to step 0');
  // Reduced motion: Play advances one step without a timed sequence.
  root.dataset.reducedMotion = 'true';
  play.click();
  check(stepText() === 'Step 1 of 5' && play.getAttribute('aria-pressed') === 'false', 'ASR reduced motion: Play advances one step and does not run');
  await wait(200);
  check(stepText() === 'Step 1 of 5', 'ASR reduced motion: no further steps');
  root.dataset.reducedMotion = 'false';
  const durations = [...root.querySelectorAll('*')].map(el => doc.defaultView.getComputedStyle(el).transitionDuration.split(',').map(parseFloat).reduce((a, b) => Math.max(a, b), 0));
  check(Math.max(...durations) <= 0.6, 'ASR transitions are at most 600 ms');
  check([...root.querySelectorAll('*')].every((el, i) => durations[i] === 0 || el.classList.contains('jd-cell-asr')), 'ASR only the datastore cells change with a transition');
  check(root.querySelector('[data-jd-verdict]').getAttribute('aria-live') === 'polite', 'ASR live verdict');

  /* ---------------- No-JS state, live initial state, phone layout ---------------- */
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
    'themis': ['0.553', '0.511', 'Themis-8B leads by 0.042', '11 of 34 columns', '−0.272', 'Measured · Table 2', 'Computed'],
    'nlg-evaluation-survey': ['LLM-derived metrics', 'Human–LLM collaboration', '§2.3', '0.725', 'Table 3', 'Flexibility (§6.2)', 'Published'],
    'eama': ['82.70', '84.45', '87.00', '94.27', '83.17', '37%', 'Measured · Tables 2 and 4'],
    'contextual-asr': ['Step 0 of 5', '本场比赛朱婷', '3.336*', 'online datastore is empty', 'Schematic', 'Published · Table 1'],
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
      staticResults[slug] = text(demo.querySelector('[data-jd-results]')) + ' ' + verdict(demo);
    }
  }
  frame.style.width = '1200px';
  for (const slug of Object.keys(fallback)) {
    frame.removeAttribute('srcdoc');
    doc = await load(slug);
    const demo = doc.querySelector('[data-paper-demo]');
    check(text(demo.querySelector('[data-jd-results]')) + ' ' + verdict(demo) === staticResults[slug], `${slug}: browser initial state matches the Python-rendered state`);
  }
  frame.style.width = '320px';
  for (const slug of Object.keys(fallback)) {
    frame.removeAttribute('srcdoc');
    doc = await load(slug);
    const demo = doc.querySelector('[data-paper-demo]');
    if (slug === 'nlg-evaluation-survey') { demo.querySelector('[data-demo-action="filter:closed"]').click(); demo.querySelector('[data-demo-action="filter:reproducible"]').click(); }
    if (slug === 'themis') { demo.querySelector('[data-demo-action="bench:unseen"]').click(); }
    if (slug === 'contextual-asr') { demo.querySelector('[data-asr-step]').click(); demo.querySelector('[data-asr-step]').click(); demo.querySelector('[data-asr-step]').click(); }
    if (slug === 'eama') demo.querySelector('[data-demo-action="metric:p"]').click();
    check(noOverflow(doc, 320), `${slug}: enhanced layout fits 320px`);
    const clipped = [...demo.querySelectorAll('h3,h4,p,dt,dd,td,th')].filter(el => el.scrollWidth > el.clientWidth + 2);
    check(!clipped.length, `${slug}: no clipped text at 320px (${clipped.map(el => el.className || el.tagName).slice(0, 3)})`);
    check(![...demo.querySelectorAll('*')].some(el => { const cs = doc.defaultView.getComputedStyle(el); return parseFloat(cs.borderTopLeftRadius) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage.includes('gradient'); }), `${slug}: square, flat styling`);
    const h3 = demo.querySelector('h3');
    check(doc.defaultView.getComputedStyle(h3).fontFamily.includes('Georgia'), `${slug}: Georgia demo heading`);
  }
  frame.remove();
  return { assertions, failures };
})();
