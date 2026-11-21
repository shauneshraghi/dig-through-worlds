// Dig Through Worlds: retro sound effects and a looping tune per world, all made with WebAudio.
// Exposes the global DTWAudio. Call init() from a user gesture; getWorld() picks the tune.
var DTWAudio = (function () {
  'use strict';
  var D = DTW, MUTE_KEY = 'dig-through-worlds-v1-mute';
  var AC = null, master = null, muted = false, musicTimer = null, musicStep = 0, nextNote = 0, musicWorld = -1;
  var getWorld = function () { return 0; };
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

  function prng(seed) { var a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function init(worldFn) {
    if (worldFn) getWorld = worldFn;
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(AC.destination);
    musicTimer = setInterval(scheduleMusic, 50);
  }
  function tone(freq, dur, type, vol, when, slide) {
    if (!AC) return; var t0 = when || AC.currentTime;
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
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
    buy: function () { tone(660, 0.08, 'square', 0.1); tone(990, 0.12, 'square', 0.1, AC.currentTime + 0.06); },
    up: function () { tone(200, 0.6, 'triangle', 0.12, 0, 4); },
    down: function () { tone(500, 0.5, 'triangle', 0.1, 0, 0.3); },
    step: function () { tone(220, 0.06, 'triangle', 0.06); },
    no: function () { tone(160, 0.15, 'square', 0.1); }
  };
  function sfx(n) { if (AC && !muted && SFX[n]) SFX[n](); }
  // a looping tune per world, generated from its scale
  var tunes = {};
  function tuneFor(w) {
    if (tunes[w]) return tunes[w];
    var m = D.WORLDS[w].music, r = prng(w * 31 + 3), mel = [], deg = 2;
    for (var i = 0; i < 32; i++) { deg = Math.max(0, Math.min(9, deg + Math.floor(r() * 5) - 2)); mel.push(r() < 0.22 ? null : deg); }
    return (tunes[w] = { m: m, mel: mel });
  }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function scheduleMusic() {
    if (!AC || muted) return;
    var w = getWorld(), tn = tuneFor(w), m = tn.m, stepDur = 60 / m.tempo / 2;
    if (musicWorld !== w) { musicWorld = w; musicStep = 0; nextNote = AC.currentTime + 0.1; }
    if (nextNote < AC.currentTime - 0.5) nextNote = AC.currentTime + 0.05;
    while (nextNote < AC.currentTime + 0.2) {
      var d = tn.mel[musicStep % 32];
      if (d !== null) { var note = m.root + 12 + m.scale[d % 5] + 12 * Math.floor(d / 5); tone(midi(note), stepDur * 0.9, m.wave, 0.035, nextNote); }
      if (musicStep % 4 === 0) { var bassDeg = [0, 0, 3, 4][Math.floor(musicStep / 8) % 4]; tone(midi(m.root - 12 + m.scale[bassDeg]), stepDur * 3.5, 'triangle', 0.06, nextNote); }
      nextNote += stepDur; musicStep++;
    }
  }
  function setMute(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {}
  }
  return { init: init, sfx: sfx, setMute: setMute, isMuted: function () { return muted; } };
})();
