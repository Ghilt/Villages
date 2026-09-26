# Fog of war

**What belongs here:** how fog of war gets built - what the server works out, what crosses the wire, what the
page draws and holds back, and the order it all gets built in. **What does not:** why it is shaped this way,
which is decision record 0061; what the mechanic is for, which is `MECHANICS.md`; the words, which are
`GLOSSARY.md`. When a part of it is decided, that part becomes a decision record and leaves.

---

## The problem, in one paragraph

Every player is shown every house and every person in the cells their camera holds, and the scenery of the
whole world is a public file. Adam asked for a house to see the map at three levels - vision, revealed and
unknown - with the fog limiting what a player learns about a place and nothing else, in a world of ten
thousand players, and ideally with the scenery of unknown ground kept back by the server. Most of the work is
not the drawing. It is that the server has to know, for every house, what it can see, and ask that before it
sends anything.

## What a house sees from

A **vision point** is a place, a radius in kilometres on the ground, and a span of world-time, `since` to
`until`. Vision is the points covering today, revealed is every point there has been, unknown is the rest.

| What gives it | From | Until | Recorded as |
|---|---|---|---|
| the seat | the founding | the house ends, which nothing does yet | worked out from `house.founded` |
| a key figure standing on the map | the later of their arriving and the house taking them in | their next move, leaving the map, dying, or being lost to the house | worked out from `character.moved`, `character.leftTheMap`, `character.died` and the two key figure ties |
| vision given outright | the day it is given | a day it is given for, or being taken back | its own events, step 3 |

Every radius is 34 km for now, a circle as big as Mallorca.

## What each level lets through

| | the ground | scenery | buildings | people |
|---|---|---|---|---|
| vision | yes | yes | yes | yes |
| revealed | yes | yes | yes, as they are now | no |
| unknown | yes | no | significance 80 and up | significance 80 and up |

A player's own house and own key figures are always theirs to see: every one of them is a vision point.

## The steps, one commit each

1. **The server works out the fog.** Done. `SightProjection` folds every house's vision points from the feed;
   the gateway sends them to the player as `yourSight` on hello and on every change; the debug log says what
   gives vision. Wire version 9.
2. **The fog is drawn.** Done. A canvas of its own over the map and the sprites, drawn from `yourSight`
   through the sprites' own projection backwards: a dark haze over unknown ground, grey at half strength
   over revealed ground, nothing over vision, all read off a distance field worked out once for each change
   to the vision points. The switch is in the Debug map section, in words, on at every load; off only stops
   the drawing, because nothing is held back yet. Decision record 0062.
3. **Vision given outright.** A debug button that gives vision where the camera is looking and one that takes
   it away, each a real command, recorded as events of their own on the house's stream with the place, the
   circle and the span. Which section they go in, and whether they are words, is asked before they are drawn.
4. **The fog holds back.** The gateway sends a house only the buildings on its revealed ground and only the
   people in its vision, answers every held cell again when the sight changes, and tells a player whose sight
   moved. The switch now tells the gateway too, as `seeAll` does. Wire version 10.
5. **No trees in unknown ground.** The scatter grows nothing on ground the house has not revealed, so the
   haze has no wood standing in it.
6. **Colourless revealed ground.** The wash becomes the colour taken out, with a blend mode over the map and the
   sprites. If it does not composite over the two canvases, or costs too much, the wash stays, which Adam
   allowed.
7. **The haze undulates**, slowly, only zoomed in and only while unknown ground is on the screen, at a frame
   rate a slow movement needs rather than every frame.
8. **The stands come from the server.** The sprite map's stand files leave the public folder, and the gateway
   sends a page only the stands touching ground its house has revealed. The biome raster stays public: it says
   what kind of country a region is, which the terrain under the haze already says. This is also the channel
   settlements and ruins will come through, when they are a layer of the sprite map.
9. **Vision that runs out.** A vision point given for a span ends when its span does, with nothing happening
   to say so: one wake-up a point, as a pledge waits out its span (0053).

The order is a suggestion, as every order here is. Every later step stands on step 1 and on little else:
four is only worth looking at once two draws the fog, eight needs four, and nine needs three.
