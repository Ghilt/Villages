# 0102. The land moves in one layer that knows what each world unit is

- Status: accepted
- Date: 2026-10-17
- Plan: `docs/plans/living-world.md`

## Context

Adam, on 2026-10-16, asking for a look of its own for every kind of terrain, and answering that the shaders for every
kind should be combined into one rather than each kind having its own. Close in, from zoom 8.5 to 10, only the water
and four kinds of grassland moved; the grass was a spike, a shader of its own in the sprite canvas, under the scenery
and in the container the fog takes the colour out of, reading a mask of the flat tiles under the view that said, a
byte a world unit, whether the ground there was grass.

A shader the sprite canvas draws over the whole screen pays for every pixel of it whether its terrain is under that
pixel or not, so a shader a kind would cost a screen a kind a frame. And the kinds move alike: what grows bends in the
wind, what is frozen or salt glints, what is loose blows, what is stone stands still.

## Decision

**One land layer for every kind of land** (`sprites/land/`), where the grass stood: under the scenery, in the
container the fog uncolours, at a level of its own in the Shaders section, worked out into a picture of its own at
low and laid over the screen, and saying once in the log what a level costs.

**A table says what moves on every kind of land**, its land motion, by the palette's names (`land/look.ts`): the
grass's sway on steppe, meadow, savanna and alpine meadow; the crops, the heath, the wet land, and the ice, the salt and
the sand, each to come in a step of its own and standing still until it does; and on purpose nothing of the land
layer's on the water, which the water shader moves, in the woods, whose life is their trees bending, or on bare
stone. A test fails when a kind of the palette has no row.

**The mask keeps a channel for each motion drawn** (`land/landMask.ts`): four bytes a world unit, one a motion, 255
where the land there has it, read with the texture's own blending and softened over a world unit or so by the shader,
as the grass's was. Each pixel works out only the motions of the land under it, each a part of the shader of its own -
the grass first, `land/grassShader.ts` - laid over one another where two meet. So a screen of rock costs almost
nothing and a screen of grass what the grass cost. Four channels are four motions; a fifth needs a texture of its
own. The mask's four channels are not a colour, so they are put on the graphics card without being multiplied by the
fourth, which would take the other three away wherever the fourth is nought.

**The Grass part becomes the Land part**, with a fold for each motion inside it, each with a box that draws it or
leaves its land as painted, and its sliders; the grass's ten and their remembered settings are kept as they were.

## Consequences

- The grass looks and costs as it did; the land is the grass's layer with room for the rest.
- A motion is a few functions of the shader and a row of the table, never a layer or a pass of its own.
- A kind of land that should move but is not drawn yet stands still, and the table says which step it waits for.
- The water stays a layer of the map's own (0081), and the trees bend in the scenery's own shader (the amendment to
  0052): the land layer is the ground between them.
