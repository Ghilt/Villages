# 0022. The painterly renderer paints tiles in the browser, not in a shader

- Status: accepted
- Date: 2026-09-04
- Supersedes the delivery half of 0021, and keeps all of its design

## Context

Decision 0021 settled the look offline and said the delivery would be a GLSL fragment shader in a MapLibre
custom layer. That is still the fastest way to draw it, but it means two implementations of the same look,
in two languages, that have to be kept in step by eye, plus tile management and a camera matrix of our own.

Then the look needed to be seen in the page, with a picker, and the shape of the problem changed. MapLibre
lets a URL scheme be answered by our own code, so a tile request can be served by painting rather than by
fetching. Everything MapLibre already does well stays MapLibre's job: which tiles are visible, when to
load them, caching, and drawing them under the camera.

## Decision

A painted tile is produced in the browser by the same `paintPixel` the offline renderer uses.

- `painterly://<style>/{z}/{x}/{y}` is a raster source. The handler reads the terrain, paints 256 by 256,
  and hands back an `ImageBitmap`.
- **It is painted in a worker, and there are several.** A pixel costs about forty noise evaluations and a
  tile has sixty-five thousand pixels, so a tile is around thirty milliseconds of arithmetic that cannot
  be interrupted. On the main thread that is a dropped frame per tile and a map that stutters whenever it
  moves. A tile goes to whichever painter has least in hand, and the pool is half the cores up to four.
- **The terrain comes from the flat tiles that are already served.** They are indexed PNGs of thirty-two
  colours we chose, they carry no colour profile, and a canvas hands their bytes back unchanged, so the
  colour is the class. No second tile set. An unrecognised colour falls back to the nearest and says so
  once, rather than painting the wrong terrain in silence.
- **The eight neighbouring tiles are read too.** The paint looks a little past the edge of what it is
  drawing, and without the neighbours every tile border would be a broken wet edge.
- **The source's maximum zoom is the map's, not the flat tiles'.** Past zoom seven the ancestor tile is
  read and one of its pixels covers several of the painted tile's, which is exactly the blockiness the
  boundary wander exists to dissolve. This is the point of the whole arrangement: a tile knows its own
  zoom, so `masterPerPixel` comes from the view and every mark is the size of a mark at that zoom.
- **The tiles around the view are painted during the pauses.** What MapLibre asked for is recorded, and
  after a fifth of a second of stillness the ring two tiles deep around it is painted, along with the
  four tiles inside each and the two containing it, so that panning and zooming find them done. A tile
  painted ahead only ever goes to a painter with nothing in hand, so a tile the map is actually waiting
  for never queues behind one nobody asked for.
- **The flat tiles are hidden underneath, not left showing through.** This is the least obvious decision
  here and the one that matters most to how it feels. See below.
- The styles are data, fetched at runtime from `paint.json`, which the paint script writes. Changing a
  colour or a style needs no tiles recut.

## Consequences

**Nothing about the look is precomputed except the terrain.** Zooming re-paints, and the treatment holds
its scale from zoom 0 to zoom 10. That is the property baking cannot have at any price.

One implementation of the look, so the offline stills are an honest preview of the map rather than a
separate thing that resembles it. A style is judged in stills, at any size, and then appears in the map
without a translation step.

The cost is throughput rather than latency, and that is the whole difference. Measured on a 558 by 599
canvas: a smooth zoom from 5 to 10 over three seconds, and a two-screen pan over three seconds, both hold
a median frame gap of 17 milliseconds and a 95th percentile of 18, which is 60 frames a second with one
hiccup. A screenful of new tiles finishes arriving in about 300 milliseconds, during which the map is
fully interactive and the flat tiles show underneath, so the world is never blank, only plainer for a
moment.

Two things that were expected to matter did not, and both were measured rather than reasoned about. Six
painters performed the same as four on a twenty-core machine, so the pool is four. Routing tiles to the
painter that already held their terrain performed the same as routing to the least busy one, so it routes
to the least busy one, which cannot collapse onto a single painter the way affinity does past zoom seven
when every tile on the screen shares an ancestor. Whatever the 300 milliseconds is, it is not paint
throughput, and since it blocks nothing it has not been chased further.

What did pay: reading the terrain from one flat array indexed by arithmetic rather than a map of tiles
keyed by a string, worth 1.7 times, because a pixel takes nine samples and a string key there is half a
million allocations a tile. And one colour allocation a pixel instead of three, worth a further tenth.

### Why the flat tiles are hidden rather than left underneath

Leaving them visible is the obvious kindness: a tile still being painted then shows terrain rather than
nothing. It is worse to look at, and the reason is worth writing down. It means land you are already
looking at changes its colour and its texture a fraction of a second later, and the eye is drawn to a
thing that changes far harder than to a thing that merely arrives. Hidden, MapLibre falls back the way
it does for any raster source, by stretching the painted tile from a zoom further out, so the usual
worst case is a moment of soft paint instead of a moment of the wrong paint.

The cost is that a jump into somewhere with nothing painted shows a hole. Measured, that is 330
milliseconds, and the flat tiles do the same thing in the same time, so it is not a cost the paint
introduced. What the paint introduced was the second transition, and that is what this removes.

With the looking-ahead, 75% of the tiles a fast continuous drag asks for are already painted, and 100%
of the tiles a whole-screen jump asks for after a pause. `window.villagesPainterly` counts it in a dev
build, because ready is the number that decides how this feels and it is not visible in a profile.

One thing to watch: with the flat tiles hidden, a painterly renderer that fails entirely leaves an empty
sea rather than a plain map. The error is logged; there is no visible fallback.

## Alternatives considered

- **A GLSL custom layer, as 0021 said.** Still the fastest, and worth returning to if the cost above
  becomes the thing that hurts. It buys speed with a second implementation of the look and with tile
  management we would own. Not the first thing to spend on.
- **Bake painterly tiles at every zoom.** Measured at about 1.4 bytes a pixel, which is two gigabytes for
  zoom 0 to 7 alone, and it still could not put a mark at screen scale past the deepest baked zoom.
- **Cut a second tile set carrying class numbers.** The robust answer, and unnecessary: all thirty-two
  render colours are distinct and every tile colour matched exactly when tried. It stays available if a
  browser is ever found that alters the bytes.
- **Paint on the main thread.** What this first did, and it was unusable: the look was right and the map
  stuttered on every movement. Worth recording because the fix was not to make the paint cheaper, which
  would have meant a worse look, but to move it. The paint is only about a tenth faster than it was.
- **Paint at half resolution and let the tiles be stretched.** Four times less work for a softer picture.
  Available if a slower machine needs it, and not needed here.
