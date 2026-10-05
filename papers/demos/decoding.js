/* Decoding demos for LEDOM and COrAL. All data is read from the server-rendered
 * markup (published text, the transcribed Figure 2 rows and measured tables);
 * nothing here calls a model. Summaries mirror scripts/paper_demo_decoding.py so
 * the no-script page and the enhanced page state the same thing for the same selection.
 * Animations are reader-started, at most 600 ms per transition, and become
 * immediate steps under prefers-reduced-motion.
 */
(() => {
  'use strict';
  const MINUS = '−';
  const signed = (value, digits = 1) => {
    const rounded = Number(value.toFixed(digits));
    if (rounded === 0) return (0).toFixed(digits);
    return (rounded > 0 ? '+' : MINUS) + Math.abs(rounded).toFixed(digits);
  };
  const decimal = value => {
    const text = Math.abs(Number(value.toFixed(2))).toFixed(2);
    return text.endsWith('0') ? text.slice(0, -1) : text;
  };
  const points = value => {
    const rounded = Number(value.toFixed(2));
    if (rounded === 0) return '0.0';
    return (rounded > 0 ? '+' : MINUS) + decimal(rounded);
  };
  const setPressed = (buttons, isPressed) => buttons.forEach(button => button.setAttribute('aria-pressed', String(isPressed(button))));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // On phones a row of step buttons scrolls sideways; keep the pressed one in view.
  const reveal = button => {
    const bar = button.parentElement.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    if (box.left < bar.left) button.parentElement.scrollLeft -= bar.left - box.left + 8;
    else if (box.right > bar.right) button.parentElement.scrollLeft += box.right - bar.right + 8;
  };

  /* COrAL: replay Figure 2. Each frame is serialized by the generator: the earlier
   * and later printed rows, the block outline, the printed arrows and a status
   * computed from the rows. A step first fixes the accepted tokens and slides the
   * block (the later row's positions still show the earlier draft), then draws the
   * arrows and fills the block with the printed tokens. */
  const replay = document.querySelector('[data-paper-demo="coral-replay"]');
  if (replay) {
    const { frames } = JSON.parse(replay.querySelector('[data-cr-data]').textContent);
    const cells = name => [...replay.querySelectorAll(`[data-cr-row="${name}"] .cr-cell`)];
    const rows = { before: cells('before'), after: cells('after') };
    const afterRow = replay.querySelector('[data-cr-row="after"]');
    const labels = { before: replay.querySelector('[data-cr-label="before"]'), after: replay.querySelector('[data-cr-label="after"]') };
    const groups = [...replay.querySelectorAll('[data-cr-arrows]')];
    const block = replay.querySelector('[data-cr-block]');
    const gap = replay.querySelector('[data-cr-gap]');
    const status = replay.querySelector('[data-cr-status]');
    const scroller = replay.querySelector('.cr-scroll');
    const chips = [...replay.querySelectorAll('[data-demo-action="cr-goto"]')];
    const logRows = [...replay.querySelectorAll('[data-cr-log]')];
    const play = replay.querySelector('[data-demo-action="cr-play"]');
    const step = replay.querySelector('[data-demo-action="cr-step"]');
    const SLIDE_MS = 560; // block slide and token colour change; CSS transitions stay below this
    const HOLD_MS = 2000; // reading time per printed step while playing
    const last = frames.length - 1;
    let current = last;
    let timer = null;
    let phase = null;

    const paint = (targets, spec) => spec.forEach(([text, cls], i) => {
      targets[i].textContent = text;
      targets[i].className = `cr-cell ${cls}`;
    });
    const showArrows = key => groups.forEach(group => {
      const shown = group.dataset.crArrows === key;
      group.classList.toggle('is-shown', shown);
      if (shown) group.removeAttribute('visibility'); else group.setAttribute('visibility', 'hidden');
    });
    // On narrow screens the rows scroll sideways; keep the block in view (an instant jump, not a tween).
    const keepInView = ([left, width]) => {
      if (scroller.scrollWidth <= scroller.clientWidth + 1 || !width) return;
      const row = afterRow.getBoundingClientRect();
      const origin = row.left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
      const start = origin + row.width * left / 100;
      const end = start + row.width * width / 100;
      if (start < scroller.scrollLeft + 8 || end > scroller.scrollLeft + scroller.clientWidth - 8) {
        scroller.scrollLeft = Math.max(0, start - 72);
      }
    };
    const render = (index, animate) => {
      clearTimeout(phase);
      phase = null;
      current = index;
      const frame = frames[index];
      labels.before.textContent = frame.beforeLabel;
      labels.after.textContent = frame.afterLabel;
      paint(rows.before, frame.before);
      gap.hidden = !frame.gap;
      const [left, width] = frame.block;
      block.style.left = `${left}%`;
      block.style.width = `${width}%`;
      block.hidden = width === 0;
      keepInView(frame.block);
      setPressed(chips, chip => Number(chip.dataset.frame) === index);
      reveal(chips[index]);
      logRows.forEach(row => row.classList.toggle('is-current', row.dataset.crLog === frame.key));
      step.disabled = index === last;
      const fill = () => {
        phase = null;
        paint(rows.after, frame.after);
        showArrows(frame.arrows);
        replay.dataset.phase = 'filled';
        status.textContent = frame.status;
      };
      if (animate && frame.slide && !reducedMotion.matches) {
        paint(rows.after, frame.slide);
        showArrows('');
        replay.dataset.phase = 'slide';
        phase = setTimeout(fill, SLIDE_MS);
      } else {
        fill();
      }
    };
    const stop = () => {
      clearTimeout(timer);
      timer = null;
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
    };
    const advance = () => {
      if (current >= last) { stop(); return; }
      render(current + 1, true);
      if (current >= last) { timer = setTimeout(stop, SLIDE_MS); return; }
      timer = setTimeout(advance, HOLD_MS + (frames[current].slide && !reducedMotion.matches ? SLIDE_MS : 0));
    };
    play.addEventListener('click', () => {
      if (timer) { stop(); return; }
      play.textContent = 'Pause';
      play.setAttribute('aria-pressed', 'true');
      if (current >= last) { render(0, false); timer = setTimeout(advance, HOLD_MS / 2); } else advance();
    });
    step.addEventListener('click', () => {
      stop();
      if (phase) render(current, false); // finish the step in progress
      else if (current < last) render(current + 1, true);
    });
    replay.querySelector('[data-demo-action="cr-reset"]').addEventListener('click', () => { stop(); render(0, false); });
    chips.forEach(chip => chip.addEventListener('click', () => { stop(); render(Number(chip.dataset.frame), false); }));
    replay.classList.add('is-enhanced');
    replay.querySelector('[data-cr-controls]').hidden = false;
    render(0, false);
  }

  /* COrAL: highlight one setting across all five measured panels. */
  const coral = document.querySelector('[data-paper-demo="coral-evidence"]');
  if (coral) {
    const names = ['Next-token', 'Full COrAL', 'No verifier', 'No multi-forward'];
    const panels = [...coral.querySelectorAll('.coral-panel')].map(panel => {
      const marks = [];
      panel.querySelectorAll('.coral-mark').forEach(mark => { marks[Number(mark.dataset.setting)] = mark; });
      return {
        name: panel.dataset.benchmark,
        metric: panel.dataset.metric,
        marks,
        rows: marks.map(mark => [Number(mark.dataset.quality), Number(mark.dataset.speed)]),
        arrow: panel.querySelector('[data-coral-arrow]'),
        change: panel.querySelector('[data-coral-change]')
      };
    });
    const highlightButtons = [...coral.querySelectorAll('[data-demo-action="coral-highlight"]')];
    const referenceButtons = [...coral.querySelectorAll('[data-demo-action="coral-reference"]')];
    const tableRows = [...coral.querySelectorAll('tbody tr[data-setting]')];
    let reference = 0;
    let highlight = 1;
    let preview = null;

    const xy = ([quality, speed]) => [100 * speed / 160, 100 - quality];
    const summary = () => {
      const ref = names[reference];
      const high = names[highlight];
      if (reference === highlight) return `${high} is the comparison setting. Choose a different highlighted setting to draw arrows from it.`;
      const deltas = panels.map(p => Number((p.rows[highlight][0] - p.rows[reference][0]).toFixed(1)));
      const ratios = panels.map(p => p.rows[highlight][1] / p.rows[reference][1]);
      const up = deltas.filter(d => d > 0).length;
      const down = deltas.filter(d => d < 0).length;
      const quality = up === deltas.length ? 'higher on all five benchmarks'
        : down === deltas.length ? 'lower on all five benchmarks'
          : `higher on ${up} and lower on ${down} of five benchmarks`;
      let text = `${high} vs ${ref}: accuracy is ${quality}. Throughput is ${Math.min(...ratios).toFixed(2)}× to ${Math.max(...ratios).toFixed(2)}× the ${ref} rate.`;
      panels.forEach((p, i) => {
        if (Math.abs(deltas[i]) >= 10) {
          text += ` ${p.name} ${p.metric.toLowerCase()} goes from ${p.rows[reference][0].toFixed(1)} to ${p.rows[highlight][0].toFixed(1)} (${signed(deltas[i])} points).`;
        }
      });
      return text;
    };
    const change = (p, shown) => {
      const [rq, rs] = p.rows[reference];
      const [hq, hs] = p.rows[shown];
      const quality = p.change.querySelector('[data-coral-quality]');
      const speed = p.change.querySelector('[data-coral-speed]');
      if (reference === shown) {
        quality.textContent = hq.toFixed(1);
        speed.textContent = hs.toFixed(1);
        quality.classList.remove('is-large');
        return;
      }
      const delta = Number((hq - rq).toFixed(1));
      quality.textContent = `${rq.toFixed(1)} → ${hq.toFixed(1)} (${signed(delta)})`;
      speed.textContent = `${rs.toFixed(1)} → ${hs.toFixed(1)} (${(hs / rs).toFixed(2)}×)`;
      quality.classList.toggle('is-large', Math.abs(delta) >= 10);
    };
    const render = () => {
      const shown = preview ?? highlight;
      panels.forEach(p => {
        p.marks.forEach((mark, i) => {
          mark.classList.toggle('is-highlight', i === shown);
          mark.classList.toggle('is-reference', i === reference && i !== shown);
          mark.classList.toggle('is-other', i !== shown && i !== reference);
        });
        p.marks[shown].parentNode.append(p.marks[shown]); // Draw above the other marks.
        const [x1, y1] = xy(p.rows[reference]);
        const [x2, y2] = xy(p.rows[shown]);
        const visible = reference !== shown && Math.hypot(x2 - x1, y2 - y1) >= 6;
        Object.entries({ x1, y1, x2, y2 }).forEach(([name, value]) => p.arrow.setAttribute(name, `${Number(value.toFixed(3))}%`));
        if (visible) p.arrow.removeAttribute('visibility'); else p.arrow.setAttribute('visibility', 'hidden');
        change(p, shown);
      });
      tableRows.forEach(row => {
        const i = Number(row.dataset.setting);
        row.classList.toggle('is-highlight', i === shown);
        row.classList.toggle('is-reference', i === reference && i !== shown);
      });
      setPressed(highlightButtons, b => Number(b.dataset.setting) === highlight);
      setPressed(referenceButtons, b => Number(b.dataset.reference) === reference);
      coral.querySelector('[data-coral-summary]').textContent = summary();
    };
    const previewOn = i => { preview = i; render(); };
    const previewOff = () => { if (preview !== null) { preview = null; render(); } };
    highlightButtons.forEach(button => {
      const i = Number(button.dataset.setting);
      button.addEventListener('click', () => { highlight = i; preview = null; render(); });
      button.addEventListener('mouseenter', () => previewOn(i));
      button.addEventListener('focus', () => previewOn(i));
      button.addEventListener('mouseleave', previewOff);
      button.addEventListener('blur', previewOff);
    });
    referenceButtons.forEach(button => button.addEventListener('click', () => { reference = Number(button.dataset.reference); render(); }));
    // Hovering a mark or a table row previews that setting in every panel; clicking selects it.
    [...coral.querySelectorAll('.coral-mark'), ...tableRows].forEach(el => {
      const i = Number(el.dataset.setting);
      el.addEventListener('mouseenter', () => previewOn(i));
      el.addEventListener('mouseleave', previewOff);
      el.addEventListener('click', () => { highlight = i; preview = null; render(); });
    });
    coral.querySelector('[data-coral-key]').hidden = true; // The buttons carry the same key.
    coral.querySelector('[data-coral-controls]').hidden = false;
    render();
  }

  /* LEDOM: published outputs, shown in reading order or in the model's order. */
  const examples = document.querySelector('[data-paper-demo="reverse-examples"]');
  if (examples) {
    const articles = [...examples.querySelectorAll('[data-rv-example]')];
    const exampleButtons = [...examples.querySelectorAll('[data-demo-action="rv-example"]')];
    const orderButtons = [...examples.querySelectorAll('[data-demo-action="rv-order"]')];
    const slider = examples.querySelector('#rv-progress');
    const counter = examples.querySelector('[data-rv-count]');
    const play = examples.querySelector('[data-demo-action="rv-play"]');
    const stepButton = examples.querySelector('[data-demo-action="rv-step"]');
    const bare = text => text.replaceAll('"', "'");
    let order = 'reading';
    let timer = null;

    // Build a reversed copy of a unit sequence. Each output word keeps its reading
    // index; a line break takes the index of the word before it in reading order.
    const reversedCopy = (source, symbols) => {
      const target = source.parentNode.querySelector('[data-rv-model]');
      const units = [...source.children];
      let lastWord = -1;
      const indexed = units.map(unit => {
        if (unit.dataset.u === 'w') lastWord += 1;
        return { unit, index: lastWord };
      });
      const clones = [];
      indexed.reverse().forEach(({ unit, index }) => {
        if (unit.dataset.u === 'br' && index < 0) return;
        const clone = unit.cloneNode(true);
        clone.dataset.wi = String(index);
        if (clones.length && !symbols && clone.dataset.u !== 'br' && clones[clones.length - 1].dataset.u !== 'br') target.append(' ');
        target.append(clone);
        clones.push(clone);
      });
      return clones;
    };
    const state = new Map(articles.map(article => {
      const symbols = article.dataset.units === 'symbols';
      const output = article.querySelector('[data-rv-row="output"] [data-rv-reading]');
      const given = article.querySelector('[data-rv-row="given"] [data-rv-reading]');
      const words = [...output.querySelectorAll('[data-u="w"]')];
      const labels = [...article.querySelectorAll('[data-rv-label]')];
      labels.forEach(label => { label.dataset.readingLabel = label.textContent; });
      reversedCopy(given, symbols); // The given text is shown whole in either order.
      return [article.dataset.rvExample, {
        article, symbols, words,
        texts: words.map(word => word.textContent),
        modelOutput: reversedCopy(output, symbols),
        rows: article.querySelector('[data-rv-rows]'),
        readings: [...article.querySelectorAll('[data-rv-reading]')],
        models: [...article.querySelectorAll('[data-rv-model]')],
        labels,
        status: article.querySelector('[data-rv-status]')
      }];
    }));
    let current = articles[0].dataset.rvExample;

    const status = (s, count) => {
      const total = s.texts.length;
      const noun = s.symbols ? 'symbols' : 'words';
      const joiner = s.symbols ? '' : ' ';
      if (count >= total) return `All ${total} ${noun} generated. LEDOM wrote “${bare(s.texts[total - 1])}” first and “${bare(s.texts[0])}” last.`;
      if (count <= 0) return `Nothing generated yet. LEDOM has read the given text; its first output will be “${bare(s.texts[total - 1])}”, directly before it.`;
      const remaining = s.texts.slice(0, total - count);
      const opening = remaining.slice(0, 4).join(joiner) + (remaining.length > 4 ? `${joiner}…` : '');
      return `${count} of ${total} ${noun} generated, from “${bare(s.texts[total - 1])}” back to “${bare(s.texts[total - count])}”. Still unwritten: “${bare(opening)}”.`;
    };
    // While playing, the status is updated silently; it is announced when playback stops.
    const render = (quiet = false) => {
      const s = state.get(current);
      const total = s.words.length;
      const count = Number(slider.value);
      const first = total - count; // Reading index of the most recently generated word.
      s.words.forEach((word, i) => {
        word.classList.toggle('is-pending', i < first);
        word.classList.toggle('is-frontier', count > 0 && count < total && i === first);
      });
      s.modelOutput.forEach(clone => {
        const i = Number(clone.dataset.wi);
        clone.hidden = i < first;
        if (clone.dataset.u === 'w') clone.classList.toggle('is-frontier', count > 0 && count < total && i === first);
      });
      const model = order === 'model';
      s.readings.forEach(el => { el.hidden = model; });
      s.models.forEach(el => { el.hidden = !model; });
      s.rows.classList.toggle('is-model-order', model);
      s.labels.forEach(label => {
        const isGiven = label.closest('[data-rv-row]').dataset.rvRow === 'given';
        label.textContent = !model ? label.dataset.readingLabel
          : isGiven ? 'Read first · given text, reversed' : `Then generated · LEDOM’s output, reversed${count < total ? ' (so far)' : ''}`;
      });
      counter.textContent = `${count} / ${total}`;
      s.status.setAttribute('aria-live', quiet ? 'off' : 'polite');
      s.status.textContent = status(s, count);
      stepButton.disabled = count >= total;
      articles.forEach(article => { article.hidden = article.dataset.rvExample !== current; });
      setPressed(exampleButtons, b => b.dataset.example === current);
      setPressed(orderButtons, b => b.dataset.order === order);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
    };
    // One generated word per tick, last word first; about six seconds for short outputs.
    const tick = () => {
      const total = Number(slider.max);
      slider.value = String(Math.min(total, Number(slider.value) + 1));
      const done = Number(slider.value) >= total;
      if (done) stop();
      render(!done);
    };
    play.addEventListener('click', () => {
      if (timer) { stop(); render(); return; }
      const total = Number(slider.max);
      if (Number(slider.value) >= total) slider.value = '0';
      play.textContent = 'Pause';
      play.setAttribute('aria-pressed', 'true');
      render(true);
      timer = setInterval(tick, Math.max(120, Math.min(600, 6000 / total)));
    });
    stepButton.addEventListener('click', () => {
      stop();
      slider.value = String(Math.min(Number(slider.max), Number(slider.value) + 1));
      render();
    });
    examples.querySelector('[data-demo-action="rv-reset"]').addEventListener('click', () => { stop(); slider.value = '0'; render(); });
    exampleButtons.forEach(button => button.addEventListener('click', () => {
      stop();
      current = button.dataset.example;
      const total = state.get(current).words.length;
      slider.max = String(total);
      slider.value = String(total); // Each example opens complete, as printed.
      render();
    }));
    orderButtons.forEach(button => button.addEventListener('click', () => { order = button.dataset.order; render(Boolean(timer)); }));
    slider.addEventListener('input', () => { stop(); render(); });
    examples.classList.add('is-enhanced');
    examples.querySelector('[data-rv-controls]').hidden = false;
    render();
  }

  /* LEDOM Reverse Reward: Table 4 differences against a chosen baseline. */
  const reward = document.querySelector('[data-paper-demo="reverse-reward-results"]');
  if (reward) {
    const strategies = [['greedy', 'Greedy decoding'], ['random', 'Random pick (Best-of-N)'], ['rr', 'Reverse Reward (Best-of-N)'], ['beam', 'Reverse Reward (beam search)']];
    const models = ['DeepSeekMath', 'QwenMath', 'OpenMath2'];
    const benches = ['MATH-500', 'GSM8K', 'AIME 2024', 'AMC 2023'];
    const table = {};
    reward.querySelectorAll('td[data-value]').forEach(td => {
      table[td.dataset.model] ??= {};
      table[td.dataset.model][td.dataset.strategy] ??= [];
      table[td.dataset.model][td.dataset.strategy][benches.indexOf(td.dataset.bench)] = Number(td.dataset.value);
    });
    const buttons = [...reward.querySelectorAll('[data-demo-action="rr-baseline"]')];
    const label = key => strategies.find(([k]) => k === key)[1];
    const lower = text => text[0].toLowerCase() + text.slice(1);
    const x = delta => Number((50 + 50 * Math.max(-20, Math.min(20, delta)) / 20).toFixed(3));
    let baseline = 'greedy';

    const summary = () => strategies.filter(([key]) => key !== baseline).map(([key, name]) => {
      const groups = { higher: [], equal: [], lower: [] };
      models.forEach(model => {
        if (!table[model][key]) return;
        benches.forEach((bench, i) => {
          const delta = Number((table[model][key][i] - table[model][baseline][i]).toFixed(2));
          groups[delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'equal'].push(`${model} · ${bench}`);
        });
      });
      const total = groups.higher.length + groups.equal.length + groups.lower.length;
      const named = cells => (cells.length > 0 && cells.length <= 2 && cells.length < total ? ` (${cells.join(', ')})` : '');
      let text = `${name}: higher in ${groups.higher.length} of ${total} pairs${named(groups.higher)}`;
      ['equal', 'lower'].forEach(word => { if (groups[word].length) text += `; ${word} in ${groups[word].length}${named(groups[word])}`; });
      return `${text}.`;
    });
    const render = () => {
      reward.querySelectorAll('.rr-row[data-model]').forEach(row => {
        const values = table[row.dataset.model];
        const i = Number(row.dataset.benchIndex);
        row.querySelectorAll('.rr-mark').forEach(mark => {
          const key = mark.dataset.strategy;
          mark.setAttribute('x', `${x(values[key][i] - values[baseline][i])}%`);
          if (key === baseline) mark.setAttribute('visibility', 'hidden'); else mark.removeAttribute('visibility');
        });
        row.querySelector('[data-rr-value]').textContent = points(values.rr[i] - values[baseline][i]);
      });
      reward.querySelector('[data-rr-axis]').textContent = `Accuracy minus ${lower(label(baseline))}, percentage points`;
      reward.querySelectorAll('.rr-key-item').forEach(item => { item.hidden = item.dataset.strategy === baseline; });
      reward.querySelectorAll('tbody tr[data-strategy]').forEach(row => row.classList.toggle('is-baseline', row.dataset.strategy === baseline));
      const status = reward.querySelector('[data-rr-summary]');
      const intro = document.createElement('p');
      intro.textContent = `Compared with ${lower(label(baseline))}:`;
      const list = document.createElement('ul');
      summary().forEach(line => { const item = document.createElement('li'); item.textContent = line; list.append(item); });
      status.replaceChildren(intro, list);
      setPressed(buttons, b => b.dataset.baseline === baseline);
    };
    buttons.forEach(button => button.addEventListener('click', () => { baseline = button.dataset.baseline; render(); }));
    reward.querySelector('[data-rr-controls]').hidden = false;
    render();
  }
})();
