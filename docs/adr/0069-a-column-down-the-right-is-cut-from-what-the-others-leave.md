# 0069. A column down the right is cut from what the others leave

- Status: accepted
- Date: 2026-09-30
- Superseded in part 2026-10-06 by 0085: the column **runs top to bottom always** and never stops above the
  letter, which is a chip between the columns put away and lies over everything opened out; it leaves the chip
  its least; put away it is a strip across its **bottom**; and it is never opened out with the corner.
- Amended 2026-10-15 by 0096: the column's panes **take turns**, the dialogues and the quests, behind a tab bar
  as the corner's do (0057); the column is one size whichever is up, a shared tile with no heights of its own, and
  put away its strip keeps room for the tab bar over it.
- Adds a tile to 0041's spread, which had a column down the left, a corner and a tile along the bottom
  middle. 0056 said a pane wider in the rail, or a second column, would be its own decision; this is the
  second column.

## Context

**Character dialogue** needs a pane of its own, and Adam placed it when the mechanic was agreed (0071): a
column down the right of the stage, top to bottom, because a conversation is long; about 480 wide, wider
than the column on the left, so that a picture of where the conversation is happening fits at the top of
it; the right half of the stage opened out; and a strip at the top right put away.

The spread had no tile on the right. It had a column set into the left edge, the rail over the corner,
and a letter along the bottom middle, centred in what the column left (0041, 0056). A second column has to
be fitted to all three: to the rail and the corner, which it must never come near, and to the letter,
which sits along the same bottom edge the column runs down to.

## Decision

**A new tile, `right`, set into the stage's right, top and bottom edges** as the first column is set into
the left, so its only edge is the one facing the map. Put away it is a strip across its own top, 44 high,
at its normal width.

**Its widths are the layout's, not the pane's.** A pane cannot know half of a stage it has never been told
the size of, so the pane asks for one of three - normal, half, strip - and `bayBox` says what each is, as
it says what the left column's width is.

**It is cut last, from what the others leave.** It is never so wide that it comes within a gutter of the
wider of the rail and the corner, the corner opened out and reaching along the bottom included. So its
coming and going resizes neither: a dialogue arriving moves nothing on the left, which a test says.

**It wants 480 and is squeezed to a third of a narrow stage first, as the left column is, never below the
left one's least, 288.** Opened out it is half the stage, and never less than its normal width.

**The letter goes between the two columns while it has the least it is ever left there, 281.** Centred in
what the two leave, capped at the width three options read across, as it always was. Where it has not,
it keeps the place it has without the column - centred in what the left leaves - and the column stops a
gutter above it. Put away, the column is a strip at the top and the letter keeps its place under it.

**The tiles still never overlap and none leaves the stage**, over every stage the spread can be and every
tile in or out, the column at each of its three sizes; and the column keeps a gutter from every other
tile. Taking away the column's stop above the letter fails the sweep and names what overlaps.

## Consequences

**At the sizes a desktop is, it is what Adam asked for.** On the 1568-wide stage a 1920 monitor leaves
beside the debug panel, the left column is 416 and the right 480, and the map between them is 672; the
letter goes between them at 640. Opened out the right column is 784, and the letter still fits between at
336. It is 480 on any stage from 1472 wide.

**On a narrow stage both columns are a third**, and the map between them is the middle third: at 928 wide,
the browser pane this was looked at in, they are 299 each and the map between is 330. **Below 896 both are
at their least, 288, and the map between them is what is left**: 192 at 768, a tablet upright; 96 at 672;
and 25 at 601, the narrowest the spread is ever drawn. Putting the column away gives the map back.

**Where the letter goes changes at a width, not smoothly.** Below 889 wide the letter keeps its place
under the column, as wide as 568; from 889 it is between the columns at 281, its carousel. With the corner
opened out the same happens at 1293. A letter and a dialogue together cannot happen yet: the only letter
is the founding one, and a house has no dialogue until it is founded. The tests hold it until one can.

**With the debug panel minimised, its badge sits over the column's size control**, in the top right corner
of the window, and a press there opens the panel instead. It is Adam's instrument, not the player's, and
where it goes instead is his to say.

**It is the only tile that stands from a moment and never goes.** The letter comes and goes with its
question; the column comes with the house's first dialogue and stays, because finished ones are kept to be
read back. So once a house has had a dialogue the map is narrower for good, unless the player puts the
column away.

## Alternatives considered

- **Its own width whatever the stage, up to a gutter from the left**, which is what the plan first said.
  On a desktop it is the same as this. On a 768-wide stage it leaves 16 pixels of map between the columns,
  and on a 1024-wide one 213 where this leaves 362, and a dialogue standing there is for good.
- **Floating over the map.** A dialogue over the world is what 0041 made the spread stop being.
- **In the rail, or in the corner behind a tab.** The rail is windows about things on the map and three of
  them can stand in it; the corner is the house's own, and one size whichever tab is up (0057), which a
  conversation with a picture at its top would have to set.
- **The letter always between the columns, however narrow.** A letter narrower than its carousel is a
  letter nobody can read, and 281 is the least it has ever been left (0056).
