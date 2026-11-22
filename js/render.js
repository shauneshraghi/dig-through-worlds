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
  var golden = false; // the golden replay: bones in the ground are gold (set from the state each frame)
  var time = 0, shakeT = 0, parts = [], floaters = [], shocks = [];
  // smoothed camera and miner display state
  var cam = { fx: 3.5, fy: 1, fz: 3.5, zoom: 0.62, anchor: 0.17, init: false };
  var disp = { x: 3, y: 0, z: 3, face: 'e', phase: 0, boost: 0, world: -1, spd: 0, walk: 0, air: 0, land: 0, hit: 0, blink: 2 };

  // ---------- helpers ----------
  function shade(hex, amt) {
    var m = hex.charAt(0) === 'r' && hex.match(/\d+/g); // also takes its own rgb() output
    var c = m ? (+m[0] << 16) | (+m[1] << 8) | +m[2] : parseInt(hex.slice(1, 7), 16), r = c >> 16, g = c >> 8 & 255, b = c & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function rgba(hex, a) { var c = parseInt(hex.slice(1, 7), 16); return 'rgba(' + (c >> 16) + ',' + (c >> 8 & 255) + ',' + (c & 255) + ',' + a + ')'; }
  function rgb3(hex) { var c = parseInt(hex.slice(1, 7), 16); return [(c >> 16) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]; }
  // a soft additive glow on the emissive layer: it feeds the bloom
  function hexRgb(h) { var c = parseInt(h.slice(1, 7), 16); return [c >> 16, c >> 8 & 255, c & 255]; }
  var hal = [], nightFx = false; // plain 2D at night: glows and lights are kept and drawn as additive halos after the tint
  function glow(x, y, r, col, a) {
    if (r <= 0) return;
    if (!post) { if (nightFx) hal.push({ x: x, y: y, r: r * 0.55, c: hexRgb(col), a: a * 0.45 }); return; }
    var g = ectx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(0.4, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
    ectx.fillStyle = g; ectx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // a screen-space point light for the post pass: centre, radius, intensity, colour
  function light(x, y, r, i, col) {
    var c = typeof col === 'string' ? rgb3(col) : col;
    if (post) lights.push({ x: x, y: y, r: r, i: i, c: c });
    else if (nightFx) hal.push({ x: x, y: y, r: r * 0.9, c: [c[0] * 255, c[1] * 255, c[2] * 255], a: Math.min(0.55, i * 0.45) });
  }
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
  function ln(c, x0, y0, x1, y1, col) { // a one-pixel line
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (var i = 0; i <= n; i++) px(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col);
  }
  function boneG(c) { // a gold bone, for fossil blocks once the game is finished
    var a = '#ffd23f', d = '#b8801a';
    px(c, 4, 7, a, 8, 2); px(c, 3, 6, a, 2, 2); px(c, 3, 8, a, 2, 2); px(c, 11, 6, a, 2, 2); px(c, 11, 8, a, 2, 2);
    px(c, 5, 9, d, 6, 1); px(c, 5, 7, '#fff3b0', 4, 1);
  }
  function textures(w) {
    if (TEX[w]) return TEX[w];
    var W = D.WORLDS[w], P_ = W.pal, t = {}, r = prng(w * 99 + 7), id = W.id;
    for (var L = 0; L < 3; L++) (function (L) {
      t['dirt' + L] = mk(function (c) { noiseFill(c, P_.dirt[L], r, 40); if (id === 'moon') for (var i = 0; i < 2; i++) { var x = r() * 12 | 0, y = r() * 12 | 0; px(c, x, y, shade(P_.dirt[L], -0.25), 3, 1); px(c, x, y + 1, shade(P_.dirt[L], 0.15), 3, 1); } });
      t['stone' + L] = mk(function (c) { noiseFill(c, shade(P_.stone, -0.1 * L), r, 30); px(c, 2, 4, shade(P_.stone, 0.25), 5, 1); px(c, 9, 10, shade(P_.stone, 0.25), 4, 1); px(c, 3, 12, shade(P_.stone, -0.35), 6, 1);
        for (var i = 0; i < 7; i++) { var x = r() * 15 | 0, y = r() * 15 | 0; px(c, x, y, shade(P_.stone, -0.32 - 0.08 * L), 2, 1); px(c, x, y + 1, shade(P_.stone, -0.15), 1, 1); px(c, r() * 16 | 0, r() * 16 | 0, shade(P_.stone, 0.3)); } });
      for (var k = 0; k < 6; k++) (function (k) { t['ore' + L + '_' + k] = mk(function (c) { noiseFill(c, P_.dirt[L], r, 30); gem(c, W.ores[k].color, r, 2 + (k > 2 ? 1 : 0)); }); })(k);
      t['fossil' + L] = mk(function (c) { noiseFill(c, P_.dirt[L], r, 30); if (id === 'moon') { px(c, 4, 4, '#cfd8dc', 8, 8); px(c, 5, 5, '#78909c', 6, 6); px(c, 7, 2, '#cfd8dc', 2, 12); px(c, 2, 7, '#cfd8dc', 12, 2); px(c, 7, 7, '#ffd23f', 2, 2); } else bone(c); px(c, 0, 0, '#ffe9a8'); px(c, 15, 15, '#ffe9a8'); });
      t['fossilG' + L] = mk(function (c) { noiseFill(c, P_.dirt[L], r, 30); boneG(c); px(c, 0, 0, '#fff3b0'); px(c, 15, 15, '#fff3b0'); px(c, 1, 0, '#ffd23f'); px(c, 15, 14, '#ffd23f'); });
      t['goo' + L] = mk(function (c) { noiseFill(c, '#3fbf5a', r, 30); px(c, 0, 0, '#9dff8a', 16, 2); px(c, 3, 2, '#9dff8a', 2, 3); px(c, 10, 2, '#9dff8a', 2, 5); px(c, 5, 7, '#cfffc4', 2, 2); px(c, 11, 11, '#1f7a33', 3, 2); });
    })(L);
    [[0, 0], [-0.07, 0.02], [0.05, -0.03], [-0.03, 0.06]].forEach(function (v, k) { // plaza grass, four tints so the lawn reads as one field
      var tc = rgb3(P_.top), ol = id === 'forest' || id === 'jungle' ? 0.3 : 0; // forest lawns lean olive, less lime
      var base = shade('rgb(' + [0.43, 0.49, 0.17].map(function (o, j) { return Math.round(255 * (tc[j] * (1 - ol) + o * ol)); }).join(',') + ')', v[0]);
      t['grass' + k] = mk(function (c) {
        noiseFill(c, base, r, 46);
        for (var i = 0; i < 5; i++) { var x = r() * 14 | 0, y = r() * 14 | 0; px(c, x, y, shade(base, -0.16), 3, 2); px(c, x + 1, y + 2, shade(base, -0.1), 2, 1); }
        for (var j = 0; j < 9; j++) { var bx = r() * 16 | 0, by = 1 + r() * 15 | 0; px(c, bx, by, shade(base, 0.22 + v[1])); px(c, bx, by - 1, shade(base, 0.34)); }
        if (k === 3) { px(c, r() * 15 | 0, r() * 15 | 0, '#e8d88a'); px(c, r() * 15 | 0, r() * 15 | 0, '#c9e07a'); }
      });
    });
    t.root = mk(function (c) { noiseFill(c, '#4a2f17', r, 20); for (var x = 0; x < 16; x++) { var y = 7 + Math.round(Math.sin(x * 0.8) * 2); px(c, x, y - 2, '#7a4f2a', 1, 5); px(c, x, y - 2, '#9a6a3a'); } });
    t.trap = mk(function (c) { // a pale cracked slab with glowing red cracks and a faint warning diamond, unlike plain dirt or stone
      noiseFill(c, '#9a927a', r, 14); px(c, 1, 1, '#6a6450', 14, 1); px(c, 1, 14, '#6a6450', 14, 1);
      var d = '#c0392b'; px(c, 7, 6, d, 2, 1); px(c, 6, 7, d, 4, 2); px(c, 7, 9, d, 2, 1); px(c, 7, 7, '#e9806a', 2, 2); // diamond rune
      var cr = [[8, 0, 6, 3], [6, 3, 9, 5], [9, 5, 6, 8], [6, 8, 7, 11], [7, 11, 4, 15], [6, 3, 3, 4], [3, 4, 1, 3], [9, 5, 13, 4], [13, 4, 15, 5], [6, 8, 3, 9], [3, 9, 0, 8], [7, 11, 11, 12], [11, 12, 14, 11]];
      cr.forEach(function (s) { ln(c, s[0], s[1], s[2], s[3], '#1f1810'); });
      cr.forEach(function (s, i) { if (i < 5) ln(c, s[0] + 1, s[1], s[2] + 1, s[3], '#ff6a2a'); });
    });
    t.chest = mk(function (c) { // a wooden chest: planks, dark iron bands, a gold lock and trim
      noiseFill(c, '#a8622a', r, 14);
      for (var py = 3; py < 16; py += 4) px(c, 0, py, '#7a421a', 16, 1);
      px(c, 0, 5, '#3a2210', 16, 1); // lid seam
      px(c, 2, 0, '#34343f', 2, 16); px(c, 12, 0, '#34343f', 2, 16); px(c, 2, 0, '#6a6a7a', 1, 16); px(c, 12, 0, '#6a6a7a', 1, 16);
      px(c, 2, 2, '#c8c8d4'); px(c, 13, 2, '#c8c8d4'); px(c, 2, 12, '#c8c8d4'); px(c, 13, 12, '#c8c8d4');
      px(c, 0, 0, '#ffd23f', 16, 1); px(c, 0, 15, '#e0a820', 16, 1); // gold trim
      px(c, 6, 5, '#7a4f00', 4, 6); px(c, 6, 5, '#ffd23f', 4, 5); px(c, 7, 6, '#fff3b0', 1, 1); px(c, 7, 8, '#3a2210', 2, 2); // lock
    });
    t.chestTop = mk(function (c) {
      noiseFill(c, '#b8742f', r, 14);
      for (var px_ = 3; px_ < 16; px_ += 4) px(c, 0, px_, '#8a4b1c', 16, 1);
      px(c, 2, 0, '#34343f', 2, 16); px(c, 12, 0, '#34343f', 2, 16); px(c, 2, 0, '#6a6a7a', 1, 16); px(c, 12, 0, '#6a6a7a', 1, 16);
      px(c, 0, 0, '#ffd23f', 16, 1); px(c, 0, 15, '#ffd23f', 16, 1); px(c, 0, 0, '#ffd23f', 1, 16); px(c, 15, 0, '#e0a820', 1, 16);
      px(c, 7, 7, '#fff3b0', 2, 2);
    });
    t.chestR = mk(function (c) { // a treasure-room chest: the plain chest with thick gold trim, a jewel and a gold lock plate
      c.drawImage(t.chest, 0, 0);
      px(c, 0, 0, '#fff3b0', 16, 1); px(c, 0, 15, '#ffd23f', 16, 1); px(c, 0, 0, '#ffd23f', 1, 16); px(c, 15, 0, '#ffd23f', 1, 16); px(c, 1, 1, '#ffe27a', 14, 1); px(c, 1, 14, '#ffd23f', 14, 1);
      px(c, 5, 4, '#ffd23f', 6, 7); px(c, 6, 5, '#fff3b0', 4, 5); px(c, 7, 6, '#e8334a', 2, 3); px(c, 7, 6, '#ff9aa8');
    });
    t.chestTopR = mk(function (c) { c.drawImage(t.chestTop, 0, 0); px(c, 1, 1, '#ffe27a', 14, 1); px(c, 1, 14, '#ffe27a', 14, 1); px(c, 1, 1, '#ffe27a', 1, 14); px(c, 14, 1, '#ffe27a', 1, 14); px(c, 6, 6, '#e8334a', 4, 4); px(c, 7, 7, '#ff9aa8', 2, 2); });
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
      if (k.indexOf('grass') === 0 || k === 'stoneRim') return;
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
      case T.FOSSIL: return (golden ? 'fossilG' : 'fossil') + L;
      case T.GOO: return 'goo' + L;
      case T.ROOT: return 'root';
      case T.TRAP: return 'trap';
      case T.CHEST: return v === 1 ? 'chestR' : 'chest';
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
    if (top.indexOf('grass') !== 0) {
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0.5, hh); g.lineTo(hw, 2 * hh - 0.5); g.lineTo(TW - 0.5, hh); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; hexPath(g, 0, 0); g.stroke();
    }
    return (cubes[key] = c);
  }
  // A cell of a big fossil: a plain cube with its slice of the museum piece set into the top face, and into the
  // side faces that run along the fossil's length, so the blocks together show the whole bone.
  function fitPiece(g, pc, A, B) { // pc fitted into the rect [0, A] × [0, B] of the current transform, turned to its long axis
    var rot = A !== B && (pc.width >= pc.height) !== (A >= B), pw = rot ? pc.height : pc.width, ph = rot ? pc.width : pc.height;
    var s = Math.min((A - 0.12) / pw, (B - 0.12) / ph);
    g.translate(A / 2, B / 2); g.scale(s, s); if (rot) g.rotate(Math.PI / 2);
    g.drawImage(pc, -pc.width / 2, -pc.height / 2);
  }
  function darker(pc, a) {
    var key = 'dk' + a; if (pc[key]) return pc[key];
    var c = document.createElement('canvas'); c.width = pc.width; c.height = pc.height;
    var g = c.getContext('2d'); g.drawImage(pc, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.fillRect(0, 0, c.width, c.height);
    return (pc[key] = c);
  }
  function bigFossil(w, y, f) {
    var L = layerOf(y), key = golden + '|' + w + '|big|' + L + '|' + f.idx + '|' + f.w + 'x' + f.d + '|' + f.dx + ',' + f.dz + '|' + TW;
    if (cubes[key]) return cubes[key];
    var pc = DTWSprites.pieceCanvas(w * 3 + Math.floor(f.idx / D.PIECES), f.idx % D.PIECES, golden);
    var c = document.createElement('canvas'); c.width = TW; c.height = TW;
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(cube(w, 'dirt' + L, 'dirt' + L), 0, 0);
    function onFace(poly, m, A, B, pic) {
      g.save(); g.beginPath(); g.moveTo(poly[0], poly[1]); for (var i = 2; i < poly.length; i += 2) g.lineTo(poly[i], poly[i + 1]); g.closePath(); g.clip();
      g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); fitPiece(g, pic, A, B); g.restore();
    }
    var dx = f.dx, dz = f.dz;
    // top: u along x, v along z, in cells from the footprint's corner
    onFace([hw, 0, TW, hh, hw, 2 * hh, 0, hh], [hw, hh, -hw, hh, hw - dx * hw + dz * hw, -dx * hh - dz * hh], f.w, f.d, pc);
    // the +z face (lower left): along x, one block deep
    if (f.w > 1) onFace([0, hh, hw, 2 * hh, hw, 2 * hh + bh, 0, hh + bh], [hw, hh, 0, bh, -dx * hw, hh - dx * hh], f.w, 1, darker(pc, 0.22));
    // the +x face (lower right): along z, read left to right on screen
    if (f.d > 1) onFace([hw, 2 * hh, TW, hh, TW, hh + bh, hw, 2 * hh + bh], [hw, -hh, 0, bh, TW + dz * hw - f.d * hw, hh - dz * hh + f.d * hh], f.d, 1, darker(pc, 0.42));
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; hexPath(g, 0, 0); g.stroke();
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
    if (it.kind === 'fossil') return it.gold ? '#ffd23f' : '#f4ecd6';
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

  // ---------- finds: a broken block's ore, bone or chest hops out in the scene, waits, then flies into the rucksack ----------
  var finds = [], coinCv = null;
  function coinCanvas() {
    if (coinCv) return coinCv;
    var rows = ['  oooo  ', ' oYYGGo ', 'oYYGGGdo', 'oYGGdGdo', 'oGGGdGdo', 'oGGGGddo', ' oGddGo ', '  oooo  '], pal = { o: '#7a4b00', Y: '#fff3b0', G: '#ffd23f', d: '#d9a21b' };
    coinCv = document.createElement('canvas'); coinCv.width = coinCv.height = 8; var g = coinCv.getContext('2d');
    rows.forEach(function (row, y) { for (var x = 0; x < 8; x++) if (pal[row[x]]) { g.fillStyle = pal[row[x]]; g.fillRect(x, y, 1, 1); } });
    return coinCv;
  }
  var lidCache = null;
  function chestParts() { // the chest icon split into lid and body
    if (lidCache) return lidCache;
    var src = DTWSprites.item('treasure', 0, '#ffd23f', false), lid = document.createElement('canvas'), body = document.createElement('canvas');
    lid.width = body.width = src.width; lid.height = 4; body.height = src.height - 4;
    lid.getContext('2d').drawImage(src, 0, 2, src.width, 4, 0, 0, src.width, 4);
    body.getContext('2d').drawImage(src, 0, 6, src.width, src.height - 6, 0, 0, src.width, src.height - 6);
    return (lidCache = { lid: lid, body: body });
  }
  function findSprite(it) { return it.kind === 'treasure' ? coinCanvas() : itemIcon(it); }
  function findScale() { return TW / 26; }
  function findGlow(it, x, y, a, sc) {
    var col = it.kind === 'ore' ? (it.idx >= 3 ? itemColor(it) : null) : it.kind === 'relic' ? itemColor(it) : it.kind === 'treasure' ? '#ffd23f' : '#ffe9a8';
    if (!col) return;
    var big = it.kind === 'relic' ? 1.6 : 1;
    glow(x, y, TW * 0.7 * big * sc, col, 0.65 * a); light(x, y, TW * 2.2 * big, 0.4 * a, col);
  }
  function drawSprite(cv, x, y, s, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x - cv.width * s / 2), Math.round(y - cv.height * s / 2), Math.round(cv.width * s), Math.round(cv.height * s)); ctx.restore();
  }
  function cross(x, y, u, col, a) { ctx.fillStyle = col; ctx.globalAlpha = a; ctx.fillRect(x - u, y - u * 0.5, u * 2, u); ctx.fillRect(x - u * 0.5, y - u, u, u * 2); ctx.globalAlpha = 1; }
  // x, y, z: the broken block's cell (or the miner for a moon pick-up); opts: chest, pickup
  function spawnFind(x, y, z, it, label, opts) {
    opts = opts || {};
    var big = it.kind === 'fossil' || it.kind === 'relic', t0 = opts.chest && !opts.ghost && !opts.from ? 0.55 : 0, from = !!opts.from, ghost = !!opts.ghost;
    // from: the find flies from where it lay on the floor to the miner; ghost: only a chest hopping open (its find then lies on the floor)
    finds.push({ x: x + 0.5, y: y, z: z + 0.5, it: it, label: label, age: 0, big: big, chest: !!opts.chest, carried: !!(opts.carried || it.carried), pickup: !!opts.pickup, from: from, ghost: ghost, t0: t0,
      hop: from ? 0.01 : big ? 0.6 : 0.4, fly: ghost ? 0.9 : from ? 0.02 : opts.pickup ? 0 : t0 + (big ? 2.0 : 1.1), flyDur: ghost ? 0 : from ? 0.35 : opts.pickup ? 0 : 0.42, spark: ghost ? 0.3 : 0.4 });
    if (finds.length > 24) finds.shift();
  }
  function updateFinds(dt, S) {
    for (var i = finds.length - 1; i >= 0; i--) { var f = finds[i]; f.age += dt; if (f.age > Math.max(f.fly + f.flyDur + f.spark, f.pickup ? 1 : 0, f.from ? f.fly + f.flyDur + 1 : 0) || S.mode === 'surface') finds.splice(i, 1); }
  }
  function drawFinds() {
    for (var i = 0; i < finds.length; i++) {
      var f = finds[i], it = f.it, s = findScale() * (f.big ? 1.3 : 1), ti = f.age - f.t0, col = itemColor(it), sp = findSprite(it);
      var cy = f.y + 0.4, h = f.big ? 1.3 : 0.9, wy = cy, a = 1, restQ = P(f.x, cy, f.z), q = restQ, sc = 1, lbl = 0, pix = f.age - f.fly;
      var mq = lastMiner ? [lastMiner[0], lastMiner[1] - TW * (f.carried ? 0.35 : 0.5)] : restQ; // carried bones land on the miner's back, the rest in the rucksack
      if (f.chest) { // the chest hops, the lid swings open and the find spills out
        var cp = chestParts(), cu = Math.min(1, f.age / 0.3), cyy = cy - 0.35 * 4 * cu * (1 - cu) * (f.age < 0.3 ? 1 : 0);
        var cq = P(f.x, cyy, f.z), ca = f.age > f.fly ? Math.max(0, 1 - (f.age - f.fly) / 0.3) : 1, open = Math.max(0, Math.min(1, (f.age - 0.3) / 0.25));
        if (ca > 0) {
          ctx.save(); ctx.globalAlpha = ca; ctx.imageSmoothingEnabled = false;
          var cw = cp.body.width * s, bx = Math.round(cq[0] - cw / 2), by = Math.round(cq[1] - cp.body.height * s * 0.4);
          ctx.drawImage(cp.body, bx, by, Math.round(cw), Math.round(cp.body.height * s));
          ctx.translate(Math.round(cq[0] - cw / 2), by); // hinge at the back top edge of the body
          ctx.rotate(-open * 0.9); ctx.drawImage(cp.lid, 0, -Math.round(cp.lid.height * s), Math.round(cw), Math.round(cp.lid.height * s));
          ctx.restore();
          if (open > 0.2) { glow(cq[0], cq[1] - TW * 0.1, TW * 0.5, '#ffd23f', 0.5 * ca * open); light(cq[0], cq[1], TW * 1.6, 0.3 * ca * open, '#ffd23f'); }
        }
        cy -= 0.15;
      }
      if (f.pickup) { // moon loot that bounced into the miner: only a sparkle and the name
        q = mq; pix = f.age; sp = null; lbl = Math.max(0, Math.min(1, (0.95 - f.age) / 0.3));
      }
      if (f.ghost) sp = null;
      if (sp && ti >= 0 && pix < f.flyDur) {
        var u = Math.min(1, ti / f.hop), v = (ti - f.hop) / 0.22;
        if (ti < f.hop) wy = cy - h * 4 * u * (1 - u);
        else if (v >= 0 && v < 1) wy = cy - h * 0.3 * 4 * v * (1 - v);
        else wy = cy - 0.04 * (1 + Math.sin(time * 6 + i));
        q = P(f.x, wy, f.z);
        if (pix > 0) { var fu = pix / f.flyDur, e = fu * fu; q = [restQ[0] + (mq[0] - restQ[0]) * e, restQ[1] + (mq[1] - restQ[1]) * e - Math.sin(fu * Math.PI) * TW * 0.55]; sc = 1 - 0.55 * fu; a = 1 - 0.3 * fu * fu; }
        var pop = ti < 0.12 ? 0.6 + 0.4 * ti / 0.12 : 1;
        drawSprite(sp, q[0], q[1], s * sc * pop, a);
        findGlow(it, q[0], q[1], (it.kind === 'fossil' || it.kind === 'relic') ? 0.6 + 0.4 * Math.sin(time * 5 + i) : 0.7, sc);
        if (f.big && pix <= 0) for (var k = 0; k < 4; k++) { // twinkles around a fossil or relic while it waits
          var ph = (time * 1.3 + k * 0.25) % 1, ang = k * 1.7 + time * 0.8, rr = TW * (0.35 + 0.15 * ph);
          cross(q[0] + Math.cos(ang) * rr, q[1] + Math.sin(ang) * rr * 0.6 - ph * TW * 0.15, Math.max(1, TW * 0.03), '#fff8d0', Math.sin(ph * Math.PI));
        }
        // the name: small, outlined, over the find until it leaves
        var inA = Math.max(0, Math.min(1, (ti - 0.1) / 0.2)), outA = pix > 0 ? 0 : 1; lbl = inA * outA;
      }
      if (f.from && pix > f.flyDur) { q = mq; lbl = Math.max(0, Math.min(1, (0.95 - (pix - f.flyDur)) / 0.3)); } // landed: the name floats up from the miner
      if (pix > f.flyDur - 0.02) { // sparkle where it lands in the rucksack
        var su = f.pickup ? f.age / f.spark : (pix - f.flyDur) / f.spark;
        if (su >= 0 && su < 1) {
          for (var j = 0; j < 6; j++) { var an = j * 1.047 + 0.3, rd = TW * 0.5 * Math.sqrt(su); cross(mq[0] + Math.cos(an) * rd, mq[1] + Math.sin(an) * rd * 0.7, Math.max(1, TW * 0.035) * (1 - su * 0.5), j % 2 ? '#fff8d0' : col, 1 - su); }
          glow(mq[0], mq[1], TW * 0.6 * (1 - su), '#fff3b0', 0.7 * (1 - su));
        }
      }
      if (lbl > 0 && f.label) {
        var fs = Math.max(11, Math.round(TW * (f.big ? 0.31 : 0.26))), lx = Math.max(vw * 0.1, Math.min(vw * 0.9, q[0])), ly = Math.max(fs + 4, q[1] - TW * (f.big ? 0.55 : 0.42) - (f.pickup ? f.age : f.from && pix > f.flyDur ? pix - f.flyDur : 0) * TW * 0.5);
        octx.save(); octx.globalAlpha = lbl; octx.font = '700 ' + fs + 'px Fredoka, sans-serif'; octx.textAlign = 'center'; octx.lineJoin = 'round';
        octx.lineWidth = Math.max(3, fs * 0.25); octx.strokeStyle = '#000c'; octx.strokeText(f.label, lx, ly);
        octx.fillStyle = f.it.kind === 'fossil' ? '#ffe9a8' : col; octx.fillText(f.label, lx, ly); octx.restore();
      }
    }
  }
  // finds lying on the floor of their cells, waiting to be picked up (moon loot bounces first)
  function drawLoot(r, S) {
    r.loot.forEach(function (l, i) {
      if (l.age < l.delay - 0.15 && l.delay > 0.4) return; // a chest's find waits for the lid to open
      var big = l.item.kind === 'fossil' || l.item.kind === 'relic', pop = Math.min(1, 0.5 + (l.age - (l.delay > 0.4 ? l.delay - 0.15 : 0)) / 0.25 * 0.5);
      var bob = l.rest && !l.pulled ? Math.sin(time * 3 + i * 1.7) * 0.04 : 0, q = P(l.x, l.y + bob, l.z);
      var held = l.item.kind === 'fossil' && S.carry && S.carry.length >= D.boneCap(S) && l.item.world !== undefined && !S.museum[l.item.world].pieces[l.item.idx];
      drawSprite(findSprite(l.item), q[0], q[1], findScale() * (big ? 1.3 : 1) * pop, held ? 0.6 : 1);
      findGlow(l.item, q[0], q[1], 0.5 + (big ? 0.15 * Math.sin(time * 5 + i) : 0), 1);
    });
  }
  // a faint ring at the miner's feet showing how far it picks finds up, once the magnet is upgraded
  function drawReach(r, S) {
    var m = S.upgrades.magnet; if (!m || S.mode !== 'dig') return;
    var rad = D.pickupReach(m), cx = disp.x + 0.5, cz = disp.z + 0.5, fy = disp.y + 1;
    ctx.save(); ctx.strokeStyle = '#8fd8ff'; ctx.globalAlpha = 0.22 + 0.06 * Math.sin(time * 2.5); ctx.lineWidth = Math.max(1.5, TW * 0.03); ctx.setLineDash([TW * 0.12, TW * 0.1]);
    ctx.beginPath();
    for (var k = 0; k <= 40; k++) { var a = k / 40 * Math.PI * 2, q = P(cx + Math.cos(a) * rad, fy, cz + Math.sin(a) * rad); if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.restore();
  }

  // ---------- the miner: a kid with a hard hat, headlamp and pickaxe, pixel art drawn in code ----------
  // The sprites themselves are in js/sprites.js (DTWSprites); this file poses and places them.
  function pickTier(drill) { return Math.min(4, Math.floor(drill / 6)); }
  // screen pixels per sprite pixel: a character stands a little over one block tall
  function charScale() { return TW / 32; }
  var FACE = { e: { back: false, flip: false }, s: { back: false, flip: true }, n: { back: true, flip: false }, w: { back: true, flip: true } };
  // The walk cycle and the pickaxe swing are shared by everyone (DTWSprites.walkPose, DTWSprites.swing). A walk cycle
  // is two steps of DTWSprites.STEP_X sprite pixels each; one cell of ground is 16 sprite pixels across the screen at
  // charScale (hw / charScale() = 16), so the cycle advances CYC_PER_CELL per cell walked (divided by any extra sprite
  // scale) and the planted foot keeps pace with the ground.
  var CYC_PER_CELL = 16 / (2 * DTWSprites.STEP_X);
  // the fossil piece the miner is carrying home, as the sprite draws it on its back
  // down in the ocean world everyone wears a round glass diving helmet
  function underSea(S) { return S.mode !== 'surface' && D.WORLDS[S.world].id === 'ocean'; }
  // the round glass helmet: under the sea, and everywhere on the moon (no air), except on the astronaut helper (k = 4), who has its own
  function helmet(S, k) { return D.WORLDS[S.world].id === 'moon' ? k !== 4 : underSea(S); }
  function carriedBone(S) { return boneOf(S, 0); }
  // carried bone i as a sprite draws it: the miner holds the first D.minerBones, helper k the one after those
  function boneOf(S, i) {
    var it = S.carry && S.carry[i];
    if (!it || it.kind !== 'fossil') return null;
    var w = D.WORLDS[it.world], cr = w && w.creatures[Math.floor(it.idx / 5)], part = cr ? cr.parts[it.idx % 5] : '';
    return { shape: /Skull/.test(part) ? 'skull' : /Tusk|Fang|Horn|Antenna/.test(part) ? 'tusk' : 'bone', moon: w && w.id === 'moon', gold: !!it.gold };
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
      p.walk = (p.walk || 0) + Math.min(l, st);
      if (l <= st) { p.x = tx; p.z = tz; } else { p.x += ex / l * st; p.z += ez / l * st; }
      p.y += Math.max(-st, Math.min(st, c.y - p.y));
      out.push({ k: k, x: p.x, z: p.z, y: p.y, face: partyOn ? 's' : c.face, dig: !partyOn && c.target >= 0 && !(c.stun > 0) && l <= st, walking: l > st, walk: p.walk, stun: c.stun > 0, bone: boneOf(S, D.minerBones(S) + k) });
    });
    crewPos.length = out.length;
    return out;
  }
  function drawHelper(h, S) {
    var fc = FACE[h.face] || FACE.e, phase = time * 1.7 + h.k * 0.37, q = P(h.x, h.y + 1, h.z), p = charScale() * 0.85;
    // helpers are drawn at 0.85 scale, so they take more steps per cell
    var pose = DTWSprites.walkPose((h.walk || 0) * CYC_PER_CELL / 0.85, h.walking ? 1 : 0), sw = h.dig ? DTWSprites.swing(phase, true) : null;
    pose.lean = sw ? sw.lean : 0; pose.air = 0; pose.blink = false; if (sw) pose.body = sw.body;
    var spr = DTWSprites.helper(h.k, { bone: h.bone || null, back: fc.back, swing: sw, carry: !h.dig, tier: 0, pose: pose, lampOn: S.mode !== 'surface', bowl: helmet(S, h.k), t: time });
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(Math.round(q[0]), Math.round(q[1]));
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.38, hh * 0.38, 0, 0, 7); ctx.fill();
    if (S.mode === 'surface' || partyOn) ctx.translate(0, -cheerHop(h.k + 3));
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
    var sw = DTWSprites.swing(disp.phase, side);
    var walking = disp.spd > 0.6 && disp.air < 0.5 && !climbing;
    // walking steps through the shared cycle (it sinks and rises on each step); standing breathes
    var pose = DTWSprites.walkPose(disp.walk, walking ? Math.min(1, disp.spd / 1.5) : 0);
    if (!walking) pose.body = disp.air > 0.3 ? 0 : (Math.sin(time * 2.4) > 0.55 ? 1 : 0);
    // digging: lean back while cocking the pick, forward into the strike, and the knees give on the impact
    pose.lean = digging ? sw.lean : walking ? 1 : 0; pose.air = disp.air; pose.blink = disp.blink < 0;
    if (digging) pose.body = sw.body;
    // the rucksack on the miner's back grows with the bag: stuffed full, it is time to go home
    var full = r && S.mode !== 'surface' ? Math.min(1, r.bag.length / D.bagCap(S)) : 0;
    var spr = DTWSprites.miner({ bone: carriedBone(S), back: climbing ? true : fc.back, swing: digging ? sw : null, carry: !digging, tier: pickTier(S.upgrades.drill), twin: !!(S.upgrades.twin | 0), splash: !!(S.upgrades.splash | 0), pose: pose, pack: S.mode === 'surface' ? null : full, surface: S.mode === 'surface',
      lampOn: S.mode !== 'surface', bowl: helmet(S), climb: climbing ? (Math.floor(disp.y * 3) & 1) : null, t: time });
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
    if (S.mode === 'surface' || partyOn) ctx.translate(0, -cheerHop(0));
    ctx.scale(fc.flip ? -scx : scx, scy);
    ctx.drawImage(spr.cv, -spr.fx * p, -spr.fy * p, spr.cv.width * p, spr.cv.height * p);
    ctx.restore();
    // where the helmet lamp is on screen, for lamp(): the sprite's lamp pixel through the same flip and squash
    lampAt = [sx + (fc.flip ? -scx : scx) * (spr.lx + 0.5 - spr.fx) * p, sy + scy * (spr.ly + 0.5 - spr.fy) * p];
    if (r && r.stun > 0) {
      octx.font = 'bold ' + Math.round(TW * 0.22) + 'px sans-serif'; octx.textAlign = 'center'; octx.fillStyle = '#ffeb3b';
      for (var i = 0; i < 3; i++) { var a = time * 6 + i * 2.1; octx.fillText('★', sx + Math.cos(a) * TW * 0.3, sy - 36 * p + Math.sin(a) * TW * 0.08); }
    }
    if (r && r.dodge > 0 && S.mode === 'dig') dodgeSign(sx, sy - TW * 1.25 - TW * 0.3, r.dodge / D.DODGE_WINDOW);
    return p;
  }
  // a cracked trap is about to go off: a big bouncing warning sign over the miner's head, with a ring that runs down
  // as the dodge window closes (tap now!). Drawn on the overlay so the blur never touches it.
  function dodgeSign(x, y, left) {
    left = Math.max(0, Math.min(1, left));
    var u = TW * 0.44, bob = Math.abs(Math.sin(time * 11)) * TW * 0.16, pulse = 1 + 0.08 * Math.sin(time * 22), cy = Math.max(u * 2.7, y - bob);
    glow(x, cy, TW * 1.1, '#ffd60a', 0.55); light(x, cy, TW * 2.4, 0.3, '#ff8a2a');
    octx.save(); octx.translate(x, cy); octx.scale(pulse, pulse); octx.lineJoin = 'round'; octx.lineCap = 'round';
    octx.lineWidth = Math.max(5, u * 0.3); octx.strokeStyle = 'rgba(0,0,0,0.45)'; octx.beginPath(); octx.arc(0, u * 0.1, u * 1.05, 0, 7); octx.stroke(); // ring track
    octx.strokeStyle = left > 0.4 ? '#ffe14a' : '#ff3b30'; octx.beginPath(); octx.arc(0, u * 0.1, u * 1.05, -Math.PI / 2, -Math.PI / 2 + left * 6.2832); octx.stroke(); // time left
    octx.beginPath(); octx.moveTo(0, -u * 0.8); octx.lineTo(u * 0.85, u * 0.7); octx.lineTo(-u * 0.85, u * 0.7); octx.closePath();
    octx.fillStyle = '#ffd60a'; octx.fill(); octx.lineWidth = Math.max(3, u * 0.2); octx.strokeStyle = '#1a1020'; octx.stroke();
    octx.fillStyle = '#1a1020'; octx.font = '900 ' + Math.round(u * 1.25) + 'px Fredoka, sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText('!', 0, u * 0.22);
    octx.font = '700 ' + Math.round(u * 0.75) + 'px Fredoka, sans-serif'; octx.lineWidth = Math.max(3, u * 0.2); octx.strokeStyle = '#000c'; octx.textAlign = 'left'; octx.strokeText('TAP!', u * 1.25, u * 0.1);
    octx.fillStyle = '#fff'; octx.fillText('TAP!', u * 1.25, u * 0.1); octx.restore();
  }
  // plaza cheering during the finale: a hop height in pixels, out of step per person
  // the relic-floor party (run.party): the miner and helpers jump for joy, and confetti flies
  var partyOn = false, confT = 0, CONFETTI = ['#ff5a7a', '#ffd23f', '#5ad1ff', '#7dff8a', '#c58aff', '#ffffff'];
  function cheerHop(seed) { if (partyOn) return Math.abs(Math.sin(time * 7 + seed * 1.3)) * TW * 0.34; return fin && fin.t < fin.dur ? Math.abs(Math.sin(time * 9 + seed * 2.1)) * TW * 0.3 : 0; }

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
  var PL = D.PLINTH_CH, FLOOR_CH = 'm#ip' + PL + 'abcdeDM', INSIDE_CH = 'mp' + PL + 'abcdeDM';
  var PADS = { L: ['⛏', 'Dig'], S: ['🛒', 'Shop'], H: ['👷', 'Helpers'], W: ['🗺️', 'Worlds'], M: ['🏛️', 'Museum'] };
  var padLabels = [];
  function groundTex(c, x, z) {
    if (c === 'M') return (x + z) & 1 ? 'floor1' : 'floor0';
    if (c === '=' || PADS[c]) return 'path';
    if (c && FLOOR_CH.indexOf(c) >= 0) return (x + z) & 1 ? 'floor1' : 'floor0';
    return 'grass' + Math.min(3, Math.floor(hash2(x * 3 + 1, z * 5 - 2) * 4));
  }
  function hash2(x, z) { return (((x + 40) * 7349 ^ (z + 40) * 9157) * 2654435761 >>> 0) / 4294967296; }
  var HUB_BLOCKS = null;
  function hubBlocks() {
    if (HUB_BLOCKS) return HUB_BLOCKS;
    HUB_BLOCKS = [];
    for (var z = HZ0; z < HZ1; z++) for (var x = HX0; x < HX1; x++) {
      var c = D.hubCell(x, z), single = c === '#' || c === 'i' || c === 't' || c === 'p' || c === 'w';
      if (('tTshwp#iabcdeD' + PL).indexOf(c) < 0) continue;
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
      else if (c === 'i') fn = function () { partition(b.x0, b.z0); };
      else if (c === 'D') fn = function () { desk(b); };
      else if ((k = PL.indexOf(c)) >= 0) fn = function () { plinth(k, b, S); };
      else if ((k = 'abcde'.indexOf(c)) >= 0) fn = function () { relicCase(k, b, S); };
      items.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, fn: fn });
    });
    if (all && (S.relics[4] || fin)) items.push({ x0: STAR.x0, x1: STAR.x0 + 2, z0: STAR.z0, z1: STAR.z0 + 2, fn: starTree });
    if (all && (S.pile >= 1 || burstT > 0)) { var px = HUB_DOOR[0] + 2.5, pz = HUB_DOOR[1] + 1.5; items.push(feet(px, pz, function () { coinPile(px, pz, S.pile); }, 0.4)); }
  }
  // visitor coins waiting just inside the museum door: the heap grows with the sum (log scale), and bursts when collected
  var burstT = 0;
  function coinPile(x, z, amt) {
    var n = amt >= 1 ? Math.min(40, 4 + Math.floor(Math.log(amt) / Math.LN2 * 2.5)) : 0;
    if (n) { // a dark red rug under the heap, so gold stands out on the pale museum floor
      blob(x, z, 0.7, 0.25);
      var rq = P(x, 1, z);
      ctx.fillStyle = '#5a1630'; ctx.beginPath(); ctx.ellipse(rq[0], rq[1], hw * 0.85, hh * 0.85, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = Math.max(1, TW * 0.02); ctx.beginPath(); ctx.ellipse(rq[0], rq[1], hw * 0.74, hh * 0.74, 0, 0, 7); ctx.stroke();
    }
    for (var i = 0; i < n; i++) { // each coin has a dark rim and edge so the heap reads as separate coins
      var h = hash2(i, 7), a = h * 6.283, rr = 0.4 * Math.sqrt(1 - i / n) * (0.6 + 0.4 * hash2(i, 3)), lift = 0.45 * Math.pow(i / n, 0.8);
      var q = P(x + Math.cos(a) * rr, 1 - lift - 0.02, z + Math.sin(a) * rr), cw = TW * 0.1, ch = TW * 0.05;
      ctx.fillStyle = '#3a2200'; ctx.beginPath(); ctx.ellipse(q[0], q[1] + TW * 0.025, cw + 1.5, ch + 1.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#a8740a'; ctx.beginPath(); ctx.ellipse(q[0], q[1] + TW * 0.02, cw, ch, 0, 0, 7); ctx.fill();
      ctx.fillStyle = i % 3 ? '#ffd23f' : '#fff0a0'; ctx.beginPath(); ctx.ellipse(q[0], q[1], cw, ch, 0, 0, 7); ctx.fill();
    }
    if (n) {
      var gq = P(x, 0.75, z); glow(gq[0], gq[1], TW * 0.8, GOLD, 0.16 + 0.06 * Math.sin(time * 3));
      var tw = (time * 1.3) % 1, sq = P(x + 0.15 * Math.cos(time), 1 - 0.45, z + 0.15 * Math.sin(time)), sr = TW * 0.12 * Math.sin(tw * Math.PI); // a twinkle on top
      if (sr > 0.5) { ctx.fillStyle = '#fffbe0'; ctx.fillRect(sq[0] - sr, sq[1] - 1, sr * 2, 2); ctx.fillRect(sq[0] - 1, sq[1] - sr, 2, sr * 2); }
    }
    if (burstT > 0) { // coins leaping up out of the heap
      var k = 1 - burstT / 0.8;
      for (var j = 0; j < 10; j++) {
        var ang = j / 10 * 6.283, d = 0.6 * k, bq = P(x + Math.cos(ang) * d, 1 - 1.6 * k + 1.8 * k * k, z + Math.sin(ang) * d);
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(bq[0], bq[1], TW * 0.06, TW * 0.06, 0, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  function blob(x, z, rx, a) { var q = P(x, 1, z); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.beginPath(); ctx.ellipse(q[0] + hw * 0.25, q[1] + hh * 0.15, hw * rx, hh * rx, 0, 0, 7); ctx.fill(); }
  // Pixel-art trees: a round canopy of clustered leaf blobs lit from the upper left, with a dark outline,
  // drawn once per kind and variant on a 26×34 grid and scaled up without smoothing.
  var TREE_PAL = {
    forest: { out: '#142a17', c: ['#1f4a26', '#336f30', '#4f9438', '#86bf4c', '#c2df74'], bark: ['#3a2414', '#5e3d23', '#7d5634'], trunk: 6 },
    jungle: { out: '#0b2216', c: ['#164a2c', '#22703a', '#36984a', '#62c058', '#a8e47e'], bark: ['#33230f', '#5a4020', '#7a5a2e'], trunk: 10 }
  };
  var treeArt = {};
  // canopy shapes on the 26×34 grid: forest 0 round, 1 tall, 2 conifer, 3 wide; jungle 0 round, 1 broad, 2 palm, 3 tall
  function canopyBlobs(kind, shape, r) {
    var cy = 30 - TREE_PAL[kind].trunk - 7, b = [], i;
    if (shape === 0) { b.push([13, cy, 7.5]); for (i = 0; i < 6; i++) { var a = r() * 6.28, d = 2.5 + r() * 3.5; b.push([13 + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.8 - 1, 3.6 + r() * 2.6]); } return { b: b, cy: cy }; }
    if (shape === 3 && kind === 'forest') { cy = 20; b = [[8, cy + 1, 5.6], [18, cy + 1, 5.6], [13, cy - 2, 6.6], [13, cy + 3, 5]]; return { b: b, cy: cy }; }
    if (shape === 1 && kind === 'jungle') { cy = 16; b = [[6, cy + 2, 4.8], [13, cy - 1, 6.4], [20, cy + 2, 4.8], [10, cy + 4, 4.6], [17, cy + 4, 4.6]]; return { b: b, cy: cy }; }
    if (shape === 2 && kind === 'forest') { cy = 24; b = [[13, 7, 3.4], [13, 12, 5], [13, 17, 6.4], [13, 22, 7.4], [9, 24, 3], [17, 24, 3]]; return { b: b, cy: cy }; }
    cy = 17; b = [[13, cy - 8, 4.6], [13, cy - 2, 6.2], [13, cy + 4, 6.6], [11, cy - 5, 3.4], [15, cy + 1, 3.6]]; return { b: b, cy: cy }; // tall
  }
  function treeSprite(kind, v, fg) {
    var key = kind + v + (fg ? 'f' : '');
    if (treeArt[key]) return treeArt[key];
    var Pt = TREE_PAL[kind], W = 26, H = 34, r = prng(v * 131 + kind.length * 7), c = document.createElement('canvas');
    c.width = W; c.height = H; var g = c.getContext('2d');
    var shape = v % 4, palm = kind === 'jungle' && shape === 2, bl = palm ? { b: [], cy: 14 } : canopyBlobs(kind, shape, r), blobs = bl.b, cy = bl.cy;
    var inside = [], shadeOf = [], x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) inside[y * W + x] = false;
    if (palm) { // a crown of drooping fronds on a thin curved trunk
      var cx0 = 13, cy0 = 11, an = [-2.9, -2.45, -2.0, -1.57, -1.14, -0.7, -0.25, 0.1, 3.05], k;
      for (k = 0; k < an.length; k++) for (var t = 0; t <= 1.001; t += 0.03) {
        var fx = cx0 + Math.cos(an[k]) * t * 11.5, fy = cy0 + Math.sin(an[k]) * t * 5.5 + t * t * 8, th = t < 0.5 ? 1.6 : 1.1;
        for (var ox2 = -1; ox2 <= 1; ox2++) for (var oy2 = -1; oy2 <= 1; oy2++) if (Math.hypot(ox2, oy2) <= th) { var px2 = Math.round(fx + ox2), py2 = Math.round(fy + oy2); if (px2 >= 0 && px2 < W && py2 >= 0 && py2 < H) { inside[py2 * W + px2] = true; shadeOf[py2 * W + px2] = 0.55 - t * 0.7 - (Math.sin(an[k]) > 0 ? 0.25 : 0) + (r() - 0.5) * 0.2; } }
      }
      for (y = 14; y < 32; y++) { var tx = 12 + Math.round(Math.sin((y - 13) / 18 * 1.6) * 2); g.fillStyle = Pt.bark[1]; g.fillRect(tx, y, 2, 1); g.fillStyle = Pt.bark[0]; g.fillRect(tx + 1, y, 1, 1); if (y % 3 === 0) { g.fillStyle = Pt.bark[2]; g.fillRect(tx, y, 1, 1); } }
    } else {
      var tt = shape === 2 && kind === 'forest' ? 29 : cy + 3;
      g.fillStyle = Pt.bark[1]; g.fillRect(11, tt, 4, 31 - tt);
      g.fillStyle = Pt.bark[0]; g.fillRect(14, tt, 1, 31 - tt); g.fillRect(9, 30, 8, 1);
      g.fillStyle = Pt.bark[2]; g.fillRect(11, tt + 2, 1, 31 - tt - 4); g.fillRect(10, 29, 2, 1); g.fillRect(14, 29, 2, 1);
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var best = -1, lit = 0;
        blobs.forEach(function (bl2) { var dx = x + 0.5 - bl2[0], dy = y + 0.5 - bl2[1], m = bl2[2] - Math.hypot(dx, dy); if (m > 0 && m > best - 1.2) { if (m > best) best = m; lit = Math.max(lit, (-dx * 0.6 - dy * 0.8) / bl2[2] + 0.25 * (bl2[1] < cy ? 1 : 0)); } });
        inside[y * W + x] = best > 0; shadeOf[y * W + x] = lit;
      }
    }
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
      var i = y2 * W + x2;
      if (inside[i]) {
        var l = shadeOf[i] + (r() - 0.5) * 0.35, k2 = l > 0.75 ? 4 : l > 0.4 ? 3 : l > 0.02 ? 2 : l > -0.4 ? 1 : 0;
        if (r() < 0.14 && k2 > 0) k2--; // leaf texture
        g.fillStyle = Pt.c[k2]; g.fillRect(x2, y2, 1, 1);
      } else if (!fg && ((x2 > 0 && inside[i - 1]) || (x2 < W - 1 && inside[i + 1]) || (y2 > 0 && inside[i - W]) || (y2 < H - 1 && inside[i + W]))) {
        if (!(y2 > cy + 2 && x2 >= 11 && x2 <= 14 && !palm)) { g.fillStyle = Pt.out; g.fillRect(x2, y2, 1, 1); }
      }
    }
    if (fg) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(14,16,8,0.58)'; g.fillRect(0, 0, W, H); } // a dark, outline-free silhouette for trees in front of the focus band
    return (treeArt[key] = c);
  }
  // near leaves framing the bottom corners of the plaza view: big, dark, soft masses of leaves and a branch cut off by the
  // frame, with only a thin warm rim light, never outlined
  var shadeArt = {};
  function leafMass(kind, seed) {
    var key = kind + seed; if (shadeArt[key]) return shadeArt[key];
    var W = 90, H = 64, r = prng(seed * 977 + 5), c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    var base = kind === 'jungle' ? ['#06140c', '#0a1e12', '#0f2a18'] : ['#0a140a', '#0f1e0e', '#17290f'], rim = kind === 'jungle' ? '#5a7a36' : '#6a7a34', i;
    g.strokeStyle = '#120c06'; g.lineWidth = 3; g.beginPath(); g.moveTo(W + 4, H * 0.18); g.quadraticCurveTo(W * 0.55, H * 0.3, 2, H * 0.62); g.stroke(); // a branch coming in from the corner
    for (i = 0; i < 46; i++) {
      var t = r(), cx = W * (0.55 + 0.45 * (1 - t)) - r() * W * 0.55, cy = H * (0.25 + 0.75 * r() * (0.4 + 0.6 * t)), rx = 5 + r() * 9, ry = (kind === 'jungle' ? 2.5 : 3.5) + r() * 6, ang = (kind === 'jungle' ? -0.5 : 0) + (r() - 0.5) * 1.6;
      g.save(); g.translate(cx, cy); g.rotate(ang);
      g.fillStyle = rim; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(-0.8, -1.2, rx, ry, 0, 0, 7); g.fill();
      g.globalAlpha = 1; g.fillStyle = base[Math.floor(r() * 3)]; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
      g.restore();
    }
    return (shadeArt[key] = c);
  }
  function nearLeaves(id) {
    var kind = id === 'jungle' ? 'jungle' : id === 'forest' ? 'forest' : null; if (!kind) return;
    var wd = Math.max(TW * 5.2, vw * 0.36), ht = wd * 64 / 90;
    ctx.imageSmoothingEnabled = true;
    [[leafMass(kind, 1), -1, 0.62, 0.14], [leafMass(kind, 2), 1, 0.7, -0.1]].forEach(function (f, n) {
      var sway = Math.sin(time * 0.6 + n * 2) * TW * 0.04;
      ctx.save();
      if (f[1] < 0) ctx.translate(-wd * 0.18 + sway, vh - ht * 0.82); else { ctx.translate(vw + wd * 0.18 + sway, vh - ht * 0.78); ctx.scale(-1, 1); }
      ctx.globalAlpha = 0.96; ctx.drawImage(f[0], 0, 0, wd, ht); ctx.restore();
    });
    ctx.imageSmoothingEnabled = false;
  }
  function pixTree(kind, x, z, s, k) {
    var q = P(x + 0.5, 1, z + 0.5), fg = q[1] > (lastMiner ? lastMiner[1] + TW * 2.5 : vh * 0.8), spr = treeSprite(kind, k % 4, fg), wd = TW * 1.25 * s * (fg ? 1.35 : 1), ht = wd * 34 / 26;
    var sway = Math.sin(time * 0.9 + k) * TW * 0.012 * s;
    ctx.drawImage(spr, Math.round(q[0] - wd / 2 + sway), Math.round(q[1] - ht * 31 / 34), Math.round(wd), Math.round(ht));
  }
  function tree(x, z, s, k) {
    blob(x + 0.5, z + 0.5, 0.95 * s, 0.26);
    pixTree('forest', x, z, s, k);
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
      blob(x + 0.5, z + 0.5, 0.9, 0.24);
      pixTree('jungle', x, z, s * 1.1, i);
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
  // shelves at the back, the shopkeeper, a counter facing the pad on the +x side, and a striped awning
  // high enough (AWN) that the keeper stands under it and shows below its front edge
  var AWN = 2.7;
  function shopStall(b) {
    var x = b.x0, z = b.z0;
    blob(x + 1.5, z + 1.5, 1.7, 0.2);
    box(x, z, 3, 3, 1, 0.08, '#7a5232');
    box(x + 0.1, z + 0.1, 0.5, 2.8, 0.92, 1.3, '#8a5a32');
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) { var gq = P(x + 0.6, 0.92 - 0.3 - r * 0.4, z + 0.45 + c * 0.65); ctx.fillStyle = ['#ffd23f', '#5dd8ff', '#ff6f8a', '#9dff8a'][(r + c) % 4]; ctx.fillRect(gq[0] - TW * 0.05, gq[1] - TW * 0.07, TW * 0.1, TW * 0.1); }
    box(x + 2.65, z + 0.1, 0.12, 0.12, 0.92, AWN, '#5a3a24'); box(x + 2.65, z + 2.78, 0.12, 0.12, 0.92, AWN, '#5a3a24');
    drawPerson('keeper', 1, x + 2.15, z + 1.5, 'e', false, 0);
    box(x + 2.45, z + 0.25, 0.5, 2.5, 0.92, 0.55, '#b5773e'); box(x + 2.4, z + 0.2, 0.6, 2.6, 0.37, 0.08, '#e0a868');
    for (var i = 0; i < 6; i++) box(x - 0.05, z + i * 0.5, 2.85, 0.5, 1 - AWN - 0.05 * Math.sin(i), 0.1, i % 2 ? '#fff7e8' : '#e74c3c');
    ctx.fillStyle = '#ffd23f'; label(x + 2.8, -AWN + 0.6, z + 1.5, '$', TW * 0.45);
    if (life.L.nite > 0.03) { // lanterns on the awning posts
      var nt = life.L.nite, l1 = P(x + 2.7, 0.92 - AWN + 0.1, z + 0.16), l2 = P(x + 2.7, 0.92 - AWN + 0.1, z + 2.84);
      [l1, l2].forEach(function (lq) { ctx.fillStyle = rgba('#ffd27a', nt); ctx.fillRect(lq[0] - TW * 0.05, lq[1], TW * 0.1, TW * 0.14); glow(lq[0], lq[1] + TW * 0.07, TW * 0.9, '#ffb44a', 0.8 * nt); });
      var cq = P(x + 2.4, 0.6, z + 1.5); light(cq[0], cq[1], TW * 2.6, 0.5 * nt, [1.0, 0.7, 0.36]);
    }
  }
  function helperHut(b) { // a little house; its door faces the pad on the +z side
    var x = b.x0, z = b.z0;
    blob(x + 1.5, z + 1.5, 1.8, 0.2);
    box(x + 0.2, z + 0.2, 2.6, 2.6, 1, 1.2, '#efe4ff');
    box(x + 0.2, z + 0.2, 2.6, 2.6, 1, 0.2, '#b9a9d6');
    box(x + 1.2, z + 2.8, 0.6, 0.04, 1, 0.8, '#5a3a24');
    var wc = rgbCss(mixRgb([143, 211, 255], [255, 216, 138], life.L.nite)); // windows light up at dusk
    box(x + 0.5, z + 2.8, 0.45, 0.04, 0.45, 0.4, wc); box(x + 2.05, z + 2.8, 0.45, 0.04, 0.45, 0.4, wc);
    roof(x - 0.05, z - 0.05, 3.1, 3.1, -0.2, 1.1, '#6c5ce7');
    if (life.L.nite > 0.03) {
      var nt = life.L.nite, w1 = P(x + 0.72, 0.65, z + 2.85), w2 = P(x + 2.27, 0.65, z + 2.85);
      glow(w1[0], w1[1], TW * 0.8, '#ffc060', 0.8 * nt); glow(w2[0], w2[1], TW * 0.8, '#ffc060', 0.8 * nt);
      var dq = P(x + 1.5, 1, z + 3.4); light(dq[0], dq[1] - TW * 0.5, TW * 2.4, 0.45 * nt, [1.0, 0.72, 0.38]);
    }
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
  // a low partition between wings; where it ends at an arch it rises into a gold-capped post
  function partition(x, z) {
    var n = 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var c = D.hubCell(x + d[0], z + d[1]); if (c === 'i' || c === '#') n++; });
    if (n <= 1) { // an arch post
      blob(x + 0.5, z + 0.5, 0.6, 0.2);
      box(x + 0.1, z + 0.1, 0.8, 0.8, 1, 1.25, '#e6d7b8'); box(x + 0.05, z + 0.05, 0.9, 0.9, 1, 0.18, '#c9a46a'); box(x + 0.05, z + 0.05, 0.9, 0.9, 1 - 1.25, 0.14, '#c9a46a');
    } else { box(x, z, 1, 1, 1, 0.4, '#e6d7b8'); box(x, z, 1, 1, 1 - 0.4, 0.07, '#c9a46a'); }
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
    var ct = carryTarget(S), hi = null, ce = null;
    celebs.forEach(function (cc) { if (cc.k === k) ce = cc; });
    if (ct && ct.k === k) { // aura around the plinth the bone belongs to, and its missing piece shimmering
      var pu = 0.5 + 0.5 * Math.sin(time * 2), ay = q[1] - TW * 0.55;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var ag = ctx.createRadialGradient(q[0], ay, 0, q[0], ay, TW * 1.6); ag.addColorStop(0, rgba(GOLD, 0.2 + 0.1 * pu)); ag.addColorStop(0.5, rgba(GOLD, 0.07 + 0.05 * pu)); ag.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = ag; ctx.fillRect(q[0] - TW * 1.6, ay - TW * 1.6, TW * 3.2, TW * 3.2); ctx.restore();
      glow(q[0], ay, TW * 1.6, GOLD, 0.18 + 0.12 * pu); light(q[0], ay, TW * 2.6, 0.22 + 0.15 * pu, '#ffd96a');
      if (ct.piece >= 0) hi = { i: ct.piece, a: 0.3 + 0.5 * pu, col: '#ffe27a' };
    }
    if (ce) hi = { i: -1, a: Math.max(0, 1 - ce.t / 1.0), col: '#ffffff' }; // the new bone flashes in
    DTWSprites.exhibit(ctx, k, S.museum[w].pieces.slice(c * 5, c * 5 + 5), open, q[0], q[1], TW / 27 * Math.max(1, Math.min(2, Math.min(sx, sz * 1.25) / 2)), hi, S.museum[w].gold && S.museum[w].gold.slice(c * 5, c * 5 + 5));
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
  var GUIDE_SPOTS = [[15.5, 7.5], [28.5, 6.5], [21.5, 13.5], [17.5, -1.5], [37.5, 14.5]]; // aisle crossings in the museum
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
    if (fin) want = Math.max(want, 7);
    visitT -= dt * (fin ? 4 : 1);
    if (fin && fin.t < fin.dur) { fin.cheer -= dt; if (fin.cheer <= 0 && visitors.length) { fin.cheer = 0.25; var cv0 = visitors[Math.floor(Math.random() * visitors.length)]; floatText(cv0.x, -0.6, cv0.z, ['🎉', '🎆', '⭐', 'Yay!', 'Wow!'][Math.floor(Math.random() * 5)], '#ffe9a8'); } }
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
          v.walk += Math.min(l, d); // cells walked, for the walk cycle
          if (l <= d) { v.x = p[0]; v.z = p[1]; d -= l; v.path.shift(); if (!v.path.length) v.path = null; }
          else { v.x += ex / l * d; v.z += ez / l * d; d = 0; }
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
  function drawPerson(kind, seed, x, z, face, moving, walk, hop) {
    var fc = FACE[face] || FACE.e, frame = moving ? Math.floor(walk * CYC_PER_CELL * 8) & 7 : Math.floor(time * 1.5 + seed) & 3;
    var spr = DTWSprites.npc(kind, seed, fc.back, frame, moving, time), q = P(x, 1, z), p = charScale();
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(Math.round(q[0]), Math.round(q[1]));
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.4, hh * 0.4, 0, 0, 7); ctx.fill();
    ctx.translate(0, -cheerHop(seed) - (hop ? Math.abs(Math.sin(time * 12)) * TW * 0.3 : 0));
    if (fc.flip) ctx.scale(-1, 1);
    ctx.drawImage(spr.cv, -spr.fx * p, -spr.fy * p, spr.cv.width * p, spr.cv.height * p);
    ctx.restore();
  }
  function hubPeople(S, items) {
    for (var g = 0; g < Math.min(S.workers.staff, GUIDE_SPOTS.length); g++) (function (sp, g) {
      items.push(feet(sp[0], sp[1], function () { drawPerson('guide', g, sp[0], sp[1], g % 2 ? 's' : 'e', false, 0); }));
    })(GUIDE_SPOTS[g], g);
    var qs = quizSpot(S); // the museum quiz visitor stands by the plinth, waving, until the question is answered
    if (qs) items.push(feet(qs[0], qs[1], function () { drawPerson('prof', quizCheerT > 0 ? 1 : 1, qs[0], qs[1], 's', false, 0, quizCheerT > 0); }));
    visitors.forEach(function (v) { items.push(feet(v.x, v.z, function () { drawPerson('visitor', v.seed, v.x, v.z, v.face, v.moving, v.walk); })); });
    // hired helper diggers rest by their hut while the miner is up top, unless they hold a bone for the museum
    plazaHelpers(S).forEach(function (h) { items.push(feet(h.x, h.z, function () { drawHelper(h, S); })); });
  }
  // ---------- helpers holding bones follow the miner ----------
  // The miner's path on the plaza is kept as a trail; a helper with a bone walks FOLLOW_GAP cells apart along it,
  // and once its bone is handed in it walks back to its spot by the hut.
  var fol = { trail: [], pos: [], t: 0 }, FOLLOW_GAP = 0.9;
  function trailPoint(d) {
    var tr = fol.trail, acc = 0;
    for (var i = 1; i < tr.length; i++) {
      var ex = tr[i][0] - tr[i - 1][0], ez = tr[i][1] - tr[i - 1][1], seg = Math.sqrt(ex * ex + ez * ez);
      if (acc + seg >= d) { var f = (d - acc) / (seg || 1); return [tr[i - 1][0] + ex * f, tr[i - 1][1] + ez * f]; }
      acc += seg;
    }
    return tr[tr.length - 1];
  }
  function stepToward(p, tx, tz, st) { // returns the distance moved
    var ex = tx - p.x, ez = tz - p.z, l = Math.sqrt(ex * ex + ez * ez);
    if (l < 1e-4) return 0;
    var m = Math.min(l, st); p.x += ex / l * m; p.z += ez / l * m; p.walk += m; p.face = faceOf(ex, ez);
    return m;
  }
  function plazaHelpers(S) {
    var dt = Math.min(0.1, Math.max(0, time - fol.t)); fol.t = time;
    var spots = HUT_SPOTS.filter(function (sp) { return D.hubWalkable(Math.floor(sp[0]), Math.floor(sp[1])); }).slice(0, Math.min(S.workers.diggers, 6));
    if (S.mode !== 'surface') { fol.trail = []; fol.pos = []; }
    var mx = S.hub.x, mz = S.hub.z, tr = fol.trail;
    if (S.mode === 'surface' && (!tr.length || Math.abs(tr[0][0] - mx) + Math.abs(tr[0][1] - mz) > 0.1)) { tr.unshift([mx, mz]); if (tr.length > 300) tr.length = 300; }
    var mb = D.minerBones(S);
    return spots.map(function (sp, k) {
      var bone = S.mode === 'surface' ? boneOf(S, mb + k) : null, p = fol.pos[k], moved = 0, st = D.HUB_SPEED * dt;
      if (bone) {
        if (!p) p = fol.pos[k] = { x: mx, z: mz, walk: 0, face: 's' }; // they come up the ladder with the miner
        p.home = null;
        var tp = trailPoint((k + 1) * FOLLOW_GAP), far = Math.abs(tp[0] - p.x) + Math.abs(tp[1] - p.z) > 1.5;
        moved = stepToward(p, tp[0], tp[1], st * (far ? 1.6 : 1.1));
        if (!moved) p.face = faceOf(mx - p.x, mz - p.z);
      } else if (p) {
        if (!p.home) p.home = (D.hubPath(p.x, p.z, sp[0], sp[1]) || []).concat([[sp[0], sp[1]]]);
        var left = st;
        while (left > 1e-4 && p.home.length) { var m = stepToward(p, p.home[0][0], p.home[0][1], left); moved += m; left -= m; if (left > 1e-4) p.home.shift(); }
        if (!p.home.length) { fol.pos[k] = p = null; }
      }
      if (!p) return { k: k, x: sp[0], z: sp[1], y: 0, face: sp[2], dig: false, walking: false };
      return { k: k, x: p.x, z: p.z, y: 0, face: p.face, dig: false, walking: moved > 0, walk: p.walk, bone: bone };
    });
  }
  // ---------- hand-in guide: where to take the bone being carried ----------
  var GOLD = '#ffd23f', trail = { t: 0, pts: [] }, celebs = [], sparks = [];
  // the plinth the carried bone belongs to and the open floor cell beside it to stand on, or null
  // ---------- the museum quiz visitor and the ? over their head ----------
  var quizCheerT = 0;
  function quizSpot(S) {
    if (!S.quiz || S.mode !== 'surface') return null;
    var b = plinthBlock(S.quiz.k); if (!b) return null;
    var cand = [[b.x0, b.z1], [b.x1 - 1, b.z1], [b.x0, b.z0 - 1], [b.x1 - 1, b.z0 - 1], [b.x0 - 1, b.z0], [b.x1, b.z0]];
    for (var i = 0; i < cand.length; i++) if (D.hubWalkable(cand[i][0], cand[i][1])) return [cand[i][0] + 0.5, cand[i][1] + 0.5];
    return null;
  }
  // a big bouncing gold ? over the visitor; off screen, a small ? at the screen edge points to them
  function quizMark(S) {
    var qs = quizSpot(S); if (!qs) return;
    var q = P(qs[0], 1, qs[1]), u = TW * 0.5, bob = Math.abs(Math.sin(time * 5)) * TW * 0.22, pulse = 1 + 0.06 * Math.sin(time * 10);
    var x = q[0], y = q[1] - TW * 1.9 - bob, m = u * 1.1, off = x < m || x > vw - m || y < m * 1.6 || y > vh - m;
    var ex = Math.max(m, Math.min(vw - m, x)), ey = Math.max(m * 1.6, Math.min(vh - m * 2.4, y));
    if (off) { x = ex; y = ey; u *= 0.6; }
    glow(x, y, TW * (off ? 0.9 : 1.5), '#ffd23f', 0.7); light(x, y, TW * 2.6, 0.35, '#ffcc33');
    octx.save(); octx.translate(x, y); octx.scale(pulse, pulse);
    if (off) { // the arrow towards the visitor
      var ang = Math.atan2(q[1] - TW * 1.9 - y, q[0] - x); octx.save(); octx.rotate(ang); octx.fillStyle = '#ffd23f'; octx.strokeStyle = '#1a1020'; octx.lineWidth = 3;
      octx.beginPath(); octx.moveTo(u * 1.7, 0); octx.lineTo(u * 1.0, -u * 0.55); octx.lineTo(u * 1.0, u * 0.55); octx.closePath(); octx.fill(); octx.stroke(); octx.restore();
      octx.fillStyle = 'rgba(30,20,50,0.85)'; octx.beginPath(); octx.arc(0, 0, u * 1.0, 0, 7); octx.fill(); octx.strokeStyle = '#ffd23f'; octx.lineWidth = 3; octx.stroke();
    }
    octx.font = '900 ' + Math.round(u * (off ? 1.5 : 2.3)) + 'px Fredoka, sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.lineJoin = 'round';
    octx.lineWidth = Math.max(5, u * 0.34); octx.strokeStyle = '#1a1020'; octx.strokeText('?', 0, 0);
    octx.fillStyle = '#ffd23f'; octx.fillText('?', 0, 0); octx.restore();
  }
  function carryTarget(S) {
    if (S.mode !== 'surface' || !S.carry || !S.carry.length) return null;
    var it = S.carry[0], k = it.world * 3 + Math.floor(it.idx / 5), b = plinthBlock(k);
    if (!b || !S.unlocked[it.world]) return null;
    var cand = [[b.x0, b.z1], [b.x1 - 1, b.z1], [b.x0, b.z0 - 1], [b.x1 - 1, b.z0 - 1], [b.x0 - 1, b.z0], [b.x1, b.z0]], cell = null;
    for (var i = 0; i < cand.length && !cell; i++) if (D.hubWalkable(cand[i][0], cand[i][1])) cell = [cand[i][0] + 0.5, cand[i][1] + 0.5];
    if (!cell) return null;
    var missing = ((it.gold ? S.museum[it.world].gold : S.museum[it.world].pieces)[it.idx] | 0) === 0;
    return { k: k, b: b, cell: cell, piece: missing ? it.idx % 5 : -1 };
  }
  function deskCell() {
    for (var z = HZ0; z < HZ1; z++) for (var x = HX0; x < HX1; x++) if (D.hubCell(x, z) === 'M') return [x + 0.5, z + 0.5];
    return null;
  }
  // the hand-in spot: a thin gold ring with a faint fill, an inner ring, and one slow ring easing outwards
  function ringAt(cx, cz, rad, a, pulse) {
    var q = P(cx, 1, cz);
    function ell(r) { ctx.beginPath(); ctx.ellipse(q[0], q[1], hw * r, hh * r, 0, 0, 7); }
    ctx.save();
    ctx.fillStyle = rgba('#ffd23f', (0.10 + 0.05 * pulse) * a); ell(rad); ctx.fill();
    ctx.lineWidth = Math.max(3, TW / 12); ctx.strokeStyle = rgba('#2a1a00', 0.35 * a); ell(rad); ctx.stroke(); // soft shadow so it reads on pale floors
    ctx.lineWidth = Math.max(1.5, TW / 26); ctx.strokeStyle = rgba('#ffe27a', 0.95 * a); ell(rad); ctx.stroke();
    ctx.strokeStyle = rgba('#fff6d8', 0.55 * a); ell(rad * 0.62); ctx.stroke();
    var ph = (time / 1.8) % 1, e = 1 - Math.pow(1 - ph, 2);
    ctx.lineWidth = Math.max(1.2, TW / 34); ctx.strokeStyle = rgba('#ffe27a', 0.6 * (1 - ph) * a); ell(rad * (1 + 0.45 * e)); ctx.stroke();
    ctx.restore();
    glow(q[0], q[1], TW * 1.0 * rad, GOLD, (0.12 + 0.06 * pulse) * a);
    light(q[0], q[1] - TW * 0.2, TW * 1.8, (0.18 + 0.08 * pulse) * a * (1 + 1.6 * life.L.nite), '#ffd96a');
  }
  function sparkle(x, y, r, a, col) {
    ctx.save(); ctx.fillStyle = rgba(col, a); ctx.strokeStyle = rgba('#8a5200', a * 0.8); ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.3, y + r * 0.3);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y + r * 0.3); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.3, y - r * 0.3); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    glow(x, y, r * 2.2, col, a * 0.5);
  }
  // the floor effects, drawn under the props: the ring, a line of chevrons leading to it, the glowing door and desk
  function handInFloor(S) {
    var T0 = carryTarget(S); if (!T0) return;
    var pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
    ringAt(T0.cell[0], T0.cell[1], 0.9, 1, pulse);
    var dq = P(HUB_DOOR[0] + 0.5, 1, HUB_DOOR[1] + 0.5), desk = deskCell();
    glow(dq[0], dq[1], TW * 0.9, GOLD, 0.08 + 0.05 * pulse);
    if (desk) { var kq = P(desk[0], 1, desk[1]); glow(kq[0], kq[1], TW * 0.9, GOLD, 0.1 + 0.05 * pulse); }
    if (time - trail.t > 0.5 || !trail.pts.length) { // chevrons every STEP along the walking path, each with its heading
      var STEP = 0.75;
      trail.t = time; trail.pts = [];
      var path = D.hubPath(S.hub.x, S.hub.z, T0.cell[0], T0.cell[1]) || [], px = S.hub.x, pz = S.hub.z, acc = 0, run = 0;
      for (var i = 0; i < path.length; i++) {
        var sx = path[i][0] - px, sz = path[i][1] - pz, seg = Math.hypot(sx, sz), at = 0;
        while (seg > 0 && acc + (seg - at) >= STEP) { at += STEP - acc; acc = 0; run += STEP; trail.pts.push([px + sx * at / seg, pz + sz * at / seg, run, sx / seg, sz / seg]); }
        acc += seg - at; px = path[i][0]; pz = path[i][1];
      }
    }
    var n = trail.pts.length, total = n ? trail.pts[n - 1][2] : 0;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var j = 0; j < n; j++) {
      var p = trail.pts[j]; if (p[2] < 0.9 || p[2] > 14 || total - p[2] < 0.6) continue; // not under the miner, nor inside the ring
      var fade = Math.min(1, (p[2] - 0.9) / 1.0) * Math.min(1, (14 - p[2]) / 2);
      var wave = Math.pow(0.5 + 0.5 * Math.cos(time * 3.2 - p[2] * 1.1), 3); // a highlight travelling towards the plinth
      var c = P(p[0], 1, p[1]), f = P(p[0] + p[3], 1, p[1] + p[4]), dx = f[0] - c[0], dy = f[1] - c[1], dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      var r = TW * 0.13, nx = -dy, ny = dx;
      var tip = [c[0] + dx * r * 0.6, c[1] + dy * r * 0.6], l = [c[0] - dx * r * 0.5 + nx * r, c[1] - dy * r * 0.5 + ny * r], rr = [c[0] - dx * r * 0.5 - nx * r, c[1] - dy * r * 0.5 - ny * r];
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(rr[0], rr[1]);
      ctx.lineWidth = Math.max(4, TW / 10); ctx.strokeStyle = rgba('#3a2400', 0.55 * fade); ctx.stroke();
      ctx.lineWidth = Math.max(2, TW / 20); ctx.strokeStyle = rgba(wave > 0.5 ? '#fff6d8' : '#ffd23f', (0.7 + 0.3 * wave) * fade); ctx.stroke();
    }
    ctx.restore();
  }
  // a small dark tag over the ring naming the skeleton the bone belongs to, with a pointer down to the spot
  function handInTop(S) {
    var T0 = carryTarget(S); if (!T0) return;
    var it = S.carry[0], cr = D.WORLDS[it.world].creatures[Math.floor(it.idx / 5)];
    var q = P(T0.cell[0], 1, T0.cell[1]), size = Math.max(12, TW * 0.24), y = q[1] - TW * 1.25 + Math.sin(time * 2) * TW * 0.03;
    var more = S.carry.length - 1, text = '🦴 ' + (cr && cr.name ? cr.name : 'Museum') + (more > 0 ? '  +' + more : '');
    octx.save(); octx.font = 'bold ' + Math.round(size) + 'px Fredoka, sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
    var wd = octx.measureText(text).width + size * 1.1, hgt = size * 1.7, x0 = q[0] - wd / 2, y0 = y - hgt / 2;
    octx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(octx, x0 + 1, y0 + 2, wd, hgt, hgt * 0.3); octx.fill();
    octx.fillStyle = 'rgba(22,17,34,0.88)'; roundRect(octx, x0, y0, wd, hgt, hgt * 0.3); octx.fill();
    octx.lineWidth = Math.max(1, size / 12); octx.strokeStyle = 'rgba(255,210,63,0.85)'; octx.stroke();
    var py = y0 + hgt, pw = size * 0.38; // pointer
    octx.beginPath(); octx.moveTo(q[0] - pw, py - 0.5); octx.lineTo(q[0], py + pw * 0.95); octx.lineTo(q[0] + pw, py - 0.5); octx.closePath();
    octx.fillStyle = 'rgba(22,17,34,0.88)'; octx.fill();
    octx.beginPath(); octx.moveTo(q[0] - pw, py); octx.lineTo(q[0], py + pw * 0.95); octx.lineTo(q[0] + pw, py); octx.stroke();
    octx.beginPath(); octx.arc(q[0], q[1] - TW * 0.02, Math.max(2, size * 0.16), 0, 7); octx.fillStyle = '#ffe27a'; octx.fill(); // the spot itself
    octx.fillStyle = '#fff6d8'; octx.fillText(text, q[0], y + 1);
    octx.restore();
  }
  // a short celebration at the plinth (or the desk when world < 0) once a bone is handed in
  function celebrate(world, creature) {
    var x, z, k = -1;
    if (world >= 0 && creature >= 0) { var b = plinthBlock(world * 3 + creature); if (b) { k = world * 3 + creature; x = (b.x0 + b.x1) / 2; z = (b.z0 + b.z1) / 2; } }
    if (k < 0) { var d = deskCell(); if (!d) return; x = d[0]; z = d[1]; }
    celebs.push({ k: k, x: x, z: z, t: 0 });
    for (var i = 0; i < 46; i++) {
      var a = Math.random() * 6.283, v = 1 + Math.random() * 2.6;
      sparks.push({ x: x, y: k < 0 ? 0.8 : 0.1, z: z, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: -1.5 - Math.random() * 3, life: 0.9 + Math.random() * 0.8, age: 0, s: 0.09 + Math.random() * 0.1, c: ['#fff2a8', '#ffd23f', '#ffffff', '#ffb347'][i & 3] });
    }
  }
  function celebUpdate(dt) {
    for (var i = celebs.length - 1; i >= 0; i--) { celebs[i].t += dt; if (celebs[i].t > 1.6) celebs.splice(i, 1); }
    for (var j = sparks.length - 1; j >= 0; j--) {
      var p = sparks[j]; p.age += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy += 5 * dt; p.vx *= 0.97; p.vz *= 0.97;
      if (p.age > p.life) sparks.splice(j, 1);
    }
  }
  function celebTop() { // sparkle burst and expanding ring, over the scene
    celebs.forEach(function (c) {
      var q = P(c.x, 1, c.z), f = c.t / 1.6;
      ctx.save(); ctx.lineWidth = Math.max(4, TW / 8); ctx.strokeStyle = rgba('#ffc400', 0.9 * (1 - f));
      ctx.beginPath(); ctx.ellipse(q[0], q[1], hw * (0.6 + 2.2 * f), hh * (0.6 + 2.2 * f), 0, 0, 7); ctx.stroke(); ctx.restore();
      glow(q[0], q[1] - TW * 0.5, TW * (1 + 2 * f), '#fff2a8', 0.7 * (1 - f));
      light(q[0], q[1] - TW * 0.5, TW * 3, 0.9 * (1 - f), '#ffe9a0');
    });
    sparks.forEach(function (p) {
      var q = P(p.x, Math.min(1, p.y + 0.5), p.z), f = 1 - p.age / p.life;
      sparkle(q[0], q[1] - (p.y < 0.5 ? 0 : 0), TW * p.s * (0.6 + f), f, p.c);
    });
  }
  // a stone disc on each station pad; the miner standing on it lights it up
  function pad(x, z, c, S) {
    var q = P(x + 0.5, 1, z + 0.5), on = S.mode === 'surface' && Math.floor(S.hub.x) === x && Math.floor(S.hub.z) === z;
    var pulse = 0.5 + 0.5 * Math.sin(time * 4);
    if (c === 'M' && carryTarget(S)) { ringAt(x + 0.5, z + 0.5, 0.8, 0.6, pulse); }
    ctx.save(); ctx.lineWidth = Math.max(2, TW / 16);
    ctx.strokeStyle = on ? '#ffffff' : 'rgba(255,210,63,' + (0.55 + 0.45 * pulse) + ')';
    ctx.fillStyle = on ? 'rgba(255,210,63,0.45)' : 'rgba(255,210,63,0.16)';
    ctx.beginPath(); ctx.ellipse(q[0], q[1], hw * 0.78, hh * 0.78, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    glow(q[0], q[1], TW * (0.6 + 0.25 * life.L.nite), '#ffd23f', 0.2 + 0.2 * pulse + 0.12 * life.L.nite);
    if (life.L.nite > 0.05 && c === 'L') light(q[0], q[1] - TW * 0.3, TW * 1.8, 0.22 * life.L.nite, [1.0, 0.8, 0.4]);
    padLabels.push([x + 0.5, z + 0.5, c, on]);
  }
  var stars = []; for (var si = 0; si < 70; si++) stars.push([Math.random(), Math.random(), Math.random()]);
  // distant hills behind the ground: two silhouette bands with a little parallax
  var HILLS = {
    forest: { far: '#7fb4c9', near: '#4f8f5a', amp: [1.2, 0.9], trees: true },
    ocean: { far: '#2f7fb0', near: '#1f5f8a', amp: [1.0, 1.4], kelp: true },
    jungle: { far: '#c9a070', near: '#3f7a4a', amp: [2.6, 1.3], trees: true },
    moon: { far: '#3a3f5a', near: '#5a5d6e', amp: [0.8, 0.5] },
    alien: { far: '#5a2f7a', near: '#3a1f55', amp: [1.6, 2.2], spires: true }
  };
  // the hills take the sky's tint: a little mist by day (far scenery is pale and desaturated), the dusk or night colour later
  function hillTint(hex, band) {
    var L = life.L, c = hexRgb(hex), mist = band ? 0.08 : 0.22;
    c = mixRgb(c, [200, 190, 175], mist);
    if (L.hillK > 0) c = mixRgb(c, L.hillC, L.hillK * (band ? 0.9 : 0.75));
    if (life.wi > 0 && (life.wk === 'fog' || life.wk === 'rain' || life.wk === 'storm' || life.wk === 'snow')) c = mixRgb(c, life.wk === 'fog' ? [220, 205, 180] : [120, 128, 140], 0.45 * life.wi);
    return rgbCss(c);
  }
  function hills(id, base, skyH) {
    var H = HILLS[id]; if (!H) return;
    [0, 1].forEach(function (band) {
      var par = band ? 0.35 : 0.15, off = (ox - vw / 2) * par, amp = H.amp[band] * TW, col = hillTint(band ? H.near : H.far, band);
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
  // sun and moon over the horizon of the earthly worlds: a low sun at dawn and dusk, the moon at night
  function skyBodies(id, skyH) {
    var L = life.L, t = life.t, u = TW / 16;
    if (id === 'moon' || id === 'alien') return;
    var ps = (t - 0.18) / 0.64, el = Math.sin(Math.PI * Math.max(0, Math.min(1, ps)));
    var sa = (ps > 0 && ps < 1 ? 1 - sstep(0.25, 0.7, el) : 0) * (1 - 0.8 * life.wi * (life.wk === 'rain' || life.wk === 'storm' || life.wk === 'fog' ? 1 : 0));
    if (sa > 0.02) {
      var sx = vw * (0.12 + 0.76 * ps), sy = skyH * (0.86 - 0.62 * el), sc = mixRgb([255, 150, 70], [255, 235, 170], el);
      var gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, TW * 2.6); gr.addColorStop(0, rgbCss(sc, 0.55 * sa)); gr.addColorStop(1, rgbCss(sc, 0));
      ctx.fillStyle = gr; ctx.fillRect(sx - TW * 2.6, sy - TW * 2.6, TW * 5.2, TW * 5.2);
      ctx.fillStyle = rgbCss(sc, sa); ctx.beginPath(); ctx.arc(sx, sy, TW * 0.5, 0, 7); ctx.fill();
      glow(sx, sy, TW * 1.8, '#ffb060', 0.5 * sa);
    }
    var pm = ((t - 0.8 + 1) % 1) / 0.4, ma = pm >= 0 && pm <= 1 ? L.star * sstep(0, 0.12, Math.min(pm, 1 - pm)) : 0;
    if (ma > 0.02) {
      var mx = vw * (0.12 + 0.76 * pm), my = skyH * (0.7 - 0.5 * Math.sin(Math.PI * pm)), mr = TW * 0.45;
      ctx.globalAlpha = ma; ctx.fillStyle = '#f2eed8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = '#d4d0bc'; ctx.fillRect(mx - mr * 0.45, my - mr * 0.2, u * 2.4, u * 2.4); ctx.fillRect(mx + mr * 0.15, my + mr * 0.25, u * 1.8, u * 1.8); ctx.fillRect(mx - mr * 0.1, my - mr * 0.6, u * 1.6, u * 1.6);
      ctx.globalAlpha = 1; glow(mx, my, TW * 2.2, '#cfd8ff', 0.5 * ma);
    }
  }
  function background(w, rimY, horizonY) {
    var Pl = D.WORLDS[w].pal, id = D.WORLDS[w].id, L = life.L;
    var deep = ctx.createLinearGradient(0, 0, 0, vh); deep.addColorStop(0, shade(Pl.bed, 0.12)); deep.addColorStop(1, '#000');
    ctx.fillStyle = deep; ctx.fillRect(-20, -20, vw + 40, vh + 40);
    if (rimY <= 0) return;
    var skyH = Math.min(vh + 40, rimY);
    var top = hexRgb(Pl.sky[0]), bot = hexRgb(Pl.sky[1]);
    if (id === 'alien') { top = mixRgb(top, L.alT, L.skyK); bot = mixRgb(bot, L.alB, L.skyK); }
    else if (id !== 'moon' && L.skyK > 0) { top = mixRgb(top, L.skyT, L.skyK); bot = mixRgb(bot, L.skyB, L.skyK); }
    var wk = life.wk, wi = life.wi, grey = wk === 'rain' || wk === 'storm' ? (wk === 'storm' ? [58, 64, 82] : [112, 122, 140]) : wk === 'fog' ? [214, 196, 168] : wk === 'snow' ? [196, 204, 216] : null;
    if (grey && id !== 'moon') { var gk = wi * (wk === 'fog' ? 0.8 : 0.6), gn = 1 - 0.55 * L.nite; grey = [grey[0] * gn, grey[1] * gn, grey[2] * gn]; top = mixRgb(top, grey, gk); bot = mixRgb(bot, grey, gk * 0.9); }
    var g = ctx.createLinearGradient(0, 0, 0, skyH); g.addColorStop(0, rgbCss(top)); g.addColorStop(1, rgbCss(bot));
    ctx.fillStyle = g; ctx.fillRect(-20, -20, vw + 40, skyH + 20);
    var u = TW / 16, sa = (id === 'moon' || id === 'alien') ? 1 : L.star * (1 - 0.8 * (grey ? wi : 0));
    if (sa > 0.02) for (var i = 0; i < stars.length; i++) { var s = stars[i]; if (s[1] * vh > skyH) continue; ctx.fillStyle = 'rgba(255,255,255,' + sa * (0.4 + 0.6 * Math.abs(Math.sin(time * (0.5 + s[2]) + i))) + ')'; ctx.fillRect(s[0] * vw, s[1] * skyH, u, u); }
    skyBodies(id, skyH);
    if (id === 'forest' || id === 'ocean' || id === 'jungle') { // clouds: white by day, tinted at dusk, dark before rain
      var cc = mixRgb([255, 255, 255], L.mul, 1), dk = (wk === 'rain' || wk === 'storm') ? (wk === 'storm' ? 0.7 : 0.5) * wi : 0;
      cc = mixRgb(cc, [96, 104, 120], dk);
      var cn = 3 + Math.round((wk === 'rain' || wk === 'storm' ? 4 : 0) * wi);
      ctx.fillStyle = rgbCss(cc, 0.5 + 0.2 * dk);
      for (var c = 0; c < cn; c++) { var cx = ((life.cloudT * u + c * vw * 0.4) % (vw + 200)) - 100, cy = skyH * (0.12 + (c % 3) * 0.1 + Math.floor(c / 3) * 0.05); ctx.fillRect(cx, cy, TW * 1.4, TW * 0.3); ctx.fillRect(cx + TW * 0.3, cy - TW * 0.2, TW * 0.8, TW * 0.3); }
    }
    if (id === 'moon') { var ex = vw * (0.25 + 0.55 * life.t), ey = skyH * 0.2; ctx.fillStyle = '#3a7bd5'; ctx.beginPath(); ctx.arc(ex, ey, TW * 0.7, 0, 7); ctx.fill(); ctx.fillStyle = '#4caf50'; ctx.fillRect(ex - TW * 0.35, ey - TW * 0.3, TW * 0.4, TW * 0.25); ctx.fillRect(ex + TW * 0.05, ey + TW * 0.05, TW * 0.3, TW * 0.3); }
    if (id === 'alien') { ctx.save(); ctx.translate(vw * (0.12 + 0.2 * life.t), skyH * 0.22); ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.arc(0, 0, TW * 0.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffe0b2'; ctx.lineWidth = u * 2; ctx.beginPath(); ctx.ellipse(0, 0, TW * 1.1, TW * 0.28, -0.3, 0, 7); ctx.stroke(); ctx.restore(); }
    if (horizonY !== null) hills(id, horizonY, skyH);
    if (id === 'jungle') { ctx.fillStyle = '#1e7a2e'; for (var v = 0; v < 8; v++) ctx.fillRect(vw * (v / 8 + 0.03), 0, u * 2, TW * (0.6 + (v % 3) * 0.4) + Math.sin(time + v) * u * 3); }
  }

  // ---------- plaza life: time of day, weather, lanterns, ambient animals and reward guests ----------
  // Everything here is visual only: it reads the clock, weather and guest from the state and draws with Math.random,
  // never the game's rng.
  function rgbCss(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : a) + ')'; }
  function mixRgb(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function sstep(a, b, x) { var k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); }
  function lerpAny(a, b, k) { return typeof a === 'number' ? a + (b - a) * k : a.map(function (v, i) { return v + (b[i] - v) * k; }); }
  function lerpObj(a, b, k) { var o = {}; for (var key in a) o[key] = lerpAny(a[key], b[key], k); return o; }
  function hf(i, j) { var v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); }
  // The look of each phase. amb/sh/hi multiply the world's GRADE tints (floor is the least ambient light, so pads, chevrons and
  // the guest stay readable at night); sun and dap scale the plaza's sun pool and leaf dapple; vig adds to the vignette;
  // skyT/skyB tint the sky (alT/alB on the alien world) with weight skyK; hillC/hillK tint the hills; star fades the stars in;
  // nite lights the lanterns and fireflies; mul is the plain-2D multiply tint. Dusk and night are amber with cool shadows.
  var LOOKS = {
    day: { amb: [1, 1, 1], floor: [0, 0, 0], sh: [1, 1, 1], hi: [1, 1, 1], sun: 1, dap: 1, vig: 0, sat: 1, skyT: [143, 211, 255], skyB: [216, 243, 255], skyK: 0, alT: [58, 13, 92], alB: [176, 79, 168], hillC: [0, 0, 0], hillK: 0, star: 0, nite: 0, mul: [255, 255, 255] },
    dawn: { amb: [1.0, 0.86, 0.74], floor: [0, 0, 0], sh: [0.95, 0.9, 1.1], hi: [1.08, 1.0, 0.86], sun: 0.8, dap: 0.7, vig: 0.08, sat: 1.0, skyT: [120, 128, 184], skyB: [255, 176, 120], skyK: 0.7, alT: [90, 40, 150], alB: [255, 208, 112], hillC: [214, 150, 120], hillK: 0.35, star: 0.2, nite: 0.35, mul: [255, 214, 180] },
    dusk: { amb: [1.0, 0.74, 0.58], floor: [0, 0, 0], sh: [0.92, 0.88, 1.1], hi: [1.1, 0.98, 0.78], sun: 0.9, dap: 0.8, vig: 0.14, sat: 1.0, skyT: [84, 66, 140], skyB: [255, 128, 80], skyK: 0.8, alT: [42, 26, 122], alB: [77, 255, 184], hillC: [150, 80, 110], hillK: 0.4, star: 0.3, nite: 0.55, mul: [255, 176, 130] },
    night: { amb: [0.36, 0.33, 0.4], floor: [0.27, 0.26, 0.33], sh: [0.86, 0.96, 1.24], hi: [1.18, 1.03, 0.8], sun: 0, dap: 0, vig: 0.24, sat: 0.92, skyT: [8, 10, 32], skyB: [30, 40, 84], skyK: 0.9, alT: [18, 6, 46], alB: [58, 20, 88], hillC: [14, 22, 40], hillK: 0.65, star: 1, nite: 1, mul: [96, 100, 140] }
  };
  var LOOK_KEYS = [[0.13, 'night'], [0.20, 'dawn'], [0.27, 'day'], [0.73, 'day'], [0.80, 'dusk'], [0.87, 'night']];
  function lookAt(t, id) {
    var L, i;
    if (t <= LOOK_KEYS[0][0] || t >= LOOK_KEYS[5][0]) L = LOOKS.night;
    else for (i = 0; i < 5; i++) if (t < LOOK_KEYS[i + 1][0]) { L = lerpObj(LOOKS[LOOK_KEYS[i][1]], LOOKS[LOOK_KEYS[i + 1][1]], sstep(LOOK_KEYS[i][0], LOOK_KEYS[i + 1][0], t)); break; }
    if (id === 'moon') { // no sun to set there: only the light changes, softly, and the sky stays black
      var d = lerpObj(L, LOOKS.day, 0.5); d.skyK = 0; d.star = 1; d.nite = L.nite; d.hillK = 0; d.mul = lerpAny(L.mul, [255, 255, 255], 0.5); L = d;
    }
    return L;
  }
  // how each weather grades the plaza at full strength (blended to nothing at the edges of its slot)
  var WXG = {
    rain: { amb: [0.76, 0.8, 0.86], sat: 0.9, sun: 0.25, dap: 0.3, vig: 0.08, haze: 0 },
    storm: { amb: [0.55, 0.57, 0.68], sat: 0.82, sun: 0, dap: 0, vig: 0.16, haze: 0 },
    fog: { amb: [1.0, 0.94, 0.82], sat: 0.82, sun: 0.5, dap: 0.5, vig: -0.04, haze: 0.42 },
    snow: { amb: [0.9, 0.93, 1.04], sat: 0.86, sun: 0.4, dap: 0.4, vig: 0, haze: 0.1 },
    wind: { amb: [1, 1, 1], sat: 1, sun: 0.9, dap: 1, vig: 0, haze: 0 },
    meteors: { amb: [1, 1, 1], sat: 1, sun: 1, dap: 1, vig: 0, haze: 0 },
    spores: { amb: [0.94, 1.04, 0.98], sat: 1.04, sun: 0.8, dap: 0.8, vig: 0, haze: 0 },
    glowrain: { amb: [0.8, 0.88, 0.9], sat: 0.95, sun: 0.5, dap: 0.5, vig: 0.06, haze: 0 },
    rainbow: { amb: [1, 1, 1], sat: 1.03, sun: 1, dap: 1, vig: 0, haze: 0 },
    clear: { amb: [1, 1, 1], sat: 1, sun: 1, dap: 1, vig: 0, haze: 0 }
  };
  var life = { lampK: 1, t: 0.3, L: LOOKS.day, wk: 'clear', wi: 0, wg: WXG.clear, wet: 0, ready: false, cloudT: 0 };
  var flashT = 0, FLASH_LEN = 0.32;
  function lifeUpdate(dt, S) {
    if (!S.stats) return;
    var id = D.WORLDS[S.world].id, dp = D.dayPhase(S), wx = D.weather(S);
    life.t = dp.t; life.L = lookAt(dp.t, id); life.id = id;
    life.lampK = id === 'ocean' ? 0.6 : id === 'moon' ? 0.55 : id === 'alien' ? 0.65 : 1; // pale ground burns out under lanterns
    if (id === 'ocean' || id === 'alien') { var dk = 1 - 0.28 * life.L.nite; life.L = lerpObj(life.L, life.L, 0); life.L.amb = life.L.amb.map(function (v) { return v * dk; }); life.L.floor = life.L.floor.map(function (v) { return v * dk; }); }
    life.wk = wx.kind; life.ready = true;
    var edge = wx.kind === 'rainbow' ? 0.14 : 0.08;
    life.wi = wx.kind === 'clear' ? 0 : sstep(0, 1, Math.min(wx.t / edge, (1 - wx.t) / edge));
    var base = WXG[wx.kind] || WXG.clear;
    life.wg = { amb: lerpAny([1, 1, 1], base.amb, life.wi), sat: lerpAny(1, base.sat, life.wi), sun: lerpAny(1, base.sun, life.wi), dap: lerpAny(1, base.dap, life.wi), vig: base.vig * life.wi, haze: base.haze * life.wi };
    life.wet = (wx.kind === 'rain' || wx.kind === 'storm' || wx.kind === 'glowrain') ? life.wi : 0;
    life.cloudT += dt * (8 + (wx.kind === 'wind' ? 50 * life.wi : 0) + (wx.kind === 'storm' ? 20 * life.wi : 0));
    flashT = Math.max(0, flashT - dt);
  }
  // fireflies by night, and the weather on the surface
  var RAIN = [], FLAKES = [], PUFFS = [], FIRE = [];
  (function () { var i; for (i = 0; i < 360; i++) RAIN.push([Math.random(), Math.random(), Math.random()]); for (i = 0; i < 160; i++) FLAKES.push([Math.random(), Math.random(), Math.random(), Math.random() * 6.3]); for (i = 0; i < 30; i++) PUFFS.push([Math.random(), Math.random(), Math.random(), Math.random() * 6.3]); for (i = 0; i < 26; i++) FIRE.push([Math.random(), Math.random(), 0.4 + Math.random(), Math.random() * 6.3, 0.5 + Math.random() * 1.5]); })();
  function rainDrops(n, col, lenK, spd, slant, a, lw) {
    var len = TW * lenK, H = vh + len * 2;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = a; ctx.lineCap = 'butt'; ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var m = RAIN[i], y = ((m[1] + time * spd * (0.85 + 0.3 * m[2])) % 1) * H - len, x = m[0] * (vw + vh * slant) - y * slant;
      ctx.moveTo(x, y); ctx.lineTo(x + slant * len, y - len);
    }
    ctx.stroke(); ctx.restore();
  }
  // ripples where rain lands on the plaza ground, under the props
  function drawRipples(S) {
    if (life.wet <= 0.02) return;
    var n = Math.round((life.wk === 'storm' ? 60 : 38) * life.wet), col = life.wk === 'glowrain' ? '#8dffb0' : '#d8e8ff';
    ctx.save(); ctx.lineWidth = Math.max(1, TW / 40);
    for (var i = 0; i < n; i++) {
      var per = 0.8 + hf(i, 1) * 0.7, cyc = time / per + hf(i, 2) * 9, idx = Math.floor(cyc), ph = cyc - idx;
      var x = cam.fx - 9 + hf(i, idx * 3 + 4) * 18, z = cam.fz - 9 + hf(idx, i * 5 + 7) * 18, c = D.hubCell(Math.floor(x), Math.floor(z));
      if (c !== '.' && c !== '=') continue;
      var q = P(x, 1, z), r = (0.08 + ph * 0.4) * hw;
      ctx.strokeStyle = rgba(col, (1 - ph) * 0.55 * life.wet); ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * 0.5, 0, 0, 7); ctx.stroke();
      if (life.wk === 'glowrain' && ph < 0.5) glow(q[0], q[1], TW * 0.25, '#7dffa0', (0.5 - ph) * 0.8);
    }
    ctx.restore();
  }
  function drawWeather(S, surfaceView) {
    var k = life.wk, wi = life.wi, u = TW / 16, i;
    if (k === 'clear' || wi <= 0.01) return;
    ctx.save();
    if (!surfaceView) { ctx.beginPath(); ctx.rect(0, 0, vw, Math.max(0, P(0, 1, 0)[1] + N * hh)); ctx.clip(); }
    if (k === 'rain') rainDrops(Math.round(230 * wi), '#d8e8ff', 0.7, 1.25, 0.22, 0.8, Math.max(1.2, u * 0.6));
    else if (k === 'storm') { rainDrops(Math.round(360 * wi), '#cddaf5', 0.9, 1.6, 0.4, 0.8, Math.max(1.2, u * 0.65)); }
    else if (k === 'glowrain') {
      rainDrops(Math.round(160 * wi), '#8dffb0', 0.6, 0.8, 0.12, 0.95, Math.max(1.4, u * 0.7));
      for (i = 0; i < 12 * wi; i++) { var m = RAIN[i], gy = ((m[1] + time * 0.8 * (0.85 + 0.3 * m[2])) % 1) * (vh + TW), gx = m[0] * (vw + vh * 0.12) - gy * 0.12; glow(gx, gy, TW * 0.4, '#7dffa0', 0.55 * wi); }
    } else if (k === 'snow') {
      ctx.fillStyle = 'rgba(232,240,255,' + 0.12 * wi + ')'; ctx.fillRect(0, 0, vw, vh);
      for (i = 0; i < Math.round(150 * wi); i++) {
        var f = FLAKES[i], y = ((f[1] + time * 0.07 * (0.6 + f[2])) % 1) * (vh + 20) - 10, x = (f[0] * vw + Math.sin(time * 0.8 + f[3]) * TW * 0.35 + y * 0.05) % vw, sz = Math.max(1.5, u * (0.8 + f[2] * 1.3));
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 + 0.35 * f[2]) + ')'; ctx.fillRect(x, y, sz, sz);
      }
    } else if (k === 'fog') {
      ctx.fillStyle = rgba('#e8d6b4', 0.2 * wi); ctx.fillRect(0, 0, vw, vh); // a warm haze over everything
      for (i = 0; i < 8; i++) {
        var fm = PUFFS[i], bw = vw * (0.5 + fm[2] * 0.5), bx = ((fm[0] * vw * 1.6 + time * TW * 0.12 * (0.4 + fm[2])) % (vw * 1.6 + bw)) - bw * 0.6, by = vh * (0.12 + fm[1] * 0.78), bh2 = vh * (0.12 + fm[2] * 0.1);
        ctx.save(); ctx.translate(bx + bw / 2, by); ctx.scale(1, bh2 / (bw / 2));
        var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, bw / 2); gr.addColorStop(0, rgba('#f0dfc0', 0.34 * wi)); gr.addColorStop(1, rgba('#f0dfc0', 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, bw / 2, 0, 7); ctx.fill(); ctx.restore();
      }
    } else if (k === 'wind') {
      ctx.strokeStyle = 'rgba(235,250,255,' + 0.55 * wi + ')'; ctx.lineWidth = Math.max(1.2, u * 0.6); ctx.beginPath();
      for (i = 0; i < 34; i++) {
        var w = FLAKES[i], wx = ((w[0] * (vw + 300) + time * TW * (6 + 5 * w[2])) % (vw + 300)) - 150, wy = w[1] * vh + Math.sin(time * 2 + w[3]) * TW * 0.15, ln = TW * (1.2 + w[2] * 1.6);
        ctx.moveTo(wx, wy); ctx.lineTo(wx - ln, wy - ln * 0.08);
      }
      ctx.stroke();
      for (i = 0; i < 16; i++) { // leaves tumbling past
        var lf = FLAKES[40 + i], lx = ((lf[0] * (vw + 200) + time * TW * (5 + 4 * lf[2])) % (vw + 200)) - 100, ly = ((lf[1] * vh + time * TW * 0.5 * lf[2]) % vh) + Math.sin(time * 5 + lf[3]) * TW * 0.2;
        ctx.fillStyle = i % 2 ? 'rgba(120,170,70,0.85)' : 'rgba(200,160,70,0.85)'; ctx.fillRect(lx, ly, u * 1.6, u * 1.1);
      }
    } else if (k === 'spores') {
      for (i = 0; i < 30; i++) {
        var p = PUFFS[i], px2 = ((p[0] * vw + Math.sin(time * 0.3 * (0.5 + p[2]) + p[3]) * TW * 0.7) % vw + vw) % vw, py = ((p[1] * vh - time * TW * 0.22 * (0.4 + p[2])) % vh + vh) % vh, r = TW * (0.12 + p[2] * 0.2) * (0.8 + 0.2 * Math.sin(time * 1.5 + p[3]));
        var col = ['#9dff8a', '#7df9ff', '#ff9af0'][i % 3];
        var sg = ctx.createRadialGradient(px2, py, 0, px2, py, r * 2); sg.addColorStop(0, rgba(col, 0.95 * wi)); sg.addColorStop(0.35, rgba(col, 0.45 * wi)); sg.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px2, py, r * 2, 0, 7); ctx.fill();
        glow(px2, py, r * 3.5, col, 0.6 * wi);
      }
    } else if (k === 'meteors') {
      for (i = 0; i < 5; i++) {
        var per = 3.4, cyc = time / per + i * 0.61, idx = Math.floor(cyc), ph = cyc - idx;
        if (ph > 0.3) continue;
        var e = ph / 0.3, sx = hf(i, idx) * vw * 0.85 + vw * 0.05, sy = hf(idx, i + 3) * vh * 0.35, dx = 0.82, dy = 0.57, hl = TW * 11 * e, tl = TW * 4.5;
        var hx2 = sx + dx * hl, hy2 = sy + dy * hl, ax = hx2 - dx * tl, ay = hy2 - dy * tl, a2 = wi * Math.sin(e * Math.PI);
        var mg = ctx.createLinearGradient(ax, ay, hx2, hy2); mg.addColorStop(0, 'rgba(160,200,255,0)'); mg.addColorStop(1, 'rgba(255,250,235,' + a2 + ')');
        ctx.strokeStyle = mg; ctx.lineWidth = Math.max(2, u * 1.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx2, hy2); ctx.stroke();
        glow(hx2, hy2, TW * 0.9, '#bfe0ff', 0.8 * a2);
      }
    } else if (k === 'rainbow') {
      var cx0 = vw * 0.5 + vw * 0.08 * Math.sin(life.t * 6.3), cy0 = vh * 1.05, R = Math.max(vw * 0.62, vh * 0.8), a3 = 0.2 * wi * (0.4 + 0.6 * life.L.sun * 0 + 0.6 * (1 - life.L.nite));
      var cols = ['#ff5a5a', '#ff9a3a', '#ffe14a', '#6ad86a', '#4aa8ff', '#7a5aff', '#b05aff'];
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = R * 0.024;
      for (i = 0; i < 7; i++) { ctx.strokeStyle = rgba(cols[i], a3); ctx.beginPath(); ctx.arc(cx0, cy0, R - i * R * 0.023, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    }
    ctx.restore();
    if (wi > 0.01 && (k === 'rain' || k === 'storm') && life.L.nite < 0.2) { ctx.fillStyle = 'rgba(30,40,60,' + 0.05 * wi + ')'; }
  }
  function drawFireflies(S, surfaceView) {
    var nt = life.L.nite; if (!surfaceView || nt < 0.25 || (life.id !== 'forest' && life.id !== 'jungle') || life.wet > 0.6) return;
    var u = Math.max(1.5, TW / 22);
    for (var i = 0; i < FIRE.length; i++) {
      var f = FIRE[i], x = ((f[0] * vw + Math.sin(time * 0.35 * f[2] + f[3]) * TW * 1.3) % vw + vw) % vw, y = vh * (0.3 + 0.65 * f[1]) + Math.cos(time * 0.5 * f[2] + f[3] * 2) * TW * 0.5;
      var a = Math.pow(Math.max(0, Math.sin(time * f[4] + f[3])), 2) * nt;
      if (a < 0.05) continue;
      ctx.fillStyle = rgba('#e8ff80', a); ctx.fillRect(x, y, u, u);
      glow(x, y, TW * 0.55, '#d4ff60', a * 0.9);
      if (i % 5 === 0) light(x, y, TW * 1.4, 0.18 * a, [0.8, 1, 0.4]);
    }
  }
  // ---- lightning: ui.js calls flash() in time with thunder ----
  function flash() { flashT = FLASH_LEN; }
  function flashAmt() { var f = flashT / FLASH_LEN; return f <= 0 ? 0 : f * f * (0.75 + 0.25 * Math.cos(f * 28)); }

  // ---- lanterns on posts, with strings of hanging lanterns between them ----
  var POLES = [[-2, 8], [3, 8], [8, 8], [8, 3], [8, -2], [-2, 3]], LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5]], PH = 1.85, BULBS = 4;
  var lampPoles = null, lampLinks = null, lampLit = {};
  function lampSetup() {
    if (lampPoles) return;
    var map = {}; lampPoles = []; lampLinks = [];
    POLES.forEach(function (p, i) { if (D.hubCell(p[0], p[1]) === '.') { map[i] = lampPoles.length; lampPoles.push({ x: p[0] + 0.5, z: p[1] + 0.5 }); } });
    LINKS.forEach(function (l) { if (map[l[0]] != null && map[l[1]] != null) lampLinks.push([map[l[0]], map[l[1]]]); });
  }
  function bulbAt(a, b, t) { return [a.x + (b.x - a.x) * t, 1 - PH + 0.34 * 4 * t * (1 - t), a.z + (b.z - a.z) * t]; }
  // the lanterns nearest the miner get a real light; the rest only glow
  function lanternPrep(surfaceView) {
    lampSetup(); lampLit = {};
    if (!surfaceView || life.L.nite < 0.03) return;
    var all = [], mq = lastMiner || [vw / 2, vh / 2];
    lampPoles.forEach(function (p, i) { var q = P(p.x, 1 - PH, p.z); all.push(['p' + i, Math.hypot(q[0] - mq[0], q[1] - mq[1])]); });
    lampLinks.forEach(function (l, li) { for (var b = 1; b <= BULBS; b++) { var w = bulbAt(lampPoles[l[0]], lampPoles[l[1]], b / (BULBS + 1)), q = P(w[0], w[1], w[2]); all.push(['b' + li + '_' + b, Math.hypot(q[0] - mq[0], q[1] - mq[1])]); } });
    all.sort(function (a, b) { return a[1] - b[1]; });
    for (var i = 0; i < Math.min(5, all.length); i++) lampLit[all[i][0]] = 1;
  }
  function lantern(x, y, u, key, big) { // one lantern hanging at the screen point (x, y)
    var nt = life.L.nite, warm = mixRgb([176, 138, 80], [255, 214, 130], nt), w = big ? 4 : 2.6, h = big ? 6 : 4;
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - (w + 1) * u * 0.5, y - 1 * u, (w + 1) * u, (h + 2) * u);
    ctx.fillStyle = rgbCss(warm); ctx.fillRect(x - w * u * 0.5, y, w * u, h * u);
    if (nt < 0.03) return;
    ctx.fillStyle = rgba('#fff3c0', nt * 0.9); ctx.fillRect(x - w * u * 0.25, y + u, w * u * 0.5, (h - 2) * u);
    glow(x, y + h * u * 0.5, TW * (big ? 0.9 : 0.55), '#ffb44a', 0.7 * nt);
    if (lampLit[key]) light(x, y + h * u * 0.5, TW * (big ? 2.4 : 1.7), (big ? 0.5 : 0.3) * nt * life.lampK, [1.0, 0.66, 0.32]);
  }
  function lanternPole(i) {
    var p = lampPoles[i], u = Math.max(1, TW / 32);
    blob(p.x, p.z, 0.3, 0.2);
    box(p.x - 0.045, p.z - 0.045, 0.09, 0.09, 1, PH - 0.12, '#3a2616');
    box(p.x - 0.09, p.z - 0.09, 0.18, 0.18, 1, 0.1, '#2a1a10');
    var q = P(p.x, 1 - PH + 0.05, p.z);
    lantern(q[0], q[1], u, 'p' + i, true);
    if (life.wet > 0.05 && life.L.nite > 0.05) { // warm reflections on the wet cobbles
      var g = P(p.x, 1, p.z), gr = ctx.createLinearGradient(0, g[1], 0, g[1] + TW * 1.1);
      gr.addColorStop(0, rgba('#ffb44a', 0.4 * life.wet * life.L.nite)); gr.addColorStop(1, rgba('#ffb44a', 0));
      ctx.fillStyle = gr; ctx.fillRect(g[0] - TW * 0.12, g[1], TW * 0.24, TW * 1.1);
    }
  }
  function lanternString(li) {
    var l = lampLinks[li], a = lampPoles[l[0]], b = lampPoles[l[1]], u = Math.max(1, TW / 32), i;
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = Math.max(1, u * 0.8); ctx.beginPath();
    for (i = 0; i <= 12; i++) { var w = bulbAt(a, b, i / 12), q = P(w[0], w[1], w[2]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke();
    for (i = 1; i <= BULBS; i++) { var w2 = bulbAt(a, b, i / (BULBS + 1)), q2 = P(w2[0], w2[1], w2[2]); lantern(q2[0], q2[1] + u, u, 'b' + li + '_' + i, false); }
  }
  function lanternItems(S, items) {
    lampSetup();
    if (life.L.nite > 0.03) items.push(feet(HUB_DOOR[0] + 0.5, HUB_DOOR[1] + 0.5, function () { // lamps either side of the museum door
      var nt = life.L.nite, d1 = P(HUB_DOOR[0] + 0.1, 0.1, HUB_DOOR[1] - 0.2), d2 = P(HUB_DOOR[0] + 0.1, 0.1, HUB_DOOR[1] + 1.2);
      [d1, d2].forEach(function (q) { ctx.fillStyle = rgba('#ffd27a', nt); ctx.fillRect(q[0] - TW * 0.05, q[1], TW * 0.1, TW * 0.14); glow(q[0], q[1] + TW * 0.07, TW * 0.8, '#ffb44a', 0.75 * nt); });
      var c = P(HUB_DOOR[0] + 0.6, 0.6, HUB_DOOR[1] + 0.5); light(c[0], c[1], TW * 2.6, 0.4 * nt, [1.0, 0.72, 0.4]);
    }, 0.3));
    lampPoles.forEach(function (p, i) { items.push(feet(p.x, p.z, function () { lanternPole(i); }, 0.15)); });
    lampLinks.forEach(function (l, li) {
      var a = lampPoles[l[0]], b = lampPoles[l[1]], f = a.x + a.z > b.x + b.z ? a : b, o = f === a ? b : a;
      items.push({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x) + 0.01, z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) + 0.01, fn: function () { lanternString(li); }, str: true });
    });
  }

  // ---- ambient animals ----
  var ZOO = {
    forest: [{ k: 'butterfly', n: 4, mode: 'flutter', when: 'day', s: 0.7, h: [0.4, 1.3] }, { k: 'rabbit', n: 1, mode: 'hop', when: 'day' }, { k: 'owl', n: 1, mode: 'cross', when: 'night', s: 1.5, h: [2.2, 3.2], every: [5, 12] }],
    ocean: [{ k: 'gull', n: 3, mode: 'cross', when: 'day', s: 2.4, h: [2.0, 3.4], every: [3, 8] }, { k: 'peep', n: 2, mode: 'run', when: 'day' }],
    jungle: [{ k: 'bird', n: 3, mode: 'cross', when: 'day', s: 3, h: [1.8, 3.0], every: [3, 8] }, { k: 'morpho', n: 3, mode: 'flutter', when: 'day', s: 0.8, h: [0.4, 1.4] }, { k: 'bat', n: 2, mode: 'flutter', when: 'night', s: 1.6, h: [1.4, 2.6] }],
    moon: [{ k: 'hopper', n: 3, mode: 'hop', when: 'any', big: true }],
    alien: [{ k: 'jelly', n: 3, mode: 'flutter', when: 'any', s: 0.25, h: [0.8, 2.0], glow: '#ff9ae6' }, { k: 'glowmoth', n: 3, mode: 'flutter', when: 'any', s: 0.6, h: [0.4, 1.4], glow: '#7dffe0' }]
  };
  var crit = [], zooT = 0;
  function ruleOn(r) {
    var nt = life.L.nite, calm = !(life.wk === 'rain' || life.wk === 'storm' || life.wk === 'snow' || life.wk === 'glowrain') || life.wi < 0.3;
    if (r.when === 'day') return nt < 0.5 && calm && !(life.wk === 'fog' && life.wi > 0.7);
    if (r.when === 'night') return nt > 0.7 && calm;
    return true;
  }
  function grassAt(x, z) { var c = D.hubCell(Math.floor(x), Math.floor(z)); return c === '.'; }
  function spawnCrit(r) {
    var c = { r: r, k: r.k, x: 0, z: 0, h: 0, ang: Math.random() * 6.28, seed: Math.random() * 100, fade: 0, dying: false, age: 0, st: 'wait', tm: Math.random() * 2, hp: 0, hx: 0, hz: 0 }, i;
    if (r.mode === 'cross') {
      var a = Math.random() * 6.28, d = 10;
      c.x = cam.fx + Math.cos(a) * d; c.z = cam.fz + Math.sin(a) * d;
      var ta = a + Math.PI + (Math.random() - 0.5) * 0.7; c.vx = Math.cos(ta) * r.s; c.vz = Math.sin(ta) * r.s;
      c.h = r.h[0] + Math.random() * (r.h[1] - r.h[0]); c.fade = 1;
    } else if (r.mode === 'flutter') {
      c.x = cam.fx + (Math.random() - 0.5) * 9; c.z = cam.fz + (Math.random() - 0.5) * 9; c.h = r.h[0] + Math.random() * (r.h[1] - r.h[0]);
    } else {
      for (i = 0; i < 12; i++) { c.x = cam.fx + (Math.random() - 0.5) * 9; c.z = cam.fz + (Math.random() - 0.5) * 9; if (grassAt(c.x, c.z)) break; }
      if (!grassAt(c.x, c.z)) return null;
    }
    return c;
  }
  function critUpdate(dt, S) {
    var id = life.id, rules = ZOO[id] || [], surf = S.mode === 'surface';
    if (!surf) { crit.length = 0; return; }
    zooT -= dt;
    for (var i = crit.length - 1; i >= 0; i--) { // retire animals of another world
      if (rules.indexOf(crit[i].r) < 0) crit.splice(i, 1);
    }
    rules.forEach(function (r) {
      var on = ruleOn(r), mine = crit.filter(function (c) { return c.r === r && !c.dying; });
      if (!on) mine.forEach(function (c) { c.dying = true; });
      else if (mine.length < r.n && zooT <= 0) {
        var c = spawnCrit(r); if (c) { crit.push(c); zooT = r.every ? r.every[0] + Math.random() * (r.every[1] - r.every[0]) : 0.4 + Math.random() * 1.5; }
      }
    });
    for (var j = crit.length - 1; j >= 0; j--) {
      var c = crit[j], r = c.r; c.age += dt;
      c.fade = c.dying ? c.fade - dt / 1.5 : Math.min(1, c.fade + dt / (r.mode === 'cross' ? 0.1 : 1.2));
      if (c.dying && c.fade <= 0) { crit.splice(j, 1); continue; }
      var dm = Math.hypot(c.x - cam.fx, c.z - cam.fz);
      if (r.mode === 'cross') {
        c.x += c.vx * dt; c.z += c.vz * dt; c.h += Math.sin(time * 0.8 + c.seed) * 0.1 * dt;
        if (c.age > 2 && dm > 11.5) crit.splice(j, 1);
      } else if (r.mode === 'flutter') {
        c.ang += (Math.random() - 0.5) * dt * 5;
        if (dm > 6.5) { var toward = Math.atan2(cam.fz - c.z, cam.fx - c.x), df = Math.atan2(Math.sin(toward - c.ang), Math.cos(toward - c.ang)); c.ang += df * Math.min(1, dt * 2); }
        c.x += Math.cos(c.ang) * r.s * dt; c.z += Math.sin(c.ang) * r.s * dt;
        c.hb = c.hb == null ? c.h : c.hb; c.h = c.hb + Math.sin(time * 1.3 + c.seed) * 0.25;
        c.vx = Math.cos(c.ang); c.vz = Math.sin(c.ang);
      } else { // hop and run on the grass
        c.tm -= dt;
        var big = r.big, hopLen = big ? 0.7 : 0.42, hopD = big ? 0.9 : 0.5;
        if (c.st === 'wait') {
          c.hp = 0; var near = S.mode === 'surface' ? Math.hypot(c.x - (S.hub.x), c.z - (S.hub.z)) : 9;
          if (c.tm <= 0 || near < 1.8) {
            var a = near < 1.8 ? Math.atan2(c.z - S.hub.z, c.x - S.hub.x) : Math.random() * 6.28, tries = 0;
            while (tries++ < 8 && !grassAt(c.x + Math.cos(a) * hopD * 2, c.z + Math.sin(a) * hopD * 2)) a += 0.8;
            c.ang = a; c.st = 'move'; c.left = r.mode === 'run' ? 0.8 + Math.random() * 0.6 : (2 + Math.floor(Math.random() * 3)) * hopLen; c.hp = 0;
          }
        } else {
          var sp = r.mode === 'run' ? 2.3 : hopD / hopLen, nx = c.x + Math.cos(c.ang) * sp * dt, nz = c.z + Math.sin(c.ang) * sp * dt;
          if (grassAt(nx, nz)) { c.x = nx; c.z = nz; } else c.left = 0;
          c.hp += dt; c.left -= dt; c.vx = Math.cos(c.ang); c.vz = Math.sin(c.ang);
          if (c.left <= 0) { c.st = 'wait'; c.tm = 1.5 + Math.random() * 3.5; }
        }
        if (dm > 12) crit.splice(j, 1);
      }
    }
  }
  var CRIT_SCALE = { butterfly: 0.6, morpho: 0.65, glowmoth: 0.65, rabbit: 1, owl: 1, gull: 1, peep: 1, bird: 1, bat: 1, hopper: 1.1, jelly: 1.1 };
  function critDraw(c) {
    var r = c.r, fl = r.mode === 'cross' || r.mode === 'flutter', frame, hgt = c.h || 0;
    var dx = ((c.vx || 0) - (c.vz || 0)), flip = dx < 0, sc = TW / 20 * (CRIT_SCALE[c.k] || 1);
    if (fl) frame = Math.floor(time * (c.k === 'butterfly' || c.k === 'morpho' || c.k === 'glowmoth' ? 7 : c.k === 'jelly' ? 1.6 : c.k === 'owl' ? 2.6 : 4.5) + c.seed) & 1;
    else if (r.mode === 'run') { frame = Math.floor(time * 9 + c.seed) & 1; if (c.st === 'wait') frame = 0; if (c.vx != null) flip = (c.vx - c.vz) < 0; }
    else { var air = c.st === 'move' ? Math.sin(Math.PI * ((c.hp / (r.big ? 0.7 : 0.42)) % 1)) : 0; hgt = air * (r.big ? 0.9 : 0.4); frame = air > 0.2 ? 1 : 0; if (c.vx != null) flip = (c.vx - c.vz) < 0; }
    var spr = DTWSprites.creature(c.k, frame); if (!spr) return;
    var q = P(c.x, 1, c.z), ay = q[1] - hgt * bh;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, c.fade));
    ctx.fillStyle = 'rgba(0,0,0,' + (fl ? 0.16 : 0.22) + ')'; var sr = fl ? 0.22 + hgt * 0.03 : 0.3; ctx.beginPath(); ctx.ellipse(q[0], q[1], hw * sr, hh * sr, 0, 0, 7); ctx.fill();
    ctx.translate(Math.round(q[0]), Math.round(ay)); if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr.cv, -Math.round(spr.fx * sc), -Math.round(spr.fy * sc), Math.round(spr.cv.width * sc), Math.round(spr.cv.height * sc));
    ctx.restore();
    if (r.glow) glow(q[0], ay - spr.fy * sc * 0.5, TW * 0.5, r.glow, 0.55 * c.fade);
  }
  function critItems(S, items) {
    crit.forEach(function (c) { items.push(feet(c.x, c.z, function () { critDraw(c); }, 0.2)); });
  }

  // ---- the reward guest: arrives, waits with a gift cue, then leaves with hearts ----
  var GUEST_FLY = { parrot: 1, saucer: 1 }, GUEST_HOP = { fox: 1, frog: 1, glorpling: 1, moonbot: 1 }, GUEST_FLYIN = { parrot: 1, saucer: 1, star: 1 };
  var gst = null, gfx = [];
  function easeOut(k) { k = Math.max(0, Math.min(1, k)); return 1 - (1 - k) * (1 - k); }
  function guestUpdate(dt, S) {
    var g = S.guest;
    if (g && (!gst || gst.leaving || gst.kind !== g.kind || gst.x !== g.x || gst.z !== g.z)) {
      var dE = [g.x - HX0, HX1 - g.x, g.z - HZ0, HZ1 - g.z], mi = 0, e;
      for (e = 1; e < 4; e++) if (dE[e] < dE[mi]) mi = e;
      var off = Math.min(dE[mi], 7), dir = [[-1, 0], [1, 0], [0, -1], [0, 1]][mi];
      gst = { kind: g.kind, x: g.x, z: g.z, ox: dir[0] * off, oz: dir[1] * off, age: 0, leaving: false, seed: Math.random() * 10, face: dir[0] - dir[1] > 0 ? -1 : 1 };
      if (g.kind === 'pot') { gst.ox = gst.oz = 0; }
    } else if (!g && gst && !gst.leaving) {
      gst.leaving = true; gst.age = 0; gst.pz = S.hub ? S.hub.z : gst.z; gst.px = S.hub ? S.hub.x : gst.x;
      var ax = gst.x - gst.px, az = gst.z - gst.pz, al = Math.hypot(ax, az) || 1; gst.lx = ax / al; gst.lz = az / al;
      for (var i = 0; i < 5; i++) gfx.push({ t: 'heart', x: gst.x + (Math.random() - 0.5) * 0.7, z: gst.z + (Math.random() - 0.5) * 0.7, h: 0.8 + Math.random() * 0.4, vh: 0.9 + Math.random() * 0.5, age: -i * 0.12, life: 1.6, sw: Math.random() * 6 });
      for (var j = 0; j < 8; j++) gfx.push({ t: 'spark', x: gst.x, z: gst.z, h: 0.7, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, vh: Math.random() * 1.6, age: 0, life: 0.9, c: j % 2 ? '#ffe27a' : '#ffffff' });
      if (gst.kind === 'pot' || gst.kind === 'star') for (var m = 0; m < 10; m++) gfx.push({ t: 'spark', x: gst.x, z: gst.z, h: 0.6, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vh: Math.random() * 2.2, age: 0, life: 1.2, c: '#ffd23f' });
    }
    if (gst) { gst.age += dt; if (gst.leaving && gst.age > 1.9) gst = null; }
    for (var k = gfx.length - 1; k >= 0; k--) { var f = gfx[k]; f.age += dt; if (f.age > f.life) { gfx.splice(k, 1); continue; } if (f.age > 0) { f.h += (f.vh || 0) * dt; if (f.t === 'spark') { f.vh -= 3 * dt; f.x += f.vx * dt; f.z += f.vz * dt; } } }
  }
  function guestPose(S) { // where the guest is drawn: x, z, height, scale, frame, alpha, flip
    var g = gst, k = g.kind, T = g.age, o = { x: g.x, z: g.z, h: 0, sc: TW / 17, frame: 0, a: 1, flip: g.face < 0, moving: false };
    if (!g.leaving) {
      var arr = k === 'pot' ? 0.8 : k === 'star' ? 1.4 : 2.4, e = easeOut(T / arr);
      if (T < arr) {
        if (k === 'pot') { o.sc *= easeOut(T / arr) * 1.0 + 0.0; o.a = Math.min(1, T * 3); }
        else if (k === 'star') { o.h = 6 * (1 - e) * (1 - e); }
        else { o.x = g.x + g.ox * (1 - e); o.z = g.z + g.oz * (1 - e); o.flip = (g.ox - g.oz) > 0; o.moving = true; if (GUEST_FLYIN[k]) o.h = 2.6 * (1 - e); else if (GUEST_HOP[k]) o.h = Math.abs(Math.sin(T * 9)) * 0.3; }
      }
      if (o.moving) o.frame = Math.floor(T * 8) & 1; else o.frame = Math.floor(time * 2.2 + g.seed) & 1;
      if (!o.moving) {
        if (GUEST_HOP[k]) { var cy = (time * 0.55 + g.seed) % 1; o.h = cy < 0.3 ? Math.sin(Math.PI * cy / 0.3) * 0.4 : 0; o.frame = cy < 0.3 ? 1 : 0; }
        else if (k === 'saucer') { o.h = 0.7 + Math.sin(time * 2 + g.seed) * 0.1; o.frame = Math.floor(time * 3) & 1; }
        else if (k === 'star') { o.h = 0.55 + Math.sin(time * 2.2) * 0.12; o.frame = Math.floor(time * 2.6) & 1; o.sc *= 1 + 0.07 * Math.sin(time * 5); }
        else if (k === 'pot') o.frame = Math.floor(time * 2.5) & 1;
        else if (k === 'parrot') o.h = 0;
        if (k === 'traveller') o.h = (o.frame ? 0.02 : 0);
      }
      o.flip = o.moving ? o.flip : (g.face < 0 ? true : false);
      if (!o.moving && S.hub) o.flip = (g.x - S.hub.x) - (g.z - S.hub.z) > 0; // turns to face the miner
    } else {
      var t2 = g.age, run = 3.6 * t2 * Math.min(1, t2 * 1.5);
      o.moving = true; o.flip = (g.lx - g.lz) < 0 ? true : false; o.flip = !(g.lx - g.lz < 0) ? false : true; o.flip = (g.lx - g.lz) < 0;
      o.x = g.x + g.lx * run; o.z = g.z + g.lz * run; o.a = Math.max(0, 1 - Math.max(0, t2 - 1.2) / 0.7);
      o.frame = Math.floor(t2 * 9) & 1;
      if (k === 'star') { o.h = 0.55 + t2 * 5; o.x = g.x; o.z = g.z; o.a = Math.max(0, 1 - t2 / 1.2); }
      else if (k === 'pot') { o.x = g.x; o.z = g.z; o.a = Math.max(0, 1 - t2 / 0.5); o.sc *= 1 + t2 * 0.3; }
      else if (GUEST_FLY[k]) o.h = 0.7 + t2 * 2.5;
      else o.h = Math.abs(Math.sin(t2 * 10)) * 0.3;
    }
    return o;
  }
  function pixelHeart(x, y, s, a) { // a small pixel heart centred on (x, y)
    var spr = DTWSprites.creature('heart', 0); ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr.cv, Math.round(x - spr.cv.width * s / 2), Math.round(y - spr.cv.height * s / 2), Math.round(spr.cv.width * s), Math.round(spr.cv.height * s)); ctx.restore();
  }
  function guestDraw(S) {
    var g = gst, o = guestPose(S), spr = DTWSprites.creature(g.kind, o.frame); if (!spr) return;
    var q = P(o.x, 1, o.z), ay = q[1] - o.h * bh, sc = o.sc, nt = life.L.nite;
    ctx.save(); ctx.globalAlpha = Math.max(0, o.a);
    ctx.fillStyle = 'rgba(0,0,0,' + (o.h > 0.3 ? 0.18 : 0.28) + ')'; ctx.beginPath(); ctx.ellipse(q[0], q[1], hw * 0.34, hh * 0.34, 0, 0, 7); ctx.fill();
    ctx.translate(Math.round(q[0]), Math.round(ay)); if (o.flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    var wd = Math.round(spr.cv.width * sc), ht = Math.round(spr.cv.height * sc);
    ctx.drawImage(spr.cv, -Math.round(wd / 2), -ht, wd, ht);
    ctx.restore();
    var top = ay - ht;
    // glow so a child sees it at night, and the kind's own light
    var gc = g.kind === 'saucer' ? '#7dffa0' : g.kind === 'star' ? '#ffe27a' : g.kind === 'pot' ? '#ffd23f' : '#ffe9a8';
    glow(q[0], ay - ht * 0.5, TW * (g.kind === 'star' || g.kind === 'saucer' ? 1.4 : 0.9), gc, (0.2 + 0.35 * nt) * o.a);
    if (!g.leaving) light(q[0], ay - ht * 0.4, TW * 2.0, (0.22 + 0.45 * nt) * o.a, g.kind === 'saucer' ? [0.5, 1, 0.65] : [1.0, 0.85, 0.5]);
    if (g.kind === 'star' || g.kind === 'pot') { // twinkle and glint
      var tw = Math.max(0, Math.sin(time * 4 + g.seed)); if (tw > 0.2) sparkle(q[0] + (g.kind === 'pot' ? -ht * 0.15 : ht * 0.3), top + ht * 0.2, TW * 0.12 * tw, 0.9 * tw * o.a, '#fff6c0');
    }
    if (g.leaving || g.age < 0.6) return;
    // the gift cue: a bouncing pixel gift box over its head
    var bounce = Math.abs(Math.sin(time * 4)) * TW * 0.2, gs = TW / 13, gi = DTWSprites.creature('gift', 0), gy = top - TW * 0.25 - bounce;
    glow(q[0], gy - gi.cv.height * gs / 2, TW * 0.7, '#ffd23f', 0.5 + 0.2 * nt);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = Math.min(1, (g.age - 0.6) * 3);
    ctx.drawImage(gi.cv, Math.round(q[0] - gi.cv.width * gs / 2), Math.round(gy - gi.cv.height * gs), Math.round(gi.cv.width * gs), Math.round(gi.cv.height * gs)); ctx.restore();
    var tw2 = (time * 1.3) % 1; sparkle(q[0] + TW * 0.34, gy - TW * 0.3 - tw2 * TW * 0.1, TW * 0.08 * Math.sin(Math.PI * tw2), Math.sin(Math.PI * tw2), '#fff6c0');
  }
  function gfxDraw() {
    gfx.forEach(function (f) {
      if (f.age < 0) return;
      var q = P(f.x, 1, f.z), y = q[1] - f.h * bh, a = 1 - f.age / f.life;
      if (f.t === 'heart') pixelHeart(q[0] + Math.sin(f.age * 5 + f.sw) * TW * 0.15, y, TW / 24, Math.min(1, a * 2));
      else { sparkle(q[0], y, TW * 0.09 * a + 1, a, f.c); }
    });
  }
  function guestItems(S, items) {
    if (S.mode !== 'surface' || !gst) return;
    var g = gst;
    items.push(feet(g.leaving ? g.x : g.x, g.z, function () { if (gst) guestDraw(S); }, 0.35));
    if (gfx.length) items.push(feet(g.x, g.z + 0.4, gfxDraw, 0.2));
  }
  // an arrow at the screen edge towards a waiting guest that is off screen, with the gift on it
  function guestMark(S) {
    if (!gst || gst.leaving || S.mode !== 'surface' || gst.age < 1) return;
    var q = P(gst.x, 1, gst.z), u = TW * 0.5, x = q[0], y = q[1] - TW * 0.9, m = u * 1.2;
    if (x >= m && x <= vw - m && y >= m * 1.6 && y <= vh - m) return;
    var ex = Math.max(m, Math.min(vw - m, x)), ey = Math.max(m * 1.6, Math.min(vh - m * 2.4, y)), bob = Math.abs(Math.sin(time * 5)) * TW * 0.12;
    var gi = DTWSprites.creature('gift', 0), pulse = 1 + 0.06 * Math.sin(time * 10);
    glow(ex, ey, TW * 0.9, '#ffd23f', 0.6);
    octx.save(); octx.translate(ex, ey - bob); octx.scale(pulse, pulse);
    var ang = Math.atan2(y - ey, x - ex); octx.save(); octx.rotate(ang); octx.fillStyle = '#ffd23f'; octx.strokeStyle = '#1a1020'; octx.lineWidth = 3;
    octx.beginPath(); octx.moveTo(u * 1.7, 0); octx.lineTo(u * 1.05, -u * 0.5); octx.lineTo(u * 1.05, u * 0.5); octx.closePath(); octx.fill(); octx.stroke(); octx.restore();
    octx.fillStyle = 'rgba(30,20,50,0.85)'; octx.beginPath(); octx.arc(0, 0, u * 0.95, 0, 7); octx.fill(); octx.strokeStyle = '#ffd23f'; octx.lineWidth = 3; octx.stroke();
    octx.imageSmoothingEnabled = false; var gs2 = u * 1.2 / gi.cv.height * 1.2; octx.drawImage(gi.cv, -gi.cv.width * gs2 / 2, -gi.cv.height * gs2 / 2, gi.cv.width * gs2, gi.cv.height * gs2);
    octx.restore();
  }
  function guestIcon(kind) { var s = DTWSprites.creature(kind, 0); if (!s) return null; var c = document.createElement('canvas'); c.width = s.cv.width; c.height = s.cv.height; c.getContext('2d').drawImage(s.cv, 0, 0); return c; }

  // ---- plain 2D: a multiply tint for the phase and weather, a vignette, and the lights as additive halos ----
  function finish2D(surfaceView) {
    var L = life.L, h = surfaceView ? vh : Math.max(0, P(0, 1, 0)[1] + N * hh);
    if (h <= 0) { hal.length = 0; return; }
    var mul = L.mul.slice(), wk = life.wk, wi = life.wi;
    if (wk === 'rain' || wk === 'glowrain') mul = mixRgb(mul, [mul[0] * 0.82, mul[1] * 0.86, mul[2] * 0.95], wi);
    else if (wk === 'storm') mul = mixRgb(mul, [mul[0] * 0.6, mul[1] * 0.63, mul[2] * 0.72], wi);
    else if (wk === 'fog') mul = mixRgb(mul, [Math.min(255, mul[0] * 1.0), mul[1] * 0.95, mul[2] * 0.88], wi);
    var fl = flashAmt(); if (fl > 0) mul = mixRgb(mul, [255, 255, 255], Math.min(1, fl));
    ctx.save();
    if (mul[0] < 254 || mul[1] < 254 || mul[2] < 254) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rgbCss(mul); ctx.fillRect(0, 0, vw, h); }
    if (surfaceView) {
      var va = 0.16 + 0.4 * L.nite * 0.6, vg = ctx.createRadialGradient(vw / 2, vh * 0.5, Math.min(vw, vh) * 0.35, vw / 2, vh * 0.5, Math.max(vw, vh) * 0.75);
      ctx.globalCompositeOperation = 'source-over'; vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,4,' + va + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < hal.length; i++) {
      var q = hal[i], gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
      gr.addColorStop(0, rgbCss(q.c, q.a)); gr.addColorStop(1, rgbCss(q.c, 0)); ctx.fillStyle = gr; ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
    }
    ctx.restore(); hal.length = 0;
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
    time += dt; quizCheerT = Math.max(0, quizCheerT - dt); shakeT = Math.max(0, shakeT - dt); burstT = Math.max(0, burstT - dt);
    celebUpdate(dt);
    stepPeople(dt, S);
    lifeUpdate(dt, S); critUpdate(dt, S); guestUpdate(dt, S);
    var r = S.run, tg = targets(S);
    partyOn = S.mode === 'dig' && !!(r && r.party);
    if (partyOn && (confT -= dt) <= 0) { // confetti bursts over the miner and the helpers
      confT = 0.09;
      var who = [r].concat(r.crew || []), pw = who[Math.floor(Math.random() * who.length)];
      for (var ci = 0; ci < 3; ci++) parts.push({ x: pw.x + 0.5 + (Math.random() - 0.5) * 0.6, y: pw.y - 0.3, z: pw.z + 0.5 + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 2.5, vy: -2.5 - Math.random() * 2.5, vz: (Math.random() - 0.5) * 2.5, life: 0.9 + Math.random() * 0.5, c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)], s: 0.05 + Math.random() * 0.04 });
    }
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
    // walk cycle: counted in cells walked so the steps match the ground covered
    var spd = dt > 0 ? moved / dt : 0;
    disp.spd += (spd - disp.spd) * Math.min(1, dt * 10);
    disp.walk += moved * CYC_PER_CELL;
    // falling, and a squash on landing
    var air = S.mode !== 'up' && S.mode !== 'down' && (tg[1] - disp.y > 0.25 || (r && r.state === 'fall'));
    if (disp.air > 0.5 && !air) disp.land = 1;
    disp.air += ((air ? 1 : 0) - disp.air) * Math.min(1, dt * 14);
    disp.land = Math.max(0, disp.land - dt * 5);
    disp.blink -= dt; if (disp.blink < -0.12) disp.blink = 2 + Math.random() * 3;
    // pickaxe swing speed follows the dig rate, and taps kick it faster; a strike jolts the body
    disp.boost = Math.max(0, disp.boost - dt * 3);
    var f0 = disp.phase % 1;
    var twin = (S.upgrades.twin | 0) > 0, splash = (S.upgrades.splash | 0) > 0;
    disp.phase += dt * Math.min(3.2, 0.9 + 0.22 * D.hitRate(S)) * (1 + disp.boost * 2.5) * (twin ? 0.6 : 1); // twin picks strike twice a cycle
    var f1 = disp.phase % 1, digNow = S.mode === 'dig' && r && r.state === 'dig' && r.stun <= 0;
    var crossed = function (m) { return f0 < m && (f1 >= m || f1 < f0); };
    if (digNow && (crossed(0.72) || (twin && crossed(0.22)))) {
      disp.hit = 1;
      if (splash && r.target >= 0) { // Splash Pick: a ring of chips over the four blocks beside the target
        var ti = r.target, tx = ti % N, tz = Math.floor(ti / N) % N, ty = Math.floor(ti / (N * N));
        shocks.push({ x: tx, y: ty, z: tz, age: 0 });
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(function (d) {
          var nx = tx + d[0], nz = tz + d[1];
          if (nx >= 0 && nx < N && nz >= 0 && nz < N && Math.random() < 0.35) spawnBreak(nx, ty, nz, '#ffd23f88', 1);
        });
      }
    }
    for (var si = shocks.length - 1; si >= 0; si--) { shocks[si].age += dt; if (shocks[si].age > 0.45) shocks.splice(si, 1); }
    disp.hit = Math.max(0, disp.hit - dt * 6);
    // camera: follows the miner down; horizontally it follows halfway so the whole pit stays on screen
    var surf = S.mode === 'surface';
    var fx = 3.5 + (disp.x + 0.5 - 3.5) * 0.5, fz = 3.5 + (disp.z + 0.5 - 3.5) * 0.5, fy = disp.y + 1;
    var zoom = surf ? (view.sheet ? 1.15 : 1.05) : 1, anchor = surf ? (view.sheet && view.open ? 0.2 : 0.5) : 0.3;
    if (surf) { fx = disp.x + 0.5; fz = disp.z + 0.5; fy = 1; } // on the plaza the camera follows the miner
    if (surf && fin && fin.t < fin.dur) { fx = STAR.x0 + 1; fz = STAR.z0 + 1; } // the finale: look at where the Star Tree grows
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
    for (var f = floaters.length - 1; f >= 0; f--) { var fl = floaters[f]; fl.life -= dt; fl.y -= dt * 0.8; if (fl.life <= 0) floaters.splice(f, 1); }
    updateFinds(dt, S);
    for (var ri = roomFx.length - 1; ri >= 0; ri--) { roomFx[ri].age += dt; if (roomFx[ri].age > 1.6 || S.mode === 'surface') roomFx.splice(ri, 1); }
    updateFinale(dt);
  }

  // ---------- the scene ----------
  function draw(S) {
    var w = S.world, g = D.site(S, w), r = S.run, id = D.WORLDS[w].id, Pl = D.WORLDS[w].pal;
    golden = !!S.golden;
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
    nightFx = !post && surfaceView && life.L.nite > 0.05; hal.length = 0; lanternPrep(surfaceView);
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
          var top = y === 1 && (tt === T.DIRT || !pit) ? groundTex(hc, x, z) : tt === T.CHEST ? (g.v[i] === 1 ? 'chestTopR' : 'chestTop') : side;
          spr = cube(w, top, side.indexOf('grass') === 0 ? 'dirt0' : side);
          if (pit && tt === T.FOSSIL) { var fo = D.fossilAt(g, i); if (fo.w * fo.d > 1) spr = bigFossil(w, y, fo); }
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
        if (surfaceView) { handInFloor(S); drawRipples(S); }
        if (P(xlo, 0, zlo)[1] < vh && P(xhi, 1, zhi)[1] > -TW * 3) hubProps(S, items, surfaceView);
        if (surfaceView) { hubPeople(S, items); critItems(S, items); guestItems(S, items); lanternItems(S, items); }
        if (viewTop === 0 && !minerDrawn) items.push(feet(disp.x + 0.5, disp.z + 0.5, drawMinerNow));
        depthSort(items).forEach(function (it) { it.fn(); });
        if (surfaceView) { shafts(id); nearLeaves(id); }
      }
    }
    var split = minerLayer >= 1 && minerLayer <= yBot;
    for (var y = yBot; y >= 1; y--) layer(y, xlo + zlo, sEnd, !(split && y === minerLayer), split && y === minerLayer ? 'back' : null);
    if (split) { drawMinerNow(); drawCrew(-Infinity, sMid); layer(minerLayer, sMid + 1, sEnd, true, 'front'); }
    else drawCrew(-Infinity, Infinity);
    drawMinerNow();
    // finds, particles and floating text on top
    if (r) drawReach(r, S);
    if (r && r.loot) drawLoot(r, S);
    drawFinds();
    drawRoomFx();
    for (var sk = 0; sk < shocks.length; sk++) { // the Splash Pick's shock ring: a diamond spreading over the neighbouring blocks
      var sh = shocks[sk], sa = sh.age / 0.45, sq = P(sh.x + 0.5, sh.y + 0.5, sh.z + 0.5), sr = (0.5 + 2.1 * sa) * hw * 1.4;
      ctx.strokeStyle = 'rgba(255,214,90,' + (0.32 * (1 - sa)) + ')'; ctx.lineWidth = Math.max(1, TW / 30);
      ctx.beginPath(); ctx.moveTo(sq[0], sq[1] - sr * 0.5); ctx.lineTo(sq[0] + sr, sq[1]); ctx.lineTo(sq[0], sq[1] + sr * 0.5); ctx.lineTo(sq[0] - sr, sq[1]); ctx.closePath(); ctx.stroke();
      glow(sq[0], sq[1], TW * (0.5 + 1.2 * sa), '#ff9a3a', 0.2 * (1 - sa));
    }
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
      var bx = lampAt ? lampAt[0] : lx + dirx * TW * 0.25, by = lampAt ? lampAt[1] : ly - TW * 0.15;
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
    drawWeather(S, surfaceView); drawFireflies(S, surfaceView);
    if (!post) finish2D(surfaceView);
    if (surfaceView) { hubLabels(S); handInTop(S); quizMark(S); guestMark(S); celebTop(); if (S.mode === 'surface') drawFinale(); }
    for (var fi = 0; fi < floaters.length; fi++) { // short notes (O2 full, hearts) on the overlay
      var fl = floaters[fi], fq = P(fl.x, fl.y, fl.z), fs = Math.max(16, Math.round(TW * 0.4));
      octx.globalAlpha = Math.min(1, fl.life * 2);
      octx.font = '700 ' + fs + 'px Fredoka, sans-serif'; octx.textAlign = 'center'; octx.lineJoin = 'round';
      octx.lineWidth = Math.max(4, fs * 0.22); octx.strokeStyle = '#000'; octx.strokeText(fl.text, fq[0], fq[1]);
      octx.fillStyle = fl.c; octx.fillText(fl.text, fq[0], fq[1]); octx.globalAlpha = 1;
    }
    var fa = flashAmt(); if (fa > 0) { octx.fillStyle = 'rgba(255,255,255,' + (0.6 * fa) + ')'; octx.fillRect(0, 0, vw, vh); }
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
    D.WINGS.forEach(function (wg) { // each wing's name hangs over the arch into it
      var wq = P(wg.sign[0], -1.1, wg.sign[1]);
      tagText(wq[0], wq[1], wg.icon + ' ' + wg.name, sz * 0.95, '#ffe9a8', 'rgba(90,58,36,0.85)');
    });
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
  var GRADE = { // ambient tint, shadow tint, highlight tint per world; sun: how golden the plaza is, dapple: leaf shade on it
    forest: { amb: [1.0, 0.97, 0.9], sh: [0.9, 0.95, 1.1], hi: [1.06, 1.01, 0.9], sun: 1, dapple: 1 },
    ocean: { lamp: 0.6, amb: [0.72, 0.86, 1.0], sh: [0.85, 0.97, 1.12], hi: [0.98, 1.04, 1.04], sun: 0.45, dapple: 0.5 },
    jungle: { amb: [1.06, 0.98, 0.84], sh: [0.92, 0.96, 1.0], hi: [1.1, 1.0, 0.84], sun: 1, dapple: 1.1 },
    moon: { lamp: 0.75, amb: [0.72, 0.76, 0.92], sh: [0.88, 0.92, 1.15], hi: [1.02, 1.01, 1.0], sun: 0, dapple: 0 },
    alien: { amb: [0.92, 1.0, 0.94], sh: [1.0, 0.88, 1.12], hi: [0.98, 1.06, 0.96], sun: 0.4, dapple: 0.6 }
  };
  function lamp(S, viewTop) {
    var lx = lastMiner[0], ly = lastMiner[1] - TW * 0.45, G = GRADE[D.WORLDS[S.world].id] || {};
    var depthF = Math.min(1, viewTop / 30) * (G.lamp || 1); // pale ground (sand, moon dust) needs less lamp
    if (S.mode === 'surface' || depthF <= 0) return;
    var fd = FACE[disp.face] || FACE.e, dirx = fd.flip ? -1 : 1, diry = fd.back ? -0.5 : 0.5;
    light(lx, ly, TW * 4.2, 0.7 * depthF, [1.0, 0.88, 0.7]);                                  // the headlamp's pool
    var c = P(N / 2, viewTop + 1, N / 2);
    light(c[0], c[1], TW * 6.5, 0.28 * depthF, [0.78, 0.82, 1.0]);                                 // cool fill over the layer
    var hx = lampAt ? lampAt[0] : lx + dirx * TW * 0.25, hy = lampAt ? lampAt[1] : ly - TW * 0.15; // the lamp on the helmet
    light(hx + dirx * TW * 0.9, hy + diry * TW * 0.9 + TW * 0.3, TW * 2.2, 0.35 * depthF, [1.0, 0.95, 0.8]); // the beam
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
    // time of day and weather: full on the plaza, a little on the shallow pit (its sky and rim), none deep down
    var Lk = life.L, wg = life.wg, kS = surfaceView ? 1 : Math.max(0, 1 - depthF) * 0.4, fl = flashAmt();
    for (var ci = 0; ci < 3; ci++) amb[ci] = Math.max(amb[ci] * (1 + (Lk.amb[ci] * wg.amb[ci] - 1) * kS), Lk.floor[ci] * kS) + fl * 0.9;
    var sun = surfaceView ? (G.sun || 0) * Lk.sun * wg.sun : 0, sh = [G.sh[0] * (1 + (Lk.sh[0] - 1) * kS), G.sh[1] * (1 + (Lk.sh[1] - 1) * kS), G.sh[2] * (1 + (Lk.sh[2] - 1) * kS)], hi = [G.hi[0] * (1 + (Lk.hi[0] - 1) * kS), G.hi[1] * (1 + (Lk.hi[1] - 1) * kS), G.hi[2] * (1 + (Lk.hi[2] - 1) * kS)];
    if (sun > 0) { // the plaza at golden hour: a dimmer, warmer ambient and a pool of sun around the miner
      var ka = 1 - 0.3 * sun;
      amb = [amb[0] * ka, amb[1] * ka * 0.97, amb[2] * ka * 0.9];
      sh = [sh[0] * (1 - 0.06 * sun), sh[1] * (1 - 0.09 * sun), sh[2] * (1 - 0.14 * sun)];
      hi = [hi[0] * (1 + 0.04 * sun), hi[1], hi[2] * (1 - 0.06 * sun)];
      if (lastMiner) light(lastMiner[0], lastMiner[1] - TW * 0.6, TW * 8, 0.42 * sun, [1.0, 0.84, 0.58]);
    }
    if (surfaceView && lastMiner && Lk.nite > 0.03) { // dusk and night: a warm pool round the miner and a cool fill over the plaza
      light(lastMiner[0], lastMiner[1] - TW * 0.5, TW * 3.0, 0.16 * Lk.nite * life.lampK, [1.0, 0.72, 0.4]);
      light(lastMiner[0], lastMiner[1] - TW, TW * 11, 0.12 * Lk.nite, [0.5, 0.6, 0.95]);
    }
    var focus;
    if (S.mode === 'dig') { // keep the whole working layer and the miner sharp
      var top = P(0, viewTop, 0)[1] - TW * 1.1, bot = P(N, viewTop + 1, N)[1] + TW * 0.2;
      focus = [top, bot, TW * 2.8, 1];
    } else if (surfaceView && lastMiner) {
      focus = [lastMiner[1] - TW * 3, lastMiner[1] + TW * 1.6, TW * 3.2, 1];
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
      bloom: 0.9, thr: surfaceView ? 0.86 : 9, sat: (surfaceView ? 1.1 - 0.16 * sun : 1.14) * (1 + (Lk.sat * wg.sat - 1) * kS), vig: (surfaceView ? 0.3 + 0.4 * sun : 0.42) + (Lk.vig + wg.vig) * kS,
      caustic: id === 'ocean' ? 0.22 : 0, dapple: surfaceView ? (G.dapple || 0) * Lk.dap * wg.dap : 0, shadowTint: sh, hiTint: hi
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
    var sk = life.L.sun * life.wg.sun; if (id === 'moon' || sk < 0.03) return;
    var col = id === 'ocean' ? '#bff7ff' : id === 'alien' ? '#c8ffb0' : '#fff3c0';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 5; k++) {
      var x0 = vw * (0.08 + k * 0.21) + Math.sin(time * 0.3 + k * 1.7) * TW * 0.6, wd = TW * (0.7 + (k % 3) * 0.45);
      var g = ctx.createLinearGradient(0, 0, 0, vh); g.addColorStop(0, rgba(col, 0.11 * sk)); g.addColorStop(1, rgba(col, 0));
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
      if (i % 3 === 0) glow(x, y, TW * (viewTop <= 1 && i % 2 ? 0.22 : 0.12), col, a * (viewTop <= 1 ? 0.8 : 0.6));
    }
  }
  var lastMiner = null, lampAt = null;
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
      if (tt === T.ORE) { var oc = D.WORLDS[w].ores[g.v[i]].color, k = 0.25 + 0.14 * g.v[i]; glow(cq[0], cq[1], TW * (0.4 + 0.06 * g.v[i]), oc, k * (0.8 + 0.2 * Math.sin(time * 2 + x + z))); if (g.v[i] >= 3) light(cq[0], cq[1], TW * 1.5, 0.35, oc); }
      else if (tt === T.GOO) { glow(cq[0], cq[1], TW * 0.45, '#5dff7a', 0.16); light(cq[0], cq[1], TW * 1.3, 0.12, '#5dff7a'); }
      else if (tt === T.RELIC) { // the whole bottom layer is relic blocks: keep each one's glow faint so loot on the floor still shows
        glow(cq[0], cq[1], TW * 0.45, D.WORLDS[w].relic.color, 0.14 + 0.06 * Math.sin(time * 2 + x + z));
        if ((x + z) % 3 === 0) light(cq[0], cq[1], TW * 1.8, 0.18, D.WORLDS[w].relic.color);
      }
      else if (tt === T.FOSSIL) glow(cq[0], cq[1], TW * 0.35, golden ? '#ffd23f' : '#ffe9a8', golden ? 0.5 : 0.3);
      else if (tt === T.TRAP) glow(cq[0], cq[1], TW * 0.45, '#ff5a2a', 0.14 + 0.08 * Math.sin(time * 4 + x + z));
      else if (tt === T.CHEST) { // chests shine gold and twinkle
        var tw = 0.5 + 0.5 * Math.sin(time * 3 + x * 2 + z), rm = g.v[i] === 1; glow(cq[0], cq[1], TW * (rm ? 1.15 : 0.85), '#ffd23f', (rm ? 0.5 : 0.35) + 0.25 * tw); light(cq[0], cq[1], TW * 2.2, rm ? 0.5 : 0.35, '#ffd23f');
        if (tw > (rm ? 0.45 : 0.7)) cross(cq[0] + Math.sin(time * 1.3 + z) * hw * 0.5, cq[1] - hh * 0.7, Math.max(1, TW * 0.035), '#fff8d0', (tw - 0.7) * 3);
      }
    }
    if (tt === T.TRAP) { ctx.globalAlpha = 0.07 + 0.05 * Math.sin(time * 4 + x + z); ctx.fillStyle = '#ff5a2a'; hexPath(ctx, q[0] - hw, q[1]); ctx.fill(); ctx.globalAlpha = 1; }
    if (tt === T.RELIC && !S.relics[w]) { ctx.globalAlpha = 0.06 + 0.05 * Math.sin(time * 3); ctx.fillStyle = '#ffd23f'; hexPath(ctx, q[0] - hw, q[1]); ctx.fill(); ctx.globalAlpha = 1; }
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

  // ---------- treasure room chests: the lid flies open in a burst of golden light, sparkles and coins ----------
  var roomFx = [];
  function roomChest(x, y, z) { roomFx.push({ x: x, y: y, z: z, age: 0, seed: (x * 7 + z * 13 + y) | 0 }); if (roomFx.length > 6) roomFx.shift(); }
  function drawRoomFx() {
    for (var i = 0; i < roomFx.length; i++) {
      var f = roomFx[i], t = f.age, u = t / 1.6, q = P(f.x + 0.5, f.y + 0.5, f.z + 0.5), cp = chestParts(), s = findScale() * 1.5;
      var cw = cp.body.width * s, bw = Math.round(cw), bh2 = Math.round(cp.body.height * s), lh = Math.round(cp.lid.height * s);
      var ba = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.4), fl = Math.max(0, 1 - Math.abs(t - 0.25) / 0.25);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      if (ba > 0) { ctx.globalAlpha = ba; ctx.drawImage(cp.body, Math.round(q[0] - cw / 2), Math.round(q[1] - bh2 * 0.3), bw, bh2); }
      var lt = Math.max(0, t - 0.12), ly = q[1] - bh2 * 0.3 - lt * TW * 2.6 + lt * lt * TW * 1.6; // the lid pops up, spinning
      var la = t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.4);
      if (la > 0) { ctx.globalAlpha = la; ctx.translate(q[0], ly); ctx.rotate(-lt * 5 * (f.seed % 2 ? 1 : -1)); ctx.drawImage(cp.lid, -bw / 2, -lh, bw, lh); }
      ctx.restore();
      // the light: a bright flash, then a column of rays turning slowly
      var ga = Math.max(0, 1 - u * 1.1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var fg = ctx.createRadialGradient(q[0], q[1] - TW * 0.2, 0, q[0], q[1] - TW * 0.2, TW * (0.4 + 2.2 * Math.sqrt(u)));
      fg.addColorStop(0, 'rgba(255,240,170,' + (0.4 * ga) + ')'); fg.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = fg;
      ctx.fillRect(q[0] - TW * 3, q[1] - TW * 3, TW * 6, TW * 6);
      ctx.fillStyle = 'rgba(255,236,150,' + (0.35 * ga) + ')';
      for (var k = 0; k < 8; k++) { var a = k * 0.785 + t * 1.2, r0 = TW * (0.5 + 1.6 * u); ctx.beginPath(); ctx.moveTo(q[0], q[1] - TW * 0.2); ctx.lineTo(q[0] + Math.cos(a - 0.1) * r0, q[1] - TW * 0.2 + Math.sin(a - 0.1) * r0 * 0.6); ctx.lineTo(q[0] + Math.cos(a + 0.1) * r0, q[1] - TW * 0.2 + Math.sin(a + 0.1) * r0 * 0.6); ctx.fill(); }
      ctx.restore();
      glow(q[0], q[1] - TW * 0.2, TW * (0.8 + 2.4 * Math.sqrt(u)), '#ffd23f', 0.5 * ga + 0.25 * fl); light(q[0], q[1], TW * 3.2, 0.5 * ga, '#ffd96a');
      // sparkles burst out, coins arc up and fall back
      for (var j = 0; j < 14; j++) { var aa = j * 2.4 + f.seed, rd = TW * (0.25 + 1.5 * Math.sqrt(u)) * (0.6 + 0.4 * ((j * 37) % 10) / 10); cross(q[0] + Math.cos(aa) * rd, q[1] - TW * 0.2 + Math.sin(aa) * rd * 0.55 - u * TW * 0.5, Math.max(1.5, TW * 0.04) * (1 - u * 0.6), j % 3 ? '#fff8d0' : '#ffd23f', Math.max(0, 1 - u * 1.2)); }
      var cc = coinCanvas();
      for (var m = 0; m < 9; m++) {
        var ang = m * 0.7 + f.seed, vx = Math.cos(ang) * TW * 0.9, vy = -TW * (2.2 + 0.5 * ((m * 5) % 3)), tt2 = Math.max(0, t - 0.12), cxx = q[0] + vx * tt2, cyy = q[1] - TW * 0.2 + vy * tt2 + TW * 4 * tt2 * tt2;
        if (tt2 > 0) drawSprite(cc, cxx, cyy, TW / 44, Math.max(0, 1 - Math.max(0, t - 1.0) / 0.5));
      }
    }
  }

  // ---------- the finale: fireworks, cheering, and the Star Seed planted and growing into the Star Tree ----------
  var fin = null, FW_COLS = ['#ff5a7a', '#ffd23f', '#5dd8ff', '#9dff8a', '#c58bff', '#ffffff', '#ff9a3a'];
  function finale() { if (fin) return; fin = { t: 0, dur: 7.5, next: 0.3, rockets: [], sparks: [], cheer: 0, banner: true }; }
  function updateFinale(dt) {
    if (!fin) return;
    fin.t += dt;
    while (fin.t >= fin.next && fin.next < fin.dur - 0.9) {
      fin.rockets.push({ x: 0.12 + Math.random() * 0.76, y0: 0.62, y1: 0.08 + Math.random() * 0.32, t: 0, col: FW_COLS[Math.floor(Math.random() * FW_COLS.length)] });
      fin.next += 0.3 + Math.random() * 0.35;
    }
    for (var i = fin.rockets.length - 1; i >= 0; i--) {
      var rk = fin.rockets[i]; rk.t += dt / 0.6;
      if (rk.t >= 1) { // burst
        var n = 36, c2 = FW_COLS[Math.floor(Math.random() * FW_COLS.length)];
        for (var j = 0; j < n; j++) { var a = j / n * 6.2832 + Math.random() * 0.2, sp = 1.4 + Math.random() * 1.6; fin.sparks.push({ x: rk.x, y: rk.y1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1 + Math.random() * 0.5, max: 1.5, col: j % 4 ? rk.col : c2 }); }
        fin.flash = fin.flash || []; fin.flash.push({ x: rk.x, y: rk.y1, col: rk.col, life: 0.35 });
        fin.rockets.splice(i, 1);
      }
    }
    var uw = Math.max(1, vw - view.right * vw / cssW);
    for (var k = fin.sparks.length - 1; k >= 0; k--) {
      var sk = fin.sparks[k]; sk.life -= dt; if (sk.life <= 0) { fin.sparks.splice(k, 1); continue; }
      sk.vy += 2.2 * dt; sk.vx *= 1 - 0.8 * dt; sk.vy *= 1 - 0.5 * dt;
      sk.x += sk.vx * dt * TW / uw; sk.y += sk.vy * dt * TW / vh;
    }
    if (fin.flash) for (var m = fin.flash.length - 1; m >= 0; m--) { fin.flash[m].life -= dt; if (fin.flash[m].life <= 0) fin.flash.splice(m, 1); }
    if (fin.t > fin.dur && !fin.sparks.length && !fin.rockets.length) fin = null;
  }
  function drawFinale() {
    if (!fin) return;
    var uw = Math.max(1, vw - view.right * vw / cssW), sz = Math.max(3, Math.round(TW * 0.08));
    fin.rockets.forEach(function (rk) {
      var e = 1 - Math.pow(1 - rk.t, 2), x = rk.x * uw, y = (rk.y0 + (rk.y1 - rk.y0) * e) * vh;
      octx.fillStyle = '#fff3b0'; octx.fillRect(x - sz / 2, y, sz, sz * 2); octx.fillStyle = rgba('#ffd23f', 0.5); octx.fillRect(x - sz / 2, y + sz * 2, sz, sz * 3);
      glow(x, y, TW * 0.4, '#ffd23f', 0.7);
    });
    fin.sparks.forEach(function (sk, i) {
      var a = Math.min(1, sk.life / 0.6), x = sk.x * uw, y = sk.y * vh;
      octx.globalAlpha = a; octx.fillStyle = sk.col; octx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      octx.globalAlpha = a * 0.45; octx.fillRect(x - sz / 2 - sk.vx * TW * 0.05, y - sz / 2 - sk.vy * TW * 0.05, sz, sz); octx.globalAlpha = 1; // a short trail
      glow(x, y, TW * 0.4, sk.col, 0.75 * a);
    });
    (fin.flash || []).forEach(function (f) { var a = f.life / 0.35; glow(f.x * uw, f.y * vh, TW * 2.6 * (1.2 - a * 0.4), f.col, 0.55 * a); light(f.x * uw, f.y * vh + TW, TW * 6, 0.45 * a, f.col); });
    if (fin.t > 0.2 && fin.t < fin.dur) { // a banner a young child can read
      var ba = Math.min(1, (fin.t - 0.2) / 0.4, (fin.dur - fin.t) / 0.6);
      octx.globalAlpha = ba; tagText(uw / 2, vh * 0.17 + Math.sin(time * 3) * TW * 0.04, '🌟 You did it! The Star Tree grows! 🌟', Math.max(14, TW * 0.4), '#ffe9a8', 'rgba(26,19,40,0.72)'); octx.globalAlpha = 1;
    }
  }
  // 0 to 1: how grown the Star Tree is. Fully grown unless the finale is playing.
  function treeGrow() { if (!fin) return 1; var k = Math.max(0, Math.min(1, (fin.t - 2.6) / 3.6)); return k * k * (3 - 2 * k); }
  // the Star Tree stands on a 2×2 plot of plaza grass once the fifth relic is home; during the finale the seed drops, is planted and grows
  var STAR = { x0: -3, z0: 5 }; // HUB cells (-3, 5) to (-2, 6): grass just below-left of the dig pad, in view from the default plaza camera
  function starTree() {
    var cx = STAR.x0 + 1, cz = STAR.z0 + 1, g = treeGrow(), t = fin ? fin.t : 99, i;
    blob(cx, cz, 0.4 + 0.9 * g, 0.25);
    if (fin && t < 2.7) { // the Star Seed falls from the sky and sinks into the ground with a ring of light
      var k = Math.max(0, Math.min(1, (t - 0.6) / 1.3)), e = k * k, sy2 = 1 - (1 - e) * 7 - 0.25, sq = P(cx, sy2, cz), sc = t > 2.0 ? Math.max(0, 1 - (t - 2.0) / 0.6) : 1;
      if (t > 0.6 && sc > 0) { sparkle(sq[0], sq[1], TW * 0.2 * sc, 1, '#fff3b0'); glow(sq[0], sq[1], TW * 1.2 * sc, '#ffd23f', 0.8); light(sq[0], sq[1], TW * 3, 0.5 * sc, '#ffd96a'); }
      if (t > 1.9) { var rp = (t - 1.9) / 0.8, rq = P(cx, 1, cz); ctx.strokeStyle = rgba('#8afff0', Math.max(0, 1 - rp)); ctx.lineWidth = Math.max(2, TW / 14); ctx.beginPath(); ctx.ellipse(rq[0], rq[1], hw * (0.4 + 2 * rp), hh * (0.4 + 2 * rp), 0, 0, 7); ctx.stroke(); glow(rq[0], rq[1], TW * 1.6 * Math.max(0, 1 - rp), '#8afff0', 0.6); }
    }
    if (g <= 0) return;
    box(cx - 0.4, cz - 0.4, 0.8, 0.8, 1, 0.3 * g, '#a79a78');
    box(cx - 0.3, cz - 0.3, 0.6, 0.6, 1, 2.0 * g, '#cdbf9a');
    [[2.6, 0.65, 1.2, '#1f9e9a'], [2.05, 0.6, 1.75, '#33c9b5'], [1.5, 0.55, 2.3, '#66e8cf'], [0.9, 0.5, 2.8, '#b4fff0']].forEach(function (tr) {
      var s = tr[0] * g; box(cx - s / 2, cz - s / 2, s, s, 1 - tr[2] * g, tr[1] * g, tr[3]);
    });
    var cq = P(cx, 1 - 2.2 * g, cz), pu = 0.5 + 0.5 * Math.sin(time * 1.8);
    glow(cq[0], cq[1], TW * 2.2 * g, '#7dfff0', 0.32 + 0.12 * pu); light(cq[0], cq[1], TW * 5 * g, 0.5, '#7dfff0');
    var top = P(cx, 1 - 3.6 * g, cz); sparkle(top[0], top[1], TW * 0.34 * g, 1, '#fff3b0'); glow(top[0], top[1], TW * 1.0 * g, '#ffd23f', 0.8); light(top[0], top[1], TW * 3 * g, 0.4, '#ffd96a');
    for (i = 0; i < 10; i++) { // little stars hung over the canopy, twinkling
      var an = i * 2.4 + 0.5, ty = [1.5, 2.1, 2.6][i % 3], rr = (1.35 - (ty - 1.2) * 0.5) * g + 0.1, oq = P(cx + Math.cos(an) * rr, 1 - ty * g, cz + Math.sin(an) * rr), tw = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.9);
      cross(oq[0], oq[1], Math.max(1.5, TW * 0.045) * (0.7 + 0.5 * tw), i % 2 ? '#fff3b0' : '#ffffff', 0.6 + 0.4 * tw); glow(oq[0], oq[1], TW * 0.3, '#ffe27a', 0.5 * tw);
    }
    for (i = 0; i < 5; i++) { // star dust drifting down
      var ph = (time * 0.35 + i * 0.2) % 1, dq = P(cx + Math.cos(i * 2.7) * 1.1 * g, 1 - 3 * g + ph * 2.6 * g, cz + Math.sin(i * 2.7) * 1.1 * g);
      cross(dq[0], dq[1], Math.max(1, TW * 0.03), '#d8fff8', Math.sin(ph * Math.PI) * 0.9);
    }
  }

  // ---------- effects API ----------
  function spawnBreak(x, y, z, color, n) {
    for (var i = 0; i < n; i++) parts.push({ x: x + 0.5, y: y + 0.4, z: z + 0.5, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 4, vz: (Math.random() - 0.5) * 3, life: 0.5 + Math.random() * 0.4, c: color, s: 0.05 + Math.random() * 0.05 });
  }
  // short floating text over a spot (finds use spawnFind instead)
  function floatText(x, y, z, text, color) { floaters.push({ x: x, y: y, z: z, text: text, c: color || '#fff', life: 1.3 }); }
  function itemIcon(it) { return DTWSprites.item(it.kind, it.idx || 0, itemColor(it), D.WORLDS[it.world].id === 'moon', !!it.gold); }
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
    celebrate: celebrate, quizCheer: function () { quizCheerT = 1.6; }, roomChest: roomChest, finale: finale, finaleTime: function () { return fin ? fin.t : -1; },
    flash: flash, guestIcon: guestIcon,
    spawnBreak: spawnBreak, floatText: floatText, coinBurst: function () { burstT = 0.8; }, spawnFind: spawnFind, shake: function (t) { shakeT = Math.max(shakeT, t); },
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
