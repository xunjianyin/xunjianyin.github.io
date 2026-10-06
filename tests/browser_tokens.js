/* Run with agent-browser eval --stdin against a local static preview of the site.
 * Tests lens II (Through a model's eyes) through the lenses core: the caption and its count,
 * tiles, the hover tooltip (" Duke", the byte-level "Gödel"), link clicks, the decode replay in
 * both directions (rate, dimming, auto-scroll, stopping), relayout when an abstract opens, the
 * dark theme, reduced motion, a mobile viewport and exact restoration. Prints assertions,
 * failures, timings and `fixture`: every tiled text run with the lens's own token ids, which
 * tests/test_cl100k_tokens.py checks against tiktoken. To refresh the fixture:
 *   agent-browser eval --stdin < tests/browser_tokens.js > /tmp/tokens.json
 *   python3 -c "import json; d=json.loads(json.load(open('/tmp/tokens.json'))); \
 *     json.dump(d['fixture'], open('tests/fixtures/cl100k_homepage.json','w'), ensure_ascii=False, indent=1)"
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
  const errors = [];
  const timing = {};
  let doc; let win; let reduced = false;
  let rafLog = null;               // when set, every rAF callback's duration is pushed here

  const load = async (width = 1440, height = 900) => {
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:200000;border:0;background:white`;
    await new Promise(resolve => { frame.onload = resolve; frame.src = '/'; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.querySelector('.easter-egg-footnote') && doc.querySelector('#selected-papers-list li'), 'the page');
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
    // Load the core as the site shell does on the first trigger.
    await Promise.all([['link', { rel: 'stylesheet', href: 'easter/lenses.css?v=lenses-v1' }], ['script', { src: 'easter/lenses.js?v=lenses-v1' }]]
      .map(([tag, attrs]) => new Promise((resolve, reject) => {
        const el = doc.createElement(tag); Object.assign(el, attrs); el.onload = resolve; el.onerror = reject; doc.head.append(el);
      })));
    await until(() => win.SiteLenses, 'the core');
  };
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
    const tiles = doc.querySelectorAll('.tk-tile');
    check(tiles.length === session().tileCount && tiles.length >= count * 0.95, `one tile or more per token (${tiles.length} for ${count})`);
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
    await nextFrames(3);
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

    // ---- Mobile ------------------------------------------------------------------------------
    await load(390, 844);
    const mobileMain = doc.getElementById('main-content').innerHTML;
    await lenses()._debug.goto('tokens');
    check(session().count === count, `the count does not depend on the viewport (${session().count})`);
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
    return JSON.stringify({ assertions, failures, timing, fixture });
  } catch (error) {
    failures.push(`threw: ${error && error.stack || error}`);
    return JSON.stringify({ assertions, failures, timing });
  } finally {
    frame.remove();
    if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme);
    if (storedSeen === null) localStorage.removeItem('lenses-seen'); else localStorage.setItem('lenses-seen', storedSeen);
    if (storedSound === null) localStorage.removeItem('spira-sound'); else localStorage.setItem('spira-sound', storedSound);
  }
})();
