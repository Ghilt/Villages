# 0110. A structure stands among the trees, drawn in front of them or behind them by its footprint

- Status: accepted
- Date: 2026-10-21
- Amends 0063, which put the ground form of whatever stands in vision over the fog: a structure's ground form now
  stands among the trees, under the fog wherever it is
- Builds on 0052 and 0060, which stand the scenery up on tipped ground and draw it farthest first, and on
  `docs/plans/worked-ground.md`, which stands a building on the front corner of its base, gives it a **Footprint** of
  the ground's diamonds, and keeps the trees off its yard

## Context

Adam, on 2026-10-21, looking at his seat in a wood: *"if a building is placed it will nestle itself in among the
foliage sprites, and the draw order shall be correct given an isometric 26 rendering. You cannot just look at the y
value as one can when doing side on 2d sprites."*

The scenery was one particle layer sorted by where each foot lands on the screen, and a structure was a mark drawn
over all of it: over the fog in vision and under it outside, but over every tree either way. A tree standing in front
of a castle's walls was drawn behind them.

Sorting the castle among the trees by its foot would not do either. The camera looks north, so of two points on the
ground the one further up the screen is the further away, and the trees are points. A building is not: it stands on
its footprint, a square of the ground's diamonds, which are turned twenty-six degrees. Seen from the south the square's
right corner is further back than its left, so the line from one to the other runs up the screen to the right. A tree
beside a castle's left wall can stand in front of it while a tree beside its right wall, lower on the screen, stands
behind it. No one height of the building says both.

## Decision

**A structure stands among the trees, and which of it and a tree is drawn first is said by its footprint.**

- **The footprint is the one the yard is worn on**: the square of diamonds running back from the corner its foot is
  drawn on, a side for its level from the catalogue (`footprintAt` in `sprites/standing/footprint.ts`). A structure the
  catalogue gives no footprint stands on its foot alone, and is sorted by it.
- **A tree is in front of a structure when its foot is below the line from the footprint's leftmost corner to its
  rightmost**, where the tree stands, and behind it when above; level with the corner on that side beyond either
  end. Between the corners the line lies inside the footprint, so for any tree outside it this is exactly which side
  of the walls the tree stands, and no tree stands inside it: it is the middle of the building's yard, where nothing
  grows. Two structures whose pictures overlap are put in order by their footprints: where they share a stretch across
  the screen, the one wholly above the other there first. `drawOrder.ts`.
- **The trees are cut into slices, and each structure is drawn between two.** A particle layer draws its particles
  in one go, so a picture can only go between two layers of them. The trees keep the order of their feet; each is
  given the slice after every structure whose line it is below, and before any structure whose line it is above
  and whose picture it overlaps. The slices are cut again only when a tree comes or goes, the camera tips, or a
  structure moves, changes or comes on the screen, and cost a draw each: one more than the structures on the
  screen. `sprites/standing/StandingLayer.ts`, in the scenery's place in the stack, where its shadows were and are.
- **So a structure's ground form is under the fog wherever it stands**, with the trees about it
  (`groundSideOf` in `sprites/fogLayering.ts`). In vision the fog is clear over it and the trees alike; the clouds are
  drawn only from zoom 7 out, where no ground form is. Its pennant flies with the form it is over: among the trees
  with the building close in, over the fog with the pin far out. A person keeps to 0063.

## Consequences

A castle in a wood has trees behind it and trees in front of it, and its yard keeps them off its walls. The yard's
ring is ragged, so a tree can stand close to a wall now and then, and covers as much of the wall as a tree there
would.

At the soft edge of a house's vision a structure takes as much of the haze as the trees beside it, where it used to
be drawn over it.

The order follows the footprint the catalogue gives, not the picture: a picture painted bigger or smaller than its
footprint sorts by the footprint, as its yard is worn by it. Tuning one is tuning both, on `/admin/inspect-structures`.

The log says under `scenery` how many structures stand among the trees when that changes, and `villagesScenery()`
says how many slices there are.

## Alternatives considered

**Sort a structure by its foot, or by the middle of its footprint.** One height. Right for a footprint seen straight
on to its corner, wrong for one turned twenty-six degrees, which is every one.

**A footprint measured off each picture** by the cutter, from the base of its walls. Built first on 2026-10-21 and
looked at by Adam, then left when the worked ground landed on main with a footprint of its own in the catalogue: two
footprints of one building would disagree, and the catalogue's is the one the yard and the trees already keep to.

**Draw the trees in front of a structure again over it.** One layer of trees and a second of copies, no slices. The
trees in front of those copies would have to be copied too, and theirs, down the screen; and a tree's softened edge
drawn twice is darker than once.

**A depth buffer.** Every picture would need its depth a pixel at a time, which a flat picture does not have.
