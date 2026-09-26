# 0059. A sprite is a picture Adam hands over, and a tool cuts it for the map

- Status: accepted
- Date: 2026-09-25
- Amends 0052 on what a kind of scenery looks like, and leaves where it stands exactly as it was

## Context

Every sprite on the map was drawn in code. The sixteen kinds of scenery were Pixi `Graphics` calls in
`sprites/scenery/shapes.ts`, filled white and tinted per kind; the six marks were the same in
`PixiSpriteRenderer.ts`. The reason was the castle experiment's (0005): there was no SVG rasteriser on the
machine, and a shape in code is a shape a test can make without a file.

Adam wants to try real art, and started with a tree made in an image tool: a 1254-pixel square WebP,
**opaque**, on an off-white background, with the tree filling a quarter of it and its edges softened by
lossy compression. That is what pictures from such tools look like, and it is three removals away from
something the map can draw: the background, the empty canvas, and about eight times too many pixels.

Three things were already true and shaped the answer.

**The scenery is one particle layer**, and a particle layer draws from one texture (0052). Whatever the
art is, it ends up in one atlas.

**A kind is only ever drawn between about twenty and ninety pixels tall.** It arrives when it is big
enough to read (`READABLE` in `showing.ts`, twenty pixels) and the camera stops at zoom 10, where the
tallest kind - an oak of 4.8 world units, grown by its most vary - is 92. Nothing is ever drawn larger,
and below twenty nothing is drawn at all.

**The foot is the anchor** (0051), and a picture from a tool is not centred on its foot: roots splay, a
crown leans.

## Decision

**A sprite is a picture in `world/sprites/`, and `npm run world:art` cuts it for the map.**

- **The folder is Adam's**, and committed like `world/portraits/`: `scenery/<kind>` for each kind in
  `world/biomes.json`, and `marks/<name>` for each mark the map places. Any of PNG, WebP or JPEG; any
  size; on a flat background or a transparent one. **Saving over a file replaces it.** Two files that
  would both be the same sprite are refused, by the tool and by a test over the folder.
- **Every sprite has a placeholder**, the shape it used to be in code, written out as SVG and drawn with
  `--placeholders` - which never draws over a file that is there. `placeholders.json` holds the hash of
  each one drawn, so a placeholder is told from a picture by its bytes rather than by a naming rule.
- **The tool keys, trims, stands and shrinks.** It keys a flat background out by filling from the edges,
  so a pale patch inside a picture is kept. It takes the background's colour out of the soft edges it
  leaves, measuring each edge pixel against the solid picture beside it, so no tree carries a rim of the
  paper it was drawn on. It trims to what is left, finds the foot in the bottom rows, and shrinks the
  result to **192 pixels tall**. The pixel rules are `packages/world/src/art.ts`, and they are tests.
- **One size, and no versions per zoom.** 192 is twice the tallest a kind is ever drawn, so it holds on a
  display at 200 per cent. The browser builds the mipmaps, the smaller copies a graphics card uses for
  drawing something small, and that covers the other end. A different picture for far out would only
  be worth having if it showed a different *thing*, such as one picture of a copse, and that is a
  question about what the scenery is rather than about resolution.
- **One atlas, lossless WebP with alpha**, written to `public/art/` with the frames and the feet beside
  it. It is output and per-worktree, like the tiles. Lossy compression would save little at this size and
  put halos on the edges.
- **The art carries its own colour.** Nothing tints a picture any more; only the fade's alpha moves.
- **The dev server keeps it cut.** It cuts whenever a picture in the folder is saved, and on start if the
  tree has never been cut. It tells the page, which lets go of the old atlas and gathers again from the
  new one, so a picture saved over a placeholder is on the map without a reload. The cut says who drew
  what in the dev server's own output; the **Debug panel** says nothing about a cut that worked, only
  about one that did not. Adam asked for that on first sight: a line a cut was noise in the log.
- **No art, no scenery**, the same rule as a master with no sprite map. The log says which command to run.

**Only the scenery is drawn from the folder so far.** The marks have their placeholders but are still drawn
in code, because they are tinted in a house's colours and a picture would have to say which part of it takes
the colour. That is its own decision.

## Consequences

Adam can drop a picture into a folder and see it on the map in about a second, with no command to
remember, and the pictures he gives need no preparation: the background, the margin and the size are the
tool's problem.

**The sixteen silhouettes live on as placeholders**, in `packages/world/src/placeholderArt.ts`. That is the
"one definition of a pine" experiment 0007 asked for: the same outline can now be drawn with no browser,
because sharp rasterises SVG. The castle experiment's "no SVG rasteriser on this machine" is no longer true.

**A picture fixes its angle and its light.** Every picture on the map has to agree on where the sun is and
where the eye stands, and a picture that disagrees looks pasted on. What they have to agree on is in
`LOOK-AND-FEEL.md`, and how to hand one over is in `AUTHORING-THE-ART.md`.

**A placeholder is trimmed where its old texture was not.** The code drew each kind in a 64 by 72 slot, and a
low kind like heather left a sixth of the slot empty above it. Trimmed, the same `groundHeight` draws it
that much taller. No kind moved by more than a sixth, and `world/biomes.json` is where to take it back.

**The oak grew with its picture**, from 3.8 world units to 4.8: Adam's first look was that it reads at
twenty pixels and could be bigger in the world. A bigger kind arrives a third of a zoom level sooner.

`sharp` joins the world package as a development dependency. It brings prebuilt binaries rather than
compiling, and is only used offline and by the dev server.

## Alternatives considered

**Keep drawing in code and hand-port each picture into `Graphics` calls.** Only works for pictures simple
enough to be paths, which a picture from an image tool is not.

**An atlas per zoom band.** Nothing is drawn outside a range the mipmaps already span, and it would triple
what Adam has to check.

**Cut in the browser.** It would need no tool, but every page load would key and shrink 1254-pixel pictures
to draw 40-pixel ones, and the answer to "what does the map draw" would live only in a running page.

**Python and Pillow**, which the castle experiment used. They are on this machine but not in the project;
every other world tool is Node, and `npm install` has to be all a fresh tree needs.
