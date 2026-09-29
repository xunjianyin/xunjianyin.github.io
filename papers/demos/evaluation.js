/* Evaluation demos: the browser repeats the paper's own calculations on the reader's input.
 * The server-rendered state is complete; this script only adds controls.
 * No network requests or model inference.
 */
(() => {
  'use strict';
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const fmt = (value, digits = 3) => value.toFixed(digits).replace('-', '−');
  const tagLabels = {measured: 'Measured', adapted: 'Adapted', illustrative: 'Illustrative', input: 'Your input', computed: 'Computed'};
  // Provenance label, e.g. "Measured · Table 6". The word states the kind; color is secondary.
  const tag = (kind, reference = '') => `<span class="eval-tag eval-tag-${kind}">${escapeHTML(tagLabels[kind] + (reference ? ` · ${reference}` : ''))}</span>`;
  const readRange = (root, name) => Number(root.querySelector(`[data-demo-range="${name}"]`).value);
  const labelRange = (root, key, text) => { root.querySelector(`[data-eval-value="${key}"]`).textContent = text; };
  const setPressed = (buttons, predicate) => buttons.forEach((button) => button.setAttribute('aria-pressed', String(predicate(button))));
  const parts = (root) => ({results: root.querySelector('[data-eval-results]'), verdict: root.querySelector('[data-eval-verdict]')});

  /* ---------------- DSGram: AHP weights, consistency ratio, weighted score ---------------- */
  const saatyValue = (position) => (position <= 0 ? 1 - position : 1 / (1 + position));
  const saatyLabel = (position) => (position <= 0 ? String(1 - position) : `1/${1 + position}`);

  function judgmentMatrix(pairs, positions) {
    const matrix = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
    pairs.forEach(([i, j], k) => { matrix[i][j] = saatyValue(positions[k]); matrix[j][i] = 1 / matrix[i][j]; });
    return matrix;
  }

  // Power iteration for the principal eigenvector (Algorithm 1), normalized to sum to 1.
  function principal(matrix) {
    const n = matrix.length;
    let weights = Array(n).fill(1 / n);
    for (let step = 0; step < 500; step++) {
      const product = matrix.map((row) => row.reduce((sum, value, j) => sum + value * weights[j], 0));
      const total = product.reduce((a, b) => a + b, 0);
      const next = product.map((value) => value / total);
      const change = Math.max(...next.map((value, i) => Math.abs(value - weights[i])));
      weights = next;
      if (change < 1e-13) break;
    }
    const product = matrix.map((row) => row.reduce((sum, value, j) => sum + value * weights[j], 0));
    const lambda = product.reduce((sum, value, i) => sum + value / weights[i], 0) / n;
    return {weights, lambda};
  }

  function cycleText(config, positions) {
    const better = new Set();
    config.pairs.forEach(([i, j], k) => { if (positions[k] < 0) better.add(`${i}>${j}`); else if (positions[k] > 0) better.add(`${j}>${i}`); });
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 1]]) {
      if (better.has(`${a}>${b}`) && better.has(`${b}>${c}`) && better.has(`${c}>${a}`)) return [a, b, c, a].map((k) => config.criteria[k]).join(' > ');
    }
    return '';
  }

  function judgmentText(config, pair, position) {
    if (position === 0) return 'Equal importance (1)';
    const [i, j] = config.pairs[pair];
    const degree = Math.abs(position) + 1;
    return `${config.criteria[position < 0 ? i : j]} ${degree}× · ${config.words[degree]}`;
  }

  function matrixLabel(config, positions, i, j) {
    if (i === j) return '1';
    for (let k = 0; k < config.pairs.length; k++) {
      const [a, b] = config.pairs[k];
      if (a === i && b === j) return saatyLabel(positions[k]);
      if (a === j && b === i) return saatyLabel(-positions[k]);
    }
    return '1';
  }

  function initializeAhp(root, config) {
    const {results, verdict} = parts(root);
    let contextKey = 'a';
    const sliders = [0, 1, 2].map((k) => root.querySelector(`[data-demo-range="judgment-${k}"]`));
    const positions = () => sliders.map((slider) => Number(slider.value));
    const presetFor = (name) => (name === 'figure' ? config.contexts[contextKey].preset : config.presets[name]);

    function render() {
      const context = config.contexts[contextKey];
      const current = positions();
      sliders.forEach((slider, k) => {
        const text = judgmentText(config, k, current[k]);
        slider.setAttribute('aria-valuetext', text);
        labelRange(root, `judgment-${k}`, text);
      });
      const matrix = judgmentMatrix(config.pairs, current);
      const {weights, lambda} = principal(matrix);
      const ci = Math.max(0, (lambda - 3) / 2);
      const cr = ci / config.ri;
      const ok = cr < config.limit;
      const head = config.criteria.map((name, k) => `<th scope="col"><abbr title="${escapeHTML(name)}">${config.short[k]}</abbr></th>`).join('');
      const rows = config.criteria.map((name, i) => `<tr><th scope="row">${escapeHTML(name)}</th>${[0, 1, 2].map((j) => `<td data-eval-cell="${i}${j}">${matrixLabel(config, current, i, j)}</td>`).join('')}</tr>`).join('');
      const matrixHTML = `<div class="eval-block"><h4>Judgment matrix A</h4><div class="eval-table-wrap" tabindex="0" role="region" aria-label="Judgment matrix"><table class="eval-matrix"><thead><tr><th scope="col">Row vs column</th>${head}</tr></thead><tbody>${rows}</tbody></table></div><p class="eval-caption">a<sub>ij</sub> is the importance of the row criterion relative to the column criterion; a<sub>ji</sub> = 1/a<sub>ij</sub>. ${tag('input')}</p><dl class="eval-stats"><div><dt>λ<sub>max</sub></dt><dd data-eval-lambda>${fmt(lambda)}</dd></div><div><dt>CI = (λ<sub>max</sub> − 3) / 2</dt><dd data-eval-ci>${fmt(ci)}</dd></div><div><dt>CR = CI / 0.58</dt><dd data-eval-cr>${fmt(cr)}</dd></div></dl><p class="eval-consistency ${ok ? 'is-ok' : 'is-bad'}" data-eval-consistency>${ok ? 'Consistent: CR &lt; 0.10, accepted' : 'Inconsistent: CR ≥ 0.10, rejected by Algorithm 1'}</p></div>`;
      const weightRows = config.criteria.map((name, k) => `<tr><th scope="row">${escapeHTML(name)}</th><td><span class="eval-bar" aria-hidden="true"><i style="width:${(weights[k] * 100).toFixed(1)}%"></i></span><span data-eval-weight="${k}">${fmt(weights[k])}</span></td><td>${fmt(context.paper_weights[k])}</td><td>0.333</td></tr>`).join('');
      const weightsHTML = `<div class="eval-block"><h4>Weights</h4><div class="eval-table-wrap" tabindex="0" role="region" aria-label="Criterion weights"><table class="eval-weights"><thead><tr><th scope="col">Criterion</th><th scope="col">Your AHP weight</th><th scope="col">Figure 5(${contextKey}) · GPT-4</th><th scope="col">Equal</th></tr></thead><tbody>${weightRows}</tbody></table></div><p class="eval-caption">${tag('computed', 'Section 3.2')} your weights: the principal eigenvector of A, normalized to sum to 1. ${tag('measured', `Figure 5(${contextKey})`)} GPT-4 weights printed in the paper; the matrix behind them is not printed.</p></div>`;
      const totals = context.corrections.map((correction) => correction.scores.reduce((sum, score, k) => sum + score * weights[k], 0));
      const best = totals[0] >= totals[1] ? 0 : 1;
      const cards = context.corrections.map((correction, index) => {
        const subs = correction.scores.map((score, k) => `<li><span>${config.short[k]}</span><strong>${score}</strong></li>`).join('');
        const equal = correction.scores.reduce((a, b) => a + b, 0) / 3;
        const paper = correction.figure ? fmt(context.paper_score, 2) : '<small>not reported</small>';
        return `<article class="eval-score-card${index === best ? ' is-preferred' : ''}" data-eval-card="${index}"><h5>${escapeHTML(correction.name)}</h5><p class="eval-example">${escapeHTML(correction.text)}</p><ul class="eval-sub-scores" aria-label="Human sub-scores"><li class="eval-sub-label">Human sub-scores</li>${subs}</ul><dl class="eval-totals"><div class="is-yours"><dt>Your weights</dt><dd data-eval-total="${index}">${fmt(totals[index], 2)}</dd></div><div><dt>Figure 5 weights</dt><dd>${paper}</dd></div><div><dt>Equal weights</dt><dd>${fmt(equal, 2)}</dd></div><div><dt>Human overall</dt><dd>${correction.human}</dd></div></dl></article>`;
      }).join('');
      const scoresHTML = `<div class="eval-block eval-score-block"><h4>Apply the weights: W = Σ w<sub>i</sub> · s<sub>i</sub></h4><div class="eval-comparison">${cards}</div><p class="eval-caption">${tag('measured', 'released DSGram-Eval')} human sub-scores and overall scores (annotation file 1, items 1, 4, 9, 11); Figure 5 prints the same sub-scores for its two pairs. Your judgments are applied to both outputs; DSGram elicits a separate matrix for every sentence pair.</p></div>`;
      const pairHTML = `<div class="eval-pair"><p class="eval-pair-label">${tag('adapted', `Figure 5(${contextKey})`)} ${escapeHTML(context.label)}</p><dl><div><dt>Original</dt><dd>${escapeHTML(context.original)}</dd></div><div><dt>Corrected</dt><dd>${escapeHTML(context.corrected)}</dd></div></dl></div>`;
      results.innerHTML = `${pairHTML}<div class="eval-ahp-grid">${matrixHTML}${weightsHTML}</div>${scoresHTML}`;

      // Verdict: consistency first, then which output the weights prefer, then the paper's own weights.
      const cycle = cycleText(config, current);
      let text = ok
        ? `Consistent: CR = ${fmt(cr)} is below 0.10, so Algorithm 1 accepts these weights.`
        : `${cycle ? `The judgments form a cycle (${cycle}). ` : ''}Inconsistent: CR = ${fmt(cr)} ≥ 0.10. Algorithm 1 rejects this matrix and re-elicits the judgments; the weights are shown for inspection only.`;
      const names = context.corrections.map((correction) => correction.name.split(' · ').pop());
      const gap = Math.abs(totals[0] - totals[1]);
      text += gap < 0.005
        ? ` Your weights tie ${names[0]} and ${names[1]}.`
        : ` Your weights prefer ${names[totals[0] > totals[1] ? 0 : 1]} by ${fmt(gap, 2)} points; the annotator gave ${context.corrections[0].human} and ${context.corrections[1].human}.`;
      text += ` Figure 5 weights give the Figure 5 correction ${fmt(context.paper_score, 2)}; yours give ${fmt(totals[0], 2)}.`;
      verdict.textContent = text;
      setPressed(root.querySelectorAll('[data-demo-action^="context-"]'), (button) => button.dataset.demoAction === `context-${contextKey}`);
      setPressed(root.querySelectorAll('[data-demo-action^="preset-"]'), (button) => presetFor(button.dataset.demoAction.slice(7)).every((value, k) => value === current[k]));
    }

    const applyPreset = (values) => { values.forEach((value, k) => { sliders[k].value = value; }); };
    root.querySelectorAll('[data-demo-action^="context-"]').forEach((button) => button.addEventListener('click', () => {
      contextKey = button.dataset.demoAction.slice(8);
      // The paper's point: a different sentence pair leads to different judgments.
      applyPreset(config.contexts[contextKey].preset);
      render();
    }));
    root.querySelectorAll('[data-demo-action^="preset-"]').forEach((button) => button.addEventListener('click', () => { applyPreset(presetFor(button.dataset.demoAction.slice(7))); render(); }));
    sliders.forEach((slider) => slider.addEventListener('input', render));
    render();
  }

  /* ---------------- Data-to-text: MQM-style annotation score (Equations 1-2) ---------------- */
  function initializeAnnotation(root, config) {
    const {results, verdict} = parts(root);
    const typeSelect = root.querySelector('[data-demo-select="type"]');
    const severityButtons = root.querySelectorAll('[data-severity]');
    const wordButtons = [...root.querySelectorAll('[data-d2t-word]')];
    const tripleButtons = [...root.querySelectorAll('[data-d2t-triple]')];
    const revealButton = root.querySelector('[data-demo-action="reveal"]');
    let severity = 'Major';
    let revealed = false;
    const words = new Map();    // token index -> {type, severity}
    const omitted = new Map();  // triple index -> {type: 'Omission', severity}
    const alpha = (name) => config.severity[name];
    const tripleText = (index) => config.triples[index].join(' · ');

    // Adjacent words with an identical label form one error segment; punctuation separates segments.
    function segments() {
      const found = [];
      let current = null;
      config.tokens.forEach((token, index) => {
        const label = words.get(index);
        if (label && current && current.type === label.type && current.severity === label.severity && current.end === index - 1) {
          current.end = index; current.words.push(token);
        } else {
          if (current) found.push(current);
          current = label ? {type: label.type, severity: label.severity, start: index, end: index, words: [token]} : null;
        }
      });
      if (current) found.push(current);
      const spans = found.map((segment) => ({...segment, text: segment.words.join(' '), length: segment.words.length}));
      const omissions = [...omitted.entries()].sort((a, b) => a[0] - b[0]).map(([index, label]) => ({type: 'Omission', severity: label.severity, text: `${config.triples[index][1]} relation (missing)`, length: 1, triple: index}));
      return [...spans, ...omissions];
    }

    function render() {
      const all = segments();
      const penalty = all.reduce((sum, segment) => sum + alpha(segment.severity) * segment.length, 0);
      const score = (1 - penalty / config.wordcount) * 100;
      // Word and triple buttons are persistent controls; only their state changes.
      wordButtons.forEach((button) => {
        const index = Number(button.dataset.d2tWord);
        const label = words.get(index);
        button.setAttribute('aria-pressed', String(Boolean(label)));
        button.dataset.marked = label ? label.severity : '';
        button.classList.toggle('is-paper', revealed && index === config.paperWord);
        button.setAttribute('aria-label', `${config.tokens[index]}${label ? `, marked ${label.type}, ${label.severity}` : ''}${revealed && index === config.paperWord ? ', paper: Inaccuracy Intrinsic' : ''}`);
      });
      tripleButtons.forEach((button) => {
        const index = Number(button.dataset.d2tTriple);
        const label = omitted.get(index);
        button.setAttribute('aria-pressed', String(Boolean(label)));
        button.dataset.marked = label ? label.severity : '';
        button.textContent = label ? `Omitted · ${label.severity}` : 'Mark omitted';
        button.closest('li').classList.toggle('is-paper', revealed && index === config.paperTriple);
        const note = button.closest('li').querySelector('[data-eval-paper-note]');
        if (note) note.hidden = !revealed;
      });
      const byType = {};
      all.forEach((segment) => { byType[segment.type] = (byType[segment.type] || 0) + alpha(segment.severity) * segment.length / config.wordcount; });
      const rows = all.map((segment) => `<tr><th scope="row">${escapeHTML(segment.text)}</th><td>${escapeHTML(segment.type)}</td><td>${segment.severity} (${alpha(segment.severity)})</td><td>${segment.length}${segment.type === 'Omission' ? ' (fixed)' : ''}</td><td>${alpha(segment.severity) * segment.length}</td></tr>`).join('');
      const table = all.length
        ? `<div class="eval-table-wrap" tabindex="0" role="region" aria-label="Your annotation"><table class="eval-annotation"><thead><tr><th scope="col">Segment</th><th scope="col">Type</th><th scope="col">Severity</th><th scope="col">L</th><th scope="col">α × L</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th scope="row" colspan="4">Total penalty</th><td data-eval-penalty>${penalty}</td></tr></tfoot></table></div>`
        : '<p class="eval-empty">No errors marked yet. Select words in the output, or mark a triple as omitted.</p>';
      const escores = Object.entries(byType).map(([type, value]) => `<li><span>${escapeHTML(type)}</span><strong>${fmt(value)}</strong></li>`).join('');
      let html = `<div class="eval-block"><h4>Your annotation</h4>${table}<div class="eval-score-line"><p><span>Score = (1 − ${penalty} / ${config.wordcount}) × 100</span><strong data-eval-score>${fmt(score, 1)}</strong></p>${escores ? `<ul class="eval-escores" aria-label="Error score by type">${escores}</ul>` : ''}</div><p class="eval-caption">${tag('computed', 'Equations 1–2')} EScore<sub>t</sub> = Σ α<sub>e</sub> L<sub>e</sub> / wordcount for each type; the score subtracts their sum. The type decides which EScore receives the penalty, not its size.</p></div>`;
      if (revealed) {
        const word = words.get(config.paperWord);
        const omission = omitted.get(config.paperTriple);
        const wordNote = !word ? 'not marked by you' : word.type === 'Inaccuracy Intrinsic' ? `you agree (${word.severity})` : `you chose ${word.type}`;
        const omissionNote = omission ? `you agree (${omission.severity})` : 'not marked by you';
        const extra = all.filter((segment) => !(segment.type === 'Omission' && segment.triple === config.paperTriple) && !(segment.start <= config.paperWord && segment.end >= config.paperWord)).length;
        const highlight = word && omission && word.type === 'Inaccuracy Intrinsic' ? `${word.severity}-${omission.severity}` : '';
        const head = Object.entries(config.severity).map(([name, value]) => `<th scope="col">${name} (${value})</th>`).join('');
        const grid = Object.entries(config.severity).map(([rowName, rowAlpha]) => `<tr><th scope="row">${rowName} (${rowAlpha})</th>${Object.entries(config.severity).map(([colName, colAlpha]) => `<td${highlight === `${rowName}-${colName}` ? ' class="is-active"' : ''} data-eval-grid="${rowName}-${colName}">${fmt((1 - (rowAlpha + colAlpha) / config.wordcount) * 100, 1)}</td>`).join('')}</tr>`).join('');
        const table6 = config.table6.map(([name, value]) => `<tr><th scope="row">${escapeHTML(name)}</th><td>${value.toFixed(2)}</td></tr>`).join('');
        html += `<div class="eval-block" data-eval-paper><h4>The paper’s annotation of this output</h4><div class="eval-table-wrap" tabindex="0" role="region" aria-label="Paper annotation"><table class="eval-annotation"><thead><tr><th scope="col">Segment</th><th scope="col">Type</th><th scope="col">Severity</th><th scope="col">L</th><th scope="col">Your mark</th></tr></thead><tbody><tr><th scope="row">Georgetown</th><td>Inaccuracy Intrinsic</td><td>not reported</td><td>1</td><td>${escapeHTML(wordNote)}</td></tr><tr><th scope="row">county Seat relation (missing)</th><td>Omission</td><td>not reported</td><td>1 (fixed)</td><td>${escapeHTML(omissionNote)}</td></tr></tbody></table></div><p class="eval-caption">${tag('adapted', 'Table 2 caption')} Georgetown is the county seat, not the largest city (Inaccuracy Intrinsic); the county seat is never mentioned (Omission). You marked ${extra} further segment${extra === 1 ? '' : 's'} that the paper does not list. Severities are not reported, so the paper’s annotation scores:</p><div class="eval-table-wrap" tabindex="0" role="region" aria-label="Score of the paper annotation by severity"><table class="eval-grid"><thead><tr><th scope="col">Inaccuracy Intrinsic ↓ · Omission →</th>${head}</tr></thead><tbody>${grid}</tbody></table></div><p class="eval-caption">${tag('computed', 'Equation 2')} for one output of ${config.wordcount} words${highlight ? '; the outlined cell uses your severities' : ''}.</p></div><div class="eval-block"><h4>Across the whole study</h4><div class="eval-table-wrap" tabindex="0" role="region" aria-label="Table 6 average error scores"><table class="eval-table6"><thead><tr><th scope="col">Error type</th><th scope="col">Average error score ↓</th></tr></thead><tbody>${table6}</tbody></table></div><p class="eval-caption">${tag('measured', 'Table 6')} average error score of each type across all models and datasets. The two error types in this example carry the largest average penalties.</p></div>`;
      }
      results.innerHTML = html;
      let text = all.length
        ? `${all.length} error segment${all.length === 1 ? '' : 's'}, total penalty ${penalty} over ${config.wordcount} words: score ${fmt(score, 1)}.`
        : `No errors marked: score ${fmt(score, 1)}.`;
      if (score < 0) text += ' The score is negative because the penalty exceeds the word count; the paper divides by all annotated outputs of a dataset, so system scores stay positive.';
      const longest = all.filter((segment) => segment.type !== 'Omission').reduce((max, segment) => Math.max(max, segment.length), 0);
      if (longest > 1 && omitted.size) text += ` A ${longest}-word segment costs ${longest}× its severity, while a missing fact always counts as length 1.`;
      if (revealed) text += ' The paper’s annotation is shown above for comparison.';
      verdict.textContent = text;
      setPressed(severityButtons, (button) => button.dataset.severity === severity);
      revealButton.setAttribute('aria-pressed', String(revealed));
      revealButton.textContent = revealed ? 'Hide the paper’s annotation' : 'Compare with the paper’s annotation';
    }

    const toggle = (store, key, label) => {
      const existing = store.get(key);
      if (existing && existing.type === label.type && existing.severity === label.severity) store.delete(key);
      else store.set(key, label);
      render();
    };
    wordButtons.forEach((button) => button.addEventListener('click', () => toggle(words, Number(button.dataset.d2tWord), {type: typeSelect.value, severity})));
    tripleButtons.forEach((button) => button.addEventListener('click', () => toggle(omitted, Number(button.dataset.d2tTriple), {type: 'Omission', severity})));
    severityButtons.forEach((button) => button.addEventListener('click', () => { severity = button.dataset.severity; render(); }));
    revealButton.addEventListener('click', () => { revealed = !revealed; render(); });
    root.querySelector('[data-demo-action="clear"]').addEventListener('click', () => { words.clear(); omitted.clear(); render(); });
    render();
  }

  /* ---------------- Cont-COMET: similarity x alpha^distance context selection ---------------- */
  function initializeContext(root, config) {
    const {results, verdict} = parts(root);
    let direction = 'both';
    function render() {
      const budget = readRange(root, 'budget');
      const decay = readRange(root, 'decay') / 100;
      labelRange(root, 'budget', String(budget));
      labelRange(root, 'decay', decay.toFixed(2));
      const scored = config.sentences.map((sentence) => ({...sentence, score: sentence.similarity * decay ** sentence.distance, eligible: direction === 'both' || sentence.side === 'previous'}));
      const eligible = scored.filter((sentence) => sentence.eligible);
      const selected = new Set([...eligible].sort((a, b) => b.score - a.score).slice(0, budget).map((sentence) => sentence.id));
      // An adjacent window of the same size: nearest first, the previous sentence first on a tie.
      const window = new Set([...eligible].sort((a, b) => a.distance - b.distance || (a.side === 'previous' ? -1 : 1)).slice(0, budget).map((sentence) => sentence.id));
      const row = (sentence) => {
        const status = !sentence.eligible ? 'Outside window' : selected.has(sentence.id) ? 'Selected' : 'Not selected';
        const classes = selected.has(sentence.id) ? ' is-selected' : !sentence.eligible ? ' is-excluded' : '';
        return `<li class="eval-context-row${classes}"><span class="eval-position">${escapeHTML(sentence.id)}</span><div><p>${escapeHTML(sentence.text)}</p><small>cos ${sentence.similarity.toFixed(2)} × ${decay.toFixed(2)}<sup>${sentence.distance}</sup></small></div><span class="eval-context-number">${sentence.score.toFixed(3)}<small>${status}</small></span></li>`;
      };
      const before = scored.filter((sentence) => sentence.side === 'previous');
      const after = scored.filter((sentence) => sentence.side === 'following');
      results.innerHTML = `<p class="eval-formula">Sim(R<sub>i</sub>, R<sub>j</sub>) = cos(r<sub>i</sub>, r<sub>j</sub>) · α<sup>|i−j|</sup></p><ol class="eval-context-list">${before.map(row).join('')}<li class="eval-context-target"><span>Current reference</span><strong>${escapeHTML(config.target)}</strong></li>${after.map(row).join('')}</ol><p class="eval-caption">${tag('illustrative')} document and cosine values; α is not reported in the paper. ${tag('adapted', 'Section 2.2')} selection rule; selection also stops before the 512-token encoder limit, which this short document never reaches.</p>`;
      const chain = [...before.filter((s) => selected.has(s.id)).map((s) => s.id), 'current', ...after.filter((s) => selected.has(s.id)).map((s) => s.id)].join(' → ');
      const differs = [...selected].filter((id) => !window.has(id)).length;
      const windowText = differs ? `An adjacent window of the same size would swap ${differs} sentence${differs > 1 ? 's' : ''}.` : 'It matches an adjacent window of the same size.';
      verdict.textContent = `${selected.size} context sentence${selected.size === 1 ? '' : 's'} selected, in document order: ${chain}. ${windowText}`;
      setPressed(root.querySelectorAll('[data-demo-action]'), (button) => button.dataset.demoAction === direction);
    }
    root.querySelectorAll('[data-demo-action]').forEach((button) => button.addEventListener('click', () => { direction = button.dataset.demoAction; render(); }));
    root.querySelectorAll('[data-demo-range]').forEach((input) => input.addEventListener('input', render));
    render();
  }

  /* ---------------- RERIC: Equation 11 overlap reranking ---------------- */
  function initializeReric(root, config) {
    const {results, verdict} = parts(root);
    let rerank = true;
    const neighbor = root.querySelector('[data-demo-range="neighbor"]');
    const center = root.querySelector('[data-demo-range="center"]');
    const distanceInputs = config.candidates.map((_, index) => root.querySelector(`[data-demo-range="distance-${index}"]`));
    const readDistance = (input, fallback) => {
      const value = Number(input.value);
      const valid = input.value !== '' && Number.isFinite(value) && value > 0;
      input.setAttribute('aria-invalid', String(!valid));
      return valid ? value : fallback;
    };
    function render() {
      const weights = [neighbor.value / 100, center.value / 100, neighbor.value / 100];
      labelRange(root, 'neighbor', weights[0].toFixed(2));
      labelRange(root, 'center', weights[1].toFixed(2));
      const distances = distanceInputs.map((input, index) => readDistance(input, config.candidates[index].distance));
      const ranked = config.candidates.map((candidate, index) => {
        const overlap = candidate.tokens.reduce((sum, token, i) => sum + (token === config.query[i] ? weights[i] : 0), 0) / 3;
        return {index, overlap, distance: distances[index], adjusted: rerank ? (1 - overlap) * distances[index] : distances[index]};
      }).sort((a, b) => a.adjusted - b.adjusted);
      const rows = ranked.map((row, rank) => {
        const candidate = config.candidates[row.index];
        const tokens = candidate.tokens.map((token, i) => `<span class="eval-character${token === config.query[i] ? ' is-match' : ''}${i === 1 ? ' is-center' : ''}">${escapeHTML(token)}</span>`).join('');
        return `<tr${rank === 0 ? ' class="is-winner"' : ''}><th scope="row"><span class="eval-rank">${rank + 1}</span><span lang="zh">${tokens}</span><small>${escapeHTML(candidate.gloss)}</small></th><td>${fmt(row.distance)}</td><td>${fmt(row.overlap)}</td><td><strong>${fmt(row.adjusted)}</strong></td></tr>`;
      }).join('');
      results.innerHTML = `<p class="eval-query">Input window <span lang="zh">这<mark>以</mark>个</span><small>from “这以个重大发…”, Figure 1; 以 should be 一 (yī, as in 这一个 “this one”)</small></p><p class="eval-formula">α = Σ<sub>i</sub> 1[v(i) = g(i)] · w<sub>i</sub> / 3;  d′ = (1 − α) · d;  w = (${weights.map((w) => w.toFixed(2)).join(', ')})</p><div class="eval-table-wrap" tabindex="0" role="region" aria-label="Candidate reranking"><table><thead><tr><th scope="col">Rank · retrieved 3-gram</th><th scope="col">Distance d</th><th scope="col">Overlap α</th><th scope="col">${rerank ? 'Adjusted d′' : 'Ranking distance'} ↓</th></tr></thead><tbody>${rows}</tbody></table></div><p class="eval-caption">${tag('adapted', 'Figure 1')} input and candidates. ${tag('adapted', 'Table 3')} weights w = (1.68, 0.68, 1.68), n = 3. ${tag('illustrative')} l2 distances in Figure 1’s retrieval order; the paper does not print them.</p>`;
      const top = config.candidates[ranked[0].index];
      const name = top.tokens.join('');
      let text;
      if (!rerank) {
        text = `Nearest candidate: ${name}. Without reranking, the nearest retrieved n-gram decides, and its center ${top.tokens[1]} ${top.tokens[1] === config.query[1] ? 'repeats the input error' : 'becomes the correction'}.`;
      } else {
        const negative = ranked.filter((row) => row.overlap > 1);
        text = `Nearest candidate: ${name}. `;
        if (top.tokens[1] === config.query[1]) text += 'A match on the uncertain center still earns enough overlap to keep the input error.';
        else if (negative.length) {
          text += `α exceeds 1 for ${negative.map((row) => config.candidates[row.index].tokens.join('')).join(' and ')}, so (1 − α) is negative and a larger retrieval distance gives a smaller adjusted distance.`;
          if (top.tokens[1] !== '一') text += ' Figure 1 instead shows 这一个 (“this one”) as the most probable correction.';
        } else text += 'Matching both correct neighbors outweighs matching the uncertain center.';
      }
      verdict.textContent = text;
      setPressed(root.querySelectorAll('[data-demo-action="raw"],[data-demo-action="rerank"]'), (button) => (button.dataset.demoAction === 'rerank') === rerank);
      const paper = config.paperWeights;
      setPressed([root.querySelector('[data-demo-action="weights-paper"]')], () => Math.abs(weights[0] - paper[0]) < 1e-9 && Math.abs(weights[1] - paper[1]) < 1e-9);
      setPressed([root.querySelector('[data-demo-action="weights-equal"]')], () => weights[0] === 1 && weights[1] === 1);
    }
    root.querySelectorAll('[data-demo-action="raw"],[data-demo-action="rerank"]').forEach((button) => button.addEventListener('click', () => { rerank = button.dataset.demoAction === 'rerank'; render(); }));
    root.querySelector('[data-demo-action="weights-paper"]').addEventListener('click', () => { neighbor.value = Math.round(config.paperWeights[0] * 100); center.value = Math.round(config.paperWeights[1] * 100); render(); });
    root.querySelector('[data-demo-action="weights-equal"]').addEventListener('click', () => { neighbor.value = 100; center.value = 100; render(); });
    root.querySelectorAll('[data-demo-range]').forEach((input) => input.addEventListener('input', render));
    render();
  }

  const initializers = {'dsgram-ahp': initializeAhp, 'context-selection': initializeContext, 'reric-reranking': initializeReric, 'data2text-annotate': initializeAnnotation};
  document.querySelectorAll('.evaluation-demo[data-paper-demo]').forEach((root) => {
    if (root.dataset.demoReady) return;
    const initialize = initializers[root.dataset.evaluationDemo];
    const config = root.querySelector('.eval-config');
    if (!initialize || !config || !root.querySelector('[data-eval-results]')) return;
    try {
      initialize(root, JSON.parse(config.textContent));
      root.dataset.demoReady = 'true';
      root.querySelectorAll('[data-demo-controls]').forEach((controls) => { controls.hidden = false; });
    } catch (error) {
      // The static state remains readable if enhancement cannot initialize.
      console.warn('Evaluation demo could not initialize:', error);
    }
  });
})();
