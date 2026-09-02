# 0002. Event sourcing with Occurrent on MongoDB

- Status: accepted
- Date: 2026-09-01

## Context

The shape of the game is unknown and will be found by experiment. That makes two properties valuable: any state in
the world can be explained by what happened to cause it, and a new way of looking at the world can be added after the
fact, over history that already exists. The world also needs to notify projections and a broker when something
happens.

## Decision

Event sourcing with Occurrent 0.33 on a MongoDB event store. One stream per house. Events on the wire are CloudEvents.
Writes use optimistic concurrency on the stream version. The rules live in pure decide and evolve functions in the
domain module, and the library's application service does the loading, the deciding and the appending.

## Consequences

MongoDB has to run as a replica set, because subscriptions are built on change streams; local development and the
integration tests both provide one. Occurrent moves quickly, with breaking renames between 0.30 and 0.33 in two
months and no automated migration for Kotlin, so every Occurrent type stays inside one adapter module and an upgrade
becomes a contained, test-covered exercise. The decider shape maps one to one onto a pure domain layer, so the game
rules are tested in milliseconds with no infrastructure at all. Reading the world for the interface is a separate
concern, served by projections.

## Alternatives considered

- Our own append-only store: full control, and we would be writing subscriptions, concurrency and catch-up ourselves.
- Axon: more framework and more opinions than a project this exploratory wants.
- A relational store with an outbox: loses change streams and the decider model, and adds a schema to migrate.
- Ordinary state-based persistence: throws away history, which is the part we specifically want.
