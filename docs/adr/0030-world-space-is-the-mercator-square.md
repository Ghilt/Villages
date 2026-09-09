# 0030. The paint's world space is the Mercator square, not master pixels

- Status: accepted
- Date: 2026-09-09
- Corrects the world-space half of 0021's two coordinate spaces, and keeps the rest of it

## Context

Decision 0021 named two coordinate spaces and said that keeping them apart "is the substance of the
design". It defined the first of them like this:

> **World space** is master pixels, so a distance in it is a distance on the ground.

Both halves of that sentence were wrong, and the two callers of `paintPixel` disagreed about which.

The offline renderer passed a true master row, `((90 - latitude) / 180) * 16384`. The browser's painter
passes `(tileY * 256 + row + 0.5) * masterPerPixel`, which at the zoom the tiles were cut is a row of a
32768 by 32768 Web Mercator square. For the same place those differ: the equator is 8192 offline and
16384 in the browser, and sixty degrees north is 2731 against 9516.

This was not harmless, because world space is what `boundary.wander` displaces along, what
`boundary.scale` sets the wavelength of, and what the neighbour probe `edge.reach * masterPerPixel` is
measured in. All three are non-zero in all five shipped styles. So the wander and the edge detection had
a different ground scale in the map than in the stills, by 1.4 times at forty-five degrees and 2 at
sixty, and it grew from there. `world/painterly.json` judges its styles on views named `scandinavia`
(54 to 71 degrees) and `close` (about 59), which is squarely inside that.

0021 also made the stills the way the look is agreed, and said the offline renderer "paints in Mercator
only so its output can be held against a screenshot of the running map". While the two disagreed about
world space that comparison was not sound, and an afternoon spent tuning wander or reach against the
stills did not transfer to the map.

The claim about the ground was independently untrue. The master is equirectangular, so a master pixel is
about 1223 metres tall everywhere and 1223 * cos(latitude) metres wide: 1.2 km by 1.2 at the equator and
1.2 by 0.6 at sixty degrees. No distance in master pixels was ever a distance on the ground.

## Decision

**World space is the Web Mercator square the map is drawn on, as many units on a side as the master is
wide.** One unit is one pixel of a tile at the zoom the tiles were cut. The browser was right and is
unchanged; the offline renderer and the documents are what move.

- A unit is the same in both directions. That is the property the treatment actually needs: a boundary
  wanders as far north as it does east, and the neighbour probe is a round cross rather than an oval.
- What a unit is worth on the ground is **not** fixed. It shrinks with latitude as `cos(latitude)` does,
  from about 1223 metres at the equator to 611 at sixty degrees and 418 at seventy.
- `masterRowsAt` in `packages/world/src/tiles.ts` is the one place the rule lives, next to the
  master-to-Mercator conversion that tiling already needed, and `sourceRowFor` is now expressed through
  the same arithmetic. Whatever paints from the master goes through it. The browser needs none of it,
  because it reads Mercator tiles with Mercator coordinates.
- A test in `tiles.test.ts` walks every one of the 32768 rows of the cut world and asserts that the row
  the offline painter reads is the row the tiler took that tile pixel's class from.

Brush space is untouched, and so is everything 0021 said about it. `masterPerPixel` was already the same
number in both callers, because both are linear in longitude and both grids are 32768 wide.

## Consequences

The stills are evidence about the map again, which is the whole point of having them, and `wander`,
`scale` and `reach` mean one thing rather than two.

**Every image in `world/painterly/` is stale away from the equator, and the five styles' numbers were
tuned against the old vertical scale.** They are unchanged here, deliberately: this decision is about
making one space true, and what the numbers should be is a matter for the eye. Re-paint, look at
`scandinavia` and `close`, and expect the wander to read as finer than it did, because it is no longer
being stretched about twice vertically at those latitudes.

Choosing square over constant-scale is a real trade and worth stating as one. A projection can be
conformal or equal-area, not both, and Mercator is conformal: a brush mark that is round on the ground
there is also round on the screen. The alternative buys a mark that covers a fixed number of metres and
pays for it with one that is visibly an oval at latitude, on the screen where the look is judged. For a
treatment, round wins.

One difference between the stills and the map survives this and is not a defect of it. The offline
renderer always reads the master at full detail, while the map reads a coarser ancestor tile below zoom
seven and the same tile stretched above it. So a still of a wide view carries terrain detail the map
does not have there. That was true before and is unrelated to world space; it is worth knowing when a
wide still looks crisper than the screen.

## Alternatives considered

- **Move the browser to master pixels instead.** It would need an inverse Mercator per pixel to place
  itself, its terrain lookup would stop being a scaling of its own tile coordinates, and it would buy an
  anisotropic space in which a round mark is an oval. It also makes the deliverable follow the tool.
- **Keep both, and scale the style numbers by latitude in one of them.** A correction factor to remember
  in two places, and it cannot work anyway: a still spans latitudes, so there is no one factor.
- **Make `boundary.wander` and `edge.reach` metres, and divide by the ground size of a unit.** Honest,
  and it answers a question nobody asked. It would give a wander that is a fixed size on the ground and
  therefore a visibly varying size on the screen, which is the thing to avoid.
- **Edit 0021 rather than write this.** Against 0010: records are superseded rather than edited, and here
  the wrong sentence and why it was wrong are the useful part of the record.
