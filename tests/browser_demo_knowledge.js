/* Knowledge demos: History Matters, MC-MKE, EchoQA.
 * Run against the local preview with: agent-browser eval --stdin < tests/browser_demo_knowledge.js
 * Checks that selections show the exact measured values from the papers' tables, that
 * the concrete probe text follows the selected question form, and that the static
 * (script-free) state is complete.
 */
(async () => {
  const failures = [];
  let assertions = 0;
  const check = (condition, label) => { assertions++; if (!condition) failures.push(label); };
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:900px;border:0;z-index:100;background:white';
  document.body.append(frame);
  const load = async slug => {
    await new Promise(resolve => { frame.onload = resolve; frame.src = `/papers/${slug}.html`; });
    return frame.contentDocument;
  };
  const text = (root, selector) => (root.querySelector(selector)?.textContent ?? '').trim();
  const pick = (root, action, value) => root.querySelector(`[data-demo-action="${action}"][data-value="${value}"]`).click();
  const pressed = (root, action) => [...root.querySelectorAll(`[data-demo-action="${action}"]`)]
    .filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.value);

  /* ------------------------------------------------------------ History Matters */
  let doc = await load('history-matters');
  let root = doc.querySelector('[data-paper-demo="knowledge-temporal-editing"]');
  check(root && root.dataset.demoReady === 'true', 'History: demo initializes');
  check(!root.querySelector('[data-demo-controls]').hidden, 'History: controls revealed by script');
  const hmSelect = (setting, form, editor) => { pick(root, 'hm-setting', setting); pick(root, 'hm-form', form); pick(root, 'hm-editor', editor); };

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
    const row = root.querySelector(`[data-hm-row="${editor}"]`);
    const label = `History ${setting}/${form}/${editor}`;
    check(row.classList.contains('is-selected') && root.querySelectorAll('.kd-dumbbell.is-selected').length === 1, `${label}: one selected dumbbell`);
    check(text(row, '[data-hm-plain]') === plain && text(row, '[data-hm-meto]') === meto && text(row, '[data-hm-change]') === change, `${label}: measured values ${plain} → ${meto} (${change})`);
    check(row.querySelector('.kd-db-meto').style.left === `${Number(meto)}%` && row.querySelector('.kd-db-plain').style.left === `${Number(plain)}%`, `${label}: markers placed at measured values`);
    check(text(root, '[data-hm-status]').startsWith(`${editor} · ${form} · `) && text(root, '[data-hm-status]').includes(`${plain}% without METO → ${meto}% with METO (${change} points)`), `${label}: status reports the cell`);
    const cell = root.querySelector('.kd-delta-map td.is-cell');
    check(cell && cell.textContent === change && cell.dataset.editor === editor && cell.closest('tr').dataset.form === form, `${label}: change map outlines the selected cell`);
    check(pressed(root, 'hm-setting').join() === setting && pressed(root, 'hm-form').join() === form && pressed(root, 'hm-editor').join() === editor, `${label}: aria-pressed follows selection`);
  }
  // All four editors stay visible at once for the selected form.
  hmSelect('se', 'HES', 'MEMIT');
  check([...root.querySelectorAll('[data-hm-row] [data-hm-meto]')].map(el => el.textContent).join() === '3.38,30.14,20.25,30.31', 'History: all editors shown for HES');
  check(text(root, '[data-hm-status]').includes('Over the same edits, CES moves from 99.66% to 86.4%.'), 'History: historical gain is reported with its current-accuracy cost');
  hmSelect('se', 'CES-P', 'MEND');
  check(text(root, '[data-hm-status]').includes('exact edit prompt improves (CES +2.79)') && text(root, '[data-hm-status]').includes('does not carry over'), 'History: MEND paraphrase loss despite CES gain');
  hmSelect('se', 'HES', 'CFT');
  check(text(root, '[data-hm-status]').includes('CFT barely learns the edit itself (CES 5.73%'), 'History: CFT caveat uses its measured CES');

  // Question-form text switching: the probe comes from the released AToKe record.
  const probes = [
    ['se', 'CES', 'From 1947 to 1948, Billy Wrigglesworth is a player of', 'Southampton F.C.', [1]],
    ['se', 'CES-P', 'From 1947 to 1948, Billy Wrigglesworth plays for', 'Southampton F.C.', [1]],
    ['se', 'CRS', "Billy Wrigglesworth's team is", 'Southampton F.C.', [1]],
    ['se', 'HES', "From 1937 to 1947, Billy Wrigglesworth's team was", 'Manchester United F.C.', [0]],
    ['se', 'HRS', 'Billy Wrigglesworth used to play for', 'Manchester United F.C.', [0]],
    ['me', 'CES', 'From 1948 to 1953, Billy Wrigglesworth is a player of', 'Arsenal F.C.', [2]],
    ['me', 'CRS', "Billy Wrigglesworth's team is", 'Arsenal F.C.', [2]],
    ['me', 'HES', "From 1947 to 1948, Billy Wrigglesworth's team was", 'Southampton F.C.', [1]],
    ['me', 'HRS', 'Billy Wrigglesworth used to play for', 'Southampton F.C.', [1]],
  ];
  for (const [setting, form, prompt, answer, links] of probes) {
    hmSelect(setting, form, 'MEMIT');
    const rows = root.querySelectorAll('[data-hm-probes] tr');
    check(rows.length === 1 && rows[0].querySelector('.kd-cloze').firstChild.textContent === prompt, `History ${setting}/${form}: probe text "${prompt}"`);
    check(rows[0].cells[1].textContent === answer, `History ${setting}/${form}: expected answer ${answer}`);
    check([...root.querySelectorAll('[data-hm-link].is-target')].map(el => Number(el.dataset.hmLink)).join() === links.join(), `History ${setting}/${form}: chain highlights the probed fact`);
    check(text(root, '[data-hm-code]') === form, `History ${setting}/${form}: form code shown`);
  }
  hmSelect('se', 'CES', 'MEMIT');
  check(text(root, '[data-hm-note]').includes('Identical to the edit prompt') && text(root, '.kd-targets td') === 'From 1947 to 1948, Billy Wrigglesworth is a player of', 'History: CES probe is the edit prompt itself');
  check(root.querySelector('[data-hm-probes] .kd-probe-question').textContent.includes('affiliate with from 1947 to 1948'), 'History: question format accompanies the cloze probe');
  check(root.querySelector('[data-hm-link="2"]').classList.contains('is-outside'), 'History: edit 2 is outside the single-edit setting');
  pick(root, 'hm-setting', 'me');
  check(!root.querySelector('[data-hm-link="2"]').classList.contains('is-outside'), 'History: edit 2 is part of the multiple-edit chain');
  check(!root.querySelector('[data-demo-action="hm-form"][data-value="HES*"]').hidden && root.querySelectorAll('[data-hm-map] tr').length === 6, 'History: HES* available after multiple edits');
  hmSelect('me', 'HES*', 'ROME');
  const starRows = [...root.querySelectorAll('[data-hm-probes] tr')];
  check(starRows.length === 2 && starRows[0].cells[1].textContent === 'Manchester United F.C.' && starRows[1].cells[1].textContent === 'Southampton F.C.', 'History: HES* re-asks every historical span');
  check(text(root, '[data-hm-when]') === 'Once, after the final edit', 'History: HES* timing stated');
  pick(root, 'hm-setting', 'se');
  check(root.querySelector('[data-demo-action="hm-form"][data-value="HES*"]').hidden && pressed(root, 'hm-form').join() === 'HES' && root.querySelectorAll('[data-hm-map] tr').length === 5, 'History: leaving multiple edits falls back from HES* to HES');
  check(text(root, '[data-hm-status]').includes('2.41% without METO → 20.25% with METO (+17.84 points)'), 'History: ROME single-edit HES after fallback');
  check(root.querySelector('.kd-targets').closest('.kd-requests').textContent.includes('1937 to 1947'), 'History: METO time objective targets are shown');

  /* ------------------------------------------------------------ MC-MKE */
  doc = await load('mc-mke');
  root = doc.querySelector('[data-paper-demo="knowledge-multimodal-consistency"]');
  check(root && root.dataset.demoReady === 'true', 'MC-MKE: demo initializes');
  const mcSelect = (model, scenario, method) => { pick(root, 'mc-model', model); pick(root, 'mc-scenario', scenario); pick(root, 'mc-method', method); };
  const metricRow = method => [...root.querySelectorAll(`[data-mc-row="${method}"] td`)].map(td => td.textContent.replace('not evaluated', '').trim());
  check(text(root, '[data-mc-status]').startsWith('FT(LLM) on IE_edit, InstructBLIP: reliability 98.48, consistency 9.09, locality 0.03.'), 'MC-MKE: initial FT(LLM) IE_edit reading');

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
    check(root.querySelector(`[data-mc-row="${method}"]`).classList.contains('is-selected') && root.querySelectorAll('[data-mc-metrics] tr').length === 6, `${label}: all six methods listed, selected row marked`);
    const visible = [...root.querySelectorAll('[data-mc-plot]')].filter(svg => !svg.hasAttribute('hidden'));
    check(visible.length === 1 && visible[0].dataset.mcPlot === `${model}-${scenario}`, `${label}: one matching plot visible`);
    const dot = visible[0].querySelector(`[data-mc-method="${method}"]`);
    check(dot.classList.contains('is-selected') && visible[0].querySelectorAll('circle.is-selected').length === 1, `${label}: selected point marked`);
    check(Math.abs(Number(dot.getAttribute('cx')) - (48 + Number(values[0]) * 2.76)) < 0.06 && Math.abs(Number(dot.getAttribute('cy')) - (240 - Number(values[1]) * 2.28)) < 0.06, `${label}: point plotted at reliability ${values[0]}, consistency ${values[1]}`);
    check(visible[0].querySelectorAll('circle').length === 6, `${label}: plot shows all six methods`);
    check(text(root, '[data-mc-status]').startsWith(`${method} on `) && text(root, '[data-mc-status]').includes(`reliability ${values[0]}, consistency ${values[1]}`), `${label}: status reports the method`);
    check(pressed(root, 'mc-model').join() === model && pressed(root, 'mc-scenario').join() === scenario && pressed(root, 'mc-method').join() === method, `${label}: aria-pressed follows selection`);
  }
  mcSelect('instructblip', 'ie', 'SERAC');
  check(text(root, '[data-mc-status]').includes('equal FT(LLM) exactly') && text(root, '[data-mc-status]').includes('(0.03 for FT(LLM))'), 'MC-MKE: SERAC matches FT(LLM) on reliability and consistency');
  check(visibleLabel(root, 'SERAC') === 'FT(L), SERAC', 'MC-MKE: coincident points share one label');
  mcSelect('instructblip', 'ie', 'FT(LLM)');
  check(text(root, '[data-mc-status]').includes('the linked answer follows on only 9.09%'), 'MC-MKE: high reliability without consistency');
  mcSelect('instructblip', 'sro', 'FT(LLM)');
  check(text(root, '[data-mc-status]').includes('locality near zero') && text(root, '[data-mc-status]').includes('On IE_edit the same method reaches 9.09'), 'MC-MKE: SRO consistency read against locality and IE_edit');
  mcSelect('minigpt', 'ie', 'IKE');
  check(text(root, '[data-mc-status]').includes('Consistency can exceed reliability') && text(root, '[data-mc-status]').includes('not evaluated'), 'MC-MKE: IKE caveats stated');
  // Which component to edit depends on the scenario (consistency, Figure 5 pattern).
  for (const [model, scenario, ftHigher, mendHigher] of [
    ['instructblip', 'ie', '38.07', '18.37'], ['instructblip', 'sro', '90.43', '55.90'],
    ['minigpt', 'ie', '16.67', '11.36'], ['minigpt', 'iro', '84.32', '6.72'],
  ]) {
    mcSelect(model, scenario, 'FT(Vision)');
    const higher = [...root.querySelectorAll('[data-mc-components] td.is-higher')].map(td => td.textContent).join();
    // Cell 0 is the row header, 1 is Vision, 2 is LLM.
    const column = [...root.querySelectorAll('[data-mc-components] tr')].map(tr => [...tr.cells].findIndex(td => td.classList.contains('is-higher')));
    check(higher === `${ftHigher},${mendHigher}` && column.join() === (scenario === 'ie' ? '1,1' : '2,2'), `MC-MKE ${model}/${scenario}: ${scenario === 'ie' ? 'vision' : 'LLM'} component more consistent`);
  }
  // Published example switches with the scenario (Figure 2).
  const role = key => text(root, `[data-mc-knowledge="${key}"] [data-mc-role]`);
  mcSelect('instructblip', 'ie', 'FT(LLM)');
  check(role('ie').startsWith('Edited') && role('iro').startsWith('Must follow') && text(root, '[data-mc-knowledge="ie"] [data-mc-was]') === 'previously Mac Allister', 'MC-MKE IE_edit: recognition edited, image-based club must follow');
  check(text(root, '[data-mc-table]') === 'Table 9' && text(root, '[data-mc-answers]').includes('Consistency target: Miami FC'), 'MC-MKE IE_edit: table reference and targets');
  pick(root, 'mc-scenario', 'sro');
  check(role('sro').startsWith('Edited') && role('iro').startsWith('Must follow') && root.querySelector('[data-mc-knowledge="ie"] [data-mc-was]').hidden, 'MC-MKE SRO_edit: textual fact edited, recognition unchanged');
  check(text(root, '[data-mc-table]') === 'Table 10', 'MC-MKE SRO_edit: Table 10');
  pick(root, 'mc-scenario', 'iro');
  check(role('iro').startsWith('Edited with a reason') && role('sro').startsWith('Must follow') && text(root, '[data-mc-knowledge="iro"] [data-mc-text]') === "Due to the player's transfer, the player in the image plays for Miami FC.", 'MC-MKE IRO_edit: reason-bearing image answer edited, text fact must follow');
  check(!root.querySelector('img'), 'MC-MKE: example is described in text, no photograph embedded');

  /* ------------------------------------------------------------ EchoQA (unchanged behaviour) */
  doc = await load('knowledge-interplay');
  root = doc.querySelector('[data-paper-demo="knowledge-evidence-composition"]');
  root.querySelector('[data-demo-action="echo-with-context"]').click();
  check(text(root, '[data-echo-entity]') === 'Myotis nattereri' && text(root, '[data-echo-answer]') === 'Unknown', 'EchoQA: recorded context response abstains');
  check(root.querySelector('[data-echo-second-hop]').classList.contains('is-blocked'), 'EchoQA: failed memory link marked');
  root.querySelector('[data-demo-action="echo-no-context"]').click();
  check(text(root, '[data-echo-entity]') === 'Myotis lucifugus' && text(root, '[data-echo-answer]') === 'Noctuidae', 'EchoQA: no-context shortcut replayed');
  check(root.querySelector('[data-demo-action="echo-no-context"]').getAttribute('aria-pressed') === 'true', 'EchoQA: aria-pressed follows the case toggle');
  for (const [condition, rate] of [['none', '23.89%'], ['neutral', '62.72%'], ['trust', '23.88%'], ['gold', '0.08%']]) {
    root.querySelector(`[data-condition="${condition}"]`).click();
    check(text(root, '[data-echo-aggregate]').includes(rate) && root.querySelector(`[data-echo-rate="${condition}"]`).classList.contains('is-selected'), `EchoQA ${condition}: measured rate ${rate}`);
  }
  check(root.querySelector('[data-echo-aggregate]').getAttribute('role') === 'status', 'EchoQA: aggregate is a live status');

  /* ------------------------------------------------------------ Shared shell and layout */
  for (const slug of ['history-matters', 'mc-mke', 'knowledge-interplay']) {
    doc = await load(slug);
    const demo = doc.querySelector('[data-paper-demo^="knowledge-"]');
    const h3 = doc.defaultView.getComputedStyle(demo.querySelector('header h3'));
    const eyebrow = doc.defaultView.getComputedStyle(demo.querySelector('.kd-eyebrow'));
    check(h3.fontFamily.startsWith('Georgia') && h3.fontWeight === '400', `${slug}: serif demo heading`);
    check(eyebrow.textTransform === 'uppercase' && eyebrow.color === 'rgb(43, 97, 81)', `${slug}: green uppercase eyebrow`);
    const callouts = [...demo.querySelectorAll('p, div')].filter(el => {
      const style = doc.defaultView.getComputedStyle(el);
      return parseFloat(style.borderLeftWidth) > 1 && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
    check(callouts.length === 0, `${slug}: no left-border callout boxes`);
    const rounded = [...demo.querySelectorAll('*')].filter(el => parseFloat(doc.defaultView.getComputedStyle(el).borderTopLeftRadius) > 0);
    check(rounded.length === 0, `${slug}: sharp corners`);
    check(demo.querySelectorAll('[role="status"][aria-live="polite"]').length >= 1, `${slug}: live status region`);
    check([...demo.querySelectorAll('.kd-table-wrap')].every(wrap => wrap.tabIndex === 0), `${slug}: scroll regions are keyboard focusable`);
  }
  frame.style.width = '320px';
  for (const [slug, steps] of [
    ['history-matters', [['hm-setting', 'me'], ['hm-form', 'HES*'], ['hm-editor', 'CFT']]],
    ['mc-mke', [['mc-scenario', 'iro'], ['mc-model', 'minigpt'], ['mc-method', 'MEND(Vision)']]],
  ]) {
    doc = await load(slug);
    root = doc.querySelector('[data-paper-demo]');
    for (const [action, value] of steps) pick(root, action, value);
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
    const demo = doc.querySelector('[data-paper-demo]');
    check(![...demo.querySelectorAll('[data-demo-action]')].some(el => el.getClientRects().length > 0), `${slug} (no JS): controls hidden`);
    check([...demo.querySelectorAll('[data-demo-state]')].filter(el => el.getClientRects().length > 0).every(el => el.textContent.trim().length > 20), `${slug} (no JS): readable state`);
    check(doc.documentElement.scrollWidth <= 391, `${slug} (no JS): no phone overflow`);
    if (slug === 'history-matters') {
      check(text(demo, '[data-hm-status]').includes('MEMIT · HES · single edit: 2.22% without METO → 30.31% with METO (+28.09 points).'), 'History (no JS): initial measured cell');
      check(text(demo, '[data-hm-probes] .kd-cloze').startsWith("From 1937 to 1947, Billy Wrigglesworth's team was") && text(demo, '[data-hm-probes] td:last-child') === 'Manchester United F.C.', 'History (no JS): concrete HES probe');
      check(demo.querySelectorAll('[data-hm-row]').length === 4 && demo.querySelectorAll('[data-hm-map] tr').length === 5, 'History (no JS): all editors and forms');
      check(demo.querySelector('.kd-delta-map td.is-cell').textContent === '+28.09', 'History (no JS): selected cell outlined');
      check(demo.textContent.includes('(Billy Wrigglesworth, playsFor, Manchester United F.C., ?, ?)'), 'History (no JS): METO time objective');
    } else if (slug === 'mc-mke') {
      check(text(demo, '[data-mc-status]').startsWith('FT(LLM) on IE_edit, InstructBLIP: reliability 98.48, consistency 9.09'), 'MC-MKE (no JS): initial reading');
      check([...demo.querySelectorAll('[data-mc-plot]')].filter(svg => svg.getClientRects().length > 0).length === 1, 'MC-MKE (no JS): one plot visible');
      check(demo.querySelectorAll('[data-mc-metrics] tr').length === 6 && demo.querySelectorAll('[data-mc-knowledge]').length === 3, 'MC-MKE (no JS): full table and decomposition');
      check(demo.textContent.includes('previously Mac Allister') && demo.textContent.includes('Miami FC'), 'MC-MKE (no JS): published example');
    } else {
      check(text(demo, '[data-echo-aggregate]').includes('62.72%'), 'EchoQA (no JS): measured rate');
    }
  }
  frame.remove();
  return { assertions, failures };

  function visibleLabel(scope, method) {
    const svg = [...scope.querySelectorAll('[data-mc-plot]')].find(el => !el.hasAttribute('hidden'));
    return [...svg.querySelectorAll('[data-mc-methods]')].find(el => el.dataset.mcMethods.split('|').includes(method))?.textContent ?? '';
  }
})();
