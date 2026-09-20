# The setting: the world, its time, and a house inside it

> **What belongs here:** what the world is made of, how its time works, and what a house is inside it — the
> fiction. **What does not:** what the player does with it (`MECHANICS.md`), what the engine behind it looks
> like (`ARCHITECTURE.md`), what is being built next (`ROADMAP.md`).

It records what Adam has described so that it is not lost between conversations, and it marks what is settled
and what is not. Where it speaks in his terms — house-spirit, key figure, power state — those are the words,
and they are in the glossary.

Reviewed 2026-09-19. Three things this document used to assert are gone, and the rest of the repository has
been corrected to match: play is chronological, so a session is no longer a visit to a chosen century; there
are no pins, so nothing obliges the past to have been a particular way; and the roll engine, renamed the
**fate engine**, is described in `ARCHITECTURE.md` rather than here.

## The world

A warped Earth, as the map already is, and a warped history to go with it: NPC factions and famous
characters drawn from real history and bent the way the coastlines are bent. The game takes place over
**centuries**. A player does not play one moment of it.

## Two clocks

There are two times, and everything that happens carries both.

| | What it is | What runs on it |
|---|---|---|
| **World-time** | The story's clock: a date in the world's own calendar, which is Earth's - uneven months, leap years and all. The world opened on the first of January, year 1200. | The chronicle, and the map as it was at a given moment. |
| **Player-time** | The order in which things were actually done at a keyboard. Today, then tomorrow. | Arbitration between players, and the event store's own order. |

**The game is played chronologically.** The world moves forward and every house moves forward with it. A
house's history is written, not visited: what happened in 1247 happened once, while people were playing it,
and afterwards it is a thing to look back at rather than a place to return to.

The two clocks differ by a fixed amount: **a real day is a world month**, the same for everyone. A month a
visit is what lets a house's history move at the pace a person actually plays at, and it makes a real year a
world year. **There is no fast-forward.** The world is shared, so its speed is not anybody's to change; a
player who could run time on would be running it on for everyone standing in it. See decision record 0051.

## A house

A house is a **bloodline**, not a roster. It has a handful of **key figures** the player acts through, and
uncounted unknown members behind them. There is **no losing**: if every key figure dies, someone rises to
the task. What a house has instead of a lose state is a **power state** — a house with no organisation and
one new key figure is in a low one, and one with a cathedral, a court and three key figures is in a high
one — and the power state rises and falls across the centuries.

## The house-spirit

What never falls is the **house-spirit**: the character a house has built through everything it has done,
expressed as traits, stats and special effects. A house that has been greedy and lazy and taken the path of
least resistance has those perks, and they colour the rolls it gets.

A house can suffer a takedown by the world and gain spirit bonuses that stay with it. That is how past
glories never fade: a low power state in one century is played with the spirit earned in all the others.

The spirit is mostly a **permanent progression**. Traits can fade by decision, if a player wants to recraft
their identity, and there may be short-lived bonuses. **Spirit items** are the example: guide the house down
an evil route and it earns a permanent sacrificial knife — a spirit item, not a physical one — that can be
applied to a decision to sacrifice a key figure at great cost. An item can be a spirit item or a physical
possession in the world; spiritness is an attribute of the item.

## Things that come to be, and cease to be

A cathedral, a key figure, a stretch of territory: each exists between the moment it comes to be and the
moment it stops, and what it is between those moments is shared by every house that can see it. One house
may raise a thing and another end it. In engineering terms each is its own stream with a lifetime in
world-time; see `ARCHITECTURE.md`.

## NPCs

NPC factions and famous characters have streams of their own: a decision AI plays them, and they work
roughly as human players do — but as a more constant force, some of them more the shape of the landscape
than a figure in it. An NPC house is a house; the difference is who issues its commands.

## Not decided

- **Whether the world really spans centuries at a month a real day.** Decision 0051 set the clock at one
  world month for every real day, which makes a real year a world year - so the centuries this document
  opens with would be centuries of real time. Either the span is years rather than centuries, or the clock
  is faster than a month a day. Nothing built so far depends on which, and the clock is one constant.
- **What the chrono-engine is for**, now that it is no longer the thing that chooses the day.
