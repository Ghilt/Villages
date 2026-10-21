# Houses, bridges and the road render

**What belongs here:** the second round of the settlements and roads of `settlements-and-roads.md`, from Adam's notes
on its hand-over: a settlement becomes a cluster of ordinary structures with a name and a radius, the bridge becomes one
modelled picture in eight directions painted by asseterizer, and the roads become more, smooth, seen from further out
and dressed at their sides. How each is built, the rules that must hold, and the order. **What does not:** the words,
which are `GLOSSARY.md`; what it looks like in plain words, which is `LOOK-AND-FEEL.md`; the levers as they are in the
running program, which are `RUNNING.md`. When a part of it is decided, that part becomes a decision record and leaves.

Planned on 2026-10-21 from Adam's notes, after the first round reached main at 867e7c43:

1. *"All buildings should be normal structures. So they are all clickable. Define an area radius every village ->
   every structure inside that village becomes part of the village, and for now that just means that they have a link
   in their inspect window that links to the village as a whole."* A `house` structure, and villages with many houses
   and maybe some of the other buildings.
2. *"Is the bridge a sprite? It should be a sprite. Keep it simple and the same for all cultures."* A bridge modelled
   in 3D, then asseterizer paints over it; eight directions.
3. *"I want a road render, so I can see them all"* from far out; at least 95% of villages joined by a road to another
   village; no jagged edges; a roadside of small stone walls with moss, tufts and the like, fitting the biome.

### Settled with Adam (2026-10-21)

| Question | Answer |
|---|---|
| What a settlement is now | **A cluster of structures with a name**: its houses and the rest, and a radius the bake writes; everything standing inside the radius is part of it. Nothing is raised for the settlement itself. *"A settlement is something in the world, something that can be viewed in an inspect window"*: the inspect window shows the cluster as a whole, with no pane or word of its own for that |
| What fills it | **Houses, and buildings of the catalogue as it is**: many houses, a mill by a village's water, a market in a large village |
| The bridge's eight directions | **Eight axes, eight pictures**: the ground's four axes and the four halfway between them; one stone bridge for every culture |
| How far out the road render reaches | **Zoom 6**, as far out as the road records already come |

## The design

### A settlement is a cluster of structures with a name

- **The settlement is not a structure any more.** It is a cluster of structures with a name: the bake writes its middle,
  a radius by level, a kind (village or fishing village), a level and a name, and every structure standing inside the
  radius is part of it. Nothing is raised for the settlement itself and nobody holds it.
  `village` and `fishingVillage` leave the catalogue, so every world with settlements in it is wiped (pre-alpha, 0036).
- **Its buildings are ordinary structures**, raised at the opening as the settlements were, each held by nobody, a
  history of its own, clickable, with its own window: a new type **`house`** (the cottage, the barn and the chapel of
  the placeholders folded into it), a **mill** of the catalogue on a lot by a river or lake in a village and up, and a
  **market** of the catalogue on the green of a large village. A fishing village's huts become houses by the water.
- **The bake lays them out**: `settlementIn` runs in `world:settlements` instead of on the page, and the sites file the
  server reads gains each site's radius and its buildings (type, level, place). The page lays out only what is not a
  structure: the settlement's ground, its streets and green, and a fishing village's jetties, boats and net racks.
- **The opening raises every building** of every site the world lacks, under an id worked out from the site and the
  building's number, so no opening raises one twice; named by the settlement, *house in the village by the Vistula*.
  About seven a settlement on average, some fifty thousand in all: raised side by side, and measured.
- **A structure is part of the settlement whose radius holds its place**, whoever raised it: a castle founded inside a
  village's circle is part of it too. Worked out on the page from the settlements it holds; for now that is all it means.
- **The page learns the settlements from a stand layer**, `settlements`, sent through the fog like the ruins: a record a
  settlement, its middle in eighths, its radius in quarters, its kind and level, and the number of its name in
  `sprites/settlements/names.json`, which the page fetches once. One protocol bump.
- **On the map**: a settlement's structures stand among the trees together, as one thing on its square, so the draw
  cost stays one slice a settlement; further out than 7.5 they gather into one mark named by the settlement. A
  structure inside a settlement has a line in its inspect window, *part of the village by the Vistula*, a link that
  inspects the settlement itself in the same window: its name, kind and level, and every structure inside it the
  house has seen, each a link back. A click on the settlement's mark, or on its ground away from any building, inspects
  it too.

### The bridge, modelled once and painted by asseterizer

- **One stone bridge**, the same for every culture and every river: deck, parapets, arches on piers, a ramp at each
  end. Modelled in 3D and drawn by a small renderer of our own in the map's camera (parallel, turned 26°, tilted 45°,
  lit from 90/45, as asseterizer paints), along each of the **eight axes**: the lattice's U and V, its two diagonals,
  and the four halfway between (two along one axis for one along the other). `world/sprites/bridges/bridge-<axis>.png`,
  768 pixels on the long side, replacing the eight timber and stone placeholders.
- **The bake crosses on all eight**: a bridge run along a half-axis is a straight line like the others, checked unit by
  unit; the kind byte becomes one kind on eight axes; the roads are baked again.
- **The page stretches a bridge along its deck only**, so a long bridge is longer, never wider or taller.
- **It is a sprite**, as it was: a picture standing among the trees on the strip of its deck. The placeholder was a
  flat drawing, which is why it did not read as one.
- **Then asseterizer**: the renders are the block-outs, and a brief in `world/guides/bridges/` says what to paint.
  Once step 2 is committed a session in `E:\Code\asseterizer` is started to paint over the eight pictures where they
  are, in this tree, while the rest is built; what it paints is committed as a step's art once it looks right on the
  map, and is among what Adam verifies at the end. Asseterizer's own roots are the main checkout's `world/`, so that
  session says whether it can reach this tree's.

### The roads: more of them, smooth, seen from zoom 6, and dressed at their sides

- **95% of villages joined to another village.** Wherever the 90 km graph leaves a village with no other village in its
  network, it is joined to the nearest village by a road routed the same way, out to a far limit in `world/roads.json`.
  The bake's report counts the villages whose network holds another village, and says why each of the rest is alone:
  an island, nothing within the far limit, or no way through. Today 880 of 7,674 have no road at all.
- **Smooth**: the roads are drawn as shapes, not coloured diamonds. Every piece is a band with round ends, so bends and
  joins are smooth; its edges soft and worn; all the roads in view in one draw, under the trees, in the container the
  fog greys, clipped to revealed ground. From zoom 6 to 7.5 a thin line by grade; from 7.5 in the worn-earth band.
  The worked ground keeps its `road` kind only to keep the trees off, and off the roadside either side.
- **The roadside**: along both sides of every road from 7.5 in, small things chosen by the biome under them, by a
  seed, the same on every page: mossy dry-stone walls, tufts and ferns where it is green and wet; bare stone walls and
  dry tufts in the Mediterranean, the steppe and the desert's margin; mossy boulders in the boreal forest; lichened
  stones and cairns on heath, highland and tundra; lush tufts and broad leaves in the tropics. None on a bridge, in a
  settlement or on water. A wall is laid in stubs along the axis nearest its side of the road, a picture an axis. Drawn as one
  layer between the roads and the trees: low enough that drawing them under every tree is never wrong by more than
  their own height. Placeholder pictures first, cut into an atlas and shown on the inspect page; asseterizer later.

## The rules that must hold

| Rule | Held by | When |
|---|---|---|
| The same settlements, buildings, roads, bridges and roadside for every player on every tree | pure functions of the baked files and the world files; the cache's fingerprints | at once, by construction |
| Each building is raised once | its own stream: a name-based id, a second raise refused `AlreadyRaised` | at once |
| Every building of every site stands | the opening | a moment after: a server stopped mid-opening raises the rest at the next |
| A structure is part of at most one settlement | the bake keeps settlements apart: no two radii overlap (a test) | at once |
| Never a building, a road or a roadside thing on water | the bake's layout and roads, the page's roadside, all on the same zoom-7 tiles | at once |
| A river is crossed only by a bridge, on one of eight axes, both ends on land | a bridge run is the only way across; its axis is in its record | at once |
| At least 95% of villages have a road to another village | the bake's report says the share; below it, a line saying so | at every bake, reported |
| A road and its roadside are drawn only on revealed ground | the page's clip | at once |
| No tree on a road or its roadside | `growing.ts` | at every rebuild |

## Names

Adam, 2026-10-21: no vocabulary for what is only a way of looking at a thing. A settlement is a cluster of structures, a
thing in the world, and the inspect window shows it as a whole.

| Name | What it means |
|---|---|
| **Settlement** | Now a cluster of structures with a name, not a structure itself: a village or a fishing village at three levels, from a **Settlement site**, with a radius by level in `world/settlements.json`; every structure inside its radius is part of it, and the inspect window shows it as a whole |
| **House** | A structure type, the commonest building of a settlement; `house` in the structures' catalogue |
| **Roadside** | The small things along either side of a road, walls, tufts and stones, chosen by the biome; no tree grows there |

**No new events or commands**: a building is raised by `villages.structure.raised.v1` through `RaiseStructure`, its
type `house`, `mill` or `market`.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **docs**: this plan; decision record 0117 (a settlement is a cluster of structures with a name and a radius, raised building by building), 0114 marked superseded in that part; 0115 amended (one bridge on eight axes, roads drawn as shapes, the roadside); the names in the glossary; ROADMAP | 1. Decision record 0117: is its shape right? 2. The names above |
| 2 | **feat(build)**: the bridge in 3D: the model and its renderer, eight pictures, `/admin/inspect-structures` showing them, the brief in `world/guides/bridges/`. The page draws the four axes the roads use now. Then the asseterizer session is started | 1. 👀 `/admin/inspect-structures`: the bridge on its eight axes. 2. Is this the bridge for asseterizer to paint? |
| 3 | **feat(build)**: bridges on eight axes: the bake, the kind byte, the roads baked again; the page stretches a bridge along its deck | 1. 👀 A crossing on each half-axis at zoom 11 (links in the hand-over): head on to its road. 2. The report: bridges by axis |
| 4 | **feat(build)**: 95% of villages joined to another village: the graph, the report, the roads baked again | 1. 👀 `world/painterly/roads/`: the far roads. 2. The report: the share joined, and why the rest are alone |
| 5 | **feat(web)**: the roads drawn smooth, from zoom 6 in; the worked ground's road kind only keeps the trees off | 1. 👀 Zoom 10 where your picture was: smooth edges, round bends. 2. 👀 Zoom 6 with *see everything*: every road as a line. 3. What the zoom and the shaders cost |
| 6 | **feat(build)**: the roadside's placeholder pictures by biome, their atlas, `/admin/inspect-structures` showing them | 1. 👀 The roadside pieces by biome on the inspect page. 2. Is the list right before asseterizer paints it? |
| 7 | **feat(web)**: the roadside drawn along both sides of every road | 1. 👀 Zoom 10 on a temperate road: mossy walls and tufts. 2. 👀 A desert-margin road and a boreal one. 3. What the zoom costs |
| 8 | **feat(application)**: `house` in the catalogue, its pictures beside the structures' (the settlement pieces' house, until those go in step 12); Antarctica raises one | 1. 👀 `/admin/inspect-structures`: the house in four cultures. 2. 👀 Antarctica: a house, held by nobody |
| 9 | **feat(build)**: the bake lays each settlement out: radius and buildings in the sites file, the contract at both ends, the `settlements` records and their names file | 1. The report: buildings by type and level, and the time. 2. The checks: no two settlements overlap; every building on land |
| 10 | **feat(application)**: the opening raises every building side by side; `village` and `fishingVillage` leave the catalogue; the World section's tally; this tree's world wiped | 1. 👀 A wipe: the log's raising time. 2. 👀 The World section: settlements, buildings raised |
| 11 | **feat(protocol)**: the `settlements` layer on the wire, the version up with its recording; the page keeps it | 1. 👀 The Scenery section: settlements held, more as ground is revealed |
| 12 | **feat(web)**: a settlement drawn from its record and its structures: its ground and dress from the record, its structures standing together, one mark further out | 1. 👀 Zoom 9 near Dantzic: villages of houses, a mill by the water, a market on a large one's green. 2. 👀 Zoom 7: one mark a village |
| 13 | **feat(web)**: a settlement in the inspect window, and the link to it in a structure's, any component it lacks added to the library first in a commit of its own | 1. 👀 Click a house: *part of the village by the Vistula*, and the link inspects the village, listing its houses. 2. 👀 Click a village's own ground between its houses, or a boat or jetty of a fishing village: the same window, each house named by which way it stands from the middle (a settlement has no mark further out, as its houses have none). No new component: the window is the one every subject uses |

Then it is brought to main.

## Risks

- **The opening's time**: some fifty thousand raises where there were 7,674 in 78 s. Raised side by side, each
  building its own stream; measured in step 10 before anything else is built on it. If it is still minutes, fewer
  houses a level is the lever, and the read model's catch-up at a restart is measured too.
- **Draw cost**: one slice a settlement, as now; the roads in one draw; the roadside one layer of small sprites.
  Measured with `perf:zoom` and `perf:shaders` in steps 5, 7 and 12.
- **The wipe**: every tree that ran the first round's opening has `village` structures its code will no longer read.
- **Numbers taken while this is out**: the Vigil campaign's branch already holds a decision record 0114 and renumbers at
  its landing; the challenge spectacle takes 0116, so this plan takes 0117, and protocol 68, checked again at to-main.
- **Asseterizer** paints the bridge only once step 2 is on main.

## Not in this plan

Smoothing the settlement's own worn ground and its lanes; roads further out than zoom 6; ferries to islands; a house
taking a settlement, or what being part of one gives a structure.
