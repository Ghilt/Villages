# 0046. A pane's size belongs to the fold, and the three sizes are the same three

- Status: accepted
- Date: 2026-09-20

## Context

Decisions 0040 to 0045 built the two-bay form over one day. Looking at the result, Adam found four things
wrong with it, and they turned out to be one thing.

**The middle size is not a middle size.** A pane declared the pixels it wanted when it was the small one —
the map 200, the house status 132, navigation 200, the choice roll 224, an inspect window 220 — so the
same press gave a different arrangement depending on which pane was under the thumb. Adam's words: *make
sure the three modes of every pane are the same sizes; it should always be half the screen.*

**Pressing the compass resized the panes.** A bay's share was worked out from what its *occupant* wanted
(`askingFor` in `bays.ts`), so putting navigation — which wants to be big — into the bay the house status
— which wants to be small — had been in changed the split. The map jumped from 800 pixels to 422 and back
on a round trip through a button that is supposed to be about *where you are going*. Adam: *hitting the
compass, or hitting the navigation further, should not resize the panes.*

**A size followed the pane it was given to.** The record was keyed by pane id, so putting the house away on
a phone and then widening the stage put the corner tile away on the desktop, where nobody had asked for it.

**The map could not be put away at all.** 0040 left that open — *a strip of map is not a map* — and 0045
repeated it, which made the map the one pane whose control offered two marks instead of three.

Underneath all four: **the arrangement was stored per pane, and recomputed from whoever was standing in
each bay.** 0045 had already seen half of this and answered it with a rule — the control writes the
neighbour's size as well as its own — but a rule that keeps two records in step is a rule that can be got
round, and `put`, `takeOver`, `giveBack` and `tidyUp` all got round it.

## Decision

**How the two bays divide the stage is a property of the fold, not of the panes in it.** One value with
three settings — `firstAway`, `halfEach`, `secondAway` — replaces a record keyed by pane id. A bay is not a
pane's own room: it is one end of a stage two things are sharing, and what happens to be standing in it has
nothing to say about how much of it there is.

**So the three sizes are the same three for every pane**: a **strip**, **half the stage**, or **the rest**.
Nothing else is reachable. Half is half, measured rather than declared, which is what Adam asked for.

**Both bays read one value, so the other bay follows by construction.** 0045's decision survives and its
mechanism does not: the control still names the arrangement rather than requesting a size, but it does it
by being the arrangement instead of by writing into its neighbour. **Both put away is not reachable at
all** — not because a rule forbids it, but because there is no arrangement that says it.

**Nothing but the control and an arrival moves the seam.** `put`, `takeOver`, `giveBack`, `show` and the
tidying up after a pane that has stopped existing touch what is in each bay and never how big it is.
Pressing the compass leaves the seam exactly where it was, which is the defect this record exists to
remove.

**Something arriving in a bay that is a strip opens it to half**, and that is the arrival's business rather
than the manager's. A window opened on a clicked castle, or a letter the world has just sent, into 44
pixels is a thing nobody can read; the compass landing in a strip is fine, because what it opens is a list
of ways on. The difference is who asked — the player, or the world — so it is a second, explicit call at
the two sites that know, and the compass does not make it.

**The map is a pane like the others and can be put away.** Its strip says *Map* and nothing else, has
nothing to scroll and no control on it, and **the whole strip is the button back** to half the stage. That
closes the question 0040 left open. The exception is in the drawing and not in the model: a pane renders
its own chrome, so a pane that renders no control has none, and nothing in the layout had to learn about
the map.

**A pane declares the spread's heights and nothing about a phone.** `small`, `strip` and `tall` collapse
into one `tall` of two numbers, read only by the spread, because **the desktop is not being standardised**:
a tile there is not dividing anything with anybody — the map behind it takes whatever is left over without
being asked — so its height stays its own. That was Adam's answer when asked.

**A strip is one thickness, `STRIP`, and it lives beside the layout's other room constants.** Four panes
each carried their own 44, which was four chances to disagree about a number none of them had a reason to
change.

## Consequences

**The arithmetic did not change.** `share`, `twoBays`, `formFor` and `bayLayout` are untouched and
`bayBox.test.ts` was not invalidated: `['big', 'big']` already meant half each and `[{ small }, 'big']`
already meant a strip and the rest, floor, cap and all. What was wrong was never the arithmetic — it was
what was being fed into it. The seam between the pure layout and the manager turns out to have been drawn
in the right place.

**What each bay asks for is now three constants**, so the store hands back the *same object* across every
change that is not an arrangement change. `useSyncExternalStore` compares by identity, so the stage does
not even recompute its layout when the compass swaps a pane. "Moving a pane does not resize the bays"
stopped being a behaviour to be careful about and became an identity, and the cache that used to sit there
for the same identity reason is gone.

**The bay manager has a test, and it is the first one it has ever had.** 341 lines holding every transition,
beside two pure modules with 570 lines of tests between them; every defect above lived in the untested one.
It is driven through its own exports with a fresh copy of the module per test, the way `trail.test.ts`
already does. The headline group is named *the seam does not move*.

**One real bug turned up while writing it.** `takeOver` did not swap, so a pane already standing in the
other bay ended up in both — reachable in two gestures: put navigation top from its own list, then press
the compass, which opens it at the bottom. It swaps now, as `put` always did.

**The phone opens on a different arrangement.** There is no 132-pixel house form any more, so a phone opens
on the map opened out with the house status a strip beneath it, where it used to open on the map with the
shield, the treasury and the bar of levers under it. The game is read off the map and pressing the strip is
the first gesture there is, which teaches the whole control — but it is a change to a screen Adam already
knows, and the alternative, half and half, is one constant away.

**Opening a pane out now puts the map away entirely**, where before it left the map 200 pixels. That is
what the word ought to mean, and it is only reachable now that the map has a strip to be put away to.

**No pane offers two marks any more**, so 0045's *a pane that cannot be put away offers two rather than
three* describes a case that no longer occurs. The mechanism it describes is gone with it.

The cost taken knowingly: **a pane can no longer ask for a size that suits it.** The house card's 132
pixels were chosen by eye for one line and the bar of levers, and there is now no way to ask for them on a
phone. That is the price of the three meaning the same thing everywhere, and it is the right way round —
a player who wants the card gets half the stage, which is more card than they had.

## Alternatives considered

**Keep the record per pane and stop the verbs disturbing it.** The smallest change: a rule in `put`, in
`takeOver`, in `giveBack` and in `tidyUp` saying "and do not touch the sizes". Rejected because it is four
rules that all say the same thing and can each rot separately, and because it leaves the deeper oddity in
place — a bay's size would still be a fact about whoever happened to be standing in it.

**Let the arithmetic keep the pixel counts and simply make them equal.** Set every pane's `small` to half
the stage and be done. It cannot be done: the pane declarations are constants and half the stage is not
known until the stage is measured, so the number would have to be a token meaning "half", which is the
`halfEach` arrangement with a worse name.

**Give the map a strip but leave it a control.** Consistent, and one fewer exception. Rejected on Adam's
words: a strip of map has nothing to say, and three marks in 44 pixels of it are three things to aim at
where the only useful one is the map itself.

**Standardise the desktop too**, so a tile in the corner is also half the stage at its middle size. Truly
one rule everywhere. Rejected by Adam when asked: it makes the house card very tall on a large monitor and
takes half the map to do it, and a tile in the spread is not dividing the screen with anybody.

**Open the bay from inside `takeOver`**, rather than as a second call from the two arrivals. Fewer lines and
no site can forget it. Rejected because the compass is a takeover too, and it is the one that must not
resize anything — the rule would have to know which takeover it was looking at, which is the caller's
knowledge and not the manager's.
