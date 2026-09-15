# 0034. A choice is put to a house on its own stream, and an action takes one option

- Status: accepted
- Date: 2026-09-15

## Context

The first gameplay loop. Adam's description: the player is given a choice, which the interface shows as
a parchment over the map with the options as buttons; the first choice is where to found the house,
three places across the map; picking one records both the action and the founding, every event with an
event id and a correlation id. He named the events in his own words, `PlayerGivenChoice` and
`PlayerTookAction`, and asked for good event-sourcing standards and a way of working that does not need
the events explained each time.

Five things have to be decided before the first line of code: whose stream a choice is recorded on;
what an option carries; how the action and its consequence stay together; where three seats come from
when the server knows nothing of terrain; and what a house founded by other means does to a choice that
was pending. Decision 0024 left the first of these open, in so many words: is the player an aggregate
with events, or only a subject on the house's?

## Decision

> Two of the names below were changed by the amendment at the end of this section: `HouseGivenChoice`
> and `HouseTookAction` are `PlayerGivenChoice` and `PlayerTookAction` now, and their types are
> `villages.player.*`. What was decided is left as it was written.

**A choice is put to the house, on the house's own stream.** `HouseGivenChoice` and `HouseTookAction`
are house events, `villages.house.givenChoice.v1` and `villages.house.tookAction.v1`, beside
`villages.house.founded.v1`. A player's house has the player's identity (decision 0028), so the stream
exists before the house does and the founding choice is its first line. The vision says decisions are
taken in the house's name and remembered as the house's history; this makes that literally so.

**A choice is a prompt and two to four options, and an option carries its effect.** The effect is what
taking the option does, a sealed type in the domain whose only case today is founding the house at a
seat with a name and a banner. The event is therefore self-describing: a reader of the stream can say
what each road not taken would have done, without any code that remembers.

**One decision yields the action and its consequences.** Taking a founding option yields
`HouseTookAction` and then `HouseFounded` from one call to `decide`, appended atomically, at consecutive
stream versions, under one correlation id. There is no reaction, no second aggregate and no second
write to wait for. What the option promised is what the stream says happened.

**One choice is pending at a time, and the decider keeps it so.** A second is refused as
`ChoicePending`; an action with nothing pending as `NoChoicePending`; the wrong choice as
`NoSuchChoice`; an unknown option as `NoSuchOption`. These rules live in `decide` and nowhere else,
because a projection is a moment behind the stream and a rule read from one can be stale. A house
founded by other means, the debug button or a seed, has no use for a pending choice about *where to
found*, so `evolve(HouseFounded)` drops one and keeps a choice about anything else: founding by any
means settles the founding question and answers nothing else. The keeping half has no case to arise in
until a second kind of effect exists, and so no test until then; the rule is written for when it does.

**Each option is a destiny.** The giver generates a seat, a house name and a banner per option,
deterministically from the player, so the parchment reads as a chronicle and `decide` stays generic:
it turns an effect into events and never invents content. Naming the house yourself is a later choice
of its own.

**The seats come from a gazetteer.** A hand-kept list of named inland places in the server, from which
the founding choice draws three in three distinct regions. The server knows no terrain, so each seat is
checked against every master with a script before it is kept. When Adam wants to author seats himself,
they move to a data file beside the other world files; the code does not care where the list comes from.

**The encoding extends decision 0024 by one rule:** a field whose type is sealed carries `kind`, naming
its case. The domain stays free of annotations; the store adapter says how the sealed type is written.
Event types gain camelCase verb phrases, `givenChoice`, since the fact is not always one word.

### Amended 2026-09-15: an event is the world's or the player's

Adam drew a distinction the first cut did not have, and it is the right one. **Being asked something and
answering it are not happenings in the world.** They are the mechanics by which a player reaches into it.
A house being founded is a happening in the world; the parchment that led to it is not.

So the events are in two halves, and both the code and the catalogue say which:

| | The world's | The player's |
|---|---|---|
| What it is | something came to be, moved, changed or ended | something a player did to reach into the world |
| Type | `villages.house.<verb>.v<n>` | `villages.player.<verb>.v<n>` |
| In the code | `WorldEvent` | `PlayerEvent` |
| Today | `HouseFounded` | `PlayerGivenChoice`, `PlayerTookAction` |
| Expected to | **grow**, with every feature that puts something in the world | **stay small**; if it grows as fast as the other, the game has become a menu |

`HouseGivenChoice` and `HouseTookAction` are therefore `PlayerGivenChoice` and `PlayerTookAction`, and
their types moved from `villages.house.` to `villages.player.`. That is a breaking change to two event
types, taken under the pre-alpha policy of decision record 0011 and costing nothing: the store is in
memory and nothing written before the change outlives the process that wrote it.

**Both halves stay on the house's stream**, `house:<uuid>`, and the decision above is unchanged. The
stream is the consistency boundary a decision is taken inside: the action answering a choice and the
thing that action does come out of one `decide` and are appended together, and splitting them across two
streams would put a gap in the middle of that. The stream says where an event is kept; the type says what
kind of thing happened. What would change our minds is a choice that is not about one house - a bargain
between two of them, say - which cannot sit on either stream and is the thing-with-a-lifetime pattern of
`SETTING.md` rather than this one.

The split is visible where it matters: the event viewer marks every line world or player, and the
catalogue has a table for each.

## Consequences

Adding a kind of choice costs a new effect case, the `decide` branch that turns it into events, a giver
with the words, and catalogue rows for any new consequence events. It costs no frame and no interface,
because the parchment renders any choice from its words. `docs/MECHANICS.md` is the method.

The stream of a house reads as its chronicle: offered three seats, took one, founded there. The debug
panel shows it in exactly that order, three lines with one correlation tag.

Every seeded bot now leaves a `givenChoice` behind when it says hello, before it founds directly. That
is honest, a player arrived and was offered seats and founded elsewhere, and it is one extra event a
bot. A seed that takes one of its offered seats instead is a follow-up.

Generated words, labels and details, are content in the store. Regretting a phrasing means a new
version or the pre-alpha wipe of decision 0011, which is the cost accepted.

A choice that spans two houses, a neighbour's offer, does not fit one stream. That is the
thing-with-a-lifetime pattern of `SETTING.md`, and it gets its own decision record when it comes.

## Alternatives considered

- **A `Player` aggregate**, `player:<uuid>`, with `PlayerGivenChoice` and `PlayerTookAction`, and a
  reaction that subscribes to the feed and issues `FoundHouse` to the house stream with the action's
  event id as causation. The textbook answer for two aggregates, and roughly forty percent more work:
  a second decider, catalogue section and type mapper, a reaction runner with at-least-once semantics,
  and one more reaction for every future consequence of a choice. The two events can also be observed
  apart. Adam chose the house's stream on 2026-09-14; worth revisiting when a player has things worth
  remembering that are not the house's, which `SETTING.md` says the house-spirit will be.
- **Options as seats only**, the name and banner drawn when the house is founded. That puts content
  generation into `decide`, or into a read the action service makes for one kind of effect. Declined.
- **Flat nullable fields on an option instead of a sealed effect.** Friendlier to versioning, and
  `decide` would switch on nulls. Declined while there is one effect; the fallback if the sealed
  encoding fights back.
- **A client-authored choice.** The browser knows the terrain and the server does not. But a choice
  the server did not give is not the world's, and a client naming what it may do is what 0028 removed.
