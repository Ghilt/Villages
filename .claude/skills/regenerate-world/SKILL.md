---
name: regenerate-world
description: Rebuild everything a change made stale in the world - tiles, rivers' flow, sprite map, ground, origin map and names, culture map, height, settlement sites, roads, scenery stills, painted views - then say what moved with a number and a picture. Use whenever a step changes the master, world/palette.json, world/render.json, world/painterly.json, world/biomes.json, world/names/, world/cultures.json, world/ruins.json, world/settlements.json, world/roads.json, or any tool or code the tiles, the paint or the maps go through; also when a worktree has no world cut yet. Never offered as an option: it is part of the step.
---

# Regenerate the world

## At a glance

Whatever a step made stale in the world is rebuilt in that step, without asking, and what moved is said with a
number and a picture.

- **Adam paints, the agent rebuilds** - the master and the numbers of taste are his; everything a tool can
  make from them is the agent's.
- **`world:ready`** - works out each world step's fingerprint and makes, borrows from the world cache, or
  leaves each one; it never needs telling what is stale.
- **The stills are by hand** - `world:scenery` and `world:paint`, run when a change shows in them.
- **Stale output is worse than missing** - because it looks like evidence.

Adam paints the master and picks the numbers that are matters of taste. Everything a tool can rebuild from
those, the agent rebuilds, without being asked and without offering it as a choice. Stale output is worse
than missing output, because it looks like evidence: a still painted by the previous rules is not a
preview of anything.

The picture of all of this - every tool, what it reads, what it writes, how long it takes, and which of it
the running game reads - is the page `/admin/inspect-architecture`. This file is what to run.

## 1. Make it current

`npm run world:ready --prefix frontend` from the worktree root, a master's name after `--` when it is not the
default one. It works out every world step's fingerprint from what the step is made from - the master, every
file, the tools' own code - and says a line a step: *current*, *borrowed from the world cache*, or the tool's own
output as it makes the step, with the reason (*world/palette.json changed*). It never needs telling what is
stale, and it never writes through a link. `-- --why` says where each step stands and what moved, making
nothing; `-- --only <step>` makes one step and every step made from it. See decision record 0095.

A change to a tool's code moves that tool's fingerprint, so `world:ready` makes it again after the change, once
for every tree. A change to a tool whose output does not move with its code - a library's behaviour, say - is
made again with `-- --only <step> --force`.

It makes what the game reads, never the stills. Those are by hand, each `npm run <tool> --prefix frontend`:

| You changed | Paint, after `world:ready` | Time a master, measured 2026-10-11 |
|---|---|---|
| the master, or the palette | `world:scenery`, `world:paint`, `world:flow` for its stills | about two minutes |
| the tiling or `world/render.json` | `world:paint` | a minute |
| the flow tool | `world:flow` (its stills; it makes the tree's own flow, which the next `world:ready` borrows over) | a minute and a half |
| `world/biomes.json` or the sprite generator | `world:scenery` | seconds |
| `world/painterly.json` | `world:paint` for the stills | a minute |
| a picture in `world/sprites/` or `world/ui/` | nothing: `world:art`, `world:structures` and `world:ui` run on every dev-server start and on save | |

What `world:ready` made rather than borrowed it filed for every tree, and what it borrowed was made by the tree
it names. The quick start and the Debug map panel's buttons run the same `world:ready`.

## 2. Read what each tool prints

These are the numbers to carry into the hand-over. A step `world:ready` borrowed says the last thing its tool said
when it was made; `-- --only <step> --force` makes it again to read all of it:

- `world:origin`: how much of the land is from Earth, invented and copied, and how many names went nowhere.
- `world:culture`: what share of the land is of each culture. The Culture renderer is its picture.
- `world:ruins`: how many towns of 1790 are in ruins in each tier and each culture, and how many stand in a square of
  sea. `-- --picture` draws every town's ruins as rings around a few great cities into `world/painterly/ruins/`.
- `world:settlements`: how many settlement sites, of each type, level and culture, how many beside the ruins, and
  how many buildings of each type the opening will raise on them.
  `-- --picture` draws them over the ground around a few towns into `world/painterly/settlements/`.
- `world:roads`: how much road of each grade, how many bridges on each of their eight ways, the share of villages
  with a road to another village (95% or more, or say why not) and why the rest have none, the settlements no road
  reaches at all, and the stretches of road over a building, a ruin's piece or water, which must be none: a number
  above nought is a fault to fix, not a number to report. `-- --picture` draws them into `world/painterly/roads/`.
- `world:sprites`: the density of every biome against experiment 0006's ceiling. Without a sprite map a
  master draws no scenery at all.
- `world:scenery`: the counts beside every picture. Say which places moved and by how much.
- `world:ground`: the game server reads it to know what a player is looking at when they roll; a stale one
  offers a river that is not there any more. It reloads it by itself.

## 3. Say what moved

Not "re-painted" but which views changed and by how much, and a before-and-after of the worst one. A number
and a picture, because a look cannot be reviewed from a claim.

## 4. Re-tune, or say plainly why not

If the change altered what a style number means, the numbers are now wrong and saying so is not enough.
Either propose new ones with the pictures to argue them, or say in one sentence that the judgement is
Adam's eye and what he should look for. Never leave a stale still or a tuning job on the menu as though it
were an optional extra.

## Change this skill

When a tool is added to the world, it gets a step in `frontend/packages/world/bin/lib/worldSteps.ts`, which is
what `world:ready`, the quick start and the panel all make, and a place on `/admin/inspect-architecture`, in the
same step; a still it paints gets a row here.
