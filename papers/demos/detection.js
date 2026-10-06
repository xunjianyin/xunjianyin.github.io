/* AGENT-X demos: the browser repeats the Python computation in scripts/paper_demo_detection.py
 * when the reader changes an input. The server-rendered state is complete; this script only
 * reveals and wires the controls. No network requests or model inference; no motion.
 */
(() => {
  'use strict';
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  // Round half up, exactly like fmt() in the Python module.
  const fmt = (value, digits = 3) => {
    const scale = 10 ** digits;
    let n = Math.floor(value * scale + 0.5);
    const sign = n < 0 ? '−' : '';
    n = Math.abs(n);
    return `${sign}${Math.floor(n / scale)}.${String(n % scale).padStart(digits, '0')}`;
  };
  const pct = (value) => `${(Math.max(0, Math.min(1, value)) * 100).toFixed(2)}%`;
  const tagLabels = {measured: 'Measured', published: 'Published', illustrative: 'Illustrative', computed: 'Computed'};
  const tag = (kind, reference = '') => `<span class="dt-tag dt-tag-${kind}">${escapeHTML(tagLabels[kind] + (reference ? ` · ${reference}` : ''))}</span>`;
  const setPressed = (buttons, predicate) => buttons.forEach((button) => button.setAttribute('aria-pressed', String(predicate(button))));

  /* ---------------- Method: semantic-steering calibration (Section 4.2) ---------------- */
  function calibrate(outputs) {
    const confidences = outputs.map(([, hundredths]) => hundredths / 100);
    const n = confidences.length;
    const counts = {AI: 0, Human: 0};
    outputs.forEach(([label]) => { counts[label] += 1; });
    const majority = counts.AI >= counts.Human ? 'AI' : 'Human';
    const kappaAns = counts[majority] / n;
    let mu = 0;
    for (const c of confidences) mu += c;
    mu = mu / n;
    let variance = 0;
    for (const c of confidences) variance += (c - mu) * (c - mu);
    const sigma = Math.sqrt(variance / n);
    const kappaConf = 1 / (1 + sigma / mu);
    const cCal = mu * kappaAns * kappaConf;
    const distances = confidences.map((c) => Math.abs(c - cCal));
    let kStar = 0;
    for (let k = 1; k < n; k++) if (distances[k] < distances[kStar]) kStar = k;   // ties keep the earlier prompt
    return {confidences, counts, majority, kappaAns, mu, sigma, kappaConf, cCal, distances, kStar, label: outputs[kStar][0]};
  }

  function calibrationRows(prompts, outputs, result) {
    const rows = outputs.map(([label, hundredths], k) => {
      const prompt = prompts[k];
      const selected = k === result.kStar;
      const chosen = selected ? '<span class="dt-chosen">closest to c_cal</span>' : '';
      return `<li class="dt-steer-row${selected ? ' is-selected' : ''}" data-dt-row="${k}">`
        + `<span class="dt-steer-name">${escapeHTML(prompt.name)}<small>“${escapeHTML(prompt.instruction)}”</small></span>`
        + `<span class="dt-track" aria-hidden="true"><i class="dt-tick dt-tick-mean" style="left:${pct(result.mu)}"></i>`
        + `<i class="dt-tick dt-tick-cal" style="left:${pct(result.cCal)}"></i>`
        + `<i class="dt-mark ${label === 'AI' ? 'is-ai' : 'is-human'}" style="left:${pct(hundredths / 100)}"></i></span>`
        + `<span class="dt-steer-value"><b>${escapeHTML(label)}</b> ${fmt(hundredths / 100, 2)}</span>`
        + `<span class="dt-steer-dist">|c<sub>k</sub> − c<sub>cal</sub>| ${fmt(result.distances[k])}${chosen}</span></li>`;
    });
    const axis = '<li class="dt-steer-axis" aria-hidden="true"><span></span><span class="dt-axis">'
      + '<i style="left:0%">0</i><i style="left:50%">0.5</i><i style="left:100%">1</i></span><span></span><span></span></li>';
    return rows.join('') + axis;
  }

  function calibrationReadout(prompts, result) {
    const majorityCount = result.counts[result.majority];
    const prompt = prompts[result.kStar].name.toLowerCase();
    return '<dl class="dt-readout">'
      + `<div><dt>Answer consistency</dt><dd>κ<sub>ans</sub> = ${majorityCount}/5 = ${fmt(result.kappaAns)}</dd></div>`
      + `<div><dt>Mean confidence</dt><dd>μ<sub>c</sub> = ${fmt(result.mu)}</dd></div>`
      + `<div><dt>Spread</dt><dd>σ<sub>c</sub> = ${fmt(result.sigma)}</dd></div>`
      + `<div><dt>Confidence consistency</dt><dd>κ<sub>conf</sub> = 1 / (1 + σ<sub>c</sub>/μ<sub>c</sub>) = ${fmt(result.kappaConf)}</dd></div>`
      + `<div class="is-key"><dt>Calibrated confidence</dt><dd>c<sub>cal</sub> = μ<sub>c</sub> · κ<sub>ans</sub> · κ<sub>conf</sub> = ${fmt(result.cCal)}</dd></div>`
      + `<div class="is-key"><dt>Reported label</dt><dd>${escapeHTML(result.label)}, from the ${escapeHTML(prompt)} prompt</dd></div>`
      + '</dl>';
  }

  function calibrationVerdict(prompts, outputs, result) {
    const k = result.kStar;
    let text = `Majority label ${result.majority} (${result.counts[result.majority]} of 5 prompts). `
      + `The agent reports ${result.label} with confidence ${fmt(result.cCal)}: `
      + `the ${prompts[k].name.toLowerCase()} prompt’s confidence (${fmt(outputs[k][1] / 100, 2)}) is closest to c_cal. `;
    text += result.label === result.majority ? 'The reported label agrees with the majority.' : 'The reported label is the minority label.';
    return text;
  }

  function initializeCalibration(root, config) {
    const outputs = config.presets[config.defaultPreset].map((pair) => [...pair]);
    let preset = config.defaultPreset;
    const steer = root.querySelector('[data-dt-steer]');
    const readout = root.querySelector('[data-dt-readout]');
    const verdict = root.querySelector('[data-dt-verdict]');
    const presetButtons = [...root.querySelectorAll('[data-demo-action^="preset:"]')];
    const labelButtons = [...root.querySelectorAll('[data-demo-action^="label:"]')];
    const ranges = [...root.querySelectorAll('[data-demo-range^="conf:"]')];

    function render() {
      const result = calibrate(outputs);
      steer.innerHTML = calibrationRows(config.prompts, outputs, result);
      readout.innerHTML = calibrationReadout(config.prompts, result);
      verdict.textContent = calibrationVerdict(config.prompts, outputs, result);
      root.dataset.cCal = fmt(result.cCal);
      root.dataset.reported = result.label;
      setPressed(presetButtons, (button) => button.dataset.demoAction === `preset:${preset}`);
      setPressed(labelButtons, (button) => {
        const [, k, label] = button.dataset.demoAction.split(':');
        return outputs[Number(k)][0] === label;
      });
      ranges.forEach((range) => {
        const k = Number(range.dataset.demoRange.split(':')[1]);
        range.value = String(outputs[k][1]);
        root.querySelector(`[data-dt-conf="${k}"]`).textContent = fmt(outputs[k][1] / 100, 2);
      });
    }

    presetButtons.forEach((button) => button.addEventListener('click', () => {
      preset = button.dataset.demoAction.split(':')[1];
      config.presets[preset].forEach((pair, k) => { outputs[k] = [...pair]; });
      render();
    }));
    labelButtons.forEach((button) => button.addEventListener('click', () => {
      const [, k, label] = button.dataset.demoAction.split(':');
      outputs[Number(k)][0] = label;
      preset = '';   // the inputs no longer match a starting point
      render();
    }));
    ranges.forEach((range) => range.addEventListener('input', () => {
      const k = Number(range.dataset.demoRange.split(':')[1]);
      const value = Math.round(Number(range.value) / 5) * 5;
      outputs[k][1] = Math.max(5, Math.min(100, value));
      preset = '';
      render();
    }));
    render();
  }

  /* ---------------- Evidence: accuracy (Tables 1-2) against AUROC (Tables 5-6) ---------------- */
  function initializeMetrics(root, config) {
    const state = {...config.defaults};
    const name = (id) => config.methods.find((m) => m.id === id).name;
    const label = (items, id) => items.find((item) => item.id === id).name;
    const results = {
      board: root.querySelector('[data-dt-board]'),
      title: root.querySelector('[data-dt-title]'),
      bars: root.querySelector('[data-dt-bars]'),
      verdict: root.querySelector('[data-dt-verdict]'),
    };
    const buttons = [...root.querySelectorAll('[data-demo-action]')];

    function summary(model, dataset) {
      const cell = config.values[model][dataset];
      const out = {};
      for (const metric of ['acc', 'auroc']) {
        const present = config.methods.map((m) => m.id).filter((id) => id in cell && cell[id][metric] !== null);
        const ours = Number(cell[config.ours][metric]);
        let leader = present[0];
        for (const id of present) if (Number(cell[id][metric]) > Number(cell[leader][metric])) leader = id;
        out[metric] = {rank: 1 + present.filter((id) => Number(cell[id][metric]) > ours).length, count: present.length, leader};
      }
      const oursAcc = Number(cell[config.ours].acc);
      const oursAuroc = Number(cell[config.ours].auroc);
      out.contrast = config.methods.map((m) => m.id).filter((id) => id !== config.ours && id in cell
        && cell[id].auroc !== null && cell[id].acc !== null
        && Number(cell[id].auroc) > oursAuroc && Number(cell[id].acc) < oursAcc);
      return out;
    }

    function verdictText(model, dataset) {
      const cell = config.values[model][dataset];
      const s = summary(model, dataset);
      const parts = [`${label(config.models, model)} · ${label(config.datasets, dataset)}.`];
      let sentence = `Accuracy: AGENT-X ranks ${s.acc.rank} of ${s.acc.count} (${cell[config.ours].acc})`;
      if (s.acc.rank > 1) sentence += `; the leader is ${name(s.acc.leader)} with ${cell[s.acc.leader].acc}`;
      parts.push(`${sentence}.`);
      sentence = `AUROC: AGENT-X ranks ${s.auroc.rank} of ${s.auroc.count} (${cell[config.ours].auroc})`;
      if (s.auroc.rank > 1) {
        const leaderAcc = cell[s.auroc.leader].acc;
        sentence += `; the leader is ${name(s.auroc.leader)} with ${cell[s.auroc.leader].auroc} (${leaderAcc !== null ? `accuracy ${leaderAcc}` : 'no accuracy printed'})`;
      }
      parts.push(`${sentence}.`);
      parts.push(s.contrast.length
        ? `Higher AUROC but lower accuracy than AGENT-X: ${s.contrast.map(name).join(', ')}.`
        : 'No baseline here has both a higher AUROC and a lower accuracy than AGENT-X.');
      return parts.join(' ');
    }

    function rows(model, dataset, sort) {
      const cell = config.values[model][dataset];
      const contrast = new Set(summary(model, dataset).contrast);
      const order = config.methods.map((m) => m.id).filter((id) => id in cell);
      // Stable sort: highest first; rows without the sort metric go last, in printed order.
      order.sort((a, b) => {
        const va = cell[a][sort];
        const vb = cell[b][sort];
        if ((va === null) !== (vb === null)) return va === null ? 1 : -1;
        return (vb === null ? 0 : Number(vb)) - (va === null ? 0 : Number(va));
      });
      return order.map((id) => {
        const entry = cell[id];
        const classes = ['dt-bar-row'];
        let note = '';
        if (id === config.ours) { classes.push('is-ours'); note = '<small>this paper; no threshold</small>'; }
        else if (contrast.has(id)) { classes.push('is-contrast'); note = '<small>higher AUROC, lower accuracy</small>'; }
        else if (entry.acc === null) { classes.push('is-auroc-only'); note = '<small>AUROC table only</small>'; }
        const metrics = [['acc', 'Accuracy'], ['auroc', 'AUROC']].map(([metric, metricLabel]) => {
          const value = entry[metric];
          if (value === null) {
            return `<span class="dt-metric is-missing"><span class="dt-metric-label">${metricLabel}</span>`
              + `<span class="dt-bar-track"></span><span class="dt-bar-value" data-dt-${metric}>not printed</span></span>`;
          }
          return `<span class="dt-metric"><span class="dt-metric-label">${metricLabel}</span>`
            + `<span class="dt-bar-track" aria-hidden="true"><i class="dt-bar-fill" style="width:${pct(Number(value))}"></i>`
            + `<i class="dt-bar-chance"></i></span><span class="dt-bar-value" data-dt-${metric}>${escapeHTML(value)}</span></span>`;
        }).join('');
        return `<li class="${classes.join(' ')}" data-method="${escapeHTML(id)}"><span class="dt-bar-name">${escapeHTML(name(id))}${note}</span>${metrics}</li>`;
      }).join('');
    }

    function board(model, dataset) {
      const head = config.datasets.map((d) => `<th scope="col">${escapeHTML(d.name)}</th>`).join('');
      const body = config.models.map((m) => {
        const cells = config.datasets.map((d) => {
          const s = summary(m.id, d.id);
          const selected = m.id === model && d.id === dataset;
          return `<td${selected ? ' class="is-selected"' : ''} data-dt-cell="${m.id}:${d.id}"><span class="dt-rank-acc${s.acc.rank === 1 ? ' is-first' : ''}">${s.acc.rank}</span>`
            + `<span class="dt-rank-sep" aria-hidden="true"> / </span><span class="dt-rank-auroc">${s.auroc.rank}</span></td>`;
        }).join('');
        return `<tr><th scope="row">${escapeHTML(m.name)}</th>${cells}</tr>`;
      }).join('');
      return `<div class="dt-board-wrap"><table class="dt-board"><thead><tr><th scope="col">Source model</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function render() {
      const tables = config.tables[state.model];
      results.board.innerHTML = board(state.model, state.dataset);
      results.title.innerHTML = `${escapeHTML(label(config.models, state.model))} · ${escapeHTML(label(config.datasets, state.dataset))} `
        + tag('measured', `${tables.acc} and ${tables.auroc}`);
      results.bars.innerHTML = rows(state.model, state.dataset, state.sort);
      results.verdict.textContent = verdictText(state.model, state.dataset);
      setPressed(buttons, (button) => {
        const [key, value] = button.dataset.demoAction.split(':');
        return state[key] === value;
      });
    }

    buttons.forEach((button) => button.addEventListener('click', () => {
      const [key, value] = button.dataset.demoAction.split(':');
      state[key] = value;
      render();
    }));
    render();
  }

  const initializers = {calibration: initializeCalibration, metrics: initializeMetrics};
  document.querySelectorAll('.detection-demo[data-paper-demo]').forEach((root) => {
    if (root.dataset.demoReady) return;
    const initialize = initializers[root.dataset.detectionDemo];
    const config = root.querySelector('.dt-config');
    if (!initialize || !config || !root.querySelector('[data-dt-results]')) return;
    try {
      initialize(root, JSON.parse(config.textContent));
      root.dataset.demoReady = 'true';
      root.querySelectorAll('[data-demo-controls]').forEach((controls) => { controls.hidden = false; });
    } catch (error) {
      // The static state remains readable if enhancement cannot initialize.
      console.warn('Detection demo could not initialize:', error);
    }
  });
})();
