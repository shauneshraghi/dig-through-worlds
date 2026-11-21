// Tests for the walkable surface plaza (the hub) in js/logic.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
const D = ctx.DTW;
const H = D.HUB;
const run = (s, secs) => { for (let t = 0; t < secs; t += 0.05) D.step(s, 0.05); };
const cellOf = s => [Math.floor(s.hub.x), Math.floor(s.hub.z)];
const find = ch => { const out = []; H.rows.forEach((row, r) => [...row].forEach((c, k) => { if (c === ch) out.push([k + H.x0, r + H.z0]); })); return out; };

test('the plaza map is rectangular and the pit sits at x, z in [0, N)', () => {
  assert.ok(H.rows.length > 0);
  for (const row of H.rows) assert.equal(row.length, H.rows[0].length);
  for (let z = H.z0; z < H.z0 + H.rows.length; z++) for (let x = H.x0; x < H.x0 + H.rows[0].length; x++) {
    const inPit = x >= 0 && x < D.N && z >= 0 && z < D.N;
    assert.equal(D.hubCell(x, z) === 'P', inPit, `${x},${z}`);
  }
  assert.equal(D.hubCell(H.x0 - 1, 0), '', 'outside the map is nothing');
});

test('each station has exactly one pad, and the museum has a plinth per creature and a relic case per world', () => {
  for (const ch of Object.keys(D.HUB_STATIONS)) assert.equal(find(ch).length, 1, ch);
  assert.equal(D.PLINTH_CH.length, 15);
  for (let k = 0; k < 15; k++) assert.ok(find(D.PLINTH_CH[k]).length >= 4, `plinth ${k}`);
  for (let w = 0; w < 5; w++) assert.equal(find('abcde'[w]).length, 1, `relic case ${w + 1}`);
  assert.deepEqual(find('L')[0], [-1, D.LADDER_Z], 'the dig pad is at the top of the ladder');
});

test('a new game starts on the dig pad at the top of the ladder', () => {
  const s = D.newState(1);
  assert.deepEqual(cellOf(s), [-1, D.LADDER_Z]);
  assert.equal(D.hubStation(s), 'dig');
});

test('holding a direction walks at HUB_SPEED, and the pit, walls and stalls block the way', () => {
  const s = D.newState(1);
  D.hubInput(s, 'n'); run(s, 1);
  assert.ok(Math.abs(s.hub.z - (D.LADDER_Z + 0.5 - D.HUB_SPEED)) < 0.1, `walked north: z = ${s.hub.z}`);
  assert.equal(s.hub.x, -0.5);
  // back to the ladder pad, then into the pit: blocked at the pit edge
  const t = D.newState(1);
  D.hubInput(t, 'e'); run(t, 2);
  assert.ok(t.hub.x < 0 && t.hub.x > -0.5, `stops at the pit edge: x = ${t.hub.x}`);
  assert.equal(D.hubWalkable(Math.floor(t.hub.x), Math.floor(t.hub.z)), true);
  // two keys at once walk diagonally
  const u = D.newState(1);
  D.hubInput(u, ['n', 'w']); run(u, 0.5);
  assert.ok(u.hub.x < -0.5 && u.hub.z < D.LADDER_Z + 0.5);
  D.hubInput(u, null); const [x, z] = [u.hub.x, u.hub.z]; run(u, 1);
  assert.deepEqual([u.hub.x, u.hub.z], [x, z], 'releasing the keys stops');
});

test('walking to a spot follows a path round the pit into the museum', () => {
  const s = D.newState(1);
  const [mx, mz] = find('M')[0];
  assert.ok(D.hubWalkTo(s, mx + 0.5, mz + 0.5));
  run(s, 30);
  assert.deepEqual(cellOf(s), [mx, mz]);
  assert.equal(D.hubStation(s), 'museum');
  assert.equal(s.hub.path, null);
});

test('tapping a blocked cell walks to the nearest open cell beside it', () => {
  const s = D.newState(1);
  const [px, pz] = find(D.PLINTH_CH[7])[0]; // world 3, second creature
  assert.ok(D.hubWalkTo(s, px + 0.5, pz + 0.5));
  run(s, 30);
  const [x, z] = cellOf(s);
  assert.ok(D.hubWalkable(x, z));
  assert.ok(Math.abs(x - px) + Math.abs(z - pz) <= 2, `ended next to the plinth at ${x},${z}`);
  const near = D.hubNearExhibit(s);
  assert.equal(near.world, 2, 'standing by a world 3 plinth shows world 3');
  assert.ok(near.creature >= 0 && near.creature < 3);
});

test('each pad opens its station', () => {
  for (const [ch, name] of Object.entries(D.HUB_STATIONS)) {
    const s = D.newState(1); const [x, z] = find(ch)[0];
    D.hubWalkTo(s, x + 0.5, z + 0.5); run(s, 30);
    assert.equal(D.hubStation(s), name, ch);
  }
});

test('holding a direction cancels a walk in progress', () => {
  const s = D.newState(1); const [mx, mz] = find('M')[0];
  D.hubWalkTo(s, mx + 0.5, mz + 0.5); run(s, 0.3);
  D.hubInput(s, 's'); run(s, 0.1);
  assert.equal(s.hub.path, null);
});

test('coming home from a dig puts the miner back at the top of the ladder', () => {
  const s = D.newState(1);
  const [x, z] = find('S')[0]; D.hubWalkTo(s, x + 0.5, z + 0.5); run(s, 20);
  assert.equal(D.hubStation(s), 'shop');
  D.startDig(s, 0); run(s, 4); assert.equal(s.mode, 'dig');
  D.goHome(s); run(s, 5); assert.equal(s.mode, 'surface');
  assert.deepEqual(cellOf(s), [-1, D.LADDER_Z]);
});

test('the plaza position is not saved: a loaded game starts at the ladder', () => {
  const s = D.newState(1); D.hubInput(s, 'n'); run(s, 1);
  const t = D.deserialize(D.serialize(s));
  assert.deepEqual(cellOf(t), [-1, D.LADDER_Z]);
});

test('every plinth and relic case can be reached on foot from the dig pad', () => {
  const s = D.newState(1);
  const [lx, lz] = find('L')[0];
  for (const ch of D.PLINTH_CH + 'abcde') {
    const [px, pz] = find(ch)[0];
    const sides = [[-1, 0], [0, -1], [2, 0], [0, 2], [-1, 1], [1, -1], [2, 1], [1, 2]].map(([dx, dz]) => [px + dx, pz + dz]).filter(([x, z]) => D.hubWalkable(x, z));
    assert.ok(sides.some(([x, z]) => D.hubPath(lx + 0.5, lz + 0.5, x + 0.5, z + 0.5)), `reach ${ch}`);
  }
});
