/* Benchmark demos (ALCUNA, knowledge boundary, self-generated documents).
 * The server renders a complete state; this script reveals the controls and
 * re-renders the same markup from data-demo-config. Nothing calls a model or the
 * network. The KnowGen construction animates only after Play or Step; with
 * prefers-reduced-motion (or data-motion="reduce") Play advances one step at a time. */
(() => {
  "use strict";

  const MINUS = "−";

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

  function signed(value, digits) {
    let text = (value >= 0 ? "+" : "") + value.toFixed(digits);
    if (Number(text) === 0) text = (0).toFixed(digits);
    return text.replace("-", MINUS);
  }

  /* ---------------------------------------------------------------- Animation player */

  function reducedMotion(root) {
    return root.dataset.motion === "reduce" ||
      Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function flash(element, animate) {
    if (!animate || !element) return;
    element.classList.remove("is-entering");
    void element.offsetWidth;
    element.classList.add("is-entering");
    window.setTimeout(() => element.classList.remove("is-entering"), 650);
  }

  // count() returns the number of steps, which can change with the reader's settings.
  function createPlayer(root, count, render) {
    const play = root.querySelector('[data-demo-action="play"]');
    const step = root.querySelector('[data-demo-action="step"]');
    let index = count() - 1;
    let timer = 0;
    let playing = false;
    const last = () => count() - 1;
    const dwell = () => Number(root.dataset.stepDelay) || 1400;

    function sync() {
      play.setAttribute("aria-pressed", String(playing));
      play.textContent = playing ? "Pause" : "Play";
      step.disabled = index >= last();
      root.querySelectorAll('[data-demo-action="goto"]').forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.value) === index));
      });
      root.dataset.step = String(index);
    }
    function show(next, animate) {
      index = Math.max(0, Math.min(last(), next));
      const marked = animate && !reducedMotion(root);
      // A jump without animation leaves no change marks from earlier steps.
      if (!marked) root.querySelectorAll(".is-entering").forEach((element) => element.classList.remove("is-entering"));
      render(index, marked);
      sync();
    }
    function halt() {
      window.clearTimeout(timer);
      timer = 0;
      playing = false;
    }
    function tick() {
      show(index + 1, true);
      if (index >= last()) {
        halt();
        sync();
      } else {
        timer = window.setTimeout(tick, dwell());
      }
    }
    function toggle() {
      if (playing) {
        halt();
        sync();
        return;
      }
      if (reducedMotion(root)) {
        show(index >= last() ? 0 : index + 1, false);
        return;
      }
      playing = true;
      if (index >= last()) {
        show(0, false);
        timer = window.setTimeout(tick, dwell() / 2);
      } else {
        tick();
      }
      sync();
    }
    onAction(root, (action, value) => {
      if (action === "play") toggle();
      else if (action === "step") {
        halt();
        show(index + 1, true);
      } else if (action === "reset") {
        halt();
        show(0, false);
      } else if (action === "goto") {
        halt();
        show(Number(value), false);
      }
    });
    return {
      finish() {
        halt();
        show(last(), false);
      },
    };
  }

  /* ---------------------------------------------------------------- ALCUNA: KnowGen */

  const OPERATIONS = ["heredity", "variation", "dropout", "extension"];
  const STEP_ORDER = ["start", "heredity", "variation", "dropout", "extension", "name", "questions"];
  const STEP_LABELS = { start: "Start", heredity: "Heredity", variation: "Variation", dropout: "Dropout", extension: "Extension", name: "Name", questions: "Questions" };
  const SET_NAMES = { KU: "Knowledge understanding", KD: "Knowledge differentiation", KA: "Knowledge association" };

  // Mirrors property_state() in scripts/paper_demo_benchmarks.py.
  function propertyState(prop, enabled) {
    if (prop.op === "extension") return enabled.extension ? "extension" : "absent";
    if (enabled[prop.op]) return prop.op;
    return enabled.heredity ? "heredity" : "absent";
  }

  // Mirrors _question() in scripts/paper_demo_benchmarks.py.
  function questionFor(config, pid, state) {
    const q = config.questions[pid] || {};
    const prop = config.properties.concat(config.sibling_properties).find((p) => p.id === pid);
    const none = { id: pid, set: "", text: q.text || "", answer: "", depends: [], source: "", parent: "", parent_right: null };
    if (state === "absent") {
      return Object.assign(none, { reason: "Not generated: Alcuna has no " + prop.label + " " + (prop.relation ? "relation" : "triplet") + "." });
    }
    const base = { id: pid, text: q.text, reason: "" };
    const make = (extra) => Object.assign({}, base, extra);
    if (pid === "diet") return make({ set: "KU", answer: q.answer, depends: ["heredity"], source: "Figure 1", parent: prop.value, parent_right: true });
    if (pid === "body-mass") {
      if (state === "variation") return make({ set: "KD", answer: q.answer, depends: ["variation"], source: "Figure 1", parent: "Yes.", parent_right: false });
      return make({ set: "KU", answer: "Yes.", depends: ["heredity"], source: "Derived", parent: "Yes.", parent_right: true });
    }
    if (pid === "life-span") {
      if (state === "dropout") return make({ set: "KD", answer: q.answer, depends: ["dropout"], source: "Figure 1", parent: prop.value, parent_right: false });
      return make({ set: "KU", answer: prop.value, depends: ["heredity"], source: "Derived", parent: prop.value, parent_right: true });
    }
    if (pid === "eaten-by") {
      if (state === "variation") {
        return make({ set: "KA", answer: q.answer, depends: ["variation", "existing"], source: "Figure 1",
          parent: "no answer (Figure 1 prints no competitor of Cougar)", parent_right: null });
      }
      return Object.assign(none, { reason: "Not generated: with (Alcuna, Eaten by, " + prop.value + "), no printed relation leads from " +
        prop.value + " to a competitor, so no reasoning chain exists." });
    }
    if (pid === "first-appearance") {
      return make({ set: "KU", answer: q.answer, depends: ["extension"], source: "Figure 1",
        parent: "no answer (not among Alpaca's printed properties)", parent_right: null });
    }
    throw new Error("No question rule for " + pid);
  }

  // Mirrors knowgen_state() in scripts/paper_demo_benchmarks.py.
  function knowgenState(config, enabled) {
    const props = config.properties.map((prop) => {
      const state = propertyState(prop, enabled);
      return { id: prop.id, label: prop.label, state, value: state === "variation" ? prop.varied : prop.value, from: prop.value, relation: Boolean(prop.relation) };
    });
    config.sibling_properties.filter((prop) => prop.op === "extension").forEach((prop) => {
      props.push({ id: prop.id, label: prop.label, state: propertyState(prop, enabled), value: prop.value, from: prop.value, relation: false });
    });
    const states = Object.fromEntries(props.map((p) => [p.id, p.state]));
    const questions = ["diet", "first-appearance", "body-mass", "life-span", "eaten-by"].map((pid) => questionFor(config, pid, states[pid]));
    const generated = questions.filter((q) => q.set);
    const counts = { KU: 0, KD: 0, KA: 0 };
    generated.forEach((q) => { counts[q.set] += 1; });
    const present = props.filter((p) => p.state !== "absent" && p.state !== "dropout");
    const used = new Set(props.map((p) => p.state));
    return {
      properties: props,
      questions,
      counts,
      parent_right: generated.filter((q) => q.parent_right).length,
      generated: generated.length,
      identical: present.filter((p) => p.state === "heredity").length,
      present: present.length,
      steps: STEP_ORDER.filter((s) => s === "start" || s === "name" || s === "questions" || used.has(s)),
    };
  }

  // Mirrors knowgen_status() in scripts/paper_demo_benchmarks.py.
  function knowgenStatus(config, state, step) {
    const parent = config.parent;
    const sibling = config.sibling;
    const of = (kind) => state.properties.filter((p) => p.state === kind);
    if (step === "start") {
      return "Start from the class " + config.class + ": the parent " + parent.name + " and its sibling " + sibling.name +
        ". Algorithm 1 splits " + parent.name + "'s properties into heredity, variation, and dropout sets.";
    }
    if (step === "heredity") {
      return "Heredity: Alcuna keeps " + of("heredity").map((p) => p.label + ": " + p.value).join(", ") + ", as well as " + parent.name + "'s other properties.";
    }
    if (step === "variation") {
      return "Variation: " + of("variation").map((p) => {
        const source = config.properties.find((item) => item.id === p.id);
        return p.label + " " + p.from + " → " + p.value + " (" + source.how + ")";
      }).join("; ") + ".";
    }
    if (step === "dropout") return "Dropout: " + of("dropout").map((p) => p.label).join(", ") + " is removed, so Alcuna has no such triplet.";
    if (step === "extension") return "Extension: " + of("extension").map((p) => p.label + ": " + p.value).join(", ") + " is copied from the sibling " + sibling.name + ".";
    if (step === "name") {
      return "Name: the first subword of " + parent.name + " (" + parent.parts[0] + ") and the second subword of " + sibling.name +
        " (" + sibling.parts[1] + ") give " + config.entity + ".";
    }
    const c = state.counts;
    if (state.generated === 0) return "Questions: none. Alcuna carries none of the printed properties, so no question can be generated.";
    let text = "Questions: KU " + c.KU + ", KD " + c.KD + ", KA " + c.KA + ". Answering from " + parent.name +
      "'s printed properties alone gets " + state.parent_right + " of " + state.generated + " right.";
    if (c.KD === 0) text += " With no varied or dropped property, nothing tests whether a model separates Alcuna from " + parent.name + ".";
    if (c.KA === 0) text += " No question links the new entity to existing knowledge.";
    return text;
  }

  function opTag(state) {
    const tag = node("span", "bm-op", "[" + state + "]");
    tag.dataset.op = state;
    return tag;
  }

  function newItem(prop) {
    const item = node("li");
    item.dataset.kgProp = prop.id;
    item.dataset.kgOp = prop.state;
    if (prop.state === "dropout") item.append(node("s", "", prop.label), " ", opTag("dropout"));
    else item.append(prop.label + ": " + prop.value + " ", opTag(prop.state));
    return item;
  }

  function questionItem(q) {
    const item = node("li", q.set ? "bm-q" : "bm-q is-none");
    item.dataset.kgQ = q.id;
    const box = node("div");
    if (!q.set) {
      item.append(node("span", "bm-q-set", "—"));
      box.append(node("p", "bm-q-text", q.text), node("p", "bm-q-meta", q.reason));
      item.append(box);
      return item;
    }
    item.dataset.kgSet = q.set;
    const set = node("span", "bm-q-set", q.set);
    set.title = SET_NAMES[q.set];
    const answer = node("p", "bm-q-answer", "Expected answer: ");
    const strong = node("strong", "", q.answer);
    strong.dataset.kgAnswer = "";
    answer.append(strong);
    const meta = node("p", "bm-q-meta");
    const depends = q.depends.map((d) => (d === "existing" ? "existing knowledge (Jaguar, Compete with, Maned Wolf)" : d)).join(", ");
    const source = node("span", "bm-q-source", q.source === "Figure 1" ? "Published · Figure 1" : "Derived here by Algorithm 1");
    source.dataset.source = q.source;
    meta.append(node("span", "", "Depends on: " + depends), node("span", "", "From Alpaca alone: " + q.parent + (q.parent_right === null ? "" : " (" + (q.parent_right ? "right" : "wrong") + ")")), source);
    box.append(node("p", "bm-q-text", q.text), answer, meta);
    item.append(set, box);
    return item;
  }

  function attachKnowgen(root, config) {
    const enabled = Object.fromEntries(OPERATIONS.map((op) => [op, true]));
    let state = knowgenState(config, enabled);

    function render(index, animate) {
      const step = state.steps[index];
      const reached = (name) => state.steps.indexOf(name) !== -1 && state.steps.indexOf(name) <= index;
      // Source rows used by the current operation.
      root.querySelectorAll("[data-kg-src]").forEach((row) => {
        const prop = state.properties.find((p) => p.id === row.dataset.kgSrc);
        row.classList.toggle("is-source", Boolean(prop) && prop.state === step);
      });
      const list = root.querySelector("[data-kg-props]");
      const before = new Set([...list.children].map((li) => li.dataset.kgProp));
      list.replaceChildren(...state.properties.filter((p) => p.state !== "absent" && reached(p.state)).map(newItem));
      [...list.children].forEach((li) => { if (!before.has(li.dataset.kgProp)) flash(li, animate); });
      root.querySelector("[data-kg-others]").hidden = !(enabled.heredity && reached("heredity"));
      const named = reached("name");
      const name = root.querySelector("[data-kg-name]");
      if (named && name.textContent !== config.entity) flash(name, animate);
      name.textContent = named ? config.entity : "?";
      root.querySelector("[data-kg-name-note]").hidden = !named;
      setText(root, "[data-kg-similarity]", state.identical + " of " + state.present + " printed properties identical to " + config.parent.name + "'s.");
      root.querySelector("[data-kg-similarity]").hidden = !named;
      const asked = step === "questions";
      const questions = root.querySelector("[data-kg-questions]");
      const wasHidden = questions.hidden;
      questions.hidden = !asked;
      root.querySelector("[data-kg-q-pending]").hidden = asked;
      if (asked && wasHidden) flash(questions, animate);
      setText(root, "[data-step-status]", knowgenStatus(config, state, step));
    }

    function rebuild() {
      state = knowgenState(config, enabled);
      root.querySelector("[data-kg-questions]").replaceChildren(...state.questions.map(questionItem));
      root.querySelector("[data-kg-steps]").replaceChildren(...state.steps.map((name, index) => {
        const button = node("button", "", STEP_LABELS[name]);
        button.type = "button";
        button.dataset.demoAction = "goto";
        button.dataset.value = String(index);
        button.setAttribute("aria-pressed", "false");
        return button;
      }));
      OPERATIONS.forEach((op) => {
        root.querySelector('[data-demo-action="kg-op"][data-value="' + op + '"]').setAttribute("aria-pressed", String(enabled[op]));
      });
    }

    const player = createPlayer(root, () => state.steps.length, render);
    onAction(root, (action, value) => {
      if (action !== "kg-op") return;
      enabled[value] = !enabled[value];
      rebuild();
      player.finish();
    });
    rebuild();
    player.finish();
  }

  /* ---------------------------------------------------------------- Knowledge boundary */

  const MODELS = ["GPT-2", "GPT-J", "LLaMA2", "Vicuna"];
  const pct = (value) => value.toFixed(2) + "%";

  function order(config, dataset, method) {
    const values = config.results[dataset];
    return MODELS.slice().sort((a, b) => values[b][method] - values[a][method]);
  }

  // Mirrors boundary_status() in scripts/paper_demo_benchmarks.py.
  function boundaryStatus(config, trueKey, falseKey, method) {
    const tLabel = config.datasets[trueKey].label;
    const fLabel = config.datasets[falseKey].label;
    if (method === "AutoPrompt") {
      return "AutoPrompt on CFACT (Table 3): " + MODELS.map((m) => m + " " + pct(config.autoprompt_cfact[m])).join(", ") +
        ". It is tested only on counterfactual facts: without a semantic constraint, its trigger tokens force the false target far more often than PGDC (" +
        MODELS.map((m) => pct(config.pgdc_cfact_table3[m])).join(", ") + ").";
    }
    const t = config.results[trueKey];
    const f = config.results[falseKey];
    let text = method + " · " + tLabel + " ↑ / " + fLabel + " ↓: " +
      MODELS.map((m) => m + " " + pct(t[m][method]) + " / " + pct(f[m][method])).join(", ") + ".";
    const ratios = MODELS.map((m) => Math.round(100 * f[m][method] / t[m][method]));
    if (Math.max(...MODELS.map((m) => f[m][method])) === 0) {
      text += " It never elicits a " + fLabel + " target.";
    } else {
      const lo = Math.min(...ratios);
      const hi = Math.max(...ratios);
      text += " Across the four backbones, false-target success equals " + (lo === hi ? lo + "%" : lo + "–" + hi + "%") + " of true-fact success.";
      const over = MODELS.filter((m, i) => ratios[i] >= 100);
      if (over.length) text += " For " + over.join(", ") + " it is at least as high as true-fact success.";
    }
    const best = MODELS.filter((m) => t[m][method] === Math.max(...Object.values(t[m])));
    if (best.length) text += " Highest " + tLabel + " success of all seven probes for " + best.join(", ") + ".";
    const mine = order(config, trueKey, method);
    text += " Backbone order on " + tLabel + ": " + mine.join(" > ");
    if (method !== "PGDC") {
      const reference = order(config, trueKey, "PGDC");
      text += mine.join() === reference.join() ? "; PGDC gives the same order." : "; PGDC gives " + reference.join(" > ") + ".";
    } else {
      text += ".";
    }
    const base = method.replace(/^P-/, "");
    if (["zero", "few", "dis"].includes(base)) {
      const gainsT = MODELS.map((m) => t[m]["P-" + base] - t[m][base]);
      const gainsF = MODELS.map((m) => f[m]["P-" + base] - f[m][base]);
      text += " Counting any listed paraphrase (" + base + " → P-" + base + ") changes " + tLabel + " by " +
        signed(Math.min(...gainsT), 2) + " to " + signed(Math.max(...gainsT), 2) + " points";
      if (falseKey === "alcuna") text += "; ALCUNA has one expression per query, so the two coincide there.";
      else text += " and " + fLabel + " by " + signed(Math.min(...gainsF), 2) + " to " + signed(Math.max(...gainsF), 2) + " points.";
      const lower = MODELS.filter((m, i) => gainsT[i] < 0);
      if (lower.length) text += " The paper prints a lower P-" + base + " than " + base + " value on " + tLabel + " for " + lower.join(", ") + ".";
    }
    return text;
  }

  // Mirrors boundary_inputs_note() in scripts/paper_demo_benchmarks.py.
  function inputsNote(config, falseKey, method) {
    const base = method.replace(/^P-/, "");
    if (method === "PGDC") {
      return "PGDC starts from the original cloze prompt and edits its embeddings; the paper's Table 2 prints three prompts it changed successfully " +
        "(dataset and backbone not stated). The target answer may appear after generated tokens, not only first.";
    }
    if (method === "AutoPrompt") {
      return "AutoPrompt extends the question with five trigger tokens, initialized with the prompt's last token and updated for three rounds " +
        "(Appendix E). It has no semantic constraint.";
    }
    let note = {
      zero: "The model must produce the bracketed answer after the cloze prompt.",
      few: "Four retrieved examples precede the query (Table 4 prints two). The model must produce the bracketed answer.",
      dis: "The model judges a statement; success is the bracketed True.",
    }[base];
    if (method.startsWith("P-")) note += " The P- variant sends one such input per listed paraphrase and counts the fact as known if any succeeds.";
    return note + " On " + config.datasets[falseKey].label + " the target is false, so every success counts against the probe.";
  }

  function bracketed(text) {
    const fragment = document.createDocumentFragment();
    const start = text.indexOf("[");
    const end = text.indexOf("]");
    if (start === -1 || end === -1) {
      fragment.append(text);
      return fragment;
    }
    fragment.append(text.slice(0, start), node("mark", "", text.slice(start + 1, end)), text.slice(end + 1));
    return fragment;
  }

  function inputBlock(config, key, method) {
    const sample = config.inputs[key][method.replace(/^P-/, "")];
    const block = node("div", "bm-input");
    const kind = config.datasets[key].kind === "true" ? "true fact" : "false target";
    block.append(node("p", "bm-label", config.datasets[key].label + " · " + kind));
    const list = node("ol");
    (Array.isArray(sample) ? sample : [sample]).forEach((line) => {
      const item = node("li");
      item.append(bracketed(line));
      list.append(item);
    });
    block.append(list);
    return block;
  }

  function barCell(value, kind) {
    const cell = node("td");
    if (value === null) {
      cell.className = "bm-na";
      cell.append(node("span", "bm-value", "not reported"));
      return cell;
    }
    const bar = node("span", "bm-bar is-" + kind);
    bar.setAttribute("aria-hidden", "true");
    const fill = node("i");
    fill.style.width = value.toFixed(2) + "%";
    bar.append(fill);
    cell.append(bar, node("span", "bm-value", pct(value)));
    return cell;
  }

  function attachBoundary(root, config) {
    const state = Object.assign({}, config.initial);
    const methods = Object.keys(config.methods);

    function update() {
      if (state.method === "AutoPrompt" && state.false !== "cfact") state.method = "PGDC";
      press(root, "kb-true", state.true);
      press(root, "kb-false", state.false);
      press(root, "kb-method", state.method);
      root.querySelector('[data-demo-action="kb-method"][data-value="AutoPrompt"]').hidden = state.false !== "cfact";
      setText(root, "[data-kb-true-label]", config.datasets[state.true].label);
      setText(root, "[data-kb-false-label]", config.datasets[state.false].label);
      root.querySelectorAll("[data-kb-model]").forEach((panel) => {
        const model = panel.dataset.kbModel;
        const rows = methods.map((name) => {
          const row = node("tr");
          row.dataset.kbMethod = name;
          row.classList.toggle("is-selected", name === state.method);
          const head = node("th", "", name);
          head.scope = "row";
          row.append(head, barCell(config.results[state.true][model][name], "true"), barCell(config.results[state.false][model][name], "false"));
          return row;
        });
        const auto = node("tr");
        auto.dataset.kbMethod = "AutoPrompt";
        auto.dataset.kbAutoprompt = "";
        auto.hidden = state.false !== "cfact";
        auto.classList.toggle("is-selected", state.method === "AutoPrompt");
        const head = node("th", "", "AutoPrompt");
        head.scope = "row";
        auto.append(head, barCell(null, "true"), barCell(config.autoprompt_cfact[model], "false"));
        panel.querySelector("[data-kb-rows]").replaceChildren(...rows, auto);
      });
      setText(root, "[data-kb-status]", boundaryStatus(config, state.true, state.false, state.method));
      setText(root, "[data-kb-method-name]", state.method);
      setText(root, "[data-kb-method-detail]", config.methods[state.method] || "Hotflip-based trigger search (Shin et al., 2020)");
      setText(root, "[data-kb-input-note]", inputsNote(config, state.false, state.method));
      const special = state.method === "PGDC" || state.method === "AutoPrompt";
      const inputs = root.querySelector("[data-kb-inputs]");
      inputs.hidden = special;
      inputs.replaceChildren(...(special ? [] : [inputBlock(config, state.true, state.method), inputBlock(config, state.false, state.method)]));
      root.querySelector("[data-kb-cases]").hidden = state.method !== "PGDC";
    }

    onAction(root, (action, value) => {
      if (action === "kb-true") state.true = value;
      else if (action === "kb-false") state.false = value;
      else if (action === "kb-method") state.method = value;
      else return;
      update();
    });
    update();
  }

  /* ---------------------------------------------------------------- Self-generated documents */

  function valueName(config, position, letter) {
    return config.dimensions[position].values.find((v) => v[0] === letter)[1];
  }

  function flipCode(config, code, position) {
    const letters = config.dimensions[position].values.map((v) => v[0]);
    const other = code[position] === letters[0] ? letters[1] : letters[0];
    return code.slice(0, position) + other + code.slice(position + 1);
  }

  // Mirrors flip_rows() in scripts/paper_demo_benchmarks.py.
  function flipRows(config, code, condition) {
    const rows = config.conditions[condition].rows;
    return config.dimensions.map((dimension, position) => {
      const other = flipCode(config, code, position);
      const deltas = rows[code].map((value, i) => Math.round((value - rows[other][i]) * 10) / 10);
      const wins = [0, 1, 2, 3, 4].map((task) => config.codes
        .filter((candidate) => candidate[position] === code[position])
        .filter((candidate) => rows[candidate][task] > rows[flipCode(config, candidate, position)][task]).length);
      return { dimension: dimension.label, mine: valueName(config, position, code[position]), theirs: valueName(config, position, other[position]), other, deltas, wins };
    });
  }

  function rank(rows, code, task) {
    const value = rows[code][task];
    const position = 1 + Object.values(rows).filter((v) => v[task] > value).length;
    const ties = Object.keys(rows).filter((c) => c !== code && rows[c][task] === value);
    return [position, ties];
  }

  // Mirrors selfdoc_status() in scripts/paper_demo_benchmarks.py.
  function selfdocStatus(config, code, condition) {
    const cond = config.conditions[condition];
    const rows = cond.rows;
    const names = [0, 1, 2].map((i) => valueName(config, i, code[i]).toLowerCase());
    const parts = config.tasks.map((task, index) => {
      const [position, ties] = rank(rows, code, index);
      return task[0] + " " + rows[code][index].toFixed(1) + " (rank " + position + " of 8" + (ties.length ? ", tied with " + ties.join(", ") : "") + ")";
    });
    let text = code + " (" + names.join(", ") + "), " + cond.label + " (" + cond.table + "): " + parts.join("; ") + ".";
    const wiki = config.baselines.Wiki;
    const above = [0, 1, 2, 3].filter((i) => wiki[i] > rows[code][i]).map((i) => config.tasks[i][0]);
    text += above.length ? " Wikipedia passages alone score higher on " + above.join(", ") + "." : " It beats Wikipedia passages alone on all four tasks.";
    if (condition !== "alone") {
      text += " Average change from the same documents alone: " + signed(rows[code][4] - config.conditions.alone.rows[code][4], 1) + ".";
    }
    return text;
  }

  function attachSelfdocs(root, config) {
    const keys = ["tone", "granularity", "structure"];
    const choice = Object.fromEntries(keys.map((key, i) => [key, config.initial.type[i]]));
    let condition = config.initial.condition;

    function scoreRows(code) {
      const cond = config.conditions[condition];
      const rows = cond.rows;
      const best = [0, 1, 2, 3, 4].map((i) => Math.max(...Object.values(rows).map((v) => v[i])));
      const out = config.codes.map((c) => {
        const row = node("tr");
        row.dataset.sdRow = c;
        row.classList.toggle("is-selected", c === code);
        const head = node("th", "", c);
        head.scope = "row";
        head.append(node("small", "", config.types[c].genre));
        row.append(head);
        rows[c].forEach((value, i) => {
          const cell = node("td", value === best[i] ? "is-best" : "", value.toFixed(1));
          const change = cond.changes && cond.changes[c];
          if (change) cell.append(node("small", "", change[i] === "0.0" ? "±0.0" : change[i].replace("-", MINUS)));
          row.append(cell);
        });
        return row;
      });
      Object.entries(config.baselines).forEach(([name, values]) => {
        const row = node("tr", "bm-baseline");
        row.dataset.sdBaseline = name;
        row.hidden = name === "GenRead mix" && condition === "alone";
        const head = node("th", "", name);
        head.scope = "row";
        head.append(node("small", "", name === "Wiki" ? "Wikipedia passages alone" : "GenRead documents, Direct Mix"));
        row.append(head, ...values.map((v) => node("td", "", v.toFixed(1))));
        out.push(row);
      });
      return out;
    }

    function update() {
      const code = keys.map((key) => choice[key]).join("");
      const info = config.types[code];
      const cond = config.conditions[condition];
      keys.forEach((key) => press(root, "sd-" + key, choice[key]));
      press(root, "sd-condition", condition);
      setText(root, "[data-sd-code]", code);
      setText(root, "[data-sd-genre]", "Table 4 example: " + info.genre);
      root.querySelector("[data-sd-definitions]").replaceChildren(...config.dimensions.map((dimension, i) => {
        const item = node("li");
        item.dataset.sdDim = dimension.key;
        const value = dimension.values.find((v) => v[0] === code[i]);
        item.append(node("strong", "", value[1]), " ", node("span", "", "(" + dimension.metafunction + " metafunction): " + value[2] + "."));
        return item;
      }));
      setText(root, "[data-sd-excerpt]", info.excerpt + " …");
      setText(root, "[data-sd-excerpt-source]", info.figure1 ? "Figure 1 and Appendix G.2" : "Appendix G.2");
      setText(root, "[data-sd-condition-label]", cond.label);
      setText(root, "[data-sd-table]", cond.table);
      root.querySelector("[data-sd-scores]").replaceChildren(...scoreRows(code));
      root.querySelector("[data-sd-flips]").replaceChildren(...flipRows(config, code, condition).map((row) => {
        const tr = node("tr");
        const head = node("th", "", row.mine + " over " + row.theirs.toLowerCase());
        head.scope = "row";
        head.append(node("small", "", code + " vs " + row.other));
        tr.append(head);
        row.deltas.forEach((d, i) => {
          const cell = node("td", d > 0 ? "is-up" : d < 0 ? "is-down" : "", signed(d, 1));
          cell.append(node("small", "", row.wins[i] + "/4 pairs"));
          tr.append(cell);
        });
        return tr;
      }));
      setText(root, "[data-sd-status]", selfdocStatus(config, code, condition));
    }

    onAction(root, (action, value) => {
      if (action === "sd-condition") condition = value;
      else if (action.startsWith("sd-")) choice[action.slice(3)] = value;
      else return;
      update();
    });
    update();
  }

  /* ---------------------------------------------------------------- Initialization */

  const ATTACH = {
    "benchmarks-knowgen": attachKnowgen,
    "benchmarks-boundary": attachBoundary,
    "benchmarks-selfdocs": attachSelfdocs,
  };

  function initialize() {
    document.querySelectorAll('[data-paper-demo^="benchmarks-"]').forEach((root) => {
      if (root.dataset.demoReady === "true") return;
      const attach = ATTACH[root.dataset.paperDemo];
      if (!attach) return;
      try {
        attach(root, JSON.parse(root.dataset.demoConfig));
        root.dataset.demoReady = "true";
        root.querySelectorAll("[data-demo-controls]").forEach((controls) => {
          controls.hidden = false;
        });
      } catch (error) {
        console.warn("Benchmark demo could not initialize.", error);
      }
    });
  }

  window.BenchmarksDemo = { propertyState, knowgenState, knowgenStatus, boundaryStatus, flipRows, selfdocStatus };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
