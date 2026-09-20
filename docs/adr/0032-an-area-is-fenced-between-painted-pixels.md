# 0032. An area is fenced between painted pixels, and counts them

- Status: accepted
- Date: 2026-09-09
- Amended 2026-09-20: **area is the technical term**, and the flavour has left the code. The circle
  a house's ground was drawn as lived in an `influence.ts` of its own, called `influenceZoneAround`,
  which named one use of it in the one place that should have named none. It is `areaAround` in
  `area.ts` now, beside the rest of the component, and what a given area *means* belongs to whatever
  draws it: a **Holding** today, a castle's influence zone later. The geometry did not change.

## Context

The world is painted by hand as an image, one pixel a terrain class, and drawn from tiles cut out of it.
See decisions 0018 and 0019. Several things we know we want are a region of that world with a boundary:
an influence zone, a holding, territory, the reach of a neighbour. All of them have to answer the same
question, which is how much of what kind of ground the region holds.

Three things about that question force a decision.

The unit and the grid decide whose property the answer is. Counted on whatever tiles happen to be on
screen, the same region reports different numbers depending on how far in the camera was when it was
asked, which makes the number a fact about the camera.

A region drawn by hand is a wiggle of floating-point positions, and the ground under it is whole pixels.
Any rule that decides what becomes of a pixel an edge crosses is a rule that has to be explained, and it
surfaces twice: as a seam or an overlap where two regions meet, and as a line drawn somewhere other than
where the count changes.

The browser has no copy of the master. It has the tiles, zoom 0 to 7, and `world/paint.json`.

## Decision

**An area counts master pixels** - the pixels of `world/master/terrain.png`, the ones a hand paints - and
reads them back out of the zoom 7 tiles, which carry them exactly. The master is 32768 across and a tile
is 256, so zoom 7 is where a tile pixel is a master pixel; Mercator has at least as many rows to a degree
as the master everywhere, equal at the equator and more away from it, so `cutTile` copies there rather
than taking a majority. `mercatorRowOf` in `packages/world/src/tiles.ts` is the inverse of `sourceRowFor`
that finds a master row among them.

**An area's boundary is a fence: closed rings on the lattice between pixels**, every edge axis-aligned. A
hand-drawn path is rasterised once onto the master grid, and the pixels it took are traced back into rings
along their edges - the same walk `traceClass` does for a coastline. From then on the fence is the area.

That is the whole of the exactness, and it is bought with one pass. No edge passes through a pixel, so
there is no rule about a pixel an edge cuts. A pixel is inside or outside. Two areas drawn flush against
each other share their boundary on the same lattice line: none of their pixels are counted twice and none
are missed. And the line drawn on the screen is the line where the count changes, so what is counted is
what is seen.

**The fence is the only thing kept.** What it encloses, what terrain that is, and whether a place is inside
it are worked out from the fence whenever they are asked for, so a repainted world or a moved edge means a
fresh answer rather than a stale one.

`fillPolygon` is left exactly as it is: its rule is baked into every coastline of the generated world and
moving it would move them. `enclose` states the same rule again in pixel coordinates over a window, so
that a county does not allocate a world to be counted in, and a test holds the two to each other.

## Consequences

The numbers belong to the area and the world. The same area reports the same census whatever the camera is
doing, and it can be drawn at any zoom, because zoom never enters into it.

A fence is a staircase. Below zoom 7 a master pixel is smaller than a screen pixel and the staircase
cannot be seen; above it, the boundary lines up with the squares the terrain is drawn as, which is the
honest picture and the one that makes the count legible.

A fence has more vertices than the path that made it. Collinear runs are merged, which is lossless and
takes a rectangle a thousand pixels wide from four thousand vertices to five, but a diagonal stays a
staircase of corners. A blob the size of a county is some hundreds of vertices.

A census reads tiles, so it is capped, and an area drawn across a continent is refused with its size
rather than fetched for a minute. Past the edge Mercator can draw, above 85.05 degrees, there is no tile
row at all and those pixels cannot be counted; the census says how many it could not answer for.

We accept knowingly that an area cannot yet be edited vertex by vertex, and that a shape drawn smaller
than a pixel is given the pixel it sits in, as `fillPolygon` does, which is the one case where two areas
can claim the same pixel.

## Alternatives considered

- **Count on the tiles at the camera's zoom.** Cheapest by far, and the answer changes with the camera, so
  it is not a property of the area. Everything downstream would have to carry the zoom it was counted at.
- **Count on `terrain-lookup.png`,** the 2048 by 1024 grid `importMaster` already writes and nothing
  reads: one fetch and no tile plumbing. At about eleven kilometres a pixel, anything a player would draw
  reports nought to three pixels, which is not an answer.
- **Fetch the master itself.** Exact, and twenty-four megabytes, and it is not served to the browser.
- **Keep the drawn path and settle edges with a half-open pixel-centre rule.** Fewer vertices, and it puts
  a rule back exactly where the lattice had removed the need for one: the line would be drawn somewhere
  other than where the count changes, and a pixel centre landing on a shared edge would need a tie-break.
  Worth revisiting only if vertex counts ever become the thing that hurts.
