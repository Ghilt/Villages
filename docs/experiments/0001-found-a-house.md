# 0001. Found a house

- Status: open
- Started: 2026-09-01
- Closed:

## Hypothesis

Founding a house is enough of an experience on its own. Given a map, a name and a banner, and no explanation of what
a house is for, a player will choose a place deliberately and stay to watch the ticker.

If that is wrong, the world needs something to do before it needs anything else, and the roadmap changes shape.

## Setup

The Phase 1 walking skeleton, sixteen increments, and nothing more: a map, a way to found a house at a chosen point, a
generated banner, one resource shown as a rate-based ticker, and the houses of other players appearing live. No
decisions beyond the founding itself, no second resource, no interaction between houses.

## What we will look at

The experience:

- Does the player pick a place that means something to them, or the first point they happen to click?
- Do they name the house, or accept whatever is offered?
- Do they stay after the banner appears, and for how long?
- Do they notice another house appearing, and does it change anything about how they look at the map?
- What does the founding feel like at low zoom, where a house is a dot rather than a banner?

The architecture, answered in passing rather than tested for its own sake:

- Does the path from command to sprite hold together: decide, append, subscribe, publish, consume, push, draw?
- Can the broker's routing key carry the cell through the library's own bridge, or do we publish by hand? Increment
  1.6 decides this, and the answer belongs in this file.
- How many houses can be in view before the sprite overlay stops being smooth?

## Observations

**2026-09-02, the sprite overlay (increment 0.12).** The hand-written projection agrees with the map's own
`project` to the pixel: horizontal offsets were exactly zero across eight seats, at zoom 4 and at zoom 10, after
panning and after zooming. Vertical offsets sat inside the 2.2 pixel idle amplitude, which is the breathing motion
rather than error, and varied over time per sprite as intended.

One real limitation: while the camera is *animating* under program control, sprites trail the ground by a few
pixels, measured at 4.3 during a fast programmatic pan and 1.9 during a zoom. It is zero once the camera settles.
The cause is that the map and the overlay draw on separate animation frames. Fixing it properly means drawing the
sprites inside the map's render pass, which costs a permanent sixty-frame repaint of the map because the sprites
always move. Left as it is, on the grounds that players drag the map rather than fly it, and that a house does not
need to be pixel-locked while the world is in motion. Revisit if the founding flight looks wrong.

## Result

## Decision

## Follow-ups
