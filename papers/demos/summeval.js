/* ChatGPT versus automatic metrics (arXiv 2304.02554, Tables 1–5).
 * The browser repeats scripts/paper_demo_summeval.py on the reader's choice of column.
 * The server-rendered state is complete; this script only adds controls.
 * Printed values stay strings as printed; comparisons use integers in units of 1e-4.
 * No motion, no network requests, no model inference.
 */
(() => {
  'use strict';
  const UNIT = 10000;
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const minus = (text) => String(text).replace(/-/g, '−');
  const units = (text) => Math.round(Number(text) * UNIT);
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const signed = (diff, kind) => {
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
    return kind === 'rho' ? `${sign}${(Math.abs(diff) / UNIT).toFixed(3)}` : `${sign}${(Math.abs(diff) / 100).toFixed(2)} pp`;
  };
  const magnitude = (diff, kind) => (kind === 'rho' ? (Math.abs(diff) / UNIT).toFixed(3) : `${(Math.abs(diff) / 100).toFixed(2)} pp`);

  function initialize(root, config) {
    const results = root.querySelector('[data-se-results]');
    const verdictEl = root.querySelector('[data-se-verdict]');
    const dimsRow = root.querySelector('[data-se-dims]');
    const levelsRow = root.querySelector('[data-se-levels]');
    const datasets = config.datasets;
    const levels = config.levels;
    const dataset = (id) => datasets.find((d) => d.id === id);

    // The 28 printed columns, in the same order as columns() in Python.
    const columns = [];
    datasets.forEach((data) => {
      if (data.dims.length) {
        data.dims.forEach((dim, d) => levels.forEach((level, l) => columns.push({id: `${data.id}:${d}:${l}`, dataset: data.id, dim: d, level: l, index: d * 3 + l, label: `${dim} · ${level} level`})));
      } else {
        columns.push({id: `${data.id}:0:0`, dataset: data.id, dim: 0, level: 0, index: 0, label: 'Accuracy'});
      }
    });
    const column = (id) => columns.find((c) => c.id === id);
    const values = (col) => dataset(col.dataset).rows.map(([name, list]) => [name, list[col.index]]);
    const label = (col) => {
      const data = dataset(col.dataset);
      return data.dims.length ? `${data.name} · ${col.label}` : `${data.name} · ${data.protocol}`;
    };

    function assess(col) {
      const vals = values(col);
      const chatText = vals.find(([name]) => name === 'ChatGPT')[1];
      const chat = units(chatText);
      const others = vals.filter(([name]) => name !== 'ChatGPT');
      // The first printed row wins a tie, as max() does in Python.
      const best = others.reduce((top, item) => (units(item[1]) > units(top[1]) ? item : top));
      const above = others.filter(([, text]) => units(text) > chat).sort((a, b) => units(b[1]) - units(a[1]));
      return {rank: above.length + 1, n: vals.length, chat: chatText, best: best[0], bestValue: best[1], diff: chat - units(best[1]), above};
    }

    function scoreboard() {
      const cells = columns.map((col) => ({id: col.id, dataset: col.dataset, diff: assess(col).diff}));
      const trails = cells.filter((c) => c.diff < 0);
      const trailDatasets = datasets.filter((d) => trails.some((c) => c.dataset === d.id));
      return {
        cells, total: cells.length, leads: cells.filter((c) => c.diff > 0).length, trails: trails.length,
        trailCounts: trailDatasets.map((d) => [d.name, trails.filter((c) => c.dataset === d.id).length]),
      };
    }

    function tieNote(col) {
      const counts = new Map();
      values(col).forEach(([, text]) => {
        const key = units(text);
        if (!counts.has(key)) counts.set(key, []);
        counts.get(key).push(text);
      });
      const shared = [...counts.values()].filter((texts) => texts.length >= 3).map((texts) => [texts.length, texts[0]]);
      shared.sort((a, b) => b[0] - a[0]);
      if (!shared.length) return '';
      return `Ties as printed: ${shared.map(([count, text]) => `${count} rows print ${minus(text)}`).join(', ')}.`;
    }

    function verdict(col) {
      const data = dataset(col.dataset);
      const result = assess(col);
      let text = `${label(col)} (${data.table}). ChatGPT ${minus(result.chat)} ranks ${result.rank} of ${result.n}. `;
      if (result.diff > 0) {
        text += `The strongest other row is ${result.best} at ${minus(result.bestValue)}, so ChatGPT leads by ${magnitude(result.diff, data.kind)}. `;
      } else if (result.diff === 0) {
        text += `ChatGPT ties ${result.best} at ${minus(result.bestValue)}. `;
      } else {
        const count = result.above.length;
        const listed = result.above.map(([name, value]) => `${name} ${minus(value)}`).join(', ');
        text += `${count} row${count !== 1 ? 's' : ''} score${count !== 1 ? '' : 's'} higher: ${listed}; ChatGPT is ${magnitude(result.diff, data.kind)} below the top row. `;
      }
      const board = scoreboard();
      text += `Across all ${board.total} columns, ChatGPT is ahead of the strongest other row in ${board.leads} and behind it in ${board.trails}`;
      if (board.trails) {
        const counts = board.trailCounts.map(([name, count]) => `${name} ${count}`);
        text += counts.length > 1 ? ` (${counts.join(', ')}).` : `, all of them on ${board.trailCounts[0][0]}.`;
      } else {
        text += '.';
      }
      return text;
    }

    function bars(col) {
      const data = dataset(col.dataset);
      const vals = values(col);
      const order = vals.map(([name]) => name);
      const ranked = [...vals].sort((a, b) => units(b[1]) - units(a[1]) || order.indexOf(a[0]) - order.indexOf(b[0]));
      const numbers = vals.map(([, text]) => units(text));
      const low = Math.min(0, Math.floor(Math.min(...numbers) / 1000) * 1000);
      const high = Math.max(1000, Math.ceil(Math.max(...numbers) / 1000) * 1000);
      const span = high - low;
      const pct = (value) => `${((value - low) / span * 100).toFixed(2)}%`;
      const best = assess(col).best;
      const rows = ranked.map(([name, text]) => {
        const value = units(text);
        const [left, right] = [Math.min(0, value), Math.max(0, value)];
        const classes = `se-bar-row${name === 'ChatGPT' ? ' is-chatgpt' : name === best ? ' is-best' : ''}`;
        return `<li class="${classes}" data-row="${escapeHTML(name)}"><span class="se-bar-name">${escapeHTML(name)}<small>${escapeHTML(config.groups[name])}</small></span>`
          + `<span class="se-bar-track" aria-hidden="true"><i class="se-bar-zero" style="left:${pct(0)}"></i>`
          + `<i class="se-bar-fill" style="left:${pct(left)};width:${((right - left) / span * 100).toFixed(2)}%"></i></span>`
          + `<span class="se-bar-value" data-value="${escapeHTML(name)}">${minus(text)}</span></li>`;
      }).join('');
      const title = label(col) + (data.kind === 'rho' ? ' · Spearman ρ' : ' · accuracy');
      const key = '<p class="se-key"><span><i class="se-swatch is-chatgpt" aria-hidden="true"></i>ChatGPT</span><span><i class="se-swatch is-best" aria-hidden="true"></i>Strongest other row</span></p>';
      const notes = [key, `<p class="se-caption"><span class="se-tag se-tag-measured">Measured · ${escapeHTML(data.table)}</span> ${escapeHTML(data.judged)}</p>`];
      const caution = config.cautions[data.dims.length ? `${data.id}:${data.dims[col.dim]}` : data.id] || '';
      if (caution) notes.push(`<p class="se-caution" data-se-caution>${escapeHTML(caution)}</p>`);
      const ties = tieNote(col);
      if (ties) notes.push(`<p class="se-caption" data-se-ties>${escapeHTML(ties)}</p>`);
      if (data.id === 'tldr') {
        const sorted = [...vals].sort((a, b) => units(a[1]) - units(b[1]));
        notes.push(`<p class="se-caption"><span class="se-tag se-tag-derived">Derived</span> Picking one of two summaries at random is right half the time in expectation, so 0.5 is chance level; the printed accuracies range from ${sorted[0][1]} to ${sorted[sorted.length - 1][1]}.</p>`);
      }
      return `<div class="se-block se-chart"><h4 data-se-title>${escapeHTML(title)}</h4>`
        + `<p class="se-axis" aria-hidden="true"><span>${minus((low / UNIT).toFixed(1))}</span><span>${minus((high / UNIT).toFixed(1))}</span></p>`
        + `<ol class="se-bars" aria-label="${escapeHTML(title)}, highest first">${rows}</ol>${notes.join('')}</div>`;
    }

    function grid(current) {
      const cell = (col, cellLabel) => {
        const data = dataset(col.dataset);
        const diff = assess(col).diff;
        const classes = `se-cell${diff < 0 ? ' is-behind' : diff === 0 ? ' is-tie' : ''}${col.id === current ? ' is-current' : ''}`;
        const name = `${data.name}, ${cellLabel}: ChatGPT minus the strongest other row ${signed(diff, data.kind)}`;
        return `<button type="button" class="${classes}" data-se-col="${col.id}" aria-pressed="${col.id === current}" aria-label="${escapeHTML(name)}"><span class="se-cell-label">${escapeHTML(cellLabel)}</span><strong>${signed(diff, data.kind)}</strong></button>`;
      };
      const blocks = datasets.filter((data) => data.dims.length).map((data) => {
        const head = levels.map((level) => `<th scope="col">${escapeHTML(capitalize(level))}</th>`).join('');
        const body = data.dims.map((dim, d) => `<tr><th scope="row">${escapeHTML(dim)}</th>${levels.map((level, l) => `<td>${cell(column(`${data.id}:${d}:${l}`), `${dim}, ${level} level`)}</td>`).join('')}</tr>`).join('');
        return `<div class="se-matrix-wrap"><table class="se-matrix"><caption>${escapeHTML(data.name)} · ${escapeHTML(data.table)} · Spearman ρ</caption><thead><tr><td></td>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
      }).join('');
      const singles = datasets.filter((data) => !data.dims.length).map((data) => `<li><span class="se-single-name">${escapeHTML(data.name)}<small>${escapeHTML(data.table)} · ${escapeHTML(data.protocol)}</small></span>${cell(column(`${data.id}:0:0`), 'Accuracy')}</li>`).join('');
      const board = scoreboard();
      return `<div class="se-block se-board"><h4>ChatGPT minus the strongest other row, all ${board.total} columns</h4>`
        + `<div class="se-matrices">${blocks}</div><ul class="se-singles">${singles}</ul>`
        + `<p class="se-caption"><span class="se-tag se-tag-computed">Computed</span> from the printed values: correlation margins in Spearman ρ, accuracy margins in percentage points (pp). Warm cells are columns where a metric is ahead of ChatGPT: ${board.trails} of ${board.total}.</p></div>`;
    }

    let current = config.default;
    const setPressed = (selector, predicate) => root.querySelectorAll(selector).forEach((button) => button.setAttribute('aria-pressed', String(predicate(button))));

    function render() {
      const col = column(current);
      const data = dataset(col.dataset);
      results.innerHTML = grid(current) + bars(col);
      verdictEl.textContent = verdict(col);
      setPressed('[data-demo-action^="dataset:"]', (button) => button.dataset.demoAction === `dataset:${data.id}`);
      // Dimension and level choices exist only for the two Likert datasets.
      dimsRow.hidden = levelsRow.hidden = !data.dims.length;
      if (data.dims.length) {
        const groupLabel = dimsRow.querySelector('.se-group-label').outerHTML;
        dimsRow.innerHTML = groupLabel + data.dims.map((dim, d) => `<button type="button" data-demo-action="dim:${d}" aria-pressed="${d === col.dim}">${escapeHTML(dim)}</button>`).join('');
        setPressed('[data-demo-action^="level:"]', (button) => button.dataset.demoAction === `level:${col.level}`);
      }
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || !root.contains(button) || button.disabled) return;
      const col = column(current);
      const action = button.dataset.demoAction || '';
      if (action.startsWith('dataset:')) {
        // A Likert dataset keeps the current dimension index and level; an accuracy dataset has one column.
        const data = dataset(action.slice(8));
        current = data.dims.length ? `${data.id}:${dataset(col.dataset).dims.length ? col.dim : 0}:${dataset(col.dataset).dims.length ? col.level : 0}` : `${data.id}:0:0`;
      } else if (action.startsWith('dim:')) {
        current = `${col.dataset}:${action.slice(4)}:${col.level}`;
      } else if (action.startsWith('level:')) {
        current = `${col.dataset}:${col.dim}:${action.slice(6)}`;
      } else if (button.dataset.seCol) {
        current = button.dataset.seCol;
        render();
        const again = root.querySelector(`.se-cell[data-se-col="${current}"]`);
        if (again) again.focus();
        return;
      } else {
        return;
      }
      render();
    });
    render();
  }

  document.querySelectorAll('.summeval-demo[data-paper-demo]').forEach((root) => {
    if (root.dataset.demoReady) return;
    const config = root.querySelector('.se-config');
    if (!config || !root.querySelector('[data-se-results]')) return;
    try {
      initialize(root, JSON.parse(config.textContent));
      root.dataset.demoReady = 'true';
      root.querySelectorAll('[data-demo-controls]').forEach((controls) => { controls.hidden = false; });
    } catch (error) {
      // The static state remains readable if enhancement cannot initialize.
      console.warn('Summarization evaluation demo could not initialize:', error);
    }
  });
})();
