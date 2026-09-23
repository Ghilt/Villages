# 0009. A room around the desk, and a zoom that turns over inside your own castle

- Status: open
- Started: 2026-09-23

## Hypothesis

The desk can be completed rather than merely extended - keep pulling back and it has edges and stands in a
room seen from the ceiling - and the far end of that pull can be joined to the near end of the map. The
join is not a crossfade beside the world but a place in it: **the room is inside the mark for your own
house**, so going in means going into the castle's own pixels until they are the size of the window, and
coming out means the room shrinking back into them. The claim is that a passage through a thing that is
already on the screen reads as somewhere you went, where a fade in the same two places reads as a slide
being changed.

## Setup

**The pull, and nothing of the camera's.** Decision 0033 said one camera sees the map and the desk, and it
still does. This does not extend it: below the map's floor the camera is pinned and MapLibre does no work
at all, and what moves is a CSS scale on the layer the desk and the map are drawn in. That is a departure
from 0033's thesis and it is deliberate - there is a seam here, described under *What we will look at*.

It had to be that way. The camera cannot reach a room. `transformConstrain` does replace MapLibre's own
rule entirely, exactly as 0033 says, but `map.setMinZoom` throws below -2 and `MapView` calls it on every
resize; and the headroom would not be enough anyway, because on a 1088 by 900 pane the felt floor is
already -0.19 and the whole of the world below it is under two zoom levels. A room needs about four.

- **`room/roomBox.ts`** and **`desk/deskTop.ts`**, pure and tested, are the whole of the geometry. The desk
  is a rectangle sized from the window and centred on the sheet; the room is a fixed multiple of the desk
  and concentric with it; each is hidden while the thing in front of it covers the window, which is the
  rule 0033 gave the desk, one level further out. Where the pull ends is worked out rather than declared -
  it is where the room's shorter side comes down to 92% of the window's - so it cannot be wrong on a stage
  nobody tried.
- **`room/pull.ts`** holds one number and the wheel. A wheel the map can still act on is handed straight
  back; one it cannot is spent on the pull instead, at MapLibre's own arithmetic so that a notch past the
  floor is worth what a notch above it is worth. The drawn value eases towards the asked one with
  `easeTowards` on an owed frame, the same two pieces the sprite renderer uses.
- **`room/Room.tsx`** is three layers, and the order of them is the design: the room's floor behind the
  desk inside the part that scales, everything that lies on the desk after it, and a copy of the room over
  the top that is the only thing ever drawn in front of the map. It is also the pointer surface, and it and
  the scaled part take the pointer in turn - the scene at rest, so a drag and a click reach the map exactly
  as they always did, and the room once the pull is on, so nothing is dragged by a pointer that a scale has
  made a lie and the wheel has the whole window to land in rather than the thumbnail the map has become.
- **The dive**, `room/dive.ts`, is how it turns over, and it runs on a rail: the wheel starts it and has
  nothing more to say until it is done. The camera is pinned at the closest zoom over the seat and the
  whole scene is scaled up about the middle of the castle - sixty or seventy times, worked out rather than
  chosen, so that a room eighteen pixels wide inside the keep ends up the size the real one is - while the
  room grows with it. Going out is the same rail read backwards.
- **The picture is not a snapshot.** It is the live map and the live sprites with a scale over them, drawn
  with `image-rendering: pixelated` so that what grows are the pixels rather than a smear of them. That
  costs nothing, because a pinned camera draws no frames; a real snapshot would have meant
  `preserveDrawingBuffer` on every frame the game ever draws, for the sake of two seconds of it, in a file
  this session must not touch.
- **The way in is only over your own holding.** At the closest zoom with the castle within a third of the
  window of the middle, one notch in starts the dive; anywhere else the closest zoom is the end of the
  zoom, as it always was. Going out needs a seat too: with no house the pull rests against the room.
- **The light closes at the end.** The room stops a little short of the window's edges, because that is
  where the real one stops, so the picture is faded out over the last fifth of the rail. Without it the
  margin went from a castle's own pixel to the dark behind the room in a single frame, which is the one
  flicker the whole passage exists to avoid.
- **Coming out waits for the ground.** The seat's tiles have never been painted at the moment the camera is
  put there, so the rail holds at its far end - under a room that covers the window - until `idle` or 900
  milliseconds, whichever is first.
- **The debug panel** gains four `room` notes and nothing else: off the desk with the length of the pull,
  the desk gaining edges, each turn, and the click that puts you back.

No command, no event, no frame, no Kotlin, no protocol change. The room lives in the browser and a reload
forgets it, as an area did before decision 0032 - the point of a spike is to find out whether the thing is
right before deciding what the world should know about it.

## What we will look at

- **Whether the seam at the floor is felt.** The wheel that lands on the floor is spent by MapLibre and the
  next one starts the pull, so there is one tick of hesitation at the handover. 0033's whole claim was that
  there is no handoff; this puts one back, one level further out, and whether that reads as a hesitation or
  as the desk letting go is the question the arithmetic cannot answer.
- **Whether the dive can be seen for what it is.** It should read as going inside the castle, not as the
  castle being replaced. If it fails it fails at the top: a sprite blown up sixty times is a sprite, and
  whether that is a doorway or just a big picture of a doorway is the whole question.
- **Whether a second and three quarters is right**, and whether taking the wheel away for it is tolerable
  or merely tolerated. It is `DIVE_MS`.
- **Whether the room is far enough.** It is a journey of 1.96 zoom levels on a 1088 by 900 pane, which is
  shorter than the map's own range by a lot. If it arrives too quickly the numbers are `ROOM_IN_DESKS` and
  `ROOM_FILLS`; if the map is an unreadable smudge before the room is in view, they are the other way.
- **Whether the desk wants edges at the floor.** It is rigid and attached to the sheet, so shoving the
  sheet hard against one side of the window at the floor brings the far edge into view without any pull at
  all. That is the desk being an object rather than a backdrop, and it may equally read as the desk having
  come loose.
- **What it costs.** The map keeps rendering at full size behind a scale, so the compositor shrinks a
  canvas that is still being drawn at 1088 by 900. It should cost nothing, because the camera is pinned
  and MapLibre only draws when it moves - but that is a claim about an idle renderer and Adam's browser is
  the only instrument that can check it.
- **Whether the way out is enough.** A wheel is the only way in and a click is the only other way out.
  Touch has no seam here, which is consistent with the rest of the app and is still a room a finger cannot
  leave except by tapping.

## Observations

2026-09-23, in the agent's browser pane, a 1440 by 900 window with the stage at 1088 by 900 and the phone
toggles, painted renderer, game server on 8381, one house founded at 41.103 N, 100.117 W.

**The geometry came out where it was meant to.** At the floor the sheet is 450 px, the desk 1800 by 1241 -
four sheets across, which is Adam's own picture from experiment 0003 - and the room 4680 by 3228. The panel
read `off the desk: 1.96 zoom levels of pull to the turn`, which is the number the arithmetic predicts for
that pane to two decimal places. The desk's edge appeared at a scale of about 0.72 and the turn fired at
0.2565.

**Nothing about the floor changed.** At zoom 0.01 the world is a sheet on a grain that fills the window,
the same picture as before this, and the scaled layer carries `transform: none` and no `will-change` until
the pull is something.

**The whole loop runs on a real wheel, both ways.** Out: `off the desk` with the length of the pull, then
`the desk has edges, and the room is around it`, then `out through your own castle at 41.103, -100.117`,
landing at zoom 10 on exactly that seat. In, from the closest zoom over the holding: `in through your own
castle at 41.103, -100.117: 64 times into its pixels`, landing at the floor over the world's centre with
the room already drawn at the size the rail had it. A click gave `back on the desk`, and the same wheel
with the castle shoved 371 pixels off the middle of a 948 by 860 pane - past the 301 the rule allows - did
nothing at all.

**It reads as a place rather than as a transition.** Halfway in, the castle is a red block the size of the
window with hard edges and the room is a small dark rectangle inside the keep; halfway out, the same frame
with the ring of the house's own ground drawn round it. That is the thing the first cut did not have: a
crossfade of the room over the ground was two pictures taking turns, and this is one picture being gone
into.

**The wait for the ground is doing its job.** Coming out, the castle, its influence ring and the scattered
scenery are all standing by the time the room is small enough to see past.

**Three things found by looking rather than by thinking.** `pointer-events: none` on the outer layer is
inherited, so the first cut quietly made the map uninteractable at rest; the fix is the two layers taking
the pointer in turn. The jump fires `move` synchronously, so the layer placed itself once from the old pull
while the camera was already somewhere else, and reported leaving the room as the desk closing over the
view. And the margin beside the room flickered at the swap, which is what the closing light is for. None of
the three was visible in a type or a test.

**Both phone shapes work.** Upright at 390 by 800 the desk is 1299 by 896 and the room's walls fill the top
and bottom of the pane, because the room is landscape and the pane is not. Turned, at 800 by 390, the whole
loop ran and came out on the seat.

**Frames could not be read here**, for the reason experiment 0003 gave: the pane pauses animation frames
whenever it is hidden, which is between every action, so an eased pull only advances when a screenshot
pumps a frame. Every number above is a geometry or a log line, and none of them is a timing.

## Result

Open.

## Decision

Open.

## Follow-ups

To be written when it closes.
