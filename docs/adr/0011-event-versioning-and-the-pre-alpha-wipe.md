# 0011. Event versioning, and the pre-alpha wipe

- Status: accepted
- Date: 2026-09-01
- Amended 2026-10-17: **the way past the wipe is built**, ahead of the world-persistence milestone: an event of an older
  shape is upcast to today's as it is read (0100), and a store recorded by the code of a day is replayed by every day's
  checks after (`contracts/fixtures/stores/`). The wipe stays allowed until that milestone; what replaces it now exists.
  Worlds have been kept in MongoDB, a tree each, since 0092 and 0094.

## Context

Events are the only durable state, and in principle they last forever. In practice the first months of this project
will change what an event means several times, and nothing stored during them has any value to anybody.

## Decision

Event types are versioned in their name, and every type is listed in the event catalogue. Until the world-persistence
milestone on the roadmap, the event store may be wiped rather than migrated, and every wipe is recorded in the
experiment journal. After that milestone, a change needs an upcaster, and the old type stays handled when folding a
stream.

## Consequences

Experimentation stays cheap for exactly as long as there is nothing worth keeping, and the day that stops being true
is a named, deliberate milestone rather than an accident. Until then, players can lose their houses, which has to be
visible in the interface rather than discovered. The catalogue test makes the versioning rule enforceable instead of
aspirational, and every wipe leaves a written trace of what was learned.

## Alternatives considered

- Strict upcasting from the very first event: correct, and it spends real effort migrating data that nobody wants.
- No versioning at all: the first breaking change turns the store into archaeology.
- A migration tool up front: infrastructure built before there is anything to migrate.
