# Roadmap

> **What belongs here:** what is being built now, what is meant to be built later, and the ideas that are
> not commitments. **What does not:** why any of it is wanted (`VISION.md`, `SETTING.md`, `MECHANICS.md`),
> how it will be built (`BUILDING-A-MECHANIC.md`), or what has already landed, which is the git history.

Three lists, and nothing else. **Now** is what is on the table this session. **Later** is wanted and not
started. **Future ideas** are things worth doing one day that nobody is promising.

This is a menu rather than a queue. The order is a suggestion; Adam picks the next step after each commit
from options offered then, and reordering costs nothing. See decision record 0016. Anything speculative
stays in Future ideas until it has a hypothesis in the experiment journal.

Rebuilt 2026-09-19, when the documents were reviewed claim by claim. The old six lists had drifted into a
record of what was done, which the git history already keeps.

## What stands today

The map is ours: a hand-painted master, cut into tiles, painted in the browser at any zoom, its water moving and
its rivers running to the sea, lying on a desk when the camera pulls back past the world. A player arriving with no house is offered three seats on a
parchment, takes one, and the house is founded from the same decision that records the taking — castle,
ground about it, selectable, with an inspector on the left. Every event carries its two times, its place and
significance, and its provenance. Two browsers see each other's houses live. The world is kept in MongoDB, in a
database of each tree's own, and outlives a restart of the game server; RabbitMQ carries every event stored.

## Now

Characters and key figures are built and waiting on Adam's eye. Nothing else here is started, and the four
after them wait on the same thing. Fog of war, the exception, is under way a step at a time, and so is
character dialogue; the UI component library is built and waiting on Adam's eye, and so is the choice roll,
and so is the origin map, the first of real names on the edited world. Structures are planned and not
started; the world cache is built and waiting on Adam's eye; quests are built and on main, waiting on Adam's
eye for their experiment; and catalogues, the newest, are built and waiting on Adam's eye.

- **Characters and key figures**: the people of the world, each with a history of their own, and the
  house's tie to the few it acts through, shown in a pane in the corner beside the house status. The shape
  is decision record 0055, and the corner reaching along the bottom is 0056; the steps, one commit each,
  are in `docs/plans/characters-and-key-figures.md`, and nought to nineteen are built; the hypothesis is
  experiment 0010. The portraits are Adam's own art, and placeholders stand in until he has drawn them.
  Step twenty, looking at an earlier day, is optional and not built.
- **Fog of war**: a house sees the map at three levels - vision, revealed, unknown - from vision points, each a
  place, a circle and a span, and the server keeps back what a house cannot see. The shape is decision record
  0061 and the steps, one commit each, are in `docs/plans/fog-of-war.md`; the server working out every house's
  sight, the fog drawn from it over the world and under the signs, vision given outright, the server
  holding back what the fog hides, and the surface tension that joins circles close together are built, and
  the scenery is grown from the stands the gateway sends, only those on revealed ground, which a page cannot fetch for itself: all of step 8. Adam's own mechanic, asked for on 2026-09-26.
- **Character dialogue**: people talking to each other, offered to a house whole and stepped through in a
  pane of its own down the right of the spread, paying the house as it goes, and lapsing when a requirement
  the player never sees fails. The shape is decision record 0071 and the steps, one commit each, are in
  `docs/plans/character-dialogue.md`; the hypothesis is experiment 0014. Planned on 2026-09-27 from Adam's
  own description. The offer, the walk and the step are built on the server, the debug panel offers a
  sample and does nothing else, and a speaker's death ends their dialogues as lost. The pane stands in a
  column down the right of the spread, 0069, drawn in the page, 0070, opens when a dialogue is offered, and
  lists them, waiting and finished; a dialogue is played through in it, over its scene, with a portrait
  beside every line and what a line gave under it, and a line can show its place or its window; nothing in
  the world offers one.
- **The UI component library**: every component the interface is built from, painted art placed by CSS,
  shown at `/admin/inspect-ui-components` before it is used, with placeholders copied from Adam's
  moodboard. The shape is decision record 0068, the method `UI-COMPONENTS.md`, and the steps, one commit
  each, are in `docs/plans/ui-component-library.md`: all eleven are built, the larger ones in parts, with a
  contrast check that holds every word to what it needs. It has reached the game's tiles: the corner and the
  rail are dressed in the acanthus frame, the right column in the cherubs' and the letter in the clouds; the
  panes inside them still draw their own controls, and take the library's up a component at a time. Adam's own, asked for on 2026-09-30.
- **The choice roll, as the core loop**: a *Take action* button that costs wealth, the omens the fate engine
  read slammed into a report card, a hand of one rarity dealt from pools of actions, and the server taught
  to read the ground so the map can be an omen. All seventeen steps of `docs/plans/choice-roll.md` are built
  and on main, with Adam's changes to the pane of 2026-10-05 and 06; experiment 0015 waits on his rolls. What
  is open: more content, actions only some omens unlock, characters on the map as omens, and tuning by
  playing. Adam's own, planned with him on 2026-10-04.
- **Relief**: the ground shaded by its slope, the whole world, from ETOPO 2022's height, by a shader of our own
  with MapLibre's hillshade beside it to compare, heavy far out and light close in on four sliders in the Relief
  part of the Shaders section. Decision record 0090, closing experiment 0017; built and waiting on Adam's eye for
  the numbers. Fitted to the master through its origin map, so land Adam moved takes its height with it, and invented
  land given ground of the kind he painted on it.
  What is open: one light for the water and the relief. Asked for by Adam on 2026-10-07, after the world was found to have no height at all.
- **A place for every mechanic**: the review of 2026-10-02 found each mechanic threaded by hand through the
  same thirteen shared files, and those files growing with every one. The fix is a plan of 43 steps over eleven
  checkpoints that Adam smoke-tests: two checks that stop the growth - the size ceilings (0072) and a rule for
  which folder of the web app may import which - then the bugs the review found, then a part per mechanic on
  the server and a session built from slices in `client-core`, then the folders, the panes, the stylesheet and
  the sprite canvas. Each checkpoint lands on main when it passes. Asked for by Adam on 2026-10-02.
- **Real names on the edited world**: the rivers, lakes, seas and towns of 1790 carried onto Adam's
  master through an **origin map** a tool works out from his edits, which says where each piece of it was
  cut from on Earth, with **invented land** given invented names. It is what real history will stand on,
  before 1790 as the backstory of a place and after it as the warped history `SETTING.md` promises. Six
  steps in `docs/plans/real-world-names.md`; the first two are built, the plan and the origin map, which
  the Origin renderer shows and Adam's eye accepted (experiment 0016), and the third: Earth's rivers, lakes,
  peaks, seas and named lands are in the world, and the fourth: the towns of 1790, under the names English
  gave them then, reviewed in `world/names/1790.json` the whole world over, region by region, then again with
  Wikidata beside it, which added 62 towns Natural Earth lacks - Mocha, Seringapatam, Vila Rica - 3,168 in the
  world; the Info map renderer writes all of it as an atlas would. The game server
  reads them too, through a port and a contract (0087), and a roll's map omens name the river, the sea and the
  towns of 1790 in view. The rivers carry their names of 1790 too - the Tagus, the Maese, the Burrampooter.
  The lakes and seas carry theirs too - the Lake of Geneva, the German Ocean, the Archipelago. A click on a river,
  a lake or the sea opens an inspect window naming it, with a line or two about the great ones from
  `world/names/about.json`, which the server answers from revealed ground, and Take
  action with one open reads it as an omen, *Inspecting the Vistula*. Left for later: the
  823 places no source dates, and the named stretches of land, which keep today's names.
  Adam's own, asked for on 2026-10-06.
- **Structures**: castles, mills, cathedrals, prisons and shipyards, each a history of its own, held by a
  house and later a faction, paying their holder and lighting the map round them, with levels, slots for a
  prisoner, a king, a relic or a garrison, a look by the culture of the
  ground they stand on, a window, and a Holdings tab beside the key figures. The house's seat becomes the
  first of them, a castle raised at founding. The shape is decision record 0093 and the steps, one commit
  each, are in `docs/plans/structures.md`; the hypothesis is experiment 0018. Step nought, the documents,
  is written. It is also the first income in the game. Adam's own, planned with him on 2026-10-08.
- **The world cache**: a new tree up in 68 seconds rather than seventeen minutes, measured on 2026-10-12. All
  twelve steps are built and waiting on Adam's eye. Each step of the
  world (tiles, flow, sprite map, ground, origin, names, culture, height) is made once, filed on a shelf the
  whole machine shares under a fingerprint of everything it was made from, and borrowed by every tree with the
  same inputs; a change to the master, a world file or a world tool is a new fingerprint, so it is built again,
  once. `npm run world:ready` becomes the one way the world is built, for the quick start and the debug panel
  alike, and the architecture page draws it with a strip of how a tree starts. The shape is decision record
  0095 and the steps, one commit each, are in `docs/plans/world-cache.md`. Adam's own, asked for on 2026-10-12.
- **Quests**: a story with a goal, offered to a house whole and walked a node at a time - dialogue nodes,
  objective nodes that open to a checklist, reward nodes collected at the end - drawn as a map of nodes and
  edges over a scene, in a tab of the right column beside the dialogues. Some nodes are question marks, some
  are shown ahead, and a fork loses a road for good, crossed out. Objectives are met by the player, handing over
  or pledging resources, or by the world, a castle held on an island, which teaches the server what an island
  is. The shape is decision record 0096, the steps, one commit each, are in `docs/plans/quests.md`, and the
  hypothesis is experiment 0020. All twelve steps are built and on main, both roads of the sample played in the
  game, and the experiment waits on Adam's eye. Adam's own, planned with him on 2026-10-15.
- **Clouds**: weather over the world from zoom 7 out, gone by 4.5: painted clumps drifting with the world's one
  wind, the same sky in every browser, each with its shadow in the relief's violet, over the fog's haze and under
  every sign, parting round the player's marks; between 7 and 6 the camera is in them. Drawn in the sprite canvas
  (decision record 0098); the six steps, one commit each, are in `docs/plans/clouds.md`. Step 1, the clouds
  over the map, step 2, their part of the Shaders section, step 3, painted in three tones lit by the relief's
  light, step 4, their shadows, step 5, the camera in the clouds, and step 6, the clearings round the marks, are
  built: the whole plan, steps 3 to 6 a run Adam picked, waiting on his eye at its end. Asked for by Adam on 2026-10-15, with
  a photograph.
- **Catalogues**: the game's content moved out of the code into files under `world/catalogues/` - the
  structures, the balance, the pools and actions, the character names, the dialogues and the quests - each
  with an inspect page that reads it and edits it while the game runs, and a page of every picture beside
  them. The game server checks a catalogue before it takes it on, is the one that writes it when a page
  saves, and records each version it takes on as one event on the world's own stream, so a retuned number
  explains every income it moves. Every later plan with content in it builds its catalogue's page. The shape
  is decision record 0097 and the steps, one commit each, are in `docs/plans/catalogues.md`; all eighteen are
  built, in one run Adam asked for on 2026-10-16, and wait on his eye. Adam's own, planned with him on 2026-10-15.

MongoDB and RabbitMQ are on the machine, in Docker, from `infra/docker-compose.yml`. The game server keeps
its world in MongoDB whenever Docker is running, and RabbitMQ carries every event it stores to the read models.

## Later

Wanted, not started, and each needs a hypothesis in `docs/experiments/` before any code.

- **A responsive interface.** Both forms have a layout now: the stage folds into two bays below 600 on its
  shorter side and unfolds at 660 (0040), and the spread is tiles on a map that never overlap (0041). What
  goes in them is settled too. The corner tabs between the house status and **navigation** (0042); the
  choice roll is a pane with three sizes (0044); every pane carries one **pane size control** (0045); how
  much of the stage each bay gets belongs to the fold rather than to the panes, so the three sizes mean
  the same thing everywhere and moving a pane resizes nothing (0046); the compass stands in the corner and
  opens the bay under the thumb (0047); the join between the bays is drawn (0048); a link goes one
  place (0049); on a desktop the letter is put away to a chip or opened out over everything under a veil,
  the corner and the right column are never both opened out, and a press on any pane put away opens it
  (0085, 0045); and every tile and every window on the rail glides to its new size (0086). What is left is
  **touch**, which nothing has answered: hover lifts a parchment and the map
  is driven by drag and wheel. The camera is also still not told which part of the map the tiles are
  covering, so *show it on the map* can fly a thing to under the column.
- **An inspect window that stays up to date.** A window says what it last knew once the camera has left its
  subject, and one that knows nothing asks the gateway once and is answered by the fog's rule (0088), so it no
  longer depends on where the map is. What is left is keeping an open window live while its subject changes out
  of view, which nothing has needed yet. If one ever does, it becomes a subscription, as your own house already
  is: the gateway sends it to the **session** rather than to a cell. A subject with no stream, a piece of flavour
  with some lore attached, needs none of it.
- **Somewhere the player can read the credits.** Three of the world's sources are CC-BY and must be
  credited. The map used to do it and did it on one renderer of six, so it does not any more (0050); the
  credit is in `AUTHORING-THE-WORLD.md` and there is nowhere in the game a player could find it. An about
  or credits surface, before anything is released.
- **Opening the instruments to Adam alone.** They can be closed: `villages.instruments=false` refuses every
  lever and the four looks - the event page, seeing everything, the fog's switch and the wipe - to every
  socket, and the player's own commands go on (0076). What is not built is keeping them open for Adam on a
  server others play on, which wants an identity of his own; until then a shared server runs them closed.
  That has to stand before any dialogue carries the setting's secret, which the server otherwise holds back
  (0071).
- **The inspect window**, beyond a house and an area: what it says about a subject once there is more than
  a name and a treasury to say, where its links come from, and whether it is a card or a paper on the desk.
  See `MECHANICS.md`.
- **Something for a resource to be for.** The five exist and can be granted, spent, pledged and gated, and
  nothing in the game does any of it: no mechanic gives a house wealth, no rule asks whether it has enough
  domain, and a pledge is tied to a purpose in free text. The engine is built and waiting on a mechanic to
  use it; experiment 0005 is not settled until one does. This is also what a **choice roll** is meant to
  cost, so the two are entangled.
- **The house status**, beyond the five figures. It says what a house has now; what it does not say is
  what is happening to it, and nobody has named the second of the five empty places in its bar. See
  `MECHANICS.md`.
- **House leanings**: what identity is made of, and how the world reflects it.
- **Neighbours**: awareness of nearby houses, and the first thing two houses can do to each other.
- **The workbench**: the desk the map lies on becomes a place, with the house's papers on it and the map a
  quarter of it, hovered and scrolled into. The same camera; see experiment 0003.
- **Accounts** behind the identity port.
- **World persistence**, after which the event store is never wiped and event changes need upcasters.
- **The biome sprite map**: the first half of the world-generator, and the half that needs nothing said
  about people. A program that reads the master, decides what kind of place every part of the world is,
  and arranges the scenery into stands that a painted forest shapes, instead of the even carpet 0006
  measured. Seven increments in `docs/plans/biome-sprite-map.md`; the hypothesis is experiment 0007.
- **The world-generator**, the other half: settlements inferred from the terrain, ways between them,
  worked ground around them, and marks of time. Experiment 0006 proved the machine will draw it and
  found the budget by hand; the path is `docs/plans/world-generator.md`. The largest thing on this list
  and the one that would change how the world reads most.
- **More than one game server on one world**: what RabbitMQ was chosen for, and what the broker of decision
  record 0094 leaves ready but does not do. A player's session and its takeover, the reactions, the wipe and the
  instruments reaching across servers; the read models saved with a checkpoint, so a start does not fold the
  whole history; a gateway that keeps no read models of its own and binds only its sessions' cells, which the
  routing key already carries. Left out of 1.6 on purpose, 2026-10-12.
- **Aliveness and scale**: a bot swarm to ten thousand connections on one machine, aggregation of sprites at
  low zoom, a custom stylised map style checked in, hardened reconnection and clock correction. The scale
  the architecture is designed for is not in doubt; proving it is simply not next.

## Future ideas

Not commitments. Nobody is waiting on any of these.

- **The banner drawn** from its own tinctures and charges instead of a plain shield. A luxury feature: it
  would look good and no part of the game is waiting for it.
