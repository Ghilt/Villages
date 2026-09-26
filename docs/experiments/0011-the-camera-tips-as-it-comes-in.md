# 0011. The camera tips as it comes in

- Status: open
- Started: 2026-09-25
- Closed:

## Hypothesis

Tying the tilt to the zoom - a map seen straight down from zoom 7 out, a world tipped back 45 degrees at
zoom 10, and the tip easing between the two - makes zooming in feel like leaning down over the world
rather than enlarging a picture of it, without anything drifting, stuttering or sliding while it tips.

Adam's idea, in his words: *"i want the tilt to be tied to the zoom level. At max zoom z10 it should be 45
tipping angle. and at z7 and up it should be 0. So between z10 and z7 there will be a tilting effect of the
map as we zoom. I think this could look very cool."*

The second half is the one that can be measured, and it is the one that would make the first unlivable if
it failed: a tip that moved the ground out from under the pointer, or cost frames, would be felt on every
zoom.

## Setup

- **The tilt is a function of the zoom**, `tiltAt` in `map/tilt.ts`: nothing at zoom 7 and out, 45 degrees
  at 10, and `3t² - 2t³` between, so it starts and stops without a jolt. The numbers are `CAMERA.tilt` in
  `map/mapConfig.ts`.
- **MapLibre's own hook applies it**, `transformCameraUpdate`, run before every camera move whatever made
  it - a wheel, a pinch, a flight, a jump - so no gesture and no flight is interrupted to tip the camera.
- **The lens is parallel at every zoom**, not only where the camera is tipped, so it never changes in the
  middle of a zoom. Straight down the two lenses draw the same picture.
- **Everything downstream already followed the tilt of the moment.** The marks and the scenery stand up
  (0008), the desk and the room are worked out in the flat window (0060), and the edge rule works the tilt
  out from the zoom it is asked about rather than reading it off the map a frame late.
- **The debug panel's Camera section** holds the two numbers as levers: how far it tips at the closest
  zoom, and where it starts to tip. Its header shows the zoom whether the section is open or folded, and a
  dash in the room, where the pull and not the zoom is what moves.

## What we will look at

- **Adam's eye**, zooming in and out over the Alps and over his own castle: whether the tip reads as leaning
  in, and whether the band from 7 to 10 is the right one.
- **The ground under the pointer during a wheel zoom through the band**, as a number: where a place that
  was under the pointer ends up after the zoom. Anything past a pixel is a slide.
- **The cost of a frame while tipping**, because the scenery rewrites every foot whenever the tilt changes,
  and now it changes on every frame of a zoom between 7 and 10.

## Observations

**2026-09-25, the first build slid the ground out from under the pointer.** A place a third of the way up
from the bottom of the window, wheel-zoomed from 7.5 to 9, ended 49 pixels from the pointer, and the error
grew with the tilt. Two causes, the second hidden behind the first.

MapLibre's gesture handlers keep their own copy of the camera for the length of a gesture, and the hook
only changes the camera that is drawn, so the copy went on anchoring with the tilt the gesture started at.
Keeping the copy's tilt in step fixed that and changed nothing: the slide was exactly as large.

The real cause is in how a wheel zoom anchors. Every frame it reads which ground is under the pointer
*now* and keeps that there - `_computePreZoomAroundLoc` - so a tip about the middle of the window, taken
between two frames, moves the ground under the pointer, and the next frame faithfully keeps the moved
ground. Each frame's error is small and none of them is ever undone.

So while a wheel or a pinch zoom is running, the tip is taken **about the pointer** rather than the middle:
the anchor's offset on the ground is read at both tilts through the same projection the marks and the
scenery use (`untiltGround`), and the centre moves by the difference - `tippedAbout` in `map/tilt.ts`, with
a test that a place under the anchor stays there to a millionth of a pixel at four tilts and a turn.
Flights and jumps are still tipped about the middle, which the tip leaves where it is.

Measured again, the same zoom from 7.5 to 9.7, the tilt going from nought to 44 degrees: **the place
under the pointer stayed within 0.24 pixels of it** the whole way.

**Keeping the handlers' copy in step reaches into MapLibre** - `map._camera._requestedCameraState`, which
is private. It is reached for with optional chaining, so a MapLibre that moved it would leave the tilt
right and only the anchoring less exact, and the log says so once, under `camera`.

**The cost is not measurable.** A sweep from zoom 8.5 to 10 in twentieths, 1,526 trees on screen, the
median frame took 1.0 ms tipped and 1.0 ms with the tilt pulled to nothing; the slowest tenth 1.7 against
2.2. Rewriting fifteen hundred feet and sorting them is noise next to drawing them.

**What is where on the ramp.** 3.3 degrees at 7.5, 22.5 at 8.5, 27 at 8.7, 44 at 9.7. The scenery arrives
from about 8, so the trees mostly appear already standing on ground that is still tipping up to meet them.

## Result

Pending Adam's eye. The half that can be measured holds: nothing slides, nothing costs.

## Decision

Pending. Built as the player's camera so that it can be judged as one, with decision record 0060 noting
that its fixed 45 degrees became the most of a ramp. If it is kept, 0060 is amended in words; if not,
`CAMERA.tilt.from` pulled down to the floor and the ramp is a fixed tilt again in all but name.

## Follow-ups

- **Where the band is.** 7 to 10 is Adam's first guess; the levers are in the Camera section.
- **The ease.** Smoothstep was chosen so the tip does not start with a jolt; a straight line is one line
  in `tiltAt` if the eye prefers it.
