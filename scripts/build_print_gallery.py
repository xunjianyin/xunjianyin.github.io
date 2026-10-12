"""Build the Print Gallery's prints: for every version of the site that looked different, its
homepage as it first appeared, with the place of its photo (the portal the gallery dives
through).

    uv run --with pillow python scripts/build_print_gallery.py            # capture and build
    uv run --with pillow python scripts/build_print_gallery.py --reuse    # rebuild from the captures

1. Every commit (oldest first) is checked out into a temporary worktree, served on its own
   port (so no file is cached across versions) and its homepage captured in agent-browser at
   1280 x 800 CSS px, device pixel ratio 2, light theme, empty storage. A version is kept when
   its capture differs visibly from the last kept one and from HEAD's (the live page is the
   gallery's own level, so HEAD's look is never a print), and when its photo loaded.
2. The kept versions are captured again at device pixel ratio 3, for sharpness when a print
   fills the screen.

3. Each version's portrait is taken from the repository at that commit, at full resolution
   (figures/me-320.jpg is figures/me.png made small, so me.png stands in for it), and the
   gallery dives into its eye: EYES gives, per portrait file (the first 8 hex digits of its git
   blob), the centre of the viewer's left eye and the iris's radius, as fractions of the image
   (read by hand and refined to the darkest disc). A new portrait needs a new entry.

Writes, under easter/gallery/prints/: NN-<hash>-l.webp (2048 x 1280), NN-<hash>-s.webp
(512 x 320), portrait-<blob>.webp (at most 1400 px) and manifest.json (newest first: date,
commit subject, the photo's inner box (inside its border) as fractions of the page, round or
not, its portrait; then the portraits' eyes, and the live page's portrait). Raw captures are
cached in GALLERY_CACHE, so a rebuild needs no browser.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
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
LARGE = (2048, 1280)
SMALL = (512, 320)
PORTRAIT_MAX = 1400      # px: a portrait's longer side
# The viewer's left eye, per portrait (blob prefix): centre (x, y) and iris radius, as fractions
# of the image's width and height (the radius of its width).
EYES = {
    'e613dbb4': {'eye': [0.4532, 0.3973], 'iris': 0.0064},    # figures/me.png (and me-320.jpg), from 2026-01
    'acf51dca': {'eye': [0.48428, 0.4192], 'iris': 0.0047},   # figures/me.jpg, by the lake
    'bfc9eb8a': {'eye': [0.38392, 0.43587], 'iris': 0.0118},  # figures/me.jpg, the city
    '77587269': {'eye': [0.4496, 0.4597], 'iris': 0.0064},    # figures/me.jpg, the first versions
}
STANDS_IN = {'figures/me-320.jpg': 'figures/me.png'}
DIFF_KEEP = 2.2          # mean absolute difference (0-255, grey, 320 x 200) that counts as a new look
SETTLE_MS = 1800         # after load: fonts, images, the lists main.js fills

# Finds the homepage photo (the largest roughly square image near the top): its box in CSS px
# of the viewport, its border width, whether it is drawn round; and the page's background.
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
      best = { x: b.left, y: b.top, w: b.width, h: b.height, border: parseFloat(cs.borderTopWidth) || 0,
        round: radius >= 0.4 * Math.min(b.width, b.height) || /50%%/.test(cs.borderRadius) };
    }
  }
  const bg = [document.body, document.documentElement].map(e => getComputedStyle(e).backgroundColor).find(c => c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) || 'rgb(255, 255, 255)';
  return JSON.stringify({ portal: best, background: bg, title: document.title, scrollY });
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


class Browser:
    """One agent-browser session at one device pixel ratio, and a worktree to serve from."""

    def __init__(self, dpr: int):
        self.dpr = dpr
        self.worktree = Path(tempfile.mkdtemp(prefix='print-gallery-wt-'))

    def __enter__(self) -> 'Browser':
        run(['git', '-C', str(ROOT), 'worktree', 'add', '--detach', '-f', str(self.worktree), 'HEAD'])
        subprocess.run(['agent-browser', '--session', SESSION, 'close'], capture_output=True)
        ab('open', 'about:blank')
        ab('set', 'viewport', str(VIEWPORT[0]), str(VIEWPORT[1]), str(self.dpr))
        return self

    def __exit__(self, *exc) -> None:
        subprocess.run(['agent-browser', '--session', SESSION, 'close'], capture_output=True)
        subprocess.run(['git', '-C', str(ROOT), 'worktree', 'remove', '--force', str(self.worktree)], capture_output=True)
        shutil.rmtree(self.worktree, ignore_errors=True)

    def capture(self, hash_: str) -> dict:
        """Capture one version (cached by hash and device pixel ratio)."""
        stem = hash_ if self.dpr == 2 else f'{hash_}@{self.dpr}'
        shot = CACHE / f'{stem}.png'
        meta = CACHE / f'{stem}.json'
        if shot.exists() and meta.exists():
            return json.loads(meta.read_text())
        run(['git', '-C', str(self.worktree), 'checkout', '-q', '--force', hash_])
        port = free_port()
        server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(self.worktree)],
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
    p = record['portal']
    scale = shot.width / VIEWPORT[0]
    box = tuple(round(v * scale) for v in (p['x'] + 0.2 * p['w'], p['y'] + 0.2 * p['h'], p['x'] + 0.8 * p['w'], p['y'] + 0.8 * p['h']))
    grey_ = ImageStat.Stat(shot.convert('L').crop(box))
    hsv = ImageStat.Stat(shot.convert('HSV').crop(box))
    return grey_.mean[0] > 215 and hsv.mean[1] < 20


def portrait_of(commit: str) -> tuple[str, str]:
    """The homepage photo's file at a commit (its full-resolution stand-in) and its blob."""
    html = run(['git', '-C', str(ROOT), 'show', f'{commit}:index.html']).stdout
    path = re.search(r'<img[^>]*src="(figures/[^"]+)"', html).group(1)
    path = STANDS_IN.get(path, path)
    blob = run(['git', '-C', str(ROOT), 'rev-parse', f'{commit}:{path}']).stdout.strip()
    return path, blob


def write_portrait(blob: str) -> None:
    out = OUT / f'portrait-{blob[:8]}.webp'
    if out.exists():
        return
    data = subprocess.run(['git', '-C', str(ROOT), 'cat-file', 'blob', blob], check=True, capture_output=True).stdout
    image = Image.open(io.BytesIO(data)).convert('RGB')
    image.thumbnail((PORTRAIT_MAX, PORTRAIT_MAX), Image.LANCZOS)
    image.save(out, 'WEBP', quality=86, method=6)


def inner_box(record: dict) -> list[float]:
    """The photo's box inside its border, as fractions of the 1280 x 800 page."""
    p = record['portal']
    b = p.get('border', 0)
    w, h = VIEWPORT
    return [round(v, 6) for v in ((p['x'] + b) / w, (p['y'] + b) / h, (p['w'] - 2 * b) / w, (p['h'] - 2 * b) / h)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--reuse', action='store_true', help='build from the cached captures only')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    history = commits()
    head = history[-1][0]

    # 1. Every version at DPR 2, to find the ones that look different.
    if not args.reuse:
        with Browser(2) as browser:
            for i, (hash_, date, _) in enumerate(history):
                try:
                    record = browser.capture(hash_)
                except Exception as error:  # a broken old version: skip it, say so
                    print(f'{i + 1:3d}/{len(history)} {hash_[:7]} {date} failed: {error}', flush=True)
                    continue
                print(f'{i + 1:3d}/{len(history)} {hash_[:7]} {date} portal={record.get("portal")}', flush=True)
    records: dict[str, dict] = {}
    for hash_, date, subject in history:
        meta = CACHE / f'{hash_}.json'
        if meta.exists() and (CACHE / f'{hash_}.png').exists():
            records[hash_] = {**json.loads(meta.read_text()), 'date': date, 'message': subject}
    # The live page's look: HEAD's capture, or (rebuilding from the cache after commits that did
    # not touch the homepage) the newest capture there is.
    newest = next((h for h, _, _ in reversed(history) if h in records), None)
    head = head if head in records else newest or head
    head_grey = grey(CACHE / f'{head}.png') if head in records else None
    kept: list[dict] = []
    last = None
    for hash_, _, _ in history:
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
    kept.reverse()   # newest first

    # 2. The kept versions at DPR 3.
    dpr = 3
    missing = [r for r in kept if not (CACHE / f'{r["hash"]}@{dpr}.png').exists()]
    # (The kept versions at DPR 3: sharp enough to fill a screen.)
    if missing and args.reuse:
        sys.exit(f'{len(missing)} versions have no DPR {dpr} capture; run without --reuse.')
    if missing:
        with Browser(dpr) as browser:
            for record in missing:
                browser.capture(record['hash'])
                print(f'dpr {dpr}: {record["hash"][:7]} {record["date"]}', flush=True)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    manifest = []
    eyes: dict[str, dict] = {}

    def eye_of(commit: str) -> str:
        path, blob = portrait_of(commit)
        key = blob[:8]
        if key not in EYES:
            sys.exit(f'{commit[:7]}: no EYES entry for {path} (blob {key}); add its eye to EYES.')
        write_portrait(blob)
        eyes[key] = EYES[key]
        return key

    for n, record in enumerate(kept, start=1):
        sharp = json.loads((CACHE / f'{record["hash"]}@{dpr}.json').read_text())
        image = Image.open(CACHE / f'{record["hash"]}@{dpr}.png').convert('RGB')
        base = f'{n:02d}-{record["hash"][:7]}'
        image.resize(LARGE, Image.LANCZOS).save(OUT / f'{base}-l.webp', 'WEBP', quality=74, method=6)
        image.resize(SMALL, Image.LANCZOS).save(OUT / f'{base}-s.webp', 'WEBP', quality=80, method=6)
        manifest.append({'file': base, 'hash': record['hash'][:7], 'date': record['date'], 'message': record['message'],
                         'portal': inner_box(sharp), 'round': bool(sharp['portal'].get('round')), 'portrait': eye_of(record['hash'])})
    live = eye_of(history[-1][0])
    (OUT / 'manifest.json').write_text(json.dumps({'viewport': list(VIEWPORT), 'prints': manifest, 'live': {'portrait': live}, 'portraits': eyes}, indent=1) + '\n')
    total = sum(f.stat().st_size for f in OUT.iterdir())
    print(f'{len(manifest)} prints from {len(records)} captures ({len(history)} commits); {total / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
