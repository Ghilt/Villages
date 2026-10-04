---
name: nine-slice
description: Make a nine-slice border for world/ui/borders/ out of a frame picture that was not painted as one - an image model's nine tiles with gaps between them, a framed box standing on stone or on black, a box of white pasted over its middle - keeping only the frame, cutting where its tiles meet, and giving it a fill. Use whenever Adam hands over a frame, a border or a "nine slice", or asks for a picture to be nine-sliced.
---

# Nine slice

A nine-slice job turns a picture Adam gives into a border the component library can lay round a box of
any size: `world/ui/borders/<name>.webp` and its file of cuts, and a fill for inside it. **Only the frame
is kept.** What it stands on, outside it and inside it, is cleared, and the inside is given a fill.

The tool does the cutting: `scripts/nine-slice.ts`, run from `scripts/` as `node nine-slice.ts`, its
rules tested in `scripts/test/`. It needs `npm install` in `scripts/` once, for sharp. It knows no folder of
the program's: it is given a picture and writes into the folder it is run in, or `--out`, and ends by saying
what it wrote and where. This file is how a job is done. Where the pictures go and what a border's file says
is `docs/AUTHORING-THE-ART.md`; what a container does with them is `docs/UI-COMPONENTS.md`.

The two done first are the worked examples, their pictures and recipes kept in `world/ui/sources/`:
`gilt-cherubs`, nine tiles on white gaps, clear round the frame, its middle tile a clean felt made into the
fill; and `gilt-acanthus`, nine tiles on dark seams, standing on stone with a white box laid over its
middle, which hid the seams, so its tiles are written out and its fill is painted.

## 1. Keep the source

Save the picture **as Adam gave it, untouched**, to `world/ui/sources/<name>.<ext>`, named for what the
frame is, `gilt-<what>`. It is his, and committed; the border is made from it and can always be made
again, so nothing is ever done to the source by hand.

## 2. Look at it

    node nine-slice.ts --look ../world/ui/sources/<name>.webp

says its size, how it would cut it - between white or black gaps, between thin or engraved lines, or, with
no lines, where each edge starts to repeat - and what it takes the frame to stand on. Nothing is written.
Look at the picture as well, and at a corner and each seam up close, cropped large with a grid over it.

Then decide four things, each an option of the tool:

- **Where the tiles are.** When `--look` cuts where the tiles really meet, leave it. When it does not - a
  box pasted over the middle hides the middle of every seam - measure each seam: the mean brightness of
  each column (or row) across it, over a stretch of frame and a stretch of what it stands on, and the tile
  ends where the brightness is back to its neighbours'. Say a frame with no lines with `--cuts top,right,
  bottom,left`; tiles with gaps between them, written out, go into the recipe's `"columns"` and `"rows"`,
  three spans of `[first, last]` each, both counted, gap and edge left out, and the border is made from the
  recipe.
- **What the frame stands on.** `--background` is `auto` unless there is a reason. `alpha` when it is
  clear round the frame, and what is nearly clear - alpha under 16, the film a saving leaves - is cleared
  outright. `checker` on painted checks, `none` only when the frame really runs to the edge. A number for
  a gilt frame on anything cooler - stone, black, white, felt: gilt keeps its red well above its blue even
  in its darkest groove (42 to 107 in the acanthus frame) and the stone it stood on did not (13 to 24).
  Choose the number between the frame's lowest and the ground's highest. Where the frame holds something
  as cool as its ground but lighter - pale clouds on a night sky - say how dark the ground is as well,
  `30,dark:110`, and only what is both cooler and darker than that is cleared. `auto` chooses that itself
  for a picture whose edge is a dark, cool ground, and says so. A picture with transparency of its own keeps it
  whichever is chosen: what is clear in it stays clear, whatever colour a saving left under it - often
  white, which made opaque would stand round the frame as a halo. Whatever the picture's edge or its middle
  can reach through the ground is cleared; a dark crevice inside the frame that neither reaches is kept, as
  the frame's own shadow; a fleck left standing on its own, under a fiftieth the size of the frame, is
  cleared too. **A border holds its frame and nothing else**: what it stood on, outside it and inside
  it, is a fill's to give, so that a pane's ground can be changed - for a light look and a dark one -
  without painting the frame again.
- **The middle.** Made a fill with `--fill <name>`, mirrored into a square twice its size so it repeats
  without a seam: the border keeps only its frame, and the recipe lays the fill under it. Keep the middle
  as the border's own only when it is part of the frame rather than what the frame stands on - the
  default, so say `--fill` or `--clear-middle`. When the middle is a white box, a picture, or a texture
  that darkens towards the frame - mirrored, that bands - `--clear-middle` drops it and a painted fill is
  laid instead: a look in `frontend/packages/world/src/uiFills.ts` in the ground's colours and a
  placeholder for it in `frontend/packages/world/src/uiPlaceholders.ts`, as `stone` is for the acanthus
  frame. `cloud-border`, `cloud-2-border` and `science-border` came in whole, their skies and panel
  painted in; they were made again from themselves as sources, their middles made `cloud-sky`,
  `cloud-2-sky` and `science-panel`.
- **The edges.** `--repeat round`, the default, unless there is a reason: an image model's edge tile is a
  segment with capped ends - an acanthus joint, a column's ring - and `round` lays a whole number of them,
  so none is cut off at a corner. `stretch` for a plain moulding with nothing on it. An edge tile with a
  centrepiece on it - a sunburst, a crest - is laid that many times along a long box: say so to Adam.

- **Its size.** The game shows a border at a quarter of its pixels, so how thick it looks is how big it
  is made: `--width 448` gives corners of thirty to forty pixels on screen, the size of the borders
  beside it; an image model's 1254 as it is gives a hundred. Ask Adam when the frame is not like the others.

## 3. Make it

    node nine-slice.ts ../world/ui/sources/<name>.webp --name <name> --out <a folder of its own>

writes `<name>.webp` and `<name>.json` - its cuts where the tiles met, where its words start, and, when the
middle is not kept, a fill reaching four pixels under the frame's inner edge, measured all along each side
and set by its moulding, not by a cloud or a ray standing in from it - and `<name>.recipe.json`, and the fill when there is one. Move the border and its file into
`world/ui/borders/`, the recipe into `world/ui/sources/` beside the picture, and a fill into
`world/ui/fills/`; a recipe in `world/ui/borders/` would be taken for a file of cuts. Made again, it is
`node nine-slice.ts ../world/ui/sources/<name>.recipe.json --out <a folder>`. The dev server cuts the border
at once, as it does any picture saved in the folder.

## 4. Look at what it made

- **A contact sheet on white and on black**, from its 3x cut in `frontend/apps/web/public/ui/ui.json`:
  whatever is left of the ground shows on one or the other. A pale or a dark line where the tiles were
  joined is a gap's edge reaching further than was cut: take a row more off that tile. A hole in the
  moulding is too high a warmth. Specks of the ground still standing are too low a one.
- **The page**, `/admin/inspect-ui-components` on this tree's port. *Borders and fills* shows the new
  border at three sizes with no code changed. Give it a recipe, `pane.<what>`, with its fill, in
  `frontend/apps/web/src/ui/container/recipes.ts`, and what it holds in `admin/showcase/Containers.tsx`, and
  look at it as a pane on night and on parchment, at desktop width and at a phone's.
- **Where its words start.** The tool works it out - past each edge at its deepest, a column's ring and
  not only its shaft, because an edge is laid along the box again and again, and clear of each corner's
  ornament by whichever of the corner's two sides costs the words less room - and writes it as
  `content` in the border's file, so the words start inside the cuts of a frame with deep corners and
  thin edges. The page's drag box draws the cuts dashed and labels where the content starts: look at it
  there and in a pane. When it is not where it should be, say it in the recipe, `"content": [top, right,
  bottom, left]` in the joined picture's own pixels, which the tool writes instead, so a remake keeps it.

## 5. Hand it over

Say which source it is made from, its tiles and cuts, what it stood on and how that was cleared, the fill
and whether it is a placeholder, the recipe it is shown in, and what the pictures weigh. The source, its
recipe, the border and its file, the fill, and the container recipe go into the folder together; the
folder's own test holds every source to a recipe and every recipe to its picture and its border.
