// Tests for plaza life in js/logic.js: the day clock, weather and the reward guests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
const D = ctx.DTW;
const run = (s, secs) => { for (let t = 0; t < secs; t += 0.05) D.step(s, 0.05); };

test('the day clock follows play time: a new game starts in the morning and a day lasts DAY_LEN', () => {
  const s = D.newState(1);
  const a = D.dayPhase(s);
  assert.equal(a.phase, 'day');
  assert.equal(a.light, 1);
  const seen = new Set();
  for (let t = 0; t < D.DAY_LEN; t += 5) { s.stats.timePlayed = t; const p = D.dayPhase(s); seen.add(p.phase); assert.ok(p.t >= 0 && p.t < 1); assert.ok(p.light >= 0 && p.light <= 1); }
  assert.deepEqual([...seen].sort(), ['dawn', 'day', 'dusk', 'night']);
  s.stats.timePlayed = 37; const p0 = D.dayPhase(s).t;
  s.stats.timePlayed = 37 + D.DAY_LEN; assert.ok(Math.abs(D.dayPhase(s).t - p0) < 1e-9);
  // night is dark but dawn and dusk ramp
  for (let t = 0; t < D.DAY_LEN; t += 1) { s.stats.timePlayed = t; const p = D.dayPhase(s); if (p.phase === 'night') assert.equal(p.light, 0); }
});

test('weather is set by seed, world and time slot, starts clear, and only uses that world\'s kinds', () => {
  const s = D.newState(7);
  assert.equal(D.weather(s).kind, 'clear');
  for (let w = 0; w < 5; w++) {
    s.world = w;
    const kinds = new Set(D.WEATHER[D.WORLDS[w].id].map(k => k[0]).concat(['rainbow']));
    const seen = new Set();
    for (let slot = 0; slot < 200; slot++) {
      s.stats.timePlayed = slot * D.WEATHER_SLOT + 1;
      const wx = D.weather(s);
      assert.ok(kinds.has(wx.kind), `${w} ${wx.kind}`);
      assert.ok(wx.t >= 0 && wx.t < 1);
      seen.add(wx.kind);
      if (wx.kind === 'rainbow') { s.stats.timePlayed -= D.WEATHER_SLOT; assert.ok(['rain', 'storm'].includes(D.weather(s).kind)); }
    }
    assert.ok(seen.size >= (D.WORLDS[w].id === 'moon' ? 2 : 3), `world ${w} has some weather: ${[...seen]}`);
    if (D.WORLDS[w].id === 'moon') assert.ok(!seen.has('rain') && !seen.has('rainbow'));
  }
  const b = D.newState(7); b.world = 2; b.stats.timePlayed = 5000; s.world = 2; s.stats.timePlayed = 5000;
  assert.deepEqual({ ...D.weather(b) }, { ...D.weather(s) }, 'same seed and time, same weather');
});

test('a reward guest arrives after GUEST_EVERY s of play, waits until met, and gives a small gift', () => {
  const s = D.newState(3); s.coins = 0;
  run(s, D.GUEST_EVERY - 1);
  assert.equal(s.guest, null);
  run(s, 2);
  assert.ok(s.guest, 'a guest has come');
  assert.ok(s.events.some(e => e.type === 'guest'));
  const g = s.guest, info = D.GUESTS.find(k => k.id === g.kind);
  assert.ok(info, g.kind);
  run(s, 600);
  assert.equal(s.guest, g, 'it waits, however long');
  s.hub.x = g.x; s.hub.z = g.z;
  const before = s.coins, mats = s.mats.slice();
  D.step(s, 0.05);
  assert.equal(s.guest, null);
  const e = s.events.filter(e => e.type === 'guestGift').pop();
  assert.ok(e && e.kind === g.kind);
  const got = s.coins - before + s.mats.reduce((a, n, i) => a + n - mats[i], 0);
  assert.ok(got > 0, 'something was given');
  assert.ok(s.coins - before <= D.quizReward(s), 'no more coins than a quiz answer');
  assert.equal(s.guestT, 0);
});

test('guests are met only on the plaza, and never while digging', () => {
  const s = D.newState(4);
  D._guestNow(s);
  const g = s.guest;
  D.startDig(s, 0);
  s.hub.x = g.x; s.hub.z = g.z;
  run(s, 1);
  assert.equal(s.guest, g);
});

test('guest spots are open grass reachable from home, away from pads and the museum', () => {
  const spots = D.guestSpots();
  assert.ok(spots.length >= 10);
  const home = D.newState(0).hub;
  for (const [x, z] of spots) {
    assert.equal(D.hubCell(Math.floor(x), Math.floor(z)), '.', `${x},${z}`);
    assert.ok(D.hubPath(home.x, home.z, x, z), `reachable ${x},${z}`);
  }
});

test('which guest comes depends on world, time of day and weather', () => {
  for (let w = 0; w < 5; w++) {
    const s = D.newState(11); s.world = w;
    for (let n = 0; n < 40; n++) {
      s.stats.timePlayed = n * 97;
      D._guestNow(s);
      const info = D.GUESTS.find(k => k.id === s.guest.kind), ph = D.dayPhase(s).phase, wx = D.weather(s).kind;
      assert.ok(!info.worlds || info.worlds.includes(D.WORLDS[w].id), `${info.id} in ${w}`);
      if (info.when === 'night') assert.equal(ph, 'night', info.id);
      if (info.when === 'day') assert.notEqual(ph, 'night', info.id);
      if (info.weather) assert.ok(info.weather.includes(wx), info.id);
    }
  }
});

test('guests do not change the game\'s random numbers', () => {
  const a = D.newState(9), b = D.newState(9);
  D._guestNow(a); D.weather(a); D.dayPhase(a);
  assert.equal(a.rng, b.rng);
});
