# 0038. The eye keeps your own holdings in sight, and seeing everything is a different switch

- Status: accepted, its level of detail superseded by 0051 and its distance rule standing
- Date: 2026-09-16

## Context

Adam asked for a button with an eye on it: with the eye enabled, the player sees their house's holdings
at any zoom level. Theirs, and nobody else's.

Behind that is something the map does that nobody had named. A house is founded at significance 20, and
`coarsestZoom` turns 20 into zoom 8, so the read model indexes it from zoom 8 inwards and `inCell`
answers a shallower cell with nothing. The client asks for cells at the view's own zoom (decision 0026).
Pull back past about z7.5 and the map empties — not because the renderer is hiding anything, but because
the gateway has stopped sending. Below z3 the renderer does hide, and below z7 the influence layers are
off, because a fence twenty master pixels across is smaller than the mark above it and reads as dirt.

The first attempt at this made one switch that lifted all of it for everybody. That is a useful thing and
it is not what a player wants: a world where every house is drawn from orbit is a world with no distance
in it, and the reason significance exists is that distance should cost something.

## Decision

**There are two switches, and they are different things.**

**The eye is the player's, and it is about their own holdings.** It lives in the bar along the bottom of
the house card, because it is the house's own lever rather than furniture floating over the map. With it
open, the player's seat is drawn however far back the camera goes and the ground about it is drawn below
the zoom where anyone else's would be. Everybody else's houses come and go with the zoom as they always
did, so the world still thins out; what the eye says is that your own is the exception, and that leaving
it behind is a decision rather than an accident.

It costs nothing on the wire, which is the part worth keeping. Your own house already reaches you
wherever you are looking — `fanOutChange` sends `yourHouse` to your session rather than to a cell — so
the page already knows the thing it is being asked to draw. The eye is a page deciding to draw what it
has.

Two mechanisms carry it, both small:

- `always` on the sprite, and `detailForMark` beside `detailForZoom`: a spared mark is a dot where the
  rest are nothing, and is no larger above the floor, because the eye is about distance and not size.
  Candidates were already spared for their own reason, and now share the rule.
- A second source and a second pair of layers for the player's own ground, drawn from zoom 0 up to the
  zoom where everyone's begins. Not a filter on the first pair: what differs is the zoom range, and
  MapLibre has one of those per layer rather than per feature.

**Seeing everything is Adam's, and it is in the debug panel.** `seeAll { on }` sets significance aside on
the connection: `inCell` gains an `everything` flag that drops the condition that the cell's zoom is at
least the row's coarsest, and the other two conditions of decision 0026 stand. It is modelled on
`viewTime` — both change what a connection is *shown* rather than what it *holds*, so both answer every
held cell again as they arrive. The fan-out walks all eleven zooms now and asks each holder whether it
has the switch on; the renderer's distance floor comes off with it.

That is the only way to look at a whole world at once, and it is the instrument that will make the need
for aggregates visible rather than theoretical. It belongs beside `seed 20`, not in a player's hands.

**The wire therefore moves to version 3**, with `contracts/protocol-v3.txt` beside the v2 recording, per
decision 0037. Neither switch is stored or recorded: both are ways of looking. Two windows of the same
player may differ on either.

## Consequences

A player can pull back to the whole world and still see where they are. At that distance the ground about
the seat is smaller than a pixel, so what is actually in sight is the mark; the ground becomes legible
from about z5. That is the honest reading of "always visible" and it is what the button does.

The house card now has a bar along its bottom, with one place filled and five empty. The empty places are
drawn rather than left out, so the bar is already the shape it will be and nothing moves as it fills.
This is the first interface surface that is a player's rather than Adam's, and the eye is the first thing
in it, which makes it the place the next such lever goes.

Adam's switch is one line in the World bar of the debug panel and no line anywhere else — see the
amendment to decision 0023, made the same day, which took the panel's block of state out entirely.
