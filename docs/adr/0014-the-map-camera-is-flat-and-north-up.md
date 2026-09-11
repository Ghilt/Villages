# 0014. The map camera is flat, north-up and single-world

- Status: accepted, its edge rule below the fit zoom extended by 0033
- Date: 2026-09-01

## Context

The sprite overlay is synced to the map camera by hand. That sync is simplest, fastest and most numerically stable
when the visible world is an axis-aligned Mercator plane, rendered once.

## Decision

For now, map rotation and pitch are disabled, and the map does not render copies of the world past the antimeridian.
The projection is Mercator.

## Consequences

Placing a sprite costs two multiplies against the map centre, which stays exact at high zoom and remains cheap at ten
thousand sprites. In exchange, a player cannot tilt or spin the world, and panning stops at the edges of the map
rather than wrapping, which is a genuine loss of feel, worth revisiting once the sprite path is proven. Enabling any
of the three means the sync must handle a full camera transform, and the renderer interface is where that change
lands.

## Alternatives considered

- Allow rotation and pitch now: a full matrix sync and billboarded sprites, before we know we want either.
- The globe projection: striking, and the overlay maths becomes three-dimensional.
- Render copies of the world: nicer panning, and every sprite needs one instance per visible copy.
