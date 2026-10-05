"""Evidence explorers and a mechanism animation for four evaluation and generation pages.

* themis: per-benchmark and per-aspect correlations (Tables 2-4, 21-26), Themis-8B against
  GPT-4 and every other printed evaluator.
* nlg-evaluation-survey: the survey's four paradigms with section-referenced cells, situation
  filters, the Section 6.2 orderings and the SummEval comparison (Table 4).
* eama: the NYTimes800k ablation ladder (Table 2) with the textual-input alternatives and
  oracle ceilings (Table 4).
* contextual-asr: which sentences' (key, value) pairs the kNN datastore can search in the
  online/offline x document/dataset modes (Section 3.4, Figure 2), stepped by the reader.

Every renderer returns a complete, readable initial state computed here in Python;
`papers/demos/judges.js` repeats the same computation when the reader changes an input.
Printed values are kept as the strings printed in the paper. No model or network call runs.
"""
from __future__ import annotations

from html import escape
import json
import math
from typing import Any, Sequence

OWNED = {
    'themis': 'themis-benchmarks',
    'nlg-evaluation-survey': 'survey-paradigms',
    'eama': 'eama-ladder',
    'contextual-asr': 'asr-datastore',
}
TAG_LABELS = {'measured': 'Measured', 'published': 'Published', 'illustrative': 'Illustrative',
              'computed': 'Computed', 'schematic': 'Schematic'}


def _e(value: Any) -> str:
    return escape(str(value), quote=True)


def _minus(text: str) -> str:
    """Typographic minus for printed and computed numbers."""
    return text.replace('-', '−')


def _tag(kind: str, reference: str = '') -> str:
    """Provenance label such as "Measured · Table 2"; the word states the kind, color is secondary."""
    text = TAG_LABELS[kind] + (f' · {reference}' if reference else '')
    return f'<span class="jd-tag jd-tag-{_e(kind)}">{_e(text)}</span>'


def _button(action: str, label: str, pressed: bool = False, extra: str = '') -> str:
    return (f'<button type="button" data-demo-action="{_e(action)}" aria-pressed="{str(pressed).lower()}"{extra}>'
            f'{label}</button>')


def _group(label: str, buttons: str, extra: str = '') -> str:
    return (f'<div class="jd-button-row" role="group" aria-label="{_e(label)}"{extra}>'
            f'<span class="jd-group-label" aria-hidden="true">{_e(label)}</span>{buttons}</div>')


def _shell(slug: str, demo: dict[str, Any], kind: str, controls: str, results: str, verdict: str,
           config: dict[str, Any]) -> str:
    # The JSON lives in a non-executable script and is escaped against closing tags.
    encoded = json.dumps(config, ensure_ascii=False).replace('<', '\\u003c')
    links = ''.join(f'<a href="{_e(item["url"])}">{_e(item["label"])} ↗</a>' for item in demo.get('sources', []))
    sources = f'<span class="jd-source-links">{links}</span>' if links else ''
    return f'''<section class="paper-demo judges-demo" data-paper-demo="{_e(slug)}" data-judges-demo="{_e(kind)}" aria-labelledby="{slug}-demo-title">
      <header class="jd-heading"><p class="jd-kicker">{_e(demo.get("eyebrow", "Interactive explanation"))}</p><h3 id="{slug}-demo-title">{_e(demo["title"])}</h3><p>{_e(demo["description"])}</p></header>
      <div class="jd-controls" data-demo-controls hidden>{controls}</div>
      <div class="jd-state" data-demo-state><div class="jd-results" data-jd-results>{results}</div><p class="jd-verdict" role="status" aria-live="polite" data-jd-verdict>{_e(verdict)}</p></div>
      <p class="jd-disclosure">{_e(demo["note"])}{sources}</p>
      <script type="application/json" class="jd-config">{encoded}</script>
    </section>'''


def _round_half_up(value: float) -> int:
    """Same rounding as JavaScript Math.round, so Python and browser text agree."""
    return int(math.floor(value + 0.5))


# ===========================================================================
# Themis (EMNLP 2024): correlations with human ratings, exactly as printed.
# ===========================================================================

THEMIS_EVALUATORS: list[dict[str, Any]] = [
    # group: Table 2 section. ref: marked † (reference-based) in Table 2; None when absent from Table 2.
    {'key': 'bleu', 'name': 'BLEU', 'group': 'traditional', 'ref': True},
    {'key': 'rouge', 'name': 'ROUGE', 'group': 'traditional', 'ref': True},
    {'key': 'bartscore', 'name': 'BARTScore', 'group': 'traditional', 'ref': False},
    {'key': 'bertscore', 'name': 'BERTScore', 'group': 'traditional', 'ref': True},
    {'key': 'bleurt', 'name': 'BLEURT', 'group': 'traditional', 'ref': True},
    {'key': 'comet22', 'name': 'comet22', 'group': 'traditional', 'ref': None},
    {'key': 'cometkiwi', 'name': 'CometKiwi', 'group': 'traditional', 'ref': False},
    {'key': 'unieval', 'name': 'UniEval', 'group': 'traditional', 'ref': True},
    {'key': 'geval35', 'name': 'G-Eval (GPT-3.5)', 'group': 'prompting', 'ref': False},
    {'key': 'geval4', 'name': 'G-Eval (GPT-4)', 'group': 'prompting', 'ref': False},
    {'key': 'gpt35', 'name': 'GPT-3.5', 'group': 'prompting', 'ref': False},
    {'key': 'gpt4', 'name': 'GPT-4', 'group': 'prompting', 'ref': False},
    {'key': 'autocalibrate', 'name': 'AUTOCALIBRATE', 'group': 'prompting', 'ref': None},
    {'key': 'coascore10', 'name': 'CoAScore (n = 10)', 'group': 'prompting', 'ref': None},
    {'key': 'coascore20', 'name': 'CoAScore (n = 20)', 'group': 'prompting', 'ref': None},
    {'key': 'hdeval', 'name': 'HD-EVAL-NN', 'group': 'prompting', 'ref': None},
    {'key': 'xeval', 'name': 'X-Eval', 'group': 'finetuned', 'ref': True},
    {'key': 'prometheus', 'name': 'Prometheus-13B', 'group': 'finetuned', 'ref': True},
    {'key': 'autoj', 'name': 'Auto-J-13B', 'group': 'finetuned', 'ref': False},
    {'key': 'tigerscore', 'name': 'TIGERScore-13B', 'group': 'finetuned', 'ref': False},
    {'key': 'instructscore', 'name': 'InstructScore-7B', 'group': 'finetuned', 'ref': True},
    {'key': 'themis', 'name': 'Themis-8B', 'group': 'finetuned', 'ref': False},
]
THEMIS_GROUPS = {'traditional': 'Traditional metric', 'prompting': 'Prompted LLM', 'finetuned': 'Fine-tuned LLM'}
THEMIS_MEASURES = {'ρ': 'Spearman ρ', 'τ': 'Kendall τ', 'r': 'Pearson r'}

# Rows as printed, one string per evaluator; '-' marks a value the table does not print.
# Columns are listed in THEMIS_COLUMNS as (benchmark, subset, measure).
THEMIS_TABLES: dict[str, dict[str, str]] = {
    'Table 2': {
        'bleu': '0.075 0.057 0.356 0.388 0.024 0.018 - - 0.032 0.009 -0.130 0.021 -',
        'rouge': '0.152 0.120 0.393 0.412 0.101 0.076 - - -0.002 0.156 0.081 0.151 -',
        'bartscore': '0.329 0.261 0.067 0.086 0.208 0.156 0.425 0.347 0.350 0.260 0.091 0.118 0.253',
        'bertscore': '0.231 0.182 0.388 0.394 0.139 0.105 - - 0.285 0.163 0.123 0.219 -',
        'bleurt': '0.152 0.118 0.384 0.388 0.244 0.184 - - 0.138 0.221 0.163 0.263 -',
        'cometkiwi': '0.228 0.180 0.353 0.340 0.251 0.186 0.094 0.074 0.251 0.176 0.413 0.343 0.251',
        'unieval': '0.474 0.377 0.533 0.577 0.282 0.211 - - - - - - -',
        'geval35': '0.409 0.323 0.574 0.585 - - 0.461 0.337 - - - - -',
        'geval4': '0.523 0.423 0.575 0.588 - - 0.611 0.532 - - - - -',
        'gpt35': '0.416 0.340 0.592 0.578 0.306 0.239 0.431 0.356 0.328 0.295 0.388 0.347 0.401',
        'gpt4': '0.511 0.423 0.770 0.746 0.320 0.260 0.637 0.532 0.473 0.260 0.496 0.437 0.521',
        'xeval': '0.480 0.362 0.539 0.605 0.303 - 0.578 - - - - - -',
        'prometheus': '0.163 0.142 0.435 0.434 0.173 0.142 - - 0.007 0.146 0.144 0.129 -',
        'autoj': '0.198 0.172 0.427 0.425 0.141 0.120 0.226 0.209 0.380 0.284 0.128 0.104 0.246',
        'tigerscore': '0.384 0.334 0.334 0.346 0.200 0.175 0.504 0.446 0.231 0.207 0.277 0.248 0.319',
        'instructscore': '0.258 0.226 0.269 0.241 0.247 0.210 - - 0.298 0.168 0.213 0.219 -',
        'themis': '0.553 0.499 0.733 0.725 0.333 0.284 0.684 0.613 0.551 0.501 0.431 0.405 0.542',
    },
    'Table 3': {   # six-benchmark averages: Avg ρ, Avg τ, Avg r
        'bartscore': '0.253 0.197 0.262', 'cometkiwi': '0.251 0.195 0.272', 'gpt4': '0.521 0.417 0.564',
        'tigerscore': '0.319 0.280 0.333', 'autoj': '0.246 0.211 0.262', 'themis': '0.542 0.486 0.569',
    },
    'Table 4': {   # ten aspects of the two unseen tasks, then the average
        'bartscore': '-0.053 -0.040 0.063 -0.038 0.025 0.098 0.174 0.360 0.296 0.464 0.135',
        'cometkiwi': '0.345 0.464 0.349 0.223 0.473 0.155 0.128 0.210 0.138 0.134 0.262',
        'gpt35': '0.257 0.488 0.433 0.239 0.401 0.612 0.318 0.443 0.212 0.562 0.396',
        'gpt4': '0.257 0.653 0.573 0.338 0.455 0.767 0.431 0.237 -0.004 0.711 0.442',
        'autoj': '0.422 0.562 0.571 0.386 0.548 0.095 0.255 0.109 0.191 0.033 0.317',
        'tigerscore': '0.262 0.247 0.285 0.198 0.239 -0.037 0.075 0.009 0.002 -0.217 0.106',
        'themis': '0.414 0.381 0.685 0.349 0.500 0.835 0.538 0.700 0.365 0.684 0.545',
    },
    'Table 21': {   # SummEval aspects (ρ, τ); the Average columns duplicate Table 2 and are omitted
        'bleu': '0.062 0.044 0.048 0.040 0.046 0.036 0.145 0.108',
        'rouge': '0.107 0.080 0.145 0.123 0.113 0.093 0.241 0.183',
        'bartscore': '0.474 0.367 0.266 0.220 0.258 0.214 0.318 0.243',
        'bertscore': '0.285 0.220 0.151 0.122 0.186 0.154 0.302 0.232',
        'bleurt': '0.150 0.112 0.089 0.074 0.133 0.107 0.238 0.178',
        'cometkiwi': '0.353 0.273 0.151 0.124 0.207 0.170 0.203 0.151',
        'unieval': '0.575 0.442 0.446 0.371 0.449 0.371 0.426 0.325',
        'geval35': '0.440 0.335 0.386 0.318 0.424 0.347 0.385 0.293',
        'geval4': '0.582 0.457 0.507 0.425 0.455 0.378 0.548 0.433',
        'gpt35': '0.459 0.371 0.393 0.331 0.355 0.296 0.455 0.363',
        'gpt4': '0.540 0.434 0.531 0.464 0.480 0.409 0.491 0.395',
        'autocalibrate': '0.570 0.493 0.500 0.467 0.487 0.452 0.560 0.483',
        'coascore10': '0.541 0.419 0.339 0.299 0.367 0.308 0.478 0.379',
        'hdeval': '0.657 - 0.451 - 0.435 - 0.599 -',
        'xeval': '0.530 0.382 0.428 0.340 0.461 0.365 0.500 0.361',
        'prometheus': '0.150 0.126 0.150 0.137 0.189 0.168 0.164 0.138',
        'autoj': '0.245 0.203 0.131 0.121 0.154 0.141 0.262 0.222',
        'tigerscore': '0.381 0.318 0.427 0.387 0.363 0.327 0.366 0.304',
        'instructscore': '0.328 0.276 0.232 0.213 0.260 0.237 0.211 0.179',
        'themis': '0.566 0.485 0.600 0.566 0.571 0.533 0.474 0.412',
    },
    'Table 22': {   # Topical-Chat aspects (r, ρ)
        'bleu': '0.370 0.374 0.406 0.454 0.281 0.369 0.366 0.356',
        'rouge': '0.400 0.376 0.452 0.488 0.339 0.423 0.381 0.360',
        'bartscore': '0.119 0.165 0.069 0.059 0.031 0.053 0.050 0.065',
        'bertscore': '0.395 0.383 0.439 0.449 0.330 0.378 0.388 0.366',
        'bleurt': '0.401 0.408 0.431 0.427 0.321 0.364 0.383 0.354',
        'comet22': '0.491 0.496 0.544 0.544 0.407 0.450 0.489 0.492',
        'cometkiwi': '0.334 0.327 0.369 0.355 0.331 0.309 0.380 0.368',
        'unieval': '0.595 0.613 0.557 0.605 0.536 0.575 0.444 0.514',
        'geval35': '0.519 0.544 0.660 0.691 0.586 0.567 0.532 0.539',
        'geval4': '0.594 0.605 0.627 0.631 0.531 0.551 0.549 0.565',
        'gpt35': '0.550 0.531 0.651 0.648 0.653 0.581 0.515 0.550',
        'gpt4': '0.680 0.680 0.822 0.779 0.810 0.786 0.769 0.739',
        'coascore20': '0.539 0.553 0.578 0.595 - - 0.558 0.596',
        'hdeval': '0.584 0.607 0.682 0.701 0.549 0.568 0.648 0.674',
        'xeval': '0.558 0.622 0.449 0.593 0.734 0.728 0.417 0.478',
        'prometheus': '0.451 0.465 0.495 0.473 0.437 0.412 0.355 0.384',
        'autoj': '0.452 0.449 0.490 0.459 0.339 0.357 0.425 0.437',
        'tigerscore': '0.417 0.438 0.328 0.333 0.137 0.138 0.455 0.477',
        'instructscore': '0.299 0.297 0.264 0.233 0.140 0.102 0.374 0.332',
        'themis': '0.639 0.644 0.790 0.766 0.778 0.761 0.727 0.729',
    },
    'Table 23': {   # SFHOT and SFRES aspects (ρ, τ)
        'bleu': '0.070 0.054 0.055 0.040 -0.023 -0.018 -0.004 -0.004',
        'rouge': '0.107 0.082 0.075 0.055 0.118 0.090 0.105 0.078',
        'bartscore': '0.211 0.162 0.130 0.094 0.265 0.201 0.226 0.165',
        'bertscore': '0.135 0.104 0.126 0.093 0.157 0.120 0.139 0.102',
        'bleurt': '0.219 0.171 0.229 0.171 0.244 0.186 0.282 0.211',
        'cometkiwi': '0.220 0.169 0.235 0.172 0.203 0.153 0.345 0.252',
        'unieval': '0.249 0.191 0.320 0.238 0.225 0.169 0.333 0.247',
        'gpt35': '0.242 0.196 0.294 0.220 0.304 0.250 0.385 0.291',
        'gpt4': '0.302 0.263 0.359 0.283 0.213 0.178 0.405 0.316',
        'autocalibrate': '0.357 0.313 0.440 0.383 0.315 0.272 0.416 0.351',
        'prometheus': '0.169 0.141 0.211 0.171 0.161 0.134 0.150 0.122',
        'autoj': '0.176 0.152 0.127 0.106 0.179 0.153 0.084 0.070',
        'tigerscore': '0.215 0.191 0.204 0.175 0.160 0.141 0.221 0.191',
        'instructscore': '0.222 0.194 0.273 0.231 0.194 0.164 0.300 0.251',
        'themis': '0.259 0.226 0.380 0.321 0.298 0.258 0.395 0.332',
    },
    'Table 24': {   # QAGS subsets (r, ρ, τ)
        'bartscore': '0.732 0.680 0.555 0.175 0.171 0.139',
        'cometkiwi': '0.176 0.158 0.123 0.027 0.030 0.025',
        'unieval': '0.682 0.662 0.532 0.461 0.488 0.399',
        'geval35': '0.631 0.685 0.591 0.558 0.537 0.472',
        'geval4': '0.477 0.516 0.410 0.211 0.406 0.343',
        'gpt35': '0.454 0.514 0.417 0.279 0.348 0.295',
        'gpt4': '0.735 0.746 0.626 0.541 0.528 0.439',
        'autocalibrate': '0.740 0.744 0.663 0.662 0.662 0.662',
        'autoj': '0.291 0.238 0.214 0.225 0.214 0.203',
        'tigerscore': '0.574 0.562 0.479 0.424 0.445 0.412',
        'instructscore': '0.287 0.278 0.233 -0.096 -0.134 -0.119',
        'themis': '0.747 0.761 0.680 0.599 0.607 0.546',
    },
    'Table 25': {   # MANS subsets (r, ρ, τ)
        'bleu': '0.034 0.035 0.022 0.009 0.029 0.021',
        'rouge': '0.012 0.000 0.006 0.003 -0.004 -0.004',
        'bartscore': '0.344 0.330 0.273 0.403 0.370 0.306',
        'bertscore': '0.288 0.269 0.222 0.293 0.300 0.248',
        'bleurt': '0.189 0.155 0.123 0.144 0.122 0.104',
        'cometkiwi': '0.246 0.218 0.176 0.289 0.283 0.238',
        'gpt35': '0.372 0.363 0.312 0.312 0.294 0.258',
        'gpt4': '0.590 0.578 0.518 0.382 0.368 0.336',
        'prometheus': '0.031 0.013 0.014 0.001 0.001 0.003',
        'autoj': '0.460 0.454 0.410 0.308 0.306 0.278',
        'tigerscore': '0.283 0.271 0.221 0.196 0.191 0.158',
        'instructscore': '0.383 0.368 0.316 0.258 0.228 0.194',
        'themis': '0.637 0.607 0.551 0.507 0.495 0.452',
    },
    'Table 26': {   # WMT23 zh-en (r, ρ, τ); only τ is new relative to Table 2
        'bleu': '-0.130 0.021 0.018', 'rouge': '0.081 0.151 0.117', 'bartscore': '0.091 0.118 0.093',
        'bertscore': '0.123 0.219 0.170', 'bleurt': '0.163 0.263 0.208', 'cometkiwi': '0.413 0.343 0.273',
        'gpt35': '0.388 0.347 0.278', 'gpt4': '0.496 0.437 0.361', 'prometheus': '0.144 0.129 0.107',
        'autoj': '0.128 0.104 0.087', 'tigerscore': '0.277 0.248 0.211', 'instructscore': '0.213 0.219 0.181',
        'themis': '0.431 0.405 0.357',
    },
}

THEMIS_BENCHMARKS = [
    {'id': 'summeval', 'name': 'SummEval', 'task': 'summarization'},
    {'id': 'topical', 'name': 'Topical-Chat', 'task': 'dialogue response'},
    {'id': 'sf', 'name': 'SFHOT & SFRES', 'task': 'data-to-text'},
    {'id': 'qags', 'name': 'QAGS', 'task': 'factuality'},
    {'id': 'mans', 'name': 'MANS', 'task': 'story generation'},
    {'id': 'wmt', 'name': 'WMT23 zh-en', 'task': 'translation'},
    {'id': 'average', 'name': 'Six-benchmark average', 'task': 'all six held-out benchmarks'},
    {'id': 'unseen', 'name': 'Unseen tasks', 'task': 'instruction following and long-form QA'},
]
# Column layout of each table: (benchmark, subset, measure). Subset '' is the benchmark-level column.
THEMIS_COLUMNS: dict[str, list[tuple[str, str, str]]] = {
    'Table 2': [('summeval', '', 'ρ'), ('summeval', '', 'τ'), ('topical', '', 'r'), ('topical', '', 'ρ'),
                ('sf', '', 'ρ'), ('sf', '', 'τ'), ('qags', '', 'ρ'), ('qags', '', 'τ'), ('mans', '', 'ρ'),
                ('mans', '', 'τ'), ('wmt', '', 'r'), ('wmt', '', 'ρ'), ('average', '', 'ρ')],
    'Table 3': [('average', '', 'ρ'), ('average', '', 'τ'), ('average', '', 'r')],
    'Table 4': [('unseen', a, 'ρ') for a in ('CLA', 'COM', 'COR', 'POL', 'REL', 'EU', 'FA', 'LC', 'OU', 'SL')]
               + [('unseen', '', 'ρ')],
    'Table 21': [('summeval', a, m) for a in ('Coherence', 'Consistency', 'Fluency', 'Relevance') for m in ('ρ', 'τ')],
    'Table 22': [('topical', a, m) for a in ('Context maintenance', 'Interestingness', 'Knowledge use', 'Naturalness')
                 for m in ('r', 'ρ')],
    'Table 23': [('sf', a, m) for a in ('SFHOT informativeness', 'SFHOT naturalness', 'SFRES informativeness',
                                        'SFRES naturalness') for m in ('ρ', 'τ')],
    'Table 24': [('qags', a, m) for a in ('CNN-DM', 'XSUM') for m in ('r', 'ρ', 'τ')],
    'Table 25': [('mans', a, m) for a in ('ROC', 'WP') for m in ('r', 'ρ', 'τ')],
    'Table 26': [('wmt', '', 'r'), ('wmt', '', 'ρ'), ('wmt', '', 'τ')],
}
# Where two tables print the same column, the first source listed here wins.
THEMIS_PRECEDENCE = ['Table 2', 'Table 3', 'Table 4', 'Table 21', 'Table 22', 'Table 23', 'Table 24', 'Table 25', 'Table 26']
THEMIS_UNSEEN_NAMES = {'CLA': 'Clarity (CLA)', 'COM': 'Completeness (COM)', 'COR': 'Correctness (COR)',
                       'POL': 'Politeness (POL)', 'REL': 'Relevance (REL)', 'EU': 'Example usage (EU)',
                       'FA': 'Factual accuracy (FA)', 'LC': 'Logical coherence (LC)', 'OU': 'Overall usefulness (OU)',
                       'SL': 'Simple language (SL)'}
# Printed inconsistencies the reader should see next to the affected column.
THEMIS_CAUTIONS = {
    ('summeval', '', 'τ'): 'Table 21 prints GPT-4’s SummEval average τ as 0.426; Table 2 prints 0.423, shown here.',
    ('summeval', '', 'ρ'): 'Table 21 prints GPT-3.5’s SummEval average ρ as 0.415; Table 2 prints 0.416, shown here.',
    ('qags', '', 'ρ'): ('Table 24’s QAGS averages give the two G-Eval rows the other way round (G-Eval (GPT-4) 0.461, '
                        'G-Eval (GPT-3.5) 0.611); Table 2 is shown.'),
    ('qags', '', 'τ'): ('Table 24’s QAGS averages give the two G-Eval rows the other way round, with G-Eval (GPT-4) '
                        'at τ 0.377; Table 2 is shown.'),
    ('mans', '', 'τ'): ('For every evaluator except Themis, the printed MANS τ (Table 2, repeated as Table 25’s average) '
                        'is not the mean of its ROC and WP τ; for GPT-4 it is 0.260 against a mean of 0.427.'),
    ('unseen', '', 'ρ'): ('Table 4’s header puts CLA–REL under instruction following and EU–SL under long-form QA; '
                          'Section 5.1 assigns the two aspect sets the other way round.'),
}
THEMIS_DEFAULT = {'benchmark': 'summeval', 'subset': '', 'measure': 'ρ'}


def _milli(text: str) -> int:
    return _round_half_up(float(text) * 1000)


def themis_views() -> list[dict[str, Any]]:
    """One view per (benchmark, subset): {measure: {'table': name, 'values': {evaluator: printed}}}."""
    views: dict[tuple[str, str], dict[str, Any]] = {}
    for table in THEMIS_PRECEDENCE:
        columns = THEMIS_COLUMNS[table]
        rows = {key: text.split() for key, text in THEMIS_TABLES[table].items()}
        for index, (benchmark, subset, measure) in enumerate(columns):
            view = views.setdefault((benchmark, subset), {'benchmark': benchmark, 'subset': subset, 'measures': {}})
            if measure in view['measures']:
                continue  # an earlier table already prints this column
            values = {key: row[index] for key, row in rows.items() if row[index] != '-'}
            view['measures'][measure] = {'table': table, 'values': values}
    order = {b['id']: i for i, b in enumerate(THEMIS_BENCHMARKS)}
    # Benchmark-level column first, then subsets in printed order.
    printed = {key: i for i, key in enumerate(views)}
    result = sorted(views.values(), key=lambda v: (order[v['benchmark']], v['subset'] != '', printed[(v['benchmark'], v['subset'])]))
    for view in result:
        view['id'] = view['benchmark'] + ('-' + view['subset'].lower().replace(' ', '-') if view['subset'] else '')
        view['label'] = (THEMIS_UNSEEN_NAMES.get(view['subset'], view['subset']) if view['subset']
                         else ('Average over aspects' if view['benchmark'] == 'unseen' else 'Benchmark level'))
        view['measures'] = {m: view['measures'][m] for m in THEMIS_MEASURES if m in view['measures']}
        view['cautions'] = {m: THEMIS_CAUTIONS[(view['benchmark'], view['subset'], m)]
                            for m in view['measures'] if (view['benchmark'], view['subset'], m) in THEMIS_CAUTIONS}
    return result


def _themis_names() -> dict[str, dict[str, Any]]:
    return {item['key']: item for item in THEMIS_EVALUATORS}


def _bench_name(benchmark: str) -> str:
    return next(b['name'] for b in THEMIS_BENCHMARKS if b['id'] == benchmark)


def themis_scoreboard(views: Sequence[dict[str, Any]], measure: str) -> list[dict[str, Any]]:
    """Every column where both Themis-8B and GPT-4 are printed: difference in thousandths."""
    cells = []
    for view in views:
        entry = view['measures'].get(measure)
        if not entry or 'themis' not in entry['values'] or 'gpt4' not in entry['values']:
            continue
        diff = _milli(entry['values']['themis']) - _milli(entry['values']['gpt4'])
        cells.append({'view': view['id'], 'benchmark': view['benchmark'], 'label': view['label'], 'diff': diff})
    return cells


def _signed(milli: int) -> str:
    return ('+' if milli > 0 else '−' if milli < 0 else '±') + f'{abs(milli) / 1000:.3f}'


def themis_state(views: Sequence[dict[str, Any]], view_id: str, measure: str) -> tuple[str, str]:
    """HTML (bar chart and scoreboard) and the verdict for one view and measure."""
    names = _themis_names()
    view = next(v for v in views if v['id'] == view_id)
    entry = view['measures'][measure]
    values = entry['values']
    ranked = sorted(values.items(), key=lambda kv: (-_milli(kv[1]), [e['key'] for e in THEMIS_EVALUATORS].index(kv[0])))
    numbers = [_milli(v) for v in values.values()]
    low = min(0, math.floor(min(numbers) / 100) * 100)
    high = max(100, math.ceil(max(numbers) / 100) * 100)
    span = high - low

    def pct(milli: int) -> str:
        return f'{(milli - low) / span * 100:.2f}%'

    rows = []
    for key, text in ranked:
        meta = names[key]
        milli = _milli(text)
        left, right = sorted([0, milli])
        classes = 'jd-bar-row' + (' is-themis' if key == 'themis' else ' is-gpt4' if key == 'gpt4' else '')
        dagger = '<span class="jd-dagger" title="Reference-based (Table 2)">†</span>' if meta['ref'] else ''
        rows.append(
            f'<li class="{classes}" data-evaluator="{key}"><span class="jd-bar-name">{_e(meta["name"])}{dagger}'
            f'<small>{_e(THEMIS_GROUPS[meta["group"]])}</small></span>'
            f'<span class="jd-bar-track" aria-hidden="true"><i class="jd-bar-zero" style="left:{pct(0)}"></i>'
            f'<i class="jd-bar-fill" style="left:{pct(left)};width:{(right - left) / span * 100:.2f}%"></i></span>'
            f'<span class="jd-bar-value" data-value="{key}">{_minus(text)}</span></li>')
    missing = [names[e['key']]['name'] for e in THEMIS_EVALUATORS
               if e['key'] not in values and any(e['key'] in m['values'] for m in view['measures'].values())]
    bench = _bench_name(view['benchmark'])
    title = f'{bench} · {view["label"]} · {THEMIS_MEASURES[measure]}'
    caution = view['cautions'].get(measure, '')
    chart = (f'<div class="jd-block"><h4 data-jd-view-title>{_e(title)}</h4>'
             f'<p class="jd-axis" aria-hidden="true"><span>{_minus(f"{low / 1000:.1f}")}</span><span>{_minus(f"{high / 1000:.1f}")}</span></p>'
             f'<ol class="jd-bars" aria-label="{_e(title)}, highest first">{"".join(rows)}</ol>'
             + (f'<p class="jd-caption">Not printed for this measure: {_e(", ".join(missing))}.</p>' if missing else '')
             + f'<p class="jd-caption">{_tag("measured", entry["table"])} correlation with human ratings, as printed. '
             '† reference-based in Table 2; comet22, AUTOCALIBRATE, CoAScore and HD-EVAL-NN appear only in the appendix tables, which do not mark reference use.</p>'
             + (f'<p class="jd-caution" data-jd-caution>{_e(caution)}</p>' if caution else '') + '</div>')
    board = themis_scoreboard(views, measure)
    by_bench: dict[str, list[dict[str, Any]]] = {}
    for cell in board:
        by_bench.setdefault(cell['benchmark'], []).append(cell)
    board_rows = []
    for benchmark in THEMIS_BENCHMARKS:
        cells = by_bench.get(benchmark['id'])
        if not cells:
            continue
        # Static cells are plain text; the browser script turns them into buttons that open the column.
        items = ''.join(
            f'<li><span class="jd-cell{" is-gpt4-win" if c["diff"] < 0 else " is-tie" if c["diff"] == 0 else ""}'
            f'{" is-current" if c["view"] == view_id else ""}" data-jd-view="{c["view"]}">'
            f'<span>{_e(c["label"])}</span><strong>{_signed(c["diff"])}</strong></span></li>' for c in cells)
        board_rows.append(f'<div class="jd-board-row"><p>{_e(benchmark["name"])}</p><ul>{items}</ul></div>')
    losses = sum(1 for c in board if c['diff'] < 0)
    board_html = (f'<div class="jd-block jd-board"><h4>Themis-8B minus GPT-4, every printed column · {_e(THEMIS_MEASURES[measure])}</h4>'
                  f'{"".join(board_rows)}'
                  f'<p class="jd-caption">{_tag("computed")} differences of printed values; warm cells are columns where GPT-4 '
                  f'is higher. {losses} of {len(board)} columns.</p></div>')
    # The grid answers the title question for every column; the bars detail the selected one.
    return board_html + chart, themis_verdict(views, view, measure, ranked, board)


def themis_verdict(views: Sequence[dict[str, Any]], view: dict[str, Any], measure: str,
                   ranked: Sequence[tuple[str, str]], board: Sequence[dict[str, Any]]) -> str:
    names = _themis_names()
    values = dict(ranked)
    bench = _bench_name(view['benchmark'])
    entry = view['measures'][measure]
    text = f'{bench} · {view["label"]} · {THEMIS_MEASURES[measure]} ({entry["table"]}). '
    if 'themis' in values and 'gpt4' in values:
        diff = _milli(values['themis']) - _milli(values['gpt4'])
        if diff == 0:
            lead = 'a tie'
        else:
            lead = f'{"Themis-8B" if diff > 0 else "GPT-4"} leads by {abs(diff) / 1000:.3f}'
        text += f'Themis-8B {_minus(values["themis"])} vs GPT-4 {_minus(values["gpt4"])}: {lead}. '
    elif 'themis' in values:
        text += f'Themis-8B {_minus(values["themis"])}; GPT-4 is not printed for this column. '
    if 'themis' in values:
        above = [(k, v) for k, v in ranked if _milli(v) > _milli(values['themis'])]
        if above:
            listed = ', '.join(f'{names[k]["name"]} {_minus(v)}' for k, v in above)
            text += f'{len(above)} evaluator{"s" if len(above) != 1 else ""} score{"" if len(above) != 1 else "s"} above Themis here: {listed}. '
        else:
            text += 'No printed evaluator scores above Themis here. '
    losses = sum(1 for c in board if c['diff'] < 0)
    text += f'Under {THEMIS_MEASURES[measure]}, GPT-4 is higher than Themis in {losses} of the {len(board)} columns where both are printed.'
    return text


def _themis_subset_buttons(views: Sequence[dict[str, Any]], benchmark: str, current: str) -> str:
    return ''.join(_button(f'view:{v["id"]}', _e(v['label']), v['id'] == current)
                   for v in views if v['benchmark'] == benchmark)


def _themis(slug: str, demo: dict[str, Any]) -> str:
    views = themis_views()
    default = next(v for v in views if v['benchmark'] == THEMIS_DEFAULT['benchmark'] and v['subset'] == THEMIS_DEFAULT['subset'])
    measure = THEMIS_DEFAULT['measure']
    benchmarks = ''.join(_button(f'bench:{b["id"]}', _e(b['name']), b['id'] == default['benchmark']) for b in THEMIS_BENCHMARKS)
    measures = ''.join(_button(f'measure:{m}', _e(label), m == measure, '' if m in default['measures'] else ' disabled')
                       for m, label in THEMIS_MEASURES.items())
    controls = (_group('Benchmark', benchmarks)
                + _group('Column', _themis_subset_buttons(views, default['benchmark'], default['id']), ' data-jd-subsets')
                + _group('Correlation', measures)
                + '<p class="jd-help">A measure is available only where the paper prints it. Select a cell in the '
                  'difference grid to open that column.</p>')
    results, verdict = themis_state(views, default['id'], measure)
    config = {'evaluators': THEMIS_EVALUATORS, 'groups': THEMIS_GROUPS, 'measures': THEMIS_MEASURES,
              'benchmarks': THEMIS_BENCHMARKS, 'views': views, 'default': {'view': default['id'], 'measure': measure}}
    return _shell(slug, demo, OWNED[slug], controls, results, verdict, config)


# ===========================================================================
# NLG evaluation survey (Computational Linguistics 2025): four paradigms.
# ===========================================================================

SURVEY_PARADIGMS = [
    {'id': 'derived', 'name': 'LLM-derived metrics', 'section': '§2'},
    {'id': 'prompting', 'name': 'Prompting LLMs', 'section': '§3'},
    {'id': 'finetuning', 'name': 'Fine-tuning LLMs', 'section': '§4'},
    {'id': 'collab', 'name': 'Human–LLM collaboration', 'section': '§5'},
]
# Rows of the comparison: each cell is (text, reference to the survey).
SURVEY_ROWS = [
    {'id': 'signal', 'label': 'Signal source', 'cells': {
        'derived': ('Embeddings or token probabilities of an LLM, used directly or as the change in probability under altered inputs', '§2.1–2.2'),
        'prompting': ('A judgment the LLM writes, given instructions, criteria and the input content in a prompt', '§3'),
        'finetuning': ('An open LLM trained on evaluation data, annotated mostly by GPT-4 and sometimes by humans', 'Table 2'),
        'collab': ('People and an LLM together: people guide the LLM’s evaluation, or the LLM assists human evaluators', '§5.1–5.2')}},
    {'id': 'reference', 'label': 'Needs a reference?', 'cells': {
        'derived': ('Often not: unlike BERTScore-style metrics, many LLM embedding metrics need no reference', '§2.1'),
        'prompting': ('Optional: references, sources or facts are added when the criterion needs them; GPT-4 without references beat reference-based MT metrics', '§3.3'),
        'finetuning': ('Depends on the evaluator: Prometheus, Prometheus 2 and INSTRUCTSCORE require one, CritiqueLLM and JudgeLM are flexible, the other seven do not', 'Table 3'),
        'collab': ('Not discussed as a property of this paradigm', '§5')}},
    {'id': 'training', 'label': 'Needs training?', 'cells': {
        'derived': ('No; existing models are used unchanged', '§6.2'),
        'prompting': ('No; existing models are used unchanged', '§6.2'),
        'finetuning': ('Yes: an extra training cost, repeated from scratch for each new foundation model', '§4.4, §6.2'),
        'collab': ('Not the main cost; human experts take part in each task', '§6.2')}},
    {'id': 'output', 'label': 'Output', 'cells': {
        'derived': ('A number transformed from embeddings or probabilities', '§3'),
        'prompting': ('Scores, pairwise comparisons, rankings, yes/no answers or error analyses, often with explanations', '§3.1–3.2'),
        'finetuning': ('Scores, comparisons, overall judgments or MQM-style error analyses, each with reasons', 'Table 3'),
        'collab': ('Checklist scores and explanations revised by people, test cases, audits or critiques', '§5.1–5.2')}},
    {'id': 'methods', 'label': 'Representative methods', 'cells': {
        'derived': ('GPTScore, Es et al. (2023), Murugadoss et al. (2024), FFLM, DELTASCORE', '§2.1–2.2'),
        'prompting': ('Kocmi and Federmann (2023a, 2023b), GPTRank, BooookScore, ChatEval, Branch-Solve-Merge; G-Eval in Table 4', '§3.1, §3.5'),
        'finetuning': ('PandaLM, Prometheus, Prometheus 2, Shepherd, TIGERScore, INSTRUCTSCORE, Auto-J, CritiqueLLM, JudgeLM, Themis, CompassJudger-1, Self-Taught', '§4'),
        'collab': ('COEVAL, InteractEval, HMCEval, EvalAssist, AdaTest, AdaTest++', '§5.1–5.2')}},
    {'id': 'failure', 'label': 'Main failure mode', 'cells': {
        'derived': ('Fails stress tests, costs more compute than traditional metrics, can carry social bias, and cannot use closed models that hide logits', '§2.3'),
        'prompting': ('Position, length and self-preference biases; rates factually wrong answers above short or ungrammatical ones; high-score bias in non-Latin languages; proprietary models may not reproduce', '§3.6'),
        'finetuning': ('Keeps GPT-4 biases such as self-bias; asking for too many evaluation settings can make training fail; results are hard to compare across papers', '§4.4'),
        'collab': ('Sensitive to prompt wording, weak confidence calibration, and human oversight is still needed', '§5.3')}},
]
# Section 6.2 orderings: list of tiers, best (or cheapest) first.
SURVEY_ORDERINGS = {
    'flexibility': {'label': 'Flexibility', 'tiers': [['collab'], ['prompting'], ['finetuning'], ['derived']], 'sep': '>',
                    'why': 'People provide the most flexibility; LLM-derived metrics do not fully allow criteria in natural language; proprietary prompted models follow instructions better than smaller open models.'},
    'reproducibility': {'label': 'Reproducibility', 'tiers': [['derived', 'prompting'], ['finetuning'], ['collab']], 'sep': '>',
                        'why': 'Unmodified models reproduce best, unless a proprietary model is deprecated; recruiting and training annotators is hardest to repeat.'},
    'performance': {'label': 'Performance', 'tiers': [['collab'], ['finetuning', 'prompting'], ['derived']], 'sep': '>',
                    'why': 'Ranked on SummEval (Table 4); among fine-tuned evaluators only those trained for NLG evaluation, such as Themis, beat prompted GPT-4.'},
    'cost': {'label': 'Cost', 'tiers': [['derived', 'prompting'], ['finetuning', 'prompting'], ['collab']], 'sep': '<',
             'why': 'Prompting is cheapest with an open model and costs as much as fine-tuning with a proprietary API; collaboration needs human experts for each task.',
             'notes': {0: {'prompting': 'open-source LLM'}, 1: {'prompting': 'proprietary LLM'}}},
}
SURVEY_DEFAULT_ORDER = 'flexibility'
# SummEval overall correlation (Table 4), every printed row grouped by paradigm.
SURVEY_SUMMEVAL = {
    'derived': [('GPTScore (FT5)', '0.415'), ('GPTScore (OPT)', '0.382'), ('GPTScore (GPT-3)', '0.417'),
                ('GPTScore (Phi-4)', '0.324'), ('GPTScore (LLaMa-3.1)', '0.405'), ('GPTScore (Qwen-2.5)', '0.436')],
    'prompting': [('G-Eval (GPT-3.5)', '0.409'), ('G-Eval (GPT-4)', '0.523'), ('Phi-4', '0.451'),
                  ('LLaMa-3.1', '0.427'), ('Qwen-2.5', '0.497')],
    'finetuning': [('INSTRUCTSCORE', '0.258'), ('Prometheus 2', '0.336'), ('Themis', '0.553'),
                   ('TIGERScore', '0.384'), ('CompassJudger-1', '0.411')],
    'collab': [('InteractEval (GPT-3.5 1st)', '0.640'), ('InteractEval (GPT-3.5 2nd)', '0.638'),
               ('InteractEval (GPT-4 1st)', '0.714'), ('InteractEval (GPT-4 2nd)', '0.725')],
}
# Situations: for each paradigm, (status, reason, reference). Status: fits, caveat, out.
SURVEY_FILTERS = [
    {'id': 'noref', 'label': 'No reference text', 'effects': {
        'derived': ('fits', 'Many LLM embedding metrics need no reference.', '§2.1'),
        'prompting': ('fits', 'References are optional; GPT-4 without references beat reference-based MT metrics.', '§3.3'),
        'finetuning': ('caveat', 'Avoid Prometheus, Prometheus 2 and INSTRUCTSCORE, which require a reference.', 'Table 3')}},
    {'id': 'closed', 'label': 'Judge is a closed API model', 'effects': {
        'derived': ('out', 'Closed models do not expose parameters, representations or logits.', '§2.3'),
        'prompting': ('caveat', 'Works through the API, but proprietary models are opaque and may not reproduce.', '§3.6'),
        'finetuning': ('out', 'Fine-tuning needs an open foundation model.', '§4'),
        'collab': ('fits', 'The LLM side is prompted, as in COEVAL and InteractEval.', '§5.1')}},
    {'id': 'notrain', 'label': 'No budget to train a model', 'effects': {
        'derived': ('fits', 'Existing models are used unchanged.', '§6.2'),
        'prompting': ('fits', 'Existing models are used unchanged.', '§6.2'),
        'finetuning': ('caveat', 'Building an evaluator needs training, repeated for each new foundation model; only an evaluator someone has already trained fits.', '§4.4, §6.2')}},
    {'id': 'nohumans', 'label': 'No human experts available', 'effects': {
        'collab': ('out', 'Needs human experts for each task and continued human oversight.', '§6.2, §5.3')}},
    {'id': 'reproducible', 'label': 'Results must be reproducible', 'effects': {
        'derived': ('fits', 'Ranked most reproducible, tied with prompting.', '§6.2'),
        'prompting': ('caveat', 'Tied for most reproducible, but results from a proprietary model are lost when it is deprecated.', '§6.2'),
        'finetuning': ('caveat', 'Ranked below unmodified models, although §4.4 credits small open evaluators with good reproducibility.', '§6.2, §4.4'),
        'collab': ('caveat', 'Least reproducible: annotators must be recruited and trained again.', '§6.2')}},
    {'id': 'criteria', 'label': 'Criteria written in natural language', 'effects': {
        'derived': ('caveat', 'Least flexible: criteria cannot be fully expressed in natural language.', '§6.2'),
        'prompting': ('fits', 'Criteria and the evaluation method are written into the prompt.', '§3.6'),
        'finetuning': ('caveat', 'Only some evaluators take explicit criteria (Prometheus, Prometheus 2, Themis, CompassJudger-1); smaller open models follow instructions less well.', 'Table 3, §6.2'),
        'collab': ('fits', 'Most flexible: people write the checklist or refine the criteria.', '§5.1, §6.2')}},
    {'id': 'medium', 'label': 'Judge is a medium-sized open model', 'effects': {
        'prompting': ('caveat', 'Ask for pairwise comparisons: they beat scoring for FlanT5- and LLaMa-2-sized evaluators.', '§3.1'),
        'finetuning': ('fits', 'Most fine-tuned evaluators in Table 2 have fewer than 14B parameters.', '§4.4')}},
]
SURVEY_STATUS = {'fits': 'Fits', 'caveat': 'Fits with a caveat', 'out': 'Ruled out'}


def survey_assess(active: Sequence[str]) -> dict[str, dict[str, Any]]:
    """Combine the active situations: the worst status wins, and every reason is kept."""
    rank = {'fits': 0, 'caveat': 1, 'out': 2}
    result = {}
    for paradigm in SURVEY_PARADIGMS:
        status, reasons = 'fits', []
        for situation in SURVEY_FILTERS:
            if situation['id'] not in active or paradigm['id'] not in situation['effects']:
                continue
            effect, reason, ref = situation['effects'][paradigm['id']]
            if rank[effect] > rank[status]:
                status = effect
            if effect != 'fits':
                reasons.append({'situation': situation['label'], 'status': effect, 'text': reason, 'ref': ref})
        result[paradigm['id']] = {'status': status, 'reasons': reasons}
    return result


def _survey_ranks(order: str) -> dict[str, str]:
    """Rank label of each paradigm in one Section 6.2 ordering, e.g. '1st (tie)'."""
    spec = SURVEY_ORDERINGS[order]
    ordinals = ['1st', '2nd', '3rd', '4th']
    labels: dict[str, list[str]] = {}
    for position, tier in enumerate(spec['tiers']):
        note = spec.get('notes', {}).get(position, {})
        for paradigm in tier:
            text = ordinals[position] + (' (tie)' if len(tier) > 1 else '')
            if paradigm in note:
                text += f', {note[paradigm]}'
            labels.setdefault(paradigm, []).append(text)
    return {key: ' and '.join(value) for key, value in labels.items()}


def _survey_ordering_text(order: str) -> str:
    spec = SURVEY_ORDERINGS[order]
    names = {p['id']: p['name'] for p in SURVEY_PARADIGMS}
    tiers = []
    for position, tier in enumerate(spec['tiers']):
        note = spec.get('notes', {}).get(position, {})
        tiers.append(' ≈ '.join(names[p] + (f' ({note[p]})' if p in note else '') for p in tier))
    return f' {spec["sep"]} '.join(tiers)


def survey_state(active: Sequence[str], order: str) -> tuple[str, str]:
    assessment = survey_assess(active)
    # Without a selected situation no column is marked.
    status = {p['id']: assessment[p['id']]['status'] if active else 'none' for p in SURVEY_PARADIGMS}
    ranks = _survey_ranks(order)
    spec = SURVEY_ORDERINGS[order]
    head = ''.join(
        f'<th scope="col" class="jd-status-{status[p["id"]]}" data-paradigm="{p["id"]}">'
        f'<span class="jd-col-name">{_e(p["name"])} <small>{_e(p["section"])}</small></span>'
        f'<span class="jd-rank">{_e(spec["label"])}: {_e(ranks[p["id"]])}</span>'
        + (f'<span class="jd-status">{_e(SURVEY_STATUS[assessment[p["id"]]["status"]])}</span>' if active else '')
        + '</th>' for p in SURVEY_PARADIGMS)
    body = []
    for row in SURVEY_ROWS:
        cells = ''.join(
            f'<td class="jd-status-{status[p["id"]]}" data-label="{_e(p["name"])}">{_e(row["cells"][p["id"]][0])} '
            f'<span class="jd-ref">({_e(row["cells"][p["id"]][1])})</span></td>' for p in SURVEY_PARADIGMS)
        body.append(f'<tr><th scope="row">{_e(row["label"])}</th>{cells}</tr>')
    summeval = []
    for p in SURVEY_PARADIGMS:
        rows = SURVEY_SUMMEVAL[p['id']]
        best = max(rows, key=lambda r: _milli(r[1]))
        low = min(rows, key=lambda r: _milli(r[1]))
        summeval.append(
            f'<td class="jd-status-{status[p["id"]]}" data-label="{_e(p["name"])}">'
            f'<strong data-jd-best="{p["id"]}">{best[1]}</strong> {_e(best[0])}'
            f'<span class="jd-ref">range {low[1]}–{best[1]} over {len(rows)} rows (Table 4)</span></td>')
    body.append(f'<tr class="jd-measured-row"><th scope="row">Best SummEval overall</th>{"".join(summeval)}</tr>')
    reasons = []
    for p in SURVEY_PARADIGMS:
        for reason in assessment[p['id']]['reasons']:
            reasons.append(f'<li class="jd-status-{reason["status"]}"><strong>{_e(p["name"])}</strong> · '
                           f'{_e(reason["situation"])}: {_e(reason["text"])} <span class="jd-ref">({_e(reason["ref"])})</span></li>')
    caveats = (f'<div class="jd-block"><h4>Caveats for your situation</h4><ul class="jd-reasons">{"".join(reasons)}</ul></div>'
               if reasons else '')
    current = ' class="is-current"'
    orderings = ''.join(
        f'<li{current if key == order else ""} data-jd-order="{key}"><span>{_e(o["label"])}</span>'
        f'{_e(_survey_ordering_text(key))}</li>' for key, o in SURVEY_ORDERINGS.items())
    html = (
        '<div class="jd-table-wrap" tabindex="0" role="region" aria-label="Comparison of the four paradigms">'
        f'<table class="jd-paradigms"><thead><tr><th scope="col">Property</th>{head}</tr></thead><tbody>{"".join(body)}</tbody></table></div>'
        f'<p class="jd-caption">{_tag("published", "Sections 2–6, Tables 2–4")} each cell condenses the cited part of the survey. '
        f'{_tag("measured", "Table 4")} SummEval overall correlation, as printed; some rows come from Fu et al. (2023a), Hu et al. (2024) and Chu, Kim, and Yi (2025).</p>'
        + caveats +
        f'<div class="jd-block"><h4>The survey’s own comparison (§6.2)</h4><ol class="jd-orderings">{orderings}</ol>'
        f'<p class="jd-caption" data-jd-why>{_e(spec["why"])}</p></div>')
    return html, survey_verdict(active, order, assessment)


def survey_verdict(active: Sequence[str], order: str, assessment: dict[str, dict[str, Any]]) -> str:
    names = {p['id']: p['name'] for p in SURVEY_PARADIGMS}
    spec = SURVEY_ORDERINGS[order]
    ordering = f'{spec["label"]} (§6.2): {_survey_ordering_text(order)}.'
    if not active:
        return f'No situation selected; every paradigm is shown. {ordering}'
    groups = {status: [names[p] for p, a in assessment.items() if a['status'] == status] for status in SURVEY_STATUS}
    parts = []
    for status, label in (('fits', 'Fit'), ('caveat', 'Fit with a caveat'), ('out', 'Ruled out')):
        if groups[status]:
            parts.append(f'{label}: {", ".join(groups[status])}.')
    return ' '.join(parts) + f' {ordering}'


def _survey(slug: str, demo: dict[str, Any]) -> str:
    situations = ''.join(_button(f'filter:{f["id"]}', _e(f['label'])) for f in SURVEY_FILTERS)
    orders = ''.join(_button(f'order:{key}', _e(o['label']), key == SURVEY_DEFAULT_ORDER) for key, o in SURVEY_ORDERINGS.items())
    controls = (_group('Your situation', situations) + _group('Rank by (§6.2)', orders)
                + '<p class="jd-help">Situations combine: a paradigm keeps the strictest status any selected situation gives it, '
                  'and every reason is listed with its section.</p>')
    results, verdict = survey_state([], SURVEY_DEFAULT_ORDER)
    config = {'paradigms': SURVEY_PARADIGMS, 'rows': SURVEY_ROWS, 'orderings': SURVEY_ORDERINGS,
              'summeval': SURVEY_SUMMEVAL, 'filters': SURVEY_FILTERS, 'status': SURVEY_STATUS,
              'defaultOrder': SURVEY_DEFAULT_ORDER}
    return _shell(slug, demo, OWNED[slug], controls, results, verdict, config)


# ===========================================================================
# EAMA (arXiv 2402.19404v5): NYTimes800k ablation ladder and input analysis.
# ===========================================================================

EAMA_METRICS = [
    {'id': 'cider', 'label': 'CIDEr'}, {'id': 'bleu', 'label': 'BLEU-4'}, {'id': 'meteor', 'label': 'METEOR'},
    {'id': 'rouge', 'label': 'ROUGE'}, {'id': 'p', 'label': 'Entity precision'}, {'id': 'r', 'label': 'Entity recall'},
]
EAMA_ORDER = ['bleu', 'meteor', 'rouge', 'cider', 'p', 'r']   # printed column order
# rows: printed values in EAMA_ORDER; parent: the row the change is measured against.
EAMA_ROWS = [
    {'id': 'osft', 'group': 'ladder', 'name': 'InstructBLIP (OSFT)', 'change': 'Official recipe: only the vision–language connector is fine-tuned',
     'table': 'Table 2', 'values': '10.05 13.63 25.45 75.95 27.39 30.37', 'parent': None},
    {'id': 'base', 'group': 'ladder', 'name': 'Base', 'change': '+ full fine-tuning of the connector and the LLM',
     'table': 'Table 2', 'values': '10.88 14.09 26.60 82.70 29.22 31.32', 'parent': 'osft'},
    {'id': 'sent', 'group': 'ladder', 'name': 'Align (SENT + CAP)', 'change': '+ entity-aware sentence selection task',
     'table': 'Table 2', 'values': '10.92 14.08 26.68 83.60 29.42 31.45', 'parent': 'base'},
    {'id': 'ent', 'group': 'ladder', 'name': 'Align (ENT + CAP)', 'change': '+ entity selection task',
     'table': 'Table 2', 'values': '10.97 14.20 26.87 84.28 29.26 31.58', 'parent': 'base'},
    {'id': 'align', 'group': 'ladder', 'name': 'Align (SENT + ENT + CAP)', 'change': '+ both alignment tasks',
     'table': 'Table 2', 'values': '10.80 14.08 26.80 84.45 29.15 31.45', 'parent': 'base'},
    {'id': 'eama', 'group': 'ladder', 'name': 'EAMA', 'change': '+ self-supplemented input: the aligned model’s own selected sentences and entities',
     'table': 'Table 2', 'values': '11.03 14.22 27.15 87.00 29.79 32.24', 'parent': 'align'},
    {'id': 'full', 'group': 'input', 'name': 'Base, full article', 'change': 'Whole article in training and inference (about twice the time and memory)',
     'table': 'Table 4', 'values': '10.76 13.84 26.18 83.17 27.71 30.03', 'parent': 'base'},
    {'id': 'base-longer', 'group': 'input', 'name': 'Base, longer local context', 'change': 'Usual context extended to the supplemented length at inference',
     'table': 'Table 4', 'values': '10.60 13.80 26.28 81.75 28.95 30.57', 'parent': 'base'},
    {'id': 'align-longer', 'group': 'input', 'name': 'Align, longer local context', 'change': 'Aligned model, usual context extended to the same length',
     'table': 'Table 4', 'values': '10.75 14.00 26.70 83.50 29.25 31.16', 'parent': 'align'},
    {'id': 'oracle-sent', 'group': 'oracle', 'name': 'Base + oracle sentences', 'change': 'Sentences sharing entities with the reference caption',
     'table': 'Table 4', 'values': '11.24 14.50 27.70 87.56 33.42 34.80', 'parent': 'base'},
    {'id': 'oracle-ent', 'group': 'oracle', 'name': 'Base + oracle entities', 'change': 'Entities in both the article and the reference caption',
     'table': 'Table 4', 'values': '11.63 14.76 27.90 90.44 32.04 34.24', 'parent': 'base'},
    {'id': 'oracle', 'group': 'oracle', 'name': 'Base + oracle sentences and entities', 'change': 'Upper bound: both oracle supplements',
     'table': 'Table 4', 'values': '11.89 15.07 28.79 94.27 35.71 37.10', 'parent': 'base'},
]
EAMA_SHORT = {'osft': 'OSFT', 'base': 'Base', 'align': 'Align (both tasks)'}
EAMA_GROUPS = {'ladder': 'Ablation ladder · Table 2', 'input': 'Reading more of the article · Table 4',
               'oracle': 'Oracle supplements from the reference caption · Table 4'}
EAMA_DEFAULT_METRIC = 'cider'


def _centi(text: str) -> int:
    return _round_half_up(float(text) * 100)


def eama_values(metric: str) -> dict[str, int]:
    column = EAMA_ORDER.index(metric)
    return {row['id']: _centi(row['values'].split()[column]) for row in EAMA_ROWS}


def _hundredths(value: int, signed: bool = False) -> str:
    text = f'{abs(value) / 100:.2f}'
    if not signed:
        return ('−' if value < 0 else '') + text
    return ('+' if value > 0 else '−' if value < 0 else '±') + text


def eama_state(metric: str) -> tuple[str, str]:
    values = eama_values(metric)
    label = next(m['label'] for m in EAMA_METRICS if m['id'] == metric)
    low = math.floor(min(values.values()) / 100 - 1) * 100
    high = math.ceil(max(values.values()) / 100 + 1) * 100
    span = high - low

    def pct(value: int) -> str:
        return f'{(value - low) / span * 100:.2f}%'

    groups = []
    for group, title in EAMA_GROUPS.items():
        items = []
        for row in (r for r in EAMA_ROWS if r['group'] == group):
            value = values[row['id']]
            parent = values[row['parent']] if row['parent'] else None
            delta = value - parent if parent is not None else 0
            left, right = sorted([parent if parent is not None else value, value])
            segment = (f'<i class="jd-step {"is-up" if delta > 0 else "is-down" if delta < 0 else ""}" '
                       f'style="left:{pct(left)};width:{(right - left) / span * 100:.2f}%"></i>') if parent is not None else ''
            change = (f'{_hundredths(delta, True)} vs {EAMA_SHORT[row["parent"]]}'
                      if parent is not None else 'starting point')
            items.append(
                f'<li class="jd-rung jd-rung-{group}{" is-eama" if row["id"] == "eama" else ""}" data-row="{row["id"]}">'
                f'<div class="jd-rung-text"><strong>{_e(row["name"])}</strong><small>{_e(row["change"])}</small></div>'
                f'<span class="jd-rung-track" aria-hidden="true">{segment}<i class="jd-dot" style="left:{pct(value)}"></i></span>'
                f'<span class="jd-rung-value"><b data-value="{row["id"]}">{_hundredths(value)}</b>'
                f'<small data-delta="{row["id"]}" class="{"is-down" if delta < 0 else ""}">{_e(change)}</small></span></li>')
        groups.append(f'<div class="jd-ladder-group"><h4>{_e(title)}</h4><ol class="jd-ladder">{"".join(items)}</ol></div>')
    base, align, eama, oracle = values['base'], values['align'], values['eama'], values['oracle']
    gap = oracle - base
    closed = eama - base
    share = _round_half_up(closed / gap * 100) if gap else 0
    gap_html = (
        f'<dl class="jd-gap"><div><dt>Alignment tasks</dt><dd data-jd-gap="align">{_hundredths(align - base, True)}</dd></div>'
        f'<div><dt>Self-supplemented input</dt><dd data-jd-gap="supplement">{_hundredths(eama - align, True)}</dd></div>'
        f'<div><dt>Still to the oracle</dt><dd data-jd-gap="remaining">{_hundredths(oracle - eama, True)}</dd></div>'
        f'<div><dt>Share of the Base-to-oracle gap EAMA closes</dt><dd data-jd-gap="share">{share}%</dd></div></dl>')
    html = (f'<p class="jd-axis jd-axis-ladder" aria-hidden="true"><span>{_hundredths(low)}</span><span>{_hundredths(high)}</span></p>'
            + ''.join(groups) + gap_html +
            f'<p class="jd-caption">{_tag("measured", "Tables 2 and 4")} NYTimes800k test results, as printed in arXiv v5. '
            f'{_tag("computed")} each change against the row named next to it, and the gap shares. '
            'Bars run from that row’s value to this row’s value; oracle rows use the reference caption, which is not available at inference.</p>')
    return html, eama_verdict(metric, values)


def eama_verdict(metric: str, values: dict[str, int]) -> str:
    label = next(m['label'] for m in EAMA_METRICS if m['id'] == metric)
    names = {row['id']: row['name'] for row in EAMA_ROWS}
    base, eama, oracle = values['base'], values['eama'], values['oracle']
    gap = oracle - base
    share = _round_half_up((eama - base) / gap * 100) if gap else 0
    text = (f'{label}: EAMA {_hundredths(eama)} against Base {_hundredths(base)} and the oracle {_hundredths(oracle)}, '
            f'closing {share}% of the gap. ')
    variants = ['sent', 'ent', 'align']
    best = max(variants, key=lambda k: (values[k], -variants.index(k)))
    if best == 'align':
        text += 'The two alignment tasks together beat either task alone. '
    else:
        text += f'Among the alignment variants, {names[best]} scores highest; combining both tasks is not best on this metric. '
    full = values['full'] - base
    text += (f'Reading the full article changes Base by {_hundredths(full, True)}, against '
             f'{_hundredths(eama - base, True)} for EAMA’s selected context.')
    if values['align'] < base:
        text += f' Alignment alone lowers {label.lower() if label.startswith("Entity") else label} below Base.'
    return text


def _eama(slug: str, demo: dict[str, Any]) -> str:
    metrics = ''.join(_button(f'metric:{m["id"]}', _e(m['label']), m['id'] == EAMA_DEFAULT_METRIC) for m in EAMA_METRICS)
    controls = _group('Metric', metrics)
    results, verdict = eama_state(EAMA_DEFAULT_METRIC)
    config = {'metrics': EAMA_METRICS, 'order': EAMA_ORDER, 'rows': EAMA_ROWS, 'groups': EAMA_GROUPS, 'short': EAMA_SHORT,
              'defaultMetric': EAMA_DEFAULT_METRIC}
    return _shell(slug, demo, OWNED[slug], controls, results, verdict, config)


# ===========================================================================
# Contextual ASR error correction (LREC-COLING 2024): kNN datastore modes.
# ===========================================================================

ASR_DOCS = ['A', 'B', 'C']        # A is the document being followed; B and C are other test documents
ASR_POSITIONS = 5                 # sentences per document in the schematic
ASR_TARGET = 3                    # the sentence whose correction needs the cue
ASR_CASES = {
    'pronoun': {
        'button': 'Table 1 · 他 or 她',
        'source': 'Table 1',
        'cue_doc': 'A',
        'positions': {'before': 2, 'after': 4},
        'cue': '本场比赛朱婷三七次扣球得到二十一分。',
        'cue_gloss': 'Table 1: “Zhu Ting scored twenty-one points in this game …”; the paper names 朱婷 (Zhu Ting) as the context needed',
        'output': '他还凭借拦网和发球分别拿到七分和一分。',
        'output_gloss': 'BART: “He also had seven points and one point with his block and serve.”',
        'label': '她还凭借拦网和发球分别拿到七分和一分。',
        'label_gloss': 'Label: “She also …”; 他 and 她 are both pronounced tā',
        'reading': 'the attention states of the sentence that names 朱婷 (Zhu Ting)',
    },
    'dataset': {
        'button': 'Table 4 · 管撤 or 贯彻',
        'source': 'Table 4',
        'cue_doc': 'B',
        'positions': {'before': 2, 'after': 4},
        'cue': '深入贯彻落实科学发展观。',
        'cue_gloss': '“Deeply implement the scientific concept of development”, a sentence from another document',
        'output': '编者按：为深入管撤落实中央八项规定精神。',
        'output_gloss': 'BART keeps the misrecognized 管撤',
        'label': '编者按：为深入贯彻落实中央八项规定精神。',
        'label_gloss': 'Label: 贯彻 (“implement”), which the paper’s model restores',
        'reading': 'the attention states of 贯彻 in the other document’s sentence',
    },
}
ASR_MODES = {
    ('online', 'document'): {'name': 'Online, document context', 'cer': '3.412'},
    ('online', 'dataset'): {'name': 'Online, dataset context', 'cer': '3.379'},
    ('offline', 'document'): {'name': 'Offline, document context', 'cer': '3.407'},
    ('offline', 'dataset'): {'name': 'Offline, dataset context', 'cer': '3.336*'},
}
ASR_BART_CER = '3.528'
ASR_DEFAULT = {'case': 'pronoun', 'cue': 'before', 'timing': 'online', 'scope': 'document', 'step': 0}
ASR_STATE_LABELS = {'current': 'being corrected', 'same': 'searchable, same document', 'other': 'searchable, other document',
                    'pending': 'not processed yet', 'outside': 'outside this document’s datastore'}


def asr_cell_state(doc: str, position: int, step: int, timing: str, scope: str) -> str:
    """State of sentence (doc, position) while sentence A<step> is corrected (Section 3.4, Figure 2).

    Online: only sentences of earlier steps are stored (documents of a batch advance in parallel).
    Offline: the finished online store, so every sentence in scope is searchable.
    Document context searches document A only; dataset context searches every test document.
    """
    if step and doc == 'A' and position == step:
        return 'current'
    stored = timing == 'offline' or position < step
    if not stored:
        return 'pending'
    if scope == 'document' and doc != 'A':
        return 'outside'
    return 'same' if doc == 'A' else 'other'


def asr_cue_cell(case: str, cue: str) -> tuple[str, int]:
    spec = ASR_CASES[case]
    return spec['cue_doc'], spec['positions'][cue]


def asr_cue_reason(case: str, cue: str, timing: str, scope: str) -> tuple[bool, str]:
    """Is the cue searchable when the target is corrected, and if not, why."""
    doc, position = asr_cue_cell(case, cue)
    state = asr_cell_state(doc, position, ASR_TARGET, timing, scope)
    if state in ('same', 'other'):
        return True, 'searchable'
    if state == 'pending':
        return False, 'not processed yet' if position > ASR_TARGET else 'processed in the same step'
    return False, 'in another document'


def _asr_counts(step: int, timing: str, scope: str) -> dict[str, int]:
    counts = {'same': 0, 'other': 0}
    for doc in ASR_DOCS:
        for position in range(1, ASR_POSITIONS + 1):
            state = asr_cell_state(doc, position, step, timing, scope)
            if state in counts:
                counts[state] += 1
    return counts


def asr_state(case: str, cue: str, timing: str, scope: str, step: int) -> tuple[str, str]:
    spec = ASR_CASES[case]
    cue_doc, cue_position = asr_cue_cell(case, cue)
    rows = []
    for doc in ASR_DOCS:
        cells = []
        for position in range(1, ASR_POSITIONS + 1):
            state = asr_cell_state(doc, position, step, timing, scope)
            role = ('cue' if (doc, position) == (cue_doc, cue_position) else
                    'target' if (doc, position) == ('A', ASR_TARGET) else '')
            mark = {'cue': 'cue', 'target': 'target'}.get(role, '')
            cells.append(
                f'<li class="jd-cell-asr is-{state}{" is-" + role if role else ""}" data-cell="{doc}{position}" '
                f'data-state="{state}"><b>{doc}{position}</b><small>{mark}</small>'
                f'<span class="jd-visually-hidden">{_e(ASR_STATE_LABELS[state])}</span></li>')
        name = 'Document A (followed)' if doc == 'A' else f'Document {doc}'
        rows.append(f'<div class="jd-doc-row"><p>{name}</p><ol aria-label="{name}">{"".join(cells)}</ol></div>')
    legend = ''.join(f'<li class="is-{key}"><i aria-hidden="true"></i>{_e(label)}</li>' for key, label in ASR_STATE_LABELS.items())
    counts = _asr_counts(step, timing, scope)
    mode = ASR_MODES[(timing, scope)]['name']
    step_text = (f'Step {step} of {ASR_POSITIONS}: correcting A{step}' if step else
                 f'Step 0 of {ASR_POSITIONS}: before correction starts')
    store = (f'<p class="jd-store" data-jd-store><strong data-jd-step>{_e(step_text)}</strong>'
             f'<span>{_e(mode)} · searchable: <b data-jd-count="same">{counts["same"]}</b> sentence{"s" if counts["same"] != 1 else ""} of document A, '
             f'<b data-jd-count="other">{counts["other"]}</b> of other documents</span></p>')
    texts = (f'<dl class="jd-asr-texts"><div><dt>A{ASR_TARGET} · target</dt><dd lang="zh">{_e(spec["output"])}</dd><dd class="jd-gloss">{_e(spec["output_gloss"])}</dd>'
             f'<dd lang="zh">{_e(spec["label"])}</dd><dd class="jd-gloss">{_e(spec["label_gloss"])}</dd></div>'
             f'<div><dt>{cue_doc}{cue_position} · cue</dt><dd lang="zh">{_e(spec["cue"])}</dd><dd class="jd-gloss">{_e(spec["cue_gloss"])}</dd></div></dl>')
    summary_rows = []
    for (t, s), info in ASR_MODES.items():
        cols = []
        for option in ('before', 'after'):
            ok, reason = asr_cue_reason(case, option, t, s)
            cols.append(f'<td class="{"is-yes" if ok else "is-no"}">{"Yes" if ok else "No"}<small>{_e("" if ok else reason)}</small></td>')
        current = ' class="is-current"' if (t, s) == (timing, scope) else ''
        summary_rows.append(f'<tr{current}><th scope="row">{_e(info["name"])}</th>{"".join(cols)}<td>{_e(info["cer"])}</td></tr>')
    before_cell = f'{spec["cue_doc"]}{spec["positions"]["before"]}'
    after_cell = f'{spec["cue_doc"]}{spec["positions"]["after"]}'
    summary = (
        '<div class="jd-block"><h4>Is the cue searchable when A3 is corrected?</h4>'
        '<div class="jd-table-wrap" tabindex="0" role="region" aria-label="Cue availability by mode">'
        f'<table class="jd-asr-summary"><thead><tr><th scope="col">Datastore mode</th><th scope="col">Cue in {before_cell}</th>'
        f'<th scope="col">Cue in {after_cell}</th><th scope="col">AISHELL-1 CER ↓</th></tr></thead>'
        f'<tbody>{"".join(summary_rows)}</tbody></table></div>'
        f'<p class="jd-caption">{_tag("computed", "Section 3.4 rules")} availability in this schematic. '
        f'{_tag("measured", "Table 2")} character error rate after correction; sentence-level BART {ASR_BART_CER}; '
        '* significant against BART at p &lt; 0.05. Availability is necessary, not sufficient: the model still has to retrieve and use the states.</p></div>')
    html = (f'<div class="jd-asr-grid">{"".join(rows)}</div><ul class="jd-legend">{legend}</ul>{store}{texts}'
            f'<p class="jd-caption">{_tag("published", spec["source"])} sentences, BART output and label. '
            f'{_tag("schematic")} three test documents of five sentences processed in parallel, one position per step, as in Figure 2(a); '
            'the positions of the cue and the target are reader-set and illustrative, since the paper prints the sentences but not their places in the documents.</p>'
            + summary)
    return html, asr_verdict(case, cue, timing, scope, step)


def asr_verdict(case: str, cue: str, timing: str, scope: str, step: int) -> str:
    spec = ASR_CASES[case]
    counts = _asr_counts(step, timing, scope)
    cue_doc, cue_position = asr_cue_cell(case, cue)
    total = counts['same'] + counts['other']
    if step == 0:
        if timing == 'online':
            return ('Before correction starts, the online datastore is empty. Each corrected sentence adds its attention keys '
                    'and values, so later sentences can search earlier ones.')
        return (f'The offline datastore starts from the finished online pass: {total} sentence{"s" if total != 1 else ""} '
                f'in scope are searchable before the first correction.')
    text = (f'Correcting A{step}: kNN attention can search {total} sentence{"s" if total != 1 else ""} '
            f'({counts["same"]} from document A, {counts["other"]} from other documents). ')
    if step == ASR_TARGET:
        ok, reason = asr_cue_reason(case, cue, timing, scope)
        if ok:
            text += f'The cue {cue_doc}{cue_position} is searchable, so the query can retrieve {spec["reading"]}.'
        else:
            text += (f'The cue {cue_doc}{cue_position} is not searchable ({reason}); like sentence-level BART, '
                     f'the corrector has only the sentence itself.')
    elif step < ASR_TARGET:
        text += f'A{ASR_TARGET} is corrected at step {ASR_TARGET}.'
    else:
        text += 'The target sentence has already been corrected.'
    if timing == 'online' and step:
        text += f' After this step, kNN add stores the keys and values of A{step}, B{step} and C{step}.'
    return text


def _asr(slug: str, demo: dict[str, Any]) -> str:
    d = ASR_DEFAULT
    cases = ''.join(_button(f'case:{key}', _e(spec['button']), key == d['case']) for key, spec in ASR_CASES.items())
    cue = ''.join(_button(f'cue:{key}', label, key == d['cue']) for key, label in
                  (('before', 'Cue before the target'), ('after', 'Cue after the target')))
    timing = ''.join(_button(f'timing:{key}', label, key == d['timing']) for key, label in (('online', 'Online'), ('offline', 'Offline')))
    scope = ''.join(_button(f'scope:{key}', label, key == d['scope']) for key, label in (('document', 'Document context'), ('dataset', 'Dataset context')))
    player = ('<div class="jd-player" role="group" aria-label="Walk through the document">'
              '<button type="button" data-asr-play aria-pressed="false">Play</button>'
              '<button type="button" data-asr-step>Step</button><button type="button" data-asr-reset>Reset</button>'
              f'<span class="jd-player-status" data-asr-status>Step {d["step"]} of {ASR_POSITIONS}</span></div>')
    controls = (_group('Published case', cases) + _group('Cue position (illustrative)', cue)
                + _group('Timing', timing) + _group('Scope', scope) + player
                + '<p class="jd-help">Play advances one sentence position per step; Step advances one; Reset returns to step 0. '
                  'With reduced motion, Play advances a single step.</p>')
    results, verdict = asr_state(d['case'], d['cue'], d['timing'], d['scope'], d['step'])
    config = {'docs': ASR_DOCS, 'positions': ASR_POSITIONS, 'target': ASR_TARGET, 'cases': ASR_CASES,
              'modes': [{'timing': t, 'scope': s, **info} for (t, s), info in ASR_MODES.items()],
              'bart': ASR_BART_CER, 'default': d, 'labels': ASR_STATE_LABELS}
    return _shell(slug, demo, OWNED[slug], controls, results, verdict, config)


RENDERERS = {'themis-benchmarks': _themis, 'survey-paradigms': _survey, 'eama-ladder': _eama, 'asr-datastore': _asr}


def render_demo(slug: str, insight: dict[str, Any]) -> str:
    """Render the demo for an owned page, or '' for pages owned by other modules."""
    if slug not in OWNED:
        return ''
    demo = insight.get('demo')
    if not demo or demo.get('kind') != OWNED[slug]:
        return ''
    return RENDERERS[OWNED[slug]](slug, demo)
