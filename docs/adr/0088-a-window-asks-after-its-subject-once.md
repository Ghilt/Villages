# 0088. A window asks after its subject once, and is answered by the fog's rule

- Status: accepted
- Date: 2026-10-07
- Answers the roadmap's "an inspect window that stays up to date", more cheaply than it sketched: an answer, not a
  subscription. Adam's words of 2026-10-07.

## Context

An inspect window is fed from the cells the camera holds. Pan away from a house and the window had nothing to say,
and said so: *Out of view. Pan back to it, or pick something else.* Adam's words: the inspect view should not be
affected that way; it does not matter whether we are in the right part of the map; the whole purpose of a window is
to get some information about a thing and then perhaps do something else.

The page now remembers what each window last said, so a window panned away from keeps saying it. What it cannot do
is say anything of a thing the camera has never held: a window opened from the trail after a reload, or a line of a
dialogue showing a house far away. That needs the gateway.

The roadmap sketched a subscription: a window open is a frame, the gateway keeps it and sends the subject's changes
until it closes. Adam's question was whether that is cheap, and whether anything polls; and his expectation that
most things a window shows very rarely change.

## Decision

**A window that knows nothing of its subject asks the gateway after it, once, and is answered once.** The page
sends `inspect` with the subject's kind, `house` or `character`, and its id; the gateway answers `inspected` with
the house or the character as the map would show it, or with neither. There is no subscription, nothing is kept of
the asking, and nothing is sent again. Nothing polls. A page asks once a connection, so a new connection asks again,
and asks only when it can say nothing: what the cells hold, and then what the window last said, come first.

**The answer is held to the rule a cell's snapshot is held to**: the day the connection is looking at, and what its
fog lets through (0061). A house on ground the player's house has revealed is answered, and one on unknown ground is
not; a person is answered while they stand in its vision, and not once they have left it; the player's own house
and people always. A thing there is none of, an id that is no id and a kind that is no kind are all answered with
neither, never refused.

**It is a part of its own in the gateway**, `InspectingPart`, asking the houses' read model for a house by its id,
which it already offered, and the characters' for where one person stood on a day, which it now offers.

**Wire version 25** carries the two frames.

## Consequences

**A window can show something it has never seen on the map**, as far as the fog lets it: a house on revealed ground
however far the camera is from it. Under the fog it still says *Nothing known of it yet*, and never sends the
player to pan back.

**An answer can go stale.** A window answered and then left open while the house is renamed somewhere the camera is
not shows the old name until the house comes into a held cell, whose own changes reach it, or the page reconnects.
That is the price of not keeping a subscription, and Adam's reading is that it is a small one.

**A window answered with nothing does not ask again on that connection when the fog moves**: a house whose ground
the player's house goes on to reveal, or the fog lifted with Adam's switch, is answered on the next connection - a
reload - or once its cell is held. Asking again whenever the sight changed would be a frame a window for every
step a key figure takes.

**A person who leaves the house's vision while their window is open goes on showing what was last said of them**,
as any window does since the page learnt to remember; asked after only once they have gone, they are answered with
nothing.

## Alternatives considered

- **A subscription**, as the roadmap sketched it: the gateway keeping every open window and fanning each subject's
  changes out to it. Never stale, and a set of windows per connection to keep, clear and fan out to, for changes that
  hardly happen. If windows ever need to be live, this is what they become.
- **The page asking every time a window opens.** One frame a window rather than one a subject a connection; it
  answers a staleness that is rare, for traffic that is not.
- **No fog**: a window answered with whatever it asks after. A window would then be a way to see through the fog.

## Amendment, 2026-10-11: a structure is asked after the same way

A window on a structure asks after it as one on a house does: `inspect` with the kind `structure`, answered once
by `inspected` carrying its `StructureView` in the face its cell would send - today's where the house sees or holds
it, the one it last saw on revealed ground with `seenUntil`, and nothing on ground never revealed. Nothing new is
kept: the read model already holds every face, so the answer is the fog's choice among them. Wire version 36. See
docs/plans/structures.md, step 5a.
