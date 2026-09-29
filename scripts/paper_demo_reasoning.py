"""Static, progressively enhanced demos for the two reasoning papers.

Every demo renders a complete, readable state without JavaScript. The
ContraSolver state is computed here with the same procedure that
papers/demos/reasoning.js runs in the browser, so the no-script page shows the
algorithm's real output for the example inputs rather than hand-written text.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from html import escape

# --------------------------------------------------------------------------
# ContraSolver (arXiv 2406.08842v1, Section 3.3 and Algorithm 1)
# --------------------------------------------------------------------------

NODES: tuple[str, ...] = ("A", "B", "C", "D", "E")

# Prompt prefix from the paper's case study (Appendix, Table 8). The five
# continuations are illustrative text written for this demo, not model outputs.
PROMPT_PREFIX = "Another laughably lame and senseless"
RESPONSES: tuple[tuple[str, str], ...] = (
    ("A", "…premise, but the cast turns it into a warm, genuinely funny film."),
    ("B", "…plot, yet the final act is surprisingly moving."),
    ("C", "…script, with a few good jokes along the way."),
    ("D", "…sequel that I had forgotten by the next morning."),
    ("E", "…mess. I walked out halfway through."),
)

# One judgment per pair, in a fixed order that also breaks confidence ties
# (the paper does not specify tie handling). (preferred, other, confidence).
# Illustrative confidences; two judgments (D over B, E over C) disagree with
# the evident ordering of the texts.
DEFAULT_EDGES: tuple[tuple[str, str, float], ...] = (
    ("A", "B", 0.70), ("A", "C", 0.80), ("A", "D", 0.76), ("A", "E", 0.95),
    ("B", "C", 0.90), ("D", "B", 0.59), ("B", "E", 0.92),
    ("C", "D", 0.88), ("E", "C", 0.64),
    ("D", "E", 0.86),
)
DELTA = 0.51  # Appendix C: edges below this confidence are discarded.
# Reader-controlled range, passed to the script through data attributes.
CONFIDENCE_MIN, CONFIDENCE_MAX, CONFIDENCE_STEP = 0.51, 0.99, 0.05

# Table 4: share of training prompts whose preference graph contains a cycle,
# without and with ContraSolver self-alignment (measured).
TABLE4: tuple[tuple[str, tuple[tuple[str, float, float], ...]], ...] = (
    ("Llama-2-7b-chat", (("SafeEdit", 13.30, 10.40), ("Alpaca", 17.50, 14.30),
                         ("IMDb", 22.10, 19.70), ("TL;DR", 14.70, 12.00))),
    ("Vicuna-7b", (("SafeEdit", 30.60, 18.90), ("Alpaca", 26.60, 15.30),
                   ("IMDb", 32.80, 26.60), ("TL;DR", 19.80, 14.30))),
)

CS_SOURCE = "https://arxiv.org/html/2406.08842v1"


@dataclass
class PassRecord:
    """What one reverse loop plus forward loop did (one while-iteration)."""
    number: int
    # (contradictory edge, heuristic edges on its cycles, shortest kept chain loser -> winner)
    contradictions: list[tuple[int, list[int], list[str]]] = field(default_factory=list)
    skipped: list[int] = field(default_factory=list)
    added: int | None = None


@dataclass
class SolverResult:
    tree: list[int]
    stage: dict[int, str]
    pass_of: dict[int, int]
    heuristic: set[int]
    passes: list[PassRecord]
    order: list[str]


def _reachable(adjacency: dict[str, set[str]], start: str) -> set[str]:
    seen, stack = {start}, [start]
    while stack:
        for nxt in adjacency[stack.pop()]:
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return seen


def _shortest_path(adjacency: dict[str, set[str]], start: str, goal: str) -> list[str]:
    """Breadth-first path in the kept graph, visiting neighbours alphabetically."""
    previous: dict[str, str | None] = {start: None}
    queue = [start]
    while queue:
        node = queue.pop(0)
        if node == goal:
            break
        for nxt in sorted(adjacency[node]):
            if nxt not in previous:
                previous[nxt] = node
                queue.append(nxt)
    path, node = [], goal
    while node is not None:
        path.append(node)
        node = previous[node]
    return path[::-1]


def solve_contrasolver(edges: tuple[tuple[str, str, float], ...]) -> SolverResult:
    """Algorithm 1: Kruskal maximum spanning tree, then alternate reverse and
    forward loops until every remaining edge is classified."""
    usable = [i for i, (_, _, w) in enumerate(edges) if w >= DELTA]
    descending = sorted(usable, key=lambda i: (-edges[i][2], i))
    ascending = sorted(usable, key=lambda i: (edges[i][2], i))
    # Kruskal on the undirected skeleton: strongest comparisons first.
    parent = {node: node for node in NODES}

    def find(node: str) -> str:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    tree: list[int] = []
    for i in descending:
        a, b = find(edges[i][0]), find(edges[i][1])
        if a != b:
            parent[a] = b
            tree.append(i)
    adjacency: dict[str, set[str]] = {node: set() for node in NODES}
    kept = set(tree)
    for i in tree:
        adjacency[edges[i][0]].add(edges[i][1])
    stage = {i: "tree" for i in tree}
    pass_of = {i: 0 for i in tree}
    remaining = [i for i in usable if i not in kept]
    heuristic: set[int] = set()
    passes: list[PassRecord] = []
    while remaining:
        record = PassRecord(len(passes) + 1)
        # Reverse loop, ascending confidence: an edge u -> v closes a cycle
        # when v already reaches u. G' is not modified in this loop.
        for i in ascending:
            if i not in remaining:
                continue
            winner, loser = edges[i][0], edges[i][1]
            if winner in _reachable(adjacency, loser):
                from_loser = _reachable(adjacency, loser)
                to_winner = {n for n in NODES if winner in _reachable(adjacency, n)}
                # Every kept edge on some loser -> ... -> winner path is heuristic.
                cycle = sorted(j for j in kept if edges[j][0] in from_loser and edges[j][1] in to_winner)
                heuristic.update(cycle)
                record.contradictions.append((i, cycle, _shortest_path(adjacency, loser, winner)))
                stage[i], pass_of[i] = "contradictory", record.number
                remaining.remove(i)
        # Forward loop, descending confidence: skip implied (untopological)
        # edges, add the first edge that creates a new ordering relation.
        for i in descending:
            if i not in remaining:
                continue
            remaining.remove(i)
            winner, loser = edges[i][0], edges[i][1]
            if loser in _reachable(adjacency, winner) or winner in _reachable(adjacency, loser):
                record.skipped.append(i)
                stage[i], pass_of[i] = "implied", record.number
                continue
            adjacency[winner].add(loser)
            kept.add(i)
            record.added = i
            stage[i], pass_of[i] = "added", record.number
            break
        passes.append(record)
    # Property 2: kept edges plus reversed contradictions form a DAG; with one
    # judgment per pair it is a total order, ranked here by reachability.
    order = sorted(NODES, key=lambda n: (-len(_reachable(adjacency, n)), n))
    return SolverResult(tree, stage, pass_of, heuristic, passes, order)


def _judgment(edge: tuple[str, str, float]) -> str:
    return f"{edge[0]} ≻ {edge[1]}"


def _fmt(value: float) -> str:
    return f"{value:.2f}"


def edge_class(result: SolverResult, index: int) -> str:
    """Visual class shared by the SVG, the edge list and the legend."""
    if index in result.heuristic:
        return "heuristic"
    stage = result.stage[index]
    return "kept" if stage in ("tree", "added") else stage


def outcome_text(result: SolverResult, index: int) -> str:
    stage, number = result.stage[index], result.pass_of[index]
    trained = " · DPO pair" if index in result.heuristic else " · not trained"
    if stage == "tree":
        return "Spanning tree" + trained
    if stage == "added":
        return f"Added, pass {number}" + trained
    if stage == "contradictory":
        return f"Contradictory, pass {number}"
    return f"Implied, skipped in pass {number}"


def _chain(path: list[str]) -> str:
    return " ≻ ".join(path)


def pass_log_items(edges: tuple[tuple[str, str, float], ...], result: SolverResult) -> list[tuple[str, list[str]]]:
    """(label, sentences) describing what the algorithm did; mirrored exactly in JS."""
    named = lambda i: f"{_judgment(edges[i])} {_fmt(edges[i][2])}"  # noqa: E731
    items = [("Tree", ["Kruskal keeps the strongest connected comparisons: "
                       + ", ".join(named(i) for i in result.tree) + "."])]
    for record in result.passes:
        if record.contradictions:
            reverse = "Reverse loop: " + " ".join(
                f"{named(i)} contradicts the kept chain {_chain(path)} and is marked contradictory; "
                f"heuristic: {', '.join(_judgment(edges[j]) for j in cycle)}."
                for i, cycle, path in record.contradictions)
        else:
            reverse = "Reverse loop: no remaining edge closes a cycle."
        steps = [f"skips {named(i)} (already implied)" for i in record.skipped]
        if record.added is not None:
            steps.append(f"adds {named(record.added)}")
        elif steps:
            steps.append("nothing added")
        forward = "Forward loop: " + ("; ".join(steps) + "." if steps else "no edges left.")
        items.append((f"Pass {record.number}", [reverse, forward]))
    return items


# Pentagon layout in SVG user units; the SVG scales with its container.
# The view box is cropped to the drawing so labels stay legible at 320px.
VIEW_BOX, NODE_HALF = "34 16 312 298", 18
CENTER_X, CENTER_Y, RADIUS = 190.0, 176.0, 132.0


def node_positions() -> dict[str, tuple[float, float]]:
    positions = {}
    for k, node in enumerate(NODES):
        angle = math.radians(-90 + 72 * k)
        positions[node] = (CENTER_X + RADIUS * math.cos(angle), CENTER_Y + RADIUS * math.sin(angle))
    return positions


def _edge_geometry(a: str, b: str) -> tuple[str, float, float]:
    """Path from the alphabetically first node to the second, trimmed to the
    square node borders, plus the label anchor."""
    pos = node_positions()
    (x1, y1), (x2, y2) = pos[a], pos[b]
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    trim = NODE_HALF / max(abs(ux), abs(uy)) + 4
    sx, sy, ex, ey = x1 + ux * trim, y1 + uy * trim, x2 - ux * trim, y2 - uy * trim
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    if abs(NODES.index(a) - NODES.index(b)) in (1, 4):
        # Outer edge: move the label outward, away from the pentagon centre.
        ox, oy = mx - CENTER_X, my - CENTER_Y
        norm = math.hypot(ox, oy)
        mx, my = mx + ox / norm * 15, my + oy / norm * 15
    return f"M{sx:.1f} {sy:.1f} L{ex:.1f} {ey:.1f}", mx, my


def _svg(edges: tuple[tuple[str, str, float], ...], result: SolverResult) -> str:
    markers = ''.join(
        f'<marker id="cs-arrow-{name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" '
        f'markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" class="cs-arrowhead is-{name}"/></marker>'
        for name in ("heuristic", "kept", "contradictory", "implied"))
    lines, labels = [], []
    # Draw emphasised edges last so they sit above crossing diagonals.
    ranking = {"implied": 0, "kept": 1, "contradictory": 2, "heuristic": 3}
    for i in sorted(range(len(edges)), key=lambda j: (ranking[edge_class(result, j)], j)):
        winner, loser, _ = edges[i]
        a, b = sorted((winner, loser), key=NODES.index)
        d, _, _ = _edge_geometry(a, b)
        kind = edge_class(result, i)
        marker = f'marker-end="url(#cs-arrow-{kind})"' if winner == a else f'marker-start="url(#cs-arrow-{kind})"'
        lines.append(f'<g class="cs-edge is-{kind}" data-edge="{i}"><path class="cs-hit" d="{d}"/>'
                     f'<path class="cs-line" d="{d}" {marker}/></g>')
    for i, (winner, loser, weight) in enumerate(edges):
        a, b = sorted((winner, loser), key=NODES.index)
        _, lx, ly = _edge_geometry(a, b)
        kind = edge_class(result, i)
        labels.append(f'<g class="cs-label is-{kind}" data-edge-label="{i}"><rect x="{lx - 18:.1f}" y="{ly - 10.5:.1f}" '
                      f'width="36" height="20" rx="0"/><text x="{lx:.1f}" y="{ly + 5:.1f}">{_fmt(weight)}</text></g>')
    nodes = ''.join(f'<g class="cs-node"><rect x="{x - NODE_HALF:.1f}" y="{y - NODE_HALF:.1f}" width="{2 * NODE_HALF}" '
                    f'height="{2 * NODE_HALF}" rx="0"/><text x="{x:.1f}" y="{y + 6:.1f}">{n}</text></g>'
                    for n, (x, y) in node_positions().items())
    return (f'<svg class="cs-graph" viewBox="{VIEW_BOX}" role="img" '
            f'aria-labelledby="cs-graph-title cs-graph-desc" data-demo-state="cs-graph">'
            f'<title id="cs-graph-title">Preference graph over five responses</title>'
            f'<desc id="cs-graph-desc" data-cs-desc>{escape(_graph_description(edges, result))}</desc>'
            f'<defs>{markers}</defs><g class="cs-lines">{"".join(lines)}</g>'
            f'<g class="cs-labels" aria-hidden="true">{"".join(labels)}</g><g class="cs-nodes" aria-hidden="true">{nodes}</g></svg>')


def _graph_description(edges: tuple[tuple[str, str, float], ...], result: SolverResult) -> str:
    pairs = ", ".join(_judgment(edges[i]) for i in sorted(result.heuristic)) or "none"
    contra = ", ".join(_judgment(edges[i]) for i, s in sorted(result.stage.items()) if s == "contradictory") or "none"
    return f"Arrows point to the less preferred response. DPO pairs: {pairs}. Contradictory: {contra}."


def _edge_rows(edges: tuple[tuple[str, str, float], ...], result: SolverResult) -> str:
    rows = []
    for i, (winner, loser, weight) in enumerate(edges):
        kind = edge_class(result, i)
        judgment = escape(_judgment((winner, loser, weight)))
        pair = f"{min(winner, loser)} and {max(winner, loser)}"
        rows.append(f'''<li class="cs-row is-{kind}" data-edge-row="{i}" data-edge-class="{kind}" data-edge-stage="{result.stage[i]}">
          <span class="cs-swatch" aria-hidden="true"></span>
          <span class="cs-judgment"><button type="button" class="cs-flip" data-demo-action="cs-flip" data-edge="{i}" aria-label="Flip the judgment between {pair}; currently {judgment}" hidden>{judgment}</button><span class="rd-static" data-cs-static="{i}">{judgment}</span></span>
          <span class="cs-weight"><button type="button" data-demo-action="cs-down" data-edge="{i}" aria-label="Lower confidence of {judgment}" hidden>−</button><output data-cs-weight="{i}">{_fmt(weight)}</output><button type="button" data-demo-action="cs-up" data-edge="{i}" aria-label="Raise confidence of {judgment}" hidden>+</button></span>
          <span class="cs-outcome" data-cs-outcome="{i}">{escape(outcome_text(result, i))}</span>
        </li>''')
    return ''.join(rows)


def _dumbbell_rows(rows: list[tuple[str, float, float]], scale: float, decimals: int, unit: str = "%") -> str:
    """Before/after dot rows; positions are percentages of a fixed axis.
    Values keep the precision printed in the source table."""
    out = []
    for label, before, after in rows:
        lo, hi = sorted((before, after))
        out.append(f'''<div class="rd-dumbbell-row"><span class="rd-dumbbell-label">{escape(label)}</span>
          <span class="rd-dumbbell-track" aria-hidden="true"><i class="rd-dumbbell-span" style="left:{lo / scale * 100:.2f}%;width:{(hi - lo) / scale * 100:.2f}%"></i><i class="rd-dot is-before" style="left:{before / scale * 100:.2f}%"></i><i class="rd-dot is-after" style="left:{after / scale * 100:.2f}%"></i></span>
          <span class="rd-dumbbell-values">{before:.{decimals}f}{unit} → {after:.{decimals}f}{unit}</span></div>''')
    return ''.join(out)


def _axis(ticks: list[int], scale: float, unit: str = "%") -> str:
    marks = ''.join(f'<span style="left:{t / scale * 100:.2f}%">{t}{unit}</span>' for t in ticks)
    return f'<div class="rd-dumbbell-row rd-axis-row" aria-hidden="true"><span></span><span class="rd-axis">{marks}</span><span></span></div>'


def _table4() -> str:
    groups = ''.join(
        f'<div class="rd-dumbbell-group"><h5>{escape(model)}</h5>{_dumbbell_rows([(d, b, a) for d, b, a in rows], 35, 2)}</div>'
        for model, rows in TABLE4)
    return f'''<figure class="rd-measured cs-measured">
      <figcaption><span class="rd-small-label">Measured · Table 4</span>
        <h4>How often a prompt’s self-judged preference graph contains a cycle</h4>
        <p>Share of training prompts with at least one contradiction, before and after DPO on ContraSolver-selected pairs. The graph nodes are the same sampled responses used for data construction.</p></figcaption>
      <p class="rd-dumbbell-legend" aria-hidden="true"><span><i class="rd-dot is-before"></i>Without ContraSolver</span><span><i class="rd-dot is-after"></i>With ContraSolver</span></p>
      {groups}{_axis([0, 10, 20, 30], 35)}
      <p class="rd-footnote">Values from <a href="{CS_SOURCE}#S5.T4">Table 4</a>. Cycles decrease on all eight model–dataset pairs but remain in 10.40–26.60% of prompts; the measurement uses training prompts, not new responses.</p>
    </figure>'''


def _contrasolver_demo() -> str:
    edges = DEFAULT_EDGES
    result = solve_contrasolver(edges)
    responses = ''.join(f'<li><span class="cs-letter">{n}</span><span>{escape(text)}</span></li>' for n, text in RESPONSES)
    log = ''.join(f'<li><strong>{escape(label)}</strong> ' + ' '.join(f'<span>{escape(t)}</span>' for t in texts) + '</li>'
                  for label, texts in pass_log_items(edges, result))
    pairs = ", ".join(_judgment(edges[i]) for i in sorted(result.heuristic)) or "none"
    contra = ", ".join(_judgment(edges[i]) for i, s in sorted(result.stage.items()) if s == "contradictory") or "none"
    legend = ''.join(f'<span class="is-{k}"><i aria-hidden="true"></i>{t}</span>' for k, t in (
        ("heuristic", "Heuristic edge: DPO pair"), ("kept", "Kept, not trained"),
        ("contradictory", "Contradictory"), ("implied", "Implied, skipped")))
    return f'''
    <div class="cs-prompt">
      <p class="rd-small-label">One prompt, five sampled continuations · illustrative</p>
      <p class="cs-prompt-text">Continue the movie review positively: “{escape(PROMPT_PREFIX)} …”</p>
      <ol class="cs-responses">{responses}</ol>
      <p class="rd-footnote">The prefix comes from the paper’s case study (<a href="{CS_SOURCE}#A6.T8">Appendix, Table 8</a>); the continuations are written for this demo. The model judges each pair by asking which continuation is more positive (<a href="{CS_SOURCE}#A2.T5">Table 5</a>), averaging over both answer orders. Its confidence is the edge weight. In this example two judgments, D ≻ B and E ≻ C, disagree with the evident order of the texts.</p>
    </div>
    <div class="cs-workspace">
      <div class="cs-figure-column">
        <figure class="cs-figure">{_svg(edges, result)}
          <figcaption class="cs-legend">{legend}<span class="cs-legend-note">Arrow: preferred → less preferred.</span></figcaption>
        </figure>
        <div class="cs-result-region" role="status" aria-live="polite" data-demo-state="status">
          <dl class="cs-result">
            <div class="is-pairs"><dt>DPO pairs · <span data-cs-pair-count>{len(result.heuristic)} of {len(edges)} judgments</span></dt><dd data-cs-pairs>{escape(pairs)}</dd></div>
            <div class="is-contradictions"><dt>Contradictory, not trained</dt><dd data-cs-contradictions>{escape(contra)}</dd></div>
            <div><dt>Resolved order</dt><dd data-cs-order>{escape(" ≻ ".join(result.order))}</dd></div>
          </dl>
        </div>
      </div>
      <div class="cs-edges">
        <p class="cs-edges-head" aria-hidden="true"><span></span><span>Judgment</span><span>Confidence</span><span>Algorithm outcome</span></p>
        <ol class="cs-edge-list" aria-label="Pairwise judgments with illustrative confidences" data-cs-min="{round(CONFIDENCE_MIN * 100)}" data-cs-max="{round(CONFIDENCE_MAX * 100)}" data-cs-step="{round(CONFIDENCE_STEP * 100)}">{_edge_rows(edges, result)}</ol>
        <div class="rd-controls cs-reset" hidden><button type="button" data-demo-action="cs-reset">Restore example</button>
          <span class="rd-control-help">Click a judgment or an arrow to flip it; − and + change its confidence by {CONFIDENCE_STEP:.2f}. Try flipping both disagreeing judgments, or raising E ≻ C above D ≻ E.</span></div>
      </div>
    </div>
    <div class="cs-readout">
      <h4>What the algorithm did</h4>
      <ol class="cs-log" data-demo-state="cs-log">{log}</ol>
    </div>
    <p class="rd-footnote">Confidences are illustrative inputs; the graph computation is the paper’s <a href="{CS_SOURCE}#alg1">Algorithm 1</a> (<a href="{CS_SOURCE}#S3.SS3">Section 3.3</a>), run in your browser. Only heuristic edges become DPO pairs, so kept edges that lie on no cycle, such as the tree edge A ≻ E, are not trained on, and a fully consistent graph contributes no pairs. The resolved order is the kept graph with contradictory edges reversed (Property 2). Every confidence stays above the paper’s filter δ = {DELTA}; equal confidences are ordered by list position, which the paper does not specify. No model is queried or trained.</p>
    {_table4()}'''


# --------------------------------------------------------------------------
# From Atomic to Composite (arXiv 2512.01970v1)
# --------------------------------------------------------------------------

AC_SOURCE = "https://arxiv.org/html/2512.01970v1"

# Figure 1(a): the paper's three task types for one entity.
ATOMIC_TASKS: dict[str, dict[str, object]] = {
    "memory": {
        "label": "Parametric task",
        "kind": "Parametric reasoning: both facts are stored in the model",
        "question": "What is the occupation of the business partner of Amina Khan?",
        "context": [],
        "memory": ["Ben Carter is a business partner with Amina Khan.", "Ben Carter is a Research Analyst."],
        "trace": [("Memory", "Amina Khan", "business partner", "Ben Carter"),
                  ("Memory", "Ben Carter", "occupation", "Research Analyst")],
        "answer": "Research Analyst",
    },
    "context": {
        "label": "Context task",
        "kind": "Contextual reasoning: both facts are in the supplied document",
        "question": "Who is the best friend of Global View’s Chief Editor?",
        "context": ["‘Global View’ magazine announces the appointment of Amina Khan as its editor-in-chief.",
                    "Amina Khan’s best friend is Chloe Davis."],
        "memory": [],
        "trace": [("Context", "Global View", "chief editor", "Amina Khan"),
                  ("Context", "Amina Khan", "best friend", "Chloe Davis")],
        "answer": "Chloe Davis",
    },
    "combined": {
        "label": "Complementary task",
        "kind": "Complementary reasoning: the path crosses from the document into memory",
        "question": "What is the occupation of the business partner of Global View’s new Chief Editor?",
        "context": ["‘Global View’ magazine announces the appointment of Amina Khan as its editor-in-chief."],
        "memory": ["Ben Carter is a business partner with Amina Khan.", "Ben Carter’s job is as a Research Analyst."],
        "trace": [("Context", "Global View", "chief editor", "Amina Khan"),
                  ("Memory", "Amina Khan", "business partner", "Ben Carter"),
                  ("Memory", "Ben Carter", "occupation", "Research Analyst")],
        "answer": "Research Analyst",
    },
}

# Table 1(b): SFT results on the complementary-reasoning test set (measured).
ATOMIC_SPLITS: tuple[tuple[str, str, str, str, float, float], ...] = (
    ("iid", "I.I.D.", "Seen path, new people", "Business_Partner → Occupation", 35.18, 90.30),
    ("composition", "Composition", "Seen relations, new path", "Spouse → Job", 28.20, 76.25),
    ("zero", "Zero-shot", "A relation never asked about in training", "Advisor → Spouse", 24.07, 18.41),
)

# Table 2: error analysis on questions answered incorrectly before and after RL.
ERROR_ANALYSIS: tuple[tuple[str, float, float, float, float], ...] = (
    # preparation, context-hop share before/after RL, first-error position before/after RL
    ("Composite SFT", 90, 86, 54.5, 45.0),
    ("Atomic SFT", 86, 30, 18.5, 71.8),
)


def _atomic_sources(task: dict[str, object], key: str, empty: str) -> str:
    facts = task[key]
    assert isinstance(facts, list)
    return ' '.join(escape(f) for f in facts) if facts else f'<span class="ac-empty">{escape(empty)}</span>'


def _atomic_trace(task: dict[str, object]) -> str:
    trace = task["trace"]
    assert isinstance(trace, list)
    return ''.join(f'<li data-source="{source.lower()}"><span class="ac-source">{source}</span>'
                   f'<span class="ac-hop">{escape(head)} <span class="ac-relation">{escape(rel)}</span> → {escape(tail)}</span></li>'
                   for source, head, rel, tail in trace)


def _atomic_bars() -> str:
    groups = []
    for key, name, meaning, path, atomic, composite in ATOMIC_SPLITS:
        gap = composite - atomic
        leader = "Composite SFT leads" if gap > 0 else "Order reverses: atomic SFT leads"
        groups.append(f'''<div class="ac-split" data-split="{key}">
          <p class="ac-split-head"><strong>{name}</strong> <span>{escape(meaning)}</span> <code>{escape(path)}</code></p>
          <div class="ac-bar-row is-atomic"><span class="ac-bar-label">Atomic SFT</span><span class="ac-bar-track" aria-hidden="true"><i style="width:{atomic:.2f}%"></i></span><strong data-atomic-score="{key}-atomic">{atomic:.2f}</strong></div>
          <div class="ac-bar-row is-composite"><span class="ac-bar-label">Composite SFT</span><span class="ac-bar-track" aria-hidden="true"><i style="width:{composite:.2f}%"></i></span><strong data-atomic-score="{key}-composite">{composite:.2f}</strong></div>
          <p class="ac-gap{' is-reversed' if gap < 0 else ''}" data-atomic-gap="{key}">{leader} by {abs(gap):.2f} points</p>
        </div>''')
    return ''.join(groups)


def _atomic_errors() -> str:
    context_rows = [(name, before, after) for name, before, after, _, _ in ERROR_ANALYSIS]
    position_rows = [(name, before, after) for name, _, _, before, after in ERROR_ANALYSIS]
    return f'''<figure class="rd-measured ac-errors">
      <figcaption><span class="rd-small-label">Measured · Table 2</span>
        <h4>Where do wrong answers first go wrong, before and after composite RL?</h4>
        <p>Error cases that the model answers incorrectly both before and after RL; the first wrong step is found by aligning the generated reasoning with the gold path.</p></figcaption>
      <p class="rd-dumbbell-legend" aria-hidden="true"><span><i class="rd-dot is-before"></i>Before RL</span><span><i class="rd-dot is-after"></i>After RL on composite questions</span></p>
      <div class="rd-dumbbell-group"><h5>First error at a context hop (share of errors)</h5>{_dumbbell_rows(context_rows, 100, 0)}</div>
      <div class="rd-dumbbell-group"><h5>Position of the first error along the path</h5>{_dumbbell_rows(position_rows, 100, 1)}</div>
      {_axis([0, 50, 100], 100)}
      <p class="rd-footnote">Values from <a href="{AC_SOURCE}#S6.T2">Table 2</a> (Section 6.3). After atomic SFT, RL moves most remaining errors to parametric hops late in the path; the paper reports that most occur at the final hop and hypothesizes that final relations are sparse in the training data. After composite SFT the pattern barely changes. Position is the first wrong step’s place in the path, normalized from start (0%) to end (100%) and averaged over error cases.</p>
    </figure>'''


def _atomic_demo() -> str:
    task = ATOMIC_TASKS["combined"]
    buttons = ''.join(f'<button type="button" data-demo-action="atomic-task" data-task="{key}" '
                      f'aria-pressed="{str(key == "combined").lower()}">{escape(str(item["label"]))}</button>'
                      for key, item in ATOMIC_TASKS.items())
    return f'''
    <div class="rd-controls" hidden>
      <fieldset class="rd-choice-group"><legend>Task type in Figure 1(a)</legend>{buttons}</fieldset>
    </div>
    <div class="ac-task" data-demo-state="atomic-task" data-task="combined">
      <p class="rd-small-label" data-atomic-kind>{escape(str(task["kind"]))}</p>
      <p class="ac-question" data-atomic-question>{escape(str(task["question"]))}</p>
      <div class="ac-sources">
        <div><h5>Supplied document</h5><p data-atomic-context>{_atomic_sources(task, "context", "None: the question is asked directly.")}</p></div>
        <div><h5>Stored in the model’s parameters</h5><p data-atomic-memory>{_atomic_sources(task, "memory", "Not needed for this question.")}</p></div>
      </div>
      <h5 class="ac-trace-title">Required path</h5>
      <ol class="ac-trace" data-atomic-trace>{_atomic_trace(task)}</ol>
      <p class="ac-answer"><span>Answer</span> <strong data-atomic-answer>{escape(str(task["answer"]))}</strong></p>
    </div>
    <p class="rd-status" role="status" aria-live="polite" data-demo-state="status" data-atomic-status>Three hops: the document supplies the first, parametric memory the other two.</p>
    <p class="rd-footnote">Questions, facts and answers from <a href="{AC_SOURCE}#S1.F1">Figure 1(a)</a>; hop labels follow the paper’s split into parametric (Mem) and contextual (Ctx) relations. This is the paper’s worked example, not a model output.</p>
    <figure class="rd-measured ac-results">
      <figcaption><span class="rd-small-label">Measured · Table 1<span class="rd-keep-case">(b)</span></span>
        <h4>SFT alone: accuracy on complementary questions, by what is new at test time</h4>
        <p>Atomic SFT trains on parametric and contextual questions separately (88,031 + 2,651); composite SFT trains on complementary questions directly (180,919). Training-set sizes from Table 1(a).</p></figcaption>
      <p class="ac-legend" aria-hidden="true"><span class="is-atomic"><i></i>Atomic SFT (Mem + Ctx)</span><span class="is-composite"><i></i>Composite SFT (Comp)</span></p>
      {_atomic_bars()}
      <p class="rd-footnote">Exact-match accuracy (%), Qwen2.5-1.5B, from <a href="{AC_SOURCE}#S4.T1">Table 1(b)</a>; bars span 0–100 and gaps are differences of the table values. Example paths from <a href="{AC_SOURCE}#S1.F1">Figure 1(b)</a>. Composite SFT’s advantage disappears only when a relation is absent from training questions. What RL adds to each preparation is measured in <a href="{AC_SOURCE}#S5.F3">Figure 3</a> and the results table below.</p>
    </figure>
    {_atomic_errors()}'''


def render_demo(slug: str, insight: dict) -> str:
    """Render an accessible static example; JavaScript reveals optional controls."""
    if slug not in {"atomic-to-composite", "contrasolver"}:
        return ""
    demo = insight.get("demo", {})
    kind = demo.get("kind")
    renderers = {
        "atomic-trace": _atomic_demo,
        "preference-graph": _contrasolver_demo,
    }
    renderer = renderers.get(kind)
    if renderer is None:
        return ""
    safe_slug = escape(slug, quote=True)
    title = escape(demo.get("title", "Explore the mechanism"))
    caption = escape(demo.get("caption", "Illustrative example."))
    return f'''<section class="reasoning-demo" data-paper-demo="{safe_slug}" data-reasoning-demo="{escape(kind, quote=True)}" aria-labelledby="{safe_slug}-demo-title">
      <header class="rd-heading"><p class="rd-small-label rd-eyebrow">{escape(demo.get("eyebrow", "Explore the mechanism"))}</p><h3 id="{safe_slug}-demo-title">{title}</h3><p>{caption}</p></header>
      {renderer()}
    </section>'''
