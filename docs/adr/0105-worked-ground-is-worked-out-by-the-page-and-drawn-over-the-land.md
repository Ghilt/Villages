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
