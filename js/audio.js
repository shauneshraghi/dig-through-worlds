// Dig Through Worlds: retro sound effects and a looping tune per world, all made with WebAudio.
// Exposes the global DTWAudio. Call init() from a user gesture; getWorld() picks the tune.
var DTWAudio = (function () {
  'use strict';
  var D = DTW, MUTE_KEY = 'dig-through-worlds-v1-mute';
  var AC = null, master = null, muted = false, musicTimer = null, musicStep = 0, nextNote = 0;
  var getWorld = function () { return 0; };
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

  function prng(seed) { var a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function init(worldFn) {
    if (worldFn) getWorld = worldFn;
    if (AC) { if (AC.state !== 'running') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(AC.destination);
    musicTimer = setInterval(scheduleMusic, 50);
    // Browsers keep a context created outside a real activation (a pointerdown, a ?nosplash=1 load) suspended, so
    // retry on every later gesture until it runs.
    var evs = ['pointerup', 'click', 'touchend', 'keydown'];
    function unlock() {
      if (AC.state === 'running') { evs.forEach(function (n) { document.removeEventListener(n, unlock, true); }); return; }
      AC.resume();
    }
    evs.forEach(function (n) { document.addEventListener(n, unlock, true); });
  }
  function tone(freq, dur, type, vol, when, slide, dest) {
    if (!AC) return; var t0 = when || AC.currentTime;
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!AC) return; var n = AC.sampleRate * dur, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = b; f.type = 'lowpass'; f.frequency.value = freq || 800; g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  var SFX = {
    tap: function () { noise(0.05, 0.08, 1200); tone(140, 0.05, 'square', 0.05); },
    brk: function () { noise(0.12, 0.25, 500); tone(90, 0.1, 'square', 0.08); },
    ding: function () { tone(880, 0.1, 'square', 0.08); tone(1320, 0.15, 'square', 0.08, AC.currentTime + 0.07); },
    fossil: function () { [523, 659, 784].forEach(function (f, i) { tone(f, 0.15, 'triangle', 0.15, AC.currentTime + i * 0.08); }); },
    coin: function () { tone(988, 0.08, 'square', 0.1); tone(1319, 0.25, 'square', 0.1, AC.currentTime + 0.08); },
    trap: function () { tone(600, 0.5, 'sawtooth', 0.12, 0, 0.2); },
    bubble: function () { tone(300, 0.2, 'sine', 0.2, 0, 3); },
    relic: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, 0.25, 'square', 0.12, AC.currentTime + i * 0.13); }); },
    crack: function () { noise(0.1, 0.2, 700); tone(130, 0.08, 'square', 0.08); tone(95, 0.12, 'square', 0.06, AC.currentTime + 0.05); },
    // the quiz: a soft two-note doorbell with a curious rising "hmm?", a cheer, and a gentle wrong-answer sigh
    doorbell: function () { var t = AC.currentTime; tone(784, 0.35, 'sine', 0.12, t); tone(659, 0.45, 'sine', 0.12, t + 0.28); tone(440, 0.3, 'triangle', 0.08, t + 0.8, 1.5); },
    quizyes: function () { var t = AC.currentTime; [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.14, t + i * 0.08); }); for (var c = 0; c < 6; c++) tone(600 + c * 110, 0.3, 'sawtooth', 0.03, t + 0.35 + c * 0.04, 1.5); noise(0.3, 0.08, 3000); },
    quizno: function () { var t = AC.currentTime; tone(392, 0.25, 'sine', 0.1, t); tone(330, 0.4, 'sine', 0.1, t + 0.2); },
    alert: function () { var t = AC.currentTime; tone(1568, 0.1, 'square', 0.12, t); tone(1568, 0.1, 'square', 0.12, t + 0.14); tone(1175, 0.2, 'square', 0.1, t + 0.28); },
    dodge: function () { noise(0.2, 0.15, 3000); tone(300, 0.25, 'sine', 0.18, 0, 4); tone(523, 0.1, 'triangle', 0.14, AC.currentTime + 0.18); tone(784, 0.18, 'triangle', 0.14, AC.currentTime + 0.26); },
    treasure: function () { var t = AC.currentTime; [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.14, t + i * 0.07); tone(f * 2, 0.15, 'sine', 0.05, t + i * 0.07); }); tone(1568, 0.5, 'triangle', 0.12, t + 0.45); },
    // fireworks pops and a cheer over about 6 seconds
    finale: function () {
      var t = AC.currentTime;
      for (var i = 0; i < 14; i++) { var w = t + 0.2 + i * 0.4 + (i % 3) * 0.07; tone(900 + (i * 137) % 700, 0.5, 'sawtooth', 0.05, w, 0.2); tone(110, 0.2, 'sine', 0.2, w + 0.45, 0.4); noise(0.25, 0.22, 1500 + (i % 4) * 500); }
      [523, 659, 784, 1047].forEach(function (f, j) { tone(f, 0.3, 'square', 0.1, t + j * 0.15); });
      [523, 659, 784, 1047, 1319].forEach(function (f) { tone(f, 0.9, 'triangle', 0.1, t + 2.5); });
      for (var c = 0; c < 8; c++) tone(500 + c * 90, 0.35, 'sawtooth', 0.04, t + 3.6 + c * 0.05, 1.6);
    },
    buy: function () { tone(660, 0.08, 'square', 0.1); tone(990, 0.12, 'square', 0.1, AC.currentTime + 0.06); },
    up: function () { tone(200, 0.6, 'triangle', 0.12, 0, 4); },
    down: function () { tone(500, 0.5, 'triangle', 0.1, 0, 0.3); },
    step: function () { tone(220, 0.06, 'triangle', 0.06); },
    click: function () { tone(1200, 0.04, 'square', 0.06); tone(700, 0.05, 'triangle', 0.05, AC.currentTime + 0.03); },
    unlock: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.12, 'square', 0.08, AC.currentTime + i * 0.07); }); },
    no: function () { tone(160, 0.15, 'square', 0.1); },
    // the four gems of the simon chest, a note each
    pad0: function () { tone(523, 0.3, 'triangle', 0.14); }, pad1: function () { tone(659, 0.3, 'triangle', 0.14); },
    pad2: function () { tone(784, 0.3, 'triangle', 0.14); }, pad3: function () { tone(1047, 0.3, 'triangle', 0.14); }
  };
  function sfx(n) { if (AC && !muted && SFX[n]) SFX[n](); }
  // Two moods of music. Overworld: one bright major tune shared by all worlds, keyed by the world's root and wave.
  // Mine: the world's own darker tune, lower, with echo that grows with depth. Each mood has its own bus; a mood
  // switch crossfades the buses (about 1 s) and only the active mood schedules notes.
  var tunes = {}, buses = null, mineDelay = null, mineWet = null, mineLp = null, noiseBuf = null;
  var curMood = '', curDepth = 0, MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var OVER_MEL = [4, -1, 2, 4, 7, -1, 4, 2,   6, -1, 4, 1, 4, -1, 6, 8,   7, -1, 5, 7, 9, -1, 7, 5,   5, -1, 3, 5, 4, 2, 1, 0];
  var OVER_CHORD = [0, 7, 9, 5];
  function mineTune(w) {
    if (tunes[w]) return tunes[w];
    var r = prng(w * 31 + 3), mel = [], deg = 2;
    for (var i = 0; i < 32; i++) { deg = Math.max(0, Math.min(9, deg + Math.floor(r() * 5) - 2)); mel.push(r() < 0.22 ? null : deg); }
    return (tunes[w] = mel);
  }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function readState() {
    var v = getWorld();
    if (typeof v === 'number') return { world: v, mood: 'mine', depth: 0 };
    var w = v && v.world | 0, depth = Math.max(0, Math.min(1, ((v && v.depth) || 0) / (D.DEPTH || 100)));
    return { world: w, mood: v && v.mode === 'surface' ? 'over' : 'mine', depth: depth };
  }
  function makeBuses() {
    var over = AC.createGain(), mine = AC.createGain();
    over.gain.value = 0; mine.gain.value = 0; over.connect(master);
    mineLp = AC.createBiquadFilter(); mineLp.type = 'lowpass'; mineLp.frequency.value = 2400;
    mine.connect(mineLp); mineLp.connect(master);
    mineDelay = AC.createDelay(2); mineDelay.delayTime.value = 0.4;
    var fb = AC.createGain(); fb.gain.value = 0.42; mineWet = AC.createGain(); mineWet.gain.value = 0.2;
    mineLp.connect(mineDelay); mineDelay.connect(fb); fb.connect(mineDelay); mineDelay.connect(mineWet); mineWet.connect(master);
    buses = { over: over, mine: mine };
    var n = Math.floor(AC.sampleRate * 0.06); noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  }
  function tick(when, vol, freq, dest) {
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest); src.start(when);
  }
  function overStep(st, t, m, dest, stepDur) {
    var tonic = 48 + (m.root % 12), s = st % 32, bar = Math.floor(s / 8), d = OVER_MEL[s], wave = m.wave === 'sawtooth' ? 'square' : m.wave;
    if (d >= 0) tone(midi(tonic + 12 + MAJOR[d % 7] + 12 * Math.floor(d / 7)), stepDur * 0.8, wave, 0.07, t, 1, dest);
    var chord = tonic - 12 + OVER_CHORD[bar];
    if (s % 4 === 0) tone(midi(chord), stepDur * 1.6, 'triangle', 0.09, t, 1, dest);
    else if (s % 4 === 2) tone(midi(chord + 7), stepDur * 0.8, 'triangle', 0.06, t, 1, dest);
    if (s % 8 === 0 || s % 8 === 4) tone(110, 0.1, 'sine', 0.12, t, 0.4, dest);
    tick(t, s % 2 ? 0.07 : 0.035, 6000, dest);
  }
  function mineStep(st, t, m, mel, dest, stepDur, depth) {
    var s = st % 32, d = mel[s], cap = 9 - Math.floor(depth * 6), oct = depth > 0.5 ? 0 : 12;
    if (d !== null) { d = Math.min(d, cap); tone(midi(m.root + oct + m.scale[d % 5] + 12 * Math.floor(d / 5)), stepDur * 1.4, m.wave === 'square' ? 'triangle' : m.wave, 0.08, t, 1, dest); }
    var bassDeg = [0, 0, 3, 4][Math.floor(s / 8) % 4];
    if (s % 2 === 0) tone(midi(m.root - 24 + m.scale[bassDeg]), stepDur * 1.6, 'triangle', 0.08, t, 1, dest);
    if (s % 4 === 0) tone(80, 0.18, 'sine', 0.16, t, 0.5, dest);
    if (s % 4 === 2) tick(t, 0.04, 1800, dest);
  }
  function scheduleMusic() {
    if (!AC || muted) return;
    if (!buses) makeBuses();
    var st = readState(), m = D.WORLDS[st.world].music, now = AC.currentTime;
    var key = st.mood + st.world;
    if (curMood !== key) {
      var first = !curMood; curMood = key; musicStep = 0; nextNote = now + 0.1;
      buses.over.gain.setTargetAtTime(st.mood === 'over' ? 1 : 0, now, first ? 0.05 : 0.3);
      buses.mine.gain.setTargetAtTime(st.mood === 'mine' ? 1 : 0, now, first ? 0.05 : 0.3);
      mineDelay.delayTime.setTargetAtTime(Math.min(1.9, 60 / m.tempo * 0.75), now, 0.05);
    }
    curDepth = st.depth;
    mineWet.gain.setTargetAtTime(0.15 + 0.5 * st.depth, now, 0.5);
    mineLp.frequency.setTargetAtTime(2600 - 1500 * st.depth, now, 0.5);
    var tempo = st.mood === 'over' ? 120 + (m.tempo - 100) / 4 : m.tempo * 0.8, stepDur = 60 / tempo / 2, dest = buses[st.mood];
    var mel = st.mood === 'mine' ? mineTune(st.world) : null;
    if (nextNote < now - 0.5) nextNote = now + 0.05;
    while (nextNote < now + 0.2) {
      if (st.mood === 'over') overStep(musicStep, nextNote, m, dest, stepDur); else mineStep(musicStep, nextNote, m, mel, dest, stepDur, st.depth);
      nextNote += stepDur; musicStep++;
    }
  }
  function setMute(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {}
  }
  return { get current() { return { mood: curMood, step: musicStep, depth: curDepth }; }, init: init, sfx: sfx, setMute: setMute, isMuted: function () { return muted; } };
})();
