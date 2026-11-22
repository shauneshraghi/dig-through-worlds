// shots.mjs: screenshot the plaza and the pit of every world, wide and phone-sized,
// and print page errors. Needs `bash scripts/bootstrap.sh --browser` first.
// Usage: node scripts/shots.mjs [outDir]   (default shots/, gitignored)
// Starts its own server on a free port, so nothing else needs to be running.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const dir = process.env.DIG_TEST_DIR || join(homedir(), '.local/share/dig-test');
let chromium;
try { ({ chromium } = createRequire(join(dir, 'package.json'))('playwright')); }
catch { console.error(`playwright not found in ${dir}; run: bash scripts/bootstrap.sh --browser`); process.exit(1); }

const out = process.argv[2] || 'shots';
mkdirSync(out, { recursive: true });
const port = 8800 + Math.floor(Math.random() * 100);
const server = spawn(process.execPath, [fileURLToPath(new URL('serve.mjs', import.meta.url)), String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 400));

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
try {
  for (const [vw, vh, tag] of [[1280, 760, 'wide'], [390, 844, 'phone']]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
    for (let w = 0; w < 5; w++) {
      if (tag === 'phone' && w > 1) break;
      await p.goto(`http://127.0.0.1:${port}/?dev=1&nosplash=1&seed=3&world=${w}`);
      await p.waitForTimeout(700);
      if (w === 0) { await p.evaluate(() => window.__game.step(0.5)); await p.screenshot({ path: `${out}/${tag}-plaza.png` }); }
      await p.keyboard.press('Enter');
      await p.evaluate(() => { for (let i = 0; i < 40; i++) window.__game.step(0.1); });
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${out}/${tag}-w${w}-top.png` });
      await p.evaluate(() => { const g = window.__game; for (let y = 1; y < 20; y++) g.D._clearLayer(g.s, y); for (let i = 0; i < 30; i++) g.step(0.1); });
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${out}/${tag}-w${w}-mid.png` });
    }
    await p.close();
  }
} finally {
  await b.close();
  server.kill();
}
console.log(`screenshots in ${out}/`);
console.log(errs.length ? 'errors:\n' + errs.join('\n') : 'no page errors');
