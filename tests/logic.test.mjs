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
  for (let t = 0; t < secs; t += dt) { acc += tps * dt; while (acc >= 1) { D.tap(s); acc--; } if (s.run && s.run.lock) D.lockSmash(s); D.step(s, dt); }
};
const at = (g, x, y, z) => g.t[D.idx(x, y, z)];
// one entry per buried fossil piece (a big piece spans several cells): the fossilAt of its first cell
const fossilGroups = g => { const out = []; for (let i = 0; i < g.t.length; i++) { const f = D.fossilAt(g, i); if (f && i === f.cells[0]) out.push(f); } return out; };
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
// what one tap on pin k does to the pins: it moves up one, and so do its linked neighbours (right only, or both sides)
const tapPins = (pins, k, link) => pins.map((v, j) => (j === k || (j === k + 1 && link >= 1) || (j === k - 1 && link === 2)) ? (v + 1) % D.LOCK_LEVELS : v);
// the fewest taps that open a lock, found by searching every pin setting
const lockPlan = L => {
  const goal = L.key.join(), seen = new Map([[L.pins.join(), []]]), q = [L.pins.slice()];
  while (q.length) {
    const p = q.shift(), plan = seen.get(p.join());
    if (p.join() === goal) return plan;
    for (let k = 0; k < p.length; k++) { const n = tapPins(p, k, L.link); if (!seen.has(n.join())) { seen.set(n.join(), plan.concat(k)); q.push(n); } }
  }
  return null;
};
// sliding tiles: tiles[i] is the tile number (0 is the blank) at cell i; the solved board counts 1.. with the blank last
const slideNeighbours = (n, b) => [b - n, b + n, b % n ? b - 1 : -1, b % n < n - 1 ? b + 1 : -1].filter(j => j >= 0 && j < n * n);
const slideGoal = n => Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
// the tiles to tap to solve it: iterative deepening on the Manhattan distance, so the plan is the shortest
const slidePlan = L => {
  const n = L.n, goal = slideGoal(n).join();
  const h = a => a.reduce((sum, v, i) => v ? sum + Math.abs(Math.floor(i / n) - Math.floor((v - 1) / n)) + Math.abs(i % n - (v - 1) % n) : sum, 0);
  const plan = [];
  const dfs = (a, b, g, bound, prev) => {
    const f = g + h(a); if (f > bound) return f;
    if (a.join() === goal) return -1;
    let min = Infinity;
    for (const j of slideNeighbours(n, b)) {
      if (j === prev) continue;
      const c = a.slice(); c[b] = c[j]; c[j] = 0; plan.push(j);
      const r = dfs(c, j, g + 1, bound, b);
      if (r === -1) return -1;
      plan.pop(); if (r < min) min = r;
    }
    return min;
  };
  const start = [...L.tiles];
  for (let bound = h(start); bound < 80;) { const r = dfs(start, start.indexOf(0), 0, bound, -1); if (r === -1) return plan.slice(); bound = r; }
  return null;
};
// pipes: walk from the inlet, turning each tile so it takes the water in from the side it came from and out of another;
// returns the taps (one per quarter turn) that do it, or null
const pipePlan = L => {
  const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0]; // N E S W
  const used = new Set(), turns = [];
  const go = (row, col, from) => {
    const k = row * L.n + col, tile = L.tiles[k]; used.add(k);
    for (let r = 0; r < 4; r++) {
      const sides = D.pipeSides(tile.t, r); if (!sides[from]) continue;
      for (let d = 0; d < 4; d++) {
        if (d === from || !sides[d]) continue;
        turns.push([k, (r - tile.r + 4) % 4]);
        if (col === L.n - 1 && row === L.outlet && d === 1) return true;
        const nr = row + DZ[d], nc = col + DX[d];
        if (nr >= 0 && nr < L.n && nc >= 0 && nc < L.n && !used.has(nr * L.n + nc) && go(nr, nc, (d + 2) % 4)) return true;
        turns.pop();
      }
    }
    used.delete(k); return false;
  };
  if (!go(L.inlet, 0, 3)) return null;
  return turns.flatMap(([k, n]) => Array(n).fill(k));
};
// solve whatever puzzle the chest holds, as a careful player would
const solveLock = s => {
  const L = s.run.lock;
  if (L.kind === 'pins') { const plan = lockPlan(L); for (const k of plan) D.lockTap(s, k); return plan.length; }
  if (L.kind === 'pairs') { // perfect memory: flip each pair by looking up the matching card
    let taps = 0;
    for (let a = 0; a < L.cards.length && s.run.lock; a++) if (!L.done[a]) {
      const b = L.cards.findIndex((c, j) => j !== a && c === L.cards[a]);
      D.lockTap(s, a); D.lockTap(s, b); taps += 2;
    }
    return taps;
  }
  if (L.kind === 'slide') { const plan = slidePlan(L); for (const k of plan) D.lockTap(s, k); return plan.length; }
  if (L.kind === 'pipes') { const plan = pipePlan(L); for (const k of plan) D.lockTap(s, k); return plan.length; }
  if (L.kind === 'odd') { let taps = 0; while (s.run.lock) { D.lockTap(s, s.run.lock.odd); taps++; } return taps; }
  if (L.kind === 'path') { D.step(s, L.show + 0.01); for (let n = 1; n <= L.n; n++) D.lockTap(s, L.cells.indexOf(n)); return L.n; }
  D.step(s, L.show + 0.01); // watch the sequence, then play it back
  for (const k of L.seq.slice()) D.lockTap(s, k);
  return L.seq.length;
};
// the naive way: left to right, tap each pin until it matches the key (gives up after a few rounds)
const greedyOpens = L => {
  let p = L.pins.slice();
  for (let k = 0; k < p.length; k++) for (let t = 0; t < D.LOCK_LEVELS && p[k] !== L.key[k]; t++) p = tapPins(p, k, L.link);
  return p.join() === L.key.join();
};

test('five worlds with distinct biomes and distinct rules', () => {
  assert.equal(D.WORLDS.length, 5);
  const ids = new Set(D.WORLDS.map(w => w.id));
  const rules = new Set(D.WORLDS.map(w => w.rule));
  assert.equal(ids.size, 5);
  assert.equal(rules.size, 5);
  assert.deepEqual([...ids], ['forest', 'ocean', 'jungle', 'moon', 'alien']);
  for (const w of D.WORLDS) {
    assert.equal(w.ores.length, 6, w.id);
    assert.equal(w.creatures.length, 3, w.id);
    for (const c of w.creatures) assert.equal(c.parts.length, 5, c.name);
    assert.equal(w.fossils.length, 15, w.id);
    assert.ok(w.relic && w.relic.name, w.id);
  }
});

test('new game: only the first world is open', () => {
  const s = D.newState(1);
  assert.deepEqual([...s.unlocked], [true, false, false, false, false]);
  assert.equal(s.mode, 'surface');
  assert.throws(() => D.startDig(s, 1));
});

test('the world is a 7×7 column of ground, 50 layers deep, indexed (y*N + z)*N + x', () => {
  assert.equal(D.N, 7);
  assert.equal(D.DEPTH, 50);
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
      const n = fossilGroups(a).filter(f => f.idx === p).length;
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
    s.carry = []; // as if each bone were handed in at once, so fossils never hold up the layer
    D.tap(s); if (s.run.lock) D.lockSmash(s); D.step(s, 0.05);
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

test('a tap on an open cell of the layer walks the miner there, round blocks, without digging', () => {
  const s = digAt(0, 0, 10, 0, { drill: 8 });
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) D._setTile(s, x, 11, z, T.BEDROCK); // stay in this layer
  for (let z = 0; z < 6; z++) D._setTile(s, 3, 10, z, T.STONE); // a wall with a gap at z = 6
  s.events = [];
  assert.equal(D.digAt(s, 5, 0), true, 'an open cell is a walk target');
  run(s, 3);
  assert.deepEqual([s.run.x, s.run.z], [5, 0], 'walked round the wall to the tapped cell');
  assert.equal(breaks(s).length, 0, 'no block was dug on the way');
  assert.equal(D.digAt(s, 5, 0), false, 'tapping the cell the miner stands on does not walk');
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

test('after a steer the miner stays where it was put for a moment before auto-walking again', () => {
  const s = digAt(0, 1, 10, 1);
  D._setTile(s, 6, 10, 6, T.DIRT); // the only block, far away
  D.steer(s, 'e'); run(s, 0.05);
  assert.deepEqual([s.run.x, s.run.z], [2, 1]);
  run(s, D.MANUAL_HOLD - 0.3);
  assert.deepEqual([s.run.x, s.run.z], [2, 1], 'auto-walk waits');
  run(s, 2);
  assert.notDeepEqual([s.run.x, s.run.z], [2, 1], 'then auto-walk takes over');
});

test('steering held down walks at walking pace, not a cell per frame', () => {
  const s = digAt(0, 0, 10, 3);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) D._setTile(s, x, 11, z, T.BEDROCK);
  for (let t = 0; t < 0.5; t += 0.05) { D.steer(s, 'e'); D.step(s, 0.05); }
  assert.ok(s.run.x >= 2 && s.run.x <= Math.ceil(D.WALK * 0.5) + 1, `moved ${s.run.x} cells in 0.5 s`);
});

test('left alone the miner walks and digs slower than when the player steers it', () => {
  assert.ok(D.AUTO_PACE > 0 && D.AUTO_PACE < 1);
  // walking: the only block is far away, so auto-walk crosses the layer
  const w = digAt(0, 0, 10, 0);
  D._setTile(w, 6, 10, 6, T.DIRT);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (x || z) D._setTile(w, x, 11, z, T.BEDROCK);
  run(w, 1);
  const autoCells = Math.max(w.run.x, w.run.z);
  assert.ok(autoCells <= Math.ceil(D.WALK * D.AUTO_PACE) + 1, `auto-walk went ${autoCells} cells in 1 s`);
  // digging: the same stone block, once on its own and once steered into
  const timeToBreak = steerIt => {
    const s = digAt(0, 3, 30, 3);
    D._setTile(s, 4, 30, 3, T.STONE);
    let t = 0;
    if (steerIt) D.steer(s, 'e');
    while (at(s.run.grid, 4, 30, 3) === T.STONE && t < 120) { D.step(s, 0.05); t += 0.05; }
    return t;
  };
  const auto = timeToBreak(false), steered = timeToBreak(true);
  assert.ok(steered < auto * 0.7, `steered ${steered.toFixed(2)} s vs auto ${auto.toFixed(2)} s`);
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

// layer 10 with the miner at (3, 10, 3), one far dirt block so the layer stays open, and an ore at (4, 10, 3) to dig
function oreSetup(up = {}, w = 0) {
  const s = digAt(w, 3, 10, 3, Object.assign({ drill: 16 }, up));
  D._setTile(s, 0, 10, 0, T.DIRT);
  D._setTile(s, 4, 10, 3, T.ORE, 0);
  D.setAuto(s, false);
  return s;
}
const digEast = s => { D.steer(s, 'e'); for (let i = 0; i < 200 && at(s.run.grid, 4, 10, 3) === T.ORE; i++) { D.tap(s); D.step(s, 0.05); } };

test('a find drops on the floor where its block was and stays out of reach', () => {
  const s = oreSetup();
  digEast(s);
  assert.equal(at(s.run.grid, 4, 10, 3), T.AIR);
  assert.equal(s.run.bag.length, 0, 'not in the bag yet');
  assert.equal(s.run.loot.length, 1);
  const l = s.run.loot[0];
  assert.equal(Math.floor(l.x), 4); assert.equal(Math.floor(l.z), 3); assert.equal(l.item.kind, 'ore');
  run(s, 1);
  assert.equal(s.run.loot.length, 1, 'a cell away is out of the base reach');
  assert.equal(s.run.bag.length, 0);
});

test('going home sweeps up loot left on the floor, and a save keeps it in the bag', () => {
  const s = oreSetup();
  digEast(s);
  assert.equal(JSON.parse(D.serialize(s)).bag.length, 1, 'saved with the bag');
  D.goHome(s);
  assert.equal(s.run.loot.length, 0); assert.equal(s.run.bag.length, 1);
  run(s, 6);
  assert.equal(s.mats[0], 1, 'and the coal went to the stash');
});

test('walking onto loot picks it up', () => {
  const s = oreSetup();
  digEast(s);
  D.steer(s, 'e'); run(s, 1);
  assert.equal(s.run.x, 4);
  assert.equal(s.run.loot.length, 0);
  assert.equal(s.run.bag.length, 1);
  assert.ok(s.events.some(e => e.type === 'collect' && e.at), 'the pick-up says where the loot was');
});

test('a better magnet pulls loot in from further away', () => {
  const left = m => {
    const s = oreSetup({ magnet: m });
    digEast(s); s.events = [];
    D._teleport(s, 1, 10, 3); // three cells west of the loot
    run(s, 2);
    return s.run.loot.length;
  };
  assert.equal(D.pickupReach(0), 0.75); assert.equal(D.pickupReach(3), 3.75);
  assert.equal(left(0), 1); assert.equal(left(1), 1); assert.equal(left(2), 1);
  assert.equal(left(3), 0, 'magnet 3 reaches the loot three cells away (3.75)');
  const s = oreSetup({ magnet: 1 }); digEast(s);
  run(s, 1);
  assert.equal(s.run.loot.length, 0, 'magnet 1 pulls in the find from the next cell');
  assert.equal(s.run.bag.length, 1); assert.equal(s.run.x, 3, 'without the miner moving');
});

test('auto-mining digs a block that is nearer than the loot first', () => {
  const s = oreSetup(); digEast(s);
  D._teleport(s, 1, 10, 3); D._setTile(s, 1, 10, 4, T.DIRT); D.setAuto(s, true); // loot three cells east, a block right beside
  for (let i = 0; i < 400 && at(s.run.grid, 1, 10, 4) === T.DIRT; i++) D.step(s, 0.05);
  assert.equal(at(s.run.grid, 1, 10, 4), T.AIR, 'the near block was dug');
  assert.equal(s.run.loot.length, 1, 'before the loot was fetched');
});

test('auto-mining collects loot nearer than the next block first', () => {
  const s = oreSetup(); D.setAuto(s, true);
  for (let i = 0; i < 4000 && s.run.bag.length === 0; i++) D.step(s, 0.05);
  assert.equal(s.run.bag.length, 1, 'ore collected');
  assert.equal(at(s.run.grid, 0, 10, 0), T.DIRT, 'before the far block was touched');
});

test('loot left in a cleared layer goes into the bag and does not hold up the dig', () => {
  const s = digAt(0, 3, 10, 3, { drill: 16 });
  D._setTile(s, 4, 10, 3, T.ORE, 0); D.setAuto(s, false);
  digEast(s);
  assert.equal(s.run.loot.length, 1);
  D._teleport(s, 1, 10, 3); // away from the find, out of reach
  for (let i = 0; i < 400 && s.run.y === 10; i++) D.step(s, 0.05);
  assert.ok(s.run.y > 10, 'the miner went on down');
  assert.equal(s.run.x, 1, 'without walking over to fetch it');
  assert.equal(s.run.loot.length, 0);
  assert.equal(s.run.bag.length, 1, 'with the find in the bag');
  assert.ok(s.events.some(e => e.type === 'collect' && e.at), 'picked up from where it lay');
});

test('a bone is only picked up with free hands; otherwise it stays on the floor', () => {
  const s = oreSetup();
  D._setTile(s, 4, 10, 3, T.AIR);
  s.carry = [{ kind: 'fossil', world: 0, idx: 4 }];
  s.run.loot.push({ x: 4.5, y: 10.75, z: 3.5, vx: 0, vy: 0, vz: 0, layer: 10, rest: true, age: 5, delay: 0.3, item: { kind: 'fossil', world: 0, idx: 0 } });
  D.steer(s, 'e'); run(s, 1);
  assert.equal(s.run.x, 4);
  assert.equal(s.run.loot.length, 1, 'new bone stays with hands full');
  s.carry = []; run(s, 0.5);
  assert.equal(s.run.loot.length, 0);
  assert.equal(s.carry.length, 1);
});

test('bag upgrades let the miner carry a few more bones at once', () => {
  assert.equal(D.boneCap({ upgrades: { bag: 0 } }), 1);
  assert.equal(D.boneCap({ upgrades: { bag: 5 } }), 1);
  assert.equal(D.boneCap({ upgrades: { bag: 6 } }), 2);
  assert.equal(D.boneCap({ upgrades: { bag: 20 } }), 4, 'a few, not a ton');
  const s = digAt(0, 3, 20, 3, { bag: 6 }); D.setAuto(s, false);
  D._setTile(s, 4, 20, 3, T.FOSSIL, 2); D._setTile(s, 2, 20, 3, T.FOSSIL, 3); D._setTile(s, 3, 20, 4, T.FOSSIL, 4);
  D.steer(s, 'e'); run(s, 15); D.steer(s, 'e'); run(s, 2);
  assert.equal(s.carry.length, 1);
  D.steer(s, 'w'); run(s, 1); D.steer(s, 'w'); run(s, 15); D.steer(s, 'w'); run(s, 2);
  assert.equal(at(s.run.grid, 2, 20, 3), T.AIR, 'the second bone is dug with one in hand');
  assert.equal(s.carry.length, 2, 'and carried too');
  s.events = []; D.steer(s, 'e'); run(s, 1); D.steer(s, 's'); run(s, 15);
  assert.equal(at(s.run.grid, 3, 20, 4), T.FOSSIL, 'the third waits: hands are full');
  assert.ok(s.events.some(e => e.type === 'boneFull'));
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
  assert.equal(s.mats[0], 1, 'the bag was kept');
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
  const i = D.idx(3, 6, 3);
  const timeToBreak = (tile, taps) => {
    const s = digAt(4, 3, 5, 3, { drill: 3, speed: 2 });
    D._setTile(s, 3, 6, 3, T.GOO);
    const goo = s.run.grid.hp[i];
    D._setTile(s, 3, 6, 3, tile); s.run.grid.hp[i] = goo;
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

test('moon: ore pops out as loot that bounces in 3D, settles and waits to be picked up', () => {
  const s = oreSetup({}, 3);
  digEast(s);
  assert.equal(s.run.loot.length, 1, 'loot is floating');
  assert.ok(!s.run.loot[0].rest, 'still bouncing');
  const l = s.run.loot[0];
  for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.equal(typeof l[k], 'number', k);
  let moved = false;
  for (let i = 0; i < 10 && s.run.loot.length; i++) {
    const z0 = s.run.loot[0].z, x0 = s.run.loot[0].x; D.step(s, 0.05);
    if (s.run.loot.length && (s.run.loot[0].z !== z0 || s.run.loot[0].x !== x0)) moved = true;
  }
  assert.ok(moved, 'loot moves sideways');
  run(s, 12);
  assert.equal(s.run.loot.length, 1, 'no drifting to the miner and no auto-collect');
  assert.equal(s.run.bag.length, 0);
  assert.ok(s.run.loot[0].rest, 'settled on the floor');
});

test('upgrades cost more each level and cannot be bought without coins', () => {
  const s = D.newState(1);
  assert.equal(D.buyUpgrade(s, 'drill'), false);
  s.coins = 1e9; s.mats = [1e9, 1e9, 1e9, 1e9, 1e9];
  const c0 = D.upgradeCost(s, 'drill');
  assert.equal(D.buyUpgrade(s, 'drill'), true);
  assert.equal(s.coins, 1e9 - c0.coins);
  assert.ok(D.upgradeCost(s, 'drill').coins > c0.coins);
  for (const k of ['bag', 'speed', 'magnet']) assert.equal(D.buyUpgrade(s, k), true);
  assert.equal(D.bagCap(s) > D.bagCap(D.newState(1)), true);
});

test('museum: a finished exhibit draws visitors, staff and diggers can be hired', () => {
  const s = D.newState(1);
  assert.equal(D.museumIncome(s), 0);
  for (let i = 0; i < 4; i++) s.museum[0].pieces[i] = 1;
  const part = D.museumIncome(s);
  s.museum[0].pieces[4] = 1;
  const inc = D.museumIncome(s);
  assert.ok(inc > part * 3, 'a finished skeleton pays far more than loose pieces');
  assert.equal(D.exhibitDone(s, 0, 0), true);
  assert.equal(D.exhibitDone(s, 0), false);
  s.coins = 1e9; s.mats = [1e9, 1e9, 1e9, 1e9, 1e9];
  assert.equal(D.hire(s, 'staff'), true);
  assert.ok(D.museumIncome(s) > inc);
  assert.equal(D.hire(s, 'diggers'), true);
});

test('museum coins pile up at the museum and are collected by walking in', () => {
  const s = D.newState(1);
  for (let i = 0; i < 5; i++) s.museum[0].pieces[i] = 1;
  const inc = D.museumIncome(s), before = s.coins;
  D.step(s, 10);
  assert.equal(s.coins, before, 'visitor coins do not go straight to the purse');
  assert.ok(Math.abs(s.pile - inc * 10) < 1e-6, 'they pile up at the museum');
  D.startDig(s, 0); D.step(s, 5);
  assert.ok(s.pile > inc * 14, 'the pile grows while digging too');
  const s2 = D.deserialize(D.serialize(s));
  assert.ok(Math.abs(s2.pile - s.pile) < 1e-6, 'the pile is saved');
  const H = D.HUB, row = H.rows.findIndex(r => r.includes('M'));
  s2.mode = 'surface'; s2.run = null; s2.events = [];
  s2.hub.x = H.rows[row].indexOf('M') + H.x0 + 0.5; s2.hub.z = row + H.z0 + 0.5;
  const pile = s2.pile, c0 = s2.coins;
  D.step(s2, 0.05);
  assert.ok(s2.coins >= c0 + Math.floor(pile), 'entering the museum collects the pile');
  assert.ok(s2.pile < 1);
  const e = s2.events.find(e => e.type === 'museumCash');
  assert.ok(e && e.coins >= Math.floor(pile), 'a museumCash event reports the sum');
});

test('helper diggers: two in the first world, one more for each world unlocked', () => {
  const s = D.newState(1); s.coins = 1e12; s.mats = [1e9, 1e9, 1e9, 1e9, 1e9];
  while (D.hire(s, 'diggers'));
  assert.equal(s.workers.diggers, 2);
  assert.equal(D.maxDiggers(s), 2);
  s.unlocked[1] = true; assert.equal(D.maxDiggers(s), 3);
  assert.equal(D.hire(s, 'diggers'), true); assert.equal(D.hire(s, 'diggers'), false);
  s.unlocked = [true, true, true, true, true]; while (D.hire(s, 'diggers'));
  assert.equal(s.workers.diggers, 6);
});

test('only as many helpers dig as the world allows', () => {
  const s = digAt(0, 0, 20, 0); s.workers.diggers = 6; D.setAuto(s, false);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (x + z > 0) D._setTile(s, x, 20, z, T.STONE);
  run(s, 2);
  assert.equal(s.run.crew.length, 2);
});

test('helpers have their own power and speed upgrades', () => {
  const s = D.newState(1); s.coins = 1e12; s.mats = [1e9, 1e9, 1e9, 1e9, 1e9];
  assert.ok(D.CREW_UPGRADES.crewDrill && D.CREW_UPGRADES.crewSpeed);
  const p0 = D.crewDamage(s), r0 = D.crewRate(s);
  s.upgrades.drill = 10; s.upgrades.speed = 10;
  assert.equal(D.crewDamage(s), p0, "the miner's pick does not make helpers hit harder");
  assert.equal(D.crewRate(s), r0);
  const c = D.upgradeCost(s, 'crewDrill');
  assert.ok(isFinite(c.coins) && c.mats[0] > 0);
  assert.equal(D.buyUpgrade(s, 'crewDrill'), true); assert.equal(D.buyUpgrade(s, 'crewSpeed'), true);
  assert.ok(D.crewDamage(s) > p0); assert.ok(D.crewRate(s) > r0);
  assert.ok(D.upgradeCost(s, 'crewDrill').coins > c.coins);
  const old = JSON.parse(D.serialize(D.newState(2))); old.upgrades = { drill: 1, speed: 0, bag: 0, magnet: 0 };
  const s2 = D.deserialize(JSON.stringify(old));
  assert.equal(s2.upgrades.crewDrill, 0, 'an old save gets the new upgrades at level 0');
  assert.equal(s2.upgrades.drill, 1);
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

test('a save from the 100-layer pits keeps progress, banks its bag and digs fresh 50-layer sites', () => {
  const deep = 100, cells = 7 * 7 * (deep + 2);
  const old = JSON.stringify({ v: 3, seed: 5, rng: 1, coins: 777, unlocked: [true, true, false, false, false], relics: [true, false, false, false, false],
    upgrades: { drill: 4, speed: 3, bag: 2, magnet: 1, crewDrill: 1, crewSpeed: 0 }, workers: { diggers: 2, staff: 1 },
    museum: [0, 1, 2, 3, 4].map(w => ({ pieces: w ? new Array(15).fill(0) : [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })), world: 1,
    stats: { trapsSprung: 0, timePlayed: 10, digs: 5 }, auto: true, carry: [{ kind: 'fossil', world: 0, idx: 2 }], pile: 12.5,
    bag: [{ kind: 'treasure', world: 1, value: 40 }],
    sites: [{ t: new Array(cells).fill(1), v: new Array(cells).fill(0), deepest: 70, deepestX: 3, deepestZ: 3, gen: 0 }, null, null, null, null] });
  const s = D.deserialize(old);
  assert.ok(s);
  assert.equal(s.coins, 777 + 40);
  assert.equal(s.upgrades.drill, 4);
  assert.equal(s.workers.diggers, 2);
  assert.equal(s.museum[0].pieces[1], 1);
  assert.equal(s.carry.length, 1);
  assert.equal(s.pile, 12.5);
  const g = D.site(s, 0);
  assert.equal(g.t.length, D.N * D.N * (D.DEPTH + 2));
  assert.equal(g.deepest, 0);
});

// A simple bot standing in for a kid: steers toward the nearest block in its layer (the miner
// walks and digs at full pace only while steered), taps 3 times a second, heads home when the bag is full or every 2.5 minutes,
// and spends on the cheapest upgrade (bag and magnet weighted down). An upgrade it is short of materials for it buys
// at the exchange (buyMat) when its coins stretch to that.
const costValue = c => c.coins + c.mats.reduce((a, n, t) => a + n * D.MAT_PRICE[t], 0);
function shop(s) {
  for (let g = 0; g < 80; g++) {
    const o = ['drill', 'speed', 'bag', 'magnet']
      .map(k => [k, costValue(D.upgradeCost(s, k)) * (k === 'bag' ? 2 : k === 'magnet' ? 1.5 : 1)])
      .filter(([, c]) => isFinite(c)).sort((a, b) => a[1] - b[1]);
    if (!o.length) break;
    const c = D.upgradeCost(s, o[0][0]);
    let need = c.coins;
    for (let t = 0; t < 5; t++) { const short = Math.max(0, c.mats[t] - s.mats[t]); if (short) need += D.matBuyPrice(s, t, short); }
    if (need > s.coins) break;
    for (let t = 0; t < 5; t++) { const short = Math.max(0, c.mats[t] - s.mats[t]); if (short) assert.equal(D.buyMat(s, t, short), true); }
    assert.equal(D.buyUpgrade(s, o[0][0]), true);
  }
}
function botSteer(s) {
  const r = s.run, g = r.grid;
  if (r.steer || !D.layerHasBlocks(g, r.y)) return;
  let best = null, bd = 1e9;
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) {
    if (!diggable(at(g, x, r.y, z))) continue;
    const d = Math.abs(x - r.x) + Math.abs(z - r.z); if (d < bd) { bd = d; best = [x, z]; }
  }
  for (const l of r.loot) { // walk onto finds lying in this layer first (a new bone waits while the hands are full)
    if (l.layer !== r.y || (l.item.kind === 'fossil' && s.carry.length)) continue;
    const x = Math.floor(l.x), z = Math.floor(l.z), d = Math.abs(x - r.x) + Math.abs(z - r.z);
    if (d > 0 && d - 0.5 < bd) { bd = d - 0.5; best = [x, z]; }
  }
  if (!best) return;
  const dx = best[0] - r.x, dz = best[1] - r.z;
  D.steer(s, Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : (dz > 0 ? 's' : 'n'));
}
// the bot hands its bone in at the museum desk (walking there is the plaza's job, tested in hub.test.mjs)
function handIn(s) {
  if (!s.carry.length) return;
  const H = D.HUB, row = H.rows.findIndex(r => r.includes('M'));
  s.hub.x = H.rows[row].indexOf('M') + H.x0 + 0.5; s.hub.z = row + H.z0 + 0.5; D.step(s, 0.05);
  s.hub = { x: -0.5, z: D.LADDER_Z + 0.5, input: null, path: null };
}
function botPlay(s, w, stats) {
  const dt = 0.1; let t = 0, acc = 0, lastHome = 0;
  D.startDig(s, w);
  while (!s.relics[w] && t < 3 * 3600) {
    if (s.mode === 'dig') {
      acc += 3 * dt; while (acc >= 1) { D.tap(s); acc--; }
      if (s.run.lock) { solveLock(s); t += 5; } // about five seconds to pick a lock
      botSteer(s);
      if (s.run.bag.length >= D.bagCap(s)) { D.goHome(s); stats.fullBag++; }
      else if (t - lastHome > 150) D.goHome(s);
      else if (s.events.some(e => e.type === 'boneFull')) D.goHome(s); // blocked by a bone in hand: take it to the museum
    }
    s.events = []; D.step(s, dt); t += dt;
    if (s.mode === 'surface' && !s.relics[w]) { lastHome = t; handIn(s); shop(s); D.startDig(s, w); }
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
  assert.ok(['drill', 'speed', 'bag', 'magnet'].some(k => D.canAfford(s, D.upgradeCost(s, k))), `earned ${s.coins} coins and [${s.mats}] without buying anything`);
});

test('playthrough: each world takes a kid-sized 8–20 minutes, all five finish, and a full bag sends the miner home', () => {
  const s = D.newState(2024);
  const mins = [], stats = { fullBag: 0 };
  for (let w = 0; w < 5; w++) {
    assert.ok(s.unlocked[w], `world ${w} unlocked`);
    mins.push(botPlay(s, w, stats) / 60);
    assert.ok(s.relics[w], `world ${w} relic`);
  }
  console.log('bot minutes per world:', mins.map(m => m.toFixed(1)).join(', '), '| trips home with a full bag:', stats.fullBag);
  for (const m of mins) assert.ok(m >= 8 && m <= 20, `world took ${m.toFixed(1)} min`);
  assert.ok(stats.fullBag >= 8, `${stats.fullBag} trips home with a full bag`);
});

test('each world buries two copies of all 15 fossil pieces, the first creature shallow and the last deep', () => {
  for (let w = 0; w < 5; w++) {
    const g = D.genWorld(w, 31), count = new Array(15).fill(0), depth = [[], [], []];
    for (const f of fossilGroups(g)) { count[f.idx]++; depth[Math.floor(f.idx / 5)].push(f.y); }
    assert.ok(count.every(c => c === 2), `world ${w}: ${count}`);
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(avg(depth[0]) < avg(depth[1]) && avg(depth[1]) < avg(depth[2]), `world ${w} creature depths`);
  }
});

test('every world has treasure chests, and a chest can hold a missing fossil piece', () => {
  for (let w = 0; w < 5; w++) {
    const g = D.genWorld(w, 8); let n = 0;
    for (let i = 0; i < g.t.length; i++) if (g.t[i] === T.CHEST) n++;
    assert.ok(n >= 15, `world ${w} has ${n} chests`);
  }
  let fossils = 0, coins = 0;
  for (let k = 0; k < 40; k++) {
    const s = digAt(0, 3, 10, 3); s.rng = k * 977;
    D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2); solveLock(s); run(s, 5);
    const got = s.run.bag.concat(s.carry).filter(b => b.kind === 'fossil' && b.chest).length; fossils += got; if (!got) coins++;
  }
  assert.ok(fossils > 5 && coins > 5, `${fossils} fossil chests, ${coins} coin chests`);
});

test('hired helpers dig blocks of their own into the bag, away from the miner', () => {
  const s = digAt(0, 0, 20, 0); s.workers.diggers = 2; D.setAuto(s, false);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (x + z > 0) D._setTile(s, x, 20, z, (x + z) % 2 ? T.ORE : T.DIRT, 0);
  s.events = [];
  run(s, 15);
  assert.equal(s.run.x, 0, 'the miner stayed put with auto-mining off'); assert.equal(s.run.z, 0);
  const b = breaks(s);
  assert.ok(b.length >= 4, `helpers broke ${b.length} blocks`);
  assert.ok(b.every(e => e.y === 20));
  assert.equal(s.run.bag.length, 0, 'nothing reached the bag from across the pit');
  assert.ok(s.run.loot.length >= 1, 'finds lie where the helpers broke their blocks');
  for (const l of s.run.loot) assert.ok(b.some(e => e.x === Math.floor(l.x) && e.z === Math.floor(l.z)), 'loot sits at its block');
  for (const c of s.run.crew) if (c.target >= 0) {
    const x = c.target % D.N, z = Math.floor(c.target / D.N) % D.N;
    assert.ok(Math.max(x, z) >= 2, 'helpers work at least two cells from the miner while they can');
  }
});

test('a helper springing a trap is dizzy itself; the miner is not', () => {
  const s = digAt(2, 0, 20, 0, {}); s.workers.diggers = 1; D.setAuto(s, false);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (x + z > 0) D._setTile(s, x, 20, z, x === 6 && z === 6 ? T.TRAP : T.STONE);
  s.run.crew = [{ target: D.idx(6, 20, 6), x: 6, z: 5, y: 20, face: 's', stun: 0 }];
  D._setTile(s, 6, 20, 5, T.AIR);
  run(s, 30);
  assert.equal(s.run.stun, 0);
  assert.equal(s.stats.trapsSprung, 0);
});

test('with auto-mining off the miner waits; a tap hits the block it faces', () => {
  const s = digAt(0, 3, 20, 3); D.setAuto(s, false);
  D._setTile(s, 4, 20, 3, T.DIRT); s.run.face = 'e';
  run(s, 5);
  assert.equal(at(s.run.grid, 4, 20, 3), T.DIRT, 'nothing happens on its own');
  for (let i = 0; i < 40 && at(s.run.grid, 4, 20, 3) === T.DIRT; i++) { D.tap(s); run(s, 0.25); }
  assert.equal(at(s.run.grid, 4, 20, 3), T.AIR, 'tapping digs the block in front');
  assert.equal(s.auto, false);
});

test('one steer into a block keeps digging it till it breaks, then stops there', () => {
  const s = digAt(0, 3, 20, 3); D.setAuto(s, false);
  D._setTile(s, 4, 20, 3, T.STONE); D._setTile(s, 5, 20, 3, T.STONE);
  D.steer(s, 'e'); run(s, 20);
  assert.equal(at(s.run.grid, 4, 20, 3), T.AIR);
  assert.equal(at(s.run.grid, 5, 20, 3), T.STONE, 'only the steered block');
  assert.equal(s.run.x, 3);
});

test('tapping a block walks the miner next to it and digs it', () => {
  const s = digAt(0, 0, 20, 0); D.setAuto(s, false);
  D._setTile(s, 6, 20, 6, T.DIRT); D._setTile(s, 1, 20, 0, T.DIRT);
  assert.equal(D.digAt(s, 6, 6), true);
  run(s, 12);
  assert.equal(at(s.run.grid, 6, 20, 6), T.AIR);
  assert.equal(at(s.run.grid, 1, 20, 0), T.DIRT, 'not the nearer one');
  assert.equal(Math.abs(s.run.x - 6) + Math.abs(s.run.z - 6), 1);
  assert.equal(D.digAt(s, 3, 3), true, 'an open cell is a walk target');
});

test('a v2 save keeps its one skeleton per world as the middle creature', () => {
  const s = D.newState(4); D.startDig(s, 0); run(s, 3); D.goHome(s); run(s, 4);
  const o = JSON.parse(D.serialize(s));
  o.v = 2; o.museum = [0, 1, 2, 3, 4].map(() => ({ pieces: [1, 0, 2, 0, 0] })); delete o.auto;
  const g = o.sites[0]; for (let i = 0; i < g.t.length; i++) if (g.t[i] === T.FOSSIL) g.v[i] = 3;
  const s2 = D.deserialize(JSON.stringify(o));
  assert.deepEqual([...s2.museum[0].pieces], [0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0]);
  const g2 = s2.sites[0]; for (let i = 0; i < g2.t.length; i++) if (g2.t[i] === T.FOSSIL) assert.equal(g2.v[i], 8);
  assert.equal(s2.auto, true);
});

test('a new dig turns up a fossil in layer 1 and a chest in layer 2, and a find every couple of layers near the top', () => {
  for (let w = 0; w < 5; w++) for (const seed of [1, 2, 3]) {
    const g = D.genWorld(w, seed), finds = [];
    for (let y = 1; y <= 12; y++) { let n = 0; for (let i = y * 49; i < (y + 1) * 49; i++) if (g.t[i] === T.FOSSIL || g.t[i] === T.CHEST) n++; finds.push(n); }
    assert.ok(finds[0] >= 1, `world ${w} seed ${seed}: layer 1`);
    let chest2 = false; for (let i = 2 * 49; i < 3 * 49; i++) if (g.t[i] === T.CHEST) chest2 = true;
    assert.ok(chest2, `world ${w} seed ${seed}: chest in layer 2`);
    assert.ok(finds.reduce((a, b) => a + b, 0) >= 8, `world ${w} seed ${seed}: ${finds}`);
  }
});

test('a new bone is carried on its own; while it is carried fossil blocks stay in the ground', () => {
  const s = digAt(0, 3, 20, 3); D.setAuto(s, false);
  D._setTile(s, 4, 20, 3, T.FOSSIL, 2); D._setTile(s, 2, 20, 3, T.FOSSIL, 3);
  D.steer(s, 'e'); run(s, 15);
  assert.equal(s.carry.length, 0, 'the bone lies on the floor first');
  D.steer(s, 'e'); run(s, 2);
  assert.equal(s.carry.length, 1, 'the first bone is in hand');
  assert.equal(s.run.bag.length, 0, 'not in the bag');
  s.events = []; D.steer(s, 'w'); run(s, 1); D.steer(s, 'w'); run(s, 15);
  assert.equal(at(s.run.grid, 2, 20, 3), T.FOSSIL, 'the second stays in the ground');
  assert.ok(s.events.some(e => e.type === 'boneFull'), 'the player is told to hand the bone in');
  D.setAuto(s, true); run(s, 10);
  assert.equal(at(s.run.grid, 2, 20, 3), T.FOSSIL, 'auto-mining leaves it too');
  assert.equal(s.run.y, 20, 'the layer is not finished while a fossil is left');
});

test('reaching a chest opens a lock instead of breaking it, and the dig waits for the player', () => {
  const s = digAt(0, 3, 10, 3); D.setAuto(s, false); s.events = [];
  D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2);
  assert.ok(s.run.lock, 'a lock is open');
  assert.equal(s.run.lock.i, D.idx(4, 10, 3));
  assert.equal(at(s.run.grid, 4, 10, 3), T.CHEST, 'the chest is still shut');
  assert.ok(s.events.some(e => e.type === 'lock'));
  const before = JSON.stringify([s.run.x, s.run.z, s.run.oxygen]); run(s, 5);
  assert.equal(JSON.stringify([s.run.x, s.run.z, s.run.oxygen]), before, 'nothing moves while the lock is open');
  assert.equal(at(s.run.grid, 4, 10, 3), T.CHEST);
});

test('locks are always solvable; they grow from 4 to 6 pins, and after the first world a tap moves the pins on both sides', () => {
  assert.equal(D.LOCK_LEVELS, 4);
  const greedy = [0, 0, 0, 0, 0];
  for (let w = 0; w < 5; w++) for (let k = 0; k < 30; k++) {
    const s = digAt(w, 3, 10, 3); s.rng = k * 131 + 7; D.setAuto(s, false); D._lockKind('pins');
    D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2); D._lockKind(null);
    const L = s.run.lock;
    assert.equal(L.pins.length, [4, 4, 5, 5, 6][w]);
    assert.equal(L.link, w === 0 ? 1 : 2);
    assert.notDeepEqual([...L.pins], [...L.key], 'it starts locked');
    if (greedyOpens(L)) greedy[w]++;
    const before = [...L.pins], mid = Math.min(2, L.pins.length - 1);
    D.lockTap(s, mid); assert.deepEqual([...s.run.lock.pins], tapPins(before, mid, L.link), 'a tap moves the pin and its linked neighbours');
    solveLock(s);
    assert.equal(s.run.lock, null, `world ${w} lock ${k} solved`);
    assert.equal(at(s.run.grid, 4, 10, 3), T.AIR);
  }
  assert.equal(greedy[0], 30, 'the first world is the tutorial: left to right always works');
  for (let w = 1; w < 5; w++) assert.ok(greedy[w] <= 10, `world ${w}: left to right opened ${greedy[w]} of 30 locks`);
});

const openChest = (w, kind, rng) => {
  const s = digAt(w, 3, 10, 3); if (rng !== undefined) s.rng = rng; D.setAuto(s, false); D._lockKind(kind);
  D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2); D._lockKind(null);
  return s;
};

test('pairs: two cards flip at a time; a match stays up, a miss turns back over, all pairs open the chest', () => {
  for (let w = 0; w < 5; w++) {
    const s = openChest(w, 'pairs', 11 + w), L = s.run.lock;
    assert.equal(L.cards.length, [8, 12, 12, 16, 16][w]);
    for (let c = 0; c < L.cards.length / 2; c++) assert.equal(L.cards.filter(x => x === c).length, 2, 'each symbol twice');
    const a = 0, miss = L.cards.findIndex(c => c !== L.cards[0]), hit = L.cards.findIndex((c, j) => j && c === L.cards[0]);
    D.lockTap(s, a); D.lockTap(s, miss);
    assert.deepEqual([...L.up], [a, miss], 'both face up for a moment');
    D.lockTap(s, [...L.cards.keys()].find(j => j !== a && j !== miss)); assert.deepEqual([...L.up], [a, miss], 'no third card while a miss is showing');
    run(s, 1.2); assert.equal(L.up.length, 0, 'the miss turned back over');
    D.lockTap(s, a); D.lockTap(s, hit);
    assert.ok(L.done[a] && L.done[hit] && L.up.length === 0, 'a match stays face up');
    solveLock(s);
    assert.equal(s.run.lock, null, `world ${w} opened`); assert.equal(at(s.run.grid, 4, 10, 3), T.AIR);
  }
});

test('simon: watch the gems, then tap them back in order; a wrong tap replays the sequence', () => {
  for (let w = 0; w < 5; w++) {
    const s = openChest(w, 'simon', 5 + w), L = s.run.lock;
    assert.equal(L.seq.length, [4, 5, 5, 6, 7][w]);
    assert.ok(L.seq.every(k => k >= 0 && k < D.SIMON_PADS));
    assert.ok(L.show > 0, 'it starts by showing the sequence');
    D.lockTap(s, L.seq[0]); assert.equal(L.pos, 0, 'taps while it plays are ignored');
    D.step(s, L.show + 0.01);
    D.lockTap(s, L.seq[0]); assert.equal(L.pos, 1);
    D.lockTap(s, (L.seq[1] + 1) % D.SIMON_PADS);
    assert.equal(L.pos, 0); assert.ok(L.show > 0, 'a wrong tap plays it again');
    solveLock(s);
    assert.equal(s.run.lock, null, `world ${w} opened`);
  }
});

test('chests hold seven kinds of puzzle and never the same kind twice in a row', () => {
  const s = digAt(1, 3, 10, 3); D.setAuto(s, false);
  const kinds = [];
  for (let k = 0; k < 40; k++) {
    D._setTile(s, 4, 10, 3, T.CHEST); D._teleport(s, 3, 10, 3); D.steer(s, 'e'); run(s, 2);
    if (!s.run.lock) throw new Error('no lock at ' + k + ' after ' + kinds.slice(-3)); kinds.push(s.run.lock.kind); solveLock(s); run(s, 1);
  }
  assert.deepEqual(new Set(kinds), new Set(['pins', 'pairs', 'simon', 'slide', 'pipes', 'odd', 'path']));
  for (let k = 1; k < kinds.length; k++) assert.notEqual(kinds[k], kinds[k - 1]);
});

test('slide: a 3×3 board in the first worlds and 4×4 later, scrambled by legal moves so it can always be solved, short in early worlds', () => {
  assert.deepEqual([...D.SLIDE_K], [8, 14, 20, 24, 32]);
  const need = [0, 0, 0, 0, 0];
  for (let w = 0; w < 5; w++) for (let k = 0; k < 6; k++) {
    const s = openChest(w, 'slide', 20 * w + k), L = s.run.lock, n = w < 3 ? 3 : 4;
    assert.equal(L.n, n); assert.equal(L.tiles.length, n * n);
    assert.deepEqual([...L.tiles].sort((a, b) => a - b), slideGoal(n).sort((a, b) => a - b), 'one of each tile and a blank');
    assert.notDeepEqual([...L.tiles], slideGoal(n), 'it starts scrambled');
    const plan = slidePlan(L); assert.ok(plan && plan.length <= D.SLIDE_K[w], `world ${w} needs ${plan && plan.length} moves`);
    need[w] += plan.length;
    // a tile away from the blank does nothing; one beside it slides in
    const b = L.tiles.indexOf(0), far = [...L.tiles.keys()].find(j => j !== b && !slideNeighbours(n, b).includes(j));
    const before = [...L.tiles]; D.lockTap(s, far); assert.deepEqual([...L.tiles], before, 'a far tile stays put');
    D.lockTap(s, plan[0]); assert.equal(L.tiles[b], before[plan[0]]); assert.equal(L.tiles[plan[0]], 0);
    D.lockTap(s, b); D.lockTap(s, plan[0]); // slide it back and forth: still not solved
    assert.ok(s.run.lock, 'wandering does not open it');
    solveLock(s);
    assert.equal(s.run.lock, null, `world ${w} board ${k} solved`); assert.equal(at(s.run.grid, 4, 10, 3), T.AIR);
  }
  assert.ok(need[0] < need[4], `moves needed grow: ${need}`);
});

test('pipes: turn tiles so water runs from the left edge to the right edge; every board can be solved and it starts unsolved', () => {
  assert.deepEqual([...D.PIPE_N], [3, 4, 4, 5, 5]);
  for (let w = 0; w < 5; w++) for (let k = 0; k < 20; k++) {
    const s = openChest(w, 'pipes', 31 * w + k), L = s.run.lock;
    assert.equal(L.n, D.PIPE_N[w]); assert.equal(L.tiles.length, L.n * L.n);
    assert.ok(L.inlet >= 0 && L.inlet < L.n && L.outlet >= 0 && L.outlet < L.n);
    assert.equal(D.pipeDone(L), false, 'it starts dry');
    const plan = pipePlan(L); assert.ok(plan, 'a path exists');
    const far = L.tiles.length - 1, t0 = L.tiles[far].r;
    D.lockTap(s, far); assert.equal(L.tiles[far].r, (t0 + 1) % 4, 'a tap turns the tile a quarter turn clockwise');
    D.lockTap(s, L.n * L.n); assert.equal(L.tiles[far].r, (t0 + 1) % 4, 'there is no tile past the last');
    solveLock(s);
    assert.equal(s.run.lock, null, `world ${w} pipes ${k} solved`); assert.equal(at(s.run.grid, 4, 10, 3), T.AIR);
  }
});

test('odd: all cards the same but one; a wrong tap waits a moment, a right tap starts the next round; bigger and closer-looking later', () => {
  assert.deepEqual([...D.ODD_ROUNDS], [3, 3, 4, 4, 5]);
  const cards = [];
  for (let w = 0; w < 5; w++) {
    const s = openChest(w, 'odd', 3 + w), L = s.run.lock;
    assert.equal(L.rounds, D.ODD_ROUNDS[w]); cards.push(L.cards.length);
    for (let r = 0; r < L.rounds; r++) {
      const a = L.cards, odd = L.odd, same = a[odd === 0 ? 1 : 0];
      assert.ok(a.every((c, j) => (j === odd) === (c !== same)), 'exactly one card differs');
      assert.equal(L.cards.length, D.ODD_CARDS[w]);
      const wrong = odd === 0 ? 1 : 0;
      D.lockTap(s, wrong); assert.ok(s.run.lock && L.round === r && L.wait > 0, 'a wrong tap does not advance');
      D.lockTap(s, odd); assert.equal(L.round, r, 'taps during the wait are ignored');
      run(s, 1.5); assert.equal(L.wait, 0);
      D.lockTap(s, odd);
      if (r < L.rounds - 1) assert.equal(s.run.lock.round, r + 1);
    }
    assert.equal(s.run.lock, null, `world ${w} opened`);
  }
  assert.deepEqual(cards, [4, 6, 9, 12, 16]);
});

test('path: tap the numbered gems in order; later worlds hide the numbers after a preview and a miss shows them again and starts over', () => {
  assert.deepEqual([...D.PATH_N], [4, 5, 6, 7, 8]);
  for (let w = 0; w < 5; w++) {
    const s = openChest(w, 'path', 9 + w), L = s.run.lock;
    assert.equal(L.n, D.PATH_N[w]);
    assert.deepEqual([...L.cells].filter(c => c).sort((a, b) => a - b), Array.from({ length: L.n }, (_, i) => i + 1), 'gems 1..n once each');
    assert.equal(D.PATH_PREVIEW[w] > 0, w >= 2, 'numbers hide from world 3 on');
    assert.equal(L.show > 0, w >= 2, 'a preview plays first when they hide');
    if (L.show > 0) { D.lockTap(s, L.cells.indexOf(1)); assert.equal(L.next, 1, 'taps wait for the preview to end'); D.step(s, L.show + 0.01); }
    D.lockTap(s, L.cells.indexOf(1)); assert.equal(L.next, 2);
    D.lockTap(s, L.cells.indexOf(1)); assert.equal(L.next, 2, 'a gem already taken does nothing');
    D.lockTap(s, L.cells.indexOf(L.n)); // out of order
    assert.ok(s.run.lock, 'a wrong gem does not open it');
    if (w >= 2) { assert.equal(L.next, 1, 'back to the start'); assert.ok(L.show > 0, 'the numbers show again'); D.step(s, L.show + 0.01); }
    solveLock(s);
    assert.equal(s.run.lock, null, `world ${w} opened`); assert.equal(at(s.run.grid, 4, 10, 3), T.AIR);
  }
});

test('picking a lock gives the contents and a bonus gem; smashing gives a few coins and no fossil', () => {
  let picked = 0, smashed = 0, smashFossils = 0;
  for (let k = 0; k < 30; k++) for (const pick of [true, false]) {
    const s = digAt(0, 3, 10, 3); s.rng = k * 977; D.setAuto(s, false); s.events = [];
    D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2);
    if (pick) solveLock(s); else D.lockSmash(s);
    assert.equal(s.run.lock, null);
    assert.ok(s.events.some(e => e.type === (pick ? 'unlocked' : 'smashed')));
    run(s, 5);
    const items = s.run.bag.concat(s.carry), coins = items.filter(b => b.kind === 'treasure').reduce((a, b) => a + b.value, 0);
    if (pick) { picked += coins; assert.ok(items.some(b => b.kind === 'treasure' && b.gem), 'a bonus gem'); }
    else { smashed += coins; smashFossils += items.filter(b => b.kind === 'fossil').length; }
  }
  assert.equal(smashFossils, 0, 'a smashed chest gives no fossil');
  assert.ok(picked > smashed * 3, `picked ${picked} vs smashed ${smashed}`);
});

test('helpers leave chests for the miner', () => {
  const s = digAt(0, 0, 20, 0); s.workers.diggers = 2; D.setAuto(s, false);
  D._clearLayer(s, 20); D._setTile(s, 5, 20, 5, T.CHEST); D._setTile(s, 6, 20, 6, T.CHEST);
  run(s, 30);
  assert.equal(at(s.run.grid, 5, 20, 5), T.CHEST); assert.equal(at(s.run.grid, 6, 20, 6), T.CHEST);
});

test('going home closes an open lock and leaves the chest in the ground', () => {
  const s = digAt(0, 3, 10, 3); D.setAuto(s, false);
  D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2);
  D.goHome(s);
  assert.equal(s.run.lock, null); assert.equal(at(s.run.grid, 4, 10, 3), T.CHEST);
});

test('the biggest pieces of each skeleton are buried as big fossils spanning several cells of one layer', () => {
  for (let w = 0; w < 5; w++) {
    let big = 0;
    for (let k = 0; k < 15; k++) {
      const [L, S] = D.fossilForm(w, k);
      assert.ok((L === 1 && S === 1) || (L === 2 && S === 1) || (L === 3 && S === 1) || (L === 2 && S === 2), `world ${w} piece ${k}: ${L}x${S}`);
      if (L * S > 1) big++;
    }
    assert.equal(big, 6, `world ${w}: two big pieces per creature`);
    for (const seed of [3, 31]) {
      const g = D.genWorld(w, seed);
      for (const f of fossilGroups(g)) {
        const [L, S] = D.fossilForm(w, f.idx);
        assert.deepEqual([Math.max(f.w, f.d), Math.min(f.w, f.d)], [L, S], `world ${w} piece ${f.idx} footprint`);
        assert.equal(f.cells.length, f.w * f.d, 'every cell of it is a fossil block');
        assert.ok(f.x0 >= 0 && f.z0 >= 0 && f.x0 + f.w <= D.N && f.z0 + f.d <= D.N, 'inside the pit');
        for (const c of f.cells) {
          assert.equal(Math.floor(c / 49), f.y, 'all in one layer');
          const g2 = D.fossilAt(g, c);
          assert.deepEqual([g2.idx, g2.x0, g2.z0, g2.w, g2.d], [f.idx, f.x0, f.z0, f.w, f.d], 'each cell knows its group');
        }
      }
    }
  }
});

// a 3x1 big fossil of piece p of world 0 along x from (2, 20, 3); the miner stands at (1, 20, 3)
function bigSetup(p = 2) {
  const s = digAt(0, 1, 20, 3); D.setAuto(s, false);
  D._setFossil(s, 2, 20, 3, p, 3, 1);
  return s;
}
const digOut = (s, x, z) => { D.digAt(s, x, z); run(s, 15); };

test('a big fossil gives its bone only when its last cell breaks', () => {
  const s = bigSetup(); s.events = [];
  digOut(s, 2, 3);
  assert.equal(at(s.run.grid, 2, 20, 3), T.AIR, 'the first cell broke');
  assert.equal(s.run.loot.length, 0, 'no bone yet');
  assert.equal(D.fossilAt(s.run.grid, D.idx(3, 20, 3)).cells.length, 2, 'two cells left');
  assert.ok(s.events.some(e => e.type === 'bigBone'), 'the player is told there is more of it');
  digOut(s, 3, 3); assert.equal(s.run.loot.length, 0, 'still no bone');
  digOut(s, 4, 3);
  assert.equal(at(s.run.grid, 4, 20, 3), T.AIR, 'the last cell broke');
  const bones = s.run.loot.map(l => l.item).concat(s.carry).filter(it => it.kind === 'fossil');
  assert.equal(bones.length, 1, 'one bone for the whole piece');
  assert.equal(bones[0].idx, 2);
});

test('a part-dug big fossil waits in the ground while a bone is carried, and digs out after the hand-in', () => {
  const s = bigSetup(); digOut(s, 2, 3);
  s.carry = [{ kind: 'fossil', world: 0, idx: 7 }];
  digOut(s, 3, 3); D.setAuto(s, true); run(s, 10); D.setAuto(s, false);
  assert.equal(at(s.run.grid, 3, 20, 3), T.FOSSIL, 'it stays in the ground');
  s.carry = []; // handed in at the museum
  digOut(s, 3, 3); digOut(s, 4, 3);
  assert.equal(at(s.run.grid, 3, 20, 3), T.AIR); assert.equal(at(s.run.grid, 4, 20, 3), T.AIR);
  const bones = s.run.loot.map(l => l.item).concat(s.carry).filter(it => it.kind === 'fossil');
  assert.equal(bones.length, 1);
});

test('helpers dig the cells of a big fossil and the bone drops once', () => {
  const s = digAt(0, 0, 20, 0); s.workers.diggers = 2; D.setAuto(s, false);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) if (x + z > 0) D._setTile(s, x, 20, z, T.AIR, 0);
  D._setFossil(s, 4, 20, 4, 3, 2, 2);
  run(s, 60);
  for (const [x, z] of [[4, 4], [5, 4], [4, 5], [5, 5]]) assert.equal(at(s.run.grid, x, 20, z), T.AIR, `cell ${x},${z} dug`);
  const bones = s.run.loot.map(l => l.item).concat(s.run.bag, s.carry).filter(it => it.kind === 'fossil');
  assert.equal(bones.length, 1);
});

test('a part-dug big fossil survives a save and load', () => {
  const s = bigSetup(); digOut(s, 2, 3);
  const s2 = D.deserialize(D.serialize(s));
  const f = D.fossilAt(s2.sites[0], D.idx(4, 20, 3));
  assert.deepEqual([f.idx, f.x0, f.z0, f.w, f.d, f.cells.length], [2, 2, 3, 3, 1, 2]);
});
