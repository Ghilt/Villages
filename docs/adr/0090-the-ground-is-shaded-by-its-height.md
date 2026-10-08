# 0090. The ground is shaded by its height, heavily far out and lightly close in

- Status: accepted
- Date: 2026-10-07
- Closes experiment 0017

## Context

Adam, on 2026-10-06: *"the world is very flat and 2d."* It was, for a reason that turned out to be the whole of
it: nothing in the world knew how high anything was. The master is a kind of ground a pixel and no height, so
every shade on the map came from the kind of ground and none from its shape, and the Alps were the same green
as the Po plain. The parallel camera gives up the cues that come from perspective on purpose (0060), and the
trees standing up with their shadows (0013) were the only depth there was.

Experiment 0017 put real height under the paint, first around the Alps and drawn by MapLibre's own hillshade,
then by a shader of our own beside it. MapLibre's showed a seam along a height tile's edge close in, where it
stretches each tile's shading by itself, and its pixels could only be square on the map; ours could do neither.
Adam looked, kept it out of the painter, where every change would repaint every tile, asked for its pixels on
the lattice, and then: heavy at zoom 5 and 6, light up close, for the whole world, and on main.

## Decision

**The ground is shaded by its slope, from ETOPO 2022's height, over the paint and under the water.**

- **The height is real Earth's, carried onto the master**: ETOPO 2022 at 60 arc-seconds, a height every 1.85 km
  at the equator, the whole world in one public-domain file of 444 MB, which `world:height` fetches into
  `world/source/` and reads through the master's origin map (experiment 0016): every point of the master is
  given the height of the place on Earth it was cut from, so a range Adam moved takes its height with it
  (`src/heightFitted.ts`). Land the origin map finds nowhere on Earth, invented, is filled from the land around
  it, smoother than Earth's but with no cliff where it meets it. Cut into Terrarium tiles to zoom 7 beside the
  master's other tiles, the sea held at nought and the antimeridian read round. So the height is the master's,
  and stale whenever its origin map is: cutting a master in the Debug map fits it again after the origin, and
  the quick start does whenever `origin.json` is newer than `height.json`.
- **It is drawn by a shader of ours**, a MapLibre custom layer as the water is, `map/reliefLayer.ts`: the shade
  worked out for every pixel from a tile's heights with a margin of its neighbours', so there is no seam; with
  pixels, for the middle of the lattice cell a pixel lies in, by the arithmetic the painter draws the ground's
  cells with, so on `plate` the shade comes in the ground's own cells, in a few hard tones if asked.
- **How strongly follows the zoom**: strongest out to zoom 6, easing to light by zoom 9 and in, where the scenery
  and the paint carry the ground and the relief only gives it some variety. Four sliders in the Relief part of the
  Shaders section move the curve, remembered in the browser that moved them and said in the log, as the rivers'
  are; the numbers Adam settles on become `RELIEF_DEFAULTS` by a commit. The first were made lighter the same
  evening, *"something not so taxing"*: three quarters of the shade far out, 15% close in, the ground shaded as
  a fifth less steep.
- **The light is the scenery's**: from the upper right, seventy degrees round from north, as every sprite's
  shadow is cut for (`LOOK-AND-FEEL.md`).
- **MapLibre's hillshade stays beside it**, a choice in the Relief part, to compare against. It takes the same
  curve as expressions of the zoom.

## Consequences

- **What it costs is about a third of a millisecond a frame**: a redraw at 1568 by 1080 took 0.8 to 1 ms with the
  relief and 0.6 without it, standing or dragged. That is after its loading was rebuilt the same day, when Adam
  found it could not keep up with a drag: the first one asked for every tile the view had ever wanted at once,
  drew none until its eight neighbours were in, kept 48 textures where a screen at zoom 5.5 needs 63, so rebuilt
  the rest every frame, and held every height it had read. Now `map/reliefQueue.ts` asks for a view's tiles four
  at a time, a coarse cover first, then from the middle out, and cancels what the view has moved on from; a tile
  is drawn as soon as it is here, its missing neighbours' edge carried on from its own ground until they land
  (`map/reliefMargin.ts`); and a coarser tile that is here stands in for one still on its way, or the finer
  ones just after zooming out, so it never goes blank. Textures are kept for what is drawn and 64 more, at most
  ten made a frame, and heights for 384 tiles, in whole metres. Where the curve is at nought nothing is fetched
  or drawn. A drag across a continent now keeps every tile drawn and the last one lands as it stops.
- **The dev server was slower than all of it**: it sent every file 70 ms late while it watched the fifty thousand
  of the world. It no longer watches them; see the amendment of 2026-10-07 to decision record 0025.
- **A fresh tree fetches 444 MB once**, and cuts 21,845 tiles, 203 MB as WebP without loss, in two minutes, the
  origin map read and the invented land filled included. The quick start does both when the height is missing
  or the origin map is newer, and the tiles are output, not committed, like every other cut of the world.
- **Invented land is shaded smooth.** It has no height of its own, so its fill is eased from the land around
  it, four cells to a square of the origin map; where it meets Earth's land the detail stops along the origin
  map's squares, at the default strength a smooth plateau beside a textured one, not a line.
- **The relief and the water share their WebGL**, `shaders/webgl.ts`, rather than each writing it.
- **The water's sun still stands in the north-west.** One light for the map is one number in `water/look.ts`,
  and Adam's call.
- **Close in the shade is soft**, a 60 arc-second height stretched over many pixels, which is what light shading
  close in wants. A finer model is a download away if the eye ever asks for rock.

## Alternatives considered

- **Real Earth's height as it is**, which is what it first was, reading nothing of the master. Wherever Adam
  had moved the land the shading lay where the land had been: southern Norway's mountains over the Skagerrak.
  Adam, the same day: *"the relief is not fitted to my transformed earth map"*.

- **Relief painted by the painterly worker**, in the paint itself and in the stills: the one way to put it on the
  ground's own cells besides a shader, and every change of it a repaint of every tile, about half a second a
  screen. Not wanted for a look still being tuned.
- **MapLibre's hillshade alone**: a day to try and nothing to write, which is why the experiment began there. A
  seam close in, square pixels, five ways of shading where one is wanted.
- **Raised ground, MapLibre's 3D terrain**: real silhouettes, but only from about zoom 9, where the relief is
  meant to be lightest, and every sprite, the fog and the water would come off their ground. The report of
  2026-10-06 weighed it last.
- **ETOPO at 15 or 30 arc-seconds**: sharper close in, where the relief is lightest, at about ten gigabytes or
  1.5 GB and a tool that reads in strips. 60 is about a sample a screen pixel at zoom 5 and 6, where it is heaviest.
