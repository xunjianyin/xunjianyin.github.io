"""Structural regression checks for the generated academic paper pages."""
from __future__ import annotations
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self, html: str) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.links: list[str] = []
        self.assets: list[str] = []
        self.images: list[dict[str, str | None]] = []
        self.h1_count = 0
        self.feed(html)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
        if tag in {"script", "img"} and values.get("src"):
            self.assets.append(values["src"])
        if tag == "link" and values.get("rel") in {"stylesheet", "icon"}:
            self.assets.append(values["href"])
        if tag == "img":
            self.images.append(values)

class PaperPagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.metadata = json.loads((ROOT / "papers/content/metadata.json").read_text())
        cls.content = {}
        for file in (ROOT / "papers/content").glob("*.json"):
            if file.stem != "metadata":
                cls.content.update(json.loads(file.read_text()))

    def test_all_original_routes_are_generated_and_current(self) -> None:
        self.assertEqual(set(self.metadata), set(self.content))
        result = subprocess.run(["python3", "scripts/build_papers.py", "--check"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_html_structure_and_local_references(self) -> None:
        for slug in self.metadata:
            with self.subTest(slug=slug):
                path = ROOT / "papers" / f"{slug}.html"
                page = Page(path.read_text())
                self.assertEqual(page.h1_count, 1)
                self.assertEqual(len(page.ids), len(set(page.ids)))
                self.assertTrue({"main-content", "overview", "findings", "method", "citation"}.issubset(page.ids))
                for href in page.links + page.assets:
                    parsed = urlsplit(href)
                    if parsed.scheme or parsed.netloc:
                        self.assertEqual(parsed.scheme, "https")
                    elif parsed.path:
                        self.assertTrue((path.parent / unquote(parsed.path)).is_file(), href)
                    elif parsed.fragment:
                        self.assertIn(parsed.fragment, page.ids)
                for image in page.images:
                    self.assertTrue(image.get("alt"))
                    self.assertFalse(urlsplit(image["src"]).scheme, "Figures must be local")

    def test_research_resources_and_citations_are_present(self) -> None:
        for slug, item in self.content.items():
            with self.subTest(slug=slug):
                meta = self.metadata[slug] | item.get("metadata_override", {})
                self.assertIn("Xunjian Yin", meta["authors"])
                self.assertTrue(meta["citation"].startswith("@"))
                page = Page((ROOT / "papers" / f"{slug}.html").read_text())
                for resource in meta["links"]:
                    self.assertIn(resource["url"], page.links)
                self.assertIn(item["source_url"], page.links)

    def test_explanations_and_primary_sources_are_static(self) -> None:
        for slug in self.metadata:
            with self.subTest(slug=slug):
                insight = json.loads((ROOT / 'papers/insights' / f'{slug}.json').read_text())
                html = (ROOT / 'papers' / f'{slug}.html').read_text()
                page = Page(html)
                self.assertTrue(insight.get('reading_notes'))
                for key in ('story', 'mechanism', 'evidence'):
                    section = insight[key]
                    self.assertTrue(section['title'])
                    self.assertGreaterEqual(len(section['paragraphs']), 2)
                    # Research prose must not depend on JavaScript execution.
                    from html import escape
                    for paragraph in section['paragraphs']:
                        self.assertIn(escape(paragraph, quote=True), html)
                for source in insight['sources']:
                    self.assertIn(source['url'], page.links)
                if insight.get('demo'):
                    self.assertIn('data-paper-demo=', html)
                    self.assertIn('data-demo-state', html)

    def test_corrected_paper_identifiers(self) -> None:
        # Old pages pointed to unrelated publications; guard against regressions.
        expected = {
            "contextual-asr": "2024.lrec-main.341",
            "error-robust-retrieval": "2024.lrec-main.553",
            "self-generated-documents": "2025.findings-naacl.149",
            "dsgram": "34746",
            "nlg-evaluation-survey": "2025.cl-2.9",
            "chemagent": "kuhIqeVg0e",
        }
        for slug, identifier in expected.items():
            with self.subTest(slug=slug):
                meta = self.metadata[slug] | self.content[slug].get("metadata_override", {})
                self.assertIn(identifier, meta["links"][0]["url"])

if __name__ == "__main__":
    unittest.main()
