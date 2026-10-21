# 0105. Worked ground is worked out by the page, and drawn over the land in the sprite canvas

- Status: accepted
- Date: 2026-10-18
- Follows 0102 (the land in one layer) and 0104 (a ruined city laid out by the page from its record)

## Context

A building on the map stood on nothing of its own: a picture hung on the painted ground, the meadow or the forest
running up to its walls and under them. Adam asked for the ground a building stands in, worn bare, as many games
draw it, and later for little paths between buildings, and for both to keep to the fog exactly as the buildings do:
not seen by a house that has not seen the building, seen once revealed.

Three things were already true.

- **The gateway decides which buildings a page holds, and in which face** (0061): everything in vision, a building on
  revealed ground in the face it had when the fog hid it, and nothing raised there since.
- **The ground is painted on a lattice of diamonds** turned 26 degrees, one world unit across (0060, 0066), and the
  pictures of buildings are painted turned to sit on it. A building now stands on the front corner of its base, on a
  corner of the diamonds (0059's amendment of 2026-10-18), and covers a square of them, its **footprint**, which the
  structures' catalogue says.
- **The land's motion is a full-screen pass of the sprite canvas** over a mask of what each world unit is (0102), in
  the container the fog hazes and takes the colour out of.

## Decision

**Worked ground is worked out on the page from the structures it holds, and nothing else**: each building's yard is
its footprint worn whole and a ragged ring of diamonds round it, kept by a roll seeded from the structure's id and the
diamond, so every page holding the same buildings works out the same ground; where two yards meet the stronger kind
wins, whichever comes first (`sprites/ground/workedGround.ts`). It is never stored and never sent. Because a yard has
no source but a building the gateway sent, it shows, hides and keeps its last-seen face as the building does, with no
change to the server, the protocol or the events.

**It is drawn by a layer of the sprite canvas** (`sprites/ground/GroundLayer.ts`), in the `world` container over the
land's motion and under the critters, the scenery's shadows, the trees and the marks: so no tuft moves on it, the
trees' shadows fall across it, and the fog hazes it and takes its colour out on ground only revealed, as it does the
buildings on it.

**One pass over the screen reads a window of the lattice a byte a diamond.** The page hands the graphics card the
worked ground in the view and a margin as a single-channel texture laid out in the lattice's own whole numbers
(`groundWindow.ts`), made again only when the view leaves it or the buildings change. For each pixel the shader finds
the ground under it by the sprites' projection backwards, the diamond it is in, moved a little first by a noise so an
edge wanders as the painter's do, and reads one byte; a diamond worn nothing is let through at once, so a frame costs
one triangle and a texture read a pixel however many buildings there are (`groundShader.ts`). The projection and the
noise are the land's, moved to `shaders/groundGlsl.ts` so both passes share them.

**It comes in with the buildings' ground form at 7.5** and asks for no frames of its own. Whether it is drawn, how much
of the earth covers the paint and its colour are levers in the Structures section of the debug panel.

## Consequences

- **The relief does not shade a yard**: it is drawn over the map canvas, where the relief is. A yard is a few diamonds
  across and lets a little of the paint through, so the loss is small.
- **Paths can be added as another kind of byte**, and later roads and a ruined city's old streets, by whatever works
  out where they are: the layer draws kinds, it does not decide them.
- **No tree grows on worked ground.** The scenery's test of where it may grow, which the fog already gave it, is the
  revealed ground and not a worn diamond (`sprites/ground/growing.ts`). The scenery sorts every cell in view again when
  that test changes, so the worked ground keeps its identity while the yards hold still and changes only when a
  building comes, goes or changes, not each time a person on the map moves. The switch in the Structures section takes
  the worked ground away whole, the yards and the clearings with them.
- **The pictures decide how well a building sits in its yard**: one painted from too low a view has a base flatter
  than its footprint. The guides for painting them in the map's own view are with the plan.

## Alternatives considered

**A MapLibre custom layer under the relief**, as the water and the relief are (0081, 0090). The relief would shade it,
but the land's motion is drawn over the whole map canvas, so the tufts would grow through the earth unless every
motion's shader learnt where it was.

**Painting it into the painterly tiles.** It would match the paint exactly, but the tiles are cached by address and
painted once for every player, and MapLibre has no way to repaint one tile when one building is seen.

**A mesh a building**, each drawing its own patch. Cheap for a few, but two patches that overlap double their edges
where they meet, and paths joining yards would need the same union worked out again; a mask holds the union by
construction.

**Worked out on the server**, as a read model sent through the fog. It would let a rule see the whole world, which a
road network may one day need; for yards it adds a projection, a frame and a protocol version to say what the page
already knows.

## Amendment, 2026-10-19: paths between near buildings

Two buildings are joined by a path when they stand nearer each other than the paths' reach, foot to foot, whoever
holds them, a ruin included: a rule of the pair alone, so learning of a third building never adds, moves or takes away a
path already seen, as "each to its nearest" would the moment the fog let a nearer one through (`sprites/ground/paths.ts`).
The course is walked over the diamonds from the front of one footprint to the front of the other, the cheapest way
across the ground in a box round the pair: a step onto land costs one and a little of a smooth wander seeded by the
pair, a river six, and open water - the ocean, the shallow sea and a lake - bars the way; a pair that water bars has
none. The ground is the flat tiles of class ids at zoom 7, a world unit a texel, asked for as a course needs them
(`groundTiles.ts`), and a course is not walked until all the ground it looks at has come, so it is never walked on a
guess and walked again differently. Paths are worn into the worked ground under the yards, as their own kind, and only
on ground the house has revealed: a path to a building seen through the fog stops where the revealed ground stops. The
reach is a lever in the Structures section, twelve world units to begin with, which joins the next-door buildings of
Antarctica's sixteen and not the ones across a diagonal.

## Amendment, 2026-10-21: a settlement's ground, and a kind for roads

(Later the same day the road's own kind went to the settlements' streets alone, and roads were drawn as shapes: see
the last amendment.)

A settlement (decision record 0114) is worn by its layout rather than as one footprint: its whole square as a kind of
its own, the weakest, trodden grass more than earth, its rim ragged and fraying a couple of diamonds past it; its two
streets, and the diamond where each leaves the square, as a **road**, a kind paler than a path and stronger than a
yard's ring; each building's base as a footprint with a little of a ring about it; and a **lane** from every building
its street does not pass to the nearest street, the fewest diamonds round the other buildings, as a path
(`sprites/ground/settlementGround.ts`). Nothing is worn on water or a river. To the paths between buildings the whole
settlement is one yard, its square's front corner its foot. The kinds are renumbered weakest first - a settlement's
ground, a path, a ruin's ring, a ring, a road, a ruin's footprint, a footprint - so the stronger is drawn where two
meet; the roads between settlements (decision record 0115) are worn as the same road kind, from the pieces of the
stands' `roads` layer the page holds, along each piece's line at its grade's width and never less than three-quarters
of a diamond either side, so a line at any angle across the lattice wears every diamond it crosses; only on land, and
only on revealed ground (`sprites/ground/roads.ts`). How much of a
settlement's ground is grass is a lever in the Structures section, beside the earth's colour. See
`docs/plans/settlements-and-roads.md`.

## Amendment, 2026-10-21: the wayside, kept clear and not drawn

Adam found the roads worn a diamond at a time jagged. A road is now drawn as a smooth band over the ground by a layer of
its own (`sprites/roads/`, decision record 0115 as amended), and the worked ground only keeps its ground clear: a kind
weaker than every other, the **wayside**, under a road and a little either side of it for its roadside, which the
ground's shader draws nothing for, but on which no tree grows. Every other kind moves up one; `road` is a settlement's
street alone, straight along the lattice and so never jagged.
