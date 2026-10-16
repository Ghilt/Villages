# 0098. The clouds are one sky, drawn over the haze and under the signs

- Status: accepted
- Date: 2026-10-16
- Plan: `docs/plans/clouds.md`

## Context

Adam, on 2026-10-15: *"I want a cloud shader when we are zoomed out. I want the clouds to leave shadows on the
map."* Around zoom 7 to 6 the camera should be in the clouds, with wisps at the screen's edges; from 6 to 4.5 the
clouds lie over the map and then fade away; they scale with the zoom, are consistent, and flow gently. His
reference was a photograph from orbit: puffy clumps in loose rows, each with a deep shadow beside it.

Asked, he settled the rest: painted like the map rather than like the photograph; nothing closer in than 7; the
clouds over the fog's haze, so there is weather over the unknown too, with every cloud's shadow on the haze as
well; clumps about a tenth of the screen wide at zoom 5.5, gathered in patches with clear sky between, drifting
slowly enough to be noticed rather than watched; and the marks kept clear of them.

Nothing in the page drew anything like it. The grass (`sprites/grass/GrassLayer.ts`) is the nearest thing: a
shader worked out a pixel at a time over the screen, in the sprite canvas, at a level.

## Decision

**The clouds are a layer of the sprite canvas, between the fog and the selection ring, worked out a pixel at a time
from noise laid along the wind and carried by the wall clock.**

- **Over the haze, under every sign.** The layer, `sprites/clouds/CloudLayer.ts`, stands in the sprite canvas's
  stack after the fog's mesh and before the ring and the marks drawn over the fog. Everything under the fog is
  under the clouds too; the ring, the marks and their crowds are over them. Each pixel's shadow and cloud are
  drawn together in one pass, so the shadow lies over the haze as well.
- **One sky.** Where the clouds are is a function of where on the world and the wall-clock time, and of nothing a
  browser has of its own, so two players looking at the same place at the same moment see the same clouds. The
  noise is laid out along the world's one wind, the water's, and repeats along it once every 32768 world units,
  the world's width, at every one of its sizes. How far the wind has carried it since 1970 is worked out on the
  processor in full precision and handed to the shader modulo that, so it comes round without a seam
  (`sprites/clouds/cloudClock.ts`). A shader's single-precision numbers could not hold the distance itself to
  within a cloud.
- **Bands by zoom.** Closer in than 7 nothing is drawn and no frame is asked for. From 6 out the clouds lie on the
  map, glued to the ground, whole down to 5.25 and fading to nothing by 4.5. Between 7 and 6 the camera is in
  them: the same field, drawn magnified about the screen's middle - one at 6, four at 7, eased so the swelling
  starts from nothing - so the clouds near the camera swell and slide out past the edges, with a ring opening out
  from the middle to keep it clear and the tones run together into mist; the shadows, which lie on the ground and
  are never magnified, fade as it comes down. The camera is orthographic, so the swelling is drawn by the shader
  rather than by any perspective. Every change is eased, so nothing pops at an edge
  (`sprites/clouds/cloudBands.ts`).
- **One sun.** The clouds are lit, and cast their shadows, by the map's one light, `map/light.ts`, which the relief
  reads too: a rim of the relief's cream on the side the sun strikes, a rim of its violet on the far side, and a
  shadow falling away from the light, in the same violet, read from the same field at the cloud standing towards the
  light from each pixel, so it keeps its cloud's shape.
- **A shader that is a look**, so it is drawn at a level, off, low or high, high at every load, as decision
  record 0081's amendment asks of every shader added later. High is every pixel at twenty frames a second, low a
  quarter of them at ten. It asks the sprite canvas for frames at its level's rate while some cloud is on the
  screen and for none otherwise, so the map is never redrawn for it. Still for anyone who has asked for less
  motion.

## Consequences

- The sprite canvas has a second clock beside the haze's. The two never run together at their own zooms, the
  haze moving only from 7 in and the clouds only from 7 out; when they do, the sooner wins, as every layer's
  wants do.
- A cloud is drawn over everything the fog covers, the scenery and the ground forms outside vision included,
  but those are not drawn from 7.5 out, where the clouds are.
- The sky is the same in every browser only as far as their clocks agree: two seconds apart is about seventeen
  pixels at 5.5. The welcome frame carries the server's time if that ever matters. A browser whose own sliders
  differ, or whose player asked for less motion, sees a sky of its own, knowingly. Because the clock's distance is
  the speed times the seconds since 1970, a new speed taken straight would throw the whole sky somewhere else; so a
  speed slider moved carries the sky on from where it stands (`respeed`), and the speed it started at gives the
  shared sky back.
- It measured 0.84 ms of the graphics card a frame at high on the first machine it ran on, 1.7% of its time.
- Every number of the look is in `sprites/clouds/look.ts`.

## Alternatives considered

- **A MapLibre custom layer, as the water and the relief are.** Simpler, but MapLibre's canvas lies under the
  sprite canvas, so the haze would cover the clouds, and Adam wants them over it.
- **Noise repeating across the whole world square.** The rows the clumps gather in run along the wind, and noise
  turned to the wind no longer repeats with the square; repeating along the wind alone is all the clock needs,
  because the clouds only ever move along it.
- **The page's own clock, as the water's and the grass's.** Each window would draw a sky of its own, and the
  clouds over a place would depend on when the page was opened.
