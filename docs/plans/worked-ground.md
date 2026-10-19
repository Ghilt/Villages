# Worked ground

**What belongs here:** how the ground people have worn bare comes to be drawn on the map: a yard under every
building and paths between near ones. It covers where each comes from, how it is drawn and keeps to the fog, the rules
that must hold, and the order it is built in. **What does not:** what it looks like in plain words, which is
`LOOK-AND-FEEL.md`; the words, which are `GLOSSARY.md`; the levers as they are in the running program, which are
`RUNNING.md`; roads a house builds, which would be a mechanic in `MECHANICS.md`. When a part of it is decided, that
part becomes a decision record and leaves.

Planned on 2026-10-18 from Adam's request: the buildings on the map do not fit in, and in many games there is a ground
made under the house; that should be here too, it must keep to the fog as the buildings do, and the same retexturing
should later carry little paths between buildings, to bring life to the landscape.

## What Adam settled

| Question | Answer |
|---|---|
| Where the paths come from | The page, between near buildings: any two closer than a reach, whoever holds them |
| How a yard's edge looks | On the diamonds: whole diamonds of the ground's grid, a ragged ring, edges wandering |
| Where its levers go | The debug panel's Structures section |
| A shadow under every building | Yes, as this plan's last step |

---

## The problem, in one paragraph

A structure on the map is one picture, a Pixi sprite hung from the bottom middle of its box on the raw place the server
sent, and scaled by its height alone (`MarksLayer.ts`, `markEntry.ts`). The gouache pictures are painted seen from 45
degrees above and turned about 26 degrees to sit on the diamond lattice, with no ground or shadow of their own. But
nothing on the map gives them that ground. The front corner of a picture's base is not where the building's place is.
No ground under it differs from the meadow or the forest round it. The trees grow through it, and because the marks
are drawn above the whole scenery, the building is drawn over every tree whatever stands in front of it. It reads as a
picture laid on the map, not a building standing in the land.

## Worked ground keeps to the fog because the page works it out

The gateway's `Fog` already decides which structures a page holds and in which face (decision record 0061). In vision
the page holds everything. On revealed ground it holds a structure as it was on the day the fog hid it, and not at
all if it was raised there since. On unknown ground it holds only what is significant enough to be seen through the
fog, and its own.

Worked ground is worked out on the page from the structures it holds and its sight, and nothing else. It is never
stored and never sent. So it shows, hides and keeps its last-seen face exactly as the buildings do, with no change to
the server, the protocol or the event store. This is the road decision record 0104 took for a ruined city, laid out by
the page from a record the fog had already filtered.

What the page draws on revealed ground loses its colour there, because the layer sits in the sprite canvas's `world`
container, which the fog's `uncolour` filter greys. What it draws on unknown ground lies under the haze, as the
buildings do.

## Where it is drawn: in the sprite canvas, over the land's motion

The worked-ground layer goes in the `world` container of `PixiSpriteRenderer.ts`, immediately above the land's motion
and below the critters' ground, the scenery's shadows, the trees and the marks.

- It is under the fog's haze and the greying, like everything in `world`.
- It covers the grass tufts, the crops and the heath that move on it, without any change to the land's layer.
- The trees' shadows fall across it, and the critters run over it.

Two other places were weighed. A MapLibre custom layer, like the relief and the water, would have the relief shade it.
But the land's motion is drawn over the whole map canvas, so tufts would grow through the dirt unless every motion's
shader learnt where it was. Painting it into the painterly tiles would match the paint exactly. But those tiles are
cached by address, painted once for every player, and MapLibre has no way to repaint one tile when one building is
seen.

The cost is that the relief does not shade the yard. A yard is a few diamonds across, and its colour lets a little of
the painted ground through, so this is a small loss.

## How: one pass over a mask of the diamonds

Finding the pixels under a building is done on the graphics card, by the same kind of full-screen pass that draws
the land's motion (`sprites/land/LandLayer.ts`). For each pixel of the screen it goes:

1. To the point of world space it lands on, through the camera's tilt: `groundUnder`, the same GLSL the land uses.
   That moves to `shaders/` so the two layers share one copy.
2. To the diamond of the ground's lattice that point is in: `GROUND_LATTICE`, turned 26 degrees and one world unit
   across (`packages/world/src/lattice.ts`). The point is first moved a little by a noise, so an edge between worked
   and unworked diamonds wanders as the painter's boundaries do rather than running ruled along the grid.
3. To one byte of the **worked-ground mask**: one texel per diamond, laid out in the lattice's own coordinates, saying
   what that diamond is. The values are nothing, a building's footprint, a yard's ring, a ruin's yard, and a path.
   Room is left for a road and an old street later.

Where the byte says nothing, the pass discards the pixel at once. Where it says something, the pass paints worn earth:
a colour of its kind, a grain of world-space noise, and a tint that varies a little from diamond to diamond, all
fading with the buildings' ground form from zoom 7.5 (`twoForms.ts`).

The mask is built on the CPU, from the yards and paths in view, into a window of diamonds sized to the view and a
margin. It is uploaded as one single-channel texture.

- It is rebuilt when the structures the page holds change, when its sight changes, or when the camera leaves the
  window, and never once a frame.
- A yard is a few dozen diamonds and a path a few dozen more, so a rebuild is a small loop and an upload.
- A frame costs one triangle and one or two texture reads per pixel, however many buildings there are.

## A yard

Every structure the page draws has a yard, worked out from three things.

- **Its foot.** This is where the front corner of the picture's painted base is, measured from the picture when it is
  cut, as a ruin piece's foot already is (`footOf`, `packages/world/src/art.ts`). It is stored in the structures'
  atlas beside each frame's pennant.
  - Because of the 26-degree turn, a square base seen from the south has its front corner about a sixth of its width
    right of its middle. Several pictures show it.
  - The sprite is hung from its foot rather than from its box's bottom middle.
  - The foot is drawn on the lattice corner nearest the structure's place, so building and diamonds meet exactly.
  - This only changes the drawing: the server's place is untouched, and the snap is under a world unit.
- **Its footprint.** This is a square of diamonds whose front corner is the foot, its side a new number per level of
  each type: `footprint` in `world/catalogues/structures.json`, beside `groundHeight`. The page reads it; the game
  server has no use for it.
  - Its first values come from each picture's width and the turn: a square of side s is about 1.34 s wide on screen.
  - Adam tunes them by eye on `/admin/inspect-structures`, where every building stands on its footprint's diamonds.
- **Its ring.** One or two diamonds round the footprint, some kept and some not, fewer the further out. A hash of the
  structure's id and the diamond decides, so every page draws the same ragged edge.

**A ruin's yard** is the same footprint with a thinner, broken ring and a mask value of its own, drawn fainter: ground
going back to grass.

## Trees are cleared from it

The scenery layer already takes a test of where it may grow, `setGround`, which the fog uses to keep trees off
unknown ground. The renderer gives it that test and "not on worked ground" together. Every tree standing on a worked
diamond is left out. A tree behind the yard still stands, and is drawn behind the building as now.

`SceneryLayer.ts` itself does not change. It is over its size ceiling and may only get shorter (decision record 0072).

## Paths

Two buildings are joined by a path when they are nearer each other than a **reach**, a lever, whoever holds them, a
structure's ruin included.

- **The rule is the pair's alone.** Learning of a third building never adds, moves or takes away a path already seen.
  A rule like "each to its nearest" would re-route a path the moment the fog let a nearer building through.
- **The course** is walked over the diamonds from one foot to the other: the cheapest way across the ground between
  them, open water forbidden, as the zoom-7 class tiles have it. It wanders by a seed taken from the pair's two ids.
  Where there is no way round water within twice the reach, there is no path.
- **It keeps to the fog**: a path is drawn only on revealed ground, and only while the page holds both its ends. A
  path to a significant building on unknown ground stops where the revealed ground stops.

A road network the server lays over the whole world, or roads a house builds as a mechanic, can later replace where
the paths come from. The mask and the layer that draws them stay.

## A shadow under every building

The ruin pieces each have a shadow cut with them, a cast shadow and a pool at the foot (`shadowOf`,
`packages/world/src/art.ts`), drawn in a layer of their own under the scenery. The structures get the same:
- cut by `world:structures` into their atlas;
- drawn on the worked ground under the building, the light from the right as for everything else.

## The rules that must hold

No events are added and nothing is stored. Every rule holds at the instant the mask is built, by pure functions and
their tests. None is put right afterwards by a listener.

- **The same for every player who knows the same**: the mask is a pure function of the structures the page holds and
  its sight. Every random choice is seeded by structure ids and diamonds. A test builds it twice from the same input,
  and once from the input in another order.
- **A yard is drawn wherever and whenever its building is drawn, in the face it was sent in.** It has no other source.
  The gateway's `Fog` holds which structures and which faces, as today. A test holds that a set without a structure
  has no worked ground there.
- **A path only on revealed ground, and only while both ends are held**: the mask builder asks the fog's field
  (`revealedAt`, `fog/fogField.ts`) of every path diamond, and is tested with one end's ground unknown. With the fog
  switched off, every diamond is revealed.
- **A path's course depends only on its two ends and the ground under it**: a test adds a third building beside a
  pair and holds the pair's path diamond for diamond.
- **No tree on worked ground**: a test of the composed test of where scenery may grow.

## Names

Settled with the plan, for the glossary:

| Name | What it means |
|---|---|
| **Worked ground** | The ground people have worn bare, drawn by the page under and between buildings: a **Yard** and the **Path**s |
| **Yard** | The worked ground a building stands in: its **Footprint** and a ragged ring round it |
| **Footprint** | The square of diamonds a building's base covers, its front corner the building's **Foot**; a side per level, `footprint` in the structures' catalogue |
| **Path** | Worked ground joining two buildings nearer each other than the paths' reach, walked over the diamonds between their feet |
| **Foot** | Where a picture stands on the ground: for a building, the front corner of its painted base; measured when the picture is cut |

## Risks

- **The pictures' bases are painted by eye**, not to the lattice, so a footprint square may sit a little off a base.
  The footprint is tuned per type on the structures page, and the ring hides a diamond's difference.
- **Hanging a building from its foot moves it**, up to a sixth of its width to the left and less than a world unit to
  the nearest corner. The pennant, the ring and what a click lands on move with it, because they are worked out from
  the sprite.
- **A full-screen pass at the `low` quality level**: if the frame time on `/admin/inspect-performance` shows its
  cost, it follows the land's half-resolution rule.
- **The game server reads the structures' catalogue too**: step 3 checks that a field it does not know is passed over,
  not refused.
- **Another session is working in `sprites/land/`**: step 5's move of the shared GLSL out of `landShader.ts` reads
  that session's note first.
- **`PixiSpriteRenderer.ts` is at 399 lines** against its ceiling of 400: step 5 first moves the assembly of the layer
  stack into a module of its own, a refactor of its own.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **This plan.** The names above in the glossary; the ROADMAP's entry. | Read the plan. |
| 2 | **Every building stands on its foot.** `world:structures` measures each picture's foot into the atlas; the marks hang a structure from it, drawn on the nearest lattice corner; the Pictures page marks it. | 👀 At zoom 10, a castle's front corner sits on its place, and it does not jump as you pan. 👀 `/admin/inspect-pictures`: each building's foot is marked on its front corner. |
| 3 | **A footprint for every type.** `footprint` per level in `structures.json`, read by the page's catalogue and drawn as diamonds under each picture on the structures page. | 👀 `/admin/inspect-structures`: each building stands on its footprint's diamonds, about as wide as its base. |
| 4 | **The worked-ground mask.** `sprites/ground/workedMask.ts`, pure, with the tests of the first two rules; the yards and their rings in a window of diamonds; the count said with `note()`. | The checks; 👀 the debug panel says how many diamonds are worked under how many buildings. |
| 5 | **A yard under every building on the map.** The layer stack's assembly moved out of the renderer first; the shared GLSL to `shaders/`; `groundShader.ts` and `GroundLayer.ts` in `world` over the land; levers in the Structures section; a decision record, LOOK-AND-FEEL, RUNNING. | 👀 Every building stands in a worn yard on the diamonds, no tufts moving on it, at zoom 8 to 10. 👀 Switched to a house that has only revealed a rival's castle, its yard is greyed with it; to one that never saw it, there is nothing there. |
| 6 | **Trees cleared from worked ground.** The test of where scenery grows composed in the renderer, and tested. | 👀 A building raised in a forest from the debug panel stands in a clearing, and the trees behind it stay. |
| 7 | **Paths between near buildings.** The rule and the course, pure and tested with the last three rules; a mask value and a look of their own; the reach a lever. | 👀 Two buildings near each other are joined by a path that wanders and keeps off water. 👀 A path to a building on unknown ground stops at the edge of the revealed ground. |
| 8 | **A shadow under every building.** `world:structures` cuts each building's shadow as the ruin pieces' are, and it is drawn on the worked ground under it. | 👀 Every building casts a soft shadow to its left, the light being from the right. |

Then it is brought to main.

## Not in this plan

- A square of a building standing in its yard on `/admin/inspect-renders`, planned with step 5 and left out of it:
  that page draws the land, the scenery and the critters but no marks, so a building there is a step of its own.

- The old streets of a ruined city drawn as worked ground, though the mask has room for them.
- Roads a house builds, which would be a mechanic with events of its own, and a road network the server lays over the
  whole world.
- A yard's colour following the ground it is on: packed sand in a desert, trodden snow on the ice.
- The relief shading worked ground.
- Buildings sorted in depth among the trees, which the clearing makes matter much less.
