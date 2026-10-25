# 0119. A thing that arrives changes only what it touches

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

## Amendment, 2026-10-22: a tree is built once

The woods are built ahead of the crossing now (decision record 0096, amended the same day), before the roads and the
buildings about them have all come, so a road or a house arriving must not mean building trees again. **A tree is
built once while its cell is held**: where it stands comes from the ground, the forest map and the stands, none of
which a road or a house changes, and the worn ground and the fog only say whether it shows. One on worn ground, or on
ground the house has not revealed, is held at a fade of nought; a change asks again only the trees of the cells it
touched, and builds nothing.

| Rule | What keeps it | When it holds |
|---|---|---|
| A tree is built once while its cell is held: the worn ground and the fog only say whether it shows | `setGround` shows or hides the trees of the cells touched, a change of the fog all of them; a cell is built again only when its stands change | At the instant the scene is applied |

## Amendment, 2026-10-22: the roads read once

Every step of the camera changes the cells the page follows, and the roads, their roadside, the bridges and the worn
ground each answered it by gathering every piece of road held again, four times over, and laying them out anew, the
roadside walking all ten thousand of its things every frame. Now each layer of stands has a **version**
(`standsVersion` in `net/stands.ts`) that moves only when one of its tiles is kept new, changes or is let go, and the
pieces held are worked out once a version and shared by the four (`roadsHeld` in `sprites/ground/roads.ts`). The
roads are worn into the ground again only when they change, the width moves, the sight changes, or ground comes in
under a road that waited on it (`rememberingWornRoads`). The roadside keeps its things by the cell they stand in and
a frame walks only the cells about the view.

| Rule | What keeps it | When it holds |
|---|---|---|
| Every piece of road held is drawn, worn and lined once, and nothing of a tile let go stays drawn | The layer's version moves whenever a tile comes, changes or goes; every reader works again when it has moved, before it next draws | A moment after the tile arrives or goes: before the next frame, so never seen |

## Amendment, 2026-10-22: the roadside a tile at a time

The roadside was laid out whole, every piece of road held at once, at the frame the real world arrived: 40 to 70 ms
in that one frame over the busiest ground, and again whenever anything under any road changed. It is laid out a tile
of the stands at a time now (`sprites/roads/roadsideTiles.ts`). A piece belongs to the tile its middle stands in, so it
is laid out by one tile only; a tile keeps off the bands of the pieces of the tiles about it too, so it is laid out
again when their pieces change as well as its own, and when the wayside under it changes. The tiles are laid out as
they arrive, a few milliseconds of a frame at a time and the nearest the view first, from zoom 6, where the stands are
first sent, rather than at the crossing.

| Rule | What keeps it | When it holds |
|---|---|---|
| The roadside is the same whatever order its tiles came in | A tile is laid out against the pieces of the tiles about it, and again whenever one of theirs changes; a test lays the same tiles in two orders and when one goes | A moment after the tiles arrive: within the frames the layout's budget takes, before the real world is shown |

## Amendment, 2026-10-23: the settlements keep their identity

When the camera stopped over busy ground the page stalled for a few hundred milliseconds, and the pan measured it: the
settlements held were worked out again at every step of the camera, though the tiles of their layer had not changed,
and each time every structure on the map walked every settlement to find the one it stands in; every path between the
buildings was walked again whenever one building came or any tile of ground came in for anybody, and the pairs a path
joins were found by measuring every two buildings; and the ground under a diamond was looked up by a key of text. Now the settlements held are worked out again only when their layer's version moves, and the very
same list is handed on while it holds the same settlements (`useSettlementsHeld`). A structure asks which settlement it
stands in only when it is new or the list changed, and asks a grid of their circles rather than every one
(`settlementFinder` in `sprites/settlements/settlementsHeld.ts`); and the map's sprites are the very same list while
every one of them is. Each pair's course is remembered: walked again only when one of its two buildings comes, goes or
changes, or when more ground comes in and that course waited on ground not known (`rememberingPaths`), as the roads'
wear already was; and the pairs are found from a grid a reach across (`pairsWithin`).

| Rule | What keeps it | When it holds |
|---|---|---|
| Every structure inside a settlement is told which, the nearest middle's where two hold it | Its answer is kept for the list of settlements it was asked of, and asked again of a new list; the grid gives the answers a walk of them all gives, which a test holds | A moment after the settlements' tiles arrive: in the same render, before anything is drawn |
| Every two buildings within the reach of each other have their path, walked over all the ground it needs once that ground is known | A pair new to the buildings is walked; a walk that met ground not known yet is walked again when more comes, one that did not is kept; the grid finds the pairs measuring every two finds; tests hold all three | A moment after the building or the ground's tile arrives |

## Amendment, 2026-10-23: the scattering off the page's thread

A cell of the scenery was cut on the page the moment its terrain came in: a busy wood's scattering is a few
milliseconds, and dozens of cells arrive together when the camera stops over busy ground, outside any frame's budget,
so the scatter's functions stood among the slowest frames. The cells are cut in a worker now
(`sprites/scenery/sceneryWorker.ts`). The page hands it what a cell reads by the records the gateway sent, short text;
the worker fetches the terrain under the cell, the sprite map and the ruins map itself, decodes the records with the
page's own decoding, and hands back the points. The cutting is one function, `cutCell` in `cellCutting.ts`, run
by the worker and, where there is no worker or it has failed, by the page. The panel's Scenery part says where the
cells are cut.

| Rule | What keeps it | When it holds |
|---|---|---|
| The woods are the same whether cut in the worker or on the page | Both run `createCutting` from `cellCutting.ts`; a test carries a request and its answer through a structured clone, as a message is, and compares them with `cutCell` over the stands the page decoded | Always |
| A cell is cut from the stands the page holds now, though they changed while it was being cut | When its points come back, a cell whose tiles' records have moved since it read them is kept stale and cut again when next asked; a test sends a tile again mid-cut | A moment after the cut returns: before the cell is next asked for |

## Amendment, 2026-10-24: the map's sprites keep their identity

Every snapshot of a cell hands over every structure in view again, and the page made a new sprite for each, so every
reader after it - which settlement a structure stands in, its yard, its mark - found nothing it remembered and worked
them all out again. The sprites are made through `rememberingMapSprites` in `mapSprites.ts` now: a structure's the
very object it was while its stamp, which the server moves with every change to it, its culture, who holds it and the
catalogue are the same, a person's while they stand where they stood, and the list the very list while every one is.

| Rule | What keeps it | When it holds |
|---|---|---|
| A structure that changed is drawn as it now is | Its sprite is made again when its stamp, culture, holder or the catalogue moved; a test grows one and gives it a holder | In the same render |
