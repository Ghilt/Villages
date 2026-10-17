# Ruined cities

**What belongs here:** how every town of 1790 comes to stand on the map as a ruin - how big each one is, how its
record is baked and sent, how the page lays it out in pieces, what grows in it and what lives in it - the rules that
must hold, and the order it gets built in. **What does not:** why the cities fell, which is `STORY.md` and
`SETTING.md`; what a ruin looks like in plain words, which is `LOOK-AND-FEEL.md`; the words, which are `GLOSSARY.md`;
the levers as they are in the running program, which are `RUNNING.md`. When a part of it is decided, that part becomes
a decision record and leaves.

Planned on 2026-10-17 from Adam's request, after the story was told: the cities of 1790 are in ruins at the game's
start, people shun them, and there are riches in them at a risk.

## What Adam settled

| Question | Answer |
|---|---|
| Which towns of 1790 fell | All of them. The bigger the city, the more ruins |
| What a ruin is drawn as | Ruined-building pictures, more of them per culture than there are now, placed to look like a ruined city |
| Who sees what | The same ruins for every player, at the same places: deterministic |
| What lives in them | Ominous critters: rats, and crows |
| The ground and the roads under a ruin | Out of this plan |

---

## The problem, in one paragraph

The towns of 1790 are already in the world: 3,168 of them carried onto the master through the origin map, each a
Wikidata id with its 1790 name at a place in the world's own longitude and latitude (`names.json`, decision record
0087). Nothing on the map shows them except the Info map's names. Nothing says how big any of them was in 1790 - the
only rank held is Natural Earth's, which is today's, so Los Angeles outranks Pekin. A structure's ruin has one picture
per culture, a placeholder. And the scenery is drawn from a single layer of stands, `biome`, through one channel the
gateway fills only on revealed ground.

## How big each town was: `world/ruins.json`

A world input beside `world/cultures.json`, which `world:ruins` reads and Adam can edit by hand:

- **Tiers**: `great`, `large`, `city`, `town` and `small`, each with the 1790 population it stands for and the radius
  it is built over in world units, rising with the square root of its population - a hamlet's few shells over about
  four units, Pekin's hundreds over about forty. The reach is the built radius and a ring of overgrowth beyond it, and
  never more than 63.75 units, which is all a stand's reach byte holds.
- **Towns**: the bigger towns by Wikidata id, `[tier, note]`, from the estimates for about 1800 (Chandler). A town of
  1790 not listed is `small`. A second pass, region by region, can give the small towns their own tiers later.
- **Pieces** and **layout**: the ruin pieces there are, and the numbers the page lays a city out with (below).

## A layer of its own: `ruins`

Decision records 0054 and 0067 said that a later layer - settlements, ruins - is another directory with the same
files, and comes through the stands channel. So it does:

- **A town is one stand record** of the `ruins` layer: its middle, its reach, how built-up its core is in the
  thickness byte, a seed - and **its culture in the favourite byte**, worked out by the bake from the culture map at its
  place, so the page needs no culture map and a still matches the game.
- **The bake**, `world:ruins` (`bin/ruinsWorld.ts`), takes each town from the master's `names.json` and writes the
  records into `world/stands/<master>/ruins/` and what the page needs into
  `public/world/masters/<master>/sprites/ruins/map.json`. A town whose middle stands in water keeps it: the page lays
  pieces only on land, so a port's ruins stop at its shore, and a town on a square of sea in the culture map takes the
  culture of the place on Earth it came from.
  A step of the world cache of its own (decision record 0095), after the tiles, the names and the culture, and about a
  second long.
- **The wire**: the stands frame says which layer it carries, so the protocol's version goes up at both ends. The
  game server reads a fixed list of layers, never a name from the page. The gateway's outbox keeps one frame for each
  layer and tile - **not** one for each tile, or a ruins frame would replace the woods' and the woods would wait for
  ever. The fog lets a town's record through as it lets a stand's: once revealed ground lies within its reach.

## The pieces, in the scenery's atlas

A piece of a ruin is drawn in the same particle container and from the same atlas as the trees, because two
containers cannot sort in depth with each other, and a ruin's overgrown edge is trees among broken walls.

- Eight pieces in four cultures, `world/sprites/ruins/<piece>-<culture>.png`: a **shell** (a house open to the sky), a
  **row** of them, a **tower** stump, a **hall** (the culture's great building, roofless), an **arch**, a stretch of
  **wall**, a **gate**, and **rubble**.
- Placeholders drawn by `ruinLooks.ts`, recoloured for each culture as the structures' are; Adam paints over them when
  he chooses, and nothing waits on him.
- Each cut at its own height rather than all at the trees' 192, so the atlas stays near 1,600 pixels tall, under the
  2,048 every browser takes.

## The layout: the page's, from the record

`packages/world/src/ruinLayout.ts`, pure and tested, as the trees' scatter is:

- **Streets and blocks**: the city's own grid, turned by its seed, its streets jittered and its outline ragged; each
  block cut into lots and each lot holding at most one piece. A lot is kept by a roll against a share that falls from
  the core to the edge, so a thinner drawing is always a subset of a fuller one.
- **What stands where**: halls and towers in the core, rows and shells through the middle, rubble and lone shells at
  the edge, a wall and its gates on a ring where the culture builds walls.
- **Never on water**: a piece is refused where its foot or either half of its width is water.
- **Two towns meeting**: a lot belongs to the town it is nearest, measured against each town's size.
- **No trigonometry**: the turn is a table of numbers and distances are compared squared, so every browser's engine
  draws the same city.
- **Trees**: `furnishCell` joins the trees and the pieces of a cell and thins the trees after they are scattered: none
  near a piece, few in the core, the outer ruins as wooded as their ground. The scatter is not touched. The page and
  the stills both call it.

## The crows and the rats

They come out of a ruin's pieces as their cover, so they live only in ruins without the critters needing any idea of a
place: **crows** flush out of halls, towers and walls, in flocks larger and darker than the songbirds'; **rats** hop
between rubble and shells. Circling crows wait for the soar, `living-world.md`'s step 13. These steps come last: the
critters are being worked on in another session.

## The rules that must hold

None of them is held by a history or by a listener. Each is a property of pure functions and files, held at every
instant by tests and by the bake's refusals.

- **The same for every player**: the pieces come only from a decoded record, `map.json` and the zoom 7 classes; the
  gateway drops whole records and never alters one; the hash is keyed by integers that include the record's quantised
  middle; no trigonometry; the page and the stills call the same `furnishCell`.
- **Never on water**: the page tests each piece's foot and half its width, the bake moves middles onto land, and a test
  lays a band of water across a city.
- **The fog**: no record is sent unless revealed ground lies within its reach and eight units more, and what grows on
  revealed ground never depends on how much of the city has been revealed - a test like decision record 0067's holds
  the points on revealed ground the same with every record as with the ones the fog let through.
- **Thinner is a subset of fuller**, and each piece belongs to exactly one cell, the one its foot stands in.
- **No ruins draws exactly what it drew**: a test holds the scatter unchanged without them, and an empty ruins frame
  ends every wait for one.
- **No stale world**: the `ruins` step's fingerprint covers `world/ruins.json`, its own code, and the tile, names and
  culture steps.

## Names

Proposed, for Adam to rename before they are written into the glossary and the code:

| Name | What it means |
|---|---|
| **Ruined city** | Where a town of 1790 stood: a stand of the `ruins` layer, laid out by the page in pieces. Not a structure's **Ruin** |
| **Ruin piece** | One picture a ruined city is laid out in: a shell, a row, a tower, a hall, an arch, a wall, a gate, rubble |
| **Tier** | How big a town was in 1790, from `great` to `small`, which sets how much ground its ruins cover |

## Risks

- **Size ceilings**: room is made first in `cutArt.ts`, `renderScenery.ts`, the protocol's `frames.ts` and perhaps
  `sceneryCells.ts`, and `SceneryLayer.ts` may not grow (decision record 0072).
- **Towns the warp put in the sea**: Canton and Calcutta stand on warped coast; the bake's report names every town it
  moved or dropped.
- **Towns that crowd each other** in Europe and the Low Countries, which the rule of the nearest settles.
- **Rough populations**: the tiers are estimates for Adam to correct.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 0 | **This plan.** SETTING and STORY say every town of 1790 fell, the greatest worst; the ROADMAP's entry; the names above in the glossary. | Read the plan, and the changed boxes at `/admin/inspect-story`. |
| 1 | **A size for every town.** `world/ruins.json`; `src/ruins.ts` and its tests: every id a town of 1790, the largest reach within its byte. AUTHORING-THE-WORLD. | A table of the tiers and their towns, each with its radius in units and in kilometres: is any town in the wrong tier? |
| 2 | **The bake.** `world:ruins`, the `ruins` world step, the architecture page, the regenerate-world skill, RUNNING; decision record 0101. | 👀 `world/painterly/ruins/`, a ring for every town over the culture map around five great cities. The bake's report: how many towns in each tier and culture. |
| 3 | **The layout, in stills.** `ruinLayout.ts` and its tests; `world:scenery` stamps a town; decision record 0102. | 👀 Stills of Paris, Constantinople, Pekin, Grand Cairo, Mexico and a small town: does each read as a ruined city, in its culture's streets? |
| 4 | **Trees in the ruins.** The scatter's hook and `furnishCell`; the stills on it. | 👀 The same stills: an open core, an overgrown edge, no tree through a ruin. |
| 5 | **The pieces' pictures.** `ruinLooks.ts`; `cutArt` takes `world/sprites/ruins/`; a Ruins table on the Pictures page; AUTHORING-THE-ART says the size to paint each at. | 👀 `/admin/inspect-pictures`, Ruins: thirty-two pieces, four cultures, all placeholders. Is the list of pieces right before you paint? |
| 6 | **The frame says its layer.** The protocol's version up, with its recording; the game server's layers; the outbox's key; the page keeps stands by layer and waits for both; ARCHITECTURE. | 👀 The debug panel's Scenery near Paris: the ruins tiles held, more with the fog lifted; the woods as before. |
| 7 | **The Info map draws the ruins it was sent.** A ring at each town's built radius and one at its reach, in its culture's colour. | 👀 The Info map at zoom 6 over Europe, the fog lifted: a ring on every town, sized by its tier; with the fog on, only the towns touching revealed ground. |
| 8 | **Ruins in the game.** The scenery cells call `furnishCell`; LOOK-AND-FEEL. | 👀 Paris from zoom 8 to 10: the ruined city, its landmarks in the core, nothing on the Seine, the same in two browsers. 👀 A small town near it: a handful of shells. |
| 9 | **Crow and rat pictures**, once the critters session is on main. `world/critters.json` and their placeholders. | 👀 The Pictures page shows both playing. |
| 10 | **Crows and rats in the ruins.** A ruins cast chosen by the cover; the critters' look; a test that nothing changes outside a ruin; `living-world.md`, decision record 0099 amended. | 👀 A ruin at zoom 9.5: crows bursting from its towers, rats between its heaps, none in the wood beside it. Ominous enough? |

Then it is brought to main.

## Not in this plan

- The ground and the roads under a ruin.
- The game server knowing the ruins - for the guides, for an omen *near the ruins of Dantzic*, for founding a seat.
- A ruin's riches, its danger, and whether it can be made clean.
- A ruin seen from further out than the scenery is, as a mark.
- Each small town's own tier, which a later pass can give.
