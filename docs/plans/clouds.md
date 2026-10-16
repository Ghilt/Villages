# Clouds

**What belongs here:** how the clouds get built - the bands they are drawn in by zoom, the field they are cut
from, their look, their shadows, the clearings round the marks, the Clouds part of the debug panel, the rules
that must hold, and the order it all gets built in. **What does not:** why it is drawn where it is and how one
sky is shared, which is decision record 0098; what the clouds look like, in plain words, which is
`LOOK-AND-FEEL.md`; the words, which are `GLOSSARY.md`; the levers as they are in the running program, which are
`RUNNING.md`. When a part of it is decided, that part becomes a decision record and leaves.

Planned on 2026-10-16 from Adam's description, his reference photo and his answers, recorded in the sections
they settled.

---

## The problem, in one paragraph

Pulled back, the world is a painted map with nothing over it: no weather, no sky, nothing moving between zoom 7
and the whole world. Adam wants clouds there: painted clumps drifting over the map with their shadows on the
ground, a band where the camera is *in* the clouds with wisps at the screen's edges, and the clouds fading away
further out so the whole world reads clearly. His photo shows puffy clumps gathered in loose rows, with deep
shadows offset to one side. Nothing in the page draws anything like it; the grass and the fog's haze are its
nearest relatives, and it is built the way the grass is.

## What Adam settled

| Question | Answer |
|---|---|
| The look | Painted, like the map: a few flat tones, brushed softer edges, not photo-real |
| The wisps between 7 and 6 | The real clouds, close: the same clouds seen near the camera, swelling and sliding out past the edges as you zoom in, the middle of the screen kept clear |
| Closer than 7 | Nothing: no clouds, no shadows |
| What stays on top | The clouds avoid the marks where they can; the names and your own marks are on top |
| Over unexplored land | Over the fog's haze |
| Size and spread | Clumps in patches: a clump about a tenth of the screen wide at zoom 5.5, gathered in loose patches and rows, wide clear stretches between |
| Shadow colour | The hills' dusky violet, the relief's shade colour |
| Shadows over the haze | Yes: every cloud has its shadow wherever it is |
| Pace | Noticed, not watched: a clump takes about three minutes to cross the screen at 5.5 |
| Avoiding a mark | Thin and part: the clouds thin away from their own ragged edges round a mark and close again behind |

## The bands, by camera zoom

Every edge is a slider in the Clouds part.

| Zoom | Band | What is drawn |
|---|---|---|
| closer than 7 | under the clouds | nothing, and no frames asked |
| 7 to 6 | **in the clouds** | the same field magnified about the screen's middle, 1 at 6 and about 4 at 7, so it swells and slides outward as you come in; the middle kept clear by a ring that opens to the whole screen at 6; softer, mistier tones; the shadows fading out towards 7 |
| 6 to 5.25 | **over the clouds** | the clouds lie on the map, glued to the ground: magnification exactly 1, so they scale with the zoom and stay over the same land |
| 5.25 to 4.5 | fading | clouds and shadows fade together to nothing |
| past 4.5 | none | the whole world reads clearly |

The page opens at zoom 4 and flies to 8.5 when the house arrives, so every load comes down through the clouds.

## The field

- A pure function of where on the world and the wall-clock time, so every browser draws the same sky.
- Laid out along the world's one wind, the water's (`WATER_LOOK.realistic.waves.wind`), and repeating along it
  once every 32768 world units at every octave: the distance the wind has carried each octave is worked out on
  the processor in full precision and handed over modulo 32768, so it comes round without a seam.
- A slow patch pattern stretched along the wind for the patches, rows and clear stretches; clumps of rounded
  lobes inside them; finer octaves faded in and out by their size on the screen. The finer detail drifts a
  little faster than the larger shapes, so the clumps change shape as they go.
- About 12 world units a second, about 9 pixels a second at 5.5.

## The look

Three flat tones lit from the relief's light (`LIGHT`, 70 degrees round from north): its warm cream where the
sun strikes, white, a soft violet-grey on the far side, with band edges at least a pixel soft. Brushed edges, no
outline. The shadow is the same field sampled at the ground less the shadow's offset, away from the light, in the
relief's dusky violet. Nothing outside the world's square.

## Where it is drawn

A layer of the sprite canvas, `sprites/clouds/CloudLayer.ts`, between the fog and the selection ring, worked out
into a picture at its level's share of the screen and laid over the view, as the grass is. One pass draws each
pixel's shadow and cloud together. It asks the sprite canvas for frames at its level's rate while a cloud is on
the screen and for none otherwise.

## The clearings

The marks layer draws first and says where it drew its icons. The cloud layer takes up to 32 of them, the nearest
the middle when there are more, and near each raises the threshold the clouds are cut at, so they thin from their
own edges; the shadows keep off the mark the same way.

## The Clouds part

In the Shaders section, as decision record 0081's amendment asks of every shader added later: off, low and high in
its bar, high at every load; sliders remembered in the browser that moved them and said once in the log as
`tuned: …`, with reset: cover, size, speed, change, patches, edge, shadow, reach, clearing, and the four zoom
edges. Its reading says the band at the camera's zoom and how much is drawn.

## The rules that must hold

| Rule | What holds it | When |
|---|---|---|
| One sky: the same clouds over a place at a moment in every browser | the field is a function of world position and wall-clock time only; the clock's offsets are tested to be the same for the same time and to come round without a jump. Knowingly broken by a browser's own sliders, by a player who asked for less motion (a still sky), and by clock skew of seconds (under a pixel) | every frame |
| The clouds stay over the land they float over | over the clouds the field is sampled at the ground under each pixel, magnification exactly 1, tested in the band maths | every frame |
| One sun | the lit side and the shadows' direction come from the relief's `LIGHT`, imported | at build |
| Nothing closer than 7 or past 4.5, and no pops between | the band amounts are nought there and continuous in zoom everywhere, tested by sampling; at nought nothing is drawn and no frame asked | every frame |
| Never over a mark | the marks are drawn over the clouds; the clearings come from where this frame's icons were drawn | every frame |
| A screen with no clouds costs nothing | no frames are asked while nothing is drawn | every frame |

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **Clouds over the map.** Room in the sprite renderer first, in a commit of its own; then the layer over the fog, soft white clumps in patches drifting by the wall clock, over the clouds from 6 out and fading by 4.5; the bands and the clock with their tests; the cost said in the log; decision record 0098, ARCHITECTURE, LOOK-AND-FEEL, GLOSSARY, ROADMAP, the architecture page's card | 👀 Where the page opens, at zoom 5.5: soft white clumps drift slowly with the wind, and stay over the same land as you pan and zoom between 6 and 5. 👀 Zooming out they fade from about 5.25 and are gone by 4.5; they lie over the haze and under your marks. |
| 2 | **The Clouds part of the Shaders section.** Off, low, high; cover, size, speed and the zoom edges as sliders, remembered, with the `tuned:` line and reset; the reading; RUNNING | 👀 Shaders → Clouds: off, low and high do what they say, and the log says what each costs. 👀 Cover, size and speed: pick the numbers. |
| 3 | **Painted.** Three tones lit from the upper right; brushed edges; clumps of lobes in patches and rows along the wind, slowly changing shape; change, patches and edge sliders; LOOK-AND-FEEL | 👀 At 5.5: cream where the sun strikes, violet-grey on the far side, brushed edges, in loose rows like the photo. 👀 Watch a minute at 4.7, 5.5 and 6: they slide and slowly change shape, and their edges never flicker or crawl. |
| 4 | **Shadows.** The violet shadows down and to the left, over the haze too; shadow and reach sliders; LOOK-AND-FEEL, RUNNING, decision record 0098 | 👀 Every cloud has its shadow down and to the left, the way the hills' shading falls, in their violet, over the haze as well. 👀 Shadow and reach: pick the numbers. |
| 5 | **In the clouds.** The band from 7 to 6: the same clouds magnified about the middle, the middle kept clear, softer wisps, the shadows fading out by 7; GLOSSARY, LOOK-AND-FEEL, RUNNING | 👀 Zooming slowly in from 5.5 to 7.5: from 6 the clouds swell and slide out past the edges, the middle stays clear, nothing is left by 7; and back out again. 👀 A reload: the flight to your seat comes down through the clouds. |
| 6 | **Clearings round your marks.** The marks layer says where it drew its icons; the clouds and their shadows thin round each; clearing slider; GLOSSARY, LOOK-AND-FEEL, RUNNING, decision record 0098 | 👀 At 5.5 round your seat and people: a clear patch with the clouds' own ragged edges, no shadow on a mark, closing again behind as the clouds drift past. 👀 Clearing: pick the size. |

The order is a suggestion, as every order here is.

## Not in this plan

Weather that differs by region or season, or rain; clouds closer in than 7; a player's own switch for the clouds;
one light for the water and the relief, which is open and Adam's; clouds in the painted stills.
