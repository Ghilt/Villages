# 0025. What the land's first compile costs

- Status: closed
- Started: 2026-10-20
- Closed: 2026-10-20

## Hypothesis

**The first close zoom of a fresh browser waits on compiling the land's program because it is one program, and the
same land as a program for each motion compiles in a fraction of the time, side by side, without the page waiting
on any of it.** Experiment 0024 found that wait at 22 to 31 s on this machine since the evening of 10-19, grown with
the land from 0.4 s, and a player meets it on a first visit. It is wrong if the motions' programs together cost what
the one does, or if the land drawn in passes is not the land drawn in one.

## Setup

The land's fragment shader as `landShader.ts` wrote it on 2026-10-20, at `062fa871`, and variants of it, each compiled
cold in Chrome on the RTX 3070 through ANGLE on Direct3D 11: a page of the tree's dev server imports the shader's
source, and each variant is compiled and linked in a WebGL context of its own, with a number of its own folded into
its colour so that neither Chrome's program cache nor the driver's could answer, timed from the source handed over to
the link reported. A variant leaves a motion out by making its test in `main` false, which the compiler takes as no
code at all. The page that did this was a script of the session's, not kept; it is the shape `perf:zoom`'s first
zoom is measured in, a program at a time.

## Observations

| What was compiled | Seconds |
|---|---|
| The land as it is | 24.6, 25.6, 26.1 |
| Of that, ANGLE's translation to HLSL | 0.01 to 0.02 |
| The grass alone, a program of its own | 0.79 |
| The crops alone | 0.24 |
| The heath alone | 0.44 |
| The wet land alone | 0.90 |
| The ice, the salt and the sand alone | 5.0 to 5.3 |
| The same without the dunes | 0.29 |
| Nothing but the mask and the discard | 0.02 |
| Every motion but the dunes, in one program | 6.4 |
| The whole without the walk that finds the dune a pixel sees | 10.9 |
| The whole with the walk asking only the clump of its own cell | 16.4 |
| The whole without the walk's four halvings | 18.4 |
| The whole with every loop's bounds unknown to the compiler, so none is unrolled | 20.4 |
| The whole with every mask read at level nought, so no loop holds a gradient | 25.6 |

- **The time is Direct3D's compiler, and it grows far faster than the code.** The five motions as programs of their
  own cost 7.5 s between them; as the one program, 25 s. Every motion but the dunes is 2.7 s apart and 6.4 s together.
  Neither unrolling nor the texture reads inside the loops changes it; the size of the one function does.
- **The dunes are most of it.** The walk down the screen that finds the dune a pixel sees (`duneSeen`) holds a
  dune's whole layout twice, once for each step and once for each halving: 4 of the ice's 5 s alone, and 14 of the
  whole's 25.
- **A compile need not hold the page.** Asked through `KHR_parallel_shader_compile`, which Chrome has here, the link
  goes on in the GPU process while the page polls: the whole took 26.1 s and held the page 1.1 s at the most. The five
  motions as programs of their own, asked together, were all compiled 6.0 s after they were asked, the ice the last,
  the page held 35 ms at the most: they compile side by side.
- **Chrome remembers a program it has linked.** The same sources linked again in another context, blocking as Pixi
  blocks, took 16 ms.

**The land as a program for each motion** (the first step of the plan). The picture: the renders page drawn with the
clock stopped, the parent commit's twice and this one's, differ in 89 of 5.1 million pixels, by 22 of 255 at the most;
the parent's against itself in none that time. Those are pixels the page differs in between two loads of the same
code, found later (experiment 0027), so the split's picture is the one program's. What a frame costs, `perf:shaders`, the fast
frames in milliseconds, every shader at high, 1920 by 1080, the parent and this alternated twice on the same card
while another session's work kept it busy, so beside each other rather than beside the history's quiet points:

| | tundra | bog | ice | sand | grassland | forest | coast | sky | fog |
|---|---|---|---|---|---|---|---|---|---|
| one program | 3.78, 3.18 | 3.74, 4.50 | 2.78, 2.79 | 3.69, 3.27 | 4.38, 4.40 | 3.55, 3.90 | 2.38, 2.32 | 1.11, 1.12 | 2.33, 2.33 |
| a program a motion | 1.58, 1.59 | 2.65, 2.70 | 0.75, 0.77 | 1.27, 1.92 | 1.88, 1.88 | 1.54, 1.52 | 1.45, 1.49 | 1.11, 1.07 | 1.20, 1.59 |

- **Every frame with land in it costs less, most of them half or less.** The land's own part at the tundra went from
  3.49 to 1.27 ms, at the ice from 2.63 to 0.58, at the grassland from 4.10 to 1.53; the bog's from 3.44 to 2.14, the
  least gain, its wet land being the dearest motion of its own. The one program cost every pixel a share of every
  other motion's code; with a program a motion, a pixel pays for its own. The sky, with no land, did not move.
- **Where two motions meet, both are paid**: the coast's grass and crops, 0.37 and 0.27 ms, the bog's heath at its
  edge 0.13. Small beside what the one program cost everywhere.
- **The first zoom waits 1.5 s, not 28.** `perf:zoom`, its first zoom over the forest on a browser that has compiled
  nothing, the parent and this on the same busy card: the parent waited 28.4 s on compiling the land; this, 0.8 s on
  the wet land's program and 0.7 on the grass's, the two the forest has, and nothing on the rest. The zooms after it
  moved by nothing beyond the noise: CPU 2,135, 2,106 and 1,813 ms over the forest, the grassland and the ice for the
  parent, 2,172, 2,138 and 1,741 for this. Beside the history's quiet point of main's tip the CPU reads a third higher
  for both, which is the busy machine's.

**The land's programs compiled ahead** (the second step). Each motion's program handed to the driver once the loading
screen lifts, or the first time its land is wanted if that is sooner, and a motion drawn only once the browser says
its program is compiled. Handed over as the layer was made, under the loading screen, the start of a first load read
7.1 s against the parent's 6.5 in one run each, the clouds' compile 1.2 s against 0.7: the land's five programs
compete with the start's own for the browser's compile threads. So they wait for the lift. Then, the parent and this
measured one after the other on the same machine, seconds to ready:

| | first load | load again | built page |
|---|---|---|---|
| one program | 9.2 | 4.8 | 1.7 |
| compiled ahead after the lift | 9.1 | 4.7 | 1.7 |

- **The start does not move**, and after ready neither shows a long task. Both read slower than the history's quiet
  point of the morning, 5.2, 2.8 and 1.5, which is the machine's: another session's work kept it busy all afternoon.
- **Every motion's program is compiled within seconds of the lift**: on that busy machine the grass's in 1.5 s, the
  crops' 0.4, the heath's 0.8, the wet land's 1.7 and the ice's 11.1, the page never waiting.
- **The first zoom of a fresh browser waits 0.1 s, not 40.** `perf:zoom`, the parent and this one after the other: the
  parent waited 40.2 s on compiling the land, the machine being busier than in the morning's 22; this waited on no
  program of the land's, only the scenery's, 35 ms, and Pixi's own link of each land program found it in Chrome's
  cache. The zooms after it cost the same CPU for both, 2,645, 2,833 and 2,076 ms over the forest, the grassland and
  the ice for the parent, 2,671, 2,777 and 2,047 for this.

## Result

**Confirmed.** The one program was most of the wait and of the frame: the land as a program for each motion compiles
in a quarter of the time, side by side, and costs half or less a frame at most places, and compiled ahead after the start the page
never waits on it. A player's first close zoom went from 22 to 40 s held to a tenth of a second, with the start as it
was.

## Consequences

- The land is a program for each motion, drawn one over another, each compiled ahead once the game has started (the
  amendments to decision record 0102 of 2026-10-20).
- `shaders/compileAhead.ts` compiles any program ahead of its first use, for the next shader that grows large.
- The dune walk is still the sand's 5 s: shortening it is the plan's third step, now worth less, since nothing waits
  on it.
