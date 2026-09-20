# The world-generator

**What belongs here:** what the world-generator is for, what it has to work with, the order it would
be built in, and the questions that have to be answered before it can be. **What does not:** how
scenery is drawn today, which is decision record 0052 and experiment 0006; what the world is as
fiction (`SETTING.md`); how the master is painted (`AUTHORING-THE-WORLD.md`); what any of it looks
like (`LOOK-AND-FEEL.md`); or when it gets built (`ROADMAP.md`). Nothing here is decided. When a part
of it is, that part becomes a decision record and leaves.

---

## What it is

**A system that reads the hand-painted master and produces a world that seems lived in.**

Experiment 0006 proved the machine will draw the furniture — sixty thousand pieces at once, and about
a quarter of that before it stops feeling smooth in the hand. So the count was never the problem. The
problem is that a carpet of evenly scattered pines is not a world. It is wallpaper, and the eye reads
it as wallpaper within about two seconds.

What makes a place look inhabited is not density. It is **evidence of people and of time**: that
somebody chose to live *there* and not fifty metres left, that a track runs between two of those
choices, that the fields are near the houses and the woods are not, that something was here before
and is not any more. None of that is noise. All of it is consequence.

Adam's words for it: *"we need a system to make the world seem real and lived in... based on the
master-pixel map generate a compelling world of sprites."*

## What it has to work with

**The master.** 32768 by 16384 pixels, one of 32 terrain classes each, hand-painted, in eight groups.
About 1.2 kilometres to a pixel at the equator. It is the only authority on what the world is, and it
changes whenever Adam paints — so anything derived from it must be cheap enough to derive again.

**World space**, the Mercator square the map is drawn on (0030), which is what the scatter already
places things in, and `hash2`, which is what both the scatter and the painterly treatment already
hash with.

**The four datasets the world was built from**, in `world/source/` and fetched by
`npm run world:fetch-all --prefix frontend`. It is worth naming what they are, because it is also
worth naming what they are not:

| | what it knows |
| --- | --- |
| Copernicus land cover | one byte per hundred-metre square — this is what knows Europe is farmland |
| RESOLVE Ecoregions | 847 ecoregions in 14 biomes, for climate |
| HydroLAKES | 1.43 million lakes to ten hectares |
| HydroRIVERS | 8.5 million reaches, each with a Strahler order |

**Every one of them is physical geography.** Not one of them knows where anybody lives. That is the
gap the world-generator is about.

## On finding an API for it

Adam asked whether there is something out there to help. There is, and there is a reason to be
careful with it.

The obvious candidates are **Natural Earth populated places** (free, tiny, already a source this
project consumes), the **GHSL settlement grid**, and **OpenStreetMap** for roads and field boundaries.
Any of them would tell us where people are on *Earth*.

But this world is not Earth. It was warped from it by twelve control points and a 0.42-degree wobble
(0017), and then **painted over by hand**. A settlement layer laid on from real Earth would put a town
in the sea wherever Adam has moved a coast, and would keep putting it there every time he paints. The
warp is reversible and the existing sources go through it, so it is *possible* — but it binds the
world to a coastline Adam is free to change, which is the one thing the project has consistently
refused (0018, 0025).

**So the recommendation is the other way round: infer the human geography from the master rather than
import it.** Where a settlement goes is a question the terrain can answer — the coast, a river mouth,
a confluence, flat fertile ground, not too high, not in a marsh. That answer survives Adam repainting,
costs no download, and is the same kind of thing the scatter already is. Real-Earth data is then worth
having for one job only: **checking the generator's output against a place we know**, which is what
the warped world was for in the first place.

This is the first thing to decide and it deserves its own record.

## What "lived in" is made of

Roughly in the order the eye reads them, and each one is a layer the next can lean on.

1. **Regions.** The world must not be uniform. Coherent stretches with character — a pine belt, a
   country of hedged fields, a bare upland — larger than a screen and smaller than a continent. Low
   frequency noise over the terrain, so that two forests of the same class are not the same forest.
2. **Settlements.** Where people chose to be. Inferred from the terrain: water, fertile ground,
   shelter, a crossing. Sparse, global, and the anchor everything human hangs off.
3. **Ways between them.** A track from one settlement to the next, following valleys, crossing rivers
   where a river is crossable. Roads are the single strongest signal that a place is inhabited, and
   the one most obviously missing today.
4. **Worked ground.** Fields, pasture and orchards, thickest by a settlement and thinning with the
   walk from it. This is what turns "farmland" from a colour into somebody's farm.
5. **Marks of time.** A ruin, an old boundary through a wood, a coppice, a dead tree. Rare by design.
   One in a screenful is a story; ten is a texture.
6. **The scatter, told what it is standing in.** What 0006 built, but reading the layers above rather
   than the terrain class alone: sparse where a field is, dense in a wood, absent on a road, crowding
   a boundary.

The order matters. Six without the others is what we have now, and it is wallpaper.

## The shape it probably wants

One split is doing most of the work here and should be decided early.

**Sparse and global is baked; dense and local is derived.**

- **Baked**, offline, alongside the tiles: settlements, ways, region fields. There are thousands of
  them, not millions; they are wanted at every zoom; they take real work to place well; and they must
  be the same for every player, because two players must be able to talk about the same town. This is
  `frontend/packages/world/bin/` work, output beside the cut tiles, regenerated when the master
  changes — the same contract the tiles already have.
- **Derived**, in the browser, never stored: the scatter. Millions of pieces, wanted only close in,
  cheap from a hash. This is exactly what 0052 settled and it should not change.

The seam between them is that the derived layer *reads* the baked one. A pine needs to know it is
forty metres from a road.

## Open questions

- **Infer the human world, or import it?** The recommendation above is to infer. It should be argued
  properly and recorded.
- **Does a settlement here have anything to do with a player's house?** A generated town and a founded
  house are different things, and whether they may share ground is a question for `MECHANICS.md`, not
  for the generator.
- **How much does the generator owe the painterly treatment?** A field drawn as scenery and a field
  drawn as a wash are two answers to one question, and 0052 already records that the handoff between
  them is unfinished.
- **Where does the fiction constrain it?** `SETTING.md` decides whether this world has cities, roads,
  ruins at all. The generator should be told, not guess.
- **How is it reviewed?** The stills answer this for the paint (0021). The generator wants the same:
  a handful of named places rendered offline, so a change to it can be argued from a picture.

## What is already true, and is the budget

From experiment 0006, on Adam's own machine and by his own reading:

**A point every 1.5 world units — about 0.44 to the square unit — is the upper bound.** Past that it
lags in the hand. The machine will draw four times more than that, so the generator's budget is set by
feel and not by the renderer. Whatever it produces has to fit inside that.

And the bound that bit hardest is not the count but **how many cells a view spans**, which is worst
when the camera is far out — four times more for every zoom level back. Anything the generator adds
per unit of ground inherits that, and should be checked at zoom 6 before it is admired at zoom 10.
