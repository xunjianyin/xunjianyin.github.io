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
