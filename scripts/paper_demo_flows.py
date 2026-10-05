"""Reasoning-flow mechanism demo for The Geometry of Reasoning (ICLR 2026).

The page is complete without JavaScript: the default two flows are drawn here and
their position, velocity and curvature similarities are computed with the paper's
own formulas (arXiv 2510.09782v2 / ICLR 2026), so the no-script page shows real
numbers for the default inputs. papers/demos/flows.js recomputes the same
quantities for any reader-chosen logic, topic, language and step order.

The 2-D trajectories are ILLUSTRATIVE, not the paper's embeddings. Topic and
language are modelled, as the paper describes, as translations, rotations and
scalings of a fixed logic polyline in representation space; the metrics are the
paper's: mean cosine for position and velocity, Pearson correlation of Menger
curvature for curvature. The paper's measured Table 1 values appear only as text.
"""
from __future__ import annotations

import json
import math
from html import escape

SOURCE = "https://arxiv.org/html/2510.09782v2"

# --- Illustrative model -----------------------------------------------------
# A logic template is a fixed sequence of (turn in degrees, step length): the
# turns set the shape of the path, hence its curvature profile.
LOGICS: dict[str, list[list[float]]] = {
    "A": [[0, 1.0], [40, 1.0], [110, 0.9], [20, 1.1], [30, 1.0], [115, 0.9], [25, 1.1], [30, 1.0]],
    "B": [[0, 1.0], [-25, 1.0], [-30, 1.0], [-120, 0.9], [-20, 1.1], [-30, 1.0], [-30, 1.0], [-125, 0.9]],
    "C": [[0, 1.0], [30, 1.0], [115, 0.9], [-25, 1.0], [-110, 0.9], [-20, 1.1], [30, 1.0], [30, 1.0]],
}
LOGIC_NAMES = {"A": "Logic A", "B": "Logic B", "C": "Logic C"}


def _polar(radius: float, angle_deg: float) -> list[float]:
    return [radius * math.cos(math.radians(angle_deg)), radius * math.sin(math.radians(angle_deg))]


# A topic is a small offset + rotation; a language is a larger offset + rotation
# + scale. Language dominates absolute position, as in the paper's Figure 2(a).
TOPICS: dict[str, dict] = {
    "weather": {"label": "Weather", "offset": _polar(2.2, 100), "rotate": 0},
    "education": {"label": "Education", "offset": _polar(2.2, 160), "rotate": 15},
    "sports": {"label": "Sports", "offset": _polar(2.2, 220), "rotate": -15},
}
LANGUAGES: dict[str, dict] = {
    "en": {"label": "English", "offset": _polar(6.5, -35), "rotate": 0, "scale": 1.0},
    "de": {"label": "German", "offset": _polar(6.5, -12), "rotate": 25, "scale": 0.85},
    "zh": {"label": "Chinese", "offset": _polar(6.5, 12), "rotate": 50, "scale": 1.2},
    "ja": {"label": "Japanese", "offset": _polar(6.5, 35), "rotate": -40, "scale": 0.9},
}
# Two fixed permutations used by the shuffle control (the paper's random-shuffle
# baseline). Applied independently to the two flows, they destroy shared order.
SHUFFLES = {"1": [2, 5, 0, 7, 3, 1, 6, 4], "2": [4, 1, 6, 3, 0, 7, 2, 5]}

EPS = 1e-8  # Matches the reference implementation's numerical guard.

FLOW1 = {"logic": "A", "topic": "weather", "language": "en"}
FLOW2 = {"logic": "A", "topic": "sports", "language": "zh"}

# Qwen3 0.6B row of Table 1 (measured), shown as text only.
TABLE1_QWEN3 = {"position": (0.26, 0.30, 0.85), "velocity": (0.17, 0.07, 0.08),
                "curvature": (0.53, 0.11, 0.13), "shuffle": (0.30, 0.02, 0.02)}

VIEW_W, VIEW_H, PAD = 320.0, 300.0, 34.0


def _flow_points(spec: dict, shuffled: bool) -> list[list[float]]:
    """Build an illustrative trajectory: a logic polyline placed by topic/language."""
    increments = []
    heading = 0.0
    for turn, length in LOGICS[spec["logic"]]:
        heading += turn
        increments.append([length * math.cos(math.radians(heading)), length * math.sin(math.radians(heading))])
    if shuffled:
        order = SHUFFLES[spec.get("shuffle", "1")]
        increments = [increments[i] for i in order]
    topic, lang = TOPICS[spec["topic"]], LANGUAGES[spec["language"]]
    ox = topic["offset"][0] + lang["offset"][0]
    oy = topic["offset"][1] + lang["offset"][1]
    theta = math.radians(topic["rotate"] + lang["rotate"])
    cos_t, sin_t, scale = math.cos(theta), math.sin(theta), lang["scale"]
    x = y = 0.0
    points = []
    for dx, dy in increments:
        x += dx
        y += dy
        points.append([ox + scale * (cos_t * x - sin_t * y), oy + scale * (sin_t * x + cos_t * y)])
    return points


def _cos(u: list[float], v: list[float]) -> float:
    nu = math.hypot(*u) + EPS
    nv = math.hypot(*v) + EPS
    return (u[0] * v[0] + u[1] * v[1]) / (nu * nv)


def _deltas(points: list[list[float]]) -> list[list[float]]:
    return [[b[0] - a[0], b[1] - a[1]] for a, b in zip(points, points[1:])]


def _menger(points: list[list[float]]) -> list[float]:
    out = []
    for p, q, r in zip(points, points[1:], points[2:]):
        a = math.dist(p, q)
        b = math.dist(q, r)
        c = math.dist(p, r)
        area = abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2
        out.append(4 * area / (a * b * c + EPS))
    return out


def _mean_cos(a: list[list[float]], b: list[list[float]]) -> float:
    n = min(len(a), len(b))
    return sum(_cos(a[i], b[i]) for i in range(n)) / n if n else 0.0


def _pearson(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    a, b = a[:n], b[:n]
    ma, mb = sum(a) / n, sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = (math.sqrt(sum((x - ma) ** 2 for x in a)) + EPS) * (math.sqrt(sum((y - mb) ** 2 for y in b)) + EPS)
    return num / den


def metrics(a: list[list[float]], b: list[list[float]]) -> dict[str, float]:
    return {"position": _mean_cos(a, b),
            "velocity": _mean_cos(_deltas(a), _deltas(b)),
            "curvature": _pearson(_menger(a), _menger(b))}


def _transform(flows: list[list[list[float]]]) -> dict[str, float]:
    xs = [p[0] for flow in flows for p in flow]
    ys = [p[1] for flow in flows for p in flow]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    span = max(maxx - minx, maxy - miny, 1e-6)
    scale = (VIEW_W - 2 * PAD) / span
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    return {"scale": scale, "cx": cx, "cy": cy}


def _project(point: list[float], t: dict[str, float]) -> list[float]:
    sx = VIEW_W / 2 + (point[0] - t["cx"]) * t["scale"]
    sy = VIEW_H / 2 - (point[1] - t["cy"]) * t["scale"]
    return [sx, sy]


def _fmt(value: float) -> str:
    return f"{value:+.2f}"


def _flow_svg(index: int, points: list[list[float]], t: dict[str, float], reveal: int) -> str:
    screen = [_project(p, t) for p in points]
    seg = []
    for k in range(1, len(screen)):
        shown = "" if k < reveal else ' hidden'
        (x1, y1), (x2, y2) = screen[k - 1], screen[k]
        # Velocity arrow: the step vector dy_t = y_t - y_{t-1}.
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
        seg.append(
            f'<g class="fl-step" data-step="{k}"{shown}>'
            f'<line class="fl-seg" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>'
            f'<g class="fl-arrow" transform="translate({mx:.1f} {my:.1f}) rotate({ang:.1f})">'
            f'<path d="M-3 -2.4 L3 0 L-3 2.4 Z"/></g></g>')
    dots = []
    for k, (sx, sy) in enumerate(screen):
        shown = "" if k < reveal else ' hidden'
        cls = "fl-dot is-start" if k == 0 else "fl-dot"
        dots.append(f'<circle class="{cls}" data-point="{k}" cx="{sx:.1f}" cy="{sy:.1f}" r="{3.2 if k == 0 else 2.4}"{shown}/>')
    label = _project(points[0], t)
    return (f'<g class="fl-flow is-flow{index}" data-flow="{index}">'
            f'<g class="fl-segs">{"".join(seg)}</g><g class="fl-dots">{"".join(dots)}</g>'
            f'<text class="fl-flow-label" x="{label[0] + 6:.1f}" y="{label[1] - 6:.1f}">Flow {index}</text></g>')


def _svg(flow1: list[list[float]], flow2: list[list[float]], reveal: int) -> str:
    t = _transform([flow1, flow2])
    marker = ('<marker id="fl-tick" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5">'
              '<circle cx="3" cy="3" r="2" class="fl-tickdot"/></marker>')
    return (f'<svg class="fl-graph" viewBox="0 0 {VIEW_W:g} {VIEW_H:g}" role="img" '
            f'aria-labelledby="fl-graph-title fl-graph-desc" data-demo-state="fl-graph">'
            f'<title id="fl-graph-title">Two illustrative reasoning trajectories</title>'
            f'<desc id="fl-graph-desc" data-fl-desc>Flow 1 and Flow 2 drawn as step points joined by velocity arrows.</desc>'
            f'<defs>{marker}</defs>{_flow_svg(1, flow1, t, reveal)}{_flow_svg(2, flow2, t, reveal)}</svg>')


def _metric_rows(values: dict[str, float]) -> str:
    rows = []
    meta = (("position", "Position similarity", "mean cos(y", "follows topic and language"),
            ("velocity", "Velocity similarity", "mean cos(Δy", "follows logic"),
            ("curvature", "Curvature similarity", "Pearson of Menger κ", "follows logic"))
    for key, label, formula, note in meta:
        value = values[key]
        width = max(0.0, min(1.0, (value + 1) / 2)) * 100
        rows.append(
            f'<div class="fl-metric" data-metric="{key}">'
            f'<div class="fl-metric-head"><span class="fl-metric-name">{escape(label)}</span>'
            f'<output class="fl-metric-value" data-fl-value="{key}">{_fmt(value)}</output></div>'
            f'<div class="fl-metric-track" aria-hidden="true"><i class="fl-zero"></i>'
            f'<i class="fl-metric-fill" data-fl-fill="{key}" style="width:{width:.1f}%"></i></div>'
            f'<p class="fl-metric-note"><code>{escape(formula)}</code> · <span data-fl-note="{key}">{escape(note)}</span></p>'
            f'</div>')
    return "".join(rows)


def _selector(index: int, spec: dict) -> str:
    def group(kind: str, options: dict, current: str) -> str:
        opts = "".join(
            f'<option value="{escape(key)}"{" selected" if key == current else ""}>{escape(options[key]["label"] if kind != "logic" else LOGIC_NAMES[key])}</option>'
            for key in options)
        return (f'<label class="fl-select"><span>{escape(kind.capitalize())}</span>'
                f'<select data-demo-select data-flow="{index}" data-field="{kind}">{opts}</select></label>')
    return (f'<fieldset class="fl-flow-controls is-flow{index}"><legend>Flow {index}</legend>'
            f'{group("logic", LOGIC_NAMES, spec["logic"])}'
            f'{group("topic", TOPICS, spec["topic"])}'
            f'{group("language", LANGUAGES, spec["language"])}</fieldset>')


def _caption(flow1: list[list[float]], flow2: list[list[float]], values: dict) -> str:
    return (f"Flow 1 ({LOGIC_NAMES[FLOW1['logic']]}, {TOPICS[FLOW1['topic']]['label']}, "
            f"{LANGUAGES[FLOW1['language']]['label']}) vs Flow 2 ({LOGIC_NAMES[FLOW2['logic']]}, "
            f"{TOPICS[FLOW2['topic']]['label']}, {LANGUAGES[FLOW2['language']]['label']}): "
            f"position {_fmt(values['position'])}, velocity {_fmt(values['velocity'])}, "
            f"curvature {_fmt(values['curvature'])}. Same logic under different carriers keeps curvature aligned.")


def _config() -> str:
    return json.dumps({
        "logics": LOGICS, "topics": TOPICS, "languages": LANGUAGES, "shuffles": SHUFFLES,
        "logicNames": LOGIC_NAMES, "flow1": FLOW1, "flow2": FLOW2,
        "eps": EPS, "view": [VIEW_W, VIEW_H, PAD]}, separators=(",", ":"))


def _table1_text() -> str:
    pos, vel, cur = TABLE1_QWEN3["position"], TABLE1_QWEN3["velocity"], TABLE1_QWEN3["curvature"]
    shuf = TABLE1_QWEN3["shuffle"]
    return (f'<p class="fl-measured"><span class="fl-small-label">Measured · Table 1 (Qwen3 0.6B)</span> '
            f'On the paper’s real embeddings, mean similarity by grouping criterion is: '
            f'position {pos[0]:.2f} / {pos[1]:.2f} / {pos[2]:.2f}, '
            f'velocity {vel[0]:.2f} / {vel[1]:.2f} / {vel[2]:.2f}, '
            f'curvature {cur[0]:.2f} / {cur[1]:.2f} / {cur[2]:.2f} for logic / topic / language. '
            f'Random-shuffle of the step order drops velocity to {shuf[1]:.2f} and curvature to {shuf[2]:.2f} '
            f'while position stays {shuf[0]:.2f}. '
            f'Values from <a href="{SOURCE}#S6">Table 1</a>; the trajectories above are illustrative, not these embeddings.</p>')


def render_demo(slug: str, insight: dict) -> str:
    if slug != "geometry-of-reasoning":
        return ""
    demo = insight.get("demo", {})
    flow1 = _flow_points(FLOW1, False)
    flow2 = _flow_points(FLOW2, False)
    values = metrics(flow1, flow2)
    reveal = len(flow1)  # Static page shows the complete trajectories.
    eyebrow = escape(demo.get("eyebrow", "Illustrative trajectories · paper’s formulas"))
    title = escape(demo.get("title", "Build two reasoning flows and compare their geometry"))
    caption = escape(demo.get("caption", "Trajectories are illustrative; metrics use the paper’s formulas."))
    return f'''<section class="flows-demo" data-paper-demo="{escape(slug, quote=True)}" data-flows-demo="reasoning-flow" data-flows-config="{escape(_config(), quote=True)}" aria-labelledby="{escape(slug, quote=True)}-flows-title">
      <header class="fl-heading"><p class="fl-small-label fl-eyebrow">{eyebrow}</p>
        <h3 id="{escape(slug, quote=True)}-flows-title">{title}</h3><p>{caption}</p></header>
      <div class="fl-controls" hidden>
        {_selector(1, FLOW1)}{_selector(2, FLOW2)}
        <label class="fl-toggle"><input type="checkbox" data-demo-action="fl-shuffle"> Shuffle step order (paper’s random-shuffle baseline)</label>
      </div>
      <div class="fl-workspace">
        <figure class="fl-figure">{_svg(flow1, flow2, reveal)}
          <figcaption class="fl-legend"><span class="fl-key is-flow1"><i></i>Flow 1</span><span class="fl-key is-flow2"><i></i>Flow 2</span><span class="fl-key is-vel"><i></i>Velocity arrow (Δy per step)</span></figcaption>
          <div class="fl-play rd-controls" hidden>
            <button type="button" data-demo-action="fl-play" aria-pressed="false">Play</button>
            <button type="button" data-demo-action="fl-step">Step</button>
            <button type="button" data-demo-action="fl-reset">Reset</button>
            <span class="fl-step-status" role="status" aria-live="polite" data-fl-step-status>Showing all {len(flow1)} steps</span>
          </div>
        </figure>
        <div class="fl-readout">
          <div class="fl-metrics" data-demo-state="fl-metrics" role="status" aria-live="polite">{_metric_rows(values)}</div>
          <p class="fl-caption" data-fl-caption>{escape(_caption(flow1, flow2, values))}</p>
        </div>
      </div>
      {_table1_text()}
      <p class="fl-footnote">The trajectories are <strong>illustrative 2-D paths</strong>, not the paper’s embeddings. A logic template is a fixed sequence of turns; topic and language are modelled, as in <a href="{SOURCE}#S4">Section 4</a>, as a translation, rotation and scaling of that path. The three numbers are the paper’s own quantities, computed in your browser: position and velocity are mean cosine similarity of the step positions and of the step differences Δy<sub>t</sub>=y<sub>t</sub>−y<sub>t−1</sub>; curvature is the Pearson correlation of the Menger curvature sequences κ<sub>t</sub>=4·Area(y<sub>t−1</sub>,y<sub>t</sub>,y<sub>t+1</sub>)/(abc) (<a href="{SOURCE}#S3">Section 3</a>). Because a similarity transform preserves curvature up to a constant, two flows that share a logic keep curvature correlation near 1 across topics and languages, while absolute position tracks the carrier; shuffling the step order collapses velocity and curvature but not position. No model is run.</p>
    </section>'''
