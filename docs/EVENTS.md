# Event catalogue

> **What belongs here:** every event type the world can record, its payload and its meaning. **What does
> not:** why the events are shaped as they are (decision records 0024 and 0034), or how to add one
> (`BUILDING-A-MECHANIC.md`).

Every domain event in the world. Events are the only durable state: they are never edited and never deleted, so this
catalogue is the contract between the past and every future version of the code.

This file is parsed by a test. The domain's catalogue test reads the tables below and fails if the code and the
catalogue disagree in either direction, in the set of events or in the fields of any one of them; from increment 1.5
the event store's type mapper is held to the same rows. Keep the format exactly as described:

- Every row of every table in this file is read, so a table may go under any heading that suits it.
- Columns, in order: Type, Payload, Meaning, Produced by, Consumers.
- The Type cell holds the CloudEvent type in backticks and nothing else.
- The Payload cell lists field names in backticks, separated by commas.
- Rows are ordered by version, then alphabetically.

## What an event carries

Every event carries **two times**: `worldTime`, the day in the world's own calendar on which it happened,
counted from the first day of year one; and `recordedAt`, the server's instant when it was written down.
They differ whenever the past is played. The map at a moment and the timeline order by the first; the
store and the house-spirit order by the second. See decision record 0027.

Every event also carries **where it came from**, on its envelope rather than in its data: its own
**event id**, the **correlation id** of the story it belongs to, and the **causation id** of the
message that directly caused it. Everything written by one command shares a correlation id, and a
causation id is that command's id, which the debug log carries because commands are not stored. See
decision record 0035.

An event that puts something on the map, or moves it, carries **where** (a place in our world) and
**how much it matters** (a significance from nothing to a hundred). It never carries a map cell: which
tile a place falls in is worked out downstream, by the one shared function in `villages.protocol.Cell`,
and how far out it stays drawn is worked out from the significance. See decision record 0026.

## Naming and versioning

- A type reads as villages, then whose event it is, then the event in the past tense, then the version:
  `villages.house.founded.v1` for the world's events, `villages.player.tookAction.v1` for the player's.
- The verb is camelCase when the fact takes more than one word: `givenChoice`, `tookAction`. The Kotlin class is
  whose event it is and the same words in PascalCase, `PlayerGivenChoice`, and a test holds the two to
  each other and to the half they belong in.
- Adding an optional field keeps the version.
- Any other change creates the next version. The old type stays in this catalogue forever, and stays handled when
  folding a stream.
- Pre-alpha exception, in force until the world-persistence milestone in the roadmap: the event store may be wiped
  rather than migrated. Every wipe is recorded in the experiment journal. See decision record 0011. The debug
  panel's `wipe` button is not that wipe and is not journalled: it empties an in-memory development world that
  dies at every restart of the server anyway. See decision record 0036.

## Two kinds of event

Every event is one of two things, and the difference is worth keeping in sight.

**The world's events** are things that happened in the world: something came to be, moved, changed or
ended. They are what the chronicle is made of and what the map is drawn from. **This half grows**, and
goes on growing: every feature that puts something in the world adds to it. Their types read
`villages.house.<verb>.v<n>`, after the thing whose history they are, and in the code they implement
`WorldEvent`.

**The player's events** are things a player did, by which the world was reached into. Being asked
something and answering it are the mechanics of play rather than happenings in the world, and a
chronicler of the world would not write them down. They are recorded all the same, because they are how
everything in the world came to happen and because the house-spirit is a fold over them. Their types
read `villages.player.<verb>.v<n>`, and in the code they implement `PlayerEvent`. **This half stays
small**: if it grows as fast as the other, the game has become a menu.

Both kinds live on the same stream, `house:<uuid>`, because that is the consistency boundary a decision
is taken inside: the action answering a choice and the thing that action does are decided together and
appended together, and two streams would mean two writes with a gap between them. The stream says where
the events are kept; the type says what kind of thing happened. See decision record 0034.

## The world's events

One stream per house, addressed as house followed by its identifier.

| Type | Payload | Meaning | Produced by | Consumers |
|---|---|---|---|---|
| `villages.house.founded.v1` | `houseId`, `player`, `name`, `seat`, `significance`, `banner`, `resources`, `worldTime`, `recordedAt` | A player founded a house at a seat, with a name and a banner. It carries where and how much that matters; the tile it falls in is derived downstream. It carries a stock of every resource, all of them empty and none of them growing, because nothing generates income yet. | `FoundHouse`, or `TakeAction` on an option that founds | The map projection; the event bridge, and through it every gateway subscribed to a tile containing it |

## The player's events

On the same stream as the house they concern, for the reason above.

| Type | Payload | Meaning | Produced by | Consumers |
|---|---|---|---|---|
| `villages.player.givenChoice.v1` | `houseId`, `player`, `choice`, `worldTime`, `recordedAt` | The world put a decision to this house: a prompt and two to four options, each carrying the effect taking it would have. The whole choice is recorded, so the roads not taken are history too. One is pending at a time. Nothing is on the map yet, so it carries no place. | `GiveChoice` | The choices projection, and through it the parchment the player reads |
| `villages.player.tookAction.v1` | `houseId`, `player`, `choiceId`, `optionId`, `worldTime`, `recordedAt` | The house took one option of the choice it was given. What that option does follows from the same decision, as the next events on this stream, so an action and its consequence are never seen apart. What the option was is on the event that gave the choice. | `TakeAction` | The choices projection, which forgets the pending choice |
