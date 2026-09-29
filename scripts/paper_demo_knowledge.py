"""Server-rendered demos for the knowledge papers (History Matters, MC-MKE, EchoQA).

Each demo renders a complete, readable initial state without JavaScript;
papers/demos/knowledge.js only reveals the controls and updates the same
markup. Measured values live in the "demo" object of papers/insights/<slug>.json,
next to the table each value was transcribed from.
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


def _fieldset(legend: str, buttons: str) -> str:
    return f'<fieldset><legend>{_text(legend)}</legend><div class="kd-buttons">{buttons}</div></fieldset>'


def _readout(label: str, body: str, attrs: str = "") -> str:
    """A plain-text reading with a small label (no callout box)."""
    return (
        f'<div class="kd-readout"><p class="kd-label">{_text(label)}</p>'
        f'<p class="kd-status"{attrs} role="status" aria-live="polite">{body}</p></div>'
    )


# --------------------------------------------------------------------------- History Matters

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


def _probe_rows(probe: Demo) -> str:
    rows = []
    for item in probe["items"]:
        question = (
            f'<span class="kd-probe-question">Question format: {_text(item["question"])}</span>'
            if item.get("question") else ""
        )
        rows.append(
            f'<tr><td><span class="kd-cloze">{_text(item["prompt"])}<span class="kd-blank" aria-hidden="true"> ____</span></span>'
            f"{question}</td><td>{_text(item['answer'])}</td></tr>"
        )
    return "".join(rows)


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


def _temporal(slug: str, demo: Demo) -> str:
    _validate_temporal(demo)
    setting, form, editor = (demo["initial"][key] for key in ("setting", "form", "editor"))
    record = demo["record"]
    probe = demo["probes"][setting][form]
    targets = {item["link"] for item in probe["items"]}
    periods = "".join(
        f'<li data-hm-link="{index}"'
        f'{_class("is-target" if index in targets else "", "is-outside" if setting == "se" and index == 2 else "")}>'
        f'<span class="kd-period-years">{link["since"]}–{link["until"]}</span>'
        f'<strong>{_text(link["object"])}</strong><span class="kd-period-role">{_text(link["role"])}</span></li>'
        for index, link in enumerate(record["chain"])
    )

    def target_rows(items: list[Demo]) -> str:
        return "".join(
            f'<tr><td>{_text(item["input"])}</td><td>{_text(item["target"])}</td></tr>' for item in items
        )

    requests = demo["requests"]
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
    return f"""
  <div class="kd-record">
    <p class="kd-label">Published record · {_text(record["label"])} · ({_text(record["subject"])}, {_text(record["relation"])})</p>
    <ol class="kd-periods" aria-label="Time-scoped fact chain of the record">{periods}</ol>
  </div>
  <div class="kd-requests">
    <h4>What the editor is asked to learn for edit 1</h4>
    <div class="kd-request-grid">
      <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Edit request for an existing editor">
        <table class="kd-targets"><caption>Existing editor: one timestamped prompt</caption>
          <thead><tr><th scope="col">Input</th><th scope="col">Target</th></tr></thead>
          <tbody>{target_rows(requests["plain"])}</tbody></table>
      </div>
      <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Edit targets with METO">
        <table class="kd-targets"><caption>Same editor with METO: both facts, and their time spans</caption>
          <thead><tr><th scope="col">Input</th><th scope="col">Target</th></tr></thead>
          <tbody><tr class="kd-target-group"><th colspan="2" scope="rowgroup">Fact objective</th></tr>{target_rows(requests["meto_object"])}
          <tr class="kd-target-group"><th colspan="2" scope="rowgroup">Time objective</th></tr>{target_rows(requests["meto_time"])}</tbody></table>
      </div>
    </div>
    <p class="kd-small">The existing-editor prompt is the record's own <code>time_prompt</code>. METO's targets are written in the notation of the paper's Figure 3; the paper's own time-objective example edits “Donald Trump is the President of the United States from” toward “2017 to 2021”. METO re-edits the fact GPT-J already knew so that its span closes, rather than replaying all older facts.</p>
  </div>
  <div class="kd-controls" data-demo-controls hidden>
    {_fieldset("Edit sequence", settings)}
    {_fieldset("Question form", forms)}
    {_fieldset("Editor", editors)}
  </div>
  <div class="kd-probe" data-demo-state="probe">
    <p class="kd-label"><span data-hm-code>{_text(form)}</span> · <span data-hm-form-name>{_text(demo["forms"][form]["name"])}</span> · <span data-hm-when>{_text(probe["when"])}</span></p>
    <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Probe for the selected question form">
      <table class="kd-probe-table"><thead><tr><th scope="col">Probe completed by GPT-J</th><th scope="col">Expected answer</th></tr></thead>
        <tbody data-hm-probes>{_probe_rows(probe)}</tbody></table>
    </div>
    <p class="kd-small" data-hm-note>{_text(probe["note"])}</p>
  </div>
  <div class="kd-measured">
    <h4>Measured accuracy on <span data-hm-code>{_text(form)}</span>, GPT-J, <span data-hm-setting-name>{_text(setting_name)}</span></h4>
    <p class="kd-legend"><span class="kd-key-plain">Without METO (Table 2)</span><span class="kd-key-meto">With METO (Table 3)</span></p>
    <ol class="kd-dumbbells" data-hm-dumbbells aria-label="Accuracy of each editor without and with METO">{_dumbbell_rows(demo, setting, form, editor)}</ol>
    <p class="kd-axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></p>
    {_readout("Selected cell", _text(temporal_status(demo, setting, form, editor)), ' data-demo-state="status" data-hm-status')}
  </div>
  <div class="kd-map">
    <h4>Change with METO across every question form</h4>
    <p class="kd-small">Percentage points as printed in Table 3, <span data-hm-setting-name>{_text(setting_name)}</span>. The selected form and editor are outlined.</p>
    <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Change with METO for every question form and editor">
      <table class="kd-delta-map"><thead><tr><th scope="col">Question form</th>{heads}</tr></thead>
        <tbody data-hm-map>{_delta_rows(demo, setting, form, editor)}</tbody></table>
    </div>
  </div>
  <p class="kd-provenance">Record: {_text(record["label"])}, from the authors' <a href="{_text(demo["record_url"])}">released dataset documentation</a> (linked in the paper). AToKe samples its chains from YAGO and ends each chain with one sampled counterfactual future fact, so the latest link need not be biographical. Measured: <a href="{_text(demo["source_url"])}">Table 2</a> (existing editors) and Table 3 (with METO), GPT-J 6B; changes are those printed in Table 3. The multiple-edit scores average each edit of a chain; HES* is asked once after the final edit.</p>"""


# --------------------------------------------------------------------------- MC-MKE

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


def _multimodal(slug: str, demo: Demo) -> str:
    scenario, model, method = (demo["initial"][key] for key in ("scenario", "model", "method"))
    current = demo["scenarios"][scenario]
    kinds = {"ie": "Visual (i, e)", "sro": "Textual (s, r, o)", "iro": "Multimodal (i, r, o)"}
    rows = "".join(
        f'<tr data-mc-knowledge="{key}" class="kd-role-{_role_class(current["rows"][key]["role"])}"><th scope="row">{kinds[key]}</th>'
        f'<td><span data-mc-text>{_text(current["rows"][key]["text"])}</span>'
        f'<span class="kd-was" data-mc-was{"" if current["rows"][key]["was"] else " hidden"}>'
        f'previously {_text(current["rows"][key]["was"] or "")}</span></td>'
        f'<td data-mc-role>{_text(current["rows"][key]["role"])}</td></tr>'
        for key in ("ie", "sro", "iro")
    )
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
    return f"""
  <div class="kd-controls" data-demo-controls hidden>
    {_fieldset("Editing scenario", scenario_buttons)}
    {_fieldset("Model", model_buttons)}
    {_fieldset("Editing method", method_buttons)}
  </div>
  <div class="kd-mc-example" data-demo-state="example">
    <p class="kd-label">Published example · Figure 2 · <span data-mc-scenario-label>{_text(current["label"])}</span>, <span data-mc-scenario-name>{_text(current["name"])}</span></p>
    <p class="kd-small">The photograph in Figures 1 and 2 shows Messi. In the recognition case the model first sees Mac Allister and therefore answers Liverpool; each scenario fixes a different part of that chain.</p>
    <div class="kd-table-wrap" tabindex="0" role="region" aria-label="Decomposed knowledge for the selected scenario">
      <table class="kd-decomp"><thead><tr><th scope="col">Knowledge</th><th scope="col">Statement after the edit</th><th scope="col">Role in this scenario</th></tr></thead>
        <tbody>{rows}</tbody></table>
    </div>
    <p class="kd-small" data-mc-answers>{_text(current["answers"])}</p>
  </div>
  <div class="kd-mc-results">
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
    {_readout("Selected method", _text(multimodal_status(demo, model, scenario, method)), ' data-demo-state="status" data-mc-status')}
  </div>
  <p class="kd-provenance">Example: <a href="{_text(demo["source_url"])}">Figure 2 and Section 3.3</a>, described in text. Measured: Appendix E, Tables 9–11 ({_text(demo["models"]["instructblip"]["detail"])}; {_text(demo["models"]["minigpt"]["detail"])}). Reliability is scored on the edit input, consistency on the linked probe, locality on five unrelated instances per edit, and generality on five paraphrases or five other images per edit (Section 4.2). The per-method numbers are benchmark averages, not model outputs for the Messi example.</p>"""


def _role_class(role: str) -> str:
    return "edit" if role.startswith("Edited") else "check" if role.startswith("Must follow") else "fixed"


# --------------------------------------------------------------------------- EchoQA (unchanged content)

def _composition(demo: Demo) -> str:
    def condition(value: str, label: str, selected: bool = False) -> str:
        return _button("echo-condition", label, selected).replace(
            'data-demo-action="echo-condition"', f'data-demo-action="echo-condition" data-condition="{value}"'
        )

    return f"""
    <div class="kd-echo-case">
      <p class="kd-label">Recorded case · LLaMA3.1-70B · ALCUNA</p>
      <h4>What does the species sharing a roost with Myotis lucifralis prey on?</h4>
      <p class="kd-echo-options"><span>Chara andina</span><span>Aldabrachelys</span><span class="is-key">Noctuidae <small>answer key</small></span><span>Geomyidae</span></p>
      <div class="kd-controls" data-demo-controls hidden>{_fieldset("Compare the published inputs and responses",
        _button("echo-no-context", "Without context") + _button("echo-with-context", "With complementary context", True))}</div>
      <div data-echo-case-state data-demo-state="echo-case">
        <article class="kd-echo-document"><h5>Context supplied with the question</h5><p data-echo-context>Myotis lucifralis shares a roost with Myotis nattereri.</p><p class="kd-small">The paper prints an abbreviated context. This is its relevant co-roosting fact, paraphrased.</p></article>
        <div class="kd-echo-trace">
          <div><span class="kd-label">Resolve the co-roosting species</span><strong data-echo-entity>Myotis nattereri</strong><p data-echo-hop1>The response follows the supplied relationship.</p></div>
          <div class="is-blocked" data-echo-second-hop><span class="kd-label">Recall what that species eats</span><strong data-echo-recalled>Not resolved from memory</strong><p data-echo-hop2>The response notices that the context does not list the prey and ultimately abstains.</p></div>
        </div>
        <div class="kd-echo-output"><div><span class="kd-label">Recorded final answer</span><strong data-echo-answer>Unknown</strong></div><p data-echo-diagnosis>It identifies the intermediate species correctly but fails to complete the memory-dependent link.</p></div>
      </div>
      <p class="kd-echo-source">Input and response summaries adapted from <a href="https://arxiv.org/abs/2410.08414">Appendix B.5, Table 13</a>. The response is a published model result, not generated here. The answer key is Noctuidae; the printed response also uses an Unknown option.</p>
    </div>
    <div class="kd-echo-measurements">
      <h4>Is that uncertainty just one unusual example?</h4>
      <p>Compare the reported abstention rates across the complementary ALCUNA evaluation. Each control selects a measured condition.</p>
      <div class="kd-controls" data-demo-controls hidden>{_fieldset("Input and instruction",
        condition("none", "No context") + condition("neutral", "Neutral", True)
        + condition("trust", "Trust your knowledge") + condition("gold", "All facts in context"))}</div>
      <div data-demo-state="echo-measurements">
        <p class="kd-echo-instruction" data-echo-instruction>Combine the supplied information with your own knowledge; choose Unknown if you cannot answer. The neutral instruction already asks for internal knowledge.</p>
        <div class="kd-echo-chart" aria-label="Measured unknown-answer rates for four conditions">
          <div data-echo-rate="none"><span>No context</span><i aria-hidden="true" style="--echo-rate:23.89%"></i><strong>23.89%</strong></div>
          <div class="is-selected" data-echo-rate="neutral"><span>Neutral</span><i aria-hidden="true" style="--echo-rate:62.72%"></i><strong>62.72%</strong></div>
          <div data-echo-rate="trust"><span>Trust your knowledge</span><i aria-hidden="true" style="--echo-rate:23.88%"></i><strong>23.88%</strong></div>
          <div data-echo-rate="gold"><span>All facts in context</span><i aria-hidden="true" style="--echo-rate:0.08%"></i><strong>0.08%</strong></div>
        </div>
        {_readout("Measured result", "Unknown answers rise from 23.89% without context to 62.72% with complementary context and the neutral instruction: +38.83 percentage points.", " data-echo-aggregate")}
      </div>
      <p class="kd-small">Measured unknown-answer rates, not accuracy: <a href="https://arxiv.org/abs/2410.08414">Table 3</a>, LLaMA3.1-70B. These are aggregate experiments; the paper does not show all four prompt conditions for the individual question above. Instruction descriptions paraphrase Section 3.2 and Table 17.</p>
    </div>
    """


# --------------------------------------------------------------------------- Shell

def render_demo(slug: str, insight: dict[str, Any]) -> str:
    """Render a supported demo, or return an empty string for other insights."""
    if slug not in SUPPORTED:
        return ""
    demo = insight.get("demo", {})
    kind = demo.get("type")
    if kind == "temporal-editing":
        body = _temporal(slug, demo)
    elif kind == "evidence-composition":
        body = _composition(demo) + (
            f'<p class="kd-provenance">Source: <a href="{_text(demo["source_url"])}">{_text(demo["source_label"])}</a></p>'
        )
    elif kind == "multimodal-consistency":
        body = _multimodal(slug, demo)
    else:
        return ""
    config = _text(json.dumps(demo, ensure_ascii=False))
    return f"""
<section class="knowledge-demo" data-paper-demo="knowledge-{_text(kind)}" data-demo-config="{config}" aria-labelledby="{_text(slug)}-demo-title">
  <header class="kd-heading">
    <p class="kd-eyebrow">{_text(demo.get("eyebrow", "Interactive explanation"))}</p>
    <h3 id="{_text(slug)}-demo-title">{_text(demo["title"])}</h3>
    <p>{_text(demo["description"])}</p>
  </header>
  {body}
  <noscript><p class="kd-small">This is the initial selection. Enable JavaScript to change the selection.</p></noscript>
</section>
"""
