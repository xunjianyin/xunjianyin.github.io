/* Run with agent-browser eval --stdin against a local static preview of the site (any page).
 * The suite takes minutes: tests/run_easter_suites.sh lenses_pages starts it as a background
 * promise (one eval stores the result on window when the promise resolves) and polls for it.
 * Tests the lenses across the site: the lens follows the reader from page to page (no flash
 * of the normal style at the first frame of the next page: the <head> snippet hides the page
 * over the lens's ground, or shows it at once for a lens without one, and #lenses-prepaint is
 * gone after the reveal), a back/forward return (pagehide and pageshow with persisted), an
 * unknown stored lens, Esc on a subpage, the triggers on every page kind, the first egg from a
 * subpage, ctx.onLayoutChange on a lazy photo and a padding change, every lens arriving on a
 * sample of pages and leaving them byte for byte, and the frame budget on the longest paper
 * page. The lenses and their grounds are read from the core (lenses listed but not written
 * yet are skipped). Prints assertions, failures, first-frame samples, arrival times and frame
 * budgets.
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
  // A fast yield (setTimeout is clamped to 4 ms), to catch a new document right away.
  const channel = new MessageChannel();
  const yieldNow = () => new Promise(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:900px;z-index:200000;border:0;background:white';
  document.body.append(frame);
  const keys = ['theme', 'lenses-seen', 'spira-sound'];
  const stored = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const storedLens = sessionStorage.getItem('lenses-active');
  const storedGround = sessionStorage.getItem('lenses-ground');
  localStorage.setItem('theme', 'light'); localStorage.setItem('lenses-seen', '1'); localStorage.setItem('spira-sound', 'off');
  sessionStorage.removeItem('lenses-active'); sessionStorage.removeItem('lenses-ground');
  const grounds = {};                // lens id -> '#rrggbb' or null, from each registered lens
  const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
  const LONGEST_PAPER = '/papers/auditing-health-llms.html';
  const SAMPLE = {
    publications: '/publications.html',
    photography: '/photography.html',
    blog: '/blogs/agents-that-learn-after-deployment.html',
    'blog-post': '/blog-post.html?id=self-referential-agent',
    paper: LONGEST_PAPER,
    cv: '/cv.html'
  };
  const errors = []; const warnings = [];
  const report = { lenses: [], firstFrames: [], arrivalMs: {}, budget: {}, longTasks: {} };
  let doc; let win; let longTasks = [];

  // Error, warning and long-task hooks for the page now in the frame.
  const hook = path => {
    doc = frame.contentDocument; win = frame.contentWindow;
    if (win.__lensSuiteHooked) return;
    win.__lensSuiteHooked = true;
    win.addEventListener('error', event => errors.push(`${path}: ${event.message}`));
    win.addEventListener('unhandledrejection', event => errors.push(`${path}: ${event.reason}`));
    const consoleError = win.console.error.bind(win.console);
    win.console.error = (...args) => { errors.push(`${path}: console.error ${args.join(' ')}`); consoleError(...args); };
    const consoleWarn = win.console.warn.bind(win.console);
    win.console.warn = (...args) => { warnings.push(`${path}: ${args.map(String).join(' ')}`); consoleWarn(...args); };
    longTasks = [];
    try {
      new win.PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push({ at: entry.startTime, ms: Math.round(entry.duration) })))
        .observe({ type: 'longtask', buffered: true });
    } catch (error) { /* long tasks are not observable here */ }
  };
  const settled = async () => {
    // The page's own late content (markdown, star counts) settles first.
    let last = ''; let since = performance.now();
    await until(() => {
      const main = doc.querySelector('#main-content');
      const now = main ? main.innerHTML : '';
      if (now !== last) { last = now; since = performance.now(); }
      return now && performance.now() - since > 500;
    }, 'the page to settle', 10000);
  };
  // Navigates the frame (by `go`) and samples the new document at its first animation frame.
  const navigate = async (go, label) => {
    const old = frame.contentDocument;
    go();
    let first = null;
    const began = performance.now();
    while (performance.now() - began < 10000) {
      const d = frame.contentDocument;
      if (d && d !== old && d.documentElement && frame.contentWindow.location.href !== 'about:blank') {
        const w = frame.contentWindow;
        first = await new Promise(resolve => w.requestAnimationFrame(() => resolve({
          page: label,
          paintedBefore: w.performance.getEntriesByType('paint').length > 0,
          // A fast arrival may already be fading in (data-lens-revealing) at the first frame.
          arriving: d.documentElement.getAttribute('data-lens-arriving') || d.documentElement.getAttribute('data-lens-revealing'),
          active: w.SiteLenses ? w.SiteLenses.current : null,
          bodyOpacity: d.body ? w.getComputedStyle(d.body).opacity : null,
          ground: w.getComputedStyle(d.documentElement).backgroundColor,
          prepaint: !!d.getElementById('lenses-prepaint')
        })));
        break;
      }
      await yieldNow();
    }
    await until(() => frame.contentDocument && frame.contentDocument.readyState === 'complete', `${label} to load`);
    hook(label);
    await until(() => win.SiteLensesBoot, `${label}: the lens boot`);
    return first;
  };
  // Opens a page as if the reader came with `lens` (its ground stored as the core stores it).
  const remember = (lens, ground = grounds[lens]) => {
    if (lens) sessionStorage.setItem('lenses-active', lens); else sessionStorage.removeItem('lenses-active');
    if (lens && ground) sessionStorage.setItem('lenses-ground', ground); else sessionStorage.removeItem('lenses-ground');
  };
  const load = (path, lens = null) => {
    remember(lens);
    return navigate(() => { frame.src = `${path}${path.includes('?') ? '&' : '?'}r=${Math.random().toString(36).slice(2)}`; }, path);
  };
  const lenses = () => win.SiteLenses;
  const state = () => win.SiteLenses._debug.state;
  const arrived = id => until(() => win.SiteLenses && win.SiteLenses.current === id && !win.SiteLenses.busy &&
    !doc.documentElement.hasAttribute('data-lens-arriving') && !doc.documentElement.hasAttribute('data-lens-revealing'), `${id} to arrive`, 15000);
  const idle = () => until(() => !win.SiteLenses || !win.SiteLenses.busy, 'the lenses to settle', 20000);
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const escape = () => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const dblclick = el => {
    const at = centre(el); let prevented = false;
    for (const detail of [1, 2]) {
      const down = new win.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail, button: 0 });
      el.dispatchEvent(down); if (detail === 2) prevented = down.defaultPrevented;
      el.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail, button: 0 }));
      el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail, button: 0 }));
    }
    el.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, detail: 2, button: 0 }));
    return prevented;
  };
  const doubleTap = async el => {
    const at = centre(el);
    for (let k = 0; k < 2; k++) {
      for (const type of ['pointerdown', 'pointerup']) {
        el.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: at.x, clientY: at.y, button: 0 }));
      }
      await delay(70);
    }
  };
  // What a lens could leave behind (the core's own assets may stay once loaded).
  const ours = el => /easter\/(boot|lenses\/core)\.(js|css)/.test(el.getAttribute('src') || el.getAttribute('href') || '');
  const snapshot = () => ({
    main: doc.querySelector('#main-content').innerHTML,
    nav: (doc.querySelector('#site-nav, body > header.site-header') || {}).innerHTML || '',
    footer: (doc.querySelector('#site-footer, body > footer.paper-footer') || {}).innerHTML || '',
    htmlAttrs: [...doc.documentElement.attributes].map(a => `${a.name}=${a.value}`).filter(a => !a.startsWith('data-theme')).join('|'),
    bodyAttrs: [...doc.body.attributes].map(a => `${a.name}=${a.value}`).join('|'),
    bodyKids: [...doc.body.children].map(el => el.tagName + (el.id ? `#${el.id}` : '')).join(','),
    headKids: [...doc.head.children].filter(el => !ours(el)).map(el => el.outerHTML).join('\n')
  });
  const firstDiff = (a, b) => {
    if (a === b) return '';
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return `at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}... became ...${b.slice(Math.max(0, i - 40), i + 40)}...`;
  };
  const compare = (before, label) => {
    const now = snapshot();
    check(now.main === before.main, `${label}: #main-content markup is byte-identical (${firstDiff(before.main, now.main)})`);
    check(now.nav === before.nav && now.footer === before.footer, `${label}: nav and footer markup are byte-identical (${firstDiff(before.nav, now.nav)}${firstDiff(before.footer, now.footer)})`);
    check(now.htmlAttrs === before.htmlAttrs, `${label}: <html> attributes restored (${now.htmlAttrs})`);
    check(now.bodyAttrs === before.bodyAttrs, `${label}: <body> attributes restored (${now.bodyAttrs})`);
    check(now.bodyKids === before.bodyKids, `${label}: no node left in <body> (${now.bodyKids})`);
    check(now.headKids === before.headKids, `${label}: no <style>, <link> or <script> left in <head> (${firstDiff(before.headKids, now.headKids)})`);
    check(!doc.querySelector('.lenses-layer, .lenses-caption'), `${label}: no lens layer or caption`);
  };
  // A link in view whose centre is not covered by anything: a lens must not take the click.
  const clickable = label => {
    const links = [...doc.querySelectorAll('#main-content a[href], #site-nav a[href], body > header.site-header a[href]')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top > 0 && r.bottom < win.innerHeight && r.left > 0 && r.right < win.innerWidth;
    }).slice(0, 4);
    check(links.length > 0, `${label}: a link is in view`);
    for (const link of links) {
      const at = centre(link); const hit = doc.elementFromPoint(at.x, at.y);
      check(hit && hit.closest('a') === link, `${label}: the link "${link.textContent.trim().slice(0, 30)}" is clickable (hit ${hit && hit.tagName}.${hit && hit.className})`);
    }
  };

  try {
    /* 0. The lens modules that exist. */
    await load('/');
    const boot = await win.SiteLensesBoot.loadCore();
    const registered = await boot._debug.loadAll();
    report.lenses = registered;
    check(registered.length > 0, `At least one lens module exists (found ${registered.join(', ')})`);
    registered.forEach(id => { grounds[id] = boot._debug.lens(id).ground || null; });
    report.grounds = grounds;
    for (const page of ['/', '/publications.html', '/cv.html', '/blogs/agents-that-learn-after-deployment.html', '/papers/godel-agent.html']) {
      const html = await (await fetch(page)).text();
      const head = html.slice(0, html.indexOf('</head>'));
      const snippet = head.indexOf('<script>/* Lenses:');
      const firstSheet = head.search(/<link[^>]+stylesheet/);
      check(snippet > 0 && snippet === head.indexOf('<script') && (firstSheet < 0 || snippet < firstSheet), `${page}: the pre-paint snippet is the first script in <head>, before any stylesheet`);
      const text = head.slice(snippet, head.indexOf('</script>', snippet));
      check(text.includes("'lenses-ground'") && !boot._debug.lenses.some(id => text.includes(id)), `${page}: the snippet is generic (names no lens)`);
    }

    /* 1. The lens follows the reader: home > publications > a paper, with no flash. */
    for (const id of registered) {
      await load('/');
      await (await win.SiteLensesBoot.loadCore())._debug.goto(id);
      check(sessionStorage.getItem('lenses-active') === id, `${id}: the lens is remembered once it has entered`);
      const toPublications = await navigate(() => doc.querySelector('#site-nav a[href$="publications.html"]').click(), `${id} home > publications`);
      report.firstFrames.push({ lens: id, ...toPublications });
      check(sessionStorage.getItem('lenses-ground') === grounds[id], `${id}: its ground is remembered with it (${sessionStorage.getItem('lenses-ground')})`);
      const ground = grounds[id];
      if (ground) {
        const hidden = toPublications.active === id || toPublications.bodyOpacity === null || toPublications.bodyOpacity === '0';
        check((toPublications.arriving === id || toPublications.active === id) && hidden && toPublications.prepaint && toPublications.ground === rgb(ground),
          `${id}: publications opens marked, hidden over the lens ground ${ground} at its first frame (${JSON.stringify(toPublications)})`);
      } else {
        check((toPublications.arriving === id || toPublications.active === id) && !toPublications.prepaint && toPublications.bodyOpacity === '1',
          `${id}: a lens without a ground: publications opens marked and shows at once (${JSON.stringify(toPublications)})`);
      }
      await arrived(id);
      check(!doc.querySelector('.lenses-caption') && win.getComputedStyle(doc.body).opacity === '1', `${id}: the lens arrives on publications without a caption, and the page shows`);
      check(!doc.getElementById('lenses-prepaint'), `${id}: #lenses-prepaint is removed once the page is revealed`);
      const paperLink = doc.querySelector('#main-content a[href*="papers/"]');
      const toPaper = await navigate(() => paperLink.click(), `${id} publications > paper`);
      report.firstFrames.push({ lens: id, ...toPaper });
      check((toPaper.arriving === id || toPaper.active === id) && (!ground || toPaper.active === id || toPaper.bodyOpacity === null || toPaper.bodyOpacity === '0'),
        `${id}: the paper page opens marked and hidden at its first frame (${JSON.stringify(toPaper)})`);
      await arrived(id);
      check(lenses().page.kind === 'paper', `${id}: the core knows a paper page`);
      // Back/forward cache: pagehide keeps the lens and hides the page; pageshow brings it back.
      win.dispatchEvent(new win.PageTransitionEvent('pagehide', { persisted: true }));
      await idle();
      check(lenses().current === null && doc.documentElement.getAttribute('data-lens-arriving') === id && sessionStorage.getItem('lenses-active') === id,
        `${id}: pagehide (persisted) resets the lens, keeps it remembered and keeps the page marked`);
      check(!!doc.getElementById('lenses-prepaint') === !!ground && (!ground || win.getComputedStyle(doc.body).opacity === '0'),
        `${id}: pagehide (persisted) ${ground ? 'hides the page over the ground again' : 'leaves a lens without a ground visible'}`);
      win.dispatchEvent(new win.PageTransitionEvent('pageshow', { persisted: true }));
      await arrived(id);
      check(lenses().current === id && !doc.getElementById('lenses-prepaint'), `${id}: pageshow (persisted) brings the lens back and lifts the ground`);
      const back = await navigate(() => win.history.back(), `${id} paper > back`);
      check(back.arriving === id || back.active === id, `${id}: going back opens publications with the lens`);
      await arrived(id);
      // Esc on a subpage forgets the lens.
      escape(); await idle();
      check(lenses().current === null && sessionStorage.getItem('lenses-active') === null && sessionStorage.getItem('lenses-ground') === null, `${id}: Esc on a subpage returns to normal and forgets the lens and its ground`);
      const next = await navigate(() => doc.querySelector('#site-nav a[href$="cv.html"]').click(), `${id} after Esc > cv`);
      check(next.arriving === null && !win.SiteLenses, `${id}: after Esc the next page opens normal (no core loaded)`);
    }

    /* 2. Triggers on every page kind (double-click), and a double-tap on a subpage. */
    const triggerPages = [
      ['/', '.profile-text .name'],
      ['/publications.html', '#main-content h1[data-lens-trigger]'],
      ['/publications.html', '#site-footer [data-lens-trigger]'],
      ['/blogs/agents-that-learn-after-deployment.html', '#main-content h1[data-lens-trigger]'],
      ['/blog-post.html?id=self-referential-agent', '#main-content h1[data-lens-trigger]'],
      ['/papers/godel-agent.html', '#main-content h1[data-lens-trigger]'],
      ['/photography.html', '#main-content h1[data-lens-trigger]'],
      ['/cv.html', '#main-content h1[data-lens-trigger]']
    ];
    for (const [page, selector] of triggerPages) {
      await load(page);
      await until(() => doc.querySelector(selector), `${page}: ${selector}`);
      const trigger = doc.querySelector(selector);
      const prevented = dblclick(trigger);
      await until(() => win.SiteLenses && win.SiteLenses.current, `${page}: the first lens`, 15000); await idle();
      check(prevented && lenses().current === registered[0], `${page}: a double-click on ${selector} enters ${registered[0]} without selecting text`);
      check(sessionStorage.getItem('lenses-active') === registered[0], `${page}: the triggered lens is remembered`);
      const caption = doc.querySelector('.lenses-caption');
      if (caption) {
        const box = caption.getBoundingClientRect();
        check(box.left >= 0 && box.right <= win.innerWidth + 1, `${page}: the caption fits the page width`);
      }
      escape(); await idle();
      check(lenses().current === null && sessionStorage.getItem('lenses-active') === null, `${page}: Esc returns to normal`);
    }
    await load('/papers/godel-agent.html');
    check(!doc.querySelector('a.site-name[data-lens-trigger], a[data-lens-trigger]'), 'No link is a lens trigger');
    await load('/cv.html');
    // Only the double-click events (a click on the [PDF] link would open it).
    const pdf = doc.querySelector('h1[data-lens-trigger] a'); const pdfAt = centre(pdf);
    pdf.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: pdfAt.x, clientY: pdfAt.y, detail: 2 }));
    pdf.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: pdfAt.x, clientY: pdfAt.y, detail: 2 }));
    await delay(400);
    check(!win.SiteLenses, 'A double-click on a link inside a trigger keeps its own meaning');
    await doubleTap(doc.querySelector('h1[data-lens-trigger]'));
    await until(() => win.SiteLenses && win.SiteLenses.current, 'a double-tap on a subpage', 15000); await idle();
    check(lenses().current === registered[0], 'A double-tap on a page title enters the first lens');
    escape(); await idle();

    /* 3. The first egg from a subpage resets the lens and forgets it. */
    await load('/publications.html');
    const eggBase = snapshot();
    await (await win.SiteLensesBoot.loadCore())._debug.goto(registered[registered.length - 1]);
    doc.querySelector('.easter-egg-footnote').click();
    await until(() => doc.querySelector('#spira')?.open, 'the first egg from a subpage', 20000);
    check(lenses().current === null && sessionStorage.getItem('lenses-active') === null && !doc.querySelector('.lenses-layer'),
      'Opening the first egg on a subpage resets the lens and forgets it');
    doc.querySelector('#spira').dispatchEvent(new win.Event('cancel', { cancelable: true }));
    await until(() => !doc.querySelector('#spira'), 'the egg to close', 10000);
    await delay(150);
    const afterEgg = snapshot();
    check(afterEgg.main === eggBase.main, 'After the egg on a subpage the markup is unchanged');

    /* 3a. An unknown stored lens (a newer page's lens, or garbage): the page is hidden over the
     * stored ground at first, then the core forgets the id and shows the page. */
    {
      remember('nosuchlens', '#123456');
      const first = await navigate(() => { frame.src = `/publications.html?r=${Math.random().toString(36).slice(2)}`; }, 'unknown lens');
      // Either still marked over the stored ground at the first frame, or already dropped before
      // anything was painted (the core can load before the first frame): never a half state.
      const marked = first.arriving === 'nosuchlens' && first.prepaint && first.ground === 'rgb(18, 52, 86)' && first.bodyOpacity === '0';
      const dropped = !first.paintedBefore && first.arriving === null && !first.prepaint && first.bodyOpacity === '1';
      check(marked || dropped, `An unknown lens: the first frame is hidden over the stored ground, or the lens was already dropped (${JSON.stringify(first)})`);
      await until(() => win.SiteLenses && !win.SiteLenses.busy && !doc.documentElement.hasAttribute('data-lens-arriving'), 'the unknown lens to be dropped');
      await delay(100);
      check(!doc.getElementById('lenses-prepaint') && win.getComputedStyle(doc.body).opacity === '1' && lenses().current === null,
        'The core drops an unknown lens: no ground, the page shows, no lens');
      check(sessionStorage.getItem('lenses-active') === null && sessionStorage.getItem('lenses-ground') === null, 'An unknown lens is forgotten');
    }

    /* 3b. ctx.onLayoutChange reports a lazy photo loading (photography's masonry). */
    {
      const id = registered[registered.length - 1];
      await load('/photography.html', id);
      await arrived(id);
      let calls = 0;
      lenses()._debug.ctx.onLayoutChange(() => { calls++; });
      // The gallery's photos may already be in the memory cache (they then load at once), so a
      // lazy image with a fresh URL goes at the end of the page: it loads only when scrolled to.
      const lazy = doc.createElement('img');
      lazy.alt = ''; lazy.loading = 'lazy'; lazy.width = 320; lazy.height = 320;
      lazy.src = `/figures/me-320.jpg?lazy=${Math.random().toString(36).slice(2)}`;
      doc.getElementById('main-content').append(lazy);
      await delay(600);
      const quiet = calls;
      check(!lazy.complete || lazy.naturalWidth === 0, 'A lazy image far below the viewport has not loaded');
      lazy.scrollIntoView({ block: 'center' });
      await until(() => lazy.complete && lazy.naturalWidth > 0, 'the lazy image to load', 15000);
      await delay(400);
      check(calls > quiet && calls - quiet <= 4, `onLayoutChange fires (debounced) when a lazy image loads (${calls - quiet} calls)`);
      // A padding change moves the content without changing the content box (the border box).
      const main = doc.getElementById('main-content');
      const style = main.getAttribute('style');
      const padded = calls;
      main.style.paddingBottom = '37px';
      await delay(400);
      check(calls > padded, `onLayoutChange fires when a scope element's padding changes (${calls - padded} calls)`);
      if (style === null) main.removeAttribute('style'); else main.setAttribute('style', style);
      await delay(400);
      lazy.remove();
      win.scrollTo({ top: 0, behavior: 'instant' });
      await delay(400);
      const before = calls;
      escape();
      win.dispatchEvent(new win.Event('resize'));
      await idle(); await delay(300);
      check(calls === before, `onLayoutChange is silent once the exit has begun (${calls - before} late calls)`);
    }

    /* 3c. Content changes reach the lens: an abstract toggled open, late blog markdown. */
    await load('/publications.html', registered[registered.length - 1]);
    await arrived(registered[registered.length - 1]);
    const changes = [];
    lenses()._debug.ctx.onContentChange(elements => changes.push(elements.length));
    const toggle = doc.querySelector('#main-content .detail-toggle');
    toggle.click(); await delay(60); toggle.click(); await delay(60); toggle.click();
    await delay(400);
    check(changes.length === 1 && changes[0] > 0, `Toggling an abstract three times reports one debounced content change (${JSON.stringify(changes)})`);
    toggle.click(); escape(); await idle();
    remember(registered[registered.length - 1]);
    await navigate(() => { frame.src = '/blog-post.html?id=self-referential-agent'; }, 'blog-post (late markdown)');
    await arrived(registered[registered.length - 1]);
    await until(() => doc.querySelector('#main-content h1.post-title'), 'the blog post markdown');
    check(lenses().current === registered[registered.length - 1] && doc.querySelector('#main-content h1.post-title[data-lens-trigger]'), 'The lens stays through late blog markdown, whose title is a trigger');
    escape(); await idle();

    /* 4. Every lens arrives on a sample of pages, keeps links working, and Esc restores. */
    for (const [name, page] of Object.entries(SAMPLE)) {
      await load(page);
      await settled();
      const base = snapshot();
      for (const id of registered) {
        const first = await load(page, id);
        await arrived(id);
        const took = Math.round(win.performance.now());
        report.arrivalMs[`${id}@${name}`] = took;
        check(first.arriving === id || first.active === id, `${id}@${name}: marked (or already arrived) at the first frame (${JSON.stringify(first)})`);
        check(!doc.querySelector('.lenses-caption'), `${id}@${name}: no caption on arrival`);
        await delay(200);
        clickable(`${id}@${name}`);
        escape(); await idle(); await delay(80);
        check(sessionStorage.getItem('lenses-active') === null, `${id}@${name}: Esc forgets the lens`);
        compare(base, `${id}@${name} after Esc`);
      }
    }

    /* 5. Frame budget on the longest paper page: arrival, a pointer sweep and a scroll. */
    for (const id of registered) {
      await load(LONGEST_PAPER, id);
      await arrived(id);
      const arrivalTasks = longTasks.filter(task => task.ms > 50);
      const before = JSON.parse(JSON.stringify(state().frameStats[id] || { frames: 0, avgMs: 0, maxMs: 0 }));
      const since = win.performance.now();
      const height = doc.documentElement.scrollHeight;
      for (let k = 0; k <= 40; k++) {
        doc.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 200 + k * 20, clientY: 150 + (k % 10) * 50 }));
        if (k % 4 === 0) win.scrollTo({ top: Math.min(height, (k / 40) * height * 0.9), behavior: 'instant' });
        await delay(40);
      }
      win.scrollTo({ top: 0, behavior: 'instant' }); await delay(300);
      const after = state().frameStats[id];
      const frames = after ? after.frames - before.frames : 0;
      const avg = frames > 0 ? +((after.avgMs * after.frames - before.avgMs * before.frames) / frames).toFixed(3) : 0;
      const interactionTasks = longTasks.filter(task => task.at >= since && task.ms > 50);
      report.budget[id] = { frames, avgMs: avg, maxMs: after ? after.maxMs : 0 };
      report.longTasks[id] = { arrival: arrivalTasks.map(task => task.ms), interaction: interactionTasks.map(task => task.ms) };
      check(avg <= 6, `${id}: frame callbacks average ${avg} ms on the longest paper page (budget 6 ms)`);
      check(interactionTasks.length === 0, `${id}: no task over 50 ms while reading the longest paper page (${interactionTasks.map(t => t.ms).join(', ')} ms)`);
      escape(); await idle();
    }

    /* 6. Phone: a lens arrives on publications without horizontal overflow. */
    frame.style.width = '390px'; frame.style.height = '844px';
    for (const id of registered) {
      await load('/publications.html', id);
      await arrived(id);
      check(doc.documentElement.scrollWidth <= 391, `390x844: ${id} on publications has no horizontal overflow (${doc.documentElement.scrollWidth})`);
      escape(); await idle();
    }
  } catch (error) { failures.push(error.stack || String(error)); }
  finally {
    frame.remove();
    for (const [key, value] of Object.entries(stored)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    if (storedLens === null) sessionStorage.removeItem('lenses-active'); else sessionStorage.setItem('lenses-active', storedLens);
    if (storedGround === null) sessionStorage.removeItem('lenses-ground'); else sessionStorage.setItem('lenses-ground', storedGround);
  }
  /* 7. No uncaught errors or console.error calls. */
  assertions++;
  if (errors.length) failures.push(`Errors: ${[...new Set(errors)].slice(0, 12).join(' | ')}`);
  return { assertions, failures, ...report, warnings: [...new Set(warnings)].slice(0, 12) };
})();
