# The UI component library

**What belongs here:** how the component library and its showcase page get built - what goes in the library,
where its art comes from and goes, and the order it is built in. **What does not:** why the interface is
painted art placed by CSS, which is decision record 0068; how to compose a pane from the library once it
exists, which is `UI-COMPONENTS.md`; what the interface looks like, which is `LOOK-AND-FEEL.md`; how it
behaves on a phone, which is `RESPONSIVE-DESIGN.md`. When a part of it is decided, that part becomes a
decision record and leaves.

---

## The problem, in one paragraph

The interface is drawn in code today: stroked marks, gold contours, one stylesheet of three thousand lines
and six colours. Adam's moodboard asks for something else - painted, baroque, gilt borders, velvet drapes,
cherubs, parchment, medallions - and that cannot be drawn with CSS shapes, nor re-invented pane by pane. So
before any of the game changes, there is to be a library of components and a page that shows every one of
them, **`/admin/inspect-ui-components`**, where a component is proven before it is used and Adam looks at
it. A later session that has to make a new pane reads the library rather than inventing one.

## What this plan does not do

**It touches no part of the game.** It builds the library, its art pipeline, the page and the documents,
and nothing else. The one existing file it edits is `main.tsx`, for one more page beside
`/admin/inspect-events`, loaded on demand so that neither the library nor its art is in the game's bundle.
Bringing the library into the house status, the panes, the tab bar and the rest is later work, a surface a
session and a plan each.

## Decided with Adam, 2026-09-30

- **The painted look replaces the drawn one, over time.** The moodboard is the target for every pane. The
  drawn **ornament** of decision record 0048 stays on each surface until that surface is redone.
- **A border is handed over whole**: one painted, framed box and a small file beside it naming where the
  four cuts go.
- **A mark is drawn or painted, one mark at a time.** The library draws either behind one component, and
  which one each mark is is Adam's call when it is made, as whether a button is a mark or words already is.
- **The method has a document of its own**, `UI-COMPONENTS.md`.
- **Static** means the page needs no game server and no map. Its demonstrations are live: a box can be
  dragged to any size, a button pressed, the page narrowed to a phone.
- **The agent makes the placeholders, copying the moodboard.** Rough is fine; Adam replaces them when he
  wants to, and nothing waits on him.

## Can the browser do nine-slice borders

**Yes, natively.** CSS `border-image` is nine-slice: one picture, four cuts, the corners drawn once, the
edges repeated along the box - `round` fits a whole number of repeats so none is cut off - or stretched, and
the middle filled or left open. It is one element, drawn by the graphics card, in every browser. With
`image-set()` it picks a 1x, 2x or 3x file by the screen's density, so the art's resolution is independent
of the size a box is laid out at.

**CSS alone is not enough, and it is not asked to be.** The look comes from painted pictures; CSS only puts
them in place. Where `border-image` stops, the library has a layer:

| What is wanted | `border-image` | What the library adds |
|---|---|---|
| Corners, repeating edges, a box of any size | yes | - |
| A cherub, a drape, a cross that stands out past the border | no | an **embellishment**, pinned to an anchor, saying how far it stands out |
| An ornament in the middle of an edge, the knot on the seam | no | an embellishment pinned to `top-center` and the like |
| A filling that repeats on its own, parchment or velvet | clumsy | a **fill**, a picture of its own |
| A round or oval frame, a portrait or the compass | no | a **medallion**, one fixed picture, not sliced |
| Light that glows or moves | no | an overlay, moved only by transform and opacity |

The page has a section that tries each limit on purpose: the seams at Windows' 125 and 150 per cent
scaling, which is where nine-slice repeats show hairline gaps; a box dragged from sixty pixels to the whole
width; borders nested inside borders.

**Drawing the interface in Pixi or on a canvas was considered and turned down.** It loses the browser's
text, its inputs, its accessibility and its layout, and buys nothing `border-image` cannot do.

## A container is layers, not one clever component

A **container** is four layers, each its own component, and a **recipe** names a combination of them:

1. **Border** - the nine-slice picture: `gilt-baroque`, `gilt-simple`, `stone-arch`, `velvet-drape`.
2. **Fill** - what is inside it: `parchment`, `dark-wood`, `night`, or nothing.
3. **Embellishments** - none or several pictures, each pinned to an anchor (`top-left` to `bottom-right`,
   `top` and the rest), each with an **overhang**, how far it stands outside the box. An embellishment
   takes none of the content's room: it stands on the border or past it.
4. **Content** - set in by the border's own cut and inset, and the recipe's padding.

A recipe is one typed entry:

```ts
'pane.cherub-corner': {
  border: 'gilt-simple',
  fill: 'parchment',
  embellishments: [
    { art: 'cherub-standing', anchor: 'top-right', overhang: { x: 30, y: 30 } },
  ],
}
```

which is the sentence Adam wants to be able to say - *a container for this pane, a gilt border and a cherub
in the top right corner* - written down: one recipe and one picture in the art folder.

A key figure's card is a container too, a smaller recipe on the same four layers, `card.figure` or
`card.event`. One mechanism at every size, and a card in a pane is two containers, one inside the other.

## The components

Adam's list, and marked ★ the ones the moodboard or the game needs that it did not name:

- **Foundations**: ★ the tokens - colour, spacing, the **rarity** bands; ★ the type - title, heading,
  label, body, quotation, numeral, in fonts served with the page that cover more than English; ★ the focus
  ring; ★ the divider, the ornamental rule the moodboard draws between sections.
- **Containers**: the container; ★ the card; ★ the medallion - a portrait, a house's shield, the compass;
  ★ the title plate, the ribbon a place's name and its figure sit on and a pane's heading; ★ the dialog and
  the dimmed page behind it, to confirm *kill*; ★ the tooltip; ★ the toast, saying something happened; the
  expandable section; ★ the scroll area.
- **Controls**: the text button; the mark button, a close or a minimise; the state button, the **eye**;
  ★ the window controls, several mark buttons together; ★ the labelled switch, `fog of war: on`; ★ the
  choice of a few, where one of several is picked; ★ the stepper, a key figure's up and down; ★ hold to
  confirm, for what cannot be undone; the slider; ★ the text field, and search; ★ the dropdown.
- **Readouts**: the mark, drawn or painted; ★ the resource readout - the mark, the amount counting up
  between events, and its rate; ★ the meter, which shows a level and cannot be moved, where a slider can;
  ★ the badge, a count on a mark.
- **Collections**: the tab bar; the **carousel**, and ★ its dots; the grid, the key figures; ★ the list and
  its rows.

Every control is shown in every state side by side - at rest, hovered, pressed, focused, chosen, disabled -
and, narrowed to a phone, without the hover a finger does not have. Text buttons and mark buttons are both
built properly, because which one a button is stays Adam's call every time.

## Where the art goes

A folder beside `world/sprites/` and `world/portraits/`, committed, and Adam's:

```
world/ui/
  moodboard.webp                    the moodboard, which the placeholders are cut from
  placeholders.json                 which files are still placeholders, by their bytes, as for the sprites
  borders/<name>.png + <name>.json  one whole framed box; the json names the four cuts, how the edges
                                    repeat, and how far in the content starts
  fills/<name>.png                  a picture that repeats without a seam
  embellishments/<name>.png         transparent, any shape: cherub, drape, cross, sunburst
  medallions/<name>.png             a round or oval frame, transparent where the picture shows through
  marks/<name>.png                  only the marks chosen to be painted; the rest are drawn in code
  controls/<name>.webp + .json      a button's face at rest, and where it stretches to fit its words
  controls/<name>-<state>.webp      the face hovered, pressed or disabled, when painted rather than lit
  dividers/<name>.webp + .json      a rule between two things, cut at its two ends; its knots are
                                    embellishments
```

- **Painted at four times the size it is shown.** A border's corner shown 48 pixels across is painted 192.
  The tool writes 1x, 2x and 3x WebP, each named for its own bytes, so a browser keeps it forever and a new
  save is a new name.
- **Quick to load**: the whole of it under about two megabytes at 2x, and the page says what every file
  weighs and which are over. The painted marks share one atlas; the borders are a file each, because a
  `border-image` is one picture.
- **Every mark shown at 17, 24 and 48 pixels** on the page, side by side, so whether a painted mark reads
  small is seen rather than argued.
- **The cuts are drawn over the border** when the page is asked to, so a wrong number is seen, not guessed.

### The placeholders copy the moodboard

So the page looks like the moodboard from the first day, and not like grey boxes. They come from two places:

- **Cut from the moodboard itself.** `frontend/packages/world/src/uiPlaceholders.ts` names a rectangle of
  it per placeholder, and an outline to cut along for one standing on the busy map. The agent measures
  them, so they are code rather than a file of Adam's. The fourteen sample borders become borders - gilt, arch, drape, cloud, gothic, sunburst, column; the
  cherubs, the cross and the drapes become embellishments, their background keyed out; the compass, the
  portrait, the shields and the eagle become medallions; the buttons and the slider become the faces of
  controls. A moodboard border is about a hundred pixels, so they are soft at 2x, and the page labels each
  one a placeholder.
- **Drawn by the tool** where the moodboard has nothing that can be used, or where a picture has to repeat
  without a seam: parchment, dark wood, velvet and night fills, grain and noise in the moodboard's colours,
  and one plain gilt border drawn from gradients and curls that stays sharp at any density.

As with the sprites, each placeholder is known by its bytes, so **saving over one replaces it** and the tool
never draws over a picture of Adam's. The dev server cuts the folder again when a picture in it is saved,
and the page takes up the new picture without a reload, as `artApi.ts` does for the sprites.

## Where the code goes

```
frontend/apps/web/src/ui/ui.css                the tokens and the type, in a cascade layer of its own
frontend/apps/web/src/ui/tokens.ts             the tokens by name and what each is for
frontend/apps/web/src/ui/art/pictures.ts       the cut pictures, kept current, and their image-sets
frontend/apps/web/src/ui/border/               the border and fill layers, and their arithmetic
frontend/apps/web/src/ui/container/            the container, its layout, and the recipes
frontend/apps/web/src/ui/<component>/          each component to come, a folder of its own
frontend/apps/web/src/admin/UiComponents.tsx   the page, and admin/showcase/ its sections
frontend/apps/web/src/main.tsx                 one more branch, /admin/inspect-ui-components
frontend/packages/world/bin/cutUi.ts           the cut, borrowing the keying in src/art.ts
frontend/packages/world/src/ui*.ts             the cut's rules, the fills, and the placeholders
frontend/apps/web/vite/uiArtApi.ts             watches world/ui/, cuts it, tells the page
```

The library imports nothing from the game, and the game nothing from the library until a later session
chooses to. Its stylesheet is loaded only by the page, in its own cascade layer, so it cannot disturb
`styles.css`.

## Steps

One commit each. After the fourth, the order is a menu.

| # | Step | Where it is seen |
|---|---|---|
| 0 | This plan, decision record 0068, `UI-COMPONENTS.md`, the rule in `CLAUDE.md`, `BUILDING-A-MECHANIC.md`, `AUTHORING-THE-ART.md`, `LOOK-AND-FEEL.md`, the glossary and the roadmap; the moodboard committed as `world/ui/moodboard.webp` | the documents |
| 1 | The page: its address, empty sections, the phone-width switch, the tokens and the type | the page |
| 2 | The art: the rest of `world/ui/`, placeholders cut from the moodboard and drawn, `npm run world:ui`, 1x, 2x and 3x, the weights on the page, cut again on a save | the page, and a sheet of every placeholder |
| 3 | Border and fill: nine-slice, a box to drag to any size, the cuts drawn over it, the scaling rows | the page |
| 4 | Embellishments, recipes and the container: the cherub, the overhang, a card inside a pane | the page |
| 5 | Buttons: text, mark, state, window controls, every state | the page |
| 6 | Marks, the resource readout, the badge, the tooltip | the page |
| 7 | Slider, meter, stepper, switch, choice of a few, hold to confirm | the page |
| 8 | Tab bar, expandable section, scroll area, divider, title plate | the page |
| 9 | Carousel and its dots, grid, card, list | the page |
| 10 | Dialog, toast, text field, dropdown, medallion | the page |

**Where it stands, 2026-10-01: nought to nine, and the first part of ten, are built.** Four made the page able to be used for
verification: the foundations, every picture, borders and fills at any size, and containers with their
recipes and embellishments, all at desktop and phone width and on night and parchment. Five is the
buttons: text, mark and state buttons and the window controls, in every state, on faces cut from the
moodboard's buttons, with the library's first drawn marks. Six is the marks - the game's own number
marks, copied and held to it by a test - the resource readout that counts between events, the badge and
the tooltip. Eight is the tab bar, the expandable section, the scroll area, the divider and the title
plate, with a seventh folder of pictures, `dividers/`, for the rule, and the first placeholder joined from
several pieces of the moodboard: the Paris plate, its left end, a strip beside it and the same end turned
for the right, because a strip from its middle was a lighter parchment and the join showed. Seven was
six controls, too many for one step, so it is two: the first is the slider, cut from the moodboard's in
three pictures and worked by the browser's own slider under the painting, the meter and the stepper; the
second is the switch, the choice of a few and hold to confirm, drawn from pictures already in the folder:
the oval face and the slider's knob, the card's frame, the drape's face. Nine was four components, so it
is two halves as well: the first is the card and the grid, what the key figures need, and the second the
carousel and its dots, and the list. Between the two, Adam saw dark words on dark panes: a container with a
dark fill had been taking the ink of a parchment page it stood on. Every container now sets its words from
its recipe, a test measures every recipe's fill against both its inks, and the page has a contrast switch
that marks any word too faint to read; see `UI-COMPONENTS.md`. The second half was built with that switch
on, and it found the list's own first states wanting: a row lit by a wash of its words' colour lost
contrast on parchment, so a row is lit with cream instead. The dots are two new placeholders, a ring
from between the moodboard's carousel arrows and its slider's gilt knob. Ten is five components and is
three parts: the dialog and the toast, which come over the page; the text field and the dropdown, which
are typed and picked in; and the medallion, whose pictures in the folder are cut whole from the moodboard,
the portrait's face and all, and have first to have a window the picture framed shows through. Adam's first frame of his own,
`gilt-cherubs`, came in during it as an image model's nine tiles with gaps between them, and went into the
folder joined, with its middle as a fill, `dark-felt`, and a recipe, `pane.cherubs`; his second,
`gilt-acanthus`, came on stone with a box of white over its middle, and with it the nine-slice tool and
skill, which make both again from their sources in `world/ui/sources/`. The rest of the
page's sections say which step brings them, and from here the order is a menu. Step four was built with a keep-out, room kept clear among
the words for an embellishment, and Adam took it out the same day: see decision record 0068. Step two cut
the top row of the moodboard's sample borders, not both: the second row is the same frames' corner pieces.
The marks have no placeholders: every one is drawn in code until one is painted. The page's Pictures
section is the sheet of every placeholder.

## What Adam is asked for, and when

**Nothing that anything waits on**, because the agent makes the placeholders. From step 2 every picture
has a placeholder and a file name, so replacing one is always *save over `world/ui/borders/gilt-simple.webp`*
and never *we need some art*. Every step that adds a component says, when it is presented, which files it
reads, the size to paint each at, and whether each is a border, a fill, an embellishment, a medallion, a
mark or a control's face.

## How each step is checked

- `npm run check --prefix frontend`, green. A component's arithmetic is tested without a browser, in a
  plain module beside it, as the stage's is in `bayBox.test.ts`: a cherub stands where it is pinned, a
  stepper refuses past its ends. The repository has no React Testing Library and its web tests run in Node, so
  what a component looks like is checked on the page, by eye, and that is the check that matters.
- The folder's rules are a test, as `spriteFolder.test.ts` is for the sprites.
- The page, open from this tree's `web` server, looked at on a desktop, narrowed to a phone, and at a
  device-pixel ratio of 1.25 for anything sliced.
