# Performance history

**What belongs here:** how the game's performance comes to be measured and kept as it is built: what the shaders cost
at fixed places on the map, how long the game takes to start and where that time goes, and how long the tests take;
how each is measured, where the points are kept, how they are drawn on `/admin/inspect-performance`, when the loop
measures, and how points are found for the commits that came before. **What does not:** what the page and the tools
are in the running program, which is `RUNNING.md`; how the repository is tested, which is `TESTING.md`; how many
players a server carries, which is `plans/bot-swarm.md`. When a part of it is decided, that part becomes a decision
record and leaves.

Planned on 2026-10-19 from Adam's request: an overall step in the process that measures and investigates performance
as the project goes on, above all when shaders are added, to know what takes time and where; a shaders section and a
tests section on the performance page; a startup chapter of its own, because the start is slow, janky and lags, which
the loading screen of that morning now covers; and points found by going back through the history.

## What Adam settled

| Question | Answer |
|---|---|
| What the tests section tracks | How long the suites take, and how many tests there are |
| Where the shaders are measured | About eight fixed places on the real map, every shader counted: water, clouds, fog, the map's own |
| When the loop measures | A step that changes what is drawn or how the game starts, at its hand-over, against main's last point; a point kept each time work reaches main |
| How far back | About ten points each, spread evenly |
| The zoom | A chapter of its own: what loading the sprites costs, because zooming into ground thick with foliage is less pleasant than into bare ground (2026-10-20) |
| Verifying | The plan runs through to its end, a commit a step once its checks are green, and Adam verifies it all at the end (2026-10-20) |

---

## The problem, in one paragraph

Nothing keeps the game's performance. The water, the land, the clouds and the trees each say once in the log what
they cost the graphics card (`shaders/costMeter.ts`), and the same frame reads two and a half to three times longer
on a card that has idled down at a still map's thirty frames a second than on a busy one (2026-10-19: sand at high
6.61 ms still, 2.15 busy), so a reading says as much about the card's clock as about the shader. The start says in the
log when the camera was put and when the map was drawn, and forgets it. `scripts/check.ts` prints how long each part
took and throws it away. The one history kept is the bot swarm's, `docs/experiments/performance/runs.jsonl`, one line
a run, keyed by commit and machine, drawn on `/admin/inspect-performance`: the pattern this follows.

## How it is measured

**From outside the game.** One tool in the newest tree drives the machine's own Chrome on the real graphics card
against any tree, so an old commit is measured exactly as today's. It imports nothing of the game; it reads the page
through `window.villagesMap`, the dev server's module addresses and the page itself.

**The shaders, by what draws.** The tool takes the graphics card's timer for itself (the game's own meters then say
nothing, so the two never collide) and times every run of drawing under its name: the map's style layer, the water
and the relief among them, and Pixi's program, `land`, `clouds`, `fog-of-war`, `scenery`, `batch`. The names are kept
as they are and gathered into families on the page, so a later gathering regroups old points without measuring them
again. At each place every shader is at high, the wall clock is held so the clouds and the wind are the same every
time, the card is kept busy, and the fast frames are kept, with their spread.

**The places**, at 1920 by 1080, the player's camera, zoom 10, the fog lifted: tundra, bog, ice, sand, grassland,
forest, a coast with sea; a cloudy sky at zoom 6, because no cloud is drawn closer in than 7; and the fog once, with a
house founded on a game server of the tool's own.

**The start.** A fresh browser each time, a dev server and a game server of the tool's own: how long to the map's
style, the camera put, the map drawn and the screen lifted; the long stalls and the worst gaps between frames up to it
and just after; what was fetched; and where the time went, by module and by function. The first load after the dev
server starts and a reload apart, and the built page, so what is the dev server's own slowness shows apart from what a
player meets.

**The zoom.** The camera flown in, the way a player's wheel takes it, from far out to close over a forest thick
with trees, and the same over bare ground, on a page of its own each time: how long each frame took to come, the
worst gaps between frames and the long stalls while the sprites are worked out and drawn, the frames the scenery's
work and the map's own each took, and where the CPU's time went, by module and by function. The forest against the
bare ground is what the sprites cost the zoom.

**The tests.** `check.ts --record`: every test made to run, each part and each of the frontend's typecheck, lint,
format and unit tests timed apart, with how many tests each has.

**Kept** in `docs/experiments/performance/shaders.jsonl`, `startup.jsonl`, `zoom.jsonl` and `tests.jsonl` beside
`runs.jsonl`, a line
a point, saying the commit, when it reached main, why it was measured (a hand-over, a landing, the history), the
machine and the method. What a hand-over measures goes to `.logs/perf/` and is never kept.

**Compared** only within one method and one machine; a change of either is marked on the page with why. A shader not
there yet is absent, not nought. A thing has moved only beyond twice the spread seen, or 0.05 ms.

## Where it lives

| What | Where |
|---|---|
| The shader and startup tool | `frontend/perf/`, beside `e2e/`, whose servers it shares; `npm run perf:shaders` and `perf:startup` |
| Reading the points, the families | `frontend/apps/web/src/admin/performance/`, beside `runs.ts` |
| Recording the tests | `scripts/check.ts --record`, `scripts/lib/` |
| The history | `scripts/perf-history.ts`, running the two above at each old commit |
| The page | `/admin/inspect-performance` in folding sections: Server, Shaders, Startup, Zoom, Tests |

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | The shaders measured at the places, on a dev server and a game server of its own: a table and a picture of each place | 👀 Each place is the ground it is named for, the forest with its trees. A run of Adam's own agrees with the table. The numbers read sensibly |
| 2 | A house founded, the fog measured | 👀 A fog row in the table. No house added to Adam's own world |
| 3 | Points kept and what moved: the first point, main's tip, and the decision record | The first line of `shaders.jsonl`, in words. A run with nothing changed says nothing moved; one with the water at low moves only the water |
| 4 | The page in sections, the shaders on it | 👀 Server as it was. Shaders: each place's frame, a chart by place, the families at each place, the commit under the pointer |
| 5 | The start measured, and its section | 👀 The start's timeline and where its time goes match what Adam sees when he opens the game. The dev server and the built page apart |
| 6 | The zoom measured, into a forest and into bare ground, and its section | 👀 The forest's zoom against the bare ground's: its worst frames and stalls, and the functions they were spent in, match how the zoom feels |
| 7 | The tests' times kept, and their section | 👀 Each suite's seconds and count on the page, the counts as the check printed them |
| 8 | The loop measures: at a hand-over what moved, at a landing a point kept | The hand-over and to-main notes, read. The architecture page's question |
| 9 | The history driver, tried on two commits | The list of points it would measure. The two trial lines. Nothing of another tree stopped |
| 10 | The history, measured on a quiet card | 👀 The charts with their history. The points that could not be compared, and why. Main's tip measured first and last, agreeing |
