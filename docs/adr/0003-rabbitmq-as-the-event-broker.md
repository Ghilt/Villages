# 0003. RabbitMQ as the event broker

- Status: accepted
- Date: 2026-09-01
- Amended 2026-10-12, as the broker was built (decision record 0094): **one queue per follower, bound to
  everything, until a gateway keeps no read models of its own.** The one server keeps every read model, so each
  follows the broker through an exclusive queue named after it rather than one queue a node; the cell is in the
  routing key already, `<aggregate>.<verb>.v<n>` and its quadkey a digit a word, so a node that binds by cell later
  changes a binding and not the bridge. The durable subscription is Occurrent's, its place kept in MongoDB, and
  the bridge publishes by hand, because Occurrent 0.33 has no broker module. The reactions follow the store, not
  the broker.

## Context

Stored events have to reach the projections and every gateway node. With tens of thousands of connections, fan-out
cannot run through the database, and a gateway must be able to ignore cheaply the events its players are not looking
at.

## Decision

RabbitMQ 4.3 with a single topic exchange. A durable subscription on the event store bridges every stored event onto
the exchange, with a routing key that carries the aggregate, the event and the cell. Each gateway node consumes
through its own exclusive queue.

## Consequences

There is one more thing to run locally, which Compose provides. Because the routing key carries the cell, a node
filters on a string rather than on geometry. Classic non-replicated queues are the right shape for transient per-node
consumers; quorum queues and streams stay available if durability or replay through the broker is ever wanted.
Ordering is guaranteed per stream by the event store, not by the broker, so clients tolerate deltas arriving out of
order by comparing versions, which is a property worth having in any case.

## Alternatives considered

- Kafka: stronger ordering and replay, heavier to run, and the library supports either. Reconsider if replay through
  the broker becomes a requirement.
- Projections and gateways polling MongoDB directly: fewer parts, and it couples every gateway node to the database.
- No broker at all, with everything in one process: fine today, and it forecloses the horizontal scaling that the
  whole design is for.
