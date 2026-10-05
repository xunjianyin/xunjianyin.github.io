/* The Geometry of Reasoning flow demo. The page is complete without this script;
 * it adds the selectors, the Play/Step/Reset animation, and live recomputation.
 * Metrics are the paper's own (arXiv 2510.09782v2): position and velocity are
 * mean cosine of step positions and of step differences; curvature is the
 * Pearson correlation of Menger curvature sequences. Trajectories are
 * illustrative 2-D paths, not the paper's embeddings. No network or model calls.
 */
(() => {
  'use strict';

  const one = (root, selector) => root.querySelector(selector);
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const setText = (element, text) => { if (element && element.textContent !== text) element.textContent = text; };
  const fmt = value => (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(2);

  /* ---------------- Geometry and the paper's metrics ---------------- */

  function flowPoints(config, spec, shuffled) {
    const template = config.logics[spec.logic];
    let heading = 0;
    let increments = template.map(([turn, length]) => {
      heading += turn;
      const rad = heading * Math.PI / 180;
      return [length * Math.cos(rad), length * Math.sin(rad)];
    });
    if (shuffled) {
      const order = config.shuffles[spec.shuffle || '1'];
      increments = order.map(i => increments[i]);
    }
    const topic = config.topics[spec.topic];
    const lang = config.languages[spec.language];
    const ox = topic.offset[0] + lang.offset[0];
    const oy = topic.offset[1] + lang.offset[1];
    const theta = (topic.rotate + lang.rotate) * Math.PI / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const scale = lang.scale;
    let x = 0;
    let y = 0;
    return increments.map(([dx, dy]) => {
      x += dx; y += dy;
      return [ox + scale * (cos * x - sin * y), oy + scale * (sin * x + cos * y)];
    });
  }

  const EPS = 1e-8;
  const cos = (u, v) => {
    const nu = Math.hypot(u[0], u[1]) + EPS;
    const nv = Math.hypot(v[0], v[1]) + EPS;
    return (u[0] * v[0] + u[1] * v[1]) / (nu * nv);
  };
  const deltas = pts => pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  function menger(pts) {
    const out = [];
    for (let i = 2; i < pts.length; i++) {
      const p = pts[i - 2], q = pts[i - 1], r = pts[i];
      const a = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const b = Math.hypot(r[0] - q[0], r[1] - q[1]);
      const c = Math.hypot(r[0] - p[0], r[1] - p[1]);
      const area = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2;
      out.push(4 * area / (a * b * c + EPS));
    }
    return out;
  }
  function meanCos(a, b) {
    const n = Math.min(a.length, b.length);
    if (!n) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) s += cos(a[i], b[i]);
    return s / n;
  }
  function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    if (!n) return 0;
    a = a.slice(0, n); b = b.slice(0, n);
    const ma = a.reduce((s, x) => s + x, 0) / n;
    const mb = b.reduce((s, x) => s + x, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return num / ((Math.sqrt(da) + EPS) * (Math.sqrt(db) + EPS));
  }
  function metrics(a, b) {
    return {
      position: meanCos(a, b),
      velocity: meanCos(deltas(a), deltas(b)),
      curvature: pearson(menger(a), menger(b)),
    };
  }

  /* ---------------- Rendering ---------------- */

  function transform(flows, view) {
    const [W, H, PAD] = view;
    const xs = flows.flat().map(p => p[0]);
    const ys = flows.flat().map(p => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs);
    const miny = Math.min(...ys), maxy = Math.max(...ys);
    const span = Math.max(maxx - minx, maxy - miny, 1e-6);
    return { scale: (W - 2 * PAD) / span, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, W, H };
  }
  const project = (p, t) => [t.W / 2 + (p[0] - t.cx) * t.scale, t.H / 2 - (p[1] - t.cy) * t.scale];
  const SVGNS = 'http://www.w3.org/2000/svg';

  function drawFlow(group, pts, t, reveal) {
    const screen = pts.map(p => project(p, t));
    const segs = one(group, '.fl-segs');
    const dots = one(group, '.fl-dots');
    segs.replaceChildren();
    dots.replaceChildren();
    for (let k = 1; k < screen.length; k++) {
      const [x1, y1] = screen[k - 1];
      const [x2, y2] = screen[k];
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'fl-step');
      g.dataset.step = k;
      if (k >= reveal) g.setAttribute('hidden', '');
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('class', 'fl-seg');
      line.setAttribute('x1', x1.toFixed(1)); line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1)); line.setAttribute('y2', y2.toFixed(1));
      const arrowG = document.createElementNS(SVGNS, 'g');
      arrowG.setAttribute('class', 'fl-arrow');
      const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      arrowG.setAttribute('transform', `translate(${((x1 + x2) / 2).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)}) rotate(${ang.toFixed(1)})`);
      const arrow = document.createElementNS(SVGNS, 'path');
      arrow.setAttribute('d', 'M-3 -2.4 L3 0 L-3 2.4 Z');
      arrowG.append(arrow);
      g.append(line, arrowG);
      segs.append(g);
    }
    screen.forEach(([sx, sy], k) => {
      const dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('class', k === 0 ? 'fl-dot is-start' : 'fl-dot');
      dot.dataset.point = k;
      dot.setAttribute('cx', sx.toFixed(1)); dot.setAttribute('cy', sy.toFixed(1));
      dot.setAttribute('r', k === 0 ? '3.2' : '2.4');
      if (k >= reveal) dot.setAttribute('hidden', '');
      dots.append(dot);
    });
    const label = one(group, '.fl-flow-label');
    const [lx, ly] = project(pts[0], t);
    label.setAttribute('x', (lx + 6).toFixed(1));
    label.setAttribute('y', (ly - 6).toFixed(1));
  }

  function attach(root) {
    const config = JSON.parse(root.dataset.flowsConfig);
    const svg = one(root, '.fl-graph');
    const groups = { 1: one(svg, '.fl-flow.is-flow1'), 2: one(svg, '.fl-flow.is-flow2') };
    const specs = { 1: { ...config.flow1 }, 2: { ...config.flow2 } };
    let shuffled = false;
    let reveal = config.logics[specs[1].logic].length;
    let timer = null;
    const total = () => config.logics[specs[1].logic].length;

    const carrier = spec => `${config.logicNames[spec.logic]}, ${config.topics[spec.topic].label}, ${config.languages[spec.language].label}`;

    const compute = () => {
      const f1 = flowPoints(config, specs[1], shuffled);
      const f2 = flowPoints(config, specs[2], shuffled);
      return { f1, f2, t: transform([f1, f2], config.view), values: metrics(f1, f2) };
    };

    const noteFor = (key, values) => {
      if (key === 'position') return values.position > 0.6 ? 'high: shared carrier dominates position' : 'low: carriers differ';
      const sameLogic = specs[1].logic === specs[2].logic;
      if (shuffled) return 'collapses when the step order is shuffled';
      return sameLogic ? 'stays high: the two flows share a logic' : 'low: the two flows use different logics';
    };

    const render = () => {
      const { f1, f2, t, values } = compute();
      drawFlow(groups[1], f1, t, reveal);
      drawFlow(groups[2], f2, t, reveal);
      for (const key of ['position', 'velocity', 'curvature']) {
        setText(one(root, `[data-fl-value="${key}"]`), fmt(values[key]));
        one(root, `[data-fl-fill="${key}"]`).style.width = `${Math.max(0, Math.min(1, (values[key] + 1) / 2) * 100).toFixed(1)}%`;
        setText(one(root, `[data-fl-note="${key}"]`), noteFor(key, values));
      }
      const shuffleNote = shuffled ? ' Step order shuffled (independent permutations).' : '';
      setText(one(root, '[data-fl-caption]'),
        `Flow 1 (${carrier(specs[1])}) vs Flow 2 (${carrier(specs[2])}): position ${fmt(values.position)}, velocity ${fmt(values.velocity)}, curvature ${fmt(values.curvature)}.${shuffleNote}`);
      setText(one(root, '[data-fl-desc]'),
        `Flow 1 is ${carrier(specs[1])}; Flow 2 is ${carrier(specs[2])}. Position ${fmt(values.position)}, velocity ${fmt(values.velocity)}, curvature ${fmt(values.curvature)}.`);
      const status = one(root, '[data-fl-step-status]');
      setText(status, reveal >= total() ? `Showing all ${total()} steps` : `Showing step ${reveal} of ${total()}`);
    };

    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
      const play = one(root, '[data-demo-action="fl-play"]');
      play.setAttribute('aria-pressed', 'false');
      setText(play, 'Play');
    };
    const setReveal = value => { reveal = Math.max(1, Math.min(total(), value)); render(); };

    // Controls
    all(root, '[data-demo-select]').forEach(select => {
      select.addEventListener('change', () => {
        stop();
        specs[select.dataset.flow][select.dataset.field] = select.value;
        reveal = total();
        render();
      });
    });
    one(root, '[data-demo-action="fl-shuffle"]').addEventListener('change', event => {
      stop();
      shuffled = event.target.checked;
      specs[1].shuffle = '1';
      specs[2].shuffle = '2';
      reveal = total();
      render();
    });
    one(root, '[data-demo-action="fl-step"]').addEventListener('click', () => {
      stop();
      setReveal(reveal >= total() ? 1 : reveal + 1);
    });
    one(root, '[data-demo-action="fl-reset"]').addEventListener('click', () => { stop(); setReveal(1); });
    one(root, '[data-demo-action="fl-play"]').addEventListener('click', event => {
      const button = event.currentTarget;
      if (timer) { stop(); return; }
      if (reveal >= total()) reveal = 1;
      button.setAttribute('aria-pressed', 'true');
      setText(button, 'Pause');
      render();
      timer = setInterval(() => {
        if (reveal >= total()) { stop(); return; }
        setReveal(reveal + 1);
      }, 560);
    });

    render();
  }

  function initialize() {
    all(document, '[data-flows-demo]').forEach(root => {
      if (root.dataset.flowsReady === 'true') return;
      attach(root);
      root.dataset.flowsReady = 'true';
      all(root, '.fl-controls, .fl-play').forEach(block => { block.hidden = false; });
      all(root, '[data-demo-action], [data-demo-select]').forEach(control => { control.hidden = false; });
    });
  }

  // Exposed for the browser test harness.
  window.FlowsDemo = Object.freeze({ flowPoints, metrics });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
