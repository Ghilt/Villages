# Authoring the art

> **What belongs here:** how to make a picture for the map and hand it over, and what the tool does with
> it. **What does not:** why sprites are pictures cut by a tool (decision record 0057), the rules every
> picture on the map has to agree on (`LOOK-AND-FEEL.md`), where the scenery stands (decision records 0052
> and 0054), and the master (`AUTHORING-THE-WORLD.md`).

## Where a picture goes

`world/sprites/` is yours, and it is committed.

- `world/sprites/scenery/<kind>.png`, one for every kind in `world/biomes.json`: pine, spruce, birch,
  oak, beech, palm, jungle, acacia, mangrove, snag, scrub, heather, grass, reed, boulder, cactus.
- `world/sprites/marks/<name>.png`, one for every mark the map places: castle, castle-icon, candidate,
  figure, figure-icon, selection-ring. These are placeholders only for now: the map still draws the marks
  in code, because they take a house's colours. See 0057.

**Save your picture over the placeholder**, as `oak.webp` or `oak.png` or `oak.jpg`. Delete the placeholder if
the extension differs, because two files that are both `oak` are refused. With the dev server running, the
picture is on the map about a second later, with no reload. The dev server's own output says what it cut;
the debug log only speaks up when a cut fails.

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
- **Any margin.** It is trimmed to what is in it.
- **Lossy is fine.** The half-background pixels a lossy edge leaves are measured against the picture beside
  them and un-mixed, so no pale rim is left.

## What it should look like

- **Drawn from the camera's angle.** The player's camera looks north and down at 45 degrees at the closest
  zoom, and less further out: from straight down at zoom 7 it tips up as it comes in (decision record 0058,
  experiment 0011). A round tree hides a different angle, but a building does not: draw buildings front-on
  and seen from that height, not as isometric diamonds.
- **Light from the upper right**, because the first picture has it there and every picture has to agree.
- **Standing on its foot.** The tool finds the foot as the middle of whatever is in the lowest few rows, so
  a trunk and its roots should be the lowest thing in the picture. Nothing should hang below them, such as
  a shadow that would move the foot sideways.
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

1. Takes a flat background away.
2. Trims the picture to what is left.
3. Finds the foot.
4. Shrinks it to 192 pixels tall.
5. Packs every scenery sprite into one atlas, `frontend/apps/web/public/art/scenery.webp`, with
   `scenery.json` beside it listing each frame, its foot and whether it is still a placeholder.

It prints one line for each sprite:

    PICTURE     scenery/oak.webp  1254x1254 -> trimmed 758x887 -> 164x192, keyed rgb(252,252,249), foot 49% across

The atlas is output: it is not committed, and every tree cuts its own, on the dev server's first start if
nothing else.
