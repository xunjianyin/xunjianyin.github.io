"""Evidence explorer for "Human-like Summarization Evaluation with ChatGPT" (arXiv 2304.02554).

The page `chatgpt-summarization-evaluation` asks where ChatGPT (gpt-3.5-turbo-0301) leads the
automatic metrics. Every value below is copied as printed from Tables 1-5 of arXiv v1
(LaTeX source emnlp2023.tex, lines 236-341; PDF page 4):

* Table 1 (SummEval) and Table 2 (Newsroom): Spearman rho with human Likert scores at sample,
  system and dataset level, four dimensions each.
* Table 3 (TLDR, pairwise comparison), Table 4 (REALSumm, binary SCU presence) and Table 5
  (QAGS_CNN and QAGS_XSUM, binary factuality): accuracy against human labels.

The reader picks one column (dataset, dimension, level). Computed from the printed values:
the ranking, ChatGPT's rank, and its margin over the strongest other row, for the chosen column
and for all 28 columns at once. Values are integers in units of 1e-4 so that Python and
`papers/demos/summeval.js` produce identical text. Margins in correlation are printed to three
decimals; accuracy margins are percentage points. No model or network call runs.
"""
from __future__ import annotations

from html import escape
import json
import math
from typing import Any

SLUG = 'chatgpt-summarization-evaluation'
KIND = 'chatgpt-vs-metrics'
LEVELS = ['sample', 'system', 'dataset']
UNIT = 10000  # printed values have three or four decimals

# Rows in printed order. Likert rows hold 12 values: dimension-major, then sample/system/dataset.
DATASETS: list[dict[str, Any]] = [
    {
        'id': 'summeval', 'name': 'SummEval', 'table': 'Table 1', 'kind': 'rho',
        'protocol': 'Likert scale scoring',
        'judged': 'Each summary is rated 1–5 on four dimensions in one prompt (Figure 1); the score is Spearman ρ with the human ratings.',
        'dims': ['Consistency', 'Relevance', 'Fluency', 'Coherence'],
        'rows': [
            ('ROUGE-1', '0.153 0.744 0.137 0.326 0.744 0.302 0.113 0.730 0.080 0.167 0.506 0.184'),
            ('ROUGE-2', '0.179 0.779 0.129 0.290 0.621 0.245 0.156 0.690 0.062 0.184 0.335 0.145'),
            ('ROUGE-L', '0.111 0.112 0.109 0.311 0.362 0.284 0.103 0.306 0.079 0.128 0.138 0.141'),
            ('BERTScore', '0.105 -0.077 0.118 0.312 0.324 0.362 0.189 0.246 0.150 0.284 0.477 0.317'),
            ('MoverScore', '0.151 0.679 0.150 0.318 0.724 0.294 0.126 0.687 0.119 0.159 0.474 0.178'),
            ('BARTScore_s_h', '0.299 0.800 0.269 0.264 0.524 0.363 0.243 0.614 0.187 0.322 0.477 0.335'),
            ('BARTScore_h_r', '0.097 0.606 0.101 0.178 0.147 0.246 0.002 0.261 0.000 0.017 -0.115 0.064'),
            ('BARTScore_r_h', '-0.075 -0.556 -0.090 -0.081 -0.112 -0.136 0.013 -0.212 0.019 0.044 0.165 -0.010'),
            ('BARTScore_cnn_s_h', '0.367 0.435 0.334 0.356 0.765 0.394 0.349 0.746 0.285 0.448 0.700 0.408'),
            ('BARTScore_cnn_h_r', '0.171 0.771 0.106 0.320 0.456 0.244 0.111 0.561 0.066 0.153 0.174 0.130'),
            ('BARTScore_cnn_r_h', '0.001 -0.079 -0.004 0.146 0.312 0.221 0.107 0.297 0.145 0.228 0.506 0.236'),
            ('ChatGPT', '0.435 0.833 0.425 0.433 0.901 0.445 0.419 0.889 0.410 0.561 0.832 0.557'),
        ],
    },
    {
        'id': 'newsroom', 'name': 'Newsroom', 'table': 'Table 2', 'kind': 'rho',
        'protocol': 'Likert scale scoring',
        'judged': 'Each summary is rated 1–5 on four dimensions in one prompt (Figure 1); the score is Spearman ρ with the human ratings.',
        'dims': ['Coherence', 'Fluency', 'Informativeness', 'Relevance'],
        'rows': [
            ('ROUGE-1', '0.095 0.429 0.100 0.104 0.429 0.064 0.130 0.286 0.149 0.147 0.357 0.122'),
            ('ROUGE-2', '0.025 0.321 0.080 0.047 0.321 0.045 0.078 0.250 0.158 0.090 0.357 0.124'),
            ('ROUGE-L', '0.064 0.357 0.079 0.072 0.357 0.045 0.089 0.214 0.137 0.106 0.321 0.101'),
            ('BERTScore', '0.148 0.429 0.169 0.170 0.429 0.154 0.131 0.286 0.196 0.163 0.357 0.176'),
            ('MoverScore', '0.162 0.429 0.173 0.120 0.429 0.112 0.188 0.286 0.232 0.195 0.357 0.192'),
            ('BARTScore_s_h', '0.679 0.964 0.656 0.670 0.964 0.615 0.646 0.821 0.645 0.604 0.893 0.588'),
            ('BARTScore_h_r', '0.329 0.286 0.302 0.292 0.286 0.261 0.419 0.429 0.386 0.363 0.357 0.386'),
            ('BARTScore_r_h', '-0.311 -0.571 -0.249 -0.215 -0.571 -0.232 -0.423 -0.750 -0.346 -0.334 -0.607 -0.305'),
            ('BARTScore_cnn_s_h', '0.653 0.893 0.623 0.640 0.893 0.596 0.616 0.750 0.592 0.567 0.786 0.557'),
            ('BARTScore_cnn_h_r', '0.239 0.429 0.215 0.235 0.429 0.165 0.284 0.429 0.239 0.267 0.464 0.221'),
            ('BARTScore_cnn_r_h', '0.316 0.429 0.333 0.353 0.429 0.330 0.242 0.286 0.289 0.245 0.357 0.292'),
            ('ChatGPT', '0.484 0.821 0.476 0.480 0.607 0.471 0.521 0.607 0.508 0.524 0.714 0.521'),
        ],
    },
    {
        'id': 'tldr', 'name': 'TLDR', 'table': 'Table 3', 'kind': 'acc',
        'protocol': 'Pairwise comparison',
        'judged': 'Which of two summaries of the same article is better (Figure 2); the score is accuracy against the human choice.',
        'dims': [],
        'rows': [
            ('ROUGE-1', '0.5869'), ('ROUGE-2_f', '0.4997'), ('ROUGE-L_f', '0.5647'), ('BARTScore', '0.5674'),
            ('MoverScore', '0.5864'), ('BARTScore_s_h', '0.5858'), ('BARTScore_h_r', '0.6151'),
            ('BARTScore_r_h', '0.5317'), ('BARTScore_cnn_s_h', '0.5880'), ('BARTScore_cnn_h_r', '0.5934'),
            ('BARTScore_cnn_r_h', '0.5089'), ('ChatGPT', '0.6178'),
        ],
    },
    {
        'id': 'realsumm', 'name': 'REALSumm', 'table': 'Table 4', 'kind': 'acc',
        'protocol': 'Pyramid',
        'judged': 'Whether each semantic content unit (SCU) of the reference can be inferred from the summary (Figure 3); the score is accuracy against the human SCU labels.',
        'dims': [],
        'rows': [('DAE', '0.6304'), ('FactCC', '0.5362'), ('ChatGPT', '0.6436')],
    },
    {
        'id': 'qags-cnn', 'name': 'QAGS_CNN', 'table': 'Table 5', 'kind': 'acc',
        'protocol': 'Binary factuality evaluation',
        'judged': 'Whether one summary sentence is supported by the article (Figure 4); the score is accuracy against the human labels.',
        'dims': [],
        'rows': [('DAE', '0.8459'), ('FactCC', '0.7731'), ('ChatGPT', '0.8488')],
    },
    {
        'id': 'qags-xsum', 'name': 'QAGS_XSUM', 'table': 'Table 5', 'kind': 'acc',
        'protocol': 'Binary factuality evaluation',
        'judged': 'Whether one summary sentence is supported by the article (Figure 4); the score is accuracy against the human labels.',
        'dims': [],
        'rows': [('DAE', '0.6360'), ('FactCC', '0.4937'), ('ChatGPT', '0.7573')],
    },
]
# Statements about a dataset or one of its dimensions that the reader should see beside the column.
CAUTIONS: dict[str, str] = {
    'summeval:Consistency': ('The prompt called this dimension faithfulness, because it gave no definitions '
                             '(footnote 5); Table 1 keeps SummEval’s term, consistency.'),
    'tldr': ('Table 3 prints a row named BARTScore where Tables 1 and 2 list BERTScore, in addition to the six '
             'BARTScore variants; it is shown as printed. The paper does not say how each metric’s scores were '
             'turned into a choice between the two summaries.'),
    'realsumm': ('The paper does not say how DAE and FactCC, which label each summary sentence as factually '
                 'correct or not (Section 2.1), were applied to SCU presence.'),
}
DEFAULT = {'dataset': 'summeval', 'dim': 0, 'level': 0}
# Color key under the bars; the words carry the meaning, the swatches repeat it.
KEY = ('<p class="se-key"><span><i class="se-swatch is-chatgpt" aria-hidden="true"></i>ChatGPT</span>'
       '<span><i class="se-swatch is-best" aria-hidden="true"></i>Strongest other row</span></p>')


def _e(value: Any) -> str:
    return escape(str(value), quote=True)


def _minus(text: str) -> str:
    """Typographic minus for printed and computed numbers."""
    return text.replace('-', '−')


def _units(text: str) -> int:
    return int(round(float(text) * UNIT))


def row_group(name: str) -> str:
    """Short description of each evaluator family, following Section 2.1."""
    if name.startswith('ROUGE'):
        return 'n-gram overlap'
    if name in ('BERTScore', 'MoverScore'):
        return 'embedding similarity'
    if name.startswith('BARTScore'):
        return 'BART generation likelihood'
    if name in ('DAE', 'FactCC'):
        return 'factuality classifier'
    return 'gpt-3.5-turbo-0301, zero-shot prompt'


def columns() -> list[dict[str, Any]]:
    """All 28 printed columns: 12 per Likert dataset, one per accuracy dataset."""
    result = []
    for data in DATASETS:
        if data['dims']:
            for d, dim in enumerate(data['dims']):
                for l, level in enumerate(LEVELS):
                    result.append({'id': f'{data["id"]}:{d}:{l}', 'dataset': data['id'], 'dim': d, 'level': l,
                                   'index': d * 3 + l, 'label': f'{dim} · {level} level'})
        else:
            result.append({'id': f'{data["id"]}:0:0', 'dataset': data['id'], 'dim': 0, 'level': 0, 'index': 0,
                           'label': 'Accuracy'})
    return result


def _dataset(dataset_id: str) -> dict[str, Any]:
    return next(d for d in DATASETS if d['id'] == dataset_id)


def column_values(column: dict[str, Any]) -> list[tuple[str, str]]:
    """(row name, printed value) for one column, in printed order."""
    return [(name, text.split()[column['index']]) for name, text in _dataset(column['dataset'])['rows']]


def signed(diff: int, kind: str) -> str:
    """Signed margin: correlation to three decimals, accuracy in percentage points."""
    sign = '+' if diff > 0 else '−' if diff < 0 else '±'
    return f'{sign}{abs(diff) / UNIT:.3f}' if kind == 'rho' else f'{sign}{abs(diff) / 100:.2f} pp'


def magnitude(diff: int, kind: str) -> str:
    """Unsigned margin for prose: 0.033, or 1.32 pp."""
    return f'{abs(diff) / UNIT:.3f}' if kind == 'rho' else f'{abs(diff) / 100:.2f} pp'


def assess(column: dict[str, Any]) -> dict[str, Any]:
    """ChatGPT's rank among the printed rows and its margin over the strongest other row."""
    values = column_values(column)
    chat = _units(dict(values)['ChatGPT'])
    others = [(name, text) for name, text in values if name != 'ChatGPT']
    best_name, best_text = max(others, key=lambda item: _units(item[1]))  # first printed wins a tie
    above = [(name, text) for name, text in others if _units(text) > chat]
    above.sort(key=lambda item: -_units(item[1]))
    return {'rank': len(above) + 1, 'n': len(values), 'chat': dict(values)['ChatGPT'], 'best': best_name,
            'best_value': best_text, 'diff': chat - _units(best_text), 'above': above}


def column_label(column: dict[str, Any]) -> str:
    data = _dataset(column['dataset'])
    return f'{data["name"]} · {column["label"]}' if data['dims'] else f'{data["name"]} · {data["protocol"]}'


def tie_note(column: dict[str, Any]) -> str:
    """Values printed by three or more rows of one column."""
    counts: dict[int, list[str]] = {}
    for _, text in column_values(column):
        counts.setdefault(_units(text), []).append(text)
    shared = sorted(((len(texts), texts[0]) for texts in counts.values() if len(texts) >= 3), key=lambda item: -item[0])
    if not shared:
        return ''
    parts = ', '.join(f'{count} rows print {_minus(text)}' for count, text in shared)
    return f'Ties as printed: {parts}.'


def scoreboard() -> dict[str, Any]:
    cells = []
    for column in columns():
        result = assess(column)
        cells.append({'id': column['id'], 'dataset': column['dataset'], 'diff': result['diff']})
    leads = [c for c in cells if c['diff'] > 0]
    trails = [c for c in cells if c['diff'] < 0]
    return {'cells': cells, 'leads': len(leads), 'trails': len(trails), 'total': len(cells),
            'trail_datasets': [d['name'] for d in DATASETS if any(c['dataset'] == d['id'] for c in trails)],
            'trail_counts': {d['name']: sum(1 for c in trails if c['dataset'] == d['id']) for d in DATASETS}}


def verdict(column: dict[str, Any]) -> str:
    data = _dataset(column['dataset'])
    result = assess(column)
    text = f'{column_label(column)} ({data["table"]}). ChatGPT {_minus(result["chat"])} ranks {result["rank"]} of {result["n"]}. '
    if result['diff'] > 0:
        text += (f'The strongest other row is {result["best"]} at {_minus(result["best_value"])}, so ChatGPT leads by '
                 f'{magnitude(result["diff"], data["kind"])}. ')
    elif result['diff'] == 0:
        text += f'ChatGPT ties {result["best"]} at {_minus(result["best_value"])}. '
    else:
        listed = ', '.join(f'{name} {_minus(value)}' for name, value in result['above'])
        count = len(result['above'])
        text += (f'{count} row{"s" if count != 1 else ""} score{"" if count != 1 else "s"} higher: {listed}; '
                 f'ChatGPT is {magnitude(result["diff"], data["kind"])} below the top row. ')
    board = scoreboard()
    text += (f'Across all {board["total"]} columns, ChatGPT is ahead of the strongest other row in {board["leads"]} '
             f'and behind it in {board["trails"]}')
    if board['trails']:
        counts = [f'{name} {board["trail_counts"][name]}' for name in board['trail_datasets']]
        text += f' ({", ".join(counts)}).' if len(counts) > 1 else f', all of them on {board["trail_datasets"][0]}.'
    else:
        text += '.'
    return text


def bars(column: dict[str, Any]) -> str:
    """Every printed row of the column, highest first; ChatGPT and the strongest other row marked."""
    data = _dataset(column['dataset'])
    values = column_values(column)
    order = [name for name, _ in values]
    ranked = sorted(values, key=lambda item: (-_units(item[1]), order.index(item[0])))
    numbers = [_units(text) for _, text in values]
    low = min(0, math.floor(min(numbers) / 1000) * 1000)
    high = max(1000, math.ceil(max(numbers) / 1000) * 1000)
    span = high - low
    best = assess(column)['best']

    def pct(value: int) -> str:
        return f'{(value - low) / span * 100:.2f}%'

    rows = []
    for name, text in ranked:
        value = _units(text)
        left, right = sorted([0, value])
        classes = 'se-bar-row' + (' is-chatgpt' if name == 'ChatGPT' else ' is-best' if name == best else '')
        rows.append(
            f'<li class="{classes}" data-row="{_e(name)}"><span class="se-bar-name">{_e(name)}<small>{_e(row_group(name))}</small></span>'
            f'<span class="se-bar-track" aria-hidden="true"><i class="se-bar-zero" style="left:{pct(0)}"></i>'
            f'<i class="se-bar-fill" style="left:{pct(left)};width:{(right - left) / span * 100:.2f}%"></i></span>'
            f'<span class="se-bar-value" data-value="{_e(name)}">{_minus(text)}</span></li>')
    title = column_label(column) + (' · Spearman ρ' if data['kind'] == 'rho' else ' · accuracy')
    notes = [KEY, f'<p class="se-caption"><span class="se-tag se-tag-measured">Measured · {_e(data["table"])}</span> '
             f'{_e(data["judged"])}</p>']
    caution = CAUTIONS.get(f'{data["id"]}:{data["dims"][column["dim"]]}' if data['dims'] else data['id'], '')
    if caution:
        notes.append(f'<p class="se-caution" data-se-caution>{_e(caution)}</p>')
    ties = tie_note(column)
    if ties:
        notes.append(f'<p class="se-caption" data-se-ties>{_e(ties)}</p>')
    if data['id'] == 'tldr':
        lowest, highest = min(values, key=lambda item: _units(item[1]))[1], max(values, key=lambda item: _units(item[1]))[1]
        notes.append(f'<p class="se-caption"><span class="se-tag se-tag-derived">Derived</span> Picking one of two summaries '
                     f'at random is right half the time in expectation, so 0.5 is chance level; the printed accuracies '
                     f'range from {lowest} to {highest}.</p>')
    return (f'<div class="se-block se-chart"><h4 data-se-title>{_e(title)}</h4>'
            f'<p class="se-axis" aria-hidden="true"><span>{_minus(f"{low / UNIT:.1f}")}</span><span>{_minus(f"{high / UNIT:.1f}")}</span></p>'
            f'<ol class="se-bars" aria-label="{_e(title)}, highest first">{"".join(rows)}</ol>{"".join(notes)}</div>')


def grid(current: str) -> str:
    """ChatGPT minus the strongest other row in every printed column. Static cells are text;
    the browser script turns them into buttons that open the column."""
    def cell(column: dict[str, Any], label: str) -> str:
        data = _dataset(column['dataset'])
        diff = assess(column)['diff']
        classes = 'se-cell' + (' is-behind' if diff < 0 else ' is-tie' if diff == 0 else '') + (' is-current' if column['id'] == current else '')
        return (f'<span class="{classes}" data-se-col="{column["id"]}"><span class="se-cell-label">{_e(label)}</span>'
                f'<strong>{signed(diff, data["kind"])}</strong></span>')

    by_id = {c['id']: c for c in columns()}
    blocks = []
    for data in DATASETS:
        if not data['dims']:
            continue
        head = ''.join(f'<th scope="col">{_e(level.capitalize())}</th>' for level in LEVELS)
        prefix = data['id']
        body = ''.join(
            f'<tr><th scope="row">{_e(dim)}</th>'
            + ''.join(f'<td>{cell(by_id[f"{prefix}:{d}:{l}"], f"{dim}, {level} level")}</td>' for l, level in enumerate(LEVELS))
            + '</tr>' for d, dim in enumerate(data['dims']))
        blocks.append(f'<div class="se-matrix-wrap"><table class="se-matrix"><caption>{_e(data["name"])} · {_e(data["table"])} · Spearman ρ</caption>'
                      f'<thead><tr><td></td>{head}</tr></thead><tbody>{body}</tbody></table></div>')
    singles = ''.join(
        f'<li><span class="se-single-name">{_e(data["name"])}<small>{_e(data["table"])} · {_e(data["protocol"])}</small></span>'
        f'{cell(by_id[data["id"] + ":0:0"], "Accuracy")}</li>' for data in DATASETS if not data['dims'])
    board = scoreboard()
    return (f'<div class="se-block se-board"><h4>ChatGPT minus the strongest other row, all {board["total"]} columns</h4>'
            f'<div class="se-matrices">{"".join(blocks)}</div><ul class="se-singles">{singles}</ul>'
            f'<p class="se-caption"><span class="se-tag se-tag-computed">Computed</span> from the printed values: '
            f'correlation margins in Spearman ρ, accuracy margins in percentage points (pp). Warm cells are columns '
            f'where a metric is ahead of ChatGPT: {board["trails"]} of {board["total"]}.</p></div>')


def state(column_id: str) -> tuple[str, str]:
    column = next(c for c in columns() if c['id'] == column_id)
    return grid(column_id) + bars(column), verdict(column)


def _button(action: str, label: str, pressed: bool) -> str:
    return f'<button type="button" data-demo-action="{_e(action)}" aria-pressed="{str(pressed).lower()}">{_e(label)}</button>'


def _group(label: str, buttons: str, extra: str = '') -> str:
    return (f'<div class="se-button-row" role="group" aria-label="{_e(label)}"{extra}>'
            f'<span class="se-group-label" aria-hidden="true">{_e(label)}</span>{buttons}</div>')


def render_demo(slug: str, insight: dict[str, Any]) -> str:
    """Render the explorer for the owned page, or '' for every other page."""
    if slug != SLUG:
        return ''
    demo = insight.get('demo') or {}
    if demo.get('kind') != KIND:
        return ''
    default = DATASETS[0]
    column_id = f'{DEFAULT["dataset"]}:{DEFAULT["dim"]}:{DEFAULT["level"]}'
    datasets = ''.join(_button(f'dataset:{d["id"]}', d['name'], d['id'] == DEFAULT['dataset']) for d in DATASETS)
    dims = ''.join(_button(f'dim:{i}', dim, i == DEFAULT['dim']) for i, dim in enumerate(default['dims']))
    levels = ''.join(_button(f'level:{i}', f'{level.capitalize()} level', i == DEFAULT['level']) for i, level in enumerate(LEVELS))
    controls = (_group('Dataset', datasets) + _group('Dimension', dims, ' data-se-dims')
                + _group('Correlation level', levels, ' data-se-levels')
                + '<p class="se-help">SummEval and Newsroom print Spearman ρ for four dimensions at three levels; the '
                  'other datasets print one accuracy each. Select a cell of the grid to open that column.</p>')
    results, text = state(column_id)
    config = {
        'datasets': [{**d, 'rows': [[name, values.split()] for name, values in d['rows']]} for d in DATASETS],
        'levels': LEVELS, 'cautions': CAUTIONS, 'default': column_id,
        'groups': {name: row_group(name) for d in DATASETS for name, _ in d['rows']},
    }
    encoded = json.dumps(config, ensure_ascii=False).replace('<', '\\u003c')
    links = ''.join(f'<a href="{_e(item["url"])}">{_e(item["label"])} ↗</a>' for item in demo.get('sources', []))
    sources = f'<span class="se-source-links">{links}</span>' if links else ''
    return f'''<section class="paper-demo summeval-demo" data-paper-demo="{_e(slug)}" aria-labelledby="{_e(slug)}-demo-title">
      <header class="se-heading"><p class="se-kicker">{_e(demo.get("eyebrow", "Measured · Tables 1–5"))}</p><h3 id="{_e(slug)}-demo-title">{_e(demo["title"])}</h3><p>{_e(demo["description"])}</p></header>
      <div class="se-controls" data-demo-controls hidden>{controls}</div>
      <div class="se-state" data-demo-state><div class="se-results" data-se-results>{results}</div><p class="se-verdict" role="status" aria-live="polite" data-se-verdict>{_e(text)}</p></div>
      <p class="se-disclosure">{_e(demo["note"])}{sources}</p>
      <script type="application/json" class="se-config">{encoded}</script>
    </section>'''
