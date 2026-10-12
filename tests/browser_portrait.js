/* Run with agent-browser eval --stdin against a local static preview of the site.
 * Tests Self-portrait, the fourth egg (easter/portrait/): its password (selfie, outside a text
 * field; the photo's double-click opens the gallery instead) and lazy loading, no DOM mutation
 * while it is open and exact restoration after it, the model (tests and verdicts, the listing
 * following the kept edits, PSNR rising, the same verdicts for the same seed), the finale and
 * its ending (the painted program is the program), every close path (Escape, a second close,
 * Return, pagehide), a hidden tab, Space and the right arrow, reduced motion (still, one test
 * at a time), the sound (offline renders of every cue, the beat standing still at full
 * strength, the cue log, M and the Sound button, the site's preference), an active lens reset
 * first, the dark theme, a resize, a page without the photo, frame timing and errors.
 * Resolves with assertions, failures, notes and frame timing.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (predicate, label = 'condition', limit = 12000) => {
    const began = performance.now();
    while (performance.now() - began < limit) { if (predicate()) return; await delay(10); }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const storedLens = sessionStorage.getItem('lenses-active'); const storedGround = sessionStorage.getItem('lenses-ground');
  const storedTheme = localStorage.getItem('theme');
  const storedSound = localStorage.getItem('spira-sound');
  localStorage.removeItem('spira-sound');
  const audioPeaks = {};
  sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
  const notes = [];
  const errors = [];
  let frameStats = { frames: 0, avgMs: 0, maxMs: 0 };
  let doc; let win;
  let reduced = false; let queries = [];
  const pending = new Set();
  const shellReady = () => doc.querySelector('.easter-egg-footnote') && win.SiteLensesBoot;
  const load = async (path = '/', ready = shellReady) => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(ready, `${path}: the page and the egg boot`);
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
    // Reduced motion is simulated through matchMedia; change events reach the egg.
    const match = win.matchMedia.bind(win); queries = [];
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') {
        Object.defineProperty(result, 'matches', { get: () => reduced }); queries.push(result);
      }
      return result;
    };
    const raf = win.requestAnimationFrame.bind(win); const cancel = win.cancelAnimationFrame.bind(win);
    pending.clear();
    win.requestAnimationFrame = callback => { const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    win.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
  };
  const setReduced = value => { reduced = value; queries.forEach(query => query.dispatchEvent(new win.Event('change'))); };
  const egg = () => doc.querySelector('#portrait');
  const hook = () => egg()?.portrait;
  const assets = () => doc.querySelectorAll('script[src*="easter/portrait/"],link[href*="easter/portrait/"]');
  const photo = () => doc.querySelector('.profile-photo[data-egg-trigger]');
  const statObjects = new Set();
  const opened = async (label, limit = 12000) => {
    await until(() => egg()?.open && hook(), label, limit);
    statObjects.add(hook().frameStats);
  };
  const painting = async (label = 'the painting to start', limit = 12000) => until(() => hook()?.phase === 'painting', label, limit);
  const mergeStats = () => {
    for (const stats of statObjects) {
      if (!stats.frames) continue;
      const frames = frameStats.frames + stats.frames;
      frameStats = { frames, avgMs: +((frameStats.avgMs * frameStats.frames + stats.avgMs * stats.frames) / frames).toFixed(2),
        maxMs: +Math.max(frameStats.maxMs, stats.maxMs).toFixed(2) };
    }
  };
  // What a close must give back, taken just before an opening.
  const snapshot = () => ({
    className: doc.documentElement.className, htmlAttributes: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).join(' '),
    bodyAttributes: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join(' '),
    main: doc.querySelector('#main-content')?.innerHTML, scrollY: win.scrollY, focus: doc.activeElement,
    photo: photo() ? [...photo().attributes].map(a => `${a.name}=${a.value}`).join(' ') : null
  });
  const restored = (label, before, { frames = true } = {}) => {
    check(!egg(), `${label}: the dialog is removed`);
    check(win.SitePortrait.active === false, `${label}: SitePortrait.active is false`);
    const html = [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).join(' ');
    const body = [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join(' ');
    check(html === before.htmlAttributes && body === before.bodyAttributes,
      `${label}: html and body attributes restored byte for byte ("${html}" vs "${before.htmlAttributes}"; "${body}" vs "${before.bodyAttributes}")`);
    check(win.scrollY === before.scrollY, `${label}: scroll restored (${win.scrollY} of ${before.scrollY})`);
    check(doc.activeElement === before.focus, `${label}: focus restored (${doc.activeElement && doc.activeElement.tagName})`);
    check(doc.querySelector('#main-content')?.innerHTML === before.main, `${label}: page markup unchanged`);
    if (before.photo !== null) check([...photo().attributes].map(a => `${a.name}=${a.value}`).join(' ') === before.photo, `${label}: the photo's attributes unchanged`);
    if (frames) check(pending.size === 0, `${label}: no pending animation frame`);
  };
  const mouse = (type, detail) => photo().dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, detail }));
  const doubleClick = () => { mouse('mousedown', 1); mouse('mouseup', 1); mouse('click', 1); mouse('mousedown', 2); mouse('mouseup', 2); mouse('click', 2); mouse('dblclick', 2); };
  const type = (text = 'selfie', target = doc.body) => {
    for (const key of text) target.dispatchEvent(new win.KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true }));
  };
  // Opens through the test hook (the module loaded first through the boot, if need be).
  const openWith = async options => {
    if (!win.SitePortrait) {
      win.SiteLensesBoot.openPortrait(photo());
      await opened('the boot to load and open the portrait');
      closeNow();
      await until(() => !egg(), 'the first opening to close');
    }
    const result = await win.SitePortrait.open(options);
    await opened('the portrait to open');
    return result;
  };
  const closeNow = () => { const h = hook(); if (h) { h.close(); h.close(); } };
  const key = (k, target = egg()) => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  try {
    /* 1. The password and lazy loading: nothing before it; typed into a text field it does
       nothing; outside one it opens the portrait once and loads it once. The photo's
       double-click opens the gallery, not the portrait. */
    await load('/');
    check(typeof win.SiteLensesBoot.openPortrait === 'function' && /^portrait-v\d+$/.test(win.SiteLensesBoot.portraitVersion),
      `The boot exposes openPortrait and portraitVersion (${win.SiteLensesBoot.portraitVersion})`);
    check(assets().length === 0 && !win.SitePortrait, 'Nothing of the portrait is loaded before the password');
    const field = doc.createElement('input'); doc.body.append(field);
    type('selfie', field);
    await delay(400);
    check(!egg() && assets().length === 0, 'The password typed in a text field opens and loads nothing');
    field.remove();
    let before = snapshot();
    type();
    await opened('the password to open the portrait');
    check(assets().length === 2, `The password loads portrait.js and portrait.css once (${assets().length})`);
    check(!doc.querySelector('#spira') && !doc.querySelector('#murmur') && !doc.querySelector('#gallery') && !(win.SiteLenses && win.SiteLenses.current),
      'The password opens the portrait, not another egg or a lens');
    check(doc.activeElement === egg() && egg().scrollTop === 0, `The dialog takes the focus and opens at its top (${doc.activeElement && doc.activeElement.tagName}, ${egg().scrollTop})`);
    // The flight: the frame starts over the page's photo.
    const lifting = egg().querySelector('.portrait-frame').getAnimations();
    check(lifting.length > 0, 'The frame flies from the photo (an animation on the frame)');
    await painting();
    const main = doc.querySelector('#main-content');
    check(main.innerHTML === before.main, 'While open, the page markup is unchanged');
    await delay(1500);
    check(hook().cursor > 0, `Proposals are shown (${Math.round(hook().cursor)})`);
    closeNow();
    restored('Password', before);
    check(assets().length === 2, 'Closing keeps the loaded assets for the next opening');
    doubleClick();
    await until(() => doc.querySelector('#gallery')?.open, 'the photo to open the gallery');
    check(!egg(), 'A double-click on the photo opens the gallery, not the portrait');
    doc.querySelector('#gallery').gallery.close(); doc.querySelector('#gallery')?.gallery.close();
    await until(() => !doc.querySelector('#gallery'), 'the gallery to close');

    /* 2. The model, at a high fixed rate: tests and verdicts, the listing follows the kept
       edits, the PSNR rises. */
    before = snapshot();
    await openWith({ seed: 9, rate: 6000 });
    await painting();
    await until(() => hook().counts.tests >= 12, 'twelve tests to be shown', 30000);
    let h = hook();
    const counts = h.counts;
    check(counts.kept >= 1 && counts.kept <= counts.tests, `Some edits are kept, some not (${counts.kept} of ${counts.tests})`);
    check(h.psnr > 18, `The PSNR has risen from the blank paper (${h.psnr.toFixed(2)} dB)`);
    check(h.committed >= h.cursor, `The simulation is ahead of the display (${h.committed} >= ${Math.round(h.cursor)})`);
    // The listing shows the program as shown, and the shown program is a past self.
    const listing = h.listing();
    check(listing.length === 10 && listing[0] === String([40, 28, 20, 14, 10, 7, 5, 4, 3, 2][h.shown.size]),
      `The listing shows ten lines, the size as shown (${listing.join(' | ')})`);
    const verdicts = h.verdicts();
    check(verdicts.length === counts.tests && verdicts.every(v => /^[12] \w+ \d+>\d+ (kept|not)$/.test(v)), `Every verdict is logged (${verdicts.slice(0, 3).join(', ')})`);
    // A kept edit to paint changed the shown program to its new value.
    const keptPaint = verdicts.filter(v => v.startsWith('1 ') && v.endsWith('kept'));
    check(keptPaint.length > 0, `At least one edit to paint was kept (${keptPaint.length})`);
    // The painting is no longer blank paper.
    const paint = egg().querySelector('.portrait-paint');
    const g = paint.getContext('2d');
    const pixels = g.getImageData(0, 0, paint.width, paint.height).data;
    let distinct = new Set();
    for (let i = 0; i < pixels.length; i += 4 * 997) distinct.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    check(distinct.size > 20, `The canvas holds a painting (${distinct.size} distinct sampled colours)`);
    check(h.scale >= 1 && paint.width === 160 * h.scale, `The canvas is 160 cells of whole device pixels (${paint.width}, scale ${h.scale})`);
    const firstVerdicts = verdicts.slice(0, 10);
    closeNow();
    restored('Model', before);

    /* 2b. The same seed shows the same verdicts; another seed, others. */
    await openWith({ seed: 9, rate: 6000 });
    await until(() => hook().counts.tests >= 10, 'ten tests again', 30000);
    check(JSON.stringify(hook().verdicts().slice(0, 10)) === JSON.stringify(firstVerdicts), 'The same seed gives the same first ten verdicts');
    closeNow();
    await openWith({ seed: 10, rate: 6000 });
    await until(() => hook().counts.tests >= 10, 'ten tests with another seed', 30000);
    check(JSON.stringify(hook().verdicts().slice(0, 10)) !== JSON.stringify(firstVerdicts), 'Another seed gives other verdicts');
    closeNow();

    /* 3. The finale: the sitter becomes the program's text; at the end the shown program is
       the program, and the caption says how it ended. */
    before = snapshot();
    await openWith({ seed: 33, rate: 200000, simMs: 30, finaleAt: 6000 });
    await until(() => hook().finale, 'the finale', 30000);
    const story = () => egg().querySelector('.portrait-story').textContent;
    check(/its own sitter/.test(story()), `The caption turns to the finale (${story().slice(0, 80)})`);
    await until(() => hook().phase === 'ended', 'the ending', 60000);
    h = hook();
    check(!!h.ending && typeof h.ending.settled === 'boolean', `It ends, settled or not (${JSON.stringify(h.ending)})`);
    check(h.shownText() === h.text(), 'At the end the listing shows the program itself');
    check(h.ending.settled ? /fixed point/.test(story()) : /not settled/.test(story()), `The caption names the ending (${story().slice(0, 90)})`);
    if (h.ending.settled) check(h.psnr >= 19.5, `A settled self-portrait matches its text (${h.psnr.toFixed(2)} dB)`);
    const cues = h.audioCues();
    check(cues.filter(c => c.startsWith('verdict ')).length === Math.min(h.counts.tests, 800 - 3), `Every verdict has a sound cue (${cues.filter(c => c.startsWith('verdict ')).length} of ${h.counts.tests})`);
    check(cues.includes('finale') && cues.at(-1) === `ending ${h.ending.settled ? 'settled' : 'unsettled'}`, `The finale and the ending have their cues (${cues.slice(-2).join(', ')})`);
    notes.push(`finale: seed 33 ended ${h.ending.settled ? 'settled' : 'unsettled'} at ${h.ending.at} proposals, ${h.psnr.toFixed(1)} dB; ${h.text().replace(/\n/g, ' / ')}`);
    await delay(300);
    check(pending.size === 0, 'At rest after the ending (no animation frame pending)');
    closeNow();
    restored('Finale', before);

    /* 4. Close paths. Escape (the dialog's cancel): the flight home, then removal. */
    before = snapshot();
    await openWith({ seed: 1 });
    await painting();
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(hook().phase === 'closing', 'Escape starts the way back');
    check(egg().querySelector('.portrait-frame').getAnimations().length > 0, 'The way back flies the frame');
    await until(() => !egg(), 'the way back to finish', 4000);
    restored('Escape', before);

    /* 4b. A second close during the way back closes at once. */
    before = snapshot();
    await openWith({ seed: 1 });
    await painting();
    hook().close(); hook().close();
    check(!egg(), 'A second close removes the dialog at once');
    restored('Second close', before);

    /* 4c. Return (hidden until intent) closes. */
    before = snapshot();
    await openWith({ seed: 1 });
    await painting();
    const chrome = egg().querySelector('.portrait-chrome');
    check(!chrome.classList.contains('is-shown'), 'Return is hidden until intent');
    egg().dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, clientX: 1270, clientY: 890 }));
    check(chrome.classList.contains('is-shown'), 'The pointer in the bottom-right corner shows Return');
    const returnButton = [...chrome.querySelectorAll('button')].find(b => b.textContent.trim() === 'Return');
    returnButton.click();
    await until(() => !egg(), 'Return to finish', 4000);
    restored('Return', before);

    /* 4d. pagehide closes at once. */
    before = snapshot();
    await openWith({ seed: 1 });
    win.dispatchEvent(new win.Event('pagehide'));
    check(!egg(), 'pagehide removes the dialog at once');
    restored('pagehide', before);

    /* 5. A hidden tab pauses; Space holds and resumes; the right arrow shows the rest of a test. */
    await openWith({ seed: 2, rate: 2000 });
    await painting();
    await delay(400);
    Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
    doc.dispatchEvent(new win.Event('visibilitychange'));
    let at = hook().cursor;
    await delay(400);
    check(hook().cursor === at && pending.size === 0, `A hidden tab pauses (${at} → ${hook().cursor})`);
    delete doc.hidden;
    doc.dispatchEvent(new win.Event('visibilitychange'));
    await until(() => hook().cursor > at, 'the visible tab to resume', 4000);
    key(' ');
    check(hook().held, 'Space holds');
    at = hook().cursor;
    await delay(400);
    check(hook().cursor === at, 'Held, nothing advances');
    const testsBefore = hook().counts.tests;
    key('ArrowRight');
    check(hook().counts.tests >= testsBefore + 1 || hook().cursor > at, `The right arrow shows the rest of the test (${testsBefore} → ${hook().counts.tests})`);
    key(' ');
    check(!hook().held, 'Space resumes');
    // A resize redraws the charts and keeps the portrait open.
    frame.style.width = '1100px';
    await delay(300);
    check(!!egg() && egg().open, 'A resize keeps the portrait open');
    frame.style.width = '1280px';
    await delay(200);
    closeNow();

    /* 5b. Sound. Offline: the same synthesizer on an OfflineAudioContext, measured. */
    const render = async (seconds, play, channels = 2) => {
      const rate = 48000; const context = new win.OfflineAudioContext(channels, Math.round(rate * seconds), rate);
      const audio = win.SitePortrait.createAudio(context, { fadeIn: false });
      await play(audio, context);
      const scheduled = audio.scheduled; const buffer = await context.startRendering();
      let peak = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) { const data = buffer.getChannelData(c); for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; } }
      return { peak: +peak.toFixed(4), scheduled, buffer };
    };
    const renders = {
      keptPaint: await render(2.5, a => a.cue.verdict(0.05, 1, 2, true)),
      notKept: await render(0.6, a => a.cue.verdict(0.05, 1, 2, false)),
      keptImprove: await render(3, a => a.cue.verdict(0.05, 2, 1, true)),
      itself: await render(3.5, a => a.cue.verdict(0.05, 2, 4, true, true)),
      finale: await render(6, a => a.cue.finale(0.05)),
      settled: await render(7, a => a.cue.ending(0.05, true)),
      unsettled: await render(6, a => a.cue.ending(0.05, false)),
      whoosh: await render(1, a => a.cue.whoosh(0.05, true, 0.65)),
      brush: await render(2, a => a.brush(5000, 40, 0)),
      beat: await render(3, a => a.beat(1, 2, 0)),
      mix: await render(14, a => { a.beat(1, 1.5, 0); a.brush(2000, 10, 0); for (let i = 0; i < 9; i++) a.cue.verdict(0.5 + i * 1.3, i % 6 === 5 ? 2 : 1, i % 5, i % 3 === 0); a.cue.finale(12); })
    };
    for (const [name, result] of Object.entries(renders)) {
      audioPeaks[name] = result.peak;
      check(result.peak > 0.01 && result.peak < 0.9, `Offline ${name}: audible and unclipped (peak ${result.peak})`);
    }
    check(renders.itself.scheduled === 3 * renders.keptImprove.scheduled, `The rule that rewrote itself plays its motif three times (${renders.itself.scheduled} voices, ${renders.keptImprove.scheduled} for one)`);
    const silent = await render(0.5, a => { a.setEnabled(false); a.cue.verdict(0.05, 1, 0, true); a.cue.finale(0.1); });
    check(silent.scheduled === 0 && silent.peak === 0, 'With the sound off the synthesizer schedules nothing and is silent');
    // The beat stops at full strength whatever phase the roots meet at.
    const stilled = [];
    for (const stopAt of [2.37, 2.61, 2.85]) {
      const result = await render(7, (a, context) => {
        a.beat(1, 2, 0);
        context.suspend(stopAt).then(() => { a.beat(1, 0, stopAt); context.resume(); });
      }, 1);
      const data = result.buffer.getChannelData(0); let sum = 0;
      for (let i = 5 * 48000; i < 7 * 48000; i++) sum += data[i] * data[i];
      stilled.push(Math.sqrt(sum / (2 * 48000)));
    }
    check(Math.max(...stilled) - Math.min(...stilled) < 0.002 && Math.min(...stilled) > 0.02, `The stilled beat has one level whenever it stops (${stilled.map(v => v.toFixed(4)).join(', ')})`);

    /* 5c. Sound live: the opening's cue, M and the Sound button, the site's preference. */
    await openWith({ seed: 4, rate: 3000 });
    h = hook();
    const soundButton = egg().querySelector('.portrait-sound');
    check(h.sound && soundButton.getAttribute('aria-pressed') === 'true' && /Sound on/.test(soundButton.textContent), `The sound starts on, its button says so (${soundButton.textContent})`);
    check(h.audioCues()[0] === 'whoosh up', `The flight has its cue (${h.audioCues()[0]})`);
    key('m');
    check(!h.sound && localStorage.getItem('spira-sound') === 'off' && /Sound off/.test(soundButton.textContent), 'M switches the sound off and stores it');
    closeNow();
    await openWith({ seed: 4 });
    check(!hook().sound && hook().audioState === null && hook().audioCues().length === 0, 'With the sound off a re-open makes no context and logs no cue');
    egg().querySelector('.portrait-sound').click();
    check(hook().sound && localStorage.getItem('spira-sound') === 'on' && hook().audioState !== null, `The Sound button turns it back on and makes a context (${hook().audioState})`);
    closeNow();

    /* 6. Reduced motion: no flight, the paper at once, Next test shown, one test per step;
       Escape closes at once. */
    setReduced(true);
    before = snapshot();
    await openWith({ seed: 3 });
    h = hook();
    check(h.still && h.phase === 'painting', 'Reduced motion: it opens still');
    check(egg().querySelector('.portrait-frame').getAnimations().length === 0, 'Reduced motion: no flight');
    check(getComputedStyle(egg().querySelector('.portrait-ground')).opacity === '1', 'Reduced motion: the paper covers the page at once');
    const step = egg().querySelector('.portrait-step');
    check(getComputedStyle(step).display !== 'none' && egg().querySelector('.portrait-chrome').classList.contains('is-shown'),
      'Reduced motion: Next test and Return are shown');
    await delay(500);
    check(h.cursor === 0, `Reduced motion: nothing advances by itself (${h.cursor})`);
    step.click();
    const afterOne = h.counts.tests;
    step.click(); step.click();
    check(h.counts.tests === afterOne + 2, `Reduced motion: each Next test shows one more verdict (${afterOne} → ${h.counts.tests})`);
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!egg(), 'Reduced motion: Escape closes at once');
    restored('Reduced motion', before);
    setReduced(false);

    /* 7. An active lens is reset (and forgotten) before the portrait opens. */
    const lenses = await win.SiteLensesBoot.loadCore();
    await lenses.next({ pointerType: 'mouse', trigger: doc.querySelector('[data-lens-trigger]') });
    await until(() => !lenses.busy, 'the lens to settle', 15000);
    check(!!lenses.current, `A lens is active before the password (${lenses.current})`);
    type();
    await opened('the portrait to open over a lens', 15000);
    check(lenses.current === null && sessionStorage.getItem('lenses-active') === null,
      `The lens is reset and forgotten first (${lenses.current}, ${sessionStorage.getItem('lenses-active')})`);
    await painting();
    closeNow();
    check(!egg() && main.innerHTML === before.main, 'After the lens and the portrait the homepage markup is restored');

    /* 8. The dark theme: the figure takes the page's dark paper. */
    await load('/');
    doc.documentElement.setAttribute('data-theme', 'dark');
    await delay(800);   // past the theme's colour transition
    before = snapshot();
    type();
    await opened('the portrait to open in the dark theme');
    check(egg().classList.contains('is-dark'), 'The dark theme: the figure is dark');
    const paint8 = egg().querySelector('.portrait-paint');
    const corner = paint8.getContext('2d').getImageData(1, 1, 1, 1).data;
    check(corner[0] < 80 && corner[1] < 80 && corner[2] < 80, `The dark theme: the blank canvas is the dark paper (${[...corner].slice(0, 3)})`);
    closeNow();
    restored('Dark theme', before);
    doc.documentElement.removeAttribute('data-theme');

    /* 9. A page without the photo: the boot binds nothing for it. */
    await load('/publications.html', () => shellReady() && doc.readyState === 'complete');
    check(!doc.querySelector('[data-egg-trigger]') && typeof win.SiteLensesBoot.openPortrait === 'function',
      'The publications page has no photo trigger, but the boot exposes openPortrait');
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    if (storedLens === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens);
    if (storedGround === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedGround);
    if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme);
    if (storedSound === null) localStorage.removeItem('spira-sound'); else localStorage.setItem('spira-sound', storedSound);
  }
  /* 10. Frame timing over every dialog. */
  mergeStats();
  check(frameStats.frames > 0 && frameStats.avgMs < 8, `Frames take under 8 ms on average (${frameStats.avgMs} ms avg, ${frameStats.maxMs} ms max, ${frameStats.frames} frames)`);
  /* 11. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${errors.join(' | ')}`);
  return { assertions, failures, notes, frameStats, audioPeaks, errors };
})();
