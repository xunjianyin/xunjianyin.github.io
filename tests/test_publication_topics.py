"""Publication topics in data.js agree with the easter egg's themes and the filter vocabulary."""
from __future__ import annotations
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def data_js_publications() -> list[dict[str, str]]:
    """Title, topic and local paper-page slug of every publication entry in data.js."""
    source = (ROOT / "data.js").read_text()
    block = source[source.index("const publications = ["):source.index("\n];", source.index("const publications = ["))]
    entries = []
    for chunk in re.split(r"\n  \{\n    title: ", block)[1:]:
        title = re.match(r'"([^"]+)"', chunk).group(1)
        topic = re.search(r'\n    topic: "([a-z]+)"', chunk)
        page = re.search(r'url: "papers/([a-z0-9-]+)\.html"', chunk)
        entries.append({"title": title, "topic": topic.group(1) if topic else "", "slug": page.group(1) if page else ""})
    return entries


def egg_themes() -> dict[str, str]:
    """Slug -> theme id from the easter egg's PAPERS table."""
    source = (ROOT / "easter-egg.js").read_text()
    return dict((slug, theme) for theme, slug in re.findall(r"\[\d{4}, '(\w+)', '([a-z0-9-]+)'", source))


def topic_ids() -> list[str]:
    source = (ROOT / "data.js").read_text()
    block = source[source.index("const PUBLICATION_TOPICS = ["):source.index("];", source.index("const PUBLICATION_TOPICS = ["))]
    return re.findall(r"id: '([a-z]+)'", block)


class PublicationTopicsTest(unittest.TestCase):
    def test_topic_vocabulary_matches_egg_themes(self) -> None:
        source = (ROOT / "easter-egg.js").read_text()
        themes = re.findall(r"\{ id: '([a-z]+)', label: '[^']+', colour:", source)
        self.assertEqual(topic_ids(), themes)

    def test_every_topic_is_known(self) -> None:
        known = set(topic_ids())
        for entry in data_js_publications():
            with self.subTest(title=entry["title"]):
                if entry["topic"]:
                    self.assertIn(entry["topic"], known)

    def test_papers_with_pages_share_the_egg_theme(self) -> None:
        themes = egg_themes()
        for entry in data_js_publications():
            if entry["slug"]:
                with self.subTest(slug=entry["slug"]):
                    self.assertIn(entry["slug"], themes)
                    self.assertEqual(entry["topic"], themes[entry["slug"]])


if __name__ == "__main__":
    unittest.main()
