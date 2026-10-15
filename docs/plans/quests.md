# Quests

**What belongs here:** how quests get built - what a quest holds, its nodes and objectives, its commands and
events, the rules that must hold, what crosses the wire, the pane, the debug section, and the order it all
gets built in. **What does not:** why it is shaped this way, which is decision record 0096; what the mechanic
is and what the player meets, in plain words, which is `MECHANICS.md`'s entry **Quest**; the words, which are
`GLOSSARY.md`; the hypothesis, which is experiment 0020. When a part of it is decided, that part becomes a
decision record and leaves.

Planned on 2026-10-15 from Adam's description and his answers, recorded in the sections they settled.

---

## The problem, in one paragraph

A house can be offered a dialogue, a roll and a choice, and nothing in the game strings them together into a
story with a goal. `MECHANICS.md` has said since the first dialogue that a storyline is *the mechanic a quest,
a pact or a betrayal is actually delivered in*, and every plan since has left "in a storyline" for later.
Adam's brief is a quest drawn as **nodes joined by edges** in a pane over a scene, as a dialogue is: a dialogue
node, an objective node that opens to a little checklist, and a reward node; a node that is a question mark
until it is reached; a node far ahead shown from the start; and a fork that is the player taking one road and
losing the other, drawn crossed out. Most of the work is not the drawing. It is that a quest is long, that
parts of it are met by the player and parts by the world, and that what the player has not reached stays on
the server. The events are the important half; the pane may be rewritten.

## What Adam settled

On 2026-10-15, beside the brief:

- **A resource objective is handed over.** A press pays it and ticks it: *Deliver*. A stock grows with income
  and nothing is written when it passes a number, so a box that ticked itself would need the server to wake
  up for it.
- **A reward is collected** by a press, so the player sees it land and the quest ends on that press.
- **The pane is its own tab in the right column**, beside the dialogues, tall and over its scene.
- **The server is taught what an island is**, so *a castle on an island* can be asked.
- **`metQuestObjective`** rather than `metObjective`, and **an event for losing the way to a node**,
  `lostQuestNode`, rather than leaving it to be worked out.

## What a quest holds

Recorded whole on the event that offers it.

| | what | notes |
|---|---|---|
| id | worked out from the house and the command that offered it | as a dialogue's is, so a resend is refused rather than doubled |
| title | a line | what the list shows, and the purpose of any pledge made for it |
| scene | a picture's key, or none | from `world/scenes/`, the dialogues' folder |
| nodes | each: an id, a kind, a title, **hidden**, **shown ahead**, and its edges out | the first is where it starts; ids are words, so a quest written by hand reads |
| edges | each: the node it leads to, and for an edge out of a dialogue node the endings of the dialogue that lead along it | several edges out is a fork |
| shown from the start | yes or no | every node shown ahead; a shorthand for marking each |

**The three kinds of node**, a sealed `QuestNode`:

| Kind | Holds | Arriving | Done when |
|---|---|---|---|
| Dialogue | a **Dialogue**, whole | the dialogue is offered to the house, from the same decision | the dialogue ends; which ending picks the edge |
| Objective | one to six **objectives**, the checklist | nothing is written; the world-met ones may tick at once | its last objective is ticked |
| Reward | what it gives: a grant of one or more resources | nothing is written; it waits | the player collects it |

**The objectives in this plan**, a sealed `Objective`, in two families:

| Objective | Met by | Holds | Meeting it writes |
|---|---|---|---|
| **Deliver** | the player, pressing *Deliver* | a resource, an amount | the spend; refused unless that much is **Free** |
| **Pledge** | the player, pressing *Pledge* | a resource, an amount, a span in months | the **Pledge**, its purpose the quest's title, its day worked out from the months as it is met; refused unless that much is free |
| **Hold a structure** | the world | a structure type, and where: anywhere, or on an island | nothing but the tick, in the story of what met it; met at once if the house already holds one when the node is reached, and once ticked it stays ticked |

A new kind is one case. One the player meets says what its press costs, as an **Effect**; one the world meets
is one more branch of what the listener checks. *Defeat an enemy*, when there are enemies, is the second.

**A quest checks itself when it is made**, as a dialogue does:

- a title, at least one node, ids that are words and unique within it, every edge leading to a node it has;
- no loops, so every road ends, and every node reached from the start;
- a fork only at a dialogue node, and every ending of that node's dialogue leading along exactly one of its
  edges; an objective or a reward node has one edge out at most;
- an objective node holds one to six objectives with ids unique within it, amounts more than nothing and spans
  of at least a month; a reward gives something, and only grants.

## What the player is shown, worked out and never written

One pure function, `Quest.walk`, reads the offer and the events after it and says, for each node: done, where
the quest stands, ahead, or lost; and whether it is drawn, and drawn as a question mark or as what it is.

- **Drawn**: every node done, the node it stands at, every node one edge from any of those, and every node
  shown ahead.
- **A question mark**: a hidden node not yet reached. A node reached, or lost, is shown for what it is, so the
  player sees what they missed.
- **An edge** is drawn when either end is; to a node not drawn it is a stub. It is walked, ahead or lost.
- **Each node's row**, how far down it stands, is worked out from the whole quest, so a node shown ahead
  stands as far down as it really is and the unknown above it is left blank.

## The commands and events

All on the house's stream, `house:<uuid>`, as a dialogue's are. A quest is play rather than a happening in
the world, so its events are the player's half, a new family, `QuestEvent`. The names are Adam's of
2026-10-15.

| Type | Payload | Meaning |
|---|---|---|
| `villages.player.offeredQuest.v1` | `houseId`, `player`, `quest`, `worldTime`, `recordedAt` | The house was offered a quest, whole: every node with what it is and how it is shown, every edge, objective and reward, and every dialogue inside it. The roads not taken are history too. Its first node is reached from the same decision. |
| `villages.player.metQuestObjective.v1` | `houseId`, `player`, `questId`, `nodeId`, `objectiveId`, `worldTime`, `recordedAt` | One objective of the node the quest stands at was ticked. What it cost follows as the world's own event from the same decision; one the world met is in the story of the event that met it. |
| `villages.player.completedQuestNode.v1` | `houseId`, `player`, `questId`, `nodeId`, `onto`, `worldTime`, `recordedAt` | The quest moved past a node along the edge to `onto`, none when it was the last. The nodes it can no longer reach follow, then what the next node does on arrival, from the same decision. |
| `villages.player.lostQuestNode.v1` | `houseId`, `player`, `questId`, `nodeId`, `worldTime`, `recordedAt` | The house lost the way to a node: the road taken does not lead there. One for every node a step cut off, drawn or not, after the `completedQuestNode` that took the other road. Its own event, as `completedDialogue` is, so nothing waiting on a lost node has to work it out from the graph; a later cause writes the same event. |
| `villages.player.completedQuest.v1` | `houseId`, `player`, `questId`, `worldTime`, `recordedAt` | The quest's last node was done. Written in the same decision, after it. |
| `villages.player.lostQuest.v1` | `houseId`, `player`, `questId`, `because`, `worldTime`, `recordedAt` | The quest lapsed because the dialogue of the node it stood at was lost, and `because` is that dialogue's failed **Requirement**. When a whole quest is lost, this alone says so. |

Every event carries the two times last, and the classes are `PlayerOfferedQuest`, `PlayerMetQuestObjective`,
`PlayerCompletedQuestNode`, `PlayerLostQuestNode`, `PlayerCompletedQuest` and `PlayerLostQuest`.

`onto` is the one field a reader could work out, from the dialogue's ending. It is carried so a quest's road is
read from its own events alone, as a choice's is from `tookAction.optionId`.

**What a quest writes that exists already**, from the same decisions:

| Event | When |
|---|---|
| `villages.player.offeredDialogue.v1` | A dialogue node is reached; the dialogue's id is worked out from the quest and the node, so it is offered once. |
| `villages.player.completedDialogueStep.v1`, `villages.player.completedDialogue.v1` | Playing it, as today; the last step is followed by `completedQuestNode`. |
| `villages.player.lostDialogue.v1` | It lapses, followed by `lostQuest`. |
| `villages.house.resourceSpent.v1` | A *Deliver* is met. |
| `villages.house.resourcePledged.v1` | A *Pledge* is met. |
| `villages.house.resourceReleased.v1` | That pledge's span runs out, written by the pledges listener as for any pledge. |
| `villages.house.resourceGranted.v1` | A reward is collected, one for each resource it gives. |

| Command | From | Writes | Refused with |
|---|---|---|---|
| `OfferQuest(quest)` | the debug panel's sample; later the world | `offeredQuest`, then the first node's arrival | `NoSuchHouse`, `InvalidQuest`, `QuestAlreadyOffered` |
| `MeetObjective(questId, nodeId, objectiveId)` | the player, `meetObjective` | the cost, `metQuestObjective`, and on the last objective `completedQuestNode` and what follows it | `NoSuchQuest`, `QuestOver`, `NotTheCurrentNode`, `NoSuchObjective`, `ObjectiveAlreadyMet`, `NotThePlayersToMeet`, and the treasury's refusals |
| `MarkObjectiveMet(questId, nodeId, objectiveId)` | the listener for objectives, never the wire | `metQuestObjective`, and the same | the same, with `NotTheWorldsToMeet` for `NotThePlayersToMeet` |
| `CollectReward(questId, nodeId)` | the player, `collectReward` | the grants, `completedQuestNode`, and `completedQuest` on the last node | `NoSuchQuest`, `QuestOver`, `NotTheCurrentNode`, `NotAReward` |
| `CompleteDialogueStep`, `FailRequirement`, as today | | also move the quest of the dialogue node it was, with the road not taken lost, or lose it | as today |

- **The walk allows a move.** `Quest.walk` is shared by the decider and the gateway, as `Dialogue.walk` is,
  so the two cannot come to disagree about where a quest stands or what is drawn.
- **What a node costs and gives goes through `Effect` and `Follow`** (`Effects.kt`), as every part's does:
  `Spend` for a delivery, `Grant` for a reward, `Converse` for a dialogue node's arrival, and one new case,
  `Effect.Pledge`, followed into the treasury's own pledge rule.
- **A dialogue's end and loss reach the quest in the same decision.** `HouseDecider` hands the dialogue part's
  events to the quest part, which answers with its own, so the step on the last line, what it gives, the end,
  the node done, the road lost and the next node's arrival are one append.
- **Steps continue the offer's story**, as a dialogue's do: the gateway gives `meetObjective` and
  `collectReward` the offer's correlation id, read from the quests' read model.
- **The new sealed types get their `kind`**: the node, the objective, where, and the new effect, in a
  `QuestJson.kt` beside `DialogueJson.kt`, each written by a fixture.

## The rules that must hold

| Rule | Held by | When |
|---|---|---|
| A quest is whole and sound, by every check above | the quest itself, as it is made | before anything is written |
| The same quest is never offered twice, nor any of its dialogues | the house: the ids it was offered, and dialogue ids worked out from quest and node | at once |
| A quest stands at one node, and moves only along an edge it has | the house, through the walk | at once |
| An objective is ticked once, and only while the quest stands at its node | the house | at once |
| A node is done once - its last objective ticked, its dialogue ended or its reward collected - so a reward pays once | the house, in one decision | at once |
| A lost node is never reached, and is lost once, in the decision that cut off its last road | the house, through the walk | at once |
| A delivery or a pledge never takes what is not free | the treasury, its existing rule | at once |
| A dialogue's end moves its quest on, and its loss loses it | the house, both on its stream | at once |
| *Hold a structure* is ticked when the house holds a matching one | the listener for objectives, carrying it from the structure's stream to the house's | **a moment after.** In between the box is empty, and nothing but the box waits on it. A structure lost again before the tick lands is ticked all the same, as 0071 accepts a step landing after a death. |
| What a house has not reached, and is not shown ahead, never leaves the server | the gateway's view, from the walk | every frame |
| A pledge made for a quest comes back when its span ends | the pledges listener, as for any pledge | a moment after its day |

## The listener for objectives

`QuestObjectives`, a `Reaction`, ticks what the world meets. It keeps the rules every listener that acts on
its own keeps (`ARCHITECTURE.md`, "What acts on its own"): one subscription from the beginning, a fold of its
own, commands through `Later`, `NoSuchHouse` swallowed, and a place in the wipe.

- **It folds** the structures - type, place, holder, ruin - as `StandingEffects` does, and each house's open
  quests with the world-met objectives of the node each stands at.
- **It asks** when a structure is raised, rebuilt or changes hands, for its holder; and when a quest reaches
  an objective node, for that house, so one already held ticks at once.
- **It sends** `MarkObjectiveMet` in the story of the event that met it, and takes `ObjectiveAlreadyMet`,
  `NotTheCurrentNode` and `QuestOver` as already done.
- A new world-met kind is one more branch of what it checks, and nothing else in it changes.

## Islands

The server reads the ground (0084) and knows water by what it is joined to, and no land at all. `GroundMap`
gains the twin of `waterJoinedTo`: a fill over land, wrapping at the antimeridian, measuring each land mass
from its cells' areas. **An island is a land mass smaller than the smallest continent.** The number is measured
on the master in its step, from the sizes the fill finds, and is Adam's to tune. The listener asks through a
port. No world tool changes and nothing is rebuilt.

## What crosses the wire

The player's quests, `yourQuests`, on hello and whenever one of them changes, from a `QuestsProjection` per
house behind a `QuestsByHouse` port. For each quest:

| | what |
|---|---|
| id and revision | the revision rises with every change |
| title, scene, ending | open, completed, or lost with the requirement that failed |
| nodes drawn | each with its id, its row and its state; a question mark nothing more; one shown for what it is its kind and title, and its checklist - each objective's words, ticked or not, and whether the player meets it - or what it gives |
| edges | walked, ahead or lost, with a stub where the far end is not drawn |

Nothing that is not drawn is sent, and no node's contents behind a question mark. In: `offerQuest { sample }`
from the debug panel, naming the sample and none of its words, because a client that could write a quest could
write itself a reward; `meetObjective { questId, nodeId, objectiveId }` and `collectReward { questId, nodeId }`
from the pane. `PROTOCOL_VERSION` rises from 48 each time the wire moves, with its recording beside the others.

## The pane

What it draws at each size will be `MECHANICS.md`'s; this is what it needs. Second to the events, and may be
rewritten.

- **A second tab of the right column**, beside the dialogues, `QUEST_PANE` in `quests/pane.ts` and a line in
  `panes.tsx`. The column learns to take turns as the corner does: `sharedBy` and `isTabbed` in
  `stage/bayBox.ts` already let any bay but the rail share, and `SHARED_TILES` in `stage/panes.ts` knows only
  the corner, whose sizes are heights where the column's are widths.
- **Two states**, as the dialogues have: the list, open quests first and then those finished and lost; and a
  quest, over its scene (`dialogues/Scene.tsx`), its map read from the top down. A node pressed opens its card:
  the checklist with *Deliver* and *Pledge*, greyed with the reason while the house cannot pay; for a dialogue
  node a way to its conversation, which turns to the dialogues' tab; for a reward what it gives and *Collect*.
- **The layout** is a pure module in `packages/client-core`: the rows from the server, and places within a row
  chosen to keep edges from crossing, tested. The admin pages' xyflow and dagre stay there, because the
  library may import neither (`ui/boundary.test.ts`).
- **The library first**, each shown at `/admin/inspect-ui-components` in every state before a pane uses it:
  the quest node in each kind and state (done, where it stands, ahead, question mark, lost); the edge (walked,
  ahead, lost, stub); the quest map, positioned nodes and the edges between them drawn in SVG; and the
  checklist row (open, ticked, payable, cannot pay, the world's to tick). New marks, placeholders: a question
  mark, a tick, a cross, a chest and a checklist. **Before drawing them, ask Adam whether each of *Deliver*,
  *Pledge*, *Collect* and the quests' tab is a mark or words.**
- **It arrives the usual way**: a quest offered opens the tab, as `dialogues/opening.ts` opens the dialogues.

## The Quests section

A new folding section of the debug panel, between Dialogues and Log, holding only *offer a quest*: the sample,
written in the server as the dialogue's is. It stands in for the world, which offers no quest yet; reading,
meeting, collecting and seeing how one ended are the player's, in the pane. What happens is said in the log
under `quests`.

**The sample, *The abbot of the isle***, every word and number a placeholder:

```
            [1 The abbot at the gate]            dialogue, where it starts
              /                   \
   answer well                     answer badly
            /                       \
 [2 ? A gift to the mission]   [3 ? A light on the water]     hidden, one edge ahead
   pledge 30 piety, 6 months     hold a castle on an island
            \                     deliver 60 wealth
             \                   /
            [4 ? The consecration]               dialogue, hidden, shown ahead: two edges in, one out
                       |
            [5 The abbot's blessing]             reward, shown ahead: 150 piety, 40 influence
```

The abbot is not a character, so a house needs no key figure to be offered it. Answered well, node 3 is lost
and shown crossed out; answered badly, node 2, the cheap road, is, and the house must hold a castle on an
island instead.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **The documents.** This plan, decision record 0096, the entry **Quest** in `MECHANICS.md`, the glossary's words, the roadmap and experiment 0020's hypothesis. | 1. Read the entry **Quest** in `MECHANICS.md`: is it the mechanic you described? 2. Read the six events in this plan's table of commands and events. |
| 2 | **The quest and its walk**, in the domain: the value, its checks, `Quest.walk`. Nothing to see. Done: `Quest.kt` holds the quest, its three kinds of node, the edge and the objective in its two families, and refuses as `InvalidQuest`; `QuestWalk.kt` works out where it stands, what is done and lost (`cutOffBy`), what is drawn and as what, how each edge is drawn, and each node's row (`rows`). `QuestFixtures.kt` is the sample's shape. | 1. The checks: `QuestSpec` refuses each unsound quest; `QuestWalkSpec` walks both roads of the sample, a fork losing the other road, a join, and question marks shown ahead. |
| 3 | **Offered, on the server**: `OfferQuest`, `offeredQuest`, the house's quest part, the first node reached, the stored form, fixtures and catalogue. Nothing to see. Done: `Quests.kt` is the house's part, the `QuestCommand` and `QuestEvent` families are new, and a starting dialogue node is offered through `Effect.Converse`; `QuestJson.kt` names every node, objective and place by its `kind`, and the format spec reaches through an objective's two families to its cases. | 1. The checks: `HouseQuestsSpec`, given, when, then; the event format and catalogue specs. |
| 4 | **Ticked and collected, on the server**: `MeetObjective` for *Deliver* and *Pledge* (`Effect.Pledge`), `metQuestObjective`, `completedQuestNode`, `CollectReward`, `completedQuest`. Nothing to see. Done, with `MarkObjectiveMet` for what the world meets and its refusals. A pledge became an effect, so it crossed the wire: version 49 carries a `pledge` effect view, `PledgeEffectView` because `PledgeView` is a live pledge already. A pledge's id and day come with `MeetObjective` as `Pledging`, because the calendar is not the domain's. | 1. The checks: a delivery refused while not free, a pledge tied and later released, a reward paid once. |
| 5 | **A dialogue node moves it on**: its ending picks the edge, the road not taken is lost (`lostQuestNode`), and a lost dialogue loses the quest (`lostQuest`). Nothing to see. Done: `HouseDecider` hands what the dialogue part wrote to `Quests.answering`, which moves a quest standing at that dialogue's node along the edge its last step's line leads along, losing what the move cut off, or loses the quest when the dialogue lapsed. | 1. The checks: both endings of the abbot's dialogue, each losing the other road's node, and a speaker's death. |
| 6 | **Offered from the debug panel**: `SampleQuests.kt`, `QuestService`, the Quests section's *offer a quest*, `offerQuest` on the wire, the log. Built: wire version 50, the lever in `QuestLevers.kt` beside the structures' own, `QuestsSection.tsx` below Dialogues. | 1. 👀 Debug panel, Quests, *offer a quest*: the log says it was offered. 2. 👀 `/admin/inspect-events`: the offer whole, and the abbot's dialogue in the same story. 3. 👀 The dialogue pane opens on the abbot. |
| 7 | **Sent to the page**: `QuestsProjection`, `yourQuests` with only what is drawn, the slice in `client-core`, the log's words. | 1. 👀 Play the abbot's dialogue and answer badly: the log says the quest moved on and node 2 was lost. 2. The checks: the views spec holds that nothing behind a question mark is sent. |
| 8 | **The server knows islands**: land masses from the ground map, the threshold measured, and the Structures section saying whether the open structure stands on an island. | 1. 👀 Open a castle's window on an island, then one on a continent: the Structures section says which. 2. The number: how many islands, and the largest island against the smallest continent. |
| 9 | **The world ticks a box**: *Hold a structure*, `QuestObjectives`, `MarkObjectiveMet`, and its place in `ARCHITECTURE.md`'s "What acts on its own". | 1. 👀 On the bad road, raise a castle on an island and *take control of this building*: the log says the box was ticked. 2. 👀 A house that already holds one has it ticked as the node is reached. |
| 10 | **The parts in the library**: the quest node, the edge, the quest map, the checklist row, the new marks. Mark or words asked first. | 1. 👀 `/admin/inspect-ui-components`, Quests: every kind and state readable, on parchment and night, on a desktop and at 390 wide. |
| 11 | **The quests' tab**: the right column taking turns, the layout, the list, a quest over its scene with its map, and a quest offered opening it. | 1. 👀 Offer the sample: the tab opens on the map, the abbot lit, two question marks below, a question mark half-way down with two edges in, the blessing at the foot. 2. 👀 Turn to the dialogues and back, at the column's three sizes and on a phone. |
| 12 | **Played in the pane**: a node's card, *Deliver* and *Pledge*, a dialogue node opening its conversation, *Collect*, and the lost drawn crossed out. | 1. 👀 Play the good road to *Collect*: the house card goes up. 2. 👀 Wipe, and play the bad road: the cheap road crossed out and shown, then the castle, the delivery, the collection. |

The order is a suggestion, as every order here is. Islands (8) and the listener (9) need only step 3, and the
library (10) needs nothing.

## Not in this plan

- Quests offered by the world: on arrival, from a roll's option - one more `Effect`, as `Converse` is - and a
  file Adam writes them in.
- More kinds of objective: defeat an enemy, reach a place, hold a key figure. Each is a case, and what its
  press costs or a branch of the listener.
- A checklist any one objective of which will do, and a fork at an objective node, the first objective met
  picking the edge. An edge already carries what leads along it, so this is room to grow and not a rework.
- A resource objective that ticks itself when the house has the amount, which needs the server to wake as
  income passes the line.
- A dialogue node whose dialogue is dealt by a choice roll rather than offered when the node is reached.
- Turning a quest down, abandoning one, a quest expiring, and requirements of a quest's own beyond its
  dialogues'.
- A cause many houses pledge to, which would be a history of its own.
- A player building a structure; the debug panel raises the castle for now.
- The feel: a node lighting, an edge drawing itself, a reward landing.
