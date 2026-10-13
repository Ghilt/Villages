# 0007. One shared world, partitioned by cells

- Status: accepted
- Date: 2026-09-01
- Overtaken in part by 0026: an event carries a place and a significance and never a cell, and a cell is a
  quadkey at any zoom, worked out downstream by one shared function. The broker's routing key carries that cell,
  a digit a word (0094).

## Context

The fiction is that everyone is a house on the same Earth. A map view at low zoom can cover a large part of that
Earth, and therefore a large number of houses.

## Decision

A single shared world, with no shards. The world is divided into cells, quadkeys at zoom 8. The cell of a location is
computed in the domain and carried on every event, and the same cell is used by broker routing keys, gateway
subscriptions and read model queries.

## Consequences

Players are in one place together, which is the point of the setting. Live traffic scales with what a client is
looking at rather than with the size of the world: a viewport becomes a set of cells, diffed as the map moves, with a
cap per session. Low zoom therefore needs aggregation rather than sprites, which Phase 2 owns. Because the cell
travels on the event, no consumer recomputes geography, and there is one definition of the grid rather than three.

## Alternatives considered

- Shards of a few thousand players each: easier to scale, and it splits the community and breaks the one-Earth
  premise.
- A private world per player: fastest to build, and it throws away the thing that makes the map interesting.
- Geospatial queries per update with no grid: no cheap routing key, and the database is back in the fan-out path.
