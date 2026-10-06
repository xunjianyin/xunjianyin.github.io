/* Coding Agents are Effective Long-Context Processors (arXiv 2603.20432v1): what does the
 * abstract's "17.3% on average" compare? The server renders the default comparison (best
 * coding agent per benchmark vs Best Published); this script reveals the row choices and
 * re-renders the same markup from data-demo-config with the same arithmetic as
 * scripts/paper_demo_longcontext.py. Scores are Table 1, costs Table 5; differences,
 * relative changes, mean and median are computed. Nothing moves on load, no model or
 * network is called, and the only transition (bar width) is removed under reduced motion.
 */
(() => {
  "use strict";

  const MINUS = "−";
  const BEST = "best";
  const STRONGEST = "strongest";

  const num = (printed) => (printed === null || printed === undefined ? null : Number(printed));

  function signed(value, digits) {
    let text = (value >= 0 ? "+" : "") + value.toFixed(digits);
    if (Number(text) === 0) text = (0).toFixed(digits);
    return text.replace("-", MINUS);
  }

  function join(items) {
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  }

  const rowsFor = (config, side) => (side === "agent" ? config.agents : config.references);

  function choiceLabel(config, side, choice) {
    if (config.choice_labels[choice]) return config.choice_labels[choice];
    return rowsFor(config, side).find((row) => row.key === choice).label;
  }

  /* The Table 1 row that supplies one benchmark's score, or null where it prints none.
   * Composite choices take the highest score; ties keep the first row in table order. */
  function pick(config, side, choice, index) {
    const rows = rowsFor(config, side);
    if (choice === BEST || choice === STRONGEST) {
      const candidates = choice === BEST ? rows : rows.filter((row) => row.rerun);
      let chosen = null;
      candidates.forEach((row) => {
        const value = num(row.scores[index]);
        if (value !== null && (chosen === null || value > num(chosen.scores[index]))) chosen = row;
      });
      return chosen;
    }
    const row = rows.find((item) => item.key === choice);
    return row.scores[index] !== null ? row : null;
  }

  function compare(config, agent, reference) {
    return config.benchmarks.map((bench, index) => {
      const aRow = pick(config, "agent", agent, index);
      const rRow = pick(config, "reference", reference, index);
      const a = aRow ? aRow.scores[index] : null;
      const r = rRow ? rRow.scores[index] : null;
      const entry = {
        key: bench.key, label: bench.label, unit: bench.unit,
        a, aRow: aRow ? aRow.label : choiceLabel(config, "agent", agent),
        r, rRow: rRow ? rRow.label : choiceLabel(config, "reference", reference),
        aCost: aRow ? aRow.costs[index] : null,
        rCost: rRow ? rRow.costs[index] : null,
        fullSet: Boolean(rRow && rRow.full_set && rRow.full_set[index]),
        diff: null, rel: null,
      };
      if (a !== null && r !== null) {
        entry.diff = num(a) - num(r);
        entry.rel = (num(a) - num(r)) / num(r) * 100;
      }
      return entry;
    });
  }

  function median(values) {
    const sorted = values.slice().sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function stats(rows) {
    const both = rows.filter((row) => row.rel !== null);
    const rels = both.map((row) => row.rel);
    return {
      n: both.length,
      higher: both.filter((row) => row.diff > 0).length,
      mean: rels.length ? rels.reduce((sum, value) => sum + value, 0) / rels.length : null,
      median: rels.length ? median(rels) : null,
    };
  }

  function groups(rows, valueKey, rowKey) {
    const order = [];
    const benches = {};
    rows.forEach((row) => {
      if (row[valueKey] === null) return;
      const name = row[rowKey];
      if (!benches[name]) { order.push(name); benches[name] = []; }
      benches[name].push(row.label);
    });
    return order.map((name) => `${name} on ${join(benches[name])}`).join("; ");
  }

  function summary(config, agent, reference) {
    const rows = compare(config, agent, reference);
    const both = rows.filter((row) => row.rel !== null);
    const aName = choiceLabel(config, "agent", agent);
    const rName = choiceLabel(config, "reference", reference);
    if (!both.length) return `${aName} and ${rName} share no benchmark in Table 1.`;
    const s = stats(rows);
    const lower = both.filter((row) => row.diff < 0).map((row) => row.label);
    const tied = both.filter((row) => row.diff === 0).map((row) => row.label);
    let text = `${aName} vs ${rName}: higher on ${s.higher} of ${s.n} benchmarks`;
    if (lower.length) text += `, lower on ${join(lower)}`;
    if (tied.length) text += `, tied on ${join(tied)}`;
    text += ".";
    const mean = signed(s.mean, 1);
    text += ` Mean relative change ${mean}%`;
    if (agent === config.initial.agent && reference === config.initial.reference && mean === "+" + config.headline) {
      text += ", matching the abstract";
    }
    const largest = both.reduce((best, row) => (Math.abs(row.rel) > Math.abs(best.rel) ? row : best), both[0]);
    if (both.length > 1) {
      text += `; the largest term is ${largest.label} at ${signed(largest.rel, 1)}% (${signed(largest.diff, 2)} ${largest.unit})`;
    }
    text += ".";
    if (agent === BEST && reference === "published" && both.length === rows.length) {
      const rounded = rows.map((row) => signed(row.rel, 0) + "%");
      if (rounded.join("|") === config.figure1_labels.join("|")) {
        text += ` Rounded, the five terms are Figure 1’s labels (${rounded.join(", ")}).`;
      }
    }
    if (agent === BEST) text += ` Best per benchmark takes ${groups(rows, "a", "aRow")}.`;
    if (reference === STRONGEST) text += ` Strongest re-run baseline: ${groups(rows, "r", "rRow")}.`;
    const full = both.filter((row) => row.fullSet);
    if (full.length) {
      text += ` ${full.length} of the ${both.length} reference scores (*) were measured on the full test set, not on the paper’s 200-question sample.`;
    }
    const costs = both.filter((row) => row.aCost !== null && row.rCost !== null);
    if (costs.length) {
      const cheaper = costs.filter((row) => num(row.aCost) < num(row.rCost)).length;
      const ratios = costs.map((row) => num(row.aCost) / num(row.rCost));
      const low = Math.min(...ratios).toFixed(2);
      const span = costs.length === 1 ? `${low}×` : `${low}–${Math.max(...ratios).toFixed(2)}×`;
      text += ` Cost per query (Table 5): the agent is cheaper on ${cheaper} of ${costs.length} benchmarks; its cost is ${span} the reference’s.`;
    } else if (reference === "published") {
      text += " Table 5 lists no cost for best published results.";
    }
    const missing = rows.filter((row) => row.rel === null).map((row) => row.label);
    if (missing.length) text += ` No comparison on ${join(missing)}: Table 1 prints no score there for one of the two rows.`;
    return text;
  }

  const width = (printed) => (printed !== null ? Number(printed).toFixed(2) : "0");

  function rowHtml(bench, row) {
    const outcome = row.diff === null ? "none" : row.diff > 0 ? "higher" : row.diff < 0 ? "lower" : "tie";
    const a = row.a !== null ? row.a : "–";
    const r = row.r !== null ? row.r + (row.fullSet ? "*" : "") : "–";
    const diff = row.diff !== null ? `${signed(row.diff, 2)} ${row.unit}` : "–";
    const rel = row.rel !== null ? `${signed(row.rel, 1)}%` : "–";
    const aCost = row.aCost !== null ? `$${row.aCost}` : "–";
    const rCost = row.rCost !== null ? `$${row.rCost}` : "–";
    return `<li class="lc-row" data-lc-bench="${esc(bench.key)}" data-outcome="${outcome}">`
      + `<div class="lc-bench"><span class="lc-bench-name">${esc(bench.label)}</span>`
      + `<span class="lc-bench-meta">${esc(bench.context)} tokens · ${esc(bench.metric)}</span></div>`
      + `<div class="lc-pair">`
      + `<div class="lc-line is-agent"><span class="lc-who" data-lc-agent-row>${esc(row.aRow)}</span>`
      + `<span class="lc-track" aria-hidden="true"><i style="width:${width(row.a)}%"></i></span>`
      + `<span class="lc-value" data-lc-agent>${esc(a)}</span></div>`
      + `<div class="lc-line is-ref"><span class="lc-who" data-lc-ref-row>${esc(row.rRow)}</span>`
      + `<span class="lc-track" aria-hidden="true"><i style="width:${width(row.r)}%"></i></span>`
      + `<span class="lc-value" data-lc-ref>${esc(r)}</span></div></div>`
      + `<div class="lc-cell"><span class="lc-cell-label">Difference</span><span class="lc-value" data-lc-diff>${esc(diff)}</span></div>`
      + `<div class="lc-cell"><span class="lc-cell-label">Relative</span><span class="lc-value lc-rel" data-lc-rel>${esc(rel)}</span></div>`
      + `<div class="lc-cell"><span class="lc-cell-label">Cost per query</span><span class="lc-value" data-lc-cost>${esc(aCost)} vs ${esc(rCost)}</span></div>`
      + `</li>`;
  }

  function statsHtml(rows) {
    const s = stats(rows);
    const mean = s.mean !== null ? `${signed(s.mean, 1)}%` : "–";
    const mid = s.median !== null ? `${signed(s.median, 1)}%` : "–";
    return `<div><dt>Mean relative change</dt><dd data-lc-stat="mean">${esc(mean)}</dd></div>`
      + `<div><dt>Median</dt><dd data-lc-stat="median">${esc(mid)}</dd></div>`
      + `<div><dt>Agent higher</dt><dd data-lc-stat="higher">${s.higher} of ${s.n}</dd></div>`;
  }

  /* Update rows in place so that bar widths can change (a short transition, none under
   * reduced motion); rebuild a row only if the list does not match the configuration. */
  function renderRows(root, config, rows) {
    const list = root.querySelector("[data-lc-rows]");
    const scratch = document.createElement("ol");
    scratch.innerHTML = config.benchmarks.map((bench, i) => rowHtml(bench, rows[i])).join("");
    const fresh = Array.from(scratch.children);
    const current = Array.from(list.children);
    if (current.length !== fresh.length) {
      list.replaceChildren(...fresh);
      return;
    }
    fresh.forEach((next, i) => {
      const old = current[i];
      if (old.dataset.lcBench !== next.dataset.lcBench) { old.replaceWith(next); return; }
      old.dataset.outcome = next.dataset.outcome;
      const oldBars = old.querySelectorAll(".lc-track i");
      next.querySelectorAll(".lc-track i").forEach((bar, j) => { oldBars[j].style.width = bar.style.width; });
      ["[data-lc-agent-row]", "[data-lc-agent]", "[data-lc-ref-row]", "[data-lc-ref]", "[data-lc-diff]", "[data-lc-rel]", "[data-lc-cost]"]
        .forEach((selector) => {
          const value = next.querySelector(selector).textContent;
          const target = old.querySelector(selector);
          if (target.textContent !== value) target.textContent = value;
        });
    });
  }

  function attach(root, config) {
    let agent = config.initial.agent;
    let reference = config.initial.reference;

    function update() {
      root.querySelectorAll('[data-demo-action="lc-agent"]').forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.value === agent));
      });
      root.querySelectorAll('[data-demo-action="lc-ref"]').forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.value === reference));
      });
      const rows = compare(config, agent, reference);
      renderRows(root, config, rows);
      root.querySelector("[data-lc-stats]").innerHTML = statsHtml(rows);
      root.querySelector("[data-lc-status]").textContent = summary(config, agent, reference);
      root.dataset.agent = agent;
      root.dataset.reference = reference;
    }

    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-demo-action]");
      if (!button || !root.contains(button)) return;
      if (button.dataset.demoAction === "lc-agent") agent = button.dataset.value;
      else if (button.dataset.demoAction === "lc-ref") reference = button.dataset.value;
      else return;
      update();
    });
    update();
  }

  function initialize() {
    document.querySelectorAll('[data-paper-demo="longcontext-headline"]').forEach((root) => {
      if (root.dataset.demoReady === "true") return;
      try {
        attach(root, JSON.parse(root.dataset.demoConfig));
        root.dataset.demoReady = "true";
        root.querySelectorAll("[data-demo-controls]").forEach((controls) => { controls.hidden = false; });
      } catch (error) {
        console.warn("Long-context demo could not initialize.", error);
      }
    });
  }

  // Exposed for the browser test harness.
  window.LongContextDemo = Object.freeze({ pick, compare, stats, summary, signed });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
