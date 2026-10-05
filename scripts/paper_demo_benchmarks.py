"""Server-rendered demos for three benchmark papers: ALCUNA, the knowledge-boundary
study (PGDC), and the self-generated-documents study.

- ALCUNA: KnowGen builds the paper's Figure 1 entity from Alpaca by heredity,
  variation, dropout, and extension (Algorithm 1). The reader switches operations
  and plays the construction; the Figure 1 questions are derived from the result.
- Knowledge boundary: Table 1 for all four backbones, true-fact sets against
  counterfactual or fabricated sets, with the paper's printed probe inputs.
- Self-generated documents: the eight-type style taxonomy with Tables 2, 10, and 12.

Each demo renders a complete state without JavaScript; papers/demos/benchmarks.js
reveals the controls and re-renders the same markup from data-demo-config.
"""

from __future__ import annotations

import json
from html import escape
from typing import Any

Demo = dict[str, Any]

SUPPORTED = {"alcuna", "knowledge-boundary", "self-generated-documents"}
MINUS = "−"


def _text(value: object) -> str:
    return escape(str(value), quote=True)


def _class(*names: str) -> str:
    joined = " ".join(name for name in names if name)
    return f' class="{joined}"' if joined else ""


def _button(action: str, label: str, selected: bool = False, value: str | None = None) -> str:
    data_value = f' data-value="{_text(value)}"' if value is not None else ""
    return (
        f'<button type="button" data-demo-action="{_text(action)}"{data_value} '
        f'aria-pressed="{str(selected).lower()}">{_text(label)}</button>'
    )


def _fieldset(legend: str, buttons: str) -> str:
    return f'<fieldset><legend>{_text(legend)}</legend><div class="bm-buttons">{buttons}</div></fieldset>'


def _signed(value: float, digits: int = 1) -> str:
    text = f"{value:+.{digits}f}"
    if float(text) == 0:
        text = f"{0:.{digits}f}"
    return text.replace("-", MINUS)


STATIC_NOTE = "This is the initial selection. Enable JavaScript to change the selection."


def _shell(slug: str, kind: str, demo: Demo, config: Demo, body: str, note: str = STATIC_NOTE) -> str:
    ident = f"{slug}-benchmark-demo-title"
    data = _text(json.dumps(config, ensure_ascii=False))
    return f"""
<section class="benchmarks-demo" data-paper-demo="benchmarks-{_text(kind)}" data-demo-config="{data}" aria-labelledby="{_text(ident)}">
  <header class="bm-heading">
    <p class="bm-eyebrow">{_text(demo["eyebrow"])}</p>
    <h3 id="{_text(ident)}">{_text(demo["title"])}</h3>
    <p>{_text(demo["description"])}</p>
  </header>
  {body}
  <noscript><p class="bm-small">{_text(note)}</p></noscript>
</section>
"""


# --------------------------------------------------------------------------- ALCUNA: KnowGen

OPERATIONS = ("heredity", "variation", "dropout", "extension")
STEP_ORDER = ("start", "heredity", "variation", "dropout", "extension", "name", "questions")
SET_NAMES = {"KU": "Knowledge understanding", "KD": "Knowledge differentiation", "KA": "Knowledge association"}


def property_state(prop: Demo, enabled: dict[str, bool]) -> str:
    """Operation that a printed property undergoes. Mirrored by propertyState() in benchmarks.js.

    Figure 1 assigns each property one operation (Algorithm 1's random split). When that
    operation is switched off, the property stays in the heredity set, or, with heredity
    also off, is not carried over.
    """
    op = prop["op"]
    if op == "extension":
        return "extension" if enabled["extension"] else "absent"
    if enabled[op]:
        return op
    return "heredity" if enabled["heredity"] else "absent"


def _question(demo: Demo, pid: str, state: str) -> Demo:
    """The question a property yields under its operation (Section 2.4 question sets)."""
    q = demo["questions"].get(pid, {})
    props = {p["id"]: p for p in demo["properties"] + demo["sibling_properties"]}
    prop = props[pid]
    label = prop["label"]
    none = {"id": pid, "set": "", "text": q.get("text", ""), "answer": "", "depends": [], "source": "",
            "parent": "", "parent_right": None}
    if state == "absent":
        what = "relation" if prop.get("relation") else "triplet"
        return none | {"reason": f"Not generated: Alcuna has no {label} {what}."}
    base = {"id": pid, "text": q["text"], "reason": ""}
    if pid == "diet":
        return base | {"set": "KU", "answer": q["answer"], "depends": ["heredity"], "source": "Figure 1",
                       "parent": prop["value"], "parent_right": True}
    if pid == "body-mass":
        if state == "variation":
            return base | {"set": "KD", "answer": q["answer"], "depends": ["variation"], "source": "Figure 1",
                           "parent": "Yes.", "parent_right": False}
        return base | {"set": "KU", "answer": "Yes.", "depends": ["heredity"], "source": "Derived",
                       "parent": "Yes.", "parent_right": True}
    if pid == "life-span":
        if state == "dropout":
            return base | {"set": "KD", "answer": q["answer"], "depends": ["dropout"], "source": "Figure 1",
                           "parent": prop["value"], "parent_right": False}
        return base | {"set": "KU", "answer": prop["value"], "depends": ["heredity"], "source": "Derived",
                       "parent": prop["value"], "parent_right": True}
    if pid == "eaten-by":
        if state == "variation":
            return base | {"set": "KA", "answer": q["answer"], "depends": ["variation", "existing"], "source": "Figure 1",
                           "parent": "no answer (Figure 1 prints no competitor of Cougar)", "parent_right": None}
        return none | {"reason": f"Not generated: with (Alcuna, Eaten by, {prop['value']}), no printed relation leads from "
                                 f"{prop['value']} to a competitor, so no reasoning chain exists."}
    if pid == "first-appearance":
        return base | {"set": "KU", "answer": q["answer"], "depends": ["extension"], "source": "Figure 1",
                       "parent": "no answer (not among Alpaca's printed properties)", "parent_right": None}
    raise ValueError(f"ALCUNA: no question rule for {pid}")


def knowgen_state(demo: Demo, enabled: dict[str, bool]) -> Demo:
    """The artificial entity, its questions, and the build steps. Mirrored by knowgenState() in benchmarks.js."""
    props = []
    for prop in demo["properties"]:
        state = property_state(prop, enabled)
        value = prop["varied"] if state == "variation" else prop["value"]
        props.append({"id": prop["id"], "label": prop["label"], "state": state, "value": value,
                      "from": prop["value"], "relation": bool(prop.get("relation"))})
    for prop in demo["sibling_properties"]:
        if prop.get("op") == "extension":
            state = property_state(prop, enabled)
            props.append({"id": prop["id"], "label": prop["label"], "state": state, "value": prop["value"],
                          "from": prop["value"], "relation": False})
    order = ["diet", "first-appearance", "body-mass", "life-span", "eaten-by"]
    states = {p["id"]: p["state"] for p in props}
    questions = [_question(demo, pid, states[pid]) for pid in order]
    generated = [q for q in questions if q["set"]]
    counts = {name: sum(q["set"] == name for q in generated) for name in SET_NAMES}
    present = [p for p in props if p["state"] not in ("absent", "dropout")]
    identical = sum(p["state"] == "heredity" for p in present)
    used = {p["state"] for p in props}
    steps = [s for s in STEP_ORDER if s in ("start", "name", "questions") or s in used]
    return {
        "properties": props,
        "questions": questions,
        "counts": counts,
        "parent_right": sum(bool(q["parent_right"]) for q in generated),
        "generated": len(generated),
        "identical": identical,
        "present": len(present),
        "steps": steps,
    }


def knowgen_status(demo: Demo, state: Demo, step: str) -> str:
    """Describe one build step. Mirrored by knowgenStatus() in benchmarks.js."""
    parent, sibling = demo["parent"], demo["sibling"]
    by_state: dict[str, list[Demo]] = {}
    for prop in state["properties"]:
        by_state.setdefault(prop["state"], []).append(prop)
    if step == "start":
        return (f"Start from the class {demo['class']}: the parent {parent['name']} and its sibling {sibling['name']}. "
                f"Algorithm 1 splits {parent['name']}'s properties into heredity, variation, and dropout sets.")
    if step == "heredity":
        kept = ", ".join(f"{p['label']}: {p['value']}" for p in by_state["heredity"])
        return f"Heredity: Alcuna keeps {kept}, as well as {parent['name']}'s other properties."
    if step == "variation":
        parts = []
        for p in by_state["variation"]:
            source = next(item for item in demo["properties"] if item["id"] == p["id"])
            parts.append(f"{p['label']} {p['from']} → {p['value']} ({source['how']})")
        return "Variation: " + "; ".join(parts) + "."
    if step == "dropout":
        dropped = ", ".join(p["label"] for p in by_state["dropout"])
        return f"Dropout: {dropped} is removed, so Alcuna has no such triplet."
    if step == "extension":
        added = ", ".join(f"{p['label']}: {p['value']}" for p in by_state["extension"])
        return f"Extension: {added} is copied from the sibling {sibling['name']}."
    if step == "name":
        return (f"Name: the first subword of {parent['name']} ({parent['parts'][0]}) and the second subword of "
                f"{sibling['name']} ({sibling['parts'][1]}) give {demo['entity']}.")
    counts = state["counts"]
    if state["generated"] == 0:
        return "Questions: none. Alcuna carries none of the printed properties, so no question can be generated."
    text = (f"Questions: KU {counts['KU']}, KD {counts['KD']}, KA {counts['KA']}. "
            f"Answering from {parent['name']}'s printed properties alone gets {state['parent_right']} of "
            f"{state['generated']} right.")
    if counts["KD"] == 0:
        text += f" With no varied or dropped property, nothing tests whether a model separates Alcuna from {parent['name']}."
    if counts["KA"] == 0:
        text += " No question links the new entity to existing knowledge."
    return text


def _kg_tag(state: str) -> str:
    return f'<span class="bm-op" data-op="{_text(state)}">[{_text(state)}]</span>'


def _kg_new_items(state: Demo) -> str:
    items = []
    for prop in state["properties"]:
        if prop["state"] == "absent":
            continue
        if prop["state"] == "dropout":
            body = f'<s>{_text(prop["label"])}</s> {_kg_tag("dropout")}'
        else:
            body = f'{_text(prop["label"])}: {_text(prop["value"])} {_kg_tag(prop["state"])}'
        items.append(f'<li data-kg-prop="{_text(prop["id"])}" data-kg-op="{_text(prop["state"])}">{body}</li>')
    return "".join(items)


def _kg_questions(state: Demo) -> str:
    rows = []
    for q in state["questions"]:
        if not q["set"]:
            rows.append(
                f'<li class="bm-q is-none" data-kg-q="{_text(q["id"])}"><span class="bm-q-set">—</span>'
                f'<div><p class="bm-q-text">{_text(q["text"])}</p><p class="bm-q-meta">{_text(q["reason"])}</p></div></li>'
            )
            continue
        depends = ", ".join("existing knowledge (Jaguar, Compete with, Maned Wolf)" if d == "existing" else d for d in q["depends"])
        parent = q["parent"] if q["parent_right"] is None else f'{q["parent"]} ({"right" if q["parent_right"] else "wrong"})'
        rows.append(
            f'<li class="bm-q" data-kg-q="{_text(q["id"])}" data-kg-set="{_text(q["set"])}">'
            f'<span class="bm-q-set" title="{_text(SET_NAMES[q["set"]])}">{_text(q["set"])}</span>'
            f'<div><p class="bm-q-text">{_text(q["text"])}</p>'
            f'<p class="bm-q-answer">Expected answer: <strong data-kg-answer>{_text(q["answer"])}</strong></p>'
            f'<p class="bm-q-meta"><span>Depends on: {_text(depends)}</span>'
            f'<span>From Alpaca alone: {_text(parent)}</span>'
            f'<span class="bm-q-source" data-source="{_text(q["source"])}">{"Published · Figure 1" if q["source"] == "Figure 1" else "Derived here by Algorithm 1"}</span></p></div></li>'
        )
    return "".join(rows)


def _knowgen(slug: str, demo: Demo) -> str:
    enabled = {op: True for op in OPERATIONS}
    state = knowgen_state(demo, enabled)
    step_labels = {"start": "Start", "heredity": "Heredity", "variation": "Variation", "dropout": "Dropout",
                   "extension": "Extension", "name": "Name", "questions": "Questions"}
    toggles = "".join(_button("kg-op", op.capitalize(), True, op) for op in OPERATIONS)
    jumps = "".join(_button("goto", step_labels[s], i == len(state["steps"]) - 1, str(i)) for i, s in enumerate(state["steps"]))
    parent, sibling = demo["parent"], demo["sibling"]
    parent_items = "".join(
        f'<li data-kg-src="{_text(p["id"])}">{_text(p["label"])}: {_text(p["value"])}</li>' for p in demo["properties"]
    ) + "<li>Other properties…</li>"
    sibling_items = "".join(
        f'<li data-kg-src="{_text(p["id"])}">{_text(p["label"])}: {_text(p["value"])}</li>' for p in demo["sibling_properties"]
    )
    existing = demo["existing"]
    relations = "".join(f"<li>{_text(a)} — {_text(r)} → {_text(b)}</li>" for a, r, b in existing["relations"])
    ops = "".join(f'<li><strong>{_text(op.capitalize())}</strong> {_text(text.split(" ", 1)[1])}</li>'
                  for op, text in demo["operations"].items())

    def split(name: Demo) -> str:
        first, second = name["parts"]
        return f'<span class="bm-sub">{_text(first)}</span>{_text(second)}' if name is parent else f'{_text(first)}<span class="bm-sub">{_text(second)}</span>'

    config = {key: demo[key] for key in ("type", "class", "parent", "sibling", "entity", "properties",
                                         "sibling_properties", "existing", "questions")}
    body = f"""
  <div class="bm-controls" data-demo-controls hidden>
    {_fieldset("Operations", toggles)}
  </div>
  <div class="bm-player" data-demo-controls hidden>
    <div class="bm-buttons bm-transport" role="group" aria-label="Animation">
      <button type="button" data-demo-action="play" aria-pressed="false">Play</button>
      <button type="button" data-demo-action="step" disabled>Step</button>
      <button type="button" data-demo-action="reset">Reset</button>
    </div>
    <div class="bm-buttons bm-steps" role="group" aria-label="Show step" data-kg-steps>{jumps}</div>
  </div>
  <p class="bm-step-status" data-step-status data-demo-state="step" role="status" aria-live="polite">{_text(knowgen_status(demo, state, "questions"))}</p>
  <div class="bm-kg">
    <div class="bm-kg-existing">
      <div class="bm-kg-card" data-kg-card="parent"><p class="bm-label">Existing · {_text(demo["class"])} · parent</p>
        <h4>{split(parent)}</h4><ul>{parent_items}</ul></div>
      <div class="bm-kg-card" data-kg-card="sibling"><p class="bm-label">Existing · {_text(demo["class"])} · sibling</p>
        <h4>{split(sibling)}</h4><ul>{sibling_items}</ul></div>
      <div class="bm-kg-card" data-kg-card="world"><p class="bm-label">Existing · {_text(existing["class"])}</p>
        <h4>{_text(", ".join(existing["members"]))}</h4><ul>{relations}<li>{_text(parent["name"])} and {_text(sibling["name"])} — Eaten by → Cougar</li></ul></div>
    </div>
    <div class="bm-kg-card bm-kg-new" data-kg-card="new"><p class="bm-label">Artificial entity</p>
      <h4 data-kg-name>{_text(demo["entity"])}</h4>
      <p class="bm-small" data-kg-name-note>{_text(parent["parts"][0])} from {_text(parent["name"])} + {_text(sibling["parts"][1])} from {_text(sibling["name"])}</p>
      <ul data-kg-props>{_kg_new_items(state)}</ul>
      <p class="bm-small" data-kg-others>Other properties inherited from {_text(parent["name"])}…</p>
      <p class="bm-small" data-kg-similarity>{state["identical"]} of {state["present"]} printed properties identical to {_text(parent["name"])}'s.</p>
    </div>
  </div>
  <div class="bm-kg-questions">
    <h4>Questions generated from the entity</h4>
    <p class="bm-small" data-kg-q-pending hidden>Questions are generated once the entity is built.</p>
    <ol class="bm-q-list" data-kg-questions>{_kg_questions(state)}</ol>
    <ul class="bm-ops">{ops}</ul>
  </div>
  <p class="bm-provenance">Example: <a href="{_text(demo["source_url"])}">Figure 1, Algorithm 1, and Sections 2.3–2.4</a> of the EMNLP 2023 paper. With all four operations on, the entity and the five questions are exactly those printed in Figure 1. Other switch settings apply Algorithm 1's rules to the same printed properties; their question sets and answers are derived here and labelled so. KD questions come from varied and dropped attributes, KA questions from relation chains found by breadth-first search, and KU questions from the remaining properties (Section 2.4). The real benchmark has 11.75 property triplets per entity on average; Figure 1 prints five.</p>"""
    return _shell(slug, "knowgen", demo, config, body,
                  "This is the Figure 1 entity with all operations on. Enable JavaScript to switch operations and replay the construction.")


# --------------------------------------------------------------------------- Knowledge boundary: Table 1

MODELS = ("GPT-2", "GPT-J", "LLaMA2", "Vicuna")


def _validate_boundary(demo: Demo) -> None:
    for model in MODELS:
        alcuna = demo["results"]["alcuna"][model]
        for base in ("zero", "few", "dis"):
            # ALCUNA has a single expression per query, so P- equals the plain baseline.
            if alcuna[base] != alcuna["P-" + base]:
                raise ValueError(f"Knowledge boundary: ALCUNA P-{base} differs from {base} for {model}")
        if demo["pgdc_cfact_table3"][model] != demo["results"]["cfact"][model]["PGDC"]:
            raise ValueError(f"Knowledge boundary: Table 3 PGDC differs from Table 1 for {model}")


def _pct(value: float) -> str:
    return f"{value:.2f}%"


def _order(demo: Demo, dataset: str, method: str) -> list[str]:
    values = demo["results"][dataset]
    return sorted(MODELS, key=lambda m: -values[m][method])


def boundary_status(demo: Demo, true_key: str, false_key: str, method: str) -> str:
    """Describe one probe across backbones. Mirrored by boundaryStatus() in benchmarks.js."""
    sets = demo["datasets"]
    t_label, f_label = sets[true_key]["label"], sets[false_key]["label"]
    if method == "AutoPrompt":
        values = ", ".join(f"{m} {_pct(demo['autoprompt_cfact'][m])}" for m in MODELS)
        return (f"AutoPrompt on CFACT (Table 3): {values}. It is tested only on counterfactual facts: without a semantic "
                f"constraint, its trigger tokens force the false target far more often than PGDC "
                f"({', '.join(_pct(demo['pgdc_cfact_table3'][m]) for m in MODELS)}).")
    t = demo["results"][true_key]
    f = demo["results"][false_key]
    pairs = ", ".join(f"{m} {_pct(t[m][method])} / {_pct(f[m][method])}" for m in MODELS)
    text = f"{method} · {t_label} ↑ / {f_label} ↓: {pairs}."
    ratios = [round(100 * f[m][method] / t[m][method]) for m in MODELS]
    if max(f[m][method] for m in MODELS) == 0:
        text += f" It never elicits a {f_label} target."
    else:
        span = f"{min(ratios)}%" if min(ratios) == max(ratios) else f"{min(ratios)}–{max(ratios)}%"
        text += f" Across the four backbones, false-target success equals {span} of true-fact success."
        over = [m for m, r in zip(MODELS, ratios) if r >= 100]
        if over:
            text += f" For {', '.join(over)} it is at least as high as true-fact success."
    best = [m for m in MODELS if t[m][method] == max(t[m].values())]
    if best:
        text += f" Highest {t_label} success of all seven probes for {', '.join(best)}."
    order = _order(demo, true_key, method)
    text += f" Backbone order on {t_label}: {' > '.join(order)}"
    if method != "PGDC":
        reference = _order(demo, true_key, "PGDC")
        text += "; PGDC gives the same order." if order == reference else f"; PGDC gives {' > '.join(reference)}."
    else:
        text += "."
    base = method.removeprefix("P-")
    if base in ("zero", "few", "dis"):
        gains_t = [t[m]["P-" + base] - t[m][base] for m in MODELS]
        gains_f = [f[m]["P-" + base] - f[m][base] for m in MODELS]
        text += (f" Counting any listed paraphrase ({base} → P-{base}) changes {t_label} by "
                 f"{_signed(min(gains_t), 2)} to {_signed(max(gains_t), 2)} points")
        if false_key == "alcuna":
            text += "; ALCUNA has one expression per query, so the two coincide there."
        else:
            text += f" and {f_label} by {_signed(min(gains_f), 2)} to {_signed(max(gains_f), 2)} points."
        lower = [m for m, g in zip(MODELS, gains_t) if g < 0]
        if lower:
            text += f" The paper prints a lower P-{base} than {base} value on {t_label} for {', '.join(lower)}."
    return text


def _bar(value: float | None, kind: str) -> str:
    if value is None:
        return '<td class="bm-na"><span class="bm-value">not reported</span></td>'
    return (f'<td><span class="bm-bar is-{kind}" aria-hidden="true"><i style="width:{value:.2f}%"></i></span>'
            f'<span class="bm-value">{_pct(value)}</span></td>')


def _boundary_rows(demo: Demo, model: str, true_key: str, false_key: str, method: str) -> str:
    rows = []
    for name in demo["methods"]:
        rows.append(
            f'<tr data-kb-method="{_text(name)}"{_class("is-selected" if name == method else "")}><th scope="row">{_text(name)}</th>'
            f'{_bar(demo["results"][true_key][model][name], "true")}{_bar(demo["results"][false_key][model][name], "false")}</tr>'
        )
    hidden = "" if false_key == "cfact" else " hidden"
    rows.append(
        f'<tr data-kb-method="AutoPrompt" data-kb-autoprompt{_class("is-selected" if method == "AutoPrompt" else "")}{hidden}>'
        f'<th scope="row">AutoPrompt</th>{_bar(None, "true")}{_bar(demo["autoprompt_cfact"][model], "false")}</tr>'
    )
    return "".join(rows)


def _bracketed(text: str) -> str:
    """Show the bracketed target of a Table 4 input as the answer."""
    escaped = _text(text)
    if "[" in escaped and "]" in escaped:
        start, end = escaped.index("["), escaped.index("]")
        escaped = escaped[:start] + f'<mark>{escaped[start + 1:end]}</mark>' + escaped[end + 1:]
    return escaped


def _input_block(demo: Demo, key: str, method: str) -> str:
    base = method.removeprefix("P-")
    sample = demo["inputs"][key][base]
    lines = sample if isinstance(sample, list) else [sample]
    body = "".join(f"<li>{_bracketed(line)}</li>" for line in lines)
    label = demo["datasets"][key]["label"]
    kind = "true fact" if demo["datasets"][key]["kind"] == "true" else "false target"
    return f'<div class="bm-input"><p class="bm-label">{_text(label)} · {kind}</p><ol>{body}</ol></div>'


def boundary_inputs_note(demo: Demo, false_key: str, method: str) -> str:
    """Explain what counts as success for the selected probe. Mirrored by inputsNote() in benchmarks.js."""
    base = method.removeprefix("P-")
    if method == "PGDC":
        return ("PGDC starts from the original cloze prompt and edits its embeddings; the paper's Table 2 prints three "
                "prompts it changed successfully (dataset and backbone not stated). The target answer may appear after "
                "generated tokens, not only first.")
    if method == "AutoPrompt":
        return ("AutoPrompt extends the question with five trigger tokens, initialized with the prompt's last token and "
                "updated for three rounds (Appendix E). It has no semantic constraint.")
    note = {"zero": "The model must produce the bracketed answer after the cloze prompt.",
            "few": "Four retrieved examples precede the query (Table 4 prints two). The model must produce the bracketed answer.",
            "dis": "The model judges a statement; success is the bracketed True."}[base]
    if method.startswith("P-"):
        note += " The P- variant sends one such input per listed paraphrase and counts the fact as known if any succeeds."
    false_label = demo["datasets"][false_key]["label"]
    note += f" On {false_label} the target is false, so every success counts against the probe."
    return note


def _pgdc_cases(demo: Demo) -> str:
    rows = "".join(
        f'<tr><td>{_text(c["original"])}</td><td>{_text(c["pgdc"])}</td><td>{_text(c["answer"])}</td><td>{_text(c["category"])}</td></tr>'
        for c in demo["pgdc_cases"]
    )
    return (
        '<div class="bm-table-wrap" tabindex="0" role="region" aria-label="Prompts updated by PGDC, Table 2">'
        '<table class="bm-cases"><thead><tr><th scope="col">Original prompt</th><th scope="col">PGDC prompt</th>'
        f'<th scope="col">Answer</th><th scope="col">Table 2 category</th></tr></thead><tbody>{rows}</tbody></table></div>'
    )


def _boundary(slug: str, demo: Demo) -> str:
    _validate_boundary(demo)
    true_key, false_key, method = (demo["initial"][k] for k in ("true", "false", "method"))
    sets = demo["datasets"]
    true_buttons = "".join(_button("kb-true", v["label"], k == true_key, k) for k, v in sets.items() if v["kind"] == "true")
    false_buttons = "".join(_button("kb-false", v["label"], k == false_key, k) for k, v in sets.items() if v["kind"] == "false")
    method_buttons = "".join(_button("kb-method", m, m == method, m) for m in list(demo["methods"]) + ["AutoPrompt"])
    panels = "".join(
        f'<div class="bm-panel" data-kb-model="{_text(model)}"><h4>{_text(demo["models"][model])}'
        f'<small>PGDC prompts judged meaning-preserving: {demo["semantic_preservation"][model]}%</small></h4>'
        f'<table class="bm-bars"><thead><tr><th scope="col">Probe</th>'
        f'<th scope="col"><span data-kb-true-label>{_text(sets[true_key]["label"])}</span> ↑</th>'
        f'<th scope="col"><span data-kb-false-label>{_text(sets[false_key]["label"])}</span> ↓</th></tr></thead>'
        f'<tbody data-kb-rows>{_boundary_rows(demo, model, true_key, false_key, method)}</tbody></table></div>'
        for model in MODELS
    )
    pgdc = method == "PGDC"
    inputs = "" if pgdc or method == "AutoPrompt" else _input_block(demo, true_key, method) + _input_block(demo, false_key, method)
    config = {key: demo[key] for key in ("type", "datasets", "models", "methods", "results", "autoprompt_cfact",
                                         "pgdc_cfact_table3", "inputs", "initial")}
    body = f"""
  <div class="bm-controls" data-demo-controls hidden>
    {_fieldset("True-fact set (higher is better)", true_buttons)}
    {_fieldset("Negative control (lower is better)", false_buttons)}
    {_fieldset("Probe", method_buttons)}
  </div>
  <div class="bm-panels" data-demo-state="panels">{panels}</div>
  <p class="bm-legend"><span class="bm-key-true">True-fact success</span><span class="bm-key-false">False-target success</span><span>Bars run from 0 to 100%.</span></p>
  <div class="bm-readout"><p class="bm-label">Selected probe</p>
    <p class="bm-status" data-kb-status role="status" aria-live="polite">{_text(boundary_status(demo, true_key, false_key, method))}</p></div>
  <div class="bm-inputs">
    <h4>What the probe sends: <span data-kb-method-name>{_text(method)}</span> <small data-kb-method-detail>{_text(demo["methods"].get(method, ""))}</small></h4>
    <p class="bm-small" data-kb-input-note>{_text(boundary_inputs_note(demo, false_key, method))}</p>
    <div class="bm-input-grid" data-kb-inputs{" hidden" if pgdc or method == "AutoPrompt" else ""}>{inputs}</div>
    <div data-kb-cases{"" if pgdc else " hidden"}>{_pgdc_cases(demo)}</div>
  </div>
  <p class="bm-provenance">Measured: <a href="{_text(demo["source_url"])}">Table 1</a> (success rate of eliciting the target answer, four backbones), Table 3 (AutoPrompt on CFACT), and Section 4.5 (human judgment of 200 PaRaRel samples per backbone). Inputs: Table 4 (Appendix A.2) and Table 2. PaRaRel and KAssess hold true facts; CFACT and ALCUNA hold counterfactual or fabricated ones, so a sound probe should rarely succeed on them.</p>"""
    return _shell(slug, "boundary", demo, config, body)


# --------------------------------------------------------------------------- Self-generated documents

def _validate_selfdocs(demo: Demo) -> None:
    alone = demo["conditions"]["alone"]["rows"]
    for name, condition in demo["conditions"].items():
        for code, values in condition["rows"].items():
            # Printed averages are the mean of the four printed task scores.
            if abs(sum(values[:4]) / 4 - values[4]) > 0.0751:
                raise ValueError(f"Self-Docs: {name}/{code} average does not match its tasks")
            for index, change in enumerate(condition.get("changes", {}).get(code, [])):
                if abs(values[index] - alone[code][index] - float(change)) > 0.051:
                    raise ValueError(f"Self-Docs: {name}/{code} printed change {change} disagrees with Table 2")


def _code(choice: dict[str, str]) -> str:
    return choice["tone"] + choice["granularity"] + choice["structure"]


def _flip(code: str, position: int, demo: Demo) -> str:
    dimension = demo["dimensions"][position]
    letters = [value[0] for value in dimension["values"]]
    other = letters[1] if code[position] == letters[0] else letters[0]
    return code[:position] + other + code[position + 1:]


def _value_name(demo: Demo, position: int, letter: str) -> str:
    return next(v[1] for v in demo["dimensions"][position]["values"] if v[0] == letter)


def flip_rows(demo: Demo, code: str, condition: str) -> list[Demo]:
    """Advantage of each of the type's choices over the alternative. Mirrored by flipRows() in benchmarks.js."""
    rows = demo["conditions"][condition]["rows"]
    result = []
    for position, dimension in enumerate(demo["dimensions"]):
        other = _flip(code, position, demo)
        deltas = [round(a - b, 1) for a, b in zip(rows[code], rows[other])]
        wins = []
        for task in range(5):
            count = 0
            for candidate in demo["codes"]:
                if candidate[position] != code[position]:
                    continue
                pair = _flip(candidate, position, demo)
                count += rows[candidate][task] > rows[pair][task]
            wins.append(count)
        result.append({"dimension": dimension["label"], "mine": _value_name(demo, position, code[position]),
                       "theirs": _value_name(demo, position, other[position]), "other": other,
                       "deltas": deltas, "wins": wins})
    return result


def _rank(rows: dict[str, list[float]], code: str, task: int) -> tuple[int, list[str]]:
    value = rows[code][task]
    rank = 1 + sum(v[task] > value for v in rows.values())
    ties = [c for c, v in rows.items() if c != code and v[task] == value]
    return rank, ties


def selfdoc_status(demo: Demo, code: str, condition: str) -> str:
    """Describe the selected type. Mirrored by selfdocStatus() in benchmarks.js."""
    cond = demo["conditions"][condition]
    rows = cond["rows"]
    names = [_value_name(demo, i, code[i]).lower() for i in range(3)]
    parts = []
    for index, (task, _, _) in enumerate(demo["tasks"]):
        rank, ties = _rank(rows, code, index)
        tie = f", tied with {', '.join(ties)}" if ties else ""
        parts.append(f"{task} {rows[code][index]:.1f} (rank {rank} of 8{tie})")
    text = f"{code} ({', '.join(names)}), {cond['label']} ({cond['table']}): " + "; ".join(parts) + "."
    wiki = demo["baselines"]["Wiki"]
    above = [demo["tasks"][i][0] for i in range(4) if wiki[i] > rows[code][i]]
    if above:
        text += f" Wikipedia passages alone score higher on {', '.join(above)}."
    else:
        text += " It beats Wikipedia passages alone on all four tasks."
    if condition != "alone":
        alone = demo["conditions"]["alone"]["rows"][code][4]
        text += f" Average change from the same documents alone: {_signed(rows[code][4] - alone)}."
    return text


def _score_rows(demo: Demo, code: str, condition: str) -> str:
    cond = demo["conditions"][condition]
    rows = cond["rows"]
    best = [max(v[i] for v in rows.values()) for i in range(5)]
    html = []
    for c in demo["codes"]:
        cells = []
        for i, value in enumerate(rows[c]):
            change = cond.get("changes", {}).get(c)
            note = f'<small>{_text(change[i].replace("-", MINUS) if change[i] not in ("0.0",) else "±0.0")}</small>' if change else ""
            cells.append(f'<td{_class("is-best" if value == best[i] else "")}>{value:.1f}{note}</td>')
        html.append(f'<tr data-sd-row="{c}"{_class("is-selected" if c == code else "")}><th scope="row">{c}'
                    f'<small>{_text(demo["types"][c]["genre"])}</small></th>{"".join(cells)}</tr>')
    for name, values in demo["baselines"].items():
        hidden = " hidden" if name == "GenRead mix" and condition == "alone" else ""
        label = "Wikipedia passages alone" if name == "Wiki" else "GenRead documents, Direct Mix"
        html.append(f'<tr class="bm-baseline" data-sd-baseline="{_text(name)}"{hidden}><th scope="row">{_text(name)}'
                    f'<small>{_text(label)}</small></th>' + "".join(f"<td>{v:.1f}</td>" for v in values) + "</tr>")
    return "".join(html)


def _flip_html(demo: Demo, code: str, condition: str) -> str:
    html = []
    for row in flip_rows(demo, code, condition):
        cells = "".join(
            f'<td{_class("is-up" if d > 0 else "is-down" if d < 0 else "")}>{_signed(d)}<small>{w}/4 pairs</small></td>'
            for d, w in zip(row["deltas"], row["wins"])
        )
        html.append(f'<tr><th scope="row">{_text(row["mine"])} over {_text(row["theirs"].lower())}'
                    f'<small>{code} vs {row["other"]}</small></th>{cells}</tr>')
    return "".join(html)


def _selfdocs(slug: str, demo: Demo) -> str:
    _validate_selfdocs(demo)
    code, condition = demo["initial"]["type"], demo["initial"]["condition"]
    choice = dict(zip(("tone", "granularity", "structure"), code))
    fieldsets = "".join(
        _fieldset(f'{d["label"]} ({d["metafunction"]})',
                  "".join(_button("sd-" + d["key"], v[1], choice[d["key"]] == v[0], v[0]) for v in d["values"]))
        for d in demo["dimensions"]
    )
    conditions = "".join(_button("sd-condition", f'{v["label"]} ({v["table"]})', k == condition, k)
                         for k, v in demo["conditions"].items())
    info = demo["types"][code]
    definitions = "".join(
        f'<li data-sd-dim="{d["key"]}"><strong>{_text(_value_name(demo, i, code[i]))}</strong> '
        f'<span>({_text(d["metafunction"])} metafunction): {_text(next(v[2] for v in d["values"] if v[0] == code[i]))}.</span></li>'
        for i, d in enumerate(demo["dimensions"])
    )
    heads = "".join(f'<th scope="col">{_text(t)}<small>{_text(m) or "mean"}</small></th>' for t, _, m in demo["tasks"])
    flip_heads = "".join(f'<th scope="col">{_text(t)}</th>' for t, _, _ in demo["tasks"])
    cond = demo["conditions"][condition]
    source = "Figure 1 and Appendix G.2" if info["figure1"] else "Appendix G.2"
    config = {key: demo[key] for key in ("type", "dimensions", "tasks", "types", "codes", "conditions", "baselines", "initial")}
    body = f"""
  <div class="bm-controls" data-demo-controls hidden>
    {fieldsets}
    {_fieldset("Documents used", conditions)}
  </div>
  <div class="bm-sd-type" data-demo-state="type">
    <div class="bm-sd-def">
      <p class="bm-label">Selected type</p>
      <h4><span data-sd-code>{code}</span> <small data-sd-genre>Table 4 example: {_text(info["genre"])}</small></h4>
      <ul data-sd-definitions>{definitions}</ul>
    </div>
    <figure class="bm-sd-excerpt">
      <p class="bm-label">Question (TQA): {_text(demo["question"])}</p>
      <blockquote data-sd-excerpt>{_text(info["excerpt"])} …</blockquote>
      <figcaption class="bm-small">Opening of the published <span data-sd-code>{code}</span> document for this question, <span data-sd-excerpt-source>{source}</span>.</figcaption>
    </figure>
  </div>
  <div class="bm-sd-scores">
    <h4>Scores of all eight types: <span data-sd-condition-label>{_text(cond["label"])}</span> (<span data-sd-table>{_text(cond["table"])}</span>)</h4>
    <div class="bm-table-wrap" tabindex="0" role="region" aria-label="Scores of all eight document types">
      <table class="bm-scores"><thead><tr><th scope="col">Type</th>{heads}</tr></thead><tbody data-sd-scores>{_score_rows(demo, code, condition)}</tbody></table>
    </div>
    <p class="bm-small">EM for TQA and FEVER, F1 for HotpotQA and ELI5; Qwen2.5-32B-Instruct answers the first 500 examples of each dataset. The best Self-Doc score in each column is bold. In the mixed conditions, small figures are the printed changes from the same type alone (Table 2).</p>
  </div>
  <div class="bm-sd-flips">
    <h4>Change one choice of <span data-sd-code>{code}</span></h4>
    <div class="bm-table-wrap" tabindex="0" role="region" aria-label="Score difference when one choice changes">
      <table class="bm-flips"><thead><tr><th scope="col">Advantage</th>{flip_heads}</tr></thead><tbody data-sd-flips>{_flip_html(demo, code, condition)}</tbody></table>
    </div>
    <p class="bm-small">Each cell is the selected type's score minus the type that differs in one choice. “n/4 pairs” counts, over all four type pairs that differ only in that choice, how often the selected choice scores higher, so a pattern can be checked beyond this one pair.</p>
  </div>
  <div class="bm-readout"><p class="bm-label">Selected type</p>
    <p class="bm-status" data-sd-status role="status" aria-live="polite">{_text(selfdoc_status(demo, code, condition))}</p></div>
  <p class="bm-provenance">Measured: <a href="{_text(demo["source_url"])}">Table 2</a> (Self-Docs alone), Table 10 (with Wikipedia, Direct Mix), and Table 12 (with Wikipedia, Style-Transformation Mix), NAACL 2025 Findings; the page's results table repeats three rows of each mix (Table 5). Types and examples: Section 5.1 and Table 4; document openings from Figure 1 and Appendix G.2, shortened. Comparisons are computed here from the per-type rows.</p>"""
    return _shell(slug, "selfdocs", demo, config, body)


# --------------------------------------------------------------------------- Shell

def render_demo(slug: str, insight: dict[str, Any]) -> str:
    """Render a supported demo, or return an empty string for other insights."""
    if slug not in SUPPORTED:
        return ""
    demo = insight.get("demo", {})
    kind = demo.get("type")
    if kind == "knowgen":
        return _knowgen(slug, demo)
    if kind == "boundary-explorer":
        return _boundary(slug, demo)
    if kind == "selfdoc-taxonomy":
        return _selfdocs(slug, demo)
    return ""
