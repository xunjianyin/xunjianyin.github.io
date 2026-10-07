/**
 * Lenses media helper (window.SiteLensesMedia). A lens redraws the page's images (photos,
 * figures, project images) on canvases laid over them; the page's own <img> elements are
 * never touched. The core loads this file once, on the first ctx.media(options) of any lens.
 * A lens that only needs pixels (Stardust drawing an image as particles) uses the utilities;
 * a lens that restyles every image uses the handle.
 *
 * Utilities (pure):
 *   readable(img)  true when img has loaded and its pixels may be read: same origin, data:,
 *                  blob:, or a cross-origin image the server allowed (canvas stays untainted).
 *   draw(img, cssW, cssH, dpr, fit, ground)  a canvas of round(cssW * dpr) x round(cssH * dpr)
 *                  holding img as it is displayed in a cssW x cssH content box. fit is the
 *                  img's computed style, { objectFit, objectPosition }, or an object-fit
 *                  keyword (default 'fill'). The backing store is capped at MAX_PIXELS
 *                  (FIXED_MAX_PIXELS for an image inside a position: fixed container, such as
 *                  the photography lightbox, which fills most of the viewport); above it the
 *                  canvas is scaled down and canvas.pixelRatio reports the device px per CSS px
 *                  actually used (otherwise it equals dpr). ground (a CSS colour) is
 *                  filled under the image. Synchronous: a large photo is resampled on the main
 *                  thread, so prefer drawAsync (or the handle) for photos.
 *   drawAsync(...) the same, as a Promise; a same-origin raster image is decoded and resized
 *                  off the main thread (createImageBitmap of the file, from the HTTP cache).
 *   plan(img, cssW, cssH, dpr, fit)  where draw(), drawAsync() and the handle put the image,
 *                  so a lens can decode the file again at exactly the helper's crop:
 *                  { width, height, ratio } (the canvas size after the pixel cap, and the
 *                  device px per CSS px it holds) and the visible part of the image as a source
 *                  rectangle in natural px { sx, sy, sw, sh } drawn to { dx, dy, dw, dh } in
 *                  canvas px. Instead of the rectangles: whole: true for an image without a
 *                  natural size (an SVG; it fills the canvas), empty: true when none of it is
 *                  visible. (_plan is the same function, under its earlier name.)
 *   sample(img)    a Promise of the image as ImageData of at most 64 x 64 points (nearest
 *                  sampling, resized off the main thread where possible), or null when its
 *                  pixels may not be read: what the handle classifies. (The display-size
 *                  decode the handle draws from cannot stand in for it: its smooth resize
 *                  blends a figure's flat fills and a dark screenshot's near-black into new
 *                  colours, and 11 of the site's figures and screenshots then read as photos
 *                  at some display size; so the handle decodes the sample alongside it.)
 *   classify(imageData, source)  'photo' | 'graphic', read on at most 64 x 64 points (nearest
 *                  sampling). source (an img or a URL, optional) marks SVG. Thresholds below.
 *   stats(imageData)  the numbers classify() decides on: { clear, distinct, fills }, as shares
 *                  of the points (distinct is a count), plus dark, the share of dark points.
 *
 * The handle: const media = await ctx.media({ render, ground, select, fixed })
 *   select   images in ctx.scope to redraw (default 'img'). Skipped: an image that is not
 *            rendered (display none, zero size), has visibility: hidden, is smaller than
 *            24 x 24 CSS px, sits inside a position: fixed ancestor (the photography
 *            lightbox; unless fixed is true), or has not loaded yet (it is picked up when it
 *            loads, through ctx.onLayoutChange). A lens that wants the originals hidden under
 *            its overlays must use opacity: 0 (or pass ground, so the overlays are opaque),
 *            never visibility: hidden, which would remove the overlays at the next relayout.
 *   fixed    optional, true: images inside a position: fixed container are redrawn too, in
 *            the scope or outside it (images matching select in a fixed container anywhere
 *            in <body>, such as the photography lightbox, which is not in the scope). Their
 *            overlays live in one ctx.layer('fixed') (class lenses-media-layer and
 *            lenses-media-fixed, viewport coordinates), made with the first of them, whose
 *            z-index is set just above the highest such container (at least 900), so they
 *            sit over the container's backdrop and image. They follow the container as it
 *            opens, changes its image and closes: each container is watched (its class,
 *            style, src and hidden attributes and its nodes), as are its images' load events,
 *            and <body>'s children (a container added later). An image outside the scope is
 *            not windowed (it is in view whenever it shows) and is drawn before the others,
 *            also when the container is already open as the handle is made. When the
 *            container's image asks for another file (the lightbox's next and previous) its
 *            overlay is hidden at once, in the container's MutationObserver callback, before
 *            the next paint (it would otherwise stand, stretched, over the new image's box),
 *            and the new render shows when it is ready; when the container stops showing it
 *            (it closes) the overlay goes there and then.
 *            These overlays are drawn at up to FIXED_MAX_PIXELS (the lightbox is large).
 *            Text the container draws above the image (positioned elements: the
 *            lightbox's close and arrow controls, its caption) stays visible: the overlay is
 *            masked out along those glyphs (each run drawn in its own font on a small canvas,
 *            the hole subtracted with mask-composite), so on a phone the arrows over the
 *            photo still show; the controls keep the pointer like every image. Without the
 *            option nothing outside the scope is read and these images are skipped as above.
 *   render(source)  called once per image per size, one image at a time. source:
 *            { img, canvas, ctx2d, width, height, dpr, cssWidth, cssHeight, readable, kind }:
 *            canvas (width x height device px, dpr px per CSS px) already holds the image as
 *            displayed; when readable is false (a cross-origin image) its pixels must not be
 *            read. Return a canvas to show (the same one, changed, or a new one), or null to
 *            leave the image alone; a Promise of either is fine. Long work must yield.
 *   ground   optional CSS colour filled under transparent images before render().
 * Overlays live in one ctx.layer('page'): one canvas per image (class lenses-media,
 * data-kind = kind) over the image's content box in document coordinates, rounded like that
 * box (the image's border-radius less its border and padding). An image inside a clipping or
 * scrolling ancestor (a paper's .figure-scroll on a phone) is clipped to that ancestor's
 * padding box and follows its scroll. Overlays never take the pointer, so the
 * original image keeps hit-testing; they should be opaque (pass ground for transparent images)
 * so the original is covered.
 * Windowing: overlays exist for images within NEAR_MARGIN of the viewport and are dropped
 * beyond FAR_MARGIN (IntersectionObservers on the document); renders are cached by (source,
 * size, dpr, fit, ground). The renders no overlay shows are kept in an LRU of CACHE_BYTES; a
 * render on screen never counts against it and is never evicted. The overlays follow
 * onLayoutChange, onContentChange and resizes; new images (late content, lazy loads) are
 * picked up. A jump (a fragment link, scrollTo) brings images back on screen before the
 * observers report (they report after the paint): on each scroll of the document the
 * overlays of images now on screen whose render is cached are put back at once, within
 * ATTACH_MS, so no frame shows them blank; nothing new is rendered there.
 * Order: the images near the viewport are drawn nearest first, ranked by where they are when
 * the next one is picked (a photo column rebalances as the photos above it load): those in
 * the viewport first, then by the distance of their centre from the viewport's. The file
 * decodes (fetch, then createImageBitmap at display size, off the main thread) run up to
 * DECODES at a time in that order, so one heavy file does not hold up the photos after it;
 * the draws and render() calls still come one image at a time, each in its own task.
 *   media.overlays  live array of { img, canvas, kind, fixed } (fixed: in the fixed layer).
 *                   The records are live too: when an image is drawn again (a new size, the
 *                   next photo in the lightbox) its record keeps its place and record.canvas
 *                   is swapped in place, so a caller comparing canvases keeps its own
 *                   reference to the one it saw.
 *   media.kindOf(img)  'photo' | 'graphic', the helper's classification of an image it has
 *                   classified already (any handle's, by source), or null: a lens making
 *                   placeholders need not sample() it again.
 *   media.ready     Promise (of the handle): the overlays near the viewport exist. It also
 *                   resolves, with the overlays as they are, as soon as ctx.signal aborts (exit
 *                   begins, or a reset interrupts enter()) or the handle is disposed, so an
 *                   enter() that awaits it never holds up a reset.
 *   media.refresh() measures and places every overlay again
 *   media.each(fn)  fn(overlay) for every overlay shown, now and later (a re-rendered overlay
 *                   is reported again with its new canvas); returns an unsubscribe function
 *   media.dispose() removes the overlays and every listener; the core calls it after exit()
 * Once exit() begins nothing new is rendered; the overlays stay for the exit transition.
 * No animation frame is used. The helper's own work per task (timed in _state, including the
 * synchronous draw after each decode) stays under 8 ms for raster images. The one exception
 * is the first draw of an SVG into a canvas, where the browser lays out the SVG document once
 * (3-18 ms on a 2020 Mac, at any canvas size, so neither tiles nor a lower pixel ratio split
 * it); later draws of the same SVG take 1-4 ms.
 */
(() => {
  'use strict';
  if (window.SiteLensesMedia) return;

  /* ---------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------- */
  const MAX_PIXELS = 1.6e6;          // backing store cap of one drawn image (device px) ...
  const FIXED_MAX_PIXELS = 3.2e6;    // ... and of one in a position: fixed container (the lightbox
                                     // at DPR 2 is 1968 x 1476 = 2.9 MP: drawn sharp, not upscaled)
  const MIN_SIDE = 24;               // CSS px: smaller images are left alone
  const NEAR_MARGIN = '150%';        // overlays are made within 1.5 screens of the viewport ...
  const FAR_MARGIN = '400%';         // ... and dropped beyond 4 screens
  const CACHE_BYTES = 64 * 1024 * 1024;   // LRU budget of the renders off screen (4 bytes per px)
  const DECODES = 2;                 // file decodes in flight at once (or waiting for their draw)
  const ATTACH_MS = 2;               // ms a document scroll may spend putting cached renders back
  // fixed: true (images in position: fixed containers, such as the photography lightbox)
  const FIXED_Z_MIN = 900;           // the fixed layer's least z-index (the core's layer default)
  const FIXED_ATTRIBUTES = ['class', 'style', 'src', 'srcset', 'hidden'];   // a container opening, closing or changing image
  const FIXED_DELAY_MS = 16;         // a container's changes are gathered this long before the overlays follow

  // Classification, on at most SAMPLE x SAMPLE points of the image (nearest sampling keeps a
  // graphic's flat fills exact). Measured on the site's own images (October 2026): the
  // portraits and the 18 photographs in photos/, the 26 project screenshots in
  // photos/project-demo/, and the 36 paper figures; the browser suite
  // tests/browser_lenses_media.js checks the gallery's photos, every paper figure and the
  // dark project screenshots.
  const SAMPLE = 64;
  const ALPHA_OPAQUE = 250;          // a point below this alpha is see-through ...
  const ALPHA_SHARE = 0.01;          // ... and more than 1% of them makes a graphic
  const FEW_COLOURS = 64;            // at most 64 colours (5 bits per channel): a graphic.
                                     // Photos have 138 or more (Snow as Flower is the fewest).
  const FILL_COLOURS = 8;            // the 8 commonest colours (5 bits per channel) ...
  const FILL_SHARE = 0.75;           // ... cover 75% of the points or more: a graphic (a flat
                                     // background and the fills of boxes). Photos reach 0.69
                                     // (Snow as Flower), figures 0.79 and up (agent-x).
  const DARK_MAX = 40;               // points darker than this in every channel are one colour,
                                     // "dark" (a dark UI's near-black gradient is one fill) ...
  const DARK_FEW = 128;              // ... which counts as a fill only in an image of at most
                                     // 128 colours. Dark app screenshots have 83-117 colours
                                     // (nnviz, CodeRead, Tower of Babel, games, Bouncing Ball;
                                     // their fills reach 0.83-0.98, games the least) and their
                                     // background is a fill; night photos clip their skies to
                                     // black but have 225 colours or more (The Two-Dimensional
                                     // Tower, Shadow), so their black is not a fill.

  /* ---------------------------------------------------------------------------
   * Utilities
   * ------------------------------------------------------------------------- */
  const srcOf = source => (typeof source === 'string' ? source : source && (source.currentSrc || source.src)) || '';
  const isSvg = source => /^data:image\/svg\+xml|\.svgz?(?:[?#]|$)/i.test(srcOf(source));

  const taint = new Map();           // src -> readable, for cross-origin images
  function readable(img) {
    if (!(img instanceof HTMLImageElement) || !img.complete || (!img.naturalWidth && !isSvg(img))) return false;
    const src = srcOf(img);
    let url;
    try { url = new URL(src, location.href); } catch (error) { return false; }
    if (url.origin === location.origin || url.protocol === 'data:' || url.protocol === 'blob:') return true;
    if (taint.has(src)) return taint.get(src);
    let ok = false;
    try {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const g = probe.getContext('2d');
      g.drawImage(img, 0, 0, 1, 1);
      g.getImageData(0, 0, 1, 1);
      ok = true;
    } catch (error) { ok = false; }
    taint.set(src, ok);
    return ok;
  }

  // object-position, as computed: two lengths, percentages or calc() sums of both ("right 10px"
  // computes to "calc(100% - 10px)"); keywords are tolerated. Anything else is centred.
  const KEYWORDS = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
  const TERM = /^([+-]?)\s*(\d*\.?\d+(?:e[+-]?\d+)?)(%|px)?$/i;
  function offset(token, free) {
    if (token in KEYWORDS) return KEYWORDS[token] * free;
    const calc = /^calc\((.*)\)$/i.exec(token);
    // A sum of terms: "100%", "-10px", or "100% - 10px" inside calc().
    const terms = calc ? calc[1].replace(/\s+([+-])\s+/g, ' $1').trim().split(/\s+/) : [token];
    let total = 0;
    for (const term of terms) {
      const match = TERM.exec(term);
      if (!match || (!match[3] && Number(match[2]) !== 0)) return free / 2;
      const value = Number(match[2]) * (match[1] === '-' ? -1 : 1);
      total += match[3] === '%' ? (value / 100) * free : value;
    }
    return total;
  }
  // The top-level space-separated tokens of a value (spaces inside parentheses do not split).
  function tokens(value) {
    const out = []; let word = ''; let depth = 0;
    for (const ch of String(value).trim()) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && /\s/.test(ch)) { if (word) out.push(word); word = ''; } else word += ch;
    }
    if (word) out.push(word);
    return out;
  }

  // The border-radius of an element's padding box (withPadding false) or content box (true),
  // as a border-radius value: each outer corner radius (scaled down as CSS does when adjacent
  // radii would overlap) minus the border, and the padding, on each side (CSS Backgrounds 3,
  // 5.2). s is the computed style, width x height the border box. '' when no corner is round.
  const CORNERS = [['borderTopLeftRadius', 'Left', 'Top'], ['borderTopRightRadius', 'Right', 'Top'],
    ['borderBottomRightRadius', 'Right', 'Bottom'], ['borderBottomLeftRadius', 'Left', 'Bottom']];
  function innerRadius(s, width, height, withPadding) {
    const length = (value, of) => (String(value).endsWith('%') ? (parseFloat(value) / 100) * of : parseFloat(value) || 0);
    const radii = CORNERS.map(([name]) => {
      const [h, v = h] = String(s[name] || '0px').trim().split(/\s+/);
      return [length(h, width), length(v, height)];
    });
    if (radii.every(([h, v]) => h <= 0 || v <= 0)) return '';
    const fits = (room, a, b) => (a + b > room ? room / (a + b) : 1);
    const f = Math.min(fits(width, radii[0][0], radii[1][0]), fits(width, radii[3][0], radii[2][0]),
      fits(height, radii[0][1], radii[3][1]), fits(height, radii[1][1], radii[2][1]));
    const inset = side => (parseFloat(s[`border${side}Width`]) || 0) + (withPadding ? parseFloat(s[`padding${side}`]) || 0 : 0);
    const round = n => +Math.max(0, n).toFixed(2);
    const h = radii.map(([x], i) => round(x * f - inset(CORNERS[i][1])));
    const v = radii.map(([, y], i) => round(y * f - inset(CORNERS[i][2])));
    return `${h.join('px ')}px / ${v.join('px ')}px`;
  }
  function fitOf(fit) {
    if (!fit) return { objectFit: 'fill', objectPosition: '50% 50%' };
    if (typeof fit === 'string') return { objectFit: fit, objectPosition: '50% 50%' };
    return { objectFit: fit.objectFit || 'fill', objectPosition: fit.objectPosition || '50% 50%' };
  }

  // The backing store cap for img: FIXED_MAX_PIXELS inside a position: fixed container (an
  // ancestor below <body>, or img itself), MAX_PIXELS elsewhere (and for a detached image).
  function capOf(img) {
    if (!(img instanceof Element) || !img.isConnected) return MAX_PIXELS;
    for (let el = img; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (getComputedStyle(el).position === 'fixed') return FIXED_MAX_PIXELS;
    }
    return MAX_PIXELS;
  }
  // Where the image lands in a cssW x cssH box drawn at dpr: the canvas size, and the visible
  // part of the image as a source rectangle (natural px) and a destination (canvas px).
  const plan = (img, cssW, cssH, dpr, fit) => planAt(img, cssW, cssH, dpr, fit, capOf(img));
  function planAt(img, cssW, cssH, dpr, fit, cap) {
    let width = Math.max(1, Math.round(cssW * dpr));
    let height = Math.max(1, Math.round(cssH * dpr));
    let ratio = dpr;
    if (width * height > cap) {
      const s = Math.sqrt(cap / (width * height));
      width = Math.max(1, Math.floor(width * s)); height = Math.max(1, Math.floor(height * s));
      ratio = dpr * s;
    }
    const rx = width / cssW; const ry = height / cssH;
    const nw = img.naturalWidth; const nh = img.naturalHeight;
    if (!nw || !nh) return { width, height, ratio, whole: true };   // an SVG without a size fills the box
    const { objectFit, objectPosition } = fitOf(fit);
    const contain = Math.min(cssW / nw, cssH / nh);
    const scale = objectFit === 'contain' ? contain : objectFit === 'cover' ? Math.max(cssW / nw, cssH / nh)
      : objectFit === 'none' ? 1 : objectFit === 'scale-down' ? Math.min(1, contain) : null;
    const dw = scale === null ? cssW : nw * scale; const dh = scale === null ? cssH : nh * scale;
    const [px = '50%', py = '50%'] = tokens(objectPosition);
    const ox = scale === null ? 0 : offset(px, cssW - dw); const oy = scale === null ? 0 : offset(py, cssH - dh);
    // The drawn rectangle in canvas px, clipped to the canvas, mapped back to the source.
    const x0 = Math.max(0, ox * rx); const y0 = Math.max(0, oy * ry);
    const x1 = Math.min(width, (ox + dw) * rx); const y1 = Math.min(height, (oy + dh) * ry);
    if (x1 <= x0 || y1 <= y0) return { width, height, ratio, empty: true };
    const sx = ((x0 / rx - ox) / dw) * nw; const sy = ((y0 / ry - oy) / dh) * nh;
    const sw = ((x1 - x0) / (dw * rx)) * nw; const sh = ((y1 - y0) / (dh * ry)) * nh;
    return { width, height, ratio, sx, sy, sw, sh, dx: x0, dy: y0, dw: x1 - x0, dh: y1 - y0 };
  }

  function blank(p, ground) {
    const canvas = document.createElement('canvas');
    canvas.width = p.width; canvas.height = p.height;
    canvas.pixelRatio = p.ratio;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (ground) { g.fillStyle = ground; g.fillRect(0, 0, p.width, p.height); }
    return [canvas, g];
  }
  function paint(g, img, p) {
    if (p.empty) return;
    if (p.whole) g.drawImage(img, 0, 0, p.width, p.height);
    else g.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  }

  function draw(img, cssW, cssH, dpr = window.devicePixelRatio || 1, fit, ground) {
    const p = plan(img, cssW, cssH, dpr, fit);
    const [canvas, g] = blank(p, ground);
    try { paint(g, img, p); } catch (error) { /* not drawable (broken): the ground stays */ }
    return canvas;
  }

  // The image file itself, for decoding off the main thread. createImageBitmap(img) and
  // drawImage(img) decode and resample on the main thread (70-190 ms for the gallery's 18-24
  // megapixel photos); createImageBitmap(blob) decodes and resizes on a decoder thread. The
  // file comes from the HTTP cache. Same origin only (and not SVG, which needs a document).
  // The last BLOBS_KEPT files are kept (an image is sampled and drawn from one fetch), and
  // all of them are let go BLOBS_IDLE_MS after the last use or when a handle is disposed, so
  // no photo file (the gallery has a 15 MB one) stays alive after a lens has left.
  const blobs = new Map();           // src -> Promise<Blob | null>
  const BLOBS_KEPT = 3;              // (the handle decodes two files at once, and samples beside them)
  const BLOBS_IDLE_MS = 3000;
  let blobsTimer = 0;
  const releaseBlobs = () => { clearTimeout(blobsTimer); blobs.clear(); };
  function blobOf(img) {
    const src = srcOf(img);
    let url = null;
    try { url = new URL(src, location.href); } catch (error) { url = null; }
    if (!url || isSvg(img) || typeof createImageBitmap !== 'function' ||
        !(url.origin === location.origin || url.protocol === 'data:' || url.protocol === 'blob:')) return Promise.resolve(null);
    if (!blobs.has(src)) {
      blobs.set(src, fetch(url.href, { cache: 'force-cache', credentials: 'same-origin' })
        .then(response => (response.ok ? response.blob() : null)).catch(() => null));
      while (blobs.size > BLOBS_KEPT) blobs.delete(blobs.keys().next().value);
    }
    clearTimeout(blobsTimer);
    blobsTimer = setTimeout(releaseBlobs, BLOBS_IDLE_MS);
    return blobs.get(src);
  }
  // A bitmap of the file, resized (and cropped) off the main thread, or null.
  async function bitmapOf(img, crop, options) {
    const blob = await blobOf(img);
    if (!blob) return null;
    try {
      const settings = { imageOrientation: 'from-image', ...options };
      return crop ? await createImageBitmap(blob, ...crop, settings) : await createImageBitmap(blob, settings);
    } catch (error) { return null; }
  }

  // drawAsync and sample each come in two parts, so the handle can time the synchronous work
  // that follows the wait: the waiting part (a bitmap decoded and resized off the main thread,
  // or null for an SVG, a cross-origin image or a failure, after which the img itself is
  // decoded) and the drawing part (synchronous; for an SVG or without a bitmap this is where
  // the browser rasterizes or resamples the image).
  async function prepare(img, p) {
    let bitmap = null;
    if (!p.empty && !p.whole) {
      const crop = [p.sx, p.sy, p.sw, p.sh].map(Math.round);
      bitmap = await bitmapOf(img, crop, { resizeWidth: Math.max(1, Math.round(p.dw)), resizeHeight: Math.max(1, Math.round(p.dh)), resizeQuality: 'high' });
    }
    if (!bitmap && typeof img.decode === 'function') await img.decode().catch(() => {});
    return bitmap;
  }
  function finish(g, img, p, bitmap) {
    try {
      if (bitmap) g.drawImage(bitmap, Math.round(p.dx), Math.round(p.dy));
      else paint(g, img, p);
    } catch (error) { /* not drawable (broken): the ground stays */ }
    finally { if (bitmap) bitmap.close(); }
  }
  async function drawAsync(img, cssW, cssH, dpr = window.devicePixelRatio || 1, fit, ground) {
    const p = plan(img, cssW, cssH, dpr, fit);
    const [canvas, g] = blank(p, ground);
    finish(g, img, p, await prepare(img, p));
    return canvas;
  }

  // At most SAMPLE x SAMPLE points of the image, nearest-sampled, as ImageData (null when the
  // pixels may not be read).
  function sampleSize(img) {
    const nw = img.naturalWidth || SAMPLE; const nh = img.naturalHeight || SAMPLE;
    const s = Math.min(1, SAMPLE / Math.max(nw, nh));
    return { w: Math.max(1, Math.round(nw * s)), h: Math.max(1, Math.round(nh * s)) };
  }
  const sampleBitmap = (img, { w, h }) => (img.naturalWidth
    ? bitmapOf(img, null, { resizeWidth: w, resizeHeight: h, resizeQuality: 'pixelated' }) : Promise.resolve(null));
  function readSample(img, { w, h }, bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    try {
      if (bitmap) g.drawImage(bitmap, 0, 0); else g.drawImage(img, 0, 0, w, h);
      return g.getImageData(0, 0, w, h);
    } catch (error) { return null; }
    finally { if (bitmap) bitmap.close(); }
  }
  async function sample(img) {
    const size = sampleSize(img);
    return readSample(img, size, await sampleBitmap(img, size));
  }
  function stats(imageData) {
    const { width, height, data } = imageData;
    const step = Math.max(1, Math.ceil(Math.max(width, height) / SAMPLE));
    const colours = new Set(); const fills = new Map();
    const DARK = -1;                   // the fill key of every dark point
    let points = 0; let clear = 0; let dark = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
        points++;
        if (data[i + 3] < ALPHA_OPAQUE) clear++;
        const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
        colours.add(key);
        const fill = r < DARK_MAX && g < DARK_MAX && b < DARK_MAX ? DARK : key;
        if (fill === DARK) dark++;
        fills.set(fill, (fills.get(fill) || 0) + 1);
      }
    }
    if (colours.size > DARK_FEW) fills.delete(DARK);
    const top = [...fills.values()].sort((a, b) => b - a).slice(0, FILL_COLOURS).reduce((sum, k) => sum + k, 0);
    const share = n => n / Math.max(1, points);
    return { points, clear: share(clear), distinct: colours.size, fills: share(top), dark: share(dark) };
  }

  function classify(imageData, source) {
    if (source && isSvg(source)) return 'graphic';
    if (!imageData || !imageData.data) return 'photo';
    const s = stats(imageData);
    return s.clear > ALPHA_SHARE || s.distinct <= FEW_COLOURS || s.fills >= FILL_SHARE ? 'graphic' : 'photo';
  }

  /* ---------------------------------------------------------------------------
   * The handle
   * ------------------------------------------------------------------------- */
  const warned = new Set();
  const warnOnce = (key, error) => {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`Lenses: media ${key} failed (the image is left as it is).`, error);
  };
  const kinds = new Map();           // src -> 'photo' | 'graphic' (independent of size)

  function create(ctx, options = {}) {
    const render = typeof options.render === 'function' ? options.render : null;
    const ground = typeof options.ground === 'string' && options.ground ? options.ground : null;
    const select = typeof options.select === 'string' && options.select ? options.select : 'img';
    const fixed = options.fixed === true;
    const signal = ctx.signal;
    const layer = ctx.layer('page');
    layer.classList.add('lenses-media-layer');
    let fixedLayer = null;             // ctx.layer('fixed'), made with the first fixed overlay

    const overlays = [];               // live: { img, canvas, kind, fixed }
    // img -> { img, near, gap, distance, overlay, key, outside, asked, shown, decode }: key is
    // the render shown now, shown the last one shown (kept after a drop, for a jump back),
    // asked the file the image asked for when it was drawn, decode a decode started ahead.
    const entries = new Map();
    const clips = new Map();           // clipping ancestor -> { wrap, inner, used }
    const cache = new Map();           // key -> { canvas | null, kind, bytes } (LRU order)
    const eachFns = new Set();
    const queue = new Set();
    let cacheBytes = 0;
    let disposed = false;
    let busy = false;
    let unseen = new Set();            // images the near observer has not reported yet
    let readyDone = false; let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const stopped = () => disposed || signal.aborted;
    // Exit begins (or a reset interrupts enter()): nothing more is drawn, and ready resolves
    // now rather than when the core disposes the handle after exit().
    const onAbort = () => { queue.clear(); entries.forEach(discard); wake(); checkReady(); };
    signal.addEventListener('abort', onAbort, { once: true });

    // One task per image: a message, not a timer (timers are clamped and throttled).
    const channel = new MessageChannel();
    let posted = false;
    channel.port1.onmessage = () => { posted = false; step(); };
    const pump = () => { if (!posted && !busy && !stopped()) { posted = true; channel.port2.postMessage(0); } };

    // The document as the observers' root: inside a frame the margins still apply.
    const observer = (margin, fn) => {
      try { return new IntersectionObserver(fn, { root: document, rootMargin: margin }); } catch (error) {
        return new IntersectionObserver(fn, { rootMargin: margin });
      }
    };
    const near = observer(NEAR_MARGIN, records => {
      const middle = innerHeight / 2;
      for (const record of records) {
        const e = entries.get(record.target);
        if (!e) continue;
        unseen.delete(record.target);
        e.near = record.isIntersecting;
        e.distance = Math.abs(record.boundingClientRect.top + record.boundingClientRect.height / 2 - middle);
        // An overlay coming near is queued too: one made before a resize (or a zoom) while
        // it was farther than NEAR_MARGIN still has its old size, and is drawn again now (an
        // overlay that is current is only placed again).
        if (e.near) want(e);
      }
      pump(); checkReady();
    });
    const far = observer(FAR_MARGIN, records => {
      for (const record of records) {
        const e = entries.get(record.target);
        if (e && !record.isIntersecting) drop(e);
      }
    });

    /* Finding the images --------------------------------------------------------- */
    function scan() {
      const found = new Set();
      for (const root of ctx.scope) {
        if (!root.isConnected) continue;
        for (const img of root.querySelectorAll(select)) if (img instanceof HTMLImageElement) found.add(img);
      }
      const outside = fixed ? fixedImages(found) : null;
      if (outside) outside.forEach(img => found.add(img));
      for (const img of found) {
        if (entries.has(img)) continue;
        const e = { img, near: false, gap: Infinity, distance: Infinity, overlay: null, key: '', outside: !!outside && outside.has(img), asked: '', shown: '', decode: null };
        entries.set(img, e);
        // An image in a fixed container outside the scope is in view whenever it shows: no
        // windowing, first in the queue; measure() finds out whether it shows.
        if (e.outside) { e.near = true; e.gap = 0; e.distance = 0; want(e); continue; }
        unseen.add(img);
        near.observe(img); far.observe(img);
      }
      for (const [img, e] of entries) {
        if (found.has(img) && img.isConnected) continue;
        drop(e); discard(e);
        if (!e.outside) { near.unobserve(img); far.unobserve(img); }
        entries.delete(img); unseen.delete(img); queue.delete(e);
      }
    }

    /* fixed: images in position: fixed containers ------------------------------------ */
    // The images matching select in a fixed container outside the scope (the photography
    // lightbox sits beside #main-content). Every fixed container of an image, in the scope
    // or not, is watched: it opens, closes and changes its image without anything the core's
    // watchers report (they see the scope's content, not class or style changes).
    const ours = el => !!el.closest('.lenses-layer, .lenses-caption');
    const containers = new Map();      // fixed container -> its MutationObserver
    let followTimer = 0;
    const follow = () => {
      if (followTimer || stopped()) return;
      followTimer = setTimeout(() => { followTimer = 0; refresh(); }, FIXED_DELAY_MS);
    };
    function fixedImages(inScope) {
      const style = memo();
      const out = new Set();
      for (const img of document.body.querySelectorAll(select)) {
        if (!(img instanceof HTMLImageElement) || ours(img)) continue;
        const root = fixedRoot(img, style);
        if (!root) continue;
        watchContainer(root);
        if (!inScope.has(img)) out.add(img);
      }
      return out;
    }
    function watchContainer(root) {
      if (containers.has(root) || stopped()) return;
      const observer = new MutationObserver(() => { hideStale(); follow(); });
      observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: FIXED_ATTRIBUTES });
      containers.set(root, observer);
    }
    // The file an image asks for (its src and srcset attributes), as the overlay was drawn.
    const asked = img => `${img.getAttribute('src') || ''}|${img.getAttribute('srcset') || ''}`;
    // A container changed (it opened, closed or was given another image), and its overlays
    // follow at once, in the observer's callback, before the next paint: an overlay whose
    // image no longer shows (the container closed) goes, and one whose image now asks for
    // another file is hidden until its new render is shown. Left to the follow below
    // (FIXED_DELAY_MS, then a render of 0.1-0.5 s) the old render would stand over the new
    // image's box, stretched to it. The new render's canvas comes with a fresh style (show());
    // an image that asks for its old file again shows its overlay again when placed (place()).
    function hideStale() {
      for (const e of entries.values()) {
        const o = e.overlay;
        if (!o || !o.fixed) continue;
        if (!e.img.isConnected || !e.img.getClientRects().length) drop(e);
        else if (asked(e.img) !== e.asked && o.canvas.style.display !== 'none') o.canvas.style.display = 'none';
      }
    }
    // A container added to <body> later, and an outside image loading (the next photo).
    const bodyWatch = fixed ? new MutationObserver(records => {
      const added = records.some(r => [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && !n.matches('.lenses-layer, .lenses-caption')));
      if (added) { hideStale(); follow(); }
    }) : null;
    if (bodyWatch) bodyWatch.observe(document.body, { childList: true });
    const onFixedLoad = event => { const e = entries.get(event.target); if (e && e.outside) follow(); };
    if (fixed) ['load', 'error'].forEach(type => document.addEventListener(type, onFixedLoad, { capture: true, passive: true }));

    /* Measuring (reads only) ------------------------------------------------------ */
    // A pass memoises computed styles, so shared ancestors are read once.
    function memo() {
      const styles = new Map();
      return el => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s); } return s; };
    }
    function pass() {
      return { style: memo(), layer: layer.getBoundingClientRect(), fixedLayer: fixedLayer ? fixedLayer.getBoundingClientRect() : { left: 0, top: 0 }, clips: new Map() };
    }
    // The outermost position: fixed ancestor of img (or img itself) below <body>, or null.
    function fixedRoot(img, style) {
      let root = null;
      for (let el = img; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (style(el).position === 'fixed') root = el;
      }
      return root;
    }
    // The nearest clipping or scrolling ancestor; for an image in a fixed container, only
    // within that container (an ancestor outside it does not clip it).
    function clipOf(img, p, stop) {
      for (let el = img.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        const s = p.style(el);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') return el;
        if (el === stop) break;
      }
      return null;
    }
    function clipBox(el, p) {
      let box = p.clips.get(el);
      if (!box) {
        const r = el.getBoundingClientRect();
        box = { left: r.left + el.clientLeft, top: r.top + el.clientTop, width: el.clientWidth, height: el.clientHeight,
          scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, radius: innerRadius(p.style(el), r.width, r.height, false) };
        p.clips.set(el, box);
      }
      return box;
    }
    const loaded = img => img.complete && (img.naturalWidth > 0 || (isSvg(img) && img.currentSrc !== ''));
    // The image's content box in viewport px, or null when it is not redrawn.
    function measure(e, p) {
      const img = e.img;
      if (!img.isConnected || !loaded(img)) return null;
      const r = img.getBoundingClientRect();
      if (r.width < MIN_SIDE || r.height < MIN_SIDE) return null;
      const s = p.style(img);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
      const root = fixedRoot(img, p.style);   // without the fixed option such an image is skipped
      if (root ? !fixed : e.outside) return null;
      const px = name => parseFloat(s[name]) || 0;
      const left = r.left + px('borderLeftWidth') + px('paddingLeft');
      const top = r.top + px('borderTopWidth') + px('paddingTop');
      const width = r.right - px('borderRightWidth') - px('paddingRight') - left;
      const height = r.bottom - px('borderBottomWidth') - px('paddingBottom') - top;
      if (width < MIN_SIDE || height < MIN_SIDE) return null;
      const clip = clipOf(img, p, root);
      const z = root ? parseInt(p.style(root).zIndex, 10) : NaN;
      return { left, top, width, height, radius: innerRadius(s, r.width, r.height, true), fit: s.objectFit, position: s.objectPosition,
        clip, clipBox: clip ? clipBox(clip, p) : null, layer: root ? p.fixedLayer : p.layer,
        root, z: Number.isFinite(z) ? z : 0, runs: root ? glyphRuns(img, root, { left, top, width, height }, p) : null };
    }
    const dprNow = () => window.devicePixelRatio || 1;
    const keyOf = (img, m) => `${srcOf(img)}|${Math.round(m.width * dprNow())}x${Math.round(m.height * dprNow())}|${dprNow()}|${m.fit}|${m.position}|${ground || ''}`;

    /* Placing (writes only) -------------------------------------------------------- */
    function clipFor(el, host) {
      let c = clips.get(el);
      if (!c) {
        const wrap = document.createElement('div');
        const inner = document.createElement('div');
        wrap.className = 'lenses-media-clip';
        wrap.style.cssText = 'position:absolute;overflow:hidden;margin:0;padding:0;border:0;pointer-events:none';
        inner.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;margin:0;padding:0;border:0';
        wrap.append(inner);
        host.append(wrap);
        c = { wrap, inner, used: 0 };
        clips.set(el, c);
      }
      if (c.wrap.parentNode !== host) host.append(c.wrap);   // its image went into (or out of) a fixed container
      return c;
    }
    // The fixed layer, made with the first fixed overlay, stacked just above the highest
    // fixed container that has an overlay (a lens may raise the lightbox).
    function fixedHost() {
      if (!fixedLayer) {
        fixedLayer = ctx.layer('fixed');
        fixedLayer.classList.add('lenses-media-layer', 'lenses-media-fixed');
      }
      let z = FIXED_Z_MIN - 1;
      for (const e of entries.values()) if (e.overlay && e.overlay.fixed && e.z > z) z = e.z;
      const zIndex = String(Math.max(FIXED_Z_MIN, z + 1));
      if (fixedLayer.style.zIndex !== zIndex) fixedLayer.style.zIndex = zIndex;
      return fixedLayer;
    }
    function placeClip(el, box, layerBox, host) {
      const c = clipFor(el, host);
      Object.assign(c.wrap.style, {
        left: `${box.left - layerBox.left}px`, top: `${box.top - layerBox.top}px`,
        width: `${box.width}px`, height: `${box.height}px`, borderRadius: box.radius
      });
      c.inner.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
      return c;
    }
    function place(e, m) {
      const canvas = e.overlay.canvas;
      e.overlay.fixed = !!m.root; e.z = m.z;
      const host = m.root ? fixedHost() : layer;
      let parent = host; let left; let top;
      if (m.clip) {
        const c = placeClip(m.clip, m.clipBox, m.layer, host);
        parent = c.inner;
        left = m.left - m.clipBox.left + m.clipBox.scrollLeft;
        top = m.top - m.clipBox.top + m.clipBox.scrollTop;
      } else {
        left = m.left - m.layer.left;
        top = m.top - m.layer.top;
      }
      Object.assign(canvas.style, {
        left: `${left}px`, top: `${top}px`, width: `${m.width}px`, height: `${m.height}px`, borderRadius: m.radius
      });
      if (canvas.parentNode !== parent) {
        const was = e.overlay.clip;
        parent.append(canvas);
        e.overlay.clip = m.clip;
        if (was && was !== m.clip) release(was);
        if (m.clip && was !== m.clip) clips.get(m.clip).used++;
      }
      if (m.root || masks.has(canvas)) knockOut(canvas, m.runs || []);
      // A fixed container's overlay shows only while its image asks for the file it was drawn
      // from (hideStale): one placed over another file's box waits hidden for its new render.
      if (m.root) {
        const display = asked(e.img) === e.asked ? 'block' : 'none';
        if (canvas.style.display !== display) canvas.style.display = display;
      }
    }

    /* fixed: the container's text over the image stays visible ------------------------ */
    // A fixed container draws its controls above its image (the lightbox's close and arrow
    // glyphs, its caption: positioned elements, which paint over a static image). The overlay
    // would hide them, so it is masked out along their glyphs: each run is drawn in its own
    // font on a small canvas, and the mask is the whole box minus those canvases
    // (mask-composite: subtract). A run that wraps is cut out as its line boxes. The original
    // control shows through the hole, so its colour, hover and pointer stay the page's.
    const masks = new WeakMap();       // overlay canvas -> the mask key it carries
    const holes = new Map();           // run key -> data: URL of its glyphs
    const HOLES_KEPT = 32;
    const HOLE_PAD = 2;                // CSS px around a run, for glyphs that overhang their box
    // The text runs of positioned elements in the container that cross the image's box
    // (reads only; part of measure()).
    function glyphRuns(img, root, box, p) {
      const positioned = el => {
        for (let x = el; x && x !== root; x = x.parentElement) if (p.style(x).position !== 'static') return true;
        return false;
      };
      const imgPositioned = positioned(img);
      const runs = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        const text = node.data.replace(/\s+/g, ' ').trim();
        if (!text || !el || !positioned(el)) continue;
        // A positioned image paints over the positioned text before it in the tree.
        if (imgPositioned && !(img.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        const s = p.style(el);
        if (s.visibility !== 'visible' || s.display === 'none') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = [...range.getClientRects()].filter(r => r.width >= 1 && r.height >= 1 &&
          r.right > box.left && r.left < box.left + box.width && r.bottom > box.top && r.top < box.top + box.height);
        for (const r of lines) {
          runs.push({
            text: lines.length === 1 ? (s.textTransform === 'uppercase' ? text.toUpperCase() : s.textTransform === 'lowercase' ? text.toLowerCase() : text) : null,
            font: `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, spacing: s.letterSpacing,
            x: r.left - box.left - HOLE_PAD, y: r.top - box.top - HOLE_PAD, w: r.width + 2 * HOLE_PAD, h: r.height + 2 * HOLE_PAD
          });
        }
      }
      return runs;
    }
    // The run's glyphs (or, for a wrapped run, its box) as a mask image.
    function holeOf(run) {
      const dpr = dprNow();
      const w = Math.ceil(run.w); const h = Math.ceil(run.h);
      const key = `${run.text}|${run.font}|${run.spacing}|${w}x${h}|${dpr}`;
      let url = holes.get(key);
      if (url) return url;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      const g = canvas.getContext('2d');
      g.scale(dpr, dpr);
      const inner = { w: run.w - 2 * HOLE_PAD, h: run.h - 2 * HOLE_PAD };
      if (run.text === null) g.fillRect(HOLE_PAD, HOLE_PAD, inner.w, inner.h);
      else {
        g.font = run.font;
        if ('letterSpacing' in g && run.spacing && run.spacing !== 'normal') g.letterSpacing = run.spacing;
        g.textBaseline = 'alphabetic';
        // The run's box is its font's ascent over its descent: the baseline divides it so.
        const metrics = g.measureText(run.text);
        const ascent = metrics.fontBoundingBoxAscent || 0; const descent = metrics.fontBoundingBoxDescent || 0;
        const baseline = HOLE_PAD + (ascent + descent > 0 ? (inner.h * ascent) / (ascent + descent) : inner.h * 0.8);
        g.fillText(run.text, HOLE_PAD, baseline);
      }
      url = canvas.toDataURL();
      if (holes.size >= HOLES_KEPT) holes.delete(holes.keys().next().value);
      holes.set(key, url);
      return url;
    }
    function knockOut(canvas, runs) {
      const key = runs.map(r => `${r.text}|${r.font}|${r.x.toFixed(1)},${r.y.toFixed(1)},${r.w.toFixed(1)}x${r.h.toFixed(1)}`).join(';');
      if (masks.get(canvas) === key) return;
      masks.set(canvas, key);
      const style = canvas.style;
      if (!runs.length) {
        ['maskImage', 'maskPosition', 'maskSize', 'maskRepeat', 'maskComposite', 'maskMode'].forEach(name => { style[name] = ''; });
        return;
      }
      // The top layer (the whole box) is subtracted by the union of the holes under it.
      style.maskImage = ['linear-gradient(#000, #000)', ...runs.map(r => `url("${holeOf(r)}")`)].join(', ');
      style.maskPosition = ['0 0', ...runs.map(r => `${r.x.toFixed(2)}px ${r.y.toFixed(2)}px`)].join(', ');
      style.maskSize = ['100% 100%', ...runs.map(r => `${Math.ceil(r.w)}px ${Math.ceil(r.h)}px`)].join(', ');
      style.maskRepeat = 'no-repeat';
      style.maskComposite = ['subtract', ...runs.map(() => 'add')].join(', ');
      style.maskMode = 'alpha';
    }
    function release(el) {
      const c = clips.get(el);
      if (c && --c.used <= 0) { c.wrap.remove(); clips.delete(el); }
    }
    function show(e, m, canvas, kind) {
      if (canvas.parentNode) {                 // a cached canvas already shown for a twin image
        const copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        copy.getContext('2d').drawImage(canvas, 0, 0);
        canvas = copy;
      }
      canvas.classList.add('lenses-media');
      canvas.dataset.kind = kind;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;display:block;margin:0;padding:0;border:0;pointer-events:none';
      masks.delete(canvas);                    // its style (and any mask) starts afresh
      e.asked = asked(e.img); e.shown = e.key;
      if (e.overlay) {
        const old = e.overlay.canvas;
        e.overlay.canvas = canvas; e.overlay.kind = kind;
        old.replaceWith(canvas);
        if (old.parentNode) old.remove();
      } else {
        e.overlay = { img: e.img, canvas, kind, clip: null, fixed: false };
        overlays.push(e.overlay);
      }
      place(e, m);
      const record = e.overlay;
      eachFns.forEach(fn => { try { fn(record); } catch (error) { warnOnce('each()', error); } });
    }
    function drop(e) {
      if (!e.overlay) return;
      const { canvas, clip } = e.overlay;
      canvas.remove();
      const at = overlays.indexOf(e.overlay);
      if (at >= 0) overlays.splice(at, 1);
      e.overlay = null; e.key = '';
      if (clip) release(clip);
      if (!disposed) evict(null);              // its render is off screen now: it counts
    }

    /* Rendering, one image per task ---------------------------------------------- */
    const want = e => { queue.add(e); };
    // The cache holds every render, shown or not; only the renders no overlay shows count
    // against CACHE_BYTES, and only they are evicted (least recently used first). keep is a
    // key that is about to be shown (rendered, but not placed yet): it is never evicted.
    function evict(keep) {
      const shown = new Set(overlays.map(o => o.canvas));
      const spare = v => v.canvas && !shown.has(v.canvas);
      let spareBytes = 0;
      for (const v of cache.values()) if (spare(v)) spareBytes += v.bytes;
      for (const [k, v] of cache) {
        if (spareBytes <= CACHE_BYTES) break;
        if (k === keep || !spare(v)) continue;
        cache.delete(k); cacheBytes -= v.bytes; spareBytes -= v.bytes;
        v.canvas.width = 0; v.canvas.height = 0;     // frees the backing store now
      }
    }
    function remember(key, value) {
      const bytes = value.canvas ? value.canvas.width * value.canvas.height * 4 : 0;
      const old = cache.get(key);
      if (old) { cache.delete(key); cacheBytes -= old.bytes; }
      cache.set(key, { ...value, bytes });
      cacheBytes += bytes;
      evict(key);
    }
    function recall(key) {
      const hit = cache.get(key);
      if (hit) { cache.delete(key); cache.set(key, hit); }
      return hit;
    }
    // The queued entries near the viewport, nearest first, by where they are now: a photo
    // column rebalances as the photos above it load, so a distance measured when an entry was
    // queued goes stale. The ones in the viewport come first (gap 0; an outside entry of a
    // fixed container always), then the distance of their centre from the viewport's.
    function rank() {
      const ranked = [];
      const middle = innerHeight / 2;
      for (const e of queue) {
        if (!e.near) { queue.delete(e); discard(e); continue; }
        if (!e.outside) {
          const r = e.img.getBoundingClientRect();
          e.gap = Math.max(0, r.top - innerHeight, -r.bottom);
          e.distance = Math.abs(r.top + r.height / 2 - middle);
        }
        ranked.push(e);
      }
      return ranked.sort((a, b) => a.gap - b.gap || a.distance - b.distance);
    }
    let current = null;                // the entry being drawn and rendered
    async function step() {
      if (stopped() || busy) return;
      begin();
      const e = rank()[0];
      if (!e) { end(); checkReady(); return; }
      queue.delete(e);
      busy = true; current = e;
      try { await renderSlices(e); } catch (error) { warnOnce('render', error); }
      end();
      busy = false; current = null;
      if (!stopped()) pump();
      checkReady();
    }
    // The helper's own time per task (its synchronous slices; render() is the lens's time).
    const perf = { slices: 0, maxMs: 0, totalMs: 0 };
    let sliceAt = 0; let sliceOpen = false;
    const begin = () => { sliceAt = performance.now(); sliceOpen = true; };
    const end = () => { const ms = performance.now() - sliceAt; sliceOpen = false; perf.slices++; perf.totalMs += ms; if (ms > perf.maxMs) perf.maxMs = ms; };
    const pause = async promise => { end(); try { return await promise; } finally { begin(); } };
    const timed = fn => { if (sliceOpen) { fn(); return; } begin(); try { fn(); } finally { end(); } };

    /* Decoding ahead ---------------------------------------------------------------- */
    // A decode is the fetch of the file and its createImageBitmap at display size, off the
    // main thread (prepare()), and, for an image not classified yet, the sample's
    // createImageBitmap beside it (both from one fetch; they run in parallel, so a photo waits
    // for the longer of the two, not their sum: 170 ms instead of 315 ms for the gallery's
    // 15 MB PNG). At most DECODES run at once. While one photo decodes or renders, the next
    // nearest start theirs ahead (while fewer than DECODES are running or done and waiting for
    // their turn, so at most DECODES display-size bitmaps wait); the entry being drawn decodes
    // at once, or, with DECODES running (the nearest changed after a scroll), as soon as one of
    // them is done. Each decode is keyed like the render it is for; an entry whose key has
    // changed by its turn (a resize) lets its decode go and decodes again.
    let running = 0; let waiting = 0;  // decodes running, and done but waiting for their entry
    const slots = [];                  // the entry being drawn, waiting for a decode to finish
    const decodes = { started: 0, ahead: 0, used: 0, discarded: 0, peak: 0 };   // for _state
    const closeAll = got => { if (got.bitmap) got.bitmap.close(); if (got.sampled) got.sampled.close(); };
    const wake = () => { while (slots.length && (running < DECODES || stopped())) slots.shift()(); };
    function decode(img, p) {
      running++; decodes.started++; decodes.peak = Math.max(decodes.peak, running);
      const size = !kinds.has(srcOf(img)) && !isSvg(img) && readable(img) ? sampleSize(img) : null;
      const job = { p, done: false, kept: true };
      // (prepare() and sampleBitmap() never reject: a failure gives null.)
      job.promise = Promise.all([prepare(img, p), size ? sampleBitmap(img, size) : null]).then(([bitmap, sampled]) => {
        const got = { bitmap, sampled, size };
        running--; job.done = true;
        if (job.kept) waiting++; else closeAll(got);
        wake();
        if (!stopped()) timed(ahead);
        return got;
      });
      return job;
    }
    // The entry being drawn takes its decode's bitmaps (it closes them itself).
    const take = job => { if (job.kept && job.done) waiting--; job.kept = false; };
    // An entry's decode started ahead that will not be used: its bitmaps are closed (when they
    // arrive), and its place is free then.
    function discard(e) {
      const job = e.decode;
      if (!job) return;
      e.decode = null; decodes.discarded++;
      if (!job.done) { job.kept = false; return; }
      take(job);
      job.promise.then(closeAll);
      if (!stopped()) timed(ahead);
    }
    // Starts the decodes of the nearest queued entries that need one, while places are free.
    const capFor = m => (m.root ? FIXED_MAX_PIXELS : MAX_PIXELS);
    function ahead() {
      if (stopped() || running + waiting >= DECODES || !queue.size) return;
      let p0 = null;
      for (const e of rank()) {
        if (running + waiting >= DECODES) break;
        if (e === current || e.decode) continue;
        p0 = p0 || pass();
        const m = measure(e, p0);
        if (!m) continue;
        const key = keyOf(e.img, m);
        if ((e.overlay && e.key === key) || cache.has(key)) continue;   // nothing to decode
        const p = planAt(e.img, m.width, m.height, dprNow(), { objectFit: m.fit, objectPosition: m.position }, capFor(m));
        if (p.empty || p.whole || isSvg(e.img)) continue;                // an SVG is drawn, not decoded
        e.decode = { key, ...decode(e.img, p) };
        decodes.ahead++;
      }
    }

    async function renderSlices(e) {
      const img = e.img;
      let m = measure(e, pass());
      if (!m) { drop(e); discard(e); return; }
      const key = keyOf(img, m);
      if (e.overlay && e.key === key) { place(e, m); discard(e); return; }
      const was = asked(img);                  // the file it asks for as it is drawn
      let hit = recall(key);
      if (hit) discard(e);
      if (!hit) {
        const src = srcOf(img);
        const canRead = readable(img);
        let kind = kinds.get(src);
        const p = planAt(img, m.width, m.height, dprNow(), { objectFit: m.fit, objectPosition: m.position }, capFor(m));
        const [canvas, g] = blank(p, ground);
        // The decode started ahead for this render, or one started now (and the next nearest
        // entries start theirs while this one waits).
        let job = e.decode && e.decode.key === key ? e.decode : null;
        if (job) { e.decode = null; decodes.used++; } else {
          discard(e);
          if (running >= DECODES) await pause(new Promise(resolve => slots.push(resolve)));
          if (stopped()) return;
          job = decode(img, p);
        }
        ahead();
        const got = await pause(job.promise);
        take(job);
        if (stopped()) { closeAll(got); return; }
        if (!kind) {
          // sample() in its parts, its decode beside the display's: the wait is not the
          // helper's time, the synchronous read after it is (readSample closes the sample).
          if (isSvg(img)) kind = 'graphic';
          else if (!canRead) kind = 'photo';
          else kind = classify(readSample(img, got.size || sampleSize(img), got.sampled), img);
          kinds.set(src, kind);
        } else if (got.sampled) got.sampled.close();
        finish(g, img, p, got.bitmap);         // (closes the bitmap)
        ahead();
        const source = {
          img, canvas, ctx2d: g, width: canvas.width, height: canvas.height,
          dpr: canvas.pixelRatio, cssWidth: m.width, cssHeight: m.height, readable: canRead, kind
        };
        let result = canvas;
        if (render) {
          end();
          try { result = await render(source); } catch (error) { warnOnce('render()', error); result = null; }
          begin();
        }
        if (stopped()) return;
        hit = { canvas: result instanceof HTMLCanvasElement ? result : null, kind };
        remember(key, hit);
      }
      if (!hit.canvas) { drop(e); return; }
      m = measure(e, pass());                  // the page may have moved while rendering
      if (!m || keyOf(img, m) !== key || asked(img) !== was) { if (m) want(e); return; }
      e.key = key;
      show(e, m, hit.canvas, hit.kind);
    }

    function checkReady() {
      if (readyDone) return;
      if (stopped() || (!unseen.size && !busy && ![...queue].some(e => e.near))) { readyDone = true; resolveReady(api); }
    }

    /* Following the page --------------------------------------------------------- */
    function refresh() {
      if (stopped()) return;
      begin();
      try { relayout(); } finally { end(); }
      pump(); checkReady();
    }
    function relayout() {
      scan();
      const p = pass();
      const plans = [];
      for (const e of entries.values()) if (e.overlay || e.near) plans.push([e, measure(e, p)]);
      for (const [e, m] of plans) {
        if (!m) { drop(e); continue; }
        if (e.overlay) place(e, m);
        if (!e.overlay || e.key !== keyOf(e.img, m)) want(e);
      }
    }
    // A clipping ancestor scrolled: its overlays follow (no layout is read). The document
    // scrolled: cached renders go back on screen at once (attachCached).
    const onScroll = event => {
      if (event.target === document) { attachCached(); return; }
      const c = clips.get(event.target);
      if (c) c.inner.style.transform = `translate(${-event.target.scrollLeft}px, ${-event.target.scrollTop}px)`;
    };
    // A jump (a fragment link, scrollTo) brings images on screen whose overlays were dropped
    // beyond FAR_MARGIN; the near observer reports them only after the next paint, so for a
    // frame or two they would show blank (or their original). Scroll events come before the
    // paint: every image now on screen without an overlay whose render is cached (by the key it
    // has now) gets it back here, in document order, until ATTACH_MS have passed. Nothing new is
    // rendered here; anything else is left to the observers.
    function attachCached() {
      if (stopped()) return;
      const began = performance.now();
      let p = null;
      for (const e of entries.values()) {
        if (e.overlay || e.outside || e === current || !e.shown || !cache.has(e.shown)) continue;
        const r = e.img.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
        p = p || pass();
        const m = measure(e, p);
        if (!m) continue;
        const key = keyOf(e.img, m);
        const hit = cache.get(key);
        if (!hit || !hit.canvas) continue;
        recall(key);
        e.key = key;
        show(e, m, hit.canvas, hit.kind);
        if (performance.now() - began > ATTACH_MS) break;
      }
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const offLayout = ctx.onLayoutChange(refresh);
    const offContent = ctx.onContentChange(refresh);

    function dispose() {
      if (disposed) return;
      disposed = true;
      signal.removeEventListener('abort', onAbort);
      releaseBlobs();
      near.disconnect(); far.disconnect();
      document.removeEventListener('scroll', onScroll, { capture: true });
      offLayout(); offContent();
      clearTimeout(followTimer);
      containers.forEach(observer => observer.disconnect()); containers.clear();
      if (bodyWatch) bodyWatch.disconnect();
      if (fixed) ['load', 'error'].forEach(type => document.removeEventListener(type, onFixedLoad, { capture: true }));
      channel.port1.onmessage = null; channel.port1.close(); channel.port2.close();
      queue.clear();
      entries.forEach(e => { drop(e); discard(e); }); entries.clear(); unseen.clear(); wake();
      clips.forEach(c => c.wrap.remove()); clips.clear();
      overlays.length = 0;
      cache.forEach(v => { if (v.canvas && !v.canvas.parentNode) { v.canvas.width = 0; v.canvas.height = 0; } });
      cache.clear(); cacheBytes = 0;
      eachFns.clear();
      holes.clear();
      layer.remove();
      if (fixedLayer) fixedLayer.remove();
      checkReady();
    }

    const api = {
      overlays,
      ready,
      refresh,
      each(fn) {
        if (typeof fn !== 'function' || disposed) return () => {};
        overlays.forEach(record => { try { fn(record); } catch (error) { warnOnce('each()', error); } });
        eachFns.add(fn);
        return () => eachFns.delete(fn);
      },
      dispose,
      get disposed() { return disposed; },
      kindOf(img) { return (img instanceof HTMLImageElement && kinds.get(srcOf(img))) || null; },
      // Test hook: what the handle holds.
      get _state() {
        const shown = new Set(overlays.map(o => o.canvas));
        let spareBytes = 0;
        for (const v of cache.values()) if (v.canvas && !shown.has(v.canvas)) spareBytes += v.bytes;
        return { entries: entries.size, queued: queue.size, busy, unseen: unseen.size, clips: clips.size, cached: cache.size, cacheBytes, spareBytes,
          fixed: overlays.filter(o => o.fixed).length, containers: containers.size,
          decoding: running, decodes: { ...decodes },
          slices: perf.slices, maxSliceMs: +perf.maxMs.toFixed(2), avgSliceMs: +(perf.totalMs / Math.max(1, perf.slices)).toFixed(2) };
      }
    };
    scan();
    pump();                            // an image in a fixed container already open is drawn now
    checkReady();
    return api;
  }

  window.SiteLensesMedia = Object.freeze({ readable, draw, drawAsync, sample, classify, stats, plan, create, _plan: plan });
})();
