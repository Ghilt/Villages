# 0096. A quest is offered whole and walked on the house's stream, and its objectives are met by the player or by the world

- Status: accepted
- Date: 2026-10-15

## Context

Nothing in the game strings a dialogue, a roll and a choice together into a story with a goal. `MECHANICS.md`
has said since dialogue was first described that a storyline is told through it, and decision records 0071,
0083 and 0087 each left room for "a storyline" or "a questline" without saying what one is.

Adam's brief of 2026-10-15:

> it should be laid out in a pane, over a image just like the dialogs, it should be nodes connected by edges.
> each node is the next step.

Three kinds of node: a **dialogue**, which "triggers a dialogue that needs to be finished"; an **objective**,
which opens to a checklist of objectives that are "composeable and easily presentable"; and a **reward**,
"the terminating node will almost always be a reward". A node can be **hidden**, "just a questionmark node". A
quest can say which nodes far ahead the player sees in advance - the final one, say, or one half-way down
showing three edges in and one out - and some quests show every node. And a fork is a choice of roads: "if
they 'answer' the dialogue wrong, maybe both nodes gets revealed and one crossed out, which indicate a failure
state for a node which can no longer be reached."

The objectives he named - build a castle on an island, defeat an enemy, get resources, pledge them to a cause
- are of two sorts, and that turned out to be the whole question. Then, answering four questions that day: a
resource objective is **handed over** by a press; a reward is **collected** by a press; the pane is a tab of
the right column; and the server is to be taught what an island is. Reading the events back, he renamed one
(`metQuestObjective`) and asked for one more: an event for losing the way to a node.

Four facts about the program shape the answer.

- **A dialogue already does most of this** (0071): offered whole on the house's stream, only the steps that
  matter recorded, what a step gives written as the world's own event from the same decision, and a pure walk
  shared by the decider and the gateway, so nothing the player has not reached leaves the server.
- **A house's decisions cannot see another stream.** Who holds a castle is on the castle's stream (0093);
  only a listener on the feed can carry it to a house's.
- **A stock grows with nothing written** (0006). Income raises wealth between events, so no event marks the
  moment a house has two hundred of it, and nothing could notice it without a clock.
- **The server reads the ground** (0084) and knows water by the water it is joined to, but nothing about land.

## Decision

**A quest is offered to the house whole, on the house's own stream.** `PlayerOfferedQuest` carries every node,
every edge, every objective, every reward, and every dialogue inside it, so the roads not taken are history,
as a choice's and a dialogue's are. Its id is worked out from the command that offered it, so a resend is
refused rather than doubled. It checks itself when it is made: no loops, every node reached from the start,
and a fork only where a dialogue's ending can decide it. Its events are the player's half, as a dialogue's
are, because a quest is play rather than a happening in the world.

**It stands at one node and moves along an edge when the node is done**, and three kinds of node say when:
an objective node when its last objective is ticked, a dialogue node when its dialogue ends, a reward node when
the player collects it. Arriving at a dialogue node offers its dialogue from the same decision, through the
`Converse` effect a roll's gossip already uses. **A fork is decided by where a dialogue ends**: each edge out of
a dialogue node names the endings that lead along it, and every ending leads along exactly one.

**What is done and lost is written; how anything is shown is worked out.** `PlayerCompletedQuestNode` records
the node and the node it moved on to. Every node the move cut off follows as `PlayerLostQuestNode`, its own
event, so nothing waiting on a lost node has to work it out from the graph, and a later cause of loss - a
castle fallen - writes the same event. Whether a node is drawn, and drawn as a question mark or as what it is,
is never written: one pure function, `Quest.walk`, works it out from the offer and those events, and the
gateway sends only what it says is drawn, with nothing behind a question mark.

**An objective is a value, met either by the player or by the world.**

- **One the player meets costs something when pressed**, in the house's own rules and at once. A delivery is
  a spend and a pledge a pledge, both through the `Effect` every part already asks the treasury through, with
  `Effect.Pledge` new beside `Spend`. A resource objective is a hand-over, on Adam's word, because a box that
  ticked itself when a stock passed a number would need the server to wake for a moment no event marks.
- **One the world meets is ticked by one listener.** It folds what the world's objectives depend on, the
  structures and who holds them today, and each house's open quests. When the world meets an objective it
  sends the house `MarkObjectiveMet`, in the story of the event that met it. A node reached with its
  objective already met is ticked at once. Once ticked, an objective stays ticked. A tick is `PlayerMetQuestObjective`
  either way.
- A new kind of objective is one case: what its press costs, or one more branch of what the listener checks.

**A dialogue's end moves its quest on in the same decision**, and a lost dialogue loses its quest, as
`PlayerLostQuest` naming the same requirement, because both are on the house's stream: the house's decider
hands what the dialogue part wrote to the quest part, which answers with its own.

**A reward is collected**, on Adam's word, so the player sees it land and a quest ends on a press rather than
while they are away.

**An island is a land mass smaller than the smallest continent**, found by a fill over the ground map's land,
the twin of the fill that names water by what it is joined to. The threshold is measured on the master and is
Adam's to tune.

## Consequences

- A quest's whole road is in the house's history, and a player can be told only what the walk says is drawn.
  What lies behind a question mark is on the server, and a page that opens the browser's tools learns nothing
  more.
- The player's half of the catalogue grows by six events. They are what a quest is, and nothing in them is a
  happening in the world: what the house is given, spends and pledges is written as the world's own events
  beside them, as for a dialogue.
- `onto` on `PlayerCompletedQuestNode` is the one field a reader could work out, from the dialogue's ending.
  It is carried so a quest's road is read from its own events alone, as a choice's is from its action.
- An objective the world meets is ticked a moment after the world meets it. In between the box is empty, which
  is harmless because only the node waits on it. A castle lost again before the tick lands is ticked all the
  same, as 0071 accepts a step landing after a death.
- Every command on a house reads its whole stream, and a quest carries its dialogues whole: a long quest is a
  heavier offer than a dialogue, and the same snapshots that 0071 leaves for later would answer it.
- A fork can only be decided by a dialogue for now. An edge already carries what leads along it, so a fork
  decided by whichever objective is met first is a new condition rather than a new shape.

## Alternatives considered

- **A quest as a stream of its own**, with reactions carrying what it pays to the house. Rejected as 0071
  rejected it for a dialogue: two writes with a gap between a step and what it gives. A cause many houses
  pledge to, which fits no house's stream, would be the first quest-like thing to be one.
- **What is shown written down**, an event for every node coming into view or being shown for what it is.
  Every one of them follows from the offer and the moves; writing them would put a second answer beside the
  first that could come to disagree with it. Rejected. What is lost is written, because it is a fact about
  the road and not about the drawing, and Adam asked for it.
- **Lost nodes worked out and never written**, the first draft. Every listener and read model waiting on a
  lost node would have had to walk the graph to know. Rejected on Adam's word, for the reason
  `PlayerCompletedDialogue` is its own event.
- **A resource objective that ticks itself** when the house has the amount. It needs the server to wake up
  when income passes a line, and a box that can untick as wealth is spent elsewhere. Rejected for now on Adam's
  word; it comes with a clock if it comes.
- **A reward paid as soon as it is reached.** One command fewer, and a quest finished while the player was away
  would end with nobody watching. Rejected on Adam's word.
- **Objectives checked by the house when the player asks**, the world's included, by reading a read model in
  the application before the command. It would tick at once rather than a moment after, and it would put a
  rule about another history in a read that is a moment behind it. Rejected for the listener, which is how
  the program already carries a death to a dialogue.
- **The quest by reference**, a key to an authored quest rather than the whole of it. Rejected as for a
  dialogue: the history would stop saying what was offered.

## Amendment, 2026-10-23: the challenge node

A fourth kind of node: **a challenge node** puts a **Challenge** to the house (decision record 0107, amended the same
day).
- **Its terms are written in the node:** the kind, the opponent's name and colour, and the opponent's slices. They are
  checked against the challenge catalogue as the shelf is read.
- **It is done when the player accepts it** with slices of the house's own. The same decision fights it out and moves
  the quest on.

**It forks by outcome.** Its edges carry `won` and `lost` where a dialogue node's carry endings: the new condition
the record above foresaw, not a new shape.
- **Soundness:** a challenge node has exactly those two roads, both leading on, and a draw takes `lost`.
- **The fork's purpose:** in Adam's words, winning should be the cheaper road, and losing should lead to a node where
  the house pays.
