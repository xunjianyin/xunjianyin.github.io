/**
 * Easter Egg — type "yxjgogogo"
 * Phase 1: Shatter & Glitch — page fragments, distorts, and explodes outward
 * Phase 2: Word Fireworks — page words + special words explode as fireworks
 * Phase 3: Scroll Unfurl — a scroll unrolls top-to-bottom, revealing the page
 */
(function () {
  var KONAMI = [
    'KeyY', 'KeyX', 'KeyJ', 'KeyG', 'KeyO',
    'KeyG', 'KeyO', 'KeyG', 'KeyO'
  ];
  var pos = 0;
  var running = false;

  // Special words the user wants to always show up in fireworks
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

  // Harvest page words once (reused by fireworks)
  function harvestWords() {
    var text = (document.getElementById('main-content') || document.body).innerText || '';
    var words = text.split(/\s+/).filter(function (w) { return w.length >= 2 && w.length <= 20; });
    var unique = Array.from(new Set(words));
    for (var i = unique.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = unique[i]; unique[i] = unique[j]; unique[j] = tmp;
    }
    if (unique.length === 0) unique = ['Xunjian', 'Yin', 'Duke', 'Research', 'AI', 'Agent'];

    // Interleave SPECIAL_WORDS so they appear frequently (roughly every ~4 particles)
    var mixed = [];
    var specialCopies = SPECIAL_WORDS.slice();
    // Shuffle special words
    for (var k = specialCopies.length - 1; k > 0; k--) {
      var m = Math.floor(Math.random() * (k + 1));
      var t = specialCopies[k]; specialCopies[k] = specialCopies[m]; specialCopies[m] = t;
    }
    var sIdx = 0;
    for (var n = 0; n < unique.length; n++) {
      mixed.push(unique[n]);
      if (n % 3 === 0) {
        mixed.push(specialCopies[sIdx % specialCopies.length]);
        sIdx++;
      }
    }
    return mixed;
  }

  function runSpectacle() {
    var words = harvestWords();
    return phaseShatter()
      .then(function () { return phaseFireworks(words); })
      .then(phaseScrollUnfurl);
  }

  /* ─────────────────────────────────────────────
     Phase 1: Shatter & Glitch
     Page jitters with chromatic glitch, then fragments
     fly outward with heavy distortion.
     ───────────────────────────────────────────── */
  function phaseShatter() {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);
      var saved = [];

      // Inject glitch keyframes
      var styleEl = document.createElement('style');
      styleEl.textContent =
        '@keyframes yxj-glitch-shake{' +
        '0%{transform:translate(0,0) skew(0,0)}' +
        '15%{transform:translate(-5px,2px) skew(3deg,0)}' +
        '30%{transform:translate(4px,-3px) skew(-2deg,1deg)}' +
        '45%{transform:translate(-3px,4px) skew(2deg,-1deg)}' +
        '60%{transform:translate(5px,-2px) skew(-3deg,0)}' +
        '75%{transform:translate(-4px,3px) skew(1deg,2deg)}' +
        '90%{transform:translate(3px,-4px) skew(-1deg,-1deg)}' +
        '100%{transform:translate(0,0) skew(0,0)}' +
        '}' +
        '@keyframes yxj-glitch-hue{' +
        '0%{filter:hue-rotate(0) contrast(1.2) saturate(1.6)}' +
        '25%{filter:hue-rotate(90deg) contrast(1.6) saturate(2.2) drop-shadow(3px 0 0 rgba(255,0,80,0.7)) drop-shadow(-3px 0 0 rgba(0,200,255,0.7))}' +
        '50%{filter:hue-rotate(200deg) contrast(1.4) saturate(1.8)}' +
        '75%{filter:hue-rotate(320deg) contrast(1.8) saturate(2.4) drop-shadow(-2px 0 0 rgba(255,50,0,0.6)) drop-shadow(2px 0 0 rgba(0,255,200,0.6))}' +
        '100%{filter:hue-rotate(360deg) contrast(1.2) saturate(1.6)}' +
        '}';
      document.head.appendChild(styleEl);

      // Phase 1a: glitch shake with chromatic aberration
      children.forEach(function (el, idx) {
        saved.push({
          el: el,
          origTransform: el.style.transform,
          origTransition: el.style.transition,
          origFilter: el.style.filter,
          origAnimation: el.style.animation,
          origOpacity: el.style.opacity,
          origWillChange: el.style.willChange
        });
        el.style.willChange = 'transform, filter, opacity';
        el.style.animation =
          'yxj-glitch-shake 0.18s steps(3) infinite, ' +
          'yxj-glitch-hue 0.6s linear infinite';
      });

      // Phase 1b: shatter outward with extreme distortion
      setTimeout(function () {
        children.forEach(function (el) {
          var tx = (Math.random() - 0.5) * 1000;
          var ty = (Math.random() - 0.5) * 700 - 120;
          var rot = (Math.random() - 0.5) * 280;
          var skX = (Math.random() - 0.5) * 55;
          var skY = (Math.random() - 0.5) * 30;
          var sc = 0.2 + Math.random() * 1.4;
          var blur = 3 + Math.random() * 10;
          var hue = Math.floor(Math.random() * 360);

          el.style.animation = 'none';
          el.style.transition =
            'transform 1.5s cubic-bezier(0.5,-0.1,0.75,0.4), ' +
            'opacity 1.2s ease 0.25s, ' +
            'filter 1.5s ease';
          el.style.transform =
            'translate(' + tx + 'px,' + ty + 'px) ' +
            'rotate(' + rot + 'deg) ' +
            'skew(' + skX + 'deg,' + skY + 'deg) ' +
            'scale(' + sc + ')';
          el.style.filter =
            'blur(' + blur + 'px) ' +
            'hue-rotate(' + hue + 'deg) ' +
            'contrast(2.2) saturate(3) ' +
            'drop-shadow(4px 0 0 rgba(255,40,80,0.7)) ' +
            'drop-shadow(-4px 0 0 rgba(60,200,255,0.7))';
          el.style.opacity = '0';
        });
      }, 750);

      // Cleanup & hand off
      setTimeout(function () {
        saved.forEach(function (s) {
          s.el.style.transform = s.origTransform;
          s.el.style.transition = s.origTransition;
          s.el.style.filter = s.origFilter;
          s.el.style.animation = s.origAnimation;
          s.el.style.willChange = s.origWillChange;
          s.el.style.opacity = '0';
        });
        if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        resolve();
      }, 2600);
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

      function Particle(x, y, rgb, forceSpecial) {
        this.x = x;
        this.y = y;
        this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2];
        if (forceSpecial) {
          this.word = SPECIAL_WORDS[Math.floor(Math.random() * SPECIAL_WORDS.length)];
          this.isSpecial = true;
        } else {
          this.word = words[wordIdx % words.length];
          wordIdx++;
          this.isSpecial = SPECIAL_WORDS.indexOf(this.word) !== -1;
        }
        var angle = Math.random() * Math.PI * 2;
        var speed = Math.random() * 3 + 1.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.008 + 0.005;
        // Special words draw larger so they stand out
        this.fontSize = this.isSpecial ? (16 + Math.random() * 8) : (10 + Math.random() * 8);
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
        // Guarantee at least 3 special words per burst so they appear often
        for (var i = 0; i < count; i++) {
          var forceSpecial = i < 3;
          particles.push(new Particle(x, y, rgb, forceSpecial));
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
          ctx.font = (p.isSpecial ? 'bold italic ' : 'bold ') + Math.round(p.fontSize) + 'px Lato, sans-serif';
          ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + p.alpha + ')';
          ctx.shadowColor = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + (p.alpha * 0.5) + ')';
          ctx.shadowBlur = p.isSpecial ? 18 : 10;
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
     Phase 3: Scroll Unfurl
     A rolled scroll descends from the top, unfurling
     the page line-by-line as its leading edge sweeps down.
     ───────────────────────────────────────────── */
  function phaseScrollUnfurl() {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);

      // Restore children to visible so the clip-path is what controls reveal
      children.forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = '';
        el.style.filter = '';
      });

      // Save original styles on main for clipping
      var origClip = main.style.clipPath;
      var origWebkitClip = main.style.webkitClipPath;
      var origTransition = main.style.transition;

      // Start fully hidden via clip-path (clip from top)
      main.style.transition = 'none';
      main.style.clipPath = 'inset(0 0 100% 0)';
      main.style.webkitClipPath = 'inset(0 0 100% 0)';
      void main.offsetHeight; // force reflow

      // The scroll roller: a warm parchment-colored bar with a rolled cylinder
      // edge, positioned at the current reveal line. Spans full viewport width.
      var roller = document.createElement('div');
      roller.style.cssText =
        'position:fixed;left:0;right:0;height:22px;z-index:99998;pointer-events:none;' +
        'background:' +
        '  linear-gradient(180deg,' +
        '    rgba(120,82,40,0) 0%,' +
        '    rgba(168,125,74,0.35) 20%,' +
        '    rgba(120,82,40,0.85) 45%,' +
        '    rgba(80,54,24,0.95) 52%,' +
        '    rgba(120,82,40,0.85) 60%,' +
        '    rgba(168,125,74,0.35) 85%,' +
        '    rgba(120,82,40,0) 100%' +
        '  );' +
        'box-shadow:' +
        '  0 6px 14px rgba(60,40,20,0.35),' +
        '  0 -2px 6px rgba(200,160,100,0.25),' +
        '  inset 0 1px 0 rgba(255,230,180,0.45),' +
        '  inset 0 -1px 0 rgba(40,25,10,0.5);';
      document.body.appendChild(roller);

      // Subtle "paper shadow" just above the roller for a lifted scroll look
      var paperShadow = document.createElement('div');
      paperShadow.style.cssText =
        'position:fixed;left:0;right:0;height:40px;z-index:99997;pointer-events:none;' +
        'background:linear-gradient(180deg,' +
        '  rgba(0,0,0,0) 0%,' +
        '  rgba(0,0,0,0.08) 70%,' +
        '  rgba(0,0,0,0.15) 100%' +
        ');';
      document.body.appendChild(paperShadow);

      var duration = 4500;
      var startTime = Date.now();
      var mainRect = main.getBoundingClientRect();
      var pageTop = mainRect.top;      // relative to viewport
      var pageHeight = mainRect.height;

      function animate() {
        var elapsed = Date.now() - startTime;
        var t = Math.min(1, elapsed / duration);
        // Ease-out cubic for a gentle settling
        var eased = 1 - Math.pow(1 - t, 3);

        // Reveal from top: inset bottom shrinks from 100% to 0%
        var insetBottom = (1 - eased) * 100;
        var clip = 'inset(0 0 ' + insetBottom + '% 0)';
        main.style.clipPath = clip;
        main.style.webkitClipPath = clip;

        // Position the roller at the leading edge of the reveal.
        // The reveal reaches from main's top down to: top + eased * height.
        var edgeY = pageTop + eased * pageHeight;
        // Clamp into viewport so the roller stays visible even on short pages
        var viewportMax = window.innerHeight - 22;
        var rollerY = Math.max(0, Math.min(viewportMax, edgeY - 11));
        roller.style.top = rollerY + 'px';
        paperShadow.style.top = (rollerY - 40) + 'px';

        if (t < 1) {
          requestAnimationFrame(animate);
          return;
        }

        // Cleanup: restore main, remove roller
        main.style.clipPath = origClip;
        main.style.webkitClipPath = origWebkitClip;
        main.style.transition = origTransition;

        // Roller slides out of view (bottom) as a finishing touch
        roller.style.transition = 'top 0.5s ease, opacity 0.5s ease';
        paperShadow.style.transition = 'top 0.5s ease, opacity 0.5s ease';
        roller.style.top = (window.innerHeight + 30) + 'px';
        paperShadow.style.top = window.innerHeight + 'px';
        roller.style.opacity = '0';
        paperShadow.style.opacity = '0';

        setTimeout(function () {
          if (roller.parentNode) roller.parentNode.removeChild(roller);
          if (paperShadow.parentNode) paperShadow.parentNode.removeChild(paperShadow);
          resolve();
        }, 550);
      }

      animate();
    });
  }
})();
