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
- `paper-page.css`: shared typography, layout, diagrams, and responsive rules.
- `paper-page.js`: optional direction comparison and citation-copy behavior.
- `../scripts/build_papers.py`: one template for every paper.
- `assets/`: verified original figures stored locally; provenance is recorded in
  each entry's `figure_url`.

After editing content, regenerate the committed HTML:

```sh
python3 scripts/build_papers.py
python3 -m unittest discover -s tests -v
node --check papers/paper-page.js
git diff --check
```

`python3 scripts/build_papers.py --check` detects stale generated pages. Add a new
paper to both metadata and one reviewed content file. The generator rejects
duplicate content keys and missing page coverage.

## Content and visual rules

The reading path is a short takeaway, the research tension, an explanatory
figure or interactive example where useful, the actual mechanism, and evidence
with controls and limits. Pages should explain the design choices, not just
name the pipeline stages. There is no fixed 300-word target: the initial version
was too compressed. Keep literature-style repetition and long abstracts in
native disclosures, but keep the core argument visible.

`insights/<slug>.json` adds paper-specific motivation, method exposition, and
evidence interpretation. Each file records primary-source reading notes and
links to relevant sections. `scripts/paper_demo_*.py` render semantic initial
demo states; `demos/*.js` attach optional controls, and `demos/*.css` style only
their own widgets. No demo calls a remote model.

Gödel Agent uses a dedicated case study in `scripts/paper_demo_godel.py` and
`demos/godel.*`. Its Game of 24 solver executes locally with exact fractions;
the chosen card inputs and browser algorithm are explicitly adapted examples.
`evidence/godel-agent.json` records the full reported result table, confidence
intervals, ablations, experimental protocol, and case/figure provenance. The
original Figure 5 is a separate LLM-based run, not the search-based 100% case.
Atomic and EchoQA likewise use concrete source cases and separate measured
aggregate results from the behavior of a single worked example.

Each interaction must distinguish measured results, adapted paper examples,
and illustrative inputs. For example, the COrAL explorer plots all 40 reported
values at once, and the LEDOM examples reproduce published reverse-generation
outputs; the paper prints no per-candidate reverse scores, so none are shown.
ContraSolver's judgments and RERIC's retrieval distances are reader-controlled
illustrative inputs to the papers' actual algorithm and equation.

Every page except COrAL (exact values in its benchmark explorer), the NLG
evaluation survey, and Gödel Agent (dedicated evidence module) has one
`results_table` copied from a source table. Tables keep the paper's printed
values, including printed changes such as `30.31 ↑28.09`; the caption names the
table number, metric, direction, setting, and any omitted rows or columns that
change the reading (for example, a baseline that wins an omitted column).
`highlight` lists rows for the paper's own method (empty for benchmark and
analysis papers); `highlight_columns` emphasizes a derived column such as a
change. Numeric columns are detected and right-aligned at build time. The v4
tables were extracted and then verified cell by cell by independent readers;
`source_note` records each table's source location.

Use `primary_figure: true` for original figures that explain the method clearly.
Use a concise three-step conceptual diagram when the paper's figure is dense or
unavailable. Figures are clickable at full resolution. All primary figures
and the optional supplementary figures are locally hosted.

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

LEDOM's word-level illustration is explicitly labeled as an explanation, not
live inference. Its resource links lead to the actual released models.

## Demo standard

A demo earns its place only if the reader's input changes the output through
the paper's actual computation or measured/published data, and at least one
non-obvious outcome can be discovered. Next/Prev slideshows of pre-written
states and invented numbers that predetermine the lesson are not used. The
eyebrow of each demo names its evidence (for example `Measured · Table 4` or
`Algorithm 1 · illustrative judgments`), set by `demo.eyebrow` in the insight
file.

## Cross-links

`RESEARCH_THREADS` in `scripts/build_papers.py` assigns every paper to one
curated thread; each page ends with links to the rest of its thread. The build
fails if a paper is missing from, or repeated across, threads. Preprint venues
are normalized to `arXiv preprint YYYY`.

## Browser validation

Start a server from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
agent-browser --session papers open http://127.0.0.1:8765/papers/reverse-lm.html
agent-browser --session papers eval --stdin < tests/browser_papers.js
agent-browser --session papers eval --stdin < tests/browser_demos.js
for group in evaluation reasoning decoding knowledge; do
  agent-browser --session papers eval --stdin < tests/browser_demo_$group.js
done
```

The browser check exercises all 23 routes at 1440, 390, and 320 pixels, including
expanded figures, text overflow, citation links, copy success and failure, and
LEDOM's direction comparison. `tests/browser_demos.js` covers Gödel, Cont-COMET,
EchoQA and the script-free fallback of every page; each
`tests/browser_demo_<group>.js` recomputes its group's demos independently
(algorithm outputs, exact measured values, published text, keyboard behavior,
320px layout, no-script state). Also visually inspect representative pages; an
overflow check cannot judge diagram legibility.

## Design references

- [X-Tree](https://sitaocheng.github.io/xtree/): direct contribution, useful
  interactions, and evidence close to claims.
- [Nerfies](https://nerfies.github.io/): a short takeaway and visual explanation.
- [NeRF](https://www.matthewtancik.com/nerf): let the result demonstrate the idea.
- [Mip-NeRF 360](https://jonbarron.info/mipnerf360/): concise academic framing.

The implementation is original; these sites informed the information hierarchy.
