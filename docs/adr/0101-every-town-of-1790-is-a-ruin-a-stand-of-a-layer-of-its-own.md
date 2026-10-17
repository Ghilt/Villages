# 0101. Every town of 1790 is a ruin, a stand of a layer of its own

- Status: accepted
- Date: 2026-10-17
- Plan: `docs/plans/ruined-cities.md`
- Builds on 0054, which said a later layer of the sprite map - settlements, ruins - is a directory of its own, and on
  0067, which sends the stands only where the fog lets them through

## Context

The story has every town of 1790 fallen: the warped ritual pressed hardest where minds were thickest, and by 1790 the
towns and cities are ruins people shun. Adam, on 2026-10-17, asked which towns fell: *"all of them. Bigger city, more
ruins."* The towns of 1790 are already in the world - 3,168 carried onto the master through the origin map, each a
Wikidata id at a place in the world's own longitude and latitude (0087) - but nothing said how big any of them was:
the only rank held is Natural Earth's, today's, which puts Los Angeles above Pekin. And whatever draws the ruins has
to be the same for every player, and kept back under the fog as the scenery is.

## Decision

**How big each town was is a world input, `world/ruins.json`**: a town by its Wikidata id with about how many people
lived in it then, from the estimates for about 1800, and a hamlet's few thousand for every town it does not list.
Its people set the radius its ruins are built over - 1.25 world units for every square root of a thousand people,
between 3 and 42 - with an overgrown ring of 0.3 beyond, and how built-up its core is, from 0.35 of its lots for the
least town to 0.6 for the greatest. Tiers name the sizes, great to small.

**A town is one stand of the sprite map's `ruins` layer**, the layer 0054 foresaw: `world:ruins` writes it into
`world/stands/<master>/ruins/` as every stand is written, eight bytes - its middle, how far its ruins reach, the
culture they are built in as the favourite byte, worked out from the culture map where the town stands, how built-up
its core is as the thickness, and a seed from its id - into every tile its ruins reach. The master's
`sprites/ruins/map.json` says how to read one and nothing of where any town is. A town on a square of sea takes the
culture of the place on Earth it came from, and its ruins are drawn only on land. It is a world step of its own, after
the names and the culture map, and takes a second.

Rejected: a reserved favourite byte in the `biome` layer. It would have baked the ruins inside the heaviest step of
the world, made again on every change to the review of 1790, and every sum over a chunk's stands would have counted a
city as a wood.

## Consequences

- The ruins come through the channel the scenery does, and the fog lets a town through when revealed ground lies
  within its reach. The `stands` frame says which layer it carries, `biome` or `ruins`, from `STAND_LAYERS` at both
  ends (protocol version 57); the gateway sends every layer of every held tile, empty where a world has none; and
  its outbox keeps one frame a layer a tile, or a tile's ruins would replace its woods while both waited.
- How a ruin is laid out is the page's, from the record alone (decision record 0102), so that every player draws the
  same ruins.
- A stand written into the tile across the edge of the world is written as standing beside it, so its offset stays
  inside its two bytes. The `biome` layer does not do this yet, and a wood straddling the edge is placed wrong there.
