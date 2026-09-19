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

**How the room is divided is the bays' own asking.** A bay holding the map asks to be big; a bay holding
the house status asks to be small. What each asks for comes from what it is holding, and the answer is one
of three:

- **One asks small and the other does not** — the small one gets the size it asked for and the other takes
  everything else. This is the common case and the one the default opens on.
- **Both ask the same**, both small or both big — **half each**. The two bays always fill the stage between
  them, so there is no third place for spare room to go and no reason to leave any.
- **One is minimised** — it gets its strip whatever the other asked for, and the other takes the rest.

### What that looks like

The default: the **map** in the big bay, the **house status** small beneath it, because it asked to be
small.

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│             │   │             │   │             │
│             │   │     map     │   │             │
│     map     │   │             │   │     map     │
│             │   ├─────────────┤   │             │
│             │   │             │   │             │
├─────────────┤   │   inspect   │   │             │
│ Erebus 1204 │   │             │   ├─────────────┤
│ ◉ · · · · · │   │             │   │ Erebus    ▴ │
└─────────────┘   └─────────────┘   └─────────────┘
   the default      a thing clicked   house minimised
```

The player clicks a castle on the map. The bay that is **not** the map becomes an **inspect window** on it,
and takes half the screen; the map keeps the top and the thing being inspected is on it. Closing the window
puts back what was there.

The player who wants the map **minimises** the house status. It collapses to a strip with its name on it and
the map takes the rest — a single-bay screen without the layout needing a single-bay mode.

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
house card's hint line goes when the column is squeezed, by a container query on its own tile, which is the
same thing it does on a phone.

## Panes and bays

**A pane is a thing that can occupy a bay.** The map is one, the house status is one, an inspect window is
one, and character dialogue will be one. A pane is declared once — what it is called, whether it wants to be
big or small, whether it can be minimised — and the layout places it. Nothing in the layout knows what a map
is, and no pane knows which bay it is in beyond the room it was given.

**A pane has up to three sizes, and it owns all three.** Full, small, and minimised. The bays ask for room
and the pane says what it looks like in the room it got; a pane that has no sensible small form says so, and
the bay holding it never asks to be small. **Nobody drags a divider** — the split moves because what is in
the bays changed, so it always sits where the content asked for it.

**Minimise collapses a pane to a strip** and gives its room back to whatever is beside it. **It is not the
bays' idea** — the same button works in the spread, where collapsing the house status gives the room to the
map. It is a property of a pane everywhere, not a feature of the small screen.

**The kebab at the divider says what else there is.** It lists the panes, and each row carries **the arrows**
— two marks pointing at the two bays, so the player says not only which pane but which bay. The same
arrows appear on an inspect window's links: *open this*, and *open this there*, are one gesture. The arrows
are a shared component and are described in `LOOK-AND-FEEL.md`.

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
| The map, with the sprite, area and influence overlays | Fills the stage | A pane; wants to be big |
| The house status, with the eye and the empty places | The corner tile, behind the shield tab | A pane; asks to be small, and can be minimised |
| Navigation, the way back to what you have looked at | The corner tile, behind the compass tab | A pane; wants to be big |
| An inspect window | A rail down the side, up to three | A pane; takes a bay, one at a time |
| The parchment | Over the map, while a choice is pending | **Not brought over yet.** Its one breakpoint asks the window and never fires |
| The debug panel, with the debug map inside it | Docked down the right, taking room from the stage | Not in the picture at all — see below |
| The worktree tabs and the build badge | Inside the debug panel | The same |

The debug panel is Adam's instrument rather than a player's and does not get a phone layout: it is the frame
the phone is looked at inside rather than something in the picture. The worktree tabs and the build badge
moved into it for the same reason.

## The instrument

**The phone toggle, in the very top right of the debug panel, confines the stage to 390 by 844.** The stage
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
- **The parchment's one breakpoint asks the window**, which is 1280 while the stage is 390, so it never
  fires. **Still open.** It is brought over when a choice roll is next worked on, not in a sweep.

## Not decided

- **Touch.** The one question the layout above does not answer, and the next thing this document owes. The
  choice roll's parchments lift on hover and the map is driven by drag and wheel; neither has an answer on a
  finger. The kebab and the arrows were drawn as taps rather than hovers on purpose, which is a start and
  not a design.
- **Whether 600 and 660 are right.** Two numbers somebody picked, not derived from anything: the first is
  where it folds and the gap between them is a guess about how fast a grip moves. Both move once there is
  enough at the boundary to judge them by. Two constants, in one place.
- **Whether a player can drag the split** after all, over the top of minimise. Nothing forecloses it.
- **What happens when a third thing wants the screen** — a dialogue while an inspect window is open, on a
  phone. Two bays and three claimants is a queue nobody has designed.
