/* Benchmark demos: ALCUNA (KnowGen builder), knowledge boundary (Table 1 explorer),
 * self-generated documents (style taxonomy explorer).
 * Run against the local preview with: agent-browser eval --stdin < tests/browser_demo_benchmarks.js
 * Expected strings and values are transcribed here from the papers (ALCUNA Figure 1;
 * knowledge-boundary Tables 1–4; Self-Docs Tables 2, 3, 10, 12, Figure 1, Appendix G.2),
 * independently of the page configuration.
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

  /* ------------------------------------------------------------ ALCUNA: KnowGen */
  let doc = await load('alcuna');
  let root = doc.querySelector('[data-paper-demo="benchmarks-knowgen"]');
  check(root && root.closest('#method') && root.closest('.method-demo') && !doc.querySelector('#explore'), 'ALCUNA: builder sits in Method');
  check(root.dataset.demoReady === 'true' && root.querySelectorAll('[data-demo-controls]:not([hidden])').length === 2, 'ALCUNA: initializes and reveals controls');
  check(text(root, '.bm-eyebrow') === 'Published example · Figure 1 · Algorithm 1', 'ALCUNA: eyebrow names the evidence');
  const props = () => [...root.querySelectorAll('[data-kg-props] li')].map(li => li.textContent.replace(/\s+/g, ' ').trim());
  const question = id => root.querySelector(`[data-kg-q="${id}"]`);
  const qSet = id => question(id).dataset.kgSet || '';
  const qAnswer = id => text(question(id), '[data-kg-answer]');
  const qSource = id => question(id).querySelector('.bm-q-source')?.dataset.source || '';
  // Figure 1: the artificial entity and its five printed questions.
  const figureProps = ['Body mass: 56.5kg [variation]', 'Life span [dropout]', 'Diet: leaves [heredity]', 'Eaten by: Jaguar [variation]', 'First appearance: middle Pleistocene age [extension]'];
  check(props().join('|') === figureProps.join('|'), 'ALCUNA: Figure 1 entity with all four operations');
  check(root.querySelector('[data-kg-prop="life-span"] s')?.textContent === 'Life span', 'ALCUNA: dropped property struck through');
  check(text(root, '[data-kg-name]') === 'Alcuna' && text(root, '[data-kg-name-note]') === 'Al from Alpaca + cuna from Vicuna', 'ALCUNA: name built from subwords');
  const figureQuestions = [
    ['diet', 'KU', 'What type of food is included in the diet of Alcuna?', 'leaves'],
    ['first-appearance', 'KU', 'In which geological period did Alcuna first appear?', 'middle Pleistocene age'],
    ['body-mass', 'KD', 'Does Alcuna have a body mass of 60kg?', 'No.'],
    ['life-span', 'KD', "What's the average life span of Alcuna?", "I don't know."],
    ['eaten-by', 'KA', "What organism is the competitor of the Alcuna's natural enemy?", 'Maned Wolf.'],
  ];
  for (const [id, set, q, answer] of figureQuestions) {
    check(qSet(id) === set && text(question(id), '.bm-q-text') === q && qAnswer(id) === answer && qSource(id) === 'Figure 1', `ALCUNA Figure 1 question ${id}: ${set}, ${answer}`);
  }
  check(text(question('life-span'), '.bm-q-meta').includes('Depends on: dropout') && text(question('life-span'), '.bm-q-meta').includes('From Alpaca alone: 25.8years (wrong)'), 'ALCUNA: dropout answer contradicts the parent');
  check(text(question('eaten-by'), '.bm-q-meta').includes('Depends on: variation, existing knowledge (Jaguar, Compete with, Maned Wolf)'), 'ALCUNA: association needs the varied relation and existing knowledge');
  check(text(root, '[data-step-status]') === "Questions: KU 2, KD 2, KA 1. Answering from Alpaca's printed properties alone gets 1 of 5 right.", 'ALCUNA: Figure 1 question counts');
  check(text(root, '[data-kg-similarity]') === "1 of 4 printed properties identical to Alpaca's.", 'ALCUNA: one printed property kept unchanged');

  // Construction steps.
  act(root, 'reset');
  check(root.dataset.step === '0' && props().length === 0 && text(root, '[data-kg-name]') === '?' && root.querySelector('[data-kg-questions]').hidden && !root.querySelector('[data-kg-q-pending]').hidden, 'ALCUNA Reset: empty entity, no questions');
  check(text(root, '[data-step-status]').startsWith('Start from the class Camels: the parent Alpaca and its sibling Vicuna.'), 'ALCUNA Reset: start status');
  act(root, 'step');
  check(props().join('|') === 'Diet: leaves [heredity]' && root.querySelector('[data-kg-src="diet"]').classList.contains('is-source') && root.querySelectorAll('.is-entering').length > 0, 'ALCUNA step heredity: diet inherited and marked');
  act(root, 'step');
  check(props().join('|') === 'Body mass: 56.5kg [variation]|Diet: leaves [heredity]|Eaten by: Jaguar [variation]' && text(root, '[data-step-status]') === 'Variation: Body mass 60kg → 56.5kg (numeric value + N(0, v/10)); Eaten by Cougar → Jaguar (a sibling of Cougar in the class Cats).', 'ALCUNA step variation: value and relation varied');
  act(root, 'step');
  check(props().includes('Life span [dropout]') && text(root, '[data-step-status]') === 'Dropout: Life span is removed, so Alcuna has no such triplet.', 'ALCUNA step dropout');
  act(root, 'step');
  check(root.querySelector('[data-kg-src="first-appearance"]').classList.contains('is-source') && props().length === 5, 'ALCUNA step extension: sibling property copied');
  act(root, 'step');
  check(text(root, '[data-kg-name]') === 'Alcuna' && root.querySelector('[data-kg-questions]').hidden, 'ALCUNA step name: named, questions not yet generated');
  act(root, 'step');
  check(!root.querySelector('[data-kg-questions]').hidden && root.querySelector('[data-demo-action="step"]').disabled && pressed(root, 'goto').join() === '6', 'ALCUNA step questions: final step');
  root.dataset.stepDelay = '40';
  act(root, 'play');
  check(root.dataset.step === '0' && root.querySelector('[data-demo-action="play"]').textContent === 'Pause', 'ALCUNA Play: restarts the construction');
  await wait(500);
  check(root.dataset.step === '6' && root.querySelector('[data-demo-action="play"]').getAttribute('aria-pressed') === 'false', 'ALCUNA Play: builds every step and stops');
  root.dataset.motion = 'reduce';
  act(root, 'play');
  check(root.dataset.step === '0', 'ALCUNA reduced motion: Play at the end restarts');
  act(root, 'play');
  await wait(150);
  check(root.dataset.step === '1' && root.querySelectorAll('.is-entering').length === 0, 'ALCUNA reduced motion: one step per press, no marks');
  delete root.dataset.motion;

  // Operation switches change the entity and its questions (Algorithm 1 rules).
  act(root, 'kg-op', 'dropout');
  check(pressed(root, 'kg-op').join() === 'heredity,variation,extension', 'ALCUNA: aria-pressed follows the operation switches');
  check(root.dataset.step === '5' && qSet('life-span') === 'KU' && qAnswer('life-span') === '25.8years' && qSource('life-span') === 'Derived', 'ALCUNA dropout off: life span inherited, asked as KU');
  check(![...root.querySelectorAll('[data-demo-action="goto"]')].some(b => b.textContent === 'Dropout') && root.querySelectorAll('[data-demo-action="goto"]').length === 6, 'ALCUNA dropout off: no dropout step');
  act(root, 'kg-op', 'variation');
  check(qSet('body-mass') === 'KU' && qAnswer('body-mass') === 'Yes.' && !qSet('eaten-by') && text(question('eaten-by'), '.bm-q-meta').includes('no printed relation leads from Cougar'), 'ALCUNA variation off: body mass Yes, no association chain');
  check(text(root, '[data-step-status]').includes('KU 4, KD 0, KA 0') && text(root, '[data-step-status]').includes('3 of 4 right') && text(root, '[data-step-status]').includes('nothing tests whether a model separates Alcuna from Alpaca'), 'ALCUNA variation and dropout off: KD empty');
  check(text(root, '[data-kg-similarity]') === "4 of 5 printed properties identical to Alpaca's.", 'ALCUNA variation and dropout off: entity mostly a copy');
  act(root, 'kg-op', 'heredity');
  check(!qSet('diet') && text(question('diet'), '.bm-q-meta') === 'Not generated: Alcuna has no Diet triplet.' && props().join('|') === 'First appearance: middle Pleistocene age [extension]', 'ALCUNA heredity off too: only the extension remains');
  act(root, 'kg-op', 'extension');
  check(props().length === 0 && text(root, '[data-step-status]').startsWith('Questions: none.'), 'ALCUNA all off: nothing to ask');
  for (const op of ['heredity', 'variation', 'dropout', 'extension']) act(root, 'kg-op', op);
  check(props().join('|') === figureProps.join('|') && figureQuestions.every(([id, set, , answer]) => qSet(id) === set && qAnswer(id) === answer), 'ALCUNA: all on restores Figure 1');

  /* ------------------------------------------------------------ Knowledge boundary */
  doc = await load('knowledge-boundary');
  root = doc.querySelector('[data-paper-demo="benchmarks-boundary"]');
  check(root && root.closest('#findings') && root.closest('.evidence-demo'), 'Boundary: explorer sits in Evidence');
  check(root.dataset.demoReady === 'true' && root.querySelectorAll('[data-kb-model]').length === 4, 'Boundary: four backbone panels');
  const cellText = (model, method, column) => text(root.querySelector(`[data-kb-model="${model}"] [data-kb-method="${method}"]`), `td:nth-of-type(${column}) .bm-value`);
  const pick = (action, value) => root.querySelector(`[data-demo-action="${action}"][data-value="${value}"]`).click();
  // Table 1 spot checks: [true set, negative set, model, method, true value, false value].
  const kbCells = [
    ['pararel', 'cfact', 'GPT-2', 'PGDC', '47.68%', '2.81%'],
    ['pararel', 'cfact', 'Vicuna', 'P-few', '69.69%', '6.91%'],
    ['pararel', 'cfact', 'Vicuna', 'PGDC', '69.63%', '3.50%'],
    ['pararel', 'cfact', 'LLaMA2', 'P-dis', '44.16%', '36.46%'],
    ['pararel', 'cfact', 'GPT-J', 'dis', '2.40%', '2.30%'],
    ['kassess', 'alcuna', 'LLaMA2', 'dis', '6.73%', '30.48%'],
    ['kassess', 'alcuna', 'GPT-J', 'P-dis', '2.26%', '0.72%'],
    ['kassess', 'alcuna', 'GPT-2', 'zero', '4.03%', '0.00%'],
    ['kassess', 'cfact', 'Vicuna', 'P-zero', '51.15%', '3.36%'],
    ['kassess', 'cfact', 'LLaMA2', 'PGDC', '69.84%', '3.41%'],
  ];
  for (const [t, f, model, method, tv, fv] of kbCells) {
    pick('kb-true', t); pick('kb-false', f); pick('kb-method', method);
    check(cellText(model, method, 1) === tv && cellText(model, method, 2) === fv, `Boundary ${t}/${f} ${model} ${method}: ${tv} / ${fv}`);
    check(root.querySelectorAll(`[data-kb-method="${method}"].is-selected`).length === 4 && pressed(root, 'kb-method').join() === method, `Boundary ${method}: highlighted in every panel`);
  }
  const bar = root.querySelector('[data-kb-model="LLaMA2"] [data-kb-method="PGDC"] .bm-bar.is-true i');
  check(bar.style.width === '69.84%', 'Boundary: bar length is the measured rate');
  pick('kb-false', 'alcuna');
  check(root.querySelector('[data-demo-action="kb-method"][data-value="AutoPrompt"]').hidden && [...root.querySelectorAll('[data-kb-autoprompt]')].every(row => row.hidden), 'Boundary: AutoPrompt only with CFACT');
  pick('kb-false', 'cfact'); pick('kb-method', 'AutoPrompt');
  check(cellText('LLaMA2', 'AutoPrompt', 2) === '88.35%' && cellText('Vicuna', 'AutoPrompt', 2) === '33.09%' && cellText('GPT-2', 'AutoPrompt', 1) === 'not reported', 'Boundary: AutoPrompt CFACT values from Table 3');
  pick('kb-false', 'alcuna');
  check(pressed(root, 'kb-method').join() === 'PGDC', 'Boundary: AutoPrompt falls back to PGDC without CFACT');
  pick('kb-true', 'pararel'); pick('kb-false', 'cfact'); pick('kb-method', 'PGDC');
  check(text(root, '[data-kb-status]').includes('Highest PaRaRel success of all seven probes for GPT-2, GPT-J, LLaMA2.') && text(root, '[data-kb-status]').includes('5–9% of true-fact success'), 'Boundary PGDC: best on PaRaRel except Vicuna, low false-target ratio');
  check(!root.querySelector('[data-kb-cases]').hidden && root.querySelectorAll('[data-kb-cases] tbody tr').length === 3 && [...root.querySelectorAll('[data-kb-cases] td')].some(td => td.textContent === '<s> host country of Australian Capital Territory is'), 'Boundary PGDC: Table 2 prompts shown');
  pick('kb-method', 'P-dis');
  check(text(root, '[data-kb-status]').includes('Backbone order on PaRaRel: LLaMA2 > Vicuna > GPT-2 > GPT-J; PGDC gives LLaMA2 > Vicuna > GPT-J > GPT-2.') && text(root, '[data-kb-status]').includes('For GPT-2 it is at least as high as true-fact success.'), 'Boundary P-dis: ranking changes, false targets as frequent as true facts');
  const dis = [...root.querySelectorAll('[data-kb-inputs] li')].map(li => li.textContent);
  check(dis.includes('Check whether the following statement is correct: IBM Connections is created by Adobe. The statement is (True/False): True') && root.querySelector('[data-kb-inputs] mark')?.textContent === 'True', 'Boundary dis: Table 4 judgment input with the True target');
  check(text(root, '[data-kb-input-note]').includes('counts the fact as known if any succeeds'), 'Boundary P-dis: any-paraphrase rule explained');
  pick('kb-true', 'kassess'); pick('kb-method', 'few');
  check([...root.querySelectorAll('[data-kb-inputs] li')].map(li => li.textContent).join('|') === 'Pole vault record is held by Fabiana Murer.|800 metres record is held by David Rudisha|10,000 metres record is held by Kenenisa Bekele|Windows Embedded CE 6.0 is created by IBM.|Sandy Bridge was a product of Apple.|IBM Connections is created by Adobe', 'Boundary few: Table 4 few-shot inputs');
  pick('kb-method', 'dis');
  check(text(root, '[data-kb-status]').includes('The paper prints a lower P-dis than dis value on KAssess for GPT-J.'), 'Boundary: printed P-dis below dis is reported, not hidden');

  /* ------------------------------------------------------------ Self-generated documents */
  doc = await load('self-generated-documents');
  root = doc.querySelector('[data-paper-demo="benchmarks-selfdocs"]');
  check(root && root.closest('#findings') && root.closest('.evidence-demo'), 'Self-Docs: explorer sits in Evidence');
  const sdPick = (action, value) => root.querySelector(`[data-demo-action="${action}"][data-value="${value}"]`).click();
  const scoreRow = code => [...root.querySelectorAll(`[data-sd-row="${code}"] td`)].map(td => td.firstChild.textContent);
  check(text(root, '[data-sd-code]') === 'AFU' && root.querySelector('[data-sd-row="AFU"]').classList.contains('is-selected') && root.querySelectorAll('[data-sd-row]').length === 8, 'Self-Docs: AFU selected, all eight types listed');
  // Table 2 rows.
  const table2 = { AFS: '55.4,37.5,83.4,20.9,49.3', CFU: '57.8,39.5,84.2,25.1,51.6', CCS: '56.0,35.2,82.0,25.4,49.6', CCU: '56.6,38.7,83.8,26.4,51.4' };
  for (const [code, values] of Object.entries(table2)) check(scoreRow(code).join() === values, `Self-Docs Table 2 ${code}: ${values}`);
  check(text(root, '[data-sd-status]').startsWith('AFU (authoritative, fine-grained, unstructured), Self-Docs alone (Table 2): TQA 58.4 (rank 1 of 8)') && text(root, '[data-sd-status]').includes('Average 51.6 (rank 1 of 8, tied with CFU)'), 'Self-Docs: AFU ranks computed');
  check(text(root, '[data-sd-excerpt]').startsWith('The VS-300 is a helicopter, specifically a prototype that marked a pivotal moment') && text(root, '[data-sd-excerpt-source]') === 'Figure 1 and Appendix G.2', 'Self-Docs: AFU published opening');
  // Each printed Average is the mean of its four tasks, and the paper's Table 3 dimension
  // means are reproduced from Table 2 for TQA, HotpotQA and ELI5. (Table 3's FEVER column
  // is 0.4–0.65 points above the per-type means, so it is not used by the demo.)
  const rows2 = Object.fromEntries([...root.querySelectorAll('[data-sd-row]')].map(tr => [tr.dataset.sdRow, scoreRow(tr.dataset.sdRow).map(Number)]));
  check(Object.values(rows2).every(v => Math.abs((v[0] + v[1] + v[2] + v[3]) / 4 - v[4]) < 0.076), 'Self-Docs: printed averages are task means');
  const mean = (codes, i) => codes.reduce((sum, c) => sum + rows2[c][i], 0) / codes.length;
  const table3 = [[c => c[1] === 'F', 0, 57.3], [c => c[2] === 'U', 1, 39.4], [c => c[2] === 'S', 3, 23.1], [c => c[0] === 'C', 3, 25.2], [c => c[0] === 'A', 1, 38.9]];
  for (const [test, task, printed] of table3) {
    const codes = Object.keys(rows2).filter(test);
    check(Math.abs(mean(codes, task) - printed) < 0.051, `Self-Docs: Table 3 aggregate ${printed} reproduced from Table 2`);
  }
  const flip = (dimension, task) => { const row = [...root.querySelectorAll('[data-sd-flips] tr')][dimension]; return row.cells[task + 1].textContent; };
  check(flip(2, 4) === '+2.34/4 pairs' && flip(0, 3) === '−2.30/4 pairs', 'Self-Docs AFU: unstructured wins every pair on average; authoritative loses every ELI5 pair');
  sdPick('sd-tone', 'C');
  check(text(root, '[data-sd-code]') === 'CFU' && pressed(root, 'sd-tone').join() === 'C' && text(root, '[data-sd-genre]') === 'Table 4 example: Personal Essays', 'Self-Docs: tone switch selects CFU');
  check(text(root, '[data-sd-excerpt]').startsWith("Hey there! So, let's chat about the VS-300 for a bit.") && text(root, '[data-sd-excerpt-source]') === 'Appendix G.2', 'Self-Docs: CFU opening from Appendix G.2');
  sdPick('sd-granularity', 'C'); sdPick('sd-structure', 'S');
  check(text(root, '[data-sd-code]') === 'CCS' && text(root, '[data-sd-excerpt]').startsWith('# The VS-300: A Quick Overview'), 'Self-Docs: CCS opening keeps its heading');
  sdPick('sd-condition', 'style');
  check(text(root, '[data-sd-table]') === 'Table 12' && scoreRow('ACU').join() === '57.0,41.9,90.4,23.3,53.2' && root.querySelector('[data-sd-row="ACU"] td:nth-of-type(3)').classList.contains('is-best'), 'Self-Docs Table 12: ACU reaches the best FEVER score');
  check(text(root, '[data-sd-row="CCS"] td:nth-of-type(2) small') === '+6.6' && text(root, '[data-sd-status]').includes('Average change from the same documents alone: +3.3.'), 'Self-Docs Table 12: printed change for CCS');
  check(!root.querySelector('[data-sd-baseline="GenRead mix"]').hidden, 'Self-Docs: GenRead mix baseline shown for mixes');
  sdPick('sd-condition', 'direct');
  check(scoreRow('AFS').join() === '56.0,38.3,73.6,22.0,47.5' && text(root, '[data-sd-row="AFS"] td:nth-of-type(3) small') === '−9.8', 'Self-Docs Table 10: structured AFS loses 9.8 FEVER points under Direct Mix');
  sdPick('sd-condition', 'alone');
  check(root.querySelector('[data-sd-baseline="GenRead mix"]').hidden && scoreRow('CCS').join() === table2.CCS, 'Self-Docs: back to Table 2');

  /* ------------------------------------------------------------ Shared shell and layout */
  for (const slug of ['alcuna', 'knowledge-boundary', 'self-generated-documents']) {
    doc = await load(slug);
    const demo = doc.querySelector('[data-paper-demo^="benchmarks-"]');
    const h3 = doc.defaultView.getComputedStyle(demo.querySelector('header h3'));
    const eyebrow = doc.defaultView.getComputedStyle(demo.querySelector('.bm-eyebrow'));
    check(h3.fontFamily.startsWith('Georgia') && h3.fontWeight === '400', `${slug}: serif demo heading`);
    check(eyebrow.textTransform === 'uppercase' && eyebrow.color === 'rgb(43, 97, 81)', `${slug}: green uppercase eyebrow`);
    check(![...demo.querySelectorAll('*')].some(el => parseFloat(doc.defaultView.getComputedStyle(el).borderTopLeftRadius) > 0), `${slug}: square corners`);
    check(![...demo.querySelectorAll('*')].some(el => doc.defaultView.getComputedStyle(el).boxShadow !== 'none'), `${slug}: no shadows`);
    check(demo.querySelectorAll('[role="status"][aria-live="polite"]').length >= 1, `${slug}: live status region`);
    check([...demo.querySelectorAll('[data-demo-action]')].every(el => el.tagName === 'BUTTON' && el.type === 'button'), `${slug}: controls are native buttons`);
    check([...demo.querySelectorAll('[data-demo-action]:not([data-demo-action="step"]):not([data-demo-action="reset"])')].every(el => el.hasAttribute('aria-pressed')), `${slug}: toggles expose aria-pressed`);
    check([...demo.querySelectorAll('.bm-table-wrap')].every(wrap => wrap.tabIndex === 0), `${slug}: scroll regions are keyboard focusable`);
  }
  frame.style.width = '320px';
  for (const [slug, steps] of [
    ['alcuna', [['kg-op', 'variation'], ['reset'], ['step'], ['step']]],
    ['knowledge-boundary', [['kb-true', 'kassess'], ['kb-method', 'P-few']]],
    ['self-generated-documents', [['sd-condition', 'style'], ['sd-tone', 'C']]],
  ]) {
    doc = await load(slug);
    const demo = doc.querySelector('[data-paper-demo]');
    for (const [action, value] of steps) act(demo, action, value);
    check(doc.documentElement.scrollWidth <= 321, `${slug}: no page overflow at 320px after interaction`);
  }
  frame.style.width = '390px';

  /* ------------------------------------------------------------ Script-free fallback */
  frame.removeAttribute('src');
  for (const slug of ['alcuna', 'knowledge-boundary', 'self-generated-documents']) {
    const html = await fetch(`/papers/${slug}.html`).then(response => response.text());
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    const base = parsed.createElement('base'); base.href = `${location.origin}/papers/`; parsed.head.prepend(base);
    await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = parsed.documentElement.outerHTML; });
    doc = frame.contentDocument;
    const demo = doc.querySelector('[data-paper-demo]');
    check(![...demo.querySelectorAll('[data-demo-action]')].some(visible), `${slug} (no JS): controls hidden`);
    check([...demo.querySelectorAll('[data-demo-state]')].filter(visible).every(el => el.textContent.trim().length > 20) && demo.querySelectorAll('[data-demo-state]').length > 0, `${slug} (no JS): readable state`);
    check(doc.documentElement.scrollWidth <= 391, `${slug} (no JS): no phone overflow`);
    if (slug === 'alcuna') {
      check(demo.querySelectorAll('[data-kg-props] li').length === 5 && demo.querySelectorAll('.bm-q[data-kg-set]').length === 5 && visible(demo.querySelector('[data-kg-questions]')), 'ALCUNA (no JS): Figure 1 entity and questions');
    } else if (slug === 'knowledge-boundary') {
      check(demo.querySelectorAll('[data-kb-model] tbody tr:not([hidden])').length === 32 && text(demo, '[data-kb-status]').startsWith('PGDC · PaRaRel ↑ / CFACT ↓: GPT-2 47.68% / 2.81%'), 'Boundary (no JS): all backbones and the PGDC reading');
    } else {
      check(demo.querySelectorAll('[data-sd-row]').length === 8 && text(demo, '[data-sd-status]').startsWith('AFU (authoritative, fine-grained, unstructured)'), 'Self-Docs (no JS): Table 2 and the AFU reading');
    }
  }
  frame.remove();
  return { assertions, failures };
})();
