"""Static, progressively enhanced demos for DERL and ChemAgent.

Both demos sit in "Inside the method" and render a complete, readable state
without JavaScript; papers/demos/agents.js adds reader-started Play / Pause /
Step / Reset replays. Every printed string comes from the paper; values that
the paper does not print are computed here (and identically in the browser)
and labelled as computed.

DERL (arXiv 2512.13399v1): the eight Meta-Rewards that the Meta-Optimizer
sampled at each of four outer-loop steps on ALFWorld L2, with their published
validation scores (Appendix E, Table 4). The page parses each printed
expression, scores a reader-edited six-step trajectory with it (the
primitives follow the Section 4.2 example), and computes the GRPO group
advantage that the outer update uses.

ChemAgent (arXiv 2501.06590v1): the worked example of Figure 2, panels (a)
library-enhanced reasoning and (b) library construction, with memory
examples quoted from Figure 3 and the physics of both problems computed.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from html import escape

# --------------------------------------------------------------------------
# Shared markup
# --------------------------------------------------------------------------


def _e(value: object) -> str:
    return escape(str(value), quote=True)


def _player(prefix: str, label: str) -> str:
    """Reader-started replay controls, hidden until the script attaches them."""
    return (f'<div class="ag-controls ag-player" role="group" aria-label="{_e(label)}" hidden>'
            f'<button type="button" data-demo-action="{prefix}-play" aria-pressed="false">Play</button>'
            f'<button type="button" data-demo-action="{prefix}-pause" disabled>Pause</button>'
            f'<button type="button" data-demo-action="{prefix}-step">Step</button>'
            f'<button type="button" data-demo-action="{prefix}-reset">Reset</button></div>'
            f'<p class="ag-player-status" role="status" aria-live="polite" data-player-status="{prefix}" hidden></p>')


def _choice(action: str, legend: str, options: list[tuple[str, str]], pressed: str, attribute: str) -> str:
    buttons = ''.join(f'<button type="button" data-demo-action="{action}" data-{attribute}="{_e(value)}" '
                      f'aria-pressed="{str(value == pressed).lower()}">{_e(label)}</button>'
                      for value, label in options)
    return f'<fieldset class="ag-choice"><legend>{_e(legend)}</legend>{buttons}</fieldset>'


def _section(slug: str, kind: str, demo: dict, body: str) -> str:
    """Demo block: eyebrow naming the evidence, Georgia h3, caption, body."""
    heading_id = f'{_e(slug)}-demo-title'
    return f'''<section class="agents-demo" data-paper-demo="{_e(slug)}" data-agents-demo="{_e(kind)}" aria-labelledby="{heading_id}">
      <header class="ag-heading"><p class="ag-small-label ag-eyebrow">{_e(demo.get("eyebrow", "Published example"))}</p><h3 id="{heading_id}">{_e(demo.get("title", "Explore the mechanism"))}</h3><p>{_e(demo.get("caption", ""))}</p></header>
      {body}
    </section>'''


def round_half_up(value: float, digits: int) -> float:
    """Round half away from zero; the browser uses the same arithmetic."""
    scale = 10 ** digits
    return math.copysign(math.floor(abs(value) * scale + 0.5) / scale, value)


def fixed(value: float, digits: int, signed: bool = False) -> str:
    """Fixed decimals with a typographic minus, e.g. −1.583 or +0.97."""
    rounded = round_half_up(value, digits)
    if rounded == 0:
        rounded = 0.0  # no "−0.000"
    text = f'{abs(rounded):.{digits}f}'
    if rounded < 0:
        return '−' + text
    return ('+' + text) if signed and rounded > 0 else text


# --------------------------------------------------------------------------
# DERL (arXiv 2512.13399v1)
# --------------------------------------------------------------------------

DERL_SOURCE = "https://arxiv.org/html/2512.13399v1"
CUT = " ⋯"  # The paper prints long expressions cut off with \cdots.

# Section 4.2: "given a six-step interaction with a step-wise reward sequence of
# [1,0,1,1,0,0], the atomic primitives corresponding to the three temporal
# segments yield values of 0.5, 1, and 0". The outcome is not given there.
STEP_EXAMPLE: tuple[int, ...] = (1, 0, 1, 1, 0, 0)

# Appendix E, Table 4: Meta-Rewards and their reward (validation score) at
# outer-loop steps 0-3 on ALFWorld (L2), eight rollouts each, as printed.
OUTER_STEPS: tuple[tuple[tuple[str, float], ...], ...] = (
    (("g1 * (g2 - 1) / 2 + (g3 + 1) * (g4 - 1) * 2 / 3", 0.0),
     ("g1 + 0.5 * (g2 + 0.5 * (g3 + 0.5 * (g4)))) - 0.5 * (g2 + 0.5 * (g3 +" + CUT, 0.0),
     ("g1 + 0.01 * (g2 - 0.001) + 0.0001 * (g3 - 0.0001) + 0.000005 * (g4 -" + CUT, 0.8496),
     ("g1 * 0.5 + 0.2 * (g2 + 0.1) - 0.3 / 2 + 0.4 * (g3 * 0.1) + 0.1 * (g4 *" + CUT, 0.8789),
     ("g1 * (g2 + (g3 - 1.0) * (g4 - 0.0))", 0.0234),
     ("g1 + 0.5 * (g2 + 0.5 * (g3 + 0.5 * (g4 + 0.5)))", 0.8848),
     ("g1 + 0.5 * (g2 + 0.2 * (g3 + 0.1 * (g4 + 0.05))))", 0.0),
     ("g1 * (g2 + 2 * (g3 / 3)) + (g4 - 4 * (g2 - 1)) - 2.0", 0.8945)),
    (("(0.5 * (g1 - 0.1)) + (0.5 * (g2 - 0.1)) + (0.5 * (g3 - 0.1)) + (0.5 *" + CUT, 0.7793),
     ("g1 * (g2 + (g3 * (g4 - (g2 + (g3 * (g4 - (g3 * (g4 - (g3 * (g4 - (g3 *" + CUT, 0.0),
     ("- (g1 + 0.5 * (g2 + 0.3 * (g3 - 0.2 * (g4 + 0.1 * 1))) + 0.1 * 1) / 1.2", 0.0020),
     ("g1 * (g2 - 1) * (1 - 0.5) + 0.5 ** 2 * (g3 - 1) * (1 - 0.25) + 0.25 **" + CUT, 0.0),
     ("g1 + (g2 * (g3 / 2)) - (g4 / 3)", 0.8594),
     ("g1 * (g2 + 0.5) + 0.2 * (g3 * 0.3 + 0.1) - 0.1 * (g4 * 0.2 + 0.5)", 0.8477),
     ("g1 + 2 * (g2 + 3 * (g3 - 2)) * 0.1 + 4 * 0.3 - 5 * (g4 + 1)", 0.8984),
     ("g1 * (g2 - 1) / 2 + (g3 - 1) / 3 + (g4 - 1) / 4 + 3.0", 0.0098)),
    (("g1 + 0.5 * (g2 + 0.5 * (g3 + 0.5 * (g4))))", 0.0),
     ("g1 + 0.5 * (g2 - 0.5) + 0.3 * (g3 - 0.05) + 0.2 * (g4 + 0.05) - 0.2 *" + CUT, 0.0),
     ("g1 + (g2 * (g3 / 2)) - (g4 / 4)", 0.8438),
     ("g1 + 0.5 * (g2 + 0.5 * (g3 + 0.5 * (g4 - 1))))", 0.0),
     ("g1 + 0.01 + 0.0001 * (g2) + 0.000001 * (g3) + 0.00000001 * (g4)", 0.8652),
     ("g1 * (g2 + (g3 * (g4 / 2))) + (g1 - (g2 + (g3 * (g4 / 2)))) * 0.5", 0.8867),
     ("g1 * 0.99 + 0.01 * (g2 + 0.99) + 0.005 * (g3 + 0.99) + 0.0005 * (g4 +" + CUT, 0.8477),
     ("g1 + 0.5 * (g2 - 0.5) + 0.2 * (g3 - 0.5) + 0.1 * (g4 - 0.5)", 0.8906)),
    (("g1 + (g2 / 2.0) - (g3 * 0.1) + (g4 * 0.05)", 0.8438),
     ("g1 + 0.5 * (g2 + 0.5 * (g3 + 0.5 * (g4 + 0.5)))", 0.875),
     ("g1 + 0.05 * (g2 + 0.05 * (g3 + 0.05 * (g4 + 0.05)))", 0.8242),
     ("g1 + 0.5 * (g2 / 2.0) + 0.1 * (g3 * 2.0) + 0.25 * (g4 / 4.0)", 0.8632),
     ("g1 + 0.5 * (g2 + 0.4 * (g3 + 0.2 * (g4 + 0.1)))", 0.8496),
     ("g1 + 0.5 * (g2 + 0.5 * (g3 + 0.5 * (g4 + 0.5)))", 0.8926),
     ("g1 + 0.5 * (g2 + 0.5 * (g3 + 0.5 * (g4 + 0.5)))", 0.8789),
     ("g1 + (g2 * (g3 / 2)) - (g4 / 3)", 0.8984)),
)

# Compositions named in the paper: the two GRPO baselines (Section 4.1) and the
# example structures of Section 5.2. The paper prints no scores for these.
REFERENCE_REWARDS: tuple[tuple[str, str], ...] = (
    ("Outcome reward (baseline)", "g1"),
    ("Avg reward (baseline)", "(g1 + g2 + g3 + g4) / 4"),
    ("Stable, linear (Section 5.2)", "0.5 * g1 + 0.8 * g2"),
    ("Stable, normalized (Section 5.2)", "g1 / (g2 + 1)"),
    ("Unstable product (Section 5.2)", "g1 * (g2 + 0.2) * g3"),
    ("Invalid, negative (Section 5.2)", "-(g1 + 0.5 * g2)"),
)

_TOKEN = re.compile(r'\s*(?:(\d+\.\d*|\.\d+|\d+)|(g[1-4])|(\*\*|[-+*/()]))')


class RewardSyntaxError(ValueError):
    """The printed expression cannot be executed (the paper scores these v = 0)."""


def tokenize(text: str) -> list[str]:
    tokens, position = [], 0
    while position < len(text):
        if text[position:].strip() == '':
            break
        match = _TOKEN.match(text, position)
        if not match:
            raise RewardSyntaxError('unexpected character')
        tokens.append(match.group(match.lastindex))
        position = match.end()
    return tokens


def parse_reward(text: str) -> tuple:
    """Recursive-descent parser with Python's precedence (** binds tighter than
    unary minus and is right-associative). Returns a nested-tuple tree."""
    tokens = tokenize(text)
    position = 0

    def peek() -> str | None:
        return tokens[position] if position < len(tokens) else None

    def take() -> str:
        nonlocal position
        token = peek()
        if token is None:
            raise RewardSyntaxError('expression ends early')
        position += 1
        return token

    def expression() -> tuple:
        node = term()
        while peek() in ('+', '-'):
            node = ('bin', take(), node, term())
        return node

    def term() -> tuple:
        node = factor()
        while peek() in ('*', '/'):
            node = ('bin', take(), node, factor())
        return node

    def factor() -> tuple:
        if peek() in ('+', '-'):
            sign = take()
            return ('neg', factor()) if sign == '-' else factor()
        return power()

    def power() -> tuple:
        node = atom()
        if peek() == '**':
            take()
            node = ('bin', '**', node, factor())
        return node

    def atom() -> tuple:
        token = take()
        if token == '(':
            node = expression()
            if take() != ')':
                raise RewardSyntaxError('unclosed parenthesis')
            return node
        if re.fullmatch(r'g[1-4]', token):
            return ('var', int(token[1]) - 1)
        if re.fullmatch(r'\d+\.\d*|\.\d+|\d+', token):
            return ('num', float(token))
        if token == ')':
            raise RewardSyntaxError('extra closing parenthesis')
        raise RewardSyntaxError('unexpected operator')

    tree = expression()
    if peek() == ')':
        raise RewardSyntaxError('extra closing parenthesis')
    if peek() is not None:
        raise RewardSyntaxError('unexpected token')
    return tree


def evaluate(tree: tuple, g: tuple[float, ...]) -> float | None:
    """Execute a parsed reward on primitive values; None if it divides by zero."""
    kind = tree[0]
    if kind == 'num':
        return tree[1]
    if kind == 'var':
        return g[tree[1]]
    if kind == 'neg':
        inner = evaluate(tree[1], g)
        return None if inner is None else -inner
    _, op, left, right = tree
    a, b = evaluate(left, g), evaluate(right, g)
    if a is None or b is None:
        return None
    if op == '+':
        return a + b
    if op == '-':
        return a - b
    if op == '*':
        return a * b
    if op == '/':
        return None if b == 0 else a / b
    try:
        result = a ** b
    except (OverflowError, ZeroDivisionError):
        return None
    # A negative base with a fractional exponent has no real value (JS: NaN).
    return result if isinstance(result, float) and math.isfinite(result) else None


@dataclass
class Check:
    status: str  # "valid", "malformed" or "truncated"
    label: str
    tree: tuple | None


def check_reward(text: str) -> Check:
    """Classify a printed Meta-Reward. A cut expression is still malformed if a
    closing parenthesis has no partner before the cut."""
    if text.endswith(CUT):
        depth = 0
        for token in tokenize(text[:-len(CUT)]):
            depth += {'(': 1, ')': -1}.get(token, 0)
            if depth < 0:
                return Check('malformed', 'Fails to parse: extra “)” before the cut', None)
        return Check('truncated', 'Printed truncated; not evaluated', None)
    try:
        return Check('valid', 'Valid', parse_reward(text))
    except RewardSyntaxError as error:
        return Check('malformed', f'Fails to parse: {error}', None)


def primitives(steps: tuple[int, ...], outcome: int) -> tuple[float, float, float, float]:
    """g1 = binary outcome; g2-g4 = mean step reward over the first, middle and
    last third of the trajectory (Section 4.2; order as introduced there)."""
    third = len(steps) // 3
    means = [sum(steps[k * third:(k + 1) * third]) / third for k in range(3)]
    return (float(outcome), means[0], means[1], means[2])


def advantages(scores: list[float]) -> tuple[float, float, list[float]]:
    """GRPO group advantage (v - mean) / std over one step's rollouts. std is the
    sample estimate (n - 1); the paper does not say which, and the choice
    rescales every advantage equally without changing signs or order."""
    n = len(scores)
    mean = sum(scores) / n
    std = math.sqrt(sum((v - mean) * (v - mean) for v in scores) / (n - 1))
    return mean, std, [(v - mean) / std if std else 0.0 for v in scores]


def _reward_cell(value: float | None) -> str:
    return '—' if value is None else fixed(value, 3)


def _rollout_rows(step: int, steps: tuple[int, ...]) -> str:
    rows = OUTER_STEPS[step]
    _, _, adv = advantages([v for _, v in rows])
    success, failure = primitives(steps, 1), primitives(steps, 0)
    scale = 2.0  # advantage axis spans -2..+2
    out = []
    for k, ((text, score), a) in enumerate(zip(rows, adv)):
        check = check_reward(text)
        r_s = evaluate(check.tree, success) if check.tree else None
        r_f = evaluate(check.tree, failure) if check.tree else None
        veto = r_s is not None and r_f is not None and r_s <= r_f
        width = min(abs(a), scale) / scale * 50
        bar = f'left:50%;width:{width:.2f}%' if a >= 0 else f'right:50%;width:{width:.2f}%'
        out.append(
            f'<tr class="dl-row is-{check.status}{" is-veto" if veto else ""}" data-rollout="{k}">'
            f'<td class="dl-index">{k + 1}</td>'
            f'<td class="dl-expr" data-stage="1"><code class="dl-v" data-dl-expr>{_e(text)}</code></td>'
            f'<td class="dl-check" data-stage="1" data-label="Check"><span class="dl-v" data-dl-check>{_e(check.label)}</span></td>'
            f'<td class="num" data-stage="2" data-label="R, success"><span class="dl-v" data-dl-success>{_reward_cell(r_s)}</span></td>'
            f'<td class="num" data-stage="2" data-label="R, failure"><span class="dl-v" data-dl-failure>{_reward_cell(r_f)}</span></td>'
            f'<td class="num" data-stage="3" data-label="v"><span class="dl-v" data-dl-v>{score:.4f}</span></td>'
            f'<td class="dl-adv" data-stage="4" data-label="Advantage"><span class="dl-v"><span class="dl-adv-track" aria-hidden="true"><i class="{"is-up" if a >= 0 else "is-down"}" style="{bar}"></i></span>'
            f'<span class="dl-adv-value" data-dl-adv>{fixed(a, 2, signed=True)}</span></span></td></tr>')
    return ''.join(out)


def derl_summary(step: int, steps: tuple[int, ...]) -> str:
    """One-sentence account of an outer step; mirrored exactly in JS."""
    rows = OUTER_STEPS[step]
    checks = [check_reward(text) for text, _ in rows]
    counts = {status: sum(c.status == status for c in checks) for status in ('valid', 'malformed', 'truncated')}
    mean, std, _ = advantages([v for _, v in rows])
    success, failure = primitives(steps, 1), primitives(steps, 0)
    vetoes = [k + 1 for k, c in enumerate(checks) if c.tree is not None
              and evaluate(c.tree, success) is not None and evaluate(c.tree, failure) is not None
              and evaluate(c.tree, success) <= evaluate(c.tree, failure)]
    parts = [f'{counts["valid"]} valid', f'{counts["malformed"]} fail to parse', f'{counts["truncated"]} printed truncated']
    veto_text = (f'row{"s" if len(vetoes) > 1 else ""} {", ".join(map(str, vetoes))} pay{"" if len(vetoes) > 1 else "s"} a success no more than a failure'
                 if vetoes else 'every valid reward pays a success more than a failure')
    return (f'Outer step {step}: {", ".join(p for p in parts if not p.startswith("0 "))}. '
            f'Mean v {fixed(mean, 3)}, std {fixed(std, 3)}. On this trajectory, {veto_text}.')


def _reference_rows(steps: tuple[int, ...]) -> str:
    success, failure = primitives(steps, 1), primitives(steps, 0)
    out = []
    for k, (name, text) in enumerate(REFERENCE_REWARDS):
        tree = parse_reward(text)
        r_s, r_f = evaluate(tree, success), evaluate(tree, failure)
        veto = r_s is not None and r_f is not None and r_s <= r_f
        out.append(f'<tr class="dl-row{" is-veto" if veto else ""}" data-reference="{k}"><th scope="row">{_e(name)}</th>'
                   f'<td class="dl-expr"><code data-dl-expr>{_e(text)}</code></td>'
                   f'<td class="num" data-label="R, success" data-dl-success>{_reward_cell(r_s)}</td>'
                   f'<td class="num" data-label="R, failure" data-dl-failure>{_reward_cell(r_f)}</td></tr>')
    return ''.join(out)


def _trajectory(steps: tuple[int, ...]) -> str:
    g = primitives(steps, 1)
    thirds = []
    for t, name in enumerate(("first", "middle", "last")):
        cells = ''.join(
            f'<span class="dl-cell"><button type="button" data-demo-action="derl-step" data-step="{k}" aria-pressed="{str(bool(steps[k])).lower()}" '
            f'aria-label="Interaction step {k + 1} reward" hidden>{steps[k]}</button><span class="ag-static" data-dl-static="{k}">{steps[k]}</span></span>'
            for k in (2 * t, 2 * t + 1))
        thirds.append(f'<div class="dl-third"><div class="dl-cells">{cells}</div>'
                      f'<p>g{t + 2}, {name} third: <strong data-dl-g="{t + 1}">{fixed(g[t + 1], 2)}</strong></p></div>')
    return f'''<div class="dl-trajectory" data-demo-state="derl-trajectory">
      <p class="ag-small-label">The trajectory the R columns score · step rewards illustrative, default from Section 4.2</p>
      <div class="dl-thirds">{"".join(thirds)}<div class="dl-third dl-outcome"><p>g2–g4 are the mean step reward of each third. g1 is the binary outcome: every Meta-Reward is scored twice, with g1 = 1 (success) and with g1 = 0 (failure).</p></div></div>
      <div class="ag-controls dl-trajectory-controls" hidden><button type="button" data-demo-action="derl-steps-reset">Restore [1, 0, 1, 1, 0, 0]</button>
        <span class="ag-help">Click a step to switch its reward between 0 and 1. Try clearing steps 1 and 2, then steps 3 and 4.</span></div>
    </div>'''


def _derl_demo() -> str:
    step, steps = 0, STEP_EXAMPLE
    mean_values = [advantages([v for _, v in rows])[0] for rows in OUTER_STEPS]
    means = ' · '.join(f'<span data-dl-mean="{k}"{' class="is-current"' if k == step else ''}>step {k}: {fixed(m, 3)}</span>'
                       for k, m in enumerate(mean_values))
    steps_json = _e(json.dumps([[list(row) for row in rows] for rows in OUTER_STEPS], ensure_ascii=False))
    loop = ''.join(f'<li data-loop-stage="{k}"><span class="dl-loop-index">{k}</span><strong>{_e(title)}</strong><span>{_e(text)}</span></li>' for k, title, text in (
        (1, "Propose", "The Meta-Optimizer, a 0.5B LLM, samples n = 8 Meta-Rewards: expressions over the primitives g1–g4."),
        (2, "Train", "GRPO trains one Qwen2.5-1.5B-Instruct policy per valid Meta-Reward, each restarted from the base model."),
        (3, "Validate", "Each trained policy’s validation success becomes that Meta-Reward’s score v. Malformed rewards get v = 0."),
        (4, "Update", "GRPO updates the Meta-Optimizer with the group advantage (v − mean) / std; the next eight are sampled.")))
    choice = _choice("derl-outer", "Outer step in Table 4", [(str(k), f"Outer step {k}") for k in range(4)], "0", "outer")
    return f'''
    <ol class="dl-loop" aria-label="One outer-loop step of DERL">{loop}</ol>
    <div class="ag-controls" hidden>{choice}</div>
    {_player("derl-run", "Run the outer loop stage by stage")}
    <p class="dl-means" data-demo-state="derl-means">Mean v per outer step, computed from Table 4: {means}</p>
    {_trajectory(steps)}
    <div class="ag-table-wrap">
      <table class="dl-table" data-demo-state="derl-table" data-derl-steps="{steps_json}">
        <caption data-dl-caption>Outer step {step}: the eight Meta-Rewards the Meta-Optimizer sampled, as printed in Table 4, scored on the trajectory above.</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Meta-Reward (as printed)</th><th scope="col">Check · parsed here</th><th scope="col" class="num">R, success</th><th scope="col" class="num">R, failure</th><th scope="col" class="num">v · Table 4</th><th scope="col">Advantage · computed</th></tr></thead>
        <tbody data-dl-rows>{_rollout_rows(step, steps)}</tbody>
      </table>
    </div>
    <p class="dl-summary" data-dl-summary>{_e(derl_summary(step, steps))}</p>
    <div class="ag-table-wrap dl-reference-wrap">
      <table class="dl-table dl-reference">
        <caption>Compositions the paper names, on the same trajectory: the two GRPO baselines and the example structures of Section 5.2 (no scores printed for these).</caption>
        <thead><tr><th scope="col">Type</th><th scope="col">Composition</th><th scope="col" class="num">R, success</th><th scope="col" class="num">R, failure</th></tr></thead>
        <tbody data-dl-reference>{_reference_rows(steps)}</tbody>
      </table>
    </div>
    <p class="ag-footnote">Published: every expression and v, from <a href="{DERL_SOURCE}#A5.T4">Table 4</a> (<a href="{DERL_SOURCE}#A5">Appendix E</a>, ALFWorld L2), and the six-step example from <a href="{DERL_SOURCE}#S4.SS2">Section 4.2</a>. Computed here: parse checks, R values and advantages (<a href="{DERL_SOURCE}#S3.SS2">Section 3.2</a>, std taken as the sample estimate, which the paper does not specify). Illustrative: the step rewards you set. g1 is the outcome and g2–g4 the thirds, in the order Section 4.2 introduces them. GRPO normalizes rewards within each group of sampled trajectories, so adding a constant, as in step 1 row 7, or scaling by a positive factor leaves the inner-loop advantages unchanged; only differences between trajectories, relative to their spread, matter. Rows marked in brown pay a success no more than a failure on this trajectory. The appendix prints the first four outer steps; the paper reports convergence after about ten on ALFWorld. Nothing is trained in your browser.</p>'''


# --------------------------------------------------------------------------
# ChemAgent (arXiv 2501.06590v1)
# --------------------------------------------------------------------------

CHEM_SOURCE = "https://arxiv.org/html/2501.06590v1"

# Constants: 1 eV = 1.602 × 10^-19 J as printed in Figure 2(b); the electron mass
# 9.109e-31 kg as printed in Figure 3's execution memory; Planck's constant and
# the speed of light are standard values (not printed in the figures).
EV_J = 1.602e-19
ELECTRON_KG = 9.109e-31
PLANCK = 6.626e-34
LIGHT = 2.998e8
KE_CHOICES: tuple[int, ...] = (1, 10, 100, 1000, 10000)  # eV; the figure's task uses 100
WORK_FUNCTION_EV = 2.28

SUPERSCRIPT = str.maketrans('-0123456789', '⁻⁰¹²³⁴⁵⁶⁷⁸⁹')


def sci(value: float, digits: int = 2) -> str:
    """5.93 × 10⁶; mantissa from Python's exponent format (JS: toExponential)."""
    mantissa, exponent = f'{value:.{digits}e}'.split('e')
    return f'{mantissa} × 10{str(int(exponent)).translate(SUPERSCRIPT)}'


def precision(value: float, digits: int = 3) -> str:
    """Significant figures for moderate values (JS: toPrecision)."""
    text = f'{value:.{digits}g}'
    if 'e' in text:
        raise ValueError(f'value outside the plain-notation range: {text}')
    return text


def de_broglie(ke_ev: float) -> dict[str, float]:
    """Sub-task 1: v = sqrt(2 KE / m). Sub-task 2: p = m v, λ = h / p."""
    energy = ke_ev * EV_J
    velocity = math.sqrt(2 * energy / ELECTRON_KG)
    momentum = ELECTRON_KG * velocity
    return {"energy": energy, "velocity": velocity, "momentum": momentum,
            "wavelength_nm": PLANCK / momentum * 1e9, "beta": velocity / LIGHT}


def threshold_frequency(work_ev: float) -> dict[str, float]:
    energy = work_ev * EV_J
    return {"energy": energy, "frequency": energy / PLANCK}


# Figure 2 text, exactly as printed (sub-solutions are the figure's excerpts).
CHEM_A_TASK = "Calculate the de Broglie wavelength for (a) an electron with a kinetic energy of 100eV. The unit of the answer should be nm."
CHEM_SUBTASKS = ("Use kinetic energy formula to calculate velocity of electron",
                 "Use de Broglie wavelength formula to compute wavelength")
CHEM_SUBSOLUTIONS = ("[Formula 1] p = m * v where p is …. [Step 1] Identify the given values:",
                     "[Formula 1] The kinetic energy can be calculated: KE = ½mv², where…")
CHEM_NOT_FOUND = "If memory not found, then generate a task as imagination."
CHEM_B_TASK = "Given that the work function for sodium metal is 2.28eV, what is the threshold frequency v₀ for sodium?"
CHEM_B_SOLUTION = "First, we need to convert the work function ϕ from electron volts (eV) to joules (J). This conversion can be done using the relation: 1eV = 1.602 × 10⁻¹⁹J. ……"
CHEM_B_CONDITION = "The work function for sodium metal is 2.28eV."

# Figure 3 memory examples (excerpts, for the task “Calculate the momentum of the electron.”).
CHEM_MEMORY_EXAMPLES = {
    "plan": "[Relevant task] Calculate the de Broglie wavelength of the electron… [Relevant strategy] The de Broglie equation describes the wave-particle duality. … Conversion of units is key when interpreting physical quantities.",
    "execution": "[GOAL] Calculate the momentum of the electron by … [Reasoning] [step 1] Identify the given values… [Answer] mass_of_electron = 9.109e-31  # in kg …",
    "knowledge": "topic is quantum mechanics · [Thought] I can use Schrödinger equation [Explanation] [Formula] E = n²h²/8mL² …",
}


def chem_stages(mode: str, found: bool = True, unit2_correct: bool = True, ke_ev: int = 100) -> list[dict]:
    """Stages of Figure 2 (a) or (b): title, quoted figure text, explanation from
    the paper, computed line, and the library state after the stage. Mirrored in JS."""
    if mode == "a":
        phys = de_broglie(ke_ev)
        note = "" if ke_ev == 100 else f" (your input; the figure’s task uses 100 eV)"
        retrieve_1 = ({"quote": "retrieve → Library → Find relevant memories",
                       "text": "Execution-memory units whose sub-task embedding has cosine similarity above a threshold θ with this sub-task are retrieved (Llama3 embeddings, Section 2.5), together with the problem’s knowledge memory."}
                      if found else
                      {"quote": CHEM_NOT_FOUND,
                       "text": "No stored sub-task is similar enough. The LLM names the sub-task’s topic, for example quantum chemistry, and writes related practice problems with solutions: a “synthetic” execution memory (Section 2.5)."})
        return [
            {"title": "Test-set task", "quote": CHEM_A_TASK, "text": "",
             "computed": "", "pools": {"plan": ["Strategies from the development set"], "execution": ["Units from the development set"], "knowledge": []}, "active": []},
            {"title": "Decomposition · LLM, with plan memory Mp and knowledge memory Mk",
             "quote": f"Sub-task 1: {CHEM_SUBTASKS[0]} · Sub-task 2: {CHEM_SUBTASKS[1]} · Sub-task n: ……",
             "text": "Plan memory supplies stored strategies; knowledge memory, formulas and principles the LLM generates for this problem, is created now.",
             "computed": "", "pools": {"plan": ["Strategies from the development set"], "execution": ["Units from the development set"], "knowledge": ["Generated for this problem"]}, "active": ["plan", "knowledge"]},
            {"title": "Sub-task 1 · retrieve", "quote": retrieve_1["quote"], "text": retrieve_1["text"], "computed": "",
             "pools": {"plan": ["Strategies from the development set"],
                       "execution": ["Units from the development set"] + ([] if found else ["Synthetic practice problems on this topic"]),
                       "knowledge": ["Generated for this problem"]}, "active": ["execution", "knowledge"]},
            {"title": "Sub-solution 1", "quote": CHEM_SUBSOLUTIONS[0], "text": "",
             "computed": f"v = √(2·KE/m) = √(2 × {sci(phys['energy'])} J / 9.109 × 10⁻³¹ kg) = {sci(phys['velocity'])} m/s{note}",
             "pools": {"plan": ["Strategies from the development set"],
                       "execution": ["Units from the development set"] + ([] if found else ["Synthetic practice problems on this topic"]),
                       "knowledge": ["Generated for this problem"]}, "active": []},
            {"title": "Library update",
             "quote": "LLM → (Updated) Library",
             "text": "The solved sub-task enters execution memory at once, Me = Me ∪ {(C₁, T₁, O₁)} (Section 2.5), and its answer joins the conditions of the next sub-task (the arrow from Sub-solution 1 to Sub-task 2).",
             "computed": "",
             "pools": {"plan": ["Strategies from the development set"],
                       "execution": ["Units from the development set"] + ([] if found else ["Synthetic practice problems on this topic"]) + ["New: {condition, Sub-task 1, Sub-solution 1}"],
                       "knowledge": ["Generated for this problem"]}, "active": ["execution"]},
            {"title": "Sub-task 2 · retrieve from the (Updated) Library", "quote": "retrieve → (Updated) Library → Find relevant memories",
             "text": "Retrieval now also sees the unit just added, so later sub-tasks of the same problem can reuse it.", "computed": "",
             "pools": {"plan": ["Strategies from the development set"],
                       "execution": ["Units from the development set"] + ([] if found else ["Synthetic practice problems on this topic"]) + ["{condition, Sub-task 1, Sub-solution 1}"],
                       "knowledge": ["Generated for this problem"]}, "active": ["execution", "knowledge"]},
            {"title": "Sub-solution 2", "quote": CHEM_SUBSOLUTIONS[1],
             "text": "The LLM adds this unit to the library too, before any remaining sub-task (Sub-task n: …… in the figure).",
             "computed": f"p = m·v = {sci(phys['momentum'])} kg·m/s; λ = h/p = {precision(phys['wavelength_nm'])} nm{note}",
             "pools": {"plan": ["Strategies from the development set"],
                       "execution": ["Units from the development set"] + ([] if found else ["Synthetic practice problems on this topic"]) + ["{condition, Sub-task 1, Sub-solution 1}", "New: {condition, Sub-task 2, Sub-solution 2}"],
                       "knowledge": ["Generated for this problem"]}, "active": ["execution"]},
            {"title": "Summarize and generate → Final answer", "quote": "Final answer ✓",
             "text": "Plan memory gains a summary of the strategy used, Mp = Mp ∪ {(T, K)} (Section 2.5). Knowledge memory is discarded with the problem; it is not kept in the library.",
             "computed": f"λ = {precision(phys['wavelength_nm'])} nm for KE = {ke_ev} eV; v/c = {precision(phys['beta'])} (the sub-tasks’ nonrelativistic formulas assume v ≪ c){note}",
             "pools": {"plan": ["Strategies from the development set", "New: strategy summary (T, K)"],
                       "execution": ["Units from the development set"] + ([] if found else ["Synthetic practice problems on this topic"]) + ["{condition, Sub-task 1, Sub-solution 1}", "{condition, Sub-task 2, Sub-solution 2}"],
                       "knowledge": ["Discarded after the problem"]}, "active": ["plan", "knowledge"]},
        ]
    phys = threshold_frequency(WORK_FUNCTION_EV)
    unit2 = "{condition2, sub_task2, sub_solution2}"
    kept = ["{condition1, sub_task1, sub_solution1}"] + ([unit2] if unit2_correct else [])
    return [
        {"title": "Development-set task with its solution", "quote": f"Task: {CHEM_B_TASK} Solution: {CHEM_B_SOLUTION}", "text": "",
         "computed": "", "pools": {"plan": [], "execution": [], "knowledge": []}, "active": []},
        {"title": "Split and verify · LLM", "quote": f"Condition 1: {CHEM_B_CONDITION} Condition 2: ……",
         "text": "The conditions are extracted from the problem and checked, so that later steps work from correctly parsed data (Section 2.4).",
         "computed": "", "pools": {"plan": [], "execution": [], "knowledge": []}, "active": []},
        {"title": "Sub-task and sub-solution · LLM", "quote": "Sub-task and sub-solution",
         "text": "The LLM writes sub-tasks from the conditions; each sub-solution is parsed from the supplied solution rather than solved anew.",
         "computed": f"Check of the supplied solution: ϕ = 2.28 × 1.602 × 10⁻¹⁹ J = {sci(phys['energy'], 3)} J; v₀ = ϕ/h = {sci(phys['frequency'])} Hz",
         "pools": {"plan": [], "execution": [], "knowledge": []}, "active": []},
        {"title": "Verify each unit: correct → Execution Memory Me, wrong → Discard!",
         "quote": "{condition1, sub_task1, sub_solution1} · " + unit2 + (" · ……" if unit2_correct else " → Discard!"),
         "text": "Units are ranked by difficulty, and units below a confidence threshold judged by the LLM are discarded (Section 2.4).",
         "computed": "", "pools": {"plan": [], "execution": kept + (["Discarded: " + unit2] if not unit2_correct else []), "knowledge": []}, "active": ["execution"]},
        {"title": "Plan Memory Mp (relevant task, relevant knowledge) → Library", "quote": "Plan Memory Mp (relevant task, relevant knowledge)",
         "text": "Plan and execution memory form the static long-term library used at test time; knowledge memory is generated later, per test problem.",
         "computed": "", "pools": {"plan": ["(relevant task, relevant knowledge)"], "execution": kept + (["Discarded: " + unit2] if not unit2_correct else []), "knowledge": []}, "active": ["plan", "execution"]},
    ]


POOL_NAMES = (("plan", "Plan memory Mp"), ("execution", "Execution memory Me"), ("knowledge", "Knowledge memory Mk"))


def _pools_html(stage: dict) -> str:
    out = []
    for key, name in POOL_NAMES:
        items = stage["pools"][key]
        listing = ''.join(f'<li class="{"is-new" if item.startswith("New: ") else "is-gone" if item.startswith(("Discarded", "Discard")) else ""}">{_e(item)}</li>'
                          for item in items) or '<li class="ag-empty">Empty</li>'
        out.append(f'<div class="ch-pool{" is-active" if key in stage["active"] else ""}" data-pool="{key}"><h5>{_e(name)}</h5>'
                   f'<ul data-pool-items="{key}">{listing}</ul><p class="ch-example"><span>Example · Figure 3</span> {_e(CHEM_MEMORY_EXAMPLES[key])}</p></div>')
    return ''.join(out)


def _stage_items(stages: list[dict]) -> str:
    out = []
    for k, stage in enumerate(stages):
        computed = f'<p class="ch-computed"><span>Computed</span> {_e(stage["computed"])}</p>' if stage["computed"] else ''
        text = f'<p class="ch-text">{_e(stage["text"])}</p>' if stage["text"] else ''
        out.append(f'<li class="ch-stage" data-chem-stage="{k}"><h5>{_e(stage["title"])}</h5>'
                   f'<blockquote class="ch-quote">{_e(stage["quote"])}</blockquote>{text}{computed}</li>')
    return ''.join(out)


def _chem_demo() -> str:
    stages = chem_stages("a")
    # Every branch at the figure's 100 eV; the browser recomputes the physics for other energies.
    variants = {"a-yes": stages, "a-no": chem_stages("a", found=False),
                "b-correct": chem_stages("b"), "b-wrong": chem_stages("b", unit2_correct=False)}
    modes = _choice("chem-mode", "Panel of Figure 2", [("a", "(a) Library-enhanced reasoning"), ("b", "(b) Library construction")], "a", "mode")
    found = _choice("chem-found", "Execution memory for sub-task 1", [("yes", "Similar sub-task found"), ("no", "Not found")], "yes", "found")
    verified = _choice("chem-verify", "Verification of unit 2", [("correct", "Correct"), ("wrong", "Wrong")], "correct", "verify")
    ke = (f'<div class="ag-controls ch-ke" data-branch="a" hidden><span class="ch-ke-label">Kinetic energy (computed check)</span>'
          f'<button type="button" data-demo-action="chem-ke-down" aria-label="Divide the kinetic energy by ten">÷10</button>'
          f'<output data-chem-ke>100 eV</output>'
          f'<button type="button" data-demo-action="chem-ke-up" aria-label="Multiply the kinetic energy by ten">×10</button></div>')
    return f'''
    <div class="ag-controls ch-mode" hidden>{modes}</div>
    <div class="ag-controls ch-branches" hidden><div data-branch="a">{found}</div><div data-branch="b" hidden>{verified}</div>{ke}</div>
    {_player("chem-run", "Step through the panel")}
    <div class="ch-workspace" data-chem-mode="a" data-chem-ke-choices="{_e(json.dumps(KE_CHOICES))}" data-chem-variants="{_e(json.dumps(variants, ensure_ascii=False))}">
      <div class="ch-stages-column">
        <p class="ag-small-label" data-chem-panel-label>Figure 2(a) · library-enhanced reasoning on a test-set problem</p>
        <ol class="ch-stages" data-demo-state="chem-stages">{_stage_items(stages)}</ol>
      </div>
      <aside class="ch-library" aria-label="Library state after the stage" data-demo-state="chem-library">
        <p class="ag-small-label" data-chem-library-label>Library after the last stage</p>
        {_pools_html(stages[-1])}
      </aside>
    </div>
    <p class="ag-footnote">Quoted from <a href="{CHEM_SOURCE}#S1.F2">Figure 2</a>: the tasks, solution excerpt, conditions, sub-tasks, sub-solution excerpts and labels; Figure 2 prints no retrieved memory and no numerical answer. Memory examples are excerpts from <a href="{CHEM_SOURCE}#S2.F3">Figure 3</a>, written for the related task “Calculate the momentum of the electron.” Explanations follow <a href="{CHEM_SOURCE}#S2.SS4">Sections 2.4</a> and <a href="{CHEM_SOURCE}#S2.SS5">2.5</a>. Computed here: the physics, with 1 eV = 1.602 × 10⁻¹⁹ J (Figure 2(b)), m = 9.109 × 10⁻³¹ kg (Figure 3), h = 6.626 × 10⁻³⁴ J·s and c = 2.998 × 10⁸ m/s. The computed lines follow the sub-task descriptions; the figure’s two sub-solution excerpts appear exchanged, since Sub-solution 1 opens with the momentum formula and Sub-solution 2 with the kinetic-energy formula. The branch buttons show the paper’s alternatives; they do not reproduce a logged run.</p>'''


def render_demo(slug: str, insight: dict) -> dict[str, str] | str:
    """DERL and ChemAgent mechanism demos for "Inside the method"; '' otherwise."""
    if slug not in {"derl", "chemagent"}:
        return ""
    demo = insight.get("demo", {})
    kind = demo.get("kind")
    renderers = {"derl-loop": _derl_demo, "chem-library": _chem_demo}
    if kind not in renderers:
        return ""
    return {"method": _section(slug, kind, demo, renderers[kind]())}
