# 0065. Revealed ground loses its colour, in each canvas by the means that canvas has

- Status: accepted
- Date: 2026-09-26
- Replaces the grey wash of 0062 with what it stood in for; the fog's place between the world and the signs
  (0063) stands

## Context

Adam asked for revealed ground to be "a faded colorless filter", and allowed a faded wash if taking the colour
out proved hard. Decision 0062 drew the wash - a middling grey at half strength over revealed ground - and
named taking the colour out properly as step 6 of `docs/plans/fog-of-war.md`, to be done with a blend mode
over the map and the sprites if one would composite over both.

What is on the screen is two canvases. MapLibre draws the terrain into one; Pixi draws the scenery, the
castles, the people, the fog and the signs into the other, above it (0063). Taking the colour out of a pixel
means reading that pixel, and nothing drawn in one canvas can read the other. So no single blend reaches both:
a blend in Pixi sees only Pixi's pixels, and one laid over both canvases would take the colour out of the
signs too, which 0063 exists to prevent.

## Decision

**Each canvas loses its colour by the means it has, from the same field and along the same edge.**

- **The map**, through a canvas of its own between the two: `.uncolouring`, grey where revealed ground is not
  in vision and clear elsewhere, which the browser composites over the map by the **saturation** blend. Grey
  has no saturation, so where it is opaque the terrain keeps its brightness and loses its colour, and partly
  where it is partly opaque. The grey is a picture of the field, worked out once for each change to it
  (`fog/uncolouring.ts`), and every frame it is laid on the ground by the camera's own transform, which is
  affine because the camera is orthographic: one image drawn at a slant, whatever the zoom. The blend reaches
  only what lies beneath it, which is the map and not the sprites.
- **The world's sprites under the fog**, by a filter inside Pixi on one container holding the scenery and
  whatever stands outside vision: it takes the colour out by the same weighting the browser's blend uses, so a
  tree and the ground under it go grey alike. The signs over the fog keep their colours.
- **One edge.** The fog shader's code for where a pixel lies and how far it is inside revealed ground and
  vision is written once and shared by the fog and the filter, and the map's grey is worked out with the same
  softness and the same wander, by the same hash in JavaScript, so the colour, the haze and the fade leave off
  along one line.
- **The wash becomes a fade**: a pale tone at a quarter strength, which lifts revealed ground a little towards
  the parchment now that the grey no longer has to take the colour out. Both numbers are Adam's eye.

## Consequences

Revealed ground reads as the same country gone grey and a little faded, trees and all, while every house
standing on it keeps its colours, because a sign is not the world.

It costs a third canvas on the page, but a 2D one with no graphics context of its own to lose, and a
composited blend, which the browser does on the graphics card. The filter costs Pixi one extra pass over the
world's sprites each frame, and only while the house has revealed ground; with the fog off, or nothing seen,
it is taken off. Measured, a redraw of the map with the fog on costs what it costs with the fog off, to within
a tenth of a millisecond of the main thread.

The grey follows the camera in the same frame as the sprites, from the same view, so it cannot lag a pan.

The filter reads the ground under each pixel, as the haze does, so a castle or a tree standing on the very edge
of vision on a tipped camera can keep its colour at the top and lose it at the foot, where its picture reaches
over ground further back. It is the band a crown wide that 0063 names for the haze, and the same answer.

## Alternatives considered

**A MapLibre custom layer**, copying what the map has drawn so far into a texture and drawing it back greyed.
It would take the colour out inside the map's own context, and it means reaching into MapLibre's frame and its
state every frame, which the next version of MapLibre is free to change. The browser's blend asks nothing of
MapLibre at all.

**A backdrop filter on an element masked to revealed ground.** One line of CSS for the colour, and a mask the
browser can only be fed as an image, which would have to be made again every frame the camera moves.

**One blend over both canvases.** It would take the colour out of the signs on revealed ground too, which is
the fog covering the representations of important things, and 0063 says it must not.

**Keeping the wash.** Adam allowed it, and it is what this replaces: a grey laid over pale farmland and dark
forest alike turns both towards one grey, where taking the colour out keeps each its own brightness.
