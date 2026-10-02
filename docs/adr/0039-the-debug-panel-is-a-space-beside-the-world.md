# 0039. The debug panel is a space beside the world, and the world sits in a stage

- Status: accepted
- Date: 2026-09-19
- Amended 2026-09-30: **the log is a column of its own**, the whole height of the panel on its outer
  side, rather than the last section. As a section it was scrolled out of view by every section above
  it, which is exactly when a button has just been pressed and its answer is wanted. The controls keep
  the width they want, 352 pixels, and the log wants 400 beside them; when the panel balloons the log
  takes the extra, because a log line is what wants a long row. It folds away with `hide` in its own
  bar and comes back with the `log` toggle in the panel's header beside `landscape`, and folded it
  gives its 400 pixels back to the stage. It begins folded, Adam's call, and remembers which it was. So the panel's wanted width is one number that depends on
  whether the log is open and is nothing once the panel is a badge, `panelWants` in `stageBox.ts`,
  and the mirror below is taken about that number. The sections listed below lose **Log**.

## Context

The interface was a full-window map with everything else floating in its corners. Two separate debug
surfaces stacked down the right in a rail: the Debug map panel, and the debug panel under it. They did
not share a visual language - one opaque parchment and serif, the other translucent and monospace, at
two different widths - and they were joined by nothing but a flex column. Two other things were
positioned to dodge them: the worktree tabs reserved `15.5rem` on the right and the folded parchment
reserved `24rem`, so changing either panel's width silently broke both.

`docs/RESPONSIVE-DESIGN.md` then set the rule that every component is laid out for a phone and a desktop
in the increment that builds it, and that a component which only works at 1600 pixels wide is not
finished. That rule had no instrument. Adam has one monitor, the browser's own device emulation resizes
the whole window and takes the debug panel with it, and a panel floating over the map could not show
what a mechanic looks like when the room runs out, because it was never taking any room.

## Decision

**The debug panel takes room from the world rather than floating over it, and what is left is the
stage.** The window is a grid: a blank, the stage, and the panel, with an inset above and below. All
five numbers come from one pure function in `apps/web/src/debug/stageBox.ts`.

**The stage holds everything a player would ever see, and nothing else.** The map, the desk, the
overlays, the house card, the inspector and the parchment are inside it. The worktree tabs and the build
badge are Adam's, so they moved into the panel. That is what makes the phone shape worth looking at:
what fits at 390 pixels is what a player would actually get, with nothing of ours in the picture.

**Two grips resize it, and the stage narrows in place.** The panel has a width it wants, and every pixel
it is dragged past that is mirrored as blank on the far side, which puts the stage's centre at
`(width - wanted) / 2` whatever the panel is. So dragging narrows the stage without sliding it, and a
layout can be watched as it gives way instead of being chased across the screen. The top grip is
symmetric from the first pixel, because the panel is full height whatever the stage does. Dragged
outward the side grip stops where the panel is the width it wants; wanting the whole window is what the
badge is for.

**A toggle in the very top right confines the stage to a phone,** 390 by 844, which is one constant and
a matter of taste. The panel is allowed to balloon into the room this frees: a log line is worth a long
row, and one rule with no special case is worth more than a tidier-looking panel.

**Everything in the panel is in a section, and every section folds on its own.** A chevron beside the
title, and the fold is remembered per section. The panel scrolls and the bar with `hide` and `phone`
does not, because it is expected to gain sections rather than stay the size it is and a way out that
scrolls off the top is not a way out. A section's bar holds its title and a status or a button or two;
more levers than that go in its body, where there is room to wrap.

**A step that puts something in the panel says which section it goes in, and asks when that is not
obvious.** This is the part that has to survive being forgotten: the panel grows by one button at a
time, and a button put wherever there was room is how it stops being readable. The five today are
**Worktrees**, **Debug map**, **Areas**, **World** and **Log**.

**It minimises to a badge,** and the stage keeps whatever size it had. A phone-shaped stage with a badge
over the corner and nothing else is the interface undisturbed, which is what the badge is for. With
nothing beside it the stage centres, the way the inset already centres it vertically.

## Consequences

The rule in `RESPONSIVE-DESIGN.md` is now checkable, and checking it is one click rather than a
judgement. The first thing it found is that the house card asks for `min-width: 26rem`, which is 416
pixels and will not fit a 390-pixel phone; the second is that the parchment's only media query asks
about the window, which is 1280 wide while the stage is 390, so it never fires. Neither is fixed here.
They are what the instrument is for, and they are the responsive layout's work.

MapLibre follows the stage without being told to. It watches its own container, so a container that
changes while the window does not still fires `resize`, `settleFloor` still runs and the zoom floor
still moves with the viewport as decision 0033 requires. This was the one thing that could have failed
silently and it does not: narrowing the stage from 928 to 390 moved the floor from -0.51 to -1.39, and
there is no explicit `map.resize()` anywhere.

The two hard-coded offsets are gone, and the panel's width is no longer a number other components have
to know. The panel is one surface with one look, one set of edges and one border - the edge it faces the
world with - rather than two cards with a gap between them.

The cost: the stage is a containing block, so everything inside it is measured against the stage rather
than the window. A media query cannot see it, which means responsive work inside the stage wants
container queries rather than breakpoints. That is a real constraint and it is the right one, because a
component that only reads correctly when it happens to be the whole window is the thing the rule exists
to prevent.

The inspector had to be given styles it never had. Its markup was written on 2026-09-05 and no rule for
it was ever added, which left it the one element on the page in normal flow, painting behind the map
where nobody ever saw it. It is a plain card down the left of the stage now; what it should look like is
still open.

## Alternatives considered

**Leave the panels floating and use the browser's device emulation.** Free, and it is what a web
developer would reach for first. It loses because it resizes the window, so the debug panel goes with
it: there is nowhere to stand and watch. Adam would be reading the phone layout through a phone-sized
debug panel, or with no panel at all.

**Shrink only the map and leave the other interface over the whole window.** Simpler, and it keeps the
house card where it is. It loses because the house card and the parchment are exactly the things whose
phone layout is in question; a test that excludes them tests nothing.

**Let the stage slide sideways as the panel grows, with no blank.** One fewer column. It loses on feel:
the thing being judged moves under the eye while it is being judged. Mirroring the overshoot costs one
subtraction and holds the stage still.

**Give the panel a maximum width, with the surplus going to the blank.** Keeps the panel looking like
itself in phone mode. Adam chose the ballooning panel: the room is real, a log wants a long line, and a
rule with a cap is two rules.
