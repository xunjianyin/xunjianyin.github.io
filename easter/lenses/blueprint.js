/**
 * Lens III · Blueprint: "The page, reading its own structure."
 *
 * Any page of the site as a technical drawing: a Prussian-blue ground with a fine grid
 * aligned to the main column, near-white text, pale cyan links, and a few measured
 * annotations: the column width, the type specs of the first h1, the first h2 and a body
 * paragraph, one section gap, the homepage photo or one paper figure, and dashed outlines of
 * the major blocks (the homepage) or of the light panels, tables and demo boxes (elsewhere).
 * Every number is read from getBoundingClientRect and computed style when it is drawn. A
 * hover (or focus) inspector shows the box model of the element under the pointer.
 *
 * Two ways of colouring, both paint-only (the layout is identical to normal):
 *   shell pages (home, site pages, blog posts; light or dark site theme): explicit colour
 *     rules in blueprint.css, with images as cyanotypes through a CSS filter;
 *   paper pages (their own design, interactive demos with many colours of their own): one SVG
 *     colour matrix on the nav, main and footer, a hue-preserving negative screened onto the
 *     blue ground. White panels become the ground, ink becomes near-white, every colour
 *     keeps its hue, and figures, canvases and SVG charts read as white-line drawings.
 * Enter: CSS transitions on shell pages, a view-transition crossfade on paper pages; the
 * lines then draw themselves. Arrive (a page opened while the lens is on): the settled state
 * at once. There is no animation loop.
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
  const GROUND_RGB = [15, 58, 99];  // #0f3a63, the paper-page negative maps white here
  const PANEL_MIN_W = 120;          // smallest panel that gets an outline (px)
  const PANEL_MIN_H = 36;
  const PANEL_LIMIT = 80;           // outlines per page at most
  const PANEL_TAGS = new Set(['TABLE', 'PRE', 'BLOCKQUOTE', 'DETAILS', 'FIELDSET']);
  const NO_PANEL_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY', 'IMG', 'CANVAS', 'VIDEO', 'svg', 'FIGURE', 'SCRIPT', 'STYLE']);
  // Shell pages make these transparent (blueprint.css), so they are found by selector.
  const SHELL_PANELS = 'pre, table, blockquote, details, fieldset, .article-note, .article-toc';
  // Where a body paragraph or figure is not looked for.
  const NOT_PROSE = 'figure, [data-paper-demo], .paper-demo, .paper-header, header, nav, aside, table, li, dd, blockquote';
  const CYAN_STOPS = [              // homepage portrait: luminance → Prussian blue … paper white
    [0.0, [9, 37, 68]],
    [0.42, [33, 88, 140]],
    [0.78, [150, 192, 222]],
    [1.0, [236, 244, 250]]
  ];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CLS = {
    base: 'lens-blueprint', on: 'lens-blueprint-on', fade: 'lens-blueprint-fade', leaving: 'lens-blueprint-leaving',
    shell: 'lens-blueprint-shell', paper: 'lens-blueprint-paper', vtIn: 'lens-blueprint-vt-in', vtOut: 'lens-blueprint-vt-out'
  };
  const NEGATIVE_ID = 'lens-bp-negative';

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
  const shown = element => !!element && element.getClientRects().length > 0;
  const alphaOf = color => { const m = /rgba?\(([^)]+)\)/.exec(color); if (!m) return 0; const parts = m[1].split(/[\s,/]+/).filter(Boolean); return parts.length > 3 ? parseFloat(parts[3]) : 1; };

  // The page kind from the core (ctx.page), or worked out here for an older core.
  function pageKind(ctx) {
    if (ctx.page && ctx.page.kind) return ctx.page.kind;
    if (document.querySelector('#main-content.paper-container')) return 'paper';
    if (document.querySelector('#main-content .profile-section')) return 'home';
    return /\/blogs\//.test(location.pathname) ? 'blog' : 'site';
  }

  // The paper-page colour matrix (sRGB): invert lightness while keeping hue (invert, then
  // hue-rotate 180°), then screen onto the ground. Both steps are affine, so one matrix does
  // it: out = 1 − (1 − ground) · H · in, with H the CSS hue-rotate(180deg) matrix.
  function negativeMatrix() {
    const hue = [[-0.574, 1.43, 0.144], [0.426, 0.43, 0.144], [0.426, 1.43, -0.856]];
    const rows = GROUND_RGB.map((value, c) => {
      const keep = 1 - value / 255;
      return [...hue[c].map(h => +(-keep * h).toFixed(4)), 0, 1];
    });
    return [...rows.flat(), 0, 0, 0, 1, 0].join(' ');
  }

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

  // The first paragraph that reads as body text: two lines or more, not in a figure or demo.
  function bodyParagraph(main) {
    for (const p of main.querySelectorAll('p')) {
      if (!shown(p) || p.closest(NOT_PROSE)) continue;
      if (p.textContent.trim().length < 80 || parseFloat(getComputedStyle(p).fontSize) < 13) continue;
      return p;
    }
    return main.querySelector('.profile-text .bio');
  }

  // Sections and articles are one kind whatever their classes; other blocks match on tag and class.
  const sameKind = (a, b) => a.tagName === b.tagName && (/^(SECTION|ARTICLE)$/.test(a.tagName) || a.className === b.className);

  // Free space (px) from an element to the nearest visible neighbour above or below it,
  // looking at its siblings and then its ancestors' siblings up to stop.
  function spaceTo(element, stop, dir, rect) {
    const r = rect(element);
    for (let node = element; node && node !== stop; node = node.parentElement) {
      for (let sib = dir > 0 ? node.nextElementSibling : node.previousElementSibling; sib; sib = dir > 0 ? sib.nextElementSibling : sib.previousElementSibling) {
        if (!shown(sib)) continue;
        const s = rect(sib);
        return dir > 0 ? s.y - r.b : r.y - s.b;
      }
    }
    return 60;
  }

  // Two neighbouring blocks for the section gap: the first pair of same-kind siblings (tag
  // and class) with a real gap, searched breadth-first from main a few levels down; failing
  // that, the first neighbouring pair with a gap at the shallowest level.
  function sectionPair(main, rect) {
    let level = [main]; let fallback = null;
    for (let depth = 0; depth < 4 && level.length; depth++) {
      const next = [];
      for (const container of level) {
        const blocks = [...container.children].filter(el => shown(el) && !NO_PANEL_TAGS.has(el.tagName) && getComputedStyle(el).display !== 'inline')
          .map(el => ({ el, r: rect(el) })).filter(b => b.r.h >= 20);
        for (let i = 0; i + 1 < blocks.length; i++) {
          const a = blocks[i]; const b = blocks[i + 1];
          if (b.r.y - a.r.b < 12) continue;
          if (sameKind(a.el, b.el)) return [a.r, b.r];
          fallback = fallback || [a.r, b.r];
        }
        blocks.forEach(b => { if (b.el.children.length) next.push(b.el); });
      }
      level = next.slice(0, 60);
    }
    return fallback;
  }

  // Panels to outline. Paper pages: blocks with a fill or a full border, and tables, code and
  // the like, outermost only. Shell pages: the known panel elements (their fills are removed).
  function findPanels(st, main, rect) {
    const found = [];
    const big = r => r.w >= PANEL_MIN_W && r.h >= PANEL_MIN_H;
    if (st.mode === 'shell') {
      for (const el of main.querySelectorAll(SHELL_PANELS)) {
        if (found.length >= PANEL_LIMIT) break;
        if (!shown(el) || found.some(f => f.el.contains(el))) continue;
        const r = rect(el);
        if (big(r)) found.push({ el, r });
      }
      return found.map(f => f.r);
    }
    const walk = parent => {
      for (const el of parent.children) {
        if (found.length >= PANEL_LIMIT) return;
        if (NO_PANEL_TAGS.has(el.tagName)) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none') continue;
        if (style.display !== 'contents' && shown(el)) {
          const r = rect(el);
          if (big(r)) {
            const borders = ['Top', 'Right', 'Bottom', 'Left'].filter(side => parseFloat(style[`border${side}Width`]) >= 1 && style[`border${side}Style`] !== 'none').length;
            if (PANEL_TAGS.has(el.tagName) || alphaOf(style.backgroundColor) >= 0.5 || borders === 4) { found.push(r); continue; }
          }
        }
        walk(el);
      }
    };
    walk(main);
    return found;
  }

  // Everything the drawing needs, measured now.
  function measure(st) {
    const o = st.root.getBoundingClientRect();
    const origin = { x: o.left, y: o.top };
    const rect = element => rectFrom(element.getBoundingClientRect(), origin);
    const main = document.getElementById('main-content');
    if (!main || !shown(main)) return null;
    const mainStyle = getComputedStyle(main);
    const m = rect(main);
    const col = { l: m.x + parseFloat(mainStyle.paddingLeft), r: m.r - parseFloat(mainStyle.paddingRight), t: m.y, b: m.b };
    const docTop = -(scrollY + origin.y);
    const navEl = st.ctx.scope.find(el => !el.contains(main) && !main.contains(el) && (el.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING));
    // The nav's visible items (a skip link parked off-screen does not count).
    const nav = navEl ? [...navEl.querySelectorAll('a, button')].filter(shown).map(rect).filter(r => r.w > 0 && r.h > 0 && r.y >= docTop) : [];
    const footerEl = document.querySelector('#site-footer .site-footer, body > footer.paper-footer');
    const typeOf = el => el && shown(el) && { el, box: rect(el), lines: lineRects(el, origin), spec: typeSpec(el), align: getComputedStyle(el).textAlign };
    const mm = {
      origin, col, nav, main,
      docW: html.scrollWidth, docH: html.scrollHeight,
      docTop,
      name: typeOf(main.querySelector('h1')),
      bio: typeOf(bodyParagraph(main)),
      h2: typeOf([...main.querySelectorAll('h2')].find(shown)),
      footer: footerEl && shown(footerEl) ? rect(footerEl) : null,
      pair: sectionPair(main, rect),
      pronunciation: null, photo: null, figure: null, profileText: null, sections: [], panels: []
    };
    // The first ink in main (a visible text node, or media), to find free space above it.
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
    let firstText = null;
    for (let n = walker.nextNode(), tries = 0; n && tries < 40; n = walker.nextNode(), tries++) {
      const range = document.createRange(); range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width > 0.5 && r.height > 0.5) { firstText = r; break; }
    }
    const firstMedia = [...main.querySelectorAll('img, svg, canvas')].find(shown);
    mm.firstInk = Math.min(firstText ? firstText.top - origin.y : Infinity, firstMedia ? rect(firstMedia).y : Infinity);
    const lastChild = [...main.children].reverse().find(shown);
    mm.lastBottom = lastChild ? Math.max(rect(lastChild).b, m.b - parseFloat(mainStyle.paddingBottom)) : m.b;

    if (st.kind === 'home') {
      const photoEl = main.querySelector('.profile-photo');
      if (shown(photoEl)) {
        const box = rect(photoEl);
        mm.photo = { box, content: { x: box.x + photoEl.clientLeft, y: box.y + photoEl.clientTop, w: photoEl.clientWidth, h: photoEl.clientHeight }, beside: false };
      }
      const profileText = main.querySelector('.profile-text');
      if (shown(profileText)) mm.profileText = rect(profileText);
      if (mm.photo && mm.profileText) mm.photo.beside = mm.photo.box.x >= mm.profileText.r - 1;
      mm.sections = [...main.querySelectorAll('.homepage-section')].filter(shown).map(rect);
      const pron = main.querySelector('.pronunciation');
      if (shown(pron)) mm.pronunciation = rect(pron);
    } else {
      mm.panels = findPanels(st, main, rect);
    }
    if (st.kind === 'paper') {
      // One figure's dimensions: the first figure holding a single sizeable image, SVG or
      // canvas (a strip of panels is passed over), outside the demos.
      const sizeable = el => shown(el) && el.getBoundingClientRect().width >= 200 && el.getBoundingClientRect().height >= 80;
      const fig = [...main.querySelectorAll('figure')].find(f => !f.closest('[data-paper-demo]') && f.querySelectorAll('img, svg, canvas').length === 1 && sizeable(f.querySelector('img, svg, canvas')));
      if (fig) {
        const media = fig.querySelector('img, svg, canvas');
        mm.figure = { box: rect(media), below: spaceTo(media, main, 1, rect), above: spaceTo(media, main, -1, rect) };
      }
    }
    return mm;
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
    // A type spec: label right-aligned at xEnd, with a leader whose arrow touches xTip.
    const leader = (xEnd, xTip, y, text) => {
      const delay = nextDelay();
      y = snap(y);
      line(xEnd + 5, y, xTip, y, delay);
      head(xTip, y, 1, 0);
      label(xEnd, y, text, 'end');
    };
    // An image's width and height: the width line above or below (where there is room), the
    // height line to its right.
    const mediaDims = (c, box, room) => {
      const x1 = before(c.x) + 1; const x2 = after(c.x + c.w) - 1; const y1 = before(c.y) + 1; const y2 = after(c.y + c.h) - 1;
      if (room.below >= 26 || room.above >= 26) {
        const above = room.below < 26 || room.preferAbove;
        const y = above ? box.y - 10 : box.b + DIM_OFFSET;
        hDim(x1, x2, y, fmt(c.w), [{ x: x1, y: above ? box.y : box.b }, { x: x2, y: above ? box.y : box.b }]);
      }
      const x = box.r + DIM_OFFSET;
      if (x + textWidth(fmt(c.h)) / 2 + 2 < Math.min(mm.docW, room.right)) {
        vDim(y1, y2, x, fmt(c.h), [{ x: box.r, y: y1 }, { x: box.r, y: y2 }], 'right');
      }
    };

    const { col } = mm;
    const specs = [mm.name, mm.bio, mm.h2].filter(Boolean);
    const widest = Math.max(0, ...specs.map(s => textWidth(s.spec)));
    const wide = col.l >= GUTTER + widest + 12;
    const navBottom = mm.nav.length ? Math.max(...mm.nav.map(r => r.b)) : col.t;
    const navTop = mm.nav.length ? Math.min(...mm.nav.map(r => r.y)) : col.t;

    // 1. Dashed outlines: the homepage's major blocks, elsewhere the panels.
    if (mm.profileText) outline(mm.profileText);
    mm.sections.forEach(outline);
    mm.panels.forEach(outline);
    if (mm.footer && st.kind === 'home') outline(mm.footer);

    // 2. The homepage photo, or one paper figure.
    let topUsed = false;
    const photo = mm.photo;
    if (photo) {
      const above = !photo.beside && photo.box.y - navBottom >= 16;
      topUsed = above;
      mediaDims(photo.content, photo.box, { above: above ? 30 : 0, below: above ? 0 : 30, preferAbove: above, right: Infinity });
    }
    if (mm.figure) mediaDims({ x: mm.figure.box.x, y: mm.figure.box.y, w: mm.figure.box.w, h: mm.figure.box.h }, mm.figure.box, { above: mm.figure.above, below: mm.figure.below, right: col.r + 60 });

    // 3. Main column width: in free space above main's first ink, else above the navigation,
    //    else in the gap between main's last block and the footer.
    const colText = fmt(col.r - col.l);
    const edges = [before(col.l), after(col.r)];
    const bandTop = Math.max(col.t, navBottom);
    if (mm.firstInk - bandTop >= 26 && !topUsed) {
      const y = bandTop + Math.min(16, (mm.firstInk - bandTop) / 2);
      hDim(edges[0], edges[1], y, colText, [{ x: edges[0], y: y + 6 }, { x: edges[1], y: y + 6 }]);
    } else if (navTop - mm.docTop >= 18 && !topUsed) {
      const y = (mm.docTop + navTop) / 2;
      // Extension lines run down to the column top unless a nav item is in the way.
      const reach = x => (mm.nav.some(r => x >= r.x - 2 && x <= r.r + 2) ? y + 6 : col.t);
      hDim(edges[0], edges[1], y, colText, edges.map(x => ({ x, y: reach(x) })));
    } else if (mm.footer && mm.footer.y - mm.lastBottom >= 22) {
      const y = (mm.lastBottom + mm.footer.y) / 2;
      hDim(edges[0], edges[1], y, colText, edges.map(x => ({ x, y: mm.lastBottom })));
    }

    // 4. Type specs of the first h1, a body paragraph and the first h2.
    if (wide) {
      const xEnd = col.l - GUTTER;
      specs.forEach(s => {
        const first = s.lines[0] || s.box;
        leader(xEnd, Math.max(xEnd + 12, Math.min(before(first.x) - 3, s.box.r)), first.y + first.h / 2, s.spec);
      });
    } else {
      // h1: just above its first line (centred or aligned like it), if there is room.
      const n = mm.name;
      if (n && n.lines.length) {
        const first = n.lines[0];
        const above = photo && !photo.beside && photo.box.b <= first.y ? photo.box.b : Math.max(navBottom, col.t - 40);
        if (first.y - above >= 14) {
          const anchor = n.align === 'center' ? 'middle' : 'start';
          label(anchor === 'middle' ? (n.box.x + n.box.r) / 2 : n.box.x, first.y - 6, n.spec, anchor);
        }
      }
      // Body: at the end of the paragraph's last line, or in the gap above it.
      const bio = mm.bio;
      if (bio && bio.lines.length) {
        const lastTop = Math.max(...bio.lines.map(r => r.y));
        const last = bio.lines.filter(r => r.y >= lastTop - 2);
        const end = Math.max(...last.map(r => r.r));
        const w = textWidth(bio.spec);
        const right = Math.min(col.r, bio.box.r);
        const gapAbove = mm.pronunciation ? bio.lines[0].y - mm.pronunciation.b : 0;
        if (right - end >= w + 20) label(right, last[0].y + last[0].h / 2, bio.spec, 'end');
        else if (gapAbove >= 14) label(right, bio.lines[0].y - gapAbove / 2, bio.spec, 'end');
      }
      // h2: right-aligned in the heading's own row.
      const h = mm.h2;
      if (h && h.lines.length) {
        const first = h.lines[0];
        const right = Math.min(col.r, h.box.r);
        if (right - first.r >= textWidth(h.spec) + 20) label(right, first.y + first.h / 2, h.spec, 'end');
      }
    }

    // 5. One section gap.
    if (mm.pair) {
      const [a, b] = mm.pair;
      const gap = b.y - a.b;
      const y1 = after(a.b); const y2 = before(b.y);   // on the rows of the two blocks' outlines
      if (wide) vDim(y1, y2, col.l - DIM_OFFSET, fmt(gap), [{ x: before(col.l), y: y1 }, { x: before(col.l), y: y2 }], 'left');
      else vDim(y1, y2, col.r - 8, fmt(gap), [], 'left');
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

  /* ---------- cyanotype portrait (homepage) ---------- */

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

  // Changes that move the drawing: viewport width, main's height, document height.
  function signature() {
    const main = document.getElementById('main-content');
    return `${html.clientWidth}|${main ? main.offsetHeight : 0}|${html.scrollHeight}`;
  }

  function bind(st) {
    const { signal } = st.ctx;
    if (signal.aborted) return;
    let pointer = null; let hit = false;
    signal.addEventListener('abort', () => { if (st.captionWatch) { st.captionWatch.disconnect(); st.captionWatch = null; } }, { once: true });
    // One update per animation frame at most, run by the core's shared loop; it unregisters
    // itself (returns false), so the loop stops as soon as nothing changes.
    const update = () => {
      if (state !== st || signal.aborted) return false;
      if (st.relayout) { st.relayout = false; if (st.force || signature() !== st.signature) { st.force = false; layout(st); } }
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
    // Late content (blog markdown, star counts, toggled abstracts, demos): measure again.
    // Panels can change without changing any size, so this relayout is forced.
    if (typeof st.ctx.onContentChange === 'function') st.ctx.onContentChange(() => { st.relayout = true; st.force = true; schedule(); });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => { st.relayout = true; schedule(); });
      st.ctx.scope.forEach(node => observer.observe(node));
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    }
  }

  // Runs a style switch inside a view-transition crossfade (paper pages; blueprint.css sets
  // its length), or at once where view transitions are unavailable or not wanted.
  // onReady runs when the crossfade starts (the new state is live in it), or right after the
  // switch without one.
  async function crossfade(st, cls, update, onReady = () => {}) {
    if (typeof document.startViewTransition !== 'function' || st.ctx.motion.matches || document.hidden) { update(); onReady(); return; }
    html.classList.add(cls);
    let vt;
    try { vt = document.startViewTransition(update); } catch (error) { html.classList.remove(cls); update(); onReady(); return; }
    st.vt = vt;
    vt.updateCallbackDone.catch(() => {});
    vt.ready.then(onReady, onReady);
    await vt.finished.catch(() => {});
    if (st.vt === vt) st.vt = null;
    html.classList.remove(cls);
  }

  // Builds the activation: layers, the paper-page filter, classes, the first drawing.
  function build(ctx) {
    const kind = pageKind(ctx);
    const st = { ctx, kind, mode: kind === 'paper' ? 'paper' : 'shell', reduced: ctx.motion.matches, drawing: null, cyan: null, signature: '', relayout: false, force: false, vt: null };
    state = st;
    st.root = document.createElement('div');
    st.root.className = 'lens-bp-root';
    ctx.layer('page').appendChild(st.root);
    st.vignette = document.createElement('div');
    st.vignette.className = 'lens-bp-vignette';
    ctx.layer('fixed').appendChild(st.vignette);
    if (st.mode === 'paper') {
      // The colour matrix that blueprint.css applies to the paper page's nav, main and footer.
      const defs = svg('svg', { class: 'lens-bp-defs', width: 0, height: 0, 'aria-hidden': 'true' }, st.root);
      const filter = svg('filter', { id: NEGATIVE_ID, 'color-interpolation-filters': 'sRGB' }, defs);
      svg('feColorMatrix', { type: 'matrix', values: negativeMatrix() }, filter);
    }
    st.inspector = buildInspector(st.root);
    html.classList.add(CLS.base, st.mode === 'paper' ? CLS.paper : CLS.shell);
    layout(st);
    return st;
  }

  // The settled state at once: a page opened while the lens is on (the ground is already
  // painted by the pre-paint rule), or reduced motion.
  function settle(st) {
    html.classList.add(CLS.on);
    st.root.classList.add('is-drawn'); st.vignette.classList.add('is-drawn');
    bind(st);
  }

  async function enter(ctx) {
    const st = build(ctx);
    if (st.reduced || document.hidden || ctx.arriving) { settle(st); return; }
    st.root.classList.add('is-animating'); st.vignette.classList.add('is-animating');
    if (st.mode === 'shell') {
      html.classList.add(CLS.fade);
      // Commit the "before" styles so the switch below runs as transitions.
      void getComputedStyle(document.body).backgroundColor;
      void st.root.getBoundingClientRect();
      settle(st);
      await sleep(ENTER_MS, ctx.signal);
    } else {
      // Paper pages: the filter cannot be interpolated, so the page crossfades to the
      // blueprint, then the lines draw themselves in the live new state.
      const started = performance.now();
      await crossfade(st, CLS.vtIn, () => { html.classList.add(CLS.on); st.vignette.classList.add('is-drawn'); },
        () => { if (state === st) { void st.root.getBoundingClientRect(); st.root.classList.add('is-drawn'); } });
      if (state !== st || ctx.signal.aborted) return;
      bind(st);
      await sleep(Math.max(0, ENTER_MS - (performance.now() - started)), ctx.signal);
    }
    if (state !== st || ctx.signal.aborted) return;
    html.classList.remove(CLS.fade);
    st.root.classList.remove('is-animating'); st.vignette.classList.remove('is-animating');
  }

  async function arrive(ctx) {
    settle(build(ctx));
  }

  async function exit(ctx) {
    const st = state;
    if (!st) return;
    // ctx.motion also reads true during an instant reset (the first egg, pagehide).
    const instant = ctx.instant || ctx.motion.matches || document.hidden;
    if (st.vt) { st.vt.skipTransition(); await st.vt.finished.catch(() => {}); }
    inspect(st, null);
    if (!instant && html.classList.contains(CLS.on)) {
      st.root.classList.remove('is-animating'); st.vignette.classList.remove('is-animating');
      st.root.classList.add('is-leaving'); st.vignette.classList.add('is-leaving');
      if (st.mode === 'shell') {
        html.classList.add(CLS.fade, CLS.leaving);
        void getComputedStyle(document.body).backgroundColor;
        html.classList.remove(CLS.on);
        st.root.classList.remove('is-drawn'); st.vignette.classList.remove('is-drawn');
        await sleep(EXIT_MS);
      } else {
        // Lines first, then the page crossfades back.
        st.root.classList.remove('is-drawn');
        await sleep(160);
        await crossfade(st, CLS.vtOut, () => {
          html.classList.remove(CLS.on);
          st.root.style.display = 'none'; st.vignette.classList.remove('is-drawn');
        });
      }
    }
    html.classList.remove(CLS.base, CLS.on, CLS.fade, CLS.leaving, CLS.shell, CLS.paper, CLS.vtIn, CLS.vtOut);
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
    ground: '#0f3a63',           // blueprint paper, painted before a page arrives
    css: true,
    enter,
    arrive,
    exit
  });
})();
