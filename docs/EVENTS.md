# Event catalogue

Every domain event in the world. Events are the only durable state: they are never edited and never deleted, so this
catalogue is the contract between the past and every future version of the code.

This file is parsed by a test. The domain's catalogue test reads the tables below and fails if the code and the
catalogue disagree in either direction, in the set of events or in the fields of any one of them; from increment 1.5
the event store's type mapper is held to the same rows. Keep the format exactly as described:

- One section headed with the aggregate name per aggregate, and inside it exactly one table.
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

- A type reads as villages, then the aggregate, then the event in the past tense, then the version. The first one is
  going to be `villages.house.founded.v1`.
- The verb is camelCase when the fact takes more than one word: `givenChoice`, `tookAction`. The Kotlin class is
  the aggregate and the same words in PascalCase, `HouseGivenChoice`, and a test holds the two to each other.
- Adding an optional field keeps the version.
- Any other change creates the next version. The old type stays in this catalogue forever, and stays handled when
  folding a stream.
- Pre-alpha exception, in force until the world-persistence milestone in the roadmap: the event store may be wiped
  rather than migrated. Every wipe is recorded in the experiment journal. See decision record 0011.

## House

One stream per house, addressed as house followed by its identifier.

| Type | Payload | Meaning | Produced by | Consumers |
|---|---|---|---|---|
| `villages.house.founded.v1` | `houseId`, `player`, `name`, `seat`, `significance`, `banner`, `treasury`, `worldTime`, `recordedAt` | A player founded a house at a seat, with a name and a banner. It carries where and how much that matters; the tile it falls in is derived downstream. The treasury starts at nothing and earns at the founding rate. | `FoundHouse`, or `TakeAction` on an option that founds | The map projection; the event bridge, and through it every gateway subscribed to a tile containing it |
| `villages.house.givenChoice.v1` | `houseId`, `player`, `choice`, `worldTime`, `recordedAt` | The world put a decision to this house: a prompt and two to four options, each carrying the effect taking it would have. The whole choice is recorded, so the roads not taken are history too. One is pending at a time. Nothing is on the map yet, so it carries no place. | `GiveChoice` | The choices projection, and through it the parchment the player reads |
| `villages.house.tookAction.v1` | `houseId`, `player`, `choiceId`, `optionId`, `worldTime`, `recordedAt` | The house took one option of the choice it was given. What that option does follows from the same decision, as the next events on this stream, so an action and its consequence are never seen apart. What the option was is on the event that gave the choice. | `TakeAction` | The choices projection, which forgets the pending choice |
