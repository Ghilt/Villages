# 0041. The spread is tiles on a map, and the fold has a dead band

- Status: accepted
- Date: 2026-09-19
- Amended 2026-09-24: a pane still declares a height, and one may also declare how wide its tile wants to be
  opened out. Only the corner may reach, along the bottom, and the rail keeps the column's width. See 0056.

## Context

Decision 0040 gave the phone a layout: the stage folds into two bays below 600 pixels on its shorter side,
a pane occupies a bay, and one pure function divides the room. It gave the desktop nothing. The spread was
still four things positioned by hand — the map filling the stage, the rail at `top: 1rem; left: 1rem;
width: 17rem`, the house card set into the bottom-left corner, and the parchment centred along the bottom
at `z-index: 4`, over the top of both of them.

They do not collide today only because nobody has made them collide. The rail runs to `bottom: 1rem` and
the house card is 416 wide and 199 tall in that same corner, so a third window in the rail already lands on
the card; the parchment already lies over whatever is beneath it. Adam's words for what he wants instead
were "the desktop mode works in tiles" and "the panes placed on desktop mode should never overlap each
other", with the map always underneath them.

Two more things were asked for in the same breath and are answered here because they are the same question.
**No unwanted scrollbars** — a tile that runs out of room must not grow one. And **no jerking at the
boundary**: the layout must not flip to the folded form merely because a tile got tight, and must not
oscillate when a window rests on the fold's one number.

## Decision

**The spread is tiles on a map.** The map is the **floor**: the whole stage, under everything, in a bay of
its own that is exempt from every rule below because everything lies on it on purpose. The rest are
**tiles**, and there are three — a column down the left holding the **rail** above the **corner**, and a
tile along the **bottom middle** for whatever mechanic is running.

**Every bay is a rectangle, in both forms.** `bayLayout` stops returning a one-dimensional split and starts
returning four numbers per bay, which the component writes into the wrapper's style. The stylesheet stops
answering the question of which cell of which grid a thing is in. This is the whole point: **no two tiles
overlap, and none leaves the stage** is now arithmetic with a test over every stage the spread can be and
every combination of tiles being present, rather than a stylesheet nobody can assert about.

**The column is one piece of furniture, set into the stage's left and bottom edges.** Its two tiles share a
width and a gutter, so they read as one column rather than two floating cards. It is flush rather than
floating because that is the house card's own argument generalised — furniture set into the edge of a desk
reads as part of it, and the same card floating in from the corner reads as a dialogue over the world. The
column wants the width the house card was drawn at, gives that up to a third of the stage before it gives
up anything else, and never grows past it.

**An empty tile takes no room.** No pane in the corner and the column runs to the bottom; no choice pending
and the map keeps the whole bottom of the stage. A tile is not reserved against a future.

**A pane declares which tile it sits in, and how tall.** Not the layout, which still knows nothing about
what a map is: the bays are named for *where they are*, and a pane says which one it belongs in. A height
and not a box, because the column's width is shared by everything in it and no one pane in it can be the
one that decides it.

**The fold has a dead band: it folds at 600 and unfolds at 660.** One threshold makes the boundary a cliff,
and a grip resting on it flickers between two whole layouts. Sixty pixels between the two means the width
that folds it is never the width that unfolds it, so it cannot oscillate however slowly the grip is
dragged; in between, the stage keeps whichever form it already had. The function stays pure — the form it
had is passed in, and the caller holds the memory.

**A tile that runs out of room is a pane that draws itself smaller, not a scrollbar.** The rule 0040 set for
a bay holds for a tile: it clips, and what is in it reacts to the room it got through a **container query**,
never a media query. The house card's hint line — the most words and the least news — goes when the column
is squeezed, which is the same thing it does on a phone. **The form never changes because a tile got
tight**; only the stage's shorter side decides that.

## Consequences

**The house card stopped asking for a width.** `min-width: 26rem` was 416 pixels against a phone's 390 —
the defect decision 0039's instrument was built to find, and which `MECHANICS.md` recorded as fixed when
only the folded form had been fixed. It now fills whatever tile it is given, and the column is 26rem
wherever there is room for one.

**Minimise does something in the spread now.** 0040 said the same button must work in both forms and in the
spread it did nothing to the layout: the card drew itself as a strip and the room went nowhere. Putting the
house away now shrinks the corner to its 44-pixel strip and hands those 156 pixels to the rail above it.

**The game's name left the house card.** It was in there because that card used to be the whole stage. Now
every pixel is either the floor or a tile, so it is chrome lying on the floor, and the column keeps a little
room clear at the top for it — the one number in the layout that exists for a decoration, and it is named
as such.

**The rail is one tile with windows inside it**, not three tiles. That is what stops three windows pushing
past the house in the corner: there is nowhere past to push to. It also keeps `MOST_OPEN` where it is, as a
property of how many windows are worth reading rather than of how many fit.

The cost taken knowingly: **the layout is now JavaScript where it used to be CSS.** A grid would have
guaranteed non-overlap too, and for free. What it would not have given is a number — the test that proves
the rule, and the rectangles the camera needs in order to be told which part of the map is actually visible,
which `ARCHITECTURE.md` has been asking for and which is not possible while the answer lives only in a
stylesheet.

The second cost: **600 and 660 are two numbers somebody picked** where there used to be one. The band's
width is a guess about how fast a grip moves, and it will be moved by dragging the grip slowly across it.

## Alternatives considered

**A CSS grid for the spread, as the bays form had.** Free, declarative, and it cannot overlap. It loses on
everything the rectangles are for: there is no test, no number to hand the camera, and no way to say "an
empty tile takes no room" without a second set of grid templates per combination of what is present.

**Let the tiles overlap and stack them by z-index**, as the spread did until now. It is what a map game
usually does, and it is why the third inspect window lands on the house card today. Adam ruled it out in
the words this record opens with.

**Fold to the bays when the tiles no longer fit**, rather than on the stage's shorter side. More honest,
and it needs no constant. Rejected for the same reason 0040 rejected it and one more: it makes the form
depend on what happens to be open, so opening a window could fold the whole layout, which is the jerking
this record exists to remove.

**One threshold and a debounce.** The obvious fix for flicker, and it is worse: a debounce makes the
boundary depend on time, so the same window width gives different answers depending on how fast it got
there. A dead band is a pure function of size and can be tested.
