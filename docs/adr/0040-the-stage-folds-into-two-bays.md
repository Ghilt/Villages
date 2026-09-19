# 0040. The stage folds into two bays, and a pane can be minimised

- Status: accepted
- Date: 2026-09-19
- Words corrected the same day: **a pane is the thing, a bay is the box it sits in.** This record was
  written with those two the other way round - a view occupying a pane - and they are swapped throughout.
  Nothing about the decision changed. Adam says "pane" for the thing, and a vocabulary the person using it
  has to translate is a vocabulary that will be got wrong for as long as the project runs. Corrected before
  anything was built on the old words, which is the only cheap moment there was going to be.

## Context

Decision 0039 gave the responsive rule an instrument: the debug panel takes room from the world, what is
left is the stage, and a toggle confines it to 390 by 844. What it did not give it is a layout.
`RESPONSIVE-DESIGN.md` says so in as many words — "Not decided: nearly all of it" — and lists four
questions, of which the first is how a player moves between panes on a phone at all.

That was affordable while everything on the stage was one of a kind: one map, one house card, one inspector,
one parchment, each positioned by hand in a corner. It stops being affordable with the first mechanic that
has a variable number of surfaces. The **inspect window** in `MECHANICS.md` is that mechanic: it shows up
to three windows at once where there is room, one at a time where there is not, and its links have to be
able to say *which* of the places on the screen a thing should open into. None of that can be written
against a layout that does not exist, and writing it against a desktop only is the thing the rule exists to
prevent.

Two constraints are already fixed and cannot be designed around. **A media query cannot see the stage** —
the stage is a containing block and the window is 1280 while the stage is 390, which is why the parchment's
one breakpoint never fires (0039). And **the map cannot be thrown away and remade**: `MapView` calls
`map.remove()` when it unmounts, and MapLibre holds the camera, the style and a WebGL context, with the
sprite overlay's Pixi canvas beside it.

The old answer in `RESPONSIVE-DESIGN.md` was "a phone shows one thing at a time". Looking at it, that is
wrong in a useful way. A phone can hold two things, and for a game read off a map it should: the map with
the house under it is legible in a way that the map alone, with the house one tap away, is not.

## Decision

**The stage has two forms, and one number picks between them.** Above 600 pixels on its **shorter** side it
is the **spread**: everything at once, the map filling it, the house status in a corner, inspect windows in
a rail. At or below 600 it is **the bays**: two boxes, split along the stage's **longer** dimension, so a
portrait stage divides top and bottom and a landscape one divides left and right. One number, on the
shorter side, because that is the side that runs out; there is no tablet shape between the two.

The number is arithmetic on a measured size, in a pure module with its own test, the way `stageBox.ts`
already is. Everything *inside* a bay that has to react to its own room uses **container queries**, never
media queries, for the reason 0039 recorded.

**A pane is a thing that can occupy a bay.** The map is one, the house status is one, an inspect window is
one, and character dialogue will be one. A pane is declared once — what it is called, whether it wants to
be big or small, whether it can be minimised — and the layout places it. Nothing in the layout knows what a
map is, and nothing in a pane knows which bay it is in beyond the room it was given.

**The bays ask for the room, and a manager divides the stage between them.** What a bay asks for comes
from what it is holding: a bay holding the map asks to be big, a bay holding the house status asks to be
small. One asking small and the other not, the small one gets what it asked for and the other takes
everything else. **Both asking the same, small or big alike, and they get half each** — the two bays fill
the stage between them, so there is no third place for spare room to go. A minimised bay gets its strip
whatever the other asked for.

Nobody drags a divider: the split moves because what is in the bays changed, which means it is always where
the content asked for it and never where it was left by accident.

**Any pane can be minimised, and minimise is not the bays' idea.** A minimised pane collapses to a strip
and gives its room to whatever is beside it, which is how a player gets a screen that is effectively one
thing without the layout having a one-thing mode. **The same button works in the spread**: collapsing the
house status there gives the room back to the map. A pane is responsible for what it looks like minimised,
the same way it is responsible for what it looks like small — the layout gives out room, it does not decide
what fits.

**The kebab at the divider says what else there is.** It lists the panes, and each row carries **the
arrows**: two marks pointing at the two bays, so the player says not only which pane but where. The same
arrows appear on an inspect window's links, which is the point of them — "open this" and "open this *there*"
are one gesture.

**The spread shows everything; the bays choose.** That is the whole difference between the forms, and it
is what stops a phone layout from being a second design. A pane is written once, at three sizes.

**The map keeps living across a rearrangement.** A pane moves between bays by changing which cell of a
grid its wrapper sits in, not by being unmounted and mounted somewhere else. One DOM tree, no portals. This
is free because everything on the stage is already `position: absolute; inset: 0`, so a pane only ever
needed a positioned box around it, and the stage was already that box.

## Consequences

MapLibre keeps following its container, as it did when the stage narrowed (0039), so there is still no
`map.resize()` anywhere. What is new is that the container changes **shape** and not only size: a map that
is a top bay on a phone is wide and short, `floorZoom` moves further than it ever has, and the zoom floor
is now a thing that changes when a window is opened rather than only when a grip is dragged.

`overflow: hidden` on the stage becomes `overflow: hidden` on each bay. A pane that does not fit its bay
is clipped rather than scrolled, which is deliberate: a pane too big for a phone is a bug in the pane, and
a scrollbar would hide it.

The house card has to be rebuilt to fit 390, which is the defect 0039's instrument found and the reason it
exists. Everything else on the stage — the parchment, and its dead media query — is brought over as it is
reached, not in one sweep.

The cost taken knowingly: **a pane registry is indirection, and at two panes it looks like ceremony.** A map
and a house card could be laid out by hand in an afternoon and it would be less code than this. It earns
itself at the third pane, which is the inspect window and is already written down, and at the fourth, which
is character dialogue. Building it at two and not at four is the whole argument, because at four it is a
rewrite of everything built between.

The second cost: **600 is a number somebody picked.** It is not derived from anything and it will be moved
once there is a real layout to judge at the boundary. It is one constant, in one place, and dragging the
side grip across it is how it gets judged.

## Alternatives considered

**One thing at a time on a phone, with tabs or a drawer.** What `RESPONSIVE-DESIGN.md` assumed and the most
common answer there is. It loses on what the game is: a map game where the map is gone whenever you are
reading something is a map game played from memory. The two-bay form keeps the thing being talked about
and the thing it is about on the screen together, which is also what makes an inspect window's *show it on
the map* link mean anything.

**A draggable divider.** The obvious way to make the split adjustable, and it is what the debug panel's own
grips already do. Adam chose minimise instead: one button and two states, against a thing to be fiddled with
every time the content changes. A drag can still be added later, over the top of this, and nothing here
forecloses it.

**Every pane declares the room it needs, and the layout folds when they no longer fit.** More honest than a
magic number, and it needs no constant. It loses on predictability: the answer becomes hard to guess while
the grip is being dragged, and a layout whose behaviour cannot be predicted cannot be judged by looking,
which is how everything here is judged (0023).

**Separate components for the phone.** Always available, always tempting, and precisely what the rule in
`RESPONSIVE-DESIGN.md` exists to forbid. Two components for one mechanic means one of them is wrong and
nobody knows which.
