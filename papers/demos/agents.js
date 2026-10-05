/* Agent demos: DERL (arXiv 2512.13399v1) and ChemAgent (arXiv 2501.06590v1).
 * The page is complete without this script. It adds reader-started replays
 * (Play / Pause / Step / Reset), live recomputation of rewards and advantages
 * for DERL, and the branches and computed physics for ChemAgent. Arithmetic
 * and wording mirror scripts/paper_demo_agents.py exactly. No network or model calls.
 */
(() => {
  'use strict';

  const one = (root, selector) => root.querySelector(selector);
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const setText = (element, text) => { if (element && element.textContent !== text) element.textContent = text; };
  const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- Number formatting (same arithmetic as Python) ---------------- */

  const roundHalfUp = (value, digits) => {
    const scale = 10 ** digits;
    const magnitude = Math.floor(Math.abs(value) * scale + 0.5) / scale;
    return value < 0 ? -magnitude : magnitude;
  };
  function fixed(value, digits, signed = false) {
    let rounded = roundHalfUp(value, digits);
    if (rounded === 0) rounded = 0;
    const text = Math.abs(rounded).toFixed(digits);
    if (rounded < 0) return `−${text}`;
    return signed && rounded > 0 ? `+${text}` : text;
  }
  const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function sci(value, digits = 2) {
    const [mantissa, exponent] = value.toExponential(digits).split('e');
    return `${mantissa} × 10${[...String(Number(exponent))].map(c => SUPERSCRIPT[c]).join('')}`;
  }
  const precision = (value, digits = 3) => value.toPrecision(digits);

  /* ---------------- Reader-started replay ---------------- */

  /**
   * Play / Pause / Step / Reset over frames. Nothing moves until the reader
   * presses Play or Step; Reset (or a structural edit) returns to the
   * completed static state. first() is the frame Play and Step start from.
   */
  function createPlayer(root, prefix, { count, show, complete, first = () => 0 }) {
    const control = name => one(root, `[data-demo-action="${prefix}-${name}"]`);
    const play = control('play');
    const pause = control('pause');
    const step = control('step');
    const reset = control('reset');
    const status = one(root, `[data-player-status="${prefix}"]`);
    let index = -1;
    let timer = null;
    const delay = () => Number(root.dataset.frameMs) || 1400;
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
      setText(status, `Step ${k + 1} of ${count()} · ${show(k)}`);
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
        if (index < 0 || index >= count() - 1) go(index < 0 ? first() : 0);
        if (index >= count() - 1) return;
        timer = setTimeout(tick, delay());
        sync();
      },
      pause() { halt(); sync(); },
      step() { halt(); go(index < 0 ? first() : Math.min(index + 1, count() - 1)); },
      reset() { halt(); index = -1; complete(); setText(status, ''); sync(); },
      /** Re-render the current frame after an input change that keeps the replay. */
      refresh() { if (index >= 0) setText(status, `Step ${index + 1} of ${count()} · ${show(index)}`); else complete(); },
      get index() { return index; },
    };
    play.addEventListener('click', api.play);
    pause.addEventListener('click', api.pause);
    step.addEventListener('click', api.step);
    reset.addEventListener('click', api.reset);
    status.hidden = false;
    sync();
    return api;
  }

  /* ---------------- DERL: Meta-Reward parsing and scoring ---------------- */

  const CUT = ' ⋯';
  const STEP_EXAMPLE = [1, 0, 1, 1, 0, 0];

  class RewardSyntaxError extends Error {}

  function tokenize(text) {
    const pattern = /\s*(?:(\d+\.\d*|\.\d+|\d+)|(g[1-4])|(\*\*|[-+*/()]))/y;
    const tokens = [];
    let position = 0;
    while (position < text.length) {
      if (text.slice(position).trim() === '') break;
      pattern.lastIndex = position;
      const match = pattern.exec(text);
      if (!match) throw new RewardSyntaxError('unexpected character');
      tokens.push(match[1] || match[2] || match[3]);
      position = pattern.lastIndex;
    }
    return tokens;
  }

  /** Recursive descent with Python precedence; mirrors parse_reward in Python. */
  function parseReward(text) {
    const tokens = tokenize(text);
    let position = 0;
    const peek = () => (position < tokens.length ? tokens[position] : null);
    const take = () => {
      const token = peek();
      if (token === null) throw new RewardSyntaxError('expression ends early');
      position += 1;
      return token;
    };
    const expression = () => {
      let node = term();
      while (peek() === '+' || peek() === '-') node = ['bin', take(), node, term()];
      return node;
    };
    const term = () => {
      let node = factor();
      while (peek() === '*' || peek() === '/') node = ['bin', take(), node, factor()];
      return node;
    };
    const factor = () => {
      if (peek() === '+' || peek() === '-') {
        const sign = take();
        return sign === '-' ? ['neg', factor()] : factor();
      }
      return power();
    };
    const power = () => {
      let node = atom();
      if (peek() === '**') { take(); node = ['bin', '**', node, factor()]; }
      return node;
    };
    const atom = () => {
      const token = take();
      if (token === '(') {
        const node = expression();
        if (take() !== ')') throw new RewardSyntaxError('unclosed parenthesis');
        return node;
      }
      if (/^g[1-4]$/.test(token)) return ['var', Number(token[1]) - 1];
      if (/^(\d+\.\d*|\.\d+|\d+)$/.test(token)) return ['num', Number(token)];
      if (token === ')') throw new RewardSyntaxError('extra closing parenthesis');
      throw new RewardSyntaxError('unexpected operator');
    };
    const tree = expression();
    if (peek() === ')') throw new RewardSyntaxError('extra closing parenthesis');
    if (peek() !== null) throw new RewardSyntaxError('unexpected token');
    return tree;
  }

  function evaluate(tree, g) {
    const [kind] = tree;
    if (kind === 'num') return tree[1];
    if (kind === 'var') return g[tree[1]];
    if (kind === 'neg') { const inner = evaluate(tree[1], g); return inner === null ? null : -inner; }
    const [, op, left, right] = tree;
    const a = evaluate(left, g);
    const b = evaluate(right, g);
    if (a === null || b === null) return null;
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b === 0 ? null : a / b;
    const result = a ** b;
    return Number.isFinite(result) ? result : null;
  }

  function checkReward(text) {
    if (text.endsWith(CUT)) {
      let depth = 0;
      for (const token of tokenize(text.slice(0, -CUT.length))) {
        depth += token === '(' ? 1 : token === ')' ? -1 : 0;
        if (depth < 0) return { status: 'malformed', label: 'Fails to parse: extra “)” before the cut', tree: null };
      }
      return { status: 'truncated', label: 'Printed truncated; not evaluated', tree: null };
    }
    try {
      return { status: 'valid', label: 'Valid', tree: parseReward(text) };
    } catch (error) {
      if (!(error instanceof RewardSyntaxError)) throw error;
      return { status: 'malformed', label: `Fails to parse: ${error.message}`, tree: null };
    }
  }

  /** g1 = outcome; g2-g4 = mean step reward over the first, middle and last third (Section 4.2). */
  function primitives(steps, outcome) {
    const third = Math.floor(steps.length / 3);
    const means = [0, 1, 2].map(k => steps.slice(k * third, (k + 1) * third).reduce((a, b) => a + b, 0) / third);
    return [outcome, ...means];
  }

  /** GRPO group advantage (v - mean) / std, sample std (n - 1). */
  function advantages(scores) {
    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(scores.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (n - 1));
    return { mean, std, values: scores.map(v => (std ? (v - mean) / std : 0)) };
  }

  const scoreBoth = (tree, steps) => {
    if (!tree) return [null, null];
    return [evaluate(tree, primitives(steps, 1)), evaluate(tree, primitives(steps, 0))];
  };
  const isVeto = ([success, failure]) => success !== null && failure !== null && success <= failure;
  const rewardCell = value => (value === null ? '—' : fixed(value, 3));

  function vetoText(rows, steps) {
    const vetoes = rows.map(([text], k) => [checkReward(text), k + 1])
      .filter(([check]) => check.tree && isVeto(scoreBoth(check.tree, steps))).map(([, k]) => k);
    if (!vetoes.length) return 'every valid reward pays a success more than a failure';
    const plural = vetoes.length > 1;
    return `row${plural ? 's' : ''} ${vetoes.join(', ')} pay${plural ? '' : 's'} a success no more than a failure`;
  }

  function derlSummary(step, rows, steps) {
    const checks = rows.map(([text]) => checkReward(text));
    const count = status => checks.filter(check => check.status === status).length;
    const { mean, std } = advantages(rows.map(([, v]) => v));
    const parts = [`${count('valid')} valid`, `${count('malformed')} fail to parse`, `${count('truncated')} printed truncated`]
      .filter(part => !part.startsWith('0 '));
    return `Outer step ${step}: ${parts.join(', ')}. Mean v ${fixed(mean, 3)}, std ${fixed(std, 3)}. On this trajectory, ${vetoText(rows, steps)}.`;
  }

  function attachDerl(root) {
    const table = one(root, '[data-demo-state="derl-table"]');
    const data = JSON.parse(table.dataset.derlSteps);
    const body = one(root, '[data-dl-rows]');
    const loopItems = all(root, '[data-loop-stage]');
    let outer = 0; // outer step currently drawn
    let chosen = 0; // outer step of the completed view; replays start here and Reset returns here
    let steps = [...STEP_EXAMPLE];

    const rowsHtml = step => {
      const rows = data[step];
      const { values } = advantages(rows.map(([, v]) => v));
      return rows.map(([text, score], k) => {
        const check = checkReward(text);
        const both = scoreBoth(check.tree, steps);
        const a = values[k];
        const width = (Math.min(Math.abs(a), 2) / 2 * 50).toFixed(2);
        const bar = a >= 0 ? `left:50%;width:${width}%` : `right:50%;width:${width}%`;
        return `<tr class="dl-row is-${check.status}${isVeto(both) ? ' is-veto' : ''}" data-rollout="${k}">`
          + `<td class="dl-index">${k + 1}</td>`
          + `<td class="dl-expr" data-stage="1"><code class="dl-v" data-dl-expr>${esc(text)}</code></td>`
          + `<td class="dl-check" data-stage="1" data-label="Check"><span class="dl-v" data-dl-check>${esc(check.label)}</span></td>`
          + `<td class="num" data-stage="2" data-label="R, success"><span class="dl-v" data-dl-success>${rewardCell(both[0])}</span></td>`
          + `<td class="num" data-stage="2" data-label="R, failure"><span class="dl-v" data-dl-failure>${rewardCell(both[1])}</span></td>`
          + `<td class="num" data-stage="3" data-label="v"><span class="dl-v" data-dl-v>${score.toFixed(4)}</span></td>`
          + `<td class="dl-adv" data-stage="4" data-label="Advantage"><span class="dl-v"><span class="dl-adv-track" aria-hidden="true"><i class="${a >= 0 ? 'is-up' : 'is-down'}" style="${bar}"></i></span>`
          + `<span class="dl-adv-value" data-dl-adv>${fixed(a, 2, true)}</span></span></td></tr>`;
      }).join('');
    };

    // Rewrite R cells in place (the trajectory changed) so bars keep their transition.
    const rescore = () => {
      all(body, '[data-rollout]').forEach(row => {
        const [text] = data[outer][Number(row.dataset.rollout)];
        const check = checkReward(text);
        const both = scoreBoth(check.tree, steps);
        setText(one(row, '[data-dl-success]'), rewardCell(both[0]));
        setText(one(row, '[data-dl-failure]'), rewardCell(both[1]));
        row.classList.toggle('is-veto', isVeto(both));
      });
      all(root, '[data-reference]').forEach(row => {
        const tree = parseReward(one(row, '[data-dl-expr]').textContent);
        const both = scoreBoth(tree, steps);
        setText(one(row, '[data-dl-success]'), rewardCell(both[0]));
        setText(one(row, '[data-dl-failure]'), rewardCell(both[1]));
        row.classList.toggle('is-veto', isVeto(both));
      });
      const g = primitives(steps, 1);
      [1, 2, 3].forEach(t => setText(one(root, `[data-dl-g="${t}"]`), fixed(g[t], 2)));
      all(root, '[data-demo-action="derl-step"]').forEach(button => {
        const k = Number(button.dataset.step);
        setText(button, String(steps[k]));
        button.setAttribute('aria-pressed', String(Boolean(steps[k])));
        button.setAttribute('aria-label', `Interaction step ${k + 1} reward, currently ${steps[k]}`);
      });
      setText(one(root, '[data-dl-summary]'), derlSummary(outer, data[outer], steps));
    };

    const showOuter = step => {
      if (step !== outer || !body.dataset.rendered) {
        outer = step;
        body.innerHTML = rowsHtml(step);
        body.dataset.rendered = 'true';
      }
      setText(one(root, '[data-dl-caption]'), `Outer step ${step}: the eight Meta-Rewards the Meta-Optimizer sampled, as printed in Table 4, scored on the trajectory above.`);
      all(root, '[data-demo-action="derl-outer"]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.outer) === step)));
      all(root, '[data-dl-mean]').forEach(span => span.classList.toggle('is-current', Number(span.dataset.dlMean) === step));
      setText(one(root, '[data-dl-summary]'), derlSummary(step, data[step], steps));
    };

    /** Reveal columns up to a stage: 1 propose, 2 train, 3 validate, 4 update; 0 shows all. */
    const reveal = stage => {
      all(body, '[data-stage]').forEach(cell => cell.classList.toggle('is-future', stage > 0 && Number(cell.dataset.stage) > stage));
      all(table, 'thead th').forEach((th, k) => {
        const columnStage = [0, 1, 1, 2, 2, 3, 4][k];
        th.classList.toggle('is-future', stage > 0 && columnStage > stage);
      });
      loopItems.forEach(item => item.classList.toggle('is-current', Number(item.dataset.loopStage) === stage));
    };

    const describe = (step, stage) => {
      const rows = data[step];
      const checks = rows.map(([text]) => checkReward(text));
      const malformed = checks.filter(check => check.status === 'malformed').length;
      const truncated = checks.filter(check => check.status === 'truncated').length;
      const scores = rows.map(([, v]) => v);
      const { mean, std, values } = advantages(scores);
      if (stage === 1) {
        const parse = malformed ? `${malformed} fail to parse and are scored v = 0 without training` : 'every complete expression parses';
        return `Outer step ${step} · Propose: the Meta-Optimizer samples eight Meta-Rewards; ${parse}${truncated ? `; ${truncated} are printed truncated in the paper` : ''}.`;
      }
      if (stage === 2) return `Outer step ${step} · Train: each valid Meta-Reward trains its own policy with GRPO from the base model. On this trajectory, ${vetoText(rows, steps)}.`;
      if (stage === 3) return `Outer step ${step} · Validate: the published scores v run from ${Math.min(...scores).toFixed(4)} to ${Math.max(...scores).toFixed(4)}; mean ${fixed(mean, 3)}.`;
      const up = values.filter(a => a > 0).length;
      const next = step < data.length - 1 ? ` The updated Meta-Optimizer samples outer step ${step + 1}.` : ' Table 4 ends here.';
      return `Outer step ${step} · Update: advantage = (v − ${fixed(mean, 3)}) / ${fixed(std, 3)}; ${up} rewards are reinforced, ${values.length - up} suppressed.${next}`;
    };

    const frames = data.length * 4;
    const player = createPlayer(root, 'derl-run', {
      count: () => frames,
      first: () => chosen * 4,
      show: k => {
        const step = Math.floor(k / 4);
        const stage = (k % 4) + 1;
        showOuter(step);
        reveal(stage);
        return describe(step, stage);
      },
      complete: () => { showOuter(chosen); reveal(0); },
    });

    root.addEventListener('click', event => {
      const button = event.target.closest('[data-demo-action]');
      if (!button || !root.contains(button)) return;
      const action = button.dataset.demoAction;
      if (action === 'derl-outer') { chosen = Number(button.dataset.outer); player.reset(); }
      else if (action === 'derl-step') {
        const k = Number(button.dataset.step);
        steps[k] = 1 - steps[k];
        rescore();
        player.refresh();
      } else if (action === 'derl-steps-reset') { steps = [...STEP_EXAMPLE]; rescore(); player.refresh(); }
    });
    body.dataset.rendered = 'true'; // The server rendered outer step 0 with the default trajectory.
    rescore();
  }

  /* ---------------- ChemAgent: Figure 2 step-through ---------------- */

  const EV_J = 1.602e-19;
  const ELECTRON_KG = 9.109e-31;
  const PLANCK = 6.626e-34;
  const LIGHT = 2.998e8;

  function deBroglie(keEv) {
    const energy = keEv * EV_J;
    const velocity = Math.sqrt(2 * energy / ELECTRON_KG);
    const momentum = ELECTRON_KG * velocity;
    return { energy, velocity, momentum, wavelengthNm: PLANCK / momentum * 1e9, beta: velocity / LIGHT };
  }

  /** The three computed lines of panel (a); identical to chem_stages in Python at every energy. */
  function computedLines(keEv) {
    const phys = deBroglie(keEv);
    const note = keEv === 100 ? '' : ' (your input; the figure’s task uses 100 eV)';
    return {
      3: `v = √(2·KE/m) = √(2 × ${sci(phys.energy)} J / 9.109 × 10⁻³¹ kg) = ${sci(phys.velocity)} m/s${note}`,
      6: `p = m·v = ${sci(phys.momentum)} kg·m/s; λ = h/p = ${precision(phys.wavelengthNm)} nm${note}`,
      7: `λ = ${precision(phys.wavelengthNm)} nm for KE = ${keEv} eV; v/c = ${precision(phys.beta)} (the sub-tasks’ nonrelativistic formulas assume v ≪ c)${note}`,
    };
  }

  const POOLS = [['plan', 'Plan memory Mp'], ['execution', 'Execution memory Me'], ['knowledge', 'Knowledge memory Mk']];

  function attachChem(root) {
    const workspace = one(root, '.ch-workspace');
    const variants = JSON.parse(workspace.dataset.chemVariants);
    const energies = JSON.parse(workspace.dataset.chemKeChoices);
    const list = one(root, '[data-demo-state="chem-stages"]');
    let mode = 'a';
    let found = 'yes';
    let verify = 'correct';
    let ke = 100;

    const stages = () => {
      const base = variants[mode === 'a' ? `a-${found}` : `b-${verify}`].map(stage => ({ ...stage }));
      if (mode === 'a') Object.entries(computedLines(ke)).forEach(([k, line]) => { base[Number(k)].computed = line; });
      return base;
    };

    const renderStages = () => {
      list.innerHTML = stages().map((stage, k) => `<li class="ch-stage" data-chem-stage="${k}"><h5>${esc(stage.title)}</h5>`
        + `<blockquote class="ch-quote">${esc(stage.quote)}</blockquote>`
        + (stage.text ? `<p class="ch-text">${esc(stage.text)}</p>` : '')
        + (stage.computed ? `<p class="ch-computed"><span>Computed</span> ${esc(stage.computed)}</p>` : '')
        + '</li>').join('');
    };

    const renderPools = stage => {
      POOLS.forEach(([key]) => {
        const pool = one(root, `[data-pool="${key}"]`);
        pool.classList.toggle('is-active', stage.active.includes(key));
        const items = stage.pools[key];
        one(pool, `[data-pool-items="${key}"]`).innerHTML = items.length
          ? items.map(item => `<li class="${item.startsWith('New: ') ? 'is-new' : item.startsWith('Discard') ? 'is-gone' : ''}">${esc(item)}</li>`).join('')
          : '<li class="ag-empty">Empty</li>';
      });
    };

    const mark = k => {
      all(list, '[data-chem-stage]').forEach(item => {
        const s = Number(item.dataset.chemStage);
        item.classList.toggle('is-current', s === k);
        item.classList.toggle('is-done', k !== null && s < k);
        item.classList.toggle('is-future', k !== null && s > k);
        if (s === k) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
      });
    };

    const panelLabel = () => (mode === 'a'
      ? 'Figure 2(a) · library-enhanced reasoning on a test-set problem'
      : 'Figure 2(b) · library construction from a development-set problem');

    const complete = () => {
      const all_ = stages();
      mark(null);
      renderPools(all_[all_.length - 1]);
      setText(one(root, '[data-chem-library-label]'), 'Library after the last stage');
    };

    const player = createPlayer(root, 'chem-run', {
      count: () => stages().length,
      show: k => {
        const current = stages();
        mark(k);
        renderPools(current[k]);
        setText(one(root, '[data-chem-library-label]'), `Library after stage ${k + 1}`);
        return current[k].title;
      },
      complete,
    });

    const syncControls = () => {
      workspace.dataset.chemMode = mode;
      setText(one(root, '[data-chem-panel-label]'), panelLabel());
      all(root, '[data-demo-action="chem-mode"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      all(root, '[data-demo-action="chem-found"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.found === found)));
      all(root, '[data-demo-action="chem-verify"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.verify === verify)));
      all(root, '.ch-branches [data-branch]').forEach(group => { group.hidden = group.dataset.branch !== mode; });
      setText(one(root, '[data-chem-ke]'), `${ke} eV`);
      const position = energies.indexOf(ke);
      one(root, '[data-demo-action="chem-ke-down"]').disabled = position <= 0;
      one(root, '[data-demo-action="chem-ke-up"]').disabled = position >= energies.length - 1;
    };

    // Inputs keep the current stage of a replay; switching the panel restarts from the completed view.
    const update = structural => {
      renderStages();
      syncControls();
      if (structural) player.reset();
      else if (player.index >= 0) player.refresh();
      else complete();
    };
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-demo-action]');
      if (!button || !root.contains(button)) return;
      const action = button.dataset.demoAction;
      if (action === 'chem-mode') { mode = button.dataset.mode; update(true); }
      else if (action === 'chem-found') { found = button.dataset.found; update(false); }
      else if (action === 'chem-verify') { verify = button.dataset.verify; update(false); }
      else if (action === 'chem-ke-down' || action === 'chem-ke-up') {
        const position = energies.indexOf(ke) + (action === 'chem-ke-up' ? 1 : -1);
        ke = energies[Math.min(energies.length - 1, Math.max(0, position))];
        update(false);
      }
    });
    update(false);
  }

  function initialize() {
    const attach = { 'derl-loop': attachDerl, 'chem-library': attachChem };
    all(document, '[data-agents-demo]').forEach(root => {
      if (root.dataset.agentsReady === 'true') return;
      const initializeDemo = attach[root.dataset.agentsDemo];
      if (!initializeDemo) return;
      all(root, '.ag-controls').forEach(controls => { controls.hidden = false; });
      all(root, '[data-demo-action]').forEach(control => { control.hidden = false; });
      all(root, '.ag-static').forEach(fallback => { fallback.hidden = true; });
      initializeDemo(root);
      root.dataset.agentsReady = 'true';
    });
  }

  // Exposed for the browser test harness (tests/browser_demo_agents.js).
  window.AgentsDemo = Object.freeze({ parseReward, evaluate, checkReward, primitives, advantages, deBroglie, computedLines, fixed, sci });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
