# How a mechanic becomes events

Adam describes a mechanic in his own words: what a player is offered, what they can do, what the world
remembers. This document is the method a session follows to turn that description into commands, events,
frames, projections and panel lines, so that he does not have to say how each time. It is the working
half of the persistent documents: `VISION.md` says what the experience is, `SETTING.md` what the world
is, `GLOSSARY.md` the words, `EVENTS.md` the catalogue every event must be in, `ARCHITECTURE.md` the
layers a change must respect, and the decision records the reasons. This says how to get from a
described mechanic to all of those.

State of the source at this writing: one aggregate, the `House`, with three events, provenance on every
envelope, and the whole choice pattern below running end to end, from arrival to a founded house. What
is left of the first gameplay loop, planned in `plans/2026-09-15-first-gameplay-loop.md`, is what the
player sees of it; this note goes when that has landed.

## First, five questions

Answer these before touching code, in a paragraph Adam can read back. The answers are the design.

1. **What happened?** Name the facts in the past tense, as a chronicle would state them: *the house was
   given a choice*, *the house took an action*, *the house was founded*. Each fact is an event. A thing
   that has not happened yet but is asked for is a command, in the imperative: *found the house*.
2. **Whose history is it?** Every event belongs to one stream, and the stream is the thing whose
   history it is. Today there is one kind of thing, the house, and a player's house has the player's
   identity (decision 0028), so anything a player is offered or does is the house's history: the vision
   says decisions are taken in the house's name and remembered as the house's history. A thing whose
   lifetime is shared between houses, a cathedral or a territory, is its own stream when it comes
   (`SETTING.md`, "things with lifetimes are their own streams"); it is not here yet.
3. **What does the player see?** Which frame carries it, and from where: a view read from a projection
   (`snapshot`, `batch`, `yourHouse`, `yourChoice`) for the interface, and the stored event itself on
   the `event` frame for the debug panel. Then which panel line says it happened, in words. A behaviour
   the panel cannot show is one Adam cannot verify (decision 0023).
4. **What can the player do about it?** A command, its payload, and its refusals. The payload never
   carries what the server can work out: not the house's id, not the player, not the instant, not the
   story a command continues. Each way it can be refused is a `HouseError` named for the rule, mapped
   to a reason code in the one place the gateway does that.
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
   no house and no choice pending is given the founding choice. Later givers are the chrono-engine's
   rolls (`SETTING.md`). A giver is application code; it issues `GiveChoice`.
2. `decide` records `HouseGivenChoice(choice)`. A **choice** is a prompt and two to four **options**;
   each option carries a label, a line of detail, and its **effect**, which is what taking it does.
   The event is self-describing: the roads not taken are history too, and a reader of the stream can
   say what each would have done. One choice is pending at a time; a second is refused.
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
6. `decide` records `HouseTookAction` **and the effect's consequences from the same decision**: a
   founding option yields `HouseTookAction` then `HouseFounded`, appended atomically, consecutive
   versions, one correlation id. There is no reaction and no second write to wait for; what the
   option promised is what the stream says happened.
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

A resource is `{ amount, ratePerSecond, asOf }` (decision 0006). An event is recorded when the rate
changes and never on a clock; clients interpolate between events. The treasury's founding rate is the
only rate so far, and nothing changes it yet.

### A thing with a lifetime

A place, a structure or a key figure that exists between two world-times and is shared between
houses: its own stream, a `[from, to)` span in world-time, and pins that constrain the span.
`SETTING.md` describes it; nothing of it is in the source, and its first increment gets its own
decision record before any code.

## Naming

- An event type names the aggregate as its subject, then the fact in the past tense, camelCase, then a
  version: `villages.house.founded.v1`, `villages.house.givenChoice.v1`, `villages.house.tookAction.v1`.
  The Kotlin class is the aggregate prefix and the same words in PascalCase: `HouseFounded`,
  `HouseGivenChoice`, `HouseTookAction`. A test holds the class names to the catalogue's verbs by
  dropping the prefix and lowercasing the first letter.
- A command is an imperative: `FoundHouse`, `GiveChoice`, `TakeAction`. Its payload on the wire is the
  same words in camelCase: `foundHouse`, `takeAction`.
- A frame about the player's own things is `your` and the thing: `yourHouse`, `yourChoice`.
- A refusal is a `HouseError` named for the rule it enforces, `ChoicePending`, `NoSuchOption`, and its
  reason code on the wire is the same in camelCase.
- Every word comes from `GLOSSARY.md` and is used verbatim in code, events and interface. A new word
  is a glossary row in the same commit as its first use.

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
| The type row | `HouseEventTypes` in `backend/infrastructure-occurrent` | `EventTypeCatalogueSpec` |
| The catalogue row: type, payload in constructor order, meaning, producer, consumers | `docs/EVENTS.md` | `EventCatalogueSpec`, in both directions |
| The stored form | `contracts/fixtures/events/<type>.json` | `HouseEventFormatSpec` |
| Every projection's fold | `backend/projections` | the compiler: each `when` is exhaustive |
| A frame, when the interface sees it directly | Kotlin `Frames.kt`, zod `frames.ts`, one fixture under `contracts/fixtures/frames` | both contract tests |
| What the browser does with the frame | `heard()` in `apps/web/src/net/gateway.ts`, with a `note` | reading the log |
| The panel line | the debug panel's state, or its event list | Adam, by looking (0023) |
| The words | `docs/GLOSSARY.md`; a decision record if a decision was taken; the roadmap tick | review |

## Definition of done for a mechanic

Everything in `TESTING.md`'s definition, and then: the program is running on the change; Adam can
make the mechanic happen from the parchment or from the debug panel without an agent in the loop; he
can read what happened in the panel's event list, one line per event, the correlation tag joining what
belongs together, and open any line to the whole event as stored.

## What this does not decide

Which mechanics exist, or what they say. A mechanic is Adam's, in his words; the giver of a choice,
the words on the parchment and the seats in the gazetteer are content, and content is his to steer.
This document only says how, once he has said what.
