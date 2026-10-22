# 0118. A thing that arrives changes only what it touches

- Status: accepted
- Date: 2026-10-22
- Plan: `docs/plans/smooth-crossing-into-the-real-world.md`
- Builds on 0067 (the stands sent a tile at a time while the page follows the cells over it), 0105 (the worked ground)
  and 0115 (the roads worn into it)

## Context

Adam, on 2026-10-22: with the fog lifted over a busy place the crossing into the real world stutters, and it felt worse
after the roads; with the fog on it is smooth, and it should be buttery smooth either way.

The review measured the crossing over `settled`, the zoom 7 tile with the most roads and trees together: 10,000 trees,
4,668 stretches of road and 10,569 things of the roadside held at zoom 8.2, and 15 to 18 frames of 25 ms or more in a
second and a half. What took the time was one pattern: **something small arrived, and a whole layer was made again.**
A road tile, a settlement laid out or a piece of the ground known changed a few diamonds of the worked ground, and the
scenery threw away every tree it held and made them all again, twice a crossing and five times in a four-second pan;
each was taken out of its layer one at a time, every one searching the whole list for itself, 80 ms for ten thousand.
The roadside was laid out again whole four times a crossing. With the fog on the same rebuilds ran over a handful of
roads and trees, which is why they were never felt.

## Decision

**A thing that arrives changes only what it touches.** Whatever the page builds from what it holds - the scenery from
the worked ground, the roadside from the roads, a list from the stands - is built again only where what it reads
changed, and is otherwise the very thing it was.

- **The trees.** A change of the worked ground hands the scenery the cells it touches (`cellsTouched`, in
  `sprites/ground/growing.ts`): every cell a diamond that became worked or bare overlaps, and the same cell a world
  away either side. Those cells are cut again in the same call and their trees made afresh at the fade they were at;
  every other cell keeps its trees, because the ground under them is as it was. A change of the fog still cuts every
  cell, since the fog moves everywhere at once.
- **Taken out together.** Trees and shadows that leave are gathered and taken out of their layers in one pass over each
  (`sprites/standing/leaving.ts`), never searched for one at a time.

The rules this keeps, and when each holds:

| Rule | What keeps it | When it holds |
|---|---|---|
| No tree stands on worked ground: a road, a yard, a settlement's ground, a path | The cells a changed diamond falls in are cut again in the call that hands the scene over | At the instant the scene is applied, before the next frame |
| The woods are the same whatever order the ground, the roads and the settlements came in | A cell cut again is cut against the whole worked ground; a change of the fog cuts every cell | At the instant the scene is applied |

The roads and the settlements follow in the plan's later steps, by the same rule, and amend this record as they land.

## Consequences

- A road tile arriving cuts a few cells of trees again, not every cell in view. The cost of a change of the worked
  ground is now what it touches, and finding what it touched: a pass over the diamonds of the old ground and the new.
- The two worst frames of the crossing were these (150 and 133 ms on the before point of 2026-10-22); what is left of
  the crossing's stutter is the roadside, a dense wood's scattering and the settlements, which the plan takes next.
- Nothing a player sees changes but the stutter: the same trees stand in the same places, and none blinks while a road
  arrives beside it.
