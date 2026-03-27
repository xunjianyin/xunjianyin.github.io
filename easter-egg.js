/**
 * Easter Egg — type "yxjgogogo"
 * Phase 1: Zero Gravity — page floats away
 * Phase 2: Word Fireworks — page words explode as fireworks
 * Phase 3: Reconstructing Rain — characters rain down and rebuild the page
 */
(function () {
  var KONAMI = [
    'KeyY', 'KeyX', 'KeyJ', 'KeyG', 'KeyO',
    'KeyG', 'KeyO', 'KeyG', 'KeyO'
  ];
  var pos = 0;
  var running = false;

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

  // Harvest page words once (reused by fireworks)
  function harvestWords() {
    var text = (document.getElementById('main-content') || document.body).innerText || '';
    var words = text.split(/\s+/).filter(function (w) { return w.length >= 2 && w.length <= 20; });
    var unique = Array.from(new Set(words));
    for (var i = unique.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = unique[i]; unique[i] = unique[j]; unique[j] = tmp;
    }
    return unique.length > 0 ? unique : ['Xunjian', 'Yin', 'Duke', 'Research', 'AI', 'Agent'];
  }

  function runSpectacle() {
    var words = harvestWords();
    return phaseZeroGravity()
      .then(function () { return phaseFireworks(words); })
      .then(phaseReconstructingRain);
  }

  /* ─────────────────────────────────────────────
     Phase 1: Zero Gravity
     ───────────────────────────────────────────── */
  function phaseZeroGravity() {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);
      var saved = [];

      children.forEach(function (el) {
        saved.push({
          el: el,
          origTransform: el.style.transform,
          origTransition: el.style.transition,
          origPosition: el.style.position,
          origZIndex: el.style.zIndex,
          origOpacity: el.style.opacity
        });

        var tx = (Math.random() - 0.5) * 200;
        var ty = -(Math.random() * 300 + 100);
        var rot = (Math.random() - 0.5) * 40;

        el.style.transition = 'transform 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.8s ease';
        el.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) rotate(' + rot + 'deg)';
      });

      setTimeout(function () {
        children.forEach(function (el) { el.style.opacity = '0'; });
      }, 2000);

      setTimeout(function () {
        saved.forEach(function (s) {
          s.el.style.transform = s.origTransform;
          s.el.style.transition = s.origTransition;
          s.el.style.position = s.origPosition;
          s.el.style.zIndex = s.origZIndex;
          s.el.style.opacity = '0';
        });
        resolve();
      }, 3000);
    });
  }

  /* ─────────────────────────────────────────────
     Phase 2: Word Fireworks — ALL particles are words
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

        // Launch rockets
        if (elapsed - lastLaunch > launchInterval && elapsed < duration - 1200) {
          var tx = canvas.width * (0.15 + Math.random() * 0.7);
          var ty = canvas.height * (0.1 + Math.random() * 0.4);
          rockets.push(new Rocket(tx, ty));
          lastLaunch = elapsed;
          launchInterval = Math.max(150, 350 - elapsed * 0.04);
        }

        // Draw rockets
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

        // Draw word particles
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
     Phase 3: Reconstructing Rain
     Full sentences / titles / author lists rain down,
     then the page rebuilds itself top-to-bottom.
     ───────────────────────────────────────────── */
  function phaseReconstructingRain() {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      // ── Harvest meaningful phrases from the page ──
      var phrases = [];
      // Paper titles
      main.querySelectorAll('.papertitle').forEach(function (el) {
        var t = el.textContent.trim();
        if (t) phrases.push(t);
      });
      // Author lines
      main.querySelectorAll('.paper_rest').forEach(function (el) {
        var t = el.textContent.trim().split('\n')[0].trim();
        if (t && t.length > 5) phrases.push(t);
      });
      // Section headings
      main.querySelectorAll('h1, h2, h3').forEach(function (el) {
        var t = el.textContent.trim();
        if (t) phrases.push(t);
      });
      // News items
      main.querySelectorAll('.news-list li').forEach(function (el) {
        var t = el.textContent.trim();
        if (t) phrases.push(t);
      });
      // Bio paragraphs / any <p>
      main.querySelectorAll('.bio, p').forEach(function (el) {
        var t = el.textContent.trim();
        if (t && t.length > 10) {
          // Split long text into sentence-ish chunks
          var sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [t];
          sentences.forEach(function (s) {
            s = s.trim();
            if (s.length > 5) phrases.push(s);
          });
        }
      });
      // Project descriptions
      main.querySelectorAll('#projects-list li').forEach(function (el) {
        var t = el.textContent.trim();
        if (t) phrases.push(t);
      });
      // Name
      var nameEl = main.querySelector('.name');
      if (nameEl) phrases.push(nameEl.textContent.trim());

      // Deduplicate and shuffle
      phrases = Array.from(new Set(phrases));
      for (var i = phrases.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = phrases[i]; phrases[i] = phrases[j]; phrases[j] = tmp;
      }
      if (phrases.length === 0) phrases = ['Xunjian Yin', 'Duke University', 'Research'];

      // ── Create overlay container for falling text ──
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;pointer-events:none;overflow:hidden;';
      document.body.appendChild(overlay);

      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      var colors = [
        [0, 101, 192],    // site blue
        [107, 163, 245],  // light blue
        [78, 205, 196],   // teal
        [150, 230, 161],  // green
        [240, 146, 40],   // site orange
        [255, 183, 178],  // pink
      ];

      // ── Raindrop: a falling phrase ──
      var drops = [];
      var phraseIdx = 0;
      var startTime = Date.now();
      var spawnDuration = 3500;  // how long we keep spawning new drops
      var totalDuration = 5000;  // total phase time

      function spawnDrop() {
        var text = phrases[phraseIdx % phrases.length];
        phraseIdx++;
        var rgb = colors[Math.floor(Math.random() * colors.length)];

        var el = document.createElement('div');
        var fSize = 11 + Math.floor(Math.random() * 6);
        el.textContent = text;
        el.style.cssText =
          'position:absolute;white-space:nowrap;font-family:Lato,sans-serif;' +
          'font-size:' + fSize + 'px;font-weight:600;pointer-events:none;' +
          'color:rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.85);' +
          'text-shadow:0 0 8px rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.3);' +
          'left:' + (Math.random() * 90) + '%;' +
          'top:-40px;';
        overlay.appendChild(el);

        var speed = 1.5 + Math.random() * 3;  // px per frame
        var y = -40;
        var maxY = window.innerHeight + 50;

        drops.push({ el: el, y: y, speed: speed, maxY: maxY, done: false });
      }

      // Get children for progressive reveal
      var children = Array.from(main.children);
      var childData = children.map(function (el) {
        var rect = el.getBoundingClientRect();
        return { el: el, revealed: false };
      });
      var revealDelay = 800;
      var revealDuration = 3200;

      // Spawn initial batch
      var spawnInterval = 80;
      var lastSpawn = 0;

      function animate() {
        var elapsed = Date.now() - startTime;

        // Spawn new drops
        if (elapsed < spawnDuration && elapsed - lastSpawn > spawnInterval) {
          // Spawn 1-3 at a time for density
          var count = 1 + Math.floor(Math.random() * 2);
          for (var s = 0; s < count; s++) spawnDrop();
          lastSpawn = elapsed;
          // Increase density over time
          spawnInterval = Math.max(30, 80 - elapsed * 0.012);
        }

        // Move drops
        var activeDrop = false;
        for (var d = 0; d < drops.length; d++) {
          var drop = drops[d];
          if (drop.done) continue;
          drop.y += drop.speed;
          drop.el.style.top = drop.y + 'px';

          // Fade out as it nears bottom
          if (drop.y > drop.maxY * 0.7) {
            var fadeAlpha = Math.max(0, 1 - (drop.y - drop.maxY * 0.7) / (drop.maxY * 0.3));
            drop.el.style.opacity = String(fadeAlpha);
          }

          if (drop.y > drop.maxY) {
            drop.done = true;
            if (drop.el.parentNode) drop.el.parentNode.removeChild(drop.el);
          } else {
            activeDrop = true;
          }
        }

        // Progressive page reveal
        var revealProgress = Math.max(0, Math.min(1, (elapsed - revealDelay) / revealDuration));
        var revealCount = Math.floor(revealProgress * childData.length);
        for (var c = 0; c < childData.length; c++) {
          if (c < revealCount && !childData[c].revealed) {
            childData[c].revealed = true;
            var el = childData[c].el;
            el.style.transition = 'opacity 0.8s ease';
            el.style.opacity = '1';
          }
        }

        // End condition
        if (elapsed > totalDuration && !activeDrop) {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          children.forEach(function (el) {
            el.style.opacity = '1';
            el.style.transition = '';
          });
          resolve();
          return;
        }

        requestAnimationFrame(animate);
      }

      animate();
    });
  }
})();
