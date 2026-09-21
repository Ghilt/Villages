# 0007. A world of stands

- Status: open
- Started: 2026-09-21

## Hypothesis

Scenery gathered into **stands** — clumps of a few kinds, placed by a program that read the master, and
clipped to the terrain Adam painted — will read as a place rather than as wallpaper, where the even
scatter of 0006 does not; and a **biome** chosen from the ground, the latitude and a slow noise field
will make two forests of the same terrain class in different parts of the world look like two different
forests. Both inside 0006's budget of 0.44 points to the square unit, and without the browser storing or
being sent a single sprite.

Falsifiable three ways. The stands may read as blobs rather than as woods. The biomes may be
indistinguishable once the terrain class has had its say, in which case the whole first layer is an
expensive noise field. And the arrangement may only be affordable by spending more points than the
budget allows, which would mean the look is bought from the frame rate.

## Setup

The smallest thing that answers it, built in the order of `docs/plans/biome-sprite-map.md`:

- `world/biomes.json`, hand-edited, holding the kinds and the biomes, validated by a test over the real
  file.
- An offline generator, `npm run world:sprites`, that reads the master, writes a biome raster in world
  space and a list of stands chunked by zoom 7 tile, and prints what it made.
- The browser's existing scatter, which keeps 0052's mechanism entirely — the same grid, the same
  `hash2`, the same 32-unit cells, nothing stored — and changes only what it asks the ground.
- Sixteen kinds instead of three, drawn in code as the three are.

Nothing on the wire, no server, no protocol. The one new thing on disk is a generated directory per
master that a master is allowed not to have.

## What we will look at

**For the hypothesis about the look, Adam's eye, and nothing else.** The instruments are the six
painterly views rendered as stills, the `biome` renderer in the Debug map dropdown for the biome layer on
its own, and the running map over the forests of Dalarna at zoom 9.8 — the same ground 0006 measured on,
so that the numbers compare directly.

**For the hypothesis about the budget, the generator's own report and the Scenery section.** The
generator integrates the expected points to the square unit over each view before it writes anything and
prints them against 0.44. The panel then says what actually happened: points kept, on screen, cells cut,
and the worst frame gap while the map is moving.

**And the check that 0006 says matters most: sweep from zoom 6 to zoom 10, not just 10.** The cost is
dominated by how many cells the view spans, which is worst far out. The number that would refute the
whole approach is `points kept` at zoom 6.5, where 0006 measured 42,087 held to draw 410.

## Observations

*(written as it happens)*

## Result

*(confirmed, refuted or inconclusive, and what surprised us)*

## Decision

*(keep, kill or pivot, and the documents that change with it)*

## Follow-ups

*(what this opens up)*
