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
`villages.<whose>.<verb>.v<n>`, after the thing whose history they are - `villages.house.` for a
house's, `villages.character.` for a character's - and in the code they implement `WorldEvent`.

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

A character's stream, `character:<uuid>`, holds the world's half only: a player reaches into the world
through their house and never through a character. What a character is to a house is the house's
history, on the house's stream. See decision record 0055.

## The world's events

One stream per house, addressed as house followed by its identifier.

| Type | Payload | Meaning | Produced by | Consumers |
|---|---|---|---|---|
| `villages.house.founded.v1` | `houseId`, `player`, `name`, `seat`, `significance`, `banner`, `resources`, `worldTime`, `recordedAt` | A player founded a house at a seat, with a name and a banner. It carries where and how much that matters; the tile it falls in is derived downstream. It carries a stock of every resource, all of them empty and none of them growing, because nothing generates income yet. | `FoundHouse`, or `TakeAction` on an option that founds | The map projection; the sight projection, whose seat it opens a vision point at; the event bridge, and through it every gateway subscribed to a tile containing it |
| `villages.house.gainedKeyFigure.v1` | `houseId`, `characterId`, `worldTime`, `recordedAt` | A house took a character in as one of its key figures: a tie in the house's own history, which the character's record never mentions. At most nine, and never the same character twice. | `TakeKeyFigure`, from `addKeyFigure` | The characters projection, and through it `yourKeyFigures`; the sight projection, which opens a vision point where they stand; the listener for character deaths; the event list |
| `villages.house.gainedVision.v1` | `houseId`, `visionId`, `place`, `radius`, `worldTime`, `recordedAt` | A house was given vision of a place outright: it sees a circle about it, `radius` kilometres on the ground, from this day until the vision is taken away. The size is on the event, so a later change to how far a house sees leaves what was given alone. It puts nothing on the map for anybody but the house, so it carries no significance. What gave it is the story it belongs to. | `GiveVision`, from `giveVision` | The sight projection, which opens a vision point there, and through it `yourSight`; the event list |
| `villages.house.lostKeyFigure.v1` | `houseId`, `characterId`, `worldTime`, `recordedAt` | A house lost one of its key figures. Why is the story it belongs to rather than a field: a loss that follows a death carries the death's correlation. | `LoseKeyFigure`, which the listener for character deaths issues | The characters projection, and through it `yourKeyFigures`; the sight projection, which closes the vision point they gave; the listener for character deaths; the event list |
| `villages.house.lostVision.v1` | `houseId`, `visionId`, `worldTime`, `recordedAt` | A house lost a vision it had been given. Only the id is here: where and how far is on the event that gave it. What the vision covered stays revealed. | `TakeVision`, from `takeVision` | The sight projection, which closes the vision point, and through it `yourSight`; the event list |
| `villages.house.resourceGranted.v1` | `houseId`, `resource`, `amount`, `worldTime`, `recordedAt` | A house was given some of a resource. What gave it is the story the event belongs to rather than a field on it. | `GrantResource`; and `TakeAction` and `CompleteDialogueStep`, for an option or a line that grants | The map projection, which holds what a house has | 
| `villages.house.resourcePledged.v1` | `houseId`, `pledgeId`, `resource`, `amount`, `until`, `purpose`, `worldTime`, `recordedAt` | Some of a house's resource was tied to an undertaking until a world-day. It is not spent: it is not free for anything else until the pledge is released, and then it comes back whole. The day is worked out from a span in months before the command is made. | `PledgeResource` | The map projection, which holds the live pledges | 
| `villages.house.resourceReleased.v1` | `houseId`, `pledgeId`, `worldTime`, `recordedAt` | A pledge ended and what it held is free again, whether its span ran out or somebody ended it early. Only the id is here: which resource and how much is on the event that made the pledge. | `ReleasePledge` | The map projection, which drops the pledge | 
| `villages.house.resourceSpent.v1` | `houseId`, `resource`, `amount`, `worldTime`, `recordedAt` | Some of a house's resource was used up and is gone. Refused unless that much of it was free, so what is pledged cannot be spent out from under a pledge. | `SpendResource`; and `TakeAction` and `CompleteDialogueStep`, for an option that spends | The map projection, which holds what a house has | 

## A character's events

One stream per character, addressed as character followed by its identifier. Every one of them is the
world's.

| Type | Payload | Meaning | Produced by | Consumers |
|---|---|---|---|---|
| `villages.character.aged.v1` | `characterId`, `years`, `worldTime`, `recordedAt` | A character aged out of the ordinary by some years, or grew younger by them when the number is negative. Ordinary ageing is never an event: an age is counted from the birthday, plus every year of these. | `AgeCharacter` | The characters projection, and through it `yourKeyFigures`; the event list |
| `villages.character.appeared.v1` | `characterId`, `name`, `sex`, `species`, `bornOn`, `stats`, `portrait`, `worldTime`, `recordedAt` | A character came into the world's story: a given and a family name, a sex, a species, the day they were born, which can be long before this one, all four stats, and a portrait's key or none. They are on no map until something moves them onto one, so it carries no place. | `IntroduceCharacter`, made by `addKeyFigure` | The characters projection, and through it the owner's `yourKeyFigures`; the event list |
| `villages.character.died.v1` | `characterId`, `cause`, `worldTime`, `recordedAt` | A character died, for a cause said in a line. Their history ends here; each house that held them as a key figure loses them in its own. | `KillCharacter` | The characters projection, which drops them from every list at once; the sight projection, which closes the vision point they gave; the listener for character deaths, which writes each loss; the listener for broken requirements, which lapses every dialogue they speak in; the event list |
| `villages.character.leftTheMap.v1` | `characterId`, `worldTime`, `recordedAt` | A character left the map and is nowhere again. A death does not also write this: the dead are on no map from the day they die, and where they stood is where they died. | `TakeOffTheMap` | The characters projection, which closes the span they stood in; the sight projection, which closes the vision point they gave; the event list |
| `villages.character.moved.v1` | `characterId`, `place`, `significance`, `worldTime`, `recordedAt` | A character came to stand somewhere in the world, from nowhere or from where they stood. It carries where and how much that matters, as everything that puts a thing on the map does; the cell is worked out downstream. The significance is the character's own, 10 for every key figure until something decides it per character. | `MoveCharacter` | The characters projection, which closes the span they stood in and opens another; the sight projection, which does the same with the vision point they give each house holding them; the event list |
| `villages.character.portraitChanged.v1` | `characterId`, `portrait`, `worldTime`, `recordedAt` | A character was given another portrait, or none: a new likeness, kept from now on. | `ChangePortrait` | The characters projection, and through it `yourKeyFigures`; the event list |
| `villages.character.statChanged.v1` | `characterId`, `stat`, `value`, `worldTime`, `recordedAt` | One of a character's stats became a new value, between one and twenty. The value and not the change, so a reader knows where it stands without adding anything up; a key figure's power is their stats, so this is a key figure growing more or less powerful. | `ChangeStat` | The characters projection, and through it `yourKeyFigures`; the event list |

## The player's events

On the same stream as the house they concern, for the reason above.

| Type | Payload | Meaning | Produced by | Consumers |
|---|---|---|---|---|
| `villages.player.completedDialogue.v1` | `houseId`, `player`, `dialogueId`, `worldTime`, `recordedAt` | The house reached the end of a dialogue. Written in the same decision as the step on the line that ends it, and after what that line gives. Its own event, so that nothing waiting on an end has to look inside a step, and not the event for a dialogue lost, so that nothing can take a loss for an end. The dialogue is no longer open. See decision record 0071. | `CompleteDialogueStep` | The dialogues projection, and through it what the player is sent; the listener for broken requirements, which keeps which open dialogues need what; the event list |
| `villages.player.completedDialogueStep.v1` | `houseId`, `player`, `dialogueId`, `lineId`, `worldTime`, `recordedAt` | The house took a step through a dialogue: an option of a dialogue choice, or a line reached that has an effect, is marked to be recorded, or ends it. Only the ids: the line is on the event that offered the dialogue, and the plain lines read on the way are never recorded, because every option taken is a step and the path can be rebuilt from the dialogue alone. What the line does - what it grants, and what an option spends - follows as the world's own events from the same decision; a spend the house cannot pay refuses the step. See decision record 0071. | `CompleteDialogueStep` | The dialogues projection, and through it what the player is sent; the event list |
| `villages.player.givenChoice.v1` | `houseId`, `player`, `choice`, `worldTime`, `recordedAt` | The world put a decision to this house: a prompt and two to four options, each carrying the effect taking it would have. The whole choice is recorded, so the roads not taken are history too. One is pending at a time. Nothing is on the map yet, so it carries no place. | `GiveChoice` | The choices projection, and through it the parchment the player reads |
| `villages.player.lostDialogue.v1` | `houseId`, `player`, `dialogueId`, `because`, `worldTime`, `recordedAt` | A dialogue lapsed before it was finished, because one of its requirements failed - a speaker died, say - and `because` names the requirement, the one thing about them the player ever learns. Every open dialogue of the house that needed it lapses in the same decision. Its own event rather than an end with a reason, so that nothing waiting on an end takes a loss for one. The dialogue ends where it stood and is no longer open. See decision record 0071. | `FailRequirement` | The dialogues projection, and through it what the player is sent; the listener for broken requirements, which keeps which open dialogues need what; the event list |
| `villages.player.offeredDialogue.v1` | `houseId`, `player`, `dialogue`, `worldTime`, `recordedAt` | The house was offered a dialogue, whole: a title and a scene, the speakers, each in a party, every line with what saying it does, what it shows and what follows it, every dialogue choice and how each of its options shows what it will do, and what it was written to need. The roads not taken are history too, and every later step is checked against this event. Its id is worked out from the command that offered it, so the same offer sent twice is refused. Several can be open at once. Nothing is on the map, so it carries no place. See decision record 0071. | `OfferDialogue` | The dialogues projection, and through it what the player is sent; the listener for broken requirements, which keeps which open dialogues need what; the event list |
| `villages.player.tookAction.v1` | `houseId`, `player`, `choiceId`, `optionId`, `worldTime`, `recordedAt` | The house took one option of the choice it was given. What that option does follows from the same decision, as the next events on this stream, so an action and its consequence are never seen apart. What the option was is on the event that gave the choice. | `TakeAction` | The choices projection, which forgets the pending choice |
