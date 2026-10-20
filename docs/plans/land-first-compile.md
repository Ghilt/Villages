# The land's first compile

**What belongs here:** how the first close zoom of a fresh browser comes to stop waiting on the graphics driver
compiling the land, what drives that compile, and what it is measured by. **What does not:** what the land looks like,
which is decision record 0102 and `look.ts`; how performance is measured and kept, which is decision record 0106. When a
part of it is decided, that part becomes a decision record and leaves.

Planned on 2026-10-20 from the performance history (experiment 0024): the first time a page needs the land layer, the
camera inside zoom 8.5, it waits 22 to 31 s on the driver compiling the land's program, one long task in
`getProgramParameter`, on the RTX 3070 through ANGLE on Direct3D 11 with nothing cached. It grew with the land, from
0.4 s of grass on 10-17 to that since the evening of 10-19. Chrome keeps compiled programs on disk, so a player meets it
on a first visit, and Adam after every change to the land's shader.

## What was found

Each program compiled cold on a page of its own in Chrome on the card, a number of its own folded into the colour so
that no cache could answer, timed from the source handed over to the link reported. The shader as it is now, its
sources as `landShader.ts` writes them.

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

- **The time is Direct3D's compiler, and it grows far faster than the code.** The five motions as programs of their own
  cost 7.5 s between them; as the one program they are 25 s. Every motion but the dunes is 2.7 s apart and 6.4 s
  together. Nothing about loops or texture reads changes that; the size of the one function does.
- **The dunes are the most of it.** The walk down the screen that finds the dune a pixel sees (`duneSeen`) holds the
  dune's whole layout twice over, once for each step and once for each halving, and is 4 of the ice's 5 s alone and
  14 of the whole's 25.
- **A compile need not hold the page.** Asked through `KHR_parallel_shader_compile`, which Chrome has here, the link
  goes on in the GPU process while the page polls: the whole took 26.1 s and the page was held 1.1 s at the most. The
  five motions as programs of their own, asked together, were all compiled in 6.0 s, the ice the last, the page held
  35 ms at the most: they compile side by side.
- **Chrome remembers a program it has linked.** The same sources linked again in another context, blocking as Pixi
  blocks, took 16 ms. So a program compiled ahead, from Pixi's own sources, costs Pixi nothing when it comes to it.

## The options

| | What | The first close zoom | Look | Frame | Cost to build |
|---|---|---|---|---|---|
| A | The land compiled in the background from the start, and drawn once it is ready | No wait; the motion comes about 26 s after the page opens on a fresh browser | Same | Same | One step |
| B | The land as a program for each motion, drawn one over another in the order the one program lays them | 1 s of grass, 6 s at the first sand, once each | Same, but for a rounding of 1/255 between passes | To measure; each program is smaller, each pass reads the mask again | One step |
| C | A and B | No wait; the motion comes 1 s after the page opens where there is grass, 6 s at the most | Same | As B | Two steps |
| D | The loading screen waits for the land | No wait, but every first start is 6 s (with B) to 26 s longer, also for a player who never zooms | Same | Same | One step |
| E | The dune walk asks for the dune in one place in its code rather than two | Saves about 1.6 s of the sand's 5, 6 s of the whole's 25 | Same | To measure | A small step, best after B |

**Recommended: C, then E if the sand's 6 s still shows.** It is the only one that neither holds the page nor makes
anyone wait who did not zoom, and B makes A's wait short: a fresh browser has the grass moving a second after the page
opens. B also takes the other motions' code out of each program, which the session of 2026-10-19 found the ice and the
bog paying for on screens with none of it (0.3 to 0.4 ms a frame), so its frame cost may well come down; perf:shaders
says.

## What Adam settled

| Question | Answer |
|---|---|
| Which option | C, then E if it is still worth it (2026-10-20) |
| Who it is for | A player opening the page while a server runs: that is what is optimised, not the development loop of changing the shader and reloading (2026-10-20) |

## Rules that hold

- **The page never waits on the driver for the land.** A motion is drawn only once the browser says its program is
  compiled; held by the land layer at every frame it draws. A browser that cannot say, without
  `KHR_parallel_shader_compile`, has the land drawn as now, and waits as now.
- **The land in passes is the land in one.** The motions are drawn in the mask's order, grass, crops, heath, wet land,
  ice, each laid over those before exactly as the one program lays them; held by a test of the order and of what each
  pass's program holds.

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | web: the land drawn as a program for each motion, one over another, with experiment 0025 opened and this plan | 👀 The renders page, `/admin/inspect-renders`, a square of every kind of land, against main's: the grass, the farmland, the bog and the paddy, the tundra, the dunes and the ice the same. perf:shaders, what moved a frame. perf:zoom, the first zoom's wait from about 25 s to about 6 |
| 2 | web: the land's programs compiled in the background from the start, each motion drawn once its program is ready; experiment 0025 closed | 👀 The first load of the game after this step, its land new to your Chrome: zoomed in close at once, no freeze, the motion comes within seconds, and the Land part of the panel's log says when the programs were ready. perf:zoom, the first zoom's wait under a second. perf:startup, the start not moved |
| ~~3~~ | ~~web: the dune walk asks for the dune in one place, if the sand's program is still worth shortening~~ | Dropped: once the programs were compiled ahead nothing waited on the sand's, so a shorter compile would only have the sand moving a few seconds sooner for a player who zooms into a desert in the game's first seconds (Adam's word, 2026-10-20) |
