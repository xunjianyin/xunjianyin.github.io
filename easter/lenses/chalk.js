/**
 * Lens VII · Chalkboard: "Every result was once erasable."
 *
 * The page as it would stand on a lecture-hall blackboard in the middle of a derivation:
 * drafts, not monuments. The ground is green-black slate (#1f2b26) carrying the residue of
 * earlier lectures (faint clouds of half-erased chalk, a few broad eraser arcs); the text is
 * written in warm white chalk that skips over the slate; links are yellow chalk and the current
 * page in the navigation pale blue; section rules are hand-drawn chalk lines; every image is
 * drawn again in chalk. No word changes and the layout is exactly the normal one: only paint
 * changes (colours, a grain mask, a colour matrix), plus the drawings made here.
 *
 * Drawing:
 *   the slate    one seamless tile of BOARD_TILE css px, made here once per scale: value-noise
 *                clouds of chalk haze, slate grit, a few embedded flecks, and eraser arcs drawn
 *                as streaked bands (each also at its wrapped copies, so the tile repeats without
 *                a seam). It is the root background; sessionStorage keeps it as a JPEG data URL
 *                per scale, so the next page of the site arrives at once.
 *   the chalk    the scope's text blocks (the nav bar, main, the footer block; never the fixed
 *                buttons beside them) carry one mask, a GRAIN_TILE tile made here: sparse specks
 *                where the chalk skipped over the slate, drawn out along the stroke, and a slow
 *                variation of pressure. Text, rules and borders all take it. Both tiles are
 *                data URLs in one <style> in the lens's own layer (nothing is written on
 *                <html>); a blob URL is avoided, as registering one is a synchronous round trip
 *                to the browser process.
 *   shell pages  explicit colour rules in chalk.css (home, site pages, blog posts; the same
 *                board in both site themes).
 *   paper pages  their own design and many-coloured demos: one SVG colour matrix on the scope
 *                stretches the paper's ink to black, inverts lightness, keeps hue at PASTEL
 *                saturation and maps white to the slate, so every demo colour becomes a pastel
 *                chalk. Text links get the colour whose image under the matrix is nearest to the
 *                yellow chalk (found once by a small search).
 *   images       ctx.media overlays over the originals, which chalk.css hides (opacity 0):
 *                a photo becomes a chalk drawing (its tones set how much chalk each place
 *                holds; where it is busy the chalk is laid as two families of hatching strokes,
 *                broken and tapered like a hand's, over a rubbed layer; where it is flat, as a
 *                sky or a lit wall, as a quiet, smooth rubbed haze; contours on the bright side
 *                of its edges, thin dark subjects left as slate; a soft, ragged fade towards
 *                its edges; see PHOTO); a graphic loses its own background to the slate: a light one
 *                goes through the paper matrix, a dark one (an app screenshot) keeps its
 *                lightness, and faint ink is lifted, with a lighter grain so labels stay
 *                legible. Overlays are transparent where the slate shows, so the board runs
 *                through them, and fade in when first shown. Until a photo's drawing lands it
 *                has a first rub: its tones as a soft haze of chalk from a small sample, which
 *                the drawing fades in over (rubber()). Long work is sliced (SLICE_MS) and
 *                yields with MessageChannel. The photography lightbox (outside the scope, in a
 *                fixed container) is drawn the same way, over a slate backdrop (the media
 *                helper's fixed: true); when it changes photo the old drawing goes at once and
 *                the new one fades in.
 *   caption      chalk on a slate halo from its first frame (it comes in with the sheet of
 *                slate), a lighter halo once the board is settled (chalk.css).
 *
 * Enter (about 1.5 s for the viewport): a sheet of slate (a canvas painted with the board tile
 * in register with the ground) fades in over the page, and the style switches under it; then
 * the sheet is cleared line by line, each line of text by a quick writing front from left to
 * right (the lines start staggered from top to bottom, many at once), with a few specks of
 * chalk dust falling from the fronts; section rules are drawn the same way; images are drawn
 * in along their main hatching direction once their drawing (or first rub) is there; what is
 * left (bullets, borders) appears as the sheet fades. Exit (about 0.8 s): a felt eraser wipes
 * the viewport in three broad zig-zag passes, uncovering on a new sheet clean slate with a
 * faint smear of the erased lines; the felt has ragged edges, a lighter, frayed print just
 * ahead of it, and leaves short, tapered felt streaks. Under the sheet the page returns to
 * normal, and the smear fades with the sheet. The sheets are painted a band at a time and the
 * smear in slices, so no step of either transition is a long task. A transition begun in a
 * hidden page ends at once; one the page leaves midway pauses (its clock is the sum of the
 * core's frame steps, and the loop pauses there) and goes on where it was when the page shows
 * again. The exit ends as soon as an instant reset asks for it, even midway and in a hidden
 * page (a timer looks, as no frame comes there). Arrive (a page opened while the lens is on):
 * the settled state at once, without waiting for the tile to decode (the pre-painted ground
 * stands in) and at most ARRIVE_MEDIA_MS for the first drawings (the first rubs come at once).
 * Reduced motion: the settled state at once, and a plain exit. Once settled, no frame callback
 * runs; the sheets exist only during a transition.
 */
(() => {
  'use strict';
  if (!window.SiteLenses) return;

  /* ---------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------- */
  // Colours (sRGB 0-255). The text colours of shell pages live in chalk.css.
  const GROUND = '#1f2b26';                 // the slate, also the pre-paint ground
  const GROUND_RGB = [31, 43, 38];
  const CHALK_RGB = [241, 237, 226];        // white chalk: drawings, dust, the matrix's black
  const LINK_RGB = [238, 216, 156];         // yellow chalk: links (chalk.css --lens-chalk-yellow)
  const PASTEL = 0.72;                      // saturation kept by paper pages and graphics
  const INK_LEVEL = 0.12;                   // paper ink (about #202a26) is stretched to black

  // The board: one seamless tile, made once per scale and kept in sessionStorage.
  const BOARD_TILE = 1024;                  // css px (chalk.css sizes the background to it)
  const BOARD_SCALE_MAX = 1.5;              // tile px per css px at most: the slate is soft
  const BOARD_KEY = 'lenses-chalk-board';   // sessionStorage: '<key>@<scale>' -> JPEG data URL
  const BOARD_QUALITY = 0.86;
  const SEED = 1931;
  const GRIT = 0.05;                        // slate grit: +-2.5 % of the ground per pixel
  const FLECKS = 0.0035;                    // share of pixels holding an embedded chalk fleck
  const FLECK_ALPHA = 0.12;                 // its strongest chalk alpha
  const CLOUD_CELLS = [4, 8, 16, 32];       // value-noise octaves, cells per tile (256 ... 32 css px)
  const CLOUD_WEIGHTS = [0.48, 0.27, 0.16, 0.09];
  const CLOUD_FROM = 0.5;                   // noise above this holds half-erased chalk ...
  const CLOUD_TO = 0.8;                     // ... densest from here
  const CLOUD_ALPHA = 0.06;                 // chalk alpha of the densest cloud
  const ARCS = 3;                           // eraser arcs per tile
  const ARC_RADIUS = [300, 560];            // css px
  const ARC_WIDTH = [72, 118];              // css px: the eraser's breadth
  const ARC_SPAN = [0.5, 0.95];             // radians
  const ARC_ALPHA = 0.06;                   // the densest felt streak of an arc
  const ARC_STREAKS = 28;                   // felt streaks across one arc

  // Chalk grain: the mask over the text blocks (chalk.css sizes it to GRAIN_TILE css px).
  const GRAIN_TILE = 160;                   // css px
  const GRAIN_SCALE_MAX = 2;
  const SPECKS = 0.065;                     // share of css px where the chalk skipped ...
  const SPECK_KEEP = [0.28, 0.66];          // ... keeping this share of the stroke there
  const SPECK_RUN = 2.2;                    // css px: a skip runs along the stroke up to this
  // At one device px per css px a speck is as wide as a thin stem ('l', 'I'), and a deep one
  // would cut it ('I' read as '!'): there the specks are single pixels, fewer and shallower.
  const SPECKS_1X = 0.035;
  const SPECK_KEEP_1X = [0.68, 0.88];
  const PRESSURE_CELLS = 4;                 // slow pressure variation, cells per tile (40 css px)
  const PRESSURE_DEPTH = 0.15;              // the pressure varies over this share of the alpha

  // Drawings of images. Lengths in css px, angles in degrees (screen y points down).
  // A photo: chalk is the light, so a photo is drawn as a hand would draw it on a board. Its
  // tones set how much chalk a place holds (COVER: dark is bare slate, the brightest a dense
  // layer), the same whatever the texture, so the picture reads at a glance; only how the
  // chalk is laid differs:
  //   busy      where the photo has texture (leaves, water, a facade), two families of broken,
  //             tapered hatching strokes, over a thinner rubbed layer with the slate's grain;
  //             the rub reaches down into the low midtones, so a dark crown or a shaded slope
  //             is a faint mottled mass rather than bare slate;
  //   flat      where it has none (a sky, a lit wall), the side of the chalk rubbed smooth:
  //             fine, long, soft streaks with only a faint grain of the slate's tooth, so a sky
  //             is a quiet haze and never static; its broad modelling is raised (clarity), so
  //             storm clouds or the light across a dim wall keep their gradation;
  //   contours  on the bright side of an edge only (a difference of Gaussians, as in XDoG,
  //             Winnemoeller et al. 2012, where a point is brighter than its surround), pressed
  //             as hard as the place is light: in a dark busy place they are drawn lightly, so
  //             it never turns into a scatter of white specks; the dark side is cut out of the
  //             chalk as a slate gap. A thin dark line (a twig, a wire)
  //             would get a bright flank on each side and read as one white line, the photo's
  //             negative, so its flanks are drawn faintly: it stays a dark line, and a small
  //             dark subject (a bird, a figure on a dome) stays slate inside a chalk outline.
  // Busy or flat is decided by the density of edges around a point once thin dark subjects
  // are closed over (so the sky behind bare branches stays a sky). The tones carry their
  // detail raised by a guided filter's residue, which keeps strong edges, so no halo forms;
  // the flat haze takes the guided filter's smooth tone itself (no sensor noise, no JPEG
  // blocks). The drawing fades out over a ragged margin towards the photo's edges, so it
  // reads as a drawing on the board rather than a filled rectangle, and the corners, where a
  // photo's subject rarely is, are drawn with less contrast. All fields are computed in css
  // px, at most one point per css px, so a drawing is the same at every pixel ratio. Marks
  // (strokes, contours, the busy rub) are pressures, and chalk is left only where the pressure
  // beats the slate's tooth (a height field), so a light mark comes out grainy.
  const PHOTO = {
    analysis: 260000,                       // its fields are computed on at most this many points
    edgeSigma: 0.7,                         // contours: the inner Gaussian; the outer is edgeK wider
    edgeK: 1.6,
    edgeEps: 0.006,                         // a contour where the inner exceeds the outer by this ...
    phi: 55,                                // ... this sharply (tanh slope)
    lineMin: 0.14,                          // weaker responses are dropped (noise)
    linePress: 0.92,                        // the pressure of a contour, where its surround is light ...
    lineGate: [0.15, 0.55],                 // ... (the smooth tone above [1]; from [0] down it is pressed
    lineDark: 0.15,                         //     this share as hard)
    gapCut: 0.9,                            // the dark side of an edge loses this share of its chalk
    thinWidth: 1,                           // dark lines up to 2 * thinWidth + 1 wide count as thin ...
    thinLine: 0.15,                         // ... and their flanks are drawn at this share of a contour
    flatEdge: 1.2,                          // a contour in a flat region needs an edge this much stronger
    detail: 0.7,                            // the tone has its detail raised this much (the residue of a
    detailRadius: 5,                        //     guided filter of this radius and edge variance)
    detailEps: 0.012,
    coverMax: 0.9,                          // tone -> coverage: none below a tone, rising with a gamma to this
    rubCover: [0.03, 0.85],                 //     (busy, under the strokes: from, gamma; low midtones kept,
                                            //     so a dark crown or a shaded slope is a faint mottled rub)
    centre: 0.28,                           // the corners' tone is lowered by this share
    closeRadius: 3,                         // busy: dark subjects up to twice this wide are closed over ...
    busyEdge: 0.045,                        // ... then edges steeper than this (per css px) count, and their
    busyRadius: [4, 0.02, 9],               //     density over this radius (at least, share of the short
    flatFrom: 0.14,                         //     side, at most) makes a region flat below flatFrom and
    flatTo: 0.32,                           //     busy above flatTo
    hatches: [                              // stroke families: angle, the tone range they cover,
      { angle: -48, from: 0.32, to: 1, width: 0.32, scale: 1 },       // their widest half-width as a
      { angle: -8, from: 0.72, to: 1, width: 0.24, scale: 1.3 }       // share of the spacing
    ],
    spacing: [3.4, 5],                      // between hatching lines: short side / spacingShare, clamped
    spacingShare: 80,
    small: 200,                             // a drawing whose short side is below this has strokes
    smallWidth: 0.75,                       // this much narrower
    stroke: 64,                             // a stroke and the gap before it repeat about every stroke ...
    gap: [2, 7],                            // ... the gap ...
    taper: 5,                               // ... a stroke fades in and out over this
    wander: 0.16,                           // a stroke sits off its line by up to this share of the spacing
    strokePress: [0.7, 1],                  // the pressure of a stroke, at least ... at most
    strokesFrom: 0.35,                      // strokes are kept where the region is at least this busy
    rub: 0.9,                               // busy: the rubbed layer under the strokes, a share of the coverage
    veil: 0.55,                             // flat: the smooth haze, a share of the coverage ...
    veilCover: [0.04, 1],                   // ... (from, gamma: storm clouds and a dim wall keep their
                                            //     gradation, a bright sky stays a quiet haze) ...
    veilRadius: 9,                          // ... its tone smoothed by a guided filter of this radius
    veilEps: 0.004,                         //     and edge variance, with a faint grain of the slate's tooth
    veilGrain: 0.35,                        //     (this share of its opacity), and its broad modelling
    clarity: 0.8,                           //     raised by this share of its difference from a blur of
    clarityRadius: 22,                      //     this sigma (css px)
    streak: [140, 4, -0.6, 1.6, 0.6],       // ... in streaks: value noise on cells [0] along by [1] across
                                            //     (css px), through a smoothstep from [2] to [3], scales its
                                            //     opacity between [4] and 1; the streaks run along
    rubAngle: -8,                           //     this direction (degrees)
    fade: [6, 0.03, 14],                    // the drawing fades out towards the edges over this margin
    fadeStrokes: 0.5,                       // (at least, share of the short side, at most); the strokes
    fadeRagged: 0.35,                        // over this share of it; starting up to this share of it
    fadeCell: 24,                           // inside the edge (ragged), varied on cells of this size
    toothCell: 0.9,                         // the slate's tooth: cells of this size ...
    toothSoft: 0.28,                        // ... and the width of the threshold around a cell's height
    thin: 0.5                               // the chalk's opacity under the lightest pressure (1 under the hardest)
  };
  const GRAPHIC_SPECKS = 0.06;              // a graphic's grain is lighter, so labels stay legible
  const GRAPHIC_KEEP = 0.55;
  const SLICE_MS = 4;                       // longest stretch of work between yields

  // Enter: slate, then writing (seconds unless stated).
  const SLATE_MS = 260;                     // the sheet of slate fades in over the page
  const SLATE_BAND = 300;                   // css px: a sheet is painted with the board a band at a time
  const WRITE_STAGGER = 0.62;               // the last line in view starts this long after the first
  const WRITE_JITTER = 0.05;
  const WRITE_SPEED = 1700;                 // css px per second along a line ...
  const WRITE_MIN = 0.12;                   // ... but a line takes at least ...
  const WRITE_MAX = 0.46;                   // ... and at most this long
  const WRITE_PAD = 2;                      // css px around each line's glyph boxes
  const WRITE_JOIN = 26;                    // css px: fragments of one line closer than this join
  const RULE_BAND = 9;                      // css px: a section rule is drawn as a line this tall
  const IMAGE_STAGGER = 0.45;               // images start like lines, over a shorter stagger ...
  const IMAGE_DRAW = 0.5;                   // ... are drawn in over this long ...
  const IMAGE_WAIT = 0.35;                  // ... once their drawing is ready, or after this wait
  const IMAGE_FEATHER = 28;                 // css px: the soft edge of the drawing front
  const WRITE_LIMIT = 2.4;                  // the writing ends by then whatever is pending
  const SETTLE_MS = 230;                    // the sheet fades, showing rules and bullets
  const DUST_RATE = 7;                      // specks per second from one writing front ...
  const DUST_MAX = 90;                      // ... with at most this many in the air
  const DUST_LIFE = [0.45, 0.95];
  const DUST_SIZE = [0.7, 1.7];             // css px
  const DUST_GRAVITY = 380;                 // css px per second squared

  // Exit: the eraser.
  const PASSES = 3;                         // broad zig-zag passes, top to bottom
  const PASS_S = 0.17;                      // seconds per pass
  const ERASER_WIDTH = 0.2;                 // share of the viewport width (at least ERASER_MIN)
  const ERASER_MIN = 110;                   // css px
  const PASS_OVERLAP = 60;                  // css px the bands overlap
  const PASS_DRIFT = 26;                    // css px a pass drifts down as it crosses (the zig-zag)
  const SMEAR_ALPHA = 0.055;                // the erased lines leave up to this much chalk ...
  const SMEAR_RUN = 46;                     // ... dragged up to this far along the pass, in pieces
  const SMEAR_TILT = 1.6;                   //     tilted and bowed by up to this (css px)
  const FELT_STREAKS = 30;                  // faint felt streaks per pass, ...
  const FELT_SPAN = [0.18, 0.6];            // ... each over this share of the width ...
  const FELT_WOBBLE = 5;                    // ... and bowed or tilted by up to this (css px)
  const FELT_RAGGED = 10;                   // css px: the felt's top and bottom edges wander this much ...
  const FELT_SWELL = 90;                    // ... over this length; its leading edge swells by FELT_LEAD
  const FELT_LEAD = 16;                     //     over FELT_SWELL down its height ...
  const FELT_FRAY = 34;                     // ... and over this length by FELT_FRAY_DEPTH more ...
  const FELT_FRAY_DEPTH = 5;
  const FELT_JAG = 8;                       // ... and every edge is jagged by this, per FELT_ROW (FELT_STEP along)
  const FELT_ROW = 9;
  const FELT_STEP = 12;                     // css px between the vertices of the felt's outline
  const FELT_SOFT = 22;                     // css px: the lighter print ahead of the leading edge, ...
  const FELT_SOFT_BANDS = 4;                // ... in this many bands of the erased board ...
  const FELT_SOFT_ALPHA = 0.13;             // ... at this opacity each ...
  const FELT_FIBRE = 3;                     // ... their fronts frayed every this many css px
  const ERASE_FADE_MS = 280;                // the clean sheet and its smear fade to the page

  // The first rub under a photo until its drawing lands (rubber()).
  const RUB_SIZE = 160;                     // points on a rub's long side (stretched, smoothly)
  const RUB_ALPHA = 0.42;                   // chalk alpha where the photo is brightest ...
  const RUB_FROM = 0.06;                    // ... and none below this tone
  const RUB_EDGE = 10;                      // css px: it fades out towards its edges over this, ...
  const RUB_EDGE_CELL = 24;                 // ... starting a varying way in (cells of this size)
  const RUB_MIN = 48;                       // css px: smaller images get none
  const RUB_NEAR = '50%';                   // photos within this margin of the view get one
  const RUB_IN_MS = 160;                    // it comes in over this
  const RUB_AT_ONCE = 3;                    // samples decoded at once at most

  const STOP_POLL_MS = 20;                  // a fade checks this often whether it must end at once
  const ARRIVE_MEDIA_MS = 160;              // an arrival waits this long for the first drawings
  const LAND_MS = 320;                      // a drawing fades in over this when it is first shown
  const pace = { slow: 1 };                 // test-only: every transition takes `slow` times as long

  const CLS = { base: 'lens-chalk', on: 'lens-chalk-on', shell: 'lens-chalk-shell', paper: 'lens-chalk-paper', home: 'lens-chalk-home' };
  const MATRIX_ID = 'lens-chalk-matrix';
  // The text blocks that carry the chalk grain (a mask): the nav bar, main, the footer's blocks;
  // never #site-nav or #site-footer themselves, whose skip link and back-to-top button are fixed.
  const MASKED = '#site-nav > nav, #main-content, #site-footer > :not(.back-to-top), body > header.site-header, body > footer.paper-footer';
  // Section rules drawn as chalk lines (chalk.css), revealed like a line of text on entering.
  const RULES = '.homepage-section h2, .pub-year-heading, .project-group-heading, .about-section h2, .post-content h1';
  const SKIP_TEXT = 'script, style, noscript, template, textarea, input, select, option, svg';

  const html = document.documentElement;
  let state = null;                         // the running activation, or null
  let board = null;                         // { scale, url, image } once made (kept for later activations)
  const grains = new Map();                 // scale -> { url } (kept likewise)
  let linkColour = null;                    // the paper-page link colour (computed once)

  /* ---------------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------------- */
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
  const mod = (a, n) => ((a % n) + n) % n;
  // A small seeded generator, so the board is the same slate every time.
  const random = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // A stateless hash of two integers (and a salt) to [0, 1), for per-pixel and per-stroke noise.
  const hash = (x, y, salt) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // Resolves after ms, or at once when the signal aborts (never rejects).
  const sleep = (ms, signal) => new Promise(resolve => {
    if (signal && signal.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  // One task boundary (a message, not a timer: timers are clamped and throttled).
  const yieldTask = () => new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
    channel.port2.postMessage(0);
  });
  // Runs a generator that yields between pieces of work, in slices of at most SLICE_MS.
  async function runSliced(steps, signal) {
    let began = performance.now();
    for (;;) {
      const step = steps.next();
      if (step.done) return step.value;
      if (performance.now() - began > SLICE_MS) {
        await yieldTask();
        if (signal && signal.aborted) return null;
        began = performance.now();
      }
    }
  }
  const toBlob = (canvas, type, quality) => new Promise(resolve => {
    if (!canvas.toBlob) { resolve(null); return; }
    try { canvas.toBlob(resolve, type, quality); } catch (error) { resolve(null); }
  });

  // Separable box blur of a W x H field (edges clamped), in place of a copy.
  function boxBlur(src, W, H, r) {
    if (r < 1) return src;
    const tmp = new Float32Array(W * H); const out = new Float32Array(W * H); const span = 2 * r + 1;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[row + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        tmp[row + x] = sum / span;
        sum += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        out[y * W + x] = sum / span;
        sum += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
    }
    return out;
  }
  // A Gaussian of standard deviation sigma (points): a sampled kernel for a small sigma, where
  // box blurs of whole-point radius would be too coarse (and would make the drawing depend on
  // the analysis resolution); three box blurs for a larger one.
  function* gaussSteps(src, W, H, sigma) {
    if (sigma >= 2.5) {
      const r = Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2);
      let field = src;
      for (let k = 0; k < 3; k++) { field = boxBlur(field, W, H, r); yield; }
      return field;
    }
    const R = Math.max(1, Math.ceil(3 * sigma));
    const kernel = new Float32Array(2 * R + 1);
    let sum = 0;
    for (let k = -R; k <= R; k++) { kernel[k + R] = Math.exp(-(k * k) / (2 * sigma * sigma)); sum += kernel[k + R]; }
    for (let k = 0; k < kernel.length; k++) kernel[k] /= sum;
    const tmp = new Float32Array(W * H); const out = new Float32Array(W * H);
    const clampX = x => (x < 0 ? 0 : x >= W ? W - 1 : x);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        let v = 0;
        if (x >= R && x < W - R) { for (let k = -R, i = row + x - R; k <= R; k++, i++) v += kernel[k + R] * src[i]; }
        else for (let k = -R; k <= R; k++) v += kernel[k + R] * src[row + clampX(x + k)];
        tmp[row + x] = v;
      }
      if ((y & 63) === 63) yield;
    }
    for (let y = 0; y < H; y++) {
      const row = y * W;
      if (y >= R && y < H - R) {
        for (let x = 0; x < W; x++) out[row + x] = 0;
        for (let k = -R; k <= R; k++) {
          const w = kernel[k + R]; const from = (y + k) * W;
          for (let x = 0; x < W; x++) out[row + x] += w * tmp[from + x];
        }
      } else {
        for (let x = 0; x < W; x++) {
          let v = 0;
          for (let k = -R; k <= R; k++) v += kernel[k + R] * tmp[(y + k < 0 ? 0 : y + k >= H ? H - 1 : y + k) * W + x];
          out[row + x] = v;
        }
      }
      if ((y & 63) === 63) yield;
    }
    return out;
  }

  // The guided filter (He, Sun and Tang 2010): p smoothed over boxes of radius r, but steered by
  // the guide I, so it does not leak across the guide's edges (a sky next to busy leaves keeps
  // the sky's value: no halo). eps sets what counts as an edge of the guide (a variance).
  function* guidedSteps(I, p, W, H, r, eps) {
    const N = W * H;
    const mI = boxBlur(I, W, H, r); yield;
    const mp = boxBlur(p, W, H, r); yield;
    const prod = new Float32Array(N);
    for (let i = 0; i < N; i++) prod[i] = I[i] * I[i];
    const mII = boxBlur(prod, W, H, r); yield;
    for (let i = 0; i < N; i++) prod[i] = I[i] * p[i];
    const mIp = boxBlur(prod, W, H, r); yield;
    const a = new Float32Array(N); const b = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      a[i] = (mIp[i] - mI[i] * mp[i]) / (mII[i] - mI[i] * mI[i] + eps);
      b[i] = mp[i] - a[i] * mI[i];
    }
    yield;
    const ma = boxBlur(a, W, H, r); yield;
    const mb = boxBlur(b, W, H, r); yield;
    for (let i = 0; i < N; i++) ma[i] = ma[i] * I[i] + mb[i];
    return ma;
  }

  // A grey closing (a max filter, then a min filter, over squares of radius r): dark features
  // narrower than 2r + 1 points are filled with their surround.
  function* closeSteps(src, W, H, r) {
    // One pass along rows (step 1) or columns (step W) of a max (sign 1) or min (sign -1),
    // yielding every 64 lines.
    function* pass(from, to, horizontal, sign) {
      const n = horizontal ? W : H; const lines = horizontal ? H : W;
      const stride = horizontal ? 1 : W; const step = horizontal ? W : 1;
      for (let l = 0; l < lines; l++) {
        const o = l * step;
        for (let k = 0; k < n; k++) {
          let v = from[o + k * stride] * sign;
          const end = Math.min(n - 1, k + r);
          for (let j = Math.max(0, k - r); j <= end; j++) { const u = from[o + j * stride] * sign; if (u > v) v = u; }
          to[o + k * stride] = v * sign;
        }
        if ((l & 63) === 63) yield;
      }
    }
    const a = new Float32Array(W * H); const b = new Float32Array(W * H);
    yield* pass(src, a, true, 1);
    yield* pass(a, b, false, 1);
    yield* pass(b, a, true, -1);
    yield* pass(a, b, false, -1);
    return b;
  }

  // Smooth value noise in [0, 1) on cells of one unit (x, y in cells), from the hash.
  function valueNoise(x, y, salt) {
    const x0 = Math.floor(x); const y0 = Math.floor(y);
    let fx = x - x0; let fy = y - y0;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const top = hash(x0, y0, salt) + (hash(x0 + 1, y0, salt) - hash(x0, y0, salt)) * fx;
    const bottom = hash(x0, y0 + 1, salt) + (hash(x0 + 1, y0 + 1, salt) - hash(x0, y0 + 1, salt)) * fx;
    return top + (bottom - top) * fy;
  }

  // The paper-page colour matrix (sRGB, 0-1): stretch the ink to black, invert lightness while
  // keeping hue (invert, then the CSS hue-rotate(180deg) matrix), soften saturation (the CSS
  // saturate matrix), and map onto the slate: out = chalk - (chalk - ground) * H * S * stretch(in).
  // Every step is affine, so one 4 x 5 matrix does it.
  const HUE_180 = [[-0.574, 1.43, 0.144], [0.426, 0.43, 0.144], [0.426, 1.43, -0.856]];
  function saturation(s) {
    return [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
      [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
      [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]];
  }
  const multiply = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((sum, v, k) => sum + v * B[k][j], 0)));
  const PAPER_M = multiply(HUE_180, saturation(PASTEL));
  // The matrix as rows c: out_c = sum_k a_ck in_k + b_c (0-1 units).
  function boardRows() {
    const stretch = 1 / (1 - INK_LEVEL);
    return [0, 1, 2].map(c => {
      const w = CHALK_RGB[c] / 255; const g = GROUND_RGB[c] / 255; const span = w - g;
      const a = PAPER_M[c].map(m => -span * m * stretch);
      // M's rows sum to 1, so the stretch's offset -INK_LEVEL * stretch adds span * INK_LEVEL * stretch.
      return { a, b: w + span * INK_LEVEL * stretch };
    });
  }
  const BOARD_ROWS = boardRows();
  const boardMatrix = () => [...BOARD_ROWS.flatMap(({ a, b }) => [...a.map(v => +v.toFixed(4)), 0, +b.toFixed(4)]), 0, 0, 0, 1, 0].join(' ');
  const onBoard = (r, g, b) => BOARD_ROWS.map(({ a, b: off }) => clamp01(a[0] * r + a[1] * g + a[2] * b + off));

  // The colour a paper-page link is given so that it shows as the yellow chalk after the
  // matrix: the nearest reachable colour (a coarse search, then a fine one around it).
  function paperLink() {
    if (linkColour) return linkColour;
    const target = LINK_RGB.map(v => v / 255);
    const cost = (r, g, b) => {
      const o = onBoard(r / 255, g / 255, b / 255);
      return (o[0] - target[0]) ** 2 + (o[1] - target[1]) ** 2 + 2 * (o[2] - target[2]) ** 2;
    };
    let best = [0, 0, 0]; let bestCost = Infinity;
    for (let r = 0; r <= 256; r += 16) for (let g = 0; g <= 256; g += 16) for (let b = 0; b <= 256; b += 16) {
      const c = cost(Math.min(255, r), Math.min(255, g), Math.min(255, b));
      if (c < bestCost) { bestCost = c; best = [r, g, b].map(v => Math.min(255, v)); }
    }
    const [r0, g0, b0] = best;
    for (let r = Math.max(0, r0 - 16); r <= Math.min(255, r0 + 16); r += 2) {
      for (let g = Math.max(0, g0 - 16); g <= Math.min(255, g0 + 16); g += 2) {
        for (let b = Math.max(0, b0 - 16); b <= Math.min(255, b0 + 16); b += 2) {
          const c = cost(r, g, b);
          if (c < bestCost) { bestCost = c; best = [r, g, b]; }
        }
      }
    }
    linkColour = `rgb(${best.join(', ')})`;
    return linkColour;
  }

  /* ---------------------------------------------------------------------------
   * The board (slate tile)
   * ------------------------------------------------------------------------- */
  const boardScale = () => Math.min(BOARD_SCALE_MAX, Math.max(1, window.devicePixelRatio || 1));

  function* boardSteps(k) {
    const n = Math.round(BOARD_TILE * k);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const g = canvas.getContext('2d');
    const image = g.createImageData(n, n);
    const d = image.data;
    const rand = random(SEED);
    // Clouds: octaves of value noise on wrapped lattices (so the tile repeats), smoothly
    // interpolated; where their sum is high, a haze of half-erased chalk remains.
    const octaves = CLOUD_CELLS.map((cells, o) => ({
      cells, weight: CLOUD_WEIGHTS[o], cellPx: n / cells, lattice: Float32Array.from({ length: cells * cells }, () => rand())
    }));
    const noise = new Float32Array(n);
    const [gr, gg, gb] = GROUND_RGB; const [cr, cg, cb] = CHALK_RGB;
    for (let y = 0; y < n; y++) {
      noise.fill(0);
      for (const o of octaves) {
        const gy = y / o.cellPx; const y0 = Math.floor(gy); const fy = gy - y0; const sy = fy * fy * (3 - 2 * fy);
        const r0 = (y0 % o.cells) * o.cells; const r1 = ((y0 + 1) % o.cells) * o.cells;
        const L = o.lattice;
        for (let x = 0; x < n; x++) {
          const gx = x / o.cellPx; const x0 = Math.floor(gx); const fx = gx - x0; const sx = fx * fx * (3 - 2 * fx);
          const c0 = x0 % o.cells; const c1 = (x0 + 1) % o.cells;
          const top = L[r0 + c0] + (L[r0 + c1] - L[r0 + c0]) * sx;
          const bottom = L[r1 + c0] + (L[r1 + c1] - L[r1 + c0]) * sx;
          noise[x] += (top + (bottom - top) * sy) * o.weight;
        }
      }
      for (let x = 0; x < n; x++) {
        let a = smooth(CLOUD_FROM, CLOUD_TO, noise[x]) * CLOUD_ALPHA;
        if (rand() < FLECKS) a += FLECK_ALPHA * (0.3 + 0.7 * rand());
        const grit = 1 + (rand() - 0.5) * GRIT;
        const i = (y * n + x) * 4;
        d[i] = gr * grit + (cr - gr * grit) * a;
        d[i + 1] = gg * grit + (cg - gg * grit) * a;
        d[i + 2] = gb * grit + (cb - gb * grit) * a;
        d[i + 3] = 255;
      }
      if ((y & 7) === 7) yield;
    }
    g.putImageData(image, 0, 0);
    yield;
    // Eraser arcs: a band of felt streaks along a circle, fading in and out along its length
    // (a conic gradient), denser at the band's edges where the dust gathers. Each arc is drawn
    // at its wrapped copies too, with the same streaks, so the tile stays seamless.
    const chalk = `rgb(${CHALK_RGB.join(',')})`;
    for (let arc = 0; arc < ARCS; arc++) {
      const cx = rand() * n; const cy = rand() * n;
      const radius = lerp(ARC_RADIUS[0], ARC_RADIUS[1], rand()) * k;
      const width = lerp(ARC_WIDTH[0], ARC_WIDTH[1], rand()) * k;
      const from = rand() * Math.PI * 2; const span = lerp(ARC_SPAN[0], ARC_SPAN[1], rand());
      const streaks = Array.from({ length: ARC_STREAKS }, (_, s) => {
        const u = s / (ARC_STREAKS - 1);
        const edge = 0.45 + 0.55 * Math.pow(Math.abs(2 * u - 1), 3);
        return { r: radius - width / 2 + u * width, alpha: ARC_ALPHA * edge * (0.3 + 0.7 * rand()), lw: (width / ARC_STREAKS) * (0.7 + 0.9 * rand()), lag: rand() * 0.18 };
      });
      for (const ox of [-n, 0, n]) {
        for (const oy of [-n, 0, n]) {
          const x = cx + ox; const y = cy + oy; const reach = radius + width;
          if (x + reach < 0 || x - reach > n || y + reach < 0 || y - reach > n) continue;
          for (const streak of streaks) {
            // Each streak starts and ends a little differently, as felt drags unevenly.
            const a0 = from + streak.lag * span; const a1 = from + span * (1 - streak.lag * 0.6);
            const cone = g.createConicGradient(a0, x, y);
            const share = (a1 - a0) / (Math.PI * 2);
            cone.addColorStop(0, 'rgba(0,0,0,0)');
            cone.addColorStop(share * 0.25, chalk);
            cone.addColorStop(share * 0.7, chalk);
            cone.addColorStop(share, 'rgba(0,0,0,0)');
            cone.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = streak.alpha;
            g.strokeStyle = cone;
            g.lineWidth = streak.lw;
            g.beginPath(); g.arc(x, y, streak.r, a0, a1); g.stroke();
          }
        }
      }
      yield;
    }
    g.globalAlpha = 1;
    return canvas;
  }

  // A Blob as a data URL, asynchronously. The tiles are used as data URLs, never blob URLs:
  // registering a blob (new Blob, URL.createObjectURL) is a synchronous round trip to the
  // browser process, which a busy browser was measured to stretch to 150-240 ms on arrival.
  const dataUrlOf = blob => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

  // The board tile as { scale, url, image } (url a JPEG data URL): from memory, from
  // sessionStorage, or made in slices and stored. `decoded` waits until the image can be drawn
  // (the sheets need that; an arrival does not: the ground colour stands in for the few ms
  // until the browser has decoded the background).
  async function makeBoard(signal, decoded = true) {
    const scale = boardScale();
    if (!board || board.scale !== scale) {
      const key = `${BOARD_KEY}@${scale}`;
      let url = null;
      try { url = sessionStorage.getItem(key); } catch (error) { url = null; }
      if (!url || !url.startsWith('data:image/')) {
        const canvas = await runSliced(boardSteps(scale), signal);
        if (!canvas) return null;
        // Encoded off the main thread; the synchronous encoder is the fallback.
        const blob = await toBlob(canvas, 'image/jpeg', BOARD_QUALITY);
        url = (blob && await dataUrlOf(blob)) || canvas.toDataURL('image/jpeg', BOARD_QUALITY);
        try { sessionStorage.setItem(key, url); } catch (error) { /* full or unavailable */ }
      }
      const image = new Image();
      image.src = url;
      // The sheets paint the board as a pattern: from a decoded bitmap kept with it, since a
      // pattern of the <img> may have to decode the tile again first (measured at 5-70 ms, on
      // the exit's first frame).
      const made = { scale, url, image, bitmap: null };
      made.decoding = image.decode()
        .then(() => (typeof createImageBitmap === 'function' ? createImageBitmap(image) : null))
        .then(bitmap => { made.bitmap = bitmap; }, () => {});
      if (board && board.bitmap) board.bitmap.close();   // the tile of another scale
      board = made;
    }
    if (decoded) await board.decoding;
    if (signal && signal.aborted) return null;
    return board;
  }

  /* ---------------------------------------------------------------------------
   * The chalk grain (a mask tile)
   * ------------------------------------------------------------------------- */
  function makeGrain() {
    const k = Math.min(GRAIN_SCALE_MAX, Math.max(1, Math.round((window.devicePixelRatio || 1) * 2) / 2));
    if (grains.has(k)) return grains.get(k);
    const n = Math.round(GRAIN_TILE * k);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const g = canvas.getContext('2d');
    const image = g.createImageData(n, n);
    const d = image.data;
    const rand = random(SEED + 7);
    const cells = PRESSURE_CELLS; const cellPx = n / cells;
    const lattice = Float32Array.from({ length: cells * cells }, () => rand());
    // Per tile px: a skip starts with this chance and covers (1 + SPECK_RUN * k) / 2 px on
    // average, so SPECKS of the tile is skipped at any scale.
    const coarse = k < 1.5;                 // one device px per css px
    const runMax = coarse ? 1 : SPECK_RUN * k;
    const [keepLo, keepHi] = coarse ? SPECK_KEEP_1X : SPECK_KEEP;
    const chance = (coarse ? SPECKS_1X : SPECKS) / Math.max(1, (1 + runMax) / 2);
    for (let y = 0; y < n; y++) {
      const gy = y / cellPx; const y0 = Math.floor(gy); const fy = gy - y0; const sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cells) * cells; const r1 = ((y0 + 1) % cells) * cells;
      let run = 0; let keep = 1;
      for (let x = 0; x < n; x++) {
        const gx = x / cellPx; const x0 = Math.floor(gx); const fx = gx - x0; const sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % cells; const c1 = (x0 + 1) % cells;
        const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * sx;
        const bottom = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * sx;
        let alpha = 1 - PRESSURE_DEPTH * (top + (bottom - top) * sy);
        // A skip: the chalk lifted for a short run along the (mostly horizontal) stroke.
        if (run <= 0 && rand() < chance) { run = Math.max(1, Math.round(rand() * runMax)); keep = lerp(keepLo, keepHi, rand()); }
        if (run > 0) { alpha *= keep; run--; }
        const i = (y * n + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 0;
        d[i + 3] = Math.round(alpha * 255);
      }
    }
    // The tile wraps horizontally too: a run cut at the right edge simply ends there.
    g.putImageData(image, 0, 0);
    // Encoded at once (a few ms): toBlob would wait for an encoder thread a gallery keeps busy.
    const grain = { url: canvas.toDataURL('image/png') };
    grains.set(k, grain);
    return grain;
  }

  /* ---------------------------------------------------------------------------
   * Images in chalk (ctx.media render functions)
   * ------------------------------------------------------------------------- */
  // The slate's tooth for a photo's drawing: a TOOTH x TOOTH device px tile of heights (0-1,
  // equalised so a pressure p covers about a share p of the slate), value noise on cells of
  // PHOTO.toothCell css px with a little per-pixel jitter, repeating seamlessly. Kept per scale.
  const TOOTH = 128;
  const tooth = new Map();
  function toothTile(dpr) {
    const k = Math.max(1, Math.round(dpr * 4) / 4);
    if (tooth.has(k)) return tooth.get(k);
    const cells = Math.max(8, Math.round(TOOTH / (PHOTO.toothCell * k)));
    const step = cells / TOOTH;
    const field = new Float32Array(TOOTH * TOOTH);
    for (let y = 0; y < TOOTH; y++) {
      const gy = y * step; const y0 = Math.floor(gy); let fy = gy - y0; fy = fy * fy * (3 - 2 * fy);
      const y1 = (y0 + 1) % cells;
      for (let x = 0; x < TOOTH; x++) {
        const gx = x * step; const x0 = Math.floor(gx); let fx = gx - x0; fx = fx * fx * (3 - 2 * fx);
        const x1 = (x0 + 1) % cells;
        const top = hash(x0, y0, 21) + (hash(x1, y0, 21) - hash(x0, y0, 21)) * fx;
        const bottom = hash(x0, y1, 21) + (hash(x1, y1, 21) - hash(x0, y1, 21)) * fx;
        field[y * TOOTH + x] = 0.78 * (top + (bottom - top) * fy) + 0.22 * hash(x, y, 22);
      }
    }
    // Equalise through the cumulative histogram, so heights are uniform on 0-1.
    const BINS = 1024; const counts = new Float64Array(BINS + 1);
    for (const v of field) counts[Math.min(BINS - 1, (v * BINS) | 0) + 1]++;
    for (let b = 1; b <= BINS; b++) counts[b] += counts[b - 1];
    for (let i = 0; i < field.length; i++) {
      const b = Math.min(BINS - 1, (field[i] * BINS) | 0);
      field[i] = (counts[b] + (counts[b + 1] - counts[b]) / 2) / field.length;
    }
    tooth.set(k, field);
    return field;
  }

  // A photo as a chalk drawing. Its fields (tones, contours, busy or flat, the streaks of the
  // haze) are computed on at most PHOTO.analysis points, at most one per css px, and read
  // bilinearly at the canvas resolution, where the marks are drawn. Per pixel: the coverage
  // its tone asks for, laid as strokes over a rubbed layer (busy) or as a smooth haze (flat);
  // the contours screened over it; the slate gaps cut out; the fade towards the edges.
  async function drawPhoto(source, signal) {
    const P = PHOTO;
    const { canvas, width: W, height: H, cssWidth, cssHeight } = source;
    // Points per css px: one at most, fewer for a large photo; never more than the canvas has.
    const perCss = Math.min(1, W / cssWidth, Math.sqrt(P.analysis / (cssWidth * cssHeight)));
    const aw = Math.max(8, Math.round(cssWidth * perCss)); const ah = Math.max(8, Math.round(cssHeight * perCss));
    const small = document.createElement('canvas');
    small.width = aw; small.height = ah;
    const sg = small.getContext('2d', { willReadFrequently: true });
    sg.imageSmoothingQuality = 'high';
    // Resampled to the analysis size off the main thread where the browser can; drawn here
    // otherwise (a large drawing's high-quality downscale is a long task of its own).
    let resized = null;
    try { resized = await createImageBitmap(canvas, { resizeWidth: aw, resizeHeight: ah, resizeQuality: 'high' }); } catch (error) { resized = null; }
    if (signal.aborted) { if (resized) resized.close(); return null; }
    sg.drawImage(resized || canvas, 0, 0, aw, ah);
    if (resized) resized.close();
    let pixels;
    try { pixels = sg.getImageData(0, 0, aw, ah).data; } catch (error) { return null; }
    await yieldTask();
    if (signal.aborted) return null;
    const N = aw * ah;
    const lum = new Float32Array(N);
    for (let i = 0; i < N; i++) lum[i] = (pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722) / 255;
    pixels = null;
    // Levels: stretch the 1-99 % range (from a histogram).
    const bins = new Uint32Array(256);
    for (let i = 0; i < N; i++) bins[Math.min(255, (lum[i] * 256) | 0)]++;
    const level = q => { let sum = 0; for (let b = 0; b < 256; b++) { sum += bins[b]; if (sum >= q * N) return b / 255; } return 1; };
    const lo = level(0.01); const hi = Math.max(lo + 0.05, level(0.99));
    for (let i = 0; i < N; i++) lum[i] = clamp01((lum[i] - lo) / (hi - lo));
    await yieldTask();
    if (signal.aborted) return null;
    const shortCss = Math.min(cssWidth, cssHeight);
    const busySigma = Math.min(P.busyRadius[2], Math.max(P.busyRadius[0], shortCss * P.busyRadius[1])) * perCss;
    const busyEdge2 = (2 * P.busyEdge / perCss) ** 2;      // a central difference spans two points
    const fields = await runSliced((function* fieldSteps() {
      // Busy or flat: the density of edges around a point, measured once thin dark subjects
      // (twigs, wires, a bird) are closed over (a grey closing), so the sky behind bare branches
      // stays a sky.
      const closed = yield* closeSteps(lum, aw, ah, Math.max(1, Math.round(P.closeRadius * perCss)));
      const cSmooth = yield* gaussSteps(closed, aw, ah, P.edgeSigma * perCss);
      const dense = new Float32Array(N);
      for (let y = 1; y < ah - 1; y++) {
        for (let x = 1, i = y * aw + 1; x < aw - 1; x++, i++) {
          const gx = cSmooth[i + 1] - cSmooth[i - 1]; const gy = cSmooth[i + aw] - cSmooth[i - aw];
          dense[i] = gx * gx + gy * gy > busyEdge2 ? 1 : 0;
        }
      }
      yield;
      const busy = yield* gaussSteps(dense, aw, ah, Math.max(2.5, busySigma));
      for (let i = 0; i < N; i++) busy[i] = smooth(P.flatFrom, P.flatTo, busy[i]);
      yield;
      // Contours: where the inner Gaussian exceeds the outer, the point is brighter than its
      // surround: the bright side of an edge, or a thin bright line itself. The dark side of an
      // edge (a thin dark line itself) is cut out of the chalk instead. A thin dark line has a
      // bright side on both flanks, and two chalk lines would read as one white line, so its
      // flanks are drawn faintly (thinLine): only the edges that remain once thin dark lines are
      // closed over are drawn in full. A flat region needs a stronger edge for a contour (a hand
      // draws a sky's main clouds only).
      const curve = (v, eps) => { const t = v > eps ? Math.tanh(P.phi * (v - eps)) : 0; return t < P.lineMin ? 0 : (t - P.lineMin) / (1 - P.lineMin); };
      const inner = yield* gaussSteps(lum, aw, ah, P.edgeSigma * perCss);
      const outer = yield* gaussSteps(lum, aw, ah, P.edgeSigma * P.edgeK * perCss);
      const thick = yield* closeSteps(lum, aw, ah, Math.max(1, Math.round(P.thinWidth * perCss)));
      const tIn = yield* gaussSteps(thick, aw, ah, P.edgeSigma * perCss);
      const tOut = yield* gaussSteps(thick, aw, ah, P.edgeSigma * P.edgeK * perCss);
      // The tone, with its detail raised (the residue of a guided filter, which keeps strong
      // edges, so raising it adds no halo).
      const smoothBase = yield* guidedSteps(inner, inner, aw, ah, Math.max(1, Math.round(P.detailRadius * perCss)), P.detailEps);
      const tone = new Float32Array(N);
      for (let i = 0; i < N; i++) tone[i] = clamp01(inner[i] + P.detail * (inner[i] - smoothBase[i]));
      yield;
      // A contour is pressed as hard as its surround is light (the guided filter's smooth tone):
      // the bright side of an edge in a dark, busy place (a leaf catching the light in a dark
      // crown, a blade of grass on a shaded slope) is drawn lightly, so a dark mass does not
      // turn into a scatter of white specks.
      const line = new Float32Array(N); const gap = new Float32Array(N);
      const [gateFrom, gateTo] = P.lineGate;
      for (let i = 0; i < N; i++) {
        const diff = inner[i] - outer[i];
        const eps = P.edgeEps * (1 + P.flatEdge * (1 - busy[i]));
        const gate = P.lineDark + (1 - P.lineDark) * smooth(gateFrom, gateTo, smoothBase[i]);
        line[i] = Math.max(P.thinLine * curve(diff, eps), curve(tIn[i] - tOut[i], eps)) * gate;
        gap[i] = curve(-diff, P.edgeEps);
        if ((i & 32767) === 32767) yield;
      }
      yield;
      // The haze's tone: the guided filter's smooth one over a wider radius (a flat sky's grain
      // and compression blocks are gone from it), its broad modelling raised (clarity: the
      // difference from a much wider blur, added again), so the billows of a storm cloud or the
      // light across a wall keep their gradation in the low midtones.
      const veilTone = yield* guidedSteps(inner, inner, aw, ah, Math.max(1, Math.round(P.veilRadius * perCss)), P.veilEps);
      const broad = yield* gaussSteps(veilTone, aw, ah, Math.max(2.5, P.clarityRadius * perCss));
      for (let i = 0; i < N; i++) veilTone[i] = clamp01(veilTone[i] + P.clarity * (veilTone[i] - broad[i]));
      yield;
      // The haze's streaks: value noise on long cells along rubAngle (two octaves, the finer one
      // turned a little, so no lattice shows), as a factor on its opacity.
      const streaks = new Float32Array(N);
      const [along, across, sweepLo, sweepHi, floor] = P.streak;
      const rub = (P.rubAngle * Math.PI) / 180;
      const turns = [[Math.cos(rub), Math.sin(rub)], [Math.cos(rub + 0.21), Math.sin(rub + 0.21)]];
      for (let y = 0, i = 0; y < ah; y++) {
        for (let x = 0; x < aw; x++, i++) {
          let v = 0;
          for (let o = 0; o < 2; o++) {
            const [c, s] = turns[o]; const k = o ? 2.3 : 1;
            const u = ((x * c + y * s) / perCss) * k / along; const w = ((y * c - x * s) / perCss) * k / across;
            v += valueNoise(u, w, 41 + o) * (o ? 0.35 : 0.65);
          }
          streaks[i] = floor + (1 - floor) * smooth(sweepLo, sweepHi, v);
        }
        if ((y & 31) === 31) yield;
      }
      return { line, gap, tone, veilTone, busy, streaks };
    })(), signal);
    if (!fields) return null;
    const { line, gap, tone, veilTone, busy, streaks } = fields;

    // The marks, at the canvas resolution, row by row in slices.
    const dpr = W / cssWidth;                // canvas px per css px
    const spacing = Math.min(P.spacing[1], Math.max(P.spacing[0], shortCss / P.spacingShare));
    const narrow = shortCss < P.small ? P.smallWidth : 1;
    const families = P.hatches.map((h, f) => {
      const a = (h.angle * Math.PI) / 180;
      return { ...h, width: h.width * narrow, salt: 101 + f * 37, ux: Math.cos(a), uy: Math.sin(a), nx: -Math.sin(a), ny: Math.cos(a), space: spacing * h.scale * dpr };
    });
    const strokePx = P.stroke * dpr; const taperPx = P.taper * dpr;
    const gapLo = P.gap[0] * dpr; const gapHi = P.gap[1] * dpr;
    const [pressLo, pressHi] = P.strokePress;
    const field = toothTile(dpr); const wrap = TOOTH - 1;
    const soft = 2 * P.toothSoft; const lift = 1 + P.toothSoft;   // a full pressure covers every cell
    const cMax = P.coverMax;
    const cover = (t, from, gamma) => (t <= from ? 0 : cMax * Math.pow((t - from) / (1 - from), gamma));
    const [rubFrom, rubGamma] = P.rubCover; const [veilFrom, veilGamma] = P.veilCover;
    // The fade towards the edges (canvas px), and the lower contrast away from the centre.
    const fadeFill = Math.min(P.fade[2], Math.max(P.fade[0], shortCss * P.fade[1])) * dpr;
    const fadeStroke = fadeFill * P.fadeStrokes;
    const fadeCell = 1 / (P.fadeCell * dpr);
    const cx = (W - 1) / 2; const cy = (H - 1) / 2; const rx2 = 1 / (cx * cx || 1); const ry2 = 1 / (cy * cy || 1);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const og = out.getContext('2d');
    const rows = Math.max(1, Math.floor(65536 / W));
    const [cr, cg, cb] = CHALK_RGB;
    const fx = (aw - 1) / Math.max(1, W - 1); const fy = (ah - 1) / Math.max(1, H - 1);
    // A field read bilinearly at point p (its top-left neighbour) with the given weights.
    const bilinear = (f, p, w00, w10, w01, w11) => f[p] * w00 + f[p + 1] * w10 + f[p + aw] * w01 + f[p + aw + 1] * w11;
    const done = await runSliced((function* markSteps() {
      for (let y0 = 0; y0 < H; y0 += rows) {
        const h = Math.min(rows, H - y0);
        const band = og.createImageData(W, h);
        const d = band.data;
        for (let y = y0; y < y0 + h; y++) {
          const ay = y * fy; const iy = Math.min(ah - 2, Math.floor(ay)); const ty = ay - iy;
          const toothRow = (y & wrap) * TOOTH;
          const ey = Math.min(y, H - 1 - y); const dy2 = (y - cy) * (y - cy) * ry2;
          for (let x = 0; x < W; x++) {
            // The ragged fade towards the edges: it starts a varying distance inside them.
            const e = Math.min(x, W - 1 - x, ey);
            let fadeF = 1; let fadeS = 1;
            if (e < fadeFill * (1 + P.fadeRagged)) {
              const ragged = valueNoise(x * fadeCell, y * fadeCell, 31) * P.fadeRagged;
              fadeF = smooth(ragged * fadeFill, (ragged + 1) * fadeFill, e);
              fadeS = smooth(ragged * fadeStroke, (ragged + 1) * fadeStroke, e);
              if (fadeS <= 0) continue;
            }
            const ax = x * fx; const ix = Math.min(aw - 2, Math.floor(ax)); const tx = ax - ix;
            const p = iy * aw + ix;
            const w00 = (1 - tx) * (1 - ty); const w10 = tx * (1 - ty); const w01 = (1 - tx) * ty; const w11 = tx * ty;
            const centre = 1 - P.centre * smooth(0.3, 1.6, (x - cx) * (x - cx) * rx2 + dy2);
            const t = bilinear(tone, p, w00, w10, w01, w11) * centre;
            const keep = bilinear(busy, p, w00, w10, w01, w11);
            const height = field[toothRow + (x & wrap)];
            // The marks: a contour, or a hatching stroke where the photo is busy.
            let press = bilinear(line, p, w00, w10, w01, w11) * P.linePress;
            const strokesKept = smooth(P.strokesFrom, 1, keep);
            if (strokesKept > 0.01) {
              for (const f of families) {
                const reach = smooth(f.from, f.to, t);
                if (reach <= 0) continue;
                const across = (x * f.nx + y * f.ny) / f.space;
                const j = Math.floor(across);
                // Each line has its own stroke length (0.7-1.3 of P.stroke) and phase.
                const period = strokePx * (0.7 + 0.6 * hash(j, 1, f.salt));
                const along = x * f.ux + y * f.uy + hash(j, 0, f.salt) * period;
                const s = Math.floor(along / period);
                const pos = along - s * period;
                const gapAt = gapLo + hash(j, s, f.salt + 1) * (gapHi - gapLo);
                if (pos < gapAt) continue;
                // A flat area keeps none of its strokes, as a hand would leave a sky, and the edge
                // of a busy one only a few, never a scatter of lone dashes.
                if (hash(j, s, f.salt + 4) > strokesKept) continue;
                const wander = (hash(j, s, f.salt + 2) - 0.5) * 2 * P.wander;
                const dist = Math.abs(across - j - 0.5 - wander) * f.space;
                let edge = reach * f.width * f.space - dist + 0.5;
                if (edge <= 0) continue;
                if (edge > 1) edge = 1;
                const taper = Math.min(1, (pos - gapAt) / taperPx, (period - pos) / taperPx);
                const a = edge * taper * (pressLo + (pressHi - pressLo) * hash(j, s, f.salt + 3)) * (0.6 + 0.4 * reach);
                if (a > press) press = a;
              }
            }
            press *= fadeS;
            // The tooth: chalk where the pressure beats the slate's height here; a light mark also
            // leaves thinner chalk on the peaks it reaches.
            let mark = 0;
            if (press > 0.01) {
              const q = (press * lift - height) / soft + 0.5;
              if (q > 0) mark = (q >= 1 ? 1 : q * q * (3 - 2 * q)) * (P.thin + (1 - P.thin) * press);
            }
            // The layers under the marks: rubbed with the slate's grain where busy, a smooth haze
            // in soft streaks where flat.
            const rubbed = cover(t, rubFrom, rubGamma) * P.rub * keep * (0.75 + 0.5 * height);
            const haze = keep > 0.99 ? 0 : cover(bilinear(veilTone, p, w00, w10, w01, w11) * centre, veilFrom, veilGamma) * P.veil * (1 - keep) *
              bilinear(streaks, p, w00, w10, w01, w11) * (1 + P.veilGrain * (height - 0.5));
            const layer = (rubbed + haze) * fadeF;
            let alpha = 1 - (1 - mark) * (1 - layer);
            if (alpha <= 0.004) continue;
            // The slate gap of a thin dark subject (a branch, a bird) or the dark side of an edge.
            alpha *= 1 - P.gapCut * bilinear(gap, p, w00, w10, w01, w11);
            if (alpha <= 0.004) continue;
            const i = ((y - y0) * W + x) * 4;
            d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = alpha * 255;
          }
          if ((y & 7) === 7) yield;
        }
        og.putImageData(band, 0, y0);
        yield;
      }
      return true;
    })(), signal);
    return done ? out : null;
  }

  // A graphic (a figure, a diagram, a screenshot). Its own background, the commonest opaque
  // colour along its border, becomes the slate; transparent pixels count as that background.
  // A light graphic goes through the paper matrix (dark lines and labels become chalk, colours
  // pastel chalk); a dark one (a dark app screenshot) keeps its lightness, slightly tinted by
  // its hue. A gain (from the 98th percentile of the ink) lifts faint ink so it reads. Output
  // is chalk over the slate: per pixel, the least alpha that reaches the target colour.
  async function drawGraphic(source, signal) {
    const { canvas, ctx2d, width: W, height: H } = source;
    const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let edge;
    try {
      edge = [ctx2d.getImageData(0, 0, W, 1), ctx2d.getImageData(0, H - 1, W, 1), ctx2d.getImageData(0, 0, 1, H), ctx2d.getImageData(W - 1, 0, 1, H)];
    } catch (error) { return null; }
    const counts = new Map(); let bestKey = -1; let best = 0; let clear = 0; let total = 0;
    for (const strip of edge) {
      const e = strip.data;
      for (let i = 0; i < e.length; i += 4) {
        total++;
        if (e[i + 3] < 128) { clear++; continue; }
        const key = ((e[i] >> 3) << 10) | ((e[i + 1] >> 3) << 5) | (e[i + 2] >> 3);
        const n = (counts.get(key) || 0) + 1;
        counts.set(key, n);
        if (n > best) { best = n; bestKey = key; }
      }
    }
    const bg = clear > total / 2 || bestKey < 0 ? [1, 1, 1]
      : [((bestKey >> 10) & 31) * 8 + 4, ((bestKey >> 5) & 31) * 8 + 4, (bestKey & 31) * 8 + 4].map(v => Math.min(255, v) / 255);
    const bgLum = lum(bg[0], bg[1], bg[2]);
    const light = bgLum >= 0.5;
    // The ink of one pixel (0-1 colour, alpha): how far it stands from the background.
    const inkOf = (r, g, b, a) => {
      const l = lum(r, g, b) * a + bgLum * (1 - a);
      return light ? clamp01(1 - l / Math.max(0.5, bgLum)) : clamp01((l - bgLum) / Math.max(0.2, 1 - bgLum));
    };
    // The gain, from a small copy: faint ink (a pale chart, a dim screenshot) is lifted.
    let gain = 1;
    {
      const n = 64; const sw = Math.max(1, Math.round(W >= H ? n : (n * W) / H)); const sh = Math.max(1, Math.round(H >= W ? n : (n * H) / W));
      const small = document.createElement('canvas'); small.width = sw; small.height = sh;
      const sg = small.getContext('2d', { willReadFrequently: true });
      sg.drawImage(canvas, 0, 0, sw, sh);
      const px = sg.getImageData(0, 0, sw, sh).data;
      const inks = [];
      for (let i = 0; i < px.length; i += 4) {
        const v = inkOf(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, px[i + 3] / 255);
        if (v > 0.04) inks.push(v);
      }
      if (inks.length > 12) {
        inks.sort((a, b) => a - b);
        const p98 = inks[Math.floor(inks.length * 0.98)];
        gain = light ? Math.min(1.6, Math.max(1, 0.92 / p98)) : Math.min(3, Math.max(1, 0.9 / p98));
      }
    }
    const S = saturation(PASTEL);
    const [gr, gg, gb] = GROUND_RGB;
    const paper0 = 1 / Math.max(0.5, bg[0]); const paper1 = 1 / Math.max(0.5, bg[1]); const paper2 = 1 / Math.max(0.5, bg[2]);
    const [[m00, m01, m02], [m10, m11, m12], [m20, m21, m22]] = BOARD_ROWS.map(row => row.a);
    const [o0, o1, o2] = BOARD_ROWS.map(row => row.b);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const og = out.getContext('2d');
    const rows = Math.max(1, Math.floor(24000 / W));
    const target = new Float32Array(3);
    const done = await runSliced((function* graphicSteps() {
      for (let y0 = 0; y0 < H; y0 += rows) {
        const h = Math.min(rows, H - y0);
        const band = ctx2d.getImageData(0, y0, W, h);
        const d = band.data;
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
          const a = d[i + 3] / 255;
          // Over its own background.
          const r = (d[i] / 255) * a + bg[0] * (1 - a); const g = (d[i + 1] / 255) * a + bg[1] * (1 - a); const b = (d[i + 2] / 255) * a + bg[2] * (1 - a);
          if (light) {
            // Its paper counts as white, so it becomes the slate exactly; the gain darkens ink.
            // (The matrix inline: no allocation per pixel.)
            let vr = 1 - gain * (1 - Math.min(1, r * paper0)); vr = vr < 0 ? 0 : vr;
            let vg = 1 - gain * (1 - Math.min(1, g * paper1)); vg = vg < 0 ? 0 : vg;
            let vb = 1 - gain * (1 - Math.min(1, b * paper2)); vb = vb < 0 ? 0 : vb;
            target[0] = clamp01(m00 * vr + m01 * vg + m02 * vb + o0) * 255;
            target[1] = clamp01(m10 * vr + m11 * vg + m12 * vb + o1) * 255;
            target[2] = clamp01(m20 * vr + m21 * vg + m22 * vb + o2) * 255;
          } else {
            // Light on dark already: its lightness above the background, as chalk tinted by its hue.
            const ink = clamp01(((lum(r, g, b) - bgLum) / Math.max(0.2, 1 - bgLum)) * gain);
            const tr = S[0][0] * r + S[0][1] * g + S[0][2] * b; const tg = S[1][0] * r + S[1][1] * g + S[1][2] * b; const tb = S[2][0] * r + S[2][1] * g + S[2][2] * b;
            const top = Math.max(tr, tg, tb, 1e-3);
            target[0] = gr + (CHALK_RGB[0] * (0.55 + 0.45 * clamp01(tr / top)) - gr) * ink;
            target[1] = gg + (CHALK_RGB[1] * (0.55 + 0.45 * clamp01(tg / top)) - gg) * ink;
            target[2] = gb + (CHALK_RGB[2] * (0.55 + 0.45 * clamp01(tb / top)) - gb) * ink;
          }
          let alpha = Math.max((target[0] - gr) / (255 - gr), (target[1] - gg) / (255 - gg), (target[2] - gb) / (255 - gb), 0);
          if (alpha < 0.012) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
          alpha = Math.min(1, alpha);
          d[i] = gr + (target[0] - gr) / alpha;
          d[i + 1] = gg + (target[1] - gg) / alpha;
          d[i + 2] = gb + (target[2] - gb) / alpha;
          const x = p % W; const y = y0 + ((p / W) | 0);
          if (hash(x, y, 11) < GRAPHIC_SPECKS) alpha *= GRAPHIC_KEEP;
          d[i + 3] = alpha * 255;
        }
        og.putImageData(band, 0, y0);
        yield;
      }
      return true;
    })(), signal);
    return done ? out : null;
  }

  function renderer(st) {
    return source => {
      if (!source.readable || st.ctx.signal.aborted) return null;
      return source.kind === 'photo' ? drawPhoto(source, st.ctx.signal) : drawGraphic(source, st.ctx.signal);
    };
  }

  /* ---------------------------------------------------------------------------
   * The first rub: a photo's tones as a soft haze of chalk until its drawing lands
   * ------------------------------------------------------------------------- */
  // A drawing takes a while (a tenth of a second to half a second a photo, one photo at a time,
  // after the file is decoded again), and until it lands the photo's frame would be bare slate
  // (the original is hidden). So each photo in or near the view gets a first rub at once: its
  // tones laid with the side of the chalk, from a small sample of the file (SiteLensesMedia's
  // sample(), decoded and resized off the main thread) stretched over the photo's box, under
  // the chalk grain. The drawing fades in over it and the rub fades out (LAND_MS). The rubs
  // live in their own layer just under the drawings and above nothing else of the page.
  function rubber(st) {
    if (st.rubs) return st.rubs;
    const { ctx } = st;
    const kit = window.SiteLensesMedia;
    if (!kit || typeof IntersectionObserver !== 'function') return null;
    const layer = ctx.layer('page');
    layer.classList.add('lens-chalk-rubs');
    const R = { layer, shown: new Map(), asked: new WeakSet(), queue: [], running: 0, io: null, unLayout: null, done: false };
    st.rubs = R;
    // The photo's content box (viewport px), and its rounding.
    const contentBox = img => {
      const r = img.getBoundingClientRect(); const s = getComputedStyle(img);
      const px = name => parseFloat(s[name]) || 0;
      const left = r.left + px('borderLeftWidth') + px('paddingLeft'); const top = r.top + px('borderTopWidth') + px('paddingTop');
      return { left, top, width: r.right - px('borderRightWidth') - px('paddingRight') - left, height: r.bottom - px('borderBottomWidth') - px('paddingBottom') - top, radius: s.borderRadius };
    };
    // A rub over its photo's content box, in the layer's coordinates.
    const place = (img, canvas) => {
      const b = contentBox(img); const box = layer.getBoundingClientRect();
      Object.assign(canvas.style, { left: `${b.left - box.left}px`, top: `${b.top - box.top}px`, width: `${b.width}px`, height: `${b.height}px`, borderRadius: b.radius });
    };
    // Which images may get a rub: same origin, shown at a fair size, not in a fixed container
    // (the lightbox) or a clipping one (a figure scroller), and not drawn yet.
    const eligible = img => {
      const src = img.getAttribute('src') || '';
      if (/^(https?:)?\/\//i.test(src) || !img.complete || !img.naturalWidth) return false;
      const r = img.getBoundingClientRect();
      if (r.width < RUB_MIN || r.height < RUB_MIN) return false;
      for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (s.position === 'fixed' || s.overflowX !== 'visible' || s.overflowY !== 'visible') return false;
      }
      return true;
    };
    const drawn = img => !!st.media && st.media.overlays.some(o => o.img === img && st.landed && st.landed.has(img));
    async function make(img) {
      let data = null;
      try { data = await kit.sample(img); } catch (error) { data = null; }
      if (R.done || !data || drawn(img) || kit.classify(data, img) !== 'photo' || !img.isConnected) return;
      const b = contentBox(img);
      const cssW = Math.max(1, b.width); const cssH = Math.max(1, b.height);
      // The sample as displayed (object-fit), on a rub of at most RUB_SIZE points a side, read
      // bilinearly here (a canvas drawn into another and read back may wait on the GPU).
      const k = RUB_SIZE / Math.max(cssW, cssH);
      const plan = kit.plan(img, cssW, cssH, k, getComputedStyle(img));
      if (!plan || plan.empty) return;
      const w = Math.max(2, plan.width); const h = Math.max(2, plan.height);
      const sw = data.width; const sh = data.height; const src = data.data;
      const s = sw / (img.naturalWidth || sw);
      const n = w * h; const tone = new Float32Array(n); const inside = new Uint8Array(n);
      const lumAt = (i) => (src[i] * 0.2126 + src[i + 1] * 0.7152 + src[i + 2] * 0.0722) / 255;
      for (let y = 0, i = 0; y < h; y++) {
        for (let x = 0; x < w; x++, i++) {
          // The point's place in the sample (natural px through the plan, then sample px).
          let u; let v;
          if (plan.whole) { u = ((x + 0.5) / w) * sw - 0.5; v = ((y + 0.5) / h) * sh - 0.5; }
          else {
            const fx = (x + 0.5 - plan.dx) / plan.dw; const fy = (y + 0.5 - plan.dy) / plan.dh;
            if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue;
            u = (plan.sx + fx * plan.sw) * s - 0.5; v = (plan.sy + fy * plan.sh) * s - 0.5;
          }
          const x0 = Math.max(0, Math.min(sw - 1, Math.floor(u))); const y0 = Math.max(0, Math.min(sh - 1, Math.floor(v)));
          const x1 = Math.min(sw - 1, x0 + 1); const y1 = Math.min(sh - 1, y0 + 1);
          const tx = clamp01(u - x0); const ty = clamp01(v - y0);
          const top = lumAt((y0 * sw + x0) * 4) * (1 - tx) + lumAt((y0 * sw + x1) * 4) * tx;
          const bottom = lumAt((y1 * sw + x0) * 4) * (1 - tx) + lumAt((y1 * sw + x1) * 4) * tx;
          tone[i] = top * (1 - ty) + bottom * ty;
          inside[i] = 1;
        }
      }
      // (Two tasks of a few ms each rather than one.)
      await yieldTask();
      if (R.done || drawn(img)) return;
      const image = new ImageData(w, h); const d = image.data;
      // Levels as the drawing has them (its 1-99 % range), softened; then laid as the drawing
      // lays a flat place: long soft streaks along PHOTO.rubAngle, fading out over a ragged
      // margin towards the edges (all in css px, so a rub looks the same at any size).
      const bins = new Uint32Array(256); let count = 0;
      for (let i = 0; i < n; i++) if (inside[i]) { bins[Math.min(255, (tone[i] * 256) | 0)]++; count++; }
      const level = q => { let sum = 0; for (let j = 0; j < 256; j++) { sum += bins[j]; if (sum >= q * count) return j / 255; } return 1; };
      const lo = level(0.01); const hi = Math.max(lo + 0.05, level(0.99));
      const soft = boxBlur(tone, w, h, 2);
      const per = cssW / w;                  // css px per point
      const [along, across, sweepLo, sweepHi, floor] = PHOTO.streak;
      const angle = (PHOTO.rubAngle * Math.PI) / 180; const ca = Math.cos(angle); const sa = Math.sin(angle);
      const [cr, cg, cb] = CHALK_RGB;
      for (let y = 0, i = 0; y < h; y++) {
        for (let x = 0; x < w; x++, i++) {
          if (!inside[i]) continue;
          const t = clamp01((soft[i] - lo) / (hi - lo));
          const px = x * per; const py = y * per;
          const streak = floor + (1 - floor) * smooth(sweepLo, sweepHi, valueNoise((px * ca + py * sa) / along, (py * ca - px * sa) / across, 43));
          const e = Math.min(px, cssW - px, py, cssH - py);
          const ragged = valueNoise(px / RUB_EDGE_CELL, py / RUB_EDGE_CELL, 47) * 0.6;
          const a = RUB_ALPHA * clamp01((t - RUB_FROM) / (1 - RUB_FROM)) * streak * smooth(ragged * RUB_EDGE, (ragged + 1) * RUB_EDGE, e);
          d[i * 4] = cr; d[i * 4 + 1] = cg; d[i * 4 + 2] = cb; d[i * 4 + 3] = Math.round(a * 255);
        }
      }
      if (R.done || drawn(img) || !img.isConnected) return;
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').putImageData(image, 0, 0);
      canvas.className = 'lens-chalk-rub';
      canvas.setAttribute('aria-hidden', 'true');
      place(img, canvas);
      layer.append(canvas);
      R.shown.set(img, canvas);
      if (!ctx.motion.matches && canvas.animate) canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RUB_IN_MS, easing: 'ease-out' });
      if (!R.unLayout) R.unLayout = ctx.onLayoutChange(() => { R.shown.forEach((c, i) => { if (i.isConnected) place(i, c); }); });
    }
    // Nearest the middle of the view first, RUB_AT_ONCE at a time.
    const pump = () => {
      while (!R.done && R.running < RUB_AT_ONCE && R.queue.length) {
        const middle = innerHeight / 2;
        R.queue.sort((a, b) => Math.abs(b.getBoundingClientRect().top - middle) - Math.abs(a.getBoundingClientRect().top - middle));
        const img = R.queue.pop();
        if (drawn(img) || R.shown.has(img) || !eligible(img)) { R.asked.delete(img); continue; }
        R.running++;
        make(img).catch(() => {}).finally(() => { R.running--; pump(); });
      }
    };
    R.io = new IntersectionObserver(records => {
      for (const record of records) {
        const img = record.target;
        if (!record.isIntersecting || R.asked.has(img)) continue;
        R.asked.add(img);
        R.queue.push(img);
      }
      pump();
    }, { rootMargin: RUB_NEAR });
    for (const root of ctx.scope) for (const img of root.querySelectorAll('img')) R.io.observe(img);
    // An image that loads later (a lazy one) is looked at again.
    R.onLoad = event => { const img = event.target; if (img && img.tagName === 'IMG' && !R.shown.has(img)) { R.asked.delete(img); R.io.unobserve(img); R.io.observe(img); } };
    for (const root of ctx.scope) root.addEventListener('load', R.onLoad, true);
    return R;
  }

  // The drawing of img has landed: its rub fades out under it.
  function retireRub(st, img) {
    const R = st.rubs;
    const canvas = R && R.shown.get(img);
    if (!canvas) return;
    R.shown.delete(img);
    if (st.ctx.motion.matches || !canvas.animate) { canvas.remove(); return; }
    const fade = canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LAND_MS, easing: 'ease-in', fill: 'forwards' });
    fade.finished.then(() => canvas.remove(), () => canvas.remove());
  }

  function dropRubs(st) {
    const R = st.rubs;
    if (!R) return;
    R.done = true;
    if (R.io) R.io.disconnect();
    if (R.unLayout) R.unLayout();
    for (const root of st.ctx.scope) root.removeEventListener('load', R.onLoad, true);
    R.layer.remove();
    R.shown.clear(); R.queue.length = 0;
    st.rubs = null;
  }

  /* ---------------------------------------------------------------------------
   * Measuring what is in view: lines of text, rules, images (viewport px)
   * ------------------------------------------------------------------------- */
  function viewRect() {
    return { w: document.documentElement.clientWidth || innerWidth, h: innerHeight };
  }

  // The lines of text in view, as boxes: each text node's line fragments, joined along a line.
  function textLines(st, view) {
    const boxes = [];
    const range = document.createRange();
    const margin = 4;
    for (const root of st.ctx.scope) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.nodeType === 3) return /\S/.test(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          if (node.matches(SKIP_TEXT) || node.matches('.lenses-layer, [hidden]')) return NodeFilter.FILTER_REJECT;
          const r = node.getBoundingClientRect();
          // Elements wholly above or below the view are skipped with everything in them.
          if ((r.width || r.height) && (r.bottom < -margin || r.top > view.h + margin)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP;
        }
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width < 0.5 || r.height < 0.5 || r.bottom < 0 || r.top > view.h || r.right < 0 || r.left > view.w) continue;
          boxes.push({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom });
        }
      }
    }
    // Join the fragments of one line (links, emphasis, superscripts) into one stroke of
    // writing: two boxes are on one line when they overlap vertically by half the smaller
    // height (a superscript does) and are less than WRITE_JOIN apart. Joined boxes are joined
    // again until nothing changes, as a superscript may first stand alone.
    const sameLine = (l, b) => Math.min(l.y1, b.y1) - Math.max(l.y0, b.y0) > Math.min(l.y1 - l.y0, b.y1 - b.y0) * 0.5 &&
      b.x0 - l.x1 < WRITE_JOIN && l.x0 - b.x1 < WRITE_JOIN;
    const join = (l, b) => { l.x0 = Math.min(l.x0, b.x0); l.x1 = Math.max(l.x1, b.x1); l.y0 = Math.min(l.y0, b.y0); l.y1 = Math.max(l.y1, b.y1); };
    boxes.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1) || a.x0 - b.x0);
    let lines = [];
    for (const b of boxes) {
      const line = lines.find(l => sameLine(l, b));
      if (line) join(line, b); else lines.push({ ...b });
    }
    for (let changed = true; changed;) {
      changed = false;
      const kept = [];
      for (const l of lines) {
        const into = kept.find(k => sameLine(k, l));
        if (into) { join(into, l); changed = true; } else kept.push(l);
      }
      lines = kept;
    }
    return lines.map(l => ({ x0: l.x0 - WRITE_PAD, x1: l.x1 + WRITE_PAD, y0: l.y0 - WRITE_PAD, y1: l.y1 + WRITE_PAD + 1 }));
  }

  // The chalk rules under section headings in view.
  function ruleLines(st, view) {
    const main = document.getElementById('main-content');
    if (!main || st.kind === 'paper') return [];
    return [...main.querySelectorAll(RULES)].map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0 && r.bottom > 0 && r.bottom - RULE_BAND < view.h)
      .map(r => ({ x0: r.left - 2, x1: r.right + 2, y0: r.bottom - RULE_BAND, y1: r.bottom + 2, rule: true }));
  }

  // The images in view that the lens draws (same origin, not tiny).
  function imagesInView(st, view) {
    const found = [];
    for (const root of st.ctx.scope) {
      for (const img of root.querySelectorAll('img')) {
        const src = img.getAttribute('src') || '';
        if (/^(https?:)?\/\//i.test(src)) continue;
        const r = img.getBoundingClientRect();
        if (r.width < 24 || r.height < 24 || r.bottom < 0 || r.top > view.h || r.right < 0 || r.left > view.w) continue;
        found.push({ img, x0: r.left, x1: r.right, y0: r.top, y1: r.bottom });
      }
    }
    return found;
  }

  /* ---------------------------------------------------------------------------
   * The sheet of slate (enter and exit draw on it)
   * ------------------------------------------------------------------------- */
  function sheetLayer(st) {
    if (!st.sheets) {
      st.sheets = st.ctx.layer('page');
      st.sheets.classList.add('lens-chalk-sheets');
    }
    return st.sheets;
  }

  // A canvas over the viewport, in document coordinates (it scrolls with the page).
  function makeSheet(st, className) {
    const view = viewRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.width = Math.max(1, Math.round(view.w * dpr)); canvas.height = Math.max(1, Math.round(view.h * dpr));
    Object.assign(canvas.style, { left: `${scrollX}px`, top: `${scrollY}px`, width: `${view.w}px`, height: `${view.h}px` });
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    sheetLayer(st).append(canvas);
    return { canvas, g, x: scrollX, y: scrollY, w: view.w, h: view.h, dpr };
  }

  // Paints the board over the rows y0..y1 of a sheet, in register with the root background (the
  // tile's origin at the document's top left): the decoded tile drawn once per tile position,
  // over the flat ground. (A canvas pattern of the tile costs about 20 ms however small the
  // area, the tiles drawn as images a few ms for the whole viewport.)
  function paintSlate(sheet, g = sheet.g, y0 = 0, y1 = sheet.h) {
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = GROUND;
    g.fillRect(0, y0, sheet.w, y1 - y0);
    const tile = board && (board.bitmap || (board.image && board.image.complete ? board.image : null));
    if (tile) {
      const k = board.scale;
      const ox = -mod(sheet.x, BOARD_TILE); const oy = -mod(sheet.y, BOARD_TILE);
      try {
        for (let ty = oy; ty < y1; ty += BOARD_TILE) {
          const a = Math.max(y0, ty); const b = Math.min(y1, ty + BOARD_TILE);
          if (b <= a) continue;
          for (let tx = ox; tx < sheet.w; tx += BOARD_TILE) g.drawImage(tile, 0, (a - ty) * k, BOARD_TILE * k, (b - a) * k, tx, a, BOARD_TILE, b - a);
        }
      } catch (error) { /* the flat ground stays */ }
    }
    g.restore();
  }

  // Paints the board over a whole sheet a band of SLATE_BAND css px at a time; run with
  // runSliced (a 2x viewport is a long task of its own).
  function* slateSteps(sheet, g = sheet.g) {
    for (let y = 0; y < sheet.h; y += SLATE_BAND) {
      paintSlate(sheet, g, y, Math.min(sheet.h, y + SLATE_BAND));
      yield;
    }
    return true;
  }

  // Fades a sheet's opacity (a CSS transition); resolves when done, at once without motion, in
  // a hidden page, or as soon as stop() turns true (checked every STOP_POLL_MS; the fade then
  // jumps to its end).
  function fadeSheet(sheet, to, ms, signal, stop = null) {
    ms *= pace.slow;
    const style = sheet.canvas.style;
    const jump = () => { style.transition = 'none'; style.opacity = String(to); };
    if (!ms || (signal && signal.aborted) || document.hidden || (stop && stop())) { jump(); return Promise.resolve(); }
    void sheet.canvas.getBoundingClientRect();
    style.transition = `opacity ${ms}ms ease`;
    style.opacity = String(to);
    if (!stop) return sleep(ms + 20, signal);
    return new Promise(resolve => {
      const began = performance.now();
      const poll = () => {
        if (stop() || document.hidden) { jump(); resolve(); return; }
        if (performance.now() - began >= ms + 20) { resolve(); return; }
        setTimeout(poll, STOP_POLL_MS);
      };
      setTimeout(poll, STOP_POLL_MS);
    });
  }

  /* ---------------------------------------------------------------------------
   * Enter: the writing
   * ------------------------------------------------------------------------- */
  // Clears the sheet line by line (and image by image); resolves when everything in view is
  // written, or at once when the activation is abandoned. The dust (its own sheet, st.dust)
  // keeps falling after that until its last speck is gone or the sheet is removed.
  function write(st, sheet) {
    const { ctx } = st;
    const view = { w: sheet.w, h: sheet.h };
    const rand = random(SEED + 3);
    const startOf = top => clamp01(top / view.h) * WRITE_STAGGER + rand() * WRITE_JITTER;
    const lines = [...textLines(st, view), ...ruleLines(st, view)].map(l => {
      const length = l.x1 - l.x0;
      return { ...l, start: startOf(l.y0), dur: Math.min(WRITE_MAX, Math.max(WRITE_MIN, length / WRITE_SPEED)), front: l.x0, done: false };
    });
    const pictures = imagesInView(st, view).map(p => ({ ...p, start: clamp01(p.y0 / view.h) * IMAGE_STAGGER, began: -1, done: false }));
    const dust = makeSheet(st, 'lens-chalk-dust');
    st.dust = dust;
    const specks = [];
    const angle = (PHOTO.hatches[0].angle * Math.PI) / 180;
    const ux = Math.cos(angle); const uy = Math.sin(angle);
    const chalk = `rgb(${CHALK_RGB.join(',')})`;
    let elapsed = 0; let writing = true;
    return new Promise(resolve => {
      const anim = { stopped: false, stop() { this.stopped = true; } };
      st.anim = anim;
      // An abort ends the writing whether or not a frame comes. The writing's clock is the sum
      // of the frame loop's steps (dt), not the wall clock: while the page is hidden the loop
      // pauses, and the writing pauses with it and goes on where it was when the page shows
      // again (the core's limit pauses too).
      const done = () => {
        if (!writing) return;
        writing = false;
        ctx.signal.removeEventListener('abort', done);
        if (st.anim === anim) st.anim = null;
        resolve();
      };
      ctx.signal.addEventListener('abort', done);
      // A picture is ready to be drawn in once its drawing, or its first rub, is there.
      const shown = img => (st.media && st.media.overlays.some(o => o.img === img)) || (st.rubs && st.rubs.shown.has(img));
      const tick = dt => {
        if (anim.stopped || ctx.signal.aborted) { done(); return false; }
        dt /= pace.slow;
        elapsed += dt;
        const t = elapsed;
        let pending = 0;
        if (writing) {
          const g = sheet.g;
          g.save();
          g.globalCompositeOperation = 'destination-out';
          for (const l of lines) {
            if (l.done) continue;
            pending++;
            if (t < l.start) continue;
            const p = clamp01((t - l.start) / l.dur);
            const front = l.x0 + (l.x1 - l.x0) * (0.4 * p + 0.6 * easeInOut(p));
            g.fillStyle = '#000';
            g.fillRect(l.front - 1, l.y0, front - l.front + 1, l.y1 - l.y0);
            if (p < 1) {
              // A soft front: the chalk's edge, a few px ahead of the cleared part.
              const ahead = Math.min(6, l.x1 - front);
              if (ahead > 0) {
                const soft = g.createLinearGradient(front, 0, front + ahead, 0);
                soft.addColorStop(0, 'rgba(0,0,0,0.55)'); soft.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = soft; g.fillRect(front, l.y0, ahead, l.y1 - l.y0);
              }
              if (!l.rule && specks.length < DUST_MAX && Math.random() < DUST_RATE * dt) {
                specks.push({
                  x: front, y: lerp(l.y0 + 2, l.y1 - 1, Math.random()), vx: (Math.random() - 0.5) * 24, vy: 10 + Math.random() * 40,
                  age: 0, life: lerp(DUST_LIFE[0], DUST_LIFE[1], Math.random()), size: lerp(DUST_SIZE[0], DUST_SIZE[1], Math.random()), alpha: 0.5 + Math.random() * 0.4
                });
              }
            } else l.done = true;
            l.front = front;
          }
          for (const pic of pictures) {
            if (pic.done) continue;
            pending++;
            if (t < pic.start) continue;
            if (pic.began < 0) {
              if (!shown(pic.img) && t < pic.start + IMAGE_WAIT && t < WRITE_LIMIT - IMAGE_DRAW) continue;
              pic.began = t;
            }
            // The front moves along the main hatching direction, from the corner where the
            // strokes begin; behind it the drawing shows.
            const corners = [[pic.x0, pic.y0], [pic.x1, pic.y0], [pic.x0, pic.y1], [pic.x1, pic.y1]].map(([x, y]) => x * ux + y * uy);
            const lo = Math.min(...corners); const hi = Math.max(...corners);
            const p = clamp01((t - pic.began) / IMAGE_DRAW);
            const reach = lo + (hi - lo + IMAGE_FEATHER) * easeInOut(p);
            g.save();
            g.beginPath(); g.rect(pic.x0 - 1, pic.y0 - 1, pic.x1 - pic.x0 + 2, pic.y1 - pic.y0 + 2); g.clip();
            // In a frame whose x axis runs along the hatching: everything with x < reach clears.
            g.transform(ux, uy, -uy, ux, 0, 0);
            const span = (pic.x1 - pic.x0) + (pic.y1 - pic.y0) + 4;
            const across = pic.x0 * -uy + pic.y0 * ux;
            const soft = g.createLinearGradient(reach - IMAGE_FEATHER, 0, reach, 0);
            soft.addColorStop(0, 'rgba(0,0,0,1)'); soft.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = soft;
            g.fillRect(lo - 4, across - span, reach - lo + 4, span * 2);
            g.restore();
            if (p >= 1) pic.done = true;
          }
          g.restore();
          if (!pending || t > WRITE_LIMIT) done();
        }
        // The dust: specks fall from the fronts and fade.
        const dg = dust.g;
        dg.clearRect(0, 0, dust.w, dust.h);
        dg.fillStyle = chalk;
        for (let i = specks.length - 1; i >= 0; i--) {
          const s = specks[i];
          s.age += dt; s.vy += DUST_GRAVITY * dt; s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.age >= s.life || s.y > dust.h) { specks.splice(i, 1); continue; }
          dg.globalAlpha = s.alpha * Math.sqrt(1 - s.age / s.life);
          dg.fillRect(s.x, s.y, s.size, s.size);
        }
        dg.globalAlpha = 1;
        if (!writing && (!specks.length || !dust.canvas.isConnected)) return false;
        return undefined;
      };
      ctx.frame(tick);
    });
  }

  /* ---------------------------------------------------------------------------
   * Exit: the eraser
   * ------------------------------------------------------------------------- */
  // The board as it is right after erasing, on a canvas the size of the sheet: clean slate,
  // faint felt streaks along each pass, densest at its edges where the dust gathers, and a faint
  // smear of every line and drawing that was in view (thin streaks of uneven chalk, dragged
  // along the pass that crossed it). Returns { canvas, steps, progress }: steps paints it in
  // slices, so the exit's first frame waits for none of it: the slate a band at a time from the
  // top (progress.slated: how far down it is done), then the streaks and smears in the order
  // the felt reaches them (pass by pass, along its direction; the felt reaches a mark long after
  // its smear is drawn).
  function erasedBoard(sheet, marks, passes) {
    const canvas = document.createElement('canvas');
    canvas.width = sheet.canvas.width; canvas.height = sheet.canvas.height;
    const g = canvas.getContext('2d');
    g.setTransform(sheet.dpr, 0, 0, sheet.dpr, 0, 0);
    const chalk = CHALK_RGB.join(',');
    const rand = random(SEED + 5);
    g.lineCap = 'round';
    // One smear: a thin stroke of chalk dragged along the pass from where the line was, in one
    // to three pieces of uneven length, each tilted and bowed a little, fading at both ends.
    const streak = (x0, x1, y, height, alpha, dir) => {
      const span = x1 - x0;
      const pieces = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < pieces; k++) {
        const a = x0 + span * (k / pieces + rand() * 0.18); const b = x0 + span * ((k + 1) / pieces - rand() * 0.18);
        if (b - a < 4) continue;
        const from = dir > 0 ? a : b; const to = dir > 0 ? b + SMEAR_RUN * (0.4 + 0.6 * rand()) : a - SMEAR_RUN * (0.4 + 0.6 * rand());
        const tilt = (rand() - 0.5) * 2 * SMEAR_TILT; const bow = (rand() - 0.5) * 2 * SMEAR_TILT;
        const smear = g.createLinearGradient(from, 0, to, 0);
        smear.addColorStop(0, `rgba(${chalk},0)`);
        smear.addColorStop(0.1 + rand() * 0.1, `rgba(${chalk},${alpha})`);
        smear.addColorStop(0.6 + rand() * 0.15, `rgba(${chalk},${alpha * 0.55})`);
        smear.addColorStop(1, `rgba(${chalk},0)`);
        g.strokeStyle = smear;
        g.lineWidth = height;
        g.beginPath(); g.moveTo(from, y); g.quadraticCurveTo((from + to) / 2, y + tilt / 2 + bow, to, y + tilt); g.stroke();
      }
    };
    // Felt streaks: each over part of the pass only, tapered at both ends, bowed a little and
    // sloping with the pass's drift, so they read as dragged felt rather than scan lines.
    const feltStreak = p => {
      const slope = (p.dir * PASS_DRIFT) / sheet.w;
      const u = rand();
      const edge = Math.pow(Math.abs(2 * u - 1), 4);
      const alpha = (0.008 + rand() * 0.018) * (1 + 2 * edge);
      const length = sheet.w * lerp(FELT_SPAN[0], FELT_SPAN[1], rand());
      const x0 = lerp(-0.1 * length, sheet.w - 0.9 * length, rand()); const x1 = x0 + length;
      const y0 = lerp(p.top, p.bottom, u) + (x0 - sheet.w / 2) * slope;
      const y1 = y0 + length * slope + (rand() - 0.5) * FELT_WOBBLE;
      const bow = (rand() - 0.5) * 2 * FELT_WOBBLE;
      const taper = g.createLinearGradient(x0, 0, x1, 0);
      taper.addColorStop(0, `rgba(${chalk},0)`);
      taper.addColorStop(0.2 + rand() * 0.15, `rgba(${chalk},${alpha})`);
      taper.addColorStop(0.65 + rand() * 0.15, `rgba(${chalk},${alpha * 0.7})`);
      taper.addColorStop(1, `rgba(${chalk},0)`);
      g.strokeStyle = taper;
      g.lineWidth = 0.6 + rand() * 1.4;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + bow, x1, y1); g.stroke();
    };
    // Each mark belongs to the pass across its middle; within a pass the felt meets the marks
    // in its direction of travel.
    const passOf = m => { const y = (m.y0 + m.y1) / 2; return passes.find(p => y >= p.top && y < p.bottom) || passes[passes.length - 1]; };
    // The slate first, a band at a time from the top (each pass's rows are clean slate before
    // the felt starts it: erase() waits a frame or two for them), then the streaks and smears.
    const progress = { slated: 0 };
    function* steps() {
      const bands = slateSteps(sheet, g);
      for (let y = 0; !bands.next().done; y += SLATE_BAND) { progress.slated = Math.min(sheet.h, y + SLATE_BAND); yield; }
      progress.slated = Infinity;
      for (const p of passes) {
        for (let k = 0; k < FELT_STREAKS; k++) { feltStreak(p); if ((k & 7) === 7) yield; }
        const own = marks.filter(m => passOf(m) === p).sort((a, b) => (p.dir > 0 ? a.x0 - b.x0 : b.x1 - a.x1));
        for (const m of own) {
          const height = m.y1 - m.y0;
          // A line of text leaves a few streaks across its middle; a drawing a broad haze of them.
          const count = m.picture ? Math.max(6, Math.round(height / 3)) : 3 + Math.round(rand() * 2);
          const weight = m.picture ? 0.35 : 1;
          for (let k = 0; k < count; k++) {
            const y = m.picture ? lerp(m.y0, m.y1, rand()) : lerp(m.y0 + height * 0.22, m.y1 - height * 0.3, rand());
            const jag = (rand() - 0.5) * 18;
            streak(m.x0 + jag, m.x1 + jag * 0.5, y, 0.8 + rand() * (m.picture ? 3.5 : 2.2), SMEAR_ALPHA * weight * (0.45 + rand() * 0.9), p.dir);
            if (m.picture && (k & 7) === 7) yield;
          }
          yield;
        }
      }
      return true;
    }
    return { canvas, steps: steps(), progress };
  }

  // Three passes, alternating direction, each a broad band crossing the viewport with a
  // slight downward drift. Behind the felt the erased board shows: each frame copies it onto
  // the sheet over the stretch the felt has crossed since the last frame, clipped to the felt's
  // shape: ragged top and bottom edges (value noise along the pass, in three octaves) and a
  // leading edge whose profile varies down its height, as felt presses unevenly. Just ahead of
  // that edge the felt's print is lighter: a few thin bands of the erased board at a low
  // opacity, each from the leading edge to a front that frays row by row, so the print fades
  // ahead of the felt in ragged steps rather than as one flat band. The clock is the sum of
  // the frame loop's steps (dt), so a page hidden midway pauses the eraser (the core's loop
  // pauses there) and it goes on where it was. Resolves with true once the board is all erased,
  // and with false as soon as an instant reset wants the lens gone: that is checked on every
  // frame and, as no frame runs in a hidden page, every STOP_POLL_MS by a timer as well.
  function erase(st, sheet) {
    const { ctx } = st;
    const { w, h, dpr } = sheet;
    const width = Math.max(ERASER_MIN, w * ERASER_WIDTH);
    const band = h / PASSES;
    const rand = random(SEED + 9);
    const passes = Array.from({ length: PASSES }, (_, k) => ({
      k, dir: k % 2 ? -1 : 1,
      top: k ? k * band - PASS_OVERLAP / 2 : -FELT_RAGGED - PASS_DRIFT,
      bottom: k < PASSES - 1 ? (k + 1) * band + PASS_OVERLAP / 2 : h + FELT_RAGGED + PASS_DRIFT,
      salt: 61 + k * 7, lead: Array.from({ length: Math.ceil(h / FELT_ROW) + 2 }, () => rand())
    }));
    const marks = [...textLines(st, { w, h }), ...imagesInView(st, { w, h }).map(p => ({ ...p, picture: true }))];
    const wiped = erasedBoard(sheet, marks, passes);
    const erased = wiped.canvas;
    const g = sheet.g;
    // The felt's leading edge (x of the edge, in its direction of travel) at a height, and its
    // top and bottom edges at an x; u is the share of the crossing done.
    const along = (pass, u) => (pass.dir > 0 ? lerp(0, w + width, u) : lerp(w, -width, u));
    const leadAt = (pass, x, y) => {
      const j = Math.max(0, y / FELT_ROW); const i = Math.floor(j); const f = j - i;
      const r = pass.lead[Math.min(i, pass.lead.length - 1)] * (1 - f) + pass.lead[Math.min(i + 1, pass.lead.length - 1)] * f;
      const swell = valueNoise(y / FELT_SWELL, pass.k, pass.salt) - 0.5;
      return x + pass.dir * (swell * 2 * FELT_LEAD + (r - 0.5) * FELT_JAG);
    };
    const edgeAt = (pass, x, side) => {
      const u = pass.dir > 0 ? x / w : 1 - x / w;
      const base = side < 0 ? pass.top : pass.bottom;
      return base - PASS_DRIFT / 2 + PASS_DRIFT * clamp01(u) +
        (valueNoise(x / FELT_SWELL, side, pass.salt + 1) - 0.5) * 2 * FELT_RAGGED +
        (valueNoise(x / FELT_FRAY, side + 5, pass.salt + 3) - 0.5) * 2 * FELT_FRAY_DEPTH +
        (valueNoise(x / FELT_STEP, side + 3, pass.salt + 2) - 0.5) * FELT_JAG;
    };
    // The felt's outline from behind (`back`) to the leading edge at `to`: along the top, down
    // the leading edge's profile, back along the bottom.
    const outline = (pass, back, to) => {
      const ahead = x => (pass.dir > 0 ? x < to : x > to);
      g.moveTo(back, edgeAt(pass, back, -1));
      for (let x = back + pass.dir * FELT_STEP; ahead(x); x += pass.dir * FELT_STEP) g.lineTo(x, edgeAt(pass, x, -1));
      const top = edgeAt(pass, to, -1); const bottom = edgeAt(pass, to, 1);
      for (let y = top; y < bottom; y += FELT_ROW) g.lineTo(leadAt(pass, to, y), y);
      g.lineTo(leadAt(pass, to, bottom), bottom);
      for (let x = to - pass.dir * FELT_STEP; pass.dir > 0 ? x > back : x < back; x -= pass.dir * FELT_STEP) g.lineTo(x, edgeAt(pass, x, 1));
      g.lineTo(back, edgeAt(pass, back, 1));
      g.closePath();
    };
    // Copies the erased board, clipped to the current path, over the columns lo..hi of a pass
    // (a plain copy: a pattern filled under a clip costs ten times as much).
    const copy = (pass, lo, hi, alpha) => {
      g.clip();
      const y0 = Math.max(0, pass.top - PASS_DRIFT - FELT_RAGGED - FELT_FRAY_DEPTH); const y1 = Math.min(h, pass.bottom + PASS_DRIFT + FELT_RAGGED + FELT_FRAY_DEPTH);
      g.globalAlpha = alpha;
      g.drawImage(erased, lo * dpr, y0 * dpr, (hi - lo) * dpr, (y1 - y0) * dpr, lo, y0, hi - lo, y1 - y0);
    };
    const reach = FELT_LEAD + FELT_JAG;
    // The stretch the felt crossed, from the edge at `from` to the edge at `to` (both
    // leading-edge positions of one pass), fully erased.
    const sweep = (pass, from, to) => {
      const lo = Math.max(0, Math.min(from, to) - reach); const hi = Math.min(w, Math.max(from, to) + reach);
      if (hi <= lo) return;
      g.save();
      g.beginPath();
      outline(pass, pass.dir > 0 ? lo : hi, to);
      copy(pass, lo, hi, 1);
      g.restore();
    };
    // The lighter print ahead of the leading edge at x: FELT_SOFT_BANDS bands, each from that
    // edge to a front up to its share of FELT_SOFT ahead, frayed row by row (felt fibres; the
    // rows are fixed in the page, so the fibres do not flicker from frame to frame), and kept
    // within the felt's ragged top and bottom.
    const softPrint = (pass, x) => {
      const ahead = x + pass.dir * FELT_SOFT;
      const lo = Math.max(0, Math.min(x, ahead) - reach); const hi = Math.min(w, Math.max(x, ahead) + reach);
      if (hi <= lo) return;
      const r0 = Math.floor(Math.min(edgeAt(pass, x, -1), edgeAt(pass, ahead, -1)) / FELT_FIBRE);
      const r1 = Math.ceil(Math.max(edgeAt(pass, x, 1), edgeAt(pass, ahead, 1)) / FELT_FIBRE);
      for (let b = 1; b <= FELT_SOFT_BANDS; b++) {
        const depth = (FELT_SOFT * b) / FELT_SOFT_BANDS;
        g.save();
        g.beginPath();
        outline(pass, pass.dir > 0 ? lo : hi, ahead + pass.dir * reach);
        g.clip();
        g.beginPath();
        for (let r = r0; r <= r1; r++) { const y = r * FELT_FIBRE; if (r === r0) g.moveTo(leadAt(pass, x, y), y); else g.lineTo(leadAt(pass, x, y), y); }
        for (let r = r1; r >= r0; r--) {
          const y = r * FELT_FIBRE;
          g.lineTo(leadAt(pass, x + pass.dir * depth * (0.15 + 0.85 * hash(r, b, pass.salt + 4)), y), y);
        }
        g.closePath();
        copy(pass, lo, hi, FELT_SOFT_ALPHA);
        g.restore();
      }
    };
    const total = PASSES * PASS_S;
    // The smears are drawn in slices meanwhile, in the felt's order; they stop with the eraser.
    const smearing = { aborted: false };
    runSliced(wiped.steps, smearing);
    return new Promise(resolve => {
      let elapsed = 0; let last = 0; let finished = false; let poll = 0;
      const finish = complete => {
        if (finished) return;
        finished = true;
        smearing.aborted = true;
        clearTimeout(poll);
        resolve(complete);
      };
      const wanted = () => ctx.instant || ctx.motion.matches;
      const watch = () => { if (finished) return; if (wanted()) finish(false); else poll = setTimeout(watch, STOP_POLL_MS); };
      poll = setTimeout(watch, STOP_POLL_MS);
      const tick = dt => {
        if (finished) return false;
        if (wanted()) { finish(false); return false; }
        // The felt starts a pass only on clean slate: until the rows it crosses are painted (a
        // frame or two at the start), the clock waits.
        const pass = passes[Math.min(PASSES - 1, Math.floor(elapsed / PASS_S))];
        if (wiped.progress.slated < Math.min(h, pass.bottom + PASS_DRIFT + FELT_RAGGED + FELT_FRAY_DEPTH)) return undefined;
        elapsed += dt / pace.slow;
        const t = Math.min(total, elapsed);
        // Every pass crossed since the last frame, from where the felt was to where it is.
        for (let k = Math.min(PASSES - 1, Math.floor(last / PASS_S)); k <= Math.min(PASSES - 1, Math.floor(t / PASS_S)); k++) {
          const u0 = easeInOut(clamp01(last / PASS_S - k)); const u1 = easeInOut(clamp01(t / PASS_S - k));
          if (u1 > u0 || t >= total) sweep(passes[k], along(passes[k], u0), along(passes[k], u1));
        }
        // The felt's leading edge is soft: a lighter print just ahead of it.
        if (t < total) {
          const pass = passes[Math.min(PASSES - 1, Math.floor(t / PASS_S))];
          softPrint(pass, along(pass, easeInOut(clamp01(t / PASS_S - pass.k))));
        }
        last = t;
        if (t >= total) { finish(true); return false; }
        return undefined;
      };
      ctx.frame(tick);
    });
  }

  /* ---------------------------------------------------------------------------
   * Activation
   * ------------------------------------------------------------------------- */
  function pageKind(ctx) {
    if (ctx.page && ctx.page.kind) return ctx.page.kind;
    if (document.querySelector('#main-content.paper-container')) return 'paper';
    if (document.querySelector('#main-content .profile-section')) return 'home';
    return /\/blogs\//.test(location.pathname) ? 'blog' : 'site';
  }

  function build(ctx) {
    const kind = pageKind(ctx);
    const st = { ctx, kind, on: false, media: null, mediaReady: null, landed: null, srcWatch: null, rubs: null, sheets: null, anim: null, sheet: null, dust: null, tiles: null };
    state = st;
    // One layer holds what the lens defines rather than draws: the tiles' stylesheet (switchOn)
    // and, on a paper page, the colour matrix.
    st.defs = ctx.layer('fixed');
    st.defs.classList.add('lens-chalk-defs-layer');
    if (kind === 'paper') {
      // The colour matrix chalk.css applies to the paper page's header, main and footer.
      const ns = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(ns, 'svg');
      defs.setAttribute('class', 'lens-chalk-defs'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', MATRIX_ID); filter.setAttribute('color-interpolation-filters', 'sRGB');
      const matrix = document.createElementNS(ns, 'feColorMatrix');
      matrix.setAttribute('type', 'matrix'); matrix.setAttribute('values', boardMatrix());
      filter.append(matrix); defs.append(filter);
      st.defs.append(defs);
    }
    html.classList.add(CLS.base, kind === 'paper' ? CLS.paper : CLS.shell);
    if (kind === 'home') html.classList.add(CLS.home);
    return st;
  }

  // The board and the grain; false when the activation was abandoned meanwhile.
  async function prepare(st, decoded = true) {
    st.grain = makeGrain();
    const made = await makeBoard(st.ctx.signal, decoded);
    return !st.ctx.signal.aborted && state === st && !!made;
  }

  // The drawings of the images: overlays from the media helper. They may start before the
  // switch (entering, under the sheet of slate); chalk.css keeps them hidden until it. The
  // photos near the view get a first rub meanwhile (rubber()).
  function startMedia(st) {
    if (st.mediaReady) return;
    // fixed: the photography lightbox (outside the scope, position: fixed) is drawn too.
    st.mediaReady = st.ctx.media({ render: renderer(st), fixed: true }).then(handle => {
      if (state !== st || st.ctx.signal.aborted) { handle.dispose(); return null; }
      st.media = handle;
      // A drawing lands softly the first time it is shown for its image and source (on
      // arriving, scrolled into view, or the lightbox's next photo), never again for the same
      // pair (a re-render after a resize replaces it in place, and one shown again from the
      // helper's cache after scrolling away and back is already known).
      const landed = new WeakMap();
      st.landed = landed;
      // An image in a fixed container (the lightbox) changes its source in place: its old
      // drawing is hidden at once, so the next photo's title never stands over the previous
      // photo, and the backdrop's slate shows until the new drawing lands (and fades in).
      st.srcWatch = new MutationObserver(records => {
        for (const record of records) {
          const img = record.target;
          const overlay = st.media && st.media.overlays.find(o => o.img === img);
          if (overlay) overlay.canvas.style.opacity = landed.get(img) === img.src ? '' : '0';
        }
      });
      handle.each(overlay => {
        const img = overlay.img;
        if (overlay.fixed) st.srcWatch.observe(img, { attributes: true, attributeFilter: ['src', 'srcset'] });
        if (landed.get(img) === img.src) return;
        landed.set(img, img.src);
        retireRub(st, img);
        if (st.ctx.motion.matches || !overlay.canvas.animate) return;
        overlay.canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LAND_MS, easing: 'ease-out' });
      });
      // (A paper page's images are figures, drawn as graphics in one quick pass: no rub.)
      if (st.kind !== 'paper') rubber(st);
      return handle.ready;
    }, () => null);
  }

  // The style switch: the tiles' stylesheet and the class. The tiles are data URLs, too long
  // for an attribute, so they go in one <style> in the lens's layer (nothing is written on
  // <html>); its selectors outrank chalk.css's, which sets everything else about them.
  function switchOn(st) {
    const rules = [
      `html.lens-chalk.lens-chalk-on{background-image:url("${board.url}")!important}`,
      `html.lens-chalk.lens-chalk-on :is(${MASKED}, .lens-chalk-rub){-webkit-mask-image:url("${st.grain.url}");mask-image:url("${st.grain.url}")}`
    ];
    if (st.kind === 'paper') rules.push(`html.lens-chalk.lens-chalk-on{--lens-chalk-link:${paperLink()}}`);
    if (!st.tiles) {
      st.tiles = document.createElement('style');
      st.tiles.className = 'lens-chalk-tiles';
    }
    st.tiles.textContent = rules.join('\n');
    st.defs.append(st.tiles);
    html.classList.add(CLS.on);
    st.on = true;
    startMedia(st);
  }

  function switchOff(st) {
    if (st.srcWatch) { st.srcWatch.disconnect(); st.srcWatch = null; }
    dropRubs(st);
    if (st.media) { st.media.dispose(); st.media = null; }
    html.classList.remove(CLS.on);
    if (st.tiles) { st.tiles.remove(); st.tiles = null; }
    st.on = false;
  }

  async function enter(ctx) {
    const st = build(ctx);
    if (!await prepare(st)) return;
    if (ctx.motion.matches || document.hidden || ctx.arriving) { switchOn(st); return; }
    // 1. A sheet of slate comes over the page; the style switches under it. The drawings of
    //    the images start now, so they are ready when the writing reaches them.
    startMedia(st);
    const sheet = makeSheet(st, 'lens-chalk-sheet');
    st.sheet = sheet;
    sheet.canvas.style.opacity = '0';
    if (!await runSliced(slateSteps(sheet), ctx.signal) || state !== st) return;
    await fadeSheet(sheet, 1, SLATE_MS, ctx.signal);
    if (ctx.signal.aborted || state !== st) return;
    switchOn(st);
    // 2. The writing.
    await write(st, sheet);
    if (ctx.signal.aborted || state !== st) return;
    // 3. The sheet fades, and what was not written (rules, bullets, borders) appears; the
    //    last specks of dust fade with it.
    const dust = st.dust;
    if (dust) fadeSheet(dust, 0, SETTLE_MS, ctx.signal);
    await fadeSheet(sheet, 0, SETTLE_MS, ctx.signal);
    if (ctx.signal.aborted || state !== st) return;
    sheet.canvas.remove();
    if (dust) dust.canvas.remove();
    st.sheet = null; st.dust = null;
  }

  // A page opened while the lens is on: the slate is already painted (the pre-paint ground),
  // the board comes from sessionStorage, and the style switches at once.
  async function arrive(ctx) {
    const st = build(ctx);
    if (!await prepare(st, false)) return;
    switchOn(st);
    await Promise.race([st.mediaReady, sleep(ARRIVE_MEDIA_MS, ctx.signal)]);
  }

  async function exit(ctx) {
    const st = state;
    if (!st) return;
    // From here on nothing reaches this activation through `state` (an enter still running
    // returns at its next check), so an exit the core abandons leaves nothing behind either.
    state = null;
    if (st.anim) st.anim.stop();
    // An instant reset (or reduced motion, or a hidden page) wants the lens gone at once; it
    // is read again while the eraser runs and while its sheet fades.
    const quick = () => ctx.instant || ctx.motion.matches || document.hidden;
    try {
      if (st.on && !quick()) {
        // The eraser wipes a fresh sheet over whatever is shown (a half-written board too).
        const sheet = makeSheet(st, 'lens-chalk-sheet');
        const complete = await erase(st, sheet);
        if (st.sheet) { st.sheet.canvas.remove(); st.sheet = null; }
        if (st.dust) { st.dust.canvas.remove(); st.dust = null; }
        switchOff(st);
        if (complete) await fadeSheet(sheet, 0, ERASE_FADE_MS, null, quick);
        sheet.canvas.remove();
      }
    } finally {
      if (st.on) switchOff(st);
      html.classList.remove(CLS.base, CLS.on, CLS.shell, CLS.paper, CLS.home);
      if (st.sheets) { st.sheets.remove(); st.sheets = null; }
      if (st.defs) { st.defs.remove(); st.defs = null; }
      st.sheet = null; st.dust = null;
    }
  }

  window.SiteLenses.register({
    id: 'chalk',
    order: 7,
    numeral: 'VII',
    label: 'Chalkboard',
    line: 'Every result was once erasable.',
    ground: GROUND,               // the slate, painted before a page arrives
    css: true,
    enter,
    arrive,
    exit,
    // Test-only hooks (tests/browser_lens_chalk.js).
    _test: {
      drawPhoto, drawGraphic, makeBoard, makeGrain, paperLink, onBoard, PHOTO, pace,
      textLines: view => (state ? textLines(state, view || viewRect()) : []),
      get state() { return state; },
      get board() { return board; }
    }
  });
})();
