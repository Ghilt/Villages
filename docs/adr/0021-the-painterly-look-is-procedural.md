# 0021. The painterly look is procedural, and settled offline before it is drawn live

- Status: accepted, the delivery of it superseded by 0022 and its world space corrected by 0030
- Date: 2026-09-04

## Context

The map is the main screen, and until now the world has been drawn as one flat colour per terrain class,
straight out of `world/render.json`, with nearest-neighbour resampling so that a 1.2 kilometre pixel is an
honest square. It reads as exactly what it is, a classified satellite image. Decision 0019 chose raster
terrain over traced outlines and said in passing that pixels are "the form a painterly treatment wants
anyway". This is that treatment.

Two questions were tangled together. What should the world look like, which nobody knows and which is
answered by looking at pictures. And how is that drawn at sixty frames a second over a MapLibre camera,
which is ordinary engineering with a known answer. Tangled, they make a slow loop: every opinion about a
colour costs a shader edit and a browser reload.

## Decision

The treatment is procedural, it lives in pure functions, and the look is settled offline first.

- `frontend/packages/world/src/painterly.ts` holds all of it as arithmetic over two coordinates: value
  noise, a treatment per kind of ground, a colour wash, pigment gathering along an edge, paper grain, and
  a shore drawn in ink. No files, no canvas, no state, no loops over pixels. It is written in the shape a
  fragment shader wants so that it can be ported to GLSL almost line for line.
- Two coordinate spaces, and keeping them apart is the substance of the design. **World space** is master
  pixels, and only the terrain lives there: which class a point is, and how far a boundary strays from the
  grid it was stored on. **Brush space** is world position divided by how much ground one output pixel
  covers, so one unit is one pixel on screen at any zoom, and the whole of the medium lives there. A mark
  stays the size of a mark however far in you go, and because it is anchored to the world rather than to
  the viewport it stays put on the land when the map is panned.
- A treatment is chosen per **group**, the eight the palette already carries, not per class. Nine kinds of
  forest share one canopy and differ in colour, which is both eight fewer decisions and the right answer.
- `world/painterly.json` is the style, and it carries the views it is judged on. `npm run world:paint`
  writes every view twice, painted and flat, because the only useful judgement is the comparison.
- Delivery is a WebGL custom layer, in a later step, once the look is agreed.

## Consequences

The look can be argued about in a loop that takes twenty-five seconds, against images at any resolution,
before any of it is committed to a shader. And a look becomes testable, which it otherwise is not: that
pigment gathers along a boundary, that a mark keeps its size when the view zooms, that no treatment can
wash a class out on its own, are all assertions about functions.

Naming the two coordinate spaces early is what makes the port safe. A shader that got this wrong would
look right in a screenshot and swim under the map as it panned, which is the kind of defect that is
noticed late and hard to place.

The offline renderer is not the deliverable and must not be mistaken for one. It reads the master
directly, costs eight seconds and three gigabytes to start, and paints in Mercator only so its output can
be held against a screenshot of the running map.

## Alternatives considered

- **Bake the treatment into the tiles.** No plumbing at all, and it cannot work. Paper grain and a
  stipple have to sit at screen scale, and a tile baked at zoom seven is stretched eightfold by zoom ten,
  so the medium would smear exactly where the detail is wanted. Baking deeper is not affordable: zoom
  eight alone is 65,536 tiles.
- **Write the shader first and tune it in the browser.** The honest delivery, and the wrong order. It
  spends the expensive plumbing on a look nobody has agreed, and every opinion about a colour costs a
  reload.
- **Hand-paint the treatment into the master.** Contradicts decision 0018: the master is data, snapped
  back to one class per pixel on the way in, so a brush stroke in it is not recoverable as anything.
- **A treatment per class rather than per group.** Thirty-two sets of numbers to tune, when the palette
  already groups them and the groups are what the eye reads.
