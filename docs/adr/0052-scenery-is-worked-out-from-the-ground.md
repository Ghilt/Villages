# 0052. Scenery is worked out from the ground, never stored and never sent

- Status: accepted for the mechanism; what it draws is experiment 0006 and is not settled
- Date: 2026-09-20
- Builds on 0051, which gave a thing on the map its two forms

## Context

Adam asked what it would cost to populate the world — pines, oaks, grass, and seven more kinds — and
how much of it the browser will take before it lags. The world is the whole Earth, so the question
"where does each one stand" has no answer that can be written down: at one point every two world
units there are about two hundred and sixty million of them on land.

Three things were already true and shaped the answer.

**The terrain is readable from the browser.** `classesOfTile` hands back a zoom 7 tile as 65,536
terrain class ids, and at that zoom one tile pixel is one world unit exactly. The area census already
reads the world this way, so the scenery and the census cannot disagree about the same ground.

**0032 settled how a thing like this should work**, for areas: what an area encloses is worked out
from the fence whenever it is asked for, because an answer that changes with the camera is not a
property of the world. A carpet of trees wants the same rule for the same reason.

**0051 gave things two forms**, and scenery only needs one of them. A pine is a thing standing in the
world with no sign to stand for it far out.

## Decision

**Scenery is a pure function of the point of world space it grows on and the terrain there.** Nothing
is stored, nothing is sent, and nothing is authored.

- A **virtual grid in world space** at a spacing the panel sets. Each grid point is hashed for a
  jitter, a kind, a size and a rank. The hash is `hash2` from `@villages/world`, which the painterly
  treatment already uses, so the scattering and the paint agree about the same ground rather than each
  having its own idea of it.
- **A point's identity is its place on the grid, not the cell it was generated in.** Cells are a cache
  and nothing else, so cutting the cache differently draws the very same world. Tested.
- A cell is **32 world units**, and that is a constraint rather than a round number: a zoom 7 tile is
  256 world units, so an aligned cell never straddles two of them and needs exactly one tile.
- **A cell contributes nothing until its terrain is in hand.** 0022 is emphatic that ground the player
  is already looking at must not change under them a moment later; trees sprouting when a tile lands
  is that fault exactly, and worse, because a tile at least had a coarser version to stand in and bare
  ground has none.
- **Rank decides what a thinner scattering keeps.** Every point's rank is fixed for ever and thinning
  takes the lowest, so a thinner scattering is always a subset of a denser one and nothing is
  reshuffled when the density changes. It also spreads a kind's arrival over most of a zoom level, so
  a wood gathers rather than switching on.
- **Drawn as particles, placed in world units, with one transform for the whole layer.** Pixi has no
  per-particle scale: the size lives in the vertex buffer, which is static, so a layer scaled by
  `2 ** (zoom - 6)` and shifted once a frame moves twenty thousand pines for the cost of one matrix.
  Only the colour is dynamic, because the fade lives in its alpha. Particles come and go a cell at a
  time.
  > **Amended, 2026-09-25.** Still one transform, but it only scales and shifts now: a tipped camera's
  > turn and squash are stored in each particle's position, so the pictures stand up instead of lying
  > down with the ground, and the layer is drawn farthest first. See experiment 0008.
  > **Amended, 2026-09-25.** Points are also **spaced**: a candidate is dropped if one that arrives
  > earlier stands nearer than the mean of the two kinds' `apart`, a Matérn type II thinning. It asks
  > about candidates rather than survivors, so it stays a pure function of the ground near a point, and
  > a cell scatters a margin of its neighbours' candidates - off whatever tile they stand on - so the
  > spacing has no seam. The dial is decided after the competition, so a thinner scattering is still a
  > subset. See experiment 0012.
- Scenery is **not a `MapSprite`**. There are tens of thousands, none is a thing the game knows about,
  and none can be clicked — `ParticleContainer` has no bounds at all, so a click on a tree falls
  through to the map, which is what we want.

## Consequences

The world furnishes itself, for nothing on the wire and nothing on disk, and the same ground always
grows the same wood. Sixty thousand pines draw at once on this machine at the closest zoom, which is
far past anything we would ship; the numbers live in experiment 0006.

Two costs, knowingly.

**A pine is a symbol for a wood, not a tree.** One world unit is about 1.2 kilometres, so a pine of
one and a half units stands for a couple of kilometres of forest. There is no honest way around it at
this resolution and 0051 already says the same about a castle.

**The far end of the handoff is not built yet.** 0051 says scenery has no icon because the painted
terrain is its far-out form, and that is not yet true: the canopy treatment is a constant 3.2 screen
pixels in brush space, so it does not resolve into anything. Fading the group's `amount` out over the
same band the scenery fades in is one number through `preparePainterly` and is the next step, not a
change of mind.

> **Paid, 2026-09-23.** A group in `world/painterly.json` may now carry a `handOver`, and the forest and
> open groups of every painted style do: the treatment stands whole far out, gives way as the scenery
> arrives, and keeps a third of itself so that a wood is not bare between its trees. It is measured in
> `masterPerPixel`, which is the one thing the paint is ever told about the view. See decision record
> 0054 and experiment 0007.

> **Amended, 2026-09-25.** What a kind *looks like* is now authored: a picture in `world/sprites/scenery/`,
> cut into one atlas by `npm run world:art`. Where every piece stands is still worked out from the ground
> and stored nowhere, exactly as above. See decision record 0059.

Three kinds of the ten are drawn, and drawn crudely. **What this record settles is how scenery is
worked out, not what it looks like or how much of it there should be.** Those are the
**world-generator**'s, in `docs/plans/world-generator.md`, and the measurements behind them are in
experiment 0006.

## Alternatives considered

**Author the scenery.** Paint it into the master, or list it. Refused on size: a hundred million
positions is not a file, and every one of them would be wrong the moment Adam repainted a coast.

**Generate it in the painterly worker pool.** Tempting, because the pool already decodes the very
tiles this reads. It loses on the pool's own stated invariant — *a tile the map is actually waiting
for is never queued behind one that nobody has asked for* — which has no room for a third class of
work. It is also far cheaper than the message: a cell is a few hundred hashes, and a `postMessage`
round trip costs more. And the main thread already holds the decoded terrain, where a worker would
decode a second copy of it.

**Ordinary sprites rather than particles.** Simpler, and what the marks use. It loses at the count
this exists to reach: twenty thousand `Sprite`s each carry a transform, a bounds and a place in the
scene graph, where twenty thousand particles are four vertices in one buffer and one draw call.
