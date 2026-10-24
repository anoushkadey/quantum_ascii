// quantum_ascii: the big bang, the birth of the solar system, and the history
// of each world, drawn as tiny coloured ASCII characters on one canvas.
//
// Every frame the scene is "lit" into a per-cell buffer (brightness, tint,
// depth), then each cell is stamped with a glyph from a pre-rendered atlas.
// Cells are only a few pixels wide, so the characters read as fine grain.
// The film is a pure function of the timeline `t` with seeded randomness,
// so every replay is the same.
(() => {
  'use strict';

  const DATA = window.COSMOS_DATA;
  const STORIES = window.COSMOS_STORIES;
  const AUDIO = window.CosmosAudio;

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);
  const ui = {
    intro: $('intro'), question: $('question'), begin: $('begin'),
    caption: $('caption'), captionText: $('caption-text'), flash: $('flash'),
    skip: $('skip'), replay: $('replay'), sound: $('sound'),
    info: $('info'), infoName: $('info-name'), infoAge: $('info-age'), infoFact: $('info-fact'),
    infoBack: $('info-back'), infoStory: $('info-story'), hover: $('hover'), labels: $('labels'),
  };

  // ---------------------------------------------------------------- timeline
  const TB = 14.4;          // the bang
  const F0 = TB + 11;       // the solar nebula starts to collapse
  const T_LIVE = F0 + 13.5; // solar system formed, camera handed to the viewer
  const CPS = 26;           // typing speed, characters per second
  const LINES = [
    [0.8, 4.4, '13.8 billion years ago, there was no space and no time.'],
    [4.8, 8.6, 'everything that would ever exist was packed into a single point.'],
    [9.0, 12.0, 'smaller than an atom. hotter than anything since.'],
    [12.4, TB, 'then it began to expand.'],
    [TB + 2.2, TB + 6.2, 'for millions of years there was only glowing gas. then gravity lit the first stars.'],
    [TB + 6.6, TB + 10.4, 'stars gathered into galaxies. ours, the milky way, holds hundreds of billions.'],
    [TB + 10.8, F0 + 4.2, '9 billion years after the bang, in one of its arms, a cloud of gas collapsed.'],
    [F0 + 4.6, F0 + 8.6, 'the sun ignited. around it, rocks collided and stuck together.'],
    [F0 + 9, F0 + 13.2, 'they grew into worlds. this is our solar system.'],
  ];
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- math
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut3 = t => 1 - Math.pow(1 - t, 3);
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
  function hash3(x, y, z) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0;
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
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi), c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
    const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1), c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
    const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
    const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }
  function fbm3(x, y, z) {
    return noise3(x, y, z) * 0.6 + noise3(x * 2.1 + 3.1, y * 2.1 + 1.7, z * 2.1 + 5.3) * 0.4;
  }
  function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  // ---------------------------------------------------------------- palette
  const TINT_LIST = [
    ['STAR', [208, 212, 226]], ['STARB', [168, 190, 255]], ['STARY', [255, 230, 182]], ['STARR', [255, 170, 140]],
    ['DUST', [112, 118, 148]], ['LIGHT', [255, 247, 222]], ['NEB1', [196, 112, 168]], ['NEB2', [112, 140, 224]],
    ['SUN', [255, 226, 112]], ['SUN2', [255, 176, 48]], ['CORONA', [255, 124, 32]], ['EMBER', [255, 110, 50]],
    ['MERCURY', [176, 166, 156]], ['VENUS', [232, 198, 138]], ['VENUS2', [170, 120, 80]],
    ['EARTH', [62, 122, 236]], ['LAND', [92, 176, 104]], ['DESERT', [186, 150, 104]], ['ROCK', [124, 116, 108]],
    ['ICE', [236, 244, 255]], ['CITY', [255, 196, 110]], ['DUSTG', [120, 112, 104]], ['EHALO', [120, 176, 255]],
    ['MARS', [222, 104, 62]], ['MARSD', [140, 66, 44]],
    ['JUP', [214, 164, 116]], ['JUP2', [244, 222, 190]], ['JUPD', [168, 116, 82]], ['JUPSPOT', [222, 96, 64]],
    ['SAT', [230, 204, 146]], ['RING', [206, 186, 146]], ['URANUS', [150, 224, 232]],
    ['NEPTUNE', [70, 108, 246]], ['NEPD', [36, 52, 140]], ['PLUTO', [214, 186, 160]], ['PLUTOD', [124, 86, 70]],
    ['MOONG', [190, 188, 184]], ['IO', [236, 212, 104]], ['EUROPA', [226, 216, 198]], ['GANY', [170, 160, 148]],
    ['CALLISTO', [116, 108, 100]], ['TITAN', [234, 168, 76]], ['ENCEL', [242, 248, 255]], ['TRITON', [216, 196, 190]],
    ['CHARON', [170, 164, 158]], ['FLASH', [255, 255, 255]], ['BLUE', [132, 170, 255]],
    ['ORBIT', [150, 150, 182]], ['ACCENT', [235, 232, 220]],
  ];
  const T = {};
  TINT_LIST.forEach(([k], i) => (T[k] = i));
  const STAR_TINTS = [T.STAR, T.STAR, T.STARB, T.STARY, T.STARR];
  const RAMPS = [' .,:;-~=+*oxX#%@', " `':;~-=+*aoO8&@"];
  const FONT = '"JetBrains Mono", "Courier New", monospace';

  // ---------------------------------------------------------------- bodies
  const SUN = DATA.sun;
  const PLANETS = DATA.planets.map(p => ({
    ...p,
    w: 0.5 / Math.pow(p.orbit / 22, 1.5),
    spin: 0.12 + 0.5 / p.radius,
    tintId: T[p.tint],
    haloT: p.halo ? T[p.halo[0]] : 0,
    moons: p.moons.map(m => ({ ...m, tintId: T[m.tint] })),
  }));
  const BODIES = [SUN, ...PLANETS];

  function planetPos(p, oc) {
    const a = p.phase + oc * p.w;
    return [Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit];
  }
  function moonPos(p, m, c, mc, tilt) {
    const a = m.phase + mc * m.w;
    const X = Math.cos(a) * m.d, Z = Math.sin(a) * m.d;
    const ph = tilt + m.incl;
    return [c[0] + X, c[1] - Z * Math.sin(ph), c[2] + Z * Math.cos(ph)];
  }

  // Saturn's rings, by distance from the centre in planet radii.
  function satRing(q) {
    if (q < 1.24 || q > 2.27) return 0;
    let v;
    if (q < 1.53) v = 0.16;                      // C ring
    else if (q < 1.95) v = 0.56 + 0.1 * Math.sin(q * 60); // B ring
    else if (q < 2.03) v = 0.03;                 // Cassini division
    else v = 0.42 + 0.05 * Math.sin(q * 80);     // A ring
    if (q > 2.2 && q < 2.215) v = 0.02;          // Encke gap
    return v * (0.85 + 0.15 * Math.sin(q * 170));
  }
  function uraRing(q) { return (q > 1.62 && q < 1.66) || (q > 1.9 && q < 1.97) ? 0.3 : 0; }

  // ---------------------------------------------------------------- grid
  let W = 0, H = 0, DPR = 1, cw = 4, ch = 7, cols = 0, rows = 0, N = 0, fontPx = 6;
  let quality = 1;
  let lum, str, tnt, variant, zbuf;
  let atlas = null, tileW = 0, tileH = 0;
  const L = {};

  function addL(k, v, t) {
    lum[k] += v;
    if (v > str[k]) { str[k] = v; tnt[k] = t; }
  }
  function setL(k, v, t) { lum[k] = v; str[k] = v; tnt[k] = t; }
  function maxL(k, v, t) { if (v > lum[k]) { lum[k] = v; str[k] = v; tnt[k] = t; } }
  function cellAt(x, y) {
    if (x < 0 || y < 0) return -1;
    const i = (x / cw) | 0, j = (y / ch) | 0;
    if (i >= cols || j >= rows) return -1;
    return j * cols + i;
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const target = (W < 700 ? 3.1 : 3.5) * quality;
    cols = clamp(Math.round(W / target), 100, 560);
    cw = W / cols; ch = cw * 1.8;
    rows = Math.ceil(H / ch); N = cols * rows;
    fontPx = cw * 1.66;
    lum = new Float32Array(N); str = new Float32Array(N); tnt = new Uint8Array(N);
    zbuf = new Float32Array(N);
    variant = new Uint8Array(N);
    for (let j = 0, k = 0; j < rows; j++) for (let i = 0; i < cols; i++, k++) variant[k] = hash2(i * 7 + 3, j * 13 + 1) > 0.55 ? 1 : 0;
    L.cx = W / 2; L.cy = H / 2;
    L.F = 0.95 * Math.min(H * 1.15, W * 1.25);
    L.home = W < H ? 108 : 150;  // the "half universe" framing
    buildAtlas();
  }

  function buildAtlas() {
    tileW = Math.ceil(cw * DPR); tileH = Math.ceil(ch * DPR);
    atlas = document.createElement('canvas');
    atlas.width = tileW * 32; atlas.height = tileH * TINT_LIST.length;
    const a = atlas.getContext('2d');
    a.font = `700 ${fontPx * DPR}px ${FONT}`;
    a.textAlign = 'center'; a.textBaseline = 'middle';
    TINT_LIST.forEach(([, rgb], ti) => {
      for (let l = 1; l < 16; l++) {
        const f = 0.34 + 0.66 * Math.pow(l / 15, 0.7);
        a.fillStyle = `rgb(${(rgb[0] * f) | 0},${(rgb[1] * f) | 0},${(rgb[2] * f) | 0})`;
        for (let v = 0; v < 2; v++) a.fillText(RAMPS[v][l], (v * 16 + l) * tileW + tileW / 2, ti * tileH + tileH / 2);
      }
    });
  }

  // ---------------------------------------------------------------- camera
  // Orbit camera around a target point. Camera space: x right, y up, z forward.
  const cam = {
    yaw: 0.7, pitch: 0.24, dist: 380, tx: 0, ty: 0, tz: 0,
    yawT: 0.7, pitchT: 0.24, distT: 380,
    px: 0, py: 0, pz: 0, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: -1,
  };
  function setupCamera() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    cam.px = cam.tx + cam.dist * cp * Math.sin(cam.yaw);
    cam.py = cam.ty + cam.dist * sp;
    cam.pz = cam.tz + cam.dist * cp * Math.cos(cam.yaw);
    let fx = cam.tx - cam.px, fy = cam.ty - cam.py, fz = cam.tz - cam.pz;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx;
    const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    cam.fx = fx; cam.fy = fy; cam.fz = fz;
    cam.rx = rx; cam.ry = 0; cam.rz = rz;
    cam.ux = -rz * fy; cam.uy = rz * fx - rx * fz; cam.uz = rx * fy;
  }
  const V = [0, 0, 0];
  function toCam(x, y, z) {
    const dx = x - cam.px, dy = y - cam.py, dz = z - cam.pz;
    V[0] = dx * cam.rx + dy * cam.ry + dz * cam.rz;
    V[1] = dx * cam.ux + dy * cam.uy + dz * cam.uz;
    V[2] = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  }
  function camDir(x, y, z) { // world direction -> camera space, into V
    V[0] = x * cam.rx + y * cam.ry + z * cam.rz;
    V[1] = x * cam.ux + y * cam.uy + z * cam.uz;
    V[2] = x * cam.fx + y * cam.fy + z * cam.fz;
  }
  const Wv = [0, 0, 0];
  function toWorldDir(x, y, z) {
    Wv[0] = x * cam.rx + y * cam.ux + z * cam.fx;
    Wv[1] = x * cam.ry + y * cam.uy + z * cam.fy;
    Wv[2] = x * cam.rz + y * cam.uz + z * cam.fz;
  }
  function project(x, y, z) { // world -> screen; returns null behind camera
    toCam(x, y, z);
    if (V[2] < 0.3) return null;
    return [L.cx + (V[0] * L.F) / V[2], L.cy - (V[1] * L.F) / V[2], V[2]];
  }

  // Splat a world-space point, depth-tested against solid bodies.
  function splat(x, y, z, v, t, useMax) {
    toCam(x, y, z);
    const Z = V[2];
    if (Z < 0.5) return;
    const k = cellAt(L.cx + (V[0] * L.F) / Z, L.cy - (V[1] * L.F) / Z);
    if (k < 0 || Z > zbuf[k]) return;
    if (useMax) maxL(k, v, t); else addL(k, v, t);
  }

  // Soft screen-space glow around a world point.
  function glow(x, y, z, I, radPx, tint, depthTest) {
    const p = project(x, y, z);
    if (!p || I < 0.01) return;
    const ext = radPx * 4;
    const i0 = clamp(((p[0] - ext) / cw) | 0, 0, cols - 1), i1 = clamp(((p[0] + ext) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((p[1] - ext) / ch) | 0, 0, rows - 1), j1 = clamp(((p[1] + ext) / ch) | 0, 0, rows - 1);
    const r2 = radPx * radPx;
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - p[1];
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - p[0];
        const k = j * cols + i;
        if (depthTest && zbuf[k] < p[2]) continue;
        const v = I / (1 + (dx * dx + dy * dy) / r2);
        if (v > 0.03) addL(k, v, tint);
      }
    }
  }

  // ---------------------------------------------------------------- sky
  // Stars sit on the celestial sphere, so they turn with the camera.
  const SKY = (() => {
    const rng = mulberry32(7);
    const s = [];
    for (let n = 0; n < 5200; n++) {
      const z = rng() * 2 - 1, a = rng() * TAU, r = Math.sqrt(1 - z * z);
      const b = 0.1 + Math.pow(rng(), 4) * 0.9;
      s.push({ d: [Math.cos(a) * r, z, Math.sin(a) * r], b, ph: rng() * TAU, sp: 0.6 + rng() * 2.4, kind: b > 0.75 ? 2 : 1, tint: STAR_TINTS[(rng() * 5) | 0] });
    }
    // Milky way: a band around a tilted great circle.
    let nx = 0.88, ny = 0.3, nz = 0.36;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    let ax = ny, ay = -nx;
    const al = Math.hypot(ax, ay); ax /= al; ay /= al;
    const bx = -nz * ay, by = nz * ax, bz = nx * ay - ny * ax;
    for (let n = 0; n < 14000; n++) {
      const a = rng() * TAU;
      const g = (rng() + rng() + rng() - 1.5) * 0.15;
      let x = Math.cos(a) * ax + Math.sin(a) * bx + nx * g;
      let y = Math.cos(a) * ay + Math.sin(a) * by + ny * g;
      let z = Math.sin(a) * bz + nz * g;
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const clump = fbm(a * 4, g * 26 + 4);
      const lane = Math.abs(g) < 0.02 && fbm(a * 9 + 3, 1) > 0.45 ? 0.25 : 1; // dark dust lane
      s.push({ d: [x, y, z], b: (0.03 + 0.24 * clump * clump) * (1 - Math.abs(g) * 3) * lane, ph: 0, sp: 0, kind: 0, tint: rng() < 0.15 ? T.NEB1 : T.DUST });
    }
    // A distant galaxy.
    for (let n = 0; n < 700; n++) {
      const r = Math.pow(rng(), 1.6) * 0.05, a = rng() * TAU;
      const x = -0.55 + Math.cos(a) * r * 2.2, y = 0.45 + Math.sin(a) * r, z = -0.7;
      const l = Math.hypot(x, y, z);
      s.push({ d: [x / l, y / l, z / l], b: 0.36 * (1 - r / 0.05), ph: 0, sp: 0, kind: 0, tint: T.STARB });
    }
    return s;
  })();

  // `behind`: only fill cells no solid body has claimed this frame.
  function drawSky(alpha, time, behind) {
    if (alpha <= 0.003) return;
    const F = L.F;
    for (const s of SKY) {
      const [x, y, z] = s.d;
      const Z = x * cam.fx + y * cam.fy + z * cam.fz;
      if (Z < 0.08) continue;
      const X = x * cam.rx + y * cam.ry + z * cam.rz, Y = x * cam.ux + y * cam.uy + z * cam.uz;
      const k = cellAt(L.cx + (X * F) / Z, L.cy - (Y * F) / Z);
      if (k < 0 || (behind && zbuf[k] < 1e9)) continue;
      if (s.kind === 0) { maxL(k, s.b * alpha, s.tint); continue; }
      const v = s.b * (0.62 + 0.38 * Math.sin(time * s.sp + s.ph)) * alpha;
      addL(k, v, s.tint);
      if (s.kind === 2) {
        const i = k % cols, side = v * 0.3;
        if (i > 0) addL(k - 1, side, s.tint);
        if (i < cols - 1) addL(k + 1, side, s.tint);
        if (k >= cols) addL(k - cols, side * 0.6, s.tint);
        if (k + cols < N) addL(k + cols, side * 0.6, s.tint);
      }
    }
  }

  // ---------------------------------------------------------------- the point
  // Before the bang: one point of light in the dark, slowly gathering.
  const MOTES = (() => {
    const rng = mulberry32(99), m = [];
    for (let n = 0; n < 500; n++) {
      m.push({ r0: 0.2 + rng() * 0.65, a0: rng() * TAU, t0: 2.5 + rng() * (TB - 4.5), dur: 1.6 + rng() * 2.2, spin: 2 + rng() * 3, b: 0.15 + rng() * 0.35 });
    }
    return m;
  })();

  function drawSingularity(t) {
    const implode = smooth(TB - 0.4, TB - 0.06, t);
    const grow = smooth(0.3, TB - 0.6, t);
    const p = project(0, 0, 0);
    const sx = p[0], sy = p[1];
    const flick = 0.82 + 0.18 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
    const I = (0.25 + 0.75 * grow) * flick * (1 - implode * 0.85);
    const rad = (cw * 1.2 + cw * 6 * grow) * (1 - implode * 0.9);
    const ext = Math.max(W, H) * 0.5;
    const i0 = clamp(((sx - ext) / cw) | 0, 0, cols - 1), i1 = clamp(((sx + ext) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((sy - ext * 0.6) / ch) | 0, 0, rows - 1), j1 = clamp(((sy + ext * 0.6) / ch) | 0, 0, rows - 1);
    const flare = grow * (1 - implode) * 0.5;
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - sy, ady = Math.abs(dy);
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - sx, adx = Math.abs(dx);
        let v = I / (1 + (dx * dx + dy * dy) / (rad * rad));
        v += flare * Math.exp(-ady / (ch * 0.6)) * Math.exp(-adx / (ext * 0.5));
        v += flare * 0.6 * Math.exp(-adx / (cw * 0.8)) * Math.exp(-ady / (ext * 0.3));
        if (v > 0.035) addL(j * cols + i, v, T.LIGHT);
      }
    }
    const span = Math.min(W, H);
    for (const m of MOTES) {
      const q = (t - m.t0) / m.dur;
      if (q < 0 || q > 1) continue;
      const e = q * q, r = m.r0 * span * (1 - e), a = m.a0 + e * m.spin;
      const k = cellAt(sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.75);
      if (k >= 0) addL(k, Math.sin(q * Math.PI) * m.b * (1 - implode), q > 0.6 ? T.LIGHT : T.STARB);
    }
  }

  // ---------------------------------------------------------------- big bang -> galaxy
  // Matter flung out by the bang settles into a spiral galaxy; the camera then
  // dives into one of its arms.
  const GAL = (() => {
    const rng = mulberry32(1337);
    const n = 9000;
    const G = {
      n, dx: new Float32Array(n), dy: new Float32Array(n), dz: new Float32Array(n), spd: new Float32Array(n),
      rg: new Float32Array(n), th: new Float32Array(n), gy: new Float32Array(n),
      a0: new Float32Array(n), dur: new Float32Array(n), b: new Float32Array(n),
      hot: new Uint8Array(n), tint: new Uint8Array(n), turns: new Uint8Array(n), ph: new Float32Array(n),
    };
    const gauss = () => rng() + rng() + rng() - 1.5;
    for (let i = 0; i < n; i++) {
      const z = rng() * 2 - 1, a = rng() * TAU, rr = Math.sqrt(1 - z * z);
      G.dx[i] = Math.cos(a) * rr; G.dy[i] = z; G.dz[i] = Math.sin(a) * rr;
      G.spd[i] = 0.3 + Math.pow(rng(), 0.6) * 1.5;
      if (rng() < 0.22) { // bulge
        const r = Math.pow(rng(), 1.8) * 48;
        G.rg[i] = r; G.th[i] = rng() * TAU; G.gy[i] = gauss() * (1 - r / 60) * 18;
        G.tint[i] = rng() < 0.6 ? T.STARY : T.SUN2; G.b[i] = 0.35 + rng() * 0.4;
      } else { // two main arms on a log spiral
        const arm = rng() < 0.5 ? 0 : Math.PI;
        const r = 40 + Math.pow(rng(), 0.85) * 240;
        G.rg[i] = r; G.th[i] = arm + Math.log(r / 40) * 2.3 + gauss() * (0.25 + r / 900);
        G.gy[i] = gauss() * 5;
        const c = rng();
        G.tint[i] = c < 0.45 ? T.STARB : c < 0.75 ? T.STAR : c < 0.9 ? T.NEB1 : T.NEB2;
        G.b[i] = 0.18 + Math.pow(rng(), 2) * 0.6;
      }
      G.a0[i] = 2.8 + rng() * 2; G.dur[i] = 2.5 + rng() * 1.2;
      const h = rng();
      G.hot[i] = h < 0.45 ? T.EMBER : h < 0.75 ? T.BLUE : T.LIGHT;
      G.turns[i] = rng() < 0.5 ? 1 : 0;
      G.ph[i] = rng() * TAU;
    }
    return G;
  })();
  const GAL_W = 0.04;                          // galaxy rotation
  const ANCHOR_R = 150, ANCHOR_TH = Math.log(150 / 40) * 2.3; // where the sun will be
  function wrap0(a) { a %= TAU; return a < 0 ? a + TAU : a; }

  function drawGalaxy(t) {
    const tau = t - TB;
    if (tau > 13) return;
    const G = GAL, K = 1.4;
    const e = ((1 - Math.exp(-K * tau)) / K) * 120;
    const heat = Math.exp(-tau * 0.7);
    const c = smooth(TB + 8.6, TB + 11, t);
    const s = Math.exp(Math.max(0, t - (TB + 9)) * 1.05);
    const fade = 1 - smooth(TB + 10.6, TB + 12.6, t);
    const rot = tau * GAL_W;
    const Ax = Math.cos(ANCHOR_TH + rot) * ANCHOR_R * c, Az = Math.sin(ANCHOR_TH + rot) * ANCHOR_R * c;
    for (let i = 0; i < G.n; i++) {
      const ex = G.dx[i] * G.spd[i] * e, ey = G.dy[i] * G.spd[i] * e, ez = G.dz[i] * G.spd[i] * e;
      const w = smooth(G.a0[i], G.a0[i] + G.dur[i], tau);
      const thT = G.th[i] + rot;
      const rE = Math.hypot(ex, ez), thE = Math.atan2(ez, ex);
      const th = thE + w * (wrap0(thT - thE) + TAU * G.turns[i]);
      const r = lerp(rE, G.rg[i], w);
      let x = Math.cos(th) * r, y = lerp(ey, G.gy[i], w), z = Math.sin(th) * r;
      x = (x - Ax) * s; y *= s; z = (z - Az) * s;
      let v = lerp(0.35 + 0.65 * heat, G.b[i] * (0.75 + 0.25 * Math.sin(t * 2 + G.ph[i])), w) * fade;
      if (v < 0.03) continue;
      const tn = tau < 0.9 ? T.FLASH : w > 0.5 ? G.tint[i] : G.hot[i];
      splat(x, y, z, v, tn);
    }
  }

  const SHELL = (() => { // fibonacci sphere for the shockwave
    const n = 2400, pts = new Float32Array(n * 3), ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * ga;
      pts[i * 3] = Math.cos(a) * r; pts[i * 3 + 1] = y; pts[i * 3 + 2] = Math.sin(a) * r;
    }
    return pts;
  })();

  function drawShockwave(t) {
    const tau = t - TB;
    if (tau > 4) return;
    const rr = 260 * (1 - Math.exp(-tau * 1.2));
    const v = 0.9 * Math.exp(-tau * 1.0);
    const tint = tau < 0.6 ? T.FLASH : T.BLUE;
    for (let i = 0; i < SHELL.length; i += 3) {
      const fl = 0.6 + 0.4 * noise3(SHELL[i] * 4, SHELL[i + 1] * 4 + tau * 2, SHELL[i + 2] * 4);
      splat(SHELL[i] * rr, SHELL[i + 1] * rr, SHELL[i + 2] * rr, v * fl, tint);
    }
    const r2 = 190 * (1 - Math.exp(-tau * 0.8)), v2 = 0.7 * Math.exp(-tau * 0.75);
    for (let s = 0; s < 1400; s++) {
      const a = (s / 1400) * TAU;
      splat(Math.cos(a) * r2, 0, Math.sin(a) * r2, v2, T.EMBER);
    }
  }

  // Strobing white-out: bright pulses with black gaps, then a long fade.
  function strobe(t) {
    const tau = t - TB;
    if (tau < -0.04) return 0;
    if (tau < 0) return (tau + 0.04) / 0.04;
    if (REDUCED) return 0.6 * Math.exp(-tau * 2);
    const pulses = [[0, 0.13, 1], [0.21, 0.3, 1], [0.38, 0.46, 1], [0.55, 0.61, 0.9], [0.7, 0.75, 0.85], [0.85, 0.89, 0.7], [1.0, 1.03, 0.6]];
    for (const [a, b, p] of pulses) if (tau >= a && tau < b) return p;
    if (tau >= 1.03) return 0.5 * Math.exp(-(tau - 1.03) * 2.4);
    return 0;
  }

  function drawFlash(t) {
    const f = strobe(t);
    if (f < 0.015) return;
    const p = project(0, 0, 0);
    const span = 0.6 * Math.max(W, H);
    for (let j = 0, k = 0; j < rows; j++) {
      const dy = (j + 0.5) * ch - p[1];
      for (let i = 0; i < cols; i++, k++) {
        const dx = (i + 0.5) * cw - p[0];
        const v = f * (1.2 - 0.8 * Math.min(1, Math.sqrt(dx * dx + dy * dy) / span));
        if (v > 0.03) addL(k, v, T.FLASH);
      }
    }
  }

  // ---------------------------------------------------------------- solar nebula
  // A cloud of gas collapses into the sun, a disk, and the worlds.
  const NEB = (() => {
    const rng = mulberry32(4242);
    const n = 8000;
    const weights = PLANETS.map(p => Math.pow(p.radius, 0.6));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const P = {
      n, cx: new Float32Array(n), cy: new Float32Array(n), cz: new Float32Array(n),
      a0: new Float32Array(n), dur: new Float32Array(n), group: new Int8Array(n),
      jx: new Float32Array(n), jy: new Float32Array(n), jz: new Float32Array(n),
      bf: new Float32Array(n), ba: new Float32Array(n), by: new Float32Array(n), bb: new Float32Array(n),
      cloud: new Uint8Array(n), turns: new Uint8Array(n), cb: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) {
      const u = rng();
      let g;
      if (u < 0.22) g = -2;                  // sun
      else if (u < 0.5) {                    // a planet
        let r = rng() * wsum; g = 0;
        while (g < PLANETS.length - 1 && r > weights[g]) { r -= weights[g]; g++; }
      } else if (u < 0.66) g = -3;           // asteroid belt
      else if (u < 0.76) g = -4;             // kuiper belt
      else g = -1;                           // gas blown away
      P.group[i] = g;
      const z = rng() * 2 - 1, a = rng() * TAU, rr = Math.sqrt(1 - z * z), rad = 175 * Math.cbrt(rng());
      const lump = 0.7 + 0.6 * fbm(a * 2, z * 2 + 3);
      P.cx[i] = Math.cos(a) * rr * rad * lump; P.cy[i] = z * rad * 0.55; P.cz[i] = Math.sin(a) * rr * rad * lump;
      P.cb[i] = 0.12 + 0.22 * rng();
      if (g === -2) { P.a0[i] = 1.5 + rng() * 2; P.dur[i] = 2 + rng() * 1.2; }
      else if (g >= 0) { P.a0[i] = 3.5 + rng() * 2.5; P.dur[i] = 2.5 + rng() * 1.2; }
      else { P.a0[i] = 4 + rng() * 2; P.dur[i] = 2.5 + rng() * 1.5; }
      const jz = rng() * 2 - 1, ja = rng() * TAU, jr = Math.cbrt(rng());
      P.jx[i] = Math.cos(ja) * jr * Math.sqrt(1 - jz * jz); P.jy[i] = jz * jr; P.jz[i] = Math.sin(ja) * jr * Math.sqrt(1 - jz * jz);
      if (g === -4) { P.bf[i] = 145 + rng() * 42; P.by[i] = (rng() - 0.5) * 10; P.bb[i] = 0.06 + rng() * 0.12; }
      else { P.bf[i] = 55 + rng() * 9; P.by[i] = (rng() - 0.5) * 2.5; P.bb[i] = 0.1 + rng() * 0.22; }
      P.ba[i] = rng() * TAU;
      P.cloud[i] = [T.NEB1, T.NEB2, T.DUST, T.NEB1][(rng() * 4) | 0];
      P.turns[i] = rng() < 0.5 ? 1 : 0;
    }
    return P;
  })();

  const beltW = r => 0.5 / Math.pow(r / 22, 1.5);
  const planetAlpha = (k, t) => smooth(F0 + 7 + k * 0.2, F0 + 9 + k * 0.2, t);
  const sunAlpha = t => smooth(F0 + 4, F0 + 6.5, t);
  const orbitAlpha = t => smooth(F0 + 9, F0 + 11.5, t);

  function drawNebula(t, oc) {
    const appear = smooth(TB + 10.4, TB + 12.6, t);
    if (appear <= 0) return;
    const tf = t - F0;
    const P = NEB;
    const rot = (t - (TB + 10)) * 0.06, cr = Math.cos(rot), sr = Math.sin(rot);
    const sA = sunAlpha(t);
    const pas = PLANETS.map((p, k) => planetAlpha(k, t));
    const blow = 1 + 2.2 * smooth(F0 + 4, F0 + 8.5, t);
    for (let i = 0; i < P.n; i++) {
      const g = P.group[i];
      const ex = P.cx[i] * cr - P.cz[i] * sr, ey = P.cy[i], ez = P.cx[i] * sr + P.cz[i] * cr;
      const cv = P.cb[i] * appear;
      if (g === -1) {
        const v = cv * (1 - smooth(F0 + 5, F0 + 9, t));
        if (v > 0.03) splat(ex * blow, ey * blow, ez * blow, v, P.cloud[i]);
        continue;
      }
      const w = smooth(P.a0[i], P.a0[i] + P.dur[i], tf);
      let tx, ty, tz, angNow, angStart, tint;
      let v = lerp(cv, 0.3 + 0.45 * Math.sin(Math.min(w, 0.999) * Math.PI), Math.min(1, w * 3));
      if (g === -2) {
        const s = SUN.radius * 0.7;
        tx = P.jx[i] * s; ty = P.jy[i] * s; tz = P.jz[i] * s;
        angNow = angStart = Math.atan2(tz, tx);
        tint = T.SUN;
        v *= 1 - sA * smooth(0.85, 1, w);
      } else if (g < -2) {
        const om = beltW(P.bf[i]);
        angNow = P.ba[i] + oc * om; angStart = P.ba[i] + om * (F0 + P.a0[i]);
        tx = Math.cos(angNow) * P.bf[i]; ty = P.by[i]; tz = Math.sin(angNow) * P.bf[i];
        tint = g === -4 ? T.DUST : T.ROCK;
        v = lerp(v, P.bb[i], smooth(0.8, 1, w));
      } else {
        const p = PLANETS[g];
        angNow = p.phase + oc * p.w; angStart = p.phase + p.w * (F0 + P.a0[i]);
        const spread = p.radius * 3.5 * (1 - w) + p.radius * 0.6;
        tx = Math.cos(angNow) * p.orbit + P.jx[i] * spread;
        ty = P.jy[i] * spread;
        tz = Math.sin(angNow) * p.orbit + P.jz[i] * spread;
        tint = p.tintId;
        v *= 1 - pas[g] * smooth(0.85, 1, w);
      }
      if (v < 0.03) continue;
      const rE = Math.hypot(ex, ez), thE = Math.atan2(ez, ex);
      const rT = Math.hypot(tx, tz);
      const th = g === -2
        ? thE + w * wrap0(angStart - thE)
        : thE + w * (wrap0(angStart - thE) + TAU * P.turns[i] + (angNow - angStart));
      const r = lerp(rE, rT, w);
      splat(Math.cos(th) * r, lerp(ey, ty, w), Math.sin(th) * r, v, w > 0.55 ? tint : P.cloud[i], g < -2 && w > 0.9);
    }
    // the protostar glowing before it ignites
    const proto = smooth(F0 + 1, F0 + 4, t) * (1 - sA);
    if (proto > 0.01) glow(0, 0, 0, proto * 0.9, (SUN.radius * L.F) / cam.dist * 0.8, T.CORONA, false);
  }

  // Flashes where rocks collide while the planets grow.
  const SPARKS = (() => {
    const rng = mulberry32(77), s = [];
    PLANETS.forEach((p, k) => {
      for (let n = 0; n < 7; n++) s.push({ k, t: F0 + 5 + rng() * 4.6, ox: rng() - 0.5, oy: rng() - 0.5, oz: rng() - 0.5 });
    });
    return s;
  })();
  function drawSparks(t, oc) {
    for (const s of SPARKS) {
      const d = t - s.t;
      if (d < 0 || d > 1.2) continue;
      const p = PLANETS[s.k];
      const c = planetPos(p, oc);
      const I = 0.9 * Math.exp(-d * 4);
      glow(c[0] + s.ox * p.radius * 2.5, c[1] + s.oy * p.radius * 2.5, c[2] + s.oz * p.radius * 2.5, I, Math.max(cw * 1.2, (p.radius * L.F) / cam.dist * 0.5), d < 0.15 ? T.FLASH : T.EMBER, true);
    }
  }

  // ---------------------------------------------------------------- bodies
  // Ray-cast a sphere from its camera-space centre, with an optional ring and
  // atmosphere halo. shade(k, nx, ny, nz, Px, Py, Pz) runs per visible cell;
  // SHADOW holds the ring's shadow factor for that cell.
  let SHADOW = 1;
  let sunCam = [0, 0, 0];
  function castSphere(cx3, cy3, cz3, r, shade, opts) {
    const ring = opts && opts.ring, halo = opts && opts.halo;
    const alpha = opts && opts.alpha != null ? opts.alpha : 1;
    const hw = halo ? 0.16 : 0;
    const ext = ring ? r * ring.max : r * (1 + hw);
    if (cz3 < ext * 1.02 + 0.3) return null;
    const F = L.F;
    const sr = (ext * F) / Math.sqrt(cz3 * cz3 - ext * ext);
    const scx = L.cx + (cx3 * F) / cz3, scy = L.cy - (cy3 * F) / cz3;
    const hit = { sx: scx, sy: scy, sr: (r * F) / cz3, z: cz3 };
    if (scx + sr < 0 || scx - sr > W || scy + sr < 0 || scy - sr > H) return hit;
    const i0 = clamp(((scx - sr) / cw) | 0, 0, cols - 1), i1 = clamp(((scx + sr) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((scy - sr) / ch) | 0, 0, rows - 1), j1 = clamp(((scy + sr) / ch) | 0, 0, rows - 1);
    const C2 = cx3 * cx3 + cy3 * cy3 + cz3 * cz3, cc = C2 - r * r;
    let rnx = 0, rny = 0, rnz = 0, rd = 0;
    if (ring) {
      camDir(ring.n[0], ring.n[1], ring.n[2]);
      rnx = V[0]; rny = V[1]; rnz = V[2];
      rd = cx3 * rnx + cy3 * rny + cz3 * rnz;
    }
    // light at the centre, for the halo
    let lcx = sunCam[0] - cx3, lcy = sunCam[1] - cy3, lcz = sunCam[2] - cz3;
    const lcl = Math.hypot(lcx, lcy, lcz) || 1; lcx /= lcl; lcy /= lcl; lcz /= lcl;
    for (let j = j0; j <= j1; j++) {
      const dy = -((j + 0.5) * ch - L.cy) / F;
      for (let i = i0; i <= i1; i++) {
        const dx = ((i + 0.5) * cw - L.cx) / F;
        const k = j * cols + i;
        const a = dx * dx + dy * dy + 1;
        const b = dx * cx3 + dy * cy3 + cz3;
        const disc = b * b - a * cc;
        const ts = disc >= 0 ? (b - Math.sqrt(disc)) / a : Infinity;
        if (ring) {
          const dn = dx * rnx + dy * rny + rnz;
          if (Math.abs(dn) > 1e-5) {
            const tp = rd / dn;
            if (tp > 0 && tp < ts && tp < zbuf[k]) {
              const qx = dx * tp - cx3, qy = dy * tp - cy3, qz = tp - cz3;
              const qd = Math.sqrt(qx * qx + qy * qy + qz * qz);
              const pr = ring.prof(qd / r);
              if (pr > 0.02) {
                let lx = sunCam[0] - dx * tp, ly = sunCam[1] - dy * tp, lz = sunCam[2] - tp;
                const ll = Math.sqrt(lx * lx + ly * ly + lz * lz); lx /= ll; ly /= ll; lz /= ll;
                const tca = -(qx * lx + qy * ly + qz * lz); // planet's shadow on the ring
                const shd = tca > 0 && qd * qd - tca * tca < r * r ? 0.16 : 1;
                const li = 0.45 + 0.55 * Math.abs(lx * rnx + ly * rny + lz * rnz);
                zbuf[k] = tp;
                setL(k, pr * li * shd * alpha * (0.9 + 0.2 * hash2(i, j)), ring.tint);
                continue;
              }
            }
          }
        }
        if (ts !== Infinity) {
          if (ts >= zbuf[k]) continue;
          zbuf[k] = ts;
          const Px = dx * ts, Py = dy * ts, Pz = ts;
          SHADOW = 1;
          if (ring) { // the ring's shadow on the planet
            let lx = sunCam[0] - Px, ly = sunCam[1] - Py, lz = sunCam[2] - Pz;
            const ll = Math.sqrt(lx * lx + ly * ly + lz * lz); lx /= ll; ly /= ll; lz /= ll;
            const den = lx * rnx + ly * rny + lz * rnz;
            if (Math.abs(den) > 1e-4) {
              const tr = ((cx3 - Px) * rnx + (cy3 - Py) * rny + (cz3 - Pz) * rnz) / den;
              if (tr > 0) {
                const qx = Px + lx * tr - cx3, qy = Py + ly * tr - cy3, qz = Pz + lz * tr - cz3;
                SHADOW = 1 - 0.7 * Math.min(1, ring.prof(Math.sqrt(qx * qx + qy * qy + qz * qz) / r) * 1.8);
              }
            }
          }
          shade(k, (Px - cx3) / r, (Py - cy3) / r, (Pz - cz3) / r, Px, Py, Pz);
          continue;
        }
        if (halo && b > 0) {
          const tq = b / a;
          if (tq >= zbuf[k]) continue;
          const dd = Math.sqrt(Math.max(0, C2 - (b * b) / a));
          if (dd < r * (1 + hw)) {
            const h = 1 - (dd - r) / (r * hw);
            const qx = dx * tq - cx3, qy = dy * tq - cy3, qz = tq - cz3;
            const ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
            const lit = clamp(((qx * lcx + qy * lcy + qz * lcz) / ql) * 0.9 + 0.35, 0.05, 1);
            addL(k, h * h * halo[1] * lit * alpha, halo[0]);
          }
        }
      }
    }
    return hit;
  }

  // Light a surface point from the sun. Returns the diffuse term in [0,1].
  const LV = [0, 0, 0];
  function sunLight(nx, ny, nz, Px, Py, Pz) {
    let lx = sunCam[0] - Px, ly = sunCam[1] - Py, lz = sunCam[2] - Pz;
    const ll = Math.sqrt(lx * lx + ly * ly + lz * lz); lx /= ll; ly /= ll; lz /= ll;
    LV[0] = lx; LV[1] = ly; LV[2] = lz;
    const s = nx * lx + ny * ly + nz * lz;
    return s > 0 ? s * SHADOW : 0;
  }

  function drawSun(time, alpha, st) {
    if (alpha <= 0.005) return null;
    const giant = st.giant, dwarf = st.dwarf;
    const r = SUN.radius * (0.35 + 0.65 * easeOut3(alpha)) * st.scale * (1 + 1.6 * giant) * (1 - 0.8 * dwarf);
    const [cx3, cy3, cz3] = sunCam;
    const bright = st.bright;
    const hit = castSphere(cx3, cy3, cz3, r, (k, nx, ny, nz, Px, Py, Pz) => {
      toWorldDir(nx, ny, nz);
      const wx = Wv[0], wy = Wv[1], wz = Wv[2];
      const g = fbm3(wx * 3 + time * 0.1, wy * 3 - time * 0.08, wz * 3) * 0.55 + noise3(wx * 9 - time * 0.2, wy * 9, wz * 9 + time * 0.15) * 0.45;
      const spot = noise3(wx * 9 + 20, wy * 9, wz * 9 - time * 0.02);
      const mu = -(nx * Px + ny * Py + nz * Pz) / Math.sqrt(Px * Px + Py * Py + Pz * Pz); // limb darkening
      let v = ((0.78 + 0.62 * (g - 0.45)) * (0.55 + 0.45 * mu) + 0.22) * alpha * bright;
      let tint = mu < 0.4 || g < 0.4 ? T.SUN2 : T.SUN;
      if (spot > 0.86 && Math.abs(wy) < 0.5 && giant < 0.2) { v *= 0.45; tint = T.EMBER; } // sunspots
      if (giant > 0.4) tint = g < 0.45 ? T.EMBER : T.CORONA;
      if (dwarf > 0.4) { tint = T.ICE; v = (0.7 + 0.3 * mu) * alpha; }
      setL(k, v, tint);
    });
    if (!hit) return null;
    // corona and prominences, only where nothing solid sits in front
    const sr = hit.sr, G = sr * (dwarf > 0.4 ? 5 : 3.4), sunZ = cz3 - r;
    const i0 = clamp(((hit.sx - G) / cw) | 0, 0, cols - 1), i1 = clamp(((hit.sx + G) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((hit.sy - G) / ch) | 0, 0, rows - 1), j1 = clamp(((hit.sy + G) / ch) | 0, 0, rows - 1);
    const ctint = giant > 0.4 ? T.EMBER : dwarf > 0.4 ? T.BLUE : T.CORONA;
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - hit.sy;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - hit.sx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= sr) continue;
        const k = j * cols + i;
        if (zbuf[k] < sunZ) continue;
        const e = d / sr - 1, ca = dx / d, sa = dy / d;
        const rays = 0.5 + 0.5 * fbm(ca * 3 + time * 0.05 + 11, sa * 3 - e * 1.6 + time * 0.25);
        const prom = Math.pow(Math.max(0, fbm(ca * 5 + 40, sa * 5 + time * 0.03) - 0.55) * 2.6, 2) * Math.exp(-e * 9);
        const v = alpha * bright * (0.6 * Math.exp(-e * 4.2) * rays + 0.13 * Math.exp(-e * 1.9) + prom);
        if (v > 0.03) addL(k, v, prom > 0.25 ? T.EMBER : e < 0.2 ? T.SUN2 : ctint);
      }
    }
    hit.r = r;
    return hit;
  }

  // Per-planet frame: axial tilt then spin, so textures turn with the world.
  function makeFrame(tilt, spin) {
    return { ct: Math.cos(tilt), st: Math.sin(tilt), cs: Math.cos(spin), sn: Math.sin(spin) };
  }
  const PF = [0, 0, 0];
  function toPlanet(f, wx, wy, wz) {
    const y1 = wy * f.ct + wz * f.st, z1 = -wy * f.st + wz * f.ct;
    PF[0] = wx * f.cs - z1 * f.sn; PF[1] = y1; PF[2] = wx * f.sn + z1 * f.cs;
  }

  function drawPlanet(p, pos, alpha, time, st, dirs) {
    if (alpha <= 0.005) return null;
    const r = p.radius * (0.2 + 0.8 * alpha);
    toCam(pos[0], pos[1], pos[2]);
    const tilt = p.key === 'uranus' ? st.tilt : p.tilt;
    const fr = makeFrame(tilt, time * p.spin);
    const amb = 0.1;
    let halo = p.halo ? [p.haloT, p.halo[1]] : null;
    if (p.key === 'mars') halo = [st.air > 0.3 ? T.EHALO : T.MARS, 0.12 + 0.5 * st.air];
    let ring = null;
    if (p.key === 'saturn') ring = { n: [0, Math.cos(tilt), Math.sin(tilt)], prof: satRing, tint: T.RING, max: 2.3 };
    if (p.key === 'uranus') ring = { n: [0, Math.cos(tilt), Math.sin(tilt)], prof: uraRing, tint: T.RING, max: 2.0 };
    const rimS = halo ? halo[1] : 0, rimT = halo ? halo[0] : 0;

    const hit = castSphere(V[0], V[1], V[2], r, (k, nx, ny, nz, Px, Py, Pz) => {
      const sh = sunLight(nx, ny, nz, Px, Py, Pz);
      const lit = amb + (1 - amb) * Math.pow(sh, 0.8);
      toWorldDir(nx, ny, nz);
      const wx = Wv[0], wy = Wv[1], wz = Wv[2];
      toPlanet(fr, wx, wy, wz);
      const x = PF[0], y = PF[1], z = PF[2];
      let v = lit, tint = p.tintId;
      switch (p.key) {
        case 'earth': {
          const land = fbm3(x * 1.7 + 3, y * 1.7, z * 1.7) + 0.12 * (noise3(x * 6, y * 6, z * 6) - 0.5);
          const water = land < 0.57 * st.ocean;
          if (water) {
            tint = T.EARTH;
            v = lit * (0.7 + 0.3 * (land / 0.57));
            if (st.ocean > 0.5 && st.dust < 0.5) { // sun glint
              const vl = Math.sqrt(Px * Px + Py * Py + Pz * Pz);
              const nl = nx * LV[0] + ny * LV[1] + nz * LV[2];
              const Rx = 2 * nl * nx - LV[0], Ry = 2 * nl * ny - LV[1], Rz = 2 * nl * nz - LV[2];
              const sp = Math.pow(Math.max(0, -(Rx * Px + Ry * Py + Rz * Pz) / vl), 30) * SHADOW;
              v += sp * 0.8;
              if (sp > 0.35) tint = T.LIGHT;
            }
          } else {
            const veg = fbm3(x * 2.3 + 9, y * 2.3, z * 2.3);
            const green = veg < st.life * 0.64 && Math.abs(y) < 0.78;
            tint = green ? T.LAND : st.ocean > 0.5 ? T.DESERT : T.ROCK;
            v = lit * (0.82 + 0.3 * (noise3(x * 8, y * 8, z * 8) - 0.5));
          }
          if (st.ocean > 0.5 && Math.abs(y) > 0.86 - 0.06 * noise3(x * 5, 1, z * 5)) { tint = T.ICE; v = lit * 1.05; }
          const cl = fbm3(x * 2.4 - time * 0.03, y * 3.6 + 7, z * 2.4);
          if (st.clouds > 0 && cl > 0.62) {
            const c = smooth(0.62, 0.74, cl) * st.clouds;
            v = lerp(v, 0.05 + sh * 1.05, c);
            if (c > 0.5) tint = T.STAR;
          }
          if (st.lights > 0 && !water && sh < 0.1 && cl < 0.66 && noise3(x * 26, y * 26, z * 26) > 0.7) {
            const cv = 0.6 * st.lights * (1 - sh * 9);
            if (cv > v) { v = cv; tint = T.CITY; }
          }
          if (st.molten > 0) {
            const crack = Math.pow(1 - Math.abs(noise3(x * 5 + time * 0.05, y * 5, z * 5) * 2 - 1), 5);
            const vm = 0.12 + 0.85 * crack + 0.12 * sh;
            v = lerp(v, vm, st.molten);
            if (st.molten > 0.5) tint = crack > 0.5 ? T.SUN2 : crack > 0.2 ? T.EMBER : T.ROCK;
          }
          if (st.dust > 0) {
            v = lerp(v, (0.08 + 0.3 * sh) * (0.7 + 0.6 * noise3(x * 3 + time * 0.2, y * 3, z * 3)), st.dust);
            if (st.dust > 0.5) tint = T.DUSTG;
          }
          break;
        }
        case 'mars': {
          const n = fbm3(x * 2, y * 2, z * 2);
          v = lit * (0.78 + 0.35 * (n - 0.5));
          if (n < 0.42) tint = T.MARSD;
          const lon = Math.atan2(x, z);
          if (Math.abs(y - 0.08 * Math.sin(lon * 3)) < 0.03 && lon > -0.4 && lon < 1.2) { tint = T.MARSD; v *= 0.6; } // valles marineris
          if (st.water > 0 && y > 0.05 && fbm3(x * 1.6 + 7, y * 1.6, z * 1.6) < 0.62 * st.water) { tint = T.EARTH; v = lit * 0.85; }
          if (Math.abs(y) > 0.93 - 0.12 * st.poles + 0.04 * noise3(x * 6, 0, z * 6)) { tint = T.ICE; v = lit * 1.05; }
          break;
        }
        case 'venus': {
          const surf = fbm3(x * 1.8 + 2, y * 1.8, z * 1.8);
          let sv = lit * (0.75 + 0.3 * (surf - 0.5)), stint = surf < 0.5 * st.ocean ? T.EARTH : T.VENUS2;
          const c = fbm3(x * 1.5 + time * 0.05, y * 4.5, z * 1.5);
          if (c * 0.8 + 0.2 < st.haze) { v = lit * (0.82 + 0.3 * (c - 0.5)); tint = T.VENUS; }
          else { v = sv; tint = stint; }
          break;
        }
        case 'mercury': {
          const cr = Math.abs(noise3(x * 7, y * 7, z * 7) * 2 - 1);
          v = lit * (0.62 + 0.5 * Math.pow(cr, 0.6) * (0.7 + 0.3 * noise3(x * 15, y * 15, z * 15)));
          break;
        }
        case 'jupiter': {
          const wq = fbm3(x * 2, y * 2, z * 2);
          const lat = y + (wq - 0.5) * 0.12;
          const b = Math.sin(lat * 14) + 0.5 * Math.sin(lat * 31 + wq * 4);
          tint = b > 0.35 ? T.JUP2 : b < -0.6 ? T.JUPD : T.JUP;
          v = lit * (0.84 + 0.12 * b + 0.12 * (noise3(x * 10, y * 30, z * 10) - 0.5));
          const lon = Math.atan2(x, z) - 1.0;
          const dl = Math.atan2(Math.sin(lon), Math.cos(lon));
          const e = ((y + 0.36) / 0.09) ** 2 + (dl / 0.32) ** 2;
          if (e < 1) { tint = e < 0.35 ? T.MARS : T.JUPSPOT; v = lit * (0.85 + 0.1 * Math.sin(e * 12 + time)); }
          break;
        }
        case 'saturn': {
          const b = Math.sin(y * 11 + fbm3(x, y * 3, z) * 1.5);
          tint = b > 0.3 ? T.JUP2 : T.SAT;
          v = lit * (0.88 + 0.1 * b);
          break;
        }
        case 'uranus':
          v = lit * (0.92 + 0.06 * Math.sin(y * 9));
          break;
        case 'neptune': {
          v = lit * (0.9 + 0.08 * Math.sin(y * 10 + fbm3(x, y * 2, z) * 2));
          const lon = Math.atan2(x, z) - 2.0;
          const dl = Math.atan2(Math.sin(lon), Math.cos(lon));
          if (((y + 0.35) / 0.1) ** 2 + (dl / 0.3) ** 2 < 1) { tint = T.NEPD; v *= 0.7; }
          if (noise3(x * 1.6 + time * 0.1, y * 14, z * 1.6) > 0.74) { tint = T.STAR; v = lit * 1.05; }
          break;
        }
        case 'pluto': {
          v = lit * (0.82 + 0.3 * (fbm3(x * 2, y * 2, z * 2) - 0.5));
          if (fbm3(x * 1.4 + 5, y * 1.4, z * 1.4) < 0.42 && y < 0.2) tint = T.PLUTOD;
          const lon = Math.atan2(x, z) - 0.6;
          const hx = Math.atan2(Math.sin(lon), Math.cos(lon)) * 1.7, hy = -(y - 0.05) * 2.4 + 0.25;
          const hh = Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * hy * hy * hy;
          if (hh < 0 && st.heart > 0.3) { tint = T.ICE; v = lit * (0.9 + 0.2 * st.heart); }
          break;
        }
      }
      // impact scars
      if (dirs) {
        for (const d of dirs) {
          const c = wx * d.w[0] + wy * d.w[1] + wz * d.w[2];
          if (d.dark && st.scars > 0 && c > 0.985) { v *= 1 - 0.75 * st.scars; tint = T.JUPD; }
          if (!d.dark && st.scar > 0 && c > 0.93) {
            const g = (c - 0.93) / 0.07;
            const gv = st.scar * (0.35 + 0.65 * g) * (0.7 + 0.3 * noise3(wx * 20, wy * 20, wz * 20));
            if (gv > v * 0.8) { v = Math.max(v, gv); tint = g > 0.6 ? T.SUN2 : T.EMBER; }
          }
        }
      }
      // atmosphere rim on the lit edge
      if (rimS > 0) {
        const mu = -(nx * Px + ny * Py + nz * Pz) / Math.sqrt(Px * Px + Py * Py + Pz * Pz);
        const rim = Math.pow(1 - mu, 3) * Math.min(rimS, 0.5) * Math.min(1, sh * 3);
        v += rim * 0.6;
        if (rim > 0.22) tint = rimT;
      }
      setL(k, v * alpha, tint);
    }, { ring, halo, alpha });
    if (hit) hit.r = r;
    return hit;
  }

  function drawMoon(m, pos, alpha, time) {
    if (alpha <= 0.01) return null;
    toCam(pos[0], pos[1], pos[2]);
    const r = m.r * alpha;
    const hit = castSphere(V[0], V[1], V[2], r, (k, nx, ny, nz, Px, Py, Pz) => {
      const sh = sunLight(nx, ny, nz, Px, Py, Pz);
      toWorldDir(nx, ny, nz);
      const x = Wv[0], y = Wv[1], z = Wv[2];
      const c = noise3(x * 6 + m.phase, y * 6, z * 6);
      let v = (0.06 + 0.94 * Math.pow(sh, 0.8)) * (0.75 + 0.4 * (c - 0.5));
      let tint = m.tintId;
      if (m.tint === 'IO' && noise3(x * 5 + 3, y * 5, z * 5) > 0.66) tint = T.EMBER;
      if (m.tint === 'EUROPA' && Math.abs(noise3(x * 4, y * 4, z * 4) - 0.5) < 0.03) tint = T.MARSD;
      if (m.tint === 'MOONG' && fbm3(x * 2 + 5, y * 2, z * 2) < 0.42) v *= 0.7; // maria
      setL(k, v * alpha, tint);
    }, m.tint === 'TITAN' ? { halo: [T.TITAN, 0.4], alpha } : { alpha });
    if (hit) hit.r = r;
    return hit;
  }

  function drawOrbits(alpha, selKey) {
    if (alpha <= 0.01) return;
    for (const p of PLANETS) {
      const sel = p.key === selKey;
      const n = clamp(Math.ceil((TAU * p.orbit * L.F) / Math.max(cam.dist, 20) / (cw * 0.9)), 160, 6000);
      const v = alpha * (sel ? 0.38 : selKey ? 0.1 : 0.2);
      for (let s = 0; s < n; s++) {
        const a = (s / n) * TAU;
        splat(Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit, v * (s % 2 ? 1 : 0.55), sel ? T.ACCENT : T.ORBIT, true);
      }
    }
  }

  function drawMoonOrbits(p, c, tilt, alpha) {
    for (const m of p.moons) {
      const n = clamp(Math.ceil((TAU * m.d * L.F) / Math.max(cam.dist, 8) / (cw * 1.2)), 60, 1500);
      const ph = tilt + m.incl, s = Math.sin(ph), co = Math.cos(ph);
      for (let i = 0; i < n; i += 2) {
        const a = (i / n) * TAU, X = Math.cos(a) * m.d, Z = Math.sin(a) * m.d;
        splat(c[0] + X, c[1] - Z * s, c[2] + Z * co, 0.13 * alpha, T.ORBIT, true);
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
    for (let s = 0; s < 40; s++) {
      const q = p - s * 0.006;
      if (q < 0) break;
      const k = cellAt(x0 + Math.cos(ang) * sp * q, y0 + Math.sin(ang) * sp * q * 0.5);
      if (k >= 0 && zbuf[k] === 1e9) addL(k, (1 - s / 40) * Math.sin(p * Math.PI) * 0.9, s < 5 ? T.ICE : T.BLUE);
    }
  }

  // ---------------------------------------------------------------- stories
  // A story drives a world's look through keyframed tracks, plus impacts.
  let story = null; // { key, def, st, dirs, fired, basis }
  function evalTracks(def, st) {
    const out = {};
    for (const name in def.now) {
      const k = def.tracks[name];
      if (!k) { out[name] = def.now[name]; continue; }
      if (st <= k[0][0]) { out[name] = k[0][1]; continue; }
      let v = k[k.length - 1][1];
      for (let i = 0; i < k.length - 1; i++) {
        if (st < k[i + 1][0]) {
          const u = smooth(k[i][0], k[i + 1][0], st);
          v = lerp(k[i][1], k[i + 1][1], u);
          break;
        }
      }
      out[name] = v;
    }
    return out;
  }
  function stateOf(key) {
    const def = STORIES[key];
    if (story && story.key === key && !story.done) return evalTracks(def, Math.max(0, story.st));
    return def.now;
  }

  function startStory(b) {
    const key = BODIES[b].key;
    const def = STORIES[key];
    // impact directions are given relative to the current view
    const dirs = def.impacts.map(im => {
      const [a, u, f] = im.from;
      const w = norm3([a * cam.rx + u * cam.ux - f * cam.fx, a * cam.ry + u * cam.uy - f * cam.fy, a * cam.rz + u * cam.uz - f * cam.fz]);
      return { w, dark: !!im.scar };
    });
    story = { key, def, st: -1.6, dirs, fired: new Set(), done: false, body: b };
    ui.info.classList.remove('told');
  }

  const DEBRIS = (() => {
    const rng = mulberry32(31), n = 900, d = [];
    for (let i = 0; i < n; i++) {
      const z = rng() * 2 - 1, a = rng() * TAU, rr = Math.sqrt(1 - z * z);
      d.push({ dx: Math.cos(a) * rr, dy: z, dz: Math.sin(a) * rr, spd: 0.3 + rng(), ring: 0.55 + rng() * 0.8, ang: rng() * TAU, y: (rng() - 0.5) * 0.15, hot: rng() < 0.5 });
    }
    return d;
  })();

  // Impactors, flashes, debris and other story effects around world `p`.
  function drawStoryFx(p, c, r, st, time) {
    if (!story || story.key !== p.key) return;
    const s = story.st, def = story.def;
    def.impacts.forEach((im, idx) => {
      const D = story.dirs[idx].w;
      const t0 = im.t - im.dur;
      if (s < t0 || s > im.t + 6) return;
      const hitP = [c[0] + D[0] * r, c[1] + D[1] * r, c[2] + D[2] * r];
      if (s < im.t) { // incoming
        const q = (s - t0) / im.dur;
        const dist = r * 9 * (1 - q * q);
        const ip = [hitP[0] + D[0] * dist, hitP[1] + D[1] * dist, hitP[2] + D[2] * dist];
        const ir = r * im.size;
        if (im.size > 0.15) {
          toCam(ip[0], ip[1], ip[2]);
          castSphere(V[0], V[1], V[2], ir, (k, nx, ny, nz, Px, Py, Pz) => {
            const sh = sunLight(nx, ny, nz, Px, Py, Pz);
            toWorldDir(nx, ny, nz);
            const g = noise3(Wv[0] * 5, Wv[1] * 5, Wv[2] * 5);
            setL(k, (0.1 + 0.9 * sh) * (0.7 + 0.5 * (g - 0.5)), T[im.tint]);
          });
        } else {
          glow(ip[0], ip[1], ip[2], 0.9, cw * 1.4, T.LIGHT, true);
        }
        for (let i = 1; i < 40; i++) { // trail
          const qq = Math.max(0, q - i * 0.006);
          const dd = r * 9 * (1 - qq * qq) + ir;
          splat(hitP[0] + D[0] * dd, hitP[1] + D[1] * dd, hitP[2] + D[2] * dd, 0.7 * (1 - i / 40), i < 6 ? T.LIGHT : T.EMBER);
        }
        return;
      }
      const a = s - im.t;
      if (!story.fired.has(idx)) {
        story.fired.add(idx);
        AUDIO.impact(Math.min(1, im.size * 2 + 0.25));
      }
      // flash
      glow(hitP[0], hitP[1], hitP[2], im.flash * 1.4 * Math.exp(-a * 2.2), Math.max(cw * 2, ((r * (0.5 + im.size)) * L.F) / cam.dist), T.FLASH, false);
      // shock ring spreading over the surface
      if (a < 3) {
        const al = 1.3 * (1 - Math.exp(-a * 1.4));
        const e1 = norm3(Math.abs(D[1]) < 0.9 ? [D[2], 0, -D[0]] : [1, 0, 0]);
        const e2 = [D[1] * e1[2] - D[2] * e1[1], D[2] * e1[0] - D[0] * e1[2], D[0] * e1[1] - D[1] * e1[0]];
        const ca = Math.cos(al), sa = Math.sin(al), fv = 0.8 * Math.exp(-a * 1.1);
        for (let i = 0; i < 260; i++) {
          const ph = (i / 260) * TAU, cp = Math.cos(ph), sp = Math.sin(ph);
          const nx = D[0] * ca + (e1[0] * cp + e2[0] * sp) * sa;
          const ny = D[1] * ca + (e1[1] * cp + e2[1] * sp) * sa;
          const nz = D[2] * ca + (e1[2] * cp + e2[2] * sp) * sa;
          splat(c[0] + nx * r * 1.01, c[1] + ny * r * 1.01, c[2] + nz * r * 1.01, fv, T.EMBER);
        }
      }
      // debris
      const moonDebris = im.debris === 'moon';
      const n = moonDebris ? DEBRIS.length : 260;
      const moon = p.moons[0];
      const mp = moon ? moonPos(p, moon, c, mcl, p.tilt) : c;
      for (let i = 0; i < n; i++) {
        const d = DEBRIS[i];
        const dir = norm3([D[0] + d.dx * 0.9, D[1] + d.dy * 0.9, D[2] + d.dz * 0.9]);
        const out = r * (0.2 + d.spd * (moonDebris ? 2.6 : 1.4)) * (1 - Math.exp(-a * 1.6));
        let x = hitP[0] + dir[0] * out, y = hitP[1] + dir[1] * out, z = hitP[2] + dir[2] * out;
        let v = 0.85 * Math.exp(-a * (moonDebris ? 0.25 : 0.9));
        if (moonDebris && moon) {
          // settle into a ring, then gather into the moon
          const w1 = smooth(0.8, 3.2, a);
          const ang = d.ang + a * 0.7, rr = moon.d * d.ring;
          const ph = p.tilt + moon.incl;
          const X = Math.cos(ang) * rr, Z = Math.sin(ang) * rr;
          const rx = c[0] + X, ry = c[1] - Z * Math.sin(ph) + d.y * r, rz = c[2] + Z * Math.cos(ph);
          x = lerp(x, rx, w1); y = lerp(y, ry, w1); z = lerp(z, rz, w1);
          const w2 = Math.pow(st.moon, 1.5);
          x = lerp(x, mp[0], w2); y = lerp(y, mp[1], w2); z = lerp(z, mp[2], w2);
          v = (0.3 + 0.5 * Math.exp(-a)) * (1 - st.moon);
        }
        if (v > 0.03) splat(x, y, z, v, d.hot ? T.EMBER : T.ROCK);
      }
    });

    // mars: the magnetic shield, then the solar wind stripping the air
    if (p.key === 'mars') {
      const Ls = norm3([-c[0], -c[1], -c[2]]);
      const e1 = norm3([Ls[2], 0, -Ls[0]]);
      const e2 = [Ls[1] * e1[2] - Ls[2] * e1[1], Ls[2] * e1[0] - Ls[0] * e1[2], Ls[0] * e1[1] - Ls[1] * e1[0]];
      if (st.field > 0.01) {
        for (let i = 0; i < SHELL.length; i += 6) {
          const nx = SHELL[i], ny = SHELL[i + 1], nz = SHELL[i + 2];
          const f = nx * Ls[0] + ny * Ls[1] + nz * Ls[2];
          if (f < -0.1) continue;
          const R = r * (2.1 + 0.6 * (1 - f));
          splat(c[0] + nx * R, c[1] + ny * R, c[2] + nz * R, 0.16 * st.field * (0.6 + 0.4 * f), T.BLUE);
        }
      }
      if (st.wind > 0.01) {
        for (let i = 0; i < 600; i++) {
          const d = DEBRIS[i];
          const u = (d.dx * 2.6) * r, w = (d.dz * 2.6) * r;
          const along = r * 8 - (((s * 2.2 + d.ang) * r * 2) % (r * 16));
          const x = c[0] + Ls[0] * along + e1[0] * u + e2[0] * w;
          const y = c[1] + Ls[1] * along + e1[1] * u + e2[1] * w;
          const z = c[2] + Ls[2] * along + e1[2] * u + e2[2] * w;
          splat(x, y, z, 0.28 * st.wind, T.BLUE);
        }
      }
    }
    // saturn: enceladus' plume
    if (p.key === 'saturn' && st.plume > 0.01) {
      const m = p.moons[0];
      const mp = moonPos(p, m, c, mcl, p.tilt);
      for (let i = 0; i < 300; i++) {
        const d = DEBRIS[i];
        const q = (s * 0.5 + d.ang / TAU) % 1;
        const out = m.r * (1 + q * 9);
        splat(mp[0] + d.dx * out * 0.35, mp[1] - out, mp[2] + d.dz * out * 0.35, 0.5 * (1 - q) * st.plume, T.ENCEL);
      }
    }
  }

  // ---------------------------------------------------------------- frame
  let mode = 'intro';            // intro | play
  let t = 0, oc = 0, mcl = 0, idle = 0;
  let orbitSpeed = 1;
  let selected = -1, hovered = null;
  let live = false;
  let hits = [];
  let moonScreens = [];
  let lastInput = -1e9;
  let dragging = false;

  // Where the film puts the camera before the viewer takes over.
  function scriptCamera(time) {
    cam.yaw = cam.yawT = 0.7 + time * 0.03;
    let pitch = 0.24;
    pitch = lerp(pitch, 0.8, smooth(TB + 2, TB + 6, time));
    pitch = lerp(pitch, 0.3, smooth(TB + 8.6, F0 + 1, time));
    pitch = lerp(pitch, 0.42, smooth(F0 + 8.5, T_LIVE, time));
    cam.pitch = cam.pitchT = pitch;
    let dist = 380;
    dist = lerp(dist, 560, smooth(TB + 2, TB + 6.5, time));
    dist = lerp(dist, 420, smooth(TB + 9, F0 + 1, time));
    dist = lerp(dist, L.home, easeInOut(smooth(F0 + 8.5, T_LIVE - 0.2, time)));
    cam.dist = cam.distT = dist;
    cam.tx = cam.ty = cam.tz = 0;
  }

  function render() {
    lum.fill(0); str.fill(0); zbuf.fill(1e9);
    hits = [];
    moonScreens = [];
    setupCamera();
    toCam(0, 0, 0);
    sunCam = [V[0], V[1], V[2]];

    if (mode === 'intro') {
      drawSky(0.4, idle, false);
    } else if (t < TB) {
      drawSky(0.4 * (1 - smooth(0, 2.2, t)), t, false);
      drawSingularity(t);
    } else {
      const sunSt = stateOf('sun');
      const sh = drawSun(t, sunAlpha(t), sunSt);
      if (sh) hits.push({ body: 0, name: SUN.name, x: sh.sx, y: sh.sy, r: sh.sr, z: sh.z });
      const focus = selected > 0 ? PLANETS[selected - 1] : null;
      PLANETS.forEach((p, k) => {
        const pos = planetPos(p, oc);
        const a = planetAlpha(k, t);
        const st = stateOf(p.key);
        const dirs = story && story.key === p.key ? story.dirs : null;
        const hit = drawPlanet(p, pos, a, t, st, dirs);
        if (hit) hits.push({ body: k + 1, name: p.name, x: hit.sx, y: hit.sy, r: hit.sr * (p.key === 'saturn' ? 1.8 : 1), z: hit.z });
        const tilt = p.key === 'uranus' ? st.tilt : p.tilt;
        p.moons.forEach(m => {
          const ma = p.key === 'earth' ? a * st.moon : a;
          const mp = moonPos(p, m, pos, mcl, tilt);
          const mh = drawMoon(m, mp, ma, t);
          if (mh) {
            hits.push({ body: k + 1, name: m.name, moon: true, x: mh.sx, y: mh.sy, r: Math.max(mh.sr, 3), z: mh.z });
            if (focus === p) moonScreens.push({ name: m.name, x: mh.sx, y: mh.sy, r: mh.sr });
          }
        });
        if (focus === p && live) drawMoonOrbits(p, pos, tilt, p.key === 'earth' ? st.moon : 1);
        if (live) drawStoryFx(p, pos, p.radius, st, t);
      });
      drawSky(smooth(TB + 10.8, TB + 13.5, t), t, true);
      drawOrbits(orbitAlpha(t), focus ? focus.key : null);
      drawGalaxy(t);
      drawNebula(t, oc);
      drawSparks(t, oc);
      drawShockwave(t);
      drawFlash(t);
      drawMeteor(t);
    }
    present();
  }

  function present() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (mode === 'play' && strobe(t) > 0.97) return; // hidden under the white-out
    for (let j = 0, k = 0; j < rows; j++) {
      const y = Math.round(j * ch * DPR);
      for (let i = 0; i < cols; i++, k++) {
        const v = lum[k];
        if (v < 0.04) continue;
        const g = v * 1.2;
        const lv = g >= 1 ? 15 : 1 + ((g * 14.99) | 0);
        ctx.drawImage(atlas, (variant[k] * 16 + lv) * tileW, tnt[k] * tileH, tileW, tileH, Math.round(i * cw * DPR), y, tileW, tileH);
      }
    }
  }

  // DOM layers that ride on the same timeline.
  let lastKey = '', lastTyped = 0, lastText = null;
  const labelEls = [];
  function updateOverlay() {
    // typed lines (the film, or a world's story), with a key click per letter
    let text = '', op = 0, typing = false, key = '', n = 0;
    const pick = (list, time, prefix, cut) => list.forEach(([a, b, s], i) => {
      if (time >= a && time < b) {
        key = prefix + i;
        n = Math.min(s.length, Math.floor((time - a) * CPS));
        text = s.slice(0, n);
        typing = n < s.length;
        op = b === cut ? 1 : 1 - smooth(b - 0.6, b, time);
      }
    });
    if (mode === 'play' && !live) pick(LINES, t, 'f', TB);
    else if (live && story && !story.done) pick(story.def.lines, story.st, story.key, -1);
    if (key && key === lastKey && n > lastTyped && text[n - 1] !== ' ') AUDIO.click();
    lastKey = key; lastTyped = n;
    if (text !== lastText) { ui.captionText.textContent = text; lastText = text; }
    ui.caption.style.opacity = op.toFixed(3);
    ui.caption.classList.toggle('typing', typing);

    const fo = mode === 'play' ? strobe(t) : 0;
    ui.flash.style.opacity = fo > 0.002 ? fo.toFixed(3) : '0';

    // camera shake
    let amp = 0;
    if (mode === 'play' && !REDUCED) {
      if (t < TB) amp = smooth(TB - 3, TB - 0.5, t) * 3 * (1 - smooth(TB - 0.4, TB - 0.1, t));
      else amp = 22 * Math.exp(-(t - TB) * 2.2);
      if (live && story) {
        story.def.impacts.forEach(im => {
          const a = story.st - im.t;
          if (a >= 0 && a < 2) amp += 14 * im.flash * Math.min(1, im.size * 3 + 0.2) * Math.exp(-a * 3);
        });
      }
    }
    if (amp > 0.2) {
      const sx = amp * (Math.sin(idle * 83.1) + Math.sin(idle * 47.3) * 0.6) / 1.6;
      const sy = amp * (Math.cos(idle * 71.7) + Math.sin(idle * 39.1) * 0.6) / 1.6;
      canvas.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    } else if (canvas.style.transform) canvas.style.transform = '';

    const nowLive = mode === 'play' && t >= T_LIVE;
    if (nowLive !== live) {
      live = nowLive;
      document.body.classList.toggle('live', live);
      canvas.style.cursor = live ? 'grab' : '';
      if (!live) { select(-1); setHover(null); }
    }
    document.body.classList.toggle('playing', mode === 'play' && !live);
    document.body.classList.toggle('touched', live && lastInput > 0);

    if (hovered && live) {
      const h = hits.find(x => x.name === hovered.name);
      if (h) ui.hover.style.transform = `translate(${(h.x + Math.max(h.r, 6) + 10).toFixed(1)}px, ${(h.y - 8).toFixed(1)}px)`;
      else setHover(null);
    }

    // moon names during a story that mentions them
    let showLabels = false;
    if (live && story && selected > 0 && !story.done) {
      const st = stateOf(story.key);
      showLabels = st.labels > 0.5;
    }
    const want = showLabels ? moonScreens : [];
    while (labelEls.length < want.length) {
      const el = document.createElement('span');
      el.className = 'moon-label';
      ui.labels.appendChild(el);
      labelEls.push(el);
    }
    labelEls.forEach((el, i) => {
      const m = want[i];
      if (!m) { el.classList.remove('on'); return; }
      if (el.textContent !== m.name) el.textContent = m.name;
      el.style.transform = `translate(${(m.x + Math.max(m.r, 3) + 6).toFixed(1)}px, ${(m.y - 6).toFixed(1)}px)`;
      el.classList.add('on');
    });
  }

  // Viewer-driven camera once the film is over.
  function updateCamera(dt) {
    let tx = 0, ty = 0, tz = 0;
    if (selected > 0) [tx, ty, tz] = planetPos(PLANETS[selected - 1], oc);
    const k = Math.min(1, dt * 3.2);
    cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k;
    if (!dragging && idle - lastInput > 5) cam.yawT += dt * 0.025;
    const kk = Math.min(1, dt * 7);
    cam.yaw += (cam.yawT - cam.yaw) * kk;
    cam.pitch += (cam.pitchT - cam.pitch) * kk;
    cam.dist += (cam.distT - cam.dist) * Math.min(1, dt * 4);
  }

  function minDist() {
    if (selected > 0) return PLANETS[selected - 1].radius * 2.6;
    if (selected === 0) return SUN.radius * 2.8 * (1 + 1.6 * stateOf('sun').giant);
    return SUN.radius * 2.2;
  }

  // Coarser cells if the machine can't keep up.
  let perfFrames = 0, perfTime = 0;
  function watchPerf(dt) {
    if (quality >= 1.45 || document.hidden) return;
    perfFrames++; perfTime += dt;
    if (perfFrames >= 90) {
      if (perfTime / perfFrames > 1 / 30) { quality *= 1.2; resize(); }
      perfFrames = 0; perfTime = 0;
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    idle += dt;
    if (mode === 'play') {
      t += dt;
      if (t < T_LIVE) { oc = t; mcl = t; scriptCamera(t); }
      else {
        const target = story && !story.done ? 0.03 : selected >= 0 ? 0.25 : 1;
        orbitSpeed += (target - orbitSpeed) * Math.min(1, dt * 2.5);
        oc += dt * orbitSpeed;
        mcl += dt * Math.max(orbitSpeed, 0.35);
        if (story && !story.done) {
          story.st += dt;
          if (story.st > story.def.dur) {
            story.done = true;
            ui.info.classList.add('told');
          }
        }
        updateCamera(dt);
      }
    } else scriptCamera(0);
    render();
    updateOverlay();
    watchPerf(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- interaction
  function begin() {
    if (mode === 'play') return;
    mode = 'play';
    t = 0; oc = 0; mcl = 0; orbitSpeed = 1;
    lastKey = ''; lastTyped = 0;
    ui.intro.classList.add('gone');
    if (!AUDIO.muted) AUDIO.start(TB);
  }

  // Replay always returns to the opening question.
  function replay() {
    select(-1); setHover(null);
    AUDIO.stop();
    mode = 'intro';
    t = 0; oc = 0; mcl = 0; orbitSpeed = 1; lastInput = -1e9;
    live = false;
    document.body.classList.remove('live', 'playing', 'touched');
    canvas.style.transform = '';
    canvas.style.cursor = '';
    ui.flash.style.opacity = '0';
    ui.caption.style.opacity = '0';
    ui.intro.classList.remove('gone', 'typed');
    typeQuestion();
  }

  function skip() {
    if (mode !== 'play' || t >= T_LIVE) return;
    t = T_LIVE; oc = T_LIVE; mcl = T_LIVE;
    scriptCamera(T_LIVE);
    if (!AUDIO.muted) AUDIO.skip();
  }

  function hitTest(x, y) {
    let best = null, bestZ = Infinity;
    for (const h of hits) {
      const pad = Math.max(h.r * 1.25, h.moon ? 8 : 14);
      if (Math.hypot(x - h.x, y - h.y) < pad && h.z < bestZ) { best = h; bestZ = h.z; }
    }
    return best;
  }

  function setHover(h) {
    if ((h && h.name) === (hovered && hovered.name)) return;
    hovered = h;
    canvas.style.cursor = h ? 'pointer' : (live ? 'grab' : '');
    if (h && !(h.body === selected && !h.moon)) {
      ui.hover.textContent = h.name;
      ui.hover.classList.add('on');
    } else ui.hover.classList.remove('on');
  }

  function select(b) {
    selected = b;
    document.body.classList.toggle('focused', b >= 0);
    if (b < 0) {
      story = null;
      ui.info.classList.remove('open', 'told');
      cam.distT = L.home;
      return;
    }
    const d = BODIES[b];
    ui.infoName.textContent = d.name;
    ui.infoAge.textContent = d.age;
    ui.infoFact.textContent = d.fact;
    ui.info.classList.remove('open');
    void ui.info.offsetWidth; // restart the fade
    ui.info.classList.add('open');
    cam.distT = d.focus * clamp(L.F / 940, 0.65, 1);
    if (b > 0) {
      // view the world from partway round its sunlit side, looking outward,
      // so it is lit and the inner system isn't piled up behind it
      const [px, , pz] = planetPos(PLANETS[b - 1], oc);
      const l = Math.hypot(px, pz) || 1, rx = px / l, rz = pz / l;
      const a = 0.7, hx = -rx * Math.cos(a) - rz * Math.sin(a), hz = -rz * Math.cos(a) + rx * Math.sin(a);
      let yaw = Math.atan2(hx, hz);
      yaw += TAU * Math.round((cam.yawT - yaw) / TAU);
      cam.yawT = yaw;
      cam.pitchT = 0.28;
    }
    if (hovered && hovered.body === b) ui.hover.classList.remove('on');
    AUDIO.blip(1 + b * 0.06);
    startStory(b);
  }

  // Drag to orbit, wheel or pinch to zoom, click to pick a world.
  const pointers = new Map();
  let moved = 0, pinch0 = 0, pinchDist0 = 0;
  canvas.addEventListener('pointerdown', e => {
    if (!live) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; moved = 0; canvas.style.cursor = 'grabbing'; }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y); pinchDist0 = cam.distT;
    }
    lastInput = idle;
  });
  canvas.addEventListener('pointermove', e => {
    if (!live) return;
    const p = pointers.get(e.pointerId);
    if (!p) { setHover(hitTest(e.clientX, e.clientY)); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    lastInput = idle;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0 && d > 0) cam.distT = clamp(pinchDist0 * (pinch0 / d), minDist(), 800);
      moved += 99;
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    cam.yawT -= dx * 0.006;
    cam.pitchT = clamp(cam.pitchT + dy * 0.005, -1.4, 1.4);
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size > 0) return;
    dragging = false;
    canvas.style.cursor = live ? 'grab' : '';
    if (moved < 6 && e.type === 'pointerup') {
      const h = hitTest(e.clientX, e.clientY);
      if (h) { if (h.body !== selected) select(h.body); }
      else if (selected >= 0) select(-1);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (!dragging) setHover(null); });
  canvas.addEventListener('wheel', e => {
    if (!live) return;
    e.preventDefault();
    lastInput = idle;
    cam.distT = clamp(cam.distT * Math.exp(e.deltaY * 0.0012), minDist(), 800);
  }, { passive: false });

  ui.infoBack.addEventListener('click', () => select(-1));
  ui.infoStory.addEventListener('click', () => { if (selected >= 0) startStory(selected); });
  ui.skip.addEventListener('click', skip);
  ui.replay.addEventListener('click', replay);
  ui.sound.addEventListener('click', () => {
    const m = !AUDIO.muted;
    AUDIO.setMuted(m);
    ui.sound.setAttribute('aria-pressed', String(!m));
    ui.sound.querySelector('span').textContent = m ? 'off' : 'on';
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
    if (!live) return;
    if (e.key === 'Escape') select(-1);
    if (e.key === 'ArrowRight') select((selected + 1 + BODIES.length) % BODIES.length);
    if (e.key === 'ArrowLeft') select((selected - 1 + BODIES.length) % BODIES.length);
    if (e.key === 'r' || e.key === 'R') replay();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) AUDIO.suspend();
    else { AUDIO.resume(); last = performance.now(); }
  });

  // Type out the question on the intro screen.
  let typeTimer = 0;
  function typeQuestion() {
    clearTimeout(typeTimer);
    const full = ui.question.dataset.text;
    let n = 0;
    ui.question.textContent = '';
    const tick = () => {
      n++;
      ui.question.textContent = full.slice(0, n);
      if (n < full.length) typeTimer = setTimeout(tick, full[n - 1] === ' ' ? 90 : 55 + Math.random() * 50);
      else ui.intro.classList.add('typed');
    };
    typeTimer = setTimeout(tick, 900);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  // Test hooks: jump the film, pick a world, or scrub its story.
  window.__cosmos = {
    seek(s) { if (mode !== 'play') begin(); t = s; oc = s; mcl = s; scriptCamera(Math.min(s, T_LIVE)); },
    select,
    storyAt(s) { if (story) story.st = s; },
    quality: () => quality,
  };

  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildAtlas);
  typeQuestion();
  requestAnimationFrame(frame);
})();
