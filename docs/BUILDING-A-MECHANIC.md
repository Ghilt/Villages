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

## First, six questions

Answer these before touching code, in a paragraph Adam can read back. The answers are the design.

1. **What happened, and is it the world's or the player's?** Name the facts in the past tense, as a
   chronicle would state them: *a player was given a choice*, *a player took an action*, *a house was
   founded*. Each fact is an event, and each is one of two kinds. Something that happened **in the
   world** is a `WorldEvent`, typed `villages.house.<verb>.v<n>`; something **a player did** to reach
   into the world is a `PlayerEvent`, typed `villages.player.<verb>.v<n>`. The first half grows with
   every feature; the second should not. A thing that has not happened yet but is asked for is a
   command, in the imperative: *found the house*. See decision record 0034. **The names are Adam's to
   approve, before any code**: propose every event's name with a line on what it means, and let him rename
   them. A name in the event store outlives every other decision about it.
2. **Whose history is it?** Every event belongs to one stream, and the stream is the thing whose
   history it is. There are three kinds of thing today. The house has the player's identity (decision
   0028), so anything a player is offered or does is the house's history: the vision says decisions are
   taken in the house's name and remembered as the house's history. A thing whose lifetime is shared
   between houses, a cathedral, a territory or a person, is its own stream (`ARCHITECTURE.md`, "things
   with lifetimes are their own streams"), and the character is the first of them, decision record 0055.
   What a house is to such a thing is still the house's history, as a key figure is - unless two houses could
   contend for it, as for a structure, whose own history says who holds it (0093).
3. **What does the player see?** Which frame carries it, and from where: a view read from a projection
   (`snapshot`, `batch`, `yourHouse`, `yourChoice`, `yourKeyFigures`) for the interface, and the
   stored event itself on the `event` frame for the debug panel. Then which panel line says it happened,
   in words. A behaviour the panel cannot show is one Adam cannot verify (decision 0023). **A thing on the
   map that can move or end needs a way to leave a cell** as well as to arrive in one: a house only ever
   appears or changes, and a character is also `characterGone`, or the client goes on drawing them where
   they were. **And everything on the map passes the fog of war** before it reaches anyone (0061): what stands
   still is sent on ground the house has revealed, what moves only in its vision, and the gateway's `Fog` is
   where a new kind of thing says which it is.
4. **What can the player do about it?** A command, its payload, and its refusals. The payload never
   carries what the server can work out: not the house's id, not the player, not the instant, not the
   story a command continues. Each way it can be refused is a `DomainError` named for the rule, under
   the kind of thing whose rule it is - a `HouseError` for a house's - and mapped to a reason code in the
   one place the gateway does that.
5. **What does the world remember, and what does it work out?** A projection folds the events it
   needs into rows; everything that can be derived is derived and never stored: a cell from a place
   (0026), a zoom from a significance, a fence from a seat. If two answers could disagree, only one of
   them is stored.
6. **Which rules must always hold, and which history holds each?** Name the invariants - one holder at a
   time, never more than nine key figures, never spending what is not there - and give each to the history
   that can decide it alone, because a rule decided against one stream holds at the instant of the
   decision. A rule that spans two histories cannot be held at once, only put right a moment after by a
   listener: say so, say what is wrong in the moment between, and make that moment harmless. A rule held
   by nothing is a hope. A plan carries them as a table: the invariant, the history that holds it, and
   whether it holds at once or a moment after.

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
   no house and no choice pending is given the founding choice. A giver is application code; it issues
   `GiveChoice`. The other giver is the **choice roll** (`ARCHITECTURE.md`), which issues `Roll` instead:
   the omens, the rarity, the price as a spend and the hand, recorded as `PlayerRolled`, the spend and
   `PlayerGivenChoice` from one decision, so a hand is never seen without the roll that paid for it. Its
   options also carry their rarity and the omens that brought them. See decision record 0083.
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
is a moment behind it. Those rules are `Choice.refuseUnlessGivableTo`, which `decide` asks as a choice is
given: nothing founds a house already founded, nothing gives or takes before there is a house, and a
choice whose every option costs something is refused, because a house that cannot pay could never answer
it and a pending choice holds back every other. A dialogue keeps the same rule for its choices, through
the same `costsSomething`.

Some events settle a pending choice implicitly. A house founded by other means, the debug button or a
seed, has no use for a pending founding choice, so `evolve(HouseFounded)` clears it. Write such
settlements in `evolve`, with the reason in a comment, and nowhere else.

### Something long, offered whole and stepped through: the dialogue pattern

The choice pattern stretched over many moments, for a thing too long to record press by press. A
dialogue is the first; decision record 0071 is the shape.

1. **Offered whole**, on the house's own stream: `PlayerOfferedDialogue` carries every line and every
   branch, so the roads not taken are history, as a choice's are. It checks itself when it is made,
   so one that could loop or that names a line it lacks never reaches the store, and its id is worked
   out from the command that offered it, so a resend is refused rather than doubled.
2. **Only the steps that matter are recorded**: `PlayerCompletedDialogueStep` for an option taken or a
   line reached that gives something, is marked, or ends it, with ids and nothing else. The rest is
   rebuilt by one pure function, `Dialogue.walk`, from the offer and the steps; the decider allows a
   step only where the walk says one is open, and what the player is sent comes from the same walk.
3. **What a step gives is the world's own event, from the same decision**, exactly as an option's
   effect: the step, then what it gives, then `PlayerCompletedDialogue` when the line ends it. There is
   no command for finishing, because the end is a step.

4. **What it depends on fails in the house's own rules**, carried by one listener. A requirement is a
   value, `requirementsBrokenBy` says which an event breaks, and the listener for broken requirements sends
   each house that depends on one `FailRequirement`; the house lapses what it ends, as
   `PlayerLostDialogue`. A new kind of requirement is a case and a branch, and the listener never changes.

A new kind of line costs nothing but its words; a new kind of effect is one branch of `follows` in
`Effects.kt`, which choices and dialogues share, and its `kind` in the store. A line's effects are taken in
order, each decided against what the ones before it left, so two costs the house could pay apart but not
together are refused together, and a grant before a cost can pay for it. A rule about where a step may be
taken belongs in the walk, so the decider and the page cannot come to disagree.

### A rate that changes

A resource is a `Stock` - `{ total, ratePerSecond, asOf }` (decision 0006): an event when the rate changes,
never on a clock, and the client interpolates between them. `ARCHITECTURE.md` has the shape and its limits.
There are five of them, named in `GLOSSARY.md`. What changes a rate is `incomeChanged`, one source at a time:
a house's treasury keeps what each source pays and each stock runs at the sum, re-based at every change, so a
mechanic that pays a house names a source and sets its rates, and never touches a stock. Structures were the
first (`docs/plans/structures.md`); the standing-effects listener is the one that writes it today.

### A thing with a lifetime

A place, a structure or a character that exists between two world-times and is shared between
houses: its own stream, and a `[from, to)` span in world-time. **A house's tie to such a thing is not the
thing**: being a key figure is a tie between a house and a character, written in the house's history and
never in the character's, so a rule about whom a house holds is decided on the house's stream. See
decision record 0055.

**A lever that names such a thing asks the house first**, with a command that can only be refused: it
writes nothing when the thing is the house's own and is refused when it is not. `ActThrough` is the first,
and `CheckRoomForKeyFigure` the second. The rule stays in `decide`, and nothing needs a port for reading a
house.

**When such a thing ends, a reaction carries the end to every house tied to it**, because the end is on
the thing's stream and the losses are on the houses', and no one decision writes both. The listener for
character deaths is the first. A new one is a `Reaction`, which keeps the rules for it - never inside the
feed's callback, "already done" swallowed and anything else said, nothing planned before a wipe issued
after it - so it says only what it folds and which refusals of its command mean "already done": see
`ARCHITECTURE.md` on what acts on its own.

`ARCHITECTURE.md` describes the pattern. Characters and the tie are in the source, and
`docs/plans/characters-and-key-figures.md` is the order the rest of them gets built in.

## Naming

- An event type names whose event it is, then the fact in the past tense, camelCase, then a version:
  `villages.house.founded.v1` for the world's, `villages.player.givenChoice.v1` for the player's. The
  Kotlin class is the same word and the same fact in PascalCase: `HouseFounded`, `PlayerGivenChoice`,
  `PlayerTookAction`. A test holds the names, the types and the two halves to each other, so an event
  catalogued on the wrong side of the line fails rather than drifting.
- A command is an imperative: `FoundHouse`, `GiveChoice`, `TakeAction`. Its payload on the wire is the
  same words in camelCase: `foundHouse`, `takeAction`.
- A frame about the player's own things is `your` and the thing: `yourHouse`, `yourChoice`, `yourKeyFigures`.
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

What one new event costs, and the check that fails until each part exists. One rule binds every row: a file
past 400 lines may not grow (`size-ceilings.txt`, decision record 0072), so a part that would have gone into a
long file goes into a file of its own.

| Part | Where | Held by |
|---|---|---|
| The class, in its mechanic's family (a new mechanic adds one beside `ResourceEvent`), and its command in the family beside it, `ResourceCommand` and the rest; the `decide` and `evolve` branches in the mechanic's part of the house, `Treasury.kt`, `Dialogues.kt` and the others, where a new mechanic adds a part to `House.Founded` and a line to each of `HouseDecider`'s two routes. What it does to another mechanic is an `Effect`, asked of the house through `Follow` | `backend/domain` | the house spec of its mechanic, `House<Mechanic>Spec` over `HouseFixtures.kt`: given, when, then over events |
| The type, added to the record of every type ever written: its name is worked out from the class by `EventNames`, at version 1, and needs no row anywhere else | `contracts/event-types.txt` | `EventTypeCatalogueSpec`, which fails for a type written and not recorded, and for a recorded one nothing reads any more |
| The catalogue row: type, payload in constructor order, meaning, producer, consumers | `docs/EVENTS.md` | `EventCatalogueSpec`, in both directions |
| The stored form | `contracts/fixtures/events/<type>.json` | `EventFormatSpec` |
| Each case of a sealed field - an effect, what follows a line, a requirement, an option's reveal impact - named by its `kind`, and written by some fixture | `EffectJson.kt` or `DialogueJson.kt` in `backend/infrastructure-occurrent`, and a fixture; an effect also has its view, and a `yourChoice` fixture carrying it | `EventFormatSpec` and `FramesContractSpec`, which want every case named and written |
| The folds of the read models that hear the mechanic: a branch for its family in each, and a function folding that family, exhaustive over it; a read model that does not hear it is not edited at all. A new read model is a `Follower`, its bean started with `initMethod = "start"` and its `reset` forgetting all of it | `backend/projections` | the compiler: within a family a fold names, every event is placed; `FollowersTest`, which fails for a follower never started |
| A frame, when the interface sees it directly | Kotlin `Frames.kt`, zod `frames.ts`, one fixture under `contracts/fixtures/frames` | both contract tests |
| The mechanic's part in the gateway, `<Mechanic>Part.kt` beside `Gateway.kt`: what a player arriving is told (`greet`), the read models it watches, and the commands and frames it takes (`register`), its ports a field of `Mechanics` and a line in `partsOf` (`GatewayParts.kt`), in the order the page is told things. A lever of the debug panel is registered by `Instruments.kt` instead and closes with the rest (0076): a mechanic's levers in a file of their own beside it, as `StructureLevers.kt` is, through the shared `lever` | `backend/gateway` | `GatewayPartsSpec`, which wants every kind of command and frame taken exactly once; `GatewaySessionsSpec`, which holds hello's order |
| What the frame says: the `toView` from a read model's row or a domain value, in a file of the mechanic's own beside `Gateway.kt` (`HouseViews.kt`, `DialogueViews.kt`, ...); a new refusal's code, which is its class's name, added to `contracts/refusal-codes.txt`; a name off the wire in `WireValues.kt` | `backend/gateway` | the compiler: every view's `when` is exhaustive; `RefusalCodesSpec`, which fails for a code given and not recorded |
| The wire moved, a frame or a field however deep, so its version does: `PROTOCOL_VERSION` up at both ends, a line for it in `contracts/README.md`, and `contracts/protocol-v<n>.txt` recorded with `./gradlew :protocol:test -Dprotocol.record=true`, which never records over a version | `backend/protocol`, `frontend/packages/protocol`, `contracts/` | `ProtocolShapeSpec` and `protocol.shape.test.ts`, which fail with the instructions (0037) |
| What the page does with the frame: the slice of the session's state that folds it, or a new slice for a new mechanic, in `packages/client-core/src/slices.ts`; its route, what it makes the session do, in `session.ts`; and its words in `apps/web/src/sessionLog.ts` | `packages/client-core`, `apps/web` | the compiler, which refuses a frame the session's routes or the log's words have no case for; `session.test.ts` and `net/gateway.test.ts`; reading the log |
| The panel line, and what each of the mechanic's levers and panes does, with where to find it | the debug panel's state, or its event list; the mechanic's entry in `docs/RUNNING.md` | Adam, by looking (0023) and by reading |
| What the player is shown: containers and controls from the library, and a component it lacks added to the library first, in a commit of its own; the pane reads the session through `useStore(sessionStore, select)`, picking only what it shows; a pane of its own is its `Pane` in `<feature>/pane.ts` and a line in `apps/web/src/panes.tsx` saying when it stands and what draws it; its styles in its folder's own part, imported in `styles.css` where it cascades, its strip `pane-strip` and its card `pane-card` | `apps/web/src/ui/`, a recipe in `ui/container/recipes.ts`, the page at `/admin/inspect-ui-components` | Adam, by looking at the page and then at the pane (`UI-COMPONENTS.md`) |
| The words | `docs/GLOSSARY.md`; a decision record if a decision was taken; the roadmap tick | review |

## Definition of done for a mechanic

Everything in `TESTING.md`'s definition, and then: the program is running on the change; Adam can
make the mechanic happen from the parchment or from the debug panel without an agent in the loop; he
can read what happened in the panel's event list, one line per event, the correlation tag joining what
belongs together, and open any line to the whole event as stored.

**What the mechanic is made of is in a catalogue, on a page of its own.** Its words and numbers, and any new
kind of thing it brings, are a catalogue under `world/catalogues/`, never constants in the code, and the
catalogue has its inspect page at `/admin/inspect-<kind>`, where Adam reads it and changes it while the game
runs. A mechanic that brings a new kind of content builds both as steps of its plan; one that adds to a
catalogue shows its entries on that catalogue's page. An entry's own numbers go with the entry, and a number that
belongs to no one entry goes in the balance. `admin/catalogues.test.ts` fails for a catalogue no page names.
Adam's word of 2026-10-15; see decision record 0097.

**The debug panel stands in for the world, never for the player.** A lever there makes happen what the world
will one day do and nothing does yet - offering a dialogue, taking a key figure in - and what the player does
with it is done in the player's own interface, however unfinished that is, and never in a lever beside it.
Adam's word, 2026-10-01, when a dialogue's steps had been made levers in the panel: all the panel does for a
dialogue is offer one, and playing it is the pane's.

## What this does not decide

Which mechanics exist, or what they say. That is `MECHANICS.md`, and it is Adam's, in his words; the
giver of a choice, the words on the parchment and the seats in the gazetteer are content, and content is
his to steer. This document only says how, once he has said what.
