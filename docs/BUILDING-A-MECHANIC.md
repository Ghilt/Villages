# How a mechanic becomes events

> **What belongs here:** the method for turning a described mechanic into commands, events, frames,
> projections and panel lines, and the checks that hold each part honest. **What does not:** what the
> mechanics are (`MECHANICS.md`), what the world is (`SETTING.md`), what any of it looks like
> (`LOOK-AND-FEEL.md`).

Adam describes a mechanic in his own words: what a player is offered, what they can do, what the world
remembers. `MECHANICS.md` records that description under the mechanic's name. This document is the method
a session follows to turn it into code, so that he does not have to say how each time. It is the working
half of the persistent documents: `VISION.md` says what the experience is, `SETTING.md` what the world
is, `GLOSSARY.md` the words, `EVENTS.md` the catalogue every event must be in, `ARCHITECTURE.md` the
layers a change must respect, and the decision records the reasons. This says how to get from a
described mechanic to all of those.

State of the source at this writing: two aggregates, the `House` and the `Character`, on one store, one
feed and one executor loop; provenance on every envelope; and the whole choice pattern below running end
to end, from arrival to a founded house. What it
is not yet is the choice roll `MECHANICS.md` describes: there is no fate engine behind the choice, no
rarity on an option, and no expiry.

## First, five questions

Answer these before touching code, in a paragraph Adam can read back. The answers are the design.

1. **What happened, and is it the world's or the player's?** Name the facts in the past tense, as a
   chronicle would state them: *a player was given a choice*, *a player took an action*, *a house was
   founded*. Each fact is an event, and each is one of two kinds. Something that happened **in the
   world** is a `WorldEvent`, typed `villages.house.<verb>.v<n>`; something **a player did** to reach
   into the world is a `PlayerEvent`, typed `villages.player.<verb>.v<n>`. The first half grows with
   every feature; the second should not. A thing that has not happened yet but is asked for is a
   command, in the imperative: *found the house*. See decision record 0034.
2. **Whose history is it?** Every event belongs to one stream, and the stream is the thing whose
   history it is. Today there is one kind of thing, the house, and a player's house has the player's
   identity (decision 0028), so anything a player is offered or does is the house's history: the vision
   says decisions are taken in the house's name and remembered as the house's history. A thing whose
   lifetime is shared between houses, a cathedral, a territory or a person, is its own stream when it comes
   (`ARCHITECTURE.md`, "things with lifetimes are their own streams"). The first, the character, is decided
   in decision record 0055 and not built yet; what a house is to such a thing is still the house's history.
3. **What does the player see?** Which frame carries it, and from where: a view read from a projection
   (`snapshot`, `batch`, `yourHouse`, `yourChoice`) for the interface, and the stored event itself on
   the `event` frame for the debug panel. Then which panel line says it happened, in words. A behaviour
   the panel cannot show is one Adam cannot verify (decision 0023).
4. **What can the player do about it?** A command, its payload, and its refusals. The payload never
   carries what the server can work out: not the house's id, not the player, not the instant, not the
   story a command continues. Each way it can be refused is a `DomainError` named for the rule, under
   the kind of thing whose rule it is - a `HouseError` for a house's - and mapped to a reason code in the
   one place the gateway does that.
5. **What does the world remember, and what does it work out?** A projection folds the events it
   needs into rows; everything that can be derived is derived and never stored: a cell from a place
   (0026), a zoom from a significance, a fence from a seat. If two answers could disagree, only one of
   them is stored.

Two things that bit while the first loop was built, and are worth reading before the second:

- **Whether a thing is new is the read model's to say, not a stream version's.** Version one meant "it
  appeared" only while one command wrote one event. The moment a decision yields two, the thing arrives
  at version three and the rule is quietly wrong. Ask the projection whether its put was new.
- **A rule that lives in a projection binds the interface too.** A house is only drawn from the zoom its
  significance earns, so a camera flown to a new seat at a shallower zoom lands on empty ground. Whatever
  decides what is shown has to be known wherever something is shown.

## The shapes a mechanic takes

### A fact recorded

Command in, `decide` against the folded stream, events out, appended with the stream version as the
write condition. The event carries the aggregate's id, `player` when a player did it, the two times
(0027), a place and a significance when it puts something on the map or moves it (0026), and nothing
that a reader could work out from the rest.

### A decision put to the player: the choice pattern

This is the loop the first iteration builds, and the shape every later "the player is offered
something" takes.

1. A **giver** decides that a choice applies. Today the giver is arrival: a player who says hello with
   no house and no choice pending is given the founding choice. Later givers are the fate engine's
   rolls (`ARCHITECTURE.md`). A giver is application code; it issues `GiveChoice`.
2. `decide` records `PlayerGivenChoice(choice)`. A **choice** is a prompt and two to four **options**;
   each option carries a label, a line of detail, and its **effect**, which is what taking it does.
   The event is self-describing: the roads not taken are history too, and a reader of the stream can
   say what each would have done. Today one choice is pending at a time and a second is refused; the
   choice roll asks instead that a choice **expire** once the world has moved past it, which is not built.
3. A projection keeps the pending choice per player and the gateway sends it as `yourChoice`, on
   hello and whenever it changes, with null once it is gone. **The giver hands back what it gave, and
   that is what the gateway sends**: the projection folds on another thread, so reading it in the same
   breath as writing sometimes says nothing. The projection's own word arrives later and is recognised
   as the same choice rather than sent twice.
4. The **parchment** renders any choice from its words: the prompt, and one button an option. Nothing
   in the interface knows what kind of choice it is showing, so a new kind of choice costs it nothing.
   A `foundAt` effect also puts a mark on the map at the seat it offers, which is the one place the
   interface reads an effect at all.
5. The player picks. The browser sends `takeAction { choiceId, optionId }` with a fresh command id.
6. `decide` records `PlayerTookAction` **and the effect's consequences from the same decision**: a
   founding option yields `PlayerTookAction` then `HouseFounded`, appended atomically, consecutive
   versions, one correlation id. Note what that pair is: the player's event and the world's, out of one
   decision. There is no reaction and no second write to wait for; what the option promised is what the
   stream says happened.
7. The projections fold the consequences as they would any other event, and the map draws them.

To add a new kind of choice: a new `Effect` subtype in the domain; the `decide` branch that turns the
taken option's effect into events; catalogue rows and fixtures for any consequence events that are
new; a giver, with the words for the prompt and the options; and a decider spec for the rule. No new
frame and no new interface, because the parchment is generic. A rule about when a choice may be
given belongs in `decide`, not in a read of a projection: the decider is the truth and a projection
is a moment behind it.

Some events settle a pending choice implicitly. A house founded by other means, the debug button or a
seed, has no use for a pending founding choice, so `evolve(HouseFounded)` clears it. Write such
settlements in `evolve`, with the reason in a comment, and nowhere else.

### A rate that changes

A resource is a `Stock` - `{ total, ratePerSecond, asOf }` (decision 0006): an event when the rate changes,
never on a clock, and the client interpolates between them. `ARCHITECTURE.md` has the shape and its limits.
There are five of them, named in `GLOSSARY.md`, and **every rate is zero**: nothing in the world generates
income yet, so nothing has had to emit a rate change. The first mechanic that gives a house income is the
first to need that event, and writing it is the whole of the work.

### A thing with a lifetime

A place, a structure or a character that exists between two world-times and is shared between
houses: its own stream, and a `[from, to)` span in world-time. **A house's tie to such a thing is not the
thing**: being a key figure is a tie between a house and a character, written in the house's history and
never in the character's, so a rule about whom a house holds is decided on the house's stream. See
decision record 0055. `ARCHITECTURE.md` describes the pattern; nothing of it is in the source yet, and
`docs/plans/characters-and-key-figures.md` is the order its first kind gets built in.

## Naming

- An event type names whose event it is, then the fact in the past tense, camelCase, then a version:
  `villages.house.founded.v1` for the world's, `villages.player.givenChoice.v1` for the player's. The
  Kotlin class is the same word and the same fact in PascalCase: `HouseFounded`, `PlayerGivenChoice`,
  `PlayerTookAction`. A test holds the names, the types and the two halves to each other, so an event
  catalogued on the wrong side of the line fails rather than drifting.
- A command is an imperative: `FoundHouse`, `GiveChoice`, `TakeAction`. Its payload on the wire is the
  same words in camelCase: `foundHouse`, `takeAction`.
- A frame about the player's own things is `your` and the thing: `yourHouse`, `yourChoice`.
- A refusal is named for the rule it enforces, `ChoicePending`, `NoSuchOption`, under the `DomainError`
  of the kind of thing whose rule it is, and its reason code on the wire is the same in camelCase.
- Every word comes from `GLOSSARY.md` and is used verbatim in code, events and interface. A new word
  is a glossary row in the same commit as its first use.
- **Where the player's word is already taken in the code, the code qualifies it and the interface does
  not.** The player's Domain is `Resource.NATURAL_DOMAIN`, because `domain` is the innermost layer of the
  server and a word that means two things is a word nobody can grep for. Three rules follow, and they
  apply to the next such collision as much as to this one:
  - **The qualifier goes on the code name, never on the player's.** A player should never meet a name
    that was bent to suit a package.
  - **The wire carries the code name**, because the wire is code talking to code. What a player is shown
    is decided in the interface, in one place, and nowhere else - never in the domain, which has no
    business holding words, and never in the store.
  - **`GLOSSARY.md` records both, in the row for the player's word**, so that the player's word stays the
    entry anyone looks up and the code name is found from it rather than the other way round.

## What every event carries

The envelope is a CloudEvent (decision 0024) with the provenance decision 0035 adds:

| attribute | what |
|---|---|
| `id` | the **event id**, a UUID minted when the event is written; what a consumer deduplicates by |
| `type`, `source`, `subject`, `time` | the catalogued type, `urn:villages`, the aggregate's id, `recordedAt` |
| `streamid`, `streamversion` | the stream and the event's position in it, from one |
| `correlationid` | the **story** the event belongs to: the first message of a story is its own correlation, and everything that follows from it carries the same |
| `causationid` | the message that directly caused it: for an event from a command, the command's id, which the debug log carries because commands are not stored |

The data is the event's Kotlin fields (0024): the two times, `player` when a player did it, a place
and a significance when it is on the map, and a `kind` on any field whose type is sealed, so a reader
knows which case it holds.

Who mints what: the browser mints a command's id, a UUID, and the gateway refuses anything else. The
server decides which story a command continues: an action continues the story of the choice it
answers; anything else starts a story of its own. Nothing about correlation crosses the wire from the
client, because a client cannot name a story that is not its own.

## The checklist

What one new event costs, and the check that fails until each part exists.

| Part | Where | Held by |
|---|---|---|
| The class, the `decide` branch, the `evolve` branch | `backend/domain` | `HouseDeciderSpec`: given, when, then over events |
| The type row | `EventTypes` in `backend/infrastructure-occurrent` | `EventTypeCatalogueSpec` |
| The catalogue row: type, payload in constructor order, meaning, producer, consumers | `docs/EVENTS.md` | `EventCatalogueSpec`, in both directions |
| The stored form | `contracts/fixtures/events/<type>.json` | `EventFormatSpec` |
| Every projection's fold | `backend/projections` | the compiler: each `when` is exhaustive |
| A frame, when the interface sees it directly | Kotlin `Frames.kt`, zod `frames.ts`, one fixture under `contracts/fixtures/frames` | both contract tests |
| The wire moved, so its version does: `PROTOCOL_VERSION` up at both ends, and `contracts/protocol-v<n>.txt` recorded with `./gradlew :protocol:test -Dprotocol.record=true` | `backend/protocol`, `frontend/packages/protocol`, `contracts/` | `ProtocolShapeSpec` and `protocol.shape.test.ts`, which fail with the instructions (0037) |
| What the browser does with the frame | `heard()` in `apps/web/src/net/gateway.ts`, with a `note` | reading the log |
| The panel line | the debug panel's state, or its event list | Adam, by looking (0023) |
| The words | `docs/GLOSSARY.md`; a decision record if a decision was taken; the roadmap tick | review |

## Definition of done for a mechanic

Everything in `TESTING.md`'s definition, and then: the program is running on the change; Adam can
make the mechanic happen from the parchment or from the debug panel without an agent in the loop; he
can read what happened in the panel's event list, one line per event, the correlation tag joining what
belongs together, and open any line to the whole event as stored.

## What this does not decide

Which mechanics exist, or what they say. That is `MECHANICS.md`, and it is Adam's, in his words; the
giver of a choice, the words on the parchment and the seats in the gazetteer are content, and content is
his to steer. This document only says how, once he has said what.
