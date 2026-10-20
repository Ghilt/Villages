# 0024. What the game cost as it was built

- Status: closed
- Started: 2026-10-20
- Closed: 2026-10-20

## Hypothesis

**What the game costs to run can be measured back through its history, commit by commit, by today's tools, and the
history says where each cost came from.** Adam asked for points back through the history once the measuring was good
(2026-10-19), and found the start slow and zooming into foliage unpleasant (2026-10-20). It is wrong if old commits
cannot be measured as today's are, or if the same code measured twice disagrees beyond the noise.

## Setup

`node scripts/perf-history.ts --run` (decision record 0106): landings of main spread evenly in time, ten since the
world drawn now reached main (2026-10-03T10:25) measured by everything, and five before it by the tests alone; two
more inside 2026-10-18, where the first pass found the largest move, chosen by hand. Each checked out in
`.claude/worktrees/perf-history`, its world made by the steps its own quick start names, measured by this tree's
`perf:shaders`, `perf:zoom`, `perf:startup` and `check.ts --record` on the RTX 3070, 1920 by 1080, every shader at
high for the shaders and as a player has them for the zoom. The points are the lines `why: history` in
`docs/experiments/performance/`, charted at `/admin/inspect-performance`.

What it took to make old commits measurable, each now in the tool:

- **A world tool that gave up too soon.** The commits of 10-12 to 10-17 borrow their tiles from the world cache and
  waited about six seconds for the virus scanner to let a folder of thousands of new links be moved; on a fresh tree
  it never was. 1c82c414 made that wait three minutes on 10-18. The history's tree gives those commits the longer wait
  while their world is made, and puts the file back before anything is measured.
- **A built page with no handle.** Before the loading screen (10-19) a built page hid the map's handle, so nothing said
  when it was ready; it is now read as ready when its last tile came.
- **What a newer commit leaves.** The tree keeps each commit's generated files, and an older commit's format check
  tripped on files a newer one made: on 09-02 it spent ten minutes formatting them. Measured oldest first, none did.
- **A dev server's first page.** Some old dev servers took over the default half a minute to answer their first page.

## Observations

**The controls.** Main's tip, `41ed01e6`, measured in the history's tree at the start, agreed with this tree's own
reading of the same code that morning within half a percent at every place but the coast (2.52 against 2.31 ms, the
light place that drifts by day). Measured again at the end, five hours later, nothing had moved beyond the noise at
any of the nine places, and each load of the start was within a tenth of a second or two.

**What the shaders cost a frame**, the fast frames in milliseconds, every shader at high:

| landed | | tundra | bog | ice | sand | grassland | forest | coast | sky |
|---|---|---|---|---|---|---|---|---|---|
| 10-03 | `510af4d` | 0.13 | 0.19 | 0.08 | 0.09 | 0.17 | 0.17 | 0.68 | 0.11 |
| 10-04 | `b84a1a3` | 0.13 | 0.26 | 0.09 | 0.09 | 1.41 | 0.23 | 0.98 | 0.10 |
| 10-08 | `d741377` | 0.19 | 0.32 | 0.14 | 0.14 | 1.46 | 0.30 | 1.04 | 0.19 |
| 10-16 | `03e992e` | 0.18 | 0.31 | 0.13 | 0.13 | 1.49 | 0.29 | 1.04 | 0.95 |
| 10-17 | `aa8ac34` | 0.19 | 0.33 | 0.13 | 0.15 | 1.99 | 0.32 | 1.47 | 1.00 |
| 10-18 10:14 | `6d0bb03` | 2.98 | 3.83 | 2.18 | 2.12 | 3.13 | 0.34 | 2.10 | 0.99 |
| 10-19 08:04 | `546948f` | 3.36 | 4.24 | 3.11 | 3.61 | 4.12 | 0.34 | 2.29 | 1.01 |
| 10-19 21:55 | `41ed01e` | 3.16 | 3.75 | 2.80 | 3.26 | 4.29 | 3.56 | 2.31 | 0.99 |

- The grass sprites came on 10-04: the grassland from 0.17 to 1.41 ms, the coast's meadow 0.68 to 0.98.
- The relief came by 10-08: a twentieth of a millisecond everywhere.
- The clouds came by 10-16: the sky at zoom 6 from 0.10 to 0.95 ms.
- The land came in steps. On 10-17 the grass became the land, one layer for every kind (`bf67a344`), and still cost
  a few tenths of a millisecond. By 10-18 10:14 every kind had its look and its motion - the wet land's open water
  and reeds, the ice, salt and sand glinting and drifting (`df695b85`, `6d0bb03f`) - and the open land cost 2 to 3.8 ms
  a frame, ten to twenty times what it had. By the next morning 3.1 to 4.2 ms. That evening the ground's texturing
  put the land under the forest too, 0.34 to 3.56 ms, and brought the rest down a little.
- The trees, thousands of them, never cost more than a few hundredths of a millisecond: what makes the forest dear is
  the ground under them, not the trees.

**The zoom.** The forest's 4,100 to 4,600 sprites cost a zoom from 5 to 10 a fifth to a third of a second of the CPU
more than the bare ice, at every point, and a stutter or two; never a long task once the programs were compiled. The
first zoom of a browser that has compiled nothing waited 0.3 to 0.4 s on compiling the grass until 10-17, and
then it grew with the land: 0.7 s on 10-17, 3.3 s on 10-18 at 10:14, 14.9 s on 10-19 at 08:04, and 22 to
31 s since that evening. A player's first visit waits that long the first time the camera comes inside zoom 8.5, and
so does every visit after the land's shader changes, until Chrome has the program compiled on disk.

**The start**, seconds to ready:

| landed | | first load | again | built |
|---|---|---|---|---|
| 10-03 | `510af4d` | 16.1 | 2.2 | 0.7 |
| 10-07 | `fd9802a` | 15.2 | 2.3 | 0.7 |
| 10-08 | `d741377` | 3.9 | 2.3 | 0.7 |
| 10-14 | `ea728c6` | 4.7 | 2.8 | 0.8 |
| 10-17 | `aa8ac34` | 4.8 | 2.7 | 0.8 |
| 10-19 08:04 | `546948f` | 4.8 | 2.7 | 0.8 |
| 10-19 21:55 | `41ed01e` | 5.2 | 2.8 | 1.5 |

- The first load after a dev server starts was 15 to 16 s until 10-07, the dev server of then cutting the sprites as it
  started, and 4 to 5 s after. It swings the most of the three - one fresh run of the 10-04 commit read 60 s - and is
  the dev server's, not the game's.
- A load again grew from 2.2 to 2.8 s over the fortnight, most of it by 10-14.
- The built page, what a player meets, was ready in 0.7 to 0.8 s by its last tile until the loading screen came on
  10-19; since then it is ready when the screen lifts, 1.5 s, which waits besides for the server to answer and for the
  map to have nothing left to draw where the camera starts. The page as it is now has its last tile at 0.8 s, as
  before, and the screen lifts 0.65 s after it: the step is the screen's wait, not a slower start.

**The tests**, seconds a part took and its tests:

| landed | | backend | frontend | end to end |
|---|---|---|---|---|
| 09-09 | `dfb32bb` | 62 s, 98 | 12 s, 356 | - |
| 09-25 | `4ce00b5` | 71 s, 301 | 16 s, 768 | - |
| 10-03 | `510af4d` | 17 s, 505 | 34 s, 1,272 | - |
| 10-12 | `99ea24d` | 52 s, 719 | 36 s, 1,431 | - |
| 10-17 | `aa8ac34` | 64 s, 902 | 39 s, 1,655 | - |
| 10-19 | `41ed01e` | 59 s, 909 | 47 s, 1,798 | 47 s, 1 |

- The backend's time is a few slow specs, not its count. `InMemoryWorldSpec` alone took 25 to 36 s until 10-03, when
  it no longer did, and the backend took 17 s for five times the tests. Since 10-12 three specs that need Docker take most of it:
  `BridgeDockerSpec` 27 to 31 s, `BrokerLiveDockerSpec` 18 s, `MongoWorldDockerSpec` 15 s.
- The frontend's time grew with its tests, about a second for every forty.
- The end-to-end test came on 10-12; the commits before have none to time.

## Result

**Confirmed.** Old commits measure as today's do, the control agrees, and the history names where each cost came
from: the grass sprites on 10-04, the clouds by 10-16, the land on 10-18 and 10-19, and with the land the first
zoom's long wait on the graphics driver. What is slow in the game now is the land: most of every frame at high, and
the first zoom's compile. What is slow in the checks is three Docker specs.

## Consequences

- The performance page has the history: every chapter's line runs back to 10-03, the tests' to 09-02.
- Each landing on main now keeps its own point (`.claude/loop/to-main.md`), so the history goes on without a backfill.
- A first load after a dev server starts is charted, but it is the dev server's and swings; the load again and the
  built page are the lines to read.
