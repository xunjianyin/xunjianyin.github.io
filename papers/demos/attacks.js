/* Attack-paper demos: the browser repeats scripts/paper_demo_attacks.py on the reader's input.
 * The server-rendered state is complete; this script only adds controls and row selection.
 * Printed values stay strings as printed; arithmetic uses integer tenths.
 * There is no motion, no network request and no model inference.
 */
(() => {
  'use strict';
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const minus = (text) => String(text).replace(/-/g, '−');
  const tenths = (text) => Math.round(Number(text) * 10);
  const fmt = (value) => `${value < 0 ? '−' : ''}${Math.floor(Math.abs(value) / 10)}.${Math.abs(value) % 10}`;
  const join = (items) => (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`);
  const tagLabels = {measured: 'Measured', computed: 'Computed'};
  // Provenance label, e.g. "Measured · Table 7". The word states the kind; color is secondary.
  const tag = (kind, reference = '') => `<span class="at-tag at-tag-${kind}">${escapeHTML(tagLabels[kind] + (reference ? ` · ${reference}` : ''))}</span>`;

  /* ---------------- Lazy grounding: the 12 settings of Tables 1 and 7 ---------------- */
  function initializeLazyGrounding(root, config) {
    const results = root.querySelector('[data-at-results]');
    const verdict = root.querySelector('[data-at-verdict]');
    const settings = config.settings;
    const paperIndex = Object.fromEntries(settings.map((s, i) => [s.id, i]));
    const modelIndex = Object.fromEntries(config.modelOrder.map((key, i) => [key, i]));
    const benchIndex = Object.fromEntries(config.benchOrder.map((key, i) => [key, i]));
    const name = (s) => `${config.models[s.model]} on ${config.benchmarks[s.bench]}`;
    const status = (s) => (tenths(s.ciLow) > 0 ? 'above' : tenths(s.ciHigh) < 0 ? 'below' : 'spans');
    const state = {...config.default};

    function ordered(view, order) {
      const rows = settings.slice();
      if (order === 'model') return rows.sort((a, b) => modelIndex[a.model] - modelIndex[b.model] || benchIndex[a.bench] - benchIndex[b.bench]);
      if (order === 'benchmark') return rows.sort((a, b) => benchIndex[a.bench] - benchIndex[b.bench] || modelIndex[a.model] - modelIndex[b.model]);
      const field = config.views[view].sortBy;
      return rows.sort((a, b) => tenths(b[field]) - tenths(a[field]) || paperIndex[a.id] - paperIndex[b.id]);
    }

    function pct(value, view) {
      const [low, high] = config.views[view].domain;
      return `${((value - low) / (high - low) * 100).toFixed(2)}%`;
    }

    function span(a, b, view, cls) {
      const [low, high] = config.views[view].domain;
      const left = Math.min(a, b);
      const right = Math.max(a, b);
      return `<i class="${cls}" style="left:${pct(left, view)};width:${((right - left) / (high - low) * 100).toFixed(2)}%"></i>`;
    }

    function marks(s, view) {
      const grid = config.views[view].ticks.map((t) => `<i class="at-grid${t === 0 ? ' at-zero' : ''}" style="left:${pct(t, view)}"></i>`).join('');
      let body;
      if (view === 'drop') {
        body = span(tenths(s.ciLow), tenths(s.ciHigh), view, 'at-line') + `<i class="at-mark at-fill" style="left:${pct(tenths(s.drop), view)}"></i>`;
      } else if (view === 'accuracy') {
        const clean = tenths(s.clean);
        const aug = tenths(s.aug);
        body = span(clean, aug, view, 'at-line') + `<i class="at-mark at-hollow" style="left:${pct(clean, view)}"></i><i class="at-mark at-fill" style="left:${pct(aug, view)}"></i>`;
      } else {
        const c = tenths(s.raac);
        const f = tenths(s.raaf);
        body = span(c, f, view, 'at-line') + `<i class="at-tick" style="left:${pct(tenths(s.raa), view)}"></i><i class="at-mark at-hollow" style="left:${pct(c, view)}"></i><i class="at-mark at-fill" style="left:${pct(f, view)}"></i>`;
      }
      return `<span class="at-track" aria-hidden="true"><span class="at-plot">${grid}${body}</span></span>`;
    }

    function value(s, view) {
      if (view === 'drop') return [minus(s.drop), `[${minus(s.ciLow)}, ${minus(s.ciHigh)}]`];
      if (view === 'accuracy') return [`${s.clean} → ${s.aug}`, `drop ${minus(s.drop)}`];
      return [`${s.raac} / ${s.raaf}`, `RAA ${s.raa}`];
    }

    function rowClass(s, view) {
      let kind;
      if (view === 'drop') kind = `is-${status(s)}`;
      else if (view === 'accuracy') kind = tenths(s.aug) > tenths(s.clean) ? 'is-gain' : 'is-loss';
      else kind = tenths(s.raaf) > tenths(s.raac) ? 'is-f-higher' : 'is-c-higher';
      return `at-row ${kind}${s.id === state.selected ? ' is-selected' : ''}`;
    }

    function rowInner(s, view) {
      const [main, sub] = value(s, view);
      return `<span class="at-row-name">${escapeHTML(config.models[s.model])}<small>${escapeHTML(config.benchmarks[s.bench])}</small></span>${marks(s, view)}<span class="at-row-value"><strong>${escapeHTML(main)}</strong> <small>${escapeHTML(sub)}</small></span>`;
    }

    function axis(view) {
      const [low, high] = config.views[view].domain;
      const labels = config.views[view].ticks.map((t, i) => {
        const edge = i === 0 && t === low ? ' is-first' : t === high ? ' is-last' : '';
        return `<span class="at-axis-label${edge}" style="left:${pct(t, view)}">${escapeHTML(minus(String(Math.trunc(t / 10))))}</span>`;
      }).join('');
      return `<div class="at-axis" aria-hidden="true"><span class="at-axis-spacer"></span><span class="at-axis-track"><span class="at-plot">${labels}</span></span><span class="at-axis-unit">${escapeHTML(config.views[view].unit)}</span></div>`;
    }

    function detail(s) {
      const rows = [
        ['Clean accuracy', `${s.clean} ± ${s.cleanSd}`],
        ['With nearby evidence', `${s.aug} ± ${s.augSd}`],
        ['Accuracy drop', `${minus(s.drop)} ± ${s.dropSd} pp`],
        ['95% interval of the drop', `[${minus(s.ciLow)}, ${minus(s.ciHigh)}]`],
        ['RAA', `${s.raa} ± ${s.raaSd}`],
        ['RAA-C / RAA-F', `${s.raac} ± ${s.raacSd} / ${s.raaf} ± ${s.raafSd}`],
      ];
      const items = rows.map(([label, text]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(text)}</dd></div>`).join('');
      return `<div class="at-detail" data-at-detail><h4>${escapeHTML(name(s))}</h4><dl>${items}</dl><p class="at-caption">${tag('measured', 'Tables 1 and 7')} Percent unless marked pp; mean ± SD over three clean and three augmented runs on 100 questions.</p></div>`;
    }

    function verdictText(view) {
      const chosen = settings.find((s) => s.id === state.selected);
      const n = settings.length;
      if (view === 'drop') {
        const drops = settings.map((s) => tenths(s.drop));
        const falls = drops.filter((d) => d > 0).length;
        const mean = fmt(Math.round(drops.reduce((a, b) => a + b, 0) / n));
        const groups = {above: [], spans: [], below: []};
        settings.forEach((s) => groups[status(s)].push(s));
        const below = groups.below.length ? ` (${groups.below.map(name).join('; ')})` : '';
        const where = {above: 'lies above zero', spans: 'includes zero', below: 'lies below zero, an accuracy gain'}[status(chosen)];
        return `Accuracy falls in ${falls} of ${n} settings; the mean of the ${n} printed drops is ${mean} pp. The 95% interval lies above zero in ${groups.above.length}, includes zero in ${groups.spans.length}, and lies below zero in ${groups.below.length}${below}. Selected: ${name(chosen)}, drop ${minus(chosen.drop)} pp, interval [${minus(chosen.ciLow)}, ${minus(chosen.ciHigh)}], which ${where}.`;
      }
      if (view === 'accuracy') {
        const peers = settings.filter((s) => s.bench === chosen.bench).sort((a, b) => tenths(b.clean) - tenths(a.clean) || paperIndex[a.id] - paperIndex[b.id]);
        const listed = peers.map((s) => `${config.models[s.model]} ${s.clean}% (drop ${minus(s.drop)} pp)`).join(', ');
        const peerDrops = peers.map((s) => tenths(s.drop));
        const top = peerDrops[0];
        let relation;
        if (top === Math.min(...peerDrops)) relation = peerDrops.filter((d) => d === top).length > 1 ? 'shares the smallest drop' : 'has the smallest drop';
        else if (top === Math.max(...peerDrops)) relation = 'has the largest drop';
        else relation = 'has neither the smallest nor the largest drop';
        const lower = settings.filter((s) => tenths(s.aug) < tenths(s.clean)).length;
        return `On ${config.benchmarks[chosen.bench]}, ordered by clean accuracy: ${listed}. The most accurate agent without nearby evidence ${relation} on this benchmark. Accuracy is lower with nearby evidence in ${lower} of ${n} settings.`;
      }
      const raa = settings.slice().sort((a, b) => tenths(a.raa) - tenths(b.raa) || paperIndex[a.id] - paperIndex[b.id]);
      const positive = settings.filter((s) => tenths(s.raa) > 0).length;
      const exceptions = settings.filter((s) => tenths(s.raaf) <= tenths(s.raac));
      const listed = join(exceptions.map((s) => `${name(s)} (RAA-C ${s.raac}%, RAA-F ${s.raaf}%)`));
      const tail = exceptions.length ? `; the exceptions are ${listed}.` : '.';
      return `Nearby-answer adoption is above zero in ${positive} of ${n} settings, from ${raa[0].raa}% (${name(raa[0])}) to ${raa[n - 1].raa}% (${name(raa[n - 1])}). RAA-F exceeds RAA-C in ${n - exceptions.length} of ${n} settings${tail} Selected: ${name(chosen)}, RAA ${chosen.raa}%, RAA-C ${chosen.raac}%, RAA-F ${chosen.raaf}%.`;
    }

    function render() {
      const view = state.view;
      const current = config.views[view];
      const orderLabel = state.order === 'value' ? current.sortLabel : config.orders[state.order].toLowerCase();
      // Rows become buttons once scripts run, so a reader can select a setting.
      const rows = ordered(view, state.order).map((s) => `<li><button type="button" class="${rowClass(s, view)}" data-setting="${escapeHTML(s.id)}" data-demo-action="select" aria-pressed="${s.id === state.selected}">${rowInner(s, view)}</button></li>`).join('');
      const [table, measured, computed] = config.captions[view];
      const caution = config.cautions[view] ? `<p class="at-caution">${escapeHTML(config.cautions[view])}</p>` : '';
      const chosen = settings.find((s) => s.id === state.selected);
      results.innerHTML = `<div class="at-block"><h4 data-at-view-title>${escapeHTML(current.title)} · ${escapeHTML(orderLabel)}</h4><p class="at-key">${escapeHTML(config.keys[view])}</p>${axis(view)}<ol class="at-rows" aria-label="${escapeHTML(current.title)}">${rows}</ol><p class="at-caption">${tag('measured', table)} ${escapeHTML(measured)} ${tag('computed')} ${escapeHTML(computed)}</p>${caution}</div>${detail(chosen)}`;
      verdict.textContent = verdictText(view);
      root.querySelectorAll('[data-demo-action^="view:"], [data-demo-action^="order:"]').forEach((button) => {
        const [key, valueKey] = button.dataset.demoAction.split(':');
        button.setAttribute('aria-pressed', String(state[key] === valueKey));
      });
    }

    root.querySelectorAll('[data-demo-action^="view:"], [data-demo-action^="order:"]').forEach((button) => button.addEventListener('click', () => {
      const [key, valueKey] = button.dataset.demoAction.split(':');
      state[key] = valueKey;
      render();
    }));
    // Row buttons are re-rendered on every change, so selection is delegated.
    results.addEventListener('click', (event) => {
      const row = event.target.closest('[data-demo-action="select"]');
      if (!row || !results.contains(row)) return;
      state.selected = row.dataset.setting;
      render();
      const again = results.querySelector(`[data-setting="${row.dataset.setting}"]`);
      if (again) again.focus({preventScroll: true});
    });
    render();
  }

  const initializers = {'lazy-grounding-settings': initializeLazyGrounding};
  document.querySelectorAll('.attacks-demo[data-paper-demo]').forEach((root) => {
    if (root.dataset.demoReady) return;
    const initialize = initializers[root.dataset.attacksDemo];
    const config = root.querySelector('.at-config');
    if (!initialize || !config || !root.querySelector('[data-at-results]')) return;
    try {
      initialize(root, JSON.parse(config.textContent));
      root.dataset.demoReady = 'true';
      root.querySelectorAll('[data-demo-controls]').forEach((controls) => { controls.hidden = false; });
    } catch (error) {
      // The static state remains readable if enhancement cannot initialize.
      console.warn('Attacks demo could not initialize:', error);
    }
  });
})();
