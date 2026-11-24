# Design decisions

Settled by the user; treat them as decided and do not re-ask. Rebalance against the two-bot playthrough test (see `AGENTS.md`, Commands).

## Cave critters, 2026-11-24

- Light real-time cave creatures, with no menus and no fail state: bats that take ore or treasure lying on the floor (never a bone) and rattle-bones, a small friendly skeleton that bumps the miner dizzy for a moment. From layer 3 down, one about every 25 s of digging, at most two at once, never during a chest puzzle or the relic party.
- A tap shoos a bat or hits rattle-bones (three hits scatter it); both drop a few coins. The miner on auto-mining or standing idle, and helpers beside it, swat rattle-bones themselves, so a hands-off player is never stuck.
- Each world reskins the bat (forest bat, ocean jellyfish, green jungle bat, moon moth, glowing glorpfly); rattle-bones is a skeleton everywhere, tinted to the world. Friends say a line when one turns up.

## Helpers become friends, 2026-11-23

- Helpers are six named friends with backstories and personalities, met in world order, with hearts, a perk each at two hearts, story parts told at the hut, daily chat and gifts. Claude drafts the names and stories; the user edits.
- The hero is Nim, a 6 year old boy; Baron is 9 and Hale is 4. The first world starts with one helper, Baron, Nim's big brother (a running toot gag); their little sister Hale (very loving, feisty and bossy) joins at two hearts with Baron or when the second world opens. Then Jon (a lovable grown-up oaf, the ocean's merman, drawn bigger), Wren, Nova, and Grog (the Glorp alien, very quiet and timid). Names and personalities are the user's; Claude drafts the lines.
- Lines can be read aloud with the browser's speech (a Read aloud switch in the menu, off by default since 2026-11-24).
- Turn-based battles were considered and not chosen: they add menus and reading to a game for 6–9 year olds and a second kind of pause beside the chest puzzles. Light real-time cave creatures (bats, rattle-bones) may come later.

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
