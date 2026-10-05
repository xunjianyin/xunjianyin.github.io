/* Gödel Agent runtime loop: replay serialized states of agent_module. Each step
 * names the action executed (Algorithm 1), moves the binding pointer when a name
 * is rebound, and pushes a frame for each recursive call. Reader-started; the
 * pointer move is the only transition (400 ms) and is removed under reduced motion. */
(() => {
  'use strict';
  const root = document.querySelector('[data-paper-demo="godel-runtime"]');
  if (!root) return;
  const { frames, objects } = JSON.parse(root.querySelector('[data-gd-data]').textContent);
  const chips = [...root.querySelectorAll('[data-demo-action="gd-goto"]')];
  const play = root.querySelector('[data-demo-action="gd-play"]');
  const step = root.querySelector('[data-demo-action="gd-step"]');
  const status = root.querySelector('[data-gd-status]');
  const last = frames.length - 1;
  const HOLD_MS = 2200;
  let current = last;
  let timer = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const render = index => {
    current = index;
    const frame = frames[index];
    Object.entries(objects).forEach(([name, list]) => {
      const binding = root.querySelector(`[data-gd-binding="${name}"]`);
      binding.dataset.mark = frame.marks[name] || '';
      const slot = list.findIndex(([key]) => key === frame.bound[name]);
      binding.querySelector('.gd-slots').style.setProperty('--gd-slot', String(slot));
      list.forEach(([key]) => {
        const item = binding.querySelector(`[data-gd-object="${key}"]`);
        item.toggleAttribute('data-absent', !frame.created.includes(key)); // keeps its space, so the panel does not jump
        item.className = key === frame.bound[name] ? 'is-bound' : 'is-unbound';
      });
    });
    const stack = root.querySelector('[data-gd-stack]');
    stack.replaceChildren(...[...frame.stack].reverse().map(([fn, note], i) => {
      const item = element('li', i === 0 && index > 0 && frames[index - 1].stack.length < frame.stack.length ? 'is-new' : '');
      item.append(element('code', '', fn.replace('_v', ' v')), element('span', '', note));
      return item;
    }));
    root.querySelector('[data-gd-action]').textContent = frame.action;
    root.querySelector('[data-gd-tool]').textContent = frame.tool ? `implementation: ${frame.tool}` : '';
    root.querySelector('[data-gd-code]').replaceChildren(...frame.code.map(([cls, text]) => element('span', `gd-line${cls ? ` is-${cls}` : ''}`, text)));
    root.querySelector('[data-gd-feedback]').textContent = frame.feedback;
    status.textContent = frame.status;
    chips.forEach(chip => chip.setAttribute('aria-pressed', String(Number(chip.dataset.frame) === index)));
    // On phones the action row scrolls sideways; keep the pressed action in view.
    const bar = chips[index].parentElement.getBoundingClientRect();
    const box = chips[index].getBoundingClientRect();
    if (box.left < bar.left) chips[index].parentElement.scrollLeft -= bar.left - box.left + 8;
    else if (box.right > bar.right) chips[index].parentElement.scrollLeft += box.right - bar.right + 8;
    step.disabled = index === last;
  };
  const stop = () => {
    clearTimeout(timer);
    timer = null;
    play.textContent = 'Play';
    play.setAttribute('aria-pressed', 'false');
  };
  const advance = () => {
    render(current + 1);
    if (current >= last) stop(); else timer = setTimeout(advance, HOLD_MS);
  };
  play.addEventListener('click', () => {
    if (timer) { stop(); return; }
    play.textContent = 'Pause';
    play.setAttribute('aria-pressed', 'true');
    if (current >= last) { render(0); timer = setTimeout(advance, HOLD_MS / 2); } else advance();
  });
  step.addEventListener('click', () => { stop(); if (current < last) render(current + 1); });
  root.querySelector('[data-demo-action="gd-reset"]').addEventListener('click', () => { stop(); render(0); });
  chips.forEach(chip => chip.addEventListener('click', () => { stop(); render(Number(chip.dataset.frame)); }));
  root.classList.add('is-enhanced');
  root.querySelector('[data-gd-controls]').hidden = false;
  render(0);
})();

/* Execute a small, auditable arithmetic search. No model responses are simulated. */
(() => {
  'use strict';
  const root = document.querySelector('[data-paper-demo="godel-search"]');
  if (!root) return;

  const gcd = (a, b) => {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) [a, b] = [b, a % b];
    return a || 1n;
  };
  const rational = (n, d = 1n) => {
    if (d < 0n) { n = -n; d = -d; }
    const divisor = gcd(n, d);
    return { n: n / divisor, d: d / divisor };
  };
  const format = ({ n, d }) => d === 1n ? String(n) : `${n}/${d}`;
  const operand = value => value.d !== 1n || value.n < 0n ? `(${format(value)})` : format(value);
  const combine = (left, right, op) => {
    const a = left.value, b = right.value;
    let value;
    if (op === '+') value = rational(a.n * b.d + b.n * a.d, a.d * b.d);
    else if (op === '−') value = rational(a.n * b.d - b.n * a.d, a.d * b.d);
    else if (op === '×') value = rational(a.n * b.n, a.d * b.d);
    else if (b.n !== 0n) value = rational(a.n * b.d, a.d * b.n);
    else return null;
    return { value, left, right, op, expression: `(${left.expression} ${op} ${right.expression})` };
  };

  function solve(numbers) {
    const failed = new Set();
    const stats = { states: 0, complete: 0 };
    function visit(nodes) {
      stats.states++;
      if (nodes.length === 1) {
        stats.complete++;
        return nodes[0].value.n === 24n * nodes[0].value.d ? nodes[0] : null;
      }
      // Failed numeric states can be reused regardless of the expressions that reached them.
      const key = nodes.map(node => format(node.value)).sort().join(',');
      if (failed.has(key)) return null;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const rest = nodes.filter((_, index) => index !== i && index !== j);
          const a = nodes[i], b = nodes[j];
          const options = [combine(a, b, '+'), combine(a, b, '×'), combine(a, b, '−'), combine(b, a, '−'), combine(a, b, '÷'), combine(b, a, '÷')];
          for (const candidate of options) {
            if (!candidate) continue;
            const result = visit([...rest, candidate]);
            if (result) return result;
          }
        }
      }
      failed.add(key);
      return null;
    }
    const solution = visit(numbers.map((number, index) => ({ value: rational(BigInt(number)), expression: String(number), inputIndex: index })));
    return { solution, stats };
  }

  const write = (selector, value) => { root.querySelector(selector).textContent = value; };
  const input = root.querySelector('#godel-numbers');
  const steps = root.querySelector('.godel-arithmetic');
  const cards = root.querySelector('.godel-number-cards');
  const state = root.querySelector('[data-demo-state="search"]');
  function run() {
    const pieces = input.value.trim().split(/[\s,]+/);
    const valid = pieces.length === 4 && pieces.every(value => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 13);
    input.setAttribute('aria-invalid', String(!valid));
    cards.replaceChildren();
    steps.replaceChildren();
    if (!valid) {
      state.dataset.outcome = 'invalid';
      write('.godel-solution-label', 'Check the input');
      write('.godel-expression', 'Enter four integers from 1 to 13.');
      write('.godel-validation', 'Separate the numbers with commas or spaces.');
      write('.godel-search-count', 'The search has not run on this input.');
      return;
    }
    const numbers = pieces.map(Number);
    const { solution, stats } = solve(numbers);
    root.querySelectorAll('[data-numbers]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.numbers === numbers.join(','))));
    for (const number of numbers) {
      const card = document.createElement('span'); card.textContent = number; cards.append(card);
    }
    state.dataset.outcome = solution ? 'solved' : 'unsolved';
    write('.godel-solution-label', solution ? 'A verified solution' : 'Exhaustive search completed');
    write('.godel-expression', solution ? `${solution.expression.slice(1, -1)} = 24` : 'No expression makes 24.');
    write('.godel-validation', solution ? 'Each input is used once. Intermediate fractions are kept exactly.' : 'Every arithmetic combination allowed by these rules has been ruled out. This result concerns this input, not the paper’s benchmark.');
    const operations = [];
    function collect(node) {
      if (!node.left) return;
      collect(node.left); collect(node.right);
      operations.push(`${operand(node.left.value)} ${node.op} ${operand(node.right.value)} = ${format(node.value)}`);
    }
    if (solution) collect(solution);
    operations.forEach((operation, index) => {
      const item = document.createElement('li');
      const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
      const code = document.createElement('code'); code.textContent = operation;
      item.append(number, code); steps.append(item);
    });
    write('.godel-search-count', `${stats.states.toLocaleString()} search-state visits · ${stats.complete.toLocaleString()} completed arithmetic evaluations. Counts come from this browser run, not from the paper.`);
  }
  root.querySelector('form').addEventListener('submit', event => { event.preventDefault(); run(); });
  root.querySelectorAll('[data-demo-action="preset"]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.numbers; run(); }));
  run();
  root.querySelector('[data-godel-controls]').hidden = false;
})();
