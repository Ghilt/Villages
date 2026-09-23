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

Increment 5b landed: the four commands cross the wire and the whole path works, from a command in a browser
to an event in the store to a number changing on the card. Granting 1,204 wealth moved the card from 0 to
1,204; pledging 35 reason for ten months came back as a pledge ending on the first of August, 1792, which is
ten months after the world's own today. The events page needed no change at all to read the new types: it
spells `villages.house.resourcePledged.v1` as "resource pledged" from the type alone.

The one design point worth recording is that **months never reach the domain**. The wire asks for a span in
months, the application layer turns it into a world-day with the calendar, and the decider only ever sees a
day. That is the same seam the world clock uses, and it means the domain still knows nothing about what a
month is.

Increment 5c landed: a pledge gives itself back. One wake-up per pledge, at the instant the world reaches
the day it was pledged until, and nothing at all while a house has no pledges - decision 0006's "events on
change, never on a clock" applied to something that is not a rate.

Two things were learnt writing it. **`plusMonths` and `monthsBetween` are not exact inverses**: a month
added to the thirty-first of January lands on the twenty-eighth of February, which is not a whole month
later. An independently generated fixture caught that, against my own wrong expectation written in a test
name. It never bites, because the world opens on the first of a month and only ever adds whole months, so
every day it produces is the first of a month - but it would bite the day somebody opens the world on the
thirty-first, and the fixture now pins the case.

And **the timer does not cancel**. A pledge released early still has a wake-up coming; when it arrives the
decider refuses it and the refusal is swallowed, which is what `Arrival` already does for a question the
world has moved past. Keeping a cancellation table in step with the stream would be more machinery and one
more thing to be wrong.

**The overnight check failed, and the reason is worth keeping.** I pledged 35 reason for one month in the
live world, due at 2026-09-23T00:00Z, and said the release would be in the events page by morning. It was
not. The machine slept overnight - Windows logged a return from low power at 08:30 - and a `Later` delay is
measured by `System.nanoTime()`, which on Windows does not advance across sleep. The wake-up is still
pending, hours behind the wall clock.

Nothing about the mechanism is wrong: `PledgesSpec` proves the arithmetic and the release, and a server
that does not sleep would have fired on time. But it says a long single timer is a thin thread to hang a
game rule on, and the mitigation already written - a replay on restart schedules an overdue pledge at once
- cannot help while the world is in memory and dies with the process. The fix, when it is wanted, is to cap
the wait and re-arm rather than sleep the whole span in one go; that costs a periodic wake while any pledge
is outstanding, and nothing at all when none is, so it stays off the clock in the sense decision 0006
means. Not done: it is a decision rather than a tidy-up.

The honest reading is that this was a bad verification to promise. A check that takes seventeen hours and
depends on a desktop staying awake is not a check.

Increment 6 landed: five marks on the house card, and a **Resources** fold in the debug panel with give,
take and pledge on every one of them and release on every live pledge. The whole loop is a button now.
Pressing give moved the panel, the card and the log together; a misdirected press tried to pledge 100 piety
against 40 and came back `rejected: notEnoughFree`, which was a better demonstration of the refusal path
than the one I had planned.

## Result

**Confirmed for the infrastructure, and not yet tested where it matters.**

One shape carried all three behaviours without a second kind of thing appearing anywhere: `freeOf` means
the same for domain as for reason, `has` is that question asked without subtracting, and the only thing
that distinguishes wealth is which commands anybody sends it. Nothing in the build wanted a `Spendable`
apart from a `Bindable`.

But the hypothesis was about whether a *mechanic* could be built on the shape, and no mechanic has been.
What is confirmed is that the shape can be built and driven; what is untested is whether the first real
rule that needs a resource finds the shape sufficient. That is why this stays open.

Two things were better than expected. Deriving what is pledged from the list of pledges rather than storing
it made the release `filterNot` and no arithmetic at all. And the marks, which were the part most likely to
fail, failed in a way that was visible in thirty seconds of looking - dividers with a crossbar read as a
capital A - and were fixed before anybody had to live with them.

One thing was worse. **A seventeen-hour verification is not a verification.** The pledge timer's overnight
check failed because the machine slept, and no amount of correct arithmetic in a test would have told me
that; it took the check failing. The lesson is about what to promise in a checklist, not about the timer.

## Decision

**Keep.** The shape stands and the next question is what fills it. Nothing here needs reworking first.

## Follow-ups

- **A mechanic that uses a resource**, which is what actually tests the hypothesis. On the roadmap.
- **Income**, which turns the rate shape from something carried to something used.
- **The pledge timer's long wait**, which is monotonic and so is wrong after a machine sleeps. Capping the
  wait and re-arming would fix it; it is a decision rather than a tidy-up and nothing needs it yet.
- **The marks**, which are placeholders and say so in `MECHANICS.md`.

## Decision

Open.

## Follow-ups

Open.
