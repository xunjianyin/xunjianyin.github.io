# Easter eggs

The site has two hidden features. Both live in this directory, load only when a visitor asks
for them, and leave the page exactly as it was when they end.

| Egg | Trigger | What it does |
| --- | --- | --- |
| Spira (first) | the footer's `*`, or typing `yxjgogogo` outside a text field | A full-screen canvas: the page's words wind into a logarithmic spiral, then a spiral of the research unwinds. |
| Lenses (second) | double-click or double-tap a name or a page title | The page is redrawn in place through one lens after another; Esc returns to normal. The active lens follows the reader to every page. |

While a lens is active, the keys `1` to `9` jump to that place in the cycle and `0` returns to
normal (not in text fields, not inside a paper's demo, not with a modifier). The last key
wins, also while a lens module is still loading. There is no visible hint for this.

## Where the site touches the eggs

The rest of the site knows only three things.

1. **The `<head>` snippet.** The first `<script>` in every page's `<head>` is one inline
   script, `LENSES_PREPAINT` in `scripts/build_papers.py` (the hand-written pages carry the same
   text; a `<meta charset>` may come before it).
   Before the first paint it reads the reader's lens from sessionStorage (`lenses-active`,
   `lenses-ground`), marks `html[data-lens-arriving]`, and, when the lens has a ground colour,
   hides the body over that colour (`<style id="lenses-prepaint">`). It names no lens.
2. **`easter/boot.js`.** `site-shell.js` loads it on the hand-written pages; a paper page loads
   it from its `<head>` (`LENSES_BOOT` in the same script). It binds both eggs' triggers and
   brings the reader's lens to the page. Both Spira triggers (the footer's `*` and the typed
   password) live in it. If it fails to load, the page shows as it is (the arrival mark and
   the ground are removed), the password does nothing, and only the footer's `*` retries: it
   says "Could not load. Click to try again." and loads the boot again on the next click
   (then opens Spira, and the password works again). A click on `*` before the boot has
   loaded opens Spira once it is there.
3. **Markup.** `[data-lens-trigger]` on the names and titles (`site-shell.js`, `index.html`,
   the page `h1`s, the paper template), and the footer's `.easter-egg-footnote` button
   (`site-shell.js`). Spira is bound only on pages with the site shell's footer
   (`#site-footer`), so paper pages have no Spira.

`shared-styles.css` and `papers/paper-page.css` keep one rule:
`[data-lens-trigger] { touch-action: manipulation; }`.

## Files

```
easter/
  README.md            this map
  boot.js              entry point on every page: both eggs' triggers, the lens arrival
  spira/spira.js       Spira (window.SiteEasterEgg), loaded on the first opening
  spira/spira.css
  lenses/core.js       the lenses core (window.SiteLenses): cycle, contract, caption, bell,
                       one animation loop, exact restoration; its header is the lens contract
  lenses/core.css      hidden glyphs, layers, caption, the arrival's fade
  lenses/media.js      the media helper (window.SiteLensesMedia), loaded on first use
  lenses/<id>.js       one module per lens, loaded the first time it is needed
  lenses/<id>.css      its stylesheet (attached while the lens is active)
  lenses/data/cl100k.txt   the tokenizer ranks for the tokens lens (binary in .gitattributes;
                       built by scripts/build_cl100k.py)
```

## The lens contract, in short

A lens module calls `SiteLenses.register({ id, order, numeral, label, line, ground, css,
supported, enter, exit, arrive, caption })`. The full contract is the header of
`lenses/core.js`. The core gives each activation a `ctx`:

| `ctx` member | Purpose |
| --- | --- |
| `page`, `arriving`, `scope`, `root`, `pointer` | where the lens runs: page kind, arrival with a page, the nav/main/footer elements, the site root URL, the pointer |
| `motion`, `instant`, `signal` | reduced motion (also true during an instant reset), the instant flag, an AbortSignal that fires when exit begins |
| `hideGlyphs(on)`, `layer(kind)` | transparent text in the scope; a `fixed` or `page` layer that never takes the pointer |
| `bell(step)`, `frame(fn)` | the soft bell; one shared animation loop |
| `onContentChange(fn)`, `onLayoutChange(fn)` | the scope's content changed; its layout may have moved without a DOM change (images or fonts loaded, resizes, `<details>` toggles) |
| `media(options)`, `mediaKit()` | the media helper's handle (below); the helper's utilities alone |

After `exit()` resolves the core removes the layers, the stylesheet, `lens-<id>` classes and
the glyph class, disposes media handles, and restores the root attributes. A lens must not
change the page's text or elements.

## Adding a lens

1. Write `easter/lenses/<id>.js` (and `<id>.css` if it has styles, with `css: true`). Copy the
   shape of an existing lens; register with `order` equal to its place in the cycle.
2. Add the id to `LENSES` in `easter/lenses/core.js`. This is the only list of lenses on the
   site: the `<head>` snippet, the boot and the stylesheets do not change.
3. Give it a `ground`: the `#rrggbb` colour a page is painted with while the lens arrives on it
   (the colour the lens makes the page), or `null` when the page should show at once.
   Optionally give it `supported()` to decline a device or page.
4. Add a browser suite `tests/browser_lens_<id>.js` if the lens has behaviour of its own;
   `tests/run_easter_suites.sh` picks it up. The core suites iterate every registered lens.
5. Bump the version (below).

## The media helper

`lenses/media.js` lets a lens redraw every image of the page without touching it.
`const media = await ctx.media({ render, ground, select })` lays one canvas over each loaded
image near the viewport (class `lenses-media`, `data-kind` `photo` or `graphic`), in a page
layer, clipped to scrolling ancestors. `render(source)` receives the image already drawn as
displayed and returns the canvas to show (or `null`). The handle offers `overlays`, `ready`
(resolved when the overlays near the viewport exist, or at once when exit begins, so `enter()`
may await it), `refresh()`, `each(fn)` and `dispose()`; the core disposes it after the exit.
After a resize or a zoom, overlays are drawn again at their new size as they come near.
Renders are made one image per task, windowed with IntersectionObservers and cached (the
renders off screen in a 64 MB LRU). The utilities `readable`, `draw`, `drawAsync`, `sample`
and `classify` are also available to lenses that only need pixels, through
`ctx.mediaKit()` (which loads the helper without making overlays). The header of `media.js`
documents the details and the classification thresholds.

Images with `visibility: hidden` are skipped like images that are not rendered. A lens that
wants the original images hidden under its overlays must use `opacity: 0` (or pass `ground`,
so the overlays are opaque), never `visibility: hidden`.

## Versions

Asset URLs carry a cache key. When any file under `lenses/` changes, or `boot.js` itself,
bump `lenses-vN` in `lenses/core.js`, `boot.js`, the `site-shell.js?v=` query of every
hand-written page, the boot URL in `site-shell.js` and `LENSES_BOOT` in
`scripts/build_papers.py`, then run `python3 scripts/build_papers.py`. When Spira changes, bump
`SPIRA_VERSION` (`spira-vN`) in `boot.js`; that is a change to `boot.js`, so bump `lenses-vN`
as well, or returning visitors keep a cached `boot.js` that asks for the old Spira (GitHub
Pages lets browsers cache files for 10 minutes). `tests/test_lenses_prepaint.py` checks that
the lenses versions agree; the browser suites read both versions from `window.SiteLensesBoot`
(`version`, `spiraVersion`), so no test names a version.

## Tests

```
python3 -m unittest tests/test_lenses_prepaint.py          # the snippet, one lens list, versions
uv run --with tiktoken python -m unittest tests/test_cl100k_tokens.py   # the tokens lens's tokenizer
python3 -m http.server 8781 &                              # from the repository root
tests/run_easter_suites.sh                                 # every browser suite (about 6 min)
tests/run_easter_suites.sh lenses_media                    # one suite
```

`run_easter_suites.sh` runs `browser_lenses.js`, `browser_lenses_pages.js`,
`browser_lenses_media.js`, `browser_tokens.js`, every `browser_lens_*.js` and
`browser_easter_egg.js`, each in its own agent-browser session, and prints one line per suite.
Its header lists the environment variables (server URL, session prefix, time limit).
