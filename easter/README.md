# Easter eggs

The site has two hidden features. Both live in this directory, load only when a visitor asks
for them, and leave the page exactly as it was when they end.

| Egg | Trigger | What it does |
| --- | --- | --- |
| Spira (first) | the footer's `*`, or typing `yxjgogogo` outside a text field | A full-screen canvas: the page's words wind into a logarithmic spiral, then a spiral of the research unwinds. |
| Lenses (second) | double-click or double-tap a name or a page title | The page is redrawn in place through one lens after another; Esc returns to normal. The active lens follows the reader to every page. |
| Either, at random | double-click or double-tap the homepage photo | Spira, or the next lens (as a double-click on the name would), with even odds. A single click does nothing. |

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
   the page `h1`s, the paper template), `[data-egg-trigger]` on the homepage photo (a double-click
   opens Spira or the next lens at random; where Spira is not bound, the next lens), the footer's `.easter-egg-footnote` button
   (`site-shell.js`), and the bio's key sentence, an unstyled `<span data-spira-key>` in
   `index.html`. Spira is bound only on pages with the site shell's footer (`#site-footer`), so
   paper pages have no Spira.

`shared-styles.css` and `papers/paper-page.css` keep one rule:
`[data-lens-trigger] { touch-action: manipulation; }` (`shared-styles.css` also names
`[data-egg-trigger]` in it).

Spira also reads the site's content as it opens (below).

## Where Spira's content comes from

Live, read when Spira opens:

- **The page's words.** The visible text of `#main-content` and the footer becomes the text
  spiral, and the page at its centre.
- **The key sentence.** The words inside `[data-spira-key]` (the homepage bio) glint warm in the
  hero frame. A page without the marker has no glint.
- **The papers.** `publications` in `data.js`. A publication is drawn when one of its `topics` is
  a theme id (`evaluation`, `knowledge`, `grounding`, `reasoning`, `improvement`; the first such
  topic is its theme) and it has a year: the last `20xx` in `venue`, else `year={...}` in
  `citation`. Others (CEER, with no topics) are not drawn. The years set the span: one turn per
  year from the earliest paper's year to the latest's, the end of the latest at radius 1, then
  the unwritten `next` turn. Title and venue come from `data.js`. A paper with a link to
  `papers/<slug>.html` is local: its plate links to that page. Any other paper links to its
  `Paper` link (else its first link) in a new tab. On a page without `data.js` (photography,
  the blogs), Spira loads it once from the site root before it opens; if that fails, the footer's
  `*` says "Could not load. Click to try again." and the next click tries again.
- **The takeaways.** A local paper's plate shows the `.paper-takeaway` sentence of its page,
  fetched when the plate opens (or when its star or index link is hovered) and kept while the
  page is open. Until it arrives the plate keeps its room.
- **The label on the spiral.** A curated short name (below), else an optional `short` field on
  the publication in `data.js` (for example `short: "X-Tree"`), else the title before its `:`
  when that has at most 30 characters, else a phrase cut from the title: a leading `-ing` word
  dropped, ending before the first preposition (`by`, `for`, `with`, `via`, `in`, `on`, ...),
  then shortened to whole words that fit.

Curated in `spira/spira.js`:

- `THEMES`: the five themes, their colours and their questions.
- `QUESTIONS`: the ten open questions the shooting stars carry.
- `GHOST_WORDS`: the four phrases on the unwritten turn. Each must occur on the homepage (the
  suite checks it, so a bio edit that drops one is caught).
- `SHORT_NAMES`: the short names the owner chose, keyed by slug (a paper without a page here is
  keyed by its title, the part before any `:`, in lowercase with hyphens). Their order is also
  the order of those papers within a (year, theme) cell; any other paper follows them, oldest
  first (the reverse of `data.js`, which lists the newest first).
- The score's timing: `SCORE_YEAR_BASE` plus `SCORE_PER_PAPER` for each paper of the year.

Caught open questions last for one visit (`sessionStorage`, `spira-wishes`); the sound
preference stays (`localStorage`, `spira-sound`).

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
| `hideGlyphs(on)`, `layer(kind)` | transparent text in the scope (also the text of `::before`, `::after` and `::marker`, below); a `fixed` or `page` layer that never takes the pointer |
| `bell(step)`, `frame(fn)` | the soft bell; one shared animation loop (it pauses while the tab is hidden) |
| `captionGround(colour)` | the caption's halo ground, set at once (for a ground that changes while the caption shows; `null` returns to the ground the core reads) |
| `onContentChange(fn)`, `onLayoutChange(fn)` | the scope's content changed; its layout may have moved without a DOM change (images or fonts loaded, resizes, `<details>` toggles). Both watch from the ctx's creation: a change before the lens subscribes reaches its first subscription |
| `media(options)`, `mediaKit()` | the media helper's handle (below; `fixed: true` also redraws the photography lightbox); the helper's utilities alone |

After `exit()` resolves the core removes the layers, the stylesheet, `lens-<id>` classes and
the glyph class, disposes media handles, and restores the root attributes. After every exit,
animated or instant, it also finishes the CSS transitions still running on `<html>`, `<body>`
and in the scope, and the CSS animations named `lens-*`, since Chrome lets a running transition
outlive the rule that declared it. A lens must not change the page's text or elements.

What the core does for every lens, so a lens needs no workaround of its own:

- **Hidden tabs.** `enter()` fails, and `exit()` is cut short, only after 20 s and 5 s of
  *visible* time; a hidden tab (where `ctx.frame` pauses) stops that clock. A reset's grace
  (1.5 s, or 0.8 s for an instant reset such as `pagehide`) counts wall-clock time.
- **Root attributes.** A lens owns only its class tokens on `<html>` and `<body>` (`lens-*`,
  `lenses-*`) and the custom properties (`--*`) it added to their style. The rest is the
  page's, which may change it while a lens is on (the photography lightbox locks the body's
  scroll while it is open). After the exit an attribute the page did not change is put back
  byte for byte; one it changed keeps the page's value with only the lens's parts removed.
  Lens parts the core had to remove (beyond the `lens-<id>` classes) are warned about once.
- **Keys and page modals.** While a dialog, an `aria-modal` element or the photography
  lightbox is open, Esc and the digit keys are the page's: Esc closes the lightbox and leaves
  the lens on.
- **The caption.** A `caption(ctx)` that returns `null` (not ready) is asked again every
  150 ms while `enter()` runs and shows as soon as it answers. It sits by the trigger over no
  text: beside it, above it (9 px clear of the trigger's glyphs, measured in its font, and of
  what precedes it), beside its last line, in the page margin, or centred in the free band of
  the viewport nearest the trigger (on a paper page, between the nav and the eyebrow); only
  when none fits is it squeezed above the trigger, and as the last resort it is a subtitle at
  the viewport's foot (on a phone, a caption of three lines, such as Tokens' with its count,
  on a paper page or the publications page). While a view
  transition runs (`document.startViewTransition`) the caption keeps its place and is placed
  again when it has finished. Where it lies over text, a rounded halo of the ground behind its
  glyphs (rings of small text-shadows, not a mitred stroke) keeps it legible: the page's
  background under it or the lens's `ground`, whichever the caption's colour contrasts with; a
  lens can name it with `--lenses-caption-ground`, as it names the caption's colour with
  `--lenses-caption-color`, or set it at once with `ctx.captionGround(colour)` (a ground that
  changes every frame).
- **A ground that follows the theme.** `ground` may be a getter; the core stores it when the
  lens has entered and again when `html[data-theme]` changes while the lens is active.
- **Hidden glyphs.** `hideGlyphs(true)` also makes the text of `::before` and `::after`
  transparent (it inherits `-webkit-text-fill-color`), and the text of `::marker` (list numbers
  and letters), which Chrome does not let a lens restore. A lens that hides glyphs draws those
  too (Stardust draws the markers) or accepts that they vanish; bullet shapes stay.

## Adding a lens

1. Write `easter/lenses/<id>.js` (and `<id>.css` if it has styles, with `css: true`). Copy the
   shape of an existing lens; register with `order` equal to its place in the cycle.
2. Add the id to `LENSES` in `easter/lenses/core.js`. This is the only list of lenses on the
   site: the `<head>` snippet, the boot and the stylesheets do not change.
3. Give it a `ground`: the `#rrggbb` colour a page is painted with while the lens arrives on it
   (the colour the lens makes the page), or `null` when the page should show at once. A getter
   may give the colour for the current theme (the core stores it again on a theme change).
   Optionally give it `supported()` to decline a device or page.
4. Add a browser suite `tests/browser_lens_<id>.js` if the lens has behaviour of its own;
   `tests/run_easter_suites.sh` picks it up. The core suites iterate every registered lens.
5. Bump the version (below).

## The media helper

`lenses/media.js` lets a lens redraw every image of the page without touching it.
`const media = await ctx.media({ render, ground, select, fixed })` lays one canvas over each loaded
image near the viewport (class `lenses-media`, `data-kind` `photo` or `graphic`), in a page
layer, clipped to scrolling ancestors. `render(source)` receives the image already drawn as
displayed and returns the canvas to show (or `null`). The handle offers `overlays`, `ready`
(resolved when the overlays near the viewport exist, or at once when exit begins, so `enter()`
may await it), `refresh()`, `each(fn)` and `dispose()`; the core disposes it after the exit.
After a resize or a zoom, overlays are drawn again at their new size as they come near.
Renders are made one image at a time, nearest first by where the images are when the next is
picked (those in the viewport first), windowed with IntersectionObservers and cached (the
renders off screen in a 64 MB LRU). Up to two file decodes run at once ahead of the renders,
each photo's sample for classification beside its display-size decode, so one heavy file does
not hold up the photos after it. After a jump (a fragment link) the cached renders of images
now on screen are put back in the scroll event, before the paint. `media.overlays` and its
records are live: when an image is drawn again, `record.canvas` is swapped in place, so keep
your own reference to compare canvases. `media.kindOf(img)` gives the helper's classification
of an image it has classified (`null` before), so a lens need not `sample()` it again. The
utilities `readable`, `draw`, `drawAsync`, `plan`, `sample` and `classify` are also available
to lenses that only need pixels, through
`ctx.mediaKit()` (which loads the helper without making overlays); `plan` gives the crop and
size the helper draws an image at, so a lens can decode the file again at exactly that crop.
The header of `media.js` documents the details and the classification thresholds.

Images inside a `position: fixed` container are skipped unless the lens passes `fixed: true`.
Then they are redrawn too, also outside the scope (the photography lightbox, beside
`#main-content`): their overlays go in a fixed layer (`lenses-media-layer lenses-media-fixed`,
viewport coordinates) stacked just above the container, follow it as it opens, changes photo
and closes, never take the pointer, and are cut out along the glyphs of the controls the
container draws over the photo (the lightbox's arrows on a phone), so those stay visible. A
lightbox already open when the handle is made is drawn at once. When its image asks for another
file (next, previous) the old overlay is hidden before the next paint and the new render shows
when it is ready (no old photo stretched over the new one's box); when it closes, its overlay
goes before the next paint. These overlays are drawn at up to 3.2 MP (other images 1.6 MP), so
the lightbox is sharp at a DPR of 2.

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
Its header lists the environment variables (server URL, session prefix, time limit, results
directory). Two matter on a Mac. Headless Chrome renders no frames while the display sleeps
(no `requestAnimationFrame`, no IntersectionObserver callbacks, view transitions never end), so
a suite that starts while the display is asleep gets Chrome with
`--disable-gpu-vsync,--disable-frame-rate-limit`, which keeps frames coming; with the display
awake it gets no switches, since back-to-back frames stall Stardust's on the longest paper page
(set `AGENT_BROWSER_ARGS` to choose the switches yourself). And `EASTER_DPR=2` runs every suite
at a device pixel ratio of 2 (`EASTER_VIEWPORT`, default `1280 900`).
