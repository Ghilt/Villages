# 0044. The choice roll is a pane, and its size is the player's

- Status: accepted
- Date: 2026-09-19

## Context

The **choice roll** was the last thing on the stage that was not a pane. It was a sheet at `z-index: 4`
lying across the bottom of the whole stage, over the top of the house card and the rail, with a fold to a
corner and one media query.

That media query is the reason `RESPONSIVE-DESIGN.md` exists. It asks `max-width: 52rem` **of the window**,
and the window is 1280 while the stage is 390 — so it has never once fired, and the defect outlived
decision records 0039, 0040, 0041 and 0042, each of which wrote it down as still open.

Decision 0041 left a tile for it, `bottomMiddle`, laid out and tested and empty. Adam's words were: "as part
of this plan also make a pane out of the choice roll." He also said what its two phone forms are — a
**carousel** to swipe through the options, and a big mode that is what opening one gives you — and, when
asked which two things are on a phone screen in big mode, chose the choice roll full with the house dropped
to its strip.

## Decision

**The choice roll is a pane with three sizes, and the mechanic owns all three.** Full is the prompt and
every option laid out to read through. Small is the **carousel**: one option at a time, with the way between
them. Minimised is the letter set aside — not closed, because the question is still standing.

**Its size is the player's, alone among the panes.** Every other pane's size is the layout's answer to how
much room there is: the house status is small on a phone because that is all there is, and it has no say.
The choice roll's two forms are two *ways of using it* — reading three options through, or glancing at them
while looking at the map they are about — and only the player knows which they are doing. So a pane may
declare that it has both sizes, and the manager keeps what was asked for, exactly as it keeps what was
minimised.

**A question arriving takes the map's bay**, on a phone, and the small bay keeps whatever was in it. Reading
the question is the thing to do first, and the pane beside it was already the small one. Answering gives the
bay back, because a takeover remembers what it displaced.

Folding to the carousel shrinks the choice roll's own bay and gives that room to **whatever is beside it**,
which is the house rather than the map: getting the map back beside the carousel is a second gesture, from
navigation. That is the layout doing what it always does and not second-guessing the player, and whether it
should be one gesture instead is a real question this record does not answer.

**It is not one of the fixed panes.** It arrives when the world asks something and goes when the question is
answered. An empty tile takes no room at all (0041), so with nothing pending the map runs clean to the
bottom edge of the stage — no band of reserved nothing.

**The layout hands back the size that fits.** A pane may declare what its full form needs: a bay at least so
**wide**, so the contents sit side by side, *or* at least so **tall**, so they sit one under another. Two
numbers and not one, because a phone is narrow and long while a tile along the bottom is wide and short, and
the same list is at home in both — it is only a bay that is neither that has no room for it, and that bay
gets the carousel. This is how "a tile that runs out of room draws itself smaller" stops being a hope: the
layout knows every bay's rectangle, so it can say, rather than leaving the pane to grow a scrollbar.

**Three across or one under another is a container query on the bay**, since that is a question about width
alone. The media query that asked the window is deleted, and **there is now no `@media` rule anywhere in the
stylesheet**. A container query carries no extra specificity, so it has to sit after the rule it overrides —
which cost half an hour of wondering why nothing happened.

## Consequences

**The narrow bottom row turns out not to need a rule.** The question Adam asked — what happens when the row
cannot hold the house status and the choice roll side by side — has an arithmetic answer: the column is
capped at a third of the stage and the spread only exists above 600 on the shorter side, so the bottom
middle is **never narrower than 281 pixels**, at a 601 by 601 stage. That is room for the carousel. The
planned fallback, where the corner collapses to its tab strip to give the row more room, is therefore not
built: it would be code for a case that cannot happen. A test sweeps every stage the spread can be and
asserts the floor, so if the column is ever widened, the thing that breaks says so.

**A bay left holding a pane that has gone now tidies itself up, whatever kind it was.** The manager already
put a bay's old pane back when an inspect window's subject vanished, and the check asked whether the id
started with `inspect:`. The choice roll is the second pane that comes and goes, and it found the hole: it
had taken the map's bay, and answering the question left the top of the stage empty. It asks whether the
pane still exists now, which is what stops the third one needing a line.

**Something was lost on purpose: the fold no longer persists.** The old parchment remembered in
`localStorage` whether it had been set aside. Which bay holds what does not survive a reload and neither
does whether a pane is minimised, and a choice roll is no different — the **trail** is the one exception on
the stage and it is the one with an argument for it (0042).

**One naming error is corrected with it.** `.parchment` named the whole choice and the options were
`.parchment__option` inside it, which is backwards: `LOOK-AND-FEEL.md` says one parchment carries one
option. The parchment is the option now, and what they lie on is the choice roll.

The cost taken knowingly: **a pane whose size the player sets is a third thing to learn**, after which bay
and whether it is put away. It is one button, on one pane, and the alternative was choosing for them.

## Alternatives considered

**The choice roll wants small, and big is reached by moving it.** No new state at all: put it in the small
bay for the carousel, the big one to read. It fails on the arithmetic — two panes both wanting big get half
each and both draw themselves full, so "the big bay" cannot produce a carousel and the two forms are not
reachable from where the pane is.

**Minimise does double duty**: one press gives the carousel, two gives the strip. Fewer controls. Rejected
because minimise means *give your room to whatever is beside you* everywhere else on the stage, and a pane
where it means something else is a pane the player has to learn separately.

**Leave it an overlay and only fix the breakpoint.** Much less work, and the media query is the actual
defect. It loses the thing the tiles were built for: an overlay lies over the house card and the rail, which
is exactly the collision 0041 removed everywhere else, and it would be the one piece of furniture still
floating.

**Build the corner-yields-the-row fallback anyway**, against a future where the column grows. Rejected as
code for a case the arithmetic says cannot happen; the test that asserts the floor is the cheaper way to
find out if that ever stops being true.
