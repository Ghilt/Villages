# 0008. A tilted camera

- Status: closed
- Started: 2026-09-23
- Closed: 2026-09-25

## Hypothesis

MapLibre can draw this world in a true isometric or dimetric projection, and the marks, the scatter and
the pointing can follow it, without replacing the renderer or re-cutting anything.

The second half, which is the one that matters: doing so makes a world worth looking at.

## Setup

A **Camera** section in the debug panel, holding three sliders - how far the camera has tipped, which way
is up, how wide it sees (since taken away, see *The scenery stands up*) - and three presets, one for each of isometric, dimetric and trimetric. Default flat and north-up, so a player's map is untouched and
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

### What it cost, and the number that was already wrong

Adam felt it before it was measured: panning and zooming out tilted, the map lagged behind. Three things
compound and only one of them is inherent.

**The tilt doubles the ground on screen**, which is the half-cosine again and is not fixable - measured
as 25 to 49 scenery cells. **The lattice costs about a fifth more per tile**, measured offline over five
runs at z10: 51.8 ms a tile on square ground, 61.7 with diamonds four units across. `classAt` runs nine
times a pixel, once for the centre and once for each neighbour that finds an edge, and every one of them
now rotates, floors and rotates back. Together that is about two and a half times the painting.

**And the tile store was already sized too small for it.** Its own comment said a flat screenful and its
ring is about a hundred and seventy tiles, against a cap of two hundred - thirty spare. Tilted, that is
about three hundred and forty, and the thing the number existed to prevent happened: the looking-ahead
evicted what it had just painted. Zooming out was worst because each level needs a fresh set, the
look-ahead only runs after 180 ms of stillness so a fast zoom gets none, and the coarser parents that
would have been kept had already been thrown away.

Raised to **450**. Measured on the running program, one cold trimetric zoom-out from z10 to z4 settles at
**240 tiles held** - above the old cap, so the old cap was binding, and below the new one, so it no longer
throws anything away. The store now says so in the log the first time it does fill, once, because
nothing displayed the counter and a number nobody can see is not an instrument. See decision record 0023.

It helped the pan and not the zoom out, which is what Adam reported, and the reason turned out to be
specific to zooming out.

### Where a zoom out actually goes

A fast zoom out passes through every level between where it starts and where it stops, and MapLibre asks
for a screenful at each one. The painters answer every request, because the abort is only checked after
a tile is painted - deliberately, since on a pan a tile that just left the screen is usually wanted again.
On a zoom out it is not. Measured trimetric, from z10 to z4:

| | what was measured | tiles |
| --- | --- | --- |
| a jump straight to z4 | asked for, which is the screenful | 6 |
| the same zoom through every level | painted, with the looking-ahead held off | 89 |

**About nineteen tiles in twenty that a fast zoom out paints are ones nobody will see**, and the ones on screen
queue behind them. And on the way out the terrain costs more than the paint: below zoom seven every
painted tile brings its own neighbourhood of flat tiles, read and decoded by whichever painter got it -
2642 ms of assembling terrain against 2367 ms of painting, summed across the painters.

### The 512-pixel tile, tried and measured worse

The obvious structural fix was a bigger painted tile: a quarter of the tiles for the same ground, so a
quarter of the per-tile cost. It went in as one constant, `PAINTED_TILE`, with everything that depends on
it derived rather than restated - the store, the ring, the look-ahead bound - so it is an honest A/B by
changing one number. Two things had to be got right for it to be a fair trial. The terrain field
generalises from three flat tiles square to the block a painted tile covers plus a ring, four square
below zoom seven. And the source stops one zoom earlier, because MapLibre asks a raster source for tile
zoom `round(mapZoom + log2(512 / tileSize))`: left at ten, the closest half-zoom would have painted four
times what it did, and a test now pins the resolution to be identical at every zoom.

It made the zoom out worse. The same sequence, the same ground, cold caches:

| painted tile | tiles | terrain ms | paint ms | total |
| --- | --- | --- | --- | --- |
| 256 | 89 | 2642 | 2367 | **5009** |
| 512 | 34 | 3313 | 3512 | **6825** |

A 512-pixel tile is wider than the map area at the window this was measured in, so every view straddles
tile edges and paints a band of ground off the screen. The per-tile saving is real but it is the cheap
kind of cost; overhang is paid in pixels, which are the expensive kind. At a bigger window the overhang
shrinks and so does the loss, but it does not become a gain.

**The finding is that tile size was never the problem on a zoom out: painting what has been abandoned
is.** Nothing about the size of a tile touches that.

### Not painting what has been given up on

So the queue moved to the main thread. MapLibre's requests wait there instead of in a painter's inbox; a
painter is handed the newest when it has room, and holds at most two; and a tile every request has given
up on, which no painter has yet, is taken out and never painted. A tile already under a brush still
finishes and is kept, for the reason the old code gave. MapLibre is answered the moment it gives up,
rather than after a paint it no longer wanted - an answer it had been holding a request open for.

The rules live in `map/paintQueue.ts`, apart from the workers, because they are the part that breaks
quietly: a tile two requests share must survive one of them giving up, and a tile with a painter must
never be dropped. Both are tests, and both were proved by breaking them.

Measured with a harness that drives a real quarter-zoom-a-step zoom out through MapLibre's synchronous
`redraw()`, so it needs no animation frames, at 256 pixels, painting time only because it is one loop and
exact:

| scheduling | tiles painted | given up before painting | paint ms |
| --- | --- | --- | --- |
| the original: everything posted at once, first in first out | 77 | 0 | 1978 |
| newest first, nothing dropped | 70 | 0 | 1743 |
| **newest first, abandoned dropped** - two runs | **39, 56** | **16, 33** | **998, 1393** |

**Somewhere between a third and a half of the painting on a fast zoom out is gone.** The runs vary with
how fast the harness manages to step, and the harness is slower than a hand on a wheel - every redraw
does real work - so the painters catch up between steps more than they would for Adam. A faster zoom piles
up more waiting tiles, and waiting tiles are exactly the ones this drops, so the table understates it.

The 512-pixel tile was tried once more with the new scheduling: 16 painted and 40 dropped, but 1601 ms of
paint against 998 at 256. Fewer tiles, more pixels; the overhang still loses. **The painted tile stays at
256**, with the rest of that change kept because it is correct at either size and tested at both.

### Something rough instead of nothing, and a fade

Adam, once the painting was cheaper: "right now it's just empty and things pop in - even a fade in
would look good". Both halves turned out to be one question about how MapLibre fades, and the first
answer to it was wrong in the same way as the one about `raw`.

**The first answer**: MapLibre already asks for the chain of coarser tiles above any tile it is waiting
for and draws the best one in its place, so paint the coarsest waiting tile first and the placeholders
arrive before the tiles they stand in for. The queue got that rule. Then a probe recorded the zoom of
every tile MapLibre asked for on a zoom out: **nothing coarser than the destination, ever.** Reading its
source again, it walks up to coarser tiles only for a tile whose request has *finished* - its
`wasRequested` means loaded, errored or reloading, not asked for - which is how it fills the hole a failed
tile leaves. For a tile still loading it uses a coarser tile it already has and never fetches one.

And it fades by rules, not by default. A tile fades in over a tile of its own source already loaded
above or below it, or on its own when it lies on the outer edge of the view. A tile landing anywhere else
with nothing of its own under it is drawn at full strength at once. On a zoom out to somewhere new that
is most of the screen - which is the pop.

**What went in**: a coarse copy of the painted ground, drawn underneath it. It is a second source serving
the same painted tiles from the same store under the same addresses, declaring them four times wider
than they are - and since MapLibre chooses the zoom to ask for from the tile size, that alone makes it
ask two zooms coarser than the sharp layer at every zoom. A sixteenth of the tiles, painted first
because the queue now paints the coarsest first, stretched under the sharp ones. It has so few tiles
that nearly all of them are on the view's edge, so they fade in; the fade is 150 ms on both layers,
against MapLibre's 300.

Measured on the stepped zoom out, the share of the screen covered by any loaded tile at each moment
after the zoom lands:

| | 0 ms | 50 ms | 100 ms |
| --- | --- | --- | --- |
| without the coarse copy | 70% | 93% | 100% |
| **with it** | **100%** | 100% | 100% |

The frame taken off the canvas at the instant the zoom lands shows what the 70% was: the lower third bare
background behind a jagged edge, a continent missing, where with the coarse copy it is all there. The
harness steps more slowly than a hand on a wheel, so the painters catch up in between; a real fast zoom
leaves more of the screen bare and for longer without it, and none with it. It costs about three per cent
more painting - 143 tiles and 3526 ms against 139 and 3409 - because a coarse tile is mostly one the
looking-ahead was painting anyway.

What it does not do is fade a sharp tile in over the coarse copy: they are two sources, and MapLibre
fades only within one. So a sharp tile arriving somewhere new still arrives at once - but over a blurred
copy of itself, which reads as the ground coming into focus rather than appearing. Everywhere the sharp
layer has a tile of its own to fade from, which is a zoom in, a pan, and the part of a zoom out that was
already on screen, it fades.

### What is inherent

Adam went to MapLibre's own site to see whether its maps do this too, and found the same behaviour, much
less of it. That is the right reading. MapLibre asks for every level on the way out whatever the source;
its demos just draw tiles that were *downloaded*, which cost a fetch and an upload, a few milliseconds.
Ours are *computed* - 25 to 100 ms of painting each, and on the way out as much again assembling terrain -
so the same behaviour costs ten to fifty times as much. And a download that is aborted stops downloading,
which is the thing this change gives the painters. What remains is what painting in the browser costs.

Found on the way, and not changed: **the closest half-zoom has always been painted at half resolution.**
At 256 the painted source's ceiling of ten was hit from map zoom 9.5 onward, so those tiles were drawn from
half as many pixels and stretched. Lifting it is sharper at the closest zoom and four times the painting
there, which was the wrong direction for this step.

The painters now say how long they spend, split into terrain and paint, in `window.villagesPainterly()`.

### The scenery stands up, and is drawn farthest first

2026-09-25, once the first real picture was on the map. Adam, tipping the camera: the tree *"gets
stretched along with the world"*, where *"the thing we are chasing here is to tip the world, and then these
trees pop out along another axis than the ground."* And in the same look, the order was wrong: an oak
standing in front of one it should have been behind, and the reverse, depending on nothing visible.

Both had one cause, which is the one matrix above. **The turn and the tip moved out of the layer and into
every foot.** Each particle's position is stored already turned and squashed, in world units, so its foot
lands on its tipped ground; the layer itself is only ever scaled and shifted, so the picture on the foot is
never squashed with it. Zooming and panning still cost one matrix and touch no particle. Turning or tipping
rewrites every foot once, which is rare - a few thousand numbers a frame while the slider is dragged, and
nothing after. `standingLayer` in `sprites/cameraMath.ts` is the arithmetic.

**Depth is where the foot lands.** The whole layer is sorted by it, farthest first, whenever a particle
arrives or the camera turns: one sort and one upload, only on those frames. The order had been whatever
order the cells and the groups arrived in, which the flat code-drawn silhouettes hid and a picture drawn in
perspective does not. Ties go to the one further left, so the same feet always make the same picture: an
unstable sort would swap two trees at one depth from frame to frame, and read as a flicker.

The design was chosen to close off the glitch hunts rather than to be short, and each of them is shut by
something that can be checked:

- **One projection.** The marks, the scenery and the walk over the cells in view each had their own copy of
  the turn and the squash. They now share `groundTilt`, `tiltGround` and `untiltGround`, and a test holds a
  foot placed by the scenery to where `toScreen` puts a castle's foot on the same place, to a millionth of
  a pixel, at six cameras and three zooms. Broken on purpose once, it fails.
- **No lens that the overlay is wrong for.** The field of view slider is gone. Tipped, the camera is
  parallel, always; flat, it is MapLibre's own, which looks the same straight down. The one combination
  that slid every tree hundreds of pixels off its ground - a tip with a wide lens, measured above - can no
  longer be reached. `lensOf` in `debug/camera.ts`.
- **One place a foot is placed**, for a new particle and for every particle when the camera turns.
- **An instrument for the order.** `window.villagesScenery()` says `ordered`, whether the layer is sorted
  farthest first right now. It was true at flat, at 45 north-up and at 60 turned 70, panning across cells
  arriving and leaving.

**Found on the way: patches of ground that never sprouted.** Every look this session had a band of the
view with no scenery in it, flat or tipped, and the panel said *13 waiting on the ground* for ever. A
cell asks for its tile's stands, and a tile holds sixty-four cells; when two cells asked while the chunk
was still coming, only the first was told it had come, and the second stayed *not yet* for good. Now every
caller waiting on a chunk is told, with a test that fails without it. Over the Alps at z9.8 the same view
went from 615 trees and 13 cells waiting to 1,331 and none. It was older than the tilt, but a tipped view
cuts more cells at once and would have made it worse.

Two things are deliberate and are not faults. **A tree keeps its full height tipped**: a true camera would
draw it at the sine of the pitch, 71% at 45 degrees, and keeping it whole is what makes it stand out of the
ground rather than lie on it, as the marks already do. **The marks are still a layer above the scenery**, so
a castle behind a tree is drawn in front of it. Game pieces stay readable; mixing them into the scenery's
depth is its own question.

## Result

The first half of the hypothesis is **confirmed, and more cheaply than expected**: the projection is
exact to four decimal places, it is three public MapLibre calls plus four multiplies in one pure
function, and input, hit testing and the upright marks all came free.

Verified on the running program rather than only in tests: with the mark pushed out toward a corner of
the screen, its foot stands on its own ground to within **0.2 px** dimetric and 0.22 px isometric, where
before the change it was 20 px wrong in the middle of the screen and worse outward.

The second half is Adam's, and is not answered here.

## Decision

**Keep, and make it the player's.** Adam looked, pulled the sliders, and chose: tipped back forty-five
degrees, north-up, parallel, with the ground read on a lattice turned twenty-six degrees as diamonds.
Decision record 0060, which supersedes the flat half of 0014 - "worth revisiting once the sprite path is
proven. Enabling any of the three means the sync must handle a full camera transform, and the renderer
interface is where that change lands." That is what happened, and it landed where 0014 said it would.

North-up turned out to be the choice that made the desk cheap. Tipped north-up, what lies flat is only
squashed in height, so the sheet, the desk and the room keep all of 0033's arithmetic, worked out in a
window taller by one over the cosine and squashed as they are drawn: the parchment lies on its own tiles
to 0.04 px at the floor, and the world's top edge stays on the window's top edge at the northern limit.

## Follow-ups

The findings above are the menu, and none of them is small:

- **The desk, and what the world lies on.** A tilted world is not a sheet on a desk, and the workbench on
  the roadmap is built on the desk. This is the fiction question, not the rendering one. The rendering
  half is done for a north-up camera (0060): the desk and the room are foreshortened with the world.
- **Brush space under an anisotropy.** One factor in the painterly worker, if the look survives it.
- ~~**Standing the scenery up**~~, done 2026-09-25 without a different layer: the tip went into the feet
  and out of the matrix. See *The scenery stands up* above.
- **The thing no camera fixes.** 0051: the world is 1.2 km to a world unit and a surveyed castle is 1.4
  pixels at the closest the camera comes, and 0051 refuses to draw it larger and call it a measurement.
  An isometric game is a game about looking at buildings. **There is no zoom in this world at which a
  building has anything to stand on**, and that is a fact about the world rather than about the camera.
  Anything that changes it is the world-generator's, not this experiment's.
