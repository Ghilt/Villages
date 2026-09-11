# 0003. The map on a desk

- Status: open
- Started: 2026-09-10

## Hypothesis

Pulled back far enough, the map reads as a sheet lying on a surface rather than as a map that has run out
of world - and because one camera does both, the moment it stops covering the window is not felt as a
transition at all.

## Setup

The camera, and a surface behind it. Nothing else.

MapLibre's rule that the world must fill the window is replaced with ours through its `transformConstrain`
option: above the fit zoom the window stays inside the world, exactly as before; below it the sheet stays
inside the window, down to a floor where it is half the window's shorter side. Decision 0033 records the
rule and why one camera is the whole of the answer to the handoff question.

Behind the map, a `Desk` layer in the DOM: a drawn wood grain that is sized to the sheet and moves with
it, and a shadowed sheet in the sea's colour under the transparent canvas. It is hidden while the map
covers the window. The grain is a placeholder; the point is to look at the map as an object before
deciding what the surface should be.

The debug panel gains a `sheet` row and a `floor` row, and logs a `camera` note each time the sheet stops
or starts covering the view.

## What we will look at

- Whether the crossing is felt. Zoom out through the fit zoom with the cursor near a corner and back in
  again: the sheet should ease to the middle as it grows to cover the window, with no snap on either side.
- What scrolling in with the cursor over the desk feels like. The rule inflates the sheet away from the
  cursor until an edge meets the window's, then grows it in place, so the cursor slides across the desk
  onto the sheet. If that reads as the map running away, the alternative is to zoom around the sheet's
  centre while the pointer is off it.
- Whether half the shorter side is the right floor. Adam's picture is a quarter of the workbench; the
  number is `CAMERA.sheetAtFloor`, and the panel's `sheet` row says what it came to.
- What it costs. The grain is repainted every frame while the desk shows, because a changing
  `background-size` is not composited. The panel's `frames` row is the instrument: the worst gap at the
  floor, zooming and panning, against the worst gap at zoom 4 on the same machine.
- Whether the sheet wants an edge: a shadow only, or paper, or a border, or nothing. And whether the desk
  being hidden while the map covers the window is ever noticed.
- Whether anything on the map minds. Areas drawn from the desk onto the sheet, a house founded at the
  centre, the painted renderers at zoom 0 and below, the sprite overlay.

## Observations

2026-09-10, in the agent's browser pane at 1280 by 720, painted and raw renderers, no game server.

**The floor and the fit are the window's.** The panel read `floor z-0.51 (the sheet at 50% of the shorter
side), covers the view from z1.32`, which is half of 720 and the whole of 1280 against a 512 pixel world.
Squeezed to 375 by 812 it read `z-1.45` and `z0.67`, the sheet turned to `96% of the view's width`, and
the minimum zoom followed on the resize.

**The crossing logs once each way.** Wheeling out from zoom 4 logged `the sheet no longer covers the view:
773 px on 1280 by 720` at zoom 1.32 and nothing else until the floor, where the sheet was `360 px, 50% of
the view's height, on the desk` and the wheel did nothing more. Wheeling in with the cursor over the desk
at the top left inflated the sheet away from the cursor, pinned it flush to the right edge with desk on
the left, then grew it in place until `the sheet covers the view again` at 1.32. No snap was visible in
the stills; whether the pinned-edge kink is felt is for Adam's hand.

**A drag at the floor stops at the window's edge.** Dragged right, the sheet's right edge came to rest at
1280 of 1280 and the panel's `centre` read a longitude of -460, which is the truth about a camera whose
centre is off the world.

**Zoom 0 is a place now.** The `cells` row read `1 at z0:` with nothing after it, because the one cell's
quadkey is the empty string; it now says `the whole world`. MapLibre asks for the z0 tile at every zoom
below it and the painted and raw renderers both drew it.

**A drag started on the desk clamps to the sheet.** At the floor it enclosed 20207 by 4390 master pixels
and was refused by the census cap, which is the existing rule for a continent; the desk added nothing to
handle.

**Frames could not be read here.** The pane pauses animation frames whenever it hides the tab, which is
between every action, so the panel's worst gap read 2 to 98 seconds and a sampler saw 15 frames in eight
wheel bursts. The cost of the repainted grain is for Adam's browser to say.

## Result

## Decision

## Follow-ups
