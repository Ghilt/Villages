I want asseterizer to paint Villages' buildings in the map's own perspective. The pictures we have now, in Villages'
`world/sprites/structures/`, are painted as if seen from too low. Their bases are flatter than the ground they stand
on in the game, so the buildings don't sit in the land. Please plan this as a new section of PLAN.md with steps and
🔍 checks, the way we always work, and stop for my "perform up to X" before building anything.

## The guides

A Villages session drew guides for this, in exactly the map's projection, kept in Villages' own repository:

    E:\Code\Villages\world\guides\buildings\

Copy that whole folder into this repository first (say `docs/guides/villages-buildings/`), so a session here has it.

- `1-ground-and-base.png`: the map's ground closest in, and a building's base on it. Look at this one first.
- `2-box-4-by-4-by-4.png`, `3-house-gable-roof.png`, `4-round-tower.png`: what upright walls, a roof and a round
  tower look like in this projection.
- `5-castle-block-out.png`: a castle's mass in plain shaded shapes, sized like the castle in the game.
- `6-today-castle-and-its-square.png`: the painted castle we have now, with the square its base really covers drawn
  in red. That shows the problem.
- `7-every-type-footprint-and-frame.png`: all 16 building types at their first level. Each shows the square its base
  covers and the frame its picture fills.
- `draw_guides.py`: the Python that drew them (Pillow only). It has the projection, and boxes, gable and hipped
  roofs, round towers and cones. Reuse it.

## The perspective, exactly

- **The camera is parallel**, not a perspective camera: no vanishing points, and parallel edges stay parallel. North
  is up. It looks down at 45 degrees.
- **The ground's grid is turned 26 degrees**, so a building's square base is a lopsided diamond on screen. From its
  front corner, the long front edge runs up to the left at 19 degrees, and the short side runs up to the right at
  55 degrees.
- **The front corner is the lowest thing in the picture**, about a sixth of the base's width right of the middle.
  Villages stands the building on that point, which it calls the foot, and finds it by reading the lowest two rows of
  pixels. So nothing may hang below it: no ground, no plinth, no shadow, no cart in front.
- **Upright edges stay vertical**, drawn at 0.71 of their true length. Ground depth is drawn at 0.71 too. The tops of
  walls and the roofs show a lot more than they do now.
- **The light comes from the upper right.** Faces turned right are lit, the long front face is in half shade, and
  tops are lightest.
- **The background is transparent**, with no ground and no shadow. Villages now draws worn earth under every building,
  and shadows of its own.

To go from world units to screen units: a point `u` along the grid's first axis, `v` along its second and `z` up
lands at `x = u·cos26 − v·sin26` and `y = (u·sin26 + v·cos26)·0.7071 − z·0.7071`, with y pointing down. A base
covers u and v from −side to 0, with its front corner at (0, 0).

## How big each one is

The picture is drawn from its foot to its top as tall as the catalogue says. Its base covers a square of `footprint`
diamonds on each side. A square of side s is about 1.34·s wide on screen, so the picture's width to height is
about 1.34·footprint / height. First level:

| type | footprint | tall | wide : tall |
|---|---|---|---|
| castle | 6 | 8 | 1.00 |
| manor | 4 | 6 | 0.89 |
| palace | 7 | 10 | 0.94 |
| fort | 5 | 7.2 | 0.93 |
| watchtower | 3 | 6.4 | 0.63 |
| prison | 4 | 5.6 | 0.96 |
| cathedral | 6 | 10 | 0.80 |
| abbey | 5 | 6.8 | 0.98 |
| mill | 2 | 4.8 | 0.56 (the sails reach out wider) |
| mine | 3 | 4.8 | 0.84 |
| market | 5 | 5.6 | 1.19 |
| harbour | 6 | 6 | 1.34 |
| shipyard | 4 | 6 | 0.89 |
| manufactory | 4 | 6 | 0.89 |
| academy | 5 | 6.8 | 0.98 |
| printingHouse | 3 | 5.6 | 0.72 |

These numbers live in Villages' `world/catalogues/structures.json`, and its `/admin/inspect-structures` page draws
every picture standing on its footprint.

## What I think will work

Klein 4B has no ControlNet, so the geometry has to come in through the reference image. The ideas below are mine and
the Villages session's. Check them against what you know of the pipeline, and say if something better fits.

1. **A block-out as the shape reference.** Draw each type's mass in plain shaded shapes, in this projection, at its
   footprint and height. `5-castle-block-out.png` is the castle's. A mill would be a round tower with sails, a
   cathedral a long nave with two towers at its west end, a manufactory a long hall with a chimney, and so on. Use the
   block-out as image 1, "keep its shape, its perspective and its footprint", in place of today's flat placeholder.
2. **The painted picture we have now as the style reference** (image 2, the late-step gating already in place), so
   each culture keeps its colours, materials and gouache look while the geometry comes from the block-out.
3. **A starting latent from the block-out** (research note 0.4: `VAEEncode` with a partial denoise), if image 1
   alone does not hold the angles.
4. **Words for the form**, so the `{form}` part of the prompt says what the picture is: seen from 45 degrees above
   with a parallel camera, the base turned so its long front runs up to the left, tops and roofs well visible, the
   front corner the lowest point, nothing under it.
5. **A check in the verify queue**: an overlay that draws the base square, dashed, over a candidate, as Villages'
   `/admin/inspect-structures` does. Then I can tell a right angle from a wrong one at a glance.

Done means: the castle, the mill and the cathedral, in all four cultures (European, Islamic, East Asian, African),
regenerated as candidates whose bases lie on the square in the overlay. Then the other 13 types in the same way.
I pick in the verify queue as usual.
