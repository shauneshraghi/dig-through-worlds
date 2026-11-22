# Dig Through Worlds

A browser digging game for 6–9 year olds, in plain HTML, CSS and JavaScript. A kid miner digs down through a 7×7 pit, 50 layers deep, collecting ore, fossils and treasure, fills a museum with skeletons, and brings home a relic to unlock each of five worlds.

There is no build step and the game has no dependencies: open `index.html` or serve the folder.

## Requirements

- Node.js 20 or newer (tests and the dev server). Nothing to `npm install`.
- Optional, for screenshots: Playwright with headless Chromium, installed outside the repo by the bootstrap script.

## Quick start

```bash
bash scripts/bootstrap.sh            # check Node and git
bash scripts/bootstrap.sh --browser  # also install Playwright + Chromium for screenshots
npm test                             # node --test tests/*.test.mjs
npm run serve                        # http://127.0.0.1:8765/
npm run shots                        # screenshots of plaza and pits into shots/
```

Useful URL flags: `?dev=1` (unlimited coins, every world, no saving), `?world=N`, `?fresh=1`, `?nosplash=1`, `?seed=N`, `?hd=0` (plain 2D renderer). In the browser console, `window.__game` exposes the state `s`, the logic `D` and `step(seconds)`.

## Developing in Claude Code on the web

The repo is ready for a cloud session at claude.ai/code: `.claude/settings.json` runs `scripts/bootstrap.sh --browser` at session start when `CLAUDE_CODE_REMOTE` is set, so tests and screenshots work without setup. The environment needs network access to the npm registry and the Playwright browser download for screenshots; without it the tests still run.

## Repository guide

- [AGENTS.md](AGENTS.md): layout, game rules, commands and conventions (read by coding agents, and the best map of the code).
- [docs/design-decisions.md](docs/design-decisions.md): settled design decisions.
- [docs/art-style.md](docs/art-style.md): the target HD-2D look.
