# 0001. Found a house

- Status: open
- Started: 2026-09-01
- Closed:

## Hypothesis

Founding a house is enough of an experience on its own. Given a map, a name and a banner, and no explanation of what
a house is for, a player will choose a place deliberately and stay to watch the ticker.

If that is wrong, the world needs something to do before it needs anything else, and the roadmap changes shape.

## Setup

The Phase 1 walking skeleton, sixteen increments, and nothing more: a map, a way to found a house at a chosen point, a
generated banner, one resource shown as a rate-based ticker, and the houses of other players appearing live. No
decisions beyond the founding itself, no second resource, no interaction between houses.

## What we will look at

The experience:

- Does the player pick a place that means something to them, or the first point they happen to click?
- Do they name the house, or accept whatever is offered?
- Do they stay after the banner appears, and for how long?
- Do they notice another house appearing, and does it change anything about how they look at the map?
- What does the founding feel like at low zoom, where a house is a dot rather than a banner?

The architecture, answered in passing rather than tested for its own sake:

- Does the path from command to sprite hold together: decide, append, subscribe, publish, consume, push, draw?
- Can the broker's routing key carry the cell through the library's own bridge, or do we publish by hand? Increment
  1.6 decides this, and the answer belongs in this file.
- How many houses can be in view before the sprite overlay stops being smooth?

## Observations

**2026-09-02, the sprite overlay (increment 0.12).** The hand-written projection agrees with the map's own
`project` to the pixel: horizontal offsets were exactly zero across eight seats, at zoom 4 and at zoom 10, after
panning and after zooming. Vertical offsets sat inside the 2.2 pixel idle amplitude, which is the breathing motion
rather than error, and varied over time per sprite as intended.

One real limitation: while the camera is *animating* under program control, sprites trail the ground by a few
pixels, measured at 4.3 during a fast programmatic pan and 1.9 during a zoom. It is zero once the camera settles.
The cause is that the map and the overlay draw on separate animation frames. Fixing it properly means drawing the
sprites inside the map's render pass, which costs a permanent sixty-frame repaint of the map because the sprites
always move. Left as it is, on the grounds that players drag the map rather than fly it, and that a house does not
need to be pixel-locked while the world is in motion. Revisit if the founding flight looks wrong.

**2026-09-02, the warped world (a side mission, not on the roadmap).** The question was whether a heavily warped
Earth reads as another world while keeping the recognition that made the setting attractive. It does, and more
strongly than expected. Parchment land on a dusty sea with no text at all, and coastlines pulled about by twelve
control points and a 0.42 degree wobble: Scandinavia is unmistakably Scandinavia and unmistakably wrong. Removing
every place name turned out to matter as much as moving the coast.

Three things learned that shape the work:

- The pull only reaches where a control point is placed. Sub-Saharan Africa still traces Earth exactly, because
  no control is near it. Warping the whole world means covering the whole world, or adding a global component.
- Natural Earth at 1:50m runs out at about zoom 7 and is visibly faceted by zoom 10. Either the maximum zoom
  drops, or 1:10m data comes in at roughly six times the size, or the faceting becomes a deliberate woodcut look.
- The placeholder seats are still at Earth's coordinates, so they no longer sit on the places they were named
  after. That is not a bug but it is a lesson: any real-world place we want in the game has to be carried through
  the warp once, which is exactly the mechanism the naming work will need.

**2026-09-03, fidelity and reach.** Two questions from looking at the first warped world: does it warp
everywhere, and can the lost detail come back?

The reach was the real problem. Control points only move what they reach, so the first world was a warped
Europe attached to an unwarped Earth. Replacing the single wobble with three octaves fixed it: one at six
cells across the world drifts continents, one at eighteen reshapes regions, one at forty-eight roughens
coastlines. Every shore now differs from Earth's, and the twelve hand-placed controls remain for deliberate
moves.

Fidelity turned out to be cheap, because the warp is generic over GeoJSON: any vector layer costs a line in
the configuration and nothing else.

- Lakes: Natural Earth's European supplement adds 767 lakes, 137 of them inside Sweden alone, for under a
  megabyte. Sweden and Finland now read as lake country.
- Mountains: 711 named peaks with elevations, drawn as pictorial glyphs in the old-map manner rather than as
  shaded relief, sized by height and by how close the camera is. One layer for great ranges at world scale
  and one for everything above 1200 metres up close, because a single layer either crowds the world or
  empties the region.

What stays expensive is anything that is not vector. A hillshade or a satellite texture is a raster, and
warping a raster needs the inverse of the warp, which our forward function does not provide analytically. If
we ever want relief shading rather than drawn peaks, the way in is to turn elevation into vector contours
once, offline, and then warp those like everything else.

**2026-09-03, the round trip closes.** The master is read back, every pixel snapped to a class, each
terrain traced into outlines, simplified and smoothed, and drawn. Editing the image and seeing the world
change is now two commands and a reload.

Numbers worth keeping, because they are the dials:

- Traced at full resolution with no thresholds, the world came to 27,461 shapes and 32 MB, which is far
  too much to serve. Dropping shapes under about 140 square kilometres, simplifying by two pixels, and
  smoothing once instead of twice brought it to 8,550 shapes and 6.4 MB.
- Grassland alone had 32,491 specks dropped. That is a real finding, not noise: grassland is the fallback
  the base land layer is painted in, so every pixel where the ecoregion polygons fail to reach the Natural
  Earth coastline becomes a sliver of it. The world would be cleaner if those gaps were filled from their
  neighbours before tracing.
- Smoothed coastlines at 2.4 kilometres a pixel look good, which was the open question. Britain, Denmark
  and Gotland all read correctly, and no staircase is visible at any zoom the map allows.

Still open: 6.4 MB of shapes is a slow first load. The fix is vector tiles rather than one file, which is
a known, mechanical step and not needed until the world is being played rather than looked at.

**2026-09-03, cleaning the fringe, and three lessons.** The coastal slivers came from the base land layer
being painted in a real terrain colour, so every pixel where the biome data failed to reach the coastline
survived as that terrain. Painting it as an unassigned marker instead, and filling each such pixel from
the terrain its neighbours have, fixed it at the source. 172,225 pixels were unassigned; 170,100 took a
terrain from their neighbours, and 2,125 fell back, which are islands the biome data does not cover at all.

| | Grassland shapes | Grassland specks dropped | Total shapes | Size |
|---|---|---|---|---|
| Before | 1,173 | 32,948 | 8,559 | 6.43 MB |
| After | 282 | 3,369 | 7,529 | 6.00 MB |

Three things learned, in rising order of how much they cost:

- A rebuild must not overwrite hand-authored work. The master build now refuses, writes alongside, and
  says so. A three-way merge replays hand edits onto a freshly built master by applying only the pixels
  that actually differ from the base, so improving the generator no longer means losing a world.
- That merge immediately proved its worth as a diagnostic: it reported two edits where one was expected,
  and rendering the difference showed Scandinavia and the whole of southern Africa. Being able to see
  what changed between two masters is worth having for its own sake.
- **A single unprojectable coordinate silently destroys the entire world.** Antarctica traced to the very
  bottom edge of the image, giving four points at latitude exactly ninety south, which Mercator sends to
  infinity. The source then never loads, no layer draws, and nothing appears in the console: the only
  trace is an error event on the map object saying there is no tile manager for the source. Latitude is
  now held inside what Mercator can draw as the shapes are written. Worth remembering that a blank map
  with a working style means asking the map itself for its errors.

## Result

## Decision

## Follow-ups
