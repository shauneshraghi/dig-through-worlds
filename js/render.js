// Dig Through Worlds: isometric renderer. Exposes the global DTWRender.
// The N×N column is drawn as cubes on 2:1 diamond tiles, deepest layer first and back to front
// within a layer. Layers above the miner are cut away; the ground behind the pit rises as walls
// and the surface rim carries each world's scenery. All art is drawn in code.
var DTWRender = (function () {
  'use strict';
  var D = DTW, T = D.TILE, N = D.N;
  var RIM = 8, VIEW_LAYERS = 12;
  var LADDER_Z = D.LADDER_Z; // the ladder hangs on the back-left pit wall (the x = 0 face), centred on this z
  var HUB = D.HUB, HX0 = HUB.x0, HZ0 = HUB.z0, HX1 = HUB.x0 + HUB.rows[0].length, HZ1 = HUB.z0 + HUB.rows.length;
  var cv, ctx, vw = 1, vh = 1, cssW = 1;
  // HD-2D path: the scene is drawn into scv, glowing things into the half-size ecv, and DTWPost composites
  // both onto the visible WebGL canvas. Text goes on the overlay canvas so the blur never touches it.
  var post = false, scv = null, ecv = null, ectx = null, ov = null, octx = null, lights = [];
  // the part of the stage the surface menu covers: a bottom sheet (portrait) or a side panel (wide), in CSS pixels
  var view = { right: 0, sheet: true };
  var TW = 48, hw = 24, hh = 12, bh = 24, ox = 0, oy = 0;
  var time = 0, shakeT = 0, parts = [], floaters = [];
  // smoothed camera and miner display state
  var cam = { fx: 3.5, fy: 1, fz: 3.5, zoom: 0.62, anchor: 0.17, init: false };
  var disp = { x: 3, y: 0, z: 3, face: 'e', phase: 0, boost: 0, world: -1, spd: 0, walk: 0, air: 0, land: 0, hit: 0, blink: 2 };

  // ---------- helpers ----------
  function shade(hex, amt) {
    var c = parseInt(hex.slice(1), 16), r = c >> 16, g = c >> 8 & 255, b = c & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function rgba(hex, a) { var c = parseInt(hex.slice(1, 7), 16); return 'rgba(' + (c >> 16) + ',' + (c >> 8 & 255) + ',' + (c & 255) + ',' + a + ')'; }
  function rgb3(hex) { var c = parseInt(hex.slice(1, 7), 16); return [(c >> 16) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]; }
  // a soft additive glow on the emissive layer: it feeds the bloom
  function glow(x, y, r, col, a) {
    if (!post || r <= 0) return;
    var g = ectx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(0.4, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
    ectx.fillStyle = g; ectx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // a screen-space point light for the post pass: centre, radius, intensity, colour
  function light(x, y, r, i, col) { if (post) lights.push({ x: x, y: y, r: r, i: i, c: typeof col === 'string' ? rgb3(col) : col }); }
  function prng(seed) { var a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function layerOf(y) { return y < 34 ? 0 : y < 67 ? 1 : 2; }
  // world point (x across, y depth, z across) to screen pixels
  function P(x, y, z) { return [ox + (x - z) * hw, oy + (x + z) * hh + y * bh]; }

  // ---------- 16×16 pixel textures per world, drawn in code ----------
  var TEX = {};
  function px(c, x, y, col, w, h) { c.fillStyle = col; c.fillRect(x, y, w || 1, h || 1); }
  function noiseFill(c, base, r, amount) {
    px(c, 0, 0, base, 16, 16);
    for (var i = 0; i < amount; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), shade(base, (r() - 0.5) * 0.35), 1 + Math.floor(r() * 2), 1);
  }
  function mk(fn) { var c = document.createElement('canvas'); c.width = c.height = 16; fn(c.getContext('2d')); return c; }
  function gem(c, color, r, n) {
    for (var k = 0; k < n; k++) {
      var gx = 2 + Math.floor(r() * 10), gy = 2 + Math.floor(r() * 10);
      px(c, gx + 1, gy, shade(color, 0.4), 2, 1); px(c, gx, gy + 1, color, 4, 2); px(c, gx + 1, gy + 3, shade(color, -0.35), 2, 1);
      px(c, gx + 1, gy + 1, shade(color, 0.7));
    }
  }
  function bone(c) {
    var a = '#f4ecd6', d = '#c9bb98';
    px(c, 4, 7, a, 8, 2); px(c, 3, 6, a, 2, 2); px(c, 3, 8, a, 2, 2); px(c, 11, 6, a, 2, 2); px(c, 11, 8, a, 2, 2);
    px(c, 5, 9, d, 6, 1);
  }
  function textures(w) {
    if (TEX[w]) return TEX[w];
    var W = D.WORLDS[w], P_ = W.pal, t = {}, r = prng(w * 99 + 7), id = W.id;
    for (var L = 0; L < 3; L++) (function (L) {
      t['dirt' + L] = mk(function (c) { noiseFill(c, P_.dirt[L], r, 40); if (id === 'moon') for (var i = 0; i < 2; i++) { var x = r() * 12 | 0, y = r() * 12 | 0; px(c, x, y, shade(P_.dirt[L], -0.25), 3, 1); px(c, x, y + 1, shade(P_.dirt[L], 0.15), 3, 1); } });
      t['stone' + L] = mk(function (c) { noiseFill(c, shade(P_.stone, -0.1 * L), r, 30); px(c, 2, 4, shade(P_.stone, 0.25), 5, 1); px(c, 9, 10, shade(P_.stone, 0.25), 4, 1); px(c, 3, 12, shade(P_.stone, -0.35), 6, 1); });
      for (var k = 0; k < 4; k++) (function (k) { t['ore' + L + '_' + k] = mk(function (c) { noiseFill(c, P_.dirt[L], r, 30); gem(c, W.ores[k].color, r, 2 + (k > 1 ? 1 : 0)); }); })(k);
      t['fossil' + L] = mk(function (c) { noiseFill(c, P_.dirt[L], r, 30); if (id === 'moon') { px(c, 4, 4, '#cfd8dc', 8, 8); px(c, 5, 5, '#78909c', 6, 6); px(c, 7, 2, '#cfd8dc', 2, 12); px(c, 2, 7, '#cfd8dc', 12, 2); px(c, 7, 7, '#ffd23f', 2, 2); } else bone(c); px(c, 0, 0, '#ffe9a8'); px(c, 15, 15, '#ffe9a8'); });
      t['goo' + L] = mk(function (c) { noiseFill(c, '#3fbf5a', r, 30); px(c, 0, 0, '#9dff8a', 16, 2); px(c, 3, 2, '#9dff8a', 2, 3); px(c, 10, 2, '#9dff8a', 2, 5); px(c, 5, 7, '#cfffc4', 2, 2); px(c, 11, 11, '#1f7a33', 3, 2); });
    })(L);
    t.grass = mk(function (c) { noiseFill(c, P_.top, r, 50); for (var i = 0; i < 10; i++) px(c, r() * 16 | 0, r() * 16 | 0, shade(P_.top, 0.25)); });
    t.root = mk(function (c) { noiseFill(c, '#4a2f17', r, 20); for (var x = 0; x < 16; x++) { var y = 7 + Math.round(Math.sin(x * 0.8) * 2); px(c, x, y - 2, '#7a4f2a', 1, 5); px(c, x, y - 2, '#9a6a3a'); } });
    t.trap = mk(function (c) { noiseFill(c, '#8a8268', r, 20); px(c, 1, 1, '#6a6450', 14, 1); px(c, 1, 14, '#6a6450', 14, 1); px(c, 4, 5, '#3a3428', 8, 6); px(c, 5, 6, '#c0392b', 2, 2); px(c, 9, 6, '#c0392b', 2, 2); px(c, 6, 9, '#e8d8a0', 4, 1); });
    t.chest = mk(function (c) { noiseFill(c, '#8a8268', r, 10); px(c, 2, 4, '#8a4b1c', 12, 10); px(c, 2, 4, '#b8692a', 12, 3); px(c, 2, 8, '#ffd23f', 12, 1); px(c, 7, 7, '#ffd23f', 2, 4); px(c, 2, 4, '#5a2e10', 1, 10); px(c, 13, 4, '#5a2e10', 1, 10); });
    t.relic = mk(function (c) { noiseFill(c, '#3a2c5a', r, 20); px(c, 0, 0, '#ffd23f', 16, 1); px(c, 0, 15, '#ffd23f', 16, 1); px(c, 7, 3, W.relic.color, 2, 10); px(c, 3, 7, W.relic.color, 10, 2); px(c, 6, 6, '#fff', 4, 4); });
    t.bed = mk(function (c) { noiseFill(c, P_.bed, r, 25); });
    t.path = mk(function (c) { // cobbles
      noiseFill(c, shade(P_.stone, 0.15), r, 20);
      [[0, 0, 7, 5], [8, 0, 8, 6], [0, 6, 5, 5], [6, 7, 6, 4], [13, 7, 3, 5], [0, 12, 8, 4], [9, 12, 7, 4]].forEach(function (b, i) {
        px(c, b[0], b[1], shade(P_.stone, 0.05 + 0.08 * (i % 3)), b[2] - 1, b[3] - 1); px(c, b[0], b[1], shade(P_.stone, 0.3), b[2] - 1, 1);
      });
    });
    ['#efe6d2', '#d9ccb0'].forEach(function (base, k) { // museum floor: polished tiles with faint veins
      t['floor' + k] = mk(function (c) { noiseFill(c, base, r, 12); for (var i = 0; i < 3; i++) { var vx = r() * 14 | 0, vy = r() * 14 | 0; px(c, vx, vy, shade(base, -0.12), 3, 1); px(c, vx + 2, vy + 1, shade(base, -0.12), 2, 1); } px(c, 0, 0, shade(base, 0.25), 16, 1); });
    });
    t.stoneRim = mk(function (c) { noiseFill(c, shade(P_.stone, 0.1), r, 30); px(c, 0, 15, shade(P_.stone, -0.3), 16, 1); px(c, 15, 0, shade(P_.stone, -0.3), 1, 16); });
    Object.keys(t).forEach(function (k) {
      if (k === 'grass' || k === 'stoneRim') return;
      var c = t[k].getContext('2d');
      px(c, 0, 0, 'rgba(255,255,255,0.13)', 16, 1); px(c, 0, 1, 'rgba(255,255,255,0.07)', 1, 15);
      px(c, 0, 15, 'rgba(0,0,0,0.22)', 16, 1); px(c, 15, 0, 'rgba(0,0,0,0.14)', 1, 15);
    });
    TEX[w] = t; return t;
  }
  function texKey(tt, v, y) {
    var L = layerOf(y);
    switch (tt) {
      case T.DIRT: return 'dirt' + L;
      case T.STONE: return 'stone' + L;
      case T.ORE: return 'ore' + L + '_' + v;
      case T.FOSSIL: return 'fossil' + L;
      case T.GOO: return 'goo' + L;
      case T.ROOT: return 'root';
      case T.TRAP: return 'trap';
      case T.CHEST: return 'chest';
      case T.RELIC: return 'relic';
      default: return 'bed';
    }
  }

  // ---------- cube sprites: one canvas per (world, top texture, side texture, tile size) ----------
  var cubes = {}, hexSprite = null, hexTW = 0;
  function hexPath(c, x0, y0) {
    c.beginPath(); c.moveTo(x0 + hw, y0); c.lineTo(x0 + TW, y0 + hh); c.lineTo(x0 + TW, y0 + hh + bh);
    c.lineTo(x0 + hw, y0 + 2 * hh + bh); c.lineTo(x0, y0 + hh + bh); c.lineTo(x0, y0 + hh); c.closePath();
  }
  function face(c, tex, a, b, cc, d, e, f, poly, dark) {
    c.save(); c.beginPath(); c.moveTo(poly[0], poly[1]);
    for (var i = 2; i < poly.length; i += 2) c.lineTo(poly[i], poly[i + 1]);
    c.closePath(); c.clip();
    c.setTransform(a, b, cc, d, e, f); c.drawImage(tex, -0.5, -0.5, 17, 17);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (dark) { c.fillStyle = 'rgba(0,0,0,' + dark + ')'; c.fill(); }
    c.restore();
  }
  function cube(w, top, side) {
    var key = w + '|' + top + '|' + side + '|' + TW;
    if (cubes[key]) return cubes[key];
    var tx = textures(w), c = document.createElement('canvas'); c.width = TW; c.height = TW;
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    var tt = tx[top], st = tx[side];
    face(g, tt, hw / 16, hh / 16, -hw / 16, hh / 16, hw, 0, [hw, 0, TW, hh, hw, 2 * hh, 0, hh], 0);
    face(g, st, hw / 16, hh / 16, 0, bh / 16, 0, hh, [0, hh, hw, 2 * hh, hw, 2 * hh + bh, 0, hh + bh], 0.22);
    face(g, st, hw / 16, -hh / 16, 0, bh / 16, hw, 2 * hh, [hw, 2 * hh, TW, hh, TW, hh + bh, hw, 2 * hh + bh], 0.42);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0.5, hh); g.lineTo(hw, 2 * hh - 0.5); g.lineTo(TW - 0.5, hh); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; hexPath(g, 0, 0); g.stroke();
    return (cubes[key] = c);
  }
  function hex() {
    if (hexSprite && hexTW === TW) return hexSprite;
    hexSprite = document.createElement('canvas'); hexSprite.width = hexSprite.height = TW; hexTW = TW;
    var g = hexSprite.getContext('2d'); g.fillStyle = '#000'; hexPath(g, 0, 0); g.fill();
    return hexSprite;
  }

  // ---------- items (loot, toasts, museum icons) ----------
  function itemColor(it) {
    var wd = D.WORLDS[it.world];
    if (it.kind === 'ore') return wd.ores[it.idx].color;
    if (it.kind === 'fossil') return '#f4ecd6';
    if (it.kind === 'relic') return wd.relic.color;
    return '#ffd23f';
  }
  function drawItem(c, it, x, y, s) {
    var col = itemColor(it);
    c.save(); c.translate(x, y); c.fillStyle = col;
    if (it.kind === 'fossil') { c.fillRect(-s * 0.4, -s * 0.1, s * 0.8, s * 0.2); c.fillRect(-s * 0.5, -s * 0.25, s * 0.2, s * 0.5); c.fillRect(s * 0.3, -s * 0.25, s * 0.2, s * 0.5); }
    else if (it.kind === 'relic') { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? s * 0.22 : s * 0.5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); }
    else { c.beginPath(); c.moveTo(0, -s * 0.45); c.lineTo(s * 0.4, 0); c.lineTo(0, s * 0.45); c.lineTo(-s * 0.4, 0); c.fill(); c.fillStyle = '#fff8'; c.fillRect(-s * 0.12, -s * 0.25, s * 0.12, s * 0.12); }
    c.restore();
  }

  // ---------- the miner: a kid with a hard hat, headlamp and pickaxe, pixel art drawn in code ----------
  // The sprites themselves are in js/sprites.js (DTWSprites); this file poses and places them.
  function pickTier(drill) { return Math.min(4, Math.floor(drill / 6)); }
  // screen pixels per sprite pixel: a character stands a little over one block tall
  function charScale() { return TW / 32; }
  var FACE = { e: { back: false, flip: false }, s: { back: false, flip: true }, n: { back: true, flip: false }, w: { back: true, flip: true } };
  function swingAngle(phase, digging, side) {
    var rest = -1.0, raised = -2.3, strike = side ? 0.1 : 0.95;
    if (!digging) return rest + Math.sin(time * 2) * 0.05;
    var f = phase % 1;
    if (f < 0.55) return strike + (raised - strike) * (f / 0.55);                  // wind up
    if (f < 0.72) return raised + (strike - raised) * ((f - 0.55) / 0.17);         // strike
    return strike;                                                                 // follow through
  }
  // ---------- helper diggers ----------
  // The logic gives each helper a block of the miner's layer and a cell to stand on (run.crew); here they
  // ease between cells and swing at their block.
  var crewPos = [], crewT = 0;
  function helperSpots(S, g, r) {
    var out = [], dt = Math.min(0.1, Math.max(0, time - crewT)); crewT = time;
    (r.crew || []).forEach(function (c, k) {
      var tx = c.x + 0.5, tz = c.z + 0.5, p = crewPos[k];
      if (!p || Math.abs(p.y - c.y) > 2) p = crewPos[k] = { x: tx, z: tz, y: c.y };
      var ex = tx - p.x, ez = tz - p.z, l = Math.sqrt(ex * ex + ez * ez), st = D.WALK * dt;
      if (l <= st) { p.x = tx; p.z = tz; } else { p.x += ex / l * st; p.z += ez / l * st; }
      p.y += Math.max(-st, Math.min(st, c.y - p.y));
      out.push({ k: k, x: p.x, z: p.z, y: p.y, face: c.face, dig: c.target >= 0 && !(c.stun > 0) && l <= st, walking: l > st, stun: c.stun > 0 });
    });
    crewPos.length = out.length;
    return out;
  }
  function drawHelper(h, S) {
    var fc = FACE[h.face] || FACE.e, phase = time * 1.7 + h.k * 0.37, q = P(h.x, h.y + 1, h.z), p = charScale() * 0.85;
    var st = h.walking ? Math.sin(time * 12 + h.k) : 0;
    var spr = DTWSprites.helper(h.k, { back: fc.back, ang: h.dig ? swingAngle(phase, true, true) : null, carry: !h.dig, tier: 0,
      pose: { bob: h.walking ? -Math.round(Math.abs(st)) : 0, body: 0, lean: 0, stride: st, air: 0, blink: false }, lampOn: S.mode !== 'surface', t: time });
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(Math.round(q[0]), Math.round(q[1]));
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.38, hh * 0.38, 0, 0, 7); ctx.fill();
    if (fc.flip) ctx.scale(-1, 1);
    ctx.drawImage(spr.cv, -spr.fx * p, -spr.fy * p, spr.cv.width * p, spr.cv.height * p);
    ctx.restore();
    if (h.dig && (phase % 1) > 0.72 && (phase % 1) < 0.76 && Math.random() < 0.5) { // chips fly off the block being hit
      var d = D.DIRS[h.face]; spawnBreak(h.x - 0.5 + d[0] * 0.5, h.y, h.z - 0.5 + d[1] * 0.5, '#c8a07088', 1);
    }
  }
  function drawMiner(sx, sy, S, r) {
    var digging = S.mode === 'dig' && r && r.stun <= 0 && r.state === 'dig';
    var side = !!(r && r.target >= 0 && Math.floor(r.target / (N * N)) === r.y);
    var climbing = S.mode === 'up' || S.mode === 'down';
    var fc = FACE[disp.face] || FACE.e;
    var ang = swingAngle(disp.phase, digging, side);
    var walking = disp.spd > 0.6 && disp.air < 0.5 && !climbing;
    var stride = walking ? Math.sin(disp.walk * Math.PI) * Math.min(1, disp.spd / 2) : 0;
    var f = disp.phase % 1, pose = {
      // walking bounces on each step; standing breathes
      bob: walking ? -Math.round(Math.abs(stride) * 1.4) : 0,
      body: walking || disp.air > 0.3 ? 0 : (Math.sin(time * 2.4) > 0.55 ? 1 : 0),
      // lean back while raising the pick, forward into the strike
      lean: digging && !side ? (f < 0.55 ? -1 : f < 0.85 ? 1 : 0) : (walking ? 1 : 0),
      stride: stride, air: disp.air, blink: disp.blink < 0
    };
    if (digging && f >= 0.72 && f < 0.85) pose.body = 1; // knees give on the impact
    // the rucksack on the miner's back grows with the bag: stuffed full, it is time to go home
    var full = r && S.mode !== 'surface' ? Math.min(1, (r.bag.length + r.loot.length) / D.bagCap(S)) : 0;
    var spr = DTWSprites.miner({ back: climbing ? true : fc.back, ang: digging ? ang : null, carry: !digging, tier: pickTier(S.upgrades.drill), pose: pose, pack: full,
      lampOn: S.mode !== 'surface', climb: climbing ? (Math.floor(disp.y * 3) & 1) : null, t: time });
    if (climbing) fc = FACE.w;
    var p = charScale();
    // squash and stretch about the feet: squash on landing and on each strike, stretch while falling
    var sq = disp.land * 0.22 + disp.hit * 0.06 - disp.air * 0.08;
    var scy = 1 - sq, scx = 1 + sq * 0.7;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(sx), Math.round(sy));
    // shadow on the floor, smaller while in the air
    var sh = 1 - disp.air * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.45 * sh, hh * 0.45 * sh, 0, 0, 7); ctx.fill();
    if (r && r.stun > 0) ctx.rotate(Math.sin(time * 14) * 0.1); // dazed wobble
    ctx.scale(fc.flip ? -scx : scx, scy);
    ctx.drawImage(spr.cv, -spr.fx * p, -spr.fy * p, spr.cv.width * p, spr.cv.height * p);
    ctx.restore();
    if (r && r.stun > 0) {
      octx.font = 'bold ' + Math.round(TW * 0.22) + 'px sans-serif'; octx.textAlign = 'center'; octx.fillStyle = '#ffeb3b';
      for (var i = 0; i < 3; i++) { var a = time * 6 + i * 2.1; octx.fillText('★', sx + Math.cos(a) * TW * 0.3, sy - 36 * p + Math.sin(a) * TW * 0.08); }
    }
    return p;
  }

  // ---------- surface scenery: iso boxes on the rim ----------
  function poly(pts, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); }
  // box over x∈[x0,x0+sx], z∈[z0,z0+sz], from depth yb (its base) up by height h
  function box(x0, z0, sx, sz, yb, h, col) {
    var yt = yb - h, x1 = x0 + sx, z1 = z0 + sz;
    poly([P(x0, yt, z1), P(x1, yt, z1), P(x1, yb, z1), P(x0, yb, z1)], shade(col, -0.2));
    poly([P(x1, yt, z0), P(x1, yt, z1), P(x1, yb, z1), P(x1, yb, z0)], shade(col, -0.38));
    poly([P(x0, yt, z0), P(x1, yt, z0), P(x1, yt, z1), P(x0, yt, z1)], col);
  }
  function roof(x0, z0, sx, sz, yb, h, col) { // pyramid roof
    var x1 = x0 + sx, z1 = z0 + sz, apex = P(x0 + sx / 2, yb - h, z0 + sz / 2);
    poly([P(x0, yb, z1), P(x1, yb, z1), apex], shade(col, -0.15));
    poly([P(x1, yb, z0), P(x1, yb, z1), apex], shade(col, -0.35));
  }
  function label(x, y, z, text, size) {
    var q = P(x, y, z); ctx.font = Math.round(size) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, q[0], q[1]); ctx.textBaseline = 'alphabetic';
  }
  // ---------- the plaza: props placed from the hub map ----------
  // A prop that covers a block of cells (a stall, a plinth) is built once from its lowest-x, lowest-z cell.
  // Each item carries its footprint (x0..x1, z0..z1) so depthSort can order it against the characters.
  var PL = D.PLINTH_CH, FLOOR_CH = 'm#p' + PL + 'abcdeDM', INSIDE_CH = 'mp' + PL + 'abcdeDM';
  var PADS = { L: ['⛏', 'Dig'], S: ['🛒', 'Shop'], H: ['👷', 'Helpers'], W: ['🗺️', 'Worlds'], M: ['🏛️', 'Museum'] };
  var padLabels = [];
  function groundTex(c, x, z) {
    if (c === 'M') return (x + z) & 1 ? 'floor1' : 'floor0';
    if (c === '=' || PADS[c]) return 'path';
    if (c && FLOOR_CH.indexOf(c) >= 0) return (x + z) & 1 ? 'floor1' : 'floor0';
    return 'grass';
  }
  function hash2(x, z) { return (((x + 40) * 7349 ^ (z + 40) * 9157) * 2654435761 >>> 0) / 4294967296; }
  var HUB_BLOCKS = null;
  function hubBlocks() {
    if (HUB_BLOCKS) return HUB_BLOCKS;
    HUB_BLOCKS = [];
    for (var z = HZ0; z < HZ1; z++) for (var x = HX0; x < HX1; x++) {
      var c = D.hubCell(x, z), single = c === '#' || c === 't' || c === 'p' || c === 'w';
      if (('tTshwp#abcdeD' + PL).indexOf(c) < 0) continue;
      if (!single && (D.hubCell(x - 1, z) === c || D.hubCell(x, z - 1) === c)) continue;
      var x1 = x + 1, z1 = z + 1;
      if (!single) { while (D.hubCell(x1, z) === c) x1++; while (D.hubCell(x, z1) === c) z1++; }
      HUB_BLOCKS.push({ c: c, x0: x, z0: z, x1: x1, z1: z1 });
    }
    return HUB_BLOCKS;
  }
  function feet(x, z, fn, r) { r = r || 0.3; return { x0: x - r, x1: x + r, z0: z - r, z1: z + r, fn: fn }; }
  // painter's order for things standing on the ground: a footprint wholly at lower x, or wholly at
  // lower z, is behind. Overlapping footprints keep the order of their centres.
  function depthSort(items) {
    items.sort(function (a, b) { return (a.x0 + a.x1 + a.z0 + a.z1) - (b.x0 + b.x1 + b.z0 + b.z1); });
    var n = items.length, out = [], seen = new Uint8Array(n);
    function behind(a, b) { return a.x1 <= b.x0 + 1e-6 || a.z1 <= b.z0 + 1e-6; }
    function visit(i) {
      seen[i] = 1;
      for (var j = 0; j < n; j++) if (!seen[j] && behind(items[j], items[i]) && !behind(items[i], items[j])) visit(j);
      out.push(items[i]);
    }
    for (var i = 0; i < n; i++) if (!seen[i]) visit(i);
    return out;
  }
  function hubProps(S, items, all) {
    var w = S.world, id = D.WORLDS[w].id;
    hubBlocks().forEach(function (b) {
      // below the surface only the back rim is left: the rest is cut away with the layers above
      if (!all && !((b.x1 <= 0 || b.z1 <= 0) && b.x1 <= N + RIM && b.z1 <= N + RIM)) return;
      var fn, c = b.c, k;
      if (c === 't') fn = function () { worldProp(id, b.x0, b.z0); };
      else if (c === 'T') fn = function () { landmark(id, b); };
      else if (c === 's') fn = function () { shopStall(b); };
      else if (c === 'h') fn = function () { helperHut(b); };
      else if (c === 'w') fn = function () { signpost(b.x0, b.z0, S); };
      else if (c === 'p') fn = function () { plant(b.x0, b.z0); };
      else if (c === '#') fn = function () { wall(b.x0, b.z0, S); };
      else if (c === 'D') fn = function () { desk(b); };
      else if ((k = PL.indexOf(c)) >= 0) fn = function () { plinth(k, b, S); };
      else if ((k = 'abcde'.indexOf(c)) >= 0) fn = function () { relicCase(k, b, S); };
      items.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, fn: fn });
    });
  }
  function blob(x, z, rx, a) { var q = P(x, 1, z); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.beginPath(); ctx.ellipse(q[0] + hw * 0.25, q[1] + hh * 0.15, hw * rx, hh * rx, 0, 0, 7); ctx.fill(); }
  function tree(x, z, s, k) {
    blob(x + 0.5, z + 0.5, 0.95 * s, 0.22);
    box(x + 0.35, z + 0.35, 0.3, 0.3, 1, 0.9 * s, '#6b4226');
    box(x + 0.05, z + 0.05, 0.9, 0.9, 1 - 0.8 * s, 0.7 * s, k % 2 ? '#2e7d32' : '#388e3c');
    box(x + 0.2, z + 0.2, 0.6, 0.6, 1 - 1.5 * s, 0.45 * s, '#43a047');
  }
  // one tree, kelp, palm, rock or spire per 't' cell, varied by position
  function worldProp(id, x, z) {
    var h = hash2(x, z), s = 0.85 + h * 0.5, i = Math.floor(h * 97);
    if (id === 'forest') tree(x, z, s, i);
    else if (id === 'ocean') {
      blob(x + 0.5, z + 0.5, 0.5, 0.18);
      if (i % 3) for (var sg = 0; sg < 5; sg++) { var sw = Math.sin(time * 2 + sg * 0.6 + i) * 0.06 * sg; box(x + 0.4 + sw, z + 0.4, 0.18, 0.18, 1 - sg * 0.35 * s, 0.36 * s, i % 2 ? '#2e8b57' : '#3cb371'); }
      else { box(x + 0.2, z + 0.2, 0.6, 0.6, 1, 0.35, '#ff6f8a'); box(x + 0.35, z + 0.35, 0.3, 0.3, 0.65, 0.3, '#ff9fb0'); }
    } else if (id === 'jungle') {
      blob(x + 0.5, z + 0.5, 0.8, 0.2);
      box(x + 0.4, z + 0.4, 0.2, 0.2, 1, 1.4 * s, '#6b4a2b');
      box(x - 0.15, z - 0.15, 1.3, 1.3, 1 - 1.4 * s, 0.3, i % 2 ? '#1f6e33' : '#2e8f3e');
      box(x + 0.15, z + 0.15, 0.7, 0.7, 1 - 1.7 * s, 0.25, '#3aa34a');
    } else if (id === 'moon') {
      box(x + 0.15, z + 0.25, 0.5 + 0.2 * h, 0.45, 1, 0.25 + 0.2 * h, '#a8a8b4');
    } else {
      var ht = 1.2 + h * 1.2;
      box(x + 0.42, z + 0.42, 0.16, 0.16, 1, ht, '#9c27b0');
      var q = P(x + 0.5, 1 - ht - 0.15, z + 0.5), pa = 0.6 + 0.4 * Math.sin(time * 2 + i);
      ctx.fillStyle = 'rgba(93,255,122,' + pa + ')'; ctx.beginPath(); ctx.arc(q[0], q[1], TW * 0.16, 0, 7); ctx.fill();
      glow(q[0], q[1], TW * 0.6, '#5dff7a', 0.7 * pa); light(q[0], q[1], TW * 2, 0.35 * pa, '#5dff7a');
    }
  }
  function landmark(id, b) {
    var x = b.x0, z = b.z0;
    if (id === 'forest') tree(x + 0.5, z + 0.5, 1.9, 1);
    else if (id === 'ocean') { blob(x + 1, z + 1, 1.2, 0.2); box(x + 0.3, z + 0.3, 1.4, 1.4, 1, 0.5, '#ff6f8a'); box(x + 0.6, z + 0.6, 0.8, 0.8, 0.5, 0.6, '#ff9fb0'); box(x + 0.85, z + 0.85, 0.3, 0.3, -0.1, 0.5, '#ffc0cb'); }
    else if (id === 'jungle') { box(x, z, 2, 2, 1, 0.5, '#9a9070'); box(x + 0.3, z + 0.3, 1.4, 1.4, 0.5, 0.5, '#a89e7c'); box(x + 0.6, z + 0.6, 0.8, 0.8, 0, 0.5, '#b8ae8a'); box(x + 0.8, z + 0.8, 0.4, 0.4, -0.5, 0.35, '#3a3428'); }
    else if (id === 'moon') { box(x + 0.95, z + 0.95, 0.08, 0.08, 1, 2.2, '#dddddd'); var wv = Math.sin(time * 1.5) * 0.04; box(x + 1.03, z + 0.95, 0.04, 0.8 + wv, -1.2, 0.5, '#ff5252'); }
    else { box(x + 0.85, z + 0.85, 0.3, 0.3, 1, 2.6, '#7b1fa2'); var q = P(x + 1, -1.8, z + 1), pa = 0.7 + 0.3 * Math.sin(time * 1.7);
      ctx.fillStyle = 'rgba(93,255,122,' + pa + ')'; ctx.beginPath(); ctx.arc(q[0], q[1], TW * 0.3, 0, 7); ctx.fill(); glow(q[0], q[1], TW, '#5dff7a', pa); light(q[0], q[1], TW * 3, 0.5 * pa, '#5dff7a'); }
  }
  function shopStall(b) { // shelves at the back, counter facing the pad on the +x side, striped awning
    var x = b.x0, z = b.z0;
    blob(x + 1.5, z + 1.5, 1.7, 0.2);
    box(x, z, 3, 3, 1, 0.08, '#7a5232');
    box(x + 0.1, z + 0.1, 0.5, 2.8, 0.92, 1.3, '#8a5a32');
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) { var gq = P(x + 0.6, 0.92 - 0.3 - r * 0.4, z + 0.45 + c * 0.65); ctx.fillStyle = ['#ffd23f', '#5dd8ff', '#ff6f8a', '#9dff8a'][(r + c) % 4]; ctx.fillRect(gq[0] - TW * 0.05, gq[1] - TW * 0.07, TW * 0.1, TW * 0.1); }
    box(x + 2.75, z + 0.1, 0.12, 0.12, 0.92, 1.6, '#5a3a24'); box(x + 2.75, z + 2.78, 0.12, 0.12, 0.92, 1.6, '#5a3a24');
    box(x + 2.15, z + 0.25, 0.7, 2.5, 0.92, 0.55, '#b5773e'); box(x + 2.1, z + 0.2, 0.8, 2.6, 0.37, 0.08, '#e0a868');
    for (var i = 0; i < 6; i++) box(x - 0.05, z + i * 0.5, 3.1, 0.5, 1 - 1.62 - 0.05 * Math.sin(i), 0.1, i % 2 ? '#fff7e8' : '#e74c3c');
    ctx.fillStyle = '#ffd23f'; label(x + 2.9, -0.95, z + 1.5, '$', TW * 0.45);
  }
  function helperHut(b) { // a little house; its door faces the pad on the +z side
    var x = b.x0, z = b.z0;
    blob(x + 1.5, z + 1.5, 1.8, 0.2);
    box(x + 0.2, z + 0.2, 2.6, 2.6, 1, 1.2, '#efe4ff');
    box(x + 0.2, z + 0.2, 2.6, 2.6, 1, 0.2, '#b9a9d6');
    box(x + 1.2, z + 2.8, 0.6, 0.04, 1, 0.8, '#5a3a24');
    box(x + 0.5, z + 2.8, 0.45, 0.04, 0.45, 0.4, '#8fd3ff'); box(x + 2.05, z + 2.8, 0.45, 0.04, 0.45, 0.4, '#8fd3ff');
    roof(x - 0.05, z - 0.05, 3.1, 3.1, -0.2, 1.1, '#6c5ce7');
  }
  function signpost(x, z, S) { // one board per world, pointing alternately along x and z
    blob(x + 0.5, z + 0.5, 0.4, 0.2);
    box(x + 0.45, z + 0.45, 0.1, 0.1, 1, 1.9, '#7a4f2a');
    D.WORLDS.forEach(function (wd, k) {
      var yb = 0.75 - k * 0.32, col = S.unlocked[k] ? wd.pal.top : '#6a6470';
      if (k % 2) box(x + 0.5, z + 0.4, 0.75, 0.06, yb, 0.22, col); else box(x + 0.4, z + 0.5, 0.06, 0.75, yb, 0.22, col);
    });
  }
  function plant(x, z) {
    blob(x + 0.5, z + 0.5, 0.4, 0.2);
    box(x + 0.3, z + 0.3, 0.4, 0.4, 1, 0.35, '#b5653e');
    box(x + 0.2, z + 0.2, 0.6, 0.6, 0.65, 0.35, '#2e8f3e'); box(x + 0.32, z + 0.32, 0.36, 0.36, 0.3, 0.3, '#43a047');
  }
  function desk(b) {
    box(b.x0 + 0.15, b.z0 + 0.1, b.x1 - b.x0 - 0.3, b.z1 - b.z0 - 0.2, 1, 0.55, '#8a5a32');
    box(b.x0 + 0.1, b.z0 + 0.05, b.x1 - b.x0 - 0.2, b.z1 - b.z0 - 0.1, 0.45, 0.08, '#c9a46a');
    var q = P(b.x0 + 0.6, 0.37, b.z0 + 0.5); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(q[0], q[1] - TW * 0.04, TW * 0.06, Math.PI, 0); ctx.fill();
  }
  // museum walls: the back walls stand tall, the front walls are cut low so the hall stays in view.
  // A tall wall in front of the miner turns see-through.
  function wall(x, z, S) {
    var tall = INSIDE_CH.indexOf(D.hubCell(x + 1, z) || '-') >= 0 || INSIDE_CH.indexOf(D.hubCell(x, z + 1) || '-') >= 0 || INSIDE_CH.indexOf(D.hubCell(x + 1, z + 1) || '-') >= 0;
    var pillar = x === HUB_DOOR[0] && (z === HUB_DOOR[1] - 1 || D.hubCell(x, z - 1) === 'm' && D.hubCell(x - 1, z - 1) === '=');
    var h = pillar ? 1.9 : tall ? 1.5 : 0.3, a = 1;
    if (tall && S.mode === 'surface') {
      var mx = S.hub.x, mz = S.hub.z, d = (x + z + 1) - (mx + mz), side = Math.abs((x - z) - (mx - mz));
      if (d > 0 && d < 3.2 && side < 1.6) a = 0.35;
    }
    ctx.globalAlpha = a;
    box(x, z, 1, 1, 1, h, '#e6d7b8');
    if (pillar) { box(x - 0.05, z - 0.05, 1.1, 1.1, 1, 0.3, '#c9a46a'); box(x - 0.08, z - 0.08, 1.16, 1.16, 1 - h, 0.16, '#c9a46a'); }
    else if (tall) { box(x, z, 1, 1, 1, 0.28, '#8a5a3a'); box(x, z, 1, 1, 1 - h, 0.12, '#c9a46a'); }
    else box(x, z, 1, 1, 1 - h, 0.07, '#c9a46a');
    ctx.globalAlpha = 1;
  }
  var HUB_DOOR = (function () { // the first open cell in the museum's outer wall
    for (var z = HZ0; z < HZ1; z++) for (var x = HX0; x < HX1; x++) if (D.hubCell(x, z) === 'm' && D.hubCell(x - 1, z) === '=') return [x, z];
    return [0, 0];
  })();
  // a plinth per world: a stone step and a slab in the world's colour, the exhibit standing on top
  // k = world * 3 + creature
  function plinth(k, b, S) {
    var w = Math.floor(k / 3), c = k % 3, wd = D.WORLDS[w], open = S.unlocked[w], sx = b.x1 - b.x0, sz = b.z1 - b.z0;
    blob(b.x0 + sx / 2, b.z0 + sz / 2, sx * 0.6, 0.18);
    box(b.x0 + 0.05, b.z0 + 0.05, sx - 0.1, sz - 0.1, 1, 0.12, '#8a7f6a');
    box(b.x0 + 0.18, b.z0 + 0.18, sx - 0.36, sz - 0.36, 0.88, 0.3, open ? DTWSprites.hexShade(wd.pal.top, -0.3) : '#5a5462');
    var q = P(b.x0 + sx / 2, 0.58, b.z0 + sz / 2);
    DTWSprites.exhibit(ctx, k, S.museum[w].pieces.slice(c * 5, c * 5 + 5), open, q[0], q[1], TW / 27);
    if (!open) { // roped off
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = Math.max(2, TW / 18);
      [[b.x1 + 0.1, b.z0 + 0.2], [b.x1 + 0.1, b.z1 - 0.2]].forEach(function (pp) { box(pp[0] - 0.05, pp[1] - 0.05, 0.1, 0.1, 1, 0.55, '#c9a46a'); });
      seg(b.x1 + 0.1, 0.5, b.z0 + 0.2, b.x1 + 0.1, 0.62, b.z0 + sz / 2); seg(b.x1 + 0.1, 0.62, b.z0 + sz / 2, b.x1 + 0.1, 0.5, b.z1 - 0.2);
    }
  }
  function relicCase(k, b, S) {
    var x = b.x0, z = b.z0, wd = D.WORLDS[k];
    blob(x + 0.5, z + 0.5, 0.45, 0.2);
    box(x + 0.2, z + 0.2, 0.6, 0.6, 1, 0.6, '#5a3a24'); box(x + 0.15, z + 0.15, 0.7, 0.7, 0.4, 0.06, '#c9a46a');
    if (S.relics[k]) {
      var q = P(x + 0.5, 0.05, z + 0.5), bob = Math.sin(time * 2 + k) * TW * 0.04;
      drawItem(ctx, { kind: 'relic', world: k }, q[0], q[1] + bob, TW * 0.36);
      glow(q[0], q[1] + bob, TW * 0.7, wd.relic.color, 0.8); light(q[0], q[1], TW * 2.4, 0.6, wd.relic.color);
    }
    ctx.globalAlpha = 0.22; box(x + 0.2, z + 0.2, 0.6, 0.6, 0.34, 0.6, '#cfefff'); ctx.globalAlpha = 1; // glass
  }
  // ---------- people on the plaza: the shopkeeper, museum guides and visitors (visual only) ----------
  // Visitors walk in through the museum door, stop at a few exhibits and leave again. They use
  // Math.random, never the game's rng, so what is on screen cannot change a dig.
  var visitors = [], visitT = 0, coinT = 0, VSPEED = 1.3;
  var HUT_SPOTS = [[4.5, -3.5, 's'], [0.5, -3.5, 'e'], [4.5, -5.5, 'w'], [1.5, -2.5, 's'], [-0.5, -2.5, 'e'], [3.5, -2.5, 'n']];
  var GUIDE_SPOTS = [[14.5, 0.5], [17.5, 3.5], [20.5, 6.5], [14.5, 9.5], [20.5, 12.5]]; // aisle crossings in the museum
  function faceOf(dx, dz) { return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : (dz > 0 ? 's' : 'n'); }
  function museumSpots(S) { // open floor cells beside an exhibit that has at least one piece, else anywhere inside
    var out = [], any = [];
    for (var z = HZ0; z < HZ1; z++) for (var x = HX0; x < HX1; x++) {
      if (D.hubCell(x, z) !== 'm' || x <= HUB_DOOR[0]) continue;
      any.push([x + 0.5, z + 0.5, -1]);
      for (var k = 0; k < 15; k++) {
        var w = Math.floor(k / 3), c = k % 3;
        if (!S.unlocked[w]) continue;
        var ch = PL.charAt(k), near = D.hubCell(x + 1, z) === ch || D.hubCell(x - 1, z) === ch || D.hubCell(x, z + 1) === ch || D.hubCell(x, z - 1) === ch;
        if (near && S.museum[w].pieces.slice(c * 5, c * 5 + 5).some(function (n) { return n > 0; })) out.push([x + 0.5, z + 0.5, k]);
      }
    }
    return out.length ? out : any;
  }
  function wantVisitors(S) {
    var found = 0, done = 0;
    for (var w = 0; w < 5; w++) for (var c = 0; c < 3; c++) { var n = D.piecesFound(S, w, c); found += n; if (n === 5) done++; }
    return Math.min(14, (found ? 1 : 0) + Math.floor(found / 4) + done);
  }
  function stepPeople(dt, S) {
    if (S.mode !== 'surface') return;
    var want = wantVisitors(S), door = [HUB_DOOR[0] + 0.5, HUB_DOOR[1] + 0.5];
    visitT -= dt;
    if (visitors.length < want && visitT <= 0) {
      visitors.push({ x: door[0], z: door[1], path: null, wait: 0, visits: 2 + Math.floor(Math.random() * 3), seed: Math.floor(Math.random() * 4096), face: 'e', walk: 0, moving: false, leaving: false, look: -1 });
      visitT = 1.5 + Math.random() * 2.5;
    }
    for (var i = visitors.length - 1; i >= 0; i--) {
      var v = visitors[i];
      if (v.path) {
        var d = VSPEED * dt; v.moving = true;
        while (v.path && d > 0) {
          var p = v.path[0], ex = p[0] - v.x, ez = p[1] - v.z, l = Math.sqrt(ex * ex + ez * ez);
          if (l > 0.01) v.face = faceOf(ex, ez);
          if (l <= d) { v.x = p[0]; v.z = p[1]; d -= l; v.path.shift(); if (!v.path.length) v.path = null; }
          else { v.x += ex / l * d; v.z += ez / l * d; d = 0; }
          v.walk += VSPEED * dt * 2;
        }
        if (!v.path) {
          if (v.leaving) { visitors.splice(i, 1); continue; }
          v.wait = 2 + Math.random() * 4; v.moving = false;
          if (v.look >= 0) { var b = plinthBlock(v.look); v.face = faceOf((b.x0 + b.x1) / 2 - v.x, (b.z0 + b.z1) / 2 - v.z); }
          if (Math.random() < 0.5) floatText(v.x, -0.3, v.z, ['♥', '!', '✨', 'Wow!', 'Ooh!'][Math.floor(Math.random() * 5)], '#ffe9a8');
        }
      } else if ((v.wait -= dt) <= 0) {
        v.visits--;
        if (v.visits < 0 || want < visitors.length) { v.leaving = true; v.path = D.hubPath(v.x, v.z, door[0], door[1]); }
        else { // a free spot: nobody standing or headed there
          var sp = museumSpots(S).filter(function (c) { return !visitors.some(function (o) { var e = o.path ? o.path[o.path.length - 1] : [o.x, o.z]; return o !== v && Math.abs(e[0] - c[0]) + Math.abs(e[1] - c[1]) < 0.9; }); });
          if (!sp.length) sp = museumSpots(S);
          var t = sp[Math.floor(Math.random() * sp.length)]; v.look = t[2]; v.path = D.hubPath(v.x, v.z, t[0], t[1]);
        }
        if (!v.path) visitors.splice(i, 1);
      }
    }
    // visitors pay: a coin pops up over someone now and then (the coins themselves come from museumIncome)
    coinT -= dt;
    if (coinT <= 0 && visitors.length) {
      var who = visitors[Math.floor(Math.random() * visitors.length)];
      floatText(who.x, -0.5, who.z, '+🪙', '#ffd23f');
      coinT = 2 + 6 / (1 + visitors.length);
    }
  }
  function plinthBlock(k) { return hubBlocks().filter(function (bb) { return bb.c === PL.charAt(k); })[0]; }
  function drawPerson(kind, seed, x, z, face, moving, walk) {
    var fc = FACE[face] || FACE.e, frame = moving ? Math.floor(walk) & 3 : Math.floor(time * 1.5 + seed) & 3;
    var spr = DTWSprites.npc(kind, seed, fc.back, frame, moving, time), q = P(x, 1, z), p = charScale();
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(Math.round(q[0]), Math.round(q[1]));
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.4, hh * 0.4, 0, 0, 7); ctx.fill();
    if (fc.flip) ctx.scale(-1, 1);
    ctx.drawImage(spr.cv, -spr.fx * p, -spr.fy * p, spr.cv.width * p, spr.cv.height * p);
    ctx.restore();
  }
  function hubPeople(S, items) {
    var sb = hubBlocks().filter(function (bb) { return bb.c === 's'; })[0];
    if (sb) items.push(feet(sb.x0 + 1.5, sb.z0 + 1.5, function () { drawPerson('keeper', 1, sb.x0 + 1.5, sb.z0 + 1.5, 'e', false, 0); }, 0.2));
    for (var g = 0; g < Math.min(S.workers.staff, GUIDE_SPOTS.length); g++) (function (sp, g) {
      items.push(feet(sp[0], sp[1], function () { drawPerson('guide', g, sp[0], sp[1], g % 2 ? 's' : 'e', false, 0); }));
    })(GUIDE_SPOTS[g], g);
    visitors.forEach(function (v) { items.push(feet(v.x, v.z, function () { drawPerson('visitor', v.seed, v.x, v.z, v.face, v.moving, v.walk); })); });
    // hired helper diggers rest by their hut while the miner is up top
    HUT_SPOTS.filter(function (sp) { return D.hubWalkable(Math.floor(sp[0]), Math.floor(sp[1])); }).slice(0, Math.min(S.workers.diggers, 5)).forEach(function (sp, k) {
      items.push(feet(sp[0], sp[1], function () { drawHelper({ k: k, x: sp[0], z: sp[1], y: 0, face: sp[2], dig: false, walking: false }, S); }));
    });
  }
  // a stone disc on each station pad; the miner standing on it lights it up
  function pad(x, z, c, S) {
    var q = P(x + 0.5, 1, z + 0.5), on = S.mode === 'surface' && Math.floor(S.hub.x) === x && Math.floor(S.hub.z) === z;
    var pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save(); ctx.lineWidth = Math.max(2, TW / 16);
    ctx.strokeStyle = on ? '#ffffff' : 'rgba(255,210,63,' + (0.55 + 0.45 * pulse) + ')';
    ctx.fillStyle = on ? 'rgba(255,210,63,0.45)' : 'rgba(255,210,63,0.16)';
    ctx.beginPath(); ctx.ellipse(q[0], q[1], hw * 0.78, hh * 0.78, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    glow(q[0], q[1], TW * 0.6, '#ffd23f', 0.2 + 0.2 * pulse);
    padLabels.push([x + 0.5, z + 0.5, c, on]);
  }
  var stars = []; for (var si = 0; si < 70; si++) stars.push([Math.random(), Math.random(), Math.random()]);
  // distant hills behind the ground: two silhouette bands with a little parallax
  var HILLS = {
    forest: { far: '#7fb4c9', near: '#4f8f5a', amp: [1.2, 0.9], trees: true },
    ocean: { far: '#2f7fb0', near: '#1f5f8a', amp: [1.0, 1.4], kelp: true },
    jungle: { far: '#6d9c7c', near: '#2f6f3a', amp: [2.6, 1.3], trees: true },
    moon: { far: '#3a3f5a', near: '#5a5d6e', amp: [0.8, 0.5] },
    alien: { far: '#5a2f7a', near: '#3a1f55', amp: [1.6, 2.2], spires: true }
  };
  function hills(id, base, skyH) {
    var H = HILLS[id]; if (!H) return;
    [0, 1].forEach(function (band) {
      var par = band ? 0.35 : 0.15, off = (ox - vw / 2) * par, amp = H.amp[band] * TW, col = band ? H.near : H.far;
      var by = base - (band ? 0 : TW * 0.9);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-20, vh);
      for (var x = -20; x <= vw + 20; x += Math.max(4, TW / 8)) {
        var t = (x - off) / TW;
        var h = amp * (0.55 + 0.25 * Math.sin(t * 0.37 + band * 2) + 0.15 * Math.sin(t * 0.91 + 1.3) + 0.05 * Math.sin(t * 2.3));
        if (H.spires && band && ((t * 0.5) % 3 + 3) % 3 < 0.25) h += amp * 1.2;
        ctx.lineTo(x, by - h);
      }
      ctx.lineTo(vw + 20, vh); ctx.closePath(); ctx.fill();
      if (band && (H.trees || H.kelp)) for (var k = -2; k < vw / TW + 3; k++) {
        var tx = k * TW * 1.3 + ((off % (TW * 1.3)) + TW * 1.3) % (TW * 1.3), tt = (tx - off) / TW;
        var th = amp * (0.55 + 0.25 * Math.sin(tt * 0.37 + 2) + 0.15 * Math.sin(tt * 0.91 + 1.3) + 0.05 * Math.sin(tt * 2.3));
        var gy = by - th, sz = TW * (0.35 + 0.15 * Math.sin(k * 3.7));
        if (H.trees) { ctx.fillRect(tx - sz * 0.5, gy - sz * 1.4, sz, sz * 1.5); ctx.fillRect(tx - sz * 0.25, gy - sz * 1.9, sz * 0.5, sz * 0.6); }
        else { var sw = Math.sin(time * 1.5 + k) * TW * 0.08; ctx.fillRect(tx + sw, gy - sz * 2.4, TW * 0.08, sz * 2.4); }
      }
    });
  }
  function background(w, rimY, horizonY) {
    var Pl = D.WORLDS[w].pal, id = D.WORLDS[w].id;
    var deep = ctx.createLinearGradient(0, 0, 0, vh); deep.addColorStop(0, shade(Pl.bed, 0.12)); deep.addColorStop(1, '#000');
    ctx.fillStyle = deep; ctx.fillRect(-20, -20, vw + 40, vh + 40);
    if (rimY <= 0) return;
    var skyH = Math.min(vh + 40, rimY);
    var g = ctx.createLinearGradient(0, 0, 0, skyH); g.addColorStop(0, Pl.sky[0]); g.addColorStop(1, Pl.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, vw + 40, skyH + 20);
    var u = TW / 16;
    if (id === 'moon' || id === 'alien') for (var i = 0; i < stars.length; i++) { var s = stars[i]; if (s[1] * vh > skyH) continue; ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * Math.abs(Math.sin(time * (0.5 + s[2]) + i))) + ')'; ctx.fillRect(s[0] * vw, s[1] * skyH, u, u); }
    if (id === 'forest') { ctx.fillStyle = '#ffffff88'; for (var c = 0; c < 3; c++) { var cx = ((time * 8 * u + c * vw * 0.4) % (vw + 200)) - 100, cy = skyH * (0.12 + c * 0.1); ctx.fillRect(cx, cy, TW * 1.4, TW * 0.3); ctx.fillRect(cx + TW * 0.3, cy - TW * 0.2, TW * 0.8, TW * 0.3); } }
    if (id === 'moon') { var ex = vw * 0.8, ey = skyH * 0.2; ctx.fillStyle = '#3a7bd5'; ctx.beginPath(); ctx.arc(ex, ey, TW * 0.7, 0, 7); ctx.fill(); ctx.fillStyle = '#4caf50'; ctx.fillRect(ex - TW * 0.35, ey - TW * 0.3, TW * 0.4, TW * 0.25); ctx.fillRect(ex + TW * 0.05, ey + TW * 0.05, TW * 0.3, TW * 0.3); }
    if (id === 'alien') { ctx.save(); ctx.translate(vw * 0.2, skyH * 0.22); ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.arc(0, 0, TW * 0.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffe0b2'; ctx.lineWidth = u * 2; ctx.beginPath(); ctx.ellipse(0, 0, TW * 1.1, TW * 0.28, -0.3, 0, 7); ctx.stroke(); ctx.restore(); }
    if (horizonY !== null) hills(id, horizonY, skyH);
    if (id === 'jungle') { ctx.fillStyle = '#1e7a2e'; for (var v = 0; v < 8; v++) ctx.fillRect(vw * (v / 8 + 0.03), 0, u * 2, TW * (0.6 + (v % 3) * 0.4) + Math.sin(time + v) * u * 3); }
  }

  // ---------- camera ----------
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    vw = cv.width; vh = cv.height; cssW = Math.max(1, r.width);
    if (post) { scv.width = vw; scv.height = vh; ecv.width = Math.max(1, vw >> 1); ecv.height = Math.max(1, vh >> 1); }
    if (ov && octx !== ctx) { ov.width = vw; ov.height = vh; }
  }
  function setTile(zoom) {
    var t = Math.max(16, Math.round(Math.min(vw, vh * 1.05) / 9.4 * zoom / 4) * 4);
    if (t !== TW) { TW = t; hw = t / 2; hh = t / 4; bh = t / 2; }
  }
  function targets(S) {
    var g = D.site(S, S.world), r = S.run;
    if (S.mode === 'surface' || !r) return [S.hub.x - 0.5, 0, S.hub.z - 0.5]; // walking about the plaza
    if (S.mode === 'up') return [-0.3, 0, LADDER_Z];                 // climb up the ladder, close to the wall
    if (S.mode === 'down') return [-0.3, g.deepest, LADDER_Z];       // climb down to the current layer
    return [r.x, r.y, r.z];
  }
  function update(dt, S) {
    time += dt; shakeT = Math.max(0, shakeT - dt);
    stepPeople(dt, S);
    var r = S.run, tg = targets(S);
    if (disp.world !== S.world) { disp.world = S.world; disp.x = tg[0]; disp.y = tg[1]; disp.z = tg[2]; cam.init = false; }
    // a dig started away from the ladder (the Dig! button, Enter) jumps to the ladder top instead of sliding there
    if (disp.mode === 'surface' && S.mode === 'down' && Math.hypot(disp.x - tg[0], disp.z - tg[2]) > 1.5) { disp.x = tg[0]; disp.z = tg[2]; cam.init = false; }
    disp.mode = S.mode;
    if (S.mode === 'up' || S.mode === 'down') {
      var sp = Math.max(8, Math.abs(tg[1] - disp.y) / Math.max(0.1, r.elevT));
      disp.y += Math.sign(tg[1] - disp.y) * Math.min(Math.abs(tg[1] - disp.y), sp * dt);
    } else disp.y += (tg[1] - disp.y) * Math.min(1, dt * 12);
    if (Math.abs(tg[1] - disp.y) > 30 && S.mode !== 'up' && S.mode !== 'down') disp.y = tg[1];
    var mx = tg[0] - disp.x, mz = tg[2] - disp.z;
    if (Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05) disp.face = Math.abs(mx) > Math.abs(mz) ? (mx > 0 ? 'e' : 'w') : (mz > 0 ? 's' : 'n');
    if (r && r.steer && S.mode === 'dig') disp.face = r.steer;
    else if (r && S.mode === 'dig' && r.state === 'dig' && r.target >= 0 && Math.floor(r.target / (N * N)) === r.y) {
      var tx = r.target % N - r.x, tz = Math.floor(r.target / N) % N - r.z; // face the block being dug
      disp.face = tx > 0 ? 'e' : tx < 0 ? 'w' : tz > 0 ? 's' : 'n';
    }
    var k = Math.min(1, dt * 12), moved = Math.hypot(mx, mz) * k;
    disp.x += mx * k; disp.z += mz * k;
    // walk cycle: two steps per cell, easing out when the miner stops
    var spd = dt > 0 ? moved / dt : 0;
    disp.spd += (spd - disp.spd) * Math.min(1, dt * 10);
    disp.walk += moved * 2;
    // falling, and a squash on landing
    var air = S.mode !== 'up' && S.mode !== 'down' && (tg[1] - disp.y > 0.25 || (r && r.state === 'fall'));
    if (disp.air > 0.5 && !air) disp.land = 1;
    disp.air += ((air ? 1 : 0) - disp.air) * Math.min(1, dt * 14);
    disp.land = Math.max(0, disp.land - dt * 5);
    disp.blink -= dt; if (disp.blink < -0.12) disp.blink = 2 + Math.random() * 3;
    // pickaxe swing speed follows the dig rate, and taps kick it faster; a strike jolts the body
    disp.boost = Math.max(0, disp.boost - dt * 3);
    var f0 = disp.phase % 1;
    disp.phase += dt * Math.min(3.2, 0.9 + 0.22 * D.hitRate(S)) * (1 + disp.boost * 2.5);
    var f1 = disp.phase % 1;
    if (S.mode === 'dig' && r && r.state === 'dig' && r.stun <= 0 && (f0 < 0.72 && (f1 >= 0.72 || f1 < f0))) disp.hit = 1;
    disp.hit = Math.max(0, disp.hit - dt * 6);
    // camera: follows the miner down; horizontally it follows halfway so the whole pit stays on screen
    var surf = S.mode === 'surface';
    var fx = 3.5 + (disp.x + 0.5 - 3.5) * 0.5, fz = 3.5 + (disp.z + 0.5 - 3.5) * 0.5, fy = disp.y + 1;
    var zoom = surf ? (view.sheet ? 1.15 : 1.05) : 1, anchor = surf ? (view.sheet && view.open ? 0.2 : 0.5) : 0.3;
    if (surf) { fx = disp.x + 0.5; fz = disp.z + 0.5; fy = 1; } // on the plaza the camera follows the miner
    var k = cam.init ? Math.min(1, dt * 6) : 1; cam.init = true;
    cam.fx += (fx - cam.fx) * k; cam.fz += (fz - cam.fz) * k; cam.fy += (fy - cam.fy) * k;
    if (Math.abs(fy - cam.fy) > 12) cam.fy = fy;
    cam.zoom += (zoom - cam.zoom) * k; cam.anchor += (anchor - cam.anchor) * k;
    // particles and floating text live in world coordinates
    var grav = D.WORLDS[S.world].id === 'moon' ? 4 : 14;
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (var f = floaters.length - 1; f >= 0; f--) { var fl = floaters[f]; fl.life -= dt; fl.age = (fl.age || 0) + dt; fl.y -= dt * (fl.icon ? 0.45 : 0.8); if (fl.life <= 0) floaters.splice(f, 1); }
  }

  // ---------- the scene ----------
  function draw(S) {
    var w = S.world, g = D.site(S, w), r = S.run, id = D.WORLDS[w].id, Pl = D.WORLDS[w].pal;
    setTile(cam.zoom);
    // project the camera focus to (vw/2, anchor*vh)
    ox = 0; oy = 0; var f0 = P(cam.fx, cam.fy, cam.fz);
    ox = Math.round((vw - view.right * vw / cssW) / 2 - f0[0] + (shakeT > 0 ? (Math.random() - 0.5) * TW * 0.08 : 0)); oy = Math.round(vh * cam.anchor - f0[1]);
    var viewTop = Math.max(0, Math.floor(disp.y + 0.001)), yBot = Math.min(D.DEPTH + 1, viewTop + VIEW_LAYERS);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    lights = []; padLabels = [];
    if (post) { ectx.setTransform(1, 0, 0, 1, 0, 0); ectx.globalCompositeOperation = 'source-over'; ectx.fillStyle = '#000'; ectx.fillRect(0, 0, ecv.width, ecv.height); ectx.setTransform(0.5, 0, 0, 0.5, 0, 0); ectx.globalCompositeOperation = 'lighter'; }
    if (octx !== ctx) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, vw, vh); }
    var surfaceView = viewTop <= 1;
    // the ground drawn: the whole plaza at the surface, the rim around the pit below it
    var xlo = surfaceView ? HX0 : -RIM, xhi = surfaceView ? HX1 : N + RIM, zlo = surfaceView ? HZ0 : -RIM, zhi = surfaceView ? HZ1 : N + RIM;
    var backY = P(xlo, 1, zlo)[1];
    background(w, P(xhi, 1, zhi)[1] + TW, surfaceView ? backY + (Math.min(P(xlo, 1, zhi)[1], P(xhi, 1, zlo)[1]) - backY) * 0.3 : null);
    var hx = hex();
    function inPit(x, z) { return x >= 0 && x < N && z >= 0 && z < N; }
    // ground behind and beside the pit: on screen it never overlaps the pit, so it stays solid below the rim
    function backRegion(x, z) { return x < 0 || z < 0; }
    function solid(x, y, z) { // is there a drawn block here?
      if (y < 1 || y > yBot || x < xlo || z < zlo || x >= xhi || z >= zhi) return false;
      if (inPit(x, z)) return y >= viewTop && !D.passable(g.t[D.idx(x, y, z)]);
      return backRegion(x, z) || surfaceView;
    }
    var mcx = Math.round(disp.x), mcz = Math.round(disp.z), minerLayer = Math.min(yBot, viewTop);
    var ghost = {}; ghost[(mcx + 1) + ',' + mcz] = 1; ghost[mcx + ',' + (mcz + 1)] = 1; ghost[(mcx + 1) + ',' + (mcz + 1)] = 1;
    var minerDrawn = false, tgt = r && S.mode === 'dig' ? r.target : -1;
    function drawMinerNow() {
      if (minerDrawn) return; minerDrawn = true;
      var q = P(disp.x + 0.5, disp.y + 1, disp.z + 0.5);
      lastMiner = [q[0], q[1]];
      drawMiner(q[0], q[1], S, r);
    }
    // the ladder reaches from above the rim down to the floor of the layer being worked
    var ladderBot = r && S.mode === 'dig' ? r.y : Math.max(g.deepest, Math.ceil(disp.y));
    // Draw order: deeper layers, the back half of the miner's layer, the layers above it (only the back
    // rim walls, ladder, torches and rim scenery are left there, all behind the miner), then the miner,
    // then the front half of its layer. The sprite stands about two layers tall, so drawing it before
    // the layers above would let the rim walls cover its head.
    var sMid = mcx + mcz, sEnd = xhi - 1 + zhi - 1;
    // helper diggers stand in the miner's layer: those on the back diagonals are drawn with the miner,
    // the others in the front half, each after the cubes on its own diagonal
    var crew = S.mode === 'dig' && r ? helperSpots(S, g, r) : [];
    function drawCrew(s0, s1) { crew.forEach(function (h) { var hs = Math.floor(h.x) + Math.floor(h.z); if (hs >= s0 && hs <= s1) drawHelper(h, S); }); }
    // part: 'back' draws the miner's layer up to its diagonal inside the pit (and all of it outside);
    // 'front' draws the rest of the pit, which must go over the miner and the walls above
    function layer(y, s0, s1, last, part) {
      // a layer whose front-most cube is still above the top of the screen draws nothing
      if (y !== minerLayer && y !== 1 && oy + sEnd * hh + y * bh + TW < 0) return;
      var dark = y > viewTop ? Math.min(0.8, (y - viewTop) * 0.065) : 0;
      // walk diagonals back to front: s = x + z
      for (var s = s0; s <= s1; s++) {
        var pitHere = part !== 'back' || s <= sMid; // ladder, torches and pit cells on this diagonal
        if (pitHere) {
          if (s === LADDER_Z && y <= ladderBot) ladder(y);
          if (s === 5 && y % 6 === 3) torch(0.03, y, 5.5, 'x', y >= viewTop && D.passable(g.t[D.idx(0, y, 5)]) || y < viewTop);
          if (s === 2 && y % 6 === 0 && y > 0) torch(2.5, y, 0.03, 'z', y >= viewTop && D.passable(g.t[D.idx(2, y, 0)]) || y < viewTop);
        }
        for (var x = Math.max(xlo, s - (zhi - 1)); x <= Math.min(xhi - 1, s - zlo); x++) {
          var z = s - x;
          if (inPit(x, z) ? !pitHere : part === 'front') continue;
          if (!solid(x, y, z)) {
            if (inPit(x, z) && y >= viewTop && g.t[D.idx(x, y, z)] === T.BUBBLE) bubble(x, y, z);
            continue;
          }
          if (solid(x + 1, y, z) && solid(x, y, z + 1) && solid(x, y - 1, z)) continue; // hidden
          var q = P(x, y, z);
          if (q[0] + hw < 0 || q[0] - hw > vw || q[1] > vh || q[1] + TW < 0) continue;
          var spr, pit = inPit(x, z), i = pit ? D.idx(x, y, z) : -1, tt = pit ? g.t[i] : T.DIRT;
          var side = texKey(tt, pit ? g.v[i] : 0, y);
          if (!pit && y > 1) side = 'dirt' + layerOf(y);
          var hc = y === 1 && !pit ? D.hubCell(x, z) : '';
          var top = y === 1 && (tt === T.DIRT || !pit) ? groundTex(hc, x, z) : side;
          spr = cube(w, top, side === 'grass' ? 'dirt0' : side);
          var gh = pit && y === viewTop && S.mode !== 'surface' && ghost[x + ',' + z];
          if (gh) ctx.globalAlpha = 0.32;
          ctx.drawImage(spr, q[0] - hw, q[1]);
          ctx.globalAlpha = 1;
          var dk = dark + (!pit && y > 1 ? 0.3 : 0);
          if (dk > 0 && !gh) { ctx.globalAlpha = dk; ctx.drawImage(hx, q[0] - hw, q[1]); ctx.globalAlpha = 1; }
          if (!gh && !solid(x, y - 1, z) && y > viewTop - 1) {
            if (solid(x - 1, y - 1, z)) ao(x, y, z, 1, 0);
            if (solid(x, y - 1, z - 1)) ao(x, y, z, 0, 1);
          }
          if (y === 1 && !pit && surfaceView && hc === '.') decor(x, z, id);
          if (y === 1 && PADS[hc] && surfaceView) pad(x, z, hc, S);
          if (pit) decorate(x, y, z, tt, i, q, w, S, g, i === tgt);
        }
        if (part === 'front') drawCrew(s, s);
      }
      if (last && y === 1) { // things standing on the surface: scenery and (at the surface) the miner
        var items = [];
        if (P(xlo, 0, zlo)[1] < vh && P(xhi, 1, zhi)[1] > -TW * 3) hubProps(S, items, surfaceView);
        if (surfaceView) hubPeople(S, items);
        if (viewTop === 0 && !minerDrawn) items.push(feet(disp.x + 0.5, disp.z + 0.5, drawMinerNow));
        depthSort(items).forEach(function (it) { it.fn(); });
        if (surfaceView) shafts(id);
      }
    }
    var split = minerLayer >= 1 && minerLayer <= yBot;
    for (var y = yBot; y >= 1; y--) layer(y, xlo + zlo, sEnd, !(split && y === minerLayer), split && y === minerLayer ? 'back' : null);
    if (split) { drawMinerNow(); drawCrew(-Infinity, sMid); layer(minerLayer, sMid + 1, sEnd, true, 'front'); }
    else drawCrew(-Infinity, Infinity);
    drawMinerNow();
    // moon loot, particles and floating text on top
    if (r && r.loot) r.loot.forEach(function (l) { var q = P(l.x, l.y, l.z), sz = TW * 0.34; ctx.imageSmoothingEnabled = false; ctx.drawImage(itemIcon(l.item), Math.round(q[0] - sz / 2), Math.round(q[1] - sz / 2), sz, sz); });
    for (var k = 0; k < parts.length; k++) { var p = parts[k], pq = P(p.x, p.y, p.z); ctx.fillStyle = p.c; ctx.fillRect(pq[0], pq[1], p.s * TW, p.s * TW); }
    // headlamp: darkness grows with depth, with a pool of light around the miner
    if (lastMiner && post) lamp(S, viewTop);
    if (lastMiner && viewTop > 2 && !post) {
      var depthF = Math.min(1, viewTop / 60), lx = lastMiner[0], ly = lastMiner[1] - TW * 0.5;
      var gr = ctx.createRadialGradient(lx, ly, TW * 0.8, lx, ly, TW * 4.2);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + (0.25 + 0.4 * depthF) + ')');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, vh);
      var fd = FACE[disp.face] || FACE.e, dirx = fd.flip ? -1 : 1, diry = fd.back ? -0.5 : 0.5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var bx = lx + dirx * TW * 0.25, by = ly - TW * 0.15;
      var lg = ctx.createRadialGradient(bx, by, 0, bx, by, TW * 1.6);
      lg.addColorStop(0, 'rgba(255,240,170,0.28)'); lg.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.lineTo(bx + dirx * TW * 1.6, by + diry * TW * 1.6 - TW * 0.5); ctx.lineTo(bx + dirx * TW * 1.6, by + diry * TW * 1.6 + TW * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (id === 'ocean') { // underwater tint and drifting bubbles
      ctx.fillStyle = 'rgba(40,140,210,0.13)'; ctx.fillRect(0, 0, vw, vh);
      for (var a = 0; a < 14; a++) { var ax = ((a * 0.73) % 1) * vw + Math.sin(time + a) * TW * 0.1, ay = vh - ((time * (20 + a * 3) * TW / 32 + a * 97) % (vh + 20)); ctx.fillStyle = '#bff7ff66'; ctx.fillRect(ax, ay, TW * 0.06, TW * 0.06); }
    } else if (id === 'alien') {
      for (var b = 0; b < 12; b++) { var bx2 = ((b * 0.61) % 1) * vw, by2 = vh - ((time * (14 + b * 2) * TW / 32 + b * 71) % (vh + 20)); ctx.fillStyle = '#9dff8a66'; ctx.fillRect(bx2, by2, TW * 0.06, TW * 0.06); }
    }
    motes(id, viewTop);
    if (surfaceView) hubLabels(S);
    for (var fi = 0; fi < floaters.length; fi++) {
      var fl = floaters[fi], fq = P(fl.x, fl.y, fl.z);
      octx.globalAlpha = Math.min(1, fl.life * 2);
      var pop = fl.icon ? 1 + (fl.big ? 0.5 : 0.25) * Math.max(0, Math.sin(Math.min(1, (fl.age || 0) / 0.5) * Math.PI)) : 1; // short bounce
      var fs = Math.max(fl.icon ? 22 : 16, Math.round(TW * (fl.icon ? (fl.big ? 0.62 : 0.52) : 0.4) * pop));
      octx.font = '700 ' + fs + 'px Fredoka, sans-serif'; octx.textAlign = 'center'; octx.lineJoin = 'round';
      var tx = fq[0], ty = fq[1];
      if (fl.icon) { // big icon above the text, both centred on the spot and kept on screen
        var isz = Math.max(72, Math.round(TW * (fl.big ? 1.9 : 1.4) * pop / 12) * 12);
        isz = Math.min(isz, Math.floor(Math.min(vw, vh) * 0.4 / 12) * 12 || 12);
        tx = Math.max(vw * 0.2, Math.min(vw * 0.8, tx)); ty = Math.max(isz + fs + 20, Math.min(vh - 20, ty));
        var ix = Math.round(tx - isz / 2), iy = Math.round(ty - fs - isz - 4);
        octx.imageSmoothingEnabled = false;
        octx.fillStyle = '#000a'; roundRect(octx, ix - 6, iy - 6, isz + 12, isz + 12, 10); octx.fill();
        octx.drawImage(fl.icon, ix, iy, isz, isz);
      }
      octx.lineWidth = Math.max(4, fs * 0.22); octx.strokeStyle = '#000'; octx.strokeText(fl.text, tx, ty);
      octx.fillStyle = fl.c; octx.fillText(fl.text, tx, ty); octx.globalAlpha = 1;
    }
    if (post) composite(S, w, viewTop, surfaceView);
  }
  // station names over the pads, the museum's name over its door, and a plaque by the nearest exhibit
  function tagText(x, y, text, size, fill, bg) {
    octx.font = 'bold ' + Math.round(size) + 'px Fredoka, sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
    if (bg) { var wd = octx.measureText(text).width + size * 0.9, hgt = size * 1.5; octx.fillStyle = bg; roundRect(octx, x - wd / 2, y - hgt / 2, wd, hgt, hgt * 0.35); octx.fill(); }
    octx.fillStyle = '#0008'; octx.fillText(text, x + 1, y + 2); octx.fillStyle = fill; octx.fillText(text, x, y); octx.textBaseline = 'alphabetic';
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function hubLabels(S) {
    var sz = Math.max(11, TW * 0.24);
    padLabels.forEach(function (l) {
      var q = P(l[0], 1, l[1]), bob = Math.sin(time * 3 + l[0]) * TW * 0.05, info = PADS[l[2]];
      tagText(q[0], q[1] - TW * 1.25 + bob, info[0] + ' ' + info[1], sz, l[3] ? '#ffd23f' : '#fff7e8', 'rgba(26,19,40,0.72)');
    });
    var dq = P(HUB_DOOR[0], -1.2, HUB_DOOR[1] + 1);
    tagText(dq[0], dq[1], '🏛️ MUSEUM', sz * 1.25, '#ffe9a8', 'rgba(90,58,36,0.85)');
    if (S.mode !== 'surface') return;
    // creature names in front of each plinth of an open wing (a ? until its first bone is found)
    var nearK = S.mode === 'surface' && D.hubNearExhibit(S);
    nearK = nearK && nearK.creature >= 0 ? nearK.world * 3 + nearK.creature : -1;
    for (var pk = 0; pk < 15; pk++) {
      if (pk === nearK) continue; // the big plaque below names this one
      var pw = Math.floor(pk / 3), pc = pk % 3, pb = plinthBlock(pk);
      if (!S.unlocked[pw] || !pb) continue;
      var n = D.piecesFound(S, pw, pc), lq = P((pb.x0 + pb.x1) / 2, 1, pb.z1 + 0.15);
      tagText(lq[0], lq[1] + TW * 0.12, n ? (n === 5 ? '✓ ' : '') + D.WORLDS[pw].creatures[pc].name : '?', sz * 0.8, n === 5 ? '#b6f2a0' : n ? '#ffe9a8' : '#b9a9d6', 'rgba(26,19,40,0.6)');
    }
    if (S.mode !== 'surface') return;
    var ne = D.hubNearExhibit(S); if (!ne) return;
    var k = ne.world, wd = D.WORLDS[k], t1, t2, pq;
    if (ne.creature < 0) {
      var rb = hubBlocks().filter(function (bb) { return bb.c === 'abcde'.charAt(k); })[0]; pq = P((rb.x0 + rb.x1) / 2, -0.9, (rb.z0 + rb.z1) / 2);
      t1 = S.relics[k] ? '✨ ' + wd.relic.name : '🔒 Relic case'; t2 = S.relics[k] ? wd.name + ' relic' : 'Dig to ' + D.DEPTH + ' m in ' + wd.name;
    } else {
      var cr = wd.creatures[ne.creature], have = D.piecesFound(S, k, ne.creature), b = plinthBlock(k * 3 + ne.creature); pq = P((b.x0 + b.x1) / 2, -0.9, (b.z0 + b.z1) / 2);
      t1 = S.unlocked[k] ? cr.name : '🔒 Wing ' + (k + 1);
      t2 = S.unlocked[k] ? (have === 5 ? '✓ Complete' : have + ' / 5 bones') : 'Bring home the relic from world ' + k;
    }
    tagText(pq[0], pq[1] - sz * 1.1, t1, sz * 1.05, '#ffe9a8', 'rgba(26,19,40,0.85)');
    tagText(pq[0], pq[1] + sz * 0.6, t2, sz * 0.85, '#b9a9d6', null);
  }
  // ---------- HD-2D extras ----------
  var GRADE = { // ambient tint, shadow tint, highlight tint per world
    forest: { amb: [1.0, 0.97, 0.9], sh: [0.9, 0.95, 1.1], hi: [1.06, 1.01, 0.9] },
    ocean: { lamp: 0.6, amb: [0.72, 0.86, 1.0], sh: [0.85, 0.97, 1.12], hi: [0.98, 1.04, 1.04] },
    jungle: { amb: [1.0, 1.0, 0.86], sh: [0.88, 1.0, 1.0], hi: [1.07, 1.03, 0.88] },
    moon: { lamp: 0.75, amb: [0.72, 0.76, 0.92], sh: [0.88, 0.92, 1.15], hi: [1.02, 1.01, 1.0] },
    alien: { amb: [0.92, 1.0, 0.94], sh: [1.0, 0.88, 1.12], hi: [0.98, 1.06, 0.96] }
  };
  function lamp(S, viewTop) {
    var lx = lastMiner[0], ly = lastMiner[1] - TW * 0.45, G = GRADE[D.WORLDS[S.world].id] || {};
    var depthF = Math.min(1, viewTop / 30) * (G.lamp || 1); // pale ground (sand, moon dust) needs less lamp
    if (S.mode === 'surface' || depthF <= 0) return;
    var fd = FACE[disp.face] || FACE.e, dirx = fd.flip ? -1 : 1, diry = fd.back ? -0.5 : 0.5;
    light(lx, ly, TW * 4.2, 0.7 * depthF, [1.0, 0.88, 0.7]);                                  // the headlamp's pool
    light(lx + dirx * TW * 1.1, ly + diry * TW * 0.9, TW * 2.2, 0.35 * depthF, [1.0, 0.95, 0.8]); // the beam
    var c = P(N / 2, viewTop + 1, N / 2);
    light(c[0], c[1], TW * 6.5, 0.28 * depthF, [0.78, 0.82, 1.0]);                                 // cool fill over the layer
    var hx = lx + dirx * TW * 0.25, hy = ly - TW * 0.15;
    glow(hx, hy, TW * 0.35, '#fff6b0', 0.9);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var lg = ctx.createRadialGradient(hx, hy, 0, hx, hy, TW * 1.8);
    lg.addColorStop(0, 'rgba(255,240,170,0.22)'); lg.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(hx, hy);
    ctx.lineTo(hx + dirx * TW * 1.8, hy + diry * TW * 1.8 - TW * 0.55); ctx.lineTo(hx + dirx * TW * 1.8, hy + diry * TW * 1.8 + TW * 0.65); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function composite(S, w, viewTop, surfaceView) {
    var id = D.WORLDS[w].id, G = GRADE[id] || GRADE.forest, r = S.run;
    var depthF = S.mode === 'surface' ? 0 : Math.min(1, Math.max(0, disp.y) / 30);
    var a = 1 - 0.74 * depthF, amb = [G.amb[0] * a, G.amb[1] * a, G.amb[2] * a];
    var focus;
    if (S.mode === 'dig') { // keep the whole working layer and the miner sharp
      var top = P(0, viewTop, 0)[1] - TW * 1.1, bot = P(N, viewTop + 1, N)[1] + TW * 0.2;
      focus = [top, bot, TW * 3.5, 1];
    } else if (surfaceView && lastMiner) {
      focus = [lastMiner[1] - TW * 4.5, lastMiner[1] + TW * 2.5, TW * 5, 0.85];
    } else if (lastMiner) focus = [lastMiner[1] - TW * 2, lastMiner[1] + TW, TW * 3, 1];
    else focus = [0, vh, 1, 0];
    // brightest lights first, nearest the miner
    if (lastMiner && lights.length > DTWPost.MAXL) {
      var mx = lastMiner[0], my = lastMiner[1];
      lights.sort(function (p, q) { return (Math.hypot(p.x - mx, p.y - my) / p.i) - (Math.hypot(q.x - mx, q.y - my) / q.i); });
    }
    DTWPost.render(scv, ecv, {
      lights: lights, amb: amb, focus: focus, time: time,
      scale: Math.max(0.6, Math.min(3, TW / 80)),
      // underground only the emissive layer blooms
      bloom: 0.9, thr: surfaceView ? 0.93 : 9, sat: 1.14, vig: surfaceView ? 0.3 : 0.42,
      caustic: id === 'ocean' ? 0.22 : 0, shadowTint: G.sh, hiTint: G.hi
    });
  }
  // small pixel details on surface tiles: flowers, blades, shells, craters, glowing spots
  function decor(x, z, id) {
    var h = ((x + 40) * 7349 ^ (z + 40) * 9157) * 2654435761 >>> 0, u = TW / 16;
    if (h % 3) return;
    var fx = 0.2 + ((h >>> 4) % 60) / 100, fz = 0.2 + ((h >>> 10) % 60) / 100, q = P(x + fx, 1, z + fz), k = (h >>> 16) % 4;
    if (id === 'forest' || id === 'jungle') {
      ctx.fillStyle = 'rgba(20,70,20,0.55)'; ctx.fillRect(q[0] - u, q[1] - 2 * u, u * 0.7, 2 * u); ctx.fillRect(q[0] + u * 0.5, q[1] - 3 * u, u * 0.7, 3 * u); ctx.fillRect(q[0] + 2 * u, q[1] - 2 * u, u * 0.7, 2 * u);
      if (k < 2) { ctx.fillStyle = ['#ffeb3b', '#ff7eb6', '#ffffff', '#8fd3ff'][(h >>> 20) % 4]; ctx.fillRect(q[0] + u * 3, q[1] - u * 2, u * 1.4, u * 1.4); }
    } else if (id === 'ocean') {
      ctx.fillStyle = k ? '#f7d6c0' : '#ff9fb0'; ctx.fillRect(q[0], q[1] - u, u * 2, u * 1.2); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(q[0], q[1] + u * 0.2, u * 2, u * 0.5);
    } else if (id === 'moon') {
      var rr = u * (2 + k); ctx.fillStyle = 'rgba(40,40,70,0.28)'; ctx.beginPath(); ctx.ellipse(q[0], q[1], rr, rr * 0.5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = u * 0.6; ctx.beginPath(); ctx.ellipse(q[0], q[1], rr, rr * 0.5, 0, 0.2, 2.9); ctx.stroke();
    } else if (id === 'alien') {
      var c = k % 2 ? '#7df9ff' : '#ff7ef0'; ctx.fillStyle = c; ctx.fillRect(q[0], q[1] - u, u * 1.5, u * 1.5); glow(q[0], q[1], TW * 0.25, c, 0.6);
    }
  }
  // contact shadow: three fading strips along the back edge of a top face that meets a taller block
  function ao(x, y, z, ex, ez) {
    var A = [0.26, 0.15, 0.07];
    for (var k = 0; k < 3; k++) {
      var a = k * 0.09, b = a + 0.09;
      ctx.fillStyle = 'rgba(0,0,0,' + A[k] + ')';
      if (ex) poly([P(x + a, y, z), P(x + b, y, z), P(x + b, y, z + 1), P(x + a, y, z + 1)], ctx.fillStyle);
      else poly([P(x, y, z + a), P(x, y, z + b), P(x + 1, y, z + b), P(x + 1, y, z + a)], ctx.fillStyle);
    }
  }
  // a wall torch: bracket, stick and a flickering flame that lights the pit
  function torch(x, y, z, wall, lit) {
    var base = P(x, y + 0.62, z), u = Math.max(1, Math.round(TW / 32));
    var f = 0.8 + 0.2 * Math.sin(time * 13 + y) * Math.sin(time * 7.3 + y * 2);
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(base[0] - 2 * u, base[1] - u, 4 * u, 2 * u);
    ctx.fillStyle = '#7a4f2a'; ctx.fillRect(base[0] - u, base[1] - 9 * u, 2 * u, 9 * u);
    var fy = base[1] - 9 * u, fh = Math.round((5 + 2 * f) * u);
    ctx.fillStyle = '#ff7a1a'; ctx.fillRect(base[0] - 2 * u, fy - fh, 4 * u, fh);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(base[0] - u, fy - fh + 2 * u, 2 * u, fh - 2 * u);
    ctx.fillStyle = '#fff6c0'; ctx.fillRect(base[0] - u, fy - 3 * u, u, 2 * u);
    if (!lit) return;
    glow(base[0], fy - fh / 2, TW * 0.7 * f, '#ff9a3a', 0.85);
    light(base[0], fy - fh / 2, TW * 3.4, 0.85 * f, [1.0, 0.62, 0.28]);
  }
  // sun shafts slanting across the surface
  function shafts(id) {
    if (id === 'moon') return;
    var col = id === 'ocean' ? '#bff7ff' : id === 'alien' ? '#c8ffb0' : '#fff3c0';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 5; k++) {
      var x0 = vw * (0.08 + k * 0.21) + Math.sin(time * 0.3 + k * 1.7) * TW * 0.6, wd = TW * (0.7 + (k % 3) * 0.45);
      var g = ctx.createLinearGradient(0, 0, 0, vh); g.addColorStop(0, rgba(col, 0.11)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, -10); ctx.lineTo(x0 + wd, -10); ctx.lineTo(x0 + wd - vh * 0.45, vh); ctx.lineTo(x0 - vh * 0.45, vh); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // dust, pollen or spores drifting through the light
  var MOTES = []; for (var mi = 0; mi < 46; mi++) MOTES.push([Math.random(), Math.random(), 0.3 + Math.random(), Math.random() * 6.3]);
  function motes(id, viewTop) {
    var col = viewTop > 1 ? '#ffe2b0' : id === 'alien' ? '#b0ffa0' : id === 'moon' ? '#dfe6ff' : id === 'ocean' ? '#d8fbff' : '#fff3c0';
    var u = Math.max(1, Math.round(TW / 30));
    for (var i = 0; i < MOTES.length; i++) {
      var m = MOTES[i], x = ((m[0] * vw + Math.sin(time * 0.4 * m[2] + m[3]) * TW * 0.8) % vw + vw) % vw;
      var y = ((m[1] * vh - time * TW * 0.12 * m[2]) % vh + vh) % vh, a = 0.35 + 0.35 * Math.sin(time * 1.5 + m[3]);
      ctx.fillStyle = rgba(col, a); ctx.fillRect(x, y, u, u);
      if (i % 3 === 0) glow(x, y, TW * 0.12, col, a * 0.6);
    }
  }
  var lastMiner = null;
  // one layer of ladder on the x = 0 wall face: two rails and three rungs (plus the rail tops above the rim)
  function ladder(y) {
    var z0 = LADDER_Z + 0.22, z1 = LADDER_Z + 0.78, top = y === 1 ? 0.25 : y, bot = y + 1, xw = 0.02;
    ctx.lineCap = 'square';
    ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = Math.max(2, TW / 14);
    seg(xw, top, z0, xw, bot, z0); seg(xw, top, z1, xw, bot, z1);
    ctx.strokeStyle = '#c08a52'; ctx.lineWidth = Math.max(1, TW / 22);
    for (var k = 0; k < 3; k++) { var ry = y + 0.2 + k / 3; seg(xw, ry, z0, xw, ry, z1); }
    if (y === 1) { seg(xw, 0.55, z0, xw, 0.55, z1); seg(xw, 0.85, z0, xw, 0.85, z1); }
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(1, TW / 28);
    seg(xw, top, z0, xw, bot, z0); seg(xw, top, z1, xw, bot, z1);
  }
  function seg(x0, y0, z0, x1, y1, z1) { var a = P(x0, y0, z0), b = P(x1, y1, z1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  function bubble(x, y, z) {
    var q = P(x + 0.5, y + 0.5, z + 0.5), bb = Math.sin(time * 3 + x + z) * TW * 0.04;
    ctx.strokeStyle = '#bff7ff'; ctx.lineWidth = Math.max(1, TW / 28);
    ctx.beginPath(); ctx.arc(q[0], q[1] + bb, TW * 0.2, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffffffaa'; ctx.fillRect(q[0] - TW * 0.1, q[1] + bb - TW * 0.1, TW * 0.06, TW * 0.06);
  }
  function decorate(x, y, z, tt, i, q, w, S, g, isTarget) {
    var top = [q[0], q[1] + hh];
    if (tt === T.FOSSIL || tt === T.CHEST || (tt === T.ORE && g.v[i] === 3)) { // sparkle so kids spot treasure
      var ph = (time * 2 + x * 1.7 + y * 0.9 + z * 1.3) % 3;
      if (ph < 0.4) { ctx.fillStyle = 'rgba(255,255,255,' + (0.9 - ph * 2) + ')'; ctx.fillRect(top[0] + hw * 0.3, top[1] - hh * 0.4, TW * 0.06, TW * 0.06); glow(top[0] + hw * 0.3, top[1] - hh * 0.4, TW * 0.25, '#ffffff', 0.9 - ph * 2); }
    }
    if (post && y <= Math.floor(disp.y) + 3) {
      var cq = P(x + 0.5, y + 0.15, z + 0.5);
      if (tt === T.ORE) { var oc = D.WORLDS[w].ores[g.v[i]].color, k = 0.25 + 0.2 * g.v[i]; glow(cq[0], cq[1], TW * (0.4 + 0.1 * g.v[i]), oc, k * (0.8 + 0.2 * Math.sin(time * 2 + x + z))); if (g.v[i] >= 2) light(cq[0], cq[1], TW * 1.5, 0.35, oc); }
      else if (tt === T.GOO) { glow(cq[0], cq[1], TW * 0.45, '#5dff7a', 0.16); light(cq[0], cq[1], TW * 1.3, 0.12, '#5dff7a'); }
      else if (tt === T.RELIC) { glow(cq[0], cq[1], TW * 1.2, D.WORLDS[w].relic.color, 0.8); light(cq[0], cq[1], TW * 3, 0.9, D.WORLDS[w].relic.color); }
      else if (tt === T.CHEST || tt === T.FOSSIL) glow(cq[0], cq[1], TW * 0.35, '#ffe9a8', 0.3);
    }
    if (tt === T.RELIC && !S.relics[w]) { ctx.globalAlpha = 0.15 + 0.15 * Math.sin(time * 3); ctx.fillStyle = '#ffd23f'; hexPath(ctx, q[0] - hw, q[1]); ctx.fill(); ctx.globalAlpha = 1; }
    if (!isTarget) return;
    var mh = D.maxHp(w, tt, y);
    if (!(mh > 0 && isFinite(mh) && g.hp[i] < mh)) return;
    var dmg = 1 - g.hp[i] / mh, r = S.run, c;
    if (y > r.y) c = top; // digging down: cracks on the top face
    else c = P(x + 0.5 - (x - r.x) * 0.5, y + 0.5, z + 0.5 - (z - r.z) * 0.5); // the face toward the miner
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = Math.max(1, TW / 24);
    ctx.beginPath(); var n = 1 + Math.floor(dmg * 4);
    for (var k = 0; k < n; k++) { var a = k * 1.9 + 0.5; ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + Math.cos(a) * hw * 0.7 * dmg, c[1] + Math.sin(a) * hh * 0.7 * dmg); }
    ctx.stroke();
  }

  // ---------- effects API ----------
  function spawnBreak(x, y, z, color, n) {
    for (var i = 0; i < n; i++) parts.push({ x: x + 0.5, y: y + 0.4, z: z + 0.5, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 4, vz: (Math.random() - 0.5) * 3, life: 0.5 + Math.random() * 0.4, c: color, s: 0.05 + Math.random() * 0.05 });
  }
  // floating text, with the find's pixel icon in front of it when an item is given
  function floatText(x, y, z, text, color, it) { floaters.push({ x: x, y: y, z: z, text: text, c: color || '#fff', life: it ? 2.6 : 1.3, age: 0, big: !!(it && it.kind === 'fossil'), icon: it ? itemIcon(it) : null }); }
  function itemIcon(it) { return DTWSprites.item(it.kind, it.idx || 0, itemColor(it), D.WORLDS[it.world].id === 'moon'); }
  // swipe on screen -> compass direction. In this projection +x runs down-right and +z down-left.
  function screenDir(dx, dy) {
    if (dx >= 0 && dy >= 0) return 'e';
    if (dx < 0 && dy >= 0) return 's';
    if (dx < 0 && dy < 0) return 'w';
    return 'n';
  }
  return {
    init: function (canvas, overlay) {
      cv = canvas; ov = overlay || null;
      var off = /[?&]hd=0\b/.test(location.search);
      post = !off && typeof DTWPost !== 'undefined' && DTWPost.init(cv);
      if (post) { scv = document.createElement('canvas'); ctx = scv.getContext('2d'); ecv = document.createElement('canvas'); ectx = ecv.getContext('2d'); }
      else ctx = cv.getContext('2d');
      octx = ov && post ? ov.getContext('2d') : ctx;
      resize();
      console.info('Dig Through Worlds renderer: ' + (post ? 'HD-2D (WebGL2 post-process)' : 'plain 2D'));
    },
    get hd() { return post; },
    resize: resize, update: update, draw: draw,
    setView: function (v) { view = v; },
    spawnBreak: spawnBreak, floatText: floatText, shake: function (t) { shakeT = Math.max(shakeT, t); },
    swingKick: function () { disp.boost = 1; },
    // the point on the ground (y = 1) under a pointer, in plaza cells
    groundAt: function (cx, cy) {
      var rc = cv.getBoundingClientRect(), k = vw / Math.max(1, rc.width);
      var sx = (cx - rc.left) * k, sy = (cy - rc.top) * k, a = (sx - ox) / hw, b = (sy - oy - bh) / hh;
      return [(a + b) / 2, (b - a) / 2];
    },
    // the pit cell (x, z) whose top face at depth y is under a pointer
    cellAt: function (cx, cy, y) {
      var rc = cv.getBoundingClientRect(), k = vw / Math.max(1, rc.width);
      var sx = (cx - rc.left) * k, sy = (cy - rc.top) * k, a = (sx - ox) / hw, b = (sy - oy - y * bh) / hh;
      return [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
    },
    drawItem: drawItem, itemColor: itemColor, layerOf: layerOf, screenDir: screenDir, pickTier: pickTier,
    get dispY() { return disp.y; }
  };
})();
