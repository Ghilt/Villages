# 0005. No game engine: MapLibre owns the camera, Pixi draws the sprites

- Status: accepted
- Date: 2026-09-01

## Context

The main screen is a map of the real world. Houses appear on it as sprites that should scale with zoom and move
slightly, so that the world looks alive. A game engine would bring a camera, a scene graph and a loop of its own.

## Decision

No game engine. MapLibre GL owns the map and the camera. A PixiJS overlay draws the sprites on a transparent canvas
above it and is synced to the map camera once per frame. The overlay sits behind a renderer interface, so that it can
be replaced without touching anything else.

## Consequences

Exactly one thing owns the camera, so there is no reconciliation between two of them every frame. The sync is ours,
roughly a hundred lines, and its maths is pure and unit-tested. Sprites get real animation, hit testing and a
level-of-detail scheme, which the map's own symbol layers cannot cheaply provide, because layout properties such as
icon size cannot read per-feature state. If the overlay hits a ceiling, the interface lets a purpose-built custom
layer or deck.gl take over.

## Alternatives considered

- Symbol layers alone: animation would mean diffing a source every frame, and per-sprite motion is not expressible
  in the style.
- deck.gl interleaved: strong for very large counts, heavier as a dependency, and less direct control over playful
  animation.
- Phaser or Godot over the map: the engine wants the canvas and the camera, and every frame becomes a negotiation
  with the map.
