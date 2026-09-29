/* Knowledge demos. The server renders a complete initial state; this script only
 * reveals the controls and re-renders the same markup from the measured values in
 * data-demo-config. It never calls a model or the network. */
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

  /* ---------------------------------------------------------------- History Matters */

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

  function probeRow(item) {
    const row = node("tr");
    const prompt = node("td");
    const cloze = node("span", "kd-cloze", item.prompt);
    const blank = node("span", "kd-blank", " ____");
    blank.setAttribute("aria-hidden", "true");
    cloze.append(blank);
    prompt.append(cloze);
    if (item.question) prompt.append(node("span", "kd-probe-question", "Question format: " + item.question));
    row.append(prompt, node("td", "", item.answer));
    return row;
  }

  function attachTemporal(root, config) {
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
      const probe = config.probes[state.setting][state.form];
      const targets = probe.items.map((item) => item.link);

      press(root, "hm-setting", state.setting);
      press(root, "hm-form", state.form);
      press(root, "hm-editor", state.editor);
      root.querySelectorAll('[data-demo-action="hm-form"]').forEach((button) => {
        button.hidden = !setting.forms.includes(button.dataset.value);
      });
      root.querySelectorAll("[data-hm-link]").forEach((period) => {
        const index = Number(period.dataset.hmLink);
        period.classList.toggle("is-target", targets.includes(index));
        period.classList.toggle("is-outside", state.setting === "se" && index === 2);
      });

      setText(root, "[data-hm-code]", state.form);
      setText(root, "[data-hm-form-name]", config.forms[state.form].name);
      setText(root, "[data-hm-when]", probe.when);
      setText(root, "[data-hm-note]", probe.note);
      setText(root, "[data-hm-setting-name]", setting.name);
      root.querySelector("[data-hm-probes]").replaceChildren(...probe.items.map(probeRow));

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

  /* ---------------------------------------------------------------- MC-MKE */

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

  function roleClass(role) {
    if (role.startsWith("Edited")) return "edit";
    return role.startsWith("Must follow") ? "check" : "fixed";
  }

  function attachMultimodal(root, config) {
    const state = Object.assign({}, config.initial);

    function update() {
      const scenario = config.scenarios[state.scenario];
      const results = config.results[state.model][state.scenario];
      press(root, "mc-scenario", state.scenario);
      press(root, "mc-model", state.model);
      press(root, "mc-method", state.method);

      setText(root, "[data-mc-scenario-label]", scenario.label);
      setText(root, "[data-mc-scenario-name]", scenario.name);
      setText(root, "[data-mc-table]", scenario.table);
      setText(root, "[data-mc-model-label]", config.models[state.model].label);
      setText(root, "[data-mc-answers]", scenario.answers);
      ["ie", "sro", "iro"].forEach((key) => {
        const row = root.querySelector('[data-mc-knowledge="' + key + '"]');
        const statement = scenario.rows[key];
        const was = row.querySelector("[data-mc-was]");
        row.className = "kd-role-" + roleClass(statement.role);
        row.querySelector("[data-mc-text]").textContent = statement.text;
        was.hidden = !statement.was;
        was.textContent = statement.was ? "previously " + statement.was : "";
        row.querySelector("[data-mc-role]").textContent = statement.role;
      });

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
    let condition = "neutral";
    const conditions = {
      none: {
        instruction: "Answer using your own commonsense knowledge. Choose Unknown if you cannot answer. No complementary context is supplied.",
        result: "23.89% of answers are Unknown without context. A correct selection can still come from a shortcut, as the recorded case illustrates.",
      },
      neutral: {
        instruction: "Combine the supplied information with your own knowledge; choose Unknown if you cannot answer. The neutral instruction already asks for internal knowledge.",
        result: "Unknown answers rise from 23.89% without context to 62.72% with complementary context and the neutral instruction: +38.83 percentage points.",
      },
      trust: {
        instruction: "The supplied context is explicitly described as insufficient on its own. The model is instructed to use its internal knowledge together with that context.",
        result: "Explicit guidance lowers Unknown answers from 62.72% to 23.88%: −38.84 percentage points. This assistance assumes we know that internal knowledge is required.",
      },
      gold: {
        instruction: "Both necessary knowledge sources are written into the context. The model receives the same neutral instruction, but no longer has to bridge context and parametric memory.",
        result: "Unknown answers fall to 0.08% with all necessary facts in context. This measures abstention, not whether every non-abstaining answer is correct.",
      },
    };

    function updateCase() {
      setText(root, "[data-echo-context]", withContext ? "Myotis lucifralis shares a roost with Myotis nattereri." : "No contextual knowledge is supplied. The question and answer choices remain the same.");
      setText(root, "[data-echo-entity]", withContext ? "Myotis nattereri" : "Myotis lucifugus");
      setText(root, "[data-echo-hop1]", withContext ? "The response follows the supplied relationship." : "The response substitutes the familiar name Myotis lucifugus for the fictional species and reasons about that bat.");
      setText(root, "[data-echo-recalled]", withContext ? "Not resolved from memory" : "Bats eat insects; Noctuidae are moths");
      setText(root, "[data-echo-hop2]", withContext ? "The response notices that the context does not list the prey and ultimately abstains." : "It selects the biologically plausible moth option, without establishing the co-roosting relationship in the question.");
      setText(root, "[data-echo-answer]", withContext ? "Unknown" : "Noctuidae");
      setText(root, "[data-echo-diagnosis]", withContext ? "It identifies the intermediate species correctly but fails to complete the memory-dependent link." : "The final choice matches the answer key, but the route to it is an unsupported shortcut. Correct selection alone does not establish successful composition.");
      root.querySelector("[data-echo-second-hop]").classList.toggle("is-blocked", withContext);
      root.querySelector(".kd-echo-trace > div:first-child").classList.toggle("is-blocked", !withContext);
      root.querySelector('[data-demo-action="echo-no-context"]').setAttribute("aria-pressed", String(!withContext));
      root.querySelector('[data-demo-action="echo-with-context"]').setAttribute("aria-pressed", String(withContext));
    }

    function updateCondition() {
      setText(root, "[data-echo-instruction]", conditions[condition].instruction);
      setText(root, "[data-echo-aggregate]", conditions[condition].result);
      root.querySelectorAll("[data-echo-rate]").forEach((row) => row.classList.toggle("is-selected", row.dataset.echoRate === condition));
      root.querySelectorAll('[data-demo-action="echo-condition"]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.condition === condition)));
    }

    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-demo-action]");
      if (!button || !root.contains(button)) return;
      if (button.dataset.demoAction === "echo-no-context" || button.dataset.demoAction === "echo-with-context") {
        withContext = button.dataset.demoAction === "echo-with-context";
        updateCase();
      } else if (button.dataset.demoAction === "echo-condition") {
        condition = button.dataset.condition;
        updateCondition();
      }
    });
    updateCase();
    updateCondition();
  }

  /* ---------------------------------------------------------------- Initialization */

  function initialize() {
    document.querySelectorAll('[data-paper-demo^="knowledge-"]').forEach((root) => {
      if (root.dataset.demoReady === "true") return;
      try {
        const config = JSON.parse(root.dataset.demoConfig);
        if (config.type === "temporal-editing") attachTemporal(root, config);
        else if (config.type === "evidence-composition") attachComposition(root);
        else if (config.type === "multimodal-consistency") attachMultimodal(root, config);
        else return;
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
