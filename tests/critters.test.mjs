// Tests for the cave critters in js/logic.js: bats that take ore off the floor and rattle-bones that bump the miner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
const D = ctx.DTW, T = D.TILE;
const run = (s, secs) => { for (let t = 0; t < secs; t += 0.05) D.step(s, 0.05); };
// step and keep every event (the state keeps only the last 80)
const watch = (s, secs, each) => { const ev = []; for (let t = 0; t < secs; t += 0.05) { s.events = []; D.step(s, 0.05); ev.push(...s.events); if (each) each(); } return ev; };
// a dig in world w with the miner at (x, y, z) and auto-mining off
function digAt(w, x, y, z) {
  const s = D.newState(3); s.unlocked = [true, true, true, true, true]; s.world = w;
  D.startDig(s, w); run(s, 3); D._teleport(s, x, y, z); D.setAuto(s, false); s.events = []; return s;
}
// layer y emptied but for one tough block in the far corner, so the layer stays open for business
function openLayer(w, x, y, z) {
  const s = digAt(w, x, y, z); D._clearLayer(s, y);
  D._setTile(s, 6, y, 6, T.STONE); s.run.grid.hp[D.idx(6, y, 6)] = 1e9;
  return s;
}
const floorLoot = (s, item, x, z) => { const l = { x, y: D.DEPTH, z, layer: s.run.y, rest: true, item, age: 5, delay: 0.3, vx: 0, vy: 0, vz: 0 }; l.y = s.run.y + 0.75; s.run.loot.push(l); return l; };
const critters = s => s.run.critters || [];

test('critters keep out of the top layers, away from an open chest lock and the relic party', () => {
  const s = digAt(0, 3, D.CRITTER_FROM - 1, 3);
  for (let t = 0; t < 4 * D.CRITTER_EVERY; t += 0.05) { D.step(s, 0.05); assert.equal(critters(s).length, 0, 'none above CRITTER_FROM'); }
  assert.equal(D._critterNow(s, 'bat'), null, 'not even the test hook spawns one up there');

  const l = digAt(0, 3, 10, 3);
  D._setTile(l, 4, 10, 3, T.CHEST); D.steer(l, 'e'); run(l, 1);
  assert.ok(l.run.lock, 'a lock is open');
  for (let t = 0; t < 4 * D.CRITTER_EVERY; t += 0.05) { D.step(l, 0.05); assert.equal(critters(l).length, 0, 'none while a lock is open'); }

  const p = digAt(0, 3, D.DEPTH - 1, 3); p.relics[0] = false; p.upgrades.drill = 20; D._clearLayer(p, D.DEPTH - 1);
  assert.ok(D._critterNow(p, 'bat'), 'a bat just above the relic layer');
  D.setAuto(p, true);
  for (let i = 0; i < 2000 && !p.run.party; i++) { D.tap(p); D.step(p, 0.05); }
  assert.ok(p.run.party, 'the party starts');
  assert.equal(critters(p).length, 0, 'critters leave when the party starts');
  for (let t = 0; t < 2 * D.CRITTER_EVERY && p.mode === 'dig'; t += 0.05) { D.step(p, 0.05); assert.equal(critters(p).length, 0); }
});

test('a critter turns up every CRITTER_EVERY s of dig time, and never more than CRITTER_MAX at once', () => {
  const s = openLayer(0, 0, 5, 0);
  run(s, D.CRITTER_EVERY - 0.5);
  assert.equal(critters(s).length, 0, 'not yet');
  const ev = watch(s, 1);
  assert.equal(ev.filter(e => e.type === 'critter').length, 1, 'one turns up');
  assert.ok(['bat', 'bones'].includes(critters(s)[0].kind));
  let most = 0;
  const all = watch(s, 6 * D.CRITTER_EVERY, () => { most = Math.max(most, critters(s).length); });
  const n = all.filter(e => e.type === 'critter').length;
  assert.ok(n >= 3 && n <= 6, `${n} critters in six rounds`);
  assert.ok(most <= D.CRITTER_MAX);
  assert.ok(all.some(e => e.type === 'critter' && e.kind === 'bat') && all.some(e => e.type === 'critter' && e.kind === 'bones'), 'both kinds come');
  // at the cap a round passes with nobody new
  const c = openLayer(0, 0, 5, 0); D._critterNow(c, 'bat'); D._critterNow(c, 'bat');
  assert.equal(critters(c).length, D.CRITTER_MAX);
  c.run.critT = D.CRITTER_EVERY - 0.01; D.step(c, 0.05);
  assert.equal(critters(c).length, D.CRITTER_MAX);
});

test('a bat takes ore or treasure lying on the floor, never a bone', () => {
  const s = openLayer(0, 0, 5, 0);
  const bone = floorLoot(s, { kind: 'fossil', world: 0, idx: 3 }, 4.5, 4.5);
  const bat = D._critterNow(s, 'bat');
  assert.equal(bat.kind, 'bat'); assert.equal(bat.layer, 5);
  const ev = watch(s, D.BAT_STAY + 8);
  assert.ok(!ev.some(e => e.type === 'batStole'), 'the bone is left alone');
  assert.ok(s.run.loot.includes(bone));
  assert.equal(critters(s).length, 0, 'with nothing to take it circles a while and leaves');

  const t = openLayer(0, 0, 5, 0);
  floorLoot(t, { kind: 'fossil', world: 0, idx: 3 }, 2.5, 4.5);
  const ore = floorLoot(t, { kind: 'ore', world: 0, idx: 0, n: 4 }, 4.5, 2.5);
  D._critterNow(t, 'bat');
  const ev2 = watch(t, 12);
  const stole = ev2.find(e => e.type === 'batStole');
  assert.ok(stole, 'the bat took something');
  assert.equal(stole.item.kind, 'ore');
  assert.ok(!t.run.loot.includes(ore));
  assert.equal(t.run.loot.filter(l => l.item.kind === 'fossil').length, 1, 'the bone is still there');

  const u = openLayer(0, 0, 5, 0);
  floorLoot(u, { kind: 'treasure', world: 0, value: 25 }, 4.5, 4.5);
  D._critterNow(u, 'bat');
  assert.ok(watch(u, 12).some(e => e.type === 'batStole' && e.item.kind === 'treasure'));
});

test('a bat hovers BAT_GRAB s over the loot before it takes it', () => {
  const s = openLayer(0, 0, 5, 0);
  floorLoot(s, { kind: 'ore', world: 0, idx: 1, n: 2 }, 3.5, 3.5);
  const bat = D._critterNow(s, 'bat');
  let over = -1, took = -1, t = 0;
  for (; t < 15 && took < 0; t += 0.05) {
    s.events = []; D.step(s, 0.05);
    if (over < 0 && Math.hypot(bat.x - 3.5, bat.z - 3.5) < 0.1) over = t;
    if (s.events.some(e => e.type === 'batStole')) took = t;
  }
  assert.ok(over >= 0 && took > over);
  assert.ok(Math.abs(took - over - D.BAT_GRAB) < 0.25, `took ${(took - over).toFixed(2)} s over it`);
});

test('a tap shoos a bat off: it drops a few coins, and anything it took', () => {
  const s = openLayer(1, 0, 5, 0);
  const bat = D._critterNow(s, 'bat');
  run(s, 1); s.events = [];
  assert.equal(D.shoo(s, bat.id), true);
  assert.equal(critters(s).length, 0);
  assert.ok(s.events.some(e => e.type === 'shooed' && e.kind === 'bat'));
  const coins = s.run.loot.filter(l => l.item.kind === 'treasure');
  assert.equal(coins.length, 1);
  assert.equal(coins[0].item.value, Math.round(D.BAT_COINS * D.WORLDS[1].oreMult));
  assert.equal(coins[0].layer, 5);
  assert.equal(D.shoo(s, bat.id), false, 'it is gone');

  const t = openLayer(0, 0, 5, 0);
  floorLoot(t, { kind: 'ore', world: 0, idx: 0, n: 4 }, 4.5, 4.5);
  const b2 = D._critterNow(t, 'bat');
  for (let i = 0; i < 300 && !b2.item; i++) D.step(t, 0.05);
  assert.ok(b2.item, 'it has the ore');
  D.shoo(t, b2.id);
  assert.ok(t.run.loot.some(l => l.item.kind === 'ore'), 'the ore drops back on the floor');
});

test('rattle-bones turns up at least 3 cells away on an open cell, or not at all', () => {
  const s = openLayer(0, 0, 5, 0);
  for (let k = 0; k < 6; k++) {
    s.run.critters = [];
    const c = D._critterNow(s, 'bones');
    assert.ok(c); assert.equal(c.hp, D.RATTLE_HITS);
    const cx = Math.floor(c.x), cz = Math.floor(c.z);
    assert.ok(cx + cz >= 3, `at ${cx},${cz}`);
    assert.ok(D.passable(s.run.grid.t[D.idx(cx, 5, cz)]));
  }
  const f = digAt(0, 3, 5, 3);
  for (let z = 0; z < 7; z++) for (let x = 0; x < 7; x++) if (x !== 3 || z !== 3) D._setTile(f, x, 5, z, T.STONE);
  assert.equal(D._critterNow(f, 'bones'), null, 'no open cell far enough');
});

test('rattle-bones shuffles up to the miner, bumps him dizzy, backs off and comes again', () => {
  const s = openLayer(0, 0, 5, 0);
  const c = D._critterNow(s, 'bones');
  c.hp = 1e9; // keep it about however often it is swatted
  const d0 = Math.floor(c.x) + Math.floor(c.z);
  let bumps = 0, t = 0, first = -1;
  for (; t < 40; t += 0.05) {
    s.events = []; D.step(s, 0.05);
    if (s.events.some(e => e.type === 'rattled')) { bumps++; if (first < 0) { first = t; assert.ok(Math.abs(s.run.stun - D.RATTLE_STUN) < 0.1); } }
  }
  assert.ok(first > 0, 'it reached the miner');
  assert.ok(first >= (d0 - 1) / D.RATTLE_SPEED - 0.1, `came ${d0} cells in ${first.toFixed(1)} s`);
  assert.ok(bumps >= 2, `${bumps} bumps`);
});

test('rattle-bones takes RATTLE_HITS shoos to scatter, and drops coins', () => {
  const s = openLayer(2, 0, 5, 0);
  const c = D._critterNow(s, 'bones');
  for (let k = 1; k < D.RATTLE_HITS; k++) { assert.equal(D.shoo(s, c.id), true); assert.equal(c.hp, D.RATTLE_HITS - k); assert.equal(critters(s).length, 1); }
  s.events = [];
  D.shoo(s, c.id);
  assert.equal(critters(s).length, 0);
  assert.ok(s.events.some(e => e.type === 'scattered'));
  const coins = s.run.loot.filter(l => l.item.kind === 'treasure');
  assert.equal(coins.length, 1);
  assert.equal(coins[0].item.value, Math.round(D.RATTLE_COINS * D.WORLDS[2].oreMult));
});

test('the miner left to auto-mine, or standing idle, swats rattle-bones beside him, and so does a helper', () => {
  for (const auto of [false, true]) {
    const s = openLayer(0, 0, 5, 0); D.setAuto(s, auto); run(s, 4); // on auto the miner walks over to the corner block
    const c = D._critterNow(s, 'bones'), r = s.run;
    const [px, pz] = [[r.x - 1, r.z], [r.x, r.z - 1], [r.x + 1, r.z], [r.x, r.z + 1]].find(([x, z]) => x >= 0 && z >= 0 && x < D.N && z < D.N && D.passable(r.grid.t[D.idx(x, 5, z)]));
    c.x = px + 0.5; c.z = pz + 0.5; c.cx = c.tx = px; c.cz = c.tz = pz; c.state = 'rest'; c.wait = 1e9; // parked beside the miner
    const ev = watch(s, D.RATTLE_HITS * D.CRITTER_SWAT + 0.5);
    assert.ok(ev.some(e => e.type === 'scattered'), `auto ${auto}: scattered without a tap`);
  }
  const h = openLayer(0, 0, 5, 0); h.workers.diggers = 1;
  run(h, 0.3);
  const hc = h.run.crew[0];
  assert.deepEqual([hc.x, hc.z], [5, 6], 'the helper digs the corner block');
  h.run.stun = 1e9; // the miner can do nothing
  const c = D._critterNow(h, 'bones');
  c.x = 4.5; c.z = 6.5; c.cx = c.tx = 4; c.cz = c.tz = 6; c.state = 'rest'; c.wait = 1e9;
  const ev = watch(h, D.RATTLE_HITS * D.CRITTER_SWAT + 0.5);
  assert.ok(ev.some(e => e.type === 'scattered'), 'the helper swatted it away');
});

test('going home clears the critters, and saving ignores them', () => {
  const s = openLayer(0, 0, 5, 0);
  D._critterNow(s, 'bat'); D._critterNow(s, 'bones');
  const saved = D.serialize(s);
  assert.ok(!/critter/.test(saved));
  const back = D.deserialize(saved);
  assert.ok(back); assert.equal(back.coins, s.coins);
  D.goHome(s);
  assert.equal(critters(s).length, 0);
  run(s, 5);
  assert.equal(s.mode, 'surface');
  D.startDig(s, 0);
  assert.equal(critters(s).length, 0);
});
