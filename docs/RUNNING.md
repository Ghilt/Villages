# Running the program

> **What belongs here:** what each part of the running program does and where to find it - the debug
> panel and every section of it, the player's own levers, the pages beside the game - and Adam's folders of
> pictures and the tools that cut them, as they are used. **What does not:** how to start the program and
> check it, which is `CLAUDE.md`'s "How to run"; why any of it is built as it is (`ARCHITECTURE.md` and the
> decision records); what a mechanic is (`MECHANICS.md`); how to paint the master (`AUTHORING-THE-WORLD.md`)
> or a picture (`AUTHORING-THE-ART.md`); and how the stage behaves at every size (`RESPONSIVE-DESIGN.md`).

Everything here is about a development build, started as `CLAUDE.md` says - the quick-start, or the `web` and
`backend` entries of `.claude/launch.json` - and looked at on the tree's own port. A production build is the
stage alone, with none of the debug panel in it (decision record 0079).

## The debug panel and the game

- The game starts up under the **loading screen**, which covers the stage from the page's first frame and leaves
  the debug panel beside it free. Once the map has its style and the gateway has said whether the player has a
  house, the camera is put on the seat, as close as a house's arrival comes, with no flight - or left where the
  page opened when there is no house or a map link asked for somewhere; its meter fills as the map's painted
  tiles there arrive, and it fades once the map has nothing left to draw and nothing else is in hand: the
  scenery's, the structures' and the critters' pictures, the sprite map and the canvas the sprites stand on. It
  waits no more than three seconds for a gateway that does not answer, and never stays past twelve seconds from
  the page opening, whatever is still coming. It comes once a page load: a reconnect does not cover the game, and
  a house founded while playing is flown to as before. The log says it under `startup`: *the camera put at the
  seat at 41.219, -99.716, 1.8 s after the page opened*, then *the map was drawn 3.8 s after the page opened, 2.0 s
  after the camera was put*, or what was still coming when the limit lifted it. `apps/web/src/startup/`; the
  screen itself is the library's `LoadingScreen`.
- Which world is drawn: the **Debug map** part of the debug panel, down the right-hand side. Its terrain dropdown
  is every PNG in `world/master/`, with each one's size, and it says whether this tree's world of it is current:
  each of its ten world steps is worked out from what it is made from, never from dates, and the panel says the
  first that is out of date and why - *tile: world/master/terrain.png changed*, *sprites: world/biomes.json
  changed* - which it re-checks whenever the window is given focus. A master nobody has cut here gets a button,
  and pressing it runs `world:ready` from the dev server, with its output going into the debug log: whatever the
  world cache has for these inputs is borrowed in seconds, and whatever nobody has made is made, about nine
  minutes the first time for a master on the whole machine. The same button makes it current again once the
  image, or a file a step is made from, has been saved since. The quick start does the same for the default
  master by itself, and nothing when nothing was saved. A master whose origin map is out of date, or whose names
  are, says so under the dropdown, with a button to mend only that - **work out its origin**, with the cultures
  and the height made from it, or **carry its names again**, a second - and the Origin and Info map renderers say
  so in the log, because a stale origin map puts real names on the wrong ground and looks no different. **furnish
  it** works out the sprite map alone. One run a tree at a time, whoever started it: a press while the quick
  start is making the world is refused and says so. Switching reloads the page on purpose. So the loop is: paint,
  save, alt-tab, pick it. See `docs/adr/0025` and 0095.
- What it looks like: the renderer dropdown in that same panel. `Biome` is not a look and not even the
  terrain: it lays the sprite map's own biome raster on the world, flat and blocky, which is the only way
  to review a biome without the scenery standing on it in the way. `Raw` is the flat
  tiles as cut; the rest are painted in the browser, tile by tile, by the same functions that paint
  the stills. `Vivid` is the odd one: it draws the master's own colours out of `world/palette.json`
  rather than the quieter ones out of `world/render.json`, saturation pushed, with the whole medium
  turned off. It is the view to check a master against the file it was painted in, and it is two
  numbers in `world/painterly.json` rather than a look. Only the terrain is precomputed: a tile knows its own zoom, so the treatment is drawn at the
  size it should be at whatever you are looking at. Painting happens in a pool of workers, and the tiles
  around the view are painted during the pauses so that moving the map finds them done. Once the loading screen
  lifts, the way out is painted after everything else, nearest zoom first: a window's worth of tiles at every zoom
  out from where the camera starts, and the whole world from zoom 3 out, whose 85 tiles are then kept for good
  rather than thrown away when the store is full - the log says so under `paint`, *painting the way out ahead of the
  camera: 344 tiles from zoom 9 out, the 85 from zoom 3 out kept for good*, and the tally in the browser's console,
  `window.villagesPainterly()`, counts every painted tile held, the kept ones with them. Nothing is kept across a
  reload. See
  `docs/adr/0021` and `0022`. `Flow` is not a look either: it draws, in place of the water, which way every
  river runs, a colour for each way and arrows marching downstream from about zoom 8, and black where a river
  has no way to any sea or lake - a break in the master's rivers to mend. See `docs/adr/0081`. `Origin` is a
  question about the master: where on Earth each square of it was cut from. Grey stayed where it was; a colour
  moved, one hue for each way and deeper the further; magenta striped matches nowhere on Earth and is invented;
  orange striped is a copy of somewhere a larger piece came from; and the thin white line is Earth's own coast
  carried through, which lies on the painted coast wherever the map has a piece right. With it showing, the log
  says how much of the land is from Earth, invented and copied, and a click on the map says under `origin` where
  that place came from and what Earth named there: `from Earth at 51.51°N 0.87°W, moved 1.2° (sure 1.00); by the
  Thames`, `at Lake Wener (Vänern)`, `in the Alps (range)`, `in India (peninsula)`, `near Mont Blanc, 4,807 m`, or
  `invented land`, and the town of 1790 nearby: `near Dantzic (Gdańsk today)`. Open sea came from nowhere, so it is
  named by the coast nearest it: `sea, the German Ocean (North Sea today), named by the nearest coast`. Every name
  is in English: a town's as of 1790, a river's, lake's or sea's as of 1790 where the review gives one and today's
  where not, a peak's and a stretch of land's as of today. It reads what `world:origin` wrote, below. See `docs/plans/real-world-names.md` and experiment 0016.
  `Info map` is the same data written as an atlas would write it, on the flat tiles quietened as for Flow:
  towns of 1790 in black beside their dots, rivers and lake shores drawn in blue with their names in blue
  italic along them, peaks in brown with their height, seas in spaced blue italic and named lands in spaced
  capitals. The important are written first and none covers another, so more appear as the camera comes in;
  the same words are not written twice close together. A click says what the Origin renderer's does. It is
  the first place to look when a name is wrong, and it draws nothing the data does not hold. Under the names it
  rings every ruined town of 1790 the game server sent: a ring at the radius its ruins are built over and a dashed
  one at how far they reach, in the Culture renderer's colour for the culture they are built in - so only what the
  fog let through, every town under what the page follows with the fog lifted, and from zoom 6 in, as the
  scenery's stands are sent.
- The water moves, from about zoom 8.5 in: depth, waves lit by a sun in the north-west, caustics on the bottom
  of the shallows, and surf along the shore, over every renderer. It is the **Water** part of the **Shaders**
  section, below Debug map, which holds a part for each shader that is a look and nothing more, with `off`,
  `low` and `high` in each part's bar and, while a part is open, a `?` there that says what the part is when it is
  hovered or reached with the keyboard, and an `on` box in the section's own bar that turns every shader off and
  back on at the levels they had. High is every pixel at thirty frames a second; low is a quarter of them,
  worked out into a picture of its own and laid over the map, at fifteen; the first time a shader is drawn at a
  level, the log says once what that costs the graphics card. The water is high at every load, and its Look is
  `Realistic` or `Wavelets`, the water's first and stylised look, kept to compare against. The rivers run
  downstream, with crests across the current and specks carried on it, from the flow `world:flow` works out
  beside the tiles; a master without it has still rivers and the log says so. Their look is the Water part's
  eight sliders: how fast, how far apart the crests are, how far the middle runs ahead, how thin and how
  bright the crests are, the specks, and how much of the sea's waves and caustics a river keeps. They are
  remembered in that browser, `reset` puts them back, and once a slider stops the log says all eight under
  `water` as `rivers tuned: …`, which is the line to hand over when a setting should become the default. Its
  programs are handed to the graphics driver as the map starts and drawn with once they are linked, the sea as painted
  until then, so the page never waits on the driver for them; the log says once under `water`, `every program linked
  ahead, the page never waiting: wavelets 0.3, flow 0.3, realistic 1.0 s`, or that the browser cannot. Every other
  number of the water is in `apps/web/src/water/look.ts`. See `docs/adr/0081`.
- The ground is shaded by its slope, the whole world, at every zoom, over the paint and under the water, lit
  from the upper right as the scenery's shadows are, from the height tiles `world:height` cuts. It is the
  **Relief** part of the Shaders section (0090): `off`, `low` (faint) or `high` (strong) in its bar, high at every
  load. Inside it, first, **how strongly at each zoom**, for whichever shader draws it: how strong far out and how
  far in that reaches, how strong close in and from which zoom; three quarters strength out to zoom 6 and 15%
  from zoom 9 in until the sliders say otherwise, eased between, and at nought nothing is fetched or drawn there.
  Somewhere not yet loaded is shaded softly from a coarser tile for a moment, never left bare. Then what draws it, two to compare. **Our shader**, the first, works
  the shade out for every pixel from a tile's heights and a margin of its neighbours', so there is no seam; with
  `pixels` ticked it shades a whole cell of the lattice the Camera section sets at a time, the turned diamonds the
  `plate` renderer draws its ground in, cell for cell. **How steep** draws the ground steeper or flatter than it is,
  and **hard tones** makes the shade a few steps each side of flat. **MapLibre's hillshade**, the second, has its
  five ways of shading, `igor` first, and with `pixels` a square block of shade a height sample, not the diamonds;
  blended, it shows a seam a few pixels wide along a height tile's edge close in. Every slider changes the map on
  the next frame, is remembered in the browser that moved it, and once one stops the log says them all under
  `relief` as `tuned: …`, the line to hand over when a setting should become the default; `reset` puts them back.
  The height is the master's own, real Earth's read through its origin map, so the shading follows land Adam
  moved, and invented land is given ground of the kind painted on it: rock a range, forest hills, farmland flat. A master with no height tiles is drawn flat and the log says what
  to run. Its numbers are in
  `apps/web/src/map/relief.ts` and `reliefTuning.ts`, and our shader is `reliefLayer.ts` and `reliefShader.ts`.
- The land moves, from zoom 8.5 in, wherever it is drawn: on steppe, meadow, savanna and alpine meadow gusts travel down
  the wind as soft bands that show the grass's paler side, and close in tufts stand up and bend with them, tall grass in
  patches, brush in clumps and bare ground between, and under the woods' trees the same grass is their undergrowth,
  sparser, shaded and with more low brush, its sliders the Grass fold's; and the farmland, with woods or without, is cut
  into a patchwork of fields, each fallow, ripe or green and washed faintly in its colour, its crops standing in rows
  its own way, with long slow waves rolling through them down the wind, a band of light and a darker one behind it,
  carried by the wall clock so every browser has the same wave at the same place; and on heath, scrub and tundra the low
  woody growth stirs as a gust passes, far more gently than the grass, each in clumps of its own size and colours, with
  cotton grass nodding on the tundra; and on the wet land open water lies among the growth catching the light, the
  little waves near every pool's edge following its shore, a ring spreading on it now and then, reeds in the marsh and
  shoots in rows in the paddy bending with the gusts, and mist lying in long thin banks along the screen over the marsh
  and the bog, swaying slowly; and on the salt flats points of light flash and are gone, snow streams along the wind
  over the ice and the polar desert with a little swirl of it now and then, and the sand desert lies still but for a
  clump of one, two or three dunes here and there, none touching another, two corner to corner and a third further off,
  long sweeping ridges, some bent as an S, and crescents, each whole and broad, standing up the screen, lit and shaded
  by the one light, with sand streaming over their crests in thin curling ribbons along the screen. It is one layer for
  every kind of land, each motion a program of its own drawn only while its land is on the screen, the **Land** part of
  the Shaders section (decision record 0102): `off`, `low` or `high` in its bar, low at every load, low a quarter of the
  screen's pixels at fifteen frames a second and high all of them at thirty, asked for only while some land that moves
  is on the screen; the first time it is drawn at a level the log says once under `land` what that costs the graphics
  card. Once the loading screen has lifted, or the first time the land is wanted if that is sooner, each motion's
  program is handed to the graphics driver, and a motion is drawn only once it is compiled, its land standing as painted
  until then, so the page never waits on the driver for it; the log says once under `land` how long each took, `every
  motion's program compiled ahead, the page never waiting: grass 1.5, crops 0.4, …`, or that the browser cannot compile
  ahead, and then its first close zoom waits as it always did. What moves on every kind of land is the table in
  `apps/web/src/sprites/land/look.ts`; every kind of land moves but the water, which the water shader moves, and bare
  stone, which stands still on purpose. Inside the part a fold for each motion, with its box in its bar, drawn or left
  as painted: **Grass**, with eleven sliders - how big the patches are, how ragged their edges, how softly one kind
  gives way to the next, how much the kinds mingle, how much ground is bare, how much stands tall and how much is brush,
  how tall the tall grass is, how big a clump of brush, how thickly the tufts grow, and how many animal trails wind
  through it, none at nought. They change the grass on the next frame, are remembered in the browser that moved them,
  and once one stops the log says them all under `land` as `grass tuned: …`, the line to hand over when a setting should
  become the default; `reset` puts them back. **Crops**, with six - how big the fields are, how many lie fallow, how far
  apart the rows are, how tall the crops stand, how broad the waves are and how strongly they show - remembered and said
  the same way, as `crops tuned: …`, with a `reset` of their own. **Heath, scrub and tundra**, with five - how big the
  clumps are, how thickly they grow, how much cotton grass grows on the tundra, how much a gust stirs them and how many
  animal trails wind through them - said as `heath tuned: …`. **Wet land**, with four - how much mist, how much open
  water, how often a ring spreads and how tall the reeds and the shoots stand - said as `wet tuned: …`. **Ice, salt and
  sand**, with six - how many glints flash on the salt, how strongly the snow streams, how often it swirls, how strongly
  the sand blows over the crests, how high the dunes stand, and how many clumps of dunes there are - said as `ice tuned:
  …`. The gusts are the one wind the trees bend in, and a player who has asked for less motion gets the land still.
- The towns of 1790 stand in ruins among the scenery, from zoom 7.5 in, wherever the game server sent their records
  of the `ruins` layer - only near revealed ground, as the scenery's stands: a cell is furnished with the pieces
  whose feet stand in it and its trees thinned by them (`furnishCell`), in the scenery's own particle layer, so trees
  and ruins sort in depth together; it waits for the ruins of the tiles under it and the eight cells about it, and is
  cut again when they change. The pieces are kinds of scenery after the sprite map's own, `ruin:<piece>-<culture>`,
  so the Scenery part says 48 kinds where the sprite map has 16, and its `ruins` row says how many ruined towns are
  held. The dial thins them with the trees. See `docs/plans/ruined-cities.md`.
- The scenery bends in the wind, from zoom 7.5 in, wherever it is drawn: every tree, bush, reed and tuft leans down
  the wind as a gust passes, its foot where it stands and its shadow leaning with it, and its crown turns a little
  paler, as the grass's field does; with no gust it sways a little on its own. How far each kind bends is its own - a
  birch, a palm or a reed a lot, a fern under the forests' trees a fair way, an oak or a spruce a little, a boulder or
  a cactus not at all - in `apps/web/src/sprites/trees/look.ts`, and a kind it does not name stands still. The gusts
  are the grass's, one wind blowing the sea's way (`apps/web/src/sprites/wind.ts`), and come from the wall clock, so
  every browser bends the same tree with the same gust; a player who has asked for less motion gets them standing
  still. They are the **Trees** part of the Shaders section: `off`, `low` or `high` in its bar, high at every load,
  low fifteen frames a second and high thirty, asked for only while some of the scenery is on the screen; a frame is
  the whole sprite canvas drawn again, and the first time the trees move at a level the log says once what a frame
  costs. Inside it, two sliders: how far a whole gust bends the bendiest kind, as a share of its height, and how much
  the palest crown pales. They change the trees on the next frame, are remembered in the browser that moved them, and
  once one stops the log says both under `trees` as `trees tuned: …`, the line to hand over when a setting should
  become the default; `reset` puts them back. See the amendment to `docs/adr/0052`.
- Critters, from zoom 9 in, only where your house sees now, or everywhere with the fog lifted: every so often a few
  small birds burst out of a tree or a bush the scenery drew - in the woods, the scrub and the heath, and out of a
  lone bush or tree in the open - each from a little apart in it, all off in one direction like a shotgun's blast,
  curving the same way together; they climb, flap and glide away, and then hook down, a sharp turn and a drop of a
  little over half a bird length down the screen, settling, and then fade quickly, a few dropping into a tree near by
  instead; or a bird or two flits from one tree into another near it, as if seeking shelter, and fades into its
  leaves. A covey of partridges bursts up off the open fields, low and fast, a lark or two rises high over the
  grassland and the fields, grouse burst out of the heather, ducks lift off the wet land, and white ptarmigan burst up
  off the ice, the polar desert and the tundra's heather. In the woods a squirrel bounds now and then from one tree to
  another near it, stopping once on the way, and is gone behind it; on grassland a hare comes out from behind a bush
  or a tuft of grass, a few bounds and a stop, and is gone behind another, each facing the way it goes; in the wet
  land a frog hops from one tuft of the reeds to the next, and beside any lake or river, whatever the ground, one may
  hop out of the reeds or the grass into the water, a ring spreading where it went in, and now and then a snake glides
  out of the reeds into another tuft near it, seen from above and turned the way it goes; over a lake, a river or the
  shallow sea a fish jumps clear and falls back, a ring spreading where it left and one where it fell; over the
  shallow sea dolphins leap in a row and gulls wheel low and quick, and far out on the ocean a whale blows now and
  then; high over open ground a hawk circles slowly, turned the way it flies, its shadow sweeping the ground below, an
  eagle over the bare rock and the alpine meadows and vultures over the deserts, the salt flats and the savanna; a
  lizard dashes from stone to stone and over the open sand, a marmot lopes from boulder to boulder of the high ground,
  and an arctic hare bounds over the snow and out of the tundra's heather; in the ruins of the towns of 1790, and
  nowhere else, crows burst out of the halls, towers and walls or circle two or three together over them, and rats
  scurry from one heap of rubble to the next. Each has a soft shadow below it. The same critters leave the same bush
  at the same moment in every browser; one first seen on its way fades up; a player who asked for less motion sees
  none. They are drawn from the critters' atlas (`world:critters`, below). They are the **Critters** part of the
  Shaders section: `off`, `low` or `high` in its bar, low at every load, low moving them at fifteen frames a second
  and high at thirty. Inside it, first what is about now, `3 songbirds, 1 hare`, or why there are none, `from zoom 9
  in`, `off`; then **spawn** and a button a kind, `songbird`, `squirrel`, `hare`, `fish`, `hawk`, `crow`,
  `crow-aloft`, `rat`, `frog`, `snake`, `partridge`, `lark`, `grouse`, `duck`, `ptarmigan`, `gull`, `dolphin`,
  `whale`, `lizard`, `marmot`, `arctic-hare`, `vulture` and `eagle`: press one and every click on the map puts one of
  that kind there, now, seen or not - a flock out of the tree or bush nearest the click, a squirrel or a hare from the
  cover nearest it to more near it, a fish out of the water clicked, a hawk over the open ground clicked, crows
  bursting out of or circling over the piece of a ruin nearest the click, a rat from it to the next, a frog from the
  reeds or the grass nearest the click into the water beside them or to the next tuft, a snake from them to the next,
  a covey, a lark, ducks or ptarmigan off the open ground clicked, grouse out of the heather nearest it, gulls over or
  dolphins out of the shallow sea clicked, a whale blowing out on the ocean clicked, a lizard or an arctic hare over
  the open ground clicked or from the stone or the heather nearest it, a marmot from the boulder nearest it, vultures
  or an eagle over the ground they live over - this window's own and nobody else's, with the log saying why when
  nothing of the kind could come there; the cursor is a cross while one is armed, and the button again or escape
  stops. Then three sliders: **how many**, from none to all there can be, where fewer is always some of the same
  critters every browser has and never others; **how often, to look at them**, from as often as a player sees them up
  to twenty times that, which keeps every critter of the lower and adds more, until every cell of a wood has a flock
  at once - a lever for watching a behaviour, not remembered, so every load is back at a player's; and **how big**, as
  times the sizes in `apps/web/src/sprites/critters/look.ts`. They change the critters on the next frame, how many and
  how big are remembered in the browser that moved them, and once one stops the log says them all under `critters` as
  `critters tuned: …`, the line to hand over when a setting should become the default; `reset` puts them back. Every
  other number of theirs is in that `look.ts`, and who lives where is `casts.ts` beside it. See `docs/adr/0099`.
- Clouds drift over the world from zoom 7 out, every lump lit cream from the upper right and shaded violet-grey
  away from it, each cloud with its soft violet shadow down and to the left. They live in weather systems, masses
  swept into bands and swirls with clear country between; they are whole from 6 out to 5.25, and further out the
  systems lead and the clouds thin away from their edges to nothing by 3.5. Between 7 and 6 they are drawn as the
  camera among them: swelling about the middle of the screen and sliding out past its edges, misty, the middle kept
  clear, their shadows fading, nothing left by 7. They lie over the fog's haze and under the marks and the ring,
  thinning away round each of your marks; they drift with the sea's wind about three minutes across the screen, and
  are the same in every browser, because where they are comes from the wall clock; a player who has asked for less
  motion gets them still. They are the **Clouds** part of the Shaders section: `off`, `low` or `high` in its bar,
  high at every load, where low is a quarter of the pixels at ten frames a second and high every pixel at twenty,
  and beside it what they are drawing at the camera's zoom, `over the clouds, 100%`, `fading, 40%`, `under the
  clouds`. Inside it, sliders: how much of the sky is cloud, how big the clumps are, how fast the wind carries them,
  how fast they change shape (how much faster their finer lumps drift than the clumps, nought for clumps that slide
  by whole), how much they gather in patches, how soft their edges are, how big the weather systems are and how
  much those decide where there is cloud, how dark their shadows are and how far from them their shadows fall, how
  far round a mark they keep clear, and the four zooms the bands change at - under the clouds closer in than 7,
  over them from 6, fading from 5.25, gone at 3.5. Every slider changes the sky on the next frame, is remembered in
  the browser that moved it, and once one stops the log says them all under `clouds` as `clouds tuned: …`, the line
  to hand over when a setting should become the default; `reset` puts them back. A browser whose sliders are not
  where they started draws a sky of its own; a new speed carries the sky on from where it stands rather than
  jumping, and the speed it started at gives the shared sky back. The first time the clouds are drawn at a level the
  log says under `clouds` what that costs the graphics card. Their program is handed to the graphics driver as the
  sprite canvas is made, under the loading screen, and the sky is drawn without them until it is compiled, about a
  second and a half, so the page never waits on it; the log says once under `clouds`, `compiled ahead in 1.3 s, the
  page never waiting`, or that the browser cannot. Every other number of them is in
  `apps/web/src/sprites/clouds/look.ts`, and the sliders' are `cloudTuning.ts`. See `docs/adr/0098`.
- What the program thinks is happening: the debug panel, one space docked down the right-hand side
  holding everything that helps during development, which minimises to a badge and remembers that,
  and is only in a development build: a production build leaves it out whole (0079).
  **It takes room from the game rather than floating over it.** What is left is the **stage**, the box
  the player's interface is laid out in and the only thing a player would ever see; two grips resize it,
  and the toggle in the very top right confines it to a phone, which is how to check that a mechanic
  reads at both shapes without a second monitor. See `docs/adr/0039` and `docs/RESPONSIVE-DESIGN.md`.
  Every section starts folded. At its foot, `admin` opens this tree's `/admin` in a new tab, and the
  build line names the branch whole, a click selecting all of it to copy, then the commit and the wire.
  It is the log and the buttons; the block of state above them went on 2026-09-16
  because Adam never read it, and what it used to say every four hundred milliseconds is now said once,
  when it changes, as a line of the log. Its copy button puts the log on the clipboard, which is the
  shortest way to tell a session what the program is doing. A read model that throws is said there too, as
  `gateway: error fault: …`, with its stack in the server's log under `villages.feed`, which the quick-start
  writes to `.logs/backend.log`; see decision record 0029. **Everything in it is in a folding section**,
  and which section a new thing goes in is asked rather than guessed, as `CLAUDE.md` says. Today they are
  Worktrees, Debug map, Shaders, Scenery, Camera, Areas, World, Resources, Structures, Characters, Dialogues and
  Choice roll.
  **The log is not a section but a column of its own**, the whole height of the panel on its outer side,
  so what a button did is in view while the button is. It begins folded: the `log` toggle in the panel's
  header, beside `landscape`, opens it and `hide` in its own bar folds it away again. The same lines are on a page of
  their own, `/admin/inspect-logs`, from every window of the game at once. The events themselves are not in the
  panel: they are in **the events log**, at **`/admin/inspect-events-log`**, a page of their own that watches the world without
  playing in it, one line an event opening to the whole thing as the store holds it, and under it a row of where
  it leads: for now **on the map**, on every event whose data names a place - the first latitude and longitude in
  it, so a structure raised, a house founded, a person who moved, vision gained, the first seat a choice offered.
  It opens the game in that tab at `/?at=<lat>,<lon>&zoom=10`, over the place instead of over the seat, and the
  log says `opened at ..., as the link asked`; the camera is all it moves, so ground the house cannot see is still
  under the fog; Antarctica's sixteen are seen through it while the instruments are open. A new tab would take the player over from any other
  game tab. *Back* loads the page again rather than showing it as it was left: a page the browser restores from its
  back/forward cache has lost its connection, and would sit *closed* drawing nothing. The `found a house here` button in it sends a
  real command and is how to make an event happen on purpose. The `restart` button beside `copy` forgets
  this browser's player and reloads, so the opening can be tried again from nothing; the house the old
  player founded stays in the world, because events are never deleted. `wipe` beside it empties the world
  for everyone connected to it, and every window reloads and arrives anew. See `docs/adr/0036`.
  `save` asks for a name, `completed-many-quests`, and writes every event of this tree's world to
  `E:/Code/Villages/.saves/<name>.jsonl`, beside the shared `.git`, so every tree sees it; the log says
  `saved the world as <name>: <n> events`, and a name taken, or not lower-case letters, digits and single hyphens, is
  refused as `error saveRefused`. Under the buttons, the dropdown lists every save, every tree's, newest first, with
  when it was made and how many events it holds, and `load` gives this tree's world the one picked: every window
  arrives anew on it, this one as the player who made it. The clock runs on, so a save a week old wakes seven
  months on. A save this code cannot read is listed and cannot be picked. Under it, the players of the world, every
  one with a house, by the house's name, this browser's marked `you`: `switch` makes this browser the one picked and
  reloads as them, which is how to look at a world from a seeded house's seat. See decision record 0101.
  What the log says is what was worth saying, through `note(area, message)` in `apps/web/src/log/log.ts`:
  moving the camera about writes nothing, and the cells a move brought back are counted and said in one line
  only when they carried something. `window.villagesPainterly()` gives the paint counters from a console.
- The player's own levers: the bar along the bottom of the house card, in the corner. All six places
  stand empty: the eye that was the first of them went on 2026-10-15, when the player's own marks came to be drawn
  at every zoom without it (decision record 0096).
- The fog of war: the `FoW` box in the Debug map section's bar, there folded or open, ticked at every page
  load, and unticking it turns the fog off for that window. A house sees from **vision points** - each structure it holds, as far as its
  type and level see, its castle 34 km at first, and each key figure standing on the map, 34 km around them - and the server works them out and sends them as `yourSight`;
  the log says what gives vision under `sight`. `give vision here`, in the Debug map section, gives the house a circle
  where the camera is looking until its `take it away` is pressed; both are real commands. The fog covers the
  world and not the signs: every icon, the offered seats and whatever stands in vision are drawn over it. Unknown ground is under a dark haze, revealed ground has its
  colour taken out, trees and castles too, and vision is clear. With no house the whole world is hazed. The server holds back what the fog hides:
  a player is sent the houses on revealed ground as they were when the fog hid it, dated, and the people in vision, and their own wherever they are,
  and the scenery's stands only where they touch revealed ground, tile by tile under the held cells, which
  the log counts under `stands`; the trees are grown from those and nothing else, so without the game server
  nothing grows. The server reads them from `world/stands/`, where the generator writes them and nothing serves
  them, `villages.stands` to point it elsewhere, for the master the page names in `hello`. `FoW` unticked lifts all of it, for that window. The edge has surface tension: circles closer than
  about 56 km are seen across and notches are rounded off, drawn and held back alike, `Vision.SURFACE_TENSION`.
  No tree grows on unknown ground, so with the fog on and no house the world is bare under the haze. Close
  in, the haze's bands of mist swell and drift, on a clock that runs only while some of it is on the screen.
  **Every number of the fog's look** - the haze, the mist, the fade - is in `apps/web/src/fog/look.ts`.
  See `docs/adr/0061`, `0062`, `0063`, `0064` and `docs/plans/fog-of-war.md`.
- Looking at a whole world at once: `see everything`, in the debug panel's World bar beside `seed 20`.
  Everything on the map reaches a page only from zoom 7 in, and below 7.5 only your own marks are drawn (0096).
  This sends every zoom to this connection; it does not bring anyone else's buildings out past 7.5, where nothing
  but marks is drawn.
  Adam's switch, not a player's.
- Areas, in the same panel: `draw an area` arms the next drag on the map, and dragging paints one. The
  ends join themselves and escape stops. Click an area to select it, which makes its line pulse and lists
  how many diamonds of each terrain it encloses, and how many houses have their seat inside it; `shade`, `recount` and `delete` are beside it. The
  boundary steps along the ground's own diamonds - one world unit each, turned as far as the ground is -
  rather than through them, so at z10 it lies along the diamonds the terrain is drawn in and tips with
  them; they are crisp on `vivid` and `plate`, softened by the medium on the rest. `raw` draws the tiles
  square whatever the grid is, so press `squares` in the Camera section to line an area up with it. Areas
  live only in the browser and a reload forgets them. See `docs/adr/0032`, `0066` and experiment `0002`.
- Key figures, in the same panel: the **Characters** section. `add a key figure` rolls a newcomer and
  the house takes them in, nine at most, and it is the only way a character comes into the world. Each
  figure has `up` and `down` for every stat, `ten years older`, `ten years younger`, `another portrait`,
  `put them here` (where the camera is looking; drawn from about camera zoom 8.5 in), `take off the
  map` and `kill`, every one a real command: the asking and the answer are lines of the log under
  `characters`, and what changed is a third; a move is a fourth, under `cells`, naming who arrived. The stat levers stay pressable at one and at twenty, so a
  refusal is seen rather than guessed. The events are at `/admin/inspect-events-log`. See `docs/adr/0055`.
- Dialogues, in the same panel: the **Dialogues** section, below Characters. `offer a dialogue` offers the
  house the dialogue chosen beside it, by its name in `world/catalogues/dialogues/`, a file each, which the list
  follows as files come and go. The first is the letter from the coast, spoken by the house's first key figure and
  a messenger, ending in a dialogue choice of three: *accept* spends forty wealth and is paid a hundred, *ask* is
  paid in influence, and *refuse* does nothing, each option showing what it will do a different way - whole,
  hidden, or not at all. One spoken by a key figure is refused a house that has none. Each is read by the game
  server as it is offered, so a line changed in its file, by hand or from **`/admin/inspect-dialogues`**, is the
  next offer's; one already offered keeps the words it was offered with. The page names every dialogue across its
  top, each an address of its own, `/admin/inspect-dialogues/letter`, and draws the chosen one as its tree - a card a
  line, who says it and what, the two parties in two colours, an ending edged heavier, a choice's options under it on
  dashed leads - beside the line chosen in it: its words, wrapping, and what it grants and spends, changed in place,
  and what it reveals, shows and leads to said. The title, the scene and the speakers' names are above. A line
  added or a lead moved is the whole file's, at the foot.
  **That one lever is all the debug panel does for dialogues**, Adam's word on 2026-10-01: it stands in for
  the world, which offers none yet, and reading, answering and seeing how one ended are the player's, in the
  pane - never levers in the panel. The first option costs forty wealth, which the Resources section's `give`
  puts there, and `kill` on the speaker in Characters loses every open dialogue they speak in. The page names
  the dialogue and sends none of its words, and a requirement is never sent to a page. The asking and the
  answer are lines of the log under `dialogues`, and so is where each dialogue stands whenever one changes,
  as far as the player may know it; the dialogue itself, whole, is at `/admin/inspect-events-log`. In the game,
  the house's first dialogue puts up the **dialogues** pane, a column down the right of the spread with its
  three sizes - put away, a strip along the bottom; opened out, it puts the corner back to its normal size,
  and opening the corner out puts it back, a line of the log under `bay` saying both - and a pane navigation
  lists on a phone; it lists the dialogues waiting and finished, a lapsed
  one saying why, and pressing one opens it to be read and played, over its scene, the picture from
  `world/scenes/` filling the pane: *continue*, a word in the middle of its foot, shows a line at a time
  and takes the step past the last, the options are at the end of the feed, and
  the list mark goes back. What a line gave or cost is written under it, a lapsed one ends on its closing
  line, and an option the house cannot pay for says so under the options. A line can show something as it
  is reached while playing, once in the life of the page: the sample's rider takes the camera to the seat,
  the purse paid opens the house's window and the good word the figure's - beside the column on a desktop,
  and on a phone in the other bay with the two at half each; each is a line of the log under `dialogues`.
  `offer a dialogue` opens the pane: from its strip in the spread, and on a phone into the bay the map is
  not in, at half. See `docs/adr/0071`, `0069` and `0070`, and `docs/plans/character-dialogue.md`.
- Quests, in the same panel: the **Quests** section, below Dialogues. `offer a quest` offers the house the
  quest chosen beside it, by its name in `world/catalogues/quests/`, a file each naming the dialogues of
  `dialogues/` it offers; the first is *the abbot of the isle*. It is off, saying why on hover, while there is no
  house. The game server reads a quest and its dialogues as it is offered, so what was saved, by hand or from
  **`/admin/inspect-quests`**, is the next offer's, and one offered already keeps its road; it refuses, as it takes
  the files on, a quest naming a dialogue or a type of structure there is not. The page names every quest across
  its top, each an address of its own, `/admin/inspect-quests/abbot`, and draws the chosen one as its road - a card a
  node, a dialogue's cool, a reward's warm, a question mark's dashed, one shown ahead ringed, a fork's roads named by
  the endings that take them - beside the node chosen on it: its title, its two marks, and its objectives' and
  reward's numbers changed in place, a dialogue node linking to the dialogue's own page. It opens with a
  dialogue at the gate, which arrives in the **dialogues** pane as any dialogue does and opens it: the abbot asks
  what the house holds dearest, and *its faith* takes the road of a pledge of thirty piety, *its coffers* the road of
  a castle held on an island and sixty wealth delivered, the other road lost. **That one lever is all the debug
  panel does for quests**: it stands in for the world, which offers none yet, and meeting, collecting and seeing how
  one ended are the player's. The page names the quest and sends none of its words. The asking and the answer are
  lines of the log under `quests`; the quest itself, whole, and every move in it are at `/admin/inspect-events-log`,
  the offer and the abbot's dialogue in one story, and finishing the dialogue writes the move past the gate and
  the road lost in the story of its last step. The page is sent the quest as its walk draws it, and the log under `quests`
  says where each stands - *stands at "A light on the water", 1 of 2 ticked; lost "A gift to the mission"* - whenever one
  changes. On the bad road, the Structures section's *raise here* with a castle on an island and *take control of
  this building* ticks *Hold a castle on an island* a moment later, in the story of the taking; the log says *1 of 2
  ticked*. In the game the quest opens in the **quests** tab of the column down the right, beside the dialogues -
  the tab bar is two marks, the speech bubble and a little map of seals - on its map over its scene: the abbot lit,
  two question marks below, a question mark half-way down and the blessing at the foot. The list behind its mark
  holds every quest, open first. It is played there: the abbot's node pressed opens his conversation on the
  dialogues' tab, which ends, once finished, in a button with the quest's name and the needle that turns back to its
  map; the gift's or the light's card under the map has *Pledge* or *Deliver*, a mark each, greyed with
  what the house has free while it cannot pay, which the Resources section's *give* mends; and the blessing's card
  has *Collect*. Each press is a line of the log under `quests`. A castle for the bad road must stand on land the
  server counts as an island on the master - the British island there is at 54.8, -1.0, and 54.0, -2.0 is shallow
  sea - which `?at=54.8,-1.0&zoom=8` and the Structures section's *raise here*, yours, do in a moment.
  See `docs/adr/0096` and `docs/plans/quests.md`.
- The choice roll, the player's own: **Take action**, in the bottom middle of the spread once there is a
  house, put away at rest to a **chip** in the middle of the bottom row with what a roll costs beside it - a
  press anywhere on the chip but the button opens the pane out - ten wealth, and a house is founded
  with fifty. Greyed, saying why, while the house has less than that free or a command is waiting on its
  answer. Pressed, it rolls: the pane opens out over everything, the rest of the stage dimmed under a **veil**
  that puts it away when pressed, and plays the roll as
  a report card - the omens slam into a list a third of a second apart, and under a divider the hand of three
  options of one rarity pops in along the bottom, each a card edged and named in its rarity, saying what it
  gives, with the marks of the omens that brought it. A press on the list lands the rest of the omens at once.
  On a desktop it is put away or opened out and nothing between, and the corner and the dialogues never move
  for it; on a phone the list and the options are one under another and the pane scrolls. Taking an option
  gives it, and the pane goes back to its chip. *Gossip from the kitchens*, a common, is a conversation rather than a
  resource: taking it offers a dialogue about the nearest other house within 1500 km, which opens in the
  dialogues pane, and with no house that near it is never dealt. What can be dealt, and from which pools, is
  `world/catalogues/fate.json`, and what a roll costs and each rarity grants is the balance's: both the game
  server takes on while it runs, the next roll dealing from what was saved. **`/admin/inspect-rolls`** shows it:
  the pools and the omen keys each opens on, the actions a rarity at a time with the balance's odds and grants
  beside them, every pattern, pool list, word and number of gossip changed in place and saved through the game
  server; and **a deal**, omens picked from those a roll often reads or typed by their key, showing which pools
  they open and each action's weight and share of the first draw, by the engine's own arithmetic. A hand already pending when the page loads is drawn as it ends. A hand cannot be rolled over while it waits. The asking and the answer are lines of the log under
  `roll`, and the hand under `choice`, with its rarity and how many omens it was rolled from. The **Choice
  roll** section of the debug panel, below Dialogues, looks into it: the hand's omens - the house's holdings,
  *Weak house*, *Pious*, what rose since the last roll, *Missing wealth* when an open dialogue waits on a cost
  the house cannot pay, the windows open on houses it has revealed and on people it sees or holds, and on water
  it has revealed, *Inspecting the Vistula*, *Inspecting Lake Maeler*, the dialogue being read, the key figure open, where the view is centred - *Coast*, *River* within 400 km, *Forest*,
  *Mountains*, *Fields*, *Grassland*, *Desert*, *Marsh* or *Ice* where it is a sixth of the revealed land or
  more, *Open sea*, *House &lt;name&gt;* for houses standing in a circle of 150 km or less, and *Unknown* where the
  fog covers it all, read by the game server off the ground map of the master the page draws; where its names
  are carried, the river and the open sea by name, *The Vistula*, *The Baltic Sea*, and *Near &lt;town&gt;* for
  the towns of 1790 in a circle of 150 km or less, at most two, on revealed ground - and the season -
  with their kind and,
  on hover, their key; what the last roll drew from, which the player never sees - the pools it opened and
  every action that could have been dealt, with its weight - and whether the throw or the lever chose its
  rarity; the odds, 70, 22, 7 and 1 in a hundred. Its one lever, `next roll`, makes the next roll `common`,
  `uncommon`, `rare` or `legendary` whatever the throw, or `the throw` again: it stands in for the world's
  luck, not for the player. What a roll drew from is sent only while the instruments are open. See
  `docs/adr/0083` and `docs/plans/choice-roll.md`.
- Water, the player's own: a click on a river, a lake or the sea on the map, zoomed in to 6 or closer, opens an
  **inspect window** on it, marked with two waves for a river, a shore for a lake and an anchor for the sea: its
  name in English - the one of 1790 where the review chose it, with today's under it - or *A river*, *A lake* or
  *A sea* where nothing named is close enough to be the water painted there, and *show it on the map*, back to
  where it was clicked. A click a house, a person or an area took is theirs. The page asks the game server, which
  answers from the ground map and the names of the master the page draws, and only on ground the house has
  revealed: under the fog nothing opens. The ground is read in cells some eighteen kilometres across, so a click
  on a shore can name the water beside it: a lake is the one whose shores enclose the click, a cell mostly sea is
  the sea, and otherwise a river comes before a lake and a lake before the sea. Two clicks on the Vistula are one
  window. Under the name of a great river, lake or sea is a line or two about it, as an English reader of 1790
  might be told it, which the server sends from `world/names/about.json`. A faint crackle of gold, three fronts
  close together, runs slowly out from the click along the water it named, never over the land: a river along its
  whole course, every piece under its name joined and its painting's breaks leapt, a lake within its shores, a
  nameless river or lake all the water joined to the click, the sea about the click; only on revealed ground, from
  the course the server sends cut to the fog. Every answer is a line of the log under
  `inspect` - `river, the Vistula (Wisła)`, `sea, the German
  Ocean (North Sea today)`, *a lake nobody has named*, *no water there* or *under the fog*. Take action with a
  window on water open reads it as an omen, *Inspecting the Vistula*: the page says where the window was opened and
  the server says what is there, on ground the house has revealed. See `docs/adr/0087`.
- The structures there can be: **`/admin/inspect-structures`**, a page of its own as the events' types have, is every type
  in `world/catalogues/structures.json` as the page reads it, a row a type - what it gives its holder a month at
  each level, how far it sees and how significant it is, its slots and what makes each count, its zone, how tall
  it stands on the map and its **footprint**, the side of the square of the ground's diamonds its base covers, with
  **each culture's picture standing on its footprint** as the camera sees them closest in, the diamonds under it and
  the square's outline dashed over it, at the level the buttons over the table choose; and what each culture calls
  it, **with the type's pin beside its name and its picture in each culture beside that culture's word**, as
  `world:structures` cut them; a placeholder is ringed in dashes, and a picture saved over one
  is there as soon as the dev server has cut it again. It reads the file again whenever it changes on disk; one it cannot read is said in
  place of the table, naming the type and the field. **Every number and word in a cell can be changed there**: point
  at it, type - a level at a time as `34 / 40 / 48` - and leave it or press Enter, and it is marked; the bar at the
  top says how many changes the page holds and saves them, or discards them, and says what the game server runs on.
  A save goes through the game server, which writes the file in its one form and takes it on at once, so a holder's
  income moves with a yield; refused, the bar says why. What has no cell - a slot, a type added - is changed in **the
  whole file**, folded at the foot. See `docs/plans/structures.md` and
  `docs/plans/catalogues.md`.
- Every type standing at once: **Antarctica**. While the instruments are open the game server raises one structure of
  every type when it starts, held by nobody, at its first level, four to a row about six kilometres apart on the
  island off the tip of the Antarctic Peninsula, about 63.25 south and 56.03 west - the Antarctic castle at the
  north-west corner. Each is a `villages.structure.raised.v1` in the events log, sixteen of them at every start,
  and an id worked out from its type means a server starting over a kept world raises none twice; a world kept
  from before they moved keeps them where they were first raised. A wipe takes them with everything else, and the
  Structures section's **raise Antarctica again** puts back whichever are gone. All sixteen are on the screen at
  once from zoom 9 over the island, and every window sees them through the fog while the instruments are open, as
  if they stood in its vision, what their slots hold included; with *see everything* on, below the zoom each
  one's significance is drawn from too; **on the map** under each one's `raised` in the events log opens the game
  over it.
  The map mark in the Structures bar, there folded or open, flies the camera to the island at zoom 9.
- Raising one where you look: the **Structures** section of the debug panel, after Resources. A type from the
  catalogue, a level it has, **yours** or **nobody's**, and **raise here** raises one at the middle of the map,
  named *a new mill* and the like; **raise Antarctica again** is the sixteen. Each is a command said in the log
  under `structures` with its answer, and a raising is a `villages.structure.raised.v1` in the events log. Yours
  without a house is refused `noSuchHouse`; a type the catalogue lacks would be `noSuchType`. Adam's levers,
  standing in for a house building one; closed with the other instruments (0076). The log's `cells` lines count
  the structures each burst of snapshots brought, and a batch names one raised in a cell the page holds, `a new
  mill raised`. What is sent is each one's face as the fog allows it: today's where the house sees, the one it
  last saw on revealed ground, nothing on unknown ground - but for Antarctica's sixteen, which every window sees
  through the fog while the instruments are open.
- Taking one: **take control of this building**, under the raising levers, hands the structure whose window was
  opened last to your house; the line under it names that building, or asks for a structure's window first. One
  `villages.structure.changedHands.v1` in the events log, from its holder to your house, and a moment after, in
  the same story, your house's `gainedVision` from it at the catalogue's `sightKm` for its type and level; the
  house it was taken from gets `lostVision`. The fog lifts round it, and the log says `taking control of the
  Antarctic mill` with its answer, the batch that follows `the Antarctic mill changed, held by Ravenscar`, and the
  `sight` line names it: `Ravenscar Castle (34 km) and the Antarctic mill (6 km) give vision`. On the map it flies your
  pennant, and its window says it is held by your house, its mark named *Your holding*. What it pays comes with
  its own step. Yours already is refused `sameHolder`, and with no house `noSuchHouse`. One raised **yours** sees
  the same way from the moment it is raised. Standing in for a story handing one over or a house
  taking it; closed with the instruments.
- The ground worn bare under the buildings: at the foot of the **Structures** section, **worn ground under the
  buildings** draws every building's yard, the trees cleared off it, or leaves the painted ground and the trees as
  before, **how much of the earth covers the
  paint** is a slider from none to all of it, **how near two buildings stand for a path to join them** is the paths'
  reach in world units, nought for none, **the earth** is its colour, and **as it was** puts them all back. The line
  under them says what is drawn: `85% earth, #806040; paths between buildings within 12 units`. The log says under
  `ground` how many diamonds are worn under how many buildings and how many paths join them. A path is walked only
  once the flat tiles under it have come, keeps off open water, and is worn only on ground the house has revealed. They are the look's, Adam's to settle by eye at zoom 9 or 10
  over a few buildings, and are not kept across a reload. The yards come in at 7.5 with the buildings' pictures, and
  keep to the fog as the buildings do: Antarctica's sixteen show theirs with the fog off. Every building casts its
  shadow on its yard, from the base to the left, cut with its picture by `world:structures`; how dark is the Scenery
  section's shadows lever, the trees' and the buildings' alike, and a picture drawn in code casts none.
- A house's seat: founding raises its castle, *Ravenscar Castle*, where the house was founded, held by it, and names
  it the seat, as the founding's own story in the events log: `founded`, `raised`, `namedSeat`, then the house's
  `gainedVision` from the castle. A house is not drawn on the map at all: its structures are, the castle that is its
  seat among them, flying the house's pennant; the game server sends a page the structures and people standing in
  the squares of the map it shows and no houses, and a house's own player is sent their house by itself. A click on
  the castle opens its window, *a castle, the seat of Ravenscar*,
  with the house a link away, and a house's window marks its seat on the map. While a castle is marked - its window
  or its house's the newest open - its **influence zone** is drawn about it, the ragged gold ground every seat used
  to have at all times, its reach the catalogue's `zone`; a type without one draws none. The seat still sees from where the
  house was founded too, while it is the seat. When the castle changes hands or falls, the house loses it:
  `villages.house.lostSeat.v1` in the story of what took it, the castle's window no longer saying whose seat it is,
  and its sight from there ended, the ground it saw revealed; a house without a seat is drawn nowhere, and its
  window opens from any structure's link to it. A house's window gives where it was founded as *Founded at*.
- Raising and lowering its level: **level up** and **level down**, beside *take control of this building*, on the
  structure whose window was opened last. Each writes `villages.structure.levelChanged.v1`: the structure is drawn
  larger or smaller, its window says the new level, and its holder sees as far as that level sees - the new sight
  given before the old is taken, two lines in the log's `sight`. Past either end of its levels, or for a ruin, it is
  refused (`invalidLevel`, `isARuin`). The log says it under `arrivals`: `the Antarctic mill changed: level 2,
  held by Ravenscar`.
- What a holding pays: every structure a house holds pays it what the catalogue says its type yields a month at
  its level - a castle at level 1 three domain - as `villages.house.incomeChanged.v1` on the house, under the
  structure's own source, a moment after it is raised for the house, taken, levelled or rebuilt; handed away or
  fallen, the same event with no rates. A world month is a real day (0053), so three a month is one every eight
  hours, and the house status counts up between. The debug panel's **Resources** section says each rate beside
  its figure, `+3 a month`, and the log says it under `income` whenever it changes: `paid Domain +3 a month`.
- Filling its slots: under the level and ruin levers, a slot of the open structure's type, someone to put in it -
  one of your key figures, or anyone standing in view - and **put them in**, **put something in** - a thing the
  slot is for, a garrison of forty, bushels of grain, a relic, or a chest - and **empty a place**, which takes out
  what was put in last. Each writes `villages.structure.slotFilled.v1` or `slotEmptied.v1`, in the events log; a
  person already in another slot is taken out of it first, in the same story. A full slot is refused `slotFull`,
  the same person twice `alreadyInSlot`, an empty one emptied `notInSlot`, and a ruin filled `isARuin`; a level is
  not lowered under what a slot holds (`invalidLevel`).
- What is in its slots: the structure's window, and a holding's details in the Holdings tab, draw a row of sockets
  for each slot under its facts - its name, *2 of 3*, a portrait for a person, an item with how many, an empty frame
  for a place left. Its holder sees into every slot; another house that sees it now sees into the slots the catalogue
  calls public and a question in every place of the rest, *? of 2*; out of sight, or on a day the scrubber has gone
  back to, the window draws none, because what is in a slot is never shown as last seen. With the fog lifted, every
  slot is seen into. What fills them counts toward what it pays its holder: a needed slot empty, a palace's throne,
  and the type gives nothing of its own; a person in a slot that scales, a cathedral's bishop, scales it by their
  stat over ten; every filled place of a slot that adds adds, a prisoner in the cells; and an item where an item's
  own is taken yields its own, a relic in the reliquary (*put something in* puts one there with piety +2 a month).
  The house is paid it, `incomeChanged`, a moment after the slot changes, and the window and the tab say what the
  holder is paid; anybody else reads the type's at its level. A slot filled or emptied redraws them at once, and a window on one of your own holdings reads
  your holdings wherever the camera is, as one on a key figure reads your key figures.
- Ruining one and raising it again: **ruin it** and **rebuild it**, beside *take control of this building*, on the
  structure whose window was opened last. *Ruin it* writes `villages.structure.ruined.v1`, by fire: a ruin holds
  nobody, its holder's sight from it is taken back, and it is drawn as a ruin - the stump of a tower and a broken
  wall - with no pennant, its window saying *the ruin of a mill*, and the log `the Antarctic mill lies in ruin`.
  A ruin cannot be taken or ruined again (`isARuin`). *Rebuild it* writes `villages.structure.rebuilt.v1`, as
  what it was, at level 1, for nobody; only a ruin can be rebuilt (`notARuin`).
- What your house holds: the **Holdings** tab of the corner, beside the key figures, its mark the tower. A list,
  the seat first and the rest in the order the house came to hold them, each row the structure's placeholder
  picture, its name, and what it is and yields - *a castle, the seat of Ravenscar, level 1; Domain +3 a month*;
  with none it says that holdings
  will be shown here. A row pressed opens its details in the tab: the window's words, the map's mark to fly to it,
  and the list mark beside the name to go back. The game server sends it on hello and whenever a structure is
  raised for the house, taken by it or handed away (`yourHoldings`, private, through no fog), and the log says it
  under `holdings`: `2 holdings: Ravenscar Castle (seat), the Antarctic mill`.
- A structure on the map: its type's placeholder picture, drawn in code (`sprites/structurePictures.ts`) in its
  own colours and in the look of the culture under it, read off the master's culture map: European as drawn,
  Islamic in plaster, sandstone and green tile under a dome, East Asian in dark tile under a flared roof, African
  in mud under a cone of thatch (`sprites/cultureStyles.ts`), a ruin too; as tall on the ground as `groundHeight` in the catalogue says at its level, standing on the front corner of its base on the corner of the ground's diamonds nearest its place, standing in its yard of worn earth - the log says under `ground` how many diamonds of worked ground lie under how many buildings (`docs/plans/worked-ground.md`, decision record 0105) - and, when your house
  controls it, far out its type's pin from `world/sprites/marks/structures/`, at the size of a word, from 7.5, where
  your house's people become their busts too; its own picture stands in for the pin until the atlas is read. **A mark
  never fades**: your holdings and key figures reach the page at every zoom, and out to the whole world they are only
  gathered into fewer, larger crowds. Anyone else's building or person has no mark: it shrinks with the map until it
  fades at 7.5, with the scenery: from 7.5 out the map is marks and nothing else. One a house holds flies a pennant in the house's
  field, over the building close in and on the pin's head far out; nobody's flies none. A type with no picture is a
  plain house. It is drawn from zoom 7.5 like everything on the map, and under the fog outside vision.
  Far out, marks whose pictures would overlap are a **crowd**, drawn as the most significant of them wearing a
  gold "+N" for how many more it stands for (`sprites/markGroups.ts`); the debug log says, under `marks`, how many
  crowds there are when that changes. A click on the "+N" opens the crowd's card over it (`sprites/CrowdCard.tsx`,
  the library's `PinGroup`), every mark of it with its name, most significant first; a press on one opens its
  window, and the card shuts on Escape, a press elsewhere or the camera moving. **Ctrl-click**, or Cmd-click on a
  Mac, on a mark on the map or in the card takes the camera to it at zoom 9 instead. A click on one opens its **inspect window**,
  marked with a tower: its name, *a mill* or *an abbey* in the catalogue's word for the culture it stands in - a
  castle on Islamic ground is *a kasbah*, on African *a stockade* - who holds it with a way
  to that house, its level of the type's highest, what it yields whoever holds it a month and how far they see
  from it - *Yields Domain +3 a month*, *Sees 34 km around*, the catalogue's for its type at its level, the same
  numbers the game server pays and gives sight by, and *nothing* for a ruin - where it stands, and *show it on the
  map*; its mark is named
  *Your holding* when your house holds it, and beside the name how fresh it is, as a house's window says. A window
  opened on one the camera has left asks the game server after it, and ground the house has never revealed
  answers nothing.
  `window.villagesSprites()` in the console lists them as `structure:<id>`, with `pennant` true for one flying it.

## Adam's folders and the tools that cut them

Every world tool below takes `-- --into <folder>`, and then writes what it would have written in the repository
under that folder instead, laid out the same way: how the world cache has a tool make a new entry while the tree
goes on serving the world it has. Run without it in a tree that borrowed its world, a tool first takes back the
part it makes - the borrowed names go, the world cache's files stay - so what it writes is the tree's own. It
will not write where a junction stands above its folder, which is another checkout's. See decision record 0095.

**The world cache** is how the world is made in a tree without making it again: `npm run world:ready --prefix
frontend` makes a master's world current, each of its ten **world steps** - import, tile, styles, flow, sprites,
ground, origin, names, culture, height - borrowed from the shelf when it has the entry this tree's inputs name, and
made, filed and borrowed when nobody has made it yet. The shelf is `E:\Code\Villages\.git\world-cache\`, one for
the machine; a borrowed folder is hard links to the shelf's files, a few seconds for a whole master, and the few
loose files are copies. It prints a line a step: *current*, *borrowed from the world cache, made in* the tree that
made it with the last thing its tool said, or the tool's own output as it makes one, with the reason
(*world/palette.json changed*). A borrowed folder whose new files another program still has open, a virus scanner or
the Warp terminal reading them, cannot be moved into place, so it waits up to three minutes, names the programs holding
it as Windows reports them, and says how long it waited; a borrow that fails leaves `<folder>.borrowing-<pid>` beside
it, which the next run clears. `-- terrain2` for another master, `-- --only origin` for a step and every step made
from it, `-- --force` to make them again even when the shelf has them, `-- --why` to be told where each step stands
and what moved without making anything. What a tree borrowed is written in `public/world/borrowed.json`. A master
nobody has made costs its steps once, about nine minutes; every tree after it, seconds. See
`docs/plans/world-cache.md`. `npm run world:prune --prefix frontend` says which entries on the shelf no tree uses
any more - none a tree borrows, none a tree's record names, none being made or lent, none made in the last week -
and `-- --drop` takes them off; by hand only.

- The towns, rivers, lakes and seas of 1790: `world/names/1790.json`, one line a thing, keyed as the names are -
  a town by its Wikidata id, a river, a lake or a sea by its Wikidata id or Natural Earth's file, number and
  name: the name an English writer of 1790 would have used, or `null` if it was not there then; today's name,
  to read by; and why they differ. An agent's review, Adam's to correct; a town not in it is not carried, a
  river, lake or sea not in it keeps today's English name - a lake written as English writes one, Lake
  Constance where the source says only Constance - and a canal or a reservoir is carried only where it is
  listed with a name. Its `added` part holds the towns of 1790 Natural Earth lacks - Mocha, Seringapatam - each
  with where it stood on Earth as `[longitude, latitude]`. `world:names` reads it, and a change shows on the next
  click under the Origin renderer and on the Info map. See `docs/plans/real-world-names.md`.
- What is said of the rivers, lakes and seas: `world/names/about.json`, one line a thing, under the name the
  world gives it and the ids of every piece of it carried - two rivers of one name, the Dwinas of Riga and
  Archangel, are two lines. A line or two each, as an English reader of 1790 might be told it and nothing after
  the first of January 1790, for the rivers Natural Earth ranks highest and those the review named, the great
  lakes and the seas. An agent's first draft, Adam's to correct. `world:names` gives every carried piece its
  line and says how many it gave and which of the file's ids its world lacks; the window on the water shows it,
  from the server. See `docs/adr/0087`.

- What grows where: `world/biomes.json`, hand-edited, one entry a kind and one a biome. What reads it is
  `npm run world:sprites --prefix frontend`, which works out a biome for every sixteen world units and
  where the scenery clumps, and writes a **sprite map**: the biomes beside the cut tiles, the stands into
  `world/stands/<master>/`, where only the game server and the stills read them - about five megabytes and
  half a minute a master. A master furnished before 2026-09-29 has its stands in the old place and no woods
  until it is furnished again, which the Debug map section says. It takes a master's name as its first argument (`-- terrain2`). **A master
  with no sprite map draws no scenery**, which is the rule rather than a fault. The Scenery section of
  the debug panel says what the sprite map asked for and what the browser did with it. The **Debug map**
  section has a `furnish it again` button beside `cut it`, and `cut it` furnishes too - a repaint makes
  both stale. The panel also watches `world/biomes.json`'s own mtime, because tuning a look makes every
  sprite map stale without touching a master. See `docs/adr/0054` and
  `docs/plans/biome-sprite-map.md`.
- The catalogues: `world/catalogues/`, the game's content, a file a kind, each with its inspect page under `/admin`,
  which `admin/catalogues.test.ts` holds. The dev server serves every file in it at `/catalogues/<its path>`,
  read again on every ask and sent with the SHA-256 of its bytes, and `/catalogues/` lists them; when one changes
  on disk it tells the page, and the page showing it reads it again. The game server records every version of a
  catalogue it takes on as `catalogueChanged` on the world's own stream, `world`: one for each catalogue as a
  fresh world starts and again after a wipe, none on a restart over the same files, and one more for a file
  changed since; each is in the events log, opening to the whole file and where it changed. It looks at the folder
  twice a second while it runs, so a file saved by hand is taken on within a second of holding still: a retuned
  structure moves every holder's income and sight at once, each `incomeChanged` in the retune's story. A file it
  cannot read is refused, said once in the debug panel's faults and the server's log naming the file and the field,
  and the catalogue in force goes on. An inspect page saves through the game server, as one of the instruments:
  `reviseCatalogue` names the file it read by its fingerprint, and the server refuses it `stale` when the file has
  changed on disk since, `unreadable` with the reason when it will not take it on, and otherwise writes it whole in
  the catalogues' one form - two spaces, plain lists and objects on one line, the rest on one line where it fits in
  120 columns, which is how the files are written by hand - takes it on and answers with the new fingerprint.
  `watchCatalogues` tells a page what the server runs on, and again whenever it takes something on. A released
  server turns all of this off with `villages.catalogues.editable=false`, and closed instruments refuse it.
  See `docs/plans/catalogues.md` and decision record 0097.
- The balance: `world/catalogues/balance.json`, the numbers that belong to no one thing - what a roll costs, how
  many options it deals, the odds of each rarity and what each grants; when the house's and the map's omens are
  read; how small an island is; how old a newcomer can be - each group with a `$comment` saying what its numbers do.
  The game server reads each as it decides something, so a change saved by hand or from **`/admin/inspect-balance`**
  is the next roll's; Take action says the price from the same file. The page shows the file a group at a time,
  with what its numbers do in the file's own words, every number changed in place and saved through the game server
  as the structures' are; it is drawn from the file itself, so a number added there is on the page untold, and odds
  that do not add up to a hundred are said in red before the server refuses them. A founding's fifty wealth is not in it: it is
  folded from the founding rather than written into it, and moving it would rewrite every house's past.
- The names a newcomer can be given: `world/catalogues/character-names.json`, given names by sex and family names,
  every given name with every family name a name a character can have, which the game server checks as it takes the
  file on. A newcomer taken in is named from the file in force, so a name added there, by hand or from
  **`/admin/inspect-character-names`**, can be the next one's. The page shows the three lists, every name in a cell
  of its own, changed in place, emptied to take it out, or typed into the cell at a list's end to add one, and saves
  them through the game server; only the names that differ from the file are marked. Not the world's place names,
  which are `world/names/`.
- What a structure is: `world/catalogues/structures.json`, hand-edited, one entry a type - its words in each culture, and level
  by level how far out it is drawn, how far it sees, its size on the map, the footprint its yard is laid round, and
  what it yields a world month, which is a real day - with its slots and its influence zone if it has one. Nothing cuts it. The game server reads it as
  it starts, and will not start on one it cannot read, saying which type and which field, and takes on a change
  while it runs, as every catalogue; the page reads it through the dev server at `/catalogues/structures.json`, so
  `/admin/inspect-structures` and the game server both show a change at once. Every number in it is a placeholder. See `docs/plans/structures.md`.
- What the ground is, for the game server: `npm run world:ground --prefix frontend` reads a master into its
  **ground map**, `world/ground/<master>/`, a cell every sixteen master pixels each way, each keeping its
  commonest terrain and whether a river, a lake, the sea or a coast is in it: four megabytes and fifteen seconds
  a master, which the quick start makes current with `world:ready`. Only the game server reads it, to work out the map's
  omens of a roll, and it takes a master's name as its first argument (`-- terrain2`). A master repainted
  makes it stale. See `docs/adr/0084`.
- Where the land came from: `npm run world:origin --prefix frontend` works out a master's **origin map**, where on
  Earth every square of 32 master pixels was cut from, against `world/master/terrain-base.png`, which is plain
  Earth (`-- --from <master>` names another). It writes `origin/` beside the master's tiles: the map, sixteen
  megabytes, and `origin.png`, the picture the Origin renderer lays on the world; then it carries Natural Earth's
  named rivers, lakes and peaks from `world/source`, and the towns `world/names/1790.json` says stood in 1790,
  through it into `names.json` beside them, three megabytes,
  and gives every square the named sea and stretch of land it is in or by, in `regions.bin`. The same two files
  go into `world/ground/<master>/` beside the ground map, where only the game server reads them, for the map's
  omens; their shape is held by `contracts/fixtures/names.json` (0087). Canals and reservoirs are left out
  unless the review names them, because nearly all of Natural Earth's were made after 1790.
  `npm run world:names --prefix frontend` carries the names again without working the map out, in under a
  second. Two minutes a master. Cutting a master in the Debug map makes it current, and the quick start does for
  the default master; `world:ready` makes the origin map again whenever the master, `terrain-base.png` or the
  palette changed, and carries the names again, a step of their own, whenever the origin map, Natural Earth,
  `world/names/1790.json` or `about.json` did. The game server reads a master's names again when they are written, without a restart. It prints how much of the land
  is from Earth, invented and copied. Moving land with Nearest Neighbour keeps it traceable; land painted fresh,
  or opened up between pieces, is invented. See `docs/plans/real-world-names.md`.
- The culture each place is built in: `npm run world:culture --prefix frontend` works out a master's **culture
  map** from its origin map and `world/cultures.json`, the places on Earth each tagged European, Islamic, East
  Asian or African, which are Adam's to correct: land that came from Earth takes the culture of the anchor nearest
  where it came from, invented land the culture of the nearest land that came from Earth, sea none. It writes
  `culture/` beside the master's tiles - a byte a square of the origin map, and `culture.png`, the picture the
  **Culture** renderer of the Debug map lays on the world: blue European, green Islamic, red East Asian, ochre
  African - and prints what share of the land is of each. Two seconds a master; `world:ready`, and so the quick start,
  makes it again whenever the origin map or `world/cultures.json` changed. Under the Culture renderer a
  click says in the log, under `culture`, what culture the place is built in. A structure is drawn in the culture
  under it, read from the map when it is drawn, so a repainted master redraws its structures.
- The towns of 1790 in ruins: `npm run world:ruins --prefix frontend` lays every town a master's names carried in
  ruins, as big as `world/ruins.json` says it was, a stand of the `ruins` layer each - its middle, how far its ruins
  reach, the culture they are built in from the culture map, how built-up its core is - into
  `world/stands/<master>/ruins/` for the game server and the stills, and how to read them into the master's
  `sprites/ruins/map.json`, which names no town. It prints how many towns are ruins in each tier and each culture, and
  how many stand in a square of sea, whose culture comes from where they came from on Earth. A second a master;
  `world:ready` makes it again whenever the names, the culture map or `world/ruins.json` changed. `-- --picture`
  draws every town's ruins as rings over the culture map around Paris, Pekin, Grand Cairo, Mexico and London into
  `world/painterly/ruins/`, the built radius solid and the overgrown reach faint; `--around Q84,Q90` picks the towns.
  Nothing draws the ruins yet: see `docs/plans/ruined-cities.md`.
- How high the ground is, for the relief: `npm run world:height --prefix frontend` reads ETOPO 2022's whole world,
  a height every 60 arc-seconds, through the master's origin map, so every point of the master has the height of
  where on Earth it was cut from, and invented land is given ground of the kind the master paints on it, and
  cuts it into Terrarium tiles to zoom 7 in `public/world/masters/<master>/height/`, saved as WebP without loss,
  with `height.json` saying where they reach, which origin map they were fitted through, and the highest point
  they found: on `terrain3_mended_2026-10-03` an invented summit at 33.6 N 80.3 E, 8,616 m, with Everest carried
  4.8 degrees south with its range at 8,000 m, a summit averaged over a cell. 21,845 tiles, 205 MB, two and a
  half minutes, the master read for its painting included. It reads `world/source/etopo/`, and fetches the one file first when it is
  missing, 444 MB once, through `world:fetch-all -- --only etopo`; `--only` fetches any source whose name holds
  the word. In a worktree it is the main checkout's, borrowed a file at a time by hard link rather than fetched
  (0095). The sea is held at nought and the grid is read round the antimeridian. A master with no origin map
  is given plain Earth's height, and it says so. Cutting a master in the Debug map fits it again after the
  origin, and `world:ready` whenever the origin map, the master or ETOPO changed. See decision record 0090.
- A picture of the scenery, without a browser: `npm run world:scenery --prefix frontend` paints five
  places at the zoom the scenery is actually in and stamps every point the sprite map asks for onto
  them, into `world/painterly/<place>-scenery.png`, half a minute for all of them. It prints each one's
  marks, its density against the ceiling, and its biome and kind mix. **They are marks, not
  silhouettes**: the shapes are drawn in Pixi and this is the generator's answer, not the map's. `-- --at
  lng,lat` looks anywhere, `-- --view alps` at one of them, `-- --zoom 10.4` closer, `-- --style flat`
  without the paint, `-- --spacing 0` without the spacing that keeps trees off each other (two, three to
  see more of it). This is what a change to `world/biomes.json` is argued from. The ruins of the towns of 1790 are
  stamped over the scenery wherever `world:ruins` laid them, each piece its footprint in its culture's stone, grey,
  sand, red-brown or ochre, a taller piece darker, and the trees thinned among them - none near a piece, few in a
  town's core - from the same `furnishCell` the browser will run; it prints how many pieces. `-- --city Paris`, or a Wikidata id, `-- --city Q90`, looks at one town.
- Structures' pictures: `world/sprites/structures/` is Adam's folder, one picture a type and a culture and a ruin
  a culture, sixty-eight, every one a placeholder drawn from the map's own shapes until he saves over it
  (`AUTHORING-THE-ART.md` says how). `npm run world:structures --prefix frontend` draws whatever placeholder is
  missing, never over a file that is there, remembering what it drew in that folder's own `placeholders.json` so a
  picture saved over one is known to be his, then crops, scales to 160 tall and packs every picture into `public/art/structures.webp`
  with `structures.json` beside it, and prints how many are painted and how many placeholders. Seconds. The dev
  server runs it as it starts and whenever a picture in the folder is saved, and tells the page, which draws from
  the new atlas at once; the map draws a structure from the atlas where it has its picture and in code where it
  has none, and the log says under `structures` how many pictures it read.
- Critters' pictures: `world/sprites/critters/` is Adam's folder, one strip of frames a kind of critter, and
  `world/critters.json` lists the kinds and how many frames each strip holds (`AUTHORING-THE-ART.md` says how to
  paint one). `npm run world:critters --prefix frontend` draws a placeholder strip for every kind with no picture,
  never over a file that is there, remembering what it drew in that folder's own `placeholders.json`, then takes each
  picture's background away, cuts it into its frames, crops every frame of a kind to the one box that holds them
  all, scales them to 64 tall and packs them into `public/art/critters.webp` with `critters.json` beside it, which
  names each kind's frames in order; a picture it cannot cut is said and left out. Seconds, and nothing written when
  nothing is new. The dev server runs it as it starts and whenever a picture in the folder or `world/critters.json`
  is saved, sends the atlas itself, and tells the pictures' page and the map, which draw the new one at once.
- Sprites: `world/sprites/` is Adam's folder, committed as the master is, and holds every picture drawn on
  the map: `scenery/<kind>` for every kind in `world/biomes.json`, `marks/<name>` for every mark, and
  `structures/` and `critters/`, which have cuts of their own, above. Any PNG, WebP or JPEG, any size, on a
  flat background or a transparent one, or standing on a **plinth** - the block of turf and soil an image
  model draws a thing on, which is lifted off with its paper and its shadow (`src/lift.ts`). **Saving over
  a placeholder replaces it**, and with the dev server running the picture is on the map a few seconds
  later with no reload, because the server cuts the folder again whenever a picture in it is saved and
  tells the page - and only the picture that changed, because every cut is kept in
  `frontend/node_modules/.cache/villages-art`. By hand that is `npm run world:art --prefix frontend`: it
  keys or lifts, trims, stands and shrinks every picture into one atlas in `public/art/`, prints a line a
  sprite, and writes a contact sheet of them at the sizes they are drawn to `world/painterly/art-sheet.png`.
  `-- --placeholders` draws a placeholder for every sprite that has none and never draws over a file that
  is there. **No art, no scenery**, and the dev server cuts the folder again every time it starts, as
  the quick-start does, so a picture saved while nothing was running is not missed: a couple of seconds
  when nothing is new, and then nothing is written and the page is not told. Only the scenery is drawn
  from the folder so far; the marks are placeholders waiting on a decision about house colours. See
  `docs/AUTHORING-THE-ART.md` and `docs/adr/0059`.
- Portraits: `world/portraits/` is Adam's folder, committed as the master is. Upright PNGs, three by
  four and at least 768 wide, each named for whom it suits, `woman-01.png` or `man-01.png`; the name
  without `.png` is the key a character keeps for life. **Saving over a placeholder replaces it and
  saving a new name adds one**, with no list to edit. `npm run world:portraits --prefix frontend` draws
  the cut-paper placeholders, two seconds, and **never overwrites a file that is there**: delete one to
  have its placeholder back. A test holds the folder to these rules. The dev server serves the folder
  at `/portraits/` with no cache, so a picture saved over another is the one drawn on the next reload,
  and the Characters section's `another portrait` picks one from whatever is there. See
  `docs/plans/characters-and-key-figures.md`.
- Scenes: `world/scenes/` is Adam's folder, committed as the portraits are. Any PNG at least 1024 on its
  shorter side, named for the scene a dialogue names, `harbour.png`: it fills the conversation's pane,
  cropped to the pane's shape - a tall slice of it in the column on a desktop - so what matters in a picture
  is best near its middle, and one an image model hands back needs no cropping. **Saving over a placeholder
  replaces it and saving a new name adds one.** `npm run world:scenes --prefix frontend` draws a cut-paper
  placeholder for every scene the server's sample dialogues name, in a second, and **never overwrites a file
  that is there**. A test holds the folder to these rules, and the dev server serves it at `/scenes/` with
  no cache, by the same code that serves the portraits. See `docs/plans/character-dialogue.md`.
- The styles live in `world/painterly.json`. A group in one may carry a `handOver`, which is where its
  treatment gives way to the scenery standing on the same ground: whole far out, mostly gone by the zoom
  the trees are all in, keeping a third of itself so a wood is not bare between them. It is the far end
  of 0051's handoff, named as unfinished in 0006 and 0052 and done in 0054.
  `npm run world:paint --prefix frontend` paints every view in
  every style into `world/painterly/`, flat once and then once per style, and writes the runtime copy the
  app reads. `-- --view alps`, `-- --style woodblock` for one of them; `-- --config-only` writes just the
  runtime copy, in a second, which is all the app needs after a style edit.
- Interface art: `world/ui/` is Adam's folder, committed as the master is, a folder a kind - `borders`,
  `fills`, `embellishments`, `medallions`, `marks`, `controls`, `dividers` - and **every picture in it is painted at
  four times the size it is shown**. A border is a whole framed box with a `<name>.json` beside it saying
  where its four cuts go, in the picture's own pixels, and so is a button's face that stretches to its
  words; a face's hovered, pressed and disabled states are light and shade over it unless painted as
  `<name>-hover` and the like. **Saving over a placeholder replaces it**, and with
  the dev server running the picture is in the Pictures section of `/admin/inspect-ui-components` a
  moment later, with no reload, because the server cuts the folder again whenever a picture or a border's
  file in it is saved, and at every start. By hand that is `npm run world:ui --prefix frontend`: it keys,
  cuts every picture at 1x, 2x and 3x into `public/ui/` with a list beside them, prints a line a picture
  with what each weighs, and ends with the whole against a budget of two megabytes at 2x. `-- --placeholders`
  makes the agent's placeholders for whatever is missing, cut from `world/ui/moodboard.webp` or drawn, and
  never writes over a file that is there. A frame that was not painted as a border - an image model's nine
  tiles with lines between them, a frame painted whole, a framed box on stone - is made into one by
  `node nine-slice.ts <picture> --name <name>` in `scripts/`, which writes the border, its file of cuts and
  a recipe to make it again into the folder it is run in, and says where; `--look <picture>` says how it
  would cut it first. The nine-slice skill is how a job is done.
  See `docs/AUTHORING-THE-ART.md` and decision record 0068.

## The component library

- The component library, shown: **`/admin/inspect-ui-components`** on this tree's dev server, and nothing
  else needs to be running - no game server, no map. Every component in every variant and state, with
  switches along the top to put them on night or on parchment, to narrow the sheet to a phone's 390
  pixels, to show a container's layers - each embellishment's box dashed, where its words start
  dotted - and to mark every word too faint to read against what is behind it, counted at the top, and
  the screen's density beside them. A section not built yet says which step of
  `docs/plans/ui-component-library.md` brings it. What a component is made of and how to add one is
  `docs/UI-COMPONENTS.md`; see decision record 0068.

## The inspect views

- Every page beside the game is listed at **`/admin`** on this tree's dev server: what each is for, what it
  needs running, and the game itself. Each of them has a way back to it at the top, and the debug panel's
  World section links it. A new page beside the game is one entry in `apps/web/src/admin/inspectViews.ts`, its
  `import()` with it, which is all `main.tsx` routes by, and it stands in the frame every page shares,
  `admin/frame/InspectPage.tsx`: the bar with the page's name, what it keeps there, and the way back.
- **`/admin/inspect-events`** is every type of event the world can record, as `docs/EVENTS.md` lists them, and
  needs nothing else running: a group a stream, as the document groups them, side by side where they fit, each a
  list of the types by name alone, and a box that keeps only the types with a word in their name, their fields or
  what is said of them. A name opens in place to what the type carries, what it means, what writes it and what reads
  it, with its sample from `contracts/fixtures/events/`, and any case in `cases/`, folded under that. It reads both through the dev server and again whenever either changes on
  disk. It changes nothing: a type of event is code and a contract. The events the world stored are the events
  log's, at `/admin/inspect-events-log`.
- **`/admin/inspect-logs`** is the debug panel's log on a page of its own, from every window of the game open in the
  same browser, and needs a game window open to say anything: each window shares its log on a channel the browser
  keeps between pages of the same address (`log/shared.ts`, a development build's alone, as the panel is), sending
  every line it held when the page asks and each line after as it writes it. The windows are across the top, each by
  its id and where it was opened, `closed` once it has gone, and one or every one is read at once, lines of several
  carrying their window's id; the areas below, with how many lines each, any of which can be chosen to read only
  those; a box that keeps only the lines with a word in them. `copy` copies what is shown as the panel copies its
  log, and `clear` forgets every line so far. It keeps two thousand lines of a window, where the panel keeps two
  hundred, and what a closed window said. Nothing leaves the browser.
- **`/admin/inspect-challenges`** is the challenge, which is not in the game yet: its content, from
  `world/catalogues/challenges.json`, and needs nothing else running to read. Every effect a slice can carry, in the
  five pairs of aspects, an aspect and its anti-aspect side by side, each effect's name, whether it is a trigger or a
  passive, what it does in words with its numbers filled in, the slot it brings and the summon it hires; every summon,
  its aspect and what it does; and the kinds of challenge, how long each lasts, how many happenings it has, how often
  one has two aspects and what each aspect weighs. It reads the file through the dev server and again whenever it
  changes on disk. Every name, word and number is a field, and whether a slot puts what is in it on the line a box;
  changed in place, they are saved through the game server as every catalogue's page saves, and taken on at once. The
  game server reads the same file and refuses one it cannot read, or one that breaks a rule of the content - a summon
  that is not there, a slot that neither lends nor puts on the line - naming where, as it does every catalogue, said
  once in the debug panel's faults and the server's log. The numbers of a challenge's rules that belong to no one
  effect are the balance's `challenge` group, at `/admin/inspect-balance`: the aspect boost, how far the tug runs,
  what a building on the line brings, what it loses killed, and the slice every house starts with. Below the content
  is the simulator, which needs the game server to fight. Each side is one to three slices - an aspect, power,
  integrity and summon count, two at most of its aspect's effects, and a stand-in in the slot of each that has one, a
  key figure of four stats or a building of a level, made up there - and the progression is drawn from a challenge
  kind of the catalogue by the seed, the same seed drawing the same one, or written by hand: its seconds, and its
  happenings, one aspect or two each, beginning where the engine spaces them. It opens on a sample,
  Violence against Diplomacy. **run** has the server's engine fight it out with the catalogue in force - not edits not
  yet saved - from the seed typed, or from one it draws when the box is empty, and shows what it came to: the seed,
  with **keep this seed** to fight the same challenge again, how it ended and in which second, the tug toward the side
  it favours, who won, what was gained and lost; the tug drawn second by second, side A up, each happening marked; and
  every moment as a table, a side or a kind of moment kept alone, a boosted amount marked ×. **run 100** and **run
  1000** fight the same sides that many times and say how often each side won, how many ended even, how many each
  pulled to the end, the mean end tug and how long the batch took; the first run is the seed's, and its moments are the
  ones shown, each run after it fought from a seed worked out from the one before, on a progression of its own when drawn
  from a kind. It asks with
  `simulateChallenge`, one of Adam's instruments, on a connection that says no hello, and a server with its instruments
  closed refuses it; nothing is stored. The plan is `docs/plans/challenges.md`.
- **`/admin/inspect-story`** is the world's history as a timeline, `docs/STORY.md` drawn, and needs nothing else
  running. Time runs down the page from the first box to the present, where the line ends at the compass: each
  box's day to the left of a gilt line and the box to the right, what happened in the library's `card.event`, a
  dot for a day and a ring for no one time, and lore - what is so rather than what happened - on parchment, set a
  little apart with a lozenge. A box's portraits, from `world/portraits/`, stand in ovals under it with their words,
  and one whose file is not there says so in the oval's place. An invention is no box: Earth's own, its name and its
  real year stand small to the left of the line, the printing press first, with a tick on it. It reads the document through the dev server and
  again whenever it is saved, so a box written is a box seen, and nothing built carries it: the story is the truth
  no player begins knowing. A rule of the document broken is said at the top, with its line. It changes nothing:
  the story is written in the document, by the rules its "How it is kept" sets out.
- **`/admin/inspect-pictures`** is every picture the world is drawn with, and needs nothing else running: the
  scenery and the structures as their atlases were cut, a structure a culture to a column beside its type's pin, each
  painted or still a placeholder, its size and the file it came from, and a gold tick under each building where it
  stands on the ground, the front corner of its base; the marks' pictures in `world/sprites/marks/`,
  the dev server saying of each whether its bytes are still the placeholder the tools drew, the structures' pins
  left to the structures' table; the critters, each kind's frames in a row as its strip holds them and the strip
  played beside them, frame after frame; the pieces of the ruins of the towns of 1790, cut into the scenery's atlas, a
  piece to a row and a culture to a column, each with the height it is cut at, which is the height to paint it at; the
  portraits; the scenes. It
  changes nothing: Adam paints the files, as `AUTHORING-THE-ART.md` says, and a tree that has cut no atlas yet says
  which tool cuts it.
- **`/admin/inspect-renders`** is a square of every kind of land side by side, and needs nothing else running: the
  thirty-two of `world/palette.json`, by its groups, each painted as the map paints it with the land moving on it, its
  trees and bushes grown by the map's own scatter bending in the wind, and the critters the clock brings there; and
  under them a square for each critter but the ruins', from the songbird to the ptarmigan, one put in its middle every
  few seconds. One zoom, 10, and a camera that never moves, so a look is compared across every kind at once without
  hunting the map for it; as many squares to a row as the window is wide, the critters' too, each row of them with the
  sky over it a bird circles in. The levels and the sliders of the debug panel's Shaders section are the game's own,
  and those it remembers are as the game was left in this browser, but for its sand, which holds one dune in the
  middle of its square, so there is always one to see. The water's own motion is the map's and the clouds the sky's,
  and neither is drawn there. It changes nothing. It draws the game's own layers over a world of the page's own
  (`apps/web/src/admin/renders/`).
- **`/admin/inspect-architecture`** is how the world is set up, and needs nothing else running. Along the top,
  the numbers: how long a brand-new worktree takes to the game with its world borrowed, how long a master's
  world takes from its painting when nobody has made it, how many tools bake it, and how many baked files the
  running game depends on. Then **Starting a tree**: each part of the quick start a bar on one clock, where it
  began and how long it took in a brand-new worktree measured on 2026-10-12, the game server's green bar
  beside the rest, and what each took before the world cache; its parts are held to the script's own words by
  `world.test.ts`. Then a master step by step, its ten world steps in the order `world:ready` makes them, each
  a bar as long as its tool takes. Below is the diagram, flowing down the page. Along its top, on one row, every
  file the world is made from - what Adam authors (gold) and what is downloaded (blue) - each under the tools
  that read it, with `world:fetch-all` above the downloads it fetches and a gold line under the row; under the
  line, the tools that bake the world from them and the files they write, each file card saying whether it is
  one file, a few, or a folder, and who makes it - Adam (gold), a download (blue), a tool (grey). **Every card
  and every box says what it is in one sentence**, and the rest - its path, what runs it, what reads it - when
  it is chosen, because with this many boxes more words up front is a wall; `sentence.test.ts` holds each to a
  sentence of 110 characters at most. A file or a tool that only an agent at work reads or runs, and the game
  never does, carries **the robot**, for development, and says when chosen what the agent does with it: the
  master's preview, which an agent opens to see a master too big to open whole, the stills, and
  `world:scenery`. The world steps' tools and what they make
  stand in a dashed box, **the world cache, shared by every tree**, which says what it is and where; choosing it
  lights everything in it. Under a dotted line is the running game, three boxes of the pieces that fit together,
  each card saying where it runs - in the browser, in the game server, or in Docker (sea green). **The page**
  box holds its parts in a row, each under the baked files it reads, which arrive at it: the painter, which is
  arithmetic in workers and not a shader, the map, the sprites, the panes and the picture renderers - Biome,
  Origin and Culture - with **the shaders** in a box of their own in the middle of the row: the grass, water and
  relief shaders and the critters, beside the sprites that tell them where the trees stand, and under them the
  trees' wind, the cloud shader and the fog shader, which read nothing baked, the fog telling the critters where
  the house sees now. Beside that box is the connection, which talks to the gateway and tells the sprites, the
  panes and the fog what the house has and sees; choosing the shaders' box lights every shader in it. **The game server** box holds the gateway, the rules, the reactions and the projections, and
  the baked files it reads arrive at the box; **the event store** box holds Occurrent, MongoDB, the bridge,
  RabbitMQ and the in-memory store used without Docker, the last dashed because it is used only instead of
  MongoDB. Every arrow between running pieces says what passes along it - commands, the history, every event a
  queue each, the world now - and choosing a piece lights the pieces it talks to, a box the pieces in it. Their
  words are
  `apps/web/src/admin/architecture/running.ts`, held by `running.test.ts`. Arrows run from what is read to what
  reads it. Drag to move about, scroll to zoom, the minimap for the whole; choosing a card lights everything it
  depends on and everything that depends on it, and the strip above the diagram says what it is, what reads it
  while the game runs, and the command to run a tool. Adam's own tools and the stale scripts are named under it
  rather than drawn. Its data is `apps/web/src/admin/architecture/`, held to the repository by `world.test.ts`:
  a new `world:` script, a moved reader, a file nothing makes, or a baked file nothing reads that does not carry
  the robot, fails it. The times of the tools the quick-start runs were measured on
  Adam's machine on 2026-10-11. The inspect pages are kept apart from the game by decision 0091.

## The event store and the broker

- MongoDB and RabbitMQ, from `infra/docker-compose.yml`, once Docker Desktop is running: one of each for the
  whole machine, whichever tree started them, on the loopback address only. The quick start starts them when
  they are not up, says under **tools** where the world will be kept, and tells the game server.
- **Where the world is kept** is the debug panel's first `world` line on connecting: *kept in MongoDB,
  database villages-<tree>, which outlives the server, and carried by RabbitMQ in the virtual host
  villages-<tree>*, or *kept in memory, and gone when the server stops* when Docker was not running. With
  the first, found a house, stop the game server and start it again, and the house is still there. The
  server's log says the same as it starts, under `villages.store`. `--villages.store=mongo` keeps it in
  MongoDB and `--villages.broker=rabbit` has RabbitMQ carry it, which needs the first; the quick start passes
  both when the stack is up.
- MongoDB is `mongodb://localhost:27017/?replicaSet=rs0`, a replica set of one, which is what Occurrent's
  subscriptions need. A tree's database is named after it, `villages` in the main checkout and
  `villages-<tree>` in a worktree, worked out by the server from the checkout it runs in, so no tree reads
  another's world; `--villages.mongo.database` names another. Its events are the `events` collection.
- RabbitMQ is `localhost:5672`, and its management page is **http://localhost:15672**, signed into as
  `villages` / `villages`: what exchanges and queues exist and what is flowing through them. A tree's messages
  keep to a virtual host named as its database is, which the server makes as it starts and the page's menu at
  the top right picks between. In it, **the bridge** publishes every event the world stores to the exchange
  `villages.events`, under a routing key of its type and the cell where it happened (`EVENTS.md`), over a
  connection named *villages: the bridge*; the exchange's page shows the rate as houses are founded. The read
  models, the recent events and the events log follow it: the Queues page lists one queue for each, named after
  it with a suffix, `HousesProjection.3f2a9c1b`, each over a connection of its own, *villages: HousesProjection*,
  and gone when the server stops. The reactions - the castle raised at a founding, the income and sight of what
  a house holds - follow the store and have none. Closing a follower's connection on the Connections page puts
  `error fault` in the debug panel; the follower makes its connection and queue again and reads the history, so
  nothing on the map goes missing. A queue bound by hand to `#` on the exchange's page fills with every event
  from then on, and fills again with what was written while the server was down once it is back, because the
  bridge keeps its place in the tree's database, in `checkpoints`. Delete such a queue when done. See decision
  record 0094.
- `docker compose -f infra/docker-compose.yml ps` says whether both are up and healthy; Docker Desktop's
  Containers page says the same under `villages`. `down` stops them and keeps what they hold, and `down -v`
  forgets it, for every tree at once, so both are Adam's and no session runs them; a session resets only
  its own world, with the debug panel's wipe. See decision record 0092.
- **A world holding events this code cannot read** - written by older code before an event changed shape - is said
  as the server starts, in its log under `villages.store`, and to the debug panel on connecting, as
  `gateway: error unreadableEvents` with how many, the first by type and stream, and what to do: the World
  section's wipe. Until then a house with one in its history refuses every command. See decision record 0036.
- A worktree deleted leaves its world behind in MongoDB, and its virtual host in RabbitMQ, and **the quick start
  drops them**, every time it finds the stack up, saying under **tools** how many when there were any: nobody
  has to remember to, since sessions are left as they are. By hand, `node
  drop-gone-worlds.ts --list`, in `scripts/`, lists every world with how many events it holds and every virtual
  host, kept or gone, and `--drop` drops the gone ones: those whose checkout git no longer has a folder for. The
  end-to-end test's world of a checkout that is still here is kept, because a test may be running in it. It asks
  MongoDB through the stack's own container and RabbitMQ through its management page, so it needs the stack up and
  nothing installed.

## The bot swarm

- **One bot**, a simulated player, against the game server already running: `cd backend` then
  `./gradlew :load-bots:bot --args=--port=<the game port>`, which `node frontend/apps/web/vite/worktreePort.ts --game`
  prints for a tree. It says hello as a player of its own, takes one of the seats it is offered, follows the nine
  cells round its seat, and then pans to cells nearby about every twenty seconds and rolls about every minute,
  playing one option of the hand it is dealt. Its house is on the map like anyone's, and its `rolled` and `took
  action` on the event page. Every ten seconds it prints its stage and how long the server took to welcome it,
  answer its commands and send its cells, and why anything failed. Ctrl+C stops it; its house stays in the world
  until the World section's wipe. See `docs/plans/bot-swarm.md`.
- **The swarm**, how many players one game server carries: `cd backend` then `./gradlew :load-bots:swarm`. It
  builds the app's jar and starts one game server of its own from it, on a port the operating system picks, its world
  in memory and its instruments closed, so it is no tree's and leaves nothing behind; then ramps bots at it - a
  warm-up of 50 for 20 seconds, shown but never judged, then 100, 1,000, 2,500, 5,000 and 10,000, each held a minute -
  and stops at the first stage that **bends**: the slowest twentieth of the welcomes, the answers or the cells over
  500 ms, or more than one in a hundred trips or bots failing. A line a stage as it goes: the round trips at p50, p95
  and p99, failures, bots lost, the server's heap after a collection, its threads and its CPU over the stage, read
  from outside with `jcmd`; then where it bent and why. The server it started is stopped however the run ends, Ctrl+C
  included, and its log is `.logs/swarm-server.log`. `--args="--stages=100,500 --hold=20"` makes a short run, and
  `--warm-up=0` leaves the warm-up out. `--histogram` saves what the server's heap holds by class after each stage, in
  `.logs/swarm-histogram-<players>.txt`, which is how a player's cost is found. It is minutes long and loads the whole machine, so no check runs it.
- **The performance page**, `/admin/inspect-performance`, its chapter "Players one server carries", charts the history of runs written down below: the latest run's players carried and
  where it bent, then run by run the players each carried and the slowest twentieth of each round trip at the largest
  load every run carried, so a step that cost something shows as a drop; then one run, picked by its commit and time,
  stage by stage, with the server's heap after a collection and a table of every number. A `*` after a commit is a
  run of a tree with changes beyond it. It reads the file fresh at a reload, so a run just finished is on it.
- **Every run is written down**, once, when it ends, as one line of `docs/experiments/performance/runs.jsonl`: when,
  the commit and branch it measured and whether the tree had changes beyond it, the machine, the settings, the
  server's heap limit (8 GB, pinned so that runs compare), where it bent and why, and every stage's numbers. A run
  stopped with Ctrl+C is written as aborted, with the stages it got through. The file is committed with the work it
  measured, so the history travels to main; the performance page charts it.

## What the shaders cost

- **The shader measure**, what the game's shaders cost the graphics card at fixed places on the map:
  `npm run perf:shaders --prefix frontend`. It starts a dev server and a game server of its own on ports the machine
  says are free, the game server's world in memory, so no tree's servers or world are touched; opens the game in this
  machine's own Chrome on the graphics card, without a window when Chrome will draw there with the card's timer and
  in one when it will not; sets every shader to high and lifts the fog, so the game server sends every stand; and
  measures eight places at 1920 by 1080 in the player's camera, each a screen of one kind of ground found in the flat
  tiles: tundra, bog, ice, sand, grassland, forest and a coast at zoom 10, and the clouds from zoom 6, where they are
  drawn. Then the fog, last, so no place above had a house in the world: it founds a house from the first seat the
  parchment offers, as a player would, and measures the frame where the camera comes to rest over the seat with the
  fog on, `sprites:fog-of-war` and `sprites:fog-of-war-uncolour` its own parts. The seat is whichever is offered first,
  so the ground round it changes from run to run and only the fog's own parts compare; `--no-fog` leaves it out, and
  a tree whose house cannot be founded is said not to have had its fog measured. At each place it waits until what is drawn stops changing, draws frames back to back so the card is at its
  working clock, and times every frame twice over in turn: as a whole, and run by run under the name of what drew,
  the map's style layer (`map:water`, `map:painterly`) or Pixi's program (`sprites:land`, `sprites:clouds`,
  `sprites:scenery`), each run its own query, whose small cost is worked out from the two and taken back out of the
  parts. It keeps the fast frames, the ones at or below the twentieth percentile, because the same frame drawn back
  to back takes one of two times a fifth to a quarter apart, frame by frame, as though something else on the card
  now and then lands inside the timing, and how many land in the slower changes from round to round. It measures
  every place on a page opened afresh, because a page that has been round the other places draws the same place a
  tenth slower; and three times over, keeping the fastest, because one fresh page draws a place up to a sixth slower
  than the next and keeps to it. Before each place it draws until two bursts in a row agree, so the card has come up
  to its clock. It holds the wall clock while it measures, so the clouds and the wind are where they were the last
  time. It prints a line a place - the frame, its spread, the CPU's part, how far apart the two rounds came out, and
  the five costliest parts - and leaves the whole reading in `.logs/perf/shaders-<time>.json` and a picture of every
  place beside it. `--places tundra,bog` measures some, `--rounds 1` once each, `--level water=low` puts a shader at
  another level than high, `--check` also measures the coast with the water off to see the water's part agree,
  `--tree <dir>` measures another checkout. It refuses a card that is more than a quarter busy before it starts,
  because whatever else is drawing would be in every time; `--anyway` measures all the same. About five minutes, and
  a minute more the first time, while the game server compiles. See decision record 0106.
- **Points kept, and what moved.** `--compare` says what moved against the last point kept that was measured alike -
  by the same method, on the same card, at the same size - a line a place: a frame that changed by more than ten in a
  hundred or 0.1 ms, or a part by more than ten in a hundred or 0.05 ms, with the parts that moved; or that nothing
  did. `--record` keeps the run as a point, one line of `docs/experiments/performance/shaders.jsonl`: the commit, when
  main came to hold it, why it was measured (`--why to-main`, `history` or `by-hand`, the last unless told), the card,
  the method, and each place's frame, its spread, the CPU's part, its parts and how many draws a frame each made. The
  file is committed with the work, so the history travels to main.
- **On the performance page**, `/admin/inspect-performance`, the chapter "What the shaders cost", folded under its
  title as every chapter of the page is: the latest point's places in a table, each with its frame, how its frames
  spread, the CPU's part, what drew gathered into families (the land, the water, the clouds, the fog, the scenery,
  the sprites, the relief, the painted map, the clears) and its draws a frame, a place's name a link that opens the game
  there; then each place's frame point by point, and one place, picked, by family point by point, the commit's subject
  under the pointer; and, folded, every thing the latest point timed by its own name. Only points measured as the
  latest was - one method, one card, one size - are drawn as a line; the others are counted beside the title. The
  families are worked out when the page reads the points (`admin/performance/shaderPoints.ts`), so a new grouping
  regroups old points without measuring them again.
- **The game's own cost lines**, the ones the log says once a level for the water, the land, the clouds and the
  trees, stay as a quick look: they are timed at the layer's own frame rate, on a card that has idled down, and read
  two to three times what the measure does. The measure is the number to compare.

## How long the game takes to start

- **The start's measure**, `npm run perf:startup --prefix frontend`: on the same Chrome and servers of its own as the
  shaders' measure, the game opened in a browser of its own each time, nothing cached, three ways - the first load
  after its dev server started, when the dev server works out every file anew; the game loaded again on it, three
  times, the middle kept; and the page as it is built for a player, built by the tree's own Vite settings into
  `.logs/perf/built` and served by the tool beside the public folder, three times, the middle kept (`--no-built`
  leaves it out). For each: the seconds from asking for the page to the loading screen lifting (before there was a
  screen, to the map drawn); when the map's style loaded and the sprite canvas was made; the long tasks - the stretches
  the page could do nothing else - and the gaps between frames, a stutter being one of 50 ms or more, up to the screen
  lifting and in the five seconds after, when a player is already looking; what was fetched, by kind; and where the
  CPU's time went, by module and by function, each its own time and not what it called, from a profile Chrome takes.
  A table and the CPU's lists printed, and the whole reading in `.logs/perf/startup-<time>.json`; `--record` keeps
  it as a line of `docs/experiments/performance/startup.jsonl`, `--loads 5` takes the middle of five, and `--compare`
  puts each load's seconds to ready, its long tasks and its stutters beside the last point kept and marks what moved
  by more than a fifth. About three minutes, the build one of them.
- **On the performance page**, the chapter "How long the game takes to start": the latest point's three loads in a
  table - seconds to ready, when the style and the sprites came, the long tasks and the worst gap up to ready, the
  long tasks, stutters and worst gap after it, the code and the tiles fetched, the CPU's busy time - then each load's
  seconds to ready point by point, and its long tasks after ready; and, for the load again, where the CPU's time went
  up to ready and in the five seconds after, by module and by function. A development build's own costs - React's
  development runtime, the dev server's hundreds of files - are in the first two loads and not in the built page,
  which is what a player meets.

## Zooming in, and what the sprites cost it

- **The zoom's measure**, `npm run perf:zoom --prefix frontend`: on the same Chrome and servers of its own, the game
  opened on a fresh page, the fog lifted and the shaders as a player has them, settled at zoom 5 over a place and
  then flown to zoom 10 over four seconds, the way a few turns of the wheel take it, and watched three seconds more
  while what came settles: over the forest, thick with trees, the grassland, and the bare ice, so that what the
  sprites cost a zoom is the forest's against the ice's. For each: frames a second, stutters (gaps of 50 ms or more),
  the worst gap and the slowest twentieth's, the long tasks while the camera came in and after, the CPU's time by
  module and by function, how many sprites the scenery drew once settled, and the programs the page waited on the
  graphics driver to compile. The run's first zoom, over the first place, is kept apart: Chrome has compiled none of
  the game's programs yet, which is what a player's first visit meets, and every visit after a shader changes. The
  land's are compiled ahead once the loading screen lifts, so the first zoom waits on none of them: 0.1 s of long
  tasks, which was 22 to 40 s while the land was one program compiled at the first close zoom (experiment 0025).
  Then each place three times on fresh pages, the middle kept (`--rounds`); `--places forest,ice` measures some.
  `--record` keeps it as a line of `docs/experiments/performance/zoom.jsonl`, and `--compare` puts the first zoom's
  stall and each place's long tasks, stutters and CPU beside the last point kept and marks what moved by more than a
  fifth; the first zoom's stall beyond a second, which is a program waited on again. About three minutes.
- **On the performance page**, the chapter "Zooming in, and what the sprites cost it": the first zoom and each
  place's in a table, each a link that opens the game there; each place's long tasks over its zoom point by point, and
  the first zoom's stall point by point, which is how long compiling the game's programs takes; and each place's CPU
  time by module side by side.

## When the measures run

A step that changes what is drawn, what the zoom loads or how the game starts runs the measure it touches with
`--compare` at its hand-over, against the last point kept, and says what moved; nothing a hand-over measures is kept.
Each time work reaches main, every measure is run with `--record --why to-main` at main's tip - the tests always, the
shaders, the start and the zoom when the frontend changed - and the lines go to main as `docs: main's performance at
<sha>`. `.claude/loop/hand-over.md` and `.claude/loop/to-main.md` are the agent's half.

- **The history**, `node scripts/perf-history.ts`: the points of commits before 2026-10-20, measured afterwards and
  kept with `why` history. Landings of main spread evenly in time - ten since the world drawn now reached main
  (2026-10-03), measured by everything, and five before it by the tests alone - each checked out in a tree of the
  tool's own, `.claude/worktrees/perf-history` in the main checkout, on no branch; its packages installed again only
  when its lock file changed, `world/source` hard links to the main checkout's, and its world made by the world steps
  that commit's own quick start names, run directly, never its quick start. Then this tree's tools measure it with
  `--tree` and `--root`, and keep the points here. A measure that finds the graphics card busy is tried again every
  ten minutes for two hours. `--dry-run` lists the commits and about how long; `--run` measures them, the oldest
  first, because the tree keeps what each commit made and an older commit's checks trip on a newer one's files, and
  carries on where a stopped run was, because what is already kept as history is passed over;
  `--commits a,b` measures those. The tree is removed once nothing is owed. About seven hours from nothing.

## How long the tests take

- **Kept by the check**, `node scripts/check.ts --record`: every check, one part after another as always, with how
  long each part and each of its steps took and how many tests it ran kept as a line of
  `docs/experiments/performance/tests.jsonl`. So that the time is the tests' and every one of them runs, a recorded
  run compiles the backend first, timed apart, and then runs its tests whether or not anything they test changed
  (`cleanTest check`), and runs the frontend's check a step at a time - the typecheck, the linter, the formatter and
  the unit tests - each even when one before it failed, asking Vitest for its JSON report besides. Where the time went is kept too: the backend's modules
  by the time their specs took and its slowest specs, from Gradle's reports; the frontend's slowest test files, and
  Vitest's own account of its time, transform, import and tests, each summed over its workers. Whether Docker was
  running is kept with it, because without it the backend's tests that need it are skipped. `--root <tree>` checks
  another tree, an old commit's, and keeps the line in this one; a part that tree does not have yet is said and passed
  over. About six minutes.
- **On the performance page**, the chapter "How long the tests take": the latest point's parts in a table, each with
  its steps' seconds and its tests counted, failed and skipped; each part's seconds point by point, the backend's
  compile left out because what Gradle's cache already held decides it, and its tests counted point by point; and
  where the time went, side by side.
