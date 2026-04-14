/**
 * Easter Egg — type "yxjgogogo"
 * Phase 1: Dissolve into Darkness — content fades out as glowing embers rise
 * Phase 2: Word Fireworks — bright, shining fireworks on a dark sky
 * Phase 3: Typewriter Drop — light-mode page drops in and types itself out
 *          (with typewriter click sounds). Completes within ~5s.
 */
(function () {
  var KONAMI = [
    'KeyY', 'KeyX', 'KeyJ', 'KeyG', 'KeyO',
    'KeyG', 'KeyO', 'KeyG', 'KeyO'
  ];
  var pos = 0;
  var running = false;

  var SPECIAL_WORDS = ['Furong', 'Flora', 'Furong Jia', 'Flora Jia', 'Yeye'];

  /* ─── Audio (typewriter click) ─────────────────────────────── */
  var audioCtx = null;
  var clickBuffer = null;
  var lastClickTime = 0;
  var CLICK_MIN_GAP = 28; // ms global throttle so parallel typewriters don't overlap

  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var sr = audioCtx.sampleRate;
      var len = Math.floor(sr * 0.025);
      var buf = audioCtx.createBuffer(1, len, sr);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        var env = Math.exp(-t * 160);
        // Filtered noise + brief metallic ping = typewriter strike
        var noise = (Math.random() * 2 - 1) * 0.7;
        var ping = Math.sin(2 * Math.PI * 2200 * t) * 0.25;
        data[i] = (noise + ping) * env * 0.55;
      }
      clickBuffer = buf;
    } catch (e) { audioCtx = null; }
  }

  function playClick() {
    if (!audioCtx || !clickBuffer) return;
    var now = performance.now();
    if (now - lastClickTime < CLICK_MIN_GAP) return;
    lastClickTime = now;
    try {
      var src = audioCtx.createBufferSource();
      src.buffer = clickBuffer;
      var gain = audioCtx.createGain();
      gain.gain.value = 0.22 + Math.random() * 0.12;
      // Slight pitch variation
      src.playbackRate.value = 0.9 + Math.random() * 0.25;
      src.connect(gain).connect(audioCtx.destination);
      src.start();
    } catch (e) {}
  }

  /* ─── Trigger ──────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (running) return;
    if (e.code === KONAMI[pos]) {
      pos++;
      if (pos === KONAMI.length) {
        pos = 0;
        running = true;
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        runSpectacle().then(function () { running = false; });
      }
    } else {
      pos = e.code === KONAMI[0] ? 1 : 0;
    }
  });

  function harvestWords() {
    var text = (document.getElementById('main-content') || document.body).innerText || '';
    var words = text.split(/\s+/).filter(function (w) { return w.length >= 2 && w.length <= 20; });
    var unique = Array.from(new Set(words));
    if (unique.length === 0) unique = ['Xunjian', 'Yin', 'Duke', 'Research', 'AI', 'Agent'];
    var pool = unique.concat(SPECIAL_WORDS);
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool;
  }

  function runSpectacle() {
    var words = harvestWords();
    var state = {};
    return phaseDissolve(state)
      .then(function () { return phaseFireworks(words, state); })
      .then(function () { return phaseTypewriterDrop(state); });
  }

  /* ─────────────────────────────────────────────
     Phase 1: Dissolve into Darkness
     Content desaturates, blurs, and fades while
     glowing embers rise from its positions.
     A deep-night overlay fades in behind it all.
     ───────────────────────────────────────────── */
  function phaseDissolve(state) {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);

      // Deep-night overlay — stays in DOM through fireworks
      var darkness = document.createElement('div');
      darkness.style.cssText =
        'position:fixed;inset:0;z-index:99990;pointer-events:none;opacity:0;' +
        'background:radial-gradient(ellipse at center,' +
        '  rgba(20,14,38,0.92) 0%,' +
        '  rgba(8,5,18,0.98) 55%,' +
        '  #000 100%);' +
        'transition:opacity 1.6s ease-in;';
      document.body.appendChild(darkness);
      state.darkness = darkness;

      // Ember canvas (above darkness, below fireworks)
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;z-index:99991;pointer-events:none;';
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
      var ctx = canvas.getContext('2d');

      // Visible rects for ember emission
      var rects = [];
      children.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight) {
          rects.push({ x: r.left, y: Math.max(0, r.top), w: r.width, h: Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top) });
        }
      });

      // Begin fading children
      children.forEach(function (el) {
        el.style.transition = 'filter 1.4s ease, opacity 1.6s ease-in, transform 1.6s ease-in';
        el.style.filter = 'blur(4px) grayscale(0.85) brightness(0.35)';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.985)';
      });

      // Kick off darkness fade in next frame (lets transition apply)
      requestAnimationFrame(function () { darkness.style.opacity = '1'; });

      var embers = [];
      var startTime = Date.now();
      var emitDuration = 1400;
      var totalDuration = 2100;

      function frame() {
        var elapsed = Date.now() - startTime;

        if (elapsed < emitDuration && rects.length > 0) {
          var rate = Math.max(2, Math.round(6 * (1 - elapsed / emitDuration)));
          for (var i = 0; i < rate; i++) {
            var r = rects[Math.floor(Math.random() * rects.length)];
            embers.push({
              x: r.x + Math.random() * r.w,
              y: r.y + Math.random() * r.h,
              vx: (Math.random() - 0.5) * 0.5,
              vy: -0.4 - Math.random() * 1.1,
              life: 1,
              decay: 0.004 + Math.random() * 0.007,
              size: 1.2 + Math.random() * 2.6,
              hue: 20 + Math.random() * 40 // warm amber
            });
          }
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';
        for (var j = embers.length - 1; j >= 0; j--) {
          var e = embers[j];
          e.x += e.vx;
          e.y += e.vy;
          e.vy -= 0.012;
          e.vx += (Math.random() - 0.5) * 0.06;
          e.life -= e.decay;
          if (e.life <= 0) { embers.splice(j, 1); continue; }
          var gr = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 5);
          gr.addColorStop(0, 'hsla(' + e.hue + ',100%,82%,' + e.life + ')');
          gr.addColorStop(0.35, 'hsla(' + e.hue + ',100%,55%,' + (e.life * 0.55) + ')');
          gr.addColorStop(1, 'hsla(' + e.hue + ',100%,50%,0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        if (elapsed < totalDuration || embers.length > 0) {
          requestAnimationFrame(frame);
        } else {
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          resolve();
        }
      }
      frame();
    });
  }

  /* ─────────────────────────────────────────────
     Phase 2: Word Fireworks — shinier
     • Motion-trail afterimage (faded fillRect each frame)
     • Inner white-hot core + outer colored glow (screen blend)
     • Twinkling ambient sparkles
     • Golden starburst rays at each rocket detonation
     ───────────────────────────────────────────── */
  function phaseFireworks(words) {
    return new Promise(function (resolve) {
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;pointer-events:none;';
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);

      var ctx = canvas.getContext('2d');
      var particles = [];
      var rockets = [];
      var sparkles = [];
      var rays = [];
      var startTime = Date.now();
      var duration = 4500;
      var wordIdx = 0;

      var colors = [
        [255,107,107], [78,205,196], [69,183,209], [150,230,161],
        [221,160,221], [255,217,61], [107,203,119], [255,140,148],
        [168,216,234], [255,111,97], [136,216,176], [252,186,211],
        [255,180,80],  [180,140,255], [130,255,210]
      ];

      function Particle(x, y, rgb) {
        this.x = x; this.y = y;
        this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2];
        this.word = words[wordIdx % words.length];
        wordIdx++;
        var angle = Math.random() * Math.PI * 2;
        var speed = Math.random() * 3.2 + 1.6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.008 + 0.005;
        this.fontSize = 11 + Math.random() * 9;
        this.rotation = (Math.random() - 0.5) * 0.6;
        this.rotSpeed = (Math.random() - 0.5) * 0.02;
      }

      function Rocket(targetX, targetY) {
        this.x = canvas.width * Math.random();
        this.y = canvas.height;
        this.targetX = targetX; this.targetY = targetY;
        this.speed = 8 + Math.random() * 4;
        var dx = targetX - this.x, dy = targetY - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.trail = [];
      }

      function Sparkle(x, y) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = (Math.random() - 0.5) * 0.35;
        this.life = 1;
        this.decay = 0.012 + Math.random() * 0.022;
        this.size = 0.6 + Math.random() * 1.6;
        this.phase = Math.random() * Math.PI * 2;
      }

      function Ray(x, y, rgb) {
        this.x = x; this.y = y;
        this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2];
        this.life = 1;
        this.decay = 0.08;
        this.rot = Math.random() * Math.PI;
        this.count = 10 + Math.floor(Math.random() * 6);
        this.radius = 40 + Math.random() * 30;
      }

      function explode(x, y, rgb) {
        var count = 28 + Math.floor(Math.random() * 16);
        for (var i = 0; i < count; i++) particles.push(new Particle(x, y, rgb));
        rays.push(new Ray(x, y, rgb));
        // A few sparkles near the detonation
        for (var s = 0; s < 10; s++) {
          sparkles.push(new Sparkle(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60));
        }
      }

      var lastLaunch = 0;
      var launchInterval = 320;

      function draw() {
        var elapsed = Date.now() - startTime;

        // Motion-trail fade (semi-transparent black over the canvas)
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Ambient sparkles sprinkled across the sky
        if (Math.random() < 0.5) {
          sparkles.push(new Sparkle(Math.random() * canvas.width, Math.random() * canvas.height * 0.85));
        }

        // Launch rockets
        if (elapsed - lastLaunch > launchInterval && elapsed < duration - 1100) {
          var tx = canvas.width * (0.12 + Math.random() * 0.76);
          var ty = canvas.height * (0.08 + Math.random() * 0.42);
          rockets.push(new Rocket(tx, ty));
          lastLaunch = elapsed;
          launchInterval = Math.max(140, 320 - elapsed * 0.04);
        }

        // Sparkles (screen blend for shine)
        ctx.globalCompositeOperation = 'screen';
        for (var s = sparkles.length - 1; s >= 0; s--) {
          var sp = sparkles[s];
          sp.x += sp.vx; sp.y += sp.vy;
          sp.life -= sp.decay;
          if (sp.life <= 0) { sparkles.splice(s, 1); continue; }
          var twinkle = 0.45 + 0.55 * Math.sin(elapsed * 0.018 + sp.phase);
          var a = sp.life * twinkle;
          ctx.shadowColor = 'rgba(255, 250, 210, ' + a + ')';
          ctx.shadowBlur = 10;
          ctx.fillStyle = 'rgba(255, 250, 220, ' + a + ')';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Starburst rays at detonation moments
        for (var ri = rays.length - 1; ri >= 0; ri--) {
          var ry = rays[ri];
          ry.life -= ry.decay;
          if (ry.life <= 0) { rays.splice(ri, 1); continue; }
          var r2 = ry.radius * (1 + (1 - ry.life) * 1.2);
          ctx.save();
          ctx.translate(ry.x, ry.y);
          ctx.rotate(ry.rot);
          for (var k = 0; k < ry.count; k++) {
            var ang = (Math.PI * 2 * k) / ry.count;
            var grad = ctx.createLinearGradient(0, 0, Math.cos(ang) * r2, Math.sin(ang) * r2);
            grad.addColorStop(0, 'rgba(' + ry.r + ',' + ry.g + ',' + ry.b + ',' + (ry.life * 0.9) + ')');
            grad.addColorStop(0.5, 'rgba(255,240,200,' + (ry.life * 0.55) + ')');
            grad.addColorStop(1, 'rgba(' + ry.r + ',' + ry.g + ',' + ry.b + ',0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Rockets — brighter trails
        ctx.globalCompositeOperation = 'screen';
        for (var r = rockets.length - 1; r >= 0; r--) {
          var rocket = rockets[r];
          rocket.trail.push({ x: rocket.x, y: rocket.y });
          if (rocket.trail.length > 10) rocket.trail.shift();
          rocket.x += rocket.vx;
          rocket.y += rocket.vy;

          for (var t = 0; t < rocket.trail.length; t++) {
            var tAlpha = (t / rocket.trail.length);
            ctx.shadowColor = 'rgba(255, 225, 140, ' + (tAlpha * 0.7) + ')';
            ctx.shadowBlur = 12;
            ctx.fillStyle = 'rgba(255, 225, 140, ' + (tAlpha * 0.6) + ')';
            ctx.beginPath();
            ctx.arc(rocket.trail[t].x, rocket.trail[t].y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowColor = '#FFE08A';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#FFF1B0';
          ctx.beginPath();
          ctx.arc(rocket.x, rocket.y, 3.2, 0, Math.PI * 2);
          ctx.fill();

          var dx = rocket.x - rocket.targetX, dy = rocket.y - rocket.targetY;
          if (Math.sqrt(dx * dx + dy * dy) < 15) {
            var rgb = colors[Math.floor(Math.random() * colors.length)];
            explode(rocket.x, rocket.y, rgb);
            rockets.splice(r, 1);
          }
        }

        // Word particles — outer glow + white-hot inner core
        for (var i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.03;
          p.vx *= 0.995;
          p.alpha -= p.decay;
          p.rotation += p.rotSpeed;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.font = 'bold ' + Math.round(p.fontSize) + 'px Lato, sans-serif';
          ctx.textAlign = 'center';
          ctx.globalCompositeOperation = 'screen';

          // Outer colored glow
          ctx.shadowColor = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + p.alpha + ')';
          ctx.shadowBlur = 26;
          ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + p.alpha + ')';
          ctx.fillText(p.word, 0, 0);

          // Bright inner core
          ctx.shadowColor = 'rgba(255, 255, 240, ' + p.alpha + ')';
          ctx.shadowBlur = 10;
          ctx.fillStyle = 'rgba(255, 255, 240, ' + (p.alpha * 0.78) + ')';
          ctx.fillText(p.word, 0, 0);

          ctx.restore();

          if (p.alpha <= 0) particles.splice(i, 1);
        }

        if (elapsed < duration || particles.length > 0 || rockets.length > 0 || rays.length > 0) {
          requestAnimationFrame(draw);
        } else {
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          resolve();
        }
      }
      draw();
    });
  }

  /* ─────────────────────────────────────────────
     Phase 3: Typewriter Drop
     • Switch to light mode, remove darkness
     • Drop all children from the sky (parallel, minimal stagger)
     • Each child types itself out, with click sounds
     • Whole phase completes within ~5s
     ───────────────────────────────────────────── */
  function phaseTypewriterDrop(state) {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      // Force light mode so the page returns bright
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('theme', 'light'); } catch (e) {}

      // Remove darkness overlay with a short fade
      if (state && state.darkness) {
        state.darkness.style.transition = 'opacity 0.35s ease-out';
        state.darkness.style.opacity = '0';
        setTimeout(function () {
          if (state.darkness.parentNode) state.darkness.parentNode.removeChild(state.darkness);
        }, 380);
      }

      var children = Array.from(main.children);
      if (children.length === 0) { resolve(); return; }

      // Lock heights so emptied text doesn't collapse the layout
      var heightLocks = children.map(function (el) {
        var r = el.getBoundingClientRect();
        var prev = el.style.minHeight;
        el.style.minHeight = r.height + 'px';
        return prev;
      });

      // Compute longest text length to size typewriter budget
      var maxLen = 1;
      children.forEach(function (el) {
        var t = (el.textContent || '').length;
        if (t > maxLen) maxLen = t;
      });

      var TOTAL_BUDGET = 5000;    // ms — hard cap for phase 3
      var DROP_TIME = 420;        // drop animation duration
      var STAGGER = 18;           // per-child drop stagger
      var lastDropStart = (children.length - 1) * STAGGER;
      var typeBudget = TOTAL_BUDGET - lastDropStart - DROP_TIME - 120;
      if (typeBudget < 1500) typeBudget = 1500;
      var charDelay = Math.max(4, Math.min(22, typeBudget / maxLen));

      // Reset all children: invisible, above viewport
      children.forEach(function (el) {
        el.style.transition = 'none';
        el.style.filter = '';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-120vh)';
        el.style.willChange = 'transform, opacity';
      });
      void main.offsetHeight;

      var twControllers = [];

      children.forEach(function (el, idx) {
        setTimeout(function () {
          el.style.transition =
            'transform ' + DROP_TIME + 'ms cubic-bezier(0.34, 1.2, 0.55, 1), ' +
            'opacity 160ms ease-out';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';

          setTimeout(function () {
            twControllers.push(typewriterReveal(el, charDelay));
          }, DROP_TIME);
        }, idx * STAGGER);
      });

      // Hard stop: force-complete anything still typing, clean up styles
      setTimeout(function () {
        twControllers.forEach(function (tw) { if (tw && tw.complete) tw.complete(); });
        children.forEach(function (el, idx) {
          el.style.opacity = '1';
          el.style.transform = '';
          el.style.transition = '';
          el.style.willChange = '';
          el.style.minHeight = heightLocks[idx];
        });
        resolve();
      }, TOTAL_BUDGET);
    });
  }

  /* Typewriter: empties all text nodes in `el` then retypes them.
     Returns a controller with complete() that instantly restores. */
  function typewriterReveal(el, charDelay) {
    var textNodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        while (p && p !== el) {
          var tag = (p.tagName || '').toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) textNodes.push(node);
    if (textNodes.length === 0) return { complete: function () {} };

    var originals = textNodes.map(function (n) { return n.textContent; });
    textNodes.forEach(function (n) { n.textContent = ''; });

    var nodeIdx = 0, charIdx = 0;
    var cancelled = false;
    var timerId = null;

    function typeChar() {
      if (cancelled) return;
      if (nodeIdx >= textNodes.length) return;
      var tn = textNodes[nodeIdx];
      var orig = originals[nodeIdx];
      if (charIdx < orig.length) {
        var ch = orig.charAt(charIdx);
        tn.textContent = orig.substring(0, charIdx + 1);
        if (!/\s/.test(ch)) playClick();
        charIdx++;
        timerId = setTimeout(typeChar, charDelay);
      } else {
        nodeIdx++;
        charIdx = 0;
        if (nodeIdx < textNodes.length) timerId = setTimeout(typeChar, 18);
      }
    }
    typeChar();

    return {
      complete: function () {
        cancelled = true;
        if (timerId) clearTimeout(timerId);
        for (var i = nodeIdx; i < textNodes.length; i++) {
          textNodes[i].textContent = originals[i];
        }
      }
    };
  }
})();
