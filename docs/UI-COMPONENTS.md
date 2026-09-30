# The component library

> **What belongs here:** the interface's component library - what each component is, the parts it is made
> of, its variants and recipes, how to compose a new pane from it, and how a new component is added. **What
> does not:** why the interface looks the way it does, which is `LOOK-AND-FEEL.md`; how it behaves across
> screen sizes, which is `RESPONSIVE-DESIGN.md`; where the art goes and what the tool does with it, which is
> `AUTHORING-THE-ART.md`; why it is painted art placed by CSS, which is decision record 0068; and the order
> it is being built in, which is `docs/plans/ui-component-library.md`.

**Being built.** This is the method as agreed on 2026-09-30, written before most of the library so that the
library is built to it. Each step of the plan fills in its part, and a line that still says *to come* is a
part nobody has built. The page, the foundations, the pictures, borders and fills, and the container
are built.

## The page

**`/admin/inspect-ui-components`** is the library, shown. Every component in every variant, every state
and at more than one size, on a desktop and narrowed to a phone. It needs no game server and no map, and
its demonstrations are live: a container can be dragged to any size, a button pressed. It is the page a
component is looked at before it is used anywhere, and the page to read before making a pane.

The page is the catalogue. This document is the method, and does not list what the page already shows.

## The rule

**A component is seen on the page before it is used in the game.** A mechanic that wants something the
library does not have adds it to the library first, in a commit of its own that the page shows, and then
uses it. A component is never built inside a pane and promoted afterwards.

**A component changed is a component changed everywhere**, so a change to one is looked at on the page too,
in every variant, and not only where the change was wanted.

**The library imports nothing from the game.** It knows no house, no event and no gateway; a pane gives it
words, numbers and callbacks. That is what lets the page show it with nothing running.

## A container is layers

A **container** is four layers, and every boxed thing in the interface is one - a pane, a card, a dialog, a
tooltip:

1. **Border** - a nine-slice picture: the corners drawn once, the edges repeated or stretched along the
   box.
2. **Fill** - what is inside the border, a picture that repeats on its own, or nothing.
3. **Embellishments** - none or several pictures pinned to an anchor, a corner or the middle of an edge.
   Each says its **overhang**, how far it stands out past the border, and its **keep-out**, how much room
   it takes from the content. Neither is part of the nine-slice.
4. **Content** - set in from the border by the border's own inset and by every keep-out, so the content
   moves aside for a cherub by itself.

A container inside a container is two containers. There is no nesting rule beyond that.

**The border is `border-image`**, which is nine-slice and nothing else: the browser draws the corners once
and lays the edges between them, stretched or repeated as the border's file says, so one picture frames a
box of any size. Its cuts are given to CSS as shares of the picture rather than pixels, because the browser
picks one of three files for the screen it is on and a share falls on the same line in all three; the tool
put every cut on a whole pixel as shown, so it falls between two pixels in each. **An edge that is
stretched cannot seam**; one that is repeated can, at Windows' 125 and 150 per cent, where its pixels fall
between the screen's, and the page shows each border at those scalings for that reason. **The fill is a
layer under the border**, standing in from each edge by the cut less what the border's file says reaches
under it. A border whose picture has a middle of its own draws it only when no fill is laid under it.

## A recipe names a container

A **recipe** is one named, typed combination of the four layers, in
`frontend/apps/web/src/ui/container/recipes.ts`:

```ts
'pane.cherub-corner': {
  border: 'gilt-simple',
  fill: 'parchment',
  text: 'ink',
  padding: 8,
  embellishments: [
    { art: 'cherub-standing', anchor: 'top-right', overhang: { x: 26, y: 30 }, keepOut: { right: 30 } },
  ],
}
```

- `border` and `fill` are pictures by name; either can be left out. A border whose picture has a middle of
  its own draws it only when there is no fill.
- `text` is what the content is written in, `ink` on a light fill or `cream`, the default, on a dark one.
- `padding` is room between the border's inner edge and the content, beyond the border's own inset.
- An **embellishment** is a picture by name, pinned to an `anchor` - a corner, or `top`, `right`, `bottom`
  or `left` for the middle of an edge. `overhang` is how far it stands out past the box, `x` sideways and
  `y` up or down, away from it; a negative one sits inside. `keepOut` is how much room it takes from the
  content, a side at a time. `behind` hangs it under the whole container, the fill too, as a drape hangs
  behind a panel; `height` draws it at another size than its picture's, in proportion; `mirrored` turns it
  left to right, so one cherub does for both corners.
- A container keeps a **margin as wide as its overhangs**, so nothing beside it runs under a cherub;
  `roomForOverhangs: false` for one whose room is known to be clear.

**A keep-out takes a whole side.** A cherub in the top right corner that keeps out forty pixels on the
right keeps the words clear of the right all the way down, not only beside itself. It is the simplest rule
that never lets a word under a cherub, and the page's *layers* switch draws exactly what it takes. A
keep-out that is only a corner, with the words running round it, is possible and not built.

Recipes are named for what they are used for, `pane.<which>`, `card.<which>`, `dialog.<which>`, so that a
recipe changed is a known set of places changed. A pane uses a recipe and never sets a border of its own.

## Asking for a pane

The words to use are the layers. *A container for the pane that lists the holdings: the gilt border, a
parchment fill, a cherub in the top right corner that takes forty pixels from the top of the content.* That
sentence is a recipe, and at most one new picture in `world/ui/`, which starts as a placeholder.

What the agent says back, before building: the recipe as written, the pictures it reads, which of them are
new and the size to paint each at.

## The foundations

**Colours and spaces are tokens**, custom properties on `:root` named `--ui-…`, declared in
`frontend/apps/web/src/ui/ui.css` and nowhere else. `ui/tokens.ts` lists each by name and by what it is
for, and the page draws its swatches from that list and reads the values back from the stylesheet. A
component uses a token and never a colour of its own; a colour a component needs that is not a token
becomes one, in both places, and `tokens.test.ts` fails until it is in both.

**Text colour is a role, not a colour.** Inside `.ui-root` the text is `--ui-text` and what is said about
it `--ui-text-soft`, cream on night; `.ui-on-parchment` turns both to ink. A component sets its text in
the two roles and reads on either ground without knowing which it is on.

**Type is set by role**, a class a role, each named for what the words are doing rather than how big they
are: `ui-title`, `ui-epigraph`, `ui-heading`, `ui-caps`, `ui-label`, `ui-body`, `ui-quote`, and
`ui-numeral` for a number read as a number, lining and tabular so that a count does not jitter. Sizes are
in `em`, so a role inside a small card is small because the card is. The face is `--ui-font-text`, EB
Garamond as proposed, served with the page rather than taken from the machine.

**All of it is in the `ui` cascade layer**, and every class is `ui-`. The game's own stylesheet is in no
layer, so wherever the two meet the game's wins: a pane can place what the library gave it without the
library fighting back, and the library cannot reach into anything that is not its own.

## Pictures

A component draws a picture by **its kind and its name**, and never by a file of its own: `usePictures()`
in `ui/art/pictures.ts` is the list `npm run world:ui` cut, kept current, `pictureIn(list, kind, name)`
finds one in it, and `imageSetOf` or `sourcesOf` give CSS or an `<img>` every density it was cut at, for
the browser to pick from. So a picture Adam saves over another is drawn everywhere it is used, at once.
A picture's size as shown is in the list, a quarter of its size as painted; a component lays it at that
size, or scales it on purpose and says so. What the pictures are and where they go is
`AUTHORING-THE-ART.md`.

## Adding a component

1. **Its folder**, `frontend/apps/web/src/ui/<component>/`: the component, its stylesheet in the `ui`
   layer, and its arithmetic - anything that can be worked out without a browser, a padding, a position,
   a step - in a plain module beside it with a test. There is no React Testing Library here, and the web
   tests run without a browser; what a component looks like is checked on the page, by eye.
2. **Its place on the page**, in `frontend/apps/web/src/admin/showcase/`: a section in `sections.tsx`,
   or a part of one, drawn with `Specimen`, `Specimens` and `Part`. **A specimen's caption is the name the
   thing has in code**, so what Adam points at on the page is what a session searches for.
3. **Every variant, every state and more than one size.** A control is shown at rest, hovered, pressed,
   focused, chosen and disabled, side by side, rather than left for the pointer to find. A container is
   shown small, middling and large.
4. **Both grounds and both widths.** The page's switches put everything on night or on parchment and
   narrow the sheet to a phone's 390 pixels, and the sheet is a container, so a component that answers to
   its room answers to the switch exactly as it will to a phone. A component is not done until it reads
   at both.
5. **Nothing from the game.** `boundary.test.ts` fails on any import in `src/ui/` that leaves it, bar
   React, the fonts, and the world package's pure rules and types.

## Marks

A mark is drawn in code or painted, one mark at a time, behind the one component. To come, with step 6.

## The components

A line each: what it is for, its variants, and where on the page it is.

- **`BorderLayer`**, `ui/border/Border.tsx`: a border picture laid round whatever positioned box it is in,
  by name. `middle` and `repeat` say otherwise than its file, for looking. A name with no picture is drawn
  as a dashed outline, so a missing border is seen missing. *Borders and fills*, on the page.
- **`FillLayer`**, the same file: a fill picture repeated at the size it is shown, standing `inset` in from
  each edge; `fillInsetOf` the border round it says how far. *Borders and fills*.
- **`borderImageOf`, `fillImageOf`, `fillInsetOf`, `contentInsetOf`**, `ui/border/borderStyle.ts`: the
  arithmetic under both, for a component that lays a border itself.
- **`Container`**, `ui/container/Container.tsx`: a recipe, by name or given whole, laid round what it
  holds - as wide as whatever holds it and as tall as its content. `layoutOf` in `ui/container/layout.ts`
  is its arithmetic: the padding, the margin and every embellishment's place. *Containers*, where every
  recipe is shown holding what it is for, with the recipe written out beside it; the page's *layers*
  switch strips the room each keep-out takes and dashes each embellishment's box, and does the same
  wherever a container is inside something marked `data-ui-layers="shown"`.
- **`RECIPES`**, `ui/container/recipes.ts`: the named containers. The first are made from the moodboard -
  Adam's own sentence as `pane.cherub-corner`, the cathedral panel as `pane.cathedral`, its framed panes
  and its cards - and the game's own come as each surface is redone.
