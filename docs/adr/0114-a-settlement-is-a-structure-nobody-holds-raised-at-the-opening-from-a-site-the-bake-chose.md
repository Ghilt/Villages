# 0114. A settlement is a structure nobody holds, raised at the opening from a site the bake chose

- Status: accepted
- Date: 2026-10-21
- Plan: `docs/plans/settlements-and-roads.md`
- Builds on 0093, which made a structure a history of its own that nobody may hold and named "finding it standing in
  the world of 1790" one of the ways to come by one; on 0108, which made the opening make what the world lacks; on
  0087, which made a file the bake writes a contract the server reads; and on 0104 and 0105, which have the page lay out
  a ruined city and wear the ground under a building from what it already holds

## Context

Adam, on 2026-10-21, asked for little uncontrolled settlements dotted round the world, beside the ruins of 1790 and
away from them, and fishing villages, joined by roads. The setting already says the countryside was spared when the
towns fell. Asked whether a settlement should be scenery, as the ruins are, or a thing in the game that a house could
one day take, he chose the second, knowing it means thousands of histories at every opening. Asked how many, a few
thousand to start, the spacing a number he raises by eye; and their names by their place, as an atlas would put them.
He added that the ground under a settlement should be worn, and different from the terrain beneath it.

Where a settlement stands needs the whole world at once - the ground, the water, the slope, the ruins, the names - and
must be the same for every player and every tree. What a settlement is, once it stands, is the structures' business:
held by somebody or nobody, inspected, one day taken.

## Decision

**Where a settlement stands is baked; that it stands is the server's.**

- **The bake chooses the sites.** `world:settlements`, a step of the world cache after the tiles, the flow, the height,
  the names, the cultures and the ruins, reads the zoom-7 class tiles and `world/settlements.json` and writes
  `world/ground/<master>/settlements.json`: every **Settlement site**, with its id, type, level, name and place. Sites
  are of two kinds, each with an id that outlives a repaint: beside a ruin, `ruin:<town>:<k>`, which moves with its town;
  and in open country, `site:<gx>:<gy>`, a candidate on a fixed grid kept when no better one lies within the spacing,
  so a repaint moves only the sites near what was painted. A site by the sea, a lake or a large river is a fishing
  village. The file is a contract the game server reads, held by a fixture at both ends.
- **The opening raises them.** After the catalogues and the house bots, the opening raises every site whose structure
  the read model lacks, with `villages.structure.raised.v1`, held by nobody, under an id name-based on the site's, in one
  story. A site within a clearance of another structure is passed over. A raising refused because the structure stands
  already is passed over too, as Antarctica's are, so opening a world twice changes nothing. **No new event and no new
  command.**
- **Two types in the catalogue**, `village` and `fishingVillage`, three levels each - a hamlet, a village, a large
  village - with every culture's word, a low significance, the tallest building's height, the side of the settlement's
  square of ground as its footprint, and no yields or slots yet.
- **The page lays it out.** `settlementIn` lays out a settlement's buildings, streets and green from its structure's id,
  type and level, the culture under it and the zoom-7 classes, as `ruinsIn` lays out a ruined city: pure, without
  trigonometry, the same everywhere. A higher level holds every building of the lower. It stands among the trees as one
  thing on its square, and its whole ground is worn, a kind of worked ground of its own, keeping to the fog as the
  structure does.

## Consequences

- A settlement is everything a structure is at once: in a cell, under the fog, in a window, one day held. Taking one,
  and what it then gives, is a mechanic still to design; nothing here stands in its way.
- The world's history says which settlements stand, and the bake says where they should. A repaint that leaves a
  settlement without a site never moves it; the opening and the debug panel name such ones, and before alpha a wipe is
  the answer.
  While the instruments are open the welcome counts them - the sites, the settlements standing on them, those passed
  over for a seat and those on no site - and the World section of the debug panel says so (protocol version 67).
- The opening raises a few thousand structures on a fresh world, after a wipe and after a load. Its time is measured
  before the spacing is tightened.
- A bot's seat and a settlement can want the same ground. The settlements give way at the opening; the bots learn to
  give way to the sites and the roads at the end of the plan.

## Alternatives considered

- **Scenery, as the ruins are**: a stand of a layer of its own, never stored, laid out by the page. Cheaper by far, and
  what was first offered, but it can never be held, taken or inspected without becoming a structure later. Adam chose
  the structure.
- **A structure for every building.** A house would take a cottage rather than a village, the opening would raise ten
  times as many, and each building standing among the trees would cost a slice of its own (0110).
- **The server choosing the sites at the opening**, as it places the house bots. The sites need the water and the slope
  a world unit at a time and the roads must be routed between them; both belong offline, beside the tiles, made once for
  every tree by the world cache.
- **Sites numbered in the order they were found.** Any repaint would renumber them, and every settlement of the world
  would be raised again somewhere else.
