# 0117. A settlement is a cluster of structures with a name, raised building by building

- Status: accepted
- Date: 2026-10-21
- Plan: `docs/plans/houses-bridges-and-road-render.md`
- Supersedes 0114 in two parts, a settlement being a structure and the page laying out its buildings; 0114's sites, its
  bake and its opening stand

## Context

The first settlements, of 0114, were each one structure, its buildings laid out by the page around it, so a click on
any of them selected the village. Adam, looking at them on 2026-10-21: *"All buildings should be normal structures. So
they are all clickable. Define an area radius every village -> every structure inside that village becomes part of the
village, and for now that just means that they have a link in their inspect window that links to the village as a
whole."* He liked the house, and wanted villages of many houses and some of the other buildings.

Asked what the village itself then is, a structure of its own or only a named area, he chose the area: *"a settlement is
these clusters of structures"*, something in the world that the inspect window shows, with no word or pane of its own
for that. Asked which buildings, houses and the catalogue's own: a mill, a market.

## Decision

**A settlement is a cluster of ordinary structures with a name and a radius; nothing is raised for the settlement
itself.**

- **The bake writes the settlement**: its middle, a radius by level from `world/settlements.json`, its kind (a village or
  a fishing village), its level and its name, in the sites file of 0114, which stays a contract the server reads.
- **Its buildings are structures**, and the bake lays them out: `settlementIn` runs in `world:settlements`, and each
  site lists its buildings, each with a type, a level and a place. A new type, **`house`**, is most of them; a **mill**
  stands by a village's water and a **market** on a large village's green, both of the catalogue as they are. A fishing
  village's huts are houses by the water.
- **The opening raises every building** of every site the world lacks, held by nobody, under an id name-based on the
  site's and the building's number, so opening a world twice raises nothing twice, and named by its settlement, *house
  in the village by the Vistula*. Raised side by side, each its own history. **No new event and no new command.**
- **A structure is part of the settlement whose radius holds its place**, whoever raised it and whenever: a castle
  founded inside a village's radius is part of that village. The bake keeps settlements apart, so no radius overlaps
  another. For now this is worked out on the page, from the settlements it holds, and means only a link.
- **The page learns the settlements from a stand layer of their own**, `settlements`, sent through the fog like the
  ruins: a record a settlement, its middle, radius, kind and level, and the number of its name in a names file it
  fetches once. The page lays out what is not a structure from it: the settlement's worn ground, its streets and green,
  a fishing village's jetties, boats and net racks.
- **On the map** a settlement's structures stand among the trees together, as one thing, so the draw cost stays a
  slice a settlement (0110); further out they gather into one mark named by the settlement. The inspect window shows a
  settlement as a whole - its name, kind and level, and the structures inside it the house has seen - and a structure
  inside one links to it.

## Consequences

- Every building is a structure: clickable, inspected, under the fog, one day held or taken one by one.
- `village` and `fishingVillage` leave the catalogue, so a world that raised them holds events its code no longer reads:
  pre-alpha, the World section's wipe (0036).
- The opening raises some fifty thousand structures on a fresh world instead of 7,674, side by side; its time is
  measured before anything is built on it, and fewer houses a level is the lever if it is too long.
- Being part of a settlement is the page's arithmetic for now. When a mechanic needs it - a house taking a settlement,
  what being part of one gives - the server works it out the same way from the same file.
- The `settlements` layer bumps the protocol's version once.

## Alternatives considered

- **The settlement a structure of its own**, nobody's, with a radius, drawn as its ground. It would have had a history
  and a window for free; Adam chose the area, which has nothing to hold until a mechanic needs it.
- **Being part of a settlement stored at raising**, on the building. A castle founded inside the radius later would never
  be part of it.
- **The page laying out the buildings, as before.** They could be clicked, but not be structures: not held, not taken,
  not in a cell's snapshot.
- **A word and a pane for the settlement's window.** Adam: no vocabulary for what is only a way of looking at a thing;
  it is the inspect window, as for everything else.
