# 0051. A thing on the map has two forms: what it is, and the sign for it

- Status: accepted
- Date: 2026-09-20
- Supersedes the level-of-detail half of 0038, and leaves the rest of it standing

## Context

A house was drawn by a scheme of hard zoom thresholds. Below zoom 3 nothing; from 3 to 8 a dot of seven
pixels, centred on its place; from 8 up a castle of twenty-two pixels, standing with its foot on its
place and growing to forty-six by zoom twelve.

Three things were wrong with it, and Adam met all three before anyone looked at the code.

**It stepped.** At zoom 8.000 exactly, a mark went from a seven-pixel circle centred on its seat to a
twenty-two-pixel castle hanging from its bottom edge: three times the size and eleven pixels of
movement, in one frame, with no fade. The comparison was a hard `<`, so a trackpad resting near the
threshold flipped the texture, the anchor and the scale on alternating frames.

**It did not keep its size against the ground.** Adam put it plainly: the marks "don't scale exactly
with the zoom level so compared to the pixels underneath they change size". They did not, and could
not. Between zoom 8 and 12 the ramp grew a marker 2.1 times while the terrain under it grew 16 times,
and past the ramp the marker was a fixed number of screen pixels while the ground kept doubling. Every
zoom level was a different relationship between a house and the land it stands on.

**The ramp did not even do what it was for.** `MARKER_HEIGHT` completed at zoom 12; the camera stops at
10. The declared forty-six pixels had never been drawn. Two of its tests asserted at zooms 11 and 12.

Then Adam named the answer, which was better than continuing to patch the thresholds:

> maybe everything should be fixed to the ground -> and then things have icons -> two ways to represent
> a thing on the map. one close up for flavor and fluff, and more generic icons further out for
> legibility

One more thing is true and constrains it. World space is 32768 units across and the camera stops at zoom
10, where one unit is sixteen screen pixels and about 1.2 kilometres of ground (0030). Nothing built by
people has a true size here: a surveyed castle is about a tenth of a unit, which is 1.4 pixels at the
closest the camera comes.

## Decision

**A thing on the map has up to two forms.** Its **ground form** is what the thing is, given a height in
world units, so it grows with the terrain and holds its size against the ground at every zoom. Its
**icon** is what the thing means, given a height in screen pixels, the same size whatever the camera is
doing. They trade places by crossfading where the ground form has grown to the icon's size.

- `screenHeight = groundHeight × 2 ** (zoom − 6)`, six being the zoom at which one world unit is one
  screen pixel. `pixelsPerWorldUnit` in `sprites/cameraMath.ts` is the one place that arithmetic lives.
- The crossover is at `6 + log2(iconHeight / groundHeight)` — where the two sizes are equal.
  **A ground height is a map convention chosen to put the crossover at a useful zoom, not a
  measurement**, and saying otherwise would be a lie about a world with 1.2-kilometre pixels. A house
  is four world units and twenty-two pixels, so it crosses at 8.46 and stands sixty-four pixels at the
  closest zoom.
- The two forms of one thing **share one anchor**, and it is the point that means the same in both: the
  foot. This is a rule, not a convention. A crossfade between two shapes hung from different places
  trades a jump in size for a jump in position, and the eye catches translation far harder than scale.
- **The trade is in time, not in zoom.** The camera decides *which* form, hard, at the crossover and
  with a little stickiness either side. How long the change takes is a fifth of a second of real time.
  Both forms exist from the moment the mark does and are never created or destroyed by the camera;
  only their alpha moves, and the two always sum to one.
- **One form answers a click**, whichever is more of the two, so there is never an invisible target.
- **Nothing pops.** Arriving and going are their own fade, shorter than the trade between forms
  because arriving is a smaller event than changing into something else. A mark the gateway has just
  sent fades up; one that has gone fades out and is only then let go of; one crossing the distance
  floor does the same. It multiplies with the trade rather than waiting for it, so a house can arrive
  at a zoom that also wants it to change form.
- **No single frame may finish a change.** The overlay draws when the map draws and a still map draws
  nothing, so the gap since the last frame is often seconds. Left uncapped, a house arriving on a
  still map would be handed the whole of its fade in one step - a pop, by a different route. A frame
  advances a change by at most fifty milliseconds however long it really was.
- **Whether a thing is drawn at all is a separate question**, asked by `isDrawn` and not by the fade. It
  is about distance rather than size, which is what lets 0038's rule survive intact: a spared mark is
  drawn where the rest are nothing, and is no larger for being spared.

A house has both forms. A candidate has an icon only — it is a question the world is asking rather than
a thing standing in the world, so it is the same size wherever the camera is. Scenery, when it comes,
will have a ground form only.

The dot is gone. Below the crossover a house is its icon: the same castle said in three strokes, because
the detailed one is unreadable at twenty-two pixels — its crenellations come to two pixels and its
outline eats its fill.

### Why the trade is in time and not in zoom

It was in zoom first, fading across a band either side of the crossover, and Adam threw it out on
sight:

> the crossfade, can we apply that as a time cross fade rather than a zoom level crossfade? it looks
> bad to be on an inbetween zoom standing in the middle of the crossfade.

He is right, and the fault is one that only shows up when you stop. **A zoom is somewhere you can
rest.** A fade spread over a band of zoom therefore has resting states inside itself, and standing in
one left two half-drawn castles on the screen for as long as you cared to stand there. A transition
should be something that finishes.

So the zoom decides which form and time decides how long the change takes. Every zoom the camera can
stop at now shows exactly one form, and there is a test that says so for every hundredth of a zoom
level between the floor and the closest the camera comes.

The cost is that the overlay animates again, which 0022's arrangement had just been rid of. It is
bounded: the renderer asks for frames only while a trade is actually running, and stops the moment
nothing is between its two forms, so a still map with a settled mark still draws nothing at all.

## Consequences

A house now sits on its ground the way the terrain does, and coming close finds a castle rather than a
bigger dot. The step at zoom 8 is gone, and with it the flip a resting trackpad caused. `DETAIL_FROM_ZOOM`,
`detailForZoom`, `detailForMark`, `markerHeightForZoom`, `DOT_RADIUS` and `SpriteDetail` are all gone;
`spriteDetail.ts` is replaced by `twoForms.ts`, because a file named for a vocabulary that no longer
exists is a file nobody can read.

Two costs, knowingly.

**A second drawing per kind.** A thing with both forms needs both drawn, and they are different pictures
rather than one picture at two sizes. That is the point — it is what "flavour close up, legibility far
out" means — but it is twice the art, and this commit draws the icon crudely on purpose, pending the
nine-castles experiment.

**Two sprites per mark, always.** At a few hundred houses that is free and it is what makes the fade
free of churn. It would not be free at twenty thousand, which is why scenery draws through a particle
container instead and has one form.

One thing we are living with and watching: below the crossover every house is a twenty-two-pixel mark,
and at zoom 4 with *seeing everything* on, a continent of them will be mush. That is the aggregation
problem 0007 already owns and Phase 2 already has, and the icon is one number and one drawing if it
turns out to want to be smaller.

## Alternatives considered

**Fade across a band of zoom.** What was built first, and what Adam rejected: a zoom is somewhere you
can rest, so the fade had resting states in the middle of itself. See above.

**Keep the thresholds and add a crossfade.** The smallest change, and it fixes the step but not the
size: marks would still drift against the terrain at every zoom. It loses to the thing Adam actually
asked for.

**Anchor everything to the ground, with a floor and a ceiling in screen pixels.** Honest until it is
clamped, and then quietly not. It also leaves no room for a *different drawing* far out, which is the
better half of the idea.

**Keep the dot as a third form.** Three forms would read better on a continent covered in houses. It
loses because a rule with an exception in it is not a rule, and because the gateway does not send houses
below about zoom 7.5 anyway. Revisit when aggregates arrive: if the icon is mush at low zoom and
aggregates are still far off, a smaller icon is the cheaper answer than a third form.

**Size the ground form from the real world.** Refused as a lie: a surveyed castle is 1.4 pixels at the
closest zoom this camera reaches. We would have been choosing a number to make the crossover land
somewhere useful either way, and pretending otherwise would have put a false claim in the code.

## Amendment, 2026-10-15: structures stand twice as tall

Adam asked for buildings twice as big at the closest zoom. Every `groundHeight` in `world/structures.json` is doubled,
so a castle of the first level is eight units and stands a hundred and twenty-eight pixels at zoom 10. A structure's
sign is still `SIGN_PER_UNIT` pixels a unit, so it doubles too, to forty-four pixels for that castle, and the
crossover stays at 8.46: the zoom where the building stops shrinking is unmoved, and that is where it becomes its
mark. The figures above, four units and sixty-four pixels, are the house's of 2026-09-20.

## Amendment, 2026-10-15: a structure's icon is its type's pin

Until now a structure's icon was its own picture at the size of a word, so the trade at 8.46 changed nothing that
could be seen. Its icon is now its type's mark, a pin cut from `world/sprites/marks/structures/` into the structures'
atlas, one a type and the ruin's, the same in every culture. The pin's point is the structure's place, so both forms
still share the foot. The holder's pennant flies from the form that is more of the two: the building's tallest point
close in, the pin's head far out.

## Amendment, 2026-10-15: one zoom where things become marks, and only some do

The crossover is no longer where each kind's two sizes happen to meet. It is one named zoom, `BECOMES_A_MARK_AT`
(8.46) in `twoForms.ts`, for everything: further in, every sprite stands in scale with the map; from there out, a thing
that has a mark is its mark, as tall as it stood at that zoom, so the size still never jumps. A thing with no mark goes
on shrinking until everything fades at 7.25 (0096). Only a structure the player's house controls and one of its people have a
mark, on Adam's word of 2026-10-15, and a mark never fades for distance: it is only gathered into crowds (0096). A person, who crossed at 9.4, crosses with everything else, and stands three units
tall so that their bust is sixteen pixels there, as it was.

## Amendment, 2026-10-15: the change-over is 7.5, and a mark is its own size

`BECOMES_A_MARK_AT` is 7.5, the one zoom the whole map changes over at (0096), and a thing with no mark simply has
nothing to show past it. A mark is `MARK_PIXELS_PER_UNIT` (5.5) pixels for each unit its thing stands, as the sign
was before: a castle's pin 44 pixels where its sprite is 22 at 7.5. The rule that the two forms are the same size at
the crossover is given up, because a sprite and a mark are never on the screen together.
