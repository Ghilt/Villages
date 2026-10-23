# Challenges, part four: in the game

**What belongs here:**
- how a challenge comes into the game: a quest's challenge node;
- the house's starting slices and choosing from them;
- the one decision that fights it;
- the pane where it is chosen for, watched, and kept in a history;
- the rules that must hold;
- the order it gets built in.

**What does not:**
- what the mechanic is for, which is `MECHANICS.md`;
- why it is shaped this way, which is decision record 0107 and its amendments, and 0096 for the quest;
- the words, which are `GLOSSARY.md`;
- the engine's rules, which are `challenges.md` and `challenge-matching.md`;
- the spectacle, which is `challenge-spectacle.md`.

When a part of it is decided, that part becomes a decision record and leaves.

Planned on 2026-10-23 from Adam's word, with the challenge spectacle on main.

## What Adam asked for

- **Plug the challenge into the game,** through a **challenge node** in a quest the debug panel offers.
- **The flow:**
  - press the node;
  - choose slices from the ones the house has;
  - **Accept challenge**;
  - watch it;
  - the quest takes the result and shows what came of it.
- **Nothing stored in between.** A challenge must never sit waiting to be started after it has stopped making sense, as
  a quest can with its timeouts.
- **Choosing slices is in scope; making them is not.** Every house holds the same **starting slices**, written in the
  catalogue.
- **The opponent's slices are not shown** before the challenge starts.
- **A challenge history** that states the participants and the result clearly.
- **Winning takes the cheaper road;** losing leads to a node where the house pays.
- **The right pane.** The bays are due a rework, so this placement is provisional.
- **One event:** `ResolvedChallenge`.

## The flow

`[ ]` is in the game today; `[- -]` is what this plan builds.

```
 [ debug panel: offer a quest ]   the Quests section's "offer a quest", any file in world/catalogues/quests/
            |
 [- quest node: a challenge -]     quest nodes today: dialogue, checklist, reward
            |  pressed on the quest map
            v
 [- choose your slices -]          the right column: the opponent's name, the kind, the house's starting slices,
            |                       up to three brought; the opponent's slices not shown
            |  "Accept challenge"
            v
 [ resolve ]                        Challenge.resolve(setup, seed, catalogue, rules), pure; the server draws the seed
            |
            v
 [- ONE decision on the house -]   resolvedChallenge, the whole challenge, then the quest's own
            |                       completedQuestNode onto the won or lost road and lostQuestNode for the other
     _______|________________________
    |                                |
    v                                v
 [- watch it -]                   [- the history -]   each challenge: who against whom, the kind, who won and how
    the spectacle, held deep,        |
    played for the first time        |  open one to watch it again
    |                                |
    v                                v
 [- the result -]  who won, how, and what the quest does next: the cheaper road, or the node that costs
```

**Why it is watertight.** A challenge does not exist until the moment it is accepted. Accepting it, fighting it,
recording it and the quest moving on are one decision on the house's stream, so they cannot come apart:
- there is never a challenge waiting to be started;
- there is never a fought challenge whose quest did not move on.

The only thing that waits is the quest's own node, and accepting is refused once that node is no longer the one the
quest stands at. The choosing screen keeps nothing; leave it and nothing is left behind.

## Design

**The starting slices.** A new section of `world/catalogues/challenges.json`, `startingSlices`, holds what every house
has until houses come by their own. There are about six, of different aspects, each written as the challenges page's
draft is:
- aspect, power, integrity, summon count;
- two effects of its own aspect;
- stand-ins where an effect has a slot.

Both strict readers take the section: `ChallengesFile.parse` on the server, `parseChallenges` in `packages/world`. So
does the shared fixture, `contracts/fixtures/challenges.json`. `ChallengeSetup.refusals` checks every one as the shelf
is read. Nothing is stored per house; the slices a challenge was fought with are in its event.

**The challenge node.** A fourth kind of quest node:

```json
"square": { "title": "The debate in the square",
            "challenge": { "kind": "debate", "against": { "name": "Brother Anselm", "colour": "#a8452a" },
                           "slices": [ "...the opponent's, written as the starting slices are..." ] },
            "then": { "won": "blessing", "lost": "penance" } }
```

- **Domain:** `ChallengeNode` in `Quest.kt`, and an edge that carries an outcome where a dialogue node's carries
  endings. Decision record 0096 foresaw this: "a new condition rather than a new shape".
- **Soundness:** a challenge node forks on `won` and `lost` alone, both present. A draw, the tug exactly even, takes
  `lost`.
- **The readers:** `QuestFile.kt`, `parseQuest`, `contracts/fixtures/quest.json`, and the stored quest's JSON with a
  `kind` of `challenge`.
- **Checked as the shelf is read:** `QuestTemplate.check` and `Catalogues.check` take the challenge catalogue. A kind
  that does not exist, or opponent slices `ChallengeSetup.refusals` refuses, fail then, not when the node is reached.

**The event, agreed with Adam: `villages.player.resolvedChallenge.v1`** (`PlayerResolvedChallenge`), on `house:<id>`.
The player accepted a challenge a quest put to them, with the slices they chose, and it was fought out on the spot. It
carries:
- the challenge's id;
- what raised it: the quest and the node;
- each side: the house, by id and name, and the opponent, by name and colour;
- the kind, the progression, both sides' slices as fought, and the seed;
- the catalogue's fingerprint and the engine's version;
- the outcome: the tug, how it ended, the second, who won, gains and losses.

In the same decision the quest moves on with the events it already has. `completedQuestNode` goes onto the road the
outcome names, `lostQuestNode` for each node the other road led to, then whatever the next node does on arrival.
Decision record 0107's `villages.challenge.resolved.v1` on `challenge:<id>` stays unbuilt, for challenges between two
houses. The row goes into `docs/EVENTS.md` in the step that builds it, because that catalogue is held to the code.

**The command.**
- `acceptChallenge {questId, nodeId, slices}` names the starting slices brought.
- The application finds the node and the starting slices, draws a seed and the progression from the kind
  (`Progressions.draw`), and fights it out (`Challenge.resolve`, pure). It hands the result to the house on the command,
  `AcceptChallenge(questId, nodeId, fought)`, as `QuestService.meet` hands the house its `Pledging`.
- The house refuses unless:
  - the quest is open and stands at the node;
  - the node is a challenge;
  - the fought setup is the node's: its kind and its opponent's slices;
  - the house's side is one to three of the starting slices, none twice.

**Invariants.** Every one is held at the instant, in the one decision; nothing is put right a moment after.

| Rule | Held by |
|---|---|
| A challenge exists only once it is fought; accepting, fighting and the quest moving on cannot come apart | one decision on the house writes `resolvedChallenge` and the quest's move together |
| A challenge node is fought once | the house refuses unless the quest stands at the node; after the decision it does not |
| It is fought on the node's terms, with the house's own slices | the house: the node's kind and opponent's slices; one to three starting slices, none twice |
| The quest moves on along the road the outcome names; a draw takes `lost` | the same decision |
| The opponent's slices are not shown before the challenge starts | the node's view on the wire carries only the kind and the opponent's name; the slices travel only in the run |
| The outcome is never worked out again | the stored event; a replay re-runs the moments alone, and says so if the catalogue or the engine has changed and the run comes out otherwise |
| A challenge node forks on `won` and `lost` alone, both leading on | the quest's soundness, as it is offered |

**The wire.** Each step that changes a frame raises `PROTOCOL_VERSION` at both ends and records the next
`contracts/protocol-v<n>.txt`.
- **The quest's node view** gains `kind: 'challenge'` and `challenge: {kind, against: {name, colour}}`, without the
  slices.
- **The command:** `acceptChallenge`.
- **The history:** `yourChallenges {challenges}`, pushed as `yourQuests` is, from a `ChallengesProjection` fed by
  `resolvedChallenge`. A row holds:
  - the challenge's id, the node's title and the quest's;
  - the kind;
  - both sides' names and colours;
  - the outcome: who won, the tug, pulled to the end or time ran out, the second;
  - when it was fought;
  - where the quest went.
- **The replay:** `watchChallenge {challengeId}` → `challengeRun {id, sides, houses, progression, moments, summons,
  outcome, differs}`. The moments are re-run from the stored seed and slices; decision record 0107 does not store them.

**The pane.** A new folder, `src/challenges/`, holds the pane, with `spread: 'right'`:
- **Where it sits:** a third tab of the right column beside the dialogues and the quests, below the map on a phone.
- **When it stands:** while the house has a challenge or one is being chosen for.
- **What it is built from:** the library's `SliceChip`, `List`/`ListRow`, `ScrollArea`, `Button` and the `Spectacle`,
  held deep.
- **Its mark:** a new one for its tab and the phone's bar.

It shows one of three screens:
1. **Choosing.** Pressing a challenge node on the quest map asks the pane to open on it, through an inbox like
   `quests/toOpen.ts`, and `arrive()` brings it in front.
   - **What it shows:** the opponent's name, the challenge's kind, and the house's starting slices as chips, each
     pressed to bring it or leave it, up to three.
   - **"Accept challenge"**, in words as Adam chose, sends the command.
2. **Watching.** As the decision lands the pane asks for the run and plays it, watched for the first time; the
   opponent's slices appear only now.
   - **When it ends:** a result card says who won, how, and what the quest does next, with a way back to the quest.
   - **The quest's road isn't given away:** the pane stands in front of the quest map in the shared column.
3. **The history.** Newest first. Each row reads like "House Varga against Brother Anselm, a debate, won by House
   Varga, pulled to the end in second 41", and opening one watches it again.

The pane also needs:
- **The game page's challenge catalogue:** `net/challenges.ts`, `shelved('challenges.json', parseChallenges)`, as
  `net/balance.ts` does. It serves the starting slices and the spectacle's content.
- **Its row:** `challenges` goes in row 4 of `layers.test.ts`, beside the surfaces it imports sideways, `spectacle`
  and `quests`, and in `TAKEN_UP`.

**The debug quest.** `world/catalogues/quests/the-debate.json`, offered from the debug panel's Quests section.
- **Its first node,** `square`: a debate against Brother Anselm, his side Reason and Generosity, like the challenges
  page's sample side B.
- **Won** leads to `blessing`, a reward: the cheaper road.
- **Lost** leads to `penance`, a checklist that asks the house to deliver 40 wealth, and then to `blessing`.

**Not in this plan:**
- Making slices, or slotting the house's own key figures and buildings.
- Gains and losses touching the house; the result shows them, and applying them is decision record 0107's listeners'.
- Challenges between houses.
- An editor for the starting slices on the challenges page; the file is edited by hand.

## Steps (one commit each, each handed over)

| # | Step | Verification requests |
|---|---|---|
| 1 | **Documents**: this plan; decision record 0107 amended (a challenge one house fights against the world is one decision on its stream; the starting slices; the opponent's slices hidden) and 0096 amended (the challenge node, roads by outcome); `MECHANICS.md`, Quest and Challenge; `GLOSSARY.md` (Challenge node, Starting slices, Challenge history); the roadmap | 1. Read the two amendments and the flow in `MECHANICS.md`. |
| 2 | **The challenge node**: the domain node and roads by outcome, soundness, both readers, the fixtures, the stored quest, `QuestTemplate.check` against the catalogue, the node's view on the wire, its mark on the quest map, the quest editor; the debug quest | 1. 👀 Offer `the-debate` from the debug panel: its map shows the challenge node with its mark, naming the kind and Brother Anselm and nothing of his slices. 2. 👀 `/admin/inspect-quests/the-debate` draws its won and lost roads. |
| 3 | **Accepting, on the server**: `startingSlices` in the catalogue, `acceptChallenge`, the application fighting it out, the house's one decision with `resolvedChallenge` and the quest's move, the refusals; `docs/EVENTS.md` | The checks: fought once; refused off the node, with slices not the house's, or more than three; won, lost and a draw each take their road; the event's format and its catalogue row. |
| 4 | **Choosing and accepting in the pane**: the game page's challenge catalogue, the challenges pane in the right column, opened from the quest node on its choosing screen, the chips, *Accept challenge* | 1. 👀 Offer the quest, press the challenge node: the right column shows Brother Anselm, a debate, and your starting slices to choose. 2. 👀 Choose two and accept: the quest moves on along the won or the lost road. |
| 5 | **The history**: `ChallengesProjection`, `yourChallenges`, the client's slice, the pane's list | 1. 👀 After accepting, the challenges tab lists it: who stood against whom, the kind, who won and how. |
| 6 | **Watching it, and the result** *(checkpoint: the whole flow)*: `watchChallenge` and `challengeRun`, the spectacle in the pane held deep, played on accepting, the result card naming what the quest does next | 1. 👀 Offer the quest, choose, accept, watch it in the right column, see the result, and go back to the quest on the right road. 2. 👀 Open it from the history and watch it again. |

Bringing it to main follows step 6, with `loop:to-main`.
