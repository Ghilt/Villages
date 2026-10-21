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
  with the building close in, over the fog with the pin far out.
- **A person stands among the trees too**, on their foot, a footprint of a point (amended 2026-10-21, Adam's word:
  *"Stand people among the trees too, by the same draw order"*): sorted against a tree as one tree is against another,
  and under the fog with them wherever they are. Every kind with a ground form stands among the trees now, so 0063's
  side of the fog for a ground form is kept for a kind that would not.
- **The trees in the way of what the pointer is over fade seven tenths away** (amended 2026-10-21, Adam's: *"if the
  structure or character is hovered, the trees in front of it fade away"*, and then, of the pace and the depth,
  *"it can be a little slower, and maybe 70%"*): the ones drawn after it whose pictures overlap its own, to three
  tenths of themselves over about seven tenths of a second, and back as slowly when the pointer leaves. Each keeps its
  own alpha under the fade, so the scenery's own fades still reach it (`sprites/standing/veil.ts`). The map tells the
  renderer what the pointer is over as it crosses from one thing to the next, by the same hit test a click asks.
- **The ring under what is selected lies on the ground with it**, round its footprint, a circle on the ground squashed
  as the ground is - round a person's patch of ground for a person - between the trees' shadows and the trees, so the
  building and the trees in front of it stand over it. It was a picture over every tree, centred on the building's foot
  and as wide as its picture was tall, so it ringed the trees in front of a castle rather than the castle. Far out it
  rings the pin, over the fog and the clouds with it, and eases from one to the other with the trade between the two
  forms (`ringPlace.ts`). It is a light drawn by a shader of its own, breathing, a wave running out and beads going
  round, which asks for twenty-four frames a second while it shows (`RingLayer.ts`, `ringShader.ts`).

## Consequences

A castle in a wood has trees behind it and trees in front of it, and its yard keeps them off its walls. The yard's
ring is ragged, so a tree can stand close to a wall now and then, and covers as much of the wall as a tree there
would.

At the soft edge of a house's vision a structure takes as much of the haze as the trees beside it, where it used to
be drawn over it, and so does its ring.

While something is selected the sprite canvas is drawn twenty-four times a second for its ring, whatever else is still.

The order follows the footprint the catalogue gives, not the picture: a picture painted bigger or smaller than its
footprint sorts by the footprint, as its yard is worn by it. Tuning one is tuning both, on `/admin/inspect-structures`.

The log says under `scenery` how many marks stand among the trees when that changes, and `villagesScenery()`
says how many slices there are, what the pointer is over and how many trees are in its way.

Every person on the screen is a slice break as a building is, so a crowd of people in a wood costs a draw each.

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

## Amendment, 2026-10-21: a settlement and a bridge stand among the trees too

A settlement stands as one thing, whatever its buildings, on its square, so a view of many villages cuts the trees into
one slice more a village and not one a building; its pieces are drawn in their own order within it. A bridge stands on
the strip of its deck, the corner nearest the camera first. The bridges are handed to the layer beside the marks, each
source's list kept apart and the two drawn as one stack (`StandingLayer.stand(things, from)`). See decision records 0114
and 0115.
