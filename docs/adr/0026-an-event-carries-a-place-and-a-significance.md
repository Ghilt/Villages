# 0026. An event carries a place and a significance, and cells are derived

- Status: accepted
- Date: 2026-09-05
- Amended 2026-09-19: the chrono-engine named below is now the **fate engine**, described in
  `ARCHITECTURE.md`, and the chrono jump it was named for is gone. The decision itself — a place and a
  significance on the event, the cell derived wherever it is needed — is unaffected.

## Context

Decision 0007 put a cell on every event: a quadkey at zoom 8, computed in the domain, carried so that
routing, subscriptions and read models never recomputed it and could never disagree.

Adam's objection, and he is right: a Web Mercator tile address at a fixed zoom is a fact about how we
draw and route the world, not a fact about the world. Putting it in the domain ties the game's own
vocabulary to the screen's. A house has a seat; it does not have a quadkey.

The fixed zoom was also wrong for a second reason, which only appeared when we worked out how the map
would actually be drawn. Cells at zoom 8 partition live updates well when you are standing over a region
and not at all when you are looking at a continent: showing Europe would mean subscribing to thousands of
them. And nothing in the model said which of the things in a cell were worth drawing when zoomed out, so
a cell full of houses had no answer but "all of them" or "a statistic".

## Decision

**An event that puts something on the map carries where it happened and how much it matters. It never
carries a cell.**

- **Place** is a location in our world, which the domain already has.
- **Significance** is a number from nothing to a hundred: the world's own judgement of how much this
  matters. It is a domain value, because how much a founding matters is a game question.
- **A cell is derived**, by one shared function, wherever something needs to partition space. It lives in
  `protocol` beside the frames, because both ends compute it and a disagreement would be a hole in the
  map; `contracts/fixtures/cells.json` holds the vectors both are held to.

**A cell is a quadkey at any zoom from zero to ten, not a fixed eight.** A quadkey is one digit per zoom
level, so a cell's ancestor is its prefix: everything inside a tile is a prefix match, zooming out drops a
character, and finding every session that should hear about a thing is walking its own prefixes. A cell at
zoom 2 is a quarter of the world and a cell at zoom 10 a few tens of kilometres, and they are the same
kind of thing.

**Significance decides how far out a thing is drawn.** `coarsestZoom(significance)` maps a hundred to zoom
zero and nothing to the deepest zoom. A feature appears in the data tile for every zoom from its coarsest
down to the deepest. Straight-line for now, and a guess.

That gives one query for the map, and it is the whole of the read side:

```
features where  quadkey starts with the tile          -- space: the pyramid
            and coarsestZoom(significance) <= zoom    -- detail: the world's own judgement
            and the world-time asked for is in its life
        take the most significant N, and say how many were left out
```

**The client asks for data on the same grid, at the same zoom, as the terrain tiles it already draws.**
Zooming out does not ask for more cells, it asks for bigger ones, so a screenful costs about the same
wherever you are and however far out. That is the property everything else rests on.

## Consequences

The domain shrank. `Cell` left it, and the two existing layer rules already forbid its return: the domain
may depend on nothing but the standard library, and the layered check will not let it reach `protocol`.
Proven by putting a `Cell` in the domain once and watching both rules fail.

The event catalogue gained a rule of its own: an event that puts something on the map carries a place and
a significance. It is in `EVENTS.md` above the table, where the format is described.

`villages.house.founded.v1` lost `cell` and gained `significance`, and **kept its version**. Strictly the
catalogue says a removed field is a new version. Nothing has ever stored one of these events durably -
there is no MongoDB on the machine yet and the store is in memory - so a `v2` would record a history that
never happened. This is the pre-alpha exception in spirit, and it is the last increment where it can be
taken without lying: once events survive a restart, the rule holds without exception.

`Significance` is a placeholder wherever it is set. A founding is 20, which puts a new house on the map
from zoom 8 in: visible standing over the region, not from the next country. The chrono-engine described
in `SETTING.md` will decide these properly; today one constant beside the founding rate does.

Nothing is subscribed to anything yet. This decision changes what an event says and where the grid lives;
the projection and the data-tile subscriptions that use it are the next increment.

## Alternatives considered

- **Keep the cell on the event, at zoom 8.** What 0007 decided. Wrong on both counts: it is not the
  world's own fact, and one zoom cannot serve a map that ranges from a valley to the planet.
- **Carry a cell at every zoom on the event.** Ten fields saying the same thing as one place, and every
  one of them wrong the moment the grid's depth changes.
- **No significance; summarise a coarse cell statistically.** Counts and dominant colours. It scales, but
  it answers "what is in this square" when the question is "what matters here", and a world of noble
  houses should be able to say that a cathedral is worth seeing from further away than a mill.
- **Put the grid in a module of its own.** Honest, and it is a kernel. But `protocol` is already the
  module for what both ends must agree on, cells already travel on the wire as strings in
  `subscribeCells`, and the fixtures already sit together. A new module would have been ceremony.
- **Put the grid in `application` or `projections`.** The browser needs the same arithmetic, and only
  `protocol` is mirrored in TypeScript and tested against shared vectors.

## Amendment, 2026-10-15: significance ranks, it no longer decides the zoom

Everything on the map is now sent from zoom 7 and drawn from 7.25, whatever its significance, and `coarsestZoom` is
gone. Significance still travels on every event and ranks what is drawn. See decision record 0096.
