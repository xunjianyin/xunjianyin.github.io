/**
 * In the margins — a small botanical discovery, opened by site-shell.js.
 * The original password and five names survive; the page itself is never rewritten.
 * No dependencies, sound, persistent state, or work while the drawing is at rest.
 */
(() => {
  'use strict';

  const NAMES = ['Furong', 'Flora', 'Furong Jia', 'Flora Jia', 'Yeye'];
  const TAU = Math.PI * 2;
  const INK = [68, 86, 66];
  const GOLD = [155, 115, 62];
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  let active = null;

  function open() {
    if (active) return;
    const previousFocus = document.activeElement;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const overflow = document.body.style.getPropertyValue('overflow');
    const overflowPriority = document.body.style.getPropertyPriority('overflow');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listeners = new AbortController();
    const dialog = document.createElement('dialog');
    dialog.id = 'secret-garden';
    dialog.setAttribute('aria-labelledby', 'garden-title');
    dialog.setAttribute('aria-describedby', 'garden-description');
    dialog.innerHTML = `
      <div class="garden-sheet">
        <header class="garden-header">
          <p class="garden-eyebrow"><span>XY / 00</span> In the margins</p>
          <button class="garden-text-button" data-garden-close autofocus>Back to the page<span class="garden-escape" aria-hidden="true">esc</span></button>
        </header>
        <div class="garden-stage">
          <canvas class="garden-canvas" aria-hidden="true"></canvas>
          <div class="garden-copy">
            <p class="garden-kicker">You found a quiet corner.</p>
            <h2 id="garden-title" class="garden-title">A little<br> <em>serendipity.</em></h2>
            <p id="garden-description" class="garden-description">A flower, a few familiar names.<br>A small thing, just for the curious.</p>
          </div>
          <div class="garden-note">
            <p class="garden-index" data-garden-index>A note in the margins</p>
            <p class="garden-name" data-garden-name>Look a little closer.</p>
            <p class="garden-note-caption" data-garden-caption>Five petals. Five familiar names.</p>
          </div>
          ${NAMES.map((_, i) => `<button class="garden-seed" data-petal="${i}" aria-label="Discover name ${i + 1} of 5" aria-pressed="false"><span class="garden-seed-label" aria-hidden="true">0${i + 1}</span></button>`).join('')}
          <div class="garden-plate-label"><span class="garden-index">Fig. 01 / A small discovery</span><p>For the things between the lines.</p></div>
        </div>
        <footer class="garden-footer">
          <p class="garden-instruction">Touch a point. Find a name.<span>Or use Tab, then Enter.</span></p>
          <button class="garden-text-button" data-garden-replay>Let it bloom again <span aria-hidden="true">↗</span></button>
        </footer>
        <p class="garden-sr-only" role="status" aria-live="polite" data-garden-status></p>
      </div>`;

    const stage = dialog.querySelector('.garden-stage');
    const canvas = dialog.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const seeds = [...dialog.querySelectorAll('.garden-seed')];
    const visited = new Set();
    let observer;
    let raf = 0;
    let closeTimer = 0;
    let closed = false;
    let leaving = false;
    let selected = -1;
    let hovered = -1;
    let width = 0;
    let height = 0;
    let radius = 0;
    let center = { x: 0, y: 0 };
    let elapsed = motion.matches ? 6000 : 0;
    let lastTime = 0;
    let pulse = 0;
    let drift = { x: 0, y: 0 };
    let pointer = { x: 0, y: 0 };
    let geometry = [];
    let anchors = [];

    const on = (target, event, callback) => target.addEventListener(event, callback, { signal: listeners.signal });
    const announce = text => { dialog.querySelector('[data-garden-status]').textContent = text; };

    function cleanup() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      clearTimeout(closeTimer);
      observer?.disconnect();
      listeners.abort();
      dialog.close();
      dialog.remove();
      if (overflow) document.body.style.setProperty('overflow', overflow, overflowPriority);
      else document.body.style.removeProperty('overflow');
      active = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      if (window.scrollX !== scroll.x || window.scrollY !== scroll.y) {
        window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      }
    }

    function close() {
      if (leaving || closed) return;
      leaving = true;
      cancelAnimationFrame(raf);
      dialog.classList.add('is-leaving');
      if (motion.matches) cleanup();
      else closeTimer = window.setTimeout(cleanup, 260);
    }

    // Each petal is a family of asymmetric contour lines, not a stock flower image.
    // Paths are cached after resize; animation only reveals their existing points.
    function petalPoint(petal, strand, t) {
      const angle = -Math.PI / 2 + petal * TAU / 5;
      const spread = Math.sin(Math.PI * t);
      const length = .82 + .18 * Math.sin(strand * Math.PI);
      const reach = .07 + Math.pow(spread, .87) * length;
      const side = Math.sin(TAU * t) * Math.pow(spread, .35) * (.19 + .19 * strand);
      const bend = .065 * Math.sin(Math.PI * t) * Math.sin(strand * 3 + petal);
      const x = side + bend;
      const y = reach;
      return {
        x: center.x + radius * (Math.cos(angle) * y - Math.sin(angle) * x),
        y: center.y + radius * (Math.sin(angle) * y + Math.cos(angle) * x)
      };
    }

    function resize() {
      const rect = stage.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const mobile = window.innerWidth <= 700;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const copy = dialog.querySelector('.garden-copy').getBoundingClientRect();
      const note = dialog.querySelector('.garden-note').getBoundingClientRect();
      if (mobile) {
        // Fit between the actual text blocks, including wrapped titles and large text.
        const top = copy.bottom - rect.top + 28;
        const bottom = note.top - rect.top - 28;
        center = { x: width * .5, y: (top + bottom) / 2 };
        radius = Math.max(20, Math.min(width * .43, (bottom - top) / 2.2));
      } else {
        const left = copy.right - rect.left + 24;
        const right = width - 26;
        center = { x: (left + right) / 2, y: height * .49 };
        radius = Math.min((right - left) / 2.3, height * .40, 350);
      }
      geometry = NAMES.map((_, petal) => Array.from({ length: 19 }, (_, strand) =>
        Array.from({ length: 121 }, (_, step) => petalPoint(petal, strand / 18, step / 120))));
      anchors = NAMES.map((_, petal) => petalPoint(petal, .52, .5));
      seeds.forEach((seed, i) => {
        seed.style.left = `${anchors[i].x}px`;
        seed.style.top = `${anchors[i].y}px`;
      });
      schedule();
    }

    function color(rgb, alpha) { return `rgba(${rgb.join(',')},${clamp(alpha)})`; }

    function stroke(points, progress, rgb, alpha, lineWidth) {
      const last = Math.floor((points.length - 1) * clamp(progress));
      if (last < 1) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i <= last; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color(rgb, alpha);
      ctx.stroke();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const formation = ease((elapsed - 200) / 4400);
      const focus = hovered >= 0 ? hovered : selected;
      const breathe = motion.matches ? 0 : Math.sin(elapsed / 1050) * (1 - formation) * .018;
      ctx.save();
      ctx.translate(center.x + drift.x, center.y + drift.y);
      ctx.scale(.97 + formation * .03 + breathe, .97 + formation * .03 + breathe);
      ctx.translate(-center.x, -center.y);

      // A faint drafting circle and its divisions give the drawing a plate-like structure.
      const guide = ease(elapsed / 1000) * .16;
      ctx.strokeStyle = color(INK, guide);
      ctx.lineWidth = .6;
      ctx.setLineDash([1, 7]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 1.08, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 40; i++) {
        const angle = i * TAU / 40;
        const inner = radius * (i % 8 === 0 ? 1.115 : 1.13);
        ctx.beginPath();
        ctx.moveTo(center.x + Math.cos(angle) * inner, center.y + Math.sin(angle) * inner);
        ctx.lineTo(center.x + Math.cos(angle) * radius * 1.145, center.y + Math.sin(angle) * radius * 1.145);
        ctx.stroke();
      }

      geometry.forEach((strands, petal) => {
        const highlighted = focus === petal;
        const rgb = highlighted ? GOLD : INK;
        strands.forEach((points, strand) => {
          const progress = ease((elapsed - 300 - petal * 110 - strand * 24) / 3300);
          const opacity = (strand % 4 === 0 ? .42 : .18) * (focus < 0 || highlighted ? 1 : .6);
          stroke(points, progress, rgb, opacity, highlighted && strand % 4 === 0 ? .95 : .65);
          // Traveling pinpricks gather into the ink, and disappear when the flower settles.
          if (progress > 0 && progress < 1 && strand % 4 === 0) {
            const point = points[Math.floor(progress * 120)];
            ctx.fillStyle = color(GOLD, Math.sin(progress * Math.PI) * .65);
            ctx.beginPath(); ctx.arc(point.x, point.y, 1.1, 0, TAU); ctx.fill();
          }
        });
      });

      // Fibonacci phyllotaxis: the same ordering found in seed heads.
      for (let i = 0; i < 85; i++) {
        const theta = i * Math.PI * (3 - Math.sqrt(5));
        const r = Math.sqrt(i / 85) * radius * .105;
        const visible = ease((elapsed - 700 - i * 10) / 1100);
        ctx.fillStyle = color(i % 3 === 0 ? GOLD : INK, visible * .6);
        ctx.beginPath();
        ctx.arc(center.x + Math.cos(theta) * r, center.y + Math.sin(theta) * r, i < 10 ? 1.2 : .85, 0, TAU);
        ctx.fill();
      }

      if (pulse > 0 && selected >= 0 && !motion.matches) {
        const point = anchors[selected];
        const age = 1 - pulse;
        for (let i = 0; i < 12; i++) {
          const theta = i * TAU / 12;
          const r = 5 + age * 30;
          ctx.fillStyle = color(GOLD, pulse * .5);
          ctx.beginPath();
          ctx.arc(point.x + Math.cos(theta) * r, point.y + Math.sin(theta) * r, .8, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function frame(now) {
      raf = 0;
      if (closed || leaving || document.hidden) { lastTime = 0; return; }
      const dt = lastTime ? Math.min(50, now - lastTime) : 16;
      lastTime = now;
      elapsed = motion.matches ? 6000 : Math.min(6000, elapsed + dt);
      pulse = Math.max(0, pulse - dt / 900);
      const follow = 1 - Math.exp(-dt / 110);
      drift.x += (pointer.x - drift.x) * follow;
      drift.y += (pointer.y - drift.y) * follow;
      if (elapsed >= 4400) dialog.classList.add('is-bloomed');
      try { draw(); } catch (error) { cleanup(); console.warn('The garden could not be drawn.', error); return; }
      if (elapsed < 6000 || pulse > 0 || Math.abs(drift.x - pointer.x) + Math.abs(drift.y - pointer.y) > .03) schedule();
      else lastTime = 0;
    }

    function schedule() {
      if (!raf && !closed && !leaving && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function reveal(index, commit) {
      hovered = index;
      const name = NAMES[index];
      dialog.querySelector('[data-garden-index]').textContent = `Petal 0${index + 1} / 05`;
      dialog.querySelector('[data-garden-name]').textContent = name;
      dialog.querySelector('[data-garden-caption]').textContent = 'A name tucked between the lines.';
      if (commit) {
        selected = index;
        visited.add(index);
        pulse = motion.matches ? 0 : 1;
        seeds.forEach((seed, i) => seed.setAttribute('aria-pressed', String(i === index)));
        announce(`${name}. ${visited.size} of 5 names discovered.`);
        if (visited.size === 5) {
          dialog.querySelector('[data-garden-caption]').textContent = 'Every name has found its place.';
          announce(`${name}. All five names discovered: ${NAMES.join(', ')}.`);
        }
      }
      seeds[index].setAttribute('aria-label', `${name}, petal ${index + 1} of 5`);
      schedule();
    }

    function resetHover() {
      hovered = -1;
      if (selected >= 0) {
        dialog.querySelector('[data-garden-index]').textContent = `Petal 0${selected + 1} / 05`;
        dialog.querySelector('[data-garden-name]').textContent = NAMES[selected];
        dialog.querySelector('[data-garden-caption]').textContent = visited.size === 5
          ? 'Every name has found its place.' : 'A name tucked between the lines.';
      } else {
        dialog.querySelector('[data-garden-index]').textContent = 'A note in the margins';
        dialog.querySelector('[data-garden-name]').textContent = 'Look a little closer.';
        dialog.querySelector('[data-garden-caption]').textContent = 'Five petals. Five familiar names.';
      }
      schedule();
    }

    on(dialog.querySelector('[data-garden-close]'), 'click', close);
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup);
    on(window, 'pagehide', cleanup);
    on(document, 'visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
      else schedule();
    });
    on(motion, 'change', () => {
      if (motion.matches) { elapsed = 6000; drift = { x: 0, y: 0 }; pointer = { x: 0, y: 0 }; pulse = 0; }
      schedule();
    });
    on(dialog.querySelector('[data-garden-replay]'), 'click', () => {
      elapsed = motion.matches ? 6000 : 0;
      lastTime = 0;
      selected = -1;
      hovered = -1;
      pulse = 0;
      visited.clear();
      pointer = { x: 0, y: 0 };
      dialog.classList.remove('is-bloomed');
      seeds.forEach((seed, i) => {
        seed.setAttribute('aria-pressed', 'false');
        seed.setAttribute('aria-label', `Discover name ${i + 1} of 5`);
      });
      dialog.querySelector('[data-garden-index]').textContent = 'A note in the margins';
      dialog.querySelector('[data-garden-name]').textContent = 'Look a little closer.';
      dialog.querySelector('[data-garden-caption]').textContent = 'Five petals. Five familiar names.';
      announce(motion.matches ? 'Flower ready. Five names to discover.' : 'The flower is drawing again.');
      schedule();
    });
    seeds.forEach((seed, i) => {
      on(seed, 'pointerenter', event => { if (event.pointerType !== 'touch') reveal(i, false); });
      on(seed, 'pointerleave', resetHover);
      on(seed, 'focus', () => reveal(i, false));
      on(seed, 'blur', resetHover);
      on(seed, 'click', () => reveal(i, true));
    });
    on(stage, 'pointermove', event => {
      if (motion.matches || event.pointerType !== 'mouse') return;
      const rect = stage.getBoundingClientRect();
      pointer = { x: ((event.clientX - rect.left) / width - .5) * 5, y: ((event.clientY - rect.top) / height - .5) * 5 };
      schedule();
    });
    on(stage, 'pointerleave', () => { pointer = { x: 0, y: 0 }; schedule(); });

    active = { close };
    try {
      document.body.append(dialog);
      dialog.showModal();
      document.body.style.setProperty('overflow', 'hidden');
      dialog.querySelector('[data-garden-close]').focus({ preventScroll: true });
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(stage);
      // Commit the initial opacity before the opening transition.
      void dialog.offsetWidth;
      dialog.classList.add('is-visible');
    } catch (error) {
      cleanup();
      console.warn('The garden could not be opened.', error);
    }
  }

  window.SiteEasterEgg = { open };
})();
