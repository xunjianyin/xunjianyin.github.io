/* Knowledge demos (History Matters, MC-MKE, EchoQA). The server renders a complete
 * state (the final step of each animation); this script reveals the controls and
 * re-renders the same markup from data-demo-config. It never calls a model or the
 * network. Animations start only from Play or Step; with prefers-reduced-motion
 * (or data-motion="reduce" on a demo) Play advances one step without transitions. */
(() => {
  "use strict";

  const MINUS = "−";
  const signed = (change) => change.replace("-", MINUS);

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

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function onAction(root, handler) {
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-demo-action]");
      if (button && root.contains(button)) handler(button.dataset.demoAction, button.dataset.value);
    });
  }

  /* ---------------------------------------------------------------- Animation player */

  function reducedMotion(root) {
    return root.dataset.motion === "reduce" ||
      Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Briefly mark an element that changed at this step (CSS animates the mark, ≤ 450 ms).
  function flash(element, animate) {
    if (!animate || !element) return;
    element.classList.remove("is-entering");
    void element.offsetWidth;
    element.classList.add("is-entering");
    window.setTimeout(() => element.classList.remove("is-entering"), 650);
  }

  // Play / Pause, Step, Reset, and one toggle per step. render(index, animate) draws a step.
  function createPlayer(root, count, render) {
    const last = count - 1;
    const play = root.querySelector('[data-demo-action="play"]');
    const step = root.querySelector('[data-demo-action="step"]');
    let index = last;
    let timer = 0;
    let playing = false;
    const dwell = () => Number(root.dataset.stepDelay) || 1600;

    function sync() {
      play.setAttribute("aria-pressed", String(playing));
      play.textContent = playing ? "Pause" : "Play";
      step.disabled = index >= last;
      root.querySelectorAll('[data-demo-action="goto"]').forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.value) === index));
      });
      root.dataset.step = String(index);
    }
    function show(next, animate) {
      index = Math.max(0, Math.min(last, next));
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
      if (index >= last) {
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
        // One step per press, without transitions.
        show(index >= last ? 0 : index + 1, false);
        return;
      }
      playing = true;
      if (index >= last) {
        show(0, false);
        timer = window.setTimeout(tick, dwell() / 2);
      } else {
        tick();
      }
      sync();
    }

    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-demo-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.demoAction;
      if (action === "play") toggle();
      else if (action === "step") {
        halt();
        show(index + 1, true);
      } else if (action === "reset") {
        halt();
        show(0, false);
      } else if (action === "goto") {
        halt();
        show(Number(button.dataset.value), false);
      }
    });
    return {
      redraw() {
        halt();
        show(index, false);
      },
      finish() {
        halt();
        show(last, false);
      },
    };
  }

  /* ---------------------------------------------------------------- History Matters: sequence */

  // Mirrors link_status() in scripts/paper_demo_knowledge.py.
  function linkStatus(config, index, step) {
    const link = config.record.chain[index];
    if (index === step) return step === 0 ? "Current · known to GPT-J before editing" : "Current · written by edit " + step;
    if (index < step) return "Historical · span closed in " + link.until;
    return link.role + " · not applied yet";
  }

  const formText = (items) => items.map((item) => item.prompt).join(" | ");

  // Mirrors cell_flag() in scripts/paper_demo_knowledge.py.
  function cellFlag(config, form, step) {
    const current = (config.probes[String(step)] || {})[form];
    const previous = (config.probes[String(step - 1)] || {})[form];
    if (!current) return "";
    if (!previous) return "First asked";
    if (formText(current.items) === formText(previous.items)) {
      const same = current.items.map((i) => i.answer).join("|") === previous.items.map((i) => i.answer).join("|");
      return same ? "Same wording, same answer" : "Same wording, new answer";
    }
    return "New time span";
  }

  // Mirrors sequence_status() in scripts/paper_demo_knowledge.py.
  function sequenceStatus(config, step) {
    const chain = config.record.chain;
    const last = chain.length - 1;
    if (step === 0) {
      const first = chain[0];
      return "Before editing: GPT-J's model-time fact is " + first.object + " (" + first.since + "–" + first.until +
        "). AToKe asks no question yet.";
    }
    const link = chain[step];
    const previous = chain[step - 1];
    let text = "Edit " + step + " applied: " + link.object + ", " + link.since + "–" + link.until + ". " +
      previous.object + " is now historical.";
    const groups = {};
    Object.keys(config.forms).forEach((form) => {
      const flag = cellFlag(config, form, step);
      if (flag) (groups[flag] = groups[flag] || []).push(form);
    });
    [["Same wording, new answer", "Same wording, new expected answer"],
      ["New time span", "New time span in the prompt"],
      ["First asked", "Asked for the first time"]].forEach(([flag, label]) => {
      if (groups[flag]) text += " " + label + ": " + groups[flag].join(", ") + ".";
    });
    if (step === 1) text += " A single-edit (AToKe-SE) case ends here.";
    if (step === last) text += " The multiple-edit (AToKe-ME) case ends here.";
    return text;
  }

  function attachTemporalSequence(root, config) {
    const chain = config.record.chain;

    function render(step, animate) {
      chain.forEach((link, index) => {
        const period = root.querySelector('[data-hm-link="' + index + '"]');
        const status = linkStatus(config, index, step);
        const changed = period.querySelector("[data-hm-link-status]").textContent !== status;
        period.classList.toggle("is-current", index === step);
        period.classList.toggle("is-past", index < step);
        period.classList.toggle("is-pending", index > step);
        period.querySelector("[data-hm-link-status]").textContent = status;
        if (changed) flash(period, animate);
      });

      setText(root, "[data-hm-request-step]", step === 0 ? "this point" : "edit " + step);
      root.querySelector("[data-hm-request-empty]").hidden = step !== 0;
      root.querySelector("[data-hm-request-grid]").hidden = step === 0;
      root.querySelectorAll("[data-hm-req]").forEach((row) => {
        const index = Number(row.dataset.hmReq);
        const visible = row.dataset.hmReqKind === "plain" ? index === step : step >= 1 && index <= step;
        const appears = visible && row.hidden;
        row.hidden = !visible;
        if (appears) flash(row, animate);
      });

      root.querySelectorAll("[data-hm-cell]").forEach((cell) => {
        const column = Number(cell.dataset.hmCell);
        const pending = column > step;
        const appears = !pending && cell.classList.contains("is-pending");
        cell.classList.toggle("is-pending", pending);
        if (appears) flash(cell, animate);
      });
      setText(root, "[data-step-status]", sequenceStatus(config, step));
    }

    createPlayer(root, chain.length, render).finish();
  }

  /* ---------------------------------------------------------------- History Matters: results */

  // Mirrors temporal_status() in scripts/paper_demo_knowledge.py.
  function temporalStatus(config, setting, form, editor) {
    const [plain, meto, change] = config.results[setting][form][editor];
    const [cesPlain, cesMeto, cesChange] = config.results[setting].CES[editor];
    const delta = Number(change);
    const head = editor + " · " + form + " · " + config.settings[setting].name + ": " + plain +
      "% without METO → " + meto + "% with METO (" + signed(change) + " points).";
    let tail;
    if (Number(cesPlain) < 10) {
      tail = " " + editor + " barely learns the edit itself (CES " + cesPlain + "% without METO), so its scores stay near the floor either way.";
    } else if (config.forms[form].time === "historical") {
      tail = " Without METO, historical probes almost never succeed; with METO, " + meto + "% do.";
      if (Number(cesChange) <= -1) tail += " Over the same edits, CES moves from " + cesPlain + "% to " + cesMeto + "%.";
    } else if (Math.abs(delta) < 0.5) {
      tail = " The change is negligible.";
    } else if (delta < 0 && form === "CES") {
      tail = " This probe repeats the edit prompt, yet METO lowers it.";
    } else if (delta < 0 && Number(cesChange) > 0) {
      tail = " With METO the exact edit prompt improves (CES " + signed(cesChange) + "), yet this form falls: the gain does not carry over to other wordings.";
    } else if (delta < 0) {
      tail = " METO lowers accuracy on the current fact for this form.";
    } else {
      tail = " METO does not lower this current-knowledge score.";
    }
    return head + tail;
  }

  function attachTemporalResults(root, config) {
    const state = Object.assign({}, config.initial);

    function mapRow(code) {
      const row = node("tr");
      row.dataset.form = code;
      row.classList.toggle("is-selected", code === state.form);
      const head = node("th");
      head.scope = "row";
      head.append(node("span", "", code), node("small", "", config.forms[code].name));
      row.append(head);
      config.editors.forEach((name) => {
        const change = config.results[state.setting][code][name][2];
        const cell = node("td", change.startsWith("-") ? "is-down" : "is-up", signed(change));
        cell.dataset.editor = name;
        cell.classList.toggle("is-col", name === state.editor);
        cell.classList.toggle("is-cell", name === state.editor && code === state.form);
        row.append(cell);
      });
      return row;
    }

    function update() {
      const setting = config.settings[state.setting];
      if (!setting.forms.includes(state.form)) state.form = "HES";
      press(root, "hm-setting", state.setting);
      press(root, "hm-form", state.form);
      press(root, "hm-editor", state.editor);
      root.querySelectorAll('[data-demo-action="hm-form"]').forEach((button) => {
        button.hidden = !setting.forms.includes(button.dataset.value);
      });
      setText(root, "[data-hm-code]", state.form);
      setText(root, "[data-hm-form-name]", config.forms[state.form].name);
      setText(root, "[data-hm-setting-name]", setting.name);

      config.editors.forEach((name) => {
        const [plain, meto, change] = config.results[state.setting][state.form][name];
        const row = root.querySelector('[data-hm-row="' + name + '"]');
        const low = Math.min(Number(plain), Number(meto));
        const high = Math.max(Number(plain), Number(meto));
        row.classList.toggle("is-selected", name === state.editor);
        row.querySelector(".kd-db-span").style.left = low + "%";
        row.querySelector(".kd-db-span").style.width = (high - low).toFixed(2) + "%";
        row.querySelector(".kd-db-plain").style.left = Number(plain) + "%";
        row.querySelector(".kd-db-meto").style.left = Number(meto) + "%";
        row.querySelector("[data-hm-plain]").textContent = plain;
        row.querySelector("[data-hm-meto]").textContent = meto;
        const changeCell = row.querySelector("[data-hm-change]");
        changeCell.textContent = signed(change);
        changeCell.classList.toggle("is-down", change.startsWith("-"));
        changeCell.classList.toggle("is-up", !change.startsWith("-"));
      });
      setText(root, "[data-hm-status]", temporalStatus(config, state.setting, state.form, state.editor));

      root.querySelector("[data-hm-map]").replaceChildren(...setting.forms.map(mapRow));
      root.querySelectorAll(".kd-delta-map thead th[data-editor]").forEach((head) => {
        head.classList.toggle("is-col", head.dataset.editor === state.editor);
      });
    }

    onAction(root, (action, value) => {
      if (action === "hm-setting") state.setting = value;
      else if (action === "hm-form") state.form = value;
      else if (action === "hm-editor") state.editor = value;
      else return;
      update();
    });
    update();
  }

  /* ---------------------------------------------------------------- MC-MKE: propagation */

  const KIND_NAMES = { ie: "the recognized entity (i, e)", sro: "the textual fact (s, r, o)", iro: "the image-based answer (i, r, o)" };
  const fill = (template, values) => template.replace(/\{(\w)\}/g, (_, key) => values[key]);

  // Mirrors propagation_state() in scripts/paper_demo_knowledge.py.
  function propagationState(example, key, step, route) {
    const sc = example.scenarios[key];
    const t = example.templates;
    const e0 = sc.entity;
    const facts0 = Object.fromEntries(sc.facts);
    const o0 = facts0[e0];
    const rows = {};
    const row = (text, was, role, state) => ({ text, was, role, state });
    let compose;
    let answer = o0;

    if (key === "ie") {
      const entity = step >= 1 ? sc.new_entity : e0;
      const used = step >= 2 ? entity : e0;
      answer = facts0[used];
      rows.ie = row(fill(t.ie, { e: entity }), step >= 1 ? e0 : null,
        step >= 1 ? "Edited · reliability probe" : "Wrong recognition before the edit", step >= 1 ? "edit" : "fixed");
      rows.sro = row(fill(t.sro, { s: used, o: facts0[used] }), step >= 2 ? fill(t.sro, { s: e0, o: o0 }) : null,
        step >= 2 ? "Unchanged knowledge · now selected because e = s" : "Unchanged knowledge used by the composition", "fixed");
      rows.iro = row(fill(t.iro, { o: answer }), step >= 2 ? o0 : null,
        step >= 2 ? "Must follow · consistency probe" : step === 1 ? "Not recomputed yet" : "Composed answer before the edit",
        step >= 2 ? "check" : step === 1 ? "stale" : "fixed");
      compose = [used, facts0[used]];
    } else if (key === "sro") {
      const facts = step >= 1 ? { [e0]: sc.new_object } : facts0;
      answer = step >= 2 ? facts[e0] : o0;
      rows.ie = row(fill(t.ie, { e: e0 }), null, "Unchanged", "fixed");
      rows.sro = row(fill(t.sro, { s: e0, o: facts[e0] }), step >= 1 ? o0 : null,
        step >= 1 ? "Edited · reliability probe (asked with a black image)" : "Textual fact before the edit", step >= 1 ? "edit" : "fixed");
      rows.iro = row(fill(t.iro, { o: answer }), step >= 2 ? o0 : null,
        step >= 2 ? "Must follow · consistency probe" : step === 1 ? "Not recomputed yet" : "Composed answer before the edit",
        step >= 2 ? "check" : step === 1 ? "stale" : "fixed");
      compose = [e0, answer];
    } else {
      const fresh = sc.new_object;
      rows.iro = row(step >= 1 ? fill(t.iro_reason, { o: fresh }) : fill(t.iro, { o: o0 }), step >= 1 ? o0 : null,
        step >= 1 ? "Edited with a reason · reliability probe" : "Composed answer before the edit", step >= 1 ? "edit" : "fixed");
      answer = step >= 1 ? fresh : o0;
      if (route === "reason") {
        rows.ie = row(fill(t.ie, { e: e0 }), null, step >= 2 ? "Unchanged: a transfer keeps the same player" : "Unchanged", "fixed");
        const fact = step >= 2 ? fresh : o0;
        rows.sro = row(fill(t.sro, { s: e0, o: fact }), step >= 2 ? o0 : null,
          step >= 2 ? "Must follow · consistency probe" : step === 1 ? "Not updated yet" : "Textual fact before the edit",
          step >= 2 ? "check" : step === 1 ? "stale" : "fixed");
        compose = step >= 2 ? [e0, fact] : [e0, o0];
      } else {
        rows.ie = row(step >= 2 ? fill(t.ie, { e: "ẽ (not determined)" }) : fill(t.ie, { e: e0 }), step >= 2 ? e0 : null,
          step >= 2 ? "Would need some ẽ that plays for " + fresh + ": not unique" : "Unchanged", step >= 2 ? "ambiguous" : "fixed");
        rows.sro = row(fill(t.sro, { s: e0, o: o0 }), null, "Unchanged under this reading", "fixed");
        compose = step >= 2 ? ["ẽ", fresh] : [e0, o0];
      }
    }

    const [head, obj] = compose;
    const relation = example.relation;
    const composition = "(image, " + head + ") ×e=s (" + head + ", " + relation + ", " + obj + ") = (image, " + relation + ", " + obj + ")";
    let status;
    if (step === 0) {
      status = "Before the edit, the model recognizes " + e0 + " in the image, and " + e0 + " plays for " + o0 + ", so it answers " + o0 + ".";
    } else if (step === 1) {
      status = "Edit applied to " + KIND_NAMES[sc.edit] + ": " + rows[sc.edit].was + " → " + (sc.new_entity || sc.new_object) +
        ". The linked answer has not been recomputed yet; a method that stops here passes the reliability probe but fails the consistency probe.";
    } else if (key === "iro" && route !== "reason") {
      status = "Read as a recognition change, the edit would need some player ẽ who plays for " + sc.new_object +
        ". Many players could, so the edit does not determine ẽ; MC-MKE attaches a transfer reason and uses only the textual-fact reading.";
    } else {
      const editTarget = sc.new_entity || sc.new_object;
      const checkTarget = key !== "ie" ? sc.new_object : answer;
      status = "Recomputed with Eq. (2): " + KIND_NAMES[sc.check] + " must change from " + o0 + " to " + checkTarget + ". " +
        "Edit target " + editTarget + "; consistency target " + checkTarget + ". " +
        (editTarget === checkTarget
          ? "The two targets are the same answer, so a method that outputs it for every related prompt also passes; locality must be read alongside."
          : "The targets differ, so repeating the edit target cannot pass the consistency probe.");
    }
    return { rows, composition, status };
  }

  function attachMultimodalPropagation(root, config) {
    const example = config.example;
    const state = { scenario: "ie", route: "reason" };

    function render(step, animate) {
      const result = propagationState(example, state.scenario, step, state.route);
      ["ie", "sro", "iro"].forEach((key) => {
        const row = root.querySelector('[data-mc-knowledge="' + key + '"]');
        const value = result.rows[key];
        const textCell = row.querySelector("[data-mc-text]");
        const changed = textCell.textContent !== value.text || row.querySelector("[data-mc-role]").textContent !== value.role;
        row.className = "kd-role-" + value.state;
        textCell.textContent = value.text;
        const was = row.querySelector("[data-mc-was]");
        was.hidden = !value.was;
        was.textContent = value.was ? "previously " + value.was : "";
        row.querySelector("[data-mc-role]").textContent = value.role;
        if (changed) flash(row, animate);
      });
      const compose = root.querySelector("[data-mc-compose]");
      if (compose.textContent !== result.composition) flash(compose, animate);
      compose.textContent = result.composition;
      setText(root, "[data-step-status]", result.status);
    }

    const player = createPlayer(root, example.steps.length, render);
    function update() {
      const scenario = config.scenarios[state.scenario];
      press(root, "mc-example", state.scenario);
      press(root, "mc-route", state.route);
      root.querySelector("[data-mc-route-group]").hidden = state.scenario !== "iro";
      setText(root, "[data-mc-scenario-label]", scenario.label);
      setText(root, "[data-mc-scenario-name]", scenario.name);
      player.finish();
    }
    onAction(root, (action, value) => {
      if (action === "mc-example") state.scenario = value;
      else if (action === "mc-route") state.route = value;
      else return;
      update();
    });
    update();
  }

  /* ---------------------------------------------------------------- MC-MKE: results */

  const METRICS = ["reliability", "consistency", "locality", "image_generality", "text_generality"];
  const fixed = (value) => value.toFixed(2);

  // Mirrors multimodal_status() in scripts/paper_demo_knowledge.py.
  function multimodalStatus(config, model, scenario, method) {
    const results = config.results[model][scenario];
    const values = results[method];
    const r = values.reliability;
    const c = values.consistency;
    const loc = values.locality;
    const place = config.scenarios[scenario].label + ", " + config.models[model].label;
    const locText = loc === null ? "not evaluated" : fixed(loc);
    let text = method + " on " + place + ": reliability " + fixed(r) + ", consistency " + fixed(c) + ", locality " + locText + ".";
    const ftLlm = results["FT(LLM)"];
    if (method === "SERAC" && r === ftLlm.reliability && c === ftLlm.consistency) {
      text += " Reliability and consistency equal FT(LLM) exactly: SERAC's counterfactual model is the LLM fine-tuned on the edit " +
        "(Appendix B); its classifier, which decides when to use that model, separates their locality (" + fixed(ftLlm.locality) + " for FT(LLM)).";
    } else if (r - c >= 40) {
      text += " The edited answer appears on " + fixed(r) + "% of edit inputs, but the linked answer follows on only " + fixed(c) + "%.";
    } else if (scenario !== "ie" && c >= 70 && loc !== null && loc < 10) {
      text += " High consistency with locality near zero: here the linked answer equals the edited answer, so repeating " +
        "the new target also passes. On IE_edit the same method reaches " + fixed(config.results[model].ie[method].consistency) + ".";
    }
    if (c > r) text += " Consistency can exceed reliability: consistency is scored only on samples whose linked answer changes (Section 4.2).";
    if (loc === null) text += " Locality and image generality were not evaluated because the models do not accept multiple images.";
    return text;
  }

  function metricCell(value) {
    const cell = node("td");
    if (value === null) {
      const dash = node("span", "", "—");
      dash.setAttribute("aria-hidden", "true");
      cell.append(dash, node("span", "kd-sr", "not evaluated"));
    } else {
      cell.textContent = fixed(value);
    }
    return cell;
  }

  function attachMultimodalResults(root, config) {
    const state = Object.assign({}, config.initial);

    function update() {
      const scenario = config.scenarios[state.scenario];
      const results = config.results[state.model][state.scenario];
      press(root, "mc-scenario", state.scenario);
      press(root, "mc-model", state.model);
      press(root, "mc-method", state.method);
      setText(root, "[data-mc-scenario-label]", scenario.label);
      setText(root, "[data-mc-table]", scenario.table);
      setText(root, "[data-mc-model-label]", config.models[state.model].label);

      root.querySelectorAll("[data-mc-plot]").forEach((plot) => {
        const visible = plot.dataset.mcPlot === state.model + "-" + state.scenario;
        plot.toggleAttribute("hidden", !visible);
        plot.querySelectorAll("[data-mc-method]").forEach((point) => {
          const selected = point.dataset.mcMethod === state.method;
          point.classList.toggle("is-selected", selected);
          // Draw the selected point last so it sits above its neighbours.
          if (selected) point.parentNode.appendChild(point);
        });
        plot.querySelectorAll("[data-mc-methods]").forEach((label) => {
          label.classList.toggle("is-selected", label.dataset.mcMethods.split("|").includes(state.method));
        });
      });

      root.querySelector("[data-mc-metrics]").replaceChildren(...config.methods.map((name) => {
        const row = node("tr");
        row.dataset.mcRow = name;
        row.classList.toggle("is-selected", name === state.method);
        const head = node("th", "", name);
        head.scope = "row";
        row.append(head, ...METRICS.map((key) => metricCell(results[name][key])));
        return row;
      }));
      root.querySelector("[data-mc-components]").replaceChildren(...["FT", "MEND"].map((family) => {
        const vision = results[family + "(Vision)"].consistency;
        const llm = results[family + "(LLM)"].consistency;
        const row = node("tr");
        row.dataset.mcFamily = family;
        const head = node("th", "", family);
        head.scope = "row";
        row.append(head, ...[vision, llm].map((value) => node("td", value === Math.max(vision, llm) ? "is-higher" : "", fixed(value))));
        return row;
      }));
      setText(root, "[data-mc-status]", multimodalStatus(config, state.model, state.scenario, state.method));
    }

    onAction(root, (action, value) => {
      if (action === "mc-scenario") state.scenario = value;
      else if (action === "mc-model") state.model = value;
      else if (action === "mc-method") state.method = value;
      else return;
      update();
    });
    update();
  }

  /* ---------------------------------------------------------------- EchoQA */

  function attachComposition(root) {
    let withContext = true;

    function updateCase() {
      setText(root, "[data-echo-context]", withContext ? "Myotis lucifralis shares a roost with Myotis nattereri." : "No contextual knowledge is supplied. The question and answer choices remain the same.");
      setText(root, "[data-echo-entity]", withContext ? "Myotis nattereri" : "Myotis lucifugus");
      setText(root, "[data-echo-hop1]", withContext ? "The response follows the supplied relationship." : "The response substitutes the familiar name Myotis lucifugus for the fictional species and reasons about that bat.");
      setText(root, "[data-echo-recalled]", withContext ? "Not resolved from memory" : "Bats eat insects; Noctuidae are moths");
      setText(root, "[data-echo-hop2]", withContext ? "The response notices that the context does not list the prey and ultimately abstains." : "It selects the biologically plausible moth option, without establishing the co-roosting relationship in the question.");
      setText(root, "[data-echo-answer]", withContext ? "Unknown" : "Noctuidae");
      setText(root, "[data-echo-diagnosis]", withContext ? "It identifies the intermediate species correctly but fails to complete the memory-dependent link." : "The final choice matches the answer key, but the route to it is an unsupported shortcut. Correct selection alone does not establish successful composition.");
      root.querySelector("[data-echo-second-hop]").classList.toggle("is-blocked", withContext);
      root.querySelector("[data-echo-first-hop]").classList.toggle("is-blocked", !withContext);
      root.querySelector('[data-demo-action="echo-no-context"]').setAttribute("aria-pressed", String(!withContext));
      root.querySelector('[data-demo-action="echo-with-context"]').setAttribute("aria-pressed", String(withContext));
    }

    onAction(root, (action) => {
      if (action !== "echo-no-context" && action !== "echo-with-context") return;
      withContext = action === "echo-with-context";
      updateCase();
    });
    updateCase();
  }

  /* ---------------------------------------------------------------- Initialization */

  const ATTACH = {
    "knowledge-temporal-sequence": attachTemporalSequence,
    "knowledge-temporal-results": attachTemporalResults,
    "knowledge-multimodal-propagation": attachMultimodalPropagation,
    "knowledge-multimodal-results": attachMultimodalResults,
    "knowledge-evidence-composition": attachComposition,
  };

  function initialize() {
    document.querySelectorAll('[data-paper-demo^="knowledge-"]').forEach((root) => {
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
        // Keep the complete static state visible if initialization fails.
        console.warn("Knowledge demo could not initialize.", error);
      }
    });
  }

  window.KnowledgeDemo = { linkStatus, cellFlag, sequenceStatus, propagationState, temporalStatus, multimodalStatus };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
