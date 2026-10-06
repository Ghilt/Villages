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

- Which world is drawn: the **Debug map** part of the debug panel, down the right-hand side. Its terrain
  dropdown is every PNG in
  `world/master/`, with each one's size and when it was last cut, and it says when the image has been
  saved since - which it re-checks whenever the window is given focus. A master nobody has cut yet gets
  a button, and pressing it runs `world:import` and `world:tile`, the two commands `CLAUDE.md` cuts a world
  with, and then `world:flow` and `world:sprites`, from the dev server with their output going into the debug
  log: about six minutes, once per master.
  Switching reloads the page on purpose. So the loop is: paint, save, alt-tab, pick it. See `docs/adr/0025`.
- What it looks like: the renderer dropdown in that same panel. `Biome` is not a look and not even the
  terrain: it lays the sprite map's own biome raster on the world, flat and blocky, which is the only way
  to review a biome without the scenery standing on it in the way. `Raw` is the flat
  tiles as cut; the rest are painted in the browser, tile by tile, by the same functions that paint
  the stills. `Vivid` is the odd one: it draws the master's own colours out of `world/palette.json`
  rather than the quieter ones out of `world/render.json`, saturation pushed, with the whole medium
  turned off. It is the view to check a master against the file it was painted in, and it is two
  numbers in `world/painterly.json` rather than a look. Only the terrain is precomputed: a tile knows its own zoom, so the treatment is drawn at the
  size it should be at whatever you are looking at. Painting happens in a pool of workers, and the tiles
  around the view are painted during the pauses so that moving the map finds them done. See
  `docs/adr/0021` and `0022`. `Flow` is not a look either: it draws, in place of the water, which way every
  river runs, a colour for each way and arrows marching downstream from about zoom 8, and black where a river
  has no way to any sea or lake - a break in the master's rivers to mend. See `docs/adr/0081`.
- The water moves, from about zoom 8.5 in: depth, waves lit by a sun in the north-west, caustics on the bottom
  of the shallows, and surf along the shore, over every renderer. It is the **Water** part of the **Shaders**
  section, below Debug map, which holds a part for each shader that is a look and nothing more, with `off`,
  `low` and `high` in each part's bar, and an `on` box in the section's own bar that turns every shader off and
  back on at the levels they had. High is every pixel at thirty frames a second; low is a quarter of them,
  worked out into a picture of its own and laid over the map, at fifteen; the first time a shader is drawn at a
  level, the log says once what that costs the graphics card. The water is high at every load, and its Look is
  `Realistic` or `Wavelets`, the water's first and stylised look, kept to compare against. The rivers run
  downstream, with crests across the current and specks carried on it, from the flow `world:flow` works out
  beside the tiles; a master without it has still rivers and the log says so. Their look is the Water part's
  eight sliders: how fast, how far apart the crests are, how far the middle runs ahead, how thin and how
  bright the crests are, the specks, and how much of the sea's waves and caustics a river keeps. They are
  remembered in that browser, `reset` puts them back, and once a slider stops the log says all eight under
  `water` as `rivers tuned: …`, which is the line to hand over when a setting should become the default. Every
  other number of the water is in `apps/web/src/water/look.ts`. See `docs/adr/0081`.
- What the program thinks is happening: the debug panel, one space docked down the right-hand side
  holding everything that helps during development, which minimises to a badge and remembers that,
  and is only in a development build: a production build leaves it out whole (0079).
  **It takes room from the game rather than floating over it.** What is left is the **stage**, the box
  the player's interface is laid out in and the only thing a player would ever see; two grips resize it,
  and the toggle in the very top right confines it to a phone, which is how to check that a mechanic
  reads at both shapes without a second monitor. See `docs/adr/0039` and `docs/RESPONSIVE-DESIGN.md`.
  It is the log and the buttons; the block of state above them went on 2026-09-16
  because Adam never read it, and what it used to say every four hundred milliseconds is now said once,
  when it changes, as a line of the log. Its copy button puts the log on the clipboard, which is the
  shortest way to tell a session what the program is doing. A read model that throws is said there too, as
  `gateway: error fault: …`, with its stack in the server's log under `villages.feed`, which the quick-start
  writes to `.logs/backend.log`; see decision record 0029. **Everything in it is in a folding section**,
  and which section a new thing goes in is asked rather than guessed, as `CLAUDE.md` says. Today they are
  Worktrees, Debug map, Shaders, Scenery, Camera, Areas, World, Resources, Characters, Dialogues and Choice roll.
  **The log is not a section but a column of its own**, the whole height of the panel on its outer side,
  so what a button did is in view while the button is. It begins folded: the `log` toggle in the panel's
  header, beside `landscape`, opens it and `hide` in its own bar folds it away again. The events themselves are not in the
  panel: they are at **`/admin/inspect-events`**, a page of their own that watches the world without
  playing in it, one line an event opening to the whole thing as the store holds it. The `found a house here` button in it sends a
  real command and is how to make an event happen on purpose. The `restart` button beside `copy` forgets
  this browser's player and reloads, so the opening can be tried again from nothing; the house the old
  player founded stays in the world, because events are never deleted. `wipe` beside it empties the world
  for everyone connected to it, and every window reloads and arrives anew. See `docs/adr/0036`.
  What the log says is what was worth saying, through `note(area, message)` in `apps/web/src/log/log.ts`:
  moving the camera about writes nothing, and the cells a move brought back are counted and said in one line
  only when they carried something. `window.villagesPainterly()` gives the paint counters from a console.
- The player's own levers: the bar along the bottom of the house card, in the corner. The eye is the
  first place in it and five stand empty. Open, the player's own seat stays drawn however far back the
  camera goes and the ground about it is drawn below the zoom where everyone else's begins; theirs and
  nobody else's, so the world still thins out with distance. It costs nothing on the wire, because a
  player's own house already reaches them wherever they are looking. See `docs/adr/0038`.
- The fog of war: `fog of war: on` in the Debug map section, on at every page load, and pressing it turns
  the fog off for that window. A house sees from **vision points** - its seat, and each key figure standing
  on the map, a circle of 34 km around each - and the server works them out and sends them as `yourSight`;
  the log says what gives vision under `sight`. `give vision here`, under the switch, gives the house a circle
  where the camera is looking until its `take it away` is pressed; both are real commands. The fog covers the
  world and not the signs: every icon, the offered seats and whatever stands in vision are drawn over it. Unknown ground is under a dark haze, revealed ground has its
  colour taken out, trees and castles too, and vision is clear. With no house the whole world is hazed. The server holds back what the fog hides:
  a player is sent the houses on revealed ground and the people in vision, and their own wherever they are,
  and the scenery's stands only where they touch revealed ground, tile by tile under the held cells, which
  the log counts under `stands`; the trees are grown from those and nothing else, so without the game server
  nothing grows. The server reads them from `world/stands/`, where the generator writes them and nothing serves
  them, `villages.stands` to point it elsewhere, for the master the page names in `hello`. `fog of war: off` lifts all of it, for that window. The edge has surface tension: circles closer than
  about 56 km are seen across and notches are rounded off, drawn and held back alike, `Vision.SURFACE_TENSION`.
  No tree grows on unknown ground, so with the fog on and no house the world is bare under the haze. Close
  in, the haze's bands of mist swell and drift, on a clock that runs only while some of it is on the screen.
  **Every number of the fog's look** - the haze, the mist, the fade - is in `apps/web/src/fog/look.ts`.
  See `docs/adr/0061`, `0062`, `0063`, `0064` and `docs/plans/fog-of-war.md`.
- Looking at a whole world at once: `see everything`, in the debug panel's World bar beside `seed 20`.
  A house is founded at significance 20, so it reaches a page only from zoom 8 in, and pulling back past
  about z7.5 empties the map because the gateway stopped sending rather than because anything is hidden.
  This sets significance aside for this connection and takes the renderer's distance floor off with it.
  Adam's switch, not a player's.
- Areas, in the same panel: `draw an area` arms the next drag on the map, and dragging paints one. The
  ends join themselves and escape stops. Click an area to select it, which makes its line pulse and lists
  how many diamonds of each terrain it encloses; `shade`, `recount` and `delete` are beside it. The
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
  refusal is seen rather than guessed. The events are at `/admin/inspect-events`. See `docs/adr/0055`.
- Dialogues, in the same panel: the **Dialogues** section, below Characters. `offer a dialogue` offers the
  house the server's sample, a letter from the coast spoken by the house's first key figure and a
  messenger, ending in a dialogue choice of three: *accept* spends forty wealth and is paid a hundred,
  *ask* is paid in influence, and *refuse* does nothing, each option showing what it will do a different
  way - whole, hidden, or not at all. It is off, saying why on hover, while the house has no key figure.
  **That one lever is all the debug panel does for dialogues**, Adam's word on 2026-10-01: it stands in for
  the world, which offers none yet, and reading, answering and seeing how one ended are the player's, in the
  pane - never levers in the panel. The first option costs forty wealth, which the Resources section's `give`
  puts there, and `kill` on the speaker in Characters loses every open dialogue they speak in. The page names
  the sample and sends none of its words, and a requirement is never sent to a page. The asking and the
  answer are lines of the log under `dialogues`, and so is where each dialogue stands whenever one changes,
  as far as the player may know it; the dialogue itself, whole, is at `/admin/inspect-events`. In the game,
  the house's first dialogue puts up the **dialogues** pane, a column down the right of the spread with its
  three sizes, and a pane navigation lists on a phone; it lists the dialogues waiting and finished, a lapsed
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
- The choice roll, the player's own: **Take action**, in the bottom middle of the spread once there is a
  house, put away to its strip at rest with what a roll costs beside it - a press anywhere on the strip but its
  buttons opens the pane out - ten wealth, and a house is founded
  with fifty. Greyed, saying why, while the house has less than that free or a command is waiting on its
  answer. Pressed, it rolls: the pane opens out, three times as tall as its middle size, and plays the roll as
  a report card - the omens slam into a list a third of a second apart, and under a divider the hand of three
  options of one rarity pops in along the bottom, each a card edged and named in its rarity, saying what it
  gives, with the marks of the omens that brought it. A press on the list lands the rest of the omens at once.
  At the middle size the list is folded to its marks over the options, each just its rarity and its title, and
  pressing the marks or an option opens the pane out, where an option is taken; on
  a phone the list and the options are one under another and the pane scrolls. Taking an option gives it, and
  the pane goes back to its strip. *Gossip from the kitchens*, a common, is a conversation rather than a
  resource: taking it offers a dialogue about the nearest other house within 1500 km, which opens in the
  dialogues pane, and with no house that near it is never dealt. A hand already pending when the page loads is drawn as it ends. A hand cannot be rolled over while it waits. The asking and the answer are lines of the log under
  `roll`, and the hand under `choice`, with its rarity and how many omens it was rolled from. The **Choice
  roll** section of the debug panel, below Dialogues, looks into it: the hand's omens - the house's holdings,
  *Weak house*, *Pious*, what rose since the last roll, *Missing wealth* when an open dialogue waits on a cost
  the house cannot pay, the windows open on houses it has revealed and on people it sees or holds, the dialogue
  being read, the key figure open, where the view is centred - *Coast*, *River* within 400 km, *Forest*,
  *Mountains*, *Fields*, *Grassland*, *Desert*, *Marsh* or *Ice* where it is a sixth of the revealed land or
  more, *Open sea*, *House &lt;name&gt;* for houses standing in a circle of 150 km or less, and *Unknown* where the
  fog covers it all, read by the game server off the ground map of the master the page draws - and the season -
  with their kind and,
  on hover, their key; what the last roll drew from, which the player never sees - the pools it opened and
  every action that could have been dealt, with its weight - and whether the throw or the lever chose its
  rarity; the odds, 70, 22, 7 and 1 in a hundred. Its one lever, `next roll`, makes the next roll `common`,
  `uncommon`, `rare` or `legendary` whatever the throw, or `the throw` again: it stands in for the world's
  luck, not for the player. What a roll drew from is sent only while the instruments are open. See
  `docs/adr/0083` and `docs/plans/choice-roll.md`.

## Adam's folders and the tools that cut them

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
- What the ground is, for the game server: `npm run world:ground --prefix frontend` reads a master into its
  **ground map**, `world/ground/<master>/`, a cell every sixteen master pixels each way, each keeping its
  commonest terrain and whether a river, a lake, the sea or a coast is in it: four megabytes and fifteen seconds
  a master, which the quick start makes when it is missing. Only the game server reads it, to work out the map's
  omens of a roll, and it takes a master's name as its first argument (`-- terrain2`). A master repainted
  makes it stale. See `docs/adr/0084`.
- A picture of the scenery, without a browser: `npm run world:scenery --prefix frontend` paints five
  places at the zoom the scenery is actually in and stamps every point the sprite map asks for onto
  them, into `world/painterly/<place>-scenery.png`, half a minute for all of them. It prints each one's
  marks, its density against the ceiling, and its biome and kind mix. **They are marks, not
  silhouettes**: the shapes are drawn in Pixi and this is the generator's answer, not the map's. `-- --at
  lng,lat` looks anywhere, `-- --view alps` at one of them, `-- --zoom 10.4` closer, `-- --style flat`
  without the paint, `-- --spacing 0` without the spacing that keeps trees off each other (two, three to
  see more of it). This is what a change to `world/biomes.json` is argued from.
- Sprites: `world/sprites/` is Adam's folder, committed as the master is: `scenery/<kind>` for every
  kind in `world/biomes.json` and `marks/<name>` for every mark. Any PNG, WebP or JPEG, any size, on a
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
