/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * Tests the lenses (double-click the homepage name): the trigger by double-click and by a
 * synthetic double-tap, lazy loading, the cycle order and its queue, Esc, exact restoration
 * for every registered lens (light and dark theme, scrolled), links and the theme toggle
 * reachable inside each lens, reduced motion, the first egg opened from inside a lens, a lens
 * that fails to load, a lens that declines (supported() false), the digit keys, the caption,
 * the bell's peak, pagehide, a phone viewport, and frame budgets. The cycle is read from
 * SiteLenses._debug.lenses and it iterates the lens modules that exist, so a lens listed in the
 * core but not written yet is skipped. Prints assertions, failures, the lenses found, frame
 * timing and switch times.
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
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const stored = Object.fromEntries(['theme', 'lenses-seen', 'spira-sound'].map(key => [key, localStorage.getItem(key)]));
  ['lenses-seen', 'spira-sound'].forEach(key => localStorage.removeItem(key));
  localStorage.setItem('theme', 'light');
  const errors = []; const warnings = [];
  const report = { lenses: [], frameStats: {}, switchMs: {}, reducedSwitchMs: {}, audioPeak: 0 };
  let doc; let win; let reduced = false; let queries = [];
  const pending = new Set();

  const load = async (path = '/') => {
    sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');   // a remembered lens would arrive with the page
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.querySelector('.easter-egg-footnote') && doc.querySelector('#selected-papers-list li') && win.SiteLensesBoot, 'the site shell and the lens boot');
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
    const consoleWarn = win.console.warn.bind(win.console);
    win.console.warn = (...args) => { warnings.push(args.map(String).join(' ')); consoleWarn(...args); };
    // Reduced motion is simulated through matchMedia (the core reads it when it loads).
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
    // The page settles (late star counts) before anything is compared.
    let last = ''; let since = performance.now();
    await until(() => {
      const now = doc.querySelector('#main-content').innerHTML;
      if (now !== last) { last = now; since = performance.now(); }
      return performance.now() - since > 500;
    }, 'the page to settle', 8000);
  };
  const setReduced = value => { reduced = value; queries.forEach(query => query.dispatchEvent(new win.Event('change'))); };
  const nextPaint = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  const lenses = () => win.SiteLenses;
  const state = () => win.SiteLenses._debug.state;
  const idle = () => until(() => lenses() && !lenses().busy, 'the lenses to settle', 20000);
  const name = () => doc.querySelector('.profile-text .name');
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const assets = () => doc.querySelectorAll('script[src*="easter/lenses/core.js"],link[href*="easter/lenses/core.css"]');

  // A real double-click sequence on the name; returns whether the second mousedown was prevented.
  const dblclick = () => {
    const at = centre(name()); let prevented = false;
    for (const detail of [1, 2]) {
      const down = new win.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail, button: 0 });
      name().dispatchEvent(down); if (detail === 2) prevented = down.defaultPrevented;
      name().dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail, button: 0 }));
      name().dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail, button: 0 }));
    }
    name().dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail: 2, button: 0 }));
    return prevented;
  };
  // Two touch taps on the name, `gap` ms apart, the second `shift` px away.
  const tap = (x, y) => {
    for (const type of ['pointerdown', 'pointerup']) {
      name().dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0 }));
    }
  };
  const doubleTap = async (gap = 80, shift = 0) => { const at = centre(name()); tap(at.x, at.y); await delay(gap); tap(at.x + shift, at.y); };
  const escape = () => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  // Everything a lens could leave behind.
  const snapshot = () => ({
    main: doc.querySelector('#main-content').innerHTML,
    nav: doc.querySelector('#site-nav').innerHTML,
    footer: doc.querySelector('#site-footer').innerHTML,
    htmlClass: doc.documentElement.getAttribute('class'), htmlStyle: doc.documentElement.getAttribute('style'),
    theme: doc.documentElement.dataset.theme,
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children], headKids: [...doc.head.children],
    sheets: doc.styleSheets.length, adopted: doc.adoptedStyleSheets.length, fonts: doc.fonts.size,
    scroll: win.scrollY, focus: doc.activeElement
  });
  // The first difference between two strings, in context, for failure messages.
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return `at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const tags = root => [...root.querySelectorAll('*')].map(el => el.tagName).join(',');
  // `loose`: an empty class or style attribute counts as none (the first egg leaves them).
  const restored = (before, label, loose = false) => {
    const now = snapshot();
    if (loose) for (const key of ['htmlClass', 'htmlStyle']) { if (now[key] === '') now[key] = null; if (before[key] === '') before[key] = null; }
    if (loose) { now.bodyAttrs = now.bodyAttrs.replace(/(^|\|)(style|class)=(?=\||$)/g, ''); before.bodyAttrs = before.bodyAttrs.replace(/(^|\|)(style|class)=(?=\||$)/g, ''); }
    check(now.main === before.main, `${label}: #main-content markup is byte-identical (${firstDiff(before.main, now.main)})`);
    check(now.nav === before.nav && now.footer === before.footer, `${label}: nav and footer markup are byte-identical (${firstDiff(before.nav, now.nav)}${firstDiff(before.footer, now.footer)})`);
    check(now.htmlClass === before.htmlClass && now.htmlStyle === before.htmlStyle, `${label}: <html> class and style restored (class ${JSON.stringify(now.htmlClass)}, style ${JSON.stringify(now.htmlStyle)})`);
    check(now.theme === before.theme, `${label}: theme unchanged`);
    check(now.bodyAttrs === before.bodyAttrs, `${label}: <body> attributes restored (${now.bodyAttrs})`);
    const extra = list => list.filter(el => !before[list === now.bodyKids ? 'bodyKids' : 'headKids'].includes(el)).map(el => el.outerHTML.slice(0, 80));
    check(now.bodyKids.length === before.bodyKids.length && now.bodyKids.every((el, i) => el === before.bodyKids[i]), `${label}: no node left in <body> (${extra(now.bodyKids).join(' ; ')})`);
    check(now.headKids.length === before.headKids.length && now.headKids.every((el, i) => el === before.headKids[i]), `${label}: no <style>, <link> or <script> left in <head> (${extra(now.headKids).join(' ; ')})`);
    check(now.sheets === before.sheets && now.adopted === before.adopted, `${label}: stylesheets restored (${now.sheets} vs ${before.sheets})`);
    check(now.fonts === before.fonts, `${label}: document.fonts restored (${now.fonts} vs ${before.fonts})`);
    check(Math.abs(now.scroll - before.scroll) < 1, `${label}: scroll position unchanged (${now.scroll} vs ${before.scroll})`);
    check(now.focus === before.focus, `${label}: focus unchanged`);
    check(!state().glyphs && state().layers === 0 && !state().caption && state().frames === 0, `${label}: core state is clean`);
  };
  // Links and the theme toggle are hit-testable at their centres while a lens is active.
  const reachable = label => {
    const targets = [doc.querySelector('#main-content .bio a[href]'), doc.querySelector('#site-nav .nav-button:not([aria-current])'), doc.querySelector('#main-content .profile-links a[href]')];
    for (const link of targets) {
      const at = centre(link);
      const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === link, `${label}: the link "${link.textContent.trim()}" is clickable (hit ${hit && hit.tagName}.${hit && hit.className})`);
    }
    const toggle = doc.querySelector('#theme-toggle'); const at = centre(toggle);
    const hit = doc.elementFromPoint(at.x, at.y);
    check(hit && hit.closest('#theme-toggle') === toggle, `${label}: the theme toggle is clickable`);
    const link = targets[0]; link.focus();
    check(doc.activeElement === link, `${label}: keyboard focus reaches a link`);
    link.blur();
  };
  // A gentle pointer sweep and a scroll, so interaction frames are measured.
  const interact = async () => {
    for (let k = 0; k <= 20; k++) {
      doc.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 300 + k * 30, clientY: 180 + k * 12 }));
      await delay(30);
    }
    win.scrollTo({ top: 240, behavior: 'instant' }); await delay(250);
    win.scrollTo({ top: 0, behavior: 'instant' }); await delay(250);
  };
  const statsDelta = (id, before) => {
    const s = state().frameStats[id]; const b = before[id];
    if (!s) return null;
    if (!b) return s;
    const frames = s.frames - b.frames;
    return frames > 0 ? { frames, avgMs: +((s.avgMs * s.frames - b.avgMs * b.frames) / frames).toFixed(3), maxMs: s.maxMs } : null;
  };

  try {
    /* 1. Lazy loading: nothing before the trigger; the double-click loads the core once. */
    await load('/');
    check(assets().length === 0 && !win.SiteLenses, 'No lens assets load before the first trigger');
    check(win.getComputedStyle(name()).touchAction === 'manipulation', 'The name does not zoom on a double-tap (touch-action: manipulation)');
    const prevented = dblclick();
    check(prevented, 'A double-click on the name does not select its text');
    await until(() => win.SiteLenses, 'the core to load');
    const version = win.SiteLensesBoot.version;
    check(assets().length === 2 && [...assets()].every(a => (a.src || a.href).includes(`v=${version}`)) && lenses()._debug.version === version,
      `The core script and stylesheet load once, versioned ${version} like the boot`);
    check(!!win.__lensesAudioContext || state().audio !== null || localStorage.getItem('spira-sound') === 'off', 'The trigger primes an AudioContext inside the gesture');
    await idle();
    const registered = await lenses()._debug.loadAll();
    report.lenses = registered;
    const manifest = lenses()._debug.lenses;
    check(manifest.length > 0 && manifest.length <= 9 && new Set(manifest).size === manifest.length && manifest.every(id => /^[a-z]{2,20}$/.test(id)),
      `The cycle lists at most nine distinct lens ids (${manifest.join(', ')})`);
    check(registered.length > 0, `At least one lens module exists (found ${registered.join(', ')})`);
    check(JSON.stringify(registered) === JSON.stringify(manifest.filter(id => registered.includes(id))), 'The lenses found keep the cycle order');
    for (const id of registered) {
      const lens = lenses()._debug.lens(id);
      check(lens.order === manifest.indexOf(id) + 1 && typeof lens.numeral === 'string' && lens.label && lens.line, `Lens ${id}: order, numeral, label and line match the cycle`);
      check(lens.ground === null || /^#[0-9a-f]{6}$/i.test(lens.ground), `Lens ${id}: ground is null or #rrggbb (${lens.ground})`);
    }
    const first = registered[0];
    check(lenses().current === first, `The first double-click enters the first lens (${lenses().current})`);
    const firstCaption = state().caption;
    check(firstCaption && firstCaption[0].startsWith(`${lenses()._debug.lens(first).numeral} · ${lenses()._debug.lens(first).label} — `), `The caption reads "numeral · label — line" (${firstCaption && firstCaption[0]})`);
    check(firstCaption && firstCaption[firstCaption.length - 1].startsWith('Double-click the name for the next lens'), 'The first caption ever adds the double-click hint');
    const captionEl = doc.querySelector('.lenses-caption');
    if (captionEl) {
      const box = captionEl.getBoundingClientRect(); const nameBox = name().getBoundingClientRect();
      check(win.getComputedStyle(captionEl).pointerEvents === 'none' && win.getComputedStyle(captionEl).position === 'absolute', 'The caption takes no pointer and scrolls with the page');
      check(Math.abs(box.top - nameBox.top) < 90 && box.left >= nameBox.left - 1 && box.right <= nameBox.right + 1, 'The caption sits by the name, inside its column');
    }
    escape(); await idle();
    check(lenses().current === null && !doc.querySelector('.lenses-caption'), 'Esc returns to normal, with no caption');

    // The baseline for every restoration check (the core's own assets are in place now).
    const main = doc.querySelector('#main-content');
    const base = snapshot();

    /* 2. The cycle: each double-click moves on, after the last lens the page is normal. */
    const seen = [];
    for (let k = 0; k <= registered.length; k++) {
      const began = performance.now();
      dblclick(); await idle();
      seen.push(lenses().current);
      if (lenses().current) report.switchMs[lenses().current] = Math.round(performance.now() - began);
      if (k === 1 && lenses().current) check(state().caption && !state().caption.some(line => line.startsWith('Double-click the name')), 'Later captions drop the hint');
    }
    check(JSON.stringify(seen) === JSON.stringify([...registered, null]), `The cycle runs ${[...registered, 'normal'].join(' > ')} (saw ${seen.map(id => id || 'normal').join(' > ')})`);
    restored(base, 'After a full cycle');

    /* 3. Synthetic double-tap: two taps within 320 ms and 24 px; slow or far taps do not count. */
    await doubleTap(80, 6); await idle();
    check(lenses().current === first, 'A double-tap enters the first lens');
    await delay(400); await doubleTap(450, 0); await delay(50); await idle();
    check(lenses().current === first, 'Two taps 450 ms apart are not a double-tap');
    await delay(400); await doubleTap(80, 40); await delay(50); await idle();
    check(lenses().current === first, 'Two taps 40 px apart are not a double-tap');
    await delay(400);
    const at = centre(name());
    tap(at.x, at.y); await delay(60); tap(at.x, at.y);
    name().dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail: 2 }));
    await idle();
    check(lenses().current === (registered[1] || null), 'A double-tap followed by its synthesized dblclick advances once');
    await lenses().reset(); await idle();

    /* 4. Queue: triggers during a transition queue at most one step. */
    await delay(750);   // past the guard that ignores a dblclick synthesized from a double-tap
    dblclick(); dblclick(); dblclick(); dblclick();
    await idle();
    check(lenses().current === (registered[1] || null), `Four quick triggers advance two steps (at ${lenses().current})`);
    await lenses().reset();

    /* 4b. Digit keys: 1-9 jump to that place in the cycle while a lens is active, 0 returns;
     * nothing on a normal page, in a text field, or with a modifier. */
    {
      const key = (k, target = doc.body, extra = {}) => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
      const settle = async () => { await delay(60); await idle(); };
      await idle();
      key('1'); await settle();
      check(lenses().current === null && !state().busy, 'A digit on a normal page does nothing');
      await lenses()._debug.goto(first);
      const second = manifest[1];
      const target = registered.includes(second) ? second : first;
      key('2'); await settle();
      check(lenses().current === target, `Key 2 jumps to the second lens of the cycle, ${second} (at ${lenses().current})`);
      if (target !== first) {
        check(state().caption && state().caption[0].startsWith(`${lenses()._debug.lens(second).numeral} · `), `The jump to ${second} shows its caption`);
      }
      const input = doc.createElement('input');
      doc.body.append(input); input.focus();
      key('1', input); await settle();
      check(lenses().current === target, 'A digit typed in a text field does not jump');
      input.remove();
      key('1', doc.body, { ctrlKey: true }); key('1', doc.body, { altKey: true }); await settle();
      check(lenses().current === target, 'A digit with a modifier does not jump');
      const missing = manifest.findIndex(id => !registered.includes(id));
      if (missing >= 0) {
        key(String(missing + 1)); await delay(200); await idle();
        check(lenses().current === target, `A digit for a lens that is not there (${manifest[missing]}) changes nothing`);
      }
      key('0'); await settle();
      check(lenses().current === null && sessionStorage.getItem('lenses-active') === null, 'Key 0 returns to normal and forgets the lens');
    }

    /* 4c. A lens whose supported() returns false (or throws) is skipped silently. */
    if (registered.length >= 3) {
      const declining = lenses()._debug.lens(registered[1]);
      const warned = warnings.length;
      for (const [how, supported] of [['returns false', () => false], ['throws', () => { throw new Error('declined'); }]]) {
        declining.supported = supported;
        await lenses()._debug.goto(first);
        await delay(750); dblclick(); await idle();
        check(lenses().current === registered[2], `A lens whose supported() ${how} is skipped (at ${lenses().current})`);
        await lenses().reset();
      }
      delete declining.supported;
      check(!state().failed.includes(registered[1]) && warnings.length === warned, 'A declining lens is not warned about or counted as failed');
    }

    /* 5. Every lens: enter, links reachable, interaction, exit restores everything (light, scrolled). */
    for (const id of registered) {
      for (const theme of ['light', 'dark']) {
        doc.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme);
        win.scrollTo({ top: theme === 'dark' ? 0 : 160, behavior: 'instant' });
        await delay(50);
        const before = snapshot();
        const textBefore = main.textContent; const tagsBefore = tags(main);
        const stats = JSON.parse(JSON.stringify(state().frameStats));
        await lenses()._debug.goto(id);
        check(lenses().current === id, `${id} (${theme}): enters`);
        check(Math.abs(win.scrollY - before.scroll) < 1, `${id} (${theme}): entering keeps the scroll position`);
        check(main.textContent === textBefore && tags(main) === tagsBefore, `${id} (${theme}): the text and elements of #main-content are unchanged while active`);
        if (theme === 'light') { win.scrollTo({ top: 0, behavior: 'instant' }); await delay(120); reachable(`${id}`); }
        await interact();
        if (theme === 'light') { const s = statsDelta(id, stats); if (s) report.frameStats[id] = s; }
        if (theme === 'light') win.scrollTo({ top: before.scroll, behavior: 'instant' });
        await delay(60);
        const beforeExit = { ...before, scroll: win.scrollY };
        await lenses().reset(); await idle(); await nextPaint(); await nextPaint();
        restored(beforeExit, `${id} (${theme}) after exit`);
        check(pending.size === 0, `${id} (${theme}): no animation frame is pending after exit`);
      }
      doc.documentElement.dataset.theme = 'light'; localStorage.setItem('theme', 'light');
    }
    for (const [id, s] of Object.entries(report.frameStats)) {
      check(s.avgMs <= 6, `${id}: frame callbacks average ${s.avgMs} ms (budget 6 ms)`);
    }

    /* 6. Esc and instant reset in the middle of an entering transition restore everything. */
    for (const id of registered) {
      const before = snapshot();
      lenses()._debug.goto(id);
      await until(() => state().phase === 'entering', `${id} to start entering`, 8000);
      await delay(120);
      escape(); await idle(); await nextPaint();
      restored(before, `${id}: Esc while entering`);
      lenses()._debug.goto(id);
      await until(() => state().phase === 'entering', `${id} to start entering again`, 8000);
      await delay(60);
      const began = performance.now();
      await lenses().reset({ instant: true });
      check(performance.now() - began < 900, `${id}: an instant reset while entering finishes within 0.9 s (${Math.round(performance.now() - began)} ms)`);
      await nextPaint();
      restored(before, `${id}: instant reset while entering`);
    }

    /* 7. Reduced motion: instant switches, no animation left running. */
    setReduced(true);
    for (const id of registered) {
      await lenses()._debug.goto(id);   // a first visit may load assets; the second is measured
      await lenses().reset();
      const before = snapshot();
      const began = performance.now();
      await lenses()._debug.goto(id);
      const took = Math.round(performance.now() - began);
      report.reducedSwitchMs[id] = took;
      check(took < 400, `${id}: reduced motion enters at once (${took} ms)`);
      const caption = doc.querySelector('.lenses-caption');
      check(!caption || win.getComputedStyle(caption).transitionDuration === '0s', `${id}: reduced motion: the caption does not fade`);
      await nextPaint(); await nextPaint(); await nextPaint();
      check(pending.size === 0 && !state().raf, `${id}: reduced motion: no animation loop while the lens rests`);
      const leaving = performance.now();
      await lenses().reset();
      check(performance.now() - leaving < 300, `${id}: reduced motion leaves at once (${Math.round(performance.now() - leaving)} ms)`);
      restored(before, `${id}: reduced motion`);
    }
    setReduced(false);

    /* 8. The first egg opens cleanly from inside a lens, and the lenses work after it. */
    {
      const before = snapshot();
      await lenses()._debug.goto(registered[registered.length - 1]);
      doc.querySelector('.easter-egg-footnote').click();
      await until(() => doc.querySelector('#spira')?.open, 'the first egg to open from a lens', 20000);
      check(lenses().current === null && !state().glyphs && state().layers === 0, 'Opening the first egg resets the lens first');
      check(!doc.querySelector('.lenses-layer, .lenses-caption') && !/(^| )lens-/.test(doc.documentElement.className), 'No lens layer, caption or class remains under the egg');
      check(doc.querySelector('#spira').spira.wordCount > 40, 'The egg captures the normal page');
      doc.querySelector('#spira').dispatchEvent(new win.Event('cancel', { cancelable: true }));
      await until(() => !doc.querySelector('#spira'), 'the egg to close', 10000);
      await delay(100);
      restored({ ...before, headKids: [...doc.head.children], sheets: doc.styleSheets.length, fonts: doc.fonts.size }, 'After the egg from a lens', true);
      dblclick(); await idle();
      check(lenses().current === first, 'After the egg, the next double-click starts the cycle again');
      await lenses().reset();
    }

    /* 9. pagehide resets at once. */
    await lenses()._debug.goto(first);
    win.dispatchEvent(new win.PageTransitionEvent('pagehide', { persisted: false }));
    await idle();
    check(lenses().current === null && !state().glyphs, 'pagehide returns to normal');

    /* 10. The theme toggle still works after the lenses. */
    const toggle = doc.querySelector('#theme-toggle');
    toggle.click(); const flipped = doc.documentElement.dataset.theme; toggle.click();
    check(flipped === 'dark' && doc.documentElement.dataset.theme === 'light', 'The theme toggle works after exit');

    /* 11. The bell: offline renders of every step stay quiet and unclipped. */
    let peak = 0;
    for (let k = 0; k < 10; k++) {
      const context = new win.OfflineAudioContext(1, 48000 * 3, 48000);
      lenses()._debug.ringBell(context, context.destination, k, 0.01);
      const data = (await context.startRendering()).getChannelData(0);
      for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; }
    }
    report.audioPeak = +peak.toFixed(4);
    check(peak > 0.02 && peak <= 0.2, `The bell is audible and soft (peak ${peak.toFixed(3)} <= 0.2)`);

    /* 12. A lens that fails to load is skipped with one warning; sound off primes nothing. */
    localStorage.setItem('spira-sound', 'off');
    await load('/');
    const append = doc.head.append.bind(doc.head);
    doc.head.append = (...nodes) => {
      const script = nodes.find(node => node.tagName === 'SCRIPT' && node.src.includes(`easter/lenses/${first}.js`));
      if (script) { setTimeout(() => script.onerror(new win.Event('error')), 0); return; }
      append(...nodes);
    };
    const warned = warnings.length;
    dblclick();
    await until(() => win.SiteLenses, 'the core after a reload');
    await idle();
    check(state().failed.includes(first) && lenses().current === (registered[1] || null), `A lens that fails to load is skipped (at ${lenses().current})`);
    check(warnings.slice(warned).filter(w => w.includes(`"${first}"`)).length === 1, 'The failure is warned about once');
    check(!win.__lensesAudioContext && state().audio === null, 'With the sound off no AudioContext is created');
    doc.head.append = append;
    await lenses().reset();

    /* 12b. The last key wins: on this fresh page a digit for a lens whose module has not loaded
     * yet, then 0 in the same task, ends normal (the late module does not bring the lens). */
    {
      const unloaded = registered.filter(id => id !== first && !state().registered.includes(id));
      const far = unloaded[unloaded.length - 1];
      if (far && registered[1]) {
        const key = k => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
        await lenses()._debug.goto(registered[1]);
        key(String(manifest.indexOf(far) + 1)); key('0');
        await until(() => state().registered.includes(far) || state().failed.includes(far), `the ${far} module to load`);
        await delay(100); await idle(); await delay(100); await idle();
        check(lenses().current === null && sessionStorage.getItem('lenses-active') === null,
          `A digit for ${far} (not loaded yet) followed by 0 ends normal (at ${lenses().current})`);
      }
      report.raceLens = far || null;
    }
    localStorage.removeItem('spira-sound');

    /* 13. Phone: the double-tap cycles every lens without horizontal overflow, and restores. */
    frame.style.width = '390px'; frame.style.height = '844px';
    await load('/');
    await doubleTap(80, 0);
    await until(() => win.SiteLenses, 'the core on a phone');
    await idle();
    await lenses().reset();
    const phoneBase = snapshot();
    for (const id of registered) {
      await doubleTap(80, 0); await idle();
      const width = doc.documentElement.scrollWidth;
      check(lenses().current === id && width <= 391, `390x844: ${id} enters without horizontal overflow (scrollWidth ${width})`);
      const caption = doc.querySelector('.lenses-caption');
      if (caption) {
        const box = caption.getBoundingClientRect();
        check(box.left >= 0 && box.right <= 390, `390x844: the ${id} caption fits the screen`);
      }
    }
    await doubleTap(80, 0); await idle(); await nextPaint();
    check(lenses().current === null, '390x844: the last double-tap returns to normal');
    restored(phoneBase, '390x844 after the cycle');
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
  }
  /* 14. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${errors.join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
