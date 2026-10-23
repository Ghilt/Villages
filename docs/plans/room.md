# The room

**What belongs here:** how the room the map table stands in gets built as a crude 3D model: its measurements,
the camera it is drawn through, how it is drawn round the live map, the rules that must hold, and the order it
is built in. **What does not:** the pull, the dive and their history, which are experiment 0009; what the room
looks like in plain words, which is `LOOK-AND-FEEL.md`; the words, which are `GLOSSARY.md`; the levers as they
are in the running program, which are `RUNNING.md`. When a part of it is decided, that part becomes a decision
record and leaves.

Planned on 2026-10-23 from Adam's notes on the first try, a preview he moved, and his answers.

---

## The problem, in one paragraph

Pulled back past the far end of the map, the desk stands in a room, and the room was drawn as flat pictures
squashed by the tip: a floor plan, then pictures of things standing on it. Adam's verdict on the last of those:
"its not right". He asked for the room to be planned rather than improvised, for the table to be modelled in
crude 3D, and for a tiled floor to establish the perspective: the map's own forty-five degrees of tilt and
twenty-six degrees of turn. A tipped picture cannot do that. A model can: measured in metres, and drawn
through one camera, the same one the map's square is drawn through as it lies on the table.

## What Adam settled

| | |
|---|---|
| The room's angle | **The whole room is turned 26 degrees and tipped 45**, the map's own pair (decision record 0060): the ground's grid is turned 26 degrees and the camera tips 45 at the closest zoom. The floor, the walls, the table and the map's square all sit on that grid, so the map's square lies skewed on the table and the back and west walls are seen face on. Chosen in the preview over a north-up room with only its tiles turned. |
| The walls | **The two back walls extra high**: "we are in an imposing little room with a high ceiling". 5.5 metres in the preview, a slider there; the number is his. |
| The table | Modelled in crude 3D: a top with an edge, on four legs, with the map lying on the top. |
| The floor | Tiled, to establish the perspective. |
| Kept from the steps before | More floor round the table than the 2.6 tables across of the first room. The wheel drives the pull the whole way. A drag looks round the room, and only a click on the map takes you back to it, so the table can hold things that can be pressed. |

## The room, measured

In metres. The table top is where the map lies; it is the desk the page already draws, so the pixels a metre
is worth come from the desk's width on the screen over the table's.

| Thing | Size | Where |
|---|---|---|
| Floor | 7.8 across by 6.8 deep | round the table, the table a little forward of its middle |
| Tiles | 0.5 square | on the floor, along the room's walls |
| Table top | 2.4 by 1.66 (the desk's shape), 8 cm thick | its top 0.8 above the floor |
| Legs | 10 cm square | at the four corners, 6 cm in |
| The map | the sheet, 0.6 square at the floor | lying on the table top |
| Back wall (north) | 5.5 high, 0.3 thick | along the floor's north edge, the window in it |
| West wall | 5.5 high, 0.3 thick | along the floor's west edge, the hearth in it |
| The two near walls (south, east) | cut down to 0.25 | so they never stand between the camera and the room |
| Rug, chair, chest, shelf | crude boxes | step 4 |

## The room's camera

One camera draws the room and the table top alike. It is parallel, as the map's camera is, and does two things
to a point given in metres, east, south and up: it **turns** the room about the look point, then **tips** it,
squashing south by the cosine of the tip and lifting what stands by its sine. The pull drives both, eased the
way the map's own tilt is: at the floor, no turn and no tip, the map lying flat and square on the desk seen from
straight above; at the turn, 26 and 45, read live from the map's own numbers (`GROUND_LATTICE.turn`, and the tilt
ramp's most), so the debug panel's levers move the room with the map.

The scene the page already draws - the map's canvas, the sprites, the desk - is the plane of the table top.
Through the camera it is one 2D matrix, so it is drawn as it is now, by one CSS transform, now with a turn in
it. Everything else in the room is drawn by projecting its corners through the same camera.

## How it is drawn

- **Three layers, front to back by depth:** what is farther than the table top (the floor, the walls, the
  table's far edges and its back legs, hidden under the top), the scene itself (the table top with the map on
  it), and what is nearer than the table top and could overlap it (the table's near edge and front legs, the
  chair). The first and last are SVGs made from the model each time the pull, the look or the window changes:
  a few dozen faces, the faces turned away from the camera left out, the rest drawn farthest first, as the
  preview does.
- **The room inside the castle**, during the dive, is the same drawing made through the dive's own camera, so
  the room the dive lands in is the room the pull draws. The map's square is in the model as a plain square,
  so the drawing inside the castle has a map on its table too.
- **Looking round and the click on the map go through the camera backwards.** A drag moves the look point by
  as much as it takes for the room to follow the pointer; a click lands on the map when the camera, run
  backwards, puts it inside the map's square, now a skewed diamond on the screen.
- **The room is framed at the turn by its walls as drawn**, and looking round stops where they end.

## Rules that must hold

All four hold at the instant of drawing, because each is a property of pure functions that a test pins.

1. **One camera.** The table top's corners, projected by the room's camera, are where the scene draws the
   desk's corners. If they parted, the map would float off its table.
2. **The floor hands the map back.** With no pull the camera is exactly nothing: no scale, no turn, no tip, so
   the map is handed back to MapLibre as it was left.
3. **The dive lands on the room.** The room drawn inside the castle at the end of a dive is the room the pull
   draws at the turn, both ways.
4. **The pointer is honest.** A drag moves the room under the pointer by exactly the pointer's move, and a click
   finds the map's square wherever the camera has turned and tipped it.

## What it replaces, and what it leaves

The fourth step of the first plan, the standing pictures, was not committed: its pictures and the `--stand`
number go, and so does the flat floor picture. Its one fix that stands, the desk no longer cut off at the
window's edge, comes back in step 2, where the table needs its whole top. The pull, the dive and the look round
the room from the first three steps stay as they are; what changes is the camera they draw through.

Not here: textures or painted art (the model is flat colours, its shapes the thing being judged), things on the
table that can be pressed, and furniture beyond crude boxes. A decision record for the turned room comes with
step 1: decision record 0060 set aside turning the desk and the room because nobody could see a turned camera,
and now the room is the place where one is seen.

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | **The room's camera, and a tiled floor.** `room/camera.ts`, the camera as pure functions with their tests, and `room/model.ts`, the room in metres. The pull turns the scene as it tips it, so the map's square turns and tips into a skewed diamond; the floor with its tiles is drawn round the table through the same camera, and inside the castle during the dive; a drag and the click on the map go through the camera backwards. Step 4's pictures go. A decision record for the turned room. | 1. 👀 Pull back from the far-out map: the map's square turns and tips into a skewed diamond on the table, and the floor's tiles lie at the angle the map's ground diamonds do at zoom 10. 2. 👀 Drag in the room: it follows the pointer; a click on the map's skewed square takes you back to it. 3. 👀 Dive into your castle and out again: the room you arrive in is the same picture, with no jump. |
| 2 | **The table in crude 3D.** The floor drops a table's height below the map as the room tips; the table's edge and its four legs, the back legs hidden by the top; the layer in front of the table for what is nearer; the desk drawn whole rather than cut off at the window. | 1. 👀 Pulled back, the table stands on four legs with the map on its top and the floor below it. 2. 👀 Scrolling in, the table flattens into the desk seen from straight above as the map lies flat. |
| 3 | **The high walls.** The back and west walls 5.5 metres high and 0.3 thick, the window in the back wall and the hearth in the west, the near walls cut down; the turn framed by the walls as drawn, and looking round stopping where they end. | 1. 👀 In the room, the back and west walls rise high over the table: an imposing little room. Is 5.5 metres right? 2. 👀 Drag round the room: it stops where the walls end. |
| 4 | **The rug and what stands in the room**, as crude boxes: the rug under the table, the chair pushed back from it, a chest and a shelf. | 1. 👀 The furniture stands at the same angle as the table and the walls, and nothing nearer is hidden behind something farther. |

Bringing it to main is the last step, as always, and it takes the first plan's three committed steps with it.
