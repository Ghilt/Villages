# 0068. The interface is painted art placed by CSS, and a container is a border, a fill and its embellishments

- Status: accepted
- Date: 2026-09-30
- Amends 0048 on how the interface is embellished: its drawn **ornament** stays where it is until each
  surface is redone in painted art, and the seam's own rules are unchanged until then
- Amended 2026-09-30: **an embellishment takes none of the content's room.** It had a keep-out, room kept
  clear among the words a side at a time, and Adam took it out on seeing it drawn: a cherub standing on the
  corner reserved a strip down the whole of the words, and the room was room no picture needed. See
  *Alternatives considered*.

## Context

Every part of the interface is drawn in code. The marks are stroked paths in `marks/Mark.tsx` and
`stage/Icons.tsx`, the shield's achievement and the seam are gold contours in SVG (0048), and everything
else is borders, shadows and gradients in one stylesheet. Not one `url(...)` is in it.

Adam's moodboard asks for something code cannot draw: gilt borders with their own light, velvet drapes,
cherubs sitting on corners, parchment, stone arches, painted medallions. He does not trust CSS to get
there, and it would not: that look is in the painting, not in the geometry.

He also wants to be able to ask for a pane in one sentence - *a gilt border and a cherub in the top right
corner, and the cherub takes some room* - and have the answer be the same kind of thing every time, rather
than a new stylesheet per pane. And a page, `/admin/inspect-ui-components`, where every component is seen
before it is used.

## Decision

**The interface is painted pictures, and CSS only puts them in place.** The pictures are Adam's, in
`world/ui/`, painted at four times the size they are shown and cut by a tool into 1x, 2x and 3x files, as
the sprites are cut (0059). The placeholders are the agent's, copied from the moodboard.

**A border is nine-slice, and the browser does it.** `border-image` is exactly that: one picture, four
cuts, corners drawn once and edges repeated. It is handed over whole, one framed box and a file naming the
four cuts, rather than as corners and edges to be put together.

**A container is four layers, and a recipe names them.** A **border**; a **fill**, which repeats on its
own; none or several **embellishments**, each pinned to an anchor with an **overhang** past the box, and
taking none of the content's room; and the content. A **recipe** is one named, typed
combination of them, so a new pane is a new recipe and perhaps a new picture, and never new CSS. A card is
a container too, and a card in a pane is one container in another.

**A mark is drawn or painted, one mark at a time.** Both go behind the one component, and which one each
mark is is Adam's call, as whether a button is a mark or words is.

**The painted look replaces the drawn one over time.** Each surface keeps what it has until a session
redoes it from the library, a surface a plan. The library itself is built first, on a page of its own, and
touches nothing in the game.

## Consequences

- A pane is asked for in the words of its layers, and the answer is a recipe. The vocabulary is small
  enough to say out loud.
- The look is Adam's to change by saving a picture over another, without an agent.
- The art has weight. Every picture is a download, so there is a budget - about two megabytes for the
  whole of it at 2x - and the page says what every file weighs.
- Repeats can show hairline seams at fractional scaling, Windows' 125 and 150 per cent. The page tries
  those on purpose, and a border whose seams show is fixed in the picture or in its cuts.
- For a while the game will have two looks, the drawn one on every surface not yet redone and the painted
  one on the page. That is accepted, because redoing a surface is a step of its own and should be.
- An embellishment is placed to stand clear of the words, on the corner and over the moulding or out
  past the box, because nothing keeps room for it among them. The page draws each one's box, so one that
  strays into the words is seen.

## Alternatives considered

- **Drawing it in CSS**, gradients and shadows and SVG as now. It cannot reach the moodboard, and it is
  what Adam distrusts.
- **Drawing the interface in Pixi or on a canvas.** It loses the browser's text, inputs, accessibility and
  layout, and buys nothing `border-image` does not already do.
- **A border handed over as a corner and an edge, mirrored by the tool.** Less to paint and seamless by
  construction, but every border symmetric, and a drape on one side only impossible. Adam chose whole.
- **One container component with an option for everything.** It becomes forty options that each pane uses
  three of. Layers and recipes keep each part small, and the sentence Adam says maps onto them one to one.
- **A keep-out**: room kept clear inside the content for an embellishment, a whole side of it at a time,
  so the words moved aside for a cherub by themselves. Built, and taken out the same day at Adam's word:
  drawn, it was a strip down the whole of the words for a cherub standing on the corner, and it was room no
  picture needed. If an embellishment ever has to stand over words, the way back is room the shape of its
  own footprint, with the words running round it, rather than a side.
