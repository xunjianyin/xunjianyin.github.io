/* Run with agent-browser eval --stdin against a local static preview of the site.
 * Tests Print Gallery, the fifth egg (easter/gallery/): the photo's trigger (a single click does
 * nothing, a double-click or a double-tap opens it) and lazy loading, the levels (each label is
 * its print's date and commit message, the first version last), the live page under the camera
 * (the body's transform at the start and inside the first version's photo, the canvas's hole),
 * a whole journey that comes out on the live page with the page restored byte for byte, every
 * close path (Return's rush home, a second close, pagehide), the wheel and the keys, a hidden
 * tab, reduced motion (one print at a time), the sound (each arrival's note and the loop's
 * arpeggio, offline renders of the music box, M and the button), an active lens reset first, the dark theme, a resize, a page without the photo, frame timing
 * and errors. Resolves with assertions, failures, notes and frame timing.
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
  frame.style.cssText = 'position:fixed;inset:0;width:1280px;height:800px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const storedLens = sessionStorage.getItem('lenses-active'); const storedGround = sessionStorage.getItem('lenses-ground');
  const storedTheme = localStorage.getItem('theme'); const storedSound = localStorage.getItem('spira-sound');
  sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground'); localStorage.removeItem('spira-sound');
  const notes = []; const errors = []; const audioPeaks = {};
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
    const match = win.matchMedia.bind(win); queries = [];
    win.matchMedia = query => {
      const result = match(query);
      if (query === '(prefers-reduced-motion: reduce)') { Object.defineProperty(result, 'matches', { get: () => reduced }); queries.push(result); }
      return result;
    };
    const raf = win.requestAnimationFrame.bind(win); const cancel = win.cancelAnimationFrame.bind(win);
    pending.clear();
    win.requestAnimationFrame = callback => { const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    win.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
  };
  const setReduced = value => { reduced = value; queries.forEach(query => query.dispatchEvent(new win.Event('change'))); };
  const egg = () => doc.querySelector('#gallery');
  const hook = () => egg()?.gallery;
  const assets = () => doc.querySelectorAll('script[src*="easter/gallery/"],link[href*="easter/gallery/"]');
  const photo = () => doc.querySelector('.profile-photo[data-egg-trigger]');
  const statObjects = new Set();
  const opened = async (label, limit = 12000) => { await until(() => egg()?.open && hook(), label, limit); statObjects.add(hook().frameStats); };
  const mergeStats = () => {
    for (const stats of statObjects) {
      if (!stats.frames) continue;
      const frames = frameStats.frames + stats.frames;
      frameStats = { frames, avgMs: +((frameStats.avgMs * frameStats.frames + stats.avgMs * stats.frames) / frames).toFixed(2), maxMs: +Math.max(frameStats.maxMs, stats.maxMs).toFixed(2) };
    }
  };
  const attributes = el => [...el.attributes].map(a => `${a.name}=${a.value}`).join(' ');
  const snapshot = () => ({ html: attributes(doc.documentElement), body: attributes(doc.body), main: doc.querySelector('#main-content')?.innerHTML,
    scrollY: win.scrollY, focus: doc.activeElement, photo: photo() ? attributes(photo()) : null });
  const restored = (label, before, { frames = true } = {}) => {
    check(!egg(), `${label}: the dialog is removed`);
    check(win.SiteGallery.active === false, `${label}: SiteGallery.active is false`);
    const html = attributes(doc.documentElement); const body = attributes(doc.body);
    check(html === before.html && body === before.body, `${label}: html and body attributes restored byte for byte ("${html}" vs "${before.html}"; "${body}" vs "${before.body}")`);
    check(win.scrollY === before.scrollY, `${label}: scroll restored (${win.scrollY} of ${before.scrollY})`);
    check(doc.activeElement === before.focus, `${label}: focus restored (${doc.activeElement && doc.activeElement.tagName})`);
    check(doc.querySelector('#main-content')?.innerHTML === before.main, `${label}: page markup unchanged`);
    if (before.photo !== null) check(attributes(photo()) === before.photo, `${label}: the photo's attributes unchanged`);
    if (frames) check(pending.size === 0, `${label}: no pending animation frame`);
  };
  const mouse = (type, detail) => photo().dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, detail }));
  const doubleClick = () => { mouse('mousedown', 1); mouse('mouseup', 1); mouse('click', 1); mouse('mousedown', 2); mouse('mouseup', 2); mouse('click', 2); mouse('dblclick', 2); };
  const tap = (x, y) => { for (const type of ['pointerdown', 'pointerup']) photo().dispatchEvent(new win.PointerEvent(type, { pointerId: 41, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y })); };
  const openWith = async options => {
    if (!win.SiteGallery) {
      win.SiteLensesBoot.openGallery(photo());
      await opened('the boot to load and open the gallery');
      closeNow();
      await until(() => !egg(), 'the first opening to close');
    }
    const result = await win.SiteGallery.open(options);
    await opened('the gallery to open');
    return result;
  };
  const closeNow = () => { const h = hook(); if (h) { h.close(); h.close(); } };
  const key = (k, target = egg()) => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const settle = (ms = 250) => delay(ms);

  try {
    /* 1. The trigger and lazy loading. */
    await load('/');
    check(!!photo() && win.getComputedStyle(photo()).touchAction === 'manipulation', 'The homepage photo is the trigger, and a double-tap on it does not zoom');
    check(typeof win.SiteLensesBoot.openGallery === 'function' && /^gallery-v\d+$/.test(win.SiteLensesBoot.galleryVersion), `The boot exposes openGallery and galleryVersion (${win.SiteLensesBoot.galleryVersion})`);
    check(assets().length === 0 && !win.SiteGallery, 'Nothing of the gallery is loaded before the trigger');
    mouse('click', 1);
    await delay(400);
    check(!egg() && assets().length === 0, 'A single click on the photo opens and loads nothing');
    let before = snapshot();
    doubleClick();
    await opened('a double-click to open the gallery');
    check(assets().length === 2, `The double-click loads gallery.js and gallery.css once (${assets().length})`);
    check(!doc.querySelector('#spira') && !doc.querySelector('#murmur') && !doc.querySelector('#portrait') && !(win.SiteLenses && win.SiteLenses.current), 'The photo opens the gallery, not another egg or a lens');
    check(doc.activeElement === egg(), `The dialog takes the focus (${doc.activeElement && doc.activeElement.tagName})`);
    let h = hook();
    const manifest = await (await win.fetch(new win.URL('easter/gallery/prints/manifest.json', win.SiteLensesBoot.root).href)).json();
    const N = manifest.prints.length;
    check(h.levels === N && N >= 10, `The gallery has every print of the manifest (${h.levels} of ${N})`);
    check(h.label().date === 'Print Gallery', `At the start the label names the gallery (${h.label().date})`);
    await until(() => h.depth > 0.05, 'the camera to start its dive', 8000);
    check(h.live === 'page' && /scale\(/.test(doc.body.style.transform), `At the start the live page is under the camera (${h.live}, ${doc.body.style.transform})`);
    check(doc.querySelector('#main-content').innerHTML === before.main, 'While open, the page markup is unchanged');
    closeNow();
    restored('Double-click', before);

    /* 1b. A double-tap opens it too; two taps far apart do not. */
    const box = photo().getBoundingClientRect(); const px = box.left + box.width / 2; const py = box.top + box.height / 2;
    tap(px, py); await delay(500); tap(px, py);
    await delay(300);
    check(!egg(), 'Two taps 500 ms apart open nothing');
    before = snapshot();
    tap(px, py); await delay(120); tap(px + 3, py + 2);
    await opened('a double-tap to open the gallery');
    check(!!egg(), 'A double-tap opens the gallery');
    closeNow();
    restored('Double-tap', before);

    /* 2. The levels: labels from the manifest, the live page where it belongs, the canvas. */
    before = snapshot();
    await openWith({ auto: false });
    h = hook();
    const ctx = egg().querySelector('canvas').getContext('2d');
    const alphaAt = (x, y) => ctx.getImageData(Math.round(x * egg().querySelector('canvas').width), Math.round(y * egg().querySelector('canvas').height), 1, 1).data[3];
    h.setDepth(0.02); await settle();
    check(h.live === 'page' && alphaAt(0.1, 0.5) === 0, `Near the start the canvas is clear over the live page (${h.live}, alpha ${alphaAt(0.1, 0.5)})`);
    for (const j of [1, 2, Math.floor(N / 2), N]) {
      h.setDepth(j); await settle();
      const p = manifest.prints[j - 1];
      const label = h.label();
      check(label.message === p.message && label.date.startsWith(p.date), `Level ${j}: the label is its print's (${label.date} · ${label.message})`);
      check(h.live === null && alphaAt(0.5, 0.5) === 255, `Level ${j}: the canvas is opaque and the live page is away (${h.live})`);
    }
    check(/the first version/.test(h.label().date), `The deepest print is the first version (${h.label().date})`);
    h.setDepth(N + 0.6); await settle();
    const scale = /scale\(([\d.e-]+)\)/.exec(doc.body.style.transform);
    check(h.live === 'loop' && scale && +scale[1] < 1, `Inside the first version's photo the live page shows again, smaller (${h.live}, ${doc.body.style.transform})`);
    check(h.label().date === 'Today', `The loop's label (${h.label().date})`);
    h.setDepth(3.5); await settle();
    check(h.live === null, 'Between prints the live page is away');
    // The images: every small print arrives; large ones around the camera.
    await until(() => !h.loaded.includes('-'), 'every small print to load', 20000);
    check(/l/.test(h.loaded.slice(2, 6)), `Large prints load around the camera (${h.loaded})`);
    closeNow();
    restored('Levels', before);

    /* 3. A whole journey at a fixed speed comes out on the live page, restored. */
    before = snapshot();
    await openWith({ speed: 10 });
    h = hook();
    let deepest = 0;
    const began = performance.now();
    while (egg() && performance.now() - began < 30000) { deepest = Math.max(deepest, h.depth); await delay(30); }
    check(!egg(), 'The journey ends by itself');
    check(deepest > N, `It passed through every level into the loop (deepest ${deepest.toFixed(2)} of ${N + 1})`);
    const heard = h.notes();
    const levels = heard.filter(n => n !== 'today').map(Number);
    check(levels[0] === 1 && levels.length >= N / 2 && levels.every((j, i) => i === 0 || j > levels[i - 1]) && heard[heard.length - 1] === 'today',
      `Each arrival sounds its note, in order, and the loop closes on today's arpeggio (${heard.slice(0, 4).join(' ')} ... ${heard.slice(-3).join(' ')}; ${levels.length} of ${N})`);
    restored('Journey', before);
    notes.push(`journey at 10 levels/s: ${((performance.now() - began) / 1000).toFixed(1)} s for ${N} prints`);

    /* 4. Close paths. Return (Escape): a rush home to the present, then out. */
    before = snapshot();
    await openWith({ auto: false });
    hook().setDepth(6.3); await settle();
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    await until(() => !egg() || hook().depth < 3, 'the rush home to begin', 4000);
    check(!egg() || hook().depth < 6.3, 'Escape rushes back toward the present');
    await until(() => !egg(), 'the rush home to finish', 6000);
    restored('Escape', before);

    /* 4b. A second close during the rush closes at once. */
    before = snapshot();
    await openWith({ auto: false });
    hook().setDepth(4); await settle();
    hook().close(); hook().close();
    check(!egg(), 'A second close removes the dialog at once');
    restored('Second close', before);

    /* 4c. Return, hidden until intent. */
    before = snapshot();
    await openWith({ auto: false });
    hook().setDepth(2); await settle();
    const chrome = egg().querySelector('.gallery-chrome');
    check(!chrome.classList.contains('is-shown'), 'Return is hidden until intent');
    egg().dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, clientX: 1270, clientY: 790 }));
    check(chrome.classList.contains('is-shown'), 'The pointer in the bottom-right corner shows Return');
    [...chrome.querySelectorAll('button')].find(b => b.textContent.trim() === 'Return').click();
    await until(() => !egg(), 'Return to finish', 6000);
    restored('Return', before);

    /* 4d. pagehide closes at once. */
    before = snapshot();
    await openWith({ auto: false });
    hook().setDepth(3); await settle();
    win.dispatchEvent(new win.Event('pagehide'));
    check(!egg(), 'pagehide removes the dialog at once');
    restored('pagehide', before);

    /* 5. The wheel, the keys, a hidden tab, a resize. */
    await openWith({ auto: false });
    h = hook();
    h.setDepth(3); await settle();
    egg().dispatchEvent(new win.WheelEvent('wheel', { deltaY: 400, bubbles: true, cancelable: true }));
    await delay(300);
    check(h.depth > 3.05, `The wheel down dives (${h.depth.toFixed(3)})`);
    await delay(800);
    const afterDive = h.depth;
    egg().dispatchEvent(new win.WheelEvent('wheel', { deltaY: -800, bubbles: true, cancelable: true }));
    await delay(300);
    check(h.depth < afterDive, `The wheel up rises (${afterDive.toFixed(3)} -> ${h.depth.toFixed(3)})`);
    h.setDepth(5); await settle();
    key('ArrowDown');
    await until(() => Math.abs(h.depth - 6) < 1e-6, 'the down arrow to reach the next print', 4000);
    key('ArrowUp');
    await until(() => Math.abs(h.depth - 5) < 1e-6, 'the up arrow to return', 4000);
    check(true, 'The arrows move one print down and up');
    Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
    doc.dispatchEvent(new win.Event('visibilitychange'));
    await delay(100);
    check(pending.size === 0, 'A hidden tab stops the frames');
    delete doc.hidden;
    doc.dispatchEvent(new win.Event('visibilitychange'));
    await delay(100);
    check(pending.size > 0, 'A visible tab starts them again');
    frame.style.width = '1100px';
    await delay(300);
    check(!!egg() && egg().open, 'A resize between prints keeps the gallery open');
    frame.style.width = '1280px';
    await delay(200);
    closeNow();
    await openWith({ auto: false });
    hook().setDepth(0.4); await settle();
    frame.style.width = '1100px';
    await delay(300);
    check(!egg(), 'A resize while the live page is under the camera closes at once');
    frame.style.width = '1280px';
    await delay(300);

    /* 6. Reduced motion: one print at a time; no transform; Escape closes at once. */
    setReduced(true);
    before = snapshot();
    await openWith({});
    h = hook();
    check(h.still && h.depth === 1 && h.label().message === manifest.prints[0].message, `Reduced motion: the newest print, still (${h.depth}, ${h.label().message})`);
    check(!/scale\(/.test(doc.body.style.transform) || h.live === null, 'Reduced motion: the live page is not zoomed');
    const steps = egg().querySelectorAll('.gallery-step');
    check([...steps].every(b => win.getComputedStyle(b).display !== 'none') && egg().querySelector('.gallery-chrome').classList.contains('is-shown'), 'Reduced motion: Newer, Older and Return are shown');
    steps[1].click(); steps[1].click();
    check(h.depth === 3 && h.label().message === manifest.prints[2].message, `Reduced motion: Older steps one print at a time (${h.depth})`);
    steps[0].click();
    check(h.depth === 2, 'Reduced motion: Newer steps back');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!egg(), 'Reduced motion: Escape closes at once');
    restored('Reduced motion', before);
    setReduced(false);

    /* 7. Sound: offline renders; M and the button; the site's preference. */
    const render = async (seconds, play) => {
      const rate = 48000; const context = new win.OfflineAudioContext(2, Math.round(rate * seconds), rate);
      const audio = win.SiteGallery.createAudio(context, { fadeIn: false });
      play(audio);
      const scheduled = audio.scheduled; const buffer = await context.startRendering();
      let peak = 0;
      for (let c = 0; c < 2; c++) { const data = buffer.getChannelData(c); for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i])); }
      return { peak: +peak.toFixed(4), scheduled };
    };
    const renders = {
      tine: await render(2.5, a => a.tine(81, 1, 0.05)),
      yearDyad: await render(2.5, a => { a.tine(81, 1, 0.05); a.tine(69, 0.6, 0.05); }),
      today: await render(3, a => a.arpeggio([62, 66, 69, 74], 0.05))
    };
    for (const [name, result] of Object.entries(renders)) {
      audioPeaks[name] = result.peak;
      check(result.peak > 0.005 && result.peak < 0.9, `Offline ${name}: audible and unclipped (peak ${result.peak})`);
    }
    const silent = await render(0.5, a => { a.setEnabled(false); a.tine(81, 1, 0.05); a.arpeggio([62, 66], 0.1); });
    check(silent.scheduled === 0, 'With the sound off nothing is scheduled');
    await openWith({ auto: false });
    const soundButton = egg().querySelector('.gallery-sound');
    check(hook().sound && /Sound on/.test(soundButton.textContent), `The sound starts on (${soundButton.textContent})`);
    key('m');
    check(!hook().sound && localStorage.getItem('spira-sound') === 'off' && /Sound off/.test(soundButton.textContent), 'M switches the sound off and stores it');
    soundButton.click();
    check(hook().sound && localStorage.getItem('spira-sound') === 'on', 'The Sound button turns it back on');
    closeNow();

    /* 8. An active lens is reset (and forgotten) before the gallery opens. */
    const lenses = await win.SiteLensesBoot.loadCore();
    await lenses.next({ pointerType: 'mouse', trigger: doc.querySelector('[data-lens-trigger]') });
    await until(() => !lenses.busy, 'the lens to settle', 15000);
    check(!!lenses.current, `A lens is active before the double-click (${lenses.current})`);
    doubleClick();
    await opened('the gallery to open over a lens', 15000);
    check(lenses.current === null && sessionStorage.getItem('lenses-active') === null, `The lens is reset and forgotten first (${lenses.current})`);
    closeNow();
    await until(() => !egg(), 'the gallery to close');

    /* 9. The dark theme: a dark wall and label. */
    // A taller window than the prints' 16:10, so the wall shows above and below a print.
    frame.style.height = '900px';
    await load('/');
    doc.documentElement.setAttribute('data-theme', 'dark');
    await delay(800);
    before = snapshot();
    doubleClick();
    await opened('the gallery to open in the dark theme');
    check(egg().classList.contains('is-dark'), 'The dark theme: the gallery is dark');
    hook().setDepth(1); await settle();
    const wallCanvas = egg().querySelector('canvas');
    const wall = wallCanvas.getContext('2d').getImageData(Math.round(wallCanvas.width / 2), 2, 1, 1).data;
    check(wall[0] < 80 && wall[1] < 80 && wall[2] < 80, `The dark theme: the wall is the page's dark paper (${[...wall].slice(0, 3)})`);
    closeNow();
    restored('Dark theme', before);
    doc.documentElement.removeAttribute('data-theme');
    frame.style.height = '800px';

    /* 10. A page without the photo. */
    await load('/publications.html', () => shellReady() && doc.readyState === 'complete');
    check(!doc.querySelector('[data-egg-trigger]') && typeof win.SiteLensesBoot.openGallery === 'function', 'The publications page has no photo trigger, but the boot exposes openGallery');
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    if (storedLens === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens);
    if (storedGround === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedGround);
    if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme);
    if (storedSound === null) localStorage.removeItem('spira-sound'); else localStorage.setItem('spira-sound', storedSound);
  }
  /* 11. Frame timing over every dialog. */
  mergeStats();
  check(frameStats.frames > 0 && frameStats.avgMs < 8, `Frames take under 8 ms on average (${frameStats.avgMs} ms avg, ${frameStats.maxMs} ms max, ${frameStats.frames} frames)`);
  /* 12. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${errors.join(' | ')}`);
  return { assertions, failures, notes, frameStats, audioPeaks, errors };
})();
