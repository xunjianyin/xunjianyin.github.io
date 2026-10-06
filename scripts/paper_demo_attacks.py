"""Evidence explorer for attack papers.

* lazy-grounding (EMNLP 2026, arXiv 2608.30303v2): the 12 agent-benchmark settings of
  Table 1 (clean and augmented accuracy, rewrite-answer adoption RAA, RAA-C / RAA-F; mean
  ± SD over three runs on 100 questions) and Table 7 (accuracy drop ± SD with a paired
  cluster-bootstrap 95% interval). The reader chooses a view (drop with interval, clean ->
  augmented accuracy, adoption by clean outcome), a row order, and a selected setting.

Every value is kept as the string printed in the paper. Counts, the mean drop, orderings,
the interval classification and the per-benchmark comparison are computed here and again,
identically, in papers/demos/attacks.js. The Python output is the complete no-script state.
No model or network call runs.
"""
from __future__ import annotations

from html import escape
import json
import math
from typing import Any

OWNED = {'lazy-grounding': 'lazy-grounding-settings'}
TAG_LABELS = {'measured': 'Measured', 'computed': 'Computed'}

MODELS: list[tuple[str, str]] = [
    ('tongyi', 'Tongyi Deep Research'), ('gpt5mini', 'GPT-5 Mini'), ('gemini', 'Gemini 3 Flash')]
BENCHMARKS: list[tuple[str, str]] = [
    ('xbench', 'XBench'), ('gaia', 'GAIA'), ('browsecomp', 'BrowseComp+'), ('hle', 'HLE')]

# One line per setting, in the paper's row order. Fields, each "mean SD" as printed:
# Table 1 clean | augmented | RAA | RAA-C | RAA-F ; Table 7 drop | 95% CI low high.
PRINTED = '''
tongyi xbench     | 69.3 2.1 | 52.0 6.1 | 27.0 5.6  | 20.7 5.5  | 41.3 9.8  | 17.3 6.8 | 10.7 24.0
tongyi gaia       | 66.0 6.6 | 57.3 0.6 | 17.7 3.1  | 14.1 3.0  | 24.5 4.0  | 8.7 7.0  | 1.0 16.3
tongyi browsecomp | 27.0 8.2 | 19.3 0.6 | 36.3 24.0 | 28.4 19.9 | 39.3 25.4 | 7.7 7.8  | 0.7 14.7
tongyi hle        | 28.7 6.1 | 26.7 5.1 | 17.7 3.1  | 25.6 4.8  | 14.5 2.5  | 2.0 1.0  | -5.0 9.0
gpt5mini xbench     | 65.0 6.0 | 52.7 1.5 | 23.0 3.6 | 19.0 3.2  | 30.5 14.0 | 12.3 4.5 | 5.7 19.0
gpt5mini gaia       | 59.0 4.4 | 53.3 5.8 | 22.0 9.6 | 14.7 7.5  | 32.5 13.1 | 5.7 1.5  | -2.7 14.0
gpt5mini browsecomp | 31.7 3.2 | 22.0 8.2 | 29.0 2.6 | 33.7 10.6 | 26.8 2.6  | 9.7 7.6  | 1.7 18.0
gpt5mini hle        | 30.7 5.5 | 24.3 3.1 | 15.0 2.6 | 13.0 3.1  | 15.9 2.7  | 6.3 3.5  | 1.3 11.7
gemini xbench     | 74.3 2.1 | 71.0 1.7 | 7.7 2.1  | 6.7 4.7  | 10.4 5.9 | 3.3 3.1  | -2.0 9.0
gemini gaia       | 62.3 8.5 | 57.0 4.6 | 10.7 3.1 | 9.6 2.4  | 12.4 4.4 | 5.3 6.7  | -1.0 11.7
gemini browsecomp | 43.0 6.1 | 52.3 2.3 | 5.0 2.6  | 6.2 3.0  | 4.1 4.2  | -9.3 3.8 | -17.0 -1.7
gemini hle        | 46.7 2.5 | 44.7 2.5 | 13.7 5.5 | 10.0 6.5 | 16.9 8.8 | 2.0 4.4  | -4.3 8.0
'''
FIELDS = ('clean', 'aug', 'raa', 'raac', 'raaf', 'drop')


def _settings() -> list[dict[str, Any]]:
    rows = []
    for line in PRINTED.strip().splitlines():
        head, *cells = [part.split() for part in line.split('|')]
        model, bench = head
        entry: dict[str, Any] = {'id': f'{model}-{bench}', 'model': model, 'bench': bench}
        for field, (mean, sd) in zip(FIELDS, cells[:6]):
            entry[field], entry[field + 'Sd'] = mean, sd
        entry['ciLow'], entry['ciHigh'] = cells[6]
        rows.append(entry)
    return rows


SETTINGS = _settings()

# Plot domains in tenths of a percentage point; ticks are labelled in whole units.
VIEWS: dict[str, dict[str, Any]] = {
    'drop': {'button': 'Accuracy drop', 'title': 'Accuracy drop with nearby evidence (pp), with its 95% interval',
             'domain': [-200, 250], 'ticks': [-200, -100, 0, 100, 200], 'unit': 'pp', 'sortBy': 'drop',
             'sortLabel': 'largest drop first'},
    'accuracy': {'button': 'Clean → augmented', 'title': 'Accuracy without and with nearby evidence (%)',
                 'domain': [0, 800], 'ticks': [0, 200, 400, 600, 800], 'unit': '%', 'sortBy': 'clean',
                 'sortLabel': 'highest clean accuracy first'},
    'adoption': {'button': 'Adoption by clean outcome', 'title': 'Nearby-answer adoption by clean outcome (%)',
                 'domain': [0, 500], 'ticks': [0, 100, 200, 300, 400, 500], 'unit': '%', 'sortBy': 'raa',
                 'sortLabel': 'highest RAA first'},
}
ORDERS = {'model': 'Grouped by model', 'benchmark': 'Grouped by benchmark', 'value': 'Largest first'}
DEFAULT = {'view': 'drop', 'order': 'model', 'selected': 'tongyi-xbench'}

KEYS = {
    'drop': ('Square: mean drop over three runs. Line: paired-bootstrap 95% interval. '
             'Positive values are accuracy lost; dark rows have an interval above zero, grey rows an interval '
             'that includes zero, warm rows an interval below zero.'),
    'accuracy': 'Hollow square: clean accuracy. Filled square: accuracy with nearby evidence. Warm rows gain accuracy.',
    'adoption': ('Hollow square: RAA-C, adoption on questions answered correctly without nearby evidence. '
                 'Filled square: RAA-F, on questions answered wrongly. Vertical tick: overall RAA. '
                 'Warm rows have higher adoption on the clean-correct questions.'),
}
CAPTIONS = {
    'drop': ('Table 7', 'Drop is clean minus augmented accuracy, mean ± SD over three runs; the interval is a paired '
             'cluster bootstrap over the 100 questions with 100,000 resamples.', 'interval classification and row order.'),
    'accuracy': ('Table 1', 'Mean accuracy over three runs; drops in the value column are from Table 7.',
                 'row order and the per-benchmark comparison.'),
    'adoption': ('Table 1', 'RAA is the share of augmented runs whose final answer is the nearby answer b; RAA-C and '
                 'RAA-F restrict it to questions the agent answered correctly or wrongly in the clean setting.',
                 'counts, extremes and row order.'),
}
CAUTIONS = {
    'drop': '',
    'accuracy': ('Table 7 computes drops from unrounded means, so a drop can differ by 0.1 from the rounded Table 1 '
                 'values (GPT-5 Mini on HLE: 30.7 − 24.3 = 6.4, printed drop 6.3). Differences between agents’ drops '
                 'are often smaller than their 95% intervals, so the ordering is descriptive.'),
    'adoption': 'Standard deviations are large on BrowseComp+ (Tongyi Deep Research: RAA 36.3 ± 24.0 over three runs).',
}


def _e(value: Any) -> str:
    return escape(str(value), quote=True)


def _minus(text: str) -> str:
    """Typographic minus for printed and computed numbers."""
    return str(text).replace('-', '−')


def _tenths(text: str) -> int:
    return int(math.floor(float(text) * 10 + 0.5))


def _fmt(tenths: int) -> str:
    sign = '−' if tenths < 0 else ''
    return f'{sign}{abs(tenths) // 10}.{abs(tenths) % 10}'


def _round_half_up(value: float) -> int:
    """Same rounding as JavaScript Math.round, so Python and browser text agree."""
    return int(math.floor(value + 0.5))


def _join(items: list[str]) -> str:
    if len(items) < 3:
        return ' and '.join(items)
    return ', '.join(items[:-1]) + ', and ' + items[-1]


def _tag(kind: str, reference: str = '') -> str:
    text = TAG_LABELS[kind] + (f' · {reference}' if reference else '')
    return f'<span class="at-tag at-tag-{_e(kind)}">{_e(text)}</span>'


MODEL_NAMES = dict(MODELS)
BENCH_NAMES = dict(BENCHMARKS)
MODEL_INDEX = {key: i for i, (key, _) in enumerate(MODELS)}
BENCH_INDEX = {key: i for i, (key, _) in enumerate(BENCHMARKS)}
PAPER_INDEX = {s['id']: i for i, s in enumerate(SETTINGS)}


def _name(s: dict[str, Any]) -> str:
    return f'{MODEL_NAMES[s["model"]]} on {BENCH_NAMES[s["bench"]]}'


def _status(s: dict[str, Any]) -> str:
    """Where the paired-bootstrap interval lies relative to zero."""
    if _tenths(s['ciLow']) > 0:
        return 'above'
    if _tenths(s['ciHigh']) < 0:
        return 'below'
    return 'spans'


def _ordered(view: str, order: str) -> list[dict[str, Any]]:
    if order == 'model':
        key = lambda s: (MODEL_INDEX[s['model']], BENCH_INDEX[s['bench']])
    elif order == 'benchmark':
        key = lambda s: (BENCH_INDEX[s['bench']], MODEL_INDEX[s['model']])
    else:
        field = VIEWS[view]['sortBy']
        key = lambda s: (-_tenths(s[field]), PAPER_INDEX[s['id']])
    return sorted(SETTINGS, key=key)


def _pct(tenths: int, view: str) -> str:
    low, high = VIEWS[view]['domain']
    return f'{(tenths - low) / (high - low) * 100:.2f}%'


def _span(a: int, b: int, view: str, cls: str) -> str:
    low, high = VIEWS[view]['domain']
    left, right = min(a, b), max(a, b)
    return f'<i class="{cls}" style="left:{_pct(left, view)};width:{(right - left) / (high - low) * 100:.2f}%"></i>'


def _marks(s: dict[str, Any], view: str) -> str:
    grid = ''.join(f'<i class="at-grid{" at-zero" if t == 0 else ""}" style="left:{_pct(t, view)}"></i>'
                   for t in VIEWS[view]['ticks'])
    if view == 'drop':
        body = (_span(_tenths(s['ciLow']), _tenths(s['ciHigh']), view, 'at-line')
                + f'<i class="at-mark at-fill" style="left:{_pct(_tenths(s["drop"]), view)}"></i>')
    elif view == 'accuracy':
        clean, aug = _tenths(s['clean']), _tenths(s['aug'])
        body = (_span(clean, aug, view, 'at-line') + f'<i class="at-mark at-hollow" style="left:{_pct(clean, view)}"></i>'
                f'<i class="at-mark at-fill" style="left:{_pct(aug, view)}"></i>')
    else:
        c, f = _tenths(s['raac']), _tenths(s['raaf'])
        body = (_span(c, f, view, 'at-line') + f'<i class="at-tick" style="left:{_pct(_tenths(s["raa"]), view)}"></i>'
                f'<i class="at-mark at-hollow" style="left:{_pct(c, view)}"></i>'
                f'<i class="at-mark at-fill" style="left:{_pct(f, view)}"></i>')
    return f'<span class="at-track" aria-hidden="true"><span class="at-plot">{grid}{body}</span></span>'


def _value(s: dict[str, Any], view: str) -> tuple[str, str]:
    if view == 'drop':
        return _minus(s['drop']), f'[{_minus(s["ciLow"])}, {_minus(s["ciHigh"])}]'
    if view == 'accuracy':
        return f'{s["clean"]} → {s["aug"]}', f'drop {_minus(s["drop"])}'
    return f'{s["raac"]} / {s["raaf"]}', f'RAA {s["raa"]}'


def _row_class(s: dict[str, Any], view: str, selected: str) -> str:
    if view == 'drop':
        state = f'is-{_status(s)}'
    elif view == 'accuracy':
        state = 'is-gain' if _tenths(s['aug']) > _tenths(s['clean']) else 'is-loss'
    else:
        state = 'is-f-higher' if _tenths(s['raaf']) > _tenths(s['raac']) else 'is-c-higher'
    return f'at-row {state}' + (' is-selected' if s['id'] == selected else '')


def _row_inner(s: dict[str, Any], view: str) -> str:
    main, sub = _value(s, view)
    return (f'<span class="at-row-name">{_e(MODEL_NAMES[s["model"]])}<small>{_e(BENCH_NAMES[s["bench"]])}</small></span>'
            f'{_marks(s, view)}<span class="at-row-value"><strong>{_e(main)}</strong> <small>{_e(sub)}</small></span>')


def _axis(view: str) -> str:
    low, high = VIEWS[view]['domain']
    labels = []
    for i, t in enumerate(VIEWS[view]['ticks']):
        edge = ' is-first' if i == 0 and t == low else ' is-last' if t == high else ''
        labels.append(f'<span class="at-axis-label{edge}" style="left:{_pct(t, view)}">{_e(_minus(str(t // 10)))}</span>')
    return (f'<div class="at-axis" aria-hidden="true"><span class="at-axis-spacer"></span>'
            f'<span class="at-axis-track"><span class="at-plot">{"".join(labels)}</span></span>'
            f'<span class="at-axis-unit">{_e(VIEWS[view]["unit"])}</span></div>')


def _detail(s: dict[str, Any]) -> str:
    rows = [
        ('Clean accuracy', f'{s["clean"]} ± {s["cleanSd"]}'),
        ('With nearby evidence', f'{s["aug"]} ± {s["augSd"]}'),
        ('Accuracy drop', f'{_minus(s["drop"])} ± {s["dropSd"]} pp'),
        ('95% interval of the drop', f'[{_minus(s["ciLow"])}, {_minus(s["ciHigh"])}]'),
        ('RAA', f'{s["raa"]} ± {s["raaSd"]}'),
        ('RAA-C / RAA-F', f'{s["raac"]} ± {s["raacSd"]} / {s["raaf"]} ± {s["raafSd"]}'),
    ]
    items = ''.join(f'<div><dt>{_e(label)}</dt><dd>{_e(value)}</dd></div>' for label, value in rows)
    return (f'<div class="at-detail" data-at-detail><h4>{_e(_name(s))}</h4><dl>{items}</dl>'
            f'<p class="at-caption">{_tag("measured", "Tables 1 and 7")} Percent unless marked pp; '
            f'mean ± SD over three clean and three augmented runs on 100 questions.</p></div>')


def results_html(view: str, order: str, selected: str) -> str:
    """The plotted rows, their key and captions, and the selected setting's printed values."""
    current = VIEWS[view]
    order_label = current['sortLabel'] if order == 'value' else ORDERS[order].lower()
    rows = ''.join(f'<li><div class="{_row_class(s, view, selected)}" data-setting="{_e(s["id"])}">{_row_inner(s, view)}</div></li>'
                   for s in _ordered(view, order))
    table, measured, computed = CAPTIONS[view]
    caution = f'<p class="at-caution">{_e(CAUTIONS[view])}</p>' if CAUTIONS[view] else ''
    chosen = next(s for s in SETTINGS if s['id'] == selected)
    return (f'<div class="at-block"><h4 data-at-view-title>{_e(current["title"])} · {_e(order_label)}</h4>'
            f'<p class="at-key">{_e(KEYS[view])}</p>{_axis(view)}'
            f'<ol class="at-rows" aria-label="{_e(current["title"])}">{rows}</ol>'
            f'<p class="at-caption">{_tag("measured", table)} {_e(measured)} {_tag("computed")} {_e(computed)}</p>{caution}</div>'
            f'{_detail(chosen)}')


def verdict_text(view: str, selected: str) -> str:
    """Summary sentence computed from the printed values; repeated in attacks.js."""
    chosen = next(s for s in SETTINGS if s['id'] == selected)
    drops = [_tenths(s['drop']) for s in SETTINGS]
    if view == 'drop':
        falls = sum(d > 0 for d in drops)
        mean = _fmt(_round_half_up(sum(drops) / len(drops)))
        groups = {key: [s for s in SETTINGS if _status(s) == key] for key in ('above', 'spans', 'below')}
        below = f' ({"; ".join(_name(s) for s in groups["below"])})' if groups['below'] else ''
        status = {'above': 'lies above zero', 'spans': 'includes zero',
                  'below': 'lies below zero, an accuracy gain'}[_status(chosen)]
        return (f'Accuracy falls in {falls} of {len(SETTINGS)} settings; the mean of the {len(SETTINGS)} printed drops '
                f'is {mean} pp. The 95% interval lies above zero in {len(groups["above"])}, includes zero in '
                f'{len(groups["spans"])}, and lies below zero in {len(groups["below"])}{below}. Selected: '
                f'{_name(chosen)}, drop {_minus(chosen["drop"])} pp, interval [{_minus(chosen["ciLow"])}, '
                f'{_minus(chosen["ciHigh"])}], which {status}.')
    if view == 'accuracy':
        bench = chosen['bench']
        peers = sorted((s for s in SETTINGS if s['bench'] == bench),
                       key=lambda s: (-_tenths(s['clean']), PAPER_INDEX[s['id']]))
        listed = ', '.join(f'{MODEL_NAMES[s["model"]]} {s["clean"]}% (drop {_minus(s["drop"])} pp)' for s in peers)
        peer_drops = [_tenths(s['drop']) for s in peers]
        top = _tenths(peers[0]['drop'])
        if top == min(peer_drops):
            relation = 'shares the smallest drop' if peer_drops.count(top) > 1 else 'has the smallest drop'
        elif top == max(peer_drops):
            relation = 'has the largest drop'
        else:
            relation = 'has neither the smallest nor the largest drop'
        lower = sum(_tenths(s['aug']) < _tenths(s['clean']) for s in SETTINGS)
        return (f'On {BENCH_NAMES[bench]}, ordered by clean accuracy: {listed}. The most accurate agent without nearby '
                f'evidence {relation} on this benchmark. Accuracy is lower with nearby evidence in {lower} of '
                f'{len(SETTINGS)} settings.')
    raa = sorted(SETTINGS, key=lambda s: (_tenths(s['raa']), PAPER_INDEX[s['id']]))
    positive = sum(_tenths(s['raa']) > 0 for s in SETTINGS)
    exceptions = [s for s in SETTINGS if _tenths(s['raaf']) <= _tenths(s['raac'])]
    listed = _join([f'{_name(s)} (RAA-C {s["raac"]}%, RAA-F {s["raaf"]}%)' for s in exceptions])
    tail = f'; the exceptions are {listed}.' if exceptions else '.'
    return (f'Nearby-answer adoption is above zero in {positive} of {len(SETTINGS)} settings, from {raa[0]["raa"]}% '
            f'({_name(raa[0])}) to {raa[-1]["raa"]}% ({_name(raa[-1])}). RAA-F exceeds RAA-C in '
            f'{len(SETTINGS) - len(exceptions)} of {len(SETTINGS)} settings{tail} Selected: {_name(chosen)}, RAA '
            f'{chosen["raa"]}%, RAA-C {chosen["raac"]}%, RAA-F {chosen["raaf"]}%.')


def _button(action: str, label: str, pressed: bool) -> str:
    return (f'<button type="button" data-demo-action="{_e(action)}" aria-pressed="{str(pressed).lower()}">'
            f'{_e(label)}</button>')


def _controls() -> str:
    views = ''.join(_button(f'view:{key}', view['button'], key == DEFAULT['view']) for key, view in VIEWS.items())
    orders = ''.join(_button(f'order:{key}', label, key == DEFAULT['order']) for key, label in ORDERS.items())
    return (f'<div class="at-button-row" role="group" aria-label="Show"><span class="at-group-label" aria-hidden="true">Show</span>{views}</div>'
            f'<div class="at-button-row" role="group" aria-label="Order"><span class="at-group-label" aria-hidden="true">Order</span>{orders}</div>'
            '<p class="at-help">Select a row to read all of its printed values. In the accuracy view, the summary '
            'compares the three agents on the selected row’s benchmark.</p>')


def config() -> dict[str, Any]:
    return {'settings': SETTINGS, 'models': dict(MODELS), 'benchmarks': dict(BENCHMARKS),
            'modelOrder': [k for k, _ in MODELS], 'benchOrder': [k for k, _ in BENCHMARKS],
            'views': VIEWS, 'orders': ORDERS, 'keys': KEYS, 'captions': CAPTIONS, 'cautions': CAUTIONS,
            'default': DEFAULT}


def render_demo(slug: str, insight: dict[str, Any]) -> str:
    demo = insight.get('demo') or {}
    kind = demo.get('kind') or demo.get('type')
    if OWNED.get(slug) != kind:
        return ''
    encoded = json.dumps(config(), ensure_ascii=False).replace('<', '\\u003c')
    links = ''.join(f'<a href="{_e(item["url"])}">{_e(item["label"])} ↗</a>' for item in demo.get('sources', []))
    sources = f'<span class="at-source-links">{links}</span>' if links else ''
    view, order, selected = DEFAULT['view'], DEFAULT['order'], DEFAULT['selected']
    return f'''<section class="paper-demo attacks-demo" data-paper-demo="{_e(slug)}" data-attacks-demo="{_e(kind)}" aria-labelledby="{_e(slug)}-demo-title">
      <header class="at-heading"><p class="at-kicker">{_e(demo.get("eyebrow", "Measured"))}</p><h3 id="{_e(slug)}-demo-title">{_e(demo["title"])}</h3><p>{_e(demo["description"])}</p></header>
      <div class="at-controls" data-demo-controls hidden>{_controls()}</div>
      <div class="at-state" data-demo-state><div class="at-results" data-at-results>{results_html(view, order, selected)}</div><p class="at-verdict" role="status" aria-live="polite" data-at-verdict>{_e(verdict_text(view, selected))}</p></div>
      <p class="at-disclosure">{_e(demo["note"])}{sources}</p>
      <script type="application/json" class="at-config">{encoded}</script>
    </section>'''
