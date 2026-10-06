"""Evidence explorer for Epistemic Context Learning (arXiv 2601.21742).

One demo in the evidence slot of the `epistemic-context-learning` page, built only from
printed results of the paper:

* Part A: final-answer accuracy for every model the paper reports in one view, chosen
  by benchmark, peer setting, and peer context. The natural and adversarial settings use
  Table 6; the two stress tests use Table 10 (Flip: the historically reliable peer now
  answers wrongly) and Table 14 (All-W: every peer answers wrongly, GPQA only).
* Part B: GPQA accuracy split by whether Stage 1 named the reliable peer (Table 11), with
  the split sizes reconstructed from Table 8 and the 40 GPQA test questions (Table 7).

Printed values are kept as printed strings. Computed quantities are differences in
percentage points, whole numbers of test questions (90 for MMLU-Pro, 40 for GPQA), and the
Table 11 reconstruction. Python renders the complete default view; `papers/demos/trust.js`
repeats the same computation when the reader changes a control. No model or network call.
"""
from __future__ import annotations

from html import escape
import json
import math
from typing import Any

SLUG = 'epistemic-context-learning'
KIND = 'trust-evidence'

# Table 6 row order. `trained`: Qwen 3-4B and 8B are RL-trained; the other models are prompted.
MODELS = [
    {'id': 'qwen4b', 'name': 'Qwen 3-4B', 'trained': True},
    {'id': 'qwen8b', 'name': 'Qwen 3-8B', 'trained': True},
    {'id': 'qwen30b', 'name': 'Qwen 3-30B', 'trained': False},
    {'id': 'deepseek', 'name': 'DeepSeek V3.2', 'trained': False},
    {'id': 'gpt5mini', 'name': 'GPT-5-mini', 'trained': False},
    {'id': 'gpt52', 'name': 'GPT-5.2', 'trained': False},
    {'id': 'geminiflash', 'name': 'Gemini 3 Flash', 'trained': False},
    {'id': 'geminipro', 'name': 'Gemini 3 Pro', 'trained': False},
]
# Test-set sizes from Table 7.
BENCHMARKS = [{'id': 'mmlupro', 'name': 'MMLU-Pro', 'n': 90}, {'id': 'gpqa', 'name': 'GPQA', 'n': 40}]
CONTEXTS = [{'id': 'outcome', 'name': 'MA-Outcome', 'short': 'answers only'},
            {'id': 'reasoning', 'name': 'MA-Reasoning', 'short': 'answers with reasoning'}]
SETTINGS = [
    {'id': 'natural', 'name': 'Natural', 'label': 'natural peers', 'table': 'Table 6'},
    {'id': 'adversarial', 'name': 'Adversarial', 'label': 'adversarial peers', 'table': 'Table 6'},
    {'id': 'flip', 'name': 'Reliable peer flips', 'label': 'adversarial peers, reliable peer flipped (Flip)', 'table': 'Table 10'},
    {'id': 'allwrong', 'name': 'All peers wrong', 'label': 'adversarial peers, all answers wrong (All-W)', 'table': 'Table 14'},
]
DEFAULT = {'bench': 'gpqa', 'setting': 'adversarial', 'context': 'outcome'}

# Table 6, as printed (%). Per setting, benchmark and model: the single-agent value (SA, RL for
# the two trained Qwen models and Base for the others), then AG, ECL (I), ECL (E) for MA-Outcome
# and for MA-Reasoning.
TABLE6: dict[str, dict[str, dict[str, list[str]]]] = {
    'natural': {
        'mmlupro': {
            'qwen4b': ['70.0', '67.8', '72.2', '71.1', '78.9', '85.6', '84.4'],
            'qwen8b': ['71.1', '66.7', '65.6', '77.8', '71.1', '72.2', '76.7'],
            'qwen30b': ['75.6', '73.3', '77.8', '77.8', '82.2', '82.2', '86.7'],
            'deepseek': ['80.0', '81.1', '86.7', '84.4', '83.3', '83.3', '83.3'],
            'gpt5mini': ['80.0', '82.2', '84.4', '85.6', '86.7', '85.6', '86.7'],
            'gpt52': ['84.4', '85.6', '83.3', '86.7', '85.6', '84.4', '86.7'],
            'geminiflash': ['85.6', '82.2', '86.7', '85.6', '83.3', '84.4', '85.6'],
            'geminipro': ['87.8', '87.8', '85.6', '85.6', '85.6', '85.6', '86.7'],
        },
        'gpqa': {
            'qwen4b': ['55.0', '42.5', '62.5', '70.0', '82.5', '82.5', '77.5'],
            'qwen8b': ['52.5', '57.5', '55.0', '65.0', '77.5', '75.0', '77.5'],
            'qwen30b': ['72.5', '65.0', '70.0', '75.0', '82.5', '90.0', '85.0'],
            'deepseek': ['77.5', '77.5', '75.0', '85.0', '85.0', '82.5', '87.5'],
            'gpt5mini': ['82.5', '85.0', '80.0', '92.5', '90.0', '87.5', '92.5'],
            'gpt52': ['87.5', '90.0', '90.0', '95.0', '92.5', '95.0', '92.5'],
            'geminiflash': ['90.0', '92.5', '90.0', '85.0', '92.5', '90.0', '85.0'],
            'geminipro': ['90.0', '90.0', '92.5', '85.0', '92.5', '95.0', '95.0'],
        },
    },
    'adversarial': {
        'mmlupro': {
            'qwen4b': ['70.0', '70.0', '85.6', '82.2', '78.9', '90.0', '90.0'],
            'qwen8b': ['71.1', '71.1', '77.8', '83.3', '71.1', '76.7', '82.2'],
            'qwen30b': ['75.6', '75.6', '86.7', '83.3', '81.1', '85.6', '92.2'],
            'deepseek': ['80.0', '83.3', '92.2', '87.8', '80.0', '93.3', '91.1'],
            'gpt5mini': ['80.0', '84.4', '85.6', '87.8', '84.4', '85.6', '90.0'],
            'gpt52': ['84.4', '85.6', '88.9', '88.9', '82.2', '87.8', '87.8'],
            'geminiflash': ['85.6', '84.4', '96.7', '97.8', '87.8', '98.9', '98.9'],
            'geminipro': ['87.8', '91.1', '97.8', '96.7', '87.8', '97.8', '98.9'],
        },
        'gpqa': {
            'qwen4b': ['55.0', '47.5', '60.0', '67.5', '62.5', '60.0', '70.0'],
            'qwen8b': ['52.5', '45.0', '50.0', '50.0', '50.0', '57.5', '52.5'],
            'qwen30b': ['72.5', '70.0', '72.5', '80.0', '65.0', '75.0', '77.5'],
            'deepseek': ['77.5', '77.5', '80.0', '82.5', '80.0', '82.5', '85.0'],
            'gpt5mini': ['82.5', '87.5', '87.5', '85.0', '75.0', '82.5', '85.0'],
            'gpt52': ['87.5', '92.5', '90.0', '97.5', '87.5', '82.5', '90.0'],
            'geminiflash': ['90.0', '87.5', '95.0', '97.5', '87.5', '92.5', '95.0'],
            'geminipro': ['90.0', '90.0', '97.5', '100.0', '90.0', '95.0', '95.0'],
        },
    },
}
# Table 10 (adversarial setting), as printed: per benchmark, model and context,
# [AG, ECL (I) normal, ECL (I) Flip, ECL (E) normal, ECL (E) Flip]. AG has no history, so the
# paper prints one AG value for both settings.
TABLE10: dict[str, dict[str, dict[str, list[str]]]] = {
    'mmlupro': {
        'qwen4b': {'outcome': ['70.0', '85.6', '62.2', '82.2', '63.3'], 'reasoning': ['78.9', '90.0', '62.2', '90.0', '65.6']},
        'qwen8b': {'outcome': ['71.1', '77.8', '66.7', '83.3', '62.2'], 'reasoning': ['71.1', '76.7', '62.2', '82.2', '56.7']},
        'deepseek': {'outcome': ['83.3', '92.2', '52.2', '87.8', '77.8'], 'reasoning': ['80.0', '93.3', '63.3', '91.1', '66.7']},
        'gpt5mini': {'outcome': ['84.4', '85.6', '81.1', '87.8', '78.9'], 'reasoning': ['84.4', '85.6', '80.0', '90.0', '83.3']},
        'geminiflash': {'outcome': ['84.4', '96.7', '46.7', '97.8', '66.7'], 'reasoning': ['87.8', '98.9', '52.2', '98.9', '65.6']},
    },
    'gpqa': {
        'qwen4b': {'outcome': ['47.5', '60.0', '60.0', '62.5', '47.5'], 'reasoning': ['62.5', '60.0', '57.5', '70.0', '52.5']},
        'qwen8b': {'outcome': ['45.0', '50.0', '45.0', '50.0', '42.5'], 'reasoning': ['50.0', '57.5', '52.5', '52.5', '47.5']},
        'deepseek': {'outcome': ['77.5', '80.0', '72.5', '82.5', '62.5'], 'reasoning': ['80.0', '82.5', '65.0', '85.0', '62.5']},
        'gpt5mini': {'outcome': ['87.5', '87.5', '80.0', '85.0', '75.0'], 'reasoning': ['75.0', '82.5', '80.0', '85.0', '82.5']},
        'geminiflash': {'outcome': ['87.5', '95.0', '50.0', '97.5', '35.0'], 'reasoning': ['87.5', '92.5', '55.0', '95.0', '65.0']},
    },
}
# Table 14 (GPQA, adversarial), as printed: per model and context, [Acc, Acc (All-W)] for
# AG, ECL (I), ECL (I) + DB, ECL (E), ECL (E) + DB. DB (decoupled belief) adds the agent's own
# independent answer as an input to Stage 2 (Appendix E).
TABLE14: dict[str, dict[str, dict[str, list[str]]]] = {
    'deepseek': {
        'outcome': {'ag': ['77.5', '57.5'], 'ecli': ['80.0', '70.0'], 'ecli_db': ['87.5', '67.5'], 'ecle': ['82.5', '45.0'], 'ecle_db': ['87.5', '65.0']},
        'reasoning': {'ag': ['80.0', '57.5'], 'ecli': ['82.5', '52.5'], 'ecli_db': ['87.5', '67.5'], 'ecle': ['85.0', '45.0'], 'ecle_db': ['95.0', '55.0']},
    },
    'gpt5mini': {
        'outcome': {'ag': ['87.5', '77.5'], 'ecli': ['87.5', '75.0'], 'ecli_db': ['82.5', '77.5'], 'ecle': ['85.0', '72.5'], 'ecle_db': ['85.0', '80.0']},
        'reasoning': {'ag': ['75.0', '72.5'], 'ecli': ['82.5', '67.5'], 'ecli_db': ['85.0', '80.0'], 'ecle': ['85.0', '72.5'], 'ecle_db': ['85.0', '77.5']},
    },
    'geminiflash': {
        'outcome': {'ag': ['87.5', '72.5'], 'ecli': ['95.0', '47.5'], 'ecli_db': ['97.5', '55.0'], 'ecle': ['97.5', '35.0'], 'ecle_db': ['100.0', '55.0']},
        'reasoning': {'ag': ['87.5', '62.5'], 'ecli': ['92.5', '47.5'], 'ecli_db': ['97.5', '55.0'], 'ecle': ['95.0', '50.0'], 'ecle_db': ['92.5', '70.0']},
    },
}
# Table 8 (GPQA rows): average peer recognition reward, i.e. the share of test questions on
# which Stage 1 named the reliable peer, for MA-Outcome and MA-Reasoning.
TABLE8_GPQA: dict[str, list[str]] = {
    'qwen4b': ['52.5', '50.0'], 'qwen8b': ['40.0', '42.0'], 'deepseek': ['85.0', '90.0'],
    'gpt5mini': ['90.0', '92.5'], 'geminiflash': ['92.5', '92.5'],
}
# Table 11 (GPQA): final-answer accuracy when Stage 1 named the reliable peer (PRR = 1) and when
# it named another peer (PRR = 0), for MA-Outcome and MA-Reasoning.
TABLE11: dict[str, dict[str, list[str]]] = {
    'qwen4b': {'outcome': ['66.7', '57.9'], 'reasoning': ['85.0', '55.0']},
    'qwen8b': {'outcome': ['75.0', '33.3'], 'reasoning': ['70.6', '39.1']},
    'deepseek': {'outcome': ['85.3', '66.7'], 'reasoning': ['86.1', '75.0']},
    'gpt5mini': {'outcome': ['86.1', '75.0'], 'reasoning': ['83.8', '100.0']},
    'geminiflash': {'outcome': ['100.0', '66.7'], 'reasoning': ['100.0', '66.7']},
}
# Column labels, repeated on each cell for the stacked phone layout.
LABELS = {'sa': 'Single agent', 'ag': 'AG', 'ecli': 'ECL (I)', 'ecle': 'ECL (E)', 'diff': 'ECL (E) − AG'}
# Scale of the difference bars, in tenths of a percentage point on each side of zero.
DIFF_SCALE = 600


def _e(value: Any) -> str:
    return escape(str(value), quote=True)


def tenths(text: str) -> int:
    """A printed percentage such as '85.6' in tenths of a point (856)."""
    whole, _, fraction = text.partition('.')
    return int(whole) * 10 + int((fraction + '0')[0])


def questions(text: str, n: int) -> int:
    """Whole test questions behind a printed percentage (same rounding as JavaScript Math.round)."""
    return math.floor(tenths(text) * n / 1000 + 0.5)


def signed_pp(diff: int) -> str:
    sign = '+' if diff > 0 else '−' if diff < 0 else ''
    return f'{sign}{abs(diff) // 10}.{abs(diff) % 10} pp'


def signed_count(diff: int) -> str:
    return ('+' if diff > 0 else '−' if diff < 0 else '') + str(abs(diff))


def _model(model_id: str) -> dict[str, Any]:
    return next(m for m in MODELS if m['id'] == model_id)


def _bench(bench_id: str) -> dict[str, Any]:
    return next(b for b in BENCHMARKS if b['id'] == bench_id)


def _setting(setting_id: str) -> dict[str, Any]:
    return next(s for s in SETTINGS if s['id'] == setting_id)


def _context(context_id: str) -> dict[str, Any]:
    return next(c for c in CONTEXTS if c['id'] == context_id)


def available(bench: str, setting: str) -> bool:
    """All-W results (Table 14) exist for GPQA only."""
    return not (setting == 'allwrong' and bench != 'gpqa')


def view_rows(bench: str, setting: str, context: str) -> list[dict[str, Any]]:
    """One row per model the paper reports for this view; `was` holds the unperturbed value."""
    offset = 1 if context == 'outcome' else 4
    rows = []
    for model in MODELS:
        key = model['id']
        normal = TABLE6['adversarial' if setting in ('flip', 'allwrong') else setting][bench][key]
        row = {'model': key, 'sa': normal[0], 'ag': normal[offset], 'ecli': normal[offset + 1],
               'ecle': normal[offset + 2], 'was': {}}
        if setting == 'flip':
            if key not in TABLE10[bench]:
                continue
            ag, ecli, ecli_flip, ecle, ecle_flip = TABLE10[bench][key][context]
            row.update(ag=ag, ecli=ecli_flip, ecle=ecle_flip, was={'ecli': ecli, 'ecle': ecle})
        elif setting == 'allwrong':
            if key not in TABLE14:
                continue
            cells = TABLE14[key][context]
            row.update(ag=cells['ag'][1], ecli=cells['ecli'][1], ecle=cells['ecle'][1], ecle_db=cells['ecle_db'][1],
                       was={'ag': cells['ag'][0], 'ecli': cells['ecli'][0], 'ecle': cells['ecle'][0]})
        row['diff'] = tenths(row['ecle']) - tenths(row['ag'])
        rows.append(row)
    return rows


def _bar(diff: int) -> str:
    """Diverging bar for a difference in tenths of a point; zero sits in the middle."""
    clipped = max(-DIFF_SCALE, min(DIFF_SCALE, diff))
    width = abs(clipped) / DIFF_SCALE * 50
    left = 50 if clipped >= 0 else 50 - width
    return (f'<span class="tr-bar" aria-hidden="true"><i class="tr-bar-zero"></i>'
            f'<i class="tr-bar-fill" style="left:{left:.2f}%;width:{width:.2f}%"></i></span>')


def _cell(row: dict[str, Any], key: str, extra: str = '') -> str:
    """A printed value, with its unperturbed value and a below-single-agent note where they apply."""
    notes = []
    if row['was'].get(key):
        notes.append(f'was {_e(row["was"][key])}%')
    if key == 'ag' and tenths(row['ag']) < tenths(row['sa']):
        notes.append('below single agent')
        extra += ' is-below-sa'
    small = ''.join(f'<small>{note}</small>' for note in notes)
    return f'<td class="num{extra}" data-tr-cell="{key}" data-label="{LABELS[key]}">{_e(row[key])}%{small}</td>'


def _flip_mismatch(bench: str, context: str) -> str:
    """Name any unflipped Table 10 value that differs from the same cell of Table 6."""
    offset = 1 if context == 'outcome' else 4
    notes = []
    for key, cells in TABLE10[bench].items():
        ag, ecli, _, ecle, _ = cells[context]
        normal = TABLE6['adversarial'][bench][key]
        for label, printed, other in (('AG', ag, normal[offset]), ('ECL (I)', ecli, normal[offset + 1]),
                                      ('ECL (E)', ecle, normal[offset + 2])):
            if printed != other:
                notes.append(f'{_model(key)["name"]}, {label}: {printed}% in Table 10 vs {other}% in Table 6')
    return f' The two tables disagree for {"; ".join(notes)}.' if notes else ''


def view_state(bench: str, setting: str, context: str) -> tuple[str, str]:
    """HTML of Part A and its verdict for one view."""
    b, s, c = _bench(bench), _setting(setting), _context(context)
    n = b['n']
    rows = view_rows(bench, setting, context)
    body = []
    for row in rows:
        model = _model(row['model'])
        diff = row['diff']
        state = 'is-gain' if diff > 0 else 'is-loss' if diff < 0 else 'is-level'
        q_diff = questions(row['ecle'], n) - questions(row['ag'], n)
        body.append(
            f'<tr class="{state}" data-model="{model["id"]}"><th scope="row">{_e(model["name"])}'
            f'<small>{"RL-trained" if model["trained"] else "prompted only"}</small></th>'
            f'<td class="num" data-tr-cell="sa" data-label="{LABELS["sa"]}">{_e(row["sa"])}%</td>{_cell(row, "ag")}{_cell(row, "ecli")}'
            f'{_cell(row, "ecle", " is-ecl")}'
            f'<td class="tr-diff" data-tr-cell="diff" data-label="{LABELS["diff"]}">{_bar(diff)}<span class="tr-diff-text">{signed_pp(diff)}</span>'
            f'<small>{signed_count(q_diff)} of {n} questions</small></td></tr>')
    title = f'{b["name"]} · {s["label"]} · {c["name"]} ({c["short"]})'
    head = ('<thead><tr><th scope="col">Model</th><th scope="col" class="num">Single agent</th>'
            '<th scope="col" class="num">AG</th><th scope="col" class="num">ECL (I)</th>'
            '<th scope="col" class="num">ECL (E)</th><th scope="col">ECL (E) − AG</th></tr></thead>')
    stress = {'flip': ' Under Flip the history is unchanged, so AG (which sees no history) keeps its printed value; '
                      '“was” gives each ECL value before the flip, as printed in Table 10.' + _flip_mismatch(bench, context),
              'allwrong': ' “was” gives each value before every peer answered wrongly. Only three models were tested.'}
    caption = (f'<p class="tr-caption"><span class="tr-tag is-measured">Measured · {s["table"]}</span> final-answer accuracy, '
               f'as printed; Single agent from Table 6 (no peers, so the peer setting does not change it). '
               f'<span class="tr-tag is-computed">Computed</span> ECL (E) − AG in percentage points and in whole test '
               f'questions out of {n} (Table 7).{stress.get(setting, "")}</p>')
    html = (f'<div class="tr-block"><h4 data-tr-view-title>{_e(title)}</h4>'
            f'<div class="tr-table-scroll" tabindex="0" role="region" aria-label="Accuracy by model; scroll sideways on narrow screens">'
            f'<table class="tr-table">{head}<tbody>{"".join(body)}</tbody></table></div>{caption}</div>')
    return html, view_verdict(bench, setting, context, rows)


def _names(rows: list[dict[str, Any]]) -> str:
    names = [_model(r['model'])['name'] for r in rows]
    return names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' and ' + names[-1]


def view_verdict(bench: str, setting: str, context: str, rows: list[dict[str, Any]]) -> str:
    n = _bench(bench)['n']
    total = len(rows)
    gains = [r for r in rows if r['diff'] > 0]
    losses = [r for r in rows if r['diff'] < 0]
    level = total - len(gains) - len(losses)

    def delta(old: str, new: str) -> str:
        q = questions(new, n) - questions(old, n)
        return f'{signed_pp(tenths(new) - tenths(old))}, {signed_count(q)} of {n} questions'

    def change(row: dict[str, Any], old: str, new: str) -> str:
        return f'{_model(row["model"])["name"]} {old}% → {new}% ({delta(old, new)})'

    def versus(row: dict[str, Any]) -> str:
        return f'{_model(row["model"])["name"]}, ECL (E) {row["ecle"]}% vs AG {row["ag"]}% ({delta(row["ag"], row["ecle"])})'

    if setting in ('natural', 'adversarial'):
        text = (f'ECL (E) is above AG for {len(gains)} of {total} models, level for {level} and below for {len(losses)}. ')
        if gains:
            text += f'Largest gain: {versus(max(gains, key=lambda r: r["diff"]))}. '
        if losses:
            text += f'Largest loss: {versus(min(losses, key=lambda r: r["diff"]))}. '
        below = [r for r in rows if tenths(r['ag']) < tenths(r['sa'])]
        if below:
            text += f'AG falls below the single agent for {_names(below)}. '
        small = next(r for r in rows if r['model'] == 'qwen4b')
        large = next(r for r in rows if r['model'] == 'qwen30b')
        relation = 'above' if tenths(small['ecle']) > tenths(large['ag']) else 'below' if tenths(small['ecle']) < tenths(large['ag']) else 'level with'
        text += (f'RL-trained Qwen 3-4B with ECL (E), {small["ecle"]}%, is {relation} prompted Qwen 3-30B with AG, '
                 f'{large["ag"]}%.')
        return text
    if setting == 'flip':
        dropped = [r for r in rows if tenths(r['ecle']) < tenths(r['was']['ecle'])]
        under = [r for r in rows if r['diff'] < 0]
        worst = min(rows, key=lambda r: tenths(r['ecle']) - tenths(r['was']['ecle']))
        least = max(rows, key=lambda r: tenths(r['ecle']) - tenths(r['was']['ecle']))
        return (f'After the flip, ECL (E) is lower for {len(dropped)} of {total} models and below AG for {len(under)}. '
                f'Largest drop: {change(worst, worst["was"]["ecle"], worst["ecle"])}. '
                f'Smallest change: {change(least, least["was"]["ecle"], least["ecle"])}. '
                'The paper reads such drops as evidence that ECL answers by following the peer it identified '
                'from the history (Appendix D.3).')
    ag_fell = [r for r in rows if tenths(r['ag']) < tenths(r['was']['ag'])]
    under = [r for r in rows if r['diff'] <= 0]
    worst = min(rows, key=lambda r: r['diff'])
    db = '; '.join(f'{_model(r["model"])["name"]} {r["ecle_db"]}%' for r in rows)
    return (f'With every peer wrong, AG falls for {len(ag_fell)} of {total} models, and ECL (E) is at or below AG for '
            f'{len(under)} of {total}. Largest gap: {versus(worst)}. Adding the agent’s own independent answer as an '
            f'input (decoupled belief, Appendix E) gives ECL (E) {db}.')


def reconstruct(prr: str, acc_named: str, acc_other: str, n: int = 40) -> dict[str, Any]:
    """Whole-question split behind Table 8's PRR and Table 11's two conditional accuracies.

    Returns the split (named, right when named, right otherwise) whose size is closest to the
    printed PRR among splits that reproduce both printed accuracies to one decimal.
    """
    best = None
    target = tenths(prr) * n  # PRR x n, in thousandths of a question
    for named in range(n + 1):
        other = n - named
        hits = [k for k in range(named + 1) if _rounds_to(k, named, acc_named)]
        misses = [k for k in range(other + 1) if _rounds_to(k, other, acc_other)]
        if not hits or not misses:
            continue
        distance = abs(named * 1000 - target)
        if best is None or distance < best[0]:
            best = (distance, named, hits[0], misses[0])
    assert best is not None, (prr, acc_named, acc_other)
    _, named, right_named, right_other = best
    return {'named': named, 'other': n - named, 'right_named': right_named, 'right_other': right_other,
            'exact': named * 1000 == target}


def _rounds_to(k: int, total: int, printed: str) -> bool:
    """k of total, as a percentage rounded to one decimal, equals the printed value."""
    return total > 0 and math.floor(k * 1000 / total + 0.5) == tenths(printed)


def split_state(context: str) -> tuple[str, str]:
    """HTML of Part B (GPQA, adversarial, ECL (E)) and its verdict for one peer context."""
    index = 0 if context == 'outcome' else 1
    c = _context(context)
    items = []
    higher = 0
    smallest = None
    for key, prrs in TABLE8_GPQA.items():
        model = _model(key)
        acc_named, acc_other = TABLE11[key][context]
        split = reconstruct(prrs[index], acc_named, acc_other)
        total = split['right_named'] + split['right_other']
        printed = TABLE10['gpqa'][key][context][3]
        match = total * 25 == tenths(printed)  # one GPQA question is 2.5 points
        higher += tenths(acc_named) > tenths(acc_other)
        if smallest is None or split['other'] < smallest[1]:
            smallest = (model['name'], split['other'])
        squares = (['<i class="is-named is-right"></i>'] * split['right_named']
                   + ['<i class="is-named"></i>'] * (split['named'] - split['right_named'])
                   + ['<i class="tr-gap"></i>']
                   + ['<i class="is-other is-right"></i>'] * split['right_other']
                   + ['<i class="is-other"></i>'] * (split['other'] - split['right_other']))
        prr_note = '' if split['exact'] else (
            f' Table 8 prints {prrs[index]}%, which is not a whole number of the 40 questions; '
            f'{split["named"]} questions ({split["named"] * 25 // 10}.{split["named"] * 25 % 10}%) reproduce both Table 11 values.')
        check = (f'as printed in Table 10' if match else
                 f'Table 10 prints {printed}% for ECL (E), one question {"fewer" if total * 25 > tenths(printed) else "more"}')
        label = (f'{model["name"]}: named the reliable peer on {split["named"]} of 40 questions, '
                 f'{split["right_named"]} answered correctly; named another peer on {split["other"]}, {split["right_other"]} correct.')
        items.append(
            f'<li data-model="{key}"><p class="tr-strip-name">{_e(model["name"])} <small>{"RL-trained" if model["trained"] else "prompted only"}</small></p>'
            f'<div class="tr-strip" role="img" aria-label="{_e(label)}">{"".join(squares)}</div>'
            f'<p class="tr-strip-text">Named the reliable peer: <strong>{split["right_named"]} of {split["named"]}</strong> right ({acc_named}%) · '
            f'named another: <strong>{split["right_other"]} of {split["other"]}</strong> right ({acc_other}%) · '
            f'total {total} of 40 = {total * 25 // 10}.{total * 25 % 10}%, {check}.{_e(prr_note)}</p></li>')
    title = f'GPQA · adversarial peers · {c["name"]} ({c["short"]}) · ECL (E): did Stage 1 name the reliable peer?'
    legend = ('<p class="tr-legend" aria-hidden="true"><span><i class="is-named is-right"></i>named the reliable peer, answer right</span>'
              '<span><i class="is-named"></i>named it, answer wrong</span><span><i class="is-other is-right"></i>named another peer, answer right</span>'
              '<span><i class="is-other"></i>named another, answer wrong</span></p>')
    caption = ('<p class="tr-caption"><span class="tr-tag is-measured">Measured · Tables 8, 10 and 11</span> recognition rate (PRR) and the two '
               'conditional accuracies, as printed. <span class="tr-tag is-computed">Computed</span> whole-question counts out of the 40 GPQA '
               'test questions that reproduce the printed percentages; each square is one question, ordered for display only. '
               'On MMLU-Pro the recognition rate is 82.2–100.0% for these models (Table 8), so the paper reports this split for GPQA only.</p>')
    html = (f'<div class="tr-block tr-split"><h4 data-tr-split-title>{_e(title)}</h4>{legend}'
            f'<ol class="tr-strips">{"".join(items)}</ol>{caption}</div>')
    step = 1000 // smallest[1]  # tenths of a point that one question is worth in the smallest group
    verdict = (f'Accuracy is higher after naming the reliable peer for {higher} of {len(TABLE8_GPQA)} models. '
               f'The “named another peer” group is as small as {smallest[1]} questions ({smallest[0]}), '
               f'where one question moves its accuracy by {step // 10}.{step % 10} pp.')
    return html, verdict


def _button(action: str, label: str, pressed: bool, disabled: bool = False) -> str:
    return (f'<button type="button" data-demo-action="{_e(action)}" aria-pressed="{str(pressed).lower()}"'
            f'{" disabled" if disabled else ""}>{label}</button>')


def _group(label: str, buttons: str) -> str:
    return (f'<div class="tr-button-row" role="group" aria-label="{_e(label)}">'
            f'<span class="tr-group-label" aria-hidden="true">{_e(label)}</span>{buttons}</div>')


def config() -> dict[str, Any]:
    return {'models': MODELS, 'benchmarks': BENCHMARKS, 'contexts': CONTEXTS, 'settings': SETTINGS, 'default': DEFAULT,
            'table6': TABLE6, 'table10': TABLE10, 'table14': TABLE14, 'table8': TABLE8_GPQA, 'table11': TABLE11,
            'diffScale': DIFF_SCALE}


def render_demo(slug: str, insight: dict[str, Any]) -> str:
    if slug != SLUG:
        return ''
    demo = insight.get('demo') or {}
    if demo.get('kind') != KIND:
        return ''
    bench, setting, context = DEFAULT['bench'], DEFAULT['setting'], DEFAULT['context']
    controls = (
        _group('Benchmark', ''.join(_button(f'tr-bench:{b["id"]}', f'{_e(b["name"])} <small>{b["n"]} test questions</small>',
                                            b['id'] == bench) for b in BENCHMARKS))
        + _group('Peers', ''.join(_button(f'tr-setting:{s["id"]}', _e(s['name']), s['id'] == setting,
                                          not available(bench, s['id'])) for s in SETTINGS))
        + _group('Peer context', ''.join(_button(f'tr-context:{c["id"]}', f'{_e(c["name"])} <small>{_e(c["short"])}</small>',
                                                 c['id'] == context) for c in CONTEXTS))
        + '<p class="tr-help">All peers wrong is reported for GPQA only (Table 14).</p>')
    view_html, view_text = view_state(bench, setting, context)
    split_html, split_text = split_state(context)
    encoded = json.dumps(config(), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    links = ''.join(f'<a href="{_e(item["url"])}">{_e(item["label"])} ↗</a>' for item in demo.get('sources', []))
    return f'''<section class="paper-demo trust-demo" data-paper-demo="{_e(slug)}" data-trust-demo="{KIND}" aria-labelledby="{slug}-demo-title">
      <header class="tr-heading"><p class="tr-kicker">{_e(demo.get("eyebrow", "Measured · Tables 6, 8, 10, 11 and 14"))}</p><h3 id="{slug}-demo-title">{_e(demo.get("title", ""))}</h3><p>{_e(demo.get("description", ""))}</p></header>
      <div class="tr-controls" data-demo-controls hidden>{controls}</div>
      <div class="tr-state" data-demo-state><div data-tr-view>{view_html}</div><p class="tr-verdict" role="status" aria-live="polite" data-tr-view-verdict>{_e(view_text)}</p></div>
      <div class="tr-state" data-demo-state><div data-tr-split>{split_html}</div><p class="tr-verdict" data-tr-split-verdict>{_e(split_text)}</p></div>
      <p class="tr-disclosure">{_e(demo.get("note", ""))}<span class="tr-source-links">{links}</span></p>
      <script type="application/json" class="tr-config">{encoded}</script>
    </section>'''
