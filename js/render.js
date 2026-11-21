// Dig Through Worlds: isometric renderer. Exposes the global DTWRender.
// The N×N column is drawn as cubes on 2:1 diamond tiles, deepest layer first and back to front
// within a layer. Layers above the miner are cut away; the ground behind the pit rises as walls
// and the surface rim carries each world's scenery. All art is drawn in code.
var DTWRender = (function () {
  'use strict';
  var D = DTW, T = D.TILE, N = D.N;
  var RIM = 8, VIEW_LAYERS = 12;
  var LADDER_Z = 3; // the ladder hangs on the back-left pit wall (the x = 0 face), centred on this z
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
  var MW = 44, MH = 44, FX = 22, FY = 41; // sprite canvas size and the feet point
  var mcv = null, mctx = null;
  var PICK = [ // pickaxe head and handle colours by Drill Power tier
    { head: '#9a6a3a', hi: '#c08a52', handle: '#7a4f2a' },   // wood
    { head: '#8d8d96', hi: '#b8b8c2', handle: '#8a5a2b' },   // stone
    { head: '#cfd6de', hi: '#ffffff', handle: '#8a5a2b' },   // iron
    { head: '#ffcf3f', hi: '#fff3b0', handle: '#6b3f1d' },   // gold
    { head: '#6ff0ff', hi: '#e8ffff', handle: '#b45cff' }    // crystal
  ];
  function pickTier(drill) { return Math.min(4, Math.floor(drill / 6)); }
  function mp(x, y, col, w, h) { mctx.fillStyle = col; mctx.fillRect(x, y, w || 1, h || 1); }
  function mline(x0, y0, x1, y1, col) { // Bresenham, so the pick stays crisp at any angle
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 64; n++) { mp(x0, y0, col); if (x0 === x1 && y0 === y1) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function drawPick(sx, sy, ang, tier) {
    var C = PICK[tier], ca = Math.cos(ang), sa = Math.sin(ang);
    var hx = sx + ca * 4, hy = sy + sa * 4; // hand
    mline(sx, sy, hx, hy, '#e05a3a'); // sleeve / arm
    var ex = hx + ca * 9, ey = hy + sa * 9;
    mline(hx - ca, hy - sa, ex, ey, C.handle);
    var nx = -sa, ny = ca; // head runs across the handle end, pointed on the striking side
    mline(ex - nx * 4, ey - ny * 4, ex + nx * 5, ey + ny * 5, C.head);
    mline(ex - nx * 3 - ca, ey - ny * 3 - sa, ex + nx * 3 - ca, ey + ny * 3 - sa, C.head);
    mp(Math.round(ex + nx * 5 + ca), Math.round(ey + ny * 5 + sa), C.hi);
    mp(Math.round(ex - nx * 4 + ca), Math.round(ey - ny * 4 + sa), C.hi);
    mp(Math.round(hx), Math.round(hy), '#f2c59b', 2, 2); // fist
    if (tier === 4 && Math.sin(time * 8) > 0.6) mp(Math.round(ex), Math.round(ey) - 2, '#ffffff');
  }
  // Draw the miner facing screen-right; back = facing away from the camera. Mirrored for left.
  // pose: { bob (whole body, px), body (upper body drop, px), lean (upper body forward, px),
  //         stride (-1..1 walk cycle), air (0..1 arms up, legs apart), blink }
  function minerSprite(back, ang, tier, pose, lampOn, climb) {
    if (!mcv) { mcv = document.createElement('canvas'); mcv.width = MW; mcv.height = MH; mctx = mcv.getContext('2d'); }
    mctx.clearRect(0, 0, MW, MH);
    var X0 = FX - 8, Y0 = FY - 27 + pose.bob; // body box origin
    var skin = '#f2c59b', hat = '#ffc61a', hatD = '#d99a00', blue = '#3d7bd9', blueD = '#2a5aa8', red = '#e05a3a', boot = '#5a3a24', hair = '#6b3f1d';
    var behind = back; // pick arm is drawn behind the body when facing away
    if (climb != null) return climber(X0, Y0, climb, tier);
    // legs: the stride swings them apart and lifts the one moving forward; in the air they spread
    var st = pose.stride, sw = Math.round(st * 2), lift = Math.round(Math.abs(st) * 1.5), ap = Math.round(pose.air * 1.5);
    var l1x = X0 + 3 + sw - ap, l1y = st > 0 ? -lift : 0, l2x = X0 + 9 - sw + ap, l2y = st < 0 ? -lift : 0;
    var X = X0 + Math.round(pose.lean), Y = Y0 + Math.round(pose.body); // upper body
    if (behind) drawPick(X + 9, Y + 15, ang, tier);
    mp(l1x, Y0 + 24 + l1y, boot, 4, 3); mp(l2x, Y0 + 24 + l2y, boot, 4, 3);
    mp(l1x, Y + 19, blue, 4, Y0 - Y + 5 + l1y); mp(l2x, Y + 19, blue, 4, Y0 - Y + 5 + l2y); mp(X + 7, Y + 19, blueD, 2, 3);
    if (pose.air > 0.3) { // arms flung up while falling
      mp(X + 0, Y + 6, red, 2, 8); mp(X + 14, Y + 6, red, 2, 8); mp(X + 0, Y + 4, skin, 2, 2); mp(X + 14, Y + 4, skin, 2, 2);
    }
    // torso: red shirt, blue bib with straps
    mp(X + 2, Y + 13, red, 12, 7); mp(X + 4, Y + 15, blue, 8, 5); mp(X + 4, Y + 13, blueD, 1, 2); mp(X + 11, Y + 13, blueD, 1, 2);
    if (!back) { mp(X + 7, Y + 16, '#ffd23f', 2, 1); } // bib button
    mp(X + 2, Y + 19, blueD, 12, 1); // belt line
    // head
    mp(X + 2, Y + 5, skin, 12, 8); mp(X + 3, Y + 12, skin, 10, 1);
    if (back) { mp(X + 2, Y + 6, hair, 12, 6); mp(X + 3, Y + 12, hair, 10, 1); }
    else {
      mp(X + 2, Y + 6, hair, 3, 5); // hair at the back of the head
      if (pose.blink) mp(X + 10, Y + 9, '#2a1a10', 2, 1); // eye, shut
      else { mp(X + 10, Y + 8, '#2a1a10', 2, 2); mp(X + 10, Y + 8, '#ffffff'); } // eye
      mp(X + 12, Y + 10, '#f29b8b', 2, 1); // cheek
      mp(X + 9, Y + 11, '#a0523d', 3, 1); // smile
      mp(X + 13, Y + 8, '#e8b088', 1, 2); // nose
    }
    // hard hat: dome, brim and headlamp
    mp(X + 3, Y + 1, hat, 10, 1); mp(X + 2, Y + 2, hat, 12, 3); mp(X + 1, Y + 5, hatD, 15, 1);
    mp(X + 4, Y + 1, '#ffe27a', 4, 1); mp(X + 7, Y, hatD, 2, 2); // ridge
    if (!back) { mp(X + 13, Y + 2, '#555', 2, 3); mp(X + 14, Y + 2, lampOn ? '#fff6b0' : '#cfc58a', 2, 2); }
    else mp(X + 1, Y + 3, '#333', 14, 1); // lamp strap
    if (!behind) drawPick(X + 8, Y + 15, ang, tier);
    if (pose.air > 0.3) { mp(X + 0, Y + 6, red, 2, 8); mp(X + 0, Y + 4, skin, 2, 2); } // near arm over the pick
    return mcv;
  }
  // seen from behind, hands on the rungs; the pick hangs on the back. step alternates 0 / 1.
  function climber(X, Y, step, tier) {
    var skin = '#f2c59b', hat = '#ffc61a', hatD = '#d99a00', blue = '#3d7bd9', blueD = '#2a5aa8', red = '#e05a3a', boot = '#5a3a24', hair = '#6b3f1d';
    var a = step ? 0 : 2, b = step ? 2 : 0;
    mp(X + 3, Y + 22 - a, boot, 4, 3); mp(X + 9, Y + 22 - b, boot, 4, 3);
    mp(X + 3, Y + 19 - a, blue, 4, 4); mp(X + 9, Y + 19 - b, blue, 4, 4);
    mp(X + 2, Y + 13, red, 12, 7); mp(X + 4, Y + 13, blueD, 1, 7); mp(X + 11, Y + 13, blueD, 1, 7); mp(X + 2, Y + 19, blueD, 12, 1);
    mline(X + 13, Y + 18, X + 3, Y + 10, PICK[tier].handle); mp(X + 1, Y + 9, PICK[tier].head, 4, 2); // pick on the back
    mp(X + 0, Y + 6 + b, red, 2, 8 - b); mp(X + 14, Y + 6 + a, red, 2, 8 - a); // arms up
    mp(X + 0, Y + 5 + b, skin, 2, 2); mp(X + 14, Y + 5 + a, skin, 2, 2); // hands
    mp(X + 2, Y + 5, skin, 12, 8); mp(X + 2, Y + 6, hair, 12, 6); mp(X + 3, Y + 12, hair, 10, 1);
    mp(X + 3, Y + 1, hat, 10, 1); mp(X + 2, Y + 2, hat, 12, 3); mp(X + 1, Y + 5, hatD, 15, 1); mp(X + 7, Y, hatD, 2, 2); mp(X + 1, Y + 3, '#333', 14, 1);
    return mcv;
  }
  var FACE = { e: { back: false, flip: false }, s: { back: false, flip: true }, n: { back: true, flip: false }, w: { back: true, flip: true } };
  function swingAngle(phase, digging, side) {
    var rest = -1.0, raised = -2.3, strike = side ? 0.1 : 0.95;
    if (!digging) return rest + Math.sin(time * 2) * 0.05;
    var f = phase % 1;
    if (f < 0.55) return strike + (raised - strike) * (f / 0.55);                  // wind up
    if (f < 0.72) return raised + (strike - raised) * ((f - 0.55) / 0.17);         // strike
    return strike;                                                                 // follow through
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
    var spr = minerSprite(climbing ? true : fc.back, ang, pickTier(S.upgrades.drill), pose, S.mode !== 'surface',
      climbing ? (Math.floor(disp.y * 3) & 1) : null);
    if (climbing) fc = FACE.w;
    var p = Math.max(1, Math.round(TW / 30));
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
    ctx.drawImage(spr, -FX * p, -FY * p, MW * p, MH * p);
    ctx.restore();
    if (r && r.stun > 0) {
      octx.font = 'bold ' + Math.round(TW * 0.22) + 'px sans-serif'; octx.textAlign = 'center'; octx.fillStyle = '#ffeb3b';
      for (var i = 0; i < 3; i++) { var a = time * 6 + i * 2.1; octx.fillText('★', sx + Math.cos(a) * TW * 0.3, sy - 30 * p + Math.sin(a) * TW * 0.08); }
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
  function hut(x, z, wall, roofCol, sign) {
    blob(x + 1, z + 1, 2.1, 0.18);
    box(x, z, 2, 2, 1, 1.1, wall);
    box(x + 2, z + 0.7, 0.04, 0.6, 1, 0.7, '#5a3a24'); // door on the +x face
    roof(x - 0.15, z - 0.15, 2.3, 2.3, -0.1, 1.0, roofCol);
    ctx.fillStyle = '#333'; label(x + 2.02, 0.3, z + 1, sign, TW * 0.32);
  }
  function blob(x, z, rx, a) { var q = P(x, 1, z); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.beginPath(); ctx.ellipse(q[0] + hw * 0.25, q[1] + hh * 0.15, hw * rx, hh * rx, 0, 0, 7); ctx.fill(); }
  function tree(x, z, s, k) {
    blob(x + 0.5, z + 0.5, 0.95 * s, 0.22);
    box(x + 0.35, z + 0.35, 0.3, 0.3, 1, 0.9 * s, '#6b4226');
    box(x + 0.05, z + 0.05, 0.9, 0.9, 1 - 0.8 * s, 0.7 * s, k % 2 ? '#2e7d32' : '#388e3c');
    box(x + 0.2, z + 0.2, 0.6, 0.6, 1 - 1.5 * s, 0.45 * s, '#43a047');
  }
  var EXTRA = {};
  function extras(w) { // [x, z, scale] scattered on the outer rim, clear of the pit and the huts
    if (EXTRA[w]) return EXTRA[w];
    var r = prng(w * 31 + 5), out = [];
    for (var n = 0; n < 400 && out.length < 22; n++) {
      var x = Math.floor(-RIM + 1 + r() * (N + 2 * RIM - 3)), z = Math.floor(-RIM + 1 + r() * (N + 2 * RIM - 3));
      if (x >= -2 && x <= N + 1 && z >= -2 && z <= N + 1) continue;
      if (x >= -4 && x <= 0 && z >= 0 && z <= 3 || z >= -4 && z <= 0 && x >= 0 && x <= 3) continue;
      if (out.some(function (o) { return Math.abs(o[0] - x) < 2 && Math.abs(o[1] - z) < 2; })) continue;
      out.push([x, z, 0.85 + r() * 0.5]);
    }
    return (EXTRA[w] = out);
  }
  // items: {k, x, z, draw()} sorted with the miner by depth order. Below the surface only things on the
  // back rim stay: the rest of the surface is cut away with the layers above the miner.
  function scenery(w, items, all) {
    var id = D.WORLDS[w].id, ex = extras(w);
    var add = function (x, z, fn) { if (all || x < 0 || z < 0) items.push({ k: x + z, fn: fn }); };
    add(-3, 1, function () { hut(-3, 1, '#f5e6c8', '#c0392b', '$'); });
    add(1, -3, function () { hut(1, -3, '#efe4ff', '#6c5ce7', '🏛'); });
    if (id === 'forest') {
      [[-2, -2, 1], [-4, -1, 1.2], [-1, -4, 1.1], [4, -2, 0.9], [-2, 4, 1], [-4, 3, 1.3], [6, -4, 1.1], [-3, 6, 0.9]].concat(ex).forEach(function (t, i) {
        add(t[0], t[1], function () { tree(t[0], t[1], t[2], i); });
      });
    } else if (id === 'ocean') {
      [[-2, -2], [-1, -3], [4, -2], [-2, 4], [-4, -1], [6, -3]].concat(ex).forEach(function (t, i) {
        add(t[0], t[1], function () {
          for (var sg = 0; sg < 5; sg++) { var sw = Math.sin(time * 2 + sg * 0.6 + i) * 0.06 * sg; box(t[0] + 0.4 + sw, t[1] + 0.4, 0.18, 0.18, 1 - sg * 0.35, 0.36, i % 2 ? '#2e8b57' : '#3cb371'); }
        });
      });
      [[-1, -1], [3, -2], [-3, 3]].forEach(function (t) { add(t[0], t[1], function () { box(t[0] + 0.2, t[1] + 0.2, 0.6, 0.6, 1, 0.35, '#ff6f8a'); box(t[0] + 0.35, t[1] + 0.35, 0.3, 0.3, 0.65, 0.3, '#ff9fb0'); }); });
    } else if (id === 'jungle') {
      add(-4, -4, function () { box(-4, -4, 3, 3, 1, 0.6, '#9a9070'); box(-3.6, -3.6, 2.2, 2.2, 0.4, 0.6, '#a89e7c'); box(-3.2, -3.2, 1.4, 1.4, -0.2, 0.6, '#b8ae8a'); box(-2.85, -2.85, 0.7, 0.7, -0.8, 0.45, '#3a3428'); });
      [[-2, -1], [3, -3], [-3, 4], [5, -2], [-1, -2]].concat(ex.filter(function (e) { return e[0] > -2 || e[1] > -2; })).forEach(function (t, i) { add(t[0], t[1], function () { box(t[0] + 0.3, t[1] + 0.3, 0.25, 0.25, 1, 1.4, '#6b4a2b'); box(t[0] - 0.2, t[1] - 0.2, 1.2, 1.2, -0.3, 0.3, i % 2 ? '#1f6e33' : '#2e8f3e'); }); });
    } else if (id === 'moon') {
      add(-2, -2, function () { box(-1.55, -1.55, 0.08, 0.08, 1, 2.2, '#dddddd'); var wv = Math.sin(time * 1.5) * 0.04; box(-1.47, -1.55, 0.04, 0.8 + wv, -1.2, 0.5, '#ff5252'); });
      [[-1, -3], [3, -2], [-3, 2], [5, -3], [-4, -1]].concat(ex).forEach(function (t, i) { add(t[0], t[1], function () { box(t[0] + 0.2, t[1] + 0.3, 0.5 + 0.1 * (i % 5), 0.4, 1, 0.25 + 0.05 * (i % 5), '#a8a8b4'); }); });
    } else if (id === 'alien') {
      [[-2, -2, 1.6], [-1, -3, 1.1], [4, -2, 1.4], [-3, 3, 1.9], [-4, -1, 1.2], [6, -4, 1.5], [-2, 5, 1.0]].concat(ex.map(function (e) { return [e[0], e[1], e[2] * 1.3]; })).forEach(function (t, i) {
        add(t[0], t[1], function () {
          box(t[0] + 0.42, t[1] + 0.42, 0.16, 0.16, 1, t[2], '#9c27b0');
          var q = P(t[0] + 0.5, 1 - t[2] - 0.15, t[1] + 0.5);
          var pa = 0.6 + 0.4 * Math.sin(time * 2 + i);
          ctx.fillStyle = 'rgba(93,255,122,' + pa + ')'; ctx.beginPath(); ctx.arc(q[0], q[1], TW * 0.16, 0, 7); ctx.fill();
          glow(q[0], q[1], TW * 0.6, '#5dff7a', 0.7 * pa); light(q[0], q[1], TW * 2, 0.35 * pa, '#5dff7a');
        });
      });
    }
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
    if (S.mode === 'surface' || !r) return [-1, 0, LADDER_Z];       // on the rim beside the ladder top
    if (S.mode === 'up') return [-0.3, 0, LADDER_Z];                 // climb up the ladder, close to the wall
    if (S.mode === 'down') return [-0.3, g.deepest, LADDER_Z];       // climb down to the current layer
    return [r.x, r.y, r.z];
  }
  function update(dt, S) {
    time += dt; shakeT = Math.max(0, shakeT - dt);
    var r = S.run, tg = targets(S);
    if (disp.world !== S.world) { disp.world = S.world; disp.x = tg[0]; disp.y = tg[1]; disp.z = tg[2]; cam.init = false; }
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
    var zoom = surf ? (view.sheet ? 0.62 : 0.92) : 1, anchor = surf ? (view.sheet ? 0.2 : 0.4) : 0.3;
    if (surf) { fx = 3.5; fz = 3.5; fy = 1; }
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
  }

  // ---------- the scene ----------
  function draw(S) {
    var w = S.world, g = D.site(S, w), r = S.run, id = D.WORLDS[w].id, Pl = D.WORLDS[w].pal;
    setTile(cam.zoom);
    // project the camera focus to (vw/2, anchor*vh)
    ox = 0; oy = 0; var f0 = P(cam.fx, cam.fy, cam.fz);
    ox = Math.round((vw - view.right * vw / cssW) / 2 - f0[0] + (shakeT > 0 ? (Math.random() - 0.5) * TW * 0.08 : 0)); oy = Math.round(vh * cam.anchor - f0[1]);
    var viewTop = Math.max(0, Math.floor(disp.y + 0.001)), yBot = Math.min(D.DEPTH + 1, viewTop + VIEW_LAYERS);
    var surfaceView = viewTop <= 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    lights = [];
    if (post) { ectx.setTransform(1, 0, 0, 1, 0, 0); ectx.globalCompositeOperation = 'source-over'; ectx.fillStyle = '#000'; ectx.fillRect(0, 0, ecv.width, ecv.height); ectx.setTransform(0.5, 0, 0, 0.5, 0, 0); ectx.globalCompositeOperation = 'lighter'; }
    if (octx !== ctx) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, vw, vh); }
    var backY = P(-RIM, 1, -RIM)[1];
    background(w, P(N + RIM, 1, N + RIM)[1] + TW, viewTop <= 1 ? backY + (P(-RIM, 1, N + RIM)[1] - backY) * 0.3 : null);
    var hx = hex();
    function inPit(x, z) { return x >= 0 && x < N && z >= 0 && z < N; }
    // ground behind and beside the pit: on screen it never overlaps the pit, so it stays solid below the rim
    function backRegion(x, z) { return x < 0 || z < 0; }
    function solid(x, y, z) { // is there a drawn block here?
      if (y < 1 || y > yBot || x < -RIM || z < -RIM || x >= N + RIM || z >= N + RIM) return false;
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
    var lo = -RIM, hi = N + RIM;
    // the ladder reaches from above the rim down to the floor of the layer being worked
    var ladderBot = r && S.mode === 'dig' ? r.y : Math.max(g.deepest, Math.ceil(disp.y));
    // Draw order: deeper layers, the back half of the miner's layer, the layers above it (only the back
    // rim walls, ladder, torches and rim scenery are left there, all behind the miner), then the miner,
    // then the front half of its layer. The sprite stands about two layers tall, so drawing it before
    // the layers above would let the rim walls cover its head.
    var sMid = mcx + mcz, sEnd = 2 * (hi - 1);
    function layer(y, s0, s1, last) {
      // a layer whose front-most cube is still above the top of the screen draws nothing
      if (y !== minerLayer && y !== 1 && oy + 2 * (hi - 1) * hh + y * bh + TW < 0) return;
      var dark = y > viewTop ? Math.min(0.8, (y - viewTop) * 0.065) : 0;
      // walk diagonals back to front: s = x + z
      for (var s = s0; s <= s1; s++) {
        if (s === LADDER_Z && y <= ladderBot) ladder(y);
        if (s === 5 && y % 6 === 3) torch(0.03, y, 5.5, 'x', y >= viewTop && D.passable(g.t[D.idx(0, y, 5)]) || y < viewTop);
        if (s === 2 && y % 6 === 0 && y > 0) torch(2.5, y, 0.03, 'z', y >= viewTop && D.passable(g.t[D.idx(2, y, 0)]) || y < viewTop);
        for (var x = Math.max(lo, s - (hi - 1)); x <= Math.min(hi - 1, s - lo); x++) {
          var z = s - x;
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
          var top = y === 1 && (tt === T.DIRT || !pit) ? 'grass' : side;
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
          if (y === 1 && !pit && surfaceView && !solid(x, 0, z)) decor(x, z, id);
          if (pit) decorate(x, y, z, tt, i, q, w, S, g, i === tgt);
        }
      }
      if (last && y === 1) { // things standing on the surface: scenery and (at the surface) the miner
        var items = [];
        if (P(lo, 0, lo)[1] < vh && P(hi, 1, hi)[1] > -TW * 3) scenery(w, items, surfaceView);
        if (viewTop === 0 && !minerDrawn) items.push({ k: disp.x + disp.z + 1, fn: drawMinerNow });
        items.sort(function (a, b) { return a.k - b.k; }).forEach(function (it) { it.fn(); });
        if (surfaceView) shafts(id);
      }
    }
    var split = minerLayer >= 1 && minerLayer <= yBot;
    for (var y = yBot; y >= 1; y--) layer(y, 2 * lo, split && y === minerLayer ? sMid : sEnd, !(split && y === minerLayer));
    if (split) { drawMinerNow(); layer(minerLayer, sMid + 1, sEnd, true); }
    drawMinerNow();
    // moon loot, particles and floating text on top
    if (r && r.loot) r.loot.forEach(function (l) { var q = P(l.x, l.y, l.z); drawItem(ctx, l.item, q[0], q[1], TW * 0.28); });
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
    octx.font = 'bold ' + Math.round(TW * 0.3) + 'px Fredoka, sans-serif'; octx.textAlign = 'center';
    for (var fi = 0; fi < floaters.length; fi++) {
      var fl = floaters[fi], fq = P(fl.x, fl.y, fl.z);
      octx.globalAlpha = Math.min(1, fl.life * 2); octx.fillStyle = '#000'; octx.fillText(fl.text, fq[0] + 2, fq[1] + 2);
      octx.fillStyle = fl.c; octx.fillText(fl.text, fq[0], fq[1]); octx.globalAlpha = 1;
    }
    if (post) composite(S, w, viewTop, surfaceView);
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
    } else if (surfaceView) {
      focus = [P(-1.5, 0, -1.5)[1] - TW, P(N + 1.5, 1, N + 1.5)[1], TW * 4, 0.85];
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
  function floatText(x, y, z, text, color) { floaters.push({ x: x, y: y, z: z, text: text, c: color || '#fff', life: 1.3 }); }
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
    drawItem: drawItem, itemColor: itemColor, layerOf: layerOf, screenDir: screenDir, pickTier: pickTier,
    get dispY() { return disp.y; }
  };
})();
