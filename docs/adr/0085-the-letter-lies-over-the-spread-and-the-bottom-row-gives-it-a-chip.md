# 0085. The letter lies over the spread opened out, and the bottom row leaves it a chip

- Status: accepted
- Date: 2026-10-06
- Supersedes in part 0044 (the letter's middle size in the spread), 0056 (the corner's reach capped by the
  letter's least) and 0069 (the letter between the two columns, the right column stopping above it, and its
  strip across its top). Adam's words of 2026-10-06.

## Context

On a desktop the bottom of the stage holds three things: the corner, bottom left; the letter, bottom middle;
and the column down the right, where a dialogue stands. Each had three sizes, each was a tile that never
overlapped another, and the letter was the one cut from what the other two left.

Looked at on Adam's screen, a 1248 by 900 stage with the debug panel open, two arrangements did not work. **All
three opened out**: the corner reached along the bottom to 560, the letter moved over to make room, and the
dialogue column, stopping a gutter above the letter, was left a 100-pixel stub at the top. **The letter put
away**: still a strip 656 wide along the bottom, and the dialogue column stopped short above it.

Adam's words: the letter's opened-out form should lie over everything else, with a fade over what is behind it
so it does not feel messy; the letter should only be put away or opened out on a desktop, with no middle size;
put away it should give way to both the dialogues and the house status, and be a little notification in the
middle, or the Take action button; the dialogues should put away to the bottom of the screen; only one of the
corner and the dialogues can be opened out at once, the other stepping down a size; and no special case for
the founding letter.

## Decision

**In the spread the letter has two sizes, put away and opened out.** Its control offers two marks; the middle
size and its carousel are a phone's only.

**Opened out it lies over everything, with a veil under it.** Centred on the stage, 736 wide and up to 768
tall, standing a gutter off the bottom edge where the chip stands, over the tiles, the tab bar, the seam and the
compass. The **veil** is the ink at 68 per cent over the whole stage, between the letter and the rest, so the
world behind is dimmed as one thing; pressing it puts the letter away. The layout says which tile is lying over
the others, `over`, and that tile is exempt from the rule that tiles never overlap, as the floor is and for the
opposite reason. Every question opens it out on arriving, the founding letter included.

**Put away it is a chip**: Take action and what it costs, or the hand that is waiting, centred, 280 wide where
there is room and never less than 136, a gutter off the bottom edge, in the middle of what the corner and the
right column leave. It carries no size control, because a press on it opens it out: a stated exception, like
the map's strip. The corner and the right column lay themselves out as though it were not there, and **nothing
moves when it opens or is put away**: whatever size the letter is, the layout of every other tile is the same,
which a test says.

**The bottom row always leaves the chip its least.** The corner reaches along the bottom no further than leaves
the chip and a right column at its normal width beside it, whether or not either is there, so neither arriving
resizes it; and the right column is never so wide that it comes within the chip's least and a gutter of what
stands on the left. Taking either cap away fails a test.

**The right column runs top to bottom always, and put away it is a strip across its bottom**, at its normal
width, so the three put away stand along one edge.

**Only one of the corner and the right column is opened out at a time.** Opening one out steps the other down
to its normal size, in the bay manager, and the log says both in one line. They are named once, in
`ONE_OPENED_OUT`.

## Consequences

**On Adam's screen** the corner opened out leaves the chip 251 between it and the dialogues, and the dialogues
opened out leave it 187; both at their normal sizes, 406. The dialogue column is the whole height in every one.

**On a narrow stage the right column gives up width before the chip goes.** At 800 wide the corner reaches 344
rather than 487, and at 620 the right column is 164 rather than 288. Below 744 wide nothing fits at its own size
and the right column is what is squeezed; it was squeezed there before, under the letter, in height.

**The letter opened out covers the map.** The founding letter's offered seats are dimmed under the veil until
it is put away, which is what Adam asked for: the founding is temporary code.

**The rolled hand's middle form is unused.** The library still has it at `/admin/inspect-ui-components`, and
taking it out is the library's own step.

**The veil is stage furniture, not a component.** It is a fill over the whole stage, as the seam is a moulding
over the join, and it lives beside the seam in `stage/bays.css`.

## Alternatives considered

- **The dialogue column stopping above the chip** where there is no room for it beside the corner, losing
  about 60 pixels. Turned down by Adam: the chip gives way, and the room is made by not opening both out.
- **The chip lying over the bottom of the dialogue column** where there is no room. That is where a
  conversation's answers are.
- **The letter opened out as a tile**, as before, with the other two squeezed round it. It is what did not
  work.
