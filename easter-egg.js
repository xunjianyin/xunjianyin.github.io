/**
 * Easter Egg — type "yxjgogogo"
 * Phase 1: Dissolve to Night — content fades while cool stardust drifts up,
 *          page settles into a deep-indigo night sky.
 * Phase 2: Shining Fireworks — sprite-cached word particles, crisp at DPR,
 *          with twinkling stars, rocket trails, and starburst rays.
 * Phase 3: Typewriter Reveal — light mode, each top-level section drops in
 *          and types itself out sequentially with click sounds.
 *          Hidden DOM (abstracts, citations, etc.) is skipped.
 */
(function () {
  var KONAMI = [
    'KeyY', 'KeyX', 'KeyJ', 'KeyG', 'KeyO',
    'KeyG', 'KeyO', 'KeyG', 'KeyO'
  ];
  var pos = 0;
  var running = false;

  var SPECIAL_WORDS = ['Furong', 'Flora', 'Furong Jia', 'Flora Jia', 'Yeye'];

  /* ─── Helpers ──────────────────────────────────────────────── */
  function capDPR() { return Math.min(window.devicePixelRatio || 1, 2); }

  function setupCanvas(canvas) {
    var dpr = capDPR();
    var w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { ctx: ctx, dpr: dpr, width: w, height: h };
  }

  /* ─── Audio (typewriter click) ─────────────────────────────── */
  var audioCtx = null;
  var clickBuffer = null;
  var lastClickTime = 0;
  var CLICK_MIN_GAP = 30;

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
      .then(function () { return phaseTypewriterReveal(state); });
  }

  /* ─────────────────────────────────────────────
     Phase 1: Dissolve to Night
     Content desaturates and sinks while fine cool-toned
     dust particles rise from its positions and the page
     deepens into an indigo night sky.
     ───────────────────────────────────────────── */
  function phaseDissolve(state) {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);

      // Deep-indigo night overlay — persists through fireworks
      var night = document.createElement('div');
      night.style.cssText =
        'position:fixed;inset:0;z-index:99990;pointer-events:none;opacity:0;' +
        'background:' +
        '  radial-gradient(ellipse at 50% 42%,' +
        '    rgba(18,24,60,0.92) 0%,' +
        '    rgba(8,12,34,0.97) 45%,' +
        '    rgba(2,3,12,1) 100%);' +
        'transition:opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1);';
      document.body.appendChild(night);
      state.night = night;

      // Dust canvas
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;z-index:99991;pointer-events:none;';
      var setup = setupCanvas(canvas);
      var ctx = setup.ctx;
      var W = setup.width, H = setup.height;
      document.body.appendChild(canvas);

      // Visible rects for dust emission
      var rects = [];
      children.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.bottom > 0 && r.top < H) {
          rects.push({
            x: r.left,
            y: Math.max(0, r.top),
            w: r.width,
            h: Math.min(H, r.bottom) - Math.max(0, r.top)
          });
        }
      });

      // Start content dissolution (blur + cool desaturation)
      children.forEach(function (el) {
        el.style.transition =
          'filter 1.3s cubic-bezier(0.4, 0, 0.2, 1),' +
          'opacity 1.5s cubic-bezier(0.55, 0, 0.45, 1),' +
          'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.filter = 'blur(5px) saturate(0.4) brightness(0.55) hue-rotate(-20deg)';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.985) translateY(4px)';
      });

      requestAnimationFrame(function () { night.style.opacity = '1'; });

      // Cool stardust palette
      var palette = [
        [180, 220, 255],  // ice blue
        [120, 180, 245],  // soft steel
        [95,  150, 235],  // cornflower
        [160, 200, 255],  // lavender ice
        [220, 235, 255],  // starlight
        [130, 210, 245]   // cyan sky
      ];

      var dust = [];
      var startTime = performance.now();
      var emitDuration = 1600;
      var totalDuration = 2300;
      var lastFrame = startTime;

      // Gently-drifting twinkle stars that accumulate in the night sky
      var stars = [];
      var maxStars = 80;

      function frame(now) {
        var elapsed = now - startTime;
        var dt = Math.min(40, now - lastFrame);
        lastFrame = now;
        var dtScale = dt / 16.67;

        // Emit dust from content rects (dense early, tapering off)
        if (elapsed < emitDuration && rects.length > 0) {
          var emitProgress = elapsed / emitDuration;
          var rate = Math.max(3, Math.round(14 * (1 - emitProgress * 0.7)));
          for (var i = 0; i < rate; i++) {
            var r = rects[Math.floor(Math.random() * rects.length)];
            var rgb = palette[Math.floor(Math.random() * palette.length)];
            dust.push({
              x: r.x + Math.random() * r.w,
              y: r.y + Math.random() * r.h,
              vx: (Math.random() - 0.5) * 0.25,
              vy: -0.2 - Math.random() * 0.7,
              wave: Math.random() * Math.PI * 2,
              waveSpeed: 0.02 + Math.random() * 0.03,
              waveAmp: 0.1 + Math.random() * 0.25,
              life: 1,
              decay: 0.003 + Math.random() * 0.006,
              size: 0.4 + Math.random() * 1.3,
              rgb: rgb
            });
          }
        }

        // Seed a few background stars as the night deepens
        if (stars.length < maxStars && Math.random() < 0.6) {
          stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            size: 0.3 + Math.random() * 1.1,
            phase: Math.random() * Math.PI * 2,
            speed: 0.015 + Math.random() * 0.025,
            baseAlpha: 0.4 + Math.random() * 0.5,
            rgb: palette[Math.floor(Math.random() * palette.length)]
          });
        }

        ctx.clearRect(0, 0, W, H);

        // Background twinkle stars
        ctx.globalCompositeOperation = 'lighter';
        for (var s = 0; s < stars.length; s++) {
          var st = stars[s];
          var tw = 0.55 + 0.45 * Math.sin(now * st.speed + st.phase);
          var a = st.baseAlpha * tw * Math.min(1, elapsed / 800);
          ctx.fillStyle = 'rgba(' + st.rgb[0] + ',' + st.rgb[1] + ',' + st.rgb[2] + ',' + a + ')';
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Dust: additive with soft radial gradient per particle
        for (var j = dust.length - 1; j >= 0; j--) {
          var d = dust[j];
          d.wave += d.waveSpeed * dtScale;
          d.x += (d.vx + Math.sin(d.wave) * d.waveAmp) * dtScale;
          d.y += d.vy * dtScale;
          d.vy -= 0.008 * dtScale;
          d.life -= d.decay * dtScale;
          if (d.life <= 0) { dust.splice(j, 1); continue; }

          var radius = d.size * 4;
          var gr = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, radius);
          gr.addColorStop(0,   'rgba(' + d.rgb[0] + ',' + d.rgb[1] + ',' + d.rgb[2] + ',' + d.life + ')');
          gr.addColorStop(0.4, 'rgba(' + d.rgb[0] + ',' + d.rgb[1] + ',' + d.rgb[2] + ',' + (d.life * 0.4) + ')');
          gr.addColorStop(1,   'rgba(' + d.rgb[0] + ',' + d.rgb[1] + ',' + d.rgb[2] + ',0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        if (elapsed < totalDuration || dust.length > 0) {
          requestAnimationFrame(frame);
        } else {
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ─────────────────────────────────────────────
     Phase 2: Shining Fireworks
     Performance strategy:
       • DPR-aware crisp canvas (capped at 2)
       • Pre-rendered word sprites (per word+color) → drawImage
       • Pre-rendered starburst sprites
       • dt-based motion (frame-rate independent)
       • Cap particle count to avoid runaway lag
       • Shadow blur only in sprite generation, never per frame
     ───────────────────────────────────────────── */
  function phaseFireworks(words) {
    return new Promise(function (resolve) {
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
      var setup = setupCanvas(canvas);
      var ctx = setup.ctx, W = setup.width, H = setup.height;
      document.body.appendChild(canvas);

      var colors = [
        [255,120,120], [90,215,200], [90,195,215], [160,235,170],
        [225,170,225], [255,220,100], [130,220,150], [255,160,170],
        [175,220,240], [255,130,110], [150,220,190], [250,200,220],
        [255,195,115], [190,160,255], [150,255,215]
      ];

      // ─── Sprite caches ───────────────────────────────
      var wordSpriteCache = Object.create(null);
      function getWordSprite(word, rgb) {
        var key = word + '|' + rgb[0] + ',' + rgb[1] + ',' + rgb[2];
        if (wordSpriteCache[key]) return wordSpriteCache[key];
        var dpr = capDPR();
        var fontSize = 22;
        var pad = 26;

        var measureCanvas = document.createElement('canvas');
        var mctx = measureCanvas.getContext('2d');
        mctx.font = 'bold ' + fontSize + 'px Lato, "Helvetica Neue", sans-serif';
        var textW = mctx.measureText(word).width;
        var w = Math.ceil(textW) + pad * 2;
        var h = fontSize + pad * 2;

        var c = document.createElement('canvas');
        c.width = Math.ceil(w * dpr);
        c.height = Math.ceil(h * dpr);
        var cctx = c.getContext('2d');
        cctx.scale(dpr, dpr);
        cctx.textAlign = 'center';
        cctx.textBaseline = 'middle';
        cctx.font = 'bold ' + fontSize + 'px Lato, "Helvetica Neue", sans-serif';

        // Outer colored glow (double-fill for intensity)
        cctx.shadowColor = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
        cctx.shadowBlur = 22;
        cctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',1)';
        cctx.fillText(word, w / 2, h / 2);
        cctx.fillText(word, w / 2, h / 2);

        // Bright inner core
        cctx.shadowColor = 'rgba(255,255,250,0.9)';
        cctx.shadowBlur = 6;
        cctx.fillStyle = 'rgba(255,255,248,0.96)';
        cctx.fillText(word, w / 2, h / 2);

        var sprite = { canvas: c, width: w, height: h, baseFontSize: fontSize };
        wordSpriteCache[key] = sprite;
        return sprite;
      }

      var burstSpriteCache = Object.create(null);
      function getBurstSprite(rgb) {
        var key = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
        if (burstSpriteCache[key]) return burstSpriteCache[key];
        var dpr = capDPR();
        var size = 160;
        var c = document.createElement('canvas');
        c.width = Math.ceil(size * dpr);
        c.height = Math.ceil(size * dpr);
        var bctx = c.getContext('2d');
        bctx.scale(dpr, dpr);
        bctx.translate(size / 2, size / 2);

        var count = 14;
        var radius = size / 2 - 8;
        for (var k = 0; k < count; k++) {
          var ang = (Math.PI * 2 * k) / count;
          var x2 = Math.cos(ang) * radius;
          var y2 = Math.sin(ang) * radius;
          var grad = bctx.createLinearGradient(0, 0, x2, y2);
          grad.addColorStop(0, 'rgba(255,255,240,0.95)');
          grad.addColorStop(0.15, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.85)');
          grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
          bctx.strokeStyle = grad;
          bctx.lineWidth = 1.6;
          bctx.beginPath();
          bctx.moveTo(0, 0);
          bctx.lineTo(x2, y2);
          bctx.stroke();
        }

        // Central flash
        var flash = bctx.createRadialGradient(0, 0, 0, 0, 0, 22);
        flash.addColorStop(0, 'rgba(255,255,245,0.95)');
        flash.addColorStop(0.4, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.6)');
        flash.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
        bctx.fillStyle = flash;
        bctx.beginPath();
        bctx.arc(0, 0, 22, 0, Math.PI * 2);
        bctx.fill();

        var sprite = { canvas: c, size: size };
        burstSpriteCache[key] = sprite;
        return sprite;
      }

      // ─── Particles / rockets / sparkles / bursts ─────
      var particles = [];
      var rockets = [];
      var sparkles = [];
      var bursts = [];
      var MAX_PARTICLES = 380;
      var MAX_SPARKLES = 200;

      var wordIdx = 0;

      function Particle(x, y, rgb) {
        this.x = x; this.y = y;
        this.sprite = getWordSprite(words[wordIdx % words.length], rgb);
        wordIdx++;
        var angle = Math.random() * Math.PI * 2;
        var speed = 1.5 + Math.random() * 3.2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = 0.004 + Math.random() * 0.008;
        this.scale = 0.55 + Math.random() * 0.5;
        this.rotation = (Math.random() - 0.5) * 0.5;
        this.rotSpeed = (Math.random() - 0.5) * 0.018;
      }

      function Rocket(targetX, targetY) {
        this.x = W * (0.1 + Math.random() * 0.8);
        this.y = H + 10;
        this.targetX = targetX;
        this.targetY = targetY;
        var dx = targetX - this.x, dy = targetY - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var speed = 9 + Math.random() * 3;
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
        this.trail = [];
      }

      function Sparkle(x, y) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.life = 1;
        this.decay = 0.012 + Math.random() * 0.022;
        this.size = 0.5 + Math.random() * 1.3;
        this.phase = Math.random() * Math.PI * 2;
      }

      function Burst(x, y, rgb) {
        this.x = x; this.y = y;
        this.sprite = getBurstSprite(rgb);
        this.life = 1;
        this.decay = 0.07;
        this.rot = Math.random() * Math.PI;
        this.scale = 0.9 + Math.random() * 0.35;
      }

      function detonate(x, y) {
        var rgb = colors[Math.floor(Math.random() * colors.length)];
        var count = 26 + Math.floor(Math.random() * 18);
        for (var i = 0; i < count; i++) particles.push(new Particle(x, y, rgb));
        bursts.push(new Burst(x, y, rgb));
        for (var s = 0; s < 12; s++) {
          sparkles.push(new Sparkle(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80));
        }
        // Enforce caps (drop oldest)
        while (particles.length > MAX_PARTICLES) particles.shift();
        while (sparkles.length > MAX_SPARKLES) sparkles.shift();
      }

      var startTime = performance.now();
      var lastLaunch = 0;
      var launchInterval = 320;
      var duration = 4800;
      var lastFrame = startTime;

      function draw(now) {
        var elapsed = now - startTime;
        var dt = Math.min(40, now - lastFrame);
        lastFrame = now;
        var dtScale = dt / 16.67;

        // Motion-trail fade
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(0, 0, W, H);

        // Ambient sparkles sprinkled across the sky
        if (sparkles.length < MAX_SPARKLES && Math.random() < 0.55) {
          sparkles.push(new Sparkle(Math.random() * W, Math.random() * H * 0.85));
        }

        // Launch rockets
        if (elapsed - lastLaunch > launchInterval && elapsed < duration - 1100) {
          var tx = W * (0.12 + Math.random() * 0.76);
          var ty = H * (0.1 + Math.random() * 0.4);
          rockets.push(new Rocket(tx, ty));
          lastLaunch = elapsed;
          launchInterval = Math.max(150, 320 - elapsed * 0.035);
        }

        // Sparkles — plain additive dots, no shadow
        ctx.globalCompositeOperation = 'lighter';
        for (var s = sparkles.length - 1; s >= 0; s--) {
          var sp = sparkles[s];
          sp.x += sp.vx * dtScale;
          sp.y += sp.vy * dtScale;
          sp.life -= sp.decay * dtScale;
          if (sp.life <= 0) { sparkles.splice(s, 1); continue; }
          var tw = 0.4 + 0.6 * Math.sin(elapsed * 0.016 + sp.phase);
          var a = sp.life * tw;
          ctx.fillStyle = 'rgba(255, 252, 220, ' + a + ')';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Starburst sprites at detonations
        for (var b = bursts.length - 1; b >= 0; b--) {
          var br = bursts[b];
          br.life -= br.decay * dtScale;
          if (br.life <= 0) { bursts.splice(b, 1); continue; }
          var expansion = 1 + (1 - br.life) * 1.4;
          var drawSize = br.sprite.size * br.scale * expansion;
          ctx.save();
          ctx.globalAlpha = br.life;
          ctx.translate(br.x, br.y);
          ctx.rotate(br.rot);
          ctx.drawImage(br.sprite.canvas, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          ctx.restore();
        }

        // Rockets (bright heads + golden trails, no per-frame shadow)
        for (var r = rockets.length - 1; r >= 0; r--) {
          var rocket = rockets[r];
          rocket.trail.push({ x: rocket.x, y: rocket.y });
          if (rocket.trail.length > 12) rocket.trail.shift();
          rocket.x += rocket.vx * dtScale;
          rocket.y += rocket.vy * dtScale;

          for (var t = 0; t < rocket.trail.length; t++) {
            var tA = (t / rocket.trail.length) * 0.7;
            ctx.fillStyle = 'rgba(255, 225, 150, ' + tA + ')';
            ctx.beginPath();
            ctx.arc(rocket.trail[t].x, rocket.trail[t].y, 2.1, 0, Math.PI * 2);
            ctx.fill();
          }
          // Head: draw a small radial gradient once (cheap compared to shadow)
          var headGrad = ctx.createRadialGradient(rocket.x, rocket.y, 0, rocket.x, rocket.y, 10);
          headGrad.addColorStop(0, 'rgba(255, 250, 220, 1)');
          headGrad.addColorStop(0.4, 'rgba(255, 225, 130, 0.7)');
          headGrad.addColorStop(1, 'rgba(255, 200, 80, 0)');
          ctx.fillStyle = headGrad;
          ctx.beginPath();
          ctx.arc(rocket.x, rocket.y, 10, 0, Math.PI * 2);
          ctx.fill();

          var dx = rocket.x - rocket.targetX, dy = rocket.y - rocket.targetY;
          if (Math.sqrt(dx * dx + dy * dy) < 16) {
            detonate(rocket.x, rocket.y);
            rockets.splice(r, 1);
          }
        }

        // Word particles (drawImage of pre-rendered sprites)
        for (var i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.x += p.vx * dtScale;
          p.y += p.vy * dtScale;
          p.vy += 0.03 * dtScale;
          p.vx *= Math.pow(0.995, dtScale);
          p.alpha -= p.decay * dtScale;
          p.rotation += p.rotSpeed * dtScale;
          if (p.alpha <= 0) { particles.splice(i, 1); continue; }

          var sp2 = p.sprite;
          var w = sp2.width * p.scale;
          var h = sp2.height * p.scale;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.drawImage(sp2.canvas, -w / 2, -h / 2, w, h);
          ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        if (elapsed < duration || particles.length > 0 || rockets.length > 0 || bursts.length > 0) {
          requestAnimationFrame(draw);
        } else {
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          resolve();
        }
      }
      requestAnimationFrame(draw);
    });
  }

  /* ─────────────────────────────────────────────
     Phase 3: Typewriter Reveal (sequential)
     • Force light mode, fade out the dark overlay
     • For each top-level child of #main-content, in order:
         1. Drop it from above with a spring curve
         2. Typewriter its *visible* text (skipping hidden DOM)
         3. When finished, move on to the next
     • No hard cap — reasonable per-element pacing
     ───────────────────────────────────────────── */
  function phaseTypewriterReveal(state) {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('theme', 'light'); } catch (e) {}

      if (state && state.night) {
        state.night.style.transition = 'opacity 0.35s ease-out';
        state.night.style.opacity = '0';
        setTimeout(function () {
          if (state.night.parentNode) state.night.parentNode.removeChild(state.night);
        }, 380);
      }

      var children = Array.from(main.children);
      if (children.length === 0) { resolve(); return; }

      // Lock heights to prevent layout collapse during type-in
      var savedMinHeights = children.map(function (el) {
        var r = el.getBoundingClientRect();
        var prev = el.style.minHeight;
        el.style.minHeight = r.height + 'px';
        return prev;
      });

      // Lift all children above viewport, invisible
      children.forEach(function (el) {
        el.style.transition = 'none';
        el.style.filter = '';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-110vh)';
        el.style.willChange = 'transform, opacity';
      });
      void main.offsetHeight;

      var DROP_TIME = 380;
      var BASE_CHAR_DELAY = 9;
      var MAX_ELEMENT_TIME = 2200; // cap on typewriter time per top-level child

      function dropAndType(idx) {
        if (idx >= children.length) {
          // cleanup styles
          children.forEach(function (el, i) {
            el.style.opacity = '1';
            el.style.transform = '';
            el.style.transition = '';
            el.style.willChange = '';
            el.style.minHeight = savedMinHeights[i];
          });
          resolve();
          return;
        }

        var el = children[idx];
        el.style.transition =
          'transform ' + DROP_TIME + 'ms cubic-bezier(0.34, 1.2, 0.55, 1), ' +
          'opacity 160ms ease-out';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';

        setTimeout(function () {
          // Measure visible text length for pacing
          var visibleLen = measureVisibleTextLength(el);
          var naturalTime = visibleLen * BASE_CHAR_DELAY;
          var chunkSize = naturalTime > MAX_ELEMENT_TIME
            ? Math.ceil(naturalTime / MAX_ELEMENT_TIME)
            : 1;

          typewriterReveal(el, BASE_CHAR_DELAY, chunkSize, function () {
            dropAndType(idx + 1);
          });
        }, DROP_TIME);
      }

      dropAndType(0);
    });
  }

  /* Count length of visible text nodes (skip hidden subtrees).  */
  function measureVisibleTextLength(el) {
    var total = 0;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: makeTextNodeFilter(el)
    });
    var n;
    while ((n = walker.nextNode())) total += n.textContent.length;
    return total;
  }

  function makeTextNodeFilter(rootEl) {
    return function (node) {
      if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      var p = node.parentNode;
      while (p && p !== rootEl) {
        var tag = (p.tagName || '').toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
        // Skip anything explicitly hidden (e.g. collapsed abstracts/citations)
        if (p.hidden === true) return NodeFilter.FILTER_REJECT;
        if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    };
  }

  /* Typewriter: empty all *visible* text nodes then retype them.
     chunkSize = chars per tick (adapts for long content).
     onDone fires when fully typed (or cancelled via complete()). */
  function typewriterReveal(el, charDelay, chunkSize, onDone) {
    var textNodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: makeTextNodeFilter(el)
    });
    var node;
    while ((node = walker.nextNode())) textNodes.push(node);
    if (textNodes.length === 0) { if (onDone) onDone(); return { complete: function () {} }; }

    var originals = textNodes.map(function (n) { return n.textContent; });
    textNodes.forEach(function (n) { n.textContent = ''; });

    var nodeIdx = 0, charIdx = 0;
    var cancelled = false;
    var timerId = null;
    var finished = false;

    function tick() {
      if (cancelled || finished) return;
      if (nodeIdx >= textNodes.length) { finished = true; if (onDone) onDone(); return; }
      var tn = textNodes[nodeIdx];
      var orig = originals[nodeIdx];
      if (charIdx < orig.length) {
        var endCharIdx = Math.min(orig.length, charIdx + chunkSize);
        var chunkStr = orig.substring(charIdx, endCharIdx);
        tn.textContent = orig.substring(0, endCharIdx);
        if (/\S/.test(chunkStr)) playClick();
        charIdx = endCharIdx;
        timerId = setTimeout(tick, charDelay);
      } else {
        nodeIdx++;
        charIdx = 0;
        timerId = setTimeout(tick, 14);
      }
    }
    tick();

    return {
      complete: function () {
        if (finished) return;
        cancelled = true;
        if (timerId) clearTimeout(timerId);
        for (var i = nodeIdx; i < textNodes.length; i++) {
          textNodes[i].textContent = originals[i];
        }
      }
    };
  }
})();
