# 0106. Performance is measured from outside the game, by what draws, and kept a point a landing

- Status: accepted
- Date: 2026-10-20
- Follows 0081 (every shader has its levels and says once what it costs), 0098 (the clouds), 0102 (the land in one
  layer); the plan is `docs/plans/performance-history.md`

## Context

Adam asked for a standing step in the work that measures what takes time and where as the game is built, above all
when a shader is added, and keeps how it moves commit by commit, back through the history as well.

Every shader since 0081 says once in the log what it costs the graphics card, timed by `shaders/costMeter.ts` over the
first thirty frames it draws at a level. Those numbers could not be compared. On 2026-10-19 the same frame of sand at
high read 6.61 ms with the map left still and 2.15 ms with the card kept busy: at a layer's own thirty frames a second
the card idles down and every frame takes longer. The low level is timed while the map is still loading. And nothing
was kept: a reading lived in one page's log.

## Decision

**The game is measured from outside it.** A tool in the newest tree, `npm run perf:shaders --prefix frontend`
(`frontend/perf/`), drives this machine's own Chrome on the graphics card against any tree, on a dev server and a game
server of its own on free ports, and imports nothing of the game. It reads the page through what has long been there:
the map's handle `window.villagesMap`, the dev server's module addresses (where it finds each shader's
`set<Name>Level` and sets it), and the page's buttons. So an old commit is measured exactly as today's, and the
game's own meters stay as they are, quick looks that say they are.

**What draws is named by what the libraries already call it.** A script hung on every WebGL 2 context before the page
runs takes the card's timer for itself, so the game's meters find none and never hold a query of their own, and times
each run of draws under a name: on the map's context the style layer MapLibre is drawing (`painter.id`), on the sprite
canvas Pixi's program, whose name Pixi writes into its source (`#define SHADER_NAME land-fragment`). No list of the
game's shaders is kept anywhere: a new one is measured, under its own name, the day it lands.

**A reading is the frame as a whole, on a busy card, at its fastest.**
- Each place is drawn back to back until two bursts agree, so the card is at its working clock.
- Then frames are timed in bursts, as a whole and run by run in turn: the frame from the first, its parts from the
  second, scaled to add up to it.
- The same frame drawn back to back takes one of two times a fifth to a quarter apart, frame by frame and burst by
  burst, at the same clocks (`nvidia-smi` showed 1920 and 6801 MHz throughout): the reading is the fastest fifth of
  the frames, averaged.
- A page that has been round the other places draws a place a tenth slower than a page opened for it, and one fresh
  page can draw a place up to a sixth slower than the next and keep to it: every place is measured on three pages of
  its own, the fastest kept.
- The wall clock is held, so the clouds and the wind stand where they stood the last time.
- A card more than a quarter busy before the run is refused.

Four runs of one tree agreed within two in a hundred at every place (2026-10-19). A run on another day agreed at every
place but two light ones, the coast and the sky, which read up to nine in a hundred slower with nothing changed;
keeping half the CPU's cores busy moved nothing. What the run's parts are (the land, the water, the clouds) never
changed its share of a place's frame.

**Eight places, and the fog.** A screen each of tundra, bog, ice, sand, grassland, forest and a coast at zoom 10, and
the clouds from zoom 6, found in the default master's flat tiles, at 1920 by 1080 in the player's camera, every
shader at high and the fog lifted. Then, last, a house founded from the first seat offered, and the fog measured over
it; the seat is another each run, so only the fog's own parts compare.

**Points are kept in the repository.** `--record` adds the run as one line of
`docs/experiments/performance/shaders.jsonl`, beside the bot swarm's `runs.jsonl`: the commit and when main came to
hold it (from main's reflog), why it was measured, the machine, the method, and each place's frame, spread, CPU time,
parts and draws a frame. A point is kept when work reaches main, and for commits that came before; a hand-over
measures and compares with `--compare` and keeps nothing. Points are only ever compared, and charted as one line, when
they were measured by the same method on the same card at the same size: `METHOD` in `frontend/perf/kept.ts` is raised
whenever what a reading means changes. Something has moved when a place's frame changes by more than ten in a hundred
or 0.1 ms, or a part by more than ten in a hundred or 0.05 ms.

**The start is measured the same way** (`npm run perf:startup`, `startup.jsonl`), because Adam found the start slow
and janky: three loads, each in a browser of its own with nothing cached - the first load after the dev server
started, a load again, and the page as it is built - each from asking for the page to the loading screen lifting
(the map drawn, before there was a screen) and five seconds on. What is kept is when each mark of the start came,
the long tasks and the gaps between frames over the two stretches, what was fetched, and where the CPU's time went
by module and by function. A built page is served by the tool, the build first and the public folder behind it, so
the world's tiles are not copied for it. The first point (2026-10-20): 5.8 s for the first load, 3.3 s again, 1.6 s
built; up to ready on a load again, React's development runtime and MapLibre a third of a second each.

## Consequences

- What the shaders cost is a number that means the same thing from one commit to the next, and a history of it
  travels to main with the work.
- The numbers are this machine's, an RTX 3070 through ANGLE and Direct3D 11. Another card starts a line of its own.
- The two speeds of the same frame are not understood, only stepped round; the measure keeps the faster and says how
  far the frames spread. A change of a few in a hundred is under the noise and is not called a move.
- It measures the card's work. What the CPU does to make a frame is timed beside it, but what the browser does to put
  the canvases on the screen is not seen by a WebGL timer at all.
- At high, at 1920 by 1080, the land is most of every frame, 2.6 to 4.1 ms; the water 0.6 ms at the coast; the clouds
  0.8 ms; the trees, thousands of them, under 0.05 ms (2026-10-20).
