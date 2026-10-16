# 0099. Critters are made up by the page from the place and the clock, and drawn as sprites

- Status: accepted
- Date: 2026-10-16
- Plan: `docs/plans/living-world.md`

## Context

Adam, on 2026-10-16, asking for the environment to be living: a critters density in the Shaders section, a critters
shader for every biome, *"maybe some birds flying out from a bush or a squirrel hopping around. Fishes jumping out of
the water"*, framed as a shader *"because they hold no real gameplay significance"*, and asking whether a shader can
use animated sprites or has to make do with rough shapes.

Three things about the map shaped the answer. A world unit is a master pixel, about 1.2 kilometres, so nothing alive
is visible at its own size: the scenery is drawn at a board-game scale, a tree three to five units tall. The scenery
is placed in code, a pure function of the ground and the stands the server sends (0052, 0067), so only code knows
where a given bush stands. And the sprite canvas already draws in layers bottom to top, with the fog taking the colour
out of the ones under it (0062, 0065).

## Decision

**A critter is made up by the page, from the place and the wall clock alone.** The ground is cut into cells eight
world units across and the clock into slots of twelve seconds; a hash of a cell and a slot says whether anything
comes there then, out of which tree or bush the scenery drew in the cell, which of the cast of the ground under it,
when in the slot, and how each bird of a flock flies (`sprites/critters/critterClock.ts`). Nothing is stored, sent or
seen by the server, and every browser works out the same critters at the same moment, as every browser draws the
same sky (0098). Whether a cell's slot brings anything is one draw against the density before anything else, so a
lower density only takes critters away.

**It is drawn as sprites, not by a shader over the screen.** A shader can draw an animated sprite as well as a shape,
so that was never the limit; but one over the whole screen would pay for every pixel to draw a few dozen birds,
could not know which bush the scenery drew, and could put nothing behind a tree. So a critter is a sprite, a frame
of its kind's strip from the atlas `world:critters` cuts (`world/sprites/critters/`, its frames side by side, how
many in `world/critters.json`, every frame of a kind cut to one box so they register). They keep their part of the
Shaders section all the same, because they are a look and nothing more.

**Two layers of the sprite canvas** (`sprites/critters/CritterLayer.ts`): their shadows on the ground under the
scenery, so a tree in front hides one, and the critters in the air over the scenery and under every mark. Both are
in the container the fog takes the colour out of.

**Only where the house sees now.** Adam's answer of 2026-10-16: the land in sight is the living land, and what is
only remembered holds still. With the fog lifted, everywhere is seen.

**Nothing pops.** A bird comes out of its cover within a moment and fades as it goes; one first seen already in
flight, where the view has just moved, fades up.

## Consequences

- The critters read the scenery's own cells (`currentPointsOf`), the class tiles under them, and the fog's field of
  sight (`visionAt`). Where the scenery is not drawn, nothing comes out of it.
- They are sized at the scenery's scale, below the twenty pixels a sprite is held to elsewhere, so what reads is how
  they move; the sizes are in `sprites/critters/look.ts`.
- While one is in flight the canvas draws at the critters' rate, and a few times a second otherwise, so the next is
  caught leaving.
- A player who asked for less motion gets none.
- Two browsers agree to within their clocks; a browser's own density, and in time its size, are its own.

## Alternatives considered

- **A full-screen shader, as the grass is.** Every pixel paid for, the bushes unknown, nothing behind a tree.
- **Sprites placed by the server.** Critters hold no gameplay significance, and sending them would cost every house a
  stream of events for nothing it can act on.
- **Critters on remembered ground too.** Asked of Adam and declined: a critter is news, and the grey ground is memory.
