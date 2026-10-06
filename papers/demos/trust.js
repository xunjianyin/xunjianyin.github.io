/* Epistemic Context Learning evidence explorer (arXiv 2601.21742).
 * The page is complete without this script: scripts/paper_demo_trust.py renders the default
 * view. This script reveals the controls and repeats the same computation for the view the
 * reader chooses: printed accuracies from Tables 6, 10 and 14, differences in percentage points
 * and whole test questions (Table 7), and the GPQA split behind Tables 8 and 11.
 * No motion, no network or model calls.
 */
(() => {
  'use strict';

  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[ch]));

  /* ---------------- Arithmetic on printed values (mirrors the Python module) ---------------- */

  // A printed percentage such as '85.6' in tenths of a point (856).
  const tenths = text => {
    const [whole, fraction = ''] = String(text).split('.');
    return Number(whole) * 10 + Number((fraction + '0')[0]);
  };
  // Whole test questions behind a printed percentage.
  const questions = (text, n) => Math.floor(tenths(text) * n / 1000 + 0.5);
  const signedPp = diff => `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.floor(Math.abs(diff) / 10)}.${Math.abs(diff) % 10} pp`;
  const signedCount = diff => `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}`;
  const tenthsText = value => `${Math.floor(value / 10)}.${value % 10}`;

  function viewRows(data, bench, setting, context) {
    const offset = context === 'outcome' ? 1 : 4;
    const rows = [];
    for (const model of data.models) {
      const key = model.id;
      const normal = data.table6[setting === 'flip' || setting === 'allwrong' ? 'adversarial' : setting][bench][key];
      const row = { model: key, sa: normal[0], ag: normal[offset], ecli: normal[offset + 1], ecle: normal[offset + 2], was: {} };
      if (setting === 'flip') {
        if (!data.table10[bench][key]) continue;
        const [ag, ecli, ecliFlip, ecle, ecleFlip] = data.table10[bench][key][context];
        Object.assign(row, { ag, ecli: ecliFlip, ecle: ecleFlip, was: { ecli, ecle } });
      } else if (setting === 'allwrong') {
        if (!data.table14[key]) continue;
        const cells = data.table14[key][context];
        Object.assign(row, { ag: cells.ag[1], ecli: cells.ecli[1], ecle: cells.ecle[1], ecle_db: cells.ecle_db[1],
          was: { ag: cells.ag[0], ecli: cells.ecli[0], ecle: cells.ecle[0] } });
      }
      row.diff = tenths(row.ecle) - tenths(row.ag);
      rows.push(row);
    }
    return rows;
  }

  // Whole-question split behind Table 8's recognition rate and Table 11's two accuracies.
  const roundsTo = (k, total, printed) => total > 0 && Math.floor(k * 1000 / total + 0.5) === tenths(printed);
  function reconstruct(prr, accNamed, accOther, n = 40) {
    let best = null;
    const target = tenths(prr) * n;
    for (let named = 0; named <= n; named++) {
      const other = n - named;
      const hits = []; const misses = [];
      for (let k = 0; k <= named; k++) if (roundsTo(k, named, accNamed)) hits.push(k);
      for (let k = 0; k <= other; k++) if (roundsTo(k, other, accOther)) misses.push(k);
      if (!hits.length || !misses.length) continue;
      const distance = Math.abs(named * 1000 - target);
      if (best === null || distance < best[0]) best = [distance, named, hits[0], misses[0]];
    }
    const [, named, rightNamed, rightOther] = best;
    return { named, other: n - named, rightNamed, rightOther, exact: named * 1000 === target };
  }

  /* ---------------- Rendering (same markup and text as the Python module) ---------------- */

  // Column labels, repeated on each cell for the stacked phone layout.
  const LABELS = { sa: 'Single agent', ag: 'AG', ecli: 'ECL (I)', ecle: 'ECL (E)', diff: 'ECL (E) − AG' };

  function render(data) {
    const model = id => data.models.find(m => m.id === id);
    const bench = id => data.benchmarks.find(b => b.id === id);
    const setting = id => data.settings.find(s => s.id === id);
    const context = id => data.contexts.find(c => c.id === id);
    const trained = m => (m.trained ? 'RL-trained' : 'prompted only');
    const names = rows => {
      const list = rows.map(r => model(r.model).name);
      return list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    };

    const bar = diff => {
      const scale = data.diffScale;
      const clipped = Math.max(-scale, Math.min(scale, diff));
      const width = Math.abs(clipped) / scale * 50;
      const left = clipped >= 0 ? 50 : 50 - width;
      return `<span class="tr-bar" aria-hidden="true"><i class="tr-bar-zero"></i><i class="tr-bar-fill" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></i></span>`;
    };

    const cell = (row, key, extra = '') => {
      const notes = [];
      if (row.was[key]) notes.push(`was ${escapeHtml(row.was[key])}%`);
      if (key === 'ag' && tenths(row.ag) < tenths(row.sa)) { notes.push('below single agent'); extra += ' is-below-sa'; }
      return `<td class="num${extra}" data-tr-cell="${key}" data-label="${LABELS[key]}">${escapeHtml(row[key])}%${notes.map(n => `<small>${n}</small>`).join('')}</td>`;
    };

    function viewVerdict(benchId, settingId, rows) {
      const n = bench(benchId).n;
      const total = rows.length;
      const gains = rows.filter(r => r.diff > 0);
      const losses = rows.filter(r => r.diff < 0);
      const level = total - gains.length - losses.length;
      const delta = (oldValue, newValue) => `${signedPp(tenths(newValue) - tenths(oldValue))}, ${signedCount(questions(newValue, n) - questions(oldValue, n))} of ${n} questions`;
      const change = (row, oldValue, newValue) => `${model(row.model).name} ${oldValue}% → ${newValue}% (${delta(oldValue, newValue)})`;
      const versus = row => `${model(row.model).name}, ECL (E) ${row.ecle}% vs AG ${row.ag}% (${delta(row.ag, row.ecle)})`;
      // The first extreme wins ties, as Python's max and min do.
      const extreme = (list, score, sign) => list.reduce((best, r) => (sign * score(r) > sign * score(best) ? r : best), list[0]);
      if (settingId === 'natural' || settingId === 'adversarial') {
        let text = `ECL (E) is above AG for ${gains.length} of ${total} models, level for ${level} and below for ${losses.length}. `;
        if (gains.length) text += `Largest gain: ${versus(extreme(gains, r => r.diff, 1))}. `;
        if (losses.length) text += `Largest loss: ${versus(extreme(losses, r => r.diff, -1))}. `;
        const below = rows.filter(r => tenths(r.ag) < tenths(r.sa));
        if (below.length) text += `AG falls below the single agent for ${names(below)}. `;
        const small = rows.find(r => r.model === 'qwen4b');
        const large = rows.find(r => r.model === 'qwen30b');
        const relation = tenths(small.ecle) > tenths(large.ag) ? 'above' : tenths(small.ecle) < tenths(large.ag) ? 'below' : 'level with';
        text += `RL-trained Qwen 3-4B with ECL (E), ${small.ecle}%, is ${relation} prompted Qwen 3-30B with AG, ${large.ag}%.`;
        return text;
      }
      if (settingId === 'flip') {
        const dropped = rows.filter(r => tenths(r.ecle) < tenths(r.was.ecle));
        const under = rows.filter(r => r.diff < 0);
        const drop = r => tenths(r.ecle) - tenths(r.was.ecle);
        const worst = extreme(rows, drop, -1);
        const least = extreme(rows, drop, 1);
        return `After the flip, ECL (E) is lower for ${dropped.length} of ${total} models and below AG for ${under.length}. `
          + `Largest drop: ${change(worst, worst.was.ecle, worst.ecle)}. `
          + `Smallest change: ${change(least, least.was.ecle, least.ecle)}. `
          + 'The paper reads such drops as evidence that ECL answers by following the peer it identified from the history (Appendix D.3).';
      }
      const agFell = rows.filter(r => tenths(r.ag) < tenths(r.was.ag));
      const under = rows.filter(r => r.diff <= 0);
      const worst = extreme(rows, r => r.diff, -1);
      const db = rows.map(r => `${model(r.model).name} ${r.ecle_db}%`).join('; ');
      return `With every peer wrong, AG falls for ${agFell.length} of ${total} models, and ECL (E) is at or below AG for ${under.length} of ${total}. `
        + `Largest gap: ${versus(worst)}. Adding the agent’s own independent answer as an input (decoupled belief, Appendix E) gives ECL (E) ${db}.`;
    }

    // Name any unflipped Table 10 value that differs from the same cell of Table 6.
    function flipMismatch(benchId, contextId) {
      const offset = contextId === 'outcome' ? 1 : 4;
      const notes = [];
      for (const [key, cells] of Object.entries(data.table10[benchId])) {
        const [ag, ecli, , ecle] = cells[contextId];
        const normal = data.table6.adversarial[benchId][key];
        for (const [label, printed, other] of [['AG', ag, normal[offset]], ['ECL (I)', ecli, normal[offset + 1]], ['ECL (E)', ecle, normal[offset + 2]]]) {
          if (printed !== other) notes.push(`${model(key).name}, ${label}: ${printed}% in Table 10 vs ${other}% in Table 6`);
        }
      }
      return notes.length ? ` The two tables disagree for ${notes.join('; ')}.` : '';
    }

    function viewState(benchId, settingId, contextId) {
      const b = bench(benchId); const s = setting(settingId); const c = context(contextId);
      const n = b.n;
      const rows = viewRows(data, benchId, settingId, contextId);
      const body = rows.map(row => {
        const m = model(row.model);
        const state = row.diff > 0 ? 'is-gain' : row.diff < 0 ? 'is-loss' : 'is-level';
        const qDiff = questions(row.ecle, n) - questions(row.ag, n);
        return `<tr class="${state}" data-model="${m.id}"><th scope="row">${escapeHtml(m.name)}<small>${trained(m)}</small></th>`
          + `<td class="num" data-tr-cell="sa" data-label="${LABELS.sa}">${escapeHtml(row.sa)}%</td>${cell(row, 'ag')}${cell(row, 'ecli')}${cell(row, 'ecle', ' is-ecl')}`
          + `<td class="tr-diff" data-tr-cell="diff" data-label="${LABELS.diff}">${bar(row.diff)}<span class="tr-diff-text">${signedPp(row.diff)}</span>`
          + `<small>${signedCount(qDiff)} of ${n} questions</small></td></tr>`;
      }).join('');
      const title = `${b.name} · ${s.label} · ${c.name} (${c.short})`;
      const head = '<thead><tr><th scope="col">Model</th><th scope="col" class="num">Single agent</th>'
        + '<th scope="col" class="num">AG</th><th scope="col" class="num">ECL (I)</th>'
        + '<th scope="col" class="num">ECL (E)</th><th scope="col">ECL (E) − AG</th></tr></thead>';
      const stress = {
        flip: ' Under Flip the history is unchanged, so AG (which sees no history) keeps its printed value; “was” gives each ECL value before the flip, as printed in Table 10.'
          + flipMismatch(benchId, contextId),
        allwrong: ' “was” gives each value before every peer answered wrongly. Only three models were tested.',
      };
      const caption = `<p class="tr-caption"><span class="tr-tag is-measured">Measured · ${s.table}</span> final-answer accuracy, `
        + 'as printed; Single agent from Table 6 (no peers, so the peer setting does not change it). '
        + '<span class="tr-tag is-computed">Computed</span> ECL (E) − AG in percentage points and in whole test '
        + `questions out of ${n} (Table 7).${stress[settingId] || ''}</p>`;
      const html = `<div class="tr-block"><h4 data-tr-view-title>${escapeHtml(title)}</h4>`
        + '<div class="tr-table-scroll" tabindex="0" role="region" aria-label="Accuracy by model; scroll sideways on narrow screens">'
        + `<table class="tr-table">${head}<tbody>${body}</tbody></table></div>${caption}</div>`;
      return [html, viewVerdict(benchId, settingId, rows)];
    }

    function splitState(contextId) {
      const index = contextId === 'outcome' ? 0 : 1;
      const c = context(contextId);
      let higher = 0;
      let smallest = null;
      const items = Object.keys(data.table8).map(key => {
        const m = model(key);
        const prr = data.table8[key][index];
        const [accNamed, accOther] = data.table11[key][contextId];
        const split = reconstruct(prr, accNamed, accOther);
        const total = split.rightNamed + split.rightOther;
        const printed = data.table10.gpqa[key][contextId][3];
        const match = total * 25 === tenths(printed);
        if (tenths(accNamed) > tenths(accOther)) higher += 1;
        if (smallest === null || split.other < smallest[1]) smallest = [m.name, split.other];
        const squares = [
          ...Array(split.rightNamed).fill('<i class="is-named is-right"></i>'),
          ...Array(split.named - split.rightNamed).fill('<i class="is-named"></i>'),
          '<i class="tr-gap"></i>',
          ...Array(split.rightOther).fill('<i class="is-other is-right"></i>'),
          ...Array(split.other - split.rightOther).fill('<i class="is-other"></i>'),
        ].join('');
        const prrNote = split.exact ? '' : ` Table 8 prints ${prr}%, which is not a whole number of the 40 questions; `
          + `${split.named} questions (${tenthsText(split.named * 25)}%) reproduce both Table 11 values.`;
        const check = match ? 'as printed in Table 10'
          : `Table 10 prints ${printed}% for ECL (E), one question ${total * 25 > tenths(printed) ? 'fewer' : 'more'}`;
        const label = `${m.name}: named the reliable peer on ${split.named} of 40 questions, ${split.rightNamed} answered correctly; `
          + `named another peer on ${split.other}, ${split.rightOther} correct.`;
        return `<li data-model="${key}"><p class="tr-strip-name">${escapeHtml(m.name)} <small>${trained(m)}</small></p>`
          + `<div class="tr-strip" role="img" aria-label="${escapeHtml(label)}">${squares}</div>`
          + `<p class="tr-strip-text">Named the reliable peer: <strong>${split.rightNamed} of ${split.named}</strong> right (${accNamed}%) · `
          + `named another: <strong>${split.rightOther} of ${split.other}</strong> right (${accOther}%) · `
          + `total ${total} of 40 = ${tenthsText(total * 25)}%, ${check}.${escapeHtml(prrNote)}</p></li>`;
      }).join('');
      const title = `GPQA · adversarial peers · ${c.name} (${c.short}) · ECL (E): did Stage 1 name the reliable peer?`;
      const legend = '<p class="tr-legend" aria-hidden="true"><span><i class="is-named is-right"></i>named the reliable peer, answer right</span>'
        + '<span><i class="is-named"></i>named it, answer wrong</span><span><i class="is-other is-right"></i>named another peer, answer right</span>'
        + '<span><i class="is-other"></i>named another, answer wrong</span></p>';
      const caption = '<p class="tr-caption"><span class="tr-tag is-measured">Measured · Tables 8, 10 and 11</span> recognition rate (PRR) and the two '
        + 'conditional accuracies, as printed. <span class="tr-tag is-computed">Computed</span> whole-question counts out of the 40 GPQA '
        + 'test questions that reproduce the printed percentages; each square is one question, ordered for display only. '
        + 'On MMLU-Pro the recognition rate is 82.2–100.0% for these models (Table 8), so the paper reports this split for GPQA only.</p>';
      const html = `<div class="tr-block tr-split"><h4 data-tr-split-title>${escapeHtml(title)}</h4>${legend}`
        + `<ol class="tr-strips">${items}</ol>${caption}</div>`;
      const step = Math.floor(1000 / smallest[1]);
      const verdict = `Accuracy is higher after naming the reliable peer for ${higher} of ${Object.keys(data.table8).length} models. `
        + `The “named another peer” group is as small as ${smallest[1]} questions (${smallest[0]}), `
        + `where one question moves its accuracy by ${tenthsText(step)} pp.`;
      return [html, verdict];
    }

    return { viewState, splitState };
  }

  /* ---------------- Controls ---------------- */

  function attach(root) {
    const data = JSON.parse(root.querySelector('.tr-config').textContent);
    const view = render(data);
    const state = { ...data.default };
    const available = (bench, setting) => !(setting === 'allwrong' && bench !== 'gpqa');

    const update = () => {
      if (!available(state.bench, state.setting)) state.setting = 'adversarial';
      const [viewHtml, viewText] = view.viewState(state.bench, state.setting, state.context);
      const [splitHtml, splitText] = view.splitState(state.context);
      root.querySelector('[data-tr-view]').innerHTML = viewHtml;
      root.querySelector('[data-tr-view-verdict]').textContent = viewText;
      root.querySelector('[data-tr-split]').innerHTML = splitHtml;
      root.querySelector('[data-tr-split-verdict]').textContent = splitText;
      all(root, '[data-demo-action]').forEach(button => {
        const [kind, value] = button.dataset.demoAction.replace('tr-', '').split(':');
        button.setAttribute('aria-pressed', String(state[kind] === value));
        if (kind === 'setting') button.disabled = !available(state.bench, value);
      });
      root.dataset.trView = `${state.bench}|${state.setting}|${state.context}`;
    };

    all(root, '[data-demo-action]').forEach(button => {
      button.addEventListener('click', () => {
        const [kind, value] = button.dataset.demoAction.replace('tr-', '').split(':');
        if (button.disabled || state[kind] === value) return;
        state[kind] = value;
        update();
      });
    });
    update();
    root.querySelector('[data-demo-controls]').hidden = false;
  }

  function initialize() {
    all(document, '[data-trust-demo]').forEach(root => {
      if (root.dataset.trustReady === 'true') return;
      attach(root);
      root.dataset.trustReady = 'true';
    });
  }

  window.TrustDemo = Object.freeze({ tenths, questions, reconstruct, viewRows });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
