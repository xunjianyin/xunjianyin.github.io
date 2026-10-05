/* Reasoning demos. The page is complete without this script; it adds controls.
 * ContraSolver: Algorithm 1 of arXiv 2406.08842v1 runs on reader-edited,
 * illustrative confidences, and Play replays that run one decision at a time.
 * Atomic to Composite: switches between the paper's three worked tasks and
 * replays the required path hop by hop. No network or model calls.
 */
(() => {
  'use strict';

  const one = (root, selector) => root.querySelector(selector);
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const setText = (element, text) => { if (element && element.textContent !== text) element.textContent = text; };

  /* ---------------- Reader-started replay ---------------- */

  /**
   * Play / Pause / Step / Reset for a sequence of frames. Nothing moves until
   * the reader presses Play or Step; Reset (or any edit) returns to the
   * completed static state. Frame changes are discrete; CSS supplies short
   * transitions, which prefers-reduced-motion removes.
   *   count(): number of frames; show(k): render frame k, return its description;
   *   complete(): render the completed state.
   */
  function createPlayer(root, prefix, { count, show, complete }) {
    const control = name => one(root, `[data-demo-action="${prefix}-${name}"]`);
    const play = control('play');
    const pause = control('pause');
    const step = control('step');
    const reset = control('reset');
    const status = one(root, `[data-player-status="${prefix}"]`);
    let index = -1;
    let timer = null;
    // Frame interval; tests shorten it through data-frame-ms.
    const delay = () => Number(root.dataset.frameMs) || 1300;
    const sync = () => {
      const playing = timer !== null;
      // A control that becomes disabled loses focus; keep keyboard users on Play.
      const focused = play.ownerDocument.activeElement;
      play.setAttribute('aria-pressed', String(playing));
      pause.disabled = !playing;
      step.disabled = index === count() - 1;
      if ((focused === pause && pause.disabled) || (focused === step && step.disabled)) play.focus();
      root.dataset.playerFrame = String(index);
      root.dataset.playerState = playing ? 'playing' : index < 0 ? 'complete' : 'paused';
      root.classList.toggle('is-replaying', index >= 0);
    };
    const go = k => {
      index = k;
      const text = show(k);
      setText(status, `Step ${k + 1} of ${count()} · ${text}`);
      sync();
    };
    const halt = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
    const tick = () => {
      go(index + 1);
      if (index >= count() - 1) { timer = null; sync(); } else timer = setTimeout(tick, delay());
    };
    const api = {
      play() {
        if (timer !== null) return;
        if (index < 0 || index >= count() - 1) go(0);
        if (index >= count() - 1) return;
        timer = setTimeout(tick, delay());
        sync();
      },
      pause() { halt(); sync(); },
      step() { halt(); go(index < 0 ? 0 : Math.min(index + 1, count() - 1)); },
      /** Back to the completed state; also used when the reader edits the input. */
      reset() { halt(); index = -1; complete(); setText(status, ''); sync(); },
      get active() { return index >= 0; },
    };
    play.addEventListener('click', api.play);
    pause.addEventListener('click', api.pause);
    step.addEventListener('click', api.step);
    reset.addEventListener('click', api.reset);
    status.hidden = false;
    sync();
    return api;
  }

  /* ---------------- ContraSolver ---------------- */

  const NODES = ['A', 'B', 'C', 'D', 'E'];
  // Confidences are integers in hundredths so stepping never accumulates float error.
  const DELTA = 51; // Appendix C: edges below 0.51 are discarded.

  const fmt = weight => (weight / 100).toFixed(2);
  const judgment = edge => `${edge.winner} ≻ ${edge.loser}`;

  function reachable(adjacency, start) {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      for (const next of adjacency[stack.pop()]) {
        if (!seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    return seen;
  }

  function shortestPath(adjacency, start, goal) {
    // Breadth-first search, neighbours in alphabetical order (matches the Python renderer).
    const previous = new Map([[start, null]]);
    const queue = [start];
    while (queue.length) {
      const node = queue.shift();
      if (node === goal) break;
      for (const next of [...adjacency[node]].sort()) {
        if (!previous.has(next)) { previous.set(next, node); queue.push(next); }
      }
    }
    const path = [];
    for (let node = goal; node !== null; node = previous.get(node)) path.push(node);
    return path.reverse();
  }

  /**
   * Algorithm 1. edges: [{winner, loser, weight}] in fixed list order; the
   * index breaks confidence ties (the paper does not specify tie handling).
   * events records every decision in the order the algorithm makes it; the
   * replay animates exactly this list.
   */
  function solveContraSolver(edges) {
    const usable = edges.map((_, i) => i).filter(i => edges[i].weight >= DELTA);
    const descending = [...usable].sort((a, b) => edges[b].weight - edges[a].weight || a - b);
    const ascending = [...usable].sort((a, b) => edges[a].weight - edges[b].weight || a - b);
    const events = [];
    // Kruskal maximum spanning tree on the undirected skeleton.
    const parent = Object.fromEntries(NODES.map(node => [node, node]));
    const find = node => {
      while (parent[node] !== node) { parent[node] = parent[parent[node]]; node = parent[node]; }
      return node;
    };
    const tree = [];
    for (const i of descending) {
      const a = find(edges[i].winner);
      const b = find(edges[i].loser);
      if (a !== b) { parent[a] = b; tree.push(i); events.push({ type: 'tree', edge: i }); }
      // Rejections after the tree is complete are implicit; only earlier ones are shown.
      else if (tree.length < NODES.length - 1) events.push({ type: 'tree-skip', edge: i });
    }
    const adjacency = Object.fromEntries(NODES.map(node => [node, new Set()]));
    const kept = new Set(tree);
    tree.forEach(i => adjacency[edges[i].winner].add(edges[i].loser));
    const stage = new Map(tree.map(i => [i, 'tree']));
    const passOf = new Map(tree.map(i => [i, 0]));
    const remaining = new Set(usable.filter(i => !kept.has(i)));
    const heuristic = new Set();
    const passes = [];
    while (remaining.size) {
      const record = { number: passes.length + 1, contradictions: [], skipped: [], added: null };
      // Reverse loop, ascending confidence. The kept graph G' does not change here.
      for (const i of ascending) {
        if (!remaining.has(i)) continue;
        const { winner, loser } = edges[i];
        const fromLoser = reachable(adjacency, loser);
        if (!fromLoser.has(winner)) continue;
        const toWinner = new Set(NODES.filter(node => reachable(adjacency, node).has(winner)));
        // Every kept edge on some loser -> ... -> winner path closes a cycle with edge i.
        const cycle = [...kept].filter(j => fromLoser.has(edges[j].winner) && toWinner.has(edges[j].loser)).sort((a, b) => a - b);
        cycle.forEach(j => heuristic.add(j));
        const path = shortestPath(adjacency, loser, winner);
        record.contradictions.push({ edge: i, cycle, path });
        events.push({ type: 'contradiction', pass: record.number, edge: i, cycle, path });
        stage.set(i, 'contradictory'); passOf.set(i, record.number);
        remaining.delete(i);
      }
      if (!record.contradictions.length) events.push({ type: 'no-cycle', pass: record.number });
      // Forward loop, descending confidence: skip implied edges, add the first new relation.
      for (const i of descending) {
        if (!remaining.has(i)) continue;
        remaining.delete(i);
        const { winner, loser } = edges[i];
        if (reachable(adjacency, winner).has(loser) || reachable(adjacency, loser).has(winner)) {
          record.skipped.push(i);
          events.push({ type: 'implied', pass: record.number, edge: i, last: false });
          stage.set(i, 'implied'); passOf.set(i, record.number);
          continue;
        }
        adjacency[winner].add(loser);
        kept.add(i);
        record.added = i;
        events.push({ type: 'added', pass: record.number, edge: i });
        stage.set(i, 'added'); passOf.set(i, record.number);
        break;
      }
      if (record.added === null) {
        if (record.skipped.length) events[events.length - 1].last = true; // "nothing added"
        else events.push({ type: 'no-edges', pass: record.number });
      }
      passes.push(record);
    }
    // Property 2: kept edges plus reversed contradictions are acyclic; with one
    // judgment per pair this is a total order, ranked by reachability.
    const order = [...NODES].sort((a, b) => reachable(adjacency, b).size - reachable(adjacency, a).size || a.localeCompare(b));
    return { tree, stage, passOf, heuristic, passes, order, events };
  }

  const edgeClass = (result, i) => {
    if (result.heuristic.has(i)) return 'heuristic';
    const stage = result.stage.get(i);
    return stage === 'tree' || stage === 'added' ? 'kept' : stage;
  };

  function outcomeText(result, i) {
    const stage = result.stage.get(i);
    const number = result.passOf.get(i);
    const trained = result.heuristic.has(i) ? ' · DPO pair' : ' · not trained';
    if (stage === 'tree') return `Spanning tree${trained}`;
    if (stage === 'added') return `Added, pass ${number}${trained}`;
    if (stage === 'contradictory') return `Contradictory, pass ${number}`;
    return `Implied, skipped in pass ${number}`;
  }

  function passLog(edges, result) {
    const named = i => `${judgment(edges[i])} ${fmt(edges[i].weight)}`;
    const items = [['Tree', [`Kruskal keeps the strongest connected comparisons: ${result.tree.map(named).join(', ')}.`]]];
    for (const record of result.passes) {
      const reverse = record.contradictions.length
        ? `Reverse loop: ${record.contradictions.map(({ edge, cycle, path }) =>
          `${named(edge)} contradicts the kept chain ${path.join(' ≻ ')} and is marked contradictory; heuristic: ${cycle.map(j => judgment(edges[j])).join(', ')}.`).join(' ')}`
        : 'Reverse loop: no remaining edge closes a cycle.';
      const steps = record.skipped.map(i => `skips ${named(i)} (already implied)`);
      if (record.added !== null) steps.push(`adds ${named(record.added)}`);
      else if (steps.length) steps.push('nothing added');
      const forward = `Forward loop: ${steps.length ? `${steps.join('; ')}.` : 'no edges left.'}`;
      items.push([`Pass ${record.number}`, [reverse, forward]]);
    }
    return items;
  }

  /**
   * The replay: frame 0 shows every judgment unexamined, then one frame per
   * event of solveContraSolver, then the finished order. Classes are rebuilt
   * from the events alone, so the last frame must equal the computed result.
   */
  function replayFrames(result) {
    return [{ type: 'start' }, ...result.events, { type: 'done' }];
  }

  function replayState(edges, frames, k) {
    const stage = new Map();
    const passOf = new Map();
    const heuristic = new Set();
    for (const frame of frames.slice(1, k + 1)) {
      if (frame.type === 'tree') { stage.set(frame.edge, 'tree'); passOf.set(frame.edge, 0); }
      else if (frame.type === 'contradiction') {
        stage.set(frame.edge, 'contradictory'); passOf.set(frame.edge, frame.pass);
        frame.cycle.forEach(j => heuristic.add(j));
      } else if (frame.type === 'implied' || frame.type === 'added') { stage.set(frame.edge, frame.type); passOf.set(frame.edge, frame.pass); }
    }
    const classes = edges.map((_, i) => {
      if (heuristic.has(i)) return 'heuristic';
      const s = stage.get(i);
      if (s === undefined) return 'pending';
      return s === 'tree' || s === 'added' ? 'kept' : s;
    });
    return { stage, passOf, heuristic, classes };
  }

  function describeFrame(edges, result, frame) {
    const named = i => `${judgment(edges[i])} ${fmt(edges[i].weight)}`;
    const usable = edges.filter(edge => edge.weight >= DELTA).length;
    switch (frame.type) {
      case 'start': return `${usable} judgments at or above δ = 0.51. Algorithm 1 first sorts them by confidence.`;
      case 'tree': return `Spanning tree, strongest first: add ${named(frame.edge)}; it joins two responses the tree does not yet connect.`;
      case 'tree-skip': return `Spanning tree: skip ${named(frame.edge)}; its two responses are already connected.`;
      case 'contradiction': return `Pass ${frame.pass}, reverse loop, weakest first: ${named(frame.edge)} closes a cycle with the kept chain ${frame.path.join(' ≻ ')}. It is marked contradictory; ${frame.cycle.map(j => judgment(edges[j])).join(', ')} become heuristic edges.`;
      case 'no-cycle': return `Pass ${frame.pass}, reverse loop: no remaining edge closes a cycle.`;
      case 'implied': return `Pass ${frame.pass}, forward loop, strongest first: skip ${named(frame.edge)}; the kept graph already orders ${edges[frame.edge].winner} and ${edges[frame.edge].loser}.${frame.last ? ' No edge is left to add.' : ''}`;
      case 'added': return `Pass ${frame.pass}, forward loop: add ${named(frame.edge)}, the strongest remaining edge that orders a new pair.`;
      case 'no-edges': return `Pass ${frame.pass}, forward loop: no edges left.`;
      default: {
        const pairs = [...result.heuristic].sort((a, b) => a - b).map(i => judgment(edges[i])).join(', ') || 'none';
        return `Done after ${result.passes.length} passes. Resolved order ${result.order.join(' ≻ ')}; DPO pairs: ${pairs}.`;
      }
    }
  }

  // Which sentence of "What the algorithm did" a frame belongs to: [item, sentence].
  function logPosition(frame) {
    if (frame.type === 'tree' || frame.type === 'tree-skip') return [0, 0];
    if (frame.type === 'contradiction' || frame.type === 'no-cycle') return [frame.pass, 0];
    if (frame.type === 'implied' || frame.type === 'added' || frame.type === 'no-edges') return [frame.pass, 1];
    return null;
  }

  function attachContraSolver(root) {
    const rows = all(root, '[data-edge-row]');
    const list = one(root, '.cs-edge-list');
    const [MIN, MAX, STEP] = ['csMin', 'csMax', 'csStep'].map(key => Number(list.dataset[key]));
    // The server-rendered example is the single source of the default inputs.
    const defaults = rows.map(row => {
      const [winner, loser] = one(row, '[data-cs-static]').textContent.split('≻').map(part => part.trim());
      return { winner, loser, weight: Math.round(Number(one(row, 'output').textContent) * 100) };
    });
    let edges = defaults.map(edge => ({ ...edge }));
    let result = solveContraSolver(edges);
    let frames = replayFrames(result);
    const svg = one(root, '.cs-graph');
    const linesLayer = one(svg, '.cs-lines');
    const region = one(root, '.cs-result-region');
    const log = one(root, '[data-demo-state="cs-log"]');
    const rank = { pending: -1, implied: 0, kept: 1, contradictory: 2, heuristic: 3 };
    const listed = indices => indices.map(i => judgment(edges[i])).join(', ') || 'none';

    const renderLog = () => {
      log.replaceChildren(...passLog(edges, result).map(([label, texts]) => {
        const item = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = label;
        item.append(strong);
        texts.forEach(text => {
          const span = document.createElement('span');
          span.textContent = text;
          item.append(' ', span);
        });
        return item;
      }));
    };

    /** Paint one state: classes and outcomes per edge, the highlighted edge and log sentence, the readout. */
    const paint = ({ classes, outcomes, current, position, pairs, contradictions, order, pairCount, replaying }) => {
      rows.forEach((row, i) => {
        const edge = edges[i];
        const pair = [edge.winner, edge.loser].sort().join(' and ');
        row.className = `cs-row is-${classes[i]}${i === current ? ' is-current' : ''}`;
        row.dataset.edgeClass = classes[i];
        if (!replaying) row.dataset.edgeStage = result.stage.get(i);
        const flip = one(row, '[data-demo-action="cs-flip"]');
        setText(flip, judgment(edge));
        flip.setAttribute('aria-label', `Flip the judgment between ${pair}; currently ${judgment(edge)}`);
        setText(one(row, '[data-cs-static]'), judgment(edge));
        setText(one(row, 'output'), fmt(edge.weight));
        one(row, '[data-demo-action="cs-down"]').disabled = edge.weight <= MIN;
        one(row, '[data-demo-action="cs-up"]').disabled = edge.weight >= MAX;
        all(row, '[data-demo-action="cs-down"],[data-demo-action="cs-up"]').forEach(button => {
          button.setAttribute('aria-label', `${button.dataset.demoAction === 'cs-up' ? 'Raise' : 'Lower'} confidence of ${judgment(edge)}`);
        });
        setText(one(row, '[data-cs-outcome]'), outcomes[i]);
      });
      // Graph: direction via the marker end, class via CSS, emphasised edges drawn last.
      const groups = all(svg, '.cs-edge');
      groups.forEach(group => {
        const i = Number(group.dataset.edge);
        const edge = edges[i];
        const line = one(group, '.cs-line');
        const [first] = [edge.winner, edge.loser].sort((a, b) => NODES.indexOf(a) - NODES.indexOf(b));
        const marker = `url(#cs-arrow-${classes[i]})`;
        if (edge.winner === first) { line.setAttribute('marker-end', marker); line.removeAttribute('marker-start'); }
        else { line.setAttribute('marker-start', marker); line.removeAttribute('marker-end'); }
        group.setAttribute('class', `cs-edge is-${classes[i]}${i === current ? ' is-current' : ''}`);
        const label = one(svg, `[data-edge-label="${i}"]`);
        label.setAttribute('class', `cs-label is-${classes[i]}${i === current ? ' is-current' : ''}`);
        setText(one(label, 'text'), fmt(edge.weight));
      });
      const drawRank = group => (Number(group.dataset.edge) === current ? 4 : rank[classes[group.dataset.edge]]);
      groups.sort((a, b) => drawRank(a) - drawRank(b) || a.dataset.edge - b.dataset.edge)
        .forEach(group => linesLayer.appendChild(group));
      // The log keeps the whole run; during a replay it marks the current sentence and dims later ones.
      all(log, 'li').forEach((item, k) => {
        const spans = all(item, 'span');
        spans.forEach((span, s) => {
          const isCurrent = position !== null && position !== 'all' && k === position[0] && s === position[1];
          const isFuture = position === null || (position !== 'all' && (k > position[0] || (k === position[0] && s > position[1])));
          span.classList.toggle('is-current', isCurrent);
          span.classList.toggle('is-future', isFuture);
          if (isCurrent) span.setAttribute('aria-current', 'step'); else span.removeAttribute('aria-current');
        });
        item.classList.toggle('is-future', spans.every(span => span.classList.contains('is-future')));
      });
      // During a replay the readout fills in as the run proceeds; aria-busy holds announcements.
      region.setAttribute('aria-busy', String(replaying));
      region.classList.toggle('is-partial', replaying);
      setText(one(root, '[data-cs-pairs]'), pairs);
      setText(one(root, '[data-cs-contradictions]'), contradictions);
      setText(one(root, '[data-cs-order]'), order);
      setText(one(root, '[data-cs-pair-count]'), pairCount);
    };

    const completeView = () => {
      const indices = edges.map((_, i) => i);
      const pairs = listed(indices.filter(i => result.heuristic.has(i)));
      const contradictions = listed(indices.filter(i => result.stage.get(i) === 'contradictory'));
      paint({
        classes: indices.map(i => edgeClass(result, i)),
        outcomes: indices.map(i => outcomeText(result, i)),
        current: null, position: 'all', pairs, contradictions,
        order: result.order.join(' ≻ '),
        pairCount: `${result.heuristic.size} of ${edges.length} judgments`,
        replaying: false,
      });
      setText(one(root, '[data-cs-desc]'), `Arrows point to the less preferred response. DPO pairs: ${pairs}. Contradictory: ${contradictions}.`);
    };

    const frameView = k => {
      const frame = frames[k];
      if (frame.type === 'done') { completeView(); return describeFrame(edges, result, frame); }
      const state = replayState(edges, frames, k);
      const indices = edges.map((_, i) => i);
      const outcomes = indices.map(i => {
        const s = state.stage.get(i);
        const pass = state.passOf.get(i);
        const trained = state.heuristic.has(i) ? ' · DPO pair' : '';
        if (s === 'tree') return `Spanning tree${trained}`;
        if (s === 'added') return `Added, pass ${pass}${trained}`;
        if (s === 'contradictory') return `Contradictory, pass ${pass}`;
        if (s === 'implied') return `Implied, skipped in pass ${pass}`;
        return 'Not yet examined';
      });
      paint({
        classes: state.classes, outcomes,
        current: frame.edge === undefined ? null : frame.edge,
        position: logPosition(frame),
        pairs: listed(indices.filter(i => state.heuristic.has(i))),
        contradictions: listed(indices.filter(i => state.stage.get(i) === 'contradictory')),
        order: 'Known after the last pass',
        pairCount: `${state.heuristic.size} of ${edges.length} judgments so far`,
        replaying: true,
      });
      rows.forEach((row, i) => { row.dataset.edgeStage = state.stage.get(i) || 'pending'; });
      return describeFrame(edges, result, frame);
    };

    const player = createPlayer(root, 'cs-run', { count: () => frames.length, show: frameView, complete: completeView });

    const recompute = () => {
      result = solveContraSolver(edges);
      frames = replayFrames(result);
      renderLog();
      // Any edit ends a replay: the reader sees the completed run of the new graph.
      player.reset();
    };
    const flip = i => { const edge = edges[i]; edges[i] = { ...edge, winner: edge.loser, loser: edge.winner }; recompute(); };
    const nudge = (i, delta) => { edges[i] = { ...edges[i], weight: Math.min(MAX, Math.max(MIN, edges[i].weight + delta)) }; recompute(); };
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-demo-action]');
      if (button && root.contains(button)) {
        const i = Number(button.dataset.edge);
        const action = button.dataset.demoAction;
        if (action === 'cs-flip') flip(i);
        else if (action === 'cs-up') nudge(i, STEP);
        else if (action === 'cs-down') nudge(i, -STEP);
        else if (action === 'cs-reset') { edges = defaults.map(edge => ({ ...edge })); recompute(); }
        return;
      }
      // Pointer shortcut: clicking an arrow flips it. Keyboard users use the list buttons.
      const group = event.target.closest('.cs-edge');
      if (group && svg.contains(group)) flip(Number(group.dataset.edge));
    });
    svg.classList.add('is-interactive');
    renderLog();
    completeView();
  }

  /* ---------------- From Atomic to Composite ---------------- */

  function attachAtomic(root) {
    // Figure 1(a) of arXiv 2512.01970v1, read from the server-rendered data.
    const view = one(root, '[data-demo-state="atomic-task"]');
    const tasks = JSON.parse(view.dataset.atomicTasks);
    const sourceName = { Context: 'Supplied document', Memory: 'Parametric memory' };
    let key = view.dataset.task;

    const sources = (element, kind, facts, empty) => {
      if (!facts.length) {
        const note = document.createElement('span');
        note.className = 'ac-empty';
        note.textContent = empty;
        element.replaceChildren(note);
        return;
      }
      const spans = facts.map((fact, i) => {
        const span = document.createElement('span');
        span.className = 'ac-fact';
        span.dataset.fact = `${kind}-${i}`;
        span.textContent = fact;
        return span;
      });
      element.replaceChildren(...spans.flatMap((span, i) => (i ? [' ', span] : [span])));
    };

    const renderTask = () => {
      const task = tasks[key];
      view.dataset.task = key;
      setText(one(root, '[data-atomic-kind]'), task.kind);
      setText(one(root, '[data-atomic-question]'), task.question);
      sources(one(root, '[data-atomic-context]'), 'context', task.context, 'None: the question is asked directly.');
      sources(one(root, '[data-atomic-memory]'), 'memory', task.memory, 'Not needed for this question.');
      one(root, '[data-atomic-trace]').replaceChildren(...task.trace.map(([source, head, relation, tail, index], k) => {
        const item = document.createElement('li');
        item.dataset.source = source.toLowerCase();
        item.dataset.hop = String(k);
        item.dataset.fact = `${source === 'Context' ? 'context' : 'memory'}-${index}`;
        const label = document.createElement('span');
        label.className = 'ac-source';
        label.textContent = source;
        const hop = document.createElement('span');
        hop.className = 'ac-hop';
        const rel = document.createElement('span');
        rel.className = 'ac-relation';
        rel.textContent = relation;
        hop.append(`${head} `, rel, ` → ${tail}`);
        item.append(label, hop);
        return item;
      }));
      setText(one(root, '[data-atomic-answer]'), task.answer);
      setText(one(root, '[data-atomic-status]'), task.status);
      all(root, '[data-demo-action="atomic-task"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.task === key)));
    };

    // Hop state: k = 0 is the bare question, 1..H reveal hops, H + 1 the answer.
    const mark = k => {
      const task = tasks[key];
      const hops = all(root, '[data-atomic-trace] li');
      const current = k >= 1 && k <= hops.length ? k - 1 : null;
      hops.forEach((item, h) => {
        item.classList.toggle('is-future', k <= h);
        item.classList.toggle('is-current', h === current);
      });
      const used = new Set(hops.filter((_, h) => h < k).map(item => item.dataset.fact));
      all(root, '.ac-fact').forEach(fact => {
        fact.classList.toggle('is-current', current !== null && fact.dataset.fact === hops[current].dataset.fact);
        fact.classList.toggle('is-used', used.has(fact.dataset.fact));
      });
      all(root, '[data-source-panel]').forEach(panel => {
        panel.classList.toggle('is-current', current !== null && hops[current].dataset.fact.startsWith(panel.dataset.sourcePanel));
      });
      const answer = one(root, '[data-atomic-answer]');
      const done = k > hops.length;
      setText(answer, done ? task.answer : '?');
      answer.classList.toggle('is-pending', !done);
      if (k === 0) return `The question names the start of the path; the answer needs ${hops.length} hops.`;
      if (done) {
        const fromDocument = task.trace.filter(([source]) => source === 'Context').length;
        const fromMemory = task.trace.length - fromDocument;
        const counts = [[fromDocument, 'document hop'], [fromMemory, 'memory hop']].filter(([n]) => n).map(([n, word]) => `${n} ${word}${n > 1 ? 's' : ''}`);
        return `Answer: ${task.answer}, reached through ${counts.join(' and ')}.`;
      }
      const [source, head, relation, tail] = task.trace[current];
      const previous = current > 0 ? task.trace[current - 1][0] : source;
      const crossing = previous === source ? ''
        : source === 'Memory' ? ' The path crosses from the document into the model’s stored facts.' : ' The path crosses from stored facts into the document.';
      return `Hop ${current + 1}, ${sourceName[source].toLowerCase()}: ${head} ${relation} → ${tail}.${crossing}`;
    };
    const unmark = () => {
      all(root, '[data-atomic-trace] li').forEach(item => item.classList.remove('is-future', 'is-current'));
      all(root, '.ac-fact, [data-source-panel]').forEach(element => element.classList.remove('is-current', 'is-used'));
      const answer = one(root, '[data-atomic-answer]');
      setText(answer, tasks[key].answer);
      answer.classList.remove('is-pending');
    };

    const player = createPlayer(root, 'atomic-run', {
      count: () => tasks[key].trace.length + 2,
      show: mark,
      complete: unmark,
    });
    all(root, '[data-demo-action="atomic-task"]').forEach(button => button.addEventListener('click', () => {
      key = button.dataset.task;
      renderTask();
      player.reset();
    }));
  }

  function initialize() {
    const attach = { 'atomic-trace': attachAtomic, 'preference-graph': attachContraSolver };
    all(document, '[data-reasoning-demo]').forEach(root => {
      if (root.dataset.reasoningReady === 'true') return;
      const initializeDemo = attach[root.dataset.reasoningDemo];
      if (!initializeDemo) return; // Measured charts need no script.
      all(root, '.rd-controls').forEach(controls => { controls.hidden = false; });
      all(root, '[data-demo-action]').forEach(control => { control.hidden = false; });
      all(root, '.rd-static').forEach(fallback => { fallback.hidden = true; });
      initializeDemo(root);
      root.dataset.reasoningReady = 'true';
    });
  }

  // Exposed for the browser test harness (tests/browser_demo_reasoning.js).
  window.ReasoningDemo = Object.freeze({ solveContraSolver, replayFrames, replayState });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
