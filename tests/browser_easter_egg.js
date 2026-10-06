/* Run with agent-browser eval --stdin against a local static preview of the site.
 * Tests the spira easter egg: lazy loading, capture without DOM mutation, the phase
 * sequence, skip, the dawn close and restoration on every exit path, the chart, sound
 * (offline renders with measured peaks, cue order, the toggle), shooting stars and wishes,
 * the instrument, reduced motion, resize, nested routes and load failure. Prints
 * assertions, failures, frame timing and the measured audio peaks.
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
  const storedTheme = localStorage.getItem('theme');
  // Sound and caught wishes persist in localStorage; the suite starts clean and restores them.
  const storedSound = localStorage.getItem('spira-sound'); const storedWishes = localStorage.getItem('spira-wishes');
  localStorage.removeItem('spira-sound'); localStorage.removeItem('spira-wishes');
  const audioPeaks = {};
  const errors = [];
  const frameStats = {};
  let doc; let win;
  let reduced = false; let queries = [];
  const pending = new Set();
  const load = async (path = '/') => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
    doc = frame.contentDocument; win = frame.contentWindow;
    await until(() => doc.querySelector('.easter-egg-footnote'), 'the site shell');
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
    // Track pending animation frames.
    const raf = win.requestAnimationFrame.bind(win); const cancel = win.cancelAnimationFrame.bind(win);
    pending.clear();
    win.requestAnimationFrame = callback => { const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    win.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
  };
  const setReduced = value => { reduced = value; queries.forEach(query => query.dispatchEvent(new win.Event('change'))); };
  const type = (text = 'yxjgogogo', target = doc.body, extra = {}) => {
    for (const key of text) target.dispatchEvent(new win.KeyboardEvent('keydown', {
      key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...extra
    }));
  };
  const egg = () => doc.querySelector('#spira');
  const phase = () => egg()?.spira?.phase;
  const assets = () => doc.querySelectorAll('script[src*="easter-egg.js"],link[href*="easter-egg.css"]');
  const nextPaint = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  const openFast = async (scale = 4) => { win.SiteEasterEgg.open({ timeScale: scale }); await until(() => egg()?.open, 'the dialog'); };
  const dismiss = async () => { keepStats(); egg().dispatchEvent(new win.Event('cancel', { cancelable: true })); await until(() => !egg(), 'the dialog to close'); };
  // Each dialog's frameStats object stays live until it closes, so closing frames count too.
  const statObjects = new Set();
  const keepStats = () => { const stats = egg()?.spira?.frameStats; if (stats) statObjects.add(stats); };
  const mergeStats = () => {
    for (const stats of statObjects) {
      for (const [name, entry] of Object.entries(stats.byPhase)) {
        if (!entry.frames) continue;
        const kept = frameStats[name] || { frames: 0, avgMs: 0, maxMs: 0 };
        const frames = kept.frames + entry.frames;
        frameStats[name] = { frames, avgMs: +((kept.avgMs * kept.frames + entry.avgMs * entry.frames) / frames).toFixed(2), maxMs: +Math.max(kept.maxMs, entry.maxMs).toFixed(2) };
      }
    }
  };
  const normalise = text => text.replace(/\s+/g, ' ').trim();

  try {
    /* 1. Cold password trigger: assets load once, with the spira version. */
    await load('/');
    check(assets().length === 0, 'No egg assets load before discovery');
    type('yxjgogo'); check(assets().length === 0, 'A partial password does not download assets'); type('x');
    for (const tag of ['input', 'textarea', 'div']) {
      const control = doc.createElement(tag); if (tag === 'div') control.contentEditable = 'true';
      doc.body.append(control); type('yxjgogogo', control); control.remove();
    }
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }]) type('yxjgogogo', doc.body, extra);
    check(assets().length === 0, 'Editable fields, repeated keys and modifier shortcuts are ignored');

    /* The key sentence of the bio is found among the captured words (top of '/'). */
    win.scrollTo({ top: 0, behavior: 'instant' });
    type();
    await until(() => egg()?.open, 'the password to open the egg');
    check(assets().length === 2, 'The full password loads the script and stylesheet once');
    check([...assets()].every(asset => (asset.src || asset.href).includes('v=spira-v6')), 'Asset URLs carry v=spira-v6');
    check(egg().spira.keyCount === 24, `The key sentence is found in full (${egg().spira.keyCount} of 24 tokens)`);
    await dismiss();

    const main = doc.querySelector('#main-content');
    const focus = doc.querySelector('#theme-toggle'); focus.focus();
    doc.documentElement.dataset.theme = 'dark'; localStorage.setItem('theme', 'dark');
    doc.body.style.setProperty('overflow', 'auto', 'important');
    win.scrollTo({ top: 410, behavior: 'instant' });
    const before = { html: main.innerHTML, scroll: win.scrollY };
    const walker = doc.createTreeWalker(main, win.NodeFilter.SHOW_TEXT); const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const identitiesIntact = () => textNodes.every(node => node.isConnected && main.contains(node));
    const restored = label => {
      check(!egg() && !doc.documentElement.classList.contains('spira-hide-text'), `${label}: dialog and class removed`);
      check(doc.body.style.getPropertyValue('overflow') === 'auto' && doc.body.style.getPropertyPriority('overflow') === 'important', `${label}: body overflow value and priority restored`);
      check(win.scrollY === before.scroll, `${label}: scroll restored`);
      check(doc.activeElement === focus, `${label}: focus restored`);
      check(doc.documentElement.dataset.theme === 'dark' && localStorage.getItem('theme') === 'dark', `${label}: site theme unchanged`);
      check(main.innerHTML === before.html && identitiesIntact(), `${label}: page markup and text nodes unchanged`);
      check(!doc.documentElement.style.getPropertyValue('scrollbar-gutter'), `${label}: the scrollbar gutter style is restored`);
      check(pending.size === 0, `${label}: no pending animation frame`);
    };

    win.SiteEasterEgg.open();
    await until(() => egg()?.open, 'the egg to reopen');
    check(assets().length === 2, 'Reopening does not load the assets again');
    check(egg().matches(':modal'), 'The egg is a native modal dialog');

    /* 2. Capture: words from the real page, glyphs hidden by one class, DOM untouched. */
    check(egg().spira.wordCount > 40, `Capture finds more than 40 visible words (found ${egg().spira.wordCount})`);
    check(doc.documentElement.classList.contains('spira-hide-text'), '<html> carries spira-hide-text while open');
    check(main.innerHTML === before.html, '#main-content markup is byte-identical while open');
    check(identitiesIntact(), 'Original text nodes stay connected in place');
    check(egg().contains(doc.activeElement) && doc.activeElement.matches('[data-skip]'), 'Focus starts on Skip');
    const canvas = egg().querySelector('.spira-canvas');
    check(canvas.width * canvas.height <= 8.3e6 + 1, 'The canvas backing store stays within 8.3 megapixels');
    keepStats();
    await dismiss();
    restored('Early Escape');

    /* The footnote also opens the egg; repeated triggers do not stack dialogs. */
    doc.querySelector('.easter-egg-footnote').click();
    await until(() => egg()?.open, 'the footnote to open the egg');
    win.SiteEasterEgg.open();
    check(doc.querySelectorAll('#spira').length === 1, 'Repeated triggers cannot stack dialogs');
    check(assets().length === 2, 'Reopening reuses the loaded assets');
    keepStats();
    await dismiss();

    /* 3. Phases in order; the chart UI is inert until the chart. */
    await openFast(6);
    const inertBlocks = () => ['.spira-plate', '.spira-themes', '.spira-actions'].map(selector => egg().querySelector(selector));
    check(inertBlocks().every(el => el.inert), 'Plate, themes and actions are inert during the opening');
    const seen = [phase()];
    await until(() => { const now = phase(); if (now && now !== seen[seen.length - 1]) seen.push(now); return now === 'chart'; }, 'the chart phase', 15000);
    check(JSON.stringify(seen) === JSON.stringify(['dusk', 'gather', 'wind', 'ignite', 'chart']), `Phases run dusk > gather > wind > ignite > chart (saw ${seen.join(' > ')})`);
    // Sound cues follow the timeline: in order, each fired at its own timeline time (at 6x).
    const cues = egg().spira.audioCues;
    const order = cues.map(c => c.cue).filter((name, i, all) => name !== all[i - 1]);
    check(JSON.stringify(order) === JSON.stringify(['dusk', 'gather', 'glint', 'wind', 'hush', 'inhale', 'ignite', 'paper', 'ghost', 'ambient']),
      `Opening cues fire in order (saw ${order.join(' > ')})`);
    check(cues.filter(c => c.cue === 'paper').length === 29 && cues.filter(c => c.cue === 'gather').length > 10, 'Each of the 29 papers rings once; the gather plucks a cascade');
    const cueAt = name => cues.find(c => c.cue === name);
    const igniteGap = (cueAt('ignite').at - cueAt('dusk').at) * 6 / 1000;
    check(Math.abs(cueAt('ignite').t - 8.6) < 0.05 && Math.abs(igniteGap - 8.6) < 0.9, `The ignition cue fires at timeline 8.6 s, ${igniteGap.toFixed(2)} s at 6x`);
    check(inertBlocks().every(el => !el.inert), 'Plate, themes and actions are interactive in the chart');
    check(egg().querySelector('.spira-opening').hidden, 'Opening controls are removed from the chart');
    await delay(300);
    const chartActions = egg().querySelector('.spira-actions');
    const actionsShown = () => win.getComputedStyle(chartActions).pointerEvents === 'auto';
    check(!actionsShown() && Number(win.getComputedStyle(chartActions).opacity) === 0 && doc.activeElement === egg().querySelector('.spira-stage'),
      'In the chart the actions are hidden (opacity 0, no pointer events) and the stage has focus');
    keepStats();

    /* 6. The chart: index, themes and star selection. */
    const links = [...egg().querySelectorAll('.spira-index-link')];
    const slugs = links.map(a => new URL(a.href).pathname.split('/').pop().replace('.html', ''));
    check(links.length === 29 && new Set(slugs).size === 29, 'The index lists 29 distinct papers');
    const metadata = await (await fetch('/papers/content/metadata.json')).json();
    check(JSON.stringify([...slugs].sort()) === JSON.stringify(Object.keys(metadata).sort()), 'The index covers the complete local paper corpus');
    const takeawaysMatch = [];
    const pages = await Promise.all(links.map(async a => {
      const response = await fetch(a.href);
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const slug = new URL(a.href).pathname.split('/').pop().replace('.html', '');
      takeawaysMatch.push(normalise(page.querySelector('.paper-takeaway')?.textContent || '') === normalise(win.SiteEasterEgg.takeaways[slug] || '-'));
      return response.status === 200 && normalise(page.querySelector('h1')?.textContent || '') === normalise(a.title);
    }));
    check(pages.every(Boolean), 'Every index link returns 200 and its title matches the paper page');
    check(takeawaysMatch.length === 29 && takeawaysMatch.every(Boolean), 'The takeaway snapshot matches the takeaway on every paper page');
    check(links.every(a => new URL(a.href).pathname.startsWith('/papers/')), 'Index links resolve under /papers/');
    const themes = [...egg().querySelectorAll('.spira-theme')];
    check(themes.length === 5, 'Five theme buttons');
    themes[4].click();
    check(themes[4].getAttribute('aria-pressed') === 'true' && themes.filter(b => b.getAttribute('aria-pressed') === 'true').length === 1, 'A theme button is pressed alone');
    check(egg().querySelector('.spira-plate').textContent.includes('Can experience change the learner?'), 'The plate shows the theme question');
    themes[1].click();
    check(themes[1].getAttribute('aria-pressed') === 'true' && themes[4].getAttribute('aria-pressed') === 'false', 'Choosing another theme releases the first');
    themes[1].click();
    check(themes.every(b => b.getAttribute('aria-pressed') === 'false'), 'A pressed theme toggles off');
    check(!egg().querySelector('#spira-text').closest('[hidden]'), 'The default plate text returns');
    await nextPaint();
    const stage = egg().querySelector('.spira-stage');
    const star = egg().spira.projectStar('godel-agent');
    const pointer = (type, x, y) => stage.dispatchEvent(new win.PointerEvent(type, { pointerId: 7, pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    pointer('pointerdown', star.x, star.y); pointer('pointerup', star.x, star.y);
    const plate = egg().querySelector('.spira-plate');
    check(plate.textContent.includes('2025 · Self-improvement'), 'Clicking the Gödel Agent star shows "2025 · Self-improvement"');
    check(plate.querySelector('.spira-link')?.pathname === '/papers/godel-agent.html', 'The plate links to papers/godel-agent.html');
    check(plate.querySelector('.spira-plate-title')?.textContent.startsWith('Gödel Agent'), 'The plate shows the full paper title');
    check(plate.querySelector('.spira-takeaway')?.textContent === win.SiteEasterEgg.takeaways['godel-agent'], 'The plate shows the paper\'s takeaway between its title and venue');
    pointer('pointerdown', 4, 4); pointer('pointerup', 4, 4);
    check(!egg().querySelector('#spira-text').closest('[hidden]'), 'Clicking empty space deselects the star');
    const indexButton = egg().querySelector('[data-index]');
    indexButton.click();
    check(!egg().querySelector('.spira-index').hidden && indexButton.getAttribute('aria-expanded') === 'true', 'All works opens the index');
    indexButton.click();
    check(egg().querySelector('.spira-index').hidden, 'All works closes the index');
    const chartCanvas = egg().querySelector('.spira-canvas');
    const image = chartCanvas.toDataURL(); const beforeKey = egg().spira.projectStar('godel-agent');
    stage.focus(); stage.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await nextPaint();
    const afterKey = egg().spira.projectStar('godel-agent');
    check(chartCanvas.toDataURL() !== image && Math.hypot(afterKey.x - beforeKey.x, afterKey.y - beforeKey.y) > 5, 'Arrow keys turn the rendered spiral');

    /* Chrome: revealed by intent only (pointer in its corner, keyboard focus, a tap on empty sky). */
    const actionsRect = chartActions.getBoundingClientRect();
    egg().dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 8, pointerType: 'mouse', clientX: actionsRect.right - 10, clientY: 40, bubbles: true }));
    check(egg().spira.chrome && actionsShown(), 'A pointer in the actions\' corner reveals them');
    egg().dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 8, pointerType: 'mouse', clientX: 700, clientY: 600, bubbles: true }));
    check(egg().spira.chrome, 'They stay a moment after the pointer leaves the corner');
    await until(() => !egg().spira.chrome, 'the actions to hide again', 2000);
    check(!actionsShown(), 'Then they hide again');
    for (const type of ['pointerdown', 'pointerup']) stage.dispatchEvent(new win.PointerEvent(type, { pointerId: 13, pointerType: 'touch', button: 0, clientX: 1262, clientY: 884, bubbles: true, cancelable: true }));
    check(egg().spira.chrome, 'A tap on empty sky reveals them');
    await until(() => !egg().spira.chrome, 'the tap reveal to end', 2000);
    egg().dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    egg().querySelector('[data-index]').focus();
    check(actionsShown(), 'Keyboard focus within reveals them');
    stage.focus();
    egg().dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
    check(!egg().spira.sound && egg().querySelector('.spira-toast').textContent === 'Sound off' && !egg().spira.chrome, 'M switches the sound with the chrome hidden; a whisper toast is its feedback');
    egg().dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));

    /* The galaxy as an instrument: hovering strums (one note per 70 ms), keys choose themes. */
    const log = () => egg().spira.audioCues;
    const count = name => log().filter(c => c.cue === name).length;
    const move = (x, y) => stage.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 7, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true }));
    move(4, 4); await delay(90);
    const godel = egg().spira.projectStar('godel-agent'); const chem = egg().spira.projectStar('chemagent');
    const hovers = count('hover');
    move(godel.x, godel.y); move(chem.x, chem.y);
    check(count('hover') === hovers + 1, 'Hovering a star rings its bell; a second star within 70 ms is throttled');
    await delay(90); move(godel.x, godel.y);
    check(count('hover') === hovers + 2, 'After 70 ms the next star rings again');
    move(4, 4);
    pointer('pointerdown', godel.x, godel.y); pointer('pointerup', godel.x, godel.y);
    check(log()[log().length - 1].cue === 'select', 'Selecting a star rings it with its octave');
    stage.dispatchEvent(new win.KeyboardEvent('keydown', { key: '4', bubbles: true, cancelable: true }));
    check(themes[3].getAttribute('aria-pressed') === 'true' && log()[log().length - 1].cue === 'theme', 'Key 4 chooses the fourth theme and plays its papers as an arpeggio');
    stage.dispatchEvent(new win.KeyboardEvent('keydown', { key: '4', bubbles: true, cancelable: true }));
    check(stage.getAttribute('aria-label').includes('Keys 1 to 5'), 'The stage label documents the theme keys');

    /* Sound toggle: two text buttons, the M key and a persisted preference. */
    const soundButtons = [...egg().querySelectorAll('[data-sound]')];
    check(soundButtons.length === 2 && egg().spira.sound && soundButtons.every(b => b.getAttribute('aria-pressed') === 'true' && b.textContent.includes('Sound on')), 'Sound is on by default, with a toggle in the opening controls and the chart actions');
    egg().querySelector('.spira-actions [data-sound]').click();
    check(!egg().spira.sound && localStorage.getItem('spira-sound') === 'off' && soundButtons.every(b => b.getAttribute('aria-pressed') === 'false' && b.textContent.includes('Sound off')), 'The toggle turns sound off, in both buttons, and persists it');
    const logged = log().length; const voices = egg().spira.voices;
    themes[0].click(); themes[0].click(); move(godel.x, godel.y); move(4, 4);
    check(log().length === logged && egg().spira.voices === voices, 'With sound off no cue fires and no voice is scheduled');
    keepStats();
    await dismiss();
    restored('Escape in the chart');
    await openFast(8);
    check(!egg().spira.sound && egg().querySelector('[data-sound]').getAttribute('aria-pressed') === 'false', 'The sound preference survives a re-open');
    egg().dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
    check(egg().spira.sound && localStorage.getItem('spira-sound') === 'on', 'The M key turns sound back on');
    await dismiss();

    /* Sound renders offline: the same synthesizer on an OfflineAudioContext, measured. */
    const render = async (seconds, play) => {
      const rate = 48000; const context = new win.OfflineAudioContext(2, Math.round(rate * seconds), rate);
      const audio = win.SiteEasterEgg.createAudio(context, { fadeIn: false });
      play(audio);
      const scheduled = audio.scheduled; const buffer = await context.startRendering();
      let peak = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) { const data = buffer.getChannelData(c); for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; } }
      return { peak: +peak.toFixed(4), scheduled };
    };
    const melody = [[2022, 0], [2023, 0], [2023, 0], [2023, 1], [2024, 0], [2024, 0], [2024, 1], [2024, 1], [2024, 2], [2024, 2], [2024, 3],
      [2025, 0], [2025, 0], [2025, 0], [2025, 1], [2025, 2], [2025, 2], [2025, 4], [2025, 4], [2025, 4],
      [2026, 0], [2026, 0], [2026, 2], [2026, 2], [2026, 2], [2026, 3], [2026, 3], [2026, 3], [2026, 4]];
    const renders = {
      ignition: await render(3, audio => audio.cue.ignite(0.05)),
      melody: await render(5.5, audio => melody.forEach(([year, theme], i) => audio.cue.paper(0.05 + i * 0.14, theme, year, (i % 5) / 2.5 - 0.8))),
      whoosh: await render(1.4, audio => audio.cue.whoosh(0.05, 0.9, -0.7, 0.7)),
      catch: await render(2.6, audio => audio.cue.catch(0.05, 1, 3, 0.2)),
      score: await render(4.5, audio => {
        audio.cue.year(0.05, 2, 3.6);
        [[2024, 0], [2024, 0], [2024, 1], [2024, 1], [2024, 2], [2024, 2], [2024, 3]].forEach(([year, theme], i) => audio.cue.paper(0.3 + i * 0.4, theme, year, 0));
        audio.cue.resolve(2.6);
      }),
      dive: await render(3, audio => { audio.cue.dive(0.05, 1.8); audio.cue.arrive(1.85); })
    };
    for (const [name, result] of Object.entries(renders)) {
      audioPeaks[name] = result.peak;
      check(result.peak > 0.01 && result.peak < 0.9, `Offline ${name}: audible and unclipped (peak ${result.peak})`);
    }
    check(renders.melody.scheduled === 29, 'The research melody schedules one bell per paper');
    const silent = await render(0.5, audio => { audio.setEnabled(false); audio.cue.ignite(0.05); audio.cue.paper(0.1, 0, 2022, 0); });
    check(silent.scheduled === 0 && silent.peak === 0, 'With sound off the synthesizer schedules no voices');

    /* 4. Skip by button and by Enter. */
    await openFast(4);
    await until(() => phase() === 'gather', 'gather before skipping');
    egg().querySelector('[data-skip]').click();
    check(phase() === 'chart' && doc.activeElement === egg().querySelector('.spira-stage'), 'Skip button reaches the chart and focuses the stage');
    await delay(450);
    check(!egg().classList.contains('is-fading-skip'), 'The skip fade finishes');
    keepStats();
    await dismiss();
    await openFast(4);
    egg().dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    check(phase() === 'chart' && doc.activeElement === egg().querySelector('.spira-stage'), 'Enter skips to the chart and focuses the stage');
    await dismiss();
    restored('Escape after Enter skip');

    /* Closing is a dawn: the page reassembles on the canvas; glyphs and DOM swap on the last frame. */
    await openFast(6);
    egg().querySelector('[data-skip]').click();
    await delay(150);
    keepStats();
    const dawn = egg();
    check(doc.documentElement.style.getPropertyValue('scrollbar-gutter') === 'stable', 'The scrollbar gutter is stable while the egg is open');
    dawn.dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(phase() === 'closing' && doc.documentElement.classList.contains('spira-hide-text'), 'Close enters the closing phase; the page glyphs stay hidden until the swap');
    const steps = []; const counts = new Set(); let attachedAtDawn = false;
    await until(() => {
      if (!dawn.isConnected) return true;
      const step = dawn.spira.closeStep;
      if (step && step !== steps[steps.length - 1]) steps.push(step);
      if (step === 'home' || step === 'dawn') counts.add(dawn.spira.canvasWords);
      if (step === 'dawn') attachedAtDawn = doc.documentElement.classList.contains('spira-hide-text') && dawn.open;
      return false;
    }, 'the dawn to finish', 8000);
    check(JSON.stringify(steps) === JSON.stringify(['collapse', 'bloom', 'home', 'dawn']), `The dawn runs collapse > bloom > home > dawn (saw ${steps.join(' > ')})`);
    check(counts.size === 1 && [...counts][0] === dawn.spira.wordCount, `Every word stays on the canvas through the flight home (${[...counts].join(', ')} of ${dawn.spira.wordCount})`);
    check(dawn.spira.dawnLines > 5 && dawn.spira.dawnLines < dawn.spira.wordCount / 3, `Words fly home as page lines (${dawn.spira.dawnLines} lines for ${dawn.spira.wordCount} words)`);
    check(attachedAtDawn, 'The dialog and the hidden glyphs remain until the dawn ends');
    restored('After the dawn');
    await openFast(1);
    egg().querySelector('[data-skip]').click();
    await delay(100);
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(phase() === 'closing', 'A first Escape starts the closing');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!egg(), 'A second Escape during the closing finishes it immediately');
    restored('Second Escape during the closing');

    /* Core view: the page at the centre of the galaxy. */
    await openFast(8);
    egg().querySelector('[data-skip]').click();
    await delay(150);   // before the first meteor, which could pass over the centre and take the click
    const core = egg().spira.projectCore();
    const coreStage = egg().querySelector('.spira-stage');
    const press = (x, y) => {
      for (const type of ['pointerdown', 'pointerup']) coreStage.dispatchEvent(new win.PointerEvent(type, { pointerId: 9, pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    };
    press(core.x, core.y);
    const detail = () => egg().querySelector('.spira-plate-detail');
    check(egg().spira.view === 'core' && !detail().hidden && detail().textContent.includes('The page you came from.'), 'Clicking the centre opens the core view and its plate');
    check(doc.activeElement && doc.activeElement.textContent === 'Back out', 'Focus moves to Back out');
    await delay(500);
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!!egg() && egg().open && phase() === 'chart', 'Escape in the core view backs out instead of closing');
    await until(() => egg().spira.view === 'chart', 'the flight back to the chart');
    check(!egg().querySelector('#spira-text').closest('[hidden]'), 'Backing out restores the default plate');
    egg().querySelector('.spira-centre').click();
    check(egg().spira.view === 'core', 'The centre control opens the core view too');
    egg().querySelector('.spira-back').click();
    await until(() => egg().spira.view === 'chart', 'Back out');
    check(doc.activeElement === egg().querySelector('.spira-centre'), 'Back out returns focus to the centre control');
    keepStats();
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(phase() === 'closing', 'A second Escape (back in the chart) closes');
    await until(() => !egg(), 'the closing after core view');
    restored('Escape after the core view');

    /* Shooting stars carry open questions: catch, pin, persist, Space, all ten, release. */
    await openFast(8);
    egg().querySelector('[data-skip]').click();
    const sky = egg(); const skyStage = sky.querySelector('.spira-stage');
    const counter = sky.querySelector('.spira-count');
    check(counter.classList.contains('is-pending') && !sky.querySelector('.spira-hint').textContent.includes('shooting star'), 'Before any meteor the counter and the catch hint are not shown');
    await delay(150);   // before the first natural meteor (2.5 s of chart time at 8x)
    const tap = (x, y) => { for (const type of ['pointerdown', 'pointerup']) skyStage.dispatchEvent(new win.PointerEvent(type, { pointerId: 5, pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true })); };
    const first = sky.spira.spawnMeteor();
    const head = sky.spira.meteorHead();
    check(first >= 0 && head && head.x >= 0 && head.x <= 1280 && head.y >= 0 && head.y <= 900, 'A spawned meteor carries a question and is in view');
    check(sky.spira.meteorSpeed > 300 && sky.spira.meteorSpeed < 600 && sky.querySelector('.spira-hint').textContent.startsWith('A shooting star: click it'),
      `The first meteor is a slow invitation (${Math.round(sky.spira.meteorSpeed)} px/s), announced as it appears`);
    tap(head.x + 20, head.y + 20);
    check(sky.spira.caught === 1 && sky.spira.catching === first, 'Clicking within 44 px of the head catches it');
    check(!counter.classList.contains('is-pending') && counter.textContent.includes('1 / 10') && sky.querySelector('.spira-hint').textContent.includes('Catch a shooting star'), 'The counter and the catch hint appear');
    check(sky.querySelector('.spira-status').textContent.includes('caught'), 'The catch is announced politely');
    await until(() => sky.spira.wishes.includes(first), 'the question to be pinned', 4000);
    await nextPaint();
    const wish = sky.spira.projectWish(first);
    check(!!wish && JSON.parse(localStorage.getItem('spira-wishes')).includes(first), 'The question is pinned on the next turn as a wish star, and saved');
    tap(wish.x, wish.y);
    check(sky.querySelector('.spira-plate-kicker')?.textContent.startsWith('Open question ·'), 'Clicking the wish star shows its open question in the plate');
    await delay(200);
    check(sky.spira.bridge.q === first && sky.spira.bridge.fade > 0.5, 'A selected wish star bridges its two themes');
    tap(4, 4);
    const second = sky.spira.spawnMeteor();
    const nominal = sky.spira.meteorSpeed;
    for (let k = 0; k < 2; k++) {
      const near = sky.spira.meteorHead(); if (!near) break;
      skyStage.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 6, pointerType: 'mouse', clientX: near.x + 20, clientY: near.y + 20, bubbles: true }));
      await nextPaint();
    }
    check(nominal >= 1100 && sky.spira.meteorSpeed < 0.7 * nominal, `Bullet time slows a meteor near the pointer (${Math.round(nominal)} > ${Math.round(sky.spira.meteorSpeed)} px/s)`);
    skyStage.dispatchEvent(new win.PointerEvent('pointerleave', { pointerId: 6, pointerType: 'mouse', bubbles: true }));
    check(doc.activeElement === skyStage, 'The stage keeps focus, so Space reaches it');
    skyStage.dispatchEvent(new win.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    check(second >= 0 && sky.spira.caught === 2, 'Space catches the visible meteor');
    keepStats();
    await dismiss();
    await openFast(8);
    egg().querySelector('[data-skip]').click();
    await delay(100);
    check(egg().spira.caught === 2 && egg().spira.wishes.length === 2, 'Caught questions are on the next turn after a re-open');
    for (let k = 0; k < 8; k++) {
      egg().spira.spawnMeteor();
      const at = egg().spira.meteorHead(); const stageNow = egg().querySelector('.spira-stage');
      for (const type of ['pointerdown', 'pointerup']) stageNow.dispatchEvent(new win.PointerEvent(type, { pointerId: 5, pointerType: 'mouse', button: 0, clientX: at.x, clientY: at.y, bubbles: true, cancelable: true }));
    }
    check(egg().spira.caught === 10, 'Ten catches catch all ten questions');
    await until(() => egg().spira.drawn, 'the next turn to be drawn', 4000);
    const drawnPlate = egg().querySelector('.spira-plate-detail');
    check(drawnPlate.textContent.includes('The next turn is drawn.') && drawnPlate.querySelector('a')?.pathname === '/blogs/agents-that-learn-after-deployment.html', 'All ten draw the next turn and link the research direction');
    check(egg().spira.audioCues.some(c => c.cue === 'swell'), 'Completion swells');
    await delay(200);
    keepStats();
    egg().querySelector('.spira-count').click();
    check(egg().querySelectorAll('.spira-wish-row').length === 10, 'The counter lists the caught questions');
    egg().querySelector('[data-release]').click();
    check(egg().spira.caught === 0 && !egg().spira.drawn && localStorage.getItem('spira-wishes') === null, 'Release them clears the caught questions');
    await dismiss();

    /* The score: Listen to the spiral (2022 > 2026, then the next turn and a resolving chord). */
    await openFast(12);
    egg().querySelector('[data-skip]').click();
    await delay(100);
    const listen = egg().querySelector('[data-listen]');
    listen.click();
    check(egg().spira.score?.state === 'playing' && egg().querySelector('.spira-score-year') && egg().querySelector('[data-score-stop]'), 'Listen to the spiral starts the score with its plate and a Stop button');
    const scoreYears = [];
    await until(() => { const now = egg().spira.score; if (now && now.year > 2000 && now.year !== scoreYears[scoreYears.length - 1]) scoreYears.push(now.year); return !now; }, 'the score to end', 9000);
    check(JSON.stringify(scoreYears) === JSON.stringify([2022, 2023, 2024, 2025, 2026]), `The score walks 2022 > 2026 (saw ${scoreYears.join(' > ')})`);
    check(!egg().querySelector('#spira-text').closest('[hidden]') && listen.textContent.startsWith('Listen'), 'After the score the default plate returns');
    const scoreCues = egg().spira.audioCues;
    check(scoreCues.filter(c => c.cue === 'ring').length === 29 && scoreCues.filter(c => c.cue === 'year').length === 5 && scoreCues.some(c => c.cue === 'resolve'),
      'Every paper rings, every year plays its chord, and a final chord resolves');
    egg().querySelector('.spira-stage').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'l', bubbles: true, cancelable: true }));
    check(egg().spira.score?.state === 'playing', 'The L key starts the score');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!!egg() && egg().open && egg().spira.score?.state !== 'playing' && !egg().querySelector('#spira-text').closest('[hidden]'), 'Escape stops the score without closing the egg');
    keepStats();
    await dismiss();

    /* Strange loop: from the core view the camera dives into the page and finds the galaxy. */
    await openFast(8);
    egg().querySelector('[data-skip]').click();
    await delay(100);
    egg().querySelector('.spira-centre').click();
    await delay(300);
    check(egg().querySelector('.spira-plate-detail').textContent.includes('go deeper'), 'The core plate invites a dive');
    egg().querySelector('.spira-stage').dispatchEvent(new win.WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true }));
    check(egg().spira.view === 'dive', 'Scrolling inward in the core view starts a dive');
    await until(() => egg().spira.view === 'chart', 'the dive to arrive', 3000);
    check(!egg().querySelector('#spira-text').closest('[hidden]') && !egg().querySelector('.spira-centre').hidden, 'The dive arrives in the chart state');
    egg().querySelector('.spira-centre').click();
    await delay(300);
    const vanishing = egg().spira.projectVanishing();
    for (const type of ['pointerdown', 'pointerup']) egg().querySelector('.spira-stage').dispatchEvent(new win.PointerEvent(type, { pointerId: 14, pointerType: 'mouse', button: 0, clientX: vanishing.x, clientY: vanishing.y, bubbles: true, cancelable: true }));
    check(egg().spira.view === 'dive', 'Clicking the vanishing point dives again');
    await until(() => egg().spira.view === 'chart', 'the second dive', 3000);
    check(egg().spira.nebula, 'The nebula and the band have rendered');
    keepStats();
    await dismiss();

    /* 5. Escape during each phase restores everything. */
    for (const target of ['dusk', 'gather', 'wind', 'ignite', 'chart']) {
      await openFast(target === 'dusk' ? 2 : 14);
      await until(() => phase() === target, `phase ${target}`, 15000);
      keepStats();
      await dismiss();
      restored(`Escape during ${target}`);
    }

    /* Replay restarts the opening from the chart. */
    await openFast(12);
    egg().querySelector('[data-skip]').click();
    await delay(400);
    egg().querySelector('[data-replay]').click();
    await until(() => phase() === 'dusk', 'replay to restart the opening');
    check(egg().querySelector('.spira-plate').inert && !egg().querySelector('.spira-opening').hidden, 'Replay restarts with inert chart UI and opening controls');
    check(main.innerHTML === before.html, 'Replay leaves the page markup unchanged');
    await until(() => phase() === 'chart', 'the replayed opening to finish', 15000);
    keepStats();
    await dismiss();
    restored('Escape after replay');

    /* 7. Reduced motion: straight to the chart, no idle loop, no Replay. */
    setReduced(true);
    win.SiteEasterEgg.open();
    await until(() => egg()?.open, 'the reduced-motion dialog');
    check(phase() === 'chart', 'Reduced motion opens directly in the chart');
    check(!doc.documentElement.classList.contains('spira-hide-text'), 'Reduced motion leaves page glyphs visible');
    await nextPaint(); await nextPaint();
    check(pending.size === 0, 'Reduced motion leaves no pending animation frame after two frames');
    check(egg().querySelector('[data-replay]').hidden, 'Replay is hidden under reduced motion');
    const stillQ = egg().spira.spawnMeteor(); const still = egg().spira.meteorHead();
    check(stillQ >= 0 && !!still, 'Reduced motion: a wish waits as a still star');
    const rmStill = egg().querySelector('.spira-stage');
    for (const type of ['pointerdown', 'pointerup']) rmStill.dispatchEvent(new win.PointerEvent(type, { pointerId: 12, pointerType: 'mouse', button: 0, clientX: still.x, clientY: still.y, bubbles: true, cancelable: true }));
    check(egg().spira.caught === 1 && egg().spira.wishes.includes(stillQ) && !egg().spira.meteorHead() &&
      egg().querySelector('.spira-plate-kicker')?.textContent.startsWith('Open question ·'), 'Reduced motion: catching the still star pins it at once and shows its question');
    await nextPaint(); await nextPaint();
    check(pending.size === 0, 'Reduced motion: a still wish keeps no running loop');
    localStorage.removeItem('spira-wishes');
    const rmCore = egg().spira.projectCore();
    const rmStage = egg().querySelector('.spira-stage');
    for (const type of ['pointerdown', 'pointerup']) rmStage.dispatchEvent(new win.PointerEvent(type, { pointerId: 11, pointerType: 'mouse', button: 0, clientX: rmCore.x, clientY: rmCore.y, bubbles: true, cancelable: true }));
    check(egg().spira.view === 'core', 'Reduced motion: the core opens at once');
    await nextPaint(); await nextPaint();
    check(pending.size === 0, 'Reduced motion: the core view keeps no running loop');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(egg().spira.view === 'chart', 'Reduced motion: Escape backs out of the core at once');
    egg().dispatchEvent(new win.Event('cancel', { cancelable: true }));
    check(!egg(), 'Reduced motion: closing is instant');
    setReduced(false);
    await openFast(4);
    await until(() => phase() === 'gather', 'gather before reduced motion');
    setReduced(true);
    check(phase() === 'chart', 'Turning on reduced motion mid-opening skips to the chart');
    await nextPaint(); await nextPaint();
    check(pending.size === 0 && egg().querySelector('[data-replay]').hidden, 'Mid-opening reduced motion stops frames and hides Replay');
    await dismiss();
    setReduced(false);
    restored('Escape after reduced motion');

    /* 8. Resize during the gather skips to the chart. */
    await openFast(4);
    await until(() => phase() === 'gather', 'gather before resizing');
    const errorsBefore = errors.length;
    frame.style.width = '390px'; frame.style.height = '844px';
    await until(() => phase() === 'chart', 'resize to skip to the chart');
    await delay(450);
    check(errors.length === errorsBefore, 'Resizing during the gather raises no errors');
    check(egg().scrollWidth <= 391 && egg().scrollHeight <= 845, '390x844: the dialog does not scroll');
    const narrowBlocks = ['.spira-head', '.spira-plate', '.spira-themes', '.spira-actions'].map(selector => egg().querySelector(selector).getBoundingClientRect());
    check(narrowBlocks.every(r => r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844), '390x844: UI blocks fit the viewport');
    check(egg().querySelector('.spira-hint').textContent.includes('Tap a star'), '390x844: the touch hint is shown');
    keepStats();
    await dismiss();
    frame.style.width = '1280px'; frame.style.height = '900px';
    await delay(100);

    /* 9. Nested route: assets and paper links resolve from the site root. */
    await load('/blogs/agents-that-learn-after-deployment.html');
    doc.querySelector('.easter-egg-footnote').click();
    await until(() => egg()?.open, 'the egg on a nested route');
    check([...assets()].every(asset => new URL(asset.src || asset.href).pathname.startsWith('/easter-egg.')), 'Nested routes load the assets from the site root');
    check([...egg().querySelectorAll('.spira-index-link')].every(a => new URL(a.href).pathname.startsWith('/papers/')), 'Nested routes link papers from the site root');
    check(egg().spira.wordCount > 10, 'Nested routes capture their own words');
    keepStats();
    await dismiss();

    /* 10. A failed download can be retried. */
    await load('/');
    const append = doc.head.append.bind(doc.head); let failOnce = true;
    doc.head.append = (...nodes) => {
      const script = nodes.find(node => node.tagName === 'SCRIPT' && node.src.includes('easter-egg.js'));
      if (script && failOnce) { failOnce = false; setTimeout(() => script.onerror(new win.Event('error')), 0); }
      else append(...nodes);
    };
    type(); await delay(200);
    check(!egg() && assets().length === 0, 'A failed download removes partial assets');
    doc.head.append = append;
    type(); await until(() => egg()?.open, 'the retried egg');
    check(egg().open, 'A failed download can be retried');
    egg().querySelector('[data-opening-close]').click();
    await until(() => !egg(), 'the opening close button');
    check(!doc.body.style.overflow && !doc.documentElement.classList.contains('spira-hide-text'), 'The opening Close restores an absent overflow style and the glyphs');
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    if (storedTheme === null) localStorage.removeItem('theme'); else localStorage.setItem('theme', storedTheme);
    if (storedSound === null) localStorage.removeItem('spira-sound'); else localStorage.setItem('spira-sound', storedSound);
    if (storedWishes === null) localStorage.removeItem('spira-wishes'); else localStorage.setItem('spira-wishes', storedWishes);
  }
  /* 11. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${errors.join(' | ')}`);
  mergeStats();
  return { assertions, failures, frameStats, audioPeaks };
})();
