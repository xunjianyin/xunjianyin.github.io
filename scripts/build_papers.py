#!/usr/bin/env python3
"""Build static research pages: python3 scripts/build_papers.py [--check]."""
from __future__ import annotations
import argparse
from html import escape
import json
import importlib
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PAPERS = ROOT / "papers"

# Curated research threads for cross-links between pages. Order matters:
# neighbours in a thread are the most closely related papers.
RESEARCH_THREADS: dict[str, list[str]] = {
    "Agents, self-improvement, and reasoning": [
        "godel-agent", "derl", "chemagent", "contrasolver", "atomic-to-composite", "geometry-of-reasoning"],
    "Language modeling and decoding": ["reverse-lm", "coral", "damon"],
    "Knowledge in language models": [
        "knowledge-boundary", "alcuna", "knowledge-interplay", "history-matters", "mc-mke", "self-generated-documents"],
    "Evaluating generated text": [
        "themis", "nlg-evaluation-survey", "dsgram", "context-aware-evaluation", "seq2seq-data2text"],
    "Retrieval and multimodal generation": ["error-robust-retrieval", "contextual-asr", "eama"],
}
# Figures wider than this aspect ratio keep a legible minimum width on phones.
WIDE_FIGURE_RATIO = 2.4
# Numbers, optionally signed, with a unit, a ± interval, or a significance mark.
NUMERIC_CELL = re.compile(r'^[−+\-]?\s?\d[\d,.]*\s?(%|pp|x|×)?(\s?±\s?\d[\d.]*)?[*†‡]*(\s[↑↓][\d.]+)?$|^[−\-–—/]$')
# A change printed next to a value in the source table, e.g. "30.31 ↑28.09".
PRINTED_CHANGE = re.compile(r'^(.*\S)\s([↑↓][\d.]+)$')

def normalize_venue(venue: str) -> str:
    """Use one spelling for preprints, e.g. 'ArXiv Preprint 2025' -> 'arXiv preprint 2025'."""
    match = re.fullmatch(r'arxiv(?:\s+preprint)?\s+(\d{4})', venue.strip(), flags=re.I)
    return f'arXiv preprint {match.group(1)}' if match else venue.strip()

def paragraphs(section: dict[str, Any]) -> str:
    return ''.join(f'<p>{e(p)}</p>' for p in section.get('paragraphs', []))

def paper_demo(slug: str, insight: dict[str, Any]) -> tuple[str, str]:
    if not insight.get('demo'):
        return '', ''
    for group in ('godel', 'decoding', 'reasoning', 'knowledge', 'evaluation'):
        module_path = ROOT / 'scripts' / f'paper_demo_{group}.py'
        if not module_path.exists():
            continue
        module = importlib.import_module(f'paper_demo_{group}')
        html = module.render_demo(slug, insight)
        if html:
            for suffix in ('css', 'js'):
                if not (PAPERS / 'demos' / f'{group}.{suffix}').is_file():
                    raise ValueError(f'Missing demo asset for {slug}: {group}.{suffix}')
            return html, group
    raise ValueError(f'No renderer for the requested demo: {slug}')

def e(value: Any) -> str:
    return escape(str(value), quote=True)

def diagram_html(slug: str, item: dict[str, Any]) -> str:
    if item.get("primary_figure"):
        return source_figure(slug, item, primary=True)
    if slug == "reverse-lm":
        return '''<div class="direction-demo" data-direction-demo>
  <div class="demo-toolbar"><span class="demo-label">One sentence. Two directions.</span>
    <div class="direction-controls" role="group" aria-label="Generation direction" hidden>
      <button type="button" data-direction="forward" aria-pressed="false">Forward →</button>
      <button type="button" data-direction="reverse" aria-pressed="true">← Reverse</button>
    </div></div>
  <div class="token-sequence" aria-label="Reverse generation predicts earlier words from later context">
    <span class="token predicted">The</span><span class="token predicted">capital</span><span class="token predicted">of</span>
    <span class="token known">France</span><span class="token known">is</span><span class="token known">Paris.</span>
  </div>
  <div class="direction-explanation" aria-live="polite"><p class="direction-formula">P(earlier text | later text)</p>
    <p class="direction-description">Given the ending, predict what comes before it.</p></div>
  <div class="demo-key"><span><i class="key-known"></i>Given context</span><span><i class="key-predicted"></i>Text to predict</span></div>
  <p class="demo-caption">Illustrative word-level example. LEDOM reverses tokens during training; this is not a live model output.</p>
</div>'''
    diagram = item["diagram"]
    steps = ''.join(f'<li><span class="diagram-index">0{i+1}</span><h3>{e(s["label"])}</h3><p>{e(s["text"])}</p></li>' for i, s in enumerate(diagram["steps"]))
    return f'<figure class="concept-diagram"><ol class="diagram-flow">{steps}</ol><figcaption>{e(diagram["caption"])}</figcaption></figure>'

def source_figure(slug: str, item: dict[str, Any], primary: bool = False) -> str:
    # Only verified local assets are included, never guessed remote image URLs.
    asset = item.get("figure_local")
    if not asset:
        return ""
    if item.get("primary_figure") and not primary:
        return ""
    asset_path = PAPERS / asset
    if not asset_path.is_file():
        raise ValueError(f"Missing figure for {slug}: {asset}")
    if asset_path.suffix.lower() == '.png':
        with asset_path.open('rb') as stream:
            header = stream.read(24)
        if header[:8] != b'\x89PNG\r\n\x1a\n' or header[12:16] != b'IHDR':
            raise ValueError(f"Invalid PNG figure for {slug}: {asset}")
        width = int.from_bytes(header[16:20], 'big')
        height = int.from_bytes(header[20:24], 'big')
        # Keep small originals legible without upscaling; larger images target
        # two source pixels per CSS pixel for high-density displays.
        display_width = max(width / 2, min(width, 640))
        size_style = f' style="--figure-max-width:{display_width:g}px"'
    elif asset_path.suffix.lower() == '.svg':
        from xml.etree import ElementTree
        svg = ElementTree.parse(asset_path).getroot()
        view_box = svg.get('viewBox', '').split()
        if len(view_box) != 4:
            raise ValueError(f"SVG figure needs a viewBox for {slug}: {asset}")
        width, height = (round(float(value)) for value in view_box[2:])
        size_style = ''  # Vector figures remain sharp at the available width.
    else:
        raise ValueError(f"Unsupported figure format for {slug}: {asset}")
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid figure dimensions for {slug}: {asset}")
    caption = item.get("figure_caption", "Overview from the paper.")
    image = f'''<a href="{e(asset)}" target="_blank" rel="noopener" aria-label="Open figure at full size">
    <img src="{e(asset)}" alt="{e(caption)}" width="{width}" height="{height}" loading="{'eager' if primary else 'lazy'}" decoding="async"></a>'''
    classes = 'source-figure' + (' primary-figure' if primary else '')
    scroll_hint = ''
    if width / height > WIDE_FIGURE_RATIO or item.get('figure_scroll'):
        # Wide, dense figures become unreadable when shrunk to phone width;
        # keep a minimum width and let the figure scroll inside its frame.
        classes += ' wide-figure'
        size_style = size_style[:-1] + f';--figure-min-width:{min(width, 680)}px"' if size_style else f' style="--figure-min-width:{min(width, 680)}px"'
        image = f'<div class="figure-scroll" tabindex="0" role="region" aria-label="Figure; scroll horizontally on narrow screens">{image}</div>'
        scroll_hint = '<span class="figure-scroll-hint">Scroll sideways to read the figure. </span>'
    figure = f'''<figure class="{classes}"{size_style}>{image}
    <figcaption>{scroll_hint}{e(caption)} <a href="{e(asset)}" target="_blank" rel="noopener">Full size ↗</a></figcaption></figure>'''
    if primary or item.get('figure_inline'):
        return figure
    return f'<details class="paper-details figure-details"><summary>View the paper’s figure</summary>{figure}</details>'

def results_table(item: dict[str, Any]) -> str:
    table = item.get("results_table")
    if not table:
        return ""
    width = len(table["headings"])
    if any(len(row) != width for row in table["rows"]):
        raise ValueError(f"Results table rows must match headings: {table['caption'][:40]}")
    # Right-align columns whose every value is a number, so digits line up.
    numeric = [i > 0 and all(NUMERIC_CELL.match(row[i].strip()) for row in table["rows"]) for i in range(width)]
    emphasis = set(table.get("highlight_columns", []))
    def cell_class(i: int) -> str:
        names = (['num'] if numeric[i] else []) + (['is-emphasis'] if i in emphasis else [])
        return f' class="{" ".join(names)}"' if names else ''
    def cell(value: str) -> str:
        change = PRINTED_CHANGE.match(value)
        return f'{e(change.group(1))} <span class="printed-change">{e(change.group(2))}</span>' if change else e(value)
    headings = ''.join(f'<th scope="col"{cell_class(i)}>{e(h)}</th>' for i, h in enumerate(table["headings"]))
    highlight = set(table.get("highlight", []))
    row_class = ' class="is-highlight"'
    rows = ''.join(
        f'<tr{row_class if r in highlight else ""}>'
        + ''.join(f'<th scope="row">{e(c)}</th>' if i == 0 else f'<td{cell_class(i)}>{cell(c)}</td>' for i, c in enumerate(row))
        + '</tr>' for r, row in enumerate(table["rows"]))
    source = f' <a href="{e(table["source_url"])}">Source ↗</a>' if table.get("source_url") else ''
    key = '<p class="table-key"><i aria-hidden="true"></i>Method proposed in the paper</p>' if highlight else ''
    return (f'<div class="results-block"><p class="table-caption" id="results-caption">{e(table["caption"])}{source}</p>'
            f'<div class="table-scroll" tabindex="0" role="region" aria-label="Selected experimental results">'
            f'<table class="results-table" aria-describedby="results-caption"><thead><tr>{headings}</tr></thead><tbody>{rows}</tbody></table></div>{key}</div>')

def related_research(slug: str, metadata: dict[str, Any], content: dict[str, Any]) -> str:
    """List the other papers in this page's research thread."""
    thread = next(((name, slugs) for name, slugs in RESEARCH_THREADS.items() if slug in slugs), None)
    if thread is None:
        return ''
    name, slugs = thread
    items = []
    for other in slugs:
        if other == slug or other not in content:
            continue
        meta = metadata[other] | content[other].get("metadata_override", {})
        short, title = content[other]["short_name"], meta["title"]
        # Avoid repeating the short name when the title already begins with it.
        if title.startswith(short + ":"):
            title = title[len(short) + 1:].strip()
        items.append(f'<li><a href="{e(other)}.html"><span class="related-name">{e(short)}</span>'
                     f'<span class="related-title">{e(title)}</span></a>'
                     f'<span class="related-venue">{e(normalize_venue(meta["venue"]))}</span></li>')
    if not items:
        return ''
    return (f'<nav class="related-research" aria-labelledby="related-title"><h2 id="related-title">Related research</h2>'
            f'<p class="related-thread">{e(name)}</p><ul>{"".join(items)}</ul></nav>')

def render(slug: str, meta: dict[str, Any], item: dict[str, Any], insight: dict[str, Any], related: str = '') -> str:
    meta = meta | item.get("metadata_override", {})
    meta["venue"] = normalize_venue(meta["venue"])
    title, short = meta["title"], item["short_name"]
    title_html = e(title)
    if title.startswith(short + ":"):
        title_html = f'<span class="title-name">{e(short)}:</span>' + e(title[len(short)+1:])
    authors = e(meta["authors"].replace(" ,", ",")).replace("Xunjian Yin", '<a href="../index.html">Xunjian Yin</a>')
    links = ''.join(f'<a class="resource-link{" primary" if i == 0 else ""}" href="{e(l["url"])}">{e(l["label"])} <span aria-hidden="true">↗</span></a>' for i,l in enumerate(meta["links"]))
    findings = ''.join(f'<li><p class="finding-value">{e(f["value"])}</p><h3>{e(f["label"])}</h3><p>{e(f["detail"])}</p></li>' for f in item["findings"])
    methods = ''.join(f'<li><span class="method-index">0{i+1}</span><div><h3>{e(m["title"])}</h3><p>{e(m["text"])}</p></div></li>' for i,m in enumerate(item["method"]))
    image_url = "https://xunjianyin.github.io/" + ("papers/" + item["figure_local"] if item.get("figure_local") else "figures/logo.png")
    abstract_label = item.get("abstract_label", "Research summary")
    demo, demo_group = paper_demo(slug, insight)
    # Specialized case studies can add source-based material at the relevant section.
    extra_overview, extra_method, extra_evidence = '', '', ''
    if demo_group:
        module = importlib.import_module(f'paper_demo_{demo_group}')
        if hasattr(module, 'render_method'):
            extra_method = module.render_method(slug, insight)
        if hasattr(module, 'render_overview'):
            extra_overview = module.render_overview(slug, insight)
        if hasattr(module, 'render_evidence'):
            extra_evidence = module.render_evidence(slug, insight)
    demo_assets = (f'<link rel="stylesheet" href="demos/{demo_group}.css">\n  '
                   f'<script src="demos/{demo_group}.js" defer></script>') if demo else ''
    explore_nav = '<a href="#explore">Explore</a>' if demo else ''
    explore = f'''<section id="explore" class="content-section explore-section" aria-label="Interactive explanation">
      <span class="section-label">02 / Explore the idea</span>{demo}</section>''' if demo else ''
    method_number, results_number = ('03', '04') if demo else ('02', '03')
    overview_title = insight.get('story', {}).get('title', item['diagram']['title'])
    overview_text = paragraphs(insight.get('story', {})) or f'<p>{e(item["question"])}</p>'
    # Use the richer interactive explanation in place of a redundant three-box flow.
    visual = diagram_html(slug, item) if not demo or item.get('primary_figure') or slug == 'reverse-lm' else ''
    source_links = ''.join(f'<a href="{e(s["url"])}">{e(s["label"])} ↗</a>' for s in insight.get('sources', []))
    # An inline method figure precedes the prose that explains it.
    method_figure = source_figure(slug, item)
    method_title = insight.get('mechanism', {}).get('title', 'How it works')
    evidence_title = insight.get('evidence', {}).get('title', 'Key findings')
    return f'''<!DOCTYPE html>
<!-- Generated by scripts/build_papers.py. Edit papers/content/ and papers/insights/. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{e(item['takeaway'])}">
  <meta name="theme-color" content="#fbfcfa">
  <link rel="canonical" href="https://xunjianyin.github.io/papers/{slug}.html">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(item['takeaway'])}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://xunjianyin.github.io/papers/{slug}.html">
  <meta property="og:image" content="{e(image_url)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{e(title)}">
  <meta name="twitter:description" content="{e(item['takeaway'])}">
  <meta name="twitter:image" content="{e(image_url)}">
  <title>{e(short)} — Xunjian Yin</title>
  <link rel="icon" type="image/png" href="../figures/logo.png">
  <link rel="stylesheet" href="paper-page.css">
  {demo_assets}
  <script src="paper-page.js" defer></script>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to content</a>
  <header class="site-header"><div class="header-inner">
    <a class="site-name" href="../index.html">Xunjian Yin <span>/ Research</span></a>
    <nav aria-label="Paper sections"><a href="#overview">Overview</a>{explore_nav}<a href="#method">Method</a><a href="#findings">Evidence</a><a href="#citation">Cite</a></nav>
  </div></header>
  <main id="main-content" class="paper-container">
    <header class="paper-header">
      <p class="paper-eyebrow"><span>{e(meta['venue'])}</span><span>{e(item['topic'])}</span></p>
      <h1>{title_html}</h1>
      <p class="paper-authors">{authors}</p>
      <div class="paper-links" aria-label="Research resources">{links}</div>
      <p class="paper-takeaway">{e(item['takeaway'])}</p>
    </header>
    <section id="overview" class="overview-section" aria-labelledby="overview-title">
      <div class="section-heading"><span class="section-label">01 / The research question</span><h2 id="overview-title">{e(overview_title)}</h2></div>
      <div class="narrative overview-narrative">{overview_text}</div>
      {visual}{extra_overview}
    </section>
    {explore}
    <section id="method" class="content-section method-section expanded-method" aria-labelledby="method-title">
      <div class="section-heading"><span class="section-label">{method_number} / Inside the method</span><h2 id="method-title">{e(method_title)}</h2></div>
      {method_figure if item.get('figure_inline') else ''}
      <div class="method-reading"><div class="narrative">{paragraphs(insight.get('mechanism', {}))}</div><ol class="method-list">{methods}</ol></div>
      {'' if item.get('figure_inline') else method_figure}
      {extra_method}
    </section>
    <section id="findings" class="content-section" aria-labelledby="findings-title">
      <div class="section-heading"><span class="section-label">{results_number} / Reading the evidence</span><h2 id="findings-title">{e(evidence_title)}</h2></div>
      <ul class="findings-grid">{findings}</ul>
      <div class="narrative evidence-narrative">{paragraphs(insight.get('evidence', {}))}</div>
      {extra_evidence}
      {results_table(item)}
      <p class="scope-note"><strong>Scope.</strong> {e(item['scope'])} <a href="{e(item['source_url'])}">Read the study ↗</a></p>
    </section>
    <div class="reading-sources"><span>Further reading in the paper</span>{source_links}</div>
    <section class="paper-reference" aria-label="Summary and citation">
      <details class="paper-details"><summary>{e(abstract_label)}</summary><div class="abstract-content"><p>{e(meta['abstract'])}</p><a href="{e(meta['links'][0]['url'])}">Full paper ↗</a></div></details>
      <details class="paper-details citation-details" id="citation"><summary>Citation <span>BibTeX</span></summary>
        <div class="citation-content"><div class="citation-toolbar"><span class="copy-status" role="status" aria-live="polite"></span><button type="button" class="copy-citation-btn" hidden>Copy BibTeX</button></div>
        <pre class="paper-citation"><code>{e(meta['citation'])}</code></pre></div>
      </details>
    </section>
    {related}
  </main>
  <footer class="paper-footer"><a href="../publications.html">← All publications</a><a href="../index.html">Xunjian Yin</a></footer>
</body>
</html>
'''

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--partial", action="store_true", help="Render available content only")
    args = parser.parse_args()
    metadata = json.loads((PAPERS / "content/metadata.json").read_text())
    content: dict[str, Any] = {}
    for path in sorted((PAPERS / "content").glob("*.json")):
        if path.name == "metadata.json":
            continue
        batch = json.loads(path.read_text())
        if content.keys() & batch.keys():
            raise ValueError(f"Duplicate content in {path}")
        content.update(batch)
    if not args.partial and content.keys() != metadata.keys():
        raise ValueError(f"Paper coverage mismatch: {metadata.keys() ^ content.keys()}")
    threaded = [slug for slugs in RESEARCH_THREADS.values() for slug in slugs]
    if not args.partial and sorted(threaded) != sorted(content):
        raise ValueError(f"Each paper needs exactly one research thread: {set(threaded) ^ content.keys()}")
    stale = []
    for slug, item in sorted(content.items()):
        if len(item["method"]) != 3 or len(item["diagram"]["steps"]) != 3:
            raise ValueError(f"Expected three method / diagram steps: {slug}")
        insight_path = PAPERS / 'insights' / f'{slug}.json'
        insight = json.loads(insight_path.read_text()) if insight_path.exists() else {}
        if not args.partial and not insight:
            raise ValueError(f'Missing substantive research explanation: {slug}')
        related = related_research(slug, metadata, content)
        output = '\n'.join(line.rstrip() for line in render(slug, metadata[slug], item, insight, related).splitlines()) + '\n'
        target = PAPERS / f"{slug}.html"
        if args.check:
            if not target.exists() or target.read_text() != output:
                stale.append(slug)
        else:
            target.write_text(output)
    if stale:
        raise SystemExit(f"Out-of-date pages: {', '.join(stale)}")
    print(f"{'Checked' if args.check else 'Built'} {len(content)} paper pages.")

if __name__ == "__main__":
    main()
