/* Run with agent-browser eval --stdin against a local static preview of the site.
 * Tests lens II (Through a model's eyes) through the lenses core: the caption and its count,
 * tiles near the viewport, the hover tooltip (" Duke", the byte-level "Gödel"), link clicks, the
 * decode replay in both directions (rate, dimming, auto-scroll, stopping), late content (an
 * abstract opens), the dark theme, reduced motion, exact restoration, then the longest paper
 * page: arrival from sessionStorage (no caption), an exact count over virtualized tiles, SVG
 * text and form controls not read, the frame budget while scrolling, the replay on a long
 * page, and a phone width with tiles clipped to a scrolling table.
 * Prints assertions, failures, timings and two fixtures, `fixture` (the homepage) and
 * `paperFixture` (papers/auditing-health-llms.html): every text run with the lens's own token
 * ids, which tests/test_cl100k_tokens.py checks against tiktoken. To refresh them:
 *   agent-browser eval --stdin < tests/browser_tokens.js > /tmp/tokens.json
 *   python3 -c "import json; d=json.loads(json.load(open('/tmp/tokens.json'))); \
 *     [json.dump(d[k], open(f'tests/fixtures/{f}','w'), ensure_ascii=False, indent=1) \
 *      for k, f in (('fixture','cl100k_homepage.json'), ('paperFixture','cl100k_paper.json'))]"
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (predicate, label = 'condition', limit = 15000) => {
    const began = performance.now();
    while (performance.now() - began < limit) { if (predicate()) return; await delay(10); }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const HINT = '→ decode · ← reverse, like LEDOM';
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const storedTheme = localStorage.getItem('theme');
  const storedSeen = localStorage.getItem('lenses-seen');
  const storedSound = localStorage.getItem('spira-sound');
  localStorage.setItem('spira-sound', 'off');
  // A lens kept for the session would arrive with every page the test opens.
  const storedActive = sessionStorage.getItem('lenses-active');
  sessionStorage.removeItem('lenses-active');
  const storedHinted = sessionStorage.getItem('lenses-tokens-hinted');
  sessionStorage.removeItem('lenses-tokens-hinted');
  const errors = [];
  const timing = {};
  let paperFixture = null;
  let doc; let win; let reduced = false;
  let rafLog = null;               // when set, every rAF callback's duration is pushed here

  // Opens a page in the frame. With `core`, loads the lenses core as the site shell does on the
  // first trigger; without it, the page's own boot brings the core (an arrival).
  const load = async (width = 1440, height = 900, path = '/', core = true) => {
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:200000;border:0;background:white`;
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.readyState === 'complete' && doc.getElementById('main-content'), 'the page');
    if (path === '/') await until(() => doc.querySelector('.easter-egg-footnote') && doc.querySelector('#selected-papers-list li'), 'the homepage');
    // The page's own late content (GitHub star counts, markdown) settles before any snapshot.
    let last = ''; let since = performance.now();
    await until(() => {
      const now = doc.getElementById('main-content').innerHTML;
      if (now !== last) { last = now; since = performance.now(); }
      return performance.now() - since > 500;
    }, 'the page to settle', 10000);
    win.addEventListener('error', event => errors.push(event.message));
    win.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
    // Reduced motion is simulated through matchMedia, before the core reads it.
    const match = win.matchMedia.bind(win);
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { get: () => reduced });
      return result;
    };
    const raf = win.requestAnimationFrame.bind(win);
    win.requestAnimationFrame = callback => raf(time => {
      const began = performance.now();
      callback(time);
      if (rafLog) rafLog.push(performance.now() - began);
    });
    if (core && !win.SiteLenses) {
      await Promise.all([['link', { rel: 'stylesheet', href: '/easter/lenses.css?v=lenses-v2' }], ['script', { src: '/easter/lenses.js?v=lenses-v2' }]]
        .map(([tag, attrs]) => new Promise((resolve, reject) => {
          const el = doc.createElement(tag); Object.assign(el, attrs); el.onload = resolve; el.onerror = reject; doc.head.append(el);
        })));
    }
    await until(() => win.SiteLenses, 'the core');
  };
  const nearViewport = rect => rect.bottom >= -win.innerHeight * 1.05 && rect.top <= win.innerHeight * 2.05;
  const lenses = () => win.SiteLenses;
  const lens = () => lenses()._debug.lens('tokens');
  const session = () => lens()._session;
  const nextFrames = (n = 2) => new Promise(resolve => {
    const step = k => (k ? win.requestAnimationFrame(() => step(k - 1)) : resolve());
    step(n);
  });
  const key = (name, target = doc.body) => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  const pointer = (type, x, y, pointerType = 'mouse') => doc.dispatchEvent(new win.PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerType }));
  const tip = () => doc.querySelector('.tk-tip');
  const tipShown = () => tip() && win.getComputedStyle(tip()).visibility === 'visible';
  const leftovers = () => ({
    nodes: doc.querySelectorAll('.tk-tile, .tk-tip, .tk-dot, .tk-tiles, .lenses-layer').length,
    classes: [...doc.documentElement.classList].filter(name => name.startsWith('lens-tokens') || name === 'lenses-hide-glyphs'),
    style: doc.querySelectorAll('link[href*="easter/tokens.css"]').length,
    highlights: win.CSS.highlights ? win.CSS.highlights.size : 0,
    inline: doc.documentElement.getAttribute('style') || ''
  });
  const charRect = (textNode, offset) => {
    const range = doc.createRange(); range.setStart(textNode, offset); range.setEnd(textNode, offset + 1);
    return range.getBoundingClientRect();
  };
  // Where two snapshots first differ, for failure messages.
  const differ = (a, b) => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i === a.length && a.length === b.length ? '' : ` at ${i}: …${a.slice(Math.max(0, i - 60), i + 40)}… vs …${b.slice(Math.max(0, i - 60), i + 40)}…`;
  };
  const textNodeOf = (el, needle) => {
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.data.includes(needle)) return node;
    return null;
  };

  try {
    // ---- Desktop: enter, caption, tiles ------------------------------------------------------
    localStorage.removeItem('lenses-seen');
    await load();
    const main = doc.getElementById('main-content');
    let before = main.innerHTML;
    const beforeTheme = doc.documentElement.getAttribute('data-theme');
    let began = performance.now();
    await lenses()._debug.goto('tokens');
    timing.firstEnterMs = Math.round(performance.now() - began);
    check(lenses().current === 'tokens', 'the tokens lens is active');
    check(main.innerHTML === before, 'entering leaves #main-content untouched');
    const count = session().count;
    timing.tokens = count;
    timing.stats = { ...lens()._stats };
    check(count > 500 && count < 2000, `a plausible token count (${count})`);
    const captionLines = lenses()._debug.state.caption || [];
    check(captionLines[0] === `II · Through a model’s eyes — This page is ${count.toLocaleString('en-US')} tokens to a language model.`, `caption line: ${captionLines[0]}`);
    check(captionLines[1] === HINT, `the LEDOM hint on the first activation: ${captionLines[1]}`);
    // Tiles exist for the blocks within a screen of the viewport: the bio now, the footer later.
    await nextFrames(4);
    const tiles = [...doc.querySelectorAll('.tk-tile')];
    check(tiles.length === session().tileCount && tiles.length > 300, `tiles near the viewport (${tiles.length} for ${count} tokens)`);
    check(tiles.every(el => nearViewport(el.getBoundingClientRect())), 'no tile lies more than a screen away');
    const bioBox = doc.querySelector('.bio').getBoundingClientRect();
    check(tiles.filter(el => { const r = el.getBoundingClientRect(); return r.top >= bioBox.top && r.bottom <= bioBox.bottom; }).length > 40, 'the bio on screen is tiled');
    const layer = doc.querySelector('.lenses-layer-page.tk-layer');
    check(layer && win.getComputedStyle(layer).mixBlendMode === 'multiply', 'tiles blend as a highlighter on the light theme');
    check(!layer.classList.contains('tk-pre'), 'tiles have faded in');
    const snapshot = session().snapshot();
    const fixture = {
      source: 'tests/browser_tokens.js on the homepage (index.html) at 1440x900',
      tokenizer: 'easter/tokens.js (cl100k_base, ranks from easter/cl100k.txt)',
      tokens: count,
      runs: snapshot
    };
    check(snapshot.reduce((sum, run) => sum + run.ids.length, 0) === count, 'the runs hold every token');
    check(snapshot.some(run => run.text.includes('Gödel')) && snapshot.some(run => run.text.includes('—')), 'the runs include Gödel and an em dash');

    // ---- Hover --------------------------------------------------------------------------------
    rafLog = [];
    const duke = [...doc.querySelectorAll('.bio a')].find(a => a.textContent === 'Duke University');
    const dukeRect = duke.getClientRects()[0];
    pointer('pointermove', dukeRect.left + 12, dukeRect.top + dukeRect.height / 2);
    await nextFrames(2);
    check(tipShown() && tip().textContent === '27453 · "␣Duke" · #7', `hover " Duke": ${tip() && tip().textContent}`);
    check(doc.querySelectorAll('.tk-dot.tk-on').length === 1, 'a middle dot marks the leading space');
    const tipBox = tip().getBoundingClientRect();
    check(tipBox.left >= 0 && tipBox.right <= win.innerWidth && tipBox.top >= 0, 'the tooltip stays in the viewport');
    const hit = doc.elementFromPoint(dukeRect.left + dukeRect.width / 2, dukeRect.top + dukeRect.height / 2);
    check(hit && hit.closest('a') === duke, 'links stay clickable under the tiles');
    const godelTitle = [...doc.querySelectorAll('#selected-papers-list .papertitle')].find(el => el.textContent.startsWith('Gödel'));
    const godelNode = textNodeOf(godelTitle, 'Gödel');
    const umlaut = charRect(godelNode, godelNode.data.indexOf('ö'));
    pointer('pointermove', umlaut.left + umlaut.width / 2, umlaut.top + umlaut.height / 2);
    await nextFrames(2);
    check(tip().textContent === '3029 · "ö" (c3 b6) · #1', `hover the ö of Gödel, a two-byte token: ${tip().textContent}`);
    const del = charRect(godelNode, godelNode.data.indexOf('del'));
    pointer('pointermove', del.left + del.width / 2, del.top + del.height / 2);
    await nextFrames(2);
    check(tip().textContent === '9783 · "del" · #2', `hover "del": ${tip().textContent}`);
    // Sweep the pointer across the bio to measure the hover cost.
    const bio = doc.querySelector('.bio').getBoundingClientRect();
    for (let k = 0; k < 40; k++) { pointer('pointermove', bio.left + (k * 13) % bio.width, bio.top + (k * 7) % bio.height); await nextFrames(1); }
    timing.hoverFrameMs = { frames: rafLog.length, avg: +(rafLog.reduce((a, b) => a + b, 0) / rafLog.length).toFixed(3), max: +Math.max(...rafLog).toFixed(3) };
    rafLog = null;
    doc.body.dispatchEvent(new win.PointerEvent('pointerout', { bubbles: true, relatedTarget: null }));
    await nextFrames(1);
    check(!tipShown(), 'the tooltip goes when the pointer leaves the window');

    // ---- Decode, forward --------------------------------------------------------------------
    win.scrollTo({ top: 0, behavior: 'instant' });
    rafLog = [];
    key('ArrowRight');
    check(session().decoding, '→ starts the replay');
    check(win.CSS.highlights && win.CSS.highlights.has('lens-tokens-future'), 'the not-yet-emitted text is dimmed through a highlight');
    began = performance.now();
    await delay(1000);
    const emitted = session().cursor + 1;
    const rate = emitted / ((performance.now() - began) / 1000);
    timing.decodeRate = +rate.toFixed(1);
    check(rate > 30 && rate < 50, `about 40 tokens per second (${rate.toFixed(1)})`);
    check(doc.querySelectorAll('.tk-tile.tk-now').length >= 1, 'the current token is marked');
    timing.decodeFrameMs = { frames: rafLog.length, avg: +(rafLog.reduce((a, b) => a + b, 0) / rafLog.length).toFixed(3), max: +Math.max(...rafLog).toFixed(3) };
    rafLog = null;
    key('x');
    check(!session().decoding, 'any key stops the replay');
    check(!doc.querySelector('.tk-lit, .tk-now') && !win.CSS.highlights.has('lens-tokens-future'), 'stopping restores the tiles and the text');
    check(!doc.querySelector('.tk-layer.tk-decoding'), 'stopping ends the decoding state');

    // ---- Decode, reverse, with the page following ------------------------------------------
    win.scrollTo({ top: 0, behavior: 'instant' });
    key('ArrowLeft');
    check(session().cursor === count - 1, '← starts from the last token');
    await delay(1200);
    check(session().cursor < count - 30, `the reverse replay walks backwards (cursor ${session().cursor})`);
    check(win.scrollY > 100, `the page follows the cursor down to the footer (scrollY ${win.scrollY})`);
    win.dispatchEvent(new win.WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    win.scrollTo({ top: win.scrollY - 200, behavior: 'instant' });
    const held = win.scrollY;
    await delay(500);
    check(Math.abs(win.scrollY - held) < 2, 'after the reader scrolls, the page no longer follows');
    pointer('pointerdown', 5, 5);
    check(!session().decoding, 'a click stops the replay');

    // ---- Esc stops a replay first, then leaves -----------------------------------------------
    key('ArrowRight');
    key('Escape');
    check(!session() || !session().decoding, 'Esc stops the replay');
    await delay(50);
    check(lenses().current === 'tokens', 'the first Esc only stops the replay');

    // ---- Relayout: an abstract opens and closes ----------------------------------------------
    win.scrollTo({ top: 0, behavior: 'instant' });
    const toggle = doc.querySelector('#selected-papers-list .detail-toggle');
    toggle.click();
    // Late content reaches the lens through the core's debounced onContentChange.
    await until(() => session().count !== count, 'the abstract tokens', 3000).catch(() => {});
    await session().settle();
    await nextFrames(3);
    const content = doc.getElementById(toggle.getAttribute('aria-controls'));
    check(!content.hidden && session().count > count, `opening an abstract adds its tokens (${session().count})`);
    const words = textNodeOf(content, ' ');
    if (words) {
      const box = content.getBoundingClientRect();
      const tilesNow = [...doc.querySelectorAll('.tk-tile')].map(el => el.getBoundingClientRect());
      check(tilesNow.some(r => r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.left >= box.left - 1), 'tiles cover the opened abstract');
    }
    toggle.click();
    await until(() => session().count === count, 'the abstract closing', 3000).catch(() => {});
    check(session().count === count, 'closing it restores the count');
    // The page's own toggle rewrites its button and attributes; restoration is measured from here.
    before = main.innerHTML;

    // ---- Dark theme --------------------------------------------------------------------------
    doc.getElementById('theme-toggle').click();
    await nextFrames(2);
    const dark = doc.documentElement.getAttribute('data-theme') === 'dark';
    check(dark && win.getComputedStyle(layer).mixBlendMode === 'screen', 'tiles screen onto the dark theme');
    doc.getElementById('theme-toggle').click();
    await nextFrames(2);

    // ---- Exit and restoration ----------------------------------------------------------------
    win.scrollTo({ top: 300, behavior: 'instant' });
    const scrollBefore = win.scrollY;
    began = performance.now();
    key('Escape');
    await until(() => lenses().current === null && !lenses().busy, 'the exit');
    timing.exitMs = Math.round(performance.now() - began);
    check(main.innerHTML === before, `exit restores #main-content byte for byte${differ(before, main.innerHTML)}`);
    const left = leftovers();
    check(left.nodes === 0 && left.classes.length === 0 && left.style === 0 && left.highlights === 0 && !left.inline, `nothing is left behind: ${JSON.stringify(left)}`);
    check(win.scrollY === scrollBefore, 'exit keeps the scroll position');
    check(doc.documentElement.getAttribute('data-theme') === beforeTheme, 'exit keeps the theme');

    // ---- Second activation: the hint is gone, the ranks are cached ---------------------------
    began = performance.now();
    await lenses()._debug.goto('tokens');
    timing.secondEnterMs = Math.round(performance.now() - began);
    const second = lenses()._debug.state.caption || [];
    check(second.length === 1, `no LEDOM hint on later activations: ${JSON.stringify(second)}`);
    const requests = win.performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /easter\//.test(name));
    check(requests.filter(name => name.includes('cl100k')).length === 1, 'the ranks file is fetched once');
    await lenses().reset({ instant: true });
    check(main.innerHTML === before && leftovers().nodes === 0, `an instant reset restores the page${differ(before, main.innerHTML)}`);

    // ---- Reduced motion ----------------------------------------------------------------------
    reduced = true;
    began = performance.now();
    await lenses()._debug.goto('tokens');
    timing.reducedEnterMs = Math.round(performance.now() - began);
    check(timing.reducedEnterMs < 250, `reduced motion enters at once (${timing.reducedEnterMs} ms)`);
    check(doc.querySelector('.tk-layer.tk-still'), 'reduced motion turns transitions off');
    began = performance.now();
    await lenses().reset();
    timing.reducedExitMs = Math.round(performance.now() - began);
    check(timing.reducedExitMs < 150 && main.innerHTML === before, `reduced motion leaves at once (${timing.reducedExitMs} ms)${differ(before, main.innerHTML)}`);
    reduced = false;

    // ---- The longest paper page: arrival, exact count, virtualized tiles, budgets -------------
    sessionStorage.setItem('lenses-active', 'tokens');
    await load(1440, 900, '/papers/auditing-health-llms.html', false);
    const longTasks = [];
    const longFrames = [];
    try { new win.PerformanceObserver(list => list.getEntries().forEach(e => longTasks.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true }); } catch (error) { /* unsupported */ }
    try { new win.PerformanceObserver(list => list.getEntries().forEach(e => longFrames.push(Math.round(e.duration)))).observe({ type: 'long-animation-frame', buffered: true }); } catch (error) { /* unsupported */ }
    await until(() => win.SiteLenses && win.SiteLenses.current === 'tokens' && doc.querySelector('.tk-layer') && !doc.querySelector('.tk-layer.tk-pre, .tk-layer.tk-arriving'), 'the arrival');
    timing.paperShownAt = Math.round(win.performance.now());
    check(!lenses()._debug.state.caption, 'no caption on arrival');
    check(!doc.documentElement.hasAttribute('data-lens-arriving'), 'the arrival mark is cleared');
    const paperMain = doc.getElementById('main-content');
    await session().settle();
    const paperBefore = paperMain.innerHTML;
    const paperCount = session().count;
    timing.paperTokens = paperCount;
    timing.paperStats = { ...lens()._stats };
    paperFixture = {
      source: 'tests/browser_tokens.js on papers/auditing-health-llms.html at 1440x900',
      tokenizer: 'easter/tokens.js (cl100k_base, ranks from easter/cl100k.txt)',
      tokens: paperCount,
      runs: session().snapshot()
    };
    check(paperCount > 4000, `the long paper is counted whole (${paperCount})`);
    check(session().tileCount < paperCount / 3, `tiles only near the viewport (${session().tileCount} of ${paperCount})`);
    check(session().reads('svg, input, select, textarea, [contenteditable]') === 0, 'SVG text and form controls are not read');
    check(session().reads('button') > 0 && session().reads('figcaption') > 0 && session().reads('td, th') > 0, 'buttons, captions and table cells are read');
    // Scroll the whole page: placement stays within the frame budget.
    const stats = lens()._stats;
    stats.placements = 0; stats.placeMaxMs = 0; stats.placeTotalMs = 0;
    rafLog = [];
    const bottom = doc.documentElement.scrollHeight - win.innerHeight;
    while (win.scrollY < bottom - 1) { win.scrollTo({ top: Math.min(bottom, win.scrollY + 40), behavior: 'instant' }); await nextFrames(1); }
    await delay(300);
    timing.paperScroll = { frames: rafLog.length, rafMaxMs: +Math.max(...rafLog).toFixed(2), placements: stats.placements, placeMaxMs: +stats.placeMaxMs.toFixed(2), placeAvgMs: +(stats.placeTotalMs / Math.max(1, stats.placements)).toFixed(2), maxLiveTiles: stats.tiles };
    rafLog = null;
    check(stats.placeMaxMs <= 6, `placing tiles stays within 6 ms a frame (${stats.placeMaxMs.toFixed(2)} ms)`);
    // Tiles go with whole blocks, so a tall block near the margin may keep a few a little beyond it.
    const farAway = rect => rect.bottom < -2 * win.innerHeight || rect.top > 3 * win.innerHeight;
    check(![...doc.querySelectorAll('.tk-tile')].some(el => farAway(el.getBoundingClientRect())), 'far tiles are released while scrolling');
    const footerText = doc.querySelector('footer.paper-footer, #site-footer');
    if (footerText) {
      const fb = footerText.getBoundingClientRect();
      check([...doc.querySelectorAll('.tk-tile')].some(el => { const r = el.getBoundingClientRect(); return r.top >= fb.top - 1 && r.bottom <= fb.bottom + 1; }), 'the footer is tiled at the bottom');
    }
    // Reading as the integrated suite does: a pointer sweep with jumps of a tenth of the page.
    // No entry point of the lens (scroll, scroll settling, intersection, placement, hover, a
    // rebuild) may run longer than 30 ms, leaving margin under the 50 ms long-task line.
    stats.slowest = {};
    const tall = doc.documentElement.scrollHeight;
    for (let k = 0; k <= 40; k++) {
      doc.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: 200 + k * 20, clientY: 150 + (k % 10) * 50 }));
      if (k % 4 === 0) win.scrollTo({ top: Math.min(tall, (k / 40) * tall * 0.9), behavior: 'instant' });
      await delay(40);
    }
    await delay(300);
    timing.paperSlowest = { ...stats.slowest };
    const slowest = Object.entries(stats.slowest).sort((a, b) => b[1].ms - a[1].ms)[0];
    check(slowest && slowest[1].ms <= 30, `no lens task over 30 ms while reading the paper (${slowest && `${slowest[0]} ${slowest[1].ms} ms`})`);
    // The replay runs over the whole long page.
    win.scrollTo({ top: 0, behavior: 'instant' });
    await delay(150);
    rafLog = [];
    key('ArrowRight');
    await delay(1000);
    check(session().cursor > 25 && session().cursor < 60, `the replay starts at the first token (${session().cursor})`);
    key('x');
    key('ArrowLeft');
    check(session().cursor === paperCount - 1, '← starts from the last token of the paper');
    await delay(2500);
    check(win.scrollY > bottom - 400, `the page follows the reverse replay to the end (scrollY ${Math.round(win.scrollY)} of ${bottom})`);
    key('x');
    timing.paperReplayFrameMs = { frames: rafLog.length, avg: +(rafLog.reduce((a, b) => a + b, 0) / rafLog.length).toFixed(3), max: +Math.max(...rafLog).toFixed(3) };
    rafLog = null;
    timing.paperLongTasks = longTasks.slice();
    timing.paperLongFrames = longFrames.slice();
    // Tasks that began before the lens did belong to the page's own load.
    const lensBegan = lens()._stats.marks.begin;
    const lensTasks = longTasks.filter(task => task.at + task.ms > lensBegan);
    check(lensTasks.length === 0, `no long task once the lens works on the long paper (${JSON.stringify(lensTasks)}; lens began at ${Math.round(lensBegan)} ms)`);
    // Esc restores the paper and forgets the lens for the session.
    key('Escape');
    await until(() => lenses().current === null && !lenses().busy, 'the paper exit');
    check(paperMain.innerHTML === paperBefore, `exit restores the paper byte for byte${differ(paperBefore, paperMain.innerHTML)}`);
    check(leftovers().nodes === 0 && leftovers().highlights === 0, 'nothing is left on the paper');
    check(sessionStorage.getItem('lenses-active') === null, 'Esc forgets the lens for the session');

    // ---- Phone width: the paper's wide table scrolls, its tiles stay inside it --------------
    await load(390, 844, '/papers/auditing-health-llms.html');
    await lenses()._debug.goto('tokens');
    const scroller = [...doc.querySelectorAll('#main-content *')].find(el => {
      const style = win.getComputedStyle(el);
      return (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 20 && el.querySelector('td');
    });
    check(scroller, 'a wide table scrolls sideways at 390 px');
    if (scroller) {
      scroller.scrollIntoView({ block: 'center', behavior: 'instant' });
      await delay(250);
      const box = scroller.getBoundingClientRect();
      const inside = () => [...doc.querySelectorAll('.tk-tile')].map(el => el.getBoundingClientRect()).filter(r => r.top >= box.top - 1 && r.bottom <= box.bottom + 1);
      check(inside().length > 20 && inside().every(r => r.left >= box.left - 1 && r.right <= box.right + 1), 'table tiles are clipped to their scrolling box');
      const cell = [...scroller.querySelectorAll('td')].find(td => { const r = td.getBoundingClientRect(); return r.left > box.left + 30 && r.right < box.right - 30 && td.textContent.trim(); });
      if (cell) {
        scroller.scrollLeft += 80;
        await delay(150);
        const r = cell.getBoundingClientRect();
        check(inside().some(t => t.left >= r.left - 2 && t.right <= r.right + 2 && t.top >= r.top - 2 && t.bottom <= r.bottom + 2), 'tiles follow a cell when the table scrolls');
      }
    }
    await lenses().reset({ instant: true });

    // ---- Mobile ------------------------------------------------------------------------------
    await load(390, 844);
    const mobileMain = doc.getElementById('main-content').innerHTML;
    await lenses()._debug.goto('tokens');
    check(session().count === count, `the count does not depend on the viewport (${session().count})`);
    await nextFrames(4);
    const outside = [...doc.querySelectorAll('.tk-tile')].filter(el => el.getBoundingClientRect().right > 391).length;
    check(outside === 0, `tiles stay inside a 390 px viewport (${outside} outside)`);
    const name = doc.querySelector('.profile-text .name');
    const nameNode = textNodeOf(name, 'Xunjian');
    const x = charRect(nameNode, 0);
    pointer('pointerdown', x.left + x.width / 2, x.top + x.height / 2, 'touch');
    await nextFrames(2);
    check(tipShown() && tip().textContent === '55 · "X" · #0', `a tap inspects a token: ${tip() && tip().textContent}`);
    const mobileTip = tip().getBoundingClientRect();
    check(mobileTip.left >= 0 && mobileTip.right <= 390, 'the tooltip fits the phone width');
    await lenses().reset();
    check(doc.getElementById('main-content').innerHTML === mobileMain && leftovers().nodes === 0, 'mobile exit restores the page');

    check(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    return JSON.stringify({ assertions, failures, timing, fixture, paperFixture });
  } catch (error) {
    failures.push(`threw: ${error && error.stack || error}`);
    return JSON.stringify({ assertions, failures, timing });
  } finally {
    frame.remove();
    if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme);
    if (storedSeen === null) localStorage.removeItem('lenses-seen'); else localStorage.setItem('lenses-seen', storedSeen);
    if (storedSound === null) localStorage.removeItem('spira-sound'); else localStorage.setItem('spira-sound', storedSound);
    if (storedActive === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedActive);
    if (storedHinted === null) sessionStorage.removeItem('lenses-tokens-hinted'); else sessionStorage.setItem('lenses-tokens-hinted', storedHinted);
  }
})();
