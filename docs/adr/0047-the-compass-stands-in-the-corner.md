# 0047. The compass stands in the corner, and a strip of navigation is still a way somewhere

- Status: accepted
- Date: 2026-09-20
- Superseded 2026-10-08 by 0109: there is no compass on a phone, so nothing stands in the corner and nothing
  steps clear of it; the bottom bar is the way between panes.

## Context

0043 put the compass **on the seam between the two bays**, at the far end of it, and that is where it has
been since. The seam is the one place on the stage that moves: `--bay-first` changes every time a pane is
resized, a window opens, a letter arrives or a letter is answered. So the one control that is always there
is never twice in the same place, and a control that has moved because you used something *else* is a
control you have to find twice. Adam's words: it *jumps around across the screen with different sizes*;
put it *floating above content in the bottom right corner of the phone always*.

0043 also read "the bottom/right pane" as **the bay that is not the map's**, so that the list would never
cover the world. That reading has a hole in it — with a letter pending the map is in neither bay, and
`awayFromTheMap()` then names the letter's own bay — and Adam has now said the literal thing twice.

Underneath both: 0046 made pressing the compass cost nothing, because moving a pane between bays no longer
resizes anything. That is what makes the compass landing in a **strip** a real case rather than a rare one,
and a strip of navigation that could only offer the way back out of itself would make the compass a button
that does nothing useful whenever the player had left a strip there.

## Decision

**The compass stands in the stage's bottom right corner, in both cuts, and never moves.** One rule places
it, where two rules used to chase a number. It is the corner a thumb reaches, upright or turned.

**It opens the second bay, literally** — the bottom one on a tall phone, the right one on a wide one,
whatever the player has swapped into it. That is Adam's words rather than 0043's reading of them, and it is
the better rule for the reason 0043 was trying to serve: a door that is somewhere else depending on what
you were looking at is a door you have to find. `awayFromTheMap()` stays, because a window opened on a
clicked castle is a different question and still wants the bay the map is not in.

**It never resizes anything**, which is 0046's rule and is what lets the first two clauses be simple.

**Navigation's strip carries the ways out**: the standing panes bar itself, as marks — the map, your house,
and the letter while a question stands — and pressing one sends that pane to the **other** bay, which is
the only bay a 44-pixel list can usefully change. Marks and no words, which is the tab bar's argument:
there is no room for a name in 44 pixels, and these are the same marks the same panes carry everywhere
else. It reuses the needle's own control, because *put this in the other bay* is exactly the job that
control already does.

**A put-away pane's controls go where the disc is not.** That is the one thing on a strip that has to
be hittable, so it is the one thing that cannot be under a button. Upright, the strip runs along the
bottom and the disc stands at the right of it: the marks move in from the right and the name keeps the
rest. Turned, the strip runs down the side and the disc stands at the **bottom** of it, so the whole order
flips — marks at the top, the name reading down from under them, and the bottom of the strip left to the
disc. Adam found both by looking, which is what the instrument is for.

**Navigation is called *Go to*.** What it is for rather than what is in it: a player who pressed a compass
is going somewhere, and *where you have been* is the trail, which is the lower half of what the pane
offers. The name is on the strip, on the row that moves the pane, and in the log.

**What is under the corner steps clear of it rather than being covered.** `--corner-taken` becomes
`--corner-right` and `--corner-bottom` — two numbers, because a pane steps clear in the direction it lays
itself out in and is not allowed to learn how the stage was cut — and **one rule sets both in both cuts**,
where the old one covered `rows` only and the landscape case was never covered at all. The house's bar of
levers pads its right, every **strip** pads the end the disc stands at, a scrolling list pads its bottom so
the last row scrolls out from under the disc rather than sitting half-covered forever, and MapLibre's
attribution is lifted clear because it is not ours to cover. The number is derived rather than picked: the
disc is 44 across and sits 14 in, so its near edge is 58 from the stage's, and 60 clears it.

**The top right corner is given back.** Nothing stands there now, so the house card's size control and the
choice roll's head drop the arithmetic they carried to dodge something that has gone.

## Consequences

**The disc lies over a corner of the second bay, permanently.** That is the cost, and it is taken
knowingly. The house has argued against floating chrome since 0041 — *furniture set into the edge of a desk
reads as part of it* — and 0043 rejected opening navigation as an overlay outright. Neither is contradicted:
that was a decision about *what it opens*, and what it opens has not changed. One tap still puts navigation
**in a bay**, the map still stays up beside it, and there is still nothing to dismiss. What moved is where
the button lives, and the button has floated since it was written.

It is drawn to earn the corner rather than to sit on it: parchment, a rim and a fainter gold ring nested
inside, which is the achievement's own way of drawing a frame — a seal pressed into the corner of the
sheet, not a circle laid on top of one. A thumb across, which is what a strip is, because it is the same
thumb.

**It is no longer told how the stage is cut.** The `along` prop is gone, which is the clearest sign it is in
the right place: the only reason it ever knew was to pick which seam to ride.

**A strip of navigation is now the only pane strip that does something**, and the second exception after the
map's. Both are in `RESPONSIVE-DESIGN.md`'s rule as stated exceptions rather than as quiet ones: minimised
is the pane's name, *unless the pane says otherwise and says why*.

**The compass can now push the map off the screen**, where the old reading could not: swap the map into the
second bay and press it. The mitigations are the ones this record adds — the map is a mark in navigation's
strip and a row in its list — and it is the same trade every other pane already makes.

## Alternatives considered

**Leave it on the seam and let it move.** Nothing to build, and the seam is where a boss of ornament wants
to go anyway. Rejected on the thing Adam actually complained about: it is the only control on the stage
whose position is a function of something else the player did.

**Put it in the top right instead.** It is free — `--corner-taken` already reserved that corner, and
nothing else wants it. Rejected because a phone is held at the bottom, and because the top right of the
second bay is the middle of the screen in portrait, which is not a corner at all.

**Keep the compass where it is and give navigation a bay of its own.** Rejected long ago by 0040: there are
two bays and there is no third place.

**Leave navigation's strip as a name and a way back.** Simpler, and consistent with every other pane.
Rejected because the compass lands there: the one pane whose strip a player reaches *by pressing a button
meant to take them somewhere* is the one pane whose strip has to offer somewhere to go.
