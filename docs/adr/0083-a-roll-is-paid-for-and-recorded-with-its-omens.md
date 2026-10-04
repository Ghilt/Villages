# 0083. A roll is paid for, and recorded with its omens

- Status: accepted
- Date: 2026-10-04

## Context

The choice roll is the core loop, and until now nothing has rolled: the only choice a house is ever given is
the founding one, handed out on arrival. Adam described the loop on 2026-10-04 and settled its shape over
fifteen questions; the plan is `docs/plans/choice-roll.md`.

A roll is provoked by the player pressing **Take action**, it costs ten wealth, and the game shows the player
every **omen** it took into account before dealing a hand of options of one **rarity**. `ARCHITECTURE.md` had
said, before any of this was known, that a roll is not a decision of the domain: the fate engine proposes,
the player disposes, and only the taken option becomes an event. That sentence was written for a roll that
cost nothing and showed nothing.

Three things have to be settled: whether the roll is an event at all, where the randomness lives, and how
the hand it deals is told apart from any other choice.

## Decision

**A roll is a decision of the house, and it is recorded.** Pressing Take action is the player reaching into
the world on purpose, and it costs something, so it is a fact of the house's history: `PlayerRolled`,
`villages.player.rolled.v1`, carrying the roll's id, every omen it read and the rarity it drew. In the same
decision the price is spent, `villages.house.resourceSpent.v1`, and the hand is given,
`villages.player.givenChoice.v1`: three events, one correlation, consecutive versions. Nothing can see a hand
without its roll, or a roll that was not paid for.

**The randomness is the application's, before the command.** The fate engine works out the omens, rolls the
rarity with the dice port and deals the hand, and sends all of it to `decide` as one `Roll` command. `decide`
only checks and records: the house is founded, no choice is pending, the price is free. It never rolls, so
replaying a stream gives the same history whatever the dice would say today.

**The price is a spend carried on the command.** The application says what a roll costs, ten wealth for now,
and the domain treats it as it treats any spend: refused unless that much is free. The number can change, or
become another resource, without touching the domain.

**The omens are recorded whole and in order,** each with its key, its kind, its words and its value, as a
choice's options are. They are history: the next roll's *Piety risen* is worked out against what the house
had at this one, and they answer "why was I offered this?" for as long as the stream exists.

**An option of a rolled hand carries its rarity and the keys of the omens that brought it.** Both are absent
on an option nothing rolled, the founding ones included, and an absent field reads as absent, so stored
events are read as they were written (0074) and nothing is wiped.

## Consequences

- One sentence of `ARCHITECTURE.md` is replaced: a roll is a decision now. The engine still proposes and the
  player still disposes; what changed is that proposing costs something, so it is remembered.
- The player's half of the events grows by one, which decision 0034 asks to happen rarely. It is the core
  loop's own event, so it is worth it.
- A pending rolled choice holds back every other roll, as one pending choice already holds back any other
  choice. That is Adam's rule as well as the domain's: the hand must be answered, it can only be set aside.
- What a roll costs in wealth is visible on the stream as an ordinary spend, so the treasury, the map
  projection and the debug panel need nothing new to show it.

## Alternatives considered

- **Keep the roll out of the domain and record only the taken option.** The price would have to be spent
  in a separate command, so a roll could be paid for and not dealt, or dealt and not paid for, and the omens
  would be lost: nothing could later say why a hand was what it was.
- **Roll in `decide`, with the dice passed in.** It would make the decider depend on a port and the history
  depend on the dice at replay. The domain is the rules, not the luck.
- **Put the omens on the given choice instead of on a roll.** A choice can be given by things that are not
  rolls, arrival today and the world later, and none of them has omens. The roll is the fact the omens
  belong to.
