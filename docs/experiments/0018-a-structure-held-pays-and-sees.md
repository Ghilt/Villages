# 0018. A structure held pays and sees

- Status: open
- Started: 2026-10-08

## Hypothesis

**A structure can be its own history, held by one house at a time, and pay and light the map for whoever
holds it, with nothing it gives stored as a number of its own.** A house founded today is given its castle
and sees from it as it did from its seat; raising a mill beside it adds to the treasury at the rate the
catalogue says, and a level more adds more; giving the mill away moves the income and the sight to the new
holder on the same day; and a structure seen once and then left keeps the face it had when the fog hid it.

It is wrong if a replayed history ever pays a house at a rate it no longer has, if two houses are ever paid
for one structure on the same day, if retuning the catalogue changes what a house was paid or saw in the
past, if revealed ground ever shows a holder, a level or a ruin the house did not see, if anything in a slot
not known to a house is drawn as anything but a question mark, or if, by eye,
a structure on the map, in its window or in the Holdings tab reads as a row in a spreadsheet rather than as
a place someone holds.

## Setup

The build in `docs/plans/structures.md`, shaped by decision record 0093: a structure on a stream of its own,
the catalogue of sixteen types in `world/structures.json`, the seat a role the founding castle plays, the
income and the sight of every held structure written into its holder's history by one listener, the fog
showing each face as it was last seen, slots and items, and a culture map per master. Nothing in the world raises a
structure but founding: the debug panel's Structures section does the rest, standing in for the world,
with one structure of every type standing in Antarctica, held by nobody, to take control of.

As little as possible: no building by a player, no taking by force, no factions, no structures standing in
the world of 1790, no influence zone but the castle's, placeholder sprites.

## What we will look at

**The architecture**, answered as the steps land:

- Whether a replay writes no income event, and a change of hands reconciles both houses in either order, as tests.
- What one structure costs the fog per snapshot, against a house with a hundred holdings.
- Whether the face a revealed structure shows is the one standing on the day the fog hid it, as tests and by eye.

**The experience**, by eye:

- The structure's window and the Holdings tab at their sizes, with none, one and many holdings, and a slot
  row with empty places, portraits, items with amounts, question marks and more than fit.
- Whether a pennant and a size by level say whose a structure is and how great, without opening it.
- Whether the treasury counting up reads as a house growing rather than as a clock.

## Observations

**2026-10-08, the documents are written and nothing is built.** The interrogation moved four things. The
thing is a **structure**, not a building, so that a fort, a mine or a harbour need no stretch. Its culture
is the ground's and not the stone's: first proposed as fixed when raised, it became a map per master when
Adam said each master has its own culture, which also spared the server from choosing one. Slots hold
characters or items and never a count of nameless workers, though an item may carry an amount, which
covers a garrison and a granary's stores. And the gold ground drawn about every seat today becomes a
structure's influence zone, unique to its type and drawn only while it is selected.

**2026-10-08, the documents cross-checked against the brief.** Adam asked for every place the documents had
taken a freedom with his words to be put to him, and four things moved. **Sight is written down**: first
worked out from the catalogue whenever asked, as the seat's is, it is now written into the holder's history
like income, because retuning should never rewrite what a house saw; Adam chose it once a hand-over had been
laid out event by event. **The mill has nobody in it**: his brief gave it "multiple workers", the
interrogation gave it a miller, and the cross-check gave it neither, so it pays by its level. **Conditions
are the holder's alone**, not even a question mark to anyone else. And **Antarctica**: one of every type
stands there for Adam, held by nobody, with a lever to take control of one. One reading was confirmed rather
than changed: "a set number of relevant buildings" meant the sixteen types, not structures placed in the
world.

**2026-10-08, conditions out, and the names agreed first.** Shown every new event and what it means, Adam
took conditions out of scope altogether and renamed the slot events `slotFilled` and `slotEmptied`. Two
lessons went into the workflow rather than into this plan: a plan agrees its event names with Adam before
anything is built - `conditionHung` was "a really bad name" that nobody had been asked about - and a plan
says what its invariants are and which history holds each. The plan has a table of them now.
