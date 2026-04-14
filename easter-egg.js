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

  /* ─── Audio (typewriter click + firework whoosh/boom) ──────── */
  var audioCtx = null;
  var clickBuffer = null;
  var whooshBuffer = null;
  var boomBuffer = null;
  var lastClickTime = 0;
  var CLICK_MIN_GAP = 30;

  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var sr = audioCtx.sampleRate;

      // Click buffer: filtered noise + brief ping (typewriter strike)
      var clen = Math.floor(sr * 0.025);
      var cbuf = audioCtx.createBuffer(1, clen, sr);
      var cdata = cbuf.getChannelData(0);
      for (var i = 0; i < clen; i++) {
        var t = i / sr;
        var env = Math.exp(-t * 160);
        var noise = (Math.random() * 2 - 1) * 0.7;
        var ping = Math.sin(2 * Math.PI * 2200 * t) * 0.25;
        cdata[i] = (noise + ping) * env * 0.55;
      }
      clickBuffer = cbuf;

      // Whoosh buffer: white noise with envelope; band-pass filter is
      // applied at playback for a rising-pitch rocket hiss.
      var wlen = Math.floor(sr * 0.45);
      var wbuf = audioCtx.createBuffer(1, wlen, sr);
      var wdata = wbuf.getChannelData(0);
      for (var j = 0; j < wlen; j++) {
        var wt = j / sr;
        var wenv = Math.min(1, wt * 8) * Math.exp(-wt * 3.2);
        wdata[j] = (Math.random() * 2 - 1) * wenv;
      }
      whooshBuffer = wbuf;

      // Boom buffer: PURE NOISE only — no sine oscillators (those sustain
      // into a tonal "gong"). Three decay envelopes layered give the
      // attack/body/tail shape of a real explosion; filters at playback
      // shape the frequency content so it sounds like a boom.
      var blen = Math.floor(sr * 0.9);
      var bbuf = audioCtx.createBuffer(1, blen, sr);
      var bdata = bbuf.getChannelData(0);
      for (var k = 0; k < blen; k++) {
        var bt = k / sr;
        var snap = (Math.random() * 2 - 1) * Math.exp(-bt * 28);   // initial crack
        var body = (Math.random() * 2 - 1) * Math.exp(-bt * 4.5);  // main blast
        var tail = (Math.random() * 2 - 1) * Math.exp(-bt * 1.8);  // rumble tail
        bdata[k] = (snap * 0.85 + body * 0.6 + tail * 0.3) * 0.55;
      }
      boomBuffer = bbuf;
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

  function playWhoosh() {
    if (!audioCtx || !whooshBuffer) return;
    try {
      var now = audioCtx.currentTime;
      var src = audioCtx.createBufferSource();
      src.buffer = whooshBuffer;
      src.playbackRate.value = 0.85 + Math.random() * 0.3;
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.4;
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.38);
      var gain = audioCtx.createGain();
      gain.gain.value = 0.09 + Math.random() * 0.05;
      src.connect(filter).connect(gain).connect(audioCtx.destination);
      src.start(now);
    } catch (e) {}
  }

  function playBoom() {
    if (!audioCtx || !boomBuffer) return;
    try {
      var now = audioCtx.currentTime;
      var src = audioCtx.createBufferSource();
      src.buffer = boomBuffer;
      src.playbackRate.value = 0.78 + Math.random() * 0.35;

      // Low-pass path: deep rumbly body
      var lpf = audioCtx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 240 + Math.random() * 60;
      lpf.Q.value = 0.9;
      var lpGain = audioCtx.createGain();
      lpGain.gain.value = 0.9;

      // Band-pass path: mid-frequency snap/crackle on top of the low body
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = 1200 + Math.random() * 500;
      bpf.Q.value = 0.6;
      var bpGain = audioCtx.createGain();
      bpGain.gain.value = 0.28;

      // Hard high-pass to kill any sub-audible DC rumble
      var hpf = audioCtx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 35;

      var master = audioCtx.createGain();
      master.gain.value = 0.32 + Math.random() * 0.12;

      src.connect(lpf).connect(lpGain).connect(master);
      src.connect(bpf).connect(bpGain).connect(master);
      master.connect(hpf).connect(audioCtx.destination);
      src.start(now);
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
     Phase 1: Shatter to Night
     Each top-level section shatters outward with a staggered
     explosive transform; the page then goes straight to pure
     black (no intermediate tint) and stars emerge.
     ───────────────────────────────────────────── */
  function phaseDissolve(state) {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      var children = Array.from(main.children);

      // Pure black overlay — no mid-color gradient
      var night = document.createElement('div');
      night.style.cssText =
        'position:fixed;inset:0;z-index:99990;pointer-events:none;opacity:0;' +
        'background:#000;' +
        'transition:opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1);';
      document.body.appendChild(night);
      state.night = night;

      // Star canvas (above overlay) — stars emerge on black
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;z-index:99991;pointer-events:none;';
      var setup = setupCanvas(canvas);
      var ctx = setup.ctx;
      var W = setup.width, H = setup.height;
      document.body.appendChild(canvas);

      // Shatter each top-level child: fly apart with rotation + scale
      children.forEach(function (el, idx) {
        var angle = Math.random() * Math.PI * 2;
        var distance = 520 + Math.random() * 340;
        var tx = Math.cos(angle) * distance;
        var ty = Math.sin(angle) * distance * 0.7 - 80; // slight upward bias
        var rot = (Math.random() - 0.5) * 90;
        var scale = 0.35 + Math.random() * 0.35;
        var delay = idx * 55;

        el.style.transition =
          'transform 0.95s cubic-bezier(0.4, 0, 0.2, 1) ' + delay + 'ms, ' +
          'opacity 0.75s cubic-bezier(0.4, 0, 0.6, 1) ' + (delay + 120) + 'ms';
        el.style.transform =
          'translate(' + tx + 'px,' + ty + 'px) ' +
          'rotate(' + rot + 'deg) ' +
          'scale(' + scale + ')';
        el.style.opacity = '0';
      });

      // Black fades in a beat after shatter begins, so the shatter itself
      // stays legible before the screen goes dark.
      setTimeout(function () { night.style.opacity = '1'; }, 220);

      // Stars on the black
      var stars = [];
      var maxStars = 95;
      var startTime = performance.now();
      var totalDuration = 2100;

      function frame(now) {
        var elapsed = now - startTime;

        // Seed stars once the overlay starts darkening
        if (elapsed > 650 && stars.length < maxStars && Math.random() < 0.85) {
          stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            size: 0.3 + Math.random() * 1.1,
            phase: Math.random() * Math.PI * 2,
            speed: 0.015 + Math.random() * 0.025,
            baseAlpha: 0.35 + Math.random() * 0.55,
            appearAt: elapsed
          });
        }

        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for (var s = 0; s < stars.length; s++) {
          var st = stars[s];
          var age = elapsed - st.appearAt;
          var fadeIn = Math.min(1, age / 500);
          var tw = 0.55 + 0.45 * Math.sin(now * st.speed + st.phase);
          var a = st.baseAlpha * tw * fadeIn;
          ctx.fillStyle = 'rgba(230, 240, 255, ' + a + ')';
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        if (elapsed < totalDuration) {
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
        // Oversample the sprite so text stays crisp even when particles
        // scale slightly up at draw time.
        var dpr = Math.max(2, capDPR()) * 1.5;
        var fontSize = 26;
        var pad = 22;

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

        // Soft colored halo (single pass, moderate blur)
        cctx.shadowColor = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
        cctx.shadowBlur = 10;
        cctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.95)';
        cctx.fillText(word, w / 2, h / 2);

        // Crisp readable text on top — slightly brighter tint of the same color,
        // no shadow, so the word stays legible rather than blown out.
        cctx.shadowBlur = 0;
        var lr = Math.min(255, rgb[0] + 35);
        var lg = Math.min(255, rgb[1] + 35);
        var lb = Math.min(255, rgb[2] + 35);
        cctx.fillStyle = 'rgb(' + lr + ',' + lg + ',' + lb + ')';
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

        var count = 12;
        var radius = size / 2 - 8;
        for (var k = 0; k < count; k++) {
          var ang = (Math.PI * 2 * k) / count;
          var x2 = Math.cos(ang) * radius;
          var y2 = Math.sin(ang) * radius;
          var grad = bctx.createLinearGradient(0, 0, x2, y2);
          grad.addColorStop(0, 'rgba(255,245,220,0.55)');
          grad.addColorStop(0.2, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.55)');
          grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
          bctx.strokeStyle = grad;
          bctx.lineWidth = 1.2;
          bctx.beginPath();
          bctx.moveTo(0, 0);
          bctx.lineTo(x2, y2);
          bctx.stroke();
        }

        // Soft central halo (toned down)
        var flash = bctx.createRadialGradient(0, 0, 0, 0, 0, 18);
        flash.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.55)');
        flash.addColorStop(0.5, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.25)');
        flash.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
        bctx.fillStyle = flash;
        bctx.beginPath();
        bctx.arc(0, 0, 18, 0, Math.PI * 2);
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
        // Tighter scale range keeps words legible; sprite oversampling
        // handles slight upscaling cleanly.
        this.scale = 0.7 + Math.random() * 0.35;
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
        playBoom();
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

        // Clear the canvas each frame so particle text stays crisp
        // (the old motion-trail fillRect caused readability-killing blur).
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);

        // Ambient sparkles sprinkled across the sky (restrained)
        if (sparkles.length < MAX_SPARKLES && Math.random() < 0.3) {
          sparkles.push(new Sparkle(Math.random() * W, Math.random() * H * 0.85));
        }

        // Launch rockets
        if (elapsed - lastLaunch > launchInterval && elapsed < duration - 1100) {
          var tx = W * (0.12 + Math.random() * 0.76);
          var ty = H * (0.1 + Math.random() * 0.4);
          rockets.push(new Rocket(tx, ty));
          playWhoosh();
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
          var a = sp.life * tw * 0.65;
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
     Phase 3: Typewriter Reveal (sequential, no drop)
     • Force light mode
     • SECRETLY (while still hidden behind the dark overlay):
         – reset any filter/transform leftovers
         – measure each top-level child's rendered height, lock min-height
         – collect and *empty* all visible text nodes
     • Fade out the dark overlay — user sees empty sections at correct height
     • Typewriter each section's text back in, sequentially
     ───────────────────────────────────────────── */
  function phaseTypewriterReveal(state) {
    return new Promise(function (resolve) {
      var main = document.getElementById('main-content');
      if (!main) { resolve(); return; }

      // Force light mode (theme switch happens under the opaque overlay)
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('theme', 'light'); } catch (e) {}

      var children = Array.from(main.children);
      if (children.length === 0) {
        if (state && state.night && state.night.parentNode) {
          state.night.parentNode.removeChild(state.night);
        }
        resolve();
        return;
      }

      // ── SECRET PRE-COMPUTATION (invisible behind dark overlay) ──
      // Strip any phase-1 transitions/filters/transforms so measurements
      // reflect the real layout, but keep opacity 0 so nothing flashes.
      children.forEach(function (el) {
        el.style.transition = 'none';
        el.style.filter = '';
        el.style.transform = '';
        el.style.opacity = '0';
      });
      void main.offsetHeight;

      // Measure heights, lock them, then empty all visible text nodes.
      var secret = children.map(function (el) {
        var rect = el.getBoundingClientRect();
        var prevMinHeight = el.style.minHeight;
        el.style.minHeight = rect.height + 'px';

        var textNodes = [];
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
          acceptNode: makeTextNodeFilter(el)
        });
        var n;
        while ((n = walker.nextNode())) textNodes.push(n);
        var originals = textNodes.map(function (tn) { return tn.textContent; });
        // Empty NOW so there's no flash of full text when we reveal
        textNodes.forEach(function (tn) { tn.textContent = ''; });

        return {
          el: el,
          prevMinHeight: prevMinHeight,
          textNodes: textNodes,
          originals: originals
        };
      });

      // Keep every section hidden until its typewriter turn — this
      // prevents non-text elements (images/badges/link dividers) from
      // appearing before the typewriter reaches their section.
      // (opacity stays 0; the overlay fades out over a blank layout.)

      // Fade out the dark overlay — user sees blank page with reserved space
      if (state && state.night) {
        state.night.style.transition = 'opacity 0.4s ease-out';
        state.night.style.opacity = '0';
        setTimeout(function () {
          if (state.night.parentNode) state.night.parentNode.removeChild(state.night);
        }, 420);
      }

      var BASE_CHAR_DELAY = 9;
      var MAX_ELEMENT_TIME = 2200; // cap on typewriter time per top-level child

      // Start just after the overlay begins to dissipate
      setTimeout(function () { typeNext(0); }, 260);

      function typeNext(idx) {
        if (idx >= secret.length) {
          secret.forEach(function (s) {
            s.el.style.minHeight = s.prevMinHeight;
            s.el.style.transition = '';
          });
          resolve();
          return;
        }
        var s = secret[idx];

        // Reveal this section now (fades in while typewriter runs)
        s.el.style.transition = 'opacity 0.32s ease-out';
        s.el.style.opacity = '1';

        var len = 0;
        for (var i = 0; i < s.originals.length; i++) len += s.originals[i].length;
        var naturalTime = len * BASE_CHAR_DELAY;
        var chunkSize = naturalTime > MAX_ELEMENT_TIME
          ? Math.ceil(naturalTime / MAX_ELEMENT_TIME)
          : 1;

        // Small delay so the section fade-in is perceptible before typing starts
        setTimeout(function () {
          playbackTypewriter(s.textNodes, s.originals, BASE_CHAR_DELAY, chunkSize, function () {
            typeNext(idx + 1);
          });
        }, 140);
      }
    });
  }

  /* Types pre-emptied text nodes back to their originals, char by char
     (in `chunkSize` chunks per tick). Calls onDone when the last char lands. */
  function playbackTypewriter(textNodes, originals, charDelay, chunkSize, onDone) {
    if (textNodes.length === 0) { if (onDone) onDone(); return; }
    var nodeIdx = 0, charIdx = 0;
    function tick() {
      if (nodeIdx >= textNodes.length) { if (onDone) onDone(); return; }
      var tn = textNodes[nodeIdx];
      var orig = originals[nodeIdx];
      if (charIdx < orig.length) {
        var endCharIdx = Math.min(orig.length, charIdx + chunkSize);
        var chunkStr = orig.substring(charIdx, endCharIdx);
        tn.textContent = orig.substring(0, endCharIdx);
        if (/\S/.test(chunkStr)) playClick();
        charIdx = endCharIdx;
        setTimeout(tick, charDelay);
      } else {
        nodeIdx++;
        charIdx = 0;
        setTimeout(tick, 14);
      }
    }
    tick();
  }

  /* TreeWalker filter: accept only text nodes that are actually visible
     (skip <script>/<style>/<noscript> and anything with hidden/aria-hidden). */
  function makeTextNodeFilter(rootEl) {
    return function (node) {
      if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      var p = node.parentNode;
      while (p && p !== rootEl) {
        var tag = (p.tagName || '').toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
        if (p.hidden === true) return NodeFilter.FILTER_REJECT;
        if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    };
  }
})();
