# Design decisions

Settled by the user; treat them as decided and do not re-ask. Rebalance against the two-bot playthrough test (see `AGENTS.md`, Commands).

## Progression review, 2026-11-21

- The player is a 6–9 year old; worlds stay flat in length.
- Playthrough test: two bots at 30 s per chest. The steering bot takes 10–20 minutes a world; the hands-off bot (buys helpers) takes at most 22.
- Hands-off play is supported but slower; cheaper helpers carry it.
- Chests every 4 layers; late puzzles are capped (pipes 4×4, ice 4 pushes, path 7 gems). Jungle treasure-room chests have no puzzle: an opening animation and sound, then the contents plus a bonus gem.
- Traps look cracked; a 1 s tap-anywhere dodge; an idle miner and helpers are still dazed; the auto-target order is unchanged.
- Materials come mostly from digging (about 70%), through bigger ore stacks per tier rather than more ore blocks.
- Splash Pick and Twin Picks cost about a third of their first price, with no goal bar.
- Bones stay guaranteed (each creature is buried twice).
- Ending: the Star Seed is planted on the plaza with cheering and fireworks, then "Dig again" replays every world for golden bones, which are cosmetic only.

Why: the review found puzzle time missing from the time budget, 91% of spending going through the material exchange, overpriced helpers and no ending.

## Isometric rewrite, 2026-11-20

See `.scratch/iso-rewrite.md` for the decisions behind the 3D pit and the kid miner. The depth has since been cut from 100 layers to 50 (`DEPTH` in `js/logic.js`).
