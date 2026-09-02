# 0003. RabbitMQ as the event broker

- Status: accepted
- Date: 2026-09-01

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
