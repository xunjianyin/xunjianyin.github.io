/**
 * Lens I · Stardust: "Every letter is made of smaller things."
 *
 * Every glyph in the lens scope is redrawn as fine luminous particles on a night
 * ground. Each word is rendered offscreen in its exact computed font and sampled on
 * a grid of about 0.09 em; a particle sits at the ink centroid of every covered cell,
 * so letters keep their shape and stay readable.
 *
 * Every image becomes particles too: each same-origin <img> in the scope that is
 * loaded, rendered (not inside a closed <details>) and at least 24 x 24 CSS px. Its
 * pixels come from the media helper's utilities (drawAsync decodes and resizes a photo
 * off the main thread, as it is displayed, object-fit included; sample and classify tell
 * a photo from a graphic).
 *   - A photo becomes a point cloud of its own luminance: soft stars in the desaturated
 *     original colour, lifted for the night, whose grains grow with the grid's step. The
 *     step is set by the stars the photo will hold, max(1.6 px, sqrt(area x lit share /
 *     14000)), where the lit share is the expected share of cells with a star, so a night
 *     photo of thin lit windows gets a finer grid than a bright sky of the same size; one
 *     image stays under about 14 k particles (should more cells light up, all thin out
 *     alike). A cell's light leans toward its outlier: its brightest pixel where that
 *     stands out of a darker neighbourhood (lit windows, a horizon), its darkest where that
 *     cuts into a lighter one (bare branches, a gull against the sky), so thin structure
 *     of either kind survives the gathering; a dark neighbourhood is lifted a little (at
 *     most twice: rocks under a bright sky keep their shapes) and a little local contrast
 *     keeps small subjects apart from broad gradients. Bright areas hold a star in nearly
 *     every cell, dim ones thin out into a sparse sky, dark cells stay empty. A round
 *     image keeps a round edge; the homepage portrait keeps its soft oval.
 *   - A graphic (a figure, a diagram, a chart, an SVG panel) becomes particles where it
 *     has ink: subsamples that differ from the ground colours around them (the light
 *     panels and pills it is drawn on, as found in each small block of it; for a
 *     transparent image, its alpha), sampled like glyphs on cells with an ink centroid,
 *     coloured as text is (dark ink turns pale, colour into a pale tint of its hue, a pale
 *     outline into a dim line), so a chart reads as its own lines in light; ink lighter
 *     than its own ground (white letters on a blue tile) stays bright. A graphic carries
 *     text, so it gets a finer step than a photo (1.25 px at the finest, as page text of
 *     12-16 px is sampled) and a larger budget (about 56 k), spent on its lines and
 *     letters: the inside of a solid fill holds a particle in three cells of ten, dimmer,
 *     so outlines lead and the letters on a fill stay readable. Only the commonest ground
 *     (and grounds as near it) is empty: every other ground (a tinted panel that groups a
 *     column of boxes, a grey pill that marks a kind of box) is a sparse dim fill at its own
 *     hue, as dense as it stands apart from the commonest, with a fainter line of dust where
 *     it meets another ground. So grey reads apart from white and the panels keep their
 *     shapes and hues (at most about 11 k grains a graphic, beside its ink).
 *   - An image's own border (a project thumbnail's hairline) becomes a faint line of
 *     dust, so the picture keeps its edge on the night.
 * Decoding and sampling run as jobs (two at once, nearest first; three before an
 * arrival's first frame) beside the text builder, so words never wait for pixels. An image
 * whose particles come late crossfades from the page's own image while the lens enters (it
 * was on the day page); arriving, and for a photo that loads while the lens is settled,
 * it waits hidden under the night and its stars fade in, so no colour photo is shown in
 * the lens. Cross-origin images (badges), canvases and video keep the CSS treatment:
 * filtered back and dimmed. The photography lightbox's photo, outside the scope in a fixed
 * container, is drawn as stars as well, on a still canvas the media helper lays over it
 * (ctx.media with fixed: true): the photo itself stays under the lightbox's dark backdrop,
 * its stars fade in when they are ready (a canvas whose photo has gone is hidden at once),
 * and they fade out over the photo as the lens leaves. While the lightbox covers the
 * viewport the night beneath it is not drawn.
 * Text that CSS generates (::before and ::after content) has no text node to sample: it
 * keeps its own glyphs (stardust.css), so no word is lost. A list's text markers (its
 * numbers and letters, ::marker), hidden with the glyphs, are drawn as words of their own
 * where the browser puts them.
 *
 * The page DOM is never edited. The core hides the glyphs (links, buttons and demo
 * controls stay usable under the particles); this lens adds classes on <html> for the
 * night ground, writes one rule per image that became (or waits to become) particles
 * into its own stylesheet (opacity 0, so the image still takes the pointer; a mask while
 * it dissolves or condenses), and draws on two canvases in the core's fixed layer:
 *   - ink (Canvas2D), used in transitions only: crisp word sprites in device pixels,
 *     identical to the page's glyphs, dissolve into dust on enter and condense back
 *     on exit (and, on a light page, the images' night patches under their dust). It
 *     also draws the faint shockwave rings.
 *   - dust (WebGL2, else WebGL1; a Canvas2D pixel plotter without WebGL): points in
 *     groups, one draw call each. Home positions, colours and seeds are static buffers;
 *     the vertex shader computes the shimmer, the enter puff, the exit condensation,
 *     shockwaves, the scroll lag and link highlights from uniforms. Only the pointer
 *     wind is simulated on the CPU, for the particles it has disturbed, and only that
 *     range of the offsets is uploaded.
 *
 * Enter: the ground turns to night while a sweep runs down the viewport line by line;
 * each line's ink sprites puff into dust, and each image dissolves in the same sweep
 * (a gradient mask on the page's own image, so no photo is decoded for it) while its
 * particles puff out; a figure on a white ground meanwhile turns to night with the page
 * (inverted), so its lines dissolve into the same lines in dust. Exit: the sweep runs
 * again, faster; the dust condenses into ink and the images return under the same mask.
 * Arrival and reduced motion: the settled night at once. An exit cut short (an instant
 * reset, a departing page) ends at once. On a light page every image keeps a counter-
 * filter to the column's inversion that eases on the column's own curve, in and out, so
 * the two hue rotations cancel at every moment and a photo never passes through another
 * hue; since an interpolated inversion flattens every colour toward grey half way, the
 * images still shown in a transition are only as opaque as the inversion leaves them
 * distinct, so no grey slab stands on the grey page. And so that a photo goes out once:
 * its rows the sweep has not reached when the inversion leaves it half its contrast
 * dissolve then, all at once (it crossfades into its stars), and leaving, its stars stay
 * until its contrast is back. Meanwhile a night patch in its box under its stars keeps the
 * light page from showing through its dark parts (no tonal negative).
 *
 * Long pages are windowed. Text in normal flow is cut into bands of the document,
 * built for the viewport and 1.5 screens either side in slices of a few milliseconds
 * and evicted far away. Text inside a container that clips and scrolls (a wide table
 * on a phone, a citation block) or that is fixed or sticky forms its own group, which
 * follows the container and is clipped to it. An image is a group of its own that
 * belongs to the band or container that holds it: it is placed, clipped, windowed and
 * capped with it. Late content (rendered markdown, the blog list, demos, toggled
 * abstracts) and layout that moves without a DOM change (photos loading into the
 * photography masonry, fonts, a <details> toggle; ctx.onLayoutChange) are re-measured,
 * watched from the moment the lens starts measuring, so nothing that changes during the
 * enter or the arrival is missed; only groups whose words or images moved are sampled
 * again, and a moved image is only translated. A group whose words or image moved stops
 * being drawn at once (a few words per group are measured again on each new model, and
 * when an image in the scope loads), until its replacement is built: text is never drawn
 * where it no longer is. Arriving, the images near the viewport that are still loading
 * are waited for a moment (the page is still hidden over the night), so the first
 * measure already sees the masonry the reader will see, and the images on screen are
 * waited for until IMAGE_ARRIVE_MS, so the gallery is usually stars in the first frame. The content of a closed
 * <details> is laid out by the browser but not painted: it is not drawn either, until it
 * opens.
 *
 * On a light page the main column is inverted (hue kept): light panels sink into the
 * night, borders become faint, colour tints that carry data stay distinguishable, and
 * inline SVG figures turn into light ink.
 */
(() => {
  'use strict';

  /* ---------------------------------------------------------------------------
   * Constants. Lengths are CSS px, times are seconds unless marked ms.
   * ------------------------------------------------------------------------- */
  const NIGHT_RGB = [6, 8, 12];          // the ground, #06080c (stardust.css and the pre-paint rule use it)
  const PORTRAIT_SELECTOR = '.profile-photo';    // the homepage portrait keeps its soft oval
  const CLASS_NIGHT = 'lens-stardust';           // the night (ground, inversion, marks)
  const CLASS_BODY = 'lens-stardust-body';       // the body paints its own ground: turn it to night too
  const CLASS_INVERT = 'lens-stardust-invert';   // a light page: the main column is inverted
  const CLASS_GROUND = 'lens-stardust-ground';   // transitions for the ground; kept through the exit
  const CLASS_LEAVING = 'lens-stardust-leaving'; // the shorter exit duration
  const CLASS_STILL = 'lens-stardust-still';     // no transitions at all (reduced motion, arrival, instant exit)
  const SHEET_HREF = 'easter/lenses/stardust.css';   // the lens's own stylesheet takes the image rules
  const CLASS_CAPTION = 'lens-stardust-caption'; // the core's caption in a light tone, once the ground is dark
  // Never drawn as particles: SVG text (painted with fill), form controls and editable text.
  const EXCLUDE = 'script, style, noscript, template, svg, textarea, select, option, input, [contenteditable]:not([contenteditable="false"])';
  // Marks whose colours stardust.css changes (flushed without transitions on an instant exit).
  const MARKS = '.homepage-section h2, .project-link, #theme-toggle, .footer-social a, .back-to-top, .nav-button';
  // Images outside the scope: the media helper redraws those in a position: fixed container
  // (the photography lightbox) as stars, on a canvas over them.
  const OUTSIDE_IMAGES = 'img:not(:is(#site-nav, #main-content, #site-footer, body > header.site-header, body > footer.paper-footer) img)';

  // Sampling the glyphs
  const STEP_EM = 0.09;                  // grid step as a fraction of the font size ...
  const STEP_MIN = 1.1;                  // ... never finer than this ...
  const STEP_MAX = 2;                    // ... nor coarser (large type stays dense and readable)
  const SUPER = 2;                       // subsamples per cell side (coverage and centroid)
  const COVER_MIN = 0.16;                // cells with less ink coverage make no particle
  const COVER_FULL = 0.62;               // coverage at which a particle is at full size and alpha
  const JITTER = [0.1, 0.3];             // of a step, at the rim and inside a stroke: breaks up the lattice
  const GRAIN = 0.3;                     // static brightness variation between particles (darker only)
  const SIZE_MIN = 0.9;                  // particle diameter at DPR 1, for faint and full cells
  const SIZE_MAX = 1.5;
  const ALPHA_MIN = 0.42;                // alpha of the faintest particle
  const ATLAS_W = 2048;                  // sampling and sprite atlases
  const ATLAS_H = 2048;
  const SAMPLE_PAGE_H = 40;              // one sampling pass renders this tall a strip of words (a taller word: its own) ...
  const PASS_CELLS = [1500, 12000];      // ... and harvests between these many cells (a larger word: its own pass),
  const PASS_MS = 2.5;                   // as many as take about this long (it adapts: cold code and a busy machine are slower)
  const LINE_SLACK = 3;                  // baselines within this many px form one line
  const THIN_ERODE = 0.28;               // css px shaved off ink sprites of antialiased (thinner) page text

  // Windowing
  const BAND_H = 512;                    // document bands for text in normal flow
  const BUILD_SCREENS = 1.5;             // build the viewport and this many screens either side ...
  const KEEP_SCREENS = 3.5;              // ... and evict groups farther than this
  const PARTICLE_CAP = 160000;           // live particles at most; the nearest groups win
  const SLICE_MS = 4;                    // building yields to the page after this much work (a step past it stays under 8 ms)
  const GROUP_FADE = 0.25;               // a group built while live fades in (it may be on screen)
  const ARRIVE_REST_MS = 600;            // arriving: after the first frame, the page's first paint goes first
  const ARRIVE_IMAGES_MS = 150;          // arriving: images near the viewport still loading are waited for until then
  const CONTENT_MS = 200;                // class and style changes in the scope settle this long

  // Images as particles
  const IMAGE_MIN = 24;                  // px: a smaller image (content box) keeps the CSS dimming
  const IMAGE_BUDGET = 14000;            // particles per image, about: the step grows with the area (a photo's lit area) ...
  const IMAGE_STEP = 1.6;                // ... from this finest step (px between samples)
  const IMAGE_JOBS = 2;                  // images decoded and sampled at once (decoding is off the main thread) ...
  const IMAGE_JOBS_ARRIVING = 3;         // ... and before an arrival's first frame
  const IMAGE_CACHE = 32;                // sampled images kept per activation (by source, size and fit)
  const IMAGE_WAIT_MS = 320;             // entering waits this long for the images on screen (later ones crossfade in) ...
  const IMAGE_ARRIVE_MS = 230;           // ... arriving, until this long after arrive() began (later ones wait
                                         // under the night and fade in; the arrival settles within 350 ms)
  const IMAGE_FADE = 0.25;               // s: the page's image fades out as late particles fade in
  const WAIT_FADE = 0.4;                 // s: stars of an image hidden while they were made fade in this long
  const LIGHTBOX_BUDGET = 30000;         // stars of the lightbox's photo (one still canvas: no particle cost)
  const COVER_OPAQUE = 0.9;              // a fixed container this opaque over the whole viewport hides the night
  const MASK_STOP = 16;                  // px between the stops of a dissolving image's mask
  const INVERT = 0.94;                   // the light page's column inversion (stardust.css)
  const SLAB_CONTRAST = [0.08, 0.75];    // an image in a transition shows from none to full over this contrast left by the inversions
  const SLAB_IN = 0.28;                  // s: a light page's image rows the enter's sweep has not reached by then dissolve then
                                         // (the inversions leave an image half its contrast then, none from 0.36 s to 0.44 s:
                                         // it crossfades straight into its stars) ...
  const SLAB_OUT = 0.17;                 // s: ... and leaving, an image's stars stay at least until then (they condense from
                                         // 0.43 s, as its contrast comes back: half at 0.45 s, all at 0.5 s)
  const PHOTO_SUPER = 2;                 // a photo is drawn at up to this many pixels per side of the finest cell ...
  const PHOTO_FINE_PX = 2.5e5;           // ... and this many pixels at most
  const PHOTO_CELLS_MAX = 1.2e5;         // cells of one photo at most (a dark photo gets a finer grid)
  const PHOTO_PEAK = 0.6;                // a cell's light leans this far from its mean toward its outlier: its brightest
                                         // or its darkest pixel, whichever stands further from the cells around it ...
  const PHOTO_OUTLIER_R = 2;             // ... (a box of this many cells either side) ...
  const PHOTO_OUTLIER_SOFT = 0.08;       // ... fully once the one stands this much further out than the other
  const PHOTO_MIN_LUMA = 0.07;           // darker cells stay empty: the night shows through
  const PHOTO_DESATURATE = 0.6;          // share of grey in the cloud's colour
  const PHOTO_LIFT = 1.18;               // brightening of the cloud on the night ground
  const PHOTO_GROW = 0.5;                // grains grow as (step / IMAGE_STEP)^PHOTO_GROW ...
  const PHOTO_SIZE = [1.0, 2.3];         // ... from these diameters (px) at the darkest and brightest
  const PHOTO_GAMMA = 0.9;               // tone curve of the glow (above 1: brighter highlights stand out)
  const PHOTO_LOCAL = 0.8;               // local contrast: a cell is pushed this far from its neighbourhood's mean ...
  const PHOTO_LOCAL_R = 0.06;            // ... over a box this share of the image's shorter side (2 cells at least)
  const PHOTO_KEY = 0.42;                // exposure: a dark neighbourhood is lifted toward this light ...
  const PHOTO_EXPOSE = 0.5;              // ... as (key / its mean)^this ...
  const PHOTO_EXPOSE_MAX = 2;            // ... at most this many times (a light one is never dimmed) ...
  const PHOTO_EXPOSE_R = 0.2;            // ... the neighbourhood: a box this share of the shorter side
  const PHOTO_DENSE = 0.4;               // from this glow every cell holds a star; a dimmer one with probability glow / PHOTO_DENSE ...
  const PHOTO_SPARSE_LIFT = 0.5;         // ... and that star is brighter by this share of the light the empty cells gave up
  const PHOTO_JITTER = 0.85;             // of a cell: grains wander this far (total), so no lattice shows
  const PHOTO_MAGNITUDE = 0.35;          // stars differ in brightness and size by up to this share
  const PHOTO_FONT = 9;                  // the "font size" that scales a photo's puff (at the finest step)
  const STAR_WIDTH = 0.85;               // a photo grain is a soft star: gaussian width per radius ...
  const STAR_MIN = 0.75;                 // ... and at least this (device px)
  // A graphic carries text (its labels) and thin lines: it gets a finer step and a larger
  // budget than a photo, spent on its lines and letters; the inside of a solid fill is drawn
  // sparsely (FILL_KEEP), so a fill costs a fraction of its area.
  const GRAPHIC_BUDGET = 56000;          // particles of one graphic, about (a fill's cells counted at FILL_KEEP)
  const GRAPHIC_STEP = 1.25;             // its finest step: labels of 12-16 px are sampled about as page text is
  const GRAPHIC_SUPER = 2;               // subsamples per cell side at the finest step
  const GRAPHIC_MAX_PX = 1.1e6;          // subsamples of one graphic at most (the cells get fewer above it)
  const GRAPHIC_FONT = 12;               // the "font size" that scales a graphic's puff
  const BG_SHARE = 0.025;                // a colour on this share of a graphic, as light as its commonest, is ground
  const BG_COLOURS = 6;                  // ... (at most this many ground colours: the panels and pills a figure is drawn on)
  const BG_LUMA = 0.22;                  // ... (luma within this of the commonest colour's)
  const INK_NEAR = 0.06;                 // colour distance (0..1) from the ground under which there is no ink ...
  const INK_FAR = 0.3;                   // ... and above which the ink is full
  const INK_SPREAD = 1.5;                // particles per unit of ink share and cell, about (rims of thin lines count)
  const FILL_COVER = 0.85;               // a cell this covered, with its four neighbours of about its colour, lies inside a fill ...
  const FILL_SIMILAR = 0.09;             // ... (colour distance 0..1 to each neighbour at most) ...
  const FILL_KEEP = 0.3;                 // ... holds a particle with this chance ...
  const FILL_ALPHA = 0.55;               // ... drawn this bright: outlines and the letters on a fill lead
  // A ground other than the commonest (a tinted panel, a grey pill) that differs from it by
  // INK_NEAR or more is not empty: a sparse dim fill at its own tint, so grey reads apart
  // from white and the panels a figure groups its boxes in keep their shapes and hues.
  const TINT_STEP = 2.6;                 // px: one chance of a grain per square this wide ...
  const TINT_FROM = 0.05;                // ... taken with probability (d - this) x TINT_GAIN, d its colour distance (0..1)
  const TINT_GAIN = 7;                   // from the main ground (a pale panel about 0.2, a grey pill about 0.65) ...
  const TINT_KEEP = [0.16, 0.75];        // ... within these;
  const TINT_EDGE = 0.7;                 // where it meets another ground, with this (a faint line along its edge)
  const TINT_SHARE = 0.75;               // a square is that ground's when this share of it is
  const TINT_ALPHA = [0.45, 0.8];        // drawn this bright, from a pale panel's distance (0.07) to a grey's (0.16),
  const TINT_LIGHT = 0.62;               // in its hue at this lightness (a grey: a cool grey as light),
  const TINT_BUDGET = 11000;             // and at most about this many grains per graphic (beside its ink)
  const FRAME_GAP = 2.4;                 // px between the grains of an image's own border ...
  const FRAME_ALPHA = 0.6;               // ... drawn this faint

  // Choreography (the ground's durations must match stardust.css)
  const GROUND_IN = 0.8;
  const GROUND_OUT = 0.7;
  const GROUND_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';   // the ground's and the column's curve
  const ENTER_START = 0.12;              // the first line starts once the ground is moving
  const ENTER_SWEEP = 0.85;              // top to bottom of the viewport, line by line
  const ENTER_DUR = 1.0;                 // a line puffs into dust and settles in this long
  const LATE_JOIN = ENTER_START + ENTER_SWEEP + 0.3;   // an image ready later than this crossfades in
  const EXIT_SWEEP = 0.25;
  const EXIT_DUR = 0.45;                 // a line stirs, condenses and becomes ink
  const SETTLE_SLACK = 0.45;             // extra wait for the CSS ground before giving up

  // Ambient and interaction
  const SHIMMER = 0.08;                  // per-particle alpha jitter, +-8 %
  const SHIMMER_FPS = 15;                // the slow shimmer alone redraws at this rate
  const WIND_RADIUS = 90;
  const WIND_ACCEL = 2000;               // px/s^2 at the pointer for a gust of 1
  const WIND_SPEED_REF = 1000;           // pointer px/s for a gust of 1 ...
  const WIND_GUST_MAX = 1.6;             // ... capped here
  const WIND_ALONG = 0.4;                // share of push along the pointer's motion
  const WIND_SWIRL = 0.85;               // random sideways share: dust, not a rigid bulge
  const SPRING = 34;                     // 1/s^2: pull home (scaled 0.6-1.4 per particle)
  const DAMPING = 5.4;                   // 1/s
  const DRIFT_MAX = 70;                  // px: soft bound of a particle's displacement
  const SLEEP_OFFSET = 0.04;             // px and px/s below which a particle rests at home
  const SLEEP_SPEED = 0.6;
  const POINTER_TAU = 0.07;              // the pointer's speed fades this fast when it stops
  const RING_MAX = 3;
  const RING_SPEED = 480;                // px/s
  const RING_WIDTH = 26;                 // px: width of the travelling front
  const RING_PUSH = 7;                   // px of outward displacement at the front
  const RING_DECAY = 0.7;                // s: e-folding of the ring's strength
  const RING_LIFE = 1.8;
  const RING_ALPHA = 0.1;                // the faint drawn circle
  const LAG_TAU = 0.075;                 // scroll lag settles in about 4 tau (0.3 s)
  const LAG_MAX = 28;                    // px: soft bound of the lag
  const HOVER_TAU = 0.08;

  // Rendering budget (as the first egg)
  const DPR_MAX = 2;
  const MAX_BACKING_PIXELS = 8.3e6;
  const CELL = 24;                       // the wind's spatial grid

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // The shader's per-line timing, mirrored in JS for the ink sprites.
  const inkEnter = e => 1 - smooth(0, 0.22, e);
  const inkExit = x => smooth(0.45, 0.95, x);

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function parseColour(text) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?/.exec(text || '');
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1)];
    const h = /^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(text || '');
    if (!h) return null;
    const hex = h[1].length === 3 ? h[1].replace(/./g, c => c + c) : h[1];
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(1);
  }
  const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }
  /*
   * Night colours. Greys become pale cool greys that keep their emphasis (dark body
   * text bright, muted text dimmer, headings and bold brightest); saturated colours
   * (links) become a pale tint of their own hue. On a light page, near-white text sits on
   * a dark fill that the inversion turns light, so it turns dark as well; a graphic's pale
   * ink (a light grey outline on white) has no such fill: it becomes a dim line (graphic).
   */
  function nightColour([r, g, b], emphasis, darkPage, graphic = false) {
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    if ((max - min) / 255 < 0.16) {
      const l = luma([r, g, b]);
      if (!darkPage && l > 0.82 && !graphic) return [30, 33, 38];
      const strength = darkPage ? l : 1 - l;
      const level = emphasis ? 1.07 : 0.55 + 0.45 * strength;
      return [226, 233, 242].map(v => Math.min(255, v * level));
    }
    let hue;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    return hsl((hue * 60 + 360) % 360, 0.82, emphasis ? 0.86 : 0.8);
  }
  // A graphic's tinted ground on the night: its own hue, half saturated at most, at
  // TINT_LIGHT (a grey stays a cool grey).
  function tintColour([r, g, b]) {
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); const chroma = (max - min) / 255;
    if (chroma < 0.03) return [218, 225, 234].map(v => v * TINT_LIGHT / 0.88);
    let hue;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    return hsl((hue * 60 + 360) % 360, clamp(chroma * 5, 0.25, 0.55), TINT_LIGHT);
  }
  // Draw a word with its letter-spacing; fall back to measured per-glyph advances.
  function fillSpaced(g, text, x, y, spacing, native, stroke = false) {
    const draw = stroke ? (t, px) => g.strokeText(t, px, y) : (t, px) => g.fillText(t, px, y);
    if (native || !spacing) { draw(text, x); return; }
    for (const ch of text) { draw(ch, x); x += g.measureText(ch).width + spacing; }
  }
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Yield to the page between slices of work (a message is not clamped like a timeout).
  let channel = null; const waiting = [];
  function nextTask() {
    if (!channel) { channel = new MessageChannel(); channel.port1.onmessage = () => { const go = waiting.shift(); if (go) go(); }; }
    return new Promise(resolve => { waiting.push(resolve); channel.port2.postMessage(0); });
  }
  // Slice bookkeeping for the tests: the longest, and how many went over the 8 ms budget.
  const SLICE_BUDGET_MS = 8;
  const IMAGE_SLICES = new Set(['cells', 'cellsEnd', 'emit', 'tint', 'photo', 'read']);
  function noteSlice(state, ms, tag) {
    const p = state.perf;
    p.slices = (p.slices || 0) + 1;
    if (ms > SLICE_BUDGET_MS) p.slicesOver = (p.slicesOver || 0) + 1;
    if (ms > (p.sliceMax || 0)) p.sliceMax = ms;
    if (IMAGE_SLICES.has(tag) && ms > (p.imageSliceMax || 0)) p.imageSliceMax = ms;
    const tags = p.sliceTags || (p.sliceTags = {});
    if (ms > (tags[tag] || 0)) tags[tag] = +ms.toFixed(1);
  }
  function hashString(text, h = 2166136261) {
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const isSvg = src => /^data:image\/svg\+xml|\.svgz?(?:[?#]|$)/i.test(src);
  // A selector for one element by position, from its nearest ancestor with an id (or the
  // body): #photo-grid>div:nth-child(3)>img:nth-child(1). Rebuilt with every model.
  function pathTo(el) {
    const parts = [];
    for (let node = el; node; node = node.parentElement) {
      if (node !== el && node.id && document.getElementById(node.id) === node) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
      if (node === document.body) { parts.unshift('body'); break; }
      const parent = node.parentElement;
      if (!parent) return null;
      parts.unshift(`${node.localName}:nth-child(${Array.prototype.indexOf.call(parent.children, node) + 1})`);
    }
    return parts.join('>');
  }

  /* ---------------------------------------------------------------------------
   * The page model: every visible text node of the scope, where it is and how it
   * looks, rebuilt (in slices) whenever the content or the layout changes.
   * ------------------------------------------------------------------------- */
  // Is the page light (dark text)? Read from the main text, which no pre-paint rule touches.
  function pageIsLight(scope) {
    const main = document.getElementById('main-content') || scope[0] || document.body;
    const colour = parseColour(getComputedStyle(main).color);
    return !colour || luma(colour) < 0.5;
  }

  // Where the scope's images are and whether they have loaded, with the document's size: a
  // model remembers it, and arrival compares it once its listeners are on (a photo that
  // loaded in between moved the layout unseen).
  function layoutPrint(scope) {
    const html = document.documentElement;
    let h = hashString(`${html.scrollWidth}x${html.scrollHeight}`);
    for (const root of scope) {
      for (const img of root.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        h = hashString(`${img.complete ? 1 : 0}|${Math.round(r.left)},${Math.round(r.top + window.scrollY)}|${Math.round(r.width)}x${Math.round(r.height)}`, h);
      }
    }
    return h;
  }

  // Resolves once the scope's images near the viewport that are still loading have loaded
  // (or failed), or at the deadline (performance.now() time), whichever comes first.
  function imagesLoading(scope, deadline) {
    const H = window.innerHeight;
    const pending = [];
    for (const root of scope) {
      for (const img of root.querySelectorAll('img')) {
        if (img.complete || !(img.currentSrc || img.getAttribute('src'))) continue;
        const r = img.getBoundingClientRect();
        if (r.bottom >= -0.5 * H && r.top <= 1.5 * H) pending.push(img);
      }
    }
    const left = deadline - performance.now();
    if (!pending.length || left <= 0) return Promise.resolve();
    return Promise.race([
      Promise.all(pending.map(img => new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        if (img.complete) resolve();
      }))),
      new Promise(resolve => setTimeout(resolve, left))
    ]);
  }

  /*
   * List markers. A marker that is text (a decimal, alphabetic or roman counter, or a string)
   * is hidden with the glyphs (a ::marker inherits the transparent fill, and Chrome takes no
   * other fill colour on it) but has no text node to sample: the lens draws it as a word of
   * its own. Its text is the item's ordinal in the list's counter style with the style's
   * suffix (". "); an outside marker ends where the item's first line begins (Chrome lays
   * it out so: its margin is minus its own width), an inside one begins there, on the
   * baseline of the item's first line. A shape (disc, circle, square, a <summary>'s
   * triangle) is painted as a shape, which the hidden glyphs leave alone: it stays itself.
   */
  const alphabetic = letters => n => {
    if (n < 1) return String(n);
    let text = '';
    for (let k = n; k > 0; k = Math.floor((k - 1) / letters.length)) text = letters[(k - 1) % letters.length] + text;
    return text;
  };
  const ROMAN = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  const roman = n => {
    if (n < 1 || n > 3999) return String(n);
    let text = '';
    for (const [value, digits] of ROMAN) for (; n >= value; n -= value) text += digits;
    return text;
  };
  const LATIN = 'abcdefghijklmnopqrstuvwxyz';
  const COUNTER_STYLES = {
    decimal: String,
    'decimal-leading-zero': n => (Math.abs(n) < 10 ? `${n < 0 ? '-' : ''}0${Math.abs(n)}` : String(n)),
    'lower-alpha': alphabetic(LATIN), 'lower-latin': alphabetic(LATIN),
    'upper-alpha': n => alphabetic(LATIN)(n).toUpperCase(), 'upper-latin': n => alphabetic(LATIN)(n).toUpperCase(),
    'lower-roman': roman, 'upper-roman': n => roman(n).toUpperCase(),
    'lower-greek': alphabetic('αβγδεζηθικλμνξοπρστυφχψω')
  };
  // A computed CSS string ("→ ") as its text, or null for anything else.
  const cssString = value => (/^"(?:[^"\\]|\\.)*"$/.test(value || '') ? value.slice(1, -1).replace(/\\(.)/g, '$1') : null);
  // The ordinals of a list's items (HTML: start, reversed, value), memoised per list.
  function ordinals(list, memo) {
    let map = memo.get(list);
    if (map) return map;
    map = new Map(); memo.set(list, map);
    const items = [...list.children].filter(el => el.localName === 'li' && getComputedStyle(el).display === 'list-item');
    const ol = list.localName === 'ol'; const reversed = ol && list.reversed;
    let value = ol && list.hasAttribute('start') ? list.start : reversed ? items.length : 1;
    for (const item of items) {
      const own = item.hasAttribute('value') ? parseInt(item.getAttribute('value'), 10) : NaN;
      if (Number.isFinite(own)) value = own;
      map.set(item, value);
      value += reversed ? -1 : 1;
    }
    return map;
  }
  // The text a list item's marker draws, or null (no marker, an image, or a shape).
  function markerText(li, memo) {
    const cs = getComputedStyle(li);
    if (cs.display !== 'list-item' || (cs.listStyleImage && cs.listStyleImage !== 'none')) return null;
    const content = getComputedStyle(li, '::marker').content;
    if (content && content !== 'normal') return cssString(content);
    const own = cssString(cs.listStyleType);
    if (own !== null) return own;
    const format = COUNTER_STYLES[cs.listStyleType];
    if (!format || !li.parentElement) return null;
    const n = ordinals(li.parentElement, memo).get(li);
    return n === undefined ? null : `${format(n)}. `;
  }

  // The content box's corner radii (px), as [[h, v] x 4] from the top left, or null.
  function radiiOf(cs, width, height) {
    const length = (value, of) => (String(value).endsWith('%') ? (parseFloat(value) / 100) * of : parseFloat(value) || 0);
    const insets = [['Left', 'Top'], ['Right', 'Top'], ['Right', 'Bottom'], ['Left', 'Bottom']];
    let any = false;
    const radii = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((name, i) => {
      const [hv, vv = hv] = String(cs[name] || '0px').trim().split(/\s+/);
      const inset = side => (parseFloat(cs[`border${side}Width`]) || 0) + (parseFloat(cs[`padding${side}`]) || 0);
      const r = [Math.max(0, length(hv, width) - inset(insets[i][0])), Math.max(0, length(vv, height) - inset(insets[i][1]))];
      if (r[0] > 0.5 && r[1] > 0.5) any = true;
      return r;
    });
    return any ? radii : null;
  }

  async function buildModel(state) {
    const scope = state.ctx.scope;
    const model = {
      gen: ++state.gen, entries: [], boxes: new Map(), words: new Map(),
      styles: new Map(), opacities: new Map(), anchors: new Map(), excluded: new Map(), sizes: new Map(),
      images: [], imageKeys: new Set(), print: layoutPrint(scope),
      darkPage: !state.light, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight
    };
    const html = document.documentElement;
    const sx = window.scrollX; const sy = window.scrollY;
    const measure = state.measure || (state.measure = makeCanvas(1, 1).getContext('2d'));
    // (The body's own opacity is left out: it is 0 while a lens arrives with the page.)
    const opacityOf = el => {
      if (!el || el === html || el === document.body) return 1;
      if (model.opacities.has(el)) return model.opacities.get(el);
      const value = (parseFloat(getComputedStyle(el).opacity) || 0) * opacityOf(el.parentElement);
      model.opacities.set(el, value);
      return value;
    };
    // How the text of el (or its marker: cs is then the ::marker's style) is drawn, or null.
    const styleFrom = (el, cs) => {
      const rgba = parseColour(cs.color);
      const alpha = rgba ? rgba[3] * opacityOf(el) : 0;
      let info = null;
      if (cs.visibility === 'visible' && alpha > 0.02) {
        const size = parseFloat(cs.fontSize) || 16;
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const emphasis = weight >= 600 || !!el.closest('h1, h2, h3, h4, h5, h6');
        const caps = cs.fontVariantCaps === 'small-caps' ? 'small-caps ' : '';
        const font = `${cs.fontStyle} ${caps}${cs.fontWeight} ${size}px ${cs.fontFamily}`;
        measure.font = font;
        const metrics = measure.measureText('Hg');
        const day = [rgba[0], rgba[1], rgba[2], alpha];
        info = {
          font, size, step: clamp(STEP_EM * size, STEP_MIN, STEP_MAX),
          spacing: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0,
          transform: cs.textTransform,
          thin: cs.webkitFontSmoothing === 'antialiased',
          ascent: metrics.fontBoundingBoxAscent || size * 0.8,
          descent: metrics.fontBoundingBoxDescent || size * 0.2,
          day, night: nightColour(day, emphasis, model.darkPage).concat(alpha),
          dayCss: `rgba(${day[0]},${day[1]},${day[2]},${alpha.toFixed(3)})`
        };
        info.nightCss = `rgba(${info.night.slice(0, 3).map(Math.round).join(',')},${alpha.toFixed(3)})`;
        info.key = `${font}|${info.dayCss}|${info.spacing}|${info.transform}`;
      }
      return info;
    };
    const styleOf = el => {
      if (model.styles.has(el)) return model.styles.get(el);
      const info = styleFrom(el, getComputedStyle(el));
      model.styles.set(el, info);
      return info;
    };
    const excluded = el => {
      if (model.excluded.has(el)) return model.excluded.get(el);
      const value = !!el.closest(EXCLUDE) || !rendered(el);
      model.excluded.set(el, value);
      return value;
    };
    // The content of a closed <details> (outside its <summary>) still has client rects (the
    // browser lays it out when asked) but is not painted: it is no more drawn than shown.
    function rendered(el) {
      if (typeof el.checkVisibility === 'function') {
        if (el.checkVisibility()) return true;
        // (An element without a box of its own, display: contents, still shows its text.)
        return getComputedStyle(el).display === 'contents' && !!el.parentElement && rendered(el.parentElement);
      }
      for (let d = el.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) {
        const summary = el.closest('summary');
        if (!summary || summary.parentElement !== d) return false;
      }
      return true;
    }
    // Visually hidden text (a 1 px clip box) is not drawn by the page either.
    const tiny = el => {
      if (model.sizes.has(el)) return model.sizes.get(el);
      const r = el.getBoundingClientRect();
      const value = r.width <= 1 || r.height <= 1 ? null : [r.top + sy, r.bottom + sy];
      model.sizes.set(el, value);
      return value;
    };
    // A box anchors text that does not move with the page alone: the innermost ancestor
    // that is fixed, sticky (and can stick), or that clips content which overflows it.
    const clips = cs => cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    const overflows = el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    const ownAnchor = (el, root) => {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return true;
      if (cs.position === 'sticky') {
        for (let a = el.parentElement; a && a !== html; a = a.parentElement) {
          if (clips(getComputedStyle(a))) return overflows(a);
          if (a === root) break;
        }
        return true;                   // it sticks to the page
      }
      return clips(cs) && overflows(el);
    };
    const anchorOf = (el, root) => {
      if (model.anchors.has(el)) return model.anchors.get(el);
      let value = null;
      if (ownAnchor(el, root)) value = el;
      else if (el !== root && el.parentElement) value = anchorOf(el.parentElement, root);
      model.anchors.set(el, value);
      return value;
    };
    let began = performance.now();
    for (const root of scope) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (performance.now() - began > SLICE_MS) {
          noteSlice(state, performance.now() - began, 'model');
          await nextTask();
          if (state.dead || state.gen !== model.gen) return null;
          began = performance.now();
        }
        const parent = node.parentElement;
        if (!parent || !/\S/.test(node.data) || excluded(parent)) continue;
        const style = styleOf(parent);
        if (!style) continue;
        const span = tiny(parent);
        if (!span) continue;
        const entry = { node, parent, style, link: linkId(state, parent), anchor: anchorOf(parent, root), top: span[0], bottom: span[1] };
        if (entry.anchor) {
          let box = model.boxes.get(entry.anchor);
          if (!box) box = makeBox(entry.anchor, root);
          model.boxes.set(entry.anchor, box);
          box.entries.push(entry);
        } else {
          model.entries.push(entry);
        }
      }
    }
    // List markers that are text: one word each, where Chrome draws it (see markerText()).
    const lists = new Map();
    for (const root of scope) {
      for (const li of root.querySelectorAll('li')) {
        if (performance.now() - began > SLICE_MS) {
          noteSlice(state, performance.now() - began, 'modelMarkers');
          await nextTask();
          if (state.dead || state.gen !== model.gen) return null;
          began = performance.now();
        }
        if (excluded(li)) continue;
        const text = markerText(li, lists);
        if (!text || !text.trim()) continue;
        const style = styleFrom(li, getComputedStyle(li, '::marker'));
        const span = style && tiny(li);
        if (!span) continue;
        const anchor = anchorOf(li, root);
        const word = markerWord(li, text, style, anchor ? boxOrigin(anchor) : { x: -window.scrollX, y: -window.scrollY }, measure, styleOf);
        if (!word) continue;
        word.link = linkId(state, li);
        const entry = { node: null, marker: li, words: [word], parent: li, style, link: word.link, anchor, top: span[0], bottom: span[1] };
        if (anchor) {
          let box = model.boxes.get(anchor);
          if (!box) box = makeBox(anchor, root);
          model.boxes.set(anchor, box);
          box.entries.push(entry);
        } else {
          model.entries.push(entry);
        }
      }
    }
    // Images that can become particles: same origin (or allowed), loaded, rendered (not in a
    // closed <details>), visible, at least IMAGE_MIN px, not inside a fixed ancestor. Each keeps its own placement: in
    // the document, or in the container that clips it (its box, like text).
    const imageOf = (img, root) => {
      if (!state.kit.readable(img) || excluded(img) || !img.getClientRects().length) return null;
      const cs = getComputedStyle(img);
      if (cs.visibility !== 'visible' || cs.position === 'fixed') return null;
      // The lens's own rule hides an image that became particles: its opacity is ours.
      const own = state.imageRules.has(img) ? 1 : parseFloat(cs.opacity);
      const opacity = (Number.isFinite(own) ? own : 1) * opacityOf(img.parentElement);
      if (opacity < 0.02) return null;
      const anchor = anchorOf(img.parentElement, root);
      let box = null;
      if (anchor) {
        box = model.boxes.get(anchor) || makeBox(anchor, root);
        if (box.fixed) return null;
        model.boxes.set(anchor, box);
      }
      const r = img.getBoundingClientRect();
      const px = name => parseFloat(cs[name]) || 0;
      const left = r.left + px('borderLeftWidth') + px('paddingLeft'); const top = r.top + px('borderTopWidth') + px('paddingTop');
      const w = r.width - px('borderLeftWidth') - px('borderRightWidth') - px('paddingLeft') - px('paddingRight');
      const h = r.height - px('borderTopWidth') - px('borderBottomWidth') - px('paddingTop') - px('paddingBottom');
      if (w < IMAGE_MIN || h < IMAGE_MIN) return null;
      // (Fresh scroll offsets: the model is built in slices, and the reader may scroll.)
      const origin = anchor ? boxOrigin(anchor) : { x: -window.scrollX, y: -window.scrollY };
      const docY = top + window.scrollY;
      const src = img.currentSrc || img.src;
      const fit = { objectFit: cs.objectFit, objectPosition: cs.objectPosition };
      const radii = radiiOf(cs, r.width, r.height);
      // Its border, on the sides that show one (a square image only: a round one, and the
      // portrait's soft oval, keep their own edge).
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map(side => {
        const width = px(`border${side}Width`); const colour = parseColour(cs[`border${side}Color`]); const style = cs[`border${side}Style`];
        return width >= 0.5 && colour && colour[3] > 0.05 && style !== 'none' && style !== 'hidden' ? { w: width, c: colour } : null;
      });
      const frame = !radii && !img.matches(PORTRAIT_SELECTOR) && sides.some(Boolean) ? { sides, pad: [px('paddingTop'), px('paddingRight'), px('paddingBottom'), px('paddingLeft')] } : null;
      const oval = radii && radii.every(([rh, rv]) => rh >= 0.45 * w && rv >= 0.45 * h);
      const shape = img.matches(PORTRAIT_SELECTOR) || oval ? 'oval' : radii ? radii.map(c => c.map(v => v.toFixed(1)).join(' ')).join(',') : '';
      let id = state.imageIds.get(img);
      if (!id) { id = ++state.imageCount; state.imageIds.set(img, id); }
      return {
        img, src, w, h, x: left - origin.x, y: top - origin.y, top: docY, bottom: docY + h, box, fit,
        inset: [left - r.left, top - r.top], border: [r.width, r.height], frame,   // (inset, border: for a quick check that it moved)
        radii: shape && shape !== 'oval' ? radii : null, oval: shape === 'oval', opacity, link: linkId(state, img),
        gkey: `i${id}`,
        // What the particles depend on (not where they are): equal keys share one sampling.
        key: `${src}|${w.toFixed(1)}x${h.toFixed(1)}|${fit.objectFit} ${fit.objectPosition}|${shape}|${opacity.toFixed(2)}|${state.light ? 'light' : 'dark'}`
      };
    };
    if (state.kit) {
      for (const root of scope) {
        for (const img of root.querySelectorAll('img')) {
          if (performance.now() - began > SLICE_MS) {
            noteSlice(state, performance.now() - began, 'modelImages');
            await nextTask();
            if (state.dead || state.gen !== model.gen) return null;
            began = performance.now();
          }
          if (!img.isConnected) continue;
          const item = imageOf(img, root);
          if (item) { model.images.push(item); model.imageKeys.add(item.gkey); }
        }
      }
    }
    // Box placement on the page (for windowing) and its clip chain.
    for (const box of model.boxes.values()) {
      const r = box.el.getBoundingClientRect();
      box.top = r.top + sy; box.bottom = r.bottom + sy;
      if (box.fixed) { box.top = -Infinity; box.bottom = Infinity; }
    }
    model.entries.sort((a, b) => a.top - b.top);
    return model;
  }

  // A box group's anchor: what clips it, whether it lags with the page scroll, and whether
  // it hides what scrolls beneath it (a sticky table column with its own background).
  function makeBox(el, root) {
    const html = document.documentElement;
    const clipEls = []; let fixed = false; let rigid = false;
    const own = getComputedStyle(el);
    const bg = parseColour(own.backgroundColor);
    const occludes = (own.position === 'sticky' || own.position === 'fixed') && !!bg && bg[3] > 0.9;
    for (let a = el; a && a !== html; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') clipEls.push(a);
      if (cs.position === 'fixed') { fixed = true; rigid = true; }
      if (cs.position === 'sticky') rigid = true;
      if (a === root) break;
    }
    return { el, clipEls, fixed, occludes, lagShare: rigid ? 0 : 1, entries: [], top: 0, bottom: 0 };
  }

  // A link (or button) gets a stable id for the hover highlight.
  function linkId(state, el) {
    const a = el.closest('a[href], button, summary, [role="button"]');
    if (!a || !state.ctx.scope.some(root => root.contains(a))) return 0;
    let id = state.linkIds.get(a);
    if (!id) { id = ++state.linkCount; state.linkIds.set(a, id); }
    return id;
  }

  // The origin of a box's coordinates in the viewport: its content, as scrolled now.
  function boxOrigin(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + el.clientLeft - el.scrollLeft, y: r.top + el.clientTop - el.scrollTop };
  }

  /*
   * The words of a text node, measured once per model: text, box and style. x and y are
   * in the group's coordinates: the document for text in flow, a box's scrolled content
   * otherwise. `mid` is the document y of the word's middle (it picks the band).
   */
  function wordsOf(state, model, entry) {
    if (entry.words) return entry.words;    // a list marker, measured with the model
    const cached = model.words.get(entry.node);
    if (cached) return cached;
    const words = [];
    const node = entry.node; const style = entry.style;
    const range = state.range || (state.range = document.createRange());
    const sx = window.scrollX; const sy = window.scrollY;
    const origin = entry.anchor ? boxOrigin(entry.anchor) : { x: -sx, y: -sy };
    const transform = (text, atStart) => {
      const mode = style.transform;
      if (mode === 'uppercase') return text.toUpperCase();
      if (mode === 'lowercase') return text.toLowerCase();
      if (mode === 'capitalize' && atStart) return text.charAt(0).toUpperCase() + text.slice(1);
      return text;
    };
    const take = (start, end, atStart) => {
      range.setStart(node, start); range.setEnd(node, end);
      const r = range.getBoundingClientRect();
      // The skip link waits above the page; nothing outside the document is drawn.
      if (!r.width || !r.height || r.bottom + sy < 0 || r.right + sx < 0) return;
      words.push({
        text: transform(node.data.slice(start, end), atStart),
        x: r.left - origin.x, y: r.top - origin.y, width: r.width, height: r.height,
        mid: (r.top + r.bottom) / 2 + sy, style, link: entry.link, line: -1, node, from: start, to: end
      });
    };
    for (const match of node.data.matchAll(/\S+/gu)) {
      const from = match.index; const to = from + match[0].length;
      range.setStart(node, from); range.setEnd(node, to);
      const rects = range.getClientRects();
      let single = true;
      for (let i = 1; i < rects.length; i++) if (Math.abs(rects[i].top - rects[0].top) >= 1) single = false;
      if (single) { take(from, to, true); continue; }
      // A word wrapped across lines (at a hyphen) is taken once per line.
      let start = from; let offset = from; let top = null;
      for (const character of match[0]) {
        range.setStart(node, offset); range.setEnd(node, offset + character.length);
        const r = range.getBoundingClientRect();
        if (top !== null && Math.abs(r.top - top) > 1) { take(start, offset, start === from); start = offset; }
        top = r.top; offset += character.length;
      }
      take(start, offset, start === from);
    }
    model.words.set(entry.node, words);
    return words;
  }

  /*
   * A list item's marker as a word (see markerText()): its text without the trailing space,
   * in the group's coordinates (origin: where they start in the viewport now), on the
   * baseline of the item's first line, which is the baseline of the first text drawn in it.
   * An outside marker ends where that line begins, an inside one begins there (the content
   * box's start plus text-indent). null when the item has no text to align it with, or is
   * right to left (the site has none; its marker's order would need the bidi algorithm).
   */
  function markerWord(li, text, style, origin, measure, styleOf) {
    const cs = getComputedStyle(li);
    if (cs.direction === 'rtl') return null;
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode(); let at = -1;
    for (; node; node = walker.nextNode()) {
      at = node.data.search(/\S/);
      if (at >= 0 && node.parentElement && !node.parentElement.closest(EXCLUDE)) break;
    }
    if (!node) return null;
    const range = document.createRange();
    range.setStart(node, at); range.setEnd(node, at + 1);
    const first = range.getBoundingClientRect();
    if (!first.height) return null;
    const line = styleOf(node.parentElement);
    let ascent = line && line.ascent;
    if (!ascent) {
      const own = getComputedStyle(node.parentElement);
      measure.font = `${own.fontStyle} ${own.fontWeight} ${own.fontSize} ${own.fontFamily}`;
      ascent = measure.measureText('Hg').fontBoundingBoxAscent || parseFloat(own.fontSize) * 0.8;
    }
    const baseline = first.top + ascent;
    const r = li.getBoundingClientRect();
    const px = name => parseFloat(cs[name]) || 0;
    const indent = /px$/.test(cs.textIndent) ? parseFloat(cs.textIndent) : 0;
    const start = r.left + px('borderLeftWidth') + px('paddingLeft') + indent;
    measure.font = style.font;
    const spaced = 'letterSpacing' in measure;
    if (spaced) measure.letterSpacing = `${style.spacing}px`;
    const shown = text.trimEnd();
    const full = measure.measureText(text).width; const width = measure.measureText(shown).width;
    if (spaced) measure.letterSpacing = '0px';
    const left = cs.listStylePosition === 'inside' ? start : start - full;
    const top = baseline - style.ascent;
    return {
      text: shown, x: left - origin.x, y: top - origin.y, width, height: style.ascent + style.descent,
      mid: top + (style.ascent + style.descent) / 2 + window.scrollY, style, link: 0, line: -1,
      node: null, marker: li, from: 0, to: 0, ref: [r.left - origin.x, r.top - origin.y]
    };
  }

  // Visual lines of a group: words whose baselines agree, in reading order from the top.
  function groupLines(words) {
    const order = words.map((w, i) => i);
    const base = i => words[i].y + words[i].style.ascent;
    order.sort((a, b) => base(a) - base(b) || words[a].x - words[b].x);
    const lines = []; let current = null;
    for (const i of order) {
      const w = words[i]; const b = base(i);
      if (!current || b - current.base > LINE_SLACK) {
        current = { base: b, top: w.y, bottom: w.y + w.height, words: [], delayIn: -10, delayOut: 0 };
        lines.push(current);
      }
      current.words.push(w);
      current.top = Math.min(current.top, w.y);
      current.bottom = Math.max(current.bottom, w.y + w.height);
      w.line = lines.length - 1;
    }
    for (const line of lines) line.mid = (line.top + line.bottom) / 2;
    return lines;
  }

  // A cheap fingerprint of what a group would draw: unchanged groups are kept.
  function signature(words, extra = '') {
    let h = hashString(extra);
    for (const w of words) h = hashString(`${w.text}|${Math.round(w.x * 4)}|${Math.round(w.y * 4)}|${w.style.key}|${w.link}`, h);
    return h;
  }

  /* ---------------------------------------------------------------------------
   * Particles: sampled glyphs and the portrait, sorted into a spatial grid
   * ------------------------------------------------------------------------- */
  // A growable list of particles: 7 floats (x, y, seed, size, link, font, row tag) and
  // 8 bytes (day and night rgba) each, in strides of 8.
  function particleList() {
    return { n: 0, f: new Float32Array(8 * 4096), c: new Uint8ClampedArray(8 * 4096) };
  }
  function pushParticle(list, x, y, seed, size, link, font, rowY, day, night, alpha, dayAlpha) {
    if (list.n * 8 >= list.f.length) {
      const f = new Float32Array(list.f.length * 2); f.set(list.f); list.f = f;
      const c = new Uint8ClampedArray(list.c.length * 2); c.set(list.c); list.c = c;
    }
    const k = list.n * 8;
    list.f[k] = x; list.f[k + 1] = y; list.f[k + 2] = seed; list.f[k + 3] = size;
    list.f[k + 4] = link; list.f[k + 5] = font; list.f[k + 6] = rowY;
    list.c[k] = day[0]; list.c[k + 1] = day[1]; list.c[k + 2] = day[2]; list.c[k + 3] = 255 * dayAlpha;
    list.c[k + 4] = night[0]; list.c[k + 5] = night[1]; list.c[k + 6] = night[2]; list.c[k + 7] = 255 * alpha;
    list.n++;
  }

  /*
   * One sampling pass, from words[from]: render a strip of words, white on transparent,
   * at SUPER pixels per grid step, read the alpha back once, and harvest. Each cell's
   * mean alpha is its ink coverage; the alpha-weighted mean of its subsamples is the ink
   * centroid, where the particle goes. Returns the index of the next word.
   */
  let sampler = null;
  let passCells = PASS_CELLS[0];
  function samplerOf() {
    if (!sampler) {
      const canvas = makeCanvas(ATLAS_W, 1);
      const g = canvas.getContext('2d', { willReadFrequently: true });
      sampler = { canvas, g, native: 'letterSpacing' in g, warm: false };
    }
    return sampler;
  }
  // The first text a page draws on a canvas sets up the browser's text rasteriser (about 30 ms
  // on a 2020 Mac, once per page): it is done in a task of its own, before any word is
  // measured or sampled, so it does not add to a building slice.
  function warmSampler(state) {
    const s = samplerOf();
    if (s.warm) return;
    const began = performance.now();
    s.canvas.height = 24;                // (a pass sizes it again)
    s.g.font = getComputedStyle(document.body).font || '16px serif';
    s.g.fillText('a', 0, 16);
    s.warm = true;
    noteSlice(state, performance.now() - began, 'warm');
  }
  function samplePass(words, from, list, random) {
    const began = performance.now();
    const { canvas, g, native } = samplerOf();
    let x = 0; let y = 0; let shelf = 0; let i = from; let pageH = SAMPLE_PAGE_H; let cells = 0;
    for (; i < words.length; i++) {
      const w = words[i]; const st = w.style;
      const padX = Math.ceil(0.4 * st.size + Math.abs(st.spacing)); const padY = Math.ceil(0.2 * st.size);
      const cols = Math.ceil((w.width + 2 * padX) / st.step); const rows = Math.ceil((w.height + 2 * padY) / st.step);
      const pw = cols * SUPER; const ph = rows * SUPER;
      w.slot = null;
      if (pw > ATLAS_W || ph > ATLAS_H) continue;
      // A pass harvests at most passCells cells (one larger word alone), so it fits a slice.
      if (i > from && cells + cols * rows > passCells) break;
      if (i === from && ph > pageH) pageH = ph;
      if (x + pw > ATLAS_W) { x = 0; y += shelf + 2; shelf = 0; }
      if (y + ph > pageH) break;
      w.slot = [x, y, cols, rows, padX, padY];
      x += pw + 2; shelf = Math.max(shelf, ph); cells += cols * rows;
    }
    const height = y + shelf;
    if (!height) return Math.max(i, from + 1);
    canvas.height = height;              // also clears the strip
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    for (let k = from; k < i; k++) {
      const w = words[k]; if (!w.slot) continue;
      const [ax, ay, cols, rows, padX, padY] = w.slot; const st = w.style; const s = SUPER / st.step;
      g.save();
      g.beginPath(); g.rect(ax, ay, cols * SUPER, rows * SUPER); g.clip();
      g.setTransform(s, 0, 0, s, ax - (w.x - padX) * s, ay - (w.y - padY) * s);
      g.font = st.font;
      if (native) g.letterSpacing = `${st.spacing}px`;
      // The page paints each baseline on a whole CSS pixel (as measured for the first egg).
      fillSpaced(g, w.text, w.x, Math.round(w.y + st.ascent), st.spacing, native);
      g.restore();
    }
    // One 32-bit read per subsample; alpha is the top byte (little-endian RGBA).
    const pixels = new Uint32Array(g.getImageData(0, 0, ATLAS_W, height).data.buffer);
    const minSum = COVER_MIN * 255 * SUPER * SUPER;
    for (let k = from; k < i; k++) {
      const w = words[k]; if (!w.slot) continue;
      const [ax, ay, cols, rows, padX, padY] = w.slot; const st = w.style; const s = SUPER / st.step;
      const x0 = w.x - padX; const y0 = w.y - padY;
      // Larger type gets slightly larger grains (up to 1.4x for a name).
      const grain = clamp(st.step / (STEP_EM * 16), 1, 1.4);
      for (let cy = 0; cy < rows; cy++) {
        const rowBase = (ay + cy * SUPER) * ATLAS_W + ax;
        for (let cx = 0; cx < cols; cx++) {
          const base = rowBase + cx * SUPER;
          // Most cells are empty: sum first, centroid only for the kept ones.
          let sum = 0;
          for (let j = 0, p = base; j < SUPER; j++, p += ATLAS_W) for (let q = 0; q < SUPER; q++) sum += pixels[p + q] >>> 24;
          if (sum < minSum) continue;
          let mx = 0; let my = 0;
          for (let j = 0, p = base; j < SUPER; j++, p += ATLAS_W) {
            for (let q = 0; q < SUPER; q++) { const a = pixels[p + q] >>> 24; mx += a * (q + 0.5); my += a * (j + 0.5); }
          }
          const b = smooth(COVER_MIN, COVER_FULL, sum / (255 * SUPER * SUPER));
          // Rim particles stay on the outline; inside a stroke they scatter more, like dust.
          const jitter = (JITTER[0] + (JITTER[1] - JITTER[0]) * b) * st.step;
          const px = x0 + (cx * SUPER + mx / sum) / s + (random() - 0.5) * 2 * jitter;
          const py = y0 + (cy * SUPER + my / sum) / s + (random() - 0.5) * 2 * jitter;
          const size = grain * (SIZE_MIN + (SIZE_MAX - SIZE_MIN) * clamp(b + (random() - 0.5) * 0.25, 0, 1));
          const alpha = st.day[3] * (ALPHA_MIN + (1 - ALPHA_MIN) * b) * (1 - GRAIN * random());
          // The row tag (>= 0) is the word's line; freeze() turns it into the line's middle.
          pushParticle(list, px, py, random(), size, w.link, st.size, w.line, st.day, st.night, alpha, alpha);
        }
      }
    }
    // The next pass takes as many cells as fit PASS_MS at this pass's pace (smoothed).
    const spent = performance.now() - began;
    if (cells > 0 && spent > 0.05) passCells = clamp(0.5 * passCells + 0.5 * cells * PASS_MS / spent, PASS_CELLS[0], PASS_CELLS[1]);
    return i;
  }

  /*
   * Images. A job decodes one image as it is displayed (off the main thread for a raster
   * file) and samples it into particles relative to its content box. The result is cached
   * by the image's key (source, size, fit, shape, opacity), so a moved image is only
   * translated and an evicted one comes back without decoding again.
   */
  const kinds = new Map();               // src -> 'photo' | 'graphic', for the page's lifetime

  // A test for the content box's rounded corners (CSS px from its top left), or null.
  function cornerTest(item) {
    const radii = item.radii;
    if (!radii) return null;
    const w = item.w; const h = item.h;
    const [tl, tr, br, bl] = radii;
    const corner = (x, y, cx, cy, [rh, rv]) => { const u = (x - cx) / rh; const v = (y - cy) / rv; return u * u + v * v <= 1; };
    return (x, y) => {
      if (x < tl[0] && y < tl[1]) return corner(x, y, tl[0], tl[1], tl);
      if (x > w - tr[0] && y < tr[1]) return corner(x, y, w - tr[0], tr[1], tr);
      if (x > w - br[0] && y > h - br[1]) return corner(x, y, w - br[0], h - br[1], br);
      if (x < bl[0] && y > h - bl[1]) return corner(x, y, bl[0], h - bl[1], bl);
      return true;
    };
  }

  // A box blur of a w x h field (window 2r + 1, edges repeated): two passes of running sums.
  // (Synchronous, so every call shares one scratch field: photos are sampled side by side,
  // and their large temporary arrays are what makes the collector pause.)
  let blurScratch = new Float32Array(0);
  function boxBlur(src, w, h, r) {
    if (blurScratch.length < w * h) blurScratch = new Float32Array(w * h);
    const tmp = blurScratch; const out = new Float32Array(w * h); const k = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w; let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum * k;
        sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum * k;
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

  // The tone curve of a photo's light (0..1) before local contrast, and the chance that a
  // cell of that light holds a star.
  const photoGlow = l => Math.pow(smooth(PHOTO_MIN_LUMA, 0.86, l), PHOTO_GAMMA);
  const photoPresence = glow => (glow < 0.04 ? 0 : Math.min(1, glow / PHOTO_DENSE));
  // Pixels per CSS px at which a photo is drawn for its cells (see photoParticles).
  const photoRatio = item => Math.min(PHOTO_SUPER / IMAGE_STEP, Math.sqrt(PHOTO_FINE_PX / (item.w * item.h)));

  /*
   * A photo, drawn at up to PHOTO_SUPER pixels per side of the finest cell, then gathered
   * into cells. The grid is set by the stars the photo will hold, not by its area alone:
   * the expected number of stars per pixel (from the same tone curve) gives the step that
   * spends IMAGE_BUDGET (or item.budget) on them, so a night photo of thin lit windows gets
   * a finer grid than a bright sky of the same size. A cell's light leans from its mean
   * toward its outlier (PHOTO_PEAK): its brightest pixel where that stands out of the cells
   * around it more than its darkest does, else its darkest; its colour is the colour of its
   * light (luminance-weighted). So thin bright lines (lit windows, a horizon, surf) and thin
   * dark ones (bare branches, a bird against the sky) both survive the gathering. Then local
   * contrast (a cell is pushed away from the mean of its neighbourhood, so a gull against
   * the sky or a figure under trees stands out of a broad gradient) and the tone curve.
   * Bright cells each hold a star; dimmer ones only now and then, a little brighter, so dim
   * areas thin out into a sparse sky instead of a uniform grey haze. Should the stars still
   * exceed the budget, every cell's chance is scaled down (and the survivors brightened the
   * same way). Size and alpha follow the light. In slices; resolves { list, step }, or null
   * if live() turns false.
   */
  async function photoParticles(state, item, data, W, H, random, live) {
    let began = performance.now();
    const breathe = async () => {
      if (performance.now() - began < SLICE_MS) return true;
      noteSlice(state, performance.now() - began, 'photo');
      await nextTask();
      began = performance.now();
      return live();
    };
    // The expected stars per pixel on the tone curve (luminance is computed again below rather
    // than kept: one array less per photo).
    const lumAt = k => (0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]) / 255;
    let expected = 0;
    for (let y = 0, p = 0; y < H; y++) {
      if (!(await breathe())) return null;
      for (let x = 0; x < W; x++, p++) {
        const k = p * 4;
        if (data[k + 3] >= 13) expected += photoPresence(photoGlow(lumAt(k)));
      }
    }
    const area = item.w * item.h;
    const share = Math.max(expected / (W * H), 1e-3);
    const budget = item.budget || IMAGE_BUDGET;
    const step = Math.max(IMAGE_STEP, Math.sqrt((area * share) / budget), Math.sqrt(area / PHOTO_CELLS_MAX), 1 / (W / item.w));
    const cols = Math.max(1, Math.round(item.w / step)); const rows = Math.max(1, Math.round(item.h / step));
    // Gather the pixels into cells: mean and brightest luminance, alpha, and the colour of
    // the light (rgb weighted by luminance).
    const n = cols * rows;
    const colOf = new Int32Array(W);
    for (let x = 0; x < W; x++) colOf[x] = Math.min(cols - 1, Math.floor((x * cols) / W));
    const sumL = new Float32Array(n); const maxL = new Float32Array(n); const minL = new Float32Array(n).fill(1);
    const sumA = new Float32Array(n); const rgb = new Float32Array(n * 3); const count = new Float32Array(n);
    for (let y = 0, p = 0; y < H; y++) {
      if (!(await breathe())) return null;
      const row = Math.min(rows - 1, Math.floor((y * rows) / H)) * cols;
      for (let x = 0; x < W; x++, p++) {
        const c = row + colOf[x]; const k = p * 4; const l = lumAt(k);
        sumL[c] += l; if (l > maxL[c]) maxL[c] = l; if (l < minL[c]) minL[c] = l;
        sumA[c] += data[k + 3]; count[c]++;
        const w = l + 0.004;
        rgb[c * 3] += data[k] * w; rgb[c * 3 + 1] += data[k + 1] * w; rgb[c * 3 + 2] += data[k + 2] * w;
      }
    }
    // Each cell leans toward its outlier: the brightest pixel where it stands out of a darker
    // neighbourhood (a lit window, a horizon), the darkest where it cuts into a lighter one (a
    // bare branch or a bird against the sky), and stays near its mean where neither does.
    if (!(await breathe())) return null;
    const means = new Float32Array(n);
    for (let c = 0; c < n; c++) means[c] = count[c] ? sumL[c] / count[c] : 0;
    const around = boxBlur(means, cols, rows, PHOTO_OUTLIER_R);
    if (!(await breathe())) return null;
    const cell = new Float32Array(n);
    for (let c = 0; c < n; c++) {
      const mean = means[c]; const up = maxL[c] - around[c]; const down = around[c] - minL[c];
      const lean = PHOTO_PEAK * clamp(Math.abs(up - down) / PHOTO_OUTLIER_SOFT, 0, 1);
      cell[c] = mean + lean * ((up >= down ? maxL[c] : minL[c]) - mean);
    }
    if (!(await breathe())) return null;
    // Exposure: a cell in a dark neighbourhood (rocks under a bright sky, a facade at dusk)
    // is lifted toward PHOTO_KEY, at most PHOTO_EXPOSE_MAX times; light areas keep their light.
    const wide = boxBlur(cell, cols, rows, Math.max(2, Math.round(PHOTO_EXPOSE_R * Math.min(cols, rows))));
    const gain = new Float32Array(n);
    for (let j = 0; j < rows; j++) {
      if (!(await breathe())) return null;
      for (let c = j * cols, end = c + cols; c < end; c++) {
        gain[c] = clamp(Math.pow(PHOTO_KEY / Math.max(wide[c], 1e-3), PHOTO_EXPOSE), 1, PHOTO_EXPOSE_MAX);
        cell[c] = Math.min(1, cell[c] * gain[c]);
      }
    }
    if (!(await breathe())) return null;
    const near = boxBlur(cell, cols, rows, Math.max(2, Math.round(PHOTO_LOCAL_R * Math.min(cols, rows))));
    // Each cell's glow, and the stars they would hold: over the budget, all thin out alike.
    const glows = new Float32Array(n);
    let stars = 0;
    for (let j = 0; j < rows; j++) {
      if (!(await breathe())) return null;
      for (let i = 0; i < cols; i++) {
        const c = j * cols + i;
        const a = count[c] ? sumA[c] / count[c] / 255 : 0;
        if (a < 0.05) continue;
        const lit = clamp(cell[c] + PHOTO_LOCAL * (cell[c] - near[c]), 0, 1);
        // A round image (and the portrait) fades into the night at an oval edge.
        const vignette = item.oval ? 1 - smooth(0.68, 1.08, Math.hypot((i + 0.5) / cols * 2 - 1, (j + 0.5) / rows * 2 - 1)) : 1;
        const glow = photoGlow(lit) * vignette * a;
        glows[c] = glow; stars += photoPresence(glow);
      }
    }
    const thin = Math.min(1, budget / Math.max(1, stars));
    const list = particleList();
    const dx = item.w / cols; const dy = item.h / rows;
    const grain = Math.pow(step / IMAGE_STEP, PHOTO_GROW);
    const font = -PHOTO_FONT * Math.sqrt(step / IMAGE_STEP);   // negative: drawn as soft stars
    const inside = cornerTest(item);
    for (let j = 0; j < rows; j++) {
      if (!(await breathe())) return null;
      for (let i = 0; i < cols; i++) {
        const c = j * cols + i;
        const glow = glows[c];
        const presence = photoPresence(glow) * thin;
        if (!presence || random() > presence) continue;
        const light = Math.min(1, glow * (1 + PHOTO_SPARSE_LIFT * (1 / presence - 1)));
        const x = (i + 0.5 + (random() - 0.5) * PHOTO_JITTER) * dx;
        const y = (j + 0.5 + (random() - 0.5) * PHOTO_JITTER) * dy;
        if (inside && !inside(x, y)) continue;
        const a = sumA[c] / count[c] / 255;
        const weight = sumL[c] + 0.004 * count[c];
        const day = [rgb[c * 3] / weight, rgb[c * 3 + 1] / weight, rgb[c * 3 + 2] / weight];
        const grey = luma(day) * 255; const lift = PHOTO_LIFT * gain[c];
        const night = day.map(v => Math.min(255, (grey + (v - grey) * (1 - PHOTO_DESATURATE)) * lift + 18));
        // Every star has its own magnitude: a little smaller and fainter, or not.
        const magnitude = 1 - PHOTO_MAGNITUDE * random();
        const size = grain * (PHOTO_SIZE[0] + (PHOTO_SIZE[1] - PHOTO_SIZE[0]) * light) * (0.75 + 0.25 * magnitude);
        // Full alpha on the day page (it dissolves out of the photo), its light at night.
        pushParticle(list, x, y, random(), size, 0, font, -1 - y, day, night,
          (0.14 + 0.86 * light) * magnitude * item.opacity, a * item.opacity);
      }
    }
    noteSlice(state, performance.now() - began, 'photo');
    return { list, step };
  }

  // A graphic's ground: its commonest colour and the colours about as light that cover much
  // of it (the panels a figure is drawn on), or null when it is mostly transparent. Read on
  // about 4096 points; also returns the share of ink among them.
  function groundOf(data, width, height) {
    const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 4096)));
    const counts = new Map(); let points = 0;
    for (let y = stride >> 1; y < height; y += stride) {
      for (let x = stride >> 1; x < width; x += stride) {
        const i = (y * width + x) * 4; points++;
        const key = data[i + 3] < 128 ? -1 : (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | (data[i + 2] >> 4);
        let c = counts.get(key);
        if (!c) { c = [0, 0, 0, 0]; counts.set(key, c); }
        c[0]++; c[1] += data[i]; c[2] += data[i + 1]; c[3] += data[i + 2];
      }
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1][0] - a[1][0]);
    if (!ranked.length || ranked[0][0] === -1) return { colours: null, stride };
    const mean = c => [c[1] / c[0], c[2] / c[0], c[3] / c[0]];
    const colours = [mean(ranked[0][1])]; const l0 = luma(colours[0]);
    for (const [key, c] of ranked.slice(1, 12)) {
      if (key === -1 || c[0] < BG_SHARE * points || colours.length >= BG_COLOURS) continue;
      const m = mean(c);
      if (Math.abs(luma(m) - l0) <= BG_LUMA) colours.push(m);
    }
    return { colours, stride };
  }

  /*
   * A graphic, drawn at GRAPHIC_SUPER subsamples per cell side at the finest step. A
   * subsample's ink is its distance from the nearest ground colour around it (after
   * compositing its alpha over the commonest), or its alpha when the ground is transparent.
   * The grounds around a subsample are those its block of BLOCK subsamples and the blocks
   * next to it show, so a light box outline between a white box and a tinted panel is ink,
   * and so are the letters on a pale pill. The step grows with the ink (so a sparse line
   * drawing keeps the finest step and its labels); each cell's mean ink is its coverage, and
   * the particle sits at the ink centroid, in the ink's own colour turned to the night as
   * text is. The inside of a solid fill is drawn sparse and dimmer. Resolves the particles
   * (CSS px from the content box's top left), or null if stopped.
   */
  async function graphicParticles(state, item, data, W, H, random, live) {
    const ratio = W / item.w;                      // subsamples per CSS px
    const { colours, stride } = groundOf(data, W, H);
    const bg = colours; const base = bg ? bg[0] : null;
    const dark = base ? luma(base) < 0.5 : !state.light;
    const MAX_DIST = 441.673;                      // the distance from black to white
    const BLOCK = 8;                               // subsamples per block side (local grounds)
    const all = bg ? (1 << bg.length) - 1 : 0;
    const bw = Math.ceil(W / BLOCK); const bh = Math.ceil(H / BLOCK);
    let masks = null;                              // per block: the ground colours around it (bits)
    let began = performance.now();
    if (bg && bg.length > 1) {
      // (A ground counts in a block where it covers a third of it or more: the antialiased
      // rim of a grey line is not a grey panel.)
      const K = bg.length; const counts = new Uint8Array(bw * bh * K); const limit = (1.5 * INK_NEAR * MAX_DIST) ** 2;
      for (let y = 0; y < H; y += 2) {
        if (performance.now() - began > SLICE_MS) {
          noteSlice(state, performance.now() - began, 'cells');
          await nextTask();
          if (!live()) return null;
          began = performance.now();
        }
        const row = (y >> 3) * bw;
        for (let x = 0, i = y * W * 4; x < W; x += 2, i += 8) {
          const a = data[i + 3] / 255;
          const r = data[i] * a + base[0] * (1 - a); const g = data[i + 1] * a + base[1] * (1 - a); const b = data[i + 2] * a + base[2] * (1 - a);
          // (Its nearest ground: a pale blue panel lies within reach of white as well.)
          let near = -1; let least = limit;
          for (let k = 0; k < bg.length; k++) {
            const c = bg[k]; const dr = r - c[0]; const dg = g - c[1]; const db = b - c[2];
            const dd = dr * dr + dg * dg + db * db;
            if (dd < least) { least = dd; near = k; }
          }
          if (near >= 0) counts[(row + (x >> 3)) * K + near]++;
        }
      }
      const own = new Uint8Array(bw * bh); const enough = (BLOCK / 2) ** 2 / 3;
      for (let q = 0; q < bw * bh; q++) for (let k = 0; k < K; k++) if (counts[q * K + k] >= enough) own[q] |= 1 << k;
      masks = new Uint8Array(bw * bh);
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          let m = 0;
          for (let j = Math.max(0, by - 1); j <= Math.min(bh - 1, by + 1); j++) for (let k = Math.max(0, bx - 1); k <= Math.min(bw - 1, bx + 1); k++) m |= own[j * bw + k];
          masks[by * bw + bx] = m || all;          // (inside a large ink area: every ground)
        }
      }
    }
    const ink = new Float32Array(5);               // ink, r, g, b and nearest ground of the last subsample read
    const read = (i, m) => {
      const a = data[i + 3] / 255;
      let r = data[i]; let g = data[i + 1]; let b = data[i + 2];
      if (!base) { ink[0] = a; ink[1] = r; ink[2] = g; ink[3] = b; ink[4] = -1; return a; }
      r = r * a + base[0] * (1 - a); g = g * a + base[1] * (1 - a); b = b * a + base[2] * (1 - a);
      let d = Infinity; let near = -1;
      for (let k = 0; k < bg.length; k++) {
        if (!((m >> k) & 1)) continue;
        const c = bg[k]; const dr = r - c[0]; const dg = g - c[1]; const db = b - c[2];
        const dd = dr * dr + dg * dg + db * db;
        if (dd < d) { d = dd; near = k; }
      }
      const v = smooth(INK_NEAR, INK_FAR, Math.sqrt(d) / MAX_DIST);
      ink[0] = v; ink[1] = r; ink[2] = g; ink[3] = b; ink[4] = near;
      return v;
    };
    // The tinted grounds (see TINT_STEP): every ground but the commonest that stands INK_NEAR
    // or more from it. Their squares are counted in the first pass of cells (they do not
    // depend on its step): per square, the subsamples of each ground (slot 0: the main ground
    // and the grounds as near it).
    const K = bg ? bg.length : 0;
    const tintOf = new Float32Array(Math.max(1, K));   // per ground: its distance from the main one (0: not a tint)
    for (let k = 1; k < K; k++) {
      const c = bg[k]; const dist = Math.hypot(c[0] - base[0], c[1] - base[1], c[2] - base[2]) / MAX_DIST;
      tintOf[k] = dist >= INK_NEAR ? dist : 0;
    }
    const tinted = tintOf.some(v => v > 0);
    const tk = Math.max(1, TINT_STEP * ratio);     // subsamples per tint square side
    const tcols = Math.max(1, Math.floor(W / tk)); const trows = Math.max(1, Math.floor(H / tk));
    const tintCol = new Int32Array(W);
    for (let x = 0; x < W; x++) tintCol[x] = Math.min(tcols - 1, Math.floor(x / tk));
    let tintCounts = null;                         // per square and ground (K each), filled once ...
    let tintRGB = null;                            // ... and per square the colour summed over its tinted subsamples
    const maskAt = (x, y) => (masks ? masks[(y >> 3) * bw + (x >> 3)] : all);
    // The share of ink, on the ground's sample points, sets the step.
    let sum = 0; let points = 0;
    for (let y = stride >> 1; y < H; y += stride) for (let x = stride >> 1; x < W; x += stride) { sum += read((y * W + x) * 4, maskAt(x, y)); points++; }
    const share = Math.min(1, (INK_SPREAD * sum) / Math.max(1, points));
    // One pass of cells at a step: per cell the ink summed, its centroid and colour
    // (ink-weighted sums) and its coverage; count is the number of cells with a particle.
    const pass = async step => {
      const cols = Math.max(1, Math.floor((W / ratio) / step)); const rows = Math.max(1, Math.floor((H / ratio) / step));
      const kx = W / cols; const ky = H / rows;    // subsamples per cell, across and down
      const colOf = new Int32Array(W); const colArea = new Float32Array(cols); const rowArea = new Float32Array(rows);
      for (let x = 0; x < W; x++) { const c = Math.min(cols - 1, Math.floor(x / kx)); colOf[x] = c; colArea[c]++; }
      const sums = new Float32Array(cols * rows); const mx = new Float32Array(cols * rows); const my = new Float32Array(cols * rows);
      const rgb = new Float32Array(cols * rows * 3); const cover = new Float32Array(cols * rows);
      let count = 0; began = performance.now();
      const counting = tinted && !tintCounts;
      const tints = counting ? new Uint16Array(tcols * trows * K) : null;
      const tintSum = counting ? new Float32Array(tcols * trows * 3) : null;
      for (let cj = 0; cj < rows; cj++) {
        const y0 = Math.round(cj * ky); const y1 = cj === rows - 1 ? H : Math.round((cj + 1) * ky);
        rowArea[cj] = Math.max(1, y1 - y0);
        for (let y = y0; y < y1; y++) {
          let i = y * W * 4; const mrow = (y >> 3) * bw;
          const trow = counting ? Math.min(trows - 1, Math.floor(y / tk)) * tcols : 0;
          for (let x = 0; x < W; x++, i += 4) {
            if (read(i, masks ? masks[mrow + (x >> 3)] : all) <= 0) {
              if (counting && ink[4] >= 0) {
                const q = trow + tintCol[x]; const slot = tintOf[ink[4]] > 0 ? ink[4] : 0;
                tints[q * K + slot]++;
                if (slot) { tintSum[q * 3] += ink[1]; tintSum[q * 3 + 1] += ink[2]; tintSum[q * 3 + 2] += ink[3]; }
              }
              continue;
            }
            const v = ink[0]; const c = cj * cols + colOf[x];
            sums[c] += v; mx[c] += v * (x + 0.5); my[c] += v * (y + 0.5);
            rgb[c * 3] += v * ink[1]; rgb[c * 3 + 1] += v * ink[2]; rgb[c * 3 + 2] += v * ink[3];
          }
        }
        for (let ci = 0; ci < cols; ci++) {
          const c = cj * cols + ci;
          cover[c] = sums[c] / (colArea[ci] * rowArea[cj]);
          if (cover[c] >= COVER_MIN) count++;
        }
        const spent = performance.now() - began;
        if (spent > SLICE_MS) {
          noteSlice(state, spent, 'cells');
          await nextTask();
          if (!live()) return null;
          began = performance.now();
        }
      }
      // The inside of a fill: a cell covered, as are its four neighbours, all of about one
      // colour (a letter or a line on the fill breaks it). It costs FILL_KEEP of a particle.
      const fills = new Uint8Array(cols * rows);
      const near = (a, b) => {
        const wa = sums[a]; const wb = sums[b];
        const dr = rgb[a * 3] / wa - rgb[b * 3] / wb; const dg = rgb[a * 3 + 1] / wa - rgb[b * 3 + 1] / wb; const db = rgb[a * 3 + 2] / wa - rgb[b * 3 + 2] / wb;
        return dr * dr + dg * dg + db * db <= (FILL_SIMILAR * MAX_DIST) ** 2;
      };
      let cost = 0;
      for (let cj = 0; cj < rows; cj++) {
        if (performance.now() - began > SLICE_MS) {
          noteSlice(state, performance.now() - began, 'cells');
          await nextTask();
          if (!live()) return null;
          began = performance.now();
        }
        for (let ci = 0; ci < cols; ci++) {
          const c = cj * cols + ci;
          if (cover[c] < COVER_MIN) continue;
          const inside = cover[c] >= FILL_COVER && ci > 0 && cj > 0 && ci < cols - 1 && cj < rows - 1 &&
            cover[c - 1] >= FILL_COVER && cover[c + 1] >= FILL_COVER && cover[c - cols] >= FILL_COVER && cover[c + cols] >= FILL_COVER &&
            near(c, c - 1) && near(c, c + 1) && near(c, c - cols) && near(c, c + cols);
          fills[c] = inside ? 1 : 0;
          cost += inside ? FILL_KEEP : 1;
        }
      }
      noteSlice(state, performance.now() - began, 'cellsEnd');
      if (counting) { tintCounts = tints; tintRGB = tintSum; }
      return { step, cols, rows, sums, mx, my, rgb, cover, count, fills, cost };
    };
    // The share is an estimate (the rims of thin lines count in full, a fill's inside costs
    // less): far off the budget, the cells are made once more at a step changed by the
    // difference (as lines would need it).
    const budget = GRAPHIC_BUDGET;
    let grid = await pass(Math.max(GRAPHIC_STEP, Math.sqrt((item.w * item.h * share) / budget), 1 / ratio));
    if (grid && (grid.cost > budget * 1.15 || (grid.cost < budget * 0.6 && grid.step > Math.max(GRAPHIC_STEP, 1 / ratio) * 1.08))) {
      await nextTask();
      if (!live()) return null;
      grid = await pass(Math.max(GRAPHIC_STEP, 1 / ratio, grid.step * Math.pow(Math.max(1, grid.cost) / budget, 0.75)));
    }
    if (!grid) return null;
    const { step, cols, rows, sums, mx, my, rgb, cover, fills } = grid;
    await nextTask();                              // the particles take a slice of their own
    if (!live()) return null;
    const emitted = performance.now();
    const list = particleList();
    const grain = clamp(step / (STEP_EM * 16), 1, 1.4);
    const inside = cornerTest(item);
    began = emitted;
    for (let cj = 0; cj < rows; cj++) {
      if (performance.now() - began > SLICE_MS) {
        noteSlice(state, performance.now() - began, 'emit');
        await nextTask();
        if (!live()) return null;
        began = performance.now();
      }
      for (let ci = 0; ci < cols; ci++) {
        const c = cj * cols + ci; const cov = cover[c];
        if (cov < COVER_MIN) continue;
        const weight = sums[c];
        const b = smooth(COVER_MIN, COVER_FULL, cov);
        const fill = fills[c] === 1;
        if (fill && random() > FILL_KEEP) continue;
        const jitter = (JITTER[0] + (JITTER[1] - JITTER[0]) * b) * step;
        const x = mx[c] / weight / ratio + (random() - 0.5) * 2 * jitter;
        const y = my[c] / weight / ratio + (random() - 0.5) * 2 * jitter;
        if (inside && !inside(x, y)) continue;
        const day = [rgb[c * 3] / weight, rgb[c * 3 + 1] / weight, rgb[c * 3 + 2] / weight];
        // Ink lighter than its own ground (white letters on a blue tile) is light ink, as on a
        // dark page: the ground it stood out from is gone, so it must stay bright.
        const night = nightColour(day, false, dark || (base && luma(day) > luma(base)), true);
        const size = grain * (SIZE_MIN + (SIZE_MAX - SIZE_MIN) * clamp(b + (random() - 0.5) * 0.25, 0, 1));
        const alpha = item.opacity * (ALPHA_MIN + (1 - ALPHA_MIN) * b) * (1 - GRAIN * random());
        pushParticle(list, x, y, random(), size, 0, GRAPHIC_FONT, -1 - y, day, night, alpha * (fill ? FILL_ALPHA : 1), alpha);
      }
    }
    if (tintCounts) {
      // The tinted grounds: a square that is mostly one of them holds a grain with a chance
      // that grows with its own colour's distance from the main ground (more where it meets
      // another ground, so a panel keeps its edge), in its own colour turned to the night: a
      // light grey box that lies nearer a pale lavender panel than white is a faint grey, not
      // lavender. Over TINT_BUDGET, all thin out alike.
      // (Owner of a square: a tint k, MAIN for the main ground, or -1 for ink or a mixture.)
      // In slices of their own, row by row: a large figure has a hundred thousand squares.
      const breathe = async () => {
        if (performance.now() - began < SLICE_MS) return true;
        noteSlice(state, performance.now() - began, 'tint');
        await nextTask();
        began = performance.now();
        return live();
      };
      noteSlice(state, performance.now() - began, 'emit');
      await nextTask();
      if (!live()) return null;
      began = performance.now();
      const MAIN = -2; const area = tk * tk; const owner = new Int8Array(tcols * trows).fill(-1);
      for (let q = 0; q < tcols * trows; q++) {
        if (q % tcols === 0 && !(await breathe())) return null;
        let best = 0; let most = 0;
        for (let k = 1; k < K; k++) { const n = tintCounts[q * K + k]; if (n > most) { most = n; best = k; } }
        if (most >= TINT_SHARE * area) owner[q] = best;
        else if (tintCounts[q * K] >= TINT_SHARE * area) owner[q] = MAIN;
      }
      const chance = new Float32Array(tcols * trows); const distance = new Float32Array(tcols * trows); let expected = 0;
      const colourOf = q => {
        let n = 0; for (let k = 1; k < K; k++) n += tintCounts[q * K + k];
        return [tintRGB[q * 3] / n, tintRGB[q * 3 + 1] / n, tintRGB[q * 3 + 2] / n];
      };
      for (let tj = 0; tj < trows; tj++) {
        if (!(await breathe())) return null;
        for (let ti = 0; ti < tcols; ti++) {
          const q = tj * tcols + ti; const k = owner[q];
          if (k < 0) continue;
          const c = colourOf(q);
          distance[q] = Math.hypot(c[0] - base[0], c[1] - base[1], c[2] - base[2]) / MAX_DIST;
          // (An edge: next to another tint or to the main ground, not to ink, whose own line
          // is drawn already.)
          let edge = false;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = ti + di; const b = tj + dj;
            if (a < 0 || b < 0 || a >= tcols || b >= trows) continue;
            const other = owner[b * tcols + a];
            if (other !== k && (other >= 0 || other === MAIN)) { edge = true; break; }
          }
          const p = Math.max(edge ? TINT_EDGE : 0, clamp((distance[q] - TINT_FROM) * TINT_GAIN, TINT_KEEP[0], TINT_KEEP[1]));
          chance[q] = p; expected += p;
        }
      }
      const thin = Math.min(1, TINT_BUDGET / Math.max(1, expected));
      const cell = tk / ratio;                     // CSS px per square
      for (let tj = 0; tj < trows; tj++) {
        if (!(await breathe())) return null;
        for (let ti = 0; ti < tcols; ti++) {
          const q = tj * tcols + ti; const k = owner[q];
          if (k < 0 || random() > chance[q] * thin) continue;
          const x = (ti + 0.15 + 0.7 * random()) * cell; const y = (tj + 0.15 + 0.7 * random()) * cell;
          if (inside && !inside(x, y)) continue;
          const day = colourOf(q);
          const alpha = item.opacity * (TINT_ALPHA[0] + (TINT_ALPHA[1] - TINT_ALPHA[0]) * smooth(0.07, 0.16, distance[q])) * (1 - GRAIN * random());
          pushParticle(list, x, y, random(), grain * SIZE_MIN * (1 + 0.3 * random()), 0, GRAPHIC_FONT, -1 - y, day, tintColour(day), alpha, alpha);
        }
      }
      state.perf.tintMax = Math.max(state.perf.tintMax || 0, Math.round(expected * thin));
    }
    noteSlice(state, performance.now() - began, 'emit');
    return { list, step, lightGround: !dark };
  }

  // One image's particles: its kind (cached by source), then its pixels as displayed.
  // Resolves { kind, step, list, lightGround }, or null when it could not be read or the lens
  // moved on (lightGround: a graphic drawn on a light ground, or a transparent one on a light page).
  async function sampleImage(state, item) {
    const kit = state.kit; const img = item.img;
    const live = () => !state.dead && state.phase !== 'exiting' && img.isConnected && img.complete;
    let kind = kinds.get(item.src);
    let photoDraw = null;
    if (!kind) {
      if (isSvg(item.src)) kind = 'graphic';
      else {
        // A raster image is most often a photo: its drawing starts while it is classified,
        // so the two decodes (off the main thread) run side by side.
        photoDraw = kit.drawAsync(img, item.w, item.h, photoRatio(item), item.fit).catch(() => null);
        const sampled = await kit.sample(img);
        if (!live()) return null;
        kind = kit.classify(sampled, img);
      }
      kinds.set(item.src, kind);
    }
    const random = seeded(hashString(item.key));
    if (kind === 'photo') {
      const canvas = (photoDraw && await photoDraw) || await kit.drawAsync(img, item.w, item.h, photoRatio(item), item.fit);
      if (!live()) return null;
      await nextTask();
      if (!live()) return null;
      const began = performance.now();
      const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
      noteSlice(state, performance.now() - began, 'read');
      const out = await photoParticles(state, item, data, canvas.width, canvas.height, random, live);
      return out && { kind, step: out.step, list: out.list };
    }
    let ratio = GRAPHIC_SUPER / GRAPHIC_STEP;
    if (item.w * item.h * ratio * ratio > GRAPHIC_MAX_PX) ratio = Math.sqrt(GRAPHIC_MAX_PX / (item.w * item.h));
    const drawn = performance.now();
    const canvas = await kit.drawAsync(img, item.w, item.h, ratio, item.fit);
    if (!live()) return null;
    // (An SVG is drawn synchronously by drawAsync; the first draw lays out its document.)
    if (isSvg(item.src)) state.perf.svgDrawMs = Math.max(state.perf.svgDrawMs || 0, performance.now() - drawn);
    await nextTask();
    if (!live()) return null;
    const began = performance.now();
    const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    noteSlice(state, performance.now() - began, 'read');
    await nextTask();
    if (!live()) return null;
    const out = await graphicParticles(state, item, data, canvas.width, canvas.height, random, live);
    return out && { kind, step: out.step, list: out.list, lightGround: out.lightGround };
  }

  // Jobs: the images the window needs are decoded and sampled IMAGE_JOBS at once, nearest
  // first; the builder picks each result up when it lands (it runs again then).
  function requestImage(state, item, distance) {
    if (state.imageCache.has(item.key) || state.imageFailed.has(item.key)) return null;
    let job = state.jobs.get(item.key);
    if (!job) {
      job = { key: item.key, item, distance, running: false, wanted: true, resolve: null, promise: null };
      job.promise = new Promise(resolve => { job.resolve = resolve; });
      state.jobs.set(item.key, job);
    }
    job.item = item; job.distance = distance; job.wanted = true;
    pumpJobs(state);
    return job.promise;
  }
  function pumpJobs(state) {
    const limit = state.phase === 'build' && state.ctx.arriving ? IMAGE_JOBS_ARRIVING : IMAGE_JOBS;
    while (!state.dead && state.phase !== 'exiting' && state.jobsRunning < limit) {
      let next = null;
      for (const job of state.jobs.values()) if (!job.running && (!next || job.distance < next.distance)) next = job;
      if (!next) return;
      next.running = true; state.jobsRunning++;
      runJob(state, next);
    }
  }
  async function runJob(state, job) {
    let result = null;
    try { result = await sampleImage(state, job.item); } catch (error) { result = null; }
    state.jobsRunning--;
    state.jobs.delete(job.key);
    if (!state.dead) {
      const img = job.item.img;
      if (result) {
        state.imageCache.delete(job.key); state.imageCache.set(job.key, result);
        while (state.imageCache.size > IMAGE_CACHE) state.imageCache.delete(state.imageCache.keys().next().value);
        state.perf.images = (state.perf.images || 0) + 1;
      } else if (state.phase !== 'exiting' && img.isConnected && img.complete) {
        state.imageFailed.add(job.key);         // unreadable after all: it keeps the CSS treatment
        if (state.waiting.has(img)) dropImageRule(state, img);
      }
    }
    job.resolve(result);
    if (state.dead) return;
    pumpJobs(state);
    schedule(state);
  }

  /*
   * Freeze a list into GPU-ready arrays, sorted by grid cell (row-major over the group's
   * bounding box) so that the wind's neighbourhood is a few contiguous index ranges.
   */
  // (In slices: a band of a long page holds tens of thousands of particles, and the first
  // freezes of a page run before the code is optimised. Resolves null if live() turns false.)
  async function freeze(state, list, lines, live) {
    const n = list.n; const f = list.f;
    let began = performance.now();
    const breathe = async () => {
      if (performance.now() - began < SLICE_MS) return true;
      noteSlice(state, performance.now() - began, 'freeze');
      await nextTask();
      began = performance.now();
      return live();
    };
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = f[i * 8]; const y = f[i * 8 + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!n) { minX = minY = 0; maxX = maxY = 1; }
    const gx0 = Math.floor(minX / CELL) * CELL; const gy0 = Math.floor(minY / CELL) * CELL;
    const cols = Math.floor((maxX - gx0) / CELL) + 1; const rows = Math.floor((maxY - gy0) / CELL) + 1;
    const cellOf = new Int32Array(n); const counts = new Int32Array(cols * rows + 1);
    for (let i = 0; i < n; i++) {
      if ((i & 4095) === 4095 && !(await breathe())) return null;
      const cx = clamp(Math.floor((f[i * 8] - gx0) / CELL), 0, cols - 1);
      const cy = clamp(Math.floor((f[i * 8 + 1] - gy0) / CELL), 0, rows - 1);
      cellOf[i] = cy * cols + cx; counts[cellOf[i] + 1]++;
    }
    for (let k = 1; k <= cols * rows; k++) counts[k] += counts[k - 1];
    const cellStart = counts.slice();
    const fill = counts.slice(0, cols * rows);
    const statics = new Float32Array(n * 6);       // x, y, seed, size, link, font
    const colours = new Uint8ClampedArray(n * 8);  // day rgba, night rgba
    const rowY = new Float32Array(n);              // y that times the sweep (the line's middle, or own y)
    // The colours move as two 32-bit words per particle.
    const from32 = new Uint32Array(list.c.buffer, list.c.byteOffset, list.c.length >> 2);
    const to32 = new Uint32Array(colours.buffer);
    for (let i = 0; i < n; i++) {
      if ((i & 4095) === 4095 && !(await breathe())) return null;
      const to = fill[cellOf[i]]++;
      const k = i * 8; const s6 = to * 6;
      statics[s6] = f[k]; statics[s6 + 1] = f[k + 1]; statics[s6 + 2] = f[k + 2];
      statics[s6 + 3] = f[k + 3]; statics[s6 + 4] = f[k + 4]; statics[s6 + 5] = f[k + 5];
      to32[to * 2] = from32[i * 2]; to32[to * 2 + 1] = from32[i * 2 + 1];
      const tag = f[k + 6];
      rowY[to] = tag >= 0 ? lines[tag].mid : -1 - tag;
    }
    noteSlice(state, performance.now() - began, 'freeze');
    return { n, statics, colours, rowY, cellStart, cols, rows, gx0, gy0, x0: minX, y0: minY, x1: maxX, y1: maxY };
  }

  /* ---------------------------------------------------------------------------
   * WebGL renderer: one program; one draw call per group of points
   * ------------------------------------------------------------------------- */
  const VERTEX = `
precision highp float;
attribute vec2 aHome;
attribute vec4 aMeta;   // seed, size (css px), link id (0: none), font size (css px; negative: a soft star)
attribute vec4 aDay;    // colour on the day page, premultiplied in the shader
attribute vec4 aNight;  // colour on the night ground
attribute vec2 aOff;    // wind displacement (CPU, sparse)
attribute vec2 aDelay;  // start of this particle's line: enter, exit (s)
uniform vec4 uView;     // viewport w, h (css px)
uniform vec4 uGroup;    // the group's origin in the viewport (x, y), its share of the scroll lag, alpha
uniform vec4 uClock;    // shimmer time, shimmer amplitude, night mix, scroll lag
uniform vec3 uPhase;    // time since the enter began, since the exit began (<0: not leaving), dpr
uniform vec4 uHover;    // link id, amount; previous link id, amount
uniform vec4 uRing[${RING_MAX}];  // x, y (viewport), age (s), strength
varying vec4 vColour;
varying vec3 vDot;      // radius (a soft star: its gaussian width), sprite size (device px), soft
void main() {
  float seed = aMeta.x;
  float h1 = fract(seed * 7.13 + 0.17);
  float h2 = fract(seed * 13.71 + 0.53);
  float h3 = fract(seed * 31.37 + 0.71);
  float e = clamp((uPhase.x - aDelay.x) / ${ENTER_DUR.toFixed(3)}, 0.0, 1.0);
  float x = uPhase.y < 0.0 ? 0.0 : clamp((uPhase.y - aDelay.y) / ${EXIT_DUR.toFixed(3)}, 0.0, 1.0);
  float home = 1.0 - smoothstep(0.0, 0.7, x);         // the exit pulls every displacement home
  float angle = seed * 6.2831853;
  vec2 dir = vec2(cos(angle), sin(angle) - 0.5);       // dust lifts a little
  float reach = abs(aMeta.w) * (0.15 + 0.5 * h1);
  float puff = 6.75 * e * (1.0 - e) * (1.0 - e);        // out fast, settle slowly (peak at e = 1/3)
  float stir = 0.18 * sin(3.14159265 * min(x / 0.7, 1.0));
  vec2 base = aHome + uGroup.xy;
  vec2 p = base + aOff * home + dir * reach * (puff * home + stir);
  float glow = 0.0;
  for (int k = 0; k < ${RING_MAX}; k++) {
    vec4 r = uRing[k];
    vec2 d = base - r.xy;
    float dist = length(d) + 0.001;
    float q = (dist - r.z * ${RING_SPEED.toFixed(1)}) / ${RING_WIDTH.toFixed(1)};
    float g = r.w * exp(-q * q - r.z / ${RING_DECAY.toFixed(3)}) / (1.0 + dist / 600.0);
    p += d / dist * g * ${RING_PUSH.toFixed(1)};
    glow += g;
  }
  // Scroll: the grains lag by an amount that grows down the screen, like sand.
  float lag = clamp(0.25 + 0.55 * p.y / uView.y + 0.2 * h2, 0.0, 1.0) * uGroup.z;
  vec2 s = vec2(p.x, p.y - uClock.w * lag);
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
  vec4 c = mix(aDay, aNight, uClock.z);
  float hover = (abs(aMeta.z - uHover.x) < 0.5 ? uHover.y : 0.0) + (abs(aMeta.z - uHover.z) < 0.5 ? uHover.w : 0.0);
  hover *= uClock.z;
  c.rgb = mix(c.rgb, vec3(1.0), 0.45 * hover);
  float a = c.a * (1.0 + uClock.y * sin(uClock.x * (0.5 + 0.9 * h2) + h3 * 6.2831853));
  a *= smoothstep(0.0, 0.15, e) * (1.0 - smoothstep(0.6, 1.0, x)) * (1.0 - 0.3 * puff) * uGroup.w;
  a = min(1.0, a * (1.0 + 0.5 * hover) + 0.3 * glow * uGroup.w);
  float size = aMeta.y * (1.0 + 0.35 * (1.0 - smoothstep(0.0, 0.3, e)) + 0.35 * smoothstep(0.3, 0.85, x) + 0.15 * hover);
  // An antialiased disc at its sub-pixel position: the sprite has a pixel of margin.
  float radius = 0.5 * size * uPhase.z;
  if (aMeta.w < 0.0) {
    // A photo's grain is a soft star: a gaussian with the light of the disc it replaces,
    // never narrower than STAR_MIN device px (a smaller one gives up brightness instead).
    float width = max(radius * ${STAR_WIDTH.toFixed(2)}, ${STAR_MIN.toFixed(2)});
    a *= min(1.0, radius * radius / (width * width));
    gl_PointSize = 2.0 * ceil(2.2 * width) + 1.0;
    vDot = vec3(width, gl_PointSize, 1.0);
  } else {
    gl_PointSize = 2.0 * radius + 2.0;
    vDot = vec3(radius, gl_PointSize, 0.0);
  }
  vColour = vec4(c.rgb * a, a);
}`;
  const FRAGMENT = `
precision mediump float;
varying vec4 vColour;
varying vec3 vDot;
void main() {
  // Coverage of a disc of radius vDot.x by this pixel (a one-pixel ramp at the rim);
  // discs smaller than a pixel give up brightness instead of size.
  float d = length(gl_PointCoord - 0.5) * vDot.y;
  float cover = vDot.z > 0.5 ? exp(-d * d / (vDot.x * vDot.x)) : clamp(vDot.x + 0.5 - d, 0.0, 1.0) * min(1.0, 2.0 * vDot.x);
  gl_FragColor = vColour * cover;
}`;

  function glRenderer(canvas) {
    const options = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', options);
    const v2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
    if (!gl) return null;
    const shader = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const attr = name => gl.getAttribLocation(program, name);
    const A = { home: attr('aHome'), meta: attr('aMeta'), day: attr('aDay'), night: attr('aNight'), off: attr('aOff'), delay: attr('aDelay') };
    for (const loc of Object.values(A)) if (loc >= 0) gl.enableVertexAttribArray(loc);
    const U = {};
    for (const name of ['uView', 'uGroup', 'uClock', 'uPhase', 'uHover', 'uRing']) U[name] = gl.getUniformLocation(program, name);
    const pointer = (buffer, loc, size, type, normalised, stride, offset) => {
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(loc, size, type, normalised, stride, offset);
    };
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied "over"
    gl.clearColor(0, 0, 0, 0);
    const array = (data, usage) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b; };
    return {
      kind: v2 ? 'webgl2' : 'webgl1',
      // A group's buffers: statics and colours once, offsets and delays as they change.
      create(group) {
        const d = group.data;
        group.buf = {
          statics: array(d.statics, gl.STATIC_DRAW), colours: array(d.colours, gl.STATIC_DRAW),
          off: array(group.off, gl.DYNAMIC_DRAW), delay: array(group.delays, gl.DYNAMIC_DRAW)
        };
      },
      release(group) {
        if (!group.buf) return;
        for (const b of Object.values(group.buf)) gl.deleteBuffer(b);
        group.buf = null;
      },
      uploadDelays(group) {
        if (!group.buf) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, group.buf.delay); gl.bufferSubData(gl.ARRAY_BUFFER, 0, group.delays);
      },
      // Only the disturbed range of a group's offsets goes to the GPU.
      uploadOffsets(group, lo, hi) {
        if (!group.buf) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, group.buf.off);
        if (v2) gl.bufferSubData(gl.ARRAY_BUFFER, lo * 8, group.off, lo * 2, (hi - lo + 1) * 2);
        else gl.bufferSubData(gl.ARRAY_BUFFER, lo * 8, group.off.subarray(lo * 2, (hi + 1) * 2));
      },
      begin(u) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.SCISSOR_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform4f(U.uView, u.w, u.h, 0, 0);
        gl.uniform4f(U.uClock, u.time, u.shimmer, u.night, u.lag);
        gl.uniform3f(U.uPhase, u.enterT, u.exitT, u.dpr);
        gl.uniform4f(U.uHover, u.hoverId, u.hoverAmount, u.prevId, u.prevAmount);
        gl.uniform4fv(U.uRing, u.rings);
      },
      draw(group, u) {
        const b = group.buf; if (!b || !group.data.n) return;
        pointer(b.statics, A.home, 2, gl.FLOAT, false, 24, 0);
        pointer(b.statics, A.meta, 4, gl.FLOAT, false, 24, 8);
        pointer(b.colours, A.day, 4, gl.UNSIGNED_BYTE, true, 8, 0);
        pointer(b.colours, A.night, 4, gl.UNSIGNED_BYTE, true, 8, 4);
        pointer(b.off, A.off, 2, gl.FLOAT, false, 8, 0);
        pointer(b.delay, A.delay, 2, gl.FLOAT, false, 8, 0);
        gl.uniform4f(U.uGroup, group.origin.x, group.origin.y, group.lagShare, group.alpha);
        const c = group.clip;
        if (c) {
          // The scissor box is in device pixels from the bottom-left.
          const k = u.dpr; const x0 = Math.max(0, Math.floor(c.x0 * k)); const x1 = Math.min(canvas.width, Math.ceil(c.x1 * k));
          const y0 = Math.max(0, Math.floor((u.h - c.y1) * k)); const y1 = Math.min(canvas.height, Math.ceil((u.h - c.y0) * k));
          if (x1 <= x0 || y1 <= y0) return;
          gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
        } else {
          gl.disable(gl.SCISSOR_TEST);
        }
        gl.drawArrays(gl.POINTS, 0, group.data.n);
      },
      // Clear a box (viewport css px) of everything drawn so far.
      occlude(c, u) {
        const k = u.dpr; const x0 = Math.max(0, Math.floor(c.x0 * k)); const x1 = Math.min(canvas.width, Math.ceil(c.x1 * k));
        const y0 = Math.max(0, Math.floor((u.h - c.y1) * k)); const y1 = Math.min(canvas.height, Math.ceil((u.h - c.y0) * k));
        if (x1 <= x0 || y1 <= y0) return;
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0); gl.clear(gl.COLOR_BUFFER_BIT);
      },
      end() {},
      clear() { gl.viewport(0, 0, canvas.width, canvas.height); gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT); },
      lost: () => gl.isContextLost(),
      dispose(groups) {
        for (const group of groups) this.release(group);
        gl.deleteProgram(program);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    };
  }

  /*
   * Canvas2D fallback: plots the particles of the visible part of each group into an
   * ImageData at DPR 1 (wind, scroll lag, fades and colours; no puff, rings or shimmer).
   */
  function pixelRenderer(canvas) {
    const g = canvas.getContext('2d');
    if (!g) return null;
    let image = null; let pixels = null;
    return {
      kind: 'canvas2d',
      create() {}, release() {}, uploadDelays() {}, uploadOffsets() {},
      begin() {
        const w = canvas.width; const h = canvas.height;
        if (!image || image.width !== w || image.height !== h) { image = g.createImageData(w, h); pixels = new Uint32Array(image.data.buffer); }
        pixels.fill(0);
      },
      draw(group, u) {
        const d = group.data; if (!d.n) return;
        const w = canvas.width; const h = canvas.height; const off = group.off; const delays = group.delays;
        const ox = group.origin.x; const oy = group.origin.y - u.lag * 0.5 * group.lagShare;
        const c = group.clip || { x0: 0, y0: 0, x1: w, y1: h };
        const r0 = clamp(Math.floor((-oy - d.gy0 - LAG_MAX) / CELL) - 1, 0, d.rows - 1);
        const r1 = clamp(Math.ceil((h - oy - d.gy0 + LAG_MAX) / CELL) + 1, 0, d.rows - 1);
        const from = d.cellStart[r0 * d.cols]; const to = d.cellStart[(r1 + 1) * d.cols];
        const n = u.night; const col = d.colours;
        for (let i = from; i < to; i++) {
          const e = clamp((u.enterT - delays[i * 2]) / ENTER_DUR, 0, 1);
          const x = u.exitT < 0 ? 0 : clamp((u.exitT - delays[i * 2 + 1]) / EXIT_DUR, 0, 1);
          const k = i * 8;
          let a = ((col[k + 3] + (col[k + 7] - col[k + 3]) * n) / 255) * smooth(0, 0.15, e) * (1 - smooth(0.6, 1, x)) * group.alpha;
          if (a < 0.02) continue;
          const home = 1 - smooth(0, 0.7, x);
          const px = Math.round(d.statics[i * 6] + off[i * 2] * home + ox);
          const py = Math.round(d.statics[i * 6 + 1] + off[i * 2 + 1] * home + oy);
          if (px < c.x0 || py < c.y0 || px >= c.x1 || py >= c.y1 || px < 0 || py < 0 || px >= w || py >= h) continue;
          const hover = (d.statics[i * 6 + 4] === u.hoverId ? u.hoverAmount : 0) * n;
          a = Math.min(1, a * (1 + 0.5 * hover));
          const mix = ch => (col[k + ch] + (col[k + 4 + ch] - col[k + ch]) * n) * (1 - 0.45 * hover) + 255 * 0.45 * hover;
          const p = py * w + px; const old = pixels[p]; const keep = 1 - a;
          const rr = mix(0) * a + (old & 255) * keep; const gg = mix(1) * a + ((old >>> 8) & 255) * keep;
          const bb = mix(2) * a + ((old >>> 16) & 255) * keep; const aa = 255 * a + (old >>> 24) * keep;
          pixels[p] = ((aa & 255) << 24 | (bb & 255) << 16 | (gg & 255) << 8 | (rr & 255)) >>> 0;
        }
      },
      occlude(c) {
        const w = canvas.width; const h = canvas.height;
        const x0 = clamp(Math.floor(c.x0), 0, w); const x1 = clamp(Math.ceil(c.x1), 0, w);
        for (let y = clamp(Math.floor(c.y0), 0, h); y < clamp(Math.ceil(c.y1), 0, h); y++) pixels.fill(0, y * w + x0, y * w + x1);
      },
      end() { g.putImageData(image, 0, 0); },
      clear() { g.clearRect(0, 0, canvas.width, canvas.height); },
      lost: () => false,
      dispose() { image = null; pixels = null; }
    };
  }

  /* ---------------------------------------------------------------------------
   * Groups: a band of the document, or a box that follows its own container
   * ------------------------------------------------------------------------- */
  // Word lists for a band (text in flow whose middle falls in it) or a box (its text),
  // measured in slices. Resolves null if the build stopped.
  async function groupWords(state, model, spec, pause) {
    const words = [];
    const entries = spec.kind === 'band' ? model.entries : spec.box.entries;
    const y0 = spec.y0; const y1 = spec.y1;
    for (const entry of entries) {
      if (spec.kind === 'band') {
        if (entry.top > y1 + 40) break;
        if (entry.bottom < y0 - 40) continue;
      }
      for (const w of wordsOf(state, model, entry)) if (spec.kind !== 'band' || (w.mid >= y0 && w.mid < y1)) words.push(w);
      if (await pause()) return null;
    }
    return words;
  }

  // Build (or confirm) one group, in slices. Resolves with the group, or null if stopped.
  async function buildGroup(state, model, spec, old) {
    let began = state.sliceAt = performance.now();
    const pause = async () => {
      const spent = performance.now() - began;
      if (spent < SLICE_MS) return false;
      noteSlice(state, spent, 'words');
      await nextTask();
      began = state.sliceAt = performance.now();
      return state.dead || state.gen !== model.gen || state.phase === 'exiting';
    };
    const words = await groupWords(state, model, spec, pause);
    if (!words) return null;
    const lines = groupLines(words);
    const sig = signature(words);
    if (old && old.sig === sig && old.data) {
      // Nothing it draws has changed: keep the particles, take the fresh word records.
      old.gen = model.gen; old.words = words; old.lines = lines; old.spec = spec; old.stale = false;
      if (spec.kind === 'box') old.box = spec.box;
      return old;
    }
    const random = seeded(spec.kind === 'band' ? 0x5eed + spec.k : hashString(spec.key));
    const list = particleList();
    for (let i = 0; i < words.length;) {
      i = samplePass(words, i, list, random);
      if (i < words.length && await pause()) return null;
    }
    // The freeze starts a slice of its own (a band of a long page holds tens of thousands).
    noteSlice(state, performance.now() - began, 'words');
    await nextTask();
    began = state.sliceAt = performance.now();
    if (state.dead || state.gen !== model.gen || state.phase === 'exiting') return null;
    const data = await freeze(state, list, lines, () => !(state.dead || state.gen !== model.gen || state.phase === 'exiting'));
    if (!data) return null;
    // The upload that follows starts a slice of its own.
    await nextTask();
    state.sliceAt = performance.now();
    if (state.dead || state.gen !== model.gen || state.phase === 'exiting') return null;
    return makeGroup(spec, model, data, { sig, words, lines });
  }

  // A group record: its particles, their motion state, and where it is drawn.
  function makeGroup(spec, model, data, fields) {
    const n = data.n; const box = spec.kind === 'image' ? spec.item.box : spec.box || null;
    const group = {
      key: spec.key, kind: spec.kind, spec, k: spec.k, box, gen: model.gen, image: null, ...fields, data,
      off: new Float32Array(n * 2), vel: new Float32Array(n * 2), delays: new Float32Array(n * 2),
      awake: new Uint8Array(n), awakeList: new Int32Array(n), awakeCount: 0,
      buf: null, bornAt: performance.now(), fade: 0, alpha: 1,
      origin: { x: 0, y: 0 }, clip: null, visible: false, lagShare: box ? box.lagShare : 1
    };
    for (let i = 0; i < n; i++) group.delays[i * 2] = -10;
    return group;
  }

  // An image's group: its sampled particles (from the cache) translated to where it is now.
  // It belongs to the band or the box that holds it: placed, clipped and scrolled with it.
  async function imageGroup(state, model, spec, result) {
    const item = spec.item; const from = result.list;
    const list = { n: from.n, f: from.f.slice(0, from.n * 8), c: from.c.slice(0, from.n * 8) };
    for (let i = 0, k = 0; i < list.n; i++, k += 8) {
      list.f[k] += item.x; list.f[k + 1] += item.y;
      list.f[k + 4] = item.link; list.f[k + 6] = -1 - list.f[k + 1];   // its own row times its sweep
    }
    if (item.frame) frameParticles(state, item, list);
    const data = await freeze(state, list, [], () => !(state.dead || state.gen !== model.gen || state.phase === 'exiting'));
    state.sliceAt = performance.now();
    return data && makeGroup(spec, model, data, { sig: spec.sig, words: [], lines: [], image: item, imageKind: result.kind, step: result.step, lightGround: !!result.lightGround });
  }

  // An image's own border (a project thumbnail's hairline frame) goes with the image when it
  // is hidden: it is drawn as a faint line of dust along the middle of each side, so the
  // picture keeps its edge on the night.
  function frameParticles(state, item, list) {
    const random = seeded(hashString(`${item.gkey}|frame`));
    const { sides, pad } = item.frame;
    const [t, r, b, l] = sides.map(side => (side ? side.w : 0));
    // The border box around the content box, in the group's coordinates.
    const x0 = item.x - pad[3] - l; const x1 = item.x + item.w + pad[1] + r;
    const y0 = item.y - pad[0] - t; const y1 = item.y + item.h + pad[2] + b;
    const lines = [[x0, y0 + t / 2, x1, y0 + t / 2], [x1 - r / 2, y0, x1 - r / 2, y1], [x0, y1 - b / 2, x1, y1 - b / 2], [x0 + l / 2, y0, x0 + l / 2, y1]];
    sides.forEach((side, k) => {
      if (!side) return;
      const [ax, ay, bx, by] = lines[k];
      const length = Math.hypot(bx - ax, by - ay); const n = Math.max(2, Math.round(length / FRAME_GAP));
      const day = side.c.slice(0, 3); const night = nightColour(day, false, !state.light, true);
      const alpha = side.c[3] * item.opacity;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5 + (random() - 0.5) * 0.6) / n; const across = (random() - 0.5) * 0.5;
        const x = ax + (bx - ax) * u + (k % 2 ? across : 0); const y = ay + (by - ay) * u + (k % 2 ? 0 : across);
        pushParticle(list, x, y, random(), SIZE_MIN * (1 + 0.2 * random()), item.link, GRAPHIC_FONT, -1 - y, day, night,
          alpha * FRAME_ALPHA * (1 - GRAIN * random()), alpha);
      }
    });
  }

  // The groups the window needs, nearest first: bands in reach of the viewport, and boxes.
  function neededGroups(state, model) {
    const H = state.H; const sy = window.scrollY;
    const top = sy - BUILD_SCREENS * H; const bottom = sy + H + BUILD_SCREENS * H;
    const centre = sy + H / 2;
    // Distance: the gap between a group and the viewport (0 on screen), shorter ahead of the
    // scroll than behind it; ties go to the centre.
    const ahead = state.scrollDir || 1;
    const gap = (a, b) => {
      const below = a - (sy + H); const above = sy - b;
      if (below > 0) return below * (ahead > 0 ? 0.6 : 1.4);
      if (above > 0) return above * (ahead < 0 ? 0.6 : 1.4);
      return 0;
    };
    const near = (a, b) => Math.abs((a + b) / 2 - centre);
    const specs = [];
    const k0 = Math.max(0, Math.floor(top / BAND_H)); const k1 = Math.floor(Math.min(bottom, model.docH + BAND_H) / BAND_H);
    for (let k = k0; k <= k1; k++) {
      const y0 = k * BAND_H; const y1 = y0 + BAND_H;
      specs.push({ kind: 'band', key: `b${k}`, k, y0, y1, distance: gap(y0, y1), order: near(y0, y1) });
    }
    const boxId = box => {
      let id = state.boxIds.get(box.el);
      if (!id) { id = ++state.boxCount; state.boxIds.set(box.el, id); }
      return id;
    };
    for (const box of model.boxes.values()) {
      if (!box.el.isConnected || !box.entries.length) continue;
      const fixedTop = box.fixed ? sy : box.top; const fixedBottom = box.fixed ? sy + H : box.bottom;
      if (fixedBottom < top || fixedTop > bottom) continue;
      specs.push({ kind: 'box', key: `x${boxId(box)}`, box, distance: gap(fixedTop, fixedBottom), order: near(Math.max(fixedTop, top), Math.min(fixedBottom, bottom)) });
    }
    // Images: a group each, in reach like the text around them.
    for (const item of model.images) {
      if (item.bottom < top || item.top > bottom) continue;
      const sig = `${item.key}|${Math.round(item.x * 4)},${Math.round(item.y * 4)}|${item.link}|${item.box ? boxId(item.box) : 0}`;
      specs.push({ kind: 'image', key: item.gkey, item, sig, distance: gap(item.top, item.bottom), order: near(item.top, item.bottom) });
    }
    specs.sort((a, b) => a.distance - b.distance || a.order - b.order);
    return specs;
  }

  // A new group in the window (it fades in), or a re-sampled one in place of the old.
  function addGroup(state, group, replaced, fade) {
    if (replaced) removeGroup(state, replaced);
    if (state.renderer) state.renderer.create(group);
    // (No fade while an arrival rests: no frame would carry it, so it shows at once; except
    // for the stars of an image that waited for them under the night, which end the rest:
    // the page's first paint is light without its images.)
    const waited = !!group.image && state.waiting.has(group.image.img);
    group.fade = fade && !replaced && !state.ctx.motion.matches && (waited || !resting(state)) ? (waited ? WAIT_FADE : GROUP_FADE) : 0;
    if (waited) { state.waiting.delete(group.image.img); if (group.fade && resting(state)) state.restBroken = true; }
    group.bornAt = performance.now();
    state.groups.set(group.key, group);
    state.particles += group.data.n;
    state.dirty = true;
    if (group.image) {
      // The filter its image's rule carries (an existing rule takes it at once).
      const img = group.image.img; const base = imageBase(state, group);
      if (base) state.imageBases.set(img, base); else state.imageBases.delete(img);
      const entry = state.imageRules.get(img);
      if (entry) setImageRule(state, img, entry.css);
    }
  }
  function removeGroup(state, group) {
    group.stale = true;                  // (its ink sprites, if any, are not drawn either)
    if (state.groups.get(group.key) === group) state.groups.delete(group.key);
    state.particles -= group.data ? group.data.n : 0;
    if (state.renderer) state.renderer.release(group);
    group.data = null;
  }

  /*
   * The builder: one at a time, brings the window up to date with the model (new bands,
   * re-measured groups after a change), nearest first, under the particle cap, and evicts
   * far groups. Re-run whenever the window or the content changes.
   */
  function schedule(state) {
    // (Before the swap, prepare() builds what is on screen itself.)
    if (state.dead || state.phase === 'exiting' || state.phase === 'build') return;
    state.buildWanted = true;
    if (!state.building) runBuilder(state);
  }
  async function runBuilder(state) {
    state.building = true;
    try {
      while (state.buildWanted && !state.dead && state.phase !== 'exiting') {
        state.buildWanted = false;
        if (!state.model || state.modelStale) {
          state.modelStale = false;
          const m0 = performance.now();
          const model = await buildModel(state);
          state.perf.models = (state.perf.models || 0) + 1; state.perf.modelMs = performance.now() - m0;
          if (!model) { state.buildWanted = true; continue; }
          state.model = model;
          syncImageRules(state, model);
          markStale(state, model);
        }
        await fillWindow(state, state.model, true);
      }
    } finally {
      state.building = false;
    }
  }
  async function fillWindow(state, model, fade) {
    const specs = neededGroups(state, model);
    const needed = new Set(specs.map(spec => spec.key));
    // Evict first what lies beyond reach (or whose container or image is gone) ...
    const sy = window.scrollY; const H = state.H;
    const keepTop = sy - KEEP_SCREENS * H; const keepBottom = sy + H + KEEP_SCREENS * H;
    const evict = force => {
      const far = [...state.groups.values()].filter(group => !needed.has(group.key))
        .map(group => { const [top, bottom] = groupSpan(group); return { group, top, bottom, d: Math.max(top - sy, sy - bottom) }; })
        .sort((a, b) => b.d - a.d);
      for (const { group, top, bottom } of far) {
        const gone = (group.kind === 'box' && !group.box.el.isConnected) || (group.kind === 'image' && !model.imageKeys.has(group.key));
        if (gone || bottom < keepTop || top > keepBottom || (force && state.particles > PARTICLE_CAP)) removeGroup(state, group);
      }
    };
    evict(false);
    // ... start decoding the images the window needs that are not sampled yet (nearest
    // first; jobs no longer needed are dropped before they run) ...
    for (const job of state.jobs.values()) job.wanted = false;
    for (const spec of specs) {
      if (spec.kind !== 'image') continue;
      const old = state.groups.get(spec.key);
      if (!(old && old.sig === spec.sig)) requestImage(state, spec.item, spec.distance);
    }
    for (const [key, job] of state.jobs) if (!job.running && !job.wanted) { state.jobs.delete(key); job.resolve(null); }
    // ... then build the window, nearest first. Near the cap a farther group (behind the
    // scroll, usually) makes room for a nearer one, or the window stops growing.
    const distanceOf = new Map(specs.map(spec => [spec.key, spec.distance]));
    for (const spec of specs) {
      if (state.dead || state.phase === 'exiting' || state.gen !== model.gen) return;
      const old = state.groups.get(spec.key) || null;
      if (old && old.gen === model.gen) continue;
      let result = null;
      if (spec.kind === 'image') {
        // The same image in the same place: keep it. Otherwise it waits for its job (the old
        // particles stay until then).
        if (old && old.sig === spec.sig) {
          if (old.stale) { old.stale = false; state.dirty = true; show(state); }
          old.gen = model.gen; old.spec = spec; old.image = spec.item; old.box = spec.item.box;
          continue;
        }
        result = state.imageCache.get(spec.item.key);
        if (!result) continue;
      }
      while (!old && spec.distance > 0 && state.particles > PARTICLE_CAP * 0.88) {
        let farthest = null; let far = spec.distance;
        for (const group of state.groups.values()) {
          const d = distanceOf.has(group.key) ? distanceOf.get(group.key) : Infinity;
          if (d > far) { far = d; farthest = group; }
        }
        if (!farthest) break;
        removeGroup(state, farthest);
      }
      if (!old && spec.distance > 0 && state.particles > PARTICLE_CAP * 0.88) break;
      const b0 = performance.now();
      if (result) state.sliceAt = b0;
      const group = result ? await imageGroup(state, model, spec, result) : await buildGroup(state, model, spec, old);
      if (!group || state.dead || state.gen !== model.gen) return;
      if (group !== old) {
        state.perf.builds = (state.perf.builds || 0) + 1; state.perf.buildWall = (state.perf.buildWall || 0) + performance.now() - b0;
        addGroup(state, group, state.groups.get(spec.key) || null, fade);
        // Built while the lens enters: text settles at once; an image joins the sweep (one
        // the sweep has passed already dissolves in a sweep of its own, from its top, now).
        const late = state.phase === 'entering' && group.image ? lateSweep(state, group) : false;
        const joins = late !== false;
        if (state.phase === 'entering') enterDelays(state, group, !joins, late);
        if (joins) group.fade = 0;
        if (group.image) imageShown(state, group, joins, late);
      }
      if (state.particles > PARTICLE_CAP) trimToCap(state);
      // The slice that finished this group (freeze and upload included).
      noteSlice(state, performance.now() - state.sliceAt, 'group');
      await nextTask();
      show(state);
    }
  }
  /*
   * A new model: the groups whose words or image moved since they were sampled (photos that
   * loaded into the masonry, a <details> that opened above) stop being drawn at once, until
   * the builder brings their replacements, so no text is ever drawn where it no longer is. A
   * few words per group are measured again (the first, the last and two between); a group
   * whose words still sit where they were is kept as it is.
   */
  function markStale(state, model) {
    const range = state.range || (state.range = document.createRange());
    const sx = window.scrollX; const sy = window.scrollY;
    const items = model ? new Map(model.images.map(item => [item.gkey, item])) : null;
    let hidden = 0;
    for (const group of state.groups.values()) {
      if (group.stale || !group.data) continue;
      let moved = false;
      if (group.image && items) {
        const item = items.get(group.key);
        moved = !item || item.key !== group.image.key || Math.abs(item.x - group.image.x) > 1 || Math.abs(item.y - group.image.y) > 1;
      } else if (group.image) {
        // (Without a new model: where its image is now.)
        const item = group.image; const img = item.img;
        const origin = item.box ? (item.box.el.isConnected ? boxOrigin(item.box.el) : null) : { x: -sx, y: -sy };
        const r = img.getBoundingClientRect();
        moved = !origin || !img.isConnected || Math.abs(r.left + item.inset[0] - origin.x - item.x) > 1 || Math.abs(r.top + item.inset[1] - origin.y - item.y) > 1 ||
          Math.abs(r.width - item.border[0]) > 1 || Math.abs(r.height - item.border[1]) > 1;
      } else if (group.words.length) {
        const words = group.words; const n = words.length;
        const origin = group.box ? (group.box.el.isConnected ? boxOrigin(group.box.el) : null) : { x: -sx, y: -sy };
        for (const i of new Set([0, n - 1, n >> 1, n >> 2])) {
          const w = words[i];
          if (w.marker) {
            // (A list marker: where its item is.)
            const r = w.marker.isConnected && origin ? w.marker.getBoundingClientRect() : null;
            if (!r || Math.abs(r.left - origin.x - w.ref[0]) > 1 || Math.abs(r.top - origin.y - w.ref[1]) > 1) { moved = true; break; }
            continue;
          }
          if (!origin || !w.node.isConnected || w.to > w.node.length) { moved = true; break; }
          range.setStart(w.node, w.from); range.setEnd(w.node, w.to);
          const r = range.getBoundingClientRect();
          if (Math.abs(r.left - origin.x - w.x) > 1 || Math.abs(r.top - origin.y - w.y) > 1) { moved = true; break; }
        }
      }
      if (moved) { group.stale = true; hidden++; }
    }
    if (hidden) { state.dirty = true; show(state); }
    return hidden;
  }

  // Over the cap: drop the groups farthest from the viewport, never one on screen.
  function trimToCap(state) {
    const sy = window.scrollY; const H = state.H;
    const far = [...state.groups.values()]
      .map(group => { const [top, bottom] = groupSpan(group); return { group, d: Math.max(top - (sy + H), sy - bottom) }; })
      .filter(item => item.d > 0).sort((a, b) => b.d - a.d);
    for (const { group } of far) { if (state.particles <= PARTICLE_CAP) break; removeGroup(state, group); }
  }
  // A group's extent in document y (for eviction).
  function groupSpan(group) {
    if (group.kind === 'band') return [group.spec.y0, group.spec.y1];
    if (group.box) {
      if (group.box.fixed) return [-Infinity, Infinity];
      const r = group.box.el.getBoundingClientRect();
      return [r.top + window.scrollY, r.bottom + window.scrollY];
    }
    return [group.image.top, group.image.bottom];
  }

  // Where each group is this frame: its origin in the viewport, clip and visibility. A band
  // and an image in the page's flow follow the page; a box, and an image in it, follow the box.
  function placeGroups(state) {
    const W = state.W; const H = state.H; const sx = window.scrollX; const sy = window.scrollY;
    const now = performance.now();
    for (const group of state.groups.values()) {
      const d = group.data; if (!d) continue;
      if (!group.box) {
        group.origin.x = -sx; group.origin.y = -sy; group.clip = null; group.cover = null;
        group.visible = d.y1 - sy > -LAG_MAX - 20 && d.y0 - sy < H + LAG_MAX + 20 && d.x1 - sx > -20 && d.x0 - sx < W + 20;
      } else {
        const el = group.box.el;
        if (!el.isConnected) { group.visible = false; continue; }
        const o = boxOrigin(el);
        group.origin.x = o.x; group.origin.y = o.y;
        let clip = null;
        for (const c of group.box.clipEls) {
          const r = c.getBoundingClientRect();
          const box = { x0: r.left + c.clientLeft, y0: r.top + c.clientTop, x1: r.left + c.clientLeft + c.clientWidth, y1: r.top + c.clientTop + c.clientHeight };
          clip = clip ? { x0: Math.max(clip.x0, box.x0), y0: Math.max(clip.y0, box.y0), x1: Math.min(clip.x1, box.x1), y1: Math.min(clip.y1, box.y1) } : box;
        }
        group.clip = clip;
        if (group.box.occludes) {
          const r = el.getBoundingClientRect();
          let c = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
          if (clip) c = { x0: Math.max(c.x0, clip.x0), y0: Math.max(c.y0, clip.y0), x1: Math.min(c.x1, clip.x1), y1: Math.min(c.y1, clip.y1) };
          group.cover = c;
        } else {
          group.cover = null;
        }
        const x0 = d.x0 + o.x; const x1 = d.x1 + o.x; const y0 = d.y0 + o.y; const y1 = d.y1 + o.y;
        group.visible = y1 > -LAG_MAX - 20 && y0 < H + LAG_MAX + 20 && x1 > -20 && x0 < W + 20 &&
          (!clip || (clip.x1 > clip.x0 && clip.y1 > clip.y0 && clip.y1 > 0 && clip.y0 < H));
      }
      group.alpha = group.fade > 0 ? clamp((now - group.bornAt) / 1000 / group.fade, 0, 1) : 1;
    }
  }

  // Enter timing for a group: line by line from the top of the viewport (or settled).
  // The moment the enter's sweep reaches a row at y (viewport px when the enter began); for
  // an image that joined late, its own sweep from its top (late: { start, top }) if later.
  function sweepDelay(state, y, late) {
    const delay = ENTER_START + ENTER_SWEEP * clamp(y / state.H, 0, 1);
    return late ? Math.max(delay, late.start + ENTER_SWEEP * clamp((y - late.top) / state.H, 0, 1)) : delay;
  }
  /*
   * On a light page the column's inversion and an image's counter-filter leave the image no
   * contrast half way (updateMasks()). So an image row the sweep has not reached by SLAB_IN
   * dissolves then (or, for an image built later, as it joins), all rows at once: a photo
   * goes out once instead of fading out at the flat moment and coming back to dissolve. And
   * leaving, an image's stars stay until SLAB_OUT, when its contrast is back: it returns once.
   * Meanwhile its night patch (drawPatches()) keeps the light page from showing through its
   * dark parts. floor: the moment an image row dissolves at the latest (enterDelays()).
   */
  function imageDelayIn(state, y, late, floor) {
    const delay = sweepDelay(state, y, late);
    return state.light && !late ? Math.min(delay, floor) : delay;
  }
  function imageDelayOut(state, y) {
    const delay = EXIT_SWEEP * clamp(y / state.H, 0, 1);
    return state.light ? Math.max(delay, SLAB_OUT) : delay;
  }
  const floorOf = (state, img) => (state.floors.has(img) ? state.floors.get(img) : SLAB_IN);
  function enterDelays(state, group, settled, late = null) {
    const d = group.data; if (!d) return;
    // (The sweep is timed by where things were when the enter began.)
    const oy = group.box ? boxOrigin(group.box.el).y + window.scrollY - state.enterScroll : -state.enterScroll;
    let delay = y => (settled ? -10 : sweepDelay(state, y + oy, late));
    if (group.image && !settled) {
      // (An image built while the lens enters joins no earlier than now.)
      const floor = Math.max(SLAB_IN, (state.phase === 'entering' ? state.enterT : 0) + 0.05);
      state.floors.set(group.image.img, floor);
      delay = y => imageDelayIn(state, y + oy, late, floor);
    }
    for (const line of group.lines) line.delayIn = delay(line.mid);
    for (let i = 0; i < d.n; i++) group.delays[i * 2] = delay(d.rowY[i]);
    state.renderer.uploadDelays(group);
  }
  function exitDelays(state, group) {
    const d = group.data; if (!d) return;
    const oy = group.origin.y; const H = state.H;
    const delay = group.image ? y => imageDelayOut(state, y + oy) : y => EXIT_SWEEP * clamp((y + oy) / H, 0, 1);
    for (const line of group.lines) line.delayOut = delay(line.mid);
    for (let i = 0; i < d.n; i++) group.delays[i * 2 + 1] = delay(d.rowY[i]);
    state.renderer.uploadDelays(group);
  }

  /* ---------------------------------------------------------------------------
   * Ink: crisp sprites of the visible words for the transitions (images dissolve under a
   * mask on the page's own image: see the image rules below)
   * ------------------------------------------------------------------------- */
  // Day and night sprites of every word on visible lines, in device pixels, so that at
  // full alpha each sprite is blitted 1:1 onto its glyphs. Per group, as placed now.
  function buildInk(state) {
    const dpr = state.dpr; const H = state.H;
    const measure = state.measure || (state.measure = makeCanvas(1, 1).getContext('2d'));
    const native = 'letterSpacing' in measure;
    const heights = [0]; let page = 0; let x = 0; let y = 0; let shelf = 0;
    const place = (w, h) => {
      if (x + w > ATLAS_W) { x = 0; y += shelf + 2; shelf = 0; }
      if (y + h > ATLAS_H) { page++; heights.push(0); x = 0; y = 0; shelf = 0; }
      const spot = [page, x, y];
      x += w + 2; shelf = Math.max(shelf, h); heights[page] = Math.max(heights[page], y + h);
      return spot;
    };
    placeGroups(state);
    const items = []; const sets = [];
    for (const group of state.groups.values()) {
      if (!group.visible) continue;
      const o = { x: group.origin.x, y: group.origin.y };
      const set = { group, origin: o, lines: [] };
      for (const line of group.lines) {
        if (line.bottom + o.y < -0.25 * H || line.top + o.y > 1.25 * H) continue;
        line.ink = [];
        for (const w of line.words) {
          const size = w.style.size;
          const left = w.x + o.x; const top = w.y + o.y;
          const padX = Math.ceil((2 + 0.3 * size) * dpr); const padY = Math.ceil((2 + 0.25 * size) * dpr);
          const ox = Math.floor(left * dpr) - padX; const oy = Math.floor(top * dpr) - padY;
          const sw = Math.ceil((left + w.width) * dpr) + padX - ox; const sh = Math.ceil((top + w.height) * dpr) + padY - oy;
          if (sw > ATLAS_W || sh > ATLAS_H) continue;
          const item = { w, left, top, ox, oy, sw, sh, day: place(sw, sh), night: place(sw, sh) };
          line.ink.push(item); items.push(item);
        }
        set.lines.push(line);
      }
      if (set.lines.length) sets.push(set);
    }
    sets.sort((a, b) => (a.group.cover ? 1 : 0) - (b.group.cover ? 1 : 0));
    const atlases = heights.map(h => makeCanvas(ATLAS_W, Math.max(1, h)));
    const contexts = atlases.map(c => c.getContext('2d'));
    for (const item of items) {
      const style = item.w.style;
      for (const [spot, colour] of [[item.day, style.dayCss], [item.night, style.nightCss]]) {
        const g = contexts[spot[0]];
        g.save();
        g.beginPath(); g.rect(spot[1], spot[2], item.sw, item.sh); g.clip();
        g.setTransform(dpr, 0, 0, dpr, spot[1] - item.ox, spot[2] - item.oy);
        g.font = style.font; g.fillStyle = colour; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        if (native) g.letterSpacing = `${style.spacing}px`;
        const baseline = Math.round(item.top + style.ascent);
        fillSpaced(g, item.w.text, item.left, baseline, style.spacing, native);
        if (style.thin) {
          // -webkit-font-smoothing: antialiased draws thinner than canvas text: shave the rim.
          g.globalCompositeOperation = 'destination-out';
          g.lineWidth = THIN_ERODE; g.strokeStyle = '#000';
          fillSpaced(g, item.w.text, item.left, baseline, style.spacing, native, true);
        }
        g.restore();
      }
    }
    return { sets, atlases };
  }

  /* ---------------------------------------------------------------------------
   * Image rules: one rule per image that became particles, written into the lens's own
   * stylesheet (which the core removes with the lens), so no element is touched. Settled:
   * opacity 0 (the image keeps the pointer: a photo still opens the lightbox). While the
   * lens enters or leaves: a gradient mask that follows the sweep, so the page's own image
   * dissolves (or returns) row by row with the line timing of the text, and no photo has
   * to be decoded for it. An image that becomes particles while the lens is live fades out
   * as its particles fade in. A graphic on a light ground in the main column is meanwhile
   * shown inverted, as its particles draw it (with the column on a light page, by its own
   * filter on a dark one), so it dissolves from light lines on the night into the same lines
   * in dust instead of from a dimmed white slab; a photo keeps the sheet's dimmed original.
   * ------------------------------------------------------------------------- */
  const RULE_HIDDEN = 'opacity:0!important;transition:none!important';
  const RULE_FADING = `opacity:0!important;transition:opacity ${IMAGE_FADE}s ease-out!important`;
  // While the lens leaves, every rule ends with this: the image's filter (its counter-filter
  // on a light page, its dimming on a dark one) eases back on the column's own curve, so the
  // two hue rotations keep cancelling and a photo never passes through a negative; opacity
  // still changes at once (it is not listed).
  const RULE_LEAVING = `transition:filter ${GROUND_OUT}s ${GROUND_EASE}!important;`;
  // Every rule starts with this: an id inside :not() lifts it above every rule of the sheet
  // (whose selectors hold one id at most), whatever the image's own path.
  const RULE_PREFIX = 'html:not(#lens-stardust-rule) ';
  const BASE_LIGHT = 'filter:none!important;';                                  // inverted with the column
  const BASE_DARK = 'filter:invert(0.94) hue-rotate(180deg)!important;';      // inverted by its own filter

  // The filter an image group's rule carries (see above), or ''.
  function imageBase(state, group) {
    if (!group.image || group.imageKind !== 'graphic' || !group.lightGround) return '';
    if (!group.image.img.closest('#main-content')) return '';
    return state.light ? BASE_LIGHT : BASE_DARK;
  }

  function lensSheet(state) {
    if (state.sheet && state.sheet.ownerNode && state.sheet.ownerNode.isConnected) return state.sheet;
    const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(el => (el.getAttribute('href') || '').includes(SHEET_HREF));
    state.sheet = (link && link.sheet) || null;
    return state.sheet;
  }
  // Sets an image's rule (null removes it): its base filter, if any, then css, then the
  // phase's tail (RULE_LEAVING while the lens leaves).
  function setImageRule(state, img, css) {
    const entry = state.imageRules.get(img);
    if (css === null) { if (entry) dropImageRule(state, img); return; }
    const text = (state.imageBases.get(img) || '') + css + (css && !css.endsWith(';') ? ';' : '') + state.ruleTail;
    if (entry) {
      entry.css = css;
      if (entry.text !== text) { entry.rule.style.cssText = text; entry.text = text; }
      return;
    }
    const sheet = lensSheet(state); const selector = pathTo(img);
    if (!sheet || !selector) return;
    try {
      const index = sheet.insertRule(`${RULE_PREFIX}${selector}{${text}}`, sheet.cssRules.length);
      state.imageRules.set(img, { rule: sheet.cssRules[index], selector, css, text });
    } catch (error) { /* an odd selector: the image keeps the CSS treatment */ }
  }
  function dropImageRule(state, img) {
    state.masked.delete(img); state.waiting.delete(img);
    const entry = state.imageRules.get(img);
    if (!entry) return;
    state.imageRules.delete(img);
    const sheet = entry.rule.parentStyleSheet;
    const index = sheet ? Array.prototype.indexOf.call(sheet.cssRules, entry.rule) : -1;
    if (index >= 0) sheet.deleteRule(index);
  }
  // After a new model: the rules follow their images (a DOM change moves selectors), and an
  // image that can no longer be particles (hidden, removed, unreadable) shows again.
  function syncImageRules(state, model) {
    const items = new Map(model.images.map(item => [item.img, item]));
    for (const [img, entry] of [...state.imageRules]) {
      const item = items.get(img);
      // (An image hidden as it loaded, measured by the next model.)
      if (!item && state.waiting.has(img) && img.isConnected && img.complete) continue;
      if (!item || state.imageFailed.has(item.key)) { dropImageRule(state, img); continue; }
      const selector = pathTo(img);
      if (selector && selector !== entry.selector) { dropImageRule(state, img); setImageRule(state, img, entry.css); }
    }
  }
  // An image group was added: its image gives way to it, with the sweep when it joins one,
  // else with a short crossfade (the swap does this for the groups built before it; an exit
  // leaves the images alone).
  function imageShown(state, group, joins, late) {
    const img = group.image.img;
    if (state.phase === 'build' || state.phase === 'exiting' || state.imageRules.has(img)) return;
    if (joins) {
      state.masked.add(img);
      if (late) state.late.set(img, late);
      setImageRule(state, img, '');
      return;
    }
    setImageRule(state, img, state.ctx.motion.matches || resting(state) ? RULE_HIDDEN : RULE_FADING);
  }
  /*
   * Waiting under the night. On an arrival, and for a photo that loads while the lens is
   * settled, an image that will become particles is hidden at once (the reader never saw it
   * in this lens), and its stars fade in when they are made (WAIT_FADE). Only entering does
   * an image crossfade from itself: it was on the day page. One that turns out unreadable
   * shows again with the CSS treatment.
   */
  function hideWaiting(state, img) {
    if (state.imageRules.has(img)) return;
    setImageRule(state, img, RULE_HIDDEN);
    if (state.imageRules.has(img)) state.waiting.add(img);
  }
  // Will this image become particles? (What buildModel's imageOf() asks, cheaply, for an image
  // that has just loaded.)
  function willBeParticles(state, img) {
    if (!state.kit || !state.kit.readable(img) || !img.isConnected || !img.getClientRects().length || img.closest(EXCLUDE)) return false;
    if (typeof img.checkVisibility === 'function' && !img.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
    const r = img.getBoundingClientRect();
    return r.width >= IMAGE_MIN && r.height >= IMAGE_MIN && !fixedRootOf(img);
  }
  // How an image built during the enter joins its sweep: null when the sweep has not reached
  // it yet; { start, top } when it has, so the image dissolves in a sweep of its own from its
  // top, starting now (the enter lasts until that is done); false when the enter is nearly
  // over (it crossfades instead).
  function lateSweep(state, group) {
    const img = group.image.img;
    if (state.late.has(img)) return state.late.get(img);   // rebuilt: as before
    if (state.masked.has(img)) return null;
    const r = img.getBoundingClientRect();
    const top = r.top + window.scrollY - state.enterScroll;
    const start = state.enterT + 0.05;
    if (start < sweepDelay(state, top, null)) return null;
    if (state.enterT > LATE_JOIN) return false;
    state.enterEnd = Math.max(state.enterEnd, start + ENTER_SWEEP * clamp(r.height / state.H, 0, 1) + ENTER_DUR);
    return { start, top };
  }
  // The share of a row still drawn by the page (1) rather than by its dust (0), for a row at
  // viewport y now: the ink timing of a text line there (drawInk's alphaOf), with the sweep
  // timed by where the row was when the enter (or the exit) began.
  function inkAt(state, y, late, img) {
    const sy = window.scrollY;
    const delayIn = imageDelayIn(state, y + sy - state.enterScroll, late, floorOf(state, img));
    let a = inkEnter(clamp((state.enterT - delayIn) / ENTER_DUR, 0, 1));
    if (state.phase === 'exiting') {
      const delayOut = imageDelayOut(state, y + sy - state.exitScroll);
      a = Math.max(a, inkExit(clamp((state.exitT - delayOut) / EXIT_DUR, 0, 1)));
    }
    return a;
  }
  // How present an image row's stars are now (0..1), as the shader times them: the row at
  // viewport y, with the image's own timing.
  function dustAt(state, y, late, img) {
    const sy = window.scrollY;
    const delayIn = imageDelayIn(state, y + sy - state.enterScroll, late, floorOf(state, img));
    let a = smooth(0, 0.15, clamp((state.enterT - delayIn) / ENTER_DUR, 0, 1));
    if (state.phase === 'exiting') {
      const delayOut = imageDelayOut(state, y + sy - state.exitScroll);
      a *= 1 - smooth(0.6, 1, clamp((state.exitT - delayOut) / EXIT_DUR, 0, 1));
    }
    return a;
  }
  // The masks of the images in a transition, this frame. On a light page the inverting
  // column flattens every image toward grey while the ground changes (an inversion by a maps
  // a colour v to a + (1 - 2a) v: at a = 0.5 everything is mid-grey), and so does an image's
  // own counter-inversion, which eases with it: at progress q the two leave a photo
  // |1 - 2q| |1 - 2 x 0.94 q| of its contrast. The images still shown are only as opaque as
  // that contrast allows: they fade out as it goes and come back as it returns, and no grey
  // slab stands on the grey page. The column eases on the ground's curve, so the ground's
  // progress is the inversions'.
  function updateMasks(state) {
    const H = state.H; const leaving = state.phase === 'exiting';
    if (state.light) {
      const q = state.groundP;
      const dip = smooth(SLAB_CONTRAST[0], SLAB_CONTRAST[1], Math.abs(1 - 2 * q) * Math.abs(1 - 2 * INVERT * q));
      setDip(state, dip < 0.995 ? dip : 1);
    }
    for (const img of state.masked) {
      if (!img.isConnected) continue;
      const r = img.getBoundingClientRect();
      // Far from the viewport nobody sees it: hidden while entering, shown while leaving.
      if (r.bottom < -H || r.top > 2 * H) { setImageRule(state, img, leaving ? '' : RULE_HIDDEN); continue; }
      const stops = clamp(Math.ceil(r.height / MASK_STOP) + 1, 2, 48);
      let lo = 1; let hi = 0; const parts = [];
      for (let k = 0; k < stops; k++) {
        const t = k / (stops - 1); const a = inkAt(state, r.top + t * r.height, state.late.get(img), img);
        if (a < lo) lo = a; if (a > hi) hi = a;
        parts.push(`rgba(0,0,0,${a.toFixed(3)}) ${(t * 100).toFixed(2)}%`);
      }
      let css = '';
      if (hi < 0.002) css = RULE_HIDDEN;
      else if (lo < 0.998) { const mask = `linear-gradient(${parts.join(',')})`; css = `-webkit-mask-image:${mask}!important;mask-image:${mask}!important`; }
      setImageRule(state, img, css);
    }
  }

  // The column's media in a transition on a light page: one rule of the lens's sheet gives
  // them the opacity the inversion's contrast allows (1: the rule is empty). An image that
  // became particles has its own rule, which wins (hidden, or masked: the mask then shows
  // through this opacity).
  const DIP_SELECTOR = '#main-content :is(img, video, canvas, iframe, object, embed)';
  function setDip(state, dip) {
    const text = dip < 1 ? `opacity:${dip.toFixed(3)}!important` : '';
    if (!state.dipRule) {
      if (!text) return;
      const sheet = lensSheet(state);
      if (!sheet) return;
      try { state.dipRule = sheet.cssRules[sheet.insertRule(`${RULE_PREFIX}${DIP_SELECTOR}{}`, sheet.cssRules.length)]; } catch (error) { return; }
    }
    if (state.dipRule.style.cssText !== text) state.dipRule.style.cssText = text;
  }

  /* ---------------------------------------------------------------------------
   * The photography lightbox: its photo sits outside the scope, in a fixed container, so
   * the media helper (fixed: true) lays a canvas over it, follows it as it opens, changes
   * photo and closes, and keeps the arrows and the caption over it visible. The canvas holds
   * the photo's stars, sampled as the gallery's are (with a larger budget: one still canvas
   * costs no particles) and drawn as the shader draws a settled star, on the lightbox's own
   * backdrop. It is still: no shimmer, no wind. The photo itself stays under the backdrop
   * (stardust.css), so until its stars are ready the lightbox shows its dark, its caption
   * and its arrows; the canvas then fades in. A canvas whose photo has gone (the next one was
   * asked for, or the lightbox closed) is hidden in the same task, before the helper follows
   * (it waits a moment for the container to settle), so no photo's stars ever stand under
   * another's caption. While the lightbox covers the viewport the night beneath it is not
   * drawn at all (watchCover).
   * ------------------------------------------------------------------------- */
  function lightbox(state) {
    const ctx = state.ctx;
    if (!state.kit || typeof ctx.media !== 'function' || !document.querySelector(OUTSIDE_IMAGES)) return;
    ctx.media({ select: OUTSIDE_IMAGES, fixed: true, render: source => lightboxStars(state, source) })
      .then(handle => {
        if (state.dead) { handle.dispose(); return; }
        state.media = handle;
        // (The helper renders a fixed image when its container changes; one already open as
        // the lens starts, as after a jump from another lens with the lightbox open, waits
        // for a change that does not come. A refresh renders it now.)
        handle.refresh();
      }, () => { /* the photo stays under the backdrop */ });
    // The photo changes or the lightbox closes: the stars of the photo that was are hidden now.
    const containers = new Set();
    for (const img of document.querySelectorAll(OUTSIDE_IMAGES)) { const root = fixedRootOf(img); if (root) containers.add(root); }
    const stale = () => {
      if (state.dead || !state.media) return;
      for (const overlay of state.media.overlays) {
        if (!overlay.fixed) continue;
        const img = overlay.img; const drawn = state.lightboxSrc.get(overlay.canvas);
        const gone = !img.isConnected || !img.getClientRects().length || (drawn !== undefined && drawn !== img.src);
        const visibility = gone ? 'hidden' : '';
        if (overlay.canvas.style.visibility !== visibility) overlay.canvas.style.visibility = visibility;
      }
    };
    const observer = new MutationObserver(stale);
    for (const root of containers) observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'src', 'hidden'] });
    ctx.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  }
  // The outermost position: fixed ancestor of an element below <body>, or null.
  function fixedRootOf(el) {
    let root = null;
    for (let a = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (getComputedStyle(a).position === 'fixed') root = a;
    }
    return root;
  }
  async function lightboxStars(state, source) {
    const { img, width: W, height: H } = source;
    if (state.dead || !source.readable || !img.isConnected) return null;
    const src = img.src;
    const live = () => !state.dead && img.isConnected;
    let began = performance.now();
    const data = source.ctx2d.getImageData(0, 0, W, H).data;
    noteSlice(state, performance.now() - began, 'read');
    await nextTask();
    if (!live()) return null;
    const item = { w: source.cssWidth, h: source.cssHeight, oval: false, radii: null, opacity: 1, budget: LIGHTBOX_BUDGET };
    const random = seeded(hashString(`${img.currentSrc || img.src}|${W}x${H}`));
    const out = source.kind === 'graphic' ? await graphicParticles(state, item, data, W, H, random, live) : await photoParticles(state, item, data, W, H, random, live);
    if (!out || !live()) return null;
    // The backdrop the photo sits on (the lightbox's translucent black over the night).
    let ground = NIGHT_RGB;
    for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
      const bg = parseColour(getComputedStyle(el).backgroundColor);
      if (bg && bg[3] > 0.05) { ground = NIGHT_RGB.map((v, k) => bg[k] * bg[3] + v * (1 - bg[3])); break; }
    }
    // Each particle as the shader draws it settled: a soft star (a gaussian of the disc's
    // light, never narrower than STAR_MIN device px) or a disc, laid "over" the ground.
    const dpr = W / source.cssWidth;
    const acc = new Float32Array(W * H * 3);
    const rows = async fn => {           // (row by row, in slices)
      for (let y = 0; y < H; y++) {
        if (performance.now() - began > SLICE_MS) {
          noteSlice(state, performance.now() - began, 'lightbox');
          await nextTask();
          if (!live()) return false;
          began = performance.now();
        }
        fn(y * W, (y + 1) * W);
      }
      return true;
    };
    began = performance.now();
    if (!(await rows((p0, p1) => { for (let p = p0; p < p1; p++) { acc[p * 3] = ground[0]; acc[p * 3 + 1] = ground[1]; acc[p * 3 + 2] = ground[2]; } }))) return null;
    const { n, f, c } = out.list;
    for (let i = 0; i < n; i++) {
      if ((i & 255) === 255 && performance.now() - began > SLICE_MS) {
        noteSlice(state, performance.now() - began, 'lightbox');
        await nextTask();
        if (!live()) return null;
        began = performance.now();
      }
      const k = i * 8; const x = f[k] * dpr; const y = f[k + 1] * dpr; const star = f[k + 5] < 0;
      const radius = 0.5 * f[k + 3] * dpr; const alpha = c[k + 7] / 255;
      const width = Math.max(radius * STAR_WIDTH, STAR_MIN);
      const a = star ? alpha * Math.min(1, (radius * radius) / (width * width)) : alpha * Math.min(1, 2 * radius);
      const reach = Math.ceil(star ? 2.2 * width : radius + 1);
      const r = c[k + 4]; const g = c[k + 5]; const b = c[k + 6];
      for (let py = Math.max(0, Math.floor(y - reach)); py <= Math.min(H - 1, Math.ceil(y + reach)); py++) {
        for (let px = Math.max(0, Math.floor(x - reach)); px <= Math.min(W - 1, Math.ceil(x + reach)); px++) {
          const dx = px + 0.5 - x; const dy = py + 0.5 - y; const d2 = dx * dx + dy * dy;
          const cover = star ? Math.exp(-d2 / (width * width)) : clamp(radius + 0.5 - Math.sqrt(d2), 0, 1);
          const t = a * cover; if (t < 0.004) continue;
          const q = (py * W + px) * 3;
          acc[q] += (r - acc[q]) * t; acc[q + 1] += (g - acc[q + 1]) * t; acc[q + 2] += (b - acc[q + 2]) * t;
        }
      }
    }
    const canvas = makeCanvas(W, H); const g2 = canvas.getContext('2d');
    const image = g2.createImageData(W, H); const pixels = image.data;
    if (!(await rows((p0, p1) => {
      for (let p = p0, q = p0 * 4; p < p1; p++, q += 4) { pixels[q] = acc[p * 3]; pixels[q + 1] = acc[p * 3 + 1]; pixels[q + 2] = acc[p * 3 + 2]; pixels[q + 3] = 255; }
    }))) return null;
    g2.putImageData(image, 0, 0);
    noteSlice(state, performance.now() - began, 'lightbox');
    state.perf.lightbox = (state.perf.lightbox || 0) + 1;
    state.lightboxSrc.set(canvas, src);  // which photo these stars are (see lightbox())
    return state.dead ? null : canvas;
  }

  /*
   * A fixed container outside the scope that covers the viewport with a ground that is
   * (almost) opaque: the photography lightbox, open. The night beneath it cannot be seen, so
   * while the lens is settled no frame is drawn (the shimmer sleeps; opening the lightbox
   * and changing its photo upload large images to the GPU, and a WebGL frame then would wait
   * for them). Watched on the containers' class and style, and on resizes; the frames resume
   * when it goes. Entering and leaving draw on: their frames end the transition.
   */
  function watchCover(state) {
    const roots = new Set();
    for (const img of document.querySelectorAll(OUTSIDE_IMAGES)) { const root = fixedRootOf(img); if (root) roots.add(root); }
    if (!roots.size) return;
    const covers = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility !== 'visible' || (parseFloat(cs.opacity) || 0) < COVER_OPAQUE) return false;
      const bg = parseColour(cs.backgroundColor);
      if (!bg || bg[3] < COVER_OPAQUE) return false;
      const r = el.getBoundingClientRect();
      return r.left <= 0.5 && r.top <= 0.5 && r.right >= window.innerWidth - 0.5 && r.bottom >= window.innerHeight - 0.5;
    };
    const check = () => {
      if (state.dead) return;
      const was = state.covered;
      state.covered = [...roots].some(covers);
      if (was && !state.covered) { state.dirty = true; wake(state); }
    };
    const observer = new MutationObserver(check);
    for (const root of roots) observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('resize', check, { passive: true, signal: state.ctx.signal });
    state.ctx.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    check();
  }
  // Settled under a covering lightbox: no frame is drawn.
  const underCover = state => state.covered && state.phase === 'live';

  /* ---------------------------------------------------------------------------
   * The lens
   * ------------------------------------------------------------------------- */
  let st = null;                         // the live activation
  let lastPerf = null;

  function createState(ctx) {
    return {
      ctx, phase: 'build', dead: false, applied: new Set(), glyphs: false, hadClass: false,
      W: 0, H: 0, dpr: 1, layer: null, renderer: null, canvas: null, inkCanvas: null, ink: null, inkG: null,
      gen: 0, model: null, modelStale: false, groups: new Map(), particles: 0, building: false, buildWanted: false,
      linkIds: new WeakMap(), linkCount: 0, boxIds: new WeakMap(), boxCount: 0, light: true,
      // Images: the media helper's utilities, ids, sampled results (LRU), jobs, failures, rules
      kit: null, imageIds: new WeakMap(), imageCount: 0, imageCache: new Map(), jobs: new Map(), jobsRunning: 0,
      imageFailed: new Set(), imageRules: new Map(), imageBases: new Map(), masked: new Set(), late: new Map(), sheet: null, ruleTail: '', dipRule: null,
      haloRule: null, haloText: '',
      media: null, lightboxSrc: new WeakMap(), covered: false, waiting: new Set(), floors: new Map(),
      enterAt: 0, enterT: 0, enterEnd: 0, exitAt: 0, exitT: -1, exitEnd: 0, enterScroll: 0, exitScroll: 0,
      night: 0, groundP: 0, dayGround: [255, 255, 255], groundBody: true, startedAt: performance.now(),
      pointer: { in: false, x: 0, y: 0, vx: 0, vy: 0, at: 0 },
      rings: new Float32Array(RING_MAX * 4), ringAt: new Float64Array(RING_MAX), ringNext: 0,
      ringView: new Float32Array(RING_MAX * 4),
      hover: { id: -1, amount: 0, prevId: -1, prevAmount: 0, target: -1 },
      scrollSmooth: window.scrollY, lag: 0, lastScrollY: window.scrollY, scrollDir: 1, lastScrollX: window.scrollX, windowAt: window.scrollY,
      ticking: false, unframe: null, frameToken: 0, lastRender: 0, dirty: true, ringsDrawn: false,
      shimmerTimer: 0, contentTimer: 0, restTimer: 0, restUntil: 0, restBroken: false, showTimer: 0,
      listening: false, changedEarly: false, exitWatch: null,
      perf: { frames: 0, total: 0, max: 0, last: 0, uploads: 0, uploaded: 0, render: 0, byPhase: {} },
      uniforms: {
        w: 0, h: 0, time: 0, shimmer: 0, night: 0, lag: 0,
        enterT: 0, exitT: -1, dpr: 1, hoverId: -1, hoverAmount: 0, prevId: -1, prevAmount: 0, rings: null
      }
    };
  }

  // Prepare an activation: the model and the groups on screen, the canvases, the listeners.
  async function prepare(ctx) {
    if (st && !st.dead) finishExit(st);  // a previous activation that was never exited
    const state = st = createState(ctx);
    // Watch the scope before measuring it: what changes while the model is built (the blog
    // list rendered after its fetch, star counts, a photo loading) is measured again once the
    // lens is on (listen()).
    watchChanges(state);
    // The media helper's utilities (readable, sample, classify, drawAsync); without them the
    // images keep the CSS treatment.
    const kit = typeof ctx.mediaKit === 'function' ? ctx.mediaKit().catch(() => null) : Promise.resolve(null);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    state.kit = await kit;
    if (state.dead || ctx.signal.aborted) return null;
    // Arriving, the page is still hidden over the night: images near the viewport that are
    // still loading (the photography masonry, whose photos have no size before they load) get
    // a moment, so the first measure already sees the layout the reader will see.
    if (ctx.arriving) await imagesLoading(ctx.scope, state.startedAt + ARRIVE_IMAGES_MS);
    if (state.dead || ctx.signal.aborted) return null;
    warmSampler(state);
    await nextTask();
    if (state.dead || ctx.signal.aborted) return null;
    const t0 = performance.now();
    state.light = pageIsLight(ctx.scope);
    measureViewport(state);
    const model = await buildModel(state);
    if (!model || state.dead || ctx.signal.aborted) return null;
    state.model = model;
    // Only what is on screen before the swap; the rest of the window follows. The images on
    // screen are decoded meanwhile (off the main thread) and waited for a moment; the ones
    // that take longer crossfade in once the lens is on.
    const specs = neededGroups(state, model).filter(spec => spec.distance === 0);
    const jobs = specs.filter(spec => spec.kind === 'image').map(spec => requestImage(state, spec.item, 0)).filter(Boolean);
    const groups = [];
    for (const spec of specs) {
      if (spec.kind === 'image') continue;
      const group = await buildGroup(state, model, spec, null);
      if (!group || state.dead || ctx.signal.aborted) return null;
      groups.push(group);
    }
    if (jobs.length) {
      const wait = Math.max(0, ctx.arriving ? state.startedAt + IMAGE_ARRIVE_MS - performance.now() : IMAGE_WAIT_MS - (performance.now() - t0));
      await Promise.race([Promise.all(jobs), new Promise(resolve => setTimeout(resolve, wait))]);
      if (state.dead || ctx.signal.aborted) return null;
    }
    for (const spec of specs) {
      const result = spec.kind === 'image' ? state.imageCache.get(spec.item.key) : null;
      const group = result && await imageGroup(state, model, spec, result);
      if (group) groups.push(group);
      if (state.dead || ctx.signal.aborted) return null;
    }
    mount(state);
    for (const group of groups) addGroup(state, group, null, false);
    listen(state);
    lightbox(state);
    watchCover(state);
    state.perf.prepareMs = performance.now() - t0;
    return state;
  }

  async function enter(ctx) {
    let state = null;
    try {
      state = await prepare(ctx);
      if (!state) return;
      // Read the day before anything changes it.
      readDay(state, false);
      if (ctx.motion.matches) {
        // Instant: no ground transition, no ink, particles at rest.
        state.enterT = 1e4; state.night = 1; state.phase = 'live';
        swapIn(state, false);
        captionTone(state, 1);
        render(state, performance.now());
        schedule(state);
        return;
      }
      // Sweep timing: line by line from the top of the viewport.
      state.enterScroll = window.scrollY;
      placeGroups(state);
      for (const group of state.groups.values()) enterDelays(state, group, false);
      const inkBegan = performance.now();
      state.ink = buildInk(state);
      state.perf.enterInk = performance.now() - inkBegan;
      state.enterEnd = Math.max(ENTER_START + ENTER_SWEEP + ENTER_DUR, GROUND_IN);
      state.enterAt = performance.now(); state.enterT = 0; state.night = 0;
      // The swap: the ink sprites are exactly the page's glyphs, drawn in the same task.
      drawInk(state);
      swapIn(state, true);
      state.phase = 'entering';
      wake(state);
      schedule(state);
      await new Promise(resolve => {
        state.entered = resolve;
        // Leaving (or a reset) before the enter has settled resolves it at once.
        ctx.signal.addEventListener('abort', () => { if (state.entered) { state.entered(); state.entered = null; } }, { once: true });
      });
    } catch (error) {
      // Never leave the page with hidden glyphs: restore, then let the core skip the lens.
      if (st && !st.dead && st.ctx === ctx) { finishExit(st); throw error; }
    }
  }

  // Arriving with a page: the ground is already night; the particles fade in, no sweep.
  async function arrive(ctx) {
    const called = performance.now();
    try {
      const state = await prepare(ctx);
      if (!state) return;
      readDay(state, false);             // the body's own ground (the root's is the pre-paint night)
      state.enterT = 1e4; state.night = 1; state.phase = 'live';
      // The particles are there in the first frame; they appear as the core fades the page in.
      for (const group of state.groups.values()) group.fade = 0;
      swapIn(state, false);
      // The images whose stars are not made yet wait for them under the night.
      for (const item of state.model.images) if (!state.groups.has(item.gkey) && !state.imageFailed.has(item.key)) hideWaiting(state, item.img);
      captionTone(state, 1);
      placeGroups(state);
      render(state, performance.now());
      state.perf.arrivedAt = performance.now();
      state.perf.arriveMs = state.perf.arrivedAt - called;
      // Then the page appears (the core fades the body in) and paints itself for the first
      // time, which can keep the GPU busy (the photography page's photos); a WebGL frame then
      // would wait for it on the main thread. The frame loop (the shimmer) waits until that
      // has passed, unless the reader moves first; the builder does not wait, and what it
      // changes meanwhile (a photo's stars, a group re-measured after the masonry moved) is
      // shown by a single render each time (show()).
      state.restUntil = performance.now() + ARRIVE_REST_MS;
      state.restTimer = setTimeout(() => { state.restUntil = 0; wake(state); schedule(state); }, ARRIVE_REST_MS);
    } catch (error) {
      if (st && !st.dead && st.ctx === ctx) { finishExit(st); throw error; }
    }
  }

  function measureViewport(state) {
    const html = document.documentElement; const layer = state.layer;
    // The canvases fill the core's fixed layer (on a phone it follows the URL bar).
    state.W = (layer && layer.clientWidth) || html.clientWidth || window.innerWidth;
    state.H = (layer && layer.clientHeight) || html.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    if (state.W * state.H * dpr * dpr > MAX_BACKING_PIXELS) dpr = Math.sqrt(MAX_BACKING_PIXELS / (state.W * state.H));
    state.dpr = dpr;
  }
  function sizeCanvases(state) {
    measureViewport(state);
    const dpr = state.renderer && state.renderer.kind === 'canvas2d' ? 1 : state.dpr;
    state.canvas.width = Math.max(1, Math.round(state.W * dpr)); state.canvas.height = Math.max(1, Math.round(state.H * dpr));
    state.inkCanvas.width = Math.max(1, Math.round(state.W * state.dpr)); state.inkCanvas.height = Math.max(1, Math.round(state.H * state.dpr));
  }
  function canvasEl() {
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    return c;
  }
  function makeRenderer(state) {
    let renderer = null;
    try { renderer = glRenderer(state.canvas); } catch (error) { renderer = null; }
    if (!renderer) {
      // A canvas keeps its first context type: the fallback needs a fresh one.
      const fresh = canvasEl(); state.canvas.replaceWith(fresh); state.canvas = fresh;
      renderer = pixelRenderer(fresh);
    }
    return renderer;
  }
  function mount(state) {
    const layer = state.layer = state.ctx.layer('fixed');
    state.inkCanvas = canvasEl(); state.canvas = canvasEl();
    layer.append(state.inkCanvas, state.canvas);
    state.inkG = state.inkCanvas.getContext('2d');
    measureViewport(state);
    state.renderer = makeRenderer(state);
    sizeCanvases(state);
    state.uniforms.rings = state.ringView;
    state.perf.renderer = state.renderer.kind;
  }

  // Night: the ground, the main column's inversion on a light page, the hidden glyphs.
  function swapIn(state, animate) {
    const html = document.documentElement;
    state.hadClass = html.hasAttribute('class');
    const add = name => { html.classList.add(name); state.applied.add(name); };
    add(animate ? CLASS_GROUND : CLASS_STILL);
    if (state.groundBody) add(CLASS_BODY);
    if (state.light) add(CLASS_INVERT);
    add(CLASS_NIGHT);
    // The images that became particles give way: masked with the sweep, or hidden at once.
    for (const group of state.groups.values()) {
      if (!group.image) continue;
      if (animate) state.masked.add(group.image.img);
      setImageRule(state, group.image.img, animate ? '' : RULE_HIDDEN);
    }
    state.ctx.hideGlyphs(true); state.glyphs = true;
    if (!animate) {
      // Settle without transitions, then let the page's own transitions run again.
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLASS_STILL); state.applied.delete(CLASS_STILL);
    }
  }

  /*
   * The day as it is under the lens: the ground's colour and whether the body paints its
   * own. Read with the night lifted for a moment (without transitions) when it is on.
   */
  function readDay(state, lifted) {
    const html = document.documentElement;
    const removed = [];
    if (lifted) {
      html.classList.add(CLASS_STILL);
      for (const name of [CLASS_NIGHT, CLASS_BODY, CLASS_INVERT]) if (html.classList.contains(name)) { html.classList.remove(name); removed.push(name); }
    }
    const body = parseColour(getComputedStyle(document.body).backgroundColor);
    const root = parseColour(getComputedStyle(html).backgroundColor);
    state.groundBody = !!(body && body[3] > 0.5);
    const ground = state.groundBody ? body : root;
    const isNight = ground && Math.abs(ground[0] - NIGHT_RGB[0]) + Math.abs(ground[1] - NIGHT_RGB[1]) + Math.abs(ground[2] - NIGHT_RGB[2]) < 3;
    state.dayGround = ground && ground[3] > 0.5 && !isNight ? ground.slice(0, 3) : (state.light === false ? [31, 31, 31] : [255, 255, 255]);
    state.light = pageIsLight(state.ctx.scope);
    if (lifted) {
      for (const name of removed) html.classList.add(name);
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLASS_STILL);
    }
  }
  // How far the ground has travelled from day to night (0..1), read from the running CSS
  // transition so that the ink and particles stay in step with it.
  function groundProgress(state) {
    const el = state.groundBody ? document.body : document.documentElement;
    const now = parseColour(getComputedStyle(el).backgroundColor);
    const day = state.dayGround;
    if (!now) return state.phase === 'exiting' ? 0 : 1;
    // A transparent root turning to night: weigh its colour by its alpha over the day.
    const a = now[3];
    let num = 0; let den = 0;
    for (let k = 0; k < 3; k++) { const d = NIGHT_RGB[k] - day[k]; num += (now[k] * a + day[k] * (1 - a) - day[k]) * d; den += d * d; }
    return den < 1 ? (state.phase === 'exiting' ? 0 : 1) : clamp(num / den, 0, 1);
  }
  // The caption turns light when the ground passes mid-grey (it fades in on the day page).
  // While the ground changes, the halo behind its glyphs (core.css) is the ground as it is
  // this frame (one rule of the lens's sheet, on the caption alone), so it never stands as a
  // pale smudge on a darkening page; settled, the night of CLASS_CAPTION (stardust.css).
  function captionTone(state, p) {
    if (state.phase === 'entering') {
      const rgb = state.dayGround.map((v, k) => Math.round(v + (NIGHT_RGB[k] - v) * clamp(p, 0, 1)));
      captionHalo(state, `rgb(${rgb.join(',')})`);
    } else captionHalo(state, '');
    if (p < 0.5 || state.applied.has(CLASS_CAPTION)) return;
    document.documentElement.classList.add(CLASS_CAPTION); state.applied.add(CLASS_CAPTION);
  }
  function captionHalo(state, colour) {
    if (state.haloText === colour) return;
    if (!state.haloRule) {
      if (!colour) return;
      const sheet = lensSheet(state);
      if (!sheet) return;
      try { state.haloRule = sheet.cssRules[sheet.insertRule('.lenses-caption{}', sheet.cssRules.length)]; } catch (error) { return; }
    }
    // (The core eases the halo's colour over 250 ms; driven every frame it would trail the
    // ground, so meanwhile only the caption's opacity keeps its transition.)
    state.haloRule.style.cssText = colour ? `--lenses-caption-ground:${colour};transition:opacity 450ms ease` : '';
    state.haloText = colour;
  }
  // Text colour follows the ground. On a light page it flips quickly as the ground passes
  // mid-grey, so the text is always on the far side of the ground and stays legible.
  function nightMix(state, p) {
    return luma(state.dayGround) > 0.5 ? smooth(0.44, 0.56, p) : p;
  }

  /* ---------------------------------------------------------------------------
   * Interaction and change
   * ------------------------------------------------------------------------- */
  function listen(state) {
    const { ctx } = state; const signal = ctx.signal;
    const opts = { passive: true, signal };
    const pointer = state.pointer;
    window.addEventListener('pointermove', event => {
      const now = performance.now();
      const dt = Math.max(0.004, (now - pointer.at) / 1000);
      if (pointer.in && now - pointer.at < 120) {
        // Smoothed client-space velocity of the pointer.
        pointer.vx += ((event.clientX - pointer.x) / dt - pointer.vx) * 0.5;
        pointer.vy += ((event.clientY - pointer.y) / dt - pointer.vy) * 0.5;
      } else { pointer.vx = 0; pointer.vy = 0; }
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.at = now; pointer.in = true;
      state.restBroken = true;
      if (!ctx.motion.matches) wake(state);
    }, opts);
    const leave = () => { pointer.in = false; pointer.vx = 0; pointer.vy = 0; };
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) leave(); }, opts);
    window.addEventListener('blur', leave, opts);
    window.addEventListener('pointerup', event => { if (event.pointerType === 'touch') leave(); }, opts);
    window.addEventListener('pointercancel', leave, opts);
    window.addEventListener('pointerdown', event => {
      if (ctx.motion.matches || state.phase === 'exiting') return;
      const k = state.ringNext; state.ringNext = (k + 1) % RING_MAX;
      state.rings[k * 4] = event.clientX + window.scrollX; state.rings[k * 4 + 1] = event.clientY + window.scrollY;
      state.rings[k * 4 + 2] = 0; state.rings[k * 4 + 3] = 1; state.ringAt[k] = performance.now();
      wake(state);
    }, opts);
    // The page and any container inside it (a wide table on a phone) scroll.
    document.addEventListener('scroll', event => {
      if (event.target !== document || window.scrollY !== state.lastScrollY || window.scrollX !== state.lastScrollX) state.restBroken = true;
      wake(state);
    }, { passive: true, capture: true, signal });
    window.addEventListener('resize', () => {
      // The canvases follow at once. Text reflows only with the width, so only then is the
      // page re-measured (a phone's URL bar changes the height alone).
      const width = state.W;
      sizeCanvases(state); state.dirty = true; wake(state);
      if (state.W !== width) contentChanged(state, 0);
      else schedule(state);
    }, opts);
    // Links brighten under the pointer and with keyboard focus.
    const target = el => {
      const a = el && el.closest ? el.closest('a[href], button, summary, [role="button"]') : null;
      return (a && state.linkIds.get(a)) || -1;
    };
    const setHover = id => {
      const h = state.hover;
      if (id === h.target) return;
      if (h.id !== id) { h.prevId = h.id; h.prevAmount = h.amount; h.id = id; h.amount = 0; }
      h.target = id;
      if (ctx.motion.matches) { h.amount = id > 0 ? 1 : 0; h.prevAmount = 0; }
      state.dirty = true; wake(state);
    };
    document.addEventListener('pointerover', event => setHover(target(event.target)), opts);
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) setHover(-1); }, opts);
    document.addEventListener('focusin', event => setHover(target(event.target)), opts);
    document.addEventListener('focusout', () => setHover(-1), opts);
    // Reduced motion switched on mid-lens: everything comes to rest at once.
    const onMotion = () => {
      if (ctx.motion.matches) { calm(state); state.dirty = true; }
      wake(state);
    };
    if (ctx.motion.addEventListener) ctx.motion.addEventListener('change', onMotion, { signal });
    // The scope has been watched since prepare() began (watchChanges): what changed while the
    // model was measured (the blog list rendered after its fetch, a photo that loaded and
    // moved the masonry) is measured again now; later changes are measured as they come.
    state.listening = true;
    if (state.changedEarly || (state.model && layoutPrint(ctx.scope) !== state.model.print)) contentChanged(state, 0);
    state.canvas.addEventListener('webglcontextlost', event => event.preventDefault(), { signal });
    state.canvas.addEventListener('webglcontextrestored', () => restoreContext(state), { signal });
  }

  /*
   * Late content (markdown, the blog list, star counts, abstracts, demos) and layout that
   * moves without a DOM change (photos loading into the photography masonry, fonts, a
   * <details> toggle, a resize; the core debounces both). Subscribed when prepare() begins,
   * before anything is measured (the core starts watching with the first subscription);
   * until listen() the changes are only noted, since the groups being built for the swap
   * belong to the model being measured.
   */
  function watchChanges(state) {
    const { ctx } = state; const signal = ctx.signal;
    const changed = wait => { if (state.listening) contentChanged(state, wait); else state.changedEarly = true; };
    if (typeof ctx.onContentChange === 'function') ctx.onContentChange(() => changed(0));
    const observer = new MutationObserver(records => {
      // Class and style changes in the scope (a demo's state, a toggled section); a theme
      // switch on <html>; and, without the core's watcher, any text change.
      for (const record of records) {
        if (record.target === document.documentElement && record.attributeName !== 'data-theme') continue;
        changed(CONTENT_MS);
        return;
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const watchText = typeof ctx.onContentChange !== 'function';
    for (const root of ctx.scope) observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class', 'style'], childList: watchText, characterData: watchText });
    // An image that loads in the scope may move what follows it (the photography masonry, whose
    // photos have no size before they load): the groups that moved stop being drawn at once,
    // and a re-measure follows without waiting for the core's debounced layout report.
    const onLoad = event => {
      if (!state.listening || state.dead || state.phase === 'exiting' || !(event.target instanceof HTMLImageElement)) return;
      // (Settled: it waits for its stars under the night; see hideWaiting().)
      if (state.phase === 'live' && willBeParticles(state, event.target)) hideWaiting(state, event.target);
      if (markStale(state, null)) contentChanged(state, 0);
    };
    for (const root of ctx.scope) root.addEventListener('load', onLoad, { capture: true, signal });
    let resized = null;
    if (typeof ctx.onLayoutChange === 'function') {
      ctx.onLayoutChange(() => { state.perf.layouts = (state.perf.layouts || 0) + 1; changed(0); });
    } else if (typeof ResizeObserver === 'function') {
      let first = true;
      resized = new ResizeObserver(() => { if (first) { first = false; return; } changed(CONTENT_MS); });
      resized.observe(document.body);
    }
    signal.addEventListener('abort', () => { observer.disconnect(); if (resized) resized.disconnect(); clearTimeout(state.contentTimer); }, { once: true });
  }

  // The content or the layout changed: re-measure (soon); unchanged groups are kept.
  function contentChanged(state, wait) {
    if (state.dead) return;
    state.perf.changes = (state.perf.changes || 0) + 1;
    clearTimeout(state.contentTimer);
    state.contentTimer = setTimeout(() => {
      if (state.dead || state.phase === 'exiting') return;
      const light = pageIsLight(state.ctx.scope);
      if (light !== state.light && state.applied.has(CLASS_NIGHT)) {
        // The site theme switched: the inversion follows the page's lightness.
        state.light = light;
        document.documentElement.classList.toggle(CLASS_INVERT, light);
        if (light) state.applied.add(CLASS_INVERT);
      }
      state.gen++;                        // the current model is stale; groups refresh in place
      state.modelStale = true;
      schedule(state);
    }, wait);
  }

  // A lost GPU context: a fresh renderer, with every group uploaded again.
  function restoreContext(state) {
    if (state.dead) return;
    const old = state.canvas;
    const fresh = canvasEl(); old.replaceWith(fresh); state.canvas = fresh;
    state.renderer = makeRenderer(state);
    sizeCanvases(state);
    for (const group of state.groups.values()) { group.buf = null; state.renderer.create(group); }
    state.dirty = true; wake(state);
  }

  function calm(state) {
    for (const group of state.groups.values()) {
      if (!group.data) continue;
      group.off.fill(0); group.vel.fill(0); group.awake.fill(0); group.awakeCount = 0;
      if (group.data.n) state.renderer.uploadOffsets(group, 0, group.data.n - 1);
    }
    state.rings.fill(0); state.lag = 0; state.scrollSmooth = window.scrollY;
  }

  /* ---------------------------------------------------------------------------
   * The frame
   * ------------------------------------------------------------------------- */
  // The core's shared loop calls tick() while it is registered; when nothing moves the
  // lens unregisters. Each registration carries a token, so a stale callback does nothing.
  function wake(state) {
    if (state.dead || state.ticking || underCover(state)) return;
    // Arriving, the page paints itself first (its photos keep the GPU busy, and a WebGL frame
    // would wait for that on the main thread): frames wait for the rest timer, unless the
    // reader scrolls or moves first, or the lens leaves.
    if (resting(state)) return;
    state.ticking = true;
    const token = ++state.frameToken;
    const off = state.ctx.frame(dt => (token === state.frameToken ? tick(state, dt) : false));
    state.unframe = typeof off === 'function' ? off : null;
  }
  // An arrival's rest: no frame runs yet (see arrive()).
  const resting = state => state.restUntil > performance.now() && !state.restBroken && state.phase !== 'exiting';
  // A change to what is drawn (a group built, replaced or hidden): the next frame shows it.
  // During an arrival's rest no frame runs, so one render (and nothing else) shows it then.
  function show(state) {
    if (state.dead) return;
    if (!resting(state)) { wake(state); return; }
    if (state.showTimer || !state.renderer) return;
    state.showTimer = setTimeout(() => {
      state.showTimer = 0;
      if (state.dead || state.ticking) return;
      placeGroups(state);
      render(state, performance.now());
      state.perf.restRenders = (state.perf.restRenders || 0) + 1;
    }, 0);
  }
  function sleep(state) {
    state.frameToken++;
    if (state.unframe) { state.unframe(); state.unframe = null; }
    state.ticking = false;
  }

  function tick(state, dt) {
    if (state.dead) return false;
    if (underCover(state)) { sleep(state); return false; }
    const began = performance.now();
    dt = clamp(dt > 0 ? dt : 1 / 60, 0, 0.05);
    const reduced = state.ctx.motion.matches;
    const phaseAtStart = state.phase;
    let busy = false;
    // Transitions
    if (state.phase === 'entering') {
      state.enterT = (began - state.enterAt) / 1000;
      const p = state.groundP = groundProgress(state);
      state.night = nightMix(state, p);
      captionTone(state, p);
      busy = true;
      if (state.enterT >= state.enterEnd && (p > 0.995 || state.enterT > state.enterEnd + SETTLE_SLACK)) finishEnter(state);
    } else if (state.phase === 'exiting') {
      // An instant reset (the first egg, pagehide) or reduced motion switched on meanwhile:
      // the exit finishes at once.
      if (state.ctx.instant || state.ctx.motion.matches) { finishExit(state); return false; }
      state.exitT = (began - state.exitAt) / 1000;
      const p = state.groundP = groundProgress(state);
      state.night = nightMix(state, p);
      busy = true;
      if (state.exitT >= state.exitEnd && (p < 0.005 || state.exitT > state.exitEnd + SETTLE_SLACK)) {
        // The ink now shows every glyph in its day colour: swap back to the page itself.
        finishExit(state);
        if (lastPerf) lastPerf.finalFrameMs = performance.now() - began;
        return false;
      }
    }
    // Scroll lag: a smoothed scroll position trails the real one.
    const scrollY = window.scrollY;
    if (reduced) { state.scrollSmooth = scrollY; state.lag = 0; } else {
      state.scrollSmooth += (scrollY - state.scrollSmooth) * (1 - Math.exp(-dt / LAG_TAU));
      let lag = state.scrollSmooth - scrollY;
      if (Math.abs(lag) < 0.05) { state.scrollSmooth = scrollY; lag = 0; }
      state.lag = lag / (1 + Math.abs(lag) / LAG_MAX);
      if (lag) busy = true;
    }
    if (scrollY !== state.lastScrollY || window.scrollX !== state.lastScrollX) {
      if (scrollY !== state.lastScrollY) state.scrollDir = scrollY > state.lastScrollY ? 1 : -1;
      state.lastScrollY = scrollY; state.lastScrollX = window.scrollX; state.dirty = true;
      // The window moved far enough: build ahead (the builder runs between frames).
      if (Math.abs(scrollY - state.windowAt) > BAND_H / 2) { state.windowAt = scrollY; schedule(state); }
    }
    placeGroups(state);
    // The images dissolve (or return) with the sweep.
    if (state.phase === 'entering' || state.phase === 'exiting') updateMasks(state);
    // Wind (while leaving, disturbed particles only spring home)
    if (stepWind(state, dt, reduced)) busy = true;
    // Rings, in viewport coordinates for the shader
    let ringsLive = false;
    for (let k = 0; k < RING_MAX; k++) {
      state.ringView[k * 4 + 3] = 0;
      if (state.rings[k * 4 + 3] <= 0) continue;
      const age = (began - state.ringAt[k]) / 1000;
      if (age > RING_LIFE || reduced) { state.rings[k * 4 + 3] = 0; state.dirty = true; continue; }
      state.rings[k * 4 + 2] = age;
      state.ringView[k * 4] = state.rings[k * 4] - window.scrollX; state.ringView[k * 4 + 1] = state.rings[k * 4 + 1] - scrollY;
      state.ringView[k * 4 + 2] = age; state.ringView[k * 4 + 3] = 1;
      busy = true; ringsLive = true;
    }
    // Hover
    const h = state.hover;
    const goal = h.id > 0 ? 1 : 0;
    if (h.amount !== goal || h.prevAmount > 0) {
      const k = reduced ? 1 : 1 - Math.exp(-dt / HOVER_TAU);
      h.amount += (goal - h.amount) * k;
      h.prevAmount -= h.prevAmount * k;
      if (h.prevAmount < 0.01) { h.prevAmount = 0; h.prevId = -1; }
      if (Math.abs(h.amount - goal) < 0.01) h.amount = goal;
      busy = true; state.dirty = true;
    }
    // Groups still fading in
    for (const group of state.groups.values()) if (group.visible && group.alpha < 1) { busy = true; break; }
    if (state.phase === 'entering' || state.phase === 'exiting' || ringsLive || state.ringsDrawn) drawInk(state);
    const shimmer = !reduced && state.phase !== 'build';
    if (busy || state.dirty || (shimmer && began - state.lastRender >= 1000 / SHIMMER_FPS - 4)) render(state, began);
    const spent = performance.now() - began;
    const perf = state.perf;
    perf.frames++; perf.total += spent; perf.last = spent; if (spent > perf.max) perf.max = spent;
    const by = perf.byPhase[phaseAtStart] || (perf.byPhase[phaseAtStart] = { frames: 0, total: 0, max: 0 });
    by.frames++; by.total += spent; if (spent > by.max) by.max = spent;
    if (busy || state.dirty) return true;
    // Nothing moves. The slow shimmer alone needs SHIMMER_FPS frames: the shared loop rests
    // in between, and a timer wakes the lens for the next one.
    sleep(state);
    if (shimmer) {
      clearTimeout(state.shimmerTimer);
      state.shimmerTimer = setTimeout(() => wake(state), Math.max(0, 1000 / SHIMMER_FPS - (performance.now() - state.lastRender)));
    }
    return false;
  }

  function render(state, now) {
    const u = state.uniforms; const r0 = performance.now();
    u.w = state.W; u.h = state.H;
    u.time = (now - state.startedAt) / 1000; u.shimmer = state.ctx.motion.matches ? 0 : SHIMMER;
    u.night = state.night; u.lag = state.lag;
    u.enterT = state.phase === 'live' || state.phase === 'exiting' && state.enterT >= state.enterEnd ? 1e4 : state.enterT;
    u.exitT = state.phase === 'exiting' ? state.exitT : -1;
    u.dpr = state.renderer.kind === 'canvas2d' ? 1 : state.dpr;
    const h = state.hover;
    u.hoverId = h.id; u.hoverAmount = h.amount; u.prevId = h.prevId; u.prevAmount = h.prevAmount;
    const renderer = state.renderer;
    renderer.begin(u);
    let drawn = 0;
    // Images first, then text. The groups of a box that hides what scrolls beneath it (a
    // sticky column with its own background) go last, over their cleared box.
    const covered = new Map();
    for (const images of [true, false]) {
      for (const group of state.groups.values()) {
        if (!group.visible || !group.data || group.stale || !!group.image !== images) continue;
        if (group.cover) { const list = covered.get(group.box.el) || []; list.push(group); covered.set(group.box.el, list); continue; }
        renderer.draw(group, u); drawn++;
      }
    }
    for (const list of covered.values()) {
      renderer.occlude(list[0].cover, u);
      for (const group of list) { renderer.draw(group, u); drawn++; }
    }
    renderer.end();
    state.lastRender = now; state.dirty = false; state.perf.renders = (state.perf.renders || 0) + 1;
    state.perf.render = performance.now() - r0; state.perf.drawn = drawn;
    if (state.perf.render > (state.perf.renderMax || 0)) { state.perf.renderMax = state.perf.render; state.perf.renderMaxAt = r0; }
  }

  /*
   * The pointer as a gentle wind: particles within WIND_RADIUS are pushed away (and
   * along the pointer's motion) in proportion to its speed, then spring home with
   * damping. Only awake particles are integrated, and only their index range of each
   * group's offsets is uploaded.
   */
  function stepWind(state, dt, reduced) {
    const pointer = state.pointer;
    const quiet = (performance.now() - pointer.at) / 1000;
    if (quiet > 0.03) { const k = Math.exp(-dt / POINTER_TAU); pointer.vx *= k; pointer.vy *= k; }
    const speed = Math.hypot(pointer.vx, pointer.vy);
    const gust = reduced || state.phase === 'exiting' || !pointer.in ? 0 : Math.min(speed / WIND_SPEED_REF, WIND_GUST_MAX);
    let moving = false;
    const R = WIND_RADIUS; const R2 = R * R; const reach = R + 8;
    const ux = pointer.vx / (speed || 1); const uy = pointer.vy / (speed || 1);
    const push = WIND_ACCEL * gust * dt;
    const damp = Math.exp(-DAMPING * dt);
    for (const group of state.groups.values()) {
      const d = group.data; if (!d || !d.n) continue;
      const off = group.off; const vel = group.vel; const st6 = d.statics;
      const awake = group.awake; const list = group.awakeList;
      let lo = d.n; let hi = -1;
      if (gust > 0.02 && group.visible) {
        // The pointer in the group's coordinates
        const px = pointer.x - group.origin.x; const py = pointer.y - group.origin.y;
        if (px + reach >= d.x0 && px - reach <= d.x1 && py + reach >= d.y0 && py - reach <= d.y1) {
          const c0 = clamp(Math.floor((px - reach - d.gx0) / CELL), 0, d.cols - 1); const c1 = clamp(Math.floor((px + reach - d.gx0) / CELL), 0, d.cols - 1);
          const r0 = clamp(Math.floor((py - reach - d.gy0) / CELL), 0, d.rows - 1); const r1 = clamp(Math.floor((py + reach - d.gy0) / CELL), 0, d.rows - 1);
          for (let row = r0; row <= r1; row++) {
            const from = d.cellStart[row * d.cols + c0]; const to = d.cellStart[row * d.cols + c1 + 1];
            for (let i = from; i < to; i++) {
              const x = st6[i * 6] + off[i * 2]; const y = st6[i * 6 + 1] + off[i * 2 + 1];
              const dx = x - px; const dy = y - py; const d2 = dx * dx + dy * dy;
              if (d2 >= R2) continue;
              const dist = Math.sqrt(d2) + 0.01; const fall = 1 - dist / R;
              const seed = st6[i * 6 + 2];
              const f = push * fall * fall * (0.3 + 1.4 * ((seed * 7.13) % 1));
              const nx = dx / dist; const ny = dy / dist;
              const swirl = WIND_SWIRL * (((seed * 31.37) % 1) - 0.5) * 2;
              vel[i * 2] += f * (nx * (1 - WIND_ALONG) + ux * WIND_ALONG - ny * swirl);
              vel[i * 2 + 1] += f * (ny * (1 - WIND_ALONG) + uy * WIND_ALONG + nx * swirl);
              if (!awake[i]) { awake[i] = 1; list[group.awakeCount++] = i; }
            }
          }
          moving = true;
        }
      }
      if (!group.awakeCount) continue;
      // Integrate the awake particles (semi-implicit Euler) and put the settled to sleep.
      let kept = 0;
      for (let k = 0; k < group.awakeCount; k++) {
        const i = list[k];
        const seed = st6[i * 6 + 2];
        const spring = SPRING * (0.6 + 0.8 * ((seed * 13.71) % 1));
        let vx = vel[i * 2]; let vy = vel[i * 2 + 1]; let ox = off[i * 2]; let oy = off[i * 2 + 1];
        vx = (vx - spring * ox * dt) * damp; vy = (vy - spring * oy * dt) * damp;
        ox += vx * dt; oy += vy * dt;
        // A soft bound keeps a hard flick from throwing dust across the page.
        const r = Math.hypot(ox, oy);
        if (r > DRIFT_MAX) { const s = DRIFT_MAX / r; ox *= s; oy *= s; vx *= 0.5; vy *= 0.5; }
        if (i < lo) lo = i; if (i > hi) hi = i;
        if (Math.abs(ox) < SLEEP_OFFSET && Math.abs(oy) < SLEEP_OFFSET && Math.abs(vx) < SLEEP_SPEED && Math.abs(vy) < SLEEP_SPEED) {
          off[i * 2] = 0; off[i * 2 + 1] = 0; vel[i * 2] = 0; vel[i * 2 + 1] = 0; awake[i] = 0;
          continue;
        }
        off[i * 2] = ox; off[i * 2 + 1] = oy; vel[i * 2] = vx; vel[i * 2 + 1] = vy;
        list[kept++] = i;
      }
      group.awakeCount = kept;
      if (hi >= lo) {
        state.renderer.uploadOffsets(group, lo, hi);
        state.perf.uploads++; state.perf.uploaded += hi - lo + 1;
        moving = true;
      }
    }
    return moving;
  }

  // The ink canvas: word sprites in transitions, rings while live.
  function drawInk(state) {
    const g = state.inkG; const ink = state.ink;
    const cw = state.inkCanvas.width; const ch = state.inkCanvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.clearRect(0, 0, cw, ch);
    state.ringsDrawn = false;
    if (state.light && (state.phase === 'entering' || state.phase === 'exiting')) drawPatches(state, g);
    if (ink && (state.phase === 'entering' || state.phase === 'exiting')) {
      const n = state.night; const dpr = state.dpr;
      const eT = state.enterT;            // frozen once the exit begins
      const xT = state.phase === 'exiting' ? state.exitT : -1;
      const alphaOf = (delayIn, delayOut) => {
        const e = clamp((eT - delayIn) / ENTER_DUR, 0, 1);
        const x = xT < 0 ? 0 : clamp((xT - delayOut) / EXIT_DUR, 0, 1);
        return Math.max(inkEnter(e), inkExit(x));
      };
      for (const set of ink.sets) {
        const group = set.group;
        if (group.stale) continue;
        if (group.cover) g.clearRect(group.cover.x0 * dpr, group.cover.y0 * dpr, (group.cover.x1 - group.cover.x0) * dpr, (group.cover.y1 - group.cover.y0) * dpr);
        // A band follows the scroll even if it was re-sampled meanwhile; a box its container.
        const now = group.kind === 'band' ? { x: -window.scrollX, y: -window.scrollY } : group.origin;
        const dx = Math.round((now.x - set.origin.x) * dpr);
        const dy = Math.round((now.y - set.origin.y) * dpr);
        const clip = group.kind === 'box' ? group.clip : null;
        if (clip) { g.save(); g.beginPath(); g.rect(clip.x0 * dpr, clip.y0 * dpr, (clip.x1 - clip.x0) * dpr, (clip.y1 - clip.y0) * dpr); g.clip(); }
        for (const line of set.lines) {
          const a = alphaOf(line.delayIn, line.delayOut);
          if (a < 0.004) continue;
          const dayA = a * (1 - n); const nightA = a * n;
          for (const item of line.ink) {
            const x = item.ox + dx; const y = item.oy + dy;
            if (x > cw || y > ch || x + item.sw < 0 || y + item.sh < 0) continue;
            if (dayA > 0.004) { g.globalAlpha = dayA; g.drawImage(ink.atlases[item.day[0]], item.day[1], item.day[2], item.sw, item.sh, x, y, item.sw, item.sh); }
            if (nightA > 0.004) { g.globalAlpha = nightA; g.drawImage(ink.atlases[item.night[0]], item.night[1], item.night[2], item.sw, item.sh, x, y, item.sw, item.sh); }
          }
        }
        if (clip) g.restore();
      }
      g.globalAlpha = 1;
    }
    // Faint circles for the shockwaves.
    if (state.phase !== 'exiting' && !state.ctx.motion.matches) {
      const dpr = state.dpr;
      for (let k = 0; k < RING_MAX; k++) {
        if (state.rings[k * 4 + 3] <= 0) continue;
        const age = state.rings[k * 4 + 2];
        const radius = age * RING_SPEED; if (radius < 1) continue;
        const a = RING_ALPHA * state.night * Math.exp(-age / RING_DECAY) * (1 - smooth(RING_LIFE * 0.6, RING_LIFE, age));
        if (a < 0.003) continue;
        g.globalAlpha = a;
        g.strokeStyle = 'rgb(205,218,236)'; g.lineWidth = dpr;
        g.beginPath();
        g.arc((state.rings[k * 4] - window.scrollX) * dpr, (state.rings[k * 4 + 1] - window.scrollY) * dpr, radius * dpr, 0, TAU);
        g.stroke();
        state.ringsDrawn = true;
      }
      g.globalAlpha = 1;
    }
  }

  /*
   * A light page, in a transition: a night patch in each image's box (its own shape) under
   * its stars, as present as they are row by row (dustAt()). Where a photo is dark its stars
   * leave cells empty; without the patch the ground, light or passing mid-grey, would show
   * there: a tonal negative of the photo. On the ink canvas, below the dust.
   */
  function drawPatches(state, g) {
    const dpr = state.dpr; const H = state.H;
    for (const group of state.groups.values()) {
      // (By its box: the dark top of a night photo holds no star, yet must stay dark.)
      if (!group.image || group.stale || !group.data || (group.box && !group.box.el.isConnected)) continue;
      const item = group.image;
      const x0 = item.x + group.origin.x; const y0 = item.y + group.origin.y;   // viewport px
      if (y0 > H || y0 + item.h < 0 || x0 > state.W || x0 + item.w < 0) continue;
      const stops = clamp(Math.ceil(item.h / MASK_STOP) + 1, 2, 48);
      const gradient = g.createLinearGradient(0, y0 * dpr, 0, (y0 + item.h) * dpr);
      let shown = false;
      for (let k = 0; k < stops; k++) {
        const t = k / (stops - 1); const a = dustAt(state, y0 + t * item.h, state.late.get(item.img), item.img);
        if (a > 0.004) shown = true;
        gradient.addColorStop(t, `rgba(${NIGHT_RGB.join(',')},${a.toFixed(3)})`);
      }
      if (!shown) continue;
      g.save();
      const c = group.clip;
      if (c) { g.beginPath(); g.rect(c.x0 * dpr, c.y0 * dpr, (c.x1 - c.x0) * dpr, (c.y1 - c.y0) * dpr); g.clip(); }
      g.fillStyle = gradient; g.beginPath();
      if (item.oval) g.ellipse((x0 + item.w / 2) * dpr, (y0 + item.h / 2) * dpr, (item.w / 2) * dpr, (item.h / 2) * dpr, 0, 0, TAU);
      else if (item.radii && typeof g.roundRect === 'function') g.roundRect(x0 * dpr, y0 * dpr, item.w * dpr, item.h * dpr, item.radii.map(([h, v]) => ({ x: h * dpr, y: v * dpr })));
      else g.rect(x0 * dpr, y0 * dpr, item.w * dpr, item.h * dpr);
      g.fill();
      g.restore();
      state.perf.patches = (state.perf.patches || 0) + 1;
    }
  }

  function finishEnter(state) {
    state.phase = 'live'; state.enterT = 1e4; state.night = 1; state.groundP = 1;
    setDip(state, 1);
    captionTone(state, 1);
    for (const img of state.masked) setImageRule(state, img, RULE_HIDDEN);
    state.masked.clear();
    state.ink = null;                    // the sprites are no longer needed
    drawInk(state);
    state.dirty = true;
    if (state.entered) { state.entered(); state.entered = null; }
    schedule(state);
  }

  async function exit(ctx) {
    const state = st;
    if (!state || state.dead) return;
    if (state.entered) { state.entered(); state.entered = null; }   // an enter in progress gives way
    const instant = ctx.instant === true || ctx.motion.matches || document.hidden || !state.renderer || state.phase === 'build' || !state.groups.size;
    if (instant) { finishExit(state); return; }
    if (state.phase === 'exiting') return state.exited;
    // An arrival's rest (the page's first paint goes first) gives way: the exit runs now.
    clearTimeout(state.restTimer); state.restUntil = 0;
    // Freeze the enter where it stands; a line still in ink stays ink.
    const wasEntering = state.phase === 'entering';
    if (!wasEntering) state.enterT = 1e4;
    state.phase = 'exiting';
    // The lightbox's stars fade out on the ground's curve over its photo, which is back at
    // once. From the opacity they have now, before anything lifts the night (readDay() does
    // for a moment, which would restart the class's fade-in; and a CSS transition would not
    // start from an animation that goes in the same change).
    if (state.media) {
      for (const overlay of state.media.overlays) {
        if (!overlay.fixed || typeof overlay.canvas.animate !== 'function') continue;
        const from = getComputedStyle(overlay.canvas).opacity;
        overlay.canvas.animate([{ opacity: from }, { opacity: 0 }], { duration: GROUND_OUT * 1000, easing: GROUND_EASE, fill: 'forwards' });
      }
    }
    readDay(state, true);
    placeGroups(state);
    for (const group of state.groups.values()) if (group.visible) exitDelays(state, group);
    // The images return under the sweep: masked where they can be seen, shown at once
    // elsewhere (and nothing new is sampled from now on).
    state.exitScroll = window.scrollY;
    // On a dark page a graphic loses its own inversion and eases back with the ground (on a
    // light page it keeps following the column, which eases back itself).
    if (!state.light) state.imageBases.clear();
    state.masked.clear();
    // Every rule now carries the column's filter transition, written before the night's
    // classes go (the next style update starts the transitions with it).
    state.ruleTail = RULE_LEAVING;
    for (const img of [...state.imageRules.keys()]) {
      const r = img.getBoundingClientRect();
      if (img.isConnected && r.bottom > -0.25 * state.H && r.top < 1.25 * state.H) {
        state.masked.add(img);
        setImageRule(state, img, state.imageRules.get(img).css);
      } else dropImageRule(state, img);
    }
    for (const job of state.jobs.values()) job.resolve(null);
    state.jobs.clear();
    // Fresh ink for the current viewport (the night classes leave the text colours alone).
    const inkBegan = performance.now();
    state.ink = buildInk(state);
    state.perf.exitBuild = performance.now() - inkBegan;
    state.exitEnd = Math.max(EXIT_SWEEP + EXIT_DUR, GROUND_OUT);
    state.exitAt = performance.now(); state.exitT = 0;
    const html = document.documentElement;
    html.classList.add(CLASS_GROUND, CLASS_LEAVING); state.applied.add(CLASS_GROUND); state.applied.add(CLASS_LEAVING);
    html.classList.remove(CLASS_NIGHT, CLASS_INVERT);
    state.exited = new Promise(resolve => { state.resolveExit = resolve; });
    state.groundP = 1;                   // (the ground is still night: it starts to lift now)
    updateMasks(state);
    wake(state);
    // (In a hidden tab the frames pause, and the core pauses the exit's limit with them: the
    // exit resumes when the tab shows again. A page that is left ends it at once: pagehide
    // makes the core reset instantly, which the next frame or the listener below honours.)
    state.exitWatch = new AbortController();
    window.addEventListener('pagehide', () => finishExit(state), { signal: state.exitWatch.signal });
    return state.exited;
  }

  // The transitions the lens's classes started (the ground, the column and its media, the
  // marks) end now. The core finishes those of an instant exit; an animated exit ends when
  // the ground has (nearly) arrived, and a transition still running then would run on after
  // its rule is gone (Chrome does), leaving the page a hair off its own colours (the back-to-
  // top control's border eases over 0.8 s, longer than the exit). A CSSTransition names a
  // longhand: border-color is four of them.
  const LENS_TRANSITIONS = /^(background-color|filter|color|text-decoration-color|border-(top|right|bottom|left)-color)$/;
  function endTransitions() {
    if (typeof document.getAnimations !== 'function') return;
    const html = document.documentElement; const main = document.getElementById('main-content');
    for (const animation of document.getAnimations()) {
      const el = animation.effect && animation.effect.target;
      if (!el || !LENS_TRANSITIONS.test(animation.transitionProperty || '')) continue;
      if (el === html || el === document.body || el === main || el.matches(MARKS) ||
          (main && main.contains(el) && el.matches('img, video, canvas, iframe, object, embed'))) {
        try { animation.finish(); } catch (error) { /* already gone */ }
      }
    }
  }

  // Complete restoration: glyphs back, classes off, canvases gone, GPU released.
  function finishExit(state) {
    if (state.dead) return;
    state.dead = true;
    clearTimeout(state.contentTimer); clearTimeout(state.shimmerTimer); clearTimeout(state.restTimer); clearTimeout(state.showTimer);
    if (state.exitWatch) { state.exitWatch.abort(); state.exitWatch = null; }
    if (state.glyphs) { state.ctx.hideGlyphs(false); state.glyphs = false; }
    const html = document.documentElement;
    if (html.classList.contains(CLASS_NIGHT)) {
      // An instant exit: the day returns without colour fades. The still class stays until
      // the change is flushed. (An animated exit has finished its fades by now.)
      html.classList.add(CLASS_STILL);
      for (const name of state.applied) if (name !== CLASS_STILL) html.classList.remove(name);
      for (const el of document.querySelectorAll(MARKS)) void getComputedStyle(el).color;
      const main = document.getElementById('main-content');
      if (main) void getComputedStyle(main).filter;
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLASS_STILL);
    } else {
      for (const name of state.applied) html.classList.remove(name);
    }
    state.applied.clear();
    endTransitions();
    if (!state.hadClass && html.hasAttribute('class') && !html.classList.length) html.removeAttribute('class');
    // The images return (their rules go; the core then removes the stylesheet itself), and
    // nothing sampled is kept.
    for (const img of [...state.imageRules.keys()]) dropImageRule(state, img);
    for (const key of ['dipRule', 'haloRule']) {
      const rule = state[key]; if (!rule) continue;
      const sheet = rule.parentStyleSheet;
      const index = sheet ? Array.prototype.indexOf.call(sheet.cssRules, rule) : -1;
      if (index >= 0) sheet.deleteRule(index);
      state[key] = null;
    }
    for (const job of state.jobs.values()) job.resolve(null);
    state.jobs.clear(); state.imageCache.clear(); state.sheet = null;
    // The lightbox's stars go with the lens (they have faded out by now), not a frame later
    // when the core disposes the handle after exit().
    if (state.media) { try { state.media.dispose(); } catch (error) { /* gone */ } state.media = null; }
    // The canvases vanish at once; the GPU and backing stores are released just after.
    const renderer = state.renderer; const groups = [...state.groups.values()];
    const canvases = [state.canvas, state.inkCanvas].filter(Boolean);
    canvases.forEach(c => { c.style.display = 'none'; });
    setTimeout(() => {
      if (renderer) { try { renderer.dispose(groups); } catch (error) { /* context gone */ } }
      canvases.forEach(c => { c.width = 1; c.height = 1; });
    }, 0);
    sleep(state);
    state.ink = null; state.model = null; state.groups = new Map();
    state.phase = 'done';
    lastPerf = { byPhase: state.perf.byPhase, exitBuildMs: state.perf.exitBuild, prepareMs: state.perf.prepareMs, enterInkMs: state.perf.enterInk };
    if (state.entered) { state.entered(); state.entered = null; }
    if (state.resolveExit) { state.resolveExit(); state.resolveExit = null; }
    if (st === state) st = null;
  }

  const lens = {
    id: 'stardust', order: 1, numeral: 'I', label: 'Stardust',
    line: 'Every letter is made of smaller things.',
    ground: '#06080c',                    // the night sky a page opens on while it arrives
    css: true,
    enter, exit, arrive,                  // no caption(): the static line shows as the enter begins
    // Test hook: counts and frame timing of the live activation.
    get _stats() {
      if (!st) return null;
      const p = st.perf;
      let visible = 0; let awake = 0;
      for (const g of st.groups.values()) { if (g.visible) visible++; awake += g.awakeCount || 0; }
      // Bands on screen that hold text but are not built (yet), or still fading in.
      let missing = 0;
      if (st.model) {
        const sy = window.scrollY;
        for (let k = Math.floor(sy / BAND_H); k * BAND_H < sy + st.H; k++) {
          const y0 = k * BAND_H; const y1 = y0 + BAND_H;
          const hasText = st.model.entries.some(e => e.top < y1 && e.bottom > y0);
          const g = st.groups.get(`b${k}`);
          if (hasText && (!g || g.stale || g.alpha < 0.5)) missing++;
        }
      }
      return {
        phase: st.phase, enterT: +st.enterT.toFixed(3), exitT: +st.exitT.toFixed(3), renderer: p.renderer, particles: st.particles, groups: st.groups.size, visibleGroups: visible, missing,
        boxes: [...st.groups.values()].filter(g => g.kind === 'box').length, building: st.building, gen: st.gen,
        prepareMs: +(p.prepareMs || 0).toFixed(1), arrivedAt: p.arrivedAt ? Math.round(p.arrivedAt) : null, frames: p.frames, avgMs: p.frames ? +(p.total / p.frames).toFixed(3) : 0,
        maxMs: +p.max.toFixed(2), lastMs: +p.last.toFixed(3), awake,
        uploads: p.uploads, avgUploaded: p.uploads ? Math.round(p.uploaded / p.uploads) : 0, renderMs: +p.render.toFixed(3),
        exitBuildMs: +(p.exitBuild || 0).toFixed(1), enterInkMs: +(p.enterInk || 0).toFixed(1),
        sliceMaxMs: +(p.sliceMax || 0).toFixed(1), changes: p.changes || 0, models: p.models || 0, modelMs: +(p.modelMs || 0).toFixed(1), builds: p.builds || 0, buildWallMs: p.builds ? +(p.buildWall / p.builds).toFixed(1) : 0,
        arriveMs: p.arriveMs ? +p.arriveMs.toFixed(1) : null, sliceTags: { ...(p.sliceTags || {}) }, renderMaxMs: +(p.renderMax || 0).toFixed(1), renderMaxAt: Math.round(p.renderMaxAt || 0), slices: p.slices || 0, slicesOver: p.slicesOver || 0,
        layouts: p.layouts || 0, renders: p.renders || 0, restRenders: p.restRenders || 0, stale: [...st.groups.values()].filter(g => g.stale).length,
        lightboxRenders: p.lightbox || 0, fixedOverlays: st.media ? st.media.overlays.filter(o => o.fixed).length : 0, images: [...st.groups.values()].filter(g => g.image).length, imageSamples: p.images || 0,
        imageSliceMaxMs: +(p.imageSliceMax || 0).toFixed(1), svgDrawMs: +(p.svgDrawMs || 0).toFixed(1), jobs: st.jobs.size, rules: st.imageRules.size,
        tintMax: p.tintMax || 0, covered: st.covered, patches: p.patches || 0, waiting: st.waiting.size,
        byPhase: Object.fromEntries(Object.entries(p.byPhase).map(([k, v]) => [k, { frames: v.frames, avgMs: +(v.total / v.frames).toFixed(3), maxMs: +v.max.toFixed(2) }]))
      };
    },
    _reset() { if (st) { Object.assign(st.perf, { frames: 0, total: 0, max: 0, uploads: 0, uploaded: 0, byPhase: {}, sliceMax: 0, imageSliceMax: 0, slices: 0, slicesOver: 0, sliceTags: {} }); } },
    // Test hook: every image the model holds, and what became of it.
    get _images() {
      if (!st || !st.model) return [];
      return st.model.images.map(item => {
        const group = st.groups.get(item.gkey); const rule = st.imageRules.get(item.img);
        return {
          img: item.img, src: item.img.getAttribute('src'), built: !!(group && group.data), visible: !!(group && group.visible),
          kind: group ? group.imageKind : kinds.get(item.src) || null, step: group ? +group.step.toFixed(2) : null,
          particles: group && group.data ? group.data.n : 0, rule: rule ? rule.css : null, selector: rule ? rule.selector : null, base: st.imageBases.get(item.img) || '',
          failed: st.imageFailed.has(item.key), queued: st.jobs.has(item.key), boxed: !!(group && group.box), clipped: !!(group && group.clip)
        };
      });
    },
    // Test hook: the words the live groups hold for the text inside el, in viewport px.
    _wordsIn(el) {
      const out = [];
      if (!st) return out;
      placeGroups(st);
      for (const group of st.groups.values()) {
        if (!group.data || group.stale) continue;
        for (const w of group.words) {
          if ((w.node && el.contains(w.node)) || (w.marker && el.contains(w.marker))) out.push({ text: w.text, left: w.x + group.origin.x, top: w.y + group.origin.y, width: w.width, height: w.height, marker: !!w.marker });
        }
      }
      return out;
    },
    // Test hook: the particles at home inside a viewport rectangle (all groups placed now).
    _particlesIn(rect) {
      const out = { n: 0, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      if (!st) return out;
      placeGroups(st);
      for (const group of st.groups.values()) {
        const d = group.data; if (!d || group.stale) continue;
        for (let i = 0; i < d.n; i++) {
          const x = d.statics[i * 6] + group.origin.x; const y = d.statics[i * 6 + 1] + group.origin.y;
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
          out.n++; out.x0 = Math.min(out.x0, x); out.y0 = Math.min(out.y0, y); out.x1 = Math.max(out.x1, x); out.y1 = Math.max(out.y1, y);
        }
      }
      return out;
    },
    // Test hook: an image's particles as built, in CSS px from its content box's top left
    // (x, y pairs), with the box's size and each particle's night colour (r, g, b, alpha);
    // null when it has none.
    _pointsOf(img) {
      if (!st || !st.model) return null;
      const item = st.model.images.find(i => i.img === img);
      const group = item && st.groups.get(item.gkey);
      if (!group || !group.data || group.stale) return null;
      const d = group.data; const out = new Float32Array(d.n * 2); const at = group.image;
      for (let i = 0; i < d.n; i++) { out[i * 2] = d.statics[i * 6] - at.x; out[i * 2 + 1] = d.statics[i * 6 + 1] - at.y; }
      const night = new Uint8Array(d.n * 4);
      for (let i = 0; i < d.n; i++) for (let k = 0; k < 4; k++) night[i * 4 + k] = d.colours[i * 8 + 4 + k];
      return { w: at.w, h: at.h, points: out, night };
    },
    // Test hook: the timing of the last activation, kept after its exit.
    get _lastPerf() { return lastPerf; }
  };

  if (window.SiteLenses && typeof window.SiteLenses.register === 'function') window.SiteLenses.register(lens);
})();
