# A living world

**What belongs here:** how the world's land, its trees and its critters come to move - what moves on each kind of
land, the one layer the land is drawn in, the trees in the wind, the critters and what draws them, the parts of the
Shaders section, the rules that must hold, and the order it all gets built in. **What does not:** why each piece is
drawn the way it is, which becomes decision records as it is decided; what it looks like in plain words, which is
`LOOK-AND-FEEL.md`; the words, which are `GLOSSARY.md`; the levers as they are in the running program, which are
`RUNNING.md`. When a part of it is decided, that part becomes a decision record and leaves.

Planned on 2026-10-16 from Adam's request, with what the web had on how other games make a world feel alive, and
agreed the same day with the answers below. The question at the end is still his, and so is every name.

## What Adam settled

| Question | Answer |
|---|---|
| A shader for each kind of terrain, or one layer | One: the shaders for every kind of terrain are combined |
| What comes first | The trees in the wind |
| What the scenery layer is for | Pieces of scenery that are the same for every player at places worked out the same everywhere: the trees now, mountains later. So the wind moves only how a piece is drawn, never where it stands; a kind given no numbers, a mountain, stands still; and the gusts are the same in every browser |
| Where the work starts from | Main as it stands: the branch is rebased onto it first |

---

## The problem, in one paragraph

Close in, from zoom 8.5 to 10, the water moves and the grass sways on four kinds of grassland, and everything else is
as painted: twenty-four of the world's thirty-two kinds of terrain stand still, every forest among them, and nothing
lives in any of it. Adam wants the environment living: a look of its own for every kind of terrain, and critters -
birds flying out of a bush, a squirrel hopping about, fish jumping out of the water - which hold no gameplay
significance, with a density for them in the Shaders section of the debug panel. He asked what is reasonable to do in
a shader, and whether critters can be animated sprites or have to be rough shapes.

## What a shader can do here, and what it cannot

The answers the rest of the plan stands on.

- **One layer for all the land, not a shader for each kind.** A shader the sprite canvas draws over the whole screen
  pays for every pixel of it, whether its terrain is under that pixel or not, so twenty-four more would cost
  twenty-four screens a frame. And the kinds move alike: what grows bends in the wind, what is frozen or salt glints,
  what is loose blows, what is stone stands still. So the grass grows into one **land layer** that knows which kind of
  land is under every pixel and works out only that kind's motion there: a screen of rock costs almost nothing, a
  screen of grass what the grass costs now. A motion is a few functions of it; a kind of land is a row of a table
  saying which motions it has, in what colours.
- **A forest's life is its trees, not its ground.** Its ground is under its trees, so a shader there would hardly
  show. What makes a wood live is the trees bending in the wind: the scenery's own shader leaning the top of every
  sprite with the same gusts the grass shows, so a gust rolls across a meadow and on into the wood. Four corners a
  tree, so it costs next to nothing.
- **Some ground should stand still.** Bare rock and stony desert move in no wind, and motion invented for them would
  read as a fault, the rock crawling. Their life is what lives over them: an eagle circling, a lizard.
- **No heat shimmer.** Real shimmer bends what is under it. The land layer is in the sprite canvas, which cannot see
  the map's pixels, and in the map itself it would mean copying the whole frame every frame. Faked as wavering pale
  bands it reads as a smear, so it is left out.
- **Critters can be animated sprites, and should not be a shader over the whole screen.** A shader reads a picture as
  easily as it draws a shape, and an animation is a strip of frames the clock picks from, so nothing confines a
  critter to rough shapes. That critters hold no gameplay significance says the browser should make them up, a look
  and nothing more - never sent, never stored, nothing in the world knowing of them - which is what the Shaders
  section is for. It does not say a full-screen shader should draw them: one would pay for every pixel of the screen
  to draw twenty birds; it would not know where the scenery's bushes are, which are placed in code from the stands the
  server sends, so a bird could not leave the bush you are looking at; and nothing it drew could pass behind a tree.
  Placed the way the scenery is, as a pure function of where and when, and drawn as sprites, they cost a few dozen
  pictures a frame, leave from the very bush, and go behind the trees. They keep their part of the Shaders section all
  the same, with its levels and the density.
- **What reads at this size is how a thing moves.** A world unit is a master pixel, about 1.2 kilometres, and at the
  closest zoom a screen pixel is about 75 metres of ground: a squirrel to scale would be a three-hundredth of a pixel
  long. So critters are drawn at the scenery's own scale, where a tree is three to five world units tall: a songbird
  about half a world unit across, a hawk twice that, a squirrel smaller than the songbird. Even so, at zoom 10 a
  songbird is eight or ten pixels across, a squirrel six and a hawk sixteen, under the twenty the rule for sprites
  asks, so its outline will not say what it is and its motion will. Three or four frames are all a critter that size
  can show, and it shows only from zoom 9 in. A squirrel will read as something small bounding from one tree to the
  next, which is what one looks like from a hilltop too.
- **Birds out of a bush on their own clock.** Nothing walks past a bush on this map, so nothing startles them: they
  burst out now and then by themselves. The one thing of the player's that moves over the ground is the cursor, and
  birds could lift from the bushes it passes, as they do in Kingdom when the monarch rides by. That is offered as a
  step at the end, because it would be this browser's own and not the shared world's.

Borrowed: one wind that moves everything, from Ghost of Tsushima, whose grass, trees and cloth all take the same wind
and whose birds and animals are particles of the effects rather than creatures of the game; birds that sit in bushes
and fly off, from Kingdom; the small background animals games call critters, from Stardew Valley; dunes rippled by
the wind, from Journey.

## What moves on each kind of land

Thirty-two kinds in `world/palette.json`. The water's four are the water shader's already.

| Land | Motion |
|---|---|
| steppe, meadow, savanna, alpine meadow | **sway**: the grass, as it is |
| floodplain | sway, the grass's, with **pools** here and there |
| farmland, farmland with woods | sway: crops standing in rows, each field its own way, long slow waves rolling through them |
| heath, scrub, tundra | sway: low and woody, gentler, each in its own colours, and tundra's cotton grass nodding |
| marsh | sway in the reeds, pools between them, **mist** lying low |
| bog | pools, dark and still but for the light, mist, sparse cotton grass |
| paddy | a sheet of water catching the light, with rows of shoots swaying |
| mangrove, swamp forest | the trees in the wind, pools between their roots |
| taiga, open taiga, conifer, broadleaf, mixed, rainforest, dry forest | the trees in the wind |
| ice | **glints** that flash and are gone, and **drift**: snow streaming along the wind |
| polar desert | drift, and a few glints |
| salt flat | glints |
| sand desert | drift: sand streaming off the crests along the wind |
| stony desert, bare rock | **still**, on purpose |

## The land layer

The grass spike becomes the land layer, `sprites/land/`, where it stands now: under the scenery, in the container the
fog takes the colour out of. It pieces the same flat tiles under the view the grass's mask is pieced from, but keeps
what each world unit is rather than whether it is grass: for each unit, how strongly each motion is there and in what
colours, from a table in `land/look.ts` by the palette's names, softened at the edges as the grass's mask is. Each
pixel works out only the motions of the land under it. One pass, one level, one cost line in the log. The grass keeps
its look and its sliders exactly, as the first of the motions.

- **Sway**: gusts travel down the wind as soft bands, and where one blows the growth shows its paler side; close in,
  strokes stand up from the ground and lean with it. The grass's tufts and brush as now; crops the same strokes set in
  rows inside fields a few world units across, a field's rows one way, the gusts broader and slower so the waves roll;
  reeds tall, thin and in clumps; heath and scrub low clumps a gust only nudges.
- **Pools**: small patches of open water among the growth, darker than it, catching the light where the wind ruffles
  them, and now and then a ring spreading.
- **Glints**: points of light, sparse and small, each flashing for a moment and gone.
- **Drift**: faint pale streamers running along the wind, faster than the gusts, fading as they go.
- **Mist**: low banks drifting slowly over the wet land, thin enough to see through.

## The trees in the wind

The scenery's particles get a shader of their own that leans the top of every sprite with the land's gusts, the foot
kept where it stands and the shadow leaning with it. How far each kind leans is a number in its look - a palm or a
birch a lot, an oak or a spruce a little, a boulder or a cactus not at all - and a crown pales a little as a gust
passes, as the grass does. The gusts are one function the land and the trees both take, `sprites/wind.ts`, blowing
the sea's way, so the meadow and the wood bend together, and carried by the wall clock as the clouds are, so every
browser has the same gust at the same place and moment. The trees are on the screen from 7.5 in, and keep the sprite
canvas drawing at their level's rate while they are, as the grass does from 8.5.

## The critters

**Where and when.** The ground is cut into cells, and for each slot of the wall clock a hash of the cell and the slot
says whether a critter comes there, which of that ground's cast, where from - a bush or a tree the scenery drew, a
stretch of water - and when in the slot. Everything after that is a function of the seconds since it began. Nothing is
remembered and nothing is sent: every browser works out the same critters at the same moment, as every browser draws
the same sky. What a slot brings is worked out once when the slot comes round, not once a frame.

**How they move.** Four ways, which between them carry every cast:

- **Flush**: a few birds burst out of cover together, fan out, climb, and flap and glide away, fading as they go.
- **Hop**: a small animal bounds a few times from one piece of cover to another and is gone behind it.
- **Leap**: a fish jumps clear of the water and falls back, a ring where it left and one where it fell.
- **Soar**: a bird circles slowly high up, its shadow sweeping the ground below it and to the left.

**Who lives where: the casts.**

| Ground | Critters |
|---|---|
| forests | songbirds out of the trees (flush), a squirrel from tree to tree (hop), a hawk over the clearings (soar) |
| heath, scrub | small birds out of a bush, grouse out of the heather (flush) |
| grassland | a hare out from behind a bush (hop), larks rising (flush), a hawk (soar) |
| farmland | crows lifting from the field (flush) |
| marsh, bog, floodplain, paddy, mangrove, swamp forest | ducks off a pool (flush), a frog into a pool with a ring (hop) |
| lakes, rivers | a fish jumping (leap) |
| shallow sea | a fish jumping and dolphins in a row (leap), gulls wheeling low and quick (soar) |
| ocean | a whale's spout far out, now and then (leap) |
| ice, polar desert, tundra | ptarmigan (flush), an arctic hare (hop) |
| sand and stony desert, salt flat | a lizard darting (hop), a vulture circling (soar) |
| bare rock, alpine meadow | an eagle circling (soar), a marmot (hop) |

**How big, and from where.** At the scenery's scale, each kind's size in world units in `critters/look.ts`, with a
size slider over all of them. From zoom 9 in, whole by 9.5.

**The pictures.** A critter is one picture of its frames side by side, `world/sprites/critters/<kind>.png`, standing
on the bottom edge, cut by `world:art` into an atlas as the scenery is, with its frames listed beside it. Placeholders
first, drawn by the tool from simple shapes and never over a file that is there; Adam's to replace when he chooses, as
every sprite is. The rings and the shadows are drawn in code.

**Where in the canvas.** Two layers, both in the container the fog takes the colour out of: one on the ground, under
the scenery, so a hare can start behind a bush and a tree in front of it hides it, holding the rings and the shadows
of everything that flies; and one in the air, over the scenery and under every mark.

## The Shaders section, after

| Part | In its bar | Inside |
|---|---|---|
| Water | off, low, high | as now |
| Relief | off, low, high | as now |
| **Land**, which the Grass part becomes | off, low, high | a fold for each motion's kinds of land, each with an on box and its sliders: Grass with its ten as now, Crops, Heath and scrub, Wet land, Ice, salt and sand |
| **Trees** | off, low, high | how far a gust bends them, how much a crown pales |
| Clouds | off, low, high | as now |
| **Critters** | off, low, high: low fifteen frames a second, high thirty | how many, from none to many; how big; a reading of what is on the screen |

A player who asked for less motion gets the land and the trees still, as the grass is now, and no critters at all.

## The rules that must hold

| Rule | What holds it | When |
|---|---|---|
| A look and nothing more: nothing here is sent, stored or known to the server | it is all in the page, under `sprites/`; no frame of the protocol and no event changes | always |
| One wind: what bends in the wind bends with the same gusts, the same way, in every browser | one gust function, `sprites/wind.ts`, taken by the land and the trees, carried by the wall clock modulo the world's width; the way is the sea's; tested | at build, and every frame |
| The wind moves only how a piece of scenery is drawn, never where it stands | the trees' shaders displace the corners above a sprite's foot and nothing else; a kind given no numbers stands still, and a test fails until every kind in `world/biomes.json` has its own | every frame, and at check |
| One light: the glints, the crowns' pale side and every critter's shadow agree with the relief and the scenery's shadows | `map/light.ts`, imported | at build |
| One world: the same critters at the same place and moment in every browser | a critter is a pure function of its cell, the slot of the wall clock and the scenery there, tested. Knowingly broken by a browser's own sliders, by a player who asked for less motion, and by clocks a few seconds apart | every frame |
| Fewer is a subset of more: turning the density down only takes critters away | each chance carries a draw of its own, compared with the density; tested | every frame |
| Nothing pops: a critter comes out of cover or water, or fades up, and leaves the same way | each way of moving starts and ends hidden or at nought, and a test samples every one for a jump | every frame |
| A critter only where its kind lives: fish in water, squirrels among trees, birds out of cover the scenery drew | the casts, by terrain class and scenery kind; tested | every frame |
| No critter where the house cannot see now (the question below) | the fog's field asked for each critter | every frame |
| Every kind of land has its motion or stands still on purpose, and every kind of ground its cast or none on purpose | tests over `world/palette.json`: a kind added to the palette fails them until it is given one | at check |
| A screen with nothing moving asks for no frames, and the land costs no more than the grass did on a screen of grass | the layers' wants; the cost meter, said in the log | every frame, and at each hand-over |

## Names

No events: nothing here is in the event store or seen by the server. The words, proposed for the glossary, for Adam
to approve or rename:

- **Land motion**: how a kind of land moves in the wind and the light - sway, pools, glints, drift or mist - or that
  it stands still. Every kind of land has its own, in `land/look.ts`.
- **Critter**: a small wild animal the browser makes up from where and when: birds out of a bush, a hare, a fish
  jumping. The same in every browser, a look and nothing more: never sent, never stored, and nothing in the world
  knows of it.
- **Cast**: the critters a kind of ground has.
- **Flush**, **hop**, **leap** and **soar**: the four ways a critter moves.

## Asked of Adam

1. **Critters only where your house sees now, or wherever the scenery grows?** Recommended: only in sight. The grey
   ground is what you remember, and if what you remember holds still, the land in sight is the living land. The grass
   and the water go on moving on grey ground: they are how the ground looks, and a critter is news.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **The trees in the wind.** The scenery's shader, leaning every sprite and its shadow with the gusts, each kind by its own number, a crown paling as a gust passes; the gust function shared with the grass, `sprites/wind.ts`, carried by the wall clock so every browser has the same gusts; the Trees part of the Shaders section with its two sliders, said in the log as `tuned: …`; LOOK-AND-FEEL, RUNNING, ARCHITECTURE | 👀 At zoom 9.5 where a wood meets grassland near your seat: a gust rolls across the grass and on into the wood, the trees lean with it and pale a little as it passes, and settle behind it; boulders and cactus never move. 👀 Shaders → Trees: off, low and high do what they say and the log says what each costs; pick how far they bend. |
| 2 | **Critter pictures.** `world/sprites/critters/`, a picture a kind with its frames side by side; `world:art` cuts them into an atlas with their frames and feet; placeholders drawn by the tool for a songbird, a squirrel, a hare and a fish, never over a file that is there; AUTHORING-THE-ART | 👀 `world/sprites/critters/`: is a strip of frames side by side, standing on the bottom edge, the way you would want to paint one? The checks: the cut is tested. |
| 3 | **The critters' clock.** The cells, the slots and the casts as pure functions, with the tests that hold one world, fewer a subset of more, nothing popping and only where they live; nothing drawn yet | The checks. Nothing to see. |
| 4 | **Birds out of the bushes.** The two layers in the sprite canvas; songbirds flushing from the bushes and trees the scenery drew, in the woods, the scrub and the heath, with their shadows; a decision record, GLOSSARY, LOOK-AND-FEEL, ARCHITECTURE and the architecture page's card | 👀 At zoom 9.5 over woods or scrub in sight: every so often a few small birds burst out of a bush or a tree, fan out, flap and glide away, their shadows below them; none in the haze. 👀 Two windows side by side on the same place: the same birds leave the same bush at the same moment. |
| 5 | **The Critters part.** Off, low and high in its bar; how many, from none to many, and how big, remembered in the browser and said once in the log; the reading of what is on the screen; no critters for less motion; RUNNING | 👀 Shaders → Critters: off, low and high do what they say; how many, from none up, adds birds and never moves the ones already flying; the reading names them. 👀 How big: pick it. |
| 6 | **The land layer.** The grass becomes it: the tiles pieced as what each world unit is, the table of the land in `land/look.ts`, the grass the first of its motions with its look and sliders kept; the Grass part becomes the Land part with Grass a fold inside it; the test that every kind of land is in the table; a decision record, RUNNING, ARCHITECTURE | 👀 Nothing new: the grass at 9.5 looks exactly as it did, and the log's cost line for the land at low is about the grass's. The checks. |
| 7 | **Crops.** Farmland and farmland with woods: strokes in rows, each field its own way, long slow waves rolling through; its fold with its sliders; LOOK-AND-FEEL | 👀 At 9.5 over farmland: the crops stand in rows, a field to a direction, and long waves roll through them down the wind. 👀 How big the fields are and how broad the waves: pick them. |
| 8 | **Heath, scrub and tundra.** Low woody growth stirring, gentler than the grass, each in its own colours, and cotton grass nodding on the tundra; its fold | 👀 At 9.5 on heath, on scrub and on tundra: low growth stirring in its own colours, and grassland beside it plainly livelier. |
| 9 | **Wet land.** Pools among the growth catching the light, rings now and then, reeds in the marsh, the paddy's sheet of water with its rows, mist drifting low over the marsh and the bog; its fold | 👀 At 9.5 over a marsh, a bog and a paddy: water showing between the growth and catching the light, a ring now and then, mist drifting low. 👀 How much mist: pick it. |
| 10 | **Ice, salt and sand.** Glints on the ice, the polar desert and the salt flats; snow streaming along the wind over the ice and the polar desert, and sand off the crests of the sand desert; its fold; every kind of land now has its motion or stands still on purpose | 👀 At 9.5 on the ice and on a salt flat: points of light flash and are gone, and over the ice pale streamers of snow run with the wind. 👀 Over the sand desert faint ribbons of sand blow along the wind, and the stony desert beside it stands still. |
| 11 | **A squirrel and a hare.** The hop and its pictures: a squirrel from tree to tree in the woods, a hare out from behind a bush on grassland, each gone into cover at the end | 👀 In a wood at 9.5 to 10: now and then something small bounds from one tree to the next and is gone behind it. 👀 On grassland a hare hops out from behind a bush, a few bounds, and is gone again. |
| 12 | **Fish jumping.** The leap, its picture and the rings, in lakes, rivers and the shallow sea, never on land | 👀 Over a lake or a river in sight at 9.5: now and then a fish jumps clear and drops back, a ring where it left and one where it fell. |
| 13 | **A hawk overhead.** The soar: a bird circling slowly over open ground, rock and desert, its shadow sweeping the ground below it and to the left | 👀 Over open ground at 9: a bird circling high and slow, its shadow crossing the fields and passing under the trees. |
| 14 | **Every kind of ground its cast.** The rest of the casts from the four ways of moving, a placeholder for each kind: crows, larks, grouse, ducks, frogs, gulls, dolphins, a whale's spout, ptarmigan, an arctic hare, lizards, vultures, eagles, marmots; the test that every kind of ground has a cast or none on purpose | 👀 A tour at 9.5: farmland, a marsh, the coast, the desert and the tundra each have critters of their own. |
| 15 | *If wanted:* **Birds lift where the cursor passes.** Over a bush, its birds lift; this browser's own, outside the shared world | 👀 Move the cursor slowly over scrub at 9.5: birds lift from the bushes it passes, and only from those. |
| 16 | *If wanted:* **A deer at the forest's edge.** A fifth way of moving, walking: a deer steps out where a wood meets grassland, grazes a moment and goes back in | 👀 Where a wood meets grassland at 9.5 to 10: a deer steps out, grazes and goes back in. |

The order is a suggestion, as every order here is. The trees come first because they are one step and change the
most of the map at once; then the critters, the riskiest new thing, a new layer, new pictures and a new clock; then
the land a kind at a time. The land and the critters share nothing, so either can go first.

## Not in this plan

Day and night, seasons and weather: a dawn chorus, fireflies, snow in winter, rain. Critters that mean anything: an
omen, a sign of a hidden house, game to hunt. Animals a house would own - sheep, cattle, horses - which would be
someone's, and so the game's. Mist over the forests, which would need a layer over the trees. Heat shimmer, for the
reason above. Critters further out than zoom 9, such as geese crossing the map. Sound. Any of it in the painted
stills: only the running map moves. A player's own switch for any of it.
