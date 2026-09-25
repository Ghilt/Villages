# 0058. A rail out of room keeps one open

- Status: accepted
- Date: 2026-09-25

## Context

The spread's **left** bay stacks its panes on a rail, one under another and all of them drawn, up to three
(decisions 0041 and 0042). Every one was a flow item that could shrink, so when three inspect windows did
not fit, each was squeezed and clipped at its bottom - three windows each missing its links, none of them
readable. Adam's words:

> We need to stack them better if they dont fit, please minimize all but one. maximizing another will then
> minimize the other ones. So in this state of being starved for space only one inspect pane is ever open.

Asked where a put-away window should open when another is opened, he chose **the top**: what clicking its
castle on the map already did, so the window opened, the one on top and the one the map rings are always
the same one.

## Decision

**When the panes on the rail no longer all fit, every one but one is put away.** The one kept is the top
one the player has not put away themselves - the newest, or the one just opened. Opening another then puts
the rest away in turn, so a rail out of room only ever has one pane open.

**Opening a put-away pane brings it to the top**, from its own size control or by asking for it again from
the map, a link or the trail. A pane asked for again that was put away opens: a thing nobody can read is not
an answer to a click, which is the spread's form of 0046's exception for a strip something arrives in.

**Put away is written, not drawn.** The rail writes a strip into what each pane asked for, the same entry
the player's own control writes, so **nothing reopens by itself**: when the room comes back, or the open one
is closed, what was put away stays put away until the player opens it. Drawing them put away only while the
room was short would have had the next one spring open whenever the open one was put away, which is the
rail overruling the player.

**Whether it fits is measured, not declared.** A window is as tall as what it says, which no declaration
can know, so the stage measures each pane at the height it is drawn at after every layout and whenever one
changes height, and a pure function, `outOfRoom` in `stage/rail.ts`, says which to put away. Once only one is
open it asks for nothing more, so a measurement that follows its own answer settles.

## Consequences

**The rail is the first part of the layout decided by measuring the page.** Everything else is arithmetic on
declared numbers with a test; here the numbers come from the page and only the decision has the test. It is
the one bay whose panes are sized by their content, so it is the one place that has to look.

**A single pane taller than the whole rail is still cut off at the bottom**, because there is nothing left
to put away for it. Whether it scrolls instead is the next step.

**The log says what the rail did**, one line each time it puts anything away, so the instrument shows it.

## Alternatives considered

- **Open where it stands**, with nothing reordered. Adam's other option: the stack holds still, but the map
  goes on ringing the top window, which would be put away.
- **Squeeze them all, and scroll each.** What there was, near enough: three windows each too short to read.
- **Declare a window's height** and do the arithmetic, as every tile does. Wrong for every window that says
  more or less than the guess, which is all of them.
