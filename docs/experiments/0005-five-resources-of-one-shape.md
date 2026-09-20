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

## Result

Open.

## Decision

Open.

## Follow-ups

Open.
