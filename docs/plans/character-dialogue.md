# Character dialogue

**What belongs here:** how character dialogue gets built - what a dialogue holds, its commands and events,
its requirements and what carries their failures, what crosses the wire, what the pane and its new bay
need, and the order it all gets built in. **What does not:** why it is shaped this way, which is decision
record 0067; what the mechanic is for and what its pane does, which is `MECHANICS.md`; the words, which are
`GLOSSARY.md`; the hypothesis, which is experiment 0014. When a part of it is decided, that part becomes a
decision record and leaves.

---

## The problem, in one paragraph

A house can be put a choice and can hold key figures, and nobody in the world has ever said a word. Adam's
brief is a conversation offered to the house whole, stepped through in a pane of its own down the right of
the screen, which can pay the house as it goes, is picked up where it was left, and ends with a line saying
why when a requirement the player never saw fails. Most of the work is not the bubbles. It is that a
conversation is long and a house's history is not a transcript: only what decides or pays something is
written down, the rest is rebuilt from the dialogue itself, and what the player has not reached stays on the
server.

## What a dialogue is

Recorded whole on the event that offers it.

| | what | notes |
|---|---|---|
| id | derived from the house and the command that offered it | as a character's is, so a resend is refused rather than doubled |
| title | a line | what the list shows |
| scene | a picture's key, or none | from `world/scenes/`, once step 11 has made the folder |
| speakers | each: an id, a party, a name, a portrait's key or none, a character id or none | a speaker with no character id is somebody who is not a character, a messenger say |
| lines | each: an id, a speaker, the words, what saying it gives, whether it is recorded, and what follows | the first line is where it opens; a line's id and a speaker's are words, so a dialogue written by hand reads |
| what follows a line | another line, a dialogue choice of two to four option lines, or the end | a line followed by the end is always recorded |
| requirements | any it was written to need | every speaker with a character id is also required alive, which is worked out rather than written |

What a line gives is the existing `Effect`, with a new case: `Effect.Grant(resource, amount)` beside
`FoundAt`. A requirement is one sealed type, `Requirement`, which is also what a loss names as its cause; its
one kind in this plan is `Alive(character)`, and how another kind is added is below.

A dialogue checks itself when it is made, as `Choice` does:

- a title, at least one line, ids that are words and unique within it, and every speaker and line it refers
  to present;
- no cycles, so every path ends, and every line reached from the first, so nothing written goes unsaid. A
  conversation that comes back to a question it asked is refused for now;
- every dialogue choice offering two to four options;
- no effect a step could be refused: a `FoundAt`, or a grant of nothing.

## The commands and events

All on the house's stream. The dialogue's own events are the player's half; what a step gives is the
world's.

| Command | Events, from one decision | Refused with |
|---|---|---|
| `OfferDialogue(dialogue)` | `villages.player.offeredDialogue.v1`: houseId, player, dialogue | `NoSuchHouse`, `InvalidDialogue`, `DialogueAlreadyOffered` |
| `CompleteDialogueStep(dialogueId, lineId)` | `villages.player.completedDialogueStep.v1`: houseId, player, dialogueId, lineId; then each of the line's effects as the world's own event, `villages.house.resourceGranted.v1` for a grant; then `villages.player.completedDialogue.v1`: houseId, player, dialogueId, if the line ends it | `NoSuchHouse`, `NoSuchDialogue`, `DialogueOver`, `NotTheNextStep` |
| `FailRequirement(requirement)`, from the listener below | `villages.player.lostDialogue.v1`: houseId, player, dialogueId, because, for each open dialogue that required it; nothing, if none did | `NoSuchHouse` |

Every event carries the two times last, and the classes are `PlayerOfferedDialogue`,
`PlayerCompletedDialogueStep`, `PlayerCompletedDialogue` and `PlayerLostDialogue`.

- **A step is the walk's to allow.** `Dialogue.walk(taken)`, a pure function in the domain, says what has
  been said, the stretch still to read up to and including the next step, and the options pending when the
  stretch ends in a dialogue choice. `CompleteDialogueStep` is accepted for the stretch's last line or for
  one of those options, and nothing else. That is what pays a reward once on every path, re-joining paths
  and all.
- **An effect follows the step as it follows an action.** `follows` in `HouseDecider` already turns a
  founding option into `HouseFounded`; it learns the grant, and a choice's option can grant too. `GiveChoice`
  refuses a grant option to a house not yet founded, by the rule it keeps for founding already.
- **Steps continue the offer's story.** The gateway gives a step the offer's correlation id, read from the
  dialogues projection the way `pendingStory` reads a pending choice's for `TakeAction`.
- **The new sealed types get their `kind`.** What follows a line, and a requirement, get mix-ins beside
  `EffectJson.kt`, and the fixtures carry every case of every one of them: a type Jackson can write and not
  read back would make every later command on that house throw.
- **A house keeps its open dialogues** and how far each has got, as it keeps its pledges, and the ids of
  every dialogue it was ever offered, for the resend.

## Requirements, and what carries a failure

A requirement is a value, and each kind answers two questions: what in the world it depends on, and which
event breaks it. `Alive(character)` is the one kind in this plan, and a death breaks it. The kinds are one
sealed type in the domain, and which requirements an event breaks is one pure function beside them, so a new
kind - a building still standing, broken when the building is destroyed - is one more case and one more line
of that function, and nothing else in this section changes for it. Like every case of a sealed field, it
also takes its `kind` in the store and a fixture that writes it, and a test fails until it has both.

- **What a dialogue depends on** is read off the event that offered it: its requirements, the speakers'
  being alive among them.
- **One listener carries every failure.** It follows the feed from the beginning with an index, built from
  the history, of which open dialogues depend on which requirements, and a note of every requirement that
  has failed for good. For each event it asks the domain which requirements the event breaks, and sends each
  house with a dialogue that depends on one of them `FailRequirement(it)`, continuing the story of the event
  that broke it. A dialogue offered with a requirement that has already failed - somebody already dead - is
  sent the failure at once.
- **The house decides what a failure ends.** `FailRequirement` lapses every open dialogue that required it,
  in one decision. A failure that touches nothing writes nothing, so a replay does no harm.
- The listener keeps the rules every listener that acts on its own keeps (`ARCHITECTURE.md`, "What acts on
  its own"): one subscription from the beginning, a fold of its own, commands through `Later`, `NoSuchHouse`
  swallowed, and a place on the wipe's reset list in `WorldConfig.kt`. It never changes for a new kind of
  requirement.

A step landing between a death and its failure reaching the house is accepted and pays; decision record 0067
records that, as 0055 records its own race.

## What crosses the wire

The player's dialogues, `yourDialogues`, on hello and whenever one of them changes, from a new
`DialoguesProjection` per house, the way `yourKeyFigures` comes from the characters projection. For each
dialogue:

| | what |
|---|---|
| id and revision | the revision rises with every change, so the page keeps its reading place while it holds |
| title, scene, speakers | |
| said | the lines along the path taken, each with what it gave |
| next | the stretch still to read, up to and including the next step, or the line a dialogue choice follows |
| options | the dialogue choice's options, when the stretch ends in one |
| ending | open, completed, or lost with the requirement that failed |

Nothing past the stretch is sent, and no requirement, unless the window's Dialogues section has asked for
them with its switch, which the gateway keeps for that one connection as it keeps `fogOfWar`.

Two commands. The debug panel's offer names which sample it wants and none of its words, because a client
that could write a dialogue could write itself a reward. The step is `completeDialogueStep { dialogueId,
lineId }`. The wire moves four times: version 13 lets a choice's effect be a grant, 14 carries the debug
offer, 15 the dialogues and the switch, and 16 the step.

## The pane

What it draws at each size is `MECHANICS.md`'s; this is what it needs.

- `DIALOGUE_PANE` in `stage/panes.ts`, standing from the house's first dialogue on. `standingPanes` stops
  taking one flag for the choice and takes what is present, and a speech mark joins `stage/Icons.tsx`.
- The list and the conversation are two states of one pane, as the key figures' grid and details are
  (`figures/view.ts`).
- **The reading place is a pure module in `packages/client-core`**: which lines of the stretch are showing,
  whether a press shows the next line or sends the step, and nothing to press while a step is out. It keys
  the bubbles by line id and keeps its place while the revision holds, and a reload reads the stretch again
  from its start.
- It arrives the usual way: in the spread the pane appears, or opens from its strip, and on a phone it
  takes the bay that is not the map's, at half, with `takeOver` and `roomToRead`, as `inspect/opening.ts`
  opens a window with `awayFromTheMap()`.
- What a line gave is drawn with the house card's own marks (`marks/Mark.tsx`), and a face with
  `figures/Portrait.tsx`.
- A lost dialogue's closing line is the interface's words, in one place, one line for each kind of
  requirement: *Sadly, X died before this could be finished*. A placeholder for Adam's own.

## The right bay

A new tile, `right`, in `stage/bayBox.ts`, set into the stage's right edge as the column is set into the
left. The rule to build and test in step 7:

- 480 wide at the normal size, half the stage opened out and never less than the normal size, and a strip
  at the top when it is put away.
- Never within a gutter of the wider of the rail and the corner, so the corner opened out is counted too.
- The letter along the bottom is centred between the two columns while it has its 281 there; otherwise it
  keeps the place it has today and the right column stops a gutter above it.
- The sweep in `bayBox.test.ts` gains a loop over the right tile, and the letter's floor test gains its cases.

What the arithmetic already says, to be judged by eye in step 7's decision record: below about 784 wide the
open column leaves no map; the letter moves from under the column to between the two columns at about 1172;
and the debug panel's badge and the map's controls in the bottom right corner sit under the column's top and
foot.

## The scenes

`world/scenes/`, Adam's folder, committed as the portraits are, and on their pattern:

- a script that draws placeholders and never writes over a file that is there, like
  `packages/world/bin/drawPortraits.ts`;
- the dev server serving `/scenes/` with no cache, like `apps/web/vite/portraitsApi.ts`;
- a test holding the folder to its rules, like `packages/world/src/portraitFolder.test.ts`.

How big a scene is, and how the speakers stand in it, is decided in step 11.

## The Dialogues section

A new folding section of the debug panel, between Characters and Log.

- *offer a dialogue*: the sample, written in the server as the founding choice's words are
  (`FoundingChoices.kt`), between a character and a messenger, with one dialogue choice and one purse of
  wealth. The character is the house's first key figure, because *add a key figure* is the only way a
  character comes into the world yet, so the lever is off, saying why on hover, while the house has none.
- Every dialogue the house has, where it has got to and how it ended, and its requirements while the switch
  shows them.

A speaker's death is tried with *kill*, in the Characters section.

## The steps, one commit each

1. **The documents.** This plan, decision record 0067, experiment 0014, the mechanic's entry and its UI
   section, the glossary's words, the roadmap and the architecture. Nothing to run.
2. **Offered, on the server.** Done. `Dialogue` checks itself as it is made, `Requirement.Alive` is its one
   kind, and `OfferDialogue` writes `PlayerOfferedDialogue`, refused for a house that does not exist and
   for the same offer twice; the house keeps its open dialogues and every id it was offered. `Effect.Grant`
   is a choice's effect as well as a line's, on the wire from version 13. Every case of every sealed field
   has its `kind` in the store and a fixture that writes it, which a test holds. `DialogueSpec` and
   `HouseDeciderSpec` are the evidence.
3. **Stepped and completed, on the server**, in two commits, because together they came to the size of step
   2. The walk is done: `Dialogue.walk`, in `Walk.kt`, works out from the steps taken what has been said,
   the stretch still to read and the options pending, and `Dialogue.isStep` says which lines are steps;
   `DialogueWalkSpec` walks every path, paths that meet again, and steps that are not a path. Then
   `CompleteDialogueStep` with what it gives and the end from one decision, the refusals and their reason
   codes; `BUILDING-A-MECHANIC.md` gains the shape. Nothing to see; the specs are the evidence.
4. **Offered from the debug panel.** The sample, and the Dialogues section with its lever. Wire version 14.
   The log says what was offered, and the event is at `/admin/inspect-events`.
5. **Sent to the player.** The dialogues projection, `yourDialogues` holding back what has not been reached,
   the revisions, and the requirements switch. Wire version 15. The Dialogues section lists them.
6. **Dialogues lapse.** The pure function of which requirements an event breaks, the listener that carries
   a failure, and `FailRequirement` in the house's rules; `PlayerLostDialogue` joins the catalogue, and
   `ARCHITECTURE.md`'s "What acts on its own" gains the listener. *Kill* a speaker and the Dialogues section
   says the dialogue was lost, and why. The listener's spec also tries it with a made-up rule of what breaks
   what, to show that it knows no kinds.
7. **The right bay**, and the pane standing in it, opening when a dialogue arrives. The decision records for
   the bay and for drawing a dialogue in the DOM rather than in Pixi, and `RESPONSIVE-DESIGN.md`. The column,
   its three sizes, and a phone.
8. **The list**: waiting and finished, scrolling.
9. **A conversation you can play.** The reading place in `client-core`, the step on the wire (version 16),
   the bubbles with a portrait and a name beside each, from the left and the right by party, *next*, a
   dialogue choice's options, and picking up where it was left. **Before drawing it, ask Adam whether *next*
   is a mark or a word.**
10. **What it gives and how it ends.** A gain in the feed, and the house card's wealth going up with it; a
    lost dialogue's closing line; a finished one read back.
11. **The scene.** The folder, its placeholders, serving it, its test, and the speakers standing in it at
    the top of the pane.
12. **The feel.** Fades, speakers entering and leaving, the one speaking reacting, and less of all of it for
    anybody who has asked for less motion.

The order is a suggestion, as every order here is. Every step stands on the one before it except two:
dialogues lapsing (6) needs only step 5, and the scene needs only the conversation.

## Not in this plan

- Other kinds of requirement. Each is a case, the event that breaks it and a line of words for its lapse; a
  building still standing is the example. A requirement about time needs a wake-up besides, because nothing
  writes that a day has come, and a kind that can come true again - a house having enough of something - is
  asked at the offer rather than remembered as failed.
- Dialogues from the world: on arrival, from a choice's outcome, in a storyline. And a file Adam writes them
  in.
- A dialogue choice shaped when it is reached rather than when it is written: options with requirements of
  their own, or rolled like a choice roll.
- A choice roll inside a dialogue.
- A highlighted word opening an inspect window.
- A conversation that comes back to a question.
- Gating the event page and the debug frames, which the roadmap asks for before any dialogue carries the
  setting's secret.
- A dialogue between two players' houses.
- Snapshots of a long stream.
