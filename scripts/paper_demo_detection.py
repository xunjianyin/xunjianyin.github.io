"""Two demos for the AGENT-X page (AI-generated text detection, arXiv 2505.15261v1).

* Method slot, `calibration`: one guideline agent's semantic-steering calibration
  (Section 4.2). The reader sets the label and verbalized confidence returned under each
  of the five steering prompts (Appendix G); these outputs are ILLUSTRATIVE. The page
  computes the paper's quantities exactly as printed in Section 4.2:

      kappa_ans  = max_y #{k : f_k(x) = y} / |P|                  (|P| = 5 prompts)
      mu_c       = mean of c_k(x),  sigma_c = population standard deviation of c_k(x)
      kappa_conf = 1 / (1 + sigma_c / mu_c)
      c_cal      = mu_c * kappa_ans * kappa_conf
      k*         = argmin_k |c_k(x) - c_cal|,  reported label f_final = f_{k*}

  The paper does not say how ties in the argmin are broken; here the first prompt in the
  listed order (very cautious first) wins.

* Evidence slot, `metrics`: every accuracy (Tables 1-2) and AUROC (Tables 5-6) value the
  paper prints, per source model and dataset. Ranks and the "higher AUROC but lower
  accuracy" comparison are computed from those printed values.

Every renderer returns a complete, readable state computed here in Python;
`papers/demos/detection.js` repeats the same computation when the reader changes an
input. No model or network call runs.
"""
from __future__ import annotations

from html import escape
import json
import math
from typing import Any

SLUG = 'agent-x'
PAPER = 'https://arxiv.org/abs/2505.15261'

TAG_LABELS = {'measured': 'Measured', 'published': 'Published', 'illustrative': 'Illustrative',
              'computed': 'Computed'}


def _e(value: Any) -> str:
    return escape(str(value), quote=True)


def _tag(kind: str, reference: str = '') -> str:
    """Provenance label such as "Measured · Table 1"; the word states the kind, color is secondary."""
    text = TAG_LABELS[kind] + (f' · {reference}' if reference else '')
    return f'<span class="dt-tag dt-tag-{_e(kind)}">{_e(text)}</span>'


def fmt(value: float, digits: int = 3) -> str:
    """Round half up, like Math.floor(x * 10^d + 0.5) in detection.js, so both print the same text."""
    scale = 10 ** digits
    n = int(math.floor(value * scale + 0.5))
    sign = '−' if n < 0 else ''
    n = abs(n)
    return f'{sign}{n // scale}.{n % scale:0{digits}d}'


def _button(action: str, label: str, pressed: bool = False, extra: str = '') -> str:
    return (f'<button type="button" data-demo-action="{_e(action)}" aria-pressed="{str(pressed).lower()}"{extra}>'
            f'{_e(label)}</button>')


def _group(label: str, buttons: str) -> str:
    return (f'<div class="dt-button-row" role="group" aria-label="{_e(label)}">'
            f'<span class="dt-group-label" aria-hidden="true">{_e(label)}</span>{buttons}</div>')


def _shell(slug: str, key: str, demo: dict[str, Any], controls: str, results: str, verdict: str,
           config: dict[str, Any]) -> str:
    # The JSON lives in a non-executable script and is escaped against closing tags.
    encoded = json.dumps(config, ensure_ascii=False).replace('<', '\\u003c')
    ident = f'{slug}-{key}'
    links = ''.join(f'<a href="{_e(item["url"])}">{_e(item["label"])} ↗</a>' for item in demo.get('sources', []))
    sources = f'<span class="dt-source-links">{links}</span>' if links else ''
    return f'''<section class="paper-demo detection-demo" data-paper-demo="{_e(ident)}" data-detection-demo="{_e(key)}" aria-labelledby="{_e(ident)}-title">
      <header class="dt-heading"><p class="dt-kicker">{_e(demo["eyebrow"])}</p><h3 id="{_e(ident)}-title">{_e(demo["title"])}</h3><p>{_e(demo["description"])}</p></header>
      <div class="dt-controls" data-demo-controls hidden>{controls}</div>
      <div class="dt-state" data-demo-state><div class="dt-results" data-dt-results>{results}</div><p class="dt-verdict" role="status" aria-live="polite" data-dt-verdict>{_e(verdict)}</p></div>
      <p class="dt-disclosure">{_e(demo["note"])}{sources}</p>
      <script type="application/json" class="dt-config">{encoded}</script>
    </section>'''


# ===========================================================================
# Method: semantic-steering calibration of one guideline agent (Section 4.2).
# ===========================================================================

# The five steering prompts in the order printed in Appendix G ("Steer Calibration
# Prompt"), with the closing instruction each prompt gives about confidence.
PROMPTS: list[dict[str, str]] = [
    {'id': 'very-cautious', 'name': 'Very cautious', 'instruction': 'Make your confidence low.'},
    {'id': 'cautious', 'name': 'Cautious', 'instruction': 'Make your confidence somewhat low.'},
    {'id': 'vanilla', 'name': 'Vanilla', 'instruction': 'Report your true confidence.'},
    {'id': 'confident', 'name': 'Confident', 'instruction': 'Make your confidence somewhat high.'},
    {'id': 'very-confident', 'name': 'Very confident', 'instruction': 'Make your confidence high.'},
]
LABELS = ('AI', 'Human')
# Illustrative steered outputs: (label, confidence in hundredths). The paper prints no
# per-prompt outputs, only each agent's final calibrated confidence (Appendix B).
PRESETS: dict[str, dict[str, Any]] = {
    'agree': {'name': 'All five say AI',
              'outputs': [('AI', 30), ('AI', 45), ('AI', 60), ('AI', 75), ('AI', 90)]},
    'cautious-dissent': {'name': 'Very cautious says Human',
                         'outputs': [('Human', 30), ('AI', 45), ('AI', 60), ('AI', 75), ('AI', 90)]},
    'confident-dissent': {'name': 'Two confident prompts say Human',
                          'outputs': [('AI', 30), ('AI', 45), ('AI', 60), ('Human', 75), ('Human', 90)]},
}
DEFAULT_PRESET = 'agree'
CONF_MIN, CONF_MAX, CONF_STEP = 5, 100, 5   # hundredths; mu_c stays positive


def calibrate(outputs: list[tuple[str, int]]) -> dict[str, Any]:
    """Section 4.2: answer consistency, confidence consistency, calibrated confidence, k*.

    The operation order matches detection.js so that both produce identical doubles.
    """
    confidences = [hundredths / 100 for _, hundredths in outputs]
    n = len(confidences)
    counts = {label: sum(1 for value, _ in outputs if value == label) for label in LABELS}
    majority = 'AI' if counts['AI'] >= counts['Human'] else 'Human'
    kappa_ans = counts[majority] / n
    mu = 0.0
    for c in confidences:
        mu += c
    mu = mu / n
    variance = 0.0
    for c in confidences:
        variance += (c - mu) * (c - mu)
    sigma = math.sqrt(variance / n)
    kappa_conf = 1 / (1 + sigma / mu)
    c_cal = mu * kappa_ans * kappa_conf
    distances = [abs(c - c_cal) for c in confidences]
    k_star = 0
    for k in range(1, n):
        if distances[k] < distances[k_star]:   # strict: ties keep the earlier prompt
            k_star = k
    return {'confidences': confidences, 'counts': counts, 'majority': majority, 'kappa_ans': kappa_ans,
            'mu': mu, 'sigma': sigma, 'kappa_conf': kappa_conf, 'c_cal': c_cal, 'distances': distances,
            'k_star': k_star, 'label': outputs[k_star][0]}


def _pct(value: float) -> str:
    """CSS left/width percentage for a value in [0, 1]."""
    return f'{max(0.0, min(1.0, value)) * 100:.2f}%'


def calibration_rows(outputs: list[tuple[str, int]], result: dict[str, Any]) -> str:
    rows = []
    for k, (prompt, (label, hundredths)) in enumerate(zip(PROMPTS, outputs)):
        selected = k == result['k_star']
        mark = 'is-ai' if label == 'AI' else 'is-human'
        chosen = '<span class="dt-chosen">closest to c_cal</span>' if selected else ''
        rows.append(
            f'<li class="dt-steer-row{" is-selected" if selected else ""}" data-dt-row="{k}">'
            f'<span class="dt-steer-name">{_e(prompt["name"])}<small>“{_e(prompt["instruction"])}”</small></span>'
            f'<span class="dt-track" aria-hidden="true"><i class="dt-tick dt-tick-mean" style="left:{_pct(result["mu"])}"></i>'
            f'<i class="dt-tick dt-tick-cal" style="left:{_pct(result["c_cal"])}"></i>'
            f'<i class="dt-mark {mark}" style="left:{_pct(hundredths / 100)}"></i></span>'
            f'<span class="dt-steer-value"><b>{_e(label)}</b> {fmt(hundredths / 100, 2)}</span>'
            f'<span class="dt-steer-dist">|c<sub>k</sub> − c<sub>cal</sub>| {fmt(result["distances"][k])}{chosen}</span></li>')
    axis = ('<li class="dt-steer-axis" aria-hidden="true"><span></span><span class="dt-axis">'
            '<i style="left:0%">0</i><i style="left:50%">0.5</i><i style="left:100%">1</i></span><span></span><span></span></li>')
    return ''.join(rows) + axis


def calibration_readout(result: dict[str, Any]) -> str:
    counts = result['counts']
    majority_count = counts[result['majority']]
    prompt = PROMPTS[result['k_star']]['name']
    return (
        '<dl class="dt-readout">'
        f'<div><dt>Answer consistency</dt><dd>κ<sub>ans</sub> = {majority_count}/5 = {fmt(result["kappa_ans"])}</dd></div>'
        f'<div><dt>Mean confidence</dt><dd>μ<sub>c</sub> = {fmt(result["mu"])}</dd></div>'
        f'<div><dt>Spread</dt><dd>σ<sub>c</sub> = {fmt(result["sigma"])}</dd></div>'
        f'<div><dt>Confidence consistency</dt><dd>κ<sub>conf</sub> = 1 / (1 + σ<sub>c</sub>/μ<sub>c</sub>) = {fmt(result["kappa_conf"])}</dd></div>'
        f'<div class="is-key"><dt>Calibrated confidence</dt><dd>c<sub>cal</sub> = μ<sub>c</sub> · κ<sub>ans</sub> · κ<sub>conf</sub> = {fmt(result["c_cal"])}</dd></div>'
        f'<div class="is-key"><dt>Reported label</dt><dd>{_e(result["label"])}, from the {_e(prompt.lower())} prompt</dd></div>'
        '</dl>')


def calibration_verdict(outputs: list[tuple[str, int]], result: dict[str, Any]) -> str:
    counts = result['counts']
    k = result['k_star']
    prompt = PROMPTS[k]['name'].lower()
    text = (f'Majority label {result["majority"]} ({counts[result["majority"]]} of 5 prompts). '
            f'The agent reports {result["label"]} with confidence {fmt(result["c_cal"])}: '
            f'the {prompt} prompt’s confidence ({fmt(outputs[k][1] / 100, 2)}) is closest to c_cal. ')
    if result['label'] == result['majority']:
        text += 'The reported label agrees with the majority.'
    else:
        text += 'The reported label is the minority label.'
    return text


def render_calibration(slug: str, demo: dict[str, Any]) -> str:
    outputs = PRESETS[DEFAULT_PRESET]['outputs']
    result = calibrate(outputs)
    presets = ''.join(_button(f'preset:{key}', preset['name'], key == DEFAULT_PRESET)
                      for key, preset in PRESETS.items())
    inputs = []
    for k, (prompt, (label, hundredths)) in enumerate(zip(PROMPTS, outputs)):
        ident = f'{slug}-steer-{k}'
        toggles = ''.join(_button(f'label:{k}:{value}', value, value == label,
                                  f' aria-label="{_e(prompt["name"])} prompt label {value}"') for value in LABELS)
        inputs.append(
            f'<div class="dt-input-row"><span class="dt-input-name">{_e(prompt["name"])}</span>'
            f'<span class="dt-toggle" role="group" aria-label="{_e(prompt["name"])} prompt label">{toggles}</span>'
            f'<label class="dt-range" for="{ident}"><span>Confidence <output for="{ident}" data-dt-conf="{k}">{fmt(hundredths / 100, 2)}</output></span>'
            f'<input id="{ident}" type="range" min="{CONF_MIN}" max="{CONF_MAX}" step="{CONF_STEP}" value="{hundredths}" data-demo-range="conf:{k}"></label></div>')
    controls = (_group('Start from', presets)
                + f'<div class="dt-inputs" role="group" aria-label="Illustrative steered outputs">{"".join(inputs)}</div>'
                + '<p class="dt-help">Each row is one steered query of the same guideline agent. Change a label or a confidence; everything below is recomputed with the Section 4.2 equations.</p>')
    results = (
        f'<div class="dt-block"><h4>Five steered outputs {_tag("illustrative", "your inputs")}</h4>'
        f'<ol class="dt-steer" data-dt-steer>{calibration_rows(outputs, result)}</ol>'
        '<p class="dt-key" aria-hidden="true"><span><i class="dt-mark is-ai"></i><span>AI label</span></span>'
        '<span><i class="dt-mark is-human"></i><span>Human label</span></span>'
        '<span><i class="dt-key-mean"></i><span>Mean μ<sub>c</sub></span></span>'
        '<span><i class="dt-key-cal"></i><span>Calibrated c<sub>cal</sub></span></span></p></div>'
        f'<div class="dt-block"><h4>Calibration {_tag("computed", "Section 4.2 equations")}</h4>'
        f'<div data-dt-readout>{calibration_readout(result)}</div></div>')
    config = {'prompts': PROMPTS, 'labels': list(LABELS),
              'presets': {key: [list(pair) for pair in preset['outputs']] for key, preset in PRESETS.items()},
              'defaultPreset': DEFAULT_PRESET}
    return _shell(slug, 'calibration', demo, controls, results, calibration_verdict(outputs, result), config)


# ===========================================================================
# Evidence: accuracy (Tables 1-2) against AUROC (Tables 5-6), as printed.
# ===========================================================================

MODELS = [
    {'id': 'chatgpt', 'name': 'ChatGPT', 'detail': 'gpt-3.5-turbo'},
    {'id': 'gpt4', 'name': 'GPT-4', 'detail': 'gpt-4-0613'},
    {'id': 'opus', 'name': 'Claude-3-Opus', 'detail': 'claude-3-opus-20240229'},
    {'id': 'sonnet', 'name': 'Claude-3-Sonnet', 'detail': 'claude-3-sonnet-20240229'},
]
DATASETS = [
    {'id': 'xsum', 'name': 'XSum', 'detail': 'news'},
    {'id': 'writing', 'name': 'Writing', 'detail': 'WritingPrompts stories'},
    {'id': 'pubmed', 'name': 'PubMed', 'detail': 'PubMedQA answers'},
    {'id': 'avg', 'name': 'Average', 'detail': 'mean of the three'},
]
# Detectors in the printed row order. 'kind' groups them as in Section 5.3.
METHODS = [
    {'id': 'roberta-base', 'name': 'RoBERTa-base', 'kind': 'supervised'},
    {'id': 'roberta-large', 'name': 'RoBERTa-large', 'kind': 'supervised'},
    {'id': 'gptzero', 'name': 'GPTZero', 'kind': 'supervised'},
    {'id': 'likelihood', 'name': 'Likelihood (Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'entropy', 'name': 'Entropy (Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'rank', 'name': 'Rank (Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'logrank', 'name': 'LogRank (Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'lrr', 'name': 'LRR (Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'dna-gpt', 'name': 'DNA-GPT (Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'npr', 'name': 'NPR (T5-11B/Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'detectgpt', 'name': 'DetectGPT (T5-11B/Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'fast-detect', 'name': 'Fast-Detect (GPT-J/Neo-2.7)', 'kind': 'zero-shot'},
    {'id': 'fast-detect-phi2', 'name': 'Fast-Detect (Phi2-2.7B)', 'kind': 'zero-shot'},
    {'id': 'fast-detect-qwen', 'name': 'Fast-Detect (Qwen2.5-7B)', 'kind': 'zero-shot'},
    {'id': 'fast-detect-llama', 'name': 'Fast-Detect (Llama3-8B)', 'kind': 'zero-shot'},
    {'id': 'agent-x', 'name': 'AGENT-X', 'kind': 'this paper'},
]
OURS = 'agent-x'

# Rows exactly as printed: eight values per row, XSum, Writing, PubMed, Avg. for the
# first source model, then the same four for the second. A detector missing from a
# table is absent from its dict. Verified against the LaTeX source (acl_latex.tex) and
# the PDF text layer of arXiv 2505.15261v1.
TABLES: dict[str, dict[str, Any]] = {
    'Table 1': {'metric': 'acc', 'models': ('chatgpt', 'gpt4'), 'rows': {
        'roberta-base': '0.8367 0.6000 0.5267 0.6545 0.6242 0.4967 0.4396 0.5202',
        'roberta-large': '0.6567 0.5033 0.4800 0.5467 0.5336 0.4933 0.4732 0.5000',
        'likelihood': '0.8000 0.9133 0.7633 0.8256 0.7100 0.6067 0.7233 0.6800',
        'entropy': '0.3800 0.3767 0.3533 0.3700 0.5000 0.4767 0.3967 0.4578',
        'rank': '0.6767 0.6067 0.5800 0.6211 0.6000 0.5100 0.5767 0.5622',
        'logrank': '0.8300 0.8900 0.7533 0.8244 0.7267 0.5900 0.7200 0.6789',
        'lrr': '0.8433 0.7300 0.5767 0.7167 0.6846 0.5467 0.5570 0.5961',
        'dna-gpt': '0.7100 0.8467 0.5000 0.6856 0.6600 0.7100 0.5000 0.6233',
        'npr': '0.7033 0.8867 0.6000 0.7300 0.4966 0.6100 0.5537 0.5534',
        'detectgpt': '0.6467 0.7667 0.4967 0.6367 0.5067 0.5033 0.5000 0.5033',
        'fast-detect': '0.9467 0.9333 0.5433 0.8078 0.7100 0.7600 0.5267 0.6656',
        'agent-x': '0.8967 0.9233 0.7604 0.8601 0.8624 0.8705 0.8446 0.8592',
    }},
    'Table 2': {'metric': 'acc', 'models': ('opus', 'sonnet'), 'rows': {
        'roberta-base': '0.7967 0.6300 0.4333 0.6200 0.7000 0.5700 0.4433 0.5711',
        'roberta-large': '0.6600 0.5133 0.4367 0.5367 0.5867 0.4900 0.4333 0.5033',
        'likelihood': '0.8033 0.9000 0.7500 0.8178 0.7833 0.8367 0.7367 0.7856',
        'entropy': '0.4233 0.3367 0.3800 0.3800 0.4667 0.3900 0.3733 0.4100',
        'rank': '0.6600 0.6467 0.5733 0.6267 0.6200 0.6133 0.5833 0.6056',
        'logrank': '0.8167 0.8867 0.7567 0.8200 0.7933 0.8200 0.7233 0.7789',
        'lrr': '0.8167 0.8100 0.6333 0.7533 0.7367 0.7333 0.6567 0.7089',
        'dna-gpt': '0.8200 0.8667 0.5000 0.7289 0.7733 0.8467 0.5000 0.7067',
        'npr': '0.7400 0.9233 0.6900 0.7844 0.7333 0.9067 0.6800 0.7733',
        'detectgpt': '0.5000 0.5000 0.6567 0.5522 0.5000 0.5000 0.6567 0.5522',
        'fast-detect': '0.8767 0.9400 0.5700 0.7956 0.8067 0.8700 0.5300 0.7356',
        'agent-x': '0.8133 0.9100 0.7900 0.8378 0.7567 0.8633 0.7800 0.8000',
    }},
    'Table 5': {'metric': 'auroc', 'models': ('chatgpt', 'gpt4'), 'rows': {
        'roberta-base': '0.9150 0.7084 0.6188 0.7474 0.6778 0.5068 0.5309 0.5718',
        'roberta-large': '0.8507 0.5480 0.6731 0.6906 0.6879 0.3821 0.6067 0.5589',
        'gptzero': '0.9952 0.9292 0.8799 0.9348 0.9815 0.8262 0.8482 0.8853',
        'likelihood': '0.9578 0.9740 0.8775 0.9364 0.7980 0.8553 0.8104 0.8212',
        'entropy': '0.3305 0.1902 0.2767 0.2658 0.4360 0.3702 0.3295 0.3786',
        'rank': '0.7494 0.8064 0.5979 0.7179 0.6644 0.7146 0.5965 0.6585',
        'logrank': '0.9582 0.9656 0.8687 0.9308 0.7975 0.8286 0.8003 0.8088',
        'lrr': '0.9162 0.8958 0.7433 0.8518 0.7447 0.7028 0.6814 0.7096',
        'dna-gpt': '0.9124 0.9425 0.7959 0.8836 0.7347 0.8032 0.7565 0.7648',
        'npr': '0.7899 0.8924 0.6784 0.7869 0.5280 0.6122 0.6328 0.5910',
        'detectgpt': '0.8416 0.8811 0.7444 0.8223 0.5660 0.6217 0.6805 0.6228',
        'fast-detect': '0.9907 0.9916 0.9021 0.9615 0.9067 0.9612 0.8503 0.9061',
        'fast-detect-phi2': '0.8096 0.7245 0.8121 0.7821 0.4636 0.6463 0.6083 0.5727',
        'fast-detect-qwen': '0.7808 0.8117 0.7887 0.7937 0.6476 0.8202 0.6391 0.7023',
        'fast-detect-llama': '0.8508 0.8446 0.7941 0.8298 0.6615 0.8491 0.7556 0.7554',
        'agent-x': '0.9628 0.9794 0.8195 0.9206 0.9367 0.9206 0.8447 0.9007',
    }},
    'Table 6': {'metric': 'auroc', 'models': ('opus', 'sonnet'), 'rows': {
        'roberta-base': '0.8975 0.7115 0.4009 0.6700 0.7511 0.5788 0.3799 0.5699',
        'roberta-large': '0.8146 0.5548 0.3798 0.5831 0.6725 0.4772 0.3856 0.5118',
        'likelihood': '0.9322 0.9734 0.8603 0.9220 0.8862 0.9484 0.8360 0.8902',
        'entropy': '0.3871 0.1792 0.2910 0.2858 0.4146 0.2156 0.2989 0.3097',
        'rank': '0.7333 0.7950 0.6080 0.7121 0.7019 0.7812 0.6017 0.6949',
        'logrank': '0.9357 0.9679 0.8508 0.9181 0.8867 0.9401 0.8296 0.8855',
        'lrr': '0.8956 0.9178 0.7448 0.8527 0.8359 0.8746 0.7436 0.8180',
        'dna-gpt': '0.9424 0.9653 0.7806 0.8961 0.8558 0.9415 0.7647 0.8540',
        'npr': '0.8426 0.9764 0.8094 0.8761 0.8349 0.9631 0.7942 0.8641',
        'detectgpt': '0.7718 0.8335 0.7752 0.7935 0.8150 0.8675 0.7347 0.8057',
        'fast-detect': '0.9779 0.9832 0.8947 0.9519 0.9514 0.9763 0.8634 0.9304',
        'fast-detect-phi2': '0.8080 0.7545 0.7322 0.7649 0.7536 0.6773 0.7144 0.7151',
        'fast-detect-qwen': '0.9097 0.8967 0.7572 0.8545 0.8595 0.8600 0.7346 0.8180',
        'fast-detect-llama': '0.9640 0.9377 0.8251 0.9089 0.9243 0.9198 0.7936 0.8792',
        'agent-x': '0.9042 0.9675 0.8526 0.9081 0.8443 0.9231 0.8324 0.8666',
    }},
}
DEFAULT_MODEL, DEFAULT_DATASET, DEFAULT_SORT = 'gpt4', 'pubmed', 'acc'
SORTS = {'acc': 'Accuracy', 'auroc': 'AUROC'}


def metric_values() -> dict[str, dict[str, dict[str, Any]]]:
    """values[model][dataset][method] = {'acc': str|None, 'auroc': str|None}, plus table names."""
    values: dict[str, dict[str, dict[str, Any]]] = {
        m['id']: {d['id']: {} for d in DATASETS} for m in MODELS}
    tables: dict[str, dict[str, str]] = {m['id']: {} for m in MODELS}
    for table_name, table in TABLES.items():
        for half, model in enumerate(table['models']):
            tables[model][table['metric']] = table_name
            for method, row in table['rows'].items():
                cells = row.split()
                if len(cells) != 8:
                    raise ValueError(f'{table_name} {method}: expected 8 printed values')
                for j, dataset in enumerate(DATASETS):
                    entry = values[model][dataset['id']].setdefault(method, {'acc': None, 'auroc': None})
                    entry[table['metric']] = cells[half * 4 + j]
    return {'values': values, 'tables': tables}


def metric_summary(data: dict[str, Any], model: str, dataset: str) -> dict[str, Any]:
    """Ranks of AGENT-X under each metric and the baselines with higher AUROC but lower accuracy."""
    cell = data['values'][model][dataset]
    def ranked(metric: str) -> list[str]:
        present = [m['id'] for m in METHODS if m['id'] in cell and cell[m['id']][metric] is not None]
        return present
    summary: dict[str, Any] = {}
    for metric in ('acc', 'auroc'):
        present = ranked(metric)
        ours = float(cell[OURS][metric])
        # Competition ranking: 1 + the number of detectors with a strictly higher printed value.
        summary[metric] = {
            'rank': 1 + sum(1 for m in present if float(cell[m][metric]) > ours),
            'count': len(present),
            'leader': max(present, key=lambda m: float(cell[m][metric])),
        }
    ours_acc, ours_auroc = float(cell[OURS]['acc']), float(cell[OURS]['auroc'])
    summary['contrast'] = [m['id'] for m in METHODS
                           if m['id'] != OURS and m['id'] in cell
                           and cell[m['id']]['auroc'] is not None and cell[m['id']]['acc'] is not None
                           and float(cell[m['id']]['auroc']) > ours_auroc and float(cell[m['id']]['acc']) < ours_acc]
    return summary


def _name(method_id: str) -> str:
    return next(m['name'] for m in METHODS if m['id'] == method_id)


def _label(items: list[dict[str, str]], ident: str) -> str:
    return next(item['name'] for item in items if item['id'] == ident)


def metric_verdict(data: dict[str, Any], model: str, dataset: str) -> str:
    cell = data['values'][model][dataset]
    s = metric_summary(data, model, dataset)
    acc, auroc = s['acc'], s['auroc']
    parts = [f'{_label(MODELS, model)} · {_label(DATASETS, dataset)}.']
    sentence = f'Accuracy: AGENT-X ranks {acc["rank"]} of {acc["count"]} ({cell[OURS]["acc"]})'
    if acc['rank'] > 1:
        leader = acc['leader']
        sentence += f'; the leader is {_name(leader)} with {cell[leader]["acc"]}'
    parts.append(sentence + '.')
    sentence = f'AUROC: AGENT-X ranks {auroc["rank"]} of {auroc["count"]} ({cell[OURS]["auroc"]})'
    if auroc['rank'] > 1:
        leader = auroc['leader']
        leader_acc = cell[leader]['acc']
        tail = f'accuracy {leader_acc}' if leader_acc is not None else 'no accuracy printed'
        sentence += f'; the leader is {_name(leader)} with {cell[leader]["auroc"]} ({tail})'
    parts.append(sentence + '.')
    contrast = s['contrast']
    if contrast:
        parts.append('Higher AUROC but lower accuracy than AGENT-X: ' + ', '.join(_name(m) for m in contrast) + '.')
    else:
        parts.append('No baseline here has both a higher AUROC and a lower accuracy than AGENT-X.')
    return ' '.join(parts)


def metric_rows(data: dict[str, Any], model: str, dataset: str, sort: str) -> str:
    cell = data['values'][model][dataset]
    contrast = set(metric_summary(data, model, dataset)['contrast'])
    order = [m['id'] for m in METHODS if m['id'] in cell]
    # Highest first; detectors without a value for the sort metric go last, in printed order.
    order.sort(key=lambda m: (cell[m][sort] is None, -float(cell[m][sort] or 0)))
    rows = []
    for method in order:
        entry = cell[method]
        classes = ['dt-bar-row']
        note = ''
        if method == OURS:
            classes.append('is-ours')
            note = '<small>this paper; no threshold</small>'
        elif method in contrast:
            classes.append('is-contrast')
            note = '<small>higher AUROC, lower accuracy</small>'
        elif entry['acc'] is None:
            classes.append('is-auroc-only')
            note = '<small>AUROC table only</small>'
        metrics = []
        for metric, label in (('acc', 'Accuracy'), ('auroc', 'AUROC')):
            value = entry[metric]
            if value is None:
                metrics.append(f'<span class="dt-metric is-missing"><span class="dt-metric-label">{label}</span>'
                               f'<span class="dt-bar-track"></span><span class="dt-bar-value" data-dt-{metric}>not printed</span></span>')
            else:
                metrics.append(f'<span class="dt-metric"><span class="dt-metric-label">{label}</span>'
                               f'<span class="dt-bar-track" aria-hidden="true"><i class="dt-bar-fill" style="width:{_pct(float(value))}"></i>'
                               f'<i class="dt-bar-chance"></i></span><span class="dt-bar-value" data-dt-{metric}>{_e(value)}</span></span>')
        rows.append(f'<li class="{" ".join(classes)}" data-method="{_e(method)}">'
                    f'<span class="dt-bar-name">{_e(_name(method))}{note}</span>{"".join(metrics)}</li>')
    return ''.join(rows)


def metric_board(data: dict[str, Any], model: str, dataset: str) -> str:
    head = ''.join(f'<th scope="col">{_e(d["name"])}</th>' for d in DATASETS)
    body = []
    for m in MODELS:
        cells = []
        for d in DATASETS:
            s = metric_summary(data, m['id'], d['id'])
            selected = m['id'] == model and d['id'] == dataset
            cls = ' class="is-selected"' if selected else ''
            first = ' is-first' if s['acc']['rank'] == 1 else ''
            cells.append(f'<td{cls} data-dt-cell="{m["id"]}:{d["id"]}"><span class="dt-rank-acc{first}">{s["acc"]["rank"]}</span>'
                         f'<span class="dt-rank-sep" aria-hidden="true"> / </span><span class="dt-rank-auroc">{s["auroc"]["rank"]}</span></td>')
        body.append(f'<tr><th scope="row">{_e(m["name"])}</th>{"".join(cells)}</tr>')
    return (f'<div class="dt-board-wrap"><table class="dt-board"><thead><tr><th scope="col">Source model</th>{head}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table></div>')


def metric_title(data: dict[str, Any], model: str, dataset: str) -> str:
    tables = data['tables'][model]
    return (f'{_e(_label(MODELS, model))} · {_e(_label(DATASETS, dataset))} '
            f'{_tag("measured", tables["acc"] + " and " + tables["auroc"])}')


def render_metrics(slug: str, demo: dict[str, Any]) -> str:
    data = metric_values()
    model, dataset, sort = DEFAULT_MODEL, DEFAULT_DATASET, DEFAULT_SORT
    controls = (_group('Source model', ''.join(_button(f'model:{m["id"]}', m['name'], m['id'] == model) for m in MODELS))
                + _group('Dataset', ''.join(_button(f'dataset:{d["id"]}', d['name'], d['id'] == dataset) for d in DATASETS))
                + _group('Sort by', ''.join(_button(f'sort:{key}', label, key == sort) for key, label in SORTS.items())))
    results = (
        f'<div class="dt-block"><h4>AGENT-X rank by accuracy / by AUROC, every column {_tag("computed", "from Tables 1, 2, 5 and 6")}</h4>'
        f'<div data-dt-board>{metric_board(data, model, dataset)}</div>'
        '<p class="dt-caption">Each cell gives AGENT-X’s rank among the detectors the table prints: 12 have an accuracy; 16 (ChatGPT, GPT-4) or 15 (Claude-3) have an AUROC. Rank 1 by accuracy is set in bold. The outlined cell is the one shown below.</p></div>'
        f'<div class="dt-block"><h4 data-dt-title>{metric_title(data, model, dataset)}</h4>'
        '<div class="dt-bars-head" aria-hidden="true"><span>Detector</span><span>Accuracy · threshold tuned on SQuAD / GPT-Neo-2.7B</span><span>AUROC · no threshold</span></div>'
        f'<ol class="dt-bars" data-dt-bars>{metric_rows(data, model, dataset, sort)}</ol>'
        '<p class="dt-caption">Bars run from 0 to 1; the tick marks 0.5. Rows are sorted by the selected metric, highest first.</p></div>')
    config = {'models': MODELS, 'datasets': DATASETS, 'methods': METHODS, 'ours': OURS,
              'sorts': SORTS, 'defaults': {'model': model, 'dataset': dataset, 'sort': sort}} | data
    return _shell(slug, 'metrics', demo, controls, results, metric_verdict(data, model, dataset), config)


def render_demo(slug: str, insight: dict[str, Any]) -> dict[str, str] | str:
    """AGENT-X only: the calibration demo in Method and the metric explorer in Evidence."""
    if slug != SLUG:
        return ''
    demo = insight.get('demo') or {}
    return {'method': render_calibration(slug, demo['calibration']),
            'evidence': render_metrics(slug, demo['metrics'])}
