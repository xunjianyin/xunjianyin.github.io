/* DAMON MCTS demo. The page is complete without this script; it adds the
 * Step/Play/Reset animation, reward steppers and refusal pruning. Selection uses
 * the paper's UCT rule (eq. 4, omega = 1) and backpropagation uses eq. 5
 * (2025.emnlp-main.323). The tree is abstract: only dialogue-state ids and
 * strategy names; rewards are illustrative. No network or model calls.
 */
(() => {
  'use strict';

  const one = (root, selector) => root.querySelector(selector);
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const setText = (element, text) => { if (element && element.textContent !== text) element.textContent = text; };

  /* ---------------- The paper's MCTS ---------------- */

  function buildTree(config) {
    const nodes = {};
    nodes.root = { key: 'root', label: 'Initial request state', Q: config.initQ, N: 0, children: [], expanded: true, pruned: false, reward: null, strategy: null };
    config.strategies.forEach(strat => {
      nodes[strat.id] = { key: strat.id, label: strat.short, Q: config.initQ, N: 0, children: [], expanded: false, pruned: false, reward: null, strategy: strat.id };
      nodes.root.children.push(strat.id);
      strat.rewards.forEach((reward, i) => {
        const key = `${strat.id}-${i}`;
        nodes[key] = { key, label: `Sub-question ${i + 1}`, Q: config.initQ, N: 0, children: [], expanded: false, pruned: false, reward, strategy: strat.id };
        nodes[strat.id].children.push(key);
      });
    });
    return nodes;
  }

  const beta = (nodes, parent, childKey, omega) => {
    const child = nodes[childKey];
    if (child.N === 0) return Infinity;
    return child.Q + omega * Math.sqrt(Math.log(parent.N) / child.N);
  };

  function iterate(nodes, config) {
    const path = ['root'];
    let node = nodes.root;
    // Selection: descend by maximum UCT over non-pruned children.
    while (node.expanded) {
      const kids = node.children.filter(k => !nodes[k].pruned);
      if (!kids.length) break;
      const unvisited = kids.filter(k => nodes[k].N === 0);
      let next = unvisited.length ? unvisited[0] : kids[0];
      if (!unvisited.length) {
        let best = -Infinity;
        for (const k of kids) {
          const b = beta(nodes, node, k, config.omega);
          if (b > best) { best = b; next = k; }
        }
      }
      path.push(next);
      node = nodes[next];
    }
    // Expansion: a selected, unexpanded strategy reveals its sub-question leaves.
    let expandedKey = null;
    if (node.children.length && !node.expanded && !node.pruned) {
      node.expanded = true;
      expandedKey = node.key;
      const leaf = node.children[0];
      path.push(leaf);
      node = nodes[leaf];
    }
    if (node.key === 'root' && !node.reward) {
      return { path, score: null, selected: null, expandedKey: null, aborted: true };
    }
    // Simulation: observe the illustrative reward at the reached leaf.
    const score = node.reward !== null ? node.reward : node.Q;
    // Backpropagation: same score up the path (eq. 5).
    for (let i = path.length - 1; i >= 0; i--) {
      const n = nodes[path[i]];
      n.Q = (n.Q * n.N + score) / (n.N + 1);
      n.N += 1;
    }
    return { path, score, selected: node.key, expandedKey, success: node.reward !== null && node.reward >= config.threshold, aborted: false };
  }

  /* ---------------- Rendering ---------------- */

  function attach(root) {
    const config = JSON.parse(root.dataset.safetyConfig);
    const rewards = {};
    config.strategies.forEach(s => s.rewards.forEach((r, i) => { rewards[`${s.id}-${i}`] = r; }));
    const shortName = {};
    config.strategies.forEach(s => { shortName[s.id] = s.short; });
    const prunedSet = new Set();
    let nodes = null;
    let iteration = 0;
    let timer = null;
    let lastTrace = null;

    const fresh = () => {
      const cfg = { ...config, strategies: config.strategies.map(s => ({ ...s, rewards: [rewards[`${s.id}-0`], rewards[`${s.id}-1`]] })) };
      const built = buildTree(cfg);
      prunedSet.forEach(id => {
        built[id].pruned = true;
        built[id].children.forEach(child => { built[child].pruned = true; });
      });
      return built;
    };

    const statText = key => {
      const n = nodes[key];
      if (n.reward !== null) return `score ${rewards[key]} · N ${n.N}`;
      return `Q ${n.Q.toFixed(2)} · N ${n.N}`;
    };

    const clearHighlights = () => {
      all(root, '.sf-node').forEach(g => g.classList.remove('is-selected', 'is-expanded', 'is-success'));
      all(root, '.sf-edge').forEach(e => e.classList.remove('is-selected'));
    };

    const applyPruneClasses = () => {
      config.strategies.forEach(s => {
        const pruned = nodes[s.id].pruned;
        one(root, `.sf-node[data-node="${s.id}"]`).classList.toggle('is-pruned', pruned);
        one(root, `.sf-edge[data-edge="root-${s.id}"]`).classList.toggle('is-pruned', pruned);
        for (let i = 0; i < 2; i++) {
          one(root, `.sf-node[data-node="${s.id}-${i}"]`).classList.toggle('is-pruned', pruned);
          one(root, `.sf-edge[data-edge="${s.id}-${i}"]`).classList.toggle('is-pruned', pruned);
        }
      });
    };

    const renderStats = () => {
      Object.keys(nodes).forEach(key => setText(one(root, `[data-sf-stat="${key}"]`), statText(key)));
    };

    const renderTrace = trace => {
      clearHighlights();
      if (!trace || trace.aborted) return;
      for (let i = 1; i < trace.path.length; i++) {
        const key = trace.path[i];
        one(root, `.sf-node[data-node="${key}"]`).classList.add('is-selected');
        const parent = trace.path[i - 1];
        const edgeKey = parent === 'root' ? `root-${key}` : key;
        const edge = one(root, `.sf-edge[data-edge="${edgeKey}"]`);
        if (edge) edge.classList.add('is-selected');
      }
      if (trace.expandedKey) one(root, `.sf-node[data-node="${trace.expandedKey}"]`).classList.add('is-expanded');
      if (trace.success) one(root, `.sf-node[data-node="${trace.selected}"]`).classList.add('is-success');
    };

    const stageText = trace => {
      if (!trace) {
        return {
          selection: 'Descend from the root by maximum UCT value (eq. 4).',
          expansion: 'Decompose the selected state with the strategies.',
          simulation: 'Read the illustrative judge score at the reached leaf.',
          backprop: 'Update mean score Q and visit count N up the path (eq. 5).',
        };
      }
      if (trace.aborted) {
        return {
          selection: 'All branches are pruned; selection cannot descend.',
          expansion: 'Nothing to expand.',
          simulation: 'No leaf reached.',
          backprop: 'No update.',
        };
      }
      const names = trace.path.map(k => k === 'root' ? 'root' : (nodes[k].reward !== null ? nodes[k].label : shortName[k]));
      const strat = trace.path[1];
      return {
        selection: `Descended ${names.join(' → ')} by maximum UCT.`,
        expansion: trace.expandedKey ? `${shortName[trace.expandedKey]} decomposed into its sub-question states.` : `${shortName[strat]} was already expanded; no new states.`,
        simulation: `Judge score ${trace.score} at ${nodes[trace.selected].label} of ${shortName[strat]}.`,
        backprop: `Updated Q and N along the path (eq. 5).`,
      };
    };

    const render = (trace, markActive) => {
      renderStats();
      applyPruneClasses();
      renderTrace(trace);
      const stages = stageText(trace);
      for (const key of ['selection', 'expansion', 'simulation', 'backprop']) {
        setText(one(root, `[data-sf-stage="${key}"]`), stages[key]);
      }
      all(root, '.sf-stages li').forEach(li => li.classList.toggle('is-active', markActive && !!trace && !trace.aborted));
      const best = config.strategies
        .map(s => ({ name: shortName[s.id], Q: nodes[s.id].Q, N: nodes[s.id].N, pruned: nodes[s.id].pruned }))
        .filter(s => !s.pruned && s.N > 0)
        .sort((a, b) => b.Q - a.Q)[0];
      const summary = one(root, '[data-sf-summary]');
      summary.classList.toggle('is-success', !!trace && trace.success);
      if (iteration === 0) {
        setText(summary, 'No iterations run yet. Each strategy starts at Q 1.00, N 0; leaf scores are illustrative.');
      } else if (trace && trace.success) {
        setText(summary, `Iteration ${iteration}: ${shortName[trace.path[1]]} reached a leaf scoring ${config.threshold}, meeting the threshold τ — DAMON would exit here.`);
      } else {
        const visits = config.strategies.filter(s => !nodes[s.id].pruned).map(s => `${shortName[s.id]} N ${nodes[s.id].N} (Q ${nodes[s.id].Q.toFixed(2)})`).join(', ');
        const lead = best ? `${best.name} leads with mean score ${best.Q.toFixed(2)}.` : '';
        setText(summary, `After ${iteration} iteration${iteration === 1 ? '' : 's'}: ${visits}. ${lead}`);
      }
      setText(one(root, '[data-sf-iter]'), iteration === 0 ? 'Iteration 0 · press Step to run one MCTS iteration' : `Iteration ${iteration}`);
      setText(one(root, '[data-sf-desc]'), config.strategies.map(s => `${shortName[s.id]}: Q ${nodes[s.id].Q.toFixed(2)}, visited ${nodes[s.id].N} times`).join('. ') + '.');
    };

    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
      const play = one(root, '[data-demo-action="sf-play"]');
      play.setAttribute('aria-pressed', 'false');
      setText(play, 'Play');
    };

    const reset = () => {
      stop();
      nodes = fresh();
      iteration = 0;
      lastTrace = null;
      render(null, false);
    };

    const step = () => {
      const trace = iterate(nodes, config);
      if (!trace.aborted) iteration += 1;
      lastTrace = trace;
      render(trace, true);
      return trace;
    };

    // Reward steppers
    all(root, '[data-demo-action="sf-up"], [data-demo-action="sf-down"]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.leaf;
        const delta = button.dataset.demoAction === 'sf-up' ? 1 : -1;
        rewards[key] = Math.max(config.rewardMin, Math.min(config.rewardMax, rewards[key] + delta));
        setText(one(root, `[data-sf-reward="${key}"]`), String(rewards[key]));
        reset();
      });
    });
    // Refusal pruning
    all(root, '[data-demo-action="sf-prune"]').forEach(box => {
      box.addEventListener('change', () => {
        if (box.checked) prunedSet.add(box.dataset.strategy);
        else prunedSet.delete(box.dataset.strategy);
        reset();
      });
    });
    one(root, '[data-demo-action="sf-step"]').addEventListener('click', () => { stop(); step(); });
    one(root, '[data-demo-action="sf-reset"]').addEventListener('click', reset);
    one(root, '[data-demo-action="sf-play"]').addEventListener('click', event => {
      const button = event.currentTarget;
      if (timer) { stop(); return; }
      button.setAttribute('aria-pressed', 'true');
      setText(button, 'Pause');
      timer = setInterval(() => {
        const trace = step();
        if (trace.success) stop();
      }, 620);
    });

    reset();
  }

  function initialize() {
    all(document, '[data-safety-demo]').forEach(root => {
      if (root.dataset.safetyReady === 'true') return;
      attach(root);
      root.dataset.safetyReady = 'true';
      all(root, '.sf-controls, .sf-play').forEach(block => { block.hidden = false; });
      all(root, '[data-demo-action]').forEach(control => { control.hidden = false; });
    });
  }

  window.SafetyDemo = Object.freeze({ buildTree, iterate });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
