# 0005. Five resources of one shape

- Status: open
- Started: 2026-09-20

## Hypothesis

One shape — a total, a rate, and the portions of it pledged away for a span — is enough to carry all three
ways a resource is meant to behave, so that wealth that is **spent**, domain and influence that only
**gate**, and reason and piety that are **pledged** need no second kind of thing between them.

If it is right, a mechanic that wants a new resource adds a row to an enum. If it is wrong, the first real
mechanic will want a behaviour the shape cannot hold, and we will find out which of the three it was.

## Setup

The infrastructure and nothing else: the value types, the events for granting, spending, pledging and
releasing, the read model, the wire, the marks on the house card, and the levers in the debug panel that
make each one happen on purpose. No mechanic spends anything, no gate has a caller, and no pledge researches
anything, because what the resources are *for* is the next question and not this one.

Every rate starts at zero, including wealth's, which means the treasury stops ticking. The rate shape is
built anyway so that income, when something finally generates it, is a number changing rather than a frame
changing. See decision record 0006.

Two things had to be settled before any of it could be written down, and each got its own decision:
a real day is a world month, so that a pledge can be given in months (decision 0051), and an area is the
technical thing a map region is, so that **influence** is free to be the name of a resource.

## What we will look at

- **Whether the gate and the pledge really are one shape.** The test is the code: if `free` ends up meaning
  something different for domain than it does for reason, the hypothesis is refuted and there are two kinds.
- **Whether a pledge reads as a pledge.** Adam pledges 35 of a house's reason for a month in the debug
  panel, watches the card show 65 free of 100, and says whether the split is legible without explanation.
- **Whether the marks carry five abstract ideas.** Five glyphs have to be told apart at 24 pixels and each
  has to say something as woolly as "standing". This is the part most likely to fail, and the fallback is
  words, which is a known cost rather than a risk.
- **What the card does at its small size and on a phone**, where it used to be one line with one number on
  it and now has five things to say.

## Observations

Increment 1 landed: the world keeps Earth's calendar and a real day is a world month. Nothing surprising in
the arithmetic; the surprise was where it had to live. The application layer may depend on the domain and on
nothing else, and the calendar is in `protocol`, so the world clock could not simply call it — the month
step crosses as a `WorldCalendar` port. That is the layer rules doing their job rather than getting in the
way, and it kept the clock a pure policy class with a test.

**The store was wiped, under the pre-alpha exception** (`EVENTS.md`, decision 0011). `villages.house.founded.v1`
traded its `treasury` for a `resources` map of five stocks, which is not an added optional field and would
normally be a `v2`. The catalogue test demands exactly one row per event class, so a v1 row with no v1 class
fails the build, and there is no upcaster machinery yet; the exception exists for precisely this and the
world is in memory, so the wipe was a restart. Recorded here because the exception says every use of it is.

Increment 4a landed: five resources of one shape, and wealth replaced the treasury. The wire did not move -
the gateway maps the wealth stock onto the `treasury` field the frame has always had - so this step changed
what the world holds without changing what it says. The visible consequence is that **the treasury stopped
ticking**: every rate is zero now, and the one live number on the screen stands still.

Increment 4b landed: the four verbs. **The first observation against the hypothesis is in, and it holds so
far.** A gate and a pledge really are one shape - `freeOf` means the same thing for domain as it does for
reason, and `has` is that same question asked without subtracting. Nothing needed a second kind of resource.

The part that came out better than expected is the release. Because what is pledged is the sum of the live
pledges and not a stored number, releasing one is `filterNot` and there is no arithmetic anywhere to get
wrong or to drift. That is the derivation rule paying for itself rather than costing.

**Nothing of 4b can be seen in the running program yet**, and that is worth saying plainly rather than
glossing. The four commands have no caller: the wire gains their payloads in increment 5 and the debug
levers arrive in 6. What stands in for a panel line is twelve decider tests and three projection tests,
including the one that matters most - that a grant reaches the row and tells the watchers, which is the
path to the player's screen.

Increment 5a landed: the wire carries the five, and **what a house has became private**. That was not in
the hypothesis and it fell out of arithmetic rather than principle - a `houseView` goes to everyone holding
a cell, up to two hundred at a time, and five stocks on it would have been twenty numbers a house on every
snapshot. Putting them on a `yourHouseView` instead made snapshots smaller than they were before and made
the privacy structural: there is nowhere on the public view for a resource to leak from.

Two things fell out of it that were not planned. The inspect window lost its treasury line, because a
neighbour's wealth is not public, and with it the last thing in that window that moved - so its redraw loop
went too. And `stockNow` finally moved into `client-core`, which makes that package's own description
("state, the protocol codec, the connection, cell maths and resource interpolation") true for the first
time; it had been claiming that for months while the function lived in a pane.

## Result

Open.

## Decision

Open.

## Follow-ups

Open.
