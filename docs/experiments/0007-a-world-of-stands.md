# 0007. A world of stands

- Status: closed
- Started: 2026-09-21
- Closed: 2026-09-21

## Hypothesis

Scenery gathered into **stands** — clumps of a few kinds, placed by a program that read the master, and
clipped to the terrain Adam painted — will read as a place rather than as wallpaper, where the even
scatter of 0006 does not; and a **biome** chosen from the ground, the latitude and a slow noise field
will make two forests of the same terrain class in different parts of the world look like two different
forests. Both inside 0006's budget of 0.44 points to the square unit, and without the browser storing or
being sent a single sprite.

Falsifiable three ways. The stands may read as blobs rather than as woods. The biomes may be
indistinguishable once the terrain class has had its say, in which case the whole first layer is an
expensive noise field. And the arrangement may only be affordable by spending more points than the
budget allows, which would mean the look is bought from the frame rate.

## Setup

The smallest thing that answers it, built in the order of `docs/plans/biome-sprite-map.md`:

- `world/biomes.json`, hand-edited, holding the kinds and the biomes, validated by a test over the real
  file.
- An offline generator, `npm run world:sprites`, that reads the master, writes a biome raster in world
  space and a list of stands chunked by zoom 7 tile, and prints what it made.
- The browser's existing scatter, which keeps 0052's mechanism entirely — the same grid, the same
  `hash2`, the same 32-unit cells, nothing stored — and changes only what it asks the ground.
- Sixteen kinds instead of three, drawn in code as the three are.

Nothing on the wire, no server, no protocol. The one new thing on disk is a generated directory per
master that a master is allowed not to have.

## What we will look at

**For the hypothesis about the look, Adam's eye, and nothing else.** The instruments are the six
painterly views rendered as stills, the `biome` renderer in the Debug map dropdown for the biome layer on
its own, and the running map over the forests of Dalarna at zoom 9.8 — the same ground 0006 measured on,
so that the numbers compare directly.

**For the hypothesis about the budget, the generator's own report and the Scenery section.** The
generator integrates the expected points to the square unit over each view before it writes anything and
prints them against 0.44. The panel then says what actually happened: points kept, on screen, cells cut,
and the worst frame gap while the map is moving.

**And the check that 0006 says matters most: sweep from zoom 6 to zoom 10, not just 10.** The cost is
dominated by how many cells the view spans, which is worst far out. The number that would refute the
whole approach is `points kept` at zoom 6.5, where 0006 measured 42,087 held to draw 410.

## Observations

**2026-09-21, the ground was measured rather than guessed.** Counting the master's own pixels and
integrating them over the Mercator square: **159 million square world units grow anything**. At 0006's
ceiling that is seventy million pieces of scenery, and even at a quarter of it seventeen million. That
number is what decided the sprite map holds stands rather than stems, and it is in decision record 0053.

**2026-09-21, the generator.** Twenty-five seconds a master on Adam's machine, for all three:

| master | stands | chunks | on disk | worst biome |
| --- | --- | --- | --- | --- |
| terrain | 598,572 | 3,900 | 5.0 MB | tropical, 0.210 a unit² |
| terrain2 | 612,856 | 3,985 | 5.1 MB | northern-woods, 0.200 a unit² |
| terrain3 | 612,733 | 3,988 | 5.1 MB | northern-woods, 0.199 a unit² |

Every biome comes in under the 0.44 ceiling with room to spare, and the biome raster is 102 kB.

**2026-09-21, a flat disc is not a wood.** The first stands were flat: every point inside one equally
likely. It drew a carpet with a favourite species rather than a wood, which is the same fault 0006 had
with an extra step. Replaced with a kernel that falls off as `1 - t²` and **adds** where stands overlap,
which is the Neyman-Scott intensity function written out, and the reaches were more than halved so that
a screenful holds ten to twenty stands rather than two or three. That is the change that made it read.

**2026-09-21, in the running program, over the forests of Dalarna.** The same ground 0006 measured on.
At zoom 10, `boreal-dense` under the camera: 867 drawn of 867 held, 7 cells on screen, 428 stands in two
chunks, **frame gap 6.3 ms and worst 22.8 ms while moving**. Visibly a stand of spruce with birch
thinning out around it, rather than an even speckle.

**2026-09-21, the bound 0006 said would bite.** At zoom 6.5, where 0006 measured its worst case of
42,087 particles held to draw 410, this holds **9,060 to draw 323** - about a fifth of the waste for the
same picture. Two things did it: the generated density is lower than 0006's untuned default, and a
kind's `order` now leans its rank, so the big things are the ones made first.

**2026-09-21, three bugs the checks caught rather than the eye.** A biome edge that stepped at the
antimeridian, because the wander's cell size did not divide the world exactly. A kind too short ever to
be drawn whole at the closest the camera comes - heather at half a world unit, when ten sixteenths is
the floor - caught by a test that had to reach across a package boundary to know it. And `dominant ===
NO_FAVOURITE` doing double duty for "no favourite kind" and "not in a stand", which would have kept
every gathering kind out of exactly the place it belongs.

**2026-09-21, Adam's first look, and four things wrong with it.** *"its ok, but a bit laggy"*, half as
many wanted, twice as big, and a lag spike on zooming out from close in - *"it feels unnecessary since
the sprites aren't even visible there"*. And the fade: *"I thought we established that sprite crossfade
should be triggered at a zoom level and then be executed during a short time period rather than fade
based on zoom level"*. He was right and it was already written down, in `twoForms.ts`, for marks.

Fixing the fade fixed the lag, because they are the same fault seen twice. The zoom now decides whether
a **group** - one kind at one step of its arrival - belongs on the screen, and `PRESENCE_MS` carries it
there; and a particle is only made once its group has arrived. So the invisible furniture that used to
be built on the way out is not built at all:

| over Dalarna | particles held | cells cut | before |
| --- | --- | --- | --- |
| zoom 10 | 603 | 11 | 867 |
| zoom 8.5 | 2,778 | 43 | - |
| zoom 7.6 | 4 | 84 | thousands |
| zoom 7 | **0** | **0** | thousands |

Proved rather than asserted: jumping the camera a whole zoom level in one step leaves 27 groups at alpha
**0.484** one frame later, and settled three frames after that. Under the old rule they would have
snapped to whatever the zoom said and stayed there.

Two smaller things came out of the same pass. Doubling the sizes first made everything arrive a zoom
level *further out*, which is both the wrong look and the expensive one; `READABLE` moved from ten
screen pixels to twenty with them, so a kind arrives exactly where it used to and is twice the size when
it does. And `most` - the cap on a single point - turned out to be the density the browser cuts its grid
at, so a round number above what the file reaches was grid points hashed and thrown away on every cell,
for ever. It is now tied to the thickest stand, with a test either side of it.

## Result

**Confirmed on the machine and on the numbers; the look is Adam's to judge.** The arrangement is
clustered rather than even, it is inside the budget by a factor of two, and the waste far out is a fifth
of what it was. What cannot be settled from here is whether sixteen crude shapes in fifteen biomes
*look* like a world, because that is an eye and not a measurement.

The surprise was which change mattered. The biomes were the expensive part to build and the stands were
the cheap one, and it is the stands - specifically the kernel, six lines - that made the difference
between a carpet and a wood.

## Decision

**Keep.** The mechanism is decision record 0053, which extends 0052 rather than replacing it. It adds
`Biome`, `Stand`, `Sprite map` and `Kind` to `GLOSSARY.md`, a third command to `AUTHORING-THE-WORLD.md`
and to `debug-quick-start.ps1`, and replaces the Scenery section of the debug panel with the generator's
own readings.

## Follow-ups

- **The look, which is the open half.** Sixteen shapes and fifteen biomes. Once tuned against Adam's
  eye: half as thick, twice as big, and lone trees made rare. `world/biomes.json` is where that goes.
- **A `biome` renderer** in the Debug map dropdown, to review the biome layer on its own rather than
  through the scenery standing on it. Named in the plan and not built.
- **A generate button** beside `cut it`, so a repainted master can be refurnished without a terminal.
- **Offline stills**, so a change to the generator can be argued from a picture rather than from a
  running browser. The painterly views already exist to reuse.
- **The far end of the handoff**, still: 0051 says the painted terrain is scenery's far-out form and it
  is not, because the canopy treatment is a constant 3.2 screen pixels in brush space. Named in 0052,
  named in 0006, and still one number through `preparePainterly`.
