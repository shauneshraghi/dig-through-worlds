# Design decisions

Settled by the user; treat them as decided and do not re-ask. Rebalance against the two-bot playthrough test (see `AGENTS.md`, Commands).

## Learning chests, stories and backup, 2026-11-26

- The player (Nim's real-life counterpart) is a strong first-grade reader whose speech-language goals are irregular past-tense verbs, social stories and pragmatic language; his SLP's take-home work adds reading comprehension (what will happen next), expected vs unexpected behaviour and greeting others. Learning content follows those goals first; math facts are included too.
- Learning goes into the chest puzzles (where the dig already pauses), not new interruptions: by default half the chests are learning chests, settable off, some, half or most on a grown-up page behind a sum. Grade 1 or 2. Smash stays as the way out.
- A miss is never punished: a tip or a kind why, a short wait, the wrong answer greyed out, same question. Missed items come back more often (Leitner boxes).
- Social stories follow Carol Gray's style and are never quizzes or rewarded: they are read from a Stories menu, told by a friend. Grown-ups can write their own (one page per line).
- Read aloud is not forced (he reads well); with it on, learning questions are read too.
- No screen-time reminder: the parent manages time.
- The game installs as an app (manifest, service worker, icons) and plays offline. A save moves between devices as a file or a pasted code (no server sync).

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
- Traps look cracked. With auto-mining on the miner dodges them by himself (too hard for a child to catch in time); with it off, a 2 s tap-anywhere dodge, and an idle miner is dazed. Helpers are still dazed; the auto-target order is unchanged.
- Materials come mostly from digging (about 70%), through bigger ore stacks per tier rather than more ore blocks.
- Splash Pick and Twin Picks cost about a third of their first price, with no goal bar.
- Bones stay guaranteed (each creature is buried twice).
- Ending: the Star Seed is planted on the plaza with cheering and fireworks, then "Dig again" replays every world for golden bones, which are cosmetic only.

Why: the review found puzzle time missing from the time budget, 91% of spending going through the material exchange, overpriced helpers and no ending.

## Isometric rewrite, 2026-11-20

See `.scratch/iso-rewrite.md` for the decisions behind the 3D pit and the kid miner. The depth has since been cut from 100 layers to 50 (`DEPTH` in `js/logic.js`).
