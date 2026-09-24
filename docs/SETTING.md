# The setting: the world, its time, and a house inside it

> **What belongs here:** what the world is made of, how its time works, and what a house is inside it — the
> fiction. **What does not:** what the player does with it (`MECHANICS.md`), what the engine behind it looks
> like (`ARCHITECTURE.md`), what is being built next (`ROADMAP.md`).

It records what Adam has described so that it is not lost between conversations, and it marks what is settled
and what is not. Where it speaks in his terms — house-spirit, key figure, power state — those are the words,
and they are in the glossary.

Reviewed 2026-09-20, when the age and the gods were written down for the first time. Reviewed 2026-09-19. Three things this document used to assert are gone, and the rest of the repository has
been corrected to match: play is chronological, so a session is no longer a visit to a chosen century; there
are no pins, so nothing obliges the past to have been a particular way; and the roll engine, renamed the
**fate engine**, is described in `ARCHITECTURE.md` rather than here.

## The world

A warped Earth, as the map already is, and a warped history to go with it: NPC factions and famous
characters drawn from real history and bent the way the coastlines are bent. The game takes place over
**centuries**. A player does not play one moment of it.

**The world opened on the first of January, 1790**, and it keeps Earth's calendar and Earth's years: the
months, the leap years and the count are all the ones a reader already knows. A warped Earth is still an
Earth, and a date in it should need no conversion.

## The age

**An enlightenment, interrupted.**

Reason is spreading and has been for a while: instruments, presses, academies, letters between people who
will never meet. It is not a clean break from what came before. Castles still stand and are still worth
holding; a cathedral is still the largest thing for a hundred miles. The new is growing up through the old
rather than replacing it, which is what an enlightenment actually looks like from inside one.

And it is being interrupted. **The social order that held is not holding.** Cities that worked have stopped
working - not sacked, not burned, just no longer functioning, in ways nobody can name the cause of. Where
the order broke, **new factions rose into the gap**: whatever can organise people now does, and some of what
can is nothing anybody would have chosen.

To everyone living through it this is a calamity with no author. A bad century. A run of failures. Judgement,
or somebody's fault, or the weather. Every explanation the world offers is wrong.

## The gods

**This section is the truth, and no player begins knowing any of it.**

The gods are **aspects of what people are** - not a pantheon that a culture invented and can un-invent, but
the things themselves, wearing whatever shape an age hands them. The Greek gods were one such shape: a set
of masks worn for a few centuries and then set down. They are not attached to those forms, they do not
answer to those names now, and a player who recognises one by its Greek face is recognising a costume.

**They took fright at the enlightenment, and they did something about it.** The apocalypse is what they did.
It is deliberate, it has authors, and the authors are frightened rather than wicked - which is a different
kind of antagonist and the more interesting one.

**It is not going to plan.** They had traitors in their midst. At least one of them liked the enlightenment
and broke the plan from the inside, and the disruption is now as chaotic for the gods as it is for anybody
standing in it. They are not a single will executing a design. They are a divided party half-way through
something that is already going wrong, improvising, and working against each other while they do it.

### What the player knows, and when

A player begins knowing none of the above. What they meet is a world that has stopped working and a set of
explanations that are all wrong. That the calamity has an author at all is a **discovery**, arrived at
through storylines over a long time, and it is the discovery the whole setting is arranged around.

**So nothing in the interface may state it.** Piety is piety as the age understands it - observance, standing
with the church, what a house owes and is owed - and never a wire to a god. A resource, a mechanic or a line
of dialogue that gives the game away early spends the only card the setting is holding. Where something must
gesture at it, it gestures the way the world would: as a coincidence, a bad omen, or a man who will not
explain how he knew.

## Two clocks

There are two times, and everything that happens carries both.

| | What it is | What runs on it |
|---|---|---|
| **World-time** | The story's clock: a date in Earth's calendar - uneven months, leap years and all. The world opened on the first of January, 1790. | The chronicle, and the map as it was at a given moment. |
| **Player-time** | The order in which things were actually done at a keyboard. Today, then tomorrow. | Arbitration between players, and the event store's own order. |

**The game is played chronologically.** The world moves forward and every house moves forward with it. A
house's history is written, not visited: what happened in 1793 happened once, while people were playing it,
and afterwards it is a thing to look back at rather than a place to return to.

The two clocks differ by a fixed amount: **a real day is a world month**, the same for everyone. A month a
visit is what lets a house's history move at the pace a person actually plays at, and it makes a real year a
world year. **There is no fast-forward.** The world is shared, so its speed is not anybody's to change; a
player who could run time on would be running it on for everyone standing in it. See decision record 0053.

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

- **Whether the world really spans centuries at a month a real day.** Decision 0053 set the clock at one
  world month for every real day, which makes a real year a world year - so the centuries this document
  opens with would be centuries of real time. Either the span is years rather than centuries, or the clock
  is faster than a month a day. Nothing built so far depends on which, and the clock is one constant.
- **What the chrono-engine is for**, now that it is no longer the thing that chooses the day.
- **Why the gods took fright.** That they did is settled; what exactly about reason spreading frightened
  them is not, and it is the question every storyline about them eventually has to answer.
- **How many gods there are, which ones, and who broke the plan.** Also whether a house can side with the
  traitor, and whether that is a route or an ending.
- **Whether the apocalypse can be stopped**, survived, or only lived through. The house has no lose state;
  the world might.
- **How far into the enlightenment the world opens**, and how much of the interruption has already happened
  when a player founds their first seat.
