# Look and feel

> **What belongs here:** the shared visual language — the rules every part of the interface follows, and the
> components more than one mechanic uses. **What does not:** how any single mechanic looks, which is that
> mechanic's own look-and-feel section in `MECHANICS.md`, how the interface behaves across screen sizes
> (`RESPONSIVE-DESIGN.md`), and what the experience is about (`VISION.md`).

This document is new and deliberately thin. A unified component style is worth having and is not a mechanic,
so it is collected here as it is decided, rather than being discovered again inside each feature. Most of it
is not decided yet, and says so.

## The rules

**Diegetic wherever it can be.** What the player is shown should be part of the world rather than a control
panel laid over it. A choice arrives as something on a desk, not as a modal dialog. This is the one settled
thing about the presentation; the theme and tone around it are not (see `VISION.md`).

**Every screen, from the start.** A component is laid out for a phone and a desktop in the increment that
builds it, never in a later pass. See `RESPONSIVE-DESIGN.md`.

**A component is shared, not re-invented.** When a second mechanic needs something the first already showed
the player, it uses the same component and this document gains an entry, rather than each mechanic growing
its own version of a parchment.

**Painted, and placed by CSS.** The look is in pictures - gilt borders, velvet, parchment, cherubs, stone -
and the stylesheet only puts them where they go. The moodboard in `world/ui/moodboard.webp` is the target
for every surface, and what is drawn in code today, **the ornament** above all, stays until its surface is
redone from the library. Every boxed thing is a **container** of four layers - border, fill,
embellishments, content - and a pane is asked for in those words. The parts are in `UI-COMPONENTS.md` and
on the page at `/admin/inspect-ui-components`; why it is pictures is decision record 0068.

**The tiles are dressed.** Each tile of the spread is a container named for it, and a pane in it draws only
what it says, never the frame round it: the corner, bottom left, and the rail of windows above it are Adam's
acanthus frame on its stone, cream words and gilt marks; the column down the right, where dialogues are,
is the cherubs' frame on its dark felt, its bubbles and options a paper a little raised from it, and a
conversation's scene running out under the frame to its moulding; the letter along the bottom, where a choice
is put, is the clouds round their own night sky, a little taller than its parchment was for the frame's
corners; a pane put away to its strip is the narrow gilt on
the same stone, because no deep frame fits 44 pixels; the tab bar over the corner stands on night. On a phone
a pane keeps the dress of the tile it belongs to. Inside a dressed tile the game's colours - its ink, its
gold, its parchment, the papers laid on it - are the library's, said once in `stage/dress.ts` and `stage/dress.css`, so a light
dress later is those lines again. A mark dimmed until it is wanted is never dimmed under the 3 to 1 a mark is
read at. Every tile is dressed now; the debug panel is not, and keeps the game's own colours.

## Rarity

Four bands, used wherever a rolled thing is shown, with the standard colours:

| Band | Colour |
|---|---|
| Common | gray |
| Uncommon | green |
| Rare | blue |
| Legendary | orange |

The exact values are not chosen. The bands and their colours are, because a player learns them once and
should never have to learn them again.

## Components

**The desk.** A wooden desktop with an inkwell, on which the world puts things in front of the player. Its
first use is the choice roll.

**The parchment.** A textbox styled as a sheet of parchment, lying on the desk. Hovering one lifts it
slightly, so it reads as something that can be picked up. One parchment carries one **option** of a choice
roll — the class named the whole choice until 0044, which had it backwards — and what else it might carry is
not decided.

**The carousel.** One thing at a time, with a step either side and a dot per thing beneath. The small form
of a pane whose full form is a list, so that the list can be glanced through in a strip of screen while the
map stays up beside it. Its first and only use is the choice roll. See decision record 0044.

**The needle.** One mark, pointing at a **bay**. One drawing turned four ways, so a player learns it once:
this mark means *there*.

**The compass rose.** Four cardinal points filled and four between them drawn, inside a ring: the way to
everything that is not on the screen. On a phone it is a disc in the **bottom right corner of the stage**,
always the same corner, and one tap puts **navigation** in the bay under the thumb; in the spread it is a
tab in the corner. The same mark doing the same job in the room each form has for it. The ordinals are
outlined rather than filled so that it reads as eight points and not as a blob at the size a tab draws it.

It is the **one thing that floats over the world**, and it floats because what it opens is everywhere while
what it used to stand on — the seam between the bays — moves every time anything is resized. It is drawn to
earn the corner rather than to sit on it: parchment, a rim and a fainter gold ring nested inside, which is
the achievement's own way of drawing a frame, so it reads as a seal pressed into the corner of the sheet
rather than as a button laid on top of one. A thumb across, which is what a **strip** is, because it is the
same thumb. Whatever is under it steps clear, so nothing the player needs is ever beneath it. See decision
records 0043 and 0047.

**The resource marks.** Five glyphs, one per resource, drawn stroked at the same weight as every other
mark in the interface and coloured `--ink-soft`: a coin for wealth, a ridge of land for domain, two rings
that overlap for influence, a pair of dividers for reason, and a cross for piety. **Each is a different
silhouette before it is a different picture**, because five of them have to be told apart at about
seventeen pixels: a ring, a jagged line, a wide double, a triangle with a dot over it, and a cross. The
word each one stands for is on its label rather than beside it, until it is learnt. See `MECHANICS.md` on
house status.

**The stat marks.** A key figure's stats are drawn in the same family, and **piety and reason are the
resources' own drawings**, the cross and the dividers, because the two are to be joined and a player who
has learnt the house card has already learnt half of a key figure. Kindness is a heart, physical an arm
bent at the elbow and age an hourglass, all three placeholders until the marks are drawn properly. Beside
a stat the word is written too, where the house card has only the mark: a key figure's details have room
for five words, and the words teach the marks. Every mark a number is known by is in `marks/Mark.tsx`;
`Icons.tsx` is the marks a **pane** is known by.

**The pane size control.** Three marks in a pane's corner saying how much of the stage it is taking: put
away, the normal size, opened out. The mark is **how much of a box is filled**, which is the thing being
chosen rather than a metaphor for it - no folder, no chevron, no arrow pointing anywhere. Every **pane**
has one, in both forms, and it replaced a chevron that could only put a pane away. A pane that cannot be
put away offers two marks rather than three. The panes taking turns in the corner of the spread share
one, at the far end of the **tab bar**, because the corner is one size whichever of them is up. See
decision records 0045 and 0057.

**The ornament.** Gold on parchment, drawn the same way wherever the interface embellishes an edge:
**nested contours** at decreasing weight rather than one thick line, a **stud** where something is fixed,
a **lozenge** where two runs meet, and an **open curl** that springs away from the line and turns back on
itself without closing. Drawn once for the achievement the shield hangs in, and the vocabulary for any
edge worth marking since. **None of it carries meaning** — the heraldry is the field and the charge, and
this is the frame they hang in — so there is never anything in it for the player to read. A curl is drawn
once and mirrored rather than drawn four times, which is the **needle**'s rule. See decision record 0048.

**The portrait frame.** One upright picture of a character, three by four, wherever a face is shown: the key
figures, the inspect window, and a dialogue's bubbles and scene. In a window it hangs at the top right,
beside the name and the facts, so a window on a person is no taller than one on a house. The frame is the
ornament's two contours, a gold edge and a fainter rule inside it drawn over the picture, so a dark picture
keeps its frame. **Somebody with no picture is still somebody**: a character with no portrait, or one whose
file is missing or will not load, is a bust in soft ink, never an empty frame and never the browser's
broken-image mark. `Portrait`, in `figures/Portrait.tsx`.

**The scene.** Behind the whole of a conversation, one of Adam's pictures of where it is happening, filling
the pane, Adam's word of 2026-10-02: cropped to the pane's own shape rather than squeezed into it, a little
below the picture's middle, so what matters in a picture is best near its middle. A light wash of the
pane's paper lies over it. The conversation is drawn over the scene: the bubbles, the options, what a line
gave and the closing line each on paper of their own, with a soft shadow, so they read on any picture, and
the head and the foot are paper bars across it. The speakers stand in the scene in their bubbles, facing
each other from the two sides. With no picture the pane is its own paper. `Scene`, in `dialogues/Scene.tsx`.

**The ground has a shape.** The painted ground is shaded by its slope, its **relief**: faces turned from the
light in a dusky violet, faces towards it in a warm cream, the flat left as painted. Heavy on the continent,
out to zoom 6, where the mountain ranges stand out of the paint as an atlas draws them; easing to a light
shading by zoom 9 and in, where the scenery and the paint carry the ground and the relief only gives it some
variety. The light is the one the shadows are cut for, from the upper right, and the clouds are lit by it too. Over a renderer that draws the
ground in hard cells, `plate`, it can come in the same cells, in a few hard tones. See decision record 0090.

**A picture on the map.** Every sprite on the map is a picture Adam hands over, and every one of them has
to agree with the others on three things, or it looks pasted on. **The light comes from the upper right**,
because the first picture has it there. **The eye looks north and down at 45 degrees** at the closest zoom,
where the sprites are seen - the player's camera tips up to that from straight down at zoom 7 - so a
building is drawn front-on from that height and not as an isometric diamond, while a round tree
hides the difference. **The picture stands on its foot**, the lowest thing in it and the anchor both of a
thing's forms share. It carries its own colour and is never tinted. A sprite is between twenty and about
ninety pixels tall wherever it is drawn, so **its outline is what reads**: what tells one kind from another has to
be its shape. No picture has an outline, and **no sprite carries a shadow**: a picture drawn standing on a
plinth brings one, and it goes with the plinth, because a shadow drawn into a sprite darkens whatever it is
drawn over and doubles where two overlap. **The scenery casts its shadows in a layer of their own**, under
every sprite: each is its sprite's outline laid on the ground by the one light, short, to the left and a
little towards the eye, fading and softening as it goes, over a darker pool right at the foot that stands
the thing on the ground; where two overlap the ground takes the darker and no more. How dark is a lever in
the Scenery section, 40 per cent where a shadow is whole to begin with; experiment 0013. Whether a sprite
disappears into the painted forest is a question for the eye. How to hand one over is `AUTHORING-THE-ART.md`; why it works this way is
decision record 0059.

**The land moves.** Close in, from zoom 8.5, on the grassland - steppe, meadow, savanna and alpine meadow - gusts
travel down the wind as soft bands, and where one blows the grass shows its paler side; closer still, tufts stand up
from the ground and lean with the gust, tall grass in patches with a paler straw tip, low round clumps of brush that
a gust only nudges, and bare ground between. On the farmland the land is cut into fields, a patchwork of uneven
shapes a few world units across with a bare track between them, each lying fallow or standing ripe or green, faintly
washed in its own colour, its crops in rows running its own way; long slow waves roll through them down the wind, a
band of light where the crops bend with a darker one behind it where they stand again, and close in each stalk leans
as a wave passes. On heath, scrub and tundra a gust only stirs the low woody growth, far more gently than the grass:
heather in small purple clumps close together, scrub in bigger grey-green bushes with bare ground between, the tundra
a low khaki mat with here and there cotton grass nodding its white head. On the wet land open water lies among the
growth, dark and catching the light where the wind ruffles it, the light running slowly over it and the little waves
near every pool's edge following its shore, lapping in towards it, and now and then a ring spreads on it: reeds stand
in clumps in the marsh, tufts on the floodplain and shoots in rows in the paddy's terraces, which are a sheet of
water, all bending with the gusts, and over the marsh and the bog mist lies in long thin banks along the screen,
streaked, rising and falling along their length and swaying slowly to and fro, thin enough to see through. On the
salt flats points of light flash for a moment and are gone. Over the ice and the polar desert snow streams along the
wind in faint streamers, cool grey on the white, and now and then a little swirl of it spins and drifts down the
wind. The sand desert lies still but for a clump of dunes here and there, one, two or three of them and none touching
another: two stand corner to corner, a little sand between them, and a third further off, straight behind one of them
or beside it end to end. Each is whole and broad, a long ridge sweeping in curves, some bent as an S, or a crescent
with its horns reaching down the wind, standing up the screen as the trees do, a long gentle slope up to each crest
and a short steep slip face down the lee, lit and shaded by the one light so the slip faces fall dark, the sand
rippled; and sand streams over the crests in thin pale ribbons along the screen, curling as it flows, running faster
than the gusts and strongest where one blows. It is one layer for every kind of land, and the rest stands still as it
is painted, on purpose: the water moves by its own shader, a wood by its trees, and bare stone not at all, on
purpose. Every number is in `apps/web/src/sprites/land/look.ts`; see decision record 0102.

**The scenery bends in the wind.** Close in, every tree, bush, reed and tuft leans down the wind as a gust passes
and settles behind it, its foot where it stands and its shadow leaning with it, and its crown turns a little paler,
as the grass's field shows its paler side; with no gust it sways a little on its own. A birch, a palm or a reed
bends a lot, an oak or a spruce a little, a stone or a cactus not at all, and a kind given no numbers stands still,
as a mountain will. Under the trees of the forests a fern grows here and there, low and arching and bending with
the gusts, so a wood has its undergrowth. The gusts are the grass's, the world's one wind blowing the sea's way,
and the same in every browser. A player who asked for less motion sees it all standing still. Every number is in
`apps/web/src/sprites/trees/look.ts`; see the amendment to decision record 0052.

**Every town of 1790 is a ruin.** From zoom 7.5 in, as the scenery arrives, where a town stood its ruins stand
among the trees: rows of roofless houses and empty shells along the lines of its old streets, broken towers, a hall
open to the sky in its core with a square about it, rubble and lone walls at its edge, and where its culture walled
its towns a broken wall with gates where the streets met it. A great city's ruins spread for tens of world units, a
hamlet's are a handful of shells. The core is open ground, the outer ruins as wooded as the land about them, and
nothing stands in a river or the sea: a port's ruins stop at the shore. Each piece is drawn in the culture's own
look - grey stone, sand and green tile, dark tile and lacquer, mud and thatch - and East Asian towns stand square to
the four quarters. It is the same city in every browser. See decision records 0103 and 0104.

**Critters live where the house sees.** From zoom 9 in, every so often a few small birds burst out of a tree or a
bush the scenery drew - in the woods, the scrub and the heath, and out of a lone bush or tree in the open - each from
a little apart in it, all off in one direction like a shotgun's blast, curving the same way together as a flock in
flight turns; they climb, flap and glide away, and then hook down - a sharp turn and a drop of a little over half a
bird length straight down the screen, settling, and then a quick fade; a few of them drop into a tree near by
instead; or a bird or two flits from one tree into another near it, as if seeking shelter, and goes into its leaves.
Off the open fields a covey of partridges bursts up together, low and fast, and comes down further off; over the
grassland and the fields a lark or two rises high and comes down not far from where it rose; a few dark grouse burst
whirring out of the heather of the heath and the scrub; ducks lift off the wet land and climb away; and on the ice,
the polar desert and the tundra's heather white ptarmigan burst up off the white. In the woods a squirrel bounds now
and then from one tree to another near it, stopping once on the way, and is gone behind it; on grassland a hare comes
out from behind a bush or a tuft of grass, a few bounds and a stop, and is gone behind another. In the wet land a
frog hops from one tuft of the reeds to the next and sits a while between, and beside any lake or river, whatever the
ground, one may hop out of the reeds or the grass into the water, a ring spreading where it went in; now and then a
snake glides out of the reeds into another tuft near it, seen from above as the map is, its body waving as it goes.
They run on the ground, so a tree in front of one hides it, and each faces the way it is going. Over a lake, a river
or the shallow sea a fish now and then jumps clear across the screen and falls back, tipped along its arc, and a ring
of light spreads on the water where it left and another where it fell, flattened as the ground is tipped. Over the
shallow sea dolphins leap one after another in a row, and gulls wheel low and quick, two to four together; far out on
the ocean, now and then, a whale blows, its back and a spout of spray standing up out of the sea and falling back, a
wide ring spreading as it goes under. In the stony desert a lizard dashes from one stone to the next, and over the
open sand too, still in the sun between dashes; among the boulders of the high ground a marmot lopes from one to
another, sitting up on the way to look about it; and over the snow and out of the tundra's heather an arctic hare
bounds. High over open ground a hawk now and then circles slowly, gliding, seen from above as the map is and turned
the way it flies, its circle drifting down the wind and its shadow sweeping the ground below it, under the trees;
over the bare rock and the alpine meadows an eagle circles, alone and higher, and over the deserts, the salt flats
and the savanna vultures, one to three together, on wide slow circles. Every kind of ground has its critters. The
ruins of the towns of 1790 have their own and nothing else has them: crows burst out of what still stands high in a
black flock bigger than the songbirds', or two or three circle slowly over the stones, and a rat scurries low and
quick from one heap of rubble to the next. Each has a soft shadow on the ground below it and away from the light,
which a tree in front of it hides. They are drawn at the scenery's scale, smaller than any other sprite, so what
tells a bird from a speck is its wingbeat rather than its outline. They come only where the house sees now: the grey
ground is a memory and holds still. Nothing pops: a critter comes out of its cover, and one first seen on its way
fades up. The same birds leave the same bush at the same moment in every browser. A player who asked for less motion
sees none. Every number is in `apps/web/src/sprites/critters/look.ts`; see decision record 0099.

**The seam.** The join between the two **bays**, drawn as a moulding lying over it: three gold rules
running the length of the stage — a heavy one on the join and a lighter one either side — with a fixed
**knot** of **ornament** at the middle. The knot is one size whatever the length, because an ornament that
stretches is an ornament that has been noticed; the rules stretch because a rule is a rule at any length.
They run out to the stage's own edges rather than fading, for the reason the house card is flush against
the edges it meets. It lies **over** the two bays rather than taking room from them, so nothing in the
layout changed to make room for it, and it takes no pointer. One drawing turned: a band across a portrait
stage, the same band down a landscape one. The **compass** stands on it. See decision record 0048.

**The strip.** What every **pane** looks like put away: a band 44 pixels across with the pane's name on
it and the **pane size control** beside it. The same band turned a quarter in landscape, 44 pixels wide
down the side of the stage with the name written **down** it rather than dropped — there is no room for a
word across 44 pixels and eight hundred pixels of room along one. One shape and one thickness for every
pane, so that putting anything away looks like putting anything else away, and two panes that say
otherwise and say why: the **map** carries no control and is itself the way back, and **navigation**
carries the marks of what it could put in the other bay, because that is the strip a player arrives in by
pressing the compass. An inspect window's strip is its first row - the mark of its kind, the name of the
thing, the control and, on a desktop, the close - so it says which house rather than that it is one. See
`RESPONSIVE-DESIGN.md`, `MECHANICS.md` and decision records 0046 and 0047.

**The tab bar.** Several **panes** sharing one **bay**, and a strip of marks across its top saying which is
up. Marks and no words: a column is 26rem at its widest and two words on a tab is a tab that wraps. Its
first use is the corner of the spread, where the house status, the key figures and navigation take turns,
in that order: the house's own two first, then the way elsewhere. The key figures' mark is **a head and
shoulders**, a bust as a portrait is framed, and a placeholder until the marks are drawn properly. The
tabs stand at the left of the bar and the tile's one **pane size control** at its far end, because the
tile is one size whichever tab is up: pressing a tab changes what is drawn and never how big it is. Only in
the spread — a phone reaches the same panes through the compass, because a row of tabs on a 390-wide stage
is a row of things too small to hit. See decision records 0042 and 0057.

**Scrollbars.** Wherever something scrolls - a list, a window taller than its room, the debug panel, the
event viewer - the scrollbar is thin, its thumb in the soft ink and on no track of its own, so a list that
scrolls reads as parchment with a mark in its margin rather than as a window of the operating system. Said
once, on the root, with the two standard properties every browser follows; the browser draws the shape.

**Two forms on the map.** Anything standing in the world is drawn two ways, and which one you see is how
far away you are. Its **ground form** is what it is, sized in world units, so it grows with the terrain
and keeps its size against the ground the way a building on a map does. Its **icon** is what it means,
sized in screen pixels, so it stays readable however far back the camera goes. They trade places by
crossfading exactly where the two are the same size, so nothing jumps.

The two are different drawings and not one drawing at two sizes. That is the whole of it: close up you
get the thing, with whatever detail it is worth giving; far out you get the sign for it, said in as few
strokes as read at the size of a word. A house is a castle of two towers close in and a battlemented
keep far out. A **person** is a small standing figure close in - a head over a cloak that widens to the
hem, a unit and a half tall - and a head and shoulders far out, sixteen pixels, the key figures' own mark;
they trade at zoom 9.4, just in from where a key figure is first drawn, and both are in the colours of
the house they serve, the first that took them in. What has only an icon is a thing the world is saying
rather than a thing standing in it, like the seat a choice is offering. A **structure** is drawn in its own
colours and never tinted, and says who holds it by a **pennant** in the holder's field flown over it, none
when nobody does. Until the marks of its types are drawn its sign is its own picture at the size of a word,
the one exception to two drawings, and a placeholder.

**The fog of war covers ground forms and never icons.** An icon is the sign for a thing rather than the
thing, so it is drawn over the fog wherever it stands; a ground form is part of the world, and is under the
fog unless it stands in the house's vision. A new kind of thing on the map gets this for nothing by having the
two forms. See decision record 0063.

**Revealed ground is the same country gone grey.** Its colour is taken out and its brightness kept, so pale
farmland stays pale and dark forest dark, and it is lifted a little towards the parchment; the trees and the
castles standing on it lose their colour with it, and the signs over it keep theirs. See decision record 0065.

**The haze is mist over a field, and its edge does not move.** It lies in bands stretched along the screen,
four times wider than tall, never in round blotches; far out, where a band would be only a few pixels tall, it
is a flat haze. Close in the bands swell and thin where they lie and drift slowly across, slow enough to be
noticed rather than watched. The edge of what is seen stays still, so nothing that stands on it seems to be
swallowed and given back. Every number of it is in `apps/web/src/fog/look.ts`.

**The clouds are weather over the world when it is pulled back.** From zoom 7 out clumps of cloud drift over
the map, a clump about a tenth of the screen wide at 5.5, about a third of the sky in all. They live in **weather
systems**, as real clouds seen from orbit do: large masses swept into bands and swirls a screen or two across at
5.5, with wide clear country between, so the sky is never an even scatter of blobs. They lie on the ground: they
scale with the zoom and stay over the land they float over, whole out to 5.25; further out the systems lead and
the clumps' own shapes ease back, and the clouds thin away from their edges to nothing by 3.5 rather than turning
grey, so the whole world reads clearly further out. **Between 7 and 6 the
camera is in them**: they are the same clouds, nearer the closer it comes, so they swell about the middle of the
screen and slide out past its edges, misty, their tones run together towards white, while a ring opening out from
the middle keeps what the camera is looking at clear, and their shadows on the ground fade; by 7 they are past, and
the camera is under them. Every load comes down through them on its way to the house's seat. They lie over the fog's haze, because there is weather over the unknown too, and under every
sign, the marks and the ring. They drift with the world's one wind, the sea's, slowly enough to be noticed rather
than watched, about three minutes across the screen, and every browser sees the same sky; the finer lumps drift a
little faster than the clumps, so a clump changes shape as it goes rather than sliding by whole. **They are lit
the way real cumulus is, in the map's own colours**: every lump a cumulus is built of has a face towards the light
and one away from it, from the upper right as the hills are lit, so the white is never flat - the relief's cream on
the faces the sun strikes, white between, white gone towards the relief's violet on the faces turned away - and the
shading moves inside the white as the lumps drift and change. The tones run into each other; nothing is a band of
fixed width along an edge, because that read as a slab cut out of card. A cloud's margin is thin, and the ground
shows through it, before it thickens to whole. **Every cloud casts its shadow**, down and to the left, the way the
hills' shading and the scenery's shadows fall: the cloud's own lumpy shape, soft-edged, in the relief's dusky
violet, as dark as the cloud over it is thick, so a thin margin casts a faint one, laid over whatever is under it,
the haze included, half a clump from the cloud. How dark and how far are levers. **The clouds keep clear of the player's marks**: round each mark
they thin away from their own ragged edges, leaving a clear patch a little wider than the mark, and close again
once they have drifted past; no shadow lies on a mark either. The marks are drawn over the clouds all the same. Every number of them is in
`apps/web/src/sprites/clouds/look.ts`, and the light is `apps/web/src/map/light.ts`. See decision record 0098.

**Nothing on the map pops.** A thing arriving fades up, a thing gone fades out and is only then let go
of, and a thing changing form crosses over rather than swapping. All of it is a fifth of a second or
less, so it reads as the world settling rather than as an animation. See decision record 0051.

The one thing longer than that is the **dive**, which is not a thing on the map settling but a passage
between two places: the camera holds still over your own castle and the whole picture is scaled up into
the sprite's own pixels until the room inside them is the window. It takes a second and three quarters and
it runs on a rail, so the wheel has nothing to say while it is happening. Whether an interface whose rule
is that nothing pops is allowed one thing that takes over is part of what experiment 0009 is asking.

**The marks.** Every pane declares the mark it is known by, drawn in one place so that the same thing on a
tab, in a list and wherever a pane is named later cannot drift apart. **The compass is the needle inside a
ring**, deliberately: the needle says which bay a thing goes to and the compass opens the pane that lists
the bays, so they read as one family rather than two unrelated drawings. A **link** out of an inspect
window is one button rather than a pair of needles, and *show it on the map* is the map's own mark; see
decision record 0049. A key figure's details carry the same map mark beside their name while they stand
on the map, and none while they are on no map, doing what the window's does: the camera to them, and on a
phone the map into the other bay. **The way back from one key figure to all of them is nine small
squares**, the grid it goes back to, filled rather than outlined because nine outlines at the size of a
mark are a blur, and drawn at **twice a mark's size**, Adam's word, because it is the one way back from
where the pane has got to. **The way back from a conversation to all of them is the list it goes back to**,
three rows each with its point, by the same rule: a way back is drawn as where it goes. ***Continue*, in a
conversation, is a word and not a mark**: it was a chevron in the corner, the same "the one after" as the
letter's carousel, and it was too easily missed for the one thing to press while a conversation is read. It
stands in the middle of the foot, in gold where the options are in the parchment's edge. Both Adam's call.

## Not decided

- Theme and tone as a whole. See `VISION.md`.
- The exact colours and the type, which the library's first step proposes and Adam chooses; the grain of
  the desk; and whether the map's own look leads the rest of the interface or stands apart from it. Two forms settles one corner of this: what stands in the world is
  drawn by distance, which is the map's rule and not the interface's.
- What the **room** the desk stands in is made of, and whether it is a place with anything in it or only
  the far end of a zoom. It is simple shapes today, deliberately, so that the motion of pulling back into
  it can be judged before anything is drawn properly. See experiment 0009.
- Whether the parchment survives contact with a second mechanic, or turns out to be the choice roll's own.
