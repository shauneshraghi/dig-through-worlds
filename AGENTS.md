# Dig Through Worlds

A browser digging game in plain HTML, CSS and JavaScript with no build step and no npm dependencies. The world is a 7×7 column of ground, 100 layers deep, drawn as an isometric pit. A kid miner clears the pit one layer at a time, walking to the nearest block and digging it on its own; the player can steer to pick the next block and taps to dig faster. Ores sell for coins and fossils fill a museum. On the surface the miner walks about a plaza: the pit, a shop stall, a helpers' hut, a world signpost and a museum hall whose plinths show each world's skeleton as its fossils are found, with visitors wandering between them. Each of the five worlds is unlocked by bringing home the previous world's relic.

## Layout

- `index.html` is the page shell. It loads the scripts below with plain `<script>` tags, in this order, so the game also runs from `file://`.
- `css/style.css` holds all styles. Portrait screens stack the HUD, the pit and the controls with the station menu as a bottom sheet; wide screens (landscape, at least 700 px) fill the window with the pit, float the HUD and controls over it, and show the station menu as a right-hand panel. A station's menu opens while the miner stands on its pad; the ☰ button (or Esc) opens a menu anywhere on the plaza that reaches every station, a new dig site for the current world and Start over. `ui.js` tells the renderer how wide that panel is (`DTWRender.setView`) so the camera centres the pit in the uncovered part.
- `js/logic.js` is the pure game logic: the world table, terrain generation, economy, unlock rules, the plaza map and walking (`HUB`, `hubInput`, `hubWalkTo`, `hubStation`) and save/load. It has no DOM access and defines the global `DTW`.
- `js/post.js` is the HD-2D post-process (`DTWPost`): a WebGL2 pass with no libraries that lights the scene with screen-space point lights, blurs everything outside the working layer (tilt-shift depth of field), adds bloom from an emissive layer and grades the colours per world.
- `js/sprites.js` is the pixel art for characters and exhibits (`DTWSprites`). Characters are built from parts written as letter grids (heads, torso, legs), recoloured by palettes (the miner, visitors, guide, shopkeeper), posed and outlined; the miner wears a big rucksack while its bag is full. Finds that pop up get a 12×12 pixel icon (`DTWSprites.item`). Exhibits are bone shapes on a 48×28 grid split into each world's five fossil pieces; missing pieces draw as a dotted ghost.
- `js/render.js` is the isometric renderer (`DTWRender`): cube sprites built from 16×16 pixel textures drawn in code, the cut-away pit, the ladder, wall torches, the plaza props placed from the map (sorted by footprint in `depthSort`), and the people on the plaza. Hired helper diggers are drawn working cells of the miner's layer at least two cells from the miner and off its path, on open floor or on top of blocks still to be dug (`helperSpots`), and resting by their hut on the plaza; like visitors they are visual only, their work being the extra hit rate in the logic. Visitors are visual only and use `Math.random`, never the game's rng. With WebGL2 it draws the scene into an offscreen canvas and glowing things (ores, torches, goo, the relic, the headlamp) into a half-size emissive canvas, collects point lights, and hands all three to `DTWPost`; without WebGL2 it draws straight to `#cv` in plain 2D. Floating text and stun stars go on the `#ov` overlay canvas so the blur never touches them. Lighting and grading numbers sit in `GRADE` and `lamp()` in `render.js`.
- `js/audio.js` is the WebAudio sound effects and per-world music (`DTWAudio`).
- `js/ui.js` holds state, saving, the HUD, surface menus, input and the main loop, and sets `window.__game`.
- `tests/logic.test.mjs` and `tests/hub.test.mjs` run `js/logic.js` in a Node `vm` context.

## Grid and controls

- Cells are indexed `(y*N + z)*N + x` with `N = 7`; use `DTW.idx(x, y, z)`. `y` is depth: layer 0 is open air, the relic layer is at `DEPTH` (100) and bedrock is below it.
- The miner works the topmost layer that still has diggable blocks (`DTW.topLayer(site)`); open cells (air, bubbles, craters, jungle rooms) need no clearing. The layer below opens only when that layer is empty: then the miner digs the block underfoot, or drops through an open cell, and stops in the first layer that still has blocks. The relic layer works the same way; its first block gives the relic, and later ones are treasure.
- Left alone, the miner walks the shortest path over open cells of its layer to the nearest block and digs it, both at `AUTO_PACE` (half) of its steered pace, so steering pays. Steered it walks `WALK` cells per second and swings at full rate. Hired diggers' share of the hit rate is never slowed.
- `DTW.steer(s, dir)` picks the neighbouring block in that direction as the next one to dig, or walks onto it if it is open, and pauses auto-walk for `MANUAL_HOLD` (2 s) after the last steer, so the miner stays where the player put it. Holding a direction keeps steering, one cell at a time at `WALK` pace. It takes `'n'`, `'s'`, `'e'` or `'w'`; `-1` and `+1` are aliases for `'w'` and `'e'`. East is +x and south is +z. `run.steer` holds the key or `0`.
- On screen +x runs down-right and +z runs down-left, so the directions are diagonals: ↗ north, ↘ east, ↙ south, ↖ west. In the pit the d-pad buttons, the arrow keys (Up north, Right east, Down south, Left west), WASD the same way, and swipes by screen quadrant all follow this. Space or a tap on the pit digs faster, H goes home, Enter digs from the surface, M mutes.
- The magnet pulls ore in the miner's layer within a square radius. Moon loot bounces in x, y and z.
- The plaza map is `HUB.rows` in `js/logic.js`, one character per cell from `(HUB.x0, HUB.z0)`, in the same x, z frame as the pit (its key is in the comment above it). The pads `L S H W M` open the dig, shop, helpers, worlds and museum menus. The miner starts on the dig pad at the top of the ladder and returns there after every dig; its plaza position is not saved.
- On the plaza, held arrow keys and WASD walk that way on screen (Up is up the screen; `ui.js` turns each key into two compass directions), held d-pad buttons walk their diagonals, all at `HUB_SPEED`, and a tap walks to that spot by the shortest path. The ⛏ Dig! button and Enter start digging from anywhere.
- Going home and going back down are drawn as the miner climbing a ladder on the back-left pit wall (the x = 0 face at z = 3), which runs from the rim to the current layer. The logic keeps its `elevT` timers (at most 2 s down and 3 s up), so long climbs speed up.

## Commands

- Run the tests with `node --test tests/*.test.mjs`. The playthrough test uses a simple bot (it steers toward the nearest block, taps, and goes home when the bag is full or every 2.5 minutes) to check that every world takes 15–35 minutes and that full bags send it home, and prints the minutes per world.
- Play the game by serving the folder with `python3 -m http.server 8765 --bind 127.0.0.1` and opening `http://localhost:8765/`.
- URL flags:
  - `?dev=1` gives a billion coins and unlocks every world, and does not save.
  - `?world=N` starts in world N, counting from 0.
  - `?fresh=1` starts a new game without loading or overwriting the save.
  - `?nosplash=1` skips the title screen (audio starts on the first tap).
  - `?seed=N` sets the random seed for a new game.
  - `?hd=0` turns off the HD-2D post-process and draws in plain 2D (the WebGL2 fallback). The console logs which renderer is running.
- In the browser console, `window.__game` exposes `s` (the state), `D` (the logic) and `step(seconds)`, which advances the game frame by frame even when the tab is throttled and draws once at the end.
- Test and dev hooks in the logic: `DTW._teleport(s, x, y, z)`, `DTW._setTile(s, x, y, z, tile, value)` and `DTW._clearLayer(s, y)`.

## Conventions

- Game rules and numbers live in `js/logic.js` and are tested first. Rendering sits on top and is not tested.
- To change balance, edit `hp`, `oreMult` and `exhibit.income` in `WORLDS`, `ORE_P`, `WALK`, `AUTO_PACE`, or the cost tables in `UPGRADES` and `WORKERS`. Then rerun the tests to check the per-world times.
- Art is original and drawn in code. Do not copy names, sprites or layouts from other digging games.
- Never call `alert`, `confirm` or `prompt`. Destructive buttons use a second tap to confirm.
- Saves go to `localStorage` under the key `dig-through-worlds-v1`, and every access is wrapped in try/catch. The save format is version 2; a version 1 save from the old flat 11-wide world keeps coins, upgrades, museum and unlocks, and its dig sites are regenerated.
