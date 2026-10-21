I want asseterizer to paint what dresses Villages' fishing villages - net racks, boats and jetties - in the map's own perspective, over
placeholders a Villages session drew for them. Villages now has villages and fishing villages that nobody holds,
dotted over the countryside, and roads between them that cross rivers by bridges. Please plan this as a new section
of PLAN.md with steps and 🔍 checks, the way we always work, and stop for my "perform up to X" before building
anything.

## The pictures

Ten files, every one a placeholder now, in Villages' repository:

    E:\Code\Villages\world\sprites\settlements\    10 files, and placeholders.json

The bridges have a brief of their own now, `world/guides/bridges/`: one stone bridge modelled in 3D on eight ways. A
settlement's houses, mill and market are structures now, painted as the structures are: the house is
`world/sprites/structures/house-<culture>.png`, by the buildings' brief in `world/guides/buildings/`.

They reach that checkout once the work that made them is on Villages' main; until then they are in the worktree
`E:\Code\Villages\.claude\worktrees\road-system-settlements-4caa66\world\sprites\`. Asseterizer's root is the main
checkout's `world`, so wait for main rather than adding the worktree as a root: a worktree goes away.

- `<piece>-<culture>.png`, two pieces in each of the four cultures (`european`, `islamic`, `eastAsian`, `african`):
  a `netRack` and a `boat`.
- `jetty-u.png` and `jetty-v.png`: a jetty of planks on posts, along each of the ground's two axes.

**Each placeholder is the block-out to paint over.** It is drawn in exactly the map's projection, its masses in plain
shaded shapes in the culture's colours, at its true footprint and height. Use the placeholder itself as image 1, "keep
its shape, its perspective and its footprint", as the castle's block-out was for the buildings.

## The guides

Copy `E:\Code\Villages\world\guides\settlements\` into this repository first (say `docs/guides/villages-settlements/`):

- `1-every-piece-on-its-footprint.png`: every piece in every culture, the square its base covers dashed in red; the
  cottage, house, barn, chapel and fishing hut in it are retired.
- `2-every-bridge-and-jetty-on-its-axis.png`: every jetty over the strip of ground its deck lies along; the bridges in
  it are the old timber and stone ones, which are retired.
- The buildings' guides in `..\buildings\`, and their `PROMPT-for-asseterizer.md`, say the same perspective at more
  length; `draw_guides.py` there has the projection in Python.

## The perspective, exactly

The same as the buildings':

- **A parallel camera**, north up, looking down at 45 degrees.
- **The ground's grid is turned 26 degrees**: a square base is a lopsided diamond, its long front edge running up to
  the left at 19 degrees, its short side up to the right at 55.
- **A building's front corner is the lowest thing in its picture**, its foot: nothing may hang below it - no ground, no
  plinth, no shadow.
- **Upright edges stay vertical**, drawn at 0.71 of their length; ground depth at 0.71 too.
- **The light comes from the upper right.** Never mirror a picture to make another: the light would come from the
  left.
- **The background is transparent.** Villages draws worn earth under every building and casts shadows of its own.

A point `u` along the grid's first axis, `v` along its second and `z` up lands at `x = u·cos26 − v·sin26` and
`y = (u·sin26 + v·cos26)·0.7071 − z·0.7071`, y pointing down.

**The size is the scale.** Every placeholder is drawn at 200 pixels to the world unit, and Villages reads how many world
units a picture stands from its pixels at that scale. Asseterizer keeps a file's size, which is exactly what is wanted:
paint inside the placeholder's frame, at its scale.

## What each one is

| piece | base | what it is |
|---|---|---|
| netRack | 1 × 1 | two posts with a net hung between them to dry |
| boat | 2 × 1, on the water | a smack with a gaff sail (European), a felucca with a lateen sail (Islamic), a sampan with a woven canopy (East Asian), a dugout (African); its hull to the waterline, no water drawn |

**The cultures.** European: whitewashed walls and timber, red tile or thatch, gable roofs. Islamic: mud-plastered
whitewashed cubes, flat roofs with low parapets, small windows. East Asian: dark timber frames, grey tile roofs, hipped
and flaring at the eaves. African: round mud huts under conical thatch, walls of a warm earth colour.

**The jetties** are timber planks on posts, three and a half units long and one wide, a post at each end and one
between, standing in water that is not drawn. Paint **each end meeting the bank at the edge of the picture**, and
nothing hanging below the ends: Villages stands a jetty on the middle of its deck, halfway between where its two ends
are lowest, and draws the water under it itself.

## Watch for

When asseterizer painted the harbours, it added a second house on the quay and painted the moored boat as a separate
sailboat beside it. The boats and the jetties may tempt it the same way: one boat, no water, nothing beside it; one
jetty, no boat moored to it.

## Done means

The European net rack and boat, regenerated as candidates whose bases lie on the dashed squares of the guide. Then
the others in all four cultures and the jetties, the same way. I pick in the verify queue as usual; a pick
writes over the file in Villages' `world/sprites/`, and its dev server cuts it into the map a moment later.
