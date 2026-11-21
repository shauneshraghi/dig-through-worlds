// Tests for the pure game logic in js/logic.js. It is a plain browser script that defines the
// global DTW, so it runs here in a Node vm context with no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
const D = ctx.DTW;
assert.ok(D, 'js/logic.js must define the global DTW');

const T = D.TILE;
const run = (s, secs) => { for (let t = 0; t < secs; t += 0.05) D.step(s, 0.05); };
// taps deterministically at a steady rate
const runTapping = (s, secs, tps) => {
  const dt = 0.05; let acc = 0;
  for (let t = 0; t < secs; t += dt) { acc += tps * dt; while (acc >= 1) { D.tap(s); acc--; } D.step(s, dt); }
};
const at = (g, x, y, z) => g.t[D.idx(x, y, z)];
const diggable = tt => !D.passable(tt) && tt !== T.BEDROCK;
const layerLeft = (g, y) => { let n = 0; for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (diggable(at(g, x, y, z))) n++; return n; };
// start a dig in world w with the miner standing at (x, y, z); layer y is emptied first
function digAt(w, x, y, z, up = {}) {
  const s = D.newState(9); for (let i = 0; i <= w; i++) s.unlocked[i] = true;
  Object.assign(s.upgrades, up);
  D.startDig(s, w); D.step(s, 5);
  D._clearLayer(s, y); D._teleport(s, x, y, z);
  return s;
}
const breaks = s => s.events.filter(e => e.type === 'break');

test('five worlds with distinct biomes and distinct rules', () => {
  assert.equal(D.WORLDS.length, 5);
  const ids = new Set(D.WORLDS.map(w => w.id));
  const rules = new Set(D.WORLDS.map(w => w.rule));
  assert.equal(ids.size, 5);
  assert.equal(rules.size, 5);
  assert.deepEqual([...ids], ['forest', 'ocean', 'jungle', 'moon', 'alien']);
  for (const w of D.WORLDS) {
    assert.equal(w.ores.length, 4, w.id);
    assert.equal(w.fossils.length, 5, w.id);
    assert.ok(w.relic && w.relic.name, w.id);
    assert.ok(w.exhibit, w.id);
  }
});

test('new game: only the first world is open', () => {
  const s = D.newState(1);
  assert.deepEqual([...s.unlocked], [true, false, false, false, false]);
  assert.equal(s.mode, 'surface');
  assert.throws(() => D.startDig(s, 1));
});

test('the world is a 7×7 column of ground, 100 layers deep, indexed (y*N + z)*N + x', () => {
  assert.equal(D.N, 7);
  assert.equal(D.DEPTH, 100);
  assert.equal(D.idx(0, 0, 0), 0);
  assert.equal(D.idx(1, 0, 0), 1);
  assert.equal(D.idx(0, 0, 1), 7);
  assert.equal(D.idx(0, 1, 0), 49);
  assert.equal(D.idx(4, 9, 2), (9 * 7 + 2) * 7 + 4);
  const g = D.genWorld(0, 1);
  assert.equal(g.t.length, 7 * 7 * (D.DEPTH + 2));
});

test('world generation is deterministic and has the relic layer, bedrock and biome features', () => {
  const feature = { forest: T.ROOT, ocean: T.BUBBLE, jungle: T.TRAP, moon: T.CRATER, alien: T.GOO };
  for (let w = 0; w < 5; w++) {
    const a = D.genWorld(w, 42), b = D.genWorld(w, 42);
    assert.deepEqual([...a.t], [...b.t]);
    for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) {
      assert.equal(at(a, x, D.DEPTH, z), T.RELIC);
      assert.equal(at(a, x, D.DEPTH + 1, z), T.BEDROCK);
      assert.equal(at(a, x, 0, z), T.AIR);
    }
    const id = D.WORLDS[w].id;
    assert.ok([...a.t].includes(feature[id]), `${id} has its feature tile`);
    for (let p = 0; p < 5; p++) {
      let n = 0;
      for (let i = 0; i < a.t.length; i++) if (a.t[i] === T.FOSSIL && a.v[i] === p) n++;
      assert.equal(n, 2, `${id} has two copies of fossil piece ${p}`);
    }
  }
  const j = D.genWorld(2, 7);
  assert.ok([...j.t].includes(T.CHEST), 'jungle has treasure chests');
});

test('forest roots run along x and along z', () => {
  const g = D.genWorld(0, 42);
  let alongX = 0, alongZ = 0;
  for (let y = 1; y < D.DEPTH; y++) for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) {
    if (at(g, x, y, z) !== T.ROOT) continue;
    if (x + 1 < D.N && at(g, x + 1, y, z) === T.ROOT) alongX++;
    if (z + 1 < D.N && at(g, x, y, z + 1) === T.ROOT) alongZ++;
  }
  assert.ok(alongX > 5 && alongZ > 5, `runs along x ${alongX}, along z ${alongZ}`);
});

test('jungle treasure rooms are 3×3×2 hollows with chests in the floor', () => {
  const g = D.genWorld(2, 7);
  let rooms = 0;
  for (let y = 1; y < D.DEPTH - 2; y++) for (let z0 = 0; z0 + 2 < D.N; z0++) for (let x0 = 0; x0 + 2 < D.N; x0++) {
    let hollow = true, chest = false;
    for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) {
      if (at(g, x0 + dx, y, z0 + dz) !== T.AIR || at(g, x0 + dx, y + 1, z0 + dz) !== T.AIR) hollow = false;
      if (at(g, x0 + dx, y + 2, z0 + dz) === T.CHEST) chest = true;
    }
    if (hollow && chest) rooms++;
  }
  assert.ok(rooms >= 3, `found ${rooms} treasure rooms`);
});

test('moon craters are round hollows', () => {
  const g = D.genWorld(3, 7);
  let core = 0;
  for (let y = 2; y < D.DEPTH - 1; y++) for (let z = 1; z < D.N - 1; z++) for (let x = 1; x < D.N - 1; x++)
    if (at(g, x, y, z) === T.CRATER && at(g, x + 1, y, z) === T.CRATER && at(g, x, y, z + 1) === T.CRATER && at(g, x, y + 1, z) === T.CRATER) core++;
  assert.ok(core > 0, 'craters extend in x, z and depth');
});

test('the miner clears every block of a layer before the layer below opens', () => {
  const s = D.newState(3); s.upgrades.drill = 6; s.upgrades.speed = 4; D.startDig(s, 0);
  let checked = 0;
  for (let i = 0; i < 4000 && s.run.y < 5; i++) {
    D.tap(s); D.step(s, 0.05);
    for (const e of breaks(s)) {
      for (let y = 1; y < e.y; y++) assert.equal(layerLeft(s.run.grid, y), 0, `layer ${y} was clear before a block in layer ${e.y} broke`);
      checked++;
    }
    s.events = [];
  }
  assert.ok(s.run.y >= 5, `reached layer ${s.run.y}`);
  assert.ok(checked > 4 * 40, `${checked} blocks broken`);
  for (let y = 1; y < s.run.y; y++) assert.equal(layerLeft(s.run.grid, y), 0, `layer ${y} cleared`);
});

test('dropping through an open cell stops in the first layer that still has blocks', () => {
  const s = digAt(3, 3, 10, 3);
  // a crater shaft under the miner through layers 11 and 12; layer 11 still has other blocks
  D._setTile(s, 3, 11, 3, T.CRATER); D._setTile(s, 3, 12, 3, T.CRATER);
  D.step(s, 0.6); D.step(s, 0.6); // long frames, as when a tab catches up
  assert.equal(s.run.y, 11, 'stopped in layer 11, which is not cleared yet');
});

test('the top layer with blocks left is where the next dig resumes', () => {
  const g = D.genWorld(0, 1);
  assert.equal(D.topLayer(g), 1);
  for (let i = D.idx(0, 1, 0); i < D.idx(0, 2, 0); i++) g.t[i] = T.AIR;
  assert.equal(D.topLayer(g), 2);
});

test('idle, the miner walks over open cells to the nearest block and digs it', () => {
  const s = digAt(0, 0, 10, 0, { drill: 8 });
  D._setTile(s, 6, 10, 6, T.DIRT); D._setTile(s, 2, 10, 1, T.DIRT);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) D._setTile(s, x, 11, z, T.BEDROCK); // stay in this layer
  s.events = [];
  run(s, 15);
  const b = breaks(s).filter(e => e.y === 10);
  assert.equal(b.length, 2, 'both blocks dug');
  assert.deepEqual([b[0].x, b[0].z], [2, 1], 'nearest block first');
  assert.deepEqual([b[1].x, b[1].z], [6, 6]);
  assert.ok(Math.abs(s.run.x - 6) + Math.abs(s.run.z - 6) <= 2, `walked over to it, now at ${s.run.x},${s.run.z}`);
});

test('the miner does not walk off the edge of the pit or through blocks', () => {
  const s = digAt(0, 3, 10, 3, { drill: 2 });
  // a wall of dirt cuts the layer in half; the only blocks left are the wall itself
  for (let z = 0; z < D.N; z++) D._setTile(s, 5, 10, z, T.DIRT);
  for (let i = 0; i < 20; i++) { D.step(s, 0.05); assert.ok(s.run.x < 5, 'stays on its own side of the wall'); }
});

test('steering picks the next block to dig, in all four directions', () => {
  const moves = [['n', 0, -1], ['s', 0, 1], ['e', 1, 0], ['w', -1, 0], [-1, -1, 0], [1, 1, 0]];
  for (const [dir, dx, dz] of moves) {
    const s = digAt(0, 3, 10, 3, { drill: 6 });
    for (const [x, z] of [[4, 3], [2, 3], [3, 4], [3, 2]]) D._setTile(s, x, 10, z, T.DIRT);
    s.events = [];
    D.steer(s, dir);
    for (let i = 0; i < 400 && !breaks(s).length; i++) D.step(s, 0.05);
    const b = breaks(s)[0];
    assert.deepEqual([b.x, b.y, b.z], [3 + dx, 10, 3 + dz], `steering ${dir}`);
  }
});

test('steering onto an open cell walks there, and steering into the pit wall is ignored', () => {
  const s = digAt(0, 1, 10, 1);
  // nothing to dig in this layer or the one below, so the miner only moves when steered
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) D._setTile(s, x, 11, z, T.BEDROCK);
  D.steer(s, 'e'); run(s, 0.5);
  assert.deepEqual([s.run.x, s.run.z], [2, 1]);
  D._teleport(s, 0, 10, 0);
  D.steer(s, 'w'); run(s, 0.5);
  assert.equal(s.run.x, 0); assert.equal(s.run.steer, 0);
  D.steer(s, 'n'); run(s, 0.5);
  assert.equal(s.run.z, 0); assert.equal(s.run.steer, 0);
});

test('a cleared layer opens the one below: the miner digs down into it and carries on there', () => {
  const s = digAt(0, 3, 10, 3, { drill: 8 });
  s.events = [];
  run(s, 8);
  assert.ok(s.run.y >= 11, `went down to layer ${s.run.y}`);
  const b = breaks(s);
  assert.deepEqual([b[0].x, b[0].y, b[0].z], [3, 11, 3], 'first block is the one under the miner');
  assert.ok(b.slice(1, 6).every(e => e.y === 11), 'then it works sideways in layer 11');
});

test('a block breaks quickly, and tapping makes it quicker', () => {
  const blocksIn = (tps) => { const s = D.newState(3); D.startDig(s, 0); runTapping(s, 60, tps); return s.stats.digs; };
  const idle = blocksIn(0), tapping = blocksIn(4);
  assert.ok(idle > 40, `idle dug ${idle} blocks in a minute`);
  assert.ok(tapping > idle * 1.4, `tapping ${tapping} vs idle ${idle}`);
  const s = D.newState(3); s.upgrades.drill = 6; s.upgrades.speed = 4;
  const hp = D.maxHp(0, T.DIRT, 50), perSec = D.drillDamage(s) * D.hitRate(s);
  assert.ok(hp / perSec < 1, `a dirt block halfway down takes ${(hp / perSec).toFixed(2)} s with modest upgrades`);
});

test('the magnet pulls ore from the same layer within a square radius', () => {
  const s = digAt(0, 3, 10, 3, { magnet: 1 });
  D._clearLayer(s, 11);
  D._setTile(s, 3, 12, 3, T.BEDROCK);
  D._setTile(s, 4, 11, 4, T.ORE, 0); D._setTile(s, 2, 11, 2, T.ORE, 1); D._setTile(s, 5, 11, 3, T.ORE, 2);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) D._setTile(s, x, 12, z, T.BEDROCK);
  const before = s.run.bag.length;
  for (let i = 0; i < 100 && s.run.y < 11; i++) D.step(s, 0.05);
  assert.equal(s.run.y, 11, 'fell into the open layer below');
  assert.equal(at(s.run.grid, 4, 11, 4), T.AIR, 'diagonal ore pulled');
  assert.equal(at(s.run.grid, 2, 11, 2), T.AIR, 'other diagonal ore pulled');
  assert.equal(at(s.run.grid, 5, 11, 3), T.ORE, 'ore two blocks away stays');
  assert.equal(s.run.bag.length, before + 2);
});

test('a full bag slows digging but never stops it', () => {
  const s = D.newState(1);
  const cap = D.bagCap(s);
  assert.equal(D.weightFactor(s, cap), 1);
  const f1 = D.weightFactor(s, cap + 1), f10 = D.weightFactor(s, cap + 10), f99 = D.weightFactor(s, cap + 99);
  assert.ok(f1 < 1 && f10 < f1 && f99 > 0);
});

test('going home sells ores, shelves fossils and resumes in the same layer', () => {
  const s = D.newState(5); D.startDig(s, 0); runTapping(s, 120, 4);
  const ores = s.run.bag.filter(i => i.kind === 'ore').length;
  assert.ok(ores > 0, 'found some ore');
  const g = s.sites[0], y = s.run.y, top = D.topLayer(g);
  assert.ok(top === y || top === y + 1, `top layer ${top}, miner in ${y}`);
  D.goHome(s); run(s, 5);
  assert.equal(s.mode, 'surface');
  assert.ok(s.coins > 0);
  assert.equal(s.run.bag.length, 0);
  D.startDig(s, 0);
  for (let i = 0; i < 200 && s.mode !== 'dig'; i++) D.step(s, 0.05);
  assert.equal(s.mode, 'dig');
  assert.equal(s.run.y, y);
});

test('bringing the relic home unlocks the next world; the first relic block gives the relic', () => {
  const s = digAt(0, 3, D.DEPTH - 1, 3, { drill: 4 });
  s.relics[0] = false; s.unlocked[1] = false;
  const relicBreaks = [];
  for (let i = 0; i < 1200 && s.mode === 'dig'; i++) { D.tap(s); D.step(s, 0.05); relicBreaks.push(...breaks(s).filter(e => e.tile === T.RELIC)); s.events = []; }
  assert.ok(s.relics[0] || s.run.bag.some(i => i.kind === 'relic'), 'relic dug');
  assert.equal(s.run.bag.filter(i => i.kind === 'relic').length, 1, 'one relic; later relic blocks are treasure');
  assert.ok(relicBreaks.length >= 1);
  run(s, 10);
  assert.equal(s.mode, 'surface', 'auto-returned with relic');
  assert.equal(s.relics[0], true);
  assert.equal(s.unlocked[1], true);
  assert.ok(layerLeft(s.sites[0], D.DEPTH) < D.N * D.N, 'relic layer was dug into');
});

test('ocean: when oxygen runs out the miner floats home with its bag', () => {
  const s = digAt(1, 3, 30, 3);
  s.run.bag.push({ kind: 'ore', world: 1, idx: 0 });
  s.run.oxygen = 0.1;
  run(s, 1);
  assert.notEqual(s.mode, 'dig');
  run(s, 5);
  assert.equal(s.mode, 'surface');
  assert.ok(s.coins > 0, 'bag was kept and sold');
});

test('ocean: a bubble pocket in a neighbouring block refills oxygen', () => {
  const s = digAt(1, 3, 30, 3);
  D._setTile(s, 4, 30, 2, T.BUBBLE); D._setTile(s, 0, 30, 0, T.BEDROCK); D._setTile(s, 3, 31, 3, T.BEDROCK);
  s.run.oxygen = 10;
  D.step(s, 0.05);
  assert.equal(s.run.oxygen, D.O2_MAX);
  assert.equal(at(s.run.grid, 4, 30, 2), T.AIR);
});

test('jungle: breaking a trap stuns for about two seconds', () => {
  const s = digAt(2, 3, 10, 3, { drill: 12 });
  D._setTile(s, 3, 11, 3, T.TRAP);
  let stunnedFor = 0;
  for (let i = 0; i < 2000 && !s.stats.trapsSprung; i++) { D.tap(s); D.step(s, 0.05); }
  assert.equal(s.stats.trapsSprung, 1);
  for (let i = 0; i < 200 && s.run.stun > 0; i++) { stunnedFor += 0.05; D.step(s, 0.05); } // the first stun only
  assert.ok(stunnedFor > 1.5 && stunnedFor < 2.5, `stunned ${stunnedFor}s`);
});

test('alien: goo grows back while you drill it, so idle digging is slower and tapping wins', () => {
  const i = D.idx(3, 11, 3);
  const timeToBreak = (tile, taps) => {
    const s = digAt(4, 3, 10, 3, { drill: 3, speed: 2 });
    D._setTile(s, 3, 11, 3, T.GOO);
    const goo = s.run.grid.hp[i];
    D._setTile(s, 3, 11, 3, tile); s.run.grid.hp[i] = goo;
    let t = 0, acc = 0;
    while (s.run.grid.t[i] === tile && t < 600) { acc += taps * 0.05; while (acc >= 1) { D.tap(s); acc--; } D.step(s, 0.05); t += 0.05; }
    return t;
  };
  const gooIdle = timeToBreak(T.GOO, 0), dirtIdle = timeToBreak(T.DIRT, 0);
  const gooTap = timeToBreak(T.GOO, 4), dirtTap = timeToBreak(T.DIRT, 4);
  assert.ok(gooIdle < 600, 'idle digging still gets through goo');
  assert.ok(gooIdle > dirtIdle * 1.6, `goo idle ${gooIdle.toFixed(1)}s vs dirt ${dirtIdle.toFixed(1)}s`);
  assert.ok(gooIdle / gooTap > dirtIdle / dirtTap, 'tapping helps more on goo than on dirt');
});

test('alien: goo you leave half-dug heals back', () => {
  const s = digAt(4, 3, 10, 3, { drill: 3 });
  D._setTile(s, 3, 11, 3, T.GOO); D._setTile(s, 3, 11, 4, T.BEDROCK);
  const i = D.idx(3, 11, 3);
  D.step(s, 0.3);
  const hit = s.run.grid.hp[i];
  assert.ok(hit < D.maxHp(4, T.GOO, 11));
  D.steer(s, 's'); D.step(s, 1.5);
  assert.equal(s.run.z, 4);
  assert.ok(s.run.grid.hp[i] > hit, 'goo regrew');
});

test('moon: ore pops out as loot that bounces in 3D and is collected afterwards', () => {
  const s = digAt(3, 3, 10, 3, { drill: 16 });
  D._clearLayer(s, 11); D._setTile(s, 3, 11, 3, T.ORE, 0);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) D._setTile(s, x, 12, z, T.BEDROCK);
  for (let i = 0; i < 4000 && s.run.loot.length === 0 && s.run.bag.length === 0; i++) { D.tap(s); D.step(s, 0.05); }
  assert.equal(s.run.loot.length, 1, 'loot is floating');
  const l = s.run.loot[0];
  for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.equal(typeof l[k], 'number', k);
  let moved = false;
  for (let i = 0; i < 10 && s.run.loot.length; i++) {
    const z0 = s.run.loot[0].z, x0 = s.run.loot[0].x; D.step(s, 0.05);
    if (s.run.loot.length && (s.run.loot[0].z !== z0 || s.run.loot[0].x !== x0)) moved = true;
  }
  assert.ok(moved, 'loot moves sideways');
  run(s, 8);
  assert.equal(s.run.loot.length, 0);
  assert.ok(s.run.bag.some(b => b.kind === 'ore'));
});

test('upgrades cost more each level and cannot be bought without coins', () => {
  const s = D.newState(1);
  assert.equal(D.buyUpgrade(s, 'drill'), false);
  s.coins = 1e9;
  const c0 = D.upgradeCost(s, 'drill');
  assert.equal(D.buyUpgrade(s, 'drill'), true);
  assert.equal(s.coins, 1e9 - c0);
  assert.ok(D.upgradeCost(s, 'drill') > c0);
  for (const k of ['bag', 'speed', 'magnet']) assert.equal(D.buyUpgrade(s, k), true);
  assert.equal(D.bagCap(s) > D.bagCap(D.newState(1)), true);
});

test('museum: a finished exhibit draws visitors, staff and diggers can be hired', () => {
  const s = D.newState(1);
  assert.equal(D.museumIncome(s), 0);
  for (let i = 0; i < 5; i++) s.museum[0].pieces[i] = 1;
  const inc = D.museumIncome(s);
  assert.ok(inc > 0);
  s.coins = 1e9;
  assert.equal(D.hire(s, 'staff'), true);
  assert.ok(D.museumIncome(s) > inc);
  assert.equal(D.hire(s, 'diggers'), true);
  const before = s.coins; D.step(s, 10);
  assert.ok(s.coins > before, 'visitors pay while the game runs');
});

test('save and load round-trip', () => {
  const s = D.newState(5); D.startDig(s, 0); runTapping(s, 60, 3); D.goHome(s); run(s, 5);
  const s2 = D.deserialize(D.serialize(s));
  assert.equal(s2.coins, s.coins);
  assert.deepEqual(s2.upgrades, s.upgrades);
  assert.deepEqual([...s2.sites[0].t], [...s.sites[0].t]);
  assert.equal(s2.sites[0].deepest, s.sites[0].deepest);
  assert.equal(s2.sites[0].deepestX, s.sites[0].deepestX);
  assert.equal(s2.sites[0].deepestZ, s.sites[0].deepestZ);
  assert.equal(D.deserialize('garbage'), null);
});

test('a save from the old flat 11-wide world keeps progress and starts a fresh 3D dig site', () => {
  const old = JSON.stringify({ v: 1, seed: 5, rng: 1, coins: 1234, unlocked: [true, true, false, false, false],
    relics: [true, false, false, false, false], upgrades: { drill: 3, speed: 2, bag: 1, magnet: 0 }, workers: { diggers: 1, staff: 0 },
    museum: [0, 1, 2, 3, 4].map(() => ({ pieces: [1, 0, 0, 0, 0] })), world: 1, stats: { trapsSprung: 0, timePlayed: 10, digs: 5 }, bag: [],
    sites: [{ t: new Array(11 * 102).fill(1), v: new Array(11 * 102).fill(0), deepest: 40, deepestX: 5, gen: 0 }, null, null, null, null] });
  const s = D.deserialize(old);
  assert.ok(s);
  assert.equal(s.coins, 1234);
  assert.equal(s.upgrades.drill, 3);
  assert.equal(s.unlocked[1], true);
  const g = D.site(s, 0);
  assert.equal(g.t.length, D.N * D.N * (D.DEPTH + 2));
  assert.equal(g.deepest, 0);
});

// A simple bot standing in for a kid: lets the miner walk and dig on its own,
// taps 3 times a second, heads home when the bag is full or every 2.5 minutes,
// and spends on the cheapest upgrade (bag and magnet weighted down).
function shop(s) {
  for (let g = 0; g < 80; g++) {
    const o = ['drill', 'speed', 'bag', 'magnet']
      .map(k => [k, D.upgradeCost(s, k) * (k === 'bag' ? 2 : k === 'magnet' ? 1.5 : 1)])
      .filter(([, c]) => isFinite(c)).sort((a, b) => a[1] - b[1]);
    if (!o.length || D.upgradeCost(s, o[0][0]) > s.coins) break;
    D.buyUpgrade(s, o[0][0]);
  }
}
function botPlay(s, w, stats) {
  const dt = 0.1; let t = 0, acc = 0, lastHome = 0;
  D.startDig(s, w);
  while (!s.relics[w] && t < 3 * 3600) {
    if (s.mode === 'dig') {
      acc += 3 * dt; while (acc >= 1) { D.tap(s); acc--; }
      if (s.run.bag.length >= D.bagCap(s)) { D.goHome(s); stats.fullBag++; }
      else if (t - lastHome > 150) D.goHome(s);
    }
    D.step(s, dt); t += dt;
    if (s.mode === 'surface' && !s.relics[w]) { lastHome = t; shop(s); D.startDig(s, w); }
  }
  return t;
}

test('the first upgrade is affordable after one trip', () => {
  const s = D.newState(2024); D.startDig(s, 0);
  let t = 0, acc = 0;
  while (s.mode !== 'surface' || t === 0) {
    if (s.mode === 'dig') { acc += 3 * 0.1; while (acc >= 1) { D.tap(s); acc--; } if (s.run.bag.length >= D.bagCap(s) || t > 150) D.goHome(s); }
    D.step(s, 0.1); t += 0.1;
  }
  const cheapest = Math.min(...['drill', 'speed', 'bag', 'magnet'].map(k => D.upgradeCost(s, k)));
  assert.ok(s.coins >= cheapest, `earned ${s.coins} vs cheapest ${cheapest}`);
});

test('playthrough: each world takes a kid-sized 15–35 minutes, all five finish, and a full bag sends the miner home', () => {
  const s = D.newState(2024);
  const mins = [], stats = { fullBag: 0 };
  for (let w = 0; w < 5; w++) {
    assert.ok(s.unlocked[w], `world ${w} unlocked`);
    mins.push(botPlay(s, w, stats) / 60);
    assert.ok(s.relics[w], `world ${w} relic`);
  }
  console.log('bot minutes per world:', mins.map(m => m.toFixed(1)).join(', '), '| trips home with a full bag:', stats.fullBag);
  for (const m of mins) assert.ok(m >= 15 && m <= 35, `world took ${m.toFixed(1)} min`);
  assert.ok(stats.fullBag >= 10, `${stats.fullBag} trips home with a full bag`);
});
