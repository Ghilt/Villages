# 0061. A house sees from vision points, and its fog is worked out rather than stored

- Status: accepted
- Date: 2026-09-26
- Amended 2026-09-26: vision given outright is built, as the decision said it would be: `house.gainedVision`
  carries the place and the size, `house.lostVision` ends it, and the size has moved into the domain as
  `Vision.MALLORCA` because an event now carries it. See step 3 of `docs/plans/fog-of-war.md`.
- Amended 2026-09-26: the gateway holds back what the fog hides, as the decision said it would, and building it
  decided three things (step 4 of the plan). A player's own house and own key figures are always sent, so a
  key figure's move is never told as a departure while the sight that follows them catches up. Vision is asked
  of the day being looked at and revealed of every point there has been. And whether a place is inside a point
  is `Reach`, the map's circle at the point's latitude and not the globe's, computed identically at both ends
  and held to `contracts/fixtures/reach.json`, so what is sent and what is drawn clear cannot disagree. The
  switch reaches the gateway as `fogOfWar`, and the wire moves to version 11.
- Amended 2026-09-26: vision and revealed ground are no longer only their circles. Each is closed by a ball as
  big as the surface tension, so a notch is rounded off and a short gap between two circles is seen across;
  see decision record 0064.

## Context

Adam asked for **fog of war**. A house sees the map at three levels: **vision**, where it can see right
now; **revealed**, where it has seen before and still knows certain things; and **unknown**, where only the
terrain and really big events reach it. The fog limits what a player learns about a place and nothing else:
it stops no command and hides no terrain. There will be ten thousand players in one world, and ideally the
server keeps back what a player's house cannot see, the scenery included, so the fog is not a curtain the
browser could simply stop drawing.

Asked what gives a house vision, he answered with a shape rather than a list: *anything can give vision*,
and what it gives is a **point** with **a circle around it**, which lasts a while. An event might give vision
of another continent for a couple of months, and that is a point with a start and an end. He floated a
vision event recorded as a side effect of other events, and asked for a debug button that gives vision and
one that takes it away. For now a house's seat and each of its key figures give a circle about the size of
Mallorca.

Two things were already true. Where a seat is, and where a key figure stands and for how long, are recorded:
the founding says the one, and the characters projection keeps a **span** for every stretch a character stood
in one place (decision 0055). And `BUILDING-A-MECHANIC.md` says what can be derived is derived and never
stored, and that where two answers could disagree only one of them is kept.

## Decision

**A house sees from vision points.** A vision point is a place, how far it sees around that place, and the
span of world-time it gives vision over, `since` to `until`, open while it lasts. On a day, a house's
**vision** is the circles of the points covering that day; what it has **revealed** is every circle any of its
points has ever covered, the ended ones included; everything else is **unknown**.

- **A seat and a key figure give points, and those points are worked out, not recorded.** A seat gives one
  from the day the house was founded. A key figure gives one for every stretch they stand in one place while
  they are the house's, from whichever came later, their arriving or the house taking them in; a move closes
  the point and opens the next, and leaving the map, dying or being lost to the house closes it. The world
  already records every one of those facts, so `SightProjection` folds them from the feed rather than a
  second record being written that could come to disagree with the first.
- **Vision given outright will be recorded**, as events of its own on the house's stream carrying the place,
  the circle and the span: Adam's far continent for a couple of months, and the debug button. Nothing else
  records those, so they are facts and not derivations. Not built by this decision; it is a step of
  `docs/plans/fog-of-war.md`, and the shape of a point is the same whichever way it arrives.
- **The circle's size is a distance on the ground, in kilometres**, not in map units. How far a house sees
  is a fact about the world; how big that looks on the map is the map's to work out, at the point's
  latitude, where Mercator keeps a circle round. This is 0026's argument about cells, made again about
  distance. Every point is **34 km** for now, `VisionPoint.MALLORCA`: a circle of 3,630 square kilometres
  against Mallorca's 3,640.
- **The server is the one place a sight is worked out.** It reaches its player as `yourSight`, every point
  the house has had, oldest first, on hello and whenever one opens or closes, to the session wherever it is
  looking, as `yourHouse` does. The page draws the fog from that answer, and the gateway will decide what it
  sends from the same answer, so what a player sees drawn and what the server holds back cannot disagree.
  The wire moves to **version 9**, recorded in `contracts/protocol-v9.txt` (0037).
- **What each level lets through**, decided now so that every step is built against it:
  - **Vision**: everything.
  - **Revealed**: what stands still - the ground, its scenery and the buildings on it, as they are now - and
    not what moves, which is people. Houses are not special: the rule is standing still against moving,
    and a house is the first building rather than the definition of one.
  - **Unknown**: the terrain, and anything of significance 80 or more, which is drawn from zoom 2 and is
    what "a really big event" means here. Nothing reaches 80 today: a house is 20 and a key figure 10.
- **The switch is Adam's and says words**: *fog of war: on* and *off*, in the Debug map section. Off lifts
  the whole of it for that window, the drawing and the holding back both. A way of looking, like *seeing
  everything*, so it is neither stored nor recorded, and every page load starts with the fog on.

## Consequences

**No new event.** The catalogue gains a consumer on six rows and nothing else. The fold is exhaustive over
every event there is, so an event that ought to give vision or take it away cannot arrive unnoticed: each new
thing that gives vision is a branch in `SightProjection`.

**The read model keeps every point there has ever been**, because that is what revealed ground is: a key
figure moved a hundred times leaves a hundred points. At ten thousand houses and a few hundred points each it
is tens of megabytes in memory, and `yourSight` carries all of a house's points on every change. Both are
fine at the size of the world today and neither is free at the size of the world intended; the answer, when
it matters, is to fold the ended points into one revealed shape and send changes rather than the whole.

**A rule change reshapes history.** A circle worked out from a seat is worked out with today's size, so
changing `MALLORCA` redraws every house's revealed ground on the next replay, the past included. Pre-alpha,
that is what tuning a number should do. A vision point given outright will carry its size on its event and
keep it.

**A player with no house sees nothing.** Before founding, the whole world is unknown, the three seats a
founding choice offers included. Founding lifts the fog around the seat. Whether that opening is a welcome
or too dark is for the eye, once the fog is drawn.

**Whether a point lasts is asked against a day.** The server asks it against today. Every point that has
ended so far ended on the day it was closed, so no point lasts into the future yet; a vision point given for
a span will, and ending it when its span runs out, with nothing happening to say so, is a step of its own in
the plan.

## Alternatives considered

**Every vision point an event, as Adam floated.** One kind of fact for the fog to read, and every point visible
in the event viewer. It loses for the seat and the key figures because it is a second record of where each of
them stands, written on every move by a reaction that lags the move and could disagree with it. It wins for
vision that nothing else records, which is why given vision will be exactly that.

**A grid of revealed squares on the wire**, a bit for every four map units in each zoom 10 cell. Compact, and a
place is tested against it in one lookup. It loses as the thing sent: it is further from Adam's shape, it
draws a blocky edge, and a circle with a start and an end cannot be read back out of it. It may yet come back
as the server's own cache, for testing a place against thousands of points.

**Map units for the radius**, as the holding measures its reach. Refused for 0026's reason: the size of the
circle on the map is a drawing fact, and the domain of the world should not be written in the screen's units.

## Amendment, 2026-10-07: revealed ground shows its buildings as they were

*The buildings on it, as they are now* was the open question of this record, and Adam has answered it: revealed
ground shows what stood on it **when the fog hid it**. A window had begun saying the day it did (0089), and a
house founded there afterwards would have been dated before it existed.

**Nothing new is kept for it.** A house's face - its name, its arms, its seat - does not change after it is
founded, and nothing ends a house, so *as it was* comes down to *whether it was there*: whether it was founded by
the day the fog hid its seat, `Fog.hidOn`, which the events already give. A house founded that very day counts as
there, as everything within one day does. Remembering what each player saw, the read model this record expected,
is not needed until a house's face can change or a house can end.

- **A house founded on revealed ground after the fog hid it is not sent**: not in its cell's snapshot, not as it
  is founded, not in a window's answer. Its ground looks as it did.
- **What happens to a house under the fog is not told**: its changes reach a player only while they see it.
  When they see it again, their sight changing answers their cells again, and it is as it is now.
- `Fog.sent` says both, as a house is sent to one player, and the gateway asks nothing else of the fog about a
  house. No new frame, no new field, and the wire stays at version 27.

**The rule for revealed ground is now:** what stands still, as it was when the fog last hid it.

