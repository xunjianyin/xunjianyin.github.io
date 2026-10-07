/**
 * Lens VIII · Shannon, 1951: "Each letter is as dark as it was surprising."
 *
 * Claude Shannon's "Prediction and Entropy of Printed English" (Bell System Technical Journal
 * 30, 1951) measured how predictable English is by asking people to guess a text's next
 * letter. Here a small predictor reads the page from top to bottom and every letter is inked
 * by its surprisal, -log2 p(letter | the text before it): letters the model saw coming fade,
 * letters it did not stay black. Everything shown is computed live from the page; nothing is
 * invented. Two things to look for: the owner's name in an author list fades after its first
 * occurrences, and word endings fade while word beginnings stay dark.
 *
 * The model is PPM (prediction by partial matching; Cleary and Witten, 1984) with escape method
 * C (Moffat, 1990), exclusion and update exclusion, context orders 5 down to 0, and a uniform
 * fallback over the alphabet of 65,536 UTF-16 code units (an astral character is read as its
 * two surrogates). It reads the scope's visible text in document order: the nav, main and the
 * footer; text that is not rendered (the body of a closed <details> among it), aria-hidden
 * subtrees, scripts, styles, form controls, inline SVG and editable text are skipped.
 * Whitespace is collapsed as CSS renders it, and a change of block reads as one newline. Each
 * code unit is scored before the model learns it: in a context of order k with n counts over
 * q distinct symbols (symbols seen in a longer context that escaped are excluded), a seen
 * symbol x costs log2((n + q) / c(x)) and an escape log2((n + q) / q); a symbol no context
 * predicts costs log2(65,536 - symbols seen). Only the contexts from the one that coded the
 * symbol upwards learn it. The caption's note reports the page's bits per character (the total
 * over every code unit read, newlines included). All the work (reading the page, the model,
 * the runs) is done in slices of SLICE_MS; the model takes about 40 ms for 70 k characters on
 * a 2020 Mac (the longest paper page reads 24 k).
 *
 * Drawing, without touching the DOM: the CSS Custom Highlight API. Surprisal is quantised onto
 * a fixed scale, level = clamp(floor(bits), 0, 7). A colour pair is a text colour over the
 * background behind it (computed values, quantised: a pair whose ink and ground both lie within
 * PAIR_MERGE of OKLab distance of a commoner pair joins it). For each of the COMBOS_MAX commonest
 * pairs and each level below 7 there is one Highlight of StaticRanges, whose ::highlight() rule
 * mixes the ink toward the ground in OKLab: ink(level) = floor + (1 - floor) * (level / 7)^0.5.
 * The curve is concave, so the common one- and two-bit letters stay at mid tone and only the
 * letters the model was sure of reach the floor. The floor keeps every letter readable: level 0
 * keeps a WCAG contrast ratio of CONTRAST_MIN (3:1) against its ground (a pair that has less of
 * its own, a pale grey, keeps its own ratio to the power CONTRAST_LOW), and at least the pair's
 * own ratio to the power CONTRAST_KEEP, so a near-black heading stays darker than grey body
 * text. Level 7 keeps the original colour (no highlight). Rarer pairs (a fraction of a percent
 * of the letters on the paper pages) keep their own colour. The rules go into this lens's own
 * stylesheet. Ranges merge runs of equal level within a text node (a space joins a run), and
 * exist only for the blocks within NEAR_SCREENS of the viewport (an IntersectionObserver),
 * since the browser rebuilds every highlight marker on any style change: their count is what
 * costs. A jump (Home or End, the scrollbar, a script's scrollTo) lands before the observer
 * reports: a scroll handler (scroll events run before the frame is painted) adds the blocks it
 * lands on at once, from block positions measured at each commit and layout change. A fragment
 * link (a paper's section links) scrolls later, in the next frame's layout pass, and reports
 * its scroll a frame after that: a frame callback measures the blocks again (the read makes
 * the jump) and adds the ones it lands on before that frame is painted. A link under the
 * mouse, or with the keyboard focus, drops its highlights, so the site's own hover and focus
 * colours show on all of its letters.
 *
 * Images, through ctx.media: what the predictor could not predict. Each pixel's luminance is
 * predicted by the median edge detector of LOCO-I / JPEG-LS (Weinberger, Seroussi and Sapiro,
 * 2000): from the left a, above b and upper-left c, min(a, b) if c >= max(a, b), max(a, b) if
 * c <= min(a, b), else a + b - c. |error| goes through a log curve, its tone (up to
 * RESIDUAL_FLOOR: none, RESIDUAL_FULL and more: all). A photograph is drawn by its residual
 * alone: it becomes a drawing of its edges and textures, a flat sky stays blank, and a faint
 * hairline keeps its footprint. Its canvas holds the tones as greys (255 * (1 - tone)); an SVG
 * ink filter (feComponentTransfer, one per colour pair, in the lens's own layer) paints them in
 * the page's text colour mixed toward the colour behind the image (where that colour does not
 * read on it, a pale or a deep grey), so a theme change rewrites a filter, not a canvas. Where
 * the ink spans less than PHOTO_SPAN of OKLab lightness off the ground (the dark theme's grey on
 * grey: 0.62) the tone curve is steepened, so a given |error| stands as far off the ground in
 * either theme. The photography lightbox's photograph (position: fixed, outside the scope;
 * media option fixed) is drawn the same way, pale on its black backdrop. A photograph shown
 * smaller than SMALL_PHOTO (the portrait) is read through a 1-2-1 blur first: at that size its
 * JPEG noise is as large as its detail. A graphic (a figure, a diagram, a chart, a screenshot)
 * fades toward its own ground, the commonest colour of its border, not the page's: each pixel
 * keeps GRAPHIC_FLOOR of its difference from that ground where it was predictable and all of
 * it where it was not; a pixel that stands far off the ground (a solid stroke, a bold label)
 * keeps its ink however predictable its interior was, and a grey line or label keeps the
 * letters' floor (floorContrast of its own contrast, so a 2.4:1 grey keeps 2:1), while a pale
 * tint still fades. A white figure stays white, with crisp contours, solid labels and pale
 * fills, in either theme. Images that cannot be read (cross-origin badges) keep their own look.
 * While the lens is on (and while it arrives with a page) the stylesheet never shows an
 * original in colour: it is painted as its blank sheet, a hairline round its box in the tone of
 * a photo's frame (an SVG filter that ignores its pixels), so an image whose drawing is pending
 * reads as a framed blank sheet, and its drawing fades in on it (at once while the page
 * arrives). A jump lands on images whose overlays the helper attaches a frame or two later: a
 * graphic shows its own original until then (by a rule on its src), a photograph its sheet.
 *
 * Hover (a mouse or a pen): a small square serif note over a word gives each letter's bits and
 * the word's total.
 *
 * The caption: when the core sets it as a subtitle at the viewport's foot (a phone, a paper
 * page), its band covers whole lines of the text beneath it, on that text's own ground (the
 * band grows from the caption's box to every glyph box it touches and the rest of their
 * lines), so no line is cut in half and none shows between the caption's lines; over no text
 * there is no band. On the narrowest screens the line breaks after its dash.
 *
 * Enter (about 1.4 s): the model reads, then a soft reading front moves through the text on
 * screen in document order, and the letters behind it fade from full ink to their level (the
 * front is SWEEP_BAND of the characters on screen wide); images cross-fade to their residual
 * maps as the front reaches the first text beside or below them. Exit (0.4 s): the ink returns
 * everywhere at once (every rule eases back to its pair's ink) and the images fade back, then
 * the highlights go. Reduced motion: the settled state at once. Arrival: the lens's ground is
 * the page's own background (a getter: #ffffff or the dark theme's #1f1f1f on the site's pages,
 * #fbfcfa on a paper page), so the next page is hidden over its own colour until arrive() has
 * settled (the core then fades it in): no frame shows its letters in full ink or a photograph
 * in colour. Late content and layout changes rebuild the page model, reusing the model's bits
 * while the text is unchanged.
 * The theme toggle is followed before the next frame is painted, reads before writes: the
 * site's colour transitions are suspended for one style pass (html.lens-shannon-still), every
 * pair's ink and ground are read again from an element that has them, and so is every element
 * holding a run on or near the screen (colours that were one in the old theme may be apart in
 * the new: such runs move to the pair they are one with now, or show their own colour until the
 * rebuild); the rules are rewritten and the photos take the ink filter of their new colours. A
 * graphic on its own ground needs nothing; a transparent one is composed again on the new
 * ground. Then the page model is rebuilt once. The ground stored for the next page
 * (sessionStorage 'lenses-ground', which the core wrote when the lens entered) follows the
 * theme too.
 */
(() => {
  'use strict';
  const lenses = window.SiteLenses;
  if (!lenses) return;

  /* ---------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------- */
  // The model
  const MAX_ORDER = 5;                 // context orders MAX_ORDER .. 0, then the uniform fallback
  const ALPHABET = 65536;              // the uniform fallback: every UTF-16 code unit
  // The ink
  const LEVELS = 8;                    // level = clamp(floor(bits), 0, LEVELS - 1)
  const TOP = LEVELS - 1;              // the level drawn in the original colour (no highlight)
  const INK_CURVE = 0.5;               // ink(level) = floor + (1 - floor) * (level / TOP) ^ INK_CURVE
  const CONTRAST_MIN = 3;              // WCAG contrast ratio level 0 keeps against its ground ...
  const CONTRAST_LOW = 0.8;            // ... a pair with less keeps its own ratio to this power ...
  const CONTRAST_KEEP = 0.5;           // ... and every pair at least its own ratio to this power
  const COMBOS_MAX = 9;                // colour pairs with highlights: 9 x 7 levels = 63 highlights
  const PAIR_MERGE = 0.03;             // OKLab distance within which two inks (or two grounds) are one colour
  const PREFIX = 'lens-shannon-';      // highlight names: lens-shannon-<pair>-<level>
  const NEAR_SCREENS = 1;              // ranges exist for blocks within this many screens of the viewport
  const JUMP_MARGIN = 0.25;            // screens beyond the viewport a jump's blocks are shown at once
  // Work
  const SLICE_MS = 6;                  // longest stretch of work before yielding to the page ...
  const SLICE_BUDGET_MS = 8;           // ... so that no slice (one step may overrun) takes longer than this
  // Enter and exit
  const SWEEP_MS = 1300;               // the reading front crosses the text on screen (enter: about 1.4 s in all)
  const SWEEP_BAND = 0.2;              // its soft edge, as a share of the characters on screen ...
  const SWEEP_BAND_MIN = 60;           // ... and at least this many characters
  const IMAGE_FADE_MS = 450;           // an image cross-fades to its residual map
  const LATE_FADE_MS = 250;            // an image drawn after the lens settled fades in on its blank ground
  const EXIT_MS = 400;                 // the ink returns
  // Images: the residual's tone curve (|error| in 8-bit luminance steps)
  const RESIDUAL_FLOOR = 3;            // at most this: bare ground (sensor noise, JPEG blocks)
  const RESIDUAL_FULL = 128;           // at least this: full ink
  const PHOTO_FRAME = 0.2;             // ink of the hairline round a photo (its edges may be blank)
  const PHOTO_SPAN = 0.9;              // OKLab lightness a photo's tone curve spans between ground and ink at least
                                       // (a paler ink, as the dark theme's grey on grey, steepens the curve)
  const IMAGE_INK_CONTRAST = 3;        // a drawing's ink keeps this WCAG contrast with the ground behind it ...
  const PALE_INK = [229, 231, 235];    // ... else this on a dark ground (the lightbox's backdrop) ...
  const DEEP_INK = [55, 65, 81];       // ... or this on a light one
  const SMALL_PHOTO = 300;             // CSS px: a photo shown smaller than this (longer side) is read through a 1-2-1 blur
  const GRAPHIC_FLOOR = 0.3;           // a graphic's predictable pixel keeps this share of its difference from its ground
  const STROKE_FROM = 0.15;            // lightness off the graphic's ground (0..1) above which a pixel keeps more ink ...
  const STROKE_TO = 0.6;               // ... and from which it keeps all of it (a solid stroke, a bold label)
  const FLOOR_FROM = 1.4;              // WCAG ratio off the graphic's ground above which a pixel keeps the letters' floor ...
  const FLOOR_TO = 1.8;                // ... in full from here (a grey line or label; a paler tint is a fill, and fades)
  const GROUND_RING = 0.03;            // a graphic's ground: the commonest colour in a border this share of its shorter side wide
  const STRIP_PIXELS = 16384;          // pixels read or written by one getImageData / putImageData
  const RENDER_SLICE_MS = 4;           // an image's work yields after this (a strip more may follow)
  const SHEET_LINE = 1;                // CSS px: the hairline of a photo's blank sheet while its drawing is pending
  const INK_FILTERS_MAX = 8;           // colour pairs with a filter of their own (more reuse the last)
  // The caption at the viewport's foot
  const BAND_JOIN = 24;                // px: text fragments this close to the band's sides belong to its lines
  const BAND_PAD = 1;                  // px the band reaches past the glyph boxes of the lines it covers
  const CAPTION_BREAK_BELOW = 400;     // viewport px under which the caption's line breaks after its dash
  // Hover
  const TIP_GAP = 6;                   // px between a word and its tooltip
  const TIP_EDGE = 6;                  // px the tooltip keeps from the viewport edge
  const TIP_LETTERS = 18;              // longer words show their first letters and the total
  const HOVER_SLOP = 2;                // px around a word's boxes that still count as on it
  const COMPACT_BELOW = 600;           // viewport px under which the caption's note is the short one

  const CLS = { on: 'lens-shannon', dark: 'lens-shannon-dark', covered: 'lens-shannon-covered', still: 'lens-shannon-still', sheets: 'lens-shannon-sheets' };
  const SHEET_HREF = 'easter/lenses/shannon.css';
  const HTML_NS = 'http://www.w3.org/1999/xhtml';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // The filters' ids (shannon.css names the two sheets).
  const SHEET_ID = 'lens-shannon-sheet'; const SHEET_FIXED_ID = 'lens-shannon-sheet-fixed'; const INK_ID = 'lens-shannon-ink-';
  // The images shannon.css hides under their drawings: the page's own (a relative URL) in the scope.
  const SCOPE_IMG = ':is(#site-nav, #main-content, #site-footer, body > header.site-header, body > footer.paper-footer) img';
  const LINE = 'Each letter is as dark as it was surprising.';
  // Never read: code, styles, replaced and embedded content, form controls (their values are input).
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
    'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED']);
  const PRESERVE_WS = new Set(['pre', 'pre-wrap', 'break-spaces']);
  const WORD = /[\p{L}\p{N}\p{M}'’]/u;  // what the tooltip counts as part of a word
  const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

  const html = document.documentElement;
  let state = null;                    // the running activation
  let lastModel = null;                // { text, bits, total }: reused while the page's text is unchanged
  let hold = null;                     // tests: a number in [0, 1] freezes the sweep and the exit there
  const stats = { builds: 0, commits: 0, collectMs: 0, modelMs: 0, runsMs: 0, commitMs: 0, sliceMaxMs: 0,
    sweepFrames: 0, sweepMaxMs: 0, sweepTotalMs: 0, hoverMaxMs: 0, renders: 0, renderSliceMaxMs: 0, flushMaxMs: 0, intersectMaxMs: 0,
    jumpMaxMs: 0, themeMs: null, themeStyleMs: null, repaints: 0, phaseMaxMs: {}, arriveMs: null, slices: 0, slicesOver: 0, regrouped: 0, bandMaxMs: 0 };

  /* ---------------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------------- */
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = t => t * t * (3 - 2 * t);
  const isSpace = u => u === 32 || u === 10 || u === 9 || u === 13 || u === 12 || u === 160;
  const collapsible = u => u === 32 || u === 10 || u === 9 || u === 13 || u === 12;

  // A yield to the page: a message, not a timer (timers are clamped and throttled).
  const yieldTask = () => new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
    channel.port2.postMessage(0);
  });
  // Runs a generator in slices of `ms`; null when the signal aborts first. `phase` names the
  // work in stats.phaseMaxMs (its longest slice).
  async function sliced(steps, signal, phase, ms = SLICE_MS) {
    let began = performance.now();
    for (;;) {
      const step = steps.next();
      if (step.done) { note(began, phase); return step.value === undefined ? true : step.value; }
      const now = performance.now();
      if (now - began >= ms) {
        note(began, phase);
        await yieldTask();
        if (signal && signal.aborted) return null;
        began = performance.now();
      }
    }
  }
  // Runs a generator to its end at once.
  const drain = steps => { let step = steps.next(); while (!step.done) step = steps.next(); return step.value; };
  // Resolves just after the next frame has been rendered (or after 50 ms in a hidden tab).
  const afterFrame = ctx => new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(finish, 50);
    ctx.frame(() => { yieldTask().then(finish); return false; });
  });
  // Records one slice of work: the longest per phase, and how many ran over the 8 ms budget.
  function note(began, phase) {
    const ms = +(performance.now() - began).toFixed(2);
    stats.slices++;
    if (ms > SLICE_BUDGET_MS) stats.slicesOver++;
    if (ms > stats.sliceMaxMs) stats.sliceMaxMs = ms;
    if (phase && !(stats.phaseMaxMs[phase] >= ms)) stats.phaseMaxMs[phase] = ms;
    if (phase === 'image' && ms > stats.renderSliceMaxMs) stats.renderSliceMaxMs = ms;
  }

  /* ---------------------------------------------------------------------------
   * Colours: computed values to sRGB triples, mixing in OKLab, WCAG contrast
   * ------------------------------------------------------------------------- */
  const parsed = new Map();
  let probe = null;
  // [r, g, b, a] (0-255, alpha 0-1) of a computed colour; any syntax the canvas knows.
  function rgba(value) {
    let out = parsed.get(value);
    if (out) return out;
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(value);
    if (m) out = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4]];
    else if (value === 'transparent' || !value) out = [0, 0, 0, 0];
    else {
      try {
        if (!probe) { const c = document.createElement('canvas'); c.width = c.height = 1; probe = c.getContext('2d', { willReadFrequently: true }); }
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = 'rgba(0, 0, 0, 0)';
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const d = probe.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2], d[3] / 255];
      } catch (error) { out = [0, 0, 0, 1]; }
    }
    parsed.set(value, out);
    return out;
  }
  const over = (top, a, under) => [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a)];
  const toLinear = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toByte = l => { const c = l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; return Math.round(clamp01(c) * 255); };
  function oklab(rgb) {
    const r = toLinear(rgb[0]); const g = toLinear(rgb[1]); const b = toLinear(rgb[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromOklab([L, A, B]) {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return [toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  // The colour w of the way from ground to ink (w = 1: the ink itself), mixed in OKLab.
  function mix(ground, ink, w) {
    const a = oklab(ground); const b = oklab(ink);
    return fromOklab([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]);
  }
  const css = rgb => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  // WCAG 2 relative luminance and contrast ratio (1 to 21).
  const luminance = rgb => 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
  const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // The contrast ratio level 0 keeps: CONTRAST_MIN, or own^CONTRAST_LOW below it, and at least own^CONTRAST_KEEP.
  const floorContrast = own => Math.max(Math.min(CONTRAST_MIN, own ** CONTRAST_LOW), own ** CONTRAST_KEEP);
  // The share of a pair's ink level 0 keeps (the floor): the least share whose mix still has
  // floorContrast(own) against the ground (found by bisection; memoised per ink and ground).
  const floors = new Map();
  function floorOf(pair) {
    const key = `${pair.ink}|${pair.bg}`;
    let floor = floors.get(key);
    if (floor !== undefined) return floor;
    const own = contrast(pair.ink, pair.bg);
    const target = floorContrast(own);
    floor = 1;
    if (own > target * 1.0001) {
      let lo = 0; let hi = 1;
      for (let k = 0; k < 16; k++) {
        const w = (lo + hi) / 2;
        if (contrast(mix(pair.bg, pair.ink, w), pair.bg) >= target) hi = w; else lo = w;
      }
      floor = hi;
    }
    floors.set(key, floor);
    return floor;
  }
  // The share of the ink a level keeps: the floor at level 0, all of it at level TOP.
  const inkAt = (level, floor) => floor + (1 - floor) * Math.pow(level / TOP, INK_CURVE);
  const ruleColour = (pair, level) => css(mix(pair.bg, pair.ink, inkAt(level, floorOf(pair))));

  // The root's own background, [r, g, b, a]. While a page arrives with the lens, the core's
  // pre-paint ground (#lenses-prepaint: !important on the root until the page is revealed)
  // hides it: its sheet is switched off for the read and on again in the same task, so no frame
  // is painted without it (the sheet's disabled flag, not an attribute: the markup is untouched).
  function rootBackground() {
    const prepaint = document.getElementById('lenses-prepaint');
    const sheet = prepaint && prepaint.sheet;
    if (!sheet || sheet.disabled || !(html.hasAttribute('data-lens-arriving') || html.hasAttribute('data-lens-revealing'))) {
      return rgba(getComputedStyle(html).backgroundColor);
    }
    sheet.disabled = true;
    try { return rgba(getComputedStyle(html).backgroundColor); } finally { sheet.disabled = false; }
  }
  // The canvas colour under everything: the root's background, else the browser's default.
  function canvasColour(root = rootBackground()) {
    if (root[3] > 0.995) return root.slice(0, 3);
    const dark = html.dataset.theme === 'dark' || /dark/.test(getComputedStyle(html).colorScheme || '');
    return dark ? [18, 18, 18] : [255, 255, 255];
  }
  // The page's own ground: the root's background, else the body's (the site shell paints the
  // body: #ffffff, or #1f1f1f in the dark theme; a paper page paints the root, #fbfcfa).
  function pageGround() {
    const root = rootBackground();
    if (root[3] > 0.995) return root.slice(0, 3).map(Math.round);
    const body = document.body ? rgba(getComputedStyle(document.body).backgroundColor) : null;
    if (body && body[3] > 0.995) return body.slice(0, 3).map(Math.round);
    return canvasColour(root).map(Math.round);
  }
  const hex = rgb => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
  // The colour behind an element: its own background over its parent's (memoised per build;
  // the root's own background, the pre-paint ground aside).
  function backgroundOf(el, memo, style) {
    if (!el || el.nodeType !== 1) return memo.canvas || (memo.canvas = canvasColour(memo.root || rootBackground()));
    const known = memo.get(el);
    if (known) return known;
    const [r, g, b, a] = el === html ? (memo.root = rootBackground()) : rgba(style(el).backgroundColor);
    const out = a > 0.995 ? [r, g, b] : a < 0.005 ? backgroundOf(el.parentElement, memo, style) : over([r, g, b], a, backgroundOf(el.parentElement, memo, style));
    memo.set(el, out);
    return out;
  }
  // An element's text colour over the colour behind it, as rounded sRGB triples, or null when
  // its text is painted another way (-webkit-text-fill-color) or is nearly invisible.
  function pairOf(el, memo, style) {
    const s = style(el);
    if (s.webkitTextFillColor !== undefined && s.webkitTextFillColor !== s.color) return null;
    const [r, g, b, a] = rgba(s.color);
    if (a <= 0.05) return null;
    const bg = backgroundOf(el, memo, style).map(Math.round);
    const ink = (a > 0.995 ? [r, g, b] : over([r, g, b], a, bg)).map(Math.round);
    return { ink, bg };
  }

  /* ---------------------------------------------------------------------------
   * The model: PPM, escape method C, exclusion, update exclusion
   * ------------------------------------------------------------------------- */
  /**
   * Scores every code unit of `text` before learning it (a generator: it yields every 256
   * code units). Returns { bits: Float32Array (bits per code unit), total (bits), distinct }.
   * Contexts are kept per order in a Map keyed by the context's symbols, packed into one
   * number (radix: the text's distinct code units) when that fits in 53 bits, else by the
   * context string itself. A context holds parallel arrays of symbols and counts.
   */
  function* modelSteps(text) {
    const n = text.length;
    const bits = new Float32Array(n);
    const ids = new Uint16Array(n);
    const idOf = new Int32Array(65536).fill(-1);
    let distinct = 0;
    for (let i = 0; i < n; i++) {
      const u = text.charCodeAt(i);
      if (idOf[u] < 0) idOf[u] = distinct++;
      ids[i] = idOf[u];
    }
    yield;
    const radix = Math.max(2, distinct);
    const packed = Math.pow(radix, MAX_ORDER) < Number.MAX_SAFE_INTEGER;
    const maps = Array.from({ length: MAX_ORDER + 1 }, () => new Map());
    let order0 = null;
    const mark = new Int32Array(Math.max(1, distinct));   // exclusion: mark[symbol] === stamp
    const keys = new Array(MAX_ORDER + 1).fill(0);
    const found = new Array(MAX_ORDER + 1).fill(null);
    let seen = 0; let total = 0;
    for (let i = 0; i < n; i++) {
      const x = ids[i]; const stamp = i + 1;
      const top = i < MAX_ORDER ? i : MAX_ORDER;
      if (packed) {
        let key = 0; let scale = 1;
        for (let k = 1; k <= top; k++) { key += ids[i - k] * scale; scale *= radix; keys[k] = key; }
      } else {
        for (let k = 1; k <= top; k++) keys[k] = text.substring(i - k, i);
      }
      let cost = 0; let coded = -1;
      for (let k = top; k >= 0; k--) {
        const ctx = k === 0 ? order0 : maps[k].get(keys[k]);
        found[k] = ctx || null;
        if (!ctx) continue;                   // a context never seen: escapes with certainty
        const s = ctx.s; const c = ctx.c;
        let count = 0; let kinds = 0; let hit = 0;
        for (let j = 0; j < s.length; j++) {
          const y = s[j];
          if (mark[y] === stamp) continue;    // excluded: a longer context offered it already
          count += c[j]; kinds++;
          if (y === x) hit = c[j];
        }
        if (!kinds) continue;                 // everything here was excluded: a certain escape
        if (hit) { cost += Math.log2((count + kinds) / hit); coded = k; break; }
        cost += Math.log2((count + kinds) / kinds);
        for (let j = 0; j < s.length; j++) mark[s[j]] = stamp;
      }
      if (coded < 0) { cost += Math.log2(ALPHABET - seen); seen++; }
      bits[i] = cost; total += cost;
      // Update exclusion: the context that coded x and every longer one learn it.
      for (let k = coded < 0 ? 0 : coded; k <= top; k++) {
        const ctx = found[k];
        if (!ctx) {
          const made = { s: [x], c: [1] };
          if (k === 0) order0 = made; else maps[k].set(keys[k], made);
          continue;
        }
        const j = ctx.s.indexOf(x);
        if (j < 0) { ctx.s.push(x); ctx.c.push(1); } else ctx.c[j]++;
      }
      if ((i & 255) === 255) yield;
    }
    return { bits, total, distinct };
  }
  const runModel = text => drain(modelSteps(text));
  const levelOf = b => (b >= TOP ? TOP : b <= 0 ? 0 : Math.floor(b));

  /* ---------------------------------------------------------------------------
   * Reading the page: the scope's visible text in document order
   * ------------------------------------------------------------------------- */
  // A closed <details> shows its first <summary> only.
  const shut = el => el && el.tagName === 'DETAILS' && !el.open;
  const firstSummary = details => { for (const child of details.children) if (child.tagName === 'SUMMARY') return child; return null; };

  /**
   * Returns the page model: text (what the model reads), and for each code unit its text node
   * (index into nodes, -1 for a newline between blocks) and its offset in that node; the text
   * nodes with their first and last code unit and their block; the blocks (the nearest
   * ancestor that is not inline, which the IntersectionObserver watches); and the images with
   * the position in the text where they stand.
   */
  function* collectSteps(scope) {
    const codes = []; const charNode = []; const charOff = [];
    const nodes = []; const nodeStart = []; const nodeEnd = []; const nodeBlock = [];
    const blocks = []; const blockIndex = new Map();
    const images = [];
    const styles = new Map();
    const style = el => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s); } return s; };
    const blockOf = new Map();
    const range = document.createRange();
    let block = null;
    const push = (u, node, off) => { codes.push(u); charNode.push(node); charOff.push(off); };
    const pop = () => { codes.pop(); charNode.pop(); charOff.pop(); };
    const last = () => (codes.length ? codes[codes.length - 1] : 10);
    // A line break: a trailing space goes, and two breaks never follow each other.
    const lineBreak = () => {
      if (!codes.length) return;
      if (last() === 32) pop();
      if (last() !== 10) push(10, -1, 0);
    };
    const blockFor = (el, root) => {
      const chain = [];
      let found = null;
      for (let e = el; e; e = e.parentElement) {
        if (blockOf.has(e)) { found = blockOf.get(e); break; }
        chain.push(e);
        const display = style(e).display;
        if (e === root || (display !== 'contents' && !display.startsWith('inline'))) { found = e; break; }
      }
      chain.forEach(e => blockOf.set(e, found));
      return found;
    };
    // Text drawn on the page: a box of some size that is not above or left of the document.
    const drawn = node => {
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (r.width <= 1 && r.height <= 1) continue;
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.bottom + window.scrollY > 0 && r.right + window.scrollX > 0) return true;
      }
      return false;
    };
    let seen = 0;
    for (const root of scope) {
      if (!root || !root.isConnected) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          // The body of a closed <details> is not rendered (only its summary is).
          if (shut(parent) && !(node.nodeType === 1 && node === firstSummary(parent))) return NodeFilter.FILTER_REJECT;
          if (node.nodeType === 3) return NodeFilter.FILTER_ACCEPT;
          if (node.namespaceURI !== HTML_NS || SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
          if (node.getAttribute('aria-hidden') === 'true' || node.isContentEditable) return NodeFilter.FILTER_REJECT;
          if (style(node).display === 'none') return NodeFilter.FILTER_REJECT;
          return node.tagName === 'IMG' || node.tagName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if ((++seen & 31) === 0) yield;
        if (node.nodeType === 1) {
          if (node.tagName === 'IMG') images.push({ img: node, at: codes.length });
          else { if (last() === 32) pop(); push(10, -1, 0); }          // <br>
          continue;
        }
        const parent = node.parentElement;
        const data = node.data;
        if (!parent || !data) continue;
        const s = style(parent);
        if (s.visibility !== 'visible') continue;
        const blank = !/[^ \t\n\r\f]/.test(data);
        if (!blank && !drawn(node)) continue;
        const el = blockFor(parent, root);
        if (el !== block) { lineBreak(); block = el; }
        const index = nodes.length;
        const first = codes.length;
        const ws = s.whiteSpace;
        const pre = PRESERVE_WS.has(ws); const preLine = ws === 'pre-line';
        for (let i = 0; i < data.length; i++) {
          const u = data.charCodeAt(i);
          if (pre || !collapsible(u)) { push(u, index, i); continue; }
          if (preLine && u === 10) { if (last() === 32) pop(); push(10, index, i); continue; }
          const prev = last();
          if (prev !== 32 && prev !== 10) push(32, index, i);
        }
        if (codes.length === first) continue;                       // nothing of it is read
        nodes.push(node); nodeStart.push(first); nodeEnd.push(codes.length);
        let b = blockIndex.get(el);
        if (b === undefined) { b = blocks.length; blockIndex.set(el, b); blocks.push({ el, nodes: [], runs: [], first, last: codes.length }); }
        blocks[b].nodes.push(index);
        blocks[b].last = codes.length;
        nodeBlock.push(b);
      }
      lineBreak();
      block = null;
    }
    while (codes.length && codes[codes.length - 1] === 10) pop();
    yield;
    let text = '';
    for (let i = 0; i < codes.length; i += 8192) text += String.fromCharCode.apply(null, codes.slice(i, i + 8192));
    return {
      text, charNode: Int32Array.from(charNode), charOff: Int32Array.from(charOff),
      nodes, nodeStart: Int32Array.from(nodeStart), nodeEnd: Int32Array.from(nodeEnd), nodeBlock: Int32Array.from(nodeBlock),
      blocks, images, styles
    };
  }

  /* ---------------------------------------------------------------------------
   * Colour pairs and runs
   * ------------------------------------------------------------------------- */
  // Each text node's colour pair (its text colour over its background), quantised: pairs whose
  // ink and ground both lie within PAIR_MERGE (OKLab distance) of a pair with more letters
  // share its highlights (a caption on a faintly tinted panel, a near-black on near-white). The
  // COMBOS_MAX pairs with the most letters are kept, and each node gets its pair's index (-1:
  // drawn in its own colour). A pair keeps one element that has its colours (el), from which a
  // theme change reads them again (regroup() reads the others).
  function* pairSteps(page) {
    const memo = new Map();
    const style = el => { let s = page.styles.get(el); if (!s) { s = getComputedStyle(el); page.styles.set(el, s); } return s; };
    const byKey = new Map();
    const nodeKey = new Array(page.nodes.length);
    const parentPair = new Map();
    for (let n = 0; n < page.nodes.length; n++) {
      const parent = page.nodes[n].parentElement;
      let pair = parentPair.get(parent);
      if (pair === undefined) {
        const found = pairOf(parent, memo, style);
        pair = found && found.ink.some((v, i) => Math.abs(v - found.bg[i]) > 6) ? { key: `${found.ink}|${found.bg}`, ...found, el: parent } : null;
        parentPair.set(parent, pair);
      }
      if (pair) {
        let entry = byKey.get(pair.key);
        if (!entry) { entry = { ...pair, letters: 0 }; byKey.set(pair.key, entry); }
        for (let j = page.nodeStart[n]; j < page.nodeEnd[n]; j++) if (!isSpace(page.text.charCodeAt(j))) entry.letters++;
        nodeKey[n] = pair.key;
      }
      if ((n & 31) === 31) yield;
    }
    // Quantise: each pair, from the most letters down, joins the first kept pair it is close to.
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= PAIR_MERGE;
    const groups = [];                        // { pair (the representative; letters: the group's), lab: [ink, bg] }
    const groupOf = new Map();                // raw key -> group
    for (const entry of [...byKey.values()].sort((a, b) => b.letters - a.letters)) {
      const lab = [oklab(entry.ink), oklab(entry.bg)];
      let group = groups.find(g => near(g.lab[0], lab[0]) && near(g.lab[1], lab[1]));
      if (!group) { group = { pair: { key: entry.key, ink: entry.ink, bg: entry.bg, el: entry.el, letters: 0 }, lab }; groups.push(group); }
      group.pair.letters += entry.letters;
      groupOf.set(entry.key, group);
    }
    yield;
    const pairs = groups.map(g => g.pair).sort((a, b) => b.letters - a.letters).slice(0, COMBOS_MAX);
    const indexOf = new Map(pairs.map((p, i) => [p, i]));
    const nodePair = new Int8Array(page.nodes.length).fill(-1);
    for (let n = 0; n < page.nodes.length; n++) {
      const group = nodeKey[n] && groupOf.get(nodeKey[n]);
      if (group && indexOf.has(group.pair)) nodePair[n] = indexOf.get(group.pair);
    }
    return { pairs, nodePair };
  }

  // Runs of equal level within each text node (a space joins a run), per block: what the
  // highlights hold. Level TOP needs no run: it is the original colour. A run is `on` while
  // its range is in its highlight.
  function* runSteps(page) {
    const { text, levels, charOff, nodes, nodeStart, nodeEnd, nodeBlock, nodePair } = page;
    let count = 0;
    for (let n = 0; n < nodes.length; n++) {
      const pair = nodePair[n];
      if (pair < 0) continue;
      const block = page.blocks[nodeBlock[n]];
      const node = nodes[n];
      let level = -1; let from = 0; let to = 0; let c0 = 0; let c1 = 0;
      const flush = () => { if (level >= 0 && level < TOP) { block.runs.push({ node, n, from, to, hl: pair * TOP + level, c0, c1, block, range: null, on: false }); count++; } };
      for (let j = nodeStart[n]; j < nodeEnd[n]; j++) {
        if (isSpace(text.charCodeAt(j))) continue;
        const l = levels[j];
        if (l === level) { to = charOff[j] + 1; c1 = j; continue; }
        flush();
        level = l; from = charOff[j]; to = from + 1; c0 = c1 = j;
      }
      flush();
      if ((n & 31) === 31) yield;
    }
    return count;
  }

  /* ---------------------------------------------------------------------------
   * Images: the residual of the median edge detector
   * ------------------------------------------------------------------------- */
  const TONE = (() => {
    const t = new Float32Array(256);
    const lo = Math.log2(1 + RESIDUAL_FLOOR); const hi = Math.log2(1 + RESIDUAL_FULL);
    for (let e = 0; e < 256; e++) t[e] = clamp01((Math.log2(1 + e) - lo) / (hi - lo));
    return t;
  })();
  // A graphic's pixel keeps this share of its difference from its ground for each |error|.
  const KEEP = TONE.map(t => GRAPHIC_FLOOR + (1 - GRAPHIC_FLOOR) * t);
  // Graphics are mixed per channel in the cube root of linear light (OKLab's lightness for a
  // grey, so a faded grey matches a faded letter): LIGHT maps a byte there, UNLIGHT back.
  const UNLIGHT_STEPS = 4095;
  const LIGHT = Float32Array.from({ length: 256 }, (_, v) => Math.cbrt(toLinear(v)));
  const UNLIGHT = Uint8Array.from({ length: UNLIGHT_STEPS + 1 }, (_, k) => toByte((k / UNLIGHT_STEPS) ** 3));
  // The share of a graphic pixel's ink kept for standing `off` (0..1, in LIGHT) off its ground.
  const strokeKeep = off => smooth(clamp01((off - STROKE_FROM) / (STROKE_TO - STROKE_FROM)));
  const lumaOf = (r, g, b) => (54 * r + 183 * g + 19 * b + 128) >> 8;
  const pack = (r, g, b) => (LITTLE_ENDIAN ? (255 << 24 | b << 16 | g << 8 | r) : (r << 24 | g << 16 | b << 8 | 255)) >>> 0;
  // The least share of its ink a graphic pixel keeps, by its luma (read as a grey that light):
  // the letters' floor rule, so a figure's grey label or line keeps floorContrast(own) against
  // the figure's ground as a letter at level 0 does (a 2.4:1 grey keeps 2:1, black on white
  // 4.6:1). Pale fills are not lines: the floor holds in full from FLOOR_TO (a WCAG ratio
  // against the ground), not at all below FLOOR_FROM, so a 1.2:1 tint still fades to
  // GRAPHIC_FLOOR. Found by bisection on the mix in LIGHT; memoised per ground.
  const floorKeeps = new Map();
  function floorKeep(ground) {
    const key = String(ground);
    let keep = floorKeeps.get(key);
    if (keep) return keep;
    const gY = luminance(ground); const gL = LIGHT[lumaOf(ground[0], ground[1], ground[2])];
    const ratio = l => (Math.max(l, gY) + 0.05) / (Math.min(l, gY) + 0.05);
    keep = new Float32Array(256);
    for (let v = 0; v < 256; v++) {
      const own = ratio(LIGHT[v] ** 3);
      const share = smooth(clamp01((own - FLOOR_FROM) / (FLOOR_TO - FLOOR_FROM)));
      if (!share) continue;
      const target = floorContrast(own);
      let lo = 0; let hi = 1;
      for (let k = 0; k < 14; k++) {
        const w = (lo + hi) / 2;
        if (ratio((gL + (LIGHT[v] - gL) * w) ** 3) >= target) hi = w; else lo = w;
      }
      keep[v] = share * hi;
    }
    if (floorKeeps.size > 16) floorKeeps.clear();
    floorKeeps.set(key, keep);
    return keep;
  }

  // A photograph's canvas holds its tone, not its colours: the grey 255 * (1 - tone), white
  // where nothing is drawn. Its ink filter (inkTables) maps that grey to the page's colours as
  // it is painted, so a theme change rewrites three tables, not a canvas.
  const encode = t => Math.round(255 * (1 - t));
  const PHOTO_LUT = Uint32Array.from({ length: 256 }, (_, e) => { const v = encode(TONE[e]); return pack(v, v, v); });
  // The page's text colour (main's) and the colour behind the image, as sRGB triples. Behind
  // an image that is not on the page's ground (the photography lightbox's black backdrop) the
  // text colour may not read: then the ink is a pale or a deep grey, whichever reads there.
  const imageColours = img => coloursOn(img.parentElement);
  function coloursOn(el) {
    const memo = new Map();
    const style = e => getComputedStyle(e);
    const main = document.getElementById('main-content') || document.body;
    const bg = backgroundOf(el, memo, style).map(Math.round);
    const [r, g, b, a] = rgba(getComputedStyle(main).color);
    let ink = (a > 0.995 ? [r, g, b] : over([r, g, b], a, backgroundOf(main, memo, style))).map(Math.round);
    if (contrast(ink, bg) < IMAGE_INK_CONTRAST) ink = oklab(bg)[0] < 0.5 ? PALE_INK : DEEP_INK;
    return { bg, ink };
  }
  // The steepening of a photo's tone curve for its colours, so a given |error| stands as far
  // off the ground (in OKLab lightness) in either theme, up to the ink: black on white spans
  // 1.0 (no change), the dark theme's grey ink on its grey ground 0.62 (gain 1.45: tones above
  // 0.69 reach the ink).
  const photoGain = (bg, ink) => Math.max(1, PHOTO_SPAN / Math.max(0.05, Math.abs(oklab(ink)[0] - oklab(bg)[0])));
  // The colour a photo's tone t is painted in: its ink mixed toward its ground in OKLab.
  const photoColour = ({ bg, ink }, t) => mix(bg, ink, Math.min(1, t * photoGain(bg, ink)));
  // The ink filter's tables, one per channel: the grey v (tone 1 - v / 255) to that channel of
  // its colour (0..1), for every byte (feComponentTransfer in sRGB, so exact per byte).
  function inkTables(colours) {
    const out = [[], [], []];
    for (let v = 0; v < 256; v++) {
      const c = photoColour(colours, 1 - v / 255);
      for (let k = 0; k < 3; k++) out[k].push(+(c[k] / 255).toFixed(5));
    }
    return out.map(values => values.join(' '));
  }
  // A 1-2-1 blur in both directions, in place (the edges repeat).
  function blur121(Y, W, H) {
    const T = new Uint16Array(W * H);
    for (let y = 0; y < H; y++) {
      const r = y * W;
      for (let x = 0; x < W; x++) T[r + x] = Y[r + (x ? x - 1 : 0)] + 2 * Y[r + x] + Y[r + (x < W - 1 ? x + 1 : x)];
    }
    for (let y = 0; y < H; y++) {
      const up = (y ? y - 1 : 0) * W; const r = y * W; const down = (y < H - 1 ? y + 1 : y) * W;
      for (let x = 0; x < W; x++) Y[r + x] = (T[up + x] + 2 * T[r + x] + T[down + x] + 8) >> 4;
    }
  }

  /**
   * One image's drawing, as steps (a generator that yields between strips of rows). g holds the
   * image as displayed (transparent where it is); colours are the page's { bg, ink }. rec is the
   * image's record ({ kind, W, H, dpr, small }); it keeps what a theme change needs: a
   * transparent graphic's own pixels (rec.rgba) and a graphic's ground (rec.ground). A
   * photograph needs nothing: its canvas holds its tones, which its ink filter colours.
   */
  function* drawSteps(rec, g, colours) {
    const { W, H } = rec;
    const { bg } = colours;
    const graphic = rec.kind === 'graphic';
    const strip = Math.max(1, Math.floor(STRIP_PIXELS / W));
    const rowsAt = y0 => Math.min(strip, H - y0);
    const read = y0 => (rec.rgba ? rec.rgba.subarray(y0 * W * 4, (y0 + rowsAt(y0)) * W * 4) : g.getImageData(0, y0, W, rowsAt(y0)).data);
    // 1. Luminance (Rec. 709 weights on the encoded values, as JPEG-LS would see a grey image),
    //    composed over the colour behind the image where it is transparent. A graphic also
    //    counts the colours of its border (4 bits a channel): the commonest is its ground.
    const Y = new Uint8Array(W * H);
    const ring = graphic ? Math.max(2, Math.round(GROUND_RING * Math.min(W, H))) : 0;
    const counts = graphic ? new Uint32Array(4096) : null;
    const sums = graphic ? new Float64Array(4096 * 3) : null;
    let clear = false;
    for (let y0 = 0; y0 < H; y0 += strip) {
      const d = read(y0);
      for (let y = y0, p = 0, end = y0 + rowsAt(y0); y < end; y++) {
        const border = y < ring || y >= H - ring;
        for (let x = 0, i = y * W; x < W; x++, i++, p += 4) {
          let r = d[p]; let gr = d[p + 1]; let b = d[p + 2];
          const a = d[p + 3];
          if (a < 255) {
            clear = true;
            const k = a / 255;
            r = (r * k + bg[0] * (1 - k) + 0.5) | 0; gr = (gr * k + bg[1] * (1 - k) + 0.5) | 0; b = (b * k + bg[2] * (1 - k) + 0.5) | 0;
          }
          Y[i] = lumaOf(r, gr, b);
          if (counts && (border || x < ring || x >= W - ring)) {
            const key = (r >> 4) << 8 | (gr >> 4) << 4 | (b >> 4);
            counts[key]++; sums[key * 3] += r; sums[key * 3 + 1] += gr; sums[key * 3 + 2] += b;
          }
        }
      }
      yield;
    }
    // A transparent graphic keeps its own pixels (the canvas still holds them) to be composed
    // again on another ground.
    if (graphic && clear && !rec.rgba) rec.rgba = g.getImageData(0, 0, W, H).data;
    // 2. A small photograph is read through a 1-2-1 blur.
    if (rec.small) { blur121(Y, W, H); yield; }
    // 3. The median edge detector's error. Missing neighbours on the first row and column are
    //    taken from the one neighbour there is, so the borders are predicted like flat ground.
    const E = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0, i = y * W; x < W; x++, i++) {
        let pred;
        if (y === 0) pred = x === 0 ? Y[i] : Y[i - 1];
        else if (x === 0) pred = Y[i - W];
        else {
          const a = Y[i - 1]; const b = Y[i - W]; const c = Y[i - W - 1];
          const lo = a < b ? a : b; const hi = a < b ? b : a;
          pred = c >= hi ? lo : c <= lo ? hi : a + b - c;
        }
        E[i] = Y[i] > pred ? Y[i] - pred : pred - Y[i];
      }
      if ((y & 7) === 7) yield;
    }
    // 4. A photograph: the residual alone, as tones (its ink filter paints them in the page's ink).
    if (!graphic) {
      yield* photoSteps(rec, g, E);
      return;
    }
    // A graphic: its own colours faded toward its own ground, each pixel by its |error|, by how
    // far it stands off that ground (a solid stroke keeps its ink), and never below the letters'
    // floor (a grey label or line keeps floorContrast of its own contrast).
    let best = 0;
    for (let k = 1; k < 4096; k++) if (counts[k] > counts[best]) best = k;
    const n = Math.max(1, counts[best]);
    const ground = [sums[best * 3] / n, sums[best * 3 + 1] / n, sums[best * 3 + 2] / n].map(Math.round);
    rec.ground = ground;
    const g0 = ground.map(v => LIGHT[v]);
    const gL = LIGHT[lumaOf(ground[0], ground[1], ground[2])];
    const least = floorKeep(ground);
    const stroke = Float32Array.from({ length: 256 }, (_, v) => Math.max(strokeKeep(Math.abs(LIGHT[v] - gL)), least[v]));
    for (let y0 = 0; y0 < H; y0 += strip) {
      const rows = rowsAt(y0);
      const src = read(y0);                    // the rows below y0 are still the image's own
      const out = g.createImageData(W, rows);
      const d = out.data;
      for (let i = y0 * W, p = 0, end = (y0 + rows) * W; i < end; i++, p += 4) {
        let r = src[p]; let gr = src[p + 1]; let b = src[p + 2];
        const a = src[p + 3];
        if (a < 255) {
          const k = a / 255;
          r = (r * k + bg[0] * (1 - k) + 0.5) | 0; gr = (gr * k + bg[1] * (1 - k) + 0.5) | 0; b = (b * k + bg[2] * (1 - k) + 0.5) | 0;
        }
        const keep = KEEP[E[i]]; const solid = stroke[Y[i]];
        const w = keep > solid ? keep : solid;
        d[p] = UNLIGHT[(g0[0] + (LIGHT[r] - g0[0]) * w) * UNLIGHT_STEPS + 0.5 | 0];
        d[p + 1] = UNLIGHT[(g0[1] + (LIGHT[gr] - g0[1]) * w) * UNLIGHT_STEPS + 0.5 | 0];
        d[p + 2] = UNLIGHT[(g0[2] + (LIGHT[b] - g0[2]) * w) * UNLIGHT_STEPS + 0.5 | 0];
        d[p + 3] = 255;
      }
      g.putImageData(out, 0, y0);
      yield;
    }
  }
  // A photograph's tones from its |error| map, inside its hairline (tone PHOTO_FRAME).
  function* photoSteps(rec, g, E) {
    const { W, H } = rec;
    const strip = Math.max(1, Math.floor(STRIP_PIXELS / W));
    for (let y0 = 0; y0 < H; y0 += strip) {
      const rows = Math.min(strip, H - y0);
      const out = g.createImageData(W, rows);
      const px = new Uint32Array(out.data.buffer);
      for (let i = 0, j = y0 * W, end = rows * W; i < end; i++, j++) px[i] = PHOTO_LUT[E[j]];
      g.putImageData(out, 0, y0);
      yield;
    }
    // A photo keeps its footprint: a hairline where its edges were (its sky may be blank).
    const lw = Math.max(1, Math.round(rec.dpr || 1));
    const v = encode(PHOTO_FRAME);
    g.strokeStyle = `rgb(${v}, ${v}, ${v})`;
    g.lineWidth = lw;
    g.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
  }

  // The media helper's render(): the image's drawing on the canvas it was given, or null.
  async function residual(st, source, signal) {
    if (!source.readable) return null;               // a cross-origin image keeps its own look
    const { ctx2d: g, width: W, height: H, img, canvas } = source;
    // The first read of the canvas runs the helper's pending draw of the decoded image (a few
    // ms for a photo): it is timed apart (stats.flushMaxMs), and the lens's own work starts
    // in the next task.
    const flushed = performance.now();
    try { g.getImageData(0, 0, 1, 1); } catch (error) { return null; }
    const flushMs = performance.now() - flushed;
    if (flushMs > stats.flushMaxMs) stats.flushMaxMs = +flushMs.toFixed(2);
    await yieldTask();
    if (signal.aborted) return null;
    const rec = {
      img, kind: source.kind, W, H, dpr: source.dpr || 1, canvas, rgba: null, ground: null, theme: st.theme,
      small: source.kind === 'photo' && Math.max(source.cssWidth, source.cssHeight) < SMALL_PHOTO
    };
    let done;
    try { done = await sliced(drawSteps(rec, g, imageColours(img)), signal, 'image', RENDER_SLICE_MS); } catch (error) { return null; }
    if (!done || signal.aborted) return null;
    remember(st, canvas, rec);
    stats.renders++;
    return canvas;
  }

  /* ---------------------------------------------------------------------------
   * The activation
   * ------------------------------------------------------------------------- */
  function begin(ctx) {
    const st = {
      ctx, page: null, highlights: [], names: [], rules: [], groundRule: null, sheet: null, adopted: null, pairs: [],
      observer: null, building: null, again: false, dirty: false, settled: false, themeChanged: false,
      front: -Infinity, sweepInfo: null, imageFront: new Map(), media: null, mediaWanted: null, revealed: new WeakMap(),
      theme: 0, renditions: new Map(), twins: new Map(), painted: new WeakMap(), kinds: new Map(),
      defs: null, sheets: [], inks: new Map(), unveiled: new Map(), unveilRule: null,
      muted: new Set(), hoverLink: null, focusLink: null, captionWatch: null, band: null,
      tip: null, tipFor: '', pointer: null, unsubscribe: [], themeObserver: null, bpc: null, ranges: 0
    };
    state = st;
    html.classList.add(CLS.on);
    const layer = ctx.layer('fixed');
    layer.classList.add('lens-shannon-layer');
    st.tip = document.createElement('div');
    st.tip.className = 'lens-shannon-tip';
    st.tip.setAttribute('aria-hidden', 'true');
    layer.append(st.tip);
    makeDefs(st, layer);
    return st;
  }

  /* ---------------------------------------------------------------------------
   * Filters: a photo's ink, and the blank sheet of an image whose drawing is pending
   * ------------------------------------------------------------------------- */
  // The lens's SVG filters live in its own fixed layer (gone with it after exit). Two sheets:
  // the hidden original of an image whose drawing is not shown yet is painted as a hairline
  // frame round its box (SHEET_LINE wide, in the colour of a photo's hairline) on nothing, so a
  // pending image reads as a framed blank sheet that fills in, never as a hole in the page.
  // The sheet ignores the image's pixels: a flood, less itself moved in by the line width from
  // both corners. One sheet for the page's images, one for the lightbox's (on its backdrop).
  // html.lens-shannon-sheets tells shannon.css the filters exist (until then: opacity 0).
  function makeDefs(st, layer) {
    try {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden';
      for (const id of [SHEET_ID, SHEET_FIXED_ID]) {
        const filter = document.createElementNS(SVG_NS, 'filter');
        const attrs = { id, x: '0', y: '0', width: '1', height: '1', filterUnits: 'objectBoundingBox', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' };
        Object.entries(attrs).forEach(([k, v]) => filter.setAttribute(k, v));
        filter.innerHTML = `<feFlood flood-color="transparent" result="ink"/><feOffset in="ink" dx="${SHEET_LINE}" dy="${SHEET_LINE}" result="a"/>` +
          `<feOffset in="ink" dx="${-SHEET_LINE}" dy="${-SHEET_LINE}" result="b"/><feComposite in="a" in2="b" operator="in" result="inner"/>` +
          '<feComposite in="ink" in2="inner" operator="out"/>';
        svg.append(filter);
        st.sheets.push(filter.firstElementChild);
      }
      layer.append(svg);
      st.defs = svg;
      html.classList.add(CLS.sheets);          // the sheets are clear until commit() paints them
    } catch (error) { st.defs = null; }
  }
  // The sheets' hairlines: a photo's frame tone in the page's colours (the lightbox: in its
  // own). Reads, then writes (paintSheets).
  function sheetColours() {
    const main = document.getElementById('main-content') || document.body;
    const lightbox = document.getElementById('lightbox-img');
    return [coloursOn(main), lightbox ? imageColours(lightbox) : null].map(colours => colours && css(photoColour(colours, PHOTO_FRAME)));
  }
  function paintSheets(st, colours = sheetColours()) {
    if (!st.defs) return;
    colours.forEach((colour, k) => { if (colour && st.sheets[k].getAttribute('flood-color') !== colour) st.sheets[k].setAttribute('flood-color', colour); });
  }
  // The ink filter of a photo drawn on `colours` (one per colour pair, made on first use): its
  // tones, greys, become the ink mixed toward the ground (photoColour) as they are painted.
  function inkFilter(st, colours) {
    const key = `${colours.bg}|${colours.ink}`;
    let entry = st.inks.get(key);
    if (!entry && st.defs) {
      if (st.inks.size >= INK_FILTERS_MAX) return [...st.inks.values()].pop().ref;
      const id = `${INK_ID}${st.inks.size}`;
      const filter = document.createElementNS(SVG_NS, 'filter');
      const attrs = { id, x: '0', y: '0', width: '1', height: '1', 'color-interpolation-filters': 'sRGB' };
      Object.entries(attrs).forEach(([k, v]) => filter.setAttribute(k, v));
      const [r, g, b] = inkTables(colours);
      filter.innerHTML = `<feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer>`;
      st.defs.append(filter);
      entry = { ref: `url("#${id}")`, colours };
      st.inks.set(key, entry);
    }
    return entry ? entry.ref : '';
  }
  // A photo's overlay takes the ink filter of the colours behind its image now.
  function inkPhoto(st, overlay, colours = imageColours(overlay.img)) {
    const ref = inkFilter(st, colours);
    if (overlay.canvas.style.filter !== ref) overlay.canvas.style.filter = ref;
  }

  // Collect, model, pairs and runs: a new page model, or null when abandoned.
  async function build(st) {
    const { signal } = st.ctx;
    stats.builds++;
    // Reading styles and boxes needs a clean layout: wait for the page's next frame to have
    // done it (the lens stylesheet and layers just arrived), so no slice pays for a forced one.
    await afterFrame(st.ctx);
    if (signal.aborted) return null;
    let began = performance.now();
    const page = await sliced(collectSteps(st.ctx.scope), signal, 'collect');
    if (!page || signal.aborted) return null;
    stats.collectMs = +(performance.now() - began).toFixed(1);
    began = performance.now();
    let model = lastModel && lastModel.text === page.text ? lastModel : null;
    if (!model) {
      const made = await sliced(modelSteps(page.text), signal, 'model');
      if (!made || signal.aborted) return null;
      model = { text: page.text, bits: made.bits, total: made.total };
      lastModel = model;
    }
    stats.modelMs = +(performance.now() - began).toFixed(1);
    began = performance.now();
    page.bits = model.bits;
    page.total = model.total;
    page.levels = new Uint8Array(page.text.length);
    for (let i = 0; i < page.levels.length; i++) page.levels[i] = levelOf(model.bits[i]);
    const paired = await sliced(pairSteps(page), signal, 'pairs');
    if (!paired || signal.aborted) return null;
    page.pairs = paired.pairs; page.nodePair = paired.nodePair;
    page.runCount = await sliced(runSteps(page), signal, 'runs');
    if (page.runCount === null || signal.aborted) return null;
    page.imageAt = new Map(page.images.map(({ img, at }) => [img, at]));
    page.inked = page.blocks.filter(block => block.runs.length);
    stats.runsMs = +(performance.now() - began).toFixed(1);
    page.styles = null;                        // computed styles are live objects: let them go
    return page;
  }

  // The lens stylesheet (attached by the core), where the ::highlight() rules go. Without it
  // (it should always be there) a constructed sheet is adopted and handed back on exit.
  function sheetOf(st) {
    if (st.sheet) return st.sheet;
    st.sheet = [...document.styleSheets].find(sheet => (sheet.href || '').includes(SHEET_HREF)) || null;
    if (!st.sheet && typeof CSSStyleSheet === 'function') {
      try {
        st.adopted = new CSSStyleSheet();
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, st.adopted];
        st.sheet = st.adopted;
      } catch (error) { st.adopted = null; }
    }
    return st.sheet;
  }
  function clearRules(st, ground = false) {
    const sheet = st.sheet;
    const gone = ground && st.groundRule ? [...st.rules, st.groundRule] : st.rules;
    if (sheet) {
      for (const rule of gone) {
        const index = [...sheet.cssRules].indexOf(rule);
        if (index >= 0) sheet.deleteRule(index);
      }
    }
    st.rules = [];
    if (ground) st.groundRule = null;
  }
  // The page's own ground as a custom property on html.lens-shannon: the caption set as a
  // subtitle at the viewport's foot lies on it (shannon.css).
  function writeGround(st, rgb) {
    const sheet = sheetOf(st);
    if (!sheet) return;
    if (!st.groundRule) {
      try {
        const index = sheet.insertRule('html.lens-shannon { --lens-shannon-ground: transparent; }', sheet.cssRules.length);
        st.groundRule = sheet.cssRules[index];
      } catch (error) { return; }
    }
    st.groundRule.style.setProperty('--lens-shannon-ground', css(rgb));
  }
  // One rule per highlight: the pair's ink mixed toward its ground at the level's share.
  function writeRules(st, pairs) {
    clearRules(st);
    const sheet = sheetOf(st);
    if (!sheet) return;
    st.pairs = pairs;
    pairs.forEach((pair, p) => {
      for (let level = 0; level < TOP; level++) {
        try {
          const index = sheet.insertRule(`::highlight(${PREFIX}${p}-${level}) { color: ${ruleColour(pair, level)}; }`, sheet.cssRules.length);
          const rule = sheet.cssRules[index];
          rule.shannon = { pair: p, level };
          st.rules.push(rule);
        } catch (error) { /* an old engine: that level keeps its colour */ }
      }
    });
  }
  // The rules' colours again, from the pairs' inks and grounds now (a theme change).
  function paintRules(st) {
    for (const rule of st.rules) rule.style.setProperty('color', ruleColour(st.pairs[rule.shannon.pair], rule.shannon.level));
  }
  // The highlight objects, registered once per activation (empty ones cost nothing).
  function ensureHighlights(st) {
    if (st.highlights.length) return;
    for (let p = 0; p < COMBOS_MAX; p++) {
      for (let level = 0; level < TOP; level++) {
        const name = `${PREFIX}${p}-${level}`;
        const highlight = new Highlight();
        CSS.highlights.set(name, highlight);
        st.highlights.push(highlight);
        st.names.push(name);
      }
    }
  }

  /* ---------------------------------------------------------------------------
   * Windowing: ranges only for blocks near the viewport
   * ------------------------------------------------------------------------- */
  const rangeOf = run => run.range || (run.range = new StaticRange({ startContainer: run.node, startOffset: run.from, endContainer: run.node, endOffset: run.to }));
  // A run enters its highlight (unless its link is under the pointer or focused) and leaves it.
  function addRun(st, run) {
    if (run.on || run.off || st.muted.has(run)) return;
    st.highlights[run.hl].add(rangeOf(run)); run.on = true; st.ranges++;
  }
  function dropRun(st, run) {
    if (!run.on) return;
    st.highlights[run.hl].delete(run.range); run.on = false; st.ranges--;
  }
  function showBlock(st, block) {
    if (block.shown) return;
    block.shown = true;
    for (const run of block.runs) addRun(st, run);
  }
  function hideBlock(st, block) {
    if (!block.shown) return;
    block.shown = false;
    for (const run of block.runs) { dropRun(st, run); run.range = null; }
  }
  // A box within NEAR_SCREENS of a viewport h px tall (what the IntersectionObserver reports).
  const isNear = (r, h) => (r.width > 0 || r.height > 0) && r.bottom >= -h * NEAR_SCREENS && r.top <= h * (1 + NEAR_SCREENS);
  // Where a block stands in the document (for jumps), from its box now.
  const place = (block, r) => { block.top = r.top + window.scrollY; block.bottom = r.bottom + window.scrollY; block.box = r.width > 0 || r.height > 0; };
  function measureBlocks(st) {
    if (!st.page) return;
    for (const block of st.page.inked) place(block, block.el.getBoundingClientRect());
  }
  // A jump (scroll events come before the frame is painted): the blocks it lands on are shown
  // now; the observer, which reports after the paint, hides them again once they are far.
  function showLanded(st) {
    const page = st.page;
    if (!page || st.ctx.signal.aborted) return;
    const began = performance.now();
    const h = window.innerHeight; const y = window.scrollY;
    const lo = y - h * JUMP_MARGIN; const hi = y + h * (1 + JUMP_MARGIN);
    for (const block of page.inked) {
      if (block.shown || block.held || !block.box || block.bottom < lo || block.top > hi) continue;
      block.near = true;
      showBlock(st, block);
    }
    const ms = performance.now() - began;
    if (ms > stats.jumpMaxMs) stats.jumpMaxMs = +ms.toFixed(2);
  }
  function watch(st) {
    if (st.observer) st.observer.disconnect();
    const page = st.page;
    const byEl = new Map();
    page.inked.forEach(block => byEl.set(block.el, block));
    const onIntersect = records => {
      if (st.ctx.signal.aborted || st.page !== page) return;
      const began = performance.now();
      for (const record of records) {
        const block = byEl.get(record.target);
        if (!block) continue;
        block.near = record.isIntersecting;
        if (block.held) continue;
        if (block.near) showBlock(st, block); else hideBlock(st, block);
      }
      const ms = performance.now() - began;
      if (ms > stats.intersectMaxMs) stats.intersectMaxMs = +ms.toFixed(2);
    };
    const options = { rootMargin: `${NEAR_SCREENS * 100}% 0px` };
    // The document as root, so the margin also applies inside a frame.
    try { st.observer = new IntersectionObserver(onIntersect, { ...options, root: document }); } catch (error) { st.observer = new IntersectionObserver(onIntersect, options); }
    byEl.forEach((block, el) => st.observer.observe(el));
  }

  // Swap in a page model: rules, highlights, near blocks (measured now, so nothing flickers),
  // and the observer. `sweeping` holds the blocks on screen back for the sweep and returns its
  // plan, { held, from, to } (held is empty otherwise). Everything is measured before anything
  // is written: a read after the new rules would force the browser to restyle the whole page
  // inside this task (16 ms on the longest paper page) instead of in the next frame's own
  // style pass.
  function commit(st, page, sweeping = false) {
    const began = performance.now();
    // Reads: the page's ground (a dark one gets a dark tooltip; paper pages are always light),
    // and where each block with runs stands.
    const ground = oklab(backgroundOf(document.getElementById('main-content') || document.body, new Map(), el => getComputedStyle(el)));
    const own = pageGround();
    const frames = sheetColours();
    const h = window.innerHeight;
    const near = new Set(); const held = [];
    for (const block of page.inked) {
      const r = block.el.getBoundingClientRect();
      place(block, r);
      block.near = isNear(r, h);
      if (!block.near) continue;
      if (sweeping && r.bottom > 0 && r.top < h) held.push(block); else near.add(block);
    }
    // For the sweep: the stretch of text on screen, from the text nodes of the blocks on screen
    // that are themselves on screen (a long section is on screen while most of its text is
    // not). Every block with text inside that stretch goes with the sweep. An image on screen
    // is reached by the front at the first text that stands beside or below it, or at its own
    // place in the text if that comes first (on a phone the portrait stands above the text that
    // precedes it in the document).
    let from = Infinity; let to = -Infinity;
    const imageFront = new Map();
    if (held.length) {
      const probe = document.createRange();
      const boxes = [];
      for (const block of held) {
        for (const n of block.nodes) {
          probe.selectNodeContents(page.nodes[n]);
          const r = probe.getBoundingClientRect();
          if (r.bottom > 0 && r.top < h && (r.width > 0 || r.height > 0)) {
            from = Math.min(from, page.nodeStart[n]); to = Math.max(to, page.nodeEnd[n]);
            boxes.push([page.nodeStart[n], r.bottom]);
          }
        }
      }
      if (from >= to) for (const block of held) { from = Math.min(from, block.first); to = Math.max(to, block.last); }
      const onScreen = new Set(held);
      for (const block of page.inked) {
        if (onScreen.has(block) || block.last <= from || block.first >= to) continue;
        near.delete(block); held.push(block);
      }
      for (const { img, at } of page.images) {
        const r = img.getBoundingClientRect();
        if (!(r.bottom > 0 && r.top < h && r.width > 0)) continue;
        let first = at;
        for (const [start, bottom] of boxes) if (bottom > r.top && start < first) first = start;
        imageFront.set(img, first);
      }
    }
    // Writes.
    ensureHighlights(st);
    if (st.page) st.page.blocks.forEach(block => { block.shown = false; block.runs.forEach(run => { run.range = null; run.on = false; }); });
    st.highlights.forEach(hl => hl.clear());
    st.ranges = 0;
    st.muted.clear();
    st.page = page;
    st.imageFront = imageFront;
    st.bpc = page.text.length ? page.total / page.text.length : 0;
    writeRules(st, page.pairs);
    writeGround(st, own);
    paintSheets(st, frames);
    html.classList.toggle(CLS.dark, ground[0] < 0.5);
    near.forEach(block => showBlock(st, block));
    held.forEach(block => { block.held = true; });
    mute(st);
    watch(st);
    stats.commits++;
    stats.commitMs = +(performance.now() - began).toFixed(1);
    return { held, from, to };
  }

  /* ---------------------------------------------------------------------------
   * Links: the site's own hover and focus colours
   * ------------------------------------------------------------------------- */
  const linkOf = (st, el) => {
    const a = el instanceof Element ? el.closest('a[href]') : null;
    return a && st.ctx.scope.some(root => root && root.contains(a)) ? a : null;
  };
  // The runs of the hovered and the focused link leave their highlights; the others return.
  function mute(st) {
    const page = st.page;
    const want = new Set();
    if (page) {
      if (!page.nodeIndex) page.nodeIndex = new Map(page.nodes.map((n, i) => [n, i]));
      for (const link of [st.hoverLink, st.focusLink]) {
        if (!link || !link.isConnected) continue;
        const nodes = new Set();
        const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) if (page.nodeIndex.has(n)) nodes.add(n);
        const blocks = new Set([...nodes].map(n => page.blocks[page.nodeBlock[page.nodeIndex.get(n)]]));
        blocks.forEach(block => block.runs.forEach(run => { if (nodes.has(run.node)) want.add(run); }));
      }
    }
    for (const run of [...st.muted]) {
      if (want.has(run)) continue;
      st.muted.delete(run);
      if (run.block.shown && !run.block.held) addRun(st, run);
    }
    for (const run of want) { st.muted.add(run); dropRun(st, run); }
  }

  /* ---------------------------------------------------------------------------
   * Images
   * ------------------------------------------------------------------------- */
  // The residual overlays, one media handle per activation.
  function startMedia(st) {
    const { ctx } = st;
    if (ctx.signal.aborted) return Promise.resolve(null);
    // fixed: the photography lightbox's photograph (outside the scope) is drawn too, as the
    // gallery's are; the lightbox's arrows and close glyph stay over it (media.js).
    st.mediaWanted = ctx.media({ render: source => residual(st, source, ctx.signal), fixed: true }).then(media => {
      if (ctx.signal.aborted || state !== st) return null;
      st.media = media;
      media.each(overlay => placeOverlay(st, overlay));
      return media;
    }, () => null);
    return st.mediaWanted;
  }
  // The renditions this activation drew, by canvas (and by image and size, for the copy the
  // helper makes when two images share a drawing); canvases the helper let go are forgotten.
  // st.kinds remembers each image's kind by URL, at any size (for jumps: unveilLanded).
  const twinKey = (img, W, H) => `${img.currentSrc || img.src}|${W}x${H}`;
  function remember(st, canvas, rec) {
    for (const [known, r] of st.renditions) if (!known.width) { st.renditions.delete(known); if (st.twins.get(twinKey(r.img, r.W, r.H)) === r) st.twins.delete(twinKey(r.img, r.W, r.H)); }
    st.renditions.set(canvas, rec);
    st.twins.set(twinKey(rec.img, rec.W, rec.H), rec);
    st.kinds.set(rec.img.currentSrc || rec.img.src, rec.kind);
    st.painted.set(canvas, rec.theme);
  }
  function recordOf(st, overlay) {
    const canvas = overlay.canvas;
    let rec = st.renditions.get(canvas);
    if (!rec) {
      rec = st.twins.get(twinKey(overlay.img, canvas.width, canvas.height)) || null;
      if (rec) { st.renditions.set(canvas, rec); st.painted.set(canvas, rec.theme); }
    }
    return rec;
  }
  // A transparent graphic is composed again on the page's ground now (from its own pixels). A
  // photograph needs no work (its ink filter follows the theme), nor does an opaque graphic,
  // which lies on its own ground.
  function repaintSteps(st, canvas, rec, colours) {
    st.painted.set(canvas, st.theme);
    rec.theme = st.theme;
    if (!canvas.width || rec.kind !== 'graphic' || !rec.rgba) return null;
    stats.repaints++;
    return drawSteps(rec, canvas.getContext('2d'), colours || imageColours(rec.img));
  }
  const stale = (st, canvas) => st.painted.get(canvas) !== st.theme;
  // After a theme change: every photo takes the ink filter of its new colours (a style write;
  // the filter's tables are made once per colour pair); a transparent graphic on screen is
  // composed again now (this runs before the next paint), the others in slices, or when the
  // helper shows them again (placeOverlay). The plan reads, recolour() writes.
  function recolourPlan(st) {
    const plan = { photos: [], now: [], later: [] };
    if (!st.media) return plan;
    const h = window.innerHeight; const w = window.innerWidth;
    for (const overlay of st.media.overlays) {
      if (overlay.kind === 'photo') { plan.photos.push([overlay, imageColours(overlay.img)]); continue; }
      const rec = recordOf(st, overlay);
      if (!rec) continue;
      if (!rec.rgba) { plan.now.push([overlay.canvas, rec, null]); continue; }
      const r = overlay.canvas.getBoundingClientRect();
      if (r.bottom > 0 && r.top < h && r.right > 0 && r.left < w) plan.now.push([overlay.canvas, rec, imageColours(rec.img)]);
      else plan.later.push([overlay.canvas, rec]);
    }
    return plan;
  }
  function recolour(st, plan) {
    for (const [overlay, colours] of plan.photos) inkPhoto(st, overlay, colours);
    for (const [canvas, rec, colours] of plan.now) {
      if (!colours) { st.painted.set(canvas, st.theme); rec.theme = st.theme; continue; }   // on its own ground: nothing to do
      const steps = repaintSteps(st, canvas, rec, colours);
      if (steps) drain(steps);
    }
    if (!plan.later.length) return;
    const theme = st.theme;
    (async () => {
      for (const [canvas, rec] of plan.later) {
        await yieldTask();
        if (st.ctx.signal.aborted || st.theme !== theme) return;
        if (!stale(st, canvas)) continue;
        const steps = repaintSteps(st, canvas, rec);
        if (steps && !(await sliced(steps, st.ctx.signal, 'image', RENDER_SLICE_MS))) return;
      }
    })();
  }
  // A new overlay (the helper sets its style afresh each time it shows one): a photo takes its
  // ink filter; then it stays hidden until the reading front reaches its image, else shows:
  // at once while the page arrives (it is still hidden, or fading in: the settled state) and
  // with reduced motion, else with a short fade on its framed sheet once the lens has settled.
  // A graphic drawn in an older theme is composed again first.
  function placeOverlay(st, overlay) {
    const canvas = overlay.canvas;
    if (overlay.kind === 'photo') inkPhoto(st, overlay);
    const rec = recordOf(st, overlay);
    if (rec && stale(st, canvas)) { const steps = repaintSteps(st, canvas, rec); if (steps) drain(steps); }
    const src = overlay.img.getAttribute('src');
    if (st.revealed.get(canvas)) { veil(st, src, 0); return; }
    const arriving = html.hasAttribute('data-lens-arriving') || html.hasAttribute('data-lens-revealing');
    if (st.settled || passed(st, overlay.img)) {
      if (st.ctx.motion.matches || arriving) { canvas.style.opacity = '1'; st.revealed.set(canvas, true); veil(st, src, 0); return; }
      canvas.style.opacity = '0';
      st.revealed.set(canvas, 'pending');
      st.ctx.frame(function fadeIn() {
        const ms = st.settled ? LATE_FADE_MS : IMAGE_FADE_MS;
        if (canvas.isConnected) { canvas.style.transition = `opacity ${ms}ms ease`; canvas.style.opacity = '1'; }
        st.revealed.set(canvas, true);
        veil(st, src, ms + 50);              // an unveiled original goes once its drawing covers it
        return false;
      });
      return;
    }
    canvas.style.opacity = '0';
  }

  // Jumps: the helper attaches the overlays of the images a jump lands on a frame or two later
  // (its observer reports after the paint). Until then a graphic shows its own original (its
  // drawing is its own colours, faded), not its blank sheet; a photograph keeps its sheet. The
  // kind is the one the helper gave the image before (at any size), else a guess: an SVG, or
  // any image on a paper page, is a graphic. Runs before the paint (scroll events, frames).
  const SVG_SRC = /\.svgz?(?:[?#]|$)/i;
  function unveilLanded(st) {
    const page = st.page;
    if (!page || !st.media || !st.settled || !html.classList.contains(CLS.covered)) return;
    const h = window.innerHeight; const w = window.innerWidth;
    let drawn = null;
    let added = false;
    for (const { img } of page.images) {
      const src = img.getAttribute('src');
      if (!src || src.includes('//') || st.unveiled.has(src) || !img.complete || !img.isConnected) continue;
      const kind = st.kinds.get(img.currentSrc || img.src) || (SVG_SRC.test(src) || st.ctx.page.kind === 'paper' ? 'graphic' : 'photo');
      if (kind !== 'graphic') continue;
      const r = img.getBoundingClientRect();
      if (!(r.bottom > 0 && r.top < h && r.right > 0 && r.left < w && r.width >= 24 && r.height >= 24)) continue;
      if (!drawn) drawn = new Set(st.media.overlays.map(o => o.img));
      if (drawn.has(img)) continue;
      st.unveiled.set(src, 0);
      added = true;
    }
    if (added) writeUnveiled(st);
  }
  // The original of `src` goes under its drawing again, after `ms`.
  function veil(st, src, ms) {
    if (!st.unveiled.has(src)) return;
    clearTimeout(st.unveiled.get(src));
    const done = () => { if (state === st && st.unveiled.delete(src)) writeUnveiled(st); };
    if (ms > 0) st.unveiled.set(src, setTimeout(done, ms)); else done();
  }
  // One rule in the lens's sheet shows the unveiled originals (by their src attribute: no
  // markup changes); it outranks the stylesheet's rules that hide them.
  function writeUnveiled(st) {
    const sheet = sheetOf(st);
    if (!sheet) return;
    if (st.unveilRule) {
      const index = [...sheet.cssRules].indexOf(st.unveilRule);
      if (index >= 0) sheet.deleteRule(index);
      st.unveilRule = null;
    }
    if (!st.unveiled.size) return;
    const list = [...st.unveiled.keys()].map(src => `[src="${CSS.escape(src)}"]`).join(', ');
    try {
      const index = sheet.insertRule(`:root.lens-shannon.lens-shannon-covered ${SCOPE_IMG}:is(${list}) { opacity: 1 !important; filter: none !important; }`, sheet.cssRules.length);
      st.unveilRule = sheet.cssRules[index];
    } catch (error) { st.unveilRule = null; }
  }
  function passed(st, img) {
    if (st.front === Infinity) return true;
    const at = st.imageFront.has(img) ? st.imageFront.get(img) : st.page && st.page.imageAt.get(img);
    return at !== undefined && st.front >= at;
  }
  function revealPassed(st) {
    if (!st.media) return;
    for (const overlay of st.media.overlays) {
      const canvas = overlay.canvas;
      if (st.revealed.get(canvas) || !passed(st, overlay.img)) continue;
      canvas.style.transition = `opacity ${IMAGE_FADE_MS}ms ease`;
      canvas.style.opacity = '1';
      st.revealed.set(canvas, true);
    }
  }
  // The originals go under their drawings (html.lens-shannon-covered: opacity 0, from the
  // stylesheet). After a sweep this waits until the drawings near the viewport have faded in,
  // so no original vanishes under a half-shown drawing.
  async function cover(st, wait) {
    if (wait) {
      const media = await st.mediaWanted;
      if (media) await media.ready;
      if (!st.ctx.motion.matches) await new Promise(resolve => setTimeout(resolve, IMAGE_FADE_MS + 50));
    }
    if (!st.ctx.signal.aborted && state === st) html.classList.add(CLS.covered);
  }

  /* ---------------------------------------------------------------------------
   * The reading front (enter)
   * ------------------------------------------------------------------------- */
  // The text on screen, swept in document order: the held blocks' runs settle once the band
  // has passed them, and the characters inside the band are drawn at an intermediate level.
  // commit() measured the stretch [from, to) and chose the held blocks.
  function sweep(st, { held, from, to }) {
    const { ctx } = st;
    const page = st.page;
    if (!held.length) { st.front = Infinity; revealPassed(st); return Promise.resolve(); }
    const runs = held.flatMap(block => block.runs).sort((a, b) => a.c0 - b.c0);
    const heldSet = new Set(held.map(block => page.blocks.indexOf(block)));
    const band = Math.max(SWEEP_BAND_MIN, SWEEP_BAND * (to - from));
    const span = to - from + band;
    st.sweepInfo = { from, to, band };
    let next = 0;                                   // the first run not yet settled
    let bandRanges = [];                            // [highlight, range] drawn this frame
    st.front = from;
    const clearBand = () => { bandRanges.forEach(([h, r]) => h.delete(r)); bandRanges = []; };
    const drawBand = (lo, f) => {
      clearBand();
      const { text, levels, charNode, charOff, nodeBlock, nodePair, nodes } = page;
      let node = -1; let step = -1; let a = 0; let b = 0; let hl = -1;
      const flush = () => {
        if (node >= 0 && step >= 0 && step < TOP) {
          const range = new StaticRange({ startContainer: nodes[node], startOffset: a, endContainer: nodes[node], endOffset: b });
          const h = st.highlights[hl];
          h.add(range); bandRanges.push([h, range]);
        }
        node = -1; step = -1;
      };
      const end = Math.min(Math.ceil(f), to);
      for (let j = Math.max(from, Math.floor(lo)); j < end; j++) {
        const n = charNode[j];
        if (n < 0 || nodePair[n] < 0 || !heldSet.has(nodeBlock[n]) || isSpace(text.charCodeAt(j))) continue;
        const l = levels[j];
        const t = smooth(clamp01((f - j) / band));
        const s = l + Math.round((TOP - l) * (1 - t));
        if (n === node && s === step) { b = charOff[j] + 1; continue; }
        flush();
        if (s >= TOP) continue;
        node = n; step = s; a = charOff[j]; b = a + 1; hl = nodePair[n] * TOP + s;
      }
      flush();
    };
    return new Promise(resolve => {
      const began = performance.now();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearBand();
        if (!ctx.signal.aborted) {
          for (; next < runs.length; next++) addRun(st, runs[next]);
          held.forEach(block => {
            block.held = false; block.shown = true;
            if (!block.near) hideBlock(st, block);
          });
          st.front = Infinity;
          revealPassed(st);
        }
        resolve();
      };
      ctx.signal.addEventListener('abort', finish, { once: true });
      ctx.frame(function front() {
        if (done) return false;
        const t0 = performance.now();
        const p = hold === null ? Math.min(1, (t0 - began) / SWEEP_MS) : hold;
        // Mostly an even reading pace, eased at both ends.
        const eased = 0.6 * p + 0.4 * (1 - Math.cos(Math.PI * p)) / 2;
        const f = from + eased * span;
        st.front = f;
        const lo = f - band;
        while (next < runs.length && runs[next].c1 < lo) addRun(st, runs[next++]);
        drawBand(next < runs.length ? Math.min(runs[next].c0, lo) : lo, f);
        revealPassed(st);
        const ms = performance.now() - t0;
        stats.sweepFrames++; stats.sweepTotalMs += ms; if (ms > stats.sweepMaxMs) stats.sweepMaxMs = +ms.toFixed(2);
        if (p >= 1) { finish(); return false; }
        return true;
      });
    });
  }

  /* ---------------------------------------------------------------------------
   * Following the page: late content, layout, jumps, links and the theme
   * ------------------------------------------------------------------------- */
  function bind(st) {
    const { ctx } = st;
    if (ctx.signal.aborted) return;
    const schedule = () => { if (!st.settled) { st.dirty = true; return; } rebuild(st); };
    st.schedule = schedule;
    st.unsubscribe.push(ctx.onContentChange(schedule));
    st.unsubscribe.push(ctx.onLayoutChange(() => { measureBlocks(st); schedule(); if (st.captionEl) ctx.frame(st.band); }));
    // The theme toggle changes every colour: followed before the next frame is painted.
    st.themeObserver = new MutationObserver(() => onTheme(st));
    st.themeObserver.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    // The caption (the core's, on <body>): when it is a subtitle at the viewport's foot, its
    // band follows the lines of text beneath it (placeBand), as it comes, moves and scrolls.
    st.band = () => { placeBand(st); return false; };
    st.captionWatch = new MutationObserver(() => {
      const el = document.querySelector('body > .lenses-caption');
      if (el && el !== st.captionEl) st.captionWatch.observe(el, { attributes: true, attributeFilter: ['class'] });
      st.captionEl = el;
      if (el) ctx.frame(st.band);
    });
    st.captionWatch.observe(document.body, { childList: true });
    ctx.signal.addEventListener('abort', () => {
      if (st.themeObserver) st.themeObserver.disconnect();
      if (st.captionWatch) st.captionWatch.disconnect();
    }, { once: true });
    const listen = (target, type, fn) => target.addEventListener(type, fn, { passive: true, signal: ctx.signal });
    // Hover: a mouse or a pen inspects the word under it.
    const inspect = () => ctx.frame(st.hover || (st.hover = () => { hover(st); return false; }));
    listen(window, 'pointermove', event => {
      if (event.pointerType === 'touch') return;
      st.pointer = { x: event.clientX, y: event.clientY };
      inspect();
    });
    // Scrolling: a jump's blocks at once, the originals of the graphics it lands on until
    // their drawings come, the caption's band, and the word under a resting pointer.
    listen(window, 'scroll', () => { showLanded(st); unveilLanded(st); if (st.captionEl) ctx.frame(st.band); if (st.pointer) inspect(); });
    // A fragment link (a paper's section links, the skip link) scrolls in the next frame's own
    // layout pass, after the frame callbacks, and its scroll event comes only a frame later:
    // a frame callback measures the blocks (the read lays the page out, which makes the jump)
    // and shows the ones it lands on before that frame is painted. The page's own click
    // handler may open a <details> first (Cite), which is why the blocks are measured again.
    const land = st.land || (st.land = () => {
      if (st.ctx.signal.aborted) return false;
      const began = performance.now();
      measureBlocks(st);
      showLanded(st);
      unveilLanded(st);
      const ms = performance.now() - began;
      if (ms > stats.jumpMaxMs) stats.jumpMaxMs = +ms.toFixed(2);
      return false;
    });
    const here = () => location.href.split('#')[0];
    listen(document, 'click', event => {
      const a = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (a && a.hash && a.href.split('#')[0] === here()) ctx.frame(land);
    });
    listen(window, 'hashchange', () => ctx.frame(land));
    listen(window, 'popstate', () => ctx.frame(land));
    // The pointer leaves the window: the tooltip goes.
    listen(window, 'pointerout', event => {
      if (!event.relatedTarget) { st.pointer = null; hideTip(st); }
      if (!event.relatedTarget && st.hoverLink) { st.hoverLink = null; mute(st); }
    });
    // A link under the mouse (or a pen), or focused from the keyboard, shows its own colours.
    listen(document, 'pointerover', event => {
      if (event.pointerType === 'touch') return;
      const link = linkOf(st, event.target);
      if (link !== st.hoverLink) { st.hoverLink = link; mute(st); }
    });
    listen(document, 'focusin', event => {
      const link = linkOf(st, event.target);
      const visible = !!link && (() => { try { return link.matches(':focus-visible'); } catch (error) { return true; } })();
      if ((visible ? link : null) !== st.focusLink) { st.focusLink = visible ? link : null; mute(st); }
    });
    listen(document, 'focusout', event => {
      if (st.focusLink && !(event.relatedTarget && st.focusLink.contains(event.relatedTarget))) { st.focusLink = null; mute(st); }
    });
  }

  // The theme toggle: the site's colour transitions are suspended for one style pass, so every
  // colour read now is the new theme's; the rules, the tooltip and the drawings on screen follow
  // before the next frame is painted. Every read comes before any write (a read after a write
  // would restyle the page again). Then the page model is rebuilt once (the pairs may regroup).
  function onTheme(st) {
    if (st.ctx.signal.aborted || state !== st) return;
    const began = performance.now();
    st.theme++;
    html.classList.add(CLS.still);
    try {
      const memo = new Map(); const styles = new Map();
      const style = el => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s); } return s; };
      // Reads. The first restyles the page in the new theme (the browser's own work, which the
      // next frame would do otherwise): timed apart.
      void style(document.body).color;
      stats.themeStyleMs = +(performance.now() - began).toFixed(1);
      for (const pair of st.pairs) {
        const found = pair.el && pair.el.isConnected ? pairOf(pair.el, memo, style) : null;
        if (found) { pair.ink = found.ink; pair.bg = found.bg; }
      }
      const moves = regroupPlan(st, memo, style);
      const frames = sheetColours();
      const ground = oklab(backgroundOf(document.getElementById('main-content') || document.body, memo, style));
      const own = pageGround();
      const plan = recolourPlan(st);
      // Writes.
      regroup(st, moves);
      paintRules(st);
      paintSheets(st, frames);
      html.classList.toggle(CLS.dark, ground[0] < 0.5);
      writeGround(st, own);
      recolour(st, plan);
      // The ground the next page is hidden over follows the theme: the core stored the old
      // theme's (sessionStorage 'lenses-ground', next to 'lenses-active'; core.js header).
      try {
        if (sessionStorage.getItem('lenses-active') === 'shannon' && sessionStorage.getItem('lenses-ground')) sessionStorage.setItem('lenses-ground', hex(own));
      } catch (error) { /* storage is optional */ }
    } finally {
      html.classList.remove(CLS.still);
    }
    stats.themeMs = +(performance.now() - began).toFixed(1);
    st.themeChanged = true;
    if (st.schedule) st.schedule();
  }

  // After a theme change, before the next paint. The pairs were quantised in the old theme:
  // colours that were one there (within PAIR_MERGE) may be far apart in the new one (the body
  // text and the strong text of a post, the bio and the links' separators). So every element
  // that holds a run on or near the screen is read again: a run whose element's new colours
  // are no longer within PAIR_MERGE of its pair's new colours moves (same level) to the pair it
  // is one with now, or, with none, leaves the highlights (its own new colour at full ink)
  // until the page model is rebuilt (shortly after: rebuild()). The far runs wait for that.
  function regroupPlan(st, memo, style) {
    const page = st.page;
    const moves = [];                         // [run, its pair now (-1: none)]
    if (!page) return moves;
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= PAIR_MERGE;
    const now = st.pairs.map(pair => [oklab(pair.ink), oklab(pair.bg)]);
    const verdicts = new Map();               // element -> its pair now, or -1
    for (const block of page.inked) {
      if (!block.shown && !block.held) continue;
      for (const run of block.runs) {
        if (run.off) continue;
        const el = run.node.parentElement;
        const p = (run.hl / TOP) | 0;
        let q = verdicts.get(el);
        if (q === undefined) {
          const found = el ? pairOf(el, memo, style) : null;
          const ink = found && oklab(found.ink); const bg = found && oklab(found.bg);
          q = !found ? -1 : near(ink, now[p][0]) && near(bg, now[p][1]) ? p : now.findIndex(([i, b]) => near(ink, i) && near(bg, b));
          verdicts.set(el, q);
        }
        if (q !== p) moves.push([run, q]);
      }
    }
    return moves;
  }
  function regroup(st, moves) {
    const page = st.page;
    for (const [run, q] of moves) {
      page.nodePair[run.n] = q;
      if (q < 0) { dropRun(st, run); run.off = true; continue; }
      const hl = q * TOP + run.hl % TOP;
      if (run.on) { st.highlights[run.hl].delete(run.range); st.highlights[hl].add(run.range); }
      run.hl = hl;
    }
    stats.regrouped = moves.length;
  }

  // A new page model when the text, its nodes or the colours changed; one build at a time.
  function rebuild(st) {
    if (st.building) { st.again = true; return; }
    st.building = (async () => {
      do {
        st.again = false;
        const theme = st.themeChanged; st.themeChanged = false;
        const page = await build(st);
        if (!page || st.ctx.signal.aborted || state !== st) return;
        const old = st.page;
        const same = old && !theme && old.text === page.text && old.nodes.length === page.nodes.length &&
          old.nodes.every((node, i) => node === page.nodes[i]) && old.pairs.length === page.pairs.length &&
          old.pairs.every((pair, i) => pair.key === page.pairs[i].key) && old.nodePair.every((p, i) => p === page.nodePair[i]);
        if (!same) { commit(st, page); hideTip(st); } else measureBlocks(st);
      } while (st.again && !st.ctx.signal.aborted);
    })().finally(() => { st.building = null; });
  }

  /* ---------------------------------------------------------------------------
   * The caption at the viewport's foot
   * ------------------------------------------------------------------------- */
  // When the core sets the caption as a subtitle at the viewport's foot (class is-fixed: no
  // room by the name or the title) it lies over the text of the page. Its band (shannon.css:
  // its ::before, on the ground of that text) covers whole lines: from the caption's box it
  // grows to every glyph box it touches, and to the glyph boxes on the same lines (within
  // BAND_JOIN of its sides), until no line is cut, so the text around it is either whole or
  // not there; the band's edges fall in the gaps between lines. Over no text (a photograph)
  // there is no band. The geometry goes to custom properties on the caption itself, so only
  // the caption is styled again.
  function placeBand(st) {
    const el = st.captionEl;
    if (!el || !el.isConnected || st.ctx.signal.aborted) return;
    const began = performance.now();
    const on = el.classList.contains('is-fixed') && st.page;
    const c = on ? el.getBoundingClientRect() : null;
    let band = null; let ground = null;
    if (c && c.width > 0 && c.height > 0) {
      // The glyph boxes of the text within reach, from the blocks near the caption.
      const page = st.page; const probe = document.createRange();
      const lo = c.top - c.height; const hi = c.bottom + c.height;
      const boxes = [];
      for (const block of page.blocks) {
        const r = block.el.getBoundingClientRect();
        if (r.bottom < lo || r.top > hi || !(r.width > 0)) continue;
        for (const n of block.nodes) {
          probe.selectNodeContents(page.nodes[n]);
          for (const f of probe.getClientRects()) {
            if (f.width > 0 && f.height > 0 && f.bottom > lo && f.top < hi) boxes.push({ t: f.top, b: f.bottom, l: f.left, r: f.right, block, in: false });
          }
        }
      }
      let top = c.top; let bottom = c.bottom; let left = c.left; let right = c.right;
      for (let grew = true; grew;) {
        grew = false;
        for (const f of boxes) {
          if (f.in || !(f.b > top && f.t < bottom && f.r > left - BAND_JOIN && f.l < right + BAND_JOIN)) continue;
          f.in = true; grew = true;
          if (!ground) ground = backgroundOf(f.block.el, new Map(), e => getComputedStyle(e)).map(Math.round);
          top = Math.min(top, f.t - BAND_PAD); bottom = Math.max(bottom, f.b + BAND_PAD);
          left = Math.min(left, f.l - BAND_PAD); right = Math.max(right, f.r + BAND_PAD);
        }
      }
      if (ground) {
        left = Math.max(0, left); right = Math.min(document.documentElement.clientWidth || window.innerWidth, right);
        band = [top - c.top, c.right - right, c.bottom - bottom, left - c.left].map(v => `${Math.min(0, v).toFixed(1)}px`);
      }
    }
    const values = band ? { top: band[0], right: band[1], bottom: band[2], left: band[3], ground: css(ground), on: '1' } : { on: '0' };
    for (const [name, value] of Object.entries(values)) {
      const prop = `--lens-shannon-band-${name}`;
      if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
    }
    const ms = performance.now() - began;
    if (ms > stats.bandMaxMs) stats.bandMaxMs = +ms.toFixed(2);
  }

  /* ---------------------------------------------------------------------------
   * Hover: the bits of the word under the pointer
   * ------------------------------------------------------------------------- */
  function caretAt(x, y) {
    if (typeof document.caretPositionFromPoint === 'function') {
      const p = document.caretPositionFromPoint(x, y);
      return p ? { node: p.offsetNode, offset: p.offset } : null;
    }
    if (typeof document.caretRangeFromPoint === 'function') {
      const r = document.caretRangeFromPoint(x, y);
      return r ? { node: r.startContainer, offset: r.startOffset } : null;
    }
    return null;
  }
  function hideTip(st) {
    if (st.tip) st.tip.classList.remove('is-on');
    st.tipFor = '';
  }
  // The code unit of the page model at (node, offset), or -1.
  function charAt(page, node, offset) {
    if (!page.nodeIndex) page.nodeIndex = new Map(page.nodes.map((n, i) => [n, i]));
    const n = page.nodeIndex.get(node);
    if (n === undefined) return -1;
    let lo = page.nodeStart[n]; let hi = page.nodeEnd[n] - 1;
    while (lo < hi) {                          // the last code unit at or before offset
      const mid = (lo + hi + 1) >> 1;
      if (page.charOff[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return page.charOff[lo] <= offset ? lo : -1;
  }
  function hover(st) {
    const began = performance.now();
    try { hoverAt(st); } finally {
      const ms = performance.now() - began;
      if (ms > stats.hoverMaxMs) stats.hoverMaxMs = +ms.toFixed(2);
    }
  }
  function hoverAt(st) {
    const page = st.page; const point = st.pointer;
    if (!page || !point || !st.settled || st.ctx.signal.aborted) { hideTip(st); return; }
    const caret = caretAt(point.x, point.y);
    if (!caret || !caret.node || caret.node.nodeType !== 3) { hideTip(st); return; }
    const { text, charNode, charOff, nodes } = page;
    // The caret sits between two code units: try the one after it, then the one before.
    let j = -1;
    for (const offset of [caret.offset, caret.offset - 1]) {
      if (offset < 0) continue;
      const k = charAt(page, caret.node, offset);
      if (k >= 0 && charOff[k] === offset && WORD.test(text[k])) { j = k; break; }
    }
    if (j < 0) { hideTip(st); return; }
    let a = j; let b = j;
    while (a > 0 && charNode[a - 1] >= 0 && WORD.test(text[a - 1])) a--;
    while (b + 1 < text.length && charNode[b + 1] >= 0 && WORD.test(text[b + 1])) b++;
    // The pointer must be on the word's glyphs, not merely nearest to them.
    const range = document.createRange();
    range.setStart(nodes[charNode[a]], charOff[a]);
    range.setEnd(nodes[charNode[b]], charOff[b] + 1);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    const on = rects.find(r => point.x >= r.left - HOVER_SLOP && point.x <= r.right + HOVER_SLOP && point.y >= r.top - HOVER_SLOP && point.y <= r.bottom + HOVER_SLOP);
    if (!on) { hideTip(st); return; }
    const key = `${a}:${b}`;
    const tip = st.tip;
    if (st.tipFor !== key) {
      st.tipFor = key;
      tip.textContent = '';
      let total = 0;
      for (let k = a; k <= b; k++) total += page.bits[k];
      const shown = Math.min(b - a + 1, TIP_LETTERS);
      for (let k = a; k < a + shown; k++) {
        const letter = document.createElement('span');
        letter.className = 'lens-shannon-tip-letter';
        letter.textContent = text[k];
        const value = document.createElement('span');
        value.className = 'lens-shannon-tip-bits';
        value.textContent = page.bits[k].toFixed(1);
        tip.append(letter, value);
      }
      const gap = document.createElement('span');
      gap.className = 'lens-shannon-tip-letter';
      gap.textContent = b - a + 1 > shown ? '…' : '';
      const sum = document.createElement('span');
      sum.className = 'lens-shannon-tip-total';
      sum.textContent = `= ${total.toFixed(1)} bits`;
      tip.append(gap, sum);
      tip.style.gridTemplateColumns = `repeat(${shown}, auto) auto`;
    }
    // Above the word's first box, centred on the pointer, or below it near the top edge.
    const box = rects[0];
    tip.classList.add('is-on');
    const w = tip.offsetWidth; const h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const x = Math.max(TIP_EDGE, Math.min(vw - TIP_EDGE - w, point.x - w / 2));
    let y = box.top - TIP_GAP - h;
    if (y < TIP_EDGE) y = rects[rects.length - 1].bottom + TIP_GAP;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /* ---------------------------------------------------------------------------
   * Enter, arrive, exit
   * ------------------------------------------------------------------------- */
  // The lens has settled: hover works, and changes that came during the sweep are read now.
  function settle(st) {
    st.settled = true;
    if (st.dirty) { st.dirty = false; rebuild(st); }
  }

  async function enter(ctx) {
    const st = begin(ctx);
    const still = ctx.motion.matches || ctx.arriving || document.hidden;
    if (still) cover(st, false);
    const page = await build(st);
    if (!page || ctx.signal.aborted) return;
    const plan = commit(st, page, !still);
    bind(st);
    if (still) st.front = Infinity;
    startMedia(st);
    if (!still) await sweep(st, plan);
    if (ctx.signal.aborted) return;
    settle(st);
    if (!still) cover(st, true);
  }

  // A page opened while the lens is on: the settled state at once. The stylesheet hid the
  // original images while the lens arrived (html[data-lens-arriving]); they stay hidden.
  async function arrive(ctx) {
    const began = performance.now();
    const st = begin(ctx);
    cover(st, false);
    const page = await build(st);
    if (!page || ctx.signal.aborted) return;
    commit(st, page, false);
    st.front = Infinity;
    bind(st);
    startMedia(st);
    settle(st);
    stats.arriveMs = Math.round(performance.now() - began);
  }

  async function exit(ctx) {
    const st = state;
    if (!st) return;
    st.settled = false;
    hideTip(st);
    html.classList.remove(CLS.covered);         // the originals return under the fading drawings
    if (st.observer) { st.observer.disconnect(); st.observer = null; }
    st.unsubscribe.forEach(off => { try { off(); } catch (error) { /* already gone */ } });
    if (st.themeObserver) { st.themeObserver.disconnect(); st.themeObserver = null; }
    const instant = ctx.instant || ctx.motion.matches || document.hidden;
    if (!instant && st.rules.length) await inkReturns(st);
    // Teardown: highlights, rules, overlays (the core removes the layers and the stylesheet).
    st.names.forEach(name => { if (CSS.highlights.get(name) && st.highlights.includes(CSS.highlights.get(name))) CSS.highlights.delete(name); });
    st.highlights.forEach(h => h.clear());
    st.unveiled.forEach(timer => clearTimeout(timer)); st.unveiled.clear(); writeUnveiled(st);
    clearRules(st, true);
    if (st.adopted) {
      const kept = document.adoptedStyleSheets.filter(sheet => sheet !== st.adopted);
      document.adoptedStyleSheets = kept;
      st.adopted = null;
    }
    if (st.page) st.page.blocks.forEach(block => block.runs.forEach(run => { run.range = null; run.on = false; }));
    st.page = null;
    st.muted.clear();
    st.renditions.clear(); st.twins.clear(); st.kinds.clear(); st.inks.clear();
    if (state === st) state = null;
  }

  // The ink returns: every rule's colour eases back to its pair's own ink, and the images fade.
  function inkReturns(st) {
    const { ctx } = st;
    // The images go with the ink, each from the opacity it has now (a fade may be running).
    const shown = st.media ? st.media.overlays : [];
    const overlays = shown.map(({ canvas }) => ({ canvas, from: parseFloat(getComputedStyle(canvas).opacity) || 0 }));
    overlays.forEach(({ canvas }) => { canvas.style.transition = 'none'; });
    const from = st.rules.map(rule => {
      const pair = st.pairs[rule.shannon.pair];
      return { rule, a: oklab(mix(pair.bg, pair.ink, inkAt(rule.shannon.level, floorOf(pair)))), b: oklab(pair.ink) };
    });
    return new Promise(resolve => {
      const began = performance.now();
      ctx.frame(function returns() {
        const p = hold === null ? Math.min(1, (performance.now() - began) / EXIT_MS) : hold;
        const u = 1 - (1 - p) * (1 - p);
        for (const { rule, a, b } of from) {
          rule.style.setProperty('color', css(fromOklab([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u])));
        }
        overlays.forEach(({ canvas, from }) => { canvas.style.opacity = String(+(from * (1 - u)).toFixed(3)); });
        if (p >= 1) { resolve(); return false; }
        return true;
      });
      if (hold === null) setTimeout(resolve, EXIT_MS + 400);   // a hidden tab runs no frames
    });
  }

  lenses.register({
    id: 'shannon',
    order: 8,
    numeral: 'VIII',
    label: 'Shannon, 1951',
    line: LINE,
    // The page's own ground, read when the core remembers the lens (and again after a theme
    // toggle): the next page is hidden over it until the lens has arrived, so no frame shows
    // its letters in full ink or its photographs in colour, then fades in settled.
    get ground() { try { return hex(pageGround()); } catch (error) { return null; } },
    css: true,
    supported() {
      return typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight === 'function' && typeof StaticRange === 'function';
    },
    enter,
    arrive,
    exit,
    // Null until the model has read the page: the core asks again until it is ready. On a phone
    // the note is the short one, so the caption keeps to few lines; on the narrowest the line's
    // words are joined by no-break spaces, so the first line breaks after its dash
    // ("VIII · Shannon, 1951 —" / "Each letter is as dark as it was surprising.").
    caption() {
      if (!state || state.bpc === null) return null;
      const bpc = state.bpc.toFixed(2);
      return {
        line: window.innerWidth < CAPTION_BREAK_BELOW ? LINE.replace(/ /g, '\u00a0') : LINE,
        note: window.innerWidth < COMPACT_BELOW ? `This page: ${bpc} bits per character (adaptive model).`
          : `This page: ${bpc} bits per character, read top to bottom by an adaptive model.`
      };
    },
    // Test hooks (not part of the lens contract).
    _model: { steps: modelSteps, run: runModel, levelOf, inkAt, floorOf, floorContrast, contrast, mix, oklab, MAX_ORDER, ALPHABET, LEVELS, INK_CURVE,
      CONTRAST_MIN, CONTRAST_LOW, CONTRAST_KEEP, PREFIX, COMBOS_MAX, PAIR_MERGE, NEAR_SCREENS, COMPACT_BELOW },
    _image: { tone: e => TONE[e], colours: imageColours, record: canvas => (state && state.renditions.get(canvas)) || null, blur: blur121,
      light: v => LIGHT[v], strokeKeep, encode, gain: photoGain, photoColour, PHOTO_FRAME, PHOTO_SPAN, SMALL_PHOTO, GRAPHIC_FLOOR, STROKE_FROM, STROKE_TO,
      FLOOR_FROM, FLOOR_TO, SHEET_LINE, CAPTION_BREAK_BELOW },
    get _state() { return state; },
    set _hold(value) { hold = typeof value === 'number' ? clamp01(value) : null; },
    get _hold() { return hold; },
    _stats: stats
  });
})();
