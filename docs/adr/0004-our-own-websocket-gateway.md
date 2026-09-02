# 0004. Our own WebSocket gateway

- Status: accepted
- Date: 2026-09-01

## Context

Browsers need live updates. RabbitMQ ships a Web STOMP plugin that can serve browsers directly over WebSocket, which
would remove a service from the design.

## Decision

A Kotlin gateway holds the player connections and speaks our own JSON protocol over plain WebSocket. Browsers never
connect to the broker.

## Consequences

Authentication, per-session filtering, batching, backpressure and the shape of the protocol are all ours, which is
what makes a cell subscription model and coalesced pushes possible at all. The gateway is written as though it were
already a separate deployable, so extracting it is a matter of configuration rather than a rewrite. It is code we
have to write and test, which is the cost. The alternative was exposing the broker to browsers, where authorization
in the STOMP plugin is per connection with no documented per-destination story; that would have made per-player
filtering awkward and the broker itself the public surface.

## Alternatives considered

- Web STOMP directly: fewest moving parts, and the broker becomes internet-facing with the wrong authorization model.
- STOMP over WebSocket through the framework's broker relay: a protocol we do not control and a heavier browser
  client, for a message set this small.
- Server-sent events: no channel from client to server, and commands need one.
