# 0056. The corner opened out reaches along the bottom

- Status: accepted
- Date: 2026-09-24
- Amends 0041, where a pane declares "a height and not a box, because the column's width is shared by
  everything in it and no one pane in it can be the one that decides it", and 0042, where the tile is "as
  tall as the pane that is up". Opened out, the corner is as tall **and as wide** as the pane that is up.

## Context

The **key figures** are the corner's third pane, the tab between the house status and navigation
(decision 0055). Adam gave their details four forms, one a size of each shape, and the last of them does
not fit the corner as it has been:

> desktop big: portrait, name and stats, in a big expanded pane.

A portrait at three by four beside a name and five lines of stats - a mark, a word and a number each - is
about 560 pixels across. The column is 416 at the most and 288 at the least, and it is the column's width
because 0041 made the column one piece of furniture: the rail above and the corner below share a width and
a gutter, so they read as one column rather than two cards that happen to be near each other. No pane in
it was allowed to decide the width, because no one of them could know what the others needed.

Opening out already meant something in the spread: a tile has three heights, and the player picks
(0045). It has only ever meant taller. Adam's answer, asked which way the room should come, was the
bottom edge: the corner grows along it, the windows above keep the column's width, and a letter along the
bottom moves over and never goes below the width it reads at.

## Decision

**Opened out, the corner may reach along the bottom.** A pane declares `openWide`, how wide its tile wants
to be when it is opened out, and the pane up in the corner asks for it only when it is opened out. The
layout gives the corner that width, in `bayBox`'s spread and nowhere else. The key figures ask for 560; no
other pane asks at all, so for every other pane the corner is the column's width exactly as it was.

**It is never narrower than the column, and never so wide that the bottom middle has less than 281.**
`MIDDLE_LEAST` is not picked: it is what the bottom middle already came to on the narrowest spread there
is, a 601-wide stage with the column at its least, and the letter's carousel reads at it. The corner stops
there, so nothing along the bottom is ever made narrower than it could already be.

**The cap does not look at whether there is a letter.** The corner is as wide with nothing along the bottom
as with a letter there, so a question arriving never resizes the corner under the player's hand, and the
width of one tile does not depend on the presence of another.

**The rail keeps the column's width.** Only the corner reaches; the windows above it stay one column, set
into the left edge, and the tab bar across the corner's top is as wide as the corner.

**The bottom middle starts after the corner.** It is centred in what is left, as it always was, and capped
at the width three options read across, as it always was.

## Consequences

**One tile's size can change another's form, for the first time.** On a 1000-wide stage a letter lays its
three options out beside the corner as it always has; with the key figures opened out, the corner reaches
to 560 and the letter, moved over, has 408 pixels and draws its carousel. It is the carousel's whole
purpose - a tile that has run out of room draws itself smaller - and the form is still never changed by a
tile getting tight: only the letter's own drawing changes, never the stage's.

**The column stops being one width.** A column whose two tiles share one edge was 0041's argument for
reading as furniture, and opened out it no longer does: the corner's edge steps out past the rail's. It is
the player's doing and it is undone by the same control, which is what makes it acceptable rather than a
layout that shifts by itself.

**The floor under the bottom middle is now a rule rather than an accident.** The sweep over every stage the
spread can be held the bottom middle to 260, which was a guess with room to spare below what it came to;
it now holds it to `MIDDLE_LEAST`, with the corner opened out as far as it can be asked to, and the
no-overlap sweep runs the same way. Removing the cap fails three tests, which is how the rule was proved.

**It is not a second column.** A pane that wants to be wider in the rail, or a bottom middle that wants to
reach up, is not covered by this and would be its own decision.

## Alternatives considered

- **Opening the corner taller only**, with the stats below the portrait. It is what every other pane does,
  and it is what the phone does at half, below a scroll. It was turned down because Adam's wording for the
  desktop's big form is the portrait *beside* the name and the stats, and a column 288 wide cannot hold
  that at a portrait size worth drawing.
- **A wider column whenever the key figures are up.** It keeps the column one piece of furniture, and it
  narrows the map and moves every window above whenever a tab is pressed, which is what their opening at
  the normal size exists to prevent.
- **A floating panel over the map.** A dialogue over the world is what 0041 made the spread stop being.
