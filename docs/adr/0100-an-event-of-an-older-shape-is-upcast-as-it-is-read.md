# 0100. An event of an older shape is upcast as it is read

- Status: accepted
- Date: 2026-10-17

## Context

Every event type is still its first version, and decision record 0011 lets the store be wiped rather than migrated
until the world-persistence milestone. But the worlds are kept now - in MongoDB, one a tree, outliving their servers
(0092, 0094) - and a world already met events the code could not read (0036's amendments). The first world that must
not be wiped needs a way to change an event's shape without rewriting the store, and the time to build it is before it
is needed, when the change it has to carry is not also waiting. `docs/EVENTS.md` already says the next version is a new
type and the old one stays handled; nothing in the code said how.

## Decision

**An event stored as an older type is carried to today's type by upcasters as it is read, inside the one converter
every reader of the store uses.** The code writes only today's types and reads only today's classes.

- An `Upcaster` is one step: the retired type it reads, the type it hands on, and what it does to the stored data.
  Steps chain, a version at a time, until a type no step starts from; `Upcasters.ALL` is every step the code knows.
- `Events.converter()` wraps the type-mapped Jackson converter in `UpcastingConverter`: writing is untouched, reading
  goes through the steps first. The fold of a stream, the feed, the store's readability check at start and the event
  page all read through it, so there is no second way in.
- A retired type leaves `EventTypes` - the table maps each class to the one type it is written as - and stays in
  `docs/EVENTS.md`, marked retired. Its stored fixture moves to `contracts/fixtures/events/retired/`, where it is never
  changed again.
- `UpcastersSpec` holds the rules: a step starts only from a type no longer written; every chain ends at one that is;
  no type is reached twice and no chain goes round; every retired type keeps its fixture, and it still reads back. The
  stage itself is proved on a made-up retired founding, since no real type is retired yet.

- **A recorded store** is the other half: `contracts/fixtures/stores/` holds whole histories of little worlds, each
  written once through the real executors (`StoredWorldSpec`, run with `-Dstore.record=true`) and never changed. Every
  event in every recording must still read and every stream fold, so a change that would strand what an older code
  wrote fails the checks until it brings its upcaster. The first, of 2026-10-17, holds ten events: two houses, a grant
  and a spend, a person brought in, moved and grown more pious, a mill raised, filled and handed on.

## Consequences

- Changing an event's shape after the world-persistence milestone is a new type, a step, a fixture moved and a line in
  the catalogue, and no wipe.
- A step works on the stored JSON, not on classes, so it never needs the old class kept alive; the cost is that a
  step is written against the shape in the retired fixture, which is why that fixture is kept.
- Folding a long stream reads every event through the stage; with no steps that costs a map lookup an event.
- What is stored keeps the type it was written as: the event page shows an event as it was stored, upcast or not.

## Alternatives considered

- **Rewriting the store** to the new shape, a migration. It changes history in place, which event sourcing exists not
  to do, and would have to run in every tree's database at once. Rejected.
- **Keeping every old class**, each folded alongside the new. Every decider and projection would handle every version
  of every event for ever. Rejected: one step from old JSON to new keeps the code reading one class.
- **Upcasting in each reader.** Four ways in, four chances to forget one. Rejected for the one converter.
- **Waiting until the first v2.** The seam would then be built under the pressure of the change it carries. Rejected.
