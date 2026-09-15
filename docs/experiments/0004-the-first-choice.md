# 0004. The first choice

- Status: open
- Started: 2026-09-15
- Closed:

## Hypothesis

Offered three seats on a parchment lying over the map, with no other instruction, a new player founds a
house within a minute and can say afterwards why they chose the seat they did.

If that is wrong, a choice is not enough of an opening on its own and the first parchment needs more
around it: a reason to prefer one place, a look at the ground, a name to weigh.

## Setup

The first gameplay loop, increments 1 to 8 of `docs/plans/2026-09-15-first-gameplay-loop.md`: a
player who says hello with no house is given three seats in three regions, each with a name and a
banner; the parchment shows them with one button each and folds to a corner; three marks on the map
show where they are; taking one founds the house there, the camera flies to it, and the house is a
castle with a fence of ground about it that can be selected and read in the inspector. A restart
button starts a player over, and a wipe empties the world. Nothing else: no second choice, no
resource that changes, no other house to meet.

## What we will look at

The experience:

- Does the player read the three options, or press the first button?
- Do they fold the parchment and look at the map first, and do the three marks make them pan to them?
- How long from the parchment appearing to the action taken?
- After the flight, what do they do: click the castle, pan away, or wait for something?
- Asked why that seat, is the answer about the place, the name, the banner, or nothing?

The architecture, answered in passing:

- Do the three events of one founding read as one story in the debug panel, with nothing else needed
  to see that they belong together?
- Does a hello that gives a choice, an action that founds, and a projection a moment behind ever leave
  the browser with a stale parchment or a missing house?
- Does the wipe leave anything behind: a session, a cell held, a row?

## Observations

## Result

## Decision

## Follow-ups
