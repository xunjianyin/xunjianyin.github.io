#!/usr/bin/env python3
"""Build easter/lenses/data/cl100k.txt, the compact cl100k_base ranks file read by easter/lenses/tokens.js.

Run: uv run --with tiktoken python scripts/build_cl100k.py [--check]

Format (UTF-8 text, newline-separated):
  line 1      header: "#cl100k_base <count> utf8-escaped-v1"
  line n + 2  the bytes of the token whose rank (token id) is n

A token's bytes are written as UTF-8 text where they form valid characters.
Every other byte (a fragment of a multi-byte character, a control byte, or the
backslash itself) is written as a four-character escape \\xHH. A literal
backslash therefore always starts an escape, so the encoding is unambiguous.
Ranks are implicit in the line order, which keeps the file at about 0.77 MB
raw and about 0.41 MB gzipped (GitHub Pages serves .txt gzipped).
"""
from __future__ import annotations

import argparse
import gzip
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "easter" / "lenses" / "data" / "cl100k.txt"
ENCODING = "cl100k_base"
FORMAT = "utf8-escaped-v1"


def utf8_length(lead: int) -> int:
    """Byte length implied by a UTF-8 lead byte, or 0 when the byte cannot start a character."""
    if lead < 0x80:
        return 1
    if 0xC2 <= lead <= 0xDF:
        return 2
    if 0xE0 <= lead <= 0xEF:
        return 3
    if 0xF0 <= lead <= 0xF4:
        return 4
    return 0


def escape_token(token: bytes) -> str:
    """Write token bytes as UTF-8 text, escaping bytes that are not part of a printable character."""
    out: list[str] = []
    i = 0
    while i < len(token):
        length = utf8_length(token[i])
        char: str | None = None
        if length:
            try:
                decoded = token[i:i + length].decode("utf-8")  # strict: rejects surrogates and overlongs
            except UnicodeDecodeError:
                decoded = ""
            if len(decoded) == 1:
                char = decoded
        if char is None or char == "\\" or ord(char) < 0x20 or char == "\x7f":
            out.append(f"\\x{token[i]:02x}")
            i += 1
        else:
            out.append(char)
            i += length
    return "".join(out)


def unescape_token(line: str) -> bytes:
    """Inverse of escape_token, mirroring the parser in easter/lenses/tokens.js."""
    out = bytearray()
    i = 0
    while i < len(line):
        if line[i] == "\\":
            out.append(int(line[i + 2:i + 4], 16))
            i += 4
        else:
            out += line[i].encode("utf-8")
            i += 1
    return bytes(out)


def load_ranks() -> list[bytes]:
    """Token bytes indexed by rank, from tiktoken's cl100k_base."""
    import tiktoken  # imported here so --help works without it

    ranks = tiktoken.get_encoding(ENCODING)._mergeable_ranks
    by_rank = sorted(ranks.items(), key=lambda item: item[1])
    if [rank for _, rank in by_rank] != list(range(len(by_rank))):
        raise SystemExit("cl100k_base ranks are not contiguous; the implicit-rank format cannot hold them")
    return [token for token, _ in by_rank]


def render(tokens: list[bytes]) -> str:
    lines = [f"#{ENCODING} {len(tokens)} {FORMAT}"] + [escape_token(token) for token in tokens]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail if the committed file differs from a fresh build")
    args = parser.parse_args()

    tokens = load_ranks()
    text = render(tokens)
    # Round trip before writing: every line must decode back to the exact token bytes.
    decoded = [unescape_token(line) for line in text.split("\n")[1:-1]]
    if decoded != tokens:
        raise SystemExit("round trip failed")
    data = text.encode("utf-8")

    if args.check:
        current = OUTPUT.read_bytes() if OUTPUT.exists() else b""
        if current != data:
            print(f"{OUTPUT.relative_to(ROOT)} is stale; rebuild it", file=sys.stderr)
            return 1
        print(f"{OUTPUT.relative_to(ROOT)} is current")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(data)
    print(f"wrote {OUTPUT.relative_to(ROOT)}: {len(tokens)} tokens, "
          f"{len(data):,} bytes raw, {len(gzip.compress(data, 9)):,} bytes gzip -9")
    return 0


if __name__ == "__main__":
    sys.exit(main())
