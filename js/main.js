// quantum_ascii: a hand, a spark, a big bang, and the solar system,
// all drawn as coloured ASCII characters on one canvas.
//
// Every frame the scene is "lit" into a per-cell buffer (brightness + tint),
// then each cell is stamped with a glyph from a pre-rendered atlas.
// The whole film is a pure function of the timeline `t`, so every replay
// is frame-for-frame the same.
(() => {
  'use strict';

  const DATA = window.COSMOS_DATA;
  const AUDIO = window.CosmosAudio;

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);
  const ui = {
    intro: $('intro'), question: $('question'), begin: $('begin'),
    caption: $('caption'), flash: $('flash'), skip: $('skip'), replay: $('replay'),
    sound: $('sound'), hint: $('hint'), info: $('info'), reticle: $('reticle'),
    reticleLabel: $('reticle-label'), hover: $('hover'),
  };

  // ---------------------------------------------------------------- timeline
  const TB = 9.4;        // the bang
  const T_LIVE = 18.4;   // solar system is formed and clickable
  const CAPTIONS = [
    [0.9, 3.5, 'before time, there was only the dark.'],
    [4.1, 6.8, 'and in the dark, a single spark.'],
    [7.1, 8.95, 'it could not be held.'],
    [12.4, 15.6, 'nine billion years later, a star.'],
    [16.0, 19.6, 'and around it, nine worlds.'],
  ];
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- math
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut3 = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const TAU = Math.PI * 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 5.3, y * 2.1 + 1.7) * 0.3 + vnoise(x * 4.3 + 9.1, y * 4.3 + 3.3) * 0.15;
  }

  // ---------------------------------------------------------------- palette
  const TINT_LIST = [
    ['STAR', [208, 212, 226]], ['DUST', [112, 118, 148]], ['HAND', [226, 219, 206]],
    ['LIGHT', [255, 247, 222]], ['SUN', [255, 226, 112]], ['SUN2', [255, 176, 48]],
    ['CORONA', [255, 124, 32]], ['MERCURY', [176, 166, 156]], ['VENUS', [232, 198, 138]],
    ['EARTH', [78, 140, 255]], ['LAND', [96, 196, 120]], ['MARS', [228, 102, 60]],
    ['JUP', [214, 164, 116]], ['JUP2', [244, 220, 186]], ['JUPSPOT', [222, 96, 64]],
    ['SAT', [230, 204, 146]], ['RING', [198, 178, 138]], ['URANUS', [150, 224, 232]],
    ['NEPTUNE', [76, 112, 248]], ['PLUTO', [206, 180, 156]], ['FLASH', [255, 255, 255]],
    ['EMBER', [255, 124, 58]], ['BLUE', [132, 170, 255]], ['ORBIT', [150, 150, 182]],
    ['ACCENT', [255, 214, 120]], ['ICE', [236, 244, 255]],
  ];
  const T = {};
  TINT_LIST.forEach(([k], i) => (T[k] = i));
  const RAMPS = [' .,:;-~=+*oxX#%@', " `':;~-=+*aoO8&@"];
  const FONT = '"JetBrains Mono", "Courier New", monospace';

  // ---------------------------------------------------------------- bodies
  const SUN_BODY = { ...DATA.sun, tintRGB: [255, 214, 100] };
  const PLANETS = DATA.planets.map(p => ({
    ...p,
    w: 0.07 / Math.pow(p.f, 1.5),
    spin: 0.25 + p.size * 6,
    tintId: T[p.tint],
    tintRGB: TINT_LIST[T[p.tint]][1],
  }));
  const BODIES = [SUN_BODY, ...PLANETS];

  // ---------------------------------------------------------------- grid
  let W = 0, H = 0, DPR = 1, cw = 7, ch = 13, cols = 0, rows = 0, N = 0, fontPx = 11;
  let lum, str, tnt, variant, bgLayer;
  let atlas = null, tileW = 0, tileH = 0;
  let stars = [];
  const L = {};

  function addL(k, v, t) {
    lum[k] += v;
    if (v > str[k]) { str[k] = v; tnt[k] = t; }
  }
  function setL(k, v, t) { lum[k] = v; str[k] = v; tnt[k] = t; }
  function maxL(k, v, t) { if (v > lum[k]) { lum[k] = v; str[k] = v; tnt[k] = t; } }
  function cellAt(x, y) {
    const i = (x / cw) | 0, j = (y / ch) | 0;
    if (x < 0 || y < 0 || i >= cols || j >= rows) return -1;
    return j * cols + i;
  }
  function addPoint(x, y, v, t) {
    const k = cellAt(x, y);
    if (k >= 0) addL(k, v, t);
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    cols = clamp(Math.round(W / 6.8), 60, 250);
    cw = W / cols; ch = cw * 1.8;
    rows = Math.ceil(H / ch); N = cols * rows;
    fontPx = cw * 1.66;
    lum = new Float32Array(N); str = new Float32Array(N); tnt = new Uint8Array(N);
    variant = new Uint8Array(N);
    for (let j = 0, k = 0; j < rows; j++) for (let i = 0; i < cols; i++, k++) variant[k] = hash2(i * 7 + 3, j * 13 + 1) > 0.55 ? 1 : 0;
    computeLayout();
    buildAtlas();
    buildBackground();
  }

  function computeLayout() {
    L.cx = W / 2; L.cy = H * 0.46;
    L.tilt = W >= H ? 0.34 : 0.6;
    L.R = Math.min(W * 0.465, (H * 0.36) / L.tilt);
    L.sunR = Math.max(L.R * 0.1, cw * 2.6);
    L.hs = Math.min(H * 0.3, W * 0.38);
  }

  function buildAtlas() {
    tileW = Math.ceil(cw * DPR); tileH = Math.ceil(ch * DPR);
    atlas = document.createElement('canvas');
    atlas.width = tileW * 32; atlas.height = tileH * TINT_LIST.length;
    const a = atlas.getContext('2d');
    a.font = `500 ${fontPx * DPR}px ${FONT}`;
    a.textAlign = 'center'; a.textBaseline = 'middle';
    TINT_LIST.forEach(([, rgb], ti) => {
      for (let l = 1; l < 16; l++) {
        const f = 0.2 + 0.8 * Math.pow(l / 15, 0.85);
        a.fillStyle = `rgb(${(rgb[0] * f) | 0},${(rgb[1] * f) | 0},${(rgb[2] * f) | 0})`;
        for (let v = 0; v < 2; v++) a.fillText(RAMPS[v][l], (v * 16 + l) * tileW + tileW / 2, ti * tileH + tileH / 2);
      }
    });
  }

  // Milky way band, a distant galaxy and the star list (static per size).
  function buildBackground() {
    bgLayer = new Float32Array(N);
    const asp = W / H;
    for (let j = 0, k = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++, k++) {
        const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
        // band from lower-left to upper-right
        const d = ((v - 0.92) + u * 0.85) / Math.hypot(1, 0.85);
        const band = Math.exp(-Math.pow(d / 0.13, 2));
        const tex = fbm(u * 9 * asp, v * 9);
        const lane = smooth(0.45, 0.7, fbm(u * 5 * asp + 20, v * 5 + 4));
        let val = band * (0.05 + 0.32 * tex * tex) * (1 - 0.7 * lane * Math.exp(-Math.pow(d / 0.04, 2)));
        // distant galaxy, top-left
        const gx = (u - 0.13) * asp, gy = v - 0.16;
        const gr = Math.hypot(gx * 0.9 + gy * 0.6, (gy * 0.9 - gx * 0.6) * 2.6);
        val += 0.42 * Math.exp(-gr * gr / 0.0016);
        bgLayer[k] = val;
      }
    }
    const rng = mulberry32(7);
    stars = [];
    const count = Math.round(N * 0.016);
    for (let n = 0; n < count; n++) {
      const i = (rng() * cols) | 0, j = (rng() * rows) | 0;
      const b = 0.12 + Math.pow(rng(), 3.2) * 0.88;
      stars.push({ i, j, k: j * cols + i, b, ph: rng() * TAU, sp: 0.6 + rng() * 2.4, big: b > 0.82 });
    }
  }

  function drawBackground(alpha, time) {
    if (alpha <= 0.003) return;
    for (let k = 0; k < N; k++) {
      const v = bgLayer[k] * alpha;
      if (v > 0.012) addL(k, v, T.DUST);
    }
    for (const s of stars) {
      const v = s.b * (0.62 + 0.38 * Math.sin(time * s.sp + s.ph)) * alpha;
      addL(s.k, v, T.STAR);
      if (s.big) {
        const side = v * 0.32;
        if (s.i > 0) addL(s.k - 1, side, T.STAR);
        if (s.i < cols - 1) addL(s.k + 1, side, T.STAR);
        if (s.j > 0) addL(s.k - cols, side * 0.7, T.STAR);
        if (s.j < rows - 1) addL(s.k + cols, side * 0.7, T.STAR);
      }
    }
  }

  // ---------------------------------------------------------------- the hand
  // Hand space: palm centre at origin, fingers pointing up (-y), palm toward
  // the viewer, +z toward the viewer. Each finger is three tapered capsules.
  const FINGERS = [
    { bx: -0.34, by: -0.42, len: [0.40, 0.25, 0.19], r: 0.105, spread: -0.2 },
    { bx: -0.11, by: -0.5, len: [0.45, 0.29, 0.21], r: 0.11, spread: -0.05 },
    { bx: 0.12, by: -0.48, len: [0.42, 0.27, 0.2], r: 0.105, spread: 0.09 },
    { bx: 0.33, by: -0.38, len: [0.32, 0.21, 0.17], r: 0.09, spread: 0.26 },
  ];
  const ORB = { x: 0, y: -0.2, z: 0.18 };
  const segs = [];

  function buildHand(c) {
    segs.length = 0;
    segs.push({ ax: 0.02, ay: 0.35, bx: 0.14, by: 3.8, r0: 0.33, r1: 0.42, z: -0.4 });
    for (const f of FINGERS) {
      const s = f.spread * (1 - 0.75 * c);
      const dx = Math.sin(s), dy = -Math.cos(s);
      const th = [1.55 * c, 1.7 * c, 1.15 * c];
      let x = f.bx, y = f.by, phi = 0, z = 0;
      for (let k = 0; k < 3; k++) {
        phi += th[k];
        const len = f.len[k];
        const p = len * Math.cos(phi), zz = len * Math.sin(phi);
        const nx = x + dx * p, ny = y + dy * p;
        segs.push({ ax: x, ay: y, bx: nx, by: ny, r0: f.r * (1 - 0.1 * k), r1: f.r * (1 - 0.1 * (k + 1)), z: z + zz * 0.5 + 0.02 * k });
        x = nx; y = ny; z += zz;
      }
    }
    const ct = smooth(0.25, 1, c);
    let ang = lerp(-0.95, 0.95, ct);
    let x = -0.4, y = 0.12;
    const zt = 0.04 + ct * 0.62;
    const TL = [0.3, 0.24, 0.19], TR = [0.135, 0.12, 0.105];
    for (let k = 0; k < 3; k++) {
      const len = TL[k] * (1 - 0.15 * ct);
      const nx = x + Math.sin(ang) * len, ny = y - Math.cos(ang) * len;
      segs.push({ ax: x, ay: y, bx: nx, by: ny, r0: TR[k], r1: TR[k] * 0.92, z: zt + k * 0.01 });
      x = nx; y = ny;
      ang += 0.25 + ct * 0.35;
    }
  }

  function sdRoundBox(x, y, hx, hy, r) {
    const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }

  // Curl of the fingers over time: relaxed, open, breathing, then a fist.
  function curlAt(t) {
    const breath = t < 5.1 ? 0 : 0.05 * (0.5 - 0.5 * Math.cos((t - 5.1) * 2.2));
    if (t < 3.6) return 0.62;
    if (t < 5.1) return lerp(0.62, 0, easeInOut((t - 3.6) / 1.5));
    if (t < 7.0) return breath;
    return lerp(breath, 1, Math.pow(smooth(7.0, 8.3, t), 1.3));
  }

  // Where the hand sits on screen and how bright its light is at time t.
  function handState(t) {
    const rise = easeOut3(smooth(0.6, 3.9, t));
    const rot = -0.1 + Math.sin(t * 0.7) * 0.025;
    const grow = easeOut3(smooth(3.9, 5.8, t));
    const leak = smooth(7.7, 9.0, t);
    const implode = smooth(9.0, 9.32, t);
    const tremble = smooth(8.2, 9.1, t) * (1 - implode) * L.hs * 0.012;
    // Place the palm so the orb lands on the bang point.
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const ox = L.cx + Math.sin(t * 61) * tremble;
    const oy = L.cy + Math.sin(t * 1.3) * L.hs * 0.02 * (1 - leak) + (1 - rise) * H * 1.05 + Math.cos(t * 53) * tremble;
    const hx = ox - (cr * ORB.x - sr * ORB.y) * L.hs;
    const hy = oy - (sr * ORB.x + cr * ORB.y) * L.hs;
    return {
      hx, hy, ox, oy, rot, c: curlAt(t), grow, leak, implode,
      orbI: grow * (0.85 + 0.15 * Math.sin(t * 7.3)) * (1 - implode),
    };
  }

  function drawHand(t, hs) {
    buildHand(hs.c);
    const s = L.hs, cr = Math.cos(hs.rot), sr = Math.sin(hs.rot);
    const orbR = 0.16 * hs.grow;
    const dim = 1 - hs.implode * 0.94;
    const grainF = Math.floor(t * 14);
    // Screen bbox of the hand's local bounds.
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [lx, ly] of [[-1.1, -1.9], [1.05, -1.9], [-1.1, 4], [1.05, 4]]) {
      const X = hs.hx + (cr * lx - sr * ly) * s, Y = hs.hy + (sr * lx + cr * ly) * s;
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
    const i0 = clamp((x0 / cw) | 0, 0, cols - 1), i1 = clamp((x1 / cw) | 0, 0, cols - 1);
    const j0 = clamp((y0 / ch) | 0, 0, rows - 1), j1 = clamp((y1 / ch) | 0, 0, rows - 1);
    if (y0 > H) return;

    for (let j = j0; j <= j1; j++) {
      const py = (j + 0.5) * ch;
      for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * cw;
        const dx = (px - hs.hx) / s, dy = (py - hs.hy) / s;
        const lx = cr * dx + sr * dy, ly = -sr * dx + cr * dy;
        if (lx < -1.1 || lx > 1.05 || ly < -1.9 || ly > 4) continue;
        let bz = -9, bv = 0, hit = false, isOrb = false;

        // palm, with a thenar bulge under the thumb
        const sd = Math.min(sdRoundBox(lx, ly, 0.47, 0.5, 0.24), Math.hypot(lx + 0.3, ly - 0.22) - 0.26);
        if (sd < 0) {
          bz = 0; hit = true;
          bv = 0.26 + 0.36 * clamp(-sd / 0.16, 0, 1) - (ly > 0.2 ? (ly - 0.2) * 0.15 : 0);
          // palm creases
          const c1 = Math.abs(Math.hypot(lx - 0.55, ly + 0.75) - 0.98);
          const c2 = Math.abs(Math.hypot(lx + 0.75, ly + 0.15) - 0.62);
          if ((c1 < 0.014 && ly > -0.35) || (c2 < 0.013 && lx > -0.3)) bv *= 0.5;
          if (sd > -0.035) bv *= 0.3;
        }
        for (let n = 0; n < segs.length; n++) {
          const g = segs[n];
          if (g.z <= bz) continue;
          const vx = g.bx - g.ax, vy = g.by - g.ay;
          const l2 = vx * vx + vy * vy;
          const h = l2 > 1e-6 ? clamp(((lx - g.ax) * vx + (ly - g.ay) * vy) / l2, 0, 1) : 0;
          const ex = lx - g.ax - vx * h, ey = ly - g.ay - vy * h;
          const d = Math.sqrt(ex * ex + ey * ey);
          const r = g.r0 + (g.r1 - g.r0) * h;
          if (d < r) {
            const q = d / r;
            bv = 0.2 + 0.5 * Math.sqrt(1 - q * q) + 0.18 * clamp(g.z, 0, 1);
            if (q > 0.8) bv *= 0.32;
            bz = g.z; hit = true;
          }
        }
        if (orbR > 0 && ORB.z > bz) {
          const od = Math.hypot(lx - ORB.x, ly - ORB.y);
          if (od < orbR) {
            const q = od / orbR;
            bv = 0.82 + 0.18 * Math.sqrt(1 - q * q);
            isOrb = true; hit = true;
          } else if (hit && od < orbR * 1.45) {
            bv *= 0.15; // shadowed ring so the spark reads against the palm
          }
        }
        if (!hit) continue;
        const k = j * cols + i;
        if (isOrb) { setL(k, bv * dim, T.LIGHT); continue; }
        const dO2 = (lx - ORB.x) * (lx - ORB.x) + (ly - ORB.y) * (ly - ORB.y);
        const lit = hs.orbI * 0.32 / (1 + dO2 * 18) + hs.leak * 0.55 / (1 + dO2 * 8);
        const g = hash2(i + grainF * 131, j * 3 + grainF * 17);
        if (g < 0.06) continue; // stipple
        bv = (bv + lit + (g - 0.5) * 0.2) * dim;
        setL(k, bv, lit > 0.3 ? T.LIGHT : T.HAND);
      }
    }
  }

  // Glow around the spark, light leaking out of the fist, and lens flare.
  function drawOrbLight(t, hs) {
    const I = hs.orbI, lk = hs.leak * (1 - hs.implode);
    if (I < 0.01 && lk < 0.01 && hs.implode <= 0) return;
    const s = L.hs, ox = hs.ox, oy = hs.oy;
    const i0 = clamp(((ox - s * 2.6) / cw) | 0, 0, cols - 1), i1 = clamp(((ox + s * 2.6) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((oy - s * 1.7) / ch) | 0, 0, rows - 1), j1 = clamp(((oy + s * 1.7) / ch) | 0, 0, rows - 1);
    const pointR = s * 0.35 * (1 - hs.implode) + cw * 0.5;
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - oy, ady = Math.abs(dy);
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - ox, adx = Math.abs(dx);
        const d = Math.sqrt(dx * dx + dy * dy);
        let v = I * 0.3 / (1 + Math.pow(d / (s * 0.09), 2)) + lk * 0.75 / (1 + Math.pow(d / (s * 0.26), 2));
        if (lk > 0.01 && d > s * 0.18) {
          const a = Math.atan2(dy, dx);
          const ray = Math.pow(0.5 + 0.5 * Math.cos(a * 7 + t * 0.5 + Math.sin(a * 3 + t) * 0.6), 14)
            + 0.6 * Math.pow(0.5 + 0.5 * Math.cos(a * 11 - t * 0.35), 22);
          v += lk * ray * 0.8 * Math.exp(-d / (s * 0.9)) * smooth(s * 0.18, s * 0.45, d);
        }
        const fl = I * 0.32 + lk * 0.6;
        v += fl * Math.exp(-ady / (ch * 0.55)) * Math.exp(-adx / (s * 1.3));
        v += fl * 0.7 * Math.exp(-adx / (cw * 0.8)) * Math.exp(-ady / (s * 0.9));
        v *= 1 - hs.implode;
        if (hs.implode > 0) v += (0.5 + hs.implode * 0.6) / (1 + Math.pow(d / pointR, 2)) * hs.implode;
        if (v > 0.02) addL(j * cols + i, v, T.LIGHT);
      }
    }
  }

  // Motes of light spiralling into the spark while the hand is open.
  const MOTES = (() => {
    const rng = mulberry32(99), m = [];
    for (let n = 0; n < 240; n++) {
      m.push({ r0: 0.9 + rng() * 1.9, a0: rng() * TAU, t0: 4.6 + rng() * 3.4, dur: 1.3 + rng() * 1.5, spin: 2 + rng() * 3, b: 0.22 + rng() * 0.32 });
    }
    return m;
  })();

  function drawMotes(t, hs) {
    for (const m of MOTES) {
      const p = (t - m.t0) / m.dur;
      if (p < 0 || p > 1) continue;
      const e = p * p, r = m.r0 * L.hs * (1 - e), a = m.a0 + e * m.spin;
      addPoint(hs.ox + Math.cos(a) * r, hs.oy + Math.sin(a) * r * 0.8, Math.sin(p * Math.PI) * m.b, p > 0.6 ? T.LIGHT : T.ICE);
    }
  }

  // ---------------------------------------------------------------- big bang
  const PART = (() => {
    const rng = mulberry32(1337);
    const n = 2800;
    const weights = PLANETS.map(p => Math.pow(p.size, 0.55));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const P = {
      n, dx: new Float32Array(n), dy: new Float32Array(n), spd: new Float32Array(n),
      a0: new Float32Array(n), dur: new Float32Array(n), group: new Int8Array(n),
      jx: new Float32Array(n), jy: new Float32Array(n), bf: new Float32Array(n), ba: new Float32Array(n),
      bb: new Float32Array(n), hot: new Uint8Array(n), turns: new Uint8Array(n),
    };
    for (let i = 0; i < n; i++) {
      const u = rng();
      let g;
      if (u < 0.3) g = -2;
      else if (u < 0.62) {
        let r = rng() * wsum; g = 0;
        while (g < PLANETS.length - 1 && r > weights[g]) { r -= weights[g]; g++; }
      } else if (u < 0.76) g = -3;
      else g = -1;
      P.group[i] = g;
      const a = rng() * TAU;
      P.dx[i] = Math.cos(a); P.dy[i] = Math.sin(a);
      P.spd[i] = g === -1 ? 1.3 + rng() * 2.4 : 0.15 + Math.pow(rng(), 0.7) * 1.15;
      if (g === -2) { P.a0[i] = 0.9 + rng() * 1.6; P.dur[i] = 1.6 + rng() * 1.6; }
      else if (g >= 0) { P.a0[i] = 1.4 + rng() * 1.9; P.dur[i] = 2.0 + rng() * 1.8; }
      else { P.a0[i] = 1.5 + rng() * 2.0; P.dur[i] = 2.0 + rng() * 2.0; }
      const jr = Math.sqrt(rng()), ja = rng() * TAU;
      P.jx[i] = Math.cos(ja) * jr; P.jy[i] = Math.sin(ja) * jr;
      P.bf[i] = 0.485 + rng() * 0.05; P.ba[i] = rng() * TAU; P.bb[i] = 0.1 + rng() * 0.22;
      const h = rng();
      P.hot[i] = h < 0.45 ? T.EMBER : h < 0.75 ? T.BLUE : T.LIGHT;
      P.turns[i] = rng() < 0.5 ? 1 : 0;
    }
    return P;
  })();

  const beltW = f => 0.07 / Math.pow(f, 1.5);
  const planetAlpha = (k, t) => smooth(TB + 4.2 + k * 0.22, TB + 6.2 + k * 0.22, t);
  const sunAlpha = t => smooth(TB + 2.6, TB + 5.2, t);
  function wrap0(a) { a %= TAU; return a < 0 ? a + TAU : a; }

  function drawParticles(t, oc) {
    const tau = t - TB;
    const P = PART, K = 1.7;
    const e = (1 - Math.exp(-K * tau)) / K;
    const heat = Math.exp(-tau * 1.1);
    const sA = sunAlpha(t);
    const pas = PLANETS.map((p, k) => planetAlpha(k, t));
    const R = L.R, tilt = L.tilt;
    for (let i = 0; i < P.n; i++) {
      const g = P.group[i];
      const ex = P.dx[i] * P.spd[i] * e * R, ey = P.dy[i] * P.spd[i] * e * R * 0.85;
      if (g === -1) {
        const v = 1.1 * Math.exp(-tau * 0.75);
        if (v > 0.03) addPoint(L.cx + ex, L.cy + ey, v, tau < 0.5 ? T.FLASH : P.hot[i]);
        continue;
      }
      const w = smooth(P.a0[i], P.a0[i] + P.dur[i], tau);
      let tx, tz, angNow, angStart, tint, v = 0.35 + 0.65 * heat;
      if (g === -2) {
        tx = P.jx[i] * L.sunR * 0.55; tz = P.jy[i] * L.sunR * 0.55 / tilt;
        angNow = angStart = Math.atan2(tz, tx);
        tint = T.SUN;
        v *= 1 - sA * smooth(0.9, 1, w);
      } else if (g === -3) {
        const f = P.bf[i], om = beltW(f);
        angNow = P.ba[i] + oc * om; angStart = P.ba[i] + om * (TB + P.a0[i]);
        tx = Math.cos(angNow) * R * f; tz = Math.sin(angNow) * R * f;
        tint = T.DUST;
        v = lerp(v, P.bb[i], w);
      } else {
        const p = PLANETS[g];
        angNow = p.phase + oc * p.w; angStart = p.phase + p.w * (TB + P.a0[i]);
        const spread = Math.max(L.R * p.size, cw) * 3 * (1 - w);
        tx = Math.cos(angNow) * R * p.f + P.jx[i] * spread;
        tz = Math.sin(angNow) * R * p.f + P.jy[i] * spread / tilt;
        tint = p.tintId;
        v *= 1 - pas[g] * smooth(0.9, 1, w);
      }
      if (v < 0.03) continue;
      // Spiral from the explosion position into the target, in disk coordinates.
      const ez = ey / tilt;
      const rE = Math.hypot(ex, ez), thE = Math.atan2(ez, ex);
      const rT = Math.hypot(tx, tz);
      const dth = wrap0(angStart - thE) + TAU * P.turns[i] + (angNow - angStart);
      const th = g === -2 ? thE + w * (wrap0(angStart - thE)) : thE + w * dth;
      const r = lerp(rE, rT, w);
      const x = L.cx + Math.cos(th) * r, y = L.cy + Math.sin(th) * r * tilt;
      const tn = tau < 0.45 ? T.FLASH : w > 0.55 ? tint : P.hot[i];
      if (g === -3 && w > 0.9) {
        // settled asteroids should not pile up into bright clumps
        const k = cellAt(x, y);
        if (k >= 0) maxL(k, v, tn);
      } else addPoint(x, y, v, tn);
    }
  }

  function drawShockwaves(t) {
    const tau = t - TB;
    if (tau > 3.5) return;
    const rings = [
      { r: L.R * 1.9 * (1 - Math.exp(-tau * 1.5)), v: 0.95 * Math.exp(-tau * 1.3), sy: 0.92, tint: tau < 0.6 ? T.FLASH : T.BLUE },
      { r: L.R * 1.35 * (1 - Math.exp(-tau * 0.9)), v: 0.6 * Math.exp(-tau * 0.85), sy: L.tilt, tint: T.EMBER },
    ];
    for (const ring of rings) {
      if (ring.v < 0.03 || ring.r < 2) continue;
      const th = cw * 1.2 + ring.r * 0.05;
      const n = Math.ceil((TAU * ring.r) / (cw * 0.8));
      for (let s = 0; s < n; s++) {
        const a = (s / n) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const flick = 0.65 + 0.35 * vnoise(a * 6 + 3, tau * 3);
        for (let q = -2; q <= 2; q++) {
          const rr = ring.r + q * th * 0.25;
          addPoint(L.cx + ca * rr, L.cy + sa * rr * ring.sy, ring.v * Math.exp(-q * q * 0.5) * flick, ring.tint);
        }
      }
    }
  }

  function drawFlash(t) {
    const tau = t - TB;
    const f = tau < 0.06 ? 1 : Math.exp(-(tau - 0.06) * 2.6);
    const core = Math.exp(-tau * 0.8) * (1 - sunAlpha(t));
    if (f < 0.015 && core < 0.02) return;
    const span = 0.6 * Math.max(W, H);
    for (let j = 0, k = 0; j < rows; j++) {
      const dy = (j + 0.5) * ch - L.cy;
      for (let i = 0; i < cols; i++, k++) {
        const dx = (i + 0.5) * cw - L.cx;
        const dp = Math.sqrt(dx * dx + dy * dy);
        let v = f > 0.015 ? f * (1.15 - 0.85 * Math.min(1, dp / span)) : 0;
        v += core * 0.95 / (1 + Math.pow(dp / (L.sunR * 1.3), 2));
        if (v > 0.03) addL(k, v, tau > 1.4 ? T.SUN : T.FLASH);
      }
    }
  }

  // ---------------------------------------------------------------- solar system
  function planetPos(p, oc) {
    const a = p.phase + oc * p.w;
    const X = L.R * p.f * Math.cos(a), Z = L.R * p.f * Math.sin(a);
    return { x: L.cx + X, y: L.cy + Z * L.tilt, X, Z };
  }
  function planetRadius(p) { return Math.max(L.R * p.size * 1.3, cw * 1.05); }

  function drawOrbits(alpha, selKey) {
    if (alpha <= 0.01) return;
    for (const p of PLANETS) {
      const sel = p.key === selKey;
      const rr = L.R * p.f;
      const n = Math.ceil((TAU * rr) / (cw * 1.1));
      for (let s = 0; s < n; s++) {
        const a = (s / n) * TAU;
        const k = cellAt(L.cx + Math.cos(a) * rr, L.cy + Math.sin(a) * rr * L.tilt);
        if (k < 0) continue;
        const v = alpha * (sel ? 0.45 : 0.26) * (s % 2 ? 1 : 0.6);
        maxL(k, v, sel ? T.ACCENT : T.ORBIT);
      }
    }
  }

  function drawSun(time, alpha) {
    if (alpha <= 0.005) return;
    const R = L.sunR * (0.35 + 0.65 * easeOut3(alpha));
    const G = R * 3.4;
    const i0 = clamp(((L.cx - G) / cw) | 0, 0, cols - 1), i1 = clamp(((L.cx + G) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((L.cy - G) / ch) | 0, 0, rows - 1), j1 = clamp(((L.cy + G) / ch) | 0, 0, rows - 1);
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - L.cy;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - L.cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        const k = j * cols + i;
        if (d < R) {
          const q = d / R, nz = Math.sqrt(1 - q * q);
          const gx = dx / R, gy = dy / R;
          const g = fbm(gx * 2.6 + time * 0.12, gy * 2.6 - time * 0.09) * 0.6 + fbm(gx * 5.5 - time * 0.2, gy * 5.5 + time * 0.15) * 0.4;
          const v = ((0.78 + 0.55 * (g - 0.45)) * (0.6 + 0.4 * nz) + 0.22) * alpha;
          setL(k, v, q > 0.86 || g < 0.36 ? T.SUN2 : T.SUN);
        } else {
          const e = d / R - 1;
          const ca = dx / d, sa = dy / d;
          const rays = 0.5 + 0.5 * fbm(ca * 2.2 + time * 0.05 + 11, sa * 2.2 - e * 1.4 + time * 0.25);
          const v = alpha * (0.6 * Math.exp(-e * 4.2) * rays + 0.13 * Math.exp(-e * 1.9));
          if (v > 0.03) addL(k, v, e < 0.2 ? T.SUN2 : T.CORONA);
        }
      }
    }
  }

  function drawPlanet(p, pos, r, alpha, time) {
    if (alpha <= 0.005) return;
    const len = Math.hypot(pos.X, pos.Z) || 1;
    const sb = L.tilt, cb = Math.sqrt(1 - sb * sb);
    let lx = -pos.X / len, ly = -(pos.Z / len) * sb, lz = -(pos.Z / len) * cb + 0.35;
    const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
    const ringed = p.key === 'saturn';
    const ext = r * (ringed ? 2.35 : 1.05);
    const i0 = clamp(((pos.x - ext) / cw) | 0, 0, cols - 1), i1 = clamp(((pos.x + ext) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((pos.y - ext) / ch) | 0, 0, rows - 1), j1 = clamp(((pos.y + ext) / ch) | 0, 0, rows - 1);
    const rt = -0.18, crt = Math.cos(rt), srt = Math.sin(rt);
    // Small planets get a softer minimum so their dark side still reads.
    const amb = r < cw * 1.6 ? 0.34 : 0.16;
    for (let j = j0; j <= j1; j++) {
      const dy = ((j + 0.5) * ch - pos.y) / r;
      for (let i = i0; i <= i1; i++) {
        const dx = ((i + 0.5) * cw - pos.x) / r;
        const d2 = dx * dx + dy * dy;
        const k = j * cols + i;
        let ringV = -1, ringFront = false;
        if (ringed) {
          const rx = dx * crt + dy * srt, ry = -dx * srt + dy * crt;
          const q = Math.hypot(rx, ry / 0.3);
          if (q > 1.32 && q < 2.25 && !(q > 1.78 && q < 1.88)) {
            ringV = (0.42 + 0.18 * Math.sin(q * 22)) * alpha;
            ringFront = ry > 0;
          }
        }
        if (ringV > 0 && (ringFront || d2 >= 1)) { setL(k, ringV, T.RING); continue; }
        if (d2 >= 1) continue;
        const nz = Math.sqrt(1 - d2);
        let sh = dx * lx + dy * ly + nz * lz;
        sh = sh > 0 ? sh : 0;
        let v = amb + (1 - amb) * Math.pow(sh, 0.75);
        let tint = p.tintId;
        const lon = Math.atan2(dx, nz) + time * p.spin, lat = dy;
        switch (p.key) {
          case 'earth': {
            if (fbm(lon * 1.3 + 3, lat * 2.2 + 1) > 0.56) tint = T.LAND;
            if (fbm(lon * 2.1 - time * 0.05, lat * 3.1 + 7) > 0.66) { tint = T.STAR; v *= 1.08; }
            if (Math.abs(lat) > 0.86) tint = T.ICE;
            break;
          }
          case 'jupiter': {
            const b = Math.sin(lat * 11 + (fbm(lon * 1.5, lat * 4) - 0.5) * 3);
            tint = b > 0.15 ? T.JUP2 : T.JUP;
            v *= 0.85 + 0.15 * b;
            const sl = ((lon % TAU) + TAU) % TAU - 1.2;
            if ((lat - 0.32) * (lat - 0.32) / 0.012 + sl * sl / 0.08 < 1) tint = T.JUPSPOT;
            break;
          }
          case 'saturn': {
            const b = Math.sin(lat * 9 + fbm(lon, lat * 3) * 1.5);
            tint = b > 0.45 ? T.JUP2 : T.SAT;
            break;
          }
          case 'mars': {
            v *= 0.8 + 0.3 * fbm(lon * 1.8, lat * 2.4);
            if (Math.abs(lat) > 0.86) tint = T.ICE;
            break;
          }
          case 'venus': v *= 0.85 + 0.25 * fbm(lon * 1.2 + time * 0.03, lat * 5); break;
          case 'pluto': if (fbm(lon * 1.6 + 2, lat * 1.6) > 0.62) tint = T.ICE; break;
          default: v *= 0.82 + 0.3 * fbm(lon * 2 + 4, lat * 3);
        }
        setL(k, v * alpha, tint);
      }
    }
  }

  function drawMeteor(t) {
    const start = T_LIVE + 4, period = 13;
    if (t < start) return;
    const n = Math.floor((t - start) / period), m = (t - start) % period;
    if (m > 1.1) return;
    const rng = mulberry32(500 + n);
    const x0 = W * (0.2 + rng() * 0.7), y0 = H * (0.04 + rng() * 0.22);
    const ang = Math.PI * (0.78 + rng() * 0.12), sp = W * 0.55;
    const p = m / 1.1;
    for (let s = 0; s < 18; s++) {
      const q = p - s * 0.012;
      if (q < 0) break;
      const v = (1 - s / 18) * Math.sin(p * Math.PI) * 0.9;
      addPoint(x0 + Math.cos(ang) * sp * q, y0 + Math.sin(ang) * sp * q * 0.5, v, s < 3 ? T.ICE : T.BLUE);
    }
  }

  // ---------------------------------------------------------------- frame
  let mode = 'intro';            // intro | play
  let t = 0, oc = 0, idle = 0;
  let orbitSpeed = 1;
  let selected = -1, hovered = -1;
  let live = false;
  let hits = [];

  function render() {
    lum.fill(0); str.fill(0);
    hits = [];
    const time = mode === 'intro' ? idle : t;

    if (mode === 'intro') {
      drawBackground(0.55, idle);
    } else if (t < TB) {
      drawBackground(lerp(0.55, 0.04, smooth(0, 2.4, t)) * (1 - smooth(9.0, 9.3, t)), t);
      const hs = handState(t);
      drawMotes(t, hs);
      drawHand(t, hs);
      drawOrbLight(t, hs);
    } else {
      drawBackground(0.04 + 0.96 * smooth(TB + 1, TB + 5.5, t), t);
      const selKey = selected > 0 ? PLANETS[selected - 1].key : null;
      drawOrbits(smooth(TB + 5.5, TB + 8, t), selKey);
      const placed = PLANETS.map((p, k) => ({ p, k, pos: planetPos(p, oc), r: planetRadius(p) * (0.2 + 0.8 * planetAlpha(k, t)), a: planetAlpha(k, t) }));
      placed.sort((a, b) => a.pos.Z - b.pos.Z);
      const sA = sunAlpha(t);
      let sunDrawn = false;
      for (const pl of placed) {
        if (!sunDrawn && pl.pos.Z >= 0) { drawSun(time, sA); sunDrawn = true; }
        drawPlanet(pl.p, pl.pos, pl.r, pl.a, time);
        hits.push({ body: pl.k + 1, x: pl.pos.x, y: pl.pos.y, r: pl.r * (pl.p.key === 'saturn' ? 1.9 : 1), z: pl.pos.Z });
      }
      if (!sunDrawn) drawSun(time, sA);
      hits.push({ body: 0, x: L.cx, y: L.cy, r: L.sunR, z: -1e9 });
      drawParticles(t, oc);
      drawShockwaves(t);
      drawFlash(t);
      drawMeteor(t);
    }
    present();
  }

  function present() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let j = 0, k = 0; j < rows; j++) {
      const y = Math.round(j * ch * DPR);
      for (let i = 0; i < cols; i++, k++) {
        const v = lum[k];
        if (v < 0.04) continue;
        const lv = v >= 1 ? 15 : 1 + ((v * 14.99) | 0);
        ctx.drawImage(atlas, (variant[k] * 16 + lv) * tileW, tnt[k] * tileH, tileW, tileH, Math.round(i * cw * DPR), y, tileW, tileH);
      }
    }
  }

  // DOM layers that ride on the same timeline.
  let lastCaption = '';
  function updateOverlay() {
    // captions
    let text = '', op = 0;
    if (mode === 'play') {
      for (const [a, b, s] of CAPTIONS) {
        if (t >= a && t <= b) { text = s; op = smooth(a, a + 0.7, t) * (1 - smooth(b - 0.7, b, t)); }
      }
    }
    if (text !== lastCaption) { ui.caption.textContent = text; lastCaption = text; }
    ui.caption.style.opacity = op.toFixed(3);

    // white-out flash
    let fo = 0;
    if (mode === 'play') {
      const tau = t - TB;
      if (tau >= -0.04 && tau < 0) fo = (tau + 0.04) / 0.04;
      else if (tau >= 0 && tau < 0.14) fo = 1;
      else if (tau >= 0.14) fo = Math.exp(-(tau - 0.14) * 3.0);
      if (REDUCED) fo *= 0.5;
    }
    ui.flash.style.opacity = fo > 0.002 ? fo.toFixed(3) : '0';

    // camera shake
    let amp = 0;
    if (mode === 'play' && !REDUCED) {
      if (t < TB) amp = smooth(8.3, 9.0, t) * 4 * (1 - smooth(9.0, 9.3, t));
      else amp = 16 * Math.exp(-(t - TB) * 2.5);
    }
    if (amp > 0.2) {
      const sx = amp * (Math.sin(t * 83.1) + Math.sin(t * 47.3) * 0.6) / 1.6;
      const sy = amp * (Math.cos(t * 71.7) + Math.sin(t * 39.1) * 0.6) / 1.6;
      canvas.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    } else if (canvas.style.transform) canvas.style.transform = '';

    // controls
    const nowLive = mode === 'play' && t >= T_LIVE;
    if (nowLive !== live) {
      live = nowLive;
      document.body.classList.toggle('live', live);
      if (!live) { select(-1); setHover(-1); }
    }
    document.body.classList.toggle('playing', mode === 'play' && !live);

    // reticle on the selected body
    if (selected >= 0 && live) {
      const h = hits.find(x => x.body === selected);
      if (h) {
        const size = Math.max(h.r * 2.8, 34);
        ui.reticle.style.transform = `translate(${(h.x - size / 2).toFixed(1)}px, ${(h.y - size / 2).toFixed(1)}px)`;
        ui.reticle.style.width = ui.reticle.style.height = size + 'px';
      }
    }
    if (hovered >= 0 && hovered !== selected && live) {
      const h = hits.find(x => x.body === hovered);
      if (h) ui.hover.style.transform = `translate(${(h.x + Math.max(h.r, 8) + 10).toFixed(1)}px, ${(h.y - 8).toFixed(1)}px)`;
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    idle += dt;
    if (mode === 'play') {
      t += dt;
      if (t < T_LIVE) oc = t;
      else {
        const target = selected >= 0 ? 0.22 : 1;
        orbitSpeed += (target - orbitSpeed) * Math.min(1, dt * 2.5);
        oc += dt * orbitSpeed;
      }
    }
    render();
    updateOverlay();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- interaction
  function begin() {
    if (mode === 'play') return;
    mode = 'play';
    t = 0; oc = 0; orbitSpeed = 1;
    ui.intro.classList.add('gone');
    if (!AUDIO.muted) AUDIO.start(TB);
  }

  function replay() {
    select(-1); setHover(-1);
    t = 0; oc = 0; orbitSpeed = 1;
    if (!AUDIO.muted) AUDIO.start(TB);
  }

  function skip() {
    if (mode !== 'play' || t >= T_LIVE) return;
    t = T_LIVE; oc = T_LIVE;
    if (!AUDIO.muted) AUDIO.skip();
  }

  function hitTest(x, y) {
    let best = -1, bestZ = -Infinity;
    for (const h of hits) {
      const pad = Math.max(h.r * 1.35, 14);
      if (Math.hypot(x - h.x, y - h.y) < pad && h.z > bestZ) { best = h.body; bestZ = h.z; }
    }
    return best;
  }

  function setHover(b) {
    if (b === hovered) return;
    hovered = b;
    canvas.style.cursor = b >= 0 ? 'pointer' : '';
    if (b >= 0 && b !== selected) {
      ui.hover.textContent = BODIES[b].name;
      ui.hover.classList.add('on');
    } else ui.hover.classList.remove('on');
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function select(b) {
    selected = b;
    if (b < 0) {
      ui.info.classList.remove('open');
      ui.reticle.classList.remove('on');
      ui.info.setAttribute('aria-hidden', 'true');
      return;
    }
    const d = BODIES[b];
    const [r, g, bl] = d.tintRGB;
    ui.info.style.setProperty('--body', `rgb(${r}, ${g}, ${bl})`);
    ui.reticle.style.setProperty('--body', `rgb(${r}, ${g}, ${bl})`);
    ui.reticleLabel.textContent = d.name;
    const body = ui.info.querySelector('.info-body');
    body.replaceChildren();
    body.append(
      el('p', 'kicker', b === 0 ? 'the star · centre of the system' : `world ${b} of 9 · ${d.kind}`),
      el('h2', 'name', d.name),
    );
    if (b === 0) body.append(el('p', 'kind', d.kind));
    const dl = el('dl', 'stats');
    d.stats.forEach(([k, v], i) => {
      const row = el('div', 'stat');
      row.style.animationDelay = `${0.15 + i * 0.07}s`;
      row.append(el('dt', null, k), el('dd', null, v));
      dl.append(row);
    });
    const ul = el('ul', 'facts');
    d.facts.forEach((f, i) => {
      const li = el('li', null, f);
      li.style.animationDelay = `${0.45 + i * 0.1}s`;
      ul.append(li);
    });
    body.append(dl, ul);
    ui.info.classList.remove('open');
    void ui.info.offsetWidth; // restart the reveal animation
    ui.info.classList.add('open');
    ui.info.setAttribute('aria-hidden', 'false');
    ui.reticle.classList.add('on');
    if (hovered === b) ui.hover.classList.remove('on');
    AUDIO.blip(1 + b * 0.06);
  }

  canvas.addEventListener('pointermove', e => {
    if (!live) return;
    setHover(hitTest(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointerleave', () => setHover(-1));
  canvas.addEventListener('click', e => {
    if (!live) return;
    const b = hitTest(e.clientX, e.clientY);
    select(b === selected ? -1 : b);
  });
  ui.info.querySelector('.close').addEventListener('click', () => select(-1));
  ui.skip.addEventListener('click', skip);
  ui.replay.addEventListener('click', replay);
  ui.sound.addEventListener('click', () => {
    const m = !AUDIO.muted;
    AUDIO.setMuted(m);
    ui.sound.setAttribute('aria-pressed', String(!m));
    ui.sound.querySelector('span').textContent = m ? 'off' : 'on';
    // Turning sound on mid-film: start the right part of the score.
    if (!m && mode === 'play') {
      if (t < 0.5) AUDIO.start(TB);
      else if (t > TB + 2) AUDIO.skip();
    }
  });

  // Entering: scroll, swipe, click, or a key.
  ui.begin.addEventListener('click', begin);
  ui.intro.addEventListener('click', begin);
  window.addEventListener('wheel', e => { if (mode === 'intro' && e.deltaY > 0) begin(); }, { passive: true });
  let touchY = null;
  window.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (mode === 'intro' && touchY != null && touchY - e.touches[0].clientY > 30) begin();
  }, { passive: true });
  window.addEventListener('keydown', e => {
    if (mode === 'intro' && ['Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); begin(); return; }
    if (e.key === 'Escape') select(-1);
    if (!live) return;
    if (e.key === 'ArrowRight') select((selected + 1 + BODIES.length) % BODIES.length);
    if (e.key === 'ArrowLeft') select((selected - 1 + BODIES.length) % BODIES.length);
    if (e.key === 'r' || e.key === 'R') replay();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) AUDIO.suspend();
    else { AUDIO.resume(); last = performance.now(); }
  });

  // Type out the question on the intro screen.
  function typeQuestion() {
    const full = ui.question.dataset.text;
    let n = 0;
    ui.question.textContent = '';
    const tick = () => {
      n++;
      ui.question.textContent = full.slice(0, n);
      if (n < full.length) setTimeout(tick, full[n - 1] === ' ' ? 90 : 55 + Math.random() * 50);
      else ui.intro.classList.add('typed');
    };
    setTimeout(tick, 900);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  // Test hook: jump the film to a moment, e.g. __cosmos.seek(12).
  window.__cosmos = { seek(s) { if (mode !== 'play') begin(); t = s; oc = s; } };

  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildAtlas);
  typeQuestion();
  requestAnimationFrame(frame);
})();
