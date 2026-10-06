/* Coding Agents for Long Context (coding-agents-long-context): which rows of Table 1 the
 * abstract's 17.3% average compares.
 * Run against the local preview, from any page on its origin:
 *   agent-browser eval --stdin < tests/browser_demo_longcontext.js
 * Table 1 scores and Table 5 costs are transcribed here from arXiv 2603.20432v1 (PDF pages 4
 * and 8), independently of the page configuration, and every one of the 30 row choices is
 * recomputed with an independent implementation. Run once more after
 * `agent-browser set media light reduced-motion`; the motion check switches expectations.
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
  const text = (root, selector) => (root.querySelector(selector)?.textContent ?? '').trim();
  const visible = el => Boolean(el) && el.getClientRects().length > 0;
  const SLUG = 'coding-agents-long-context';

  /* ---------------- Independent transcription (Table 1, Table 5) ---------------- */
  const BENCH = ['BrowseComp-Plus', 'Oolong-Syn', 'Oolong-Real', 'LongBench', 'NQ'];
  const UNIT = ['pp', 'points', 'points', 'pp', 'pp'];
  const T1 = {
    'GPT-5 Full Context': [20.00, 59.22, 22.45, 61.00, 27.00],
    'RAG': [65.00, 45.53, 13.38, 50.50, 47.00],
    'ReAct Agent': [72.50, 31.39, 19.06, 59.00, 49.00],
    'RLM': [null, 64.38, 23.07, 54.00, 55.33],
    'Best Published': [80.00, 64.38, 24.09, 63.30, 50.90],
    'Codex (No Retriever)': [88.50, 71.75, 33.73, 61.50, 56.00],
    'Codex + Gemini Emb.': [84.00, 68.03, 32.40, 61.50, null],
    'Codex + BM25': [78.50, 71.07, 30.86, 60.80, 53.00],
    'Claude Code + BM25': [null, null, 37.46, 62.50, null],
  };
  const FULL_SET = [true, false, false, true, true]; // * in the Best Published row
  const T5 = {
    'GPT-5 Full Context': [0.275, 1.421, 0.770, 0.432, 0.129],
    'RAG': [0.111, 0.045, 0.026, 0.024, 0.006],
    'ReAct Agent': [0.237, 0.092, 0.168, 0.056, 0.027],
    'RLM': [null, 0.920, 0.094, 0.360, 0.630],
    'Codex (No Retriever)': [0.703, 0.194, 0.419, 0.128, 0.111],
    'Codex + Gemini Emb.': [0.628, 0.149, 0.371, 0.129, null],
    'Codex + BM25': [0.828, 0.161, 0.368, 0.124, 0.094],
    'Claude Code + BM25': [null, null, 0.380, 0.319, null],
  };
  const AGENT_ROWS = ['Codex (No Retriever)', 'Codex + Gemini Emb.', 'Codex + BM25', 'Claude Code + BM25'];
  const RERUN_ROWS = ['GPT-5 Full Context', 'RAG', 'ReAct Agent', 'RLM'];
  const AGENT_CHOICES = { 'best': null, 'codex': 'Codex (No Retriever)', 'codex-gemini': 'Codex + Gemini Emb.', 'codex-bm25': 'Codex + BM25', 'claude-bm25': 'Claude Code + BM25' };
  const REF_CHOICES = { 'published': 'Best Published', 'strongest': null, 'full-context': 'GPT-5 Full Context', 'rag': 'RAG', 'react': 'ReAct Agent', 'rlm': 'RLM' };

  const fix = (v, d) => v.toFixed(d);
  const sign = (v, d) => { let s = (v >= 0 ? '+' : '') + fix(v, d); if (Number(s) === 0) s = fix(0, d); return s.replace('-', '−'); };
  const bestOf = (rows, i) => rows.reduce((best, name) => (T1[name][i] !== null && (best === null || T1[name][i] > T1[best][i]) ? name : best), null);
  const rowFor = (choice, table, i, composite) => {
    const name = table[choice];
    if (name === null) return bestOf(composite, i);
    return T1[name][i] !== null ? name : null;
  };
  function expected(agent, ref) {
    return BENCH.map((label, i) => {
      const a = rowFor(agent, AGENT_CHOICES, i, AGENT_ROWS);
      const r = rowFor(ref, REF_CHOICES, i, RERUN_ROWS);
      const av = a ? T1[a][i] : null;
      const rv = r ? T1[r][i] : null;
      const both = av !== null && rv !== null;
      const full = r === 'Best Published' && FULL_SET[i];
      return {
        label, a, r, av, rv, full,
        diff: both ? av - rv : null,
        rel: both ? (av - rv) / rv * 100 : null,
        ac: a && T5[a] ? T5[a][i] : null,
        rc: r && T5[r] ? T5[r][i] : null,
        texts: {
          agent: av !== null ? fix(av, 2) : '–',
          ref: rv !== null ? fix(rv, 2) + (full ? '*' : '') : '–',
          diff: both ? `${sign(av - rv, 2)} ${UNIT[i]}` : '–',
          rel: both ? `${sign((av - rv) / rv * 100, 1)}%` : '–',
          cost: `${a && T5[a] && T5[a][i] !== null ? '$' + fix(T5[a][i], 3) : '–'} vs ${r && T5[r] && T5[r][i] !== null ? '$' + fix(T5[r][i], 3) : '–'}`,
        },
      };
    });
  }
  const med = values => { const s = values.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  /* ---------------- Page placement and initial state ---------------- */
  let doc = await load(SLUG);
  let root = doc.querySelector('[data-paper-demo="longcontext-headline"]');
  check(root && root.dataset.demoReady === 'true', 'Demo initializes');
  check(!!root.closest('#findings .evidence-demo') && !doc.querySelector('#explore'), 'Demo sits in the Evidence section, after the findings');
  check(doc.querySelector('#findings .findings-grid').compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING, 'Findings precede the demo');
  check(text(root, '.lc-eyebrow') === 'Measured · Tables 1 and 5 · Computed · differences and relative changes', 'Eyebrow names the evidence');
  check(!root.querySelector('[data-demo-controls]').hidden && visible(root.querySelector('[data-demo-controls]')), 'Controls revealed');
  check([...root.querySelectorAll('[data-demo-action]')].every(b => b.tagName === 'BUTTON' && b.type === 'button'), 'Controls are keyboard-operable buttons');
  check(root.querySelectorAll('[data-demo-action="lc-agent"]').length === 5 && root.querySelectorAll('[data-demo-action="lc-ref"]').length === 6, 'Five agent choices and six references');
  const pressed = action => [...root.querySelectorAll(`[data-demo-action="${action}"]`)].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.value);
  check(pressed('lc-agent').join() === 'best' && pressed('lc-ref').join() === 'published', 'Default: best per benchmark vs best published');
  const serverSummary = text(root, '[data-lc-status]');
  const serverRows = root.querySelector('[data-lc-rows]').textContent;

  // The default reproduces the abstract's 17.3% and Figure 1's labels.
  check(text(root, '[data-lc-stat="mean"]') === '+17.3%', 'Default mean relative change is the abstract’s +17.3%');
  check(text(root, '[data-lc-stat="higher"]') === '4 of 5', 'Default: agent higher on 4 of 5');
  check(serverSummary.includes('Mean relative change +17.3%, matching the abstract;') && serverSummary.includes('Figure 1’s labels (+11%, +11%, +56%, −1%, +10%)'), 'Default summary ties the mean to the abstract and the rounded terms to Figure 1');
  check(serverSummary.includes('Claude Code + BM25 on Oolong-Real and LongBench'), 'Default summary names the agent row behind Oolong-Real and LongBench');
  check(serverSummary.includes('3 of the 5 reference scores (*) were measured on the full test set'), 'Default summary flags full-set references');

  /* ---------------- All 30 combinations against the independent reference ---------------- */
  const click = (action, value) => root.querySelector(`[data-demo-action="${action}"][data-value="${value}"]`).click();
  for (const agent of Object.keys(AGENT_CHOICES)) {
    for (const ref of Object.keys(REF_CHOICES)) {
      click('lc-agent', agent); click('lc-ref', ref);
      const exp = expected(agent, ref);
      const rows = [...root.querySelectorAll('[data-lc-rows] > li')];
      check(rows.length === 5, `${agent}/${ref}: five benchmark rows`);
      check(pressed('lc-agent').join() === agent && pressed('lc-ref').join() === ref, `${agent}/${ref}: pressed state`);
      exp.forEach((e, i) => {
        const li = rows[i];
        const got = {
          agent: text(li, '[data-lc-agent]'), ref: text(li, '[data-lc-ref]'), diff: text(li, '[data-lc-diff]'),
          rel: text(li, '[data-lc-rel]'), cost: text(li, '[data-lc-cost]'),
        };
        for (const key of Object.keys(got)) {
          check(got[key] === e.texts[key], `${agent}/${ref} ${e.label} ${key}: ${got[key]} vs ${e.texts[key]}`);
        }
        if (e.a) check(text(li, '[data-lc-agent-row]') === e.a, `${agent}/${ref} ${e.label}: agent row name ${e.a}`);
        if (e.r) check(text(li, '[data-lc-ref-row]') === e.r, `${agent}/${ref} ${e.label}: reference row name ${e.r}`);
        const outcome = e.diff === null ? 'none' : e.diff > 0 ? 'higher' : e.diff < 0 ? 'lower' : 'tie';
        check(li.dataset.outcome === outcome, `${agent}/${ref} ${e.label}: outcome ${outcome}`);
        const bar = li.querySelector('.is-agent .lc-track i').style.width;
        // Bars run from 0 to 100 on the score scale (the browser normalizes 88.50% to 88.5%).
        check(bar.endsWith('%') && Math.abs(parseFloat(bar) - (e.av ?? 0)) < 1e-9, `${agent}/${ref} ${e.label}: agent bar width ${bar}`);
      });
      const rels = exp.filter(e => e.rel !== null).map(e => e.rel);
      const mean = rels.reduce((s, v) => s + v, 0) / rels.length;
      check(text(root, '[data-lc-stat="mean"]') === `${sign(mean, 1)}%`, `${agent}/${ref}: mean ${text(root, '[data-lc-stat="mean"]')} vs ${sign(mean, 1)}%`);
      check(text(root, '[data-lc-stat="median"]') === `${sign(med(rels), 1)}%`, `${agent}/${ref}: median`);
      check(text(root, '[data-lc-stat="higher"]') === `${exp.filter(e => e.diff !== null && e.diff > 0).length} of ${rels.length}`, `${agent}/${ref}: win count`);
      const summary = text(root, '[data-lc-status]');
      const costs = exp.filter(e => e.rel !== null && e.ac !== null && e.rc !== null);
      if (costs.length) {
        const cheaper = costs.filter(e => e.ac < e.rc).length;
        check(summary.includes(`cheaper on ${cheaper} of ${costs.length} benchmarks`), `${agent}/${ref}: cost comparison`);
      } else {
        check(ref === 'published' && summary.includes('Table 5 lists no cost for best published results'), `${agent}/${ref}: no cost for best published`);
      }
      check(summary.includes('matching the abstract') === (agent === 'best' && ref === 'published'), `${agent}/${ref}: only the default claims the abstract’s figure`);
    }
  }

  /* ---------------- Outcomes a reader can discover ---------------- */
  click('lc-agent', 'codex'); click('lc-ref', 'published');
  check(text(root, '[data-lc-stat="mean"]') === '+13.9%' && text(root, '[data-lc-status]').includes('lower on LongBench'), 'Codex alone vs best published: +13.9%, lower on LongBench');
  click('lc-ref', 'strongest');
  const nq = root.querySelector('[data-lc-bench="nq"]');
  check(text(nq, '[data-lc-diff]') === '+0.67 pp' && text(nq, '[data-lc-ref-row]') === 'RLM', 'NQ: Codex leads the strongest re-run baseline (RLM) by only 0.67 pp');
  check(text(root, '[data-lc-status]').includes('ReAct Agent on BrowseComp-Plus; RLM on Oolong-Syn, Oolong-Real and NQ; GPT-5 Full Context on LongBench'), 'Strongest re-run baseline is named per benchmark');
  click('lc-agent', 'codex-bm25'); click('lc-ref', 'published');
  check(root.querySelector('[data-lc-bench="browsecomp"]').dataset.outcome === 'lower' && text(root, '[data-lc-stat="higher"]') === '3 of 5', 'With BM25, Codex falls below best published on BrowseComp-Plus');
  click('lc-agent', 'claude-bm25'); click('lc-ref', 'rlm');
  check(text(root, '[data-lc-stat="higher"]') === '2 of 2' && text(root, '[data-lc-status]').includes('No comparison on BrowseComp-Plus, Oolong-Syn and NQ'), 'Claude Code was run on two benchmarks only');
  click('lc-agent', 'codex'); click('lc-ref', 'rag');
  check(text(root, '[data-lc-status]').includes('cheaper on 0 of 5 benchmarks; its cost is 4.31–18.50× the reference’s'), 'Codex costs 4.3–18.5× RAG per query');

  // Back to the default: the browser reproduces the server-rendered state exactly.
  click('lc-agent', 'best'); click('lc-ref', 'published');
  check(text(root, '[data-lc-status]') === serverSummary, 'Browser summary equals the server-rendered summary');
  check(root.querySelector('[data-lc-rows]').textContent === serverRows, 'Browser rows equal the server-rendered rows');

  /* ---------------- Motion ---------------- */
  const reduce = frame.contentWindow.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bar = root.querySelector('.lc-track i');
  const duration = frame.contentWindow.getComputedStyle(bar).transitionDuration;
  check(reduce ? duration === '0s' : parseFloat(duration) > 0 && parseFloat(duration) <= 0.6, `Bar transition ${duration} (${reduce ? 'reduced motion' : 'standard'})`);
  check([...root.querySelectorAll('*')].every(el => frame.contentWindow.getComputedStyle(el).animationName === 'none'), 'No animations on load');

  /* ---------------- Layout and visual constraints ---------------- */
  for (const width of [1440, 390, 320]) {
    frame.style.width = `${width}px`;
    doc = await load(SLUG);
    root = doc.querySelector('[data-paper-demo="longcontext-headline"]');
    check(doc.documentElement.scrollWidth <= width + 1, `${width}: no page overflow`);
    check(root.scrollWidth <= root.clientWidth + 1, `${width}: demo fits its frame`);
    // Cell labels are visually hidden (clipped on purpose) where the column header shows.
    const srOnly = el => frame.contentWindow.getComputedStyle(el).position === 'absolute';
    const clipped = [...root.querySelectorAll('span, dt, dd, p, button')].filter(el => visible(el) && !srOnly(el) && el.scrollWidth > el.clientWidth + 2);
    check(clipped.length === 0, `${width}: no clipped text (${clipped.map(el => el.className || el.tagName).join(', ')})`);
    const rowsBox = root.querySelector('[data-lc-rows]').getBoundingClientRect();
    check([...root.querySelectorAll('.lc-row > *')].every(el => { const b = el.getBoundingClientRect(); return b.left >= rowsBox.left - 1 && b.right <= rowsBox.right + 1; }), `${width}: row cells stay inside the list`);
    check(visible(root.querySelector('.lc-head')) === (width > 760), `${width}: column header only on wide screens`);
    check(srOnly(root.querySelector('.lc-cell-label')) === (width > 760), `${width}: cell labels visually hidden only on wide screens`);
    if (width === 1440) {
      const styles = [...root.querySelectorAll('*'), root].map(el => frame.contentWindow.getComputedStyle(el));
      check(styles.every(s => s.borderRadius === '0px' || s.borderRadius === ''), 'Sharp corners');
      check(styles.every(s => s.boxShadow === 'none' && s.backgroundImage === 'none'), 'No shadows or gradients');
    }
  }
  frame.style.width = '390px';

  /* ---------------- Script-free fallback ---------------- */
  for (const width of [390, 320]) {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/${SLUG}.html`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(s => s.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    frame.removeAttribute('src');
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    root = doc.querySelector('[data-paper-demo="longcontext-headline"]');
    check(![...root.querySelectorAll('[data-demo-action]')].some(visible), `no-JS ${width}: controls hidden`);
    check(doc.documentElement.scrollWidth <= width + 1, `no-JS ${width}: no page overflow`);
    const state = [...root.querySelectorAll('[data-demo-state]')].filter(visible).map(el => el.textContent.trim()).join(' ');
    check(state.length > 20, `no-JS ${width}: demo state readable`);
    check(text(root, '[data-lc-stat="mean"]') === '+17.3%' && root.querySelectorAll('[data-lc-rows] > li').length === 5, `no-JS ${width}: default comparison computed on the server`);
    check(text(root.querySelector('[data-lc-bench="oolong-real"]'), '[data-lc-rel]') === '+55.5%', `no-JS ${width}: Oolong-Real term`);
  }
  await Promise.race([new Promise(resolve => { frame.onload = resolve; frame.removeAttribute('srcdoc'); }), new Promise(resolve => setTimeout(resolve, 3000))]);
  frame.remove();
  return { assertions, failures };
})();
