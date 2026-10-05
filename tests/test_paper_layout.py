"""Result-first layout: glance block, affiliations, prior work, lead visual, demo placement."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import re
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('build_papers', ROOT / 'scripts/build_papers.py')
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)

META = {
    'title': 'Fixture: A Test Paper',
    'authors': 'Ada Lovelace , Xunjian Yin',
    'venue': 'ArXiv 2025',
    'links': [{'label': 'Paper', 'url': 'https://example.org/paper'}],
    'abstract': 'Abstract.',
    'citation': '@article{fixture}',
}
ITEM = {
    'short_name': 'Fixture',
    'takeaway': 'Fixture takeaway.',
    'topic': 'Testing',
    'question': 'Question?',
    'findings': [{'value': '1.0', 'label': 'Finding', 'detail': 'Detail.'}],
    'method': [{'title': f'Step {i}', 'text': 'Text.'} for i in range(3)],
    'diagram': {'title': 'Diagram', 'caption': 'Concept caption.',
                'steps': [{'label': f'Stage {i}', 'text': 'Text.'} for i in range(3)]},
    'scope': 'Scope.',
    'source_url': 'https://example.org/paper',
}
INSIGHT = {
    'story': {'title': 'Story', 'paragraphs': ['Story one.', 'Story two.']},
    'mechanism': {'title': 'Mechanism', 'paragraphs': ['Mechanism one.', 'Mechanism two.']},
    'evidence': {'title': 'Evidence', 'paragraphs': ['Evidence one.', 'Evidence two.']},
    'sources': [],
}
TABLE = {'caption': 'Table 1. Accuracy.', 'headings': ['Method', 'Accuracy'], 'rows': [['Ours', '50.0']]}
DEMO = '<div class="fixture-demo" data-paper-demo="fixture">DEMO</div>'


def page(item: dict | None = None, insight: dict | None = None, modules: list | None = None) -> str:
    return BUILDER.render('fixture', copy.deepcopy(META), item or copy.deepcopy(ITEM),
                          insight or copy.deepcopy(INSIGHT), modules=modules)


def module(rendered: object, **hooks: object) -> SimpleNamespace:
    """A demo module that claims only the fixture slug."""
    attrs = {'render_demo': lambda slug, insight: rendered if slug == 'fixture' else ''}
    for name, html in hooks.items():
        attrs[name] = (lambda value: lambda slug, insight: value)(html)
    return SimpleNamespace(**attrs)


def with_demo(placement: str | None = None) -> dict:
    insight = copy.deepcopy(INSIGHT)
    insight['demo'] = {'kind': 'fixture'} | ({'placement': placement} if placement else {})
    return insight


def labels(html: str) -> list[str]:
    return re.findall(r'<span class="section-label">(\d\d) / ([^<]+)</span>', html)


def section(html: str, section_id: str) -> str:
    match = re.search(rf'<section id="{section_id}".*?</section>', html, flags=re.S)
    assert match, section_id
    return match.group(0)


class FixtureAssets(unittest.TestCase):
    """Each test sees papers/demos/fixture.{css,js} in a temporary asset directory."""

    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.assets = Path(directory.name)
        for suffix in ('css', 'js'):
            (self.assets / f'fixture.{suffix}').write_text('/* fixture */')
        patcher = mock.patch.object(BUILDER, 'DEMO_ASSETS', self.assets)
        patcher.start()
        self.addCleanup(patcher.stop)

    def demo_page(self, rendered: object, placement: str | None = None, item: dict | None = None, **hooks: object) -> str:
        return page(item, with_demo(placement), [('fixture', module(rendered, **hooks))])


class GlanceTest(unittest.TestCase):
    def test_glance_renders_labelled_rows_after_the_takeaway(self) -> None:
        item = copy.deepcopy(ITEM) | {'glance': {'limitation': 'Small & narrow.', 'result': '+4 pp', 'prior': 'First to do X.'}}
        html = page(item)
        expected = ('<dl class="paper-glance"><div><dt>Result</dt><dd>+4 pp</dd></div>'
                    '<div><dt>New vs prior</dt><dd>First to do X.</dd></div>'
                    '<div><dt>Limitation</dt><dd>Small &amp; narrow.</dd></div></dl>')
        self.assertIn(expected, html)
        header = re.search(r'<header class="paper-header">.*?</header>', html, flags=re.S).group(0)
        self.assertIn(expected, header)
        self.assertLess(header.index('paper-takeaway'), header.index('paper-glance'))

    def test_absent_or_partial_glance(self) -> None:
        self.assertNotIn('paper-glance', page())
        self.assertNotIn('\n\n', page().split('</header>')[0][-200:], 'absent glance adds no blank line')
        partial = page(copy.deepcopy(ITEM) | {'glance': {'result': 'Only a result.'}})
        self.assertIn('<dl class="paper-glance"><div><dt>Result</dt><dd>Only a result.</dd></div></dl>', partial)
        self.assertNotIn('Limitation', partial)

    def test_unknown_glance_field_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            BUILDER.glance_html({'glance': {'results': 'typo'}})


class AuthorsTest(unittest.TestCase):
    DETAIL = {
        'authors_detail': [
            {'name': 'Ada Lovelace', 'affiliations': [1, 2], 'equal': True},
            {'name': 'Xunjian Yin', 'affiliations': [1], 'equal': True},
            {'name': 'Alan Turing', 'affiliations': [2]},
            {'name': 'Grace Hopper'},
        ],
        'affiliations': ['Peking University', 'Duke University'],
    }

    def test_author_line_has_affiliation_marks_and_legend(self) -> None:
        html = BUILDER.authors_html(META, self.DETAIL)
        line, legend = html.split('</p>', 1)
        self.assertEqual(line + '</p>', (
            '<p class="paper-authors"><span class="author">Ada Lovelace<sup>1,2*</sup></span>, '
            '<span class="author"><a href="../index.html">Xunjian Yin</a><sup>1*</sup></span>, '
            '<span class="author">Alan Turing<sup>2</sup></span>, <span class="author">Grace Hopper</span></p>'))
        self.assertEqual(legend, (
            '<p class="author-legend"><span><sup>1</sup> Peking University</span> · '
            '<span><sup>2</sup> Duke University</span> · <span><sup>*</sup> Equal contribution</span></p>'))
        # No whitespace before a mark, before a comma, or at the edge of a name.
        self.assertNotRegex(line, r'\s<sup>|\s,|\s</span>|<span class="author">\s')
        self.assertIn(html, page(copy.deepcopy(ITEM) | self.DETAIL))

    def test_shared_affiliations_without_equal_marks_drop_the_numbers(self) -> None:
        shared = {'authors_detail': [{'name': 'Ada Lovelace', 'affiliations': [2, 1]}, {'name': 'Xunjian Yin', 'affiliations': [1, 2]}],
                  'affiliations': ['Peking University', 'Duke University']}
        self.assertEqual(BUILDER.authors_html(META, shared), (
            '<p class="paper-authors"><span class="author">Ada Lovelace</span>, '
            '<span class="author"><a href="../index.html">Xunjian Yin</a></span></p>'
            '<p class="author-legend"><span>Peking University</span> · <span>Duke University</span></p>'))
        single = {'authors_detail': [{'name': 'Xunjian Yin', 'affiliations': [1]}], 'affiliations': ['Peking University']}
        self.assertEqual(BUILDER.authors_html(META, single),
                         '<p class="paper-authors"><span class="author"><a href="../index.html">Xunjian Yin</a></span></p>'
                         '<p class="author-legend"><span>Peking University</span></p>')
        # Only the shared institutions are listed when the legend has unused entries.
        partial = shared | {'affiliations': ['Peking University', 'Duke University', 'Unused Lab']}
        self.assertNotIn('Unused Lab', BUILDER.authors_html(META, partial))

    def test_numbers_stay_when_affiliations_differ_or_anyone_is_equal(self) -> None:
        differ = {'authors_detail': [{'name': 'Ada Lovelace', 'affiliations': [1]}, {'name': 'Xunjian Yin', 'affiliations': [1, 2]}],
                  'affiliations': ['Peking University', 'Duke University']}
        html = BUILDER.authors_html(META, differ)
        self.assertIn('Ada Lovelace<sup>1</sup>', html)
        self.assertIn('<a href="../index.html">Xunjian Yin</a><sup>1,2</sup>', html)
        self.assertIn('<span><sup>1</sup> Peking University</span> · <span><sup>2</sup> Duke University</span></p>', html)
        self.assertNotIn('Equal contribution', html)
        equal = {'authors_detail': [{'name': 'Ada Lovelace', 'affiliations': [1], 'equal': True},
                                    {'name': 'Xunjian Yin', 'affiliations': [1], 'equal': True}],
                 'affiliations': ['Peking University']}
        self.assertEqual(BUILDER.authors_html(META, equal), (
            '<p class="paper-authors"><span class="author">Ada Lovelace<sup>1*</sup></span>, '
            '<span class="author"><a href="../index.html">Xunjian Yin</a><sup>1*</sup></span></p>'
            '<p class="author-legend"><span><sup>1</sup> Peking University</span> · <span><sup>*</sup> Equal contribution</span></p>'))

    def test_invalid_author_details_are_rejected(self) -> None:
        for author in ({'name': 'Xunjian Yin', 'affiliations': [3]}, {'name': 'Xunjian Yin', 'affiliations': [0]},
                       {'name': 'Xunjian Yin', 'affiliation': [1]}, {'affiliations': [1]}):
            with self.subTest(author=author), self.assertRaises(ValueError):
                BUILDER.authors_html(META, {'authors_detail': [author], 'affiliations': ['Peking University']})

    def test_metadata_string_is_used_without_details(self) -> None:
        html = page()
        self.assertIn('<p class="paper-authors">Ada Lovelace, <a href="../index.html">Xunjian Yin</a></p>', html)
        self.assertNotIn('author-legend', html)


class PriorWorkTest(unittest.TestCase):
    def test_prior_work_closes_the_overview_narrative(self) -> None:
        html = page(copy.deepcopy(ITEM) | {'prior_work': 'Earlier work did A; this paper does B.'})
        overview = section(html, 'overview')
        self.assertIn('<div class="narrative overview-narrative"><p>Story one.</p><p>Story two.</p>'
                      '<div class="prior-work"><h3>Closest prior work</h3><p>Earlier work did A; this paper does B.</p></div></div>',
                      overview)
        self.assertNotIn('prior-work', page())


class LeadVisualTest(unittest.TestCase):
    def test_concept_diagram_precedes_section_one(self) -> None:
        html = page()
        lead = html.index('<div class="lead-visual"><figure class="concept-diagram">')
        self.assertLess(html.index('</header>'), lead)
        self.assertLess(lead, html.index('<section id="overview"'))
        self.assertNotIn('concept-diagram', section(html, 'overview'))
        self.assertEqual(labels(html), [('01', 'The research question'), ('02', 'Inside the method'), ('03', 'Reading the evidence')])

    def test_generated_pages_show_their_visual_before_section_one(self) -> None:
        content: dict = {}
        for file in (ROOT / 'papers/content').glob('*.json'):
            if file.stem != 'metadata':
                content.update(json.loads(file.read_text()))
        # Spot checks of what each kind of lead visual contains.
        expected = {'themis': 'primary-figure', 'godel-agent': 'godel-strip', 'damon': 'primary-figure',
                    'reverse-lm': 'direction-demo', 'coral': 'primary-figure'}
        checked = 0
        for slug, item in sorted(content.items()):
            html = (ROOT / 'papers' / f'{slug}.html').read_text()
            if 'class="lead-visual"' not in html and not item.get('primary_figure') and slug not in expected:
                continue
            with self.subTest(slug=slug):
                lead = re.search(r'</header>\s*<div class="lead-visual">(.*?)\n    <section id="overview"', html, flags=re.S)
                self.assertIsNotNone(lead, 'the lead visual sits between the header and section 01')
                visuals = {expected.get(slug)} | ({'primary-figure'} if item.get('primary_figure') else set())
                for visual in visuals - {None}:
                    self.assertIn(visual, lead.group(1))
                    self.assertNotIn(visual, section(html, 'overview'))
                checked += 1
        self.assertGreaterEqual(checked, len(expected))


class DemoPlacementTest(FixtureAssets):
    def test_default_placement_keeps_the_explore_section(self) -> None:
        html = self.demo_page(DEMO)
        self.assertIn(DEMO, section(html, 'explore'))
        self.assertIn('<a href="#overview">Overview</a><a href="#explore">Explore</a><a href="#method">Method</a>', html)
        self.assertEqual([n for n, _ in labels(html)], ['01', '02', '03', '04'])
        self.assertIn('<link rel="stylesheet" href="demos/fixture.css">', html)
        self.assertIn('<script src="demos/fixture.js" defer></script>', html)
        # A demo replaces the redundant concept diagram.
        self.assertNotIn('concept-diagram', html)

    def test_method_placement_follows_the_first_paragraph(self) -> None:
        html = self.demo_page(DEMO, 'method')
        method = section(html, 'method')
        self.assertIn('<div class="narrative method-lead"><p>Mechanism one.</p></div>'
                      f'<div class="section-demo method-demo">{DEMO}</div>'
                      '<div class="method-reading"><div class="narrative"><p>Mechanism two.</p></div><ol class="method-list">', method)
        self.assert_no_explore(html)

    def test_method_placement_with_a_single_paragraph_keeps_the_step_list(self) -> None:
        insight = with_demo('method')
        insight['mechanism']['paragraphs'] = ['Only paragraph.']
        html = page(None, insight, [('fixture', module(DEMO))])
        self.assertIn(f'<div class="section-demo method-demo">{DEMO}</div><div class="method-reading"><ol class="method-list">', html)

    def test_method_after_moves_the_demo_below_a_later_paragraph(self) -> None:
        insight = with_demo('method')
        insight['mechanism']['paragraphs'] = ['First.', 'Second.', 'Third.']
        insight['demo']['method_after'] = 2
        html = page(None, insight, [('fixture', module(DEMO))])
        self.assertIn('<div class="narrative method-lead"><p>First.</p><p>Second.</p></div>'
                      f'<div class="section-demo method-demo">{DEMO}</div>'
                      '<div class="method-reading"><div class="narrative"><p>Third.</p></div><ol class="method-list">', html)
        insight['demo']['method_after'] = 3
        html = page(None, insight, [('fixture', module(DEMO))])
        self.assertIn(f'<p>Third.</p></div><div class="section-demo method-demo">{DEMO}</div>'
                      '<div class="method-reading"><ol class="method-list">', html)

    def test_method_after_is_validated(self) -> None:
        for value in (0, 4, -1, '2', 1.5, True, None):
            insight = with_demo('method')
            insight['mechanism']['paragraphs'] = ['First.', 'Second.', 'Third.']
            insight['demo']['method_after'] = value
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'method_after'):
                page(None, insight, [('fixture', module(DEMO))])
        # Set without a method demo, the value would be silently ignored: fail instead.
        unused = with_demo('evidence')
        unused['demo']['method_after'] = 1
        with self.assertRaisesRegex(ValueError, 'no demo fills the method slot'):
            page(None, unused, [('fixture', module(DEMO))])

    def test_evidence_placement_follows_the_findings(self) -> None:
        html = self.demo_page(DEMO, 'evidence')
        self.assertRegex(section(html, 'findings'),
                         r'</ul>\s*<div class="section-demo evidence-demo">' + re.escape(DEMO) + r'</div>\s*<div class="narrative evidence-narrative">')
        self.assert_no_explore(html)

    def test_overview_placement_joins_the_lead_visual(self) -> None:
        html = self.demo_page(DEMO, 'overview')
        self.assertIn(f'<div class="lead-visual">{DEMO}</div>', html)
        self.assert_no_explore(html)

    def test_dict_return_fills_named_slots(self) -> None:
        parts = {slot: f'<div data-paper-demo="{slot}">{slot.upper()}</div>' for slot in BUILDER.DEMO_SLOTS}
        html = self.demo_page(parts, 'method')  # placement applies only to string returns
        self.assertIn(parts['overview'], html.split('<section id="overview"')[0])
        self.assertIn(parts['explore'], section(html, 'explore'))
        self.assertIn(f'<div class="section-demo method-demo">{parts["method"]}</div>', section(html, 'method'))
        self.assertIn(f'<div class="section-demo evidence-demo">{parts["evidence"]}</div>', section(html, 'findings'))
        evidence_only = self.demo_page({'evidence': DEMO, 'explore': ''})
        self.assert_no_explore(evidence_only)
        self.assertIn('href="demos/fixture.css"', evidence_only)

    def test_module_hooks_keep_their_positions(self) -> None:
        html = self.demo_page(DEMO, item=copy.deepcopy(ITEM) | {'results_table': TABLE},
                              render_overview='<p>OVERVIEW HOOK</p>', render_method='<p>METHOD HOOK</p>',
                              render_evidence='<p>EVIDENCE HOOK</p>')
        self.assertIn('<div class="lead-visual"><p>OVERVIEW HOOK</p></div>', html)
        method = section(html, 'method')
        self.assertLess(method.index('method-reading'), method.index('METHOD HOOK'))
        findings = section(html, 'findings')
        self.assertLess(findings.index('evidence-narrative'), findings.index('EVIDENCE HOOK'))
        self.assertLess(findings.index('EVIDENCE HOOK'), findings.index('results-block'))

    def test_invalid_demo_output_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.demo_page(DEMO, 'sidebar')
        with self.assertRaises(ValueError):
            self.demo_page({'appendix': DEMO})
        with self.assertRaises(TypeError):
            self.demo_page(['not', 'html'])
        with self.assertRaisesRegex(ValueError, 'No renderer'):
            self.demo_page({'method': '  '})

    def test_one_module_per_slug_and_assets_are_required(self) -> None:
        modules = [('fixture', module(DEMO)), ('other', module({'evidence': DEMO}))]
        with self.assertRaisesRegex(ValueError, 'paper_demo_fixture, paper_demo_other'):
            page(None, with_demo(), modules)
        with self.assertRaisesRegex(ValueError, 'Missing demo asset'):
            page(None, with_demo(), [('missing', module(DEMO))])
        # Modules that return nothing for the slug do not claim it.
        html = page(None, with_demo(), [('other', module('')), ('helper', SimpleNamespace()), ('fixture', module(DEMO))])
        self.assertIn(DEMO, html)

    def assert_no_explore(self, html: str) -> None:
        self.assertNotIn('id="explore"', html)
        self.assertNotIn('href="#explore"', html)
        self.assertEqual(labels(html), [('01', 'The research question'), ('02', 'Inside the method'), ('03', 'Reading the evidence')])


class DemoDiscoveryTest(FixtureAssets):
    def test_repository_modules_are_discovered_with_godel_first(self) -> None:
        groups = [group for group, _ in BUILDER.demo_modules()]
        on_disk = sorted(path.stem.removeprefix('paper_demo_') for path in (ROOT / 'scripts').glob('paper_demo_*.py'))
        self.assertEqual(groups[0], 'godel')
        self.assertEqual(sorted(groups), on_disk)
        self.assertEqual(groups[1:], sorted(groups[1:]))

    def write_module(self, directory: Path, group: str, body: str) -> None:
        (directory / f'paper_demo_{group}.py').write_text(body)
        self.addCleanup(sys.modules.pop, f'paper_demo_{group}', None)

    def test_a_new_module_works_without_generator_edits(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            scripts = Path(tmp)
            self.write_module(scripts, 'zzfixture', (
                'def render_demo(slug, insight):\n'
                '    return {"evidence": "<div data-paper-demo=\\"new\\">NEW</div>"} if slug == "fixture" else ""\n'))
            for suffix in ('css', 'js'):
                (self.assets / f'zzfixture.{suffix}').write_text('')
            with mock.patch.object(BUILDER, 'DEMO_SCRIPTS', scripts):
                html = page(None, with_demo())
        self.assertIn('<div class="section-demo evidence-demo"><div data-paper-demo="new">NEW</div></div>', html)
        self.assertIn('href="demos/zzfixture.css"', html)

    def test_two_modules_claiming_a_slug_fail_the_build(self) -> None:
        claim = 'def render_demo(slug, insight):\n    return "<div>claimed</div>" if slug == "fixture" else ""\n'
        with tempfile.TemporaryDirectory() as tmp:
            scripts = Path(tmp)
            self.write_module(scripts, 'zzalpha', claim)
            self.write_module(scripts, 'zzbeta', claim)
            with mock.patch.object(BUILDER, 'DEMO_SCRIPTS', scripts), \
                    self.assertRaisesRegex(ValueError, 'Several demo modules claim fixture: paper_demo_zzalpha, paper_demo_zzbeta'):
                page(None, with_demo())


class FindingsTest(FixtureAssets):
    def test_empty_findings_omit_the_grid(self) -> None:
        item = copy.deepcopy(ITEM) | {'findings': []}
        self.assertNotIn('findings-grid', page(item))
        html = self.demo_page(DEMO, 'evidence', item=item)
        self.assertRegex(section(html, 'findings'),
                         r'</h2></div>\n      <div class="section-demo evidence-demo">' + re.escape(DEMO))
        self.assertIn('<ul class="findings-grid"><li>', page())

    def test_generated_pages_have_no_empty_grid(self) -> None:
        for path in sorted((ROOT / 'papers').glob('*.html')):
            with self.subTest(page=path.name):
                self.assertNotIn('<ul class="findings-grid"></ul>', path.read_text())


class ResultsTableSwitchTest(unittest.TestCase):
    def test_remove_results_table_suppresses_the_table(self) -> None:
        item = copy.deepcopy(ITEM) | {'results_table': TABLE}
        self.assertIn('class="results-block"', page(item))
        self.assertNotIn('class="results-block"', page(item | {'remove_results_table': True}))


if __name__ == '__main__':
    unittest.main()
