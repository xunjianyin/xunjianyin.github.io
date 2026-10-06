/**
 * Lens III · Blueprint: "The page, reading its own structure."
 *
 * The homepage as a technical drawing: a Prussian-blue ground with a fine grid aligned to
 * the main column, near-white text, pale cyan links, a cyanotype portrait, and a few
 * measured annotations (the column width, the photo size, one section gap, three type
 * specs and dashed outlines of the major blocks). Every number is read from
 * getBoundingClientRect and computed style at the moment of drawing. A hover (or focus)
 * inspector shows the box model of the element under the pointer.
 *
 * Only paint changes: colours, backgrounds, text decoration (blueprint.css) and overlays in
 * the core's layers. Nothing may change size, spacing, font or position, so the layout is
 * identical to normal. Enter and exit are CSS transitions; there is no animation loop.
 */
(() => {
  'use strict';

  const ENTER_MS = 900;             // whole entering transition (CSS timings below fit inside)
  const EXIT_MS = 500;              // whole leaving transition
  const LINE_DELAY_MS = 160;        // first dimension line starts drawing
  const LINE_STAGGER_MS = 45;       // between successive dimension lines
  const LINE_DRAW_MS = 500;         // one line drawing itself (must match blueprint.css)
  const LABEL_FONT = '10px ui-monospace, "SF Mono", Menlo, monospace';
  const LABEL_H = 10;               // label height used for spacing decisions
  const ARROW_L = 6;                // arrowhead length
  const ARROW_W = 2.2;              // arrowhead half-width
  const GUTTER = 30;                // column edge → right edge of the side labels (wide layout)
  const DIM_OFFSET = 16;            // feature edge → its dimension line
  const EXT_GAP = 3;                // gap between a feature and its extension line
  const EXT_OVER = 4;               // extension line overshoot past the dimension line
  const LABEL_PAD = 4;              // break in a dimension line on each side of its label
  const GRID_MAJOR = 64;            // major grid step; the minor step (8 px) divides it
  const CYAN_STOPS = [              // cyanotype tone map: luminance → Prussian blue … paper white
    [0.0, [9, 37, 68]],
    [0.42, [33, 88, 140]],
    [0.78, [150, 192, 222]],
    [1.0, [236, 244, 250]]
  ];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CLS = { base: 'lens-blueprint', on: 'lens-blueprint-on', fade: 'lens-blueprint-fade', leaving: 'lens-blueprint-leaving' };

  const html = document.documentElement;
  let state = null;                 // the running activation, or null
  let measurer = null;

  /* ---------- small helpers ---------- */

  // Resolves after ms, or at once when the signal aborts (never rejects).
  const sleep = (ms, signal) => new Promise(resolve => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  const fmt = n => String(Math.round(n * 10) / 10);
  const snap = v => Math.round(v - 0.5) + 0.5;      // centre of a device pixel row/column at DPR 1
  // Lines that mark an element's edge run along the pixel just outside it, so they never
  // touch the glyphs at the edge; the grid's major lines share that pixel at the column.
  const before = v => Math.round(v) - 0.5;            // the pixel left of / above an edge
  const after = v => Math.round(v) + 0.5;             // the pixel right of / below an edge
  const svg = (name, attrs = {}, parent = null) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  };
  const textWidth = text => {
    measurer = measurer || document.createElement('canvas').getContext('2d');
    measurer.font = LABEL_FONT;
    return Math.ceil(measurer.measureText(text).width);
  };
  const family = style => style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
  const lineHeight = style => (style.lineHeight === 'normal' ? 'normal' : fmt(parseFloat(style.lineHeight)));
  // "Lato 28/44.8 · 700": family, size/line-height and weight, all from computed style.
  const typeSpec = element => {
    const style = getComputedStyle(element);
    return `${family(style)} ${fmt(parseFloat(style.fontSize))}/${lineHeight(style)} · ${style.fontWeight}`;
  };

  // Custom properties on <html>. The original style attribute (or its absence) is saved
  // first and put back verbatim on exit. Reading the attribute before removing it matters:
  // Chrome otherwise keeps serializing an empty style="".
  const rootVars = {
    saved: undefined,                 // undefined: nothing set; null: there was no attribute
    set(values) {
      if (this.saved === undefined) this.saved = html.getAttribute('style');
      for (const [name, value] of Object.entries(values)) html.style.setProperty(name, value);
    },
    restore() {
      if (this.saved === undefined) return;
      if (this.saved === null) { html.getAttribute('style'); html.removeAttribute('style'); } else html.setAttribute('style', this.saved);
      this.saved = undefined;
    }
  };

  /* ---------- measuring ---------- */

  // Rects in the layer's coordinates (document coordinates when the layer sits at the origin).
  function rectFrom(r, origin) {
    const x = r.left - origin.x; const y = r.top - origin.y;
    return { x, y, w: r.width, h: r.height, r: x + r.width, b: y + r.height };
  }
  function lineRects(element, origin) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5).map(r => rectFrom(r, origin));
  }

  // Everything the drawing needs, measured now.
  function measure(st) {
    const o = st.root.getBoundingClientRect();
    const origin = { x: o.left, y: o.top };
    const rect = element => rectFrom(element.getBoundingClientRect(), origin);
    const main = document.getElementById('main-content');
    if (!main) return null;
    const mainStyle = getComputedStyle(main);
    const m = rect(main);
    const col = { l: m.x + parseFloat(mainStyle.paddingLeft), r: m.r - parseFloat(mainStyle.paddingRight), t: m.y, b: m.b };
    const q = selector => main.querySelector(selector);
    const nav = [...document.querySelectorAll('#site-nav nav > *')].map(rect).filter(r => r.w > 0 && r.h > 0);
    const photoEl = q('.profile-photo');
    let photo = null;
    if (photoEl && photoEl.getClientRects().length) {
      const box = rect(photoEl);
      const cl = photoEl.clientLeft; const ct = photoEl.clientTop;
      photo = { box, content: { x: box.x + cl, y: box.y + ct, w: photoEl.clientWidth, h: photoEl.clientHeight } };
    }
    const nameEl = q('.profile-text .name');
    const bioEl = q('.profile-text .bio');
    const profileText = q('.profile-text');
    const sections = [...main.querySelectorAll('.homepage-section')].filter(s => s.getClientRects().length);
    const h2El = sections[0]?.querySelector('h2');
    const footerEl = document.querySelector('#site-footer .site-footer');
    return {
      origin, col, nav, photo,
      docW: html.scrollWidth, docH: html.scrollHeight,
      docTop: -(scrollY + origin.y),
      name: nameEl && { el: nameEl, box: rect(nameEl), lines: lineRects(nameEl, origin), spec: typeSpec(nameEl), align: getComputedStyle(nameEl).textAlign },
      bio: bioEl && { el: bioEl, box: rect(bioEl), lines: lineRects(bioEl, origin), spec: typeSpec(bioEl) },
      h2: h2El && { el: h2El, box: rect(h2El), lines: lineRects(h2El, origin), spec: typeSpec(h2El) },
      profileText: profileText && rect(profileText),
      sections: sections.map(rect),
      footer: footerEl && rect(footerEl),
      pronunciation: q('.pronunciation') && rect(q('.pronunciation'))
    };
  }

  /* ---------- the drawing ---------- */

  // Builds the annotation SVG from a measurement. Lines carry pathLength=1 so CSS can draw
  // them with stroke-dashoffset; dashed outlines are revealed through a mask drawn the same way.
  function draw(st, mm) {
    const root = svg('svg', { class: 'lens-bp-svg', width: Math.ceil(mm.docW), height: Math.ceil(mm.docH), 'aria-hidden': 'true' });
    const defs = svg('defs', {}, root);
    const mask = svg('mask', { id: 'lens-bp-outline-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: mm.docW, height: mm.docH }, defs);
    const outlines = svg('g', { class: 'bp-outlines', mask: 'url(#lens-bp-outline-mask)' }, root);
    const lines = svg('g', { class: 'bp-lines' }, root);
    const heads = svg('g', { class: 'bp-heads' }, root);
    const labels = svg('g', { class: 'bp-labels' }, root);
    let order = 0;
    const nextDelay = () => Math.min(LINE_DELAY_MS + LINE_STAGGER_MS * order++, ENTER_MS - LINE_DRAW_MS - 60);

    const line = (x1, y1, x2, y2, delay) => {
      svg('path', { class: 'bp-line', d: `M${x1} ${y1}L${x2} ${y2}`, pathLength: 1, style: `--d:${delay}ms` }, lines);
    };
    // A filled arrowhead whose tip is at (x, y), pointing along (dx, dy).
    const head = (x, y, dx, dy) => {
      const bx = x - dx * ARROW_L; const by = y - dy * ARROW_L;
      svg('path', { class: 'bp-head', d: `M${x} ${y}L${bx - dy * ARROW_W} ${by + dx * ARROW_W}L${bx + dy * ARROW_W} ${by - dx * ARROW_W}Z` }, heads);
    };
    const label = (x, y, text, anchor = 'middle') => {
      const node = svg('text', { class: 'bp-label', x, y, 'text-anchor': anchor, 'dominant-baseline': 'central' }, labels);
      node.textContent = text;
    };
    const outline = r => {
      const x1 = before(r.x); const y1 = before(r.y); const x2 = after(r.r); const y2 = after(r.b);
      const d = `M${x1} ${y1}H${x2}V${y2}H${x1}Z`;
      svg('path', { class: 'bp-dash', d }, outlines);
      svg('path', { class: 'bp-mask-line', d, pathLength: 1 }, mask);
    };

    // Horizontal dimension between x1 and x2 on line y; ext lists feature edges [{ x, y }].
    const hDim = (x1, x2, y, text, ext) => {
      const delay = nextDelay();
      y = snap(y);
      ext.forEach(e => {
        const down = e.y > y;   // feature below the dimension line
        line(e.x, down ? e.y - EXT_GAP : e.y + EXT_GAP, e.x, down ? y - EXT_OVER : y + EXT_OVER, delay);
      });
      const w = textWidth(text); const cx = (x1 + x2) / 2;
      if (x2 - x1 >= w + 2 * LABEL_PAD + 2 * ARROW_L + 6) {
        line(cx - w / 2 - LABEL_PAD, y, x1, y, delay);
        line(cx + w / 2 + LABEL_PAD, y, x2, y, delay);
        label(cx, y, text);
      } else {
        line(x1, y, x2, y, delay);
        label(cx, y - LABEL_H, text);
      }
      head(x1, y, -1, 0); head(x2, y, 1, 0);
    };
    // Vertical dimension between y1 and y2 at x. Too short for an inner label: the arrows go
    // outside and the label sits beside the line (side: 'left' | 'right').
    const vDim = (y1, y2, x, text, ext, side = 'left') => {
      const delay = nextDelay();
      x = snap(x);
      ext.forEach(e => {
        const right = e.x > x;
        line(right ? e.x - EXT_GAP : e.x + EXT_GAP, e.y, right ? x - EXT_OVER : x + EXT_OVER, e.y, delay);
      });
      const cy = (y1 + y2) / 2;
      if (y2 - y1 >= LABEL_H + 2 * LABEL_PAD + 2 * ARROW_L + 6) {
        line(x, cy - LABEL_H / 2 - LABEL_PAD, x, y1, delay);
        line(x, cy + LABEL_H / 2 + LABEL_PAD, x, y2, delay);
        head(x, y1, 0, -1); head(x, y2, 0, 1);
        label(x, cy, text);
      } else {
        const tail = ARROW_L + 7;
        line(x, y1, x, y1 - tail, delay);
        line(x, y2, x, y2 + tail, delay);
        line(x, y1, x, y2, delay);
        head(x, y1, 0, 1); head(x, y2, 0, -1);
        if (side === 'left') label(x - 6, cy, text, 'end'); else label(x + 6, cy, text, 'start');
      }
    };
    // A type spec: label right-aligned at xEnd, with a short leader whose arrow touches xTip.
    const leader = (xEnd, xTip, y, text) => {
      const delay = nextDelay();
      y = snap(y);
      line(xEnd + 5, y, xTip, y, delay);
      head(xTip, y, 1, 0);
      label(xEnd, y, text, 'end');
    };
    // A type spec placed in free space without a leader (narrow layouts).
    const note = (x, y, text, anchor) => label(x, y, text, anchor);

    const { col, photo } = mm;
    const specs = [mm.name, mm.bio, mm.h2].filter(Boolean);
    const widest = Math.max(0, ...specs.map(s => textWidth(s.spec)));
    const wide = col.l >= GUTTER + widest + 12;
    const navBottom = mm.nav.length ? Math.max(...mm.nav.map(r => r.b)) : col.t;
    const navTop = mm.nav.length ? Math.min(...mm.nav.map(r => r.y)) : col.t;
    const photoBeside = photo && mm.profileText && photo.box.x >= mm.profileText.r - 1;

    // 1. Dashed outlines of the major blocks.
    if (mm.profileText) outline(mm.profileText);
    mm.sections.forEach(outline);
    if (mm.footer) outline(mm.footer);

    // 2. Photo: width and height of the image itself (content box, inside its border).
    let photoDimAbove = false;
    if (photo) {
      const c = photo.content;
      const above = !photoBeside && photo.box.y - navBottom >= 16;
      photoDimAbove = above;
      // The image's own edges (inside its 1 px border) carry the extension lines.
      const x1 = before(c.x) + 1; const x2 = after(c.x + c.w) - 1; const y1 = before(c.y) + 1; const y2 = after(c.y + c.h) - 1;
      const y = above ? photo.box.y - 10 : photo.box.b + DIM_OFFSET;
      hDim(x1, x2, y, fmt(c.w), [{ x: x1, y: above ? photo.box.y : photo.box.b }, { x: x2, y: above ? photo.box.y : photo.box.b }]);
      const x = photo.box.r + DIM_OFFSET;
      if (x + textWidth(fmt(c.h)) / 2 + 2 < mm.docW) {
        vDim(y1, y2, x, fmt(c.h), [{ x: photo.box.r, y: y1 }, { x: photo.box.r, y: y2 }], 'right');
      }
    }

    // 3. Main column width: above the navigation when that band is free, otherwise in the gap
    //    between the last section and the footer.
    const colText = fmt(col.r - col.l);
    const topBand = navTop - mm.docTop;
    const lastSection = mm.sections[mm.sections.length - 1];
    if (topBand >= 18 && !photoDimAbove) {
      const y = (mm.docTop + navTop) / 2;
      // Extension lines run down to the column top unless a nav item is in the way.
      const reach = x => (mm.nav.some(r => x >= r.x - 2 && x <= r.r + 2) ? y + 6 : col.t);
      hDim(before(col.l), after(col.r), y, colText, [{ x: before(col.l), y: reach(col.l) }, { x: after(col.r), y: reach(col.r) }]);
    } else if (lastSection && mm.footer && mm.footer.y - lastSection.b >= 22) {
      const y = (lastSection.b + mm.footer.y) / 2;
      hDim(before(col.l), after(col.r), y, colText, [{ x: before(col.l), y: lastSection.b }, { x: after(col.r), y: lastSection.b }]);
    }

    // 4. Type specs of the name, the body text and a section heading.
    if (wide) {
      const xEnd = col.l - GUTTER;
      specs.forEach(s => {
        const first = s.lines[0] || s.box;
        leader(xEnd, before(col.l) - 3, first.y + first.h / 2, s.spec);
      });
    } else {
      // Name: centred (or aligned) just above its first line, if there is room.
      const n = mm.name;
      if (n && n.lines.length) {
        const first = n.lines[0];
        const above = photo && !photoBeside && photo.box.b <= first.y ? photo.box.b : navBottom;
        if (first.y - above >= 14) {
          const anchor = n.align === 'center' ? 'middle' : 'start';
          note(anchor === 'middle' ? (n.box.x + n.box.r) / 2 : n.box.x, first.y - 6, n.spec, anchor);
        }
      }
      // Body: at the end of the first paragraph's last line, or in the gap above the paragraph.
      const bio = mm.bio;
      if (bio && bio.lines.length) {
        const lastTop = Math.max(...bio.lines.map(r => r.y));
        const last = bio.lines.filter(r => r.y >= lastTop - 2);
        const end = Math.max(...last.map(r => r.r));
        const w = textWidth(bio.spec);
        const gapAbove = mm.pronunciation ? bio.lines[0].y - mm.pronunciation.b : 0;
        if (col.r - end >= w + 20) note(col.r, last[0].y + last[0].h / 2, bio.spec, 'end');
        else if (gapAbove >= 14) note(col.r, bio.lines[0].y - gapAbove / 2, bio.spec, 'end');
      }
      // Section heading: right-aligned in the heading's own row.
      const h = mm.h2;
      if (h && h.lines.length) {
        const first = h.lines[0];
        if (col.r - first.r >= textWidth(h.spec) + 20) note(col.r, first.y + first.h / 2, h.spec, 'end');
      }
    }

    // 5. The gap between the first two sections.
    if (mm.sections.length >= 2) {
      const a = mm.sections[0]; const b = mm.sections[1];
      const gap = b.y - a.b;
      if (gap > 4) {
        const y1 = after(a.b); const y2 = before(b.y);   // on the rows of the two blocks' outlines
        if (wide) vDim(y1, y2, col.l - DIM_OFFSET, fmt(gap), [{ x: before(col.l), y: y1 }, { x: before(col.l), y: y2 }], 'left');
        else vDim(y1, y2, col.r - 8, fmt(gap), [], 'left');
      }
    }
    return root;
  }

  // The core's caption sits beside or above the name for a few seconds. A label it would
  // cover waits (hidden) until the caption starts to fade, then fades in.
  function deferUnderCaption(st) {
    const caption = document.querySelector('.lenses-caption');
    const labels = st.drawing ? [...st.drawing.querySelectorAll('.bp-label')] : [];
    const showing = caption && caption.isConnected && caption.classList.contains('is-shown');
    let waiting = false;
    labels.forEach(label => {
      let hit = false;
      if (showing) {
        const c = caption.getBoundingClientRect(); const r = label.getBoundingClientRect();
        hit = r.right > c.left - 6 && r.left < c.right + 6 && r.bottom > c.top - 3 && r.top < c.bottom + 3;
      }
      label.classList.toggle('bp-deferred', hit);
      waiting = waiting || hit;
    });
    if (waiting && !st.captionWatch) {
      st.captionWatch = new MutationObserver(() => {
        if (caption.isConnected && caption.classList.contains('is-shown')) return;
        st.captionWatch.disconnect(); st.captionWatch = null;
        if (state === st) deferUnderCaption(st);
      });
      st.captionWatch.observe(document.body, { childList: true });
      st.captionWatch.observe(caption, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ---------- cyanotype portrait ---------- */

  // The photo re-toned through CYAN_STOPS after a 1–99 % luminance stretch. Drawn once per
  // activation into a canvas that sits over the photo's content box.
  function cyanotype(img, w, h) {
    if (!img.complete || !img.naturalWidth) return null;
    const k = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
    const g = canvas.getContext('2d');
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    let image;
    try { image = g.getImageData(0, 0, canvas.width, canvas.height); } catch (error) { return null; }
    const d = image.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8]++;
    const total = d.length / 4;
    let lo = 0; let hi = 255; let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break; } }
    const lut = new Uint8ClampedArray(256 * 3);
    for (let v = 0; v < 256; v++) {
      const t = Math.min(1, Math.max(0, (v - lo) / Math.max(1, hi - lo)));
      let s = 1;
      while (s < CYAN_STOPS.length - 1 && CYAN_STOPS[s][0] < t) s++;
      const [t0, c0] = CYAN_STOPS[s - 1]; const [t1, c1] = CYAN_STOPS[s];
      const f = (t - t0) / (t1 - t0 || 1);
      for (let c = 0; c < 3; c++) lut[v * 3 + c] = c0[c] + (c1[c] - c0[c]) * f;
    }
    for (let i = 0; i < d.length; i += 4) {
      const v = ((d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8) * 3;
      d[i] = lut[v]; d[i + 1] = lut[v + 1]; d[i + 2] = lut[v + 2];
    }
    g.putImageData(image, 0, 0);
    canvas.className = 'lens-bp-cyan';
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  }

  /* ---------- hover inspector ---------- */

  function buildInspector(parent) {
    const box = svg('svg', { class: 'lens-bp-inspect', 'aria-hidden': 'true' }, parent);
    const defs = svg('defs', {}, box);
    const pattern = svg('pattern', { id: 'lens-bp-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svg('line', { x1: 0.5, y1: 0, x2: 0.5, y2: 5, class: 'bp-hatch' }, pattern);
    const margin = svg('path', { class: 'bp-i-margin', 'fill-rule': 'evenodd', fill: 'url(#lens-bp-hatch)' }, box);
    const padding = svg('path', { class: 'bp-i-padding', 'fill-rule': 'evenodd' }, box);
    const content = svg('rect', { class: 'bp-i-content' }, box);
    const tag = document.createElement('div');
    tag.className = 'lens-bp-tag';
    tag.setAttribute('aria-hidden', 'true');
    parent.appendChild(tag);
    return { box, margin, padding, content, tag, target: null };
  }

  const ring = (ox, oy, ow, oh, ix, iy, iw, ih) =>
    `M${ox} ${oy}h${ow}v${oh}h${-ow}Z M${ix} ${iy}h${iw}v${ih}h${-iw}Z`;

  function describe(element) {
    const tagName = element.tagName.toLowerCase();
    if (element.id) return `${tagName}#${element.id}`;
    const first = element.classList[0];
    return first ? `${tagName}.${first}` : tagName;
  }

  function inspect(st, element) {
    const ins = st.inspector;
    if (!element) {
      if (ins.target) { ins.box.classList.remove('is-on'); ins.tag.classList.remove('is-on'); ins.target = null; }
      return;
    }
    const style = getComputedStyle(element);
    const r = element.getBoundingClientRect();
    if (!r.width && !r.height) { inspect(st, null); return; }
    ins.target = element;
    const o = st.root.getBoundingClientRect();
    const px = name => Math.max(0, parseFloat(style[name]) || 0);
    const inline = style.display === 'inline';
    const mt = inline ? 0 : px('marginTop'); const mb = inline ? 0 : px('marginBottom');
    const ml = px('marginLeft'); const mr = px('marginRight');
    const bt = px('borderTopWidth'); const bb = px('borderBottomWidth'); const bl = px('borderLeftWidth'); const br = px('borderRightWidth');
    const pt = px('paddingTop'); const pb = px('paddingBottom'); const pl = px('paddingLeft'); const pr = px('paddingRight');
    const bx = r.left - o.left; const by = r.top - o.top;
    const mx = bx - ml; const my = by - mt; const mw = r.width + ml + mr; const mh = r.height + mt + mb;
    // Local coordinates inside the inspector SVG, whose origin is the margin box corner.
    const lx = ml; const ly = mt;
    const inX = lx + bl; const inY = ly + bt; const inW = Math.max(0, r.width - bl - br); const inH = Math.max(0, r.height - bt - bb);
    const cX = inX + pl; const cY = inY + pt; const cW = Math.max(0, inW - pl - pr); const cH = Math.max(0, inH - pt - pb);
    Object.assign(ins.box.style, { left: `${mx}px`, top: `${my}px`, width: `${Math.max(1, mw)}px`, height: `${Math.max(1, mh)}px` });
    ins.box.setAttribute('viewBox', `0 0 ${Math.max(1, mw)} ${Math.max(1, mh)}`);
    ins.margin.setAttribute('d', ring(0, 0, mw, mh, lx, ly, r.width, r.height));
    ins.padding.setAttribute('d', ring(lx, ly, r.width, r.height, cX, cY, cW, cH));
    Object.entries({ x: cX + 0.5, y: cY + 0.5, width: Math.max(0, cW - 1), height: Math.max(0, cH - 1) })
      .forEach(([key, value]) => ins.content.setAttribute(key, value));
    ins.tag.textContent = `${describe(element)} · ${family(style)} ${fmt(parseFloat(style.fontSize))}/${lineHeight(style)} · ${Math.round(r.width)}×${Math.round(r.height)}`;
    ins.box.classList.add('is-on'); ins.tag.classList.add('is-on');
    // The tag sits above the margin box, or below it when that would leave the viewport.
    const tagW = ins.tag.offsetWidth; const tagH = ins.tag.offsetHeight;
    const viewTop = -o.top;
    let top = my - tagH - 4;
    if (top < viewTop + 2) top = my + mh + 4;
    const left = Math.min(Math.max(2, mx), html.clientWidth - o.left - tagW - 2);
    ins.tag.style.left = `${left}px`; ins.tag.style.top = `${top}px`;
  }

  /* ---------- activation ---------- */

  function inScope(st, node) {
    return node instanceof Element && node !== html && node !== document.body && st.ctx.scope.some(s => s.contains(node));
  }

  // (Re)measures and redraws the annotations, the grid alignment and the cyanotype position.
  function layout(st) {
    const mm = measure(st);
    if (!mm) return;
    st.signature = signature();
    rootVars.set({
      '--lens-bp-gx': `${((Math.round(mm.col.l + mm.origin.x + scrollX) - 1) % GRID_MAJOR + GRID_MAJOR) % GRID_MAJOR}px`,
      '--lens-bp-gy': `${((Math.round(mm.col.t + mm.origin.y + scrollY) - 1) % GRID_MAJOR + GRID_MAJOR) % GRID_MAJOR}px`
    });
    const drawing = draw(st, mm);
    if (st.drawing) st.drawing.replaceWith(drawing); else st.root.prepend(drawing);
    st.drawing = drawing;
    if (mm.photo) {
      const c = mm.photo.content;
      if (!st.cyan || st.cyanSize !== `${c.w}x${c.h}`) {
        const img = document.querySelector('#main-content .profile-photo');
        const canvas = img && cyanotype(img, c.w, c.h);
        if (st.cyan) st.cyan.remove();
        st.cyan = canvas; st.cyanSize = `${c.w}x${c.h}`;
        if (canvas) st.root.insertBefore(canvas, st.inspector.box);
      }
      if (st.cyan) Object.assign(st.cyan.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` });
    }
    deferUnderCaption(st);
    if (st.inspector.target) inspect(st, st.inspector.target.isConnected ? st.inspector.target : null);
  }

  // Changes that move the drawing: viewport width, column height, document height.
  function signature() {
    const main = document.getElementById('main-content');
    return `${html.clientWidth}|${main ? main.offsetHeight : 0}|${html.scrollHeight}`;
  }

  function bind(st) {
    const { signal } = st.ctx;
    let pointer = null; let hit = false;
    signal.addEventListener('abort', () => { if (st.captionWatch) { st.captionWatch.disconnect(); st.captionWatch = null; } }, { once: true });
    // One update per animation frame at most, run by the core's shared loop; it unregisters
    // itself (returns false), so the loop stops as soon as nothing changes.
    const update = () => {
      if (state !== st || signal.aborted) return false;
      if (st.relayout) { st.relayout = false; if (signature() !== st.signature) layout(st); }
      if (hit && pointer) {
        hit = false;
        const element = document.elementFromPoint(pointer.x, pointer.y);
        const target = inScope(st, element) ? element : null;
        if (target !== st.inspector.target) inspect(st, target);
      }
      return false;
    };
    const schedule = () => { if (!signal.aborted) st.ctx.frame(update); };

    document.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY }; hit = true; schedule();
    }, { passive: true, signal });
    // Touch has no hover: a tap inspects what it lands on.
    document.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      pointer = { x: event.clientX, y: event.clientY }; hit = true; schedule();
    }, { passive: true, signal });
    html.addEventListener('pointerleave', () => { pointer = null; inspect(st, null); }, { signal });
    window.addEventListener('scroll', () => { if (pointer) { hit = true; schedule(); } }, { passive: true, signal });
    document.addEventListener('focusin', event => {
      const target = event.target;
      if (inScope(st, target) && target.matches(':focus-visible')) inspect(st, target);
    }, { signal });
    window.addEventListener('resize', () => { st.relayout = true; schedule(); }, { passive: true, signal });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => { st.relayout = true; schedule(); });
      ['main-content', 'site-footer'].forEach(id => { const node = document.getElementById(id); if (node) observer.observe(node); });
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    }
  }

  async function enter(ctx) {
    const st = { ctx, reduced: ctx.motion.matches, drawing: null, cyan: null, signature: '', relayout: false };
    state = st;
    st.root = document.createElement('div');
    st.root.className = 'lens-bp-root';
    ctx.layer('page').appendChild(st.root);
    st.vignette = document.createElement('div');
    st.vignette.className = 'lens-bp-vignette';
    ctx.layer('fixed').appendChild(st.vignette);
    st.inspector = buildInspector(st.root);

    html.classList.add(CLS.base);
    layout(st);
    const animate = !st.reduced && !document.hidden;
    if (animate) {
      st.root.classList.add('is-animating'); st.vignette.classList.add('is-animating');
      html.classList.add(CLS.fade);
      // Commit the "before" styles so the switch below runs as transitions.
      void getComputedStyle(document.body).backgroundColor;
      void st.root.getBoundingClientRect();
    }
    html.classList.add(CLS.on);
    st.root.classList.add('is-drawn'); st.vignette.classList.add('is-drawn');
    bind(st);
    if (!animate) return;
    await sleep(ENTER_MS, ctx.signal);
    if (state !== st || ctx.signal.aborted) return;
    html.classList.remove(CLS.fade);
    st.root.classList.remove('is-animating'); st.vignette.classList.remove('is-animating');
  }

  async function exit(ctx) {
    const st = state;
    if (!st) return;
    // ctx.motion also reads true during an instant reset (the first egg, pagehide).
    const instant = ctx.instant || ctx.motion.matches || document.hidden;
    inspect(st, null);
    if (!instant) {
      html.classList.add(CLS.fade, CLS.leaving);
      st.root.classList.remove('is-animating'); st.vignette.classList.remove('is-animating');
      st.root.classList.add('is-leaving'); st.vignette.classList.add('is-leaving');
      void getComputedStyle(document.body).backgroundColor;
      html.classList.remove(CLS.on);
      st.root.classList.remove('is-drawn'); st.vignette.classList.remove('is-drawn');
      await sleep(EXIT_MS);
    }
    html.classList.remove(CLS.base, CLS.on, CLS.fade, CLS.leaving);
    rootVars.restore();
    st.root.remove(); st.vignette.remove();
    if (state === st) state = null;
  }

  window.SiteLenses?.register({
    id: 'blueprint',
    order: 3,
    numeral: 'III',
    label: 'Blueprint',
    line: 'The page, reading its own structure.',
    css: true,
    enter,
    exit
  });
})();
