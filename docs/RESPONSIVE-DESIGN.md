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

## The two shapes

**Desktop shows most things at once.** The map with panels around it, the house card, the inspector and
whatever mechanic is running, all visible together, because a large screen can hold them and seeing them
side by side is part of reading the world.

**A phone shows one thing at a time.** The player looks at the map, or at a dialogue, or at their house —
not at all three. What that means for moving between them is not decided; see below.

A mechanic's own entry says what it looks like. This document says which of its parts survive on a phone
and which give way.

## What exists today, and what it would do on a phone

Nothing in the interface has been laid out for a small screen yet. As it stands, all of the following are
on screen at once, positioned in corners of a full-window map:

| Part | Where it sits today |
|---|---|
| The map, with the sprite, area and influence overlays | The whole window |
| The debug panel, with the debug map inside it | Docked down the right, taking room from the stage |
| The inspector | Left, when something is selected |
| The house card, with the eye and the empty places beside it | A corner |
| The parchment | Over the map, while a choice is pending |
| The worktree tabs and the build badge | Top, and a corner |

On a phone these would overlap each other and the map would be whatever is left. The debug panel is
Adam's instrument rather than a player's and need not survive the phone, but the house card, the inspector
and the parchment are the player's and do.

## The instrument

**The phone toggle, in the very top right of the debug panel, confines the stage to 390 by 844.** The
stage is the box the player's interface is laid out in - everything above except the debug panel itself -
and the panel takes room from it rather than floating over it. Two grips resize it to anything in
between. So the rule above is checkable while a component is being written, at one click, on whatever
monitor there happens to be. See decision record 0039.

This closes one of the questions below: the debug panel does not get a phone layout, because it is the
frame the phone is looked at inside rather than something in the picture. The worktree tabs and the build
badge moved into it for the same reason - what is on the stage is what a player would get, and nothing
else.

Two things it found immediately, both still open and both the layout's work rather than the
instrument's:

- **The house card asks for `min-width: 26rem`**, which is 416 pixels and does not fit a 390-pixel phone.
- **A media query cannot see the stage.** The parchment's one breakpoint asks about the window, which is
  1280 wide while the stage is 390, so it never fires. Responsive work inside the stage wants container
  queries rather than breakpoints, and that is the right constraint: a component that only reads
  correctly when it happens to be the whole window is what the rule exists to prevent.

## Not decided

Nearly all of it. This document records the rule so that nothing new is written against a desktop only;
the layout itself is still to be designed.

- How a player moves between the one-thing-at-a-time views on a phone: tabs, a drawer, gestures, or
  something the world itself suggests.
- Which breakpoints exist, and whether there is a tablet shape between the two or only the two.
- What happens to the map while a mechanic is taking the screen — hidden, shrunk, or behind.
- Touch: what replaces hover, given the choice roll's parchments lift on hover and the map is driven by
  drag and wheel today.
