# 0048. The seam between the bays is drawn, and the ornament is shared

- Status: accepted
- Date: 2026-09-20

## Context

The two bays touch exactly. `twoBays` places the second one at the first one's edge with no gutter, on
purpose — *a layout that loses a pixel to rounding grows a seam nobody can find later* — so the only thing
marking the join is whichever hairline border the pane below happens to draw. On a phone, where the whole
interface is two boxes, the one line that says *these are two things* is the one line nobody drew.

Adam: the border between the two panes should be **an embellished strip, kind of like the embellished
border around the shield**. Asked whether it should take room out of the two bays or lie over the join, he
chose **over**.

The shield already has the vocabulary. The achievement in `HouseStatus.tsx` is nested contours at
decreasing weight, filled **studs** where something is fixed, a **lozenge** crest, and open **curls** that
spring away from the frame and turn back without closing — all in one viewBox, *so the ornament and the
shield cannot drift apart*.

## Decision

**The seam is a moulding lying over the join**, not room cut out of either bay. Nothing in `bayBox.ts`
knows it exists and no arithmetic changed to make room for it; the two bays still add up to the long side
exactly.

**Three rules and a knot.** A heavy gold rule two pixels wide centred on the join, a lighter one either
side of it, and a fixed knot of ornament in the middle where the eye lands.

**The rules stretch and the knot does not, so they are drawn in two media.** The rules are the band's own
background gradient, in exact pixels: crisp at any length, and nothing to lay out. The knot is an SVG
rendered **at its own viewBox size**, one user unit to one pixel, so it cannot stretch with the band and
its lines land on exactly the pixels the gradient draws. A stretched ornament is an ornament that has been
noticed, and the two have to agree to the pixel or the moulding has a step in the middle of it.

**The rules run out to the stage's own edges rather than fading.** That is the house card's argument
generalised: furniture set into the edge of a desk reads as part of it, and a moulding that stops short
reads as a scar that healed.

**One drawing turned.** A band across a portrait stage and the same band down a landscape one, with the
knot given a quarter turn — which is what the whole stage does when the phone turns, so the seam does it
too. And **one curl drawn four times mirrored** rather than four curls, which is the needle's rule: a mark
that is redrawn is a mark that drifts.

**The ornament is shared, and this is what made it a component.** `.hud__ornament` and `.hud__stud` become
`.ornament` and `.ornament__stud`, used by the achievement and the seam alike. `LOOK-AND-FEEL.md` says a
component is shared rather than re-invented, and a second user is exactly when that becomes true.

**It takes no pointer and it sits below the compass.** `pointer-events: none`, because a moulding that
eats a drag meant for the map is a moulding that has to be explained; and `z-index: 4`, over both bays and
the tab bar and under the grips and the compass — the seam is furniture, and the compass is the one thing
that stands on the furniture.

**Only where there is a join.** Below 64 pixels on the long side the stage is one box, `--bay-first` is the
whole of it, and a moulding would draw itself along the stage's own bottom edge.

## Consequences

**`--bay-first` has a reader again.** The compass stopped reading it in 0047, which left the stage
publishing a number nobody wanted; the seam is what that number was always for.

**The heavy rule covers the hairline underneath it**, so there is no doubled line to find: the lower pane
draws a one-pixel parchment edge along the same join, and two pixels of gold centred on it hide it
outright.

**The achievement's markup changed without its drawing changing.** Seven class names in `HouseStatus.tsx`,
same values, so the shield is pixel-identical and the diff is larger than the change.

The cost taken knowingly: **twenty pixels of the stage are now covered by a decoration**, ten either side
of the join, over whatever the two panes had drawn there. It is `pointer-events: none` so nothing becomes
unreachable, and in practice both panes' own edges are what is under it — but a pane that one day wants to
put something tight against the join will find a moulding already there.

## Alternatives considered

**Cut room out of the two bays for it**, so nothing is covered and the no-overlap test proves the moulding
too. Honest, and it was my recommendation. Rejected by Adam, and he is right that it is the bigger change:
it would put a number in `bayBox.ts` for a decoration, which only `TITLE_ROOM` has ever earned, and every
test asserting the two bays fill the long side exactly would have to learn about it.

**One SVG stretched across the seam** with `preserveAspectRatio="none"`. One file, one drawing, no two
media to keep in agreement. Rejected because it stretches the ornament with the band, which is the one
thing a moulding must not do.

**One SVG with the knot positioned by percentage** and the rules as paths. It works, and it needs
`transform-box: view-box` plus a comment explaining what percentages resolve against — a thing to get
wrong twice.

**A repeating pattern along the whole seam** rather than a knot in the middle, in the manner of the
hatch that marks an empty place on the lever bar. Rejected because a repeat has no centre, and the seam
wants somewhere for the eye to land.
