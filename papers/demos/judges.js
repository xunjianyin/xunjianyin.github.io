/* Judge and generation demos: the browser repeats scripts/paper_demo_judges.py on the reader's input.
 * The server-rendered state is complete; this script only adds controls.
 * Printed values stay strings as printed; differences use integer thousandths or hundredths.
 * No network requests or model inference.
 */
(() => {
  'use strict';
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const minus = (text) => String(text).replace(/-/g, '−');
  const tagLabels = {measured: 'Measured', published: 'Published', illustrative: 'Illustrative', computed: 'Computed', schematic: 'Schematic'};
  // Provenance label, e.g. "Measured · Table 2". The word states the kind; color is secondary.
  const tag = (kind, reference = '') => `<span class="jd-tag jd-tag-${kind}">${escapeHTML(tagLabels[kind] + (reference ? ` · ${reference}` : ''))}</span>`;
  const parts = (root) => ({results: root.querySelector('[data-jd-results]'), verdict: root.querySelector('[data-jd-verdict]')});
  const setPressed = (buttons, predicate) => buttons.forEach((button) => button.setAttribute('aria-pressed', String(predicate(button))));
  const milli = (text) => Math.round(Number(text) * 1000);
  const centi = (text) => Math.round(Number(text) * 100);
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

  /* ---------------- Themis: printed correlations per benchmark, column and measure ---------------- */
  const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${(Math.abs(value) / 1000).toFixed(3)}`;

  function initializeThemis(root, config) {
    const {results, verdict} = parts(root);
    const names = Object.fromEntries(config.evaluators.map((item) => [item.key, item]));
    const orderIndex = Object.fromEntries(config.evaluators.map((item, index) => [item.key, index]));
    const benchName = (id) => config.benchmarks.find((b) => b.id === id).name;
    let viewId = config.default.view;
    let measure = config.default.measure;
    const view = () => config.views.find((v) => v.id === viewId);
    const subsetRow = root.querySelector('[data-jd-subsets]');

    function scoreboard() {
      return config.views.filter((v) => v.measures[measure] && 'themis' in v.measures[measure].values && 'gpt4' in v.measures[measure].values)
        .map((v) => ({view: v.id, benchmark: v.benchmark, label: v.label, diff: milli(v.measures[measure].values.themis) - milli(v.measures[measure].values.gpt4)}));
    }

    function render() {
      const current = view();
      const entry = current.measures[measure];
      const values = entry.values;
      const ranked = Object.entries(values).sort((a, b) => milli(b[1]) - milli(a[1]) || orderIndex[a[0]] - orderIndex[b[0]]);
      const numbers = Object.values(values).map(milli);
      const low = Math.min(0, Math.floor(Math.min(...numbers) / 100) * 100);
      const high = Math.max(100, Math.ceil(Math.max(...numbers) / 100) * 100);
      const span = high - low;
      const pct = (value) => `${((value - low) / span * 100).toFixed(2)}%`;
      const rows = ranked.map(([key, text]) => {
        const meta = names[key];
        const value = milli(text);
        const [left, right] = [Math.min(0, value), Math.max(0, value)];
        const classes = `jd-bar-row${key === 'themis' ? ' is-themis' : key === 'gpt4' ? ' is-gpt4' : ''}`;
        const dagger = meta.ref ? '<span class="jd-dagger" title="Reference-based (Table 2)">†</span>' : '';
        return `<li class="${classes}" data-evaluator="${key}"><span class="jd-bar-name">${escapeHTML(meta.name)}${dagger}<small>${escapeHTML(config.groups[meta.group])}</small></span><span class="jd-bar-track" aria-hidden="true"><i class="jd-bar-zero" style="left:${pct(0)}"></i><i class="jd-bar-fill" style="left:${pct(left)};width:${((right - left) / span * 100).toFixed(2)}%"></i></span><span class="jd-bar-value" data-value="${key}">${minus(text)}</span></li>`;
      }).join('');
      const missing = config.evaluators.filter((e) => !(e.key in values) && Object.values(current.measures).some((m) => e.key in m.values)).map((e) => e.name);
      const title = `${benchName(current.benchmark)} · ${current.label} · ${config.measures[measure]}`;
      const caution = current.cautions[measure] || '';
      const chart = `<div class="jd-block"><h4 data-jd-view-title>${escapeHTML(title)}</h4><p class="jd-axis" aria-hidden="true"><span>${minus((low / 1000).toFixed(1))}</span><span>${minus((high / 1000).toFixed(1))}</span></p><ol class="jd-bars" aria-label="${escapeHTML(title)}, highest first">${rows}</ol>${missing.length ? `<p class="jd-caption">Not printed for this measure: ${escapeHTML(missing.join(', '))}.</p>` : ''}<p class="jd-caption">${tag('measured', entry.table)} correlation with human ratings, as printed. † reference-based in Table 2; comet22, AUTOCALIBRATE, CoAScore and HD-EVAL-NN appear only in the appendix tables, which do not mark reference use.</p>${caution ? `<p class="jd-caution" data-jd-caution>${escapeHTML(caution)}</p>` : ''}</div>`;
      const board = scoreboard();
      const boardRows = config.benchmarks.map((benchmark) => {
        const cells = board.filter((c) => c.benchmark === benchmark.id);
        if (!cells.length) return '';
        const items = cells.map((c) => `<li><button type="button" class="jd-cell${c.diff < 0 ? ' is-gpt4-win' : c.diff === 0 ? ' is-tie' : ''}${c.view === viewId ? ' is-current' : ''}" data-jd-view="${c.view}" aria-pressed="${c.view === viewId}" aria-label="${escapeHTML(`${benchmark.name}, ${c.label}: Themis-8B minus GPT-4 ${signed(c.diff)}`)}"><span>${escapeHTML(c.label)}</span><strong>${signed(c.diff)}</strong></button></li>`).join('');
        return `<div class="jd-board-row"><p>${escapeHTML(benchmark.name)}</p><ul>${items}</ul></div>`;
      }).join('');
      const losses = board.filter((c) => c.diff < 0).length;
      results.innerHTML = `<div class="jd-block jd-board"><h4>Themis-8B minus GPT-4, every printed column · ${escapeHTML(config.measures[measure])}</h4>${boardRows}<p class="jd-caption">${tag('computed')} differences of printed values; warm cells are columns where GPT-4 is higher. ${losses} of ${board.length} columns.</p></div>${chart}`;

      let text = `${benchName(current.benchmark)} · ${current.label} · ${config.measures[measure]} (${entry.table}). `;
      if ('themis' in values && 'gpt4' in values) {
        const diff = milli(values.themis) - milli(values.gpt4);
        const lead = diff === 0 ? 'a tie' : `${diff > 0 ? 'Themis-8B' : 'GPT-4'} leads by ${(Math.abs(diff) / 1000).toFixed(3)}`;
        text += `Themis-8B ${minus(values.themis)} vs GPT-4 ${minus(values.gpt4)}: ${lead}. `;
      } else if ('themis' in values) {
        text += `Themis-8B ${minus(values.themis)}; GPT-4 is not printed for this column. `;
      }
      if ('themis' in values) {
        const above = ranked.filter(([, v]) => milli(v) > milli(values.themis));
        text += above.length
          ? `${plural(above.length, 'evaluator')} score${above.length !== 1 ? '' : 's'} above Themis here: ${above.map(([k, v]) => `${names[k].name} ${minus(v)}`).join(', ')}. `
          : 'No printed evaluator scores above Themis here. ';
      }
      text += `Under ${config.measures[measure]}, GPT-4 is higher than Themis in ${losses} of the ${board.length} columns where both are printed.`;
      verdict.textContent = text;

      // Controls: benchmark, the column buttons of that benchmark, and the measures it prints.
      setPressed(root.querySelectorAll('[data-demo-action^="bench:"]'), (button) => button.dataset.demoAction === `bench:${current.benchmark}`);
      const label = subsetRow.querySelector('.jd-group-label').outerHTML;
      subsetRow.innerHTML = label + config.views.filter((v) => v.benchmark === current.benchmark)
        .map((v) => `<button type="button" data-demo-action="view:${v.id}" aria-pressed="${v.id === viewId}">${escapeHTML(v.label)}</button>`).join('');
      root.querySelectorAll('[data-demo-action^="measure:"]').forEach((button) => {
        const key = button.dataset.demoAction.slice(8);
        button.disabled = !(key in current.measures);
        button.setAttribute('aria-pressed', String(key === measure));
      });
    }

    // A view keeps the current measure when it prints it, otherwise its first printed measure.
    const open = (id) => {
      viewId = id;
      if (!(measure in view().measures)) measure = Object.keys(view().measures)[0];
      render();
    };
    root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || !root.contains(button) || button.disabled) return;
      const action = button.dataset.demoAction || '';
      if (action.startsWith('bench:')) open(config.views.find((v) => v.benchmark === action.slice(6)).id);
      else if (action.startsWith('view:')) open(action.slice(5));
      else if (action.startsWith('measure:')) { measure = action.slice(8); render(); }
      else if (button.dataset.jdView) {
        open(button.dataset.jdView);
        const again = root.querySelector(`.jd-cell[data-jd-view="${button.dataset.jdView}"]`);
        if (again) again.focus();
      }
    });
    render();
  }

  /* ---------------- NLG survey: paradigm table, situations, Section 6.2 orderings ---------------- */
  function initializeSurvey(root, config) {
    const {results, verdict} = parts(root);
    const active = new Set();
    let order = config.defaultOrder;
    const names = Object.fromEntries(config.paradigms.map((p) => [p.id, p.name]));
    const rank = {fits: 0, caveat: 1, out: 2};

    function assess() {
      const result = {};
      config.paradigms.forEach((paradigm) => {
        let status = 'fits';
        const reasons = [];
        config.filters.forEach((situation) => {
          if (!active.has(situation.id) || !(paradigm.id in situation.effects)) return;
          const [effect, text, ref] = situation.effects[paradigm.id];
          if (rank[effect] > rank[status]) status = effect;
          if (effect !== 'fits') reasons.push({situation: situation.label, status: effect, text, ref});
        });
        result[paradigm.id] = {status, reasons};
      });
      return result;
    }

    const ordinals = ['1st', '2nd', '3rd', '4th'];
    function ranks(key) {
      const spec = config.orderings[key];
      const labels = {};
      spec.tiers.forEach((tier, position) => {
        const note = (spec.notes || {})[position] || {};
        tier.forEach((paradigm) => {
          let text = ordinals[position] + (tier.length > 1 ? ' (tie)' : '');
          if (paradigm in note) text += `, ${note[paradigm]}`;
          (labels[paradigm] = labels[paradigm] || []).push(text);
        });
      });
      return Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, v.join(' and ')]));
    }
    function orderingText(key) {
      const spec = config.orderings[key];
      return spec.tiers.map((tier, position) => {
        const note = (spec.notes || {})[position] || {};
        return tier.map((p) => names[p] + (p in note ? ` (${note[p]})` : '')).join(' ≈ ');
      }).join(` ${spec.sep} `);
    }

    function render() {
      const assessment = assess();
      const on = active.size > 0;
      const status = Object.fromEntries(config.paradigms.map((p) => [p.id, on ? assessment[p.id].status : 'none']));
      const spec = config.orderings[order];
      const rankLabels = ranks(order);
      const head = config.paradigms.map((p) => `<th scope="col" class="jd-status-${status[p.id]}" data-paradigm="${p.id}"><span class="jd-col-name">${escapeHTML(p.name)} <small>${escapeHTML(p.section)}</small></span><span class="jd-rank">${escapeHTML(spec.label)}: ${escapeHTML(rankLabels[p.id])}</span>${on ? `<span class="jd-status">${escapeHTML(config.status[assessment[p.id].status])}</span>` : ''}</th>`).join('');
      const body = config.rows.map((row) => `<tr><th scope="row">${escapeHTML(row.label)}</th>${config.paradigms.map((p) => `<td class="jd-status-${status[p.id]}" data-label="${escapeHTML(p.name)}">${escapeHTML(row.cells[p.id][0])} <span class="jd-ref">(${escapeHTML(row.cells[p.id][1])})</span></td>`).join('')}</tr>`);
      const summeval = config.paradigms.map((p) => {
        const rows = config.summeval[p.id];
        const best = rows.reduce((a, b) => (milli(b[1]) > milli(a[1]) ? b : a));
        const low = rows.reduce((a, b) => (milli(b[1]) < milli(a[1]) ? b : a));
        return `<td class="jd-status-${status[p.id]}" data-label="${escapeHTML(p.name)}"><strong data-jd-best="${p.id}">${best[1]}</strong> ${escapeHTML(best[0])}<span class="jd-ref">range ${low[1]}–${best[1]} over ${rows.length} rows (Table 4)</span></td>`;
      }).join('');
      body.push(`<tr class="jd-measured-row"><th scope="row">Best SummEval overall</th>${summeval}</tr>`);
      const reasons = config.paradigms.flatMap((p) => assessment[p.id].reasons.map((reason) => `<li class="jd-status-${reason.status}"><strong>${escapeHTML(p.name)}</strong> · ${escapeHTML(reason.situation)}: ${escapeHTML(reason.text)} <span class="jd-ref">(${escapeHTML(reason.ref)})</span></li>`));
      const caveats = reasons.length ? `<div class="jd-block"><h4>Caveats for your situation</h4><ul class="jd-reasons">${reasons.join('')}</ul></div>` : '';
      const orderings = Object.entries(config.orderings).map(([key, o]) => `<li${key === order ? ' class="is-current"' : ''} data-jd-order="${key}"><span>${escapeHTML(o.label)}</span>${escapeHTML(orderingText(key))}</li>`).join('');
      results.innerHTML = `<div class="jd-table-wrap" tabindex="0" role="region" aria-label="Comparison of the four paradigms"><table class="jd-paradigms"><thead><tr><th scope="col">Property</th>${head}</tr></thead><tbody>${body.join('')}</tbody></table></div><p class="jd-caption">${tag('published', 'Sections 2–6, Tables 2–4')} each cell condenses the cited part of the survey. ${tag('measured', 'Table 4')} SummEval overall correlation, as printed; some rows come from Fu et al. (2023a), Hu et al. (2024) and Chu, Kim, and Yi (2025).</p>${caveats}<div class="jd-block"><h4>The survey’s own comparison (§6.2)</h4><ol class="jd-orderings">${orderings}</ol><p class="jd-caption" data-jd-why>${escapeHTML(spec.why)}</p></div>`;

      const ordering = `${spec.label} (§6.2): ${orderingText(order)}.`;
      if (!on) verdict.textContent = `No situation selected; every paradigm is shown. ${ordering}`;
      else {
        const group = (s) => config.paradigms.filter((p) => assessment[p.id].status === s).map((p) => p.name);
        const pieces = [['fits', 'Fit'], ['caveat', 'Fit with a caveat'], ['out', 'Ruled out']].filter(([s]) => group(s).length).map(([s, label]) => `${label}: ${group(s).join(', ')}.`);
        verdict.textContent = `${pieces.join(' ')} ${ordering}`;
      }
      setPressed(root.querySelectorAll('[data-demo-action^="filter:"]'), (button) => active.has(button.dataset.demoAction.slice(7)));
      setPressed(root.querySelectorAll('[data-demo-action^="order:"]'), (button) => button.dataset.demoAction === `order:${order}`);
    }
    root.querySelectorAll('[data-demo-action^="filter:"]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.demoAction.slice(7);
      if (active.has(id)) active.delete(id); else active.add(id);
      render();
    }));
    root.querySelectorAll('[data-demo-action^="order:"]').forEach((button) => button.addEventListener('click', () => { order = button.dataset.demoAction.slice(6); render(); }));
    render();
  }

  /* ---------------- EAMA: NYTimes800k ladder, changes against the named row ---------------- */
  const hundredths = (value, withSign = false) => {
    const text = (Math.abs(value) / 100).toFixed(2);
    if (!withSign) return (value < 0 ? '−' : '') + text;
    return (value > 0 ? '+' : value < 0 ? '−' : '±') + text;
  };

  function initializeEama(root, config) {
    const {results, verdict} = parts(root);
    let metric = config.defaultMetric;
    const names = Object.fromEntries(config.rows.map((row) => [row.id, row.name]));
    function render() {
      const column = config.order.indexOf(metric);
      const values = Object.fromEntries(config.rows.map((row) => [row.id, centi(row.values.split(' ')[column])]));
      const label = config.metrics.find((m) => m.id === metric).label;
      const all = Object.values(values);
      const low = Math.floor(Math.min(...all) / 100 - 1) * 100;
      const high = Math.ceil(Math.max(...all) / 100 + 1) * 100;
      const span = high - low;
      const pct = (value) => `${((value - low) / span * 100).toFixed(2)}%`;
      const groups = Object.entries(config.groups).map(([group, title]) => {
        const items = config.rows.filter((row) => row.group === group).map((row) => {
          const value = values[row.id];
          const parent = row.parent ? values[row.parent] : null;
          const delta = parent === null ? 0 : value - parent;
          const left = Math.min(parent === null ? value : parent, value);
          const right = Math.max(parent === null ? value : parent, value);
          const segment = parent === null ? '' : `<i class="jd-step ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}" style="left:${pct(left)};width:${((right - left) / span * 100).toFixed(2)}%"></i>`;
          const change = parent === null ? 'starting point' : `${hundredths(delta, true)} vs ${config.short[row.parent]}`;
          return `<li class="jd-rung jd-rung-${group}${row.id === 'eama' ? ' is-eama' : ''}" data-row="${row.id}"><div class="jd-rung-text"><strong>${escapeHTML(row.name)}</strong><small>${escapeHTML(row.change)}</small></div><span class="jd-rung-track" aria-hidden="true">${segment}<i class="jd-dot" style="left:${pct(value)}"></i></span><span class="jd-rung-value"><b data-value="${row.id}">${hundredths(value)}</b><small data-delta="${row.id}" class="${delta < 0 ? 'is-down' : ''}">${escapeHTML(change)}</small></span></li>`;
        }).join('');
        return `<div class="jd-ladder-group"><h4>${escapeHTML(title)}</h4><ol class="jd-ladder">${items}</ol></div>`;
      }).join('');
      const {base, align, eama, oracle} = values;
      const gap = oracle - base;
      const share = gap ? Math.round((eama - base) / gap * 100) : 0;
      results.innerHTML = `<p class="jd-axis jd-axis-ladder" aria-hidden="true"><span>${hundredths(low)}</span><span>${hundredths(high)}</span></p>${groups}<dl class="jd-gap"><div><dt>Alignment tasks</dt><dd data-jd-gap="align">${hundredths(align - base, true)}</dd></div><div><dt>Self-supplemented input</dt><dd data-jd-gap="supplement">${hundredths(eama - align, true)}</dd></div><div><dt>Still to the oracle</dt><dd data-jd-gap="remaining">${hundredths(oracle - eama, true)}</dd></div><div><dt>Share of the Base-to-oracle gap EAMA closes</dt><dd data-jd-gap="share">${share}%</dd></div></dl><p class="jd-caption">${tag('measured', 'Tables 2 and 4')} NYTimes800k test results, as printed in arXiv v5. ${tag('computed')} each change against the row named next to it, and the gap shares. Bars run from that row’s value to this row’s value; oracle rows use the reference caption, which is not available at inference.</p>`;
      let text = `${label}: EAMA ${hundredths(eama)} against Base ${hundredths(base)} and the oracle ${hundredths(oracle)}, closing ${share}% of the gap. `;
      const variants = ['sent', 'ent', 'align'];
      const best = variants.reduce((a, b) => (values[b] > values[a] ? b : a));
      text += best === 'align' ? 'The two alignment tasks together beat either task alone. ' : `Among the alignment variants, ${names[best]} scores highest; combining both tasks is not best on this metric. `;
      text += `Reading the full article changes Base by ${hundredths(values.full - base, true)}, against ${hundredths(eama - base, true)} for EAMA’s selected context.`;
      if (align < base) text += ` Alignment alone lowers ${label.startsWith('Entity') ? label.toLowerCase() : label} below Base.`;
      verdict.textContent = text;
      setPressed(root.querySelectorAll('[data-demo-action^="metric:"]'), (button) => button.dataset.demoAction === `metric:${metric}`);
    }
    root.querySelectorAll('[data-demo-action^="metric:"]').forEach((button) => button.addEventListener('click', () => { metric = button.dataset.demoAction.slice(7); render(); }));
    render();
  }

  /* ---------------- Contextual ASR: which (key, value) pairs the datastore can search ---------------- */
  const reducedMotion = (root) => root.dataset.reducedMotion === 'true' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function initializeAsr(root, config) {
    const {results, verdict} = parts(root);
    const state = {...config.default};
    const playButton = root.querySelector('[data-asr-play]');
    const status = root.querySelector('[data-asr-status]');
    let timer = null;
    const positions = Array.from({length: config.positions}, (_, i) => i + 1);

    // Online: sentences of earlier steps are stored; offline: the finished online store.
    // Document context searches document A only; dataset context every test document.
    function cellState(doc, position, step) {
      if (step && doc === 'A' && position === step) return 'current';
      const stored = state.timing === 'offline' || position < step;
      if (!stored) return 'pending';
      if (state.scope === 'document' && doc !== 'A') return 'outside';
      return doc === 'A' ? 'same' : 'other';
    }
    const cueCell = (cue = state.cue) => [config.cases[state.case].cue_doc, config.cases[state.case].positions[cue]];
    function cueReason(cue, timing, scope) {
      const [doc, position] = cueCell(cue);
      const saved = [state.timing, state.scope];
      [state.timing, state.scope] = [timing, scope];
      const s = cellState(doc, position, config.target);
      [state.timing, state.scope] = saved;
      if (s === 'same' || s === 'other') return [true, 'searchable'];
      if (s === 'pending') return [false, position > config.target ? 'not processed yet' : 'processed in the same step'];
      return [false, 'in another document'];
    }
    function counts(step) {
      const result = {same: 0, other: 0};
      config.docs.forEach((doc) => positions.forEach((position) => { const s = cellState(doc, position, step); if (s in result) result[s] += 1; }));
      return result;
    }

    function render() {
      const spec = config.cases[state.case];
      const step = state.step;
      const [cueDoc, cuePosition] = cueCell();
      const rows = config.docs.map((doc) => {
        const cells = positions.map((position) => {
          const s = cellState(doc, position, step);
          const role = doc === cueDoc && position === cuePosition ? 'cue' : doc === 'A' && position === config.target ? 'target' : '';
          return `<li class="jd-cell-asr is-${s}${role ? ` is-${role}` : ''}" data-cell="${doc}${position}" data-state="${s}"><b>${doc}${position}</b><small>${role}</small><span class="jd-visually-hidden">${escapeHTML(config.labels[s])}</span></li>`;
        }).join('');
        const name = doc === 'A' ? 'Document A (followed)' : `Document ${doc}`;
        return `<div class="jd-doc-row"><p>${name}</p><ol aria-label="${name}">${cells}</ol></div>`;
      }).join('');
      const legend = Object.entries(config.labels).map(([key, label]) => `<li class="is-${key}"><i aria-hidden="true"></i>${escapeHTML(label)}</li>`).join('');
      const c = counts(step);
      const mode = config.modes.find((m) => m.timing === state.timing && m.scope === state.scope).name;
      const stepText = step ? `Step ${step} of ${config.positions}: correcting A${step}` : `Step 0 of ${config.positions}: before correction starts`;
      const store = `<p class="jd-store" data-jd-store><strong data-jd-step>${escapeHTML(stepText)}</strong><span>${escapeHTML(mode)} · searchable: <b data-jd-count="same">${c.same}</b> sentence${c.same !== 1 ? 's' : ''} of document A, <b data-jd-count="other">${c.other}</b> of other documents</span></p>`;
      const texts = `<dl class="jd-asr-texts"><div><dt>A${config.target} · target</dt><dd lang="zh">${escapeHTML(spec.output)}</dd><dd class="jd-gloss">${escapeHTML(spec.output_gloss)}</dd><dd lang="zh">${escapeHTML(spec.label)}</dd><dd class="jd-gloss">${escapeHTML(spec.label_gloss)}</dd></div><div><dt>${cueDoc}${cuePosition} · cue</dt><dd lang="zh">${escapeHTML(spec.cue)}</dd><dd class="jd-gloss">${escapeHTML(spec.cue_gloss)}</dd></div></dl>`;
      const summaryRows = config.modes.map((m) => {
        const cols = ['before', 'after'].map((option) => {
          const [ok, reason] = cueReason(option, m.timing, m.scope);
          return `<td class="${ok ? 'is-yes' : 'is-no'}">${ok ? 'Yes' : 'No'}<small>${escapeHTML(ok ? '' : reason)}</small></td>`;
        }).join('');
        const current = m.timing === state.timing && m.scope === state.scope ? ' class="is-current"' : '';
        return `<tr${current}><th scope="row">${escapeHTML(m.name)}</th>${cols}<td>${escapeHTML(m.cer)}</td></tr>`;
      }).join('');
      const beforeCell = `${spec.cue_doc}${spec.positions.before}`;
      const afterCell = `${spec.cue_doc}${spec.positions.after}`;
      const summary = `<div class="jd-block"><h4>Is the cue searchable when A3 is corrected?</h4><div class="jd-table-wrap" tabindex="0" role="region" aria-label="Cue availability by mode"><table class="jd-asr-summary"><thead><tr><th scope="col">Datastore mode</th><th scope="col">Cue in ${beforeCell}</th><th scope="col">Cue in ${afterCell}</th><th scope="col">AISHELL-1 CER ↓</th></tr></thead><tbody>${summaryRows}</tbody></table></div><p class="jd-caption">${tag('computed', 'Section 3.4 rules')} availability in this schematic. ${tag('measured', 'Table 2')} character error rate after correction; sentence-level BART ${config.bart}; * significant against BART at p &lt; 0.05. Availability is necessary, not sufficient: the model still has to retrieve and use the states.</p></div>`;
      results.innerHTML = `<div class="jd-asr-grid">${rows}</div><ul class="jd-legend">${legend}</ul>${store}${texts}<p class="jd-caption">${tag('published', spec.source)} sentences, BART output and label. ${tag('schematic')} three test documents of five sentences processed in parallel, one position per step, as in Figure 2(a); the positions of the cue and the target are reader-set and illustrative, since the paper prints the sentences but not their places in the documents.</p>${summary}`;

      const total = c.same + c.other;
      let text;
      if (step === 0) {
        text = state.timing === 'online'
          ? 'Before correction starts, the online datastore is empty. Each corrected sentence adds its attention keys and values, so later sentences can search earlier ones.'
          : `The offline datastore starts from the finished online pass: ${plural(total, 'sentence')} in scope are searchable before the first correction.`;
      } else {
        text = `Correcting A${step}: kNN attention can search ${plural(total, 'sentence')} (${c.same} from document A, ${c.other} from other documents). `;
        if (step === config.target) {
          const [ok, reason] = cueReason(state.cue, state.timing, state.scope);
          text += ok ? `The cue ${cueDoc}${cuePosition} is searchable, so the query can retrieve ${spec.reading}.` : `The cue ${cueDoc}${cuePosition} is not searchable (${reason}); like sentence-level BART, the corrector has only the sentence itself.`;
        } else if (step < config.target) text += `A${config.target} is corrected at step ${config.target}.`;
        else text += 'The target sentence has already been corrected.';
        if (state.timing === 'online') text += ` After this step, kNN add stores the keys and values of A${step}, B${step} and C${step}.`;
      }
      verdict.textContent = text;
      status.textContent = `Step ${step} of ${config.positions}`;
      ['case', 'cue', 'timing', 'scope'].forEach((key) => setPressed(root.querySelectorAll(`[data-demo-action^="${key}:"]`), (button) => button.dataset.demoAction === `${key}:${state[key]}`));
      playButton.setAttribute('aria-pressed', String(timer !== null));
      playButton.textContent = timer !== null ? 'Pause' : 'Play';
      root.querySelector('[data-asr-step]').disabled = step >= config.positions;
    }

    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
    const advance = () => {
      if (state.step < config.positions) state.step += 1;
      if (state.step >= config.positions) stop();
      render();
    };
    playButton.addEventListener('click', () => {
      if (timer !== null) { stop(); render(); return; }
      if (state.step >= config.positions) state.step = 0;
      // Reduced motion: Play advances a single step, with no timed sequence.
      if (reducedMotion(root)) { advance(); return; }
      const interval = Number(root.dataset.stepMs) || 1100;
      timer = setInterval(advance, interval);
      advance();
    });
    root.querySelector('[data-asr-step]').addEventListener('click', () => { stop(); advance(); });
    root.querySelector('[data-asr-reset]').addEventListener('click', () => { stop(); state.step = 0; render(); });
    root.querySelectorAll('[data-demo-action]').forEach((button) => button.addEventListener('click', () => {
      const [key, value] = button.dataset.demoAction.split(':');
      state[key] = value;
      render();
    }));
    render();
  }

  const initializers = {'themis-benchmarks': initializeThemis, 'survey-paradigms': initializeSurvey, 'eama-ladder': initializeEama, 'asr-datastore': initializeAsr};
  document.querySelectorAll('.judges-demo[data-paper-demo]').forEach((root) => {
    if (root.dataset.demoReady) return;
    const initialize = initializers[root.dataset.judgesDemo];
    const config = root.querySelector('.jd-config');
    if (!initialize || !config || !root.querySelector('[data-jd-results]')) return;
    try {
      initialize(root, JSON.parse(config.textContent));
      root.dataset.demoReady = 'true';
      root.querySelectorAll('[data-demo-controls]').forEach((controls) => { controls.hidden = false; });
    } catch (error) {
      // The static state remains readable if enhancement cannot initialize.
      console.warn('Judges demo could not initialize:', error);
    }
  });
})();
