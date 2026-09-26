# 0060. The player's camera is tipped back, north-up, parallel, and the ground is read on diamonds

- Status: accepted
- Date: 2026-09-25
- Supersedes the flat half of 0014: the camera is no longer straight down. Its single world and its
  Mercator stand, and a player still cannot turn or tip it.
- Extends 0033: the sheet, the desk and the room lie on the same tipped ground as the world
- Closes experiment 0008

## Context

0014 made the camera flat and north-up because the sprite overlay was synced by hand, and a flat camera
kept that sync to two multiplies. It said the loss of feel was "worth revisiting once the sprite path is
proven", and that enabling a tilt would mean the sync handling a full camera transform.

Experiment 0008 did the revisiting. Tipped with the field of view collapsed, the camera is parallel, so
the projection stays affine and the overlay placed marks on their own ground to within a fifth of a pixel.
MapLibre stops drawing at a parallel tilt past sixty degrees. The ground's colour could be read on a turned
lattice, which gives diamond cells while north stays up. And since 2026-09-25 the scenery stands up on
tipped ground and is drawn farthest first, where before it lay down with the ground.

Adam then looked, pulled the sliders, and chose: **tipped back forty-five degrees, north-up, with the
ground's grid turned twenty-six degrees as diamonds.**

## Decision

> **Amended, 2026-09-25, pending experiment 0011.** The 45 degrees is now the most the camera tips, at the
> closest zoom: it is straight down from zoom 7 out and eases up to 45 at zoom 10, the tilt a function of
> the zoom (`tiltAt` in `map/tilt.ts`, `CAMERA.tilt`). Everything below that follows the tilt of the moment
> still holds at every point on that ramp; the lens is parallel at every zoom. See experiment 0011.

**The player's camera is tipped back 45 degrees, north-up, and parallel.** It is `CAMERA` in
`map/mapConfig.ts`: pitch 45, bearing 0, and a lattice turned 26 degrees at four world units a cell.

- **Parallel always, when tipped.** How wide the camera sees is not a setting. `lensFor` gives a tenth of a
  degree whenever the camera is tipped and MapLibre's own lens when it is flat. The overlay is exact only
  for a parallel camera and hundreds of pixels wrong for a wide one, so no combination of settings may
  reach a tipped wide lens.
- **North-up is load-bearing.** A parallel camera tipped north-up does exactly one thing to what lies flat:
  it squashes its height by the cosine of the tip, measured from the top of the window. So the sheet, the
  desk, the room and the rules for how far the camera may go are all still worked out as if the camera
  looked straight down. They are worked out in a **flat window**, as wide as the real one and taller by one
  over the cosine, and each rectangle is squashed back only as it is drawn. `flatWindow`, `drawnAt` and
  `flatPoint` in `map/sheet.ts` are the three conversions, and at no tip all three are the identity. A test
  holds the parchment laid out flat to where the tipped map draws the world's corners.
- **The edges are the tipped window's.** Panning stops where the whole tipped window reaches the edge of
  the world. The flat rule would have stopped where a straight-down window did and shown past the world's
  top and bottom, about a fifth of the window at forty-five degrees.
- **Nobody playing can turn or tip it.** Rotation stays off. Two-finger tipping, which MapLibre turns on by
  default and which was open since 0008 raised the pitch ceiling, is off as well. The debug panel's Camera
  section is still the lever, and its `player` button puts the camera back here.
- **The four world units a diamond cell is wide were chosen by the diamonds button**, not by Adam. They are
  a slider in the same section, and this record is where to write the number he settles on.

## Consequences

The world is drawn from an angle, with the marks and the scenery standing up out of it, and everything
that used to be laid out flat still is: none of 0033's desk, sheet and room arithmetic changed, only
where each piece of it is drawn.

**It costs painting.** At forty-five degrees a screenful holds 1.41 times the ground, which is the cosine
again: measured on the running program at z8.5, 25 painted tiles in view flat against 35 tipped. The
diamond lattice costs about a fifth more a tile, 0008's 51.8 ms against 61.7. Together, about two thirds
more painting for the same window, and the tile store's 450, sized in 0008 for sixty degrees, holds it.
The scenery's cells grow by the same 1.41 in the worst case, and at the closest zoom the ring the layer
already holds usually covers it.

**Thin things break up on the diamonds.** A river is one master pixel wide, and at four world units a cell
only the cells whose middle lands on it take its colour, so it reads as a chain of grey patches rather than
a ribbon. That is the lattice size, which is the slider, set against how a diamond reads.

**A brush mark is an ellipse**, 1.41 to 1, the same everywhere on the screen because the camera is
parallel. 0030 chose Mercator so that round stays round; tipped, it does not, and correcting that is one
anisotropy in the painterly worker rather than a new brush space. Not done here.

**Pictures for the map are drawn for this camera.** A building seen from a corner at thirty degrees, as
isometric art is, looks turned against ground seen from the south at forty-five. `LOOK-AND-FEEL.md` says
what a picture has to agree with.

**A turned camera is still only the debug panel's.** Turned, the squash is no longer along the height, the
desk and the room are no longer rectangles, and they stay drawn flat. That was 0008's finding and it
stands; north-up is what keeps it out of a player's way.

## Alternatives considered

**Dimetric, sixty degrees and turned forty-five**, the two-to-one every isometric tile is cut at. It matches
isometric art exactly, but turning puts north on a diagonal, which a map of the world does badly, and it
is the angle at which a parallel MapLibre camera is one step from drawing nothing.

**Tipped with a lens wide enough for a horizon.** It is a real camera and looks like one, but the overlay
would need MapLibre's own matrix and a perspective divide per sprite, and the cost of what is in view
stops having a bound.

**Turn the desk and the room with the camera.** A rotated CSS transform per element, and the room's
pull-back arithmetic done in turned space. Nobody playing can turn the camera, so it would buy nothing a
player sees.
