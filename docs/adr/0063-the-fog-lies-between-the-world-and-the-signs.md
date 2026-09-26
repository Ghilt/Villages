# 0063. The fog of war lies between the world and the signs for the things in it

- Status: accepted
- Date: 2026-09-26
- Supersedes the placement half of 0062, which drew the fog as a canvas of its own over the map and every
  sprite; its distance field, its camera and its look stand

## Context

Decision 0062 drew the fog over everything on the screen, the castles and the people included, so that a
thing in unknown ground would be under the haze with the ground it stands on. Adam zoomed out, and turned on
*seeing everything*, and saw what that also meant: his own house's icon, standing in the middle of its own
vision, was half hazed, because far out a twenty-two-pixel icon is wider than the circle of ground it stands
in. His words set the rule:

> Sprites in the vision area should always be shown above the fog of war layer. Sprites in the revealed
> layer is more tricky. It depends, if the sprite should be visible at far zooms, then it shouldnt be
> covered. [...] if a sprite is shown at all z7 to z1 then it should not be covered up by these fog of war
> layers. the fog of war should only cover 'the world' not representations of important things when zoomed
> out

Decision 0051 had already drawn that line through everything on the map without naming it for the fog: a
thing has a **ground form**, which is what it is and part of the world, and an **icon**, which is the sign for
it and is what is drawn far out.

## Decision

**The fog is a layer inside the sprite canvas, drawn between the world and the signs.** From the bottom:

1. the scenery;
2. the ground forms of whatever stands **outside** vision;
3. the fog;
4. the ring under the selected mark;
5. every **icon**, the seats a choice offers, and the ground forms of whatever stands **in** vision.

The canvas lies over the map, so what the fog layer draws covers the terrain too. One rule decides which side
a form is on, `overTheFog` in `sprites/fogLayering.ts`: **an icon is always over the fog, because it is a sign
and not the world, and a ground form is over it in vision and under it anywhere else.** Whether a mark stands
in vision is asked of the circles of the house's vision points, by the arithmetic the fog is drawn with, when
the mark or the house's vision changes and never in a frame; a mark that changes side is moved between two
containers rather than made again.

The fog itself is what 0062 made it - the same shader and the same distance field, following the camera
through the sprites' projection backwards - drawn now by Pixi as one mesh, with the field as a half-float
texture, which filters where a full-float one may not.

**What significance should do is not decided.** Adam's rule for revealed ground is that a thing seen from far
out is not covered, and a thing's significance is what says how far out it is seen. Until significance is
worked out properly, whether a form is an icon stands in for it: a house's castle on revealed ground close in
is under the wash, and its icon far out is not.

## Consequences

The icon of a house in vision is never hazed however far back the camera is, and neither are the seats a
founding choice offers, which a player with no house sees standing over a world that is all unknown.

Until the gateway holds back what a house cannot see - step 4 of the plan - every house it sends is drawn,
and with *seeing everything* on, the icons of houses in unknown ground stand over the haze. That is the rule
working, and step 4 is what stops them being sent.

**The scenery stays under the fog wherever it stands.** A tree just inside the edge of vision stands up out of
its ground on a tipped camera, and its crown can reach over ground the haze covers; it is a band a crown wide
at the edge of a circle hundreds of pixels across. Routing the scenery by vision would mend it and break
something worse, below.

The fog no longer needs a canvas and a WebGL context of its own, and it is drawn in the sprites' own frame, so
there is one clock rather than two.

Building it turned up an older fault. A mark handed to the renderer before its canvas was ready was kept with no
pictures, because there were no textures to draw it with, and nothing ever gave it them; the seats a founding
choice offers arrive with the first frames and so were never drawn. They are dressed now when the textures are
made.

## Alternatives considered

**Keep the fog's own canvas and put a second sprite canvas over it for the signs.** It keeps 0062 as it was,
and it means two Pixi canvases and two WebGL contexts, textures made twice, and a click tested against two
renderers.

**A fog canvas under the sprites, over the terrain only, with the sprites fogged one by one.** A castle can be
greyed by a tint, but a tint multiplies and cannot take the colour out of a green tree, so the scenery would
want a filter of its own, and there would be two implementations of the fog to keep alike.

**Route the scenery by vision as well, the trees in vision over the fog.** It mends the band at the edge, and
it breaks the order things are drawn in there: a tree over the fog is drawn after every tree under it, so at
the near edge of a circle a tree farther away would be drawn over one nearer, which is the fault the scenery
is sorted to prevent. Worth revisiting if the band ever shows.
