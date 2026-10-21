# The component library

> **What belongs here:** the interface's component library - what each component is, the parts it is made
> of, its variants and recipes, how to compose a new pane from it, and how a new component is added. **What
> does not:** why the interface looks the way it does, which is `LOOK-AND-FEEL.md`; how it behaves across
> screen sizes, which is `RESPONSIVE-DESIGN.md`; where the art goes and what the tool does with it, which is
> `AUTHORING-THE-ART.md`; why it is painted art placed by CSS, which is decision record 0068; and the order
> it is being built in, which is `docs/plans/ui-component-library.md`.

**Built.** This is the method as agreed on 2026-09-30, written before the library so that the library was
built to it, and every part the plan named is now on the page: the foundations, the pictures, borders and
fills, the container, the buttons, the marks and readouts, the tabs and sections, the controls, the
collections, the dialog, the toast, the fields and the medallion. What comes next is the game's own
surfaces taken up into it, a plan each; a component one of them needs that is not here is added here
first, by the rule below.

## The page

**`/admin/inspect-ui-components`** is the library, shown. Every component in every variant, every state
and at more than one size, on a desktop and narrowed to a phone. It needs no game server and no map, and
its demonstrations are live: a container can be dragged to any size, a button pressed. It is the page a
component is looked at before it is used anywhere, and the page to read before making a pane. Its
*contrast* switch marks every word on it too faint to read against what is behind it, and counts them at
the top: see *Words that can be read*, below.

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
3. **Embellishments** - none or several pictures pinned to an anchor, a corner or the middle of an edge,
   none of them part of the nine-slice. Each says its **overhang**, how far it stands out past the box.
   **An embellishment takes none of the content's room**: it stands where it is pinned, over the border or
   out past it, and what room it needs is outside the box.
4. **Content** - set in from the box's edges where the border's file says - past its cuts and inset, or
   inside them, for a frame with deep corners and thin edges that says its content starts there - and
   then the recipe's padding.

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
    { art: 'cherub-standing', anchor: 'top-right', overhang: { x: 30, y: 30 } },
  ],
}
```

- `border` and `fill` are pictures by name; either can be left out. A border whose picture has a middle of
  its own draws it only when there is no fill. `scale` draws the border finer or heavier than its picture
  is shown, a tooltip's at half a card's, with its cuts in the same places.
- `text` is what the content is written in, `ink` on a light fill or `cream`, the default, on a dark one.
  The container sets its words from it, both ways, and never takes the colour of what it stands on: a dark
  pane on a parchment page keeps its cream. `soft: false` is for a recipe whose fill is too dark or too
  light for the softer ink, and whatever would be softer in it is in its main ink - the title plate's
  parchment, which is darker than a sheet, and the arch's own stone.
- `padding` is room between the border's inner edge and the content, beyond the border's own inset.
- An **embellishment** is a picture by name, pinned to an `anchor` - a corner, or `top`, `right`, `bottom`
  or `left` for the middle of an edge. `overhang` is how far it stands out past the box, `x` sideways and
  `y` up or down, away from it; a negative one sits inside. `behind` hangs it under the whole container,
  the fill too, as a drape hangs behind a panel; `height` draws it at another size than its picture's, in
  proportion; `mirrored` turns it left to right, so one cherub does for both corners.
- A container keeps a **margin as wide as its overhangs**, so nothing beside it runs under a cherub;
  `roomForOverhangs: false` for one whose room is known to be clear.

**So an embellishment is placed to stand clear of the words**: on the corner, over the moulding, out past
the box. The page's *layers* switch dashes each one's box and dots where the words start, so a cherub that
strays into them is seen. Why nothing keeps room inside the words for one, and the way back if one ever
has to stand over them, is decision record 0068.

Recipes are named for what they are used for, `pane.<which>`, `card.<which>`, `plate.<which>`,
`tooltip.<which>`, `dialog.<which>`, so that a recipe changed is a known set of places changed. A pane uses
a recipe and never sets a border of its own.

## Asking for a pane

The words to use are the layers. *A container for the pane that lists the holdings: the gilt border, a
parchment fill, a cherub standing on the top right corner, well out past the frame.* That sentence is a
recipe, and at most one new picture in `world/ui/`, which starts as a placeholder.

What the agent says back, before building: the recipe as written, the pictures it reads, which of them are
new and the size to paint each at.

## The foundations

**Colours and spaces are tokens**, custom properties on `:root` named `--ui-…`, declared in
`frontend/apps/web/src/ui/ui.css` and nowhere else. `ui/tokens.ts` lists each by name and by what it is
for, and the page draws its swatches from that list and reads the values back from the stylesheet. A
component uses a token and never a colour of its own; a colour a component needs that is not a token
becomes one, in both places, and `tokens.test.ts` fails until it is in both.

**Text colour is a role, not a colour.** Inside `.ui-root` the text is `--ui-text` and what is said about
it `--ui-text-soft`, cream on night; `.ui-on-parchment` turns both to ink and `.ui-on-night` back to
cream. A component sets its text in the two roles and reads on either ground without knowing which it is
on, and a container says which of the two it is from its recipe.

## Words that can be read

**Every word wants 4.5 to 1 against what is behind it**, and large words - 24 pixels, or 18.66 and bold -
want 3: the Web Content Accessibility Guidelines' AA. A disabled control asks nothing, as the guidelines
have it. Each ink is chosen to reach it on what it is for: `--ui-ink` and `--ui-ink-soft` on parchment,
`--ui-cream` and `--ui-cream-soft` on night and the dark fills. Ink on a dark fill, or cream on parchment,
is about 1 to 1.

Two checks hold it, and between them they see what either alone would not:

- **`readable.test.ts`**, beside the recipes, measures what is behind every recipe's words - its fill, or
  its border's own middle - from the picture in `world/ui/` itself, and holds both of the recipe's inks to
  it. A fill painted too light for cream words, or a recipe that says ink on a dark fill, fails the check
  with the recipe, the ink and the figure. A mark is held there too: on every pane whose words are cream,
  `--ui-gilt-light` - what a mark is picked out in, the tab that is up or the size chosen - wants the large
  words' 3 to 1 against the fill.
- **The page's contrast switch** measures every word on the page against what is painted behind it, the
  way it was drawn: up through the boxes it is in, and at each the layers under it - a fill, a border's
  middle, a button's face, a colour - with a picture taken at its average colour. Each word that falls
  short is dashed in red, and pressing the count at the top goes to each in turn with what it measures and
  what it needs. It is what catches a word on a ground nobody thought of, and it is measured again
  whenever the page changes. `admin/showcase/unreadable.ts`.

`contrastOf`, `colourOf`, `over` and `contrastNeeded`, in `ui/contrast.ts`, are the arithmetic both use.

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
size, or scales it on purpose and says so. **The page is served with the list written into it**, by
`vite/uiInPage.ts` in the dev server and the build alike, so the first frame draws its pictures without asking
for the list first, and with the loading screen's own pictures and the two faces its words are set in asked for
as the page is read, while its code is still arriving, so nothing on it moves after its first frame:
`ui/loadingScreen/pictures.json` names the pictures, and its test holds it to the recipes the screen is drawn in. What the pictures are and where they go is
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

A mark is drawn in code or painted, one mark at a time, behind the one component, `Mark` in
`ui/mark/Mark.tsx`. Every mark has a drawing there, on a square of 24, stroked at the weight every mark in
the interface is drawn at and in whatever colour the words around it are; a picture in `world/ui/marks/`
by the same name is drawn instead wherever there is one. A mark is named for what it means, not what it
looks like: `previous` and `next` are a carousel's steps and not the needle, which means *there*. The page
shows every mark at 17, 24 and 48 pixels side by side, because whether one reads small is a thing to see.

**The marks the game already draws are the game's drawings**: the five resources', a key figure's stats,
the close, the eye, the tower a structure is known by and the marks a pane is known by, copied stroke for stroke because the library cannot import them, and named as the
library names them - `domain`, where the protocol says `naturalDomain`. A copy is a drawing that can drift,
so `admin/showcase/marks.test.ts`, which is the page's and may read the game's files, fails the moment one
does. When the game draws its marks from the library there is one copy again and the test goes.

## Buttons

**A button is a mark or it is words, and which is Adam's call each time**, so both are built properly and
neither is the default. Every one is a real `<button>`: a pointer, a finger and the keyboard all press it,
and a mark button carries its meaning in words for the pointer's tooltip and for a screen reader.

**Every button has the same states, drawn the same way whatever its face**: lighter under the pointer,
darker and a pixel lower pressed, a gilt ring focused from the keyboard, a gilt glow chosen - a state
button that is on - and grey and dim disabled. They are light and shade over the one picture unless a state
has been painted (`AUTHORING-THE-ART.md`). `showing` draws a button hovered, pressed or focused without
anyone pointing at it, so the page can show every state side by side; the game never uses it.

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
  holds - as wide as whatever holds it and as tall as its content. With `fills`, it is instead the size of
  the box it stands in, as a pane is its tile's: it covers that box, its content is a box set in by the same
  cut, inset and padding, and a pane laid over the whole of it with `position: absolute; inset: 0` stays
  inside the frame and scrolls its own words. The frame is laid over the pane, and the pane is cut where the
  fill ends rather than where its words do, so a picture behind the words - a dialogue's scene - runs out
  under the moulding to the fill's edge by `--ui-bleed-top`, `-right`, `-bottom` and `-left`, which
  `bleedOf` works out, with the frame's ornaments in front of it. `layoutOf` in `ui/container/layout.ts`
  is its arithmetic: the padding, the margin and every embellishment's place. *Containers*, where every
  recipe is shown holding what it is for, with the recipe written out beside it; the page's *layers*
  switch dashes each embellishment's box and dots where the content starts, and does the same wherever a
  container is inside something marked `data-ui-layers="shown"`.
- **`RECIPES`**, `ui/container/recipes.ts`: the named containers. The first are made from the moodboard -
  Adam's own sentence as `pane.cherub-corner`, the cathedral panel as `pane.cathedral`, its framed panes,
  its cards and its Paris plate - with `pane.plain` for a tab bar to tuck under, and Adam's own frames,
  `pane.cherubs` and `pane.acanthus`. The game's own are named for the tile they dress: `pane.corner` and
  `pane.rail` in the acanthus frame on stone, `pane.right` in the cherubs' on felt, `pane.middle` in the
  clouds round their own sky, each at a scale that leaves the tile most of itself; and `strip.corner`,
  `strip.right` and `strip.middle`, the narrow gilt on the same fills, for a pane put away to its 44 pixels,
  which no deep frame fits; and `bar.bottom` and `bar.top`, the same gilt on stone, under the bottom bar's
  marks and round the top bar. *Containers*, under *Filling a tile*, shows each at the size the spread gives
  it, to be dragged smaller.
- **`Mark`**, `ui/mark/Mark.tsx`: a mark by name, drawn, or painted when `world/ui/marks/` has it: the
  five resources, `wealth`, `domain`, `influence`, `reason` and `piety`; a figure's `kindness`, `physical`
  and `age`; and `close`, `minimise`, `maximise`, `previous`, `next`, `fold`, `less`, `more`, `eye-open`,
  `eye-shut`, `warning` and `search`; `tower`, what a structure and the Holdings tab are known by; and a mark for each kind of omen a choice roll reads, `omen-house`,
  `omen-change`, `omen-window`, `omen-dialogue`, `omen-keyFigure`, `omen-map` and `omen-season`, drawn
  placeholders until a picture of the same name is painted; a quest's, `talk`, `checklist` and `reward` for
  the kinds of node, `unknown` for one not shown, `done` and `lost`, and the four buttons that are marks on Adam's
  word of 2026-10-15, `deliver`, `pledge`, `collect` and `quests`, drawn placeholders too; and the marks a pane is
  known by, named for the pane, the game's own drawings: `house`, `figures`, `letter`, `dialogues`, `map` and
  `recent`, the clock turned back that the trail is known by; and the rest a window's subject is known by,
  `area`, `river`, `lake` and `sea`; and `settings`, the gear that opens what is not the game's, a mark on Adam's
  word of 2026-10-21, a drawn placeholder until `world/ui/marks/settings` is painted. *Marks and readouts*.
- **`TextButton`**, `ui/button/Button.tsx`: words on a face that stretches between its end caps to fit
  them. `face` is a picture in `world/ui/controls/`, `primary` unless it says otherwise; `size` is `small`,
  `regular` or `large`, 32, 44 or 60 pixels tall. *Buttons*.
- **`MarkButton`**, the same file: a mark on a face, one size whatever it says; `label` is what it does, in
  words, and is its tooltip. A face with its mark painted in needs no `mark`. *Buttons*.
- **`StateButton`**, the same file: a mark that is on or off, like the eye, with a mark and words for
  each. *Buttons*.
- **`WindowControls`**, the same file: the window's three, put away, opened out and shut, in that order.
  *Buttons*.
- **`faceOf`**, `ui/button/face.ts`: the arithmetic under all four - how a face is laid at a height, where
  its words stop, and which of its states are painted.
- **`ResourceReadout`**, `ui/readout/ResourceReadout.tsx`: a resource as it is read - its mark, what it
  stands at, and how fast it moves when there is room. It does not know what a stock is: the game hands it
  `amountAt`, what it stands at at a moment, and `ratePerSecond`, and it asks again four times a second
  while the amount moves, so it counts up between events. The word is its tooltip, beside it with
  `showWord`, and always there for a screen reader. *Marks and readouts*.
- **`Badge`** and **`Badged`**, `ui/badge/Badge.tsx`: a count on the corner of a mark or a button, nothing
  at nought, `99+` past ninety-nine. A drawn velvet pip until one is painted. *Marks and readouts*.
- **`Tag`**, `ui/tag/Tag.tsx`: a word or two of quiet context beside a name - how fresh what is shown of it is,
  `current` or the day it was last seen - small, in the soft ink and a hairline outline of it, so the name keeps
  the eye. It is handed its words; saying a day is the caller's. Drawn rather than painted. *Marks and readouts*.
- **`Tooltip`**, `ui/tooltip/Tooltip.tsx`: a few words about what is under the pointer, in the
  `tooltip.plain` recipe - a moment after the pointer arrives, at once from the keyboard, and when a finger
  holds a thing down on a phone; gone at Escape. It is drawn over the whole page rather than inside what it
  is about, so a pane that clips cannot clip it, and `placeTooltip` in `ui/tooltip/place.ts` keeps it above
  what it is about unless there is only room below, and inside the window. While what it is about is out
  of sight - scrolled away, under a bar that stays at the top of a page, clipped by its pane - it is not
  drawn at all. *Marks and readouts*.
- **`Slider`**, `ui/slider/Slider.tsx`: a value set by dragging a knob along a tube, the moodboard's - the
  tube lit from its left end as far as the knob. Under the painting is the browser's own slider, unseen,
  its thumb as wide as the knob and laid so the two travel together, so the pointer, a finger, the arrow
  keys, Page Up and Down, Home and End and a screen reader all work it as any slider; `valueText` is the
  value in words when a number is not how it is said. `small`, `regular` and `large`, 32, 44 and 65 pixels
  tall, as a button of the same size is; the knob is centred on the track's middle, where its tube is. `shareOf` and `travelOf` in `ui/slider/range.ts` are its arithmetic. *Controls*.
- **`Meter`**, `ui/meter/Meter.tsx`: a level shown and not set, a slider without a knob - the cathedral's
  faith - in a tube, and the same tube full shown as far as the level, which glides when it changes. Its
  `look` is the pair of pictures it is drawn in, `meter` and `meter-full` unless it says otherwise, so a
  meter of another colour is another pair. *Controls*.
- **`Stepper`**, `ui/stepper/Stepper.tsx`: a count with `less` and `more` either side of it, as a key
  figure's stats are moved; the mark that would go past either end is disabled there, so the end is seen
  rather than found, and the count is said again to a screen reader when it changes. `stepped` in
  `ui/slider/range.ts`. *Controls*.
- **`Switch`**, `ui/switch/Switch.tsx`: a thing on or off, its name in words before it and its state after
  it - fog of war, on - and a knob at one end of the oval face's slot or the other, the slot glowing when
  it is on; `say` puts other words after it, or with `null` none. A real button that says it is a switch,
  so a screen reader hears its name and whether it is on. `small` and `regular`, 20 and 26 pixels tall.
  *Controls*.
- **`Choice`**, `ui/choice/Choice.tsx`: a choice of a few, side by side in the `choice.frame` recipe, the
  chosen one on parchment; an option is words or a mark, as a button is. A group of radio buttons: only the
  chosen one is a stop for Tab, and the arrows go along and choose as they go. *Controls*.
- **`HoldButton`**, `ui/hold/HoldButton.tsx`: hold to confirm, for what cannot be undone - killing a key
  figure: it does it only when held down for the whole of `holdMs`, a second and a fifth unless it says
  otherwise, by a pointer, a finger, or Space or Enter, while a fuse burns along under its words; let go
  sooner and nothing happens. A screen reader is told to hold it. `holdOf` in `ui/hold/hold.ts` is the rule,
  on a clock that can be stood in for. *Controls*.
- **`TabBar`** and **`Tabbed`**, `ui/tabs/TabBar.tsx`: several things taking turns in one place, and a row
  of tabs saying which is up. **A tab is a mark or words, as a button is**, and which is Adam's call: the
  game's own bar is marks. `small` is 30 pixels, the game's strip, and `regular` 40. The arrow keys go
  along the tabs and choose as they go, Home and End go to the ends, and a tab that cannot be chosen is
  passed over - `stepTo` in `ui/tabs/tabs.ts`; a row too long for its room scrolls across and fades rather
  than wrapping. `end` stands something at the far end of the bar, the tile's size control. `Tabbed`
  tucks the bar under the top of a pane's border, `pane.plain` unless it says otherwise, so the tabs stand
  out of the pane. *Tabs and sections*.
- **`BottomBar`**, `ui/bar/BottomBar.tsx`: a phone's way between its panes - a row of marks a thumb thick,
  `BAR_THICKNESS`, each an even share of it, the one standing in the bottom pane lit on the chosen tab's
  parchment, turned to open into the pane above. `along="down"` stands it down the right edge of a turned
  phone, the lit tab opening to its left. **Marks and no words**, Adam's call of 2026-10-08, each with its
  words as its tooltip. A toolbar of buttons that say whether they are pressed rather than a row of tabs,
  because pressing the lit one does something the game decides: the arrows, either pair, move along it -
  `stepAlong` and `stopOf` in `ui/bar/bar.ts` - and press nothing. It reads `borders/gilt-thin`,
  `fills/stone` and `controls/tab-chosen` through `bar.bottom`, all placeholders. *Bars*.
- **`TopBar`**, `ui/bar/TopBar.tsx`: a window on top of a phone in one band a strip
  thick: its mark, its `name` on one line and trimmed, a word `beside` it such as a `Tag`, and whatever
  stands at its `end`, the pane's controls. The map wears none: a bar across it was too heavy, Adam's
  word of 2026-10-08, and it carries its marks alone. `turned` makes it a sliver 44 wide down a turned phone, the controls at the top and the name
  reading down under the mark, the word beside it left out. It stands in `bar.top` unless it is
  `framed={false}`, for a bar inside something already framed. It reads `borders/gilt-thin` and
  `fills/stone`, both placeholders. *Bars*.
- **`Expander`**, `ui/expander/Expander.tsx`: an expandable section, a heading that folds what is under it
  open and shut in a fifth of a second - its name on a rule, the `fold` mark turned down when it is open,
  and an `aside` at the far end said either way, a count or a total. Held by whoever uses it with `open`,
  or by itself from `startOpen`; shut, nothing in it can be reached by the keyboard. *Tabs and sections*.
- **`ScrollArea`**, `ui/scroll/ScrollArea.tsx`: a box whose content scrolls inside it, down or `across`,
  with a thin gilt bar where the screen draws bars, fading at an edge with more beyond it - `edgesOf` in
  `ui/scroll/scroll.ts` says when. Scrolling it never scrolls what is under it, so a list in a pane does not
  drag the map. When there is more than fits the keyboard can stop on it to scroll it, unless it is
  `focusable={false}` because everything in it is a stop already, as a tab bar's tabs are. *Tabs and
  sections*.
- **`Divider`**, `ui/divider/Divider.tsx`: a painted rule between two things, as the moodboard draws them
  between its sections, laid between its two ends at any width. `knot` stands an embellishment in its
  middle and `title` puts a section's name at its start, or in its middle with `align="middle"`; the line
  runs up to either rather than stopping at an end of its own. The rule is a picture in
  `world/ui/dividers/`, `gilt` unless it says otherwise. `Rule` is the rule alone, for a component that
  puts one beside something of its own, as `Expander` does, and `ruleStyleOf` in `ui/divider/rule.ts` is
  its arithmetic. *Tabs and sections*.
- **`TitlePlate`**, `ui/plate/TitlePlate.tsx`: the cartouche a place's name and its figure sit on, as wide
  as its words: `title`, then the `figure` and what it `says`, and an `emblem` before them. `plate.place`,
  or `plate.heading` for a pane's name, the same plate a little over half the size. Held narrower than
  its words, the name gives way first. *Tabs and sections*.
- **`Card`**, `ui/card/Card.tsx`: a container small enough to be one of many - a key figure, something
  that happened - in its recipe, `card.figure` unless it says otherwise: a `picture` at its head, or down
  its left with `across`, keeping its `shape`, three by four for a portrait, and covering it; its `title`,
  a `line` under it saying what it is, and whatever else it holds. Given `onPress` the whole card is one
  button, its name stretched over all of it, so a screen reader hears the name once - or `label`, when the
  name on the card is not the whole of it - and a pointer can press it anywhere. It lifts under the
  pointer, goes back down pressed, has a gilt ring focused, a gilt glow chosen that is a dark edge on
  parchment, and greys disabled. Given a `rarity` - `common`, `uncommon`, `rare` or `legendary` - it is a
  rolled thing, an option of the choice roll: edged in the rarity's colour, glowing more the rarer and the
  legendary breathing, and saying its rarity in words on a pill at its head, because a colour alone is not read
  by everybody. Nothing painted: the edge, the glow and the pill are the rarity tokens. *Collections*, under
  *Rolled*, beside the large `TextButton` that rolls.
- **`Grid`**, `ui/grid/Grid.tsx`: things of one kind in rows and columns, every cell the same width -
  `columns` across, or as many as fit at `least` pixels - and a card as tall as the tallest in its row.
  With `rows` as well it **never scrolls**: every cell is sized so all of them fit the room it is given,
  whichever of its width and its height is the tighter, keeping the cell's `shape`, and is that size
  however many things there are, so a fourth never moves the first three - the key figures' three by
  three. That grid has to be given a height. It is worked out in container units, as the game's key
  figures are, so nothing is measured; its words are as big as its cells allow, and a name in it is one
  line, cut short where it has to be. *Collections*.
- **`Carousel`**, `ui/carousel/Carousel.tsx`: one thing at a time, the moodboard's round arrows either
  side and its dots beneath - the small form of a list, the choice roll's options in a strip beside the
  map. Stepped by the arrows, the dots, the arrow keys and Home and End, and a swipe; round from the last to
  the first unless `wrap={false}`, when the arrow that would go past an end is disabled there. What comes
  in slides in from the side it came from. Every thing is laid in the same place and only the one shown is
  seen, so it is as tall as the tallest and nothing jumps; a swipe that ends on a card is not a press of
  it. Held with `at` or by itself from `startAt`. `stepOf`, `keyStepOf` and `swipeOf` in
  `ui/carousel/step.ts` are its arithmetic. *Collections*.
- **`Dots`**, `ui/dots/Dots.tsx`: a dot for each of a few things, a gilt ring each and a gilt ball for the
  one shown. Given `onAt`, each is a button that goes to its thing, in room enough for a finger, saying
  "2 of 5"; without, the row is a picture of where in the run the one shown is. *Collections*.
- **`List`** and **`ListRow`**, `ui/list/List.tsx`: things one under another with a fine rule of the
  words' own colour between them, each a row: a `lead` at its start, a mark or a small portrait; its
  `title` and a `line` under it; a `trail` at its end, a figure or a button of its own, which stays a thing
  to press by itself. Given `onPress` the whole row is one button, its name stretched over it, as a card's
  is. Its states are a light of cream over it rather than a shade, because shade takes from the ink's
  contrast on parchment; chosen is a bar down its start as well. A list too long for its room goes in a
  `ScrollArea`. *Collections*.
- **`Socket`** and **`SlotRow`**, `ui/socket/Socket.tsx`: one place in a structure's slot, and the slot's row
  of them. A socket is upright, three by four as a portrait is, `size` pixels tall: **empty**, a frame in fine
  dashes of the words' own colour; a **portrait**, a person's picture covering it; an **item**, its picture or
  the first letter of its name until it has one, and its `amount` on a velvet pip at its foot; **unknown**, a
  question, for what the viewer is not told; and **more**, `+3`, the last of a row too long for its room. Given
  `onPress` it is a button with every button's states. A `SlotRow` is the slot's name and how full it is on one
  line - *dungeon*, *2 of 3* - and a socket a place under them, what fills it first and an empty frame for each
  place left, wrapping in a narrow room; `secret` is a question in every place and *? of 4*, and past `most`
  the last socket says how many more. Drawn, a velvet recess in a gilt line, and reads no picture of its own:
  the portraits and the items' pictures are the pane's to give. `ui/socket/slots.ts` is its arithmetic.
  *Slots*.
- **`Dialog`** and **`DialogBox`**, `ui/dialog/Dialog.tsx`: a question that has to be answered before
  anything else - kill this key figure? - over the whole page, the page behind dimmed with night and out of
  reach. The browser's own modal dialog is under it, so it is drawn over everything, the keyboard stays in
  it, and when it goes the keyboard goes back to whatever opened it; Escape, its close mark and a press on
  the dimmed page put it away, `onClose`, unless it is not `dismissable`. Whoever uses it holds whether it
  is `open`. Its `title` is the question, its children what there is to know, in a scroll area when there
  is more than the window holds, and its `actions` the answers, the one the question is about last - a
  `HoldButton`, for what cannot be undone. The page behind does not scroll while it is open. In the
  `dialog.plain` recipe unless it says otherwise; `DialogBox` is its frame alone. *Dialogs and fields*.
- **`Toasts`**, `ui/toast/Toasts.tsx`: things that happened, said in the bottom right corner of whatever
  holds them and gone once read - from five seconds to twelve, longer for more words, `stayOf` in
  `ui/toast/life.ts` - and never while the pointer or the keyboard is on one; or put away by its close
  mark, or kept with `stays`. The newest is nearest the corner, and a screen reader is told each as it
  comes. Whoever uses it holds the `items` and takes one away at `onGone`; what they said is the event
  log's to keep. `place="flow"` lays them where they are. In the `toast.plain` recipe. *Dialogs and
  fields*.
- **`TextField`**, `ui/field/TextField.tsx`: words typed on a strip of parchment in a gilt rim, the
  moodboard's "Enter a name…", on the `field` face. Its `label` over it - said only to a screen reader with
  `hideLabel` - and a line under it: its `hint`, or in place of the hint a `problem`, what is wrong with what
  is in it, after the `warning` mark, which a screen reader is told as well and the rim shows with a glow
  of velvet. Given `onSearch` it is a search, its `search` mark at its end, and Enter searches too. Its words
  are ink whatever it stands on, because the parchment is its own; they are drawn by the browser, which the
  page's contrast switch cannot see, so `readable.test.ts` holds them to it instead. Held with `value` and
  `onChange`. `small` and `regular`, as tall as a button. *Dialogs and fields*. Of `kind` `email` or `password` it is
  one a browser's password manager fills and offers to save, as its `autoComplete` names it - `username`,
  `current-password`, `new-password` - and a password's has the eye at its end, `eye-shut` and `eye-open`, that shows
  what is typed. *Signing in*.
- **`Form`**, `ui/form/Form.tsx`: fields one under another and the buttons that answer them under those, the one
  that sends it last, sent by a `TextButton` given `sends`, or by Enter in any field, which is `onSend`. A real
  `<form>`, so a password manager finds the email and the password in it; the browser's own checking is off, and what
  is wrong is said by each field in the game's words. *Signing in*.
- **`ProviderButton`**, `ui/provider/ProviderButton.tsx`: signing in through Google or Discord, *Continue with
  Google* and *Continue with Discord*, drawn as their own brand rules draw a sign-in button - Google's white with its
  four-colour G, Discord's blurple with its mark - in colours that are theirs, `--ui-google-*` and `--ui-discord-*`.
  **The one button that is neither painted nor ours to choose a mark or words for**: their rules decide, so a player
  knows each at once from every other site that has one. As tall as a regular button and as wide as what it stands
  in. *Signing in*.
- **`Dropdown`**, `ui/field/Dropdown.tsx`: one of many picked, on the same face, the one picked written on
  it and the `fold` mark at its end turned down. The browser's own list is under the painting, so a pointer,
  a finger, the arrow keys and typing the first letters pick, a phone opens its own picker, and an option
  can be `disabled`; where the browser lets its list be drawn, it is drawn on night with a gilt edge, and
  elsewhere it is the browser's. Held with `chosen` and `onChoose`. *Dialogs and fields*.
- **`ReportCard`**, `ui/report/ReportCard.tsx`: what a choice roll took into account, filling like the scores
  at the end of a level - each **`OmenRow`**, its kind's mark, its words and a value at the far end, slamming in
  as it lands. `landed` says how many omens are in; a press on it is `onHurry`. **`OmenStrip`** is the list folded
  away, the marks in a row with their words for tooltips; `small` on an option card, the omens that brought
  it. The rarity is
  the options' to say, by their tag and their glow, and nothing here says it. **`RolledHand`**, beside them, lays
  a hand out in one of two forms: `full`, the list, a divider and the options in a row along the bottom;
  `stacked`, a phone's, everything one under another for whatever holds it
  to scroll. On a desktop its options never scroll: they are written to fit. `ui-pop` is the class an option
  pops in by. **`playOf`** in `ui/report/timing.ts` is how a roll plays over time - omens a third of a second
  apart, a beat, the options a seventh apart - and how a hurry lands the rest of the omens; **`usePlay`** plays
  one in a component. *The choice roll*, where a roll is played in each form in a room the size the game gives
  it, at each rarity, and every part on its own.
- **`QuestNode`**, `ui/quest/QuestNode.tsx`: one node of a quest's map, a round seal of velvet in a gilt ring with
  its kind's mark, or a seal of night with `unknown` while it is not shown for what it is, and its title under it,
  two lines at most. `state` is `current`, lit with a gilt glow, `ahead`, `done`, with a gilt tick on its shoulder,
  or `lost`, struck through and faded. Pressable with `onPress`, `chosen` while it is open. **`QuestMap`**, beside
  it, lays nodes out from the top down by the row and the column the caller gives each, spread evenly across its
  width, and draws the edges under them - walked in gilt, ahead in fine dashes, lost faded - from under a node's
  title, so an edge never crosses one, with a stub where an edge leads to a node not drawn; `mapLayout.ts` is its
  arithmetic. **`ChecklistRow`** is one row of the checklist a node opens to: a box, ticked once met - filled with gilt
  and the tick in night on it, so it reads on parchment as on night, which `tick.test.ts` holds - what it asks
  with a mark before it, the mark button that meets it for a row the player meets, and a soft line under it saying
  why the button is greyed or that the world ticks it. *Quests*, where every kind and state is shown, three maps -
  at the start, on a road with a node open, and with stubs - and the checklist's rows, on night and on the parchment
  of the card the game draws them on. Drawn, nothing painted; a
  painted mark is a picture in `world/ui/marks/` by the mark's name.
- **`Medallion`**, `ui/medallion/Medallion.tsx`: a round or oval frame, one fixed picture and never sliced,
  drawn `size` pixels tall. Where its frame is clear inside itself it has a window, and the `picture` it is
  given - a key figure's portrait - shows through it, covering it and cut to its round; the window is found
  from the picture by `npm run world:ui`, `windowOf` in the world package's `uiWindow.ts`, so a frame
  painted with a clear middle needs no file beside it. Painted whole - the compass, a house's shield - it
  is an emblem and holds nothing. Its `label` is what it is for a screen reader. *Dialogs and fields*.
- **`LoadingScreen`**, `ui/loadingScreen/LoadingScreen.tsx`: what covers the game while it is made ready, over
  the whole of whatever holds it and everything in it: a `title` on its plate in the middle, a line under it,
  `says`, and a meter of how far along the work is, `share`, nought to one, only when there is a figure for it.
  Its words grow with it, a phone's at a page's size and a wide window's nearly twice that. Its pictures are on
  their way with the page itself, so its first frame is drawn whole, and where they are not yet there it is drawn
  in the colour its sky averages to, so it covers from its first frame. `lifted`, it
  fades over `FADE_MS` and is gone, taking no pointer from the moment it starts to, and says so at `onGone`;
  covered again, it is there at once. In the `screen.loading` recipe. *The loading screen*, where it is played
  through as the game plays it, and held in each state and at a phone's shape.
