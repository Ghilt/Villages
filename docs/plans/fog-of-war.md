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

   Then Adam zoomed out and found the fog over the icons, his own house's included. It is a layer inside the
   sprite canvas now, between the world and the signs: every icon, the seats a choice offers and anything
   standing in vision over it, the scenery and whatever stands outside vision under it. Decision record 0063.
3. **Vision given outright.** Done. `give vision here` and, for each vision given, `take it away`, in words
   under the fog switch in the Debug map section, as Adam chose. `GiveVision` and `TakeVision` record
   `house.gainedVision` with the place and the size, and `house.lostVision`; the sight projection reads them
   straight off the events. Open-ended: the span a vision is given for is step 9. Wire version 10.
4. **The fog holds back.** Done. The gateway asks `Fog`, the table above in code, of everything before it
   goes: a snapshot carries the houses on revealed ground and the people in vision, the player's own
   wherever they are, and anything of significance 80 from anywhere. The read models ask it before a cell's
   cap, and what it refuses is not counted as omitted, because how much is hidden is itself something learnt.
   The fan-out asks it of every delta, so somebody walking into vision arrives and walking out of it is gone.
   A change to the house's sight answers every held cell again, after `yourSight`. Whether a place is inside
   a point is `Reach`, the map's circle, computed identically at both ends against
   `contracts/fixtures/reach.json`. The switch tells the gateway as `fogOfWar`, on until it says otherwise.
   Wire version 11.

   Then Adam found the circles too sharp and drew what he wanted: surface tension, circles close together
   bleeding into each other over short distances. Vision and revealed ground are each closed by a ball of
   40 km now, answered exactly by `Coverage` at both ends and drawn from the field through a distance
   transform, and the server holds back by the same shape; `yourSight` carries the tension. Wire version 12,
   decision record 0064.
5. **No trees in unknown ground.** Done. The scenery grows only where the house has revealed, asked of the
   fog's own field (`revealedAt`), surface tension and all, so the trees stop where the haze begins and the
   haze has no wood standing in it; the terrain under it still shows where the woods are, as the contours
   always do. The scatter itself is untouched and still a pure function of the ground: which of its points
   grow is decided as a cell is taken into view, and sorted again when the fog changes, keeping the fade a
   group is at. With the fog off everything grows, and with no house nothing does. The stands are still
   public until step 8.
6. **Colourless revealed ground.** Done. No one blend reaches both canvases, so each loses its colour by the
   means it has: the map through a canvas between the two, grey where revealed ground is not in vision,
   composited by the browser's saturation blend; the world's sprites under the fog by a filter in Pixi. Both
   from the same field, along the same edge and its wander, and the signs keep their colours. The wash is
   now a light fade. Decision record 0065.
7. **The haze undulates.** Done. It lies in bands of mist stretched along the screen, like mist over a
   field, which swell and thin where they lie and drift slowly across, big ones and small ones the opposite
   way; far out they fade into a flat haze rather than breaking into blotches, which round patches did at
   zoom 4 and 5. Its edge stays where it is, because the map's colour and the trees are cut along it. Every
   number of the fog's look is in `apps/web/src/fog/look.ts`, for Adam's eye. The sprite canvas had no clock of its own, and has one now only while there is something for it to
   do: twelve frames a second while the fog is drawn, the camera is at zoom 7 or closer, and a dozen points
   across the view find unknown ground under them (`hazeInView`); none otherwise. Still for anyone who has
   asked for less motion.
8. **The stands come from the server.** The sprite map's stand files leave the public folder, and the gateway
   sends a page only the stands touching ground its house has revealed. The biome raster stays public: it says
   what kind of country a region is, which the terrain under the haze already says. This is also the channel
   settlements and ruins will come through, when they are a layer of the sprite map. Three commits, decision
   record 0067:
   - **The gateway sends them.** Done. `hello` names the master the page draws, and the gateway sends the
     `stands` of every zoom 7 tile under a held cell from zoom 6 in, as far as they touch revealed ground with
     the scatter's margin (`Coverage.reaches`), again when the sight or the switch changes one, from the files
     through the `Stands` port. The log says under `stands` what arrived. Wire version 13.
   - **The page draws from them**, rather than from the public files.
   - **The files leave the public folder**, and the generator writes them where only the server reads.
9. **Vision that runs out.** A vision point given for a span ends when its span does, with nothing happening
   to say so: one wake-up a point, as a pledge waits out its span (0053).

The order is a suggestion, as every order here is. Every later step stands on step 1 and on little else:
four is only worth looking at once two draws the fog, eight needs four, and nine needs three.
