# 0008. A tilted camera

- Status: open
- Started: 2026-09-23
- Closed:

## Hypothesis

MapLibre can draw this world in a true isometric or dimetric projection, and the marks, the scatter and
the pointing can follow it, without replacing the renderer or re-cutting anything.

The second half, which is the one that matters: doing so makes a world worth looking at.

## Setup

A **Camera** section in the debug panel, holding three sliders - how far the camera has tipped, which way
is up, how wide it sees - and three presets, one for each of isometric, dimetric and trimetric. Default flat and north-up, so a player's map is untouched and
decision record 0014 still describes what anybody playing gets.

The unlock is five lines in `map/MapView.tsx`: `maxPitch` from 0 to 85, and `dragRotate` disabled
explicitly rather than in the constructor. Nothing in the codebase asserted those five lines.

The projection is `sprites/cameraMath.ts::toScreen`, which had no pitch or bearing term at all.

Deliberately not built: anything to do with the desk, the painterly worker, or standing the scenery up.
See *Observations*, which is where they earn their place.

## What we will look at

The projection is arithmetic and is checked as arithmetic: a square of ground, projected, measured.
The look is checked by Adam pulling the slider, because nothing else can check it.

## Observations

### The projection is exact, and is three public calls

MapLibre 6.6 has `setVerticalFieldOfView`, clamped in `Transform.setFov` to `[0.1, 150]` degrees. A
camera's distance from what it looks at is `0.5 / tan(fov / 2) * height`, so closing the field of view
pushes it back: at a tenth of a degree it stands about 573 screen-heights away, and near and far are the
same distance to within a rounding error. That is a parallel projection, and a parallel projection of a
tilted plane is what every isometric game has ever drawn.

Measured before any code was written, by driving another worktree's running map from the browser console:

| camera | a square of ground projects as | convergence across a 244 px edge |
| --- | --- | --- |
| `pitch 60, bearing 45, fov 0.1` | **2.0005 : 1** | 0.042 px |
| `pitch 54.7356, bearing 45, fov 0.1` | **1.7325 : 1** (= √3) | 0.046 px |

The first is the two-to-one of every isometric tile ever cut, and it falls at sixty degrees because the
cosine of sixty is exactly a half. The second is true isometric, all three axes foreshortened equally.
**Both are inside MapLibre's own default pitch ceiling of 60**, so nothing had to be forced; the ceiling
was raised to 85 only so the lever can be pushed past the angles worth looking at.

`map.unproject` round-trips to 1e-10 degrees at sixty degrees of tilt, so pointing at the ground is exact
and every input path that goes through it - clicking a place, dragging an area - was correct before this
experiment started and is untouched by it.

### The overlay was the work, and it stayed affine

`toScreen` was 20 px wrong for a point near the middle of the screen at pitch 60, and worse toward the
edges, because it re-derives the projection rather than asking the map. Marks, the selection ring and the
desk all go through it.

The fix is small for one reason worth writing down: **an orthographic camera has no perspective divide**,
so the projection stays affine. `toScreen` gained a turn and a squash - four multiplies - and is still a
pure function, still exact, and still testable without a browser. A perspective camera would have needed
the map's own matrix handed across the renderer seam and a divide per sprite.

#### How narrow the field of view actually has to be

This was the surprise of the build, and it moved a number. Parallelism was measured first as one edge
against its opposite - 0.042 px of convergence at a tenth of a degree - which is a differential and
flattered it. What is felt is the absolute disagreement between where the map draws a piece of ground
and where the overlay draws a mark standing on it, taken over the whole screen at sixty degrees of tilt:

| field of view | worst disagreement anywhere on screen |
| --- | --- |
| 36.9° (MapLibre's default) | 864 px |
| 5° | 52 px |
| 2° | 20 px |
| 1° | 9.7 px |
| 0.1° (the clamp) | **0.96 px** |

It is a straight line: **about ten pixels for every degree**. The first cut of the preset used one
degree, on the theory that a degree is parallel enough to the eye and kinder to the depth buffer, and it
would have shipped a ten-pixel error - half the twenty this step exists to remove. The presets go to the
clamp. The slider steps by ratio rather than by degrees, because everything worth looking at is in the
bottom tenth of the range.

The limitation this exposes is real and worth naming: **the overlay's projection is the parallel limit,
not the camera**. Tilted with a wide field of view the map is right and the marks are not, by as much as
several hundred pixels. That is out of scope here - the experiment is about the parallel case - but
anything that wanted a tilted perspective camera would have to take MapLibre's own matrix across the
renderer seam, which is what 0014 anticipated.

Two things then came free that were expected to cost:

- **Hit testing needed no change at all.** It reads the screen-space box the sprite was actually drawn
  in, so a correct `toScreen` makes a correct click.
- **The marks already stand up.** The overlay is a separate canvas that knows nothing of the tilt, so
  every mark is a billboard, and they already anchor at the foot (0051). That is the isometric
  convention, arrived at for other reasons.

### All three names, and the ceiling that turned up with the third

The three names count how many of the three axes are drawn the same length: all three for isometric, two
for dimetric, none for trimetric. On a map the turn decides it. At forty-five degrees the two ground axes
are equal by symmetry and a square of ground reads as an even diamond; at any other turn they differ and
it reads as a lopsided one. So trimetric needed no new arithmetic at all - it is what the sliders already
did anywhere off forty-five - and the third button only names an angle worth pressing.

Reaching for one exposed a hard limit that dimetric had hidden. The first trimetric preset tilted to
63.435 degrees, and **the map drew nothing**: one flat colour, whole screen, on every renderer. Bisected
by looking, the boundary is exact:

| tilt, at a parallel field of view | what the map draws |
| --- | --- |
| 60° | the world |
| 61° | one flat colour |

Sixty is MapLibre's own default pitch ceiling, and that is not a coincidence. How it decides which tiles
a tilted view needs raises a cosine to a power worked out from the field of view -
`pitchTileLoadingBehavior` in its covering-tiles code - and that calculation is tuned against a normal
field of view. At 36.9 degrees the exponent is about minus one; at a tenth of a degree it is about
thirty, so past sixty degrees of tilt it asks for no detail anywhere and the screen is one stretched
tile.

**The envelope is therefore a tilt of sixty degrees and no more, and sixty is exactly the dimetric
angle**, so everything this section is for fits underneath it. The tilt slider stops there and says why.
Trimetric keeps the dimetric tilt and differs only in the turn, which is the better comparison anyway.
A steeper tilt is still available with a field of view wide enough to have a horizon; it is the pairing
of a steep tilt with a parallel camera that MapLibre will not draw.

### Why `raw` looks soft and `vivid` looks sharp - and it is not sharpness

Asked while looking at the tilted world. The first answer here was wrong and is worth keeping wrong on
the page, because the mistake is an easy one and the correction is the useful part.

**The first answer**: the flat tiles stop at zoom 7, so past that MapLibre stretches a z7 tile eight times
over and the ground goes soft, while a painted renderer asks for a tile at the zoom being looked at and
draws hard cells. Three things seemed to support it - the tile PNG is clean, with five flat colours across
a row and runs as short as one pixel; `raster-resampling` is already `nearest` and setting it again
changes nothing; and `raw` looks sharp at z7 and soft above it.

**What settled it**: a new style, `plate`, drawing the same `render.json` colours through the painted
path. If the first answer were right it would be visibly sharper than `raw` at z10. It is
indistinguishable. Then the test that should have been run first - setting the flat layer to `linear` and
back - and the two are plainly different pictures: `nearest` gives a hard eight-pixel staircase, `linear`
gives the smeared gradient that "blurry" actually looks like. **`nearest` works. `raw` is not blurred.**

The real answer is that **raw and vivid differ by colour, not by resolution**. Both draw a master pixel as
a hard 8 px block at z10, because the terrain data itself stops at z7 and no amount of painting invents
more of it. `render.json` is chosen so the classes sit together - quiet, close in value - and adjacent
quiet colours read as a soft edge. `palette.json` at a vibrance of 1.35 holds the classes far apart, and
the identical blocks read as razor sharp. The eye was reporting contrast and calling it focus.

Which makes the lever for "raw, but with vivid's snap" **vibrance, not the rendering path**. `plate` is
now exactly that: `render.json`'s colours with vivid's 1.35 push and none of the medium, so the only
thing left between the two styles is which table the colour comes from. Pull its vibrance to 1 and it is
raw exactly.

It is still worth having on the painted path for a second reason: everything on that path gets the
lattice and survives the tilt, and drops the vector coast ink that `raw` draws over itself.

The consequence that survived the correction: **the painter draws the cells, so the painter decides what
shape a cell is.** Anything that wanted the ground drawn on a lattice other than the square one - a diamond
lattice, say, with north still up - belongs there or in the tiler, and not in the camera and not in the
hand-painted master.

### The other turn: a lattice that is not the camera's

The camera can only turn the pixels and the world together, so there is no camera that gives diamond
cells with north still up. That is not a camera question at all - it is a question of which grid the
colour is read on, and the grid the terrain is *stored* on need not be the grid it is *drawn* on.

It went in where the answer above said it would: the painter reads terrain through one `ClassSampler`,
so `onLattice` wraps that sampler and snaps every read to the middle of a turned cell. Because the wander,
the nine neighbour reads and the shore test all go through the same sampler, **the cell edges and the ink
outlines follow the new cells for free** rather than having to be drawn a second time. Turned 45 degrees
the cells are diamonds and the world has not moved: north is up, every coastline is where it was.

Two things had to come with it. A cell bigger than a pixel needs a longer reach, or all nine reads land
inside the same cell, no boundary is ever found, and the ground comes out as flat colour with no edge and
no shore; just over half a cell is the shortest reach that always crosses. And the lattice is in the tile
address, `painterly://<style>/<turn>/<size>/{z}/{x}/{y}`, so turning it is a different URL and nothing
painted on the old lattice is handed back.

What it looks like, at 45 degrees and four world units to a cell:

- **Flat camera:** diamonds on a map that is still a map. North up, every coastline where it was.
- **Tilted to sixty with the camera pointing north:** the cells become **2:1 diamonds** - the exact shape
  every isometric game has ever cut a tile at - while north stays straight up. This is the thing the
  camera alone could not do, and it is the answer to the question that started it.

**The treatment fights it, and that is the finding.** On `vivid`, which is the terrain with the medium
turned off, the diamonds are crisp and unmistakable. On `painted` they nearly vanish: the style's
boundary wander perturbs the read before it lands, and at a wander of the same order as a cell it chews
the diamond edges into something soft and organic. So the lattice and the medium are two treatments of
the same boundary competing for it. Whether that is a fault or the nicest thing here is Adam's eye - the
lever is a slider precisely so that the wander and the cell size can be set against each other.

Nothing offline changed: at a turn of nothing and a cell of one the wrapper is the identity and returns
the sampler it was given, so every still in `world/painterly/` is the same file it was.

### What does not follow the camera, and why each one is a finding

- **The desk lies flat while the world is tilted.** `desk/Desk.tsx` positions the sheet as an
  axis-aligned CSS square and `map/sheet.ts::constrainCamera` clamps an axis-aligned rectangle against
  the window. Pulled back at sixty degrees the parchment sits square in the corner behind a tilted map.
  Fixing it means reopening 0033, which is a decision and not a slider.
- **Every brush mark becomes a 2:1 ellipse.** 0030 chose Mercator because it is conformal - "a brush mark
  that is round on the ground there is also round on the screen... For a treatment, round wins." A tilt
  ends that. The mitigating surprise: because the camera is orthographic the squash is **the same
  everywhere on the screen** rather than varying from the bottom of the frame to a horizon, so it is one
  anisotropy in the painterly worker rather than a rewrite of brush space.
- **The scenery lies down.** 0052 places the scatter with one matrix and no per-particle anything, and an
  affine folds into that matrix for free, so the trees stay registered with the ground they were
  scattered from. What one matrix cannot do is place a tree *and* stand it up. There is also no depth
  sorting. Standing them up is the per-particle work the static vertex buffer exists to avoid.
- **The cell walk had to be widened.** Tilted, the ground under the window is a turned rectangle
  stretched along the lean, and the axis-aligned box that used to be the window's own corners left the
  far corners bare. The four corners are now carried back through the projection, which is exact at any
  angle and is the old arithmetic exactly when the camera is flat.

### The cost is bounded, which perspective would not have been

An orthographic tilt at sixty degrees covers exactly twice the ground area, because that is what a
half-cosine means. Measured on the running program at z9.8, the scenery's own count of cells on screen
went from **25 flat to 49 tilted** - 1.96 times, which is the prediction to the width of a cell. Twice
the painted tiles and twice the scenery cells, and no more: there is no horizon,
so nothing is pulled in from the distance. A perspective tilt has no such bound, and experiment 0006
found the scatter's cost tracks cells in view rather than particles on screen - so the orthographic
camera is on the kind side of the one axis that was known to hurt.

## Result

The first half of the hypothesis is **confirmed, and more cheaply than expected**: the projection is
exact to four decimal places, it is three public MapLibre calls plus four multiplies in one pure
function, and input, hit testing and the upright marks all came free.

Verified on the running program rather than only in tests: with the mark pushed out toward a corner of
the screen, its foot stands on its own ground to within **0.2 px** dimetric and 0.22 px isometric, where
before the change it was 20 px wrong in the middle of the screen and worse outward.

The second half is Adam's, and is not answered here.

## Decision

Pending. Nothing is decided by this commit: 0014 stands as written, and it was always provisional -
"worth revisiting once the sprite path is proven. Enabling any of the three means the sync must handle a
full camera transform, and the renderer interface is where that change lands." That is what happened, and
it landed where 0014 said it would.

## Follow-ups

The findings above are the menu, and none of them is small:

- **The desk, and what the world lies on.** A tilted world is not a sheet on a desk, and the workbench on
  the roadmap is built on the desk. This is the fiction question, not the rendering one.
- **Brush space under an anisotropy.** One factor in the painterly worker, if the look survives it.
- **Standing the scenery up**, which is a different scenery layer.
- **The thing no camera fixes.** 0051: the world is 1.2 km to a world unit and a surveyed castle is 1.4
  pixels at the closest the camera comes, and 0051 refuses to draw it larger and call it a measurement.
  An isometric game is a game about looking at buildings. **There is no zoom in this world at which a
  building has anything to stand on**, and that is a fact about the world rather than about the camera.
  Anything that changes it is the world-generator's, not this experiment's.
