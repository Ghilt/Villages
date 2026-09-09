# 0002. An area on the map, and what it encloses

- Status: open
- Started: 2026-09-09

## Hypothesis

A region of the world can be drawn by hand, at any zoom, and say truthfully how much of each kind of
ground it holds - and the way to make that true rather than approximately true is to put its boundary on
the lattice between painted pixels instead of through them.

## Setup

The smallest thing that answers it, and no server at all.

The pure half, in `packages/world/src/area.ts`: a drawn path is rasterised onto the master's own grid, the
pixels it took are traced back into rings along their edges, and that fence is the area from then on. What
it encloses, its census and its hit test are all derived from the fence whenever asked. Decision 0032
records why.

The interface half, in `apps/web/src/areas/`: a button in the debug panel arms a drag, the drag becomes a
fence, the fence is drawn as a line with an optional shade, clicking it selects it and makes the line
pulse slowly, and the panel lists how many master pixels of each terrain class it encloses. Delete, and
it is gone.

The terrain is read out of the zoom 7 tiles the browser already fetches, through the same decoder the
painter uses, now shared as `map/terrainClasses.ts`.

No command, no event, no frame, no Kotlin. An area lives in the browser and a reload forgets it. That is
the point of the spike: find out whether the component is right before deciding what the world should
remember about it.

## What we will look at

- Whether a drawn area's census matches what is under it by eye: sea where it lies on sea, farmland where
  it lies on farmland, and the shares summing to a hundred.
- Whether the boundary lines up with the painted squares at zoom 10 on the raw renderer, which is where a
  staircase either looks right or looks broken.
- Whether two areas drawn flush against each other divide the ground: their two totals should equal the
  total of one area drawn over both, with nothing missed and nothing counted twice. A unit test asserts
  this; the question here is whether it is true of areas drawn by a hand rather than by a test.
- Whether the same shape drawn at zoom 3 and at zoom 9 gives comparable numbers, since the count is meant
  to be a property of the area and not of the camera.
- What it costs. A county was 5,603 pixels, 217 vertices and 2 tiles in 4 ms of arithmetic offline; a
  coarse drag across 3,800 kilometres was 3.6 million pixels, 5,081 vertices and 168 tiles in 97 ms. The
  question is whether the tile fetching, which is the part offline numbers cannot tell us, is bearable on
  the main thread.
- Whether a fence of a few thousand vertices is something MapLibre draws without complaint.

## Observations

2026-09-09, in the browser at zoom 6 over Denmark and the sound, painted renderer.

A blob drawn from 72 samples came out as one part, 665 vertices, over a window of 464 by 195 master
pixels, enclosing 59,154 of them: farmland 49.0%, shallow-sea 37.2%, mixed-forest 4.2%, conifer-forest
2.7%, farmland-with-woods 2.6%, lake 1.9%, broadleaf-forest 1.3%, then meadow, swamp-forest, bog and
heath under half a percent each. Read from 6 tiles in 16 ms. About a third of the blob is visibly over
water and the shares sum to a hundred, so the census matches what is under it.

The ends joined themselves: the drag deliberately did not return to its start.

**The boundary does run between pixels.** At zoom 10 on the raw renderer, where a tile pixel is eight
screen pixels and the terrain is honest squares, the line is a staircase along their edges and never
crosses one. That is the thing the whole design was for and it is the thing you can see.

**Two areas drawn flush divide the ground.** Three separate drags at zoom 10, placed on exact pixel
corners: a west half of 100 pixels, an east half of 100, and the same ground drawn as one, 200. The
shared boundary was drawn twice and counted once.

**Zoom does not enter into it.** The same 200 by 100 pixel rectangle drawn at zoom 6 and at zoom 9 gave
byte-identical censuses: 20,000 pixels, twelve classes, every count the same.

Selection by clicking works both ways: inside selects, outside deselects, and the hit test agrees with
the shape that is drawn. The selected line pulses between 0.36 and 0.98 opacity and 2.0 and 4.1 pixels
wide, about two and a half seconds a beat. Deleting takes the line and the shade with it.

The painted renderer is unchanged after the tile decoder was moved out of the painter into
`map/terrainClasses.ts`, which is what proves that was a move and not a change.

Two things it cost. A drag of only three samples is a sliver of no area, and the scanline leaves isolated
pixels along its diagonal, so it fenced 66 separate one-pixel parts: correct, and it looks like nonsense.
And drawing is driven from screen pixels, so at zoom 6 a screen pixel covers two master pixels and a hand
cannot address one; the fence is still exact, but what a hand can point at is not.

## Result

## Decision

## Follow-ups
