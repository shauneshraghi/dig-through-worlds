// Dig Through Worlds: pure game logic, no DOM. Loaded by index.html as a plain script (global DTW)
// and by tests/logic.test.mjs in a Node vm.
var DTW = (function () {
  'use strict';
  // The world is an N×N column of ground, DEPTH layers deep (relic layer at DEPTH, bedrock below).
  // x and z run across a layer, y is the depth; cell index is (y*N + z)*N + x.
  var N = 7, NN = N * N, DEPTH = 50;
  function idx(x, y, z) { return (y * N + z) * N + x; }
  // compass steering: n/s move along z, e/w along x. -1 / +1 are kept as aliases for w / e.
  var DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  function dirKey(d) { return d === -1 ? 'w' : d === 1 ? 'e' : DIRS.hasOwnProperty(d) ? d : 0; }
  var TILE = { AIR: 0, DIRT: 1, STONE: 2, ORE: 3, FOSSIL: 4, ROOT: 5, BUBBLE: 6, TRAP: 7, GOO: 8, CHEST: 9, RELIC: 10, BEDROCK: 11, CRATER: 12 };
  var HP_MULT = { 1: 1, 2: 2, 3: 1.4, 4: 1.5, 5: 5, 7: 1.5, 8: 1.6, 9: 1.2, 10: 3 };

  var WORLDS = [
    { id: 'forest', name: 'Whispering Forest', rule: 'roots', ruleText: 'Tough tree roots: steer around them!',
      hp: 3, oreMult: 1,
      gem: { name: 'Emerald', color: '#2fd56b' }, // the world's rare themed gem: the one ore that sells for coins
      creatures: [{ name: 'Woolly Mammoth', parts: ['Skull', 'Tusks', 'Ribs', 'Legs', 'Tail'] },
                  { name: 'Raptor', parts: ['Skull', 'Ribs', 'Leg', 'Tail', 'Claw'] },
                  { name: 'T. rex', parts: ['Skull', 'Arms', 'Ribs', 'Legs', 'Tail'] }],
      exhibit: { income: 0.5 },
      relic: { name: 'Heartwood Acorn', color: '#ffcf4a' },
      pal: { sky: ['#8fd3ff', '#d8f3ff'], top: '#4caf3d', dirt: ['#8a5a32', '#73482a', '#5c3a24'], stone: '#7d7d86',
             feature: '#5b3b1c', bed: '#2a2530', hills: '#3f8f3a' },
      music: { tempo: 112, root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle' } },
    { id: 'ocean', name: 'Sunken Ocean Floor', rule: 'oxygen', ruleText: 'Watch your oxygen! Pop bubbles to refill.',
      hp: 40, oreMult: 5,
      gem: { name: 'Aquamarine', color: '#3fc8ff' }, // the world's rare themed gem: the one ore that sells for coins
      creatures: [{ name: 'Giant Sea Turtle', parts: ['Skull', 'Shell', 'Front Flippers', 'Back Flippers', 'Tail'] },
                  { name: 'Giant Shark', parts: ['Tooth', 'Jaw', 'Fin', 'Spine', 'Tail'] },
                  { name: 'Plesiosaur', parts: ['Skull', 'Neck', 'Ribs', 'Paddles', 'Tail'] }],
      exhibit: { income: 4 },
      relic: { name: 'Tide Pearl Crown', color: '#bff7ff' },
      pal: { sky: ['#1b6fa8', '#2fa6d6'], top: '#e9d39a', dirt: ['#cdb27a', '#a88e5c', '#7c6a48'], stone: '#5f7380',
             feature: '#bdf3ff', bed: '#14202e', hills: '#1e5d8a' },
      music: { tempo: 84, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sine' } },
    { id: 'jungle', name: 'Jungle Ruins', rule: 'traps', ruleText: 'Ancient traps make you dizzy. Find the treasure rooms!',
      hp: 100, oreMult: 25,
      gem: { name: 'Ruby', color: '#ff3b5c' }, // the world's rare themed gem: the one ore that sells for coins
      creatures: [{ name: 'Sabre-tooth Cat', parts: ['Skull', 'Fangs', 'Ribs', 'Legs', 'Tail'] },
                  { name: 'Mega Crocodile', parts: ['Skull', 'Jaw', 'Scales', 'Leg', 'Tail'] },
                  { name: 'Stegosaurus', parts: ['Skull', 'Plates', 'Ribs', 'Legs', 'Tail Spikes'] }],
      exhibit: { income: 32 },
      relic: { name: 'Golden Jaguar Idol', color: '#ffd23f' },
      pal: { sky: ['#5fbf6f', '#c9f2a0'], top: '#2e8f3e', dirt: ['#6b4a2b', '#5a5a3a', '#4a4030'], stone: '#8a8268',
             feature: '#b8a070', bed: '#20241a', hills: '#1f6e33' },
      music: { tempo: 128, root: 62, scale: [0, 2, 3, 7, 8], wave: 'square' } },
    { id: 'moon', name: 'The Moon', rule: 'lowgrav', ruleText: 'Low gravity: loot bounces around before you grab it.',
      hp: 750, oreMult: 125,
      gem: { name: 'Star Diamond', color: '#ffffff' }, // the world's rare themed gem: the one ore that sells for coins
      creatures: [{ name: 'Lost Moon Rover', parts: ['Wheels', 'Antenna', 'Panel', 'Camera', 'Flag'] },
                  { name: 'Pterodactyl', parts: ['Skull', 'Crest', 'Wings', 'Body', 'Legs'] },
                  { name: 'Brachiosaurus', parts: ['Skull', 'Neck', 'Ribs', 'Legs', 'Tail'] }],
      exhibit: { income: 256 },
      relic: { name: 'Moonstone Core', color: '#e0e6ff' },
      pal: { sky: ['#05060f', '#1a1c33'], top: '#c8c8d0', dirt: ['#9c9ca8', '#80808e', '#666675'], stone: '#55556a',
             feature: '#2a2a3a', bed: '#12121c', hills: '#7a7a88' },
      music: { tempo: 72, root: 64, scale: [0, 2, 4, 6, 9], wave: 'sine' } },
    { id: 'alien', name: 'Planet Glorp', rule: 'goo', ruleText: 'Alien goo grows back if you stop drilling it. Tap fast!',
      hp: 2200, oreMult: 625,
      gem: { name: 'Nebula Opal', color: '#5ff3ff' }, // the world's rare themed gem: the one ore that sells for coins
      creatures: [{ name: 'Glorpatops', parts: ['Skull', 'Horns', 'Frill', 'Legs', 'Tail'] },
                  { name: 'Sky Serpent', parts: ['Skull', 'Fang', 'Wing', 'Coil', 'Tail'] },
                  { name: 'Space Ankylosaur', parts: ['Skull', 'Armour', 'Ribs', 'Legs', 'Club Tail'] }],
      exhibit: { income: 2048 },
      relic: { name: 'Star Seed', color: '#ff9cf5' },
      pal: { sky: ['#3a0d5c', '#b04fa8'], top: '#7dff6a', dirt: ['#5a2e7a', '#472466', '#361a4f'], stone: '#2f5a5a',
             feature: '#5dff7a', bed: '#150a20', hills: '#6a2a8a' },
      music: { tempo: 100, root: 55, scale: [0, 1, 4, 6, 8], wave: 'sawtooth' } }
  ];
  // Each world has CREATURES skeletons of PIECES pieces. A fossil's index is creature * PIECES + piece;
  // museum[w].pieces holds a count per index. The shallow creature comes first, the deepest last,
  // and a creature's share of the world's exhibit income grows with its depth.
  var CREATURES = 3, PIECES = 5, FOSSILS = CREATURES * PIECES, CREATURE_INCOME = [0.5, 0.75, 1];
  var BAND = [[1, 12], [13, 32], [31, 49]]; // depths where each creature's pieces are buried
  // Big fossils: the two largest pieces of each creature (by the size of their exhibit shape in sprites.js) are
  // buried as one fossil spanning several cells of a layer: '2' two in a row, '3' three in a row, '4' a 2×2 square,
  // '.' a single cell. One string per world, one character per fossil index.
  var BIG_FORMS = ['2.4...24..4..4.', '.22....4.3..23.', '..24...33...34.', '3.3....33...24.', '.24....43..3.3.'];
  // A fossil cell's value is idx + 16 * part, where part names its footprint (w × d cells in x × z) and its
  // offset (dx, dz) in it; part 0 is a single cell. Every cell knows its whole footprint, so saves need nothing new.
  var FOOT = [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3], [2, 2]], PARTS = [];
  FOOT.forEach(function (f) { for (var dz = 0; dz < f[1]; dz++) for (var dx = 0; dx < f[0]; dx++) PARTS.push({ w: f[0], d: f[1], dx: dx, dz: dz }); });
  function partOf(w, d, dx, dz) { for (var p = 0; p < PARTS.length; p++) { var q = PARTS[p]; if (q.w === w && q.d === d && q.dx === dx && q.dz === dz) return p; } return 0; }
  function fossilForm(w, k) { var c = BIG_FORMS[w].charAt(k); return c === '2' ? [2, 1] : c === '3' ? [3, 1] : c === '4' ? [2, 2] : [1, 1]; }
  var CHEST_EVERY = 3;  // layers between treasure chests
  var CHEST_FOSSIL = 0.6; // chance a chest holds a missing fossil piece of the creature buried at that depth
  // A chest is locked. The miner reaching one opens the lock puzzle (run.lock) and the dig waits: pins sit at one
  // of LOCK_LEVELS heights and must match the key's teeth; a tap moves a pin up one (wrapping round) and its linked
  // neighbours with it (LOCK_LINK): in the first world only the pin to its right, so it is solved left to right; after
  // that the pins on both sides, so the taps have to be planned. Picking it gives the contents and a
  // bonus gem worth LOCK_GEM coins (times the world's ore value); smashing it gives SMASH_COINS and never a fossil.
  var LOCK_LEVELS = 4, LOCK_PINS = [4, 4, 5, 5, 6], LOCK_LINK = [1, 2, 2, 2, 2], LOCK_GEM = 30, SMASH_COINS = 8;
  // Not every chest is a pin lock (run.lock.kind): 'pairs' is a memory game, cards face down, two flipped at a time,
  // a match stays up and a miss turns back over after PAIR_MISS seconds; 'simon' lights SIMON_PADS gems in a sequence
  // (SIMON_STEP seconds each) for the player to tap back in order, and a wrong tap plays it again. Each chest picks
  // a kind other than the last one.
  var LOCK_KINDS = ['pins', 'pairs', 'simon', 'slide', 'pipes', 'odd', 'path'], PAIRS = [4, 6, 6, 8, 8], PAIR_MISS = 0.9;
  var SIMON_PADS = 4, SIMON_LEN = [4, 5, 5, 6, 7], SIMON_STEP = 0.7, SIMON_LEAD = 0.6;
  // More puzzles, each harder in later worlds (one entry per world). 'slide': sliding tiles on a SLIDE_N x SLIDE_N board
  // (3 in worlds 1-3, 4 after), scrambled by SLIDE_K random legal moves from solved. 'pipes': turn tiles (a tap is a quarter
  // turn clockwise) so water runs from the left edge to the right edge of a PIPE_N x PIPE_N board. 'odd': ODD_ROUNDS rounds
  // of ODD_CARDS cards that are all one symbol but one (ODD_SETS[w] are the look-alike pairs to draw from, closer-looking in
  // later worlds); a wrong tap waits ODD_WAIT s. 'path': PATH_N numbered gems on a PATH_GRID x PATH_GRID board, tapped
  // 1, 2, 3...; from world 3 on the numbers show for PATH_PREVIEW s and then hide, and a miss shows them for PATH_RECALL s
  // and starts over.
  var SLIDE_N = [3, 3, 3, 4, 4], SLIDE_K = [8, 14, 20, 24, 32];
  var PIPE_N = [3, 4, 4, 5, 5];
  var ODD_ROUNDS = [3, 3, 4, 4, 5], ODD_CARDS = [4, 6, 9, 12, 16], ODD_WAIT = 0.8;
  var ODD_SETS = [
    [['🍎', '🐟'], ['🐸', '🚗'], ['⭐', '🌳']],
    [['🍎', '🍅'], ['🐱', '🐯'], ['🐶', '🐺']],
    [['🐶', '🐕'], ['🍎', '🍏'], ['🐱', '😺']],
    [['🌕', '🌝'], ['😀', '😃'], ['🕐', '🕑']],
    [['🌕', '🌝'], ['🌑', '🌚'], ['😀', '😃'], ['🔺', '🔻']]
  ];
  var PATH_N = [4, 5, 6, 7, 8], PATH_GRID = [3, 3, 4, 4, 4], PATH_PREVIEW = [0, 0, 3, 3.5, 4], PATH_RECALL = 1.5;
  var forceKind = null;
  WORLDS.forEach(function (w) {
    w.fossils = [];
    w.creatures.forEach(function (c, ci) {
      c.income = w.exhibit.income * CREATURE_INCOME[ci];
      c.parts.forEach(function (p) { w.fossils.push(c.name + ' ' + p); });
    });
  });

  // ---------- materials ----------
  // Five global materials, tier 0-4, kept in s.mats. Ore blocks hold a material (ore index = tier) or the world's gem (index 5).
  // The index of an ore tile's value and of a bag item's idx is the index into WORLDS[w].ores.
  var MATS = [{ name: 'Coal', color: '#2b2b2b', icon: '⚫' }, { name: 'Copper', color: '#d9813b', icon: '🟠' },
              { name: 'Iron', color: '#c9b8a6', icon: '⚙️' }, { name: 'Gold', color: '#ffd23f', icon: '🟡' },
              { name: 'Crystal', color: '#9a6bff', icon: '🔮' }];
  var GEM = 5; // ore index of the themed gem
  // Share of a world's ore blocks (percent) per ore index: coal, copper, iron, gold, crystal, gem. The early worlds hold
  // the cheap tiers in bulk, the late ones the dear tiers, and each keeps a little of the two tiers below its main ones.
  var ORE_WEIGHT = [[62, 25, 9, 1, 0, 3], [14, 38, 36, 8, 1, 3], [5, 10, 35, 35, 12, 3], [2, 5, 12, 36, 42, 3], [1, 3, 8, 27, 58, 3]];
  // The exchange at the shop. A material sells for MAT_PRICE coins (about x5 a tier, like oreMult). Buying costs
  // BUY_SPREAD times that, rising by BUY_RAMP of itself with each unit bought since the last trip home (s.matBought), so
  // the cheap way to a material is to dig it where it is common and coins only top up a shortfall.
  var MAT_PRICE = [3, 15, 75, 375, 1875], BUY_SPREAD = 2, BUY_RAMP = 0.1;
  var OLD_ORE_VALUE = [2, 5, 10, 25]; // coin value of old (before save v4) ores, times the world's oreMult
  WORLDS.forEach(function (w) {
    w.ores = MATS.map(function (m, t) { return { name: m.name, color: m.color, mat: t }; }).concat([{ name: w.gem.name, color: w.gem.color, value: 25 }]);
  });
  function emptyMats() { return [0, 0, 0, 0, 0]; }
  // The price of an upgrade or hire at level lvl (of def.max): coins plus materials. def's coin curve is the value V;
  // 40% is paid in coins, 30% in the level's tier (lvl spread over the five tiers), then shares of V in the tiers below
  // it, each count capped by LOW_CAP (grows with the level) so the low tiers are bought in bulk but not absurdly.
  var PRICE_SHARE = [0.3, 0.15, 0.1, 0.05, 0.05], COIN_SHARE = 0.4, LOW_CAP = [300, 200, 120, 60];
  function priceOf(def, lvl) {
    var V = costOf(def, lvl), mats = emptyMats();
    if (!isFinite(V)) return { coins: Infinity, mats: mats };
    var top = Math.min(4, Math.floor(lvl * 5 / def.max)), coinShare = lvl === 0 ? 0 : COIN_SHARE; // a first level costs no coins: the first trip home pays for it
    for (var t = top; t >= 0; t--) {
      var n = Math.ceil((PRICE_SHARE[top - t] + (t === top ? COIN_SHARE - coinShare : 0)) * V / MAT_PRICE[t]);
      if (t < top) n = Math.min(n, Math.ceil(LOW_CAP[t] * (lvl + 1) / def.max));
      mats[t] = Math.max(1, n);
    }
    return { coins: Math.round(coinShare * V), mats: mats };
  }
  function canAfford(s, c) {
    if (!isFinite(c.coins) || s.coins < c.coins) return false;
    for (var t = 0; t < 5; t++) if (s.mats[t] < c.mats[t]) return false;
    return true;
  }
  function pay(s, c) { s.coins -= c.coins; for (var t = 0; t < 5; t++) s.mats[t] -= c.mats[t]; }
  function sellMat(s, t, n) {
    if (!(n > 0) || s.mats[t] < n) return false;
    s.mats[t] -= n; s.coins += n * MAT_PRICE[t]; emit(s, { type: 'sell', tier: t, n: n }); return true;
  }
  // the coins it costs to buy n more units of tier t now
  function matBuyPrice(s, t, n) {
    var total = 0, b = s.matBought[t];
    for (var i = 0; i < n; i++) total += Math.ceil(BUY_SPREAD * MAT_PRICE[t] * (1 + BUY_RAMP * (b + i)));
    return total;
  }
  function buyMat(s, t, n) {
    var c = matBuyPrice(s, t, n);
    if (!(n > 0) || s.coins < c) return false;
    s.coins -= c; s.mats[t] += n; s.matBought[t] += n; emit(s, { type: 'exchange', tier: t, n: n }); return true;
  }

  var UPGRADES = {
    drill:  { name: 'Drill Power', base: 15, mult: 1.6,  max: 30, text: 'Hits harder' },
    speed:  { name: 'Dig Speed',   base: 8,  mult: 1.7,  max: 20, text: 'Digs faster on its own' },
    bag:    { name: 'Bag Size',    base: 12, mult: 1.6,  max: 20, text: 'Carry more before it gets heavy' },
    magnet: { name: 'Magnet',      base: 60, mult: 4,    max: 3,  text: 'Pulls in finds from further away' }
  };
  var WORKERS = {
    diggers: { name: 'Helper Digger', base: 80, mult: 2.5, max: 6, text: 'Digs blocks next to you' },
    staff:   { name: 'Museum Guide',  base: 100, mult: 2.5, max: 5, text: '+30% visitor coins' }
  };
  // the helpers' own tools, sold at their hut: power and speed work like the miner's Drill Power and Dig Speed
  var CREW_UPGRADES = {
    crewDrill: { name: 'Helper Picks', base: 40, mult: 1.75, max: 30, text: 'Helpers hit harder' },
    crewSpeed: { name: 'Helper Pace',  base: 30, mult: 1.7,  max: 20, text: 'Helpers swing faster' }
  };
  var DIGGERS_FIRST = 2; // helpers allowed in the first world; each world unlocked allows one more
  var O2_MAX = 75;
  var ORE_P = 0.11; // chance that a ground block holds ore
  var WALK = 6;      // cells per second the miner walks between blocks
  var MANUAL_HOLD = 1.5; // seconds auto-walk waits after the player steers
  var HELPER_RATE = 1.6; // swings per second of each hired digger, on its own block
  var PICKUP_BASE = 0.75, PICKUP_PER_MAGNET = 1, MAG_SPEED = 7, MAG_STOP = 0.4, FLOOR_Y = 0.75; // loot: pick-up reach in cells, magnet pull speed (cells/s), resting height in its cell
  var AUTO_PACE = 0.5; // left alone the miner walks and swings at this fraction of its steered pace

  // ---------- the surface plaza (hub) ----------
  // One character per cell, x across, z down the rows, from (x0, z0). The pit is at x, z in [0, N).
  //   .  grass        =  path        m  museum floor    P  pit          #  museum wall
  //   t  tree / prop  T  landmark    p  potted plant    s  shop stall   h  helpers hut   w  world signpost
  //   i  low partition between museum wings (gaps are arches)     D  front desk
  //   plinth for creature c (0-2) of world w (0-4): PLINTH_CH[w * 3 + c] = 1-9 A B C E F G, any rectangle size; a-e  relic case for world 1-5
  //   L S H W M  pads: dig (top of the ladder), shop, helpers, worlds, museum desk
  var PLINTH_CH = '123456789ABCEFG';
  // The museum is laid out by kind of skeleton, not by world. Each wing lists its creatures as k = world * 3 + creature
  // (the PLINTH_CH index); sign is where its name hangs, over the arch that leads in.
  var WINGS = [
    { id: 'dino', name: 'Dinosaur Hall', icon: '🦖', ks: [11, 2, 1, 8, 10, 12, 14], sign: [20.5, 6.5] },
    { id: 'ice', name: 'Ice Age Wing', icon: '🦣', ks: [0, 6], sign: [15.5, 0.5] },
    { id: 'sea', name: 'Sea Monsters', icon: '🦈', ks: [4, 5, 3, 7, 13], sign: [15.5, 12.5] },
    { id: 'space', name: 'Space Corner', icon: '🚀', ks: [9], sign: [34.5, 0.5] },
    { id: 'relics', name: 'Relic Gallery', icon: '✨', ks: [], sign: [34.5, 12.5] }
  ];
  var HUB = { x0: -8, z0: -8, rows: [
    't....t..t....t.....tt....t......tt..t.t......t......',
    '..t.........t..t...t...........t.............t......',
    '..TT.....hhh.....t#################################.',
    '..TT.....hhh.t....#mmmmmmmmmmmmmmmimmmmmmmmmmmmmmm#t',
    't........hhh......#mp111mmm77mmmpmimmAAmmmmmmmmpmm#.',
    '.....w....H.......#mm111mmm77mmmmmimmAAmmmmmmmmmmm#t',
    '..t...W...=.......#mm111mmmmmmmmmmimmmmmmmmmmmmpmm#.',
    '.......=========..#mmmmmmmmmmmmmmmimmmmmmmmmmmmmmm#.',
    '..sss..=PPPPPPP=..#iiimmmiiiiiiiiiiiiiiiimmmiiiiii#.',
    't.sssS==PPPPPPP=..#mmmmmmmmmimmmmmmmmmmmmmmmmmmmmm#.',
    '..sss..=PPPPPPP=..#mpmmmmmpmim333mmEEmmmmmBBm999mm#.',
    '.......LPPPPPPP=..#mmmmmMDDmim333mmEEmmmmmBBm999mm#.',
    '.......=PPPPPPP=..#mmmmmmmmmim333mmmmCCCCCmmmmmmmm#.',
    '.t.....=PPPPPPP=..#mmmmmmmmmmmmmmmmmmCCCCCmmmmmpmm#t',
    '....t..=PPPPPPP===mmmmmmmmmmmmmmmmmmmCCCCCmmmmmmmm#.',
    '.......=========..#mmmmmmmmmmmmmmmmmmCCCCCmmmmmmmm#.',
    '..................#mmmmmmmmmim22mmmmmmmmmmmmmpmmmm#.',
    't.t.............t.#mmmmmmmmmim22mmGGGmmmmmmmmmmmmm#t',
    '...........t......#mpmmmmmpmimmmmmGGGmmmmmmmmmmpmm#t',
    '..................#mmmmmmmmmimmmmmmmmmmmmmmmpmmmmm#.',
    '...t..........t...#iiimmmiiiiiiiiiiiiiiiimmmiiiiii#.',
    '...t..........t...#mmmmmmmmmmmmmmmmmmmmimmmmmmmmmm#.',
    '..........t.......#m44m555m666m888mFFmmimpmmmmmmmp#.',
    '......t.........t.#m44m555m666m888mFFmmimmmmmmmmmm#.',
    '..................#mmmmmmmmmmmmmmmmmmmmimambmcmdme#.',
    '.................t#mmmmmmmmmmpmmmmmmmpmimmmmmmmmmm#.',
    '..................#################################.',
    '...................................t...........tt.t.',
    '............t......t...........................t...t',
    '..........................t.....t.t.t..t............',
    '.....................................t..........t...',
    '.......t...........t.........t................tt....',
    '.........................tt....t............t....t..',
    '.........................t........t....t............',
    '..t..................t............t.................',
    '.........................t...........t...........t.t'
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
  // the plinth or relic case nearest the miner among the cells around it: {world, creature} (creature is -1 for a
  // relic case), or null
  function hubNearExhibit(s) {
    var cx = Math.floor(s.hub.x), cz = Math.floor(s.hub.z), best = null, bd = 1e9;
    for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
      var c = hubCell(cx + dx, cz + dz), k = c ? PLINTH_CH.indexOf(c) : -1, hit = null;
      if (k >= 0) hit = { world: Math.floor(k / CREATURES), creature: k % CREATURES };
      else if (c && (k = 'abcde'.indexOf(c)) >= 0) hit = { world: k, creature: -1 };
      var d = Math.pow(cx + dx + 0.5 - s.hub.x, 2) + Math.pow(cz + dz + 0.5 - s.hub.z, 2);
      if (hit && d < bd) { bd = d; best = hit; }
    }
    return best;
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
  // bones carried home are handed in beside their creature's plinth, or all at once at the museum desk
  function deliver(s) {
    if (!s.carry.length) return;
    var desk = hubStation(s) === 'museum', near = desk ? null : hubNearExhibit(s);
    if (!desk && !(near && near.creature >= 0)) return;
    var given = [], keep = [];
    s.carry.forEach(function (it) {
      var ok = desk || (it.world === near.world && Math.floor(it.idx / PIECES) === near.creature);
      if (ok) { s.museum[it.world].pieces[it.idx]++; given.push(itemName(it)); } else keep.push(it);
    });
    s.carry = keep;
    if (given.length) emit(s, { type: 'delivered', names: given, world: desk ? -1 : near.world, creature: desk ? -1 : near.creature });
  }
  function stepHub(s, dt) {
    var h = s.hub, d = HUB_SPEED * dt;
    deliver(s);
    if (s.pile >= 1 && 'mM'.indexOf(hubCell(Math.floor(h.x), Math.floor(h.z))) >= 0) {
      var got = Math.floor(s.pile); s.coins += got; s.pile -= got; emit(s, { type: 'museumCash', coins: got });
    }
    // pushing down the ladder (mostly +x, down-right on screen) from its pad climbs into the pit
    if (h.input && h.input[0] > Math.abs(h.input[1]) && Math.floor(h.x) === -1 && Math.floor(h.z) === LADDER_Z && s.unlocked[s.world]) {
      h.input = null; startDig(s, s.world); return;
    }
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
  // The miner carries one new bone at a time, on its back, until it is handed in at the museum.
  // While it carries one, fossil blocks stay in the ground.
  // (a new bone lying on the floor, not picked up yet, counts as in hand)
  function handsFull(s) {
    return !!((s.carry && s.carry.length) || (s.run && s.run.loot && s.run.loot.some(function (l) { return isNewBone(s, l.item); })));
  }
  // The fossil piece at cell i, or null: { idx, y, x0, z0, w, d (its footprint), dx, dz (this cell's place in it),
  // cells: the footprint's cells still in the ground }. A single-cell fossil is a 1×1 footprint.
  function fossilAt(g, i) {
    if (g.t[i] !== TILE.FOSSIL) return null;
    var k = g.v[i] & 15, p = PARTS[g.v[i] >> 4] || PARTS[0], y = Math.floor(i / NN), x0 = i % N - p.dx, z0 = Math.floor(i / N) % N - p.dz, cells = [];
    for (var dz = 0; dz < p.d; dz++) for (var dx = 0; dx < p.w; dx++) {
      var x = x0 + dx, z = z0 + dz, c = idx(x, y, z);
      if (x >= 0 && x < N && z >= 0 && z < N && g.t[c] === TILE.FOSSIL && g.v[c] === k + 16 * partOf(p.w, p.d, dx, dz)) cells.push(c);
    }
    return { idx: k, y: y, x0: x0, z0: z0, w: p.w, d: p.d, dx: p.dx, dz: p.dz, cells: cells };
  }
  function canDig(s, g, i) { return diggable(g.t[i]) && !(g.t[i] === TILE.FOSSIL && handsFull(s)); }
  function boneHint(s) { var r = s.run; if (!(r.hintT > 0)) { r.hintT = 6; emit(s, { type: 'boneFull' }); } }
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
  // ok(i), when given, says which blocks count as targets; the others still block the way.
  function findNearest(g, x0, y, z0, ok) {
    var seen = new Uint8Array(NN), prev = new Int16Array(NN).fill(-1), q = [z0 * N + x0], DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    seen[z0 * N + x0] = 1;
    for (var h = 0; h < q.length; h++) {
      var c = q[h], cx = c % N, cz = (c - cx) / N;
      for (var k = 0; k < 4; k++) {
        var nx = cx + DV[k][0], nz = cz + DV[k][1];
        if (nx < 0 || nx >= N || nz < 0 || nz >= N) continue;
        var nc = nz * N + nx, tt = g.t[y * NN + nc];
        if (diggable(tt) && (!ok || ok(y * NN + nc))) {
          var steps = [];
          for (var b = c; b !== z0 * N + x0; b = prev[b]) steps.unshift([b % N, (b - b % N) / N]);
          return { target: y * NN + nc, steps: steps };
        }
        if (!seen[nc] && passable(tt)) { seen[nc] = 1; prev[nc] = c; q.push(nc); }
        else if (!seen[nc] && diggable(tt) && ok) seen[nc] = 1;
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
          var q = rng() * 100, acc = 0; // pick an ore index by the world's weights
          for (vv = 0; vv < GEM; vv++) { acc += ORE_WEIGHT[w][vv]; if (q < acc) break; }
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
    // only in plain ground, searching a little deeper when a layer has no room
    function bury(y, tt, vv) {
      for (var tries = 0; tries < 200; tries++) {
        var bx = ri(N), bz = ri(N), yy = Math.min(DEPTH - 1, y + Math.floor(tries / 20)), ti = t[idx(bx, yy, bz)];
        if (ti === TILE.DIRT || ti === TILE.STONE || ti === TILE.ORE) { set(bx, yy, bz, tt, vv); return; }
      }
    }
    // a big fossil: a w × d footprint of plain ground in one layer, turned either way; a single cell if none fits
    function buryBig(y, f, vv) {
      for (var tries = 0; tries < 200; tries++) {
        var turn = f[0] !== f[1] && rng() < 0.5, fw = turn ? f[1] : f[0], fd = turn ? f[0] : f[1];
        var bx = ri(N - fw + 1), bz = ri(N - fd + 1), yy = Math.min(DEPTH - 1, y + Math.floor(tries / 20)), ok = true;
        for (var dz = 0; dz < fd && ok; dz++) for (var dx = 0; dx < fw && ok; dx++) {
          var ti = t[idx(bx + dx, yy, bz + dz)]; ok = ti === TILE.DIRT || ti === TILE.STONE || ti === TILE.ORE;
        }
        if (!ok) continue;
        for (dz = 0; dz < fd; dz++) for (dx = 0; dx < fw; dx++) set(bx + dx, yy, bz + dz, TILE.FOSSIL, vv + 16 * partOf(fw, fd, dx, dz));
        return;
      }
      bury(y, TILE.FOSSIL, vv);
    }
    // fossil pieces: two copies of each; each creature lies in its own band of depth, the first near the top
    for (var c = 0; c < CREATURES; c++) for (var k = 0; k < PIECES * 2; k++) {
      var fy = BAND[c][0] + Math.floor((BAND[c][1] - BAND[c][0]) * k / (PIECES * 2)) + (k ? ri(3) : 0), fk = c * PIECES + (k % PIECES), ff = fossilForm(w, fk);
      if (ff[0] * ff[1] > 1) buryBig(fy, ff, fk); else bury(fy, TILE.FOSSIL, fk);
    }
    // treasure chests in every world, about one every CHEST_EVERY layers
    // (the first one in layer 2, so a new dig finds treasure straight away)
    for (y = 2; y < DEPTH - 1; y += CHEST_EVERY - 1 + ri(3)) bury(y, TILE.CHEST, 0);
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
      upgrades: { drill: 0, speed: 0, bag: 0, magnet: 0, crewDrill: 0, crewSpeed: 0 }, workers: { diggers: 0, staff: 0 }, pile: 0, mats: emptyMats(), matBought: emptyMats(),
      museum: WORLDS.map(function () { return { pieces: emptyPieces() }; }),
      sites: [null, null, null, null, null], world: 0, mode: 'surface', run: null, events: [], hub: hubHome(), auto: true, carry: [],
      stats: { trapsSprung: 0, timePlayed: 0, digs: 0 }
    };
    return s;
  }
  function emptyPieces() { var a = []; for (var i = 0; i < FOSSILS; i++) a.push(0); return a; }
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
  // upgradeCost and hireCost return { coins, mats: [5 counts] } (coins Infinity when there is nothing to buy); nothing is
  // converted for the player: buying needs every coin and every material in hand (buyMat and sellMat do the exchange).
  function upgradeCost(s, k) { var d = UPGRADES[k] || CREW_UPGRADES[k]; return priceOf(d, s.upgrades[k] | 0); }
  function buyUpgrade(s, k) {
    var c = upgradeCost(s, k);
    if (!canAfford(s, c)) return false;
    pay(s, c); s.upgrades[k] = (s.upgrades[k] | 0) + 1; emit(s, { type: 'buy', key: k }); return true;
  }
  // helpers the player may have: two in the first world, one more for each world unlocked after it
  function maxDiggers(s) { return DIGGERS_FIRST + s.unlocked.lastIndexOf(true); }
  function hireCost(s, k) { return k === 'diggers' && s.workers[k] >= maxDiggers(s) ? { coins: Infinity, mats: emptyMats() } : priceOf(WORKERS[k], s.workers[k]); }
  function hire(s, k) {
    var c = hireCost(s, k);
    if (!canAfford(s, c)) return false;
    pay(s, c); s.workers[k]++; emit(s, { type: 'hire', key: k }); return true;
  }
  function drillDamage(s) { return Math.pow(1.5, s.upgrades.drill); }
  function crewDamage(s) { return Math.pow(1.5, s.upgrades.crewDrill | 0); }
  function crewRate(s) { return HELPER_RATE * (1 + 0.35 * (s.upgrades.crewSpeed | 0)); } // each helper's swings per second
  function hitRate(s) { return 2 * (1 + 0.35 * s.upgrades.speed); } // the miner's own swings per second

  // pieces of world w's creature c found so far (0-5), or of all its creatures when c is left out
  function piecesFound(s, w, c) {
    var p = s.museum[w].pieces, a = c == null ? 0 : c * PIECES, b = c == null ? FOSSILS : a + PIECES, n = 0;
    for (var i = a; i < b; i++) if (p[i] > 0) n++;
    return n;
  }
  function exhibitDone(s, w, c) { return piecesFound(s, w, c) === (c == null ? FOSSILS : PIECES); }
  function museumIncome(s) {
    var inc = 0;
    for (var w = 0; w < 5; w++) WORLDS[w].creatures.forEach(function (cr, c) {
      var have = piecesFound(s, w, c);
      inc += have * cr.income * 0.05;
      if (have === PIECES) inc += cr.income;
    });
    return inc * (1 + 0.3 * s.workers.staff);
  }
  function itemValue(it) {
    var wd = WORLDS[it.world];
    if (it.kind === 'ore') return wd.ores[it.idx].mat != null ? MAT_PRICE[wd.ores[it.idx].mat] : Math.round(wd.ores[it.idx].value * wd.oreMult); // a material's coin worth is its sell price
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
              walkAcc: 0, path: null, manual: 0, stepCD: 0, state: 'idle', taps: 0, grid: g, elevT: Math.min(2, 0.5 + g.deepest * 0.015), relicTimer: 0, goo: {}, target: -1, goal: -1, face: 'e', crew: [] };
    s.mode = 'down';
    emit(s, { type: 'descend' });
  }
  function tap(s) { if (s.mode === 'dig' && s.run.stun <= 0) s.run.taps++; }
  // the player takes over: auto-walk waits MANUAL_HOLD seconds after the last steer
  function steer(s, dir) { if (s.mode === 'dig') { s.run.steer = dirKey(dir); s.run.manual = MANUAL_HOLD; s.run.goal = -1; } }
  // the player picked a block of the layer being cleared (a tap on it): walk next to it and dig it
  function digAt(s, x, z) {
    if (s.mode !== 'dig' || x < 0 || x >= N || z < 0 || z >= N) return false;
    var r = s.run, i = idx(x, r.y, z);
    if (!canDig(s, r.grid, i)) { if (diggable(r.grid.t[i])) boneHint(s); return false; }
    var p = findNearest(r.grid, r.x, r.y, r.z, function (j) { return j === i; });
    if (!p) return false;
    r.goal = i; r.path = p; r.steer = 0; r.manual = MANUAL_HOLD; r.walkAcc = 0;
    return true;
  }
  // auto-mining on (the miner finds blocks itself) or off (it only moves and digs when told)
  function setAuto(s, on) { s.auto = !!on; if (s.run) s.run.manual = 0; }
  // ---------- chest locks ----------
  function openLock(s, i) {
    var r = s.run, w = s.world, last = LOCK_KINDS.indexOf(r.lastLock), kind = forceKind, nk = LOCK_KINDS.length;
    if (!kind) kind = last < 0 ? LOCK_KINDS[Math.floor(rand(s) * nk)] : LOCK_KINDS[(last + 1 + Math.floor(rand(s) * (nk - 1))) % nk];
    r.lastLock = kind;
    if (kind === 'pairs') {
      var cards = [];
      for (var c = 0; c < PAIRS[w]; c++) cards.push(c, c);
      for (var j = cards.length - 1; j > 0; j--) { var q = Math.floor(rand(s) * (j + 1)), t = cards[j]; cards[j] = cards[q]; cards[q] = t; }
      r.lock = { i: i, kind: kind, cards: cards, up: [], done: cards.map(function () { return false; }), wait: 0, taps: 0 };
    } else if (kind === 'simon') {
      var seq = [];
      for (var m = 0; m < SIMON_LEN[w]; m++) seq.push(Math.floor(rand(s) * SIMON_PADS));
      r.lock = { i: i, kind: kind, seq: seq, pos: 0, show: simonShow(seq), taps: 0 };
    } else if (kind === 'slide') openSlide(s, i);
    else if (kind === 'pipes') openPipes(s, i);
    else if (kind === 'odd') { r.lock = { i: i, kind: kind, round: 0, rounds: ODD_ROUNDS[w], wait: 0, bad: -1, taps: 0 }; dealOdd(s, r.lock); }
    else if (kind === 'path') openPath(s, i);
    else openPins(s, i);
    r.target = -1; r.state = 'idle'; r.taps = 0; r.steer = 0; r.path = null;
    emit(s, { type: 'lock', i: i, kind: kind });
  }
  // ---- sliding tiles: tiles[i] is the tile number at cell i, 0 the blank; solved is 1, 2, 3... with the blank last
  function slideSolved(tiles) { for (var i = 0; i < tiles.length - 1; i++) if (tiles[i] !== i + 1) return false; return true; }
  function slideNear(n, b) { var o = []; if (b >= n) o.push(b - n); if (b < n * n - n) o.push(b + n); if (b % n) o.push(b - 1); if (b % n < n - 1) o.push(b + 1); return o; }
  function openSlide(s, i) {
    var w = s.world, n = SLIDE_N[w], tiles = [], b = n * n - 1, prev = -1;
    for (var k = 0; k < b; k++) tiles.push(k + 1);
    tiles.push(0);
    // scramble with legal moves from solved (never straight back), so it can always be solved in at most SLIDE_K moves
    for (var m = 0; m < SLIDE_K[w] || slideSolved(tiles); m++) {
      var near = slideNear(n, b).filter(function (j) { return j !== prev; }), j = near[Math.floor(rand(s) * near.length)];
      tiles[b] = tiles[j]; tiles[j] = 0; prev = b; b = j;
    }
    s.run.lock = { i: i, kind: 'slide', n: n, tiles: tiles, taps: 0 };
  }
  // ---- pipes: a tile has a shape t (0 straight, 1 corner, 2 tee, 3 cross) turned r quarter turns clockwise
  var PIPE_BASE = [[1, 0, 1, 0], [1, 1, 0, 0], [1, 1, 0, 1], [1, 1, 1, 1]]; // open sides N E S W at r = 0
  var PIPE_DX = [0, 1, 0, -1], PIPE_DZ = [-1, 0, 1, 0];
  function pipeSides(t, r) { var o = []; for (var d = 0; d < 4; d++) o.push(!!PIPE_BASE[t][(d + 4 - r) % 4]); return o; }
  // cells (row * n + col) the water reaches from the left edge of the inlet row
  function pipeWet(L) {
    var n = L.n, wet = {}, out = [], q = [];
    if (pipeSides(L.tiles[L.inlet * n].t, L.tiles[L.inlet * n].r)[3]) { q.push(L.inlet * n); wet[L.inlet * n] = true; }
    while (q.length) {
      var k = q.shift(), sd = pipeSides(L.tiles[k].t, L.tiles[k].r), row = Math.floor(k / n), col = k % n;
      out.push(k);
      for (var d = 0; d < 4; d++) {
        if (!sd[d]) continue;
        var nr = row + PIPE_DZ[d], nc = col + PIPE_DX[d], j = nr * n + nc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n || wet[j]) continue;
        var t = L.tiles[j];
        if (pipeSides(t.t, t.r)[(d + 2) % 4]) { wet[j] = true; q.push(j); }
      }
    }
    return out;
  }
  function pipeDone(L) {
    var k = L.outlet * L.n + L.n - 1;
    return pipeWet(L).indexOf(k) >= 0 && pipeSides(L.tiles[k].t, L.tiles[k].r)[1];
  }
  function openPipes(s, i) {
    var w = s.world, n = PIPE_N[w], inlet = Math.floor(rand(s) * n), outlet = Math.floor(rand(s) * n), tiles = [];
    for (var k = 0; k < n * n; k++) tiles.push({ t: Math.floor(rand(s) * 4), r: 0 });
    // a random self-avoiding path from the inlet tile to the outlet tile, found by a randomly ordered depth-first walk
    var seen = {}, path = [];
    function go(row, col) {
      seen[row * n + col] = true; path.push([row, col]);
      if (row === outlet && col === n - 1) return true;
      var order = [0, 1, 2, 3];
      for (var a = 3; a > 0; a--) { var b = Math.floor(rand(s) * (a + 1)), x = order[a]; order[a] = order[b]; order[b] = x; }
      for (var o = 0; o < 4; o++) {
        var d = order[o], nr = row + PIPE_DZ[d], nc = col + PIPE_DX[d];
        if (nr < 0 || nr >= n || nc < 0 || nc >= n || seen[nr * n + nc]) continue;
        if (go(nr, nc)) return true;
      }
      path.pop(); return false;
    }
    go(inlet, 0);
    for (var p = 0; p < path.length; p++) { // straight or corner pieces along the path, turned so the water gets through
      var prev = p ? path[p - 1] : [inlet, -1], next = p < path.length - 1 ? path[p + 1] : [outlet, n];
      var din = pipeFace(path[p], prev), dout = pipeFace(path[p], next), tt = (din + 2) % 4 === dout ? 0 : 1;
      tiles[path[p][0] * n + path[p][1]] = { t: tt, r: 0 };
    }
    var L = { i: i, kind: 'pipes', n: n, inlet: inlet, outlet: outlet, tiles: tiles, taps: 0 };
    // turn every tile at random, and again until the water does not already flow
    do { for (var q = 0; q < n * n; q++) tiles[q].r = Math.floor(rand(s) * 4); } while (pipeDone(L));
    s.run.lock = L;
  }
  function pipeFace(a, b) { // side of cell a that faces cell b (b may lie off the board: the inlet to the left, the outlet to the right)
    var dr = b[0] - a[0], dc = b[1] - a[1];
    return dr < 0 ? 0 : dc > 0 ? 1 : dr > 0 ? 2 : 3;
  }
  // ---- odd one out: ODD_CARDS cards of one symbol and a look-alike hiding among them; the next round deals again
  function dealOdd(s, L) {
    var set = ODD_SETS[s.world][Math.floor(rand(s) * ODD_SETS[s.world].length)], flip = rand(s) < 0.5 ? 1 : 0;
    L.odd = Math.floor(rand(s) * ODD_CARDS[s.world]); L.bad = -1;
    L.cards = []; for (var k = 0; k < ODD_CARDS[s.world]; k++) L.cards.push(set[k === L.odd ? 1 - flip : flip]);
  }
  // ---- numbered gems: cells[k] is the number of the gem at cell k, 0 where there is none
  function openPath(s, i) {
    var w = s.world, g = PATH_GRID[w], cells = [], order = [], n = PATH_N[w];
    for (var k = 0; k < g * g; k++) { cells.push(0); order.push(k); }
    for (var j = order.length - 1; j > 0; j--) { var q = Math.floor(rand(s) * (j + 1)), t = order[j]; order[j] = order[q]; order[q] = t; }
    for (var m = 0; m < n; m++) cells[order[m]] = m + 1;
    s.run.lock = { i: i, kind: 'path', n: n, g: g, cells: cells, next: 1, show: PATH_PREVIEW[w], hide: PATH_PREVIEW[w] > 0, taps: 0 };
  }
  function simonShow(seq) { return SIMON_LEAD + seq.length * SIMON_STEP; }
  function openPins(s, i) {
    var r = s.run, w = s.world, n = LOCK_PINS[w], link = LOCK_LINK[w], key = [], pins = [];
    for (var k = 0; k < n; k++) { key.push(Math.floor(rand(s) * LOCK_LEVELS)); pins.push(key[k]); }
    // scramble from the key with backward taps, so the lock can always be picked
    while (pins.join() === key.join()) for (var m = 0; m < n; m++) {
      var back = Math.floor(rand(s) * LOCK_LEVELS);
      for (var b = 0; b < back; b++) bumpPins(pins, m, link, LOCK_LEVELS - 1);
    }
    r.lock = { i: i, kind: 'pins', key: key, pins: pins, link: link, taps: 0 };
  }
  // the timers of an open puzzle: a missed pair turning back over, the simon sequence playing
  function tickLock(L, dt) {
    if (L.wait > 0 && (L.wait -= dt) <= 0) { L.wait = 0; if (L.up) L.up = []; L.bad = -1; }
    if (L.show > 0) L.show = Math.max(0, L.show - dt);
  }
  function bumpPins(pins, k, link, by) {
    pins[k] = (pins[k] + by) % LOCK_LEVELS;
    if (link >= 1 && k + 1 < pins.length) pins[k + 1] = (pins[k + 1] + by) % LOCK_LEVELS;
    if (link === 2 && k > 0) pins[k - 1] = (pins[k - 1] + by) % LOCK_LEVELS;
  }
  function lockTap(s, k) {
    var L = s.mode === 'dig' && s.run.lock;
    if (!L || k < 0) return false;
    var solved = false;
    if (L.kind === 'pairs') {
      if (k >= L.cards.length || L.wait > 0 || L.done[k] || L.up.indexOf(k) >= 0) return false;
      L.up.push(k); L.taps++;
      emit(s, { type: 'pin', k: k });
      if (L.up.length === 2) {
        if (L.cards[L.up[0]] === L.cards[L.up[1]]) { L.done[L.up[0]] = L.done[L.up[1]] = true; L.up = []; emit(s, { type: 'match' }); }
        else { L.wait = PAIR_MISS; emit(s, { type: 'miss' }); }
      }
      solved = L.done.every(function (d) { return d; });
    } else if (L.kind === 'simon') {
      if (k >= SIMON_PADS || L.show > 0) return false;
      L.taps++;
      if (L.seq[L.pos] === k) { L.pos++; emit(s, { type: 'pin', k: k }); }
      else { L.pos = 0; L.show = simonShow(L.seq); emit(s, { type: 'miss' }); }
      solved = L.pos === L.seq.length;
    } else if (L.kind === 'slide') {
      var b = L.tiles.indexOf(0);
      if (k >= L.tiles.length || slideNear(L.n, b).indexOf(k) < 0) return false;
      L.tiles[b] = L.tiles[k]; L.tiles[k] = 0; L.taps++;
      emit(s, { type: 'pin', k: k });
      solved = slideSolved(L.tiles);
    } else if (L.kind === 'pipes') {
      if (k >= L.tiles.length) return false;
      L.tiles[k].r = (L.tiles[k].r + 1) % 4; L.taps++;
      emit(s, { type: 'pin', k: k });
      solved = pipeDone(L);
    } else if (L.kind === 'odd') {
      if (k >= L.cards.length || L.wait > 0) return false;
      L.taps++;
      if (k === L.odd) {
        L.round++; emit(s, { type: 'match' });
        if (L.round < L.rounds) dealOdd(s, L); else solved = true;
      } else { L.wait = ODD_WAIT; L.bad = k; emit(s, { type: 'miss' }); }
    } else if (L.kind === 'path') {
      if (k >= L.cells.length || !L.cells[k] || L.cells[k] < L.next || L.show > 0) return false;
      L.taps++;
      if (L.cells[k] === L.next) { L.next++; emit(s, { type: 'pin', k: k }); }
      else {
        emit(s, { type: 'miss' });
        if (L.hide) { L.next = 1; L.show = PATH_RECALL; } // memory worlds: look again and start over
      }
      solved = L.next > L.n;
    } else {
      if (k >= L.pins.length) return false;
      bumpPins(L.pins, k, L.link, 1); L.taps++;
      emit(s, { type: 'pin', k: k });
      solved = L.pins.join() === L.key.join();
    }
    if (solved) {
      s.run.lock = null; breakTile(s, L.i);
      var it = { kind: 'treasure', world: s.world, value: Math.round(LOCK_GEM * WORLDS[s.world].oreMult), gem: true };
      s.run.loot.push({ x: L.i % N + 0.5, y: FLOOR_Y + Math.floor(L.i / NN), z: Math.floor(L.i / N) % N + 0.5, layer: Math.floor(L.i / NN), rest: true, item: it, age: 0, delay: 0.8, vx: 0, vy: 0, vz: 0 });
      emit(s, { type: 'unlocked', i: L.i, taps: L.taps });
    }
    return true;
  }
  function lockSmash(s) {
    var L = s.mode === 'dig' && s.run.lock;
    if (!L) return false;
    s.run.lock = null; breakTile(s, L.i, null, true);
    emit(s, { type: 'smashed', i: L.i });
    return true;
  }
  function goHome(s, reason) {
    if (s.mode !== 'dig') return;
    var r = s.run;
    r.lock = null;
    r.loot.forEach(function (l) { r.bag.push(l.item); }); r.loot = [];
    s.mode = 'up'; r.elevT = Math.min(3, 1 + r.y * 0.02);
    emit(s, { type: 'ascend', reason: reason || 'button' });
  }
  function bank(s) {
    var r = s.run, coins = 0, pieces = [], relic = null, gained = emptyMats();
    r.bag.forEach(function (it) {
      if (it.kind === 'fossil') { // a new bone is carried to the museum by hand; a copy is sold
        var have = s.museum[it.world].pieces[it.idx] > 0 || s.carry.some(function (c) { return c.world === it.world && c.idx === it.idx; });
        if (have) coins += itemValue(it); else { s.carry.push({ kind: 'fossil', world: it.world, idx: it.idx }); pieces.push(itemName(it)); }
      } else if (it.kind === 'relic') {
        if (!s.relics[it.world]) { s.relics[it.world] = true; relic = it.world; if (it.world < 4) s.unlocked[it.world + 1] = true; }
      } else if (it.kind === 'ore' && WORLDS[it.world].ores[it.idx].mat != null) { gained[WORLDS[it.world].ores[it.idx].mat]++; s.mats[WORLDS[it.world].ores[it.idx].mat]++; }
      else coins += itemValue(it);
    });
    s.coins += coins; r.bag = []; s.hub = hubHome(); s.matBought = emptyMats();
    emit(s, { type: 'banked', coins: coins, mats: gained, pieces: pieces, relic: relic });
  }

  function isNewBone(s, it) {
    return it.kind === 'fossil' && !s.museum[it.world].pieces[it.idx] && !s.carry.some(function (c) { return c.world === it.world && c.idx === it.idx; });
  }
  function collect(s, it, at) { // at: where the find lay (loot picked up off the floor); none for the relic
    var r = s.run;
    if (isNewBone(s, it) && !s.carry.length) { s.carry.push(it); it.carried = true; }
    else r.bag.push(it);
    emit(s, { type: 'collect', item: it, name: itemName(it), at: at || null });
    if (it.kind === 'relic') { r.relicTimer = 1.5; emit(s, { type: 'relic', world: it.world }); }
  }
  // a chest holds a fossil piece still missing from the creature buried at this depth, or coins
  function chestLoot(s, w, y, smashed) {
    if (smashed) return { kind: 'treasure', world: w, value: Math.round(SMASH_COINS * WORLDS[w].oreMult) };
    var c = 0; while (c < CREATURES - 1 && y >= BAND[c + 1][0]) c++;
    var have = s.museum[w].pieces, inBag = {}, miss = [];
    s.run.bag.concat(s.run.loot.map(function (l) { return l.item; })).forEach(function (b) { if (b.kind === 'fossil' && b.world === w) inBag[b.idx] = 1; });
    for (var p = c * PIECES; p < (c + 1) * PIECES; p++) if (!have[p] && !inBag[p]) miss.push(p);
    if (miss.length && !handsFull(s) && rand(s) < CHEST_FOSSIL) return { kind: 'fossil', world: w, idx: miss[Math.floor(rand(s) * miss.length)], chest: true };
    return { kind: 'treasure', world: w, value: Math.round(25 * WORLDS[w].oreMult) };
  }
  function breakTile(s, i, helper, smashed) {
    var r = s.run, g = r.grid, w = s.world, tt = g.t[i], vv = g.v[i], it = null;
    var bx = i % N, bz = Math.floor(i / N) % N, by = Math.floor(i / NN);
    if (tt === TILE.ORE) it = { kind: 'ore', world: w, idx: vv };
    else if (tt === TILE.FOSSIL) { // a big fossil gives its bone when its last cell breaks
      var fo = fossilAt(g, i);
      if (fo.cells.length > 1) emit(s, { type: 'bigBone', x: bx, y: by, z: bz, left: fo.cells.length - 1 });
      else it = { kind: 'fossil', world: w, idx: fo.idx };
    }
    else if (tt === TILE.CHEST) it = chestLoot(s, w, by, smashed);
    else if (tt === TILE.TRAP && helper) { helper.stun = 2; emit(s, { type: 'trap', helper: true }); }
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
    if (it.kind === 'relic') { collect(s, it); return; } // the relic is handed over at once
    // everything else drops on the floor of its cell and waits to be picked up; on the moon it bounces first
    var moon = WORLDS[w].rule === 'lowgrav';
    r.loot.push({ x: bx + 0.5, y: moon ? by + 0.5 : FLOOR_Y + by, z: bz + 0.5, layer: by, rest: !moon, item: it, age: 0, delay: tt === TILE.CHEST ? 0.6 : 0.3,
                  vx: moon ? (rand(s) - 0.5) * 3 : 0, vy: moon ? -3 - rand(s) * 2 : 0, vz: moon ? (rand(s) - 0.5) * 3 : 0 });
  }
  // ---------- loot on the floor ----------
  // Reach: the miner picks up loot lying in its layer within PICKUP_BASE cells (about its own cell); each magnet
  // level adds PICKUP_PER_MAGNET cells, and loot inside the reach is pulled toward the miner.
  function pickupReach(magnet) { return PICKUP_BASE + PICKUP_PER_MAGNET * (magnet || 0); }
  function lootWaits(s, l) { return isNewBone(s, l.item) && s.carry.length > 0; } // a new bone needs free hands
  function lootReady(s, l) { return l.age > l.delay && l.layer === s.run.y && !lootWaits(s, l); }
  function stepLoot(s, dt) { // moon loot bounces over the open cells of its layer until it settles
    var g = s.run.grid;
    for (var k = 0; k < s.run.loot.length; k++) {
      var l = s.run.loot[k];
      l.age += dt;
      if (l.rest || l.pulled) continue;
      l.vy += 4 * dt;
      var nx = l.x + l.vx * dt, ny = l.y + l.vy * dt, nz = l.z + l.vz * dt, by = l.layer;
      if (nx < 0 || nx >= N || !passable(g.t[idx(Math.floor(nx), by, Math.floor(l.z))])) { l.vx = -l.vx * 0.6; nx = l.x; }
      if (nz < 0 || nz >= N || !passable(g.t[idx(Math.floor(l.x), by, Math.floor(nz))])) { l.vz = -l.vz * 0.6; nz = l.z; }
      if (ny > by + FLOOR_Y) {
        if (l.vy * 0.6 < 0.8) { l.rest = true; l.vx = l.vy = l.vz = 0; ny = by + FLOOR_Y; }
        else { l.vy = -l.vy * 0.6; l.vx *= 0.75; l.vz *= 0.75; ny = by + FLOOR_Y; }
      } else if (ny < 0) { l.vy = -l.vy * 0.6; ny = l.y; }
      l.x = nx; l.y = ny; l.z = nz;
    }
  }
  function pickLoot(s, dt) { // collect loot in reach; with a magnet, loot in reach slides toward the miner first
    var r = s.run, reach = pickupReach(s.upgrades.magnet), px = r.x + 0.5, pz = r.z + 0.5, mag = s.upgrades.magnet > 0;
    for (var k = r.loot.length - 1; k >= 0; k--) {
      var l = r.loot[k];
      if (!lootReady(s, l)) continue;
      var ex = px - l.x, ez = pz - l.z, d = Math.sqrt(ex * ex + ez * ez);
      if (d > reach) { l.pulled = false; continue; }
      if (mag && d > MAG_STOP) {
        var m = Math.min(d, MAG_SPEED * dt); l.pulled = true; l.x += ex / d * m; l.z += ez / d * m;
        if (m < d) continue;
      }
      r.loot.splice(k, 1); collect(s, l.item, { x: l.x, y: l.y, z: l.z });
    }
  }
  // the nearest loot in the miner's layer that it can walk to over open cells: the steps to its cell
  // auto-mining's next block: the nearest one no helper is on, else the nearest of all
  function autoPath(s, g, y, crewT) {
    var r = s.run;
    return findNearest(g, r.x, y, r.z, function (i) { return !crewT[i] && canDig(s, g, i); }) || findNearest(g, r.x, y, r.z, function (i) { return canDig(s, g, i); });
  }
  function lootPath(s) {
    var r = s.run, g = r.grid, y = r.y, want = {}, any = false;
    r.loot.forEach(function (l) { if (l.layer === y && !lootWaits(s, l)) { want[Math.floor(l.z) * N + Math.floor(l.x)] = 1; any = true; } });
    if (!any) return null;
    var seen = new Uint8Array(NN), prev = new Int16Array(NN).fill(-1), q = [r.z * N + r.x], DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    seen[q[0]] = 1;
    for (var h = 0; h < q.length; h++) {
      var c = q[h], cx = c % N, cz = (c - cx) / N;
      if (want[c]) { var steps = []; for (var b = c; b !== q[0]; b = prev[b]) steps.unshift([b % N, (b - b % N) / N]); return steps; }
      for (var k = 0; k < 4; k++) {
        var nx = cx + DV[k][0], nz = cz + DV[k][1];
        if (nx < 0 || nx >= N || nz < 0 || nz >= N) continue;
        var nc = nz * N + nx;
        if (!seen[nc] && passable(g.t[y * NN + nc])) { seen[nc] = 1; prev[nc] = c; q.push(nc); }
      }
    }
    return null;
  }

  function faceTo(x0, z0, x1, z1) { return x1 > x0 ? 'e' : x1 < x0 ? 'w' : z1 > z0 ? 's' : 'n'; }
  // ---------- hired helper diggers ----------
  // Each helper digs its own block of the miner's layer, at crewRate swings a second with its own pick (crewDamage), and what it digs
  // goes into the miner's bag. It keeps its block till it breaks, then takes the free block nearest to it,
  // preferring blocks at least two cells from the miner and not the one the miner is digging or heading for.
  // It stands on an open cell beside its block, or on top of the block when none is open.
  function crewTargets(r) { var o = {}; (r.crew || []).forEach(function (c) { if (c && c.target >= 0) o[c.target] = 1; }); return o; }
  function crewSpot(g, y, i, mx, mz, taken) {
    var x = i % N, z = Math.floor(i / N) % N, best = null;
    ['e', 's', 'w', 'n'].forEach(function (k) {
      var d = DIRS[k], ax = x - d[0], az = z - d[1];
      if (best || ax < 0 || ax >= N || az < 0 || az >= N || (ax === mx && az === mz) || taken[ax + ',' + az]) return;
      if (passable(g.t[idx(ax, y, az)])) best = { x: ax, z: az, y: y, face: k };
    });
    return best || { x: x, z: z, y: y - 1, face: 'e' };
  }
  function stepCrew(s, dt, hit) {
    var r = s.run, g = r.grid, y = r.y, n = Math.min(s.workers.diggers, DIGGERS_FIRST + s.world); // world w lets 2 + w of them dig
    if (!r.crew) r.crew = [];
    r.crew.length = Math.min(r.crew.length, n);
    if (!n || y < 1 || y > DEPTH) return;
    var mine = {}; if (r.target >= 0) mine[r.target] = 1; if (r.path && r.path.target >= 0) mine[r.path.target] = 1; if (r.goal >= 0) mine[r.goal] = 1;
    for (var k = 0; k < n; k++) {
      var c = r.crew[k] || (r.crew[k] = { target: -1, x: r.x, z: r.z, y: y, face: 'e', stun: 0 });
      if (c.stun > 0) { c.stun = Math.max(0, c.stun - dt); continue; }
      if (c.target >= 0 && (!canDig(s, g, c.target) || Math.floor(c.target / NN) !== y || mine[c.target])) c.target = -1;
      if (c.target < 0) {
        var others = crewTargets(r), stand = {}, best = -1, bd = Infinity;
        r.crew.forEach(function (o) { if (o !== c && o.target >= 0) stand[o.x + ',' + o.z] = 1; });
        for (var i = y * NN; i < (y + 1) * NN; i++) {
          if (!canDig(s, g, i) || g.t[i] === TILE.CHEST || others[i] || mine[i]) continue; // chests are the miner's to open
          var bx = i % N, bz = Math.floor(i / N) % N, near = Math.max(Math.abs(bx - r.x), Math.abs(bz - r.z)) < 2;
          var d = Math.abs(bx - c.x) + Math.abs(bz - c.z) + (near ? 20 : 0) + (stand[bx + ',' + bz] ? 40 : 0);
          if (d < bd) { bd = d; best = i; }
        }
        if (best < 0) continue; // nothing free: this one waits
        var sp = crewSpot(g, y, best, r.x, r.z, stand);
        c.target = best; c.x = sp.x; c.z = sp.z; c.y = sp.y; c.face = sp.face;
      }
      var tt = g.t[c.target], dmg = crewDamage(s) * crewRate(s) * dt * (tt === TILE.GOO ? 0.45 : 1);
      g.hp[c.target] -= dmg; hit[c.target] = 1;
      if (tt === TILE.GOO) r.goo[c.target] = 1;
      if (g.hp[c.target] <= 0) { var done = c.target; c.target = -1; breakTile(s, done, c); if (r.path && r.path.target === done) r.path = null; }
    }
  }
  function stepDig(s, dt) {
    var r = s.run, g = r.grid, w = s.world, rule = WORLDS[w].rule;
    var hit = {}, layers = DEPTH + 2;
    if (r.lock) { tickLock(r.lock, dt); r.target = -1; r.state = 'idle'; r.taps = 0; return; } // the dig waits while a chest lock is open
    if (rule === 'oxygen' && r.y > 0) {
      r.oxygen -= dt;
      if (r.oxygen <= 0) { r.oxygen = 0; goHome(s, 'oxygen'); return; }
      for (var oy = r.y - 1; oy <= r.y + 1; oy++) for (var oz = r.z - 1; oz <= r.z + 1; oz++) for (var ox = r.x - 1; ox <= r.x + 1; ox++) {
        if (ox < 0 || ox >= N || oz < 0 || oz >= N || oy < 0) continue;
        var oi = idx(ox, oy, oz);
        if (g.t[oi] === TILE.BUBBLE) { g.t[oi] = TILE.AIR; r.oxygen = O2_MAX; emit(s, { type: 'bubble', x: ox, y: oy, z: oz }); }
      }
    }
    stepLoot(s, dt);
    if (r.relicTimer > 0) { r.relicTimer -= dt; if (r.relicTimer <= 0) { goHome(s, 'relic'); return; } }
    if (r.stun > 0) { r.stun = Math.max(0, r.stun - dt); r.taps = 0; }
    else {
      var y = r.y, tgt = -1, steered = false, moved = false, auto = s.auto !== false;
      var crewT = crewTargets(r);
      // steering: walk onto an open cell, or pick that block as the next one to dig
      r.manual = Math.max(0, (r.manual || 0) - dt); r.hintT = Math.max(0, (r.hintT || 0) - dt); r.stepCD = Math.max(0, (r.stepCD || 0) - dt);
      if (r.steer) {
        var sd = DIRS[r.steer], sx = r.x + sd[0], sz = r.z + sd[1];
        var inPit = sx >= 0 && sx < N && sz >= 0 && sz < N, st = inPit ? g.t[idx(sx, y, sz)] : TILE.BEDROCK;
        r.face = r.steer;
        if (r.steer === 'w' && sx < 0 && r.z === LADDER_Z) { r.steer = 0; goHome(s, 'ladder'); return; } // onto the ladder: climb home
        if (passable(st)) { // one cell at a time, at walking pace
          if (r.stepCD <= 0) { r.x = sx; r.z = sz; r.steer = 0; r.path = null; r.stepCD = 1 / WALK; }
          moved = true;
        }
        else if (inPit && canDig(s, g, idx(sx, y, sz))) { tgt = idx(sx, y, sz); steered = true; } // off the edge, idx() would wrap onto another cell
        else { if (diggable(st)) boneHint(s); r.steer = 0; }
      }
      // a block the player tapped: walk next to it at full pace, then dig it
      if (tgt < 0 && !moved && r.goal >= 0) {
        if (!canDig(s, g, r.goal) || Math.floor(r.goal / NN) !== y || !r.path || r.path.target !== r.goal) r.goal = -1;
        else if (r.path.steps.length) {
          r.manual = MANUAL_HOLD; moved = true; r.walkAcc += dt * WALK;
          while (r.walkAcc >= 1 && r.path.steps.length) { var gc = r.path.steps.shift(); r.face = faceTo(r.x, r.z, gc[0], gc[1]); r.x = gc[0]; r.z = gc[1]; r.walkAcc -= 1; }
        } else { tgt = r.goal; steered = true; r.manual = MANUAL_HOLD; r.face = faceTo(r.x, r.z, tgt % N, Math.floor(tgt / N) % N); }
      }
      // a tap while standing still hits the block in front; with nothing there auto-mining carries on
      if (tgt < 0 && !moved && r.taps > 0 && (!auto || r.manual > 0)) {
        var fd = DIRS[r.face] || DIRS.e, fx = r.x + fd[0], fz = r.z + fd[1];
        if (fx >= 0 && fx < N && fz >= 0 && fz < N && canDig(s, g, idx(fx, y, fz))) { tgt = idx(fx, y, fz); steered = true; r.manual = Math.max(r.manual, MANUAL_HOLD); }
        else r.manual = 0;
      }
      // loot on the floor: auto-mining goes for whichever is nearer, the loot or the next block (a tie goes to the
      // loot), and a cleared layer is swept
      var hasBlocks = layerHasBlocks(g, y);
      if (tgt < 0 && !moved && r.stun <= 0 && (!hasBlocks || (auto && r.manual <= 0))) {
        var lsteps = lootPath(s);
        if (lsteps && hasBlocks) {
          if (!r.path || !canDig(s, g, r.path.target)) r.path = autoPath(s, g, y, crewT);
          if (r.path && r.path.steps.length < lsteps.length) lsteps = null; // the block is nearer: dig it first
        }
        if (lsteps) {
          r.path = null; r.state = lsteps.length ? 'walk' : 'idle'; r.taps = 0; r.fallAcc = 0; moved = true; // no steps: the find is under the miner's feet, still settling
          r.walkAcc += dt * WALK * (auto ? AUTO_PACE : 1);
          while (r.walkAcc >= 1 && lsteps.length) { var lc = lsteps.shift(); r.face = faceTo(r.x, r.z, lc[0], lc[1]); r.x = lc[0]; r.z = lc[1]; r.walkAcc -= 1; }
        }
      }
      if (tgt < 0 && !moved && !layerHasBlocks(g, y)) {
        // layer cleared: drop into the open cell below, or dig the block underfoot to open the next layer
        r.path = null;
        var bi = idx(r.x, y + 1, r.z);
        if (y + 1 < layers && passable(g.t[bi])) {
          r.state = 'fall'; r.fallAcc += dt * (rule === 'lowgrav' ? 4 : 9); r.taps = 0;
          // stop in the first layer that still has blocks: it must be cleared before the next one opens
          while (r.fallAcc >= 1 && r.y + 1 < layers && passable(g.t[idx(r.x, r.y + 1, r.z)]) && !layerHasBlocks(g, r.y)) { r.fallAcc -= 1; r.y++; }
          if (layerHasBlocks(g, r.y)) r.fallAcc = 0;
        } else if (y + 1 < layers && diggable(g.t[bi])) { tgt = bi; steered = !auto || r.manual > 0; }
        else { r.state = 'idle'; r.taps = 0; }
      } else if (tgt < 0 && !moved && (!auto || r.manual > 0)) { r.state = 'idle'; r.taps = 0; r.path = null; } // the player has control
      else if (tgt < 0 && !moved) {
        // auto-walk: follow the shortest path over open cells to the nearest block no helper is on, then dig it
        r.fallAcc = 0;
        if (!r.path || !canDig(s, g, r.path.target)) {
          r.path = autoPath(s, g, y, crewT);
          if (!r.path) boneHint(s); // only fossils left in this layer: the bone in hand must go to the museum first
        }
        if (r.path && r.path.steps.length) {
          r.state = 'walk'; r.taps = 0; r.walkAcc += dt * WALK * AUTO_PACE;
          while (r.walkAcc >= 1 && r.path.steps.length) { var c = r.path.steps.shift(); r.face = faceTo(r.x, r.z, c[0], c[1]); r.x = c[0]; r.z = c[1]; r.walkAcc -= 1; }
        } else if (r.path) { tgt = r.path.target; r.face = faceTo(r.x, r.z, tgt % N, Math.floor(tgt / N) % N); }
        else { r.state = 'idle'; r.taps = 0; }
      }
      if (moved) { r.state = 'walk'; r.taps = 0; }
      if (tgt >= 0 && g.t[tgt] === TILE.CHEST) { r.face = faceTo(r.x, r.z, tgt % N, Math.floor(tgt / N) % N); openLock(s, tgt); return; }
      if (tgt >= 0) {
        r.walkAcc = 0; r.fallAcc = 0; r.state = 'dig';
        var wf = weightFactor(s, r.bag.length);
        // the miner's own swing is slower on auto-pilot
        var idle = drillDamage(s) * hitRate(s) * (steered || r.manual > 0 ? 1 : AUTO_PACE) * dt * wf;
        var dmg = idle + drillDamage(s) * r.taps * wf;
        if (g.t[tgt] === TILE.GOO) dmg -= idle * 0.55; // goo grows back while you drill it
        r.taps = 0;
        g.hp[tgt] -= dmg; hit[tgt] = 1; r.target = tgt;
        if (g.t[tgt] === TILE.GOO) r.goo[tgt] = 1;
        if (g.hp[tgt] <= 0) {
          breakTile(s, tgt);
          if (steered) r.steer = 0;
          if (r.goal === tgt) r.goal = -1;
          r.path = null;
        }
      } else r.target = -1;
      if (r.stun <= 0 && s.mode === 'dig') stepCrew(s, dt, hit);
    }
    if (s.mode === 'dig') pickLoot(s, dt);
    for (var k in r.goo) {
      var gi = +k;
      if (hit[gi]) continue;
      var mx = maxHp(w, TILE.GOO, Math.floor(gi / NN));
      g.hp[gi] = Math.min(mx, g.hp[gi] + mx * 0.4 * dt);
      if (g.hp[gi] >= mx) delete r.goo[k];
    }
    if (r.y > g.deepest || (r.y === g.deepest && (g.deepestX !== r.x || g.deepestZ !== r.z))) { g.deepest = r.y; g.deepestX = r.x; g.deepestZ = r.z; }
  }

  function step(s, dt) {
    s.stats.timePlayed += dt;
    s.pile = (s.pile || 0) + museumIncome(s) * dt; // visitor coins pile up at the museum till the miner walks in
    if (s.mode === 'dig') stepDig(s, dt);
    else if (s.mode === 'surface') stepHub(s, dt);
    else if (s.mode === 'down') { s.run.elevT -= dt; if (s.run.elevT <= 0) { s.mode = 'dig'; emit(s, { type: 'arrive' }); } }
    else if (s.mode === 'up') { s.run.elevT -= dt; if (s.run.elevT <= 0) { s.mode = 'surface'; bank(s); } }
  }

  function serialize(s) {
    var bag = s.run && s.mode !== 'surface' ? s.run.bag.concat(s.run.loot.map(function (l) { return l.item; })) : [];
    return JSON.stringify({
      v: 4, auto: s.auto !== false, carry: s.carry, pile: s.pile || 0, seed: s.seed, rng: s.rng, coins: s.coins, mats: s.mats, unlocked: s.unlocked, relics: s.relics, upgrades: s.upgrades,
      workers: s.workers, museum: s.museum, world: s.world, stats: s.stats, bag: bag,
      sites: s.sites.map(function (g) { return g && { t: Array.from(g.t), v: Array.from(g.v), deepest: g.deepest, deepestX: g.deepestX, deepestZ: g.deepestZ, gen: g.gen || 0 }; })
    });
  }
  function deserialize(str) {
    try {
      var o = JSON.parse(str);
      if (!o || [1, 2, 3, 4].indexOf(o.v) < 0) return null;
      var s = newState(o.seed);
      ['rng', 'coins', 'unlocked', 'relics', 'upgrades', 'workers', 'museum', 'world', 'stats', 'auto', 'carry', 'pile', 'mats'].forEach(function (k) { if (o[k] != null) s[k] = o[k]; });
      if (!Array.isArray(s.mats) || s.mats.length !== 5) s.mats = emptyMats();
      s.upgrades = Object.assign(newState(0).upgrades, s.upgrades); s.workers = Object.assign(newState(0).workers, s.workers);
      // before v3 each world had one creature of five pieces: it is now that world's middle creature
      var old = o.v < 3;
      s.museum = s.museum.map(function (m) {
        var p = emptyPieces(), src = m && m.pieces || [];
        for (var i = 0; i < src.length && i < FOSSILS; i++) p[old ? PIECES + i : i] = src[i] | 0;
        return { pieces: p };
      });
      s.sites = o.sites.map(function (g, w) {
        // v1 saves hold the old flat 11-wide slice: drop the site so a fresh 3D one is dug
        if (!g || !g.t || g.t.length !== NN * (DEPTH + 2)) return null;
        var mid = Math.floor(N / 2);
        var gg = { t: Uint8Array.from(g.t), v: Uint8Array.from(g.v), hp: new Float32Array(g.t.length), deepest: g.deepest,
                   deepestX: g.deepestX == null ? mid : g.deepestX, deepestZ: g.deepestZ == null ? mid : g.deepestZ, gen: g.gen };
        if (old) for (var i = 0; i < gg.t.length; i++) if (gg.t[i] === TILE.FOSSIL) gg.v[i] += PIECES;
        if (o.v < 4) for (var j = 0; j < gg.t.length; j++) if (gg.t[j] === TILE.ORE && gg.v[j] === 3) gg.v[j] = GEM; // the old gem ore (index 3) is now index 5
        fillHp(w, gg); return gg;
      });
      if (o.bag && o.bag.length) {
        if (old) o.bag.forEach(function (it) { if (it.kind === 'fossil') it.idx += PIECES; });
        if (o.v < 4) o.bag = o.bag.map(function (it) { // old ores were all coins, worth their old value
          return it.kind === 'ore' ? { kind: 'treasure', world: it.world, value: Math.round(OLD_ORE_VALUE[it.idx] * WORLDS[it.world].oreMult) } : it;
        });
        s.run = { bag: o.bag, loot: [] }; bank(s); s.run = null;
      }
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
  function _setFossil(s, x0, y, z0, k, w, d) { // a big fossil of piece k with a w × d footprint from (x0, y, z0)
    for (var dz = 0; dz < d; dz++) for (var dx = 0; dx < w; dx++) _setTile(s, x0 + dx, y, z0 + dz, TILE.FOSSIL, k + 16 * partOf(w, d, dx, dz));
  }
  function _setTile(s, x, y, z, tt, vv) {
    var g = s.run.grid, i = idx(x, y, z); g.t[i] = tt; g.v[i] = vv || 0; g.hp[i] = maxHp(s.world, tt, y);
  }

  return {
    MATS: MATS, MAT_PRICE: MAT_PRICE, GEM: GEM, canAfford: canAfford, sellMat: sellMat, buyMat: buyMat, matBuyPrice: matBuyPrice, bank: bank,
    N: N, W: N, DEPTH: DEPTH, idx: idx, DIRS: DIRS, TILE: TILE, WORLDS: WORLDS, UPGRADES: UPGRADES, WORKERS: WORKERS, CREW_UPGRADES: CREW_UPGRADES, maxDiggers: maxDiggers, crewDamage: crewDamage, crewRate: crewRate, O2_MAX: O2_MAX, WALK: WALK, MANUAL_HOLD: MANUAL_HOLD, AUTO_PACE: AUTO_PACE,
    genWorld: genWorld, newState: newState, startDig: startDig, step: step, tap: tap, steer: steer, digAt: digAt, lockTap: lockTap, lockSmash: lockSmash, LOCK_LEVELS: LOCK_LEVELS, SIMON_PADS: SIMON_PADS, SIMON_STEP: SIMON_STEP, SIMON_LEAD: SIMON_LEAD, _lockKind: function (k) { forceKind = k; }, setAuto: setAuto, goHome: goHome, HELPER_RATE: HELPER_RATE,
    SLIDE_N: SLIDE_N, SLIDE_K: SLIDE_K, PIPE_N: PIPE_N, ODD_ROUNDS: ODD_ROUNDS, ODD_CARDS: ODD_CARDS, ODD_WAIT: ODD_WAIT, PATH_N: PATH_N, PATH_GRID: PATH_GRID, PATH_PREVIEW: PATH_PREVIEW, PATH_RECALL: PATH_RECALL, pipeSides: pipeSides, pipeWet: pipeWet, pipeDone: pipeDone,
    pickupReach: pickupReach, bagCap: bagCap, weightFactor: weightFactor, upgradeCost: upgradeCost, buyUpgrade: buyUpgrade, hireCost: hireCost,
    hire: hire, museumIncome: museumIncome, exhibitDone: exhibitDone, piecesFound: piecesFound, CREATURES: CREATURES, PIECES: PIECES, FOSSILS: FOSSILS, itemValue: itemValue, itemName: itemName,
    serialize: serialize, deserialize: deserialize, resetSite: resetSite, maxHp: maxHp, passable: passable,
    drillDamage: drillDamage, hitRate: hitRate, site: site, _teleport: _teleport, _setTile: _setTile, _setFossil: _setFossil, fossilAt: fossilAt, fossilForm: fossilForm, _clearLayer: _clearLayer,
    HUB: HUB, HUB_STATIONS: HUB_STATIONS, HUB_SPEED: HUB_SPEED, LADDER_Z: LADDER_Z, hubCell: hubCell, hubWalkable: hubWalkable,
    PLINTH_CH: PLINTH_CH, WINGS: WINGS, hubStation: hubStation, hubNearExhibit: hubNearExhibit, hubInput: hubInput, hubWalkTo: hubWalkTo, hubPath: hubPath,
    topLayer: topLayer, layerHasBlocks: layerHasBlocks, diggable: diggable };
})();
