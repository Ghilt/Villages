---
name: regenerate-world
description: Rebuild everything a change made stale in the world - tiles, rivers' flow, sprite map, ground, origin map and names, culture map, height, scenery stills, painted views - then say what moved with a number and a picture. Use whenever a step changes the master, world/palette.json, world/render.json, world/painterly.json, world/biomes.json, world/names/, world/cultures.json, or any tool or code the tiles, the paint or the maps go through; also when a worktree has no world cut yet. Never offered as an option: it is part of the step.
---

# Regenerate the world

Adam paints the master and picks the numbers that are matters of taste. Everything a tool can rebuild from
those, the agent rebuilds, without being asked and without offering it as a choice. Stale output is worse
than missing output, because it looks like evidence: a still painted by the previous rules is not a
preview of anything.

The picture of all of this - every tool, what it reads, what it writes, how long it takes, and which of it
the running game reads - is the page `/admin/inspect-architecture`. This file is what to run.

## 1. Work out what is stale

Find the row for each thing the step changed, and run every tool in it. Run from the worktree root, each as
`npm run <tool> --prefix frontend`, a master's name as the first argument when it is not the default one.

| You changed | Run, in this order | Time a master, measured 2026-10-11 |
|---|---|---|
| the master, or the palette | `world:import`, `world:tile`, `world:flow`, `world:sprites`, `world:ground`, `world:origin`, `world:culture`, `world:height`, `world:scenery`, `world:paint` | about twelve minutes |
| the tiling or `world/render.json` | `world:tile`, `world:paint` | about four minutes |
| the flow tool | `world:flow` | a minute and a half |
| `world/biomes.json` or the sprite generator | `world:sprites`, `world:scenery` | a minute |
| the ground tool | `world:ground` | seconds |
| the origin tool | `world:origin`, `world:culture`, `world:height` | five minutes |
| `world/cultures.json` or the culture tool | `world:culture` | two seconds |
| `world/names/1790.json` or `about.json` | `world:names` | a second |
| `world/painterly.json` only | `world:paint -- --config-only`, and `world:paint` for the stills | a second, or a minute |
| a picture in `world/sprites/` or `world/ui/` | nothing: `world:art` and `world:ui` run on every dev-server start and on save | |

The quick-start does the same from the files' dates, and the Debug map panel's `cut it` runs the master's
row for one master. Neither paints the stills, and neither writes through a link: tiles a worktree
links from the main checkout are that checkout's, and they are cut there or not at all. Say which.

## 2. Read what each tool prints

These are the numbers to carry into the hand-over:

- `world:origin`: how much of the land is from Earth, invented and copied, and how many names went nowhere.
- `world:culture`: what share of the land is of each culture. The Culture renderer is its picture.
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

When a tool is added to the world, it gets a row here, a place on `/admin/inspect-architecture`, and a line
in the quick-start, in the same step.
