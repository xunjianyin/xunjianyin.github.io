"""Server-rendered demos for the access-mode auditing study (auditing-health-llms).

- Method slot: the paper's Figure 1 (what a researcher controls through the API,
  ChatGPT, and ChatGPT Health), after the first mechanism paragraph.
- End of Method (render_method): the within- versus cross-mode Jaccard procedure
  of Section 5.5, applied to illustrative citation lists that the reader edits.
- Evidence slot: Table A2's paired access-mode contrasts with a reader-chosen
  p-value cut-off, Table A1's per-mode means for a selected measure, and Table
  A3's within- versus cross-mode overlaps. Values are copied as printed.

Insight `demo` fields: kind ("access-modes"), method_after, figure {src, alt,
caption}, overlap {eyebrow, title, description, sources, modes, presets, initial,
measured, provenance}, contrasts {eyebrow, title, description, thresholds,
initial, columns (Table A2 order), layout (display order of the columns and the
"direction" column, in header groups), means_columns, features, overlap_rows,
provenance}.

Each part renders a complete state without JavaScript; papers/demos/auditing.js
reveals the controls and recomputes the same quantities from data-demo-config.
There is no animation.
"""

from __future__ import annotations

import json
from html import escape
from typing import Any

Demo = dict[str, Any]

SLUG = "auditing-health-llms"
MINUS = "−"
# Printed placeholders in Table A2: not tested, and not part of the design.
NOT_TESTED = "n.t."
ABSENT = "—"
STATIC_NOTE = "This is the initial selection. Enable JavaScript to change it."


def _text(value: object) -> str:
    return escape(str(value), quote=True)


def _class(*names: str) -> str:
    joined = " ".join(name for name in names if name)
    return f' class="{joined}"' if joined else ""


def _button(action: str, label: str, selected: bool, value: str, extra: str = "") -> str:
    return (f'<button type="button" data-demo-action="{_text(action)}" data-value="{_text(value)}" '
            f'aria-pressed="{str(selected).lower()}"{extra}>{_text(label)}</button>')


def _fixed(value: float, digits: int) -> str:
    """Fixed-point text with a minus sign. Mirrored by fixed() in auditing.js.

    The tiny offset makes exact binary ties (such as 0.125) round up in both
    Python and JavaScript, so the two renderings always agree.
    """
    text = f"{abs(value) + 1e-9:.{digits}f}"
    negative = value < 0 and float(text) != 0
    return (MINUS if negative else "") + text


def _signed(value: float, digits: int) -> str:
    """Signed fixed-point text: +0.216, −0.040, 0.000. Mirrored by signed() in auditing.js."""
    text = _fixed(value, digits)
    if float(text.replace(MINUS, "-")) == 0:
        return f"{0:.{digits}f}"
    return text if text.startswith(MINUS) else "+" + text


def _shell(kind: str, ident: str, part: Demo, config: Demo, body: str) -> str:
    data = _text(json.dumps(config, ensure_ascii=False))
    return f"""
<section class="auditing-demo" data-paper-demo="auditing-{_text(kind)}" data-demo-config="{data}" aria-labelledby="{_text(ident)}">
  <header class="au-heading">
    <p class="au-eyebrow">{_text(part["eyebrow"])}</p>
    <h3 id="{_text(ident)}">{_text(part["title"])}</h3>
    <p>{_text(part["description"])}</p>
  </header>
  {body}
  <noscript><p class="au-small">{_text(STATIC_NOTE)}</p></noscript>
</section>
"""


# --------------------------------------------------------------------------- Figure 1

def _figure(figure: Demo) -> str:
    """The paper's Figure 1, kept legible: a fixed width that scrolls on phones."""
    src, alt, caption = figure["src"], figure["alt"], figure["caption"]
    width, height = figure["width"], figure["height"]
    return f"""
<figure class="au-figure">
  <div class="au-figure-scroll" tabindex="0" role="region" aria-label="Figure 1; scroll horizontally on narrow screens">
    <a href="{_text(src)}" target="_blank" rel="noopener" aria-label="Open Figure 1 at full size"><img src="{_text(src)}" alt="{_text(alt)}" width="{width}" height="{height}" loading="lazy" decoding="async"></a>
  </div>
  <figcaption><span class="au-scroll-hint">Scroll sideways to read the figure. </span>{_text(caption)} <a href="{_text(src)}" target="_blank" rel="noopener">Full size ↗</a></figcaption>
</figure>
"""


# --------------------------------------------------------------------------- Section 5.5: overlap procedure

def jaccard(first: list[int], second: list[int]) -> float | None:
    """Shared items over distinct items; undefined (None) when both sets are empty."""
    union = set(first) | set(second)
    if not union:
        return None
    return len(set(first) & set(second)) / len(union)


def _mean(values: list[float | None]) -> float | None:
    """Mean of the defined values (Section 5.5 excludes undefined comparisons)."""
    defined = [value for value in values if value is not None]
    return sum(defined) / len(defined) if defined else None


WITHIN_PAIRS = ((0, 1), (0, 2), (1, 2))


def overlap_state(runs: dict[str, list[list[int]]]) -> Demo:
    """Within- and cross-mode overlap for one question. Mirrored by overlapState() in auditing.js.

    Within-mode: mean Jaccard over the three pairs of repeated runs in a mode.
    Cross-mode: mean over the nine pairs that cross the two modes' runs.
    The paper compares cross-mode overlap with the mean of the two within-mode values.
    """
    api, chatgpt = runs["api"], runs["chatgpt"]
    within_api = [jaccard(api[i], api[j]) for i, j in WITHIN_PAIRS]
    within_chatgpt = [jaccard(chatgpt[i], chatgpt[j]) for i, j in WITHIN_PAIRS]
    cross = [jaccard(a, c) for a in api for c in chatgpt]
    wa, wc, cm = _mean(within_api), _mean(within_chatgpt), _mean(cross)
    baseline = (wa + wc) / 2 if wa is not None and wc is not None else None
    delta = baseline - cm if baseline is not None and cm is not None else None
    return {"within_api_pairs": within_api, "within_chatgpt_pairs": within_chatgpt, "cross_pairs": cross,
            "within_api": wa, "within_chatgpt": wc, "within": baseline, "cross": cm, "delta": delta}


def _value(value: float | None, digits: int = 3) -> str:
    return ABSENT if value is None else _fixed(value, digits)


def overlap_status(state: Demo) -> str:
    """Read the computed gap. Mirrored by overlapStatus() in auditing.js."""
    if state["delta"] is None:
        return ("Overlap is undefined when neither run of a pair cites anything, and the paper excludes such "
                "comparisons. Each mode needs at least one pair of runs with a citation, and so do the two modes "
                "together.")
    within, cross, delta = _value(state["within"]), _value(state["cross"]), _signed(state["delta"], 3)
    head = f"Within-mode baseline {within}, cross-mode {cross}: within minus cross is {delta}."
    if float(delta.replace(MINUS, "-")) > 0:
        tail = (" Runs share fewer sources across access modes than between repeated runs in one mode. "
                "A gap of this sign, consistent across questions, is what the paper's paired test detects.")
    elif float(delta.replace(MINUS, "-")) == 0:
        tail = (" Cross-mode overlap is no lower than between repeated runs, so here the access mode adds "
                "nothing beyond run-to-run variation: low cross-mode overlap on its own does not show an "
                "access-mode effect.")
    else:
        tail = (" Runs agree more across modes than within a mode. Every gap the paper reports is positive "
                "(Table A3).")
    return head + tail


def _runs(preset: Demo) -> dict[str, list[list[int]]]:
    return {mode: [sorted(run) for run in preset["runs"][mode]] for mode in ("api", "chatgpt")}


def _cite_rows(config: Demo, runs: dict[str, list[list[int]]]) -> str:
    rows = []
    for mode in config["modes"]:
        for index, run in enumerate(runs[mode["id"]]):
            key = f'{mode["id"]}-{index}'
            label = f'{mode["label"]} {index + 1}'
            cells = []
            for source in range(1, config["sources"] + 1):
                on = source in run
                mark = "●" if on else "·"
                state = "cited" if on else "not cited"
                cells.append(
                    f'<td{_class("is-on" if on else "")}>'
                    f'<button type="button" class="au-cite" data-demo-action="au-cite" data-run="{_text(key)}" '
                    f'data-source="{source}" aria-pressed="{str(on).lower()}" '
                    f'aria-label="{_text(label)} cites source {source}" hidden>{mark}</button>'
                    f'<span class="au-mark" data-au-static>{mark}<span class="au-sr"> {state}</span></span></td>')
            rows.append(f'<tr data-au-run="{_text(key)}"{_class("is-" + mode["id"])}><th scope="row">{_text(label)}</th>'
                        f'{"".join(cells)}<td class="au-count" data-au-count>{len(run)}</td></tr>')
    return "".join(rows)


def _pair_matrix(config: Demo, state: Demo) -> str:
    """Lower triangle of the 6 x 6 run-by-run Jaccard matrix."""
    labels = [f'{mode["label"]} {i + 1}' for mode in config["modes"] for i in range(3)]
    values: dict[tuple[int, int], tuple[float | None, str]] = {}
    for (i, j), value in zip(WITHIN_PAIRS, state["within_api_pairs"]):
        values[(j, i)] = (value, "within")
    for (i, j), value in zip(WITHIN_PAIRS, state["within_chatgpt_pairs"]):
        values[(j + 3, i + 3)] = (value, "within")
    for index, value in enumerate(state["cross_pairs"]):
        values[(3 + index % 3, index // 3)] = (value, "cross")
    head = "".join(f'<th scope="col">{_text(label)}</th>' for label in labels[:-1])
    rows = []
    for r in range(1, 6):
        cells = []
        for c in range(5):
            if c >= r:
                cells.append('<td class="au-empty"></td>')
                continue
            value, kind = values[(r, c)]
            shade = 0 if value is None else value
            cells.append(f'<td class="au-pair is-{kind}" data-au-pair="{r}-{c}" style="--au-shade:{_fixed(shade, 3)}">'
                         f'{_text(_value(value, 2))}</td>')
        rows.append(f'<tr><th scope="row">{_text(labels[r])}</th>{"".join(cells)}</tr>')
    return (f'<table class="au-pairs"><caption>Jaccard overlap of each pair of runs</caption>'
            f'<thead><tr><td></td>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>')


def _readout(state: Demo) -> str:
    items = (("within_api", "Within API", "mean of 3 pairs"), ("within_chatgpt", "Within ChatGPT", "mean of 3 pairs"),
             ("within", "Within-mode baseline", "mean of the two"), ("cross", "Cross-mode", "mean of 9 pairs"))
    rows = "".join(f'<div><dt>{_text(label)} <small>{_text(note)}</small></dt>'
                   f'<dd data-au-out="{key}">{_text(_value(state[key]))}</dd></div>' for key, label, note in items)
    delta = ABSENT if state["delta"] is None else _signed(state["delta"], 3)
    rows += (f'<div class="is-delta"><dt>Within minus cross <small>tested across questions</small></dt>'
             f'<dd data-au-out="delta">{_text(delta)}</dd></div>')
    return f'<dl class="au-readout" data-demo-state="readout">{rows}</dl>'


def _calculator(part: Demo) -> str:
    presets = {preset["id"]: preset for preset in part["presets"]}
    initial = presets[part["initial"]]
    runs = _runs(initial)
    for preset in part["presets"]:
        for mode in ("api", "chatgpt"):
            if len(preset["runs"][mode]) != 3:
                raise ValueError(f"Auditing overlap preset {preset['id']}: three runs per mode")
            if any(not 1 <= s <= part["sources"] for run in preset["runs"][mode] for s in run):
                raise ValueError(f"Auditing overlap preset {preset['id']}: source out of range")
    state = overlap_state(runs)
    buttons = "".join(_button("au-preset", preset["label"], preset["id"] == initial["id"], preset["id"])
                      for preset in part["presets"])
    sources = "".join(f'<th scope="col">{s}</th>' for s in range(1, part["sources"] + 1))
    config = {key: part[key] for key in ("sources", "modes", "presets", "initial")}
    body = f"""
  <div class="au-controls" data-demo-controls hidden>
    <fieldset><legend>Illustrative preset</legend><div class="au-buttons">{buttons}</div></fieldset>
    <p class="au-hint">Or switch a single citation in the grid.</p>
  </div>
  <div class="au-calc">
    <div class="au-table-wrap" data-demo-state="citations" tabindex="0" role="region" aria-label="Sources cited by each run">
      <table class="au-cites"><caption>Sources cited by each run <small>(source labels 1–{part["sources"]})</small></caption>
        <thead><tr><th scope="col">Run</th>{sources}<th scope="col" class="au-count">n</th></tr></thead>
        <tbody data-au-cites>{_cite_rows(part, runs)}</tbody></table>
    </div>
    <div class="au-table-wrap" data-demo-state="pairs" data-au-pairs tabindex="0" role="region" aria-label="Jaccard overlap of each pair of runs">{_pair_matrix(part, state)}</div>
  </div>
  <p class="au-legend"><span class="au-key-within">Within a mode</span><span class="au-key-cross">Across modes</span><span>Shading grows with overlap.</span></p>
  {_readout(state)}
  <p class="au-status" data-au-calc-status role="status" aria-live="polite">{_text(overlap_status(state))}</p>
  <p class="au-measured">{_text(part["measured"])}</p>
  <p class="au-provenance">{_text(part["provenance"])}</p>"""
    return _shell("overlap", "auditing-overlap-title", part, config, body)


# --------------------------------------------------------------------------- Tables A1–A3: contrasts

def significant(p: str | None, threshold: str) -> bool:
    """Is a printed p-value below the cut-off? '<0.001' counts as below 0.001."""
    if p is None:
        return False
    cut = float(threshold)
    if p.startswith("<"):
        return float(p[1:]) <= cut
    return float(p) < cut


def _number(text: str) -> float:
    return float(text.replace(MINUS, "-"))


def cell_state(cell: list[str], threshold: str) -> str:
    """'pos' or 'neg' (first-named mode higher or lower, p below the cut-off), 'ns', 'nt', or 'absent'.
    Mirrored by cellState() in auditing.js."""
    if cell[0] == ABSENT:
        return "absent"
    if cell[0] == NOT_TESTED:
        return "nt"
    if not significant(cell[1], threshold):
        return "ns"
    return "pos" if _number(cell[0]) > 0 else "neg"


def version_direction(feature: Demo, threshold: str) -> str:
    """Compare the ChatGPT-vs-API contrast in GPT-5.3 (column 0) and GPT-5.4 (column 3).
    Mirrored by versionDirection() in auditing.js."""
    old, new = (cell_state(feature["contrasts"][i], threshold) for i in (0, 3))
    if old == "absent" or new == "absent":
        return "absent"
    old_sig, new_sig = old in ("pos", "neg"), new in ("pos", "neg")
    if old_sig and new_sig:
        return "same" if old == new else "reverses"
    if old_sig:
        return "old"
    if new_sig:
        return "new"
    return "neither"


DIRECTION_LABELS = {"same": "Same", "reverses": "Reverses", "old": "5.3 only", "new": "5.4 only",
                    "neither": "Neither", "absent": ABSENT}


def _p_text(p: str) -> str:
    return f"p < {p[1:]}" if p.startswith("<") else f"p = {p}"


def contrast_summary(part: Demo, threshold: str) -> str:
    """Counts per column and across versions. Mirrored by contrastSummary() in auditing.js."""
    parts = []
    for index, column in enumerate(part["columns"]):
        states = [cell_state(feature["contrasts"][index], threshold) for feature in part["features"]]
        tested = [s for s in states if s not in ("nt", "absent")]
        marked = [s for s in tested if s in ("pos", "neg")]
        noun = " tested measures differ" if not parts else ""
        parts.append(f'{len(marked)} of {len(tested)}{noun} for {column["version"]} {column["label"]}')
    directions = [version_direction(feature, threshold) for feature in part["features"]]
    both = [f for f, d in zip(part["features"], directions) if d in ("same", "reverses")]
    flips = [f for f, d in zip(part["features"], directions) if d == "reverses"]
    kept = [f for f, d in zip(part["features"], directions) if d == "same"]
    text = f"With p < {threshold} as the cut-off, " + ", ".join(parts[:-1]) + f", and {parts[-1]}. "
    if not both:
        return text + "No measure passes the cut-off in both versions' ChatGPT-vs-API contrasts."
    count = f"all {len(flips)}" if len(flips) == len(both) else str(len(flips))
    text += (f"Of the {len(both)} measures that pass in both versions' ChatGPT-vs-API contrasts, "
             f"{count} change direction between GPT-5.3 and GPT-5.4")
    if kept:
        names = ", ".join(f'{f["label"].lower()} ({f["measure"]}' + (f', {f["caveat"]})' if f.get("caveat") else ")")
                          for f in kept)
        verb = "keeps its" if len(kept) == 1 else "keep their"
        text += f"; only {names} {verb} direction."
    else:
        text += "."
    return text


def _cell_sentence(part: Demo, feature: Demo, index: int, threshold: str) -> str:
    column = part["columns"][index]
    cell = feature["contrasts"][index]
    state = cell_state(cell, threshold)
    pair = f'{column["version"]} {column["first"]} vs {column["second"]}'
    if state == "absent":
        return ""
    if state == "nt":
        return f"{pair}: not tested (fewer than two questions had a nonzero paired difference)."
    value = f'{cell[0]}{feature["unit"]}, {_p_text(cell[1])}'
    if state == "ns":
        return f"{pair}: {value}, not below the cut-off."
    word = feature["up"] if state == "pos" else feature["down"]
    return f'{pair}: {value}; {column["first"]} {word}.'


DIRECTION_SENTENCES = {
    "same": "The ChatGPT-vs-API difference keeps its direction from GPT-5.3 to GPT-5.4.",
    "reverses": "The ChatGPT-vs-API difference reverses direction from GPT-5.3 to GPT-5.4.",
    "old": "The ChatGPT-vs-API difference passes the cut-off in GPT-5.3 only.",
    "new": "The ChatGPT-vs-API difference passes the cut-off in GPT-5.4 only.",
    "neither": "Neither version's ChatGPT-vs-API difference passes the cut-off.",
    "absent": "This measure exists for GPT-5.4 only.",
}


def feature_status(part: Demo, feature_id: str, threshold: str) -> str:
    """Read one measure across the four contrasts. Mirrored by featureStatus() in auditing.js."""
    feature = next(f for f in part["features"] if f["id"] == feature_id)
    sentences = [_cell_sentence(part, feature, i, threshold) for i in range(len(part["columns"]))]
    sentences.append(DIRECTION_SENTENCES[version_direction(feature, threshold)])
    return " ".join(s for s in sentences if s)


def overlap_summary(part: Demo, threshold: str) -> str:
    """Table A3 at the cut-off. Mirrored by overlapSummary() in auditing.js."""
    rows = part["overlap_rows"]
    marked = [r for r in rows if significant(r["p"], threshold)]
    deltas = [_number(r["delta"]) for r in rows]
    names = "; ".join(f'{r["metric"].lower()}, {r["pair"]}' for r in marked)
    text = f"At p < {threshold}, cross-mode overlap is below the within-mode baseline in {len(marked)} of {len(rows)} comparisons"
    text += f": {names}." if marked else "."
    low, high = min(deltas), max(deltas)
    return text + (f" All printed gaps are positive (within minus cross from {_signed(low, 3)} to {_signed(high, 3)})."
                   if low > 0 else "")


def _bar_scale(feature: Demo) -> float:
    if feature["percent"]:
        return 100.0
    return max(_number(m[0]) for m in feature["means"] if m)


def _means_rows(part: Demo, feature: Demo) -> str:
    scale = _bar_scale(feature)
    rows = []
    for label, mean in zip(part["means_columns"], feature["means"]):
        if mean is None:
            rows.append(f'<tr class="is-absent"><th scope="row">{_text(label)}</th><td></td><td class="au-num">{ABSENT}</td></tr>')
            continue
        width = 0 if scale == 0 else 100 * _number(mean[0]) / scale
        rows.append(f'<tr><th scope="row">{_text(label)}</th>'
                    f'<td><span class="au-bar" aria-hidden="true"><i style="width:{_fixed(width, 2)}%"></i></span></td>'
                    f'<td class="au-num">{_text(mean[0])} <small>({_text(mean[1])})</small></td></tr>')
    return "".join(rows)


def _cell_html(cell: list[str], threshold: str, column: str) -> str:
    state = cell_state(cell, threshold)
    if state in ("absent", "nt"):
        return f'<td class="au-cell" data-au-cell="{column}" data-state="{state}"><span class="au-delta">{_text(cell[0])}</span></td>'
    return (f'<td class="au-cell" data-au-cell="{column}" data-state="{state}"><span class="au-delta">{_text(cell[0])}</span>'
            f'<span class="au-p">{_text(_p_text(cell[1]))}</span></td>')


DIRECTION = "direction"


def _layout_cells(part: Demo) -> list[tuple[str, bool]]:
    """Display order of the grid columns: (column id or 'direction', starts a header group)."""
    cells = []
    for group in part["layout"]:
        for index, cell in enumerate(group["cells"]):
            cells.append((cell["id"], index == 0))
    return cells


def _grid_rows(part: Demo, threshold: str, selected: str) -> str:
    rows, group = [], None
    layout = _layout_cells(part)
    index = {column["id"]: i for i, column in enumerate(part["columns"])}
    for feature in part["features"]:
        if feature["dimension"] != group:
            group = feature["dimension"]
            rows.append(f'<tr class="au-group"><th scope="colgroup" colspan="{len(layout) + 1}">{_text(group)}</th></tr>')
        label = f'{_text(feature["label"])} <small>{_text(feature["measure"])}</small>'
        direction = version_direction(feature, threshold)
        cells = []
        for cell_id, starts in layout:
            if cell_id == DIRECTION:
                cells.append(f'<td class="au-direction{" au-group-start" if starts else ""}" data-au-direction '
                             f'data-state="{direction}">{_text(DIRECTION_LABELS[direction])}</td>')
            else:
                html = _cell_html(feature["contrasts"][index[cell_id]], threshold, cell_id)
                cells.append(html.replace('class="au-cell"', 'class="au-cell au-group-start"', 1) if starts else html)
        on = feature["id"] == selected
        rows.append(
            f'<tr data-au-feature="{_text(feature["id"])}"{_class("is-selected" if on else "")}>'
            f'<th scope="row"><button type="button" class="au-row-button" data-demo-action="au-feature" '
            f'data-value="{_text(feature["id"])}" aria-pressed="{str(on).lower()}" hidden>{label}</button>'
            f'<span class="au-row-label" data-au-static>{label}</span></th>{"".join(cells)}</tr>')
    return "".join(rows)


def _grid_head(part: Demo) -> str:
    groups = "".join(f'<th scope="colgroup" colspan="{len(group["cells"])}" class="au-group-start">{_text(group["group"])}</th>'
                     for group in part["layout"])
    labels = []
    for group in part["layout"]:
        for i, cell in enumerate(group["cells"]):
            kind = "au-direction" if cell["id"] == DIRECTION else "au-cell-head"
            labels.append(f'<th scope="col"{_class(kind, "au-group-start" if i == 0 else "")}>{_text(cell["label"])}</th>')
    return f'<thead><tr><th scope="col" rowspan="2">Measure</th>{groups}</tr><tr>{"".join(labels)}</tr></thead>'


def _overlap_rows(part: Demo, threshold: str) -> str:
    rows = []
    for index, row in enumerate(part["overlap_rows"]):
        on = significant(row["p"], threshold)
        within, cross = _number(row["within"]), _number(row["cross"])
        rows.append(
            f'<tr data-au-overlap="{index}" data-state="{"sig" if on else "ns"}">'
            f'<th scope="row">{_text(row["metric"])}<small>{_text(row["pair"])} · n = {_text(row["n"])}</small></th>'
            f'<td class="au-track-cell"><span class="au-track" aria-hidden="true">'
            f'<i class="au-gap" style="left:{_fixed(100 * cross, 1)}%;width:{_fixed(100 * (within - cross), 1)}%"></i>'
            f'<i class="au-dot is-cross" style="left:{_fixed(100 * cross, 1)}%"></i>'
            f'<i class="au-dot is-within" style="left:{_fixed(100 * within, 1)}%"></i></span></td>'
            f'<td class="au-num">{_text(row["within"])}</td><td class="au-num">{_text(row["cross"])}</td>'
            f'<td class="au-num au-strong">{_text(row["delta"])}</td><td class="au-num">{_text(row["p"])}</td></tr>')
    return "".join(rows)


def _validate_contrasts(part: Demo) -> None:
    ids = [f["id"] for f in part["features"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Auditing contrasts: duplicate feature id")
    for feature in part["features"]:
        if len(feature["means"]) != len(part["means_columns"]) or len(feature["contrasts"]) != len(part["columns"]):
            raise ValueError(f"Auditing contrasts: wrong number of cells for {feature['id']}")
        for cell in feature["contrasts"]:
            if cell[0] in (ABSENT, NOT_TESTED):
                if len(cell) != 1:
                    raise ValueError(f"Auditing contrasts: {feature['id']} placeholder carries a p-value")
            elif len(cell) != 2:
                raise ValueError(f"Auditing contrasts: {feature['id']} cell needs a difference and a p-value")
    if part["initial"]["threshold"] not in part["thresholds"] or part["initial"]["feature"] not in ids:
        raise ValueError("Auditing contrasts: invalid initial selection")
    shown = sorted(cell_id for cell_id, _ in _layout_cells(part))
    if shown != sorted([column["id"] for column in part["columns"]] + [DIRECTION]):
        raise ValueError("Auditing contrasts: the layout must show every column and the direction once")


def _contrasts(part: Demo) -> str:
    _validate_contrasts(part)
    threshold, selected = part["initial"]["threshold"], part["initial"]["feature"]
    feature = next(f for f in part["features"] if f["id"] == selected)
    buttons = "".join(_button("au-threshold", f"p < {t}", t == threshold, t) for t in part["thresholds"])
    config ={key: part[key] for key in ("thresholds", "initial", "columns", "means_columns", "features", "overlap_rows")}
    body = f"""
  <div class="au-controls" data-demo-controls hidden>
    <fieldset><legend>Mark a difference when its unadjusted p is below</legend><div class="au-buttons">{buttons}</div></fieldset>
    <p class="au-hint">Select a measure in the table to see its per-mode means.</p>
  </div>
  <p class="au-status au-summary" data-au-summary data-demo-state="summary" role="status" aria-live="polite">{_text(contrast_summary(part, threshold))}</p>
  <div class="au-table-wrap" data-demo-state="contrasts" tabindex="0" role="region" aria-label="Paired access-mode contrasts, Table A2">
    <table class="au-grid">
      {_grid_head(part)}
      <tbody data-au-grid>{_grid_rows(part, threshold, selected)}</tbody>
    </table>
  </div>
  <p class="au-legend"><span class="au-key-pos">First-named mode higher</span><span class="au-key-neg">First-named mode lower</span><span class="au-key-ns">Not below the cut-off</span><span>n.t. not tested · — not in the design</span></p>
  <div class="au-detail" data-demo-state="detail">
    <h4><span data-au-detail-title>{_text(feature["label"])}</span> <small data-au-detail-measure>{_text(feature["measure"])}</small></h4>
    <p class="au-small" data-au-detail-note>{_text(feature["note"])}</p>
    <table class="au-means"><caption>Mean (SD) over questions, Table A1. API and ChatGPT: 50 questions; Health: 42.</caption><tbody data-au-means>{_means_rows(part, feature)}</tbody></table>
    <p class="au-status" data-au-detail-status aria-live="polite">{_text(feature_status(part, selected, threshold))}</p>
  </div>
  <div class="au-overlap" data-demo-state="overlap">
    <h4>Within- versus cross-mode overlap <small>Table A3, mean Jaccard overlap per question</small></h4>
    <div class="au-table-wrap" tabindex="0" role="region" aria-label="Within- versus cross-mode overlap, Table A3">
      <table class="au-overlap-table"><thead><tr><th scope="col">Set compared</th>
        <th scope="col" class="au-track-cell">0 to 1</th><th scope="col" class="au-num">Within</th><th scope="col" class="au-num">Cross</th>
        <th scope="col" class="au-num">Δ</th><th scope="col" class="au-num">p</th></tr></thead>
        <tbody data-au-overlap-rows>{_overlap_rows(part, threshold)}</tbody></table>
    </div>
    <p class="au-legend"><span class="au-key-dot-within">Within mode</span><span class="au-key-dot-cross">Across modes</span><span>Δ is within minus cross.</span></p>
    <p class="au-status" data-au-overlap-status aria-live="polite">{_text(overlap_summary(part, threshold))}</p>
  </div>
  <p class="au-provenance">{_text(part["provenance"])}</p>"""
    return _shell("contrasts", "auditing-contrasts-title", part, config, body)


# --------------------------------------------------------------------------- Entry points

def _demo(slug: str, insight: dict[str, Any]) -> Demo | None:
    demo = insight.get("demo") or {}
    return demo if slug == SLUG and demo.get("kind") == "access-modes" else None


def render_demo(slug: str, insight: dict[str, Any]) -> dict[str, str] | str:
    """Figure 1 in the method slot and the Table A1–A3 explorer in the evidence slot."""
    demo = _demo(slug, insight)
    if demo is None:
        return ""
    return {"method": _figure(demo["figure"]), "evidence": _contrasts(demo["contrasts"])}


def render_method(slug: str, insight: dict[str, Any]) -> str:
    """The Section 5.5 overlap procedure, at the end of Method."""
    demo = _demo(slug, insight)
    return _calculator(demo["overlap"]) if demo else ""
