"""Decoding demos for LEDOM (reverse-lm) and COrAL, built only from published material.

Every value on these demos carries one of three labels:
  Measured           a number printed in one of the paper's tables;
  Published example  text printed in one of the paper's tables or figures;
  Derived            arithmetic on measured values (differences, ratios, counts).
Nothing here calls a model or supplies scores the paper does not report. The
static HTML is complete without JavaScript; papers/demos/decoding.js only adds
controls and recomputes the same summaries that are rendered here.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from html import escape
from typing import Any

LEDOM_URL = "https://arxiv.org/html/2507.01335v3"
CORAL_URL = "https://arxiv.org/html/2410.09675v1"
MINUS = "−"


def render_demo(slug: str, insight: dict[str, Any]) -> str:
    if slug == "coral":
        return coral_demo()
    if slug == "reverse-lm":
        return ledom_examples_demo() + reverse_reward_demo()
    return ""


def _e(value: object) -> str:
    return escape(str(value), quote=True)


def _signed(value: float, digits: int = 1) -> str:
    """Format a difference with a typographic minus, e.g. -51.6 -> '−51.6'."""
    rounded = round(value, digits)
    if rounded == 0:
        return f"{0:.{digits}f}"
    text = f"{abs(rounded):.{digits}f}"
    return ("+" if rounded > 0 else MINUS) + text


def _decimal(value: float) -> str:
    """One decimal, or two where Table 4 prints two (8.97): 42.0, 8.97, 1.03."""
    text = f"{abs(round(value, 2)):.2f}"
    return text[:-1] if text.endswith("0") else text


def _points(value: float) -> str:
    """Signed difference of Table 4 values with a typographic minus."""
    rounded = round(value, 2)
    if rounded == 0:
        return "0.0"
    return ("+" if rounded > 0 else MINUS) + _decimal(rounded)


def _button(attrs: str, label: str, pressed: bool) -> str:
    return f'<button type="button" {attrs} aria-pressed="{str(pressed).lower()}">{label}</button>'


# ---------------------------------------------------------------------------
# COrAL: five benchmarks x four decoding settings, all measured.
# ---------------------------------------------------------------------------

# Paper row names: NT, Ours, Ours w/o verifier, Ours w/o multi-forward.
CORAL_SETTINGS: tuple[str, ...] = ("Next-token", "Full COrAL", "No verifier", "No multi-forward")
CORAL_SPEED_MAX = 160.0  # Shared horizontal axis, tokens/s; the fastest point is 156.8.
CORAL_DEFAULT_REFERENCE = 0
CORAL_DEFAULT_HIGHLIGHT = 1


@dataclass(frozen=True)
class CoralBenchmark:
    name: str
    metric: str  # "Accuracy" or "Pass@1"
    source: str
    anchor: str
    # (quality %, accepted tokens per second) in CORAL_SETTINGS order.
    rows: tuple[tuple[float, float], ...]


# Checked against Tables 1-2 and the HumanEval table of §4.1 (arXiv v1 HTML and
# the LaTeX source body/experiments.tex). Mistral-7B-v0.3 base; greedy baseline.
CORAL_BENCHMARKS: tuple[CoralBenchmark, ...] = (
    CoralBenchmark("GSM8K", "Accuracy", "Table 1", "#S4.T1",
                   ((74.1, 39.7), (75.3, 43.4), (72.4, 156.8), (78.7, 14.9))),
    CoralBenchmark("MATH", "Accuracy", "Table 1", "#S4.T1",
                   ((21.8, 38.7), (22.7, 44.4), (20.0, 139.7), (24.3, 11.5))),
    CoralBenchmark("LogiQA", "Accuracy", "Table 2", "#S4.T2",
                   ((55.1, 33.6), (58.2, 62.1), (55.7, 99.1), (59.1, 8.9))),
    CoralBenchmark("ReClor", "Accuracy", "Table 2", "#S4.T2",
                   ((63.2, 33.2), (62.7, 38.2), (61.6, 72.0), (64.7, 11.3))),
    CoralBenchmark("HumanEval", "Pass@1", "§4.1 table", "#S4.F5",
                   ((64.6, 42.2), (13.0, 45.8), (6.5, 119.0), (61.6, 28.8))),
)

# Marks are defined once, centred on the origin, and placed with <use x="%" y="%">
# so that shapes stay undistorted and labels stay at CSS pixel sizes at any width.
CORAL_SHAPES: tuple[str, ...] = (
    '<circle id="coral-shape-0" r="5.5"/>',
    '<rect id="coral-shape-1" x="-5" y="-5" width="10" height="10"/>',
    '<path id="coral-shape-2" d="M0 -6.5 L6.2 4.5 L-6.2 4.5 Z"/>',
    '<path id="coral-shape-3" d="M0 -7 L7 0 L0 7 L-7 0 Z"/>',
)


def _coral_xy(quality: float, speed: float) -> tuple[float, float]:
    """Percent coordinates inside a plot whose axes both start at zero."""
    return round(100 * speed / CORAL_SPEED_MAX, 3), round(100 - quality, 3)


def _coral_arrow_visible(reference: tuple[float, float], highlight: tuple[float, float]) -> bool:
    # Arrows shorter than the marks themselves would only obscure the points.
    (rx, ry), (hx, hy) = _coral_xy(*reference), _coral_xy(*highlight)
    return ((hx - rx) ** 2 + (hy - ry) ** 2) ** 0.5 >= 6


def coral_summary(reference: int, highlight: int) -> str:
    """Summary sentence; decoding.js builds the identical text in the browser."""
    ref, high = CORAL_SETTINGS[reference], CORAL_SETTINGS[highlight]
    if reference == highlight:
        return f"{high} is the comparison setting. Choose a different highlighted setting to draw arrows from it."
    deltas = [round(b.rows[highlight][0] - b.rows[reference][0], 1) for b in CORAL_BENCHMARKS]
    ratios = [b.rows[highlight][1] / b.rows[reference][1] for b in CORAL_BENCHMARKS]
    up, down = sum(d > 0 for d in deltas), sum(d < 0 for d in deltas)
    if up == len(deltas):
        quality = "higher on all five benchmarks"
    elif down == len(deltas):
        quality = "lower on all five benchmarks"
    else:
        quality = f"higher on {up} and lower on {down} of five benchmarks"
    text = (f"{high} vs {ref}: accuracy is {quality}. Throughput is "
            f"{min(ratios):.2f}× to {max(ratios):.2f}× the {ref} rate.")
    for bench, delta in zip(CORAL_BENCHMARKS, deltas):
        if abs(delta) >= 10:
            text += (f" {bench.name} {bench.metric.lower()} goes from {bench.rows[reference][0]:.1f}"
                     f" to {bench.rows[highlight][0]:.1f} ({_signed(delta)} points).")
    return text


def _coral_change(bench: CoralBenchmark, reference: int, highlight: int) -> str:
    (rq, rs), (hq, hs) = bench.rows[reference], bench.rows[highlight]
    if reference == highlight:
        quality, speed, large = f"{hq:.1f}", f"{hs:.1f}", False
    else:
        delta = round(hq - rq, 1)
        quality = f"{rq:.1f} → {hq:.1f} ({_signed(delta)})"
        speed = f"{rs:.1f} → {hs:.1f} ({hs / rs:.2f}×)"
        large = abs(delta) >= 10
    quality_class = ' class="is-large"' if large else ''
    return (f'<div><dt>{_e(bench.metric)} (%)</dt><dd data-coral-quality{quality_class}>{quality}</dd></div>'
            f'<div><dt>Tokens/s</dt><dd data-coral-speed>{speed}</dd></div>')


def _coral_panel(bench: CoralBenchmark, reference: int, highlight: int) -> str:
    marks = []
    for index, (quality, speed) in enumerate(bench.rows):
        x, y = _coral_xy(quality, speed)
        role = "is-highlight" if index == highlight else "is-reference" if index == reference else "is-other"
        marks.append(
            f'<g class="coral-mark {role}" data-setting="{index}" data-quality="{quality}" data-speed="{speed}">'
            f'<title>{_e(CORAL_SETTINGS[index])}: {quality:.1f}% {_e(bench.metric.lower())}, {speed:.1f} accepted tokens/s</title>'
            f'<use href="#coral-shape-{index}" x="{x}%" y="{y}%"/></g>')
    # The highlighted mark is drawn last so that it sits above the others.
    marks.append(marks.pop(highlight))
    (x1, y1), (x2, y2) = _coral_xy(*bench.rows[reference]), _coral_xy(*bench.rows[highlight])
    hidden = "" if reference != highlight and _coral_arrow_visible(bench.rows[reference], bench.rows[highlight]) else ' visibility="hidden"'
    grid = ''.join(f'<line class="coral-grid" x1="{100 * s / CORAL_SPEED_MAX:g}%" x2="{100 * s / CORAL_SPEED_MAX:g}%" y1="0" y2="100%"/>' for s in (40, 80, 120))
    grid += ''.join(f'<line class="coral-grid" x1="0" x2="100%" y1="{y}%" y2="{y}%"/>' for y in (0, 50))
    label = "; ".join(f"{name} {q:.1f}% at {s:.1f} tokens/s" for name, (q, s) in zip(CORAL_SETTINGS, bench.rows))
    y_ticks = ''.join(f'<span class="coral-y" style="top:{100 - v}%">{v}</span>' for v in (100, 50, 0))
    x_ticks = ''.join(f'<span class="coral-x coral-x-{pos}" style="left:{100 * v / CORAL_SPEED_MAX:g}%">{v}</span>'
                      for pos, v in (("start", 0), ("mid", 80), ("end", 160)))
    return f'''<figure class="coral-panel" data-benchmark="{_e(bench.name)}" data-metric="{_e(bench.metric)}">
        <figcaption class="coral-panel-head"><strong>{_e(bench.name)}</strong><span>{_e(bench.metric)} · <a href="{CORAL_URL}{bench.anchor}">{_e(bench.source)}</a></span></figcaption>
        <div class="coral-plot">{y_ticks}
          <svg class="coral-svg" role="img" aria-label="{_e(bench.name)} {_e(bench.metric.lower())} against accepted tokens per second: {_e(label)}">
            {grid}<line class="coral-axis" x1="0" x2="0" y1="0" y2="100%"/><line class="coral-axis" x1="0" x2="100%" y1="100%" y2="100%"/>
            <line class="coral-arrow" data-coral-arrow x1="{x1}%" y1="{y1}%" x2="{x2}%" y2="{y2}%" marker-end="url(#coral-arrowhead)"{hidden}/>
            {''.join(marks)}
          </svg>{x_ticks}
        </div>
        <dl class="coral-change" data-coral-change>{_coral_change(bench, reference, highlight)}</dl>
      </figure>'''


def _coral_swatch(index: int) -> str:
    return (f'<svg class="coral-swatch coral-swatch-{index}" width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true" focusable="false">'
            f'<use href="#coral-shape-{index}"/></svg>')


def coral_demo() -> str:
    reference, highlight = CORAL_DEFAULT_REFERENCE, CORAL_DEFAULT_HIGHLIGHT
    panels = ''.join(_coral_panel(bench, reference, highlight) for bench in CORAL_BENCHMARKS)
    highlight_buttons = ''.join(
        _button(f'data-demo-action="coral-highlight" data-setting="{i}"', f'{_coral_swatch(i)}{_e(name)}', i == highlight)
        for i, name in enumerate(CORAL_SETTINGS))
    reference_buttons = ''.join(
        _button(f'data-demo-action="coral-reference" data-reference="{i}"', _e(CORAL_SETTINGS[i]), i == reference)
        for i in (0, 1))
    key = ''.join(f'<span>{_coral_swatch(i)}{_e(name)}</span>' for i, name in enumerate(CORAL_SETTINGS))
    head_benchmarks = ''.join(
        f'<th scope="colgroup" colspan="2">{_e(b.name)} <a href="{CORAL_URL}{b.anchor}">{_e(b.source)}</a></th>'
        for b in CORAL_BENCHMARKS)
    head_metrics = ''.join(f'<th scope="col" class="num">{_e(b.metric)}</th><th scope="col" class="num">Tok/s</th>' for b in CORAL_BENCHMARKS)
    rows = ''.join(
        f'<tr data-setting="{i}" class="{"is-highlight" if i == highlight else "is-reference" if i == reference else ""}">'
        f'<th scope="row">{_coral_swatch(i)}{_e(name)}</th>'
        + ''.join(f'<td class="num" data-benchmark="{_e(b.name)}" data-measure="quality">{b.rows[i][0]:.1f}</td>'
                  f'<td class="num" data-benchmark="{_e(b.name)}" data-measure="speed">{b.rows[i][1]:.1f}</td>' for b in CORAL_BENCHMARKS)
        + '</tr>' for i, name in enumerate(CORAL_SETTINGS))
    defs = ''.join(CORAL_SHAPES)
    return f'''<div class="paper-demo decode-demo coral-demo" data-paper-demo="coral-evidence">
  <svg class="decode-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>{defs}
    <marker id="coral-arrowhead" class="coral-arrowhead" viewBox="0 0 10 10" refX="19" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 1 L9 5 L0 9 Z"/></marker></defs></svg>
  <div class="demo-heading"><span class="demo-tag">Measured results · Tables 1–2 and §4.1</span><h3>Five benchmarks, four decoding settings, one pair of axes</h3>
    <p>Each panel plots one benchmark from the paper: accuracy (pass@1 for HumanEval) against accepted tokens per second. Both axes start at zero and are the same in every panel. The arrow runs from the comparison setting to the highlighted one.</p></div>
  <div class="demo-controls coral-controls" data-coral-controls hidden>
    <div class="coral-control-row"><span class="coral-control-label" id="coral-highlight-label">Highlight</span>
      <div class="demo-options" role="group" aria-labelledby="coral-highlight-label">{highlight_buttons}</div></div>
    <div class="coral-control-row"><span class="coral-control-label" id="coral-reference-label">Arrow from</span>
      <div class="demo-options" role="group" aria-labelledby="coral-reference-label">{reference_buttons}</div></div>
  </div>
  <div data-demo-state>
    <p class="coral-key" data-coral-key>{key}<span class="coral-key-note">Filled accent: Full COrAL (highlighted). Dark: next-token (comparison).</span></p>
    <div class="coral-grid-panels">{panels}</div>
    <p class="coral-axes-note">Horizontal: accepted tokens per second, 0–160. Vertical: accuracy or pass@1, 0–100%. Changes in parentheses are percentage points and throughput ratios, computed from the reported values.</p>
    <p class="decode-status" data-coral-summary role="status" aria-live="polite">{_e(coral_summary(reference, highlight))}</p>
    <p class="decode-caption" id="coral-table-caption">All 40 reported values: quality in % and accepted tokens per second for each setting.</p>
    <div class="table-scroll" tabindex="0" role="region" aria-label="All forty reported COrAL values">
      <table class="decode-table coral-table" aria-describedby="coral-table-caption">
        <thead><tr><th scope="col" rowspan="2">Setting</th>{head_benchmarks}</tr><tr>{head_metrics}</tr></thead>
        <tbody>{rows}</tbody></table></div>
    <p class="decode-note">The paper attributes the HumanEval drop mainly to invalid syntax, 70.1% of samples in its no-verifier error analysis (Figure 5). The 61.6 without multi-forward prediction was obtained with a stricter acceptance threshold, ϵ = 0.5. Speeds were measured without a KV cache at batch size 1 on a single GPU, and code generation ran on different GPUs from the reasoning tasks, so compare speeds within a panel.</p>
  </div>
  <p class="demo-provenance">Measured: <a href="{CORAL_URL}#S4.T1">Table 1</a> (GSM8K, MATH), <a href="{CORAL_URL}#S4.T2">Table 2</a> (LogiQA, ReClor) and the <a href="{CORAL_URL}#S4.F5">§4.1 HumanEval table</a>, Mistral-7B-v0.3, greedy next-token baseline, throughput in accepted tokens per second (hardware and ϵ in Appendix D). Derived: differences and ratios. Axes start at zero; points are reported experiments, not interpolations. The decoding mechanism itself is illustrated by the paper’s Figure 2, reproduced on this page.</p>
</div>'''


# ---------------------------------------------------------------------------
# LEDOM: published reverse-generation examples.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LedomExample:
    key: str
    label: str  # Button label
    task: str  # Task category as named in the paper
    source: str
    anchor: str
    extent: str
    given: str
    output: str
    note: str
    units: str = "words"  # "symbols" splits mathematics into single characters
    elision: str = ""  # Text the paper elides after the given text


# Text is copied as printed (curly quotes included). "\n" marks a printed line break.
LEDOM_EXAMPLES: tuple[LedomExample, ...] = (
    LedomExample(
        "backstory", "Backstory", "Abductive reasoning", "Appendix C, Figure 6", "#A3.F6", "full output",
        "That is why Mike gave up his job and started his own business.",
        "Mike worked very hard in school and was the first college graduate in his family. His family did not have a lot"
        " of money, so he had to find a way to pay for his college education. Mike had a part-time job while he was in high"
        " school. He also did odd jobs to earn extra money. After a few years, Mike was able to save enough money to go to"
        " college. When Mike graduated from college, he got a job at a bank. It was a good job, but it was not what he"
        " wanted to do for the rest of his life.",
        "The paper’s example of abductive inference: an antecedent story that motivates the stated outcome."),
    LedomExample(
        "story", "Story ending", "Story generation", "Appendix C, Figure 6", "#A3.F6", "full output",
        "And so, Prince Adrian and Princess Elara lived happily ever after, their hearts forever entwined, their love a"
        " beacon of hope and inspiration for all.",
        "\"Goodnight, my princess,\" he said, leaning down and kissing her on the forehead. Then he turned and went to his"
        " room where he lay down on his bed and fell into a deep sleep. The next morning he awoke and found that he"
        " couldn’t go back to sleep, so he got up and walked into Princess Lara’s room and saw that she was still asleep.\n"
        "He walked over to her and gently placed his hand on her cheek. She opened her eyes and looked up at him. He"
        " smiled and leaned down to kiss her. As he kissed her, he whispered in her ear, \"I love you.\"",
        "Look at the names: the output says “Princess Lara”, while the given ending says “Princess Elara”."),
    LedomExample(
        "question", "Question from answer", "Question generation", "Table 2", "#S2.T2", "as printed",
        "Answer: She eats 3 eggs every day. 7 days in a week. 3*7 = 21. 21",
        "Alyssa’s cat loves eggs. If she eats 3 eggs a day, how many in a week?",
        "The answer fixes three eggs a day and a seven-day week; the question keeps both. Alyssa and the cat appear nowhere in the answer."),
    LedomExample(
        "sentiment", "Few-shot labels", "Few-shot sentiment", "Table 2", "#S2.T2", "as printed",
        "4. Comment: Wow, that is great. Positive; 5. Comment: I do not like this. Negative;",
        "1. This movie is very good. Positive;\n2. I haven’t seen this movie, but I like it. Neutral;\n3. That is too bad. Negative.",
        "Given demonstrations 4 and 5, LEDOM writes demonstrations 1–3, including a “Neutral” label that the given text never uses."),
    LedomExample(
        "reversal", "Reversal curse", "Reversal curse", "Table 2", "#S2.T2", "as printed",
        "is the author of Harry Potter.",
        "J.K. Rowling",
        "Text usually names the entity before describing it. Read backwards, the description comes first, so recovering the name is an ordinary prediction for LEDOM (§3)."),
    LedomExample(
        "recall", "Quotation", "Knowledge recall", "Table 2", "#S2.T2", "as printed",
        "Now I become death, the destroyer of worlds.",
        "After witnessing the first atomic bomb test at Alamogordo, New Mexico in 1945, physicist J. Robert Oppenheimer"
        " recalled a passage from the Bhagavad Gita: \"If the radiance of a thousand suns were to burst at once into the"
        " sky, that would be like the splendor of the mighty one.\"",
        "A successful case, although factual recall is LEDOM’s weakest benchmark area: TriviaQA 19.82 vs. 40.22 for the matched forward model at 2B (Table 3)."),
    LedomExample(
        "arithmetic", "Arithmetic", "Math reasoning", "Table 2", "#S2.T2", "as printed",
        "+2=6.",
        "(3)=2+½∗2²",
        "Read together: (3) = 2 + ½ ∗ 2² + 2 = 6, and 2 + 2 + 2 = 6. The terms LEDOM wrote are consistent with the given result. Table 2 prints this fragment as shown.",
        units="symbols"),
    LedomExample(
        "gsm8k", "GSM8K (incorrect)", "GSM8K evaluation", "Appendix B, Figure 5", "#A2.F5", "full prediction",
        "The above is the thought chain.\nQuestion: Janet’s ducks lay 16 eggs per day. She eats three for breakfast every"
        " morning and bakes muffins for her friends every day with four. She sells the remainder at the farmers’ market"
        " daily for $2 per fresh duck egg. How much in dollars does she make every day at the farmers’ market?",
        "16 is the answer of the following question.\nSince Janet sells her fresh duck eggs at the farmers’ market for $1"
        " per fresh duck egg, the number of dollars Janet makes per fresh duck egg is 3-1=$2.\nSince she sells 8 eggs every"
        " day, the total number of dollars Janet makes at the farmers’ market every day is 8*2=16\nTherefore, Janet makes 16"
        " dollars at the farmers’ market every day.",
        "Incorrect: the reference answer is 16 − 3 − 4 = 9 eggs, times $2 = $18. The chain reaches 16 from premises the question does not contain ($1 per egg, 8 eggs). LEDOM scores 1.74% on GSM8K at both 2B and 7B (Table 3).",
        elision="[few-shot demonstrations: Figure 5 prints one and elides six]"),
)


def _units(text: str, kind: str) -> list[str]:
    """Display units: whitespace-separated words, or single symbols for mathematics."""
    if kind == "symbols":
        return [char for char in text if not char.isspace()]
    return re.findall(r"\n|[^\s]+", text)


def _words(example: LedomExample) -> list[str]:
    return [unit for unit in _units(example.output, example.units) if unit != "\n"]


def _bare(text: str) -> str:
    """Printed straight double quotes become single quotes inside a quoted excerpt."""
    return text.replace('"', "'")


def ledom_status(example: LedomExample, generated: int | None = None) -> str:
    """Status line for a generation position; decoding.js builds the identical text."""
    words = _words(example)
    total = len(words)
    count = total if generated is None else generated
    noun = "symbols" if example.units == "symbols" else "words"
    joiner = "" if example.units == "symbols" else " "
    if count >= total:
        return f"All {total} {noun} generated. LEDOM wrote “{_bare(words[-1])}” first and “{_bare(words[0])}” last."
    if count <= 0:
        return f"Nothing generated yet. LEDOM has read the given text; its first output will be “{_bare(words[-1])}”, directly before it."
    remaining = words[:total - count]
    opening = joiner.join(remaining[:4]) + (joiner + "…" if len(remaining) > 4 else "")
    return (f"{count} of {total} {noun} generated, from “{_bare(words[-1])}” back to “{_bare(words[total - count])}”."
            f" Still unwritten: “{_bare(opening)}”.")


def _unit_html(units: list[str], kind: str) -> str:
    parts: list[str] = []
    for unit in units:
        if unit == "\n":
            parts.append('<br data-u="br">')
        else:
            if parts and not parts[-1].startswith('<br') and kind != "symbols":
                parts.append(" ")
            parts.append(f'<span data-u="w">{_e(unit)}</span>')
    return ''.join(parts)


def _ledom_article(example: LedomExample) -> str:
    given = _unit_html(_units(example.given, example.units), example.units)
    if example.elision:
        given += f' <span class="rv-elision" data-u="elision">{_e(example.elision)}</span>'
    output = _unit_html(_units(example.output, example.units), example.units)
    count = len(_words(example))
    noun = "symbols" if example.units == "symbols" else "words"
    text_class = "rv-text rv-symbols" if example.units == "symbols" else "rv-text"
    return f'''<article class="rv-example" data-rv-example="{example.key}" data-units="{example.units}" aria-labelledby="rv-title-{example.key}">
      <header class="rv-meta"><h4 id="rv-title-{example.key}">{_e(example.task)}</h4>
        <p>Published example · <a href="{LEDOM_URL}{example.anchor}">{_e(example.source)}</a> · {_e(example.extent)} · {count} {noun}</p></header>
      <div class="rv-rows" data-rv-rows>
        <div class="rv-row rv-row-output" data-rv-row="output"><p class="rv-row-label" data-rv-label>Earlier text · written by LEDOM, last {noun[:-1]} first</p>
          <p class="{text_class}" data-rv-reading>{output}</p><p class="{text_class} rv-model" data-rv-model hidden></p></div>
        <div class="rv-row rv-row-given" data-rv-row="given"><p class="rv-row-label" data-rv-label>Later text · given to LEDOM</p>
          <p class="{text_class}" data-rv-reading>{given}</p><p class="{text_class} rv-model" data-rv-model hidden></p></div>
      </div>
      <p class="rv-note">{_e(example.note)}</p>
      <p class="decode-status rv-status" data-rv-status role="status" aria-live="polite">{_e(ledom_status(example))}</p>
    </article>'''


def ledom_examples_demo() -> str:
    first = LEDOM_EXAMPLES[0]
    buttons = ''.join(
        _button(f'data-demo-action="rv-example" data-example="{ex.key}"', _e(ex.label), i == 0)
        for i, ex in enumerate(LEDOM_EXAMPLES))
    articles = ''.join(_ledom_article(ex) for ex in LEDOM_EXAMPLES)
    total = len(_words(first))
    return f'''<div class="paper-demo decode-demo ledom-examples" data-paper-demo="reverse-examples">
  <div class="demo-heading"><span class="demo-tag">Published examples · Table 2, Figures 5–6</span><h3>Give LEDOM an ending and it writes what came before</h3>
    <p>Each example pairs a later text with the earlier text LEDOM generated for it, as printed in the paper. The model reads the given text reversed and writes its output last word first, so the words nearest the given text are chosen before the opening. Move the slider to see which parts of each output were committed first.</p></div>
  <div class="demo-controls rv-controls" data-rv-controls hidden>
    <div class="demo-options" role="group" aria-label="Published example">{buttons}</div>
    <div class="rv-control-row">
      <div class="demo-options" role="group" aria-label="Display order">{_button('data-demo-action="rv-order" data-order="reading"', "Reading order", True)}{_button('data-demo-action="rv-order" data-order="model"', "LEDOM’s order", False)}</div>
      <label class="rv-range" for="rv-progress"><span>Output generated</span>
        <input id="rv-progress" data-demo-range type="range" min="0" max="{total}" step="1" value="{total}" aria-describedby="rv-progress-help">
        <output for="rv-progress" data-rv-count>{total} / {total}</output></label>
      <p class="rv-help" id="rv-progress-help">Arrow keys move one word at a time. Generation runs from the end of the output towards its start.</p>
    </div>
  </div>
  <div data-demo-state>
    <div class="rv-examples" data-rv-examples>{articles}</div>
  </div>
  <p class="demo-provenance">Published examples: <a href="{LEDOM_URL}#S2.T2">Table 2</a>, <a href="{LEDOM_URL}#A2.F5">Appendix B, Figure 5</a> and <a href="{LEDOM_URL}#A3.F6">Appendix C, Figure 6</a>, reproduced in reading order as the paper prints them. Measured: GSM8K and TriviaQA scores from <a href="{LEDOM_URL}#S3.T3">Table 3</a>. Illustrative: the word-level generation order and reversed display. LEDOM reverses subword tokens, so the pieces within each word are also reversed. Table 2 also lists coding, data-augmentation and unsafe-prompt cases. The paper redacts the unsafe output, and this page does not show it.</p>
</div>'''


# ---------------------------------------------------------------------------
# LEDOM: Reverse Reward, measured aggregate accuracy (Table 4).
# ---------------------------------------------------------------------------

RR_BENCHMARKS: tuple[str, ...] = ("MATH-500", "GSM8K", "AIME 2024", "AMC 2023")
RR_MODELS: tuple[str, ...] = ("DeepSeekMath", "QwenMath", "OpenMath2")
RR_STRATEGIES: tuple[tuple[str, str], ...] = (
    ("greedy", "Greedy decoding"),
    ("random", "Random pick (Best-of-N)"),
    ("rr", "Reverse Reward (Best-of-N)"),
    ("beam", "Reverse Reward (beam search)"),
)
# Table 4, accuracy (%), in RR_BENCHMARKS order; verified against sections/5-SFT.tex.
# Beam search was run for OpenMath2 only.
RR_TABLE: dict[str, dict[str, tuple[float, ...]]] = {
    "DeepSeekMath": {"greedy": (42.0, 81.8, 10.0, 12.5), "random": (40.7, 81.1, 8.97, 18.6), "rr": (43.6, 84.1, 13.3, 27.5)},
    "QwenMath": {"greedy": (78.0, 95.6, 16.7, 55.0), "random": (73.9, 94.7, 11.3, 48.3), "rr": (80.8, 96.1, 23.3, 57.5)},
    "OpenMath2": {"greedy": (64.0, 89.8, 10.0, 40.0), "random": (56.2, 87.1, 10.0, 24.8), "rr": (65.0, 91.0, 16.7, 40.0),
                  "beam": (65.4, 91.8, 6.7, 42.5)},
}
RR_DOMAIN = 20.0  # Horizontal axis: -20 to +20 percentage points.
RR_SHAPES: tuple[str, ...] = (
    '<rect id="rr-shape-greedy" x="-4.5" y="-4.5" width="9" height="9"/>',
    '<circle id="rr-shape-random" r="5"/>',
    '<circle id="rr-shape-rr" r="5.5"/>',
    '<path id="rr-shape-beam" d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z"/>',
)


def _rr_label(key: str) -> str:
    return dict(RR_STRATEGIES)[key]


def _rr_x(delta: float) -> float:
    return round(50 + 50 * max(-RR_DOMAIN, min(RR_DOMAIN, delta)) / RR_DOMAIN, 3)


def rr_summary(baseline: str) -> list[str]:
    """One sentence per compared strategy; decoding.js builds identical text."""
    lines = []
    for key, label in RR_STRATEGIES:
        if key == baseline:
            continue
        higher, equal, lower = [], [], []
        for model in RR_MODELS:
            if key not in RR_TABLE[model]:
                continue
            for index, bench in enumerate(RR_BENCHMARKS):
                delta = round(RR_TABLE[model][key][index] - RR_TABLE[model][baseline][index], 2)
                (higher if delta > 0 else lower if delta < 0 else equal).append(f"{model} · {bench}")
        total = len(higher) + len(equal) + len(lower)
        def named(cells: list[str]) -> str:
            return f" ({', '.join(cells)})" if 0 < len(cells) <= 2 and len(cells) < total else ""
        text = f"{label}: higher in {len(higher)} of {total} pairs{named(higher)}"
        for word, cells in (("equal", equal), ("lower", lower)):
            if cells:
                text += f"; {word} in {len(cells)}{named(cells)}"
        lines.append(text + ".")
    return lines


def _rr_status_html(baseline: str) -> str:
    items = ''.join(f'<li>{_e(line)}</li>' for line in rr_summary(baseline))
    return f'<p>Compared with {_e(_rr_label(baseline)[0].lower() + _rr_label(baseline)[1:])}:</p><ul>{items}</ul>'


def _rr_row(model: str, index: int, baseline: str) -> str:
    marks = []
    for key, label in RR_STRATEGIES:
        values = RR_TABLE[model].get(key)
        if values is None:
            continue
        delta = values[index] - RR_TABLE[model][baseline][index]
        hidden = ' visibility="hidden"' if key == baseline else ''
        marks.append(f'<use class="rr-mark rr-mark-{key}" data-strategy="{key}" href="#rr-shape-{key}" x="{_rr_x(delta)}%" y="50%"{hidden}/>')
    rr_delta = RR_TABLE[model]["rr"][index] - RR_TABLE[model][baseline][index]
    return (f'<div class="rr-row" data-model="{model}" data-bench-index="{index}"><span class="rr-model">{model}</span>'
            f'<span class="rr-track"><svg width="100%" height="100%" aria-hidden="true" focusable="false">'
            f'<line class="rr-tick" x1="25%" x2="25%" y1="0" y2="100%"/><line class="rr-tick" x1="75%" x2="75%" y1="0" y2="100%"/>'
            f'<line class="rr-zero" x1="50%" x2="50%" y1="0" y2="100%"/>{"".join(marks)}</svg></span>'
            f'<span class="rr-value" data-rr-value>{_points(rr_delta)}</span></div>')


def _rr_swatch(key: str) -> str:
    return (f'<svg class="rr-swatch rr-mark-{key}" width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true" focusable="false">'
            f'<use href="#rr-shape-{key}"/></svg>')


def reverse_reward_demo() -> str:
    baseline = "greedy"
    groups = ''.join(
        f'<div class="rr-group" role="group" aria-label="{_e(bench)}"><p class="rr-bench">{_e(bench)}</p>'
        + ''.join(_rr_row(model, index, baseline) for model in RR_MODELS) + '</div>'
        for index, bench in enumerate(RR_BENCHMARKS))
    ticks = ''.join(f'<span style="left:{_rr_x(v)}%">{_signed(v, 0) if v else "0"}</span>' for v in (-20, -10, 0, 10, 20))
    key = ''.join(f'<span class="rr-key-item" data-strategy="{k}"{" hidden" if k == baseline else ""}>{_rr_swatch(k)}{_e(label)}</span>'
                  for k, label in RR_STRATEGIES)
    body = []
    for model in RR_MODELS:
        strategies = [(k, label) for k, label in RR_STRATEGIES if k in RR_TABLE[model]]
        best = [max(RR_TABLE[model][k][i] for k, _ in strategies) for i in range(len(RR_BENCHMARKS))]
        # A model header row, rather than a spanning column, keeps the table phone-width.
        body.append(f'<tr class="rr-model-row"><th scope="colgroup" colspan="{len(RR_BENCHMARKS) + 1}">{model}</th></tr>')
        for k, label in strategies:
            cells = ''.join(
                f'<td class="num{" is-best" if value == best[i] else ""}" data-model="{model}" data-strategy="{k}"'
                f' data-bench="{_e(bench)}" data-value="{value}">{_decimal(value)}</td>'
                for i, (bench, value) in enumerate(zip(RR_BENCHMARKS, RR_TABLE[model][k])))
            classes = 'is-baseline' if k == baseline else ''
            body.append(f'<tr data-strategy="{k}" class="{classes}"><th scope="row">{_e(label)}</th>{cells}</tr>')
    headings = ''.join(f'<th scope="col" class="num">{_e(b)}</th>' for b in RR_BENCHMARKS)
    return f'''<div class="paper-demo decode-demo rr-demo" data-paper-demo="reverse-reward-results">
  <svg class="decode-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>{''.join(RR_SHAPES)}</defs></svg>
  <div class="demo-heading"><span class="demo-tag">Measured results · Table 4</span><h3>Does Reverse Reward help beyond sampling more answers?</h3>
    <p>Reverse Reward ranks candidate solutions by <span class="decode-formula">P(y | x)<sup>1−λ</sup> · P(x | y)<sup>λ</sup></span>, the forward model’s likelihood combined with LEDOM’s probability of reconstructing the question. The paper reports no per-candidate scores, so this chart uses its twelve measured model–benchmark accuracies. Each mark shows how far a strategy lands from the chosen baseline.</p></div>
  <div class="demo-controls" data-rr-controls hidden><span class="coral-control-label" id="rr-baseline-label">Baseline</span>
    <div class="demo-options" role="group" aria-labelledby="rr-baseline-label">{_button('data-demo-action="rr-baseline" data-baseline="greedy"', "Greedy decoding", True)}{_button('data-demo-action="rr-baseline" data-baseline="random"', "Random pick (Best-of-N)", False)}</div></div>
  <div data-demo-state>
    <p class="rr-key" data-rr-key>{key}</p>
    <div class="rr-chart">
      <div class="rr-row rr-head"><span></span><span class="rr-axis-title" data-rr-axis>Accuracy minus {_e(_rr_label(baseline).lower())}, percentage points</span><span class="rr-value"><span>RR</span> <span>Best-of-N</span></span></div>
      {groups}
      <div class="rr-row rr-ticks-row" aria-hidden="true"><span></span><span class="rr-ticks">{ticks}</span><span></span></div>
    </div>
    <div class="decode-status rr-status" data-rr-summary role="status" aria-live="polite">{_rr_status_html(baseline)}</div>
    <p class="decode-caption" id="rr-table-caption">Table 4 as reported: accuracy (%). Bold marks the best value per model; shaded rows are the current baseline.</p>
    <div class="table-scroll" tabindex="0" role="region" aria-label="Table 4 accuracies">
      <table class="decode-table rr-table" aria-describedby="rr-table-caption">
        <thead><tr><th scope="col">Model and strategy</th>{headings}</tr></thead><tbody>{''.join(body)}</tbody></table></div>
    <p class="decode-note">Derived: every greedy, Reverse Reward and beam-search value in the AIME 2024 and AMC 2023 columns is a whole number of problems out of 30 or 40, consistent with the standard sets. QwenMath’s +6.6 points on AIME 2024 would then be 5 → 7 solved problems. The paper does not state set sizes, and most random-pick values (e.g. 8.97) are not whole-problem fractions.</p>
  </div>
  <p class="demo-provenance">Measured: <a href="{LEDOM_URL}#S6.T4">Table 4</a>, accuracy (%) for DeepSeekMath-7B, QwenMath-7B and OpenMath2-8B, with LEDOM fine-tuned on 100K OpenMathInstruct-2 examples as the reverse scorer (Appendix D.2). Derived: differences in percentage points. Table 4 and §6.5 state N = 64 candidates, while Appendix D.2.3 lists N = 4 for reranking and beams of k = 4 with n = 3 expansions. The paper does not report λ. The case studies in <a href="{LEDOM_URL}#A4.T7">Tables 7–8</a> give responses and orderings but no score values, and Figure 3 plots accuracy against N without numeric labels, so neither is reproduced as numbers here.</p>
</div>'''
