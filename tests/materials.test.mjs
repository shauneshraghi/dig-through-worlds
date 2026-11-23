// Tests for the material currencies (coal, copper, iron, gold, crystal): where they drop, what they cost, the exchange and the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
const D = ctx.DTW;
const T = D.TILE;
const run = (s, secs) => { for (let t = 0; t < secs; t += 0.05) D.step(s, 0.05); };

// how many ore blocks of each ore index (0-4 materials, 5 the world's gem) the pits of world w hold over a few seeds
function oreCounts(w) {
  const n = new Array(D.WORLDS[w].ores.length).fill(0);
  for (let seed = 1; seed <= 6; seed++) { const g = D.genWorld(w, seed); for (let i = 0; i < g.t.length; i++) if (g.t[i] === T.ORE) n[g.v[i]]++; }
  return n;
}
const share = (n, t) => n[t] / n.reduce((a, b) => a + b, 0);

test('five materials, and every world lists them as ores beside one themed gem', () => {
  assert.deepEqual([...D.MATS.map(m => m.name)], ['Coal', 'Copper', 'Iron', 'Gold', 'Crystal']);
  assert.equal(new Set(D.MATS.map(m => m.color)).size, 5);
  for (const w of D.WORLDS) {
    assert.equal(w.ores.length, 6, w.id);
    assert.equal(new Set(w.ores.map(o => o.color)).size, 6, `${w.id}: distinct ore colours`);
    for (let t = 0; t < 5; t++) assert.equal(w.ores[t].mat, t);
    assert.equal(w.ores[5].mat, undefined);
    assert.ok(w.ores[5].value > 0, 'the gem sells for coins');
  }
  assert.deepEqual([...D.WORLDS.map(w => w.ores[5].name)], ['Emerald', 'Aquamarine', 'Ruby', 'Star Diamond', 'Nebula Opal']);
});

test('ore drops shift up the tiers world by world, with a little of the two tiers below the main ones', () => {
  const c = D.WORLDS.map((_, w) => oreCounts(w));
  assert.ok(share(c[0], 0) > 0.5, 'world 0 is mostly coal');
  const mean = n => n.slice(0, 5).reduce((a, v, t) => a + v * t, 0) / n.slice(0, 5).reduce((a, b) => a + b, 0);
  for (let w = 1; w < 5; w++) {
    assert.ok(share(c[w], 0) < share(c[w - 1], 0), `coal share falls in world ${w}`);
    assert.ok(share(c[w], 4) >= share(c[w - 1], 4), `crystal share rises in world ${w}`);
    assert.ok(mean(c[w]) > mean(c[w - 1]), `mean tier rises in world ${w}`);
  }
  assert.ok(share(c[0], 0) > 4 * share(c[3], 0), 'coal is far easier to dig in world 0 than in world 3');
  assert.ok(share(c[0], 1) > 2 * share(c[3], 1));
  for (let w = 1; w < 5; w++) for (let t = Math.max(0, w - 2); t < w; t++) assert.ok(c[w][t] > 0, `world ${w} still drops tier ${t}`);
  assert.ok(share(c[4], 3) + share(c[4], 4) > 0.7, 'world 4 is gold and crystal');
  for (let w = 0; w < 5; w++) assert.ok(c[w][5] > 0, `world ${w} has some gems`);
});

test('banking puts materials in the stash and sells gems for coins; the event reports the materials', () => {
  const s = D.newState(1);
  s.run = { bag: [{ kind: 'ore', world: 2, idx: 0 }, { kind: 'ore', world: 2, idx: 0 }, { kind: 'ore', world: 2, idx: 3 },
    { kind: 'ore', world: 2, idx: 5 }, { kind: 'treasure', world: 2, value: 40 }], loot: [] };
  D.bank(s);
  assert.deepEqual([...s.mats], [2, 0, 0, 1, 0]);
  assert.equal(s.coins, Math.round(D.WORLDS[2].ores[5].value * D.WORLDS[2].oreMult) + 40);
  const e = s.events.find(x => x.type === 'banked');
  assert.deepEqual([...e.mats], [2, 0, 0, 1, 0]);
});

test('material prices rise about five-fold a tier', () => {
  for (let t = 1; t < 5; t++) { const r = D.MAT_PRICE[t] / D.MAT_PRICE[t - 1]; assert.ok(r >= 4 && r <= 6, `tier ${t}: x${r}`); }
});

test('the exchange: selling pays the tier price, buying costs more and rises with every unit bought', () => {
  const s = D.newState(1);
  s.mats[1] = 10;
  assert.equal(D.sellMat(s, 1, 4), true);
  assert.equal(s.coins, 4 * D.MAT_PRICE[1]); assert.equal(s.mats[1], 6);
  assert.equal(D.sellMat(s, 1, 7), false, 'cannot sell more than held');
  const one = D.matBuyPrice(s, 2, 1);
  assert.ok(one >= 2 * D.MAT_PRICE[2], 'buying costs at least twice the selling price');
  const ten = D.matBuyPrice(s, 2, 10);
  assert.ok(ten > 10 * one, 'ten cost more than ten single prices: diminishing returns');
  s.coins = 1e9;
  const before = s.coins;
  assert.equal(D.buyMat(s, 2, 10), true);
  assert.equal(before - s.coins, ten); assert.equal(s.mats[2], 10);
  assert.ok(D.matBuyPrice(s, 2, 1) > one, 'the next unit costs more');
  assert.equal(D.matBuyPrice(s, 3, 1), D.matBuyPrice(D.newState(1), 3, 1), 'other tiers are unaffected');
  s.coins = 1; assert.equal(D.buyMat(s, 3, 1), false); assert.equal(s.mats[3], 0);
  s.coins = 1e9; s.run = { bag: [], loot: [] }; D.bank(s);
  assert.equal(D.matBuyPrice(s, 2, 1), one, 'the price recovers after a trip home');
  s.coins = 1e9; D.buyMat(s, 4, 50); D.sellMat(s, 4, 50);
  assert.ok(s.coins < 1e9, 'buying then selling back always loses coins');
});

test('upgrades cost coins and materials, and are refused when short of any of them', () => {
  const s = D.newState(1);
  const c = D.upgradeCost(s, 'drill');
  assert.ok(c.coins === 0 && c.mats.length === 5 && c.mats[0] > 0, 'the first level needs coal and no coins, so the first trip home can pay for it');
  s.coins = 1e9;
  assert.equal(D.buyUpgrade(s, 'drill'), false, 'no coal');
  s.upgrades.drill = 3; s.coins = 0;
  assert.ok(D.upgradeCost(s, 'drill').coins > 0, 'later levels cost coins too');
  Object.assign(c, D.upgradeCost(s, 'drill'));
  s.coins = c.coins - 1; s.mats = c.mats.slice();
  assert.equal(D.buyUpgrade(s, 'drill'), false, 'one coin short');
  s.coins = c.coins; s.mats[0] = c.mats[0] - 1;
  assert.equal(D.buyUpgrade(s, 'drill'), false, 'one coal short');
  s.mats[0] = c.mats[0] + 3;
  assert.equal(D.buyUpgrade(s, 'drill'), true);
  assert.equal(s.coins, 0); assert.equal(s.mats[0], 3); assert.equal(s.upgrades.drill, 4);
  // a higher level needs a higher tier, and being short of just that tier refuses it
  s.upgrades.drill = 20; const c2 = D.upgradeCost(s, 'drill');
  const top = c2.mats.reduce((a, n, t) => n > 0 ? t : a, 0);
  assert.ok(top >= 2);
  s.coins = c2.coins; s.mats = c2.mats.slice(); s.mats[top]--;
  assert.equal(D.buyUpgrade(s, 'drill'), false);
  s.mats[top]++;
  assert.equal(D.buyUpgrade(s, 'drill'), true);
  assert.equal(s.mats.every(n => n === 0), true); assert.equal(s.coins, 0);
});

test('hiring costs materials too, and a maxed upgrade costs Infinity coins', () => {
  const s = D.newState(1);
  const h = D.hireCost(s, 'staff');
  assert.ok(h.mats.some(n => n > 0));
  s.coins = 1e9; assert.equal(D.hire(s, 'staff'), false);
  s.mats = h.mats.slice(); assert.equal(D.hire(s, 'staff'), true);
  assert.equal(s.coins, 1e9 - h.coins);
  s.upgrades.magnet = D.UPGRADES.magnet.max;
  assert.equal(D.upgradeCost(s, 'magnet').coins, Infinity);
});

test('high levels still need coal and copper in bulk, so late worlds send the player back to the early ones', () => {
  const s = D.newState(1);
  s.upgrades.drill = 25; const c = D.upgradeCost(s, 'drill');
  assert.ok(c.mats[4] > 0, 'crystal at the top');
  assert.ok(c.mats[0] >= 100 && c.mats[1] >= 50, `coal ${c.mats[0]}, copper ${c.mats[1]}`);
  const mid = D.newState(1); mid.upgrades.drill = 14; const m = D.upgradeCost(mid, 'drill');
  assert.ok(m.mats[0] >= 40, `a mid level wants ${m.mats[0]} coal`);
});

test('digging coal in world 0 for a few minutes is far cheaper than buying that much coal', () => {
  const s = D.newState(7); for (let i = 0; i < 4; i++) s.unlocked[i] = true; // a mid-game player
  s.upgrades.drill = 10; s.upgrades.speed = 8; s.upgrades.bag = 6;
  D.startDig(s, 0);
  let t = 0; const dt = 0.1; let acc = 0;
  while (t < 300) {
    if (s.mode === 'dig') { acc += 3 * dt; while (acc >= 1) { D.tap(s); acc--; } if (s.run.lock) D.lockSmash(s); if (s.run.bag.length >= D.bagCap(s) || s.carry.length) D.goHome(s); }
    D.step(s, dt); t += dt; if (s.mode === 'surface') { s.carry = []; D.startDig(s, 0); } // the bone goes to the museum
  }
  if (s.mode === 'dig') D.goHome(s);
  run(s, 6);
  const coal = s.mats[0];
  assert.ok(coal >= 30, `dug ${coal} coal`);
  const buy = D.matBuyPrice(D.newState(1), 0, coal);
  assert.ok(buy > 3 * coal * D.MAT_PRICE[0], `buying ${coal} coal costs ${buy}, selling it earns ${coal * D.MAT_PRICE[0]}`);
});

test('save version 5 keeps the materials', () => {
  const s = D.newState(3); s.mats = [5, 4, 3, 2, 1]; s.coins = 12;
  const o = JSON.parse(D.serialize(s));
  assert.equal(o.v, 6);
  const s2 = D.deserialize(D.serialize(s));
  assert.deepEqual([...s2.mats], [5, 4, 3, 2, 1]); assert.equal(s2.coins, 12);
});

test('a version 3 save loads with no materials and turns an old ore in the bag into coins at its old value', () => {
  const cells = 7 * 7 * 52, t = new Array(cells).fill(1), v = new Array(cells).fill(0);
  t[60] = T.ORE; v[60] = 3; t[61] = T.ORE; v[61] = 1; // an old gem block and an old copper block
  const old = JSON.stringify({ v: 3, seed: 5, rng: 1, coins: 100, unlocked: [true, true, true, false, false], relics: [true, true, false, false, false],
    upgrades: { drill: 2, speed: 0, bag: 0, magnet: 0, crewDrill: 0, crewSpeed: 0 }, workers: { diggers: 0, staff: 0 },
    museum: [0, 1, 2, 3, 4].map(() => ({ pieces: new Array(15).fill(0) })), world: 2, stats: { trapsSprung: 0, timePlayed: 10, digs: 5 }, auto: true,
    carry: [], pile: 0,
    bag: [{ kind: 'ore', world: 2, idx: 0 }, { kind: 'ore', world: 2, idx: 3 }, { kind: 'ore', world: 1, idx: 2 }],
    sites: [null, null, { t, v, deepest: 5, deepestX: 3, deepestZ: 3, gen: 0 }, null, null] });
  const s = D.deserialize(old);
  assert.ok(s);
  assert.deepEqual([...s.mats], [0, 0, 0, 0, 0]);
  // old values: ore value x world multiplier: world 2 idx 0 = 2 x 25, idx 3 = 25 x 25, world 1 idx 2 = 10 x 5
  assert.equal(s.coins, 100 + 2 * 25 + 25 * 25 + 10 * 5);
  const g = s.sites[2];
  assert.equal(g.v[60], 5, 'an old gem block becomes the gem ore');
  assert.equal(g.v[61], 1);
});

// ---------- stretch items and coal stacks ----------
const digTo = (s, w) => { D.startDig(s, w); s.mode = 'dig'; return s.run; };
function flatLayer(s, y) { // layer y: all stone, miner at (3,y,3), hp 1 everywhere
  const g = s.run.grid;
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) { D._setTile(s, x, y, z, T.STONE, 0); g.hp[D.idx(x, y, z)] = 100; }
  D._teleport(s, 3, y, 3);
}
test('Splash Pick: one-time, fixed price, offered once world 2 is unlocked', () => {
  const s = D.newState(1);
  assert.equal(s.upgrades.splash, 0); assert.equal(s.upgrades.twin, 0);
  assert.equal(D.upgradeAvailable(s, 'drill'), true);
  assert.equal(D.upgradeAvailable(s, 'splash'), false);
  assert.equal(D.upgradeAvailable(s, 'twin'), false);
  s.coins = 1e9; s.mats = [1e5, 1e5, 1e5, 1e5, 1e5];
  assert.equal(D.buyUpgrade(s, 'splash'), false, 'locked world');
  s.unlocked[2] = true; s.unlocked[3] = true;
  assert.equal(D.upgradeAvailable(s, 'splash'), true); assert.equal(D.upgradeAvailable(s, 'twin'), true);
  const c = D.upgradeCost(s, 'splash'); assert.ok(c.coins > 0 && c.mats.every(n => n > 0));
  assert.equal(D.buyUpgrade(s, 'splash'), true); assert.equal(s.upgrades.splash, 1);
  assert.equal(D.upgradeCost(s, 'splash').coins, Infinity); assert.equal(D.buyUpgrade(s, 'splash'), false);
  assert.equal(D.buyUpgrade(s, 'twin'), true);
});
test('Splash Pick: a strike chips the blocks around it two cells out, never chests, relics, bedrock or open cells', () => {
  const s = D.newState(3); s.unlocked[2] = true; s.upgrades.splash = 1; s.auto = false;
  digTo(s, 0); flatLayer(s, 1); const g = s.run.grid, y = 1;
  D._setTile(s, 4, y, 3, T.CHEST, 0); D._setTile(s, 2, y, 3, T.AIR, 0);
  D._setTile(s, 3, y, 2, T.STONE, 0); D._setTile(s, 3, y, 4, T.RELIC, 0);
  for (let z = 0; z < D.N; z++) for (let x = 0; x < D.N; x++) { const i = D.idx(x, y, z); if (g.t[i] !== T.AIR) g.hp[i] = 100; }
  D.steer(s, 'n'); D.tap(s); D.step(s, 0.05);
  const hit = 100 - g.hp[D.idx(3, y, 2)];
  assert.ok(hit > 0, 'target damaged');
  assert.equal(g.hp[D.idx(4, y, 3)], 100, 'chest untouched'); assert.equal(g.hp[D.idx(3, y, 4)], 100, 'relic untouched');
  assert.equal(g.t[D.idx(2, y, 3)], T.AIR);
  // the 8 blocks around the target take SPLASH_FRAC of the strike, diagonals too, and the ring beyond SPLASH_FAR
  for (const [x, z, f] of [[2, 2, D.SPLASH_FRAC], [4, 2, D.SPLASH_FRAC], [2, 1, D.SPLASH_FRAC], [4, 1, D.SPLASH_FRAC], [5, 2, D.SPLASH_FAR], [3, 0, D.SPLASH_FAR], [1, 4, D.SPLASH_FAR]]) {
    const i = D.idx(x, y, z); if (g.t[i] !== T.STONE) continue;
    const side = 100 - g.hp[i];
    assert.ok(Math.abs(side - f * hit) < 1e-3, `${x},${z}: ${side} vs ${f * hit}`);
  }
  assert.equal(g.hp[D.idx(6, y, 2)], 100, 'three cells out is untouched');
  assert.equal(D.SPLASH_FRAC, 0.5); assert.equal(D.SPLASH_FAR, 0.25);
});
test('Splash Pick: a splash that breaks a block drops its loot', () => {
  const s = D.newState(3); s.unlocked[2] = true; s.upgrades.splash = 1; s.auto = false;
  digTo(s, 0); flatLayer(s, 1); const g = s.run.grid, y = 1;
  D._setTile(s, 2, y, 2, T.ORE, 1); g.hp[D.idx(2, y, 2)] = 0.001;
  D.steer(s, 'n'); D.tap(s); D.step(s, 0.05);
  assert.equal(g.t[D.idx(2, y, 2)], T.AIR);
  assert.ok(s.run.loot.some(l => l.item.kind === 'ore' && l.item.idx === 1));
});
test('Twin Picks multiply the miner swing rate by TWIN_RATE', () => {
  const s = D.newState(1); const base = D.hitRate(s);
  s.upgrades.twin = 1;
  assert.equal(D.TWIN_RATE, 1.6); assert.ok(Math.abs(D.hitRate(s) - base * 1.6) < 1e-9);
});
test('every material ore drops as a stack (ORE_STACK by world and tier), banks n units, and is one bag item', () => {
  assert.equal(D.ORE_STACK.length, 5);
  for (const row of D.ORE_STACK) { assert.equal(row.length, 5); assert.ok(row.every(n => Number.isInteger(n) && n >= 1)); }
  for (const w of [0, 1, 4]) for (const tier of [0, 2, 4]) {
    const s = D.newState(5); s.unlocked.fill(true); digTo(s, w); flatLayer(s, 1); s.auto = false;
    D._setTile(s, 3, 1, 2, T.ORE, tier); s.run.grid.hp[D.idx(3, 1, 2)] = 0.001;
    D.steer(s, 'n'); D.tap(s); D.step(s, 0.05);
    const l = s.run.loot.find(l => l.item.kind === 'ore'); assert.ok(l, 'ore dropped');
    assert.equal(l.item.n || 1, D.ORE_STACK[w][tier]);
    s.run.loot = []; s.run.bag = [l.item]; D.bank(s);
    assert.equal(s.mats[tier], D.ORE_STACK[w][tier]);
    assert.equal(s.events.filter(e => e.type === 'banked').pop().mats[tier], D.ORE_STACK[w][tier]);
  }
  const s = D.newState(5); s.run = { bag: [{ kind: 'ore', world: 0, idx: 0 }, { kind: 'ore', world: 1, idx: 0, n: 3 }], loot: [] };
  D.bank(s); assert.equal(s.mats[0], 4);
  assert.equal(D.itemValue({ kind: 'ore', world: 1, idx: 0, n: 3 }), 3 * D.MAT_PRICE[0]);
});
test('the special tools are goals a child can save for: Splash Pick at most 7000 coins, Twin Picks at most 20000', () => {
  const s = D.newState(1); s.unlocked.fill(true);
  const sp = D.upgradeCost(s, 'splash'), tw = D.upgradeCost(s, 'twin');
  assert.ok(sp.coins <= 7000 && tw.coins <= 20000, `${sp.coins}, ${tw.coins}`);
  assert.ok(sp.mats.reduce((a, b) => a + b) <= 200 && tw.mats.reduce((a, b) => a + b) <= 400);
});
test('old saves load the new upgrades at 0', () => {
  const o = JSON.parse(D.serialize(D.newState(7)));
  delete o.upgrades.splash; delete o.upgrades.twin;
  const t = D.deserialize(JSON.stringify(o));
  assert.equal(t.upgrades.splash, 0); assert.equal(t.upgrades.twin, 0);
});
