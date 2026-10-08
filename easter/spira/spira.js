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
  const ROOT = new URL('../../', (document.currentScript && document.currentScript.src) || location.href);   // easter/spira/spira.js → the site root
  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------------------------
   * Tunable constants. Times are active seconds from the start of the opening;
   * lengths are CSS px unless marked "world" (research spiral units, in which
   * the end of the last year with a paper, LAST_YEAR, lies at radius 1).
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
  const T_HEAD = [8.65, 11.9];         // research head: inner start -> end of LAST_YEAR (for any span)
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
  // Chrome (opening controls, chart actions) stays hidden until intent.
  const CHROME_OPENING = [280, 150];   // px: the bottom-right region that reveals the opening controls
  const CHROME_CHART = [80, 130];      // px: left of the actions, and the band's height from the top
  const CHROME_HIDE_MS = 1800;         // hide this long after the pointer leaves the region
  const CHROME_TAP_MS = 4000;          // a tap on empty sky shows them this long
  const TOAST_MS = 1200;
  const REPLAY_FADE_MS = 250;

  // Closing as dawn: the exact reverse of the opening. The page reassembles itself on the
  // canvas, and the page DOM is untouched until the final frame (s from the close request).
  const DAWN_UI = [0, 0.3];            // UI blocks fade out; meteors stop and fade
  const DAWN_COLLAPSE = [0, 0.65];     // the galaxy collapses into its nucleus; the camera returns to C
  const DAWN_BLOOM = [0.5, 1.1];       // the text spiral blooms out of the nucleus to its hero size
  const DAWN_HOME = 1.0;               // the last page line leaves for home ...
  const DAWN_SPREAD = 0.9;             // ... line departures spread over this long, the name's line last ...
  const DAWN_RIPPLE = 0.012;           // ... each word 12 ms after its left neighbour ...
  const DAWN_FLIGHT = 0.7;             // ... a line's words on one easing: its arc unrolls into the page line
  const DAWN_IRIS = [1.9, 2.75];       // dawn, as the last lines leave: the night disc shrinks, r = R (1 - easeInCubic(u))
  const DAWN_EDGE = [0.04, 10, 28];    // its crisp edge clamp(0.04 r, 10, 28) px, inside the disc (no shade on the day side)
  const DAWN_GLINT = [2.75, 3.0];      // a tiny warm glint where the disc closes
  const DAWN_GLINT_RGB = [232, 178, 92]; // gold that reads on a white page as well as a dark one
  const DAWN_END = 3.0;                // the swap: glyphs back, dialog removed, state restored
  const DAWN_GLINT_FILL = `rgb(${DAWN_GLINT_RGB.join(',')})`;
  const DAWN_TURNS = 0.6;              // backward spin while the text spiral blooms
  const DAWN_COLLAPSE_TURNS = 0.35;    // spin while the galaxy collapses
  const DAWN_BLOOM_FROM = 2;           // px: the text spiral's outer radius as it leaves the nucleus
  const DAWN_CROSSFADE = 0.4;          // from a later opening phase straight into the flight home
  const CLOSE_DUSK = 0.4;              // during the dusk the iris simply reverses, this fast

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
  // The key sentence of the bio: the page marks it (index.html, a span with data-spira-key);
  // the captured words inside the marker glint. A page without the marker has no glint.
  const KEY_MARKER = '[data-spira-key]';
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

  // Research spiral (world units): r(theta) = g^((theta - theta0) / 2 pi - TURNS), one turn per
  // year from FIRST_YEAR to LAST_YEAR (the earliest and the latest paper's year; see buildModel).
  const GROWTH = 1.68;
  const THETA0 = -Math.PI / 2;
  const INNER_TURNS = 0.6;             // faint tail before FIRST_YEAR
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
  const GHOST_WORDS = ['self-referential agents', 'world models', 'long horizons', 'learn from experience'];
  const GHOST_AT = [0.12, 0.36, 0.6, 0.84];   // preferred fractions of the unwritten turn
  const GHOST_SLIDE = 0.03;            // ... from which a blocked phrase slides in these steps
  const GHOST_SLIDE_STEPS = 21;
  const GHOST_MAX_TILT = 50 * Math.PI / 180; // ghost words sit well clear of vertical (60-120 deg)
  const GHOST_ORDER = [3, 0, 1, 2];    // placement priority: 'learn from experience' (from the bio) first
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
  // Strange loop: from the core view the camera dives into the text spiral's vanishing point,
  // where the whole galaxy waits, tiny, and grows until it is the chart again.
  const DIVE_TIME = 1.8;               // s
  const DIVE_ZOOM = 36;                // total zoom: the galaxy starts at 1/36 of its chart size
  const DIVE_SPIN = 1.1;               // rad the arriving galaxy turns as it grows
  const DIVE_WORD_FADE = 3;            // words have faded by the time they reach 3x their size
  const DIVE_WHEEL = 240;              // px of inward wheel travel that starts a dive
  const DIVE_PINCH = 1.35;             // a pinch spreading this much starts a dive
  const DIVE_LABELS = 0.4;             // the arriving galaxy is labelled above this share of its size

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

  // Sky depth: a faint nebula (fbm value noise at 1/4 resolution, smoothly upscaled) and a
  // Milky Way band of tiny stars along its densest region, behind everything.
  const NEBULA_CELL = 4;               // CSS px per nebula texel
  const NEBULA_MARGIN = 48;            // px around the viewport, room for the parallax sway
  const NEBULA_ALPHA = 0.07;           // overall alpha at the densest point
  const NEBULA_SWAY = 40;              // px: horizontal sway with sin(yaw) ...
  const NEBULA_TILT = 30;              // ... and vertical shift per radian of pitch (gentle parallax)
  const NEBULA_ROWS = 6;               // texel rows generated per frame until it is ready
  const NEBULA_ANGLE = -0.38;          // rad: the band's tilt
  const NEBULA_COLOURS = [[86, 128, 220], [148, 110, 228], [236, 186, 140]]; // cool blue, violet, a warm wisp
  const BAND_COUNT = 900;
  const BAND_COUNT_NARROW = 400;
  const BAND_ALPHA = [0.08, 0.14, 0.22, 0.32];

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

  // The next turn: beyond LAST_YEAR the radius grows by only FUTURE_GROWTH of the log spiral's
  // rate, r = 1 + c (g^(phi / 2 pi) - 1), so the whole next turn (where the caught open
  // questions are pinned) stays within the chart's fit radius (about 1.2 after a full turn).
  const FUTURE_GROWTH = 0.3;
  const WISH_ARC = [12, 22];           // deg: a pinned wish draws the next turn fully within 12, fading out by 22
  const WISH_GLOW = 13;
  const WISH_GLINT = 22;               // px: the warm four-point glint of a wish star
  const DRAWN_ALPHA = 0.3;             // the next turn as a soft solid line once all ten are caught
  const DRAWN_FADE = 1.6;              // s
  const BRIDGE_ALPHA = 0.35;           // a wish's two theme spokes light up to this when it is hovered or selected ...
  const BRIDGE_ARC = [1.22, 0.28];     // ... and a faint arc (world radius, alpha) joins their rim labels
  const BRIDGE_TAU = 0.1;              // s: the bridge fades in and out (settled in about 0.3 s)

  // Shooting stars ("wishes"), chart phase only. Times in chart seconds.
  const METEOR_FIRST = 2.5;
  const METEOR_GAP = [6, 12];
  const METEOR_SPEED = [1100, 1500];   // px/s
  const METEOR_SPEED_NARROW = [800, 1100];
  const METEOR_ANGLE = [20, 40];       // deg below horizontal
  const METEOR_TAIL = 260;             // px
  const METEOR_TAIL_NARROW = 170;
  const METEOR_SEGMENTS = 6;
  const METEOR_WIDTH = [2, 0.3];       // tail width at the head and at the end
  const METEOR_CORE = 2.5;             // px diameter of the warm-white head
  const METEOR_GLOW = 14;
  const METEOR_MAX = 16;               // pool size (the shower uses 14)
  const TAIL_FONT = 10;                // px: the question along the tail
  const TAIL_TEXT_GAP = 16;            // px between the head and the first letter
  const TAIL_TEXT_LIFT = 6;            // px the letters ride above the tail line
  const GLYPH_HALO = 5;                // px night halo baked around each letter (legible over the chart)
  const CATCH_HEAD = 56;               // px around the head ...
  const CATCH_TAIL = [32, 160];        // ... or within 32 px of the first 160 px of tail
  const METEOR_INVITE = [450, 380];    // px/s: the session's first meteor while nothing is caught (desktop, narrow)
  const BULLET_RADIUS = 150;           // px: a pointer this near a meteor's head ...
  const BULLET_SPEED = 0.35;           // ... slows it to this share of its speed ...
  const BULLET_TAU = 0.12;             // ... easing in and out with this time constant (s)
  const CATCH_STOP = 0.35;             // s: the caught meteor decelerates to rest
  const CATCH_RELAY = [0.08, 0.5, 0.3]; // letters re-lay: start, duration each, stagger across the line
  const CATCH_HOLD = 1.6;              // the readable line holds this long
  const CATCH_COLLAPSE = 0.35;         // the line collapses to a point ...
  const CATCH_ARC = 0.8;               // ... that arcs to its place on the next turn
  const QUESTION_FONT = 18;            // px, serif italic, warm
  const QUESTION_FONT_NARROW = 15;
  const QUESTION_MARGIN = 16;          // px kept from the viewport edges
  const LABEL_UNDER_QUESTION = 0.15;   // canvas labels under the laid-out question fade to this
  const SHOWER_COUNT = 14;
  const SHOWER_TIME = 2.2;
  const GOLDEN_GAP = [15, 25];
  const STILL_GAP = [10, 16];          // reduced motion: a still wish appears every 10-16 s ...
  const STILL_LIFE = 8;                // ... and can be caught for 8 s
  const STILL_RADIUS = 9;
  const GOLD = '#ffd98a';

  // Sound (Web Audio, synthesized). Gains are linear amplitudes before the master.
  const AUDIO_MASTER = 0.55;
  const AUDIO_FADE_IN = 1.2;           // s
  const AUDIO_TOGGLE = 0.25;           // s ramp when sound is switched on or off
  const AUDIO_LOOKAHEAD = 0.03;        // s: cues are scheduled at most this far ahead
  const AUDIO_COMPRESSOR = { threshold: -18, ratio: 4, knee: 12 };
  const REVERB = { seconds: 3.2, predelay: 0.02, send: 0.35, igniteSend: 0.6 };
  const PAD = { attack: 2.5, release: 3.5, max: 10, cutoff: 900, lfoHz: 0.07, lfoDepth: 300, detune: 5 };
  const DRONE_LEVEL = 0.1;
  const AIR_LEVEL = 0.025;
  const WIND_LEVEL = 0.09;
  const HUSH_TIME = 0.12;              // s: everything drops to near silence at T_COLLAPSED
  const GATHER_NOTE = 0.035;           // harp, every third departing word
  const HOME_NOTE_GAP = 0.045;         // s: the closing harp (one note per departing line) keeps this far apart
  const PAPER_NOTE = 0.06;
  const HOVER_NOTE = 0.045;
  const HOVER_THROTTLE = 70;           // ms
  const SELECT_NOTE = 0.08;
  const ARPEGGIO_STEP = 0.09;          // s between a theme's papers
  const SPIN_MAX = 0.05;               // spin whoosh gain cap
  const CHORD_EVERY = 9;               // s; each chord sounds CHORD_EVERY + 4 (4 s overlap)
  const CHORD_OVERLAP = 4;
  const CHORD_GAIN = 0.035;
  const AMBIENT_BELL = [3, 8];         // s between sparse bells
  const AMBIENT_BELL_GAIN = 0.025;
  const CORE_MUFFLE = 700;             // Hz: the music bus in core view ("inside the page")

  // "Listen to the spiral": a comet traces the written spiral, one turn per year.
  const SCORE_INNER = 0.6;             // s along the faint inner tail before FIRST_YEAR
  // s per year, constant angular speed within each: a base plus a share per paper, the least-
  // squares fit (rounded) to the hand-set [2.4, 3.0, 3.6, 4.4, 3.2] for 2022-2026 at their
  // 1, 3, 7, 8 and 10 papers. It keeps the years' total (16.6 s then) and gives a busy year room.
  const SCORE_YEAR_BASE = 2.5;
  const SCORE_PER_PAPER = 0.14;
  const SCORE_NEXT = 1.8;              // s along the dashed next turn (caught wishes chime), fading out
  const SCORE_OUTRO = 3;               // s the closing words hold before the default plate returns
  const SCORE_DUCK = 0.3;              // the ambient music's share during the score
  const SCORE_CHORD = 0.04;            // pad gain per voice for each year's chord
  const SCORE_SPARKLE = 0.6;           // a rung paper's sparkle relative to the opening's
  const SCORE_GLOW = 1.6;              // s a rung paper's label stays bright
  const SCORE_STOP = 0.4;              // s: stopping fades the comet and the chord

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
  /*
   * The papers come from the site's publication list (data.js, the global `publications`) when
   * the egg opens; see papersFrom. What stays curated here: the short names the owner chose for
   * the labels on the spiral, keyed by paper slug (a paper without one is named by shortName).
   * Their order is also the order of these papers within a (year, theme) cell.
   */
  const SHORT_NAMES = Object.freeze({
    'seq2seq-data2text': 'Evaluating Data-to-Text',
    'chatgpt-summarization-evaluation': 'ChatGPT as Summary Evaluator',
    'context-aware-evaluation': 'Cont-COMET',
    'alcuna': 'ALCUNA',
    'themis': 'Themis',
    'history-matters': 'History Matters',
    'knowledge-boundary': 'Knowledge Boundary',
    'contextual-asr': 'Contextual ASR',
    'error-robust-retrieval': 'RERIC',
    'coral': 'COrAL',
    'contrasolver': 'ContraSolver',
    'dsgram': 'DSGram',
    'nlg-evaluation-survey': 'LLMs as Evaluators',
    'damon': 'DAMON',
    'mc-mke': 'MC-MKE',
    'self-generated-documents': 'Self-Generated Documents',
    'knowledge-interplay': 'EchoQA',
    'chemagent': 'ChemAgent',
    'godel-agent': 'Gödel Agent',
    'auditing-health-llms': 'Challenges of Auditing',
    'agent-x': 'AGENT-X',
    'eama': 'EAMA',
    'epistemic-context-learning': 'Epistemic Context Learning',
    'coding-agents-long-context': 'Coding Agents for Long Context',
    'lazy-grounding': 'Lazy Grounding',
    'geometry-of-reasoning': 'The Geometry of Reasoning',
    'atomic-to-composite': 'Atomic to Composite',
    'reverse-lm': 'LEDOM',
    'derl': 'DERL',
    // Papers without a page here (the key is made from the title: see papersFrom)
    'constructing-challenging-browser-use-tasks-by-controlled-environment-interventions': 'Browser-Use Tasks'
  });
  const CURATED_ORDER = Object.keys(SHORT_NAMES);
  const SHORT_MAX = 30;                // characters: the longest label the layout takes ('Coding Agents for Long Context')
  // A generated short name ends before one of these words (or after , ; ? !).
  const SHORT_BOUNDARY = new Set(['by', 'for', 'with', 'via', 'in', 'on', 'from', 'to', 'through', 'using', 'between',
    'beyond', 'under', 'toward', 'towards', 'against', 'without', 'as', 'at']);
  // ... and never ends on one of these.
  const SHORT_DANGLING = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'is', 'are', 'can', ...SHORT_BOUNDARY]);
  const LOCAL_PAGE = /^papers\/([a-z0-9-]+)\.html$/i;   // a link to the paper's page on this site
  const DATA_TIMEOUT_MS = 10000;       // a page without data.js waits this long for it before the opening fails
  const TAKEAWAY_IN_MS = 240;          // a takeaway that arrives after its plate opened fades in (and settles) this long
  // Open questions, each bridging two themes. A shooting star carries one; caught, it is
  // pinned on the next turn, midway (the shorter way) between its two themes' sectors.
  const QUESTIONS = [
    ['knowledge', 'reasoning', 'How can new knowledge become a new ability?', 'Knowing a fact and using it in an unfamiliar solution are different capabilities.'],
    ['knowledge', 'evaluation', 'How do we measure what a model could know?', 'A wrong answer can mean missing knowledge, or a failure to draw it out.'],
    ['knowledge', 'improvement', 'How can an agent change without forgetting?', 'A useful update expands what works without breaking what already did.'],
    ['knowledge', 'grounding', 'How should a model update when the world changes?', 'Facts expire. A growing model must keep the context in which an older answer was true.'],
    ['reasoning', 'evaluation', 'Can we tell better reasoning from better-looking answers?', 'A convincing answer is not evidence of a reliable process.'],
    ['reasoning', 'improvement', 'Can a learner improve how it learns to reason?', 'Improving an answer is one step; improving the procedure that finds answers is another.'],
    ['reasoning', 'grounding', 'Can an agent predict what its actions will change?', 'A world model would let reasoning plan, intervene and correct itself.'],
    ['evaluation', 'improvement', 'Who evaluates an agent that can rewrite its evaluator?', 'When the solver and the judge can both change, measuring progress becomes part of the problem.'],
    ['evaluation', 'grounding', 'What counts as progress outside a benchmark?', 'Useful behaviour has to survive new contexts and new goals.'],
    ['improvement', 'grounding', 'Can experience become lasting capability?', 'A long-running agent sees more than fits in context. How does experience become part of its machinery?']
  ].map(([a, b, text, note]) => ({ a: THEMES.findIndex(t => t.id === a), b: THEMES.findIndex(t => t.id === b), text, note }));
  const NQ = QUESTIONS.length;
  const WISH_KEY = 'spira-wishes';     // sessionStorage: caught questions last for one visit (a legacy localStorage copy is removed)
  const SOUND_KEY = 'spira-sound';     // localStorage: the sound preference stays

  const COPY = {
    stage: 'The research spiral. Drag or use arrow keys to turn it; plus and minus to zoom. Keys 1 to 5 choose a theme; L listens to the spiral; Space catches a shooting star; M switches the sound. At the centre, plus goes deeper.',
    catchPointer: 'Catch a shooting star',
    catchTouch: 'Tap a shooting star',
    listen: 'Listen to the spiral →',
    scoreKicker: 'Listen to the spiral',
    scoreSoundOff: 'Sound is off · m',
    scoreEndTitle: 'That is the spiral so far.',
    scoreEndText: 'The next turns are not drawn yet.',
    invitePointer: 'A shooting star: click it to catch the question it carries',
    inviteTouch: 'A shooting star: tap it to catch the question it carries',
    counter: 'Open questions caught',
    release: 'Release them',
    drawnKicker: 'Ten open questions',
    drawnTitle: 'The next turn is drawn.',
    drawnText: 'These are the questions I hope to work on next. Thank you for catching them.',
    drawnLink: 'Read the research direction →',
    drawnHref: 'blogs/agents-that-learn-after-deployment.html',
    text: 'A logarithmic spiral keeps its shape as it grows: each turn is the last one, enlarged. Here each turn is a year of my research, passing through the same five questions, a little further out every time. The next turns are not drawn yet.',
    hintPointer: 'Drag to turn · Scroll to move closer · Select a star or the centre',
    hintTouch: 'Drag to turn · Tap a star or the centre',
    note: 'Jacob Bernoulli asked for this curve and motto on his tombstone. The mason carved the wrong spiral.',
    centre: 'The centre of the spiral: the page you came from',
    coreKicker: 'At the centre',
    coreTitle: 'The page you came from.',
    coreText: 'Every turn of the spiral starts here.',
    deeperPointer: 'Scroll inward to go deeper.',
    deeperTouch: 'Pinch or tap the centre to go deeper.',
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
  // A question's colour is the blend of its two themes' colours.
  QUESTIONS.forEach(q => {
    const x = hexRGB(THEMES[q.a].colour); const y = hexRGB(THEMES[q.b].colour);
    q.rgb = x.map((v, i) => Math.round((v + y[i]) / 2)); q.colour = `rgb(${q.rgb.join(',')})`;
    q.kicker = `Open question · ${THEMES[q.a].label} × ${THEMES[q.b].label}`;
  });
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
  function glintSprite(rgb = [255, 255, 255]) {
    const size = 64; const c = makeCanvas(size, size); const g = c.getContext('2d'); const tone = rgb.join(',');
    for (const horizontal of [true, false]) {
      const grad = horizontal ? g.createLinearGradient(0, 0, size, 0) : g.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, `rgba(${tone},0)`); grad.addColorStop(0.5, `rgba(${tone},0.9)`); grad.addColorStop(1, `rgba(${tone},0)`);
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
      glint: glintSprite(),
      glintWarm: glintSprite(hexRGB(WARM)),
      glintGold: glintSprite(DAWN_GLINT_RGB),
      blends: QUESTIONS.map(q => glowSprite(q.rgb)),
      gold: glowSprite(hexRGB(GOLD))
    };
    return shared;
  }

  /* ---------------------------------------------------------------------------
   * Sky depth: a nebula texture, built a few rows per frame and cached per layout
   * ------------------------------------------------------------------------- */
  // Value noise on a 64 x 64 lattice with quintic interpolation; fbm sums four octaves.
  const NOISE_N = 64;
  const noiseTable = (() => { const r = seeded(1729); const t = new Float32Array(NOISE_N * NOISE_N); for (let i = 0; i < t.length; i++) t[i] = r(); return t; })();
  function valueNoise(x, y) {
    const xi = Math.floor(x); const yi = Math.floor(y); const fx = x - xi; const fy = y - yi;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10); const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const x0 = ((xi % NOISE_N) + NOISE_N) % NOISE_N; const y0 = ((yi % NOISE_N) + NOISE_N) % NOISE_N;
    const x1 = (x0 + 1) % NOISE_N; const y1 = (y0 + 1) % NOISE_N;
    const a = noiseTable[y0 * NOISE_N + x0]; const b = noiseTable[y0 * NOISE_N + x1];
    const c = noiseTable[y1 * NOISE_N + x0]; const d = noiseTable[y1 * NOISE_N + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y) {
    let sum = 0; let amp = 0.5; let f = 1;
    for (let o = 0; o < 4; o++) { sum += amp * valueNoise(x * f, y * f); f *= 2; amp *= 0.5; }
    return sum / 0.9375;
  }
  const smoothstep = (a, b, x) => smooth((x - a) / (b - a));
  let nebulaCache = null;
  // The nebula for a layout: a cached canvas, or one under construction (row = rows built).
  function nebulaFor(w, h, bx, by) {
    const key = `${w}x${h}@${Math.round(bx)},${Math.round(by)}`;
    if (nebulaCache && nebulaCache.key === key) return nebulaCache;
    const tw = Math.ceil((w + 2 * NEBULA_MARGIN) / NEBULA_CELL); const th = Math.ceil((h + 2 * NEBULA_MARGIN) / NEBULA_CELL);
    const canvas = makeCanvas(tw, th); const g = canvas.getContext('2d');
    nebulaCache = { key, canvas, g, image: g.createImageData(tw, th), tw, th, row: 0, w, h, bx, by };
    return nebulaCache;
  }
  /**
   * Build `rows` more texel rows. Three soft fields from the theme palette (cool blue, violet,
   * a faint warm wisp), each a thresholded fbm, concentrated along a tilted band through the
   * chart centre (Gaussian across it); alpha is normalised to 1 at the densest point.
   */
  function nebulaRows(neb, rows) {
    const { tw, th, image, w, h, bx, by } = neb; const data = image.data;
    const size = Math.min(w, h); const sa = Math.sin(NEBULA_ANGLE); const ca = Math.cos(NEBULA_ANGLE);
    const end = Math.min(th, neb.row + rows);
    for (let j = neb.row; j < end; j++) {
      const y = j * NEBULA_CELL - NEBULA_MARGIN;
      for (let i = 0; i < tw; i++) {
        const x = i * NEBULA_CELL - NEBULA_MARGIN; const u = x / size; const v = y / size;
        const across = (-(x - bx) * sa + (y - by) * ca) / (0.24 * size); const band = Math.exp(-across * across);
        const d1 = smoothstep(0.34, 0.86, fbm(u * 1.6 + 3.1, v * 1.6 + 1.7)) * (0.25 + 0.75 * band) * 0.7;
        const d2 = smoothstep(0.44, 0.9, fbm(u * 2.4 + 9.2, v * 2.4 + 4.4)) * band * 0.55;
        const d3 = smoothstep(0.6, 0.95, fbm(u * 3.5 + 17.3, v * 3.5 + 11.9)) * band * band * 0.4;
        const a = Math.min(1, d1 + d2 + d3); const k = (j * tw + i) * 4;
        if (a <= 0.002) { data[k + 3] = 0; continue; }
        for (let c = 0; c < 3; c++) data[k + c] = (NEBULA_COLOURS[0][c] * d1 + NEBULA_COLOURS[1][c] * d2 + NEBULA_COLOURS[2][c] * d3) / a;
        data[k + 3] = a * 255;
      }
    }
    neb.g.putImageData(image, 0, 0, 0, neb.row, tw, end - neb.row);
    neb.row = end;
    return neb.row >= th;
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
            left: r.left, top: r.top, width: r.width, height: r.height, style, block, cont: !atStart, key: -1,
            node, start, end });
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
   * Find the bio's key sentence among the captured words: the words whose text lies inside the
   * page's marker (KEY_MARKER). Marks each with its order along the sentence (reading order)
   * and returns the sentence's length in tokens (pieces of a word wrapped across lines count
   * once); 0 when the page has no marker or none of its words is in view.
   */
  function markKeySentence(words) {
    const marker = document.querySelector(KEY_MARKER);
    if (!marker) return 0;
    let order = 0; let tokens = 0; let previous = false;
    for (const word of words) {
      const inside = marker.contains(word.node);
      if (inside) { word.key = order++; if (!word.cont || !previous) tokens++; }
      previous = inside;
    }
    return tokens;
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
   * Papers: the site's publication list (data.js)
   * ------------------------------------------------------------------------- */
  // data.js is a classic script with a top-level const, so `publications` is a global binding
  // (not a window property) that this script reads by name; null on a page without data.js.
  const sitePublications = () => (typeof publications !== 'undefined' && Array.isArray(publications) ? publications : null); // eslint-disable-line no-undef
  /**
   * A page without data.js (the photography page, the blogs) loads it once, from the site root,
   * before the egg opens. Never a second script while the first may still run (a second const
   * declaration would throw): a network error removes it, so a later opening tries again; a load
   * that takes longer than DATA_TIMEOUT_MS fails this opening and still serves the next one.
   */
  let dataLoad = null;
  function loadPublications() {
    const ready = sitePublications();
    if (ready) return Promise.resolve(ready);
    if (!dataLoad) {
      dataLoad = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('data.js', ROOT).href;
        script.onload = () => { const list = sitePublications(); if (list) resolve(list); else reject(new Error('data.js defines no publications.')); };
        script.onerror = () => { script.remove(); dataLoad = null; reject(new Error('data.js could not be loaded.')); };
        document.head.append(script);
      });
    }
    let timer = 0;
    const late = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('data.js took too long.')), DATA_TIMEOUT_MS); });
    return Promise.race([dataLoad, late]).finally(() => clearTimeout(timer));
  }
  const cleanText = text => String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  const slugify = text => cleanText(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // A paper's year: the last 20xx in its venue, else year={...} in its citation, else 0 (not drawn).
  function yearOf(pub) {
    const venue = cleanText(pub.venue).match(/\b20\d\d\b/g);
    if (venue) return Number(venue[venue.length - 1]);
    const cited = /\byear\s*=\s*[{"]?\s*(20\d\d)\b/i.exec(String(pub.citation || ''));
    return cited ? Number(cited[1]) : 0;
  }
  /**
   * The label on the spiral: the curated name (SHORT_NAMES), else the publication's own `short`
   * field, else its title before ':' when that has at most SHORT_MAX characters, else a phrase
   * cut from that title at a natural boundary: a leading gerund ("Constructing ...") dropped,
   * ending before the first preposition (SHORT_BOUNDARY) or after , ; ? !, then shortened to
   * whole words that fit, never ending on a function word.
   */
  function shortName(pub, slug) {
    if (Object.prototype.hasOwnProperty.call(SHORT_NAMES, slug)) return SHORT_NAMES[slug];
    const own = cleanText(pub.short);
    if (own) return own;
    const title = cleanText(pub.title);
    const colon = title.indexOf(':');
    const head = colon > 0 ? title.slice(0, colon).trim() : title;
    if (head.length <= SHORT_MAX) return head;
    let words = head.split(' ');
    if (words.length > 2 && /^\p{Lu}\p{Ll}{3,}ing$/u.test(words[0]) && !SHORT_DANGLING.has(words[1].toLowerCase())) words = words.slice(1);
    const phrase = [];
    for (const word of words) {
      if (phrase.length && SHORT_BOUNDARY.has(word.toLowerCase())) break;
      phrase.push(word.replace(/[,;?!]+$/, ''));
      if (/[,;?!]$/.test(word)) break;
    }
    while (phrase.length > 1 && phrase.join(' ').length > SHORT_MAX) phrase.pop();
    while (phrase.length > 1 && SHORT_DANGLING.has(phrase[phrase.length - 1].toLowerCase())) phrase.pop();
    let name = phrase.join(' ');
    if (name.length > SHORT_MAX) name = `${name.slice(0, SHORT_MAX - 1)}…`;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  /**
   * The drawable papers of a publication list: those with a topic among the five themes (the
   * first such topic is the theme) and a year (yearOf). A link to papers/<slug>.html makes a
   * paper local: it links to that page and its plate shows the page's takeaway. Any other
   * paper links to its "Paper" link (else its first link) in a new tab, with no takeaway; its
   * slug is made from its title (the part before ':'). Sorted by year, then theme; within a
   * (year, theme) cell the curated papers keep the order they have had (CURATED_ORDER), and
   * any other paper follows them, oldest first (data.js lists the newest first).
   */
  function papersFrom(list) {
    const papers = []; const slugs = new Set();
    for (const pub of Array.isArray(list) ? list : []) {
      if (!pub || typeof pub !== 'object') continue;
      const theme = (Array.isArray(pub.topics) ? pub.topics : []).map(id => THEMES.findIndex(t => t.id === id)).find(j => j >= 0);
      const year = yearOf(pub);
      if (theme === undefined || !year) continue;
      const links = (Array.isArray(pub.links) ? pub.links : []).filter(link => link && typeof link.url === 'string' && link.url);
      const page = links.map(link => LOCAL_PAGE.exec(link.url.trim())).find(Boolean);
      const title = cleanText(pub.title);
      let slug = page ? page[1].toLowerCase() : slugify(title.split(':')[0]) || 'paper';
      if (slugs.has(slug)) { let k = 2; while (slugs.has(`${slug}-${k}`)) k++; slug = `${slug}-${k}`; }
      slugs.add(slug);
      let href = '';
      if (page) href = paperURL(slug);
      else {
        const link = links.find(l => cleanText(l.text).toLowerCase() === 'paper') || links[0];
        try { if (link) href = new URL(link.url.trim(), ROOT).href; } catch (error) { href = ''; }
      }
      papers.push({ year, theme, slug, local: !!page, href, title, venue: cleanText(pub.venue), name: shortName(pub, slug), order: papers.length });
    }
    const curated = p => CURATED_ORDER.indexOf(p.slug);
    return papers.sort((a, b) => a.year - b.year || a.theme - b.theme ||
      (curated(a) < 0) - (curated(b) < 0) || curated(a) - curated(b) || b.order - a.order);
  }
  /**
   * A local paper's takeaway, the .paper-takeaway text of its page, read when its plate opens
   * (or earlier, when its star or link is hovered) and cached per slug while the page is open: the
   * text ('' for a page without one), or the load in flight. A failed load is forgotten, so
   * the next plate tries again. Resolves with the text, or '' when there is none to show.
   */
  const takeawayCache = new Map();
  function loadTakeaway(slug) {
    const known = takeawayCache.get(slug);
    if (known !== undefined) return Promise.resolve(known);
    const load = fetch(paperURL(slug)).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    }).then(html => {
      const found = new DOMParser().parseFromString(html, 'text/html').querySelector('.paper-takeaway');
      const text = cleanText(found && found.textContent);
      takeawayCache.set(slug, text);
      return text;
    }).catch(() => { takeawayCache.delete(slug); return ''; });
    takeawayCache.set(slug, load);
    return load;
  }

  /* ---------------------------------------------------------------------------
   * Research spiral geometry (layout independent). The span of years and everything derived
   * from it are rebuilt from the papers before each opening (buildModel).
   * ------------------------------------------------------------------------- */
  const THETA_IN = THETA0 - TAU * INNER_TURNS;
  const D_THETA = TAU / SAMPLES_PER_TURN;
  const INDEX_FIRST = Math.round((THETA0 - THETA_IN) / D_THETA);   // the sample at the start of FIRST_YEAR
  const SECTOR = TAU / THEMES.length;
  const sectorCentre = j => THETA0 + (j + 0.5) * SECTOR;
  let PAPERS = [];
  let FIRST_YEAR = 0; let LAST_YEAR = 0; let TURNS = 1;
  let THETA_END = THETA0 + TAU;        // the end of LAST_YEAR (radius 1)
  let THETA_NEXT = THETA_END + TAU;    // the end of the next turn
  // Written turns follow the log spiral; the next turn grows at FUTURE_GROWTH of its rate
  // (the same radius and direction at THETA_END, so the curve stays continuous).
  const radiusAt = theta => (theta <= THETA_END ? Math.pow(GROWTH, (theta - THETA0) / TAU - TURNS)
    : 1 + FUTURE_GROWTH * (Math.pow(GROWTH, (theta - THETA_END) / TAU) - 1));
  /*
   * Head angle. Each turn lasts in proportion to r^0.6, so the angular speed is
   * k r(theta)^-0.6 and the elapsed sweep time tau' grows like e^(a (theta - theta_in)) - 1
   * with a = 0.6 ln g / 2 pi. Inverting: theta = theta_in + ln(1 + tau' / K) / a, where K
   * makes FIRST_YEAR-LAST_YEAR last the sweep time, whatever the span. A quadratic ramp
   * (tau' = tau^2 / 2R for tau < R) starts the head from rest; after LAST_YEAR a power ease-out
   * (velocity continuous) brings it to rest on the unwritten turn by T_STOP.
   */
  const HEAD_A = HEAD_TURN_EXP * Math.log(GROWTH) / TAU;
  const SWEEP_TIME = T_HEAD[1] - T_HEAD[0] - T_HEAD_RAMP / 2;
  const FUTURE_TIME = T_STOP - T_HEAD[1];
  let HEAD_K = 1; let END_SPEED = 0; let THETA_STOP = THETA_END;
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
  // Samples run to the end of the next turn (the written chart stops at THETA_STOP; the rest
  // is drawn only where caught questions are pinned).
  let SAMPLE_COUNT = 0; let SAMPLE_X = new Float64Array(0); let SAMPLE_Y = new Float64Array(0);
  let INDEX_END = 0; let INDEX_NEXT = 0;
  // Theme labels sit at THEME_LABEL_R, or just outside the next turn where it passes farther out.
  let THEME_LABEL_RADII = [];
  // The score's timeline: segment k runs from SCORE_AT[k] to SCORE_AT[k + 1] (s) while the comet
  // sweeps SCORE_THETA[k] .. SCORE_THETA[k + 1] at constant angular speed: the inner tail, one
  // segment per year FIRST_YEAR-LAST_YEAR (SCORE_YEARS), then the next turn.
  let SCORE_YEARS = []; let SCORE_DUR = []; let SCORE_THETA = []; let SCORE_AT = [0]; let SCORE_TOTAL = 0;
  function scoreTheta(time) {
    for (let k = 0; k < SCORE_DUR.length; k++) {
      if (time <= SCORE_AT[k + 1]) return lerp(SCORE_THETA[k], SCORE_THETA[k + 1], clamp01((time - SCORE_AT[k]) / SCORE_DUR[k]));
    }
    return THETA_NEXT;
  }
  function scoreTimeAt(theta) {
    for (let k = 0; k < SCORE_DUR.length; k++) {
      if (theta <= SCORE_THETA[k + 1]) return SCORE_AT[k] + SCORE_DUR[k] * clamp01((theta - SCORE_THETA[k]) / (SCORE_THETA[k + 1] - SCORE_THETA[k]));
    }
    return SCORE_TOTAL;
  }
  // Which part of the score a time falls in: 0 .. TURNS - 1 the years, -1 before them, TURNS after.
  const scoreYearAt = time => (time < SCORE_AT[1] ? -1 : time >= SCORE_AT[TURNS + 1] ? TURNS : Math.min(TURNS - 1, SCORE_AT.findIndex(at => at > time) - 2));
  // Year marks at the start of each year, and 'next' at the end of LAST_YEAR.
  let YEAR_MARKS = [];
  /**
   * Build the chart's model from a publication list: the papers, the span FIRST_YEAR-LAST_YEAR
   * (one turn per year, the end of LAST_YEAR at radius 1), the head's sweep, the curve's
   * samples, each paper's angle, the open questions' places on the next turn, the score's
   * timeline and the year marks. For 2022-2026 the geometry and the opening's timing are those
   * of the fixed span the egg had before; the score's seconds per year follow the papers.
   */
  function buildModel(list) {
    PAPERS = papersFrom(list);
    const years = PAPERS.map(p => p.year);
    FIRST_YEAR = years.length ? Math.min(...years) : new Date().getFullYear();
    LAST_YEAR = years.length ? Math.max(...years) : FIRST_YEAR;
    TURNS = LAST_YEAR - FIRST_YEAR + 1;
    THETA_END = THETA0 + TAU * TURNS;
    THETA_NEXT = THETA_END + TAU;
    HEAD_K = SWEEP_TIME / (Math.exp(HEAD_A * (THETA_END - THETA_IN)) - 1);
    END_SPEED = 1 / (HEAD_A * (HEAD_K + SWEEP_TIME));
    THETA_STOP = THETA_END + END_SPEED * FUTURE_TIME / FUTURE_EASE;
    SAMPLE_COUNT = Math.ceil((THETA_NEXT - THETA_IN) / D_THETA) + 2;
    SAMPLE_X = new Float64Array(SAMPLE_COUNT); SAMPLE_Y = new Float64Array(SAMPLE_COUNT);
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const theta = THETA_IN + i * D_THETA; const r = radiusAt(theta);
      SAMPLE_X[i] = r * Math.cos(theta); SAMPLE_Y[i] = r * Math.sin(theta);
    }
    INDEX_END = Math.round((THETA_END - THETA_IN) / D_THETA);
    INDEX_NEXT = Math.min(SAMPLE_COUNT - 1, Math.round((THETA_NEXT - THETA_IN) / D_THETA));
    // Paper angle: k of m papers in a (year, theme) cell sit at (k + 0.5) / m across the padded sector.
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
    THEME_LABEL_RADII = THEMES.map((_, j) => Math.max(THEME_LABEL_R, radiusAt(THETA_END + (j + 0.5) * SECTOR) + 0.09));
    // A question's place on the next turn: midway, the shorter way, between its two themes'
    // sector centres (the ten midpoints fall every 36 degrees).
    QUESTIONS.forEach(q => {
      const ca = (q.a + 0.5) * SECTOR; const cb = (q.b + 0.5) * SECTOR;
      let d = cb - ca; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      // A midpoint at 0 sits at the end of the next turn (2 pi), not on the end of LAST_YEAR.
      let phi = (((ca + d / 2) % TAU) + TAU) % TAU; if (phi < 1e-6 || TAU - phi < 1e-6) phi = TAU;
      q.phi = phi; q.theta = THETA_END + phi; q.r = radiusAt(q.theta);
      q.x = q.r * Math.cos(q.theta); q.y = q.r * Math.sin(q.theta);
    });
    SCORE_YEARS = Array.from({ length: TURNS }, (_, k) => SCORE_YEAR_BASE + SCORE_PER_PAPER * years.filter(y => y === FIRST_YEAR + k).length);
    SCORE_DUR = [SCORE_INNER, ...SCORE_YEARS, SCORE_NEXT];
    SCORE_THETA = [THETA_IN, ...SCORE_YEARS.map((_, k) => THETA0 + TAU * k), THETA_END, THETA_NEXT];
    SCORE_AT = SCORE_DUR.reduce((at, d) => { at.push(at[at.length - 1] + d); return at; }, [0]);
    SCORE_TOTAL = SCORE_AT[SCORE_AT.length - 1];
    PAPERS.forEach(p => { p.scoreAt = scoreTimeAt(p.theta); });
    QUESTIONS.forEach(q => { q.scoreAt = scoreTimeAt(q.theta); });
    YEAR_MARKS = Array.from({ length: TURNS + 1 }, (_, i) => {
      const theta = THETA0 + TAU * i;
      return { label: i === TURNS ? 'next' : String(FIRST_YEAR + i), theta, r: radiusAt(theta), at: timeAtTheta(theta) };
    });
  }
  // A model is there from the start (the synthesizer's octaves read the span); each opening rebuilds it.
  buildModel(sitePublications() || []);
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

  /* ---------------------------------------------------------------------------
   * Sound. A small synthesizer on any BaseAudioContext, so an OfflineAudioContext
   * renders exactly the cues the egg plays (the tests measure their peaks):
   *   voice -> StereoPanner -> dry bus ----------------------------> master
   *                         \-> reverb send (0.35, or 0.6) -> convolver -/
   *   master -> tone (the music bus lowpass; 700 Hz in core view) -> compressor -> out
   * Pitch: D major pentatonic. A theme is a degree (evaluation D, knowledge E, grounding
   * F#, reasoning A, improvement B); a year is an octave, the span spread evenly across
   * octaves 4-6: the year's place k in FIRST_YEAR-LAST_YEAR gives 4 + floor(3 k / TURNS)
   * (2022-2026: 4, 4, 5, 5, 6).
   * When sound is off, or a live context is not running, nothing is scheduled at all.
   * ------------------------------------------------------------------------- */
  const PENTATONIC = [0, 2, 4, 7, 9];                     // semitones above D
  const LADDER = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]; // D4 ... D6, two pentatonic octaves (MIDI)
  const CHORDS = [[50, 57, 61, 64, 66], [47, 54, 57, 62, 64], [43, 50, 54, 57, 59], [45, 52, 54, 59, 62]]; // Dmaj9 Bm11 Gmaj9 A6sus
  const DAWN_CHORD = [62, 66, 69, 76];                    // D4 F#4 A4 E5
  const RESOLVE_CHORD = [50, 62, 66, 69, 76];             // the score's last chord: D add9
  const AMBIENT_NOTES = [74, 76, 78, 81, 83, 86];         // D5 ... D6
  const BELL_RATIOS = [1, 2, 2.76, 4.07];
  const BELL_GAINS = [1, 0.35, 0.22, 0.08];
  const BELL_DECAYS = [2.4, 1.4, 1.1, 0.7];               // s to near silence
  const AUDIO_VOICES = 72;                                // one-shot voices beyond this are dropped
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const yearOctave = year => 4 + Math.floor(3 * clamp(year - FIRST_YEAR, 0, TURNS - 1) / TURNS);
  const themeMidi = (theme, year) => 62 + 12 * (yearOctave(year) - 4) + PENTATONIC[theme];
  const octaveGain = year => Math.pow(0.8, yearOctave(year) - 4);   // each octave above 4 is 20 % quieter
  const themeNote = (theme, octave) => 62 + 12 * (octave - 4) + PENTATONIC[theme];

  function createSpiraAudio(context, options = {}) {
    const offline = typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext;
    const rate = context.sampleRate;
    const random = seeded(options.seed || 5);
    const between = (a, b) => a + (b - a) * random();
    let enabled = true; let closed = false;
    const audio = { context, offline, scheduled: 0, alive: 0 };

    // Output chain.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = AUDIO_COMPRESSOR.threshold; compressor.ratio.value = AUDIO_COMPRESSOR.ratio; compressor.knee.value = AUDIO_COMPRESSOR.knee;
    compressor.connect(context.destination);
    const tone = context.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 20000; tone.Q.value = 0;
    tone.connect(compressor);
    const master = context.createGain(); master.connect(tone);
    const start0 = context.currentTime;
    if (options.fadeIn === false) master.gain.value = AUDIO_MASTER;
    else { master.gain.setValueAtTime(0, start0); master.gain.linearRampToValueAtTime(AUDIO_MASTER, start0 + AUDIO_FADE_IN); }
    const dry = context.createGain(); dry.connect(master);
    const convolver = context.createConvolver(); convolver.connect(master);
    const send = context.createGain(); send.gain.value = REVERB.send; send.connect(convolver);
    const sendHigh = context.createGain(); sendHigh.gain.value = REVERB.igniteSend; sendHigh.connect(convolver);
    // The chart's ambient music has its own bus, so the score can duck it.
    const ambientIn = context.createGain(); ambientIn.connect(dry);
    const ambientSend = context.createGain(); ambientSend.gain.value = REVERB.send; ambientIn.connect(ambientSend); ambientSend.connect(convolver);
    // Shared white noise (2 s, looped by every noise voice).
    const noiseBuffer = context.createBuffer(1, Math.round(2 * rate), rate);
    { const data = noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1; }
    // Reverb: stereo noise with an exponential decay (-60 dB at 3.2 s) after a 20 ms
    // pre-delay; a one-pole lowpass closes along the tail, so the highs die first.
    function buildImpulse() {
      if (closed) return;
      const pre = Math.round(REVERB.predelay * rate); const length = pre + Math.round(REVERB.seconds * rate);
      const ir = context.createBuffer(2, length, rate); const tau = REVERB.seconds / 6.91;
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch); let low = 0;
        for (let i = pre; i < length; i++) {
          const t = (i - pre) / rate;
          low += (0.75 - 0.6 * Math.min(1, t / REVERB.seconds)) * ((random() * 2 - 1) - low);
          data[i] = low * Math.exp(-t / tau);
        }
      }
      try { convolver.buffer = ir; } catch (error) { /* a closed context */ }
    }
    // A live context builds the impulse just after the opening's first frames, so they never wait.
    if (offline) buildImpulse(); else setTimeout(buildImpulse, 40);
    // One slow LFO sweeps every pad's lowpass by +-300 Hz.
    const lfo = context.createOscillator(); lfo.frequency.value = PAD.lfoHz;
    const lfoDepth = context.createGain(); lfoDepth.gain.value = PAD.lfoDepth;
    lfo.connect(lfoDepth); lfo.start(start0);

    const ready = () => enabled && !closed && (offline || context.state === 'running');
    const roomFor = () => audio.alive < AUDIO_VOICES;
    const at = t => Math.max(t, context.currentTime);
    // Every voice ends in a panner that feeds the dry bus and one reverb send (none for null).
    function out(node, pan, bus) {
      const panner = context.createStereoPanner(); panner.pan.value = clamp(pan || 0, -1, 1);
      node.connect(panner);
      if (bus === ambientIn) { panner.connect(ambientIn); return panner; }
      panner.connect(dry);
      if (bus !== null) panner.connect(bus || send);
      return panner;
    }
    // A source that counts as a voice (scheduled and alive until it ends).
    function voice(source, t, end) {
      audio.scheduled++; audio.alive++;
      source.onended = () => { audio.alive--; };
      source.start(t); source.stop(end);
      return source;
    }
    function oscillator(type, f, into, detune) {
      const o = context.createOscillator(); o.type = type; o.frequency.value = f;
      if (detune) o.detune.value = detune;
      o.connect(into);
      return o;
    }
    function filter(type, f, q) {
      const node = context.createBiquadFilter(); node.type = type; node.frequency.value = f; node.Q.value = q;
      return node;
    }
    function noiseSource(t) {
      const source = context.createBufferSource(); source.buffer = noiseBuffer; source.loop = true;
      source.loopStart = 0; source.loopEnd = noiseBuffer.duration;
      return source;
    }

    /* One-shot voices ------------------------------------------------------- */
    // bell: four sine partials, 4 ms attack, each decaying exponentially to silence.
    function bell(f, t, g, pan = 0, bus) {
      if (!ready() || !roomFor()) return;
      if (!(g > 0)) return;
      t = at(t);
      const sum = context.createGain(); const panner = out(sum, pan, bus);
      for (let k = 0; k < BELL_RATIOS.length; k++) {
        const fk = f * BELL_RATIOS[k]; if (fk > rate * 0.45) continue;
        const amp = context.createGain(); amp.connect(panner);
        const peak = g * BELL_GAINS[k];
        amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(peak, t + 0.004);
        amp.gain.exponentialRampToValueAtTime(peak * 1e-3, t + 0.004 + BELL_DECAYS[k]);
        const o = oscillator('sine', fk, amp);
        if (k === 0) voice(o, t, t + BELL_DECAYS[0] + 0.05); else { o.start(t); o.stop(t + BELL_DECAYS[k] + 0.05); }
      }
    }
    // harp: a triangle and a sine through a 2.8 kHz lowpass, 3 ms attack, 0.9 s decay.
    function harp(f, t, g, pan = 0) {
      if (!ready() || !roomFor()) return;
      if (!(g > 0)) return;
      t = at(t);
      const lowpass = filter('lowpass', 2800, 0); const env = context.createGain();
      lowpass.connect(env); out(env, pan);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g, t + 0.003);
      env.gain.exponentialRampToValueAtTime(g * 1e-3, t + 0.9);
      const triGain = context.createGain(); triGain.gain.value = 0.7; triGain.connect(lowpass);
      const sineGain = context.createGain(); sineGain.gain.value = 0.5; sineGain.connect(lowpass);
      voice(oscillator('triangle', f, triGain), t, t + 0.95);
      const s = oscillator('sine', f, sineGain); s.start(t); s.stop(t + 0.95);
    }
    // pad: per note two triangles at +-5 cents -> lowpass 900 Hz (LFO +-300) -> envelope
    // (attack, sustain, release) -> a gate that can release it early. At most PAD.max alive.
    const pads = [];
    function releasePad(p, t, tau) {
      try {
        p.gate.gain.setTargetAtTime(0, t, tau);
        const end = t + tau * 8;
        if (end < p.end) { for (const o of p.oscs) o.stop(end); p.end = end; }
      } catch (error) { /* already stopped */ }
    }
    function pad(notes, t, dur, g, attack = PAD.attack, release = PAD.release, bus) {
      if (!ready()) return [];
      const made = [];
      t = at(t);
      for (let i = pads.length - 1; i >= 0; i--) if (pads[i].end <= context.currentTime) pads.splice(i, 1);
      attack = Math.min(attack, dur / 2); release = Math.min(release, dur - attack);
      for (let n = 0; n < notes.length; n++) {
        if (pads.length >= PAD.max) releasePad(pads.shift(), t, 0.3);
        const f = midiHz(notes[n]);
        const lowpass = filter('lowpass', PAD.cutoff, 0); lfoDepth.connect(lowpass.frequency);
        const env = context.createGain(); const gate = context.createGain();
        lowpass.connect(env); env.connect(gate);
        out(gate, notes.length > 1 ? lerp(-0.35, 0.35, n / (notes.length - 1)) : 0, bus);
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g, t + attack);
        env.gain.setValueAtTime(g, t + dur - release); env.gain.linearRampToValueAtTime(0, t + dur);
        const end = t + dur + 0.05;
        const a = voice(oscillator('triangle', f, lowpass, -PAD.detune), t, end);
        const b = oscillator('triangle', f, lowpass, PAD.detune); b.start(t); b.stop(end);
        // Unhook the pad from the shared LFO when it ends.
        a.addEventListener('ended', () => { try { lfoDepth.disconnect(lowpass.frequency); } catch (error) { /* gone */ } });
        const entry = { gate, oscs: [a, b], end };
        pads.push(entry); made.push(entry);
      }
      return made;
    }
    function releasePads(t, tau) { while (pads.length) releasePad(pads.shift(), t, tau); }
    // noise: shared noise through a filter whose frequency ramps f0 -> f1, with a pan ramp.
    // Envelopes: 'arc' rises to its peak at 40 % and falls away, 'burst' strikes and decays,
    // 'swell' rises (reverse) and stops short.
    function noise(t, dur, f0, f1, q, g, pan0 = 0, pan1 = pan0, shape = 'arc', type = 'bandpass', highpass = 0, bus) {
      if (!ready() || !roomFor()) return;
      if (!(g > 0)) return;
      t = at(t);
      const source = noiseSource(); let head = source;
      if (highpass) { const hp = filter('highpass', highpass, 0.5); head.connect(hp); head = hp; }
      const shaper = filter(type, f0, q);
      shaper.frequency.setValueAtTime(f0, t); shaper.frequency.exponentialRampToValueAtTime(f1, t + dur);
      head.connect(shaper);
      const env = context.createGain(); shaper.connect(env);
      const panner = out(env, pan0, bus);
      if (pan1 !== pan0) { panner.pan.setValueAtTime(clamp(pan0, -1, 1), t); panner.pan.linearRampToValueAtTime(clamp(pan1, -1, 1), t + dur); }
      if (shape === 'burst') {
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g, t + 0.005);
        env.gain.exponentialRampToValueAtTime(g * 1e-3, t + dur);
      } else if (shape === 'swell') {
        env.gain.setValueAtTime(g * 1e-3, t); env.gain.exponentialRampToValueAtTime(g, t + dur);
        env.gain.linearRampToValueAtTime(0, t + dur + 0.03);
      } else {
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g, t + 0.4 * dur);
        env.gain.linearRampToValueAtTime(0, t + dur);
      }
      source.loopStart = 0;
      audio.scheduled++; audio.alive++;
      source.onended = () => { audio.alive--; };
      source.start(t, random() * 1.9); source.stop(t + dur + 0.06);
    }
    // A meteor's whoosh as a held voice the egg steers each frame: the bandpass sweeps 6 k ->
    // 1.5 kHz with the meteor's progress, the gain follows an arc (peak at 40 %), the pan
    // follows its x, and bullet time lowpasses it and pitches it down. end() releases it.
    function meteorVoice(t, pan, g) {
      if (!ready() || !roomFor() || !(g > 0)) return null;
      t = at(t);
      const source = noiseSource(); const hp = filter('highpass', 1200, 0.5); const band = filter('bandpass', 6000, 0.9); const low = filter('lowpass', 20000, 0);
      source.connect(hp); hp.connect(band); band.connect(low);
      const env = context.createGain(); low.connect(env); const panner = out(env, pan);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g * 0.3, t + 0.1);
      audio.scheduled++; audio.alive++; source.onended = () => { audio.alive--; };
      source.start(t, random() * 1.9); source.stop(t + 30);
      let last = -1; let ended = false;
      return {
        update(progress, p, slow) {
          if (ended || closed) return;
          const now = context.currentTime; if (now - last < 0.05) return; last = now;
          const u = clamp01(progress);
          band.frequency.setTargetAtTime(6000 * Math.pow(0.25, u), now, 0.06);
          env.gain.setTargetAtTime(g * (u < 0.4 ? 0.3 + 0.7 * smooth(u / 0.4) : 1 - 0.75 * smooth((u - 0.4) / 0.6)), now, 0.08);
          panner.pan.setTargetAtTime(clamp(p, -1, 1), now, 0.06);
          low.frequency.setTargetAtTime(20000 * Math.pow(1200 / 20000, clamp01(slow)), now, 0.08);
          source.playbackRate.setTargetAtTime(1 - 0.45 * clamp01(slow), now, 0.08);
        },
        end(tau = 0.08) {
          if (ended || closed) return;
          ended = true;
          const now = context.currentTime;
          try { env.gain.setTargetAtTime(0, now, tau); source.stop(now + tau * 8 + 0.05); } catch (error) { /* already stopped */ }
        }
      };
    }
    // thump: a sine falling 120 -> 38 Hz over 0.45 s (kept out of the reverb).
    function thump(t, g) {
      if (!ready()) return;
      if (!(g > 0)) return;
      t = at(t);
      const env = context.createGain(); out(env, 0, null);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g, t + 0.006);
      env.gain.exponentialRampToValueAtTime(g * 1e-3, t + 0.6);
      const o = oscillator('sine', 120, env);
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
      voice(o, t, t + 0.65);
    }

    /* Continuous layers ----------------------------------------------------- */
    // Each layer is a set of sources into a level gain that only ever ramps forwards in time.
    function layer(build, t, level, fade, pan = 0) {
      const gain = context.createGain(); gain.gain.setValueAtTime(0, t);
      if (level > 0) gain.gain.linearRampToValueAtTime(level, t + fade);
      const panner = out(gain, pan);
      const sources = build(gain, panner);
      for (const s of sources) { s.start(t); audio.scheduled++; audio.alive++; s.onended = () => { audio.alive--; }; }
      return { gain, panner, sources, stopped: false };
    }
    function stopLayer(l, t, tau) {
      if (!l || l.stopped) return;
      l.stopped = true;
      try { l.gain.gain.setTargetAtTime(0, t, tau); for (const s of l.sources) s.stop(t + tau * 8 + 0.05); } catch (error) { /* already stopped */ }
    }
    let drone = null; let air = null; let wind = null; let spin = null; let spinTarget = 0;
    // drone: sines D2 + A2 and a low triangle D3, through a 400 Hz lowpass.
    function droneStart(t, level, fade) {
      if (!ready()) return;
      t = at(t); stopLayer(drone, t, 0.3);
      drone = layer(gain => {
        const lowpass = filter('lowpass', 400, 0); lowpass.connect(gain);
        const parts = [['sine', 38, 0.5], ['sine', 45, 0.35], ['triangle', 50, 0.25]];
        return parts.map(([type, m, level]) => { const g = context.createGain(); g.gain.value = level; g.connect(lowpass); return oscillator(type, midiHz(m), g); });
      }, t, level, fade);
    }
    function droneGlide(t, dur, ratio) {
      if (!drone || drone.stopped) return;
      t = at(t);
      for (const o of drone.sources) { const f = o.frequency.value; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * ratio, t + dur); }
    }
    function airStart(t, level, fade) {
      if (!ready()) return;
      t = at(t); stopLayer(air, t, 0.3);
      air = layer(gain => { const lowpass = filter('lowpass', 1200, 0.3); lowpass.connect(gain); const s = noiseSource(); s.connect(lowpass); return [s]; }, t, level, fade);
    }
    // wind: noise through a bandpass sweeping 250 -> 3500 Hz, easing in, its pan circling.
    function windStart(t, dur) {
      if (!ready()) return;
      t = at(t); stopLayer(wind, t, 0.1);
      wind = layer((gain, panner) => {
        const band = filter('bandpass', 250, 1.1); band.connect(gain);
        band.frequency.setValueAtTime(250, t); band.frequency.exponentialRampToValueAtTime(3500, t + dur);
        const s = noiseSource(); s.connect(band);
        const circle = context.createOscillator(); circle.frequency.setValueAtTime(0.5, t); circle.frequency.linearRampToValueAtTime(2.2, t + dur);
        const depth = context.createGain(); depth.gain.value = 0.75; circle.connect(depth); depth.connect(panner.pan);
        return [s, circle];
      }, t, 0, 0);
      wind.gain.gain.setValueAtTime(WIND_LEVEL * 1e-3, t); wind.gain.gain.exponentialRampToValueAtTime(WIND_LEVEL, t + dur);
    }
    // spin: a soft lowpassed wind that follows the chart's yaw velocity.
    function setSpin(level) {
      level = clamp(level, 0, SPIN_MAX);
      if (Math.abs(level - spinTarget) < 0.002 && !(level === 0 && spinTarget > 0)) return;
      if (!ready()) return;
      if (!spin || spin.stopped) {
        if (level <= 0.001) return;
        spin = layer(gain => { const lowpass = filter('lowpass', 700, 0.4); lowpass.connect(gain); const s = noiseSource(); s.connect(lowpass); return [s]; }, context.currentTime, 0, 0);
      }
      spinTarget = level;
      spin.gain.gain.setTargetAtTime(level, context.currentTime, 0.12);
    }

    /* Chart ambient: pad chords every 9 s (4 s overlap) and sparse bells ------- */
    let ambient = null;
    function ambientStart(t) {
      if (!ready() || ambient) return;
      t = at(t);
      stopLayer(drone, t, 2); stopLayer(air, t, 1); stopLayer(wind, t, 0.3);
      ambient = { chord: 0, next: t, bell: t + between(AMBIENT_BELL[0], AMBIENT_BELL[1]) };
      ambientTick();
    }
    function ambientTick(horizon = 0.6) {
      if (!ambient || !ready()) return;
      const now = context.currentTime;
      // After a suspension the schedule resumes from now rather than catching up.
      if (ambient.next < now - 1) ambient.next = now;
      if (ambient.bell < now - 1) ambient.bell = now + between(1, 3);
      while (ambient.next < now + horizon) {
        pad(CHORDS[ambient.chord], ambient.next, CHORD_EVERY + CHORD_OVERLAP, CHORD_GAIN, PAD.attack, PAD.release, ambientIn);
        ambient.chord = (ambient.chord + 1) % CHORDS.length; ambient.next += CHORD_EVERY;
      }
      while (ambient.bell < now + horizon) {
        bell(midiHz(AMBIENT_NOTES[Math.floor(random() * AMBIENT_NOTES.length)]), ambient.bell, AMBIENT_BELL_GAIN, between(-0.6, 0.6), ambientIn);
        ambient.bell += between(AMBIENT_BELL[0], AMBIENT_BELL[1]);
      }
    }
    function ambientStop(t, tau) { ambient = null; releasePads(at(t), tau); }

    /* Cues: what the egg plays. Times are context seconds. -------------------- */
    const cue = {
      dusk(t) { droneStart(t, DRONE_LEVEL, 2); airStart(t, AIR_LEVEL, 2); },
      // The gather walks a two-octave pentatonic down from D6 (step 10) to D4 (step 0).
      gather(t, step, pan) { harp(midiHz(LADDER[clamp(step, 0, LADDER.length - 1)]), t, GATHER_NOTE, pan); },
      glint(t, dur = 0.9) {
        pad(CHORDS[0], t, 6, 0.05);
        noise(t, dur, 4000, 9000, 0.8, 0.02, -0.6, 0.6, 'arc');
      },
      wind(t, dur) { windStart(t, dur); droneGlide(t, dur, 1.5); },
      hush(t) {
        t = at(t); const tau = HUSH_TIME / 4;
        stopLayer(drone, t, tau); stopLayer(air, t, tau); stopLayer(wind, t, tau); releasePads(t, tau);
      },
      inhale(t, dur) { noise(t, Math.max(0.08, dur), 2000, 2400, 0.5, 0.05, 0, 0, 'swell', 'highpass'); },
      ignite(t) {
        t = at(t);
        thump(t, 0.45);
        [74, 81, 88, 90].forEach((m, i) => bell(midiHz(m), t + [0, 0.012, 0.025, 0.04][i], 0.07, [-0.3, 0.3, -0.15, 0.15][i], sendHigh));
        noise(t, 0.8, 1500, 400, 0.9, 0.08, 0, 0, 'burst', 'bandpass', 0, sendHigh);
        droneStart(t + 0.6, DRONE_LEVEL * 0.7, 3);
      },
      paper(t, theme, year, pan) { bell(midiHz(themeMidi(theme, year)), t, PAPER_NOTE * octaveGain(year), pan); },
      ghost(t) { bell(midiHz(74), t, 0.04, -0.2); bell(midiHz(81), t + 0.02, 0.04, 0.2); },
      ambient(t) { ambientStart(t); },
      whoosh(t, dur, pan0, pan1, g = 0.06) { noise(t, dur, 6000, 1500, 0.9, g, pan0, pan1, 'arc', 'bandpass', 1200); },
      // Catch: a rising four-note harp arpeggio, then bells on the question's two theme notes.
      catch(t, a, b, pan) {
        const first = 3 + Math.min(a, b);
        for (let k = 0; k < 4; k++) harp(midiHz(LADDER[first + k]), t + k * 0.04, 0.045, pan);
        bell(midiHz(themeNote(a, 5)), t + 0.16, 0.05, pan - 0.15); bell(midiHz(themeNote(b, 5)), t + 0.17, 0.05, pan + 0.15);
      },
      // Pin: a bell dyad of the two theme notes and a soft noise bloom.
      pin(t, a, b, pan) {
        bell(midiHz(themeNote(a, 5)), t, 0.06, pan - 0.1); bell(midiHz(themeNote(b, 5)), t + 0.015, 0.06, pan + 0.1);
        noise(t, 0.9, 500, 1800, 0.7, 0.03, pan, pan, 'arc', 'bandpass');
      },
      sparkle(t, pan) {
        for (let k = 0; k < 5; k++) harp(midiHz(LADDER[6 + k]), t + k * 0.025, 0.03, pan);
        noise(t, 0.5, 5000, 10000, 0.8, 0.015, pan - 0.2, pan + 0.2, 'arc');
      },
      hover(t, theme, year, pan) { bell(midiHz(themeMidi(theme, year)), t, HOVER_NOTE * octaveGain(year), pan); },
      dyad(t, a, b, g, pan) { bell(midiHz(themeNote(a, 5)), t, g, pan - 0.1); bell(midiHz(themeNote(b, 5)), t + 0.012, g, pan + 0.1); },
      select(t, theme, year, pan) {
        const f = midiHz(themeMidi(theme, year)); const g = SELECT_NOTE * octaveGain(year);
        bell(f, t, g, pan); bell(f * 2, t + 0.01, g * 0.8, pan);
      },
      // The closing harp walks up the ladder (the mirror of the gather); dawn is a soft pad.
      home(t, step, pan) { harp(midiHz(LADDER[clamp(step, 0, LADDER.length - 1)]), t, GATHER_NOTE, pan); },
      // The score: a year's chord (the four chords in turn; the last year's voiced an octave
      // higher), the final D add9 resolving.
      year(t, k, dur, last = k === TURNS - 1) {
        const chord = CHORDS[k % CHORDS.length];
        return pad(last ? chord.map(m => m + 12) : chord, t, dur, SCORE_CHORD, 0.6, 1.2);
      },
      resolve(t) { return pad(RESOLVE_CHORD, t, 4.5, SCORE_CHORD * 1.15, 0.25, 3); },
      // The dive: a descending whoosh, then a soft ignition-style bell cluster on arrival.
      dive(t, dur) { noise(t, dur, 5000, 600, 0.9, 0.07, 0, 0, 'arc', 'bandpass'); },
      arrive(t) { [74, 81, 88, 90].forEach((m, i) => bell(midiHz(m), t + [0, 0.012, 0.025, 0.04][i], 0.035, [-0.3, 0.3, -0.15, 0.15][i], sendHigh)); },
      dawn(t, dur = 1.4) { pad(DAWN_CHORD, t, dur, 0.04, 0.25, 0.6); },   // quick: the master fades out 0.6 s before the swap
      swell(t) { pad(CHORDS[0], t, 6, 0.07); }
    };

    /* Control ----------------------------------------------------------------- */
    function rampMaster(target, t, dur) {
      const g = master.gain;
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
      g.linearRampToValueAtTime(target, t + dur);
    }
    // (descriptors, so the getters stay live)
    Object.defineProperties(audio, Object.getOwnPropertyDescriptors({
      cue, bell, harp, pad, noise, thump, ambientTick, setSpin, meteorVoice,
      get enabled() { return enabled; },
      get ready() { return ready(); },
      get state() { return closed ? 'closed' : context.state; },
      now() { return context.currentTime; },
      droneStart, droneStop(t, tau) { stopLayer(drone, at(t), tau); },
      airStop(t, tau) { stopLayer(air, at(t), tau); },
      windStop(t, tau) { stopLayer(wind, at(t), tau); },
      ambientStop, get ambient() { return !!ambient; },
      // Release the given pad voices (the score's) over about 4 tau.
      release(entries, tau) { const t = context.currentTime; for (const entry of entries || []) releasePad(entry, t, tau); },
      // The ambient bus ducks (the score) and returns.
      duck(level, dur) {
        if (closed) return;
        const t = context.currentTime; const g = ambientIn.gain;
        if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
        g.linearRampToValueAtTime(level, t + Math.max(0.02, dur));
      },
      get drone() { return !!drone && !drone.stopped; },
      // Core view lowpasses the whole music bus; backing out opens it again.
      muffle(on, dur) {
        if (closed) return;
        const t = context.currentTime; const f = tone.frequency;
        if (typeof f.cancelAndHoldAtTime === 'function') f.cancelAndHoldAtTime(t); else { f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); }
        f.exponentialRampToValueAtTime(on ? CORE_MUFFLE : 20000, t + Math.max(0.05, dur));
      },
      setEnabled(on) {
        if (closed) return;
        enabled = on;
        const t = context.currentTime;
        if (on) {
          if (!offline && context.state === 'suspended') context.resume().catch(() => {});
          rampMaster(AUDIO_MASTER, t, AUDIO_TOGGLE);
        } else {
          rampMaster(0, t, AUDIO_TOGGLE);
          // Once silent, a live context stops entirely (no voices are kept running).
          if (!offline) setTimeout(() => { if (!enabled && !closed && context.state === 'running') context.suspend().catch(() => {}); }, AUDIO_TOGGLE * 1000 + 80);
        }
      },
      // The master fades out, ending at `end` (context seconds).
      fadeOut(end, dur) {
        if (closed) return;
        const t = Math.max(context.currentTime, end - dur);
        rampMaster(0, t, Math.max(0.02, end - t));
      },
      // Close the context; a quick fade first if it is still sounding.
      close(quick) {
        if (closed) return;
        closed = true;
        if (offline) return;
        try {
          if (quick && context.state === 'running') {
            rampMaster(0, context.currentTime, 0.06);
            setTimeout(() => context.close().catch(() => {}), 120);
          } else context.close().catch(() => {});
        } catch (error) { /* already closed */ }
      }
    }));
    return audio;
  }

  /* ---------------------------------------------------------------------------
   * The egg
   * ------------------------------------------------------------------------- */
  let active = false;
  const FOOTNOTE = '.easter-egg-footnote';
  const FAILED_TITLE = 'Could not load. Click to try again.';   // the boot's words for a failed asset load
  let footnoteTitle = null;            // the "*"'s own title while it carries FAILED_TITLE from the egg

  /**
   * Open the egg. options.timeScale speeds the opening up; options.publications (a list shaped
   * like data.js's) stands in for the site's publications (a test hook). On a page without
   * data.js the egg loads it first; if that fails, the egg does not open, as with a failed
   * asset load: no primed audio is kept, the footer's "*" says so, and its next click tries again.
   */
  function open(options) {
    if (active) return;
    active = true;
    options = options || {};
    const given = Array.isArray(options.publications) ? options.publications : sitePublications();
    if (given) { begin(given, options); return; }
    loadPublications().then(list => begin(list, options), error => {
      active = false;
      console.warn('The spiral could not load its papers.', error);
      try { if (window.__spiraAudioContext) window.__spiraAudioContext.close().catch(() => {}); } catch (closing) { /* already closed */ }
      try { delete window.__spiraAudioContext; } catch (deleting) { window.__spiraAudioContext = undefined; }
      const footnote = document.querySelector(FOOTNOTE);
      if (footnote) {
        if (footnoteTitle === null && footnote.title !== FAILED_TITLE) footnoteTitle = footnote.title;
        footnote.title = FAILED_TITLE;
      }
    });
  }
  function begin(list, options) {
    try {
      buildModel(list);
      const footnote = document.querySelector(FOOTNOTE);
      if (footnote && footnoteTitle !== null) footnote.title = footnoteTitle;
      footnoteTitle = null;
      start(options);
    } catch (error) { active = false; console.warn('The spiral could not open.', error); }
  }

  function start(options) {
    const timeScale = Number.isFinite(options.timeScale) && options.timeScale >= 0 ? options.timeScale : 1;
    const html = document.documentElement;
    const body = document.body;
    const previousFocus = document.activeElement;
    const scroll = { x: scrollX, y: scrollY };
    const overflow = body.style.getPropertyValue('overflow');
    const overflowPriority = body.style.getPropertyPriority('overflow');
    // A stable scrollbar gutter, so locking body overflow never shifts the page sideways.
    const gutter = html.style.getPropertyValue('scrollbar-gutter');
    const gutterPriority = html.style.getPropertyPriority('scrollbar-gutter');
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
    for (let y = LAST_YEAR; y >= FIRST_YEAR; y--) if (PAPERS.some(p => p.year === y)) years.push(y);
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
          <button type="button" class="spira-listen" data-listen>${escapeHTML(COPY.listen)}</button>
          <p class="spira-hint">${escapeHTML(coarse ? COPY.hintTouch : COPY.hintPointer)}</p>
        </div>
        <div class="spira-plate-detail" hidden></div>
        <button type="button" class="spira-count is-pending" aria-hidden="true"></button>
        <p class="spira-status" role="status" aria-live="polite"></p>
      </section>
      <p class="spira-note">${escapeHTML(COPY.note)}</p>
      <nav class="spira-themes" aria-label="Five recurring questions">${THEMES.map((theme, j) =>
        `<button type="button" class="spira-theme" data-q="${j}" aria-pressed="false"><span class="spira-dot" style="background:${theme.colour}" aria-hidden="true"></span>${escapeHTML(theme.label)}</button>`).join('')}</nav>
      <div class="spira-actions">
        <button type="button" data-index aria-expanded="false" aria-controls="spira-index">All works</button>
        <button type="button" data-replay>Replay</button>
        <button type="button" data-sound aria-pressed="true"><span data-sound-label>Sound on</span> <span class="spira-key" aria-hidden="true">m</span></button>
        <button type="button" data-close>Close <span class="spira-key" aria-hidden="true">esc</span></button>
      </div>
      <div class="spira-index" id="spira-index" hidden>${years.map(year => `
        <div class="spira-index-year"><p class="spira-index-label">${year}</p>${PAPERS.map((p, i) => p.year !== year ? '' :
          `<a class="spira-index-link"${p.href ? ` href="${escapeHTML(p.href)}"` : ''}${p.local ? '' : ' target="_blank" rel="noopener"'} title="${escapeHTML(p.title)}" data-paper="${i}">${escapeHTML(p.name)} <span>— ${escapeHTML(p.venue)}</span></a>`).join('')}</div>`).join('')}
      </div>
      <p class="spira-toast" aria-hidden="true"></p>
      <div class="spira-opening">
        <button type="button" data-sound aria-pressed="true"><span data-sound-label>Sound on</span> <span class="spira-key" aria-hidden="true">m</span></button>
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
    const soundButtons = [...dialog.querySelectorAll('[data-sound]')];
    const countButton = $('.spira-count');
    const toastEl = $('.spira-toast');
    const listenButton = $('[data-listen]');
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
    // Closing: 'dusk' reverses the iris; 'dawn' runs the opening backwards (closeSource: chart, core, opening).
    let closeKind = ''; let closeT = 0; let closeFromT = 0;
    let closeX = 0; let closeY = 0; let closeCover = 1; let closeR0 = 0; let closeExtent = 1;
    let closeLift = 0; let liftSprite = null; let collapseOn = false; let collapseK = 1; let collapsePhi = 0;
    let closeDone = false; let closeSky = 0; let closeE = 0; let closeSource = ''; let collapseDX = 0; let collapseDY = 0; let canvasWords = 0; let sceneStars = true;
    const closeCam = { x: 0, y: 0, yaw: 0, pitch: 0, scale: 1 };
    const closeText = { x: 0, y: 0, scale: 1, rot: 0 };
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
    let dive = 0; let diveU = 0; let diveWheel = 0; let diveWheelAt = 0; let diveLabels = 1;   // the strange-loop dive
    const corePinch = { a: -1, b: -1, ax: 0, ay: 0, bx: 0, by: 0, start: 0 };
    const stats = { frames: 0, avgMs: 0, maxMs: 0, byPhase: {} };
    const travelStats = { clockwise: 0, counter: 0 };
    for (const name of ['dusk', 'gather', 'wind', 'ignite', 'chart', 'meteor', 'score', 'core', 'dive', 'closing']) stats.byPhase[name] = { frames: 0, avgMs: 0, maxMs: 0 };
    // Sound: the synthesizer (adopted or created on a gesture), the preference and the cue log.
    let audio = null; let soundOn = true; let audioWarned = false; let audioBroken = false; let audioMissed = false; let audioTimer = 0;
    try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (error) { soundOn = true; }
    const audioCues = [];                // test hook: { cue, t: timeline s, at: page ms }
    let cueFrom = -1; let closeCueFrom = -1; let lastGatherNote = -1; let lastHomeNote = -1;
    let hoverNoteAt = -Infinity; let lastMoveAt = 0;
    const noteRandom = seeded(33);
    // Shooting stars: a small pool; one question meteor (or one catch) at a time.
    let skyT = 0; let nextMeteor = METEOR_FIRST; let discovered = false; let activeMeteors = 0;
    const mX0 = new Float32Array(METEOR_MAX); const mY0 = new Float32Array(METEOR_MAX);
    const mDX = new Float32Array(METEOR_MAX); const mDY = new Float32Array(METEOR_MAX);
    // Birth times are Float64: they are compared with the sky clock itself.
    const mSpeed = new Float32Array(METEOR_MAX); const mBorn = new Float64Array(METEOR_MAX); const mPath = new Float32Array(METEOR_MAX);
    const mTail = new Float32Array(METEOR_MAX); const mFade = new Float32Array(METEOR_MAX);
    const mQ = new Int8Array(METEOR_MAX); const mKind = new Uint8Array(METEOR_MAX);   // 0 question, 1 shower, 2 golden
    const mOn = new Uint8Array(METEOR_MAX); const mSounded = new Uint8Array(METEOR_MAX);
    // Travelled distance (integrated, so bullet time can slow a meteor), its speed share, the
    // length it crosses inside the viewport, the invitation flag and its held whoosh voice.
    const mDist = new Float32Array(METEOR_MAX); const mSlow = new Float32Array(METEOR_MAX).fill(1);
    const mCross = new Float32Array(METEOR_MAX); const mInvite = new Uint8Array(METEOR_MAX); const mVoice = new Array(METEOR_MAX).fill(null);
    let invited = false; let hintOverride = '';
    let pointerX = 0; let pointerY = 0; let pointerIn = false; let overMeteor = false;
    const meteorRandom = seeded(Date.now() % 100000);
    // Wishes: caught questions (persisted) and their stars on the next turn.
    const caught = new Uint8Array(NQ); const wishPinned = new Uint8Array(NQ);
    const wishAge = new Float32Array(NQ).fill(99); const wishFade = new Float32Array(NQ);
    const wishSX = new Float32Array(NQ); const wishSY = new Float32Array(NQ); const wishZ = new Float32Array(NQ); const wishVis = new Uint8Array(NQ);
    const wishLabelWidth = new Float32Array(NQ);
    let caughtCount = 0; let drawn = false; let drawnFade = 0; let nextDrawnWidth = 0;
    let hoverWish = -1; let selectedWish = -1; let plateView = '';
    let plateTakeaway = null;          // what the plate shows of a paper's takeaway (a test hook reads it)
    let bridgeQ = -1; let bridgeFade = 0;   // the wish whose two themes are bridged (kept while fading out)   // plateView: '' | 'wishes' | 'drawn'
    // The catch in progress: the meteor decelerates, its letters re-lay into a line, the line
    // folds into a point that arcs to the next turn.
    let catchQ = -1; let catchT = 0; let catchX = 0; let catchY = 0; let catchDX = 0; let catchDY = 0; let catchV = 0; let catchTail = 0;
    let lineCX = 0; let lineCY = 0; let catchFrom = 0;
    // Glyph strip of the active question: each glyph in its own cell, so letters can move alone.
    const MAX_CHARS = 72;
    const glyphCell = new Float32Array(MAX_CHARS); const glyphCellW = new Float32Array(MAX_CHARS);
    const glyphOff = new Float32Array(MAX_CHARS); const glyphAdv = new Float32Array(MAX_CHARS);
    const glyphLX = new Float32Array(MAX_CHARS); const glyphLY = new Float32Array(MAX_CHARS); const glyphHide = new Uint8Array(MAX_CHARS);
    let glyphCanvas = null; let glyphQ = -1; let glyphN = 0; let glyphH = 0; let glyphSize = QUESTION_FONT; let glyphWidth = 0; let glyphDPR = 0;
    // A golden meteor's sparkle (screen space).
    let sparkleX = 0; let sparkleY = 0; let sparkleAge = 99;
    // The score ("Listen to the spiral"): 0 off, 1 playing, 2 the closing words, 3 stopping.
    let score = 0; let scoreT = 0; let scoreCueFrom = -1; let scoreYear = -2; let scoreFade = 0; let scorePads = [];
    let scoreTimer = 0; let scoreLast = 0; let scoreLatest = -1;
    let scoreKicker = null; let scoreBlocks = []; let scoreRows = [];
    // Reduced motion: a still wish waits at a free spot for a while.
    let stillQ = -1; let stillX = 0; let stillY = 0; let stillTimer = 0;
    const uiOpacity = new Map();
    const ui = new Float32Array(4 * 8); let uiCount = 0;
    // Every label and wish star the collision pass may place: focus (2), the score's rung papers
    // and the paper labels (NP each), wish labels (2), themes, years, wish stars and ghost words.
    const MAX_PLACED = 4 + 2 * PAPERS.length + THEMES.length + YEAR_MARKS.length + NQ + GHOST_WORDS.length;
    const placed = new Float32Array(4 * MAX_PLACED); let placedCount = 0;
    const yearWidth = new Float32Array(YEAR_MARKS.length); const themeWidth = new Float32Array(THEMES.length);

    /* ---- Typed scratch (allocation-free frame loop) ---------------------- */
    const random = seeded(20220101);
    const NP = PAPERS.length;
    // Sky depth: the nebula for this layout (built a few rows per frame) and the band's stars,
    // stored bucket by bucket (BAND_ALPHA) so each bucket is one filled path.
    let nebula = null; let nebulaReady = false; let skyDepth = 0;
    const bandX = new Float32Array(BAND_COUNT); const bandY = new Float32Array(BAND_COUNT); const bandS = new Float32Array(BAND_COUNT);
    const bandStart = new Int32Array(BAND_ALPHA.length + 1);
    const paperRing = new Float32Array(NP).fill(-99);   // score time at which each paper rang
    const yearGlow = new Float32Array(YEAR_MARKS.length);
    const paperDim = new Float32Array(NP).fill(1); const paperDelay = new Float32Array(NP);   // dawn: stars dim in reverse order
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
    const PS = PAPER_SPARKS * (NP + NQ + 1);   // papers, then wishes, then the golden sparkle
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
    const WISH_FONT = `italic 12px ${SERIF}`;
    const NEXT_DRAWN = 'next · drawn';
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
    let keptWords = []; let keptDPR = 1;
    let wLine = new Int32Array(0); let lineFirst = new Int32Array(1); let lineMid = new Int32Array(1); let lineCount = 0; let lineDep = new Float32Array(1);
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
    let chromeLeft = 0;
    function measureUI() {
      uiCount = 0;
      chromeLeft = actionsEl.getBoundingClientRect().left;
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
      freeL = left; freeR = right; freeT = top; freeB = bottom;   // meteors cross this area
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
      updateHint();
      focal = sFit * CAM_D;
      const minSide = Math.min(W, H);
      headRho = HEAD_RADIUS * minSide;
      sMax = Math.max(sFit * 1.05, HEAD_START_RADIUS * minSide / radiusAt(THETA_IN));
      placeNearStars();
      placeSkyDepth();
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
        nextDrawnWidth = ctx.measureText(NEXT_DRAWN).width;
        ctx.font = WISH_FONT;
        for (let q = 0; q < NQ; q++) wishLabelWidth[q] = ctx.measureText(QUESTIONS[q].text).width;
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
      atlases = built.atlases; keptDPR = DPR;
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
      keptWords = words;
      fillSprites(words);
      for (let i = 0; i < n; i++) {
        const w = words[i];
        if (w.warmSpot) wKey[i] = w.key;
        wSize[i] = w.style.size;
        if (!tones.has(w.style.night)) tones.set(w.style.night, tones.size);
        wTone[i] = tones.get(w.style.night);
      }
      fillPolar();
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
      }
    }
    function fillSprites(words) {
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        // The local origin of a sprite is its baseline midpoint; at t = 0 it sits on the page baseline.
        wHomeX[i] = w.left + w.width / 2; wHomeY[i] = w.top + w.ascent;
        wAnchorX[i] = wHomeX[i] - w.ox / DPR; wAnchorY[i] = wHomeY[i] - w.oy / DPR;
        wSpriteW[i] = w.sw / DPR; wSpriteH[i] = w.sh / DPR; wDevW[i] = w.sw; wDevH[i] = w.sh;
        wPage[i] = w.daySpot[0]; wDayX[i] = w.daySpot[1]; wDayY[i] = w.daySpot[2];
        wNightPage[i] = w.nightSpot[0]; wNightX[i] = w.nightSpot[1]; wNightY[i] = w.nightSpot[2];
        if (w.warmSpot) { wWarmPage[i] = w.warmSpot[0]; wWarmX[i] = w.warmSpot[1]; wWarmY[i] = w.warmSpot[2]; }
      }
    }
    function fillPolar() {
      // Home in polar form about the viewport centre C, and the home tangent each word unwinds.
      const cx = W / 2; const cy = H / 2;
      for (let i = 0; i < W_N; i++) {
        const dx = wHomeX[i] - cx; const dy = wHomeY[i] - cy;
        wHomeR[i] = Math.max(1, Math.hypot(dx, dy)); wHomeA[i] = Math.atan2(dy, dx);
        // The word turns from upright to riding its lane's tangent as its radius settles;
        // wTurn is the tangent angle at home, wrapped to (-pi, pi], that is unwound.
        let lock = (((wHomeA[i] + SLOT_TILT) % TAU) + TAU) % TAU;
        if (lock > Math.PI) lock -= TAU;
        wTurn[i] = lock;
      }
    }
    /**
     * Before the dawn, re-measure every word from its stored text range. If the page has
     * moved (a resize while open), rebuild the sprites at the new places, so the final swap
     * stays pixel-faithful.
     */
    function refreshHomes() {
      if (!W_N) return;
      const range = document.createRange(); let moved = false;
      for (const w of keptWords) {
        try {
          range.setStart(w.node, w.start); range.setEnd(w.node, w.end);
          const r = range.getBoundingClientRect();
          if (Math.abs(r.left - w.left) > 0.25 || Math.abs(r.top - w.top) > 0.25 || Math.abs(r.width - w.width) > 0.25) {
            w.left = r.left; w.top = r.top; w.width = r.width; w.height = r.height; moved = true;
          }
        } catch (error) { /* the node left the page: keep its last place */ }
      }
      if (moved || keptDPR !== DPR) {
        const old = atlases;
        const built = buildWordSprites(keptWords, DPR);
        if (built.words.length === W_N) {
          for (const atlas of old) { atlas.width = 0; atlas.height = 0; }
          atlases = built.atlases; keptDPR = DPR; fillSprites(keptWords);
        } else for (const atlas of built.atlases) { atlas.width = 0; atlas.height = 0; }
      }
      fillPolar();
    }
    /**
     * Page lines for the dawn: consecutive words of one block whose baselines agree (within
     * half a font size) form a line. A line flies home as one object, anchored on its middle word.
     */
    function groupLines() {
      wLine = new Int32Array(W_N); lineFirst = new Int32Array(W_N + 1); lineMid = new Int32Array(Math.max(1, W_N)); lineCount = 0;
      for (let i = 0; i < W_N; i++) {
        const first = lineCount ? lineFirst[lineCount - 1] : -1;
        const same = first >= 0 && keptWords[first].block === keptWords[i].block &&
          Math.abs(wHomeY[i] - wHomeY[first]) < 0.5 * Math.max(wSize[i], wSize[first]);
        if (!same) lineFirst[lineCount++] = i;
        wLine[i] = lineCount - 1;
      }
      lineFirst[lineCount] = W_N;
      for (let l = 0; l < lineCount; l++) lineMid[l] = (lineFirst[l] + lineFirst[l + 1] - 1) >> 1;
      // Departures in reverse reading order (the last line first, the name's line last), spaced
      // in proportion to how much of each line is legible on the spiral (its width times its
      // scale there, at least a quarter), so tiny inner lines leave in a quick burst and the
      // long outer lines, the bio, unroll one after another.
      lineDep = new Float32Array(lineCount);
      const weight = new Float32Array(lineCount); let total = 0;
      for (let l = 0; l < lineCount; l++) {
        let width = 0; for (let i = lineFirst[l]; i < lineFirst[l + 1]; i++) width += wSpriteW[i];
        weight[l] = width * clamp(wSlotS[lineMid[l]] / spiralS0, 0.25, 1); total += weight[l];
      }
      let before = 0; const span = Math.max(1e-6, total - (lineCount ? weight[0] : 0));
      for (let l = lineCount - 1; l >= 0; l--) { lineDep[l] = DAWN_HOME + DAWN_SPREAD * Math.min(1, before / span); before += weight[l]; }
    }
    const lineDepart = l => lineDep[l];
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
    function drawAperture(radius, edge, layer, cx = W / 2, cy = H / 2, cut = false, rimmed = true) {
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
      const rim = rimmed ? 1 - smooth((radius - corner) / (edge + 8)) : 0;
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
    // The nebula and the band follow the chart centre (behind the galaxy). Under reduced motion
    // (no frame loop) the nebula is built at once; otherwise a few rows per frame.
    function placeSkyDepth() {
      nebula = nebulaFor(W, H, chartX, chartY); nebulaReady = nebula.row >= nebula.th;
      if (!nebulaReady && motion.matches) nebulaReady = nebulaRows(nebula, nebula.th);
      if (nebulaReady && motion.matches) skyDepth = 1;
      const n = narrow ? BAND_COUNT_NARROW : BAND_COUNT; const r = seeded(4242);
      const size = Math.min(W, H); const reach = Math.hypot(W, H) / 2 + NEBULA_MARGIN;
      const sa = Math.sin(NEBULA_ANGLE); const ca = Math.cos(NEBULA_ANGLE);
      for (let b = 0; b <= BAND_ALPHA.length; b++) bandStart[b] = Math.round(b * n / BAND_ALPHA.length);
      for (let i = 0; i < n; i++) {
        // Along the band uniformly; across it Gaussian (a few strays twice as wide).
        const along = (r() * 2 - 1) * reach; const across = gaussian(r) * 0.08 * size * (r() < 0.15 ? 2 : 1);
        bandX[i] = chartX + along * ca - across * sa; bandY[i] = chartY + along * sa + across * ca; bandS[i] = 0.6 + 0.7 * r();
      }
    }
    // The nebula and band, one drawImage plus one path per alpha bucket, swaying gently with the
    // camera (sin of its yaw, and its pitch): a fraction of the stars' parallax.
    function drawNebula(alpha, atop) {
      if (!nebula || !nebulaReady || alpha <= 0.004) return;
      const offX = NEBULA_SWAY * sYaw; const offY = NEBULA_TILT * (Math.atan2(sPitch, cPitch) - restPitch);
      ctx.globalCompositeOperation = atop ? 'source-atop' : 'source-over'; ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = NEBULA_ALPHA * alpha * skyDepth;
      ctx.drawImage(nebula.canvas, offX - NEBULA_MARGIN, offY - NEBULA_MARGIN, nebula.tw * NEBULA_CELL, nebula.th * NEBULA_CELL);
      ctx.fillStyle = '#dfe7f2';
      for (let b = 0; b < BAND_ALPHA.length; b++) {
        ctx.globalAlpha = BAND_ALPHA[b] * alpha * skyDepth; ctx.beginPath();
        for (let i = bandStart[b]; i < bandStart[b + 1]; i++) ctx.rect(bandX[i] + offX, bandY[i] + offY, bandS[i], bandS[i]);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // In the opening the sky deepens after the dusk.
    const skyIn = time => smooth((time - T_DUSK) / 1.0);
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
      if (sceneStars) { drawNebula(layer * (chart ? 1 : skyIn(time))); drawStars(layer); }
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
          const a = sectorCentre(j); let emphasis = theme < 0 ? 0.2 : theme === j ? 0.55 : 0.06;
          if (chart && bridgeQ >= 0 && (QUESTIONS[bridgeQ].a === j || QUESTIONS[bridgeQ].b === j)) emphasis = Math.max(emphasis, BRIDGE_ALPHA * bridgeFade);
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
      if (last >= INDEX_FIRST && research > 0.004) {
        ctx.beginPath(); ctx.moveTo(sampleSX[INDEX_FIRST], sampleSY[INDEX_FIRST]);
        for (let i = INDEX_FIRST + 1; i <= solidLast; i++) ctx.lineTo(sampleSX[i], sampleSY[i]);
        if (solidHead) ctx.lineTo(headX, headY);
        ctx.stroke();
      }
      for (let c = 0; c <= solidLast && research > 0.004; c += CURVE_CHUNK) {
        const end = Math.min(c + CURVE_CHUNK, solidLast); const mid = (c + end) >> 1;
        const weight = clamp01(mid / INDEX_END);
        const tail = mid < INDEX_FIRST ? 0.6 : 1;
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
        // In the chart, each pinned wish draws a piece of the whole next turn around its star;
        // with all ten the dashes give way to a soft solid line.
        const ring = chart && (wishShown() || drawnFade > 0);
        const ringShow = smooth(span(time, T_UI));
        const lastF = ring ? INDEX_NEXT : last;
        for (let i = last + 1; i <= lastF; i++) {
          project(SAMPLE_X[i], SAMPLE_Y[i], 0);
          sampleSX[i] = PX; sampleSY[i] = PY; sampleDepth[i] = depthFactor(PZ);
        }
        ctx.setLineDash(DASH_FUTURE);
        const total = THETA_STOP - THETA_END; const chunk = ring ? 4 : 12;
        for (let c = INDEX_END; c <= lastF; c += chunk) {
          const end = Math.min(c + chunk, lastF); const mid = (c + end) >> 1;
          const along = (THETA_IN + mid * D_THETA - THETA_END) / total;
          let alpha = mid <= last ? FUTURE_ALPHA * (1 - along) : 0;
          if (ring) alpha = Math.max(alpha, FUTURE_ALPHA * ringShow * wishCover((mid - INDEX_END) * D_THETA)) * (1 - drawnFade);
          if (alpha > 0.004) {
            ctx.globalAlpha = alpha * sampleDepth[mid] * research;
            ctx.beginPath(); ctx.moveTo(sampleSX[c], sampleSY[c]);
            for (let i = c + 1; i <= end; i++) ctx.lineTo(sampleSX[i], sampleSY[i]);
            if (end === last && !ring) ctx.lineTo(headX, headY);
            ctx.stroke();
          }
          if (end === lastF) break;
        }
        ctx.setLineDash(NO_DASH);
        if (ring && drawnFade > 0) {
          for (let c = INDEX_END; c < INDEX_NEXT; c += 12) {
            const end = Math.min(c + 12, INDEX_NEXT); const mid = (c + end) >> 1;
            ctx.globalAlpha = DRAWN_ALPHA * drawnFade * ringShow * sampleDepth[mid] * research;
            ctx.beginPath(); ctx.moveTo(sampleSX[c], sampleSY[c]);
            for (let i = c + 1; i <= end; i++) ctx.lineTo(sampleSX[i], sampleSY[i]);
            ctx.stroke();
          }
        }
      }
      if (!chart) drawComet(time, head, headX, headY, layer);
      drawPapers(time, chart, research);
      if (chart) drawBridge(research);
      if (chart) drawWishes(research * smooth(span(time, T_UI)));
      if (chart) drawScoreComet(research);
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
      drawCometBody(head, x, y, show);
    }
    function drawCometBody(head, x, y, show) {
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
    // A star's ignition at (x, y) and age: a flash, a ring and short tapered sparks (spark
    // directions from index base). Drawn in 'lighter' mode; analytic in the age, so no state.
    function drawBurst(x, y, age, sprite, colour, base, sparks, layer) {
      if (age < PAPER_FLASH.time) {
        const u = age / PAPER_FLASH.time; const radius = PAPER_FLASH.radius * (0.45 + 0.55 * easeOutCubic(u));
        ctx.globalAlpha = PAPER_FLASH.alpha * (1 - u) * layer;
        ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
        ctx.globalAlpha = 0.6 * (1 - u) * (1 - u) * layer;
        ctx.drawImage(sprites.white, x - radius * 0.4, y - radius * 0.4, radius * 0.8, radius * 0.8);
      }
      if (age < PAPER_RING.time) {
        const u = age / PAPER_RING.time;
        ctx.globalAlpha = PAPER_RING.alpha * (1 - u) * (1 - u) * layer; ctx.strokeStyle = colour; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, PAPER_RING.radius * easeOutCubic(u)), 0, TAU); ctx.stroke();
      }
      if (age < PAPER_SPARK_LIFE[1]) {
        // A quick sparkle: short tapered trails (two segments) that are gone within 0.6 s.
        ctx.strokeStyle = colour; ctx.lineCap = 'round';
        for (let s = 0; s < sparks; s++) {
          const i = base + s; const life = pSparkLife[i]; if (age >= life) continue;
          const reach = pSparkSpeed[i] / PAPER_SPARK_DRAG;
          const d2 = reach * (1 - Math.exp(-PAPER_SPARK_DRAG * age));
          const d1 = reach * (1 - Math.exp(-PAPER_SPARK_DRAG * Math.max(0, age - PAPER_SPARK_TRAIL / 2)));
          const d0 = reach * (1 - Math.exp(-PAPER_SPARK_DRAG * Math.max(0, age - PAPER_SPARK_TRAIL)));
          const fade = 1 - age / life; const a = fade * fade * layer;
          ctx.globalAlpha = a; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + pSparkDX[i] * d1, y + pSparkDY[i] * d1); ctx.lineTo(x + pSparkDX[i] * d2, y + pSparkDY[i] * d2); ctx.stroke();
          ctx.globalAlpha = a * 0.4; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(x + pSparkDX[i] * d0, y + pSparkDY[i] * d0); ctx.lineTo(x + pSparkDX[i] * d1, y + pSparkDY[i] * d1); ctx.stroke();
        }
      }
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
        const a = depthFactor(PZ) * dim * layer * paperDim[p];
        if (a <= 0.004) continue;
        const lit = theme === paper.theme ? 1.25 : 1;
        ctx.globalCompositeOperation = 'lighter';
        const glow = focus ? PAPER_GLOW + 6 : PAPER_GLOW;
        ctx.globalAlpha = Math.min(1, 0.75 * a * lit);
        ctx.drawImage(sprites.themes[paper.theme], PX - glow, PY - glow, glow * 2, glow * 2);
        ctx.globalAlpha = 0.22 * a; ctx.drawImage(sprites.glint, PX - 8, PY - 8, 16, 16);
        // Ignition: a flash, a ring and sparks, all analytic in the star's age.
        if (age < PAPER_SPARK_LIFE[1]) drawBurst(PX, PY, age, sprites.themes[paper.theme], THEME_RGBA[paper.theme], p * PAPER_SPARKS, sparks, layer);
        // The score rings it again, with a smaller sparkle.
        const rung = chart && score && !motion.matches ? scoreT - paperRing[p] : -1;
        if (rung >= 0 && rung < PAPER_SPARK_LIFE[1]) {
          drawBurst(PX, PY, rung, sprites.themes[paper.theme], THEME_RGBA[paper.theme], p * PAPER_SPARKS, Math.round(sparks * SCORE_SPARKLE), layer * SCORE_SPARKLE);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, (0.85 + 0.15 * dim) * a + 0.1); ctx.fillStyle = '#f4f7fb';
        ctx.beginPath(); ctx.arc(PX, PY, 1.2, 0, TAU); ctx.fill();
        // Reduced motion: the score highlights each paper in place as it rings.
        if (focus || (chart && score && motion.matches && p === scoreLatest)) {
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
      // Paper labels never cover another star (or a wish star).
      for (let p = 0; p < NP; p++) {
        if (p === self || !paperVis[p]) continue;
        if (paperSX[p] > x - 4 && paperSX[p] < x + w + 4 && paperSY[p] > y - 3 && paperSY[p] < y + h + 3) return true;
      }
      for (let q = 0; q < NQ; q++) {
        if (!wishVis[q]) continue;
        if (wishSX[q] > x - 4 && wishSX[q] < x + w + 4 && wishSY[q] > y - 3 && wishSY[q] < y + h + 3) return true;
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
      ctx.globalAlpha = alpha * dimFor(labelX, labelY, labelX + labelWidth[p] + 2, labelY + 14);
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
      // The laid-out question's box dims labels from the re-lay until the line folds away.
      labelDim = chart && catchQ >= 0 ? smooth((catchT - CATCH_RELAY[0]) / 0.3) * (1 - smooth((catchT - CATCH_FOLD) / CATCH_COLLAPSE)) : 0;
      // No labels in core view; they fade out early in the flight towards it (and appear in a
      // dive's arriving galaxy only once it is large enough).
      layer *= (1 - smooth(coreU * 3)) * diveLabels;
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
        ctx.globalAlpha = layer * dimFor(labelX - 3, labelY - 1, labelX + focusWidth[p] + 5, labelY + 15); ctx.fillText(FOCUS_LABELS[p], labelX + 1, paperSY[p]);
      }
      // 2b. Papers the score has just rung are named brightly (they fade back after SCORE_GLOW s).
      if (chart && score) {
        ctx.fillStyle = '#f4f7fb';
        for (let p = 0; p < NP; p++) {
          const boost = scoreBoost(p);
          if (boost <= 0.02 || !paperVis[p] || paperDone[p]) continue;
          paperLabelBox(p);
          if (blocked(labelX, labelY, labelWidth[p] + 2, 14, p)) continue;
          paperDone[p] = 1; if (labelPrimary) paperFade[p] = 1;
          addObstacle(labelX - 3, labelY - 1, labelX + labelWidth[p] + 5, labelY + 15);
          drawPaperLabel(p, layer * lerp(0.75, 1, boost));
        }
        ctx.fillStyle = LABEL_COLOUR;
      }
      // A selected or hovered wish star names its question, in the warm serif, above it.
      if (chart) {
        ctx.font = WISH_FONT; ctx.fillStyle = WARM;
        for (let pass = 0; pass < 2; pass++) {
          const q = pass === 0 ? selectedWish : hoverWish;
          if (q < 0 || !wishVis[q] || (pass === 1 && q === selectedWish)) continue;
          const w = wishLabelWidth[q];
          let x = wishSX[q] + 11; if (x + w > W - EDGE_INSET) x = wishSX[q] - 11 - w;
          x = clamp(x, EDGE_INSET, Math.max(EDGE_INSET, W - EDGE_INSET - w));
          const y = clamp(wishSY[q] - 14, EDGE_INSET + 7, H - EDGE_INSET - 7);
          addObstacle(x - 3, y - 8, x + w + 3, y + 8);
          ctx.globalAlpha = layer * dimFor(x - 3, y - 8, x + w + 3, y + 8); ctx.fillText(QUESTIONS[q].text, x, y);
        }
        ctx.font = LABEL_FONT; ctx.fillStyle = LABEL_COLOUR;
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
          ctx.globalAlpha = 0.8 * themeShow * fade * (theme < 0 || theme === j ? 1 : 0.3) * depthFactor(PZ) * dimFor(x - half, y - 7, x + half, y + 7);
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
        const nextDrawn = drawn && m === YEAR_MARKS.length - 1;
        const right = ux < 0; const x = lx + ux * 6; const y = ly + uy * 6; const w = nextDrawn ? nextDrawnWidth : yearWidth[m];
        const x0 = right ? x - w : x;
        const placedHere = !blocked(x0 - 2, y - 7, w + 4, 14, -2);
        const fade = labelPrimary ? (yearFade[m] = easeLabel(yearFade[m], placedHere ? 1 : 0)) : placedHere ? 1 : 0;
        if (placedHere) addObstacle(x0 - 3, y - 7, x0 + w + 3, y + 7);
        if (fade <= 0.01) continue;
        ctx.textAlign = right ? 'right' : 'left';
        ctx.globalAlpha = 0.85 * seen * fade * dimFor(x0 - 2, y - 7, x0 + w + 2, y + 7); ctx.fillStyle = m === YEAR_MARKS.length - 1 ? LABEL_COLOUR : MUTED_COLOUR;
        ctx.fillText(nextDrawn ? NEXT_DRAWN : mark.label, x, y);
        // The score's current year glows warm.
        if (labelPrimary) yearGlow[m] = easeLabel(yearGlow[m], chart && score === 1 && scoreYear === m ? 1 : 0);
        if (yearGlow[m] > 0.01) { ctx.globalAlpha = yearGlow[m] * seen * fade; ctx.fillStyle = WARM; ctx.fillText(mark.label, x, y); }
      }
      // Wish stars keep paper labels and ghost words off them (theme and year labels come first).
      if (chart) for (let q = 0; q < NQ; q++) if (wishVis[q]) addObstacle(wishSX[q] - 6, wishSY[q] - 6, wishSX[q] + 6, wishSY[q] + 6);
      // 5. Paper labels: the selected theme's, else all; nearer stars first (insertion sort over all papers).
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
          ctx.globalAlpha = GHOST_ALPHA * ghostShow * fade * (1 - 0.35 * GHOST_AT[g]) * dimFor(ghostX - ghostW / 2, ghostY - ghostH / 2, ghostX + ghostW / 2, ghostY + ghostH / 2);
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
      if (el === openingEl || el === actionsEl) { if (value >= 1) el.style.removeProperty('--spira-fade'); else el.style.setProperty('--spira-fade', String(value)); }
      else if (value >= 1) el.style.removeProperty('opacity'); else el.style.opacity = String(value);
    }
    function renderOpening(time, layer) {
      const dusk = time < T_DUSK;
      const radius = dusk ? apertureRadius(time) : 0; const edge = edgeOf(radius);
      openingCamera(time);
      if (dusk) drawAperture(radius, edge, layer);
      if (time < T_IGNITE) {
        if (!dusk) drawNebula(layer * skyIn(time));
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
      if (dive) { renderDive(now); return; }
      chartCamera(); drawScene(t, true, u);
      drawSky(u);
    }

    function frame(now) {
      raf = 0;
      if (closed || (leaving && mode !== 'closing')) return;
      if (document.hidden) { lastNow = 0; return; }
      const real = lastNow ? Math.max(0, now - lastNow) / 1000 : 0;
      lastNow = now;
      const dt = Math.min(real, 1 / 30);
      if (nebula && !nebulaReady) nebulaReady = nebulaRows(nebula, NEBULA_ROWS);
      if (nebulaReady && skyDepth < 1) skyDepth = Math.min(1, skyDepth + dt);
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
      // The dawn's last frame: glyphs return and the dialog leaves in this same task, one paint.
      if (closeDone) { cleanup(); return; }
      labelEase = 1; labelSlideEase = 1;   // renders outside the frame loop (on demand) settle labels at once
      schedule();
    }
    function record(ms) {
      const name = phase !== 'chart' ? phase : dive ? 'dive' : coreU > 0 || coreTarget ? 'core' : score === 1 ? 'score' : activeMeteors > 0 || catchQ >= 0 ? 'meteor' : 'chart';
      const entry = stats.byPhase[name] || stats.byPhase.chart;
      entry.frames++; entry.avgMs += (ms - entry.avgMs) / entry.frames; entry.maxMs = Math.max(entry.maxMs, ms);
      stats.frames++; stats.avgMs += (ms - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, ms);
    }
    function step(dt, now) {
      if (mode === 'closing') {
        closeT += dt * timeScale; closeE += dt * timeScale;
        closingCues();
        const fade = 1 - smooth(span(closeE, DAWN_UI));
        for (const [el, from] of closeUIFrom) setOpacity(el, from * fade);
        // The swap happens in the frame that reaches the end (see frame()).
        if (closeT >= (closeKind === 'dusk' ? CLOSE_DUSK : DAWN_END)) closeDone = true;
        return;
      }
      if (mode === 'opening') {
        t += dt * timeScale;
        setPhase(phaseAt(t));
        openingCues();
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
      stepBridge(dt);
      if (dive) { stepDive(dt); return; }
      if (!motion.matches) stepScore(dt);
      stepSky(dt);
      if (audio && soundOn) {
        // Spinning the galaxy fast makes a soft wind that follows |yaw velocity|.
        const held = drag.id >= 0 && performance.now() - lastMoveAt > 90;
        const level = coreU > 0 || motion.matches || held ? 0 : SPIN_MAX * smooth((Math.abs(vYaw) - 0.6) / 4);
        try { audio.setSpin(level); } catch (error) { audioFailed(error); }
      }
      if (coreTarget !== coreU) coreU = motion.matches ? coreTarget : clamp01(coreU + (coreTarget ? 1 : -1) * dt * timeScale / CORE_FLIGHT);
      if (coreTarget && !motion.matches) coreSpin += CORE_SPIN * dt;
      if (coreU > 0) return;   // the chart camera is held while the core is open
      if (!motion.matches) {
        if (drag.id < 0 && (vYaw || vPitch)) {
          yaw += vYaw * dt; pitch = clamp(pitch + vPitch * dt, PITCH_RANGE[0], PITCH_RANGE[1]);
          const decay = Math.exp(-dt / INERTIA_TAU); vYaw *= decay; vPitch *= decay;
          if (Math.abs(vYaw) < 1e-3 && Math.abs(vPitch) < 1e-3) { vYaw = 0; vPitch = 0; }
        }
        if (performance.now() - lastInteraction > IDLE_DELAY_MS && !score) yaw += DRIFT * dt;   // the drift pauses for the score
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
      // The sky empties (a catch in progress is pinned at once); the opening's cues start again.
      finishCatch(); clearMeteors(); stillQ = -1; clearTimeout(stillTimer); stillTimer = 0;
      cueFrom = -1; lastGatherNote = -1;
      if (audio) { try { audio.ambientStop(audio.now(), 0.4); } catch (error) { audioFailed(error); } }
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
      // The sky clock starts with the chart; the drone gives way to the ambient.
      if (wasOpening) { skyT = 0; nextMeteor = METEOR_FIRST; sparkleAge = 99; }
      cue('ambient', t, a => a.cue.ambient(a.now()));
      if (motion.matches) scheduleStill();
      if (wasOpening && (!dialog.contains(document.activeElement) || openingEl.contains(document.activeElement) || document.activeElement === dialog)) {
        stage.focus({ preventScroll: true });
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
      stage.focus({ preventScroll: true });   // Space then catches meteors; Close keeps its own Space
      announce('The research spiral is ready.');
      if (instant) redraw(); else schedule();
    }
    function replay() {
      if (mode !== 'chart' || motion.matches || !ctx || closed || leaving) return;
      stopScore(); score = 0;
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
      clearTimeout(stillTimer); clearInterval(audioTimer); clearTimeout(chromeTimer); clearTimeout(toastTimer); clearInterval(scoreTimer); stillTimer = 0; audioTimer = 0; scoreTimer = 0;
      if (audio) { try { audio.close(!closeDone); } catch (error) { /* already closed */ } audio = null; }
      // A context primed for an egg that never adopted it is closed too.
      if (window.__spiraAudioContext) { try { window.__spiraAudioContext.close().catch(() => {}); } catch (error) { /* ignore */ } try { delete window.__spiraAudioContext; } catch (error) { window.__spiraAudioContext = undefined; } }
      html.classList.remove('spira-hide-text');
      releaseWords();
      try { if (dialog.open) dialog.close(); } catch (error) { /* already closed */ }
      dialog.remove();
      if (overflow) body.style.setProperty('overflow', overflow, overflowPriority);
      else body.style.removeProperty('overflow');
      if (gutter) html.style.setProperty('scrollbar-gutter', gutter, gutterPriority);
      else html.style.removeProperty('scrollbar-gutter');
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      if (scrollX !== scroll.x || scrollY !== scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      active = false;
    }
    /**
     * Close as dawn, the exact reverse of the opening. The UI fades and the galaxy collapses
     * into its nucleus while the camera returns to the opening's pose; the text spiral blooms
     * out of the nucleus; the words fly home in reverse reading order (the name last); then
     * the night iris closes from the edges and each word turns from night to day colour as
     * daylight reaches it. Only on the final frame are the page glyphs restored and the dialog
     * removed, in one paint. During the dusk the iris simply reverses. A second request, a
     * hidden tab, a resize, reduced motion or pagehide finish at once.
     */
    function close() {
      if (closed) return;
      if (leaving) { cleanup(); return; }
      if (motion.matches || !ctx || document.hidden) { cleanup(); return; }
      leaving = true;
      if (drag.id >= 0) endDrag(true);
      closeT = 0; closeE = 0; closeFromT = mode === 'replay-out' ? T_SETTLED : t;
      // The camera's pose now; the starfield eases from it back to the opening's first pose.
      if (mode === 'opening') openingCamera(t); else chartCamera();
      closeCam.x = camX; closeCam.y = camY; closeCam.yaw = Math.atan2(sYaw, cYaw); closeCam.pitch = Math.atan2(sPitch, cPitch); closeCam.scale = focal / camDist;
      if (mode === 'opening' && t < T_DUSK && t < T_DEPART[0]) {
        closeKind = 'dusk'; closeR0 = apertureRadius(t);
      } else {
        closeKind = 'dawn';
        refreshHomes(); groupLines();
        // The disc's soft band lies inside its radius, so it starts with the band past the corners.
        const corner = Math.hypot(W / 2, H / 2);
        closeCover = corner + DAWN_EDGE[2] + MASK_CELL + 2;
        closeLift = dialog.classList.contains('is-lift') ? 1 : 0;
        if (closeLift && !liftSprite) liftSprite = buildLift();
        if (mode === 'opening') {
          // Later opening phases jump straight to the flight home, crossfading from the frame now.
          closeSource = 'opening'; closeT = DAWN_HOME;
        } else if (coreTarget === 1 || coreU >= 0.5) {
          // From the core view the visible text spiral scales straight to its hero size.
          closeSource = 'core';
          project(0, 0, 0); const ox = PX; const oy = PY;
          project(CORE_WORLD_R, 0, 0);
          closeText.x = ox; closeText.y = oy;
          closeText.scale = Math.max(1e-3, Math.hypot(PX - ox, PY - oy) / spiralR0);
          closeText.rot = Math.atan2(PY - oy, PX - ox) + coreSpin;
        } else {
          closeSource = 'chart';
          project(0, 0, 0); closeX = PX; closeY = PY;
          closeExtent = Math.max(W, H);
          // Paper stars dim in reverse spiral order: the latest first.
          for (let p = 0; p < NP; p++) {
            let rank = 0; for (let q = 0; q < NP; q++) if (PAPERS[q].theta > PAPERS[p].theta) rank++;
            paperDelay[p] = rank / Math.max(1, NP - 1) * 0.35;
          }
        }
      }
      closeUIFrom.clear();
      for (const el of [headEl, ...chartBlocks, indexEl, openingEl]) closeUIFrom.set(el, uiOpacity.has(el) ? uiOpacity.get(el) : 1);
      closeSky = mode === 'chart' ? 1 : 0;
      clearInterval(scoreTimer); scoreTimer = 0; scorePads = [];
      for (let i = 0; i < METEOR_MAX; i++) if (mVoice[i]) { try { mVoice[i].end(0.2); } catch (error) { /* closing */ } mVoice[i] = null; }
      closeCueFrom = closeT - 1e-6; lastHomeNote = -1;
      soundClose();
      clearTimeout(stillTimer); stillTimer = 0;
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
      // can stand in for the dialog background while the night recedes.
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
      // Scale and turn about the origin's screen position, carrying it to (collapseDX, collapseDY).
      setBase(c, sn, -sn, c, collapseDX - (c * closeX - sn * closeY), collapseDY - (sn * closeX + c * closeY));
    }
    function heroSpin() { return spinAt(T_WIND); }
    function closeStep() {
      if (mode !== 'closing') return '';
      if (closeKind === 'dusk') return 'dusk';
      if (closeT < DAWN_BLOOM[0] && closeSource === 'chart') return 'collapse';
      if (closeT < DAWN_HOME) return 'bloom';
      if (closeT < DAWN_IRIS[0]) return 'home';
      return 'dawn';
    }
    function renderClosing() {
      if (closeKind === 'dusk') {
        const u = clamp01(closeT / CLOSE_DUSK);
        const radius = lerp(closeR0, -EDGE_MIN, easeInOutSine(u)); const edge = edgeOf(Math.max(0, radius));
        openingCamera(closeFromT);
        drawAperture(radius, edge, 1);
        drawStars(1, radius, edge);
        drawWords(closeFromT, 1, radius, edge);
        return;
      }
      const ct = closeT; const cx = W / 2; const cy = H / 2;
      // Night: full until the dawn, then a disc shrinking onto C, slowly while it is large and
      // quickly at the end (r = R (1 - easeInCubic(u))), so a small dark disc lasts an instant.
      // Its crisp edge band lies inside r: nightAt() is centred on bandR = r - edge / 2.
      const irisU = span(ct, DAWN_IRIS);
      const irisR = closeCover * (1 - easeInCubic(irisU));
      const irisE = clamp(DAWN_EDGE[0] * irisR, DAWN_EDGE[1], DAWN_EDGE[2]);
      const bandR = irisR - irisE / 2;
      if (irisR > 0.5) drawAperture(bandR, irisE, 1, cx, cy, false, false);
      if (irisR > 0.5) drawNebula(1 - smooth(irisU * 2.5), true);
      const uc = span(ct, DAWN_COLLAPSE); const e = easeInOutCubic(uc);
      if (closeLift && liftSprite && uc < 1) { ctx.globalAlpha = 1 - smooth(uc); ctx.drawImage(liftSprite, 0, 0, W, H); }
      // The starfield eases from the camera's pose at the close back to the opening's first pose.
      setCamera(lerp(closeCam.x, cx, e), lerp(closeCam.y, cy, e), lerp(closeCam.yaw, yawStart, e),
        lerp(closeCam.pitch, 0, e), Math.exp(lerp(Math.log(closeCam.scale), Math.log(sMax), e)));
      if (irisU > 0) { if (irisR > 0.5) drawStars(1, bandR, irisE); } else drawStars(1);
      if (closeSource === 'chart' && uc < 1) {
        // The galaxy collapses into its nucleus (easeInOutCubic), turning a little, while its
        // origin travels to C; paper stars dim in reverse spiral order.
        collapseK = Math.exp(-Math.log(closeExtent / 1.5) * e); collapsePhi = DAWN_COLLAPSE_TURNS * TAU * e;
        collapseDX = lerp(closeX, cx, e); collapseDY = lerp(closeY, cy, e);
        for (let p = 0; p < NP; p++) paperDim[p] = 1 - smooth((uc - paperDelay[p]) / 0.25);
        collapseOn = true; sceneStars = false;
        chartCamera(); drawScene(t, true, 1 - smooth((uc - 0.6) / 0.4));
        collapseOn = false; sceneStars = true; setBase(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash(NO_DASH);
      }
      // The nucleus brightens as the galaxy falls in, then gives way to the blooming text.
      if (closeSource === 'chart') {
        const glow = smooth(uc) * (1 - smooth(span(ct, [DAWN_BLOOM[0], DAWN_BLOOM[1] + 0.2])));
        if (glow > 0.01) {
          const nx = lerp(closeX, cx, e); const ny = lerp(closeY, cy, e);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.85 * glow; ctx.drawImage(sprites.bulge, nx - 46, ny - 46, 92, 92);
          ctx.globalAlpha = 0.7 * glow; ctx.drawImage(sprites.white, nx - 9, ny - 9, 18, 18);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      // Meteors and a catch in progress stop where they are and fade with the UI.
      if (closeSky) { const fade = 1 - smooth(span(closeE, DAWN_UI)); if (fade > 0.004) drawSky(fade); }
      // From a later opening phase: the frame at the close fades into the flight home.
      let wordsLayer = 1;
      if (closeSource === 'opening' && closeE < DAWN_CROSSFADE) {
        const u = closeE / DAWN_CROSSFADE;
        labelPrimary = false; renderOpening(closeFromT, 1 - u); labelPrimary = true;
        setBase(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash(NO_DASH);
        wordsLayer = u;
      }
      drawDawnWords(ct, irisU > 0 ? bandR : undefined, irisE, wordsLayer);
      if (irisU > 0 && irisR > irisE) {
        // A 1 px luminous rim on the night side of the band (nothing on the day side).
        const inner = irisR - irisE; const rim = 1 - smooth((inner - Math.hypot(cx, cy)) / 8);
        if (rim > 0.01) {
          ctx.beginPath(); ctx.arc(cx, cy, inner, 0, TAU);
          ctx.globalAlpha = 0.8 * rim; ctx.strokeStyle = RIM_COLOUR; ctx.lineWidth = 1; ctx.stroke();
        }
      }
      if (ct >= DAWN_GLINT[0]) {
        // Where the disc closes, a tiny warm glint opens and fades.
        const u = span(ct, DAWN_GLINT); const size = 12 + 26 * easeOutCubic(u);
        const alpha = smooth(u / 0.2) * (1 - smooth((u - 0.3) / 0.7));
        ctx.globalCompositeOperation = 'source-over';
        // Twice, so its hairline arms read on a white page.
        ctx.globalAlpha = alpha; ctx.drawImage(sprites.glintGold, cx - size / 2, cy - size / 2, size, size);
        ctx.drawImage(sprites.glintGold, cx - size / 2, cy - size / 2, size, size);
        ctx.fillStyle = DAWN_GLINT_FILL;
        ctx.beginPath(); ctx.arc(cx, cy, 1.6 * (1 - u) + 0.5, 0, TAU); ctx.fill();
      }
    }
    /**
     * Words during the dawn. The text spiral is a 2D similarity of its hero layout (centre,
     * scale, turn): it blooms from the nucleus (or scales from the core view) to the hero
     * frame. Then page lines fly home in reverse reading order, line by line, each word of a
     * line a ripple after its left neighbour on one shared easing, so every arc of the
     * spiral visibly unrolls into its straight page line. Words land exactly on their page
     * rects, and turn from night to day colour as the receding night uncovers them.
     */
    function drawDawnWords(ct, nightRadius, nightEdge, layer) {
      const cx = W / 2; const cy = H / 2; const hero = heroSpin();
      let tx = cx; let ty = cy; let ts = 1; let tr = hero; let show = layer;
      if (closeSource === 'chart') {
        const u = span(ct, DAWN_BLOOM); if (u <= 0) { canvasWords = 0; return; }
        const e = easeOutCubic(u);
        ts = Math.exp(lerp(Math.log(DAWN_BLOOM_FROM / spiralR0), 0, e));
        tr = hero + DAWN_TURNS * TAU * (1 - e);
        show *= smooth(u / 0.25);
      } else if (closeSource === 'core') {
        const e = easeInOutCubic(span(ct, [0, DAWN_BLOOM[1]]));
        // Turn by the shortest way to the hero orientation.
        let d = ((hero - closeText.rot) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU;
        tx = lerp(closeText.x, cx, e); ty = lerp(closeText.y, cy, e);
        ts = Math.exp(lerp(Math.log(closeText.scale), 0, e)); tr = closeText.rot + d * e;
      }
      const dusk = nightRadius !== undefined;
      let dots = 0; let drawn = 0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
      for (let i = 0; i < W_N; i++) {
        // On the spiral (current similarity).
        const rs = wSlotR[i] * ts; const as = wSlotA[i] + tr;
        let x = tx + rs * Math.cos(as); let y = ty + rs * Math.sin(as);
        let s = wSlotS[i] * ts; let rot = wSlotRot[i] + tr; let presence = 1;
        const l = wLine[i]; const m = lineMid[l];
        const u = (ct - lineDepart(l) - (i - lineFirst[l]) * DAWN_RIPPLE) / DAWN_FLIGHT;
        let home = false;
        if (u >= 1) { x = wHomeX[i]; y = wHomeY[i]; s = 1; rot = 0; home = true; }
        else if (u > 0) {
          // The line unrolls home as one object. Its middle word is the anchor and rides the
          // mirrored swirl about C (counter-clockwise inside the TRAVEL window, log radius);
          // the line turns the short way to level; and each word's offset in the line's frame
          // eases from its place on the spiral arc to its place in the straight page line.
          const e = easeInOutCubic(u);
          const mr = wSlotR[m] * ts; const ma = wSlotA[m] + tr; const th0 = wSlotRot[m] + tr;
          const ax0 = tx + mr * Math.cos(ma); const ay0 = ty + mr * Math.sin(ma);
          const r0 = Math.max(1, Math.hypot(ax0 - cx, ay0 - cy)); const a0 = Math.atan2(ay0 - cy, ax0 - cx);
          let d = (((a0 - wHomeA[m]) % TAU) + TAU) % TAU;
          if (d > TRAVEL[1]) d -= TAU;
          const ar = r0 * Math.exp(e * Math.log(wHomeR[m] / r0)); const aa = a0 - d * e;
          const ax = cx + ar * Math.cos(aa); const ay = cy + ar * Math.sin(aa);
          let turn = -th0; turn -= TAU * Math.round(turn / TAU);
          const th = th0 + turn * e;
          const c0 = Math.cos(th0); const s0 = Math.sin(th0); const vx = x - ax0; const vy = y - ay0;
          const ox = lerp(vx * c0 + vy * s0, wHomeX[i] - wHomeX[m], e);
          const oy = lerp(vy * c0 - vx * s0, wHomeY[i] - wHomeY[m], e);
          const c1 = Math.cos(th); const s1 = Math.sin(th);
          x = ax + ox * c1 - oy * s1; y = ay + ox * s1 + oy * c1;
          let local = rot - th0; local -= TAU * Math.round(local / TAU);
          rot = th + local * (1 - e); s = lerp(s, 1, e);
          presence = lerp(1, FLIGHT_ALPHA, smooth(u / 0.15));
        }
        const dist = Math.hypot(x - cx, y - cy);
        const night = dusk ? nightAt(dist, nightRadius, nightEdge) : 1;
        if (home) presence = lerp(1, WAIT_ALPHA, night);
        else if (u > 0.85) presence = lerp(presence, lerp(1, WAIT_ALPHA, night), smooth((u - 0.85) / 0.15));
        const alpha = show * presence;
        wX[i] = x; wY[i] = y; drawn++;
        const px = wSize[i] * s;
        const asDot = 1 - clamp01((px - DOT_SWITCH_PX) / DOT_BLEND_PX);
        if (asDot > 0) { dotList[dots] = i; dotAlpha[dots] = alpha * asDot; dotSize[dots] = 1.2 + 0.4 * clamp01(px / DOT_SWITCH_PX); dots++; }
        if (asDot >= 1) continue;
        const sa = alpha * (1 - asDot);
        const cos = Math.cos(rot) * s; const sin = Math.sin(rot) * s;
        setLocal(cos, sin, -sin, cos, x, y);
        if (night < 1) {
          ctx.globalAlpha = sa * (1 - night);
          ctx.drawImage(atlases[wPage[i]], wDayX[i], wDayY[i], wDevW[i], wDevH[i], -wAnchorX[i], -wAnchorY[i], wSpriteW[i], wSpriteH[i]);
        }
        if (night > 0) {
          ctx.globalAlpha = sa * night;
          ctx.drawImage(atlases[wNightPage[i]], wNightX[i], wNightY[i], wDevW[i], wDevH[i], -wAnchorX[i], -wAnchorY[i], wSpriteW[i], wSpriteH[i]);
        }
      }
      resetTransform();
      for (let tone = 0; tone < wordTones.length; tone++) {
        ctx.fillStyle = wordTones[tone];
        for (let d = 0; d < dots; d++) {
          const i = dotList[d]; if (wTone[i] !== tone) continue;
          ctx.globalAlpha = dotAlpha[d]; const size = dotSize[d];
          ctx.fillRect(wX[i] - size / 2, wY[i] - size / 2, size, size);
        }
      }
      canvasWords = drawn;
    }

    /* ---- Sound ----------------------------------------------------------- */
    // Any failure falls back to silence, with at most one console warning; visuals never depend on it.
    function audioFailed(error) {
      if (!audioWarned) { audioWarned = true; console.warn('The spiral\'s sound is unavailable.', error); }
      audioBroken = true;
      const failed = audio; audio = null;
      if (failed) { try { failed.close(true); } catch (closeError) { /* ignore */ } }
    }
    // Adopt the context primed by the site shell (created and resumed in the opening gesture),
    // or create one; it may stay suspended until the first gesture inside the dialog.
    function adoptAudio() {
      if (audio || closed || audioBroken) return;
      const primed = window.__spiraAudioContext;
      if (primed !== undefined) { try { delete window.__spiraAudioContext; } catch (error) { window.__spiraAudioContext = undefined; } }
      if (!soundOn) { if (primed && primed.state !== 'closed') primed.close().catch(() => {}); return; }
      try {
        let context = primed && primed.state !== 'closed' ? primed : null;
        if (!context) {
          const Context = window.AudioContext || window.webkitAudioContext;
          if (!Context) return;
          context = new Context();
        }
        audio = createSpiraAudio(context);
        on(context, 'statechange', () => { if (audio && audio.context === context && context.state === 'running' && audioMissed) resync(); });
        if (context.state !== 'running' && !document.hidden) context.resume().catch(() => {});
        if (!audioTimer) audioTimer = setInterval(() => { if (audio && !leaving) { try { audio.ambientTick(); } catch (error) { audioFailed(error); } } }, 250);
      } catch (error) { audioFailed(error); }
    }
    function unlockAudio() {
      if (!soundOn || closed || leaving) return;
      if (!audio) { adoptAudio(); return; }
      if (audio.state === 'suspended' && !document.hidden) audio.context.resume().catch(() => {});
    }
    // A cue: logged (test hook) whenever sound is on; played when the context is running.
    function cue(name, time, play) {
      if (!soundOn) return;
      if (audioCues.length < 800) audioCues.push({ cue: name, t: Math.round(time * 1000) / 1000, at: Math.round(performance.now()) });
      if (!audio || !audio.ready) { audioMissed = true; return; }
      try { play(audio); } catch (error) { audioFailed(error); }
    }
    // Context time for timeline time c, given the timeline now (at most AUDIO_LOOKAHEAD ahead).
    const audioAt = (a, c, now) => a.now() + Math.max(0, (c - now) / Math.max(timeScale, 1e-3));
    const panX = x => clamp(x / W * 2 - 1, -1, 1) * 0.8;
    // When the context starts late (a gesture, or sound switched back on), restore the bed of
    // the current phase rather than replaying what was missed.
    function resync() {
      if (!audio || !audio.ready || closed || leaving) return;
      audioMissed = false;
      try {
        const now = audio.now();
        if (mode === 'chart') audio.cue.ambient(now);
        else if (mode === 'opening' && !audio.drone) {
          if (t < T_COLLAPSED) audio.droneStart(now, DRONE_LEVEL, 1.5);
          else if (t >= T_IGNITE) audio.droneStart(now, DRONE_LEVEL * 0.7, 2);
        }
      } catch (error) { audioFailed(error); }
    }
    function renderSoundButtons() {
      for (const button of soundButtons) {
        button.setAttribute('aria-pressed', String(soundOn));
        button.querySelector('[data-sound-label]').textContent = soundOn ? 'Sound on' : 'Sound off';
      }
    }
    function setSound(value) {
      soundOn = value;
      try { localStorage.setItem(SOUND_KEY, value ? 'on' : 'off'); } catch (error) { /* storage unavailable */ }
      renderSoundButtons();
      if (scoreKicker && plateView === 'score') scoreKicker.textContent = value ? COPY.scoreKicker : `${COPY.scoreKicker} · ${COPY.scoreSoundOff}`;
      if (value) {
        audioMissed = true;
        if (!audio) adoptAudio();
        else { try { audio.setEnabled(true); } catch (error) { audioFailed(error); } }
        if (audio && audio.ready) resync();
      } else if (audio) {
        try { audio.setSpin(0); audio.setEnabled(false); } catch (error) { audioFailed(error); }
      }
    }
    // The span of timeline the current frame schedules: (cueLo, cueHi].
    let cueLo = 0; let cueHi = 0;
    const crosses = c => c > cueLo && c <= cueHi;
    // Opening cues crossed by the timeline this frame (with the lookahead).
    function openingCues() {
      cueLo = cueFrom; cueHi = t + AUDIO_LOOKAHEAD * timeScale; cueFrom = cueHi;
      if (!soundOn) return;
      const now = t;
      if (crosses(0)) cue('dusk', 0, a => a.cue.dusk(audioAt(a, 0, now)));
      // Every third departing word plucks the harp, walking down from D6 to D4 (+-1 step).
      for (let i = 0; i < W_N; i += 3) {
        const c = wLift[i];
        if (!crosses(c) || c - lastGatherNote < 0.03) continue;
        lastGatherNote = c;
        const step = clamp(Math.round(10 * (1 - (W_N > 1 ? i / (W_N - 1) : 0))) + Math.floor(noteRandom() * 3) - 1, 0, 10);
        const pan = panX(wHomeX[i]);
        cue('gather', c, a => a.cue.gather(audioAt(a, c, now), step, pan));
      }
      if (crosses(T_GLINT[0])) cue('glint', T_GLINT[0], a => a.cue.glint(audioAt(a, T_GLINT[0], now), (T_GLINT[1] - T_GLINT[0]) / Math.max(timeScale, 1e-3)));
      if (crosses(T_WIND)) cue('wind', T_WIND, a => a.cue.wind(audioAt(a, T_WIND, now), (T_COLLAPSED - T_WIND) / Math.max(timeScale, 1e-3)));
      if (crosses(T_COLLAPSED)) {
        cue('hush', T_COLLAPSED, a => a.cue.hush(audioAt(a, T_COLLAPSED, now)));
        cue('inhale', T_COLLAPSED, a => a.cue.inhale(audioAt(a, T_COLLAPSED, now), (T_IGNITE - T_COLLAPSED) / Math.max(timeScale, 1e-3)));
      }
      if (crosses(T_IGNITE)) cue('ignite', T_IGNITE, a => a.cue.ignite(audioAt(a, T_IGNITE, now)));
      for (let p = 0; p < NP; p++) {
        const paper = PAPERS[p]; const c = paper.at;
        if (!crosses(c)) continue;
        const pan = panX(paperSX[p]);
        cue('paper', c, a => a.cue.paper(audioAt(a, c, now), paper.theme, paper.year, pan));
      }
      if (crosses(T_GHOST[0])) cue('ghost', T_GHOST[0], a => a.cue.ghost(audioAt(a, T_GHOST[0], now)));
    }
    // Closing cues: the harp walks up as words fly home (the name last); dawn is a soft pad.
    function closingCues() {
      cueLo = closeCueFrom; cueHi = closeT + AUDIO_LOOKAHEAD * timeScale; closeCueFrom = cueHi;
      if (!soundOn || closeKind !== 'dawn') return;
      const now = closeT;
      // One note per departing page line (at least HOME_NOTE_GAP apart).
      for (let l = lineCount - 1; l >= 0; l--) {
        const c = lineDepart(l);
        if (!crosses(c) || c - lastHomeNote < HOME_NOTE_GAP) continue;
        lastHomeNote = c;
        const step = clamp(Math.round(10 * (c - DAWN_HOME) / DAWN_SPREAD) + Math.floor(noteRandom() * 3) - 1, 0, 10);
        const pan = panX(wHomeX[lineMid[l]]);
        cue('home', c, a => a.cue.home(audioAt(a, c, now), step, pan));
      }
      if (crosses(DAWN_IRIS[0])) cue('dawn', DAWN_IRIS[0], a => a.cue.dawn(audioAt(a, DAWN_IRIS[0], now)));
    }
    // At a close the music releases and the master fades out, ending exactly at the swap.
    function soundClose() {
      const end = closeKind === 'dusk' ? CLOSE_DUSK : DAWN_END; const from = closeT;
      cue('close', closeT, a => {
        const now = a.now(); const swap = now + Math.max(0, end - from) / Math.max(timeScale, 1e-3);
        a.ambientStop(now, 0.5); a.droneStop(now, 0.4); a.airStop(now, 0.3); a.windStop(now, 0.1); a.setSpin(0);
        a.fadeOut(swap, Math.min(0.6, swap - now));
      });
    }
    // The galaxy as an instrument: hovering strums (throttled), selecting rings an octave.
    function strum() {
      const now = performance.now();
      if (now - hoverNoteAt < HOVER_THROTTLE) return false;
      hoverNoteAt = now; return true;
    }
    function playPaper(p, select) {
      const paper = PAPERS[p]; const pan = panX(paperSX[p]);
      if (select) cue('select', skyT, a => a.cue.select(a.now(), paper.theme, paper.year, pan));
      else if (strum()) cue('hover', skyT, a => a.cue.hover(a.now(), paper.theme, paper.year, pan));
    }
    function playWish(q) {
      const Q = QUESTIONS[q]; const pan = panX(wishSX[q]);
      if (strum()) cue('hover', skyT, a => a.cue.dyad(a.now(), Q.a, Q.b, HOVER_NOTE, pan));
    }
    function playTheme(j) {
      const list = PAPERS.filter(paper => paper.theme === j);   // already chronological
      cue('theme', skyT, a => {
        const start = a.now();
        list.forEach((paper, k) => a.cue.paper(start + k * ARPEGGIO_STEP, paper.theme, paper.year, panX(paperSX[PAPERS.indexOf(paper)])));
      });
    }

    /* ---- Wishes: caught open questions on the next turn ------------------- */
    // They last for one visit: sessionStorage keeps them through re-openings in this tab. A copy
    // left in localStorage by an earlier version is removed, so everyone starts at 0 / 10.
    function loadWishes() {
      try { localStorage.removeItem(WISH_KEY); } catch (error) { /* storage unavailable */ }
      try {
        const list = JSON.parse(sessionStorage.getItem(WISH_KEY) || '[]');
        if (Array.isArray(list)) {
          for (const q of list) {
            if (!Number.isInteger(q) || q < 0 || q >= NQ || caught[q]) continue;
            caught[q] = 1; wishPinned[q] = 1; wishFade[q] = 1; caughtCount++;
          }
        }
      } catch (error) { /* storage unavailable or malformed: start empty */ }
      if (caughtCount) discovered = true;
      if (caughtCount === NQ) { drawn = true; drawnFade = 1; }
    }
    function saveWishes() {
      try {
        const list = [];
        for (let q = 0; q < NQ; q++) if (caught[q]) list.push(q);
        if (list.length) sessionStorage.setItem(WISH_KEY, JSON.stringify(list)); else sessionStorage.removeItem(WISH_KEY);
      } catch (error) { /* storage unavailable */ }
    }
    function updateHint() {
      const touch = coarse || narrow;
      const base = touch ? COPY.hintTouch : COPY.hintPointer;
      const text = hintOverride || (discovered ? `${base} · ${touch ? COPY.catchTouch : COPY.catchPointer}` : base);
      if (hintEl.textContent !== text) hintEl.textContent = text;
    }
    function updateCount() {
      // The counter keeps its place before it appears, so discovery never shifts the layout.
      countButton.classList.toggle('is-pending', !discovered);
      countButton.setAttribute('aria-hidden', String(!discovered));
      countButton.textContent = `${COPY.counter} ${caughtCount} / ${NQ}`;
    }
    function discover() {
      if (discovered) return;
      discovered = true; updateHint(); updateCount(); measureUI();
    }
    function wishShown() {
      for (let q = 0; q < NQ; q++) if (wishFade[q] > 0.004) return true;
      return false;
    }
    // How much of the next turn at angle phi a pinned wish draws: fully within WISH_ARC[0]
    // degrees of a star, fading out by WISH_ARC[1] (neighbours, 36 degrees apart, overlap).
    function wishCover(phi) {
      let cover = 0;
      for (let q = 0; q < NQ; q++) {
        if (wishFade[q] <= 0.004) continue;
        let d = Math.abs(phi - QUESTIONS[q].phi); if (d > Math.PI) d = TAU - d;
        const w = (1 - smooth((d * 180 / Math.PI - WISH_ARC[0]) / (WISH_ARC[1] - WISH_ARC[0]))) * wishFade[q];
        if (w > cover) cover = w;
      }
      return cover;
    }
    function drawWishes(layer) {
      for (let q = 0; q < NQ; q++) {
        wishVis[q] = 0;
        if (wishFade[q] <= 0.004) continue;
        const Q = QUESTIONS[q];
        if (!project(Q.x, Q.y, 0)) continue;
        wishSX[q] = PX; wishSY[q] = PY; wishZ[q] = PZ;
        if (PX < -40 || PX > W + 40 || PY < -40 || PY > H + 40) continue;
        wishVis[q] = wishPinned[q];
        const focus = q === hoverWish || q === selectedWish;
        const dim = selectedTheme >= 0 && Q.a !== selectedTheme && Q.b !== selectedTheme && !focus ? 0.35 : 1;
        const a = depthFactor(PZ) * dim * layer * wishFade[q];
        if (a <= 0.004) continue;
        ctx.globalCompositeOperation = 'lighter';
        const glow = focus ? WISH_GLOW + 6 : WISH_GLOW;
        ctx.globalAlpha = Math.min(1, 0.8 * a); ctx.drawImage(sprites.blends[q], PX - glow, PY - glow, glow * 2, glow * 2);
        // A warm four-point glint that breathes slowly (held still under reduced motion).
        const g = WISH_GLINT * (motion.matches ? 1 : 0.85 + 0.15 * Math.sin(skyT * 1.3 + q * 2.1));
        ctx.globalAlpha = 0.7 * a; ctx.drawImage(sprites.glintWarm, PX - g / 2, PY - g / 2, g, g);
        if (wishAge[q] < PAPER_SPARK_LIFE[1]) drawBurst(PX, PY, wishAge[q], sprites.blends[q], Q.colour, (NP + q) * PAPER_SPARKS, narrow ? PAPER_SPARKS_NARROW : PAPER_SPARKS, layer);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, a + 0.1); ctx.fillStyle = '#fff4e2';
        ctx.beginPath(); ctx.arc(PX, PY, 1.4, 0, TAU); ctx.fill();
        if (focus) {
          ctx.globalAlpha = 0.85 * layer; ctx.strokeStyle = Q.colour; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(PX, PY, 9, 0, TAU); ctx.stroke();
        }
      }
    }
    // Hovering or selecting a wish star bridges its two themes: their spokes light up and a faint
    // arc joins their rim labels, through the wish's own angle (the shorter way).
    function stepBridge(dt) {
      const target = hoverWish >= 0 ? hoverWish : selectedWish;
      if (target >= 0) bridgeQ = target;
      const goal = target >= 0 ? 1 : 0;
      bridgeFade = motion.matches ? goal : bridgeFade + (goal - bridgeFade) * (1 - Math.exp(-dt / BRIDGE_TAU));
      if (bridgeFade < 0.002 && goal === 0) { bridgeFade = 0; bridgeQ = -1; }
    }
    function drawBridge(layer) {
      if (bridgeQ < 0 || bridgeFade <= 0.004 || layer <= 0.004) return;
      const Q = QUESTIONS[bridgeQ];
      const a = sectorCentre(Q.a); let d = sectorCentre(Q.b) - a; d -= TAU * Math.round(d / TAU);
      const r = BRIDGE_ARC[0]; const steps = 32;
      ctx.setLineDash(NO_DASH); ctx.lineWidth = 1; ctx.lineCap = 'round';
      for (let half = 0; half < 2; half++) {
        ctx.strokeStyle = THEME_RGBA[half ? Q.b : Q.a]; ctx.globalAlpha = BRIDGE_ARC[1] * bridgeFade * layer;
        ctx.beginPath();
        for (let k = half * steps / 2; k <= (half + 1) * steps / 2; k++) {
          const th = a + d * k / steps; project(r * Math.cos(th), r * Math.sin(th), 0);
          if (k === half * steps / 2) ctx.moveTo(PX, PY); else ctx.lineTo(PX, PY);
        }
        ctx.stroke();
      }
    }
    function nearestWish(x, y, radius) {
      let best = -1; let bestD = radius;
      for (let q = 0; q < NQ; q++) {
        if (!wishVis[q]) continue;
        const d = Math.hypot(wishSX[q] - x, wishSY[q] - y);
        if (d < bestD) { bestD = d; best = q; }
      }
      return best;
    }
    function updateCursor() { stage.classList.toggle('is-over', hoverPaper >= 0 || hoverWish >= 0 || overMeteor); }
    function setHoverWish(q, sound) {
      if (hoverWish === q) return;
      hoverWish = q; updateCursor(); if (motion.matches) stepBridge(0);
      if (q >= 0 && sound) playWish(q);
      redraw();
    }
    function selectWish(q) {
      if (q >= 0) stopScore();
      selectedWish = q; if (motion.matches) stepBridge(0);
      if (q >= 0) { selectedPaper = -1; selectedTheme = -1; plateView = ''; }
      updatePlate();
    }
    function showWishList() {
      if (mode !== 'chart' || coreTarget === 1) return;
      stopScore();
      selectedPaper = -1; selectedTheme = -1; selectedWish = -1; plateView = 'wishes';
      updatePlate();
    }
    // Caught: counted and saved at once (a close mid-flight keeps it); pinned when it arrives.
    function markCaught(q) {
      if (caught[q]) return;
      caught[q] = 1; caughtCount++;
      saveWishes(); discover(); updateCount();
      announce(`Open question caught, ${caughtCount} of ${NQ}: ${QUESTIONS[q].text}`);
    }
    function pinWish(q, instant) {
      wishPinned[q] = 1; wishFade[q] = 1; wishAge[q] = instant && motion.matches ? 99 : 0;
      const Q = QUESTIONS[q]; const pan = panX(wishVis[q] ? wishSX[q] : W / 2);
      cue('pin', skyT, a => a.cue.pin(a.now(), Q.a, Q.b, pan));
      if (caughtCount === NQ && !drawn) complete();
    }
    function complete() {
      drawn = true;
      if (motion.matches) drawnFade = 1;
      else {
        // A shower of non-interactive meteors from one side; afterwards, golden meteors.
        const sign = meteorRandom() < 0.5 ? 1 : -1; const angle = lerp(26, 34, meteorRandom());
        for (let k = 0; k < SHOWER_COUNT; k++) {
          spawnMeteor(1, -1, skyT + 0.15 + k * SHOWER_TIME / SHOWER_COUNT + meteorRandom() * 0.08, sign, angle + (meteorRandom() - 0.5) * 6);
        }
        nextMeteor = skyT + SHOWER_TIME + lerp(GOLDEN_GAP[0], GOLDEN_GAP[1], meteorRandom());
      }
      cue('swell', skyT, a => a.cue.swell(a.now()));
      selectedPaper = -1; selectedTheme = -1; selectedWish = -1; plateView = 'drawn';
      updatePlate();
    }
    function releaseWishes() {
      catchQ = -1;
      for (let q = 0; q < NQ; q++) { caught[q] = 0; wishPinned[q] = 0; if (motion.matches) wishFade[q] = 0; }
      caughtCount = 0; drawn = false; if (motion.matches) drawnFade = 0;
      for (let i = 0; i < METEOR_MAX; i++) if (mOn[i] && mKind[i] !== 0) dropMeteor(i, 0.1);
      saveWishes(); updateCount();
      selectedWish = -1; plateView = '';
      updatePlate();
      announce('The open questions are released.');
      nextMeteor = Math.min(nextMeteor, skyT + METEOR_FIRST);
      if (discovered) countButton.focus({ preventScroll: true });
      if (motion.matches) scheduleStill();
      redraw();
    }

    /* ---- Shooting stars ---------------------------------------------------- */
    const CATCH_LAID = CATCH_RELAY[0] + CATCH_RELAY[2] + CATCH_RELAY[1];   // every letter is in its line
    const CATCH_FOLD = CATCH_LAID + CATCH_HOLD;                           // the line folds to a point ...
    const CATCH_FLY = CATCH_FOLD + CATCH_COLLAPSE;                        // ... that flies ...
    const CATCH_PIN = CATCH_FLY + CATCH_ARC;                              // ... and is pinned
    let freeL = 0; let freeR = 1; let freeT = 0; let freeB = 1;
    function questionBusy(q) {
      if (catchQ === q || stillQ === q) return true;
      for (let i = 0; i < METEOR_MAX; i++) if (mOn[i] && mKind[i] === 0 && mQ[i] === q) return true;
      return false;
    }
    function pickQuestion() {
      let free = 0;
      for (let q = 0; q < NQ; q++) if (!caught[q] && !questionBusy(q)) free++;
      if (!free) return -1;
      let k = Math.floor(meteorRandom() * free);
      for (let q = 0; q < NQ; q++) if (!caught[q] && !questionBusy(q) && k-- === 0) return q;
      return -1;
    }
    function questionMeteor() {
      for (let i = 0; i < METEOR_MAX; i++) if (mOn[i] && mKind[i] !== 1) return i;
      return -1;
    }
    /**
     * A meteor crosses a random point of the chart's free area, heading down at 20-40 degrees
     * in either direction. Going backwards from that point it enters at the top edge or at
     * the side it comes from, whichever it meets first; it lives until its tail has left.
     * With `now`, it is born already at that point (test hook).
     */
    function spawnMeteor(kind, q, born, sign, angle, now) {
      let i = 0; while (i < METEOR_MAX && mOn[i]) i++;
      if (i >= METEOR_MAX) return -1;
      const speeds = narrow ? METEOR_SPEED_NARROW : METEOR_SPEED;
      // The session's first question meteor, while nothing is caught, is a slow invitation.
      const invite = kind === 0 && !invited && caughtCount === 0;
      const speed = invite ? METEOR_INVITE[narrow ? 1 : 0] : lerp(speeds[0], speeds[1], meteorRandom());
      if (!sign) sign = meteorRandom() < 0.5 ? 1 : -1;
      const a = (angle === undefined ? lerp(METEOR_ANGLE[0], METEOR_ANGLE[1], meteorRandom()) : angle) * Math.PI / 180;
      const dx = sign * Math.cos(a); const dy = Math.sin(a);
      const px = lerp(freeL, freeR, 0.2 + 0.6 * meteorRandom()); const py = lerp(freeT, freeB, 0.15 + 0.5 * meteorRandom());
      const m = 12;
      const back = Math.max(0, Math.min((py + m) / dy, sign > 0 ? (px + m) / dx : (px - W - m) / dx));
      const ahead = Math.max(0, Math.min((H + m - py) / dy, sign > 0 ? (W + m - px) / dx : (-m - px) / dx));
      const tail = narrow ? METEOR_TAIL_NARROW : METEOR_TAIL;
      mX0[i] = px - dx * back; mY0[i] = py - dy * back; mDX[i] = dx; mDY[i] = dy; mSpeed[i] = speed;
      mBorn[i] = now ? skyT : born; mDist[i] = now ? back : 0; mSlow[i] = 1;
      mCross[i] = back + ahead; mPath[i] = back + ahead + tail; mTail[i] = tail; mFade[i] = 1;
      mQ[i] = q; mKind[i] = kind; mOn[i] = 1; mSounded[i] = 0; mInvite[i] = invite ? 1 : 0;
      if (kind === 0 && q >= 0) buildGlyphs(q);
      if (invite) {
        // It announces itself as it appears.
        invited = true; hintOverride = coarse || narrow ? COPY.inviteTouch : COPY.invitePointer;
        discover(); updateHint();
      }
      return i;
    }
    // A meteor leaves the sky: its whoosh is released, and an invitation hands the hint back.
    function dropMeteor(i, tau) {
      if (mVoice[i]) { try { mVoice[i].end(tau); } catch (error) { audioFailed(error); } mVoice[i] = null; }
      if (mOn[i] && mInvite[i]) { mInvite[i] = 0; hintOverride = ''; updateHint(); }
      mOn[i] = 0;
    }
    function clearMeteors() { for (let i = 0; i < METEOR_MAX; i++) if (mOn[i]) dropMeteor(i, 0.08); activeMeteors = 0; }
    let MX = 0; let MY = 0; let MD = 0;
    function meteorHeadAt(i) {
      MD = mDist[i];
      MX = mX0[i] + mDX[i] * MD; MY = mY0[i] + mDY[i] * MD;
    }
    // A catchable meteor near (x, y): within CATCH_HEAD of the head, or CATCH_TAIL[0] of the
    // first CATCH_TAIL[1] px of its tail (the positions of the last drawn frame).
    function meteorAt(x, y) {
      for (let i = 0; i < METEOR_MAX; i++) {
        if (!mOn[i] || mKind[i] === 1 || skyT < mBorn[i] || mFade[i] < 1) continue;
        meteorHeadAt(i);
        if (Math.hypot(x - MX, y - MY) <= CATCH_HEAD) return i;
        const reach = Math.min(CATCH_TAIL[1], mTail[i], MD);
        const along = clamp((MX - x) * mDX[i] + (MY - y) * mDY[i], 0, reach);
        if (Math.hypot(x - (MX - mDX[i] * along), y - (MY - mDY[i] * along)) <= CATCH_TAIL[0]) return i;
      }
      return -1;
    }
    function visibleMeteor() {
      for (let i = 0; i < METEOR_MAX; i++) {
        if (!mOn[i] || mKind[i] === 1 || skyT < mBorn[i] || mFade[i] < 1) continue;
        meteorHeadAt(i);
        if (MX >= 0 && MX <= W && MY >= 0 && MY <= H) return i;
      }
      return -1;
    }
    function catchMeteor(i) {
      meteorHeadAt(i);
      const kind = mKind[i]; const q = mQ[i]; dropMeteor(i, 0.15);
      if (kind === 2) {
        // A golden meteor only sparkles.
        sparkleX = MX; sparkleY = MY; sparkleAge = 0;
        const pan = panX(MX);
        cue('sparkle', skyT, a => a.cue.sparkle(a.now(), pan));
        return;
      }
      if (q < 0) return;
      if (catchQ >= 0) finishCatch();
      buildGlyphs(q);
      catchQ = q; catchT = 0; catchX = MX; catchY = MY; catchDX = mDX[i]; catchDY = mDY[i]; catchV = mSpeed[i];
      catchTail = Math.min(mTail[i], MD); catchFrom = skyT;
      markCaught(q);   // first: the hint and counter may change the plate's size
      // The readable line, near where the meteor comes to rest and clear of the UI.
      const rest = catchV * CATCH_STOP / 3;
      layoutLine(catchX + catchDX * rest, catchY + catchDY * rest);
      const Q = QUESTIONS[q]; const pan = panX(MX);
      cue('catch', skyT, a => a.cue.catch(a.now(), Q.a, Q.b, pan));
      nextMeteor = Math.max(nextMeteor, skyT + CATCH_PIN + 2);
    }
    function finishCatch() {
      if (catchQ < 0) return;
      const q = catchQ; catchQ = -1;
      pinWish(q, true);
    }
    function tryCatch(x, y) {
      if (motion.matches) {
        if (stillQ >= 0 && Math.hypot(x - stillX, y - stillY) <= CATCH_HEAD) { catchStill(); return true; }
        return false;
      }
      const i = meteorAt(x, y);
      if (i < 0) return false;
      catchMeteor(i); redraw();
      return true;
    }
    // One question at a time: its glyphs, each in its own cell of a strip, warm serif italic.
    function buildGlyphs(q) {
      const size = narrow ? QUESTION_FONT_NARROW : QUESTION_FONT;
      if (glyphQ === q && glyphSize === size && glyphDPR === DPR && glyphCanvas) return;
      const text = QUESTIONS[q].text; const n = Math.min(text.length, MAX_CHARS);
      const font = `italic ${size}px ${SERIF}`;
      if (!glyphCanvas) glyphCanvas = makeCanvas(1, 1);
      const g = glyphCanvas.getContext('2d'); g.font = font;
      // Advances from prefix widths, so the line keeps the font's own spacing.
      let previous = 0;
      for (let k = 0; k < n; k++) {
        const w = g.measureText(text.slice(0, k + 1)).width;
        glyphOff[k] = previous; glyphAdv[k] = Math.max(0, w - previous); previous = w;
      }
      const pad = Math.ceil(size * 0.45); const h = Math.ceil(size * 1.7);
      let x = 0;
      for (let k = 0; k < n; k++) { glyphCell[k] = x; glyphCellW[k] = Math.ceil(glyphAdv[k]) + 2 * pad; x += glyphCellW[k] + 2; }
      glyphCanvas.width = Math.ceil(x * DPR); glyphCanvas.height = Math.ceil(h * DPR);
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.font = font; g.fillStyle = WARM; g.textBaseline = 'middle'; g.textAlign = 'left';
      // A soft night halo first (only the shadow of glyphs drawn far off the strip), then the glyphs.
      const away = (x + 100) * 4;
      g.shadowColor = 'rgba(5,7,12,0.9)'; g.shadowBlur = GLYPH_HALO * DPR; g.shadowOffsetX = away * DPR;
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) if (text[k] !== ' ') g.fillText(text[k], glyphCell[k] + pad - away, h / 2);
      g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0;
      for (let k = 0; k < n; k++) if (text[k] !== ' ') g.fillText(text[k], glyphCell[k] + pad, h / 2);
      glyphQ = q; glyphN = n; glyphH = h; glyphSize = size; glyphWidth = previous; glyphDPR = DPR; glyphPad = pad;
    }
    let glyphPad = 0;
    // While a caught question is laid out, canvas labels under its box fade to LABEL_UNDER_QUESTION.
    let dimX0 = 0; let dimY0 = 0; let dimX1 = 0; let dimY1 = 0; let labelDim = 0;
    const dimFor = (x0, y0, x1, y1) => (labelDim > 0 && x0 < dimX1 && x1 > dimX0 && y0 < dimY1 && y1 > dimY0 ? 1 - (1 - LABEL_UNDER_QUESTION) * labelDim : 1);
    // The caught question as one centred line (two on narrow screens, broken at the space
    // nearest the middle), placed near (px, py), inside the margins and clear of the UI.
    function layoutLine(px, py) {
      const size = glyphSize; const lineH = Math.round(size * 1.45); const text = QUESTIONS[glyphQ].text;
      let split = -1;
      if (glyphWidth > W - 2 * QUESTION_MARGIN) {
        let best = Infinity;
        for (let k = 1; k < glyphN - 1; k++) {
          if (text[k] !== ' ') continue;
          const d = Math.abs(glyphOff[k] - glyphWidth / 2); if (d < best) { best = d; split = k; }
        }
      }
      const w1 = split > 0 ? glyphOff[split] : glyphWidth;
      const w2 = split > 0 ? glyphWidth - glyphOff[split] - glyphAdv[split] : 0;
      const boxW = Math.max(w1, w2) + 16; const boxH = (split > 0 ? 2 : 1) * lineH + 16;
      const m = QUESTION_MARGIN;
      const fitX = x => clamp(x, m + boxW / 2, Math.max(m + boxW / 2, W - m - boxW / 2));
      const fitY = y => clamp(y, m + boxH / 2, Math.max(m + boxH / 2, H - m - boxH / 2));
      lineCX = fitX((freeL + freeR) / 2); lineCY = fitY((freeT + freeB) / 2);
      for (let k = 0; k < 13; k++) {
        const x = fitX(px); const y = fitY(py + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 44);
        if (!overlapsUI(x - boxW / 2, y - boxH / 2, boxW, boxH)) { lineCX = x; lineCY = y; break; }
      }
      dimX0 = lineCX - boxW / 2; dimX1 = lineCX + boxW / 2; dimY0 = lineCY - boxH / 2; dimY1 = lineCY + boxH / 2;
      for (let k = 0; k < glyphN; k++) {
        glyphHide[k] = k === split ? 1 : 0;
        if (split > 0 && k > split) {
          glyphLX[k] = lineCX - w2 / 2 + (glyphOff[k] - glyphOff[split] - glyphAdv[split]) + glyphAdv[k] / 2; glyphLY[k] = lineCY + lineH / 2;
        } else {
          glyphLX[k] = lineCX - w1 / 2 + glyphOff[k] + glyphAdv[k] / 2; glyphLY[k] = lineCY - (split > 0 ? lineH / 2 : 0);
        }
      }
    }
    let SX = 0; let SY = 0; let SA = 0; let SALPHA = 0;
    // Letter k along a tail of length `tail` behind the head (hx, hy), the meteor moving along
    // (dx, dy). The text reads left to right on screen: it ends just behind the head when the
    // meteor moves right and starts there when it moves left; it is squeezed to fit the tail.
    function streakGlyph(k, hx, hy, dx, dy, tail, time) {
      const scale = TAIL_FONT / glyphSize; const span = glyphWidth * scale;
      const squeeze = Math.min(1, Math.max(1, tail - TAIL_TEXT_GAP) / span);
      const centre = (glyphOff[k] + glyphAdv[k] / 2) * scale * squeeze;
      const dist = dx >= 0 ? TAIL_TEXT_GAP + span * squeeze - centre : TAIL_TEXT_GAP + centre;
      SA = dx >= 0 ? Math.atan2(dy, dx) : Math.atan2(-dy, -dx);
      // Along the tail, lifted just above it (the text's own upward normal).
      SX = hx - dx * dist + Math.sin(SA) * TAIL_TEXT_LIFT; SY = hy - dy * dist - Math.cos(SA) * TAIL_TEXT_LIFT;
      SALPHA = Math.pow(clamp01(1 - dist / Math.max(1, tail + TAIL_TEXT_GAP)), 1.2) * (0.72 + 0.28 * Math.sin(time * 19 + k * 1.7));
    }
    function drawGlyph(k, x, y, scale, angle, alpha) {
      if (alpha <= 0.004 || glyphHide[k]) return;
      const c = Math.cos(angle) * scale; const s = Math.sin(angle) * scale;
      setLocal(c, s, -s, c, x, y);
      ctx.globalAlpha = alpha;
      const w = glyphCellW[k];
      ctx.drawImage(glyphCanvas, glyphCell[k] * DPR, 0, w * DPR, glyphH * DPR, -(glyphPad + glyphAdv[k] / 2), -glyphH / 2, w, glyphH);
    }
    // Head: a warm-white core and a glow in the blended theme colour; tail: six tapered segments.
    function drawMeteorBody(hx, hy, dx, dy, tail, sprite, colour, alpha) {
      if (alpha <= 0.004) return;
      ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.strokeStyle = colour;
      for (let j = 0; j < METEOR_SEGMENTS && tail > 1; j++) {
        const s0 = tail * j / METEOR_SEGMENTS; const s1 = tail * (j + 1) / METEOR_SEGMENTS; const f = (j + 0.5) / METEOR_SEGMENTS;
        ctx.globalAlpha = alpha * 0.85 * Math.pow(1 - f, 1.3);
        ctx.lineWidth = lerp(METEOR_WIDTH[0], METEOR_WIDTH[1], f);
        ctx.beginPath(); ctx.moveTo(hx - dx * s0, hy - dy * s0); ctx.lineTo(hx - dx * s1, hy - dy * s1); ctx.stroke();
      }
      if (tail > 1) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.55 * alpha;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - dx * tail * 0.3, hy - dy * tail * 0.3); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9 * alpha; ctx.drawImage(sprite, hx - METEOR_GLOW, hy - METEOR_GLOW, METEOR_GLOW * 2, METEOR_GLOW * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha; ctx.fillStyle = '#fff8ee';
      ctx.beginPath(); ctx.arc(hx, hy, METEOR_CORE / 2, 0, TAU); ctx.fill();
    }
    function drawMeteors(layer) {
      for (let i = 0; i < METEOR_MAX; i++) {
        if (!mOn[i] || skyT < mBorn[i]) continue;
        meteorHeadAt(i);
        const kind = mKind[i]; const q = mQ[i] >= 0 ? mQ[i] : i % NQ;
        const tail = Math.min(mTail[i], MD);
        const alpha = layer * mFade[i] * (kind === 1 ? 0.75 : 1);
        drawMeteorBody(MX, MY, mDX[i], mDY[i], tail, kind === 2 ? sprites.gold : sprites.blends[q], kind === 2 ? GOLD : QUESTIONS[q].colour, alpha);
        if (kind !== 0 || mQ[i] !== glyphQ || !glyphCanvas) continue;
        const scale = TAIL_FONT / glyphSize;
        for (let k = 0; k < glyphN; k++) {
          streakGlyph(k, MX, MY, mDX[i], mDY[i], tail, skyT);
          drawGlyph(k, SX, SY, scale, SA, SALPHA * alpha * 0.85);
        }
        resetTransform();
      }
    }
    // The catch: deceleration, the letters re-laid as a line, the hold, the fold to a point and
    // its arc to the next turn (towards the star's current projection).
    function drawCatch(layer) {
      if (catchQ < 0 || glyphQ !== catchQ || !glyphCanvas) return;
      const c = catchT; const Q = QUESTIONS[catchQ];
      const u = clamp01(c / CATCH_STOP); const left = 1 - u;
      const travel = catchV * CATCH_STOP / 3 * (1 - left * left * left);
      const hx = catchX + catchDX * travel; const hy = catchY + catchDY * travel;
      const tail = catchTail * left * left;
      drawMeteorBody(hx, hy, catchDX, catchDY, tail, sprites.blends[catchQ], Q.colour, layer * (1 - smooth((c - 0.15) / 0.5)));
      const fold = clamp01((c - CATCH_FOLD) / CATCH_COLLAPSE); const foldE = easeInCubic(fold);
      if (fold < 1) {
        const scale0 = TAIL_FONT / glyphSize;
        for (let k = 0; k < glyphN; k++) {
          streakGlyph(k, hx, hy, catchDX, catchDY, tail, catchFrom + c);
          const start = CATCH_RELAY[0] + CATCH_RELAY[2] * (glyphN > 1 ? k / (glyphN - 1) : 0);
          const e = easeInOutCubic((c - start) / CATCH_RELAY[1]);
          let d = -SA; d -= TAU * Math.round(d / TAU);
          let x = lerp(SX, glyphLX[k], e); let y = lerp(SY, glyphLY[k], e);
          let scale = lerp(scale0, 1, e); let alpha = lerp(SALPHA * 0.85, 1, e);
          if (fold > 0) { x = lerp(x, lineCX, foldE); y = lerp(y, lineCY, foldE); scale *= 1 - 0.7 * foldE; alpha *= 1 - foldE; }
          drawGlyph(k, x, y, scale, SA + d * e, alpha * layer);
        }
        resetTransform();
      }
      if (fold <= 0) return;
      // The point of light: it gathers as the line folds, then arcs (a quadratic Bezier that
      // bows upwards) to the wish's place, leaving a short tapered trail.
      const fly = clamp01((c - CATCH_FLY) / CATCH_ARC);
      project(Q.x, Q.y, 0); const tx = PX; const ty = PY;
      const mx = (lineCX + tx) / 2; const my = (lineCY + ty) / 2; const len = Math.hypot(tx - lineCX, ty - lineCY) || 1;
      let nx = -(ty - lineCY) / len; let ny = (tx - lineCX) / len; if (ny > 0) { nx = -nx; ny = -ny; }
      const cx = mx + nx * 0.3 * len; const cy = my + ny * 0.3 * len;
      const e = easeInOutCubic(fly);
      const px = bezier(e, lineCX, cx, tx); const py = bezier(e, lineCY, cy, ty);
      if (fly > 0) {
        ctx.lineCap = 'round'; ctx.strokeStyle = Q.colour;
        let ax = px; let ay = py;
        for (let j = 1; j <= 6; j++) {
          const ej = Math.max(0, e - j * 0.035); const bx = bezier(ej, lineCX, cx, tx); const by = bezier(ej, lineCY, cy, ty);
          ctx.globalAlpha = layer * 0.7 * (1 - j / 7); ctx.lineWidth = 2 * (1 - j / 8);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          ax = bx; ay = by;
        }
      }
      const glow = 10 + 10 * smooth(fold);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = layer * smooth(fold); ctx.drawImage(sprites.blends[catchQ], px - glow, py - glow, glow * 2, glow * 2);
      ctx.globalAlpha = layer * 0.8 * smooth(fold); ctx.drawImage(sprites.warm, px - 6, py - 6, 12, 12);
      ctx.globalCompositeOperation = 'source-over';
    }
    const bezier = (e, a, c, b) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * c + e * e * b;
    function drawSky(layer) {
      if (layer <= 0.004) return;
      drawMeteors(layer);
      drawCatch(layer);
      if (sparkleAge < PAPER_SPARK_LIFE[1]) {
        ctx.globalCompositeOperation = 'lighter';
        drawBurst(sparkleX, sparkleY, sparkleAge, sprites.gold, GOLD, (NP + NQ) * PAPER_SPARKS, PAPER_SPARKS, layer);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (stillQ >= 0) {
        // Reduced motion: a still wish with a faint ring.
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * layer;
        ctx.drawImage(sprites.blends[stillQ], stillX - WISH_GLOW, stillY - WISH_GLOW, WISH_GLOW * 2, WISH_GLOW * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.35 * layer; ctx.strokeStyle = QUESTIONS[stillQ].colour; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(stillX, stillY, STILL_RADIUS, 0, TAU); ctx.stroke();
        ctx.globalAlpha = layer; ctx.fillStyle = '#fff4e2';
        ctx.beginPath(); ctx.arc(stillX, stillY, 1.4, 0, TAU); ctx.fill();
      }
    }
    // The sky clock runs in the chart (not in core view): spawning, flights, the catch, and
    // the fades of wishes and of the drawn next turn.
    function stepSky(dt) {
      const sky = dt * timeScale;
      const open = coreTarget === 0 && coreU <= 0 && !motion.matches;
      activeMeteors = 0;
      if (!open) {
        // Meteors fade out within 0.3 s; a catch in progress is pinned at once.
        for (let i = 0; i < METEOR_MAX; i++) {
          if (!mOn[i]) continue;
          if (mVoice[i]) { try { mVoice[i].end(0.1); } catch (error) { audioFailed(error); } mVoice[i] = null; }
          mFade[i] -= dt / 0.3; if (mFade[i] <= 0) dropMeteor(i, 0.1); else activeMeteors++;
        }
        if (coreTarget === 1) finishCatch();
        return;
      }
      skyT += sky;
      for (let q = 0; q < NQ; q++) {
        if (wishAge[q] < 99) wishAge[q] = Math.min(99, wishAge[q] + sky);
        if (!wishPinned[q] && wishFade[q] > 0) wishFade[q] = Math.max(0, wishFade[q] - sky / 0.6);
      }
      drawnFade = clamp01(drawnFade + (drawn ? 1 : -1) * sky / DRAWN_FADE);
      if (sparkleAge < 99) sparkleAge += sky;
      if (skyT >= nextMeteor) {
        if (catchQ < 0 && questionMeteor() < 0 && !score) {
          if (drawn) { spawnMeteor(2, -1, skyT); nextMeteor = skyT + lerp(GOLDEN_GAP[0], GOLDEN_GAP[1], meteorRandom()); }
          else {
            const q = pickQuestion();
            if (q >= 0) spawnMeteor(0, q, skyT);
            nextMeteor = skyT + lerp(METEOR_GAP[0], METEOR_GAP[1], meteorRandom());
          }
        } else nextMeteor = skyT + 1;
      }
      const ease = 1 - Math.exp(-sky / BULLET_TAU);
      for (let i = 0; i < METEOR_MAX; i++) {
        if (!mOn[i] || skyT < mBorn[i]) continue;
        activeMeteors++;
        meteorHeadAt(i);
        // Bullet time: a pointer near the head of a catchable meteor slows it to 35 %.
        const near = pointerIn && mKind[i] !== 1 && Math.hypot(pointerX - MX, pointerY - MY) < BULLET_RADIUS;
        mSlow[i] += ((near ? BULLET_SPEED : 1) - mSlow[i]) * ease;
        mDist[i] += mSpeed[i] * mSlow[i] * sky;
        meteorHeadAt(i);
        if (!mSounded[i]) {
          mSounded[i] = 1;
          const pan0 = panX(MX); const exitX = mX0[i] + mDX[i] * mCross[i];
          if (mKind[i] === 1) {
            // Shower meteors: a fixed, ducked whoosh across their crossing.
            const life = Math.max(0.2, (mPath[i] - MD) / mSpeed[i]) / Math.max(timeScale, 1e-3); const pan1 = panX(exitX);
            cue('whoosh', skyT, a => a.cue.whoosh(a.now(), life, pan0, pan1, 0.02));
          } else cue('whoosh', skyT, a => { mVoice[i] = a.meteorVoice(a.now(), pan0, 0.06); });
        }
        if (mVoice[i]) {
          try { mVoice[i].update(MD / Math.max(1, mCross[i]), panX(MX), (1 - mSlow[i]) / (1 - BULLET_SPEED)); } catch (error) { audioFailed(error); }
        }
        if (MD > mPath[i]) { const passed = mKind[i] === 0; dropMeteor(i, 0.08); if (passed) discover(); }
      }
      // The cursor is a pointer over a catchable meteor.
      const over = pointerIn && meteorAt(pointerX, pointerY) >= 0;
      if (over !== overMeteor) { overMeteor = over; updateCursor(); }
      if (catchQ >= 0) {
        catchT += sky;
        if (catchT >= CATCH_PIN) finishCatch();
      }
    }

    /* ---- Reduced motion: still wishes --------------------------------------- */
    function scheduleStill() {
      clearTimeout(stillTimer); stillTimer = 0;
      if (closed || leaving || !ctx || !motion.matches || mode !== 'chart' || stillQ >= 0 || caughtCount >= NQ) return;
      stillTimer = setTimeout(() => spawnStill(-1), lerp(STILL_GAP[0], STILL_GAP[1], meteorRandom()) * 1000 / Math.max(timeScale, 0.01));
    }
    function spawnStill(q) {
      clearTimeout(stillTimer); stillTimer = 0;
      if (closed || leaving || !motion.matches || mode !== 'chart') return -1;
      stillQ = -1;
      if (!(q >= 0) || caught[q]) q = pickQuestion();
      if (q < 0) return -1;
      // A free spot of sky: inside the viewport, clear of the UI, the chart's middle and the stars.
      let x = (freeL + freeR) / 2; let y = freeT + 48;
      for (let k = 0; k < 48; k++) {
        const cx = lerp(48, W - 48, meteorRandom()); const cy = lerp(48, H - 48, meteorRandom());
        // blocked() also keeps clear of the canvas labels placed in the last frame.
        if (blocked(cx - 24, cy - 24, 48, 48, -2) || Math.hypot(cx - chartX, cy - chartY) < 0.45 * sFit) continue;
        let near = false;
        for (let p = 0; p < NP && !near; p++) near = !!paperVis[p] && Math.hypot(paperSX[p] - cx, paperSY[p] - cy) < 36;
        if (near) continue;
        x = cx; y = cy; break;
      }
      stillQ = q; stillX = x; stillY = y;
      stillTimer = setTimeout(() => { stillTimer = 0; stillQ = -1; discover(); redraw(); scheduleStill(); }, STILL_LIFE * 1000 / Math.max(timeScale, 0.01));
      redraw();
      return q;
    }
    function catchStill() {
      const q = stillQ; if (q < 0) return;
      stillQ = -1; clearTimeout(stillTimer); stillTimer = 0;
      const Q = QUESTIONS[q]; const pan = panX(stillX);
      cue('catch', skyT, a => a.cue.catch(a.now(), Q.a, Q.b, pan));
      markCaught(q); pinWish(q, true);
      if (!drawn) selectWish(q);
      scheduleStill(); redraw();
    }

    /* ---- The score: "Listen to the spiral" -------------------------------- */
    // About 19 s: a comet traces the spiral from its inner start through FIRST_YEAR-LAST_YEAR
    // (one year per turn, at constant angular speed within each year). Each paper it passes rings and
    // sparkles, each year plays its chord and glows, and the plate shows the year with its
    // papers appearing as they ring. Then the comet runs on along the next turn, caught wishes
    // chime, and a final chord resolves.
    function startScore() {
      if (mode !== 'chart' || leaving || coreTarget === 1 || coreU > 0 || score === 1 || score === 2) return;
      selectedPaper = -1; selectedTheme = -1; selectedWish = -1; setIndex(false); finishCatch();
      score = 1; scoreT = 0; scoreCueFrom = -1; scoreYear = -2; scoreFade = 1; scoreLatest = -1; paperRing.fill(-99);
      vYaw = 0; vPitch = 0; plateView = 'score';
      updatePlate();
      listenButton.textContent = 'Stop';
      cue('score', 0, a => a.duck(SCORE_DUCK, 0.6));
      announce(`${COPY.scoreKicker}.`);
      if (motion.matches) {
        // No moving comet: a timer steps through the papers with the same timing, redrawing in place.
        scoreLast = performance.now();
        scoreTimer = setInterval(() => { const now = performance.now(); stepScore((now - scoreLast) / 1000); scoreLast = now; redraw(); }, 50);
      }
      interact(); redraw();
    }
    function stopScore() {
      if (score !== 1 && score !== 2) return;
      score = motion.matches ? 0 : 3; scoreFade = 1;
      clearInterval(scoreTimer); scoreTimer = 0;
      if (audio) { try { audio.release(scorePads, SCORE_STOP / 4); audio.duck(1, 0.8); } catch (error) { audioFailed(error); } }
      scorePads = [];
      listenButton.textContent = COPY.listen;
      if (plateView === 'score') { plateView = ''; updatePlate(); }
      redraw();
    }
    function endScore() {
      score = 0; clearInterval(scoreTimer); scoreTimer = 0; scorePads = [];
      if (audio) { try { audio.duck(1, 1.2); } catch (error) { audioFailed(error); } }
      listenButton.textContent = COPY.listen;
      if (plateView === 'score') { plateView = ''; updatePlate(); }
    }
    // The score plate: a kicker, then all year blocks (and the closing words) stacked in one grid
    // cell, so the tallest sets the height and swapping years never moves the layout.
    function buildScorePlate() {
      scoreKicker = element('p', 'spira-plate-kicker', soundOn ? COPY.scoreKicker : `${COPY.scoreKicker} · ${COPY.scoreSoundOff}`);
      const stack = element('div', 'spira-score-stack'); scoreBlocks = []; scoreRows = new Array(NP).fill(null);
      for (let k = 0; k < SCORE_YEARS.length; k++) {
        const block = element('div', 'spira-score-block');
        block.append(element('p', 'spira-score-year', String(FIRST_YEAR + k)));
        PAPERS.forEach((p, i) => {
          if (p.year !== FIRST_YEAR + k) return;
          const row = element('p', 'spira-score-row', p.name); row.append(element('span', '', ` · ${p.venue}`));
          scoreRows[i] = row; block.append(row);
        });
        scoreBlocks.push(block); stack.append(block);
      }
      const end = element('div', 'spira-score-block');
      end.append(element('h3', 'spira-plate-title', COPY.scoreEndTitle), element('p', 'spira-core-text', COPY.scoreEndText));
      scoreBlocks.push(end); stack.append(end);
      const stop = element('button', 'spira-listen', 'Stop'); stop.type = 'button'; stop.dataset.scoreStop = '';
      plateDetail.append(scoreKicker, stack, stop);
      showScoreBlock(scoreYear);
      for (let p = 0; p < NP; p++) if (paperRing[p] > -99 && scoreRows[p]) scoreRows[p].classList.add('is-on');
    }
    function showScoreBlock(y) {
      const shown = y < 0 ? 0 : y >= TURNS ? TURNS : y;   // the years' blocks, then the closing words
      scoreBlocks.forEach((block, k) => block.classList.toggle('is-on', k === shown));
    }
    function scoreCues() {
      cueLo = scoreCueFrom; cueHi = scoreT + AUDIO_LOOKAHEAD * timeScale; scoreCueFrom = cueHi;
      const now = scoreT; const scale = 1 / Math.max(timeScale, 1e-3);
      for (let k = 0; k < SCORE_YEARS.length; k++) {
        const c = SCORE_AT[k + 1]; if (!crosses(c)) continue;
        const dur = (SCORE_YEARS[k] + 1.2) * scale;
        cue('year', c, a => { scorePads.push(...a.cue.year(audioAt(a, c, now), k, dur, k === TURNS - 1)); });
      }
      for (let p = 0; p < NP; p++) {
        const paper = PAPERS[p]; const c = paper.scoreAt; if (!crosses(c)) continue;
        paperRing[p] = c; scoreLatest = p;
        if (scoreRows[p]) scoreRows[p].classList.add('is-on');
        const pan = panX(paperSX[p]);
        cue('ring', c, a => a.cue.paper(audioAt(a, c, now), paper.theme, paper.year, pan));
      }
      for (let q = 0; q < NQ; q++) {
        if (!wishPinned[q]) continue;
        const Q = QUESTIONS[q]; const c = Q.scoreAt; if (!crosses(c)) continue;
        const pan = panX(wishSX[q]);
        cue('chime', c, a => a.cue.dyad(audioAt(a, c, now), Q.a, Q.b, 0.05, pan));
      }
      const resolve = SCORE_TOTAL;   // after the last chime
      if (crosses(resolve)) cue('resolve', resolve, a => { scorePads.push(...a.cue.resolve(audioAt(a, resolve, now))); });
    }
    function stepScore(dt) {
      if (!score) return;
      if (score === 3) { scoreFade -= dt / SCORE_STOP; if (scoreFade <= 0) { score = 0; scoreFade = 0; } return; }
      scoreT += dt * timeScale;
      scoreCues();
      const y = scoreYearAt(scoreT);
      if (y !== scoreYear) { scoreYear = y; showScoreBlock(y); }
      if (score === 1 && scoreT >= SCORE_TOTAL) score = 2;
      if (score === 2 && scoreT >= SCORE_TOTAL + SCORE_OUTRO) endScore();
    }
    // A rung paper's label stays bright for SCORE_GLOW s.
    const scoreBoost = p => (score && paperRing[p] > -99 && scoreT >= paperRing[p] ? 1 - smooth((scoreT - paperRing[p] - (SCORE_GLOW - 0.5)) / 0.5) : 0);
    function drawScoreComet(layer) {
      if (!score || motion.matches || scoreT > SCORE_TOTAL) return;
      const show = (score === 3 ? scoreFade : 1) * (1 - smooth((scoreT - (SCORE_TOTAL - 0.6)) / 0.6)) * layer;
      if (show <= 0.004) return;
      const head = scoreTheta(scoreT);
      projectAt(head, 1);
      drawCometBody(head, PX, PY, show);
    }

    /* ---- Plate, themes, index -------------------------------------------- */
    function announce(text) { statusEl.textContent = text; }
    function element(tag, className, text) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    // A link to a paper: its page on this site, or (another paper) the paper itself in a new tab.
    function paperLink(p, className, text) {
      const link = element('a', className, text);
      if (p.href) link.href = p.href;
      if (!p.local) { link.target = '_blank'; link.rel = 'noopener'; }
      return link;
    }
    /**
     * A local paper's takeaway, read from its page (the .paper-takeaway text) and cached per
     * slug. A cached one shows at once. Otherwise the element keeps the room of the longest
     * takeaway the plate shows (CSS: .is-pending) while the page loads, so the plate does not
     * jump; the text then fades in as the element settles to its own height (at once under
     * reduced motion). A page without a takeaway, or one that cannot be read, leaves none.
     */
    function takeawayElement(p) {
      const known = takeawayCache.get(p.slug);
      if (known === '') return null;
      const el = element('p', 'spira-takeaway');
      if (typeof known === 'string') { el.textContent = known; plateTakeaway = { slug: p.slug, state: 'shown', text: known }; return el; }
      el.classList.add('is-pending'); el.setAttribute('aria-busy', 'true');
      plateTakeaway = { slug: p.slug, state: 'loading', text: '' };
      loadTakeaway(p.slug).then(text => {
        if (closed || !el.isConnected) return;
        if (!text) { el.remove(); plateTakeaway = { slug: p.slug, state: 'none', text: '' }; measureUI(); redraw(); return; }
        const from = el.getBoundingClientRect().height;
        el.textContent = text; el.classList.remove('is-pending'); el.removeAttribute('aria-busy');
        plateTakeaway = { slug: p.slug, state: 'shown', text };
        const to = el.getBoundingClientRect().height;
        if (!motion.matches && typeof el.animate === 'function') {
          const settle = el.animate([{ opacity: 0, height: `${from}px` }, { opacity: 1, height: `${to}px` }], { duration: TAKEAWAY_IN_MS, easing: 'ease-out' });
          settle.finished.then(() => { if (!closed) { measureUI(); redraw(); } }, () => {});
        }
        measureUI(); redraw();
      });
      return el;
    }
    function updatePlate() {
      plateDetail.replaceChildren(); plateTakeaway = null;
      const detail = coreTarget === 1 || selectedPaper >= 0 || selectedWish >= 0 || selectedTheme >= 0 || plateView !== '';
      plateDefault.hidden = detail; plateDetail.hidden = !detail;
      if (coreTarget === 1) {
        const back = element('button', 'spira-back', COPY.backOut); back.type = 'button';
        on(back, 'click', backOut);
        plateDetail.append(element('p', 'spira-plate-kicker', COPY.coreKicker), element('h3', 'spira-plate-title', COPY.coreTitle),
          element('p', 'spira-core-text', COPY.coreText), element('p', 'spira-hint', coarse || narrow ? COPY.deeperTouch : COPY.deeperPointer), back);
        announce(`${COPY.coreKicker}. ${COPY.coreTitle}`);
      } else if (selectedPaper >= 0) {
        // A local paper links to its page and shows its takeaway; another links to the paper itself.
        const p = PAPERS[selectedPaper];
        plateDetail.append(element('p', 'spira-plate-kicker', `${p.year} · ${THEMES[p.theme].label}`), element('h3', 'spira-plate-title', p.title));
        const takeaway = p.local ? takeawayElement(p) : null;
        if (takeaway) plateDetail.append(takeaway);
        plateDetail.append(element('p', 'spira-venue', p.venue));
        if (p.href) plateDetail.append(paperLink(p, 'spira-link', p.local ? 'Read the paper page →' : 'Read the paper →'));
        announce(`${p.name}, ${p.year}, ${THEMES[p.theme].label}.`);
      } else if (selectedWish >= 0) {
        const q = QUESTIONS[selectedWish];
        plateDetail.append(element('p', 'spira-plate-kicker', q.kicker), element('h3', 'spira-plate-title', q.text), element('p', 'spira-core-text', q.note));
        announce(`${q.kicker}. ${q.text}`);
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
            const link = paperLink(p, '', p.name); link.dataset.paper = String(PAPERS.indexOf(p));
            list.append(link);
          });
          row.append(list); plateDetail.append(row);
        }
        announce(`${theme.label}. ${theme.question}`);
      } else if (plateView === 'score') {
        buildScorePlate();
      } else if (plateView) {
        // The caught open questions; once all ten are caught, the next turn is drawn.
        if (drawn) {
          const link = element('a', 'spira-link', COPY.drawnLink); link.href = new URL(COPY.drawnHref, ROOT).href;
          plateDetail.append(element('p', 'spira-plate-kicker', COPY.drawnKicker), element('h3', 'spira-plate-title', COPY.drawnTitle),
            element('p', 'spira-core-text', COPY.drawnText), link);
        } else {
          plateDetail.append(element('p', 'spira-plate-kicker', 'Open questions'), element('h3', 'spira-plate-title', `${caughtCount} of ${NQ} caught.`));
          if (!caughtCount) plateDetail.append(element('p', 'spira-core-text', 'Catch a shooting star to pin its question on the next turn.'));
        }
        if (plateView === 'wishes' && caughtCount) {
          const list = element('div', 'spira-wish-list');
          for (let q = 0; q < NQ; q++) {
            if (!caught[q]) continue;
            const row = element('button', 'spira-wish-row', QUESTIONS[q].text); row.type = 'button'; row.dataset.wish = String(q);
            list.append(row);
          }
          const release = element('button', 'spira-release', COPY.release); release.type = 'button'; release.dataset.release = '';
          plateDetail.append(list, release);
        }
        announce(drawn ? `${COPY.drawnKicker}. ${COPY.drawnTitle}` : `${caughtCount} of ${NQ} open questions caught.`);
      } else announce('');
      themeButtons.forEach((button, j) => button.setAttribute('aria-pressed', String(j === selectedTheme)));
      measureUI();
      redraw();
    }
    function selectTheme(j) {
      stopScore();
      selectedTheme = selectedTheme === j ? -1 : j; selectedPaper = -1; selectedWish = -1; plateView = '';
      if (selectedTheme === j) playTheme(j);   // its papers as an arpeggio, in order
      interact(); updatePlate();
    }
    function selectPaper(p) {
      if (p >= 0) stopScore();
      selectedPaper = p; if (p >= 0) { selectedTheme = -1; selectedWish = -1; plateView = ''; playPaper(p, true); }
      updatePlate();
    }
    function setIndex(open) {
      indexOpen = open; indexEl.hidden = !open; indexButton.setAttribute('aria-expanded', String(open));
      measureUI(); redraw();
    }
    function setHover(p, sound) {
      if (hoverPaper === p) return;
      hoverPaper = p; updateCursor();
      if (p >= 0 && PAPERS[p].local) loadTakeaway(PAPERS[p].slug);   // ready before a click opens its plate
      if (p >= 0 && sound) playPaper(p, false);   // brushing across the spiral strums it
      redraw();
    }

    function enterCore() {
      if (mode !== 'chart' || coreTarget === 1 || leaving) return;
      stopScore();
      // Remember the chart camera; the flight back returns to it exactly.
      coreFrom.yaw = yaw; coreFrom.pitch = pitch; coreFrom.zoom = zoom;
      coreFrom.yawTo = yaw - (((yaw % TAU) + TAU + Math.PI) % TAU - Math.PI);
      coreTarget = 1; coreSpin = 0; vYaw = 0; vPitch = 0; zoomTarget = zoom;
      if (drag.id >= 0) endDrag(true);
      setHover(-1); setHoverWish(-1); setIndex(false); selectedWish = -1; plateView = '';
      finishCatch();
      if (audio) { try { audio.muffle(true, motion.matches ? 0.05 : CORE_FLIGHT); } catch (error) { audioFailed(error); } }
      centreButton.hidden = true; centreHover = false;
      if (motion.matches) coreU = 1;
      updatePlate();
      const back = plateDetail.querySelector('.spira-back');
      if (back) back.focus({ preventScroll: true });
      interact(); redraw();
    }
    function backOut() {
      if (coreTarget !== 1 || dive) return;
      coreTarget = 0;
      if (motion.matches) { coreU = 0; coreSpin = 0; }
      if (audio) { try { audio.muffle(false, motion.matches ? 0.05 : CORE_FLIGHT); } catch (error) { audioFailed(error); } }
      centreButton.hidden = false;
      updatePlate();
      centreButton.focus({ preventScroll: true });
      interact(); redraw();
    }
    /* ---- Strange loop: dive from the page into the galaxy ------------------ */
    // From the core view the camera keeps zooming into the text spiral's vanishing point. The
    // words stream outward and fade; at the centre the whole galaxy appears, tiny and turning,
    // and grows (log scale, easeInOutCubic: a constant perceptual zoom speed) until it is
    // exactly the chart view the core was entered from. Repeatable without limit.
    function startDive() {
      if (dive || mode !== 'chart' || leaving || coreTarget !== 1 || coreU < 0.98) return;
      dive = 1; diveU = 0; diveWheel = 0; corePinch.a = -1; corePinch.b = -1;
      const dur = DIVE_TIME / Math.max(timeScale, 1e-3);
      cue('dive', 0, a => { a.cue.dive(a.now(), dur); a.muffle(false, dur); });
      announce('Going deeper: the galaxy again.');
      if (motion.matches) finishDive(); else { interact(); schedule(); }
    }
    function finishDive() {
      dive = 0; diveU = 0;
      coreTarget = 0; coreU = 0; coreSpin = 0;
      yaw = coreFrom.yaw; pitch = coreFrom.pitch; zoom = coreFrom.zoom; zoomTarget = zoom; vYaw = 0; vPitch = 0;
      centreButton.hidden = false;
      updatePlate();
      stage.focus({ preventScroll: true });
      cue('arrive', 0, a => { a.cue.arrive(a.now()); a.muffle(false, 0.05); });
      interact(); redraw();
    }
    function renderDive(now) {
      const e = easeInOutCubic(diveU); const z = Math.exp(e * Math.log(DIVE_ZOOM));
      const keepU = coreU;
      drawNebula(1);
      // Outside: the core view, zoomed z times about the text spiral's centre (the vanishing point).
      const words = 1 - smooth((z - 1) / (DIVE_WORD_FADE - 1));
      const sky = 1 - smooth(e / 0.45);
      if (words > 0.004 || sky > 0.004) {
        setBase(z, 0, 0, z, coreX * (1 - z), coreY * (1 - z));
        coreU = 1; chartCamera();
        if (sky > 0.004) drawStars(sky);
        if (words > 0.004) drawCoreText(T_SETTLED, words);
        setBase(1, 0, 0, 1, 0, 0);
      }
      // Inside: the galaxy at the centre, z / DIVE_ZOOM of its chart size, turning back to rest
      // while its centre travels to the chart's and its pitch rises from face-on.
      const scale = sFit * coreFrom.zoom * z / DIVE_ZOOM;
      coreU = 0;
      setCamera(lerp(coreX, chartX, e), lerp(coreY, chartY, e), coreFrom.yaw + DIVE_SPIN * (1 - e), coreFrom.pitch * e, scale);
      diveLabels = smooth((scale / (sFit * coreFrom.zoom) - DIVE_LABELS) / 0.2);
      // Its own starfield fades in only once it is large enough not to read as a patch.
      sceneStars = false;
      drawStars(smooth((z / DIVE_ZOOM - 0.25) / 0.5));
      drawScene(T_SETTLED, true, smooth(e / 0.15));
      sceneStars = true; diveLabels = 1; coreU = keepU;
    }
    function stepDive(dt) {
      diveU = clamp01(diveU + dt * timeScale / DIVE_TIME);
      if (diveU >= 1) finishDive();
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
        const x = event.clientX; const y = event.clientY;
        let p = nearestPaper(x, y, radius); const w = nearestWish(x, y, radius);
        // A wish star wins over a farther paper star.
        if (w >= 0 && (p < 0 || Math.hypot(wishSX[w] - x, wishSY[w] - y) < Math.hypot(paperSX[p] - x, paperSY[p] - y))) p = -1;
        const near = p >= 0 ? Math.hypot(paperSX[p] - x, paperSY[p] - y) : w >= 0 ? Math.hypot(wishSX[w] - x, wishSY[w] - y) : Infinity;
        // The centre opens the core, unless a star is nearer to the pointer.
        const toCentre = Math.hypot(x - chartX, y - chartY);
        if (toCentre < CORE_HIT && near > toCentre) enterCore();
        else if (p >= 0) selectPaper(p);
        else if (w >= 0) selectWish(w);
        else if (selectedPaper >= 0) selectPaper(-1);
        else if (selectedWish >= 0) selectWish(-1);
        else if (selectedTheme >= 0) { selectedTheme = -1; updatePlate(); }
        else if (plateView) { plateView = ''; updatePlate(); }
        // A tap on empty sky also brings the hidden chrome back for a moment.
        if (drag.type === 'touch' && p < 0 && w < 0 && !(toCentre < CORE_HIT && near > toCentre)) showChrome(CHROME_TAP_MS);
      }
      interact(); redraw();
    }
    on(stage, 'pointerdown', event => {
      if (mode !== 'chart' || event.button > 0 || dive) return;
      if (coreTarget === 1 || coreU > 0) {
        // In core view a click backs out (or, on the vanishing point, dives); two touches may pinch.
        if (event.pointerType === 'touch' && coreTarget === 1) {
          if (corePinch.a < 0) { corePinch.a = event.pointerId; corePinch.ax = event.clientX; corePinch.ay = event.clientY; }
          else if (corePinch.b < 0 && event.pointerId !== corePinch.a) {
            corePinch.b = event.pointerId; corePinch.bx = event.clientX; corePinch.by = event.clientY;
            corePinch.start = Math.hypot(corePinch.bx - corePinch.ax, corePinch.by - corePinch.ay) || 1; coreClick = false; return;
          }
        }
        coreClick = corePinch.b < 0; return;
      }
      if (score === 1 || score === 2) { stopScore(); return; }
      // A shooting star (or a still wish) near the pointer is caught before anything else.
      if (drag.id < 0 && tryCatch(event.clientX, event.clientY)) { event.preventDefault(); interact(); return; }
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
      if (coreTarget === 1 && corePinch.b >= 0 && (event.pointerId === corePinch.a || event.pointerId === corePinch.b)) {
        if (event.pointerId === corePinch.a) { corePinch.ax = event.clientX; corePinch.ay = event.clientY; } else { corePinch.bx = event.clientX; corePinch.by = event.clientY; }
        if (Math.hypot(corePinch.bx - corePinch.ax, corePinch.by - corePinch.ay) / corePinch.start > DIVE_PINCH) startDive();
        return;
      }
      if (mode !== 'chart' || coreU > 0 || coreTarget || dive) return;
      if (event.pointerId === pinch.id || (pinch.id >= 0 && event.pointerId === drag.id)) {
        if (event.pointerId === pinch.id) { pinch.x = event.clientX; pinch.y = event.clientY; } else { drag.x = event.clientX; drag.y = event.clientY; }
        const distance = Math.hypot(pinch.x - drag.x, pinch.y - drag.y) || 1;
        zoomTarget = clamp(zoomTarget * distance / pinch.distance, ZOOM_RANGE[0], ZOOM_RANGE[1]);
        if (motion.matches) zoom = zoomTarget;
        pinch.distance = distance; interact(); redraw();
        return;
      }
      if (event.pointerId === drag.id) {
        lastMoveAt = performance.now();
        const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) > 4) { drag.moved = true; stage.classList.add('is-dragging'); }
        if (drag.moved) {
          // The galaxy is held by its near side (the lower, larger half of the tilted disk): it
          // follows the pointer. A larger yaw carries the near side left and a larger pitch lifts
          // it (more edge-on), so both turn against the pointer's motion.
          yaw -= dx * DRAG_YAW; pitch = clamp(pitch - dy * DRAG_PITCH, PITCH_RANGE[0], PITCH_RANGE[1]);
          const seconds = Math.max(0.008, (event.timeStamp - drag.at) / 1000);
          if (!motion.matches) { vYaw = lerp(vYaw, -dx * DRAG_YAW / seconds, 0.5); vPitch = lerp(vPitch, -dy * DRAG_PITCH / seconds, 0.5); }
          if (hoverPaper >= 0) setHover(-1);
          if (hoverWish >= 0) setHoverWish(-1);
        }
        drag.x = event.clientX; drag.y = event.clientY; drag.at = event.timeStamp;
        interact(); redraw();
        return;
      }
      if (event.pointerType !== 'touch') { pointerX = event.clientX; pointerY = event.clientY; pointerIn = true; }
      if (event.pointerType === 'mouse' && drag.id < 0) {
        const x = event.clientX; const y = event.clientY;
        const p = nearestPaper(x, y, HOVER_RADIUS); const w = nearestWish(x, y, HOVER_RADIUS);
        const wish = w >= 0 && (p < 0 || Math.hypot(wishSX[w] - x, wishSY[w] - y) < Math.hypot(paperSX[p] - x, paperSY[p] - y));
        setHover(wish ? -1 : p, true); setHoverWish(wish ? w : -1, true);
      }
    });
    on(stage, 'pointerup', event => {
      if (event.pointerId === corePinch.a || event.pointerId === corePinch.b) {
        if (event.pointerId === corePinch.a) corePinch.a = -1; else corePinch.b = -1;
        if (corePinch.b >= 0 && corePinch.a < 0) { corePinch.a = corePinch.b; corePinch.ax = corePinch.bx; corePinch.ay = corePinch.by; corePinch.b = -1; }
      }
      // In core view a click on the text spiral's vanishing point dives; elsewhere it backs out.
      if (coreClick) {
        coreClick = false;
        if (coreTarget !== 1 || dive) return;
        if (Math.hypot(event.clientX - coreX, event.clientY - coreY) < CORE_HIT) startDive(); else backOut();
        return;
      }
      if (event.pointerId === pinch.id) { pinch.id = -1; return; }
      if (event.pointerId === drag.id) endDrag(false, event);
    });
    on(stage, 'pointercancel', event => { if (event.pointerId === drag.id || event.pointerId === pinch.id) endDrag(true); });
    on(stage, 'lostpointercapture', event => { if (event.pointerId === drag.id) endDrag(true); });
    on(stage, 'pointerleave', event => {
      if (event.pointerType !== 'touch') { pointerIn = false; if (overMeteor) { overMeteor = false; updateCursor(); } }
      if (event.pointerType === 'mouse' && drag.id < 0) { setHover(-1); setHoverWish(-1); }
    });
    on(stage, 'wheel', event => {
      if (mode !== 'chart') return;
      event.preventDefault();
      if (dive) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? H : 1;
      // In core view, scrolling outward backs out; scrolling inward past DIVE_WHEEL dives.
      if (coreTarget === 1 || coreU > 0) {
        if (coreTarget !== 1) return;
        if (event.deltaY > 0) { diveWheel = 0; backOut(); return; }
        const nowMs = performance.now(); if (nowMs - diveWheelAt > 600) diveWheel = 0; diveWheelAt = nowMs;
        diveWheel -= event.deltaY * unit;
        if (diveWheel > DIVE_WHEEL) startDive();
        return;
      }
      zoomTarget = clamp(zoomTarget * Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.0015)), ZOOM_RANGE[0], ZOOM_RANGE[1]);
      if (motion.matches) zoom = zoomTarget;
      interact(); redraw();
    }, { passive: false });
    on(stage, 'keydown', event => {
      if (mode === 'chart' && coreTarget === 1 && !dive && event.target === stage && (event.key === '+' || event.key === '=')) { event.preventDefault(); startDive(); return; }
      if (mode !== 'chart' || coreTarget || coreU > 0 || dive || event.target !== stage || event.altKey || event.ctrlKey || event.metaKey) return;
      switch (event.key) {
        // As a drag would: the near side of the galaxy moves the way the arrow points.
        case 'ArrowLeft': yaw += 0.15; break;
        case 'ArrowRight': yaw -= 0.15; break;
        case 'ArrowUp': pitch = clamp(pitch + 0.08, PITCH_RANGE[0], PITCH_RANGE[1]); break;
        case 'ArrowDown': pitch = clamp(pitch - 0.08, PITCH_RANGE[0], PITCH_RANGE[1]); break;
        case '+': case '=': zoomTarget = clamp(zoomTarget * 1.2, ZOOM_RANGE[0], ZOOM_RANGE[1]); break;
        case '-': case '_': zoomTarget = clamp(zoomTarget / 1.2, ZOOM_RANGE[0], ZOOM_RANGE[1]); break;
        default: return;
      }
      event.preventDefault(); vYaw = 0; vPitch = 0;
      if (motion.matches) zoom = zoomTarget;
      interact(); redraw();
    });

    /* ---- Chrome: hidden until intent ------------------------------------- */
    // Opening controls and chart actions show while the pointer is in their corner (and for
    // CHROME_HIDE_MS after it leaves), while focus is within them (CSS), or for CHROME_TAP_MS
    // after a tap on empty sky. A whisper toast is the only feedback for the M key.
    let chromeTimer = 0; let chromeIn = false; let toastTimer = 0;
    function showChrome(ms) {
      dialog.classList.add('is-chrome');
      clearTimeout(chromeTimer); chromeTimer = ms > 0 ? setTimeout(hideChrome, ms / Math.max(timeScale, 0.01)) : 0;
    }
    function hideChrome() { clearTimeout(chromeTimer); chromeTimer = 0; dialog.classList.remove('is-chrome'); }
    function inChromeRegion(x, y) {
      if (mode === 'chart') return x >= chromeLeft - CHROME_CHART[0] && y <= CHROME_CHART[1];
      if (mode === 'opening' || mode === 'replay-out') return x >= W - CHROME_OPENING[0] && y >= H - CHROME_OPENING[1];
      return false;
    }
    function toast(text) {
      toastEl.textContent = text; toastEl.classList.toggle('is-bottom', mode !== 'chart'); toastEl.classList.add('is-shown');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('is-shown'), TOAST_MS);
    }
    on(dialog, 'pointermove', event => {
      if (event.pointerType === 'touch' || closed || leaving) return;
      const inside = inChromeRegion(event.clientX, event.clientY);
      if (inside && !chromeIn) { chromeIn = true; showChrome(0); }
      else if (!inside && chromeIn) { chromeIn = false; showChrome(CHROME_HIDE_MS); }
    });
    on(dialog, 'pointerleave', event => { if (event.pointerType !== 'touch' && chromeIn) { chromeIn = false; showChrome(CHROME_HIDE_MS); } });
    // During the opening the stage is inert: a tap lands on the dialog and only reveals the chrome.
    on(dialog, 'pointerup', event => {
      if (event.pointerType === 'touch' && mode !== 'chart' && !leaving && (event.target === dialog || event.target === stage)) showChrome(CHROME_TAP_MS);
    });

    /* ---- Controls -------------------------------------------------------- */
    themeButtons.forEach((button, j) => on(button, 'click', () => selectTheme(j)));
    on(indexButton, 'click', () => { setIndex(!indexOpen); interact(); });
    on(replayButton, 'click', replay);
    on(closeButton, 'click', close);
    on(skipButton, 'click', skip);
    for (const button of soundButtons) on(button, 'click', () => setSound(!soundOn));
    on(listenButton, 'click', () => { if (score === 1 || score === 2) stopScore(); else startScore(); });
    // The counter lists the caught questions in the plate when it is focused or clicked.
    on(countButton, 'click', showWishList);
    on(countButton, 'focus', () => { if (plateView !== 'wishes') showWishList(); });
    on(plateDetail, 'click', event => {
      const target = event.target.closest ? event.target : null; if (!target) return;
      if (target.closest('[data-score-stop]')) { stopScore(); return; }
      const row = target.closest('[data-wish]');
      if (row) { selectWish(Number(row.dataset.wish)); return; }
      if (target.closest('[data-release]')) releaseWishes();
    });
    on(centreButton, 'click', enterCore);
    on(centreButton, 'pointerenter', () => { centreHover = true; redraw(); });
    on(centreButton, 'pointerleave', () => { centreHover = false; redraw(); });
    on(centreButton, 'focus', () => { centreHover = true; redraw(); });
    on(centreButton, 'blur', () => { centreHover = false; redraw(); });
    on($('[data-opening-close]'), 'click', close);
    const hoverFromLink = event => {
      const link = event.target.closest && event.target.closest('[data-paper]');
      setHover(link ? Number(link.dataset.paper) : -1);
      const wish = event.target.closest && event.target.closest('[data-wish]');
      setHoverWish(wish ? Number(wish.dataset.wish) : -1);
    };
    for (const container of [indexEl, plateDetail]) {
      on(container, 'pointerover', hoverFromLink);
      on(container, 'focusin', hoverFromLink);
      on(container, 'pointerleave', () => { setHover(-1); setHoverWish(-1); });
      on(container, 'focusout', () => { setHover(-1); setHoverWish(-1); });
    }
    on(dialog, 'keydown', event => {
      // Any navigation key reveals the keyboard focus ring that was quiet on open.
      if (event.key === 'Tab' || (event.key.startsWith('Arrow') && event.target !== stage)) dialog.removeAttribute('data-quiet');
      if (mode === 'opening' && event.key === 'Enter' && (event.target === skipButton || !(event.target instanceof HTMLButtonElement))) {
        event.preventDefault(); skip();
      }
      if (event.altKey || event.ctrlKey || event.metaKey || closed) return;
      if (event.target.closest && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      // M switches the sound; in the chart, 1-5 choose a theme and Space catches a shooting star.
      if ((event.key === 'm' || event.key === 'M') && !event.repeat) {
        setSound(!soundOn); toast(soundOn ? 'Sound on' : 'Sound off'); announce(soundOn ? 'Sound on' : 'Sound off');
        return;
      }
      if (mode !== 'chart' || leaving || coreTarget === 1) return;
      if ((event.key === 'l' || event.key === 'L') && !event.repeat) { if (score === 1 || score === 2) stopScore(); else startScore(); return; }
      if (event.key >= '1' && event.key <= '5' && event.key.length === 1) { event.preventDefault(); selectTheme(Number(event.key) - 1); return; }
      if (event.key === ' ' || event.key === 'Spacebar') {
        // A focused control keeps its own Space; elsewhere Space catches the visible meteor.
        if (event.target !== stage && event.target.closest && event.target.closest('button, a, summary')) return;
        if (motion.matches) { if (stillQ >= 0) { event.preventDefault(); catchStill(); } return; }
        const i = visibleMeteor();
        if (i >= 0) { event.preventDefault(); catchMeteor(i); redraw(); }
      }
    });
    // The first gesture inside the dialog may start (or create) the audio context.
    on(dialog, 'pointerdown', unlockAudio, { capture: true });
    on(dialog, 'keydown', unlockAudio, { capture: true });
    // Esc backs out of the core view first; otherwise it closes (a second Esc while closing finishes).
    on(dialog, 'cancel', event => {
      event.preventDefault();
      if (dive && !leaving) finishDive();
      else if ((score === 1 || score === 2) && !leaving) stopScore();
      else if (coreTarget === 1 && !leaving) backOut();
      else close();
    });
    on(dialog, 'close', cleanup);
    on(window, 'pagehide', cleanup);
    on(window, 'resize', () => {
      if (closed) return;
      if (leaving) { cleanup(); return; }
      if (mode !== 'chart') { remnantT = -2; skip(); }
      // Meteors and a laid-out question belong to the old layout: pin and clear them.
      finishCatch(); clearMeteors();
      if (stillQ >= 0) { stillQ = -1; scheduleStill(); }
      layout(); redraw();
    });
    on(document, 'visibilitychange', () => {
      if (document.hidden) {
        if (leaving) { cleanup(); return; }
        if (raf) cancelAnimationFrame(raf); raf = 0; lastNow = 0;
        if (audio && !audio.offline && audio.state === 'running') audio.context.suspend().catch(() => {});
      } else {
        lastNow = 0; redraw();
        if (audio && !audio.offline && soundOn && audio.state === 'suspended') audio.context.resume().catch(() => {});
      }
    });
    on(motion, 'change', () => {
      if (leaving) { cleanup(); return; }
      replayButton.hidden = motion.matches;
      if (motion.matches) { vYaw = 0; vPitch = 0; zoom = zoomTarget; if (mode !== 'chart') skip(); finishCatch(); clearMeteors(); drawnFade = drawn ? 1 : 0; scheduleStill(); }
      else { stillQ = -1; clearTimeout(stillTimer); stillTimer = 0; }
      redraw();
    });

    // Test hook (read-only in spirit): phase, word count, frame timing and star projection.
    dialog.spira = {
      get phase() { return phase; },
      get wordCount() { return wordCount; },
      get keyCount() { return keyCount; },
      get closeStep() { return closeStep(); },
      get canvasWords() { return canvasWords; },
      get dawnLines() { return lineCount; },
      get view() { return dive ? 'dive' : coreTarget === 1 || coreU > 0 ? 'core' : 'chart'; },
      get diveProgress() { return dive ? diveU : -1; },
      projectCore() { return { x: chartX, y: chartY }; },
      projectVanishing() { return { x: coreX, y: coreY }; },
      get nebula() { return nebulaReady; },
      frameStats: stats,
      projectStar(slug) {
        const p = PAPERS.findIndex(paper => paper.slug === slug);
        return p < 0 ? null : { x: paperSX[p], y: paperSY[p] };
      },
      // The papers drawn (from data.js or the open() hook), the year labels ('next' last), the
      // score's seconds per year, and what the plate shows of a takeaway: null when it shows
      // none (no paper, or a paper with no page), else { slug, state: 'loading' | 'shown' | 'none', text }.
      get papers() { return PAPERS.map(p => ({ slug: p.slug, name: p.name, year: p.year, theme: THEMES[p.theme].id, local: p.local, href: p.href, title: p.title, venue: p.venue })); },
      get years() { return YEAR_MARKS.map(mark => mark.label); },
      get scoreYears() { return SCORE_YEARS.slice(); },
      get takeaway() { return plateTakeaway ? Object.assign({}, plateTakeaway) : null; },
      // Sound: the cue log, the preference, and the voices the synthesizer has scheduled.
      audioCues,
      get sound() { return soundOn; },
      get audioState() { return audio ? audio.state : 'none'; },
      get voices() { return audio ? audio.scheduled : 0; },
      // Shooting stars and wishes.
      get caught() { return caughtCount; },
      get wishes() { const list = []; for (let q = 0; q < NQ; q++) if (wishPinned[q]) list.push(q); return list; },
      get drawn() { return drawn; },
      get bridge() { return { q: bridgeQ, fade: bridgeFade }; },
      get chrome() { return dialog.classList.contains('is-chrome'); },
      get catching() { return catchQ; },
      // The score: null when off, else its state, clock and current year (FIRST_YEAR-LAST_YEAR;
      // 0 before, 1 after).
      get score() { return score ? { state: ['', 'playing', 'outro', 'stopping'][score], t: scoreT, year: scoreYear < 0 ? 0 : scoreYear >= TURNS ? 1 : FIRST_YEAR + scoreYear } : null; },
      // Spawn a question meteor now, already inside the viewport (a still wish under reduced
      // motion); returns its question or -1.
      spawnMeteor(q) {
        if (mode !== 'chart' || leaving) return -1;
        if (motion.matches) return spawnStill(q === undefined ? -1 : q);
        for (let i = 0; i < METEOR_MAX; i++) if (mOn[i] && mKind[i] !== 1) dropMeteor(i, 0.08);
        if (q === undefined || q < 0 || caught[q]) q = drawn ? -1 : pickQuestion();
        const i = drawn && q < 0 ? spawnMeteor(2, -1, 0, 0, undefined, true) : q >= 0 ? spawnMeteor(0, q, 0, 0, undefined, true) : -1;
        redraw();
        return i < 0 ? -1 : q;
      },
      // The visible catchable meteor's current speed in px/s (bullet time included).
      get meteorSpeed() { const i = visibleMeteor(); return i < 0 ? 0 : mSpeed[i] * mSlow[i]; },
      meteorHead() {
        if (motion.matches) return stillQ >= 0 ? { x: stillX, y: stillY } : null;
        const i = visibleMeteor();
        if (i < 0) return null;
        meteorHeadAt(i); return { x: MX, y: MY };
      },
      projectWish(q) { return wishVis[q] ? { x: wishSX[q], y: wishSY[q] } : null; }
    };

    /* ---- Open ------------------------------------------------------------ */
    loadWishes(); updateCount(); renderSoundButtons();
    try {
      html.style.setProperty('scrollbar-gutter', 'stable');
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
        adoptAudio();
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
        stage.focus({ preventScroll: true });
        measureUI();
        adoptAudio(); cue('ambient', t, a => a.cue.ambient(a.now()));
        scheduleStill();
        if (ctx) { try { render(performance.now()); } catch (error) { console.warn('The spiral could not be drawn.', error); } }
        else canvas.hidden = true;
        schedule();
      }
    } catch (error) {
      console.warn('The spiral could not open.', error);
      cleanup();
    }
  }

  // createAudio builds the egg's synthesizer on any BaseAudioContext (tests render it offline);
  // ghostWords are the curated phrases of the next turn (the suite finds each on the homepage).
  window.SiteEasterEgg = { open, createAudio: (context, options) => createSpiraAudio(context, options), ghostWords: Object.freeze(GHOST_WORDS.slice()) };
})();
