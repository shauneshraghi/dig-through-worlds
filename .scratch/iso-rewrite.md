# Isometric rewrite: 3D pit + pickaxe miner (decided 2026-11-20)

## User decisions (settled; do not re-ask)
- World becomes a **3D block of ground**: 7×7 columns, 100 layers deep (relic layer at 100, bedrock below), viewed **isometrically from above**. Dig down layer by layer; steer in **four directions** (N/S/E/W). Layers above the player are cut away so the player and the current layer stay visible.
- Avatar: a **kid miner with a hard hat, headlamp and pickaxe**, swinging the pick (animated). The pickaxe's look upgrades with Drill Power (wood → stone → iron → gold → crystal, roughly every 6 levels).
- Everything else from the first plan stays: idle auto-dig plus tapping to speed up, bag soft cap, ores sell and fossils go to the museum, one shared set of upgrades, relic unlocks the next world, five worlds (Forest roots, Ocean oxygen with auto-return, Jungle 2 s stun traps and treasure rooms, Moon bouncing loot, Alien goo that regrows while drilled), museum wings, helpers, retro sfx plus a music loop per world, no dying, aimed at a kid, 20–30 min per world.
- Original art only: no Digging Master names, sprites or layouts. Take the genre and camera angle only.

## Implementation notes
- Logic stays DOM-free in `<script id="logic">`. Grid index becomes `(y*N + z)*N + x` with N=7 and y the depth. `steer(s, dir)` takes 'n','s','e','w' (keep -1/+1 as aliases for w/e so the UI's ◀ ▶ still work). Add ▲ ▼ (or a 4-way d-pad) and 4-direction swipes.
- Feature generation goes 3D: roots as runs along x or z, bubble pockets as small blobs, jungle rooms as 3×3×2 hollows with chests, moon craters as spheres, goo as scattered voxels. Fossils: 2 copies of each piece per world.
- Magnet: pulls ore in the same layer within a Chebyshev radius.
- Moon loot: bounces in 3D (x, y, z floats).
- Rebalance: the 7×7 layer has 49 blocks against the old 11, so ore found per row changes. Rerun the bot playthrough test (15–35 min band per world) and retune `hp` / `oreMult` / costs. The sim helper lives in the session scratchpad and is not kept; the test bot in `tests/logic.test.mjs` is the source of truth.
- Rendering: isometric 2:1 diamond tiles. Draw blocks back to front as cubes with three shaded faces (top, left, right) using the per-world textures. Draw layers from the current depth down about 6–8 layers, with cut-away pit walls so the shaft reads as a hole. Camera centres on the miner. Draw the surface scenery (trees, temple, moon flag, alien plants, the two huts) isometrically around the pit rim at layer 0.
- Keep the test hooks: `window.__game`, `?dev`, `?world`, `?fresh`, `?nosplash`, `?seed`. No alert/confirm/prompt.
- Update `AGENTS.md` for the new controls and grid layout.
