# 0092. A structure is a history of its own, and the seat is a role one plays

- Status: accepted
- Date: 2026-10-08
- Amends 0061 and 0089: a thing on revealed ground whose face can change is shown as it was when the fog
  hid it, worked out from its own history and the house's sight, still with nothing stored per player.
- Amends what `GLOSSARY.md` called a **Holding** (a seat and the ground about it) and a **Seat** (a
  `Location`), and what `ARCHITECTURE.md` left open under "What the setting asks".

## Context

Adam's brief of 2026-10-08 asks for buildings: things on the map with a sprite, that can be inspected and
are under the fog; held by a house now and a faction later; giving their holder income and other effects;
with levels, higher being better; with places in them for a prisoner, a king, a relic or an unfinished
galley, "quite permissive"; drawn differently by culture; and easy for a storyline to hook into. "None of
the code around the 'holding' we start with is holy": the architecture is to be made from scratch and the
starting holding fitted into it. He likes composition over inheritance, and characters, battles and
festivals will one day share the part of it that is being on the map.

What the program has is very little. A house's holding is one field, `seat: Location`, written once by
`villages.house.founded.v1` and read by some twenty places, from the houses' read model to the season a
roll is read in. The ground about it is worked out on the page and never stored. Every resource's rate is
zero and no event changes one. The documents, though, have long expected this: "a cathedral raised by one
house and ended by another" is shared state that cannot live in a house (`ARCHITECTURE.md`); "a house is
the first building rather than the definition of one" (0061); a dialogue requirement "a building still
standing" (0071).

Adam was interrogated about it the same day and pinned the words and the rules: they are `GLOSSARY.md`'s
rows of that date and `MECHANICS.md`'s entry **Structure**. Five of his answers shape what follows. A
structure gives its holder **income and sight** first, every held one. All four ways to come by one will
exist: building it, a story handing it over, taking it, and finding it standing in the world of 1790. The
**seat is a role** a holding plays, and a house that loses it plays on. The fog shows a structure **as it
was last seen**. And **each master has its own culture**, read off the ground the structure stands on.

## Decision

**A structure is its own stream, `structure:<uuid>`, and the authority on itself.** Its type, name,
presence, level, holder, slots and their contents, and whether it is a ruin are decided against
its own history, typed `villages.structure.<verb>.v<n>`. One holder at a time is its invariant. That a house
holds it is not a tie on the house, as a key figure is (0055), because two houses can contend for one
structure and only the structure can decide between them.

**Composed, not inherited.** A thing on the map is assembled from parts, each owned by one place:

- its **Presence** - a place, a significance and a span of world-time - which is what puts it in a cell,
  draws it and fogs it (0026);
- its identity as a **Subject**, `{kind, id}`, which is what lets a window open on it, a link or a line
  point at it, and one day a word of dialogue mention it;
- its **look**, worked out by the page from what it is and the ground under it, never stored;
- its **fog rule**: it stands still, so revealed ground shows it as last seen, or it moves, and only vision does.

A structure adds its holder, level and slots as parts of its aggregate, the way a founded house
has its treasury, key figures, sight and dialogues (0075). A battle or a festival would take a presence, a
subject and a fog rule and none of the rest; a character already has the first three, and moving them onto
the shared part is its own step.

**What a structure gives is derived, and only its consequence is recorded.** A pure function works out a
structure's **standing effects** from its type and level in the catalogue, what is in its slots and the
stats of the characters in them. Its consequences are written into the holder's
history by one listener, which keeps what each house gets from each structure it holds up to date and
writes only when that changes: `villages.house.incomeChanged.v1` for the rate, and the house's own
`gainedVision` and `lostVision`, carrying their radius, for the sight. Income has to be written, because a
treasury must know what it is owed in order to refuse a spend. Sight is written by Adam's choice, for the
same reason in the other direction: what was paid and what was seen are what was written, so retuning the
catalogue changes both from then on and never the past.

**Taking control writes one fact.** A hand-over is decided by the structure alone and written as one
event, `villages.structure.changedHands.v1`. The holder's pennant, its sight, its holdings and what the fog
shows all follow from that event; the income and sight of the new holder and the old, and a lost seat, are
written after it by listeners, in the same story.

**The seat is a role.** Founding a house raises a castle, held by the house, and names it the house's seat
with `villages.house.namedSeat.v1`, a tie on the house's own stream. Losing the castle writes `lostSeat`
and the house plays on without one until it names another. The founding event keeps its stored `seat`
field, now read as the place the house was founded, so no history is wiped.

**The catalogue is data.** `world/structures.json` holds every type: its words in each culture, and by
level its significance, sight, size and yields, its influence zone if it has one, and its slots with what
each takes, how many, who may see into it and how what fills it counts. The numbers are Adam's. The server
reads it once at start through a port; the page reads the copy cut beside the sprites.

**Culture is the ground's, per master.** Each master has a culture map, worked out from its origin map and a
handful of Earth anchors, and shown by a renderer of its own. The page reads it under a structure when it
draws one. The server never needs a culture, so it never needs to know which master a page is drawing.

**As last seen, without remembering.** The structures' read model keeps a structure's face - what it is,
its level, its holder, whether it is a ruin - as versions over world-time. A house is sent the version that
stood when the fog hid the place, which its sight's history already says, and the version of today where
it sees. Slots are never shown as last seen. The holder sees into all of them; another house sees into a
slot only where it has sight and the type does not keep that slot secret, and each place it cannot see
into is a question mark.

**Antarctica, for Adam.** While the instruments are open (0076), the server stands one structure of every
type in Antarctica, held by nobody, and the debug panel can hand the one selected to the player's own house
with the same `changedHands` any hand-over writes. It is the debug panel standing in for the world, not a
way for a player to take anything.

## Consequences

What becomes easier:

- **A storyline hook has somewhere to go.** What a structure gives is one pure function of its type, level
  and contents, so a way for a story to change it will be one more input rather than new machinery. The
  first proposal, **conditions** a story hangs on a structure, is out of scope on Adam's word of
  2026-10-08; nothing here depends on it.
- **Income exists**, a number moving rather than a frame being sent, as decision 0006 meant it to.
- **The next thing on the map** composes the parts it needs instead of copying a house.

Costs, knowingly:

- **The seat's twenty readers move**, in one step of their own, after structures can be seen and see.
- **A listener now sets numbers rather than ending ties.** A replayed history must not set an old rate or
  an old sight, so it writes nothing while it catches up and puts every one right once, after.
- **A hand-over writes up to six events**: one on the structure, and on the houses an income and a sight
  for each of the two holders and a lost seat - far fewer when nothing pays or nobody held it before.
- **Writing to two streams is not one decision.** A castle raised a moment before the house names it is a
  structure nobody calls a seat for that moment, harmless and healed by the reaction.
- **A face that changes asks the fog for its history.** Each structure sent is matched to the day the fog
  hid its place, a cost per structure per snapshot, kept to once by a cache that dies with the fog.
- **Culture moves with the paint.** A repainted master or anchor redraws its structures, which is the rule
  for everything derived from the master, and a castle never keeps the look it was raised in.

## Alternatives considered

- **Structures as a family on the house's stream**, as key figures are. Lost: a structure outlives and
  changes holders, and one holder at a time cannot be held by two houses' histories.
- **Income stored on the structure.** Lost: a rate is owed to a house, and the house's treasury is what
  refuses a spend.
- **Income worked out at read time and never recorded.** Lost: the treasury would have to know the rules,
  and a retuned catalogue would rewrite what every house was ever paid.
- **Sight worked out at read time**, as the seat's 34 km is today: no events, and tuning by eye instant.
  What was first proposed; lost when Adam chose that retuning should never rewrite what was seen.
- **A note on the income event of what made the number** - the type, level and contents - for
  the event page and for debugging, as the brief's notes suggested. Lost on Adam's word: the events stay
  lean, and the story around one says why.
- **Culture fixed on the structure when it is raised.** What was first proposed; lost when Adam said each
  master has its own culture. It would also have needed the server to choose one master for the world.
- **A remembered map per player** for the fog. Lost: the structure's own history and the house's sight
  already say what was seen when.
