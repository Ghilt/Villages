# An experimental world master: 32 terrain classes

A second, higher-fidelity master image, painted from real Earth data, to be judged against
`world/master/terrain.png` and either adopted or thrown away. **Nothing outside this folder was
changed.** `world/palette.json`, `world/master.json` and `frontend/packages/world` are all untouched, so
the existing pipeline still builds the existing thirteen-class master exactly as before.

It exists because the thirteen-class master had three problems, and only one of them was the palette.

1. **The biome data was being thrown away.** RESOLVE Ecoregions carries 847 ecoregions; the old
   `master.json` mapped only its fourteen `BIOME_NUM` values. Biome 4 alone holds 83 ecoregions, nine of
   them European — Baltic mixed forests, Sarmatic mixed forests, Central European, Western European
   broadleaf, Celtic broadleaf, Pannonian, East European forest steppe, European Atlantic, North Atlantic
   moist — and all nine came out the same green. That is why the whole of Europe was one colour.
2. **There was no cropland input at all.** Europe is farmland, not forest, and nothing in the pipeline
   knew that.
3. **`fillPolygon` silently dropped anything smaller than a pixel.** An even-odd scanline fill needs two
   crossings on a pixel-centre row, so a sub-pixel lake painted nothing and reported nothing. This turned
   out to matter more than everything else put together: **95.8% of the world's 1.43 million lakes are
   smaller than one master pixel.** Adding better lake data without fixing this would have added nothing.

## The three files

| file | what it is |
| --- | --- |
| `terrain.png` | The map. 16384 x 8192, 8-bit indexed PNG, one flat colour per class, same geometry as the existing master: equirectangular, longitude -180 to 180 left to right, latitude 90 to -90 top to bottom. One pixel is about 2.4 km north to south. |
| `palette.txt` | Every class: id, name, hex code, water or land, and what it represents. Plain text. |
| `palette.png` | The same thing to look at — swatches with names, hex codes and meanings, grouped by family. |

And some extras:

| file | what it is |
| --- | --- |
| `palette.json` | The palette in the same shape as `world/palette.json`, plus a group and a meaning per class, so the two can be diffed directly. |
| `terrain-preview.png` | 2048 x 1024, for glancing at the whole world. Generated, never edited. |
| `sample-blekinge.png` | Blekinge and eastern Skane, magnified four times. **This is the one to look at**: it is where the old master had three lakes. |
| `sample-scandinavia.png` | Scandinavia and the Baltic, magnified twice. |
| `sample-europe.png` | Europe at 1:1. |
| `histogram.txt` | How much of the world each class holds. The quickest way to see a threshold went wrong. |
| `tools/` | Everything that made the above. See "Reproducing it". |

## The 32 classes

Water: `ocean` `shallow-sea` `lake` `river`
Cold and bare: `ice` `polar-desert` `tundra`
Forest: `taiga` `taiga-open` `conifer-forest` `broadleaf-forest` `mixed-forest` `rainforest`
`dry-forest` `mangrove` `swamp-forest`
Open land: `steppe` `meadow` `savanna` `scrub` `heath`
Farmed land: `farmland` `farmland-with-woods` `paddy`
Wetland: `marsh` `bog` `floodplain`
Dry land: `salt-flat` `desert-sand` `desert-stone`
High ground: `alpine-meadow` `bare-rock`

The important new one is `farmland-with-woods`: a pixel that is part field and part woodlot, which is
what most of settled Europe actually is, and what stops it being a single colour.

### One decision that needs your word

`world/palette.json` requires any two classes to be at least **48** apart in straight-line RGB distance,
which is what makes snapping a blended pixel back to a class safe. Thirty-two classes do fit at 48, but
the colours get shoved a long way from what they should look like — mangrove lands on a blue-grey,
`farmland-with-woods` on a tan. **This palette uses 40 instead**, where every colour stays within 15 of
its intent and most within 5. Given that the authoring rules already mandate the Pencil, no
anti-aliasing, zero bucket tolerance and Nearest Neighbour interpolation, 40 looks safe — but it is a
loosening of a rule that exists for a reason, and it is not mine to decide. The closest pair is
`taiga-open` and `swamp-forest`, at exactly 40.

## Where the data came from

Everything is a direct download, no account needed, and all of it is either public domain or CC-BY.

| source | what it gave | size | licence |
| --- | --- | --- | --- |
| [Copernicus Global Land Cover 100 m, collection 3, epoch 2019](https://zenodo.org/records/3939050) — discrete classification map | Cropland, the closed/open forest split, needleleaf vs broadleaf, shrubs, herbaceous vegetation, herbaceous wetland, bare ground. **This is the layer that fixes Europe.** | 1.71 GB | CC-BY 4.0 |
| [HydroLAKES v1.0](https://www.hydrosheds.org/products/hydrolakes) — pour points | 1,427,688 lakes down to 10 ha, each with its area. **This is the layer that fixes Blekinge.** | 79 MB | CC-BY 4.0 |
| [HydroRIVERS v1.0](https://www.hydrosheds.org/products/hydrorivers) | 8.5 million river reaches with Strahler order; 510,179 of order five and up are drawn. | 544 MB | CC-BY 4.0 |
| [RESOLVE Ecoregions 2017](https://ecoregions.appspot.com/) | Biome and ecoregion name, for climate context and for the poles the land cover map does not reach. | 149 MB | CC-BY 4.0 |
| [Natural Earth 10 m](https://www.naturalearthdata.com/) | Coastline, minor islands, big lake outlines, glaciers, Antarctic ice shelves, playas, named rivers, and the 200 m isobath. | ~35 MB | public domain |

The pour-point file is worth a note. HydroLAKES also publishes polygons, at 820 MB — ten times the size.
But 95.8% of its lakes are smaller than a master pixel, so their shape is unrepresentable anyway: a point
plus the lake's area is enough to stamp a disc of the right size in the right place. Only the largest few
thousand lakes have a shape worth having, and Natural Earth already carries those with proper outlines.
Ten times cheaper for very nearly the same picture.

Credits, if any of this is adopted: **Copernicus Global Land Service, Land Cover 100 m, CC-BY 4.0** ·
**HydroLAKES / HydroRIVERS (HydroSHEDS), CC-BY 4.0** · **RESOLVE Ecoregions 2017, CC-BY 4.0** ·
**Natural Earth, public domain**.

## What is real and what is invented

Real, and taken straight from the data: every coastline, lake position and size, river course, glacier,
biome and ecoregion boundary, and every land cover mixture.

Invented, and worth arguing about:

- **The thresholds.** All of them live in one object called `T` at the top of `tools/build.mjs`. The
  Copernicus map says what grows in a pixel; those numbers say what to call it. `farmedIsFarmland: 0.2`
  means a pixel one fifth under the plough counts as farmed land rather than forest — that single number
  is most of what makes Europe stop being green.
- **Sub-pixel features get a whole pixel.** A ten-hectare lake is a thirty-third of a pixel and gets a
  full one. This is deliberate, and it is why southern Sweden now has 485 lakes where it had three. The
  consequence is that lake area is roughly twice life size.
- **Sand versus stone desert.** No global dataset distinguishes erg from reg, so the split is by how
  utterly barren a pixel is: above 99% bare reads as sand, merely sparse reads as stone. It puts sand
  where sand mostly is, but it is a proxy, not a measurement.
- **`heath` and `paddy`** are inferred rather than mapped: shrubland north of 50 degrees is called heath,
  and cropland with standing water is called paddy.
- **The minimum river order, and which ground is too dry for one.** Both are in `T`, and both were
  changed after looking at the result: order three and rivers everywhere.
- **Taiga is decided by biome, never by latitude.** An earlier pass used "north of 55 degrees" and made
  taiga of southern Sweden, the Baltic states and the whole Russian mixed-forest belt. Biome 6 and 11
  only, now, which is why southern Sweden reads as `conifer-forest` and Norrland as `taiga`.

## Three things that had to be worked around, and are worth knowing

- **HydroRIVERS drains the Greenland ice sheet.** Its network is derived from a terrain model, so it
  carries hundreds of rivers straight across the ice cap that do not exist, and they comb it with blue
  lines. Glaciers are therefore painted *after* the rivers rather than before, and cover them.
- **Natural Earth's bathymetry polygons are the water deeper than each isobath, not shallower.** `K_200`
  is the deep ocean. The shelf is what is left when the deep is painted back over a world that starts as
  shallow.
- **A lake's pour point is not its shape.** Drawing every HydroLAKES lake as a disc put a circle the size
  of Vanern straight over Vanern's own coastline. Only 986 of the 1.43 million lakes are more than four
  pixels across; above that the disc is dropped and the Natural Earth outline is used instead.

## Known problems

- **The Copernicus map stops at 80 degrees north and 60 degrees south.** Northern Greenland, the tips of
  the Canadian archipelago, Svalbard's north and all of Antarctica fall back to ecoregions and Natural
  Earth glaciers. That is why the far north is coarser than the rest.
- **The coastlines disagree.** Copernicus and Natural Earth do not draw the same shore, so a land cover
  class is only written where Natural Earth already says land. The coast is Natural Earth's, everywhere.
- **Rivers were too dense at order three**, which laced every continent with water until the map read as
  nothing but drainage. `T.minimumRiverOrder` is 5 now: 510,179 reaches instead of 2.1 million, which
  leaves the rivers a person would name and expect to need a bridge for. Still a judgement call.
- **Rivers are kept off ground too dry to hold one.** HydroRIVERS is derived from a terrain model, so the
  Sahara arrived threaded with wadis. `T.tooDryForRivers` names the classes that keep their own terrain
  where a river claims to cross them, which took 92,774 pixels back. It is the same problem as the network
  across the Greenland ice sheet, and the named rivers that really do cross deserts come from Natural
  Earth afterwards, so the Nile is unaffected.
- **`salt-flat`, `marsh`, `paddy` and `floodplain` are thin.** They exist but they are rare. GLWD v2
  (Lehner et al. 2025, 33 wetland classes at 15 arc-seconds) would fill all four in properly, and would
  give Sweden and Finland their mires from data rather than from a threshold. It is on Figshare and I have
  not confirmed its file sizes.
- **The speckle is deliberate, and may still be too much.** Sub-pixel lakes, single-pixel wetlands and a
  drainage network at order three all exist to break up flat colour, which is what was asked for. If it
  reads as noise rather than texture, the knobs are `minimumRiverOrder` and `maximumLakeDiscRadius`.
- **The master is in one projection and the game draws another.** Unchanged from the existing master, and
  still true: what you paint here is stretched about twofold vertically in Mercator at Scandinavia's
  latitude.

## Reproducing it

`tools/` has no `package.json` and no dependencies. It runs with bare `node` (24 or newer, for TypeScript
type stripping, since it imports the raster and PNG modules from `frontend/packages/world`) and reads
files already on disk. Three of the four readers it needs are hand written for the same reason the PNG
encoder in `packages/world` is: the part of each format we need is small.

- `tools/palette.mjs` — the palette, and the one place its colours are written down. Everything else is
  generated from it.
- `tools/build.mjs` — the pipeline. Every threshold is in `T` at the top.
- `tools/writePalette.mjs` — writes `palette.txt` and `palette.json`.
- `tools/drawPalette.ps1` — draws `palette.png`. PowerShell and System.Drawing, because readable text
  needs a real font.
- `tools/shapefile.mjs` — a read-only shapefile and dBASE reader.
- `tools/bigtiff.mjs` — a read-only reader for tiled, deflate-compressed, eight-bit BigTIFF, which is
  what the Copernicus map is.
- `tools/crop.mjs` — reads a master back and cuts a magnified region out of it, for looking at any part
  of the world without rebuilding. Its `decodeIndexedPng` is also the first half of what the importer
  will need.

```bash
node tools/crop.mjs terrain.png look.png 12.5 55.0 18.5 57.8 4
```

Fetch the sources into one directory, laid out as `LC100.tif`, `eco/Ecoregions2017.{shp,dbf}`,
`lakes/HydroLAKES_points_v10.{shp,dbf}`, `rivers/HydroRIVERS_v10.{shp,dbf}`, and the Natural Earth
`.geojson` files at the top level. Then:

```bash
node --max-old-space-size=8192 tools/build.mjs --source <that directory> --width 16384 --step 2
```

Under two minutes for the whole world, most of it inflating 782,736 land cover tiles. For tuning
thresholds, `--window w,s,e,n` paints one box at full resolution in seconds:

```bash
node tools/build.mjs --source <that directory> --window 13,55,17.6,57.4 --width 16384
```

`--step` is how finely the land cover map is sampled inside each master pixel: 2 gives about 121 samples,
1 gives about 490 and takes four times as long for very little difference.

## If this is adopted

The parts worth moving into `frontend/packages/world` are, in order of how much they earn:

1. **The minimum-one-pixel rule in `fillPolygon`.** It is the smallest change and the largest effect, and
   nothing else works without it. It should report the pixels it painted rather than staying silent.
2. **HydroLAKES pour points as a source**, with a disc sized from the lake's area.
3. **A BigTIFF raster source kind**, and a layer type that assigns classes from land cover fractions with
   the thresholds in `master.json` rather than in code.
4. **HydroRIVERS**, with width from Strahler order. Note that `unzipSync` on a whole archive will not
   survive an 820 MB zip; these were extracted to disk first.
5. **The ecoregion name hints**, which cost nothing — the data is already downloaded — and would give
   Europe several greens even with no other change.

The palette ids would need fixing before anyone starts editing in earnest: renumbering them later
invalidates hand-painted work.
