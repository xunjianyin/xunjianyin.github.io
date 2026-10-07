"""The lenses' footprint on the site: one generic <head> snippet, and one list of lenses.

Run: python3 -m unittest tests/test_lenses_prepaint.py

- Every page that loads the site shell or easter/boot.js carries LENSES_PREPAINT (the canonical
  text in scripts/build_papers.py) exactly once, as the first <script> of its <head>.
- The snippet names no lens; the pre-paint rules it writes are the same in easter/boot.js and
  easter/lenses/core.js (both write them again for a back/forward return).
- No file outside easter/lenses/ and tests/ names a lens id in a regex, a CSS selector or a
  list: the core's LENSES is the only list of lenses.
- The lenses asset version is the same in the boot, the core, the site shell and the paper
  pages' boot tag.
"""
from __future__ import annotations

import importlib.util
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "easter" / "lenses" / "core.js"
BOOT = ROOT / "easter" / "boot.js"
SHELL = ROOT / "site-shell.js"
# Directories that are not the live site, or that may name lenses (the lenses and their tests).
SKIP_DIRS = {".git", ".claude", "archive", "tests", "vendor", "live2dw", "store", "node_modules", "__pycache__"}
TEXT_SUFFIXES = {".html", ".js", ".css", ".py", ".sh"}


def build_papers():
    spec = importlib.util.spec_from_file_location("build_papers_for_lenses", ROOT / "scripts" / "build_papers.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILD = build_papers()
PREPAINT: str = BUILD.LENSES_PREPAINT


def lens_ids() -> list[str]:
    match = re.search(r"const LENSES = \[([^\]]*)\]", CORE.read_text())
    assert match, "easter/lenses/core.js declares const LENSES = [...]"
    return re.findall(r"'([a-z]+)'", match.group(1))


def site_files() -> list[Path]:
    """Text files of the live site, outside easter/lenses/ and the skipped directories."""
    files = []
    for path in ROOT.rglob("*"):
        rel = path.relative_to(ROOT)
        if not path.is_file() or path.suffix not in TEXT_SUFFIXES or set(rel.parts[:-1]) & SKIP_DIRS:
            continue
        if rel.parts[:2] == ("easter", "lenses"):
            continue
        files.append(path)
    return files


def pages() -> list[Path]:
    """HTML pages that load the site shell or the egg boot."""
    return [path for path in site_files()
            if path.suffix == ".html" and re.search(r"site-shell\.js|easter/boot\.js", path.read_text(encoding="utf-8"))]


class PrepaintSnippetTest(unittest.TestCase):
    def test_every_page_carries_the_snippet_first(self) -> None:
        found = pages()
        self.assertGreaterEqual(len(found), 30, "the hand-written pages and the paper pages")
        for path in found:
            with self.subTest(page=str(path.relative_to(ROOT))):
                text = path.read_text(encoding="utf-8")
                head = text[text.index("<head>"):text.index("</head>")]
                self.assertEqual(text.count(PREPAINT), 1, "exactly one copy of LENSES_PREPAINT")
                self.assertEqual(head.find("<script"), head.find(PREPAINT), "the snippet is the first <script> in <head>")
                self.assertEqual(text.count("sessionStorage.getItem('lenses-active')") + text.count("s.getItem('lenses-active')"), 1,
                                 "no other copy of a pre-paint snippet")

    def test_snippet_is_generic(self) -> None:
        for lens in lens_ids():
            self.assertNotIn(lens, PREPAINT)
        self.assertIn("'lenses-active'", PREPAINT)
        self.assertIn("'lenses-ground'", PREPAINT)
        self.assertIn("id='lenses-prepaint'", PREPAINT)

    def test_prepaint_rules_agree(self) -> None:
        """The CSS the snippet writes is the CSS boot.js and core.js write, around the ground."""
        rules = re.search(r"t\.textContent='(.*?)'\+g\+'(.*?)';", PREPAINT)
        self.assertIsNotNone(rules, "the snippet writes '<before>'+g+'<after>'")
        before, after = rules.group(1), rules.group(2)
        for source in (BOOT, CORE):
            with self.subTest(file=source.name):
                self.assertIn(f"`{before}${{ground}}{after}`", source.read_text())


class OneLensListTest(unittest.TestCase):
    def test_lens_list(self) -> None:
        ids = lens_ids()
        self.assertTrue(0 < len(ids) <= 9, "keys 1-9 reach every lens")
        self.assertEqual(len(ids), len(set(ids)))

    def test_no_lens_id_outside_the_lenses(self) -> None:
        ids = "|".join(lens_ids())
        patterns = {
            "an attribute selector on the arrival": re.compile(r"data-lens-(?:arriving|revealing)=[\"']?[a-z]"),
            "a lens class selector": re.compile(rf"\.lens-(?:{ids})\b"),
            "a regex alternation": re.compile(rf"(?:\b(?:{ids})\|(?:{ids})\b)|\(\?:?(?:{ids})\|"),
            "a list of lens ids": re.compile(rf"['\"](?:{ids})['\"]\s*,\s*['\"](?:{ids})['\"]"),
        }
        offenders = []
        for path in site_files():
            text = path.read_text(encoding="utf-8", errors="replace")
            for name, pattern in patterns.items():
                for match in pattern.finditer(text):
                    line = text.count("\n", 0, match.start()) + 1
                    offenders.append(f"{path.relative_to(ROOT)}:{line}: {name}: {match.group(0)}")
        self.assertEqual(offenders, [])


class VersionTest(unittest.TestCase):
    def test_lenses_version_agrees(self) -> None:
        core = re.search(r"const VERSION = '(lenses-v\d+)'", CORE.read_text())
        boot = re.search(r"const VERSION = '(lenses-v\d+)'", BOOT.read_text())
        shell = re.search(r"easter/boot\.js\?v=(lenses-v\d+)", SHELL.read_text())
        papers = re.search(r"easter/boot\.js\?v=(lenses-v\d+)", BUILD.LENSES_BOOT)
        self.assertTrue(core and boot and shell and papers)
        self.assertEqual({core.group(1), boot.group(1), shell.group(1), papers.group(1)}, {core.group(1)})
        for path in pages():
            text = path.read_text(encoding="utf-8")
            for version in re.findall(r"site-shell\.js\?v=(lenses-v\d+)", text):
                with self.subTest(page=str(path.relative_to(ROOT))):
                    self.assertEqual(version, core.group(1), "the site shell's cache key follows the lenses version")


if __name__ == "__main__":
    unittest.main()
