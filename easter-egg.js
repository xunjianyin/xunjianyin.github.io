/**
 * Easter Egg — type "yxjgogogo"
 * Phase 1: Word Fireworks — page words + special words explode as fireworks
 * Phase 2: Typewriter Drop — lines drop from the sky and type themselves out
 */
(function () {
  var KONAMI = [
    'KeyY', 'KeyX', 'KeyJ', 'KeyG', 'KeyO',
    'KeyG', 'KeyO', 'KeyG', 'KeyO'
  ];
  var pos = 0;
  var running = false;

  // Special words included in the fireworks word pool alongside harvested words
  var SPECIAL_WORDS = ['Furong', 'Flora', 'Furong Jia', 'Flora Jia', 'Yeye'];

  document.addEventListener('keydown', function (e) {
    if (running) return;
    if (e.code === KONAMI[pos]) {
      pos++;
      if (pos === KONAMI.length) {
        pos = 0;
        running = true;
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

    // Add special words to the pool just once so they show up at the
    // same rate as other words (one slot each).
    var pool = unique.concat(SPECIAL_WORDS);

    // Shuffle the combined pool
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool;
  }

  function runSpectacle() {
    var words = harvestWords();
    return phaseFireworks(words).then(phaseTypewriterDrop);
  }

  /* ─────────────────────────────────────────────
     Phase 1: Word Fireworks — ALL particles are words
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
      var startTime = Date.now();
      var duration = 4500;
      var wordIdx = 0;

      var colors = [
        [255,107,107], [78,205,196], [69,183,209], [150,230,161],
        [221,160,221], [255,217,61], [107,203,119], [255,140,148],
        [168,216,234], [255,111,97], [136,216,176], [252,186,211]
      ];

      function Particle(x, y, rgb) {
        this.x = x;
        this.y = y;
        this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2];
        this.word = words[wordIdx % words.length];
        wordIdx++;
        var angle = Math.random() * Math.PI * 2;
        var speed = Math.random() * 3 + 1.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.008 + 0.005;
        this.fontSize = 10 + Math.random() * 8;
        this.rotation = (Math.random() - 0.5) * 0.6;
        this.rotSpeed = (Math.random() - 0.5) * 0.02;
      }

      function Rocket(targetX, targetY) {
        this.x = canvas.width * Math.random();
        this.y = canvas.height;
        this.targetX = targetX;
        this.targetY = targetY;
        this.speed = 8 + Math.random() * 4;
        var dx = targetX - this.x;
        var dy = targetY - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.trail = [];
      }

      function explode(x, y) {
        var rgb = colors[Math.floor(Math.random() * colors.length)];
        var count = 25 + Math.floor(Math.random() * 15);
        for (var i = 0; i < count; i++) {
          particles.push(new Particle(x, y, rgb));
        }
      }

      var lastLaunch = 0;
      var launchInterval = 350;

      function draw() {
        var elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (elapsed - lastLaunch > launchInterval && elapsed < duration - 1200) {
          var tx = canvas.width * (0.15 + Math.random() * 0.7);
          var ty = canvas.height * (0.1 + Math.random() * 0.4);
          rockets.push(new Rocket(tx, ty));
          lastLaunch = elapsed;
          launchInterval = Math.max(150, 350 - elapsed * 0.04);
        }

        for (var r = rockets.length - 1; r >= 0; r--) {
          var rocket = rockets[r];
          rocket.trail.push({ x: rocket.x, y: rocket.y });
          if (rocket.trail.length > 8) rocket.trail.shift();
          rocket.x += rocket.vx;
          rocket.y += rocket.vy;

          for (var t = 0; t < rocket.trail.length; t++) {
            ctx.beginPath();
            ctx.arc(rocket.trail[t].x, rocket.trail[t].y, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 120, ' + ((t / rocket.trail.length) * 0.5) + ')';
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#FFD700';
          ctx.fill();

          var dx = rocket.x - rocket.targetX;
          var dy = rocket.y - rocket.targetY;
          if (Math.sqrt(dx * dx + dy * dy) < 15) {
            explode(rocket.x, rocket.y);
            rockets.splice(r, 1);
          }
        }

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
          ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + p.alpha + ')';
          ctx.shadowColor = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + (p.alpha * 0.5) + ')';
          ctx.shadowBlur = 10;
          ctx.textAlign = 'center';
          ctx.fillText(p.word, 0, 0);
          ctx.restore();

          if (p.alpha <= 0) particles.splice(i, 1);
        }

        if (elapsed < duration || particles.length > 0 || rockets.length > 0) {
          requestAnimationFrame(draw);
        } else {
          document.body.removeChild(canvas);
          resolve();
        }
      }
      draw();
    });
  }

  /* ─────────────────────────────────────────────
     Phase 2: Typewriter Drop
     Hides the page, drops each top-level child from the
     sky one-by-one into its real position, then types out
     its text content char by char.
     ───────────────────────────────────────────── */
  function phaseTypewriterDrop() {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);
      if (children.length === 0) { resolve(); return; }

      var saved = children.map(function (el) {
        return {
          el: el,
          origTransform: el.style.transform,
          origTransition: el.style.transition,
          origOpacity: el.style.opacity,
          origWillChange: el.style.willChange
        };
      });

      // Hide and lift all children above the viewport
      children.forEach(function (el) {
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-120vh)';
        el.style.willChange = 'transform, opacity';
      });
      void main.offsetHeight; // force reflow

      var stagger = 160;       // gap between successive drops
      var dropDuration = 650;  // drop animation duration
      var charDelay = 14;      // ms per character in typewriter
      var interNodeDelay = 25; // gap between text nodes in typewriter

      var longestTypewriter = 0;
      var allDropsDone = children.length * stagger + dropDuration;

      children.forEach(function (el, idx) {
        setTimeout(function () {
          el.style.transition =
            'transform ' + dropDuration + 'ms cubic-bezier(0.34, 1.3, 0.55, 1), ' +
            'opacity 200ms ease-out';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';

          // After landing, typewriter the text content
          setTimeout(function () {
            var typeTime = typewriterReveal(el, charDelay, interNodeDelay);
            var totalForThis = idx * stagger + dropDuration + typeTime;
            if (totalForThis > longestTypewriter) longestTypewriter = totalForThis;
          }, dropDuration);
        }, idx * stagger);
      });

      // Resolve once the last drop + a small buffer has elapsed.
      // Typewriter may keep running afterwards; that's fine — resolving
      // only releases the `running` gate so the user can re-trigger.
      setTimeout(function () {
        saved.forEach(function (s) {
          s.el.style.transform = s.origTransform;
          s.el.style.transition = s.origTransition;
          s.el.style.willChange = s.origWillChange;
          s.el.style.opacity = '1';
        });
        resolve();
      }, allDropsDone + 400);
    });
  }

  /* Typewriter reveal: empty out all text nodes in `el` and re-type
     them character by character. Returns the estimated total duration
     in ms so the caller can compute timing if needed. */
  function typewriterReveal(el, charDelay, interNodeDelay) {
    var textNodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.textContent) return NodeFilter.FILTER_REJECT;
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        // Skip nodes inside <script>, <style>, <noscript>
        var p = node.parentNode;
        while (p && p !== el) {
          var tag = (p.tagName || '').toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) textNodes.push(node);
    if (textNodes.length === 0) return 0;

    var originals = textNodes.map(function (n) { return n.textContent; });
    textNodes.forEach(function (n) { n.textContent = ''; });

    var nodeIdx = 0;
    var charIdx = 0;

    function typeChar() {
      if (nodeIdx >= textNodes.length) return;
      var tn = textNodes[nodeIdx];
      var orig = originals[nodeIdx];
      if (charIdx < orig.length) {
        tn.textContent = orig.substring(0, charIdx + 1);
        charIdx++;
        setTimeout(typeChar, charDelay);
      } else {
        nodeIdx++;
        charIdx = 0;
        if (nodeIdx < textNodes.length) setTimeout(typeChar, interNodeDelay);
      }
    }
    typeChar();

    var totalChars = originals.reduce(function (s, t) { return s + t.length; }, 0);
    return totalChars * charDelay + textNodes.length * interNodeDelay;
  }
})();
