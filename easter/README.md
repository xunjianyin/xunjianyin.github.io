# Easter eggs

The site has five hidden features. All live in this directory, load only when a visitor asks
for them, and leave the page exactly as it was when they end.

| Egg | Trigger | What it does |
| --- | --- | --- |
| Spira (first) | the footer's `*`, or typing `yxjgogogo` outside a text field | A full-screen canvas: the page's words wind into a logarithmic spiral, then a spiral of the research unwinds. |
| Lenses (second) | double-click or double-tap a name or a page title | The page is redrawn in place through one lens after another; Esc returns to normal. The active lens follows the reader to every page. |
| Murmuration (third) | typing `aiai` outside a text field | The page's letters loosen from their lines and fly as a flock on the page's own paper; as the noise cools the flock orders; Esc (or Return) sends the letters home, where words, lines and the page grow back. |
| Self-portrait (fourth) | typing `selfie` outside a text field, on the homepage | The photo flies into a figure, where a small program paints it from nothing, square by square, and rewrites itself as it goes (its improver too); when the portrait is done it paints its own program, until the picture is the program that paints it. The sound follows the process. |
| Print Gallery (fifth) | double-click or double-tap the homepage photo | The homepage photo holds the page as it was one version before, mounted like a print; that page's photo holds the one before; and on, through every version that looked different, to the first, whose photo holds the page you are on. The camera rests at each version, then dives into its photo, round the cycle until Return. A single click does nothing. |

While a lens is active, the keys `1` to `9` jump to that place in the cycle and `0` returns to
normal (not in text fields, not inside a paper's demo, not with a modifier). The last key
wins, also while a lens module is still loading. There is no visible hint for this.

While the flock is out, the wheel and the arrow keys cool (down) or warm (up) the noise, `End`
and `Home` set it to 0 and 1, and Esc or the Return button starts the flight home. A readout
of the noise and the order (bottom right, with Return) shows only on intent: the pointer in
that corner, a tap on the flock, or a key. The pointer scatters the letters near it. Under
reduced motion the flock never opens (the password does nothing).

While the self-portrait is out, Space pauses, the right arrow shows the rest of the test on
screen at once, M (or the Sound button) switches the sound, and Esc or the Return button
(bottom right with Sound, shown on intent as for the flock) sends the photo home. Under reduced motion it opens without the flight and stays still:
Next test (beside Return, always shown) or the right arrow advances one test at a time.

In the gallery the camera rests at each version (its wall label: date, how far back, the
commit's own words) and dives into the next, round the cycle until Return. The wheel (or a
vertical drag) dives faster or rises, the arrows and Page Up/Down move one version, Space stops
the camera's own dives, M (or the Sound button) switches the sound, and Esc, Home or Return
rush back up to the page as it is; a second Esc closes at once. Under reduced motion nothing
moves: one version at a time (its photo still holds the one before), Newer and Older (beside
Return, always shown) or the arrows.

## Where the site touches the eggs

The rest of the site knows only three things.

1. **The `<head>` snippet.** The first `<script>` in every page's `<head>` is one inline
   script, `LENSES_PREPAINT` in `scripts/build_papers.py` (the hand-written pages carry the same
   text; a `<meta charset>` may come before it).
   Before the first paint it reads the reader's lens from sessionStorage (`lenses-active`,
   `lenses-ground`), marks `html[data-lens-arriving]`, and, when the lens has a ground colour,
   hides the body over that colour (`<style id="lenses-prepaint">`). It names no lens.
2. **`easter/boot.js`.** `site-shell.js` loads it on the hand-written pages; a paper page loads
   it from its `<head>` (`LENSES_BOOT` in the same script). It binds every egg's triggers and
   brings the reader's lens to the page. Both Spira triggers (the footer's `*` and the typed
   password) and Murmuration's password live in it; Murmuration is bound where Spira is (pages
   with the site shell's footer), loads `easter/murmur/murmur.{js,css}` on its first opening,
   and a failed load is retried by the next trigger. Print Gallery is bound wherever a
   `[data-egg-trigger]` is (the homepage photo) and loads `easter/gallery/gallery.{js,css}` on its
   first opening, retried the same way; Self-portrait's password is bound where Spira's is and
   needs the photo too (it loads `easter/portrait/portrait.{js,css}`). If the boot fails to load, the page shows as it is (the arrival mark and
   the ground are removed), the password does nothing, and only the footer's `*` retries: it
   says "Could not load. Click to try again." and loads the boot again on the next click
   (then opens Spira, and the password works again). A click on `*` before the boot has
   loaded opens Spira once it is there.
3. **Markup.** `[data-lens-trigger]` on the names and titles (`site-shell.js`, `index.html`,
   the page `h1`s, the paper template), `[data-egg-trigger]` on the homepage photo (a double-click
   opens Print Gallery, which dives through it; Self-portrait paints it), the footer's `.easter-egg-footnote` button
   (`site-shell.js`), and the bio's key sentence, an unstyled `<span data-spira-key>` in
   `index.html`. Spira is bound only on pages with the site shell's footer (`#site-footer`), so
   paper pages have no Spira.

`shared-styles.css` and `papers/paper-page.css` keep one rule:
`[data-lens-trigger] { touch-action: manipulation; }` (`shared-styles.css` also names
`[data-egg-trigger]` in it).

Spira and Murmuration also read the page's content as they open (below).

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

## How Murmuration works

`murmur/murmur.js` captures the visible words of `#main-content` and the footer as Spira does
(exact computed font, colour and letter-spacing; one sprite per word in a device-pixel atlas),
then cuts each word sprite at its letters' advance boxes, so the slices tile the word exactly
and at rest the canvas is the page. Each slice is one agent; above 2600 letters (1500 on a
touch device) the agents are whole words instead, and words beyond 900 stay printed in place.
The model is topological boids with Vicsek noise (the header of `murmur.js` has the
equations): each letter flies with its seven nearest neighbours whatever their distance, as
starlings do (Ballerini et al., PNAS 2008), so a thinned flock holds together and a scattered
one regathers. Alignment with the seven, cohesion toward their centroid (growing with its
distance), separation from any closer than 14 px, a soft wall, a weak pull toward the viewport
centre, and an angular noise `0.4 pi eta^2` per 1/15 s step, where `eta` is the noise the
readout shows. `eta` cools from 1 to 0.04 over 3 to 30 s unless the reader sets it; the order
`phi` is the mean local polarization over each letter and its seven (about 0.35 in the gas,
above 0.95 when ordered; the crossover lies between `eta` 0.6 and 0.4). The seven are found
on a 24 px grid searched ring by ring, up to 144 px out. The flight home is a
damped spring toward the letter before this one in the text at the rest offset (so words
gather first, then lines), blending into the place itself, with an exact ease onto the glyphs
in the last 0.7 s; the swap (glyphs back, dialog gone) is one paint. A hidden tab pauses the
loop; a resize, `pagehide` or a change to reduced motion finishes at once. Stored: nothing.

## How Self-portrait works

`portrait/portrait.js` holds a program of ten lines, each one of a few values, shown as a
listing beside the painting:

| Part | Line | Values |
| --- | --- | --- |
| `paint` | `size` | the square's side in cells of the 160 x 160 canvas: 40, 28, 20, 14, 10, 7, 5, 4, 3, 2 |
| | `where` | anywhere; where the error is largest (a cell of a 16 x 16 error map, by its error); on the sitter's edges (a Sobel CDF); near the last square |
| | `colour` | random; the sitter at the square's centre; the sitter's mean under it (an integral image); the best fit, `(mean t - (1 - a) mean p) / a` |
| | `alpha` | 0.9, 0.7, 0.5, 0.35, 0.2, 0.1 |
| | `tries` | the best of 1, 2, 4, 8 or 16 proposals, drawn only if it lowers the error |
| `improve` | `every` | a test of paint every 200, 400, 800 or 1600 proposals (one window) |
| | `step` | an edit moves a line one notch, or to any value |
| | `pick` | any line, or the line edited longest ago |
| | `keep` | if no worse, or always |
| | `self` | a test of improve every 3, 6 or 12 tests of paint; this line is one of improve's |

A **test** forks the canvas: the current program and the edited one each paint one window
from the same canvas with the same random numbers, and the edit is kept if the edited copy's
squared error is no larger (or always, if `keep` says so). An edit to `improve` is judged the
same way over the next four windows of tests of paint. A change to how often improve edits
itself cannot show its effect inside its own test, so it is kept as no worse. The winning copy
goes on, so the display replays only the timeline that won; each verdict shows when its window
has been shown. The first program is crude (size 40, anywhere, the colour at the centre,
alpha 0.9). In a prototype of the same model outside the browser (mean of 20 seeds), the PSNR
after 48,000 proposals was 31.0 dB with edits to paint only and 34.6 dB with improve editing
itself as well.

The **finale** begins at 34 dB or after 60,000 proposals. The sitter becomes the program's own
text (`textOf`, drawn in bold 11 px monospace), and each copy in a test is judged against the
text of its own program, so an edit also changes the picture it must match. Once the painting
is close, edits cost more than they repay; after ten tests in a row that leave the program as
it was, with the painting at 19.5 dB or more against its text, it has **settled** (a fixed point: the picture is
the program that paints it). After 64,000 proposals without settling it stops, **unsettled**.
The caption says which. In 16 seeded runs all settled, at 19.5 to 24.5 dB, the finale
beginning between 28,000 and 62,000 proposals and ending by 114,000.

The simulation is a generator sliced by work (about 12,000 cells visited per slice) and kept
up to 16,000 proposals ahead of the display. The display draws each square as a `fillRect` on a
canvas of 160 x n device pixels (whole pixels per cell), shows 320 rising to 960 proposals a
second, and gives a test of paint at least 1.25 s on screen, falling to 0.65 s from 40,000
proposals on. The dialog covers the page with its paper; the photo's copy flies between the
page's photo and the frame (a transform, both ways). Closing restores the page exactly. A
hidden tab pauses it, `pagehide` closes it at once, and a resize only redraws the charts.
Stored: nothing of its own; the sound follows the site's preference (`localStorage`,
`spira-sound`, which Spira and the lenses read too), and M or the Sound button sets it.

**Sound** (Web Audio, synthesized; D major pentatonic, as Spira and the lenses) is a
sonification of the process, not an accompaniment:

| Sound | What it follows |
| --- | --- |
| the brush | band-passed noise, as loud as the paint laid each second (cells x alpha, to the power 0.35) and pitched by the squares' mean side: 280 Hz for side 40 up to about 2 kHz for side 2 |
| the beat | two sines on D3 (and A3 beneath); one is detuned by 2.4 Hz x the distance to the goal: `(34 - PSNR) / 16` against the photo, `(25 - PSNR) / 12` against its own text, so the beating slows as it nears. At a settled end it stops: the detuned sine fades and the other takes its share, so the still tone has one level whatever phase they met at |
| a verdict | kept: a bell on the line's degree (paint D5 to B5 in the order size, where, colour, alpha, tries; improve a dyad from D3); not kept: a damped pluck an octave lower; the `self` rule rewriting itself: its motif, then again twice, each time twice as fast and an octave higher |
| the finale, the end | a swell (D F# A E) as the sitter changes; a rising D add9 arpeggio when it settles, an open A6sus chord when it does not; five seconds later everything fades out over six, and the context is suspended |
| the flight | a band-passed noise sweep, up as the photo flies in, down as it flies home |

The boot creates the AudioContext inside the double-click (browsers start sound only in a
gesture); without one, the first pointer or key inside the figure starts it. Measured offline
(peaks): a kept bell 0.08, an edit to improve 0.12, the endings 0.15, the flight 0.03, a mixed
scene 0.17, as loud as Spira's cues (its melody 0.14).

## How Print Gallery works

**Prints.** `scripts/build_print_gallery.py` checks out every commit of the repository into a
temporary worktree, serves it on a port of its own (so nothing is cached across versions) and
captures the homepage in agent-browser at 1280 x 800 CSS px, device pixel ratio 2, with empty
storage and the light theme. It records the photo (the largest roughly square image near the
top), its border and whether it is drawn round. A version becomes a print when it looks
different from the last print (mean grey difference above 2.2 at 320 x 200) and from the live
page's look (HEAD's capture, or the newest cached one), and when its photo loaded. The kept
versions are captured again at device pixel ratio 3 and written to `gallery/prints/` as
`NN-<hash>-l.webp` (2048 x 1280) and `-s.webp` (512 x 320), with `manifest.json`, newest first:
date, commit subject, the photo's box inside its border as fractions of the page, round or not.
Rebuild after the homepage changes (about 13 minutes; captures are cached in `GALLERY_CACHE`,
and `--reuse` rebuilds from them):

```
uv run --with pillow python scripts/build_print_gallery.py
```

**The tunnel.** Every photo always holds the version before it, on a white mount (the print
fills 90 % of a square photo's width, 92 % of the largest 16:10 rectangle in a round one, with
a hairline), so the page, the print in its photo and the prints in theirs are on screen at once,
down to 2 px. Depth `d`: 0 the live page, 1 to N the prints, N + 1 the live page again (it
sits in the first version's photo), where the depth wraps. At an integer the level fits the
viewport; between k and k + 1 the camera zooms exponentially about the one point the two
framings share, eased in and out, so every dive starts and ends at rest and a turn is never
seen moving. Where a level does not cover the viewport (a window that is not 16:10), the level
around it is drawn, as it really is.

**The camera.** It rests 1.4 s on the live page while the photo opens (0.8 s), then dives 2.1 s
into each version and rests 1 s there, about 3 s a version. The wheel and a drag push it (the
push dies away over 0.45 s; the camera's own dives resume 1.4 s later from where it is). The
arrows seek one version in 1.3 s; Return seeks the live page in 1 s plus 0.07 s a version and
closes there. Rising back to the live page also closes.

**The live page** is the real DOM. While it is drawn (as the outer level, or inside the first
version's photo) the body carries a CSS transform (origin 0 0) that puts it where the camera
wants it, and the canvas leaves a hole there; the dialog is in the top layer, so the transform
never moves it. Elsewhere the body is moved off screen under the opaque canvas. The body's
`overflow`, `transform`, `transform-origin` and `will-change` and the root's
`scrollbar-gutter` are restored byte for byte. A resize while the live page shows closes at
once (the page reflows); otherwise it refits. A hidden tab stops the frames; `pagehide` closes
at once.

**Loading.** The manifest and every small print at the opening; the large prints for the level
before the camera, its own and the two after (the others are let go). A print is drawn from its
large file once it is wider than 1.1 x 512 device px. The camera never dives into a version
whose print has not arrived.

**Sound** (the site's preference, M or the Sound button), only on arrival: a music-box note
(a sine and three soft overtones, the high ones dying first, in a small room) for each version,
stepping down D major pentatonic from D6 as the camera goes back in time (an octave lower
beneath it when the year changes), and a rising D major arpeggio at today. Arrivals while
scrolling fast are at least 90 ms apart. Measured offline: a note's peak 0.07, the arpeggio
0.14. Stored: nothing of its own.

## Files

```
easter/
  README.md            this map
  boot.js              entry point on every page: every egg's triggers, the lens arrival
  spira/spira.js       Spira (window.SiteEasterEgg), loaded on the first opening
  spira/spira.css
  murmur/murmur.js     Murmuration (window.SiteMurmuration), loaded on the first opening
  murmur/murmur.css
  portrait/portrait.js Self-portrait (window.SitePortrait), loaded on its first opening
  portrait/portrait.css
  gallery/gallery.js   Print Gallery (window.SiteGallery), loaded on its first opening
  gallery/gallery.css
  gallery/prints/      the prints and manifest.json (built by scripts/build_print_gallery.py)
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
`SPIRA_VERSION` (`spira-vN`) in `boot.js`, when Murmuration changes, `MURMUR_VERSION`
(`murmur-vN`), when Self-portrait changes, `PORTRAIT_VERSION` (`portrait-vN`), and when Print
Gallery's code changes, `GALLERY_VERSION` (`gallery-vN`; new prints need no bump, the manifest
is fetched fresh); each is a
change to `boot.js`, so bump `lenses-vN`
as well, or returning visitors keep a cached `boot.js` that asks for the old egg (GitHub
Pages lets browsers cache files for 10 minutes). `tests/test_lenses_prepaint.py` checks that
the lenses versions agree; the browser suites read the versions from `window.SiteLensesBoot`
(`version`, `spiraVersion`, `murmurVersion`, `portraitVersion`, `galleryVersion`), so no test names a version.

## Tests

```
python3 -m unittest tests/test_lenses_prepaint.py          # the snippet, one lens list, versions
uv run --with tiktoken python -m unittest tests/test_cl100k_tokens.py   # the tokens lens's tokenizer
python3 -m http.server 8781 &                              # from the repository root
tests/run_easter_suites.sh                                 # every browser suite (about 6 min)
tests/run_easter_suites.sh lenses_media                    # one suite
```

`run_easter_suites.sh` runs `browser_lenses.js`, `browser_lenses_pages.js`,
`browser_lenses_media.js`, `browser_tokens.js`, `browser_murmur.js`, `browser_portrait.js`, `browser_gallery.js`, every `browser_lens_*.js`
and `browser_easter_egg.js`, each in its own agent-browser session, and prints one line per
suite.
Its header lists the environment variables (server URL, session prefix, time limit, results
directory). Two matter on a Mac. Headless Chrome renders no frames while the display sleeps
(no `requestAnimationFrame`, no IntersectionObserver callbacks, view transitions never end), so
a suite that starts while the display is asleep gets Chrome with
`--disable-gpu-vsync,--disable-frame-rate-limit`, which keeps frames coming; with the display
awake it gets no switches, since back-to-back frames stall Stardust's on the longest paper page
(set `AGENT_BROWSER_ARGS` to choose the switches yourself). And `EASTER_DPR=2` runs every suite
at a device pixel ratio of 2 (`EASTER_VIEWPORT`, default `1280 900`).
