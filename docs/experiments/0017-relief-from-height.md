# 0017. Relief from height

- Status: closed
- Started: 2026-10-07
- Closed: 2026-10-07

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

**2026-10-07, a shader of our own beside MapLibre's.** Adam kept the relief out of the painter, which would
have meant a repaint of every tile at every change, and asked for its pixels on the lattice instead. MapLibre's
hillshade cannot do that: it shades a tile into square texels on the map's own grid, and has no setting to
read them on a turned one. So the relief is now also drawn by a custom layer of ours, as the water is, kept
beside MapLibre's to compare:

- **It works the shade out for every screen pixel**, from a texture of the tile's heights with four texels of
  each neighbour's round its edge, so the slope at an edge reads both sides of it and two tiles agree: no seam.
- **With pixels, it shades a cell at a time**: it finds the middle of the lattice cell a pixel lies in, by
  the same arithmetic `onLattice` paints the ground's cells with, and shades the whole cell from the slope
  there. The painter puts a pixel at its Mercator place times the master's width, as the shader does, so the
  cells are the ground's cells, not near them.
- **Its levers are uniforms**, read every frame: the tones, a few hard steps each side of flat, and how steep
  the ground is shaded as. Nothing repaints.

The first numbers drew every alpine slope in its darkest tone; a slope of thirty degrees from the light now
comes out about three quarters of the way to it. Over `plate` at zoom 10, three tones, the shade comes in the
ground's own cells: olive where meadow turns from the light, grey cells on the snow. The still is
`world/painterly/relief-plate-pixels-z10.png`, plate alone and with it.

## Result

**Confirmed.** Adam, on the shading over `plate`: *"i think its looks good z5 to z6 with heavy relief, but then up
close i think i want low, just light shading to give some variety"*, and then to take it to main, for the whole
world. What surprised us: that the height lay on the painted world without the mapping project, and that the
relief wanted to be strongest far out, where nothing raised could ever show, and lightest close in, where the
first report had expected it to matter most.

## Decision

**Keep**, as decision record 0090: ETOPO 2022's whole world at 60 arc-seconds, drawn by our own shader, with
MapLibre's hillshade beside it to compare, and how strongly by zoom on four sliders, heavy out to zoom 6 and
light from zoom 9 in. The relief and the water share their WebGL in `shaders/webgl.ts`. The four 15-second
tiles around the Alps are no longer read.

## Follow-ups

- **One light.** The water's sun is in the north-west and the shadows' light in the upper right; the relief
  takes the shadows' side. Moving the water's is one number in `water/look.ts`.
- **The softness close in.** A finer height model, or the paint's own marks over the shading, if the eye
  wants rock at zoom 10.
- **Height fitted to the master**, wherever Adam has moved the land: done the same day, through the origin map
  (experiment 0016); see decision record 0090.
