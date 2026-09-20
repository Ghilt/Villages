# Designing for every screen

> **What belongs here:** how the interface behaves across screen sizes — the rule that we design for phone
> and desktop together, what each shape gets, and the layout decisions every component follows. **What does
> not:** how any one mechanic looks, which is that mechanic's own look-and-feel section in `MECHANICS.md`,
> and the shared visual language of colour and component style (`LOOK-AND-FEEL.md`).

## The rule

**Mobile is designed for from the start, not ported to later.** Every component is laid out for a phone and
for a desktop at the same time, in the increment that builds it. A component that only works at 1600 pixels
wide is not finished, and "we will make it responsive later" is how an interface ends up being rebuilt
instead.

This is a rule about when, not only about how. The cost of responsive layout is small while a component is
being written and large once a dozen of them assume a big screen.

## The two forms

The stage has two forms, and **one number picks between them: 600 pixels on the stage's shorter side.** Above
it, the spread; at or below it, the bays. There is no tablet shape in between. See decision record 0040.

**The spread shows everything at once.** It is **tiles on a map**: the map is the floor, filling the stage
and lying under everything, and the rest are tiles laid on it that never overlap each other. Seeing them
together is part of reading the world, and a large screen can hold them. See decision record 0041.

**The bays show two things at once.** The stage splits into two boxes along its **longer** dimension — a
portrait stage divides top and bottom, a landscape one left and right — and the player says what goes in
each.

Two, not one. A map game where the map disappears whenever you read something is a map game played from
memory; the thing being talked about and the thing it is about belong on the screen together.

**How the room is divided belongs to the fold, not to the panes in it.** A bay is not a pane's own room:
it is one end of a stage two things are sharing, and what happens to be standing in it has nothing to say
about how much of it there is. So there is one value with three settings, and there is no fourth
arrangement:

- **A strip and the rest** — one bay is put away to 44 pixels and the other takes everything else. What a
  phone opens on, with the map opened out.
- **Half each** — measured, not declared. The middle size means the same thing on every pane.
- **The rest and a strip** — the same again, the other way round.

**Both bays put away is not a state a player can reach**, and not because a rule forbids it: there is no
arrangement that says it. **Naming one bay's size names the whole arrangement**, so the two controls can
never disagree — they read one value rather than writing into each other.

**Nothing but the control moves the seam**, with one exception. Putting a different pane in a bay, pressing
the **compass**, closing a window, answering a letter: none of them changes how the stage is divided. The
exception is something *arriving* in a bay that is a strip — a window opened on a clicked castle, or a
letter the world has just sent — which opens that bay to half, because a thing nobody can read is not an
answer to a click. The compass is not one of those: what it opens is a list of ways on, and a strip of it
is still a list of ways on. See decision record 0046.

### What that looks like

The three arrangements, upright. The same three turned, cut into a left and a right.

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│             │   │             │   │ Map         │
│             │   │     map     │   ├─────────────┤
│     map     │   │             │   │   Erebus    │
│             │   │             │   │             │
│             │   ├─────────────┤   │  1204 marks │
│             │   │   Erebus    │   │             │
├─────────────┤   │  1204 marks │   │             │
│ Erebus  ▁▄█ │   │ ◉ · · · ▁▄█ │   │ ◉ · · · ▁▄█ │
└─────────────┘   └─────────────┘   └─────────────┘
  the default        half each      the house out
```

**The default** is the map opened out with the house status a strip beneath it: the game is read off the
map, and the card is 200 pixels of a phone's 844 that nobody has asked for yet. Pressing the strip is the
first gesture there is, and it teaches the whole control.

**The player who wants their house presses the middle mark**, and gets half the stage — enough for the
shield, the blazon, the treasury and the bar of levers, with the map still up above it.

**Opened out, the map goes to a strip of its own** saying *Map*, and pressing that strip is the way back.
That is the map's one exception among the panes: it carries no size control, because three marks in 44
pixels of map would be three things to aim at where the only useful one is the map itself.

**A thing clicked on the map takes the bay that is not the map's**, and if that bay was a strip it opens to
half, because a window nobody can read is not an answer to a click. Closing it puts back what was there,
and leaves the arrangement alone.

## What the spread is made of

The map is the **floor**. Everything else is a **tile** lying on it, and the tiles never overlap each other —
which is arithmetic with a test rather than a stylesheet anybody has to trust. There are three.

```
┌──────────────────────────────────────────────┐
│ VILLAGES                                     │
│ ┌───────────┐                                │
│ │           │                                │
│ │  the rail │                                │
│ │           │         the floor:             │
│ │  up to 3  │      the map, under it all     │
│ │  windows  │                                │
│ ├───────────┤                                │
│ │ Erebus    │   ┌──────────────────────┐     │
│ │ ◉ · · · · │   │   the bottom middle   │    │
│ └───────────┘   └──────────────────────┘     │
└──────────────────────────────────────────────┘
   the column          whatever is running
```

**The column is one piece of furniture**, set into the stage's left and bottom edges rather than floating a
gutter off them. Its two tiles share a width and one gutter between them, so they read as a column and not
as two cards that happen to be near each other. It wants the width the house card was drawn at and gives
that up to a third of the stage before it gives up anything else.

**An empty tile takes no room.** Nothing in the corner and the column runs to the bottom; no choice pending
and the map keeps the whole bottom of the stage. A tile is never reserved against a future.

**A tile can hold more than one pane, behind a tab bar.** The corner does: the house status and
**navigation** take turns in it, and a strip of marks across its top says which is up. The panes declare
that they share; the layout never decides it, so the tabs cannot appear and vanish as the window is
dragged. The tile is as tall as whichever pane is up. See decision record 0042 and `LOOK-AND-FEEL.md`.

**A pane says which tile it sits in and how tall it is**, and the layout places it. The tiles are named for
where they are — `left`, `bottomLeft`, `bottomMiddle` — so nothing in the layout knows what a map is.

**A tile that runs out of room clips, and what is in it draws itself smaller.** Never a scrollbar, and
**never a change of form**: only the stage's shorter side decides whether it is the spread or the bays. The
house card's hint line goes when the column is squeezed, and the choice roll's options go from three across
to one under the other — both by a container query on the tile, which is the same thing each does on a
phone.

**The bottom row cannot run out.** The column is capped at a third of the stage and the spread only exists
above 600 on the shorter side, so the tile along the bottom middle is never narrower than **281 pixels**,
which is room for the carousel. A test sweeps every stage the spread can be and asserts that floor, so if
the column is ever widened the thing that breaks says so. See decision record 0044.

## Panes and bays

**A pane is a thing that can occupy a bay.** The map is one, the house status is one, an inspect window is
one, and character dialogue will be one. A pane is declared once — what it is called, whether it wants to be
big or small, whether it can be minimised — and the layout places it. Nothing in the layout knows what a map
is, and no pane knows which bay it is in beyond the room it was given.

**A pane has three sizes, and it owns all three.** Full, small, and minimised. The layout says how much
room there is and the pane says what it looks like in the room it got. **Nobody drags a divider** — the
split moves because the player named an arrangement, never because something was moved into a bay.

### The six states a pane has on a phone

**Three sizes, twice over: once upright and once turned.** A phone is 390 by 844 held one way and 844 by
390 held the other, so a bay is a low wide box in the first and a tall narrow one in the second. Three
sizes in two cuts is **six states**, and a pane is not finished until all six have been looked at. The
instrument has a toggle for each.

| | upright | turned |
|---|---|---|
| **Minimised** | a band across the stage, 44 tall, with the pane's name on it | a sliver down the stage, 44 wide, the same thing a quarter turn round |
| **Medium** | the top half or the bottom half | the left half or the right half |
| **Big** | the stage, less the other pane's strip | the same |

**Minimised is the same for every pane, and unless a pane says otherwise it is just the pane's name.** One
thickness, one shape, so that putting anything away looks like putting anything else away. **The controls
go to the end the compass is not standing at** — in from the right upright, and at the top turned, with
the name reading down from under them — because a strip's controls are the one thing on it that has to be
hittable. Two panes say
otherwise and say why: **navigation** carries the marks of the panes it could put in the other bay, because
a list of ways on is what it is for; and the **map** carries no size control at all and is itself the way
back, because three marks in 44 pixels of map would be three things to aim at where the only useful one is
the map. Both are **stated** exceptions rather than quiet ones, and navigation's is not a nicety: it is the
strip a player arrives in by pressing the compass.

**Medium and big are the pane's own business, and may be one drawing or two.** A pane whose full form is a
list can draw the same list medium and simply show less of it; the **choice roll** is the one that
genuinely draws something else, which is the **carousel**. What is not allowed is a size that only works in
one cut — a pane that reads at 390 by 422 and not at 422 by 390 has five states and a hole.

**The spread is not one of the six.** A tile's height there is its own and the map behind it takes what is
left, so the desktop is a separate set of requirements and this section does not speak for it. It has the
same three sizes and the same one control; what differs is who the room belongs to. See decision records
0045 and 0046.

**Every pane carries a pane size control** in both forms, bar the map — three marks saying how much of the
stage it is taking: put away, the normal size, opened out. In the **bays** it names the arrangement, and
the other bay follows because both of them are reading one value. In the **spread** each tile's height is
its own, because a tile is not dividing anything with anybody. See decision records 0045 and 0046 and
`LOOK-AND-FEEL.md`.

**The compass in the corner is the way to everything else.** It stands in the stage's bottom right corner
and is in the same place however the split moves - it rode the divider until 0047, and the divider is the
one thing on the stage that moves. One tap puts **navigation** in the bay under the thumb, which is the
bottom one on a tall phone and the right one on a wide one, and navigation lists the panes above a divider
and the **trail** below it. It **never resizes anything**, which is what lets it land in a strip: a strip
of navigation carries the marks of where else to go, so it is still a way somewhere. Every row carries
**the arrows**, so any pane can be put in either bay and the one it is already in is marked rather than
taken away. **No pane is privileged there**: the map is not pinned where it is, and which bay two panes
share on a desktop has nothing to say about where either of them can go on a phone. In the spread the
compass is a tab in the corner instead, and a row there is a plain click, because there are no bays to
choose between. See decision records 0043 and 0047 and `LOOK-AND-FEEL.md`.

**The spread shows everything; the bays choose.** That is the whole difference, and it is what stops the
phone from being a second design. A mechanic is written once, at up to three sizes.

## Container queries, not breakpoints

**A media query cannot see the stage.** The stage is a containing block, and it is 390 wide inside a window
that is 1280, so a breakpoint asking the window never fires. Anything inside the stage that reacts to its own
room uses a **container query**. The one exception is the fold itself, which is arithmetic on a measured size
in a module of its own, the way `stageBox.ts` already is.

This is a real constraint and it is the right one: a component that only reads correctly when it happens to
be the whole window is exactly what the rule at the top exists to prevent.

## What exists today, and what it does in each form

| Part | In the spread | In the bays |
|---|---|---|
| The map, with the sprite, area and influence overlays | Fills the stage | A pane; opened out by default, and puts away to a strip that is its own way back |
| The house status, with the eye and the empty places | The corner tile, behind the shield tab | A pane; a strip by default, and half the stage when the player asks |
| Navigation, called *Go to*: the panes above, the trail below | The corner tile, behind the compass tab | A pane; it takes whatever the bay it lands in is |
| An inspect window | A rail down the side, up to three | A pane; takes a bay one at a time, and opens it to half if it was a strip |
| The choice roll, on its parchments | The bottom middle tile, while a choice is pending | A pane; arrives in the map's bay with room to read it, and the player folds it to the carousel |
| The debug panel, with the debug map inside it | Docked down the right, taking room from the stage | Not in the picture at all — see below |
| The worktree tabs and the build badge | Inside the debug panel | The same |

The debug panel is Adam's instrument rather than a player's and does not get a phone layout: it is the frame
the phone is looked at inside rather than something in the picture. The worktree tabs and the build badge
moved into it for the same reason.

## The instrument

**Two toggles in the very top right of the debug panel confine the stage to a phone**, upright and in
landscape — 390 by 844, and the same turned. The landscape one is the only way to see the stage cut into a
**left and a right** rather than a top and a bottom, and the only shape short enough to find out whether a
pane lives in 390 pixels of height.

**The phone toggle confines the stage to 390 by 844.** The stage
is the box the player's interface is laid out in, and the panel takes room from it rather than floating over
it. Two grips resize it to anything in between. So the rule above is checkable while a component is being
written, at one click, on whatever monitor there happens to be. See decision record 0039.

**Dragging the side grip slowly across 600 is the test that matters.** It is the one thing that cannot be
faked: the layout folds and unfolds in place, and whether it does so gracefully is a thing to be looked at
rather than asserted.

**It folds at 600 and unfolds at 660**, which is not the same number on purpose. One threshold makes the
boundary a cliff, and a grip resting on it flickers between two whole layouts; sixty pixels of dead band
means the width that folds it is never the width that unfolds it. In between, the stage keeps what it had.
See decision record 0041.

What the instrument found, and where each stands:

- **The house card asked for `min-width: 26rem`**, which is 416 pixels against a phone's 390. **Fixed, and
  then fixed again.** The three sizes fixed the folded form; the spread went on asking for 26rem until the
  corner became a tile, and the card now fills whatever tile it is given at every size.
- **The parchment's one breakpoint asked the window**, which is 1280 while the stage is 390, so it never
  fired. **Fixed**, by decision 0044, which deleted it and left no `@media` rule anywhere in the app.
- **A strip turned on its side dropped its name.** There is no room for a word across 44 pixels, so a
  put-away pane in landscape was two marks and nothing saying what it was. **Fixed** by decision 0046,
  which turns the name to read down the strip instead - there is eight hundred pixels of room along one.
  It was the map that forced it: the map's strip is its own way back and carries no marks, so dropping
  the name left a blank bar.
- **The house's bar of levers has six places, and a landscape bay half a phone wide is 422 pixels.** That
  is 70 pixels a place, which is fine; put away it is 44 pixels wide and the bar is not drawn at all.
  Nothing wrong yet, and the first thing to look at when the bar starts filling.

## Not decided

- **Touch.** The one question the layout above does not answer, and the next thing this document owes. The
  choice roll's parchments lift on hover and the map is driven by drag and wheel; neither has an answer on a
  finger. The compass, the needles and the tabs were drawn as taps rather than hovers on purpose, which is a start and
  not a design.
- **Whether 600 and 660 are right.** Two numbers somebody picked, not derived from anything: the first is
  where it folds and the gap between them is a guess about how fast a grip moves. Both move once there is
  enough at the boundary to judge them by. Two constants, in one place.
- **Whether a player can drag the split** after all, over the top of minimise. Nothing forecloses it.
- **What happens when a third thing wants the screen** — a dialogue while an inspect window is open, on a
  phone. Two bays and three claimants is a queue nobody has designed.
