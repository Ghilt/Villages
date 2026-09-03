# 0018. The world is authored as an image, in an image editor

- Status: accepted
- Date: 2026-09-03

## Context

Decision 0017 made the world ours by warping Earth through a configuration file. Tuning that file turned
out to be the wrong way to author a world: twelve numbered control points are not how anybody decides
where a coast should run. What was wanted was visual control, including selecting a landmass, rotating it,
and copying it somewhere else, with one hard requirement: a region moved somewhere else keeps the terrain
it had. Copy Sweden into the Pacific and the island there is still Sweden's forest and lakes.

The alternative was to build a bespoke visual editor over vector data.

## Decision

The world is one indexed PNG, `world/master/terrain.png`, 16384 by 8192, unprojected, one flat colour per
terrain class. It is authored by hand in an ordinary image editor. The build paints a starting point from
real Earth data, and from then on the image is the source of truth for the shape of the world and what
grows on it. Everything the game uses is derived from it.

We do not build an editor.

## Consequences

The requirement that decided it is satisfied by the representation rather than by code: terrain *is* the
pixel, so it travels with any selection, transform or paste, and there is no second layer to keep in
sync. In a vector editor that synchronisation would have been both the hardest code to write and the
easiest to get subtly wrong.

The editing tools are already better than anything we would have built, and already known: lasso and free
transform for selecting and rotating, warp and liquify for bending a coast, clone stamp for borrowing
terrain, layers for trying a variant. Painterly rendering also wants a raster, because a terrain field
per pixel is what texture and edge treatment work from, where polygons render flat.

Three costs are accepted. Coastline detail is bounded by the resolution, about 2.4 kilometres a pixel, so
shorelines are traced and smoothed rather than detailed, and the maximum zoom stays low. Authoring happens
in an unprojected image while the game draws Mercator, so a painted shape looks different in play, which
is answered by making the rebuild fast rather than by changing projection. And colour discipline matters:
every pixel is snapped to the nearest class on the way in, which forgives the fringe a transform leaves
behind but not a feathered brush.

The warp from 0017 is not discarded. It becomes a way to generate a different starting point rather than
the way the world is shaped.

## Alternatives considered

- A bespoke vector editor with select, rotate, warp and copy: resolution-independent coastlines and
  semantic selection of a landmass, at the cost of building selection, transforms, undo and polygon
  clipping, and of carrying biome polygons through every operation.
- Restyling somebody else's tiles: cheapest of all, and the world stays Earth with the labels removed.
- Authoring the master in Mercator so that editing is what you see in play: triples the file and wastes
  most of its pixels near the poles.
