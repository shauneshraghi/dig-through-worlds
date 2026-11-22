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
  // into the pit away from the ladder: blocked at the pit edge
  const t = D.newState(1); t.hub.z = D.LADDER_Z + D.LADDER_REACH + 1.5;
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
  const [px, pz] = find(D.PLINTH_CH[2])[0]; // world 1, third creature (T. rex)
  assert.ok(D.hubWalkTo(s, px + 0.5, pz + 0.5));
  run(s, 30);
  const [x, z] = cellOf(s);
  assert.ok(D.hubWalkable(x, z));
  assert.ok(Math.abs(x - px) + Math.abs(z - pz) <= 2, `ended next to the plinth at ${x},${z}`);
  const near = D.hubNearExhibit(s);
  assert.equal(near.world, 0, 'standing by a world 1 plinth shows world 1');
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


// cells of a plinth (or case) and the open cells that touch it
const blockOf = ch => find(ch);
const sidesOf = ch => {
  const cells = blockOf(ch), key = ([x, z]) => x + ',' + z, set = new Set(cells.map(key)), out = new Map();
  for (const [x, z] of cells) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = [x + dx, z + dz];
    if (!set.has(key(c)) && D.hubWalkable(c[0], c[1])) out.set(key(c), c);
  }
  return [...out.values()];
};

test('the museum is split into themed wings that list every creature once, with the biggest plinth for the centrepiece', () => {
  const ks = D.WINGS.flatMap(w => w.ks).sort((a, b) => a - b);
  assert.equal(ks.join(), [...Array(15).keys()].join());
  const names = D.WINGS.map(w => w.name);
  for (const n of ['Dinosaur Hall', 'Ice Age Wing', 'Sea Monsters', 'Space Corner', 'Relic Gallery']) assert.ok(names.includes(n), n);
  const wingOf = n => D.WINGS.find(w => w.name === n).ks.map(k => D.WORLDS[Math.floor(k / 3)].creatures[k % 3].name);
  assert.ok(wingOf('Dinosaur Hall').includes('T. rex') && wingOf('Dinosaur Hall').includes('Brachiosaurus'));
  assert.equal(wingOf('Ice Age Wing').sort().join(), 'Sabre-tooth Cat,Woolly Mammoth');
  assert.ok(wingOf('Sea Monsters').includes('Giant Shark') && wingOf('Space Corner').includes('Lost Moon Rover'));
  const sizes = D.PLINTH_CH.split('').map(ch => blockOf(ch).length);
  assert.equal(Math.max(...sizes), sizes[11], 'Brachiosaurus is the centrepiece');
  assert.ok(new Set(sizes).size >= 4, 'plinths come in several sizes');
});

test('each plinth is a solid rectangle with a hand-in cell beside it that names its creature', () => {
  for (let k = 0; k < 15; k++) {
    const ch = D.PLINTH_CH[k], cells = blockOf(ch);
    const xs = cells.map(c => c[0]), zs = cells.map(c => c[1]);
    assert.equal(cells.length, (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...zs) - Math.min(...zs) + 1), `plinth ${k} is a rectangle`);
    const sides = sidesOf(ch);
    assert.ok(sides.length > 0, `open cell beside plinth ${k}`);
    assert.ok(sides.some(([x, z]) => {
      const s = D.newState(1); s.hub.x = x + 0.5; s.hub.z = z + 0.5;
      const near = D.hubNearExhibit(s);
      return near && near.world * 3 + near.creature === k;
    }), `a cell beside plinth ${k} names it`);
  }
});

test('every plinth and relic case can be reached on foot from the dig pad', () => {
  const s = D.newState(1);
  const [lx, lz] = find('L')[0];
  for (const ch of D.PLINTH_CH + 'abcde') {
    const sides = sidesOf(ch);
    assert.ok(sides.length && sides.every(([x, z]) => D.hubPath(lx + 0.5, lz + 0.5, x + 0.5, z + 0.5)), `reach ${ch}`);
  }
});

test('the museum desk and the door can be reached from the dig pad', () => {
  const [lx, lz] = find('L')[0], [mx, mz] = find('M')[0];
  assert.ok(D.hubPath(lx + 0.5, lz + 0.5, mx + 0.5, mz + 0.5));
});

test('new bones are carried home and only join the museum when handed in at their plinth or the desk', () => {
  const s = D.newState(3); D.startDig(s, 0); run(s, 3);
  s.run.bag.push({ kind: 'fossil', world: 0, idx: 0 }, { kind: 'fossil', world: 0, idx: 7 }, { kind: 'fossil', world: 0, idx: 0 });
  D.goHome(s); run(s, 4);
  assert.equal(s.mode, 'surface');
  assert.equal(s.carry.length, 2, 'two new bones in hand; the copy is sold');
  assert.equal(s.museum[0].pieces[0], 0, 'not on show yet');
  // walk to the mammoth's plinth (world 0, creature 0)
  const [hx, hz] = sidesOf(D.PLINTH_CH[0])[0];
  assert.ok(D.hubWalkTo(s, hx + 0.5, hz + 0.5)); run(s, 30);
  assert.equal(s.museum[0].pieces[0], 1, 'the mammoth skull is handed in at its plinth');
  assert.equal(s.museum[0].pieces[7], 0, 'the raptor bone is still carried');
  assert.equal(s.carry.length, 1);
  const [mx, mz] = find('M')[0];
  assert.ok(D.hubWalkTo(s, mx, mz)); run(s, 30);
  assert.equal(s.museum[0].pieces[7], 1, 'the desk takes the rest');
  assert.equal(s.carry.length, 0);
  assert.ok(s.events.some(e => e.type === 'delivered'));
});

test('carried bones survive a save and load', () => {
  const s = D.newState(3); s.carry = [{ kind: 'fossil', world: 0, idx: 4 }];
  const s2 = D.deserialize(D.serialize(s));
  assert.equal(s2.carry.length, 1);
  assert.equal(s2.carry[0].idx, 4);
});

test('pushing toward the ladder from the dig pad climbs down, but walking past the pad does not', () => {
  const s = D.newState(1);
  D.hubInput(s, ['e', 'n']); D.step(s, 0.05); // screen-right: slides along the pit edge
  assert.equal(s.mode, 'surface');
  s.hub = { x: -0.5, z: D.LADDER_Z + 0.5, input: null, path: null };
  D.hubInput(s, 'e'); D.step(s, 0.05);
  assert.equal(s.mode, 'surface', 'a brief push does not climb down');
  run(s, D.CLIMB_PUSH + 0.1);
  assert.equal(s.mode, 'down', 'a push held for CLIMB_PUSH does');
});

test('steering west on the cell beside the ladder climbs home; elsewhere on the wall it does not', () => {
  const s = D.newState(1);
  D.startDig(s, 0); D.step(s, 3);
  assert.equal(s.mode, 'dig');
  const y = s.run.y;
  D._clearLayer(s, y); D._setTile(s, 3, y, 3, 1, 5); // keep one block so the layer stays open
  D._teleport(s, 0, y, 0); D.steer(s, 'w'); D.step(s, 0.05);
  assert.equal(s.mode, 'dig');
  D._teleport(s, 0, y, D.LADDER_Z); D.steer(s, 'w'); D.step(s, 0.05);
  assert.equal(s.mode, 'up');
});

test('the ladder is climbed down from a cell either side of the pad, and up from two either side of it', () => {
  const far = D.newState(1);
  far.hub = { x: -0.5, z: D.LADDER_Z + 2.5, input: null, path: null };
  D.hubInput(far, 'e'); run(far, 2);
  assert.equal(far.mode, 'surface', 'two cells from the pad: no climb');
  const s = D.newState(1);
  s.hub = { x: -0.5, z: D.LADDER_Z + 1.5, input: null, path: null };
  D.hubInput(s, 'e'); run(s, D.CLIMB_PUSH + 0.1);
  assert.equal(s.mode, 'down', 'pushing into the pit a cell from the pad climbs down');
  D.step(s, 3); assert.equal(s.mode, 'dig');
  const y = s.run.y;
  D._clearLayer(s, y); D._setTile(s, 3, y, 3, 1, 5);
  D._teleport(s, 0, y, D.LADDER_Z - 2); D.steer(s, 'w'); D.step(s, 0.05);
  assert.equal(s.mode, 'up', 'steering into the wall two cells from the ladder climbs home');
});

test('a tap on the pit beside the ladder walks there and climbs down; elsewhere on the pit it does not', () => {
  const o = D.newState(1);
  const [x, z] = find('S')[0]; D.hubWalkTo(o, x + 0.5, z + 0.5); run(o, 20);
  D.hubWalkTo(o, 3.5, 3.5); run(o, 30);
  assert.equal(o.mode, 'surface', 'the middle of the pit only walks to its edge');
  const s = D.newState(1);
  D.hubWalkTo(s, x + 0.5, z + 0.5); run(s, 20);
  assert.equal(D.hubWalkTo(s, 0.5, D.LADDER_Z + 0.5), true, 'the pit beside the ladder is a target');
  for (let i = 0; i < 600 && s.mode === 'surface'; i++) D.step(s, 0.05);
  assert.equal(s.mode, 'down');
  const t = D.newState(1); // already on the pad: climbs straight down
  assert.equal(D.hubWalkTo(t, 0.5, D.LADDER_Z - 0.5), true); D.step(t, 0.05);
  assert.equal(t.mode, 'down');
  const u = D.newState(1); u.hub = { x: x + 0.5, z: z + 0.5, input: null, path: null };
  D.hubWalkTo(u, 0.5, D.LADDER_Z + 0.5); D.hubInput(u, 'n'); run(u, 3); D.hubInput(u, null); run(u, 10);
  assert.equal(u.mode, 'surface', 'steering away cancels the climb');
});

// Museum quiz: a curious visitor with a ? turns up by a finished skeleton every QUIZ_EVERY s of play; walking up to the
// plinth asks a question (mostly pictures), and a right answer pays about a minute of museum income.
test('museum quiz: a visitor comes by a finished skeleton, asks a question, and a right answer pays a minute of income', () => {
  const s = D.newState(11);
  for (let t = 0; t < D.QUIZ_EVERY + 5; t += 1) D.step(s, 1);
  assert.equal(s.quiz, null, 'no visitor before any skeleton is finished');
  for (let p = 0; p < D.PIECES; p++) s.museum[0].pieces[5 + p] = 1; // the Raptor is complete
  for (let t = 0; t < D.QUIZ_EVERY + 1; t += 1) D.step(s, 1);
  assert.ok(s.quiz, 'a visitor came');
  const q = s.quiz;
  assert.equal(q.k, 1, 'by the finished skeleton (world 0, creature 1)');
  assert.ok(['shape', 'piece', 'fact'].includes(q.kind));
  assert.equal(q.opts.length, 3); assert.ok(q.ans >= 0 && q.ans < 3);
  assert.ok(typeof q.text === 'string' && q.text.length > 5);
  assert.equal(q.open, false);
  // walk up to the Raptor's plinth: the question opens
  const ch = D.PLINTH_CH[1], row = D.HUB.rows.findIndex(r => r.includes(ch));
  s.hub.x = D.HUB.rows[row].indexOf(ch) + D.HUB.x0 - 0.5; s.hub.z = row + D.HUB.z0 + 0.5; s.events = [];
  D.step(s, 0.05);
  assert.equal(s.quiz.open, true); assert.ok(s.events.some(e => e.type === 'quiz'));
  const want = D.quizReward(s);
  assert.ok(want >= Math.round(60 * D.museumIncome(s)) && want >= 50);
  const c0 = s.coins, r = D.quizAnswer(s, q.ans);
  assert.equal(r.right, true); assert.equal(s.coins - c0, r.coins); assert.equal(r.coins, want);
  assert.equal(s.quiz, null);
  assert.ok(s.events.some(e => e.type === 'quizDone' && e.right));
  // the next one waits QUIZ_EVERY again; a wrong answer still gives a little
  for (let t = 0; t < D.QUIZ_EVERY + 1; t += 1) D.step(s, 1);
  s.quiz.open = true;
  const c1 = s.coins, r2 = D.quizAnswer(s, (s.quiz.ans + 1) % 3);
  assert.equal(r2.right, false); assert.ok(r2.coins >= 1 && r2.coins < want); assert.equal(s.coins - c1, r2.coins);
  assert.equal(D.quizAnswer(s, 0), null, 'nothing to answer now');
});

test('museum quiz questions: every kind has its right answer among three different options', () => {
  const s = D.newState(5); s.museum.forEach(m => m.pieces.fill(1));
  const kinds = new Set();
  for (let n = 0; n < 200; n++) {
    s.quiz = null; D._quizNow(s);
    const q = s.quiz; kinds.add(q.kind);
    assert.equal(new Set(q.opts.map(String)).size, 3, `${q.kind} options differ`);
    if (q.kind === 'shape') assert.equal(q.opts[q.ans], q.k);
    if (q.kind === 'piece') assert.ok(q.opts.every(o => Math.floor(o / D.PIECES) === q.k % D.CREATURES), 'pieces of that creature');
    if (q.kind === 'fact') assert.ok(q.opts.every(o => typeof o === 'string'));
  }
  assert.deepEqual([...kinds].sort(), ['fact', 'piece', 'shape']);
});
