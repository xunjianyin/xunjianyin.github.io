"""Static, progressively enhanced demos for the evaluation research pages.

Each renderer returns a complete, readable initial state computed here in Python.
`papers/demos/evaluation.js` repeats the same calculations in the browser when the
reader changes an input. Every number shown is tagged as measured (with its table
or figure), adapted from the paper, illustrative, or computed from the reader's
input. No renderer calls a model or the network.
"""
from __future__ import annotations

from html import escape
import json
from typing import Any, Sequence

DSGRAM_PAPER = 'https://arxiv.org/html/2412.12832v2'
DSGRAM_DATA = ('https://github.com/jxtse/GEC-Metrics-DSGram/blob/main/'
               'Dataset/DSGram-Eval/gec_human_eval_test_1.json')


def _e(value: Any) -> str:
    return escape(str(value), quote=True)


def _button(value: str, label: str, pressed: bool = False) -> str:
    return (f'<button type="button" data-demo-action="{_e(value)}" '
            f'aria-pressed="{str(pressed).lower()}">{_e(label)}</button>')


def _range(slug: str, key: str, label: str, minimum: int, maximum: int,
           value: int, display: str, step: int = 1) -> str:
    ident = f"{slug}-{key}"
    return (f'<label class="eval-range" for="{ident}"><span>{_e(label)} '
            f'<output for="{ident}" data-eval-value="{key}">{_e(display)}</output></span>'
            f'<input id="{ident}" type="range" min="{minimum}" max="{maximum}" '
            f'value="{value}" step="{step}" data-demo-range="{key}"></label>')


def _group(label: str, buttons: str, extra_class: str = '') -> str:
    return (f'<div class="eval-button-row{extra_class}" role="group" aria-label="{_e(label)}">'
            f'<span class="eval-group-label" aria-hidden="true">{_e(label)}</span>{buttons}</div>')


def _shell(slug: str, demo: dict[str, Any], controls: str, results: str, verdict: str,
           config: dict[str, Any]) -> str:
    # The JSON lives in a non-executable script and is escaped against closing tags.
    encoded = json.dumps(config, ensure_ascii=False).replace("<", "\\u003c")
    links = ''.join(f'<a href="{_e(item["url"])}">{_e(item["label"])} ↗</a>'
                    for item in demo.get('sources', []))
    sources = f'<span class="eval-source-links">{links}</span>' if links else ''
    return f'''<section class="paper-demo evaluation-demo" data-paper-demo="{_e(slug)}" data-evaluation-demo="{_e(demo['kind'])}" aria-labelledby="{slug}-demo-title">
      <div class="eval-heading"><p class="eval-kicker">{_e(demo.get("eyebrow", "Interactive explanation"))}</p><h3 id="{slug}-demo-title">{_e(demo['title'])}</h3><p>{_e(demo['description'])}</p></div>
      <div class="eval-controls" data-demo-controls hidden>{controls}</div>
      <div class="eval-state" data-demo-state><div class="eval-results" data-eval-results>{results}</div><p class="eval-verdict" role="status" aria-live="polite" data-eval-verdict>{_e(verdict)}</p></div>
      <p class="eval-disclosure">{_e(demo['note'])}{sources}</p>
      <script type="application/json" class="eval-config">{encoded}</script>
    </section>'''


TAG_LABELS = {'measured': 'Measured', 'adapted': 'Adapted', 'illustrative': 'Illustrative',
              'input': 'Your input', 'computed': 'Computed'}


def _tag(kind: str, reference: str = '') -> str:
    """Provenance label, e.g. "Measured · Table 6". The word states the kind; color is secondary."""
    text = TAG_LABELS[kind] + (f' · {reference}' if reference else '')
    return f'<span class="eval-tag eval-tag-{_e(kind)}">{_e(text)}</span>'


# ---------------------------------------------------------------------------
# DSGram: the AHP weight-generation step (Section 3.2, Algorithm 1, Figure 5).
# ---------------------------------------------------------------------------

DSGRAM_CRITERIA = ['Semantic coherence', 'Edit level', 'Fluency']
DSGRAM_SHORT = ['SC', 'EL', 'F']
DSGRAM_PAIRS = [(0, 1), (0, 2), (1, 2)]
DSGRAM_RI = 0.58          # Section 3.2: Random Index for a 3 x 3 matrix
DSGRAM_CR_LIMIT = 0.10    # Section 3.2 and Algorithm 1: CR below 0.1 is accepted
# Verbal labels of the 1-9 scale, from the released generate_weight_prompt.txt.
SAATY_WORDS = {
    1: 'equal importance', 2: 'between equal and slightly more', 3: 'slightly more important',
    4: 'between slightly and strongly more', 5: 'strongly more important',
    6: 'between strongly and very strongly more', 7: 'very strongly more important',
    8: 'between very strongly and extremely more', 9: 'extremely more important',
}

DSGRAM_CONTEXTS: dict[str, dict[str, Any]] = {
    'a': {
        'button': '(a) Casual dialogue',
        'label': 'Casual daily dialogue; the paper says Fluency is emphasized.',
        'original': 'So I think we can not live if old people could not find siences and tecnologies and they did not developped .',
        'corrected': 'So I think we would not be alive if our ancestors did not develop sciences and technologies .',
        'paper_weights': [0.268073, 0.29518, 0.436747],
        'paper_score': 8.436747,
        # Slider positions: negative favors the first criterion of the pair.
        'preset': [0, 1, 0],
        'preset_gap': 0.032,
        'corrections': [
            {'name': 'Figure 5(a) correction · DSGram-Eval #1', 'figure': True,
             'text': 'So I think we would not be alive if our ancestors did not develop sciences and technologies .',
             'scores': [8, 8, 9], 'human': 9},
            {'name': 'Another system output · DSGram-Eval #4', 'figure': False,
             'text': 'So I think we can not live if old people can not find the science and technology that has not been developed .',
             'scores': [2, 10, 5], 'human': 2},
        ],
    },
    'b': {
        'button': '(b) Formal expression',
        'label': 'Formal expression; the paper says Edit level is emphasized.',
        'original': 'Here was no promise of morning except that we looked up through the trees we saw how low the forest had swung .',
        'corrected': 'Here was no promise of morning , except that we looked up through the trees , and we saw how low the forest had swung',
        'paper_weights': [0.11755, 0.486755, 0.395695],
        'paper_score': 6.021525,
        'preset': [4, 2, 0],
        'preset_gap': 0.010,
        'corrections': [
            {'name': 'Figure 5(b) correction · DSGram-Eval #9', 'figure': True,
             'text': 'Here was no promise of morning , except that we looked up through the trees , and we saw how low the forest had swung .',
             'scores': [8, 8, 3], 'human': 7},
            {'name': 'Another system output · DSGram-Eval #11', 'figure': False,
             'text': 'There was no promise of morning except when we looked up through the trees and saw how low the forest had swung .',
             'scores': [9, 6, 8], 'human': 7},
        ],
    },
}
DSGRAM_PRESETS = {'equal': [0, 0, 0], 'cyclic': [-2, 2, -2]}


def saaty_value(position: int) -> float:
    """Map a slider position (-8..8) to a_ij. Negative favors the row criterion i."""
    return float(1 - position) if position <= 0 else 1.0 / (1 + position)


def saaty_label(position: int) -> str:
    return str(1 - position) if position <= 0 else f'1/{1 + position}'


def judgment_matrix(positions: Sequence[int]) -> list[list[float]]:
    """Reciprocal 3 x 3 matrix from the three upper-triangle judgments."""
    matrix = [[1.0] * 3 for _ in range(3)]
    for (i, j), position in zip(DSGRAM_PAIRS, positions):
        matrix[i][j] = saaty_value(position)
        matrix[j][i] = 1.0 / matrix[i][j]
    return matrix


def principal_eigenvector(matrix: Sequence[Sequence[float]]) -> tuple[list[float], float]:
    """Power iteration: normalized principal eigenvector and lambda_max (Algorithm 1)."""
    size = len(matrix)
    weights = [1.0 / size] * size
    for _ in range(500):
        product = [sum(matrix[i][j] * weights[j] for j in range(size)) for i in range(size)]
        total = sum(product)
        updated = [value / total for value in product]
        converged = max(abs(a - b) for a, b in zip(updated, weights)) < 1e-13
        weights = updated
        if converged:
            break
    product = [sum(matrix[i][j] * weights[j] for j in range(size)) for i in range(size)]
    lambda_max = sum(product[i] / weights[i] for i in range(size)) / size
    return weights, lambda_max


def ahp(positions: Sequence[int]) -> dict[str, Any]:
    matrix = judgment_matrix(positions)
    weights, lambda_max = principal_eigenvector(matrix)
    ci = max(0.0, (lambda_max - 3) / 2)
    cr = ci / DSGRAM_RI
    return {'matrix': matrix, 'weights': weights, 'lambda': lambda_max, 'ci': ci, 'cr': cr}


def judgment_text(pair: int, position: int) -> str:
    i, j = DSGRAM_PAIRS[pair]
    if position == 0:
        return 'Equal importance (1)'
    winner = DSGRAM_CRITERIA[i] if position < 0 else DSGRAM_CRITERIA[j]
    degree = abs(position) + 1
    return f'{winner} {degree}× · {SAATY_WORDS[degree]}'


def cycle_text(positions: Sequence[int]) -> str:
    """Describe an intransitive cycle such as SC > EL > F > SC, or return ''."""
    better = set()
    for (i, j), position in zip(DSGRAM_PAIRS, positions):
        if position < 0:
            better.add((i, j))
        elif position > 0:
            better.add((j, i))
    for a, b, c in ((0, 1, 2), (0, 2, 1)):
        if {(a, b), (b, c), (c, a)} <= better:
            names = [DSGRAM_CRITERIA[k] for k in (a, b, c, a)]
            return ' > '.join(names)
    return ''


def _fmt(value: float, digits: int = 3) -> str:
    text = f'{value:.{digits}f}'
    return text.replace('-', '−')


def weighted(weights: Sequence[float], scores: Sequence[float]) -> float:
    return sum(w * s for w, s in zip(weights, scores))


def dsgram_results(context_key: str, positions: Sequence[int]) -> tuple[str, str]:
    """HTML for the AHP matrix, weights and scores, plus the verdict sentence."""
    context = DSGRAM_CONTEXTS[context_key]
    result = ahp(positions)
    weights = result['weights']
    ok = result['cr'] < DSGRAM_CR_LIMIT
    header = ''.join(f'<th scope="col"><abbr title="{_e(name)}">{short}</abbr></th>'
                     for name, short in zip(DSGRAM_CRITERIA, DSGRAM_SHORT))
    rows = ''.join(
        f'<tr><th scope="row">{_e(DSGRAM_CRITERIA[i])}</th>'
        + ''.join(f'<td data-eval-cell="{i}{j}">{_matrix_label(positions, i, j)}</td>' for j in range(3))
        + '</tr>' for i in range(3))
    matrix_html = (
        '<div class="eval-block"><h4>Judgment matrix A</h4>'
        '<div class="eval-table-wrap" tabindex="0" role="region" aria-label="Judgment matrix">'
        f'<table class="eval-matrix"><thead><tr><th scope="col">Row vs column</th>{header}</tr></thead>'
        f'<tbody>{rows}</tbody></table></div>'
        '<p class="eval-caption">a<sub>ij</sub> is the importance of the row criterion relative to the column '
        'criterion; a<sub>ji</sub> = 1/a<sub>ij</sub>. ' + _tag('input') + '</p>'
        '<dl class="eval-stats">'
        f'<div><dt>λ<sub>max</sub></dt><dd data-eval-lambda>{_fmt(result["lambda"])}</dd></div>'
        f'<div><dt>CI = (λ<sub>max</sub> − 3) / 2</dt><dd data-eval-ci>{_fmt(result["ci"])}</dd></div>'
        f'<div><dt>CR = CI / 0.58</dt><dd data-eval-cr>{_fmt(result["cr"])}</dd></div></dl>'
        f'<p class="eval-consistency {"is-ok" if ok else "is-bad"}" data-eval-consistency>'
        f'{"Consistent: CR < 0.10, accepted" if ok else "Inconsistent: CR ≥ 0.10, rejected by Algorithm 1"}</p></div>')
    weight_rows = ''.join(
        f'<tr><th scope="row">{_e(name)}</th>'
        f'<td><span class="eval-bar" aria-hidden="true"><i style="width:{w * 100:.1f}%"></i></span>'
        f'<span data-eval-weight="{k}">{_fmt(w)}</span></td>'
        f'<td>{_fmt(paper)}</td><td>0.333</td></tr>'
        for k, (name, w, paper) in enumerate(zip(DSGRAM_CRITERIA, weights, context['paper_weights'])))
    weights_html = (
        '<div class="eval-block"><h4>Weights</h4>'
        '<div class="eval-table-wrap" tabindex="0" role="region" aria-label="Criterion weights">'
        '<table class="eval-weights"><thead><tr><th scope="col">Criterion</th><th scope="col">Your AHP weight</th>'
        f'<th scope="col">Figure 5({context_key}) · GPT-4</th><th scope="col">Equal</th></tr></thead>'
        f'<tbody>{weight_rows}</tbody></table></div>'
        '<p class="eval-caption">' + _tag('computed', 'Section 3.2') + ' your weights: the principal eigenvector of A, normalized to sum to 1. '
        + _tag('measured', f'Figure 5({context_key})') + ' GPT-4 weights printed in the paper; the matrix behind them is not printed.</p></div>')
    cards = []
    totals = [weighted(weights, c['scores']) for c in context['corrections']]
    best = 0 if totals[0] >= totals[1] else 1
    for index, correction in enumerate(context['corrections']):
        paper_value = _fmt(context['paper_score'], 2) if correction['figure'] else '<small>not reported</small>'
        equal = sum(correction['scores']) / 3
        subs = ''.join(f'<li><span>{short}</span><strong>{score}</strong></li>'
                       for short, score in zip(DSGRAM_SHORT, correction['scores']))
        cards.append(
            f'<article class="eval-score-card{" is-preferred" if index == best else ""}" data-eval-card="{index}">'
            f'<h5>{_e(correction["name"])}</h5><p class="eval-example">{_e(correction["text"])}</p>'
            f'<ul class="eval-sub-scores" aria-label="Human sub-scores"><li class="eval-sub-label">Human sub-scores</li>{subs}</ul>'
            '<dl class="eval-totals">'
            f'<div class="is-yours"><dt>Your weights</dt><dd data-eval-total="{index}">{_fmt(totals[index], 2)}</dd></div>'
            f'<div><dt>Figure 5 weights</dt><dd>{paper_value}</dd></div>'
            f'<div><dt>Equal weights</dt><dd>{_fmt(equal, 2)}</dd></div>'
            f'<div><dt>Human overall</dt><dd>{correction["human"]}</dd></div></dl></article>')
    scores_html = (
        '<div class="eval-block eval-score-block"><h4>Apply the weights: W = Σ w<sub>i</sub> · s<sub>i</sub></h4>'
        f'<div class="eval-comparison">{"".join(cards)}</div>'
        '<p class="eval-caption">' + _tag('measured', 'released DSGram-Eval') + ' human sub-scores and overall scores '
        '(annotation file 1, items 1, 4, 9, 11); Figure 5 prints the same sub-scores for its two pairs. '
        'Your judgments are applied to both outputs; DSGram elicits a separate matrix for every sentence pair.</p></div>')
    pair_html = (
        f'<div class="eval-pair"><p class="eval-pair-label">' + _tag('adapted', f'Figure 5({context_key})') + f' {_e(context["label"])}</p>'
        f'<dl><div><dt>Original</dt><dd>{_e(context["original"])}</dd></div>'
        f'<div><dt>Corrected</dt><dd>{_e(context["corrected"])}</dd></div></dl></div>')
    html = pair_html + f'<div class="eval-ahp-grid">{matrix_html}{weights_html}</div>' + scores_html
    return html, dsgram_verdict(context_key, positions, result, totals)


def _matrix_label(positions: Sequence[int], i: int, j: int) -> str:
    if i == j:
        return '1'
    for (a, b), position in zip(DSGRAM_PAIRS, positions):
        if (a, b) == (i, j):
            return saaty_label(position)
        if (a, b) == (j, i):
            return saaty_label(-position)
    return '1'


def dsgram_verdict(context_key: str, positions: Sequence[int], result: dict[str, Any],
                   totals: Sequence[float]) -> str:
    context = DSGRAM_CONTEXTS[context_key]
    cycle = cycle_text(positions)
    if result['cr'] < DSGRAM_CR_LIMIT:
        consistency = f'Consistent: CR = {_fmt(result["cr"])} is below 0.10, so Algorithm 1 accepts these weights.'
    else:
        consistency = (f'Inconsistent: CR = {_fmt(result["cr"])} ≥ 0.10. Algorithm 1 rejects this matrix and '
                       're-elicits the judgments; the weights are shown for inspection only.')
        if cycle:
            consistency = f'The judgments form a cycle ({cycle}). ' + consistency
    names = [c['name'].split(' · ')[-1] for c in context['corrections']]
    gap = abs(totals[0] - totals[1])
    if gap < 0.005:
        preference = f'Your weights tie {names[0]} and {names[1]}.'
    else:
        winner = 0 if totals[0] > totals[1] else 1
        preference = (f'Your weights prefer {names[winner]} by {_fmt(gap, 2)} points; the annotator gave '
                      f'{context["corrections"][0]["human"]} and {context["corrections"][1]["human"]}.')
    paper = (f'Figure 5 weights give the Figure 5 correction {_fmt(context["paper_score"], 2)}; '
             f'yours give {_fmt(totals[0], 2)}.')
    return f'{consistency} {preference} {paper}'


def _dsgram_controls(slug: str) -> str:
    contexts = _group('Sentence pair', ''.join(
        f'<button type="button" data-demo-action="context-{key}" aria-pressed="{str(key == "a").lower()}">{_e(item["button"])}</button>'
        for key, item in DSGRAM_CONTEXTS.items()))
    sliders = []
    preset = DSGRAM_CONTEXTS['a']['preset']
    for pair, (i, j) in enumerate(DSGRAM_PAIRS):
        ident = f'{slug}-judgment-{pair}'
        text = judgment_text(pair, preset[pair])
        sliders.append(
            f'<div class="eval-judgment"><label for="{ident}">{_e(DSGRAM_CRITERIA[i])} vs {_e(DSGRAM_CRITERIA[j]).lower()}</label>'
            f'<div class="eval-judgment-scale"><span aria-hidden="true">{DSGRAM_SHORT[i]}</span>'
            f'<input id="{ident}" type="range" min="-8" max="8" step="1" value="{preset[pair]}" '
            f'data-demo-range="judgment-{pair}" aria-valuetext="{_e(text)}">'
            f'<span aria-hidden="true">{DSGRAM_SHORT[j]}</span></div>'
            f'<output for="{ident}" data-eval-value="judgment-{pair}">{_e(text)}</output></div>')
    presets = _group('Starting judgments', ''.join([
        _button('preset-figure', 'Closest match to Figure 5', True),
        _button('preset-equal', 'Equal importance'),
        _button('preset-cyclic', 'Cyclic judgments')]))
    return (contexts + '<fieldset class="eval-judgments"><legend>Pairwise judgments on the 1–9 scale '
            '(slide toward the more important criterion)</legend>' + ''.join(sliders) + '</fieldset>' + presets)


def _dsgram(slug: str, demo: dict[str, Any]) -> str:
    config = {
        'criteria': DSGRAM_CRITERIA, 'short': DSGRAM_SHORT, 'pairs': DSGRAM_PAIRS,
        'ri': DSGRAM_RI, 'limit': DSGRAM_CR_LIMIT, 'words': SAATY_WORDS,
        'contexts': DSGRAM_CONTEXTS, 'presets': DSGRAM_PRESETS,
    }
    results, verdict = dsgram_results('a', DSGRAM_CONTEXTS['a']['preset'])
    return _shell(slug, demo, _dsgram_controls(slug), results, verdict, config)


# ---------------------------------------------------------------------------
# Data-to-text MQM annotation (Sections 4.1-4.3, Table 2, Table 6).
# ---------------------------------------------------------------------------

D2T_TRIPLES = [
    ['Austin Texas', 'is Part Of', 'Texas'],
    ['Texas', 'language', 'English language'],
    ['Austin Texas', 'is Part Of', 'Williamson County Texas'],
    ['Williamson County Texas', 'largest City', 'Round Rock Texas'],
    ['Williamson County Texas', 'county Seat', 'Georgetown Texas'],
]
# Table 2 output, verbatim. Punctuation is displayed but not counted as a word.
D2T_TOKENS = ('Austin is part of Williamson County Texas where the English is spoken . '
              'The largest city in Williamson County is Georgetown .').split(' ')
D2T_TYPES = {
    'Accuracy': ['Addition', 'Inaccuracy Intrinsic', 'Inaccuracy Extrinsic', 'Positive-Negative Aspect'],
    'Fluency': ['Duplication', 'Word Form', 'Word Order'],
}
D2T_SEVERITY = {'Minor': 1, 'Major': 3, 'Critical': 7}   # Section 4.3: ratio 1:3:7
D2T_PAPER_WORD = 20          # token index of "Georgetown"
D2T_PAPER_TRIPLE = 4         # county Seat relation
D2T_TABLE6 = [['Omission', 5.97], ['Inaccuracy Intrinsic', 5.25], ['Inaccuracy Extrinsic', 2.30],
              ['Addition', 1.48], ['Duplication', 0.63], ['Word Order', 0.56], ['Word Form', 0.23],
              ['Positive-Negative Aspect', 0.17]]


def _is_word(token: str) -> bool:
    return token not in {'.', ','}


D2T_WORDCOUNT = sum(1 for token in D2T_TOKENS if _is_word(token))


def mqm_score(penalty: float, wordcount: int = D2T_WORDCOUNT) -> float:
    """Equations 1-2 for one output: (1 - sum_e alpha_e * L_e / wordcount) * 100."""
    return (1 - penalty / wordcount) * 100


def _output_html(mark_paper: bool) -> str:
    parts = [f'<mark>{_e(token)}</mark>' if mark_paper and index == D2T_PAPER_WORD else _e(token)
             for index, token in enumerate(D2T_TOKENS)]
    # Keep the paper's spacing: "spoken ." and "Georgetown." as printed in Table 2.
    return ' '.join(parts[:-1]) + parts[-1]


def _triple_text(triple: Sequence[str]) -> str:
    return ' · '.join(triple)


def _severity_grid(highlight: tuple[str, str] | None = None) -> str:
    head = ''.join(f'<th scope="col">{name} ({alpha})</th>' for name, alpha in D2T_SEVERITY.items())
    rows = []
    for row_name, row_alpha in D2T_SEVERITY.items():
        cells = []
        for col_name, col_alpha in D2T_SEVERITY.items():
            value = mqm_score(row_alpha * 1 + col_alpha * 1)
            active = highlight == (row_name, col_name)
            active_class = ' class="is-active"' if active else ''
            cells.append(f'<td{active_class} data-eval-grid="{row_name}-{col_name}">{_fmt(value, 1)}</td>')
        rows.append(f'<tr><th scope="row">{row_name} ({row_alpha})</th>{"".join(cells)}</tr>')
    return ('<div class="eval-table-wrap" tabindex="0" role="region" aria-label="Score of the paper annotation by severity">'
            '<table class="eval-grid"><thead><tr><th scope="col">Inaccuracy Intrinsic ↓ · Omission →</th>'
            f'{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


D2T_EXAMPLE_TYPES = ('Omission', 'Inaccuracy Intrinsic')   # the two errors in the Table 2 annotation


def _table6_evidence(demo: dict[str, Any]) -> str:
    """Evidence-slot block: the measured Table 6 averages, ordered as printed by size."""
    top = max(value for _, value in D2T_TABLE6)
    example = ' class="is-example"'
    rows = ''.join(
        f'<tr{example if name in D2T_EXAMPLE_TYPES else ""}><th scope="row">{_e(name)}</th>'
        f'<td><span class="eval-bar eval-bar-wide" aria-hidden="true"><i style="width:{value / top * 100:.1f}%"></i></span>'
        f'<span data-eval-table6="{_e(name)}">{value:.2f}</span></td></tr>'
        for name, value in D2T_TABLE6)
    return f'''<section class="paper-demo evaluation-demo eval-evidence-block" data-eval-evidence="seq2seq-data2text" aria-labelledby="seq2seq-data2text-table6-title">
      <div class="eval-heading"><p class="eval-kicker">{_e(demo.get("evidence_eyebrow", "Measured · Table 6"))}</p><h3 id="seq2seq-data2text-table6-title">Which error types cost the most across the study</h3><p>Average severity-weighted, length-normalized error score of each type over all models and datasets (Table 6, lower is better). Each score is Σ α<sub>e</sub> L<sub>e</sub> / wordcount for that type, the quantity the annotation demo in Inside the method computes for one output.</p></div>
      <div class="eval-table-wrap" tabindex="0" role="region" aria-label="Table 6 average error scores"><table class="eval-table6"><thead><tr><th scope="col">Error type</th><th scope="col">Average error score ↓</th></tr></thead><tbody>{rows}</tbody></table></div>
      <p class="eval-caption">{_tag("measured", "Table 6")} printed averages. Shaded rows are the two error types of the Table 2 example (Omission and Inaccuracy Intrinsic); they carry the two largest average penalties. The other six types together sum to 5.37.</p>
    </section>'''


def _paper_annotation_html() -> str:
    return (
        '<div class="eval-block"><h4>The paper’s annotation of this output</h4>'
        '<div class="eval-table-wrap" tabindex="0" role="region" aria-label="Paper annotation">'
        '<table class="eval-annotation"><thead><tr><th scope="col">Segment</th><th scope="col">Type</th>'
        '<th scope="col">Severity</th><th scope="col">L</th></tr></thead><tbody>'
        '<tr><th scope="row">Georgetown</th><td>Inaccuracy Intrinsic</td><td>not reported</td><td>1</td></tr>'
        '<tr><th scope="row">county Seat relation (missing)</th><td>Omission</td><td>not reported</td><td>1 (fixed)</td></tr>'
        '</tbody></table></div>'
        '<p class="eval-caption">' + _tag('adapted', 'Table 2 caption') + ' Georgetown is the county seat, not the largest '
        'city, so it is an Inaccuracy Intrinsic error; the county seat is never mentioned, so there is an Omission. '
        'The paper does not give the severities, so the score of its annotation depends on them:</p>'
        + _severity_grid() +
        f'<p class="eval-caption">' + _tag('computed', 'Equation 2') + f' (1 − (α<sub>1</sub> + α<sub>2</sub>) / {D2T_WORDCOUNT}) × 100 '
        f'for one output of {D2T_WORDCOUNT} words.</p></div>')


def _d2t_static() -> str:
    missing = '<small>paper: not expressed in the output</small>'
    triples = ''.join(
        f'<li><span>{_e(_triple_text(t))}</span>'
        f'{missing if index == D2T_PAPER_TRIPLE else ""}</li>'
        for index, t in enumerate(D2T_TRIPLES))
    return (
        '<div class="eval-block eval-d2t-source"><h4>Input triples · Table 2</h4>'
        f'<ol class="eval-triples">{triples}</ol>'
        '<h4>Model output · Table 2</h4>'
        f'<p class="eval-output">{_output_html(True)}</p></div>'
        + _paper_annotation_html())


def _d2t_controls(slug: str) -> str:
    options = ''.join(
        f'<optgroup label="{_e(group)}">' + ''.join(
            f'<option value="{_e(name)}"{" selected" if name == "Inaccuracy Intrinsic" else ""}>{_e(name)}</option>'
            for name in names) + '</optgroup>'
        for group, names in D2T_TYPES.items())
    severity = ''.join(
        f'<button type="button" data-demo-action="severity-{name.lower()}" data-severity="{name}" '
        f'aria-pressed="{str(name == "Major").lower()}">{name} · α {alpha}</button>'
        for name, alpha in D2T_SEVERITY.items())
    paper_note = '<small class="eval-paper-note" data-eval-paper-note hidden>paper: omitted</small>'
    triples = ''.join(
        f'<li><span>{_e(_triple_text(t))}</span>'
        f'{paper_note if index == D2T_PAPER_TRIPLE else ""}<button type="button" class="eval-omit" data-d2t-triple="{index}" '
        f'aria-pressed="false" aria-label="Mark triple {index + 1} as omitted: {_e(_triple_text(t))}">Mark omitted</button></li>'
        for index, t in enumerate(D2T_TRIPLES))
    words = []
    for index, token in enumerate(D2T_TOKENS):
        if _is_word(token):
            words.append(f'<button type="button" class="eval-word" data-d2t-word="{index}" aria-pressed="false">{_e(token)}</button>')
        else:
            words.append(f'<span class="eval-punct">{_e(token)}</span>')
    return (
        '<div class="eval-label-picker">'
        f'<label class="eval-select" for="{slug}-type"><span>Error type</span>'
        f'<select id="{slug}-type" data-demo-select="type">{options}</select></label>'
        + _group('Severity', severity) + '</div>'
        '<h4>Input triples · Table 2 · mark any that the output omits</h4>'
        f'<ol class="eval-triples eval-triples-edit">{triples}</ol>'
        '<h4>Model output · Table 2 · select erroneous words</h4>'
        f'<p class="eval-words">{" ".join(words)}</p>'
        '<p class="eval-control-help">Selecting a word applies the current type and severity; selecting it again '
        'with the same label removes it. Adjacent words with the same label form one error segment. '
        'An omitted triple counts as length 1.</p>'
        + _group('Annotation', _button('reveal', 'Compare with the paper’s annotation') + _button('clear', 'Clear my annotation')))


def _data2text(slug: str, demo: dict[str, Any]) -> dict[str, str]:
    """The annotation mechanism goes to Method; the measured Table 6 averages go to Evidence."""
    config = {
        'triples': D2T_TRIPLES, 'tokens': D2T_TOKENS, 'wordcount': D2T_WORDCOUNT,
        'severity': D2T_SEVERITY, 'paperWord': D2T_PAPER_WORD, 'paperTriple': D2T_PAPER_TRIPLE,
    }
    verdict = ('The paper marks two errors here but does not report their severities: with both Major the '
               f'output scores {_fmt(mqm_score(6), 1)}; the range is {_fmt(mqm_score(14), 1)} to {_fmt(mqm_score(2), 1)}.')
    return {'method': _shell(slug, demo, _d2t_controls(slug), _d2t_static(), verdict, config),
            'evidence': _table6_evidence(demo)}


# ---------------------------------------------------------------------------
# Cont-COMET context selection (Section 2.2).
# ---------------------------------------------------------------------------

CONTEXT_TARGET = 'They returned to the bank.'
# Illustrative document. The nearest previous sentence is deliberately neutral, so
# that an adjacent window and similarity-based selection can disagree.
CONTEXT_SENTENCES = [
    {'id': '−3', 'distance': 3, 'side': 'previous', 'text': 'Their canoe had drifted downstream.', 'similarity': 0.92},
    {'id': '−2', 'distance': 2, 'side': 'previous', 'text': 'They spent the afternoon outdoors.', 'similarity': 0.38},
    {'id': '−1', 'distance': 1, 'side': 'previous', 'text': 'It had been a long day.', 'similarity': 0.45},
    {'id': '+1', 'distance': 1, 'side': 'following', 'text': 'They pulled the canoe onto the shore.', 'similarity': 0.88},
    {'id': '+2', 'distance': 2, 'side': 'following', 'text': 'The trip ended before sunset.', 'similarity': 0.31},
]
CONTEXT_DEFAULTS = {'budget': 2, 'decay': 0.80, 'previous_only': False}


def context_selection(budget: int, decay: float, previous_only: bool,
                      similarities: Sequence[float] | None = None) -> tuple[list[dict[str, Any]], set[str], set[str]]:
    """Score = cosine similarity x alpha^|i-j|; take the top `budget`; compare with an adjacent window."""
    cosines = similarities or [item['similarity'] for item in CONTEXT_SENTENCES]
    scored = [{**item, 'similarity': cos, 'score': cos * decay ** item['distance'],
               'eligible': not previous_only or item['side'] == 'previous'}
              for item, cos in zip(CONTEXT_SENTENCES, cosines)]
    eligible = [item for item in scored if item['eligible']]
    selected = {item['id'] for item in sorted(eligible, key=lambda s: -s['score'])[:budget]}
    # Adjacent window of the same size: nearest first, previous sentence first on a tie.
    window = {item['id'] for item in sorted(eligible, key=lambda s: (s['distance'], s['side'] != 'previous'))[:budget]}
    return scored, selected, window


def _ids(scored: Sequence[dict[str, Any]], keep: set[str]) -> str:
    """Sentence ids in document order, e.g. '−3 and +1'."""
    names = [item['id'] for item in scored if item['id'] in keep]
    return ' and '.join(names) if len(names) < 3 else ', '.join(names[:-1]) + ' and ' + names[-1]


def _context_results(budget: int, decay: float, previous_only: bool) -> tuple[str, str]:
    scored, selected, window = context_selection(budget, decay, previous_only)

    def row(item: dict[str, Any]) -> str:
        status = 'Outside window' if not item['eligible'] else 'Selected' if item['id'] in selected else 'Not selected'
        classes = ' is-selected' if item['id'] in selected else ' is-excluded' if not item['eligible'] else ''
        return (f'<li class="eval-context-row{classes}"><span class="eval-position">{item["id"]}</span>'
                f'<div><p>{_e(item["text"])}</p><small>cos {item["similarity"]:.2f} × {decay:.2f}<sup>{item["distance"]}</sup></small></div>'
                f'<span class="eval-context-number">{item["score"]:.3f}<small>{status}</small></span></li>')

    before = [item for item in scored if item['side'] == 'previous']
    after = [item for item in scored if item['side'] == 'following']
    html = ('<p class="eval-formula">Sim(R<sub>i</sub>, R<sub>j</sub>) = cos(r<sub>i</sub>, r<sub>j</sub>) · α<sup>|i−j|</sup></p>'
            '<ol class="eval-context-list">' + ''.join(row(item) for item in before)
            + f'<li class="eval-context-target"><span>Current reference</span><strong>{_e(CONTEXT_TARGET)}</strong>'
            '<small>“bank” is ambiguous: a river bank or a financial bank. Only the context can tell the evaluator which one the translation must preserve.</small></li>'
            + ''.join(row(item) for item in after) + '</ol>'
            '<p class="eval-caption">' + _tag('illustrative') + ' document and cosine values (editable above); α is not '
            'reported in the paper. ' + _tag('adapted', 'Section 2.2') + ' selection rule; selection also stops before the '
            '512-token encoder limit, which this short document never reaches.</p>')
    return html, _context_verdict(scored, selected, window)


def _context_verdict(scored: Sequence[dict[str, Any]], selected: set[str], window: set[str]) -> str:
    before = [item['id'] for item in scored if item['side'] == 'previous' and item['id'] in selected]
    after = [item['id'] for item in scored if item['side'] == 'following' and item['id'] in selected]
    chain = ' → '.join(before + ['current'] + after)
    count = len(selected)
    text = f'{count} context sentence{"s" if count != 1 else ""} selected, in document order: {chain}. '
    if selected == window:
        return text + 'It matches an adjacent window of the same size.'
    return (text + f'An adjacent window of the same size would use {_ids(scored, window - selected)} '
            f'instead of {_ids(scored, selected - window)}.')


def _context(slug: str, demo: dict[str, Any]) -> str:
    config = {'target': CONTEXT_TARGET, 'sentences': CONTEXT_SENTENCES}
    budget, decay = CONTEXT_DEFAULTS['budget'], CONTEXT_DEFAULTS['decay']
    controls = _group('Eligible context', _button('both', 'Previous and following', True) + _button('previous', 'Previous only'))
    controls += ('<div class="eval-range-grid eval-two-ranges">'
                 + _range(slug, 'budget', 'Sentence budget', 1, 5, budget, str(budget))
                 + _range(slug, 'decay', 'Distance factor α', 10, 100, round(decay * 100), f'{decay:.2f}') + '</div>')
    cosines = ''.join(
        f'<label class="eval-number" for="{slug}-cos-{index}"><span>{_e(item["id"])}</span>'
        f'<input id="{slug}-cos-{index}" type="number" min="0" max="1" step="0.01" value="{item["similarity"]:.2f}" '
        f'inputmode="decimal" data-demo-range="cos-{index}"></label>'
        for index, item in enumerate(CONTEXT_SENTENCES))
    controls += ('<fieldset class="eval-distances"><legend>Cosine similarity of each sentence to the current reference '
                 f'(illustrative; set your own between 0 and 1)</legend>{cosines}</fieldset>')
    controls += ('<p class="eval-control-help">The paper evaluates budgets of 2, 4, 6 and 8 sentences (Table 2); '
                 '“Previous only” corresponds to the “w/ previous sentences” ablation in Table 3.</p>')
    results, verdict = _context_results(budget, decay, CONTEXT_DEFAULTS['previous_only'])
    return _shell(slug, demo, controls, results, verdict, config)


# ---------------------------------------------------------------------------
# RERIC n-gram reranking (Equation 11, Table 3, Figure 1).
# ---------------------------------------------------------------------------

RERIC_QUERY = ['这', '以', '个']
RERIC_CANDIDATES = [
    {'tokens': ['这', '以', '后'], 'gloss': 'after this', 'distance': 0.20},
    {'tokens': ['这', '一', '个'], 'gloss': 'this one', 'distance': 0.30},
    {'tokens': ['这', '几', '个'], 'gloss': 'these few', 'distance': 0.50},
]
RERIC_WEIGHTS = (1.68, 0.68, 1.68)   # Table 3
RERIC_N = 3                          # 3-gram values (Table 3)
# 'weights' divides by the sum of the weights, so that a full match gives alpha = 1;
# 'printed' divides by n = 3 as Equation 11 is printed.
RERIC_NORMALIZATIONS = {'weights': 'Normalized by Σw', 'printed': 'As printed (÷ n = 3)'}
RERIC_FIGURE1_TOP = '这一个'
RERIC_DIFFERENCE = ('Equation 11 as printed divides by n = 3, but the Table 3 weights sum to 4.04, so a candidate that '
                    'matches both neighbors gets α = 3.36 / 3 = 1.12 and a negative d′ that ranks a farther candidate higher; '
                    'dividing by the sum of the weights keeps α between 0 and 1, gives α = 1 for a full match, and '
                    'reproduces Figure 1’s ranking. With equal weights the two normalizations coincide.')


def reric_denominator(weights: Sequence[float], normalization: str) -> float:
    return sum(weights) if normalization == 'weights' else float(RERIC_N)


def reric_rank(distances: Sequence[float], weights: Sequence[float], rerank: bool = True,
               normalization: str = 'weights') -> list[dict[str, Any]]:
    """Equation 11: alpha = sum_i 1[v(i) = g(i)] w_i / Z and d' = (1 - alpha) d, with Z = sum(w) or n = 3."""
    denominator = reric_denominator(weights, normalization)
    rows = []
    for index, (candidate, distance) in enumerate(zip(RERIC_CANDIDATES, distances)):
        matched = sum(w for token, query, w in zip(candidate['tokens'], RERIC_QUERY, weights) if token == query)
        overlap = matched / denominator if denominator > 0 else 0.0
        adjusted = (1 - overlap) * distance if rerank else distance
        rows.append({'index': index, 'overlap': overlap, 'distance': distance, 'adjusted': adjusted})
    return sorted(rows, key=lambda row: row['adjusted'])


def reric_verdict(ranked: Sequence[dict[str, Any]], rerank: bool) -> str:
    top = RERIC_CANDIDATES[ranked[0]['index']]
    name = ''.join(top['tokens'])
    if not rerank:
        return (f'Nearest candidate: {name}. Without reranking, the nearest retrieved n-gram decides, and its center '
                f'{top["tokens"][1]} {"repeats the input error" if top["tokens"][1] == RERIC_QUERY[1] else "becomes the correction"}.')
    negative = [row for row in ranked if row['overlap'] > 1]
    text = f'Nearest candidate: {name}. '
    if top['tokens'][1] == RERIC_QUERY[1]:
        text += 'A match on the uncertain center still earns enough overlap to keep the input error.'
    elif negative:
        names = ' and '.join(''.join(RERIC_CANDIDATES[row['index']]['tokens']) for row in negative)
        text += (f'α exceeds 1 for {names}, so (1 − α) is negative and a larger retrieval distance gives a '
                 'smaller adjusted distance.')
        if name != RERIC_FIGURE1_TOP:
            text += f' Figure 1 instead shows {RERIC_FIGURE1_TOP} (“this one”) as the most probable correction.'
    else:
        text += 'Matching both correct neighbors outweighs matching the uncertain center.'
        if name == RERIC_FIGURE1_TOP:
            text += ' This is Figure 1’s ranking: 这一个 (“this one”) is the most probable correction.'
    return text


def _reric_formula(weights: Sequence[float], normalization: str) -> str:
    denominator = 'Σ<sub>i</sub> w<sub>i</sub>' if normalization == 'weights' else '3'
    total = f' = {sum(weights):.2f}' if normalization == 'weights' else ''
    return (f'α = Σ<sub>i</sub> 1[v(i) = g(i)] · w<sub>i</sub> / {denominator}{total};  d′ = (1 − α) · d;'
            f'  w = ({weights[0]:.2f}, {weights[1]:.2f}, {weights[2]:.2f})')


def _reric_results(distances: Sequence[float], weights: Sequence[float], rerank: bool,
                   normalization: str = 'weights') -> tuple[str, str]:
    ranked = reric_rank(distances, weights, rerank, normalization)
    rows = []
    for rank, row in enumerate(ranked):
        candidate = RERIC_CANDIDATES[row['index']]
        tokens = ''.join(
            f'<span class="eval-character{" is-match" if token == RERIC_QUERY[i] else ""}{" is-center" if i == 1 else ""}">{_e(token)}</span>'
            for i, token in enumerate(candidate['tokens']))
        winner_class = ' class="is-winner"' if rank == 0 else ''
        rows.append(
            f'<tr{winner_class}><th scope="row"><span class="eval-rank">{rank + 1}</span>'
            f'<span lang="zh">{tokens}</span><small>{_e(candidate["gloss"])}</small></th>'
            f'<td>{_fmt(row["distance"])}</td><td>{_fmt(row["overlap"])}</td>'
            f'<td><strong>{_fmt(row["adjusted"])}</strong></td></tr>')
    rule = (' α divided by Σw, so a full match gives α = 1.' if normalization == 'weights'
            else ' as printed: α divided by n = 3.')
    html = (
        '<p class="eval-query">Input window <span lang="zh">这<mark>以</mark>个</span>'
        '<small>from “这以个重大发…”, Figure 1; 以 is a misspelling, corrected as in 这一个 (“this one”)</small></p>'
        f'<p class="eval-formula" data-eval-formula>{_reric_formula(weights, normalization)}</p>'
        '<div class="eval-table-wrap" tabindex="0" role="region" aria-label="Candidate reranking">'
        '<table><thead><tr><th scope="col">Rank · retrieved 3-gram</th><th scope="col">Distance d</th>'
        f'<th scope="col">Overlap α</th><th scope="col">{"Adjusted d′" if rerank else "Ranking distance"} ↓</th></tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table></div>'
        '<p class="eval-caption">' + _tag('adapted', 'Figure 1') + ' input and candidates. '
        + _tag('adapted', 'Equation 11') + f'{_e(rule)} '
        + _tag('adapted', 'Table 3') + ' weights w = (1.68, 0.68, 1.68), n = 3. ' + _tag('illustrative') + ' l2 distances in Figure 1’s '
        'retrieval order; the paper does not print them.</p>')
    return html, reric_verdict(ranked, rerank)


def _reric(slug: str, demo: dict[str, Any]) -> str:
    config = {'query': RERIC_QUERY, 'candidates': RERIC_CANDIDATES, 'paperWeights': RERIC_WEIGHTS,
              'n': RERIC_N, 'figureTop': RERIC_FIGURE1_TOP}
    controls = _group('Ranking', _button('raw', 'Retrieval distance only') + _button('rerank', 'Equation 11 reranking', True))
    controls += _group('Normalization', ''.join(
        _button(f'norm-{key}', label, key == 'weights') for key, label in RERIC_NORMALIZATIONS.items()))
    controls += f'<p class="eval-control-help eval-norm-help">{_e(RERIC_DIFFERENCE)}</p>'
    controls += _group('Weights', _button('weights-paper', 'Table 3 weights', True) + _button('weights-equal', 'Equal weights (1, 1, 1)'))
    controls += ('<div class="eval-range-grid eval-two-ranges">'
                 + _range(slug, 'neighbor', 'Neighbor weight w₁ = w₃', 0, 200, 168, '1.68')
                 + _range(slug, 'center', 'Center weight w₂', 0, 200, 68, '0.68') + '</div>')
    distances = ''.join(
        f'<label class="eval-number" for="{slug}-distance-{index}"><span lang="zh">{"".join(c["tokens"])}</span>'
        f'<input id="{slug}-distance-{index}" type="number" min="0.01" max="5" step="0.01" value="{c["distance"]:.2f}" '
        f'inputmode="decimal" data-demo-range="distance-{index}"></label>'
        for index, c in enumerate(RERIC_CANDIDATES))
    controls += (f'<fieldset class="eval-distances"><legend>Retrieval distances d (illustrative; set your own)</legend>{distances}</fieldset>')
    results, verdict = _reric_results([c['distance'] for c in RERIC_CANDIDATES], RERIC_WEIGHTS, True, 'weights')
    return _shell(slug, demo, controls, results, verdict, config)


def render_demo(slug: str, insight: dict[str, Any]) -> str | dict[str, str]:
    """Render one evaluation demo, or an empty string for pages owned by other modules."""
    owned_slugs = {'dsgram', 'context-aware-evaluation', 'error-robust-retrieval', 'seq2seq-data2text'}
    if slug not in owned_slugs:
        return ''
    demo = insight.get('demo')
    if not demo:
        return ''
    renderers = {
        'dsgram-ahp': _dsgram,
        'context-selection': _context,
        'reric-reranking': _reric,
        'data2text-annotate': _data2text,
    }
    renderer = renderers.get(demo.get('kind'))
    return renderer(slug, demo) if renderer else ''
