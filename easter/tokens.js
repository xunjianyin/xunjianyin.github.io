/**
 * Lens II · Through a model's eyes.
 *
 * Every token of the page, as GPT-4's cl100k_base tokenizer splits it, gets a soft tinted
 * tile behind it. The tokenizer is a faithful port of tiktoken: the same regex pre-tokenizer,
 * then byte-pair merges by rank over the UTF-8 bytes of each piece. The ranks come from
 * easter/cl100k.txt (built by scripts/build_cl100k.py), fetched the first time the lens enters.
 *
 * Text is read, never written: tiles are absolute boxes drawn from Range rects in the core's
 * page layer, and the decode replay dims not-yet-emitted text with the CSS Custom Highlight API
 * (no DOM wrapping). Press → to replay the page in the order an autoregressive model would emit
 * it, ← for the reverse order (a nod to LEDOM, a reverse language model). The replay shows
 * order only; it never shows model outputs or probabilities.
 */
(function () {
  'use strict';

  const lenses = window.SiteLenses;
  if (!lenses) return;

  // ---- Constants ---------------------------------------------------------------------------
  const RANKS_URL = 'easter/cl100k.txt?v=cl100k-v1';
  const RANKS_HEADER = '#cl100k_base';
  const RANKS_FORMAT = 'utf8-escaped-v1';
  const TINTS = 5;                       // tile colours cycle through tk-c0 … tk-c4
  const ENTER_SWEEP_S = 0.42;            // spread of the left-to-right fade-in delays …
  const ENTER_FADE_S = 0.18;             // … plus each tile's own fade = 0.6 s
  const EXIT_FADE_S = 0.3;
  const DECODE_RATE = 40;                // tokens per second
  const DECODE_HOLD_S = 0.9;             // rest on the final token before the tiles return
  const SCROLL_TAU_S = 0.32;             // smoothing of the decode's auto-scroll
  const SCROLL_BAND = [0.18, 0.74];      // viewport band the decode cursor may leave before the page follows
  const SCROLL_ANCHOR = 0.4;             // where the page brings the cursor back to
  const USER_SCROLL_SLOP = 3;            // px of unexplained scroll that count as the reader scrolling
  const HOVER_SLOP = 3;                  // px of vertical tolerance when hit-testing tiles
  const TIP_GAP = 6;                     // px between a token and its tooltip
  const EDGE = 6;                        // px the tooltip keeps from the viewport edge
  const DOTS_MAX = 6;                    // leading-space markers shown on hover
  const HIGHLIGHT = 'lens-tokens-future';
  const HINT = '→ decode · ← reverse, like LEDOM';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'SELECT', 'OPTION']);
  const ATOMIC_TAGS = new Set(['IMG', 'SVG', 'svg', 'CANVAS', 'VIDEO', 'IFRAME', 'INPUT', 'OBJECT', 'EMBED']);
  const PRESERVE_WS = new Set(['pre', 'pre-wrap', 'break-spaces']);

  // ---- Tokenizer: tiktoken's cl100k_base, ported ---------------------------------------------
  // tiktoken's pattern (Rust regex, possessive quantifiers):
  //   '(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?+\p{L}++|\p{N}{1,3}+| ?[^\s\p{L}\p{N}]++[\r\n]*+
  //   |\s++$|\s*[\r\n]|\s+(?!\S)|\s
  // Translated for JS: no possessive quantifiers (none of them changes a match here, because
  // each sits at the end of its alternative or before a class it cannot overlap), case
  // folding spelled out (Unicode simple folding adds ſ to s), and \s spelled as Unicode
  // White_Space, which is what Rust's \s means (JS \s adds U+FEFF and omits U+0085).
  const WS = '\\t\\n\\v\\f\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
  const PATTERN = new RegExp([
    "'(?:[sSſdDmMtT]|[lL][lL]|[vV][eE]|[rR][eE])",
    '[^\\r\\n\\p{L}\\p{N}]?\\p{L}+',
    '\\p{N}{1,3}',
    ` ?[^${WS}\\p{L}\\p{N}]+[\\r\\n]*`,
    `[${WS}]+$`,
    `[${WS}]*[\\r\\n]`,
    `[${WS}]+(?![^${WS}])`,
    `[${WS}]`
  ].join('|'), 'gu');
  const PLAIN_LINE = /^[\x20-\x5b\x5d-\x7e]*$/;   // printable ASCII without a backslash: bytes = chars
  const NO_RANK = 0x7fffffff;

  /** Token bytes as a "binary string" (one char per byte) for every rank in the ranks file. */
  function parseRanks(text) {
    const lines = text.split('\n');
    const header = lines[0].split(' ');
    const count = Number(header[1]);
    if (header[0] !== RANKS_HEADER || header[2] !== RANKS_FORMAT || !(lines.length > count)) {
      throw new Error('tokens lens: unexpected ranks file');
    }
    const ranks = new Map();
    for (let rank = 0; rank < count; rank++) {
      const line = lines[rank + 1];
      ranks.set(PLAIN_LINE.test(line) ? line : lineBytes(line), rank);
    }
    if (ranks.size !== count) throw new Error('tokens lens: duplicate ranks');
    return ranks;
  }

  /** Decode one ranks line: UTF-8 text with \xHH escapes for the bytes that are not characters. */
  function lineBytes(line) {
    let out = '';
    for (let i = 0; i < line.length;) {
      if (line.charCodeAt(i) === 0x5c) {
        out += String.fromCharCode(parseInt(line.substr(i + 2, 2), 16));
        i += 4;
      } else {
        const cp = line.codePointAt(i);
        out += utf8(cp);
        i += cp > 0xffff ? 2 : 1;
      }
    }
    return out;
  }

  /** UTF-8 bytes of one code point as a binary string (lone surrogates become U+FFFD, as in TextEncoder). */
  function utf8(cp) {
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) return String.fromCharCode(cp);
    if (cp < 0x800) return String.fromCharCode(0xc0 | cp >> 6, 0x80 | cp & 63);
    if (cp < 0x10000) return String.fromCharCode(0xe0 | cp >> 12, 0x80 | cp >> 6 & 63, 0x80 | cp & 63);
    return String.fromCharCode(0xf0 | cp >> 18, 0x80 | cp >> 12 & 63, 0x80 | cp >> 6 & 63, 0x80 | cp & 63);
  }

  /**
   * Byte-pair merge of one piece (a binary string), as tiktoken's _byte_pair_merge: repeatedly
   * merge the adjacent pair whose concatenated bytes have the lowest rank, leftmost on ties.
   * Returns the byte offsets of the token boundaries, [0, …, piece.length].
   */
  function bytePairMerge(ranks, piece) {
    const starts = [];
    const pairRanks = [];
    let minRank = NO_RANK;
    let minIndex = -1;
    for (let i = 0; i < piece.length - 1; i++) {
      const rank = ranks.get(piece.substr(i, 2)) ?? NO_RANK;
      if (rank < minRank) { minRank = rank; minIndex = i; }
      starts.push(i);
      pairRanks.push(rank);
    }
    starts.push(piece.length - 1, piece.length);
    pairRanks.push(NO_RANK, NO_RANK);
    // Rank of the bytes from part i to part i + 3, i.e. parts i, i+1, i+2 once i+1 is merged away.
    const rankAt = i => (i + 3 < starts.length ? ranks.get(piece.slice(starts[i], starts[i + 3])) ?? NO_RANK : NO_RANK);
    while (minRank !== NO_RANK) {
      const i = minIndex;
      if (i > 0) pairRanks[i - 1] = rankAt(i - 1);
      pairRanks[i] = rankAt(i);
      starts.splice(i + 1, 1);
      pairRanks.splice(i + 1, 1);
      minRank = NO_RANK;
      for (let j = 0; j < starts.length - 1; j++) {
        if (pairRanks[j] < minRank) { minRank = pairRanks[j]; minIndex = j; }
      }
    }
    return starts;      // ends with piece.length, which is never merged away
  }

  /**
   * Encode text as tiktoken's encode_ordinary does. Each token records its id, its bytes and
   * where it sits in the text: UTF-16 offsets [start, end) of the characters it touches, and,
   * when a token begins or ends inside a multi-byte character, the fraction of that
   * character's bytes it owns (head: bytes skipped at the start; tail: bytes kept at the end).
   */
  function encode(ranks, text) {
    const tokens = [];
    PATTERN.lastIndex = 0;
    let at = 0;
    for (let match = PATTERN.exec(text); match; match = PATTERN.exec(text)) {
      // The alternatives cover every character, so pieces are contiguous; guard anyway.
      if (match.index > at) encodePiece(ranks, text, at, match.index, tokens);
      at = match.index + match[0].length;
      encodePiece(ranks, text, match.index, at, tokens);
    }
    if (at < text.length) encodePiece(ranks, text, at, text.length, tokens);
    return tokens;
  }

  function encodePiece(ranks, text, from, to, tokens) {
    // UTF-8 bytes of the piece, plus where each character's bytes begin.
    let bytes = '';
    const charAt16 = [];     // UTF-16 offset of each code point
    const charByte = [];     // byte offset of each code point
    for (let i = from; i < to;) {
      const cp = text.codePointAt(i);
      charAt16.push(i);
      charByte.push(bytes.length);
      bytes += utf8(cp);
      i += cp > 0xffff ? 2 : 1;
    }
    charAt16.push(to);
    charByte.push(bytes.length);

    const whole = ranks.get(bytes);
    const bounds = whole !== undefined || bytes.length === 1 ? [0, bytes.length] : bytePairMerge(ranks, bytes);
    let c = 0;               // code point containing the current token's first byte
    for (let k = 0; k + 1 < bounds.length; k++) {
      const b0 = bounds[k];
      const b1 = bounds[k + 1];
      const tokenBytes = bytes.slice(b0, b1);
      const id = k === 0 && whole !== undefined ? whole : ranks.get(tokenBytes);
      while (charByte[c + 1] <= b0) c++;
      let e = c;             // code point containing the token's last byte
      while (charByte[e + 1] < b1) e++;
      tokens.push({
        id,
        bytes: tokenBytes,
        start: charAt16[c],
        end: charAt16[e + 1],
        head: (b0 - charByte[c]) / (charByte[c + 1] - charByte[c]),
        tail: (b1 - charByte[e]) / (charByte[e + 1] - charByte[e])
      });
    }
  }

  /** Token bytes as readable text: ␣ for spaces, \xHH for bytes that are not whole characters. */
  function showBytes(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length;) {
      const b = bytes.charCodeAt(i);
      const n = b < 0x80 ? 1 : b >= 0xc2 && b <= 0xdf ? 2 : b >= 0xe0 && b <= 0xef ? 3 : b >= 0xf0 && b <= 0xf4 ? 4 : 0;
      let char = '';
      if (n && i + n <= bytes.length) {
        try {
          const view = new Uint8Array(n);
          for (let j = 0; j < n; j++) view[j] = bytes.charCodeAt(i + j);
          char = UTF8_STRICT.decode(view);
        } catch (error) { char = ''; }
      }
      if (!char || (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) || b === 0x7f) {
        out += '\\x' + b.toString(16).padStart(2, '0');
        i += 1;
        continue;
      }
      out += char === ' ' ? '␣' : char === '\n' ? '↵' : char === '\t' ? '⇥' : char === '\u00a0' ? '⍽' : char;
      i += n;
    }
    return out;
  }
  const UTF8_STRICT = typeof TextDecoder === 'function' ? new TextDecoder('utf-8', { fatal: true }) : null;

  /** For a token with any non-ASCII byte, its UTF-8 bytes in hex, e.g. ' (c3 b6)' for "ö". */
  function hexBytes(bytes) {
    if (!/[\x80-\xff]/.test(bytes)) return '';
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += (i ? ' ' : '') + bytes.charCodeAt(i).toString(16).padStart(2, '0');
    return ` (${out})`;
  }

  // ---- Reading the page's text ----------------------------------------------------------------
  // The page is tokenized per text run: the rendered text of one line of flow, i.e. the inline
  // text of a block between block boundaries, <br>s and inline-blocks, gathered across its Text
  // nodes, so a link stays inside its sentence ("student at" + "Duke" encodes " Duke" as one
  // token, as BPE would). CSS whitespace collapsing is applied first, so a run holds what a
  // reader sees. Runs are encoded independently; a model given the whole page would also see the
  // separators between them (newlines that the DOM does not hold), so only tokens at run edges
  // are an approximation. A token that spans two Text nodes gets one tile per node segment.

  /**
   * Collect the rendered text runs of the scope, in document order. Each run is
   * { text, nodes, charNode, rawStart, rawEnd }: the whitespace-collapsed text, and for each of
   * its UTF-16 units the Text node it came from and its [start, end) offsets in that node's data.
   */
  function collectRuns(scope) {
    const display = new Map();
    const displayOf = el => {
      let value = display.get(el);
      if (value === undefined) { value = getComputedStyle(el).display; display.set(el, value); }
      return value;
    };
    const isInline = el => { const d = displayOf(el); return d === 'inline' || d === 'contents'; };
    // The inline formatting context a node's text flows in: its nearest non-inline ancestor.
    const blockOf = node => {
      let el = node.nodeType === 1 ? node : node.parentElement;
      while (el && isInline(el) && !scope.includes(el)) el = el.parentElement;
      return el;
    };
    // The outermost box between `inner` (a block) and its containing block `outer`: the box that
    // `outer`'s inline formatting context sees. When it is inline-level (inline-block, …) it is an
    // atomic inline and the line continues around it; otherwise it breaks the line.
    const boxWithin = (outer, inner) => {
      let box = inner;
      for (let el = inner; el.parentElement && el.parentElement !== outer; el = el.parentElement) {
        if (!isInline(el.parentElement)) box = el.parentElement;
      }
      return box;
    };
    const atomic = el => displayOf(el).startsWith('inline');

    const runs = [];
    let run = null;            // the run being gathered
    let block = null;          // block of the previous text
    let atLineStart = true;    // collapsible spaces here are dropped
    let afterSpace = false;    // the last rendered character was a collapsed space
    // Close the current run; at the end of a line its trailing collapsed space is not rendered.
    const endRun = trim => {
      if (!run) return;
      if (trim && run.trailingSpace) {
        run.text = run.text.slice(0, -1);
        run.charNode.pop();
        run.rawStart.pop();
        run.rawEnd.pop();
      }
      if (run.text) runs.push(run);
      run = null;
    };
    const enterBlock = next => {
      if (next === block) return;
      if (block && next.contains(block) && atomic(boxWithin(next, block))) {
        endRun(true);            // back from an inline-block: the line goes on after it
        atLineStart = false;
      } else if (block && block.contains(next) && atomic(boxWithin(block, next))) {
        endRun(false);           // into an inline-block: the space before it stays
        atLineStart = true;
      } else {
        endRun(true);            // any other change of block ends the line
        atLineStart = true;
      }
      afterSpace = false;
      block = next;
    };

    for (const root of scope) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.nodeType === 3) return NodeFilter.FILTER_ACCEPT;
          if (SKIP_TAGS.has(node.tagName) || displayOf(node) === 'none') return NodeFilter.FILTER_REJECT;
          if (node.tagName === 'BR' || ATOMIC_TAGS.has(node.tagName)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === 1) {
          enterBlock(blockOf(node.parentNode));
          // A <br> or a block-level replaced element ends the line; an inline image splits the run.
          const inline = node.tagName !== 'BR' && atomic(node);
          endRun(!inline);
          atLineStart = !inline;
          afterSpace = false;
          if (ATOMIC_TAGS.has(node.tagName)) walker.currentNode = lastDescendant(node);
          continue;
        }
        const parent = node.parentElement;
        if (!parent || !node.data) continue;
        const style = getComputedStyle(parent);
        if (style.visibility !== 'visible') continue;
        // Visible characters drawn off the document (a skip link parked at top: -100px) are not
        // on the page. Whitespace-only nodes are never tested: a rendered space may be zero-width.
        const blank = !/[^ \t\n\r\f]/.test(node.data);
        if (!blank && !onPage(node)) continue;
        enterBlock(blockOf(node));
        if (!run) run = { text: '', nodes: [], charNode: [], rawStart: [], rawEnd: [], trailingSpace: false, first: 0 };
        if (collapse(node, PRESERVE_WS.has(style.whiteSpace), atLineStart || afterSpace, run)) {
          atLineStart = false;
          afterSpace = run.trailingSpace;
        }
      }
      enterBlock(root);
      endRun(true);
      block = null;
      atLineStart = true;
      afterSpace = false;
    }
    return runs;
  }

  function lastDescendant(node) {
    while (node.lastChild) node = node.lastChild;
    return node;
  }

  /**
   * Append one Text node's rendered characters to a run, applying CSS white-space collapsing
   * (normal, nowrap; pre-line is treated as normal). Returns whether anything was appended.
   */
  function collapse(node, preserve, skipSpace, run) {
    const data = node.data;
    const index = run.nodes.length;
    const before = run.text.length;
    let text = '';
    const add = (chars, from, to, space) => {
      text += chars;
      run.charNode.push(index);
      run.rawStart.push(from);
      run.rawEnd.push(to);
      run.trailingSpace = space;
    };
    if (preserve) {
      for (let i = 0; i < data.length; i++) add(data[i], i, i + 1, false);
    } else {
      // A stretch of collapsible whitespace renders as one space, or as nothing at the start of
      // a line or right after another collapsed space. (No-break spaces are not collapsible.)
      for (let i = 0; i < data.length;) {
        if (isCollapsible(data.charCodeAt(i))) {
          let j = i + 1;
          while (j < data.length && isCollapsible(data.charCodeAt(j))) j++;
          if (!skipSpace) add(' ', i, j, true);
          skipSpace = true;
          i = j;
        } else {
          add(data[i], i, i + 1, false);
          skipSpace = false;
          i++;
        }
      }
    }
    if (!text) return false;
    run.text += text;
    run.nodes.push(node);
    return run.text.length > before;
  }

  function isCollapsible(code) {
    return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c;
  }

  const probe = typeof document !== 'undefined' ? document.createRange() : null;
  /** False for text drawn off the document (e.g. a skip link parked at top: -100px). */
  function onPage(node) {
    probe.selectNodeContents(node);
    const rects = probe.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.width > 0 && r.height > 0 && r.bottom + window.scrollY > 0 && r.right + window.scrollX > 0) return true;
    }
    return false;
  }

  // ---- Ranks loading (once per page) ----------------------------------------------------------
  let ranksPromise = null;
  const stats = { fetchMs: 0, parseMs: 0, buildMs: 0, layoutMs: 0, tokens: 0, runs: 0, tiles: 0 };

  function loadRanks(root) {
    if (!ranksPromise) {
      const began = performance.now();
      ranksPromise = fetch(new URL(RANKS_URL, root))
        .then(response => {
          if (!response.ok) throw new Error(`tokens lens: ranks file HTTP ${response.status}`);
          return response.text();
        })
        .then(text => {
          const parsed = performance.now();
          stats.fetchMs = parsed - began;
          const ranks = parseRanks(text);
          stats.parseMs = performance.now() - parsed;
          return ranks;
        })
        .catch(error => { ranksPromise = null; throw error; });
    }
    return ranksPromise;
  }

  // ---- The lens ---------------------------------------------------------------------------
  let session = null;
  let hintPending = true;      // the LEDOM hint shows during the first activation only

  function createSession(ctx, ranks) {
    const html = document.documentElement;
    const layer = ctx.layer('page');
    const overlay = ctx.layer('fixed');
    const signal = ctx.signal;
    const reduced = () => ctx.motion.matches;
    const range = document.createRange();
    const cache = new Map();   // run text → tokens, so a relayout re-encodes nothing

    layer.classList.add('tk-layer', 'tk-pre');
    const tilesBox = document.createElement('div');
    tilesBox.className = 'tk-tiles';
    layer.append(tilesBox);
    const tip = document.createElement('div');
    tip.className = 'tk-tip';
    tip.setAttribute('aria-hidden', 'true');
    overlay.append(tip);
    const dots = [];
    for (let i = 0; i < DOTS_MAX; i++) {
      const dot = document.createElement('div');
      dot.className = 'tk-dot';
      overlay.append(dot);
      dots.push(dot);
    }

    // Tokens, flat: per-token run and offsets; per-tile geometry in page-layer coordinates.
    let runs = [];
    let tokens = [];
    let tokenRun = new Int32Array(0);
    let tokenIndex = new Int32Array(0);   // index within its run
    let firstTile = new Int32Array(1);    // tiles of token t are firstTile[t] … firstTile[t + 1] - 1
    let tileEls = [];
    let tileX = new Float32Array(0);
    let tileY = new Float32Array(0);
    let tileW = new Float32Array(0);
    let tileH = new Float32Array(0);
    let tileToken = new Int32Array(0);
    let tileCount = 0;
    let layerX = 0;             // the page layer's document position
    let layerY = 0;
    let originX = 0;            // … and its viewport position, refreshed by syncOrigin()
    let originY = 0;
    const syncOrigin = () => {
      originX = layerX - window.scrollX;
      originY = layerY - window.scrollY;
    };

    function rebuild() {
      const began = performance.now();
      runs = collectRuns(ctx.scope);
      tokens = [];
      const runOf = [];
      const indexOf = [];
      runs.forEach((run, r) => {
        let encoded = cache.get(run.text);
        if (!encoded) { encoded = encode(ranks, run.text); cache.set(run.text, encoded); }
        run.first = tokens.length;
        encoded.forEach((token, i) => { tokens.push(token); runOf.push(r); indexOf.push(i); });
      });
      tokenRun = Int32Array.from(runOf);
      tokenIndex = Int32Array.from(indexOf);
      stats.tokens = tokens.length;
      stats.runs = runs.length;
      const encoded = performance.now();
      layout();
      stats.buildMs = encoded - began;
      stats.layoutMs = performance.now() - encoded;
    }

    /** Place one tile per line fragment of every token, from Range rects. */
    function layout() {
      const box = layer.getBoundingClientRect();
      originX = box.left;
      originY = box.top;
      layerX = box.left + window.scrollX;
      layerY = box.top + window.scrollY;
      const xs = [];
      const ys = [];
      const ws = [];
      const hs = [];
      const owner = [];
      const first = new Int32Array(tokens.length + 1);
      const rects = [];
      for (let t = 0; t < tokens.length; t++) {
        first[t] = xs.length;
        const token = tokens[t];
        const run = runs[tokenRun[t]];
        // One Range per Text node the token touches (a Range over several nodes would also
        // report the boxes of elements it contains).
        rects.length = 0;
        for (let u = token.start; u < token.end;) {
          let v = u + 1;
          while (v < token.end && run.charNode[v] === run.charNode[u]) v++;
          span(run, u, v);
          const list = range.getClientRects();
          for (let i = 0; i < list.length; i++) {
            const rect = list[i];
            if (rect.width < 0.5 || rect.height <= 0) continue;
            // Fragments of one token on one line (a space and a link) form a single tile.
            const prev = rects[rects.length - 1];
            if (prev && Math.abs(prev.top - rect.top) < 1 && Math.abs(prev.bottom - rect.bottom) < 1 && Math.abs(prev.right - rect.left) < 1) {
              prev.right = rect.right;
            } else {
              rects.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
            }
          }
          u = v;
        }
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          let left = rect.left;
          let right = rect.right;
          // A token that starts or ends inside a multi-byte character owns that share of its glyph.
          if (i === 0 && token.head > 0) left += token.head * charWidth(run, token.start);
          if (i === rects.length - 1 && token.tail < 1) right -= (1 - token.tail) * charWidth(run, lastCharStart(run, token.end));
          const x0 = Math.round(left - originX);
          const x1 = Math.round(right - originX) - 1;      // 1 px gap to the next tile
          const y0 = Math.round(rect.top - originY);
          const y1 = Math.round(rect.bottom - originY);
          if (x1 <= x0) continue;
          xs.push(x0); ys.push(y0); ws.push(x1 - x0); hs.push(y1 - y0); owner.push(t);
        }
      }
      first[tokens.length] = xs.length;
      firstTile = first;
      tileX = Float32Array.from(xs);
      tileY = Float32Array.from(ys);
      tileW = Float32Array.from(ws);
      tileH = Float32Array.from(hs);
      tileToken = Int32Array.from(owner);
      tileCount = xs.length;
      stats.tiles = tileCount;

      // Reuse tile elements across relayouts.
      while (tileEls.length < tileCount) {
        const el = document.createElement('div');
        tilesBox.append(el);
        tileEls.push(el);
      }
      while (tileEls.length > tileCount) tileEls.pop().remove();
      for (let i = 0; i < tileCount; i++) {
        const el = tileEls[i];
        el.className = `tk-tile tk-c${tileToken[i] % TINTS}`;
        el.style.cssText = `left:${tileX[i]}px;top:${tileY[i]}px;width:${tileW[i]}px;height:${tileH[i]}px`;
      }
      hovered = -1;
    }

    function lastCharStart(run, end) {
      const code = run.text.charCodeAt(end - 1);
      return code >= 0xdc00 && code <= 0xdfff && end >= 2 ? end - 2 : end - 1;
    }

    /** Point the shared range at run characters [from, to), which lie in one Text node. */
    function span(run, from, to) {
      const node = run.nodes[run.charNode[from]];
      range.setStart(node, run.rawStart[from]);
      range.setEnd(node, run.rawEnd[to - 1]);
    }

    function charWidth(run, at) {
      const code = run.text.charCodeAt(at);
      span(run, at, at + (code >= 0xd800 && code <= 0xdbff ? 2 : 1));
      return range.getBoundingClientRect().width;
    }

    // ---- Enter / exit -----------------------------------------------------------------------
    function sweep() {
      // Tiles near the viewport fade in left to right; the rest simply appear (they are off screen).
      const top = window.scrollY - layerY - window.innerHeight;
      const bottom = window.scrollY - layerY + 2 * window.innerHeight;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < tileCount; i++) {
        if (tileY[i] < top || tileY[i] > bottom) continue;
        minX = Math.min(minX, tileX[i]);
        maxX = Math.max(maxX, tileX[i]);
      }
      const span = Math.max(1, maxX - minX);
      for (let i = 0; i < tileCount; i++) {
        const near = tileY[i] >= top && tileY[i] <= bottom;
        tileEls[i].style.transitionDelay = near ? `${(ENTER_SWEEP_S * (tileX[i] - minX) / span).toFixed(3)}s` : '0s';
      }
    }

    async function enter() {
      html.classList.add('lens-tokens');
      const still = () => layer.classList.toggle('tk-still', reduced());
      still();
      ctx.motion.addEventListener('change', still, { signal });
      rebuild();
      if (!reduced()) {
        sweep();
        void layer.offsetWidth;            // commit the hidden state before fading in
      }
      layer.classList.remove('tk-pre');
      watch();
      if (!reduced()) await wait((ENTER_SWEEP_S + ENTER_FADE_S) * 1000, signal);
      for (let i = 0; i < tileCount; i++) tileEls[i].style.transitionDelay = '';
    }

    async function exit(instant) {
      stopDecode();
      setHover(-1);
      unwatch();
      if (!instant && !reduced()) {
        layer.classList.add('tk-leaving');
        await wait(EXIT_FADE_S * 1000);
      }
      html.classList.remove('lens-tokens');
      if (typeof CSS !== 'undefined' && CSS.highlights) CSS.highlights.delete(HIGHLIGHT);
      tilesBox.remove();
      tip.remove();
      dots.forEach(dot => dot.remove());
    }

    // ---- Keeping tiles on their text --------------------------------------------------------
    let rebuildFrame = 0;
    let resizeObserver = null;
    let mutationObserver = null;
    let skipFirstResize = true;
    const scheduleRebuild = () => {
      if (rebuildFrame || signal.aborted) return;
      rebuildFrame = requestAnimationFrame(() => {
        rebuildFrame = 0;
        if (signal.aborted) return;
        stopDecode();
        rebuild();
        updateHover();
      });
    };
    function watch() {
      window.addEventListener('resize', scheduleRebuild, { signal });
      if (document.fonts) document.fonts.addEventListener('loadingdone', scheduleRebuild, { signal });
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => { if (skipFirstResize) { skipFirstResize = false; return; } scheduleRebuild(); });
        ctx.scope.forEach(el => resizeObserver.observe(el));
      }
      if (typeof MutationObserver === 'function') {
        mutationObserver = new MutationObserver(scheduleRebuild);
        ctx.scope.forEach(el => mutationObserver.observe(el, {
          subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden']
        }));
      }
      document.addEventListener('pointermove', onPointer, { signal, passive: true });
      document.addEventListener('pointerdown', onPointerDown, { signal, passive: true, capture: true });
      document.addEventListener('pointerout', onPointerOut, { signal, passive: true });
      window.addEventListener('blur', onPointerLeave, { signal });
      window.addEventListener('scroll', onScroll, { signal, passive: true });
      window.addEventListener('wheel', onUserScroll, { signal, passive: true });
      window.addEventListener('touchmove', onUserScroll, { signal, passive: true });
      document.addEventListener('keydown', onKey, { signal });
    }
    function unwatch() {
      if (rebuildFrame) cancelAnimationFrame(rebuildFrame);
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      rebuildFrame = 0;
      hoverFrame = 0;
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      resizeObserver = null;
      mutationObserver = null;
    }

    // ---- Hover: tooltip with id, bytes and index in the run ---------------------------------
    let pointerX = -1;
    let pointerY = -1;
    let hovered = -1;
    let hoverFrame = 0;
    let touching = false;       // the last pointer was a finger or a pen
    function onPointer(event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      touching = event.pointerType !== 'mouse';
      if (!hoverFrame) hoverFrame = requestAnimationFrame(updateHover);
    }
    function onPointerDown(event) {
      if (decoding) stopDecode();
      if (event.pointerType !== 'mouse') onPointer(event);   // touch and pen: a tap inspects a token
    }
    function onPointerLeave() { pointerX = -1; setHover(-1); }
    function onPointerOut(event) { if (!event.relatedTarget) onPointerLeave(); }   // left the window
    function onScroll() {
      if (decoding && Math.abs(window.scrollY - scrollSet) > USER_SCROLL_SLOP) userScrolled = true;
      // A mouse inspects whatever scrolls under it; a tapped token's tooltip goes once the page moves.
      if (touching) onPointerLeave();
      else if (pointerX >= 0 && !hoverFrame) hoverFrame = requestAnimationFrame(updateHover);
    }
    function updateHover() {
      hoverFrame = 0;
      if (pointerX < 0 || signal.aborted || decoding) { setHover(-1); return; }
      syncOrigin();
      const x = pointerX - originX;
      const y = pointerY - originY;
      let found = -1;
      for (let i = 0; i < tileCount; i++) {
        if (x >= tileX[i] && x <= tileX[i] + tileW[i] + 1 && y >= tileY[i] - HOVER_SLOP && y < tileY[i] + tileH[i] + HOVER_SLOP) {
          found = tileToken[i];
          break;
        }
      }
      setHover(found);
    }

    let placedX = NaN;          // where the tooltip was last placed, to skip redundant moves
    let placedY = NaN;
    function setHover(t) {
      const changed = t !== hovered;
      if (changed) {
        if (hovered >= 0) for (let i = firstTile[hovered]; i < firstTile[hovered + 1]; i++) tileEls[i].classList.remove('tk-hover');
        hovered = t;
        if (t >= 0) {
          for (let i = firstTile[t]; i < firstTile[t + 1]; i++) tileEls[i].classList.add('tk-hover');
          const token = tokens[t];
          // Whole characters show as text plus their bytes; partial ones already show as \xHH.
          const shown = showBytes(token.bytes);
          tip.textContent = `${token.id} · "${shown}"${shown.includes('\\x') ? '' : hexBytes(token.bytes)} · #${tokenIndex[t]}`;
        }
      }
      if (t < 0 || firstTile[t] === firstTile[t + 1]) {
        tip.classList.remove('tk-on');
        for (let i = 0; i < DOTS_MAX; i++) dots[i].classList.remove('tk-on');
        placedX = placedY = NaN;
        return;
      }
      // Place the tooltip above the token's first fragment, or below it near the top edge.
      const i = firstTile[t];
      const left = tileX[i] + originX;
      const top = tileY[i] + originY;
      if (!changed && left === placedX && top === placedY) return;
      placedX = left;
      placedY = top;
      const width = tip.offsetWidth;
      const height = tip.offsetHeight;
      let y = top - height - TIP_GAP;
      if (y < EDGE) y = top + tileH[i] + TIP_GAP;
      const x = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));
      tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      tip.classList.add('tk-on');
      placeDots(t);
    }

    /** A faint middle dot on each leading space of the hovered token (spaces belong to tokens). */
    function placeDots(t) {
      const token = tokens[t];
      const run = runs[tokenRun[t]];
      let shown = 0;
      for (let u = token.start; u < token.end && shown < DOTS_MAX && token.head === 0; u++) {
        const ch = run.text[u];
        if (ch !== ' ' && ch !== '\u00a0') break;
        span(run, u, u + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width < 1) continue;
        const dot = dots[shown++];
        dot.style.transform = `translate(${Math.round(rect.left + rect.width / 2 - 1)}px, ${Math.round(rect.top + rect.height * 0.52 - 1)}px)`;
        dot.classList.add('tk-on');
      }
      for (let i = shown; i < DOTS_MAX; i++) dots[i].classList.remove('tk-on');
    }

    // ---- Decode replay: the order of emission, nothing more ---------------------------------
    let decoding = false;
    let direction = 1;
    let cursor = -1;            // last emitted token
    let emitted = 0;
    let budget = 0;             // fractional tokens owed at DECODE_RATE
    let holding = 0;
    let settled = false;        // false in a replay's first frame, whose style the key handler dirtied
    let userScrolled = false;
    let following = false;
    let scrollSet = 0;
    let maxScroll = 0;          // measured when a replay starts; a reflow stops the replay
    const scrollTarget = { top: 0, behavior: 'instant' };   // reused: the site sets scroll-behavior: smooth
    let future = null;          // Range of not-yet-emitted text, painted dim through a highlight
    let stopFrames = null;

    function onKey(event) {
      if (decoding) {
        // Any key stops the replay. The arrows are consumed so they do not restart it at once,
        // and so is Esc (the core leaves Esc alone when it is consumed): a second Esc leaves the lens.
        stopDecode();
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Escape') event.preventDefault();
        return;
      }
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      startDecode(event.key === 'ArrowRight' ? 1 : -1);
    }
    function onUserScroll() { if (decoding) userScrolled = true; }

    function startDecode(dir) {
      if (!tokens.length || signal.aborted) return;
      setHover(-1);
      decoding = true;
      direction = dir;
      cursor = -1;
      emitted = 0;
      budget = 0;
      holding = 0;
      settled = false;
      userScrolled = false;
      following = false;
      scrollSet = window.scrollY;
      maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      for (let i = 0; i < tileCount; i++) tileEls[i].classList.remove('tk-lit', 'tk-now');
      layer.classList.add('tk-decoding');
      if (typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function') {
        future = document.createRange();
        const head = runs[0];
        const tail = runs[runs.length - 1];
        future.setStart(head.nodes[0], head.rawStart[0]);
        future.setEnd(tail.nodes[tail.nodes.length - 1], tail.rawEnd[tail.text.length - 1]);
        CSS.highlights.set(HIGHLIGHT, new Highlight(future));
      }
      emit();
      stopFrames = frames(step);
    }

    function emit() {
      if (cursor >= 0) for (let i = firstTile[cursor]; i < firstTile[cursor + 1]; i++) tileEls[i].classList.remove('tk-now');
      cursor = direction > 0 ? emitted : tokens.length - 1 - emitted;
      emitted++;
      for (let i = firstTile[cursor]; i < firstTile[cursor + 1]; i++) tileEls[i].classList.add('tk-lit', 'tk-now');
      if (future) {
        const token = tokens[cursor];
        const run = runs[tokenRun[cursor]];
        // Forward: the future is everything after this token; reverse: everything before it.
        if (direction > 0) future.setStart(run.nodes[run.charNode[token.end - 1]], run.rawEnd[token.end - 1]);
        else future.setEnd(run.nodes[run.charNode[token.start]], run.rawStart[token.start]);
        const highlight = CSS.highlights.get(HIGHLIGHT);
        if (highlight) { highlight.delete(future); highlight.add(future); }   // repaint the moved range
      }
    }

    function step(dt) {
      if (!decoding) return false;
      // Scroll geometry is read before this frame's class changes, and not at all in the first
      // frame, so the browser's own style pass absorbs the replay's start instead of a forced one.
      if (settled) follow(dt);
      settled = true;
      if (emitted >= tokens.length) {
        holding += dt;
        if (holding >= DECODE_HOLD_S) { stopDecode(); return false; }
      } else {
        budget += dt * DECODE_RATE;
        while (budget >= 1 && emitted < tokens.length) { budget -= 1; emit(); }
      }
      return true;
    }

    /** Keep the cursor in view, gently, unless the reader has scrolled on their own. */
    function follow(dt) {
      if (userScrolled || cursor < 0 || firstTile[cursor] === firstTile[cursor + 1]) return;
      syncOrigin();
      const viewY = tileY[firstTile[cursor]] + originY;
      const height = window.innerHeight;
      if (viewY < height * SCROLL_BAND[0] || viewY > height * SCROLL_BAND[1]) following = true;
      if (!following) return;
      const target = Math.max(0, Math.min(maxScroll, window.scrollY + viewY - height * SCROLL_ANCHOR));
      const now = window.scrollY;
      const next = reduced() ? target : now + (target - now) * (1 - Math.exp(-dt / SCROLL_TAU_S));
      if (Math.abs(target - next) < 1) following = false;
      if (Math.abs(next - now) >= 0.5) {
        scrollTarget.top = next;
        window.scrollTo(scrollTarget);
        scrollSet = window.scrollY;
      }
    }

    function stopDecode() {
      if (!decoding) return;
      decoding = false;
      if (stopFrames) stopFrames();
      stopFrames = null;
      layer.classList.remove('tk-decoding');
      for (let i = 0; i < tileCount; i++) tileEls[i].classList.remove('tk-lit', 'tk-now');
      if (future && CSS.highlights) CSS.highlights.delete(HIGHLIGHT);
      future = null;
    }

    /** Run fn(dt) every frame through the core's shared loop until it returns false or is stopped. */
    function frames(fn) {
      let live = true;
      const unregister = ctx.frame(dt => (live ? fn(Math.min(dt, 0.1)) !== false && live : false));
      return () => {
        live = false;
        if (typeof unregister === 'function') unregister();
      };
    }

    return {
      enter,
      exit,
      get count() { return tokens.length; },
      // Test hooks: the run texts and token ids exactly as tiled, and the decode state.
      snapshot: () => runs.map(run => ({ text: run.text, ids: tokens.slice(run.first, run.first + cache.get(run.text).length).map(t => t.id) })),
      decode: dir => startDecode(dir),
      get decoding() { return decoding; },
      get cursor() { return cursor; },
      hover: t => setHover(t),
      get tileCount() { return tileCount; }
    };
  }

  /** setTimeout as a promise; resolves early when the signal aborts. */
  function wait(ms, signal) {
    return new Promise(resolve => {
      if (signal && signal.aborted) { resolve(); return; }
      const id = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
    });
  }

  lenses.register({
    id: 'tokens',
    order: 2,
    numeral: 'II',
    label: 'Through a model’s eyes',
    line: 'This page, in the tokens a language model reads.',
    css: true,
    async enter(ctx) {
      const ranks = await loadRanks(ctx.root);
      if (ctx.signal.aborted) return;
      session = createSession(ctx, ranks);
      await session.enter();
    },
    async exit(ctx) {
      const current = session;
      session = null;
      if (current) await current.exit(Boolean(ctx && ctx.instant));
    },
    // Null until this activation has counted its tokens: the core then shows the caption once
    // enter() settles. The replay hint is the second line during the first activation only.
    caption() {
      if (!session || !session.count) return null;
      const line = `This page is ${session.count.toLocaleString('en-US')} tokens to a language model.`;
      // The replay is keyboard-only, so a touch-only device gets no arrow-key hint.
      if (!hintPending || window.matchMedia('(hover: none) and (pointer: coarse)').matches) return line;
      hintPending = false;
      return { line, note: HINT };
    },
    // Test hooks (not part of the lens contract).
    _tokenizer: { parseRanks, encode, showBytes, hexBytes },
    get _session() { return session; },
    _stats: stats
  });
})();
