"""Figure sizing follows the actual local asset, not a guessed display size."""
from __future__ import annotations

from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('build_papers', ROOT / 'scripts/build_papers.py')
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class FigureMarkup(HTMLParser):
    def __init__(self, html: str) -> None:
        super().__init__()
        self.figure: dict[str, str | None] = {}
        self.image: dict[str, str | None] = {}
        self.feed(html)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == 'figure':
            self.figure = dict(attrs)
        elif tag == 'img':
            self.image = dict(attrs)


def style_properties(style: str | None) -> dict[str, str]:
    """Parse inline custom properties such as --figure-max-width:640px."""
    pairs = (part.split(':', 1) for part in (style or '').split(';') if ':' in part)
    return {name.strip(): value.strip() for name, value in pairs}


class PaperFigureTest(unittest.TestCase):
    def test_raster_sizes_come_from_original_files_and_never_upscale(self) -> None:
        for content_file in (ROOT / 'papers/content').glob('*.json'):
            if content_file.stem == 'metadata':
                continue
            for slug, item in json.loads(content_file.read_text()).items():
                asset = item.get('figure_local', '')
                if not asset.endswith('.png'):
                    continue
                with self.subTest(slug=slug):
                    header = (ROOT / 'papers' / asset).read_bytes()[:24]
                    width = int.from_bytes(header[16:20], 'big')
                    height = int.from_bytes(header[20:24], 'big')
                    markup = FigureMarkup(BUILDER.source_figure(slug, item, primary=True))
                    self.assertEqual(int(markup.image['width']), width)
                    self.assertEqual(int(markup.image['height']), height)
                    style = style_properties(markup.figure['style'])
                    display_width = float(style['--figure-max-width'].removesuffix('px'))
                    self.assertLessEqual(display_width, width)
                    if width >= 1280:
                        self.assertEqual(display_width, width / 2)

    def test_vector_figure_has_dimensions_but_no_raster_resolution_cap(self) -> None:
        markup = FigureMarkup(BUILDER.source_figure('coral', {
            'figure_local': 'assets/coral-decoding.svg',
        }))
        self.assertGreater(int(markup.image['width']), 0)
        self.assertGreater(int(markup.image['height']), 0)
        self.assertNotIn('--figure-max-width', style_properties(markup.figure.get('style')))

    def test_wide_figures_keep_a_legible_minimum_width_on_phones(self) -> None:
        # Gödel Figure 3 is 1626 x 466; shrinking it to 350px makes its labels unreadable.
        item = {'figure_local': 'assets/godel-agent-overview.png', 'figure_inline': True}
        html = BUILDER.source_figure('godel-agent', item)
        markup = FigureMarkup(html)
        self.assertIn('wide-figure', markup.figure['class'])
        self.assertEqual(style_properties(markup.figure['style'])['--figure-min-width'], '680px')
        self.assertIn('class="figure-scroll"', html)
        # A figure with an ordinary aspect ratio is not wrapped.
        normal = BUILDER.source_figure('chemagent', {'figure_local': 'assets/chemagent-overview.png', 'figure_inline': True})
        self.assertNotIn('wide-figure', normal)

    def test_inline_method_figure_does_not_require_opening_disclosure(self) -> None:
        item = {'figure_local': 'assets/godel-agent-overview.png', 'figure_inline': True}
        self.assertNotIn('<details', BUILDER.source_figure('godel-agent', item))
        item['figure_inline'] = False
        self.assertIn('<details', BUILDER.source_figure('godel-agent', item))


    def test_godel_illustrations_match_their_generator(self) -> None:
        spec = importlib.util.spec_from_file_location('godel_illustrations', ROOT / 'scripts/godel_illustrations.py')
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module  # dataclasses resolve annotations through sys.modules
        spec.loader.exec_module(module)
        scenes = module.scenes()
        self.assertEqual(len(scenes), 6)
        html = (ROOT / 'papers/godel-agent.html').read_text()
        for stem, title, body in scenes:
            with self.subTest(panel=stem):
                committed = (ROOT / 'papers/assets' / f'{stem}.svg').read_text()
                self.assertEqual(committed, module.panel(int(stem[-1]), title, body), 'rerun scripts/godel_illustrations.py')
                self.assertIn(f'assets/{stem}.svg', html)
                self.assertNotRegex(committed, r'<rect[^>]*\brx=')  # the robot keeps the site's square corners

if __name__ == '__main__':
    unittest.main()
