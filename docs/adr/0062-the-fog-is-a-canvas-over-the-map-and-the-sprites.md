# 0062. The fog of war is a canvas of its own, over the map and the sprites

- Status: accepted, its placement superseded by 0063
- Date: 2026-09-26
- Builds on 0061, which says what a house sees and where that is worked out
- Superseded in part 2026-09-26: the fog is no longer a canvas over every sprite but a layer inside the sprite
  canvas, between the world and the signs for the things in it, because it covered the icons. The distance
  field, the camera and the look below stand. See decision record 0063.
- Amended 2026-09-26: the trees in unknown ground are no longer grown at all, as the consequences below said
  they would not be; step 5 of `docs/plans/fog-of-war.md`.

## Context

Decision 0061 gives the page a house's vision points: circles in kilometres with a start and an end. The page
has to draw three levels from them - a dark haze over unknown ground, revealed ground faded and colourless,
and nothing at all over vision - and draw them over everything that stands on the ground as well as the
ground, because a castle or a wood in unknown ground is under the haze too.

What is on the screen is two canvases. MapLibre draws the terrain, the coast and the areas into one; Pixi draws
the castles, the people and the scenery into another above it, following the map's camera by the arithmetic in
`cameraMath.ts` (0005, 0060). There are three places the fog could be drawn, and they differ in what ends up
under it.

## Decision

**The fog is a third canvas, lying over the other two**, in the same room as them so that it is scaled with the
map when the camera pulls back past it. One WebGL2 program and one triangle that covers the canvas, so a
fragment shader runs once a pixel.

- **It follows the map's camera the way the sprites do**: it draws when the map has drawn, reading the camera
  the map just used, and it asks the sprites' own projection backwards to find which piece of ground each
  pixel lies on - a turn, an unsquash and a scale, because a tipped camera is parallel. So the fog lies on its
  ground at every zoom and tilt as a castle stands on its own, and nothing about it is worked out twice.
- **What it reads is a distance field**: for every texel, how far that piece of ground is from the edge of what
  the house has revealed and from the edge of what it has in vision, in world units and negative inside. It
  is worked out in the browser once for each change to the vision points, one texel a world unit around the
  circles and a margin, and never while the camera moves. A distance interpolates, where a yes-or-no smears,
  so one small texture gives an edge that is a world unit and a half soft close in and a pixel sharp far out,
  and lets it wander a little so a circle reads as the limit of sight rather than a compass line.
- **The haze and the wash are drawn over what is there, not instead of it**: the haze is dark and see-through,
  so the coast and the lie of the land show through it, and it thickens and thins a little in patches that go
  flat far out where they would be smaller than a few pixels. Revealed ground is washed with a middling grey
  at half strength, which is the stand-in Adam allowed for taking the colour out; the parchment of the
  interface was tried first and all but vanished over farmland, which is pale already. Taking the colour out
  properly is step 6 of the plan.
- **The switch stops the drawing**, and nothing is drawn until the gateway has said what the house sees, so a
  page still connecting is not a world under haze for a moment.

## Consequences

Everything on the ground is under the fog alike - terrain, areas, holdings, scenery, castles and people -
with no change to how any of them is drawn. **The seats a founding choice offers are under it too**: a player
with no house sees nothing, so the whole world is hazed and the three pennants show dimmed through it. That is
decision 0061's consequence, and this is where it becomes visible.

A third WebGL context on the page. Browsers allow a dozen or so before they start dropping the oldest, and the
page had two.

It costs a tenth of a millisecond of the main thread a frame, measured over sixty redraws at zoom 9, and a
fragment shader over the canvas on the graphics card, which is two texture reads and a few noise lookups a
pixel. The distance field costs a few milliseconds when a vision point opens or closes, growing with the number
of points a house has ever had; 0061 already names folding the ended ones together as the answer when it
matters.

The trees in unknown ground are still grown and drawn, under the haze. Growing none there is step 5, and
keeping their stands from the page at all is step 8.

## Alternatives considered

**A MapLibre custom layer**, drawn in the map's own GL context after the terrain. The natural home for a shader
over the map, and it can even read the terrain drawn so far to take its colour out. It loses because it draws
under the Pixi canvas, so the castles, the people and the trees would stand unfogged in unknown ground.

**Painting the fog into the painted tiles**, in the painters that already visit every pixel. It would cost
nothing a frame, and it makes the tiles one player's rather than the world's: every tile repainted whenever a
key figure moves, the flat renderer and the sprites still unfogged, and no way to make the haze move.

**A CSS backdrop filter with a mask**, taking the colour out of whatever lies beneath. It would be true
colourlessness in a line of CSS, and the mask would have to follow the camera every frame, which the browser
has no way to feed from a canvas short of encoding an image a frame.
