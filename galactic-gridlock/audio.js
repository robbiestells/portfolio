/* Galactic Gridlock prototype: original 16-bit style rock loop, synthesized with WebAudio.
   Genesis-flavoured: 2-operator FM bass and lead, distorted saw power chords, noise drums. 150 BPM, E minor. */
const Music = (() => {
  const BPM = 150, STEP = 60 / BPM / 4;   // one 16th note
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  // guitar riff: [step, semitones above E, length in 16ths]; length 1 = palm-muted chug
  const A1 = [[0,0,1],[1,0,1],[2,0,1],[3,0,1],[4,3,2],[6,0,1],[7,5,3],[10,0,1],[11,0,1],[12,7,2],[14,5,2]];
  const A2 = [[0,0,1],[1,0,1],[2,0,1],[3,0,1],[4,3,2],[6,0,1],[7,5,2],[9,3,1],[10,0,1],[12,10,2],[14,12,2]];
  const B1 = [[0,-4,3],[3,-4,1],[4,-4,1],[6,-4,2],[8,-2,3],[11,-2,1],[12,-2,1],[14,-2,2]];
  const B2 = [[0,-4,3],[3,-4,1],[4,-4,1],[6,-4,2],[8,-2,3],[11,-2,1],[12,3,2],[14,5,2]];
  const SONG = [A1, A2, A1, A2, B1, B2, A1, A2];
  const LEAD = [
    [[0,76,4],[4,74,2],[6,71,2],[8,74,6],[14,76,2]],
    [[0,79,3],[3,76,1],[4,74,4],[8,71,4],[12,69,4]],
    [[0,71,2],[2,74,2],[4,76,6],[10,74,2],[12,71,2],[14,69,2]],
    [[0,67,4],[4,69,4],[8,71,8]],
    [[0,72,4],[4,71,2],[6,67,2],[8,74,6],[14,72,2]],
    [[0,74,4],[4,78,4],[8,81,4],[12,79,4]],
    [[0,76,2],[2,79,2],[4,81,2],[6,79,2],[8,76,4],[12,74,2],[14,71,2]],
    [[0,76,12]]
  ];
  let ctx, master, drive, gtrBus, echo, noiseBuf, timer, step = 0, nextT = 0, comp, sfx;
  const M = { on: true, started: false };

  function setup() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.32; master.connect(comp);
    sfx = ctx.createGain(); sfx.gain.value = 0.55; sfx.connect(comp);
    // guitar: waveshaper distortion into a cab-like lowpass
    drive = ctx.createWaveShaper(); const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
    drive.curve = curve; drive.oversample = '2x';
    const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 2600; cab.Q.value = 0.9;
    const gtrOut = ctx.createGain(); gtrOut.gain.value = 0.24;
    gtrBus = ctx.createGain(); gtrBus.gain.value = 0.5;
    gtrBus.connect(drive); drive.connect(cab); cab.connect(gtrOut); gtrOut.connect(master);
    // lead echo
    echo = ctx.createDelay(1); echo.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const wet = ctx.createGain(); wet.gain.value = 0.25;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const env = (g, t, a, peak, dec, sus = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec); };

  function guitar(t, semi, len) {
    const root = hz(52 + semi), dur = len <= 1 ? STEP * 0.85 : STEP * len * 0.95;
    const g = ctx.createGain(); g.connect(gtrBus);
    env(g, t, 0.004, len <= 1 ? 0.7 : 0.9, dur, len <= 1 ? 0.0001 : 0.3);
    g.gain.setValueAtTime(len <= 1 ? 0.0001 : 0.3, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    for (const [f, det] of [[root, -6], [root * 1.5, 5], [root * 2, 3]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 0.08);
    }
  }
  function fm(t, f, dur, { ratio = 1, index = 2, type = 'sine', vol = 0.3, decay = 0.15, out = master, vib = 0 }) {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = type; car.frequency.value = f; mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * index * 0.15 + 1, t + decay);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out);
    if (vib) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 0; lg.gain.setValueAtTime(0, t + 0.12); lg.gain.linearRampToValueAtTime(f * vib, t + 0.3); lfo.connect(lg); lg.connect(car.frequency); lfo.start(t); lfo.stop(t + dur + 0.1); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    for (const o of [car, mod]) { o.start(t); o.stop(t + dur + 0.08); }
    return g;
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(g, t, 0.002, 0.9, 0.22); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
  }
  function noise(t, dur, type, freq, vol) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; env(g, t, 0.001, vol, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function snare(t) {
    noise(t, 0.16, 'bandpass', 1900, 0.55);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    env(g, t, 0.001, 0.35, 0.09); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
  }

  function schedule(t, i) {
    const bar = Math.floor(i / 16) % 8, s = i % 16, loop = Math.floor(i / 128);
    const riff = SONG[bar];
    for (const [st, semi, len] of riff) if (st === s) {
      guitar(t, semi, len);
      fm(t, hz(40 + semi), STEP * Math.max(1, len) * 0.9, { ratio: 1, index: 3.2, type: 'triangle', vol: 0.38, decay: 0.09 });
    }
    // drums
    if (s === 0 || s === 8 || (s === 10 && bar % 2) || s === 6) kick(t);
    const fill = bar === 7 && s >= 12;
    if (s === 4 || s === 12 || (fill && s > 12)) snare(t);
    if (s % 2 === 0 && !fill) noise(t, s === 14 ? 0.12 : 0.03, 'highpass', 8000, s % 4 === 0 ? 0.16 : 0.1);
    if (s === 0 && bar === 0) noise(t, 0.6, 'highpass', 5000, 0.18);   // crash cymbal
    // lead on every other pass
    if (loop % 2 === 1) for (const [st, m, len] of LEAD[bar]) if (st === s) {
      fm(t, hz(m), STEP * len * 0.95, { ratio: 2, index: 1.6, type: 'sawtooth', vol: 0.09, decay: 0.3, vib: 0.012, out: master }).connect(echo);
    }
  }
  function tick() {
    while (nextT < ctx.currentTime + 0.12) { schedule(nextT, step); nextT += STEP; step++; }
  }
  /* stadium effects for the announcer: an air horn and a crowd roar */
  M.sfx = kind => {
    try {
      if (!ctx) setup(); if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + 0.02;
      if (kind === 'horn') {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.7;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
        g.gain.setValueAtTime(0.35, t + 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
        bp.connect(g); g.connect(sfx);
        for (const f of [233, 294, 349, 466]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.08); o.connect(bp); o.start(t); o.stop(t + 1.05); }
      } else {
        for (const [freq, q, vol] of [[650, 0.6, 0.5], [1700, 0.9, 0.3], [3200, 1.2, 0.12]]) {
          const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
          s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
          f.frequency.setValueAtTime(freq * 0.8, t); f.frequency.linearRampToValueAtTime(freq * 1.15, t + 0.5); f.frequency.linearRampToValueAtTime(freq, t + 2);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.35); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
          s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + 2.5);
        }
      }
    } catch (e) { /* audio unavailable */ }
  };
  M.duck = on => { if (ctx && M.on && master) master.gain.setTargetAtTime(on ? 0.12 : 0.32, ctx.currentTime, 0.12); };
  M.start = () => {
    try {
      if (!ctx) setup();
      if (ctx.state === 'suspended') ctx.resume();
      if (!M.started) { M.started = true; nextT = ctx.currentTime + 0.08; timer = setInterval(tick, 25); }
      M.on = true; master.gain.setTargetAtTime(0.32, ctx.currentTime, 0.05);
    } catch (e) { M.on = false; }
  };
  M.toggle = () => {
    if (!ctx || !M.started) { M.start(); return; }
    M.on = !M.on;
    if (M.on) { ctx.resume(); master.gain.setTargetAtTime(0.32, ctx.currentTime, 0.05); }
    else { master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); setTimeout(() => { if (!M.on) ctx.suspend(); }, 250); }
  };
  document.addEventListener('visibilitychange', () => { if (!ctx || !M.on) return; document.hidden ? ctx.suspend() : ctx.resume(); });
  return M;
})();
