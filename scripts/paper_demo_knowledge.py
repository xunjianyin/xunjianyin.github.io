"""Server-rendered demos for the knowledge papers (History Matters, MC-MKE, EchoQA).

Each demo renders a complete, readable initial state without JavaScript;
papers/demos/knowledge.js only reveals the controls and updates the same
markup. Values live in the "demo" object of papers/insights/<slug>.json, next
to the table or figure each value was transcribed from.

History Matters and MC-MKE fill two page positions: a mechanism demo in Method
(an animated edit on a published or released example) and a measured-results
explorer in Evidence. Animated demos render their final step; the reader starts
the animation with Play / Step and returns to the first step with Reset.
"""

from __future__ import annotations

import json
import math
from html import escape
from typing import Any

Demo = dict[str, Any]

MINUS = "−"
SUPPORTED = {"history-matters", "knowledge-interplay", "mc-mke"}


def _text(value: object) -> str:
    return escape(str(value), quote=True)


def _signed(change: str) -> str:
    """Printed change such as '-13.26' -> '−13.26' (typographic minus)."""
    return change.replace("-", MINUS)


def _button(action: str, label: str, selected: bool = False, value: str | None = None, hidden: bool = False) -> str:
    data_value = f' data-value="{_text(value)}"' if value is not None else ""
    hidden_attr = " hidden" if hidden else ""
    return (
        f'<button type="button" data-demo-action="{_text(action)}"{data_value}{hidden_attr} '
        f'aria-pressed="{str(selected).lower()}">{_text(label)}</button>'
    )


def _class(*names: str) -> str:
    """Return a class attribute for the non-empty names, or nothing."""
    joined = " ".join(name for name in names if name)
    return f' class="{joined}"' if joined else ""


def _fieldset(legend: str, buttons: str, attrs: str = "") -> str:
    return f'<fieldset{attrs}><legend>{_text(legend)}</legend><div class="kd-buttons">{buttons}</div></fieldset>'


def _readout(label: str, body: str, attrs: str = "") -> str:
    """A plain-text reading with a small label (no callout box)."""
    return (
        f'<div class="kd-readout"><p class="kd-label">{_text(label)}</p>'
        f'<p class="kd-status"{attrs} role="status" aria-live="polite">{body}</p></div>'
    )


def _player(steps: list[str], current: int) -> str:
    """Play / Pause, Step, and Reset, plus one toggle per step (hidden without JavaScript)."""
    jumps = "".join(
        _button("goto", label, index == current, str(index)) for index, label in enumerate(steps)
    )
    return (
        '<div class="kd-player" data-demo-controls hidden>'
        '<div class="kd-buttons kd-transport" role="group" aria-label="Animation">'
        '<button type="button" data-demo-action="play" aria-pressed="false">Play</button>'
        '<button type="button" data-demo-action="step" disabled>Step</button>'
        '<button type="button" data-demo-action="reset">Reset</button></div>'
        f'<div class="kd-buttons kd-steps" role="group" aria-label="Show step">{jumps}</div></div>'
    )


STATIC_NOTE = "This is the initial selection. Enable JavaScript to change the selection."
ANIMATED_NOTE = "This is the final step of the example. Enable JavaScript to replay it step by step or change the selection."


def _shell(slug: str, part: str, kind: str, heading: Demo, config: Demo, body: str, note: str = STATIC_NOTE) -> str:
    """One demo section with the serif heading shared by every demo family."""
    ident = f"{slug}-{part}-demo-title"
    data = _text(json.dumps(config, ensure_ascii=False))
    return f"""
<section class="knowledge-demo" data-paper-demo="knowledge-{_text(kind)}" data-demo-config="{data}" aria-labelledby="{_text(ident)}">
  <header class="kd-heading">
    <p class="kd-eyebrow">{_text(heading.get("eyebrow", "Interactive explanation"))}</p>
    <h3 id="{_text(ident)}">{_text(heading["title"])}</h3>
    <p>{_text(heading["description"])}</p>
  </header>
  {body}
  <noscript><p class="kd-small">{_text(note)}</p></noscript>
</section>
"""


# --------------------------------------------------------------------------- History Matters: edit sequence

def _validate_temporal(demo: Demo) -> None:
    """Fail the build if a printed Table 3 change disagrees with Table 2 → Table 3."""
    for setting, forms in demo["results"].items():
        if list(forms) != demo["settings"][setting]["forms"]:
            raise ValueError(f"History Matters: form order mismatch in {setting}")
        for form, editors in forms.items():
            for editor, (plain, meto, change) in editors.items():
                # Source values are rounded to two decimals, so allow one unit of rounding.
                if abs(float(meto) - float(plain) - float(change)) > 0.0101:
                    raise ValueError(f"History Matters: inconsistent change for {setting}/{form}/{editor}")
    chain = demo["record"]["chain"]
    for step, probes in demo["probes"].items():
        for form, probe in probes.items():
            for item in probe["items"]:
                # Each expected answer must be the record's object for the probed link.
                if chain[item["link"]]["object"] != item["answer"]:
                    raise ValueError(f"History Matters: probe {step}/{form} answer is not the record's object")


def link_status(demo: Demo, index: int, step: int) -> str:
    """Status of one fact of the chain after `step` edits. Mirrored by linkStatus() in knowledge.js."""
    link = demo["record"]["chain"][index]
    if index == step:
        return "Current · known to GPT-J before editing" if step == 0 else f"Current · written by edit {step}"
    if index < step:
        return f"Historical · span closed in {link['until']}"
    return f"{link['role']} · not applied yet"


def _form_text(items: list[Demo]) -> str:
    return " | ".join(item["prompt"] for item in items)


def cell_flag(demo: Demo, form: str, step: int) -> str:
    """How a form's probe changed from the previous edit. Mirrored by cellFlag() in knowledge.js."""
    current = demo["probes"].get(str(step), {}).get(form)
    previous = demo["probes"].get(str(step - 1), {}).get(form)
    if not current:
        return ""
    if not previous:
        return "First asked"
    if _form_text(current["items"]) == _form_text(previous["items"]):
        same = [i["answer"] for i in current["items"]] == [i["answer"] for i in previous["items"]]
        return "Same wording, same answer" if same else "Same wording, new answer"
    return "New time span"


def sequence_status(demo: Demo, step: int) -> str:
    """Describe the record after `step` edits. Mirrored by sequenceStatus() in knowledge.js."""
    chain = demo["record"]["chain"]
    last = len(chain) - 1
    if step == 0:
        first = chain[0]
        return (
            f"Before editing: GPT-J's model-time fact is {first['object']} ({first['since']}–{first['until']}). "
            "AToKe asks no question yet."
        )
    link, previous = chain[step], chain[step - 1]
    text = f"Edit {step} applied: {link['object']}, {link['since']}–{link['until']}. {previous['object']} is now historical."
    groups: dict[str, list[str]] = {}
    for form in demo["forms"]:
        flag = cell_flag(demo, form, step)
        if flag:
            groups.setdefault(flag, []).append(form)
    for flag, label in (
        ("Same wording, new answer", "Same wording, new expected answer"),
        ("New time span", "New time span in the prompt"),
        ("First asked", "Asked for the first time"),
    ):
        if groups.get(flag):
            text += f" {label}: {', '.join(groups[flag])}."
    if step == 1:
        text += " A single-edit (AToKe-SE) case ends here."
    if step == last:
        text += " The multiple-edit (AToKe-ME) case ends here."
    return text


def _cloze(prompt: str) -> str:
    return f'<span class="kd-cloze">{_text(prompt)}<span class="kd-blank" aria-hidden="true"> ____</span></span>'


def _sequence_cell(demo: Demo, form: str, column: int, step: int) -> str:
    probe = demo["probes"].get(str(column), {}).get(form)
    label = demo["steps"][column]["label"]
    if not probe:
        return (f'<td data-label="{_text(label)}" class="is-never"><span class="kd-cell-none">'
                f'Not asked: HES* follows the final edit of a multiple-edit chain</span></td>')
    items = "".join(
        f'<li>{_cloze(item["prompt"])}<span class="kd-answer">{_text(item["answer"])}</span></li>' for item in probe["items"]
    )
    flag = cell_flag(demo, form, column) if column > 1 else ""
    flag_html = f'<span class="kd-flag" data-flag="{_text(flag)}">{_text(flag)}</span>' if flag else ""
    pending = " is-pending" if column > step else ""
    return (
        f'<td data-label="{_text(label)}" data-hm-cell="{column}" class="kd-seq-cell{pending}">'
        f'<div class="kd-cell-body"><ul>{items}</ul>{flag_html}</div>'
        f'<span class="kd-cell-pending">Not asked yet</span></td>'
    )


def _request_rows(demo: Demo, step: int) -> tuple[str, str]:
    """Rows for the existing editor, and for METO's fact and time objectives (one row per fact)."""
    record = demo["record"]
    subject, relation = record["subject"], record["relation"]
    plain, meto = [], []
    for index, link in enumerate(record["chain"]):
        if index > 0:
            plain.append(
                f'<tr data-hm-req="{index}" data-hm-req-kind="plain"{"" if index == step else " hidden"}>'
                f'<td>{_text(link["edit_prompt"])}</td><td>{_text(link["object"])}</td></tr>'
            )
        hidden = "" if 1 <= step and index <= step else " hidden"
        meto.append(
            f'<tr data-hm-req="{index}"{hidden}>'
            f'<td>({_text(subject)}, {_text(relation)}, ?, {link["since"]}, {link["until"]})</td><td>{_text(link["object"])}</td>'
            f'<td>({_text(subject)}, {_text(relation)}, {_text(link["object"])}, ?, ?)</td><td>{link["since"]} to {link["until"]}</td></tr>'
        )
    return "".join(plain), "".join(meto)


def _temporal_sequence(slug: str, demo: Demo) -> str:
    record = demo["record"]
    chain = record["chain"]
    step = len(chain) - 1  # The static page shows the end of the sequence.
    periods = "".join(
        f'<li data-hm-link="{index}"{_class("is-current" if index == step else "is-past" if index < step else "is-pending")}>'
        f'<span class="kd-period-years">{link["since"]}–{link["until"]}</span>'
        f'<strong>{_text(link["object"])}</strong><span class="kd-period-role" data-hm-link-status>{_text(link_status(demo, index, step))}</span></li>'
        for index, link in enumerate(chain)
    )
    plain, meto = _request_rows(demo, step)
    heads = "".join(
        f'<th scope="col">{_text(demo["steps"][column]["label"])}'
        f'<small>{"AToKe-SE ends here" if column == 1 else "AToKe-ME ends here"}</small></th>'
        for column in range(1, len(chain))
    )
    rows = "".join(
        f'<tr data-form="{_text(form)}"><th scope="row"><span>{_text(form)}</span><small>{_text(info["name"])}</small></th>'
        + "".join(_sequence_cell(demo, form, column, step) for column in range(1, len(chain)))
        + "</tr>"
        for form, info in demo["forms"].items()
    )
    steps = [item["short"] for item in demo["steps"]]
    config = {key: demo[key] for key in ("type", "record", "steps", "probes", "forms")}
    body = f"""
  {_player(steps, step)}
  <p class="kd-step-status" data-step-status data-demo-state="step" role="status" aria-live="polite">{_text(sequence_status(demo, step))}</p>
  <div class="kd-record">
    <p class="kd-label">Released record · {_text(record["label"])} · ({_text(record["subject"])}, {_text(record["relation"])})</p>
    <ol class="kd-periods" aria-label="Time-scoped fact chain of the record">{periods}</ol>
  </div>
  <div class="kd-requests" data-hm-requests>
    <h4>What the editor is asked to learn at <span data-hm-request-step>edit {step}</span></h4>
    <p class="kd-small" data-hm-request-empty hidden>No edit has been requested yet.</p>
    <div class="kd-request-grid" data-hm-request-grid>
      <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Edit request for an existing editor">
        <table class="kd-targets kd-plain-request"><caption>Existing editor: one timestamped prompt</caption>
          <thead><tr><th scope="col">Input</th><th scope="col">Target</th></tr></thead>
          <tbody>{plain}</tbody></table>
      </div>
      <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Edit targets with METO">
        <table class="kd-targets kd-meto-request"><caption>Same editor with METO: every fact since the model-time fact, and its span</caption>
          <thead><tr><th scope="col">Fact objective input</th><th scope="col">Target</th><th scope="col">Time objective input</th><th scope="col">Target</th></tr></thead>
          <tbody>{meto}</tbody></table>
      </div>
    </div>
    <p class="kd-small">METO's targets follow its Methodology: C<sub>t</sub> = C<sub>m</sub> ∪ C<sub>m+</sub>, where C<sub>m</sub> is the fact GPT-J held before editing (found by querying the model) and C<sub>m+</sub> the newer facts up to this edit; facts older than C<sub>m</sub> are not replayed. They are written in the notation of Figure 3; the paper prints no per-record targets. Its own time-objective example edits “Donald Trump is the President of the United States from” toward “2017 to 2021”.</p>
  </div>
  <div class="kd-sequence">
    <h4>Probe and expected answer for each question form</h4>
    <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Probe and expected answer for each question form after each edit">
      <table class="kd-seq-table"><thead><tr><th scope="col">Question form</th>{heads}</tr></thead>
        <tbody data-hm-sequence>{rows}</tbody></table>
    </div>
  </div>
  <p class="kd-provenance">Record: {_text(record["label"])}, from the authors' <a href="{_text(demo["record_url"])}">released dataset documentation</a> (linked in the paper). Probes and expected answers are the record's own questions; every answer is the record's object for the probed span, so the changes are definitional, not model outputs. AToKe samples its chains from YAGO and ends each chain with one sampled counterfactual future fact, so the latest link need not be biographical.</p>"""
    return _shell(slug, "method", "temporal-sequence", demo, config, body, ANIMATED_NOTE)


# --------------------------------------------------------------------------- History Matters: measured results

def temporal_status(demo: Demo, setting: str, form: str, editor: str) -> str:
    """Describe one measured cell. Mirrored by temporalStatus() in knowledge.js."""
    plain, meto, change = demo["results"][setting][form][editor]
    ces_plain, ces_meto, ces_change = demo["results"][setting]["CES"][editor]
    delta = float(change)
    head = (
        f"{editor} · {form} · {demo['settings'][setting]['name']}: {plain}% without METO → "
        f"{meto}% with METO ({_signed(change)} points)."
    )
    if float(ces_plain) < 10:
        tail = f" {editor} barely learns the edit itself (CES {ces_plain}% without METO), so its scores stay near the floor either way."
    elif demo["forms"][form]["time"] == "historical":
        tail = f" Without METO, historical probes almost never succeed; with METO, {meto}% do."
        if float(ces_change) <= -1:
            tail += f" Over the same edits, CES moves from {ces_plain}% to {ces_meto}%."
    elif abs(delta) < 0.5:
        tail = " The change is negligible."
    elif delta < 0 and form == "CES":
        tail = " This probe repeats the edit prompt, yet METO lowers it."
    elif delta < 0 and float(ces_change) > 0:
        tail = f" With METO the exact edit prompt improves (CES {_signed(ces_change)}), yet this form falls: the gain does not carry over to other wordings."
    elif delta < 0:
        tail = " METO lowers accuracy on the current fact for this form."
    else:
        tail = " METO does not lower this current-knowledge score."
    return head + tail


def _dumbbell_rows(demo: Demo, setting: str, form: str, editor: str) -> str:
    rows = []
    for name in demo["editors"]:
        plain, meto, change = demo["results"][setting][form][name]
        low, high = sorted((float(plain), float(meto)))
        selected = " is-selected" if name == editor else ""
        rows.append(
            f'<li class="kd-dumbbell{selected}" data-hm-row="{_text(name)}">'
            f'<span class="kd-db-name">{_text(name)}</span>'
            f'<span class="kd-db-track" aria-hidden="true"><i class="kd-db-span" style="left:{low}%;width:{high - low:.2f}%"></i>'
            f'<i class="kd-db-plain" style="left:{float(plain)}%"></i><i class="kd-db-meto" style="left:{float(meto)}%"></i></span>'
            f'<span class="kd-db-values"><span data-hm-plain>{_text(plain)}</span> → <strong data-hm-meto>{_text(meto)}</strong></span>'
            f'<span class="kd-db-change {"is-down" if change.startswith("-") else "is-up"}" data-hm-change>'
            f'{_text(_signed(change))}</span></li>'
        )
    return "".join(rows)


def _delta_rows(demo: Demo, setting: str, form: str, editor: str) -> str:
    rows = []
    for code in demo["settings"][setting]["forms"]:
        cells = []
        for name in demo["editors"]:
            change = demo["results"][setting][code][name][2]
            direction = "is-down" if change.startswith("-") else "is-up"
            chosen = " is-cell" if code == form and name == editor else ""
            column = " is-col" if name == editor else ""
            cells.append(f'<td class="{direction}{column}{chosen}" data-editor="{_text(name)}">{_text(_signed(change))}</td>')
        rows.append(
            f'<tr{_class("is-selected" if code == form else "")} data-form="{_text(code)}"><th scope="row"><span>{_text(code)}</span>'
            f'<small>{_text(demo["forms"][code]["name"])}</small></th>{"".join(cells)}</tr>'
        )
    return "".join(rows)


def _temporal_results(slug: str, demo: Demo) -> str:
    _validate_temporal(demo)
    setting, form, editor = (demo["initial"][key] for key in ("setting", "form", "editor"))
    settings = "".join(
        _button("hm-setting", f'{value["label"]} ({value["dataset"]})', key == setting, key)
        for key, value in demo["settings"].items()
    )
    forms = "".join(
        _button("hm-form", code, code == form, code, hidden=code not in demo["settings"][setting]["forms"])
        for code in demo["forms"]
    )
    editors = "".join(_button("hm-editor", name, name == editor, name) for name in demo["editors"])
    heads = "".join(
        f'<th scope="col" data-editor="{_text(name)}"{_class("is-col" if name == editor else "")}>{_text(name)}</th>'
        for name in demo["editors"]
    )
    setting_name = demo["settings"][setting]["name"]
    config = {key: demo[key] for key in ("type", "settings", "forms", "editors", "results", "initial")}
    body = f"""
  <div class="kd-controls" data-demo-controls hidden>
    {_fieldset("Edit sequence", settings)}
    {_fieldset("Question form", forms)}
    {_fieldset("Editor", editors)}
  </div>
  <div class="kd-measured" data-demo-state="measured">
    <h4>Measured accuracy on <span data-hm-code>{_text(form)}</span> (<span data-hm-form-name>{_text(demo["forms"][form]["name"])}</span>), GPT-J, <span data-hm-setting-name>{_text(setting_name)}</span></h4>
    <p class="kd-legend"><span class="kd-key-plain">Without METO (Table 2)</span><span class="kd-key-meto">With METO (Table 3)</span></p>
    <ol class="kd-dumbbells" data-hm-dumbbells aria-label="Accuracy of each editor without and with METO">{_dumbbell_rows(demo, setting, form, editor)}</ol>
    <p class="kd-axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></p>
    {_readout("Selected cell", _text(temporal_status(demo, setting, form, editor)), ' data-hm-status')}
  </div>
  <div class="kd-map">
    <h4>Change with METO across every question form</h4>
    <p class="kd-small">Percentage points as printed in Table 3, <span data-hm-setting-name>{_text(setting_name)}</span>. The selected form and editor are outlined.</p>
    <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Change with METO for every question form and editor">
      <table class="kd-delta-map"><thead><tr><th scope="col">Question form</th>{heads}</tr></thead>
        <tbody data-hm-map>{_delta_rows(demo, setting, form, editor)}</tbody></table>
    </div>
  </div>
  <p class="kd-provenance">Measured: <a href="{_text(demo["source_url"])}">Table 2</a> (existing editors) and Table 3 (with METO), GPT-J 6B on AToKe; changes are those printed in Table 3. The multiple-edit scores average each edit of a chain; HES* is asked once after the final edit. The probes behind each form are shown for one record in Method.</p>"""
    return _shell(slug, "evidence", "temporal-results", demo["evidence"], config, body)


# --------------------------------------------------------------------------- MC-MKE: edit propagation

KINDS = {"ie": "Visual (i, e)", "sro": "Textual (s, r, o)", "iro": "Multimodal (i, r, o)"}
KIND_NAMES = {"ie": "the recognized entity (i, e)", "sro": "the textual fact (s, r, o)", "iro": "the image-based answer (i, r, o)"}


def propagation_state(example: Demo, key: str, step: int, route: str = "reason") -> Demo:
    """Rows, composition, and readout of the Figure 2 example after `step` (0, 1, 2).

    The linked answer is recomputed with Eq. (2), (i, e) ×e=s (s, r, o) = (i, r, o).
    Mirrored by propagationState() in knowledge.js.
    """
    sc = example["scenarios"][key]
    t = example["templates"]
    e0 = sc["entity"]
    facts0 = dict(sc["facts"])
    o0 = facts0[e0]
    rows: dict[str, Demo] = {}

    def row(text: str, was: str | None, role: str, state: str) -> Demo:
        return {"text": text, "was": was, "role": role, "state": state}

    entity, facts, answer = e0, facts0, o0
    if key == "ie":
        entity = sc["new_entity"] if step >= 1 else e0
        used = entity if step >= 2 else e0
        answer = facts0[used]
        rows["ie"] = row(t["ie"].format(e=entity), e0 if step >= 1 else None,
                         "Edited · reliability probe" if step >= 1 else "Wrong recognition before the edit",
                         "edit" if step >= 1 else "fixed")
        rows["sro"] = row(t["sro"].format(s=used, o=facts0[used]),
                          t["sro"].format(s=e0, o=o0) if step >= 2 else None,
                          "Unchanged knowledge · now selected because e = s" if step >= 2 else "Unchanged knowledge used by the composition",
                          "fixed")
        rows["iro"] = row(t["iro"].format(o=answer), o0 if step >= 2 else None,
                          "Must follow · consistency probe" if step >= 2 else
                          "Not recomputed yet" if step == 1 else "Composed answer before the edit",
                          "check" if step >= 2 else "stale" if step == 1 else "fixed")
        compose = (used, facts0[used])
    elif key == "sro":
        new = sc["new_object"]
        facts = {e0: new} if step >= 1 else facts0
        answer = facts[e0] if step >= 2 else o0
        rows["ie"] = row(t["ie"].format(e=e0), None, "Unchanged", "fixed")
        rows["sro"] = row(t["sro"].format(s=e0, o=facts[e0]), o0 if step >= 1 else None,
                          "Edited · reliability probe (asked with a black image)" if step >= 1 else "Textual fact before the edit",
                          "edit" if step >= 1 else "fixed")
        rows["iro"] = row(t["iro"].format(o=answer), o0 if step >= 2 else None,
                          "Must follow · consistency probe" if step >= 2 else
                          "Not recomputed yet" if step == 1 else "Composed answer before the edit",
                          "check" if step >= 2 else "stale" if step == 1 else "fixed")
        compose = (e0, answer)
    else:
        new = sc["new_object"]
        rows["iro"] = row(t["iro_reason"].format(o=new) if step >= 1 else t["iro"].format(o=o0), o0 if step >= 1 else None,
                          "Edited with a reason · reliability probe" if step >= 1 else "Composed answer before the edit",
                          "edit" if step >= 1 else "fixed")
        answer = new if step >= 1 else o0
        if route == "reason":
            rows["ie"] = row(t["ie"].format(e=e0), None,
                             "Unchanged: a transfer keeps the same player" if step >= 2 else "Unchanged", "fixed")
            fact = new if step >= 2 else o0
            rows["sro"] = row(t["sro"].format(s=e0, o=fact), o0 if step >= 2 else None,
                              "Must follow · consistency probe" if step >= 2 else
                              "Not updated yet" if step == 1 else "Textual fact before the edit",
                              "check" if step >= 2 else "stale" if step == 1 else "fixed")
            compose = (e0, fact) if step >= 2 else (e0, o0)
        else:
            rows["ie"] = row(t["ie"].format(e="ẽ (not determined)") if step >= 2 else t["ie"].format(e=e0), e0 if step >= 2 else None,
                             "Would need some ẽ that plays for " + new + ": not unique" if step >= 2 else "Unchanged",
                             "ambiguous" if step >= 2 else "fixed")
            rows["sro"] = row(t["sro"].format(s=e0, o=o0), None, "Unchanged under this reading", "fixed")
            compose = ("ẽ", new) if step >= 2 else (e0, o0)

    head, obj = compose
    composition = f"(image, {head}) ×e=s ({head}, {example['relation']}, {obj}) = (image, {example['relation']}, {obj})"
    if step == 0:
        status = f"Before the edit, the model recognizes {e0} in the image, and {e0} plays for {o0}, so it answers {o0}."
    elif step == 1:
        edited = sc["edit"]
        status = (
            f"Edit applied to {KIND_NAMES[edited]}: {rows[edited]['was']} → "
            f"{sc.get('new_entity') or sc.get('new_object')}. The linked answer has not been recomputed yet; "
            "a method that stops here passes the reliability probe but fails the consistency probe."
        )
    elif key == "iro" and route != "reason":
        status = (
            f"Read as a recognition change, the edit would need some player ẽ who plays for {sc['new_object']}. "
            "Many players could, so the edit does not determine ẽ; MC-MKE attaches a transfer reason and uses only the "
            "textual-fact reading."
        )
    else:
        check = sc["check"]
        edit_target = sc.get("new_entity") or sc["new_object"]
        check_target = sc["new_object"] if key != "ie" else answer
        same = edit_target == check_target
        status = (
            f"Recomputed with Eq. (2): {KIND_NAMES[check]} must change from {o0} to {check_target}. "
            f"Edit target {edit_target}; consistency target {check_target}. "
            + ("The two targets are the same answer, so a method that outputs it for every related prompt also passes; "
               "locality must be read alongside." if same else
               "The targets differ, so repeating the edit target cannot pass the consistency probe.")
        )
    return {"rows": rows, "composition": composition, "status": status}


def _role_class(state: str) -> str:
    return f"kd-role-{state}"


def _multimodal_propagation(slug: str, demo: Demo) -> str:
    example = demo["example"]
    scenario, step, route = "ie", len(example["steps"]) - 1, "reason"
    state = propagation_state(example, scenario, step, route)
    rows = "".join(
        f'<tr data-mc-knowledge="{key}" class="{_role_class(state["rows"][key]["state"])}"><th scope="row">{KINDS[key]}</th>'
        f'<td><span data-mc-text>{_text(state["rows"][key]["text"])}</span>'
        f'<span class="kd-was" data-mc-was{"" if state["rows"][key]["was"] else " hidden"}>'
        f'previously {_text(state["rows"][key]["was"] or "")}</span></td>'
        f'<td data-mc-role>{_text(state["rows"][key]["role"])}</td></tr>'
        for key in ("ie", "sro", "iro")
    )
    scenario_buttons = "".join(
        _button("mc-example", f'{value["label"]}: {value["name"]}', key == scenario, key)
        for key, value in demo["scenarios"].items()
    )
    route_buttons = _button("mc-route", "The stated reason: a transfer", True, "reason") + _button(
        "mc-route", "Alternative: a different player", False, "recognition")
    config = {"type": "multimodal-propagation", "example": example, "scenarios": demo["scenarios"]}
    body = f"""
  <div class="kd-controls" data-demo-controls hidden>
    {_fieldset("Editing scenario", scenario_buttons)}
    {_fieldset("How the IRO_edit is read", route_buttons, ' data-mc-route-group hidden')}
  </div>
  {_player(example["steps"], step)}
  <p class="kd-step-status" data-step-status data-demo-state="step" role="status" aria-live="polite">{_text(state["status"])}</p>
  <div class="kd-mc-example">
    <p class="kd-label">Published example · Figure 2 · <span data-mc-scenario-label>{_text(demo["scenarios"][scenario]["label"])}</span>, <span data-mc-scenario-name>{_text(demo["scenarios"][scenario]["name"])}</span></p>
    <p class="kd-small">The photograph in Figures 1 and 2 shows Messi. Before a recognition edit the model sees Mac Allister and therefore answers Liverpool; each scenario fixes a different part of that chain.</p>
    <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Decomposed knowledge for the selected scenario">
      <table class="kd-decomp"><thead><tr><th scope="col">Knowledge</th><th scope="col">Statement at this step</th><th scope="col">Role</th></tr></thead>
        <tbody>{rows}</tbody></table>
    </div>
    <p class="kd-compose"><span class="kd-label">Composition, Eq. (2)</span><code data-mc-compose>{_text(state["composition"])}</code></p>
  </div>
  <p class="kd-provenance">Example: <a href="{_text(demo["source_url"])}">Figure 2 and Section 3.3</a>, described in text; the wrong recognition and (Mac Allister, play for, Liverpool) are from Figure 1 and Section 1. The linked answer is recomputed here from the decomposition K(i, e, s, r, o) = (i, e) ×e=s (s, r, o); no model is run. IRO_edit is read only through the textual fact because the dataset supplies a reason for every such edit (Section 3.3).</p>"""
    return _shell(slug, "method", "multimodal-propagation", demo, config, body, ANIMATED_NOTE)


# --------------------------------------------------------------------------- MC-MKE: measured results

PLOT_W, PLOT_H = 340, 292
X0, X1, Y_TOP, Y_BOTTOM = 48.0, 324.0, 12.0, 240.0
# Label metrics match the 12px label font in knowledge.css.
CHAR_W, LABEL_H, POINT_R, CLUSTER_PX = 6.45, 12.0, 5.0, 5.0
METRICS = [
    ("reliability", "Reliability"),
    ("consistency", "Consistency"),
    ("locality", "Locality"),
    ("image_generality", "Image gen."),
    ("text_generality", "Text gen."),
]


def _sx(value: float) -> float:
    return X0 + value / 100 * (X1 - X0)


def _sy(value: float) -> float:
    return Y_BOTTOM - value / 100 * (Y_BOTTOM - Y_TOP)


def _overlap(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    return width * height if width > 0 and height > 0 else 0.0


def _short(method: str) -> str:
    """Plot label: 'MEND(Vision)' -> 'MEND(V)'; the table keeps the paper's full names."""
    return method.replace("(Vision)", "(V)").replace("(LLM)", "(L)")


def _box_distance(box: tuple[float, float, float, float], point: tuple[float, float]) -> float:
    dx = max(box[0] - point[0], 0.0, point[0] - box[2])
    dy = max(box[1] - point[1], 0.0, point[1] - box[3])
    return math.hypot(dx, dy)


def place_labels(points: list[Demo]) -> list[Demo]:
    """Choose one label per cluster of (near-)coincident points, avoiding other marks.

    Points closer than CLUSTER_PX share a label such as "FT(L), SERAC". Placement is
    deterministic and greedy: try positions around the cluster, nearest first, and keep
    the first one inside the plot that overlaps no placed label and no point.
    """
    circles = [(_sx(point["x"]), _sy(point["y"])) for point in points]
    groups: list[Demo] = []
    for point, (px, py) in zip(points, circles):
        match = next((g for g in groups if math.dist((g["px"], g["py"]), (px, py)) < CLUSTER_PX), None)
        if match:
            match["methods"].append(point["method"])
            count = len(match["methods"])
            match["px"] += (px - match["px"]) / count
            match["py"] += (py - match["py"]) / count
        else:
            groups.append({"px": px, "py": py, "methods": [point["method"]]})
    point_boxes = [(x - POINT_R - 1.5, y - POINT_R - 1.5, x + POINT_R + 1.5, y + POINT_R + 1.5) for x, y in circles]
    candidates = [
        (9, 4, "start"), (-9, 4, "end"), (0, -9, "middle"), (0, 17, "middle"),
        (7, -7, "start"), (7, 15, "start"), (-7, -7, "end"), (-7, 15, "end"),
        (9, -17, "start"), (-9, -17, "end"), (0, -21, "middle"), (9, 26, "start"), (-9, 26, "end"),
    ]
    placed: list[tuple[float, float, float, float]] = []
    # Crowded clusters choose first; isolated points take the remaining space.
    order = sorted(groups, key=lambda g: sum(math.dist((g["px"], g["py"]), c) < 60 for c in circles), reverse=True)
    for group in order:
        label = ", ".join(_short(method) for method in group["methods"])
        width = CHAR_W * len(label) + 2
        best: tuple[float, Demo] | None = None
        for dx, dy, anchor in candidates:
            lx, ly = group["px"] + dx, group["py"] + dy
            left = lx if anchor == "start" else lx - width if anchor == "end" else lx - width / 2
            box = (left, ly - LABEL_H + 2, left + width, ly + 2)
            outside = box[0] < X0 + 2 or box[2] > PLOT_W - 2 or box[1] < 2 or box[3] > Y_BOTTOM - 2
            cost = sum(_overlap(box, other) for other in placed + point_boxes) + (10_000 if outside else 0)
            # A label must sit closer to its own cluster than to any other point.
            own = _box_distance(box, (group["px"], group["py"]))
            if any(_box_distance(box, c) < own for c in circles if math.dist(c, (group["px"], group["py"])) >= CLUSTER_PX):
                cost += 500
            if best is None or cost < best[0]:
                best = (cost, {"lx": round(lx, 1), "ly": round(ly, 1), "anchor": anchor, "box": box})
            if cost == 0:
                break
        assert best is not None
        group.update(label=label, lx=best[1]["lx"], ly=best[1]["ly"], anchor=best[1]["anchor"])
        placed.append(best[1]["box"])
    return groups


def _plot(slug: str, demo: Demo, model: str, scenario: str, method: str, visible: bool) -> str:
    results = demo["results"][model][scenario]
    points = [{"method": m, "x": results[m]["reliability"], "y": results[m]["consistency"]} for m in demo["methods"]]
    groups = place_labels(points)
    ident = f"{slug}-plot-{model}-{scenario}"
    grid = "".join(
        f'<line class="kd-grid" x1="{X0}" x2="{X1}" y1="{_sy(t):.1f}" y2="{_sy(t):.1f}"/>'
        f'<line class="kd-grid" y1="{Y_TOP}" y2="{Y_BOTTOM}" x1="{_sx(t):.1f}" x2="{_sx(t):.1f}"/>'
        f'<text class="kd-tick" x="{_sx(t):.1f}" y="{Y_BOTTOM + 15}" text-anchor="middle">{t}</text>'
        f'<text class="kd-tick" x="{X0 - 7}" y="{_sy(t) + 3.5:.1f}" text-anchor="end">{t}</text>'
        for t in (0, 25, 50, 75, 100)
    )
    circles = "".join(
        f'<circle{_class("kd-point", "is-selected" if p["method"] == method else "")} data-mc-method="{_text(p["method"])}" '
        f'cx="{_sx(p["x"]):.1f}" cy="{_sy(p["y"]):.1f}" r="{POINT_R}"/>'
        for p in sorted(points, key=lambda p: p["method"] == method)  # selected point drawn last
    )
    labels = "".join(
        f'<text{_class("kd-point-label", "is-selected" if method in g["methods"] else "")} '
        f'data-mc-methods="{_text("|".join(g["methods"]))}" x="{g["lx"]}" y="{g["ly"]}" text-anchor="{g["anchor"]}">'
        f'{_text(g["label"])}</text>'
        for g in groups
    )
    marks = f'<g class="kd-points">{circles}</g><g class="kd-labels">{labels}</g>'
    description = "; ".join(f'{p["method"]}: reliability {p["x"]:.2f}, consistency {p["y"]:.2f}' for p in points)
    label = f'{demo["models"][model]["label"]}, {demo["scenarios"][scenario]["label"]}'
    return (
        f'<svg class="kd-plot" viewBox="0 0 {PLOT_W} {PLOT_H}" role="img" aria-labelledby="{ident}-title {ident}-desc" '
        f'data-mc-plot="{model}-{scenario}"{"" if visible else " hidden"}>'
        f'<title id="{ident}-title">Reliability against consistency, {_text(label)}</title>'
        f'<desc id="{ident}-desc">{_text(description)}.</desc>{grid}'
        f'<line class="kd-diagonal" x1="{_sx(0)}" y1="{_sy(0)}" x2="{_sx(100)}" y2="{_sy(100)}"/>'
        f'<text class="kd-axis-title" x="{(X0 + X1) / 2}" y="{PLOT_H - 8}" text-anchor="middle">Reliability (%)</text>'
        f'<text class="kd-axis-title" transform="translate(13 {(Y_TOP + Y_BOTTOM) / 2}) rotate(-90)" text-anchor="middle">Consistency (%)</text>'
        f"{marks}</svg>"
    )


def _cell(value: float | None) -> str:
    if value is None:
        return '<td><span aria-hidden="true">—</span><span class="kd-sr">not evaluated</span></td>'
    return f"<td>{value:.2f}</td>"


def _metric_rows(demo: Demo, model: str, scenario: str, method: str) -> str:
    rows = []
    for name in demo["methods"]:
        values = demo["results"][model][scenario][name]
        rows.append(
            f'<tr{_class("is-selected" if name == method else "")} data-mc-row="{_text(name)}"><th scope="row">{_text(name)}</th>'
            + "".join(_cell(values[key]) for key, _ in METRICS) + "</tr>"
        )
    return "".join(rows)


def _component_rows(demo: Demo, model: str, scenario: str) -> str:
    results = demo["results"][model][scenario]
    rows = []
    for family in ("FT", "MEND"):
        vision = results[f"{family}(Vision)"]["consistency"]
        llm = results[f"{family}(LLM)"]["consistency"]
        cells = "".join(
            f'<td{_class("is-higher" if value == max(vision, llm) else "")}>{value:.2f}</td>' for value in (vision, llm)
        )
        rows.append(f'<tr data-mc-family="{family}"><th scope="row">{family}</th>{cells}</tr>')
    return "".join(rows)


def multimodal_status(demo: Demo, model: str, scenario: str, method: str) -> str:
    """Describe the selected method. Mirrored by multimodalStatus() in knowledge.js."""
    results = demo["results"][model][scenario]
    values = results[method]
    r, c, loc = values["reliability"], values["consistency"], values["locality"]
    place = f'{demo["scenarios"][scenario]["label"]}, {demo["models"][model]["label"]}'
    loc_text = "not evaluated" if loc is None else f"{loc:.2f}"
    parts = [f"{method} on {place}: reliability {r:.2f}, consistency {c:.2f}, locality {loc_text}."]
    ft_llm = results["FT(LLM)"]
    if method == "SERAC" and r == ft_llm["reliability"] and c == ft_llm["consistency"]:
        parts.append(
            f" Reliability and consistency equal FT(LLM) exactly: SERAC's counterfactual model is the LLM fine-tuned on the edit "
            f"(Appendix B); its classifier, which decides when to use that model, separates their locality "
            f"({ft_llm['locality']:.2f} for FT(LLM))."
        )
    elif r - c >= 40:
        parts.append(f" The edited answer appears on {r:.2f}% of edit inputs, but the linked answer follows on only {c:.2f}%.")
    elif scenario != "ie" and c >= 70 and loc is not None and loc < 10:
        ie = demo["results"][model]["ie"][method]["consistency"]
        parts.append(
            f" High consistency with locality near zero: here the linked answer equals the edited answer, so repeating "
            f"the new target also passes. On IE_edit the same method reaches {ie:.2f}."
        )
    if c > r:
        parts.append(" Consistency can exceed reliability: consistency is scored only on samples whose linked answer changes (Section 4.2).")
    if loc is None:
        parts.append(" Locality and image generality were not evaluated because the models do not accept multiple images.")
    return "".join(parts)


def _multimodal_results(slug: str, demo: Demo) -> str:
    scenario, model, method = (demo["initial"][key] for key in ("scenario", "model", "method"))
    current = demo["scenarios"][scenario]
    plots = "".join(
        _plot(slug, demo, m, s, method, m == model and s == scenario)
        for m in demo["models"] for s in demo["scenarios"]
    )
    scenario_buttons = "".join(
        _button("mc-scenario", f'{value["label"]}: {value["name"]}', key == scenario, key) for key, value in demo["scenarios"].items()
    )
    model_buttons = "".join(_button("mc-model", value["label"], key == model, key) for key, value in demo["models"].items())
    method_buttons = "".join(_button("mc-method", name, name == method, name) for name in demo["methods"])
    heads = "".join(f'<th scope="col">{_text(label)}</th>' for _, label in METRICS)
    config = {key: demo[key] for key in ("scenarios", "models", "methods", "results", "initial")} | {"type": "multimodal-results"}
    body = f"""
  <div class="kd-controls" data-demo-controls hidden>
    {_fieldset("Editing scenario", scenario_buttons)}
    {_fieldset("Model", model_buttons)}
    {_fieldset("Editing method", method_buttons)}
  </div>
  <div class="kd-mc-results" data-demo-state="measured">
    <h4>Measured on the full benchmark: <span data-mc-model-label>{_text(demo["models"][model]["label"])}</span>, <span data-mc-scenario-label>{_text(current["label"])}</span> (<span data-mc-table>{_text(current["table"])}</span>)</h4>
    <div class="kd-mc-layout">
      <figure class="kd-plot-figure">{plots}
        <figcaption class="kd-small">Each point is one method; (V) and (L) mark whether the vision or the LLM component was edited. On the dashed line consistency equals reliability; below it, the edited answer changes more often than the linked one.</figcaption>
      </figure>
      <div class="kd-mc-side">
        <div class="kd-table-wrap" tabindex="0" role="region" aria-label="All measured metrics for the selected scenario and model">
          <table class="kd-metrics"><thead><tr><th scope="col">Method</th>{heads}</tr></thead>
            <tbody data-mc-metrics>{_metric_rows(demo, model, scenario, method)}</tbody></table>
        </div>
        <table class="kd-component"><caption>Consistency by edited component</caption>
          <thead><tr><th scope="col">Method</th><th scope="col">Vision</th><th scope="col">LLM</th></tr></thead>
          <tbody data-mc-components>{_component_rows(demo, model, scenario)}</tbody></table>
        <p class="kd-small">— marks metrics the paper did not evaluate: IKE locality and image generality (no multi-image input), and image generality in SRO_edit (black-image input).</p>
      </div>
    </div>
    {_readout("Selected method", _text(multimodal_status(demo, model, scenario, method)), ' data-mc-status')}
  </div>
  <p class="kd-provenance">Measured: <a href="{_text(demo["source_url"])}">Appendix E, Tables 9–11</a> ({_text(demo["models"]["instructblip"]["detail"])}; {_text(demo["models"]["minigpt"]["detail"])}). Reliability is scored on the edit input, consistency on the linked probe, locality on five unrelated instances per edit, and generality on five paraphrases or five other images per edit (Section 4.2). These are benchmark averages, not model outputs for the Messi example in Method.</p>"""
    return _shell(slug, "evidence", "multimodal-results", demo["evidence"], config, body)


# --------------------------------------------------------------------------- EchoQA

def _composition() -> str:
    return """
    <div class="kd-echo-case">
      <p class="kd-label">Llama 3.1-70B · ALCUNA question about an artificial bat species</p>
      <h4>What does the species sharing a roost with Myotis lucifralis prey on?</h4>
      <p class="kd-echo-options"><span>Chara andina</span><span>Aldabrachelys</span><span class="is-key">Noctuidae <small>answer key</small></span><span>Geomyidae</span></p>
      <div class="kd-controls" data-demo-controls hidden>""" + _fieldset(
        "Compare the published inputs and responses",
        _button("echo-no-context", "Without context") + _button("echo-with-context", "With complementary context", True)) + """</div>
      <div data-echo-case-state data-demo-state="echo-case">
        <article class="kd-echo-document"><h5>Context supplied with the question</h5><p data-echo-context>Myotis lucifralis shares a roost with Myotis nattereri.</p><p class="kd-small">The paper prints an abbreviated context. This is its relevant co-roosting fact, paraphrased.</p></article>
        <div class="kd-echo-trace">
          <div data-echo-first-hop><span class="kd-label">Resolve the co-roosting species</span><strong data-echo-entity>Myotis nattereri</strong><p data-echo-hop1>The response follows the supplied relationship.</p></div>
          <div class="is-blocked" data-echo-second-hop><span class="kd-label">Recall what that species eats</span><strong data-echo-recalled>Not resolved from memory</strong><p data-echo-hop2>The response notices that the context does not list the prey and ultimately abstains.</p></div>
        </div>
        <div class="kd-echo-output" role="status" aria-live="polite"><div><span class="kd-label">Recorded final answer</span><strong data-echo-answer>Unknown</strong></div><p data-echo-diagnosis>It identifies the intermediate species correctly but fails to complete the memory-dependent link.</p></div>
      </div>
      <p class="kd-echo-source">Input and response summaries adapted from <a href="https://arxiv.org/abs/2410.08414">Appendix B.5, Table 13</a>. The responses are published model results, not generated here. The answer key is Noctuidae; the printed response also uses an Unknown option. Abstention rates for all six models and four conditions are in the results table under Evidence.</p>
    </div>"""


# --------------------------------------------------------------------------- Shell

def render_demo(slug: str, insight: dict[str, Any]) -> str | dict[str, str]:
    """Render a supported demo, or return an empty string for other insights."""
    if slug not in SUPPORTED:
        return ""
    demo = insight.get("demo", {})
    kind = demo.get("type")
    if kind == "temporal-editing":
        return {"method": _temporal_sequence(slug, demo), "evidence": _temporal_results(slug, demo)}
    if kind == "multimodal-consistency":
        return {"method": _multimodal_propagation(slug, demo), "evidence": _multimodal_results(slug, demo)}
    if kind == "evidence-composition":
        return _shell(slug, "case", "evidence-composition", demo, {"type": kind}, _composition())
    return ""
