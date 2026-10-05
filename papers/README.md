# Research pages

These 23 pages share a restrained, light academic design. They are generated as
complete static HTML: no framework, external fonts, or client-side data fetching
is required. Existing paper URLs remain unchanged.

## Editing

- `content/metadata.json`: metadata captured before the redesign, including the
  original word counts and figure references. It is a migration baseline, not a
  verified source of research claims.
- `content/{reasoning,knowledge,evaluation,ledom}.json`: reviewed page content.
  `metadata_override` supersedes incorrect original authors, titles, abstracts,
  resource links, or citations. `source_url` and `source_note` document the
  evidence used for each page.
- `insights/<slug>.json`: motivation (`story`), method exposition
  (`mechanism`), evidence interpretation (`evidence`), primary-source reading
  notes, section links (`sources`), and the page's `demo` configuration.
- `evidence/godel-agent.json`: the full Gödel Agent result table, confidence
  intervals, ablations, protocol, and case/figure provenance.
- `paper-page.css`: shared typography, layout, diagrams, and responsive rules.
- `paper-page.js`: LEDOM's direction comparison and citation-copy behavior.
- `../scripts/build_papers.py`: one template for every paper.
- `../scripts/paper_demo_<group>.py` with `demos/<group>.{css,js}`: demo modules
  (see [Demo modules](#demo-modules)).
- `../scripts/godel_illustrations.py`: draws the Gödel robot strip.
- `assets/`: verified original figures and original illustrations stored
  locally; provenance is recorded in each entry's `figure_url`.

After editing content, regenerate the committed HTML and run the static checks:

```sh
python3 scripts/build_papers.py
python3 scripts/build_papers.py --check
python3 -m unittest discover -s tests -v
for file in papers/*.js papers/demos/*.js tests/*.js; do node --check "$file"; done
git diff --check
```

`--check` detects stale generated pages. Add a new paper to both metadata and one
reviewed content file. The generator rejects duplicate content keys, missing page
coverage, and invalid optional fields.

## Page order

Pages are result-first. The generator emits, in order:

1. Header: venue and topic, title, authors (with an optional affiliation
   legend), resource links, the takeaway, and the optional glance block.
2. Lead visual, directly under the header and before section 01: the primary
   figure (`primary_figure: true`), LEDOM's direction demo, or the three-step
   concept diagram (only on a page with no demo and no primary figure); then a
   module's `render_overview()` output (the Gödel robot strip) and any demo HTML
   for the `overview` slot. A page with none of these has no lead visual.
3. `01 / The research question`: story paragraphs, then the optional
   "Closest prior work" paragraph.
4. `Explore the idea`: present only when a demo fills the `explore` slot. No
   page uses it at present.
5. `Inside the method`: an inline figure (`figure_inline`), the mechanism prose
   with any method demo, the three-step list, and `render_method()` output.
6. `Reading the evidence`: the findings grid (omitted when `findings` is `[]`),
   any evidence demo, the evidence narrative, `render_evidence()` output, the
   results table, and the scope note.

Section labels are numbered from the sections actually present (01–03 without
Explore, 01–04 with it), and the header nav lists Explore only when the section
exists.

## Optional content fields

All fields are optional; pages without them render as before.

| Field (content JSON) | Type | Rendering |
| --- | --- | --- |
| `glance` | `{"result": str, "prior": str, "limitation": str}` | `<dl class="paper-glance">` after the takeaway, rows labelled Result, New vs prior, Limitation (in that order; missing keys are skipped, unknown keys fail the build). Keep each value to one short sentence so the lead visual stays on the first desktop screen. |
| `authors_detail` | `[{"name": str, "affiliations": [int], "equal": bool}]` | Replaces the metadata author string. Each name is followed by `<sup>` marks (`1,2`, plus `*` for equal contribution) with no whitespace; `Xunjian Yin` links to `../index.html` and must be listed. |
| `affiliations` | `[str]` | Legend under the author line: `¹ Peking University · ² …`, plus `* Equal contribution` when any author has `equal: true`. Indices in `authors_detail` are 1-based and checked. When every author has the same affiliation set and no one is marked equal, names carry no marks and the legend lists only the shared institutions, unnumbered (`Peking University`). |
| `prior_work` | `str` | One short paragraph at the end of section 01 under the h3 "Closest prior work". |
| `findings` | `[]` | An empty list omits the findings grid; an evidence demo then follows the section heading. |
| `remove_results_table` | `true` | Suppresses `results_table`, for pages whose evidence demo shows the same table. |
| `abstract_label` | `str` | See below. |

## Content and visual rules

The reading path is a short takeaway, a visual explanation, the research
tension, the actual mechanism with an interactive example where useful, and
evidence with controls and limits. Pages should explain the design choices, not
just name the pipeline stages. There is no fixed 300-word target: the initial
version was too compressed. Keep literature-style repetition and long abstracts
in native disclosures, but keep the core argument visible.

Each interaction must distinguish measured results, adapted paper examples,
and illustrative inputs. For example, the COrAL explorer plots all 40 reported
values at once, and the LEDOM examples reproduce published reverse-generation
outputs; the paper prints no per-candidate reverse scores, so none are shown.
ContraSolver's judgments, RERIC's retrieval distances, DAMON's judge scores, and
the Geometry of Reasoning trajectories are reader-controlled illustrative inputs
to the papers' actual algorithm, equation, or formulas.

Most pages have one `results_table` copied from a source table. COrAL and the
NLG evaluation survey have none (their evidence demos hold the values), Gödel
Agent uses its dedicated evidence module, and History Matters, the knowledge
boundary study, MC-MKE, LEDOM, and the self-generated-documents study set
`remove_results_table` because their evidence demos show the same values.
Tables keep the paper's printed values, including printed changes such as
`30.31 ↑28.09`; the caption names the table number, metric, direction, setting,
and any omitted rows or columns that change the reading (for example, a baseline
that wins an omitted column). `highlight` lists rows for the paper's own method
(empty for benchmark and analysis papers); `highlight_columns` emphasizes a
derived column such as a change. Numeric columns are detected and right-aligned
at build time. The v4 tables were extracted and then verified cell by cell by
independent readers; `source_note` records each table's source location.

Use `primary_figure: true` for original figures, or original lead illustrations
(`assets/*-lead.*`), that explain the method clearly; 19 pages have one. Use a
concise three-step conceptual diagram when the paper's figure is dense or
unavailable; it is shown only on pages without a demo. Figures are clickable at
full resolution and locally hosted.

Figure dimensions are read from PNG headers or SVG viewBox metadata at build
time. Rasters never exceed their intrinsic width; larger sources use a 2×
pixel-density target. Small sources stay near their native size rather than
being stretched across the page. `figure_inline: true` displays the original
figure directly at the start of Method, before the prose that explains it.
Figures wider than 2.4:1, or marked `figure_scroll: true` when dense, keep a
680px legible width on phones and scroll inside their frame. The dense Gödel
vector result plot uses the same kind of accessible horizontal scroller.

Set `abstract_label: "Read the abstract"` only when the text is a verified paper
abstract; otherwise use the default `Research summary`. Findings must identify
the relevant dataset, model, comparator, and caveat. Do not combine accuracy and
speed results obtained under different settings. Express absolute accuracy
changes in percentage points (`pp`).

LEDOM's word-level direction toggle is explicitly labeled as an explanation,
not live inference. Its resource links lead to the actual released models.

## Demo modules

Every `scripts/paper_demo_<group>.py` is discovered automatically ('godel'
first, then alphabetical); a new module needs no generator edits, only its
assets `demos/<group>.css` and `demos/<group>.js`, which the build requires and
links whenever the module renders anything for a page. A page asks for a demo
with a `demo` object in its insight file. For such a page the generator calls
`render_demo(slug, insight)` on every module; a module claims the page by
returning non-empty HTML, must return `''` for pages it does not own, and the
build fails if two modules claim one slug or none does. A file without
`render_demo` is ignored.

| Module | Pages (slot) |
| --- | --- |
| `godel` | godel-agent (overview hook, method + `render_method`, evidence + `render_evidence`) |
| `agents` | derl, chemagent (method) |
| `benchmarks` | alcuna (method); knowledge-boundary, self-generated-documents (evidence) |
| `decoding` | coral, reverse-lm (method and evidence) |
| `evaluation` | dsgram, context-aware-evaluation, error-robust-retrieval (method); seq2seq-data2text (method and evidence) |
| `flows` | geometry-of-reasoning (method) |
| `judges` | contextual-asr (method); themis, eama, nlg-evaluation-survey (evidence) |
| `knowledge` | knowledge-interplay (method); history-matters, mc-mke (method and evidence) |
| `reasoning` | contrasolver, atomic-to-composite (method and evidence) |
| `safety` | damon (method) |

### Interface

`render_demo` returns either:

- a string, placed according to the insight's `demo.placement`:
  `"explore"` (default; its own section), `"method"` (full width after the
  `demo.method_after`-th Method paragraph, before the remaining prose and the
  three-step list), `"evidence"` (after the findings grid, before the evidence
  narrative), or `"overview"` (in the lead visual); or
- a dict with any of the keys `overview`, `method`, `evidence`, `explore`,
  each mapping to HTML for that position; `demo.placement` is then ignored and
  empty values are skipped.

Method and evidence demos are wrapped in `<div class="section-demo method-demo">`
or `<div class="section-demo evidence-demo">`; the first child's top margin is
reset there and in `.lead-visual`. Optional hooks on the claiming module keep
their fixed positions: `render_overview` (lead visual, before an `overview`
slot), `render_method` (end of Method) and `render_evidence` (after the
evidence narrative, before the results table).

### Insight `demo` fields read by the generator or shared by modules

| Field | Meaning |
| --- | --- |
| `kind` or `type` | Selects the module's renderer (each module documents its values). |
| `placement` | Position of a string return, as above. |
| `method_after` | 1-based index of the mechanism paragraph a method demo follows (default 1). It must be an integer from 1 to the number of mechanism paragraphs, and is rejected when no demo fills the method slot. For example, COrAL's replay illustrates its decoding paragraph rather than the first, training paragraph. |
| `eyebrow` | The small label above the (first) demo, naming its evidence. |
| `evidence_eyebrow` | The label of the evidence-slot demo for modules that render two blocks (decoding: COrAL and LEDOM; evaluation: seq2seq-data2text). |

Modules also read their own fields (`title`, `description`, `caption`,
`provenance`, transcribed values); see each module's docstring.

## Demo standard

A demo earns its place only if the reader's input changes the output through
the paper's actual computation or measured/published data, and at least one
non-obvious outcome can be discovered. Next/Prev slideshows of pre-written
states and invented numbers that predetermine the lesson are not used. No demo
calls a remote model or the network.

**Provenance labels.** Every value or example is one of: **Measured** (printed
in a paper table or figure), **Published example** (text, tokens, or a recorded
case or released record printed or released by the authors), **Derived** or
**Computed** (arithmetic or the paper's own algorithm applied to published
values or to the reader's input), or **Illustrative** (an input, ordering, or
display choice made for this page). The eyebrow names the kind and the source
location, for example `Measured · Table 4`, `Published example · Figure 2, step
by step`, or `Algorithm 1 · illustrative judgments`.

**Complete without JavaScript.** Each module renders a complete, readable state
in Python: the default inputs with the algorithm's real output, or the final
step of a replay. Controls are hidden until `demos/<group>.js` runs, which
reveals them and recomputes the same quantities in the browser.

**Animation.** Motion exists only to show a mechanism step by step:

- It starts only from a reader action: Play (which becomes Pause while running),
  Step, and Reset back to the first step. Nothing autoplays or moves on load,
  and there is no decorative motion.
- Changes are discrete steps or short color, opacity, or position transitions
  (at most about 600 ms).
- Under `prefers-reduced-motion: reduce` transitions are removed and every
  state change is immediate; Play advances by discrete steps (in some modules
  one step per press), and Step and Reset behave as usual.
- The no-script state is complete and readable (the completed replay, or the
  default inputs with their computed outputs), never a blank first frame.

Replays exist on ALCUNA, Atomic, ChemAgent, ContraSolver, COrAL, DAMON, DERL,
Geometry of Reasoning, Gödel Agent, History Matters, MC-MKE, LEDOM, and the
contextual ASR datastore walk-through. The evaluation demos have no motion.

### Gödel Agent

Gödel Agent uses a dedicated case study in `scripts/paper_demo_godel.py` and
`demos/godel.*`:

- Overview: the six-panel robot strip (`assets/godel-robot-*.svg`), an original
  illustration drawn by `scripts/godel_illustrations.py`. Body parts stand for
  program parts (glasses read feedback, arms solve tasks, the wrench hand edits
  the agent), and the score gauge is schematic. Rerun the script after editing it.
- Method: the original Figure 3 (`figure_inline`), the first mechanism
  paragraph, and an illustrative replay of one loop through the agent's runtime
  memory (Algorithm 1: inspect its implementation, modify running code, evaluate
  and iterate); after the remaining prose, `render_method` adds the condensed
  Listings 5 and 6 and a Game of 24 search that executes locally with exact
  fractions (the card inputs and browser algorithm are explicitly adapted
  examples).
- Evidence: after the findings, the original Figure 5 (evidence slot), a
  separate LLM-based run rather than the search-based 100% case; then
  `render_evidence` adds the full Table 1 with confidence intervals, the
  protocol, the ablations, and the robustness counts from
  `evidence/godel-agent.json`.

Atomic and EchoQA likewise use concrete source cases and separate measured
aggregate results from the behavior of a single worked example.

## Cross-links

`RESEARCH_THREADS` in `scripts/build_papers.py` assigns every paper to one
curated thread (agents and reasoning; language modeling and decoding; knowledge;
evaluation and red-teaming, which includes DAMON; retrieval and multimodal
generation); each page ends with links to the rest of its thread. The build
fails if a paper is missing from, or repeated across, threads. Preprint venues
are normalized to `arXiv preprint YYYY`.

## Browser validation

Start a server from the repository root, then run every suite. Start a fresh
`agent-browser` session after editing CSS: a reused session can serve a cached
stylesheet.

```sh
python3 -m http.server 8765 --bind 127.0.0.1
agent-browser --session papers close
agent-browser --session papers open http://127.0.0.1:8765/papers/reverse-lm.html
agent-browser --session papers eval --stdin < tests/browser_papers.js
agent-browser --session papers eval --stdin < tests/browser_demos.js
for group in evaluation reasoning decoding knowledge benchmarks judges agents flows_safety; do
  agent-browser --session papers eval --stdin < tests/browser_demo_$group.js
done
agent-browser --session papers close
```

- `tests/browser_papers.js` exercises all 23 routes at 1440, 390, and 320
  pixels: expanded figures, text overflow, citation links, copy success and
  failure, LEDOM's direction comparison, and a lead visual that precedes
  section 01 and starts within the first 900px at 1440 pixels.
- `tests/browser_demos.js` covers Gödel, Cont-COMET, EchoQA, and the
  script-free fallback of every page.
- Each `tests/browser_demo_<group>.js` recomputes its demos independently:
  algorithm outputs, exact measured values, published text, replay controls,
  keyboard behavior, 320px layout, and the no-script state. `flows_safety`
  covers Geometry of Reasoning and DAMON.
- Run `browser_demo_agents.js` and `browser_demo_reasoning.js` once more after
  `agent-browser --session papers set media light reduced-motion`; their motion
  checks switch to the reduced-motion expectations.

Also visually inspect representative pages; an overflow check cannot judge
diagram legibility.

## Design references

- [X-Tree](https://sitaocheng.github.io/xtree/): direct contribution, useful
  interactions, and evidence close to claims.
- [Nerfies](https://nerfies.github.io/): a short takeaway and visual explanation.
- [NeRF](https://www.matthewtancik.com/nerf): let the result demonstrate the idea.
- [Mip-NeRF 360](https://jonbarron.info/mipnerf360/): concise academic framing.

The implementation is original; these sites informed the information hierarchy.
