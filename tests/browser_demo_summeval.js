/* ChatGPT versus automatic metrics (chatgpt-summarization-evaluation, arXiv 2304.02554).
 * Run against the local preview: agent-browser eval --stdin < tests/browser_demo_summeval.js
 * Expected values are typed in here from Tables 1–5 of the paper, and every computed number
 * (ranks, margins, counts) is recomputed independently of papers/demos/summeval.js.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const slug = 'chatgpt-summarization-evaluation';
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:1200px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async () => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html?t=${Date.now()}`; });
    return frame.contentDocument;
  };
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const u = s => Math.round(Number(String(s).replace('−', '-')) * 10000);
  const noOverflow = (doc, width) => doc.documentElement.scrollWidth <= width + 1;

  let doc = await load();
  let root = doc.querySelector(`[data-paper-demo="${slug}"]`);
  const act = action => { const el = root.querySelector(`[data-demo-action="${action}"]`); if (!el) throw new Error(`missing ${action}`); el.click(); };
  const pressed = action => root.querySelector(`[data-demo-action="${action}"]`).getAttribute('aria-pressed') === 'true';
  const verdict = () => text(root.querySelector('[data-se-verdict]'));
  const bar = name => text(root.querySelector(`.se-bars [data-value="${name}"]`));
  const shownRows = () => [...root.querySelectorAll('.se-bars .se-bar-row')].map(li => [li.dataset.row, text(li.querySelector('.se-bar-value'))]);

  check(root.dataset.demoReady === 'true' && !root.querySelector('[data-demo-controls]').hidden, 'Controls initialize');
  check(Boolean(root.closest('#findings .section-demo.evidence-demo')), 'Explorer sits in Reading the evidence');
  check(text(root.querySelector('.se-kicker')) === 'Measured · Tables 1–5', 'Eyebrow names the measured source');
  check(Boolean(doc.querySelector('.lead-visual .primary-figure img[src="assets/chatgpt-summarization-evaluation-prompts.png"]')), 'Lead visual is the paper\'s prompt figure');

  // Printed values, typed in from the paper (dataset, dimension index, level index, {row: value}, table).
  const printed = [
    ['summeval', 0, 0, { ChatGPT: '0.435', BARTScore_cnn_s_h: '0.367', 'ROUGE-1': '0.153', BARTScore_r_h: '−0.075' }, 'Table 1'],
    ['summeval', 0, 1, { ChatGPT: '0.833', BARTScore_s_h: '0.800', BERTScore: '−0.077', BARTScore_r_h: '−0.556' }, 'Table 1'],
    ['summeval', 2, 1, { ChatGPT: '0.889', BARTScore_cnn_s_h: '0.746', 'ROUGE-1': '0.730' }, 'Table 1'],
    ['summeval', 3, 2, { ChatGPT: '0.557', BARTScore_cnn_s_h: '0.408', BARTScore_r_h: '−0.010' }, 'Table 1'],
    ['newsroom', 0, 0, { ChatGPT: '0.484', BARTScore_s_h: '0.679', BARTScore_cnn_s_h: '0.653', BARTScore_r_h: '−0.311' }, 'Table 2'],
    ['newsroom', 1, 1, { ChatGPT: '0.607', BARTScore_s_h: '0.964', BARTScore_cnn_s_h: '0.893', 'ROUGE-1': '0.429' }, 'Table 2'],
    ['newsroom', 3, 2, { ChatGPT: '0.521', BARTScore_s_h: '0.588', BARTScore_h_r: '0.386' }, 'Table 2'],
    ['tldr', null, null, { ChatGPT: '0.6178', BARTScore_h_r: '0.6151', 'ROUGE-2_f': '0.4997', BARTScore: '0.5674' }, 'Table 3'],
    ['realsumm', null, null, { ChatGPT: '0.6436', DAE: '0.6304', FactCC: '0.5362' }, 'Table 4'],
    ['qags-cnn', null, null, { ChatGPT: '0.8488', DAE: '0.8459', FactCC: '0.7731' }, 'Table 5'],
    ['qags-xsum', null, null, { ChatGPT: '0.7573', DAE: '0.6360', FactCC: '0.4937' }, 'Table 5'],
  ];
  const open = (dataset, dim, level) => {
    act(`dataset:${dataset}`);
    if (dim !== null) { act(`dim:${dim}`); act(`level:${level}`); }
  };
  const fmt = (diff, acc) => `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${acc ? `${(Math.abs(diff) / 100).toFixed(2)} pp` : (Math.abs(diff) / 10000).toFixed(3)}`;
  for (const [dataset, dim, level, values, table] of printed) {
    open(dataset, dim, level);
    const label = `${dataset}/${dim}/${level}`;
    check(Object.entries(values).every(([name, value]) => bar(name) === value), `${label}: printed values ${JSON.stringify(Object.fromEntries(Object.keys(values).map(k => [k, bar(k)])))}`);
    check(text(root).includes(`Measured · ${table}`), `${label}: names ${table}`);
    const rows = shownRows();
    const nums = rows.map(([, v]) => u(v));
    check(nums.every((v, i) => i === 0 || nums[i - 1] >= v), `${label}: bars sorted highest first`);
    check(rows.length === (['realsumm', 'qags-cnn', 'qags-xsum'].includes(dataset) ? 3 : 12), `${label}: every printed row shown`);
    // Independent rank and margin.
    const chat = u(bar('ChatGPT'));
    const others = rows.filter(([n]) => n !== 'ChatGPT');
    const best = Math.max(...others.map(([, v]) => u(v)));
    const rank = 1 + others.filter(([, v]) => u(v) > chat).length;
    check(verdict().includes(`ranks ${rank} of ${rows.length}`), `${label}: verdict rank ${rank}`);
    const acc = dataset !== 'summeval' && dataset !== 'newsroom';
    const cell = root.querySelector('.se-cell[aria-pressed="true"]');
    check(cell && text(cell.querySelector('strong')) === fmt(chat - best, acc), `${label}: current grid cell shows ${fmt(chat - best, acc)}`);
    check(root.querySelector('.se-bar-row.is-chatgpt').dataset.row === 'ChatGPT', `${label}: ChatGPT row marked`);
  }
  // Specific readings the page relies on.
  open('summeval', 0, 1);
  check(verdict().includes('ChatGPT 0.833 ranks 1 of 12') && verdict().includes('BARTScore_s_h at 0.800') && verdict().includes('leads by 0.033'), 'SummEval system consistency: narrowest SummEval lead');
  check(text(root.querySelector('[data-se-caution]')).includes('faithfulness'), 'SummEval consistency: faithfulness caution');
  open('newsroom', 0, 1);
  check(verdict().includes('ranks 3 of 12') && verdict().includes('BARTScore_s_h 0.964, BARTScore_cnn_s_h 0.893') && verdict().includes('0.143 below the top row'), 'Newsroom system coherence: third, behind two BARTScore variants');
  check(text(root.querySelector('[data-se-ties]')) === 'Ties as printed: 5 rows print 0.429.', 'Newsroom system coherence: ties as printed');
  open('newsroom', 3, 1);
  check(text(root.querySelector('[data-se-ties]')) === 'Ties as printed: 6 rows print 0.357.', 'Newsroom system relevance: six rows tie');
  open('newsroom', 3, 0);
  check(!root.querySelector('[data-se-ties]'), 'Newsroom sample level: no tie note');
  open('tldr', null, null);
  check(verdict().includes('leads by 0.27 pp') && text(root.querySelector('[data-se-caution]')).includes('BERTScore'), 'TLDR: +0.27 pp and the BARTScore/BERTScore caution');
  check(text(root).includes('range from 0.4997 to 0.6178') && text(root).includes('Derived'), 'TLDR: derived chance level and printed range');
  open('realsumm', null, null);
  check(verdict().includes('leads by 1.32 pp') && text(root.querySelector('[data-se-caution]')).includes('SCU presence'), 'REALSumm: +1.32 pp and its caution');
  open('qags-xsum', null, null);
  check(verdict().includes('DAE at 0.6360') && verdict().includes('leads by 12.13 pp'), 'QAGS_XSUM: the one large accuracy lead');
  // Accuracy datasets have one column: dimension and level controls disappear and return.
  check(root.querySelector('[data-se-dims]').hidden && root.querySelector('[data-se-levels]').hidden, 'Accuracy dataset hides dimension and level controls');
  act('dataset:newsroom');
  check(!root.querySelector('[data-se-dims]').hidden && text(root.querySelector('[data-se-dims]')).includes('Informativeness') && pressed('dim:0') && pressed('level:0'), 'Newsroom restores its own dimensions');
  act('dim:2'); act('level:1');
  act('dataset:summeval');
  check(pressed('dim:2') && pressed('level:1') && text(root.querySelector('[data-se-title]')).startsWith('SummEval · Fluency · system level'), 'Switching Likert datasets keeps dimension index and level');

  // Every grid cell equals ChatGPT minus the strongest other row of its own column.
  const ids = [...root.querySelectorAll('.se-board .se-cell')].map(el => el.dataset.seCol);
  check(ids.length === 28, `Grid has 28 columns (${ids.length})`);
  let consistent = true;
  let behind = 0;
  const behindDatasets = new Set();
  for (const id of ids) {
    root.querySelector(`.se-board .se-cell[data-se-col="${id}"]`).click();
    const cell = root.querySelector(`.se-board .se-cell[data-se-col="${id}"]`);
    const rows = shownRows();
    const chat = u(bar('ChatGPT'));
    const best = Math.max(...rows.filter(([n]) => n !== 'ChatGPT').map(([, v]) => u(v)));
    const acc = !id.startsWith('summeval') && !id.startsWith('newsroom');
    const diff = chat - best;
    if (text(cell.querySelector('strong')) !== fmt(diff, acc) || cell.classList.contains('is-behind') !== diff < 0 || cell.getAttribute('aria-pressed') !== 'true' || doc.activeElement !== cell) consistent = false;
    if (diff < 0) { behind++; behindDatasets.add(id.split(':')[0]); }
  }
  check(consistent, 'Every grid cell equals ChatGPT minus the strongest other row, opens its column, and keeps focus');
  check(behind === 12 && behindDatasets.size === 1 && behindDatasets.has('newsroom'), `ChatGPT trails in 12 columns, all on Newsroom (got ${behind}, ${[...behindDatasets]})`);
  check(verdict().includes('ahead of the strongest other row in 16 and behind it in 12, all of them on Newsroom'), 'Verdict counts 16 leads and 12 trails');
  check(text(root.querySelector('.se-board')).includes('12 of 28'), 'Grid caption counts warm cells');
  check(root.querySelector('[data-se-verdict]').getAttribute('role') === 'status' && root.querySelector('[data-se-verdict]').getAttribute('aria-live') === 'polite', 'Live verdict');
  check([...root.querySelectorAll('[data-demo-action], .se-cell')].every(b => b.tagName === 'BUTTON' && b.type === 'button'), 'Controls are keyboard-operable buttons');
  check(!text(root).includes('NaN') && !text(root).includes('undefined'), 'No invalid values');
  // No motion anywhere in the explorer (it has no replay), with or without reduced motion.
  check(![...root.querySelectorAll('*')].some(el => { const cs = doc.defaultView.getComputedStyle(el); return parseFloat(cs.transitionDuration) > 0 || cs.animationName !== 'none'; }), 'No transitions or animations');

  // Script-free state: complete and readable, controls hidden, and identical to the enhanced first state.
  const staticDoc = async width => {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/${slug}.html`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script:not([type="application/json"])').forEach(s => s.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    return frame.contentDocument;
  };
  let staticText = '';
  for (const width of [390, 320]) {
    doc = await staticDoc(width);
    const demo = doc.querySelector('[data-paper-demo]');
    const state = demo.querySelector('[data-demo-state]');
    for (const needle of ['0.435', '0.367', 'BARTScore_cnn_s_h', '+0.068', '−0.195', '+12.13 pp', 'ranks 1 of 12', '16 and behind it in 12', 'Measured · Table 1', 'Computed']) {
      check(text(state).includes(needle), `No-JS state at ${width} contains ${needle}`);
    }
    check(demo.querySelector('[data-demo-controls]').hidden && ![...demo.querySelectorAll('button,input,select')].some(el => el.getClientRects().length > 0), `No-JS controls hidden at ${width}`);
    check(noOverflow(doc, width), `No-JS layout fits ${width}px`);
    staticText = text(demo.querySelector('[data-se-results]')) + ' ' + text(demo.querySelector('[data-se-verdict]'));
  }
  frame.removeAttribute('srcdoc');
  frame.style.width = '1200px';
  doc = await load();
  root = doc.querySelector(`[data-paper-demo="${slug}"]`);
  check(text(root.querySelector('[data-se-results]')) + ' ' + verdict() === staticText, 'Browser initial state matches the Python-rendered state');

  // Narrow enhanced layout: nothing overflows or clips at 320px, with square, flat styling.
  for (const width of [390, 320]) {
    frame.style.width = `${width}px`;
    doc = await load();
    root = doc.querySelector(`[data-paper-demo="${slug}"]`);
    for (const view of [['summeval', 0, 1], ['tldr', null, null], ['newsroom', 2, 2]]) {
      open(...view);
      check(noOverflow(doc, width), `Enhanced layout fits ${width}px (${view[0]})`);
      const clipped = [...root.querySelectorAll('h3,h4,p,th,td,li')].filter(el => el.scrollWidth > el.clientWidth + 2);
      check(!clipped.length, `No clipped text at ${width}px (${view[0]}: ${clipped.map(el => el.className || el.tagName).slice(0, 3)})`);
    }
    const tooSmall = [...root.querySelectorAll('[data-demo-action], .se-cell')].filter(el => el.getBoundingClientRect().height < 32);
    check(!tooSmall.length, `Touch targets at least 32px tall at ${width}px`);
  }
  check(![...root.querySelectorAll('*')].some(el => { const cs = doc.defaultView.getComputedStyle(el); return parseFloat(cs.borderTopLeftRadius) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage.includes('gradient'); }), 'Square, flat styling');
  check(doc.defaultView.getComputedStyle(root.querySelector('h3')).fontFamily.includes('Georgia'), 'Georgia demo heading');
  const reduced = frame.contentWindow.matchMedia('(prefers-reduced-motion: reduce)').matches;
  frame.remove();
  return { assertions, reducedMotion: reduced, failures };
})();
