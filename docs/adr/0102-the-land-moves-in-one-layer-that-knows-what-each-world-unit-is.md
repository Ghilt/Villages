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

## Amendment, 2026-10-17: a look a world unit

A motion can be drawn on more than one kind of land, each in its own look: the heath's on heath, scrub and tundra, in
clumps of their own sizes and colours. So beside the mask's four channels the layer keeps a byte a world unit saying
which of its motion's looks the land there has, by the kind's place among the looks its motion names in `land/look.ts`,
and reads it as it is, never blended, so a clump on the edge between heath and scrub is one or the other and never
something between. The channels say how strongly a motion is there and are softened; the look says only which, at the
place a clump or a stalk is rooted.

## Amendment, 2026-10-18: the fifth motion has a texture of its own

The ice, the salt and the sand are the fifth motion and the last, so with them every kind of land has its motion or
stands still on purpose, which the land's table test now holds. Their channel is a texture of a byte a world unit
beside the mask's four, softened as the others are. Every one of the shader's textures is given a placeholder of
its own until the first mask comes: two samplers handed the same placeholder were bound to only one of them, and the
fifth motion read nothing until it had its own.

## Amendment, 2026-10-19: the grass under the woods

The woods were the one kind of land the layer left alone on purpose, their life their trees bending, and Adam found
their ground too bare: the steppe's tufts would look good there too. So the seven forests' motion is the grass, and
under their trees it is their undergrowth, a blend between the grassland's grass and the undergrowth's own numbers
(`look.ts`, `grass.undergrowth`) by how much of it each kind is (`grass.woods`): fewer tufts, shaded, hardly any tall
grass, more low brush, and less of a gust. The mangrove and the swamp forest keep the wet land's motion.

A tuft first read its kind's numbers by its look, from arrays of them a look long, and the grass cost ten times as
much on the renders page where the browser draws through Direct3D, 7 ms of the graphics card a frame against 0.75:
an array picked from by a number the mask gives, in the loop over the tufts, is a slow path there. A strip of texels
of each kind's numbers, read a texel a tuft, still tripled a screen of meadow. So the kind is in the byte the mask
already writes, and that every tuft already reads: the grass under the woods is written a step or a few below full in
its channel, as many of twelve as it is woods (`strengthOf`), never below 242 of 255, so it is as whole in the mask's
softened edges as the grassland's, and a tuft reads the world unit it is rooted in unblended (`rootedExactly`) and
blends its numbers by it. A screen of meadow costs what it did, and a screen of taiga what a meadow does, 3.3 ms at
the high level where it cost nothing before.

## Amendment, 2026-10-19: the animal trails

Adam asked for the odd little trail through the tuft-heavy land, only an absence of tufts, as an animal keeps a path
open. The grass, the woods' undergrowth with it, and the heath leave out a tuft or a clump rooted on one
(`trailShader.ts`): where a slow field over the ground, two octaves of noise, crosses its middle, a line a tuft or so
wide that winds, meets and loops, in patches a slower field opens here and there, narrowing to nothing where its patch
closes. Each motion has its own slider for how many, none at nought. A pixel reads the field and how fast it changes
once about the tufts it looks at, so a tuft far from the line knows it is not on one from that alone, and only a tuft
near the line reads the field at its own root; the field is a function of the ground, so a trail is the same in every
pixel and every browser. Where a trail patch fills the screen it costs 0.8 ms of the graphics card a frame at the high
level, 4.65 against 3.85 with none; elsewhere a read of the slower field a pixel.

## Amendment, 2026-10-20: a program for each motion

The first time a page needed the land, the camera inside zoom 8.5, it waited 22 to 31 s on the graphics driver
compiling the land's one program (experiment 0024): Direct3D's compiler takes far longer over one large program than
over its parts, 25 s for the land's against 7.5 s for its five motions as programs of their own, which compile side by
side in 6 (experiment 0025). Adam's word: do it as recommended, for a player opening the page while a server runs.

So the land is still one layer reading one mask, and each motion is a pass of its own: a program of the parts it needs
(`landShader.ts`), drawn only while its land is under the view, working out its motion only where its land is and laid
over the passes before it in the mask's order, premultiplied, which is what the one program did inside itself. A screen
of one kind of land draws one pass; where two meet, two. And a frame costs less, not more: the one program cost every pixel a share of
every motion's code, and a pass only its own, so the land's part of a frame at high fell from 3.5 to 1.3 ms at the
tundra, 4.1 to 1.5 at the grassland, 2.6 to 0.6 at the ice and 3.4 to 2.1 at the bog. The picture is the one program's but for a pixel here and
there at a tuft's edge, which the compiler rounds differently (89 of 5.1 million on the renders page, by 22 of 255 at
the most). This takes back the consequence that a motion is never a pass of its own: it is not a layer of its own,
and its land is still known from the one mask. The crops' fields are a part of their own (`fieldsShader.ts`), since
the paddy's terraces are cut by them too.

## Amendment, 2026-10-20: compiled ahead, once the game has started

Even as a program for each motion, the first time a page needed a motion it waited on the driver for it, Pixi asking at
once whether a program had linked: over the forest 1.5 s, at the first sand 5. So each motion's program is handed to
the driver ahead of its first use (`shaders/compileAhead.ts`), from Pixi's own sources, and asked after through
`KHR_parallel_shader_compile`, which answers without waiting; Chrome keeps what it linked, so Pixi's own link of the
same sources later finds it there in milliseconds. A motion is drawn only once its program is compiled, its land
standing as painted until then. It is handed over once the loading screen has lifted, which the app tells the sprite
canvas (`afterStart`), or the first time the land is wanted if that is sooner: handed over under the loading screen,
the five competed with the start's own programs for the browser's compile threads, and a first load read 0.6 s
longer. A browser without the extension draws the land as before, and waits as before. The first close zoom of a
fresh browser waits 0.1 s, against 22 to 40 (experiment 0025).
