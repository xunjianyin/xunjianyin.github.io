/**
 * Spira mirabilis. The page's own words wind into a logarithmic spiral and
 * collapse to a point; a spiral of the research unwinds from that point, one
 * turn per year, passing the same five questions a little further out each
 * time. Bernoulli's motto for the curve: Eadem mutata resurgo.
 *
 * One Canvas2D canvas draws everything. The page DOM is never mutated: one
 * class on <html> hides its glyphs while sprites stand in their exact places.
 */
(() => {
  'use strict';
  const ROOT = new URL('.', (document.currentScript && document.currentScript.src) || location.href);
  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------------------------
   * Tunable constants. Times are active seconds from the start of the opening;
   * lengths are CSS px unless marked "world" (research spiral units, in which
   * the end of 2026 lies at radius 1).
   * ------------------------------------------------------------------------- */
  // Choreography
  const T_DUSK = 1.6;                  // the aperture of night covers the viewport
  const T_DEPART = [1.1, 3.9];         // words depart in reading order, evenly spaced over this span
  const FLIGHT_TIME = 1.3;
  const FLIGHT_JITTER = 0.15;
  const T_LAND = 5.2;                  // the last word lands; the text spiral is complete
  const HOLD = 1.3;                    // the hero frame holds this long; the key sentence glints in it
  const T_GLINT = [5.4, 6.3];          // a warm light sweeps the key sentence in reading order
  // Everything below follows the hold (each time is HOLD - 0.7 = 0.6 s later than in v6).
  const T_WIND = T_LAND + HOLD;        // 6.5: the text spiral winds in
  const T_COLLAPSED = 8.3;             // the text spiral is a point; the core inhales
  const T_IGNITE = 8.6;                // ignition
  const T_HEAD = [8.65, 11.9];         // research head: inner start -> end of 2026
  const T_HEAD_RAMP = 0.3;             // head accelerates for this long
  const T_STOP = 12.6;                 // head fades out on the unwritten turn
  const T_PITCH = [9.1, 12.2];
  const T_CENTRE = [9.5, 12.2];
  const T_SCALE_REST = [12.1, 12.6];   // camera scale settles exactly on the chart fit
  const T_MOTTO = [10.1, 11.1];
  const T_UI = [12.0, 12.8];
  const T_GHOST = [12.0, 12.9];
  const T_AXIS = [9.1, 10.1];
  const T_SPOKES = [10.3, 11.5];
  const T_THEME_LABELS = [10.9, 11.9];
  const T_HEAD_FADE = [12.1, 12.6];
  const T_NEAR_STARS = [8.6, 9.2];     // the near-field star layer fades in at ignition
  const T_CONTROLS_IN = [1.2, 1.7];
  const T_CONTROLS_OUT = [12.2, 12.6];
  const T_CHART = 12.6;                // phase 'chart'; the UI becomes interactive
  const T_SETTLED = 13.4;              // every opening fade has finished
  const SKIP_FADE_MS = 350;
  const REPLAY_FADE_MS = 250;

  // Closing: the bookend. The page rises again from the edges while the galaxy collapses.
  const CLOSE_UI = [0, 0.25];          // s from the close request: UI blocks fade out
  const CLOSE_COLLAPSE = [0.1, 1.1];   // galaxy collapses into its origin; the iris closes on it
  const CLOSE_GLINT = [1.0, 1.3];      // the last point of light glints where the iris closes
  const CLOSE_TOTAL = 1.3;
  const CLOSE_DUSK = 0.4;              // during the dusk the iris simply reverses, this fast
  const CLOSE_TURNS = 0.35;            // extra clockwise turns while the galaxy collapses

  // Dusk: an iris of night opening from the viewport centre
  const NIGHT_RGB = [5, 7, 12];
  const APERTURE_START = 28;           // radius at t = 0: visible from the first frame
  const EDGE_FRAC = 0.05;              // soft edge = clamp(0.05 * radius, 18, 48)
  const EDGE_MIN = 18;
  const EDGE_MAX = 48;
  const RIM_COLOUR = 'rgba(220,230,245,0.35)';
  const RIM_HALO = 'rgba(220,230,245,0.06)';
  const RIM_HALO_WIDTH = 6;
  const MASK_CELL = 4;                 // CSS px per aperture-mask texel, upscaled smoothly

  // Text spiral (screen space, face-on)
  const SPIRAL_R = 0.43;               // outer radius R0 as a fraction of min(w, h)
  const SPIRAL_R_NARROW = 0.45;        // ... when w < 700
  const SPIRAL_B = 0.042;              // r = R0 e^(-B phi): each turn is e^(-2 pi B) = 0.77 of the last
  const SPIRAL_START = -0.8 * Math.PI; // about 10:30; angles grow clockwise on screen (y down)
  const WORD_GAP_EM = 0.3;
  const BLOCK_GAP_EM = 1.2;
  const HOLD_SPIN = 0.04;              // rad/s once the spiral is complete
  const DOT_SWITCH_PX = 2.2;           // on-screen font size below which a word is a dot
  const DOT_BLEND_PX = 0.9;            // sprite/dot crossfade band above the switch
  const CONTINUATION_STEP = 7 * Math.PI / 180;
  const MAX_WORDS = 900;

  // Word flights
  const FLIGHT_MIN = 1.0;              // late flights are shortened (not below this) to land by T_LAND
  const FLIGHT_LIFT = 0.05;            // brief scale lift at the start of a flight
  const FLIGHT_LIFT_PEAK = 0.12;
  const RADIAL_SHARE = 0.6;            // a flight's radius settles by this fraction of it
  const WAIT_ALPHA = 0.55;             // words still on the page (in night colour) recede ...
  const FLIGHT_ALPHA = 0.9;            // ... words in flight are clearer, landed words full
  // The key sentence of the bio, found among the captured words by token matching.
  const KEY_SENTENCE = 'I study how AI systems can recursively self-improve over long horizons to solve open-ended problems, with a focus on self-referential agents and world models.';
  const KEY_MIN_TOKENS = 5;            // shorter matches are ignored (other pages)
  const WARM = '#ffe9c7';              // the glint and its lingering tint
  const GLINT_WIDTH = 0.14;            // s; how long the light dwells on a word
  const GLINT_TINT = 0.35;             // share of warm tint a word keeps after the light has passed
  const GLINT_GLOW = 34;               // px radius of the travelling light
  // Wind: fast words leave short streaks of light
  const TRAIL_DT = 0.16;               // s of motion a streak spans (a long exposure)
  const TRAIL_SPEED = 90;              // px/s above which a word or dot streaks
  const TRAIL_MAX_FONT = 5;            // px; legible sprites (larger on screen) never streak
  const TRAIL_ALPHA = [0.18, 0.1, 0.035]; // per segment, head to tail
  const TRAIL_WIDTH = 0.7;
  const TRAVEL = [0.1 * Math.PI, 1.1 * Math.PI]; // clockwise travel window around the centre

  // Wind and collapse
  const WIND_END_RADIUS = 1.5;
  const WIND_TURNS = 1.2;
  const COLLAPSE_RADIUS = 4;
  const CORE_RADIUS = [14, 46];        // core glow radius 14 + 46 f
  const CORE_ALPHA = [0.15, 0.85];     // core glow alpha 0.15 + 0.85 f
  const INHALE_RADIUS = [60, 10];

  // Ignition: a white core flash, a wider cool haze, two rings, sparks (some glitter)
  const FLASH_CORE = { time: 0.35, size: 0.35 };   // size x min(w, h)
  const FLASH_HAZE = { time: 1.0, size: 0.8, alpha: 0.45 };
  const RING = { time: 0.6, size: 0.45, width: 1.2, alpha: 0.35 }; // one fast ring, faded by 0.45 min(w, h)
  const SPARK_COUNT = 260;
  const SPARK_COUNT_NARROW = 120;
  const SPARK_SPEED_MAX = 640;         // px/s at the ignition camera; each spark gets 0.35-1.0 of it
  const SPARK_SPEED_SPREAD = [0.35, 1.0];
  const SPARK_DRAG = 2.2;
  const SPARK_LIFE = [1.1, 1.6];
  const SPARK_TRAIL = 0.12;            // s; a trail spans the last 0.12 s, so it shortens as the spark slows
  const SPARK_GLITTER = 0.15;          // share of sparks that twinkle near the end of life

  // Research spiral (world units): r(theta) = g^((theta - theta0) / 2 pi - 5)
  const GROWTH = 1.68;
  const THETA0 = -Math.PI / 2;
  const FIRST_YEAR = 2022;
  const LAST_YEAR = 2026;
  const INNER_TURNS = 0.6;             // faint tail before 2022
  const HEAD_TURN_EXP = 0.6;           // each turn lasts in proportion to r^0.6
  const FUTURE_EASE = 1.15;            // power of the head's ease-out onto the unwritten turn (it fades out as it stops)
  const SECTOR_PAD = 0.06;
  const SAMPLES_PER_TURN = 120;
  const CURVE_CHUNK = 24;
  const SPOKE_RADII = [0.10, 1.16];
  const THEME_LABEL_R = 1.25;
  const AXIS_RADII = [0.10, 1.08];
  const BULGE = { radius: 0.08, alpha: 0.18, maxPx: 90 }; // a warm core; on-screen radius capped while the camera is close
  const PAPER_FLASH = { radius: 40, time: 0.35, alpha: 0.75 };
  const PAPER_RING = { radius: 24, time: 0.4, alpha: 0.4 };
  const PAPER_GLOW = 14;
  const PAPER_SPARKS = 16;
  const PAPER_SPARKS_NARROW = 10;
  const PAPER_SPARK_SPEED = [50, 160];
  const PAPER_SPARK_LIFE = [0.4, 0.6];
  const PAPER_SPARK_DRAG = 3;
  const PAPER_SPARK_TRAIL = 0.08;
  const COMET_TRAIL = 0.7;             // rad of curve behind the head
  const GHOST_WORDS = ['self-referential agents', 'world models', 'long horizons', 'open-ended problems'];
  const GHOST_AT = [0.12, 0.36, 0.6, 0.84];   // preferred fractions of the unwritten turn
  const GHOST_SLIDE = 0.03;            // ... from which a blocked phrase slides in these steps
  const GHOST_SLIDE_STEPS = 21;
  const GHOST_MAX_TILT = 50 * Math.PI / 180; // ghost words sit well clear of vertical (60-120 deg)
  const GHOST_ORDER = [3, 0, 1, 2];    // placement priority: 'open-ended problems' (from the bio) first
  const LABEL_TAU = 0.15;              // s; canvas labels fade with this time constant
  const LABEL_SLIDE_TAU = 0.35;        // s; ... and slide to a new free spot with this one
  const THEME_SLIDE = [0, 0.07, -0.07, 0.14, -0.14, 0.21]; // world offsets tried along a spoke
  const GHOST_ALPHA = 0.55;
  const FUTURE_ALPHA = 0.35;
  const PATH_FADE = 0.4;               // s; a selected paper's path along the spiral fades in and out
  const PATH_ALPHA = [0.06, 0.5];      // alpha from the inner start to just before the paper
  const PATH_WIDTH = 1.1;
  const PATH_CHUNK = 8;                // samples per stroke of the alpha gradient
  // The page at the centre: the text spiral lies in the disk at the origin
  const CORE_WORLD_R = 0.06;           // world outer radius of the text spiral in the chart
  const CORE_VIEW_R = 0.42;            // ... in core view: x min(w, h) on screen
  const CORE_FLIGHT = 1.4;             // s; camera flight into the core and back
  const CORE_SPIN = 0.03;              // rad/s while in core view
  const CORE_HIT = 22;                 // px around the origin that opens the core
  const CORE_REST_ALPHA = 0.3;         // texture alpha of the text spiral at rest (a soft nucleus under the bulge)

  // Camera: yaw psi about the disk normal, pitch alpha, perspective distance D
  const CAM_D = 3.4;
  const CAM_PITCH = 0.78;
  const CAM_PITCH_NARROW = 0.5;        // portrait phones: more face-on, to use the free height
  const HEAD_RADIUS = 0.34;            // pull-back keeps the head near this x min(w, h)
  const HEAD_START_RADIUS = 0.12;      // the inner start appears this far from the ignition point
  const SCALE_KNEE = 0.18;             // log-space softness of the scale clamp
  const YAW_REST = -0.3;               // yaw at rest when the chart begins
  const YAW_SPIN = 1.4;                // rad/s just after ignition, continuing the wind's spin
  const YAW_TAU = 0.45;                // ... decaying to the idle drift within about 2.4 s
  const CHART_SCALE = 0.40;            // radius 1 = 0.40 min(free width, free height / 0.72)
  const CHART_SCALE_NARROW = 0.45;     // ... on portrait phones, where the width binds
  const FIT_RADIUS = 1.2;              // world radius the chart must keep clear of UI blocks
  const EDGE_FIT_RADIUS = 1.04;        // world radius that must stay inside the viewport
  const FIT_MARGIN = [20, 10];         // px kept clear around UI blocks (x, y)
  const UI_CLEARANCE = 24;             // canvas labels keep this far from UI blocks
  const EDGE_INSET = 8;                // canvas labels stay this far inside the viewport

  // Starfield and stardust
  const STAR_COUNT = 650;
  const STAR_COUNT_NARROW = 320;
  const NEAR_COUNT = 120;              // near-field layer between the camera and the disk
  const NEAR_COUNT_NARROW = 60;
  const NEAR_SIZE = [1.2, 2.4];
  const STAR_NEAR_FADE = [0.15, 0.75]; // stars fade out before their depth reaches 0.15
  const DUST_COUNT = 2600;
  const DUST_COUNT_NARROW = 1100;
  const DUST_KNOTS = 0.06;

  // Chart interaction
  const DRIFT = 0.012;                 // rad/s
  const IDLE_DELAY_MS = 4000;
  const DRAG_YAW = 0.006;
  const DRAG_PITCH = 0.004;
  const PITCH_RANGE = [0.15, 1.15];
  const INERTIA_TAU = 0.18;
  const ZOOM_RANGE = [0.6, 2.2];
  const ZOOM_TAU = 0.12;
  const HOVER_RADIUS = 18;
  const TAP_RADIUS = 26;

  // Rendering budget
  const MAX_BACKING_PIXELS = 8.3e6;    // full DPR 2 up to 1728 x 1117; reduced beyond
  const ATLAS_SIZE = 2048;
  const ATLAS_PAD = 2;

  // Type and colour
  const SANS = 'Lato, "Helvetica Neue", Arial, sans-serif';
  const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  const CURVE_COLOUR = '#cfd9e6';
  const LABEL_COLOUR = '#c9d3df';
  const MUTED_COLOUR = '#9aa6b5';
  const DOT_COLOUR = '#8a95a4';

  /* ---------------------------------------------------------------------------
   * Data
   * ------------------------------------------------------------------------- */
  // Sector order is itself a loop: measure, know, ground, reason, improve, measure again.
  const THEMES = [
    { id: 'evaluation', label: 'Evaluation', colour: '#a9d8c8', question: 'How do we know what works, and what fails?' },
    { id: 'knowledge', label: 'Knowledge', colour: '#e9c98b', question: 'What can a model know, and revise?' },
    { id: 'grounding', label: 'Grounding', colour: '#c2b3ee', question: 'How does reasoning stay connected to evidence?' },
    { id: 'reasoning', label: 'Reasoning', colour: '#9dc4f5', question: 'How can reasoning go beyond familiar cases?' },
    { id: 'improvement', label: 'Self-improvement', colour: '#f1a98e', question: 'Can experience change the learner?' }
  ];
  // Year = venue year on the paper page. Within a (year, theme) cell this order is kept.
  const PAPERS = [
    [2022, 'evaluation', 'seq2seq-data2text', 'Evaluating Data-to-Text', 'How Do Seq2Seq Models Perform on End-to-End Data-to-Text Generation?', 'ACL 2022'],
    [2023, 'evaluation', 'context-aware-evaluation', 'Cont-COMET', 'Exploring Context-Aware Evaluation Metrics for Machine Translation', 'EMNLP 2023 Findings'],
    [2023, 'knowledge', 'alcuna', 'ALCUNA', 'ALCUNA: Large Language Models Meet New Knowledge', 'EMNLP 2023'],
    [2024, 'evaluation', 'themis', 'Themis', 'Themis: A Reference-free NLG Evaluation Language Model with Flexibility and Interpretability', 'EMNLP 2024'],
    [2024, 'evaluation', 'contrasolver', 'ContraSolver', 'ContraSolver: Self-Alignment of Language Models by Resolving Internal Preference Contradictions', 'arXiv preprint 2024'],
    [2024, 'knowledge', 'history-matters', 'History Matters', 'History Matters: Temporal Knowledge Editing in Large Language Model', 'AAAI 2024'],
    [2024, 'knowledge', 'knowledge-boundary', 'Knowledge Boundary', 'Benchmarking Knowledge Boundary for Large Language Models: A Different Perspective on Model Evaluation', 'ACL 2024 · Main Conference'],
    [2024, 'grounding', 'contextual-asr', 'Contextual ASR', 'Contextual Modeling for Document-level ASR Error Correction', 'LREC-COLING 2024'],
    [2024, 'grounding', 'error-robust-retrieval', 'RERIC', 'Error-Robust Retrieval for Chinese Spelling Check', 'LREC-COLING 2024'],
    [2024, 'reasoning', 'coral', 'COrAL', 'COrAL: Order-Agnostic Language Modeling for Efficient Iterative Refinement', 'arXiv preprint 2024'],
    [2025, 'evaluation', 'dsgram', 'DSGram', 'DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models', 'AAAI 2025'],
    [2025, 'evaluation', 'nlg-evaluation-survey', 'LLMs as Evaluators', 'LLM-based NLG Evaluation: Current Status and Challenges', 'Computational Linguistics 2025'],
    [2025, 'evaluation', 'damon', 'DAMON', 'DAMON: A Dialogue-Aware MCTS Framework for Jailbreaking Large Language Models', 'EMNLP 2025'],
    [2025, 'knowledge', 'mc-mke', 'MC-MKE', 'MC-MKE: A Fine-Grained Multimodal Knowledge Editing Benchmark Emphasizing Modality Consistency', 'ACL 2025 Findings'],
    [2025, 'grounding', 'self-generated-documents', 'Self-Generated Documents', 'Evaluating Self-Generated Documents for Enhancing Retrieval-Augmented Generation with Large Language Models', 'NAACL 2025 Findings'],
    [2025, 'grounding', 'knowledge-interplay', 'EchoQA', 'Understanding the Interplay between Parametric and Contextual Knowledge for Large Language Models', 'KnowLM Workshop @ ACL 2025'],
    [2025, 'reasoning', 'atomic-to-composite', 'Atomic to Composite', 'From Atomic to Composite: Reinforcement Learning Enables Generalization in Complementary Reasoning', 'arXiv preprint 2025'],
    [2025, 'improvement', 'chemagent', 'ChemAgent', 'ChemAgent: Self-updating Library in Large Language Models Improves Chemical Reasoning', 'ICLR 2025'],
    [2025, 'improvement', 'godel-agent', 'Gödel Agent', 'Gödel Agent: A Self-Referential Agent Framework for Recursively Self-Improvement', 'ACL 2025 · Main Conference'],
    [2025, 'improvement', 'derl', 'DERL', 'Differentiable Evolutionary Reinforcement Learning', 'arXiv preprint 2025'],
    [2026, 'grounding', 'eama', 'EAMA', 'EAMA: Entity-Aware Multimodal Alignment Based Approach for News Image Captioning', 'TOMM 2026'],
    [2026, 'reasoning', 'geometry-of-reasoning', 'The Geometry of Reasoning', 'The Geometry of Reasoning: Flowing Logics in Representation Space', 'ICLR 2026'],
    [2026, 'reasoning', 'reverse-lm', 'LEDOM', 'LEDOM: Reverse Language Model', 'ACL 2026']
  ].map(([year, theme, slug, name, title, venue]) => ({
    year, slug, name, title, venue, theme: THEMES.findIndex(t => t.id === theme)
  }));

  const COPY = {
    stage: 'The research spiral. Drag or use arrow keys to turn it; plus and minus to zoom.',
    text: 'A logarithmic spiral keeps its shape as it grows: each turn is the last one, enlarged. Here each turn is a year of my research, passing through the same five questions, a little further out every time. The next turns are not drawn yet.',
    hintPointer: 'Drag to turn · Scroll to move closer · Select a star or the centre',
    hintTouch: 'Drag to turn · Tap a star or the centre',
    note: 'Jacob Bernoulli asked for this curve and motto on his tombstone. The mason carved the wrong spiral.',
    centre: 'The centre of the spiral: the page you came from',
    coreKicker: 'At the centre',
    coreTitle: 'The page you came from.',
    coreText: 'Every turn of the spiral starts here.',
    backOut: 'Back out'
  };

  /* ---------------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const span = (t, range) => clamp01((t - range[0]) / (range[1] - range[0]));
  const smooth = u => { u = clamp01(u); return u * u * (3 - 2 * u); };
  const easeInOutCubic = u => { u = clamp01(u); return u < 0.5 ? 4 * u * u * u : 1 - (2 - 2 * u) * (2 - 2 * u) * (2 - 2 * u) / 2; };
  const easeInCubic = u => { u = clamp01(u); return u * u * u; };
  const easeOutCubic = u => { u = clamp01(u); return 1 - (1 - u) * (1 - u) * (1 - u); };
  const easeOutQuad = u => { u = clamp01(u); return 1 - (1 - u) * (1 - u); };
  const easeInOutSine = u => -(Math.cos(Math.PI * clamp01(u)) - 1) / 2;
  const invEaseInOutCubic = y => (y < 0.5 ? Math.cbrt(clamp01(y) / 4) : 1 - Math.cbrt(2 * (1 - clamp01(y))) / 2);
  const escapeHTML = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const hexRGB = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const paperURL = slug => new URL(`papers/${slug}.html`, ROOT).href;
  function seeded(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussian(random) {
    const u = Math.max(1e-9, random());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * random());
  }
  // A word's reading direction on the text spiral: the tangent of increasing phi, rotated
  // pi/2 + atan(B) from its radius, so glyph tops face outward.
  const SLOT_TILT = Math.PI / 2 + Math.atan(SPIRAL_B);
  const edgeOf = radius => clamp(EDGE_FRAC * radius, EDGE_MIN, EDGE_MAX);
  // Night amount at distance d: 1 inside the aperture, 0 outside, smoothstep across the edge band.
  function nightAt(d, radius, edge) {
    const u = (d - radius + edge / 2) / edge;
    return u <= 0 ? 1 : u >= 1 ? 0 : 1 - u * u * (3 - 2 * u);
  }

  /* ---------------------------------------------------------------------------
   * Sprites shared by every opening (built once)
   * ------------------------------------------------------------------------- */
  let shared = null;
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function glowSprite(rgb) {
    const size = 128; const c = makeCanvas(size, size); const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    const stops = [[0, 1], [0.08, 0.72], [0.2, 0.32], [0.42, 0.1], [0.7, 0.025], [1, 0]];
    for (const [at, a] of stops) grad.addColorStop(at, `rgba(${rgb.join(',')},${a})`);
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    return c;
  }
  function dotSprite(rgb) {
    const c = makeCanvas(16, 16); const g = c.getContext('2d');
    const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, `rgba(${rgb.join(',')},1)`); grad.addColorStop(0.55, `rgba(${rgb.join(',')},0.9)`);
    grad.addColorStop(1, `rgba(${rgb.join(',')},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, 16, 16);
    return c;
  }
  function glintSprite() {
    const size = 64; const c = makeCanvas(size, size); const g = c.getContext('2d');
    for (const horizontal of [true, false]) {
      const grad = horizontal ? g.createLinearGradient(0, 0, size, 0) : g.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      if (horizontal) g.fillRect(0, size / 2 - 0.75, size, 1.5); else g.fillRect(size / 2 - 0.75, 0, 1.5, size);
    }
    return c;
  }
  // A faint grain tile (at most 2/255 white) dithers the CSS lift so its 8-bit steps do not band.
  let grainURL = '';
  function grainTile() {
    if (grainURL) return grainURL;
    try {
      const c = makeCanvas(128, 128); const g = c.getContext('2d'); const image = g.createImageData(128, 128);
      const random = seeded(4099);
      for (let p = 0; p < image.data.length; p += 4) {
        image.data[p] = 255; image.data[p + 1] = 255; image.data[p + 2] = 255; image.data[p + 3] = Math.floor(random() * 3);
      }
      g.putImageData(image, 0, 0);
      grainURL = `url("${c.toDataURL('image/png')}")`;
    } catch (error) { grainURL = 'none'; }
    return grainURL;
  }
  function sharedSprites() {
    if (shared) return shared;
    shared = {
      white: glowSprite([255, 255, 255]),
      warm: glowSprite([255, 244, 226]),
      haze: glowSprite([150, 186, 236]),
      bulge: glowSprite([243, 233, 216]),
      themes: THEMES.map(t => glowSprite(hexRGB(t.colour))),
      themeDots: THEMES.map(t => dotSprite(hexRGB(t.colour))),
      cool: dotSprite([223, 231, 242]),
      warmDot: dotSprite([242, 227, 198]),
      glint: glintSprite()
    };
    return shared;
  }

  /* ---------------------------------------------------------------------------
   * Capture: visible words of the page, in reading order, with exact typography
   * ------------------------------------------------------------------------- */
  const EXCLUDE = 'script, style, nav, #site-nav, [hidden], [aria-hidden="true"], dialog, .skip-link';
  function captureRoots() {
    const main = document.getElementById('main-content') || document.querySelector('main');
    const footer = document.getElementById('site-footer');
    const roots = [main, footer].filter(Boolean);
    return roots.length ? roots : [document.body];
  }
  function parseColour(text) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?/.exec(text || '');
    if (!m) return null;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
    return [+m[1], +m[2], +m[3], a];
  }
  // Night colours invert luminance: greys become pale cool greys, keeping their
  // relative emphasis; saturated colours become a light tint of their own hue.
  function nightColour([r, g, b, a], emphasis, darkSite) {
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    const alpha = clamp(a, 0, 1).toFixed(3);
    if ((max - min) / 255 < 0.16) {
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const strength = darkSite ? luma : 1 - luma;
      const level = emphasis ? 1 : clamp(0.7 + 0.5 * strength, 0.74, 1);
      const base = emphasis ? [244, 247, 250] : [230, 235, 241];
      return `rgba(${base.map(v => Math.round(v * level)).join(',')},${alpha})`;
    }
    let hue;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    hue = Math.round((hue * 60 + 360) % 360);
    return `hsla(${hue},88%,${emphasis ? 86 : 81}%,${alpha})`;
  }
  function captureWords() {
    const words = [];
    const vw = innerWidth; const vh = innerHeight;
    const darkSite = document.documentElement.dataset.theme === 'dark';
    const styles = new Map(); const blocks = new Map();
    const range = document.createRange();
    const styleOf = el => {
      if (styles.has(el)) return styles.get(el);
      const cs = getComputedStyle(el);
      const rgba = parseColour(cs.color);
      let info = null;
      if (cs.visibility === 'visible' && Number(cs.opacity) > 0 && rgba && rgba[3] > 0.02) {
        const size = parseFloat(cs.fontSize) || 16;
        const emphasis = !!el.closest('h1, h2, h3, h4, .name');
        const caps = cs.fontVariantCaps === 'small-caps' ? 'small-caps ' : '';
        info = {
          font: `${cs.fontStyle} ${caps}${cs.fontWeight} ${size}px ${cs.fontFamily}`, size,
          spacing: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0,
          transform: cs.textTransform, day: cs.color, night: nightColour(rgba, emphasis, darkSite)
        };
      }
      styles.set(el, info);
      return info;
    };
    const blockOf = el => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        if (blocks.has(node)) return blocks.get(node);
        const display = getComputedStyle(node).display;
        if (!display.startsWith('inline') && display !== 'contents') { blocks.set(node, blocks.size + 1); return blocks.size; }
      }
      return 0;
    };
    const transform = (text, mode, atStart) => {
      if (mode === 'uppercase') return text.toUpperCase();
      if (mode === 'lowercase') return text.toLowerCase();
      if (mode === 'capitalize' && atStart) return text.charAt(0).toUpperCase() + text.slice(1);
      return text;
    };
    for (const root of captureRoots()) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode()) && words.length < MAX_WORDS) {
        const parent = node.parentElement;
        if (!parent || !/\S/.test(node.data) || parent.closest(EXCLUDE)) continue;
        const box = parent.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh || box.right < 0 || box.left > vw) continue;
        const style = styleOf(parent);
        if (!style) continue;
        const block = blockOf(parent);
        const capture = (start, end, atStart) => {
          if (words.length >= MAX_WORDS) return;
          range.setStart(node, start); range.setEnd(node, end);
          const r = range.getBoundingClientRect();
          if (!r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
          words.push({ text: transform(node.data.slice(start, end), style.transform, atStart),
            left: r.left, top: r.top, width: r.width, height: r.height, style, block, cont: !atStart, key: -1 });
        };
        for (const match of node.data.matchAll(/\S+/gu)) {
          const from = match.index; const to = from + match[0].length;
          range.setStart(node, from); range.setEnd(node, to);
          const rects = range.getClientRects();
          let single = true;
          for (let i = 1; i < rects.length; i++) if (Math.abs(rects[i].top - rects[0].top) >= 1) single = false;
          if (single) { capture(from, to, true); continue; }
          // A word wrapped across lines (hyphenation) is captured once per visible line.
          let start = from; let offset = from; let top = null;
          for (const character of match[0]) {
            range.setStart(node, offset); range.setEnd(node, offset + character.length);
            const r = range.getBoundingClientRect();
            if (top !== null && Math.abs(r.top - top) > 1) { capture(start, offset, start === from); start = offset; }
            top = r.top; offset += character.length;
          }
          capture(start, offset, start === from);
        }
      }
    }
    range.detach();
    return words;
  }

  // Draw a word with its letter-spacing; fall back to measured per-glyph advances.
  function fillSpaced(g, text, x, y, spacing, native) {
    if (native) { g.letterSpacing = `${spacing}px`; g.fillText(text, x, y); return; }
    if (!spacing) { g.fillText(text, x, y); return; }
    for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + spacing; }
  }

  /**
   * Find the bio's key sentence among the captured words: the longest run of tokens
   * (case-insensitive, punctuation-trimmed; pieces of a word wrapped across lines are
   * joined) that also occurs, contiguously, in KEY_SENTENCE. Marks each word of the run
   * with its order in the run and returns the run's length in tokens (0 when absent).
   */
  const normaliseToken = text => text.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const KEY_TOKENS = KEY_SENTENCE.split(/\s+/).map(normaliseToken);
  function markKeySentence(words) {
    const tokens = []; const firstWord = []; const lastWord = [];
    for (let i = 0; i < words.length; i++) {
      if (words[i].cont && tokens.length) { tokens[tokens.length - 1] += words[i].text; lastWord[lastWord.length - 1] = i; continue; }
      tokens.push(words[i].text); firstWord.push(i); lastWord.push(i);
    }
    for (let i = 0; i < tokens.length; i++) tokens[i] = normaliseToken(tokens[i]);
    // Longest common contiguous run: run[j] is the length of the match ending at token i, key j.
    let best = 0; let bestEnd = -1; let previous = new Uint16Array(KEY_TOKENS.length + 1);
    for (let i = 0; i < tokens.length; i++) {
      const current = new Uint16Array(KEY_TOKENS.length + 1);
      for (let j = 0; j < KEY_TOKENS.length; j++) {
        if (tokens[i] && tokens[i] === KEY_TOKENS[j]) {
          current[j + 1] = previous[j] + 1;
          if (current[j + 1] > best) { best = current[j + 1]; bestEnd = i; }
        }
      }
      previous = current;
    }
    if (best < KEY_MIN_TOKENS) return 0;
    let order = 0;
    for (let k = bestEnd - best + 1; k <= bestEnd; k++) {
      for (let i = firstWord[k]; i <= lastWord[k]; i++) words[i].key = order++;
    }
    return best;
  }

  /**
   * Shelf-pack a day and a night sprite per word (and a warm one for the key sentence)
   * into 2048 px atlases, drawn in
   * device pixels so that at t = 0 each sprite is blitted 1:1 onto its glyphs.
   */
  function buildWordSprites(words, dpr) {
    const measure = makeCanvas(1, 1).getContext('2d');
    const native = 'letterSpacing' in measure;
    const heights = [0];
    let page = 0; let x = 0; let y = 0; let shelf = 0;
    const place = (w, h) => {
      if (x + w > ATLAS_SIZE) { x = 0; y += shelf + ATLAS_PAD; shelf = 0; }
      if (y + h > ATLAS_SIZE) { page++; heights.push(0); x = 0; y = 0; shelf = 0; }
      const spot = [page, x, y];
      x += w + ATLAS_PAD; shelf = Math.max(shelf, h); heights[page] = Math.max(heights[page], y + h);
      return spot;
    };
    const kept = [];
    for (const word of words) {
      const size = word.style.size;
      measure.font = word.style.font;
      if (native) measure.letterSpacing = `${word.style.spacing}px`;
      const metrics = measure.measureText(word.text);
      word.ascent = metrics.fontBoundingBoxAscent || size * 0.8;
      const padX = Math.ceil((2 + 0.3 * size) * dpr); const padY = Math.ceil((2 + 0.25 * size) * dpr);
      word.ox = Math.floor(word.left * dpr) - padX;
      word.oy = Math.floor(word.top * dpr) - padY;
      word.sw = Math.ceil((word.left + word.width) * dpr) + padX - word.ox;
      word.sh = Math.ceil((word.top + word.height) * dpr) + padY - word.oy;
      if (word.sw > ATLAS_SIZE || word.sh > ATLAS_SIZE) continue;
      word.daySpot = place(word.sw, word.sh);
      word.nightSpot = place(word.sw, word.sh);
      word.warmSpot = word.key >= 0 ? place(word.sw, word.sh) : null;
      kept.push(word);
    }
    const atlases = heights.map(h => makeCanvas(ATLAS_SIZE, Math.max(1, h)));
    const contexts = atlases.map(c => c.getContext('2d'));
    for (const word of kept) {
      const spots = [[word.daySpot, word.style.day], [word.nightSpot, word.style.night]];
      if (word.warmSpot) spots.push([word.warmSpot, WARM]);
      for (const [spot, colour] of spots) {
        const g = contexts[spot[0]];
        g.save();
        g.beginPath(); g.rect(spot[1], spot[2], word.sw, word.sh); g.clip();
        // Page CSS px -> atlas device px: the word's device origin lands on the slot corner.
        g.setTransform(dpr, 0, 0, dpr, spot[1] - word.ox, spot[2] - word.oy);
        g.font = word.style.font; g.fillStyle = colour; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        // The page paints each text baseline on a whole CSS pixel (measured: round(top + ascent),
        // also at DPR 2), while x stays sub-pixel; the sprite does the same.
        fillSpaced(g, word.text, word.left, Math.round(word.top + word.ascent), word.style.spacing, native);
        g.restore();
      }
    }
    return { atlases, words: kept };
  }

  /* ---------------------------------------------------------------------------
   * Research spiral geometry (layout independent)
   * ------------------------------------------------------------------------- */
  const TURNS = LAST_YEAR - FIRST_YEAR + 1;
  const THETA_IN = THETA0 - TAU * INNER_TURNS;
  const THETA_END = THETA0 + TAU * TURNS;
  const radiusAt = theta => Math.pow(GROWTH, (theta - THETA0) / TAU - TURNS);
  const HEAD_SWEEP = THETA_END - THETA_IN;
  /*
   * Head angle. Each turn lasts in proportion to r^0.6, so the angular speed is
   * k r(theta)^-0.6 and the elapsed sweep time tau' grows like e^(a (theta - theta_in)) - 1
   * with a = 0.6 ln g / 2 pi. Inverting: theta = theta_in + ln(1 + tau' / K) / a, where K
   * makes 2022-2026 last the sweep time. A quadratic ramp (tau' = tau^2 / 2R for tau < R)
   * starts the head from rest; after 2026 a power ease-out (velocity continuous) brings
   * it to rest on the unwritten turn by T_STOP.
   */
  const HEAD_A = HEAD_TURN_EXP * Math.log(GROWTH) / TAU;
  const SWEEP_TIME = T_HEAD[1] - T_HEAD[0] - T_HEAD_RAMP / 2;
  const HEAD_K = SWEEP_TIME / (Math.exp(HEAD_A * HEAD_SWEEP) - 1);
  const FUTURE_TIME = T_STOP - T_HEAD[1];
  const END_SPEED = 1 / (HEAD_A * (HEAD_K + SWEEP_TIME));
  const THETA_STOP = THETA_END + END_SPEED * FUTURE_TIME / FUTURE_EASE;
  function headTheta(t) {
    const tau = t - T_HEAD[0];
    if (tau <= 0) return THETA_IN;
    if (t < T_HEAD[1]) {
      const warped = tau < T_HEAD_RAMP ? tau * tau / (2 * T_HEAD_RAMP) : tau - T_HEAD_RAMP / 2;
      return THETA_IN + Math.log(1 + warped / HEAD_K) / HEAD_A;
    }
    if (t < T_STOP) {
      const s = 1 - (t - T_HEAD[1]) / FUTURE_TIME;
      return THETA_END + END_SPEED * FUTURE_TIME * (1 - Math.pow(s, FUTURE_EASE)) / FUTURE_EASE;
    }
    return THETA_STOP;
  }
  function timeAtTheta(theta) {
    if (theta <= THETA_IN) return T_HEAD[0];
    if (theta >= THETA_STOP) return T_STOP;
    let a = T_HEAD[0]; let b = T_STOP;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (headTheta(m) < theta) a = m; else b = m; }
    return (a + b) / 2;
  }
  const D_THETA = TAU / SAMPLES_PER_TURN;
  const SAMPLE_COUNT = Math.ceil((THETA_STOP - THETA_IN) / D_THETA) + 2;
  const SAMPLE_X = new Float64Array(SAMPLE_COUNT);
  const SAMPLE_Y = new Float64Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const theta = THETA_IN + i * D_THETA; const r = radiusAt(theta);
    SAMPLE_X[i] = r * Math.cos(theta); SAMPLE_Y[i] = r * Math.sin(theta);
  }
  const INDEX_2022 = Math.round((THETA0 - THETA_IN) / D_THETA);
  const INDEX_END = Math.round((THETA_END - THETA_IN) / D_THETA);
  const SECTOR = TAU / THEMES.length;
  const sectorCentre = j => THETA0 + (j + 0.5) * SECTOR;
  // Paper angle: k of m papers in a (year, theme) cell sit at (k + 0.5) / m across the padded sector.
  (() => {
    const cells = new Map();
    PAPERS.forEach(p => { const key = `${p.year}:${p.theme}`; cells.set(key, (cells.get(key) || 0) + 1); });
    const seen = new Map();
    PAPERS.forEach(p => {
      const key = `${p.year}:${p.theme}`; const k = seen.get(key) || 0; seen.set(key, k + 1);
      const start = THETA0 + TAU * (p.year - FIRST_YEAR) + p.theme * SECTOR + SECTOR_PAD;
      p.theta = start + (k + 0.5) / cells.get(key) * (SECTOR - 2 * SECTOR_PAD);
      p.r = radiusAt(p.theta); p.x = p.r * Math.cos(p.theta); p.y = p.r * Math.sin(p.theta);
      p.at = timeAtTheta(p.theta);
    });
  })();
  // Theme labels sit at THEME_LABEL_R unless the unwritten turn passes there first.
  const THEME_LABEL_RADII = THEMES.map((_, j) => {
    const future = THETA_END + (j + 0.5) * SECTOR;
    return future <= THETA_STOP ? Math.max(THEME_LABEL_R, radiusAt(future) + 0.09) : THEME_LABEL_R;
  });
  // Rest footprint of the chart in units of S: a world circle of FIT_RADIUS seen at the
  // rest pitch. At rest the camera distance is exactly CAM_D, whatever S is.
  const FOOT_N = 72;
  const FOOT_X = new Float64Array(FOOT_N);
  const FOOT_Y = new Float64Array(FOOT_N);
  function footprint(pitch) {
    for (let k = 0; k < FOOT_N; k++) {
      const a = k / FOOT_N * TAU; const y1 = FIT_RADIUS * Math.sin(a);
      const f = CAM_D / (CAM_D - y1 * Math.sin(pitch));
      FOOT_X[k] = FIT_RADIUS * Math.cos(a) * f; FOOT_Y[k] = y1 * Math.cos(pitch) * f;
    }
  }
  const YEAR_MARKS = Array.from({ length: TURNS + 1 }, (_, i) => {
    const theta = THETA0 + TAU * i;
    return { label: i === TURNS ? 'next' : String(FIRST_YEAR + i), theta, r: radiusAt(theta), at: timeAtTheta(theta) };
  });

  /* ---------------------------------------------------------------------------
   * The egg
   * ------------------------------------------------------------------------- */
  let active = false;

  function open(options) {
    if (active) return;
    active = true;
    try { start(options || {}); } catch (error) { active = false; console.warn('The spiral could not open.', error); }
  }

  function start(options) {
    const timeScale = Number.isFinite(options.timeScale) && options.timeScale >= 0 ? options.timeScale : 1;
    const html = document.documentElement;
    const body = document.body;
    const previousFocus = document.activeElement;
    const scroll = { x: scrollX, y: scrollY };
    const overflow = body.style.getPropertyValue('overflow');
    const overflowPriority = body.style.getPropertyPriority('overflow');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
    const events = new AbortController();
    const on = (target, type, fn, extra) => target.addEventListener(type, fn, Object.assign({ signal: events.signal }, extra));
    const sprites = sharedSprites();

    /* ---- DOM ------------------------------------------------------------- */
    const dialog = document.createElement('dialog');
    dialog.id = 'spira';
    dialog.setAttribute('aria-labelledby', 'spira-title');
    dialog.setAttribute('aria-describedby', 'spira-text');
    // Focus moves programmatically on open, skip and chart entry; its ring stays quiet
    // until the keyboard is used to navigate (Tab or arrows).
    dialog.setAttribute('data-quiet', '');
    dialog.style.setProperty('--spira-grain', grainTile());
    const years = [];
    for (let y = LAST_YEAR; y >= FIRST_YEAR; y--) years.push(y);
    dialog.innerHTML = `
      <canvas class="spira-canvas" aria-hidden="true"></canvas>
      <div class="spira-stage" tabindex="0" role="group" aria-label="${escapeHTML(COPY.stage)}"></div>
      <button type="button" class="spira-centre" aria-label="${escapeHTML(COPY.centre)}"></button>
      <header class="spira-head">
        <p class="spira-kicker">Spira mirabilis</p>
        <h2 id="spira-title">Eadem mutata resurgo.</h2>
        <p class="spira-translation">Although changed, I rise again the same.</p>
      </header>
      <section class="spira-plate" aria-label="Reading">
        <div class="spira-plate-default">
          <p id="spira-text">${escapeHTML(COPY.text)}</p>
          <p class="spira-hint">${escapeHTML(coarse ? COPY.hintTouch : COPY.hintPointer)}</p>
        </div>
        <div class="spira-plate-detail" hidden></div>
        <p class="spira-status" role="status" aria-live="polite"></p>
      </section>
      <p class="spira-note">${escapeHTML(COPY.note)}</p>
      <nav class="spira-themes" aria-label="Five recurring questions">${THEMES.map((theme, j) =>
        `<button type="button" class="spira-theme" data-q="${j}" aria-pressed="false"><span class="spira-dot" style="background:${theme.colour}" aria-hidden="true"></span>${escapeHTML(theme.label)}</button>`).join('')}</nav>
      <div class="spira-actions">
        <button type="button" data-index aria-expanded="false" aria-controls="spira-index">All works</button>
        <button type="button" data-replay>Replay</button>
        <button type="button" data-close>Close <span class="spira-key" aria-hidden="true">esc</span></button>
      </div>
      <div class="spira-index" id="spira-index" hidden>${years.map(year => `
        <div class="spira-index-year"><p class="spira-index-label">${year}</p>${PAPERS.map((p, i) => p.year !== year ? '' :
          `<a class="spira-index-link" href="${escapeHTML(paperURL(p.slug))}" title="${escapeHTML(p.title)}" data-paper="${i}">${escapeHTML(p.name)} <span>— ${escapeHTML(p.venue)}</span></a>`).join('')}</div>`).join('')}
      </div>
      <div class="spira-opening">
        <button type="button" data-skip>Skip <span class="spira-key" aria-hidden="true">↵</span></button>
        <button type="button" data-opening-close>Close <span class="spira-key" aria-hidden="true">esc</span></button>
      </div>`;
    const $ = selector => dialog.querySelector(selector);
    const canvas = $('.spira-canvas');
    const stage = $('.spira-stage');
    const headEl = $('.spira-head');
    const plateEl = $('.spira-plate');
    const plateDefault = $('.spira-plate-default');
    const plateDetail = $('.spira-plate-detail');
    const statusEl = $('.spira-status');
    const hintEl = $('.spira-hint');
    const noteEl = $('.spira-note');
    const themesEl = $('.spira-themes');
    const actionsEl = $('.spira-actions');
    const indexEl = $('.spira-index');
    const openingEl = $('.spira-opening');
    const centreButton = $('.spira-centre');
    const themeButtons = [...dialog.querySelectorAll('.spira-theme')];
    const indexButton = $('[data-index]');
    const replayButton = $('[data-replay]');
    const closeButton = $('[data-close]');
    const skipButton = $('[data-skip]');
    const chartBlocks = [plateEl, noteEl, themesEl, actionsEl];
    const inertBlocks = [stage, centreButton, headEl, plateEl, noteEl, themesEl, actionsEl, indexEl];
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (error) { ctx = null; }

    /* ---- State ----------------------------------------------------------- */
    let mode = 'opening';              // 'opening' | 'replay-out' | 'chart'
    let phase = 'dusk';
    let t = 0;                         // active opening time
    let raf = 0; let lastNow = 0;
    let closed = false; let leaving = false;
    let W = 0; let H = 0; let DPR = 1; let narrow = false;
    let chartX = 0; let chartY = 0; let sFit = 1; let sMax = 1; let focal = 1; let headRho = 1; let restPitch = CAM_PITCH;
    let coreX = 0; let coreY = 0; let coreRadius = 1;   // where and how large the core view shows the page
    let apMax = 1;                     // aperture radius when dusk completes
    let skipStart = -1; let remnantT = -1; let replayStart = -1;
    // Closing: 'dusk' reverses the iris; 'galaxy' collapses everything into its origin.
    let closeKind = ''; let closeT = 0; let closeFromMode = ''; let closeFromT = 0;
    let closeX = 0; let closeY = 0; let closeCover = 1; let closeR0 = 0; let closeExtent = 1;
    let closeLift = 0; let liftSprite = null; let collapseOn = false; let collapseK = 1; let collapsePhi = 0;
    const closeUIFrom = new Map();
    let wordCount = 0; let atlases = [];
    // Chart state
    let yaw = YAW_REST; let pitch = CAM_PITCH; let zoom = 1; let zoomTarget = 1;
    let vYaw = 0; let vPitch = 0; let lastInteraction = -Infinity;
    let selectedPaper = -1; let hoverPaper = -1; let selectedTheme = -1; let indexOpen = false;
    let pathPaper = -1; let pathAlpha = 0;   // the selected paper's path along the spiral
    // Core view: a camera flight into the origin, where the page's text spiral lies.
    let coreTarget = 0; let coreU = 0; let coreSpin = 0; let centreHover = false;
    const coreFrom = { yaw: 0, yawTo: 0, pitch: 0, zoom: 1 };
    const stats = { frames: 0, avgMs: 0, maxMs: 0, byPhase: {} };
    const travelStats = { clockwise: 0, counter: 0 };
    for (const name of ['dusk', 'gather', 'wind', 'ignite', 'chart', 'core', 'closing']) stats.byPhase[name] = { frames: 0, avgMs: 0, maxMs: 0 };
    const uiOpacity = new Map();
    const ui = new Float32Array(4 * 8); let uiCount = 0;
    const MAX_PLACED = 48;
    const placed = new Float32Array(4 * MAX_PLACED); let placedCount = 0;
    const yearWidth = new Float32Array(YEAR_MARKS.length); const themeWidth = new Float32Array(THEMES.length);

    /* ---- Typed scratch (allocation-free frame loop) ---------------------- */
    const random = seeded(20220101);
    const NP = PAPERS.length;
    // Eased label state (see drawLabels).
    const paperFade = new Float32Array(NP); const paperDone = new Uint8Array(NP);
    const themeFade = new Float32Array(THEMES.length); const themeOffset = new Float32Array(THEMES.length);
    const yearFade = new Float32Array(YEAR_MARKS.length);
    const ghostFade = new Float32Array(GHOST_WORDS.length); const ghostAt = Float32Array.from(GHOST_AT);
    let labelEase = 1; let labelSlideEase = 1; let labelPrimary = true;
    const paperSX = new Float32Array(NP); const paperSY = new Float32Array(NP);
    const paperZ = new Float32Array(NP); const paperVis = new Uint8Array(NP);
    const labelWidth = new Float32Array(NP); const labelScore = new Float32Array(NP); const labelOrder = new Int16Array(NP);
    const FOCUS_LABELS = PAPERS.map(paper => `${paper.name} · ${paper.year}`); const focusWidth = new Float32Array(NP);
    const sampleSX = new Float32Array(SAMPLE_COUNT); const sampleSY = new Float32Array(SAMPLE_COUNT);
    const sampleDepth = new Float32Array(SAMPLE_COUNT);
    // Starfield: a box around the disk, nothing within 0.2 of its plane.
    const starX = new Float32Array(STAR_COUNT); const starY = new Float32Array(STAR_COUNT); const starZ = new Float32Array(STAR_COUNT);
    const starMag = new Float32Array(STAR_COUNT); const starAlpha = new Float32Array(STAR_COUNT); const starWarm = new Uint8Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      starX[i] = (random() * 2 - 1) * 7; starY[i] = (random() * 2 - 1) * 7;
      let z = -5 + random() * 14; if (Math.abs(z) < 0.2) z = z < 0 ? z - 0.2 : z + 0.2;
      starZ[i] = z; starMag[i] = Math.pow(random(), 1.6); starAlpha[i] = 0.25 + 0.6 * random(); starWarm[i] = random() < 0.08 ? 1 : 0;
    }
    // Near field: a thin layer between the camera and the disk. Depths are set at layout
    // (they depend on how close the camera starts), so the pull-back gives strong parallax.
    const nearX = new Float32Array(NEAR_COUNT); const nearY = new Float32Array(NEAR_COUNT); const nearZ = new Float32Array(NEAR_COUNT);
    const nearDepth = new Float32Array(NEAR_COUNT); const nearSize = new Float32Array(NEAR_COUNT); const nearAlpha = new Float32Array(NEAR_COUNT);
    for (let i = 0; i < NEAR_COUNT; i++) {
      nearX[i] = (random() * 2 - 1) * 1.4; nearY[i] = (random() * 2 - 1) * 1.4; nearDepth[i] = random();
      nearSize[i] = lerp(NEAR_SIZE[0], NEAR_SIZE[1], random()); nearAlpha[i] = 0.18 + 0.22 * random();
    }
    // Stardust: the galaxy body along the arm. Theta is drawn in proportion to arc length
    // (arc length grows like r, i.e. like e^(lambda theta)); radial spread 0.06 r, thickness
    // 0.03 r + 0.005; a few brighter knots.
    const dustX = new Float32Array(DUST_COUNT); const dustY = new Float32Array(DUST_COUNT); const dustZ = new Float32Array(DUST_COUNT);
    const dustAlpha = new Float32Array(DUST_COUNT); const dustAt = new Float32Array(DUST_COUNT);
    const dustSize = new Float32Array(DUST_COUNT); const dustTone = new Uint8Array(DUST_COUNT); const dustKnot = new Uint8Array(DUST_COUNT);
    const lambda = Math.log(GROWTH) / TAU;
    const dustSpan = Math.exp(lambda * (THETA_END - THETA_IN)) - 1;
    for (let i = 0; i < DUST_COUNT; i++) {
      const theta = THETA_IN + Math.log(1 + random() * dustSpan) / lambda;
      const base = radiusAt(theta); const r = base * (1 + 0.06 * gaussian(random)); const a = theta + 0.01 * gaussian(random);
      dustX[i] = r * Math.cos(a); dustY[i] = r * Math.sin(a); dustZ[i] = (0.03 * base + 0.005) * gaussian(random);
      dustAt[i] = timeAtTheta(theta);
      dustKnot[i] = random() < DUST_KNOTS ? 1 : 0;
      dustAlpha[i] = dustKnot[i] ? 0.6 + 0.3 * random() : 0.14 + 0.4 * random();
      dustSize[i] = dustKnot[i] ? 1.8 + 0.8 * random() : random() < 0.2 ? 1.4 : 1;
      const sector = Math.floor((((theta - THETA0) % TAU) + TAU) % TAU / SECTOR) % THEMES.length;
      dustTone[i] = random() < 0.35 ? sector + 1 : 0;
    }
    const DUST_FILLS = ['#dfe7f2', ...THEMES.map(theme => theme.colour)];
    // Ignition sparks: directions on the unit sphere (a Fibonacci lattice plus jitter), so the
    // camera's projection foreshortens them by different amounts; speeds 0.35-1.0 of the max.
    const sparkDX = new Float32Array(SPARK_COUNT); const sparkDY = new Float32Array(SPARK_COUNT); const sparkDZ = new Float32Array(SPARK_COUNT);
    const sparkSpeed = new Float32Array(SPARK_COUNT); const sparkLife = new Float32Array(SPARK_COUNT);
    const sparkTone = new Uint8Array(SPARK_COUNT); const sparkGlitter = new Uint8Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) {
      const z = 1 - 2 * (i + 0.5) / SPARK_COUNT + (random() - 0.5) * 0.02; const ring = Math.sqrt(Math.max(0, 1 - z * z));
      const a = i * 2.399963 + (random() - 0.5) * 0.2;
      sparkDX[i] = ring * Math.cos(a); sparkDY[i] = ring * Math.sin(a); sparkDZ[i] = z;
      sparkSpeed[i] = lerp(SPARK_SPEED_SPREAD[0], SPARK_SPEED_SPREAD[1], random()); sparkLife[i] = lerp(SPARK_LIFE[0], SPARK_LIFE[1], random());
      sparkTone[i] = i % (THEMES.length + 1); sparkGlitter[i] = random() < SPARK_GLITTER ? 1 : 0;
    }
    const SPARK_STROKES = [...THEMES.map(theme => theme.colour), '#ffffff'];
    const PS = PAPER_SPARKS * NP;
    const pSparkDX = new Float32Array(PS); const pSparkDY = new Float32Array(PS);
    const pSparkSpeed = new Float32Array(PS); const pSparkLife = new Float32Array(PS);
    for (let i = 0; i < PS; i++) {
      const a = (i % PAPER_SPARKS) * 2.399963 + random() * 0.5;
      pSparkDX[i] = Math.cos(a); pSparkDY[i] = Math.sin(a);
      pSparkSpeed[i] = lerp(PAPER_SPARK_SPEED[0], PAPER_SPARK_SPEED[1], random());
      pSparkLife[i] = lerp(PAPER_SPARK_LIFE[0], PAPER_SPARK_LIFE[1], random());
    }
    const DASH_FUTURE = [2, 6]; const DASH_SPOKE = [2, 5]; const DASH_AXIS = [1, 4]; const NO_DASH = [];
    const LABEL_FONT = `11px ${SANS}`;
    const YEAR_FONT = `10px ${SANS}`;
    const THEME_FONT = `700 9px ${SANS}`;
    const THEME_LABELS = THEMES.map(theme => theme.label.toUpperCase());
    const THEME_RGBA = THEMES.map(theme => theme.colour);
    const nativeSpacing = !!ctx && 'letterSpacing' in ctx;

    // Words (filled by prepareWords): typed arrays sized to the capture.
    let W_N = 0;
    let wHomeX, wHomeY, wHomeR, wHomeA, wAnchorX, wAnchorY, wSpriteW, wSpriteH, wDayX, wDayY, wNightX, wNightY;
    let wDevW, wDevH, wPage, wNightPage, wSize, wSlotR, wSlotA, wSlotS, wSlotRot, wLift, wDur, wTravel, wTurn, wTone, wX, wY;
    let wKey, wWarmPage, wWarmX, wWarmY, wGlintAt; let keyCount = 0;
    // Streak polylines: 4 points per streak (now, and 1/3, 2/3, 3/3 of TRAIL_DT earlier).
    let trailPX = new Float32Array(0); let trailPY = trailPX; let trailTone = new Uint8Array(0); let trailCount = 0;
    let wordTones = []; let dotList = new Int32Array(0); let dotSize = new Float32Array(0); let dotAlpha = new Float32Array(0);
    let sepPhi = new Float32Array(0); let sepWord = new Int32Array(0); let sepCount = 0;
    let contPhi = new Float32Array(0); let contCount = 0;
    let spiralR0 = 1; let spiralS0 = 1;
    let ghostSprites = null;

    // Aperture mask (low resolution, smoothly upscaled)
    let mask = null; let maskCtx = null; let maskImage = null; let maskW = 0; let maskH = 0; let maskU32 = null;
    // Whole-texel values (night RGB + alpha) in the platform's byte order, for span fills.
    const maskTexel = new Uint32Array(256);
    (() => {
      const bytes = new Uint8ClampedArray(4); const word = new Uint32Array(bytes.buffer);
      for (let a = 0; a < 256; a++) { bytes[0] = NIGHT_RGB[0]; bytes[1] = NIGHT_RGB[1]; bytes[2] = NIGHT_RGB[2]; bytes[3] = a; maskTexel[a] = word[0]; }
    })();
    const maskClear = maskTexel[0]; const maskSolid = maskTexel[255];

    /* ---- Camera ---------------------------------------------------------- */
    // Projection of world points (x, y, z) with the disk in z = 0:
    //   yaw:   x1 = x cos psi - y sin psi, y1 = x sin psi + y cos psi
    //   pitch: y2 = y1 cos a + z sin a,    z2 = -y1 sin a + z cos a (far side recedes)
    //   perspective: screen = centre + (x1, y2) * focal / (dist + z2)
    // focal = sFit * D is fixed, so dist = focal / S puts the disk plane at scale S.
    // Changing S is a dolly, not a zoom: nearer stars move more (parallax).
    let camX = 0; let camY = 0; let camDist = CAM_D; let cYaw = 1; let sYaw = 0; let cPitch = 1; let sPitch = 0;
    let PX = 0; let PY = 0; let PZ = 0;
    function setCamera(x, y, psi, alpha, scale) {
      camX = x; camY = y; cYaw = Math.cos(psi); sYaw = Math.sin(psi); cPitch = Math.cos(alpha); sPitch = Math.sin(alpha);
      camDist = focal / scale;
    }
    function project(x, y, z) {
      const x1 = x * cYaw - y * sYaw; const y1 = x * sYaw + y * cYaw;
      const y2 = y1 * cPitch + z * sPitch; const z2 = -y1 * sPitch + z * cPitch;
      const d = camDist + z2;
      if (d <= 0.15) return false;
      const k = focal / d;
      PX = camX + x1 * k; PY = camY + y2 * k; PZ = z2;
      return true;
    }
    // Depth alpha: 1 on the near side of the disk, 0.55 on the far side.
    const depthFactor = z => lerp(1, 0.55, clamp01((z + 1) / 2));
    const trackScale = theta => {
      // Keep the head near headRho on screen, softly clamped in log space to [sFit, sMax].
      const x = Math.log(headRho / radiusAt(theta)); const lo = Math.log(sFit); const hi = Math.log(sMax);
      const k = Math.min(SCALE_KNEE, (hi - lo) / 2);
      let y;
      if (k <= 0) y = lo;
      else if (x <= lo - k) y = lo;
      else if (x < lo + k) y = lo + (x - lo + k) * (x - lo + k) / (4 * k);
      else if (x <= hi - k) y = x;
      else if (x < hi + k) y = hi - (hi + k - x) * (hi + k - x) / (4 * k);
      else y = hi;
      return Math.exp(y);
    };
    const yawStart = YAW_REST - YAW_SPIN * YAW_TAU * (1 - Math.exp(-(T_CHART - T_IGNITE) / YAW_TAU)) - DRIFT * (T_CHART - T_IGNITE);
    const yawAt = time => (time <= T_IGNITE ? yawStart
      : yawStart + YAW_SPIN * YAW_TAU * (1 - Math.exp(-(time - T_IGNITE) / YAW_TAU)) + DRIFT * (time - T_IGNITE));
    function openingCamera(time) {
      if (time < T_IGNITE) { setCamera(W / 2, H / 2, yawStart, 0, sMax); return; }
      const m = easeInOutCubic(span(time, T_CENTRE));
      const scale = Math.exp(lerp(Math.log(trackScale(headTheta(time))), Math.log(sFit), smooth(span(time, T_SCALE_REST))));
      setCamera(lerp(W / 2, chartX, m), lerp(H / 2, chartY, m), yawAt(time), restPitch * easeInOutSine(span(time, T_PITCH)), scale);
    }
    function coreScale() { return coreRadius / CORE_WORLD_R; }
    function chartCamera() {
      if (coreU <= 0) { setCamera(chartX, chartY, yaw, pitch, sFit * zoom); return; }
      // Flight into the core: the origin moves to the middle of the free area (clear of the
      // UI), pitch to face-on, yaw to the nearest whole turn (the text spiral as it was in the
      // hero frame), scale in log space.
      const e = easeInOutCubic(coreU);
      const from = Math.log(sFit * coreFrom.zoom); const to = Math.log(coreScale());
      setCamera(lerp(chartX, coreX, e), lerp(chartY, coreY, e), lerp(coreFrom.yaw, coreFrom.yawTo, e),
        lerp(coreFrom.pitch, 0, e), Math.exp(lerp(from, to, e)));
    }

    /* ---- Layout ---------------------------------------------------------- */
    function measureUI() {
      uiCount = 0;
      const blocks = indexOpen ? [headEl, plateEl, noteEl, themesEl, actionsEl, indexEl] : [headEl, plateEl, noteEl, themesEl, actionsEl];
      for (const el of blocks) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || uiCount >= 8) continue;
        ui[uiCount * 4] = r.left; ui[uiCount * 4 + 1] = r.top; ui[uiCount * 4 + 2] = r.right; ui[uiCount * 4 + 3] = r.bottom; uiCount++;
      }
    }
    function layout() {
      W = Math.max(1, dialog.clientWidth || innerWidth); H = Math.max(1, dialog.clientHeight || innerHeight);
      narrow = W < 700;
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (W * H * dpr * dpr > MAX_BACKING_PIXELS) dpr = Math.sqrt(MAX_BACKING_PIXELS / (W * H));
      DPR = dpr;
      if (ctx) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      measureUI();
      // The free area for the chart: right of the left column (desktop and short landscape),
      // or between the motto and the legend (narrow screens). Radius 1 (the end of 2026)
      // is CHART_SCALE x min(free width, free height / 0.72); the scale is then capped so the
      // rest footprint clears every UI block, and the chart is centred in the free area.
      const wide = W >= 900 && H >= 560;
      const side = !wide && H < 560 && W >= 600;
      restPitch = !wide && !side && W < 700 ? CAM_PITCH_NARROW : CAM_PITCH;
      footprint(restPitch);
      let left = EDGE_INSET; let right = W - EDGE_INSET; let top = EDGE_INSET; let bottom = H - EDGE_INSET;
      if (wide || side) {
        let column = 0;
        for (const el of [headEl, plateEl, themesEl, noteEl]) { const r = el.getBoundingClientRect(); if (r.width) column = Math.max(column, r.right); }
        left = column + 24;
      } else {
        top = headEl.getBoundingClientRect().bottom + 4; bottom = themesEl.getBoundingClientRect().top - 4;
      }
      const freeW = Math.max(40, right - left); const freeH = Math.max(40, bottom - top);
      chartX = (left + right) / 2;
      const target = (restPitch === CAM_PITCH_NARROW ? CHART_SCALE_NARROW : CHART_SCALE) * Math.min(freeW, freeH / 0.72);
      // Centre the radius-1 disk (not the padded footprint) in the free area. At rest a world
      // circle of radius 1 reaches cos(p) D / (D + sin p) above the centre and
      // cos(p) D / (D - sin p) below it, in units of S.
      const diskUp = Math.cos(restPitch) * CAM_D / (CAM_D + Math.sin(restPitch));
      const diskDown = Math.cos(restPitch) * CAM_D / (CAM_D - Math.sin(restPitch));
      const centreFor = scale => (top + bottom) / 2 + (diskUp - diskDown) * scale / 2;
      const fitAt = (cy, cap) => {
        // The footprint is star-shaped about the centre, so each direction is a ray; S may
        // grow until the first ray leaves the free box or enters a (padded) UI block.
        let fit = cap;
        for (let k = 0; k < FOOT_N; k++) {
          const dx = FOOT_X[k]; const dy = FOOT_Y[k];
          // The viewport only has to hold the written spiral (EDGE_FIT_RADIUS); the unwritten
          // turn may run off the edge, and canvas labels clamp themselves inside it.
          const ex = dx * EDGE_FIT_RADIUS / FIT_RADIUS; const ey = dy * EDGE_FIT_RADIUS / FIT_RADIUS;
          if (ex > 0) fit = Math.min(fit, (W - EDGE_INSET - chartX) / ex); else if (ex < 0) fit = Math.min(fit, (EDGE_INSET - chartX) / ex);
          if (ey > 0) fit = Math.min(fit, (H - EDGE_INSET - cy) / ey); else if (ey < 0) fit = Math.min(fit, (EDGE_INSET - cy) / ey);
          for (let i = 0; i < uiCount; i++) {
            const x0 = ui[i * 4] - FIT_MARGIN[0] - chartX; const x1 = ui[i * 4 + 2] + FIT_MARGIN[0] - chartX;
            const y0 = ui[i * 4 + 1] - FIT_MARGIN[1] - cy; const y1 = ui[i * 4 + 3] + FIT_MARGIN[1] - cy;
            // Slab test: the ray s (dx, dy), s >= 0, enters the box at sIn.
            let sIn = 0; let sOut = Infinity;
            if (Math.abs(dx) < 1e-9) { if (x0 > 0 || x1 < 0) continue; }
            else { const a = x0 / dx; const b = x1 / dx; sIn = Math.max(sIn, Math.min(a, b)); sOut = Math.min(sOut, Math.max(a, b)); }
            if (Math.abs(dy) < 1e-9) { if (y0 > 0 || y1 < 0) continue; }
            else { const a = y0 / dy; const b = y1 / dy; sIn = Math.max(sIn, Math.min(a, b)); sOut = Math.min(sOut, Math.max(a, b)); }
            if (sIn <= sOut) fit = Math.min(fit, sIn);
          }
        }
        return fit;
      };
      chartY = centreFor(target);
      let fit = fitAt(chartY, target);
      if (fit < target) { chartY = centreFor(fit); fit = fitAt(chartY, fit); }
      sFit = Math.max(40, fit);
      // Core view: the text spiral's outer radius is CORE_VIEW_R x min(w, h), kept inside the
      // free area and centred in it.
      coreX = chartX; coreY = (top + bottom) / 2;
      coreRadius = Math.min(CORE_VIEW_R * Math.min(W, H), 0.46 * Math.min(freeW, freeH));
      // The CSS lift of the chart's night is centred on the chart (one write per layout).
      dialog.style.setProperty('--spira-cx', `${Math.round(chartX)}px`); dialog.style.setProperty('--spira-cy', `${Math.round(chartY)}px`);
      // The origin always projects to the chart centre, so its control can stay put.
      centreButton.style.left = `${Math.round(chartX - CORE_HIT)}px`; centreButton.style.top = `${Math.round(chartY - CORE_HIT)}px`;
      hintEl.textContent = coarse || narrow ? COPY.hintTouch : COPY.hintPointer;
      focal = sFit * CAM_D;
      const minSide = Math.min(W, H);
      headRho = HEAD_RADIUS * minSide;
      sMax = Math.max(sFit * 1.05, HEAD_START_RADIUS * minSide / radiusAt(THETA_IN));
      placeNearStars();
      // The aperture is fully open when its soft edge has passed the farthest corner.
      const corner = Math.hypot(W / 2, H / 2);
      apMax = corner + EDGE_MAX; for (let i = 0; i < 6; i++) apMax = corner + edgeOf(apMax);
      if (ctx) {
        maskW = Math.ceil(W / MASK_CELL) + 2; maskH = Math.ceil(H / MASK_CELL) + 2;
        mask = makeCanvas(maskW, maskH); maskCtx = mask.getContext('2d');
        maskImage = maskCtx.createImageData(maskW, maskH);
        maskU32 = new Uint32Array(maskImage.data.buffer);
        ctx.font = LABEL_FONT;
        for (let p = 0; p < NP; p++) { labelWidth[p] = ctx.measureText(PAPERS[p].name).width; focusWidth[p] = ctx.measureText(FOCUS_LABELS[p]).width; }
        ctx.font = YEAR_FONT;
        for (let m = 0; m < YEAR_MARKS.length; m++) yearWidth[m] = ctx.measureText(YEAR_MARKS[m].label).width;
        ctx.font = THEME_FONT;
        if (nativeSpacing) ctx.letterSpacing = '1.6px';
        for (let j = 0; j < THEMES.length; j++) themeWidth[j] = ctx.measureText(THEME_LABELS[j]).width;
        if (nativeSpacing) ctx.letterSpacing = '0px';
      }
    }

    /* ---- Words: capture -> sprites -> text-spiral slots -> flights -------- */
    function apertureRadius(time) {
      // Visible from the first frame; an iris opening to past the farthest corner.
      return APERTURE_START + (apMax - APERTURE_START) * easeInOutSine(time / T_DUSK);
    }
    function releaseWords() {
      for (const atlas of atlases) { atlas.width = 0; atlas.height = 0; }
      atlases = []; W_N = 0;
    }
    function prepareWords(captured) {
      releaseWords();
      keyCount = markKeySentence(captured);
      const built = buildWordSprites(captured, DPR);
      atlases = built.atlases;
      const words = built.words;
      const n = words.length; W_N = n; wordCount = n;
      const f32 = () => new Float32Array(n);
      wHomeX = new Float64Array(n); wHomeY = new Float64Array(n); wHomeR = f32(); wHomeA = f32();
      wAnchorX = new Float64Array(n); wAnchorY = new Float64Array(n); wSpriteW = f32(); wSpriteH = f32();
      wDayX = f32(); wDayY = f32(); wNightX = f32(); wNightY = f32(); wDevW = f32(); wDevH = f32();
      wPage = new Uint8Array(n); wNightPage = new Uint8Array(n); wSize = f32(); wSlotR = f32(); wSlotA = f32(); wSlotS = f32(); wSlotRot = f32();
      wKey = new Int16Array(n).fill(-1); wWarmPage = new Uint8Array(n); wWarmX = f32(); wWarmY = f32(); wGlintAt = f32();
      wLift = f32(); wDur = f32(); wTravel = f32(); wTurn = f32(); wTone = new Uint8Array(n);
      dotList = new Int32Array(n); dotSize = f32(); dotAlpha = f32(); wX = f32(); wY = f32();
      trailPX = new Float32Array(n * 4); trailPY = new Float32Array(n * 4); trailTone = new Uint8Array(n);
      const tones = new Map();
      const cx = W / 2; const cy = H / 2;
      for (let i = 0; i < n; i++) {
        const w = words[i];
        // The local origin of a sprite is its baseline midpoint; at t = 0 it sits on the page baseline.
        wHomeX[i] = w.left + w.width / 2; wHomeY[i] = w.top + w.ascent;
        wAnchorX[i] = wHomeX[i] - w.ox / DPR; wAnchorY[i] = wHomeY[i] - w.oy / DPR;
        wSpriteW[i] = w.sw / DPR; wSpriteH[i] = w.sh / DPR; wDevW[i] = w.sw; wDevH[i] = w.sh;
        wPage[i] = w.daySpot[0]; wDayX[i] = w.daySpot[1]; wDayY[i] = w.daySpot[2];
        wNightPage[i] = w.nightSpot[0]; wNightX[i] = w.nightSpot[1]; wNightY[i] = w.nightSpot[2];
        if (w.warmSpot) { wKey[i] = w.key; wWarmPage[i] = w.warmSpot[0]; wWarmX[i] = w.warmSpot[1]; wWarmY[i] = w.warmSpot[2]; }
        wSize[i] = w.style.size;
        if (!tones.has(w.style.night)) tones.set(w.style.night, tones.size);
        wTone[i] = tones.get(w.style.night);
        const dx = wHomeX[i] - cx; const dy = wHomeY[i] - cy;
        wHomeR[i] = Math.max(1, Math.hypot(dx, dy)); wHomeA[i] = Math.atan2(dy, dx);
      }
      wordTones = [...tones.keys()];
      // The glint reaches each key word at a time proportional to the text width before it,
      // so the light moves at an even speed along the sentence.
      let keyWidth = 0;
      for (let i = 0; i < n; i++) if (wKey[i] >= 0) keyWidth += words[i].width;
      let before = 0;
      for (let i = 0; i < n; i++) {
        if (wKey[i] < 0) continue;
        wGlintAt[i] = lerp(T_GLINT[0], T_GLINT[1], keyWidth ? (before + words[i].width / 2) / keyWidth : 0);
        before += words[i].width;
      }
      // Slots on r = R0 e^(-B phi), theta = start + phi. A word of width w at scale
      // s0 e^(-B phi) spans arc length s0 e^(-B phi) w, and arc length per radian is
      // r sqrt(1 + B^2) = R0 e^(-B phi) sqrt(1 + B^2): the e^(-B phi) cancels, so every
      // word takes the same angle at any depth (the spiral is self-similar).
      const minSide = Math.min(W, H);
      const R0 = (narrow ? SPIRAL_R_NARROW : SPIRAL_R) * minSide;
      const s0 = clamp(R0 / 400, 0.6, 1);
      const perPx = s0 / (R0 * Math.sqrt(1 + SPIRAL_B * SPIRAL_B));
      spiralR0 = R0; spiralS0 = s0;
      sepPhi = new Float32Array(n); sepWord = new Int32Array(n); sepCount = 0;
      let phi = 0;
      for (let i = 0; i < n; i++) {
        if (i > 0 && words[i].block !== words[i - 1].block) {
          const gap = BLOCK_GAP_EM * wSize[i] * perPx;
          sepPhi[sepCount] = phi + gap / 2; sepWord[sepCount++] = i; phi += gap;
        }
        const extent = (words[i].width + WORD_GAP_EM * wSize[i]) * perPx;
        const centre = phi + extent / 2; phi += extent;
        const decay = Math.exp(-SPIRAL_B * centre);
        wSlotR[i] = R0 * decay; wSlotA[i] = SPIRAL_START + centre; wSlotS[i] = s0 * decay; wSlotRot[i] = SPIRAL_START + centre + SLOT_TILT;
      }
      // A dotted continuation runs from the last word to the vanishing point.
      const maxCont = 1400; contPhi = new Float32Array(maxCont); contCount = 0;
      for (let p = phi + CONTINUATION_STEP; contCount < maxCont; p += CONTINUATION_STEP) {
        if (R0 * Math.exp(-SPIRAL_B * p) < 2) break;
        contPhi[contCount++] = p;
      }
      // Flights: the page is read into the spiral. Words depart in reading order, evenly
      // spaced over T_DEPART, and ride clockwise around the centre to their slots.
      const rand = seeded(7 + n);
      const departSpan = T_DEPART[1] - T_DEPART[0];
      travelStats.clockwise = 0; travelStats.counter = 0;
      for (let i = 0; i < n; i++) {
        const lift = T_DEPART[0] + (n > 1 ? i / (n - 1) : 0) * departSpan;
        wLift[i] = lift;
        wDur[i] = Math.min(FLIGHT_TIME + rand() * FLIGHT_JITTER, Math.max(FLIGHT_MIN, T_LAND - lift));
        // Clockwise travel inside the TRAVEL window. A target just behind a word (outside the
        // window) is reached by a short counter-clockwise step rather than a near-full orbit.
        let travel = (((wSlotA[i] - wHomeA[i]) % TAU) + TAU) % TAU;
        if (travel > TRAVEL[1]) travel -= TAU;
        if (travel >= 0) travelStats.clockwise++; else travelStats.counter++;
        wTravel[i] = travel;
        // The word turns from upright to riding its lane's tangent as its radius settles;
        // wTurn is the tangent angle at home, wrapped to (-pi, pi], that is unwound.
        let lock = (((wHomeA[i] + SLOT_TILT) % TAU) + TAU) % TAU;
        if (lock > Math.PI) lock -= TAU;
        wTurn[i] = lock;
      }
    }
    function buildGhosts() {
      const g = makeCanvas(1, 1).getContext('2d');
      const font = `italic 12px ${SERIF}`; g.font = font;
      ghostSprites = GHOST_WORDS.map(text => {
        const w = Math.ceil(g.measureText(text).width) + 8; const h = 22;
        const c = makeCanvas(Math.ceil(w * DPR), Math.ceil(h * DPR)); const gc = c.getContext('2d');
        // Ghost words share the key sentence's warm tint: the sentence that glinted becomes the unwritten turn.
        gc.scale(DPR, DPR); gc.font = font; gc.fillStyle = WARM; gc.textBaseline = 'middle'; gc.textAlign = 'center';
        gc.fillText(text, w / 2, h / 2);
        return { canvas: c, w, h };
      });
    }

    /* ---- Transforms -------------------------------------------------------- */
    // A screen-space base transform (CSS px) under DPR: the identity, except while closing,
    // when the galaxy collapses about its origin. Local transforms compose onto it.
    let baseA = 1; let baseB = 0; let baseC = 0; let baseD = 1; let baseE = 0; let baseF = 0;
    function setBase(a, b, c, d, e, f) {
      baseA = a; baseB = b; baseC = c; baseD = d; baseE = e; baseF = f;
      resetTransform();
    }
    function resetTransform() {
      ctx.setTransform(DPR * baseA, DPR * baseB, DPR * baseC, DPR * baseD, DPR * baseE, DPR * baseF);
    }
    function setLocal(a, b, c, d, e, f) {
      ctx.setTransform(DPR * (baseA * a + baseC * b), DPR * (baseB * a + baseD * b),
        DPR * (baseA * c + baseC * d), DPR * (baseB * c + baseD * d),
        DPR * (baseA * e + baseC * f + baseE), DPR * (baseB * e + baseD * f + baseF));
    }

    /* ---- Drawing: opening ------------------------------------------------ */
    /**
     * The iris of night around (cx, cy). Normally it paints the night (source-over); with
     * `cut` it instead keeps what is already drawn only inside the iris (destination-in),
     * which is how the closing lets the page reappear from the edges.
     */
    function drawAperture(radius, edge, layer, cx = W / 2, cy = H / 2, cut = false) {
      const corner = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
      ctx.globalCompositeOperation = 'source-over';
      if (radius - edge / 2 >= corner + MASK_CELL) {
        if (!cut) { ctx.globalAlpha = layer; ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H); }
      } else if (cut && radius + edge / 2 <= 0) {
        ctx.clearRect(0, 0, W, H);
      } else {
        // A low-resolution alpha mask of the iris, smoothly upscaled. Texel i covers CSS
        // [(i - 1) cell, i cell] (centre (i - 0.5) cell). Rows are filled as spans: clear
        // outside, solid inside, and only texels near the edge band are evaluated.
        const outer = radius + edge / 2 + MASK_CELL; const inner = radius - edge / 2 - MASK_CELL;
        for (let j = 0; j < maskH; j++) {
          const y = (j - 0.5) * MASK_CELL - cy; const row = j * maskW;
          if (Math.abs(y) >= outer) { maskU32.fill(maskClear, row, row + maskW); continue; }
          const xo = Math.sqrt(outer * outer - y * y);
          const lo = clamp(Math.floor((cx - xo) / MASK_CELL + 0.5), 0, maskW);
          const hi = clamp(Math.ceil((cx + xo) / MASK_CELL + 0.5) + 1, lo, maskW);
          maskU32.fill(maskClear, row, row + lo); maskU32.fill(maskClear, row + hi, row + maskW);
          let solidLo = hi; let solidHi = hi;
          if (inner > 0 && Math.abs(y) < inner) {
            const xi = Math.sqrt(inner * inner - y * y);
            solidLo = clamp(Math.ceil((cx - xi) / MASK_CELL + 0.5), lo, hi);
            solidHi = clamp(Math.floor((cx + xi) / MASK_CELL + 0.5), solidLo, hi);
            maskU32.fill(maskSolid, row + solidLo, row + solidHi);
          }
          for (let i = lo; i < hi; i++) {
            if (i === solidLo && solidHi > solidLo) { i = solidHi - 1; continue; }
            const x = (i - 0.5) * MASK_CELL - cx;
            maskU32[row + i] = maskTexel[(nightAt(Math.sqrt(x * x + y * y), radius, edge) * 255 + 0.5) | 0];
          }
        }
        maskCtx.putImageData(maskImage, 0, 0);
        ctx.globalAlpha = cut ? 1 : layer; ctx.imageSmoothingEnabled = true;
        if (cut) ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0, maskW, maskH, -MASK_CELL, -MASK_CELL, maskW * MASK_CELL, maskH * MASK_CELL);
        ctx.globalCompositeOperation = 'source-over';
      }
      // A luminous rim: a crisp 1 px line over a faint halo, fading once the iris passes the corners.
      const rim = 1 - smooth((radius - corner) / (edge + 8));
      if (rim > 0.01 && radius > 0.5) {
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU);
        ctx.globalAlpha = layer * rim; ctx.strokeStyle = RIM_HALO; ctx.lineWidth = RIM_HALO_WIDTH; ctx.stroke();
        ctx.strokeStyle = RIM_COLOUR; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    function drawStars(layer, nightRadius, nightEdge) {
      const n = narrow ? STAR_COUNT_NARROW : STAR_COUNT;
      const dusk = nightRadius !== undefined;
      const cx = W / 2; const cy = H / 2;
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < n; i++) {
        if (!project(starX[i], starY[i], starZ[i])) continue;
        if (PX < -6 || PX > W + 6 || PY < -6 || PY > H + 6) continue;
        const d = camDist + PZ;
        // Stars fade out before their depth reaches 0.15, so none is ever seen crossing it.
        let a = starAlpha[i] * layer * smooth((d - STAR_NEAR_FADE[0]) / (STAR_NEAR_FADE[1] - STAR_NEAR_FADE[0]));
        if (dusk) a *= nightAt(Math.hypot(PX - cx, PY - cy), nightRadius, nightEdge);
        if (a < 0.01) continue;
        // Nearer stars are larger: 0.4-1.5 px.
        const size = clamp(0.35 + starMag[i] * 1.15 * Math.sqrt(CAM_D / d), 0.4, 1.5) * 1.6;
        ctx.globalAlpha = a;
        ctx.drawImage(starWarm[i] ? sprites.warmDot : sprites.cool, PX - size / 2, PY - size / 2, size, size);
        if (i % 40 === 0) { ctx.globalAlpha = a * 0.5; ctx.drawImage(sprites.glint, PX - 5, PY - 5, 10, 10); }
      }
    }
    function drawNearStars(time, chart, layer) {
      const show = (chart ? 1 : smooth(span(time, T_NEAR_STARS))) * layer;
      if (show <= 0) return;
      const n = narrow ? NEAR_COUNT_NARROW : NEAR_COUNT;
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < n; i++) {
        if (!project(nearX[i], nearY[i], nearZ[i])) continue;
        if (PX < -8 || PX > W + 8 || PY < -8 || PY > H + 8) continue;
        const d = camDist + PZ;
        const a = nearAlpha[i] * show * smooth((d - STAR_NEAR_FADE[0]) / (STAR_NEAR_FADE[1] - STAR_NEAR_FADE[0]));
        if (a < 0.01) continue;
        const size = nearSize[i] * 1.6;
        ctx.globalAlpha = a;
        ctx.drawImage(sprites.cool, PX - size / 2, PY - size / 2, size, size);
      }
    }
    function placeNearStars() {
      // Depth runs from just in front of the disk towards the camera's closest approach.
      // Each star is then pushed back towards the disk until its depth stays above 0.35
      // along the whole opening camera path and at rest, so none ever reaches 0.15.
      const startDist = focal / sMax;
      const rest = (x, y, z) => CAM_D - Math.hypot(x, y) * Math.sin(restPitch) + z * Math.cos(restPitch);
      for (let i = 0; i < NEAR_COUNT; i++) {
        let z = -(0.12 + nearDepth[i] * Math.max(0.1, startDist - 0.45));
        for (let pass = 0; pass < 3; pass++) {
          let worst = rest(nearX[i], nearY[i], z);
          for (let k = 0; k <= 24; k++) {
            openingCamera(lerp(T_IGNITE, T_STOP, k / 24));
            const y1 = nearX[i] * sYaw + nearY[i] * cYaw;
            worst = Math.min(worst, camDist - y1 * sPitch + z * cPitch);
          }
          if (worst >= 0.35) break;
          z += (0.35 - worst) * 1.2;
        }
        nearZ[i] = Math.min(z, -0.04);
      }
    }
    function spinAt(time) {
      // Slow spin once formed, then 1.2 extra clockwise turns as the spiral winds in.
      return HOLD_SPIN * Math.max(0, time - T_LAND) + WIND_TURNS * TAU * easeInCubic(span(time, [T_WIND, T_COLLAPSED]));
    }
    function windScale(time) {
      return Math.exp(-Math.log(spiralR0 / WIND_END_RADIUS) * easeInCubic(span(time, [T_WIND, T_COLLAPSED])));
    }
    function drawSpiralDots(time, layer) {
      // Block separators and the dotted continuation are rigid parts of the text spiral.
      const cx = W / 2; const cy = H / 2;
      const spin = spinAt(time); const k = windScale(time);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = DOT_COLOUR;
      for (let s = 0; s < sepCount; s++) {
        const i = sepWord[s];
        const landed = smooth((time - wLift[i] - wDur[i] * 0.75) / (wDur[i] * 0.35));
        if (landed <= 0) continue;
        const decay = Math.exp(-SPIRAL_B * sepPhi[s]);
        const r = spiralR0 * decay * k; if (r < COLLAPSE_RADIUS) continue;
        const a = SPIRAL_START + sepPhi[s] + spin;
        const size = Math.max(0.6, 1.5 * spiralS0 * decay * k);
        ctx.globalAlpha = 0.7 * landed * layer;
        ctx.fillRect(cx + r * Math.cos(a) - size / 2, cy + r * Math.sin(a) - size / 2, size, size);
      }
      const show = smooth(span(time, [T_LAND - 0.6, T_LAND + 0.2])) * 0.42 * layer;
      if (show <= 0) return;
      const startDecay = contCount ? Math.exp(-SPIRAL_B * contPhi[0]) : 1;
      for (let s = 0; s < contCount; s++) {
        const decay = Math.exp(-SPIRAL_B * contPhi[s]);
        const r = spiralR0 * decay * k; if (r < COLLAPSE_RADIUS) continue;
        const a = SPIRAL_START + contPhi[s] + spin;
        const size = Math.max(0.5, 1.4 * spiralS0 * decay * k);
        // The continuation thins out towards the vanishing point instead of ringing it.
        ctx.globalAlpha = show * Math.pow(decay / startDecay, 0.9);
        ctx.fillRect(cx + r * Math.cos(a) - size / 2, cy + r * Math.sin(a) - size / 2, size, size);
      }
    }
    /**
     * Words: page -> polar flight -> text spiral -> rigid wind. Returns the collapsed fraction.
     * Layering: words still on the page recede (WAIT_ALPHA), words in flight are clearer
     * (FLIGHT_ALPHA), landed words are full. `closing` (a close during the dusk) drops the
     * day sprites, since the page's own glyphs are already back underneath.
     */
    function drawWords(time, layer, nightRadius, nightEdge, closing) {
      const cx = W / 2; const cy = H / 2;
      const spin = spinAt(time); const k = windScale(time);
      const dusk = nightRadius !== undefined;
      // Wind streaks: the wind transform at three earlier instants gives each word's recent
      // path, so a streak curves with the rotation and the inward pull (a long exposure).
      const streaks = time > T_WIND && time < T_COLLAPSED;
      const spin1 = streaks ? spinAt(time - TRAIL_DT / 3) : 0; const k1 = streaks ? windScale(time - TRAIL_DT / 3) : 0;
      const spin2 = streaks ? spinAt(time - TRAIL_DT * 2 / 3) : 0; const k2 = streaks ? windScale(time - TRAIL_DT * 2 / 3) : 0;
      const spin3 = streaks ? spinAt(time - TRAIL_DT) : 0; const k3 = streaks ? windScale(time - TRAIL_DT) : 0;
      const tintLeft = 1 - smooth(span(time, [T_WIND, T_WIND + 0.4]));
      let dots = 0; trailCount = 0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
      for (let i = 0; i < W_N; i++) {
        let x; let y; let s; let rot; let presence = 1; let landed = false;
        const age = time - wLift[i];
        if (age <= 0) { x = wHomeX[i]; y = wHomeY[i]; s = 1; rot = 0; presence = -1; }
        else {
          const u = age / wDur[i];
          if (u >= 1) {
            const r = wSlotR[i] * k; const a = wSlotA[i] + spin; landed = true;
            x = cx + r * Math.cos(a); y = cy + r * Math.sin(a); s = wSlotS[i] * k; rot = wSlotRot[i] + spin;
          } else {
            // Polar interpolation about the centre. Log-radius eases ahead of the angle
            // (settling by RADIAL_SHARE of the flight), so a word first finds the lane of its
            // own turn and then rides it to its slot, like thread winding onto a reel.
            const ea = easeInOutCubic(u); const er = easeInOutCubic(u / RADIAL_SHARE);
            const r = wHomeR[i] * Math.exp(er * Math.log((wSlotR[i] * k) / wHomeR[i]));
            const a = wHomeA[i] + (wTravel[i] + spin) * ea;
            x = cx + r * Math.cos(a); y = cy + r * Math.sin(a);
            s = (1 + (wSlotS[i] * k - 1) * er) * (1 + FLIGHT_LIFT * Math.sin(Math.PI * Math.min(1, u / (2 * FLIGHT_LIFT_PEAK))));
            // Upright at home, riding the lane's tangent once the radius has settled:
            // a + tilt is the tangent angle here; wTurn (the home tangent) is unwound by er.
            rot = a + SLOT_TILT - wTurn[i] * (1 - er);
            presence = lerp(WAIT_ALPHA, FLIGHT_ALPHA, smooth(u / 0.15)) + (1 - FLIGHT_ALPHA) * smooth((u - 0.85) / 0.15);
          }
        }
        wX[i] = x; wY[i] = y;
        const dist = Math.hypot(x - cx, y - cy);
        const night = dusk ? nightAt(dist, nightRadius, nightEdge) : 1;
        // A waiting word recedes as the night reaches it (full alpha at t = 0 for the swap).
        if (presence < 0) presence = lerp(1, WAIT_ALPHA, night);
        let alpha = layer * presence;
        if (dist < COLLAPSE_RADIUS) alpha *= clamp01((dist - 1) / (COLLAPSE_RADIUS - 1));
        if (alpha <= 0.004) continue;
        const px = wSize[i] * s;
        // Only words that are no longer legible (dots, or tiny and fast) leave a streak.
        if (streaks && landed && px < TRAIL_MAX_FONT && trailCount < trailTone.length) {
          const r3 = wSlotR[i] * k3; const a3 = wSlotA[i] + spin3;
          const x3 = cx + r3 * Math.cos(a3); const y3 = cy + r3 * Math.sin(a3);
          if (Math.hypot(x - x3, y - y3) > TRAIL_SPEED * TRAIL_DT) {
            const b = trailCount * 4; const r1 = wSlotR[i] * k1; const a1 = wSlotA[i] + spin1;
            const r2 = wSlotR[i] * k2; const a2 = wSlotA[i] + spin2;
            trailPX[b] = x; trailPY[b] = y;
            trailPX[b + 1] = cx + r1 * Math.cos(a1); trailPY[b + 1] = cy + r1 * Math.sin(a1);
            trailPX[b + 2] = cx + r2 * Math.cos(a2); trailPY[b + 2] = cy + r2 * Math.sin(a2);
            trailPX[b + 3] = x3; trailPY[b + 3] = y3;
            trailTone[trailCount++] = wTone[i];
          }
        }
        // Below DOT_SWITCH_PX a word is a dot in its night colour; a short band crossfades.
        const asDot = 1 - clamp01((px - DOT_SWITCH_PX) / DOT_BLEND_PX);
        if (asDot > 0) {
          dotList[dots] = i; dotAlpha[dots] = alpha * asDot;
          dotSize[dots] = 1.2 + 0.4 * clamp01(px / DOT_SWITCH_PX); dots++;
        }
        if (asDot >= 1) continue;
        const sa = alpha * (1 - asDot);
        // The key sentence: a warm light passes each word, which then keeps a warm tint.
        let warm = 0;
        if (wKey[i] >= 0) {
          const d = (time - wGlintAt[i]) / GLINT_WIDTH;
          warm = Math.max(Math.exp(-d * d), GLINT_TINT * smooth(d / 1.5) * tintLeft);
        }
        const cos = Math.cos(rot) * s; const sin = Math.sin(rot) * s;
        setLocal(cos, sin, -sin, cos, x, y);
        if (night < 1 && !closing) {
          ctx.globalAlpha = sa * (1 - night);
          ctx.drawImage(atlases[wPage[i]], wDayX[i], wDayY[i], wDevW[i], wDevH[i], -wAnchorX[i], -wAnchorY[i], wSpriteW[i], wSpriteH[i]);
        }
        if (night > 0) {
          ctx.globalAlpha = sa * night * (1 - warm);
          ctx.drawImage(atlases[wNightPage[i]], wNightX[i], wNightY[i], wDevW[i], wDevH[i], -wAnchorX[i], -wAnchorY[i], wSpriteW[i], wSpriteH[i]);
          if (warm > 0.003) {
            ctx.globalAlpha = sa * night * warm;
            ctx.drawImage(atlases[wWarmPage[i]], wWarmX[i], wWarmY[i], wDevW[i], wDevH[i], -wAnchorX[i], -wAnchorY[i], wSpriteW[i], wSpriteH[i]);
          }
        }
      }
      resetTransform();
      // Dots, grouped by night colour so the fill style changes only a few times.
      for (let tone = 0; tone < wordTones.length; tone++) {
        ctx.fillStyle = wordTones[tone];
        for (let d = 0; d < dots; d++) {
          const i = dotList[d]; if (wTone[i] !== tone) continue;
          const size = dotSize[d];
          ctx.globalAlpha = dotAlpha[d];
          ctx.fillRect(wX[i] - size / 2, wY[i] - size / 2, size, size);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      // The travelling light of the glint, centred on each key word as it passes.
      if (keyCount && time > T_GLINT[0] - 0.5 && time < T_GLINT[1] + 0.5) {
        for (let i = 0; i < W_N; i++) {
          if (wKey[i] < 0) continue;
          const d = (time - wGlintAt[i]) / GLINT_WIDTH; const g = Math.exp(-d * d);
          if (g < 0.01) continue;
          const radius = GLINT_GLOW * Math.max(0.5, wSlotS[i]);
          ctx.globalAlpha = 0.32 * g * layer;
          ctx.drawImage(sprites.warm, wX[i] - radius, wY[i] - radius, radius * 2, radius * 2);
        }
      }
      // Wind streaks: faint curved polylines whose alpha falls to nothing at the tail, so the
      // overlapping streaks merge into a whirl. One path per night colour and segment.
      if (trailCount) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = TRAIL_WIDTH;
        for (let seg = 0; seg < 3; seg++) {
          ctx.globalAlpha = TRAIL_ALPHA[seg] * layer;
          for (let tone = 0; tone < wordTones.length; tone++) {
            ctx.strokeStyle = wordTones[tone]; ctx.beginPath(); let any = false;
            for (let j = 0; j < trailCount; j++) {
              if (trailTone[j] !== tone) continue;
              const b = j * 4 + seg;
              ctx.moveTo(trailPX[b], trailPY[b]); ctx.lineTo(trailPX[b + 1], trailPY[b + 1]); any = true;
            }
            if (any) ctx.stroke();
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      // Collapsed fraction: the share of the spiral's log-radius span already inside the
      // collapse radius. Words are uniform in phi, hence in log r, so this tracks the share
      // of collapsed words, but it rises smoothly instead of waiting for the innermost word.
      return clamp01(1 - Math.log(Math.max(1, spiralR0 * k / COLLAPSE_RADIUS)) / Math.log(Math.max(1.01, spiralR0 / COLLAPSE_RADIUS)));
    }
    function drawCore(time, collapsed, layer) {
      if (time < T_WIND) return;
      const cx = W / 2; const cy = H / 2;
      ctx.globalCompositeOperation = 'lighter';
      if (time < T_COLLAPSED) {
        const f = clamp01(collapsed);
        const radius = CORE_RADIUS[0] + CORE_RADIUS[1] * f;
        ctx.globalAlpha = (CORE_ALPHA[0] + CORE_ALPHA[1] * f) * smooth((time - T_WIND) / 0.4) * layer;
        ctx.drawImage(sprites.warm, cx - radius, cy - radius, radius * 2, radius * 2);
        // A brighter heart, so the core outshines the last ring of words falling into it.
        ctx.globalAlpha = f * f * layer;
        ctx.drawImage(sprites.white, cx - radius * 0.35, cy - radius * 0.35, radius * 0.7, radius * 0.7);
      } else {
        // The inhale: the core shrinks while it brightens.
        const u = span(time, [T_COLLAPSED, T_IGNITE]);
        const radius = lerp(INHALE_RADIUS[0], INHALE_RADIUS[1], easeInCubic(u));
        ctx.globalAlpha = layer;
        ctx.drawImage(sprites.warm, cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.globalAlpha = (0.4 + 0.6 * u) * layer;
        ctx.drawImage(sprites.white, cx - radius * 0.5, cy - radius * 0.5, radius, radius);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawIgnition(time, layer) {
      const age = time - T_IGNITE;
      if (age < 0 || age > SPARK_LIFE[1] + 0.1) return;
      const cx = W / 2; const cy = H / 2; const minSide = Math.min(W, H);
      ctx.globalCompositeOperation = 'lighter';
      // Two-layer flash: a wide cool haze under a fast white core.
      if (age < FLASH_HAZE.time) {
        const u = age / FLASH_HAZE.time; const radius = Math.max(6, FLASH_HAZE.size * minSide * easeOutCubic(u));
        ctx.globalAlpha = FLASH_HAZE.alpha * (1 - u) * (1 - u) * layer;
        ctx.drawImage(sprites.haze, cx - radius, cy - radius, radius * 2, radius * 2);
      }
      if (age < FLASH_CORE.time) {
        const u = age / FLASH_CORE.time; const radius = Math.max(4, FLASH_CORE.size * minSide * easeOutCubic(u));
        ctx.globalAlpha = (1 - easeOutQuad(u)) * layer;
        ctx.drawImage(sprites.white, cx - radius, cy - radius, radius * 2, radius * 2);
      }
      // One fast ring that has fully faded by the time it reaches RING.size x min(w, h).
      if (age < RING.time) {
        const u = age / RING.time;
        ctx.globalAlpha = RING.alpha * (1 - u) * (1 - u) * layer; ctx.lineWidth = RING.width; ctx.strokeStyle = CURVE_COLOUR;
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, RING.size * minSide * easeOutCubic(u)), 0, TAU); ctx.stroke();
      }
      // Sparks live in world space around the origin and go through the live camera:
      // p(t) = dir v (1 - e^(-k t)) / k. The trail spans the last SPARK_TRAIL seconds, so its
      // length follows the current speed v e^(-k t) and the bloom softens as it opens. It is
      // drawn as three segments of falling alpha and width, with a bright dot at the head.
      const n = narrow ? SPARK_COUNT_NARROW : SPARK_COUNT;
      const vMax = SPARK_SPEED_MAX / sMax;   // world units per second at the ignition scale
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const life = sparkLife[i]; if (age >= life) continue;
        const reach = sparkSpeed[i] * vMax / SPARK_DRAG;
        const fade = 1 - age / life;
        const a = fade * fade * Math.min(1, age * 30) * layer;
        if (a < 0.01) continue;
        ctx.strokeStyle = SPARK_STROKES[sparkTone[i]];
        let hx = 0; let hy = 0; let px = 0; let py = 0;
        for (let k = 0; k <= 3; k++) {
          const d = reach * (1 - Math.exp(-SPARK_DRAG * Math.max(0, age - SPARK_TRAIL * k / 3)));
          if (!project(sparkDX[i] * d, sparkDY[i] * d, sparkDZ[i] * d)) break;
          if (k === 0) { hx = PX; hy = PY; }
          else {
            ctx.globalAlpha = a * (k === 1 ? 0.9 : k === 2 ? 0.45 : 0.18); ctx.lineWidth = k === 1 ? 1.3 : k === 2 ? 0.95 : 0.6;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(PX, PY); ctx.stroke();
          }
          px = PX; py = PY;
        }
        ctx.globalAlpha = a; ctx.fillStyle = SPARK_STROKES[sparkTone[i]];
        ctx.fillRect(hx - 0.9, hy - 0.9, 1.8, 1.8);
        // Glitter: a brief twinkle in the last third of life.
        if (sparkGlitter[i]) {
          const f = age / life;
          if (f > 0.62 && f < 0.92) {
            ctx.globalAlpha = 0.9 * Math.sin(Math.PI * (f - 0.62) / 0.3) * layer;
            ctx.drawImage(sprites.white, hx - 5, hy - 5, 10, 10);
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---- Drawing: the research spiral (opening and chart) ---------------- */
    function projectAt(theta, radiusScale) {
      const r = radiusAt(theta) * radiusScale;
      return project(r * Math.cos(theta), r * Math.sin(theta), 0);
    }
    function drawScene(time, chart, layer) {
      const head = chart ? THETA_STOP : headTheta(time);
      const done = chart ? 1 : 0;
      const theme = chart ? selectedTheme : -1;
      // In core view (and while flying in or out) only the starfield, the bulge and the text
      // spiral remain: the research layers fade out by the middle of the flight.
      const research = layer * (1 - smooth(coreU / 0.5));
      drawStars(layer);
      applyCollapse();
      // Project every sample up to the head.
      const last = Math.min(SAMPLE_COUNT - 1, Math.floor((head - THETA_IN) / D_THETA));
      for (let i = 0; i <= last; i++) {
        project(SAMPLE_X[i], SAMPLE_Y[i], 0);
        sampleSX[i] = PX; sampleSY[i] = PY; sampleDepth[i] = depthFactor(PZ);
      }
      projectAt(head, 1); const headX = PX; const headY = PY;
      if (chart) drawCoreText(time, layer);
      // A soft core bulge at the origin, lit by the ignition and kept in the chart.
      const bulge = (done || smooth(span(time, [T_HEAD[0], T_HEAD[0] + 0.6]))) * BULGE.alpha * layer;
      if (bulge > 0 && project(0, 0, 0)) {
        // The sprite's visible core is about 0.6 of its extent; its radius is capped on screen
        // (and shrinks in core view, so the page reads clearly).
        const radius = 1.6 * Math.min(BULGE.radius * focal / camDist, BULGE.maxPx) * (1 - 0.6 * easeInOutCubic(coreU));
        const squash = 0.55 + 0.45 * cPitch;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = bulge;
        ctx.drawImage(sprites.bulge, PX - radius, PY - radius * squash, radius * 2, radius * 2 * squash);
        ctx.globalCompositeOperation = 'source-over';
      }
      // Stardust: the galaxy body behind the head, each mote fading in over 0.3 s once passed.
      const dustN = narrow ? DUST_COUNT_NARROW : DUST_COUNT;
      ctx.globalCompositeOperation = 'source-over';
      for (let tone = 0; tone < DUST_FILLS.length; tone++) {
        ctx.fillStyle = DUST_FILLS[tone];
        const dim = theme >= 0 && tone > 0 && tone - 1 !== theme ? 0.4 : 1;
        for (let i = 0; i < dustN; i++) {
          if (dustTone[i] !== tone || dustKnot[i]) continue;
          const seen = done || clamp01((time - dustAt[i]) / 0.3);
          if (seen <= 0 || !project(dustX[i], dustY[i], dustZ[i]) || PX < -4 || PX > W + 4 || PY < -4 || PY > H + 4) continue;
          const size = dustSize[i];
          ctx.globalAlpha = dustAlpha[i] * seen * depthFactor(PZ) * dim * (size > 1 ? research : layer);
          ctx.fillRect(PX - size / 2, PY - size / 2, size, size);
        }
      }
      for (let i = 0; i < dustN && research > 0.004; i++) {
        if (!dustKnot[i]) continue;
        const seen = done || clamp01((time - dustAt[i]) / 0.3);
        if (seen <= 0 || !project(dustX[i], dustY[i], dustZ[i]) || PX < -8 || PX > W + 8 || PY < -8 || PY > H + 8) continue;
        const dim = theme >= 0 && dustTone[i] > 0 && dustTone[i] - 1 !== theme ? 0.4 : 1;
        ctx.globalAlpha = dustAlpha[i] * seen * depthFactor(PZ) * dim * research;
        const size = dustSize[i] * 1.6;
        ctx.drawImage(dustTone[i] ? sprites.themeDots[dustTone[i] - 1] : sprites.cool, PX - size / 2, PY - size / 2, size, size);
      }
      // Year axis (growing with the head), sector spokes and year ticks.
      const axis = done || smooth(span(time, T_AXIS));
      ctx.lineWidth = 1;
      if (axis > 0 && research > 0.004) {
        const reach = Math.min(AXIS_RADII[1], radiusAt(head) * 1.08);
        ctx.setLineDash(DASH_AXIS); ctx.strokeStyle = MUTED_COLOUR; ctx.globalAlpha = 0.22 * axis * research;
        ctx.beginPath();
        project(AXIS_RADII[0] * Math.cos(THETA0), AXIS_RADII[0] * Math.sin(THETA0), 0); ctx.moveTo(PX, PY);
        project(reach * Math.cos(THETA0), reach * Math.sin(THETA0), 0); ctx.lineTo(PX, PY);
        ctx.stroke();
      }
      const spokes = done || smooth(span(time, T_SPOKES));
      if (spokes > 0 && research > 0.004) {
        ctx.setLineDash(DASH_SPOKE);
        for (let j = 0; j < THEMES.length; j++) {
          const a = sectorCentre(j); const emphasis = theme < 0 ? 0.2 : theme === j ? 0.55 : 0.06;
          ctx.strokeStyle = THEME_RGBA[j]; ctx.globalAlpha = emphasis * spokes * research;
          ctx.beginPath();
          project(SPOKE_RADII[0] * Math.cos(a), SPOKE_RADII[0] * Math.sin(a), 0); ctx.moveTo(PX, PY);
          project(SPOKE_RADII[1] * Math.cos(a), SPOKE_RADII[1] * Math.sin(a), 0); ctx.lineTo(PX, PY);
          ctx.stroke();
        }
      }
      ctx.setLineDash(NO_DASH);
      if (research > 0.004) drawYearTicks(time, chart, research);
      // The curve: one soft 3 px pass, then chunks that are thinner and dimmer on the inner
      // turns and brightest on the outermost written turn, with alpha following depth.
      const solidLast = Math.min(last, INDEX_END);
      const solidHead = head <= THETA_END;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = CURVE_COLOUR;
      ctx.lineWidth = 3; ctx.globalAlpha = 0.06 * research;
      if (last >= INDEX_2022 && research > 0.004) {
        ctx.beginPath(); ctx.moveTo(sampleSX[INDEX_2022], sampleSY[INDEX_2022]);
        for (let i = INDEX_2022 + 1; i <= solidLast; i++) ctx.lineTo(sampleSX[i], sampleSY[i]);
        if (solidHead) ctx.lineTo(headX, headY);
        ctx.stroke();
      }
      for (let c = 0; c <= solidLast && research > 0.004; c += CURVE_CHUNK) {
        const end = Math.min(c + CURVE_CHUNK, solidLast); const mid = (c + end) >> 1;
        const weight = clamp01(mid / INDEX_END);
        const tail = mid < INDEX_2022 ? 0.6 : 1;
        ctx.lineWidth = lerp(0.55, 1.15, weight);
        ctx.globalAlpha = lerp(0.24, 0.66, Math.pow(weight, 1.4)) * sampleDepth[mid] * tail * research;
        ctx.beginPath(); ctx.moveTo(sampleSX[c], sampleSY[c]);
        for (let i = c + 1; i <= end; i++) ctx.lineTo(sampleSX[i], sampleSY[i]);
        if (end === solidLast && solidHead) ctx.lineTo(headX, headY);
        ctx.stroke();
        if (end === solidLast) break;
      }
      // A selected paper's path, "the road here": a thin stroke in its theme colour whose alpha
      // grows along the spiral from the inner start to just before the paper.
      if (chart && pathPaper >= 0 && pathAlpha > 0.005 && research > 0.004) {
        const paper = PAPERS[pathPaper];
        const end = Math.min(last, Math.floor((paper.theta - THETA_IN) / D_THETA));
        project(paper.x, paper.y, 0); const ex = PX; const ey = PY;
        ctx.strokeStyle = THEME_RGBA[paper.theme]; ctx.lineWidth = PATH_WIDTH;
        for (let c = 0; c <= end; c += PATH_CHUNK) {
          const stop = Math.min(c + PATH_CHUNK, end);
          ctx.globalAlpha = lerp(PATH_ALPHA[0], PATH_ALPHA[1], ((c + stop) / 2) / Math.max(1, end)) * pathAlpha * research;
          ctx.beginPath(); ctx.moveTo(sampleSX[c], sampleSY[c]);
          for (let i = c + 1; i <= stop; i++) ctx.lineTo(sampleSX[i], sampleSY[i]);
          if (stop === end) ctx.lineTo(ex, ey);
          ctx.stroke();
          if (stop === end) break;
        }
      }
      // The unwritten turn: dashed, fading to nothing where the head comes to rest.
      ctx.lineWidth = 1;
      if (head > THETA_END && research > 0.004) {
        ctx.setLineDash(DASH_FUTURE);
        const total = THETA_STOP - THETA_END;
        for (let c = INDEX_END; c <= last; c += 12) {
          const end = Math.min(c + 12, last); const mid = (c + end) >> 1;
          const along = (THETA_IN + mid * D_THETA - THETA_END) / total;
          ctx.globalAlpha = FUTURE_ALPHA * (1 - along) * sampleDepth[mid] * research;
          ctx.beginPath(); ctx.moveTo(sampleSX[c], sampleSY[c]);
          for (let i = c + 1; i <= end; i++) ctx.lineTo(sampleSX[i], sampleSY[i]);
          if (end === last) ctx.lineTo(headX, headY);
          ctx.stroke();
          if (end === last) break;
        }
        ctx.setLineDash(NO_DASH);
      }
      if (!chart) drawComet(time, head, headX, headY, layer);
      drawPapers(time, chart, research);
      if (chart && centreHover && coreU <= 0 && project(0, 0, 0)) {
        // The centre is selectable: a quiet ring while it is hovered or focused.
        ctx.globalAlpha = 0.4 * layer; ctx.strokeStyle = CURVE_COLOUR; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(PX, PY, 15, 0, TAU); ctx.stroke();
      }
      drawNearStars(time, chart, layer);
      drawLabels(time, chart, head, research);
      if (!chart) drawIgnition(time, layer);
    }
    /**
     * The page at the centre: the text spiral (same slots and sprites) lies in the disk at
     * the origin with outer radius CORE_WORLD_R. At that size perspective barely varies, so
     * one affine map serves: the projected disk basis at the origin, b_x and b_y (screen px
     * per world unit). A word at world (wx, wy) sits at O + b_x wx + b_y wy, and its sprite
     * axes are the images of its tangent and normal. At rest it is fine texture (dots).
     */
    function drawCoreText(time, layer) {
      if (!W_N || !project(0, 0, 0)) return;
      const e = easeInOutCubic(coreU);
      const show = smooth(span(time, T_UI)) * lerp(CORE_REST_ALPHA, 1, e) * layer;
      if (show <= 0.01) return;
      const ox = PX; const oy = PY; const step = CORE_WORLD_R;
      project(step, 0, 0); const bxx = (PX - ox) / step; const bxy = (PY - oy) / step;
      project(0, step, 0); const byx = (PX - ox) / step; const byy = (PY - oy) / step;
      const kw = CORE_WORLD_R / spiralR0;   // world units per text-spiral px
      let dots = 0;
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < W_N; i++) {
        const r = wSlotR[i] * kw; const a = wSlotA[i] + coreSpin;
        const wx = r * Math.cos(a); const wy = r * Math.sin(a);
        const x = ox + bxx * wx + byx * wy; const y = oy + bxy * wx + byy * wy;
        if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
        const rho = wSlotRot[i] + coreSpin; const sw = wSlotS[i] * kw;
        const c = Math.cos(rho) * sw; const sn = Math.sin(rho) * sw;
        const ax = bxx * c + byx * sn; const ay = bxy * c + byy * sn;      // image of the sprite's x axis
        const nx = -bxx * sn + byx * c; const ny = -bxy * sn + byy * c;    // ... and of its y axis
        const px = wSize[i] * Math.hypot(ax, ay);
        const asDot = 1 - clamp01((px - DOT_SWITCH_PX) / DOT_BLEND_PX);
        if (asDot > 0) { dotList[dots] = i; dotAlpha[dots] = show * asDot; wX[i] = x; wY[i] = y; dots++; }
        if (asDot >= 1) continue;
        const sa = show * (1 - asDot);
        const warm = wKey[i] >= 0 ? GLINT_TINT : 0;
        setLocal(ax, ay, nx, ny, x, y);
        ctx.globalAlpha = sa * (1 - warm);
        ctx.drawImage(atlases[wNightPage[i]], wNightX[i], wNightY[i], wDevW[i], wDevH[i], -wAnchorX[i], -wAnchorY[i], wSpriteW[i], wSpriteH[i]);
        if (warm) {
          ctx.globalAlpha = sa * warm;
          ctx.drawImage(atlases[wWarmPage[i]], wWarmX[i], wWarmY[i], wDevW[i], wDevH[i], -wAnchorX[i], -wAnchorY[i], wSpriteW[i], wSpriteH[i]);
        }
      }
      resetTransform();
      for (let tone = 0; tone < wordTones.length; tone++) {
        ctx.fillStyle = wordTones[tone];
        for (let d = 0; d < dots; d++) {
          const i = dotList[d]; if (wTone[i] !== tone) continue;
          ctx.globalAlpha = dotAlpha[d]; ctx.fillRect(wX[i] - 0.5, wY[i] - 0.5, 1, 1);
        }
      }
    }
    function drawYearTicks(time, chart, layer) {
      ctx.strokeStyle = MUTED_COLOUR; ctx.lineWidth = 1;
      for (let m = 0; m < YEAR_MARKS.length; m++) {
        const mark = YEAR_MARKS[m];
        const seen = chart ? 1 : smooth((time - mark.at) / 0.3);
        if (seen <= 0) continue;
        projectAt(mark.theta, 0.94); const x0 = PX; const y0 = PY;
        projectAt(mark.theta, 1.07);
        ctx.globalAlpha = 0.45 * seen * layer;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(PX, PY); ctx.stroke();
      }
    }
    function drawComet(time, head, x, y, layer) {
      const show = (1 - smooth(span(time, T_HEAD_FADE))) * layer;
      if (show <= 0 || time < T_HEAD[0]) return;
      // A tapered luminous trail along the last COMET_TRAIL rad of curve: alpha and width
      // fall off towards the tail; then a bright core with a soft glow.
      const steps = 18;
      ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffff';
      let px = x; let py = y;
      for (let j = 1; j <= steps; j++) {
        const theta = head - COMET_TRAIL * j / steps;
        if (theta < THETA_IN) break;
        projectAt(theta, 1);
        const f = 1 - (j - 0.5) / steps;
        ctx.globalAlpha = 0.95 * f * f * show; ctx.lineWidth = 0.3 + 2.3 * f;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(PX, PY); ctx.stroke();
        px = PX; py = PY;
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9 * show; ctx.drawImage(sprites.white, x - 14, y - 14, 28, 28);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = show; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill();
    }
    function drawPapers(time, chart, layer) {
      const theme = chart ? selectedTheme : -1;
      const sparks = narrow ? PAPER_SPARKS_NARROW : PAPER_SPARKS;
      for (let p = 0; p < NP; p++) {
        const paper = PAPERS[p];
        project(paper.x, paper.y, 0);
        paperSX[p] = PX; paperSY[p] = PY; paperZ[p] = PZ;
        const age = chart ? 99 : time - paper.at;
        const onScreen = PX > -60 && PX < W + 60 && PY > -60 && PY < H + 60;
        paperVis[p] = age >= 0 && onScreen ? 1 : 0;
        if (age < 0 || !onScreen) continue;
        const focus = chart && (p === selectedPaper || p === hoverPaper);
        const dim = theme >= 0 && paper.theme !== theme && !focus ? 0.3 : 1;
        const a = depthFactor(PZ) * dim * layer;
        const lit = theme === paper.theme ? 1.25 : 1;
        ctx.globalCompositeOperation = 'lighter';
        const glow = focus ? PAPER_GLOW + 6 : PAPER_GLOW;
        ctx.globalAlpha = Math.min(1, 0.75 * a * lit);
        ctx.drawImage(sprites.themes[paper.theme], PX - glow, PY - glow, glow * 2, glow * 2);
        ctx.globalAlpha = 0.22 * a; ctx.drawImage(sprites.glint, PX - 8, PY - 8, 16, 16);
        // Ignition: a flash, a ring and sparks, all analytic in the star's age.
        if (age < PAPER_FLASH.time) {
          const u = age / PAPER_FLASH.time; const radius = PAPER_FLASH.radius * (0.45 + 0.55 * easeOutCubic(u));
          ctx.globalAlpha = PAPER_FLASH.alpha * (1 - u) * layer;
          ctx.drawImage(sprites.themes[paper.theme], PX - radius, PY - radius, radius * 2, radius * 2);
          ctx.globalAlpha = 0.6 * (1 - u) * (1 - u) * layer;
          ctx.drawImage(sprites.white, PX - radius * 0.4, PY - radius * 0.4, radius * 0.8, radius * 0.8);
        }
        if (age < PAPER_RING.time) {
          const u = age / PAPER_RING.time;
          ctx.globalAlpha = PAPER_RING.alpha * (1 - u) * (1 - u) * layer; ctx.strokeStyle = THEME_RGBA[paper.theme]; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(PX, PY, Math.max(1, PAPER_RING.radius * easeOutCubic(u)), 0, TAU); ctx.stroke();
        }
        if (age < PAPER_SPARK_LIFE[1]) {
          // A quick sparkle: short tapered trails (two segments) that are gone within 0.6 s.
          ctx.strokeStyle = THEME_RGBA[paper.theme]; ctx.lineCap = 'round';
          for (let s = 0; s < sparks; s++) {
            const i = p * PAPER_SPARKS + s; const life = pSparkLife[i]; if (age >= life) continue;
            const reach = pSparkSpeed[i] / PAPER_SPARK_DRAG;
            const d2 = reach * (1 - Math.exp(-PAPER_SPARK_DRAG * age));
            const d1 = reach * (1 - Math.exp(-PAPER_SPARK_DRAG * Math.max(0, age - PAPER_SPARK_TRAIL / 2)));
            const d0 = reach * (1 - Math.exp(-PAPER_SPARK_DRAG * Math.max(0, age - PAPER_SPARK_TRAIL)));
            const fade = 1 - age / life; const a = fade * fade * layer;
            ctx.globalAlpha = a; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(PX + pSparkDX[i] * d1, PY + pSparkDY[i] * d1); ctx.lineTo(PX + pSparkDX[i] * d2, PY + pSparkDY[i] * d2); ctx.stroke();
            ctx.globalAlpha = a * 0.4; ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(PX + pSparkDX[i] * d0, PY + pSparkDY[i] * d0); ctx.lineTo(PX + pSparkDX[i] * d1, PY + pSparkDY[i] * d1); ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, (0.85 + 0.15 * dim) * a + 0.1); ctx.fillStyle = '#f4f7fb';
        ctx.beginPath(); ctx.arc(PX, PY, 1.2, 0, TAU); ctx.fill();
        if (focus) {
          ctx.globalAlpha = 0.85 * layer; ctx.strokeStyle = THEME_RGBA[paper.theme]; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(PX, PY, 9, 0, TAU); ctx.stroke();
        }
      }
    }

    /* ---- Canvas labels: one collision pass ------------------------------- */
    function addObstacle(x0, y0, x1, y1) {
      if (placedCount >= MAX_PLACED) return;
      placed[placedCount * 4] = x0; placed[placedCount * 4 + 1] = y0; placed[placedCount * 4 + 2] = x1; placed[placedCount * 4 + 3] = y1;
      placedCount++;
    }
    function overlapsUI(x, y, w, h) {
      const c = UI_CLEARANCE;
      for (let i = 0; i < uiCount; i++) {
        if (x < ui[i * 4 + 2] + c && x + w > ui[i * 4] - c && y < ui[i * 4 + 3] + c && y + h > ui[i * 4 + 1] - c) return true;
      }
      return false;
    }
    function blocked(x, y, w, h, self) {
      if (x < EDGE_INSET || y < EDGE_INSET || x + w > W - EDGE_INSET || y + h > H - EDGE_INSET) return true;
      if (overlapsUI(x, y, w, h)) return true;
      for (let i = 0; i < placedCount; i++) {
        if (x < placed[i * 4 + 2] && x + w > placed[i * 4] && y < placed[i * 4 + 3] && y + h > placed[i * 4 + 1]) return true;
      }
      if (self < -1) return false;
      // Paper labels never cover another star.
      for (let p = 0; p < NP; p++) {
        if (p === self || !paperVis[p]) continue;
        if (paperSX[p] > x - 4 && paperSX[p] < x + w + 4 && paperSY[p] > y - 3 && paperSY[p] < y + h + 3) return true;
      }
      return false;
    }
    // Labels never pop: each has a visibility that eases towards 1 (placed) or 0 (blocked or
    // filtered out) over about LABEL_TAU, and sliding labels ease to their new spot. Only the
    // primary scene of a frame updates this state; a fading remnant uses it as it stands.
    function easeLabel(current, target) {
      return labelPrimary ? current + (target - current) * labelEase : target;
    }
    function slideLabel(current, target) {
      return labelPrimary ? current + (target - current) * labelSlideEase : target;
    }
    let labelX = 0; let labelY = 0;
    function paperLabelBox(p, focus) {
      const w = (focus ? focusWidth[p] : labelWidth[p]) + 2;
      labelX = paperSX[p] + 9; if (labelX + w > W - EDGE_INSET) labelX = paperSX[p] - 9 - w;
      labelY = paperSY[p] - 7;
    }
    function drawPaperLabel(p, alpha) {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      ctx.fillText(PAPERS[p].name, labelX + 1, paperSY[p]);
    }
    function ghostPose(g, at) {
      // Just inside the unwritten turn, rotated to its projected tangent and kept upright.
      const theta = THETA_END + at * (THETA_STOP - THETA_END);
      projectAt(theta - 0.03, 0.93); const ax = PX; const ay = PY;
      projectAt(theta + 0.03, 0.93); const bx = PX; const by = PY;
      let angle = Math.atan2(by - ay, bx - ax);
      // Readable: never upside down (rotate by pi), and the slot search below rejects steep slots.
      if (angle > Math.PI / 2) angle -= Math.PI; else if (angle < -Math.PI / 2) angle += Math.PI;
      ghostAngle = angle;
      const sprite = ghostSprites[g];
      ghostX = (ax + bx) / 2; ghostY = (ay + by) / 2; ghostCos = Math.cos(angle); ghostSin = Math.sin(angle);
      ghostW = Math.abs(sprite.w * ghostCos) + Math.abs(sprite.h * ghostSin) * 0.6;
      ghostH = Math.abs(sprite.w * ghostSin) + Math.abs(sprite.h * ghostCos) * 0.6;
    }
    let ghostX = 0; let ghostY = 0; let ghostCos = 1; let ghostSin = 0; let ghostW = 0; let ghostH = 0; let ghostAngle = 0;
    /**
     * All canvas text shares one collision pass, in priority order: selected star >
     * hovered star > theme labels > year labels > paper labels (nearer first) > ghost
     * words. Each item is placed only if it clears the viewport inset, the UI blocks (with
     * UI_CLEARANCE) and everything already placed.
     */
    function drawLabels(time, chart, head, layer) {
      placedCount = 0;
      // No labels in core view; they fade out early in the flight towards it.
      layer *= 1 - smooth(coreU * 3);
      if (layer <= 0.004) return;
      // Fades run on time in the chart as well (t keeps counting to T_SETTLED), so the
      // hand-over at T_CHART cannot snap.
      const paperShow = smooth(span(time, T_UI)) * layer;
      ctx.textBaseline = 'middle';
      for (let p = 0; p < NP; p++) paperDone[p] = 0;
      // 1-2. Selected and hovered stars are always named, at once.
      ctx.font = LABEL_FONT; ctx.textAlign = 'left'; ctx.fillStyle = LABEL_COLOUR;
      for (let pass = 0; pass < 2; pass++) {
        const p = pass === 0 ? selectedPaper : hoverPaper;
        if (!chart || p < 0 || !paperVis[p] || paperDone[p]) continue;
        paperDone[p] = 1; if (labelPrimary) paperFade[p] = 1;
        // A focused star is named with its year: "Short name · year".
        paperLabelBox(p, true);
        addObstacle(labelX - 3, labelY - 1, labelX + focusWidth[p] + 5, labelY + 15);
        ctx.globalAlpha = layer; ctx.fillText(FOCUS_LABELS[p], labelX + 1, paperSY[p]);
      }
      // 3. Theme labels, clamped inside the viewport; a blocked label slides along its spoke.
      const themeShow = smooth(span(time, T_THEME_LABELS)) * layer;
      if (themeShow > 0) {
        ctx.font = THEME_FONT; ctx.textAlign = 'center';
        if (nativeSpacing) ctx.letterSpacing = '1.6px';
        const theme = chart ? selectedTheme : -1;
        for (let j = 0; j < THEMES.length; j++) {
          const a = sectorCentre(j); const half = themeWidth[j] / 2 + 2;
          let found = NaN;
          for (let k = 0; k < THEME_SLIDE.length && Number.isNaN(found); k++) {
            const r = THEME_LABEL_RADII[j] + THEME_SLIDE[k];
            project(r * Math.cos(a), r * Math.sin(a), 0);
            const x = clamp(PX, EDGE_INSET + half, W - EDGE_INSET - half); const y = clamp(PY, EDGE_INSET + 8, H - EDGE_INSET - 8);
            if (!blocked(x - half, y - 7, half * 2, 14, -2)) found = THEME_SLIDE[k];
          }
          const placedHere = !Number.isNaN(found);
          if (placedHere && labelPrimary) themeOffset[j] = themeFade[j] < 0.02 ? found : slideLabel(themeOffset[j], found);
          const fade = labelPrimary ? (themeFade[j] = easeLabel(themeFade[j], placedHere ? 1 : 0)) : placedHere ? 1 : 0;
          if (fade <= 0.01) continue;
          const r = THEME_LABEL_RADII[j] + (labelPrimary ? themeOffset[j] : found);
          project(r * Math.cos(a), r * Math.sin(a), 0);
          const x = clamp(PX, EDGE_INSET + half, W - EDGE_INSET - half); const y = clamp(PY, EDGE_INSET + 8, H - EDGE_INSET - 8);
          if (placedHere) addObstacle(x - half - 4, y - 8, x + half + 4, y + 8);
          ctx.globalAlpha = 0.8 * themeShow * fade * (theme < 0 || theme === j ? 1 : 0.3) * depthFactor(PZ);
          ctx.fillStyle = THEME_RGBA[j];
          ctx.fillText(THEME_LABELS[j], x, y);
        }
        if (nativeSpacing) ctx.letterSpacing = '0px';
      }
      // 4. Year labels at each year's start, just outside the curve beside the year axis.
      ctx.font = YEAR_FONT;
      for (let m = 0; m < YEAR_MARKS.length; m++) {
        const mark = YEAR_MARKS[m];
        const seen = smooth((time - mark.at) / 0.3) * layer;
        if (seen <= 0) continue;
        projectAt(mark.theta - 0.05, 1.1); const tx = PX; const ty = PY;
        projectAt(mark.theta, 1.1); const lx = PX; const ly = PY;
        let ux = tx - lx; let uy = ty - ly; const len = Math.hypot(ux, uy) || 1; ux /= len; uy /= len;
        const right = ux < 0; const x = lx + ux * 6; const y = ly + uy * 6; const w = yearWidth[m];
        const x0 = right ? x - w : x;
        const placedHere = !blocked(x0 - 2, y - 7, w + 4, 14, -2);
        const fade = labelPrimary ? (yearFade[m] = easeLabel(yearFade[m], placedHere ? 1 : 0)) : placedHere ? 1 : 0;
        if (placedHere) addObstacle(x0 - 3, y - 7, x0 + w + 3, y + 7);
        if (fade <= 0.01) continue;
        ctx.textAlign = right ? 'right' : 'left';
        ctx.globalAlpha = 0.85 * seen * fade; ctx.fillStyle = m === YEAR_MARKS.length - 1 ? LABEL_COLOUR : MUTED_COLOUR;
        ctx.fillText(mark.label, x, y);
      }
      // 5. Paper labels: the selected theme's, else all; nearer stars first (at most 23 sorted).
      ctx.font = LABEL_FONT; ctx.textAlign = 'left'; ctx.fillStyle = LABEL_COLOUR;
      let count = 0;
      for (let p = 0; p < NP; p++) {
        if (!paperVis[p] || paperDone[p]) continue;
        if (chart && selectedTheme >= 0 && PAPERS[p].theme !== selectedTheme) continue;
        labelScore[p] = -paperZ[p];
        let k = count++;
        while (k > 0 && labelScore[labelOrder[k - 1]] < labelScore[p]) { labelOrder[k] = labelOrder[k - 1]; k--; }
        labelOrder[k] = p;
      }
      for (let k = 0; k < count; k++) {
        const p = labelOrder[k]; paperDone[p] = 1;
        paperLabelBox(p);
        const placedHere = paperShow > 0 && !blocked(labelX, labelY, labelWidth[p] + 2, 14, p);
        if (placedHere) addObstacle(labelX - 3, labelY - 1, labelX + labelWidth[p] + 5, labelY + 15);
        const fade = labelPrimary ? (paperFade[p] = easeLabel(paperFade[p], placedHere ? 1 : 0)) : placedHere ? 1 : 0;
        drawPaperLabel(p, 0.75 * paperShow * fade);
      }
      // Labels that are no longer candidates fade out where they are.
      for (let p = 0; p < NP; p++) {
        if (paperDone[p]) continue;
        const fade = labelPrimary ? (paperFade[p] = easeLabel(paperFade[p], 0)) : 0;
        if (fade <= 0.01 || !paperVis[p]) continue;
        paperLabelBox(p); drawPaperLabel(p, 0.75 * paperShow * fade);
      }
      // 6. Ghost words: each slides along the unwritten turn from its preferred place
      // (alternately later and earlier) to the first free position, or fades out.
      const ghostShow = smooth(span(time, T_GHOST)) * layer;
      if (ghostShow > 0 && ghostSprites && head > THETA_END) {
        const reveal = (head - THETA_END) / (THETA_STOP - THETA_END);
        for (let o = 0; o < GHOST_ORDER.length; o++) {
          const g = GHOST_ORDER[o];
          let found = NaN;
          for (let k = 0; k < GHOST_SLIDE_STEPS && Number.isNaN(found); k++) {
            const at = GHOST_AT[g] + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * GHOST_SLIDE;
            if (at < 0.04 || at > 0.97 || at > reveal) continue;
            ghostPose(g, at);
            if (Math.abs(ghostAngle) > GHOST_MAX_TILT) continue;
            if (!blocked(ghostX - ghostW / 2, ghostY - ghostH / 2, ghostW, ghostH, -2)) found = at;
          }
          const placedHere = !Number.isNaN(found);
          if (placedHere && labelPrimary) ghostAt[g] = ghostFade[g] < 0.02 ? found : slideLabel(ghostAt[g], found);
          const fade = labelPrimary ? (ghostFade[g] = easeLabel(ghostFade[g], placedHere ? 1 : 0)) : placedHere ? 1 : 0;
          if (fade <= 0.01) continue;
          ghostPose(g, labelPrimary ? ghostAt[g] : found);
          if (placedHere) addObstacle(ghostX - ghostW / 2, ghostY - ghostH / 2, ghostX + ghostW / 2, ghostY + ghostH / 2);
          const sprite = ghostSprites[g];
          setLocal(ghostCos, ghostSin, -ghostSin, ghostCos, ghostX, ghostY);
          ctx.globalAlpha = GHOST_ALPHA * ghostShow * fade * (1 - 0.35 * GHOST_AT[g]);
          ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
        }
        resetTransform();
      }
    }

    /* ---- Frames ---------------------------------------------------------- */
    function phaseAt(time) {
      return time < T_DUSK ? 'dusk' : time < T_WIND ? 'gather' : time < T_IGNITE ? 'wind' : time < T_CHART ? 'ignite' : 'chart';
    }
    function setPhase(name) {
      if (phase === name) return;
      phase = name; dialog.dataset.phase = name;
    }
    function setOpacity(el, value) {
      value = Math.round(clamp01(value) * 1000) / 1000;
      if (uiOpacity.get(el) === value) return;
      uiOpacity.set(el, value);
      if (value >= 1) el.style.removeProperty('opacity'); else el.style.opacity = String(value);
    }
    function renderOpening(time, layer) {
      const dusk = time < T_DUSK;
      const radius = dusk ? apertureRadius(time) : 0; const edge = edgeOf(radius);
      openingCamera(time);
      if (dusk) drawAperture(radius, edge, layer);
      if (time < T_IGNITE) {
        if (dusk) drawStars(layer, radius, edge); else drawStars(layer);
        applyCollapse();
        drawSpiralDots(time, layer);
        const collapsed = dusk ? drawWords(time, layer, radius, edge) : drawWords(time, layer);
        drawCore(time, collapsed, layer);
      } else drawScene(time, false, layer);
    }
    function renderWordsAtStart(layer) {
      openingCamera(0);
      drawWords(0, layer, apertureRadius(0), edgeOf(0));
    }
    function render(now) {
      setBase(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.setLineDash(NO_DASH);
      ctx.clearRect(0, 0, W, H);
      if (mode === 'closing') { renderClosing(); return; }
      if (mode === 'opening') { renderOpening(t, 1); return; }
      if (mode === 'replay-out') {
        const u = clamp01((now - replayStart) / REPLAY_FADE_MS);
        chartCamera(); drawScene(T_SETTLED, true, 1 - u);
        renderWordsAtStart(u);
        return;
      }
      const u = skipStart >= 0 ? clamp01((now - skipStart) / SKIP_FADE_MS) : 1;
      if (u < 1 && remnantT >= 0) { labelPrimary = false; renderOpening(remnantT, 1 - u); labelPrimary = true; }
      if (motion.matches) updatePath(0);
      chartCamera(); drawScene(t, true, u);
    }

    function frame(now) {
      raf = 0;
      if (closed || (leaving && mode !== 'closing')) return;
      if (document.hidden) { lastNow = 0; return; }
      const real = lastNow ? Math.max(0, now - lastNow) / 1000 : 0;
      lastNow = now;
      const dt = Math.min(real, 1 / 30);
      step(dt, now);
      labelEase = motion.matches ? 1 : 1 - Math.exp(-dt / LABEL_TAU);
      labelSlideEase = motion.matches ? 1 : 1 - Math.exp(-dt / LABEL_SLIDE_TAU);
      if (ctx && !closed) {
        const began = performance.now();
        if (mode === 'chart' || mode === 'closing') {
          try { render(now); } catch (error) { console.warn('The spiral could not be drawn.', error); cleanup(); return; }
        } else {
          // remnantT = -2 asks skip() not to redraw the failing opening as a remnant.
          try { render(now); } catch (error) { console.warn('The spiral opening was interrupted.', error); remnantT = -2; skip(); }
        }
        record(performance.now() - began);
      }
      labelEase = 1; labelSlideEase = 1;   // renders outside the frame loop (on demand) settle labels at once
      schedule();
    }
    function record(ms) {
      const entry = stats.byPhase[phase === 'chart' && (coreU > 0 || coreTarget) ? 'core' : phase] || stats.byPhase.chart;
      entry.frames++; entry.avgMs += (ms - entry.avgMs) / entry.frames; entry.maxMs = Math.max(entry.maxMs, ms);
      stats.frames++; stats.avgMs += (ms - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, ms);
    }
    function step(dt, now) {
      if (mode === 'closing') {
        closeT += dt * timeScale;
        const fade = 1 - smooth(span(closeT, CLOSE_UI));
        for (const [el, from] of closeUIFrom) setOpacity(el, from * fade);
        if (closeT >= (closeKind === 'dusk' ? CLOSE_DUSK : CLOSE_TOTAL)) cleanup();
        return;
      }
      if (mode === 'opening') {
        t += dt * timeScale;
        setPhase(phaseAt(t));
        if (t >= T_DUSK && !dialog.classList.contains('is-night')) dialog.classList.add('is-night');
        // The radial lift of the chart's night arrives with the chart UI, never during the opening.
        if (t >= T_UI[0] && !dialog.classList.contains('is-lift')) dialog.classList.add('is-lift');
        setOpacity(openingEl, smooth(span(t, T_CONTROLS_IN)) * (1 - smooth(span(t, T_CONTROLS_OUT))));
        setOpacity(headEl, smooth(span(t, T_MOTTO)));
        const fade = smooth(span(t, T_UI));
        for (const el of chartBlocks) setOpacity(el, fade);
        if (t >= T_CHART) enterChart(false);
        return;
      }
      if (mode === 'replay-out') {
        const u = clamp01((now - replayStart) / REPLAY_FADE_MS);
        setOpacity(headEl, 1 - u);
        for (const el of chartBlocks) setOpacity(el, 1 - u);
        if (u >= 1) beginOpening();
        return;
      }
      // Chart
      if (t < T_SETTLED) {
        t = Math.min(T_SETTLED, t + dt * timeScale);
        const fade = smooth(span(t, T_UI));
        setOpacity(headEl, smooth(span(t, T_MOTTO)));
        for (const el of chartBlocks) setOpacity(el, skipStart >= 0 ? 1 : fade);
      }
      if (skipStart >= 0) {
        const u = clamp01((now - skipStart) / SKIP_FADE_MS);
        setOpacity(headEl, u); for (const el of chartBlocks) setOpacity(el, u);
        if (u >= 1) {
          skipStart = -1; remnantT = -1;
          dialog.classList.remove('is-fading-skip');
          setOpacity(headEl, 1); for (const el of chartBlocks) setOpacity(el, 1);
        }
      }
      updatePath(dt);
      if (coreTarget !== coreU) coreU = motion.matches ? coreTarget : clamp01(coreU + (coreTarget ? 1 : -1) * dt / CORE_FLIGHT);
      if (coreTarget && !motion.matches) coreSpin += CORE_SPIN * dt;
      if (coreU > 0) return;   // the chart camera is held while the core is open
      if (!motion.matches) {
        if (drag.id < 0 && (vYaw || vPitch)) {
          yaw += vYaw * dt; pitch = clamp(pitch + vPitch * dt, PITCH_RANGE[0], PITCH_RANGE[1]);
          const decay = Math.exp(-dt / INERTIA_TAU); vYaw *= decay; vPitch *= decay;
          if (Math.abs(vYaw) < 1e-3 && Math.abs(vPitch) < 1e-3) { vYaw = 0; vPitch = 0; }
        }
        if (performance.now() - lastInteraction > IDLE_DELAY_MS) yaw += DRIFT * dt;
        zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt / ZOOM_TAU));
        if (Math.abs(zoom - zoomTarget) < 1e-4) zoom = zoomTarget;
      } else zoom = zoomTarget;
    }
    function updatePath(dt) {
      // The path fades in over PATH_FADE for a newly selected paper and out on deselect.
      if (selectedPaper >= 0 && pathPaper !== selectedPaper) { pathPaper = selectedPaper; pathAlpha = 0; }
      const target = selectedPaper >= 0 ? 1 : 0;
      pathAlpha = motion.matches ? target : clamp01(pathAlpha + (target ? 1 : -1) * dt / PATH_FADE);
      if (!pathAlpha && !target) pathPaper = -1;
    }
    function needsFrame() {
      if (closed || !ctx) return false;
      if (mode === 'closing') return true;
      if (leaving) return false;
      if (mode !== 'chart') return true;
      return skipStart >= 0 || t < T_SETTLED || !motion.matches;
    }
    function schedule() {
      if (!raf && !document.hidden && needsFrame()) raf = requestAnimationFrame(frame);
    }
    function redraw() {
      // On-demand repaint (reduced motion keeps no running loop).
      if (!ctx || closed || leaving) return;
      if (needsFrame()) { schedule(); return; }
      if (!raf) raf = requestAnimationFrame(now => {
        raf = 0;
        if (closed || leaving) return;
        const began = performance.now();
        try { render(now); } catch (error) { console.warn('The spiral could not be drawn.', error); cleanup(); return; }
        record(performance.now() - began);
      });
    }

    /* ---- Mode changes ---------------------------------------------------- */
    function setInert(value) {
      for (const el of inertBlocks) el.inert = value;
    }
    function beginOpening() {
      mode = 'opening'; t = 0; phase = ''; setPhase('dusk');
      replayStart = -1; skipStart = -1; remnantT = -1;
      dialog.classList.remove('is-fading-replay', 'is-fading-skip', 'is-night', 'is-lift');
      setInert(true);
      openingEl.hidden = false; dialog.setAttribute('data-quiet', '');
      setOpacity(openingEl, 0); setOpacity(headEl, 0); for (const el of chartBlocks) setOpacity(el, 0);
      skipButton.focus({ preventScroll: true });
    }
    function enterChart(atRest) {
      const wasOpening = mode !== 'chart';
      mode = 'chart'; setPhase('chart');
      if (atRest) { yaw = YAW_REST; pitch = restPitch; }
      else { yaw = yawAt(T_CHART); pitch = restPitch; }
      zoom = 1; zoomTarget = 1; vYaw = 0; vPitch = 0;
      dialog.classList.add('is-night', 'is-lift');
      setInert(false);
      openingEl.hidden = true;
      if (wasOpening && (!dialog.contains(document.activeElement) || openingEl.contains(document.activeElement) || document.activeElement === dialog)) {
        closeButton.focus({ preventScroll: true });
      }
      measureUI();
    }
    function skip() {
      if (mode === 'chart' || closed || leaving) return;
      const instant = motion.matches || !ctx;
      remnantT = !instant && mode === 'opening' && remnantT !== -2 ? t : -1;
      replayStart = -1;
      dialog.classList.remove('is-fading-replay');
      enterChart(true);
      t = T_SETTLED;
      if (instant) {
        skipStart = -1; remnantT = -1;
        setOpacity(headEl, 1); for (const el of chartBlocks) setOpacity(el, 1);
      } else {
        skipStart = performance.now();
        dialog.classList.add('is-fading-skip');
      }
      closeButton.focus({ preventScroll: true });
      announce('The research spiral is ready.');
      if (instant) redraw(); else schedule();
    }
    function replay() {
      if (mode !== 'chart' || motion.matches || !ctx || closed || leaving) return;
      let captured = [];
      try { captured = captureWords(); prepareWords(captured); } catch (error) { console.warn('The page could not be gathered again.', error); releaseWords(); }
      html.classList.add('spira-hide-text');
      setIndex(false);
      mode = 'replay-out'; replayStart = performance.now(); skipStart = -1; remnantT = -1;
      setInert(true);
      dialog.classList.remove('is-fading-skip', 'is-night', 'is-lift'); dialog.classList.add('is-fading-replay');
      if (drag.id >= 0) endDrag(true);
      lastNow = 0; schedule();
    }

    /* ---- Close and restore ----------------------------------------------- */
    function cleanup() {
      if (closed) return;
      closed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      events.abort();
      html.classList.remove('spira-hide-text');
      releaseWords();
      try { if (dialog.open) dialog.close(); } catch (error) { /* already closed */ }
      dialog.remove();
      if (overflow) body.style.setProperty('overflow', overflow, overflowPriority);
      else body.style.removeProperty('overflow');
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      if (scrollX !== scroll.x || scrollY !== scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      active = false;
    }
    /**
     * Close as a bookend: the page's glyphs return first, underneath. From the dusk the iris
     * simply reverses; later, the UI fades, the galaxy collapses into its origin (an
     * accelerating scale-down with some spin, as the wind did) while the iris of night closes
     * on that point, so the page reappears from the edges inward. A second request, a hidden
     * tab, reduced motion or pagehide finish at once; restoration happens only at the end.
     */
    function close() {
      if (closed) return;
      if (leaving) { cleanup(); return; }
      html.classList.remove('spira-hide-text');
      if (motion.matches || !ctx || document.hidden) { cleanup(); return; }
      leaving = true;
      if (drag.id >= 0) endDrag(true);
      closeT = 0; closeFromMode = mode === 'opening' ? 'opening' : 'chart'; closeFromT = mode === 'replay-out' ? T_SETTLED : t;
      if (mode === 'opening' && t < T_DUSK) {
        closeKind = 'dusk'; closeR0 = apertureRadius(t);
      } else {
        closeKind = 'galaxy';
        if (closeFromMode === 'opening' && closeFromT < T_IGNITE) { closeX = W / 2; closeY = H / 2; }
        else {
          if (closeFromMode === 'opening') openingCamera(closeFromT); else chartCamera();
          project(0, 0, 0); closeX = PX; closeY = PY;
        }
        closeCover = Math.max(Math.hypot(closeX, closeY), Math.hypot(W - closeX, closeY), Math.hypot(closeX, H - closeY), Math.hypot(W - closeX, H - closeY)) + EDGE_MAX;
        closeExtent = Math.max(W, H);
        closeLift = dialog.classList.contains('is-lift') ? 1 : 0;
        if (closeLift && !liftSprite) liftSprite = buildLift();
      }
      closeUIFrom.clear();
      for (const el of [headEl, ...chartBlocks, indexEl, openingEl]) closeUIFrom.set(el, uiOpacity.has(el) ? uiOpacity.get(el) : 1);
      mode = 'closing'; setPhase('closing');
      stage.inert = true; centreButton.inert = true;
      // The canvas takes over the night in the same paint as the dialog's background leaves.
      dialog.classList.add('is-closing');
      if (raf) cancelAnimationFrame(raf);
      raf = 0; lastNow = 0;
      try { render(performance.now()); } catch (error) { cleanup(); return; }
      schedule();
    }
    function buildLift() {
      // The CSS lift of the chart's night, painted once at quarter resolution, so the canvas
      // can stand in for the dialog background while the iris closes.
      const w = Math.max(1, Math.ceil(W / 4)); const h = Math.max(1, Math.ceil(H / 4));
      const c = makeCanvas(w, h); const g = c.getContext('2d');
      const stack = (W < 900 && H >= 560) || W < 600;
      const rx = (stack ? 0.8 : 0.55) * W / 4; const ry = (stack ? 0.5 : 0.62) * H / 4;
      g.setTransform(rx, 0, 0, ry, chartX / 4, chartY / 4);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, 'rgba(36,54,86,0.22)'); grad.addColorStop(0.72, 'rgba(36,54,86,0)');
      g.fillStyle = grad; g.fillRect(-chartX / rx * 0.25 - 4, -chartY / ry * 0.25 - 4, W / rx + 8, H / ry + 8);
      return c;
    }
    function applyCollapse() {
      if (!collapseOn) return;
      const c = Math.cos(collapsePhi) * collapseK; const sn = Math.sin(collapsePhi) * collapseK;
      // Scale and turn about the origin's screen position.
      setBase(c, sn, -sn, c, closeX - (c * closeX - sn * closeY), closeY - (sn * closeX + c * closeY));
    }
    function renderClosing() {
      if (closeKind === 'dusk') {
        const u = clamp01(closeT / CLOSE_DUSK);
        const radius = lerp(closeR0, -EDGE_MIN, easeInOutSine(u)); const edge = edgeOf(Math.max(0, radius));
        openingCamera(closeFromT);
        drawAperture(radius, edge, 1);
        drawStars(1, radius, edge);
        drawWords(closeFromT, 1, radius, edge, true);
        return;
      }
      const u = span(closeT, CLOSE_COLLAPSE); const e = easeInCubic(u);
      // The canvas stands in for the night: flat night, plus the chart's lift if it was shown.
      ctx.globalAlpha = 1; ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
      if (closeLift && liftSprite) ctx.drawImage(liftSprite, 0, 0, W, H);
      collapseK = Math.exp(-Math.log(closeExtent / 1.5) * e); collapsePhi = CLOSE_TURNS * TAU * e; collapseOn = true;
      if (closeFromMode === 'opening') renderOpening(closeFromT, 1);
      else { chartCamera(); drawScene(t, true, 1); }
      collapseOn = false; setBase(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash(NO_DASH);
      // The iris closes on the origin: everything outside it is cut back to the page.
      const radius = lerp(closeCover, -EDGE_MIN, easeInOutSine(u));
      drawAperture(radius, edgeOf(Math.max(0, radius)), 1, closeX, closeY, true);
      // The last point of light: a tiny glint where the iris closes.
      const g = span(closeT, CLOSE_GLINT);
      if (g > 0 && g < 1) {
        const a = Math.sin(Math.PI * g);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        ctx.drawImage(sprites.glint, closeX - 11, closeY - 11, 22, 22);
        ctx.drawImage(sprites.white, closeX - 6, closeY - 6, 12, 12);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    /* ---- Plate, themes, index -------------------------------------------- */
    function announce(text) { statusEl.textContent = text; }
    function element(tag, className, text) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function updatePlate() {
      plateDetail.replaceChildren();
      const detail = coreTarget === 1 || selectedPaper >= 0 || selectedTheme >= 0;
      plateDefault.hidden = detail; plateDetail.hidden = !detail;
      if (coreTarget === 1) {
        const back = element('button', 'spira-back', COPY.backOut); back.type = 'button';
        on(back, 'click', backOut);
        plateDetail.append(element('p', 'spira-plate-kicker', COPY.coreKicker), element('h3', 'spira-plate-title', COPY.coreTitle),
          element('p', 'spira-core-text', COPY.coreText), back);
        announce(`${COPY.coreKicker}. ${COPY.coreTitle}`);
      } else if (selectedPaper >= 0) {
        const p = PAPERS[selectedPaper];
        const link = element('a', 'spira-link', 'Read the paper page →'); link.href = paperURL(p.slug);
        plateDetail.append(element('p', 'spira-plate-kicker', `${p.year} · ${THEMES[p.theme].label}`),
          element('h3', 'spira-plate-title', p.title), element('p', 'spira-venue', p.venue), link);
        announce(`${p.name}, ${p.year}, ${THEMES[p.theme].label}.`);
      } else if (selectedTheme >= 0) {
        const theme = THEMES[selectedTheme];
        plateDetail.append(element('p', 'spira-plate-kicker', theme.label), element('h3', 'spira-plate-title', theme.question));
        for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
          const papers = PAPERS.filter(p => p.year === year && p.theme === selectedTheme);
          if (!papers.length) continue;
          const row = element('div', 'spira-row'); row.append(element('span', 'spira-year', String(year)));
          const list = element('span', 'spira-row-links');
          papers.forEach((p, i) => {
            if (i) list.append(document.createTextNode(', '));
            const link = element('a', '', p.name); link.href = paperURL(p.slug); link.dataset.paper = String(PAPERS.indexOf(p));
            list.append(link);
          });
          row.append(list); plateDetail.append(row);
        }
        announce(`${theme.label}. ${theme.question}`);
      } else announce('');
      themeButtons.forEach((button, j) => button.setAttribute('aria-pressed', String(j === selectedTheme)));
      measureUI();
      redraw();
    }
    function selectTheme(j) {
      selectedTheme = selectedTheme === j ? -1 : j; selectedPaper = -1;
      interact(); updatePlate();
    }
    function selectPaper(p) {
      selectedPaper = p; if (p >= 0) selectedTheme = -1;
      updatePlate();
    }
    function setIndex(open) {
      indexOpen = open; indexEl.hidden = !open; indexButton.setAttribute('aria-expanded', String(open));
      measureUI(); redraw();
    }
    function setHover(p) {
      if (hoverPaper === p) return;
      hoverPaper = p; stage.classList.toggle('is-over', p >= 0); redraw();
    }

    function enterCore() {
      if (mode !== 'chart' || coreTarget === 1 || leaving) return;
      // Remember the chart camera; the flight back returns to it exactly.
      coreFrom.yaw = yaw; coreFrom.pitch = pitch; coreFrom.zoom = zoom;
      coreFrom.yawTo = yaw - (((yaw % TAU) + TAU + Math.PI) % TAU - Math.PI);
      coreTarget = 1; coreSpin = 0; vYaw = 0; vPitch = 0; zoomTarget = zoom;
      if (drag.id >= 0) endDrag(true);
      setHover(-1); setIndex(false);
      centreButton.hidden = true; centreHover = false;
      if (motion.matches) coreU = 1;
      updatePlate();
      const back = plateDetail.querySelector('.spira-back');
      if (back) back.focus({ preventScroll: true });
      interact(); redraw();
    }
    function backOut() {
      if (coreTarget !== 1) return;
      coreTarget = 0;
      if (motion.matches) { coreU = 0; coreSpin = 0; }
      centreButton.hidden = false;
      updatePlate();
      centreButton.focus({ preventScroll: true });
      interact(); redraw();
    }
    /* ---- Pointer, wheel and keyboard on the stage ------------------------ */
    const drag = { id: -1, x0: 0, y0: 0, x: 0, y: 0, moved: false, at: 0, type: '' };
    const pinch = { id: -1, x: 0, y: 0, distance: 0 };
    let coreClick = false;
    function interact() { lastInteraction = performance.now(); }
    function nearestPaper(x, y, radius) {
      let best = -1; let bestD = radius;
      for (let p = 0; p < NP; p++) {
        if (!paperVis[p]) continue;
        const d = Math.hypot(paperSX[p] - x, paperSY[p] - y);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }
    function endDrag(cancelled, event) {
      if (drag.id < 0) return;
      const id = drag.id; const moved = drag.moved;
      drag.id = -1; pinch.id = -1;
      try { if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id); } catch (error) { /* synthetic pointer */ }
      stage.classList.remove('is-dragging');
      if (cancelled || motion.matches || (event && event.timeStamp - drag.at > 80)) { vYaw = 0; vPitch = 0; }
      if (!cancelled && !moved && event) {
        const radius = drag.type === 'mouse' ? HOVER_RADIUS : TAP_RADIUS;
        const p = nearestPaper(event.clientX, event.clientY, radius);
        // The centre opens the core, unless a star is nearer to the pointer.
        const toCentre = Math.hypot(event.clientX - chartX, event.clientY - chartY);
        if (toCentre < CORE_HIT && (p < 0 || Math.hypot(paperSX[p] - event.clientX, paperSY[p] - event.clientY) > toCentre)) enterCore();
        else if (p >= 0) selectPaper(p);
        else if (selectedPaper >= 0) selectPaper(-1);
        else if (selectedTheme >= 0) { selectedTheme = -1; updatePlate(); }
      }
      interact(); redraw();
    }
    on(stage, 'pointerdown', event => {
      if (mode !== 'chart' || event.button > 0) return;
      if (coreTarget === 1 || coreU > 0) { coreClick = true; return; }
      if (drag.id >= 0) {
        if (event.pointerType === 'touch' && pinch.id < 0 && drag.type === 'touch') {
          pinch.id = event.pointerId; pinch.x = event.clientX; pinch.y = event.clientY;
          pinch.distance = Math.hypot(pinch.x - drag.x, pinch.y - drag.y) || 1; drag.moved = true;
          try { stage.setPointerCapture(event.pointerId); } catch (error) { /* synthetic pointer */ }
        }
        return;
      }
      drag.id = event.pointerId; drag.type = event.pointerType;
      drag.x0 = drag.x = event.clientX; drag.y0 = drag.y = event.clientY; drag.moved = false; drag.at = event.timeStamp;
      vYaw = 0; vPitch = 0; interact();
      try { stage.setPointerCapture(event.pointerId); } catch (error) { /* synthetic pointer */ }
    });
    on(stage, 'pointermove', event => {
      if (mode !== 'chart' || coreU > 0 || coreTarget) return;
      if (event.pointerId === pinch.id || (pinch.id >= 0 && event.pointerId === drag.id)) {
        if (event.pointerId === pinch.id) { pinch.x = event.clientX; pinch.y = event.clientY; } else { drag.x = event.clientX; drag.y = event.clientY; }
        const distance = Math.hypot(pinch.x - drag.x, pinch.y - drag.y) || 1;
        zoomTarget = clamp(zoomTarget * distance / pinch.distance, ZOOM_RANGE[0], ZOOM_RANGE[1]);
        if (motion.matches) zoom = zoomTarget;
        pinch.distance = distance; interact(); redraw();
        return;
      }
      if (event.pointerId === drag.id) {
        const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) > 4) { drag.moved = true; stage.classList.add('is-dragging'); }
        if (drag.moved) {
          yaw += dx * DRAG_YAW; pitch = clamp(pitch + dy * DRAG_PITCH, PITCH_RANGE[0], PITCH_RANGE[1]);
          const seconds = Math.max(0.008, (event.timeStamp - drag.at) / 1000);
          if (!motion.matches) { vYaw = lerp(vYaw, dx * DRAG_YAW / seconds, 0.5); vPitch = lerp(vPitch, dy * DRAG_PITCH / seconds, 0.5); }
          if (hoverPaper >= 0) setHover(-1);
        }
        drag.x = event.clientX; drag.y = event.clientY; drag.at = event.timeStamp;
        interact(); redraw();
        return;
      }
      if (event.pointerType === 'mouse' && drag.id < 0) setHover(nearestPaper(event.clientX, event.clientY, HOVER_RADIUS));
    });
    on(stage, 'pointerup', event => {
      // In core view a click on empty space backs out.
      if (coreClick) { coreClick = false; if (coreTarget === 1) backOut(); return; }
      if (event.pointerId === pinch.id) { pinch.id = -1; return; }
      if (event.pointerId === drag.id) endDrag(false, event);
    });
    on(stage, 'pointercancel', event => { if (event.pointerId === drag.id || event.pointerId === pinch.id) endDrag(true); });
    on(stage, 'lostpointercapture', event => { if (event.pointerId === drag.id) endDrag(true); });
    on(stage, 'pointerleave', event => { if (event.pointerType === 'mouse' && drag.id < 0) setHover(-1); });
    on(stage, 'wheel', event => {
      if (mode !== 'chart') return;
      event.preventDefault();
      // In core view, scrolling outward backs out.
      if (coreTarget === 1 || coreU > 0) { if (event.deltaY > 0 && coreTarget === 1) backOut(); return; }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? H : 1;
      zoomTarget = clamp(zoomTarget * Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.0015)), ZOOM_RANGE[0], ZOOM_RANGE[1]);
      if (motion.matches) zoom = zoomTarget;
      interact(); redraw();
    }, { passive: false });
    on(stage, 'keydown', event => {
      if (mode !== 'chart' || coreTarget || coreU > 0 || event.target !== stage || event.altKey || event.ctrlKey || event.metaKey) return;
      switch (event.key) {
        case 'ArrowLeft': yaw -= 0.15; break;
        case 'ArrowRight': yaw += 0.15; break;
        case 'ArrowUp': pitch = clamp(pitch - 0.08, PITCH_RANGE[0], PITCH_RANGE[1]); break;
        case 'ArrowDown': pitch = clamp(pitch + 0.08, PITCH_RANGE[0], PITCH_RANGE[1]); break;
        case '+': case '=': zoomTarget = clamp(zoomTarget * 1.2, ZOOM_RANGE[0], ZOOM_RANGE[1]); break;
        case '-': case '_': zoomTarget = clamp(zoomTarget / 1.2, ZOOM_RANGE[0], ZOOM_RANGE[1]); break;
        default: return;
      }
      event.preventDefault(); vYaw = 0; vPitch = 0;
      if (motion.matches) zoom = zoomTarget;
      interact(); redraw();
    });

    /* ---- Controls -------------------------------------------------------- */
    themeButtons.forEach((button, j) => on(button, 'click', () => selectTheme(j)));
    on(indexButton, 'click', () => { setIndex(!indexOpen); interact(); });
    on(replayButton, 'click', replay);
    on(closeButton, 'click', close);
    on(skipButton, 'click', skip);
    on(centreButton, 'click', enterCore);
    on(centreButton, 'pointerenter', () => { centreHover = true; redraw(); });
    on(centreButton, 'pointerleave', () => { centreHover = false; redraw(); });
    on(centreButton, 'focus', () => { centreHover = true; redraw(); });
    on(centreButton, 'blur', () => { centreHover = false; redraw(); });
    on($('[data-opening-close]'), 'click', close);
    const hoverFromLink = event => {
      const link = event.target.closest && event.target.closest('[data-paper]');
      setHover(link ? Number(link.dataset.paper) : -1);
    };
    for (const container of [indexEl, plateDetail]) {
      on(container, 'pointerover', hoverFromLink);
      on(container, 'focusin', hoverFromLink);
      on(container, 'pointerleave', () => setHover(-1));
      on(container, 'focusout', () => setHover(-1));
    }
    on(dialog, 'keydown', event => {
      // Any navigation key reveals the keyboard focus ring that was quiet on open.
      if (event.key === 'Tab' || event.key.startsWith('Arrow')) dialog.removeAttribute('data-quiet');
      if (mode === 'opening' && event.key === 'Enter' && (event.target === skipButton || !(event.target instanceof HTMLButtonElement))) {
        event.preventDefault(); skip();
      }
    });
    // Esc backs out of the core view first; otherwise it closes (a second Esc while closing finishes).
    on(dialog, 'cancel', event => { event.preventDefault(); if (coreTarget === 1 && !leaving) backOut(); else close(); });
    on(dialog, 'close', cleanup);
    on(window, 'pagehide', cleanup);
    on(window, 'resize', () => {
      if (closed) return;
      if (leaving) { cleanup(); return; }
      if (mode !== 'chart') { remnantT = -2; skip(); }
      layout(); redraw();
    });
    on(document, 'visibilitychange', () => {
      if (document.hidden) { if (leaving) { cleanup(); return; } if (raf) cancelAnimationFrame(raf); raf = 0; lastNow = 0; }
      else { lastNow = 0; redraw(); }
    });
    on(motion, 'change', () => {
      if (leaving) { cleanup(); return; }
      replayButton.hidden = motion.matches;
      if (motion.matches) { vYaw = 0; vPitch = 0; zoom = zoomTarget; if (mode !== 'chart') skip(); }
      redraw();
    });

    // Test hook (read-only in spirit): phase, word count, frame timing and star projection.
    dialog.spira = {
      get phase() { return phase; },
      get wordCount() { return wordCount; },
      get keyCount() { return keyCount; },
      get view() { return coreTarget === 1 || coreU > 0 ? 'core' : 'chart'; },
      projectCore() { return { x: chartX, y: chartY }; },
      frameStats: stats,
      projectStar(slug) {
        const p = PAPERS.findIndex(paper => paper.slug === slug);
        return p < 0 ? null : { x: paperSX[p], y: paperSY[p] };
      }
    };

    /* ---- Open ------------------------------------------------------------ */
    try {
      body.style.setProperty('overflow', 'hidden', 'important');
      body.append(dialog);
      dialog.showModal();
      replayButton.hidden = motion.matches;
      layout();
      if (ctx) buildGhosts();
      const animate = !!ctx && !motion.matches;
      if (animate) {
        // Capture after the scroll lock so positions match the page exactly as it is now drawn.
        prepareWords(captureWords());
        html.classList.add('spira-hide-text');
        beginOpening();
        // The t = 0 frame is drawn synchronously, so the hidden glyphs and their
        // sprites change in the same paint.
        const began = performance.now(); render(performance.now()); record(performance.now() - began);
        schedule();
      } else {
        phase = ''; setPhase('chart'); mode = 'chart'; t = T_SETTLED;
        // The page still lies at the centre (core view); its glyphs are never hidden here.
        if (ctx) { try { prepareWords(captureWords()); } catch (error) { releaseWords(); } }
        dialog.classList.add('is-night', 'is-lift');
        openingEl.hidden = true; setInert(false);
        closeButton.focus({ preventScroll: true });
        measureUI();
        if (ctx) { try { render(performance.now()); } catch (error) { console.warn('The spiral could not be drawn.', error); } }
        else canvas.hidden = true;
        schedule();
      }
    } catch (error) {
      console.warn('The spiral could not open.', error);
      cleanup();
    }
  }

  window.SiteEasterEgg = { open };
})();
