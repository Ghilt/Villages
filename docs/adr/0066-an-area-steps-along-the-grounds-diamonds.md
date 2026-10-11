# 0066. An area steps along the ground's diamonds, and counts them

- Status: accepted
- Date: 2026-09-27
- Amended 2026-10-02: **the stills are painted on the same diamonds.** `world:paint` and `world:scenery`
  called the painter without a lattice, so every still since this was decided had been painted on the square
  one while the map was painted turned: the pictures a look is judged from were not the map. The lattice is
  `GROUND_LATTICE` in the world package now, which the camera and both tools read; the flat stills stay
  square, as `raw` draws. Found by the review of that day.
- Amends 0032: the fence and the census move from the master's pixels to the ground's diamonds, and
  everything else 0032 decided stands on the new grid
- Follows 0060, whose cell size this settles at one world unit

## Context

Since 0060 the ground's colour is read on a grid turned twenty-six degrees, and since experiment 0011 the
camera tips back as it comes in, to forty-five degrees at the closest zoom. The ground is drawn in turned
diamonds, and they tip with the camera.

An area did not follow. Its layers are MapLibre's, so they tipped with the camera, but its fence stepped along
the master's own pixels, which are square to the world's axes. On the tipped, turned ground the staircase ran
square to the screen while every edge of the ground ran along diamonds, so an area read as stuck to the glass
rather than lying on the ground. Adam sent a screenshot of exactly that, and asked for the area to go with
the transform the ground goes with.

Asked what an area should count once it steps along the diamonds, Adam set the ground's cells to size one
and said an area always goes on the finest grid there is. A diamond at size one is one world unit. World
space is the Mercator square, as many units across as the master is wide (0030), so a diamond is exactly as
wide as a master pixel. Mercator stretches north to south away from the equator, so at Mordaunt's latitude
a master pixel is drawn about one and a half diamonds tall. The diamonds are the finer grid, and they are
the grid the ground is actually painted on.

He also called the holding what it is, a placeholder. He asked for one contiguous patch about the seat, the
same size as before, with a more random and jittery edge.

## Decision

**An area is fenced on the ground's diamonds and counts them.** The grid is world space cut into squares one
world unit across and turned as far as the ground's grid is turned (`DiamondGrid`, `diamondLattice`). It is
always the finest: the size the ground's cells are painted at never changes it.

- **One arithmetic for both.** `lattice.ts` holds the four functions into the turned grid and back out,
  and both `onLattice` in the painter and the fence in `area.ts` go through them. The diamond a place is in
  is the one whose middle the painter reads its colour at. A test holds the two to each other on several
  turns, and it was broken once on purpose to prove it bites. The painter's own reads are bit-for-bit what
  they were, checked over 120,000 of them on six grids.
- **Everything 0032 bought still holds.** Every edge runs along the grid and falls between two diamonds, so
  a diamond is inside or outside, two areas drawn flush share one lattice line, and the line on the screen is
  where the count changes. `fenceAround`, `enclosedBy`, `insideFence`, `fenceSize` and `fenceWindow` are
  unchanged integer geometry; a turn is a rotation, so a ring still goes round the way it did.
- **The fence carries its grid.** Drawing it (`fenceToPolygons`), asking whether a place is inside it
  (`insideFenceAt`, for a click and for a seat in a window alike) and counting it need no grid handed in. A
  new area takes the ground's turn of the moment. One already drawn keeps the grid it was drawn on.
- **The census reads each diamond at its middle**, out of the zoom 7 tiles, floored to the tile pixel as
  the painter's own sampler floors it. That is the read the painter makes once the map is in past zoom six
  and a half, so what is counted is what is painted. World space is already Mercator, so no row of it is
  projected any more.
- **The world's edge is diamonds, not clamps.** A drawn path is taken where the hand put it, and only the
  diamonds lying wholly on the Mercator square are kept. No vertex can then pass longitude 180, which a
  map's tiler copies onto the far side of the world, or the Mercator limit, which it flattens.
- **A holding is a ragged patch.** `areaAround` takes the diamonds whose middle lies within a reach of the
  seat, round on the ground as the fog's circles are. With a `Roughness`, that reach wanders in and out on
  the way round and each diamond's distance is jittered, seeded by the house so every screen draws one shape.
  Then only the piece joined edge to edge to the seat's own diamond is kept, and anything it closes round is
  filled. It is always one piece, with no holes and no corner it only touches. The holding's reach is 25
  world units, which is as much ground as the old round one had at Mordaunt's latitude. Its lumps are a
  quarter of the reach and its jitter a diamond and a half. All three are named in `HoldingOverlay` as
  placeholders.

## Consequences

An area lies on the ground, turned and tipped with it, and its count is of the same diamonds the terrain is
seen in. A player can check it by eye.

**The numbers are diamonds now, not master pixels.** At Mordaunt's latitude a region holds about one and a
half times as many diamonds as it did master pixels. A holding is about 1,960 diamonds.

**The line lies on the diamonds, and the paint wanders about it.** On `vivid` and `plate` the diamonds are
crisp and the fence runs exactly along their edges. On `painted` and the other styles the edges wander 1.1 to
2.2 world units, which was a fray on four-unit cells and is more than a whole diamond at one. There the
ground's edges go soft and organic about the straight line of the fence, as experiment 0008 saw. Each
diamond's count is still the colour painted at its heart. That trade is a question of look and is Adam's; no
style number was changed for it.

**On `raw` the grid does not apply.** It draws the tiles as they were cut, square, whatever the grid is.
The Camera section's `squares` button puts the ground on the square grid, and then an area lines up with
`raw`'s squares exactly, better than it ever did with the master's rows.

**A turned fence has more corners.** Every edge that is not along the grid becomes a staircase, about two
vertices a diamond of boundary. That is nothing for a holding and seconds for an area the size of a
continent, which the census refuses anyway.

**A drawn area does not follow a turn made after it.** Only the debug panel can turn the ground, and areas
live only in the browser. Following one would mean keeping the hand's path as well as the fence, and 0032
keeps only the fence. A holding does follow, because it is worked out from the seat whenever it is drawn.

## Alternatives considered

- **Keep the master's pixels and count them, with the fence on the diamonds.** Then the edge cuts through
  master pixels, and a diamond painted as forest may count some grass. The count and the picture would no
  longer agree, which is the one thing 0032 was built to make impossible.
- **Fence on the ground's cells at whatever size they are painted.** That ties the count to a look, so
  the size slider would change what an area holds. Adam asked for the finest grid whatever the slider says.
- **Draw the fence smooth instead of stepped.** That hides the mismatch without mending it: the line would
  no longer fall where the count changes.
- **A holding round on the ground, not ragged.** It would have been the smaller change, and Adam asked for
  ragged. A circle is `areaAround` with no roughness, so either is one argument away.

## Amendment, 2026-10-11: the holding is a castle's influence zone

The ragged ground about every seat is no longer drawn at all times: it is the castle's influence zone, drawn only
while the castle is selected, seeded by the castle rather than the house, its reach the catalogue's `zone` for the
castle (25, as before). The lumps and the jitter are named in `InfluenceZone` now, still placeholders. See
docs/plans/structures.md, step 7b, and decision record 0093.
