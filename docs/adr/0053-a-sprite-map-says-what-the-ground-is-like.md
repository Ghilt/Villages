# 0053. A sprite map says what the ground is like, and the scenery is still worked out from it

- Status: accepted
- Date: 2026-09-21
- Builds on 0052, which settled that scenery is a pure function of the ground and is never stored

## Context

0052 made every piece of scenery a pure function of the world-space point it stands on and the terrain
class there, hashed with `hash2`, stored nowhere. It works, and experiment 0006 found the budget: a
point every 1.5 world units, about 0.44 to the square unit, is what stays smooth in Adam's hand.

**What it cannot do is look like anything.** A hash knows nothing about its neighbours, so it can only
ever produce an even scatter, and an even scatter of pines is wallpaper — the eye says so in about two
seconds. Adam's words for what is missing are that a forest should be *a clustering of tree sprites*,
so that it can be shaped to fit the painted pixels, and that a fern should be *numerous in one kind of
place and rare in another*. Neither is a property of a point. Both are properties of a region, and a
region is exactly what a point-wise hash cannot see.

**Writing every piece down is not the answer, and the numbers say so.** The master's vegetated ground
measures 159 million square world units. At 0006's ceiling that is seventy million pieces; even at a
quarter of it, seventeen million. Listed one row each that is 70 to 420 MB a master, and 30 to 115 KB
on the wire for every tile the map already fetches. 0052 refused this once, on size, and the
measurement confirms the refusal rather than softening it.

**But something has to be written down**, because the two things missing both need more of the world in
view at once than a browser ever holds: which region this is, and where the clumps are.

## Decision

**A master may carry a sprite map: generated offline, read by the browser, and holding the shape of the
scenery rather than the scenery.** What is in it has a reason. What is only a texture is still derived.

- **A biome is a region with a character**, decided from four axes that are nought to a hundred —
  warmth from the latitude of the master row, wet from how near open water is, high from how much of
  the ground about is the palette's `high` group, and region from a slow noise field. The first biome in
  `world/biomes.json` that accepts all four wins, so the order in the file is the rule and the last
  entry is the catch-all. **A biome never overrides the terrain class**; it chooses which kinds grow on
  that class here and how commonly.
- **The warmth is swayed before it is looked up.** A master row *is* a latitude, so warmth taken
  straight off it drew every band edge as one dead straight line the full width of the world - the first
  thing the biome renderer showed, and nothing a boundary wander at the scale of a scenery point could
  soften. A slow noise field of a few warmth either side makes the edge wander about eighteen hundred
  kilometres, which is what a climate boundary does.
- **A stand is a disc of clumped scenery** — a middle, a reach, a favourite kind and a thickness. Its
  thickness falls off from the middle as `1 - t²` and **stands add together** rather than one winning,
  which is the intensity function of a Neyman-Scott cluster process and is what makes a wood lumpy. The
  middles are a Poisson process modulated by the biome. They are never pushed apart: two stands landing
  together is a bigger, thicker wood, which is a thing woods do.
- **A stand says where the texture is; the master says where the forest is.** A point inside a stand
  only grows if the terrain class *under that point* allows it, so a wood's outline is the outline Adam
  painted, to the master pixel, and only its inside varies.
- **The layer is a directory.** `masters/<name>/sprites/<layer>/` holds `biomes.png`, `stands/<x>/<y>.bin`
  and a `map.json` written last. **A master with no sprite map grows nothing at all**, which is the rule
  rather than a failure mode, and a later layer — settlements, ruins — is another directory with the
  same three files.
- **0052 is untouched.** Every piece of scenery is still a pure function of its grid point, still hashed
  with `hash2`, still cut into 32-unit cells that are a cache and nothing else, still stored nowhere and
  never sent. What changed is only what that function is allowed to ask.
- **A group is one kind at one step of its arrival, and a group is the unit of everything.** The zoom
  decides whether a group belongs on the screen and **time** carries it there over `PRESENCE_MS` - which
  is the rule `twoForms.ts` already states for a mark's two forms, and which scenery broke by fading
  across a band of zoom. A zoom is somewhere you can stop, so a fade in zoom left a screen of half-drawn
  trees for as long as you cared to look at it. Four steps a kind, so a wood still gathers as the camera
  comes in, and every one of those steps is a thing that finishes.
- **A particle exists only while its group does.** This is the same decision seen from the other side,
  and it is what makes pulling the camera back cheap: a point whose group has not arrived is not a
  particle at all, so the layer stops building a screenful of invisible furniture on the way out.
- **A cell contributes nothing until both its terrain tile and its stand chunk are in hand**, which is
  0022's rule applied to the second thing a cell now waits on.
- The generator **checks the budget before it writes anything**, biome by biome, against a `ceiling` in
  `world/biomes.json` - what a screenful may average. A single point is capped at a separate `most`,
  which is unrelated to the ceiling and allowed to sit under it, because a peak over a patch a few units
  across is not a screenful. `most` has a second job that makes it the more important of the two: **the
  browser cuts its grid at exactly that density**, so a `most` above what the file actually reaches is
  grid points hashed and then refused, on every cell, for ever.

## Consequences

The world reads as places rather than as wallpaper, for **five megabytes a master and a few kilobytes a
tile** — against the 70 to 420 MB writing every piece down would have cost. It regenerates in
twenty-five seconds, so a repaint is not a reason to avoid regenerating.

**The cost of pulling the camera back is gone rather than reduced**, which experiment 0006 named as a
follow-up and never fixed. Because a particle exists only while its group does, and because the layer
draws nothing at all below the zoom its first group arrives at, zooming out crosses one threshold and
then stops working entirely. Over Dalarna: 603 particles at zoom 10, four at zoom 7.6, and at zoom 7
**nought particles and nought cells**, where the old rule was still holding thousands it could not show.

Every kind also carries an `order`, and a point's rank is half its own hash and half that order, so the
big things arrive before the floor they stand on.

Three costs, knowingly.

**A second thing to regenerate.** `world:import`, `world:tile` and now `world:sprites`. A master that has
been cut but not furnished draws a bare world and says so in the panel, which is the least confusing of
the wrong answers but is still a state that exists. Two things reach it from the debug map: **cutting
furnishes too**, because a repaint makes both stale, and **furnishing alone** is its own button, because
a sprite map also goes stale when `world/biomes.json` is saved and no master has changed at all - which
is what tuning a look is, over and over. That second staleness is the one worth watching, and the panel
watches the file's own mtime for it.

**The paint now gives way to what stands on it.** 0051 says the painted terrain is scenery's far-out
form, and it was not: a canopy stipple is a constant few pixels of brush space, so it looked the same at
the zoom trees arrived as it had five zooms out. A group in `world/painterly.json` may carry a
`handOver` - two distances in `masterPerPixel` and how much of itself to keep - and the forest and open
groups of every painted style do. The `close` still moves by fifteen per cent of its pixels, worst by
fifteen of 255: quiet, which is what a handoff should be.

**Reviewing a biome needs its own renderer**, because a biome is invisible under the scenery standing on
it. `Biome` in the Debug map dropdown lays the raster on the world flat, through no painter and no
worker: the raster is already a Mercator square of the whole world, so MapLibre places it on the world's
own corners. Deliberately nearest-neighbour and deliberately blocky - the coarseness is the thing being
looked at.

**The browser's first binary fetch.** Everything else it reads is JSON or a PNG through a canvas. A
stand chunk is eight bytes a stand read through `arrayBuffer()`, and the encoding now has to agree in
two places — so both ends share `encodeStands` and `decodeStands` from `@villages/world` rather than
each writing their own.

**A biome is sixteen world units, and a stand is a disc.** Twenty kilometres is coarse for a boundary,
which is why the browser samples the biome through a wander so an edge does not follow the grid it was
stored on; and a circle is a crude wood, which is why the terrain clips it. Both are approximations
that the master's own outline hides, and both would have to change if the scenery ever stopped being
clipped by the class underneath it.

## Alternatives considered

**List every piece of scenery.** What Adam first asked for, and the honest answer was arithmetic: 159
million square units of growing ground, seventy million pieces at the ceiling, 70 to 420 MB a master
and 30 to 115 KB a tile on top of the terrain. Refused on size, as 0052 refused it, and refused again
now that the size is measured rather than guessed. Every piece is still *decided* by the file; it is
simply not *listed* in it.

**Derive the stands too, from a coarser hash.** Tempting, because it would cost nothing on disk. It
loses on what a stand is for: a stand wants to know how big the painted patch of wood it sits in is and
how far from its edge, which is a distance transform over 537 million pixels and not a thing a browser
does. It also gives up the seam that settlements and ways will need, which is the same seam.

**Throw darts at the stand middles**, so they never pile up. AutoBiomes does this for individual assets
and it is the right tool there. One level up it is wrong: it would make every wood the same thickness,
which is the fault being fixed.

**Simulate an ecosystem.** Deussen and Beneš both get the most plausible results this way, and Beneš
reports over two hours for five hundred thousand plants. We have 159 million square units. The shape of
the output was worth taking; the method was not.
