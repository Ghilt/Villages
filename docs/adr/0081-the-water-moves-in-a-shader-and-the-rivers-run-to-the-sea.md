# 0081. The water moves in a shader, and the rivers run to the sea

- Status: accepted
- Date: 2026-10-03

## Context

The painted map's water was as still as its land: the sea, the lakes and the rivers were a colour of the tiles
and nothing more. Adam asked, for fun, whether the water could move - little ripples first, then something nearer
to real water, with caustics - and then for the rivers to flow, towards the sea. It began as a spike on a branch
of its own and he asked for it on main on 2026-10-03.

Two things about the world shaped it. Where the water is, and how far from a shore, is in the cut tiles already,
a class a pixel; there is no outline to follow and no art to animate. And the master's rivers are painted as a
class two pixels wide, with breaks in them a pixel or a few long and heads that touch across a watershed, so
which way a river runs cannot be read off any one pixel of it: it is a fact about the whole network.

## Decision

**The water is a MapLibre custom layer**, `apps/web/src/water/WaterLayer.ts`, drawn in WebGL2 over the painted
terrain and under the ink lines, and so under the fog and the sprites, which are in a canvas above the map. It is
worked out in fragment shaders from the ground's own coordinates, so it pans with the map, is the same at every
zoom, and needs no art. It fades in about zoom 8.5 and redraws at thirty frames a second only while some of it is
on the screen.

**Where the water is comes from the flat tiles**, as a mask a tile worked out in the browser (`waterMask.ts`):
how far each texel lies from the shore and from the deep ocean, by the fog's distance transform, with a margin of
the neighbouring tiles so that two tiles agree where they meet; and whether it is a lake or a river. A tile
borrows the part of an ancestor's mask that covers it while its own is on its way.

**Which way the rivers run is worked out offline from the master**, by `npm run world:flow`
(`packages/world/src/flow.ts`): every river and lake pixel is given its shortest way to the sea along the water,
walking inland from the coast. A river end may jump a gap of up to six pixels, at a price of fifty pixels of
river a pixel of gap and three times that onto the middle of another river, so that a short break is jumped and
a touch into the next basin is not. What is still unreached runs into a lake of fifty pixels or more with no way
out, as an inland sea, and what is left is **stranded**: it has no way to any sea or lake and stands still.
Lengths are measured on the map, where a master pixel is taller than it is wide away from the equator.

What it found is written as tiles at zoom 7 beside the cut tiles, `masters/<name>/flow/`, deciding what is river
exactly as the tiler does, so a flow texel lies under every river texel the terrain draws: which way each runs and
how big a river it is, and beside each, how far down its river each pixel is, the coordinate a river's own look
is laid along.

**A river has a look of its own.** Crests lie across the current and travel downstream along that coordinate,
round every bend, all at one speed so the pattern never shears; specks of light are carried on the current by two
copies of the pattern sliding a cycle apart; and a river keeps only some of the sea's waves and caustics and none
of its surf. Every number of the water's look is in `water/look.ts`. The rivers' are on sliders in the debug
panel's **Water** section, remembered in the browser that moved them and said in the log when one stops; their
defaults are the values Adam chose on 2026-10-03.

The **Flow** renderer draws the flow tiles instead of the water: a colour for each way a river runs, arrows
marching downstream close in, and black where a river is stranded.

## Consequences

- A master with no flow tiles has still rivers, and the log says so with the command that makes them. `cut it`
  in the Debug map section makes them with the rest of a world, and the quick-start makes the default master's
  when they are missing. A repaint makes them stale with the tiles, which is why the cut makes both.
- A break in a river longer than six pixels strands what is above it, and its water stands still. That is a
  fault in the master to mend rather than a rule to loosen: the Flow renderer shows every one in black, and the
  tool prints the longest with where they are.
- The water costs a few texture uploads as tiles come into view and one draw a tile while it is on the screen.
  It keeps the map redrawing while it is in view, which nothing else did when the camera was still.
- The stills and the offline renderers do not draw it: it is in the browser only, and the running map is the
  only picture of it.
- The rivers' sliders are a way of looking, kept per browser and never sent, like the fog switch. A number Adam
  settles on goes into `RIVER_DEFAULTS` by a commit, as these did.

## Alternatives considered

- **Water in the sprite canvas, beside the fog.** It would have had to be laid under the ink and the marks by
  hand; as a map layer it sits where it belongs in the map's own order and is drawn with the map's own matrix.
- **Water painted into the tiles, or animated tiles.** Frames of a whole world of tiles, and a pattern that
  would swim when the zoom changed; worked out from the ground's coordinates it costs nothing to store.
- **Flow worked out in the browser.** It is a fact about the whole network, so a page would need the whole
  master, half a billion pixels, before any river moved.
- **Flow from a real river dataset.** It would not follow what Adam painted, and the master is the world.
- **Flow downhill.** The master has no height, only classes; the sea is the one thing every river is known to
  be going towards.

## Amendment, 2026-10-03: a part of the Shaders section, at a level

Adam asked for one place for the shaders that are a look and nothing more, and for a cheaper water. The water's
switch in the Debug map section and its own Water section became the **Water** part of a **Shaders** section:
`off`, `low` or `high` in the part's bar, a choice of look, realistic or the wavelets, and the rivers' sliders as
they were; the section's own bar has an `on` box that turns every shader off and back on at its level. High is
the water as it was, every pixel at thirty frames a second. Low is a quarter of the pixels, the water drawn into
a picture of its own half the map's width and height and laid over the map, at fifteen frames a second; measured
on Adam's machine it costs between a fifth and a third of what high does a second. The first time it is drawn at
a level the log says once what that costs the graphics card, timed there. A shader added later gets a part of its
own, with the same three levels.

## Amendment, 2026-10-20: linked ahead

A browser that had compiled nothing waited 0.7 s on the driver linking the realistic water's program as the map
started, under the loading screen, though the water is drawn only from zoom 8.5 in (experiment 0026). So its three
programs, the realistic water, the wavelets and the flow view, are handed to the driver as the layer is added and
asked after through `KHR_parallel_shader_compile` (`linkProgramAhead`, `shaders/webgl.ts`), and the water is drawn
once its program is linked, the sea as painted until then: within a second or so, before the screen lifts. A browser
without the extension links them at once, and waits, as before. The low level's picture keeps linking at once: its
program is too small to wait on.
