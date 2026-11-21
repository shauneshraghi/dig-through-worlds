// Dig Through Worlds: pure game logic, no DOM. Loaded by index.html as a plain script (global DTW)
// and by tests/logic.test.mjs in a Node vm.
var DTW = (function () {
  'use strict';
  // The world is an N×N column of ground, DEPTH layers deep (relic layer at DEPTH, bedrock below).
  // x and z run across a layer, y is the depth; cell index is (y*N + z)*N + x.
  var N = 7, NN = N * N, DEPTH = 100;
  function idx(x, y, z) { return (y * N + z) * N + x; }
  // compass steering: n/s move along z, e/w along x. -1 / +1 are kept as aliases for w / e.
  var DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  function dirKey(d) { return d === -1 ? 'w' : d === 1 ? 'e' : DIRS.hasOwnProperty(d) ? d : 0; }
  var TILE = { AIR: 0, DIRT: 1, STONE: 2, ORE: 3, FOSSIL: 4, ROOT: 5, BUBBLE: 6, TRAP: 7, GOO: 8, CHEST: 9, RELIC: 10, BEDROCK: 11, CRATER: 12 };
  var HP_MULT = { 1: 1, 2: 2, 3: 1.4, 4: 1.5, 5: 5, 7: 1.5, 8: 1.6, 9: 1.2, 10: 3 };

  var WORLDS = [
    { id: 'forest', name: 'Whispering Forest', rule: 'roots', ruleText: 'Tough tree roots: steer around them!',
      hp: 3, oreMult: 1,
      ores: [{ name: 'Coal', value: 2, color: '#2b2b2b' }, { name: 'Copper', value: 5, color: '#d9813b' },
             { name: 'Iron', value: 10, color: '#c9b8a6' }, { name: 'Emerald', value: 25, color: '#2fd56b' }],
      fossils: ['Raptor Skull', 'Raptor Ribs', 'Raptor Leg', 'Raptor Tail', 'Raptor Claw'],
      exhibit: { name: 'Forest Raptor Skeleton', income: 0.5 },
      relic: { name: 'Heartwood Acorn', color: '#ffcf4a' },
      pal: { sky: ['#8fd3ff', '#d8f3ff'], top: '#4caf3d', dirt: ['#8a5a32', '#73482a', '#5c3a24'], stone: '#7d7d86',
             feature: '#5b3b1c', bed: '#2a2530', hills: '#3f8f3a' },
      music: { tempo: 112, root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle' } },
    { id: 'ocean', name: 'Sunken Ocean Floor', rule: 'oxygen', ruleText: 'Watch your oxygen! Pop bubbles to refill.',
      hp: 18, oreMult: 5,
      ores: [{ name: 'Sea Glass', value: 2, color: '#8ff0d8' }, { name: 'Coral', value: 5, color: '#ff6f8a' },
             { name: 'Pearl', value: 10, color: '#fff6e6' }, { name: 'Aquamarine', value: 25, color: '#3fc8ff' }],
      fossils: ['Shark Tooth', 'Shark Jaw', 'Shark Fin', 'Shark Spine', 'Shark Tail'],
      exhibit: { name: 'Ancient Giant Shark', income: 2.5 },
      relic: { name: 'Tide Pearl Crown', color: '#bff7ff' },
      pal: { sky: ['#1b6fa8', '#2fa6d6'], top: '#e9d39a', dirt: ['#cdb27a', '#a88e5c', '#7c6a48'], stone: '#5f7380',
             feature: '#bdf3ff', bed: '#14202e', hills: '#1e5d8a' },
      music: { tempo: 84, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sine' } },
    { id: 'jungle', name: 'Jungle Ruins', rule: 'traps', ruleText: 'Ancient traps make you dizzy. Find the treasure rooms!',
      hp: 100, oreMult: 25,
      ores: [{ name: 'Jade', value: 2, color: '#59c98a' }, { name: 'Gold', value: 5, color: '#ffd23f' },
             { name: 'Topaz', value: 10, color: '#ffa63f' }, { name: 'Ruby', value: 25, color: '#ff3b5c' }],
      fossils: ['Croc Skull', 'Croc Jaw', 'Croc Scales', 'Croc Leg', 'Croc Tail'],
      exhibit: { name: 'Mega Crocodile', income: 12.5 },
      relic: { name: 'Golden Jaguar Idol', color: '#ffd23f' },
      pal: { sky: ['#5fbf6f', '#c9f2a0'], top: '#2e8f3e', dirt: ['#6b4a2b', '#5a5a3a', '#4a4030'], stone: '#8a8268',
             feature: '#b8a070', bed: '#20241a', hills: '#1f6e33' },
      music: { tempo: 128, root: 62, scale: [0, 2, 3, 7, 8], wave: 'square' } },
    { id: 'moon', name: 'The Moon', rule: 'lowgrav', ruleText: 'Low gravity: loot bounces around before you grab it.',
      hp: 750, oreMult: 125,
      ores: [{ name: 'Moon Rock', value: 2, color: '#d6d6e0' }, { name: 'Helium Ice', value: 5, color: '#a8e8ff' },
             { name: 'Titanium', value: 10, color: '#9aa6c8' }, { name: 'Star Diamond', value: 25, color: '#ffffff' }],
      fossils: ['Rover Wheel', 'Rover Antenna', 'Rover Panel', 'Rover Camera', 'Rover Flag'],
      exhibit: { name: 'Lost Moon Rover', income: 62.5 },
      relic: { name: 'Moonstone Core', color: '#e0e6ff' },
      pal: { sky: ['#05060f', '#1a1c33'], top: '#c8c8d0', dirt: ['#9c9ca8', '#80808e', '#666675'], stone: '#55556a',
             feature: '#2a2a3a', bed: '#12121c', hills: '#7a7a88' },
      music: { tempo: 72, root: 64, scale: [0, 2, 4, 6, 9], wave: 'sine' } },
    { id: 'alien', name: 'Planet Glorp', rule: 'goo', ruleText: 'Alien goo grows back if you stop drilling it. Tap fast!',
      hp: 2200, oreMult: 625,
      ores: [{ name: 'Glowshroom', value: 2, color: '#b6ff3f' }, { name: 'Plasma Gem', value: 5, color: '#ff4fd8' },
             { name: 'Void Crystal', value: 10, color: '#8a5cff' }, { name: 'Nebula Opal', value: 25, color: '#5ff3ff' }],
      fossils: ['Serpent Skull', 'Serpent Fang', 'Serpent Wing', 'Serpent Coil', 'Serpent Tail'],
      exhibit: { name: 'Sky Serpent of Glorp', income: 312.5 },
      relic: { name: 'Star Seed', color: '#ff9cf5' },
      pal: { sky: ['#3a0d5c', '#b04fa8'], top: '#7dff6a', dirt: ['#5a2e7a', '#472466', '#361a4f'], stone: '#2f5a5a',
             feature: '#5dff7a', bed: '#150a20', hills: '#6a2a8a' },
      music: { tempo: 100, root: 55, scale: [0, 1, 4, 6, 8], wave: 'sawtooth' } }
  ];

  var UPGRADES = {
    drill:  { name: 'Drill Power', base: 15, mult: 1.75, max: 30, text: 'Hits harder' },
    speed:  { name: 'Dig Speed',   base: 8,  mult: 1.7,  max: 20, text: 'Digs faster on its own' },
    bag:    { name: 'Bag Size',    base: 12, mult: 1.6,  max: 20, text: 'Carry more before it gets heavy' },
    magnet: { name: 'Magnet',      base: 60, mult: 4,    max: 3,  text: 'Pulls in ore from nearby blocks' }
  };
  var WORKERS = {
    diggers: { name: 'Helper Digger', base: 80, mult: 2.5, max: 5, text: '+1 dig hit per second' },
    staff:   { name: 'Museum Guide',  base: 100, mult: 2.5, max: 5, text: '+30% visitor coins' }
  };
  var O2_MAX = 75;
  var ORE_P = 0.11; // chance that a ground block holds ore
  var WALK = 6;      // cells per second the miner walks between blocks
  var MANUAL_HOLD = 2; // seconds auto-walk waits after the player steers

  // ---------- the surface plaza (hub) ----------
  // One character per cell, x across, z down the rows, from (x0, z0). The pit is at x, z in [0, N).
  //   .  grass        =  path        m  museum floor    P  pit          #  museum wall
  //   t  tree / prop  T  landmark    p  potted plant    s  shop stall   h  helpers hut   w  world signpost
  //   1-5  plinth for world 1-5      a-e  relic case for world 1-5      D  front desk
  //   L S H W M  pads: dig (top of the ladder), shop, helpers, worlds, museum desk
  var HUB = { x0: -8, z0: -8, rows: [
    't....t..t....t..................',
    '..t.........t..t................',
    '..TT.....hhh.....t..............',
    '..TT.....hhh.t..................',
    't........hhh......##############',
    '.....w....H.......#pmmmmmmmmmmp#',
    '..t...W...=.......#mmm111mm222m#',
    '.......=========..#mmm111am222b#',
    '..sss..=PPPPPPP=..#mmmmmmmmmmmm#',
    't.sssS==PPPPPPP=..#mmmmmmmmmmmm#',
    '..sss..=PPPPPPP===mmmmmmmmmmmmm#',
    '.......LPPPPPPP===mmmmm333mmmmm#',
    '.......=PPPPPPP=..#mmmm333cmmmm#',
    '.t.....=PPPPPPP=..#mDMmmmmmmmmm#',
    '....t..=PPPPPPP=..#mDmmmmmmmmmm#',
    '.......=========..#mmmmmmmmmmmm#',
    '..................#mmm444mm555m#',
    't.t.............t.#mmm444dm555e#',
    '...........t......#mmmmmmmmmmmm#',
    '..................#pmmmmmmmmmmp#',
    '...t..........t...##############',
    '..........t..................t..',
    '......t.........t...t....t.....t'
  ] };
  var HUB_STATIONS = { L: 'dig', S: 'shop', H: 'helpers', W: 'worlds', M: 'museum' };
  var HUB_OPEN = '.=mLSHWM';
  var HUB_SPEED = 4;     // cells per second on the plaza
  var HUB_R = 0.3;       // the miner's radius for bumping into things
  var LADDER_Z = 3;      // the ladder hangs on the x = 0 pit wall at this z; its pad is at (-1, LADDER_Z)
  var HUB_W = HUB.rows[0].length, HUB_H = HUB.rows.length;
  function hubCell(x, z) {
    var r = HUB.rows[z - HUB.z0];
    return r ? r.charAt(x - HUB.x0) : '';
  }
  function hubWalkable(x, z) { var c = hubCell(x, z); return c !== '' && HUB_OPEN.indexOf(c) >= 0; }
  function hubHome() { return { x: -0.5, z: LADDER_Z + 0.5, input: null, path: null }; }
  function hubStation(s) { return HUB_STATIONS[hubCell(Math.floor(s.hub.x), Math.floor(s.hub.z))] || null; }
  // the world whose plinth or relic case is next to the miner, or -1
  function hubNearExhibit(s) {
    var cx = Math.floor(s.hub.x), cz = Math.floor(s.hub.z);
    for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
      var c = hubCell(cx + dx, cz + dz), k = '12345'.indexOf(c);
      if (c && k < 0) k = 'abcde'.indexOf(c);
      if (c && k >= 0) return k;
    }
    return -1;
  }
  // held keys: one direction or a list of them ('n', 's', 'e', 'w'), or null to stop
  function hubInput(s, dirs) {
    var v = [0, 0];
    (dirs == null ? [] : [].concat(dirs)).forEach(function (d) { var k = dirKey(d); if (k) { v[0] += DIRS[k][0]; v[1] += DIRS[k][1]; } });
    s.hub.input = v[0] || v[1] ? v : null;
    if (s.hub.input) s.hub.path = null;
  }
  // can a circle of radius HUB_R stand at (x, z)?
  function hubFree(x, z) {
    for (var cz = Math.floor(z - HUB_R); cz <= Math.floor(z + HUB_R); cz++)
      for (var cx = Math.floor(x - HUB_R); cx <= Math.floor(x + HUB_R); cx++)
        if (!hubWalkable(cx, cz)) return false;
    return true;
  }
  function hubMove(s, vx, vz, dist) { // slide along walls: x and z separately
    var h = s.hub, len = Math.sqrt(vx * vx + vz * vz) || 1, n = Math.ceil(dist / 0.05), ux = vx / len * dist / n, uz = vz / len * dist / n;
    for (var i = 0; i < n; i++) { // small sub-steps so the miner stops right at the edge
      if (hubFree(h.x + ux, h.z)) h.x += ux;
      if (hubFree(h.x, h.z + uz)) h.z += uz;
    }
  }
  // shortest path over open cells (8 neighbours, no corner cutting) to the cell at (x, z),
  // or to the nearest open cell when that one is blocked. Returns false if there is none.
  function hubPath(fx, fz, x, z) {
    var tx = Math.floor(x), tz = Math.floor(z), sx = Math.floor(fx), sz = Math.floor(fz);
    if (!hubWalkable(tx, tz)) {
      var best = null, bd = Infinity;
      for (var r = 1; r <= 3 && !best; r++) for (var dz = -r; dz <= r; dz++) for (var dx = -r; dx <= r; dx++) {
        if (!hubWalkable(tx + dx, tz + dz)) continue;
        var d = dx * dx + dz * dz + ((tx + dx - sx) * (tx + dx - sx) + (tz + dz - sz) * (tz + dz - sz)) * 1e-3;
        if (d < bd) { bd = d; best = [tx + dx, tz + dz]; }
      }
      if (!best) return null;
      tx = best[0]; tz = best[1];
    }
    var key = function (cx, cz) { return (cz - HUB.z0) * HUB_W + (cx - HUB.x0); };
    var prev = new Int32Array(HUB_W * HUB_H).fill(-2), q = [key(sx, sz)], goal = key(tx, tz);
    prev[q[0]] = -1;
    var NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (var i = 0; i < q.length && prev[goal] === -2; i++) {
      var k = q[i], cx = k % HUB_W + HUB.x0, cz = Math.floor(k / HUB_W) + HUB.z0;
      for (var n = 0; n < 8; n++) {
        var ax = cx + NB[n][0], az = cz + NB[n][1];
        if (!hubWalkable(ax, az)) continue;
        if (NB[n][0] && NB[n][1] && (!hubWalkable(ax, cz) || !hubWalkable(cx, az))) continue;
        var ak = key(ax, az); if (prev[ak] !== -2) continue;
        prev[ak] = k; q.push(ak);
      }
    }
    if (prev[goal] === -2) return null;
    var out = [];
    for (var c = goal; c !== -1 && c !== q[0]; c = prev[c]) out.unshift([c % HUB_W + HUB.x0 + 0.5, Math.floor(c / HUB_W) + HUB.z0 + 0.5]);
    return out.length ? out : [[tx + 0.5, tz + 0.5]];
  }
  function hubWalkTo(s, x, z) {
    var p = hubPath(s.hub.x, s.hub.z, x, z);
    s.hub.path = p; if (p) s.hub.input = null;
    return !!p;
  }
  function stepHub(s, dt) {
    var h = s.hub, d = HUB_SPEED * dt;
    if (h.input) { hubMove(s, h.input[0], h.input[1], d); return; }
    while (h.path && d > 0) {
      var p = h.path[0], ex = p[0] - h.x, ez = p[1] - h.z, l = Math.sqrt(ex * ex + ez * ez);
      if (l <= d) { h.x = p[0]; h.z = p[1]; d -= l; h.path.shift(); if (!h.path.length) h.path = null; }
      else { h.x += ex / l * d; h.z += ez / l * d; d = 0; }
    }
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rand(s) { // state-held rng
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    var t = Math.imul(s.rng ^ s.rng >>> 15, 1 | s.rng);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  function maxHp(w, type, y) {
    var m = HP_MULT[type];
    if (type === TILE.BEDROCK) return Infinity;
    if (!m) return 0;
    return WORLDS[w].hp * (0.15 + 2.7 * Math.pow(y / DEPTH, 1.3)) * m;
  }
  function passable(type) { return type === TILE.AIR || type === TILE.BUBBLE || type === TILE.CRATER; }
  function diggable(type) { return !passable(type) && type !== TILE.BEDROCK; }
  // blocks still to dig in layer y
  function layerHasBlocks(g, y) {
    for (var i = y * NN, e = i + NN; i < e; i++) if (diggable(g.t[i])) return true;
    return false;
  }
  // the topmost layer with blocks left: the layer being cleared
  function topLayer(g) {
    for (var y = 1; y <= DEPTH; y++) if (layerHasBlocks(g, y)) return y;
    return DEPTH;
  }
  // Shortest walk over open cells of layer y from (x, z) to a cell next to a block.
  // Returns { target: block index, steps: [[x, z], ...] } or null.
  function findNearest(g, x0, y, z0) {
    var seen = new Uint8Array(NN), prev = new Int16Array(NN).fill(-1), q = [z0 * N + x0], DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    seen[z0 * N + x0] = 1;
    for (var h = 0; h < q.length; h++) {
      var c = q[h], cx = c % N, cz = (c - cx) / N;
      for (var k = 0; k < 4; k++) {
        var nx = cx + DV[k][0], nz = cz + DV[k][1];
        if (nx < 0 || nx >= N || nz < 0 || nz >= N) continue;
        var nc = nz * N + nx, tt = g.t[y * NN + nc];
        if (diggable(tt)) {
          var steps = [];
          for (var b = c; b !== z0 * N + x0; b = prev[b]) steps.unshift([b % N, (b - b % N) / N]);
          return { target: y * NN + nc, steps: steps };
        }
        if (!seen[nc] && passable(tt)) { seen[nc] = 1; prev[nc] = c; q.push(nc); }
      }
    }
    return null;
  }

  function genWorld(w, seed) {
    var rng = mulberry32((seed * 7919 + w * 104729) | 0);
    var n = NN * (DEPTH + 2);
    var t = new Uint8Array(n), v = new Uint8Array(n);
    var x, y, z, i, k;
    function ri(m) { return Math.floor(rng() * m); }
    function set(x, y, z, tt, vv) {
      if (x < 0 || x >= N || z < 0 || z >= N || y < 1 || y >= DEPTH) return;
      t[idx(x, y, z)] = tt; v[idx(x, y, z)] = vv || 0;
    }
    for (y = 1; y < DEPTH; y++) {
      var f = y / DEPTH;
      for (i = y * NN; i < (y + 1) * NN; i++) {
        var r = rng(), tt = TILE.DIRT, vv = 0;
        if (r < ORE_P) {
          tt = TILE.ORE;
          var maxIdx = Math.min(3, Math.floor(f * 4.5));
          vv = Math.min(maxIdx, Math.floor(Math.pow(rng(), 1.6) * (maxIdx + 1)));
        } else if (r < ORE_P + 0.06 + 0.2 * f) tt = TILE.STONE;
        t[i] = tt; v[i] = vv;
      }
    }
    var rule = WORLDS[w].rule;
    if (rule === 'roots') { // straight root runs along x or z
      for (y = 4; y < DEPTH - 1; y++) for (k = 0; k < 2; k++) if (rng() < 0.4) {
        var len = 2 + ri(4), alongX = rng() < 0.5, a0 = ri(N), b0 = ri(N);
        for (i = 0; i < len; i++) alongX ? set(a0 + i, y, b0, TILE.ROOT) : set(b0, y, a0 + i, TILE.ROOT);
      }
    } else if (rule === 'oxygen') { // small bubble blobs: a plus shape with one cell below
      for (y = 6; y < DEPTH - 2; y += 8 + ri(4)) for (k = 0; k < 2; k++) {
        var bx = 1 + ri(N - 2), bz = 1 + ri(N - 2);
        set(bx, y, bz, TILE.BUBBLE); set(bx - 1, y, bz, TILE.BUBBLE); set(bx + 1, y, bz, TILE.BUBBLE);
        set(bx, y, bz - 1, TILE.BUBBLE); set(bx, y, bz + 1, TILE.BUBBLE); set(bx, y + 1, bz, TILE.BUBBLE);
      }
    } else if (rule === 'traps') { // scattered traps, plus 3×3×2 treasure rooms with chests in a stone floor
      for (i = NN * 5; i < NN * DEPTH; i++) if (rng() < 0.045) { t[i] = TILE.TRAP; v[i] = 0; }
      for (y = 10; y < DEPTH - 4; y += 9 + ri(4)) {
        var rx = ri(N - 2), rz = ri(N - 2), dx, dz;
        for (dz = 0; dz < 3; dz++) for (dx = 0; dx < 3; dx++) {
          set(rx + dx, y, rz + dz, TILE.AIR); set(rx + dx, y + 1, rz + dz, TILE.AIR); set(rx + dx, y + 2, rz + dz, TILE.STONE);
        }
        var c1 = ri(9), c2 = (c1 + 1 + ri(8)) % 9;
        set(rx + c1 % 3, y + 2, rz + Math.floor(c1 / 3), TILE.CHEST);
        set(rx + c2 % 3, y + 2, rz + Math.floor(c2 / 3), TILE.CHEST);
      }
    } else if (rule === 'lowgrav') { // spherical craters
      for (y = 6; y < DEPTH - 3; y += 5 + ri(4)) {
        var cx = 1 + ri(N - 2), cz = 1 + ri(N - 2), rad = 1 + ri(2);
        for (var ey = -rad; ey <= rad; ey++) for (var ez = -rad; ez <= rad; ez++) for (var ex = -rad; ex <= rad; ex++)
          if (ex * ex + ey * ey + ez * ez <= rad * rad) set(cx + ex, y + ey, cz + ez, TILE.CRATER);
      }
    } else if (rule === 'goo') { // goo voxels scattered through the dirt
      for (i = NN * 3; i < NN * DEPTH; i++) if (t[i] === TILE.DIRT && rng() < 0.3) t[i] = TILE.GOO;
    }
    // fossil pieces: two copies of each, spread down the column, only in plain ground
    for (var p = 0; p < 5; p++) for (var c = 0; c < 2; c++) {
      y = 8 + p * 17 + c * 8 + ri(4);
      for (var tries = 0; tries < 200; tries++) {
        x = ri(N); z = ri(N);
        var yy = Math.min(DEPTH - 1, y + Math.floor(tries / 20)), ti = t[idx(x, yy, z)];
        if (ti === TILE.DIRT || ti === TILE.STONE || ti === TILE.ORE) { set(x, yy, z, TILE.FOSSIL, p); break; }
      }
    }
    for (i = 0; i < NN; i++) { t[DEPTH * NN + i] = TILE.RELIC; t[(DEPTH + 1) * NN + i] = TILE.BEDROCK; t[i] = TILE.AIR; v[i] = 0; }
    var mid = Math.floor(N / 2);
    var g = { t: t, v: v, hp: new Float32Array(n), deepest: 0, deepestX: mid, deepestZ: mid, gen: 0 };
    fillHp(w, g);
    return g;
  }
  function fillHp(w, g) {
    for (var i = 0; i < g.t.length; i++) g.hp[i] = maxHp(w, g.t[i], Math.floor(i / NN));
  }

  function newState(seed) {
    var s = {
      v: 1, seed: seed | 0, rng: (seed | 0) ^ 0x5bd1e995, coins: 0,
      unlocked: [true, false, false, false, false], relics: [false, false, false, false, false],
      upgrades: { drill: 0, speed: 0, bag: 0, magnet: 0 }, workers: { diggers: 0, staff: 0 },
      museum: WORLDS.map(function () { return { pieces: [0, 0, 0, 0, 0] }; }),
      sites: [null, null, null, null, null], world: 0, mode: 'surface', run: null, events: [], hub: hubHome(),
      stats: { trapsSprung: 0, timePlayed: 0, digs: 0 }
    };
    return s;
  }
  function emit(s, e) { s.events.push(e); if (s.events.length > 80) s.events.shift(); }
  function site(s, w) {
    if (!s.sites[w]) s.sites[w] = genWorld(w, s.seed + 1000 * w);
    return s.sites[w];
  }
  function resetSite(s, w) {
    var old = site(s, w), gen = (old.gen || 0) + 1;
    s.sites[w] = genWorld(w, s.seed + 1000 * w + 77 * gen); s.sites[w].gen = gen;
  }

  function bagCap(s) { return 10 + 4 * s.upgrades.bag; }
  function weightFactor(s, n) {
    var cap = bagCap(s);
    if (n <= cap) return 1;
    return Math.max(0.15, 1 / (1 + 0.12 * (n - cap)));
  }
  function costOf(def, lvl) { return lvl >= def.max ? Infinity : Math.round(def.base * Math.pow(def.mult, lvl)); }
  function upgradeCost(s, k) { return costOf(UPGRADES[k], s.upgrades[k]); }
  function buyUpgrade(s, k) {
    var c = upgradeCost(s, k);
    if (!isFinite(c) || s.coins < c) return false;
    s.coins -= c; s.upgrades[k]++; emit(s, { type: 'buy', key: k }); return true;
  }
  function hireCost(s, k) { return costOf(WORKERS[k], s.workers[k]); }
  function hire(s, k) {
    var c = hireCost(s, k);
    if (!isFinite(c) || s.coins < c) return false;
    s.coins -= c; s.workers[k]++; emit(s, { type: 'hire', key: k }); return true;
  }
  function drillDamage(s) { return Math.pow(1.5, s.upgrades.drill); }
  function hitRate(s) { return 2 * (1 + 0.35 * s.upgrades.speed) + s.workers.diggers; }

  function exhibitDone(s, w) { return s.museum[w].pieces.every(function (c) { return c > 0; }); }
  function museumIncome(s) {
    var inc = 0;
    for (var w = 0; w < 5; w++) {
      var have = s.museum[w].pieces.filter(function (c) { return c > 0; }).length;
      inc += have * WORLDS[w].exhibit.income * 0.05;
      if (have === 5) inc += WORLDS[w].exhibit.income;
    }
    return inc * (1 + 0.3 * s.workers.staff);
  }
  function itemValue(it) {
    var wd = WORLDS[it.world];
    if (it.kind === 'ore') return Math.round(wd.ores[it.idx].value * wd.oreMult);
    if (it.kind === 'treasure') return it.value;
    if (it.kind === 'fossil') return Math.round(15 * wd.oreMult);
    return 0;
  }
  function itemName(it) {
    var wd = WORLDS[it.world];
    if (it.kind === 'ore') return wd.ores[it.idx].name;
    if (it.kind === 'fossil') return wd.fossils[it.idx];
    if (it.kind === 'relic') return wd.relic.name;
    return 'Treasure';
  }

  function startDig(s, w) {
    if (!s.unlocked[w]) throw new Error('world locked');
    if (s.mode !== 'surface') return;
    s.world = w;
    var g = site(s, w);
    s.run = { x: g.deepestX, y: g.deepest, z: g.deepestZ, bag: [], loot: [], oxygen: O2_MAX, stun: 0, steer: 0, fallAcc: 0,
              walkAcc: 0, path: null, manual: 0, stepCD: 0, state: 'idle', taps: 0, grid: g, elevT: Math.min(2, 0.5 + g.deepest * 0.015), relicTimer: 0, goo: {}, target: -1 };
    s.mode = 'down';
    emit(s, { type: 'descend' });
  }
  function tap(s) { if (s.mode === 'dig' && s.run.stun <= 0) s.run.taps++; }
  // the player takes over: auto-walk waits MANUAL_HOLD seconds after the last steer
  function steer(s, dir) { if (s.mode === 'dig') { s.run.steer = dirKey(dir); s.run.manual = MANUAL_HOLD; } }
  function goHome(s, reason) {
    if (s.mode !== 'dig') return;
    var r = s.run;
    r.loot.forEach(function (l) { r.bag.push(l.item); }); r.loot = [];
    s.mode = 'up'; r.elevT = Math.min(3, 1 + r.y * 0.02);
    emit(s, { type: 'ascend', reason: reason || 'button' });
  }
  function bank(s) {
    var r = s.run, coins = 0, pieces = [], relic = null;
    r.bag.forEach(function (it) {
      if (it.kind === 'fossil') {
        var m = s.museum[it.world];
        if (m.pieces[it.idx] === 0) pieces.push(itemName(it)); else coins += itemValue(it);
        m.pieces[it.idx]++;
      } else if (it.kind === 'relic') {
        if (!s.relics[it.world]) { s.relics[it.world] = true; relic = it.world; if (it.world < 4) s.unlocked[it.world + 1] = true; }
      } else coins += itemValue(it);
    });
    s.coins += coins; r.bag = []; s.hub = hubHome();
    emit(s, { type: 'banked', coins: coins, pieces: pieces, relic: relic });
  }

  function collect(s, it) {
    var r = s.run;
    r.bag.push(it);
    emit(s, { type: 'collect', item: it, name: itemName(it) });
    if (it.kind === 'relic') { r.relicTimer = 1.5; emit(s, { type: 'relic', world: it.world }); }
  }
  function breakTile(s, i) {
    var r = s.run, g = r.grid, w = s.world, tt = g.t[i], vv = g.v[i], it = null;
    var bx = i % N, bz = Math.floor(i / N) % N, by = Math.floor(i / NN);
    if (tt === TILE.ORE) it = { kind: 'ore', world: w, idx: vv };
    else if (tt === TILE.FOSSIL) it = { kind: 'fossil', world: w, idx: vv };
    else if (tt === TILE.CHEST) it = { kind: 'treasure', world: w, value: Math.round(25 * WORLDS[w].oreMult) };
    else if (tt === TILE.TRAP) { r.stun = 2; s.stats.trapsSprung++; emit(s, { type: 'trap' }); }
    else if (tt === TILE.RELIC) {
      var have = s.relics[w] || r.bag.some(function (b) { return b.kind === 'relic'; });
      it = have ? { kind: 'treasure', world: w, value: Math.round(100 * WORLDS[w].oreMult) } : { kind: 'relic', world: w };
    }
    g.t[i] = TILE.AIR; g.v[i] = 0; g.hp[i] = 0;
    delete r.goo[i];
    s.stats.digs++;
    emit(s, { type: 'break', x: bx, y: by, z: bz, tile: tt });
    if (!it) return;
    if (WORLDS[w].rule === 'lowgrav' && it.kind !== 'relic') {
      r.loot.push({ x: bx + 0.5, y: by + 0.5, z: bz + 0.5, vx: (rand(s) - 0.5) * 3, vy: -3 - rand(s) * 2, vz: (rand(s) - 0.5) * 3,
                    item: it, age: 0 });
    } else collect(s, it);
  }
  function magnetPull(s) { // ore in the miner's layer within a square (Chebyshev) radius
    var r = s.run, g = r.grid, rad = s.upgrades.magnet;
    if (!rad || r.y >= DEPTH) return;
    for (var dz = -rad; dz <= rad; dz++) for (var dx = -rad; dx <= rad; dx++) {
      var x = r.x + dx, z = r.z + dz;
      if (x < 0 || x >= N || z < 0 || z >= N) continue;
      var i = idx(x, r.y, z);
      if (g.t[i] === TILE.ORE) breakTile(s, i);
    }
  }
  function solidAt(g, fx, fy, fz) {
    var x = Math.floor(fx), y = Math.floor(fy), z = Math.floor(fz);
    if (x < 0 || x >= N || z < 0 || z >= N) return true;
    if (y < 0) return false;
    return !passable(g.t[idx(x, y, z)]);
  }
  function stepLoot(s, dt) {
    var r = s.run, g = r.grid, grav = 4, reach = 1.2 + s.upgrades.magnet * 0.6;
    var px = r.x + 0.5, py = r.y + 0.5, pz = r.z + 0.5;
    for (var k = r.loot.length - 1; k >= 0; k--) {
      var l = r.loot[k];
      l.age += dt;
      if (l.age > 3) { // drift toward the miner
        var ddx = px - l.x, ddy = py - l.y, ddz = pz - l.z, d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1;
        l.vx = ddx / d * 4; l.vy = ddy / d * 4; l.vz = ddz / d * 4;
        l.x += l.vx * dt; l.y += l.vy * dt; l.z += l.vz * dt;
      } else { // bounce off blocks along each axis
        l.vy += grav * dt;
        var nx = l.x + l.vx * dt, ny = l.y + l.vy * dt, nz = l.z + l.vz * dt;
        if (solidAt(g, nx, l.y, l.z)) { l.vx = -l.vx * 0.6; nx = l.x; }
        if (solidAt(g, l.x, ny, l.z)) { l.vy = -l.vy * 0.6; ny = l.y; }
        if (solidAt(g, l.x, l.y, nz)) { l.vz = -l.vz * 0.6; nz = l.z; }
        l.x = nx; l.y = ny; l.z = nz;
      }
      var ex = px - l.x, ey = py - l.y, ez = pz - l.z;
      if ((l.age > 0.6 && ex * ex + ey * ey + ez * ez < reach * reach) || l.age > 8) { r.loot.splice(k, 1); collect(s, l.item); }
    }
  }

  function stepDig(s, dt) {
    var r = s.run, g = r.grid, w = s.world, rule = WORLDS[w].rule;
    var hitThisStep = -1, layers = DEPTH + 2;
    if (rule === 'oxygen' && r.y > 0) {
      r.oxygen -= dt;
      if (r.oxygen <= 0) { r.oxygen = 0; goHome(s, 'oxygen'); return; }
      for (var oy = r.y - 1; oy <= r.y + 1; oy++) for (var oz = r.z - 1; oz <= r.z + 1; oz++) for (var ox = r.x - 1; ox <= r.x + 1; ox++) {
        if (ox < 0 || ox >= N || oz < 0 || oz >= N || oy < 0) continue;
        var oi = idx(ox, oy, oz);
        if (g.t[oi] === TILE.BUBBLE) { g.t[oi] = TILE.AIR; r.oxygen = O2_MAX; emit(s, { type: 'bubble', x: ox, y: oy, z: oz }); }
      }
    }
    if (rule === 'lowgrav') stepLoot(s, dt);
    if (r.relicTimer > 0) { r.relicTimer -= dt; if (r.relicTimer <= 0) { goHome(s, 'relic'); return; } }
    if (r.stun > 0) { r.stun = Math.max(0, r.stun - dt); r.taps = 0; }
    else {
      var y = r.y, tgt = -1, steered = false, moved = false;
      // steering: walk onto an open cell, or pick that block as the next one to dig
      r.manual = Math.max(0, (r.manual || 0) - dt); r.stepCD = Math.max(0, (r.stepCD || 0) - dt);
      if (r.steer) {
        var sd = DIRS[r.steer], sx = r.x + sd[0], sz = r.z + sd[1];
        var st = sx < 0 || sx >= N || sz < 0 || sz >= N ? TILE.BEDROCK : g.t[idx(sx, y, sz)];
        if (passable(st)) { // one cell at a time, at walking pace
          if (r.stepCD <= 0) { r.x = sx; r.z = sz; r.steer = 0; r.path = null; r.stepCD = 1 / WALK; magnetPull(s); }
          moved = true;
        }
        else if (diggable(st)) { tgt = idx(sx, y, sz); steered = true; }
        else r.steer = 0;
      }
      if (tgt < 0 && !layerHasBlocks(g, y)) {
        // layer cleared: drop into the open cell below, or dig the block underfoot to open the next layer
        r.path = null;
        var bi = idx(r.x, y + 1, r.z);
        if (y + 1 < layers && passable(g.t[bi])) {
          r.state = 'fall'; r.fallAcc += dt * (rule === 'lowgrav' ? 4 : 9); r.taps = 0;
          // stop in the first layer that still has blocks: it must be cleared before the next one opens
          while (r.fallAcc >= 1 && r.y + 1 < layers && passable(g.t[idx(r.x, r.y + 1, r.z)]) && !layerHasBlocks(g, r.y)) { r.fallAcc -= 1; r.y++; magnetPull(s); }
          if (layerHasBlocks(g, r.y)) r.fallAcc = 0;
        } else if (y + 1 < layers && diggable(g.t[bi])) tgt = bi;
        else { r.state = 'idle'; r.taps = 0; }
      } else if (tgt < 0 && !moved && r.manual > 0) { r.state = 'idle'; r.taps = 0; r.path = null; } // the player has control
      else if (tgt < 0 && !moved) {
        // auto-walk: follow the shortest path over open cells to the nearest block, then dig it
        r.fallAcc = 0;
        if (!r.path || !diggable(g.t[r.path.target])) r.path = findNearest(g, r.x, y, r.z);
        if (r.path && r.path.steps.length) {
          r.state = 'walk'; r.taps = 0; r.walkAcc += dt * WALK;
          while (r.walkAcc >= 1 && r.path.steps.length) { var c = r.path.steps.shift(); r.x = c[0]; r.z = c[1]; r.walkAcc -= 1; magnetPull(s); }
        } else if (r.path) tgt = r.path.target;
        else { r.state = 'idle'; r.taps = 0; }
      }
      if (moved) { r.state = 'walk'; r.taps = 0; }
      if (tgt >= 0) {
        r.walkAcc = 0; r.fallAcc = 0; r.state = 'dig';
        var wf = weightFactor(s, r.bag.length + r.loot.length);
        var idle = drillDamage(s) * hitRate(s) * dt * wf;
        var dmg = idle + drillDamage(s) * r.taps * wf;
        if (g.t[tgt] === TILE.GOO) dmg -= idle * 0.55; // goo grows back while you drill it
        r.taps = 0;
        g.hp[tgt] -= dmg; hitThisStep = tgt; r.target = tgt;
        if (g.t[tgt] === TILE.GOO) r.goo[tgt] = 1;
        if (g.hp[tgt] <= 0) {
          breakTile(s, tgt);
          if (steered) r.steer = 0;
          r.path = null;
        }
      } else r.target = -1;
    }
    for (var k in r.goo) {
      var gi = +k;
      if (gi === hitThisStep) continue;
      var mx = maxHp(w, TILE.GOO, Math.floor(gi / NN));
      g.hp[gi] = Math.min(mx, g.hp[gi] + mx * 0.4 * dt);
      if (g.hp[gi] >= mx) delete r.goo[k];
    }
    if (r.y > g.deepest || (r.y === g.deepest && (g.deepestX !== r.x || g.deepestZ !== r.z))) { g.deepest = r.y; g.deepestX = r.x; g.deepestZ = r.z; }
  }

  function step(s, dt) {
    s.stats.timePlayed += dt;
    s.coins += museumIncome(s) * dt;
    if (s.mode === 'dig') stepDig(s, dt);
    else if (s.mode === 'surface') stepHub(s, dt);
    else if (s.mode === 'down') { s.run.elevT -= dt; if (s.run.elevT <= 0) { s.mode = 'dig'; emit(s, { type: 'arrive' }); } }
    else if (s.mode === 'up') { s.run.elevT -= dt; if (s.run.elevT <= 0) { s.mode = 'surface'; bank(s); } }
  }

  function serialize(s) {
    var bag = s.run && s.mode !== 'surface' ? s.run.bag.concat(s.run.loot.map(function (l) { return l.item; })) : [];
    return JSON.stringify({
      v: 2, seed: s.seed, rng: s.rng, coins: s.coins, unlocked: s.unlocked, relics: s.relics, upgrades: s.upgrades,
      workers: s.workers, museum: s.museum, world: s.world, stats: s.stats, bag: bag,
      sites: s.sites.map(function (g) { return g && { t: Array.from(g.t), v: Array.from(g.v), deepest: g.deepest, deepestX: g.deepestX, deepestZ: g.deepestZ, gen: g.gen || 0 }; })
    });
  }
  function deserialize(str) {
    try {
      var o = JSON.parse(str);
      if (!o || (o.v !== 1 && o.v !== 2)) return null;
      var s = newState(o.seed);
      ['rng', 'coins', 'unlocked', 'relics', 'upgrades', 'workers', 'museum', 'world', 'stats'].forEach(function (k) { if (o[k] != null) s[k] = o[k]; });
      s.sites = o.sites.map(function (g, w) {
        // v1 saves hold the old flat 11-wide slice: drop the site so a fresh 3D one is dug
        if (!g || !g.t || g.t.length !== NN * (DEPTH + 2)) return null;
        var mid = Math.floor(N / 2);
        var gg = { t: Uint8Array.from(g.t), v: Uint8Array.from(g.v), hp: new Float32Array(g.t.length), deepest: g.deepest,
                   deepestX: g.deepestX == null ? mid : g.deepestX, deepestZ: g.deepestZ == null ? mid : g.deepestZ, gen: g.gen };
        fillHp(w, gg); return gg;
      });
      if (o.bag && o.bag.length) { s.run = { bag: o.bag, loot: [] }; bank(s); s.run = null; }
      s.events = [];
      return s;
    } catch (e) { return null; }
  }

  // test / dev hooks
  function _teleport(s, x, y, z) {
    var g = s.run.grid; if (z == null) z = s.run.z;
    s.mode = 'dig'; s.run.x = x; s.run.y = y; s.run.z = z;
    g.t[idx(x, y, z)] = TILE.AIR; g.hp[idx(x, y, z)] = 0;
    s.run.path = null; s.run.steer = 0; s.run.fallAcc = 0; s.run.manual = 0; s.run.stepCD = 0;
  }
  function _clearLayer(s, y) { // empty a whole layer (open cells only)
    var g = s.run.grid; for (var i = y * NN; i < (y + 1) * NN; i++) { g.t[i] = TILE.AIR; g.v[i] = 0; g.hp[i] = 0; }
    if (s.run.path) s.run.path = null;
  }
  function _setTile(s, x, y, z, tt, vv) {
    var g = s.run.grid, i = idx(x, y, z); g.t[i] = tt; g.v[i] = vv || 0; g.hp[i] = maxHp(s.world, tt, y);
  }

  return { N: N, W: N, DEPTH: DEPTH, idx: idx, DIRS: DIRS, TILE: TILE, WORLDS: WORLDS, UPGRADES: UPGRADES, WORKERS: WORKERS, O2_MAX: O2_MAX, WALK: WALK, MANUAL_HOLD: MANUAL_HOLD,
    genWorld: genWorld, newState: newState, startDig: startDig, step: step, tap: tap, steer: steer, goHome: goHome,
    bagCap: bagCap, weightFactor: weightFactor, upgradeCost: upgradeCost, buyUpgrade: buyUpgrade, hireCost: hireCost,
    hire: hire, museumIncome: museumIncome, exhibitDone: exhibitDone, itemValue: itemValue, itemName: itemName,
    serialize: serialize, deserialize: deserialize, resetSite: resetSite, maxHp: maxHp, passable: passable,
    drillDamage: drillDamage, hitRate: hitRate, site: site, _teleport: _teleport, _setTile: _setTile, _clearLayer: _clearLayer,
    HUB: HUB, HUB_STATIONS: HUB_STATIONS, HUB_SPEED: HUB_SPEED, LADDER_Z: LADDER_Z, hubCell: hubCell, hubWalkable: hubWalkable,
    hubStation: hubStation, hubNearExhibit: hubNearExhibit, hubInput: hubInput, hubWalkTo: hubWalkTo, hubPath: hubPath,
    topLayer: topLayer, layerHasBlocks: layerHasBlocks, diggable: diggable };
})();
