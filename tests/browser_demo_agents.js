/* Agent demos (DERL, ChemAgent).
 * Run against the local preview, from any page on its origin:
 *   agent-browser eval --stdin < tests/browser_demo_agents.js
 * Run it once more under `agent-browser set media light reduced-motion`; the
 * motion checks switch to the reduced-motion expectations automatically.
 * DERL values are Table 4 (Appendix E) and Section 4.2 of arXiv 2512.13399v1;
 * rewards and advantages below were computed by hand and with an independent
 * Python script. ChemAgent strings are Figures 2 and 3 of arXiv 2501.06590v1.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html?test=${Date.now()}`; });
    return frame.contentDocument;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (condition, timeout = 4000) => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) await wait(20);
    return condition();
  };
  const text = (root, selector) => root.querySelector(selector).textContent.trim();
  const texts = (root, selector) => [...root.querySelectorAll(selector)].map(el => el.textContent.trim());
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const halfUp = (value, digits) => {
    const magnitude = Math.floor(Math.abs(value) * 10 ** digits + 0.5) / 10 ** digits;
    const out = magnitude.toFixed(digits);
    return value < 0 && magnitude !== 0 ? `−${out}` : magnitude === 0 ? out : `+${out}`;
  };

  /* ---------- DERL: published rollouts ---------- */
  let doc = await load('derl');
  let root = doc.querySelector('[data-agents-demo="derl-loop"]');
  check(root && root.dataset.agentsReady === 'true', 'DERL demo initializes');
  check(doc.querySelector('#method .method-lead + .section-demo.method-demo [data-agents-demo="derl-loop"]') && !doc.querySelector('#explore'), 'DERL demo sits after the first Method paragraph');
  check(doc.querySelector('.lead-visual .primary-figure'), 'DERL keeps its primary figure in the lead visual');
  check(text(root, '.ag-eyebrow') === 'Published · Table 4 rollouts and the Section 4.2 example', 'DERL eyebrow names the evidence');
  // Table 4 validation scores as printed, outer steps 0-3.
  const published = [
    ['0.0000', '0.0000', '0.8496', '0.8789', '0.0234', '0.8848', '0.0000', '0.8945'],
    ['0.7793', '0.0000', '0.0020', '0.0000', '0.8594', '0.8477', '0.8984', '0.0098'],
    ['0.0000', '0.0000', '0.8438', '0.0000', '0.8652', '0.8867', '0.8477', '0.8906'],
    ['0.8438', '0.8750', '0.8242', '0.8632', '0.8496', '0.8926', '0.8789', '0.8984'],
  ];
  const statuses = [
    'valid,malformed,truncated,truncated,valid,valid,malformed,valid',
    'truncated,truncated,valid,truncated,valid,valid,valid,valid',
    'malformed,truncated,valid,malformed,valid,valid,truncated,valid',
    'valid,valid,valid,valid,valid,valid,valid,valid',
  ];
  const outerButton = k => root.querySelector(`[data-demo-action="derl-outer"][data-outer="${k}"]`);
  const rows = () => [...root.querySelectorAll('[data-dl-rows] tr')];
  const status = row => ['valid', 'malformed', 'truncated'].find(name => row.classList.contains(`is-${name}`));
  for (let k = 0; k < 4; k++) {
    outerButton(k).click();
    check(rows().length === 8 && same(texts(root, '[data-dl-v]'), published[k]), `DERL outer step ${k}: the eight published scores`);
    check(rows().map(status).join(',') === statuses[k], `DERL outer step ${k}: parse checks`);
    check(rows().every(row => status(row) !== 'malformed' || text(row, '[data-dl-v]') === '0.0000'), `DERL outer step ${k}: every expression that fails to parse has the published v = 0`);
    // Independent GRPO advantage: (v - mean) / sample std over the eight.
    const v = published[k].map(Number);
    const mean = v.reduce((a, b) => a + b, 0) / 8;
    const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) * (x - mean), 0) / 7);
    check(same(texts(root, '[data-dl-adv]'), v.map(x => halfUp((x - mean) / std, 2))), `DERL outer step ${k}: advantages from the published scores`);
    check(outerButton(k).getAttribute('aria-pressed') === 'true' && text(root, '[data-dl-caption]').startsWith(`Outer step ${k}:`), `DERL outer step ${k}: chooser and caption`);
  }
  outerButton(0).click();
  check(text(root, '[data-rollout="0"] [data-dl-expr]') === 'g1 * (g2 - 1) / 2 + (g3 + 1) * (g4 - 1) * 2 / 3' && text(root, '[data-rollout="6"] [data-dl-expr]') === 'g1 + 0.5 * (g2 + 0.2 * (g3 + 0.1 * (g4 + 0.05))))', 'DERL expressions as printed');
  check(text(root, '[data-rollout="1"] [data-dl-check]') === 'Fails to parse: extra “)” before the cut' && text(root, '[data-rollout="6"] [data-dl-check]') === 'Fails to parse: extra closing parenthesis' && text(root, '[data-rollout="2"] [data-dl-check]') === 'Printed truncated; not evaluated', 'DERL parse messages');
  check(same(texts(root, '[data-dl-adv]'), ['−0.95', '−0.95', '+0.88', '+0.94', '−0.90', '+0.95', '−0.95', '+0.97']), 'DERL outer step 0 advantages (hand-checked)');
  outerButton(3).click();
  check(same(texts(root, '[data-dl-adv]'), ['−0.86', '+0.37', '−1.63', '−0.10', '−0.63', '+1.06', '+0.52', '+1.29']), 'DERL outer step 3: the same reward gets three different advantages');
  check(text(root, '[data-dl-summary]') === 'Outer step 3: 8 valid. Mean v 0.866, std 0.025. On this trajectory, every valid reward pays a success more than a failure.', 'DERL outer step 3 summary');
  outerButton(0).click();
  check(text(root, '[data-demo-state="derl-means"]') === 'Mean v per outer step, computed from Table 4: step 0: 0.441 · step 1: 0.425 · step 2: 0.542 · step 3: 0.866', 'DERL means computed from Table 4');

  /* ---------- DERL: six-step trajectory and live rewards ---------- */
  const g = () => texts(root, '[data-dl-g]');
  check(same(g(), ['0.50', '1.00', '0.00']), 'DERL default primitives equal Section 4.2 (0.5, 1, 0)');
  check(same(texts(root, '[data-dl-rows] [data-dl-success]'), ['−1.583', '—', '—', '—', '0.500', '1.563', '—', '1.167']) && same(texts(root, '[data-dl-rows] [data-dl-failure]'), ['−1.333', '—', '—', '—', '0.000', '0.563', '—', '0.000']), 'DERL outer step 0 rewards on the default trajectory');
  check(text(root, '[data-dl-summary]') === 'Outer step 0: 4 valid, 2 fail to parse, 2 printed truncated. Mean v 0.441, std 0.466. On this trajectory, row 1 pays a success no more than a failure.', 'DERL outer step 0 summary');
  check(rows()[0].classList.contains('is-veto') && !rows()[4].classList.contains('is-veto'), 'DERL row 1 (v = 0) pays a success less than a failure');
  outerButton(1).click();
  check(same(texts(root, '[data-dl-rows] [data-dl-success]'), ['—', '—', '−1.248', '—', '1.250', '1.030', '−3.300', '2.500']) && same(texts(root, '[data-dl-rows] [data-dl-failure]'), ['—', '—', '−0.414', '—', '0.250', '0.030', '−4.300', '2.750']), 'DERL outer step 1 rewards: negative rewards can still rank success first');
  check(text(root, '[data-dl-summary]').endsWith('rows 3, 8 pay a success no more than a failure.'), 'DERL outer step 1: the two near-zero rewards are the two that do not reward success');
  outerButton(0).click();
  const stepButton = k => root.querySelector(`[data-demo-action="derl-step"][data-step="${k}"]`);
  check([0, 1, 2, 3, 4, 5].every(k => stepButton(k).tagName === 'BUTTON' && stepButton(k).getAttribute('aria-pressed') === String([1, 0, 1, 1, 0, 0][k] === 1)), 'DERL six keyboard-operable step toggles show [1, 0, 1, 1, 0, 0]');
  stepButton(0).click();
  check(same(g(), ['0.00', '1.00', '0.00']) && text(rows()[4], '[data-dl-success]') === '0.000' && rows()[4].classList.contains('is-veto'), 'DERL clearing the first third: the product reward pays success nothing');
  check(text(root, '[data-dl-summary]').endsWith('rows 1, 5 pay a success no more than a failure.') && stepButton(0).getAttribute('aria-label') === 'Interaction step 1 reward, currently 0', 'DERL summary and label follow the edit');
  stepButton(2).click(); stepButton(3).click();
  const reference = name => [...root.querySelectorAll('[data-reference]')].find(row => text(row, 'th') === name);
  check(text(reference('Unstable product (Section 5.2)'), '[data-dl-success]') === '0.000' && reference('Unstable product (Section 5.2)').classList.contains('is-veto'), 'DERL the Section 5.2 product vetoes success when one primitive is zero');
  check(text(reference('Stable, normalized (Section 5.2)'), '[data-dl-success]') === '1.000' && text(reference('Invalid, negative (Section 5.2)'), '[data-dl-success]') === '−1.000', 'DERL reference compositions recompute');
  root.querySelector('[data-demo-action="derl-steps-reset"]').click();
  check(same(g(), ['0.50', '1.00', '0.00']) && text(reference('Avg reward (baseline)'), '[data-dl-success]') === '0.625' && text(reference('Avg reward (baseline)'), '[data-dl-failure]') === '0.375', 'DERL restore the Section 4.2 trajectory');
  const staticDerl = new DOMParser().parseFromString(await fetch('/papers/derl.html').then(r => r.text()), 'text/html');
  outerButton(2).click(); outerButton(0).click(); // forces the browser to redraw step 0 itself
  check(text(staticDerl, '[data-dl-rows]') === text(root, '[data-dl-rows]') && text(staticDerl, '[data-dl-summary]') === text(root, '[data-dl-summary]') && text(staticDerl, '[data-dl-reference]') === text(root, '[data-dl-reference]'), 'DERL server-rendered table equals the browser computation');
  const agents = frame.contentWindow.AgentsDemo;
  check(agents.evaluate(agents.parseReward('-2 ** 2'), [0, 0, 0, 0]) === -4 && agents.evaluate(agents.parseReward('2 ** -1'), [0, 0, 0, 0]) === 0.5 && agents.checkReward('g1 + (g2').status === 'malformed', 'DERL parser follows Python precedence and rejects unclosed parentheses');

  /* ---------- DERL: replay of the outer loop ---------- */
  const derlControl = name => root.querySelector(`[data-demo-action="derl-run-${name}"]`);
  const derlStatus = () => root.querySelector('[data-player-status="derl-run"]').textContent;
  const hiddenStages = () => [...new Set([...root.querySelectorAll('[data-dl-rows] .is-future')].map(cell => cell.dataset.stage))].sort().join('');
  const currentLoop = () => [...root.querySelectorAll('[data-loop-stage].is-current')].map(li => li.dataset.loopStage).join();
  check(root.dataset.playerState === 'complete' && derlStatus() === '' && hiddenStages() === '' && currentLoop() === '', 'DERL replay waits for the reader');
  await wait(250);
  check(root.dataset.playerState === 'complete', 'DERL no autoplay');
  derlControl('step').click();
  check(derlStatus() === 'Step 1 of 16 · Outer step 0 · Propose: the Meta-Optimizer samples eight Meta-Rewards; 2 fail to parse and are scored v = 0 without training; 2 are printed truncated in the paper.' && hiddenStages() === '234' && currentLoop() === '1', 'DERL stage 1: proposals and parse checks only');
  derlControl('step').click();
  check(derlStatus() === 'Step 2 of 16 · Outer step 0 · Train: each valid Meta-Reward trains its own policy with GRPO from the base model. On this trajectory, row 1 pays a success no more than a failure.' && hiddenStages() === '34' && currentLoop() === '2', 'DERL stage 2: rewards on the trajectory');
  derlControl('step').click();
  check(derlStatus() === 'Step 3 of 16 · Outer step 0 · Validate: the published scores v run from 0.0000 to 0.8945; mean 0.441.' && hiddenStages() === '4', 'DERL stage 3: published scores');
  derlControl('step').click();
  check(derlStatus() === 'Step 4 of 16 · Outer step 0 · Update: advantage = (v − 0.441) / 0.466; 4 rewards are reinforced, 4 suppressed. The updated Meta-Optimizer samples outer step 1.' && hiddenStages() === '' && currentLoop() === '4', 'DERL stage 4: group advantages');
  derlControl('step').click(); derlControl('step').click();
  check(outerButton(1).getAttribute('aria-pressed') === 'true' && text(root, '[data-rollout="0"] [data-dl-expr]').startsWith('(0.5 * (g1 - 0.1))') && currentLoop() === '2', 'DERL replay moves on to outer step 1');
  stepButton(4).click();
  check(root.dataset.playerFrame === '5' && derlStatus().startsWith('Step 6 of 16 · Outer step 1 · Train') && text(root, '[data-dl-g="3"]') === '0.50', 'DERL trajectory edits keep the replay frame');
  root.querySelector('[data-demo-action="derl-steps-reset"]').click();
  derlControl('reset').click();
  check(root.dataset.playerState === 'complete' && outerButton(0).getAttribute('aria-pressed') === 'true' && hiddenStages() === '' && derlStatus() === '', 'DERL Reset returns to the completed outer step 0');
  outerButton(3).click();
  root.dataset.frameMs = '20';
  derlControl('play').click();
  check(derlControl('play').getAttribute('aria-pressed') === 'true' && derlStatus().startsWith('Step 13 of 16 · Outer step 3 · Propose') && !derlControl('pause').disabled, 'DERL Play starts at the chosen outer step');
  check(await waitFor(() => root.dataset.playerState === 'paused' && root.dataset.playerFrame === '15'), 'DERL Play runs to the last stage');
  check(derlStatus() === 'Step 16 of 16 · Outer step 3 · Update: advantage = (v − 0.866) / 0.025; 4 rewards are reinforced, 4 suppressed. Table 4 ends here.' && derlControl('step').disabled && derlControl('pause').disabled, 'DERL final frame');
  outerButton(0).click();
  derlControl('play').click();
  await waitFor(() => Number(root.dataset.playerFrame) >= 2);
  derlControl('pause').click();
  const held = root.dataset.playerFrame;
  await wait(120);
  check(root.dataset.playerState === 'paused' && root.dataset.playerFrame === held, 'DERL Pause holds the frame');
  derlControl('reset').click();
  delete root.dataset.frameMs;

  /* ---------- ChemAgent: Figure 2 (a) ---------- */
  doc = await load('chemagent');
  root = doc.querySelector('[data-agents-demo="chem-library"]');
  check(root && root.dataset.agentsReady === 'true', 'ChemAgent demo initializes');
  check(doc.querySelector('#method .method-lead + .section-demo.method-demo [data-agents-demo="chem-library"]') && doc.querySelector('.lead-visual .primary-figure'), 'ChemAgent demo sits in Method; Figure 2 stays in the lead visual');
  check(text(root, '.ag-eyebrow') === 'Published example · Figure 2, memory examples from Figure 3', 'ChemAgent eyebrow names the evidence');
  const quotes = () => texts(root, '[data-chem-stage] .ch-quote');
  const computed = () => texts(root, '[data-chem-stage] .ch-computed');
  check(quotes().length === 8 && quotes()[0] === 'Calculate the de Broglie wavelength for (a) an electron with a kinetic energy of 100eV. The unit of the answer should be nm.', 'ChemAgent (a) task as printed');
  check(quotes()[1] === 'Sub-task 1: Use kinetic energy formula to calculate velocity of electron · Sub-task 2: Use de Broglie wavelength formula to compute wavelength · Sub-task n: ……', 'ChemAgent (a) decomposition as printed');
  check(quotes()[3] === '[Formula 1] p = m * v where p is …. [Step 1] Identify the given values:' && quotes()[6] === '[Formula 1] The kinetic energy can be calculated: KE = ½mv², where…', 'ChemAgent (a) sub-solution excerpts as printed');
  check(quotes()[4] === 'LLM → (Updated) Library' && quotes()[7] === 'Final answer ✓', 'ChemAgent (a) figure labels');
  // Independent physics with the figure's constants.
  const v100 = Math.sqrt(2 * 100 * 1.602e-19 / 9.109e-31);
  const lambda = ke => 6.626e-34 / Math.sqrt(2 * 9.109e-31 * ke * 1.602e-19) * 1e9;
  check(v100.toExponential(2) === '5.93e+6' && lambda(100).toPrecision(3) === '0.123', 'ChemAgent independent check: 5.93 × 10⁶ m/s and 0.123 nm');
  check(computed()[0].endsWith('= 5.93 × 10⁶ m/s') && computed()[1] === 'Computed p = m·v = 5.40 × 10⁻²⁴ kg·m/s; λ = h/p = 0.123 nm' && computed()[2].startsWith('Computed λ = 0.123 nm for KE = 100 eV; v/c = 0.0198'), 'ChemAgent computed velocity and wavelength at 100 eV');
  const staticChem = new DOMParser().parseFromString(await fetch('/papers/chemagent.html').then(r => r.text()), 'text/html');
  check(text(staticChem, '[data-demo-state="chem-stages"]') === text(root, '[data-demo-state="chem-stages"]') && text(staticChem, '[data-demo-state="chem-library"]') === text(root, '[data-demo-state="chem-library"]'), 'ChemAgent server state equals the browser rendering');
  const keUp = root.querySelector('[data-demo-action="chem-ke-up"]');
  const keDown = root.querySelector('[data-demo-action="chem-ke-down"]');
  keUp.click();
  check(text(root, '[data-chem-ke]') === '1000 eV' && computed()[1].includes(`λ = h/p = ${lambda(1000).toPrecision(3)} nm (your input; the figure’s task uses 100 eV)`) && lambda(1000).toPrecision(3) === '0.0388', 'ChemAgent tenfold energy shortens λ by √10');
  keUp.click();
  check(text(root, '[data-chem-ke]') === '10000 eV' && keUp.disabled && computed()[2].includes('v/c = 0.198'), 'ChemAgent energy clamps at 10 keV and v/c is reported');
  for (let k = 0; k < 4; k++) keDown.click();
  check(text(root, '[data-chem-ke]') === '1 eV' && keDown.disabled && computed()[1].includes('1.23 nm'), 'ChemAgent energy clamps at 1 eV');
  keUp.click(); keUp.click();
  check(text(root, '[data-chem-ke]') === '100 eV' && !computed()[1].includes('your input'), 'ChemAgent back to the figure’s energy');
  const pool = key => texts(root, `[data-pool-items="${key}"] li`);
  check(same(pool('knowledge'), ['Discarded after the problem']) && pool('plan').includes('New: strategy summary (T, K)') && pool('execution').length === 3, 'ChemAgent completed view shows the library after the problem');
  root.querySelector('[data-demo-action="chem-found"][data-found="no"]').click();
  check(quotes()[2] === 'If memory not found, then generate a task as imagination.' && pool('execution').includes('Synthetic practice problems on this topic'), 'ChemAgent not-found branch quotes the figure and adds synthetic memory');
  root.querySelector('[data-demo-action="chem-found"][data-found="yes"]').click();

  /* ---------- ChemAgent: replay ---------- */
  const chemControl = name => root.querySelector(`[data-demo-action="chem-run-${name}"]`);
  const chemStatus = () => root.querySelector('[data-player-status="chem-run"]').textContent;
  const stageMarks = () => [...root.querySelectorAll('[data-chem-stage]')].map(li => (li.classList.contains('is-current') ? 'C' : li.classList.contains('is-future') ? '-' : li.classList.contains('is-done') ? 'D' : '·')).join('');
  const activePools = () => [...root.querySelectorAll('[data-pool].is-active')].map(p => p.dataset.pool).join();
  check(root.dataset.playerState === 'complete' && stageMarks() === '········' && chemStatus() === '', 'ChemAgent replay waits for the reader');
  chemControl('step').click();
  check(stageMarks() === 'C-------' && chemStatus() === 'Step 1 of 8 · Test-set task' && same(pool('execution'), ['Units from the development set']) && same(pool('knowledge'), ['Empty']) && text(root, '[data-chem-library-label]') === 'Library after stage 1', 'ChemAgent stage 1: the task, library before the problem');
  chemControl('step').click();
  check(stageMarks() === 'DC------' && activePools() === 'plan,knowledge' && same(pool('knowledge'), ['Generated for this problem']), 'ChemAgent stage 2: decomposition uses plan and knowledge memory');
  chemControl('step').click();
  check(activePools() === 'execution,knowledge' && root.querySelector('[data-chem-stage="2"]').getAttribute('aria-current') === 'step', 'ChemAgent stage 3: sub-task 1 retrieves from execution and knowledge memory');
  root.querySelector('[data-demo-action="chem-found"][data-found="no"]').click();
  check(root.dataset.playerFrame === '2' && quotes()[2] === 'If memory not found, then generate a task as imagination.' && pool('execution').includes('Synthetic practice problems on this topic'), 'ChemAgent branch switch keeps the replay stage');
  root.querySelector('[data-demo-action="chem-found"][data-found="yes"]').click();
  chemControl('step').click(); chemControl('step').click();
  const newItem = root.querySelector('[data-pool-items="execution"] li.is-new');
  check(stageMarks() === 'DDDDC---' && newItem && newItem.textContent === 'New: {condition, Sub-task 1, Sub-solution 1}' && activePools() === 'execution', 'ChemAgent stage 5: the solved sub-task enters execution memory during the problem');
  chemControl('step').click(); chemControl('step').click(); chemControl('step').click();
  check(stageMarks() === 'DDDDDDDC' && chemControl('step').disabled && root.querySelector('[data-pool-items="knowledge"] li.is-gone') && chemStatus() === 'Step 8 of 8 · Summarize and generate → Final answer', 'ChemAgent last stage: knowledge memory is discarded');
  chemControl('reset').click();
  check(root.dataset.playerState === 'complete' && stageMarks() === '········', 'ChemAgent Reset');

  /* ---------- ChemAgent: Figure 2 (b) ---------- */
  root.querySelector('[data-demo-action="chem-mode"][data-mode="b"]').click();
  check(quotes().length === 5 && root.querySelector('[data-demo-action="chem-mode"][data-mode="b"]').getAttribute('aria-pressed') === 'true' && text(root, '[data-chem-panel-label]').startsWith('Figure 2(b)'), 'ChemAgent switches to panel (b)');
  check(quotes()[0] === 'Task: Given that the work function for sodium metal is 2.28eV, what is the threshold frequency v₀ for sodium? Solution: First, we need to convert the work function ϕ from electron volts (eV) to joules (J). This conversion can be done using the relation: 1eV = 1.602 × 10⁻¹⁹J. ……', 'ChemAgent (b) task and solution as printed');
  check(quotes()[1] === 'Condition 1: The work function for sodium metal is 2.28eV. Condition 2: ……', 'ChemAgent (b) conditions as printed');
  const nu = 2.28 * 1.602e-19 / 6.626e-34;
  check(nu.toExponential(2) === '5.51e+14' && computed()[0].endsWith('v₀ = ϕ/h = 5.51 × 10¹⁴ Hz'), 'ChemAgent (b) computed threshold frequency');
  const branchVisible = name => !root.querySelector(`.ch-branches [data-branch="${name}"]`).hidden;
  check(!branchVisible('a') && branchVisible('b') && root.querySelector('.ch-ke').hidden, 'ChemAgent shows only the branch controls of panel (b)');
  check(same(pool('execution'), ['{condition1, sub_task1, sub_solution1}', '{condition2, sub_task2, sub_solution2}']) && same(pool('plan'), ['(relevant task, relevant knowledge)']), 'ChemAgent (b) completed library');
  root.querySelector('[data-demo-action="chem-verify"][data-verify="wrong"]').click();
  check(quotes()[3].endsWith('→ Discard!') && pool('execution').includes('Discarded: {condition2, sub_task2, sub_solution2}') && root.querySelector('[data-pool-items="execution"] li.is-gone'), 'ChemAgent (b) a wrong unit is discarded');
  root.dataset.frameMs = '20';
  chemControl('play').click();
  check(await waitFor(() => root.dataset.playerState === 'paused' && root.dataset.playerFrame === '4'), 'ChemAgent (b) Play runs to the end');
  check(stageMarks() === 'DDDDC' && activePools() === 'plan,execution', 'ChemAgent (b) last stage adds plan memory to the library');
  chemControl('play').click();
  root.querySelector('[data-demo-action="chem-mode"][data-mode="a"]').click();
  check(root.dataset.playerState === 'complete' && quotes().length === 8 && branchVisible('a'), 'ChemAgent switching panel ends the replay');
  delete root.dataset.frameMs;

  /* ---------- Design constraints and layout ---------- */
  for (const slug of ['derl', 'chemagent']) {
    for (const width of [1440, 390, 320]) {
      frame.style.width = `${width}px`;
      doc = await load(slug);
      const demo = doc.querySelector('[data-paper-demo]');
      check(doc.documentElement.scrollWidth <= width + 1, `${slug} at ${width}: no page overflow`);
      const step = demo.querySelector('[data-demo-action$="-run-step"]');
      for (const replaying of [false, true]) {
        if (replaying) { step.click(); step.click(); }
        check(doc.documentElement.scrollWidth <= width + 1 && demo.scrollWidth <= demo.clientWidth + 1, `${slug} at ${width}${replaying ? ' replay' : ''}: demo fits its frame`);
        const clipped = [...demo.querySelectorAll('p,h3,h5,li,dd,button,span,td,th,code,blockquote')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2 && frame.contentWindow.getComputedStyle(el).display !== 'inline');
        check(clipped.length === 0, `${slug} at ${width}${replaying ? ' replay' : ''}: no clipped text ${clipped.map(el => el.className || el.tagName).join(' ')}`);
      }
      if (width === 1440) {
        const styled = [...demo.querySelectorAll('*')].map(el => [el, frame.contentWindow.getComputedStyle(el)]);
        check(styled.every(([, s]) => s.borderRadius === '0px' || s.borderRadius === ''), `${slug}: sharp corners`);
        check(styled.every(([, s]) => s.boxShadow === 'none' && s.backgroundImage === 'none'), `${slug}: no shadows or gradients`);
        check(styled.every(([, s]) => s.animationName === 'none'), `${slug}: no keyframe animation`);
        const longest = Math.max(0, ...styled.flatMap(([, s]) => s.transitionDuration.split(',').map(parseFloat)));
        check(reduced ? longest === 0 : longest <= 0.6, `${slug}: transitions ${reduced ? 'removed under reduced motion' : 'at most 600 ms'} (${longest}s)`);
        check(styled.every(([el, s]) => !el.matches('button') || s.transform === 'none'), `${slug}: no transforms on controls`);
        const h3 = frame.contentWindow.getComputedStyle(demo.querySelector('header h3'));
        check(h3.fontFamily.includes('Georgia') && h3.fontSize === '25px', `${slug}: Georgia 25px demo heading`);
        const group = demo.querySelector('.ag-player');
        check(group.getAttribute('role') === 'group' && demo.querySelector('[data-player-status]').getAttribute('aria-live') === 'polite', `${slug}: labelled controls and polite status`);
      }
    }
  }
  frame.style.width = '390px';

  /* ---------- Script-free fallback ---------- */
  for (const [slug, width] of [['derl', 390], ['derl', 320], ['chemagent', 390], ['chemagent', 320]]) {
    frame.style.width = `${width}px`;
    const html = await fetch(`/papers/${slug}.html`).then(r => r.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    frame.removeAttribute('src');
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    root = doc.querySelector('[data-paper-demo]');
    const visible = el => el.getClientRects().length > 0;
    check(![...root.querySelectorAll('[data-demo-action]')].some(visible) && ![...root.querySelectorAll('[data-player-status]')].some(visible), `${slug} no-JS ${width}: controls and replay status hidden`);
    check(doc.documentElement.scrollWidth <= width + 1, `${slug} no-JS ${width}: no page overflow`);
    if (slug === 'derl') {
      check(root.querySelectorAll('[data-dl-rows] tr').length === 8 && same([...root.querySelectorAll('[data-dl-v]')].filter(visible).map(el => el.textContent), published[0]), `${slug} no-JS: outer step 0 with every published score`);
      check([...root.querySelectorAll('[data-dl-static]')].filter(visible).map(el => el.textContent).join('') === '101100' && text(root, '[data-dl-summary]').startsWith('Outer step 0: 4 valid'), `${slug} no-JS: trajectory and summary readable`);
      check(!root.querySelector('.is-future'), `${slug} no-JS: every column shown`);
    } else {
      check(root.querySelectorAll('[data-chem-stage]').length === 8 && [...root.querySelectorAll('.ch-quote')].every(visible) && !root.querySelector('.is-future'), `${slug} no-JS: all eight stages of panel (a) readable`);
      check(text(root, '[data-pool-items="execution"]').includes('Sub-task 2') && root.querySelectorAll('.ch-example').length === 3, `${slug} no-JS: library and Figure 3 examples readable`);
    }
  }
  frame.remove();
  return { assertions, failures, reducedMotion: reduced };
})();
