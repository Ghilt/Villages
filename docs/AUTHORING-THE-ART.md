# Authoring the art

> **What belongs here:** how to make a picture for the map or the interface and hand it over, and what the
> tool does with it. **What does not:** why sprites are pictures cut by a tool (decision record 0059) and
> why the interface is painted (0068), the rules every picture has to agree on (`LOOK-AND-FEEL.md`), where
> the scenery stands (decision records 0052 and 0054), how a pane is composed from the pictures
> (`UI-COMPONENTS.md`), and the master (`AUTHORING-THE-WORLD.md`).

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
a picture already cut is never cut again, so a save costs only the picture that was saved. A picture saved
while nothing was running is cut when the dev server or the quick-start next starts, because both cut the
folder every time they start. The dev server's own output says what it cut; the debug log only speaks up
when a cut fails.

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

The dev server runs this by itself when a picture is saved and every time it starts. It does five things:

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

The atlas is output: it is not committed, and every tree cuts its own. The last line a cut prints ends with
what came of it: `nothing new` when the atlas it made is the one already there, in which case nothing is
written and the page is not told, and otherwise which sprites were newly cut. That is what makes a cut at
every start cheap enough to do.

## Interface art

`world/ui/` is yours, and it is committed, beside `world/sprites/` and `world/portraits/`. A folder a kind:

    world/ui/borders/<name>.webp + <name>.json   a whole framed box, and where its four cuts go
    world/ui/fills/<name>.webp                   a picture that repeats without a seam
    world/ui/embellishments/<name>.webp          a cherub, a drape, a cross: anything pinned to a box
    world/ui/medallions/<name>.webp              a round or oval frame, one fixed picture
    world/ui/marks/<name>.png                    a mark chosen to be painted rather than drawn
    world/ui/controls/<name>-<state>.png         a button's face: rest, hover, pressed, disabled
    world/ui/moodboard.webp                      the moodboard the placeholders are cut from
    world/ui/placeholders.json                   which files are still placeholders, by their bytes

A name is lowercase words joined by hyphens, `gilt-simple`, because it is what a recipe calls the picture
by. PNG, WebP or JPEG. Marks and controls have no placeholders yet; they arrive with the steps that build
the components that draw them.

**Every picture has a placeholder**, and **saving over a placeholder replaces it**, as it does for the
sprites: delete the placeholder first if your extension differs, because two files that are both
`gilt-simple` are refused. With the dev server running, the picture is on the page at
`/admin/inspect-ui-components#pictures` a moment later, with no reload. To have a placeholder back, delete
your picture and run:

    npm run world:ui --prefix frontend -- --placeholders

It never writes over a file that is there. The placeholders are the agent's, copied from the moodboard:
most are **cut out of it** - the fourteen sample borders' top row, the cathedral panel's cherub, cross and
drape, the four medallions - and made four times the size, so they are soft; the rest are **drawn**, a
gilt frame that slices cleanly and the fills, which have to repeat. Where each is cut from is
`frontend/packages/world/src/uiPlaceholders.ts`.

### Painting one

**Paint at four times the size it is shown.** A picture's size as shown is its own divided by four, so a
border's corner shown 24 pixels across is painted 96, and a cherub meant to stand 120 pixels tall on the
page is painted 480. The tool cuts each at 1x, 2x and 3x from that, and a picture painted smaller than
four times is soft on a sharp screen. The page says, under every picture, the size it is shown and the
size it was painted.

**A border is one whole box**, painted as it should look at some middling size, with `<name>.json` beside
it:

    {
      "slice": [96, 96, 96, 96],
      "repeat": "stretch",
      "inset": [8, 8, 8, 8],
      "outset": [0, 0, 0, 0],
      "middle": false,
      "fillUnder": [48, 48, 48, 48]
    }

**Every length in it is in the picture's own pixels**, the ones a paint program shows, one number or four,
top, right, bottom, left. `slice` is where the four cuts go, each measured in from its own edge: the
corners are drawn once and the edges between them laid along the box. `repeat` is how - `stretch`,
`repeat`, `round` or `space`, or two of them, across and then down. `inset` is how much further in than
the cuts the content starts; `outset` how far the border stands out past the box; `middle` whether the
picture's own middle is drawn, rather than left for a fill; `fillUnder` how far a fill reaches under the
border, half of each cut if it is not said. Only `slice` has to be there.

So **an edge has to repeat without a seam**: whatever is at its left end has to meet its right, or be
stretched. Anything that must not repeat - a cross on the crown, a cherub - is not part of the border but
an embellishment of its own. The moodboard's own borders were not drawn to be sliced, and the page shows
what that does to them.

**A fill repeats without a seam**, both ways: its left edge meets its right and its top its bottom.

**An embellishment, a medallion, a mark or a control stands on nothing**: cut it out onto transparency, or
save it on one flat colour and the tool keys the colour away, as it does a sprite's. One on a busy
background is refused, with a message saying so.

**A painted mark has to read at seventeen pixels**, the size a resource's mark is drawn at, and a mark
that does not survive it is drawn in code instead.

### What the tool does

    npm run world:ui --prefix frontend

The dev server runs it by itself when a picture or a border's file is saved and every time it starts, and
so does the quick start. For each picture it keys a flat background away, cuts it at 1x, 2x and 3x as
WebP, each file named for its own bytes so a browser can keep it forever, and writes the list the page
reads, `frontend/apps/web/public/ui/ui.json`. A fill is cut three by three and its middle taken, so it
still repeats at every density. It prints a line a picture, with what each density weighs:

    placeholder borders/gilt-simple.webp           384x384 -> shown 96x96, its own alpha: 1x 1.4 KB, 2x 2.8 KB, 3x 4.2 KB

and ends with the whole: how many pictures, how many still placeholders, and what they weigh at 2x against
the budget of two megabytes, which is what keeps the page quick to open. Every cut is kept, in
`frontend/node_modules/.cache/villages-ui`, so a start that finds nothing new is a second or two and writes
nothing. The cut pictures are output: not committed, and every tree cuts its own.
