/* Knowledge demos: History Matters (edit sequence + measured results), MC-MKE
 * (edit propagation + measured results), EchoQA (recorded case).
 * Run against the local preview with: agent-browser eval --stdin < tests/browser_demo_knowledge.js
 * Checks placement, the animated steps (Play / Step / Reset, reduced motion), exact
 * record strings and measured table values, keyboard semantics, 320px layout, and the
 * script-free state. Expected texts are written out here, not read from the page config.
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
  const text = (root, selector) => (root.querySelector(selector)?.textContent ?? '').trim();
  const act = (root, action, value) => root.querySelector(`[data-demo-action="${action}"]${value === undefined ? '' : `[data-value="${value}"]`}`).click();
  const pressed = (root, action) => [...root.querySelectorAll(`[data-demo-action="${action}"]`)]
    .filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.value);
  const visible = el => Boolean(el) && el.getClientRects().length > 0;

  /* ------------------------------------------------------------ History Matters: placement */
  let doc = await load('history-matters');
  const seq = doc.querySelector('[data-paper-demo="knowledge-temporal-sequence"]');
  const res = doc.querySelector('[data-paper-demo="knowledge-temporal-results"]');
  check(seq && seq.closest('#method') && seq.closest('.method-demo'), 'History: edit sequence sits in Method');
  check(res && res.closest('#findings') && res.closest('.evidence-demo'), 'History: measured results sit in Evidence');
  check(!doc.querySelector('#explore') && !doc.querySelector('.results-table'), 'History: no Explore section and no duplicate results table');
  check(seq.dataset.demoReady === 'true' && res.dataset.demoReady === 'true', 'History: both parts initialize');
  check(!seq.querySelector('[data-demo-controls]').hidden, 'History: player revealed by script');
  check(seq.querySelector('.kd-eyebrow').textContent.includes('Released AToKe record') && res.querySelector('.kd-eyebrow').textContent === 'Measured · Tables 2–3, GPT-J 6B', 'History: eyebrows name the evidence');
  check(!seq.querySelector('[data-hm-dumbbells]') && !res.querySelector('[data-hm-sequence]') && !res.querySelector('.kd-periods'), 'History: the two parts do not duplicate each other');

  /* ------------------------------------------------------------ History Matters: sequence steps */
  const cell = (form, column) => seq.querySelector(`[data-form="${form}"] [data-hm-cell="${column}"]`);
  const cellPrompts = (form, column) => [...cell(form, column).querySelectorAll('.kd-cloze')].map(el => el.firstChild.textContent);
  const cellAnswers = (form, column) => [...cell(form, column).querySelectorAll('.kd-answer')].map(el => el.textContent);
  const linkStatus = index => text(seq, `[data-hm-link="${index}"] [data-hm-link-status]`);
  const reqVisible = () => [...seq.querySelectorAll('[data-hm-req]')].filter(row => !row.hidden).map(row => `${row.dataset.hmReqKind || 'meto'}${row.dataset.hmReq}`).join();
  const finalStatus = 'Edit 2 applied: Arsenal F.C., 1948–1953. Southampton F.C. is now historical. Same wording, new expected answer: CRS, HRS. New time span in the prompt: CES, CES-P, HES. Asked for the first time: HES*. The multiple-edit (AToKe-ME) case ends here.';
  check(seq.dataset.step === '2' && text(seq, '[data-step-status]') === finalStatus, 'History: initial view is the end of the sequence');
  check(pressed(seq, 'goto').join() === '2' && seq.querySelector('[data-demo-action="step"]').disabled, 'History: last step pressed, Step disabled at the end');

  act(seq, 'reset');
  check(seq.dataset.step === '0' && text(seq, '[data-step-status]') === "Before editing: GPT-J's model-time fact is Manchester United F.C. (1937–1947). AToKe asks no question yet.", 'History Reset: before-editing status');
  check(seq.querySelectorAll('[data-hm-cell].is-pending').length === 11 && !visible(cell('CES', 1).querySelector('.kd-cell-body')), 'History Reset: every probe cell pending');
  check(linkStatus(0) === 'Current · known to GPT-J before editing' && linkStatus(1) === 'Edit 1 · not applied yet' && seq.querySelector('[data-hm-link="0"]').classList.contains('is-current'), 'History Reset: only the model-time fact is current');
  check(!seq.querySelector('[data-hm-request-empty]').hidden && seq.querySelector('[data-hm-request-grid]').hidden, 'History Reset: no edit request yet');
  check(!seq.querySelector('[data-demo-action="step"]').disabled && pressed(seq, 'goto').join() === '0', 'History Reset: Step enabled, first step pressed');

  act(seq, 'step');
  check(seq.dataset.step === '1' && text(seq, '[data-step-status]') === 'Edit 1 applied: Southampton F.C., 1947–1948. Manchester United F.C. is now historical. Asked for the first time: CES, CES-P, CRS, HES, HRS. A single-edit (AToKe-SE) case ends here.', 'History Step 1: status');
  check(linkStatus(0) === 'Historical · span closed in 1947' && linkStatus(1) === 'Current · written by edit 1' && linkStatus(2) === 'Edit 2 (multiple edits only) · not applied yet', 'History Step 1: timeline');
  check(!cell('CES', 1).classList.contains('is-pending') && cell('CES', 2).classList.contains('is-pending'), 'History Step 1: first column filled, second pending');
  check(seq.querySelectorAll('.is-entering').length > 0, 'History Step 1: changed elements are marked');
  check(reqVisible() === 'plain1,meto0,meto1', 'History Step 1: edit-1 request rows');
  check(text(seq, '[data-hm-req="1"][data-hm-req-kind="plain"] td') === 'From 1947 to 1948, Billy Wrigglesworth is a player of', 'History Step 1: existing-editor prompt is the record time_prompt');
  const metoRow = index => [...seq.querySelectorAll(`[data-hm-req="${index}"]:not([data-hm-req-kind]) td`)].map(td => td.textContent);
  check(metoRow(0).join('|') === '(Billy Wrigglesworth, playsFor, ?, 1937, 1947)|Manchester United F.C.|(Billy Wrigglesworth, playsFor, Manchester United F.C., ?, ?)|1937 to 1947', 'History Step 1: METO keeps the model-time fact');
  await wait(700);
  check(seq.querySelectorAll('.is-entering').length === 0, 'History: change marks clear within 700 ms');

  act(seq, 'step');
  check(seq.dataset.step === '2' && text(seq, '[data-step-status]') === finalStatus && seq.querySelector('[data-demo-action="step"]').disabled, 'History Step 2: final status');
  check(reqVisible() === 'plain2,meto0,meto1,meto2', 'History Step 2: METO targets every fact since the model-time fact');
  check(metoRow(2).join('|') === '(Billy Wrigglesworth, playsFor, ?, 1948, 1953)|Arsenal F.C.|(Billy Wrigglesworth, playsFor, Arsenal F.C., ?, ?)|1948 to 1953', 'History Step 2: Arsenal targets');

  // Probes and expected answers from the released record (AToKe-ME case_id 3).
  const probes = [
    ['CES', 1, ['From 1947 to 1948, Billy Wrigglesworth is a player of'], ['Southampton F.C.']],
    ['CES', 2, ['From 1948 to 1953, Billy Wrigglesworth is a player of'], ['Arsenal F.C.']],
    ['CES-P', 1, ['From 1947 to 1948, Billy Wrigglesworth plays for'], ['Southampton F.C.']],
    ['CRS', 1, ["Billy Wrigglesworth's team is"], ['Southampton F.C.']],
    ['CRS', 2, ["Billy Wrigglesworth's team is"], ['Arsenal F.C.']],
    ['HES', 1, ["From 1937 to 1947, Billy Wrigglesworth's team was"], ['Manchester United F.C.']],
    ['HES', 2, ["From 1947 to 1948, Billy Wrigglesworth's team was"], ['Southampton F.C.']],
    ['HRS', 1, ['Billy Wrigglesworth used to play for'], ['Manchester United F.C.']],
    ['HRS', 2, ['Billy Wrigglesworth used to play for'], ['Southampton F.C.']],
    ['HES*', 2, ["From 1937 to 1947, Billy Wrigglesworth's team was", "From 1947 to 1948, Billy Wrigglesworth's team was"], ['Manchester United F.C.', 'Southampton F.C.']],
  ];
  for (const [form, column, prompts, answers] of probes) {
    check(cellPrompts(form, column).join('|') === prompts.join('|') && cellAnswers(form, column).join('|') === answers.join('|'), `History ${form} after edit ${column}: ${answers.join(', ')}`);
  }
  const flag = form => text(cell(form, 2), '.kd-flag');
  check(flag('CRS') === 'Same wording, new answer' && flag('HRS') === 'Same wording, new answer' && flag('HES') === 'New time span' && flag('HES*') === 'First asked', 'History: change flags computed from the record');
  check(text(seq, '[data-form="HES*"] .is-never').startsWith('Not asked') && !seq.querySelector('[data-form="HES*"] [data-hm-cell="1"]'), 'History: HES* is never asked after edit 1');

  // Play runs both edits from the start without further input.
  seq.dataset.stepDelay = '60';
  act(seq, 'play');
  const playButton = seq.querySelector('[data-demo-action="play"]');
  check(seq.dataset.step === '0' && playButton.getAttribute('aria-pressed') === 'true' && playButton.textContent === 'Pause', 'History Play: restarts from the first step and shows Pause');
  await wait(400);
  check(seq.dataset.step === '2' && playButton.getAttribute('aria-pressed') === 'false' && playButton.textContent === 'Play', 'History Play: reaches the last edit and stops');
  act(seq, 'reset'); act(seq, 'play'); act(seq, 'play');
  const paused = seq.dataset.step;
  await wait(200);
  check(seq.dataset.step === paused && playButton.getAttribute('aria-pressed') === 'false', 'History Pause: stops the sequence');
  act(seq, 'goto', '1');
  check(seq.dataset.step === '1' && pressed(seq, 'goto').join() === '1', 'History: step toggle jumps to edit 1');

  // Reduced motion: Play advances one step per press, without marks.
  seq.dataset.motion = 'reduce';
  act(seq, 'reset'); act(seq, 'play');
  check(seq.dataset.step === '1' && playButton.getAttribute('aria-pressed') === 'false' && seq.querySelectorAll('.is-entering').length === 0, 'History reduced motion: one step, no marks');
  await wait(200);
  check(seq.dataset.step === '1', 'History reduced motion: no automatic advance');
  act(seq, 'play');
  check(seq.dataset.step === '2', 'History reduced motion: next press, next step');
  act(seq, 'play');
  check(seq.dataset.step === '0', 'History reduced motion: Play at the end restarts');
  check(doc.defaultView.getComputedStyle(seq.querySelector('.kd-periods li')).transitionDuration.split(',').every(d => parseFloat(d) === 0), 'History reduced motion: transitions disabled');
  delete seq.dataset.motion;
  const periodTransition = doc.defaultView.getComputedStyle(seq.querySelector('.kd-periods li')).transitionDuration.split(',').map(parseFloat);
  check(Math.max(...periodTransition) <= 0.6, 'History: transitions last at most 600 ms');
  check([...seq.querySelectorAll('.kd-player button')].every(button => button.type === 'button' && button.tabIndex === 0), 'History: player controls are keyboard-focusable buttons');

  /* ------------------------------------------------------------ History Matters: measured results */
  const pick = (root, action, value) => root.querySelector(`[data-demo-action="${action}"][data-value="${value}"]`).click();
  const hmSelect = (setting, form, editor) => { pick(res, 'hm-setting', setting); pick(res, 'hm-form', form); pick(res, 'hm-editor', editor); };
  check(text(res, '[data-hm-status]').startsWith('MEMIT · HES* · multiple edits: 0.27% without METO → 21.93% with METO (+21.66 points).'), 'History results: initial HES* cell');
  // Measured cells: Table 2 value, Table 3 value, change printed in Table 3 (GPT-J).
  const hmCells = [
    ['se', 'HES', 'MEMIT', '2.22', '30.31', '+28.09'],
    ['se', 'CES', 'MEMIT', '99.66', '86.4', '−13.26'],
    ['se', 'CES-P', 'MEND', '40.56', '33.45', '−7.11'],
    ['se', 'CRS', 'MEND', '32.46', '25.41', '−7.05'],
    ['se', 'CES', 'MEND', '80.47', '83.26', '+2.79'],
    ['se', 'HRS', 'ROME', '1.56', '16.29', '+14.73'],
    ['se', 'HES', 'CFT', '0.06', '3.38', '+3.32'],
    ['se', 'CES', 'ROME', '99.99', '99.95', '−0.04'],
    ['me', 'HES*', 'MEMIT', '0.27', '21.93', '+21.66'],
    ['me', 'HES', 'MEMIT', '0.48', '36.2', '+35.72'],
    ['me', 'CRS', 'ROME', '77.08', '82.4', '+5.32'],
    ['me', 'CES-P', 'MEND', '27.96', '28.41', '+0.45'],
    ['me', 'HES*', 'CFT', '0.01', '0.73', '+0.71'],
    ['me', 'HRS', 'MEND', '2.10', '30.83', '+28.73'],
  ];
  for (const [setting, form, editor, plain, meto, change] of hmCells) {
    hmSelect(setting, form, editor);
    const row = res.querySelector(`[data-hm-row="${editor}"]`);
    const label = `History ${setting}/${form}/${editor}`;
    check(row.classList.contains('is-selected') && res.querySelectorAll('.kd-dumbbell.is-selected').length === 1, `${label}: one selected dumbbell`);
    check(text(row, '[data-hm-plain]') === plain && text(row, '[data-hm-meto]') === meto && text(row, '[data-hm-change]') === change, `${label}: measured values ${plain} → ${meto} (${change})`);
    check(row.querySelector('.kd-db-meto').style.left === `${Number(meto)}%` && row.querySelector('.kd-db-plain').style.left === `${Number(plain)}%`, `${label}: markers placed at measured values`);
    check(text(res, '[data-hm-status]').includes(`${plain}% without METO → ${meto}% with METO (${change} points)`), `${label}: status reports the cell`);
    const mapped = res.querySelector('.kd-delta-map td.is-cell');
    check(mapped && mapped.textContent === change && mapped.dataset.editor === editor && mapped.closest('tr').dataset.form === form, `${label}: change map outlines the selected cell`);
    check(pressed(res, 'hm-setting').join() === setting && pressed(res, 'hm-form').join() === form && pressed(res, 'hm-editor').join() === editor, `${label}: aria-pressed follows selection`);
  }
  hmSelect('se', 'HES', 'MEMIT');
  check([...res.querySelectorAll('[data-hm-row] [data-hm-meto]')].map(el => el.textContent).join() === '3.38,30.14,20.25,30.31', 'History results: all editors shown for HES');
  check(text(res, '[data-hm-status]').includes('Over the same edits, CES moves from 99.66% to 86.4%.'), 'History results: historical gain reported with its current-accuracy cost');
  hmSelect('se', 'CES-P', 'MEND');
  check(text(res, '[data-hm-status]').includes('exact edit prompt improves (CES +2.79)'), 'History results: MEND paraphrase loss despite CES gain');
  hmSelect('me', 'HES*', 'ROME');
  pick(res, 'hm-setting', 'se');
  check(res.querySelector('[data-demo-action="hm-form"][data-value="HES*"]').hidden && pressed(res, 'hm-form').join() === 'HES' && res.querySelectorAll('[data-hm-map] tr').length === 5, 'History results: leaving multiple edits falls back from HES* to HES');

  /* ------------------------------------------------------------ MC-MKE: placement */
  doc = await load('mc-mke');
  const prop = doc.querySelector('[data-paper-demo="knowledge-multimodal-propagation"]');
  const mres = doc.querySelector('[data-paper-demo="knowledge-multimodal-results"]');
  check(prop && prop.closest('#method') && mres && mres.closest('#findings') && !doc.querySelector('#explore'), 'MC-MKE: propagation in Method, results in Evidence');
  check(prop.dataset.demoReady === 'true' && mres.dataset.demoReady === 'true', 'MC-MKE: both parts initialize');
  check(!mres.querySelector('[data-mc-knowledge]') && !prop.querySelector('[data-mc-plot]'), 'MC-MKE: example and measurements are not duplicated');

  /* ------------------------------------------------------------ MC-MKE: propagation steps */
  const role = key => text(prop, `[data-mc-knowledge="${key}"] [data-mc-role]`);
  const statement = key => text(prop, `[data-mc-knowledge="${key}"] [data-mc-text]`);
  const was = key => { const el = prop.querySelector(`[data-mc-knowledge="${key}"] [data-mc-was]`); return el.hidden ? '' : el.textContent; };
  check(prop.dataset.step === '2' && text(prop, '[data-mc-compose]') === '(image, Messi) ×e=s (Messi, plays for, Miami FC) = (image, plays for, Miami FC)', 'MC-MKE: initial view is the propagated IE_edit');
  act(prop, 'reset');
  check(statement('ie') === 'The player in the image is Mac Allister.' && statement('iro') === 'The player in the image plays for Liverpool.' && text(prop, '[data-mc-compose]') === '(image, Mac Allister) ×e=s (Mac Allister, plays for, Liverpool) = (image, plays for, Liverpool)', 'MC-MKE IE step 0: wrong recognition composes Liverpool');
  check(text(prop, '[data-step-status]') === 'Before the edit, the model recognizes Mac Allister in the image, and Mac Allister plays for Liverpool, so it answers Liverpool.', 'MC-MKE IE step 0: status');
  act(prop, 'step');
  check(statement('ie') === 'The player in the image is Messi.' && was('ie') === 'previously Mac Allister' && role('ie') === 'Edited · reliability probe', 'MC-MKE IE step 1: recognition edited');
  check(statement('iro') === 'The player in the image plays for Liverpool.' && role('iro') === 'Not recomputed yet' && prop.querySelector('[data-mc-knowledge="iro"]').classList.contains('kd-role-stale'), 'MC-MKE IE step 1: linked answer stale');
  check(text(prop, '[data-step-status]').includes('a method that stops here passes the reliability probe but fails the consistency probe'), 'MC-MKE IE step 1: reliability without consistency explained');
  act(prop, 'step');
  check(statement('iro') === 'The player in the image plays for Miami FC.' && was('iro') === 'previously Liverpool' && role('iro') === 'Must follow · consistency probe', 'MC-MKE IE step 2: image-based club must follow');
  check(statement('sro') === 'Messi plays for Miami FC.' && was('sro') === 'previously Mac Allister plays for Liverpool.', 'MC-MKE IE step 2: composition selects the new entity\'s fact (e = s)');
  check(text(prop, '[data-step-status]').includes('Edit target Messi; consistency target Miami FC. The targets differ'), 'MC-MKE IE: targets differ');
  pick(prop, 'mc-example', 'sro');
  check(prop.dataset.step === '2' && role('sro') === 'Edited · reliability probe (asked with a black image)' && role('iro') === 'Must follow · consistency probe' && was('sro') === 'previously Liverpool', 'MC-MKE SRO: textual fact edited, image answer follows');
  check(text(prop, '[data-step-status]').includes('The two targets are the same answer'), 'MC-MKE SRO: same target warning');
  check(prop.querySelector('[data-mc-route-group]').hidden, 'MC-MKE: route choice hidden outside IRO_edit');
  pick(prop, 'mc-example', 'iro');
  check(!prop.querySelector('[data-mc-route-group]').hidden && pressed(prop, 'mc-route').join() === 'reason', 'MC-MKE IRO: route choice shown, reason reading selected');
  check(statement('iro') === "Due to the player's transfer, the player in the image plays for Miami FC." && role('iro') === 'Edited with a reason · reliability probe', 'MC-MKE IRO: reason-bearing edit (Figure 2 string)');
  check(statement('sro') === 'Messi plays for Miami FC.' && role('sro') === 'Must follow · consistency probe' && role('ie') === 'Unchanged: a transfer keeps the same player', 'MC-MKE IRO: textual fact must follow, recognition unchanged');
  pick(prop, 'mc-route', 'recognition');
  check(statement('ie') === 'The player in the image is ẽ (not determined).' && prop.querySelector('[data-mc-knowledge="ie"]').classList.contains('kd-role-ambiguous') && text(prop, '[data-step-status]').includes('does not determine ẽ'), 'MC-MKE IRO: recognition reading is not unique');
  prop.dataset.motion = 'reduce';
  act(prop, 'play');
  check(prop.dataset.step === '0' && prop.querySelector('[data-demo-action="play"]').getAttribute('aria-pressed') === 'false', 'MC-MKE reduced motion: Play at the end restarts without playing on');
  act(prop, 'play');
  check(prop.dataset.step === '1', 'MC-MKE reduced motion: one step per press');
  delete prop.dataset.motion;
  pick(prop, 'mc-route', 'reason');
  prop.dataset.stepDelay = '50';
  act(prop, 'play');
  await wait(300);
  check(prop.dataset.step === '2' && prop.querySelector('[data-demo-action="play"]').getAttribute('aria-pressed') === 'false', 'MC-MKE Play: runs to the recomputed answer');

  /* ------------------------------------------------------------ MC-MKE: measured results */
  const mcSelect = (model, scenario, method) => { pick(mres, 'mc-model', model); pick(mres, 'mc-scenario', scenario); pick(mres, 'mc-method', method); };
  const metricRow = method => [...mres.querySelectorAll(`[data-mc-row="${method}"] td`)].map(td => td.textContent.replace('not evaluated', '').trim());
  check(text(mres, '[data-mc-status]').startsWith('FT(LLM) on IE_edit, InstructBLIP: reliability 98.48, consistency 9.09, locality 0.03.'), 'MC-MKE results: initial FT(LLM) IE_edit reading');
  // [model, scenario, method, reliability, consistency, locality, image gen., text gen.] from Tables 9–11.
  const mcCells = [
    ['instructblip', 'ie', 'FT(LLM)', '98.48', '9.09', '0.03', '96.41', '78.04'],
    ['instructblip', 'ie', 'SERAC', '98.48', '9.09', '87.65', '96.41', '68.41'],
    ['instructblip', 'ie', 'FT(Vision)', '89.57', '38.07', '0.34', '90.30', '24.10'],
    ['instructblip', 'ie', 'IKE', '68.26', '49.05', '—', '—', '76.33'],
    ['instructblip', 'sro', 'FT(LLM)', '99.49', '90.43', '3.95', '—', '79.59'],
    ['instructblip', 'sro', 'IKE', '81.06', '73.73', '94.18', '—', '55.87'],
    ['instructblip', 'iro', 'MEND(LLM)', '70.57', '50.50', '64.78', '72.05', '86.00'],
    ['minigpt', 'ie', 'IKE', '47.61', '60.60', '—', '—', '25.24'],
    ['minigpt', 'sro', 'MEND(Vision)', '4.37', '2.74', '93.50', '—', '3.29'],
    ['minigpt', 'iro', 'FT(Vision)', '98.98', '24.13', '73.71', '93.32', '98.78'],
    ['minigpt', 'iro', 'SERAC', '88.49', '84.32', '97.25', '87.25', '26.92'],
  ];
  for (const [model, scenario, method, ...values] of mcCells) {
    mcSelect(model, scenario, method);
    const label = `MC-MKE ${model}/${scenario}/${method}`;
    check(metricRow(method).join('|') === values.join('|'), `${label}: measured row ${values.join(', ')}`);
    const shown = [...mres.querySelectorAll('[data-mc-plot]')].filter(svg => !svg.hasAttribute('hidden'));
    check(shown.length === 1 && shown[0].dataset.mcPlot === `${model}-${scenario}` && shown[0].querySelectorAll('circle').length === 6, `${label}: one matching plot with six methods`);
    const dot = shown[0].querySelector(`[data-mc-method="${method}"]`);
    check(dot.classList.contains('is-selected') && Math.abs(Number(dot.getAttribute('cx')) - (48 + Number(values[0]) * 2.76)) < 0.06 && Math.abs(Number(dot.getAttribute('cy')) - (240 - Number(values[1]) * 2.28)) < 0.06, `${label}: point plotted at reliability ${values[0]}, consistency ${values[1]}`);
    check(pressed(mres, 'mc-model').join() === model && pressed(mres, 'mc-scenario').join() === scenario && pressed(mres, 'mc-method').join() === method, `${label}: aria-pressed follows selection`);
  }
  mcSelect('instructblip', 'ie', 'SERAC');
  check(text(mres, '[data-mc-status]').includes('equal FT(LLM) exactly') && text(mres, '[data-mc-status]').includes('(0.03 for FT(LLM))'), 'MC-MKE results: SERAC matches FT(LLM)');
  mcSelect('instructblip', 'sro', 'FT(LLM)');
  check(text(mres, '[data-mc-status]').includes('locality near zero') && text(mres, '[data-mc-status]').includes('On IE_edit the same method reaches 9.09'), 'MC-MKE results: SRO consistency read against locality');
  for (const [model, scenario, ftHigher, mendHigher] of [
    ['instructblip', 'ie', '38.07', '18.37'], ['instructblip', 'sro', '90.43', '55.90'],
    ['minigpt', 'ie', '16.67', '11.36'], ['minigpt', 'iro', '84.32', '6.72'],
  ]) {
    mcSelect(model, scenario, 'FT(Vision)');
    const higher = [...mres.querySelectorAll('[data-mc-components] td.is-higher')].map(td => td.textContent).join();
    check(higher === `${ftHigher},${mendHigher}`, `MC-MKE results ${model}/${scenario}: more consistent component`);
  }
  check(text(mres, '[data-mc-table]') === 'Table 11', 'MC-MKE results: table reference follows the scenario');

  /* ------------------------------------------------------------ EchoQA */
  doc = await load('knowledge-interplay');
  let root = doc.querySelector('[data-paper-demo="knowledge-evidence-composition"]');
  check(root.closest('#method') && !doc.querySelector('#explore') && doc.querySelector('.results-table'), 'EchoQA: recorded case in Method; the results table keeps the six-model numbers');
  check(!root.querySelector('[data-echo-rate]') && !root.querySelector('[data-condition]'), 'EchoQA: no aggregate bars that repeat one table row');
  root.querySelector('[data-demo-action="echo-with-context"]').click();
  check(text(root, '[data-echo-entity]') === 'Myotis nattereri' && text(root, '[data-echo-answer]') === 'Unknown', 'EchoQA: recorded context response abstains');
  check(root.querySelector('[data-echo-second-hop]').classList.contains('is-blocked') && !root.querySelector('[data-echo-first-hop]').classList.contains('is-blocked'), 'EchoQA: failed memory link marked');
  root.querySelector('[data-demo-action="echo-no-context"]').click();
  check(text(root, '[data-echo-entity]') === 'Myotis lucifugus' && text(root, '[data-echo-answer]') === 'Noctuidae', 'EchoQA: no-context shortcut replayed');
  check(root.querySelector('[data-demo-action="echo-no-context"]').getAttribute('aria-pressed') === 'true', 'EchoQA: aria-pressed follows the case toggle');

  /* ------------------------------------------------------------ Shared shell and layout */
  for (const slug of ['history-matters', 'mc-mke', 'knowledge-interplay']) {
    doc = await load(slug);
    for (const demo of doc.querySelectorAll('[data-paper-demo^="knowledge-"]')) {
      const name = `${slug}/${demo.dataset.paperDemo}`;
      const h3 = doc.defaultView.getComputedStyle(demo.querySelector('header h3'));
      const eyebrow = doc.defaultView.getComputedStyle(demo.querySelector('.kd-eyebrow'));
      check(h3.fontFamily.startsWith('Georgia') && h3.fontWeight === '400' && h3.fontSize === '23px', `${name}: serif demo heading`);
      check(eyebrow.textTransform === 'uppercase' && eyebrow.color === 'rgb(43, 97, 81)', `${name}: green uppercase eyebrow`);
      const rounded = [...demo.querySelectorAll('*')].filter(el => parseFloat(doc.defaultView.getComputedStyle(el).borderTopLeftRadius) > 0);
      check(rounded.length === 0, `${name}: square corners`);
      const shadows = [...demo.querySelectorAll('*')].filter(el => doc.defaultView.getComputedStyle(el).boxShadow !== 'none');
      check(shadows.length === 0, `${name}: no shadows`);
      check(demo.querySelectorAll('[role="status"][aria-live="polite"]').length >= 1, `${name}: live status region`);
      check([...demo.querySelectorAll('.kd-table-wrap')].every(wrap => wrap.tabIndex === 0), `${name}: scroll regions are keyboard focusable`);
      check([...demo.querySelectorAll('[data-demo-action="goto"], [data-demo-action^="hm-"], [data-demo-action^="mc-"], [data-demo-action="play"]')].every(button => button.hasAttribute('aria-pressed')), `${name}: toggles expose aria-pressed`);
    }
  }
  frame.style.width = '320px';
  for (const [slug, steps] of [
    ['history-matters', [['knowledge-temporal-sequence', 'reset'], ['knowledge-temporal-sequence', 'step'], ['knowledge-temporal-results', 'hm-setting', 'me'], ['knowledge-temporal-results', 'hm-form', 'HES*']]],
    ['mc-mke', [['knowledge-multimodal-propagation', 'mc-example', 'iro'], ['knowledge-multimodal-propagation', 'mc-route', 'recognition'], ['knowledge-multimodal-results', 'mc-model', 'minigpt'], ['knowledge-multimodal-results', 'mc-method', 'MEND(Vision)']]],
  ]) {
    doc = await load(slug);
    for (const [demo, action, value] of steps) act(doc.querySelector(`[data-paper-demo="${demo}"]`), action, value);
    check(doc.documentElement.scrollWidth <= 321, `${slug}: no page overflow at 320px after interaction`);
  }
  frame.style.width = '390px';

  /* ------------------------------------------------------------ Script-free fallback */
  frame.removeAttribute('src');
  for (const slug of ['history-matters', 'mc-mke', 'knowledge-interplay']) {
    const html = await fetch(`/papers/${slug}.html`).then(response => response.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    for (const demo of doc.querySelectorAll('[data-paper-demo]')) {
      check(![...demo.querySelectorAll('[data-demo-action]')].some(visible), `${slug}/${demo.dataset.paperDemo} (no JS): controls hidden`);
      check([...demo.querySelectorAll('[data-demo-state]')].filter(visible).every(el => el.textContent.trim().length > 20) && demo.querySelectorAll('[data-demo-state]').length > 0, `${slug}/${demo.dataset.paperDemo} (no JS): readable state`);
    }
    check(doc.documentElement.scrollWidth <= 391, `${slug} (no JS): no phone overflow`);
    if (slug === 'history-matters') {
      const s = doc.querySelector('[data-paper-demo="knowledge-temporal-sequence"]');
      check(text(s, '[data-step-status]') === finalStatus && s.querySelectorAll('[data-hm-cell].is-pending').length === 0, 'History (no JS): final step with every probe shown');
      check([...s.querySelectorAll('[data-hm-req]')].filter(row => !row.hidden).length === 4, 'History (no JS): edit-2 requests shown');
      check(text(doc, '[data-hm-status]').startsWith('MEMIT · HES* · multiple edits: 0.27% without METO → 21.93% with METO (+21.66 points).') && doc.querySelectorAll('[data-hm-map] tr').length === 6, 'History (no JS): measured cell and full change map');
    } else if (slug === 'mc-mke') {
      const p = doc.querySelector('[data-paper-demo="knowledge-multimodal-propagation"]');
      check(text(p, '[data-mc-compose]') === '(image, Messi) ×e=s (Messi, plays for, Miami FC) = (image, plays for, Miami FC)' && text(p, '[data-mc-knowledge="iro"] [data-mc-role]') === 'Must follow · consistency probe', 'MC-MKE (no JS): propagated IE_edit example');
      check([...doc.querySelectorAll('[data-mc-plot]')].filter(visible).length === 1 && doc.querySelectorAll('[data-mc-metrics] tr').length === 6, 'MC-MKE (no JS): one plot and full metric table');
      check(text(doc, '[data-mc-status]').startsWith('FT(LLM) on IE_edit, InstructBLIP: reliability 98.48, consistency 9.09'), 'MC-MKE (no JS): initial measured reading');
    } else {
      check(text(doc, '[data-echo-answer]') === 'Unknown' && text(doc, '[data-echo-entity]') === 'Myotis nattereri', 'EchoQA (no JS): recorded context case');
    }
  }
  frame.remove();
  return { assertions, failures };
})();
