# 0026. What a first visit waits on compiling

- Status: closed
- Started: 2026-10-20
- Closed: 2026-10-20

## Hypothesis

**A player's first visit, a browser that has compiled none of the game's programs, waits under the loading screen
on the graphics driver compiling a few of them, and the clouds' can be compiled ahead without the sky going without
them where anyone sees it.** `perf:startup` saw the dev server's first load wait on the clouds' compile and on an
unnamed program (experiment 0025), but its built page, what a player meets, is loaded in a browser that has the
programs already, so it never waits on one. It is wrong if the clouds were not among the waits of a cold built page,
or if, compiled ahead, they come after the screen lifts.

## Setup

The game at `0edd2baf`, each load in a Chrome of its own on the RTX 3070 through ANGLE on Direct3D 11, so that
nothing was compiled before it: the dev server's page and the page as it is built for a player, on servers of their
own, twice each after a first load to warm the dev server. Every program the page waited 20 ms or more on was
recorded with its name, or with the first of its uniforms for one Pixi did not name, and the long tasks before the
screen lifted. A script of the session's, not kept: it is `perf:startup`'s watch with a browser started for each
load.

## Observations

The programs waited on, in milliseconds, a cold built page's two loads and the dev server's:

| program | built page | dev server |
|---|---|---|
| the water, the map's own layer (`uWaves`) | 694, 670 | 677, 682 |
| the clouds | 710, 635 | 753, 687 |
| a second of the water's programs (`uWeights`) | 37, 36 | 36, 36 |
| the fog | 34, 35 | 34, 37 |
| the relief | 29, 28 | 27, 26 |

- **Two programs are most of what a first visit waits on**: the water's and the clouds', about 0.7 s each, of the
  1.8 to 2.0 s of long tasks before the screen lifted, at 3.2 and 3.8 s.

**The clouds compiled ahead**, their program handed to the driver as the layer is made and the sky drawn without
them until it is compiled (`shaders/compileAhead.ts`), the same loads:

| | long tasks before the lift, built page | lifted, built page | long tasks before the lift, dev server |
|---|---|---|---|
| waiting on the clouds | 1.97, 1.78 s | 3.8, 3.2 s | 2.07, 1.98 s |
| compiled ahead | 1.53, 1.17 s | 3.2, 2.8 s | 1.45, 1.57 s |

- **No load waits on the clouds**, and the page's long tasks before the lift are about half a second shorter.
- **The clouds are ready before the screen lifts**: three cold loads of the dev server had their program compiled
  in 1.3 to 1.5 s, side by side with the start's other work, 0.10 to 0.16 s before the lift each time. The sky goes
  without them only under the loading screen.

**The water linked ahead** as well, its three programs handed to the driver as the map starts and drawn with once
linked (`linkProgramAhead`, `shaders/webgl.ts`), the same loads again:

| | long tasks before the lift, built page | lifted, built page | long tasks before the lift, dev server |
|---|---|---|---|
| compiled ahead, the clouds | 1.53, 1.17 s | 3.2, 2.8 s | 1.45, 1.57 s |
| and the water linked ahead | 0.56, 0.85 s | 2.5, 4.2 s | 0.98, 0.85 s |

- **No load waits on a program of more than 70 ms.** What is left are the relief's, the fog's and Pixi's own, 20 to
  70 ms each.
- **The water is linked before the screen lifts**: two cold loads had the realistic water's program in 1.0 and 1.2 s
  and the other two in 0.3 s, before the lift each time; brought in to zoom 10 over the coast the water drew, 0.4
  ms a frame. It is drawn only from zoom 8.5 in, so at the start nobody was looking at it: the first visit had waited
  on a program it was not drawing.

## Result

**Confirmed.** A first visit waited about 1.4 s on two compiles, the water's and the clouds'. Both are compiled ahead
now and ready before the screen lifts, and a cold built page's long tasks before the lift went from about 1.9 s to
under 0.9.

## Consequences

- The clouds are compiled ahead (the amendment to decision record 0098 of 2026-10-20).
- The water's programs are linked ahead (the amendment to decision record 0081 of 2026-10-20).
- `perf:startup`'s built page is loaded where the programs are already compiled, so a player's first visit is in no
  measure; a built page in a browser of its own would put it there.
