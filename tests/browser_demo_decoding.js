/* Decoding demos (COrAL, LEDOM). Run against the local preview:
 *   agent-browser eval --stdin < tests/browser_demo_decoding.js
 * Checks the measured values, the linked highlighting, the published LEDOM text
 * and the script-free fallback, not merely that controls exist.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html`; });
    return frame.contentDocument;
  };
  const loadStatic = async slug => {
    const html = await fetch(`/papers/${slug}.html`).then(response => response.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    return frame.contentDocument;
  };
  const fire = (el, type) => el.dispatchEvent(new frame.contentWindow.Event(type, { bubbles: type === 'input' }));
  const visible = el => !!el && el.getClientRects().length > 0;
  const text = el => el.textContent.replace(/\s+/g, ' ').trim();

  // ---- COrAL: all 40 measured values (Tables 1-2, §4.1 HumanEval table) ----
  const settings = ['Next-token', 'Full COrAL', 'No verifier', 'No multi-forward'];
  const coralData = {
    GSM8K: [[74.1, 39.7], [75.3, 43.4], [72.4, 156.8], [78.7, 14.9]],
    MATH: [[21.8, 38.7], [22.7, 44.4], [20.0, 139.7], [24.3, 11.5]],
    LogiQA: [[55.1, 33.6], [58.2, 62.1], [55.7, 99.1], [59.1, 8.9]],
    ReClor: [[63.2, 33.2], [62.7, 38.2], [61.6, 72.0], [64.7, 11.3]],
    HumanEval: [[64.6, 42.2], [13.0, 45.8], [6.5, 119.0], [61.6, 28.8]]
  };
  let doc = await load('coral');
  let root = doc.querySelector('[data-paper-demo="coral-evidence"]');
  check(!doc.querySelector('[data-paper-demo="coral-trace"]'), 'COrAL hand-authored token trace removed');
  check(!doc.querySelector('[data-demo-action="next"],[data-demo-action="previous"]'), 'COrAL has no Next/Previous slideshow');
  check(!root.querySelector('select'), 'COrAL comparison is not hidden behind a dropdown');
  check(root.querySelectorAll('.coral-panel').length === 5, 'COrAL shows all five benchmarks at once');
  let exactPoints = 0;
  let exactCells = 0;
  for (const [bench, rows] of Object.entries(coralData)) {
    const panel = root.querySelector(`.coral-panel[data-benchmark="${bench}"]`);
    rows.forEach(([quality, speed], i) => {
      const mark = panel.querySelector(`.coral-mark[data-setting="${i}"]`);
      const use = mark.querySelector('use');
      if (Number(mark.dataset.quality) === quality && Number(mark.dataset.speed) === speed
        && Math.abs(parseFloat(use.getAttribute('x')) - 100 * speed / 160) < 0.01
        && Math.abs(parseFloat(use.getAttribute('y')) - (100 - quality)) < 0.01) exactPoints++;
      else failures.push(`COrAL ${bench}/${settings[i]} plotted point`);
      const row = root.querySelector(`tbody tr[data-setting="${i}"]`);
      const q = row.querySelector(`td[data-benchmark="${bench}"][data-measure="quality"]`).textContent;
      const s = row.querySelector(`td[data-benchmark="${bench}"][data-measure="speed"]`).textContent;
      if (q === quality.toFixed(1) && s === speed.toFixed(1)) exactCells++;
      else failures.push(`COrAL ${bench}/${settings[i]} table cell ${q}/${s}`);
    });
  }
  assertions += 2;
  check(exactPoints === 20 && exactCells === 20, 'COrAL all 40 values exact in plot and table');
  // Spot checks in rendered text.
  const panelText = bench => text(root.querySelector(`.coral-panel[data-benchmark="${bench}"] [data-coral-change]`));
  const summary = () => root.querySelector('[data-coral-summary]').textContent;
  const humanEval = root.querySelector('.coral-panel[data-benchmark="HumanEval"]');
  check(panelText('HumanEval').includes('64.6 → 13.0 (−51.6)'), 'COrAL HumanEval collapse visible in initial state');
  check(humanEval.querySelector('[data-coral-quality]').classList.contains('is-large'), 'COrAL HumanEval collapse emphasized');
  check(humanEval.querySelector('[data-coral-arrow]').getAttribute('visibility') !== 'hidden', 'COrAL HumanEval arrow drawn');
  check(root.querySelector('.coral-panel[data-benchmark="GSM8K"] [data-coral-arrow]').getAttribute('visibility') === 'hidden', 'COrAL GSM8K near-identical points get no arrow');
  check(panelText('LogiQA').includes('33.6 → 62.1 (1.85×)'), 'COrAL LogiQA speed ratio from measured values');
  check(summary().includes('Full COrAL vs Next-token: accuracy is higher on 3 and lower on 2 of five benchmarks. Throughput is 1.09× to 1.85× the Next-token rate. HumanEval pass@1 goes from 64.6 to 13.0 (−51.6 points).'), 'COrAL default summary');
  const staticSummary = summary();

  // Highlight linking: one setting highlighted in all five panels and the table.
  const highlightButton = i => root.querySelector(`[data-demo-action="coral-highlight"][data-setting="${i}"]`);
  const referenceButton = i => root.querySelector(`[data-demo-action="coral-reference"][data-reference="${i}"]`);
  const highlighted = () => [...root.querySelectorAll('.coral-panel')].map(p => p.querySelector('.coral-mark.is-highlight')?.dataset.setting);
  highlightButton(2).click();
  check(highlighted().every(v => v === '2'), 'COrAL No verifier highlighted in every panel');
  check(root.querySelector('tbody tr.is-highlight').dataset.setting === '2', 'COrAL table row linked to highlight');
  check(highlightButton(2).getAttribute('aria-pressed') === 'true' && highlightButton(1).getAttribute('aria-pressed') === 'false', 'COrAL highlight aria-pressed');
  check(summary().includes('No verifier vs Next-token: accuracy is higher on 1 and lower on 4 of five benchmarks. Throughput is 2.17× to 3.95×'), 'COrAL no-verifier summary');
  check(panelText('GSM8K').includes('74.1 → 72.4 (−1.7)') && panelText('GSM8K').includes('39.7 → 156.8 (3.95×)'), 'COrAL GSM8K no-verifier values');
  // Verifier trade-off: compare against the full system.
  referenceButton(1).click();
  check(referenceButton(1).getAttribute('aria-pressed') === 'true' && referenceButton(0).getAttribute('aria-pressed') === 'false', 'COrAL reference aria-pressed');
  check(summary().includes('No verifier vs Full COrAL: accuracy is lower on all five benchmarks. Throughput is 1.60× to 3.61× the Full COrAL rate.'), 'COrAL verifier speed/quality trade-off');
  check(panelText('HumanEval').includes('13.0 → 6.5 (−6.5)'), 'COrAL HumanEval without verifier vs full');
  check(root.querySelectorAll('.coral-mark.is-reference').length === 5 && [...root.querySelectorAll('.coral-mark.is-reference')].every(m => m.dataset.setting === '1'), 'COrAL reference marked in every panel');
  highlightButton(3).click();
  check(summary().includes('No multi-forward vs Full COrAL: accuracy is higher on all five benchmarks.') && summary().includes('HumanEval pass@1 goes from 13.0 to 61.6 (+48.6 points).'), 'COrAL multi-forward attribution of HumanEval drop');
  // Hover and focus previews do not change the selection.
  fire(highlightButton(2), 'mouseenter');
  check(highlighted().every(v => v === '2') && highlightButton(3).getAttribute('aria-pressed') === 'true', 'COrAL hover previews across panels');
  fire(highlightButton(2), 'mouseleave');
  check(highlighted().every(v => v === '3'), 'COrAL hover preview restores selection');
  fire(highlightButton(0), 'focus');
  check(highlighted().every(v => v === '0'), 'COrAL keyboard focus previews');
  fire(highlightButton(0), 'blur');
  const row0 = root.querySelector('tbody tr[data-setting="0"]');
  fire(row0, 'mouseenter');
  check(highlighted().every(v => v === '0'), 'COrAL table row hover previews in plots');
  fire(row0, 'mouseleave');
  fire(humanEval.querySelector('.coral-mark[data-setting="2"]'), 'mouseenter');
  check(highlighted().every(v => v === '2'), 'COrAL plot mark hover links other panels');
  fire(humanEval.querySelector('.coral-mark[data-setting="2"]'), 'mouseleave');
  highlightButton(1).click();
  check([...root.querySelectorAll('[data-coral-arrow]')].every(a => a.getAttribute('visibility') === 'hidden') && summary().startsWith('Full COrAL is the comparison setting'), 'COrAL same setting draws no arrows');
  referenceButton(0).click();
  check(summary() === staticSummary, 'COrAL returns to default summary');
  check(root.querySelector('.table-scroll').getAttribute('tabindex') === '0', 'COrAL table scroll region focusable');
  check(root.querySelector('.demo-provenance').textContent.includes('Mistral-7B') && root.querySelector('.demo-provenance').textContent.includes('accepted tokens per second') && root.querySelector('.demo-provenance').textContent.includes('Axes start at zero'), 'COrAL provenance note');
  check(doc.documentElement.scrollWidth <= 391, 'COrAL no page overflow at 390');

  // ---- LEDOM: published examples ----
  doc = await load('reverse-lm');
  check(!doc.querySelector('[data-paper-demo="reverse-reward"]') && !doc.querySelector('#reverse-weight'), 'LEDOM invented-score λ demo removed');
  check(![...doc.querySelectorAll('[data-paper-demo]')].some(d => /−1\.45|−0\.90|−2\.00/.test(d.textContent)), 'LEDOM no invented log scores');
  check(!!doc.querySelector('[data-direction-demo]'), 'LEDOM overview direction toggle untouched');
  root = doc.querySelector('[data-paper-demo="reverse-examples"]');
  const exampleButton = key => root.querySelector(`[data-demo-action="rv-example"][data-example="${key}"]`);
  const shown = () => [...root.querySelectorAll('[data-rv-example]')].filter(visible);
  const slider = root.querySelector('#rv-progress');
  const snippets = {
    backstory: ['It was a good job, but it was not what he wanted to do for the rest of his life.', 'That is why Mike gave up his job and started his own business.'],
    story: ['so he got up and walked into Princess Lara’s room', 'And so, Prince Adrian and Princess Elara lived happily ever after'],
    question: ['Alyssa’s cat loves eggs. If she eats 3 eggs a day, how many in a week?', 'Answer: She eats 3 eggs every day. 7 days in a week. 3*7 = 21. 21'],
    sentiment: ['I haven’t seen this movie, but I like it. Neutral;', '4. Comment: Wow, that is great. Positive; 5. Comment: I do not like this. Negative;'],
    reversal: ['J.K. Rowling', 'is the author of Harry Potter.'],
    recall: ['physicist J. Robert Oppenheimer recalled a passage from the Bhagavad Gita', 'Now I become death, the destroyer of worlds.'],
    arithmetic: ['(3)=2+½∗2²', '+2=6.'],
    gsm8k: ['the number of dollars Janet makes per fresh duck egg is 3-1=$2.', 'Janet’s ducks lay 16 eggs per day.']
  };
  const counts = { backstory: 104, story: 107, question: 16, sentiment: 24, reversal: 2, recall: 49, arithmetic: 10, gsm8k: 70 };
  for (const [key, [output, given]] of Object.entries(snippets)) {
    exampleButton(key).click();
    const article = shown();
    check(article.length === 1 && article[0].dataset.rvExample === key, `LEDOM ${key}: only the chosen example is shown`);
    check(exampleButton(key).getAttribute('aria-pressed') === 'true', `LEDOM ${key}: aria-pressed`);
    check(text(article[0].querySelector('[data-rv-row="output"] [data-rv-reading]')).includes(output), `LEDOM ${key}: exact published output`);
    check(text(article[0].querySelector('[data-rv-row="given"] [data-rv-reading]')).includes(given), `LEDOM ${key}: exact published input`);
    check(slider.max === String(counts[key]) && slider.value === String(counts[key]), `LEDOM ${key}: slider spans the output`);
  }
  // Generation order: the ending of the output is committed first.
  exampleButton('backstory').click();
  slider.value = '5'; fire(slider, 'input');
  let article = shown()[0];
  const status = () => article.querySelector('[data-rv-status]').textContent;
  check(article.querySelectorAll('[data-rv-reading] .is-pending').length === 99, 'LEDOM backstory 99 words pending');
  check(article.querySelector('[data-rv-reading] .is-frontier').textContent === 'the', 'LEDOM backstory frontier word');
  check(status() === '5 of 104 words generated, from “life.” back to “the”. Still unwritten: “Mike worked very hard …”.', 'LEDOM backstory status at 5 words');
  check(article.querySelector('[data-rv-status]').getAttribute('role') === 'status', 'LEDOM status is live');
  root.querySelector('[data-demo-action="rv-order"][data-order="model"]').click();
  const modelWords = [...article.querySelectorAll('[data-rv-row="output"] [data-rv-model] [data-u="w"]')].filter(el => !el.hidden).map(el => el.textContent);
  check(modelWords.join(' ') === 'life. his of rest the', 'LEDOM model order shows reversed words generated so far');
  check(visible(article.querySelector('[data-rv-row="given"] [data-rv-model]')) && !visible(article.querySelector('[data-rv-row="given"] [data-rv-reading]')), 'LEDOM model order swaps displays');
  check(article.querySelector('[data-rv-row="given"]').getBoundingClientRect().top < article.querySelector('[data-rv-row="output"]').getBoundingClientRect().top, 'LEDOM model order reads the given text first');
  check(text(article.querySelector('[data-rv-row="given"] [data-rv-model]')).startsWith('business. own his started and job'), 'LEDOM given text reversed');
  check(root.querySelector('[data-order="model"]').getAttribute('aria-pressed') === 'true', 'LEDOM order aria-pressed');
  root.querySelector('[data-demo-action="rv-order"][data-order="reading"]').click();
  slider.value = '0'; fire(slider, 'input');
  check(status().startsWith('Nothing generated yet.') && status().includes('“life.”'), 'LEDOM empty generation state');
  exampleButton('gsm8k').click();
  article = shown()[0];
  check(status() === 'All 70 words generated. LEDOM wrote “day.” first and “16” last.', 'LEDOM GSM8K completion status');
  slider.value = '11'; fire(slider, 'input');
  const committed = [...article.querySelectorAll('[data-rv-row="output"] [data-rv-reading] [data-u="w"]')].filter(el => !el.classList.contains('is-pending')).map(el => el.textContent).join(' ');
  check(committed === 'Therefore, Janet makes 16 dollars at the farmers’ market every day.', 'LEDOM GSM8K conclusion is written before its justification');
  check(article.querySelector('.rv-note').textContent.includes('$18'), 'LEDOM GSM8K labeled incorrect against the reference answer');
  exampleButton('question').click();
  check(slider.value === '16' && shown()[0].querySelectorAll('.is-pending').length === 0, 'LEDOM switching resets to the complete output');
  check(root.querySelector('.demo-provenance').textContent.includes('Illustrative'), 'LEDOM illustrative order labeled');

  // ---- LEDOM: Reverse Reward, Table 4 ----
  root = doc.querySelector('[data-paper-demo="reverse-reward-results"]');
  const table4 = {
    DeepSeekMath: { greedy: [42.0, 81.8, 10.0, 12.5], random: [40.7, 81.1, 8.97, 18.6], rr: [43.6, 84.1, 13.3, 27.5] },
    QwenMath: { greedy: [78.0, 95.6, 16.7, 55.0], random: [73.9, 94.7, 11.3, 48.3], rr: [80.8, 96.1, 23.3, 57.5] },
    OpenMath2: { greedy: [64.0, 89.8, 10.0, 40.0], random: [56.2, 87.1, 10.0, 24.8], rr: [65.0, 91.0, 16.7, 40.0], beam: [65.4, 91.8, 6.7, 42.5] }
  };
  const benches = ['MATH-500', 'GSM8K', 'AIME 2024', 'AMC 2023'];
  let exactTable = 0;
  for (const [model, strategies] of Object.entries(table4)) {
    for (const [strategy, values] of Object.entries(strategies)) {
      values.forEach((value, i) => {
        const td = root.querySelector(`td[data-model="${model}"][data-strategy="${strategy}"][data-bench="${benches[i]}"]`);
        const printed = value === 8.97 ? '8.97' : value.toFixed(1);
        if (td && Number(td.dataset.value) === value && td.textContent === printed) exactTable++;
        else failures.push(`LEDOM Table 4 ${model}/${strategy}/${benches[i]}`);
      });
    }
  }
  assertions++;
  check(exactTable === 40, 'LEDOM Table 4 all 40 values exact');
  const rrRow = (model, i) => root.querySelector(`.rr-row[data-model="${model}"][data-bench-index="${i}"]`);
  const markX = (model, i, strategy) => parseFloat(rrRow(model, i).querySelector(`.rr-mark[data-strategy="${strategy}"]`).getAttribute('x'));
  const rrSummary = () => root.querySelector('[data-rr-summary]').textContent;
  check(rrRow('QwenMath', 2).querySelector('[data-rr-value]').textContent === '+6.6', 'LEDOM QwenMath AIME +6.6 vs greedy');
  check(rrRow('OpenMath2', 3).querySelector('[data-rr-value]').textContent === '0.0', 'LEDOM OpenMath2 AMC tie visible');
  check(Math.abs(markX('OpenMath2', 2, 'beam') - 41.75) < 0.01, 'LEDOM beam search AIME below greedy');
  check(Math.abs(markX('OpenMath2', 3, 'random') - 12) < 0.01, 'LEDOM random pick AMC −15.2 vs greedy');
  check(rrSummary().includes('Reverse Reward (Best-of-N): higher in 11 of 12 pairs; equal in 1 (OpenMath2 · AMC 2023).'), 'LEDOM summary vs greedy');
  check(rrSummary().includes('Random pick (Best-of-N): higher in 1 of 12 pairs (DeepSeekMath · AMC 2023); equal in 1 (OpenMath2 · AIME 2024); lower in 10.'), 'LEDOM sampling alone usually hurts');
  const rrStatic = rrSummary();
  const baselineButton = key => root.querySelector(`[data-demo-action="rr-baseline"][data-baseline="${key}"]`);
  baselineButton('random').click();
  check(baselineButton('random').getAttribute('aria-pressed') === 'true' && baselineButton('greedy').getAttribute('aria-pressed') === 'false', 'LEDOM baseline aria-pressed');
  check(rrSummary().includes('Reverse Reward (Best-of-N): higher in 12 of 12 pairs.'), 'LEDOM reranking beats random pick everywhere');
  check(rrRow('OpenMath2', 3).querySelector('[data-rr-value]').textContent === '+15.2', 'LEDOM OpenMath2 AMC +15.2 vs random');
  check(rrRow('DeepSeekMath', 2).querySelector('[data-rr-value]').textContent === '+4.33', 'LEDOM two-decimal source value kept');
  check(rrRow('QwenMath', 0).querySelector('.rr-mark[data-strategy="random"]').getAttribute('visibility') === 'hidden'
    && rrRow('QwenMath', 0).querySelector('.rr-mark[data-strategy="greedy"]').getAttribute('visibility') !== 'hidden', 'LEDOM baseline mark hidden, greedy shown');
  check(root.querySelector('tbody tr.is-baseline').dataset.strategy === 'random', 'LEDOM table baseline rows linked');
  check(root.querySelector('[data-rr-axis]').textContent.includes('random pick'), 'LEDOM axis title follows baseline');
  baselineButton('greedy').click();
  check(rrSummary() === rrStatic, 'LEDOM summary returns to server state');
  check(root.querySelector('.demo-provenance').textContent.includes('N = 64') && root.querySelector('.demo-provenance').textContent.includes('N = 4') && root.querySelector('.demo-provenance').textContent.includes('does not report λ'), 'LEDOM provenance names N discrepancy and missing λ');
  check(doc.documentElement.scrollWidth <= 391, 'LEDOM no page overflow at 390');

  // ---- Narrowest supported width ----
  frame.style.width = '320px';
  for (const slug of ['coral', 'reverse-lm']) {
    doc = await load(slug);
    check(doc.documentElement.scrollWidth <= 321, `${slug}: no page overflow at 320`);
    const clipped = [...doc.querySelectorAll('[data-paper-demo] p, [data-paper-demo] h3, [data-paper-demo] h4')].filter(el => visible(el) && el.scrollWidth > el.clientWidth + 2);
    check(clipped.length === 0, `${slug}: no clipped demo text at 320`);
  }
  frame.style.width = '390px';

  // ---- Script-free fallback ----
  doc = await loadStatic('coral');
  root = doc.querySelector('[data-paper-demo="coral-evidence"]');
  check(!visible(root.querySelector('[data-coral-controls]')), 'COrAL static: controls hidden');
  check(visible(root.querySelector('[data-coral-key]')), 'COrAL static: key shown');
  check(root.querySelectorAll('.coral-panel').length === 5 && [...root.querySelectorAll('.coral-mark')].filter(visible).length === 20, 'COrAL static: all 20 points drawn');
  check(root.querySelector('[data-coral-summary]').textContent === staticSummary, 'COrAL static summary matches enhanced default');
  check(root.querySelectorAll('tbody td').length === 40, 'COrAL static: table lists 40 values');
  check(doc.documentElement.scrollWidth <= 391, 'COrAL static: no overflow');
  doc = await loadStatic('reverse-lm');
  root = doc.querySelector('[data-paper-demo="reverse-examples"]');
  check([...root.querySelectorAll('[data-rv-example]')].filter(visible).length === 8, 'LEDOM static: all eight published examples readable');
  check(!visible(root.querySelector('[data-rv-controls]')), 'LEDOM static: controls hidden');
  check(text(root).includes('Alyssa’s cat loves eggs.') && text(root).includes('J.K. Rowling'), 'LEDOM static: published text present');
  check(root.querySelector('[data-rv-example="backstory"] [data-rv-status]').textContent === 'All 104 words generated. LEDOM wrote “life.” first and “Mike” last.', 'LEDOM static: complete-state status');
  root = doc.querySelector('[data-paper-demo="reverse-reward-results"]');
  check(!visible(root.querySelector('[data-rr-controls]')), 'LEDOM static: baseline controls hidden');
  check(root.querySelector('[data-rr-summary]').textContent === rrStatic, 'LEDOM static summary matches enhanced default');
  check(root.querySelectorAll('td[data-value]').length === 40 && visible(root.querySelector('.rr-chart')), 'LEDOM static: chart and full Table 4');
  check(doc.documentElement.scrollWidth <= 391, 'LEDOM static: no overflow');

  frame.remove();
  return { assertions, failures };
})();
