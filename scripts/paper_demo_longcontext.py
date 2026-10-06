"""Evidence demo for Coding Agents are Effective Long-Context Processors (arXiv 2603.20432v1).

The abstract reports that coding agents "outperform published state-of-the-art by 17.3% on
average". That number is the mean, over five benchmarks, of the relative change of the best
coding-agent score in Table 1 over the "Best Published" row. The reader picks a coding-agent
row and a reference row; each benchmark shows both scores (Measured, Table 1), their difference
and relative change (Computed), and the cost per query (Measured, Table 5). The summary gives the
mean and median relative change. The default selection reproduces the abstract's 17.3% and,
rounded to whole percentages, the labels printed on Figure 1; the build fails otherwise.

Values are transcribed in the insight's demo object (papers/insights/coding-agents-long-context.json)
as printed strings; cells printed as "–" are null. Insight demo fields read here:
  type            "headline-composition"
  eyebrow, title, description
  benchmarks      [{key, label, context, metric, unit}]   Table 1 columns
  agents          [{key, label, scores, costs}]           coding-agent rows of Tables 1 and 5
  references      [{key, label, scores, costs, rerun?, full_set?, cited?}]
  choice_labels   {"best": ..., "strongest": ...}          composite choices
  initial         {"agent": ..., "reference": ...}
  headline        "17.3"                                   the abstract's average
  figure1_labels  Figure 1's per-benchmark labels
  source_url      link to Table 1

The page is complete without JavaScript: the default comparison is rendered here, and
papers/demos/longcontext.js reveals the controls and re-renders the same markup with the same
arithmetic. Nothing calls a model or the network.
"""
from __future__ import annotations

import json
from html import escape
from statistics import median
from typing import Any

Demo = dict[str, Any]

SLUG = "coding-agents-long-context"
KIND = "headline-composition"
MINUS = "−"
BEST = "best"  # Highest coding-agent score per benchmark (the selection behind Figure 1).
STRONGEST = "strongest"  # Highest re-run baseline per benchmark (same 200-question sample).
STATIC_NOTE = "This is the default comparison. Enable JavaScript to choose other rows."


def _text(value: object) -> str:
    return escape(str(value), quote=True)


def _num(printed: str | None) -> float | None:
    return None if printed is None else float(printed)


def signed(value: float, digits: int) -> str:
    """'+8.50', '−0.80', '0.00'. Mirrored by signed() in longcontext.js."""
    text = f"{value:+.{digits}f}"
    if float(text) == 0:
        text = f"{0:.{digits}f}"
    return text.replace("-", MINUS)


def join(items: list[str]) -> str:
    """'A', 'A and B', 'A, B and C'. Mirrored by join() in longcontext.js."""
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def choice_label(demo: Demo, side: str, choice: str) -> str:
    if choice in demo["choice_labels"]:
        return demo["choice_labels"][choice]
    rows = demo["agents"] if side == "agent" else demo["references"]
    return next(row["label"] for row in rows if row["key"] == choice)


def pick(demo: Demo, side: str, choice: str, index: int) -> Demo | None:
    """The Table 1 row that supplies one benchmark's score, or None if it prints none.

    Composite choices take the highest score among their candidates (ties keep the first row
    in table order). Mirrored by pick() in longcontext.js.
    """
    rows = demo["agents"] if side == "agent" else demo["references"]
    if choice == BEST or choice == STRONGEST:
        candidates = rows if choice == BEST else [row for row in rows if row.get("rerun")]
        chosen = None
        for row in candidates:
            value = _num(row["scores"][index])
            if value is not None and (chosen is None or value > _num(chosen["scores"][index])):
                chosen = row
        return chosen
    row = next(row for row in rows if row["key"] == choice)
    return row if row["scores"][index] is not None else None


def compare(demo: Demo, agent: str, reference: str) -> list[Demo]:
    """One entry per benchmark: both scores, costs, difference and relative change (%).

    Mirrored by compare() in longcontext.js.
    """
    out = []
    for index, bench in enumerate(demo["benchmarks"]):
        a_row = pick(demo, "agent", agent, index)
        r_row = pick(demo, "reference", reference, index)
        a = a_row["scores"][index] if a_row else None
        r = r_row["scores"][index] if r_row else None
        entry = {
            "key": bench["key"], "label": bench["label"], "unit": bench["unit"],
            "a": a, "a_row": a_row["label"] if a_row else choice_label(demo, "agent", agent),
            "r": r, "r_row": r_row["label"] if r_row else choice_label(demo, "reference", reference),
            "a_cost": a_row["costs"][index] if a_row else None,
            "r_cost": r_row["costs"][index] if r_row else None,
            "full_set": bool(r_row and r_row.get("full_set", [False] * 5)[index]),
            "diff": None, "rel": None,
        }
        if a is not None and r is not None:
            entry["diff"] = _num(a) - _num(r)
            entry["rel"] = (_num(a) - _num(r)) / _num(r) * 100
        out.append(entry)
    return out


def stats(rows: list[Demo]) -> Demo:
    """Mean and median relative change and the win count. Mirrored by stats() in longcontext.js."""
    both = [row for row in rows if row["rel"] is not None]
    rels = [row["rel"] for row in both]
    return {
        "n": len(both),
        "higher": sum(row["diff"] > 0 for row in both),
        "mean": sum(rels) / len(rels) if rels else None,
        "median": median(rels) if rels else None,
    }


def _groups(rows: list[Demo], value_key: str, row_key: str) -> str:
    """Which row a composite choice used where: 'Claude Code + BM25 on Oolong-Real and LongBench; ...'."""
    order: list[str] = []
    benches: dict[str, list[str]] = {}
    for row in rows:
        if row[value_key] is None:
            continue
        name = row[row_key]
        if name not in benches:
            order.append(name)
            benches[name] = []
        benches[name].append(row["label"])
    return "; ".join(f"{name} on {join(benches[name])}" for name in order)


def summary(demo: Demo, agent: str, reference: str) -> str:
    """Describe the selected comparison. Mirrored by summary() in longcontext.js."""
    rows = compare(demo, agent, reference)
    both = [row for row in rows if row["rel"] is not None]
    a_name, r_name = choice_label(demo, "agent", agent), choice_label(demo, "reference", reference)
    if not both:
        return f"{a_name} and {r_name} share no benchmark in Table 1."
    s = stats(rows)
    lower = [row["label"] for row in both if row["diff"] < 0]
    tied = [row["label"] for row in both if row["diff"] == 0]
    text = f"{a_name} vs {r_name}: higher on {s['higher']} of {s['n']} benchmarks"
    if lower:
        text += f", lower on {join(lower)}"
    if tied:
        text += f", tied on {join(tied)}"
    text += "."
    mean = signed(s["mean"], 1)
    text += f" Mean relative change {mean}%"
    if agent == demo["initial"]["agent"] and reference == demo["initial"]["reference"] and mean == "+" + demo["headline"]:
        text += ", matching the abstract"
    largest = max(both, key=lambda row: abs(row["rel"]))
    if len(both) > 1:
        text += (f"; the largest term is {largest['label']} at {signed(largest['rel'], 1)}% "
                 f"({signed(largest['diff'], 2)} {largest['unit']})")
    text += "."
    if agent == BEST and reference == "published" and len(both) == len(rows):
        rounded = [signed(row["rel"], 0) + "%" for row in rows]
        if rounded == demo["figure1_labels"]:
            text += f" Rounded, the five terms are Figure 1’s labels ({', '.join(rounded)})."
    if agent == BEST:
        text += f" Best per benchmark takes {_groups(rows, 'a', 'a_row')}."
    if reference == STRONGEST:
        text += f" Strongest re-run baseline: {_groups(rows, 'r', 'r_row')}."
    full = [row for row in both if row["full_set"]]
    if full:
        text += (f" {len(full)} of the {len(both)} reference scores (*) were measured on the full test set, "
                 f"not on the paper’s 200-question sample.")
    costs = [row for row in both if row["a_cost"] is not None and row["r_cost"] is not None]
    if costs:
        cheaper = sum(_num(row["a_cost"]) < _num(row["r_cost"]) for row in costs)
        ratios = [_num(row["a_cost"]) / _num(row["r_cost"]) for row in costs]
        span = f"{min(ratios):.2f}×" if len(costs) == 1 else f"{min(ratios):.2f}–{max(ratios):.2f}×"
        text += (f" Cost per query (Table 5): the agent is cheaper on {cheaper} of {len(costs)} benchmarks; "
                 f"its cost is {span} the reference’s.")
    elif reference == "published":
        text += " Table 5 lists no cost for best published results."
    missing = [row["label"] for row in rows if row["rel"] is None]
    if missing:
        text += f" No comparison on {join(missing)}: Table 1 prints no score there for one of the two rows."
    return text


def _width(printed: str | None) -> str:
    return f"{_num(printed):.2f}" if printed is not None else "0"


def row_html(demo: Demo, bench: Demo, row: Demo) -> str:
    """One benchmark row. Mirrored by rowHtml() in longcontext.js."""
    outcome = "none" if row["diff"] is None else "higher" if row["diff"] > 0 else "lower" if row["diff"] < 0 else "tie"
    a = row["a"] if row["a"] is not None else "–"
    r = (row["r"] + ("*" if row["full_set"] else "")) if row["r"] is not None else "–"
    diff = f"{signed(row['diff'], 2)} {row['unit']}" if row["diff"] is not None else "–"
    rel = f"{signed(row['rel'], 1)}%" if row["rel"] is not None else "–"
    a_cost = f"${row['a_cost']}" if row["a_cost"] is not None else "–"
    r_cost = f"${row['r_cost']}" if row["r_cost"] is not None else "–"
    return (
        f'<li class="lc-row" data-lc-bench="{_text(bench["key"])}" data-outcome="{outcome}">'
        f'<div class="lc-bench"><span class="lc-bench-name">{_text(bench["label"])}</span>'
        f'<span class="lc-bench-meta">{_text(bench["context"])} tokens · {_text(bench["metric"])}</span></div>'
        f'<div class="lc-pair">'
        f'<div class="lc-line is-agent"><span class="lc-who" data-lc-agent-row>{_text(row["a_row"])}</span>'
        f'<span class="lc-track" aria-hidden="true"><i style="width:{_width(row["a"])}%"></i></span>'
        f'<span class="lc-value" data-lc-agent>{_text(a)}</span></div>'
        f'<div class="lc-line is-ref"><span class="lc-who" data-lc-ref-row>{_text(row["r_row"])}</span>'
        f'<span class="lc-track" aria-hidden="true"><i style="width:{_width(row["r"])}%"></i></span>'
        f'<span class="lc-value" data-lc-ref>{_text(r)}</span></div></div>'
        f'<div class="lc-cell"><span class="lc-cell-label">Difference</span><span class="lc-value" data-lc-diff>{_text(diff)}</span></div>'
        f'<div class="lc-cell"><span class="lc-cell-label">Relative</span><span class="lc-value lc-rel" data-lc-rel>{_text(rel)}</span></div>'
        f'<div class="lc-cell"><span class="lc-cell-label">Cost per query</span><span class="lc-value" data-lc-cost>{_text(a_cost)} vs {_text(r_cost)}</span></div>'
        f'</li>'
    )


def stats_html(rows: list[Demo]) -> str:
    """The three headline numbers. Mirrored by statsHtml() in longcontext.js."""
    s = stats(rows)
    mean = f"{signed(s['mean'], 1)}%" if s["mean"] is not None else "–"
    mid = f"{signed(s['median'], 1)}%" if s["median"] is not None else "–"
    return (f'<div><dt>Mean relative change</dt><dd data-lc-stat="mean">{_text(mean)}</dd></div>'
            f'<div><dt>Median</dt><dd data-lc-stat="median">{_text(mid)}</dd></div>'
            f'<div><dt>Agent higher</dt><dd data-lc-stat="higher">{s["higher"]} of {s["n"]}</dd></div>')


def _button(action: str, value: str, label: str, selected: bool) -> str:
    return (f'<button type="button" data-demo-action="{action}" data-value="{_text(value)}" '
            f'aria-pressed="{str(selected).lower()}">{_text(label)}</button>')


def validate(demo: Demo) -> None:
    """Check the transcription against the paper's own derived numbers."""
    n = len(demo["benchmarks"])
    for row in demo["agents"] + demo["references"]:
        if len(row["scores"]) != n or len(row["costs"]) != n:
            raise ValueError(f"Long-context demo: {row['label']} needs {n} scores and costs")
        for score, cost in zip(row["scores"], row["costs"]):
            # Table 5 prints a cost exactly where Table 1 prints a re-run score.
            if row["key"] != "published" and (score is None) != (cost is None):
                raise ValueError(f"Long-context demo: {row['label']} score and cost cells disagree")
    rows = compare(demo, BEST, "published")
    mean = signed(stats(rows)["mean"], 1)
    if mean != "+" + demo["headline"]:
        raise ValueError(f"Long-context demo: default mean {mean}% does not reproduce the abstract's {demo['headline']}%")
    rounded = [signed(row["rel"], 0) + "%" for row in rows]
    if rounded != demo["figure1_labels"]:
        raise ValueError(f"Long-context demo: rounded terms {rounded} differ from Figure 1 {demo['figure1_labels']}")


def _config(demo: Demo) -> str:
    keys = ("benchmarks", "agents", "references", "choice_labels", "initial", "headline", "figure1_labels")
    return json.dumps({key: demo[key] for key in keys}, ensure_ascii=False, separators=(",", ":"))


def _headline(slug: str, demo: Demo) -> str:
    validate(demo)
    agent, reference = demo["initial"]["agent"], demo["initial"]["reference"]
    rows = compare(demo, agent, reference)
    agent_buttons = "".join(
        _button("lc-agent", key, choice_label(demo, "agent", key), key == agent)
        for key in [BEST] + [row["key"] for row in demo["agents"]])
    ref_keys = [row["key"] for row in demo["references"]]
    ref_order = ref_keys[:1] + [STRONGEST] + ref_keys[1:]
    ref_buttons = "".join(
        _button("lc-ref", key, choice_label(demo, "reference", key), key == reference) for key in ref_order)
    body = "".join(row_html(demo, bench, row) for bench, row in zip(demo["benchmarks"], rows))
    ident = f"{slug}-longcontext-title"
    source = _text(demo["source_url"])
    return f"""
<section class="longcontext-demo" data-paper-demo="longcontext-headline" data-demo-config="{_text(_config(demo))}" aria-labelledby="{_text(ident)}">
  <header class="lc-heading">
    <p class="lc-eyebrow">{_text(demo["eyebrow"])}</p>
    <h3 id="{_text(ident)}">{_text(demo["title"])}</h3>
    <p>{_text(demo["description"])}</p>
  </header>
  <div class="lc-controls" data-demo-controls hidden>
    <fieldset><legend>Coding agent</legend><div class="lc-buttons">{agent_buttons}</div></fieldset>
    <fieldset><legend>Compared with</legend><div class="lc-buttons">{ref_buttons}</div></fieldset>
  </div>
  <dl class="lc-stats" data-lc-stats data-demo-state="stats">{stats_html(rows)}</dl>
  <div class="lc-table" data-demo-state="rows">
    <div class="lc-head" aria-hidden="true"><span>Benchmark</span><span>Scores in Table 1 (bars run from 0 to 100)</span><span>Difference</span><span>Relative</span><span>Cost per query</span></div>
    <ol class="lc-rows" data-lc-rows aria-label="Per-benchmark comparison">{body}</ol>
  </div>
  <div class="lc-readout"><p class="lc-label">Selected comparison</p>
    <p class="lc-status" data-lc-status data-demo-state="summary" role="status" aria-live="polite">{_text(summary(demo, agent, reference))}</p></div>
  <p class="lc-key"><span class="lc-key-agent">Coding agent (paper’s method)</span><span class="lc-key-ref">Reference row</span><span>* best published score measured on the full test set</span></p>
  <noscript><p class="lc-small">{_text(STATIC_NOTE)}</p></noscript>
  <p class="lc-provenance">Measured: scores from <a href="{source}">Table 1</a> (accuracy for BrowseComp-Plus and LongBench, exact match for NQ, Oolong’s score; every row except Best Published was run on the paper’s random 200-question sample per benchmark) and average cost per query in US dollars from Table 5. Best Published scores marked * were measured on the full test set and are given in the paper for reference; Table 1 cites them to openJiuwen (2025), Zhang et al. (2025a, the Recursive Language Models paper, which used Oolong-Synthetic’s trec_coarse subset), Singh et al. (2025, the GPT-5 system card), Comanici et al. (2025, Gemini 2.5) and Hui et al. (2025, Interact-RAG). Table 1 prints 64.38 for both RLM and Best Published on Oolong-Syn. Context lengths are as printed in Table 1. Computed here: differences, relative changes (agent − reference) / reference, their mean and median over the benchmarks where both rows have a score, and the best or strongest row per benchmark.</p>
</section>
"""


def render_demo(slug: str, insight: dict[str, Any]) -> str:
    """Claim only this paper's page; every other slug gets an empty string."""
    if slug != SLUG:
        return ""
    demo = insight.get("demo", {})
    if demo.get("type") != KIND:
        return ""
    return _headline(slug, demo)
