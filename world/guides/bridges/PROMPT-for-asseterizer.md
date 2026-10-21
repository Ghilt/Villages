I want asseterizer to paint Villages' bridge, in the map's own perspective, over eight placeholders a Villages session
rendered from a 3D model of it. Villages' roads cross rivers by bridges, and Adam asked on 2026-10-21: *"Generate a 3d
bridge as you want it and then ask start a sub session in E:\Code\asseterizer to replace your basic art with new."*
Please plan this as a new section of PLAN.md with steps and 🔍 checks, the way we always work.

## The pictures

Eight files, every one a placeholder now:

    E:\Code\Villages\.claude\worktrees\road-system-settlements-4caa66\world\sprites\bridges\
        bridge-u.png  bridge-u-uv.png  bridge-uv.png  bridge-uv-v.png
        bridge-v.png  bridge-v-vu.png  bridge-vu.png  bridge-vu-u.png  and placeholders.json

They are in that worktree of Villages, not yet in the main checkout `E:\Code\Villages\world\` that is asseterizer's
root: the work that made them reaches main when Adam says so, after a run he is away for. Reach them in the worktree
(the worktree stays; Adam never removes one), or wait for main; whichever your own rules prefer.

**One bridge, the same for every culture and every river**, along each of the eight ways a bridge may run: the ground
grid's two axes `u` and `v`, its two diagonals `uv` and `vu`, and the four halfway between them, `u-uv` (two along `u`
for one along `v`), `uv-v`, `v-vu` and `vu-u`. A bridge reads the same from either end, so these eight are every
direction a road crosses a river in.

**Each placeholder is the block-out to paint over**, rendered from the model with a depth buffer in exactly the map's
projection: a humped stone deck between low parapets, carried over three arches on two piers with pointed cutwaters,
a ramp down to the road at each end; coursed stone, voussoirs round the arches, setts on the road, an ink line where
parts meet. Use the placeholder itself as image 1, "keep its shape, its perspective and its footprint". It is a
humpback stone bridge of the eighteenth century, weathered, a little moss in the joints near the water; the same
stone and the same bridge in all eight.

## The perspective, exactly

The same as the buildings' (`E:\Code\Villages\world\guides\buildings\PROMPT-for-asseterizer.md` says it at length):

- **A parallel camera**, north up, looking down at 45 degrees; the ground's grid turned 26 degrees.
- **Upright edges stay vertical**, drawn at 0.71 of their length; ground depth at 0.71 too.
- **The light comes from the upper right.** Never mirror one picture to make another: the light would come from the
  left. Each of the eight is its own render and must be painted from its own.
- **The background is transparent**, and no water is drawn: Villages draws the river under the bridge itself, and it
  shows through the arches.

**The middle of the picture is where the bridge stands**: the middle of its deck, on the ground. Villages reads it
from the picture's size, not from what is painted, so **keep the file's size and keep the bridge where it is in it**:
paint inside the placeholder's frame, at its scale, 200 pixels to the world unit. The bridge is four units long end to
end and about one wide; Villages stretches it along its deck to each river's span.

## Watch for

When asseterizer painted the harbours it added a second house on the quay. A bridge may tempt it the same way: no
water, no banks, no boat under it, no lamp posts or statues, nothing beside it; each end meeting the road at the edge
of the bridge itself, nothing hanging below.

## Done means

`bridge-u.png` regenerated as candidates that keep the block-out's shape and lie along it exactly; then the other
seven the same way, the same bridge in each. Adam picks in the verify queue as usual when he is back; a pick writes
over the file, and Villages' cut (`npm run world:structures --prefix frontend` in the tree that holds it) takes it
into the map.
