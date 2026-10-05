"""Gödel Agent: the self-referential loop, a concrete executable case, and source-grounded evidence."""
from __future__ import annotations

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


# ---------------------------------------------------------------------------
# Runtime loop: the four actions of Section 3 acting on agent_module (Figure 3).
# The states are illustrative; the two edits are changes reported in Section 6.3.
# ---------------------------------------------------------------------------

# Function objects that can exist in agent_module during the loop.
OBJECTS = {
    'solver': (('solver_v0', 'solver v0', 'asks the LLM'),
               ('solver_v1', 'solver v1', '+ checks with code')),
    'self_improve': (('self_improve_v0', 'self_improve v0', 'keeps error messages'),
                     ('self_improve_v1', 'self_improve v1', '+ keeps tracebacks')),
}
# One frame per executed action. "marks" highlights a binding: read, call, write or error.
FRAMES = [
    {'key': 'start', 'chip': 'Start', 'action': 'start', 'tool': '',
     'bound': {'solver': 'solver_v0', 'self_improve': 'self_improve_v0'}, 'marks': {},
     'stack': [('self_improve_v0', 'iteration 1')],
     'code': [('note', '# supplied by the designer: π₀ and I₀'),
              ('', 'agent_module.solver = solver'),
              ('', 'agent_module.self_improve = self_improve'),
              ('', 'self_improve(E, solver, s, r, goal)')],
     'feedback': 'none yet',
     'status': 'Start: the designer supplies the initial policy (solver) and learning algorithm (self_improve), '
               'both ordinary functions in the running process.'},
    {'key': 'inspect', 'chip': 'self_inspect', 'action': 'self_inspect', 'tool': '',
     'marks': {'solver': 'read', 'self_improve': 'read'},
     'code': [('', 's = self_inspect()'),
              ('note', '# solver: answer = llm(prompt(task))'),
              ('note', '# self_improve: run decide(s, r, goal)')],
     'status': 'self_inspect: the agent reads the current code of solver and of self_improve, '
               'the function executing this step.'},
    {'key': 'interact', 'chip': 'interact', 'action': 'interact', 'tool': 'action_evaluate_on_task',
     'marks': {'solver': 'call'},
     'code': [('', 'r = U(E, solver)'), ('note', '# runs solver v0 on the validation tasks')],
     'feedback': 'validation score and low-scoring cases of solver v0',
     'status': 'interact: the utility function runs solver on validation tasks; the score and failing cases become the feedback r.'},
    {'key': 'update', 'chip': 'self_update', 'action': 'self_update', 'tool': 'action_adjust_logic',
     'bound': {'solver': 'solver_v1'}, 'marks': {'solver': 'write'},
     'code': [('', ' def solver(agent, task):'), ('', '   answer = llm(prompt(task))'),
              ('add', '+  if not check_with_code(answer, task):'),
              ('add', '+    answer = llm(prompt(task, retry=True))'),
              ('', '   return answer'), ('note', '# monkey patch: rebind the name'),
              ('', 'agent_module.solver = solver')],
     'status': 'self_update: an LLM writes a new solver and the agent rebinds the name to it without restarting. '
               'Every later call runs v1.'},
    {'key': 'error', 'chip': 'self_update ✗', 'action': 'self_update', 'tool': 'action_adjust_logic',
     'marks': {'solver': 'error'},
     'code': [('bad', '+def solver(agent, task)'), ('bad', '+  ...'), ('err', "SyntaxError: expected ':'")],
     'feedback': "SyntaxError: expected ':'",
     'status': 'self_update fails: the new code does not compile. Error handling halts this action sequence instead of '
               'ending the run and carries the error forward. Nothing was rebound: solver still runs v1.'},
    {'key': 'recurse', 'chip': 'continue_improve', 'action': 'continue_improve', 'tool': '',
     'marks': {'self_improve': 'call'}, 'push': ('self_improve_v0', 'iteration 2'),
     'code': [('', 'self_improve(E, solver, s, r, goal)'), ('note', '# looks up the current binding: v0')],
     'status': 'continue_improve: self_improve calls itself. The lookup still finds v0, so iteration 2 runs the same '
               'improvement code, with the error in its input.'},
    {'key': 'meta', 'chip': 'self_update', 'action': 'self_update', 'tool': 'action_adjust_logic',
     'bound': {'self_improve': 'self_improve_v1'}, 'marks': {'self_improve': 'write'},
     'code': [('', ' except Exception as error:'), ('del', '-  feedback.append(str(error))'),
              ('add', '+  feedback.append(traceback.format_exc())'),
              ('', 'agent_module.self_improve = self_improve')],
     'status': 'self_update on the improver itself: self_improve now points to a version that records full tracebacks. '
               'The two frames already running keep executing v0; only new calls enter v1.'},
    {'key': 'next', 'chip': 'continue_improve', 'action': 'continue_improve', 'tool': '',
     'marks': {'self_improve': 'call'}, 'push': ('self_improve_v1', 'iteration 3'),
     'code': [('', 'self_improve(E, solver, s, r, goal)'), ('note', '# finds self_improve v1')],
     'feedback': "SyntaxError: expected ':' · later errors arrive with the full traceback",
     'status': 'continue_improve: the next call enters self_improve v1, so the procedure that proposes edits has changed. '
               'Such edits are the risky ones: the 4% of 100 MGSM trials that ended unexpectedly typically followed '
               'changes to this module (§6.2).'},
]


def loop_frames() -> list[dict]:
    """Expand each frame to its full state: bindings, created objects, call stack and feedback."""
    frames, bound, stack, feedback, created = [], {}, [], '', set()
    for number, spec in enumerate(FRAMES):
        bound = bound | spec.get('bound', {})
        created |= set(bound.values())
        stack = stack + [spec['push']] if 'push' in spec else list(spec.get('stack', stack))
        feedback = spec.get('feedback', feedback)
        frames.append({'key': spec['key'], 'chip': spec['chip'], 'label': f'Step {number}: {spec["chip"]}' if number else 'Start',
                       'action': spec['action'], 'tool': spec['tool'], 'bound': dict(bound), 'created': sorted(created),
                       'marks': spec['marks'], 'stack': [list(frame) for frame in stack], 'code': [list(line) for line in spec['code']],
                       'feedback': feedback, 'status': spec['status']})
    return frames


def _loop_state(frame: dict) -> str:
    """Server-rendered state of one frame; decoding of later frames happens in godel.js."""
    bindings = []
    for name, objects in OBJECTS.items():
        slot = next(i for i, (key, _, _) in enumerate(objects) if key == frame['bound'][name])
        items = ''.join(
            f'<li data-gd-object="{key}" class="{"is-bound" if key == frame["bound"][name] else "is-unbound"}"'
            f'{"" if key in frame["created"] else " data-absent"}><code>{escape(label)}</code><span>{escape(note)}</span></li>'
            for key, label, note in objects)
        mark = frame['marks'].get(name, '')
        bindings.append(f'<div class="gd-binding" data-gd-binding="{name}" data-mark="{mark}"><code class="gd-name">{name}</code>'
                        f'<div class="gd-slots" style="--gd-slot:{slot}"><span class="gd-pointer" aria-hidden="true"></span>'
                        f'<ol aria-label="Function objects for {name}">{items}</ol></div></div>')
    stack = ''.join(f'<li><code>{escape(fn.replace("_v", " v"))}</code><span>{escape(note)}</span></li>' for fn, note in reversed(frame['stack']))
    code = ''.join(f'<span class="gd-line{" is-" + cls if cls else ""}">{escape(text)}</span>' for cls, text in frame['code'])
    tool = f' <span class="gd-tool" data-gd-tool>implementation: {escape(frame["tool"])}</span>' if frame['tool'] else ' <span class="gd-tool" data-gd-tool></span>'
    return f'''<div class="gd-panel gd-memory"><p class="gd-panel-title">Runtime memory · agent_module</p>
        {"".join(bindings)}
        <div class="gd-stack"><p class="gd-panel-title">Call stack <span>newest first</span></p><ol data-gd-stack>{stack}</ol></div></div>
      <div class="gd-panel gd-action"><p class="gd-panel-title">Action <code class="gd-action-name" data-gd-action>{escape(frame["action"])}</code>{tool}</p>
        <pre class="gd-code" data-gd-code>{code}</pre>
        <p class="gd-feedback"><span>Feedback carried forward</span> <span data-gd-feedback>{escape(frame["feedback"])}</span></p></div>'''


def loop_demo(eyebrow: str, title: str) -> str:
    frames = loop_frames()
    final = frames[-1]
    chips = ''.join(f'<button type="button" data-demo-action="gd-goto" data-frame="{i}" aria-label="{escape(f["label"])}" aria-pressed="{str(i == len(frames) - 1).lower()}">{escape(f["chip"])}</button>'
                    for i, f in enumerate(frames))
    trace = ''.join(f'<li>{escape(f["status"])}</li>' for f in frames)
    data = json.dumps({'frames': frames, 'objects': OBJECTS}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return f'''<div class="paper-demo gd-loop" data-paper-demo="godel-runtime">
  <header class="demo-heading"><span class="demo-tag">{escape(eyebrow)}</span><h3>{escape(title)}</h3>
    <p>Step through the four actions of Algorithm 1: which function each name is bound to, how self_improve recurses, and what feedback is carried forward.</p></header>
  <div class="demo-controls gd-controls" data-gd-controls hidden>
    <div class="demo-options gd-transport" role="group" aria-label="Replay"><button type="button" data-demo-action="gd-play" aria-pressed="false">Play</button><button type="button" data-demo-action="gd-step">Step</button><button type="button" data-demo-action="gd-reset">Reset</button></div>
    <div class="demo-options gd-chips" role="group" aria-label="Executed action">{chips}</div>
  </div>
  <div class="gd-stage" data-demo-state>{_loop_state(final)}</div>
  <p class="gd-status" data-gd-status role="status" aria-live="polite">{escape(final["status"])}</p>
  <ol class="gd-trace" data-gd-trace>{trace}</ol>
  <p class="godel-provenance">Illustrative state, not a recorded run. Actions: <a href="{PAPER}#alg1">Algorithm 1</a>, §3; tools: goal prompt, <a href="{PAPER}#A1">Appendix A</a>; rebinding: <a href="{PAPER}#S4.F3">Figure 3</a>; error handling: <a href="{PAPER}#S4.SS2">§4.2</a>. The two edits are condensed pseudocode for changes reported in <a href="{PAPER}#S6.SS3">§6.3</a>.</p>
  <script type="application/json" data-gd-data>{data}</script>
</div>'''


def render_demo(slug: str, insight: dict) -> dict[str, str] | str:
    if slug != 'godel-agent':
        return ''
    demo = insight.get('demo', {})
    return {'method': loop_demo(demo.get('eyebrow', 'Illustrative runtime state · Algorithm 1, Figure 3'),
                                demo.get('title', 'One loop through the agent’s own runtime memory')),
            'evidence': observed_run()}


def observed_run() -> str:
    return f'''<section class="godel-observed-run" aria-labelledby="godel-run-title">
  <div class="section-heading"><span class="demo-tag">Recorded run · Figure 5</span><h3 id="godel-run-title">An LLM-based run: gains, failures, reverts</h3></div>
  <p class="godel-reading">In this Game of 24 run, code-assisted verification and retrying with more data gave the largest gains; other edits failed or were reverted. The switch to search above is a different run.</p>
  <figure class="godel-paper-figure">
    <div class="godel-figure-scroll" tabindex="0" role="region" aria-label="Original Game of 24 charts; scroll horizontally on narrow screens"><a href="assets/godel-game24.svg" target="_blank" rel="noopener" aria-label="Open Figure 5 at full size"><img src="assets/godel-game24.svg" width="1615" height="501" alt="Paper Figure 5: a nonmonotonic LLM-based Game of 24 optimization trajectory and a comparison of different initial policies." loading="lazy"></a></div>
    <figcaption>Figure 5. Left: changes during an LLM-based run. Right: trajectories from different initial policies. Original vector figure; <a href="assets/godel-game24.svg" target="_blank" rel="noopener">open full size ↗</a> · <a href="{PAPER}#S6.F5">source ↗</a></figcaption>
  </figure>
</section>'''


def render_method(slug: str, insight: dict) -> str:
    """The Game of 24 case closes the Method section: published code, then a runnable search."""
    if slug != 'godel-agent':
        return ''
    return f'''
<div class="godel-case" data-paper-demo="godel-search">
  <header class="godel-case-heading"><span class="demo-tag">Case study · Game of 24, Listings 5–6</span>
    <h3>From asking for an expression to searching for one</h3>
    <p>Make 24 from four numbers, each used once, with +, −, ×, ÷ and parentheses. In one reported run, after six failed optimization attempts, the agent replaced its LLM-based solver with search (§6.3).</p>
  </header>
  <div class="godel-code-comparison">
    <section><div class="godel-code-title"><h4>Initial policy</h4><a href="{PAPER}#LST5">Listing 5 ↗</a></div>
      <pre><code>def solver(numbers):
    prompt = describe_game(numbers)
    response = call_language_model(prompt)
    return response</code></pre>
      <p>The LLM proposes the expression; nothing checks that it follows the rules.</p></section>
    <section><div class="godel-code-title"><h4>Rewritten policy</h4><a href="{PAPER}#LST6">Listing 6 ↗</a></div>
      <pre><code>def search(values):
    if one_value_remains(values):
        return equals_24(values[0])
    for a, b, operation in choices(values):
        reduced = apply(a, b, operation)
        if search(reduced):
            return solution</code></pre>
      <p>Code tries combinations of numbers and operations; no LLM call is needed.</p></section>
  </div>
  <div class="godel-workbench">
    <div class="godel-workbench-title"><h4>Run the search on four numbers</h4><span>Local computation</span></div>
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
  <p class="godel-provenance">Condensed pseudocode of Listings 5–6. The workbench runs a browser adaptation of the Listing 6 search (exact fractions, cached failed states) on inputs chosen for this page, not the agent. §6.3 reports 100% accuracy for the search-based case.</p>
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
      <p class="godel-reading">Against Meta Agent Search the MGSM gap is +10.8 percentage points; on DROP, MMLU and GPQA the confidence intervals overlap.</p>
      <p class="godel-table-caption" id="godel-table-caption">Table 1 · reported score ± 95% bootstrap confidence interval. DROP reports F1; the other columns report accuracy (%).</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Gödel Agent full benchmark comparison"><table aria-describedby="godel-table-caption"><thead><tr><th scope="col">Method</th><th scope="col">DROP</th><th scope="col">MGSM</th><th scope="col">MMLU</th><th scope="col">GPQA</th></tr></thead><tbody>{rows}</tbody></table></div>
      <div class="godel-protocol"><h4>How the comparison was run</h4><dl>
        <div><dt>Agent doing the optimization</dt><dd>GPT-4o-2024-05-13</dd></div>
        <div><dt>Constrained policies and baselines</dt><dd>GPT-3.5-turbo-0125; closed-book execution</dd></div>
        <div><dt>Search protocol</dt><dd>6 independent cycles per task; up to 30 iterations per cycle on validation data, then test evaluation</dd></div>
        <div><dt>Validation / test questions</dt><dd>128 / 800 for DROP, MGSM and MMLU; 32 / 166 for GPQA, with GPQA evaluated five times</dd></div>
      </dl></div>
      <details class="paper-details"><summary>What about the higher Gödel-free scores?</summary><div class="abstract-content"><p>{free_values}. This version may call stronger models, including GPT-4o, while solving tasks. Its scores measure unrestricted tool use and belong to a different comparison from Gödel-base.</p></div></details>
      <div class="godel-pair"><div class="godel-ablation"><h3>What makes continued improvement possible?</h3><p class="godel-reading">An agent that rewrites its own code needs a way to observe and recover from bad edits. Removing thinking before acting costs almost as much.</p><ul>{ablations}</ul><p class="godel-source-note">Table 2 and the full-system MGSM score from Table 1. Bars start at zero; no per-ablation confidence interval is supplied in Table 2.</p></div>
      <div class="godel-robustness"><h3>Self-improvement is not monotonic</h3><p>Across 100 MGSM optimization trials:</p><dl>
        <div><dt>92%</dt><dd>encountered a temporary performance drop</dd></div><div><dt>14%</dt><dd>finished below the initial policy</dd></div><div><dt>4%</dt><dd>terminated unexpectedly</dd></div>
      </dl><p class="godel-source-note">These are different, potentially overlapping events—not three parts of a whole. Editing the improvement procedure can also break the ability to continue improving.</p></div></div>
      <p class="godel-provenance"><a href="{PAPER}#S4.T1">Table 1 ↗</a> · <a href="{PAPER}#S6.T2">Table 2 ↗</a> · <a href="{PAPER}#S6.SS2">Robustness ↗</a> · <a href="{PAPER}#A2">Experimental protocol ↗</a></p>
    </section>'''
