/**
 * Tupper's self-referential formula, at the foot of the homepage. A click on the formula plots
 * it: every cell of 0 <= x < 106, k <= y < k + 17 is tested against the inequality itself, one
 * column at a time, and the cells where it holds spell the formula. As in Tupper's figure the
 * axes are reversed (x grows to the left, y downward); otherwise the picture comes out upside
 * down and mirrored. J. Tupper, "Reliable two-dimensional graphing methods for mathematical
 * formulae with two free variables", SIGGRAPH 2001.
 */
(() => {
  'use strict';
  // k: the bitmap of the formula as one binary number, times 17 (543 digits).
  const K = BigInt(
    '960939379918958884971672962127852754715004339660129306651505519271702802395266424689642842' +
    '174350718121267153782770623355993237280874144307891325963941337723487857735749823926629715' +
    '517173716995165232890538221612403238855866184013235585136048828693337902491454229288667081' +
    '096184496091705183454067827731551705405381627380967602565625016981482083418783163849115590' +
    '225610003652351370343874461848378737238198224849863465033159410054974700593138339226497249' +
    '461751545728366702369745461014655997933798537483143786841806593422227898388722980000748404' +
    '719');
  const COLUMNS = 106;
  const ROWS = 17;
  const SCAN_MS = 2400;                // the whole plot, left to right
  const CELL = [2, 6];                 // px per cell: the smallest and the largest
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // The formula waits below the page's end. Once the page has come to rest there, a hard push
  // on past it pulls the formula out: a wheel or trackpad gesture that scrolls this far, a touch
  // that drags this far, or three scrolling keys in quick succession. The momentum of a normal
  // scroll that reaches the end does not count (it belongs to a gesture begun above the end).
  const REST_MS = 300;                 // at rest: no scroll and no wheel for this long
  const PUSH_PX = 700;                 // wheel and trackpad: the distance pushed in one gesture
  const PULL_PX = 140;                 // touch: the finger's travel
  const KEYS = 3; const KEYS_MS = 1200;
  const REVEAL_MS = 700;               // the formula rises from below over this long

  // 1/2 < floor(mod(floor(y / 17) * 2^(-17 floor(x) - mod(floor(y), 17)), 2)) for integers
  // x, y >= 0: multiplying floor(y / 17) by that power of two and taking the floor is a right
  // shift, and the floor of mod(., 2) is then the lowest bit.
  const holds = (x, y) => ((y / 17n) >> (17n * x + y % 17n)) % 2n === 1n;

  // The cells where the inequality holds, by screen column (column c shows x = 105 - c, row r
  // shows y = k + r).
  let plot = null;
  function cells() {
    if (!plot) {
      plot = Array.from({ length: COLUMNS }, (_, c) => {
        const rows = [];
        for (let r = 0; r < ROWS; r++) if (holds(BigInt(COLUMNS - 1 - c), K + BigInt(r))) rows.push(r);
        return rows;
      });
    }
    return plot;
  }

  function svg(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes || {})) element.setAttribute(key, value);
    return element;
  }

  function init() {
    const root = document.querySelector('.tupper');
    if (!root) return;
    const button = root.querySelector('.tupper-formula');
    const figure = root.querySelector('.tupper-plot');
    const counter = root.querySelector('.tupper-counter');
    const note = root.querySelector('.tupper-note');
    root.querySelector('.tupper-k-digits').textContent = K.toString();

    const canvas = svg('svg', { class: 'tupper-grid', viewBox: `0 0 ${COLUMNS} ${ROWS}`, role: 'img',
      'aria-label': 'The plot: a 106 by 17 grid of cells, which spell the formula above' });
    let lines = '';
    for (let c = 0; c <= COLUMNS; c++) lines += `M${c} 0V${ROWS}`;
    for (let r = 0; r <= ROWS; r++) lines += `M0 ${r}H${COLUMNS}`;
    const grid = svg('path', { class: 'tupper-lines', d: lines });
    const filled = svg('g', { class: 'tupper-cells' });
    const scan = svg('rect', { class: 'tupper-scan', y: 0, width: 1, height: ROWS });
    canvas.append(grid, filled, scan);
    figure.prepend(canvas);

    // Whole pixels per cell, so every cell is the same size; the grid is dropped when cells are small.
    function fit() {
      const room = figure.clientWidth || root.clientWidth;
      const cell = Math.max(CELL[0], Math.min(CELL[1], Math.floor(room / COLUMNS)));
      canvas.setAttribute('width', cell * COLUMNS);
      canvas.setAttribute('height', cell * ROWS);
      grid.setAttribute('transform', `translate(${0.5 / cell} ${0.5 / cell})`);
      canvas.classList.toggle('is-fine', cell < 4);
    }

    let raf = 0;
    function draw(column) {
      for (const r of cells()[column]) filled.append(svg('rect', { x: column, y: r, width: 1, height: 1 }));
    }
    function play() {
      cancelAnimationFrame(raf);
      filled.replaceChildren();
      note.hidden = true;
      counter.hidden = false;
      let drawn = 0;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const start = performance.now();
      const step = now => {
        const upto = still ? COLUMNS : Math.min(COLUMNS, Math.floor(((now - start) / SCAN_MS) * COLUMNS) + 1);
        while (drawn < upto) draw(drawn++);
        if (drawn < COLUMNS) {
          scan.setAttribute('x', drawn);
          counter.textContent = `x = ${COLUMNS - drawn}`;
          raf = requestAnimationFrame(step);
          return;
        }
        raf = 0;
        scan.setAttribute('x', -2);
        counter.hidden = true;
        note.hidden = false;
        note.scrollIntoView({ block: 'nearest' });
      };
      raf = requestAnimationFrame(step);
    }

    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      figure.hidden = !open;
      if (open) { fit(); play(); figure.scrollIntoView({ block: 'nearest' }); } else cancelAnimationFrame(raf);
    });
    addEventListener('resize', () => { if (!figure.hidden) fit(); });
    watchTheEnd(root);
  }

  /* ---- Below the end ------------------------------------------------------- */
  function watchTheEnd(root) {
    const page = document.documentElement;
    const atEnd = () => Math.ceil(scrollY + innerHeight) >= page.scrollHeight - 2;
    // Another egg's dialog owns the wheel and the keys while it is open.
    const busy = event => event.defaultPrevented || !!document.querySelector('dialog[open]');
    let lastScroll = -1e9; let lastWheel = -1e9;
    const rested = now => atEnd() && now - lastScroll > REST_MS;
    const events = new AbortController();
    const on = (type, fn) => addEventListener(type, fn, { passive: true, signal: events.signal });

    on('scroll', () => { lastScroll = performance.now(); });
    let pushed = 0; let pushing = false;
    on('wheel', event => {
      const now = performance.now();
      if (now - lastWheel > REST_MS) { pushed = 0; pushing = rested(now); }   // a new gesture
      lastWheel = now;
      if (!pushing || busy(event) || !atEnd()) return;
      if (event.deltaY < 0) { pushing = false; return; }
      pushed += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (pushed >= PUSH_PX) reveal();
    });
    let pull = null;
    on('touchstart', event => { pull = event.touches.length === 1 && rested(performance.now()) ? event.touches[0].clientY : null; });
    on('touchmove', event => { if (pull !== null && pull - event.touches[0].clientY >= PULL_PX) reveal(); });
    on('touchend', () => { pull = null; });
    let presses = [];
    on('keydown', event => {
      if (!['ArrowDown', 'PageDown', 'End', ' '].includes(event.key) || busy(event) || event.repeat) return;
      if (event.target.closest && event.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
      const now = performance.now();
      if (!atEnd()) { presses = []; return; }
      presses = presses.filter(t => now - t < KEYS_MS).concat(now);
      if (presses.length >= KEYS) reveal();
    });

    // The formula rises from below: the page's end grows and the view follows it down.
    function reveal() {
      events.abort();
      root.hidden = false;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const full = root.scrollHeight;
      const follow = () => scrollTo({ top: page.scrollHeight, behavior: 'instant' });
      if (still) { follow(); return; }
      root.style.height = '0px';
      root.style.overflow = 'hidden';
      const start = performance.now();
      const step = now => {
        const u = Math.min(1, (now - start) / REVEAL_MS);
        root.style.height = `${full * (1 - Math.pow(1 - u, 3))}px`;
        follow();
        if (u < 1) { requestAnimationFrame(step); return; }
        root.style.removeProperty('height');
        root.style.removeProperty('overflow');
        if (!root.getAttribute('style')) root.removeAttribute('style');
      };
      requestAnimationFrame(step);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
