"""Monte Carlo tree search demo for DAMON (EMNLP 2025, 2025.emnlp-main.323).

The demo animates the paper's search procedure (Section 3, Algorithm 1) on an
ABSTRACT tree. Nodes are labelled only as dialogue states ("Initial request
state", "Sub-question k state") and by the paper's three decomposition strategy
names. No harmful request, sub-question, or response content appears anywhere.

Rewards at the leaves are ILLUSTRATIVE judge scores in [1, 5] that the reader can
adjust; the UCT values, visit counts and mean scores are computed live with the
paper's formulas (eq. 4 for selection, eq. 5 for backpropagation, omega = 1). The
page is complete without JavaScript: the initial tree and its statistics are
rendered here.
"""
from __future__ import annotations

import json
import math
from html import escape

SOURCE = "https://aclanthology.org/2025.emnlp-main.323/"
OMEGA = 1.0          # Appendix B.2: the exploration constant omega is set to 1.
INIT_Q = 1.0         # Node value initialised to 1 (DAMON reference implementation).
THRESHOLD = 5        # Early-exit score: the GPT-4o judge's maximum harm rating.

# Strategy short/long names from Section 3.2, and the default illustrative
# per-leaf judge scores. Content is abstract: only strategy names and state ids.
STRATEGIES = [
    {"id": "s0", "short": "Progressive", "name": "Progressive inquiry", "rewards": [3, 4]},
    {"id": "s1", "short": "Step-by-step", "name": "Step-by-step questioning", "rewards": [4, 3]},
    {"id": "s2", "short": "Story-driven", "name": "Story-driven imagination", "rewards": [2, 2]},
]

REWARD_MIN, REWARD_MAX = 1, 5

# Fixed SVG layout (user units); the SVG scales with its container.
VIEW_W, VIEW_H = 720.0, 320.0
ROOT_XY = (360.0, 40.0)
STRAT_Y = 148.0
LEAF_Y = 262.0
STRAT_X = {"s0": 150.0, "s1": 360.0, "s2": 570.0}
LEAF_DX = 52.0
NODE_W, NODE_H = 150.0, 44.0
LEAF_W, LEAF_H = 98.0, 44.0


def _node_box(cx: float, cy: float, w: float, h: float) -> tuple[float, float]:
    return cx - w / 2, cy - h / 2


def _edge(x1: float, y1: float, x2: float, y2: float, cls: str, key: str) -> str:
    return f'<line class="sf-edge {cls}" data-edge="{key}" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>'


def _node_svg(key: str, cx: float, cy: float, w: float, h: float, cls: str, title: str, stat: str) -> str:
    x, y = _node_box(cx, cy, w, h)
    return (f'<g class="sf-node {cls}" data-node="{key}">'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"/>'
            f'<text class="sf-node-title" x="{cx:.1f}" y="{cy - 3:.1f}">{escape(title)}</text>'
            f'<text class="sf-node-stat" x="{cx:.1f}" y="{cy + 13:.1f}" data-sf-stat="{key}">{escape(stat)}</text></g>')


def _leaf_center(strategy_id: str, index: int) -> tuple[float, float]:
    base = STRAT_X[strategy_id]
    return base + (index * 2 - 1) * LEAF_DX, LEAF_Y


def _tree_svg() -> str:
    edges, nodes = [], []
    rx, ry = ROOT_XY
    for strat in STRATEGIES:
        sx = STRAT_X[strat["id"]]
        edges.append(_edge(rx, ry + NODE_H / 2, sx, STRAT_Y - NODE_H / 2, "is-strategy-edge", f"root-{strat['id']}"))
        for i in range(2):
            lx, ly = _leaf_center(strat["id"], i)
            edges.append(_edge(sx, STRAT_Y + NODE_H / 2, lx, ly - LEAF_H / 2, "is-leaf-edge", f"{strat['id']}-{i}"))
    nodes.append(_node_svg("root", rx, ry, NODE_W, NODE_H, "is-root", "Initial request state", f"Q 1.00 · N 0"))
    for strat in STRATEGIES:
        sx = STRAT_X[strat["id"]]
        nodes.append(_node_svg(strat["id"], sx, STRAT_Y, NODE_W, NODE_H, "is-strategy",
                               strat["short"], "Q 1.00 · N 0"))
        for i in range(2):
            lx, ly = _leaf_center(strat["id"], i)
            key = f"{strat['id']}-{i}"
            nodes.append(_node_svg(key, lx, ly, LEAF_W, LEAF_H, "is-leaf",
                                   f"Sub-question {i + 1}", f"score {strat['rewards'][i]} · N 0"))
    # Action labels on the root edges (the decomposition strategy applied).
    labels = []
    for strat in STRATEGIES:
        sx = STRAT_X[strat["id"]]
        mx, my = (rx + sx) / 2, (ry + NODE_H / 2 + STRAT_Y - NODE_H / 2) / 2
        labels.append(f'<text class="sf-edge-label" x="{mx:.1f}" y="{my:.1f}">{escape(strat["short"])}</text>')
    return (f'<svg class="sf-tree" viewBox="0 0 {VIEW_W:g} {VIEW_H:g}" role="img" '
            f'aria-labelledby="sf-tree-title sf-tree-desc" data-demo-state="sf-tree">'
            f'<title id="sf-tree-title">Monte Carlo search tree over decomposition strategies</title>'
            f'<desc id="sf-tree-desc" data-sf-desc>Root initial request state with three strategy branches, each holding two sub-question states. All visit counts start at zero.</desc>'
            f'<g class="sf-edges">{"".join(edges)}</g><g class="sf-edge-labels" aria-hidden="true">{"".join(labels)}</g>'
            f'<g class="sf-nodes">{"".join(nodes)}</g></svg>')


def _reward_controls() -> str:
    rows = []
    for strat in STRATEGIES:
        for i in range(2):
            value = strat["rewards"][i]
            rows.append(
                f'<div class="sf-reward-row" data-reward-row="{strat["id"]}-{i}">'
                f'<span class="sf-reward-label">{escape(strat["short"])} · Sub-question {i + 1}</span>'
                f'<span class="sf-reward-stepper">'
                f'<button type="button" data-demo-action="sf-down" data-leaf="{strat["id"]}-{i}" aria-label="Lower the illustrative judge score for {escape(strat["short"])} sub-question {i + 1}" hidden>−</button>'
                f'<output data-sf-reward="{strat["id"]}-{i}">{value}</output>'
                f'<button type="button" data-demo-action="sf-up" data-leaf="{strat["id"]}-{i}" aria-label="Raise the illustrative judge score for {escape(strat["short"])} sub-question {i + 1}" hidden>+</button>'
                f'</span></div>')
    return "".join(rows)


def _prune_controls() -> str:
    rows = []
    for strat in STRATEGIES:
        rows.append(
            f'<label class="sf-prune"><input type="checkbox" data-demo-action="sf-prune" data-strategy="{strat["id"]}"> '
            f'Prune {escape(strat["name"])}</label>')
    return "".join(rows)


def _config() -> str:
    return json.dumps({
        "strategies": STRATEGIES, "omega": OMEGA, "initQ": INIT_Q, "threshold": THRESHOLD,
        "rewardMin": REWARD_MIN, "rewardMax": REWARD_MAX}, separators=(",", ":"))


def render_demo(slug: str, insight: dict) -> str:
    if slug != "damon":
        return ""
    demo = insight.get("demo", {})
    eyebrow = escape(demo.get("eyebrow", "Algorithm 1 · illustrative judge scores"))
    title = escape(demo.get("title", "Run the search one iteration at a time"))
    caption = escape(demo.get("caption", "Abstract tree; rewards illustrative; UCT and visit counts computed live."))
    return f'''<section class="safety-demo" data-paper-demo="{escape(slug, quote=True)}" data-safety-demo="mcts" data-safety-config="{escape(_config(), quote=True)}" aria-labelledby="{escape(slug, quote=True)}-safety-title">
      <header class="sf-heading"><p class="sf-small-label sf-eyebrow">{eyebrow}</p>
        <h3 id="{escape(slug, quote=True)}-safety-title">{title}</h3><p>{caption}</p></header>
      <div class="sf-workspace">
        <figure class="sf-figure">
          <div class="sf-tree-scroll" tabindex="0" role="region" aria-label="Search tree; scroll sideways on narrow screens">{_tree_svg()}</div>
          <figcaption class="sf-legend"><span class="sf-key is-selected"><i></i>Selection path</span><span class="sf-key is-expanded"><i></i>Expanded this iteration</span><span class="sf-key is-pruned"><i></i>Pruned branch</span></figcaption>
          <div class="sf-play rd-controls" hidden>
            <button type="button" data-demo-action="sf-play" aria-pressed="false">Play</button>
            <button type="button" data-demo-action="sf-step">Step</button>
            <button type="button" data-demo-action="sf-reset">Reset</button>
            <span class="sf-iter-status" role="status" aria-live="polite" data-sf-iter>Iteration 0 · press Step to run one MCTS iteration</span>
          </div>
        </figure>
        <div class="sf-readout">
          <h4>What one iteration does</h4>
          <ol class="sf-stages" data-demo-state="sf-stages">
            <li><strong>Selection</strong> <span data-sf-stage="selection">Descend from the root by maximum UCT value (eq. 4).</span></li>
            <li><strong>Expansion</strong> <span data-sf-stage="expansion">Decompose the selected state with the strategies.</span></li>
            <li><strong>Simulation</strong> <span data-sf-stage="simulation">Read the illustrative judge score at the reached leaf.</span></li>
            <li><strong>Backpropagation</strong> <span data-sf-stage="backprop">Update mean score Q and visit count N up the path (eq. 5).</span></li>
          </ol>
          <p class="sf-summary" data-sf-summary>No iterations run yet. Each strategy starts at Q 1.00, N 0; leaf scores are illustrative.</p>
        </div>
      </div>
      <div class="sf-controls" hidden>
        <div class="sf-control-block">
          <h5 class="sf-small-label">Illustrative leaf judge scores (1–5)</h5>
          <div class="sf-rewards">{_reward_controls()}</div>
        </div>
        <div class="sf-control-block">
          <h5 class="sf-small-label">Refusal pruning</h5>
          <div class="sf-prunes">{_prune_controls()}</div>
          <p class="sf-prune-help">DAMON prunes a state once no sub-instruction still needs decomposing; here you can exclude a whole branch from the search.</p>
        </div>
      </div>
      <p class="sf-note"><strong>Responsible use.</strong> This is a schematic of the search procedure only. Every label is an abstract dialogue state or a strategy name; no harmful request, sub-question, or response text is shown or generated.</p>
      <p class="sf-footnote">Selection uses the paper’s UCT rule (<a href="{SOURCE}">eq. 4</a>): a child’s score is its mean reward Q plus ω·√(ln N(parent) / N(child)), with ω = 1; an unvisited child is taken first. Backpropagation uses eq. 5: Q ← (Q·N + score)/(N + 1) and N ← N + 1 along the path, with the same leaf score. A leaf score of {THRESHOLD} meets the early-exit threshold τ. Because the exploration term grows as a branch is left unvisited, the search returns to a less-visited branch even when another branch has a higher mean reward; raising a leaf’s score changes which decomposition path is pursued. Rewards are illustrative inputs to the paper’s formulas, computed in your browser; no model is queried.</p>
    </section>'''
