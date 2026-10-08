# 0075. A mechanic has one place in each layer

- Status: accepted
- Date: 2026-10-02

## Context

The review of 2026-10-02 found the layers sound and enforced, and a mechanic with no home in any of them. Each
one was threaded by hand through the same shared files - `Gateway.kt`, `HouseDecider.kt`, `net/gateway.ts`,
`styles.css` and the rest - and every mechanic made those files longer. Five mechanics live on a house's stream
today: what a house has, what it is asked, what it is told, whom it holds and what it sees. Each read model
named every event of the other four, one by one, to say it had nothing to say about them, so a new dialogue
event meant editing the map's fold, the sight's fold and the choices' fold, none of which had anything to do
with dialogues; and the characters projection skipped all of them with an `else`, so a new event that it should
have heard would have gone past it without a word.

Decision record 0072 stops the shared files growing. It does not say where the code goes instead.

## Decision

**A mechanic has one place in each layer, and a file that serves every mechanic routes to those places rather
than holding them.** The places, as they stand:

- **The domain:** its events form a **family**, a sealed interface on the house's stream with nothing of its
  own - `ResourceEvent`, `ChoiceEvent`, `DialogueEvent`, `KeyFigureEvent`, `VisionEvent`. An event names its
  family beside its half, `WorldEvent` or `PlayerEvent`, so the hierarchy answers a third question once: where
  it is kept, what kind of thing happened, and which mechanic it belongs to. The founding is in no family,
  because every mechanic reads it.
- **The read models:** a fold with nothing to say about a mechanic passes its whole family in one branch, and no
  fold over events has an `else`. A new event is placed by the compiler in every fold that names its family,
  and only those that care about it have to be edited.
- **The gateway:** what a frame says about a mechanic is worked out in a file of its own beside `Gateway.kt` -
  `HouseViews.kt`, `DialogueViews.kt`, and the rest - and a refusal's code in `Refusals.kt`.

The rest follows in the steps that build it, each amending this record: the house decided in parts, one a
mechanic, with `HouseDecider` routing between them; the gateway's connection made of parts in the same way; and
the client's session folded from one slice a mechanic.

*Amended 2026-10-02, the house in parts:* a founded house is who it is and a part for each mechanic, and
`HouseDecider` decides the founding and routes the rest. A house's commands come in the same families as its
events - `ResourceCommand`, `ChoiceCommand`, `DialogueCommand`, `KeyFigureCommand`, `VisionCommand` - and
each family goes to the part that decides it and folds its events: the `Treasury` what the house has,
`KeyFigures` whom it holds, `Visions` what it was given to see, `Dialogues` what it was told. The choice
pending stays on the house, because an unfounded house is asked things too, so `Choices` keeps its rules over
the house whole. A part that asks something of the rest of the house - an option or a line that grants, spends
or founds - is handed a `Follow` by the decider and asks it, which is the only way one part reaches another.
Whatever reads a house reads it as it always did: the house answers `pledges`, `keyFigures`, `freeOf` and
the rest from its parts. A sixth mechanic on the house's stream is a part, a family of commands, a family of
events, and a line in each of the decider's two routes.

*Amended 2026-10-02, the gateway in parts:* `Gateway.kt` is the core every mechanic shares - who a connection's
player is and the takeover, the cells held and the fan-out index, coalescing, the fog gate and a cell's
snapshot - and each mechanic is a `Part`: `HousesPart`, `KeyFiguresPart`, `DialoguesPart`, `ChoicesPart`, and
the `Instruments`. A part greets a player arriving, after the welcome and in the order the gateway lists the
parts, which is the order the page is told things in; registers the commands and the frames it takes, in
`Commands` and `Frames`, each kind with exactly one handler; watches its own read models; and forgets what it
kept of a connection when its session ends. The core answers the frames in `CORE_FRAMES` itself, and a test
holds every kind of frame and of command to being taken exactly once. A hook arrives with the first part that
needs it, rather than ahead of one.

*Amended 2026-10-02, the way of looking:* how a connection looks at the world - the day, the eye, the fog's
switch and the fog itself - is one value, `Looking`, replaced whole behind one reference, so that a fan-out on a
read model's thread reads one way of looking and never half of a change to it. The sight, the stands and the
timeline are parts: `SightPart` sets the fog before the welcome and says what the house sees, `StandsPart`
keeps what each page draws and has been sent, and `TimelinePart` answers the scrubber. A change to the way of
looking answers every held cell again and tells the parts, which is how the stands are sent again when the fog
moves. The core keeps the fog gate - every snapshot and delta asks `Looking` before it goes - and the parts
say what the fog is.

*Amended 2026-10-08, the parts made beside the core:* the gateway took every port a part reads as a
parameter of its own and listed the parts itself, so `Gateway.kt` grew with every mechanic and reached its
size ceiling (0072). The ports a part is made from are now one value, `Mechanics`, and the parts are made from
it by `partsOf` in `GatewayParts.kt`; the cell snapshot is read in `Snapshots.kt`. A new mechanic is a field
of `Mechanics` and a line in `partsOf`, and the core does not grow with it. The core keeps what it reads
itself: the houses and the people in a cell, for the snapshot.

## Consequences

- A sixth mechanic adds a family, a read model and a view file, and edits the folds that care about it and no
  others. `BUILDING-A-MECHANIC.md`'s checklist says where each part goes.
- The families change nothing that is written. An event's class name, its type and its fields are as they were,
  and Jackson writes no interface it implements, which `EventFormatSpec` holds.
- An event that belongs to two mechanics has to be put in one of them. None does yet; the day one does, it goes
  where it is decided, and the other mechanic's folds name it on its own.

## Alternatives considered

- **Leave the folds naming every event.** It is what kept a new event from slipping past a read model, but the
  families do that too, and with an `else` in one fold it was not doing it everywhere.
- **One stream per mechanic.** The house's stream is the consistency boundary a decision is taken inside: a
  dialogue's step and what it spends are decided together and appended together (0034, 0071). Splitting the
  stream would split those, and nothing found asks for it.
