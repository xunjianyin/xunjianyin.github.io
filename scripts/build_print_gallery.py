"""Build the Print Gallery's prints: one screenshot of the homepage for every version of the
site that looks different from the one before, with the place of its photo (the portal the
gallery dives through).

    uv run --with pillow python scripts/build_print_gallery.py            # capture and build
    uv run --with pillow python scripts/build_print_gallery.py --reuse    # rebuild from the captures

For each commit (oldest first), the repository is checked out into a temporary worktree,
served on its own port (so no file is cached across versions), and the homepage is captured
in agent-browser at 1280 x 800 CSS px, device pixel ratio 2, light theme, empty storage. A
version is kept when its capture differs visibly from the last kept one and from HEAD's (the
live page is the newest level, so HEAD itself is never a print). Writes, under
easter/gallery/prints/: <n>-<hash>-l.webp (1920 x 1200), <n>-<hash>-s.webp (480 x 300) and
manifest.json (newest first: date, message, portal as fractions of the print, round or not).
A version whose photo did not load is left out. Raw captures are kept in a cache directory
(GALLERY_CACHE) so a rebuild needs no browser.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'easter' / 'gallery' / 'prints'
CACHE = Path(os.environ.get('GALLERY_CACHE', Path(tempfile.gettempdir()) / 'print-gallery-cache'))
SESSION = 'print-gallery-build'
VIEWPORT = (1280, 800)
DPR = 2
LARGE = (1920, 1200)
SMALL = (480, 300)
DIFF_KEEP = 2.2          # mean absolute difference (0-255, grey, 320 x 200) that counts as a new look
SETTLE_MS = 1800         # after load: fonts, images, the lists main.js fills

# Finds the homepage photo: the largest roughly square image near the top, and whether it is
# drawn round. Its box is in CSS px of the viewport.
FIND_PORTAL = r"""
(async () => {
  try { await document.fonts.ready; } catch (e) {}
  // Images in view, at most 4 s (a lazy image below the fold never loads).
  const inView = [...document.images].filter(i => { const b = i.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0; });
  await Promise.race([Promise.all(inView.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 4000))]);
  await new Promise(r => setTimeout(r, %d));
  let best = null;
  for (const img of document.images) {
    const b = img.getBoundingClientRect();
    if (b.width < 60 || b.top > 700 || b.bottom < 0) continue;
    const ratio = b.width / b.height;
    if (ratio < 0.7 || ratio > 1.4) continue;
    if (!best || b.width * b.height > best.w * best.h) {
      const cs = getComputedStyle(img);
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      best = { x: b.left, y: b.top, w: b.width, h: b.height, round: radius >= 0.4 * Math.min(b.width, b.height) || /50%%/.test(cs.borderRadius) };
    }
  }
  return JSON.stringify({ portal: best, title: document.title, scrollY });
})()
""" % SETTLE_MS


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)


def ab(*args: str, timeout: int = 60) -> str:
    """One agent-browser command under a watchdog."""
    result = subprocess.run(['agent-browser', '--session', SESSION, *args], text=True, capture_output=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f'agent-browser {" ".join(args)}: {result.stderr.strip() or result.stdout.strip()}')
    return result.stdout.strip()


def free_port() -> int:
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def commits() -> list[tuple[str, str, str]]:
    """(hash, date, subject), oldest first."""
    out = run(['git', '-C', str(ROOT), 'log', '--reverse', '--format=%H%x09%ad%x09%s', '--date=short']).stdout
    return [tuple(line.split('\t', 2)) for line in out.splitlines() if line]


def capture(hash_: str, worktree: Path) -> dict | None:
    """Capture one version; returns its record (or None when the page has no photo)."""
    shot = CACHE / f'{hash_}.png'
    meta = CACHE / f'{hash_}.json'
    if shot.exists() and meta.exists():
        return json.loads(meta.read_text())
    run(['git', '-C', str(worktree), 'checkout', '-q', '--force', hash_])
    port = free_port()
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(worktree)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=0.2):
                    break
            except OSError:
                time.sleep(0.1)
        ab('open', f'http://127.0.0.1:{port}/index.html', timeout=90)
        found = json.loads(json.loads(ab('eval', FIND_PORTAL, timeout=90)))
        ab('screenshot', str(shot), timeout=90)
    finally:
        server.terminate()
        server.wait()
    record = {'hash': hash_, **found}
    meta.write_text(json.dumps(record))
    return record


def grey(path: Path) -> Image.Image:
    return Image.open(path).convert('L').resize((320, 200), Image.BILINEAR)


def difference(a: Image.Image, b: Image.Image) -> float:
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]


def photo_missing(record: dict) -> bool:
    """The photo did not load in that version (its alt text on paper): the middle of the
    portal is nearly white and grey, where the photograph has colour (saturation about 80)."""
    shot = Image.open(CACHE / f'{record["hash"]}.png')
    p = record['portal']; scale = shot.width / VIEWPORT[0]
    box = tuple(round(v * scale) for v in (p['x'] + 0.2 * p['w'], p['y'] + 0.2 * p['h'], p['x'] + 0.8 * p['w'], p['y'] + 0.8 * p['h']))
    grey = ImageStat.Stat(shot.convert('L').crop(box)); hsv = ImageStat.Stat(shot.convert('HSV').crop(box))
    return grey.mean[0] > 215 and hsv.mean[1] < 20


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--reuse', action='store_true', help='build from the cached captures only')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    history = commits()
    head = history[-1][0]
    records: dict[str, dict] = {}
    if not args.reuse:
        worktree = Path(tempfile.mkdtemp(prefix='print-gallery-wt-'))
        run(['git', '-C', str(ROOT), 'worktree', 'add', '--detach', '-f', str(worktree), head])
        try:
            subprocess.run(['agent-browser', '--session', SESSION, 'close'], capture_output=True)
            ab('open', 'about:blank')
            ab('set', 'viewport', str(VIEWPORT[0]), str(VIEWPORT[1]), str(DPR))
            for i, (hash_, date, subject) in enumerate(history):
                try:
                    record = capture(hash_, worktree)
                except Exception as error:  # a broken old version: skip it, say so
                    print(f'{i + 1:3d}/{len(history)} {hash_[:7]} {date} failed: {error}', flush=True)
                    continue
                print(f'{i + 1:3d}/{len(history)} {hash_[:7]} {date} portal={record and record.get("portal")}', flush=True)
        finally:
            subprocess.run(['agent-browser', '--session', SESSION, 'close'], capture_output=True)
            subprocess.run(['git', '-C', str(ROOT), 'worktree', 'remove', '--force', str(worktree)], capture_output=True)
            shutil.rmtree(worktree, ignore_errors=True)
    for hash_, date, subject in history:
        meta = CACHE / f'{hash_}.json'
        if meta.exists() and (CACHE / f'{hash_}.png').exists():
            records[hash_] = {**json.loads(meta.read_text()), 'date': date, 'message': subject}

    # Keep a version when it looks different from the last kept one; never HEAD's look.
    head_grey = grey(CACHE / f'{head}.png') if head in records else None
    kept: list[dict] = []
    last = None
    for hash_, date, subject in history:
        record = records.get(hash_)
        if not record or not record.get('portal') or photo_missing(record):
            continue
        image = grey(CACHE / f'{hash_}.png')
        if last is not None and difference(image, last) < DIFF_KEEP:
            continue
        if head_grey is not None and difference(image, head_grey) < DIFF_KEEP:
            continue
        kept.append(record)
        last = image
    kept = [r for r in kept if r['hash'] != head]

    # Write the prints, newest first.
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    manifest = []
    width, height = VIEWPORT
    for n, record in enumerate(reversed(kept), start=1):
        base = f'{n:02d}-{record["hash"][:7]}'
        shot = Image.open(CACHE / f'{record["hash"]}.png').convert('RGB')
        shot.resize(LARGE, Image.LANCZOS).save(OUT / f'{base}-l.webp', 'WEBP', quality=74, method=6)
        shot.resize(SMALL, Image.LANCZOS).save(OUT / f'{base}-s.webp', 'WEBP', quality=80, method=6)
        p = record['portal']
        manifest.append({
            'file': base, 'hash': record['hash'][:7], 'date': record['date'], 'message': record['message'],
            'portal': [round(p['x'] / width, 5), round(p['y'] / height, 5), round(p['w'] / width, 5), round(p['h'] / height, 5)],
            'round': bool(p.get('round'))
        })
    (OUT / 'manifest.json').write_text(json.dumps({'viewport': list(VIEWPORT), 'prints': manifest}, indent=1) + '\n')
    total = sum(f.stat().st_size for f in OUT.iterdir())
    print(f'{len(manifest)} prints from {len(records)} captures ({len(history)} commits); {total / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
