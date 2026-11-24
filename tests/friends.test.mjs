// Tests for the helpers as friends in js/logic.js: the roster, hearts, perks, talk and gifts, and saving them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
const D = ctx.DTW, T = D.TILE;
const run = (s, secs) => { for (let t = 0; t < secs; t += 0.05) D.step(s, 0.05); };
const rich = s => { s.coins = 1e12; s.mats = [1e9, 1e9, 1e9, 1e9, 1e9]; return s; };
function digAt(w, x, y, z) {
  const s = D.newState(3); s.unlocked = [true, true, true, true, true]; s.world = w;
  D.startDig(s, w); run(s, 3); D._teleport(s, x, y, z); return s;
}
const level = (s, k, n) => { s.friends[k].xp = D.HEARTS[n]; };

test('six friends, met in world order, each with a perk and a favourite material', () => {
  assert.equal(D.FRIENDS.length, 6);
  assert.deepEqual([...D.FRIENDS].map(f => f.world), [0, 0, 1, 2, 3, 4]);
  D.FRIENDS.forEach(f => { assert.ok(f.key && f.perk); assert.ok(f.fav >= 0 && f.fav <= 4); });
  assert.equal(new Set(D.FRIENDS.map(f => f.perk)).size, 6);
  const s = D.newState(1);
  assert.equal(s.friends.length, 6);
  assert.equal(D.friendLevel(s, 0), 0);
});

test('the first world starts with one helper; the little sister joins once her brother is a good friend', () => {
  const s = rich(D.newState(1));
  assert.equal(D.maxDiggers(s), 1);
  assert.equal(D.hire(s, 'diggers'), true); assert.equal(D.hire(s, 'diggers'), false);
  level(s, 0, D.PIP_LEVEL - 1); assert.equal(D.maxDiggers(s), 1);
  level(s, 0, D.PIP_LEVEL); assert.equal(D.maxDiggers(s), 2);
  assert.equal(D.hire(s, 'diggers'), true);
  // or she comes along anyway once the second world opens, so a player never stalls on her
  const t = rich(D.newState(1)); D.hire(t, 'diggers'); t.unlocked[1] = true;
  assert.equal(D.maxDiggers(t), 3);
  t.unlocked = [true, true, true, true, true]; while (D.hire(t, 'diggers'));
  assert.equal(t.workers.diggers, 6);
});

test('hearts come from digging together', () => {
  const s = digAt(0, 0, 20, 0); s.workers.diggers = 1; D.setAuto(s, false);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (x + z > 0) D._setTile(s, x, 20, z, T.STONE);
  run(s, 20);
  assert.ok(Math.abs(s.friends[0].xp - 20 * D.FRIEND_DIG) < 0.3, 'xp ' + s.friends[0].xp);
  assert.equal(s.friends[1].xp, 0, 'a friend not on the dig gains nothing');
  s.friends[0].xp = D.HEARTS[1] - 0.01; s.events.length = 0; run(s, 1);
  assert.equal(D.friendLevel(s, 0), 1);
  assert.ok(s.events.some(e => e.type === 'friendUp' && e.friend === 0 && e.level === 1));
});

test('a bone a friend carried home earns that friend hearts when it is handed in', () => {
  const s = D.newState(1); s.workers.diggers = 1;
  s.carry = [{ kind: 'fossil', world: 0, idx: 0 }, { kind: 'fossil', world: 0, idx: 1 }];
  D.HUB.rows.forEach((row, z) => { const x = row.indexOf('M'); if (x >= 0) { s.hub.x = D.HUB.x0 + x + 0.5; s.hub.z = D.HUB.z0 + z + 0.5; } });
  D.step(s, 0.05);
  assert.equal(s.carry.length, 0);
  assert.equal(s.friends[0].xp, D.FRIEND_BONE, 'only the second bone was on the helper\'s back');
});

test('talking once a day gives hearts and tells the next story part', () => {
  const s = D.newState(1);
  assert.equal(D.talk(s, 0), null, 'not hired yet');
  s.workers.diggers = 1;
  const a = D.talk(s, 0);
  assert.equal(a.xp, D.FRIEND_TALK); assert.equal(a.beat, 0);
  assert.equal(D.talk(s, 0).xp, 0, 'once a day');
  s.stats.timePlayed += D.DAY_LEN;
  const b = D.talk(s, 0); assert.equal(b.xp, D.FRIEND_TALK); assert.equal(b.beat, 1, 'the first heart unlocks the first story part');
  assert.equal(D.talk(s, 0).beat, 0, 'nothing new yet');
  level(s, 0, 2);
  assert.equal(D.talk(s, 0).beat, 2); assert.equal(D.talk(s, 0).beat, 0);
  assert.equal(s.friends[0].told, 2);
});

test('a gift of the favourite material once a day', () => {
  const s = D.newState(1); s.workers.diggers = 1;
  const c = D.giftCost(s, 0); assert.ok(c.mats[D.FRIENDS[0].fav] >= 1); assert.equal(c.coins, 0);
  assert.equal(D.gift(s, 0), false, 'nothing to give');
  s.mats = [99, 99, 99, 99, 99];
  assert.equal(D.gift(s, 0), true); assert.equal(s.friends[0].xp, D.FRIEND_GIFT);
  assert.equal(s.mats[D.FRIENDS[0].fav], 99 - c.mats[D.FRIENDS[0].fav]);
  assert.equal(D.gift(s, 0), false, 'once a day');
});

test('perks: each friend helps once the hearts reach PERK_LEVEL, and only on a dig they are part of', () => {
  // Baron hits harder
  const a = digAt(0, 0, 20, 0); a.workers.diggers = 1; D.setAuto(a, false);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (x + z > 0) D._setTile(a, x, 20, z, T.STONE);
  assert.equal(D.perkOn(a, 'strong'), false); level(a, 0, D.PERK_LEVEL); assert.equal(D.perkOn(a, 'strong'), true);
  // Hale bosses the miner into swinging faster
  const b = digAt(0, 0, 20, 0); b.workers.diggers = 2; const r0 = D.hitRate(b); level(b, 1, D.PERK_LEVEL);
  assert.ok(Math.abs(D.hitRate(b) / r0 - D.PERK.cheer) < 1e-9);
  // Jon: more oxygen in the ocean
  const c = digAt(1, 0, 20, 0); c.workers.diggers = 3; assert.equal(D.o2Max(c), D.O2_MAX);
  level(c, 2, D.PERK_LEVEL); assert.equal(D.o2Max(c), D.O2_MAX * D.PERK.breath);
  // Wren: a longer dodge window
  const d = digAt(2, 0, 20, 0); d.workers.diggers = 4; level(d, 3, D.PERK_LEVEL);
  assert.equal(D.dodgeWindow(d), D.DODGE_WINDOW * D.PERK.trapsense);
  // Nova: a longer pickup reach
  const e = digAt(3, 0, 20, 0); e.workers.diggers = 5; const re = D.reach(e); level(e, 4, D.PERK_LEVEL);
  assert.equal(D.reach(e), re + D.PERK.reach);
  // Grog: fossils give way faster
  const f = digAt(4, 0, 20, 0); f.workers.diggers = 6; level(f, 5, D.PERK_LEVEL); assert.equal(D.perkOn(f, 'bones'), true);
  // a friend from a later world does not dig, so no perk, in an earlier one
  const g = digAt(0, 0, 20, 0); g.workers.diggers = 6; level(g, 5, 4); assert.equal(D.perkOn(g, 'bones'), false);
});

test('friends are saved, and an old save keeps every helper it hired', () => {
  const s = D.newState(1); s.workers.diggers = 2; s.friends[0].xp = 42; s.friends[0].told = 2; s.friends[1].talk = 3;
  const t = D.deserialize(D.serialize(s));
  assert.equal(t.friends[0].xp, 42); assert.equal(t.friends[0].told, 2); assert.equal(t.friends[1].talk, 3);
  const old = JSON.parse(D.serialize(s)); old.v = 5; delete old.friends;
  const u = D.deserialize(JSON.stringify(old));
  assert.equal(u.workers.diggers, 2); assert.equal(u.friends.length, 6); assert.equal(u.friends[0].xp, 0);
});

test('read aloud is off unless switched on, and an older save that had it on loads with it off', () => {
  const s = D.newState(1);
  assert.equal(!!s.speak, false);
  assert.equal(D.deserialize(D.serialize(s)).speak, false);
  s.speak = true; assert.equal(D.deserialize(D.serialize(s)).speak, true);
  const old = JSON.parse(D.serialize(D.newState(1))); delete old.speak; old.voice = true;
  assert.equal(D.deserialize(JSON.stringify(old)).speak, false);
});
