# 0019. Terrain is drawn from tiles, and only the ink is vector

- Status: accepted
- Date: 2026-09-03

## Context

Decision 0018 made the world an image, and the importer traced every terrain class in it into outlines
for the map to fill. That worked at thirteen classes: 7,529 shapes and six megabytes, which loaded in
about ten seconds as one file.

A second session then built a far better world from higher-fidelity data: thirty-two classes, cropland
that stops Europe being one colour, and every lake down to ten hectares. Tracing it measures as follows.

| World | Shapes | Points | One GeoJSON |
|---|---|---|---|
| Thirteen classes | 7,529 | 260,000 | 6.0 MB |
| Thirty-two, same thresholds | 117,649 | 2,566,261 | ~54 MB |
| Thirty-two, keeping sub-pixel features | 414,824 | 4,097,061 | ~86 MB |

Neither of the latter is servable as a file. Worse, the middle row discards most of what the new world is
for: the size threshold that keeps the file down throws away 80% of the lakes, and empties the rarest
classes entirely. Paddy fields produce zero shapes.

## Decision

Terrain is drawn from raster map tiles cut from the master, and only the lines a stylised map draws in ink
are vectors: the coastline, and the lakes large enough to have a shape rather than a position.

- `npm run world:tile` cuts the master into 5,461 tiles to zoom six, where a tile pixel is a master pixel.
  Beyond that the map stretches what is there.
- Away from that closest zoom, a tile pixel takes the class **most** of the master pixels under it have.
  Point sampling turns a coast speckled with lakes and fields into noise; averaging two terrains would
  invent a third.
- The colours terrain is drawn in live in `world/render.json` and are baked into the tiles. They are not
  the colours of the master, which are data chosen to be far apart so that a painted pixel can be read
  back. Two palettes, two jobs.
- The importer now traces only the coast and lakes above about 2,300 square kilometres.

## Consequences

The whole world is 12.8 megabytes on disk and 2.4 kilobytes a tile, so a screen costs tens of kilobytes
instead of megabytes, and the ten-second first load is gone. Outlines fall from six megabytes to under
two. Nothing in the master is thrown away any more: every lake is in the tiles whether or not it is large
enough to deserve a line.

It is also the form the painterly treatment wants. A terrain class per pixel is what texture, edge
treatment and paper grain work from; polygons render flat. The next step there is to serve class numbers
rather than colours and let a custom layer decide what a forest looks like, at which point re-cutting the
tiles is a thirty-second job.

The costs. Changing a colour means re-cutting the tiles rather than editing a style, which takes half a
minute. The tiles are derived and not committed, so a fresh clone runs the import and the tiler before
the map draws. And a raster shows its pixels: a coast is crisp because a traced line is drawn over the
top, but a lake shore below the size threshold is stepped.

## Alternatives considered

- Vector tiles for the terrain as well: crisp at every zoom, and it needs a tiling toolchain we do not
  have, for a hundred thousand shapes nobody inspects individually.
- Keep tracing and raise the thresholds until it fits: measured above, and it deletes the fidelity that
  the new world exists to provide.
- Trace nothing and draw the coast from the raster too: one less pipeline, and the coastline is the single
  most important line on the map and the one place pixels would show most.
