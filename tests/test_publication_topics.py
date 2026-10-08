"""Publication topics in data.js agree with the easter egg's themes and the filter vocabulary."""
from __future__ import annotations
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def data_js_publications() -> list[dict[str, object]]:
    """Title, topics (primary first) and local paper-page slug of every publication entry in data.js."""
    source = (ROOT / "data.js").read_text()
    block = source[source.index("const publications = ["):source.index("\n];", source.index("const publications = ["))]
    entries = []
    for chunk in re.split(r"\n  \{\n    title: ", block)[1:]:
        title = re.match(r'"([^"]+)"', chunk).group(1)
        topics = re.search(r'\n    topics: \[([^\]]*)\]', chunk)
        assert topics, f"{title}: every entry lists its topics"
        page = re.search(r'url: "papers/([a-z0-9-]+)\.html"', chunk)
        entries.append({"title": title, "topics": re.findall(r'"([a-z]+)"', topics.group(1)), "slug": page.group(1) if page else ""})
    return entries


def topic_ids() -> list[str]:
    source = (ROOT / "data.js").read_text()
    block = source[source.index("const PUBLICATION_TOPICS = ["):source.index("];", source.index("const PUBLICATION_TOPICS = ["))]
    return re.findall(r"id: '([a-z]+)'", block)


class PublicationTopicsTest(unittest.TestCase):
    def test_topic_vocabulary_matches_egg_themes(self) -> None:
        source = (ROOT / "easter" / "spira" / "spira.js").read_text()
        themes = re.findall(r"\{ id: '([a-z]+)', label: '[^']+', colour:", source)
        self.assertEqual(topic_ids(), themes)

    def test_every_topic_is_known_and_listed_once(self) -> None:
        known = set(topic_ids())
        for entry in data_js_publications():
            with self.subTest(title=entry["title"]):
                self.assertTrue(set(entry["topics"]) <= known)
                self.assertEqual(len(entry["topics"]), len(set(entry["topics"])))

    def test_every_paper_page_has_a_theme(self) -> None:
        # Spira draws a publication under its first topic that is a theme (spira.js, papersFrom):
        # a paper with a page here must have one, or its star would be missing.
        known = set(topic_ids())
        for entry in data_js_publications():
            if entry["slug"]:
                with self.subTest(slug=entry["slug"]):
                    self.assertTrue(entry["topics"], "papers with a page have a primary topic")
                    self.assertIn(entry["topics"][0], known)


if __name__ == "__main__":
    unittest.main()
