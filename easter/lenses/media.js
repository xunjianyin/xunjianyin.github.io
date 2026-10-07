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
 *                  keyword (default 'fill'). The backing store is capped at MAX_PIXELS; above
 *                  it the canvas is scaled down and canvas.pixelRatio reports the device px per
 *                  CSS px actually used (otherwise it equals dpr). ground (a CSS colour) is
 *                  filled under the image. Synchronous: a large photo is resampled on the main
 *                  thread, so prefer drawAsync (or the handle) for photos.
 *   drawAsync(...) the same, as a Promise; a same-origin raster image is decoded and resized
 *                  off the main thread (createImageBitmap of the file, from the HTTP cache).
 *   sample(img)    a Promise of the image as ImageData of at most 64 x 64 points (nearest
 *                  sampling, resized off the main thread where possible), or null when its
 *                  pixels may not be read: what the handle classifies.
 *   classify(imageData, source)  'photo' | 'graphic', read on at most 64 x 64 points (nearest
 *                  sampling). source (an img or a URL, optional) marks SVG. Thresholds below.
 *   stats(imageData)  the numbers classify() decides on: { clear, distinct, fills }, as shares
 *                  of the points (distinct is a count), plus dark, the share of dark points.
 *
 * The handle: const media = await ctx.media({ render, ground, select })
 *   select   images in ctx.scope to redraw (default 'img'). Skipped: an image that is not
 *            rendered (display none, zero size), has visibility: hidden, is smaller than
 *            24 x 24 CSS px, sits inside a position: fixed ancestor (the photography
 *            lightbox), or has not loaded yet (it is picked up when it loads, through
 *            ctx.onLayoutChange). A lens that wants the originals hidden under its overlays
 *            must use opacity: 0 (or pass ground, so the overlays are opaque), never
 *            visibility: hidden, which would remove the overlays at the next relayout.
 *   render(source)  called once per image per size, one image per task. source:
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
 * picked up.
 *   media.overlays  live array of { img, canvas, kind }
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
  const MAX_PIXELS = 1.6e6;          // backing store cap of one drawn image (device px)
  const MIN_SIDE = 24;               // CSS px: smaller images are left alone
  const NEAR_MARGIN = '150%';        // overlays are made within 1.5 screens of the viewport ...
  const FAR_MARGIN = '400%';         // ... and dropped beyond 4 screens
  const CACHE_BYTES = 64 * 1024 * 1024;   // LRU budget of the renders off screen (4 bytes per px)

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

  // Where the image lands in a cssW x cssH box drawn at dpr: the canvas size, and the visible
  // part of the image as a source rectangle (natural px) and a destination (canvas px).
  function plan(img, cssW, cssH, dpr, fit) {
    let width = Math.max(1, Math.round(cssW * dpr));
    let height = Math.max(1, Math.round(cssH * dpr));
    let ratio = dpr;
    if (width * height > MAX_PIXELS) {
      const s = Math.sqrt(MAX_PIXELS / (width * height));
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
  // The last BLOBS_KEPT files are kept (an image is sampled, then drawn, from one fetch), and
  // all of them are let go BLOBS_IDLE_MS after the last use or when a handle is disposed, so
  // no photo file (the gallery has a 15 MB one) stays alive after a lens has left.
  const blobs = new Map();           // src -> Promise<Blob | null>
  const BLOBS_KEPT = 2;
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
    const signal = ctx.signal;
    const layer = ctx.layer('page');
    layer.classList.add('lenses-media-layer');

    const overlays = [];               // live: { img, canvas, kind }
    const entries = new Map();         // img -> { img, near, distance, overlay, key }
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
    const onAbort = () => { queue.clear(); checkReady(); };
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
      for (const img of found) {
        if (entries.has(img)) continue;
        entries.set(img, { img, near: false, distance: Infinity, overlay: null, key: '' });
        unseen.add(img);
        near.observe(img); far.observe(img);
      }
      for (const [img, e] of entries) {
        if (found.has(img) && img.isConnected) continue;
        drop(e); near.unobserve(img); far.unobserve(img);
        entries.delete(img); unseen.delete(img); queue.delete(e);
      }
    }

    /* Measuring (reads only) ------------------------------------------------------ */
    // A pass memoises computed styles, so shared ancestors are read once.
    function pass() {
      const styles = new Map();
      const style = el => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s); } return s; };
      return { style, layer: layer.getBoundingClientRect(), clips: new Map() };
    }
    function insideFixed(img, p) {
      for (let el = img; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (p.style(el).position === 'fixed') return true;
      }
      return false;
    }
    function clipOf(img, p) {
      for (let el = img.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        const s = p.style(el);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') return el;
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
      if (s.display === 'none' || s.visibility === 'hidden' || insideFixed(img, p)) return null;
      const px = name => parseFloat(s[name]) || 0;
      const left = r.left + px('borderLeftWidth') + px('paddingLeft');
      const top = r.top + px('borderTopWidth') + px('paddingTop');
      const width = r.right - px('borderRightWidth') - px('paddingRight') - left;
      const height = r.bottom - px('borderBottomWidth') - px('paddingBottom') - top;
      if (width < MIN_SIDE || height < MIN_SIDE) return null;
      const clip = clipOf(img, p);
      return { left, top, width, height, radius: innerRadius(s, r.width, r.height, true), fit: s.objectFit, position: s.objectPosition,
        clip, clipBox: clip ? clipBox(clip, p) : null, layer: p.layer };
    }
    const dprNow = () => window.devicePixelRatio || 1;
    const keyOf = (img, m) => `${srcOf(img)}|${Math.round(m.width * dprNow())}x${Math.round(m.height * dprNow())}|${dprNow()}|${m.fit}|${m.position}|${ground || ''}`;

    /* Placing (writes only) -------------------------------------------------------- */
    function clipFor(el) {
      let c = clips.get(el);
      if (!c) {
        const wrap = document.createElement('div');
        const inner = document.createElement('div');
        wrap.className = 'lenses-media-clip';
        wrap.style.cssText = 'position:absolute;overflow:hidden;margin:0;padding:0;border:0;pointer-events:none';
        inner.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;margin:0;padding:0;border:0';
        wrap.append(inner);
        layer.append(wrap);
        c = { wrap, inner, used: 0 };
        clips.set(el, c);
      }
      return c;
    }
    function placeClip(el, box, layerBox) {
      const c = clipFor(el);
      Object.assign(c.wrap.style, {
        left: `${box.left - layerBox.left}px`, top: `${box.top - layerBox.top}px`,
        width: `${box.width}px`, height: `${box.height}px`, borderRadius: box.radius
      });
      c.inner.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
      return c;
    }
    function place(e, m) {
      const canvas = e.overlay.canvas;
      let parent = layer; let left; let top;
      if (m.clip) {
        const c = placeClip(m.clip, m.clipBox, m.layer);
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
      if (e.overlay) {
        const old = e.overlay.canvas;
        e.overlay.canvas = canvas; e.overlay.kind = kind;
        old.replaceWith(canvas);
        if (old.parentNode) old.remove();
      } else {
        e.overlay = { img: e.img, canvas, kind, clip: null };
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
    function nextEntry() {
      let best = null;
      for (const e of queue) {
        if (!e.near) { queue.delete(e); continue; }
        if (!best || e.distance < best.distance) best = e;
      }
      return best;
    }
    async function step() {
      if (stopped() || busy) return;
      const e = nextEntry();
      if (!e) { checkReady(); return; }
      queue.delete(e);
      busy = true;
      try { await renderEntry(e); } catch (error) { warnOnce('render', error); }
      busy = false;
      if (!stopped()) pump();
      checkReady();
    }
    // The helper's own time per task (its synchronous slices; render() is the lens's time).
    const perf = { slices: 0, maxMs: 0, totalMs: 0 };
    let sliceAt = 0;
    const begin = () => { sliceAt = performance.now(); };
    const end = () => { const ms = performance.now() - sliceAt; perf.slices++; perf.totalMs += ms; if (ms > perf.maxMs) perf.maxMs = ms; };
    const pause = async promise => { end(); try { return await promise; } finally { begin(); } };

    async function renderEntry(e) {
      begin();
      try { await renderSlices(e); } finally { end(); }
    }
    async function renderSlices(e) {
      const img = e.img;
      let m = measure(e, pass());
      if (!m) { drop(e); return; }
      const key = keyOf(img, m);
      if (e.overlay && e.key === key) { place(e, m); return; }
      let hit = recall(key);
      if (!hit) {
        const src = srcOf(img);
        const canRead = readable(img);
        let kind = kinds.get(src);
        if (!kind) {
          // sample() and drawAsync() in their parts: the waits are not the helper's time, the
          // synchronous reads and draws after them are.
          if (isSvg(img)) kind = 'graphic';
          else if (!canRead) kind = 'photo';
          else { const size = sampleSize(img); kind = classify(readSample(img, size, await pause(sampleBitmap(img, size))), img); }
          kinds.set(src, kind);
        }
        if (stopped()) return;
        const p = plan(img, m.width, m.height, dprNow(), { objectFit: m.fit, objectPosition: m.position });
        const [canvas, g] = blank(p, ground);
        const bitmap = await pause(prepare(img, p));
        if (stopped()) { if (bitmap) bitmap.close(); return; }
        finish(g, img, p, bitmap);
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
      if (!m || keyOf(img, m) !== key) { if (m) want(e); return; }
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
    // A clipping ancestor scrolled: its overlays follow (no layout is read).
    const onScroll = event => {
      const c = clips.get(event.target);
      if (c) c.inner.style.transform = `translate(${-event.target.scrollLeft}px, ${-event.target.scrollTop}px)`;
    };
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
      channel.port1.onmessage = null; channel.port1.close(); channel.port2.close();
      queue.clear();
      entries.forEach(drop); entries.clear(); unseen.clear();
      clips.forEach(c => c.wrap.remove()); clips.clear();
      overlays.length = 0;
      cache.forEach(v => { if (v.canvas && !v.canvas.parentNode) { v.canvas.width = 0; v.canvas.height = 0; } });
      cache.clear(); cacheBytes = 0;
      eachFns.clear();
      layer.remove();
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
      // Test hook: what the handle holds.
      get _state() {
        const shown = new Set(overlays.map(o => o.canvas));
        let spareBytes = 0;
        for (const v of cache.values()) if (v.canvas && !shown.has(v.canvas)) spareBytes += v.bytes;
        return { entries: entries.size, queued: queue.size, busy, unseen: unseen.size, clips: clips.size, cached: cache.size, cacheBytes, spareBytes,
          slices: perf.slices, maxSliceMs: +perf.maxMs.toFixed(2), avgSliceMs: +(perf.totalMs / Math.max(1, perf.slices)).toFixed(2) };
      }
    };
    scan();
    checkReady();
    return api;
  }

  window.SiteLensesMedia = Object.freeze({ readable, draw, drawAsync, sample, classify, stats, create, _plan: plan });
})();
