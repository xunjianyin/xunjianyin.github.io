"""Results tables, venue labels and research-thread links on generated pages."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('build_papers', ROOT / 'scripts/build_papers.py')
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def load_content() -> dict[str, dict]:
    content: dict[str, dict] = {}
    for file in (ROOT / 'papers/content').glob('*.json'):
        if file.stem != 'metadata':
            content.update(json.loads(file.read_text()))
    return content


class ResultsTableTest(unittest.TestCase):
    TABLE = {
        'caption': 'Table 2 (selected rows). Accuracy (%).',
        'headings': ['Method', 'Setting', 'Accuracy', 'Change'],
        'rows': [['Baseline', 'closed-book', '41.0', '–'], ['Proposed', 'closed-book', '48.5 ± 0.3', '+7.5 pp']],
        'highlight': [1],
        'source_url': 'https://example.org/paper',
    }

    def test_numeric_columns_are_right_aligned_and_text_columns_are_not(self) -> None:
        html = BUILDER.results_table({'results_table': self.TABLE})
        self.assertIn('<th scope="col" class="num">Accuracy</th>', html)
        self.assertIn('<td class="num">+7.5 pp</td>', html)
        self.assertIn('<td>closed-book</td>', html)
        starred = self.TABLE | {'rows': [['Baseline', 'x', '3.528', '–'], ['Proposed', 'y', '3.336*', '−0.19']]}
        self.assertIn('<td class="num">3.336*</td>', BUILDER.results_table({'results_table': starred}))
        # A change printed beside a value keeps the column numeric and is set apart.
        printed = self.TABLE | {'rows': [['Baseline', 'x', '2.21', '–'], ['Proposed', 'y', '30.31 ↑28.09', '/']]}
        self.assertIn('<td class="num">30.31 <span class="printed-change">↑28.09</span></td>', BUILDER.results_table({'results_table': printed}))
        self.assertNotIn('<th scope="col" class="num">Method</th>', html)

    def test_only_the_papers_method_is_highlighted(self) -> None:
        html = BUILDER.results_table({'results_table': self.TABLE})
        self.assertEqual(html.count('class="is-highlight"'), 1)
        self.assertIn('<tr class="is-highlight"><th scope="row">Proposed</th>', html)
        self.assertIn('Method proposed in the paper', html)
        self.assertIn('href="https://example.org/paper"', html)

    def test_ragged_rows_are_rejected(self) -> None:
        ragged = self.TABLE | {'rows': [['Baseline', '41.0']]}
        with self.assertRaises(ValueError):
            BUILDER.results_table({'results_table': ragged})

    def test_every_generated_table_has_a_caption_naming_its_source_table(self) -> None:
        for slug, item in load_content().items():
            table = item.get('results_table')
            if not table:
                continue
            with self.subTest(slug=slug):
                self.assertRegex(table['caption'], r'Table \d+')
                self.assertLessEqual(len(table['rows']), 10)
                for index in table.get('highlight', []):
                    self.assertLess(index, len(table['rows']))


class VenueAndThreadTest(unittest.TestCase):
    def test_preprint_venues_share_one_spelling(self) -> None:
        self.assertEqual(BUILDER.normalize_venue('ArXiv Preprint 2025'), 'arXiv preprint 2025')
        self.assertEqual(BUILDER.normalize_venue('ArXiv 2024'), 'arXiv preprint 2024')
        self.assertEqual(BUILDER.normalize_venue('ACL 2025 Findings '), 'ACL 2025 Findings')
        for page in (ROOT / 'papers').glob('*.html'):
            self.assertNotRegex(page.read_text(), r'>ArXiv', page.name)

    def test_each_page_links_to_the_rest_of_its_thread(self) -> None:
        content = load_content()
        for name, slugs in BUILDER.RESEARCH_THREADS.items():
            for slug in slugs:
                with self.subTest(slug=slug):
                    html = (ROOT / 'papers' / f'{slug}.html').read_text()
                    block = re.search(r'<nav class="related-research".*?</nav>', html, flags=re.S)
                    self.assertIsNotNone(block)
                    links = re.findall(r'href="([a-z0-9-]+)\.html"', block.group(0))
                    self.assertEqual(links, [other for other in slugs if other != slug])
                    self.assertNotIn(f'href="{slug}.html"', block.group(0))
        self.assertEqual(sorted(s for slugs in BUILDER.RESEARCH_THREADS.values() for s in slugs), sorted(content))

    def test_damon_belongs_to_evaluation_and_red_teaming(self) -> None:
        threads = BUILDER.RESEARCH_THREADS
        self.assertNotIn('Evaluating generated text', threads)
        self.assertEqual(threads['Evaluation and red-teaming'][-1], 'damon')
        self.assertNotIn('damon', threads['Language modeling and decoding'])
        html = (ROOT / 'papers/damon.html').read_text()
        self.assertIn('<p class="related-thread">Evaluation and red-teaming</p>', html)


if __name__ == '__main__':
    unittest.main()
