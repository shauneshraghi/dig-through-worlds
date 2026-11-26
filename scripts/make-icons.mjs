// make-icons.mjs: draws the app icons in code and writes PNGs (no dependencies).
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../icons/', import.meta.url));
mkdirSync(out, { recursive: true });

const crcT = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), cr = Buffer.alloc(4);
  len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, cr]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const inPoly = (p, x, y) => { let r = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r; } return r; };
const segD = (ax, ay, bx, by, x, y) => { const dx = bx - ax, dy = by - ay; let t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t)); return Math.hypot(x - ax - t * dx, y - ay - t * dy); };

const C = {
  bgTop: hex('#2c2150'), bgBot: hex('#1d1630'), outline: hex('#140e22'),
  dirtTop: hex('#a8743f'), dirtL: hex('#7a4f2a'), dirtR: hex('#5e3b20'), pit: hex('#3a2314'),
  grass: hex('#6aa84f'), handle: hex('#c98e4c'), steel: hex('#b8c0d0'), steelD: hex('#7d8699'),
  gold: hex('#ffd54a'), goldL: hex('#fff3a0'), goldD: hex('#d9961a'),
};

// Colour of the art at unit coords (x, y); returns [r,g,b] or null (transparent art).
function art(x, y) {
  const T = [0.5, 0.40], R = [0.8, 0.55], B = [0.5, 0.70], L = [0.2, 0.55];
  const top = [T, R, B, L], left = [L, B, [0.5, 0.90], [0.2, 0.75]], right = [B, R, [0.8, 0.75], [0.5, 0.90]];
  const speck = (c, k) => mix(c, hash(Math.floor(x * 40), Math.floor(y * 40)) > 0.5 ? [255, 255, 255] : [0, 0, 0], k * hash(Math.floor(x * 40) + 7, Math.floor(y * 40) + 3));
  // gem
  const gx = 0.5, gy = 0.50;
  const gem = [[gx, gy - 0.14], [gx + 0.11, gy - 0.04], [gx, gy + 0.10], [gx - 0.11, gy - 0.04]];
  const gemO = gem.map(([px, py]) => [gx + (px - gx) * 1.18, gy + (py - gy) * 1.18]);
  if (inPoly(gem, x, y)) {
    if (y < gy - 0.04) return x < gx ? C.goldL : mix(C.goldL, C.gold, 0.5);
    return x < gx ? C.gold : C.goldD;
  }
  if (inPoly(gemO, x, y)) return C.outline;
  // cube
  const pitD = [[0.5, 0.46], [0.69, 0.555], [0.5, 0.65], [0.31, 0.555]];
  if (inPoly(pitD, x, y)) return speck(C.pit, 0.25);
  if (inPoly(top, x, y)) {
    const edge = [[0.5, 0.40], [0.8, 0.55], [0.5, 0.70], [0.2, 0.55]];
    const d = Math.min(...edge.map((p, i) => segD(p[0], p[1], edge[(i + 1) % 4][0], edge[(i + 1) % 4][1], x, y)));
    return d < 0.028 ? speck(C.grass, 0.2) : speck(C.dirtTop, 0.22);
  }
  if (inPoly(left, x, y)) return y < 0.60 + (x - 0.2) * 0.33 + 0.0 && segD(0.2, 0.55, 0.5, 0.70, x, y) < 0.03 ? speck(C.grass, 0.2) : speck(C.dirtL, 0.25);
  if (inPoly(right, x, y)) return segD(0.5, 0.70, 0.8, 0.55, x, y) < 0.03 ? speck(mix(C.grass, [0, 0, 0], 0.3), 0.2) : speck(C.dirtR, 0.25);
  // outline of cube
  const hull = [[0.5, 0.385], [0.815, 0.55], [0.815, 0.765], [0.5, 0.925], [0.185, 0.765], [0.185, 0.55]];
  if (inPoly(hull, x, y)) return C.outline;
  return null;
}
// pickaxes drawn behind the cube
function picks(x, y) {
  for (const s of [1, -1]) {
    const ax = 0.5 - s * 0.24, ay = 0.60, bx = 0.5 + s * 0.24, by = 0.16;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    // head: bar across the upper end, curved down at tips
    const hx = bx - dx / len * 0.02, hy = by - dy / len * 0.02;
    const tipA = [hx + nx * 0.17 + dx / len * -0.05, hy + ny * 0.17 + dy / len * -0.05];
    const tipB = [hx - nx * 0.17 + dx / len * -0.05, hy - ny * 0.17 + dy / len * -0.05];
    const dh = Math.min(segD(hx, hy, tipA[0], tipA[1], x, y), segD(hx, hy, tipB[0], tipB[1], x, y));
    if (dh < 0.030) return C.steel;
    if (dh < 0.046) return C.outline;
    const d = segD(ax, ay, bx, by, x, y);
    if (d < 0.020) return C.handle;
    if (d < 0.034) return C.outline;
  }
  return null;
}

function render(size, { maskable = false, scale = 1, radius = 0.2 }) {
  const SS = 3, buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = (px + (sx + 0.5) / SS) / size, v = (py + (sy + 0.5) / SS) / size;
      let inside = true;
      if (!maskable) { // rounded rect
        const qx = Math.abs(u - 0.5) - (0.5 - radius), qy = Math.abs(v - 0.5) - (0.5 - radius);
        inside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) <= radius;
      }
      if (!inside) continue;
      let col = mix(C.bgTop, C.bgBot, v);
      const au = (u - 0.5) / scale + 0.5, av = (v - 0.5) / scale + 0.5;
      const glow = Math.max(0, 1 - Math.hypot(au - 0.5, (av - 0.5) * 1.1) / 0.5);
      col = mix(col, C.goldD, glow * glow * 0.35);
      const c = art(au, av) || picks(au, av);
      if (c) col = c;
      r += col[0]; g += col[1]; b += col[2]; a += 255;
    }
    const n = SS * SS, o = (py * size + px) * 4;
    if (a > 0) { const k = a / 255; buf[o] = r / k; buf[o + 1] = g / k; buf[o + 2] = b / k; }
    buf[o + 3] = a / n;
  }
  return png(size, size, buf);
}

const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true, scale: 0.8 }],
  ['apple-touch-icon.png', 180, { maskable: true, scale: 0.92 }], // iOS rounds the corners itself
  ['favicon-32.png', 32, { radius: 0.18 }],
];
for (const [name, size, o] of jobs) { writeFileSync(out + name, render(size, o)); console.log('wrote icons/' + name); }
