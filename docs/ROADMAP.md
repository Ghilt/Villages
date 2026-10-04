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
significance, and its provenance. Two browsers see each other's houses live. Everything is in memory: there
is no MongoDB and no RabbitMQ on the machine yet.

## Now

Characters and key figures are built and waiting on Adam's eye. Nothing else here is started, and the four
after them wait on the same thing. Fog of war, the exception, is under way a step at a time, and so is
character dialogue, the newest; the UI component library is built and waiting on Adam's eye.

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
  to read the ground so the map can be an omen. The steps, one commit each, are in
  `docs/plans/choice-roll.md`; none is built. Adam's own, planned with him on 2026-10-04.
- **A place for every mechanic**: the review of 2026-10-02 found each mechanic threaded by hand through the
  same thirteen shared files, and those files growing with every one. The fix is a plan of 43 steps over eleven
  checkpoints that Adam smoke-tests: two checks that stop the growth - the size ceilings (0072) and a rule for
  which folder of the web app may import which - then the bugs the review found, then a part per mechanic on
  the server and a session built from slices in `client-core`, then the folders, the panes, the stylesheet and
  the sprite canvas. Each checkpoint lands on main when it passes. Asked for by Adam on 2026-10-02.
- **0.4** Local infrastructure: MongoDB replica set and RabbitMQ in Compose
- **0.8** Testcontainers smoke test on MongoDB and RabbitMQ
- **1.6** The bridge from the store to the broker
- **0.13** End-to-end smoke test
- **0.14** One check script for the whole repository
- **1.15** The connection badge, the last piece of inspecting a house

Blocked on the machine: Docker Desktop with the WSL2 backend, needed by the first three. Everything runs in
memory until it exists, which is why nothing survives a restart.

## Later

Wanted, not started, and each needs a hypothesis in `docs/experiments/` before any code.

- **A responsive interface.** Both forms have a layout now: the stage folds into two bays below 600 on its
  shorter side and unfolds at 660 (0040), and the spread is tiles on a map that never overlap (0041). What
  goes in them is settled too. The corner tabs between the house status and **navigation** (0042); the
  choice roll is a pane with three sizes (0044); every pane carries one **pane size control** (0045); how
  much of the stage each bay gets belongs to the fold rather than to the panes, so the three sizes mean
  the same thing everywhere and moving a pane resizes nothing (0046); the compass stands in the corner and
  opens the bay under the thumb (0047); the join between the bays is drawn (0048); and a link goes one
  place (0049). What is left is **touch**, which nothing has answered: hover lifts a parchment and the map
  is driven by drag and wheel. The camera is also still not told which part of the map the tiles are
  covering, so *show it on the map* can fly a thing to under the column.
- **An inspect window that stays up to date.** A window is fed from the cells the camera is holding, so
  panning away from a house leaves it with nothing to say. Your own house is the exception and shows the
  shape of the answer: the gateway sends it to the **session** rather than to a cell. An open window
  should be a subscription the same way - a frame, a version at both ends, a recording beside the old
  ones - and then a window on anything with an event stream is never stale. A subject with no stream, a
  piece of flavour with some lore attached, needs none of it.
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
- **Holdings on the map beyond the seat.**
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
- **Aliveness and scale**: a bot swarm to ten thousand connections on one machine, aggregation of sprites at
  low zoom, a custom stylised map style checked in, hardened reconnection and clock correction. The scale
  the architecture is designed for is not in doubt; proving it is simply not next.

## Future ideas

Not commitments. Nobody is waiting on any of these.

- **A ticking resource.** Some resource shown as a ticking income, which is what the rate shape in decision
  0006 exists for. The shape is on the wire and the browser knows how to count with it; every rate is zero
  because nothing generates income. The first mechanic that gives a house an income turns this on, and it
  is a number changing rather than a frame changing.
- **The banner drawn** from its own tinctures and charges instead of a plain shield. A luxury feature: it
  would look good and no part of the game is waiting for it.
