# Look and feel

> **What belongs here:** the shared visual language — the rules every part of the interface follows, and the
> components more than one mechanic uses. **What does not:** how any single mechanic looks, which is that
> mechanic's own look-and-feel section in `MECHANICS.md`, how the interface behaves across screen sizes
> (`RESPONSIVE-DESIGN.md`), and what the experience is about (`VISION.md`).

This document is new and deliberately thin. A unified component style is worth having and is not a mechanic,
so it is collected here as it is decided, rather than being discovered again inside each feature. Most of it
is not decided yet, and says so.

## The rules

**Diegetic wherever it can be.** What the player is shown should be part of the world rather than a control
panel laid over it. A choice arrives as something on a desk, not as a modal dialog. This is the one settled
thing about the presentation; the theme and tone around it are not (see `VISION.md`).

**Every screen, from the start.** A component is laid out for a phone and a desktop in the increment that
builds it, never in a later pass. See `RESPONSIVE-DESIGN.md`.

**A component is shared, not re-invented.** When a second mechanic needs something the first already showed
the player, it uses the same component and this document gains an entry, rather than each mechanic growing
its own version of a parchment.

## Rarity

Four bands, used wherever a rolled thing is shown, with the standard colours:

| Band | Colour |
|---|---|
| Common | gray |
| Uncommon | green |
| Rare | blue |
| Legendary | orange |

The exact values are not chosen. The bands and their colours are, because a player learns them once and
should never have to learn them again.

## Components

**The desk.** A wooden desktop with an inkwell, on which the world puts things in front of the player. Its
first use is the choice roll.

**The parchment.** A textbox styled as a sheet of parchment, lying on the desk. Hovering one lifts it
slightly, so it reads as something that can be picked up. One parchment carries one **option** of a choice
roll — the class named the whole choice until 0044, which had it backwards — and what else it might carry is
not decided.

**The carousel.** One thing at a time, with a step either side and a dot per thing beneath. The small form
of a pane whose full form is a list, so that the list can be glanced through in a strip of screen while the
map stays up beside it. Its first and only use is the choice roll. See decision record 0044.

**The needle.** One mark, pointing at a **bay**. One drawing turned four ways, so a player learns it once:
this mark means *there*.

**The arrows.** A pair of needles, saying which of the two **bays** a thing would open into, with the bay it
is already in **marked rather than taken away** — so anything can be moved anywhere. Drawn on the **links**
of an **inspect window** and on every row of **navigation**, because *open this* and *open this there* are
one decision and so one control. In a list they are a row tall rather than a glyph tall, because a finger is
not a mouse. The spread has no bays to choose between, so there the same link is a plain click and no arrows
are drawn. See `RESPONSIVE-DESIGN.md` and decision records 0040 and 0043.

**The compass rose.** Four cardinal points filled and four between them drawn, inside a ring: the way to
everything that is not on the screen. On a phone it is a disc in the **bottom right corner of the stage**,
always the same corner, and one tap puts **navigation** in the bay under the thumb; in the spread it is a
tab in the corner. The same mark doing the same job in the room each form has for it. The ordinals are
outlined rather than filled so that it reads as eight points and not as a blob at the size a tab draws it.

It is the **one thing that floats over the world**, and it floats because what it opens is everywhere while
what it used to stand on — the seam between the bays — moves every time anything is resized. It is drawn to
earn the corner rather than to sit on it: parchment, a rim and a fainter gold ring nested inside, which is
the achievement's own way of drawing a frame, so it reads as a seal pressed into the corner of the sheet
rather than as a button laid on top of one. A thumb across, which is what a **strip** is, because it is the
same thumb. Whatever is under it steps clear, so nothing the player needs is ever beneath it. See decision
records 0043 and 0047.

**The pane size control.** Three marks in a pane's corner saying how much of the stage it is taking: put
away, the normal size, opened out. The mark is **how much of a box is filled**, which is the thing being
chosen rather than a metaphor for it - no folder, no chevron, no arrow pointing anywhere. Every **pane**
has one, in both forms, and it replaced a chevron that could only put a pane away. A pane that cannot be
put away offers two marks rather than three. See decision record 0045.

**The ornament.** Gold on parchment, drawn the same way wherever the interface embellishes an edge:
**nested contours** at decreasing weight rather than one thick line, a **stud** where something is fixed,
a **lozenge** where two runs meet, and an **open curl** that springs away from the line and turns back on
itself without closing. Drawn once for the achievement the shield hangs in, and the vocabulary for any
edge worth marking since. **None of it carries meaning** — the heraldry is the field and the charge, and
this is the frame they hang in — so there is never anything in it for the player to read. A curl is drawn
once and mirrored rather than drawn four times, which is the **needle**'s rule. See decision record 0048.

**The seam.** The join between the two **bays**, drawn as a moulding lying over it: three gold rules
running the length of the stage — a heavy one on the join and a lighter one either side — with a fixed
**knot** of **ornament** at the middle. The knot is one size whatever the length, because an ornament that
stretches is an ornament that has been noticed; the rules stretch because a rule is a rule at any length.
They run out to the stage's own edges rather than fading, for the reason the house card is flush against
the edges it meets. It lies **over** the two bays rather than taking room from them, so nothing in the
layout changed to make room for it, and it takes no pointer. One drawing turned: a band across a portrait
stage, the same band down a landscape one. The **compass** stands on it. See decision record 0048.

**The strip.** What every **pane** looks like put away: a band 44 pixels across with the pane's name on
it and the **pane size control** beside it. The same band turned a quarter in landscape, 44 pixels wide
down the side of the stage with the name written **down** it rather than dropped — there is no room for a
word across 44 pixels and eight hundred pixels of room along one. One shape and one thickness for every
pane, so that putting anything away looks like putting anything else away, and two panes that say
otherwise and say why: the **map** carries no control and is itself the way back, and **navigation**
carries the marks of what it could put in the other bay, because that is the strip a player arrives in by
pressing the compass. See `RESPONSIVE-DESIGN.md` and decision records 0046 and 0047.

**The tab bar.** Several **panes** sharing one **bay**, and a strip of marks across its top saying which is
up. Marks and no words: a column is 26rem at its widest and two words on a tab is a tab that wraps. Its
first use is the corner of the spread, where the house status and navigation take turns. Only in the spread
— a phone reaches the same panes through the compass, because a row of tabs on a 390-wide stage is a row of
things too small to hit. See decision record 0042.

**The marks.** Every pane declares the mark it is known by, drawn in one place so that the same thing on a
tab, in a list and wherever a pane is named later cannot drift apart. **The compass is the arrows' needle
inside a ring**, deliberately: the arrows say which bay a thing opens into and the compass opens the pane
that lists them, so they read as one family rather than two unrelated drawings.

## Not decided

- Theme and tone as a whole. See `VISION.md`.
- The exact colours, the type, the grain of the desk, and whether the map's own look leads the rest of the
  interface or stands apart from it.
- Whether the parchment survives contact with a second mechanic, or turns out to be the choice roll's own.
