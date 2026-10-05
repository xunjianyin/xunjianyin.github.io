/**
 * An unfinished atlas of Xunjian Yin's research.
 * Curated thematic connections, not a similarity embedding or a citation graph.
 * Joining two threads exposes an authored open question; no inference is implied.
 */
(() => {
  'use strict';
  const ROOT = new URL('.', document.currentScript.src);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const THREADS = [
    { name: 'Knowledge', question: 'What can a model know—and revise?', description: 'New facts, changing facts, and the boundary between stored knowledge and usable knowledge.', slugs: ['knowledge-boundary', 'alcuna', 'history-matters', 'mc-mke'] },
    { name: 'Reasoning', question: 'How can reasoning go beyond familiar cases?', description: 'Composing skills, examining reasoning geometry, and rethinking the direction and order of language generation.', slugs: ['atomic-to-composite', 'geometry-of-reasoning', 'reverse-lm', 'coral'] },
    { name: 'Evaluation', question: 'How do we know what works—and what fails?', description: 'Evaluation, error analysis, preference consistency, and adversarial testing make different failure modes visible.', slugs: ['themis', 'nlg-evaluation-survey', 'dsgram', 'context-aware-evaluation', 'seq2seq-data2text', 'damon', 'contrasolver'] },
    { name: 'Self-improvement', question: 'Can experience change the learner?', description: 'Editable procedures, reusable memories, and learned rewards explore different ways to improve an agent.', slugs: ['godel-agent', 'chemagent', 'derl'] },
    { name: 'Grounding', question: 'How does reasoning stay connected to evidence?', description: 'Context, retrieval, and multimodal information connect language systems to evidence beyond their parameters.', slugs: ['knowledge-interplay', 'self-generated-documents', 'error-robust-retrieval', 'contextual-asr', 'eama'] }
  ];
  const QUESTIONS = {
    '0-1': ['How can new knowledge become a new ability?', 'Knowing more and being able to do more are different. Their intersection asks how a model can compose newly acquired information into unfamiliar solutions.'],
    '0-2': ['How do we measure what a model could know?', 'An incorrect answer can reflect missing knowledge or a failure to elicit it. What would an evaluation of the underlying capability look like?'],
    '0-3': ['How can an agent change without forgetting?', 'A useful update should expand capability while preserving what already works. This connects knowledge revision with stable, continuing self-improvement.'],
    '0-4': ['How should a model update when the world changes?', 'Evidence changes over time. A growing model needs to integrate new information while retaining the context in which an earlier answer was true.'],
    '1-2': ['Can we distinguish better reasoning from better-looking answers?', 'A convincing answer is not sufficient evidence of a reliable process. Progress needs tests that survive new tasks, contexts, and incentives.'],
    '1-3': ['Can a learner improve how it learns to reason?', 'Improving an answer is one step. Revising the procedure that discovers and checks better reasoning opens a larger design space.'],
    '1-4': ['Can an agent predict what its actions will change?', 'Connecting reasoning to evidence raises a further question: how could a world model support planning, intervention, and correction?'],
    '2-3': ['Who evaluates an agent that can rewrite its evaluator?', 'When both the solver and the improvement procedure can change, a reliable measure of progress becomes part of the research problem.'],
    '2-4': ['What counts as progress outside a benchmark?', 'Useful behavior must remain grounded when contexts and goals change. How should evaluation follow an agent into an unfamiliar environment?'],
    '3-4': ['Can experience become lasting capability?', 'A long-running agent encounters more than fits in context. How can useful experience become changes to its own problem-solving machinery?']
  };
  // Snapshot of the linked paper pages; the browser check verifies title/coverage.
  const PAPERS = [
  {
    "slug": "alcuna",
    "name": "ALCUNA",
    "title": "ALCUNA: Large Language Models Meet New Knowledge",
    "venue": "EMNLP 2023"
  },
  {
    "slug": "atomic-to-composite",
    "name": "Atomic to Composite",
    "title": "From Atomic to Composite: Reinforcement Learning Enables Generalization in Complementary Reasoning",
    "venue": "arXiv preprint 2025"
  },
  {
    "slug": "chemagent",
    "name": "ChemAgent",
    "title": "ChemAgent: Self-updating Library in Large Language Models Improves Chemical Reasoning",
    "venue": "ICLR 2025"
  },
  {
    "slug": "context-aware-evaluation",
    "name": "Cont-COMET",
    "title": "Exploring Context-Aware Evaluation Metrics for Machine Translation",
    "venue": "EMNLP 2023 Findings"
  },
  {
    "slug": "contextual-asr",
    "name": "Contextual ASR Correction",
    "title": "Contextual Modeling for Document-level ASR Error Correction",
    "venue": "LREC-COLING 2024"
  },
  {
    "slug": "contrasolver",
    "name": "ContraSolver",
    "title": "ContraSolver: Self-Alignment of Language Models by Resolving Internal Preference Contradictions",
    "venue": "arXiv preprint 2024"
  },
  {
    "slug": "coral",
    "name": "COrAL",
    "title": "COrAL: Order-Agnostic Language Modeling for Efficient Iterative Refinement",
    "venue": "arXiv preprint 2024"
  },
  {
    "slug": "damon",
    "name": "DAMON",
    "title": "DAMON: A Dialogue-Aware MCTS Framework for Jailbreaking Large Language Models",
    "venue": "EMNLP 2025"
  },
  {
    "slug": "derl",
    "name": "DERL",
    "title": "Differentiable Evolutionary Reinforcement Learning",
    "venue": "arXiv preprint 2025"
  },
  {
    "slug": "dsgram",
    "name": "DSGram",
    "title": "DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models",
    "venue": "AAAI 2025"
  },
  {
    "slug": "eama",
    "name": "EAMA",
    "title": "EAMA: Entity-Aware Multimodal Alignment Based Approach for News Image Captioning",
    "venue": "TOMM 2026"
  },
  {
    "slug": "error-robust-retrieval",
    "name": "RERIC",
    "title": "Error-Robust Retrieval for Chinese Spelling Check",
    "venue": "LREC-COLING 2024"
  },
  {
    "slug": "geometry-of-reasoning",
    "name": "The Geometry of Reasoning",
    "title": "The Geometry of Reasoning: Flowing Logics in Representation Space",
    "venue": "ICLR 2026"
  },
  {
    "slug": "godel-agent",
    "name": "Gödel Agent",
    "title": "Gödel Agent: A Self-Referential Agent Framework for Recursively Self-Improvement",
    "venue": "ACL 2025 · Main Conference"
  },
  {
    "slug": "history-matters",
    "name": "History Matters",
    "title": "History Matters: Temporal Knowledge Editing in Large Language Model",
    "venue": "AAAI 2024"
  },
  {
    "slug": "knowledge-boundary",
    "name": "Knowledge Boundary",
    "title": "Benchmarking Knowledge Boundary for Large Language Models: A Different Perspective on Model Evaluation",
    "venue": "ACL 2024 · Main Conference"
  },
  {
    "slug": "knowledge-interplay",
    "name": "EchoQA",
    "title": "Understanding the Interplay between Parametric and Contextual Knowledge for Large Language Models",
    "venue": "KnowLM Workshop @ ACL 2025"
  },
  {
    "slug": "mc-mke",
    "name": "MC-MKE",
    "title": "MC-MKE: A Fine-Grained Multimodal Knowledge Editing Benchmark Emphasizing Modality Consistency",
    "venue": "ACL 2025 Findings"
  },
  {
    "slug": "nlg-evaluation-survey",
    "name": "LLMs as Evaluators",
    "title": "LLM-based NLG Evaluation: Current Status and Challenges",
    "venue": "Computational Linguistics 2025"
  },
  {
    "slug": "reverse-lm",
    "name": "LEDOM",
    "title": "LEDOM: Reverse Language Model",
    "venue": "ACL 2026"
  },
  {
    "slug": "self-generated-documents",
    "name": "Self-Generated Documents",
    "title": "Evaluating Self-Generated Documents for Enhancing Retrieval-Augmented Generation with Large Language Models",
    "venue": "NAACL 2025 Findings"
  },
  {
    "slug": "seq2seq-data2text",
    "name": "Evaluating Data-to-Text",
    "title": "How Do Seq2Seq Models Perform on End-to-End Data-to-Text Generation?",
    "venue": "ACL 2022"
  },
  {
    "slug": "themis",
    "name": "Themis",
    "title": "Themis: A Reference-free NLG Evaluation Language Model with Flexibility and Interpretability",
    "venue": "EMNLP 2024"
  }
];
  let active = false;

  function open() {
    if (active) return;
    const previousFocus = document.activeElement;
    const originalScroll = { x: scrollX, y: scrollY };
    const overflow = document.body.style.getPropertyValue('overflow');
    const overflowPriority = document.body.style.getPropertyPriority('overflow');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    // Borrow starting positions from the visible website, without changing its DOM.
    const origins = [...document.querySelectorAll('.papertitle, .homepage-section h2, .profile-text .name')]
      .map(el => el.getBoundingClientRect()).filter(r => r.bottom > 0 && r.top < innerHeight)
      .map(r => ({ x: r.x + Math.min(r.width / 2, 180), y: r.y + r.height / 2 }));
    const dialog = document.createElement('dialog');
    dialog.id = 'research-atlas';
    dialog.setAttribute('aria-labelledby', 'atlas-title');
    dialog.setAttribute('aria-describedby', 'atlas-description');
    dialog.innerHTML = `
      <div class="atlas-sheet">
        <header class="atlas-header">
          <span class="atlas-signature">Xunjian Yin <span>/ an unfinished atlas</span></span>
          <button class="atlas-text-button" data-close autofocus>Back to the page <span aria-hidden="true">esc</span></button>
        </header>
        <div class="atlas-intro">
          <div><p class="atlas-eyebrow">A research direction, in five questions</p>
            <h2 id="atlas-title">How can intelligence<br><em>keep growing?</em></h2></div>
          <p id="atlas-description">Choose two threads.<br> Explore the question between them.<span>Drag the map to turn it.</span></p>
        </div>
        <div class="atlas-stage" tabindex="0" role="group" aria-label="Interactive research atlas. Drag to rotate, or use arrow keys. Choose up to two research threads using the buttons.">
          <canvas aria-hidden="true"></canvas>
          ${THREADS.map((t, i) => `<button class="atlas-thread" data-thread="${i}" aria-label="${t.name}: ${t.question}" aria-pressed="false"><span class="atlas-thread-number">0${i + 1}</span><span class="atlas-thread-name">${t.name}</span><span class="atlas-thread-count">${t.slugs.length} works</span></button>`).join('')}
          <span class="atlas-frontier-label" aria-hidden="true">The next question</span>
          <div class="atlas-coordinate" aria-hidden="true"><span>23 works · 5 threads</span><span data-coordinates>A shared, unfinished horizon</span></div>
        </div>
        <div class="atlas-toolbar">
          <p data-selection-hint>Choose a thread, then another.</p>
          <div><button class="atlas-text-button" data-horizon aria-pressed="false">Step back <span aria-hidden="true">↗</span></button><button class="atlas-text-button" data-reset>Reset the map</button></div>
        </div>
        <section class="atlas-readout" aria-labelledby="atlas-question">
          <div><p class="atlas-eyebrow" data-readout-label>The larger pursuit</p><h3 id="atlas-question">From what a model knows<br>to what it can become.</h3></div>
          <div class="atlas-reading"><p data-readout-text>My work spans knowledge, reasoning, evaluation, and self-improving agents. This map asks how those pieces might come together in systems that keep learning in a changing world.</p><a data-readout-link href="${new URL('blogs/agents-that-learn-after-deployment.html', ROOT).href}">Read the research direction <span aria-hidden="true">↗</span></a></div>
        </section>
        <details class="atlas-works" id="atlas-works"><summary><span data-works-summary>The work behind the map</span><span data-works-count>23 papers</span></summary><div class="atlas-work-list"></div></details>
        <footer class="atlas-footer"><p>A thematic map of my research. Connections are editorial.</p><p>World models · Long-horizon adaptation · Open-ended learning<br><span>Open directions, with room for the next question.</span></p></footer>
        <p class="atlas-sr-only" role="status" aria-live="polite" data-status></p>
      </div>`;

    const stage = dialog.querySelector('.atlas-stage');
    const canvas = dialog.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const buttons = [...dialog.querySelectorAll('[data-thread]')];
    let selected = [];
    let selectedPaper = null;
    let hoverPaper = null;
    let frontier = false;
    let expansion = 0;
    let intro = motion.matches ? 1 : 0;
    let yaw = -.3;
    let pitch = -.22;
    let velocity = { x: 0, y: 0 };
    let drag = null;
    let closed = false;
    let leaving = false;
    let raf = 0;
    let lastFrame = 0;
    let closeTimer = 0;
    let observer;
    let width = 0;
    let height = 0;
    let radius = 0;
    let center = { x: 0, y: 0 };
    let projected = [];
    let anchors = [];
    let launchPoints = [];
    let pairAmount = 0;
    const on = (target, event, fn) => target.addEventListener(event, fn, { signal: events.signal });
    const rootLink = dialog.querySelector('[data-readout-link]');
    const essayURL = new URL('blogs/agents-that-learn-after-deployment.html', ROOT).href;
    const announce = text => { dialog.querySelector('[data-status]').textContent = text; };
    const bySlug = new Map(PAPERS.map(p => [p.slug, p]));
    const pointSet = THREADS.flatMap((t, group) => t.slugs.map((slug, i) => ({
      ...bySlug.get(slug), group, angle: -.55 + i * TAU / t.slugs.length + group * .36
    })));

    function cleanup() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      clearTimeout(closeTimer);
      observer?.disconnect(); events.abort();
      dialog.close(); dialog.remove();
      if (overflow) document.body.style.setProperty('overflow', overflow, overflowPriority);
      else document.body.style.removeProperty('overflow');
      previousFocus?.isConnected && previousFocus.focus({ preventScroll: true });
      if (scrollX !== originalScroll.x || scrollY !== originalScroll.y) window.scrollTo({ left: originalScroll.x, top: originalScroll.y, behavior: 'instant' });
      active = false;
    }
    function close() {
      if (closed || leaving) return;
      leaving = true; cancelAnimationFrame(raf);
      dialog.classList.add('is-leaving');
      if (motion.matches) cleanup(); else closeTimer = setTimeout(cleanup, 240);
    }

    function showWorks() {
      const groups = selected.length ? selected : THREADS.map((_, i) => i);
      const list = dialog.querySelector('.atlas-work-list');
      list.replaceChildren();
      let count = 0;
      for (const group of groups) {
        const section = document.createElement('section');
        const heading = document.createElement('h4'); heading.textContent = THREADS[group].name;
        section.append(heading);
        const ul = document.createElement('ul');
        for (const slug of THREADS[group].slugs) {
          const paper = bySlug.get(slug);
          const li = document.createElement('li'); const a = document.createElement('a');
          a.href = new URL(`papers/${slug}.html`, ROOT).href; a.textContent = paper.title;
          const venue = document.createElement('span'); venue.textContent = paper.venue;
          li.append(a, venue); ul.append(li); count++;
        }
        section.append(ul); list.append(section);
      }
      dialog.querySelector('[data-works-summary]').textContent = selected.length ? 'The work behind these threads' : 'The work behind the map';
      dialog.querySelector('[data-works-count]').textContent = `${count} papers`;
    }

    function updateReading() {
      let label; let title; let description;
      rootLink.href = essayURL; rootLink.textContent = 'Read the research direction ↗';
      if (selectedPaper) {
        label = `${THREADS[selectedPaper.group].name} / ${selectedPaper.venue}`;
        title = selectedPaper.title; description = 'One piece of a wider research thread. Open the paper page for its question, method, evidence, and limits.';
        rootLink.href = new URL(`papers/${selectedPaper.slug}.html`, ROOT).href;
        rootLink.textContent = 'Explore this paper ↗';
      } else if (frontier) {
        label = 'The open horizon'; title = 'From solving a task to learning across a lifetime.';
        description = 'World models, stable self-modification, and choosing what to learn next open a longer-horizon agenda. Existing results are starting points; the larger system is still an open research direction.';
      } else if (selected.length === 2) {
        const pair = [...selected].sort((a, b) => a - b);
        [title, description] = QUESTIONS[pair.join('-')];
        label = `Open question / ${THREADS[pair[0]].name} × ${THREADS[pair[1]].name}`;
      } else if (selected.length === 1) {
        const thread = THREADS[selected[0]];
        label = `Research thread / ${thread.name}`; title = thread.question; description = thread.description;
        rootLink.textContent = 'Explore the papers in this thread ↓';
        rootLink.href = '#atlas-works';
      } else {
        label = 'The larger pursuit'; title = 'From what a model knows to what it can become.';
        description = 'My work spans knowledge, reasoning, evaluation, and self-improving agents. This map asks how those pieces might come together in systems that keep learning in a changing world.';
      }
      dialog.querySelector('[data-readout-label]').textContent = label;
      dialog.querySelector('#atlas-question').textContent = title;
      dialog.querySelector('[data-readout-text]').textContent = description;
      dialog.querySelector('[data-selection-hint]').textContent = frontier ? 'The work continues beyond the map.' : selected.length === 2
        ? 'Two threads. A larger, open question.' : selected.length === 1
          ? 'Now choose another thread to connect it.' : 'Choose a thread, then another.';
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(selected.includes(i))));
      dialog.dataset.selection = selected.join('-');
      dialog.classList.toggle('has-pair', selected.length === 2);
      dialog.classList.toggle('is-frontier', frontier);
      announce(`${label}. ${title}`);
      schedule();
    }

    function selectThread(index) {
      selectedPaper = null; hoverPaper = null;
      if (selected.includes(index)) selected = selected.filter(i => i !== index);
      else selected = [...selected.slice(-1), index];
      velocity = { x: 0, y: 0 };
      showWorks(); updateReading();
    }

    function resize() {
      if (drag && stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id);
      drag = null;
      stage.classList.remove('is-dragging');
      velocity = { x: 0, y: 0 };
      const rect = stage.getBoundingClientRect();
      width = rect.width; height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const small = width < 620;
      center = { x: width * .5, y: height * (small ? .49 : .52) };
      radius = Math.min(width * (small ? .31 : .26), height * .37);
      const layout = small ? [[.22,.18],[.79,.18],[.81,.72],[.50,.92],[.18,.72]] : [[.22,.20],[.78,.20],[.85,.70],[.50,.91],[.15,.70]];
      anchors = buttons.map((button, i) => {
        const w = small ? 122 : 174;
        const x = clamp(width * layout[i][0] - w / 2, 0, width - w);
        const y = clamp(height * layout[i][1] - 25, 0, height - 55);
        button.style.width = `${w}px`; button.style.left = `${x}px`; button.style.top = `${y}px`;
        return { x: x + w / 2, y: y + 20 };
      });
      const frontierLabel = dialog.querySelector('.atlas-frontier-label');
      frontierLabel.style.left = `${center.x}px`;
      frontierLabel.style.top = `${small ? 8 : center.y - radius * 1.30 - 27}px`;
      launchPoints = pointSet.map((_, i) => {
        const point = origins[i % (origins.length || 1)];
        return point ? { x: clamp(point.x - rect.left, 0, width), y: clamp(point.y - rect.top, -30, height) }
          : { x: width * .5 + (i % 5 - 2) * 48, y: height * .5 + Math.floor(i / 5) * 15 };
      });
      schedule();
    }

    function project(point) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x = point.x * cy + point.z * sy;
      const z = -point.x * sy + point.z * cy;
      const y = point.y * cp - z * sp;
      const zz = point.y * sp + z * cp;
      const scale = 3.9 / (3.9 - zz);
      const r = radius * (1 - expansion * .16);
      return { x: center.x + x * r * scale, y: center.y + y * r * scale, z: zz, scale };
    }
    function ringPoint(group, t, r = 1) {
      const inclination = .38 + group * .54;
      const rotation = group * .82 - .4;
      const x = Math.cos(t), y = Math.sin(t) * Math.cos(inclination), z = Math.sin(t) * Math.sin(inclination);
      return { x: (x * Math.cos(rotation) - y * Math.sin(rotation)) * r,
        y: (x * Math.sin(rotation) + y * Math.cos(rotation)) * r, z: z * r };
    }
    function ink(alpha, blue = false) { return blue ? `rgba(0,89,160,${alpha})` : `rgba(70,90,80,${alpha})`; }
    function curve(a, b, amount, blue, dashed = false) {
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(a.x, a.y - radius * .40, b.x + (a.x - b.x) * .20, b.y, b.x, b.y);
      ctx.strokeStyle = ink(amount, blue); ctx.lineWidth = blue ? 1.1 : .65;
      ctx.setLineDash(dashed ? [3, 7] : []); ctx.stroke(); ctx.setLineDash([]);
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const reveal = smooth(intro);
      const small = width < 620;
      // A finite field of known work and an intentionally unfilled outer boundary.
      const boundary = radius * (1.28 + expansion * .25);
      ctx.strokeStyle = ink(.15 * reveal); ctx.lineWidth = .65; ctx.setLineDash([2, 7]);
      ctx.beginPath(); ctx.ellipse(center.x, center.y, boundary, boundary * .91, -.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 48; i++) {
        const a = i * TAU / 48;
        const r1 = boundary * (i % 4 ? 1.035 : 1.025), r2 = boundary * 1.055;
        ctx.beginPath(); ctx.moveTo(center.x + Math.cos(a) * r1, center.y + Math.sin(a) * r1 * .91);
        ctx.lineTo(center.x + Math.cos(a) * r2, center.y + Math.sin(a) * r2 * .91); ctx.stroke();
      }
      // Three neighbouring traces on each plane give a precise, etched appearance.
      for (let group = 0; group < THREADS.length; group++) {
        const chosen = selected.includes(group);
        for (const r of [.976, 1, 1.024]) {
          for (let i = 0; i < 96; i++) {
            const a = project(ringPoint(group, i * TAU / 96, r));
            const b = project(ringPoint(group, (i + 1) * TAU / 96, r));
            const depth = (a.z + 1.3) / 2.6;
            const dim = selected.length && !chosen ? .34 : 1;
            ctx.strokeStyle = ink((.13 + depth * .34) * reveal * dim * (r === 1 ? 1 : .36), chosen);
            ctx.lineWidth = chosen && r === 1 ? 1.05 : .75;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const contact = project(ringPoint(group, group * .7 - 1));
        curve(anchors[group], contact, reveal * (chosen ? .48 : .15), chosen);
      }
      projected = pointSet.map((paper, i) => {
        const p = project(ringPoint(paper.group, paper.angle));
        const from = launchPoints[i] || center;
        return { ...paper, ...p, x: from.x + (p.x - from.x) * reveal, y: from.y + (p.y - from.y) * reveal };
      });
      const labelRects = buttons.map(button => ({ x: parseFloat(button.style.left), y: parseFloat(button.style.top), w: parseFloat(button.style.width), h: 52 }));
      const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      for (const point of [...projected].sort((a, b) => a.z - b.z)) {
        const chosen = selected.includes(point.group);
        const focused = hoverPaper?.slug === point.slug || selectedPaper?.slug === point.slug;
        const dim = selected.length && !chosen && !focused ? .25 : 1;
        const alpha = (.35 + (point.z + 1.2) / 2.4 * .6) * dim;
        ctx.beginPath(); ctx.arc(point.x, point.y, (focused ? 4 : chosen ? 3 : 2.6) * point.scale, 0, TAU);
        ctx.fillStyle = ink(alpha, chosen || focused); ctx.fill();
        if (focused) { ctx.beginPath(); ctx.arc(point.x, point.y, 7, 0, TAU); ctx.strokeStyle = ink(.4, true); ctx.stroke(); }
      }
      // Names appear when useful; depth and collision checks keep the map legible.
      const names = [...projected].sort((a, b) => Number(b.slug === hoverPaper?.slug || b.slug === selectedPaper?.slug) - Number(a.slug === hoverPaper?.slug || a.slug === selectedPaper?.slug) || b.z - a.z);
      for (const point of names) {
        const focused = hoverPaper?.slug === point.slug || selectedPaper?.slug === point.slug;
        if (!focused && !(selected.includes(point.group) && point.z > -.2 && !small)) continue;
        ctx.font = '11px Lato, Arial, sans-serif';
        const tw = ctx.measureText(point.name).width;
        const box = { x: clamp(point.x + 10, 4, width - tw - 8), y: point.y - 7, w: tw + 6, h: 17 };
        if (!focused && labelRects.some(r => intersects(box, r))) continue;
        labelRects.push(box);
        ctx.fillStyle = '#f7f8f5'; ctx.fillRect(box.x - 2, box.y - 1, box.w, box.h);
        ctx.fillStyle = focused ? '#00599f' : '#3d5448'; ctx.fillText(point.name, box.x, box.y + 11);
      }
      const joinAlpha = pairAmount * (1 - expansion);
      if (joinAlpha > .002) {
        const end = { x: center.x, y: small ? 38 : center.y - radius * 1.30 };
        for (const group of selected) {
          const from = project(ringPoint(group, -Math.PI / 2 + group * .2));
          curve(from, end, .8 * joinAlpha, true);
          curve(from, { x: end.x + 1.5, y: end.y - 3 }, .18 * joinAlpha, true);
        }
        ctx.beginPath(); ctx.arc(end.x, end.y, 5, 0, TAU); ctx.fillStyle = '#f7f8f5'; ctx.fill();
        ctx.strokeStyle = ink(joinAlpha, true); ctx.lineWidth = 1; ctx.stroke();
        curve(end, { x: end.x + radius * .58, y: Math.max(10, end.y - radius * .25) }, joinAlpha * .55, true, true);
      }
      if (expansion > .005) {
        // These are open directions, not additional paper/result nodes.
        const future = ['World models', 'Long-horizon adaptation', 'Open-ended learning'];
        ctx.font = `${small ? 8.5 : 10}px Lato, Arial, sans-serif`; ctx.fillStyle = ink(.9 * expansion, true); ctx.textAlign = 'center';
        future.forEach((text, i) => {
          const x = width * (.17 + i * .33); const y = 16;
          ctx.fillText(text, x, y);
          curve({ x, y: y + 10 }, { x: center.x + (i - 1) * radius * .72, y: center.y - radius * .72 }, .3 * expansion, true, true);
        });
        ctx.textAlign = 'left';
      }
    }

    function frame(now) {
      raf = 0;
      if (closed || leaving || document.hidden) { lastFrame = 0; return; }
      const dt = lastFrame ? Math.min(40, now - lastFrame) : 16; lastFrame = now;
      intro = motion.matches ? 1 : Math.min(1, intro + dt / 1700);
      const step = motion.matches ? 1 : 1 - Math.exp(-dt / 140);
      expansion += ((frontier ? 1 : 0) - expansion) * step;
      pairAmount += ((selected.length === 2 ? 1 : 0) - pairAmount) * step;
      if (!drag && !motion.matches) {
        yaw += velocity.x * dt; pitch = clamp(pitch + velocity.y * dt, -.9, .9);
        const decay = Math.exp(-dt / 115); velocity.x *= decay; velocity.y *= decay;
      }
      dialog.querySelector('.atlas-frontier-label').style.opacity = String(pairAmount * (1 - expansion));
      try { draw(); } catch (error) { cleanup(); console.warn('The research atlas could not be drawn.', error); return; }
      const moving = intro < 1 || Math.abs(expansion - Number(frontier)) > .002 || Math.abs(pairAmount - Number(selected.length === 2)) > .002 || (!drag && Math.abs(velocity.x) + Math.abs(velocity.y) > .000015);
      if (moving) schedule(); else lastFrame = 0;
    }
    function schedule() { if (!raf && !closed && !leaving && !document.hidden) raf = requestAnimationFrame(frame); }
    function pointer(event) { const r = stage.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
    function nearest(p) { return [...projected].sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).find(a => Math.hypot(a.x-p.x,a.y-p.y) < 15); }

    buttons.forEach((button, i) => on(button, 'click', () => selectThread(i)));
    on(stage, 'pointerdown', event => {
      if (event.target.closest('button') || event.button !== 0 || drag) return;
      const p = pointer(event); velocity = { x: 0, y: 0 };
      drag = { id: event.pointerId, start: p, last: p, moved: false, at: performance.now() };
      stage.setPointerCapture(event.pointerId); stage.classList.add('is-dragging');
    });
    on(stage, 'pointermove', event => {
      const p = pointer(event);
      if (drag && drag.id === event.pointerId) {
        const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
        if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 4) drag.moved = true;
        if (drag.moved) {
          yaw += dx * .007; pitch = clamp(pitch + dy * .005, -.9, .9);
          const dt = Math.max(8, performance.now() - drag.at);
          velocity = motion.matches ? { x: 0, y: 0 } : { x: clamp(dx * .004 / dt, -.008, .008), y: clamp(dy * .003 / dt, -.005, .005) };
        }
        drag.last = p; drag.at = performance.now(); hoverPaper = null;
      } else if (event.pointerType === 'mouse' && !event.target.closest('button')) hoverPaper = nearest(p) || null;
      else hoverPaper = null;
      stage.classList.toggle('over-paper', !!hoverPaper); schedule();
    });
    function endPointer(event, cancelled) {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      stage.classList.remove('is-dragging');
      if (cancelled) velocity = { x: 0, y: 0 };
      else if (!moved) {
        const point = nearest(pointer(event));
        if (point) { selectedPaper = point; selected = [point.group]; showWorks(); updateReading(); }
      }
      schedule();
    }
    on(stage, 'pointerup', event => endPointer(event, false));
    on(stage, 'pointercancel', event => endPointer(event, true));
    on(stage, 'lostpointercapture', event => endPointer(event, true));
    on(stage, 'pointerleave', () => { hoverPaper = null; stage.classList.remove('over-paper'); schedule(); });
    on(stage, 'keydown', event => {
      if (event.target !== stage || !event.key.startsWith('Arrow')) return;
      event.preventDefault(); velocity = { x: 0, y: 0 };
      yaw += event.key === 'ArrowRight' ? .16 : event.key === 'ArrowLeft' ? -.16 : 0;
      pitch = clamp(pitch + (event.key === 'ArrowDown' ? .12 : event.key === 'ArrowUp' ? -.12 : 0), -.9, .9);
      schedule();
    });
    on(rootLink, 'click', event => {
      if (!selectedPaper && !frontier && selected.length === 1) {
        event.preventDefault(); const details = dialog.querySelector('.atlas-works'); details.open = true;
        details.querySelector('summary').focus({ preventScroll: true }); details.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    });
    on(dialog.querySelector('[data-horizon]'), 'click', event => {
      frontier = !frontier; selectedPaper = null;
      event.currentTarget.setAttribute('aria-pressed', String(frontier));
      event.currentTarget.innerHTML = frontier ? 'Return to the work <span aria-hidden="true">↙</span>' : 'Step back <span aria-hidden="true">↗</span>';
      dialog.querySelector('[data-coordinates]').textContent = frontier ? 'Open directions / beyond the present work' : 'A shared, unfinished horizon';
      updateReading();
    });
    on(dialog.querySelector('[data-reset]'), 'click', () => {
      if (drag && stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id);
      drag = null; stage.classList.remove('is-dragging', 'over-paper');
      selected = []; selectedPaper = null; hoverPaper = null; frontier = false;
      yaw = -.3; pitch = -.22; velocity = { x: 0, y: 0 };
      const button = dialog.querySelector('[data-horizon]'); button.setAttribute('aria-pressed', 'false'); button.innerHTML = 'Step back <span aria-hidden="true">↗</span>';
      dialog.querySelector('[data-coordinates]').textContent = 'A shared, unfinished horizon';
      showWorks(); updateReading();
    });
    on(dialog.querySelector('[data-close]'), 'click', close);
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', cleanup); on(window, 'pagehide', cleanup);
    on(document, 'visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastFrame = 0; } else schedule(); });
    on(motion, 'change', () => { if (motion.matches) velocity = { x: 0, y: 0 }; schedule(); });
    try {
      active = true; document.body.append(dialog); dialog.showModal();
      document.body.style.setProperty('overflow', 'hidden');
      dialog.querySelector('[data-close]').focus({ preventScroll: true });
      showWorks(); resize(); observer = new ResizeObserver(resize); observer.observe(stage);
      void dialog.offsetWidth; dialog.classList.add('is-visible');
    } catch (error) { cleanup(); console.warn('The research atlas could not open.', error); }
  }
  window.SiteEasterEgg = { open };
})();
