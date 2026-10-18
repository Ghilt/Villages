# 0104. A ruined city is laid out by the page from its record

- Status: accepted
- Date: 2026-10-17
- Plan: `docs/plans/ruined-cities.md`
- Builds on 0103, which made every town of 1790 one stand of the `ruins` layer, and on 0052 and 0054, which place
  the scenery the same way: a pure function of the ground and the stands, stored nowhere

## Context

A town of 1790 reaches the page as eight bytes: a middle, how far its ruins reach, the culture they are built in, how
built-up its core was, a seed. Its ruins are hundreds of pieces for a great city and a handful for a hamlet, three
thousand towns over, the same for every player. Storing every piece would be storing a world nobody needs whole; the
scenery already shows the other way.

## Decision

**Every piece of a ruined city is worked out from its record and the terrain classes alone**, by `ruinsIn` in
`packages/world/src/ruinLayout.ts`, which the page and the scenery stills both call.

- **The town's own grid.** Lots `lot` world units square, turned by the town's seed to one of sixteen angles of a
  right angle - written out as numbers, so no engine's trigonometry is asked - unless its culture lays its towns to
  the four quarters, as the East Asian ones are. A lot strays from its place by the culture's jitter.
- **Blocks and streets.** Every so many lots a street a lot wide, so many by culture: four for a European town,
  three for an Islamic one, five for an East Asian one, two for an African one.
- **The outline.** Round, or square for a town of a culture that walls its towns square; ragged a block at a time.
- **What stands where.** In the core a block may be a landmark, a hall alone in its middle lot and an open square
  about it; a tower now and then; rows of houses and shells through the middle; rubble and lone shells at the edge;
  a wall on a ring near the outline where the culture walls its towns, with a gate where a street meets it, and only
  so much of it still standing; now and then an arch in a street.
- **How many.** A lot is kept by a roll against the town's fullness through the core, falling to the edge's share of
  it at the outline, and the debug panel's dial thins every town alike, a subset of what one draws.
- **The seed** is hashed from the record's middle, wrapped round the world, and its seed byte, so the copy of a record
  in the tile across the world's edge is the same town.
- **Never in water**: a piece is refused where its foot or either half of its width stands in water. A port's ruins
  stop at the shore, and a river runs through a city with nothing built in it.
- **Where towns meet**, a lot belongs to the town it lies furthest inside as a share of each one's size.
- **A piece belongs to the cell its foot stands in**, so the cells of a grid between them hold every piece once.

**The trees are thinned by the ruins after they are scattered**, by `furnishCell` in `packages/world/src/furnish.ts`,
which the page and the stills call for a cell's trees and its ruins together: no tree stands within a piece's half
width and `clear` of it, the pieces laid out at the full dial for this so a thinner drawing clears the same ground;
inside a town's built radius only `core` of the trees are kept at its middle, rising to `built` at its outline, by
each tree's own roll; beyond the outline the land's own woods grow among the outer ruins. The scatter itself is not
touched, so a cell with no town near it grows exactly what it grew.

The numbers - the pieces and how tall each stands, the layout, each culture's streets - are in `world/ruins.json`,
which `world:ruins` copies into the master's `sprites/ruins/map.json` for the page.

## Consequences

- Every record that could claim a point is in the chunk of the tile the point stands on, so a point on revealed
  ground is decided with every town that could own it, and what grows there never depends on how much of the world
  the fog has let through.
- Retuning the layout is a change to `world/ruins.json` and a second's bake; retuning its code needs no bake at all.
- A still is a plan of the ruins, each piece its footprint; what a piece looks like is the running map's business.
