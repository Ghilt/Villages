# 0006. A world of scenery

- Status: closed
- Started: 2026-09-20
- Closed: 2026-09-20

## Hypothesis

The browser will draw tens of thousands of pieces of scenery over the terrain, scattered from the
master pixels alone and stored nowhere, without the map ceasing to feel smooth — and the ceiling is
high enough that what limits how furnished the world looks is taste rather than the machine.

## Setup

The smallest thing that answers it. Three kinds of the ten Adam named — pine, oak, grass tuft —
scattered on a grid in world space, each point hashed for its jitter, kind, size and rank, its kind
decided by the terrain class under it. Drawn as one `ParticleContainer` from one atlas, positions in
world units so the whole layer is moved by one transform. A Scenery section in the debug panel with
two sliders and the counts, because a stress test with no levers is not a stress test.

No server, no protocol, nothing stored. The mechanism is decision record 0052.

## What we will look at

How many pieces are drawn at once at each density, and what the frame gap does while the map is
moving, on this machine at 1400 by 900 and at the closest zoom. The number is the count; the tool is
the panel's own reading, which counts only gaps between frames of a *moving* map.

## Observations

**2026-09-20, the ceiling.** Swept the density slider at zoom 9.8 over the forests of Dalarna, on a
928 by 720 stage:

| a point every | drawn on screen | points held |
| --- | --- | --- |
| 4 world units | 942 | 5,451 |
| 2 | 3,792 | 7,268 |
| 1 | 15,232 | 29,017 |
| 0.75 | 27,457 | 56,474 |
| 0.5 | 60,928 | 117,402 |

Sixty-one thousand at once, still drawing, still gated correctly by terrain. The hypothesis is
confirmed on count. Frame timing could not be measured by the agent — the browser pane pauses
animation frames, so the frames were the agent's own screenshots and any gap read from them is an
artefact, not a measurement.

**2026-09-20, Adam's own reading, which is the one that counts.** On his machine and his stage:

> A point every 1.5 world units, which is about 0.444 to the unit squared
>
> that setting was a bit too much i think, i could make it lag by that, upper bound.

**So the working ceiling is a point every 1.5 world units — about 0.44 to the square unit — and that
is the upper bound, not the target.** The machine's ceiling is about four times higher than the
ceiling of what stays smooth in a hand, which is the useful finding: the limit is not the particle
count but everything else a frame has to do around it.

**2026-09-20, the count peaks where nothing is visible.** At zoom 6.5, 42,087 particles were held to
draw 410 of them: the scattering is thickest in cells at the zoom the fade *begins*, because the
number of cells in view falls by four for every zoom level in. The particles that cannot show yet are
made anyway. Bounded and responsive, but the obvious economy and not taken here.

**2026-09-20, a freeze, and the arithmetic that should have caught it.** The first build hung the
browser before the map drew a tile. A cell is 32 world units, which is eight screen pixels at the
zoom the camera opens on — so the view held about twenty thousand cells and five million points
behind them, each queuing a terrain fetch. It had only ever been tested from zoom 9.5 in, where a
cell is four hundred pixels and the view holds sixteen: three orders of magnitude away from the case
that was shipped. Fixed by three bounds, the first of which does all the work — nothing is drawn
below the zoom at which no kind would show anything. A test now sweeps every hundredth of a zoom
level and refuses to let the cell cap bind on ground where anything is visible; proved by breaking it
once.

## Result

**Confirmed, and the surprise was which limit binds.** The machine will draw four times more than the
hand will tolerate, so the count was never the interesting number. Two things surprised us. The
particle ceiling was far higher than expected and reached without a worker, an atlas of any
sophistication, or a single clever thing. And the scattering's cost is dominated not by the count on
screen but by how many cells the view spans, which is worst when the camera is *far out* — the
opposite of the intuition the whole thing was built on.

## Decision

**Keep the mechanism, throw away the look.** How scenery is worked out — deterministic from world
space and the terrain, stored nowhere, drawn as particles under the marks — is decision record 0052
and stands. What it draws is three crude shapes on one untuned weight table, and it is marked in every
file of it as experiment 0006 so that no later session mistakes it for a finished thing.

This changes no term, no event and no architecture. It adds `Scenery` to `GLOSSARY.md`, 0052 to the
decision records, and a Scenery section to the debug panel.

## Follow-ups

**The world-generator**, in `docs/plans/world-generator.md`, which is what this hands over to: a world
that seems lived in rather than a carpet that proves a number. The measurements here are its budget.

Two smaller things this opened up, both named in 0052 and neither done:

- The far end of the handoff is missing. 0051 says the painted terrain is scenery's far-out form, and
  it is not: the canopy treatment is a constant 3.2 screen pixels in brush space, so it does not
  resolve into anything. Fading a group's `amount` out over the same band the scenery fades in is one
  number through `preparePainterly`.
- Particles are made for points that cannot show at this zoom. Forty-two thousand held to draw four
  hundred is the worst case measured.
