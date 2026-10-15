# 0096. Everything on the map is drawn from one zoom, and significance ranks

- Status: accepted
- Date: 2026-10-15
- Amends: 0026, 0038

## Context

Since 0026 a thing's significance decided how far out it was drawn: `coarsestZoom` turned a hundred into the whole
world and nought into zoom 10, in even steps, and the gateway sent a thing only from that zoom in. With the
structures' catalogue that meant a mill (8) arrived at zoom 9, a castle (20) at 8 and a cathedral (40) at 6. Pulling
back, the map emptied a type at a time. Adam read it as sprites of different sizes fading at different zooms, and
asked for every sprite to fade at the same zoom, 7.25, whatever it is (2026-10-15). Asked whether that held for
structures alone, he said for everything on the map, and that significance stops deciding draw distance anywhere.

## Decision

**One zoom for everything on the map.** The gateway sends every structure and every person from cell zoom 7,
`ON_THE_MAP_FROM` in `Cells.kt` and `cells.ts`, both held to `contracts/fixtures/cells.json`. The page fades all of
them in and out together at 7.25, `DRAWN_FROM_ZOOM` in `sprites/twoForms.ts`, a quarter of a level inside the zoom
they are sent at, so they have arrived before they are wanted. Nothing is drawn further out but what was already
spared: a candidate, the eye's own holdings, and everything while seeing everything.

**Significance ranks.** It stays on every event and every view, and it still does three things: which of a crowd of
marks leads it, which two hundred a full cell carries, and what is seen through the fog (80 and up, 0061). It no
longer turns into a zoom. `coarsestZoom` is gone from both ends.

## Consequences

- A world far out says nothing. That was already the case from zoom 7.5 for a house's seat. Aggregates are still
  what low zoom wants, and they are not built.
- The projections index a thing by its cell alone, not its cell and a zoom.
- The structures' page at `/admin/inspect-structures` shows significance where it showed "drawn from zoom".
- No frame changed, so the protocol version stands.

## Alternatives considered

**Keep the rule and steepen it.** Every significance in the catalogue pushed above 27 would arrive at 7. It keeps a
rule nobody wants for the sake of one nobody uses, and the next type added at 15 would arrive late again.

**Structures only.** People would have kept arriving at zoom 9 by their significance of ten. Refused by Adam.

## Amendment, 2026-10-15: a mark never fades

Adam, looking at the pins: they should never fade out, only be grouped, and at the farthest zoom they should still be
there, gathered more. So the floor at 7.25 is for what has no mark - anyone else's building or person. The player's
own holdings and key figures, which are marks far out (0051), are drawn at every zoom: they reach the session rather
than a cell, so no frame changes, and the crowds they gather into grow as the camera pulls back. The eye of 0038,
whose only work was keeping the holdings drawn far out, has nothing left to do and is gone from the house bar.

## Amendment, 2026-10-15: one zoom, 7.5, and sprites and marks never meet

Adam again: buildings should turn into marks and fade out at the same time, so that a mark and a sprite can never
be on the screen together, and the scenery with them. From 10 to 7.5 the map is the world - scenery, buildings and
people as sprites; from 7.5 out it is only the player's marks. So the floor and the crossover are one zoom,
`BECOMES_A_MARK_AT` = 7.5 in `twoForms.ts`, and there is no floor of its own any more: past it a thing with no mark
is in a form it has nothing to draw in, so it is gone, at the same moment and over the same time as a thing with a
mark trades its sprite for it. Every scenery kind arrives there too, whatever its size, where it used to arrive when
it stood twenty pixels tall (0059). A mark keeps its size, 5.5 pixels a unit, so a castle's pin is 44 pixels where its
sprite was 22: the trade changes the size as well as the drawing, which 0051 had avoided, because the two are never
seen together. `see everything` no longer lifts a floor, since there is none: it only sends every zoom.
