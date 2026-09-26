# Authoring the art

> **What belongs here:** how to make a picture for the map and hand it over, and what the tool does with
> it. **What does not:** why sprites are pictures cut by a tool (decision record 0059), the rules every
> picture on the map has to agree on (`LOOK-AND-FEEL.md`), where the scenery stands (decision records 0052
> and 0054), and the master (`AUTHORING-THE-WORLD.md`).

## Where a picture goes

`world/sprites/` is yours, and it is committed.

- `world/sprites/scenery/<kind>.png`, one for every kind in `world/biomes.json`: pine, spruce, birch,
  oak, beech, palm, jungle, acacia, mangrove, snag, scrub, heather, grass, reed, boulder, cactus.
- `world/sprites/marks/<name>.png`, one for every mark the map places: castle, castle-icon, candidate,
  figure, figure-icon, selection-ring. These are placeholders only for now: the map still draws the marks
  in code, because they take a house's colours. See 0059.

**Save your picture over the placeholder**, as `oak.webp` or `oak.png` or `oak.jpg`. Delete the placeholder if
the extension differs, because two files that are both `oak` are refused; the placeholder's record goes with
it by itself. With the dev server running, the picture is on the map a few seconds later, with no reload:
a picture already cut is never cut again, so a save costs only the picture that was saved. The dev server's
own output says what it cut; the debug log only speaks up when a cut fails.

To have a placeholder back, delete your picture and run:

    npm run world:art --prefix frontend -- --placeholders

It never draws over a file that is there.

## What a picture can be

Anything an image tool gives you, untouched:

- **Any size.** It is shrunk to 192 pixels tall, which is twice the tallest a sprite is ever drawn.
  Bigger than that is wasted, and smaller than that is kept as it is.
- **Any background**, as long as it is **flat**: one colour all the way round the edge. It is keyed out
  from the edges inward, so a pale patch inside the picture survives. A picture already cut out onto
  transparency is left alone. A picture whose edge is not one colour is refused, with a message saying so,
  rather than guessed at.
- **Standing on a plinth**: the way an image model likes to draw a thing, on a square block of turf with
  soil down its sides, seen from a corner, on pale paper with a soft shadow beside it. The block, the paper
  and the shadow all go, and what stood on the block stays, down to where it met the turf - the trunk, the
  roots, the stems. Litter and pebbles on the turf go too, though a stone right under a foot may stay; at
  the size the map draws, it is part of the foot. The shadow is not kept: see below.
- **Any margin.** It is trimmed to what is in it.
- **Lossy is fine.** The half-background pixels a lossy edge leaves are measured against the picture beside
  them and un-mixed, so no pale rim is left.

If a picture comes out wrong - look at the contact sheet - cut it out onto transparency by hand and save
that instead. A picture with its own transparency is never keyed or lifted.

## What it should look like

- **Drawn from the camera's angle.** The player's camera looks north and down at 45 degrees at the closest
  zoom, and less further out: from straight down at zoom 7 it tips up as it comes in (decision record 0060,
  experiment 0011). A round tree hides a different angle, but a building does not: draw buildings front-on
  and seen from that height, not as isometric diamonds.
- **Light from the upper right**, because the first picture has it there and every picture has to agree.
- **Standing on its foot.** The tool finds the foot as the middle of whatever is in the lowest few rows, so
  a trunk and its roots should be the lowest thing in the picture. Nothing should hang below them, such as
  a shadow that would move the foot sideways.
- **No shadow of its own**, or one the tool takes away with the plinth. A shadow drawn into a sprite is
  drawn with it, over whatever is already there, and where two overlap they are twice as dark. The tool
  makes every sprite's shadow itself, from its outline, and the map draws all of them in one layer under
  the sprites (experiment 0013).
- **As big as it should look** is `groundHeight` in `world/biomes.json`, in world units, and not the size
  of the picture: every picture is shrunk to the same height. A change there wants the sprite map worked
  out again, `npm run world:sprites --prefix frontend`.
- **Readable at twenty pixels.** That is how big a sprite is when it arrives. Only the outline survives at
  that size, so what tells one kind from another has to be its shape.

`world/painterly/art-sheet.png` shows every sprite at 20, 40 and 80 pixels on three kinds of ground, and it
is rewritten by every cut. It is the quickest way to see whether a picture reads, and whether it
disappears into the forest it stands in.

## What the tool does

    npm run world:art --prefix frontend

The dev server runs this by itself when a picture is saved. It does five things:

1. Takes a flat background away - or, for a picture standing on a plinth, lifts the thing off it, which is
   `packages/world/src/lift.ts`.
2. Trims the picture to what is left.
3. Finds the foot.
4. Shrinks it to 192 pixels tall.
5. Packs every scenery sprite into one atlas, `frontend/apps/web/public/art/scenery.webp`, with
   `scenery.json` beside it listing each frame, its foot and whether it is still a placeholder - and each
   sprite's shadow beside it, cut from its outline by `shadowOf` in `packages/world/src/art.ts`.

It prints one line for each sprite, saying which of the three it did:

    PICTURE     scenery/oak.webp  1254x1254 -> trimmed 758x887 -> 164x192, keyed rgb(252,252,249), foot 49% across
    PICTURE     scenery/birch.jpg 1024x1024 -> trimmed 501x615 -> 156x192, lifted off its plinth, paper rgb(222,223,218), foot 47% across

and `as cut before` at the end of the line when the picture had been cut already: every cut is kept, by
the picture's own bytes and the rules' own text, in `frontend/node_modules/.cache/villages-art`, so only a
picture that changed, or a rule that changed, is cut again. Lifting a picture takes about a second; the
cache is what keeps a save quick. Delete it and the next cut is slower and otherwise the same.

The atlas is output: it is not committed, and every tree cuts its own, on the dev server's first start if
nothing else.
