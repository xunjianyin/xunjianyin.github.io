"""The cl100k_base tokenizer in easter/lenses/tokens.js reproduces tiktoken exactly.

Run: uv run --with tiktoken python -m unittest tests/test_cl100k_tokens.py

Three checks:
- easter/lenses/data/cl100k.txt decodes to exactly tiktoken's mergeable ranks (every token, every rank).
- The browser fixtures (tests/fixtures/cl100k_*.json, saved by tests/browser_tokens.js from the
  live homepage and the longest paper page) hold the lens's own token ids for every text run it
  counted; each must equal tiktoken's encode_ordinary of the same text.
- Through tests/cl100k_node_runner.js, the current tokens.js encodes the fixture texts, hand-picked
  edge cases and a seeded fuzz corpus exactly as tiktoken does.
"""
from __future__ import annotations

import json
import random
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_cl100k import unescape_token  # noqa: E402

try:
    import tiktoken
except ImportError:  # pragma: no cover - the suite says how to run it
    tiktoken = None

RANKS = ROOT / "easter" / "lenses" / "data" / "cl100k.txt"
FIXTURES = sorted((ROOT / "tests" / "fixtures").glob("cl100k_*.json"))
HOMEPAGE_FIXTURE = ROOT / "tests" / "fixtures" / "cl100k_homepage.json"
RUNNER = ROOT / "tests" / "cl100k_node_runner.js"
NODE = shutil.which("node")

# Strings that exercise each branch of the pre-tokenizer and the byte-level merges.
EDGE_CASES: list[str] = [
    # Homepage text and its special characters.
    "Gödel Agent: A Self-Referential Agent Framework for Recursively Self-Improvement",
    "Xunjian is pronounced as Shwen-Jyen",
    "I am a CS PhD student at ",
    " Duke University",
    "Seven AI chat sites — ChatGPT, Claude, Gemini",
    "★ 228",
    "© 2026 Xunjian Yin",
    "[ ", " / ", " ]", "*", "View all publications →",
    # Numbers are split into groups of at most three digits.
    "1", "12", "123", "1234", "1234567890", "3.14159", "v2.0.1", "2026-10-06", "١٢٣٤", "Ⅻ ½ ²³",
    # Contractions (the case-insensitive alternative) and lookalikes.
    "I'm", "you're", "they'll", "we've", "she'd", "it's", "don't", "WE'VE", "I'M", "'S", "'ll",
    "'ſt", "'ſ", "o'clock", "rock 'n' roll", "’s", "''", "'''",
    # Whitespace: collapsing branches, trailing runs, newlines and exotic spaces.
    " ", "  ", "a  b", "a   b", "a\tb", "a\t\tb", "a\nb", "a\n\nb", "a \n b", "a\r\nb", "x  \n  ",
    " \n\n x", "trailing   ", "\n", "\n\n\n", "\t", "a b", "a b", "a　b", "a\u0085b",
    "a﻿b", "a​b", "  leading", "  x",
    # Punctuation runs, with and without a leading space.
    "?!", "...", " ...", "--", " --\n", "(a)", "[1]", "{x}", "<|endoftext|>", "a.b,c;d:e",
    "https://xunjianyin.github.io/papers/godel-agent.html", "x**2 + y**2 == z**2",
    "def f(x):\n    return x  # comment\n",
    # Unicode: accents (precomposed and combining), CJK, emoji, other scripts.
    "é", "é", "naïve café", "Ærøskøbing", "你好世界", "東京", "한국어", "日本語のテキスト",
    "😀", "😀😀", "👩‍💻", "🇺🇸", "Привет мир", "مرحبا", "नमस्ते", "שלום", "∑∫∂", "ﬁ",
    "ſ", "K", "İstanbul", "ß", "Ǆ",
]

# Characters for the fuzz corpus, weighted towards the pre-tokenizer's boundaries.
FUZZ_POOLS: list[str] = [
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "0123456789",
    " " * 6 + "\t\n\r  　\u0085",
    ".,;:!?'\"()[]{}<>-_/\\|@#$%^&*+=~`",
    "'sdmtlvre",
    "éüößçñ́̈ÆøåĞş",
    "你好世界東京한국어",
    "★—–…→©®™°±×÷€£¥",
    "😀👍🏽🚀‍",
    "Привет",
]


def fuzz_strings(seed: int = 20261006, count: int = 1500) -> list[str]:
    """Seeded random strings mixing letters, digits, spaces, punctuation and multi-byte characters."""
    rng = random.Random(seed)
    strings: list[str] = []
    for _ in range(count):
        length = rng.randint(1, 48)
        pools = rng.sample(FUZZ_POOLS, rng.randint(1, 4))
        strings.append("".join(rng.choice(rng.choice(pools)) for _ in range(length)))
    return strings


def run_node(strings: list[str]) -> list[list[int]]:
    """Token ids from tokens.js for each string, via the node runner."""
    result = subprocess.run(
        [NODE, str(RUNNER)], input=json.dumps(strings), capture_output=True, text=True, check=True, timeout=120
    )
    return json.loads(result.stdout)["ids"]


@unittest.skipIf(tiktoken is None, "needs tiktoken: uv run --with tiktoken python -m unittest tests/test_cl100k_tokens.py")
class Cl100kTokensTest(unittest.TestCase):
    encoding: "tiktoken.Encoding"

    @classmethod
    def setUpClass(cls) -> None:
        cls.encoding = tiktoken.get_encoding("cl100k_base")

    def assert_matches(self, strings: list[str], ids: list[list[int]]) -> None:
        self.assertEqual(len(strings), len(ids))
        for text, got in zip(strings, ids):
            with self.subTest(text=text):
                self.assertEqual(got, self.encoding.encode_ordinary(text))

    def fixture_runs(self, path: Path | None = None) -> list[dict[str, object]]:
        """The runs of one fixture, or of every fixture."""
        runs: list[dict[str, object]] = []
        for fixture in [path] if path else FIXTURES:
            runs += json.loads(fixture.read_text(encoding="utf-8"))["runs"]
        return runs

    def test_ranks_file_is_tiktoken_vocabulary(self) -> None:
        lines = RANKS.read_text(encoding="utf-8").split("\n")
        header, body = lines[0].split(" "), lines[1:-1]
        ranks = self.encoding._mergeable_ranks
        self.assertEqual(header, ["#cl100k_base", str(len(ranks)), "utf8-escaped-v1"])
        self.assertEqual(lines[-1], "", "the file ends with a newline")
        self.assertEqual(len(body), len(ranks))
        for rank, line in enumerate(body):
            self.assertEqual(ranks[unescape_token(line)], rank, f"line {rank + 2}")

    def test_browser_fixtures_match_tiktoken(self) -> None:
        self.assertGreaterEqual(len(FIXTURES), 2, "the homepage and the long paper")
        for fixture in FIXTURES:
            with self.subTest(fixture=fixture.name):
                data = json.loads(fixture.read_text(encoding="utf-8"))
                runs = data["runs"]
                self.assertGreater(len(runs), 50, "the fixture holds a page's text runs")
                self.assertEqual(sum(len(run["ids"]) for run in runs), data["tokens"], "the runs hold the page's count")
                self.assert_matches([str(run["text"]) for run in runs], [list(run["ids"]) for run in runs])

    def test_fixture_covers_the_hard_cases(self) -> None:
        text = "\n".join(str(run["text"]) for run in self.fixture_runs(HOMEPAGE_FIXTURE))
        for needle in ("Gödel", "—", "2026", "Duke"):
            with self.subTest(needle=needle):
                self.assertIn(needle, text)

    @unittest.skipIf(NODE is None, "node is not installed")
    def test_node_matches_on_fixture_texts(self) -> None:
        strings = [str(run["text"]) for run in self.fixture_runs()]
        self.assert_matches(strings, run_node(strings))

    @unittest.skipIf(NODE is None, "node is not installed")
    def test_node_matches_on_edge_cases(self) -> None:
        self.assert_matches(EDGE_CASES, run_node(EDGE_CASES))

    @unittest.skipIf(NODE is None, "node is not installed")
    def test_node_matches_on_fuzz_corpus(self) -> None:
        strings = fuzz_strings()
        self.assert_matches(strings, run_node(strings))


if __name__ == "__main__":
    unittest.main()
