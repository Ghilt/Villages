# Structures

**What belongs here:** how structures get built - what a structure's record holds, how what it gives
reaches its holder, how it is seen through the fog, what the map, its window, the Holdings tab and the
debug panel show, and the order it all gets built in. **What does not:** why it is shaped this way, which is
decision record 0092; what the mechanic is for, which is `MECHANICS.md`; the words, which are
`GLOSSARY.md`; the hypothesis, which is experiment 0018. When a part of it is decided, that part becomes a
decision record and leaves.

---

## The problem, in one paragraph

A house's holding is one field, a seat, and nothing in the world can be held, built, taken or lost. Adam's
brief of 2026-10-08 asks for structures - castles, mills, cathedrals, prisons, shipyards - on the map, under
the fog, inspectable, held by a house and later a faction, paying their holder and letting them see, with
levels, permissive slots for people and things, a look that depends on culture, and hooks a storyline can
use. Most of the work is in three places: a third kind of stream beside houses and characters; the first
income in the game, which means the first rate that is not zero; and a fog that has to remember a face
that can change without remembering anything per player.

## What a structure is

A structure is its own stream, `structure:<uuid>`, authoritative for everything about itself. A founding
castle's id is derived from its house (`villages:structure:seat:<houseId>`), so a replayed founding lands
on the same stream; a structure raised by a lever has an id derived from its command, as a character's is.

| | what | notes |
|---|---|---|
| type | `StructureType`, one of the catalogue's sixteen | `structureType` on the wire, because `type` is the frame discriminator |
| name | free text | "the mill at Dantzic"; a lever names it from the type and the nearest town |
| presence | place, significance, span | significance from the catalogue by type and level, carried on the event (0026) |
| level | 1 to the type's highest | three for every type to begin with |
| holder | a house, or nobody | a faction later; the wire reuses `HolderView {id, name, banner}` |
| slots | the catalogue's, by level | each holds contents up to its places |
| ruin | whether it has fallen | a ruin has no holder and gives nothing |

A **content** is a character, by id, or an **item**: an id minted when it is first put somewhere, a name,
a line about it, an amount or none, and standing effects of its own or none. A character is in one slot
at a time; the use case takes them out of the old one first, and they stand at the structure's place. Where
each item is, is a projection over the structures' events; an item gets a stream of its own only when one
starts to travel by itself.

### Events and commands

| Command | Event | Payload | Refused with |
|---|---|---|---|
| `RaiseStructure` | `villages.structure.raised.v1` | structureId, structureType, name, place, significance, level, holder | `AlreadyRaised`, `NoSuchType`, `InvalidLevel`, `InvalidLocation` |
| `HandOver(to)` | `villages.structure.changedHands.v1` | structureId, from, to | `NoSuchStructure`, `IsARuin`, `SameHolder` |
| `ChangeLevel(by)` | `villages.structure.levelChanged.v1` | structureId, level, significance | `NoSuchStructure`, `IsARuin`, `InvalidLevel` |
| `FillSlot(slot, content)` | `villages.structure.slotFilled.v1` | structureId, slot, content | `NoSuchStructure`, `NoSuchSlot`, `SlotFull`, `AlreadyInSlot` |
| `EmptySlot(slot, contentId)` | `villages.structure.slotEmptied.v1` | structureId, slot, contentId | `NoSuchStructure`, `NotInSlot` |
| `Rename(name)` | `villages.structure.renamed.v1` | structureId, name | `NoSuchStructure`, `InvalidName` |
| `Ruin(cause)` | `villages.structure.ruined.v1` | structureId, cause | `NoSuchStructure`, `IsARuin` |
| `Rebuild(type, level)` | `villages.structure.rebuilt.v1` | structureId, structureType, level, significance, holder | `NoSuchStructure`, `NotARuin` |

and on the house's stream:

| Command | Event | Payload | Refused with |
|---|---|---|---|
| `NameSeat(structure)` | `villages.house.namedSeat.v1` | houseId, structureId | `NoSuchHouse`, `SeatNamedBefore` for the founding one |
| `LoseSeat` | `villages.house.lostSeat.v1` | houseId, structureId | `NoSuchHouse`, `NoSeat` |
| `SetIncome(source, rates)` | `villages.house.incomeChanged.v1` | houseId, source, ratesPerSecond | `NoSuchHouse`; equal rates write nothing |
| `GiveVision` | `villages.house.gainedVision.v1`, today's | visionId, place, radius, and now `from`, the structure | as today |
| `TakeVision` | `villages.house.lostVision.v1`, today's | visionId | as today |

- **Taking control is one fact.** The debug panel's *take control of this building* is `HandOver` to the
  player's own house, and writes `changedHands` and nothing else on the structure. One holder at a time is
  held there, because only the structure's history says who holds it. Everything a hand-over changes for
  the two houses - income, sight, a lost seat - is written after it by listeners, in the same story: up
  to six events in all, and two - the hand-over and the new sight - when nobody held it and it pays
  nothing.
- **Slots are permissive in what they take and strict in how many.** What a slot takes is a hint the levers
  follow; a story may put a relic on a throne, and the rules simply read nothing from it. Its places are
  the catalogue's for the structure's level, and `SlotFull` is the one rule.
- **A ruin keeps its contents** until something takes them out: a relic under the rubble is a story.
- **Why an event happened is the story it belongs to**, not a field on it, as everywhere else.
- **`slotEmptied` empties one place**, not the whole slot: letting one prisoner out of cells that hold four
  leaves three.
- **The names are approved by Adam**, 2026-10-08, as every plan's are before it is built; he renamed the
  slot events to `slotFilled` and `slotEmptied`.

### Invariants

The rules that must always hold, and which history holds each. A rule held by one history is held at the
instant of the decision; a rule that spans two histories can only be put right a moment after, by a
listener, and the plan says so rather than pretending otherwise.

| Invariant | Held by | When |
|---|---|---|
| A structure has one holder at a time. | the structure | at once: only its history says who holds it |
| A ruin has no holder, cannot change hands, and has no level to change. | the structure | at once |
| A slot never holds more than its places at the structure's level. | the structure | at once, `SlotFull` |
| A level is not lowered while a slot holds more than the lower level allows. | the structure | at once, empty it first |
| A content is in a structure's slots at most once. | the structure | at once, `AlreadyInSlot` |
| A house never spends what it has not got. | the house | at once, as today |
| A house names its founding castle its seat once, whatever is replayed. | the house | at once, `SeatNamedBefore` |
| A character is in one slot at a time, across every structure. | the use case that fills a slot | a moment after: it empties the old slot first, and a race can leave someone in two, which a read model can see |
| A house's seat is one of its holdings. | the seats listener | a moment after: `lostSeat` follows the hand-over or the ruin |
| A house is paid by, and sees from, exactly the structures it holds, at what they give now. | the standing-effects listener | a moment after: the old holder is paid for a few milliseconds more |
| Antarctica's sixteen are raised once. | their derived ids | at once, `AlreadyRaised` on a restart |

Nothing on a house says which structures it holds, so no rule needs the house and the structure to agree
in one decision: holding is the structure's to say, and everything a house gets from it follows.

## What a structure gives

`standingEffectsOf(structure, catalogue, stats, at)` is pure and in the domain. It reads the type and
level's yields, then each slot's rule - a filled slot adds, a character's stat scales, an item brings its
own - and returns a list of `Income(resource, perMonth)` and `Sight(km)`. How a story will change what a
structure gives is out of scope: it was first proposed as conditions hung on a structure, and taken out on
Adam's word of 2026-10-08. When it comes it is one more input to this function.

**Both are written into the holder's history** by one listener, `StandingEffects`: income because a
treasury must know what it is owed, and sight because Adam chose that retuning the catalogue should never
rewrite what a house saw. What was paid and what was seen are what was written.

- **Sight** is the house's own `gainedVision`, carrying the catalogue's radius at that moment and, new, the
  structure it is seen `from`, so the sight panel can say so; `lostVision` ends it. A level changed is one
  of each. `SightProjection` folds them as it folds vision given outright today. Every type sees a little,
  so a holding is always in its holder's vision.
- It plans "reconcile house H for structure S" and works the numbers out when the task runs, from its own
  fold at that moment, so a change of hands - reconcile the old holder, reconcile the new - comes right in
  either order.
- It writes nothing while the history replays and reconciles everything once caught up, through a
  `caughtUp()` hook at the end of `Follower.start()`. A replay cannot set a rate or a sight a house no
  longer has.
- It folds the stats and deaths of characters in slots itself, as the listener for character deaths does.
- `Treasury` keeps rates per source; a stock's rate is their sum, re-based at every change. The catalogue
  is written per world month, which is a real day (0053), and the wire carries per second.

## Seen through the fog

`StructuresProjection` keeps each structure's **face** - type, level, holder, ruin, significance - as
versions over world-time, ignoring an event at or below the stream version already folded. The gateway
picks `versions.lastOrNull { since <= day }` for:

| where it stands, for this house | version sent |
|---|---|
| held by the house, significance 80 or more, or in vision | the one of the day asked |
| on revealed ground | the one of the day the fog hid the place, `hidOn(place, …)` |
| unknown | none |

`Fog.hidOn` is split to take a place, a significance and whether it is the house's own, so houses and
structures share it, and it is cached in `Fog` per structure and day; `Fog` is replaced whole when sight
changes, so the cache cannot go stale. A change under the fog sends nothing. "Gone" is sent only when a
version is no longer admitted in a cell the page holds. A structure raised after the fog hid its place is
not sent.

On the page, the structures slice keeps a copy only while its stamp is newer than the snapshot's `asOf`,
so going back a day or losing sight replaces the newer face with the older one (today `houses.ts` keeps the
higher version, which would be wrong here).

**Slots are never shown as last seen.** The holder sees into all of them. Another house in sight sees into
the slots the catalogue calls public, and of the rest only how many places there are, each a question mark;
out of sight, nothing.

## The catalogue

`world/structures.json`, committed and Adam's to tune. Per type: its words in each culture; by level its
significance, sight in kilometres, ground height and yields per month; an influence zone or none; and its
slots: a name, what it takes (`character`, `item`, `either`), places by level, who sees into it (`all`,
`holder`) and how what fills it counts (`adds`, a stat that scales, an item's own). The numbers below are a
first draft.

| Type | Slots: takes · places by level · seen by | Gives its holder |
|---|---|---|
| castle | lord: character·1·all; garrison: item·1·holder; dungeon: character·1/2/3·holder | domain; sight 34 km and more; the founding seat; an influence zone |
| manor | steward: character·1·all; cellar: item·1/2/3·holder | wealth, domain |
| palace | throne: character·1·all; court: character·3/5/7·all; treasury: item·1/2/3·holder | influence, only with the throne filled |
| fort | commander: character·1·all; garrison: item·1·holder; magazine: item·1/2/3·holder | domain; far sight |
| watchtower | lookout: character·1·all | the farthest sight |
| prison | warden: character·1·all; cells: character·2/4/6·holder | influence for each prisoner |
| cathedral | bishop: character·1·all, piety scales; reliquary: item·1/1/2·all, a relic brings its own | piety; seen from far |
| abbey | abbot: character·1·all; library: item·1/2/3·all | piety, reason |
| mill | granary: item·1/2/3·all; no people, it pays by its level | wealth |
| mine | overseer: character·1·all; ore: item·1/2/3·holder | wealth, domain |
| market | factor: character·1·all, reason scales; warehouse: item·1/2/3·holder | wealth, influence |
| harbour | harbourmaster: character·1·all; moorings: item·1/2/3·all, ships | wealth for each ship; sight over water |
| shipyard | shipwright: character·1·all; slipway: item·1/1/2·all, the unfinished galley | wealth |
| manufactory | master: character·1·all, reason scales; stores: item·1/2/3·holder | wealth, the most of any |
| academy | rector: character·1·all, reason scales; fellows: character·1/2/3·all; cabinet: item·1/2/3·all | reason |
| printing house | printer: character·1·all; presses: item·1/2/3·holder, what is being printed | influence, reason |

The words per culture are a draft for Adam to correct: cathedral, great mosque, great temple, great shrine.
Candidates to swap in for any of the sixteen: a lodge, an observatory, a coffee house, barracks, a town hall.

The server reads it once at start, `StructureTypes` in `application` returning a `StructureCatalogue`,
by `FileStructureTypes` in `app`, wired in a `StructuresConfig.kt` of its own. The page and the tools read
the copy cut beside the sprites. A contract fixture in `contracts/fixtures/` is read by both ends.

## Culture

`world/cultures.json` holds a few dozen places on Earth, each tagged European, Islamic, East Asian or
African; Adam's to correct. A tool works out each master's **culture map** from its origin map: every piece
of ground takes the culture of the nearest anchor to where it came from on Earth, and invented land the
culture of the nearest ground that came from Earth. The map is written beside the master's tiles, the
**Culture** renderer in the Debug map panel draws it, and the quick-start makes it again when the master or
the anchors change. The page reads it under a structure to choose its sprite and its words.

## What the page shows

- **The map.** A `StructuresLayer` of its own in the sprite canvas (0051): the sprite as the ground form, a
  mark of the type as the icon, the pennant in the holder's colours (none when unheld), a little larger
  each level, a ruin's sprite for a ruin. Placeholders at first, one per type; by culture from step 13.
  Its influence zone, if its type has one, is drawn only while it is selected.
- **The window.** `Subject` kind `structure`, `describeStructure`: the name; the type, level and culture's
  word; the holder, a link; *the seat of* when it is one; what it gives; its slots; show it on the map. `Description` grows sections any kind may carry.
- **The Holdings tab.** `src/holdings/`, in the fifth row of `layers.test.ts`; `HOLDINGS_PANE` in the
  corner beside the key figures, its button a mark; a line in `panes.tsx`. The strip is a name; normal size
  a list, the seat first - each row the sprite, the name, the type and level, what it gives; a holding
  pressed opens its details, the window's sections, with the map's mark and a way back. Fed by a private
  `yourHoldings` frame and slice, as the key figures are.
- **Slots** as a row of sockets per slot: its name, then a socket for every place - a portrait, an item's
  picture with its amount, an empty frame, a question mark - with `+3` when there are more than fit, and
  "2 of 4". `Socket` and `SlotRow` are added to the component library first, each on
  `/admin/inspect-ui-components` in every state.
- **The house status.** Its resource readouts count up once a rate is not zero; no new component.
- **The debug panel**, a **Structures** section standing in for the world: raise here (type, level, you or
  nobody); *take control of this building*, which hands the one selected to the player's own house; level
  up and down; fill a slot with a character or an item and empty it; ruin; rebuild. Each says what it did with `note('structures', …)`.
- **Antarctica, for Adam.** While the instruments are open (0076), the server stands one structure of every
  type in Antarctica at start, held by nobody, ids derived from the type so that a restart raises nothing
  twice. They are there to be flown to, looked at and taken control of; never in a build the instruments
  are closed in.

## Steps

One commit each; Adam chooses the order and approves each. Every step carries its documents and leaves the
program running on it at this tree's address.

| # | Step | Seen in | Wire |
|---|---|---|---|
| 0 | This plan, decision record 0092, experiment 0018, `MECHANICS.md`, `GLOSSARY.md`, `ROADMAP.md` | the documents | |
| 1 | Make room: command payloads out of `Frames.kt`, the cell snapshot out of `Gateway.kt`, the sprite functions out of `App.tsx`; ceilings lowered | the checks | |
| 2 | The catalogue: `world/structures.json`, its port and adapter, the contract fixture | the Structures section lists the types | |
| 3 | The structure's stream: `raised` and `changedHands`, the decider over the catalogue, every projection's `when`, *raise here*, the sixteen in Antarctica | the event page | |
| 4a | The read model with face versions, `StructureView`, snapshot and deltas, a structures part, `hidOn` split and cached; 0061 and 0089 amended | the session log | bump |
| 4b | The page: the slice and its stamp, `StructuresLayer` (with `MarksLayer.ts` split first), a placeholder per type, the pennant, the size by level | the map | |
| 5 | The window: `inspect` kind `structure`, `describeStructure`, the holder's link; *take control of this building* on the one open | a click, then your pennant on it | bump |
| 6 | Sight from structures: the `StandingEffects` listener, `caughtUp`, `gainedVision` and `lostVision` written with the radius and `from` | the fog lifting round a structure taken | bump |
| 7a | The seat refit on the server: the `Seats` reaction, `namedSeat`, `foundingPlace`, the seat's own sight removed, omens, season, gossip and dialogues reading the seat | a new house's events | bump |
| 7b | The seat refit on the page: no house sprite; the room, the dive and the eye read the seat; the castle's influence zone when selected, in place of `HoldingOverlay` | a click on your castle | |
| 8a | The tab's mark, in the library | the component page | |
| 8b | The Holdings tab: `yourHoldings`, the list, the details | the corner | bump |
| 9 | Ruins and lost seats: `ruined` and `rebuilt`, their levers, the `lostSeat` reaction, a seatless house (a second browser takes your castle), the ruin's sprite | the map and the house | bump |
| 10a | Income: `SetIncome`, `incomeChanged`, rates per source, the listener paying by type and level | the treasury counting up | |
| 10b | What each holding gives, in the window and the tab | the window | bump |
| 11a | `Socket` and `SlotRow`, in the library | the component page | |
| 11b | Slots: `slotFilled` and `slotEmptied`, items, a character in one slot, secrecy per viewer, the levers, the sockets | the window, as two houses | bump |
| 11c | What fills a slot counts: adds, stats, an item's own | the treasury | |
| 12 | The culture map: `world/cultures.json`, the tool, the Culture renderer, the quick-start | the renderer | |
| 13 | Culture sprites: sixteen types by four cultures, the ruins and the type marks, placeholders from the moodboard, a cutting tool of their own, the atlas | the map, on two cultures | |
| 14 | Houses leave the cell snapshots: `Snapshot.houses`, the houses' fan-out, `Fog.sent(HouseRow)` | nothing changes on screen | bump |

Sight (6) and the window (5) land before the refit (7), so a new house is never blind and a click on its
castle always has a window to open. `Frames.kt`, `Gateway.kt`, `cutArt.ts` and `FogLayer.ts` are at their
ceilings and `MarksLayer.ts`, `PixiSpriteRenderer.ts`, `WorldConfig.kt`, `App.tsx` and `frames.ts` near
them, which is what step 1 and the splits inside 4b are for.

## Not in this plan

Each its own plan when Adam asks for it:

- **Structures standing in the world of 1790**, raised in its towns and held by nobody. The server will then
  need to know which master the world is played on.
- **A house building one**: what it costs, how long it takes, where it may stand.
- **Taking one**, by force, by purchase, by inheritance.
- **Factions** as holders.
- **Mentions inside dialogue words**: *Castle Erebus* in a line opening its window.
- **Characters moved onto Presence**, and battles and festivals on the map.
- **Influence zones designed per type**, and what each one means.
- **A story changing what a structure gives**: first proposed as conditions hung on it, *cursed until the
  miller's daughter is freed*, and taken out of scope on 2026-10-08.
