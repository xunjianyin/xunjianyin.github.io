/**
 * A playable footnote to Gödel Agent.
 * The visitor turns an instruction into a bridge. The revised local policy then
 * builds it before walking. This is a designed puzzle, not a model inference run.
 */
(() => {
  'use strict';
  const siteRoot = new URL('.', document.currentScript.src);
  const paperURL = new URL('papers/godel-agent.html', siteRoot).href;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  let active = false;

  function open() {
    if (active) return;
    const previousFocus = document.activeElement;
    const scroll = { x: scrollX, y: scrollY };
    const originalOverflow = document.body.style.getPropertyValue('overflow');
    const originalPriority = document.body.style.getPropertyPriority('overflow');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    const dialog = document.createElement('dialog');
    dialog.id = 'self-reference-lab';
    dialog.setAttribute('aria-labelledby', 'lab-title');
    dialog.setAttribute('aria-describedby', 'lab-description');
    dialog.innerHTML = `
      <div class="lab-sheet">
        <header class="lab-header">
          <span class="lab-signature">Xunjian Yin <span>/ a playable footnote</span></span>
          <button class="lab-link" data-lab-close autofocus>Back to the page <span aria-hidden="true">esc</span></button>
        </header>
        <div class="lab-intro">
          <div><p class="lab-eyebrow">An experiment in self-reference</p>
            <h2 id="lab-title">The rule is part<br>of the <em>world.</em></h2></div>
          <p id="lab-description">One agent. One gap.<br> Get it to the other side.<span>The instruction is yours to move.</span></p>
        </div>
        <div class="lab-scene" data-state="walking" role="group" aria-label="A movable instruction can bridge the gap between the agent and the paper">
          <svg class="lab-drawing" aria-hidden="true" focusable="false">
            <defs><pattern id="lab-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 7L7 0M5 9L9 5" stroke="currentColor" stroke-width=".6"/></pattern></defs>
            <g data-scenery></g>
            <path class="lab-plan" data-plan fill="none" stroke-dasharray="4 6"/>
            <g class="lab-agent" data-agent>
              <path data-leg-left d="M-9-12L-11 0H-18"/>
              <path data-leg-right d="M9-12L11 0H18"/>
              <g data-body>
                <path class="lab-agent-body" d="M-16-39H16V-12H-16Z"/>
                <path d="M-16-33L-24-22M16-33L24-22" data-arms/>
                <path class="lab-agent-head" d="M-19-65H19V-39H-19Z"/>
                <circle class="lab-eye" cx="-7" cy="-53" r="2"/><circle class="lab-eye" cx="7" cy="-53" r="2"/>
                <path d="M-4-45H4" data-mouth/>
                <path d="M0-65V-72M-3-72H3"/>
                <text x="0" y="-21" text-anchor="middle" class="lab-agent-letter">g</text>
              </g>
            </g>
            <g data-bubble class="lab-bubble"><path d="M-29-112H44V-86H8L0-77V-86H-29Z"/><text x="7" y="-95" text-anchor="middle">No path.</text></g>
          </svg>
          <div class="lab-rule-home" aria-hidden="true"><span>Its current instruction</span></div>
          <div class="lab-drop-zone" aria-hidden="true"></div>
          <button class="lab-rule" data-rule aria-label="Move the instruction. Drag it, use arrow keys, or press Enter to place it across the gap." aria-describedby="lab-rule-help">
            <span class="lab-rule-number" aria-hidden="true">01</span>
            <span class="lab-rule-text">Walk to the paper.</span>
            <span class="lab-rule-grip" aria-hidden="true">⠿</span>
          </button>
          <span class="lab-agent-version" data-agent-version aria-hidden="true">v1</span>
          <p class="lab-gap-note" aria-hidden="true">a missing step</p>
        </div>
        <div class="lab-caption-row">
          <div class="lab-caption"><span class="lab-step" data-step>01 / A fixed rule</span>
            <p data-message role="status" aria-live="polite">It can follow a path. What happens when the path ends?</p></div>
          <div class="lab-actions">
            <button class="lab-action" data-revised disabled aria-disabled="true">Run the revised agent <span aria-hidden="true">→</span></button>
            <button class="lab-link" data-reset>Start over</button>
          </div>
        </div>
        <footer class="lab-footer">
          <p>Inspired by <a href="${paperURL}">Gödel Agent <span aria-hidden="true">↗</span></a><span>A small puzzle about editing the procedure itself.</span></p>
          <p id="lab-rule-help">Drag the instruction into the gap.<span>Keyboard: Tab to the rule; Enter to place it.</span></p>
        </footer>
      </div>`;

    const scene = dialog.querySelector('.lab-scene');
    const svg = dialog.querySelector('svg');
    const rule = dialog.querySelector('[data-rule]');
    const zone = dialog.querySelector('.lab-drop-zone');
    const home = dialog.querySelector('.lab-rule-home');
    const agent = dialog.querySelector('[data-agent]');
    const bubble = dialog.querySelector('[data-bubble]');
    const version = dialog.querySelector('[data-agent-version]');
    const plan = dialog.querySelector('[data-plan]');
    const revised = dialog.querySelector('[data-revised]');
    let closed = false;
    let leaving = false;
    let raf = 0;
    let lastTime = 0;
    let time = 0;
    let closeTimer = 0;
    let resizeObserver;
    let geometry;
    let phase = 'walking';
    let bridgePlaced = false;
    let revisedPolicy = false;
    let revisedRun = false;
    let robotX = 0;
    let rulePosition = { x: 0, y: 0 };
    let drag = null;
    let settle = null;
    const on = (target, event, callback) => target.addEventListener(event, callback, { signal: events.signal });

    function message(step, text) {
      dialog.querySelector('[data-step]').textContent = step;
      dialog.querySelector('[data-message]').textContent = text;
    }

    function cleanup() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      clearTimeout(closeTimer);
      resizeObserver?.disconnect();
      events.abort();
      dialog.close();
      dialog.remove();
      if (originalOverflow) document.body.style.setProperty('overflow', originalOverflow, originalPriority);
      else document.body.style.removeProperty('overflow');
      previousFocus?.isConnected && previousFocus.focus({ preventScroll: true });
      if (scrollX !== scroll.x || scrollY !== scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      active = false;
    }

    function close() {
      if (closed || leaving) return;
      leaving = true;
      cancelAnimationFrame(raf);
      dialog.classList.add('is-leaving');
      if (motion.matches) cleanup();
      else closeTimer = setTimeout(cleanup, 220);
    }

    function setPhase(next) {
      phase = next;
      scene.dataset.state = next;
    }

    function redraw() {
      if (!geometry) return;
      const { floor, ruleWidth } = geometry;
      rule.style.transform = `translate(${rulePosition.x}px, ${rulePosition.y}px)`;
      rule.style.width = `${ruleWidth}px`;
      const walking = phase === 'walking' && !motion.matches;
      const gait = walking ? Math.sin(time * .019) : 0;
      agent.setAttribute('transform', `translate(${robotX},${floor})`);
      dialog.querySelector('[data-body]').setAttribute('transform', `translate(0,${walking ? -Math.abs(gait) * 1.5 : 0})`);
      dialog.querySelector('[data-leg-left]').setAttribute('d', `M-9-12L${-11 + gait * 5} 0H${-18 + gait * 5}`);
      dialog.querySelector('[data-leg-right]').setAttribute('d', `M9-12L${11 - gait * 5} 0H${18 - gait * 5}`);
      dialog.querySelector('[data-arms]').setAttribute('d', phase === 'blocked' ? 'M-16-33L-24-22M16-33L26-44L20-51' : 'M-16-33L-24-22M16-33L24-22');
      dialog.querySelector('[data-mouth]').setAttribute('d', phase === 'solved' ? 'M-5-46Q0-41 5-46' : 'M-4-45H4');
      bubble.setAttribute('transform', `translate(${robotX},${floor})`);
      bubble.style.opacity = phase === 'blocked' ? '1' : '0';
      version.style.transform = `translate(${robotX - 12}px,${floor + 3}px)`;
      if (phase === 'building') {
        const cx = rulePosition.x + ruleWidth / 2;
        plan.setAttribute('d', `M${robotX + 26} ${floor - 36} Q${cx - 45} ${rulePosition.y - 35} ${cx} ${rulePosition.y}`);
      } else plan.setAttribute('d', '');
    }

    function resize() {
      // Cancel an unfinished drag cleanly; the next pointer action uses fresh coordinates.
      if (drag) { if (rule.hasPointerCapture(drag.id)) rule.releasePointerCapture(drag.id); drag = null; }
      const previous = geometry;
      const { width: w, height: h } = scene.getBoundingClientRect();
      const gap = Math.min(230, w * .34);
      const left = w / 2 - gap / 2;
      const right = w / 2 + gap / 2;
      const floor = Math.round(h * .66);
      const ruleWidth = gap + 28;
      const mobile = w < 580;
      geometry = { w, h, gap, left, right, floor, ruleWidth,
        start: Math.min(95, left * .46), stop: left - 25,
        goal: Math.min(w - 60, right + (w - right) * .56),
        home: { x: (w - ruleWidth) / 2, y: mobile ? 45 : 42 },
        target: { x: left - 14, y: floor }
      };
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const platform = (x, width, title, label) => {
        const wrap = width < 140 && title === 'Gödel Agent';
        return `
        <path class="lab-paper-back" d="M${x + 5} ${floor + 7}H${x + width + 5}V${floor + 95}H${x + 5}Z"/>
        <path class="lab-paper" d="M${x} ${floor}H${x + width}V${floor + 88}H${x}Z"/>
        <path class="lab-paper-grain" d="M${x + 12} ${floor + 74}H${x + width - 12}M${x + 12} ${floor + 80}H${x + width * .70}"/>
        <text class="lab-paper-label" x="${x + 18}" y="${floor + 30}">${wrap ? `<tspan>Gödel</tspan><tspan x="${x + 18}" dy="16">Agent</tspan>` : title}</text>
        <text class="lab-paper-subtitle" x="${x + 18}" y="${floor + (wrap ? 61 : 47)}">${label}</text>`;
      };
      dialog.querySelector('[data-scenery]').innerHTML = `
        <path class="lab-world-edge" d="M0 ${floor + 103}H${w}"/>
        <path class="lab-world-ticks" d="${Array.from({ length: Math.ceil(w / 20) }, (_, i) => `M${i * 20} ${floor + 103}v${i % 5 === 0 ? 7 : 3}`).join('')}"/>
        ${platform(10, left - 10, 'An agent', 'a fixed procedure')}
        ${platform(right, w - right - 15, 'Gödel Agent', 'ACL 2025')}
        <path class="lab-goal" d="M${geometry.goal} ${floor}v-73m0 0h22l-5 10 5 10h-22"/>
        <path class="lab-start-mark" d="M${geometry.start - 25} ${floor + 1}v-6m50 6v-6"/>`;
      rule.style.height = '54px';
      Object.assign(home.style, { left: `${geometry.home.x}px`, top: `${geometry.home.y}px`, width: `${ruleWidth}px`, height: '54px' });
      Object.assign(zone.style, { left: `${left - 14}px`, top: `${floor}px`, width: `${ruleWidth}px`, height: '54px' });
      const note = dialog.querySelector('.lab-gap-note');
      Object.assign(note.style, { left: `${left}px`, top: `${floor + 67}px`, width: `${gap}px` });
      if (!previous) robotX = geometry.start;
      else if (phase === 'solved') robotX = geometry.goal;
      else if (phase === 'blocked') robotX = geometry.stop;
      else robotX = geometry.start + ((robotX - previous.start) / (previous.goal - previous.start)) * (geometry.goal - geometry.start);
      rulePosition = { ...(bridgePlaced ? geometry.target : geometry.home) };
      if (settle) settle = { from: { ...rulePosition }, to: settle.kind === 'home' ? geometry.home : geometry.target, progress: 0, kind: settle.kind };
      dialog.classList.remove('is-dragging', 'is-near');
      redraw();
      schedule();
    }

    function finish() {
      robotX = geometry.goal;
      setPhase('solved');
      revisedPolicy = true;
      rule.querySelector('.lab-rule-text').textContent = 'Build a way. Then walk.';
      rule.querySelector('.lab-rule-number').textContent = '02';
      rule.setAttribute('aria-label', 'Revised instruction: Build a way. Then walk.');
      rule.setAttribute('aria-disabled', 'true');
      revised.disabled = false;
      revised.setAttribute('aria-disabled', 'false');
      revised.innerHTML = `${revisedRun ? 'Run it once more' : 'Run the revised agent'} <span aria-hidden="true">→</span>`;
      message(revisedRun ? '03 / The edit becomes the procedure' : '02 / The rule became a bridge', revisedRun
        ? 'This time, it built the way before taking the first step.'
        : 'You changed the rule. Now see what the next run does with it.');
      dialog.classList.add('is-solved');
    }

    function bridgeReady() {
      bridgePlaced = true;
      rulePosition = { ...geometry.target };
      dialog.classList.add('has-bridge');
      dialog.classList.remove('is-near', 'is-dragging');
      rule.setAttribute('aria-disabled', 'true');
      setPhase('walking');
      message(revisedRun ? '03 / A revised procedure' : '02 / A rule you can walk on', revisedRun
        ? 'Build a way. Then walk. The revised instruction is now running.'
        : 'Its instruction is now part of the world it moves through.');
    }

    function frame(now) {
      raf = 0;
      if (closed || leaving || document.hidden) { lastTime = 0; return; }
      const dt = lastTime ? Math.min(40, now - lastTime) : 16;
      lastTime = now;
      time += dt;
      if (settle) {
        settle.progress = motion.matches ? 1 : Math.min(1, settle.progress + dt / (settle.kind === 'build' ? 1100 : 260));
        const p = ease(settle.progress);
        rulePosition = { x: settle.from.x + (settle.to.x - settle.from.x) * p, y: settle.from.y + (settle.to.y - settle.from.y) * p };
        if (settle.progress === 1) {
          const kind = settle.kind;
          settle = null;
          if (kind !== 'home') bridgeReady();
        }
      }
      if (phase === 'walking') {
        const target = bridgePlaced ? geometry.goal : geometry.stop;
        const speed = Math.max(70, geometry.w * .16);
        robotX = motion.matches ? target : Math.min(target, robotX + speed * dt / 1000);
        if (robotX >= target) {
          if (bridgePlaced) finish();
          else {
            setPhase('blocked');
            message('01 / A fixed rule', 'The path ends here. What else could its instruction do?');
          }
        }
      }
      redraw();
      if (settle || phase === 'walking' || phase === 'building') schedule();
      else lastTime = 0;
    }

    function schedule() {
      if (!raf && !closed && !leaving && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function nearGap() {
      return Math.abs(rulePosition.x - geometry.target.x) < Math.min(65, geometry.ruleWidth * .25)
        && Math.abs(rulePosition.y - geometry.target.y) < 55;
    }

    function place() {
      if (bridgePlaced || revisedRun || phase === 'solved') return;
      if (drag) {
        const id = drag.id;
        drag = null;
        if (rule.hasPointerCapture(id)) rule.releasePointerCapture(id);
      }
      settle = { from: { ...rulePosition }, to: geometry.target, progress: 0, kind: 'place' };
      dialog.classList.remove('is-dragging');
      schedule();
    }

    function reset(revisedMode = false) {
      if (drag && rule.hasPointerCapture(drag.id)) rule.releasePointerCapture(drag.id);
      drag = null;
      settle = null;
      cancelAnimationFrame(raf); raf = 0; lastTime = 0;
      bridgePlaced = false;
      revisedRun = revisedMode;
      if (!revisedMode) revisedPolicy = false;
      robotX = geometry.start;
      rulePosition = { ...geometry.home };
      dialog.classList.remove('has-bridge', 'is-solved', 'is-dragging', 'is-near');
      rule.querySelector('.lab-rule-text').textContent = revisedMode ? 'Build a way. Then walk.' : 'Walk to the paper.';
      rule.querySelector('.lab-rule-number').textContent = revisedMode ? '02' : '01';
      rule.setAttribute('aria-label', revisedMode ? 'Revised instruction: Build a way. Then walk.' : 'Move the instruction. Drag it, use arrow keys, or press Enter to place it across the gap.');
      rule.setAttribute('aria-disabled', String(revisedMode));
      version.textContent = revisedMode ? 'v2' : 'v1';
      // Keep the replay button focused during its own run; guard activation below.
      revised.disabled = !revisedMode;
      revised.setAttribute('aria-disabled', 'true');
      if (revisedMode) {
        setPhase('building');
        message('03 / Your edit, on the next run', 'First, build a way. Watch the revised rule place itself.');
        settle = { from: { ...geometry.home }, to: geometry.target, progress: 0, kind: 'build' };
      } else {
        setPhase('walking');
        message('01 / A fixed rule', 'It can follow a path. What happens when the path ends?');
      }
      redraw(); schedule();
    }

    function pointerPosition(event) {
      const rect = scene.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    on(rule, 'pointerdown', event => {
      if (event.button !== 0 || bridgePlaced || revisedRun || phase === 'solved' || drag) return;
      event.preventDefault();
      rule.focus({ preventScroll: true });
      const p = pointerPosition(event);
      settle = null;
      drag = { id: event.pointerId, x: p.x - rulePosition.x, y: p.y - rulePosition.y,
        startX: rulePosition.x, startY: rulePosition.y, moved: false };
      rule.setPointerCapture(event.pointerId);
      dialog.classList.add('is-dragging');
    });
    on(rule, 'pointermove', event => {
      if (!drag || event.pointerId !== drag.id || bridgePlaced || revisedRun || phase === 'solved') return;
      const p = pointerPosition(event);
      const x = clamp(p.x - drag.x, 0, geometry.w - geometry.ruleWidth);
      const y = clamp(p.y - drag.y, 0, geometry.h - 60);
      if (Math.hypot(x - drag.startX, y - drag.startY) > 3) drag.moved = true;
      rulePosition = { x, y };
      dialog.classList.toggle('is-near', nearGap());
      redraw();
    });
    function endDrag(event, cancelled) {
      if (!drag || event.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;
      if (rule.hasPointerCapture(event.pointerId)) rule.releasePointerCapture(event.pointerId);
      dialog.classList.remove('is-dragging', 'is-near');
      if (!cancelled && moved && nearGap()) place();
      else {
        settle = { from: { ...rulePosition }, to: geometry.home, progress: 0, kind: 'home' };
        if (!moved && !cancelled) message('01 / A movable instruction', 'Pick up the instruction and move it into the gap.');
        schedule();
      }
    }
    on(rule, 'pointerup', event => endDrag(event, false));
    on(rule, 'pointercancel', event => endDrag(event, true));
    on(rule, 'lostpointercapture', event => endDrag(event, true));
    on(rule, 'keydown', event => {
      if (bridgePlaced || revisedRun || phase === 'solved') return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); place(); }
      else if (event.key.startsWith('Arrow')) {
        event.preventDefault(); settle = null;
        const step = event.shiftKey ? 40 : 15;
        rulePosition.x = clamp(rulePosition.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), 0, geometry.w - geometry.ruleWidth);
        rulePosition.y = clamp(rulePosition.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0), 0, geometry.h - 60);
        dialog.classList.toggle('is-near', nearGap()); redraw();
      }
    });
    // Assistive technology may activate a button without generating key events.
    on(rule, 'click', event => { if (event.detail === 0) place(); });
    on(revised, 'click', () => { if (revisedPolicy && phase === 'solved') reset(true); });
    on(dialog.querySelector('[data-reset]'), 'click', () => reset());
    on(dialog.querySelector('[data-lab-close]'), 'click', close);
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup);
    on(window, 'pagehide', cleanup);
    on(document, 'visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
      else schedule();
    });
    on(motion, 'change', schedule);

    try {
      active = true;
      document.body.append(dialog);
      dialog.showModal();
      document.body.style.setProperty('overflow', 'hidden');
      dialog.querySelector('[data-lab-close]').focus({ preventScroll: true });
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(scene);
      void dialog.offsetWidth;
      dialog.classList.add('is-visible');
    } catch (error) {
      cleanup();
      console.warn('The self-reference experiment could not open.', error);
    }
  }
  window.SiteEasterEgg = { open };
})();
