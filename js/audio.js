// Synthesised soundtrack: everything is generated with WebAudio, no files.
// Times passed to playFrom() match the animation timeline in main.js.
window.CosmosAudio = (() => {
  let ac = null, master = null, noise = null;
  let muted = false;
  let live = [];   // nodes from the current run, stopped on replay/skip

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(comp);
      comp.connect(ac.destination);
      const len = ac.sampleRate * 3;
      noise = ac.createBuffer(1, len, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }

  function track(n) { live.push(n); return n; }

  function gain(v = 0) {
    const g = track(ac.createGain());
    g.gain.value = v;
    return g;
  }

  function osc(type, freq, dest, t0, t1) {
    const o = track(ac.createOscillator());
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    o.start(t0);
    if (t1) o.stop(t1);
    return o;
  }

  function noiseSrc(dest, t0, t1) {
    const s = track(ac.createBufferSource());
    s.buffer = noise;
    s.loop = true;
    s.connect(dest);
    s.start(t0);
    if (t1) s.stop(t1);
    return s;
  }

  function filter(type, freq, q = 0.7) {
    const f = track(ac.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  function stopAll() {
    const now = ac ? ac.currentTime : 0;
    for (const n of live) {
      try {
        if (n.gain) { n.gain.cancelScheduledValues(now); n.gain.setTargetAtTime(0, now, 0.05); }
        if (n.stop) n.stop(now + 0.3);
      } catch (e) { /* already stopped */ }
    }
    const old = live;
    live = [];
    setTimeout(() => old.forEach(n => { try { n.disconnect(); } catch (e) {} }), 600);
  }

  // Ambient pad that plays under the finished solar system.
  function pad(t0) {
    const bus = gain(0);
    const lp = filter('lowpass', 900);
    bus.connect(lp); lp.connect(master);
    bus.gain.setValueAtTime(0, t0);
    bus.gain.linearRampToValueAtTime(0.16, t0 + 5);
    [110, 164.81, 220, 277.18, 329.63].forEach((f, i) => {
      const g = gain(0.22 - i * 0.03);
      g.connect(bus);
      osc(i % 2 ? 'triangle' : 'sine', f * (1 + (i - 2) * 0.0015), g, t0);
      const depth = gain(0.1);
      depth.connect(g.gain);
      osc('sine', 0.05 + i * 0.031, depth, t0);
    });
  }

  // The full cinematic soundtrack, starting at timeline t = 0.
  function playFrom0(TB) {
    const t0 = ac.currentTime + 0.05;
    const at = s => t0 + s;

    // Low drone of the void.
    const drone = gain(0);
    const dlp = filter('lowpass', 320);
    drone.connect(dlp); dlp.connect(master);
    osc('sine', 55, drone, t0, at(TB));
    osc('triangle', 55.35, drone, t0, at(TB));
    osc('sine', 82.4, drone, t0, at(TB));
    drone.gain.setValueAtTime(0, t0);
    drone.gain.linearRampToValueAtTime(0.22, at(3));
    drone.gain.linearRampToValueAtTime(0.3, at(8.3));
    drone.gain.linearRampToValueAtTime(0.0001, at(TB - 0.35));

    // Glassy shimmer when the spark appears.
    const shim = gain(0);
    shim.connect(master);
    [880, 1318.5, 1760].forEach(f => osc('sine', f, shim, at(3.8), at(TB)));
    shim.gain.setValueAtTime(0, at(3.8));
    shim.gain.linearRampToValueAtTime(0.025, at(5.4));
    shim.gain.linearRampToValueAtTime(0.04, at(8.4));
    shim.gain.linearRampToValueAtTime(0, at(TB - 0.4));

    // Tension riser while the hand closes.
    const rise = gain(0);
    const bp = filter('bandpass', 180, 2.5);
    rise.connect(master);
    bp.connect(rise);
    noiseSrc(bp, at(6.8), at(TB));
    bp.frequency.setValueAtTime(180, at(6.8));
    bp.frequency.exponentialRampToValueAtTime(3200, at(TB - 0.4));
    rise.gain.setValueAtTime(0, at(6.8));
    rise.gain.linearRampToValueAtTime(0.22, at(TB - 0.45));
    rise.gain.linearRampToValueAtTime(0, at(TB - 0.35));

    // The bang: a crack, a roar and a sub drop.
    const crack = gain(0);
    const hp = filter('highpass', 1800);
    hp.connect(crack); crack.connect(master);
    noiseSrc(hp, at(TB), at(TB + 0.5));
    crack.gain.setValueAtTime(0.7, at(TB));
    crack.gain.exponentialRampToValueAtTime(0.001, at(TB + 0.45));

    const roar = gain(0);
    const rlp = filter('lowpass', 2400);
    rlp.connect(roar); roar.connect(master);
    noiseSrc(rlp, at(TB), at(TB + 7));
    rlp.frequency.setValueAtTime(2400, at(TB));
    rlp.frequency.exponentialRampToValueAtTime(90, at(TB + 5));
    roar.gain.setValueAtTime(1.0, at(TB));
    roar.gain.exponentialRampToValueAtTime(0.001, at(TB + 6.5));

    const sub = gain(0);
    sub.connect(master);
    const so = osc('sine', 72, sub, at(TB), at(TB + 6));
    so.frequency.setValueAtTime(72, at(TB));
    so.frequency.exponentialRampToValueAtTime(26, at(TB + 4));
    sub.gain.setValueAtTime(0.95, at(TB));
    sub.gain.exponentialRampToValueAtTime(0.001, at(TB + 5.5));

    pad(at(TB + 2.2));
  }

  return {
    start(TB) {
      if (!ensure()) return;
      stopAll();
      playFrom0(TB);
    },
    skip() {
      if (!ensure()) return;
      stopAll();
      pad(ac.currentTime + 0.05);
    },
    blip(pitch = 1) {
      if (!ac || muted) return;
      const t0 = ac.currentTime;
      const g = ac.createGain();
      g.connect(master);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      [1, 1.5].forEach(m => {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.value = 520 * pitch * m;
        o.connect(g);
        o.start(t0);
        o.stop(t0 + 1);
      });
    },
    setMuted(m) {
      muted = m;
      if (ac) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.08);
    },
    get muted() { return muted; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
})();
