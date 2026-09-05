# The setting: the world, its time, and a house inside it

`VISION.md` says what the experience is. This says what the world is and how it works: its calendar, how a
house lives in it, and the engine that keeps its history consistent. It is a live document, not a decision
record. It records what Adam has described so that it is not lost between conversations, and it marks
what is settled, what is a proposal, and what is still to be ironed out.

Recorded from the conversation of 2026-09-04, to be discussed further. Where this document speaks in
Adam's terms - chrono-engine, pin, house-spirit, key figure - those are the words, and they are in the
glossary.

## The world

A warped Earth, as the map already is, and a warped history to go with it: NPC factions and famous
characters drawn from real history and bent the way the coastlines are bent. The game takes place over
**centuries**. A player does not play one moment of it.

## Two clocks

There are two times, and everything that happens carries both.

| | What it is | What runs on it |
|---|---|---|
| **World-time** | The story's clock: a year in the world's calendar. 1247. | The chronicle, the map at a given moment, the timeline scrubber, pins. |
| **Player-time** | The order in which things were actually done at a keyboard. Today, then tomorrow. | The house-spirit, arbitration between players, the event store's own order. |

Today every event carries one instant that is both at once, because they have never differed. They will.

A session is played **at some world-time**. Today you might play your house in 1547; tomorrow in 1399.
The world-time of a session is not chosen freely from a menu - how it is chosen is one of the questions
below - but the principle is that a house's history is visited, not only extended.

## A house

A house is a **bloodline**, not a roster. It has a handful of **key figures** the player acts through, and
uncounted unknown members behind them. There is **no losing**: if every key figure dies, someone rises to
the task. What a house has instead of a lose state is a **power state** - a house with no organisation and
one new key figure is in a low one, and one with a cathedral, a court and three key figures is in a high
one - and the power state rises and falls across the centuries.

What never falls is the **house-spirit**: the character a house has built through everything it has done,
expressed as traits, stats and special effects. A house that has been greedy and lazy and taken the path
of least resistance has those perks and they colour the rolls it gets. Establish that the house is
good-hearted while playing 1547 and that trait is there the next day playing 1399, because the spirit
lives in **player-time**, not world-time. Traits need not be permanent, but they do not care about the
chrono jump. This is how past glories never fade: a low power state in one century is played with the
spirit earned in all the others.

On the map a house has **influence zones**: geographic areas drawn as fences. The most common is plainly
owned or controlled territory; others will be other kinds of reach. This is the second thing on the map
after a seat.

## The chrono-engine

The player does not have a build menu and does not wait for resources to trickle in to afford a cathedral.
When the player chooses to **take action**, the chrono-engine **rolls** a small set of things that could
happen at this moment in world-time, from the house's stats, its spirit, where the player is looking, and
what is around. The player picks one. Rolls have rarity - common event chains, rare actions, stat gainers -
and a legendary roll is an occasion.

A roll can name something that does not exist. *Key figure Miriam prays at the cathedral of St John's* -
and there is no cathedral. The engine does not refuse the roll. It **pins** the fact: a cathedral of St
John's exists here at this world-time, so one must have been built before it. That pin is an obligation
on the past. Pins go the other way too: if that cathedral stands where, in a later century, an epic battle
is fought on a bare field, then the cathedral is pinned to be destroyed before the battle. That is an
obligation on the future.

**The chrono-engine owns the pins and keeps the world from contradicting itself.** Existence and
non-existence is the invariant that matters most: a thing exists between the moment it comes to be and the
moment it stops, and every pin is a constraint on that span. Pins are shown to the player on the timeline
scrubber as something vague and cloudy that fades - a fact the world has committed to but not yet told.

The past is **shared**. Every player acts in the same world across the same centuries, and they see each
other's recorded past: what House A did in 1247 yesterday is there when House B plays 1247 today.

## Filters are an input, not just a lens

The map has filters - overlays, views, call them what you like - and the player starts with very few
visible, so that nothing overwhelms. But a filter is not only what is shown. **Which filter the player is
looking through, and where, is an input to the roll.** Looking through the mystical filter at a cell far
from any influence might roll *Far away rumours* (common, an event chain), *Launch an expedition to
Panama* (rare, an action), *Miriam meditates* (a stat gainer). The interesting decisions are sought out by
looking.

## Significance, and what is shown at each zoom

Adam's proposal, replacing the idea that events carry a map cell: an event carries **a coordinate and a
significance**. Significance is how much a thing matters to the world, and it decides how far out it is
still visible. A hundred is visible at any zoom. The cell an event falls in is derived from the coordinate
by whoever needs to partition - it is not something the world knows about.

## What this asks of the architecture

Proposals, flagged as such. None is decided; each will become a decision record when it is.

1. **Two times on every event.** `at` today is both; it becomes world-time and player-time, and the
   catalogue in `EVENTS.md` carries both on every row. Cheap now with one event type, annoying later.
2. **Retroactive play appends at the head.** Playing 1247 today records an event *now* whose world-time
   is 1247. The stream only grows; nothing is rewritten; the event store's guarantees survive intact.
   Recording order is the order of truth, and **recording order arbitrates the shared past**: two players
   who touch the same thing in the same century are ordered by who recorded first, exactly as the store
   already orders everything. The second is told what is already there and rolled other options.
3. **Things with lifetimes are their own streams.** A cathedral pinned by one house's roll and destroyed
   by another's battle is shared state, so it cannot live inside a `House`. Places, structures and key
   figures become aggregates with a lifetime `[from, to)` in world-time. One stream per house becomes one
   stream per thing that can exist.
4. **A pin is an event, and an open pin is an obligation.** `CathedralPinned(place, existsBy = 1247)` is
   recorded like anything else. The chrono-engine is a policy over the projection of open obligations:
   it discharges them - by rolling the construction into the chronicle, or by leaving a debt the world pays
   later - and it checks each new command against them. Each thing's lifetime is a small interval
   constraint problem of its own, which is what keeps consistency per thing rather than global.
5. **The map is a temporal read model.** Features carry `[from, to)`, and the map at world-time T is a range
   query: `from <= T < to`. A retroactive event inserts a feature; a destruction sets its end. No re-folding
   for the map, and the timeline scrubber is the same query with T moving. The house-spirit is a second
   fold over the same events in **player-time** order.
6. **Cell is derived, not carried. Decided: see decision record 0026.** The event carries a place and a
   significance; the cell is a quadkey at any zoom, computed by one shared, tested function wherever
   partitioning happens, and unknown to the domain.
7. **Zoom is significance plus the pyramid. Decided with the above.** A cell's ancestor is its prefix, so a
   tile's contents are a prefix match at any zoom, and significance decides how far out a thing is still
   drawn. The client asks for data on the same grid, at the same zoom, as the terrain tiles it draws.

The first increment on this path is deliberately tiny: a world calendar, the two times on `HouseFounded`,
and a scrubber that shows foundings across world-time. That proves the model before a single pin exists.

## Open questions, to iron out

- **How is a session's world-time chosen?** Rolled? Offered as a few eras? Tied to where the house is
  strong or weak, so a low power state is what makes a past glory worth visiting?
- **What can a player in the past see of the recorded future?** Everything, nothing, or only the pins?
- **What does a pin look like when it cannot be discharged?** Two pins on one place that no lifetime
  satisfies. Does the engine refuse the second roll, rewrite one, or let the chronicle carry a contradiction
  as a mystery?
- **Do NPC factions and famous characters have streams and pins of their own,** or are they scenery the
  engine reads from a script?
- **Which traits of the house-spirit are permanent, which fade, and on what clock** - player-time sessions,
  or something else?
- **What is the smallest set of influence zones**, and is territory a thing with a lifetime like a
  cathedral?
- **How many kinds of filter**, and does each have its own roll table or does the filter merely weight
  one table?
