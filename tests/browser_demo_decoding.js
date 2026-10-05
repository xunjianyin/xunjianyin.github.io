/* Decoding demos (COrAL, LEDOM). Run against the local preview:
 *   agent-browser eval --stdin < tests/browser_demo_decoding.js
 * Checks the transcribed Figure 2 replay, the measured values, the linked
 * highlighting, the published LEDOM text and its replay, placements, and the
 * script-free fallback, not merely that controls exist.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    frame.removeAttribute('srcdoc'); // srcdoc would take precedence over src
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html?t=${Date.now()}`; });
    return frame.contentDocument;
  };
  // A copy of the page; `head` is injected before every other script (used to emulate reduced motion).
  const loadCopy = async (slug, { scripts = true, head = '' } = {}) => {
    const html = await fetch(`/papers/${slug}.html`).then(response => response.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    if (!scripts) parsed.querySelectorAll('script').forEach(script => script.remove());
    else parsed.querySelectorAll('script[src]').forEach(script => { script.src = `${location.origin}/papers/${script.getAttribute('src')}`; });
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    let markup = parsed.documentElement.outerHTML;
    if (head) markup = markup.replace('<head>', `<head>${head}`);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = markup; });
    if (scripts) await sleep(150); // deferred scripts run after load in srcdoc frames
    return frame.contentDocument;
  };
  const loadStatic = slug => loadCopy(slug, { scripts: false });
  const fire = (el, type) => el.dispatchEvent(new frame.contentWindow.Event(type, { bubbles: type === 'input' }));
  const visible = el => !!el && el.getClientRects().length > 0;
  const text = el => el.textContent.replace(/\s+/g, ' ').trim();

  // ---- COrAL: Figure 2 transcribed independently of the generator ----
  const prompt = ['What', 'is', 'coral', '?'];
  const common = ['Coral', 'is', 'a', 'marine', 'organ', 'that', 'in', 'the', 'form', 'of', 'hard', 'skelet', ',', 'which', 'is', 'built', 'by'];
  const figure = {
    '1st': { fixed: 0, tokens: ['Coral', 'is', 'a'] },
    '2nd': { fixed: 3, tokens: ['Coral', 'is', 'a', 'marine', 'marine', 'living'] },
    '3rd': { fixed: 4, tokens: ['Coral', 'is', 'a', 'marine', 'organ', 'that', 'in', 'the', 'the'] },
    '9th': { fixed: 11, tokens: common },
    '10th': { fixed: 14, tokens: [...common, 'small', 'animals', '.'] }
  };
  // Arrows printed into each row: [source in the earlier row, target in the later row]; 0 is "?".
  const printed = {
    '1st': { forward: [[0, 1], [0, 2], [0, 3]], backward: [] },
    '2nd': { forward: [[3, 4], [3, 5], [3, 6]], backward: [] },
    '3rd': { forward: [[4, 5], [4, 6], [4, 7], [5, 6], [5, 7], [5, 8], [6, 7], [6, 8], [6, 9]], backward: [[5, 5], [6, 5], [6, 6]] },
    '10th': { forward: [[14, 15], [14, 16], [14, 17], [15, 16], [15, 17], [15, 18], [16, 17], [16, 18], [16, 19], [17, 18], [17, 19], [17, 20]],
      backward: [[15, 15], [16, 15], [16, 16], [17, 15], [17, 16], [17, 17]] }
  };
  const pairs = [[null, '1st'], ['1st', '2nd'], ['2nd', '3rd'], ['9th', '10th']];
  // The paper's own rules, recomputed: Algorithm 1 block end and dependencies within k = 3 (caption: k = 3, b = 6).
  const blockEnd = (start, length) => Math.min(start + 6 - 1, length + 3);
  const ruleArrows = (prev, cur) => {
    const [pf, pl] = prev ? [figure[prev].fixed, figure[prev].tokens.length] : [0, 0];
    const { fixed, tokens } = figure[cur];
    const inBlock = j => j > fixed && j <= tokens.length;
    const forward = [], backward = [];
    for (let i = fixed; i <= pl; i++) for (let j = i + 1; j <= i + 3; j++) if (inBlock(j)) forward.push([i, j]);
    for (let i = pf + 1; i <= pl; i++) for (let j = i - 3; j <= i; j++) if (inBlock(j)) backward.push([i, j]);
    return { forward, backward };
  };
  const key = list => list.map(([a, b]) => `${a}>${b}`).sort().join(' ');
  for (const [prev, cur] of pairs) {
    const length = prev ? figure[prev].tokens.length : 0;
    check(figure[cur].tokens.length === blockEnd(figure[cur].fixed + 1, length), `COrAL ${cur}: Algorithm 1 reproduces the printed block end`);
    const rule = ruleArrows(prev, cur);
    check(key(rule.forward) === key(printed[cur].forward) && key(rule.backward) === key(printed[cur].backward), `COrAL ${cur}: printed arrows follow the k = 3 window`);
  }
  const frames = [
    { key: 'prompt', before: null, after: null },
    { key: '1st', before: 'prompt', after: '1st' },
    { key: '2nd', before: '1st', after: '2nd' },
    { key: '3rd', before: '2nd', after: '3rd' },
    { key: '9th', before: '3rd', after: '9th', gap: true },
    { key: '10th', before: '9th', after: '10th' }
  ];
  const expectRow = (label, { promptShown = true } = {}) => {
    const cells = prompt.map(t => promptShown ? [t, 'is-prompt'] : ['', 'is-void']);
    const step = label && label !== 'prompt' ? figure[label] : { fixed: 0, tokens: [] };
    for (let p = 1; p <= 20; p++) {
      cells.push(p <= step.tokens.length ? [step.tokens[p - 1], p <= step.fixed ? 'is-fixed' : 'is-block'] : ['', 'is-void']);
    }
    return cells;
  };
  const rowMatches = (cells, expected) => cells.length === 24 && expected.every(([t, cls], i) => cells[i].textContent === t && cells[i].classList.contains(cls));

  let doc = await load('coral');
  let replay = doc.querySelector('[data-paper-demo="coral-replay"]');
  let root = doc.querySelector('[data-paper-demo="coral-evidence"]');
  check(!!replay && !!replay.closest('#method') && replay.closest('.method-demo'), 'COrAL replay placed in the Method section');
  check(!!root && !!root.closest('#findings'), 'COrAL measured explorer placed in the Evidence section');
  check(!doc.querySelector('#explore') && !doc.querySelector('a[href="#explore"]'), 'COrAL page has no Explore section');
  const methodLead = doc.querySelector('#method .method-lead');
  check(methodLead && (methodLead.compareDocumentPosition(replay) & Node.DOCUMENT_POSITION_FOLLOWING), 'COrAL replay follows the first Method paragraph');
  check(replay.querySelector('.demo-tag').textContent.includes('Figure 2'), 'COrAL replay eyebrow names Figure 2');
  check(root.querySelector('.demo-tag').textContent.startsWith('Measured'), 'COrAL explorer eyebrow names measured evidence');
  const rCells = name => [...replay.querySelectorAll(`[data-cr-row="${name}"] .cr-cell`)];
  const chip = i => replay.querySelector(`[data-demo-action="cr-goto"][data-frame="${i}"]`);
  const crStatus = () => replay.querySelector('[data-cr-status]').textContent;
  const crPlay = replay.querySelector('[data-demo-action="cr-play"]');
  const crStep = replay.querySelector('[data-demo-action="cr-step"]');
  const crReset = replay.querySelector('[data-demo-action="cr-reset"]');
  const shownGroups = () => [...replay.querySelectorAll('[data-cr-arrows]')].filter(g => g.getAttribute('visibility') !== 'hidden');
  const pressedFrame = () => [...replay.querySelectorAll('[data-demo-action="cr-goto"]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.frame).join();
  check(visible(replay.querySelector('[data-cr-controls]')) && pressedFrame() === '0', 'COrAL replay opens at the prompt, controls shown');
  check(crStatus().startsWith('Prompt only') && shownGroups().length === 0, 'COrAL prompt frame: no arrows yet');
  check([crPlay, crStep, crReset, chip(0)].every(b => b.tagName === 'BUTTON' && b.type === 'button' && b.tabIndex >= 0), 'COrAL controls are keyboard-operable buttons');
  check(crPlay.getAttribute('aria-pressed') === 'false' && replay.querySelector('[data-cr-status]').getAttribute('aria-live') === 'polite' && replay.querySelector('[data-cr-status]').getAttribute('role') === 'status', 'COrAL play toggle and live status');
  // Map each drawn line back to the cells it starts and ends in.
  const drawnArrows = (group, cls) => {
    const svg = replay.querySelector('.cr-arrows').getBoundingClientRect();
    const column = (cells, x) => cells.findIndex(cell => { const r = cell.getBoundingClientRect(); return x >= r.left - 0.5 && x <= r.right + 0.5; });
    return [...group.querySelectorAll(`line.${cls}`)].map(line => {
      const x1 = svg.left + svg.width * parseFloat(line.getAttribute('x1')) / 100;
      const x2 = svg.left + svg.width * parseFloat(line.getAttribute('x2')) / 100;
      return [column(rCells('before'), x1) - 3, column(rCells('after'), x2) - 3];
    });
  };
  const staticStatus = {};
  for (const [i, f] of frames.entries()) {
    chip(i).click();
    await sleep(520); // the block outline transition is shorter than this
    check(pressedFrame() === String(i), `COrAL frame ${f.key}: chip aria-pressed`);
    const before = f.before === null ? expectRow(null, { promptShown: false }) : expectRow(f.before);
    check(rowMatches(rCells('before'), before), `COrAL frame ${f.key}: earlier row tokens and classes exact`);
    check(rowMatches(rCells('after'), expectRow(f.after)), `COrAL frame ${f.key}: later row tokens and classes exact`);
    const groups = shownGroups();
    if (printed[f.key]) {
      check(groups.length === 1 && groups[0].dataset.crArrows === f.key, `COrAL frame ${f.key}: only its arrows shown`);
      check(key(drawnArrows(groups[0], 'cr-forward')) === key(printed[f.key].forward), `COrAL frame ${f.key}: forward arrows connect the printed tokens`);
      check(key(drawnArrows(groups[0], 'cr-backward')) === key(printed[f.key].backward), `COrAL frame ${f.key}: backward arrows connect the printed tokens`);
    } else {
      check(groups.length === 0, `COrAL frame ${f.key}: no arrows`);
    }
    check(visible(replay.querySelector('[data-cr-gap]')) === Boolean(f.gap), `COrAL frame ${f.key}: gap marker ${f.gap ? 'shown' : 'hidden'}`);
    const block = replay.querySelector('[data-cr-block]');
    if (f.after) {
      const step = figure[f.after];
      const first = rCells('after')[4 + step.fixed].getBoundingClientRect();
      const last = rCells('after')[3 + step.tokens.length].getBoundingClientRect();
      const r = block.getBoundingClientRect();
      check(Math.abs(r.left - first.left) < 2.5 && Math.abs(r.right - last.right) < 2.5, `COrAL frame ${f.key}: block outline spans positions ${step.fixed + 1}–${step.tokens.length}`);
    } else {
      check(!visible(block), 'COrAL prompt frame: no block yet');
    }
    check(replay.querySelector('tr.is-current')?.dataset.crLog === (f.key === 'prompt' ? undefined : f.key), `COrAL frame ${f.key}: step log row highlighted`);
    staticStatus[f.key] = crStatus();
  }
  // Revisions are marked where the printed rows differ.
  chip(3).click();
  const after3 = rCells('after');
  check(after3[3 + 5].textContent === 'organ' && after3[3 + 5].classList.contains('is-revised') && rCells('before')[3 + 5].textContent === 'marine', 'COrAL 3rd step: repeated “marine” revised to “organ”');
  check(after3[3 + 6].textContent === 'that' && after3[3 + 6].classList.contains('is-revised') && rCells('before')[3 + 6].textContent === 'living', 'COrAL 3rd step: “living” revised to “that”');
  check(after3[3 + 4].classList.contains('is-accepted') && after3.filter(c => c.classList.contains('is-accepted')).length === 1, 'COrAL 3rd step: only “marine” accepted');
  check(staticStatus['3rd'].includes('position 5 “marine” → “organ”') && staticStatus['3rd'].includes('min(5 + 6 − 1, 6 + 3) = 9'), 'COrAL 3rd status: revision and Algorithm 1 block end');
  check(staticStatus['2nd'].includes('min(4 + 6 − 1, 3 + 3) = 6') && staticStatus['2nd'].includes('no backward'), 'COrAL 2nd status: block end and no backward arrows');
  check(staticStatus['9th'].includes('not printed') && staticStatus['9th'].includes('Position 9 read “the”') && staticStatus['9th'].includes('“form”'), 'COrAL gap status: unprinted steps and the the→form revision');
  check(staticStatus['10th'].includes('min(15 + 6 − 1, 17 + 3) = 20') && staticStatus['10th'].includes('14 response tokens are fixed'), 'COrAL 10th status');
  chip(4).click();
  check(rCells('after')[3 + 9].textContent === 'form' && rCells('after')[3 + 9].classList.contains('is-revised') && rCells('before')[3 + 9].textContent === 'the'
    && rCells('after').filter(c => c.classList.contains('is-revised')).length === 1, 'COrAL gap: only position 9 (“the” → “form”) marked as changed');
  chip(5).click();
  const after10 = rCells('after');
  check([12, 13, 14].every(p => after10[3 + p].classList.contains('is-accepted')) && [18, 19, 20].every(p => after10[3 + p].classList.contains('is-new'))
    && [15, 16, 17].every(p => !after10[3 + p].classList.contains('is-new') && !after10[3 + p].classList.contains('is-revised')), 'COrAL 10th step: accepted, kept and new positions');
  check(crStep.disabled, 'COrAL Step disabled at the last printed step');
  // Step animates in two phases: accept and slide, then predict.
  crReset.click();
  check(pressedFrame() === '0' && crStatus() === staticStatus.prompt, 'COrAL Reset returns to the prompt');
  crStep.click();
  check(replay.dataset.phase === 'slide' && pressedFrame() === '1', 'COrAL Step starts with the slide phase');
  check([1, 2, 3].every(p => rCells('after')[3 + p].classList.contains('is-pending') && rCells('after')[3 + p].textContent === '') && shownGroups().length === 0, 'COrAL slide phase: block positions not yet predicted, no arrows');
  await sleep(700);
  check(replay.dataset.phase === 'filled' && rowMatches(rCells('after'), expectRow('1st')) && shownGroups()[0]?.dataset.crArrows === '1st', 'COrAL fill phase: tokens and arrows appear within 600 ms');
  crStep.click(); await sleep(700);
  crStep.click();
  const slide3 = rCells('after');
  check(slide3[3 + 4].classList.contains('is-accepted') && slide3[3 + 5].classList.contains('is-draft') && slide3[3 + 5].textContent === 'marine'
    && slide3[3 + 6].textContent === 'living' && [7, 8, 9].every(p => slide3[3 + p].classList.contains('is-pending')), 'COrAL 3rd slide phase: old draft tokens wait in the moved block');
  crStep.click(); // Step during the slide completes it at once
  check(replay.dataset.phase === 'filled' && pressedFrame() === '3' && rCells('after')[3 + 5].textContent === 'organ', 'COrAL Step completes a step in progress');
  // Play / Pause
  crReset.click();
  crPlay.click();
  check(crPlay.getAttribute('aria-pressed') === 'true' && crPlay.textContent === 'Pause' && pressedFrame() === '1', 'COrAL Play advances and becomes Pause');
  await sleep(700);
  crPlay.click();
  check(crPlay.getAttribute('aria-pressed') === 'false' && crPlay.textContent === 'Play', 'COrAL Pause');
  await sleep(2700);
  check(pressedFrame() === '1', 'COrAL paused replay stays put');
  crPlay.click();
  check(pressedFrame() === '2', 'COrAL Play resumes from the current step');
  await sleep(2700);
  check(pressedFrame() === '3', 'COrAL Play continues to the next printed step');
  crPlay.click();
  chip(5).click(); crPlay.click();
  check(pressedFrame() === '0', 'COrAL Play at the end restarts from the prompt');
  crPlay.click();
  check(replay.querySelector('.demo-provenance').textContent.includes('organism') && replay.querySelector('.demo-provenance').textContent.includes('Algorithm 1'), 'COrAL replay provenance: organism/organ note and Algorithm 1');
  check(doc.documentElement.scrollWidth <= 391, 'COrAL replay: no page overflow at 390');
  const scroller = replay.querySelector('.cr-scroll');
  check(scroller.scrollWidth > scroller.clientWidth && scroller.getAttribute('tabindex') === '0', 'COrAL replay rows scroll inside a focusable region on phones');
  chip(5).click(); await sleep(60);
  const blockBox = replay.querySelector('[data-cr-block]').getBoundingClientRect();
  const viewBox = scroller.getBoundingClientRect();
  check(blockBox.left >= viewBox.left - 1 && blockBox.left < viewBox.right, 'COrAL replay keeps the block in view on phones');

  // Reduced motion: a step is one immediate change, without the slide phase.
  const reduced = '<script>window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });<\/script>';
  doc = await loadCopy('coral', { head: reduced });
  replay = doc.querySelector('[data-paper-demo="coral-replay"]');
  replay.querySelector('[data-demo-action="cr-step"]').click();
  check(replay.dataset.phase === 'filled' && rowMatches([...replay.querySelectorAll('[data-cr-row="after"] .cr-cell')], expectRow('1st')), 'COrAL reduced motion: Step jumps to the filled state');

  // ---- COrAL: all 40 measured values (Tables 1-2, §4.1 HumanEval table) ----
  const settings = ['Next-token', 'Full COrAL', 'No verifier', 'No multi-forward'];
  const coralData = {
    GSM8K: [[74.1, 39.7], [75.3, 43.4], [72.4, 156.8], [78.7, 14.9]],
    MATH: [[21.8, 38.7], [22.7, 44.4], [20.0, 139.7], [24.3, 11.5]],
    LogiQA: [[55.1, 33.6], [58.2, 62.1], [55.7, 99.1], [59.1, 8.9]],
    ReClor: [[63.2, 33.2], [62.7, 38.2], [61.6, 72.0], [64.7, 11.3]],
    HumanEval: [[64.6, 42.2], [13.0, 45.8], [6.5, 119.0], [61.6, 28.8]]
  };
  doc = await load('coral');
  root = doc.querySelector('[data-paper-demo="coral-evidence"]');
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

  // ---- LEDOM: published examples, replayed in LEDOM's order ----
  doc = await load('reverse-lm');
  check(!doc.querySelector('[data-paper-demo="reverse-reward"]') && !doc.querySelector('#reverse-weight'), 'LEDOM invented-score λ demo removed');
  check(![...doc.querySelectorAll('[data-paper-demo]')].some(d => /−1\.45|−0\.90|−2\.00/.test(d.textContent)), 'LEDOM no invented log scores');
  check(!!doc.querySelector('[data-direction-demo]'), 'LEDOM overview direction toggle untouched');
  root = doc.querySelector('[data-paper-demo="reverse-examples"]');
  check(!!root.closest('#method') && !!root.closest('.method-demo'), 'LEDOM examples placed in the Method section');
  check(!!doc.querySelector('[data-paper-demo="reverse-reward-results"]').closest('#findings'), 'LEDOM Table 4 explorer placed in the Evidence section');
  check(!doc.querySelector('#explore'), 'LEDOM page has no Explore section');
  const exampleButton = key => root.querySelector(`[data-demo-action="rv-example"][data-example="${key}"]`);
  const shown = () => [...root.querySelectorAll('[data-rv-example]')].filter(visible);
  const slider = root.querySelector('#rv-progress');
  const published = {
    question: ['Alyssa’s cat loves eggs. If she eats 3 eggs a day, how many in a week?', 'Answer: She eats 3 eggs every day. 7 days in a week. 3*7 = 21. 21'],
    reversal: ['J.K. Rowling', 'is the author of Harry Potter.'],
    backstory: ['It was a good job, but it was not what he wanted to do for the rest of his life.', 'That is why Mike gave up his job and started his own business.'],
    story: ['so he got up and walked into Princess Lara’s room', 'And so, Prince Adrian and Princess Elara lived happily ever after'],
    gsm8k: ['the number of dollars Janet makes per fresh duck egg is 3-1=$2.', 'Janet’s ducks lay 16 eggs per day.']
  };
  const counts = { question: 16, reversal: 2, backstory: 104, story: 107, gsm8k: 70 };
  check(root.querySelectorAll('[data-demo-action="rv-example"]').length === 5 && exampleButton('reversal') && exampleButton('gsm8k'), 'LEDOM keeps five examples, including the reversal curse and the incorrect GSM8K case');
  check(root.querySelector('[data-demo-action="rv-example"][aria-pressed="true"]').dataset.example === 'question', 'LEDOM opens on the question-from-answer example');
  for (const [key, [output, given]] of Object.entries(published)) {
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
  // Play, Pause, Step and Reset.
  const rvPlay = root.querySelector('[data-demo-action="rv-play"]');
  const rvStep = root.querySelector('[data-demo-action="rv-step"]');
  const rvReset = root.querySelector('[data-demo-action="rv-reset"]');
  const reading = () => text(article.querySelector('[data-rv-row="output"] [data-rv-reading]'));
  exampleButton('reversal').click();
  article = shown()[0];
  check(rvStep.disabled, 'LEDOM Step disabled when the output is complete');
  rvPlay.click();
  check(rvPlay.getAttribute('aria-pressed') === 'true' && rvPlay.textContent === 'Pause' && slider.value === '0', 'LEDOM Play restarts a complete output from nothing');
  check(article.querySelector('[data-rv-status]').getAttribute('aria-live') === 'off', 'LEDOM status is not announced word by word while playing');
  await sleep(700);
  check(slider.value === '1' && article.querySelector('[data-rv-reading] .is-frontier').textContent === 'Rowling', 'LEDOM Play writes the last word first');
  await sleep(700);
  check(slider.value === '2' && rvPlay.getAttribute('aria-pressed') === 'false' && rvPlay.textContent === 'Play', 'LEDOM Play stops at the opening');
  check(reading() === 'J.K. Rowling' && article.querySelectorAll('.is-pending').length === 0, 'LEDOM replay end state equals the published text');
  check(status() === 'All 2 words generated. LEDOM wrote “Rowling” first and “J.K.” last.' && article.querySelector('[data-rv-status]').getAttribute('aria-live') === 'polite', 'LEDOM replay end status announced');
  exampleButton('question').click();
  article = shown()[0];
  rvPlay.click();
  await sleep(6600); // 16 words at 375 ms
  check(slider.value === '16' && reading() === published.question[0] && article.querySelectorAll('.is-pending, .is-frontier').length === 0, 'LEDOM question replay ends with the exact published question');
  exampleButton('backstory').click();
  article = shown()[0];
  rvPlay.click();
  await sleep(500);
  rvPlay.click();
  const paused = Number(slider.value);
  await sleep(400);
  check(paused > 0 && paused < 104 && Number(slider.value) === paused && rvPlay.getAttribute('aria-pressed') === 'false', 'LEDOM Pause holds the partial output');
  check(article.querySelectorAll('[data-rv-reading] .is-pending').length === 104 - paused, 'LEDOM partial replay: unwritten words pending');
  rvStep.click();
  check(Number(slider.value) === paused + 1, 'LEDOM Step writes one more word');
  rvReset.click();
  check(slider.value === '0' && status().startsWith('Nothing generated yet.'), 'LEDOM Reset clears the output');
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
  replay = doc.querySelector('[data-paper-demo="coral-replay"]');
  check(!visible(replay.querySelector('[data-cr-controls]')), 'COrAL replay static: controls hidden');
  check(rowMatches([...replay.querySelectorAll('[data-cr-row="after"] .cr-cell')], expectRow('10th')) && rowMatches([...replay.querySelectorAll('[data-cr-row="before"] .cr-cell')], expectRow('9th')), 'COrAL replay static: the 9th and 10th printed rows');
  check([...replay.querySelectorAll('[data-cr-arrows]')].filter(g => g.getAttribute('visibility') !== 'hidden').map(g => g.dataset.crArrows).join() === '10th', 'COrAL replay static: the 10th-step arrows drawn');
  check(replay.querySelector('[data-cr-status]').textContent === staticStatus['10th'], 'COrAL replay static status matches the enhanced 10th step');
  check(replay.querySelectorAll('.cr-log tbody tr').length === 6 && text(replay.querySelector('.cr-log')).includes('not printed'), 'COrAL replay static: step log of every printed step');
  root = doc.querySelector('[data-paper-demo="coral-evidence"]');
  check(!visible(root.querySelector('[data-coral-controls]')), 'COrAL static: controls hidden');
  check(visible(root.querySelector('[data-coral-key]')), 'COrAL static: key shown');
  check(root.querySelectorAll('.coral-panel').length === 5 && [...root.querySelectorAll('.coral-mark')].filter(visible).length === 20, 'COrAL static: all 20 points drawn');
  check(root.querySelector('[data-coral-summary]').textContent === staticSummary, 'COrAL static summary matches enhanced default');
  check(root.querySelectorAll('tbody td').length === 40, 'COrAL static: table lists 40 values');
  check(doc.documentElement.scrollWidth <= 391, 'COrAL static: no overflow');
  doc = await loadStatic('reverse-lm');
  root = doc.querySelector('[data-paper-demo="reverse-examples"]');
  check([...root.querySelectorAll('[data-rv-example]')].filter(visible).length === 5, 'LEDOM static: all five published examples readable');
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
