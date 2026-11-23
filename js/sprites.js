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
  // The walking figure's torso has no arms below the shoulders: person() draws both arms as limbs that swing, so a
  // sleeve left in the grid would show as a second, static arm beside the moving one. The climber keeps the full grid.
  function armless(g) { return g.map(function (r, i) { return i < 4 || i > 7 ? r : r.split('').map(function (ch, x) { return x < 9 || x > 16 ? ' ' : ch; }).join(''); }); }
  var TORSO_BODY = armless(TORSO), TORSO_BODY_BACK = armless(TORSO_BACK);
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
    // jungle: a wild jungle kid, bare-armed and barefoot, with long shaggy hair and a leaf headband, a spotted
    // hide wrap and shorts tied with a vine, and a coil of vine rope over one shoulder for swinging through the trees
    pal({ S: '#c88a5a', s: '#a86e44', k: '#80502e', H: '#3a2414', h: '#22140a', R: '#c88a5a', r: '#a86e44', q: '#80502e',
      B: '#e8b04a', b: '#c88a2a', n: '#8a5a1a', G: '#5a3412', x: '#3f8a2a', T: '#c88a5a', t: '#a86e44', v: '#80502e' }),
    // moon: an astronaut in a white suit and helmet with a dark visor
    pal({ Y: '#ffffff', y: '#e4e8f0', u: '#a8b0c4', l: '#5a5a66', H: '#f4f6fa', h: '#c8cedc', R: '#f4f6fa', r: '#d0d6e2', q: '#9aa2b4', B: '#e8ecf4', b: '#c0c8d8', n: '#8a94aa', G: '#ff6b3a',
      T: '#8a94aa', t: '#5a6478', v: '#3a4256', x: '#5a6478' }),
    // Planet Glorp: a green alien with big dark eyes and antennae, in a purple suit
    pal({ S: '#9dff6a', s: '#6ad84a', k: '#3a9a2a', H: '#9dff6a', h: '#6ad84a', e: '#1a0a2a', w: '#d0b8ff', c: '#6ad84a', m: '#2a6a1a', R: '#b07aff', r: '#8a50e0', q: '#5a2ab0', B: '#7a4ad0', b: '#5a30a8', n: '#3a1a78', G: '#ff5ad0',
      T: '#5a30a8', t: '#3a1a78', v: '#220a50' })
  ];
  var HELPER_LOOK = [null, null, 'mer', 'wild', 'astro', 'alien'];
  // the museum quiz visitor: a professor in a white coat with white hair and purple trousers
  var PROF = pal({ H: '#eeeef4', h: '#b8b8c8', R: '#ffffff', r: '#d8d8e4', q: '#a8a8bc', B: '#6a4aa8', b: '#4e3484', n: '#34235e', G: '#ffd23f' });
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
  // opt: { splash: broad glowing hammer head, hand: 'near' | 'far' (one hand on this pick, dual-wielding; default both) }
  function pickTool(c, X, Y, sw, tier, P, t, opt) {
    opt = opt || {};
    var C = PICK[tier], g = grip(X, Y, sw), ca = g.ca, sa = g.sa, ex = g.ex, ey = g.ey;
    if (sw.smear) { // a pale arc where the head has just been: one or two frames of the strike
      var h0 = sw.smear.from, h1 = sw.ang, k;
      for (k = 0; k < 6; k++) {
        var aa = h0 + (h1 - h0) * k / 6, ab = h0 + (h1 - h0) * (k + 1) / 6, rr = 15 + 6;
        line(c, g.nx + Math.cos(aa) * rr, g.ny + Math.sin(aa) * rr, g.nx + Math.cos(ab) * rr, g.ny + Math.sin(ab) * rr, k < 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)', k < 3 ? 1 : 2);
      }
    }
    var mx = (g.fx + g.nx) / 2, my = (g.fy + g.ny) / 2;                                 // one hand grips at the middle of the handle
    if (opt.hand === 'far') line(c, X + 8, Y + 3, mx, my, P.q, 2);
    else if (opt.hand !== 'near') line(c, X + 8, Y + 3, g.fx, g.fy, P.q, 2);           // far arm
    line(c, g.bx, g.by, ex, ey, C.handle, 2);
    var nx = -sa, ny = ca;                                                            // head across the handle end, point on the +n side
    if (opt.splash) { // a broad hammer-pick: a block head across the handle end with glowing ember tips
      line(c, ex - nx * 7, ey - ny * 7, ex + nx * 7, ey + ny * 7, C.head, 4);
      line(c, ex - nx * 7 - ca * 2, ey - ny * 7 - sa * 2, ex + nx * 6 - ca * 2, ey + ny * 6 - sa * 2, C.hi, 1);
      var hot = Math.sin(t * 9) > 0 ? '#ffd23f' : '#ff8a2a';
      px(c, ex - nx * 8 - 1, ey - ny * 8 - 1, hot, 3, 3); px(c, ex + nx * 8 - 1, ey + ny * 8 - 1, hot, 3, 3);
    } else {
      line(c, ex - nx * 5, ey - ny * 5, ex + nx * 6, ey + ny * 6, C.head, 2);
      line(c, ex + nx * 6, ey + ny * 6, ex + nx * 8 - ca * 2, ey + ny * 8 - sa * 2, C.head, 1);
      line(c, ex - nx * 5 - ca, ey - ny * 5 - sa, ex + nx * 4 - ca, ey + ny * 4 - sa, C.hi, 1);
    }
    if (tier === 4 && Math.sin(t * 8) > 0.6) px(c, ex, ey - 3, '#ffffff');
    if (opt.hand === 'far') { px(c, mx - 1, my - 1, P.s, 3, 3); return; }
    line(c, X + 15, Y + 3, g.nx, g.ny, P.r, 3); line(c, X + 15, Y + 3, g.nx, g.ny, P.R, 2); // near arm
    if (opt.hand === 'near') { px(c, g.nx - 1, g.ny - 1, P.S, 3, 3); px(c, g.nx - 1, g.ny + 1, P.s, 3, 1); return; }
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
    return { f: f, side: !!side, arm: lerp(1), reach: lerp(2), ang: lerp(3), body: held(4), lean: held(5), stance: held(6),
             smear: striking ? { from: a[0] === 0.62 ? a[3] : K[3][3] } : null };
  }
  // ---------- the walk cycle ----------
  // Built from human gait, not drawn as poses. One cycle is two steps; cyc runs 0..1 over it; the near leg strikes
  // the ground at cyc 0, the far leg at 0.5. Each foot is planted for ST (60%) of its cycle, sliding back at the
  // body's speed (STEP_X sprite pixels per step, so callers advance cyc by one per 2 * STEP_X pixels of ground and
  // the feet do not skate), then swings forward for 40%, lifted most early in the swing. Each leg is a thigh and a
  // shin joined at a knee that only bends forward (two-bone IK), so the shin trails the knee as the foot swings
  // through. The hips ride as high as the planted legs reach, so the body is lowest at heel strike, when both feet
  // are down and spread, and highest as the legs pass. Each arm swings against the leg on its own side, about its
  // shoulder, the elbow bending more as the arm comes forward.
  // The camera sees a three-quarter view: facing on, the sprite looks down-right, its right side (screen left) is
  // nearest, and forward runs right and half as much down the screen; facing away it looks up-right, its right side
  // is at screen right, and forward runs up and a little right (proj). The far leg and arm stand a pixel higher, further off.
  var STEP_X = 7, ST = 0.6, LEG = 7, THIGH = 3.5, SHIN = 3.6, STRIDE = ST * STEP_X, LIFT = 2.6, ARM_SWING = 0.45;
  function foot(p, gait) {
    var u = ((p % 1) + 1) % 1, A = STRIDE * gait;
    if (u < ST) return { x: A * (1 - 2 * u / ST), lift: 0, down: true };
    var s = (u - ST) / (1 - ST);
    return { x: -A + 2 * A * ease(s), lift: LIFT * gait * Math.sin(Math.PI * Math.pow(s, 0.75)), down: false };
  }
  // the hips sink as far as the planted legs need to reach their feet
  function walkPose(cyc, gait) {
    var drop = 0;
    [foot(cyc, gait), foot(cyc + 0.5, gait)].forEach(function (f) { if (f.down) drop = Math.max(drop, LEG - Math.sqrt(Math.max(0, LEG * LEG - f.x * f.x))); });
    return { cyc: cyc, gait: gait, bob: Math.round(drop), body: 0 };
  }
  // the knee of a leg from the hip (0, 0) to the ankle (f, v), f forward and v down: it bends forward, never back
  function knee(f, v) {
    var d = Math.sqrt(f * f + v * v) || 1, a = Math.min(d, THIGH + SHIN) * THIGH / (THIGH + SHIN), k = Math.sqrt(Math.max(0, THIGH * THIGH - a * a));
    return { f: f / d * a + v / d * k, v: v / d * a - f / d * k };
  }
  // a sagittal point (f forward, v down) seen from the camera: s is 1 facing on (the body drawn three-quarter, so
  // forward is mostly across the screen), -1 facing away (the body drawn nearly from behind, so forward is mostly up)
  function proj(x0, y0, f, v, s) { return s > 0 ? [x0 + 0.9 * f, y0 + v + 0.45 * f] : [x0 + 0.45 * f, y0 + v - 0.5 * f]; }
  // one leg: the hip at (hx, hy) (its centre), the boot's lower row on gy; dx moves the foot forward, lift raises it.
  // The thigh and shin go on as 4-pixel spans, outlined first so a leg in front reads against the one behind.
  var LEG_NEAR = ['b', 'B', 'B', 'n'], LEG_FAR = ['n', 'b', 'b', 'n'];
  function leg(c, P, hx, hy, gy, dx, lift, near, s) {
    var cols = near ? LEG_NEAR : LEG_FAR, av = gy - 2 - Math.round(lift) - hy, K = knee(dx, av);
    var H = [hx, hy], Kp = proj(hx, hy, K.f, K.v, s), A = proj(hx, hy, dx, av, s);
    A = [Math.round(A[0]), Math.round(A[1])];
    var pts = [];
    [[H, Kp], [Kp, A]].forEach(function (seg) {
      var x0 = seg[0][0], y0 = seg[0][1], x1 = seg[1][0], y1 = seg[1][1], n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
      for (var i = 0; i <= n; i++) pts.push([Math.round(x0 + (x1 - x0) * i / n - 1.5), Math.round(y0 + (y1 - y0) * i / n)]);
    });
    pts.forEach(function (q) { px(c, q[0] - 1, q[1], OUT, 6, 1); });
    pts.forEach(function (q) { for (var i = 0; i < 4; i++) px(c, q[0] + i, q[1], P[cols[i]]); });
    var fx = A[0] - 2, by = A[1] + 1; // the boot: heel under the ankle, toe forward
    px(c, fx - 1, by - 1, OUT, 7, 3);
    px(c, fx, by, P[near ? 'T' : 't'], 4, 1); px(c, fx + 4, by, P.t);
    px(c, fx, by + 1, P[near ? 't' : 'v'], 3, 1); px(c, fx + 3, by + 1, P.v, 2, 1);
  }
  // an arm from the shoulder (sx, sy) swung th radians forward (negative back), the elbow bent by flex more as it
  // comes forward; ol: outlined, for the near arm laid over the body
  function arm(c, sx, sy, th, sleeve, skin, w, s, ol) {
    var flex = 0.15 + Math.max(0, th) * 0.6, e = proj(sx, sy, Math.sin(th) * 3.6, Math.cos(th) * 3.6, s);
    var h = proj(e[0], e[1], Math.sin(th + flex) * 3.2, Math.cos(th + flex) * 3.2, s);
    if (ol) { line(c, sx, sy, e[0], e[1], OUT, w + 2); line(c, e[0], e[1], h[0], h[1], OUT, w + 2); px(c, h[0] - (w > 2 ? 2 : 1), h[1], OUT, w + 2, 4); }
    line(c, sx, sy, e[0], e[1], sleeve, w); line(c, e[0], e[1], h[0], h[1], sleeve, w);
    px(c, h[0] - (w > 2 ? 1 : 0), h[1] + 1, skin, w > 2 ? 3 : 2, 2);
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
    var L = b.gold ? '#ffe27a' : b.moon ? '#d4d8e2' : '#f3e6c4', D = b.gold ? '#c8921a' : b.moon ? '#8a90a0' : '#c9b48a', E = '#4a3a2e';
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
    var X0 = FX - 12, legY = FY - 9 + Math.round(pose.bob), Y = legY - 11 + Math.round(pose.body), X = X0 + Math.round(pose.lean);
    var look = o.look || null, bare = o.hair || look === 'mer' || look === 'alien' || look === 'wild';
    var head = bare ? (back ? HEAD_HAIR_BACK : HEAD_HAIR) : (back ? HEAD_MINER_BACK : HEAD_MINER);
    var Pl = P; if (!o.lampOn && !bare) { Pl = pal(P); Pl.L = '#cfc58a'; }
    if (pose.blink && !back) { Pl = Pl === P ? pal(P) : Pl; Pl.e = Pl.k; Pl.w = Pl.S; }
    if (o.climb != null) return climber(o, P, Pl, X0, legY + 2, head);
    // legs: each foot follows the walk cycle (planted, then lifted and swung forward); in the air they spread
    var gait = pose.gait || 0, cyc = pose.cyc || 0, ap = Math.round(pose.air * 2), gy = FY - 2;
    var fN = foot(cyc, gait), fF = foot(cyc + 0.5, gait);
    var air = pose.air > 0.3, sw = o.swing || null, digging = sw != null && !air, st = digging ? sw.stance : 0;
    var behind = back && digging; // facing away, the pick and arms are behind the body
    // each arm swings against the leg on its own side: forward as that foot goes back
    var sv = back ? -1 : 1, Wv = gait * ARM_SWING, thN = Wv * Math.cos(2 * Math.PI * cyc + Math.PI), thF = -thN;
    var aN = Math.round(Math.sin(thN) * 6);
    // facing on the near (right) shoulder is at screen left; facing away at screen right. The far one sits a pixel higher.
    var shN = back ? [X + 17, Y + 2] : [X + 6, Y + 2], shF = back ? [X + 6, Y + 1] : [X + 17, Y + 1];
    var wave = o.arms === 'wave' && !digging, freeN = !(back && (inHandEarly() || wave)), freeF = !(!back && (inHandEarly() || wave));
    function inHandEarly() { return o.carry && !sw && !air && !o.surface; }
    if (o.bone && !back) bone(c, X, Y, o.bone, false);                                    // strapped behind the pack
    if (hasPack && !back) packSide(c, X - 6, Y - 6, o.pack);
    var sw2 = o.twin && sw ? swing(sw.f + 0.5, sw.side) : null; // Twin Picks: the second pick half a cycle behind
    var O1 = { splash: o.splash, hand: o.twin ? 'near' : null }, O2 = { splash: o.splash, hand: 'far' };
    if (behind) { if (sw2) pickTool(c, X, Y, sw2, o.tier, P, t, O2); pickTool(c, X, Y, sw, o.tier, P, t, O1); }
    else if (!digging && !air && freeF) arm(c, shF[0], shF[1], thF, P.q, P.k, 2, sv, false); // far arm, behind the body
    // not digging: in the mine the pick is in the near hand, held by its neck; on the plaza (o.surface) it is slung
    // on the back by a strap and both arms swing free
    var carry = o.carry && !sw && !air, stow = carry && o.surface, inHand = carry && !o.surface;
    var cg = Math.round(aN / 3); // carrying, the hand on the handle sways a little
    function handPick(front) {
      var C = PICK[o.tier];
      if (front) { // facing on: the head upright in front of the hand at the hip, the handle trailing back across the legs
        var gx = X + 19 + cg, gy = Y + 8;
        line(c, gx, gy, X + 7 + cg, Y + 13, C.handle, 2);
        line(c, gx + 2, gy - 6, gx + 2, gy + 5, C.head, o.splash ? 4 : 2); line(c, gx + 2, gy + 5, gx + 1, gy + 7, C.head, 1);
        px(c, gx + 2, gy - 6, C.hi, 1, 9);
        if (o.splash) { px(c, gx + 1, gy - 8, '#ffd23f', 3, 2); px(c, gx + 1, gy + 5, '#ff8a2a', 3, 2); }
        return;
      }
      // facing away: hanging by the near side, the head across the fist and the handle straight down
      var hx = X + 21 + cg, hy = Y + 8;
      line(c, hx, hy, hx, Y + 14, C.handle, 2);
      line(c, hx - 5, hy - 1, hx + 6, hy - 1, C.head, o.splash ? 4 : 2); if (o.splash) { px(c, hx - 7, hy - 2, '#ffd23f', 2, 3); px(c, hx + 6, hy - 2, '#ff8a2a', 2, 3); }
      line(c, hx + 6, hy - 1, hx + 8, hy + 1, C.head, 1); px(c, hx - 5, hy - 2, C.hi, 9, 1);
      px(c, hx - 1, hy - 3, P.S, 3, 3); px(c, hx - 1, hy - 1, P.s, 3, 1);                     // the fist; the arm is under the pack
    }
    function slungPick(front, dx) {
      var C = PICK[o.tier], hw = o.splash ? 4 : 2; dx = dx || 0;
      if (front) { line(c, X - 5 + dx, Y - 13, X + 3 + dx, Y - 21, C.head, hw); px(c, X + 3 + dx, Y - 22, C.hi); px(c, X - 6 + dx, Y - 12, C.hi); line(c, X + 17 + dx, Y + 10, X - 1 + dx, Y - 17, C.handle, 2); return; }
      // facing away it lies across the back, from the far hip up over the near shoulder
      line(c, X + 4 - dx, Y + 13, X + 21 - dx, Y - 4, C.handle, 2);
      line(c, X + 17 - dx, Y - 8, X + 26 - dx, Y + 1, C.head, hw); line(c, X + 26 - dx, Y + 1, X + 27 - dx, Y + 3, C.head, 1); px(c, X + 17 - dx, Y - 9, C.hi, 2, 1);
    }
    if (stow && !back) slungPick(true);
    if (o.twin && !digging && !air && !back) slungPick(true, 6);                  // Twin Picks: the spare rides on the back
    // the hips sit inside the shorts, two rows up; the near leg is on the near side and the far one a pixel higher
    var hipN = back ? X0 + 15 : X0 + 9, hipF = back ? X0 + 9 : X0 + 15;
    leg(c, P, hipF, legY - 3, gy - 1, fF.x - ap - st, fF.lift, false, sv);
    leg(c, P, hipN, legY - 2, gy, fN.x + ap + st, fN.lift, true, sv);
    stamp(c, back ? TORSO_BODY_BACK : TORSO_BODY, P, X, Y);
    if (air) { px(c, X + 4, Y - 7, P.r, 2, 9); px(c, X + 20, Y - 7, P.r, 2, 9); px(c, X + 4, Y - 9, P.S, 2, 2); px(c, X + 20, Y - 9, P.S, 2, 2); }
    if ((hasPack || stow) && !back) line(c, X + 9, Y + 1, X + 11, Y + 8, PACK.k, 1); // shoulder strap
    // seen from behind the near arm goes on before the head and the pack, which cover it
    if (back && !digging && !air && freeN) arm(c, shN[0], shN[1], thN, P.r, P.S, 3, sv, false);
    if (back && inHand) { line(c, X + 16, Y + 2, X + 21 + cg, Y + 5, P.r, 3); line(c, X + 16, Y + 2, X + 21 + cg, Y + 5, P.R, 2); }
    // facing on, the swing goes on before the head, so the pick passes behind it when raised and never across the face
    if (inHand && !back) handPick(true);
    if (digging && !behind) { if (sw2) pickTool(c, X, Y, sw2, o.tier, P, t, O2); pickTool(c, X, Y, sw, o.tier, P, t, O1); }
    stamp(c, head, Pl, X, Y - 17);
    if (look) headExtras(c, look, X, Y - 17, back, Pl);
    if (digging && !behind && fistsClearOfHead(X, Y, sw)) pickFists(c, X, Y, sw, P);
    if (o.bone && back) bone(c, X, Y, o.bone, true);
    if (hasPack && back) packBack(c, X + 12, Y - 4, o.pack);
    if (stow && back) slungPick(false);
    if (o.twin && !digging && !air && back) slungPick(false, 6);
    if (inHand && back) handPick(false);
    if (o.arms === 'wave' && !digging) { var wv = Math.sin(t * 10) > 0 ? 1 : 0; px(c, X + 19, Y - 3 - wv, P.r, 2, 6); px(c, X + 19 + wv, Y - 5 - wv, P.S, 2, 2); }
    else if (!back && !digging && !air && inHand) { // near arm bent up, the fist round the handle at the chest
      var hx = X + 19 + cg; line(c, X + 15, Y + 3, hx, Y + 7, P.r, 3); line(c, X + 15, Y + 3, hx, Y + 7, P.R, 2);
      px(c, hx - 1, Y + 7, P.S, 3, 3); px(c, hx - 1, Y + 9, P.s, 3, 1);
    }
    if (!back && !digging && !air && freeN) arm(c, shN[0], shN[1], thN, P.r, P.S, 3, sv, true);
    outline(c, W, H, OUT);
    if (o.bowl) bowl(c, X + 13, Y - 8);
    // lx, ly: the centre of the helmet lamp (the L pixels of HEAD_MINER); facing away, the hat's front edge
    return { cv: cv, fx: FX, fy: FY, lx: back ? X + 19 : X + 22, ly: Y - 17 + (back ? 5 : 6) };
  }
  // The round glass diving helmet worn under the sea (o.bowl), drawn over the finished, outlined figure about the
  // head's centre (cx, cy): faint glass, a pale rim with a dark edge, a shine at the upper left and a brass collar.
  function bowl(c, cx, cy) {
    var R = 14.5;
    for (var y = Math.floor(cy - R - 1); y <= Math.ceil(cy + R + 1); y++) for (var x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x++) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (dy > 8.5) continue; // open at the neck: the collar closes it
      if (d > R + 1) continue;
      if (d > R) px(c, x, y, 'rgba(18,30,52,0.85)');
      else if (d > R - 1) px(c, x, y, 'rgba(205,244,255,0.9)');
      else { px(c, x, y, 'rgba(150,220,255,0.16)'); if (d > R - 3.2 && d < R - 1.8 && dx < -2 && dy < -2) px(c, x, y, 'rgba(255,255,255,0.75)'); }
    }
    px(c, cx - 4, cy - 9, 'rgba(255,255,255,0.9)', 2, 2); // a glint
    var y0 = Math.round(cy + 8.5), x0 = Math.round(cx - 7);
    px(c, x0 - 1, y0 - 1, '#2a1c0c', 16, 4); px(c, x0, y0, '#c8962e', 14, 2); px(c, x0, y0, '#ffe08a', 14, 1);
    px(c, x0 + 3, y0 + 1, '#6b4a14'); px(c, x0 + 10, y0 + 1, '#6b4a14'); // rivets
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
    } else if (look === 'wild') { // shaggy locks down past the shoulders, a leaf headband, a vine coiled on the shoulder
      var LF = '#4fae3a', lf = '#2f7a22', VN = '#3f8a2a';
      if (!back) {
        px(c, hx + 3, hy + 14, P.h, 3, 7); px(c, hx + 4, hy + 20, P.h, 2, 2); px(c, hx + 6, hy + 16, P.H, 2, 5); px(c, hx + 2, hy + 12, P.H, 2, 5);
        px(c, hx + 5, hy + 7, lf, 15, 1); px(c, hx + 4, hy + 4, LF, 3, 3); px(c, hx + 6, hy + 3, LF, 2, 2); px(c, hx + 5, hy + 5, lf);
        px(c, hx + 9, hy - 1, P.H, 2, 2); px(c, hx + 13, hy - 1, P.h, 2, 2); // spiky crown
        line(c, hx + 9, hy + 18, hx + 18, hy + 26, VN, 2); // the vine rope across the chest
        px(c, hx + 6, hy + 17, VN, 5, 2); px(c, hx + 5, hy + 19, VN, 2, 3); px(c, hx + 7, hy + 18, '#6ccf4a', 2, 1);
      } else {
        px(c, hx + 5, hy + 14, P.h, 14, 5); px(c, hx + 6, hy + 19, P.h, 3, 2); px(c, hx + 11, hy + 19, P.H, 3, 3); px(c, hx + 16, hy + 19, P.h, 2, 2);
        px(c, hx + 3, hy + 7, lf, 18, 1); px(c, hx + 17, hy + 5, LF, 3, 3);
        line(c, hx + 6, hy + 18, hx + 17, hy + 27, VN, 2);
      }
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
    if (o.bowl) bowl(c, X0 + 13, Y - 8);
    return { cv: cv, fx: FX, fy: FY, lx: X0 + 11, ly: Y - 14 };
  }
  // cached frames for the people walking about the plaza (no pickaxe): moving, frame 0..7 is the walk cycle in eighths
  var cache = {};
  function npc(kind, seed, back, frame, moving, t, helm) {
    var key = (helm ? 'b|' : '') + kind + '|' + seed + '|' + (back ? 1 : 0) + '|' + frame + '|' + (moving ? 1 : 0) + (kind === 'keeper' ? '|' + (Math.sin(t * 10) > 0 ? 1 : 0) : '');
    if (cache[key]) return cache[key];
    var P = kind === 'guide' ? GUIDE : kind === 'keeper' ? KEEPER : kind === 'prof' ? PROF : visitorPal(seed);
    var pose = moving ? walkPose((frame & 7) / 8, 1) : { bob: 0, body: frame & 1 ? 1 : 0, gait: 0, cyc: 0, blink: frame === 3 };
    pose.lean = 0; pose.air = 0;
    person({ back: back, pose: pose, ang: null, P: P, hair: true, arms: kind === 'keeper' || (kind === 'prof' && seed === 1) ? 'wave' : '', bowl: !!helm, t: t });
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
  var GOLD_BONE = '#f0b82a';
  function exhibitCanvas(k, have, gold) {
    var key = k + '|' + have.join('') + (gold ? '|' + gold.join('') : '');
    if (ecache[key]) return ecache[key];
    var E = EXHIBITS[k], out = canvas(EW + 2, EH + 2), oc = out.getContext('2d'), m = canvas(EW, EH), mc = m.getContext('2d');
    oc.translate(1, 1);
    // support rods from the plinth
    E.rods.forEach(function (r) { line(oc, r[0], r[1], r[0], EH - 1, '#4a4a56', 1); px(oc, r[0] - 1, EH - 1, '#4a4a56', 3, 1); });
    E.parts.forEach(function (part, i) {
      mc.clearRect(0, 0, EW, EH); mc.fillStyle = '#fff';
      part.forEach(function (s) { shape(mc, s); });
      if (have[i]) {
        var base = gold && gold[i] ? GOLD_BONE : (E.partColor && E.partColor[i]) || E.color || '#e2d6b8';
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
  function pieceCanvas(k, i, gold) {
    var key = k + '|' + i + (gold ? 'g' : '');
    if (pcache[key]) return pcache[key];
    var E = EXHIBITS[k], m = canvas(EW, EH), mc = m.getContext('2d'), base = gold ? GOLD_BONE : (E.partColor && E.partColor[i]) || E.color || '#e2d6b8';
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
  // gold (optional): the five gold counts; a piece with one is drawn in gold
  function exhibit(c, k, pieces, open, x, y, s, hi, gold) {
    if (!open) return;
    var gl = gold && gold.some(function (n) { return n > 0; }) ? gold.map(function (n) { return n > 0 ? 1 : 0; }) : null;
    var have = pieces.map(function (n, i) { return n > 0 || (gl && gl[i]) ? 1 : 0; }), ec = exhibitCanvas(k, have, gl);
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(ec, Math.round(x - ec.width * s / 2), Math.round(y - ec.height * s), Math.round(ec.width * s), Math.round(ec.height * s));
    if (hi && hi.a > 0) {
      c.globalAlpha = Math.min(1, hi.a);
      c.drawImage(hiCanvas(k, hi.i, hi.col || '#ffe27a'), Math.round(x - ec.width * s / 2), Math.round(y - ec.height * s), Math.round(ec.width * s), Math.round(ec.height * s));
    }
    c.restore();
  }

  // ---------- plaza creatures: reward guests and ambient animals ----------
  // Small letter-grid sprites facing right, outlined like the characters. A is the first idle frame; B replaces
  // some rows of it (an object keyed by row) or gives the whole second frame (an array). render.js flips them,
  // bobs them and sets the pace; nothing here is random.
  var CRT = {
    // ---- reward guests ----
    fox: { P: { a: '#e8742a', d: '#b24d14', w: '#fff0dc', k: '#2a1a14', e: '#1e1426' },
      A: ['         k  k  ', '        aaaaaa ', '        aadeaaa', '    a  aaawwwwk', '   aaaaaaaawww ', '  aaaaaaaaaaa  ', ' waaaaaaaaaaad ', 'wwaadaaaaaadd  ', ' w  aa    aa   ', '    kk    kk   '],
      B: { 0: '        k  k   ', 3: '  a   aaawwwwk', 4: ' aaaaaaaaaawww ', 5: 'waaaaaaaaaaa   ', 6: 'wwaaaaaaaaaad  ', 7: ' waadaaaaaadd  ' } },
    hedgehog: { P: { b: '#7a5a3c', s: '#4a3626', l: '#a08060', f: '#f0d8b8', e: '#1e1426', n: '#2a1a14' },
      A: ['    s s s s     ', '  s s s s s s   ', ' s s s s s s s  ', ' sbsbsbsbsbs    ', 'sbsbsbsbsbsbs   ', 'sbsbsbsbsbsbfff ', 'sbsbsbsbsbffefn ', ' sbsbsbsbsfffff ', '  bbbbbbbbfff   ', '    ll   ll     '],
      B: { 1: '  s s s s s s s ', 3: ' bsbsbsbsbsb    ', 6: 'sbsbsbsbsbffefn ' } },
    frog: { P: { g: '#4fbf3a', d: '#2f8f2a', l: '#a8f08a', e: '#1e1426', w: '#ffffff', r: '#ff7a8a' },
      A: ['  wew   wew     ', ' gggg   gggg    ', ' gggggggggggg   ', 'gggggggggggggg  ', 'gggeggggggeggg  ', 'gglllllllllllg  ', ' gglllllllllg   ', '  dgggggggggd   ', ' ddd         ddd'],
      B: ['  wew   wew     ', ' gggg   gggg    ', ' gggggggggggg   ', 'gggggggggggggg  ', 'gggeggggggeggg  ', 'grrrrrrrrrrrg   ', ' gglllllllllg   ', '  dgggggggggd   ', ' dd           dd'] },
    crab: { P: { r: '#e8503a', d: '#b02a1e', l: '#ff8a70', w: '#ffffff', e: '#1e1426' },
      A: ['  rr        rr  ', ' rllr  ww  rllr ', ' rrrr  ee  rrrr ', '  rr  rrrr  rr  ', '   d rrllrr d   ', ' d  drrrrrrd  d ', '  d  rrrrrr  d  ', '   d d    d d   '],
      B: ['                ', '  rr        rr  ', ' rllr  ww  rllr ', ' rrrr  ee  rrrr ', '  rr  rrrr  rr  ', '   d rrllrr d   ', ' d  drrrrrrd  d ', '  d   d  d  d   '] },
    turtle: { P: { g: '#5fb86a', d: '#3a8a4a', s: '#8a6a3a', t: '#b08a50', h: '#d8b878', e: '#1e1426' },
      A: ['     tttt       ', '   tthhhhtt     ', '  thhssssht  gg ', ' thsssttsssht ggg', ' tsstttttttst gge', ' tsssttttsssd ggg', '  dsssssssdd  dd ', '   dd gg  gg dd  ', '      dd  dd     '],
      B: ['     tttt       ', '   tthhhhtt     ', '  thhssssht   gg', ' thsssttsssht ggg', ' tsstttttttst gge', ' tsssttttsssd ggg', '  dsssssssdd  dd ', '   dd gg  gg dd  ', '      dd  dd     '] },
    monkey: { P: { b: '#8a5a32', d: '#5e3a1c', f: '#e8c090', e: '#1e1426', y: '#ffd23f', t: '#6e4624' },
      A: ['   bb bb       ', '  bffbffb      ', '  bbbbbbb      ', '  bfeffefb     ', '   bfffffb     ', '    dbbbd      ', '   bbbbbbb  t  ', '  bbbbbbbbb t  ', '  bbbbbbbbb t  ', '  fb     bf tt ', '  dd     dd    '],
      B: ['   bb bb       ', '  bffbffb      ', '  bbbbbbb      ', '  bfeffefb     ', '   bffyfb      ', '    dbbbd      ', ' b bbbbbbb  t  ', ' bbbbbbbbb  t  ', '  bbbbbbbbb t  ', '  fb     bf tt ', '  dd     dd    '] },
    parrot: { P: { r: '#e8402a', b: '#2a7de8', y: '#ffd23f', k: '#2a1a14', w: '#ffffff', e: '#1e1426', o: '#ff9a2a' },
      A: ['     rrrr      ', '    rrrrrr     ', '    rrwerr     ', '    rrrroo     ', '    rrrroo     ', '   rrrrrro     ', '  rrrbrrr      ', '  rrbbbrr      ', '  rbbyyrr      ', '   bbyybb      ', '    bbyb       ', '    bybb       ', '    kk kk      '],
      B: { 2: '    rrwerr     ', 3: '    rrrrooo    ', 4: '    rrrrroo    ', 7: ' rrrbbbrr      ', 8: ' rrbbyyrr      ' } },
    moonbot: { P: { s: '#d4dae8', d: '#8a94ac', k: '#4a5470', c: '#7df9ff', r: '#ff6a6a', e: '#1e1426', y: '#ffd23f' },
      A: ['       r        ', '       k        ', '   ssssssss     ', '  sdccccccds    ', '  sdcecceds     ', '  sdccccccds    ', '   ssssssss     ', '  dssyyyyssd    ', ' kdsssyysssdk   ', '  dssssssssd    ', '   kk    kk     ', '  kkkk  kkkk    '],
      B: { 0: '       y        ', 5: '  sdccccccds    ', 4: '  sdceecceds    ', 8: 'kkdsssyysssdkk  ' } },
    glorpling: { P: { g: '#8aff7a', d: '#4ad04a', l: '#d8ffc8', e: '#1e1426', w: '#ffffff', p: '#ff7ef0' },
      A: ['    p      p    ', '    gg    gg    ', '   gggggggggg   ', '  gggggggggggg  ', ' ggwwgggggwwggg ', ' ggweggggggwegg ', ' ggggggggggggg  ', ' gglllllllllggg  ', '  ggddddddddgg   ', '   dd  dd  dd    '],
      B: ['   p        p   ', '    gg    gg    ', '   gggggggggg   ', '  gggggggggggg  ', ' ggwwgggggwwggg ', ' ggweggggggwegg ', ' ggggggggggggg  ', ' gglllddlllggg   ', '  ggddddddddgg   ', '    dd    dd     '] },
    saucer: { P: { s: '#c8d0e0', d: '#8a94b0', g: '#7dffa0', c: '#bff7ff', l: '#ffd23f', y: '#ff7ef0' },
      A: ['      cccc      ', '     cccccc     ', '    ccgccgcc    ', '   ssssssssss   ', ' ssdsdsdsdsdss  ', 'sssllyyllyysssd ', ' dddddddddddddd ', '   d  g  g  d   '],
      B: { 5: 'sssyyllyyllsssd ' } },
    traveller: { P: { h: '#e8a23a', H: '#a8681a', s: '#ffd9b3', e: '#1e1426', t: '#2e8f7a', T: '#1f6a58', p: '#7a5a3a', b: '#c0392b', B: '#8a2a1c', r: '#e8e0d0', l: '#3a4a6a', k: '#1c1c28' },
      A: ['       hhhh     ', '      hhhhhh    ', '     HHHHHHHH   ', '       ssss     ', '       sess     ', '       ssss     ', '  rbbbbttttt    ', ' bbbbbbtttTt    ', ' bBbbbbtttTt    ', ' bBbbbbtttpt    ', ' bBbbbbllll     ', '  bBbb ll ll    ', '       kk  kk   '],
      B: { 11: '  bBbb  ll ll   ', 12: '       kk   kk  ', 10: ' bBbbbllll      ' } },
    star: { P: { y: '#ffe27a', Y: '#fff6c0', o: '#ffb02a', w: '#ffffff' },
      A: ['       Y        ', '       Y        ', '      yyy       ', '      yYy       ', 'yyyyyyYYYyyyyyy ', ' yyyyyYwYyyyyy  ', '   yyyYwYyyy    ', '    yyyYyyy     ', '   yyyyyyyyy    ', '   yyy   yyy    ', '  oyy     yyo   '],
      B: ['       Y        ', '      yYy       ', '      yyy       ', '  y   yYy   y   ', ' yyyyyyYYYyyyyy ', '  yyyyYwYyyyy   ', '   yyyYwYyyy    ', '    yyyYyyy     ', '   yyyyyyyyy    ', '   yyy   yyy    ', '  oyy     yyo   '] },
    pot: { P: { k: '#2a2a32', d: '#14141a', g: '#ffd23f', G: '#fff3a0', o: '#c8921a', h: '#5a5a66', w: '#ffffff' },
      A: ['   g G g g G    ', '  gGgggGgggGg   ', ' gggGgggggGggg  ', ' hkkkkkkkkkkkh  ', '  kkkkkkkkkkk   ', ' kkhkkkkkkkkkk  ', ' kkhhkkkkkkkkk  ', ' kkkkkkkkkkkkk  ', '  kkkkkkkkkkk   ', '   dd     dd    '],
      B: { 0: '   g   g g G    ', 1: '  gggGgggGggg   ', 2: ' gGggGgggggGgg  ' } },
    // ---- ambient animals ----
    butterfly: { P: { a: '#ffb0d8', A: '#ff7ab8', b: '#4a2a3a' },
      A: ['aa  b  aa', 'aAaabaaAa', ' aaabaaa ', '  aabaa  ', '   a a   '], B: ['   a a   ', '  aAbAa  ', '  aabaa  ', '   aba   '] },
    morpho: { P: { a: '#4ab0ff', A: '#1a5aff', b: '#1e1426' }, like: 'butterfly' },
    glowmoth: { P: { a: '#a8fff0', A: '#3affc8', b: '#2a4a5a' }, like: 'butterfly' },
    rabbit: { P: { w: '#d8c4a0', d: '#b89c74', p: '#ffb0b8', e: '#1e1426', n: '#ff8aa0', t: '#ffffff' },
      A: ['       ww   ', '       wp   ', '      wwp   ', '      www   ', '     wwwwe  ', '     wwwwwn ', '  wwwwwww   ', ' wwwwwwwww  ', ' wwwwwwdww  ', 'ttwwwwwwww  ', '  ww   ww   '],
      B: { 0: '      ww    ', 1: '      wpw   ', 2: '      wwp   ' } },
    owl: { P: { w: '#8a6a4a', b: '#6a4a32', y: '#ffd23f', e: '#1e1426', k: '#ff9a2a', f: '#d8c4a0' },
      A: ['w  b    b  w', 'ww bbbbbb ww', 'wwbeykkyebww', 'wwwbbbbbbwww', ' wwbbffbbww ', '  bbffffbb  ', '   bbffbb   ', '    bbbb    ', '    k  k    '],
      B: { 0: '   b    b   ', 1: '   bbbbbb   ', 3: 'wwwbbbbbbwww', 4: 'wwwbbffbbwww' } },
    gull: { P: { w: '#f4f4f8', b: '#9aa6bc', k: '#ffb030' },
      A: ['ww         ww', ' www  b  www ', '  wwwwbwwww  ', '     wbwk    ', '             '],
      B: ['             ', '     wbw     ', ' wwwwwbwwwww ', 'ww  wwbwwk ww', 'w           w'] },
    peep: { P: { b: '#b09a7a', w: '#f4efe4', e: '#1e1426', k: '#ff9a2a', l: '#e0944a' },
      A: ['     bb  ', '    bbbe ', '  bbbbbbk', ' bbbbbbb ', ' wwwwww  ', '  wwww   ', '  l  l   '], B: { 6: '  l   l  ' } },
    bird: { P: { y: '#3aa0ff', r: '#ff5a4a', k: '#ffb030', e: '#1e1426', t: '#ffd23f' },
      A: ['  yy       ', ' yyyy      ', '  yyrrrrr  ', '   rrrrrrek', '    rrrr   ', ' ttt       '],
      B: ['           ', '           ', '  rrrrrrr  ', 'tttrrrrrrek', '  yyyrrrr  ', '  yyy      '] },
    bat: { P: { b: '#3a2f4a', r: '#ff5a5a' },
      A: ['b         b', 'bb  b b  bb', 'bbbbbbbbbbb', ' b bbrbb b ', '    bbb    ', '     b     '],
      B: ['    b b    ', '   bbbbb   ', ' bbbbrbbbb ', 'bb bbbbb bb', 'b  bbbbb  b', '    bbb    '] },
    hopper: { P: { b: '#cfd8e8', a: '#8896b0', g: '#ff6a6a', e: '#1e1426', l: '#8896b0' },
      A: ['g       g', ' a     a ', '  bbbbb  ', ' bbbbbbb ', ' bebbbeb ', ' bbbbbbb ', '  bbbbb  ', '  l   l  '],
      B: { 7: ' l     l ' } },
    jelly: { P: { p: '#ff9ae6', P: '#ffd0f4', q: '#c86ad8' },
      A: ['   ppppp   ', '  pPPPPPp  ', ' ppPPPPPpp ', ' ppppppppp ', ' ppppppppp ', '  pqpqpqp  ', '  q q q q  ', '   q q q   ', '  q q q q  ', '   q q q   '],
      B: { 6: '   q q q   ', 7: '  q q q q  ', 8: '   q q q   ', 9: '  q q q q  ' } },
    // ---- cues ----
    gift: { P: { r: '#ff4a6a', R: '#c02a48', y: '#ffd23f', Y: '#fff3a0' },
      A: ['  yy yy  ', ' y  y  y ', '  yyyyy  ', 'rrrryrrrr', 'rrrryrrrr', 'yyyyyyyyy', 'RRRRyRRRR', 'RRRRyRRRR'] },
    heart: { P: { r: '#ff5a8a', h: '#ffc0d8' },
      A: [' rr rr ', 'rhrrrrr', 'rrrrrrr', ' rrrrr ', '  rrr  ', '   r   '] }
  };
  var ccache = {};
  // frame 0 or 1 of a creature: { cv, fx, fy } with the feet point at (fx, fy)
  function creature(kind, frame) {
    frame = frame ? 1 : 0;
    var key = kind + frame; if (ccache[key]) return ccache[key];
    var d = CRT[kind]; if (!d) return null;
    if (d.like) d = { P: d.P, A: CRT[d.like].A, B: CRT[d.like].B };
    var rows = d.A.slice();
    if (frame && d.B) { if (Array.isArray(d.B)) rows = d.B.slice(); else for (var r in d.B) rows[+r] = d.B[r]; }
    var w = 0; rows.forEach(function (row) { w = Math.max(w, row.length); });
    var c = canvas(w + 2, rows.length + 2), g = c.getContext('2d');
    stamp(g, rows, d.P, 1, 1); outline(g, w + 2, rows.length + 2, OUT);
    return (ccache[key] = { cv: c, fx: (w + 2) / 2, fy: rows.length + 1 });
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
  function item(kind, idx, col, moon, gold) {
    var key = kind + idx + col + (moon ? 'm' : '') + (gold ? 'g' : '');
    if (iconCache[key]) return iconCache[key];
    var shape = kind === 'ore' ? (idx >= 3 ? 'gem' : 'lump') : kind === 'fossil' ? (moon ? 'wheel' : 'bone') : kind === 'relic' ? 'star' : 'chest';
    var P = { o: OUT, H: hexShade(col, 0.35), h: col, d: hexShade(col, -0.35), w: '#ffffff', W: '#f4ecd6', G: '#ffd23f', Y: '#fff3b0',
      B: '#b8692a', b: '#8a4b1c' };
    if (moon && kind === 'fossil') { P.W = '#cfd8dc'; P.d = '#546e7a'; }
    else if (kind === 'fossil') P.d = '#c9bb98';
    if (gold && kind === 'fossil') { P.W = '#ffe27a'; P.d = '#c8921a'; }
    if (kind === 'ore' && idx === 0) P.H = '#6a6a72'; // coal: a dull grey sheen on black
    var c = canvas(14, 14), g = c.getContext('2d');
    stamp(g, ICONS[shape], P, 1, 1);
    return (iconCache[key] = c);
  }

  return {
    PICK: PICK, hexShade: hexShade, item: item, pieceCanvas: pieceCanvas,
    miner: function (o) { o.P = BASE; return person(o); },
    helper: function (k, o) { o.P = HELPERS[k % HELPERS.length]; o.look = HELPER_LOOK[k % HELPERS.length]; return person(o); },
    creature: creature, npc: npc, exhibit: exhibit, swing: swing, walkPose: walkPose, STEP_X: STEP_X,
    BODY_H: 38 // pixel height of a character, feet to hat
  };
})();
