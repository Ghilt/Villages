# 0006. Resources are rates, not ticks

- Status: accepted
- Date: 2026-09-01

## Context

A house accumulates wealth continuously, the interface shows a ticker that should feel alive, and there may be tens
of thousands of houses doing this at once, whether or not anyone is watching them.

## Decision

A resource is an amount, a rate per second, and the instant at which that was true. The server emits an event only
when something changes the rate or the amount. Clients interpolate between updates.

## Consequences

Idle houses cost nothing: no timers, no scheduled work, no traffic. The event store fills with decisions rather than
with clock noise, which keeps history worth reading and keeps replay fast. Clients need the server's notion of now,
so skew is measured when a connection opens and refined by ping, and a small correction is applied. Any rule that
needs an exact value computes it from the rate at an instant, which is a pure function in the domain and trivially
testable.

## Alternatives considered

- Scheduled world ticks: a simple mental model, bursty load, and a history full of entries that mean nothing.
- Turn-based time: the simplest consistency story and the least living world.
- Pushing values to clients every second: traffic proportional to players times resources, for information the client
  can compute itself.
