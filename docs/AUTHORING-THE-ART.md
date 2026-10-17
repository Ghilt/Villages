# Authoring the art

> **What belongs here:** how to make a picture for the map or the interface and hand it over, and what the
> tool does with it. **What does not:** why sprites are pictures cut by a tool (decision record 0059) and
> why the interface is painted (0068), the rules every picture has to agree on (`LOOK-AND-FEEL.md`), where
> the scenery stands (decision records 0052 and 0054), how a pane is composed from the pictures
> (`UI-COMPONENTS.md`), and the master (`AUTHORING-THE-WORLD.md`).

## Where a picture goes

`world/sprites/` is yours, and it is committed: every picture drawn on the map, a folder a group.

- `world/sprites/scenery/<kind>.png`, one for every kind in `world/biomes.json`: pine, spruce, birch,
  oak, beech, palm, jungle, acacia, mangrove, snag, scrub, heather, grass, reed, boulder, cactus.
- `world/sprites/marks/<name>.png`, one for every mark the map places: castle, castle-icon, candidate,
  figure, figure-icon, selection-ring. These are placeholders only for now: the map still draws the marks
  in code, because they take a house's colours. See 0059.
- `world/sprites/marks/structures/<type>.png`, the mark of every type of structure and `ruin.png`: what the map
  draws far out, where a structure stops shrinking. Cut with the structures, and drawn from the files: see below.
- `world/sprites/structures/<type>-<culture>.png`, one for every type of structure in every culture, and a
  ruin a culture. Cut by a tool of their own, and painted to rules of their own: see below.
- `world/sprites/critters/<kind>.png`, one for every kind of critter in `world/critters.json`: songbird,
  squirrel, hare, fish, hawk. A strip of frames, cut by a tool of its own: see below.
- `world/sprites/ruins/<piece>-<culture>.png`, the pieces the ruins of the towns of 1790 are laid out in, eight in
  each of the four cultures: a `shell` (a house open to the sky), a `row` of them, a `tower` stump, a `hall` (the
  culture's great building, roofless), an `arch`, a stretch of `wall`, a `gate`, and `rubble`. Cut by `world:art`
  into the scenery's atlas, because they stand among the trees, and painted as the scenery is: a front elevation
  standing on the bottom of the picture, on a flat background or a transparent one. Each is cut only as tall as it
  is ever drawn - a hall 192 pixels, a shell 104, a heap of rubble 64 - so paint each at least that tall; the
  Pictures page says each one's height under it. A missing picture has its placeholder drawn every time the art is
  cut, and the record of which are placeholders is the scenery's. How tall each stands on the map is
  `world/ruins.json`'s. See `docs/plans/ruined-cities.md`.

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

**Structures are cut by a tool of their own**, from `world/sprites/structures/`, which keeps its own record of
which are still placeholders, `placeholders.json` in that folder: `<type>-<culture>.png` for every type of
`world/catalogues/structures.json` in every culture - `castle-european.png`, `castle-islamic.png`,
`printingHouse-eastAsian.png` - and `ruin-<culture>.png` for what any of them falls to. Sixty-eight, every one a
placeholder drawn from the shapes the map draws in code until you save over it. Upright, the front of the
building, on a transparent background, standing on the bottom edge: it is cropped to what is drawn and scaled to
160 pixels tall, so paint it 640 tall or more. Its pennant flies from the middle of the highest row anything is
drawn in, so the tallest tower carries it. With the dev server running, a picture saved is on the map a few
seconds later with no reload; `npm run world:structures --prefix frontend` cuts by hand. To have a placeholder
back, delete your picture and cut again: it never draws over a file that is there. The Holdings tab still draws
its small pictures in code.

**A structure's mark is cut by the same tool**, from `world/sprites/marks/structures/`, with its own
`placeholders.json`: `<type>.png` for every type and `ruin.png`, one a type in no culture's look, because a mark says
what a thing is and not where. Seventeen placeholders, each a deep plum pin with the type's shape in outline on a
pale face. Upright, on a transparent background, its point on the bottom edge: the point is where the structure
stands. It is cropped and scaled to 160 tall and drawn about 44 pixels tall for a castle, so paint it 320 tall or
more and keep the shape bold. A pennant flies from the middle of its top.

**A critter is a strip of frames**, cut by a tool of its own from `world/sprites/critters/`, with its own
`placeholders.json`: `<kind>.png` for every kind in `world/critters.json`, its frames side by side from left to
right, each as wide as the picture over how many frames that file gives the kind, so a bird of three frames is a
picture three frames wide. Paint the frames in the order they play - a wing up, level, down - with the animal in
the same place in each, because every frame of a kind is cut to the one box that holds all of them, so the frames
register and only what moves moves. An animal of the ground or the water faces right, and the map turns it to face
the way it goes: a squirrel gathered, in the air, landing; a hare sitting up, in the air, gathered; a fish level, its
tail one way and then the other, which the map tips along its leap. A hawk is seen from above, as the map is, its
nose to the top of the frame, wings spread to glide and then a beat, because the map turns it to the way it flies
round its circle. Which frame is which is in
`apps/web/src/sprites/critters/look.ts`. On a transparent background or a flat one, as any sprite, with no plinth;
where the animal stands on anything, it stands on the bottom edge. A frame is cut 64 pixels tall and a critter is
drawn small - eight to thirty pixels at the closest zoom - so paint it 256 tall or more, keep the shape bold, and
let three or four frames say the motion: at that size the motion is what reads, not the outline. A placeholder
strip is drawn from simple shapes for every kind with no picture, never over a file that is there. To have one
back, delete your picture. More frames, or fewer, is a change to the number in `world/critters.json`. With the
dev server running, a strip saved is cut a moment later and shown, playing, on `/admin/inspect-pictures`;
`npm run world:critters --prefix frontend` cuts by hand.

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
    world/ui/medallions/<name>.webp              a round or oval frame, one fixed picture; clear inside, a window
    world/ui/marks/<name>.png                    a mark chosen to be painted rather than drawn
    world/ui/controls/<name>.webp + <name>.json  a button's face at rest, and where it stretches
    world/ui/controls/<name>-<state>.webp        the same face hovered, pressed or disabled, if painted
    world/ui/dividers/<name>.webp + <name>.json  a rule between two things, and where its two ends are cut
    world/ui/sources/<name>.webp + <name>.json   a picture a border is made from, as you gave it, and how
    world/ui/moodboard.webp                      the moodboard the placeholders are cut from
    world/ui/placeholders.json                   which files are still placeholders, by their bytes

A name is lowercase words joined by hyphens, `gilt-simple`, because it is what a recipe calls the picture
by. PNG, WebP or JPEG. Marks have no placeholders: every mark is drawn in code until one is painted.

**Every picture has a placeholder**, and **saving over a placeholder replaces it**, as it does for the
sprites: delete the placeholder first if your extension differs, because two files that are both
`gilt-simple` are refused. With the dev server running, the picture is on the page at
`/admin/inspect-ui-components#pictures` a moment later, with no reload. To have a placeholder back, delete
your picture and run:

    npm run world:ui --prefix frontend -- --placeholders

It never writes over a file that is there. The placeholders are the agent's, copied from the moodboard:
most are **cut out of it** - the fourteen sample borders' top row, the cathedral panel's cherub, cross and
drape, the four medallions, the knots on its dividers, the Paris plate, its two ends and a strip of its
middle joined with the words left out, and the slider, its drape, its knob and its tube - and made four
times the size, so they are soft; the rest are **drawn**, a gilt frame that slices cleanly, the fills,
which have to repeat, the divider's rule, the tabs' faces and the meter. Where each is cut from is
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

**Where the content starts need not be the cuts.** `content`, said instead of `inset`, is how far in from
each edge of the box the content starts, whatever the cuts are: a frame whose corners are deep - a drape,
a cherub, a leaf - and whose edges are thin says it, so that its words start just inside the moulding and
clear of the corners, rather than past the cuts:

    { "slice": [397, 395, 400, 383], "repeat": "round", "content": [140, 135, 173, 124] }

The page's drag box draws the cuts dashed and labels where the content starts, so the two are seen apart.

The title plate is a border too, `plate`, whose own middle is its parchment, so its file says
`"middle": true` and a recipe lays no fill under it.

**A frame that was not painted as a border** - an image model's nine tiles with lines between them, a
frame painted whole with no lines at all, a framed box standing on stone, black or painted checks - is made
into one by the nine-slice tool, one of your tools in `scripts/`. Give it the picture, wherever it is, and a
name:

    node nine-slice.ts "E:/Hämtade filer/frame.png" --name cloud-sunburst

and it writes three files into the folder you ran it in, or `--out`, and ends by saying what each is and
where: `cloud-sunburst.webp` and `cloud-sunburst.json`, the border and its file of cuts, which go into
`world/ui/borders/`; and `cloud-sunburst.recipe.json`, how it was made, so that
`node nine-slice.ts cloud-sunburst.recipe.json` makes it again the same way. The recipe stays with the
picture and never goes into `world/ui/borders/`, where it would be taken for a file of cuts.

It finds the cuts itself: between white or black gaps, between thin or engraved lines, and in a frame with
no lines, where each edge starts to repeat; `--cuts top,right,bottom,left` says them when it cannot, and
`--look` says how it would cut a picture without writing anything. It cuts the lines out with the soft edge
they leave and joins the tiles into one box, its cuts where they met. It clears what the frame stood on -
nothing, when the frame runs to the picture's edge; its own transparency, and whatever is nearly clear;
painted checks; or, with `--background 30`, whatever is cooler than gilt, because gilt keeps its red above
its blue and stone, black and white do not, and with `30,dark:110` only what is darker as well, so that pale
clouds as cool as the night sky round them stay. A picture whose edge is a dark, cool ground is taken for
that by itself. **A border holds its frame and nothing else**: with `--fill` the middle tile becomes a fill
of its own, mirrored so it repeats, or with `--clear-middle` it is dropped for a painted one, and the fill
reaches under the frame as far as its moulding, measured all along each side. So a pane's ground is the
fill's, and can be changed without the frame, which is what a light look and a dark one need. The picture's
own middle is kept as the border's only for a frame whose middle is part of it, like the title plate. Its edges are
laid `round` unless `--repeat` says otherwise. **How thick it looks is its size**: the game shows a border at a
quarter of its pixels, so an image model's 1254-pixel frame comes out with corners a hundred pixels across,
and `--width 448` makes it the size of the moodboard's frames, corners thirty to forty across. The recipe
remembers it. It also works out where the frame's words start - past each
edge at its deepest, and clear of each corner's ornament by whichever side costs the words less room - and
writes it as `content`; `--content` says it instead. `borders/gilt-cherubs` with `fills/dark-felt`, and
`borders/gilt-acanthus` on the painted `fills/stone`, were made that way, and so were `cloud-border`,
`cloud-2-border` and `science-border`, from the whole frames Adam first gave, with their skies and panel made
`fills/cloud-sky`, `cloud-2-sky` and `science-panel`; their pictures and recipes are kept in
`world/ui/sources/`. Run with nothing, it prints its help.

So **an edge has to repeat without a seam**: whatever is at its left end has to meet its right, or be
stretched. Anything that must not repeat - a cross on the crown, a cherub - is not part of the border but
an embellishment of its own. The moodboard's own borders were not drawn to be sliced, and the page shows
what that does to them.

**A fill repeats without a seam**, both ways: its left edge meets its right and its top its bottom.

**A fill is light enough for ink or dark enough for cream**, and not in between: words want 4.5 to 1
against it, the softer ink as well as the main one. Parchment is a fill for ink, night, velvet, wood and
stone for cream, and a stone between the two is a fill neither can be read on. One the main ink reads on
and the softer does not - the moodboard's arch, the plate's darker parchment - can still be used, by a
recipe that says it has no softer ink. `npm run check` measures
every recipe's fill, and the middle of every border drawn with its own, against the ink its words are in,
and says which falls short and by how much; the page's contrast switch shows the words themselves. See
`UI-COMPONENTS.md`.

**A medallion that holds a portrait is painted with a clear middle**, and the clear middle is its window:
the tool finds it - whatever is clear and shut in by the frame, the largest of it - and the page lays the
portrait behind the frame there, so the frame's own inner edge is the portrait's edge. No file goes beside
it. One painted whole, the compass or a shield, is an emblem and holds nothing. The placeholder for the
portrait's oval is the moodboard's, its painted portrait punched out.

**An embellishment, a medallion, a mark or a control stands on nothing**: cut it out onto transparency, or
save it on one flat colour and the tool keys the colour away, as it does a sprite's. One on a busy
background is refused, with a message saying so.

**A button's face is painted at rest**, whole, the way the moodboard's buttons are. One that should
stretch to fit its words - a drape, an oval - has a `<name>.json` of cuts beside it, as a border has, with
its top and bottom cuts together as tall as the face, so that it stretches across and never up. The end
caps outside the side cuts are where the words stop. A round face has no file and is drawn one size. Its
states are light and shade over the one picture - lighter under the pointer, darker pressed, grey disabled
- unless you paint one: `primary-hover`, `primary-pressed` or `primary-disabled` beside `primary` is drawn in
that state instead, and the others stay light and shade. A round face can have its mark painted in, as the
moodboard's close and minimise do, or be plain, `round-plain`, for a drawn mark to stand on. **A tab has two
faces**, `tab` at rest and `tab-chosen` for the one that is up, each cut like a drape and open at the
bottom, where it tucks under the pane it opens; the bottom fifth of it is out of sight under the pane's
border. **A text field is a face** too, `field`, parchment in a gilt rim cut like a drape at its two ends,
384 by 176 painted, and the dropdown is drawn on it as well; its words are written on its middle in ink, so
the middle has to be a parchment light enough for ink, which `npm run check` measures. The placeholder is
drawn: the moodboard's own field has its words painted on it with an ornament over them, so it could not be
cut without one or the other.

**A slider is three pictures**: `slider`, its track - the two ends and the empty tube between them, cut
like a drape at the inner edges of its ends, 520 by 260 painted, **with the tube along the picture's
middle**, because the knob is centred on it: whatever hangs below the tube, a drape, is matched by as
much room above it; `slider-fill`, a strip of the same tube lit, as tall as the track and with the tube in
the same rows, which is stretched from the left end to the knob; and `slider-knob`, laid whole, 148
painted, its ring in the picture's middle. The knob travels from the inner edge of one end to the
inner edge of the other, so an end is as wide as the knob should never cross. **A meter is two**:
`meter`, a tube of empty glass, and `meter-full`, the same tube full, cut alike, 480 by 56 painted; the
full one is shown as far as the level reaches. A meter of another colour is another pair,
`<look>` and `<look>-full`. **A carousel's dots are two**: `dot`, a ring for each thing, and `dot-at`, the
one being shown, both laid whole and drawn 12 pixels across, so 48 painted; the placeholders are a ring
from between the moodboard's carousel arrows and its slider's gilt knob.

**A divider is a rule with two ends**, painted at some middling length, with a `<name>.json` beside it
whose top and bottom cuts are nought, so it is cut only at its ends:

    { "slice": [0, 56, 0, 56], "repeat": "stretch", "middle": true }

The ends outside the two cuts are drawn once and the line between them is stretched, so the line has to
be the same the whole way along. Without the file the whole rule is stretched, its ends with it. A knot
for its middle is an embellishment - `knot-fleur`, `knot-boss`, the `sunburst` - because any knot goes on
any rule: paint it on nothing, about twice as tall as the rule, which is 36 pixels painted and 9 shown.

**A painted mark has to read at seventeen pixels**, the size a resource's mark is drawn at, and a mark
that does not survive it is drawn in code instead. The page's *Marks and readouts* section shows every mark
at 17, 24 and 48 pixels side by side, so how one reads small is seen. `world/ui/marks/close.webp` is drawn wherever the mark
called `close` is; delete it and the drawn one is back.

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
