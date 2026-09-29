/* Reasoning demos. The page is complete without this script; it adds controls.
 * ContraSolver: Algorithm 1 of arXiv 2406.08842v1 runs on reader-edited,
 * illustrative confidences. Atomic to Composite: switches between the paper's
 * three worked tasks. No network or model calls.
 */
(() => {
  'use strict';

  const one = (root, selector) => root.querySelector(selector);
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const setText = (element, text) => { if (element && element.textContent !== text) element.textContent = text; };

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
   */
  function solveContraSolver(edges) {
    const usable = edges.map((_, i) => i).filter(i => edges[i].weight >= DELTA);
    const descending = [...usable].sort((a, b) => edges[b].weight - edges[a].weight || a - b);
    const ascending = [...usable].sort((a, b) => edges[a].weight - edges[b].weight || a - b);
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
      if (a !== b) { parent[a] = b; tree.push(i); }
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
        record.contradictions.push({ edge: i, cycle, path: shortestPath(adjacency, loser, winner) });
        stage.set(i, 'contradictory'); passOf.set(i, record.number);
        remaining.delete(i);
      }
      // Forward loop, descending confidence: skip implied edges, add the first new relation.
      for (const i of descending) {
        if (!remaining.has(i)) continue;
        remaining.delete(i);
        const { winner, loser } = edges[i];
        if (reachable(adjacency, winner).has(loser) || reachable(adjacency, loser).has(winner)) {
          record.skipped.push(i);
          stage.set(i, 'implied'); passOf.set(i, record.number);
          continue;
        }
        adjacency[winner].add(loser);
        kept.add(i);
        record.added = i;
        stage.set(i, 'added'); passOf.set(i, record.number);
        break;
      }
      passes.push(record);
    }
    // Property 2: kept edges plus reversed contradictions are acyclic; with one
    // judgment per pair this is a total order, ranked by reachability.
    const order = [...NODES].sort((a, b) => reachable(adjacency, b).size - reachable(adjacency, a).size || a.localeCompare(b));
    return { tree, stage, passOf, heuristic, passes, order };
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
    const svg = one(root, '.cs-graph');
    const linesLayer = one(svg, '.cs-lines');
    const rank = { implied: 0, kept: 1, contradictory: 2, heuristic: 3 };

    const render = () => {
      const result = solveContraSolver(edges);
      const classes = edges.map((_, i) => edgeClass(result, i));
      rows.forEach((row, i) => {
        const edge = edges[i];
        const pair = [edge.winner, edge.loser].sort().join(' and ');
        row.className = `cs-row is-${classes[i]}`;
        row.dataset.edgeClass = classes[i];
        row.dataset.edgeStage = result.stage.get(i);
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
        setText(one(row, '[data-cs-outcome]'), outcomeText(result, i));
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
        group.setAttribute('class', `cs-edge is-${classes[i]}`);
        const label = one(svg, `[data-edge-label="${i}"]`);
        label.setAttribute('class', `cs-label is-${classes[i]}`);
        setText(one(label, 'text'), fmt(edge.weight));
      });
      groups.sort((a, b) => rank[classes[a.dataset.edge]] - rank[classes[b.dataset.edge]] || a.dataset.edge - b.dataset.edge)
        .forEach(group => linesLayer.appendChild(group));
      // Readout of every pass, the selected DPO pairs and the resolved order.
      const log = one(root, '[data-demo-state="cs-log"]');
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
      const listed = kind => edges.map((edge, i) => [edge, i]).filter(([, i]) => kind(i)).map(([edge]) => judgment(edge)).join(', ') || 'none';
      const pairs = listed(i => result.heuristic.has(i));
      const contradictions = listed(i => result.stage.get(i) === 'contradictory');
      setText(one(root, '[data-cs-pairs]'), pairs);
      setText(one(root, '[data-cs-contradictions]'), contradictions);
      setText(one(root, '[data-cs-order]'), result.order.join(' ≻ '));
      setText(one(root, '[data-cs-desc]'), `Arrows point to the less preferred response. DPO pairs: ${pairs}. Contradictory: ${contradictions}.`);
      setText(one(root, '[data-cs-pair-count]'), `${result.heuristic.size} of ${edges.length} judgments`);
    };

    const flip = i => { const edge = edges[i]; edges[i] = { ...edge, winner: edge.loser, loser: edge.winner }; render(); };
    const nudge = (i, delta) => { edges[i] = { ...edges[i], weight: Math.min(MAX, Math.max(MIN, edges[i].weight + delta)) }; render(); };
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-demo-action]');
      if (button && root.contains(button)) {
        const i = Number(button.dataset.edge);
        const action = button.dataset.demoAction;
        if (action === 'cs-flip') flip(i);
        else if (action === 'cs-up') nudge(i, STEP);
        else if (action === 'cs-down') nudge(i, -STEP);
        else if (action === 'cs-reset') { edges = defaults.map(edge => ({ ...edge })); render(); }
        return;
      }
      // Pointer shortcut: clicking an arrow flips it. Keyboard users use the list buttons.
      const group = event.target.closest('.cs-edge');
      if (group && svg.contains(group)) flip(Number(group.dataset.edge));
    });
    svg.classList.add('is-interactive');
    render();
  }

  /* ---------------- From Atomic to Composite ---------------- */

  function attachAtomic(root) {
    // Figure 1(a) of arXiv 2512.01970v1: one entity, three task types.
    const tasks = {
      memory: {
        kind: 'Parametric reasoning: both facts are stored in the model',
        question: 'What is the occupation of the business partner of Amina Khan?',
        context: [],
        memory: ['Ben Carter is a business partner with Amina Khan.', 'Ben Carter is a Research Analyst.'],
        trace: [['Memory', 'Amina Khan', 'business partner', 'Ben Carter'], ['Memory', 'Ben Carter', 'occupation', 'Research Analyst']],
        answer: 'Research Analyst',
        status: 'Two hops, both from parametric memory. No document is supplied.',
      },
      context: {
        kind: 'Contextual reasoning: both facts are in the supplied document',
        question: 'Who is the best friend of Global View’s Chief Editor?',
        context: ['‘Global View’ magazine announces the appointment of Amina Khan as its editor-in-chief.', 'Amina Khan’s best friend is Chloe Davis.'],
        memory: [],
        trace: [['Context', 'Global View', 'chief editor', 'Amina Khan'], ['Context', 'Amina Khan', 'best friend', 'Chloe Davis']],
        answer: 'Chloe Davis',
        status: 'Two hops, both read from the document. No stored fact is needed.',
      },
      combined: {
        kind: 'Complementary reasoning: the path crosses from the document into memory',
        question: 'What is the occupation of the business partner of Global View’s new Chief Editor?',
        context: ['‘Global View’ magazine announces the appointment of Amina Khan as its editor-in-chief.'],
        memory: ['Ben Carter is a business partner with Amina Khan.', 'Ben Carter’s job is as a Research Analyst.'],
        trace: [['Context', 'Global View', 'chief editor', 'Amina Khan'], ['Memory', 'Amina Khan', 'business partner', 'Ben Carter'], ['Memory', 'Ben Carter', 'occupation', 'Research Analyst']],
        answer: 'Research Analyst',
        status: 'Three hops: the document supplies the first, parametric memory the other two.',
      },
    };
    const sources = (element, facts, empty) => {
      if (facts.length) { element.textContent = facts.join(' '); return; }
      const note = document.createElement('span');
      note.className = 'ac-empty';
      note.textContent = empty;
      element.replaceChildren(note);
    };
    const render = key => {
      const task = tasks[key];
      one(root, '[data-demo-state="atomic-task"]').dataset.task = key;
      setText(one(root, '[data-atomic-kind]'), task.kind);
      setText(one(root, '[data-atomic-question]'), task.question);
      sources(one(root, '[data-atomic-context]'), task.context, 'None: the question is asked directly.');
      sources(one(root, '[data-atomic-memory]'), task.memory, 'Not needed for this question.');
      one(root, '[data-atomic-trace]').replaceChildren(...task.trace.map(([source, head, relation, tail]) => {
        const item = document.createElement('li');
        item.dataset.source = source.toLowerCase();
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
    all(root, '[data-demo-action="atomic-task"]').forEach(button => button.addEventListener('click', () => render(button.dataset.task)));
  }

  function initialize() {
    const attach = { 'atomic-trace': attachAtomic, 'preference-graph': attachContraSolver };
    all(document, '[data-reasoning-demo]').forEach(root => {
      if (root.dataset.reasoningReady === 'true') return;
      const initializeDemo = attach[root.dataset.reasoningDemo];
      if (!initializeDemo) return;
      initializeDemo(root);
      root.dataset.reasoningReady = 'true';
      all(root, '.rd-controls').forEach(controls => { controls.hidden = false; });
      all(root, '[data-demo-action]').forEach(control => { control.hidden = false; });
      all(root, '.rd-static').forEach(fallback => { fallback.hidden = true; });
    });
  }

  // Exposed for the browser test harness (tests/browser_demo_reasoning.js).
  window.ReasoningDemo = Object.freeze({ solveContraSolver });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
