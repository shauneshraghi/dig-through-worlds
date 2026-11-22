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
    // from the third on, each helper comes with a world unlocked and looks like it (HELPER_LOOK)
    // ocean: a merfolk with sea-green skin, teal hair and a fin crest, scale-green clothes and flipper feet
    pal({ S: '#9be8cf', s: '#6ccdb2', k: '#3f9c86', H: '#2fb8c8', h: '#1a7f96', R: '#58c8e8', r: '#2f98c0', q: '#1f6890', B: '#2fa88a', b: '#1f7f68', n: '#145a4a', G: '#bff7ff',
      T: '#ff9f5a', t: '#e0703a', v: '#a04a20', e: '#103040' }),
    // jungle: an explorer in a pith helmet with a brown band, khaki shirt and green shorts
    pal({ Y: '#f2e6b8', y: '#d8c88a', u: '#a8945a', l: '#6a4228', L: '#8a5a30', R: '#d8c890', r: '#b8a468', q: '#8a7844', B: '#4a8a3a', b: '#336a28', n: '#22501a', G: '#6a4228',
      S: '#b07850', s: '#94603c', k: '#704428' }),
    // moon: an astronaut in a white suit and helmet with a dark visor
    pal({ Y: '#ffffff', y: '#e4e8f0', u: '#a8b0c4', l: '#5a5a66', H: '#f4f6fa', h: '#c8cedc', R: '#f4f6fa', r: '#d0d6e2', q: '#9aa2b4', B: '#e8ecf4', b: '#c0c8d8', n: '#8a94aa', G: '#ff6b3a',
      T: '#8a94aa', t: '#5a6478', v: '#3a4256', x: '#5a6478' }),
    // Planet Glorp: a green alien with big dark eyes and antennae, in a purple suit
    pal({ S: '#9dff6a', s: '#6ad84a', k: '#3a9a2a', H: '#9dff6a', h: '#6ad84a', e: '#1a0a2a', w: '#d0b8ff', c: '#6ad84a', m: '#2a6a1a', R: '#b07aff', r: '#8a50e0', q: '#5a2ab0', B: '#7a4ad0', b: '#5a30a8', n: '#3a1a78', G: '#ff5ad0',
      T: '#5a30a8', t: '#3a1a78', v: '#220a50' })
  ];
  var HELPER_LOOK = [null, null, 'mer', 'explorer', 'astro', 'alien'];
  var KEEPER = pal({ H: '#c8c8d0', h: '#8a8a96', R: '#e74c3c', r: '#b03a2a', q: '#7a2418', B: '#fff7e8', b: '#d8cfc0', n: '#a89e90', G: '#e74c3c' });

  // ---------- drawing into a small canvas ----------
  var W = 72, H = 80, FX = 36, FY = 66; // canvas size and the feet point (room below the feet for a pick struck down)
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
  // The swing, held in both hands. The hands move together on an arc about the shoulders, at angle sw.arm and
  // distance sw.reach from (X + 12, Y + 2) (0 points forward, negative turns up); the handle runs from the hands
  // along sw.ang, so the pick turns about the grip, not the chest. The far hand grips the butt, the near hand
  // three pixels up; each arm runs from its own shoulder to its fist. Drawn in two parts so the fists can go on
  // after the head: pickTool (arms behind, handle, head) and pickFists.
  function grip(X, Y, sw) {
    var a = sw.arm, r = sw.reach, ca = Math.cos(sw.ang), sa = Math.sin(sw.ang);
    var gx = X + 12 + Math.cos(a) * r, gy = Y + 2 + Math.sin(a) * r;
    return { ca: ca, sa: sa, fx: gx - ca * 1.5, fy: gy - sa * 1.5, nx: gx + ca * 1.5, ny: gy + sa * 1.5,
             bx: gx - ca * 4, by: gy - sa * 4, ex: gx + ca * 15, ey: gy + sa * 15 };
  }
  function pickTool(c, X, Y, sw, tier, P, t) {
    var C = PICK[tier], g = grip(X, Y, sw), ca = g.ca, sa = g.sa, ex = g.ex, ey = g.ey;
    if (sw.smear) { // a pale arc where the head has just been: one or two frames of the strike
      var h0 = sw.smear.from, h1 = sw.ang, k;
      for (k = 0; k < 6; k++) {
        var aa = h0 + (h1 - h0) * k / 6, ab = h0 + (h1 - h0) * (k + 1) / 6, rr = 15 + 6;
        line(c, g.nx + Math.cos(aa) * rr, g.ny + Math.sin(aa) * rr, g.nx + Math.cos(ab) * rr, g.ny + Math.sin(ab) * rr, k < 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)', k < 3 ? 1 : 2);
      }
    }
    line(c, X + 8, Y + 3, g.fx, g.fy, P.q, 2);                                        // far arm
    line(c, g.bx, g.by, ex, ey, C.handle, 2);
    var nx = -sa, ny = ca;                                                            // head across the handle end, point on the +n side
    line(c, ex - nx * 5, ey - ny * 5, ex + nx * 6, ey + ny * 6, C.head, 2);
    line(c, ex + nx * 6, ey + ny * 6, ex + nx * 8 - ca * 2, ey + ny * 8 - sa * 2, C.head, 1);
    line(c, ex - nx * 5 - ca, ey - ny * 5 - sa, ex + nx * 4 - ca, ey + ny * 4 - sa, C.hi, 1);
    if (tier === 4 && Math.sin(t * 8) > 0.6) px(c, ex, ey - 3, '#ffffff');
    line(c, X + 15, Y + 3, g.nx, g.ny, P.r, 3); line(c, X + 15, Y + 3, g.nx, g.ny, P.R, 2); // near arm
    pickFists(c, X, Y, sw, P);
  }
  // over the head the fists go on again only where they are clear of it (raised behind the hat, or out in front)
  function fistsClearOfHead(X, Y, sw) {
    var g = grip(X, Y, sw), inside = function (x, y) { return x > X + 2 && x < X + 23 && y > Y - 18 && y < Y + 1; };
    return !inside(g.fx, g.fy) && !inside(g.nx, g.ny);
  }
  function pickFists(c, X, Y, sw, P) {
    var g = grip(X, Y, sw);
    px(c, g.fx - 1, g.fy - 1, P.s, 3, 3);                                             // far fist
    px(c, g.nx - 1, g.ny - 1, P.S, 3, 3); px(c, g.nx - 1, g.ny + 1, P.s, 3, 1);       // near fist
  }
  function ease(s) { return s * s * (3 - 2 * s); }
  // The pickaxe swing over one cycle f in 0..1, as key poses after the HD-2D sword swings: the pick comes out of the
  // block and is lifted (0 to 0.42), held cocked high over the head (0.42 to 0.62), struck down in two quick
  // frames with a smear (0.62 to 0.72; render.js times the hit and the chips to 0.72), and held low in the block
  // with the knees bent (0.72 to 1). side: the block is beside the miner (strike forward) rather than underfoot.
  // Each key: [f, arm angle, reach, handle angle, body drop, lean, stance].
  var SWING_SIDE = [
    [0.00, 0.30, 9, 0.10, 1, 1, 2], [0.18, -0.20, 8, -1.20, 0, 0, 1], [0.42, -2.45, 14, -2.30, -1, -1, 2],
    [0.62, -2.55, 14, -2.75, -1, -1, 2], [0.67, -0.90, 9, -0.95, 0, 0, 2], [0.72, 0.30, 9, 0.12, 2, 1, 3],
    [0.86, 0.32, 9, 0.18, 2, 1, 3]
  ];
  var SWING_DOWN = [
    [0.00, 0.85, 9, 0.70, 1, 1, 2], [0.18, -0.20, 8, -1.20, 0, 0, 1], [0.42, -2.45, 14, -2.30, -1, -1, 2],
    [0.62, -2.55, 14, -2.75, -1, -1, 2], [0.67, -0.60, 9, -0.55, 0, 0, 2], [0.72, 0.90, 9, 0.75, 2, 1, 3],
    [0.86, 0.92, 9, 0.80, 2, 1, 3]
  ];
  function swing(f, side) {
    var K = side ? SWING_SIDE : SWING_DOWN, i = 0, n = K.length;
    f = ((f % 1) + 1) % 1;
    while (i < n - 1 && K[i + 1][0] <= f) i++;
    var a = K[i], b = K[(i + 1) % n], span = (i + 1 < n ? b[0] : 1) - a[0], s = span > 0 ? (f - a[0]) / span : 0;
    var striking = a[0] === 0.62 || a[0] === 0.67;
    var e = striking ? s : ease(s), lerp = function (j) { return a[j] + (b[j] - a[j]) * e; };
    var held = function (j) { return s < 0.5 ? a[j] : b[j]; }; // whole pixels snap at the halfway point
    return { arm: lerp(1), reach: lerp(2), ang: lerp(3), body: held(4), lean: held(5), stance: held(6),
             smear: striking ? { from: a[0] === 0.62 ? a[3] : K[3][3] } : null };
  }
  // ---------- the walk cycle ----------
  // One cycle is two steps; cyc runs 0..1 over it. Each foot spends half the cycle planted, sliding back at a steady
  // speed (STEP_X sprite pixels per step, so callers advance cyc by one per 2 * STEP_X pixels of ground covered and
  // the feet do not skate), and half swinging forward, lifted and with the knee bent. The near leg plants at cyc 0,
  // the far leg at cyc 0.5. Arms swing against the legs.
  var STEP_X = 10, STRIDE = STEP_X / 2;
  function foot(p, gait) {
    var u = ((p % 1) + 1) % 1, A = STRIDE * gait;
    if (u < 0.5) return { x: A * (1 - 4 * u), lift: 0 };
    var s = (u - 0.5) * 2;
    return { x: -A + 2 * A * ease(s), lift: Math.round(3 * gait * Math.sin(Math.PI * s)) };
  }
  // the body over one step: contact, down (the torso sinks a pixel), passing, up (the hips rise a pixel)
  function walkPose(cyc, gait) {
    var u = (((cyc * 2) % 1) + 1) % 1, on = gait >= 0.3;
    return { cyc: cyc, gait: gait, bob: on && u >= 0.625 && u < 0.875 ? -1 : 0, body: on && u >= 0.125 && u < 0.375 ? 1 : 0 };
  }
  // one leg, hip at (hx, hy) (the left of a 4-pixel-wide trouser leg), the boot sole on row gy; dx moves the foot
  // forward, lift raises it and bends the knee forward. The far leg is a shade darker so crossed legs stay readable.
  var LEG_NEAR = ['b', 'B', 'B', 'n'], LEG_FAR = ['n', 'b', 'b', 'n'];
  function leg(c, P, hx, hy, gy, dx, lift, near) {
    var cols = near ? LEG_NEAR : LEG_FAR, by = gy - 1 - lift, n = by - hy, kb = lift > 0 ? Math.min(2, lift) : 0;
    for (var r = 0; r < n; r++) {
      var tt = (r + 0.5) / Math.max(1, n), x = Math.round(hx + dx * tt + kb * Math.sin(Math.PI * tt));
      px(c, x - 1, hy + r, OUT); px(c, x + 4, hy + r, OUT);
      for (var i = 0; i < 4; i++) px(c, x + i, hy + r, P[r === n - 1 ? (i === 0 || i === 3 ? 'n' : 'b') : cols[i]]);
    }
    var fx = Math.round(hx + dx);
    px(c, fx - 1, by, OUT, 7, 2);
    px(c, fx, by, P[near ? 'T' : 't'], 4, 1); px(c, fx + 4, by, P.t);
    px(c, fx, by + 1, P[near ? 't' : 'v'], 3, 1); px(c, fx + 3, by + 1, P.v, 2, 1);
  }
  // an arm hanging from the shoulder (sx, sy), the hand swung forward by dx
  function arm(c, sx, sy, dx, sleeve, skin, w) {
    var hx = sx + dx, hy = sy + 6 - (Math.abs(dx) > 2 ? 1 : 0);
    line(c, sx, sy, hx, hy, sleeve, w); px(c, hx - (w > 2 ? 1 : 0), hy + 1, skin, w, 2);
  }

  // ---------- the miner's rucksack: o.pack is the bag fill 0..1, drawn in five sizes; full it is stuffed and straining ----------
  var PACK = { K: '#8a5a2b', k: '#5e3a1a', F: '#b07840', G: '#ffd23f', peek: ['#2fd56b', '#d9813b', '#6ff0ff', '#ff6f8a'] };
  // size step 0 (empty) to 4 (full) for a fill fraction
  function packLevel(f) { return f >= 1 ? 4 : f >= 0.7 ? 3 : f >= 0.45 ? 2 : f >= 0.2 ? 1 : 0; }
  var PACK_SIDE = [[5, 8], [7, 10], [9, 13], [11, 15]], PACK_BACK = [[7, 8], [10, 10], [13, 13], [15, 15]]; // [width, height] per step below full
  // side view, the pack on the miner's back at the left of the sprite: x, y is the top-left corner of the full pack
  function packSide(c, x, y, f) {
    var L = packLevel(f);
    if (L === 4) {
      px(c, x + 2, y, PACK.peek[0], 2, 3); px(c, x + 5, y - 1, PACK.peek[1], 2, 4); px(c, x + 8, y + 1, PACK.peek[2], 2, 2); px(c, x + 10, y + 2, PACK.peek[3], 1, 2);
      px(c, x, y + 2, PACK.K, 12, 15); px(c, x, y + 2, PACK.k, 2, 15); px(c, x, y + 16, PACK.k, 12, 1);
      px(c, x + 1, y + 2, PACK.F, 11, 5); px(c, x + 1, y + 7, PACK.k, 11, 1); px(c, x + 6, y + 6, PACK.G, 2, 2);
      px(c, x - 2, y + 9, PACK.F, 3, 6); px(c, x - 2, y + 14, PACK.k, 3, 1);
      px(c, x - 1, y + 4, PACK.K, 1, 8); px(c, x - 1, y + 12, PACK.k, 1, 1);   // the sides bulge
      px(c, x + 2, y + 12, PACK.k, 8, 1); px(c, x + 3, y + 11, PACK.F, 1, 1); px(c, x + 8, y + 11, PACK.F, 1, 1); // strap straining across the belly
      return;
    }
    var wh = PACK_SIDE[L], w = wh[0], h = wh[1], rx = x + 12, lx = rx - w, ty = y + 17 - h;
    if (L >= 2) px(c, lx + 2, ty - 2, PACK.peek[0], 2, 3);
    if (L >= 3) { px(c, lx + 5, ty - 3, PACK.peek[1], 2, 4); px(c, lx + 8, ty - 1, PACK.peek[2], 2, 2); }
    px(c, lx, ty, PACK.K, w, h); px(c, lx, ty, PACK.k, 1, h); px(c, lx, y + 16, PACK.k, w, 1);
    var fl = L < 1 ? 3 : L < 2 ? 4 : 5;
    px(c, lx + 1, ty, PACK.F, w - 1, fl); px(c, lx + 1, ty + fl, PACK.k, w - 1, 1);
    if (L >= 2) px(c, lx + (w >> 1) - 1, ty + fl - 1, PACK.G, 2, 2);
    if (L >= 1) px(c, lx - 1, ty + h - 5, PACK.F, 2, 4);
  }
  // seen from behind it covers the back, centred at cx
  function packBack(c, cx, y, f) {
    var L = packLevel(f), x = cx - 8;
    if (L === 4) {
      px(c, x + 3, y, PACK.peek[0], 2, 3); px(c, x + 7, y - 1, PACK.peek[1], 3, 4); px(c, x + 12, y + 1, PACK.peek[3], 2, 2); px(c, x + 10, y + 1, PACK.peek[2], 1, 2);
      px(c, x, y + 2, PACK.K, 17, 15); px(c, x, y + 2, PACK.k, 1, 15); px(c, x + 16, y + 2, PACK.k, 1, 15); px(c, x, y + 16, PACK.k, 17, 1);
      px(c, x + 1, y + 2, PACK.F, 15, 6); px(c, x + 1, y + 8, PACK.k, 15, 1); px(c, x + 7, y + 7, PACK.G, 3, 2);
      px(c, x + 3, y + 11, PACK.F, 4, 4); px(c, x + 10, y + 11, PACK.F, 4, 4);
      px(c, x - 1, y + 5, PACK.K, 1, 9); px(c, x + 17, y + 5, PACK.K, 1, 9);   // the sides bulge
      px(c, x + 2, y + 9, PACK.k, 13, 1); px(c, x + 8, y + 9, PACK.F, 1, 1);    // strap straining across
      return;
    }
    var wh = PACK_BACK[L], w = wh[0], h = wh[1], lx = cx - (w >> 1), ty = y + 17 - h;
    if (L >= 2) px(c, lx + 2, ty - 2, PACK.peek[0], 2, 3);
    if (L >= 3) { px(c, lx + 6, ty - 3, PACK.peek[1], 3, 4); px(c, lx + 11, ty - 1, PACK.peek[3], 2, 2); }
    px(c, lx, ty, PACK.K, w, h); px(c, lx, ty, PACK.k, 1, h); px(c, lx + w - 1, ty, PACK.k, 1, h); px(c, lx, y + 16, PACK.k, w, 1);
    var fl = L < 1 ? 3 : L < 2 ? 4 : 5;
    px(c, lx + 1, ty, PACK.F, w - 2, fl); px(c, lx + 1, ty + fl, PACK.k, w - 2, 1);
    if (L >= 2) px(c, cx - 1, ty + fl - 1, PACK.G, 2, 2);
    if (L >= 3) { px(c, lx + 2, y + 11, PACK.F, 3, 4); px(c, lx + w - 5, y + 11, PACK.F, 3, 4); }
  }

  // ---------- a fossil piece strapped to the back on the way to the museum ----------
  // b: { shape: 'bone' | 'skull' | 'tusk', moon }. It runs from (x0, y0), low behind the pack, up to (x1, y1) above the
  // shoulder. Moon pieces are rover parts, drawn in grey metal.
  function boneOnBack(c, x0, y0, x1, y1, b) {
    var L = b.moon ? '#d4d8e2' : '#f3e6c4', D = b.moon ? '#8a90a0' : '#c9b48a', E = '#4a3a2e';
    var dx = x1 - x0, dy = y1 - y0, n = Math.sqrt(dx * dx + dy * dy), ux = dx / n, uy = dy / n, nx = -uy, ny = ux;
    function knob(x, y) { px(c, x + nx * 1.5 - 1, y + ny * 1.5 - 1, L, 2, 2); px(c, x - nx * 1.5 - 1, y - ny * 1.5 - 1, D, 2, 2); }
    if (b.shape === 'tusk') { // a curved tusk or fang: thick at the root, bending to a point
      var mx = x0 + dx * 0.55 + nx * 2, my = y0 + dy * 0.55 + ny * 2;
      line(c, x0, y0, mx, my, D, 3); line(c, x0, y0, mx, my, L, 2); line(c, mx, my, x1 + nx * 1, y1 + ny * 1, L, 2); px(c, x1 + nx * 2, y1 + ny * 2 - 1, L);
      return;
    }
    line(c, x0, y0, x1, y1, D, 2); line(c, x0 + nx * 0.6, y0 + ny * 0.6, x1 + nx * 0.6, y1 + ny * 0.6, L, 1);
    knob(x0, y0);
    if (b.shape === 'skull') { // a round skull on top, eye holes and teeth
      var sx = Math.round(x1 - 3), sy = Math.round(y1 - 4);
      px(c, sx + 1, sy, L, 5, 1); px(c, sx, sy + 1, L, 7, 4); px(c, sx + 1, sy + 5, D, 5, 1); px(c, sx, sy + 4, D, 7, 1);
      px(c, sx + 1, sy + 2, E, 2, 2); px(c, sx + 4, sy + 2, E, 2, 2); px(c, sx + 2, sy + 5, E); px(c, sx + 4, sy + 5, E);
    } else knob(x1, y1);
  }
  function bone(c, X, Y, b, back) {
    if (back) boneOnBack(c, X + 8, Y + 5, X - 1, Y - 9, b); else boneOnBack(c, X + 3, Y + 5, X - 7, Y - 10, b);
  }

  // ---------- characters ----------
  // o: { back, flip handled by caller, pose: {bob, body, lean, stride, air, blink}, ang (pick angle) or null,
  //      tier, lampOn, climb (null | 0 | 1), P (palette), hair (true: no hard hat), arms ('swing' | 'carry' | 'none'), t }
  function person(o) {
    var c = cx, P = o.P || BASE, pose = o.pose, back = o.back, t = o.t || 0, hasPack = o.pack != null && o.pack !== false;
    if (o.pack === true) o.pack = 1;
    c.clearRect(0, 0, W, H);
    var X0 = FX - 12, legY = FY - 7 + Math.round(pose.bob), Y = legY - 11 + Math.round(pose.body), X = X0 + Math.round(pose.lean);
    var look = o.look || null, bare = o.hair || look === 'mer' || look === 'alien';
    var head = bare ? (back ? HEAD_HAIR_BACK : HEAD_HAIR) : (back ? HEAD_MINER_BACK : HEAD_MINER);
    var Pl = P; if (!o.lampOn && !bare && look !== 'explorer') { Pl = pal(P); Pl.L = '#cfc58a'; }
    if (pose.blink && !back) { Pl = Pl === P ? pal(P) : Pl; Pl.e = Pl.k; Pl.w = Pl.S; }
    if (o.climb != null) return climber(o, P, Pl, X0, legY, head);
    // legs: each foot follows the walk cycle (planted, then lifted and swung forward); in the air they spread
    var gait = pose.gait || 0, cyc = pose.cyc || 0, ap = Math.round(pose.air * 2), gy = FY - 2;
    var fN = foot(cyc, gait), fF = foot(cyc + 0.5, gait);
    var air = pose.air > 0.3, sw = o.swing || null, digging = sw != null && !air, st = digging ? sw.stance : 0;
    var behind = back && digging; // facing away, the pick and arms are behind the body
    // arms swing against the legs: the near arm forward while the near foot is back
    var aN = Math.round(-fN.x * 0.8), aF = Math.round(-fF.x * 0.8);
    if (o.bone && !back) bone(c, X, Y, o.bone, false);                                    // strapped behind the pack
    if (hasPack && !back) packSide(c, X - 6, Y - 6, o.pack);
    if (behind) pickTool(c, X, Y, sw, o.tier, P, t);
    else if (!digging && !air) arm(c, X + 4, Y + 2, aF, P.q, P.k, 2);                      // far arm, behind the body
    // not digging: in the mine the pick is in the near hand, held by its neck; on the plaza (o.surface) it is slung
    // on the back by a strap and both arms swing free
    var carry = o.carry && !sw && !air, stow = carry && o.surface, inHand = carry && !o.surface;
    var cg = Math.round(aN / 3); // carrying, the hand on the handle sways a little
    function handPick(front) {
      var C = PICK[o.tier];
      if (front) { // facing on: the head upright in front of the hand at the hip, the handle trailing back across the legs
        var gx = X + 19 + cg, gy = Y + 8;
        line(c, gx, gy, X + 7 + cg, Y + 13, C.handle, 2);
        line(c, gx + 2, gy - 6, gx + 2, gy + 5, C.head, 2); line(c, gx + 2, gy + 5, gx + 1, gy + 7, C.head, 1);
        px(c, gx + 2, gy - 6, C.hi, 1, 9);
        return;
      }
      // facing away: hanging by the near side, the head across the fist and the handle straight down
      var hx = X + 21 + cg, hy = Y + 8;
      line(c, hx, hy, hx, Y + 14, C.handle, 2);
      line(c, hx - 5, hy - 1, hx + 6, hy - 1, C.head, 2); line(c, hx + 6, hy - 1, hx + 8, hy + 1, C.head, 1); px(c, hx - 5, hy - 2, C.hi, 9, 1);
      px(c, hx - 1, hy - 3, P.S, 3, 3); px(c, hx - 1, hy - 1, P.s, 3, 1);                     // the fist; the arm is under the pack
    }
    function slungPick(front) {
      var C = PICK[o.tier];
      if (front) { line(c, X - 5, Y - 13, X + 3, Y - 21, C.head, 2); px(c, X + 3, Y - 22, C.hi); px(c, X - 6, Y - 12, C.hi); line(c, X + 17, Y + 10, X - 1, Y - 17, C.handle, 2); return; }
      // facing away it lies across the back, from the far hip up over the near shoulder
      line(c, X + 4, Y + 13, X + 21, Y - 4, C.handle, 2);
      line(c, X + 17, Y - 8, X + 26, Y + 1, C.head, 2); line(c, X + 26, Y + 1, X + 27, Y + 3, C.head, 1); px(c, X + 17, Y - 9, C.hi, 2, 1);
    }
    if (stow && !back) slungPick(true);
    leg(c, P, X0 + 7, legY, gy, Math.round(fF.x) - ap - st, fF.lift, false);
    leg(c, P, X0 + 13, legY, gy, Math.round(fN.x) + ap + st, fN.lift, true);
    stamp(c, back ? TORSO_BACK : TORSO, P, X, Y);
    if (air) { px(c, X + 4, Y - 7, P.r, 2, 9); px(c, X + 20, Y - 7, P.r, 2, 9); px(c, X + 4, Y - 9, P.S, 2, 2); px(c, X + 20, Y - 9, P.S, 2, 2); }
    if ((hasPack || stow) && !back) line(c, X + 9, Y + 1, X + 11, Y + 8, PACK.k, 1); // shoulder strap
    // seen from behind the near arm goes on before the head and the pack, which cover it
    if (back && !digging && !air && !inHand && o.arms !== 'wave') arm(c, X + 16, Y + 2, aN, P.r, P.S, 3);
    if (back && inHand) { line(c, X + 16, Y + 2, X + 21 + cg, Y + 5, P.r, 3); line(c, X + 16, Y + 2, X + 21 + cg, Y + 5, P.R, 2); }
    // facing on, the swing goes on before the head, so the pick passes behind it when raised and never across the face
    if (inHand && !back) handPick(true);
    if (digging && !behind) pickTool(c, X, Y, sw, o.tier, P, t);
    stamp(c, head, Pl, X, Y - 17);
    if (look) headExtras(c, look, X, Y - 17, back, Pl);
    if (digging && !behind && fistsClearOfHead(X, Y, sw)) pickFists(c, X, Y, sw, P);
    if (o.bone && back) bone(c, X, Y, o.bone, true);
    if (hasPack && back) packBack(c, X + 12, Y - 4, o.pack);
    if (stow && back) slungPick(false);
    if (inHand && back) handPick(false);
    if (o.arms === 'wave' && !digging) { var wv = Math.sin(t * 10) > 0 ? 1 : 0; px(c, X + 19, Y - 3 - wv, P.r, 2, 6); px(c, X + 19 + wv, Y - 5 - wv, P.S, 2, 2); }
    else if (!back && !digging && !air && inHand) { // near arm bent up, the fist round the handle at the chest
      var hx = X + 19 + cg; line(c, X + 15, Y + 3, hx, Y + 7, P.r, 3); line(c, X + 15, Y + 3, hx, Y + 7, P.R, 2);
      px(c, hx - 1, Y + 7, P.S, 3, 3); px(c, hx - 1, Y + 9, P.s, 3, 1);
    }
    else if (!back && !digging && !air) arm(c, X + 16, Y + 2, aN, P.r, P.S, 3);
    outline(c, W, H, OUT);
    // lx, ly: the centre of the helmet lamp (the L pixels of HEAD_MINER); facing away, the hat's front edge
    return { cv: cv, fx: FX, fy: FY, lx: back ? X + 19 : X + 22, ly: Y - 17 + (back ? 5 : 6) };
  }
  // what makes a world's helper look like it, drawn over the head (origin hx, hy; the head faces screen-right)
  function headExtras(c, look, hx, hy, back, P) {
    if (look === 'mer') { // a fin crest over the crown and a fin for an ear
      px(c, hx + 7, hy - 3, P.h, 2, 4); px(c, hx + 9, hy - 4, P.H, 2, 5); px(c, hx + 11, hy - 3, P.h, 2, 4); px(c, hx + 13, hy - 1, P.H, 2, 2);
      px(c, hx + 10, hy - 4, '#d8fbff', 1, 2);
      var ex = back ? hx + 17 : hx + 3; px(c, ex, hy + 9, P.H, 2, 4); px(c, ex + (back ? 2 : -1), hy + 10, P.h, 1, 3);
    } else if (look === 'alien') { // two antennae with glowing tips
      line(c, hx + 8, hy + 1, hx + 6, hy - 5, P.k, 1); line(c, hx + 15, hy + 1, hx + 17, hy - 5, P.k, 1);
      px(c, hx + 5, hy - 7, P.G, 3, 3); px(c, hx + 16, hy - 7, P.G, 3, 3); px(c, hx + 5, hy - 7, '#ffd0f4');
      if (!back) { px(c, hx + 11, hy + 10, P.e, 3, 4); px(c, hx + 16, hy + 10, P.e, 3, 4); px(c, hx + 11, hy + 10, P.w); px(c, hx + 16, hy + 10, P.w); }
    } else if (look === 'astro') { // the visor over the face, a white collar ring, and an antenna on the helmet
      if (!back) { px(c, hx + 8, hy + 9, '#16204a', 14, 7); px(c, hx + 9, hy + 10, '#2a4a8a', 12, 5); px(c, hx + 10, hy + 10, '#9fd0ff', 4, 1); px(c, hx + 10, hy + 11, '#9fd0ff', 1, 2); }
      else px(c, hx + 4, hy + 9, P.u, 16, 1);
      line(c, hx + 6, hy + 2, hx + 4, hy - 3, P.u, 1); px(c, hx + 3, hy - 4, '#ff6b3a', 2, 2);
    } else if (look === 'explorer') { // the pith helmet's wide brim
      if (!back) { px(c, hx + 1, hy + 8, P.u, 23, 1); }
    }
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
    if (o.bone) bone(c, X0, Y, o.bone, true);
    if (o.pack != null && o.pack !== false) packBack(c, X0 + 12, Y - 4, o.pack === true ? 1 : o.pack);
    outline(c, W, H, OUT);
    return { cv: cv, fx: FX, fy: FY, lx: X0 + 11, ly: Y - 14 };
  }
  // cached frames for the people walking about the plaza (no pickaxe): moving, frame 0..7 is the walk cycle in eighths
  var cache = {};
  function npc(kind, seed, back, frame, moving, t) {
    var key = kind + '|' + seed + '|' + (back ? 1 : 0) + '|' + frame + '|' + (moving ? 1 : 0) + (kind === 'keeper' ? '|' + (Math.sin(t * 10) > 0 ? 1 : 0) : '');
    if (cache[key]) return cache[key];
    var P = kind === 'guide' ? GUIDE : kind === 'keeper' ? KEEPER : visitorPal(seed);
    var pose = moving ? walkPose((frame & 7) / 8, 1) : { bob: 0, body: frame & 1 ? 1 : 0, gait: 0, cyc: 0, blink: frame === 3 };
    pose.lean = 0; pose.air = 0;
    person({ back: back, pose: pose, ang: null, P: P, hair: true, arms: kind === 'keeper' ? 'wave' : '', t: t });
    var out = canvas(W, H); out.getContext('2d').drawImage(cv, 0, 0);
    if (Object.keys(cache).length > 600) cache = {};
    return (cache[key] = { cv: out, fx: FX, fy: FY });
  }

  // ---------- exhibits: three creatures per world, five pieces each ----------
  // shapes: ['l', x0, y0, x1, y1, thick] line, ['p', [x, y, ...]] polygon, ['c', x, y, r] disc,
  //         ['r', x, y, w, h] rectangle, ['o', x, y, r] ring, ['x', x, y, r] hole
  function ribs(x0, x1, step, top, len) { var out = []; for (var x = x0; x <= x1; x += step) out.push(['l', x, top + (x - x0) * 0.08, x - 1, top + len - (x - x0) * 0.12, 1]); return out; }
  function ticks(x0, x1, step, y, len) { var out = []; for (var x = x0; x <= x1; x += step) out.push(['l', x, y - len, x, y + len, 1]); return out; }
  function wave(x0, x1, y, amp, per, th) { var out = []; for (var x = x0; x < x1; x += 2) out.push(['l', x, y + amp * Math.sin(x / per), x + 2, y + amp * Math.sin((x + 2) / per), th]); return out; }
  // 15 exhibits, three creatures per world (index world*3 + creature), five pieces each, as shapes on a 48×28 grid, facing screen-right.
  // Each part is a piece the player finds (skull, ribs, ...); 'rods' are support poles from the plinth; 'color'/'partColor' override the bone colour.
  var EXHIBITS = [
    { // woolly mammoth: skull, tusks, ribs, legs, tail
      parts: [
        [['p', [33, 4, 37, 1, 42, 3, 42, 9, 40, 12, 34, 12, 31, 8]], ['l', 41, 8, 43, 14, 3], ['l', 43, 14, 43, 20, 2], ['l', 43, 20, 45, 23, 2], ['x', 37, 6, 1.2]],
        [['l', 38, 12, 42, 17, 2], ['l', 42, 17, 47, 17, 1], ['l', 47, 17, 47, 12, 1], ['l', 36, 12, 38, 17, 1]],
        [['l', 11, 10, 16, 5, 2], ['l', 16, 5, 25, 3, 2], ['l', 25, 3, 31, 7, 2]].concat(ribs(13, 31, 3, 7, 11)).concat([['l', 13, 18, 31, 17, 1]]),
        [['l', 15, 18, 15, 27, 3], ['l', 21, 18, 21, 27, 2], ['l', 27, 18, 27, 27, 3], ['l', 32, 18, 32, 27, 2], ['r', 13, 26, 5, 2], ['r', 25, 26, 5, 2]],
        [['l', 11, 10, 9, 15, 2], ['l', 9, 15, 10, 19, 1], ['p', [8, 17, 11, 17, 10, 22]]]
      ], rods: [] },
    { // forest raptor: skull, ribs, leg, tail, claw
      parts: [
        [['p', [35, 4, 41, 2, 47, 5, 47, 7, 41, 8, 36, 9]], ['l', 37, 9, 45, 10, 1], ['x', 39, 5, 1.2]],
        [['l', 20, 12, 33, 9, 2], ['l', 33, 9, 36, 6, 2]].concat(ribs(23, 31, 2, 11, 5)),
        [['l', 20, 13, 18, 19, 2], ['l', 18, 19, 21, 23, 2], ['l', 21, 23, 19, 27, 2], ['l', 17, 27, 23, 27, 1],
         ['l', 23, 13, 25, 19, 2], ['l', 25, 19, 28, 23, 2], ['l', 28, 23, 27, 27, 2], ['l', 25, 27, 31, 27, 1]],
        [['l', 20, 12, 12, 9, 2], ['l', 12, 9, 5, 8, 2], ['l', 5, 8, 0, 10, 1]],
        [['l', 32, 11, 34, 15, 1], ['l', 34, 15, 37, 16, 1], ['l', 37, 16, 38, 18, 1], ['l', 30, 11, 31, 15, 1], ['l', 31, 15, 33, 17, 1]]
      ], rods: [[22, 13], [32, 10]] },
    { // tyrannosaurus rex: skull, arms, ribs, legs, tail
      parts: [
        [['p', [29, 3, 41, 1, 47, 4, 47, 8, 42, 10, 30, 11]], ['p', [43, 10, 44, 13, 45, 10]], ['p', [40, 10, 41, 13, 42, 10]], ['p', [37, 10, 38, 12, 39, 10]], ['p', [46, 8, 46, 11, 47, 8]], ['x', 35, 5, 1.3]],
        [['l', 30, 14, 33, 17, 1], ['l', 33, 17, 35, 16, 1], ['l', 28, 14, 31, 18, 1], ['l', 31, 18, 33, 17, 1]],
        [['l', 8, 14, 18, 10, 2], ['l', 18, 10, 30, 10, 3], ['l', 28, 10, 30, 13, 2]].concat(ribs(18, 28, 2, 11, 7)),
        [['l', 20, 12, 23, 19, 3], ['l', 23, 19, 19, 24, 2], ['l', 19, 24, 19, 27, 2], ['l', 16, 27, 24, 27, 1], ['l', 25, 12, 28, 19, 2], ['l', 28, 19, 25, 24, 2], ['l', 25, 24, 25, 27, 1], ['l', 23, 27, 30, 27, 1]],
        [['l', 8, 14, 4, 16, 2], ['l', 4, 16, 0, 19, 1], ['l', 6, 15, 6, 17, 1]]
      ], rods: [] },
    { // giant sea turtle (archelon): skull, shell, front flippers, back flippers, tail
      parts: [
        [['p', [37, 9, 43, 8, 47, 11, 47, 14, 44, 15, 38, 15]], ['p', [45, 13, 47, 15, 44, 16]], ['x', 42, 10, 1.2]],
        [['l', 11, 12, 15, 6, 1], ['l', 15, 6, 24, 4, 1], ['l', 24, 4, 33, 6, 1], ['l', 33, 6, 37, 12, 1], ['l', 37, 12, 33, 18, 1], ['l', 33, 18, 24, 20, 1], ['l', 24, 20, 15, 18, 1], ['l', 15, 18, 11, 12, 1], ['l', 11, 12, 37, 12, 2]].concat(ribs(15, 33, 3, 5, 13)),
        [['p', [32, 16, 37, 17, 46, 24, 44, 26, 36, 22, 30, 19]]],
        [['p', [14, 17, 18, 18, 13, 24, 9, 26, 8, 24]]],
        [['l', 11, 12, 6, 14, 2], ['l', 6, 14, 2, 17, 1]]
      ], rods: [[20, 20], [30, 18]] },
    { // ocean shark: tooth, jaw, fin, spine, tail
      parts: [
        [['p', [40, 13, 41, 16, 42, 13]], ['p', [42, 13, 43, 16, 44, 13]], ['p', [44, 13, 45, 15, 46, 12]], ['p', [38, 13, 39, 15, 40, 13]]],
        [['p', [34, 8, 41, 7, 46, 9, 47, 11, 45, 13, 37, 14, 33, 12]], ['x', 40, 9, 1.2]],
        [['p', [19, 9, 24, 1, 26, 2, 27, 9]], ['p', [29, 13, 25, 20, 27, 20, 33, 13]], ['p', [13, 12, 11, 16, 15, 12]]],
        [['l', 9, 11, 34, 11, 2]].concat(ticks(11, 33, 2, 11, 2)),
        [['p', [10, 10, 3, 1, 5, 1, 8, 11, 4, 20, 2, 20]]]
      ], rods: [[18, 12], [32, 12]] },
    { // plesiosaur: skull, neck, ribs, paddles, tail
      parts: [
        [['p', [39, 3, 44, 1, 47, 3, 47, 5, 43, 6, 39, 7]], ['x', 42, 3, 0.9]],
        [['l', 30, 16, 32, 10, 3], ['l', 32, 10, 35, 6, 2], ['l', 35, 6, 39, 5, 2]].concat(ticks(32, 36, 2, 8, 1)),
        [['l', 13, 15, 31, 16, 2], ['l', 13, 15, 22, 11, 2]].concat(ribs(15, 29, 3, 12, 9)),
        [['p', [29, 20, 33, 20, 42, 26, 39, 27]], ['p', [25, 21, 28, 21, 34, 27, 31, 27]], ['p', [16, 20, 19, 20, 14, 27, 11, 27]], ['p', [11, 21, 14, 21, 8, 27, 5, 27]]],
        [['l', 13, 15, 6, 17, 2], ['l', 6, 17, 1, 20, 1]]
      ], rods: [[22, 20]] },
    { // sabre-tooth cat: skull, fangs, ribs, legs, tail
      parts: [
        [['p', [32, 6, 39, 4, 44, 7, 46, 10, 43, 12, 34, 12]], ['p', [34, 5, 35, 2, 37, 5]], ['x', 38, 7, 1.2]],
        [['p', [44, 11, 45, 19, 46, 11]], ['p', [40, 12, 41, 19, 42, 12]]],
        [['l', 12, 12, 20, 9, 2], ['l', 20, 9, 32, 10, 2]].concat(ribs(15, 29, 3, 10, 8)),
        [['l', 29, 13, 29, 20, 2], ['l', 29, 20, 30, 27, 2], ['l', 25, 13, 25, 20, 1], ['l', 25, 20, 26, 27, 1], ['l', 15, 13, 13, 19, 3], ['l', 13, 19, 15, 27, 2], ['l', 19, 13, 19, 20, 1], ['l', 19, 20, 20, 27, 1], ['r', 28, 27, 4, 1], ['r', 13, 27, 4, 1]],
        [['l', 12, 12, 6, 9, 2], ['l', 6, 9, 3, 12, 1], ['l', 3, 12, 3, 16, 1]]
      ], rods: [] },
    { // jungle crocodile: skull, jaw, scales, leg, tail
      parts: [
        [['p', [32, 7, 40, 7, 47, 8, 47, 10, 32, 11]], ['x', 34, 8, 1]],
        [['l', 32, 12, 46, 12, 2]].concat(ticks(35, 45, 2, 12, 1)),
        [['l', 13, 9, 32, 9, 2], ['p', [14, 8, 15, 5, 16, 8]], ['p', [18, 8, 19, 5, 20, 8]], ['p', [22, 8, 23, 5, 24, 8]], ['p', [26, 8, 27, 5, 28, 8]], ['p', [30, 8, 31, 6, 32, 8]]],
        [['l', 28, 10, 30, 15, 2], ['l', 30, 15, 33, 17, 1], ['l', 30, 15, 28, 17, 1], ['l', 17, 10, 16, 15, 2], ['l', 16, 15, 19, 17, 1], ['l', 16, 15, 14, 17, 1]],
        [['l', 13, 9, 6, 11, 2], ['l', 6, 11, 0, 14, 1]].concat(ticks(3, 11, 3, 10, 1))
      ], rods: [[18, 10], [30, 10]] },
    { // stegosaurus: skull, plates, ribs, legs, tail spikes
      parts: [
        [['p', [38, 15, 44, 14, 47, 16, 46, 19, 40, 19]], ['x', 42, 16, 1]],
        [['p', [13, 9, 15, 3, 17, 9]], ['p', [18, 8, 21, 0, 24, 8]], ['p', [25, 8, 28, 0, 31, 8]], ['p', [32, 9, 34, 3, 36, 10]], ['p', [10, 11, 11, 6, 13, 10]]],
        [['l', 8, 13, 16, 10, 2], ['l', 16, 10, 28, 9, 2], ['l', 28, 9, 37, 15, 2]].concat(ribs(14, 32, 3, 11, 8)),
        [['l', 16, 14, 16, 27, 3], ['l', 21, 14, 21, 27, 2], ['l', 30, 15, 31, 27, 2], ['l', 34, 16, 35, 27, 2], ['r', 14, 26, 5, 1], ['r', 29, 26, 4, 1]],
        [['l', 8, 13, 4, 18, 2], ['l', 4, 18, 1, 20, 1], ['p', [6, 15, 4, 9, 8, 14]], ['p', [3, 18, 0, 13, 5, 17]], ['p', [5, 20, 0, 22, 5, 17]]]
      ], rods: [] },
    { // moon rover: wheel, antenna, panel, camera, flag
      color: '#b8bcc8', partColor: [null, null, '#7aa8e0', null, '#e74c3c'],
      parts: [
        [['o', 13, 23, 4], ['o', 24, 23, 4], ['o', 35, 23, 4], ['c', 13, 23, 1], ['c', 24, 23, 1], ['c', 35, 23, 1], ['l', 13, 19, 35, 19, 1]],
        [['l', 29, 11, 29, 4, 1], ['p', [26, 4, 32, 1, 33, 5, 28, 6]]],
        [['r', 9, 12, 30, 7], ['r', 6, 9, 36, 2], ['l', 12, 9, 12, 11, 1], ['l', 20, 9, 20, 11, 1], ['l', 28, 9, 28, 11, 1], ['l', 36, 9, 36, 11, 1]],
        [['l', 38, 12, 40, 4, 2], ['r', 37, 1, 7, 4], ['x', 43, 3, 1]],
        [['l', 9, 12, 9, 0, 1], ['r', 10, 0, 8, 5]]
      ], rods: [] },
    { // pterodactyl: skull, crest, wings, body, legs
      parts: [
        [['p', [35, 11, 40, 10, 47, 14, 47, 15, 40, 14, 35, 15]], ['x', 38, 12, 0.9]],
        [['p', [36, 10, 28, 5, 33, 12]]],
        [['p', [22, 12, 12, 3, 0, 9, 5, 10, 6, 14, 12, 12, 16, 15, 22, 15]], ['p', [23, 12, 29, 5, 37, 0, 38, 5, 34, 7, 33, 11, 28, 10, 26, 14]], ['l', 22, 12, 12, 3, 2], ['l', 12, 3, 3, 13, 1]],
        [['c', 24, 15, 3], ['l', 26, 13, 35, 12, 2], ['l', 23, 13, 17, 17, 2]],
        [['l', 22, 18, 20, 24, 1], ['l', 20, 24, 17, 25, 1], ['l', 25, 18, 25, 24, 1], ['l', 25, 24, 28, 25, 1]]
      ], rods: [[22, 24]] },
    { // brachiosaurus: skull, neck, ribs, legs, tail
      parts: [
        [['p', [36, 2, 41, 0, 46, 2, 46, 5, 41, 6, 37, 5]], ['p', [37, 1, 39, 0, 40, 2]], ['x', 42, 3, 0.9]],
        [['l', 27, 12, 30, 6, 3], ['l', 30, 6, 34, 3, 3], ['l', 34, 3, 37, 3, 2]].concat(ticks(29, 33, 2, 6, 1)),
        [['l', 9, 12, 18, 9, 2], ['l', 18, 9, 29, 11, 2]].concat(ribs(11, 28, 3, 10, 9)),
        [['l', 27, 14, 27, 27, 3], ['l', 31, 14, 32, 27, 2], ['l', 14, 14, 14, 27, 3], ['l', 19, 14, 20, 27, 2], ['r', 25, 27, 5, 1], ['r', 12, 27, 5, 1]],
        [['l', 9, 12, 5, 15, 2], ['l', 5, 15, 1, 20, 1]]
      ], rods: [] },
    { // glorpatops, an alien triceratops: skull, horns, frill, legs, tail
      color: '#bff0c8',
      parts: [
        [['p', [32, 13, 38, 11, 44, 14, 47, 18, 42, 21, 34, 20]], ['p', [44, 18, 47, 22, 42, 21]]],
        [['p', [36, 11, 37, 3, 40, 11]], ['p', [40, 12, 43, 5, 43, 13]], ['p', [44, 14, 47, 9, 47, 15]], ['p', [23, 6, 20, 2, 26, 4]], ['p', [29, 2, 30, 0, 33, 2]], ['p', [35, 4, 38, 2, 37, 7]]],
        [['p', [27, 20, 22, 12, 23, 6, 29, 2, 35, 3, 38, 8, 36, 14, 33, 19]], ['x', 27, 7, 1.3], ['x', 31, 5, 1.3], ['x', 33, 10, 1.3]],
        [['l', 11, 17, 31, 17, 3], ['l', 14, 18, 14, 27, 3], ['l', 19, 18, 19, 27, 2], ['l', 26, 18, 26, 27, 3], ['l', 31, 18, 31, 27, 2], ['r', 12, 27, 5, 1], ['r', 24, 27, 5, 1]],
        [['l', 11, 17, 5, 20, 2], ['l', 5, 20, 1, 19, 1]]
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
,
    { // space ankylosaur: skull, armour, ribs, legs, club tail
      color: '#c8b8ff',
      parts: [
        [['p', [38, 16, 44, 15, 47, 17, 47, 20, 40, 21]], ['x', 43, 17, 0.9]],
        [['p', [12, 17, 15, 10, 23, 8, 32, 9, 37, 14, 37, 17]], ['c', 17, 10, 1.4], ['c', 23, 8, 1.4], ['c', 29, 8, 1.4], ['c', 34, 12, 1.4], ['p', [14, 16, 10, 13, 15, 13]], ['p', [36, 15, 40, 12, 38, 17]], ['l', 15, 13, 34, 13, 1]],
        [['l', 14, 18, 36, 18, 2]].concat(ribs(15, 33, 3, 17, 5)),
        [['l', 14, 20, 14, 27, 3], ['l', 20, 20, 20, 27, 2], ['l', 29, 20, 29, 27, 3], ['l', 34, 20, 35, 27, 2], ['r', 12, 27, 5, 1], ['r', 27, 27, 5, 1]],
        [['l', 12, 15, 6, 18, 2], ['c', 4, 19, 3], ['p', [2, 16, 4, 13, 5, 17]], ['p', [0, 20, 0, 24, 3, 22]]]
      ], rods: [] }

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
  // draw exhibit k (0-14, world*3 + creature) with its five piece counts, standing on a plinth top at screen (x, y); s is screen pixels per art pixel
  // a solid one-colour silhouette of piece i of exhibit k (all five when i < 0), used to light up a missing piece or flash a new one
  var hcache = {};
  function hiCanvas(k, i, col) {
    var key = k + '|' + i + col;
    if (hcache[key]) return hcache[key];
    var E = EXHIBITS[k], out = canvas(EW + 2, EH + 2), oc = out.getContext('2d');
    oc.translate(1, 1); oc.fillStyle = '#fff';
    E.parts.forEach(function (part, j) { if (i < 0 || j === i) part.forEach(function (sh) { shape(oc, sh); }); });
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalCompositeOperation = 'source-in'; oc.fillStyle = col; oc.fillRect(0, 0, EW + 2, EH + 2);
    return (hcache[key] = out);
  }
  // piece i of exhibit k on its own, shaded in its colour and outlined, cropped to its bounds (for big fossils in the ground)
  var pcache = {};
  function pieceCanvas(k, i) {
    var key = k + '|' + i;
    if (pcache[key]) return pcache[key];
    var E = EXHIBITS[k], m = canvas(EW, EH), mc = m.getContext('2d'), base = (E.partColor && E.partColor[i]) || E.color || '#e2d6b8';
    mc.fillStyle = '#fff'; E.parts[i].forEach(function (s) { shape(mc, s); });
    shadeMask(mc, EW, EH, base, hexShade(base, 0.45), hexShade(base, -0.28));
    var d = mc.getImageData(0, 0, EW, EH).data, x0 = EW, y0 = EH, x1 = -1, y1 = -1;
    for (var y = 0; y < EH; y++) for (var x = 0; x < EW; x++) if (d[(y * EW + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
    var w = x1 - x0 + 3, h = y1 - y0 + 3, out = canvas(w, h), oc = out.getContext('2d');
    oc.drawImage(m, x0, y0, w - 2, h - 2, 1, 1, w - 2, h - 2);
    var od = oc.getImageData(0, 0, w, h).data, solid = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && od[(y * w + x) * 4 + 3] > 0; };
    oc.fillStyle = '#3a2c22';
    for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) if (!solid(x2, y2) && (solid(x2 - 1, y2) || solid(x2 + 1, y2) || solid(x2, y2 - 1) || solid(x2, y2 + 1))) oc.fillRect(x2, y2, 1, 1);
    return (pcache[key] = out);
  }
  // hi (optional): {i: piece to light (-1 for all), a: 0-1 strength, col: colour}, drawn over the exhibit
  function exhibit(c, k, pieces, open, x, y, s, hi) {
    if (!open) return;
    var have = pieces.map(function (n) { return n > 0 ? 1 : 0; }), ec = exhibitCanvas(k, have);
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(ec, Math.round(x - ec.width * s / 2), Math.round(y - ec.height * s), Math.round(ec.width * s), Math.round(ec.height * s));
    if (hi && hi.a > 0) {
      c.globalAlpha = Math.min(1, hi.a);
      c.drawImage(hiCanvas(k, hi.i, hi.col || '#ffe27a'), Math.round(x - ec.width * s / 2), Math.round(y - ec.height * s), Math.round(ec.width * s), Math.round(ec.height * s));
    }
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
    var shape = kind === 'ore' ? (idx >= 3 ? 'gem' : 'lump') : kind === 'fossil' ? (moon ? 'wheel' : 'bone') : kind === 'relic' ? 'star' : 'chest';
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
    PICK: PICK, hexShade: hexShade, item: item, pieceCanvas: pieceCanvas,
    miner: function (o) { o.P = BASE; return person(o); },
    helper: function (k, o) { o.P = HELPERS[k % HELPERS.length]; o.look = HELPER_LOOK[k % HELPERS.length]; return person(o); },
    npc: npc, exhibit: exhibit, swing: swing, walkPose: walkPose, STEP_X: STEP_X,
    BODY_H: 38 // pixel height of a character, feet to hat
  };
})();
