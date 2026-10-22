# A smooth crossing into the real world

**What belongs here:** how the camera's crossing into the real world at zoom 7.5 is made smooth with the fog off over
busy ground: what the review of 2026-10-22 measured, the crossing's measure on the performance page, the fixes and the
rules they keep, and the steps. **What does not:** how performance is measured and kept in general, which is
`plans/performance-history.md` and decision record 0106; what the roads and the worn ground are, which is decision
record 0115 and `plans/houses-bridges-and-road-render.md`; why the real world arrives at one zoom, which is decision
record 0096. When a part of it is decided, that part becomes a decision record and leaves.

Planned on 2026-10-22 from Adam's request: the stutters with the fog off, which felt worse after the roads, and the
crossing from the info layer to the real world made buttery smooth over a busy area with unlimited vision, as it
already is with limited vision. The review first, then the measure on the performance page, then the fixes.

---

## What the review measured

On main at 0f5fe5b5, in the measure's own Chrome on the RTX 3070 at 1920 by 1080, the fog lifted, over the zoom 7 tile
with the most roads and trees together, 77/39 (56.6°N 38.0°E): the camera settled at zoom 7 and flown to 8.2 over a
second and a half. At 8.2 the view held 4,668 stretches of road, 10,569 things of the roadside and 10,000 trees, each
with its shadow. Each of three crossings had 15 to 18 frames over 25 ms; a smooth frame is 17.

The time went to one pattern: **something small arrives, and a whole layer is made again.**

| What | How often in one crossing | A frame it cost |
|---|---|---|
| Every tree thrown away and made again, when the worn ground changes (`SceneryLayer.setGround`); each taken out one at a time from a list searched whole for it | twice, 10,000 trees each; 5 times in four seconds of a pan at zoom 9 | 74 to 83 ms, the two worst frames (167 and 217 ms) |
| The roadside laid out again whole (`RoadsideLayer.rebuild`) | 4 times; 5 in the pan | 20 to 70 ms |
| The roadside's every thing walked every frame, on the screen or not | every frame | 2 to 4 ms |
| One cell of a dense wood scattered | once | 138 ms |
| The settlements worked out again (`useSettlements`), the map's sprites handed over new | 50 times, 25 times | a part of the 100 ms frames |
| The roads' program compiled at its first draw | once a fresh browser | 110 ms |

With the fog on the gateway sends only the ground the house has revealed, so the same whole rebuilds run over a handful
of roads and trees, which is why the crossing is smooth with limited vision. The roads made it worse: the roadside is
new, and the roads' worn ground gives the trees more reasons to be thrown away. Throwing the trees away is older: the
settlements' ground did it before the roads.

None of the places the performance page measures has a road or a settlement, so none of this showed on it.

## The names

| Name | What it means |
|---|---|
| `settled` | A place of the measures: woods and farmland dense with roads and settlements, the zoom 7 tile with the most roads and trees together, 77/39 at 56.6°N 38.0°E |
| `roads` | A family on the shaders chapter: the roads drawn as shapes, and the ground worn bare under them, the buildings' yards and the paths (`sprites:roads`, `sprites:worked-ground`) |
| the crossing | The zoom's measure of the camera crossing 7.5, where the info layer gives way to the real world: settled at zoom 7 over `settled`, flown to 8.2 over a second and a half, watched three seconds more |

## The fixes, and the rules they keep

**A thing that arrives changes only what it touches** (decision record 0118, step 2). A road tile, a settlement laid
out or a piece of ground known changes a few diamonds of the worn ground; the woods those diamonds fall in are cut again
and no others. The tiles of roads held change; the roadside of those tiles and their neighbours is laid out again and no
other. Nothing that did not change is worked out again, and the readers of one list read it once.

| Rule | What keeps it | When it holds |
|---|---|---|
| No tree stands on worn ground: a road, a yard, a settlement's ground, a path | The scene handed to the sprites recuts every wood a changed diamond falls in, in the same call | At the instant the scene is applied, before the next frame |
| The woods are the same whatever order the ground, the roads and the settlements came in | A recut wood is cut against the whole worn ground; a change of sight recuts every wood, as now | At the instant the scene is applied |
| Every piece of road held is drawn, worn and lined once, and nothing of a tile let go stays drawn | Each layer of stands has a version that moves whenever one of its tiles comes, changes or goes; every reader works again when it moved | A moment after the tile arrives: before the next frame is drawn, so never seen |
| The roadside is the same whatever order its tiles came in | A tile is laid out with its neighbours, against the pieces of all of them; a test lays the same tiles in two orders | A moment after, before the next frame |
| A measure compares only like with like | `METHOD`, as decision record 0106; the crossing is a new part of a point, absent from the older ones | Always |

## Where it lives

| What | Where |
|---|---|
| The crossing's measure, the place | `frontend/perf/zoom.ts`, `frontend/perf/places.ts` |
| The crossing on the page, the family | `frontend/apps/web/src/admin/performance/` (`Zoom.tsx`, `zoomPoints.ts`, `shaderPoints.ts`) |
| The trees | `frontend/apps/web/src/sprites/scenery/SceneryLayer.ts`, `standing/StandingLayer.ts`, `PixiSpriteRenderer.ts` |
| The roads | `frontend/apps/web/src/net/stands.ts`, `sprites/ground/roads.ts`, `useRoadGround.ts`, `sprites/roads/`, `sprites/bridges/BridgesLayer.ts` |
| The settlements | `frontend/apps/web/src/sprites/settlements/useSettlements.ts`, `useSettlementsHeld.ts` |
| The programs | `frontend/apps/web/src/shaders/compileAhead.ts` and each layer it compiles for |

Every fix step's hand-over measures the crossing with `npm run perf:zoom --prefix frontend -- --places settled
--compare` against the point step 1 keeps, and says what moved.

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | The crossing measured: the place `settled`, the crossing in `perf:zoom` with its slowest frames and what ran in each and the counts of road, roadside and trees, the `roads` family on the shaders chapter, and a point kept as the before | 👀 On `/admin/inspect-performance`, the zoom chapter: the crossing over `settled`, about 15 to 18 frames over 25 ms, its slowest frames naming the trees thrown away and the roadside laid out again. 👀 The shaders chapter: `settled` among the places, and a `roads` family |
| 2 | The trees: a change to the worn ground recuts only the woods it touches, in the same frame at the fade they had, and trees are taken out in one pass; decision record 0118 | 👀 With the fog off over a busy place, crossing 7.5 and panning: the woods never blink as roads and settlements arrive, and no tree stands on a road, a yard or a settlement's ground. The crossing compared: the 167 and 217 ms frames gone |
| 3 | The roads read once: a version for each layer of stands, one list of the pieces held shared by the roads, the roadside, the bridges and the worn ground, and the roadside walked only near the screen | 👀 Roads, walls, growth and bridges as they were at a busy place, in and out of 7.5 and panning. The crossing compared: the roadside's cost a frame and its rebuilds down |
| 4 | The roadside laid out a tile at a time: a tile come or gone, or its worn ground changed, lays out that tile and its neighbours | 👀 Panning along a road across tile edges: no wall or bush pops in or out at an edge, and the same roadside when the camera comes back. The crossing compared: no roadside among the slowest frames |
| 5 | The settlements keep their identity: the list held and the map's sprites are the very same while nothing in them changed | 👀 Settlements and their buildings laid out as their ground comes, as before. The crossing compared: the settlements worked out a handful of times, not fifty |
| 6 | The roads', the worn ground's and the trees' programs compiled ahead, as the land's and the clouds' are | The first zoom's programs waited on, with none of these among them. The checks |

The scattering of a wood off the main thread, and the whole page drawn again at every cell's answer, are not in this
plan: they come after it, if the crossing still stutters.
