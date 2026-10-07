# 0016. Relief from height

- Status: open
- Started: 2026-10-07
- Closed:

## Hypothesis

Shading the ground by its slope, from a real height map, makes the world read as having a shape at every
zoom, the Alps as mountains rather than as a green the Po plain shares, without the paint starting to look
like a map out of a GIS, and at no cost in the frame anyone could measure.

Adam, on 2026-10-06: *"the world is very flat and 2d"*. The report on the stack that followed found that
nothing in it knows how high anything is, and put this first among the ways out of it: the cheapest, and the
only one that shows at zoom 7 and out, where the camera looks straight down and nothing raised could show.
He asked for it as a spike on 2026-10-07.

## Setup

As little as answers the question, and nothing of it is thrown away by what would follow.

- **Height for one region.** ETOPO 2022 from NOAA, 15 arc-seconds, about 460 metres at the equator, land and
  sea floor, public domain. Its four 15-degree tiles around the Alps, 0 to 30 east and 30 to 60 north: the
  Alps, the Apennines, the Carpathians, the Dinarides. 114 MB, fetched into `world/source/etopo/` by
  `world:fetch-all -- --only etopo`, which gained `--only` for it, and which `world:height` runs first.
- **Cut into height tiles** by a new tool, `world:height`: the four joined into one grid, a pyramid of
  halved grids so a tile far out reads the mean of the ground under it, Terrarium PNGs to zoom 8 beside the
  master's other tiles. The sea is held at nought, so the shading stops at the shore; the height eases away
  over the last degree inside the edge, so the edge of the region is not shaded as a cliff. The arithmetic is
  `packages/world/src/height.ts`, held by tests, the TIFF float predictor among them, proved by breaking it.
- **Drawn by MapLibre's own hillshade**, over the paint and under the water, lit from seventy degrees, the
  upper right the scenery's shadows are cut for. Not the paint's own: the painterly worker is not touched. The
  question is whether relief is the missing thing, and MapLibre answers that in a day; how relief should look
  in the medium is the next question, and only worth asking if this one says yes.
- **A lever**: the Relief part of the debug panel's Shaders section, off, low or high, and MapLibre's five
  ways of shading, `igor` first. High at every load in this branch.

Real Earth, not the master: the height is read on the grid the master began on, and nothing of what Adam
has painted since is looked at. Whether that shows is one of the observations.

## What we will look at

- Adam's eye, the lever pulled off and on, at three distances: the continent at zoom 4, the Alps at zoom 6,
  straight down, and the mountains close in at zoom 9.5, where the camera is tipped about 42 degrees.
- Whether the shading lies on the painted world: the master's lakes and rivers in its valleys, not across its
  ridges.
- The frame, with and without.

## Observations

**2026-10-07, the tool.** 960 tiles, 38.4 MB, in 7.5 seconds. The highest point it found is at 45.831 N
6.864 E, which is Mont Blanc's summit to within 300 metres; it reads 4,620 metres against the real 4,806,
because a 460-metre cell and a zoom-8 pixel both average a summit away.

**It lies on the painted world.** At zoom 6 straight down, Maggiore, Como and Garda sit at the mouths of
shaded valleys, Geneva and Constance on the flat beyond the hills, and the rivers run along valley floors;
the Po plain stays flat. Over the Alps at
least, the master is still close enough to Earth that real height lines up with it without the mapping
project.

**What it looks like**, the stills in `world/painterly/` (output, not committed):

- `relief-alps-z6.jpg`, off and on side by side. Off, the Alps are a band of darker green with patches of
  snow. On, every ridge and valley of them, and the plain reads as low ground beside them. The biggest change
  of the three.
- `relief-mont-blanc-z9.5.jpg`, close in and tipped. The massif's snow takes the shading best of anything; the
  rivers either side of it lie in their valleys. The shading is soft here, smoother than the paint under it,
  because a 460-metre sample is stretched over eight pixels: it reads as a relief model rather than as rock.
- `relief-europe-z4.jpg`, the region's whole width. The Alps, the Carpathian arc, the Dinarides and the
  Apennines all stand up; the edge of the region at 0 and 30 east does not show.

**What it costs: nothing that can be measured.** A redraw with the map still, over the Alps at zoom 6 and
Mont Blanc at 9.5, four rounds of off and on, 30 redraws each and the graphics card waited for: a median of
0.2 to 0.3 ms with the relief and the same without. Taken in a hidden pane, where the water was not moving,
so it says the hillshade costs too little to show rather than what a frame costs.

**2026-10-07, Adam's first look**, over the painted and the `plate` renderers at zoom 10:

- **A seam** where two height tiles meet, a light stripe a few pixels wide, plainer the stronger the relief. It
  is MapLibre's: it shades each height tile into a texture of its own the size of the tile and stretches that
  texture smoothly, clamped at the tile's edge. At zoom 10 a zoom-8 height tile is stretched eight times, so
  the half-texel either side of every edge, four pixels each, cannot blend across it. The tiles' borders were
  filled from their neighbours as they should be; the stripe is the stretch, not the data.
- **No scenery**, after `furnish it again`: the furnish had worked, but the scenery is grown only from the
  stands the game server sends (0067), and this tree's game server was not running. With it, the trees stand
  on the shaded ground.
- **Asked for a pixel relief to pair with `plate`.** MapLibre can draw its hillshade unblended, each height
  sample a hard block of shade, which is the `pixels` box: blocks half a master pixel across, eight screen
  pixels at zoom 10, and no seam, because nothing is blended across an edge. They are square on the map, not
  the turned diamonds `plate` draws its cells as; a relief on the diamonds themselves would have to be painted
  by the painterly worker, which reads the ground on that lattice already.

## Result

Pending Adam's eye.

## Decision

Pending. Kept, the next step is the height properly: from the mapping project, fitted to the master, a
decision record for height as world data, and then relief in the paint itself, where it can be stippled or
hatched rather than shaded. Killed, the tool, the tiles and the lever come out and the source list keeps or
loses its four tiles.

## Follow-ups

- **One light.** The water's sun is in the north-west and the shadows' light in the upper right; the relief
  takes the shadows' side. Moving the water's is one number in `water/look.ts`.
- **The softness close in.** A finer height model, or the paint's own marks over the shading, if the eye
  wants rock at zoom 10.
- **The rest of the world.** All 384 of ETOPO's 15-arc-second tiles, at the 23 to 36 MB these four were, come
  to around ten gigabytes; or its coarser 30-second version. And height fitted to wherever the master has moved
  the land.
