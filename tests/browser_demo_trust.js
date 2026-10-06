/* Epistemic Context Learning evidence explorer (papers/epistemic-context-learning.html).
 * Run against the local preview, from any page on its origin:
 *   agent-browser eval --stdin < tests/browser_demo_trust.js
 * The printed values below were transcribed separately from the arXiv v1 LaTeX source
 * (2601.21742: Tables 6, 8, 10, 11 and 14; test sizes from Table 7). Differences, question
 * counts and the Table 11 split are recomputed here with an independent implementation.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async () => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/epistemic-context-learning.html?test=${Date.now()}`; });
    return frame.contentDocument;
  };
  const squash = text => text.replace(/\s+/g, ' ').trim();

  /* ---------------- Independent transcription ---------------- */
  const N = { mmlupro: 90, gpqa: 40 };
  const ORDER = ['qwen4b', 'qwen8b', 'qwen30b', 'deepseek', 'gpt5mini', 'gpt52', 'geminiflash', 'geminipro'];
  // Table 6: SA, then [AG, ECL (I), ECL (E)] for MA-Outcome and for MA-Reasoning.
  const T6 = {
    natural: {
      mmlupro: { qwen4b: [70.0, 67.8, 72.2, 71.1, 78.9, 85.6, 84.4], qwen8b: [71.1, 66.7, 65.6, 77.8, 71.1, 72.2, 76.7], qwen30b: [75.6, 73.3, 77.8, 77.8, 82.2, 82.2, 86.7], deepseek: [80.0, 81.1, 86.7, 84.4, 83.3, 83.3, 83.3], gpt5mini: [80.0, 82.2, 84.4, 85.6, 86.7, 85.6, 86.7], gpt52: [84.4, 85.6, 83.3, 86.7, 85.6, 84.4, 86.7], geminiflash: [85.6, 82.2, 86.7, 85.6, 83.3, 84.4, 85.6], geminipro: [87.8, 87.8, 85.6, 85.6, 85.6, 85.6, 86.7] },
      gpqa: { qwen4b: [55.0, 42.5, 62.5, 70.0, 82.5, 82.5, 77.5], qwen8b: [52.5, 57.5, 55.0, 65.0, 77.5, 75.0, 77.5], qwen30b: [72.5, 65.0, 70.0, 75.0, 82.5, 90.0, 85.0], deepseek: [77.5, 77.5, 75.0, 85.0, 85.0, 82.5, 87.5], gpt5mini: [82.5, 85.0, 80.0, 92.5, 90.0, 87.5, 92.5], gpt52: [87.5, 90.0, 90.0, 95.0, 92.5, 95.0, 92.5], geminiflash: [90.0, 92.5, 90.0, 85.0, 92.5, 90.0, 85.0], geminipro: [90.0, 90.0, 92.5, 85.0, 92.5, 95.0, 95.0] },
    },
    adversarial: {
      mmlupro: { qwen4b: [70.0, 70.0, 85.6, 82.2, 78.9, 90.0, 90.0], qwen8b: [71.1, 71.1, 77.8, 83.3, 71.1, 76.7, 82.2], qwen30b: [75.6, 75.6, 86.7, 83.3, 81.1, 85.6, 92.2], deepseek: [80.0, 83.3, 92.2, 87.8, 80.0, 93.3, 91.1], gpt5mini: [80.0, 84.4, 85.6, 87.8, 84.4, 85.6, 90.0], gpt52: [84.4, 85.6, 88.9, 88.9, 82.2, 87.8, 87.8], geminiflash: [85.6, 84.4, 96.7, 97.8, 87.8, 98.9, 98.9], geminipro: [87.8, 91.1, 97.8, 96.7, 87.8, 97.8, 98.9] },
      gpqa: { qwen4b: [55.0, 47.5, 60.0, 67.5, 62.5, 60.0, 70.0], qwen8b: [52.5, 45.0, 50.0, 50.0, 50.0, 57.5, 52.5], qwen30b: [72.5, 70.0, 72.5, 80.0, 65.0, 75.0, 77.5], deepseek: [77.5, 77.5, 80.0, 82.5, 80.0, 82.5, 85.0], gpt5mini: [82.5, 87.5, 87.5, 85.0, 75.0, 82.5, 85.0], gpt52: [87.5, 92.5, 90.0, 97.5, 87.5, 82.5, 90.0], geminiflash: [90.0, 87.5, 95.0, 97.5, 87.5, 92.5, 95.0], geminipro: [90.0, 90.0, 97.5, 100.0, 90.0, 95.0, 95.0] },
    },
  };
  // Table 10 Flip rows: [ECL (I), ECL (E)] after the flip, MA-Outcome then MA-Reasoning.
  const T10_FLIP = {
    mmlupro: { qwen4b: [62.2, 63.3, 62.2, 65.6], qwen8b: [66.7, 62.2, 62.2, 56.7], deepseek: [52.2, 77.8, 63.3, 66.7], gpt5mini: [81.1, 78.9, 80.0, 83.3], geminiflash: [46.7, 66.7, 52.2, 65.6] },
    gpqa: { qwen4b: [60.0, 47.5, 57.5, 52.5], qwen8b: [45.0, 42.5, 52.5, 47.5], deepseek: [72.5, 62.5, 65.0, 62.5], gpt5mini: [80.0, 75.0, 80.0, 82.5], geminiflash: [50.0, 35.0, 55.0, 65.0] },
  };
  // Table 10 Normal rows, ECL (E): [MA-Outcome, MA-Reasoning]. Qwen 3-4B on GPQA (MA-Outcome) is
  // printed as 62.5% here but 67.5% in Table 6; the demo must show Table 10's value and say so.
  const T10_NORMAL_ECLE = {
    mmlupro: { qwen4b: [82.2, 90.0], qwen8b: [83.3, 82.2], deepseek: [87.8, 91.1], gpt5mini: [87.8, 90.0], geminiflash: [97.8, 98.9] },
    gpqa: { qwen4b: [62.5, 70.0], qwen8b: [50.0, 52.5], deepseek: [82.5, 85.0], gpt5mini: [85.0, 85.0], geminiflash: [97.5, 95.0] },
  };
  // Table 14 All-W column: [AG, ECL (I), ECL (E), ECL (E) + DB], MA-Outcome then MA-Reasoning.
  const T14_ALLW = {
    deepseek: { outcome: [57.5, 70.0, 45.0, 65.0], reasoning: [57.5, 52.5, 45.0, 55.0] },
    gpt5mini: { outcome: [77.5, 75.0, 72.5, 80.0], reasoning: [72.5, 67.5, 72.5, 77.5] },
    geminiflash: { outcome: [72.5, 47.5, 35.0, 55.0], reasoning: [62.5, 47.5, 50.0, 70.0] },
  };
  // Table 8 GPQA recognition rate and Table 11 [accuracy if named, accuracy otherwise]; Table 10 ECL (E) normal.
  const SPLIT = {
    qwen4b: { prr: [52.5, 50.0], outcome: [66.7, 57.9], reasoning: [85.0, 55.0], ecle: [62.5, 70.0] },
    qwen8b: { prr: [40.0, 42.0], outcome: [75.0, 33.3], reasoning: [70.6, 39.1], ecle: [50.0, 52.5] },
    deepseek: { prr: [85.0, 90.0], outcome: [85.3, 66.7], reasoning: [86.1, 75.0], ecle: [82.5, 85.0] },
    gpt5mini: { prr: [90.0, 92.5], outcome: [86.1, 75.0], reasoning: [83.8, 100.0], ecle: [85.0, 85.0] },
    geminiflash: { prr: [92.5, 92.5], outcome: [100.0, 66.7], reasoning: [100.0, 66.7], ecle: [97.5, 95.0] },
  };

  const pct = value => `${value.toFixed(1)}%`;
  const count = (value, n) => Math.round(value * n / 100);
  const ppText = d => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1)} pp`;
  const expectedRows = (bench, setting, context) => {
    const off = context === 'outcome' ? 1 : 4;
    const ci = context === 'outcome' ? 0 : 1;
    return ORDER.filter(m => setting === 'flip' ? m in T10_FLIP[bench] : setting === 'allwrong' ? m in T14_ALLW : true).map(m => {
      const base = T6[setting === 'natural' ? 'natural' : 'adversarial'][bench][m];
      const row = { model: m, sa: base[0], ag: base[off], ecli: base[off + 1], ecle: base[off + 2] };
      if (setting === 'flip') Object.assign(row, { ecli: T10_FLIP[bench][m][ci * 2], ecle: T10_FLIP[bench][m][ci * 2 + 1] });
      if (setting === 'allwrong') { const v = T14_ALLW[m][context]; Object.assign(row, { ag: v[0], ecli: v[1], ecle: v[2] }); }
      return row;
    });
  };

  /* ---------------- Live page ---------------- */
  let doc = await load();
  let root = doc.querySelector('[data-paper-demo="epistemic-context-learning"]');
  check(root && root.dataset.trustReady === 'true', 'Trust demo initializes');
  check(!!root.closest('#findings .evidence-demo'), 'Trust demo sits in the evidence section');
  check(!!doc.querySelector('#findings .findings-grid') && (doc.querySelector('#findings .findings-grid').compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING), 'Trust demo follows the findings grid');
  check(!root.querySelector('[data-demo-controls]').hidden, 'Controls revealed by the script');
  check(root.querySelector('.tr-kicker').textContent.startsWith('Measured'), 'Eyebrow names the provenance');
  const press = action => root.querySelector(`[data-demo-action="${action}"]`).click();
  const shownRows = () => [...root.querySelectorAll('[data-tr-view] tbody tr')].map(tr => ({
    model: tr.dataset.model,
    cells: Object.fromEntries([...tr.querySelectorAll('[data-tr-cell]')].map(td => [td.dataset.trCell, td])),
  }));
  const value = td => parseFloat(td.childNodes[0].textContent);

  const views = [];
  for (const bench of ['mmlupro', 'gpqa']) for (const setting of ['natural', 'adversarial', 'flip', 'allwrong']) for (const context of ['outcome', 'reasoning']) {
    if (setting === 'allwrong' && bench !== 'gpqa') continue;
    views.push([bench, setting, context]);
  }
  for (const [bench, setting, context] of views) {
    press(`tr-bench:${bench}`); press(`tr-setting:${setting}`); press(`tr-context:${context}`);
    const label = `${bench}/${setting}/${context}`;
    check(root.dataset.trView === `${bench}|${setting}|${context}`, `${label}: view selected`);
    const expected = expectedRows(bench, setting, context);
    const rows = shownRows();
    check(rows.length === expected.length && rows.every((r, i) => r.model === expected[i].model), `${label}: model rows`);
    rows.forEach((row, i) => {
      const exp = expected[i];
      for (const key of ['sa', 'ag', 'ecli', 'ecle']) check(Math.abs(value(row.cells[key]) - exp[key]) < 1e-9, `${label}/${row.model}: ${key} ${value(row.cells[key])} vs ${exp[key]}`);
      const d = exp.ecle - exp.ag;
      const q = count(exp.ecle, N[bench]) - count(exp.ag, N[bench]);
      const diff = squash(row.cells.diff.textContent);
      check(diff.startsWith(ppText(d)), `${label}/${row.model}: difference ${diff} vs ${ppText(d)}`);
      check(diff.includes(`${q > 0 ? '+' : q < 0 ? '−' : ''}${Math.abs(q)} of ${N[bench]} questions`), `${label}/${row.model}: question count ${diff}`);
      check(row.cells.ag.classList.contains('is-below-sa') === (exp.ag < exp.sa), `${label}/${row.model}: below-single-agent mark`);
      if (setting === 'flip') check(row.cells.ecle.textContent.includes(`was ${pct(T10_NORMAL_ECLE[bench][exp.model][context === 'outcome' ? 0 : 1])}`), `${label}/${row.model}: unflipped value shown`);
    });
    if (setting === 'flip') {
      const caption = root.querySelector('[data-tr-view] .tr-caption').textContent;
      const mismatch = bench === 'gpqa' && context === 'outcome';
      check(caption.includes('Qwen 3-4B, ECL (E): 62.5% in Table 10 vs 67.5% in Table 6') === mismatch, `${label}: Table 10 vs Table 6 disagreement stated only where it exists`);
    }
    const verdict = root.querySelector('[data-tr-view-verdict]').textContent;
    const above = expected.filter(r => r.ecle > r.ag).length;
    if (setting === 'natural' || setting === 'adversarial') check(verdict.startsWith(`ECL (E) is above AG for ${above} of ${expected.length} models`), `${label}: verdict count (${verdict.slice(0, 60)})`);
    if (setting === 'flip') check(verdict.includes(`below AG for ${expected.filter(r => r.ecle < r.ag).length}`), `${label}: flip verdict`);
    if (setting === 'allwrong') check(verdict.includes(`at or below AG for ${expected.filter(r => r.ecle <= r.ag).length} of 3`), `${label}: All-W verdict`);
  }
  // Headline outcomes a reader can discover.
  press('tr-bench:gpqa'); press('tr-setting:adversarial'); press('tr-context:outcome');
  check(root.querySelector('[data-model="geminipro"] [data-tr-cell="ecle"]').textContent.startsWith('100.0%'), 'Gemini 3 Pro reaches 100.0% on adversarial GPQA');
  press('tr-setting:flip');
  check(root.querySelector('[data-tr-view-verdict]').textContent.includes('Gemini 3 Flash 97.5% → 35.0% (−62.5 pp, −25 of 40 questions)'), 'Flip verdict names the largest drop with its question count');
  press('tr-setting:allwrong');
  check(root.querySelector('[data-tr-view-verdict]').textContent.includes('DeepSeek V3.2 65.0%; GPT-5-mini 80.0%; Gemini 3 Flash 55.0%'), 'All-W verdict lists the decoupled-belief values');
  // All-W exists for GPQA only: choosing MMLU-Pro disables it and falls back to the adversarial view.
  press('tr-bench:mmlupro');
  const allWrong = root.querySelector('[data-demo-action="tr-setting:allwrong"]');
  check(allWrong.disabled && root.dataset.trView === 'mmlupro|adversarial|outcome', 'All peers wrong disabled for MMLU-Pro');
  check(root.querySelector('[data-demo-action="tr-setting:adversarial"]').getAttribute('aria-pressed') === 'true', 'Fallback view is pressed');

  /* ---------------- Table 11 split, recomputed ---------------- */
  const reconstruct = (prr, a1, a0) => {
    let best = null;
    for (let n1 = 0; n1 <= 40; n1++) {
      const n0 = 40 - n1;
      const k1 = [...Array(n1 + 1).keys()].find(k => n1 && (k / n1 * 100).toFixed(1) === a1.toFixed(1));
      const k0 = [...Array(n0 + 1).keys()].find(k => n0 && (k / n0 * 100).toFixed(1) === a0.toFixed(1));
      if (k1 === undefined || k0 === undefined) continue;
      if (!best || Math.abs(n1 - prr * 0.4) < Math.abs(best.n1 - prr * 0.4)) best = { n1, k1, n0, k0 };
    }
    return best;
  };
  for (const context of ['outcome', 'reasoning']) {
    press(`tr-context:${context}`);
    const ci = context === 'outcome' ? 0 : 1;
    for (const [model, data] of Object.entries(SPLIT)) {
      const item = root.querySelector(`[data-tr-split] li[data-model="${model}"]`);
      const exp = reconstruct(data.prr[ci], ...data[context]);
      const squares = cls => item.querySelectorAll(`.tr-strip i${cls}`).length;
      check(squares('.is-named.is-right') === exp.k1 && squares('.is-named') === exp.n1 && squares('.is-other.is-right') === exp.k0 && squares('.is-other') === exp.n0, `${model}/${context}: square counts`);
      check(squares('.is-named') + squares('.is-other') === 40, `${model}/${context}: 40 GPQA questions`);
      const text = squash(item.querySelector('.tr-strip-text').textContent);
      const total = exp.k1 + exp.k0;
      check(text.includes(`${exp.k1} of ${exp.n1} right`) && text.includes(`total ${total} of 40 = ${pct(total * 2.5)}`), `${model}/${context}: split text`);
      const agrees = total * 2.5 === data.ecle[ci];
      check(text.includes('as printed in Table 10') === agrees, `${model}/${context}: Table 10 cross-check`);
    }
  }
  const q8 = squash(root.querySelector('[data-tr-split] li[data-model="qwen8b"] .tr-strip-text').textContent);
  check(q8.includes('Table 8 prints 42.0%') && q8.includes('17 questions (42.5%)'), 'Qwen 3-8B recognition rate is reconciled with 40 questions');
  const flash = squash(root.querySelector('[data-tr-split] li[data-model="geminiflash"] .tr-strip-text').textContent);
  check(flash.includes('Table 10 prints 95.0% for ECL (E), one question fewer'), 'Gemini 3 Flash inconsistency is stated');
  check(root.querySelector('[data-tr-split-verdict]').textContent.includes('as small as 3 questions'), 'Split verdict states the small group size');

  /* ---------------- Controls, motion and layout ---------------- */
  const buttons = [...root.querySelectorAll('[data-demo-action]')];
  check(buttons.every(b => b.tagName === 'BUTTON' && b.type === 'button' && b.hasAttribute('aria-pressed')), 'Controls are toggle buttons');
  const natural = root.querySelector('[data-demo-action="tr-setting:natural"]');
  natural.focus(); natural.click();
  check(frame.contentDocument.activeElement === natural && natural.getAttribute('aria-pressed') === 'true', 'Focus stays on the pressed control');
  check(root.querySelector('[data-tr-view-verdict]').getAttribute('aria-live') === 'polite', 'View verdict is announced politely');
  const styles = [...root.querySelectorAll('*')].map(el => frame.contentWindow.getComputedStyle(el));
  check(styles.every(s => (s.transitionDuration === '0s' || s.transitionDuration === '') && (s.animationName === 'none' || s.animationName === '')), 'No transitions or animations');
  const reduced = frame.contentWindow.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const width of [390, 320]) {
    frame.style.width = `${width}px`;
    await new Promise(resolve => setTimeout(resolve, 50));
    check(doc.documentElement.scrollWidth <= width + 1, `No page overflow at ${width}px`);
    const rows = [...root.querySelectorAll('[data-tr-view] tbody tr')];
    check(rows.every(tr => tr.scrollWidth <= tr.clientWidth + 1 && tr.getBoundingClientRect().right <= width), `Table rows fit at ${width}px`);
    const ecle = root.querySelector('[data-tr-view] tbody tr [data-tr-cell="ecle"]').getBoundingClientRect();
    check(ecle.right <= width && ecle.width > 0, `ECL (E) visible without scrolling at ${width}px`);
    const strip = root.querySelector('.tr-strip');
    check(strip.getBoundingClientRect().right <= width, `Question strip fits at ${width}px`);
  }
  frame.style.width = '390px';

  /* ---------------- Static page without scripts ---------------- */
  doc = await load();
  root = doc.querySelector('[data-paper-demo="epistemic-context-learning"]');
  const liveView = squash(root.querySelector('[data-tr-view]').textContent);
  const liveVerdict = root.querySelector('[data-tr-view-verdict]').textContent;
  const liveSplit = squash(root.querySelector('[data-tr-split]').textContent);
  const html = await fetch('/papers/epistemic-context-learning.html').then(response => response.text());
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script:not([type="application/json"])').forEach(script => script.remove());
  const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
  await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
  const stat = frame.contentDocument.querySelector('[data-paper-demo="epistemic-context-learning"]');
  check(stat.querySelector('[data-demo-controls]').getClientRects().length === 0, 'Static: controls hidden');
  check(stat.querySelectorAll('[data-tr-view] tbody tr').length === 8 && stat.querySelectorAll('[data-tr-split] li').length === 5, 'Static: default table and strips rendered');
  check(squash(stat.querySelector('[data-tr-view]').textContent) === liveView, 'Static view matches the script-rendered default');
  check(stat.querySelector('[data-tr-view-verdict]').textContent === liveVerdict, 'Static verdict matches the script-rendered default');
  check(squash(stat.querySelector('[data-tr-split]').textContent) === liveSplit, 'Static split matches the script-rendered default');
  check([...stat.querySelectorAll('[data-demo-state]')].every(el => el.getClientRects().length > 0 && el.textContent.trim().length > 20), 'Static: states readable');
  await Promise.race([new Promise(resolve => { frame.onload = resolve; frame.removeAttribute('srcdoc'); }), new Promise(resolve => setTimeout(resolve, 3000))]);
  frame.remove();
  return { assertions, reducedMotion: reduced, failures };
})();
