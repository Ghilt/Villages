# Authoring the world

The shape of our world is not in the code. It is one image, `world/master/terrain.png`, and you edit it by
hand. Everything the game knows about where land is, where a coast runs and what grows there is derived
from that image. This document is how to edit it without fighting the pipeline.

## What the image is

An indexed PNG, 16384 by 8192, unprojected: longitude runs left to right from -180 to 180, latitude runs
top to bottom from 90 to -90. Each pixel is about 2.4 kilometres at the equator. One flat colour per
terrain class, thirteen of them, listed in `world/palette.json` and laid out as a strip in
`world/master/palette-strip.png` to pick from with an eyedropper.

The starting point was painted from real Earth: coastlines, lakes, rivers and ice from Natural Earth, and
biomes from RESOLVE Ecoregions 2017, whose fourteen biomes map onto our classes. So the world begins as
Earth, with Earth's terrain in the right places, and becomes ours as you cut it up.

`world/master/terrain-preview.png` is a small copy for glancing at. It is generated, never edited.

## The colours are data, not the look

The greens and browns in the master are not what the game draws. They exist so that you can tell classes
apart while painting, and so that the importer can tell them apart afterwards. What a forest looks like is
the renderer's business, and it will not resemble this.

Two classes are never closer than 48 apart in colour, which is what makes the next part safe.

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

From the repository root, not from inside `frontend/`:

```
npm run world:import --prefix frontend
```

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
| `terrain.png` | The world. Yours. This is the one you edit |
| `terrain-base.png` | The generated master your edits sit on top of. Do not edit it |
| `terrain-preview.png` | A small copy for glancing at. Generated |
| `palette-strip.png` | The thirteen colours, to eyedrop from. Generated |

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
