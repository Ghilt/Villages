# Architecture

> **What belongs here:** how the program is put together — its layers, its modules, how a change travels
> through it, and what the fiction asks of it. **What does not:** why any of it was chosen, which is in the
> decision records, and what the game is (`VISION.md`, `SETTING.md`, `MECHANICS.md`).

Villages is an event-sourced world with a map-first client. Commands are decided by pure functions, the resulting
events are the only durable state, and everything a player sees is a projection of those events. The client is a view
over a stream of changes, not a simulation of its own.

Two separations carry the whole design. On the backend, the game domain knows nothing about Occurrent, MongoDB,
RabbitMQ or Spring. On the frontend, the game client knows nothing about React, the DOM, MapLibre or Pixi. Both are
enforced by the build and by tests, not by discipline alone.

## Dependency rules

Backend, arrows pointing the way dependencies are allowed to go:

```
domain  <-  application  <-  infrastructure-occurrent
                          <- infrastructure-rabbit
                          <- projections
                          <- gateway            <-  app
        <-  gateway (values in, HouseError out; see decision 0013)
        <-  protocol      <- gateway
```

- `domain` depends on the Kotlin standard library and nothing else. No Spring, no Occurrent, no MongoDB, no RabbitMQ,
  no CloudEvents, no Jackson, no logging framework.
- `application` depends only on `domain`. It holds the use cases and owns the ports, as interfaces, that
  infrastructure implements.
- Adapters depend inwards, never on each other, with one exception: the broker and the projections need the event
  store adapter in order to subscribe to it.
- Only `app` has a Spring Boot application class and the configuration that wires ports to adapters.

Frontend:

```
packages/protocol  <-  packages/client-core  <-  apps/web
```

- `client-core` is compiled without DOM type definitions, so a stray `window`, `WebSocket` or `document` fails to
  typecheck. The socket arrives as an injected interface.
- Restricted imports forbid React, MapLibre and Pixi inside `client-core` and `protocol`.

Enforcement: Gradle module edges plus architecture tests on the backend; workspace dependencies, a DOM-free compiler
configuration and lint rules on the frontend. A violation fails the build, in both cases proven by a deliberate
violation when the rule was introduced.

## Modules

| Module | Holds |
|---|---|
| `domain` | The house and character aggregates: commands, events, state, the decide and evolve functions, value types, domain errors |
| `application` | Use cases and the ports they need: command execution, read model queries, the clock, player tokens |
| `protocol` | The client and server message types, shared with the frontend through checked-in JSON fixtures, and the version of the wire, whose shape is recorded in `contracts/protocol-v<n>.txt` (0037) |
| `infrastructure-occurrent` | CloudEvent conversion and type mapping, the MongoDB event store, the application service, durable subscriptions |
| `infrastructure-rabbit` | Broker topology, the bridge that publishes stored events, and the feed the gateway consumes |
| `projections` | Read models. The first is houses by cell, which the map is drawn from; the sight is what every house can see, which the fog of war is drawn from |
| `gateway` | Player connections, cell subscriptions, snapshots, coalesced deltas, command intake |
| `app` | The Spring Boot bootstrap and the wiring. The only module that knows every other one |
| `arch-tests` | The layer rules, as tests |
| `load-bots` | The swarm that proves the scale numbers |

Packages are shorter than module names: `villages.domain`, `villages.application`, `villages.protocol`,
`villages.occurrent`, `villages.rabbit`, `villages.projections`, `villages.gateway`, `villages.app`,
`villages.bots`. The two infrastructure modules take the name of the thing they wrap, which is also their
commit scope.

Deployment starts as one process. The gateway is written as though it were already separate, so extracting it later is
a configuration change rather than a rewrite.

## What is in memory, for now

There is no MongoDB or RabbitMQ on the machine yet, so the ports have in-memory adapters: Occurrent's
in-memory event store and subscription model, wired in `InMemoryWorld`, behind `HouseCommandExecutor` and
`EventFeed`. The gateway consumes the feed in-process and fans events out to every connection that asked to
watch, which is the broker's job from increment 1.6 on. Nothing above the ports changes when the real store
and broker arrive; nothing survives a restart until then, on purpose. The whole path is proven by
`AppBootsTest`: a real socket, hello, a founded house, the event back.

## What was verified about Occurrent

Increment 0.7 compiled and ran the plan's riskiest assumption, on Occurrent 0.33.0 under Spring Boot 4.1.1:

- A Kotlin decider built with `decider(initialState, decide, evolve)` from `org.occurrent.dsl.decider` drives
  the application service through the extension `ApplicationService<E>.execute(streamId, command, decider)`,
  which loads the stream, folds it, calls decide, and appends with the stream-version write condition. A
  decision that yields no event writes nothing. **That extension is no longer what runs a command**: it gives
  no way to put anything on the envelope of what it writes, and provenance has to go there, so the executor
  does those four steps itself and retries a lost write three times as the extension did. See decision
  record 0035. The smoke test still proves the library's own path works.
- `GenericApplicationService(eventStore, cloudEventConverter)` is the constructor, and
  `JacksonCloudEventConverter.Builder<E>(objectMapper, source).typeMapper(...)` builds the converter on
  Jackson 3. The house events get their own type mapper in 1.5, so the CloudEvent type can be
  `villages.house.founded.v1` rather than a class name.
- Occurrent pins `jackson-databind` 3.1.4 and Spring Boot 4.1.1 manages 3.1.5; Gradle resolves to 3.1.5 and
  the round trip works on it. CloudEvents is 4.0.1. The in-memory store is `InMemoryEventStore()`.

## How a change travels

```mermaid
flowchart LR
  P[Player] -->|command frame| G[Gateway]
  G -->|use case| A[Application]
  A -->|decide| D[Domain]
  A -->|append with expected version| ES[(Event store)]
  ES -->|subscription| BR[Event bridge]
  ES -->|subscription| PR[Projection]
  BR -->|publish| X{{Exchange: routing key per cell}}
  PR --> RM[(Read model)]
  X -->|feed| G
  RM -->|snapshot on subscribe| G
  G -->|batched deltas| P
```

A player arrives and is asked something. Saying hello with no house and nothing pending writes
`PlayerGivenChoice` to their house's stream, and the gateway answers with what it gave rather than with a
read of the projection, because the projection folds on another thread and would sometimes say
"nothing" about a choice just written. Taking one option writes the action and what it does from one
decision, at consecutive versions and under one correlation id, and the map's read model draws the
founding out of that. See decision records 0034 and 0035.

A player founds a house. The gateway hands the command to the application, which loads the stream, calls `decide`,
and appends the resulting events with the stream version as the write condition. Two subscriptions read the store from
there: one updates the read model, one publishes to the broker with a routing key that carries the cell. Every gateway
node consumes that feed, matches each event against the cells its sessions are watching, and pushes a coalesced batch.
A newly subscribed client is served a snapshot from the read model first, and drops any delta it has already seen.

There is no outbox table and no dual write. The append to the stream is the only write there is, and the
event is the change rather than a notification about one, so the store *is* the outbox and the subscription
is the relay. What a relay owes is delivery: a feed says where it begins - everything, for a read model that
is the fold of every event, or only what follows, for a watcher - and one that begins at the beginning
subscribes before it replays, so an event appended in between arrives twice rather than not at all. Folding
an event twice is harmless. See decision record 0029.

A player has one session. The gateway keeps one connection per player, and a second hello takes the player
over: the newcomer becomes the session and the one before is stood down, told so, and dropped from every
cell it held. What a session holds - its cells, the day it is looking at - is its own; what is the
player's, which today is which house is theirs, is sent to whichever window they are in. See decision
record 0028.

Today there is no broker. The read model's own change stream stands in for the exchange: the gateway watches
the projection for changes and queries it for snapshots, both through the `HousesByCell` port. When RabbitMQ
arrives the exchange takes over the fan-out between processes, and the gateway's side does not change - it
still holds an index from cell to sessions and, for each changed house, walks that house's deepest cell up
through all of its prefixes, sending to the holders at the zooms its significance is worth drawing at and to
anyone who is seeing everything at the rest. A cell is a quadkey at any zoom, so a client asks for data on
the same grid, at the same zoom, as the terrain tiles it draws; see decision record 0026.

The fan-out runs inside the read model's watchers, and a throw there leaves the fan-out before the
connections after it are told. A send therefore never throws into the gateway. A frame for a socket that is
going is simply not delivered, and the close on its way lets the connection go. Tomcat says a session is
open while it is closing, and a seeding connection closes the moment its command is accepted, which is while
its house is still being fanned out.

Anything else a subscriber throws is a **fault**, and the feed says so rather than losing it: the server's
log gets the stack under `villages.feed`, every window's debug panel gets the one line as `error fault`,
and the feed goes on to the next event without handing that one to that subscriber again. The read model
is then missing the event, which is why the fault has to be seen. See decision record 0029.

Seeing everything is a connection's, not a house's: `seeAll` sets significance aside for whoever sent it, so
the same house is in a coarse cell for one session and not for another. It is a way of looking rather than a
fact about the world, which is why nothing about it is stored or recorded. The player's eye is a different
thing and needs no frame at all: a player's own house reaches their session rather than a cell, so keeping
it in sight is a page drawing what it already has. See decision record 0038.

## What a house sees

The fog of war is one read model and a frame. `SightProjection` folds every house's **vision points** from
the feed - its seat from the founding, and each key figure for every stretch they stand in one place while
they are the house's - and works them out rather than recording them, because the world already records
where a seat is and where a person stands. Vision given outright is recorded, because nothing else records
it: `house.gainedVision` and `house.lostVision`, read straight off the events. The gateway sends a house's points to its player as `yourSight`,
on hello and whenever one opens or closes, the way it sends `yourHouse`: to the session, never to a cell.

The server is the one place a sight is worked out. The page draws the fog from what it is sent, and the
gateway asks the same sight before it sends anything, so what is drawn and what is held back cannot disagree.
`Fog`, in the gateway, is decision 0061's table: a house on revealed ground, a person in vision, a player's own
house and key figures always, and anything of significance 80 from anywhere. The read models ask it before a
cell's cap, so hidden houses never crowd out one that may be sent and are never counted, and the fan-out asks
it before every delta; a change to a house's sight answers every cell its player holds again. A vision
point's size is kilometres on the ground, and how far that reaches on the map is `Reach`, beside the cells in
`protocol` and in the TypeScript package for the reason the cells are there: both ends compute it
identically, against `contracts/fixtures/reach.json`. Several points together, with the **surface tension**
between them (0064), are `Coverage`: every circle and whatever a ball of the tension's size cannot get into,
answered exactly for one place at a time by the gateway and the page's marks alike, against
`contracts/fixtures/coverage.json`. The fog's distance field comes to the same edge for a whole grid at once,
through a distance transform. See decision record 0061, and
`docs/plans/fog-of-war.md` for what is built.

**The fog is a layer of the sprite canvas**, `sprites/FogLayer.ts`, drawn between the world and the signs for
the things in it: the scenery and whatever stands outside vision under it, every icon and whatever stands in
vision over it (0063). It asks the sprites' projection in `cameraMath.ts` backwards for the ground under each
pixel, and reads there a distance field of the vision points, worked out in the browser once for each change
to them (`apps/web/src/fog/`) and handed to the graphics card as one small half-float texture. Nothing about
the fog is worked out while the camera moves except that one pass. See decision record 0062. The scenery
layer asks the same field where it may grow (`revealedAt`), as a cell is taken into view and again when the
fog changes, so no tree stands in the haze; the scatter itself stays a pure function of the ground.
**Revealed ground loses its colour in each canvas** (0065): the map's through `.uncolouring`, a 2D canvas
between the map and the sprites that `fog/uncolouring.ts` lays a grey picture of the field on, blended by the
browser's saturation blend, and the sprites under the fog by a filter on the container that holds them. The
fog shader's code for where a pixel lies and how far inside each edge is shared by the fog and the filter.
The sprite canvas draws when the map has drawn and has no clock of its own, except the haze's: while the fog
is drawn close in with unknown ground on the screen, it asks for a frame twelve times a second, so the haze can
drift, and stops asking the moment there is none.

## What acts on its own

Three things in the program act without anybody sending a command, and they keep the same rules: one
subscription to the feed from the beginning, with a fold of their own rather than a read of a read model,
because two subscriptions can stand at different points in the feed; commands issued through `Later`,
never inside the feed's own callback; no cancellation table; and every refusal that means "already done"
swallowed, which is what makes a replay write nothing twice.

- **The pledge release**, `Pledges`, waits out a pledge's span and gives it back: one wake-up a pledge, at
  the moment it is due, and none without one. See decision record 0053.
- **The listener for character deaths**, `CharacterDeaths`, writes a character's death into every house
  that held them as a key figure, in the death's own story, and undoes a tie made to somebody already dead.
  It is how a death on a character's stream reaches the houses' streams, which no one decision can write
  together. See decision record 0055.
- **The listener for broken requirements**, `BrokenRequirements`, asks the domain which requirements each
  event breaks - `requirementsBrokenBy`, handed in, so it knows no kinds - and sends `FailRequirement` to
  every house with an open dialogue that needs one, in the story of the event that broke it; a dialogue
  offered with a requirement already broken lapses at once. What a failure ends is the house's own rule. A
  death is heard by both listeners, each for its own concern. See decision record 0067.

## Scale principles

1. One stream per house and one per character (decision 0055), and no global aggregate. Anything
   world-shaped is a projection.
2. Resources are rates. Events are emitted when something changes, never on a clock, so idle players cost nothing.
3. The world is partitioned into cells, at every zoom: a quadkey, so a cell's ancestor is its prefix. Routing keys,
   subscriptions and read model queries all derive the cell from the place on the event by one shared function,
   mirrored in the browser and held to shared vectors. An event carries where it happened and how much it matters,
   never a cell; how far out a thing is drawn comes from its significance. See decision record 0026.
4. Gateway nodes are stateless apart from their live connections: one broker consumer per node, an in-memory index
   from cell to sessions, and no stickiness required from a load balancer.
5. Pushes are coalesced per session on a short timer, and outbound queues are bounded. A client that cannot keep up is
   told to resynchronise rather than being allowed to grow a queue.
6. The map is drawn from read models. The event store is never queried to render anything.
7. Every principle above is checked by the bot swarm, not assumed. Ten thousand connections on one development
   machine is the number to prove, and proving it is on the roadmap under Later rather than next.

## The fate engine

Nothing of this is in the source yet. It is here rather than in `SETTING.md` because it is a part of the
program rather than a part of the fiction, and `MECHANICS.md` points at it from the mechanics it drives.

The **fate engine** rolls what could happen to a house at a moment. Its inputs are the house's stats, its
house-spirit, where the player is looking and what is around there; its output is a set of options of
comparable value, each with a rarity, which reaches the player as a **choice roll**. It is one side of a coin
whose other side is that mechanic, so what is asked of one is asked of the other: enough rolls that repeats
are not noticeable, and never a legendary option sitting beside two commons.

Two things follow for the architecture, and neither is built:

- A roll is **not** a decision of the domain. The engine proposes; the player disposes; only the taken option
  becomes an event. The giver of a choice is application code, as arrival is today, and the roll is what a
  giver consults. See decision record 0034 for the pattern it plugs into.
- A rolled option can name a thing that does not exist yet. Because play is chronological, that thing is
  simply created going forward - there is nothing to reconcile with the past, and no constraint solver.

## What the setting asks of the architecture

`SETTING.md` describes a world; two of its demands are not yet met, and are recorded here so that the first
increment to touch either starts from them.

1. **Things with lifetimes are their own streams.** A cathedral raised by one house and ended by another is
   shared state, so it cannot live inside a `House`. Places, structures and characters become aggregates
   with a lifetime `[from, to)` in world-time. One stream per house becomes one stream per thing that can
   exist. **A key figure is not one of them**: it is a tie between a house and a character, written in the
   house's own history, so the house keeps its own rules about whom it holds. Characters are the first,
   decided in decision record 0055 before any code; each later kind gets its record the same way.
2. **The map is a temporal read model.** Rows carry `since` and `until` in world-time, and the map at
   world-time T is a range query: `since <= T < until`. Decided and built for houses with decision record
   0027. A character, who moves and dies, is the first thing to use the other half of it: the characters
   projection keeps a **span** for every stretch a character stood in one place, closed by a move, by
   leaving the map or by death, and a cell at T is the spans that hold T (0055).

A third demand, a resource that ticks, already has its answer: a resource is an amount, a rate per second and
the instant at which that was true, and an event is recorded when the rate changes rather than on a clock.
See decision record 0006. **What** the resources are is now settled too - wealth, domain, influence, reason
and piety, one `Stock` apiece - and every rate among them is zero, because nothing in the world generates
income yet. The shape is carried anyway so that income, when it arrives, is a number changing rather than a
frame changing. See `SETTING.md` and `GLOSSARY.md` for what each of the five is.

## What a dialogue asks of the server and the client

Nothing of this is built. `MECHANICS.md` describes **character dialogue**, decision record 0067 decides its
shape, and `docs/plans/character-dialogue.md` is the order it is built in; what follows is what it costs the
program, recorded before anything is written so that the first increment starts from it.

**The server walks a dialogue, and holds back what has not been reached.** A dialogue is offered whole on the
house's stream, and where it has got to is one pure function in the domain, the walk, `Dialogue.walk`: what
has been said, the stretch still to read up to the next step the history records, and the options pending.
The decider accepts a step only where the walk says there is one, and the gateway builds what the player is
sent from the same walk - what was said and the stretch ahead, never the lines past it and never the
requirements. It is the fog's rule (0061) applied to a conversation, and for the same reason: the setting's
secret is meant to come out through dialogue, and a dialogue handed to the browser whole can be read ahead.

**What is left to `client-core` is the reading.** Which line of the stretch is showing, who is speaking, and
when a press has to be sent as a step rather than simply shown, is logic with no DOM in it, so it sits in
`packages/client-core` behind the layer rule and is tested without a browser. `apps/web` draws what that
logic says. It keeps its place while what it reads is unchanged, and reads the stretch again from its start
after a reload. A dialogue that keeps its state in a React component is a dialogue that can only be tested by
clicking through it.

**Where it is drawn is still an open choice, and it matters.** PixiJS is only in `sprites/` today, where it
draws the map's overlay behind the `SpriteRenderer` interface: the sprites, the scenery and the fog. Every
other piece of interface, the parchment included, is React and the DOM. A dialogue is interface rather than
map, so the DOM is where it would naturally go — but the mechanic exists for its feel, and characters that
enter, leave and react are what Pixi is for. The two routes:

- **DOM and CSS.** Simplest, responsive for free, animation limited to what CSS transitions and transforms
  give. Nothing new in the stack.
- **A Pixi surface inside the panel.** Sprite sheets, tweens and per-character animation, at the cost of
  another WebGL surface beside the map's and a layout that has to be driven rather than declared.

The DOM is the recommendation: what Adam has described - a scene, a feed of bubbles, a list - is the shape of
a document, and the movement in the scene is fades and transforms. Whichever is picked gets a decision record
before the pane is drawn, because it is hard to reverse once a dozen conversations are written against it.

**It is responsive from the first line of it**, and a pane like any other: on a desktop it takes a column
down the right of the stage, and on a phone it takes a bay and can be opened out. See `RESPONSIVE-DESIGN.md`,
and the mechanic's UI in `MECHANICS.md`.

## What the bays ask of the client

The stage is a map with a column of bays lying on it, and one rule places them at every size; decision
record 0040 says why, and `RESPONSIVE-DESIGN.md` says what it looks like. What it costs the client is small
and specific.

**The layout is arithmetic, in a module of its own, with a test.** Given the stage's size and what each pane
asked for, out comes which side the column is on, how big it is, and every bay's box. No DOM, no React,
nothing to click: the
same shape as `stageBox.ts`, which is the stage's own arithmetic and is pure for the same reason. It stays
in `apps/web` rather than moving down to `client-core`, because the layer rule is there to keep *game* logic
testable without a browser and this is presentation arithmetic that would mean nothing to a headless client.
The test is what makes it reviewable; the component only renders what it is handed.

**A pane is declared, not positioned.** A pane says what it is called, the mark it is known by, which tile
of the spread it belongs in, how tall that tile is at each of its sizes, and - where it has one - what its
full form needs before it has to draw itself smaller. The layout places it. Nothing in the layout knows
what a map is, and no pane learns where it is beyond the room it was given, which is what lets a ui
mechanic be written once and drawn at every size.

**A pane declares nothing about a phone.** How the two bays divide the stage is one value with three
settings, held by the fold: a strip and the rest, half each, or the rest and a strip. A bay is one end of a
stage two panes are sharing, so what is standing in it has nothing to say about how much of it there is -
which is what makes moving a pane between bays free, and what makes the three sizes mean the same thing on
every pane. A tile in the spread is the other case and keeps its own heights, because nothing is competing
for the room there. See decision record 0046.

**Two panes naming the same bay share it**, and that is the whole of how a bay holds more than one. The
panes declare it rather than the layout deciding it when they stop fitting, so a tab cannot appear and
vanish as a window is dragged. **Whether they take turns or stack is the bay's property** - the rail stacks
its windows, everywhere else the panes are alternatives behind a tab bar - and the arithmetic learns only
that a tabbed bay is a strip taller than its own size. That size is the tile's rather than the tab's, and
the layout is not told which tab is up, so pressing one resizes nothing. See decision records 0042 and
0057.

**Nothing is unmounted to move it.** A pane changes bays by changing which cell of a grid its wrapper sits
in, not by being torn down and rebuilt elsewhere. That matters for exactly one pane and it matters a lot:
`MapView` calls `map.remove()` when it unmounts, and MapLibre holds the camera, the style and a WebGL
context, with the sprite overlay's Pixi canvas beside it. One DOM tree and no portals is the whole
technique, and it is free because everything on the stage is already `position: absolute; inset: 0` - a pane
only ever needed a positioned box around it, and the stage was already that box.

**The camera is told what the column covers.** The column lies on the map rather than taking room from it,
so the map's visible middle is not its geometric middle. Whatever flies the camera reads the layout's answer
for that, in one place, rather than every caller guessing.

**Which bay holds what is where the player is, not a preference.** It is a module store with a listener
set, like the gateway and the selection and the areas, and a reload forgets it. **The trail does survive a
reload**, because a trail that empties itself is not a trail, and it is the only thing on the stage that
does; what comes back from storage is checked rather than trusted, because a previous version of the code
wrote it. What persists besides that - the phone toggle, the folded sections - is Adam's and lives in
`debug/stage.ts`.

## Events over time

Event types are versioned by name and catalogued in the event catalogue, which a test parses. Until the
world-persistence milestone the store may be wiped instead of migrated, which is what makes early experimentation
cheap; after it, changes need upcasters. The decision records carry the reasoning.
