/**
 * Lens II · Through a model's eyes.
 *
 * Every token of the page, as GPT-4's cl100k_base tokenizer splits it, gets a soft tinted
 * tile behind it. The tokenizer is a faithful port of tiktoken: the same regex pre-tokenizer,
 * then byte-pair merges by rank over the UTF-8 bytes of each piece. The ranks come from
 * easter/lenses/data/cl100k.txt (built by scripts/build_cl100k.py), fetched the first time the lens enters.
 *
 * Text is read, never written: tiles are absolute boxes drawn from Range rects in the core's
 * page layer, and the decode replay dims not-yet-emitted text with the CSS Custom Highlight API
 * (no DOM wrapping). Press → to replay the page in the order an autoregressive model would emit
 * it, ← for the reverse order (a nod to LEDOM, a reverse language model). The replay shows
 * order only; it never shows model outputs or probabilities.
 *
 * Every page kind: all of the page's text is tokenized, so the count is exact, but tiles exist
 * only for blocks within a screen of the viewport (an IntersectionObserver, a first pass at
 * build time and a re-measure when scrolling settles). Long work (parsing the ranks, reading and
 * encoding a long paper) runs in slices of a few milliseconds. Late content (rendered markdown,
 * star counts, opened abstracts, live demos) rebuilds the page model through ctx.onContentChange;
 * layout that moves without a DOM change (lazy photos, fonts, a padding change) re-measures the
 * placed tiles through ctx.onLayoutChange.
 */
(function () {
  'use strict';

  const lenses = window.SiteLenses;
  if (!lenses) return;

  // ---- Constants ---------------------------------------------------------------------------
  const RANKS_URL = 'easter/lenses/data/cl100k.txt?v=cl100k-v1';
  const RANKS_HEADER = '#cl100k_base';
  const RANKS_FORMAT = 'utf8-escaped-v1';
  const TINTS = 5;                       // tile colours cycle through tk-c0 … tk-c4
  const ENTER_SWEEP_S = 0.42;            // spread of the left-to-right fade-in delays …
  const ENTER_FADE_S = 0.18;             // … plus each tile's own fade = 0.6 s
  const ARRIVE_FADE_S = 0.2;             // arriving from another page: a plain fade
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
  const NEAR_SCREENS = 1;                // tiles exist for blocks within this many screens of the viewport
  const SLICE_MS = 8;                    // longest stretch of background work before yielding to the page
  const PLACE_BUDGET_MS = 2.5;           // tile measuring per frame; the rest waits for the next frame
  const SCROLL_IDLE_MS = 150;            // when scrolling settles, the tiles near the viewport are re-measured
  const CHANGE_DEBOUNCE_MS = 150;        // resizes, and content changes when the core offers no onContentChange
  const POOL_MAX = 4000;                 // detached tile elements kept for reuse
  const HIGHLIGHT = 'lens-tokens-future';
  const HINT = '→ decode · ← reverse, like LEDOM';
  const HINT_KEY = 'lenses-tokens-hinted';  // sessionStorage: the hint shows once per visit, not per page
  // Never read: code and styles, and form controls (their values are input, not page text).
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  // Atomic inlines: their content is not page text (SVG <text> included), but they sit in the line.
  const ATOMIC_TAGS = new Set(['IMG', 'SVG', 'svg', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'INPUT', 'TEXTAREA', 'SELECT', 'OBJECT', 'EMBED']);
  const PRESERVE_WS = new Set(['pre', 'pre-wrap', 'break-spaces']);
  const TILE_CLASSES = Array.from({ length: TINTS }, (_, i) => `tk-tile tk-c${i}`);

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

  /**
   * Token bytes as a "binary string" (one char per byte) → rank, for every line of the ranks
   * file. A generator, so the page can parse it in slices (see sliced()); parseRanks() runs it
   * in one go (the node test runner uses that).
   */
  function* parseRanksSteps(text) {
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
      if ((rank & 2047) === 2047) yield;
    }
    if (ranks.size !== count) throw new Error('tokens lens: duplicate ranks');
    return ranks;
  }

  function parseRanks(text) {
    return finish(parseRanksSteps(text));
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

  // ---- Background work in slices ---------------------------------------------------------------
  // Long work is written as generators that yield often; sliced() runs one for at most SLICE_MS
  // at a time and gives the page the main thread in between, so no task grows long.

  /** Run a generator to completion synchronously and return its result. */
  function finish(steps) {
    for (;;) {
      const step = steps.next();
      if (step.done) return step.value;
    }
  }

  function yieldToPage() {
    if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') return scheduler.yield();
    return new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    });
  }

  /** Run a generator in slices; resolves with its result, or null if the signal aborts first. */
  async function sliced(steps, signal) {
    let began = performance.now();
    for (;;) {
      const step = steps.next();
      if (step.done) return step.value;
      if (performance.now() - began >= SLICE_MS) {
        stats.sliceMaxMs = Math.max(stats.sliceMaxMs, performance.now() - began);
        await yieldToPage();
        if (signal && signal.aborted) return null;
        began = performance.now();
      }
    }
  }

  // ---- Reading the page's text ----------------------------------------------------------------
  // The page is tokenized per text run: the rendered text of one line of flow, i.e. the inline
  // text of a block between block boundaries, <br>s and inline-blocks, gathered across its Text
  // nodes, so a link stays inside its sentence ("student at" + "Duke" encodes " Duke" as one
  // token, as BPE would). CSS whitespace collapsing is applied first, so a run holds what a
  // reader sees; code keeps its newlines and indentation. Runs are encoded independently; a
  // model given the whole page would also see the separators between them (newlines that the
  // DOM does not hold), so only tokens at run edges are an approximation. A token that spans
  // two Text nodes gets one tile per line fragment.
  //
  // Read: every rendered Text node in the scope, including buttons, labels, captions, table
  // cells and code. Not read: <script>/<style>, form controls, [contenteditable], SVG and
  // canvas content (SVG <text> included), hidden or collapsed content, and text parked off the
  // page (skip links).

  /**
   * Collect the rendered text runs of the scope, in document order (a generator: it yields after
   * each Text node and returns the runs). Each run is { text, nodes, charNode, rawStart, rawEnd,
   * block, fixed }: the whitespace-collapsed text; for each of its UTF-16 units the Text node it
   * came from and its [start, end) offsets in that node's data; the element its line flows in;
   * and whether that element sits in a fixed-position box.
   */
  function* collectRuns(scope) {
    const styles = new Map();
    const styleOf = el => {
      let style = styles.get(el);
      if (!style) {
        const computed = getComputedStyle(el);
        style = { display: computed.display, position: computed.position, whiteSpace: computed.whiteSpace };
        styles.set(el, style);
      }
      return style;
    };
    const displayOf = el => styleOf(el).display;
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
    const fixedBoxes = new Map();
    const inFixed = el => {
      if (!el || el === document.body || el === document.documentElement) return false;
      let fixed = fixedBoxes.get(el);
      if (fixed === undefined) {
        fixed = styleOf(el).position === 'fixed' || inFixed(el.parentElement);
        fixedBoxes.set(el, fixed);
      }
      return fixed;
    };
    const shown = new Map();
    const isShown = el => {
      let visible = shown.get(el);
      if (visible === undefined) {
        // checkVisibility also sees content-visibility: hidden (a closed <details>).
        visible = typeof el.checkVisibility === 'function'
          ? el.checkVisibility({ visibilityProperty: true })
          : getComputedStyle(el).visibility === 'visible';
        shown.set(el, visible);
      }
      return visible;
    };

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
          if (node.isContentEditable) return NodeFilter.FILTER_REJECT;
          if (node.tagName === 'BR' || ATOMIC_TAGS.has(node.tagName)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === 1) {
          enterBlock(blockOf(node.parentNode));
          // A <br> or a block-level replaced element ends the line; an inline one splits the run.
          const inline = node.tagName !== 'BR' && atomic(node);
          endRun(!inline);
          atLineStart = !inline;
          afterSpace = false;
          if (ATOMIC_TAGS.has(node.tagName)) walker.currentNode = lastDescendant(node);
          continue;
        }
        const parent = node.parentElement;
        if (!parent || !node.data || !isShown(parent)) continue;
        // Visible characters drawn off the page (a skip link parked above the top) are not on
        // it. Whitespace-only nodes are never tested: a rendered space may be zero-width.
        const fixed = inFixed(parent);
        const blank = !/[^ \t\n\r\f]/.test(node.data);
        if (!blank && !onPage(node, fixed)) continue;
        enterBlock(blockOf(node));
        if (!run) {
          run = { text: '', nodes: [], charNode: [], rawStart: [], rawEnd: [], trailingSpace: false, block, fixed, first: 0, encoded: null };
        }
        if (collapse(node, styleOf(parent).whiteSpace, atLineStart || afterSpace, run)) {
          atLineStart = false;
          afterSpace = run.trailingSpace;
        }
        yield;
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
   * Append one Text node's rendered characters to a run, applying CSS white-space processing:
   * pre, pre-wrap and break-spaces keep everything; pre-line keeps newlines and collapses spaces
   * around them; normal and nowrap collapse every run of whitespace to one space. Returns
   * whether anything was appended.
   */
  function collapse(node, whiteSpace, skipSpace, run) {
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
    if (PRESERVE_WS.has(whiteSpace)) {
      for (let i = 0; i < data.length; i++) add(data[i], i, i + 1, false);
    } else {
      const keepBreaks = whiteSpace === 'pre-line';
      // A stretch of collapsible whitespace renders as one space, or as nothing at the start of
      // a line or right after another collapsed space. (No-break spaces are not collapsible.)
      for (let i = 0; i < data.length;) {
        if (isCollapsible(data.charCodeAt(i))) {
          let j = i + 1;
          while (j < data.length && isCollapsible(data.charCodeAt(j))) j++;
          const brk = keepBreaks ? data.indexOf('\n', i) : -1;
          if (brk !== -1 && brk < j) {
            // pre-line: every newline survives; the spaces on either side of them do not.
            if (text && run.trailingSpace) {
              text = text.slice(0, -1);
              run.charNode.pop(); run.rawStart.pop(); run.rawEnd.pop();
            }
            for (let k = brk; k < j; k++) if (data.charCodeAt(k) === 0x0a) add('\n', k, k + 1, false);
            skipSpace = true;
          } else {
            if (!skipSpace) add(' ', i, j, true);
            skipSpace = true;
          }
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
  /** False for text drawn off the page: above or left of the document, or off a fixed viewport. */
  function onPage(node, fixed) {
    probe.selectNodeContents(node);
    const rects = probe.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.width <= 0 || r.height <= 0) continue;
      if (fixed ? r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth
        : r.bottom + window.scrollY > 0 && r.right + window.scrollX > 0) return true;
    }
    return false;
  }

  /** Encode every run (a generator), reusing the encodings of texts seen before. */
  function* encodeRuns(ranks, runs, previous, next) {
    for (const run of runs) {
      let encoded = next.get(run.text) || previous.get(run.text);
      if (!encoded) {
        encoded = encode(ranks, run.text);
        yield;
      }
      next.set(run.text, encoded);
      run.encoded = encoded;
    }
    return true;
  }

  // ---- Ranks loading (once per page) ----------------------------------------------------------
  let ranksPromise = null;
  // Measurements for the tests: build and placement times, sizes, and the slowest placement.
  const stats = { fetchMs: 0, parseMs: 0, buildMs: 0, layoutMs: 0, tokens: 0, runs: 0, blocks: 0, tiles: 0, builds: 0, placements: 0, placeMaxMs: 0, placeTotalMs: 0, marks: {}, slowest: {}, sliceMaxMs: 0 };

  /** Wrap a callback so the tests can see the slowest call of each kind (ms, and page time). */
  function timed(name, fn) {
    return function (a, b) {
      const began = performance.now();
      try {
        return fn.call(this, a, b);
      } finally {
        const ms = performance.now() - began;
        const slow = stats.slowest[name];
        if (!slow || ms > slow.ms) stats.slowest[name] = { ms: +ms.toFixed(2), at: Math.round(began) };
      }
    };
  }

  function loadRanks(root) {
    if (!ranksPromise) {
      const began = performance.now();
      ranksPromise = fetch(new URL(RANKS_URL, root))
        .then(response => {
          if (!response.ok) throw new Error(`tokens lens: ranks file HTTP ${response.status}`);
          return response.text();
        })
        .then(async text => {
          const parsed = performance.now();
          stats.fetchMs = parsed - began;
          const ranks = await sliced(parseRanksSteps(text));
          stats.parseMs = performance.now() - parsed;
          return ranks;
        })
        .catch(error => { ranksPromise = null; throw error; });
    }
    return ranksPromise;
  }

  // ---- The lens ---------------------------------------------------------------------------
  let session = null;
  const hintShown = () => { try { return sessionStorage.getItem(HINT_KEY) === '1'; } catch (error) { return false; } };

  function createSession(ctx, ranks) {
    const html = document.documentElement;
    const signal = ctx.signal;
    const reduced = () => ctx.motion.matches;
    const range = document.createRange();
    const layer = ctx.layer('page');
    const overlay = ctx.layer('fixed');

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

    // ---- The page model: every token, swapped whole by commit() -----------------------------
    let encodings = new Map();  // run text → tokens, so a rebuild re-encodes only new text
    let runs = [];
    let tokens = [];            // page order; token objects are shared with `encodings`
    let tokenRun = new Int32Array(0);
    let blocks = [];            // { el, runs, tiles, near }: the elements text flows in
    let blockByEl = new Map();

    // ---- Tiles: only for blocks near the viewport --------------------------------------------
    let tokenTiles = [];        // token → its tiles while placed; a tile is { el, x, y, w, h, t }
    let live = [];              // every placed tile, for hit-testing (rebuilt when stale)
    let liveStale = true;
    const pool = [];            // detached tile elements for reuse
    const boxStyles = new Map();  // element → { fixed, clipX, clipY }, cleared by commit()
    let layerX = 0;             // the page layer's document position …
    let layerY = 0;
    let originX = 0;            // … and its viewport position
    let originY = 0;
    const measureLayer = () => {
      const box = layer.getBoundingClientRect();
      originX = box.left;
      originY = box.top;
      layerX = box.left + window.scrollX;
      layerY = box.top + window.scrollY;
    };
    const syncOrigin = () => {
      originX = layerX - window.scrollX;
      originY = layerY - window.scrollY;
    };

    // ---- Building the model (sliced) ---------------------------------------------------------
    let building = null;
    let buildAgain = false;
    function rebuild() {
      if (building) { buildAgain = true; return building; }
      building = (async () => {
        let built = false;
        do {
          buildAgain = false;
          const began = performance.now();
          const found = await sliced(collectRuns(ctx.scope), signal);
          if (!found || signal.aborted) return false;
          const next = new Map();
          if (await sliced(encodeRuns(ranks, found, encodings, next), signal) === null || signal.aborted) return false;
          encodings = next;      // texts no longer on the page are dropped
          stats.buildMs = performance.now() - began;
          timed('commit', commit)(found);
          built = true;
        } while (buildAgain && !signal.aborted);
        return built;
      })().finally(() => { building = null; });
      return building;
    }

    /** Swap in a new model, keep the replay going, and place tiles near the viewport at once. */
    function commit(found) {
      const began = performance.now();
      for (const block of blocks) if (block.tiles) release(block);
      if (observer) observer.disconnect();
      runs = found;
      tokens = [];
      const runOf = [];
      blocks = [];
      blockByEl = new Map();
      runs.forEach((run, r) => {
        run.first = tokens.length;
        for (const token of run.encoded) { tokens.push(token); runOf.push(r); }
        let block = blockByEl.get(run.block);
        if (!block) {
          block = { el: run.block, runs: [], tiles: null, near: false, fixed: run.fixed };
          blockByEl.set(run.block, block);
          blocks.push(block);
        }
        block.runs.push(r);
      });
      tokenRun = Int32Array.from(runOf);
      tokenTiles = new Array(tokens.length);
      boxStyles.clear();
      stats.tokens = tokens.length;
      stats.runs = runs.length;
      stats.blocks = blocks.length;
      stats.builds++;
      if (hovered >= 0) { hovered = -1; hideTip(); }
      if (decoding) resumeDecode();
      queue.clear();
      refreshNear(true);
      if (observer) blocks.forEach(block => observer.observe(block.el));
      stats.layoutMs = performance.now() - began;
      if (pointerX >= 0) requestHover();
    }

    // ---- Placing tiles ----------------------------------------------------------------------
    /**
     * Decide which blocks are near the viewport from their rects (at build time, and as a check
     * when scrolling settles; the IntersectionObserver keeps it current in between). Blocks on
     * screen are placed now when `now` is set (a build: nothing may flicker); the other near
     * blocks queue; far blocks give their tiles back.
     */
    function refreshNear(now) {
      const height = window.innerHeight;
      // Every rect is read before anything changes: releasing tiles between reads would force a
      // layout of the whole page per release (this was a 50 ms task on the longest paper).
      const visible = [];
      for (const block of blocks) {
        const r = block.el.getBoundingClientRect();
        block.near = r.bottom >= -height * NEAR_SCREENS && r.top <= height * (1 + NEAR_SCREENS) && (r.width > 0 || r.height > 0);
        block.distance = Math.abs(r.top + r.height / 2 - height / 2);
        visible.push(r.bottom >= 0 && r.top <= height);
      }
      const onScreen = [];
      blocks.forEach((block, i) => {
        if (!block.near) { if (block.tiles) release(block); return; }
        if (block.tiles) return;
        if (now && visible[i]) onScreen.push(block);
        else enqueue(block);
      });
      layoutBlocks(onScreen);
    }

    /** Re-measure the placed tiles (within one element, if given), a frame's budget at a time. */
    function relayout(within) {
      for (const block of blocks) if (block.tiles && (!within || within.contains(block.el))) enqueue(block);
    }

    // Placement queue: blocks waiting to be placed or re-measured, nearest first, measured for at
    // most PLACE_BUDGET_MS per frame (reads), then placed (writes).
    const queue = new Set();
    let pumpFrame = 0;
    function enqueue(block) {
      queue.add(block);
      if (!pumpFrame && !signal.aborted) pumpFrame = requestAnimationFrame(timedPump);
    }
    const timedPump = timed('pump', () => pump());
    function pump() {
      pumpFrame = 0;
      if (signal.aborted) return;
      const waiting = [...queue].filter(block => block.near).sort((a, b) => a.distance - b.distance);
      queue.clear();
      const done = layoutBlocks(waiting, PLACE_BUDGET_MS);
      for (let i = done; i < waiting.length; i++) queue.add(waiting[i]);
      if (queue.size) pumpFrame = requestAnimationFrame(timedPump);
      requestHover();
    }

    /** Measure blocks (reads) until the budget is spent, then place them (writes). Returns how many. */
    function layoutBlocks(list, budget = Infinity) {
      if (!list.length) return 0;
      const began = performance.now();
      measureLayer();
      const clips = new Map();
      const shapes = [];
      while (shapes.length < list.length && (shapes.length === 0 || performance.now() - began < budget)) {
        shapes.push(measure(list[shapes.length], clips));
      }
      for (let i = 0; i < shapes.length; i++) place(list[i], shapes[i]);
      liveStale = true;
      stats.tiles = countTiles();
      const spent = performance.now() - began;
      stats.placements++;
      stats.placeTotalMs += spent;
      if (spent > stats.placeMaxMs) stats.placeMaxMs = spent;
      return shapes.length;
    }

    /** The tiles of one block: one per line fragment of each token, clipped to scrolling boxes. */
    function measure(block, clips) {
      const out = [];
      const clip = block.fixed ? null : clipOf(block.el, clips);
      if (!clip) return out;          // inside a fixed-position box: counted, not tiled
      const rects = [];
      for (const r of block.runs) {
        const run = runs[r];
        for (let k = 0; k < run.encoded.length; k++) {
          const token = run.encoded[k];
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
            const top = Math.max(rect.top, clip.top);
            const bottom = Math.min(rect.bottom, clip.bottom);
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
            const x0 = Math.round(left - originX);
            const x1 = Math.round(right - originX) - 1;      // 1 px gap to the next tile
            const y0 = Math.round(top - originY);
            const y1 = Math.round(bottom - originY);
            if (x1 - x0 < 1 || y1 - y0 < 2) continue;
            out.push({ el: null, x: x0, y: y0, w: x1 - x0, h: y1 - y0, t: run.first + k });
          }
        }
      }
      return out;
    }

    /** The viewport box that clips an element's text: the intersection of its scrolling ancestors. */
    function clipOf(el, clips) {
      let left = -Infinity;
      let top = -Infinity;
      let right = Infinity;
      let bottom = Infinity;
      for (let box = el; box && box !== html && box !== document.body; box = box.parentElement) {
        let style = boxStyles.get(box);
        if (!style) {
          const computed = getComputedStyle(box);
          const contains = computed.display !== 'inline' && computed.display !== 'contents';
          style = { fixed: computed.position === 'fixed', clipX: contains && computed.overflowX !== 'visible', clipY: contains && computed.overflowY !== 'visible' };
          boxStyles.set(box, style);
        }
        if (style.fixed) return null;
        if (!style.clipX && !style.clipY) continue;
        let edges = clips.get(box);
        if (!edges) {
          const r = box.getBoundingClientRect();
          const x = r.left + box.clientLeft;
          const y = r.top + box.clientTop;
          edges = { left: x, top: y, right: x + box.clientWidth, bottom: y + box.clientHeight };
          clips.set(box, edges);
        }
        if (style.clipX) { left = Math.max(left, edges.left); right = Math.min(right, edges.right); }
        if (style.clipY) { top = Math.max(top, edges.top); bottom = Math.min(bottom, edges.bottom); }
      }
      return { left, top, right, bottom };
    }

    function place(block, shape) {
      const old = block.tiles || [];
      for (const tile of old) tokenTiles[tile.t] = undefined;
      for (let i = 0; i < shape.length; i++) {
        const tile = shape[i];
        let el = i < old.length ? old[i].el : pool.pop();
        if (!el) el = document.createElement('div');
        if (el.parentNode !== tilesBox) tilesBox.append(el);
        el.className = classFor(tile.t);
        el.style.cssText = `left:${tile.x}px;top:${tile.y}px;width:${tile.w}px;height:${tile.h}px`;
        tile.el = el;
        (tokenTiles[tile.t] || (tokenTiles[tile.t] = [])).push(tile);
      }
      for (let i = shape.length; i < old.length; i++) recycle(old[i].el);
      block.tiles = shape;
    }

    function release(block) {
      for (const tile of block.tiles) {
        tokenTiles[tile.t] = undefined;
        recycle(tile.el);
      }
      block.tiles = null;
      liveStale = true;
    }

    function recycle(el) {
      el.remove();
      if (pool.length < POOL_MAX) pool.push(el);
    }

    function countTiles() {
      let n = 0;
      for (const block of blocks) if (block.tiles) n += block.tiles.length;
      return n;
    }

    function liveTiles() {
      if (liveStale) {
        live = [];
        for (const block of blocks) if (block.tiles) for (const tile of block.tiles) live.push(tile);
        liveStale = false;
      }
      return live;
    }

    /** A tile's classes: its tint, and the replay and hover states of its token. */
    function classFor(t) {
      let name = TILE_CLASSES[t % TINTS];
      if (decoding && (direction > 0 ? t <= cursor : t >= cursor) && cursor >= 0) name += t === cursor ? ' tk-lit tk-now' : ' tk-lit';
      if (t === hovered) name += ' tk-hover';
      return name;
    }

    function restyleTiles() {
      for (const tile of liveTiles()) tile.el.className = classFor(tile.t);
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

    // ---- Keeping tiles near the viewport and on their text ----------------------------------
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(timed('intersect', onIntersect), { rootMargin: `${NEAR_SCREENS * 100}% 0px` })
      : null;
    function onIntersect(entries) {
      if (signal.aborted) return;
      const height = window.innerHeight;
      for (const entry of entries) {
        const block = blockByEl.get(entry.target);
        if (!block) continue;
        block.near = entry.isIntersecting;
        const r = entry.boundingClientRect;
        block.distance = Math.abs(r.top + r.height / 2 - height / 2);
        if (block.near && !block.tiles) enqueue(block);
        else if (!block.near && block.tiles) release(block);
      }
      stats.tiles = countTiles();
    }

    let resizeObserver = null;
    let ownObserver = null;
    let skipFirstResize = true;
    let idleTimer = 0;
    let changeTimer = 0;
    // Something moved the text (a resize, a font, a scrolling box): re-measure the placed tiles
    // (within one element, if given) through the queue.
    const requestRelayout = within => {
      if (signal.aborted) return;
      if (decoding && !within) maxScroll = Math.max(0, html.scrollHeight - window.innerHeight);
      relayout(within);
    };
    const requestRebuild = () => { if (!signal.aborted) rebuild(); };
    const debouncedRebuild = () => {
      clearTimeout(changeTimer);
      changeTimer = setTimeout(requestRebuild, CHANGE_DEBOUNCE_MS);
    };

    function watch() {
      window.addEventListener('resize', debouncedRebuild, { signal });     // media queries can show or hide text
      if (document.fonts) document.fonts.addEventListener('loadingdone', () => requestRelayout(null), { signal });
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => { if (skipFirstResize) { skipFirstResize = false; return; } requestRelayout(null); });
        ctx.scope.forEach(el => resizeObserver.observe(el));
      }
      // Layout that moves without a DOM change and without a scope element resizing its
      // content box (a padding change, lazy images in reserved boxes, a toggled <details>):
      // the core's debounced report re-measures the placed tiles.
      if (typeof ctx.onLayoutChange === 'function') ctx.onLayoutChange(() => requestRelayout(null));
      // Late content: the core's debounced observer when it offers one, otherwise our own.
      if (typeof ctx.onContentChange === 'function') {
        ctx.onContentChange(requestRebuild);
      } else if (typeof MutationObserver === 'function') {
        ownObserver = new MutationObserver(debouncedRebuild);
        ctx.scope.forEach(el => ownObserver.observe(el, {
          subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'open', 'class', 'style']
        }));
      }
      document.addEventListener('pointermove', timed('pointer', onPointer), { signal, passive: true });
      document.addEventListener('pointerdown', onPointerDown, { signal, passive: true, capture: true });
      document.addEventListener('pointerout', onPointerOut, { signal, passive: true });
      window.addEventListener('blur', onPointerLeave, { signal });
      window.addEventListener('scroll', timed('scroll', onScroll), { signal, passive: true });
      // Scrolling boxes (wide tables, figures): their tiles move with them.
      document.addEventListener('scroll', timed('boxScroll', onBoxScroll), { signal, passive: true, capture: true });
      window.addEventListener('wheel', onUserScroll, { signal, passive: true });
      window.addEventListener('touchmove', onUserScroll, { signal, passive: true });
      document.addEventListener('keydown', onKey, { signal });
    }
    function unwatch() {
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      if (pumpFrame) cancelAnimationFrame(pumpFrame);
      hoverFrame = 0;
      pumpFrame = 0;
      queue.clear();
      clearTimeout(idleTimer);
      clearTimeout(changeTimer);
      if (resizeObserver) resizeObserver.disconnect();
      if (ownObserver) ownObserver.disconnect();
      if (observer) observer.disconnect();
      resizeObserver = null;
      ownObserver = null;
    }

    function onScroll() {
      if (decoding && Math.abs(window.scrollY - scrollSet) > USER_SCROLL_SLOP) userScrolled = true;
      // A mouse inspects whatever scrolls under it; a tapped token's tooltip goes once the page moves.
      if (touching) onPointerLeave();
      else requestHover();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(scrollIdle, SCROLL_IDLE_MS);
    }
    const scrollIdle = timed('scrollIdle', () => { if (!signal.aborted) refreshNear(false); });
    function onBoxScroll(event) {
      const target = event.target;
      if (target && target.nodeType === 1) requestRelayout(target);
    }

    // ---- Enter / arrive / exit --------------------------------------------------------------
    function sweep() {
      // Tiles near the viewport fade in left to right; the rest simply appear (they are off screen).
      const top = window.scrollY - layerY - window.innerHeight;
      const bottom = window.scrollY - layerY + 2 * window.innerHeight;
      const tiles = liveTiles();
      let minX = Infinity;
      let maxX = -Infinity;
      for (const tile of tiles) {
        if (tile.y < top || tile.y > bottom) continue;
        minX = Math.min(minX, tile.x);
        maxX = Math.max(maxX, tile.x);
      }
      const spread = Math.max(1, maxX - minX);
      for (const tile of tiles) {
        const near = tile.y >= top && tile.y <= bottom;
        tile.el.style.transitionDelay = near ? `${(ENTER_SWEEP_S * (tile.x - minX) / spread).toFixed(3)}s` : '0s';
      }
    }

    /** Build, then fade the tiles in: a left-to-right sweep, or a plain 0.2 s fade on arrival. */
    async function enter(arriving) {
      html.classList.add('lens-tokens');
      const still = () => layer.classList.toggle('tk-still', reduced());
      still();
      ctx.motion.addEventListener('change', still, { signal });
      if (arriving) layer.classList.add('tk-arriving');
      if (!await rebuild()) return;
      stats.marks.built = performance.now();
      const animate = !reduced();
      if (animate && !arriving) sweep();
      if (animate) void layer.offsetWidth;   // commit the hidden state before fading in
      layer.classList.remove('tk-pre');
      watch();
      const settle = async () => {
        if (animate) await wait((arriving ? ARRIVE_FADE_S : ENTER_SWEEP_S + ENTER_FADE_S) * 1000, signal);
        for (const tile of liveTiles()) tile.el.style.transitionDelay = '';
        layer.classList.remove('tk-arriving');
      };
      // An arrival is settled once its tiles are fading in (the page itself is already shown);
      // an entry waits for its sweep, so the caption follows it.
      if (arriving) settle(); else await settle();
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
      for (const block of blocks) if (block.tiles) release(block);
      pool.length = 0;
      tilesBox.remove();
      tip.remove();
      dots.forEach(dot => dot.remove());
    }

    // ---- Hover: tooltip with id, bytes and index in the run ---------------------------------
    let pointerX = -1;
    let pointerY = -1;
    let hovered = -1;
    let hoverFrame = 0;
    let touching = false;       // the last pointer was a finger or a pen
    const requestHover = () => {
      if (pointerX >= 0 && !hoverFrame && !signal.aborted) hoverFrame = requestAnimationFrame(timedHover);
    };
    function onPointer(event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      touching = event.pointerType !== 'mouse';
      requestHover();
    }
    function onPointerDown(event) {
      if (decoding) stopDecode();
      if (event.pointerType !== 'mouse') onPointer(event);   // touch and pen: a tap inspects a token
    }
    function onPointerLeave() { pointerX = -1; setHover(-1); }
    function onPointerOut(event) { if (!event.relatedTarget) onPointerLeave(); }   // left the window
    const timedHover = timed('hover', () => updateHover());
    function updateHover() {
      hoverFrame = 0;
      if (pointerX < 0 || signal.aborted || decoding) { setHover(-1); return; }
      syncOrigin();
      const x = pointerX - originX;
      const y = pointerY - originY;
      const tiles = liveTiles();
      let found = -1;
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (x >= tile.x && x <= tile.x + tile.w + 1 && y >= tile.y - HOVER_SLOP && y < tile.y + tile.h + HOVER_SLOP) {
          found = tile.t;
          break;
        }
      }
      setHover(found);
    }

    function hideTip() {
      tip.classList.remove('tk-on');
      for (let i = 0; i < DOTS_MAX; i++) dots[i].classList.remove('tk-on');
      placedX = placedY = NaN;
    }

    let placedX = NaN;          // where the tooltip was last placed, to skip redundant moves
    let placedY = NaN;
    function setHover(t) {
      const changed = t !== hovered;
      if (changed) {
        const before = hovered >= 0 ? tokenTiles[hovered] : null;
        if (before) for (const tile of before) tile.el.classList.remove('tk-hover');
        hovered = t;
        if (t >= 0) {
          const now = tokenTiles[t];
          if (now) for (const tile of now) tile.el.classList.add('tk-hover');
          const token = tokens[t];
          // Whole characters show as text plus their bytes; partial ones already show as \xHH.
          const shown = showBytes(token.bytes);
          tip.textContent = `${token.id} · "${shown}"${shown.includes('\\x') ? '' : hexBytes(token.bytes)} · #${t - runs[tokenRun[t]].first}`;
        }
      }
      const tiles = t >= 0 ? tokenTiles[t] : null;
      if (!tiles || !tiles.length) { hideTip(); return; }
      // Place the tooltip above the token's first fragment, or below it near the top edge.
      const first = tiles[0];
      const left = first.x + originX;
      const top = first.y + originY;
      if (!changed && left === placedX && top === placedY) return;
      placedX = left;
      placedY = top;
      const width = tip.offsetWidth;
      const height = tip.offsetHeight;
      let y = top - height - TIP_GAP;
      if (y < EDGE) y = top + first.h + TIP_GAP;
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
    // The replay state is an index: tokens before the cursor (after it, in reverse) are emitted.
    // Tiles placed later take their state from it, so the replay runs over pages far longer than
    // the tiles that exist at any moment.
    let decoding = false;
    let direction = 1;
    let cursor = -1;            // the token emitted last
    let emitted = 0;
    let budget = 0;             // fractional tokens owed at DECODE_RATE
    let holding = 0;
    let settled = false;        // false in a replay's first frame, whose style the key handler dirtied
    let userScrolled = false;
    let following = false;
    let scrollSet = 0;
    let maxScroll = 0;
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
      // Demos keep their own keys: sliders, inputs and anything editable.
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || (target.getAttribute && target.getAttribute('role') === 'slider'))) return;
      event.preventDefault();
      startDecode(event.key === 'ArrowRight' ? 1 : -1);
    }
    function onUserScroll() { if (decoding) userScrolled = true; }

    function startDecode(dir) {
      if (!tokens.length || signal.aborted) return;
      setHover(-1);
      decoding = true;
      direction = dir;
      emitted = 0;
      cursor = -1;
      budget = 0;
      holding = 0;
      settled = false;
      userScrolled = false;
      following = false;
      scrollSet = window.scrollY;
      maxScroll = Math.max(0, html.scrollHeight - window.innerHeight);
      layer.classList.add('tk-decoding');
      if (typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function') {
        future = document.createRange();
        CSS.highlights.set(HIGHLIGHT, new Highlight(future));
      }
      emit();
      restyleTiles();
      stopFrames = frames(step);
    }

    /** After a rebuild: keep the cursor's place in the new model and re-anchor the dimming. */
    function resumeDecode() {
      if (!tokens.length) { stopDecode(); return; }
      cursor = Math.min(Math.max(cursor, 0), tokens.length - 1);
      emitted = direction > 0 ? cursor + 1 : tokens.length - cursor;
      anchorFuture();
    }

    function anchorFuture() {
      if (!future || !runs.length) return;
      const head = runs[0];
      const tail = runs[runs.length - 1];
      const token = tokens[cursor];
      const run = runs[tokenRun[cursor]];
      // Forward: the future is everything after this token; reverse: everything before it.
      if (direction > 0) {
        future.setStart(run.nodes[run.charNode[token.end - 1]], run.rawEnd[token.end - 1]);
        future.setEnd(tail.nodes[tail.nodes.length - 1], tail.rawEnd[tail.text.length - 1]);
      } else {
        future.setStart(head.nodes[0], head.rawStart[0]);
        future.setEnd(run.nodes[run.charNode[token.start]], run.rawStart[token.start]);
      }
      const highlight = CSS.highlights.get(HIGHLIGHT);
      if (highlight) { highlight.delete(future); highlight.add(future); }   // repaint the moved range
    }

    function emit() {
      const before = cursor >= 0 ? tokenTiles[cursor] : null;
      if (before) for (const tile of before) tile.el.classList.remove('tk-now');
      cursor = direction > 0 ? emitted : tokens.length - 1 - emitted;
      emitted++;
      const now = tokenTiles[cursor];
      if (now) for (const tile of now) tile.el.classList.add('tk-lit', 'tk-now');
      anchorFuture();
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
      if (userScrolled || cursor < 0) return;
      const token = tokens[cursor];
      const run = runs[tokenRun[cursor]];
      span(run, token.start, token.start + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.height) return;
      const height = window.innerHeight;
      if (rect.top < height * SCROLL_BAND[0] || rect.top > height * SCROLL_BAND[1]) following = true;
      if (!following) return;
      const now = window.scrollY;
      const target = Math.max(0, Math.min(maxScroll, now + rect.top - height * SCROLL_ANCHOR));
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
      restyleTiles();
      if (future && typeof CSS !== 'undefined' && CSS.highlights) CSS.highlights.delete(HIGHLIGHT);
      future = null;
    }

    /** Run fn(dt) every frame through the core's shared loop until it returns false or is stopped. */
    function frames(fn) {
      let alive = true;
      const unregister = ctx.frame(dt => (alive ? fn(Math.min(dt, 0.1)) !== false && alive : false));
      return () => {
        alive = false;
        if (typeof unregister === 'function') unregister();
      };
    }

    return {
      enter,
      exit,
      get count() { return tokens.length; },
      // Test hooks: the run texts and token ids exactly as counted, and the tile and replay state.
      snapshot: () => runs.map(run => ({ text: run.text, ids: run.encoded.map(token => token.id) })),
      reads: selector => runs.reduce((n, run) => n + run.nodes.filter(node => node.parentElement && node.parentElement.closest(selector)).length, 0),
      get tileCount() { return countTiles(); },
      get blockCount() { return blocks.length; },
      get nearCount() { let n = 0; for (const block of blocks) if (block.tiles) n++; return n; },
      get building() { return Boolean(building); },
      settle: () => building || Promise.resolve(true),
      decode: dir => startDecode(dir),
      get decoding() { return decoding; },
      get cursor() { return cursor; },
      hover: t => setHover(t)
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

  async function begin(ctx, arriving) {
    const marks = stats.marks = { begin: performance.now() };   // page-relative times, for the tests
    const ranks = await loadRanks(ctx.root);
    marks.ranks = performance.now();
    if (ctx.signal.aborted) return;
    session = createSession(ctx, ranks);
    await session.enter(arriving);
    marks.settled = performance.now();
  }

  lenses.register({
    id: 'tokens',
    order: 2,
    numeral: 'II',
    label: 'Through a model’s eyes',
    line: 'This page, in the tokens a language model reads.',
    ground: null,                // the page itself is the ground: it shows at once on arrival
    css: true,
    enter(ctx) { return begin(ctx, Boolean(ctx.arriving)); },
    // From another page with this lens on: no sweep and no caption, the tiles just fade in.
    arrive(ctx) { return begin(ctx, true); },
    async exit(ctx) {
      const current = session;
      session = null;
      if (current) await current.exit(Boolean(ctx && ctx.instant));
    },
    // Null until this activation has counted its tokens: the core then shows the caption once
    // enter() settles. The replay hint is the second line the first time in a visit.
    caption() {
      if (!session || !session.count) return null;
      const line = `This page is ${session.count.toLocaleString('en-US')} tokens to a language model.`;
      // The replay is keyboard-only, so a touch-only device gets no arrow-key hint.
      if (hintShown() || window.matchMedia('(hover: none) and (pointer: coarse)').matches) return line;
      try { sessionStorage.setItem(HINT_KEY, '1'); } catch (error) { /* the hint may show again */ }
      return { line, note: HINT };
    },
    // Test hooks (not part of the lens contract).
    _tokenizer: { parseRanks, encode, showBytes, hexBytes },
    get _session() { return session; },
    _stats: stats
  });
})();
