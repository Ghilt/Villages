# 0045. One pane size control, and in the bays it speaks for both

- Status: accepted
- Date: 2026-09-19
- Amended 2026-09-25 by 0057: in the spread, the panes taking turns in the corner share **one** control,
  at the far end of its tab bar, because the corner is one size whichever of them is up.
- Amended 2026-10-06, Adam's word: **in the spread a press anywhere on a pane put away opens it out**, but on a
  button of its own, which does what it says; the control still offers every size. The stage does it for every
  pane, through the pane's own way of asking, so a window opened so comes to the top of the rail as it does from
  its control. On a phone the letter's strip does it for itself, and no other strip does.

## Context

By 0044 the stage had two ways of saying how big a pane was. Every pane drew a **chevron** that could only
put it away and bring it back, and the choice roll had a second button beside it that swapped between its
big form and its carousel. Underneath, those were two pieces of state: a set of which panes were minimised,
and a record of which had been resized.

They are the same question — *how much of the stage is this taking* — asked twice in different words. A
pane could be collapsed **and** small at once, which meant nothing, and neither control said so. And the
second button existed on exactly one pane, which made it read as a quirk of the choice roll rather than as
something a pane can do.

Adam's words: every pane should have three sizes and one unified control — collapse, normal, expanded —
and the desktop should use it too. Then, on seeing it work: *clicking in one pane says this pane should be
this big, and the other pane follows*; both panes minimised at once is a state that should not be
reachable.

## Decision

**Every pane has three sizes and one control offers all three.** Put away, the normal size, opened out. It
replaces the chevron and the second button, in **both** forms — a tile in the spread has three heights just
as a bay on a phone has three shares.

**They need not be three different drawings.** A pane whose full form is a list can draw the same list
small and simply show less of it; the choice roll is the one that genuinely draws something else, which is
its carousel. What they have in common is that the pane owns all three and the layout only says how much
room there is.

**The mark is how much of a box is filled.** Not a chevron, not a folder, not an arrow pointing anywhere —
the thing being chosen, drawn. A player reads it as a slider with ends they can hit.

**It marks what was asked for, not what was drawn.** Those differ when a bay is too small to hold what was
wanted and the layout caps it (0044). Marking the outcome would mean pressing *opened out* on a capped pane
changed nothing visible and left the mark on the wrong one.

**In the bays it is a statement, not a request, and the other bay follows.** Two bays divide one stage
between them, so naming one pane's size names the arrangement: put one away and the other opens out; open
one out and the other goes to its smallest. **Both put away is not reachable at all**, where before it was
two presses and gave a pair of 44-pixel strips half the stage each — a state a player can reach and never
want.

**In the spread each tile's height is its own.** A tile is not dividing anything with anybody: the map
behind it takes whatever is left over without being asked, so there is nobody for it to speak for.

**One piece of state**, per pane, replacing the set and the record.

**A strip that is a narrow upright sliver drops its name and stacks its marks.** Cut into columns — a phone
in landscape — a put-away pane is 44 pixels wide and the whole height, so a row of name-then-control pushes
the control off the edge. There is no room for a name in 44 pixels, and the only thing a put-away pane has
to offer is the way back.

## Consequences

**Half each is still reachable, but not from the control.** Two bays both asking to be big get half the
stage each, which is 0040's rule and is what an inspect window opening beside the map should do. The
control cannot produce it, because the control always names one size and derives the other. That is the
right way round: the arrangement a *takeover* makes is the world answering a click, and the arrangement the
*control* makes is the player saying what they want to look at.

**The map offers two marks rather than three**, because a strip of map is not a map and it has no strip to
collapse to (0040). The control is the same control; a pane that cannot be put away simply offers less of
it. Whether the map should be collapsible after all is still the open question 0040 left.

**A container query overriding a rule declared below it does nothing**, and this is the second time it has
cost an hour — 0044 recorded the first. Three of the four strip rules this decision overrides are declared
further down the stylesheet than the query was, and simply won. The query lives at the end of the file now,
and the comment there says why.

The cost taken knowingly: **three marks is more to look at than one chevron**, on every pane, all the time.
It buys a control that says what it does and a pane that has one way of being asked about its size instead
of two.

## Alternatives considered

**One button that cycles the three sizes.** Smaller and quieter. Rejected because a cycle hides where you
are and where you would end up: with three states the player has to press and look, press and look. Three
marks show the whole range and which one is current without being pressed at all.

**Keep minimise and add a separate expand.** Fewer things to rebuild, and it is where 0044 had got to. It
keeps the two-state problem: a pane collapsed and small at once, and two controls answering one question.

**Let both bays ask independently and fix the arithmetic** so that two small askers do not get half each —
give each what it asked and hand the remainder to the larger. It solves the visible symptom and not the
cause: the player would still be able to ask for an arrangement that means nothing, and the interface would
be quietly correcting them rather than never offering it.

**Make the control phone-only.** Adam asked for it on the desktop too, and he is right: a tile's height is
as much a thing to choose as a bay's share, and a control that appears and vanishes with the form is a
control that has to be found twice.
