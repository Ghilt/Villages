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

## Result

**Confirmed.** A first visit waited about 1.4 s on two compiles, the water's and the clouds'; the clouds' is
compiled ahead now and comes before the screen lifts, and the first visit's long tasks are about half a second
shorter.

## Consequences

- The clouds are compiled ahead (the amendment to decision record 0098 of 2026-10-20).
- The water's 0.7 s is the one large wait left on a first visit. Its program is the map's own, in MapLibre's
  context, and could be compiled ahead the same way, the sea drawn as painted until it is ready.
- `perf:startup`'s built page is loaded where the programs are already compiled, so a player's first visit is in no
  measure; a built page in a browser of its own would put it there.
