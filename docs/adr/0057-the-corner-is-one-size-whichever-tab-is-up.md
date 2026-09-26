# 0057. The corner is one size, whichever tab is up

- Status: accepted
- Date: 2026-09-25
- Amends 0042, where "the tile is as tall as the pane that is up"; 0045, where every pane carries its own
  size control in both forms; and 0056, where a pane declares how wide the corner reaches. The corner's
  sizes are the corner's now, and so is its one control.

## Context

The corner of the spread holds three panes behind a tab bar: the house status, the key figures and
navigation (decisions 0042 and 0055). Each declared its own heights, and each had its own size. The house
card was 232 at full and 168 small, the key figures 232 at their normal size and 340 opened out, reaching
along the bottom to 560 (0056), and navigation 200 at both. The tile was as tall as whichever pane was up,
so **pressing a tab resized the corner**: from the key figures opened out to the house snapped it from
560 by 340 to 416 by 232, from the house to navigation took 32 pixels off, and the windows in the rail
above moved with every one of them. The key figures had been made to open at their normal size precisely
so that one pair of tabs would hold still.

Adam's words:

> When switching tabs, you should keep the size of the previous tab. The big view should be the same
> size, (keep the big size of the key figures one) … changing tab will never result in a size change.

And the pane size control should be in the tab bar on the desktop, since there are no tabs on a phone.

## Decision

**A tile that panes take turns in is one size, whichever of them is up.** The size is the tile's: one
value for the tile in the bay manager, `tiles` beside the per-pane `heights`, and the corner's three sizes
are declared once, on the corner rather than on its panes (`CORNER` in `panes.ts`). Put away, it is a
strip like any pane's; normal, it is 232, and it opens there; opened out, it is 340 tall and reaches along
the bottom to 560. All three tabs are drawn at these three.

**The sizes are the bay's, sized for the content that is meant to live there**, not after whichever pane
happens to be standing in it. The numbers came from the two panes that needed the most - the house card's
whole height, the key figures' details opened out - and they are the corner's now. A pane with no way to
fill the biggest of them will be given something to fill it with later, flavour, rather than the corner
shrinking to fit it. In Adam's words: the size of the bottom left bay is not sized after any pane we
happen to put there.

**The layout is not told which tab is up.** `spreadWants` used to be handed the tab and size the tile from
it. Now it cannot, so pressing a tab cannot move anything - an identity rather than something to be
careful about, which is what 0046 did for the fold. The desktop's form of that rule: how big the corner is
belongs to the corner, not to whatever is standing in it.

**One size control, at the far end of the tab bar.** The panes in the corner draw none of their own in the
spread; the room a pane is handed says whether its control is its own. Any of the three asking for a size
asks the corner, and so does the control in the tab bar, which asks through whichever pane is up. On a
phone nothing changes: there are no tabs there, and every pane carries its own control.

**A tile that more than one pane declares itself into must have sizes of its own**, and a test fails for
one that does not, because its size would otherwise follow whichever tab came first.

## Consequences

**The house card and navigation are drawn at sizes they never had.** At the normal size navigation is 32
taller than it was; opened out, the card and the list are 560 by 340. The card takes the extra height
above its bar of levers, so the bar stays on the bottom edge and the shield and the name stand in the
middle of what is left. That fixed the phone too, where the house opened out had its bar a quarter of the
way down the stage and blank parchment under it.

**The house card's one-line form is a phone's only.** In the spread the corner's normal size is the whole
card, blazon line included; the line is written always and left out by the stylesheet in the one-line
form, and by the squeezed column's container query as before.

**`startsAt` and `openWide` left the pane declaration** and are the corner's. The width 0056 gave the key
figures is the corner's width opened out, whichever tab is up.

**Navigation's strip in the spread is its name and nothing else.** Its marks put panes into a phone's
bays, which in the spread did nothing anybody could see, and the tab bar above the strip is already the
way to the other two.

## Alternatives considered

- **Keep a size per pane, and have all three declare the same numbers.** The same look, but three
  declarations that have to agree, and a layout still sized by the tab that is up: the next pane into the
  corner that declared its own would bring the jump back.
- **Carry the size across when a tab is pressed**, copying the last tab's size into the next one. It is the
  literal reading of "keep the size of the previous tab" and it looks the same, but it writes into a pane's
  entry on every press of a tab, which is the mechanism 0046 took out of the bays.
- **Leave a control in each pane, each sizing the corner.** Three controls for one value, and the control
  would move every time a tab was pressed.
