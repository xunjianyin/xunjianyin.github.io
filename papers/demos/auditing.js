/* Access-mode auditing demos (auditing-health-llms).
 * - auditing-overlap: the Section 5.5 within- versus cross-mode Jaccard procedure,
 *   applied to illustrative citation lists that the reader edits.
 * - auditing-contrasts: Tables A1–A3 as printed, marked at a reader-chosen
 *   p-value cut-off.
 * The server renders a complete state; this script reveals the controls and
 * recomputes the same quantities from data-demo-config. Nothing calls a model or
 * the network, and nothing animates. */
(() => {
  "use strict";

  const MINUS = "−";
  const ABSENT = "—";
  const NOT_TESTED = "n.t.";

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setText(root, selector, value) {
    root.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  function press(root, action, value) {
    root.querySelectorAll('[data-demo-action="' + action + '"]').forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === value));
    });
  }

  function onAction(root, handler) {
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-demo-action]");
      if (button && root.contains(button)) handler(button.dataset.demoAction, button.dataset.value, button);
    });
  }

  // Mirrors _fixed() in scripts/paper_demo_auditing.py: the offset makes exact
  // binary ties round up in both languages.
  function fixed(value, digits) {
    const text = (Math.abs(value) + 1e-9).toFixed(digits);
    const negative = value < 0 && Number(text) !== 0;
    return (negative ? MINUS : "") + text;
  }

  // Mirrors _signed().
  function signed(value, digits) {
    const text = fixed(value, digits);
    if (Number(text.replace(MINUS, "-")) === 0) return (0).toFixed(digits);
    return text.startsWith(MINUS) ? text : "+" + text;
  }

  function valueText(value, digits) {
    return value === null ? ABSENT : fixed(value, digits === undefined ? 3 : digits);
  }

  /* ---------------------------------------------------------------- Section 5.5: overlap procedure */

  const WITHIN_PAIRS = [[0, 1], [0, 2], [1, 2]];

  function jaccard(first, second) {
    const a = new Set(first);
    const b = new Set(second);
    const union = new Set([...a, ...b]);
    if (union.size === 0) return null;
    let shared = 0;
    a.forEach((item) => { if (b.has(item)) shared += 1; });
    return shared / union.size;
  }

  function mean(values) {
    const defined = values.filter((value) => value !== null);
    return defined.length ? defined.reduce((sum, value) => sum + value, 0) / defined.length : null;
  }

  // Mirrors overlap_state().
  function overlapState(runs) {
    const api = runs.api;
    const chatgpt = runs.chatgpt;
    const withinApi = WITHIN_PAIRS.map(([i, j]) => jaccard(api[i], api[j]));
    const withinChatgpt = WITHIN_PAIRS.map(([i, j]) => jaccard(chatgpt[i], chatgpt[j]));
    const cross = [];
    api.forEach((a) => chatgpt.forEach((c) => cross.push(jaccard(a, c))));
    const wa = mean(withinApi);
    const wc = mean(withinChatgpt);
    const cm = mean(cross);
    const baseline = wa !== null && wc !== null ? (wa + wc) / 2 : null;
    const delta = baseline !== null && cm !== null ? baseline - cm : null;
    return {
      within_api_pairs: withinApi, within_chatgpt_pairs: withinChatgpt, cross_pairs: cross,
      within_api: wa, within_chatgpt: wc, within: baseline, cross: cm, delta,
    };
  }

  // Mirrors overlap_status().
  function overlapStatus(state) {
    if (state.delta === null) {
      return "Overlap is undefined when neither run of a pair cites anything, and the paper excludes such " +
        "comparisons. Each mode needs at least one pair of runs with a citation, and so do the two modes together.";
    }
    const delta = signed(state.delta, 3);
    const head = "Within-mode baseline " + valueText(state.within) + ", cross-mode " + valueText(state.cross) +
      ": within minus cross is " + delta + ".";
    const number = Number(delta.replace(MINUS, "-"));
    if (number > 0) {
      return head + " Runs share fewer sources across access modes than between repeated runs in one mode. " +
        "A gap of this sign, consistent across questions, is what the paper's paired test detects.";
    }
    if (number === 0) {
      return head + " Cross-mode overlap is no lower than between repeated runs, so here the access mode adds " +
        "nothing beyond run-to-run variation: low cross-mode overlap on its own does not show an access-mode effect.";
    }
    return head + " Runs agree more across modes than within a mode. Every gap the paper reports is positive (Table A3).";
  }

  function copyRuns(runs) {
    return { api: runs.api.map((run) => run.slice().sort((a, b) => a - b)), chatgpt: runs.chatgpt.map((run) => run.slice().sort((a, b) => a - b)) };
  }

  function sameRuns(first, second) {
    return ["api", "chatgpt"].every((mode) => first[mode].every((run, i) => run.join() === second[mode][i].join()));
  }

  function attachOverlap(root, config) {
    const presets = config.presets;
    let runs = copyRuns(presets.find((preset) => preset.id === config.initial).runs);
    const labels = [];
    config.modes.forEach((mode) => [0, 1, 2].forEach((i) => labels.push(mode.label + " " + (i + 1))));

    function renderCites() {
      root.querySelectorAll("[data-au-run]").forEach((row) => {
        const [mode, index] = row.dataset.auRun.split("-");
        const run = runs[mode][Number(index)];
        row.querySelectorAll('[data-demo-action="au-cite"]').forEach((button) => {
          const on = run.includes(Number(button.dataset.source));
          button.setAttribute("aria-pressed", String(on));
          button.textContent = on ? "●" : "·";
          button.parentElement.classList.toggle("is-on", on);
        });
        row.querySelector("[data-au-count]").textContent = String(run.length);
      });
    }

    function renderPairs(state) {
      const values = new Map();
      WITHIN_PAIRS.forEach(([i, j], k) => values.set(j + "-" + i, [state.within_api_pairs[k], "within"]));
      WITHIN_PAIRS.forEach(([i, j], k) => values.set((j + 3) + "-" + (i + 3), [state.within_chatgpt_pairs[k], "within"]));
      state.cross_pairs.forEach((value, k) => values.set((3 + (k % 3)) + "-" + Math.floor(k / 3), [value, "cross"]));
      root.querySelectorAll("[data-au-pair]").forEach((cell) => {
        const [value, kind] = values.get(cell.dataset.auPair);
        cell.className = "au-pair is-" + kind;
        cell.style.setProperty("--au-shade", fixed(value === null ? 0 : value, 3));
        cell.textContent = valueText(value, 2);
      });
    }

    function render() {
      const state = overlapState(runs);
      renderCites();
      renderPairs(state);
      ["within_api", "within_chatgpt", "within", "cross"].forEach((key) => setText(root, '[data-au-out="' + key + '"]', valueText(state[key])));
      setText(root, '[data-au-out="delta"]', state.delta === null ? ABSENT : signed(state.delta, 3));
      setText(root, "[data-au-calc-status]", overlapStatus(state));
      const match = presets.find((preset) => sameRuns(copyRuns(preset.runs), runs));
      press(root, "au-preset", match ? match.id : "");
    }

    onAction(root, (action, value, button) => {
      if (action === "au-preset") {
        runs = copyRuns(presets.find((preset) => preset.id === value).runs);
      } else if (action === "au-cite") {
        const [mode, index] = button.dataset.run.split("-");
        const source = Number(button.dataset.source);
        const run = runs[mode][Number(index)];
        const position = run.indexOf(source);
        if (position >= 0) run.splice(position, 1);
        else {
          run.push(source);
          run.sort((a, b) => a - b);
        }
      } else {
        return;
      }
      render();
    });
    render();
  }

  /* ---------------------------------------------------------------- Tables A1–A3: contrasts */

  function significant(p, threshold) {
    if (p === null || p === undefined) return false;
    const cut = Number(threshold);
    if (p.startsWith("<")) return Number(p.slice(1)) <= cut;
    return Number(p) < cut;
  }

  function number(text) {
    return Number(text.replace(MINUS, "-"));
  }

  // Mirrors cell_state().
  function cellState(cell, threshold) {
    if (cell[0] === ABSENT) return "absent";
    if (cell[0] === NOT_TESTED) return "nt";
    if (!significant(cell[1], threshold)) return "ns";
    return number(cell[0]) > 0 ? "pos" : "neg";
  }

  // Mirrors version_direction(): ChatGPT vs API in GPT-5.3 (column 0) and GPT-5.4 (column 3).
  function versionDirection(feature, threshold) {
    const old = cellState(feature.contrasts[0], threshold);
    const next = cellState(feature.contrasts[3], threshold);
    if (old === "absent" || next === "absent") return "absent";
    const oldSig = old === "pos" || old === "neg";
    const newSig = next === "pos" || next === "neg";
    if (oldSig && newSig) return old === next ? "same" : "reverses";
    if (oldSig) return "old";
    if (newSig) return "new";
    return "neither";
  }

  const DIRECTION_LABELS = { same: "Same", reverses: "Reverses", old: "5.3 only", new: "5.4 only", neither: "Neither", absent: ABSENT };
  const DIRECTION_SENTENCES = {
    same: "The ChatGPT-vs-API difference keeps its direction from GPT-5.3 to GPT-5.4.",
    reverses: "The ChatGPT-vs-API difference reverses direction from GPT-5.3 to GPT-5.4.",
    old: "The ChatGPT-vs-API difference passes the cut-off in GPT-5.3 only.",
    new: "The ChatGPT-vs-API difference passes the cut-off in GPT-5.4 only.",
    neither: "Neither version's ChatGPT-vs-API difference passes the cut-off.",
    absent: "This measure exists for GPT-5.4 only.",
  };

  function pText(p) {
    return p.startsWith("<") ? "p < " + p.slice(1) : "p = " + p;
  }

  // Mirrors contrast_summary().
  function contrastSummary(config, threshold) {
    const parts = config.columns.map((column, index) => {
      const states = config.features.map((feature) => cellState(feature.contrasts[index], threshold));
      const tested = states.filter((s) => s !== "nt" && s !== "absent");
      const marked = tested.filter((s) => s === "pos" || s === "neg");
      return marked.length + " of " + tested.length + (index === 0 ? " tested measures differ" : "") + " for " +
        column.version + " " + column.label;
    });
    const directions = config.features.map((feature) => versionDirection(feature, threshold));
    const both = config.features.filter((f, i) => directions[i] === "same" || directions[i] === "reverses");
    const flips = config.features.filter((f, i) => directions[i] === "reverses");
    const kept = config.features.filter((f, i) => directions[i] === "same");
    let text = "With p < " + threshold + " as the cut-off, " + parts.slice(0, -1).join(", ") + ", and " +
      parts[parts.length - 1] + ". ";
    if (!both.length) return text + "No measure passes the cut-off in both versions' ChatGPT-vs-API contrasts.";
    const count = flips.length === both.length ? "all " + flips.length : String(flips.length);
    text += "Of the " + both.length + " measures that pass in both versions' ChatGPT-vs-API contrasts, " +
      count + " change direction between GPT-5.3 and GPT-5.4";
    if (kept.length) {
      const names = kept.map((f) => f.label.toLowerCase() + " (" + f.measure + (f.caveat ? ", " + f.caveat + ")" : ")")).join(", ");
      text += "; only " + names + " " + (kept.length === 1 ? "keeps its" : "keep their") + " direction.";
    } else {
      text += ".";
    }
    return text;
  }

  function cellSentence(config, feature, index, threshold) {
    const column = config.columns[index];
    const cell = feature.contrasts[index];
    const state = cellState(cell, threshold);
    const pair = column.version + " " + column.first + " vs " + column.second;
    if (state === "absent") return "";
    if (state === "nt") return pair + ": not tested (fewer than two questions had a nonzero paired difference).";
    const value = cell[0] + feature.unit + ", " + pText(cell[1]);
    if (state === "ns") return pair + ": " + value + ", not below the cut-off.";
    return pair + ": " + value + "; " + column.first + " " + (state === "pos" ? feature.up : feature.down) + ".";
  }

  // Mirrors feature_status().
  function featureStatus(config, featureId, threshold) {
    const feature = config.features.find((f) => f.id === featureId);
    const sentences = config.columns.map((column, index) => cellSentence(config, feature, index, threshold));
    sentences.push(DIRECTION_SENTENCES[versionDirection(feature, threshold)]);
    return sentences.filter(Boolean).join(" ");
  }

  // Mirrors overlap_summary().
  function overlapSummary(config, threshold) {
    const rows = config.overlap_rows;
    const marked = rows.filter((row) => significant(row.p, threshold));
    const deltas = rows.map((row) => number(row.delta));
    const names = marked.map((row) => row.metric.toLowerCase() + ", " + row.pair).join("; ");
    let text = "At p < " + threshold + ", cross-mode overlap is below the within-mode baseline in " + marked.length +
      " of " + rows.length + " comparisons" + (marked.length ? ": " + names + "." : ".");
    const low = Math.min(...deltas);
    const high = Math.max(...deltas);
    if (low > 0) text += " All printed gaps are positive (within minus cross from " + signed(low, 3) + " to " + signed(high, 3) + ").";
    return text;
  }

  function meansRows(config, feature) {
    const scale = feature.percent ? 100 : Math.max(...feature.means.filter(Boolean).map((m) => number(m[0])));
    return config.means_columns.map((label, index) => {
      const value = feature.means[index];
      const row = node("tr");
      const head = node("th", "", label);
      head.scope = "row";
      row.append(head);
      if (!value) {
        row.className = "is-absent";
        row.append(node("td"), node("td", "au-num", ABSENT));
        return row;
      }
      const width = scale === 0 ? 0 : 100 * number(value[0]) / scale;
      const barCell = node("td");
      const bar = node("span", "au-bar");
      bar.setAttribute("aria-hidden", "true");
      const fill = node("i");
      fill.style.width = fixed(width, 2) + "%";
      bar.append(fill);
      barCell.append(bar);
      const numberCell = node("td", "au-num", value[0] + " ");
      numberCell.append(node("small", "", "(" + value[1] + ")"));
      row.append(barCell, numberCell);
      return row;
    });
  }

  function attachContrasts(root, config) {
    const state = { threshold: config.initial.threshold, feature: config.initial.feature };
    const byId = new Map(config.features.map((feature) => [feature.id, feature]));
    const columnIndex = new Map(config.columns.map((column, index) => [column.id, index]));

    function renderThreshold() {
      press(root, "au-threshold", state.threshold);
      root.querySelectorAll("[data-au-feature]").forEach((row) => {
        const feature = byId.get(row.dataset.auFeature);
        row.querySelectorAll("[data-au-cell]").forEach((cell) => {
          cell.dataset.state = cellState(feature.contrasts[columnIndex.get(cell.dataset.auCell)], state.threshold);
        });
        const direction = versionDirection(feature, state.threshold);
        const out = row.querySelector("[data-au-direction]");
        out.dataset.state = direction;
        out.textContent = DIRECTION_LABELS[direction];
      });
      root.querySelectorAll("[data-au-overlap]").forEach((row) => {
        row.dataset.state = significant(config.overlap_rows[Number(row.dataset.auOverlap)].p, state.threshold) ? "sig" : "ns";
      });
      setText(root, "[data-au-summary]", contrastSummary(config, state.threshold));
      setText(root, "[data-au-overlap-status]", overlapSummary(config, state.threshold));
    }

    function renderFeature() {
      const feature = byId.get(state.feature);
      press(root, "au-feature", state.feature);
      root.querySelectorAll("[data-au-feature]").forEach((row) => {
        row.classList.toggle("is-selected", row.dataset.auFeature === state.feature);
      });
      setText(root, "[data-au-detail-title]", feature.label);
      setText(root, "[data-au-detail-measure]", feature.measure);
      setText(root, "[data-au-detail-note]", feature.note);
      root.querySelector("[data-au-means]").replaceChildren(...meansRows(config, feature));
    }

    function render() {
      renderThreshold();
      renderFeature();
      setText(root, "[data-au-detail-status]", featureStatus(config, state.feature, state.threshold));
    }

    onAction(root, (action, value) => {
      if (action === "au-threshold") state.threshold = value;
      else if (action === "au-feature") state.feature = value;
      else return;
      render();
    });
    render();
  }

  /* ---------------------------------------------------------------- Initialization */

  const ATTACH = {
    "auditing-overlap": attachOverlap,
    "auditing-contrasts": attachContrasts,
  };

  function initialize() {
    document.querySelectorAll('[data-paper-demo^="auditing-"]').forEach((root) => {
      if (root.dataset.demoReady === "true") return;
      const attach = ATTACH[root.dataset.paperDemo];
      if (!attach) return;
      try {
        attach(root, JSON.parse(root.dataset.demoConfig));
        // Interactive controls replace their static, script-free counterparts.
        root.querySelectorAll("button[data-demo-action][hidden]").forEach((button) => { button.hidden = false; });
        root.querySelectorAll("[data-au-static]").forEach((element) => { element.hidden = true; });
        root.querySelectorAll("[data-demo-controls]").forEach((controls) => { controls.hidden = false; });
        root.dataset.demoReady = "true";
      } catch (error) {
        console.warn("Auditing demo could not initialize.", error);
      }
    });
  }

  window.AuditingDemo = { jaccard, overlapState, overlapStatus, cellState, versionDirection, contrastSummary, featureStatus, overlapSummary };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
