"""Gödel Agent: a concrete, executable case and source-grounded evidence."""
from html import escape
import json
from pathlib import Path

PAPER = 'https://arxiv.org/html/2410.04444v4'

# Original illustrations drawn by scripts/godel_illustrations.py. Body parts stand for
# parts of the program; each caption states the mechanism the panel depicts.
STRIP = [
    ('Try the tasks', 'The agent runs its current policy on validation tasks and gets back scores and errors.'),
    ('See its own parts', 'It inspects its own running code: the policy that solves tasks and the routine that edits the agent.'),
    ('Swap in a stronger arm', 'It writes a new policy and patches it into itself while it keeps running.'),
    ('Get stronger', 'The revised policy is evaluated on the same tasks.'),
    ('Survive a bad part', 'Some edits break things. Error handling catches the failure and returns it as feedback.'),
    ('Upgrade the upgrader', 'The improvement routine is code too, so it can be revised: reported changes include keeping full error traces and optimizing in parallel.'),
]


def render_overview(slug: str, insight: dict) -> str:
    if slug != 'godel-agent':
        return ''
    panels = ''.join(
        f'<li><img src="assets/godel-robot-{i}.svg" width="360" height="300" loading="lazy" decoding="async" '
        f'alt="Panel {i}: {escape(title)}. {escape(caption)}"><p><span>{i:02d}</span>{escape(caption)}</p></li>'
        for i, (title, caption) in enumerate(STRIP, start=1))
    return f'''<figure class="godel-strip" aria-labelledby="godel-strip-title">
      <div class="godel-strip-heading"><span class="demo-tag">Illustration · Sections 3–4 and 6.3</span>
        <h3 id="godel-strip-title">A robot that rebuilds itself</h3>
        <p>Its glasses stand for how it reads feedback, its arms for how it solves tasks, and its wrench hand for the routine that edits it. That last part is editable too.</p></div>
      <ol class="godel-strip-panels">{panels}</ol>
      <figcaption>Original illustration of the mechanism, not a record of one run. The score gauge is schematic; measured results appear in the evidence section.</figcaption>
    </figure>'''


def render_demo(slug: str, insight: dict) -> str:
    if slug != 'godel-agent':
        return ''
    return f'''
<div class="godel-case" data-paper-demo="godel-search">
  <header class="godel-case-heading"><span class="demo-tag">Case study · Game of 24</span>
    <h3>From asking for an expression to searching for one</h3>
    <p>Use four numbers exactly once, with +, −, ×, ÷ and parentheses, to make 24.
    In one reported run, six unsuccessful optimization attempts led the agent to replace its LLM-based solver with a search algorithm.</p>
  </header>
  <div class="godel-code-comparison">
    <section><div class="godel-code-title"><h4>Initial policy</h4><a href="{PAPER}#LST5">Listing 5 ↗</a></div>
      <pre><code>def solver(numbers):
    prompt = describe_game(numbers)
    response = call_language_model(prompt)
    return response</code></pre>
      <p>The model proposes the expression. Whether it obeys the rules depends on its generated answer.</p></section>
    <section><div class="godel-code-title"><h4>Rewritten policy</h4><a href="{PAPER}#LST6">Listing 6 ↗</a></div>
      <pre><code>def search(values):
    if one_value_remains(values):
        return equals_24(values[0])
    for a, b, operation in choices(values):
        reduced = apply(a, b, operation)
        if search(reduced):
            return solution</code></pre>
      <p>Code checks combinations of numbers and operations. A solved expression no longer needs an LLM call.</p></section>
  </div>
  <p class="godel-source-note">Condensed pseudocode of the published policies. The structural change is from generated answers to explicit search; the appendix contains the full Python implementations.</p>
  <div class="godel-workbench">
    <div class="godel-workbench-title"><h4>Run the search policy on a concrete problem</h4><span>Local computation</span></div>
    <div class="godel-input-controls" hidden data-godel-controls>
      <form class="godel-form">
        <label for="godel-numbers">Four numbers <input id="godel-numbers" value="3, 3, 8, 8" autocomplete="off" spellcheck="false" aria-describedby="godel-input-help"></label>
        <button type="submit" data-demo-action="solve">Find an expression</button>
      </form>
      <p id="godel-input-help">Enter four integers from 1 to 13. Repeated numbers are allowed.</p>
      <div class="godel-presets" role="group" aria-label="Example problems">
        <button type="button" data-demo-action="preset" data-numbers="3,3,8,8" aria-pressed="true">3, 3, 8, 8 · fractions</button>
        <button type="button" data-demo-action="preset" data-numbers="1,3,4,6" aria-pressed="false">1, 3, 4, 6</button>
        <button type="button" data-demo-action="preset" data-numbers="1,1,1,1" aria-pressed="false">1, 1, 1, 1 · impossible</button>
      </div>
    </div>
    <div class="godel-search-state" data-demo-state="search" aria-live="polite">
      <div class="godel-number-cards" aria-label="Input numbers"><span>3</span><span>3</span><span>8</span><span>8</span></div>
      <p class="godel-solution-label">A verified solution</p>
      <p class="godel-expression">8 ÷ (3 − (8 ÷ 3)) = 24</p>
      <p class="godel-validation">Each input is used once. Intermediate fractions are kept exactly.</p>
      <ol class="godel-arithmetic"><li><span>01</span><code>8 ÷ 3 = 8/3</code></li><li><span>02</span><code>3 − (8/3) = 1/3</code></li><li><span>03</span><code>8 ÷ (1/3) = 24</code></li></ol>
      <p class="godel-search-count">Three arithmetic operations combine the four input numbers.</p>
    </div>
  </div>
  <p class="godel-provenance">This is an executable browser adaptation of the search in Listing 6, with exact fractions, cached failed states, and expression reconstruction. The inputs are chosen for this page. It does not run the self-improvement agent or replay a recorded model response. Section 6.3 reports 100% accuracy for the separate search-based case study.</p>
</div>
<section class="godel-observed-run" aria-labelledby="godel-run-title">
  <div class="section-heading"><span class="demo-tag">A different run · original paper figure</span><h3 id="godel-run-title">Other runs kept the LLM—and changed the surrounding code</h3></div>
  <p class="godel-reading">The paper also documents an LLM-based path: add code-assisted verification, recover from a formatting error, try additional candidates, and revise the checks. The original curve shows that changes can help, fail, or be reverted. This is a different trajectory from the switch to search above.</p>
  <figure class="godel-paper-figure">
    <div class="godel-figure-scroll" tabindex="0" role="region" aria-label="Original Game of 24 charts; scroll horizontally on narrow screens"><a href="assets/godel-game24.svg" target="_blank" rel="noopener" aria-label="Open Figure 5 at full size"><img src="assets/godel-game24.svg" width="1615" height="501" alt="Paper Figure 5: a nonmonotonic LLM-based Game of 24 optimization trajectory and a comparison of different initial policies." loading="lazy"></a></div>
    <figcaption>Figure 5. Left: changes during an LLM-based run. Right: trajectories from different initial policies. On narrow screens, scroll to inspect both panels. Original vector figure; <a href="assets/godel-game24.svg" target="_blank" rel="noopener">open full size ↗</a> · <a href="{PAPER}#S6.F5">source ↗</a></figcaption>
  </figure>
</section>'''


def render_method(slug: str, insight: dict) -> str:
    if slug != 'godel-agent':
        return ''
    return f'''<div class="godel-change-table">
      <h3>What did it change beyond the solver?</h3>
      <p>Section 6.3 reports changes to both task execution and the process that proposes future edits.</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Reported changes to the agent">
        <table><thead><tr><th scope="col">Target</th><th scope="col">Reported change</th><th scope="col">Why it matters</th></tr></thead><tbody>
        <tr><th scope="row">Task solver</th><td>Replace LLM solving with search; in other runs, add code verification and additional attempts.</td><td>Changes how the next problem is solved.</td></tr>
        <tr><th scope="row">Failure analysis</th><td>Use detailed error traces instead of only error messages.</td><td>Changes the diagnostic evidence available for the next revision.</td></tr>
        <tr><th scope="row">Improvement procedure</th><td>Add parallel optimization, revise logging, and remove redundant code.</td><td>Changes how further improvements are attempted and inspected.</td></tr>
        </tbody></table>
      </div>
      <p class="godel-source-note">These changes are reported observations, not a complete timestamped execution log. <a href="{PAPER}#S6.SS3">Read the case study ↗</a></p>
    </div>'''


def render_evidence(slug: str, insight: dict) -> str:
    if slug != 'godel-agent':
        return ''
    path = Path(__file__).resolve().parents[1] / 'papers/evidence/godel-agent.json'
    evidence = json.loads(path.read_text())
    table = evidence['main_table']
    rows = ''.join('<tr' + (' class="godel-result-focus"' if row['name'] == 'Gödel-base' else '') + '><th scope="row">' + escape(row['name']) + '</th>' + ''.join(f'<td><strong>{v["mean"]:.1f}</strong> <span>± {v["ci"]:.1f}</span></td>' for v in row['values']) + '</tr>' for row in table if row['name'] != 'Gödel-free')
    free = next(row for row in table if row['name'] == 'Gödel-free')
    free_values = ', '.join(f'{label} {value["mean"]:.1f} ± {value["ci"]:.1f}' for label, value in zip(['DROP F1', 'MGSM accuracy', 'MMLU accuracy', 'GPQA accuracy'], free['values']))
    ablations = ''.join(f'<li><span>{escape(row["name"])}</span><div class="godel-bar-track"><i style="width:{row["accuracy"]}%"></i></div><strong>{row["accuracy"]:.1f}%</strong></li>' for row in evidence['ablations'])
    return f'''<section class="godel-results" aria-labelledby="godel-results-title">
      <h3 id="godel-results-title">All four tasks, with uncertainty visible</h3>
      <p class="godel-reading">The largest gap over Meta Agent Search is on MGSM: <strong>+10.8 percentage points</strong>. DROP, MMLU and GPQA show smaller point-estimate gains, with overlapping confidence intervals for these three tasks. The table does not establish a decisive advantage on every task.</p>
      <p class="godel-table-caption" id="godel-table-caption">Table 1 · reported score ± 95% bootstrap confidence interval. DROP reports F1; the other columns report accuracy (%).</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Gödel Agent full benchmark comparison"><table aria-describedby="godel-table-caption"><thead><tr><th scope="col">Method</th><th scope="col">DROP</th><th scope="col">MGSM</th><th scope="col">MMLU</th><th scope="col">GPQA</th></tr></thead><tbody>{rows}</tbody></table></div>
      <p class="godel-source-note">On narrow screens, scroll the table to compare all tasks.</p>
      <div class="godel-protocol"><h4>How the comparison was run</h4><dl>
        <div><dt>Agent doing the optimization</dt><dd>GPT-4o-2024-05-13</dd></div>
        <div><dt>Constrained policies and baselines</dt><dd>GPT-3.5-turbo-0125; closed-book execution</dd></div>
        <div><dt>Search protocol</dt><dd>6 independent cycles per task; up to 30 iterations per cycle on validation data, then test evaluation</dd></div>
        <div><dt>Validation / test questions</dt><dd>128 / 800 for DROP, MGSM and MMLU; 32 / 166 for GPQA, with GPQA evaluated five times</dd></div>
      </dl></div>
      <details class="paper-details"><summary>What about the higher Gödel-free scores?</summary><div class="abstract-content"><p>{free_values}. This version may call stronger models, including GPT-4o, while solving tasks. Its scores measure unrestricted tool use and belong to a different comparison from Gödel-base.</p></div></details>
      <div class="godel-ablation"><h3>What makes continued improvement possible?</h3><p class="godel-reading">Removing error handling reduces MGSM accuracy from 64.2% to 49.4%. An agent that rewrites code needs a way to observe and recover from bad edits.</p><ul>{ablations}</ul><p class="godel-source-note">Table 2 and the full-system MGSM score from Table 1. Bars start at zero; no per-ablation confidence interval is supplied in Table 2.</p></div>
      <div class="godel-robustness"><h3>Self-improvement is not monotonic</h3><p>Across 100 MGSM optimization trials:</p><dl>
        <div><dt>92%</dt><dd>encountered a temporary performance drop</dd></div><div><dt>14%</dt><dd>finished below the initial policy</dd></div><div><dt>4%</dt><dd>terminated unexpectedly</dd></div>
      </dl><p class="godel-source-note">These are different, potentially overlapping events—not three parts of a whole. Editing the improvement procedure can also break the ability to continue improving.</p></div>
      <p class="godel-provenance"><a href="{PAPER}#S4.T1">Table 1 ↗</a> · <a href="{PAPER}#S6.T2">Table 2 ↗</a> · <a href="{PAPER}#S6.SS2">Robustness ↗</a> · <a href="{PAPER}#A2">Experimental protocol ↗</a></p>
    </section>'''
