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
