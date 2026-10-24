// quantum_ascii: typed history, a big bang, and a 3D solar system you can
// orbit, all drawn as coloured ASCII characters on one canvas.
//
// Every frame the scene is "lit" into a per-cell buffer (brightness, tint,
// depth), then each cell is stamped with a glyph from a pre-rendered atlas.
// The film is a pure function of the timeline `t` with seeded randomness,
// so every replay is the same.
(() => {
  'use strict';

  const DATA = window.COSMOS_DATA;
  const AUDIO = window.CosmosAudio;

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);
  const ui = {
    intro: $('intro'), question: $('question'), begin: $('begin'),
    caption: $('caption'), captionText: $('caption-text'), flash: $('flash'),
    skip: $('skip'), replay: $('replay'), sound: $('sound'),
    info: $('info'), infoName: $('info-name'), infoAge: $('info-age'), infoFact: $('info-fact'),
    infoBack: $('info-back'), hover: $('hover'),
  };

  // ---------------------------------------------------------------- timeline
  const TB = 14.4;          // the bang
  const T_LIVE = TB + 15;   // solar system formed, camera handed to the viewer
  const CPS = 26;           // typing speed, characters per second
  const LINES = [
    [0.8, 4.4, '13.8 billion years ago, there was no space and no time.'],
    [4.8, 8.6, 'everything that would ever exist was packed into a single point.'],
    [9.0, 12.0, 'smaller than an atom. hotter than anything since.'],
    [12.4, TB, 'then it began to expand.'],
    [TB + 2.6, TB + 6.6, 'the universe cooled. atoms formed, then stars, then galaxies.'],
    [TB + 7.0, TB + 10.8, '9.2 billion years later, a cloud of gas collapsed and the sun ignited.'],
    [TB + 11.2, TB + 14.8, 'the worlds took shape around it.'],
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

  // ---------------------------------------------------------------- palette
  const TINT_LIST = [
    ['STAR', [208, 212, 226]], ['DUST', [112, 118, 148]], ['LIGHT', [255, 247, 222]],
    ['SUN', [255, 226, 112]], ['SUN2', [255, 176, 48]], ['CORONA', [255, 124, 32]],
    ['MERCURY', [176, 166, 156]], ['VENUS', [232, 198, 138]], ['EARTH', [78, 140, 255]],
    ['LAND', [96, 196, 120]], ['MARS', [228, 102, 60]], ['JUP', [214, 164, 116]],
    ['JUP2', [244, 220, 186]], ['JUPSPOT', [222, 96, 64]], ['SAT', [230, 204, 146]],
    ['RING', [198, 178, 138]], ['URANUS', [150, 224, 232]], ['NEPTUNE', [76, 112, 248]],
    ['PLUTO', [206, 180, 156]], ['FLASH', [255, 255, 255]], ['EMBER', [255, 124, 58]],
    ['BLUE', [132, 170, 255]], ['ORBIT', [150, 150, 182]], ['ACCENT', [235, 232, 220]],
    ['ICE', [236, 244, 255]],
  ];
  const T = {};
  TINT_LIST.forEach(([k], i) => (T[k] = i));
  const RAMPS = [' .,:;-~=+*oxX#%@', " `':;~-=+*aoO8&@"];
  const FONT = '"JetBrains Mono", "Courier New", monospace';

  // ---------------------------------------------------------------- bodies
  const SUN = DATA.sun;
  const PLANETS = DATA.planets.map(p => ({
    ...p,
    w: 0.5 / Math.pow(p.orbit / 22, 1.5),
    spin: 0.15 + 0.6 / p.radius,
    tintId: T[p.tint],
  }));
  const BODIES = [SUN, ...PLANETS];
  const RING_N = [0, Math.cos(0.47), Math.sin(0.47)]; // Saturn's ring plane, tilted ~27°

  function planetPos(p, oc) {
    const a = p.phase + oc * p.w;
    return [Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit];
  }

  // ---------------------------------------------------------------- grid
  let W = 0, H = 0, DPR = 1, cw = 7, ch = 13, cols = 0, rows = 0, N = 0, fontPx = 11;
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
    cols = clamp(Math.round(W / 6.4), 64, 260);
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
  // World point -> camera space, written into V.
  const V = [0, 0, 0];
  function toCam(x, y, z) {
    const dx = x - cam.px, dy = y - cam.py, dz = z - cam.pz;
    V[0] = dx * cam.rx + dy * cam.ry + dz * cam.rz;
    V[1] = dx * cam.ux + dy * cam.uy + dz * cam.uz;
    V[2] = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  }
  // Camera-space direction -> world space, written into Wv.
  const Wv = [0, 0, 0];
  function toWorldDir(x, y, z) {
    Wv[0] = x * cam.rx + y * cam.ux + z * cam.fx;
    Wv[1] = x * cam.ry + y * cam.uy + z * cam.fy;
    Wv[2] = x * cam.rz + y * cam.uz + z * cam.fz;
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

  // ---------------------------------------------------------------- sky
  // Stars sit on the celestial sphere, so they turn with the camera.
  const SKY = (() => {
    const rng = mulberry32(7);
    const s = [];
    for (let n = 0; n < 1700; n++) {
      const z = rng() * 2 - 1, a = rng() * TAU, r = Math.sqrt(1 - z * z);
      const b = 0.12 + Math.pow(rng(), 3.2) * 0.88;
      s.push({ d: [Math.cos(a) * r, z, Math.sin(a) * r], b, ph: rng() * TAU, sp: 0.6 + rng() * 2.4, kind: b > 0.82 ? 2 : 1 });
    }
    // Milky way: a band around a tilted great circle.
    let nx = 0.88, ny = 0.3, nz = 0.36;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    let ax = ny, ay = -nx;
    const al = Math.hypot(ax, ay); ax /= al; ay /= al;
    const bx = -nz * ay, by = nz * ax, bz = nx * ay - ny * ax;
    for (let n = 0; n < 4200; n++) {
      const a = rng() * TAU;
      const g = (rng() + rng() + rng() - 1.5) * 0.16;
      let x = Math.cos(a) * ax + Math.sin(a) * bx + nx * g;
      let y = Math.cos(a) * ay + Math.sin(a) * by + ny * g;
      let z = Math.sin(a) * bz + nz * g;
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const clump = fbm(a * 3, g * 20 + 4);
      s.push({ d: [x, y, z], b: (0.03 + 0.2 * clump * clump) * (1 - Math.abs(g) * 3), ph: 0, sp: 0, kind: 0 });
    }
    // A distant galaxy.
    for (let n = 0; n < 260; n++) {
      const r = Math.pow(rng(), 1.6) * 0.05, a = rng() * TAU;
      const x = -0.55 + Math.cos(a) * r * 2.2, y = 0.45 + Math.sin(a) * r, z = -0.7;
      const l = Math.hypot(x, y, z);
      s.push({ d: [x / l, y / l, z / l], b: 0.38 * (1 - r / 0.05), ph: 0, sp: 0, kind: 0 });
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
      if (s.kind === 0) { maxL(k, s.b * alpha, T.DUST); continue; }
      const v = s.b * (0.62 + 0.38 * Math.sin(time * s.sp + s.ph)) * alpha;
      addL(k, v, T.STAR);
      if (s.kind === 2) {
        const i = k % cols, side = v * 0.32;
        if (i > 0) addL(k - 1, side, T.STAR);
        if (i < cols - 1) addL(k + 1, side, T.STAR);
      }
    }
  }

  // ---------------------------------------------------------------- the point
  // Before the bang: one point of light in the dark, slowly gathering.
  const MOTES = (() => {
    const rng = mulberry32(99), m = [];
    for (let n = 0; n < 200; n++) {
      m.push({ r0: 0.25 + rng() * 0.6, a0: rng() * TAU, t0: 3 + rng() * (TB - 5), dur: 1.6 + rng() * 2, spin: 2 + rng() * 3, b: 0.15 + rng() * 0.3 });
    }
    return m;
  })();

  function drawSingularity(t) {
    const implode = smooth(TB - 0.4, TB - 0.06, t);
    const grow = smooth(0.3, TB - 0.6, t);
    toCam(0, 0, 0);
    const sx = L.cx + (V[0] * L.F) / V[2], sy = L.cy - (V[1] * L.F) / V[2];
    const flick = 0.82 + 0.18 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
    const I = (0.25 + 0.75 * grow) * flick * (1 - implode * 0.85);
    const rad = (cw * 0.7 + cw * 3.5 * grow) * (1 - implode * 0.9);
    const ext = Math.max(W, H) * 0.5;
    const i0 = clamp(((sx - ext) / cw) | 0, 0, cols - 1), i1 = clamp(((sx + ext) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((sy - ext * 0.6) / ch) | 0, 0, rows - 1), j1 = clamp(((sy + ext * 0.6) / ch) | 0, 0, rows - 1);
    const flare = grow * (1 - implode) * 0.5;
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - sy, ady = Math.abs(dy);
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - sx, adx = Math.abs(dx);
        const d2 = dx * dx + dy * dy;
        let v = I / (1 + d2 / (rad * rad));
        v += flare * Math.exp(-ady / (ch * 0.5)) * Math.exp(-adx / (ext * 0.5));
        v += flare * 0.6 * Math.exp(-adx / (cw * 0.7)) * Math.exp(-ady / (ext * 0.3));
        if (v > 0.035) addL(j * cols + i, v, T.LIGHT);
      }
    }
    // dust drawn inward toward the point
    const span = Math.min(W, H);
    for (const m of MOTES) {
      const p = (t - m.t0) / m.dur;
      if (p < 0 || p > 1) continue;
      const e = p * p, r = m.r0 * span * (1 - e), a = m.a0 + e * m.spin;
      const k = cellAt(sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.75);
      if (k >= 0) addL(k, Math.sin(p * Math.PI) * m.b * (1 - implode), p > 0.6 ? T.LIGHT : T.ICE);
    }
  }

  // ---------------------------------------------------------------- big bang
  const PART = (() => {
    const rng = mulberry32(1337);
    const n = 3200;
    const weights = PLANETS.map(p => Math.pow(p.radius, 0.6));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const P = {
      n, dx: new Float32Array(n), dy: new Float32Array(n), dz: new Float32Array(n), spd: new Float32Array(n),
      a0: new Float32Array(n), dur: new Float32Array(n), group: new Int8Array(n),
      jx: new Float32Array(n), jy: new Float32Array(n), jz: new Float32Array(n),
      bf: new Float32Array(n), ba: new Float32Array(n), by: new Float32Array(n), bb: new Float32Array(n),
      hot: new Uint8Array(n), turns: new Uint8Array(n),
    };
    for (let i = 0; i < n; i++) {
      const u = rng();
      let g;
      if (u < 0.28) g = -2;
      else if (u < 0.6) {
        let r = rng() * wsum; g = 0;
        while (g < PLANETS.length - 1 && r > weights[g]) { r -= weights[g]; g++; }
      } else if (u < 0.76) g = -3;
      else g = -1;
      P.group[i] = g;
      const z = rng() * 2 - 1, a = rng() * TAU, rr = Math.sqrt(1 - z * z);
      P.dx[i] = Math.cos(a) * rr; P.dy[i] = z; P.dz[i] = Math.sin(a) * rr;
      P.spd[i] = g === -1 ? 1.6 + rng() * 1.8 : 0.2 + Math.pow(rng(), 0.7) * 1.1;
      if (g === -2) { P.a0[i] = 3.0 + rng() * 2.0; P.dur[i] = 2.0 + rng() * 1.2; }
      else if (g >= 0) { P.a0[i] = 4.5 + rng() * 2.0; P.dur[i] = 2.5 + rng() * 1.2; }
      else { P.a0[i] = 5.0 + rng() * 2.0; P.dur[i] = 2.5 + rng() * 1.5; }
      const jz = rng() * 2 - 1, ja = rng() * TAU, jr = Math.cbrt(rng());
      P.jx[i] = Math.cos(ja) * jr * Math.sqrt(1 - jz * jz); P.jy[i] = jz * jr; P.jz[i] = Math.sin(ja) * jr * Math.sqrt(1 - jz * jz);
      P.bf[i] = 55 + rng() * 9; P.ba[i] = rng() * TAU; P.by[i] = (rng() - 0.5) * 2.5; P.bb[i] = 0.12 + rng() * 0.24;
      const h = rng();
      P.hot[i] = h < 0.45 ? T.EMBER : h < 0.75 ? T.BLUE : T.LIGHT;
      P.turns[i] = rng() < 0.5 ? 1 : 0;
    }
    return P;
  })();

  const beltW = r => 0.5 / Math.pow(r / 22, 1.5);
  const planetAlpha = (k, t) => smooth(TB + 8.5 + k * 0.25, TB + 10.5 + k * 0.25, t);
  const sunAlpha = t => smooth(TB + 6.5, TB + 9.2, t);
  const orbitAlpha = t => smooth(TB + 10, TB + 12.5, t);
  function wrap0(a) { a %= TAU; return a < 0 ? a + TAU : a; }

  function drawParticles(t, oc) {
    const tau = t - TB;
    const P = PART, K = 1.4;
    const e = ((1 - Math.exp(-K * tau)) / K) * 120;
    const heat = Math.exp(-tau * 0.7);
    const sA = sunAlpha(t);
    const pas = PLANETS.map((p, k) => planetAlpha(k, t));
    for (let i = 0; i < P.n; i++) {
      const g = P.group[i];
      const ex = P.dx[i] * P.spd[i] * e, ey = P.dy[i] * P.spd[i] * e, ez = P.dz[i] * P.spd[i] * e;
      if (g === -1) {
        const v = 1.1 * Math.exp(-tau * 0.55);
        if (v > 0.03) splat(ex, ey, ez, v, tau < 0.9 ? T.FLASH : P.hot[i]);
        continue;
      }
      const w = smooth(P.a0[i], P.a0[i] + P.dur[i], tau);
      let tx, ty, tz, angNow, angStart, tint, v = 0.35 + 0.65 * heat;
      if (g === -2) {
        const s = SUN.radius * 0.7;
        tx = P.jx[i] * s; ty = P.jy[i] * s; tz = P.jz[i] * s;
        angNow = angStart = Math.atan2(tz, tx);
        tint = T.SUN;
        v *= 1 - sA * smooth(0.85, 1, w);
      } else if (g === -3) {
        const om = beltW(P.bf[i]);
        angNow = P.ba[i] + oc * om; angStart = P.ba[i] + om * (TB + P.a0[i]);
        tx = Math.cos(angNow) * P.bf[i]; ty = P.by[i]; tz = Math.sin(angNow) * P.bf[i];
        tint = T.DUST;
        v = lerp(v, P.bb[i], w);
      } else {
        const p = PLANETS[g];
        angNow = p.phase + oc * p.w; angStart = p.phase + p.w * (TB + P.a0[i]);
        const spread = p.radius * 3.5 * (1 - w) + p.radius * 0.6;
        tx = Math.cos(angNow) * p.orbit + P.jx[i] * spread;
        ty = P.jy[i] * spread;
        tz = Math.sin(angNow) * p.orbit + P.jz[i] * spread;
        tint = p.tintId;
        v *= 1 - pas[g] * smooth(0.85, 1, w);
      }
      if (v < 0.03) continue;
      // Spiral from the explosion into the disk (cylindrical interpolation).
      const rE = Math.hypot(ex, ez), thE = Math.atan2(ez, ex);
      const rT = Math.hypot(tx, tz);
      const th = g === -2
        ? thE + w * wrap0(angStart - thE)
        : thE + w * (wrap0(angStart - thE) + TAU * P.turns[i] + (angNow - angStart));
      const r = lerp(rE, rT, w);
      const tn = tau < 0.9 ? T.FLASH : w > 0.55 ? tint : P.hot[i];
      splat(Math.cos(th) * r, lerp(ey, ty, w), Math.sin(th) * r, v, tn, g === -3 && w > 0.9);
    }
  }

  const SHELL = (() => { // fibonacci sphere for the shockwave
    const n = 1100, pts = new Float32Array(n * 3), ga = Math.PI * (3 - Math.sqrt(5));
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
    for (let s = 0; s < 700; s++) {
      const a = (s / 700) * TAU;
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
    const tau = t - TB;
    const core = Math.exp(-tau * 0.5) * (1 - sunAlpha(t));
    if (f < 0.015 && core < 0.02) return;
    toCam(0, 0, 0);
    const sx = L.cx + (V[0] * L.F) / V[2], sy = L.cy - (V[1] * L.F) / V[2];
    const coreR = (SUN.radius * 1.4 * L.F) / V[2];
    const span = 0.6 * Math.max(W, H);
    for (let j = 0, k = 0; j < rows; j++) {
      const dy = (j + 0.5) * ch - sy;
      for (let i = 0; i < cols; i++, k++) {
        const dx = (i + 0.5) * cw - sx;
        const dp = Math.sqrt(dx * dx + dy * dy);
        let v = f > 0.015 ? f * (1.2 - 0.8 * Math.min(1, dp / span)) : 0;
        v += (core * 0.95) / (1 + (dp * dp) / (coreR * coreR));
        if (v > 0.03) addL(k, v, tau > 2 ? T.SUN : T.FLASH);
      }
    }
  }

  // ---------------------------------------------------------------- bodies
  // Ray-cast a sphere (and an optional ring) from its camera-space centre.
  // shade(k, nx, ny, nz, Px, Py, Pz) runs for every visible sphere cell.
  let ringAlpha = 1;
  function castSphere(cx3, cy3, cz3, r, shade, ring) {
    const ext = ring ? r * 2.35 : r;
    if (cz3 < ext * 1.02 + 0.5) return null;
    const F = L.F;
    const sr = (ext * F) / Math.sqrt(cz3 * cz3 - ext * ext);
    const scx = L.cx + (cx3 * F) / cz3, scy = L.cy - (cy3 * F) / cz3;
    const hit = { sx: scx, sy: scy, sr: (r * F) / cz3 };
    if (scx + sr < 0 || scx - sr > W || scy + sr < 0 || scy - sr > H) return hit;
    const i0 = clamp(((scx - sr) / cw) | 0, 0, cols - 1), i1 = clamp(((scx + sr) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((scy - sr) / ch) | 0, 0, rows - 1), j1 = clamp(((scy + sr) / ch) | 0, 0, rows - 1);
    const cc = cx3 * cx3 + cy3 * cy3 + cz3 * cz3 - r * r;
    let rnx = 0, rny = 0, rnz = 0, rd = 0;
    if (ring) {
      rnx = ring[0] * cam.rx + ring[1] * cam.ry + ring[2] * cam.rz;
      rny = ring[0] * cam.ux + ring[1] * cam.uy + ring[2] * cam.uz;
      rnz = ring[0] * cam.fx + ring[1] * cam.fy + ring[2] * cam.fz;
      rd = cx3 * rnx + cy3 * rny + cz3 * rnz;
    }
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
              const q = Math.sqrt(qx * qx + qy * qy + qz * qz) / r;
              if (q > 1.32 && q < 2.3 && !(q > 1.8 && q < 1.9)) {
                zbuf[k] = tp;
                setL(k, (0.4 + 0.2 * Math.sin(q * 22)) * ringAlpha, T.RING);
                continue;
              }
            }
          }
        }
        if (ts === Infinity || ts >= zbuf[k]) continue;
        zbuf[k] = ts;
        const Px = dx * ts, Py = dy * ts, Pz = ts;
        shade(k, (Px - cx3) / r, (Py - cy3) / r, (Pz - cz3) / r, Px, Py, Pz);
      }
    }
    return hit;
  }

  let sunCam = [0, 0, 0];
  function drawSun(time, alpha) {
    if (alpha <= 0.005) return null;
    const r = SUN.radius * (0.35 + 0.65 * easeOut3(alpha));
    const [cx3, cy3, cz3] = sunCam;
    const hit = castSphere(cx3, cy3, cz3, r, (k, nx, ny, nz, Px, Py, Pz) => {
      toWorldDir(nx, ny, nz);
      const wx = Wv[0], wy = Wv[1], wz = Wv[2];
      const g = fbm3(wx * 2.6 + time * 0.1, wy * 2.6 - time * 0.08, wz * 2.6) * 0.6 + noise3(wx * 6 - time * 0.2, wy * 6, wz * 6 + time * 0.15) * 0.4;
      const mu = -(nx * Px + ny * Py + nz * Pz) / Math.sqrt(Px * Px + Py * Py + Pz * Pz); // limb darkening
      const v = ((0.78 + 0.6 * (g - 0.45)) * (0.6 + 0.4 * mu) + 0.22) * alpha;
      setL(k, v, mu < 0.4 || g < 0.4 ? T.SUN2 : T.SUN);
    });
    if (!hit) return null;
    // corona, only where nothing solid sits in front of it
    const sr = hit.sr, G = sr * 3.4, sunZ = cz3 - r;
    const i0 = clamp(((hit.sx - G) / cw) | 0, 0, cols - 1), i1 = clamp(((hit.sx + G) / cw) | 0, 0, cols - 1);
    const j0 = clamp(((hit.sy - G) / ch) | 0, 0, rows - 1), j1 = clamp(((hit.sy + G) / ch) | 0, 0, rows - 1);
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - hit.sy;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - hit.sx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= sr) continue;
        const k = j * cols + i;
        if (zbuf[k] < sunZ) continue;
        const e = d / sr - 1, ca = dx / d, sa = dy / d;
        const rays = 0.5 + 0.5 * fbm(ca * 2.2 + time * 0.05 + 11, sa * 2.2 - e * 1.4 + time * 0.25);
        const v = alpha * (0.6 * Math.exp(-e * 4.2) * rays + 0.13 * Math.exp(-e * 1.9));
        if (v > 0.03) addL(k, v, e < 0.2 ? T.SUN2 : T.CORONA);
      }
    }
    return hit;
  }

  function drawPlanet(p, pos, alpha, time) {
    if (alpha <= 0.005) return null;
    const r = p.radius * (0.2 + 0.8 * alpha);
    toCam(pos[0], pos[1], pos[2]);
    const spin = time * p.spin;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const amb = 0.16;
    ringAlpha = alpha;
    return castSphere(V[0], V[1], V[2], r, (k, nx, ny, nz, Px, Py, Pz) => {
      // light from the sun
      let lx = sunCam[0] - Px, ly = sunCam[1] - Py, lz = sunCam[2] - Pz;
      const ll = Math.sqrt(lx * lx + ly * ly + lz * lz); lx /= ll; ly /= ll; lz /= ll;
      let sh = nx * lx + ny * ly + nz * lz;
      sh = sh > 0 ? sh : 0;
      let v = amb + (1 - amb) * Math.pow(sh, 0.75);
      let tint = p.tintId;
      toWorldDir(nx, ny, nz);
      // rotate the surface with the planet's spin
      const x = Wv[0] * cs - Wv[2] * sn, y = Wv[1], z = Wv[0] * sn + Wv[2] * cs;
      switch (p.key) {
        case 'earth':
          if (fbm3(x * 1.8 + 3, y * 1.8, z * 1.8) > 0.55) tint = T.LAND;
          if (fbm3(x * 2.6 - time * 0.04, y * 3.2 + 7, z * 2.6) > 0.66) { tint = T.STAR; v *= 1.08; }
          if (Math.abs(y) > 0.86) tint = T.ICE;
          break;
        case 'jupiter': {
          const b = Math.sin(y * 11 + (fbm3(x * 1.5, y * 4, z * 1.5) - 0.5) * 3);
          tint = b > 0.15 ? T.JUP2 : T.JUP;
          v *= 0.85 + 0.15 * b;
          const lon = Math.atan2(x, z) - 1.2;
          const dl = Math.atan2(Math.sin(lon), Math.cos(lon));
          if ((y + 0.32) * (y + 0.32) / 0.012 + (dl * dl) / 0.1 < 1) tint = T.JUPSPOT;
          break;
        }
        case 'saturn':
          tint = Math.sin(y * 9 + fbm3(x, y * 3, z) * 1.5) > 0.45 ? T.JUP2 : T.SAT;
          break;
        case 'mars':
          v *= 0.8 + 0.3 * fbm3(x * 2, y * 2, z * 2);
          if (Math.abs(y) > 0.86) tint = T.ICE;
          break;
        case 'venus': v *= 0.85 + 0.25 * fbm3(x * 1.4 + time * 0.03, y * 5, z * 1.4); break;
        case 'pluto': if (fbm3(x * 1.8 + 2, y * 1.8, z * 1.8) > 0.6) tint = T.ICE; break;
        default: v *= 0.82 + 0.3 * fbm3(x * 2 + 4, y * 3, z * 2);
      }
      setL(k, v * alpha, tint);
    }, p.key === 'saturn' ? RING_N : null);
  }

  function drawOrbits(alpha, selKey) {
    if (alpha <= 0.01) return;
    for (const p of PLANETS) {
      const sel = p.key === selKey;
      const n = clamp(Math.ceil((TAU * p.orbit * L.F) / Math.max(cam.dist, 20) / (cw * 0.9)), 120, 3000);
      const v = alpha * (sel ? 0.42 : 0.22);
      for (let s = 0; s < n; s++) {
        const a = (s / n) * TAU;
        splat(Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit, v * (s % 2 ? 1 : 0.6), sel ? T.ACCENT : T.ORBIT, true);
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
      const k = cellAt(x0 + Math.cos(ang) * sp * q, y0 + Math.sin(ang) * sp * q * 0.5);
      if (k >= 0 && zbuf[k] === 1e9) addL(k, (1 - s / 18) * Math.sin(p * Math.PI) * 0.9, s < 3 ? T.ICE : T.BLUE);
    }
  }

  // ---------------------------------------------------------------- frame
  let mode = 'intro';            // intro | play
  let t = 0, oc = 0, idle = 0;
  let orbitSpeed = 1;
  let selected = -1, hovered = -1;
  let live = false;
  let hits = [];
  let lastInput = -1e9;
  let dragging = false;

  // Where the film puts the camera before the viewer takes over.
  function scriptCamera(time) {
    cam.yaw = cam.yawT = 0.7 + time * 0.035;
    cam.pitch = cam.pitchT = lerp(0.24, 0.42, smooth(TB, T_LIVE, time));
    cam.dist = cam.distT = lerp(380, L.home, easeInOut(smooth(TB + 10.5, T_LIVE - 0.2, time)));
    cam.tx = cam.ty = cam.tz = 0;
  }

  function render() {
    lum.fill(0); str.fill(0); zbuf.fill(1e9);
    hits = [];
    setupCamera();
    toCam(0, 0, 0);
    sunCam = [V[0], V[1], V[2]];

    if (mode === 'intro') {
      drawSky(0.4, idle, false);
    } else if (t < TB) {
      drawSky(0.4 * (1 - smooth(0, 2.2, t)), t, false);
      drawSingularity(t);
    } else {
      const sh = drawSun(t, sunAlpha(t));
      if (sh) hits.push({ body: 0, x: sh.sx, y: sh.sy, r: sh.sr, z: sunCam[2] });
      PLANETS.forEach((p, k) => {
        const pos = planetPos(p, oc);
        const hit = drawPlanet(p, pos, planetAlpha(k, t), t);
        if (hit) {
          toCam(pos[0], pos[1], pos[2]);
          hits.push({ body: k + 1, x: hit.sx, y: hit.sy, r: hit.sr * (p.key === 'saturn' ? 1.8 : 1), z: V[2] });
        }
      });
      drawSky(0.02 + 0.98 * smooth(TB + 1.5, TB + 6, t), t, true);
      drawOrbits(orbitAlpha(t), selected > 0 ? PLANETS[selected - 1].key : null);
      drawParticles(t, oc);
      drawShockwave(t);
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
  let lastLine = -1, lastTyped = 0, lastText = null;
  function updateOverlay() {
    // typed history lines, with a key click per new character
    let text = '', op = 0, typing = false, idx = -1, n = 0;
    if (mode === 'play') {
      LINES.forEach(([a, b, s], i) => {
        if (t >= a && t < b) {
          idx = i;
          n = Math.min(s.length, Math.floor((t - a) * CPS));
          text = s.slice(0, n);
          typing = n < s.length;
          op = b === TB ? 1 : 1 - smooth(b - 0.6, b, t);
        }
      });
    }
    if (idx >= 0 && idx === lastLine && n > lastTyped && text[n - 1] !== ' ') AUDIO.click();
    lastLine = idx; lastTyped = n;
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
    }
    if (amp > 0.2) {
      const sx = amp * (Math.sin(t * 83.1) + Math.sin(t * 47.3) * 0.6) / 1.6;
      const sy = amp * (Math.cos(t * 71.7) + Math.sin(t * 39.1) * 0.6) / 1.6;
      canvas.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    } else if (canvas.style.transform) canvas.style.transform = '';

    const nowLive = mode === 'play' && t >= T_LIVE;
    if (nowLive !== live) {
      live = nowLive;
      document.body.classList.toggle('live', live);
      canvas.style.cursor = live ? 'grab' : '';
      if (!live) { select(-1); setHover(-1); }
    }
    document.body.classList.toggle('playing', mode === 'play' && !live);
    document.body.classList.toggle('touched', live && lastInput > 0);

    if (hovered >= 0 && hovered !== selected && live) {
      const h = hits.find(x => x.body === hovered);
      if (h) ui.hover.style.transform = `translate(${(h.x + Math.max(h.r, 8) + 10).toFixed(1)}px, ${(h.y - 8).toFixed(1)}px)`;
      else setHover(-1);
    }
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
    return selected > 0 ? PLANETS[selected - 1].radius * 2.6 : SUN.radius * 2.2;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    idle += dt;
    if (mode === 'play') {
      t += dt;
      if (t < T_LIVE) { oc = t; scriptCamera(t); }
      else {
        const target = selected >= 0 ? 0.25 : 1;
        orbitSpeed += (target - orbitSpeed) * Math.min(1, dt * 2.5);
        oc += dt * orbitSpeed;
        updateCamera(dt);
      }
    } else scriptCamera(0);
    render();
    updateOverlay();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- interaction
  function begin() {
    if (mode === 'play') return;
    mode = 'play';
    t = 0; oc = 0; orbitSpeed = 1;
    lastLine = -1; lastTyped = 0;
    ui.intro.classList.add('gone');
    if (!AUDIO.muted) AUDIO.start(TB);
  }

  // Replay always returns to the opening question.
  function replay() {
    select(-1); setHover(-1);
    AUDIO.stop();
    mode = 'intro';
    t = 0; oc = 0; orbitSpeed = 1; lastInput = -1e9;
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
    t = T_LIVE; oc = T_LIVE;
    scriptCamera(T_LIVE);
    if (!AUDIO.muted) AUDIO.skip();
  }

  function hitTest(x, y) {
    let best = -1, bestZ = Infinity;
    for (const h of hits) {
      const pad = Math.max(h.r * 1.25, 14);
      if (Math.hypot(x - h.x, y - h.y) < pad && h.z < bestZ) { best = h.body; bestZ = h.z; }
    }
    return best;
  }

  function setHover(b) {
    if (b === hovered) return;
    hovered = b;
    canvas.style.cursor = b >= 0 ? 'pointer' : (live ? 'grab' : '');
    if (b >= 0 && b !== selected) {
      ui.hover.textContent = BODIES[b].name;
      ui.hover.classList.add('on');
    } else ui.hover.classList.remove('on');
  }

  function select(b) {
    selected = b;
    if (b < 0) {
      ui.info.classList.remove('open');
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
    if (b === 0) cam.distT = SUN.radius * 5;
    else {
      const p = PLANETS[b - 1];
      cam.distT = Math.max(p.radius * (p.key === 'saturn' ? 9 : 7), 12);
    }
    if (hovered === b) ui.hover.classList.remove('on');
    AUDIO.blip(1 + b * 0.06);
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
      if (pinch0 > 0 && d > 0) cam.distT = clamp(pinchDist0 * (pinch0 / d), minDist(), 700);
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
      const b = hitTest(e.clientX, e.clientY);
      if (b >= 0) select(b === selected ? -1 : b);
      else if (selected >= 0) select(-1);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (!dragging) setHover(-1); });
  canvas.addEventListener('wheel', e => {
    if (!live) return;
    e.preventDefault();
    lastInput = idle;
    cam.distT = clamp(cam.distT * Math.exp(e.deltaY * 0.0012), minDist(), 700);
  }, { passive: false });

  ui.infoBack.addEventListener('click', () => select(-1));
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

  // Test hook: jump the film to a moment, e.g. __cosmos.seek(20).
  window.__cosmos = {
    seek(s) { if (mode !== 'play') begin(); t = s; oc = s; scriptCamera(Math.min(s, T_LIVE)); },
    select,
  };

  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildAtlas);
  typeQuestion();
  requestAnimationFrame(frame);
})();
