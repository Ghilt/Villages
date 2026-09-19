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
| **World-time** | The story's clock: a year in the world's calendar. 1247. | The chronicle, and the map as it was at a given moment. |
| **Player-time** | The order in which things were actually done at a keyboard. Today, then tomorrow. | Arbitration between players, and the event store's own order. |

**The game is played chronologically.** The world moves forward and every house moves forward with it. A
house's history is written, not visited: what happened in 1247 happened once, while people were playing it,
and afterwards it is a thing to look back at rather than a place to return to.

The two clocks still differ, because a century of world-time does not take a century to play. How fast
world-time runs is not decided; see below.

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

- **How fast world-time runs**, now that nobody chooses which day to play. A real day was once a world day,
  and that was only ever a placeholder.
- **What the world's calendar is** beyond a count of days from the first day of year one.
