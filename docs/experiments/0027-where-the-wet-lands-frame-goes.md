# 0027. Where the wet land's frame goes

- Status: open
- Started: 2026-10-21

## Hypothesis

**The bog's frame, the dearest of the places `perf:shaders` measures since the land became a program for each motion
(experiment 0025), is mostly one part of the wet land's program, and that part can be made cheaper without changing
a pixel.** It is wrong if the cost is spread evenly over the wet land's parts, or if what makes it cheaper changes
the picture.

## Setup

`npm run perf:shaders -- --places bog --no-fog` on the RTX 3070 through ANGLE on Direct3D 11, 1920 by 1080, every
shader at high: the bog's frame and the wet land's own program within it, the fast frames in milliseconds. Each
variant a temporary edit of `wetShader.ts` leaving one part out, measured on a quiet card, the shader put back after.
The picture: the renders page, a square of every kind of land, photographed with the clock stopped (a player who asked
for less motion), before and after, and compared pixel for pixel.

## Observations

The wet land's program at the bog, 2.14 ms as it was, with one part left out:

| left out | the wet land | saved |
|---|---|---|
| the reeds | 0.39 ms | 1.75 |
| the rings | 1.97 | 0.17 |
| the glints | 2.05 | 0.09 |
| the shore's waves | 2.08 | 0.06 |
| the mist | 2.12 | 0.02 |
| everything but the water's colour | 0.12 | |

- **The reeds are the wet land's cost.** Each pixel looks at the twenty-five cells of the lattice about it for a reed
  whose stroke crosses it, and works each cell out: its root's place, the look of the land it stands in, its draw,
  the mask, its clump, its stroke.
- **The cost is the cells, not any one sum in them.** With a cell's stroke not drawn the wet land took 1.95 ms; with no
  clump worked out 1.97; with the mask not read 2.07; with no gust 2.09; with nine cells looked at rather than
  twenty-five 1.40. With every cell passed over just after its root is placed, 0.94; just after its draw, 1.41.
- **Deciding a cell's draw first saves nothing.** A clump only thins a look's reeds, so a draw over the look's own
  share could be passed over before the mask and the clump; that took 2.18 ms against 2.14. The graphics card runs
  pixels in groups of thirty-two, a group taking the dear way if any of its pixels does, and a cell is about three
  and a half pixels across: neighbouring pixels look at different cells, so nearly every group has a pixel whose cell
  passes.
- **Passing over the cells whose reeds cannot reach the pixel does.** A cell's roots lie anywhere in it, a reed rises
  from its root no taller than the tallest the looks of the land about the pixel grow, leans down the wind by its bend
  give or take its sway, and inks only the pixels within its half-width: a cell outside the box of all that is passed
  over before its root is placed (`reachOf`, `landShader.ts`). With the tallest reed anywhere, 0.6 world units, the wet
  land took 1.96 ms; with the tallest the land about the pixel grows, read from the three by three of the mask's world
  units its cells' roots stand in, 1.81 ms; with the rounding margin a twentieth of a pixel rather than half of one,
  1.73 and 1.76. Main's code beside it, alternated, read 2.14, 2.16, 2.15 and 2.16.
- **The picture does not move.** The renders page, photographed with and without, differs in no pixel. Photographed
  twice with the same code it differs, between one load and another, in the same 89 to 105 pixels, here and there over
  the squares and the critters'; those are the pixels the land's split into passes differed in (experiment 0025), so
  none of that was the split's either.

`perf:shaders --compare` against main's point: the bog 2.65 to 2.22 ms (-16%), the wet land 2.15 to 1.74; the ice 0.78
to 0.72, within the 0.71 to 0.78 it has read across 2026-10-20; nothing else moved.

## Result

Open: the reeds pass over the cells that cannot reach a pixel, the same picture for a fifth less of the wet land; the
grass, the heath and the crops look at their cells the same way and come next.
