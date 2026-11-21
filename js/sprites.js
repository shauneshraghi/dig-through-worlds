// Dig Through Worlds: pixel-art characters and museum exhibits, drawn in code. Exposes DTWSprites.
// Characters are built from parts (head, torso, legs) written as character grids, recoloured by a
// palette, posed (stride, lean, bob, arms) and given a dark outline. Exhibits are bone shapes split
// into the five fossil pieces of each world: pieces found are drawn in bone, missing ones as a ghost.
var DTWSprites = (function () {
  'use strict';
  var OUT = '#1e1426';
  // ---------- character parts: one letter per pixel, ' ' is clear. Heads face screen-right. ----------
  var HEAD_MINER = [
    '        oooooooo',
    '      ooYYYYYyyyoo',
    '     oYYYYYyyyyyyyo',
    '    oYYYyyyyyyyyyyuo',
    '    oYyyyyyyyyyyyuuolo',
    '   oyyyyyyyyyyyyyuuollLo',
    '   ouyyyyyyyyyyyuuuolLLo',
    '   ouuuuuuuuuuuuuuuuolo',
    '  ouuuuuuuuuuuuuuuuuuuuo',
    '   ohhhhhhSSSSSSSSSSSo',
    '   ohhhhhsSSSSSSSSSSSSo',
    '   ohhhskSSSewSSSSewSSo',
    '   ohhkksSSSeeSSSSeeSSo',
    '   ohhhsSSSSeeSSSSeeSSo',
    '   ohhhhsSScSSSSSSSScSo',
    '    ohhhssSSSSSmmSSSSo',
    '    ohhsssSSSSSSSSSSo',
    '     oosssssssssssoo',
    '       ooooooooooo'
  ];
  var HEAD_MINER_BACK = [
    '        oooooooo',
    '      ooYYYYYyyyoo',
    '     oYYYYYyyyyyyyo',
    '    oYYYyyyyyyyyyyuo',
    '    oYyyyyyyyyyyyyuuo',
    '   oyyyyyyyyyyyyyyuuo',
    '   oxxxxxxxxxxxxxxxxo',
    '   ouuuuuuuuuuuuuuuuo',
    '  ouuuuuuuuuuuuuuuuuuuo',
    '   ohHHHHHHHHHHHHHHhho',
    '   ohHHHHHHHHHHHHHHhho',
    '  okhHHHHHHHHHHHHHHhhko',
    '  okhhHHHHHHHHHHHHhhhko',
    '   ohhhHHHHHHHHHHhhhho',
    '   ohhhhhHHHHHHhhhhho',
    '    ohhhhhhhhhhhhhho',
    '    osshhhhhhhhhhsso',
    '     oosssssssssoo',
    '       ooooooooooo'
  ];
  var HEAD_HAIR = [
    '        oooooooo',
    '      ooHHHHHHHHoo',
    '     oHHHHHHHHHHHho',
    '    oHHHHHHHHHHHHhho',
    '    oHHHHHHHHHHHhhho',
    '   ohHHHHHHHHHHHHhhho',
    '   ohhHHHHHHHHHHHhhho',
    '   ohhhHHHHhHHHHhhhho',
    '   ohhhhhhhSShhhhhhho',
    '   ohhhhhhSSSSSSSSSSo',
    '   ohhhhhsSSSSSSSSSSSo',
    '   ohhhskSSSewSSSSewSo',
    '   ohhkksSSSeeSSSSeeSo',
    '   ohhhsSSSSeeSSSSeeSo',
    '   ohhhhsSScSSSSSSScSo',
    '    ohhhssSSSSSmmSSSo',
    '    ohhsssSSSSSSSSSo',
    '     oosssssssssoo',
    '       ooooooooo'
  ];
  var HEAD_HAIR_BACK = [
    '        oooooooo',
    '      ooHHHHHHHHoo',
    '     oHHHHHHHHHHHho',
    '    oHHHHHHHHHHHHhho',
    '    oHHHHHHHHHHHHhho',
    '   ohHHHHHHHHHHHHhhho',
    '   ohHHHHHHHHHHHHhhho',
    '   ohHHHHHHHHHHHHhhho',
    '   ohhHHHHHHHHHHhhhho',
    '   ohhHHHHHHHHHHhhhho',
    '  okhhHHHHHHHHHHhhhko',
    '  okhhhHHHHHHHHhhhhko',
    '   ohhhhHHHHHHhhhhho',
    '   ohhhhhhhhhhhhhhho',
    '    ohhhhhhhhhhhhho',
    '    osshhhhhhhhhsso',
    '     oosssssssssoo',
    '       ooooooooo'
  ];
  var TORSO = [
    '       ooRRRRRRRRoo',
    '      oRRbRRRRRRbRRo',
    '     oRRRbRRRRRRbRRRo',
    '     oRRRbbbbbbbbRRro',
    '     orRRbBBBBBBnRRro',
    '     orRRbBGBBGBnRrqo',
    '     oqrrbBBBBBBnrrqo',
    '      oqrbBBBBBBnrqo',
    '      oxxxxxxxxxxxxo',
    '      obbBBBBBBBbnno',
    '      obbBBBBBBbbnno',
    '      onbbbbnonbbbno'
  ];
  var TORSO_BACK = [
    '       ooRRRRRRRRoo',
    '      oRRRbRRRRbRRRo',
    '     oRRRRRbRRbRRRRRo',
    '     oRRRRRRbbRRRRRro',
    '     orRRRRbRRbRRRRro',
    '     orRRRbRRRRbRRrqo',
    '     oqrrbRRRRRRbrrqo',
    '      oqrbRRRRRRbrqo',
    '      oxxxxxxxxxxxxo',
    '      obbBBBBBBBbnno',
    '      obbBBnBBBbbnno',
    '      onbbbbnonbbbno'
  ];
  // the two legs: columns 5..11 and 12..19 move separately for the walk cycle
  var LEG_L = [
    '      obbBno',
    '      obbBno',
    '      onbbno',
    '      onnnno',
    '     oTTTtto',
    '     otttvvo',
    '      ooooo'
  ];
  var LEG_R = [
    '            onbBbo',
    '            onbBbo',
    '            onbbno',
    '            onnnno',
    '            oTTTTto',
    '            otttvvo',
    '             ooooo'
  ];
  var BASE = {
    o: OUT, Y: '#ffe27a', y: '#ffc61a', u: '#c98a00', l: '#5a5a66', L: '#fff6b0',
    S: '#ffd9b3', s: '#f0b98e', k: '#c98763', H: '#8a5230', h: '#5e3418', e: '#2a1a10', w: '#ffffff', c: '#f59a8a', m: '#b0523d',
    R: '#ff7a5a', r: '#e05a3a', q: '#a8382a', B: '#6aa8ff', b: '#3d7bd9', n: '#2a5aa8', G: '#ffd23f', x: '#3a2a20',
    T: '#9a6a42', t: '#6a4228', v: '#3a2418'
  };
  function pal(over) { var p = {}, k; for (k in BASE) p[k] = BASE[k]; for (k in over) p[k] = over[k]; return p; }
  // visitors: hair, skin, shirt and trouser colours mixed by a seed
  var HAIR = [['#2a1a14', '#140c08'], ['#e8c35a', '#b8902a'], ['#8a5230', '#5e3418'], ['#d0602a', '#963a14'], ['#c8c8d0', '#8a8a96'], ['#3a2a5a', '#22183a']];
  var SKIN = [['#ffd9b3', '#f0b98e', '#c98763'], ['#e8b48a', '#cf9468', '#a86c48'], ['#b07850', '#94603c', '#704428'], ['#7a4e32', '#643c24', '#4a2a18']];
  var SHIRT = [['#8fd3ff', '#5aa8e0', '#3a78b0'], ['#ff9fb0', '#e0708a', '#b04a64'], ['#9dff8a', '#5ad04a', '#3a9a2a'], ['#ffd23f', '#e0a820', '#a87a10'], ['#c8a0ff', '#9a70e0', '#6a48b0'], ['#ffffff', '#d8d0e0', '#a098b0']];
  var PANTS = [['#5a6a8a', '#3a4a6a', '#2a3450'], ['#7a5a3a', '#5a4028', '#3a2818'], ['#2a2a3a', '#1c1c28', '#101018'], ['#c0392b', '#8a2a1c', '#5a1a10']];
  function visitorPal(seed) {
    var hr = HAIR[seed % 6], sk = SKIN[(seed >> 3) % 4], sh = SHIRT[(seed >> 5) % 6], pa = PANTS[(seed >> 8) % 4];
    return pal({ H: hr[0], h: hr[1], S: sk[0], s: sk[1], k: sk[2], R: sh[0], r: sh[1], q: sh[2], B: pa[0], b: pa[1], n: pa[2], G: pa[0],
      T: '#5a4a5a', t: '#3a2e3a', v: '#221a22' });
  }
  var GUIDE = pal({ H: '#3a2a5a', h: '#22183a', R: '#fff7e8', r: '#d8cfc0', q: '#a89e90', B: '#2e8f3e', b: '#1f6e33', n: '#14501f', G: '#ffd23f' });
  // hired helper diggers: orange hard hats, a different shirt and overalls each
  var HELPERS = [
    pal({ Y: '#ffb36b', y: '#ff8c2a', u: '#b85a10', R: '#9dff8a', r: '#5ad04a', q: '#3a9a2a', B: '#c8a070', b: '#9a7448', n: '#6a4c2a', G: '#ff8c2a' }),
    pal({ Y: '#ffb36b', y: '#ff8c2a', u: '#b85a10', R: '#c8a0ff', r: '#9a70e0', q: '#6a48b0', B: '#5a6a8a', b: '#3a4a6a', n: '#2a3450', G: '#ff8c2a', S: '#b07850', s: '#94603c', k: '#704428' }),
    pal({ Y: '#ffb36b', y: '#ff8c2a', u: '#b85a10', R: '#ffd23f', r: '#e0a820', q: '#a87a10', B: '#7a5a3a', b: '#5a4028', n: '#3a2818', G: '#ff8c2a', H: '#e8c35a', h: '#b8902a' }),
    pal({ Y: '#ffb36b', y: '#ff8c2a', u: '#b85a10', R: '#8fd3ff', r: '#5aa8e0', q: '#3a78b0', B: '#2e8f3e', b: '#1f6e33', n: '#14501f', G: '#ff8c2a', S: '#7a4e32', s: '#643c24', k: '#4a2a18' }),
    pal({ Y: '#ffb36b', y: '#ff8c2a', u: '#b85a10', R: '#ff9fb0', r: '#e0708a', q: '#b04a64', B: '#6a6a7a', b: '#4a4a5a', n: '#2a2a3a', G: '#ff8c2a', H: '#d0602a', h: '#963a14' })
  ];
  var KEEPER = pal({ H: '#c8c8d0', h: '#8a8a96', R: '#e74c3c', r: '#b03a2a', q: '#7a2418', B: '#fff7e8', b: '#d8cfc0', n: '#a89e90', G: '#e74c3c' });

  // ---------- drawing into a small canvas ----------
  var W = 60, H = 66, FX = 30, FY = 64; // canvas size and the feet point
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  var cv = canvas(W, H), cx = cv.getContext('2d');
  function stamp(c, rows, P, x0, y0) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var i = 0; i < row.length; i++) { var ch = row.charAt(i); if (ch === ' ') continue; c.fillStyle = P[ch] || '#f0f'; c.fillRect(x0 + i, y0 + r, 1, 1); }
    }
  }
  function px(c, x, y, col, w, h) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function line(c, x0, y0, x1, y1, col, t) { // Bresenham, t pixels thick
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); t = t || 1;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, o = Math.floor((t - 1) / 2);
    for (var n = 0; n < 200; n++) { px(c, x0 - o, y0 - o, col, t, t); if (x0 === x1 && y0 === y1) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  // a 1-pixel outline round everything drawn
  function outline(c, w, h, col) {
    var img = c.getImageData(0, 0, w, h), d = img.data, out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) continue;
      if ((x > 0 && d[(y * w + x - 1) * 4 + 3] > 0) || (x < w - 1 && d[(y * w + x + 1) * 4 + 3] > 0) ||
          (y > 0 && d[((y - 1) * w + x) * 4 + 3] > 0) || (y < h - 1 && d[((y + 1) * w + x) * 4 + 3] > 0)) out[y * w + x] = 1;
    }
    c.fillStyle = col;
    for (var k = 0; k < out.length; k++) if (out[k]) c.fillRect(k % w, Math.floor(k / w), 1, 1);
  }

  // ---------- the pickaxe, by Drill Power tier ----------
  var PICK = [
    { head: '#9a6a3a', hi: '#c08a52', handle: '#7a4f2a' },
    { head: '#8d8d96', hi: '#c8c8d2', handle: '#8a5a2b' },
    { head: '#cfd6de', hi: '#ffffff', handle: '#8a5a2b' },
    { head: '#ffcf3f', hi: '#fff3b0', handle: '#6b3f1d' },
    { head: '#6ff0ff', hi: '#e8ffff', handle: '#b45cff' }
  ];
  function pick(c, sx, sy, ang, tier, P, t) {
    var C = PICK[tier], ca = Math.cos(ang), sa = Math.sin(ang);
    var hx = sx + ca * 6, hy = sy + sa * 6;
    line(c, sx, sy, hx, hy, P.r, 3); line(c, sx, sy, hx, hy, P.R, 2);             // sleeve
    var ex = hx + ca * 15, ey = hy + sa * 15;
    line(c, hx - ca, hy - sa, ex, ey, C.handle, 2);
    var nx = -sa, ny = ca;                                                            // head across the handle end
    line(c, ex - nx * 6, ey - ny * 6, ex + nx * 7, ey + ny * 7, C.head, 2);
    line(c, ex + nx * 7, ey + ny * 7, ex + nx * 9 - ca * 2, ey + ny * 9 - sa * 2, C.head, 1);
    line(c, ex - nx * 6 - ca, ey - ny * 6 - sa, ex + nx * 5 - ca, ey + ny * 5 - sa, C.hi, 1);
    px(c, hx - 1, hy - 1, P.S, 3, 3); px(c, hx - 1, hy + 1, P.s, 3, 1);             // fist
    if (tier === 4 && Math.sin(t * 8) > 0.6) px(c, ex, ey - 3, '#ffffff');
  }

  // ---------- the big rucksack, worn when the bag is full: stuffed so finds poke out of the top ----------
  var PACK = { K: '#8a5a2b', k: '#5e3a1a', F: '#b07840', G: '#ffd23f', peek: ['#2fd56b', '#d9813b', '#6ff0ff', '#ff6f8a'] };
  // side view, the pack on the miner's back at the left of the sprite: x, y is its top-left corner
  function packSide(c, x, y) {
    px(c, x + 2, y, PACK.peek[0], 2, 3); px(c, x + 5, y - 1, PACK.peek[1], 2, 4); px(c, x + 8, y + 1, PACK.peek[2], 2, 2);
    px(c, x, y + 2, PACK.K, 12, 15); px(c, x, y + 2, PACK.k, 2, 15); px(c, x, y + 16, PACK.k, 12, 1);
    px(c, x + 1, y + 2, PACK.F, 11, 5); px(c, x + 1, y + 7, PACK.k, 11, 1); px(c, x + 6, y + 6, PACK.G, 2, 2);
    px(c, x - 2, y + 9, PACK.F, 3, 6); px(c, x - 2, y + 14, PACK.k, 3, 1);
  }
  // seen from behind it covers the back, centred at cx
  function packBack(c, cx, y) {
    var x = cx - 8;
    px(c, x + 3, y, PACK.peek[0], 2, 3); px(c, x + 7, y - 1, PACK.peek[1], 3, 4); px(c, x + 12, y + 1, PACK.peek[3], 2, 2);
    px(c, x, y + 2, PACK.K, 17, 15); px(c, x, y + 2, PACK.k, 1, 15); px(c, x + 16, y + 2, PACK.k, 1, 15); px(c, x, y + 16, PACK.k, 17, 1);
    px(c, x + 1, y + 2, PACK.F, 15, 6); px(c, x + 1, y + 8, PACK.k, 15, 1); px(c, x + 7, y + 7, PACK.G, 3, 2);
    px(c, x + 3, y + 11, PACK.F, 4, 4); px(c, x + 10, y + 11, PACK.F, 4, 4);
  }

  // ---------- characters ----------
  // o: { back, flip handled by caller, pose: {bob, body, lean, stride, air, blink}, ang (pick angle) or null,
  //      tier, lampOn, climb (null | 0 | 1), P (palette), hair (true: no hard hat), arms ('swing' | 'carry' | 'none'), t }
  function person(o) {
    var c = cx, P = o.P || BASE, pose = o.pose, back = o.back, t = o.t || 0;
    c.clearRect(0, 0, W, H);
    var X0 = FX - 12, legY = FY - 7 + Math.round(pose.bob), Y = legY - 11 + Math.round(pose.body), X = X0 + Math.round(pose.lean);
    var head = o.hair ? (back ? HEAD_HAIR_BACK : HEAD_HAIR) : (back ? HEAD_MINER_BACK : HEAD_MINER);
    var Pl = P; if (!o.lampOn && !o.hair) { Pl = pal(P); Pl.L = '#cfc58a'; }
    if (pose.blink && !back) { Pl = Pl === P ? pal(P) : Pl; Pl.e = Pl.k; Pl.w = Pl.S; }
    if (o.climb != null) return climber(o, P, Pl, X0, legY, head);
    // legs: the stride swings them apart and lifts the one moving forward; in the air they spread
    var st = pose.stride, sw = Math.round(st * 3), lift = Math.round(Math.abs(st) * 2), ap = Math.round(pose.air * 2);
    var behind = back && o.ang != null; // facing away, the pick arm is behind the body
    if (o.pack && !back) packSide(c, X - 6, Y - 6);
    if (behind) pick(c, X + 14, Y + 3, o.ang, o.tier, P, t);
    else if (!back) { px(c, X + 4, Y + 2, P.q, 2, 6); px(c, X + 4, Y + 8, P.k, 2, 2); }                // far arm
    // not digging: the pick rests over the back shoulder, held by the hanging near arm
    var carry = o.carry && o.ang == null && pose.air <= 0.3;
    function shoulderPick() { var C = PICK[o.tier]; line(c, X + 17, Y + 9, X - 1, Y - 17, C.handle, 2); line(c, X - 5, Y - 13, X + 3, Y - 21, C.head, 2); px(c, X + 3, Y - 22, C.hi); px(c, X - 6, Y - 12, C.hi); }
    if (carry && !back) shoulderPick();
    stamp(c, LEG_L, P, X0 + sw - ap, legY - (st > 0 ? lift : 0));
    stamp(c, LEG_R, P, X0 - sw + ap, legY - (st < 0 ? lift : 0));
    stamp(c, back ? TORSO_BACK : TORSO, P, X, Y);
    if (carry && back) shoulderPick();
    if (pose.air > 0.3) { px(c, X + 4, Y - 7, P.r, 2, 9); px(c, X + 20, Y - 7, P.r, 2, 9); px(c, X + 4, Y - 9, P.S, 2, 2); px(c, X + 20, Y - 9, P.S, 2, 2); }
    if (o.pack && !back) line(c, X + 9, Y + 1, X + 11, Y + 8, PACK.k, 1); // shoulder strap
    stamp(c, head, Pl, X, Y - 17);
    if (o.pack && back) packBack(c, X + 12, Y - 4);
    if (!behind && o.ang != null && pose.air <= 0.3) pick(c, X + 12, Y + 3, o.ang, o.tier, P, t);
    else if (o.arms === 'wave') { var wv = Math.sin(t * 10) > 0 ? 1 : 0; px(c, X + 19, Y - 3 - wv, P.r, 2, 6); px(c, X + 19 + wv, Y - 5 - wv, P.S, 2, 2); }
    else if (o.ang == null && pose.air <= 0.3) { px(c, X + 15, Y + 2, P.r, 3, 6); px(c, X + 15, Y + 8, P.S, 3, 2); } // near arm at the side
    outline(c, W, H, OUT);
    return { cv: cv, fx: FX, fy: FY };
  }
  // seen from behind on the ladder, hands on the rungs; the pick hangs on the back
  function climber(o, P, Pl, X0, legY, head) {
    var c = cx, a = o.climb ? 0 : 3, b = o.climb ? 3 : 0, Y = legY - 11;
    stamp(c, LEG_L, P, X0, legY - a); stamp(c, LEG_R, P, X0, legY - b);
    stamp(c, TORSO_BACK, P, X0, Y);
    line(c, X0 + 18, Y + 9, X0 + 5, Y - 4, PICK[o.tier].handle, 2); px(c, X0 + 2, Y - 6, PICK[o.tier].head, 6, 2);
    px(c, X0 + 4, Y - 8 + b, P.r, 3, 10 - b); px(c, X0 + 17, Y - 8 + a, P.r, 3, 10 - a);
    px(c, X0 + 4, Y - 10 + b, P.S, 3, 2); px(c, X0 + 17, Y - 10 + a, P.S, 3, 2);
    stamp(c, head, Pl, X0, Y - 17);
    if (o.pack) packBack(c, X0 + 12, Y - 4);
    outline(c, W, H, OUT);
    return { cv: cv, fx: FX, fy: FY };
  }
  // cached frames for the people walking about the plaza (no pickaxe, four walk frames)
  var cache = {};
  function npc(kind, seed, back, frame, moving, t) {
    var key = kind + '|' + seed + '|' + (back ? 1 : 0) + '|' + frame + '|' + (moving ? 1 : 0) + (kind === 'keeper' ? '|' + (Math.sin(t * 10) > 0 ? 1 : 0) : '');
    if (cache[key]) return cache[key];
    var P = kind === 'guide' ? GUIDE : kind === 'keeper' ? KEEPER : visitorPal(seed);
    var st = moving ? [0, 1, 0, -1][frame & 3] : 0;
    var pose = { bob: moving && st !== 0 ? -1 : 0, body: !moving && frame & 1 ? 1 : 0, lean: 0, stride: st, air: 0, blink: !moving && frame === 3 };
    person({ back: back, pose: pose, ang: null, P: P, hair: true, arms: kind === 'keeper' ? 'wave' : '', t: t });
    var out = canvas(W, H); out.getContext('2d').drawImage(cv, 0, 0);
    if (Object.keys(cache).length > 600) cache = {};
    return (cache[key] = { cv: out, fx: FX, fy: FY });
  }

  // ---------- exhibits: five pieces per world, as shapes on a 48×28 grid, facing screen-right ----------
  // shapes: ['l', x0, y0, x1, y1, thick] line, ['p', [x, y, ...]] polygon, ['c', x, y, r] disc,
  //         ['r', x, y, w, h] rectangle, ['o', x, y, r] ring, ['x', x, y, r] hole
  function ribs(x0, x1, step, top, len) { var out = []; for (var x = x0; x <= x1; x += step) out.push(['l', x, top + (x - x0) * 0.08, x - 1, top + len - (x - x0) * 0.12, 1]); return out; }
  function ticks(x0, x1, step, y, len) { var out = []; for (var x = x0; x <= x1; x += step) out.push(['l', x, y - len, x, y + len, 1]); return out; }
  function wave(x0, x1, y, amp, per, th) { var out = []; for (var x = x0; x < x1; x += 2) out.push(['l', x, y + amp * Math.sin(x / per), x + 2, y + amp * Math.sin((x + 2) / per), th]); return out; }
  var EXHIBITS = [
    { // forest raptor: skull, ribs, leg, tail, claw
      parts: [
        [['p', [35, 4, 41, 2, 47, 5, 47, 7, 41, 8, 36, 9]], ['l', 37, 9, 45, 10, 1], ['x', 39, 5, 1.2]],
        [['l', 20, 12, 33, 9, 2], ['l', 33, 9, 36, 6, 2]].concat(ribs(23, 31, 2, 11, 5)),
        [['l', 20, 13, 18, 19, 2], ['l', 18, 19, 21, 23, 2], ['l', 21, 23, 19, 27, 2], ['l', 17, 27, 23, 27, 1],
         ['l', 23, 13, 25, 19, 2], ['l', 25, 19, 28, 23, 2], ['l', 28, 23, 27, 27, 2], ['l', 25, 27, 31, 27, 1]],
        [['l', 20, 12, 12, 9, 2], ['l', 12, 9, 5, 8, 2], ['l', 5, 8, 0, 10, 1]],
        [['l', 32, 11, 34, 15, 1], ['l', 34, 15, 37, 16, 1], ['l', 37, 16, 38, 18, 1], ['l', 30, 11, 31, 15, 1], ['l', 31, 15, 33, 17, 1]]
      ], rods: [[22, 13], [32, 10]] },
    { // ocean shark: tooth, jaw, fin, spine, tail
      parts: [
        [['p', [40, 13, 41, 16, 42, 13]], ['p', [42, 13, 43, 16, 44, 13]], ['p', [44, 13, 45, 15, 46, 12]], ['p', [38, 13, 39, 15, 40, 13]]],
        [['p', [34, 8, 41, 7, 46, 9, 47, 11, 45, 13, 37, 14, 33, 12]], ['x', 40, 9, 1.2]],
        [['p', [19, 9, 24, 1, 26, 2, 27, 9]], ['p', [29, 13, 25, 20, 27, 20, 33, 13]], ['p', [13, 12, 11, 16, 15, 12]]],
        [['l', 9, 11, 34, 11, 2]].concat(ticks(11, 33, 2, 11, 2)),
        [['p', [10, 10, 3, 1, 5, 1, 8, 11, 4, 20, 2, 20]]]
      ], rods: [[18, 12], [32, 12]] },
    { // jungle crocodile: skull, jaw, scales, leg, tail
      parts: [
        [['p', [32, 7, 40, 7, 47, 8, 47, 10, 32, 11]], ['x', 34, 8, 1]],
        [['l', 32, 12, 46, 12, 2]].concat(ticks(35, 45, 2, 12, 1)),
        [['l', 13, 9, 32, 9, 2], ['p', [14, 8, 15, 5, 16, 8]], ['p', [18, 8, 19, 5, 20, 8]], ['p', [22, 8, 23, 5, 24, 8]], ['p', [26, 8, 27, 5, 28, 8]], ['p', [30, 8, 31, 6, 32, 8]]],
        [['l', 28, 10, 30, 15, 2], ['l', 30, 15, 33, 17, 1], ['l', 30, 15, 28, 17, 1], ['l', 17, 10, 16, 15, 2], ['l', 16, 15, 19, 17, 1], ['l', 16, 15, 14, 17, 1]],
        [['l', 13, 9, 6, 11, 2], ['l', 6, 11, 0, 14, 1]].concat(ticks(3, 11, 3, 10, 1))
      ], rods: [[18, 10], [30, 10]] },
    { // moon rover: wheel, antenna, panel, camera, flag
      color: '#b8bcc8', partColor: [null, null, '#7aa8e0', null, '#e74c3c'],
      parts: [
        [['o', 13, 23, 4], ['o', 24, 23, 4], ['o', 35, 23, 4], ['c', 13, 23, 1], ['c', 24, 23, 1], ['c', 35, 23, 1], ['l', 13, 19, 35, 19, 1]],
        [['l', 29, 11, 29, 4, 1], ['p', [26, 4, 32, 1, 33, 5, 28, 6]]],
        [['r', 9, 12, 30, 7], ['r', 6, 9, 36, 2], ['l', 12, 9, 12, 11, 1], ['l', 20, 9, 20, 11, 1], ['l', 28, 9, 28, 11, 1], ['l', 36, 9, 36, 11, 1]],
        [['l', 38, 12, 40, 4, 2], ['r', 37, 1, 7, 4], ['x', 43, 3, 1]],
        [['l', 9, 12, 9, 0, 1], ['r', 10, 0, 8, 5]]
      ], rods: [] },
    { // alien sky serpent: skull, fang, wing, coil, tail
      color: '#bff0c8',
      parts: [
        [['p', [37, 10, 42, 9, 47, 11, 47, 13, 41, 15, 37, 14]], ['x', 41, 11, 1]],
        [['p', [42, 15, 43, 19, 44, 15]], ['p', [45, 14, 46, 17, 47, 13]]],
        [['l', 26, 13, 20, 1, 1], ['l', 26, 13, 27, 0, 1], ['l', 26, 13, 33, 2, 1], ['l', 20, 1, 27, 0, 1], ['l', 27, 0, 33, 2, 1], ['l', 23, 7, 30, 7, 1]],
        wave(12, 38, 16, 5, 4, 2).concat(ticks(14, 36, 3, 16, 1)),
        wave(0, 12, 16, 5, 4, 1).concat([['p', [0, 18, 3, 14, 5, 19]]])
      ], rods: [[15, 21], [31, 21]] }
  ];
  var EW = 48, EH = 28;
  function shape(c, s) {
    if (s[0] === 'l') line(c, s[1], s[2], s[3], s[4], c.fillStyle, s[5]);
    else if (s[0] === 'r') c.fillRect(s[1], s[2], s[3], s[4]);
    else if (s[0] === 'p') { var p = s[1]; c.beginPath(); c.moveTo(p[0] + 0.5, p[1] + 0.5); for (var i = 2; i < p.length; i += 2) c.lineTo(p[i] + 0.5, p[i + 1] + 0.5); c.closePath(); c.fill(); }
    else if (s[0] === 'c') { c.beginPath(); c.arc(s[1] + 0.5, s[2] + 0.5, s[3], 0, 7); c.fill(); }
    else if (s[0] === 'o') { c.beginPath(); c.arc(s[1] + 0.5, s[2] + 0.5, s[3], 0, 7); c.lineWidth = 2; c.strokeStyle = c.fillStyle; c.stroke(); }
    else if (s[0] === 'x') { c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(s[1] + 0.5, s[2] + 0.5, s[3], 0, 7); c.fill(); c.restore(); }
  }
  // shade a solid mask: lighter where open above, darker where open below
  function shadeMask(c, w, h, base, hi, lo) {
    var img = c.getImageData(0, 0, w, h), d = img.data;
    function a(x, y) { return x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0; }
    var cols = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (a(x, y)) cols.push([x, y, !a(x, y - 1) ? hi : !a(x, y + 1) || !a(x + 1, y) ? lo : base]);
    c.clearRect(0, 0, w, h);
    cols.forEach(function (p) { c.fillStyle = p[2]; c.fillRect(p[0], p[1], 1, 1); });
  }
  function hexShade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))); }
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  var ecache = {};
  function exhibitCanvas(k, have) {
    var key = k + '|' + have.join('');
    if (ecache[key]) return ecache[key];
    var E = EXHIBITS[k], out = canvas(EW + 2, EH + 2), oc = out.getContext('2d'), m = canvas(EW, EH), mc = m.getContext('2d');
    oc.translate(1, 1);
    // support rods from the plinth
    E.rods.forEach(function (r) { line(oc, r[0], r[1], r[0], EH - 1, '#4a4a56', 1); px(oc, r[0] - 1, EH - 1, '#4a4a56', 3, 1); });
    E.parts.forEach(function (part, i) {
      mc.clearRect(0, 0, EW, EH); mc.fillStyle = '#fff';
      part.forEach(function (s) { shape(mc, s); });
      if (have[i]) {
        var base = (E.partColor && E.partColor[i]) || E.color || '#e2d6b8';
        shadeMask(mc, EW, EH, base, hexShade(base, 0.45), hexShade(base, -0.28));
        oc.drawImage(m, 0, 0);
      } else { // a dotted ghost of the missing piece
        var img = mc.getImageData(0, 0, EW, EH).data;
        oc.fillStyle = 'rgba(255,255,255,0.28)';
        for (var y = 0; y < EH; y++) for (var x = 0; x < EW; x++) if (img[(y * EW + x) * 4 + 3] > 0 && (x + y) % 2 === 0) oc.fillRect(x, y, 1, 1);
      }
    });
    oc.setTransform(1, 0, 0, 1, 0, 0);
    // outline the found pieces only
    var tmp = canvas(EW + 2, EH + 2), tc = tmp.getContext('2d'); tc.drawImage(out, 0, 0);
    var d = tc.getImageData(0, 0, EW + 2, EH + 2).data, solid = function (x, y) { var a = d[(y * (EW + 2) + x) * 4 + 3]; return a > 200; };
    oc.fillStyle = '#3a2c22';
    for (var y2 = 0; y2 < EH + 2; y2++) for (var x2 = 0; x2 < EW + 2; x2++) {
      if (solid(x2, y2)) continue;
      if ((x2 > 0 && solid(x2 - 1, y2)) || (x2 < EW + 1 && solid(x2 + 1, y2)) || (y2 > 0 && solid(x2, y2 - 1)) || (y2 < EH + 1 && solid(x2, y2 + 1))) oc.fillRect(x2, y2, 1, 1);
    }
    return (ecache[key] = out);
  }
  // draw world k's exhibit standing on a plinth top at screen (x, y); s is screen pixels per art pixel
  function exhibit(c, k, pieces, open, x, y, s) {
    if (!open) return;
    var have = pieces.map(function (n) { return n > 0 ? 1 : 0; }), ec = exhibitCanvas(k, have);
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(ec, Math.round(x - ec.width * s / 2), Math.round(y - ec.height * s), Math.round(ec.width * s), Math.round(ec.height * s));
    c.restore();
  }

  // ---------- item icons for finds popping up: 12×12 pixel art, outlined, cached ----------
  var ICONS = {
    lump: ['    oooo    ', '  ooHHhhoo  ', ' oHHhhhhhdo ', ' oHhwhhhhdo ', 'oHhhhhhhhddo', 'ohhhhhhhhddo',
           'ohhhhhhhhddo', 'ohhhhhhhddo ', ' ohhhhhdddo ', '  oohddddo  ', '    ooooo   ', '            '],
    gem:  ['            ', '  oooooooo  ', ' oHHwHhhhdo ', 'oHHhhHhhhddo', 'oooooooooooo', ' ohHhhhhhddo',
           '  ohHhhhddo ', '   ohhhddo  ', '    ohddo   ', '     odo    ', '      o     ', '            '],
    bone: [' oo      oo ', 'oWWo    oWWo', 'oWWWooooWWdo', ' oWWWWWWWdo ', ' oWddddddWo ', 'oWWdooooWWdo',
           'oWdo    oddo', ' oo      oo ', '            ', '            ', '            ', '            '],
    wheel:['   oooooo   ', '  oddddddo  ', ' oddWWWWddo ', 'oddWdddWWddo', 'oddWdGGdWddo', 'oddWdGGdWddo',
           'oddWWdddWddo', ' oddWWWWddo ', '  oddddddo  ', '   oooooo   ', '            ', '            '],
    chest:['            ', ' oooooooooo ', 'oBBBBBBBBBBo', 'oBbbbbbbbbBo', 'oGGGGYYGGGGo', 'oBBBBYYBBBBo',
           'oBbbbbbbbbBo', 'oBbbbbbbbbBo', ' oooooooooo ', '            ', '            ', '            '],
    star: ['     oo     ', '    oHHo    ', '    oHho    ', 'ooooohhoooo ', 'oHHHhhhhhhdo', ' ohhhhhhhdo ',
           '  ohhhhhdo  ', '  ohhoohdo  ', ' ohdo  oddo ', ' ooo    ooo ', '            ', '            ']
  };
  var iconCache = {};
  // kind: 'ore' | 'fossil' | 'treasure' | 'relic'; idx: ore or fossil index; col: its colour; moon: rover parts instead of bones
  function item(kind, idx, col, moon) {
    var key = kind + idx + col + (moon ? 'm' : '');
    if (iconCache[key]) return iconCache[key];
    var shape = kind === 'ore' ? (idx >= 2 ? 'gem' : 'lump') : kind === 'fossil' ? (moon ? 'wheel' : 'bone') : kind === 'relic' ? 'star' : 'chest';
    var P = { o: OUT, H: hexShade(col, 0.35), h: col, d: hexShade(col, -0.35), w: '#ffffff', W: '#f4ecd6', G: '#ffd23f', Y: '#fff3b0',
      B: '#b8692a', b: '#8a4b1c' };
    if (moon && kind === 'fossil') { P.W = '#cfd8dc'; P.d = '#546e7a'; }
    else if (kind === 'fossil') P.d = '#c9bb98';
    if (kind === 'ore' && idx === 0) P.H = '#6a6a72'; // coal: a dull grey sheen on black
    var c = canvas(14, 14), g = c.getContext('2d');
    stamp(g, ICONS[shape], P, 1, 1);
    return (iconCache[key] = c);
  }

  return {
    PICK: PICK, hexShade: hexShade, item: item,
    miner: function (o) { o.P = BASE; return person(o); },
    helper: function (k, o) { o.P = HELPERS[k % HELPERS.length]; return person(o); },
    npc: npc, exhibit: exhibit,
    BODY_H: 38 // pixel height of a character, feet to hat
  };
})();
