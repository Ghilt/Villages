# 0071. A dialogue is offered whole, and stepped where it matters, on the house's stream

- Status: accepted
- Date: 2026-09-27
- Amended 2026-09-30: a line can **spend** as well as grant, on Adam's word, and what a line does is its
  `effects`. A spend is refused when the house has not that much free, which would make a dialogue
  impassable at that line, so the rule below about effects a step could be refused is kept by two more:
  only an option may spend, and every dialogue choice keeps an option that costs nothing. A house that
  cannot pay answers otherwise, and is never stuck.
- Amended 2026-09-30: an option shows what taking it will do by its **reveal impact**, on Adam's word,
  written by hand on the option rather than worked out by reading ahead down its path: *shown*, a resource
  and an amount each and a cost below nothing, so *-40 wealth, +100 wealth*; *hidden*, drawn as unknown; or
  none, and what it does is seen when it is done. It is sent with the options before the choice, which is
  its point, and it promises nothing: what the house is given or spends is still the lines' effects, and
  keeping the two in step is the writer's. Only an option may carry one.
- Amended 2026-10-01: **a requirement is never sent to a page**, on Adam's word. The debug panel's switch that
  asked the gateway for them is gone with its frame, because all the debug panel does for dialogues is offer
  one; reading, answering and seeing how one ended are the player's, in the pane. A player learns of a
  requirement only when it fails, as why the dialogue was lost.
- Amended 2026-10-02: a line can **show** something as it is reached while playing, on Adam's word: a place,
  which the camera is taken to, or a house or a character, which a window is opened on. It is written with the
  line, so it is offered whole with it, and the game server tells the page what a line shows only while the
  line is still ahead, so the page learns it no earlier than the line and never after the line is said;
  reaching it records nothing a plain line would not. A line read back shows nothing, his call too, and
  that is how. The page shows each line's thing once in its life, and an option's once the house has taken
  it, since the house can refuse one.

## Context

`MECHANICS.md` has described **character dialogue** since the mechanics were first written down, and left
open the two questions that decide its events: what the world remembers of a dialogue, and whether one can
be left and returned to. `ARCHITECTURE.md` said in so many words that what the server owes a dialogue was
undecided until the first of them was answered.

Adam answered both, and more:

> i imagine dialogues as being somethign that are offered to the player ... this offered event contains the
> whole dialogue and all paths the player can take.

A line can pay the house "after a certain thing gets said", a step event records that as the player goes,
so that a dialogue left in the middle is picked up in the right place, and the end is an event of its own.
Then, in a second round:

> The basic requirement is that 'party 1 is alive' party 2 is alive. If any of them die, and the user have
> slowplayed it and only finished 2 out of 3 steps, then there will be a message finishing the dialogue
> saying that 'sadly character X died before this dialogue could be finished'. ... All these requirements
> are hidden to the player, they only know of them when they fail.

And in a third, once a draft had taken his examples, a death and a day, for the whole design:

> Deaths and days were just examples (though death's we should definatly hook up as part of this quest). I
> want the requirement system for the dialogues to be easily extendable. If some dialogue depends on a
> building in the future then that hypothetical event BuildingDestroyed, should be easily hooked into
> terminating a dialogue.

Four facts about the program shape the answer.

- **The choice pattern already records a decision whole** (0034): the choice with every option's effect on
  the event that gives it, and the action with what it does from one decision.
- **Every command reads the house's whole history first.** The executor loads the stream, folds it and
  decides (`Events.kt` in `infrastructure-occurrent`), and nothing snapshots a stream, so whatever a house's
  stream holds, every later command on that house reads again.
- **What a house may not know is kept back by the server, not hidden by the page** (0061), so the fog is not
  a curtain a player could simply stop drawing.
- **A house's decisions cannot see another stream.** A character's death is on the character's stream, and
  only a listener on the feed can carry it to a house's, as the listener for character deaths already does
  for key figures (0055).

And one about the setting: dialogue is the only place its secret is allowed to come out, and only over a long
time (`SETTING.md`, `MECHANICS.md`).

## Decision

**A dialogue is offered to the house whole, on the house's own stream.** `PlayerOfferedDialogue` carries
everything: a title, a scene, the speakers, every line, every dialogue choice, what each line gives, and the
requirements. The roads not taken are history, as a choice's are, and every step is checked against it with
nothing but the house's own history. A dialogue is offered only to a house that exists, several can be open
at once, and its id is derived from the command that offered it, as a character's is, so a resend is refused
rather than doubled.

**What a dialogue is made of.** A **speaker** has a **party** - a number saying which side of the
conversation they are on - a name, a portrait, and a character id when they are somebody in the world, so a
messenger can speak without being a character. A **line** has a speaker, its words, what saying it gives the
house, and what follows it: another line, a **dialogue choice** of two to four option lines, or the end. The
party says who is with whom and nothing about a screen; the pane puts even parties on one side and odd ones
on the other. A dialogue choice is not a choice roll. Anything about the house that shapes a dialogue - who
is loyal to it, what it has - is settled when the dialogue is written and offered, and from then on the
dialogue is fixed.

**Only the steps that matter are recorded.** A **dialogue step** is taking an option of a dialogue choice,
or reaching a line that gives something, is marked to be recorded, or ends the dialogue.
`PlayerCompletedDialogueStep` carries the ids and nothing else. The plain lines between are read in the
browser and never written down: because every option taken is recorded, the path so far can be rebuilt from
the dialogue alone.

**What a step gives is the world's, from the same decision.** What a line gives is the same `Effect` a
choice's option carries, with a case for granting a resource beside founding. The step's decision writes the
step and then each effect as the world's own event - `HouseResourceGranted` for a grant - in the dialogue's
story, exactly as taking a founding option writes the action and then the founding. An offer is refused any
effect a step could later be refused, a founding or a grant of nothing, because one would make the dialogue
impassable.

**The end is its own fact, from the same decision as the step that reaches it.** A line followed by the end
is always a step, and its decision also writes `PlayerCompletedDialogue`. There is no command for finishing.

**The walk is one function.** Where a dialogue has got to - what has been said, the stretch still to read up
to the next step, and the options pending - is one pure function in the domain. The decider accepts a step
for the last line of the stretch or for one of the options, and for nothing else; the gateway builds what
the player is sent from the same walk. A dialogue that could loop is refused when it is offered, so the walk
always ends, and on any path a line's reward is paid once.

**Requirements are hidden, and one failing ends the dialogue.** Every speaker who is a character must stay
alive, which is worked out from the speakers rather than written, and a dialogue can be written to need more
besides. The player learns of a requirement only when it fails. The loss is its own event,
`PlayerLostDialogue`, naming the requirement that failed, so `PlayerCompletedDialogue` keeps meaning that a
dialogue reached its end, and nothing waiting on one can take a failure for a success. The pane closes a lost
dialogue with a line saying why, in words the interface keeps for each kind of requirement.

**A requirement is a value, and one listener carries every failure.** Each kind of requirement answers two
questions: what in the world it depends on, and which event breaks it. `Alive(character)` is the one kind
built now, and a death breaks it. The kinds are one sealed type in the domain, and which requirements an
event breaks is one pure function beside them. One listener follows the feed with an index, built from the
history, of which open dialogues depend on which requirements. When an event breaks one, it sends each house
with a dialogue that depends on it `FailRequirement`, in the story of the event that broke it. A dialogue
offered with a requirement already failed for good - somebody already dead - is sent the failure at once.
What a failure ends is the house's own rules, decided in `decide`: every open dialogue that required it
lapses, all in one decision. A failure that touches nothing writes nothing, so a replay does no harm.

**So a new kind of requirement is two answers and a line of words.** A dialogue that depends on a building -
Adam's example - needs a kind for a building still standing, the building's destruction as the event that
breaks it, and the interface's line for the lapse. The listener, its index and the house's rule for
dialogues do not change. Time is the one kind that would need more, because nothing writes that a day has
come: a requirement about time needs a wake-up, as the pledge release has, and it is not built here.

**The server holds back what the player has not reached.** The player is sent, for each dialogue, what has
been said, the stretch still to read and the options pending: never a line past the next step, and never a
requirement. It is the fog's rule applied to a conversation, and it is for the setting's sake, because a
dialogue handed to the browser whole can be read ahead. (The debug panel could once ask for the requirements
for one window, the way *fog of war: off* lifts the fog for one; see the amendment of 2026-10-01.)

**Four events, all of them the player's.** Being told something and answering it is play rather than a
happening in the world - the line 0034 drew - so the offer, the step, the end and the loss are
`villages.player.*`. What a step gives is the world's.

| Event | Type |
|---|---|
| `PlayerOfferedDialogue` | `villages.player.offeredDialogue.v1` |
| `PlayerCompletedDialogueStep` | `villages.player.completedDialogueStep.v1` |
| `PlayerCompletedDialogue` | `villages.player.completedDialogue.v1` |
| `PlayerLostDialogue` | `villages.player.lostDialogue.v1` |

## Consequences

What becomes easier:

- **A new effect is one case for choices and dialogues alike.** A choice's option can grant from the day a
  line can, and the next effect - vision of a far coast, a key figure taken in, a choice put to the house -
  is one branch of the decider for both.
- **A dialogue is picked up anywhere**, on another device or after a reload, from the house's own history,
  and a finished one reads back exactly as it went.
- **A storyline waits on one event**, completed or lost, and needs no dialogue in hand to know which step
  was the last.
- **A new kind of requirement costs two answers in the domain and a line of words**, whatever it is about.

The costs, knowingly:

- **Every command on a house reads every dialogue it was ever offered.** A dialogue is kilobytes where most
  events are bytes, and nothing snapshots a stream yet. Harmless at this size; a snapshot, when one is
  needed, fixes it for every mechanic at once.
- **The words are content in the store**, as a choice's are (0034). Regretting a phrasing means a new version
  or the pre-alpha wipe.
- **The player's half grows by four**, to six: the half that is meant to stay small. A mechanic this central
  earns them, and none of them is a press of *next*.
- **A dialogue reopened lands at its last step**, up to a stretch of plain lines before where it was left.
  The state is exact; only the reading place is not.
- **A step can land between a death and its failure reaching the house.** The house cannot see the death,
  the failure arrives a moment later, and a step in that moment is accepted and pays; if it finishes the
  dialogue, the failure finds nothing open and the dialogue stands finished. It is the race 0055 accepts,
  for the same reason.
- **One death can be heard twice.** A character who is a house's key figure and speaks in one of its
  dialogues is heard of by two listeners: the listener for character deaths, which takes them out of the
  house's key figures as it does today, and the requirement listener, which lapses the dialogue, each for its
  own concern. Whether key figures should depend on requirements too is a question about key figures, and is
  not asked here.
- **A kind that can come true again is not remembered as failed.** A house having enough of something may
  stop being so and start again, so a kind like that would be asked at the offer rather than remembered by
  the listener, and none is built here.
- **The hold-back is only as good as the rest of the wire.** The event page is fed every stored event whole,
  dialogues and requirements included, and any socket can ask for that feed. It is an instrument of a
  pre-alpha, and has to be gated before any dialogue carries the setting's secret; the roadmap says so. (The
  switch that showed the requirements was a second such frame, and went on 2026-10-01.) Holding back also
  works only at a step: the plain lines of the stretch being read are in the browser, so a line that must
  stay unseen until it is read needs a step before it.
- **A conversation cannot come back to a question it asked** until the walk learns to loop. Such a dialogue
  is refused when offered, for now.

## Alternatives considered

- **Every *next* an event.** A dialogue reopened would land on its exact line. It would also make a
  conversation forty identical lines in the event page, make every press wait on the server, and make a
  house's history mostly presses. Rejected; it comes back if the exact reading place turns out to matter.
- **What a step gives, inside the step.** One event instead of two, and a second place a resource can
  change, which every read model that holds one would have to learn to look inside. Rejected.
- **A dialogue as a stream of its own**, with a reaction carrying what a step gives across to the house. The
  textbook answer, rejected as 0034 rejected the player aggregate: two writes, with a gap between a step and
  what it pays. A dialogue between two players' houses, which fits neither house's stream, would switch us.
- **The dialogue by reference**, an authored key and a version rather than the whole of it. Lighter, and a
  mistake in the words could be mended without a wipe. But the history would stop saying what was offered,
  and a dialogue written for one house - its people, its standing - is not a template. Rejected.
- **One event for both endings**, the completion saying how. One event fewer, and everything listening would
  have to check which. Adam chose an event of its own.
- **The whole dialogue sent to the page**, with all the stepping done there. The simplest, and it hands the
  lines ahead and the hidden requirements to anybody who opens the browser's tools. Rejected, for the fog's
  reason.
- **A command for finishing.** Needed only if the end could follow a plain line, and it would need a rule of
  its own to stop it skipping a reward still ahead. Making the end a step removes both.
- **A listener that knows what it listens for**: the first draft of this record, which gave it a name of its
  own and taught it deaths and days. Every new kind of fact would have been more code in it, and the rule of
  what a failure ends would have lived in it rather than in the house's decider. Rejected on Adam's word.
- **Key figures on the same requirements**, with the listener for character deaths folded into this one as
  the first thing that depends on `Alive`: a later draft. It mixed a question about key figures into a
  mechanic about characters talking, and a dialogue is between characters, whoever they are to the house.
  Taken out on Adam's word, and left to be asked about key figures on its own.
- **News for each kind of fact**: a command for a death and another for a day, each carried to the houses it
  concerns, which was the second draft. It took Adam's two examples for the whole design, so a building
  destroyed would have needed a third listener and a third command. Rejected for requirements that are
  values, whose failures one listener carries whatever they are about.
- **The broker as the index**: a binding in RabbitMQ for everything a house depends on, `character.<id>.died`
  to a queue for each house, so that the event system does the routing. The broker is not on the machine
  yet, and when it is, it carries events to the gateway servers by cell. A binding is state outside the
  history, lost with the broker and rebuilt only by reading the history, which the index does anyway. And a
  house is a history loaded when a command arrives, not something listening on a queue, so a queue per house
  would be tens of thousands of queues with nobody reading them. Rejected; when the broker comes, the
  listener reads from it, and nothing else changes.
