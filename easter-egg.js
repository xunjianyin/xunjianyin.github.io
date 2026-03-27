/**
 * Konami Code Easter Egg
 * Sequence: Up Up Down Down Left Right Left Right B A
 * Effect: Zero Gravity -> Matrix Rain -> Particle Fireworks
 */
(function () {
  const KONAMI = [
    'KeyY', 'KeyX', 'KeyJ', 'KeyG', 'KeyO',
    'KeyG', 'KeyO', 'KeyG', 'KeyO'
  ];
  let pos = 0;
  let running = false;

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

  function runSpectacle() {
    return phaseZeroGravity()
      .then(phaseMatrixRain)
      .then(phaseFireworks);
  }

  /* ── Phase 1: Zero Gravity ── */
  function phaseZeroGravity() {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);
      var saved = [];

      children.forEach(function (el) {
        var rect = el.getBoundingClientRect();
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
        // Fade out
        children.forEach(function (el) {
          el.style.opacity = '0';
        });
      }, 2000);

      setTimeout(function () {
        // Reset
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

  /* ── Phase 2: Matrix Rain ── */
  function phaseMatrixRain() {
    return new Promise(function (resolve) {
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;pointer-events:none;';
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);

      var ctx = canvas.getContext('2d');
      var fontSize = 14;
      var cols = Math.floor(canvas.width / fontSize);
      var drops = [];
      for (var i = 0; i < cols; i++) {
        drops[i] = Math.random() * -50;
      }

      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*(){}[]|;:<>?/~';
      var frame;
      var startTime = Date.now();
      var duration = 3500;

      function draw() {
        var elapsed = Date.now() - startTime;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = fontSize + 'px monospace';

        for (var i = 0; i < drops.length; i++) {
          var char = chars[Math.floor(Math.random() * chars.length)];

          // Varying green shades
          var g = Math.floor(150 + Math.random() * 105);
          ctx.fillStyle = 'rgb(0, ' + g + ', 0)';

          // Bright leading character
          if (Math.random() > 0.95) {
            ctx.fillStyle = '#ffffff';
          }

          ctx.fillText(char, i * fontSize, drops[i] * fontSize);

          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }

        if (elapsed < duration) {
          frame = requestAnimationFrame(draw);
        } else {
          // Fade out canvas
          var fadeStart = Date.now();
          function fadeOut() {
            var fadeElapsed = Date.now() - fadeStart;
            var alpha = Math.min(fadeElapsed / 500, 1);
            canvas.style.opacity = String(1 - alpha);
            if (alpha < 1) {
              requestAnimationFrame(fadeOut);
            } else {
              cancelAnimationFrame(frame);
              document.body.removeChild(canvas);
              resolve();
            }
          }
          fadeOut();
        }
      }

      draw();
    });
  }

  /* ── Phase 3: Particle Fireworks ── */
  function phaseFireworks() {
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
      var duration = 4000;

      var colors = [
        [255,107,107], [78,205,196], [69,183,209], [150,230,161],
        [221,160,221], [255,217,61], [107,203,119], [255,140,148],
        [168,216,234], [255,111,97], [136,216,176], [252,186,211],
        [181,234,215], [199,206,234], [255,183,178], [226,240,203]
      ];

      function Particle(x, y, rgb) {
        this.x = x;
        this.y = y;
        this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2];
        var angle = Math.random() * Math.PI * 2;
        var speed = Math.random() * 6 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.01;
        this.size = Math.random() * 3 + 1;
        this.trail = [];
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
        this.alpha = 1;
        this.exploded = false;
        this.trail = [];
      }

      function explode(x, y) {
        var rgb = colors[Math.floor(Math.random() * colors.length)];
        var count = 60 + Math.floor(Math.random() * 40);
        for (var i = 0; i < count; i++) {
          particles.push(new Particle(x, y, rgb));
        }
        var rgb2 = colors[Math.floor(Math.random() * colors.length)];
        for (var j = 0; j < 20; j++) {
          particles.push(new Particle(x, y, rgb2));
        }
      }

      // Launch rockets over time
      var lastLaunch = 0;
      var launchInterval = 300;

      function draw() {
        var elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Launch new rockets
        if (elapsed - lastLaunch > launchInterval && elapsed < duration - 1000) {
          var tx = canvas.width * (0.15 + Math.random() * 0.7);
          var ty = canvas.height * (0.1 + Math.random() * 0.4);
          rockets.push(new Rocket(tx, ty));
          lastLaunch = elapsed;
          // Speed up launches over time
          launchInterval = Math.max(100, 300 - elapsed * 0.05);
        }

        // Update and draw rockets
        for (var r = rockets.length - 1; r >= 0; r--) {
          var rocket = rockets[r];
          rocket.trail.push({ x: rocket.x, y: rocket.y });
          if (rocket.trail.length > 8) rocket.trail.shift();

          rocket.x += rocket.vx;
          rocket.y += rocket.vy;

          // Draw trail
          for (var t = 0; t < rocket.trail.length; t++) {
            var ta = (t / rocket.trail.length) * 0.5;
            ctx.beginPath();
            ctx.arc(rocket.trail[t].x, rocket.trail[t].y, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 200, 100, ' + ta + ')';
            ctx.fill();
          }

          // Draw rocket
          ctx.beginPath();
          ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#FFD700';
          ctx.fill();

          // Check if reached target
          var dx = rocket.x - rocket.targetX;
          var dy = rocket.y - rocket.targetY;
          if (Math.sqrt(dx * dx + dy * dy) < 15) {
            explode(rocket.x, rocket.y);
            rockets.splice(r, 1);
          }
        }

        // Update and draw particles
        for (var i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];

          p.trail.push({ x: p.x, y: p.y, alpha: p.alpha });
          if (p.trail.length > 5) p.trail.shift();

          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.06; // gravity
          p.vx *= 0.99; // drag
          p.alpha -= p.decay;

          // Draw trail
          for (var j = 0; j < p.trail.length; j++) {
            var pt = p.trail[j];
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, p.size * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + (pt.alpha * (j / p.trail.length) * 0.3) + ')';
            ctx.fill();
          }

          // Draw particle with glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + p.alpha + ')';
          ctx.fill();

          // Glow effect
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + (p.alpha * 0.2) + ')';
          ctx.fill();

          if (p.alpha <= 0) {
            particles.splice(i, 1);
          }
        }

        if (elapsed < duration || particles.length > 0 || rockets.length > 0) {
          requestAnimationFrame(draw);
        } else {
          // Restore page
          document.body.removeChild(canvas);
          restorePage();
          resolve();
        }
      }

      draw();
    });
  }

  function restorePage() {
    var main = document.getElementById('main-content');
    if (!main) return;
    Array.from(main.children).forEach(function (el) {
      el.style.transition = 'opacity 0.8s ease';
      el.style.opacity = '1';
      // Clean up after transition
      el.addEventListener('transitionend', function handler() {
        el.style.transition = '';
        el.removeEventListener('transitionend', handler);
      });
    });
  }
})();
