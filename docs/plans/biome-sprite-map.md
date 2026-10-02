# The biome sprite map

**What belongs here:** how the world's scenery is decided — what a biome is, what a stand is, what the
generator writes, and the order it gets built in. **What does not:** how a sprite is drawn once it has a
place, which is decision record 0052; what the machine will take, which is experiment 0006; the layers of
human geography this does not build — settlements, ways, worked ground, marks of time — which stay in
`world-generator.md`; what the world is as fiction (`SETTING.md`); or how the master is painted
(`AUTHORING-THE-WORLD.md`). This is the first two layers of the world-generator, taken out and made
buildable. When a part of it is decided, that part becomes a decision record and leaves.

---

## The problem, in one paragraph

Experiment 0006 proved the browser will draw sixty thousand pieces of scenery at once, and found the
budget by Adam's own hand: **a point every 1.5 world units, about 0.44 to the square unit, is the upper
bound**. Decision record 0052 settled how each one is worked out. What neither did was make it look like
anything. Three crude kinds on one untuned weight table, keyed to the terrain class alone, scattered on
an even grid, is wallpaper, and the eye reads it as wallpaper in about two seconds. Adam's words for what
is missing: a forest should be **a clustering of tree sprites**, so that it can be shaped to fit the
painted pixels; and a fern should be **numerous in one kind of place and rare in another**.

## The three layers, and only two of them are files

| | resolution | where it lives | size |
| --- | --- | --- | --- |
| **Terrain class** | 1 world unit | already cut, `tiles/7/x/y.png` | — |
| **Biome** | 16 world units, about 20 km | `sprites/biome/biomes.png`, one indexed PNG in world space | under a megabyte |
| **Stand** | a disc, 4 to 40 units across | `world/stands/<name>/biome/<x>/<y>.bin`, one chunk per zoom 7 tile, read by the game server alone since 0067 | 4 to 16 MB a master |
| **A sprite** | — | `hash2`, in the browser, stored nowhere | nothing |

**A stand says where the texture is. The master says where the forest is.** A stand is a disc, but a
point inside it only becomes a sprite if the terrain class *under that point* is one the stand's mix
allows. So a wood's outline is exactly the outline Adam painted, and what varies inside it — thick here,
a clearing there, birch at the margin and spruce in the middle — is the stands. That is the whole answer
to "so the forest can be shaped to fit pixels", and it is why the stands are discs and not polygons.

**A biome is a region with a character, not a second opinion about the ground.** It never overrides the
terrain class. It chooses which kinds grow on that class *here*, and how numerous each one is. That is
what makes two mixed forests a thousand miles apart two different forests rather than the same one twice.

### Why the file holds stands rather than stems

There are **159 million square world units of ground that grow anything**, measured off the master rather
than guessed. At the ceiling that is seventy million sprites; even at a quarter of it, seventeen million.
Written out one row at a time that is 70 to 420 MB a master, and 30 to 115 KB on the wire for every tile
the map loads, on top of the terrain tile it already fetches. Written as stands it is **four to sixteen
megabytes a master and a few kilobytes a tile**, and it rebuilds in under a minute when Adam repaints.

Every sprite is still *decided* by the file. It is simply not *listed* in it. This is the same trade 0052
made and for the same reason, moved up one level: what has a reason is written down, and what has only a
texture is derived.

## What the prior art says

Researched rather than assumed, because the obvious answer is the one that looks wrong.

- **Uniform scatter reads as wallpaper from above.** Williams and others (*Virtual Forestry Generation*,
  CGVC 2019) put three placement methods in front of people: naive uniform, an iterative clustering
  method, and a plant-competition simulation. Uniform scored best for *playability* at ground level; the
  **clustering method was rated the most realistic**, and the competition model best **from an aerial
  view**. Ours is an aerial view.
- **Clustered point processes are the standard model for it.** A Neyman–Scott process draws parent points
  from a Poisson process and scatters offspring around each one — uniformly in a disc (Matérn) or with a
  Gaussian spread (Thomas). That is exactly "a forest is a clustering of trees", it is two hashes deep,
  and it is what a stand is here.
- **The knobs the industry actually exposes agree with each other.** RimWorld gives a plant a
  `commonality` *per biome*, a `wildClusterRadius`, a `wildClusterWeight` and a `wildOrder`. Unreal's
  procedural foliage gives it an average spread distance, a spread variance, a collision radius, a shade
  radius, and whether it may grow in shade. AutoBiomes gives each asset "clustering probability, shadow
  tolerance or repelling distance". Three systems, five properties, and the kind table below carries
  those five.
- **Place the big things first.** AutoBiomes sorts assets into size categories and places them in order,
  so the small ones see the big ones already standing. We have this nearly for free: 0052's **rank**
  already decides what a thinner scattering keeps and what arrives first as the camera comes in. Giving
  rank a meaning instead of a random number is the cheapest improvement in this document, and it also
  attacks 0006's worst measurement — 42,087 particles held to draw 410.
- **A biome is a lookup table.** Whittaker's temperature against precipitation is what Dwarf Fortress and
  Minecraft use. AutoBiomes discretises it into a table and then **distorts the border with noise at a
  finer resolution than the biome grid itself**, which is how a biome edge stops being a staircase. We do
  the same, except that our moisture axis is largely answered by the class Adam already painted.
- **Do not simulate an ecosystem.** Deussen and Beneš both get the most plausible results from competition
  and self-thinning simulations, and Beneš reports **over two hours for five hundred thousand plants**. We
  have 159 million square units. Take the shape of the output, not the method.

## The files

### `world/biomes.json`, hand-edited, the way `world/painterly.json` is

The one file in this that is taste, and therefore Adam's. Validated by a pure `biomeProblems()` in
`packages/world/src/biome.ts`, called both by the generator before it does any work and by a test that
reads the real file off disk — the pattern and the reasoning are already in `painterly.test.ts`, and they
are the same here: *a hand-edited JSON that nothing typechecks costs a five-minute run or an empty world
in the browser, and either is worse than a failing test.*

```jsonc
{
  "kinds": [
    { "name": "pine", "groundHeight": 1.5, "vary": 0.25,
      "order": 8,             // big things first: biases rank, so it arrives first coming in
      "gather": 0.9,          // 0 loose over the ground, 1 only ever inside a stand
      "apart": 0.8,           // nearest another of its own kind may stand, in world units
      "underCanopy": false }  // may it stand under a taller kind
  ],
  "biomes": [
    { "name": "boreal", "colour": "#2d4a38",
      "where": { "warmth": [0, 25], "region": ["north", "any"] },
      "stands": { "per1000": 9, "reach": [6, 18], "inside": 0.30, "outside": 0.04 },
      "grows": {
        "taiga":      { "pine": 10, "spruce": 8, "birch": 2, "snag": 0.3 },
        "taiga-open": { "pine": 4, "birch": 5, "heather": 6 },
        "bog":        { "heather": 8, "snag": 1, "reed": 2 }
      } }
  ]
}
```

`grows` is keyed by **terrain class name**, and its numbers are commonality: a weight rather than a
probability, so adding a kind does not mean renormalising the others by hand. A class absent from a
biome's `grows` grows nothing there, which is how ocean, ice and rock stay bare without a rule saying so.

### `masters/<name>/sprites/biome/map.json`, the manifest, written last

The same contract `tiles/cut.json` already has: an ISO `at` that the Debug map compares against when the
master was last saved, so a sprite map made before the last repaint says so rather than looking current.
It is written last of all, because a manifest written first would claim a world that is not finished.

```jsonc
{ "master": "terrain", "layer": "biome", "at": "2026-09-21T...",
  "biomes": ["none", "boreal", ...],     // the index is the byte in biomes.png
  "kinds":  ["pine", "spruce", ...],     // the index is the byte in a stand's mix
  "mixes":  [ ... ],                     // the resolved per-stand weight tables
  "stands": 812443, "chunks": 3117, "bytes": 6499544,
  "density": { "worst": { "view": "islands", "perUnit": 0.31 }, "ceiling": 0.44 } }
```

### The stand chunk: eight bytes a stand

One file per zoom 7 tile that has any stand touching it, at the same `<x>/<y>` address the terrain tiles
already use. A stand straddling an edge is written into every tile it touches; at a mean reach of ten
units against a 256-unit tile that duplicates under a tenth of them, and it buys the rule that **a cell
never needs a neighbour's chunk**.

| bytes | |
| --- | --- |
| 2 | `x`, signed, eighths of a world unit from the tile's left edge |
| 2 | `y`, signed, eighths of a world unit from the tile's top edge |
| 1 | `reach`, quarters of a world unit, so up to 64 units |
| 1 | `mix`, an index into the manifest's `mixes` |
| 1 | `thickness`, points to the square unit, times 255 |
| 1 | `seed`, so two stands of the same mix are not the same stand |

`--readable` writes one named chunk as JSON beside the stands, so the truth can be opened and read.

**No sprite map, no sprites.** A master whose `sprites/biome/` does not exist draws nothing at all, which
is the whole of the rule. A later layer — settlements, ruins, whatever comes — is another directory
`sprites/<layer>/` with the same three files and the same rule, and nothing about this one has to change
to admit it.

## The generator

`npm run world:sprites --prefix frontend -- [master.png] [--layer biome] [--readable] [--out dir]`,
reading its arguments with `bin/lib/flags.ts`, as every other bin script does, with its paths in
`bin/lib/paths.ts`. The algorithm lives in `packages/world/src/biome.ts` and `src/stands.ts` as pure
functions, because `packages/world/src/**` may not touch `node:` — only `bin/` does file IO.

1. **Read the master.** `readMaster` in `bin/lib/master.ts`, the one every tool shares, inside a function
   so that the two gigabytes of RGBA pngjs hands back can be collected before anything else starts. About
   eight seconds.
2. **Two fields**, at master resolution, a chamfer pass each. `depth`, the distance to the nearest pixel
   of a *different* palette group, which is how far into this kind of ground you are; and `toWater`, the
   distance to any water class. The first is what puts scrub at a wood's margin and spruce in its middle;
   the second is what puts reeds by a lake.
3. **The biome**, onto a 2048 by 2048 raster **in world space**, so that the browser can address it
   without converting anything. `warmth` comes from the latitude of the master row, with a lapse for the
   `high` group; `wet` from `toWater` and what is around; `region` from a low-frequency noise field at
   two scales; and then the `where` lookup in `biomes.json`.
4. **The stands.** Per biome, parents on a jittered grid at that biome's `per1000`, a reach hashed from
   its range, placed **largest first** and dart-thrown against the ones already down, so they overlap
   without piling up. A stand whose middle is on ground its biome does not grow is dropped.
5. **Check the budget before writing anything.** Integrate the expected points to the square unit over
   each of the six painterly views and over the world, and print them against 0.44. A generator that
   quietly exceeds the ceiling is the one failure here that would cost a whole evening.
6. **Write** the chunks, then the raster, then the manifest.

## What changes in the browser

**0052 is extended, not superseded.** Every point is still a pure function of the world-space grid point
it stands on, still hashed with `hash2`, still stored nowhere, still cut into 32-unit cells that are a
cache and nothing else. What changes is what that function asks the ground.

- A new `spriteMap.ts` holds a memoised promise for the manifest and the decoded biome raster, and an LRU
  of stand chunks keyed by tile — modelled on `terrainClasses.ts`, down to its habit of naming the
  command to run when the file is missing.
- `scatter.ts` reads, for each grid point: the biome at the point, sampled through a small noise offset so
  that a biome edge wanders rather than steps; the stands covering it; the kind drawn from the stand's mix
  or, outside every stand, from the biome's thinner one; and the point dropped unless the terrain class
  there permits that kind. `rank` stops being a bare hash and carries the kind's `order`.
- A cell contributes nothing until **both** its terrain tile and its stand chunk are in hand. That is
  0022's rule and it does not bend.
- `kinds.ts` goes. The kinds come from the manifest.

### The kinds

Sixteen, drawn in Pixi `Graphics` into the one atlas exactly as the three are now: no art files, no new
dependency. At about 1.2 kilometres to a world unit each one is a symbol for a couple of kilometres of
something rather than a plant, which is the same admission 0052 already makes about a pine.

| | | | |
| --- | --- | --- | --- |
| pine 1.5 | spruce 1.7 | birch 1.3 | oak 1.9 |
| beech 1.8 | palm 1.6 | jungle crown 2.1 | acacia 1.4 |
| mangrove 1.0 | dead snag 1.2 | scrub bush 0.9 | heather 0.5 |
| grass tuft 0.7 | reed 0.6 | boulder 0.8 | cactus 0.9 |

## Where it is looked at

- **A `biome` renderer** in the Debug map dropdown, beside `Raw` and `Vivid`: the biome raster painted
  flat at any zoom. It reviews the biome on its own, before a single sprite has moved, and it is the
  cheapest instrument in this document.
- **A generate button** beside `cut it`, with a "last generated, master saved since" line, spawning the
  generator from the dev server and streaming its output into the debug log — the same shape the cut
  button already has, for the same reason (0025).
- **The Scenery section replaced.** Its own header says it is experiment 0006's stress levers and not a
  part of the game. It becomes the generator's readings: the biome under the camera, the stands in view,
  the points to the square unit against the ceiling, and the density dial kept.
- **Stills**, reusing the six views `painterly.json` already names — `world`, `scandinavia`,
  `sahara-shore`, `alps`, `islands`, `close` — so that a change to the generator is argued from a picture
  rather than from a claim.

## The order it gets built in

A menu rather than a queue, one commit each.

| | what it produces |
| --- | --- |
| **0** | this document, the rewrite of `world-generator.md` on leaning on the real world, experiment 0007 |
| **1** | `world/biomes.json`, `src/biome.ts` with its validator and a test over the real file, a still of the world's biomes |
| **2** | `bin/generateSpriteMap.ts` writing the raster and the manifest, and the `biome` renderer in the dropdown |
| **3** | the two fields, the stand placement, the chunks, and the budget report |
| **4** | the browser reads it, and the Scenery section is replaced. **The look changes here for the first time** |
| **5** | the sixteen kinds, and `biomes.json` tuned against the stills |
| **6** | the generate button, `debug-quick-start.ps1` taught the new output, and the generator run against all three masters |

One to three change nothing a player sees and are judged from stills and numbers. Four is the one that can
go wrong quietly, and **its verification is the zoom 6 check, not the zoom 10 one**: 0006's hardest finding
is that the cost is worst when the camera is far out, which is the opposite of the intuition.

## What this does not do

Settlements, ways between them, worked ground and marks of time stay in `world-generator.md`. So does the
unfinished far end of 0051's handoff: the canopy treatment is a constant 3.2 screen pixels in brush space
and does not resolve into anything, so a wood still has no far-out form. Fading a group's `amount` out
over the band the scenery fades in is one number through `preparePainterly`, it is named in 0052 as the
next step, and it is a better half-hour than anything in increment 5 — but it is not this.
