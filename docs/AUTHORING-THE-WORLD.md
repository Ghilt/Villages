# Authoring the world

> **What belongs here:** how to edit the hand-painted master and what the pipeline does with it. **What
> does not:** why the world is authored as an image (decision record 0018), or what the world is in the
> fiction (`SETTING.md`).

The shape of our world is not in the code. It is one image, `world/master/terrain.png`, and you edit it by
hand. Everything the game knows about where land is, where a coast runs and what grows there is derived
from that image. This document is how to edit it without fighting the pipeline.

## What the image is

An indexed PNG, 32768 by 16384, unprojected: longitude runs left to right from -180 to 180, latitude runs
top to bottom from 90 to -90. Each pixel is about 1.2 kilometres at the equator. That is 537 megapixels,
so give an image editor a moment to open it. One flat colour per
terrain class, thirty-two of them, listed in `world/palette.json` and drawn with their names and meanings
in `world/master/palette-strip.png`, which is the chart to eyedrop from.

The starting point was painted from real Earth: coastlines, ice and big lake outlines from Natural Earth,
land cover from Copernicus at 100 metres, every lake down to ten hectares from HydroLAKES, the drainage
network from HydroRIVERS, and biome context from RESOLVE Ecoregions. So the world begins as Earth, with
Earth's terrain in the right places, and becomes ours as you cut it up. How it was made, and every
threshold in it, is in `world/master/experiment/README.md`.

`world/master/terrain-preview.png` is a small copy for glancing at. It is generated, never edited.

## The colours are data, not the look

The greens and browns in the master are not what the game draws. They exist so that you can tell classes
apart while painting, and so that the importer can tell them apart afterwards. What a forest looks like is
the renderer's business, and it will not resemble this.

With one exception, and it is there to be useful rather than to be looked at. The `Vivid` renderer draws
these very colours, pushed harder than they were painted, with none of the paint over them. That is the
view to compare against what is on screen in the image editor: the same colours, the same hard pixel
edges, at whatever zoom the map is at. `world/render.json` is a little over half as saturated as this
palette, and two of its classes sit six apart in colour where the palette keeps every pair forty apart,
so a stray pixel that is invisible in every other renderer is plain in this one.

Two classes are never closer than 40 apart in colour, which is what makes the next part safe. There is a
second palette, `world/render.json`, which is what the terrain is actually *drawn* in. Editing that
changes how the world looks without touching what it is.

How it is drawn is two more files, and neither of them is this one. `world/render.json` is the colour each
class wears on the map. `world/painterly.json` is what the paint does to that colour: how a boundary
frays, how pigment gathers along an edge, what mark each kind of ground is drawn with, the grain of the
paper. `npm run world:paint --prefix frontend` shows the result, every view painted and flat side by side.
Editing either changes how the world looks without touching what it is, and neither needs the master
rebuilt.

## Editing

Everything you asked a bespoke tool for, your image editor already does better:

| What you want | How |
|---|---|
| Move a landmass | Lasso around it, then Free Transform |
| Rotate or mirror it | Free Transform, rotate and flip |
| Copy Sweden into the Pacific with its terrain | Lasso, copy, paste, drag. The terrain comes because it is the same pixels |
| Warp a coastline | Free Transform's warp, Puppet Warp, or Liquify |
| Borrow terrain from elsewhere | Clone Stamp |
| Try a variant without losing this one | A layer |

Four settings matter, and getting them wrong will show up as mush along every edge:

1. Work in RGB mode, not Indexed, so that layers and transforms are available. The importer maps colours
   back to classes on the way in.
2. Use the Pencil, not the Brush. The Brush feathers its edges.
3. Turn anti-aliasing off in the selection tools and in the paint bucket, and set bucket tolerance to zero.
4. Set image interpolation to Nearest Neighbour, in preferences. Otherwise every transform blends the
   classes along its edges into colours that mean nothing.

Save over `world/master/terrain.png` as PNG, with no dithering.

## What the importer forgives

Every pixel is snapped to the nearest class, so a blended edge left behind by a transform becomes a clean
boundary rather than an error. The importer reports how far it had to reach: a colour that was nowhere near
any class is named and counted, so a mistake is loud rather than silent.

That is a safety net, not a licence. A feathered brush over a large area will snap to something, and what
it snaps to will surprise you.

## What travels with a copy, and what does not

Terrain does, because terrain is the pixel. Rivers do, because they are painted into the image as a class
two pixels wide rather than kept as lines. Nothing else exists yet.

## Seeing your edit

Save the image, alt-tab to the running app, and pick it in the **Debug map** panel at the top right. Its
terrain dropdown is every PNG in this folder, so a candidate saved as `terrain2.png` is offered beside
`terrain.png` rather than having to overwrite it, and the panel says whether what is on the screen is
still what the image says. A master nobody has cut yet, or one saved since it was last cut, gets a button
that runs the two commands below and puts their output in the debug log while it works. See
`docs/adr/0025`.

The same two commands from the repository root, not from inside `frontend/`:

```
npm run world:import --prefix frontend
npm run world:tile --prefix frontend
```

The first traces the coast and the large lakes into the lines the map draws in ink. The second cuts the
world into map tiles, which is how the terrain itself is drawn: thirty-two classes over a world this
detailed come to well over a hundred thousand outlines, so terrain is pixels and only the ink is vector.
See `docs/adr/0019`. The tiler works out where the master's detail runs out, which is zoom seven for a master this wide, and
writes 21,845 tiles totalling 65 MB into `masters/<name>/tiles`. Tracing takes under a minute and
cutting takes another four. A screen of map costs a few tens of
kilobytes of that.

From inside `frontend/` it is `npm run world:import`, with no prefix. The prefix is what tells npm where
the workspace is, so using it in the wrong place makes npm look for `frontend/frontend`.

That reads the master, snaps every pixel to a class, traces each terrain into outlines, smooths them, and
writes the world the game draws. It prints what it found: how many pixels were not an exact class colour,
which unexpected colours it had to reach for, and how many shapes each terrain became. Then reload the
app.

It also writes a small terrain grid the game can ask questions of, such as what a house is standing on.

Two numbers in the importer decide how faithful the tracing is, and they are worth knowing about. Shapes
smaller than about 140 square kilometres are dropped as specks, which is what a stray brush pixel becomes.
Outlines are simplified by about two pixels and then smoothed once, so a coast is smooth at every zoom
rather than a staircase, and no finer than what you painted.

## The files in world/master

| File | What it is |
|---|---|
| `terrain.png` | The world. Yours. This is the one you edit, and the one the app draws by default |
| `terrain2.png`, anything else | Any other PNG here is a world too, offered in the Debug map dropdown |
| `terrain-base.png` | The generated master your edits sit on top of. Do not edit it |
| `<name>-preview.png` | A small copy of that master for glancing at. Generated |
| `palette-strip.png` | The thirty-two classes with their names and meanings, to eyedrop from |
| `experiment/` | How this world was made, its sources, its thresholds and the generator |

The base matters for one reason: it lets a rebuild happen without losing your work. When the master build
improves, it writes a fresh master alongside rather than over yours, and then

```
npm run merge --workspace @villages/world -- <base> <yours> <fresh> <out>
```

compares your master against its base, and applies only the pixels you actually changed to the fresh one.
Everything you painted survives; everything you never touched comes out improved. Promote the result to
`terrain.png` and the fresh master to `terrain-base.png`, and you are ready for the next time.

It also prints what it found, terrain by terrain, which doubles as a description of your own edits.

## Regenerating the starting point

The world is built from 4.4 GB of downloaded data, in `world/source/`, which is not committed. To fill it
from nothing:

```
npm run world:fetch-all --prefix frontend
```

About ten minutes on a decent connection, once. Adding `-- --list` says what the five sources are, what
each one contributes and how it is licensed, without downloading anything. Three of them are CC-BY and
must be credited, which the map does in its attribution control.

`npm run world:master --prefix frontend` repaints the master from Earth. It **refuses to overwrite** an
existing `terrain.png` and writes `terrain-fresh.png` alongside instead, so a rebuild can never destroy a
world somebody painted. Merge it as above, or pass `-- --force` if you really do want to start again. The raw data it needs comes from
`npm run world:fetch --prefix frontend`, about 145 MB, downloaded once and not committed.

The master itself is committed, so the world travels with the repository and a fresh clone needs no
downloads to run the game.

## The one thing to know before you start

You are painting in one projection and the game draws another. The master is unprojected; the game renders
Mercator, which stretches Scandinavia about twofold vertically. A shape you paint will not look identical
in the game. There is no fix worth the cost, so instead the loop is short: edit, rebuild, look.
