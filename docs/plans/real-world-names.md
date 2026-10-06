# Real names on the edited world

**What belongs here:** how the names Earth had in 1790 - its rivers, lakes, seas, regions and towns - get
onto a master Adam has cut up and moved about, and the order it gets built in. **What does not:** why the
world is a warped Earth (decision record 0017) or authored as an image (0018); what the world is as fiction
(`SETTING.md`); how the master is painted (`AUTHORING-THE-WORLD.md`); settlements inferred from the terrain,
which stay in `world-generator.md`; and the events and history that will one day stand on these names,
which get a plan of their own. When a part of this is decided, that part becomes a decision record and
leaves.

---

## The problem, in one paragraph

The world opened on the first of January, 1790 (`SETTING.md`), and its land began as Earth's. Adam wants
the rivers and places of that land to carry the names they had in 1790, and later the history that
happened there. But the master is not Earth any more: he moves landmasses, turns them, warps them, removes
some, and adds land that never existed - a long incision through India, opened out at one end and filled
with new ground. Nothing records any of that. The merge tool compares pixels at the same position, so to
it a moved landmass is a deletion and an addition. A name taken from Earth and dropped at Earth's
coordinates lands in the sea, or on the wrong country. And invented land has no Earth to take a name from
at all, and must never be handed real history that belongs to somewhere else.

## The answer, in one paragraph

Two halves, which meet at Earth's own coordinates. An **origin map**, worked out by a tool, says for every
spot on a master the point on Earth it was cut from, or that it is **invented land**. A **1790 gazetteer**
lists Earth's named rivers, lakes, seas, regions and towns under their names of 1790, each at its real
coordinates. A name reaches the game by going through the origin map. Land Adam removed takes its names
with it; land he invented gets names made up in the manner of its neighbours and is marked as invented, so
that no real event is ever pinned to it. He keeps painting the way he does now, and the origin map is
worked out again after each edit, like the tiles.

## The origin map

### Why it can be worked out from the edits alone

`world/master/terrain-base.png` is plain Earth: a pixel at (x, y) is exactly a real longitude and
latitude, by the same `toPixel` and `toLngLat` the pipeline already uses. Adam edits with Nearest
Neighbour interpolation (`AUTHORING-THE-WORLD.md`), so land he moves keeps its exact pixels, and at 1.2
kilometres a pixel the pattern of thirty-two terrain classes is a fingerprint.

Measured on 2026-10-06 against `terrain3_mended_2026-10-03.png`: a 48-pixel square of plain Earth,
searched for in the edited master by moving it only, with no turning or stretching.

| place | pixels that agree, best match | where it went | pixels that agree, not moved |
| --- | --- | --- | --- |
| Ganges plain | 95% | 3.6° south, the incision | 11% |
| Borneo | 85% | 4.9° west, 7.7° north | 13% |
| England | 84% | 2.7° east, 1.4° north | 15% |
| Småland | 67% | 2.5° west, 1.7° north | 0% |
| Sri Lanka | 50% | 4.8° west, 5.1° north | 0% |

Sri Lanka is the weakest, and is probably turned as well as moved, which that test did not try.

### How the tool works

`npm run world:origin --prefix frontend`, one master at a time, a few minutes a master like the tiling.

1. Cut the master's land into squares of about 32 pixels, 40 kilometres.
2. For each, find where on plain Earth the same pattern sits, allowing for a move, a turn and a stretch.
   Searching scores a placement by the share of pixels that agree beyond chance; deciding allows each pixel
   its class within a pixel either way, against how well the same placement does ten pixels off. The first
   run judged exactly and called Borneo's rainforest invented: a turn half a pixel out misses every river a
   pixel wide, and the mending made some rivers two wide.
3. Let neighbours help. Every square is tried where it is first, because most land never moved; a square
   that is found lends its placement to the squares beside it, because land is moved in pieces; and only a
   square nothing has reached looks its small lakes up among Earth's, four at a time by the shape they make
   (`originQuads.ts`), which finds a piece wherever it went. That is what makes 537 megapixels a matter of
   minutes: on `terrain3_mended_2026-10-03`, a hundred seconds, of which 2,485 squares needed looking up.
4. A square with no good match is **invented land**: the new ground in India's incision, or anything
   painted by hand rather than moved.
5. A square that matches a place a larger piece already claims is a clone, from a paste or the Clone
   Stamp. It is invented land that only looks like somewhere. **Every real place lands in the world at
   most once.**
6. Open sea has no fingerprint, so a sea is never matched itself. Its name comes from the coasts around it.

What it writes, beside the tiles in `public/world/masters/<name>/origin/`:

- for every square, the Earth point it came from, how sure the match is, and which moved piece it belongs
  to;
- the way back, from an Earth point to the place in the world it went to, which is what places a town;
- every invented region, with its area, where it is and which real land it borders.

### Correcting it

`world/origin/<name>-pins.json`, checked in, holds what the tool got wrong, and either Adam or an agent
may add to it. A pin says either that a spot is really a given Earth point - "this is Kiev" - or that an
area is invented whatever it resembles. Pins win over the tool.

### Seeing it

- The **Origin** renderer in the Debug map: the master with each moved piece in a colour for the way it went,
  invented land magenta and striped, copies orange, and Earth's own coastlines carried through and drawn thin
  and white on top. Where they lie on the painted coast, the fit is right; where they do not, it is plain.
- The numbers, printed by the tool and said in the log when the renderer is chosen: how much land is from
  Earth, invented and copied.
- A click on the map, with the renderer showing, says in the log where that place came from: an Earth
  latitude and longitude, how far it moved and how sure, or "invented land" (decision record 0023).

### The alternative not taken

A hidden layer in the image editor whose colours are Earth coordinates, transformed together with the
terrain, would be exact and would need no matching. It is not the first choice because Liquify, Puppet
Warp and the Clone Stamp each act on a single layer, and `terrain3` already exists without one. It stays
available as a shortcut for future edits if the matching ever struggles.

## The 1790 gazetteer

### Where the names come from

| what | source | on disk | licence |
| --- | --- | --- | --- |
| the large rivers and lakes | Natural Earth: 1,073 named river lines, 728 named lakes, each with a Wikidata id | yes | public domain |
| every other river | HydroRIVERS for which reach joins which and how big it is; Wikidata for its name, matched by its mouth and by the river it flows into | HydroRIVERS yes | CC-BY, CC0 |
| smaller lakes | HydroLAKES, whose `Lake_name` is read by nothing today | yes | CC-BY |
| seas, gulfs, ranges, deserts | Natural Earth's marine and geographic regions | no | public domain |
| peaks | Natural Earth: 640 named peaks | yes | public domain |
| towns that stood in 1790 | Wikidata for coordinates, founding dates and names with the years they were in use; the historical city populations of Reba and others (2016) for which towns mattered around 1800; GeoNames for historical alternative names | no | CC0, CC-BY; each confirmed before it is fetched |
| who held what in 1790 | open historical border maps for 1783 and 1800 | no | to be checked; later |

New sources join the list in `frontend/packages/world/bin/lib/worldSources.ts`, so `world:fetch-all` fills
them from nothing like the rest. The credits owed are added to `AUTHORING-THE-WORLD.md` in the same commit.

### The name of 1790

Every entry is keyed by its real-world identity, a Wikidata id or a HydroRIVERS river, so its name does
not change when Adam repaints. Its 1790 form is chosen in three layers:

1. **A name the data dates.** Where the data says a name was in use in 1790, it wins: Königsberg,
   Christiania, Constantinople.
2. **Otherwise the modern local name.** Rivers and villages mostly kept theirs.
3. **A review, region by region.** An agent goes over the list and writes corrections into
   `world/names/1790.json`, checked in, each with a line saying why. Adam overrides anything in the same
   file.

### A painted river's name

`world:flow` already traces every river on a master. Each traced river is sent through the origin map, the
real reaches its pixels land on are found, and it takes the name most of them agree on. A real river that
runs on into invented land keeps its name the whole way: a river is one thing.

## Invented land

The origin map lists each invented region with its size and the real land around it. An agent writes names
for its rivers, places and regions in the manner of those neighbours into
`world/names/invented-<name>.json`, checked in, and Adam reviews them: the ground opened up in India is
named the way the coast it grew from would have named it. Everything there carries the mark **invented**.
No real event, figure or backstory is attached to it, ever; whatever it needs later is made up, and says so.

## What it is for, later

The first use is near. The server already reads where a player is looking off the ground map (0084), and
a choice roll takes it as an omen (0083): today that omen is "a river" or "coast". With names beside the
ground map, read through a port the same way, it can be the Vistula, or the coast below Danzig, and a
dialogue can name the place it happens in.

The origin map and the gazetteer are also what real history needs, so they come first. Two layers stand
on them, each with its own plan when Adam chooses it:

- **Before 1790, the backstory of a place.** What happened at a real place before the world opened, shown
  as flavour in the inspect window. Cheap, and nothing to do with the event store.
- **From 1790, the warped history** `SETTING.md` promises: real events, each with a date and an Earth
  place, carried through the origin map and bent. An event whose ground Adam removed has nowhere to
  happen. It needs NPC factions, which are not decided, and a fate engine that rolls the world's history
  as well as a house's choices.

## Where it lives

- **The tools** are `world:origin` and `world:names` in `frontend/packages/world/bin/`, with the logic in
  `src/origin.ts`, unit-tested on small made-up masters. They reuse `toPixel` and `toLngLat` from
  `src/raster.ts` and the river graph from `src/flow.ts`.
- **What they write** is output, regenerated after every change to a master like the tiles, and both join
  the list in `CLAUDE.md` and `debug-quick-start.ps1` when they land: `origin/` and `names.json` beside a
  master's tiles.
- **What is checked in** is what a person decides: the pins, `world/names/1790.json`, and
  `world/names/invented-<name>.json`.
- **The game** could take its seats from real towns of 1790 instead of the invented ones in
  `Gazetteer.kt`, through the data file beside the other world files that decision record 0034
  anticipates, `world/seats.json` in experiment 0004. Adam's call when it comes.
- **The map stays without text** (0017). Names appear first in the debug panel and the inspect window;
  painting them onto the map is a question of the look, and Adam's.

## The order it gets built in

Each its own commit, and the order is a suggestion.

1. **This plan.** Documents only.
2. **The origin map**, as experiment 0016: `world:origin` run on the default master, the Origin renderer,
   the numbers, and a click on the map saying in the log where a place came from. The riskiest assumption,
   so first. **Built 2026-10-06**: 97.8% of the default master's land from Earth, 2.0% invented, 0.2%
   copies. The pins come when something needs correcting.
3. **Rivers, lakes, seas and mountains named**, the whole world over. All their sources but one are already
   on disk. The debug panel names the river under the cursor. **Rivers, lakes and peaks built 2026-10-06**:
   Natural Earth's 1,496 named rivers, 1,998 lakes and 632 peaks carried through the origin map run backwards
   (`originBack.ts`), 16 gone with ground removed or copied, and a click under the Origin renderer names what
   is there. **Seas and lands built the same day**: Natural Earth's marine and region polygons, fetched by
   `world:fetch-all`, give every square of the origin map the named sea and the named stretch of land it is
   in or by (`regions.ts`): 286 seas and 880 lands - ranges, deserts, plateaus, peninsulas, islands. Open sea
   has no square from Earth, so it takes its sea from the nearest coast's placement carried out across the
   water.
4. **The towns of 1790**: fetched, reviewed, and carried through.
5. **Invented land named.**
6. **Seats taken from real towns**, if Adam wants them.

## Open questions

- **Which language.** The suggestion is to keep each place's local name of 1790 as its name - Danzig,
  Wien, Kraków - with the English of 1790 beside it - Dantzick, Vienna, Cracow - and to decide later which
  the player is shown.
- **This partly undoes 0017.** Experiment 0001 found that removing every place name mattered as much as
  moving the coast: real names make the world read as Earth again. The suggestion is to use them as they
  were, since that is what Adam asked for, and amend 0017 when the first name appears. Bending names the
  way the coasts are bent is the other answer.
- **Clones Adam meant.** Without a pin, the larger copy of a cloned region is the real one.
