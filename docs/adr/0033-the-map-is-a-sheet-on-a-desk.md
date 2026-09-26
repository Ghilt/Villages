# 0033. The map is a sheet on a desk, and one camera sees both

- Status: accepted
- Date: 2026-09-10
- Extends 0014: the camera stays flat, north-up and single-world, and its edge rule now has a second half
  below the fit zoom
- Extended by 0060: the camera is tipped back and north-up, and every rule here is worked out in a flat
  window and squashed by the tip as it is drawn, so the desk lies on the same tipped ground as the world

## Context

The camera stopped at zoom 2, and MapLibre would have stopped it soon after anyway. Its Mercator transform
refuses any zoom at which the world's square is smaller than the window - it "zooms in to exclude all beyond
the given lng/lat ranges", on both axes, because copies of the world are not rendered. On a 1920 by 1000
window the world was never seen whole: at the floor it was 2048 pixels across, cropped on every side.

Adam wants the other end of that. Keep pulling back and the map itself should shrink, and reveal that it
lies on a surface: a texture for now, and later a workbench on which the map is a quarter of the view, so
that hovering it and scrolling in zooms into it until it fills the screen. The map is the main screen
because the world is a place, says the vision; this does not change that. The desk is where the map is
kept, seen only from far enough back, and the frame the house's papers will one day lie in.

The worry was the handoff. A map that fills the view plainly owns the wheel. A map that is one object on a
larger scene raises the question of who takes a scroll, and how the moment it stops filling the view is
kept from being felt as a switch.

Two facts about MapLibre 6.6 make the answer cheap. It has a public `transformConstrain` option, a
function given a proposed centre and zoom that returns the ones the map will accept, and every camera path
- the wheel, a drag and its inertia, the keyboard, the zoom buttons, `easeTo` and `jumpTo` - runs through
it. And the canvas is cleared transparent and the `sea` background layer paints only the tiles covering the
world, so outside the world's square whatever is behind the map already shows through.

## Decision

**One camera sees the map and the desk.** The desk is not a second scene with its own zoom that hands
over to the map. It is what the map's camera sees once it is pulled back far enough that the world's
square no longer covers the window. The wheel always zooms that camera around the cursor and a drag
always pans it, so "hover the sheet and scroll in" is MapLibre's ordinary zoom towards the pointer: the
sheet grows past the edges of the window and you are in the map. There is no mode, and so no handoff.

**MapLibre's constrain is replaced with ours**, through `transformConstrain`, and the rule is pure:
`constrainCamera` in `apps/web/src/map/sheet.ts`, in Mercator units times the world's size in pixels.
Along each axis, with `W` the world's size, `V` the window's size on that axis and `c` the centre in world
pixels, the centre is clamped to the interval between `V / 2` and `W - V / 2`, whichever way round they
fall. When the world is the larger that is MapLibre's own rule, the window inside the world, so nothing
above the fit zoom changes: panning still stops at the edges of the map, as 0014 says. When the window is
the larger the same interval keeps the sheet inside the window. Where the two are equal it is a single
point, so crossing between them never jumps: zooming in off-centre eases the sheet to the middle as it
grows to fill the view.

**The zoom is ours to bound too.** With the override in place MapLibre enforces neither its minimum nor
its maximum, so the rule clamps the zoom between the floor and `CAMERA.maxZoom` before it places the
centre. The floor moves with the window: `floorZoom` puts the sheet at `CAMERA.sheetAtFloor` of the
window's shorter side, half of it, and never below the -2 MapLibre refuses to go under. The fit zoom, where
the sheet just covers the window, is set by the longer side. Both are read in the debug panel.

**The centre may leave the world.** For the sheet to reach the corner of a wide window the camera's centre
has to sit off the world, so it is allowed up to two worlds out and no further, past which the round trip
through a latitude loses pixels. Two things follow for the code. The projection that places sprites,
`toScreen`, clamped every latitude to the edge of Mercator, which would have snapped the sheet back onto
the centre; it now projects the centre exactly and only the places clamped. And the constrain function is
called from inside MapLibre's constructor, before the map exists, so it closes over the container and
nothing else.

**The desk is a DOM layer behind the map**, `apps/web/src/desk/Desk.tsx`, that follows the camera by
writing styles on every `move` and `resize`, which MapLibre fires synchronously with the transform change
and before it paints, in the same frame. It sizes a repeating grain to a quarter of the sheet's side and
anchors it to the sheet's corner, so the desk zooms and pans with the sheet, and lays a shadowed sheet
element in the sea's colour under the transparent canvas, so the map reads as lying on the surface and the
half pixel between MapLibre's tiles and the edge never shows as a hairline. It is hidden while the sheet
covers the window, where it would cost a repaint for nothing. The grain is an SVG the browser draws, a
placeholder until there is a desk worth painting.

**Nothing about the world changes.** Longitude and latitude mean what they meant, so every seat already
stored stays where it is. The tiles, the painterly styles and the stills are untouched: a tile knows its
own zoom, and MapLibre asks for the zoom 0 tile at every zoom below it.

## Consequences

The transition Adam feared does not exist, because there is nothing to transition between. Zooming out
shrinks the sheet towards the cursor and never meets the clamp; at the floor the wheel does nothing.
Zooming in with the cursor over the desk inflates the sheet away from the cursor until an edge meets the
window's edge, then it grows in place, so the cursor slides across the desk onto the sheet. That is a
kink in the anchor rather than a jump, and it is the one thing to feel for; experiment 0003 watches it.

The floor is a property of the window, not of the world, so the panel's `floor` row says where it is and
the `sheet` row says how much of the window the sheet has: covering it, or a size and a share of the
shorter side, on the desk. A `camera` note is logged each time the sheet stops or starts covering the
view. Below zoom 0 the panel says z0 tiles, which is what MapLibre asks for.

The panel's `centre` can read a longitude past 180 with the sheet pushed to the side of a wide window, or a
latitude near 90 with it at the top of a tall one. That is the truth about where the camera is, not a
fault, and the founding button sends the centre, so it is refused there until the sheet is back under it.

The desk repaints its grain every frame while it is showing, because a changing `background-size` is not
composited. The panel's `frames` row is the instrument for that; if it stutters, the grain becomes a child
moved with a transform.

Anything that puts a place inside the view has to know the view now runs past the world: the seeding
button clamps its bounds with `clampBoundsToWorld`. `cellsForView` already clamped, and an area drawn from
the desk fences up to the sheet's edge, because `enclose` clamps to the master grid.

We accept knowingly that the desk is a DOM layer rather than something the map draws, and that the sheet
has a hard edge with no paper to it yet: the desk is here to be looked at before it is made.

## Alternatives considered

- **A second camera: the map in a smaller container, and a mode that decides who owns the wheel.** This is
  the handoff, made real: a discrete flip at the fit zoom, MapLibre's pointer maths broken under a CSS
  scale during the animation, and a resize of the canvas at the end of it. Everything the one camera gets
  for free would have to be built.
- **Put the desk inside the Mercator square, by shifting the tile scheme so the world is its middle
  quarter.** Public API and no DOM layer, and it changes what every zoom and every longitude and latitude
  mean, including the seats already stored and the numbers Adam has learned to read. It also bakes the
  desk's size into the tiles and lets a wide window see nothing but sheet.
- **The globe.** Striking, and the map is a sheet, not a ball; 0014 turned it down for the overlay maths
  too.
- **Reach into MapLibre's transform and override its constrain by hand.** What this would have been on the
  version before `transformConstrain` existed. Not needed.
