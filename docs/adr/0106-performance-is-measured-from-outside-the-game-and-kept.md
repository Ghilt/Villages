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

**The zoom is measured the same way** (`npm run perf:zoom`, `zoom.jsonl`), because Adam found zooming into ground
thick with foliage less pleasant (2026-10-20): the camera flown from zoom 5 to 10 over the forest, the grassland and
the bare ice, each on a fresh page, its frames, stutters, long tasks and the CPU by module, so that what the sprites
cost a zoom is the forest's against the ice's. It found the one large stall there is: the first time a page needs
the land layer, when the camera comes inside zoom 8.5, it waits on the graphics driver to compile the land's program,
22 to 31 seconds on this machine with nothing cached (`getProgramParameter`, ANGLE on Direct3D 11). Chrome keeps compiled
programs on disk, so a player meets it on a first visit and Adam after every change to the land's shader. Every
measure now times each program the page waited on, by its name, and the zoom keeps the run's first zoom apart, cold,
so how long the land's program takes to compile is a line of its own. Once compiled, the forest's 4,600 sprites cost
a zoom about a quarter of a second of the CPU over seven and a stutter or two against the bare ice.

**The tests are kept by the check that runs them** (`node scripts/check.ts --record`, `tests.jsonl`): how long each
part took and each of its steps, how many tests it ran, and where the time went - the backend's modules and slowest
specs, the frontend's slowest test files and Vitest's own account. Recorded, the backend is compiled first and timed
apart, because what Gradle's cache already holds decides that, and its tests are run whether or not anything changed,
because Gradle would otherwise keep a module's last results; the frontend's check is run a step at a time. A tests
point names the CPU and not the card, and compares with the points of the same CPU.

**The history was measured afterwards** by `node scripts/perf-history.ts`, which checks old commits out in a tree of
its own and measures them by today's tools: experiment 0024, from the first commits of 2026-09-02 to main's tip of
2026-10-19. It found where each cost came from - the grass sprites on 10-04, the clouds by 10-16, the land on 10-18
and 10-19, and with the land the first zoom's wait on the graphics driver, 0.4 s before it and 22 s after.

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

## Amendment, 2026-10-21: a player's first visit

The start's loads were each on a page of their own with nothing in its cache, but the pages of one browser share the
programs it has compiled, so none of them waited on the graphics driver as a player's first visit does: the land's,
the clouds' and the water's compiles, which held a first visit for seconds (experiments 0025 and 0026), were in no
point kept. So the start has a fourth load, a **first visit**: the built page in a Chrome started for that one load,
where nothing is compiled or cached, three times and the middle kept, as `visit` in `startup.jsonl`, compared with the
last point and drawn on the performance page beside the other three. The graphics driver's own cache, which outlives
a browser, is not cleared; what a first visit waits on in the browser, it does.

## Amendment, 2026-10-22: the crossing, and the busiest ground

None of the places had a road or a settlement, so the stutter Adam felt crossing into the real world with the fog
lifted over a busy place showed nowhere on the page. A ninth place, `settled`, is the zoom 7 tile with the most roads
and trees together, and the shaders gather `sprites:roads` and `sprites:worked-ground` into a family of their own,
`roads`. The zoom's measure gains **the crossing**: settled at zoom 7 over `settled` and flown to 8.2 over a second
and a half, its late frames (gaps of 25 ms or more) counted, and the trees, the stretches of road and the roadside held
at the end. Every zoom and crossing keeps its **slowest frames and what ran in each**, the CPU profile lined up with
the page's clock by a function of the tool's own run just before the camera moves, and each sample given to the
game's own function nearest the top of its stack. The method is unchanged: these are new parts of a point, absent
from the older ones. See `docs/plans/smooth-crossing-into-the-real-world.md`.

## Amendment, 2026-10-22: the measures' world holds the settlements

The measures' game server was started as the end-to-end test's is, with `--villages.settlements=false`, which the test
needs to keep inside its minute. So every measure ran on a world with no settlements' buildings, where a player's world
opens with 37,461 of them, and the busiest ground, `settled`, was measured empty of its villages. The measures' world now
opens with the settlements raised (`startGame`'s `settlements`), and a measure waits for the opening's own line before
it begins. That changes what every reading means, so `METHOD` is two: the points before it are kept and drawn apart,
and a new first point of the crossing is kept on main's tip, the before of the plan
`docs/plans/smooth-crossing-into-the-real-world.md`.
