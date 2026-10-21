# Settlements, roads and bridges

**What belongs here:** how the villages and fishing villages of 1790 come to stand on the map, held by nobody - where
each one stands, how the server raises it, how the page lays it out and wears its ground - and how the roads between
them and to the ruins are baked, sent and worn in, with a bridge wherever one crosses a river; the pictures they need
and how asseterizer paints them; the rules that must hold, and the order it gets built in. **What does not:** why the
countryside was spared, which is `SETTING.md`; what a settlement looks like in plain words, which is `LOOK-AND-FEEL.md`;
the words, which are `GLOSSARY.md`; the levers as they are in the running program, which are `RUNNING.md`; a house
taking a settlement, which will be a mechanic in `MECHANICS.md`. When a part of it is decided, that part becomes a
decision record and leaves.

Planned on 2026-10-21 from Adam's request: *"little 'uncontrolled' settlements of buildings dotted around the world,
connected by roads. Not only by the ruins but next to them also, and the roads should go to the ruins also. Fishing
villages also. Rivers need bridges that look good crossing in at least 8 directions."* It is layers two and three of
`world-generator.md`, settlements and the ways between them, and keeps that plan's rule: sparse and global is baked,
dense and local is derived.

## What Adam settled

| Question | Answer |
|---|---|
| What a settlement is | A thing in the game: a structure held by nobody, raised at the opening as the house bots are, so it can be selected, inspected and one day taken |
| Bridges | Eight directions from four pictures a kind, since a bridge reads the same from either end: the ground lattice's two axes and its two diagonals |
| How a road looks | Worn earth, a kind of its own in the worked ground, wider and paler than a path. Bridges are the only road pictures |
| The word *bridge* | The river's. What carries events to RabbitMQ (0094) becomes the **Event bridge** |
| A settlement's name | By its place, as an atlas would put it: the culture's word and the nearest named water or ruin, *fishing village on the Lake of Geneva*, *village by the ruins of Dantzic* |
| How many | Sparse to start, about one every 60 km on good land, a few thousand in the world; a number in a world file, raised by eye once the opening is measured |
| The ground under a settlement | Worn, and different from the terrain beneath: the settlement's whole ground, not only a yard a building |
| Where a road meets a ruin | Not answered, so the default: at a gate where the ruin is walled, else at the outline of its built ground; nothing is laid among its pieces |

---

## The problem, in one paragraph

Every town of 1790 is a ruin (0103), and the countryside round them is empty: nothing on the map says anyone lives
anywhere. The setting says the opposite - the ritual weighed least where minds were few, so the villages, the estates
and the couriers on the roads were spared - and roads are the strongest sign there is that a place is lived in. A
structure can be held by nobody (Antarctica's sixteen are), the opening already makes things the world lacks (the
house bots, 0108), the worked ground has room for a road (0105), and the stands channel already carries baked records
under the fog (0067, 0103). None of it yet makes a village or a road.

## Where settlements stand: baked, then raised

**`world/settlements.json`** is a world input beside `world/ruins.json`, Adam's to tune: how good each class of ground
is to live on (farmland, meadow, floodplain and paddy best; none on ice, desert, bare rock, marsh, bog or water), the
steepest relief a village stands on, the spacing in kilometres, how many sites stand beside a ruin by its tier and how
far past its reach, when a shore makes a fishing village, the levels by score, and the **look** the layout and the
roads share: each building's footprint and height, and the street rule.

**Two kinds of site, each with an id that outlives a repaint:**

- **Beside a ruin**, `ruin:<town>:<k>`: past the ruin's reach and a gap, at a bearing worked out from the town's id
  and turned an eighth of a circle at a time until it stands on land. It moves with its town when Adam repaints.
- **In open country**, `site:<gx>:<gy>`: a candidate on a fixed grid of 16 world units, kept when no better candidate
  lies within the spacing. The rule is local, so a repaint moves only the sites near the paint.

A site with sea, a lake or a large river on one side and good land on the other is a **fishing village**; the rest are
**villages**. Each has a level by its score, or by its ruin's tier: a hamlet, a village, a large village.

**`world:settlements`** (`bin/settlementsWorld.ts`, its pure parts in `src/settlements.ts`, `settlementSites.ts` and
`settlementNames.ts`) is a step of the world cache after the tiles, the flow, the height, the names, the cultures and
the ruins. It reads the zoom-7 class tiles rather than the master, so it sees the water the page sees, and writes
`world/ground/<master>/settlements.json` for the game server, never served, `sprites/settlements/map.json` for the
page, the look and nothing of where any site is, and with `--picture` stills in `world/painterly/settlements/`.

**Names** are the bake's: a fishing village by its nearest lake, then sea, then river; a site beside a ruin *by the
ruins of* its town; any other by the nearest river or lake, else the land it is in. The word is the type's in its
culture, never the level's, so a name does not go stale when a village grows.

**Two types in the structures' catalogue**: `village` and `fishingVillage`, three levels each, every culture's word, a
low significance, `groundHeight` the tallest building, `footprint` the side of the settlement's square of ground, and
no yields or slots yet. Antarctica raises one of each, as it does every type.

**The sites file is a contract**, as decision record 0087 made the names one: a fixture in `contracts/fixtures/` read
at both ends, a port `SettlementSites` in `application`, and its file in `app`.

**The opening raises them** (`application/settlements/Settlements.kt`), after the bots: every site whose structure the
read model lacks, held by nobody, with `villages.structure.raised.v1`, under an id name-based on the site's, in one
story. A site within a clearance of another structure is passed over, so no village stands on a bot's castle. One
raised already is refused and passed over, as Antarctica's are. The log and the debug panel's World section say how
many were raised, passed over, and left without a site after a repaint: such a settlement is never moved, only named;
before alpha a wipe is the answer. **No new event and no new command.**

## How a settlement is drawn: laid out by the page

**`settlementIn`** (`src/settlementLayout.ts`, pure and without trigonometry, called by the page, the stills and the
structures page) lays a settlement out from its structure's id, type and level, the culture under it and the zoom-7
classes: two **streets** on the lattice's axes through its middle, kept clear, and a **green** where they meet;
buildings on ranked lots, so a higher level holds every building of the lower; a fishing village's huts along its
shore with a jetty and boats beside it. The structure's place is the settlement's middle, and its square of ground is
centred on it, so a level up grows it outward round a middle that does not move.

**It stands among the trees as one thing.** Each thing standing among the trees cuts them into one more slice, a draw
each (0110), so a settlement is one standing thing, its footprint its square, its buildings put in order among
themselves by the same rule; `standingOf` and `drawOrder` learn that a footprint can carry several pictures. A click on
any building selects the settlement, and the structure's window names it, held by nobody. Further out than 7.5 it is
one mark, as every structure is.

**Its ground is worn**, as Adam asked: a `settlement` kind of worked ground, its square worn whole with a ragged rim,
its streets and green, a yard a building, and a **lane** from each door to its street, walked by `courseBetween` with
the footprints barred. To the paths' rule between near buildings the settlement is one yard, so a path still joins it
to a castle near it. It keeps to the fog exactly as the structure does, because it has no other source.

## Roads and bridges: baked, and sent in pieces

**`world:roads`** (`bin/roadsWorld.ts`, its pure parts in `src/roads/` and `src/roadRecords.ts`) is a step after the
settlements, the ruins, the flow and the height, its numbers in `world/roads.json`.

- **Which places are joined**: settlements and ruins, by a relative-neighbourhood graph within a longest road, every
  settlement joined to at least its nearest place, and no road from one ruin to another, so every road has a living
  end. Shortest first, with ground already a road cheaper, so roads merge into trunks; graded a track, a road or a
  trunk by how many use them.
- **The course**: the cheapest way over the world's units, its cost by the ground and its slope, open water barred
  and a corner cut beside water barred. A river is never stepped on: it is crossed only by a **bridge**, a straight run
  along one of the lattice's four axes - land, then river no wider than a longest span, then land - sampled finely, so
  a river joined only at its corners is not slipped through, and only where `world:flow` says the river is small
  enough. A long span is stone, a short one timber.
- **Its ends**: into a settlement by one of its streets; at a ruin, at its gate where it is walled and at the outline
  of its built ground where it is not, the ruin's pieces laid out by `ruinsIn` and kept off.
- **Its shape**: simplified and smoothed, checked against the water again, the bridges and their approaches left
  straight.

**The `roads` stand layer.** A road is cut into straight pieces that fit the eight-byte record the stands already
use: a middle in eighths of a unit, a reach of half its length and width, the half-vector to one end in the two bytes
after it, and a kind - its grade, or a bridge's axis and kind - in the last. The ends of two pieces meet exactly, the
page asks no engine's trigonometry, and the gateway's test of the fog is unchanged. A bridge is a record of its own in
the same layer. `STAND_LAYERS` gains `roads` at both ends, and the protocol's version goes up once.

**On the map** a road is worn into the worked ground as a `road`, wider and paler than a path, only on revealed ground,
clipped there a diamond at a time, and no tree grows on it. A bridge stands among the trees on the strip of its deck,
from `world/sprites/bridges/<kind>-<axis>.png`, hung at its middle and scaled by its span. Roads further out than 7.5,
where the worked ground is not drawn, are left for later: a line layer from the same records is the cheap way.

**House bots yield** at the end: a bot's seat is passed over near a site or a road, so a fresh world stands no castle
on a village or across a road.

## The pictures, and asseterizer

- `world/sprites/settlements/<kind>-<culture>.png`: a cottage, a house, a barn, a chapel (a chapel, a small mosque, a
  shrine-temple, a thatched shrine), a fishing hut, a net rack and a boat (a smack, a felucca, a sampan, a dugout) in
  each of the four cultures, and one `jetty.png`: 29 pictures.
- `world/sprites/bridges/{timber,stone}-{u,v,uv,vu}.png`: two kinds on four axes, 8 pictures.
- Placeholders drawn in code **at the size to paint them at**, because asseterizer repaints a file in place at its
  own size: buildings 704 pixels tall, bridges 768 on their long side, on transparent ground, standing on the bottom
  edge or on the middle of the deck. Never drawn over a file that is there, recorded in `placeholders.json`, cut by
  `world:structures` into an atlas of their own and shown on `/admin/inspect-structures`.
- **The brief**, `world/guides/settlements/`: the buildings' `draw_guides.py` taught block-outs for the new pieces, each
  bridge turned to its axis, one file an axis and never mirrored, because a mirror moves the light; and
  `PROMPT-for-asseterizer.md` after the buildings' own, warning that the harbours came back with houses added on their
  quays, so the jetty and the boats may too.
- **Asseterizer paints into the main checkout.** So steps 1 to 10 stand on their own, and step 10 is the place to say
  *main* if the painting should start while the rest is built. Nothing waits on the paintings: the placeholders carry
  every step.

## The rules that must hold

| Rule | Held by | When |
|---|---|---|
| The same sites, layouts, roads and bridges for every player on every tree | pure functions of the baked files and `world/settlements.json`; the world cache's fingerprints; tests run twice and in any order | at once, by construction |
| Each site is raised once | the structure's own stream: an id name-based on the site's, a second raising refused (the read model's skip is only a shortcut) | at once |
| Every site has a settlement | the opening, after the bots | a moment after: a server stopped part-way raises the rest at the next opening |
| No settlement on another structure's ground | the opening passes over a site within the clearance; fresh bots yield to the sites and the roads | at the opening, before anyone connects |
| No seat a player founds on a settlement | nothing yet | a hope: later the founding's three seats keep off ground near a structure |
| Never on water - a site, a building, a road, its worn ground - but a jetty and a boat, beside the shore | the bake, the layout and the roads, all reading the same zoom-7 tiles | at once |
| A river is crossed only by a bridge, on one of the four axes, both its ends on land | a bridge's run is the only way a course crosses a river; its axis is in its record | at once |
| A road has a living end, and at a ruin it ends at its gate or its outline, never among its pieces | the graph; the pieces kept off through `ruinsIn` | at once |
| No road runs through a building | the street rule the bake and the layout share; the bake's report counts roads entering a building, and it must be none | at once, while both read the same fingerprinted look |
| A road is drawn only on revealed ground | the page's clip, a diamond at a time; the gateway's test of the reach, coarser | at once |
| A settlement, its buildings and its ground show wherever and however its structure does, as last seen | the gateway's `Fog`; everything else is worked out from what the page holds | at once |
| No tree on a settlement's ground, a yard or a road | `growing.ts` | at every rebuild |
| A higher level holds every building of the lower | the layout's ranked lots | by construction |
| A repaint never moves a settlement | nothing moves one; the ones left without a site are named | named, not mended |

## Names

| Name | What it means |
|---|---|
| **Settlement** | A village or a fishing village nobody holds at the world's start: a structure of type `village` or `fishingVillage`, a hamlet, a village or a large village by its level, raised at the opening on a **Settlement site**, its buildings laid out by the page |
| **Settlement site** | Where the bake puts a settlement: an id that outlives a repaint, a type, a level, a name and a place |
| **Settlement ground** | The worked ground a settlement stands on: its square worn ragged, its streets and green, its yards and lanes |
| **Street** | One of the two ways along the lattice through a settlement's middle, kept clear of buildings; a road comes in by one |
| **Green** | The open ground where a settlement's streets meet |
| **Lane** | Worn ground from a building's door to its street. Not a **Path** |
| **Road** | Worked ground baked by `world:roads`, joining settlements to each other and to the ruined cities: a track, a road or a trunk, the `roads` stand layer, drawn only on revealed ground |
| **Bridge** | Where a road crosses a river: timber or stone, along one of the lattice's four axes, both ends on land. Not the **Event bridge** |
| **Event bridge** | What was the **Bridge** of decision record 0094: what carries every stored event to the broker |

**No new event or command.** A settlement is raised by `villages.structure.raised.v1`, through `RaiseStructure`.

## Risks

- **The opening's time** on a fresh world, after a wipe and after a load: a few thousand raisings, measured in step 8
  before the count goes up, with raising them side by side, each its own stream, ready if it is slow. The settlements
  will push the bots out of the events log's window.
- **The cost of drawing**: one slice of the trees a settlement and a bridge, and the trees sorted again as they come
  on the screen at 7.5 to 8, measured on `/admin/inspect-performance`. Road records come from zoom 6, about 2 kB a tile.
- **Size ceilings** (0072): `PixiSpriteRenderer.ts` is at 392 lines, `MarksLayer.ts` at 390 and `sceneryCells.ts` at
  384, so the new code goes in modules of its own and the renderer gets shorter before the bridges; `SceneryLayer.ts`
  and `cutArt.ts` are not touched.
- **The bake and the page drifting apart**, a street where the page puts a house: the same tiles, the same look, the
  fingerprints, and the bake's count of roads entering a building, which must be none.
- **Other sessions**: the protocol's version (66 on main) and the decision records' numbers (0114 and 0115 here) are
  taken as they are written and checked again on the way to main.
- **Asseterizer and the water**: the jetty and the boats may come back with things added; they stay placeholders if so.
- **Antarctica's grid**: a village's square is wider than the gap between Antarctica's types, so the settlements get a
  row of their own there.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **This plan**; decision records 0114 and 0115; the names above in the glossary, but for the river's *Bridge*, which waits for the rename; a line in `SETTING.md`; `MECHANICS.md`'s structures; the ROADMAP; `world-generator.md` hands over its layers two and three | 1. Decision record 0114: is a settlement as a structure nobody holds, raised at the opening from a site the bake chose, the right shape? 2. The glossary's new words and the SETTING line: are they right? |
| 2 | **The Event bridge**: `Bridge` renamed `EventBridge` in `infrastructure-rabbit`, its Docker test and `CarriedWorld`; the glossary, with the river's *Bridge* beside it; `ARCHITECTURE.md`, the architecture page, RUNNING, EVENTS, `broker.md`; 0094 amended. `world:flow`'s `--bridge` keeps its name | 1. 👀 `/admin/inspect-architecture`: the carrier says *Event bridge*. 2. The checks, the broker's Docker test green |
| 3 | **Two types**: `village` and `fishingVillage` in `structures.json`; Antarctica raises one of each, in a row of their own | 1. 👀 Antarctica with *see everything*: a village and a fishing village, held by nobody, on their worn squares. 2. 👀 `/admin/inspect-structures`: both types. 3. Are the words and numbers right? |
| 4 | **Where they stand, pure**: `world/settlements.json`, `src/settlements.ts`, `settlementSites.ts` and the street rule, tested | The checks: the same sites in any order; all on land; none nearer another than the spacing or inside a ruin's reach; a repaint moves only the sites near it; a ruin's sites keep their ids when its town moves |
| 5 | **The bake**: `world:settlements`, its world step, the architecture page, the regenerate-world skill, RUNNING, AUTHORING-THE-WORLD | 1. 👀 `world/painterly/settlements/`: villages round the five great ruins, fishing villages on the shores, nothing on ice, desert, marsh or steep ground. 2. The report: how many of each type, level and culture, and how long it took |
| 6 | **The names**: `src/settlementNames.ts` | 1. Forty names across the four cultures: do they read as an atlas's would? 2. 👀 The still's labels round Geneva and Dantzic |
| 7 | **The sites file as a contract**: the fixture read at both ends, the port and its file | The checks: both ends read the fixture, and a field renamed fails one of them |
| 8 | **The opening raises them**: `StructureId.ofSettlement`, `Settlements.kt`, the opening and its configuration, EVENTS, 0108 amended | 1. 👀 *See everything* near Paris at zoom 8: a stand-in at every site, beside a bot's castle and never on one. 2. 👀 A restart on a world kept in MongoDB raises nothing, in under a second. 3. 👀 *Wipe*: they come back, and the log says how long the raising took |
| 9 | **The pictures' placeholders**: every settlement piece in four cultures and the eight bridges, cut into an atlas of their own; the dev server watching both folders; `/admin/inspect-structures` showing them; AUTHORING-THE-ART | 1. 👀 `/admin/inspect-structures`: every building in four cultures on its footprint. 2. 👀 The bridges, two kinds on four axes, each lying along its diamonds. 3. Is the list of pieces right before asseterizer paints them? |
| 10 | **The brief for asseterizer**: `world/guides/settlements/` | 1. 👀 The guides: the block-outs in the map's camera, one file a bridge's axis. 2. Is the brief what you would paste? 3. *Main* here, if the painting should start now |
| 11 | **A settlement laid out**: `src/settlementLayout.ts`, tested; every type, level and culture on the structures page | 1. 👀 `/admin/inspect-structures`: the hamlet, the village, the large village and three fishing villages in four cultures: does each read as a village? 2. The checks: a higher level holds the lower, all on land, the streets clear |
| 12 | **Settlements stand in the game**: `sprites/settlements/`, one standing thing a settlement, a click on any building | 1. 👀 Zoom 9 by Dantzic with *see everything*: villages by the ruin, the trees in front of them and behind them as they should be. 2. 👀 A click: *village by the ruins of Dantzic*, held by nobody. 3. 👀 `/admin/inspect-performance` over Europe at 7.5 |
| 13 | **Settlement ground**: the `settlement` and `road` kinds of worked ground; the square, streets, green, yards and lanes; levers in the Structures section; 0105 amended | 1. 👀 Zoom 10 over a village in a forest: worn ground under all of it, a lane to every door, no tree in it. 2. 👀 Revealed only, it is greyed with its village; unknown, it is not there |
| 14 | **Roads, pure, first half**: the graph and the course, the bridges and the ends | The checks on made grids: never over open water; a river crossed only by a bridge on an axis; a river joined at its corners never slipped through; two roads merging into a trunk |
| 15 | **Roads, pure, second half**: the shape and the records | The checks: the ends meet after a round trip through the records; smoothing never crosses water; the same roads in any order |
| 16 | **The bake**: `world:roads`, its world step, the architecture page, the skill, RUNNING, AUTHORING-THE-WORLD | 1. 👀 `world/painterly/roads/`: roads between the villages and in by their streets, to the ruins' gates, bridges straight across the rivers. 2. The report: how much road, how many bridges of each kind on each axis, the sites no road reaches, the roads entering a building (none), how long it took |
| 17 | **The roads on the wire**: `roads` in `STAND_LAYERS` at both ends, the protocol's version up with its recording and a fixture; the gateway's tests; the page keeping the layer; the World section counting the settlements | 1. 👀 The debug panel's Scenery section: road tiles held, more as ground is revealed. 2. 👀 The World section: settlements raised, passed over and left without a site |
| 18 | **Roads worn in**: `sprites/ground/roads.ts`; their width and colour as levers | 1. 👀 Zoom 8 to 10 near Dantzic: roads between the villages, down a street, to the ruin's gate. 2. 👀 A road stops where the revealed ground stops. 3. 👀 A road through a forest is a clear way |
| 19 | **Bridges**: `PixiSpriteRenderer.ts` shorter first, then `sprites/bridges/` | 1. 👀 A crossing in each of the eight directions, each named on an inspect page: at zoom 10 the bridge meets its road head on. 2. 👀 The trees on the banks in front of it and behind it as they should be |
| 20 | **The house bots yield**: no seat near a site or a road; 0108 amended; LOOK-AND-FEEL; the ROADMAP | 1. The checks: on the real master, no bot's seat near a site or a road. 2. 👀 After a wipe, no castle on a village or across a road |

Then it is brought to main.

## Not in this plan

- A house taking a settlement, and what a settlement gives whoever holds it.
- A house building a road, a toll at a bridge.
- Roads seen further out than zoom 7.5 on the painted map.
- The ground and the old streets inside a ruin.
- Boats moving, and people on the roads.
- Settlements from real data of 1790, which `world-generator.md` leaves for when the map settles.
