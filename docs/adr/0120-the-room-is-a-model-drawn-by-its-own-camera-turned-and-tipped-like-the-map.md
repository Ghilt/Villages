# 0120. The room is a model, drawn by its own camera, turned and tipped like the map

- Status: accepted
- Date: 2026-10-23
- Plan: `docs/plans/room.md`
- Experiment: 0009, the room around the desk
- Amends 0060, which set aside turning the desk and the room because nobody playing could turn the camera

## Context

Pulled back past the far end of the map, the desk stands in a room. Its first drawings were pictures: a floor plan
seen from the ceiling, then the same squashed by a tip, then pictures of things standing on it raised by the tip.
Adam's verdict on the last was that it was not right, and the reason is that a tipped picture has no perspective of
its own to agree with: nothing in it says which way the ground runs or how high the table stands. He asked for the
room to be planned, for the table to be modelled in crude 3D, and for a tiled floor to establish the perspective,
in the map's own two numbers: tipped forty-five degrees, and turned twenty-six, the turn of the ground's grid. In a
preview he moved, he chose the whole room turned over a north-up room with only its tiles turned.

## Decision

**The room is a model in metres, and one camera draws it and the table top the map lies on.**

- **The camera** is `room/camera.ts`, pure. Parallel, as the map's is, it turns a point of the table top about a
  point of the window, draws it back and tips it, and lifts what stands above the table top by the sine of the tip.
  The pull drives all three, eased the way the map's tilt is: at the floor it does nothing, so the map is handed
  back as it was left; at the turn it reaches the map's own pair, read live (`latticeTurn` from the camera store,
  the tilt ramp's most), so the debug panel's levers move the room with the map.
- **The table top is the scene the page already draws** - MapLibre's canvas, the sprites, the desk - and through
  the camera it is one 2D matrix, so it is drawn by one CSS transform. The map's square lies skewed on the table,
  as Adam first pictured it.
- **Everything else is the model drawn through the same camera** (`room/model.ts`, `room/draw.ts`): an SVG in the
  window's own pixels, made afresh when the camera moves. The room inside the castle during the dive is the same
  drawing, framed by the box the room is drawn in at the turn, which is the box the dive grows to.
- **The pointer goes through the camera backwards.** A drag moves the point the room is drawn about by as much as it
  takes for the room to follow the pointer; a click is carried back onto the table top and looked for in the map's
  square there.

This is the camera 0060 set aside for the desk and the room: "nobody playing can turn the camera, so it would buy
nothing a player sees". The map's camera still does not turn and nobody playing can turn it. The room's camera is
another camera, and the room is the place it is seen.

## Consequences

The room agrees with the map by construction: its floor's tiles lie along the line the map's ground diamonds run
at the closest zoom, which a test holds against the map's own projection. The rules the plan names are tests of
pure functions: the table top's corners drawn by the camera are where the scene's CSS draws them, the camera at
rest is nothing, the dive lands in the box the pull draws the room in, and a drag moves the room by exactly the
pointer's move.

Pulled all the way back, the room's box - its floor and the tops of its walls, turned and tipped - is larger than the
window, and the pull's longest journey, 2.6 zoom levels, is what frames it: the room arrives with the table near the
middle and the walls rising out of view, and a drag looks up them. On a window wider than the turned room, it stands
in the middle with dark beyond its corners.

What a model costs: an SVG remade on every frame of the pull, a few dozen shapes now and a few dozen more with the
table and the walls. A picture squashed by CSS cost nothing per frame. If the model grows past what a frame can
carry, the drawing moves to a canvas; the camera does not change.
