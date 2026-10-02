# Characters and key figures

**What belongs here:** how the groundwork for characters and key figures gets built - what a character's
record holds, how a house keeps its ties to them, what the pane, the map and the debug panel show, and the
order it all gets built in. **What does not:** why it is shaped this way, which is decision record 0055;
what the two mechanics are for, which is `MECHANICS.md`; the words, which are `GLOSSARY.md`; the hypothesis,
which is experiment 0010. When a part of it is decided, that part becomes a decision record and leaves.

---

## The problem, in one paragraph

A house is "a bloodline, not a roster", with a handful of key figures the player acts through, and the
program has no people in it at all. Adam's brief asks for two things at once: **characters**, the people of
the world, with stats, an age that moves, an optional place on the map and a death; and **key figures**, the
few of them a house acts through, shown in a pane of their own. Most of the work is not in either. It is in
the fact that the server has only ever known one kind of thing, and a character is the second.

## What a character is

A character is their own stream, `character:<uuid>`. Their id is a name-based UUID over
`villages:character:<houseId>:<commandId>`, so it is derived rather than minted, a resent command lands on the
same stream, and a command id copied off somebody else's event cannot reach into their house.

What a character carries, all of it set when they appear:

| | what | notes |
|---|---|---|
| name | `CharacterName(given, family)` | from a hand-kept list of 1790s names, by sex |
| sex | `Sex { WOMAN, MAN }` | the names and the portraits follow it |
| species | `Species { PERSON }` | a pet would be another species, never another sort of thing |
| born on | a world day | their age is counted from it |
| stats | `Map<Stat, Int>`, `Stat { PIETY, REASON, KINDNESS, PHYSICAL }` | 1 to 20; plain `Int`, because Jackson boxes a value class inside a map |
| portrait | a key, or none | the file's stem in `world/portraits/`, kept for life |

and, once there is one, a place on the map, years aged out of the ordinary, and a death.

Its events are the world's half, each with the two times last:

| Command | Event | Payload | Refused with |
|---|---|---|---|
| `IntroduceCharacter` | `villages.character.appeared.v1` | characterId, name, sex, species, bornOn, stats, portrait | `AlreadyAppeared`, `InvalidName`, `InvalidStat`, `InvalidAge` |
| `ChangeStat(stat, by)` | `villages.character.statChanged.v1` | characterId, stat, value | `NoSuchCharacter`, `AlreadyDead`, `InvalidStat` |
| `AgeCharacter(years)` | `villages.character.aged.v1` | characterId, years | `NoSuchCharacter`, `AlreadyDead`, `InvalidAge` |
| `ChangePortrait` | `villages.character.portraitChanged.v1` | characterId, portrait | `NoSuchCharacter` |
| `MoveCharacter(place)` | `villages.character.moved.v1` | characterId, place, significance | `NoSuchCharacter`, `AlreadyDead`, `InvalidLocation` |
| `TakeOffTheMap` | `villages.character.leftTheMap.v1` | characterId | `NoSuchCharacter`, `AlreadyDead`, `NotOnTheMap` |
| `KillCharacter(cause)` | `villages.character.died.v1` | characterId, cause | `NoSuchCharacter`, `AlreadyDead` |

- **`ChangeStat` carries `by` and its event carries the result.** The decider does the arithmetic against
  the truth, so two quick presses on a stale screen do not overwrite each other, and a reader of the event
  needs nothing else to know the value.
- **`aged` is signed**, and it is the only way age changes out of the ordinary. Age itself is completed world
  months from `bornOn`, over twelve, plus the sum of `aged`: never stored and never ticked. The domain has no
  calendar, so the browser works it out (`ageOn`, beside `stockNow` in `client-core`).
- **`died` carries a cause in free text**, as a pledge carries its purpose, because nothing yet exists for a
  cause to be. A death does not also write `leftTheMap`; that follows from the death.
- **`moved` carries a significance**, because an event that puts a thing on the map says how much it
  matters (0026). How far out a person is drawn should "depend greatly on the character", so it is the
  character's and not a constant; for now the application sets 10, which draws from zoom 9.

## Being a key figure

A tie, written in the house's history, and never in the character's.

| Command | Event | Refused with |
|---|---|---|
| `TakeKeyFigure(characterId)` | `villages.house.gainedKeyFigure.v1` | `NoSuchHouse`, `TooManyKeyFigures`, `AlreadyAKeyFigure` |
| `LoseKeyFigure(characterId)` | `villages.house.lostKeyFigure.v1` | `NoSuchHouse`, `NoSuchKeyFigure` |

Both carry the character's id and nothing else. `House.Founded.keyFigures` holds them **in the order they
were taken**, which is the order the pane shows them in. A house holds at most nine.

Two more house commands **can only be refused**, a shape the program has not had before:

- `ActThrough(characterId)` is the **gate**. It writes nothing when the character is one of the house's key
  figures, and is refused `noSuchKeyFigure` when not.
- A room check asks for a place in the nine before *add a key figure* rolls anybody, and is refused
  `tooManyKeyFigures` when there is none.

Both keep their rule in `decide` and need no port for reading a house.

## Adding a key figure, and the levers

**Add a key figure** names nobody. The application asks the house for room, rolls a **newcomer**, introduces
them, and has the house take them in, all in the command's own story, so the event page reads *appeared,
gained key figure*, in that order. The newcomer gets:

- a sex, and a given and a family name from the period list for it;
- a birthday **18 to 50** years back;
- each stat the sum of **three six-sided dice**, so mostly near 10 and a 17 is worth noticing;
- species `person`, and a portrait at random from those that suit their sex, or none.

Randomness comes through a `Dice` port, so every spec is deterministic. It is never seeded from the command
id, which the browser mints: a player could resend until they rolled four 18s.

A race between the room check and the tie can leave a character nobody holds. They have no place, no lever
reaches them, and the event page shows what happened. That is the cost 0055 names.

**Every other lever names a character**, and runs `ActThrough` on the session's own house before it touches
the character's stream. So a player's levers reach their own key figures and nobody else.

## The listener for character deaths

`CharacterDeaths` is a reaction on the pattern of `Pledges.kt`. It follows the feed from the beginning with
its own fold of who holds whom and who has died, and issues through `Later`, never inside the feed's own
callback.

- On a death, it writes `LoseKeyFigure` into every house that held them.
- On a tie to someone already dead, it does the same, so whichever of the two arrives second heals the other.
- Each loss continues the death's story, and its causation is the event that triggered it.
- It swallows `NoSuchKeyFigure` and `NoSuchHouse`, so a replay or a wipe is harmless, and it is on the
  wipe's reset list.

No successor rises when a house loses its last key figure. The setting's "someone rises to the task" waits
for a mechanic, and `MECHANICS.md` records it as deferred.

## The server underneath

- **One root for events and one for refusals.** `Event { worldTime, recordedAt }`, with `HouseEvent` and
  `CharacterEvent` under it for where an event is kept, and `WorldEvent` and `PlayerEvent` for what kind of
  thing happened; each of the house's world events is both a `HouseEvent` and a `WorldEvent`. `DomainError`,
  with `HouseError` and `CharacterError` under it, and `InvalidLocation` moved to the root so that `Location`
  stops throwing a house's error. A `Decider<C, S, E>` interface, which `HouseDecider` already fits.
- **Generalised, not duplicated.** One converter over `Event`, one type table, one executor loop behind two
  ports, `HouseCommandExecutor` and `CharacterCommandExecutor`: a test fake cannot implement one generic port
  twice on the JVM, and the house's fakes stay as they are. The catalogue specs learn a third *whose*. The
  gateway catches `DomainError`.
- **One `CharactersProjection` behind two ports.** `KeyFiguresByHouse` keeps each house's ties in order, with
  a reverse index so that a change to a character's record reaches the player of every house holding them.
  `CharactersByCell` keeps **spans**, one for every stretch a character stood in one place, from `since` to
  `until` in world-time, closed by a move, by leaving the map, or by death, and asked `since <= T < until`. A
  view's version is the projection's own revision, because a tie on a house's stream changes a character's
  view without touching the character's stream. The house and choice projections ignore character events.

Two things bite if forgotten: an event interface must carry no computed property, which Jackson would write
into the stored data; and a character that moves would stay drawn in the cell it left, because the browser
has never had to drop anything from a cell. Houses never move. Both are answered below.

## The wire

**Version 6, key figures.** Commands `addKeyFigure`, `changeStat {characterId, stat, by}`,
`ageCharacter {characterId, years}`, `changePortrait {characterId, portrait}`, `killCharacter`. A new frame,
`yourKeyFigures { keyFigures }`: always a list, sent after `yourHouse` on hello and again on every change,
to the session rather than to a cell, the way a player's own house reaches them. A key figure's view is the
character's view with the four stats added. The character's view is its id, given and family name, sex,
species, `bornOn`, `agedYears`, portrait, and `keyFigureOf` as `[{id, name, banner}]`, so a colour or a link
never waits on a house the browser happens not to hold. A reason code for every new refusal.

**Version 7, the map.** `moveCharacter {characterId, place}` and `takeOffTheMap`; `snapshot` gains
`characters` and `omittedCharacters`; three deltas, `characterArrived`, `characterChanged` and
**`characterGone`**. For each connection the gateway looks at the cell a character was in and the cell they
are in now, and sends whichever of the three fits. A change to a stat sends no map delta at all.

**Version 8, a correction.** Version 7 sent a character on the map without `bornOn` and `agedYears`,
which the character's view above has, and an inspect window cannot say an age without them. They were put
back, and because the change is inside a view the version moved by the convention below.

`ProtocolShapeSpec` records the fields of a frame's top level and not what is inside a view, so a change
inside a view moves the version by convention; the fixtures are what catch the format.

## The pane

Declared once in `stage/panes.ts`:

```ts
export const KEY_FIGURES_PANE: Pane = {
  id: 'key-figures', title: 'key figures', spread: 'bottomLeft',
  tall: { full: 340, small: 232 }, openWide: 560, startsAt: 'small', icon: 'figure', needs: null,
};
export const FIXED_PANES = [MAP_PANE, HOUSE_PANE, KEY_FIGURES_PANE, NAVIGATION_PANE];
```

- **The corner's middle tab**, between the shield and the compass, so the compass stays last as the way out.
  On a phone it is a row of *Go to*.
- **It opens at the normal size.** `startsAt` is new, read where a tile's height defaults to `'full'`, so
  pressing its tab does not throw the tab bar out from under the pointer. Its normal height is the house
  card's full height, so the column holds still between those two tabs.
- **Opened out it is 340 tall**, which a test holds below what would leave the rail less than 150 pixels on
  the shortest spread.

**Which view is showing** is a pure function in `figures/view.ts`, tested in node, the way `bayBox.ts` is: none
shows the empty words, *key figures will be shown here*; one shows their details and no way back; two or
more show the grid until one is pressed. The pressed figure is the pane's own state, which survives changing
tabs because a pane is never unmounted. If the open figure dies it goes back to the grid, or to the one left,
or to the empty words; a second figure arriving while one is open keeps the one open, and the way back
appears.

| | Grid | Details |
|---|---|---|
| **Strip**, every form | the pane's name | the pane's name |
| **Phone medium**, half the stage, both cuts | 3 by 3 | portrait and name; the stats below a scroll |
| **Phone big**, upright | 3 by 3, larger | portrait, name and stats, all in view |
| **Phone big**, turned | 3 by 3, centred | portrait on the left; name and stats on the right |
| **Desktop medium**, the corner, 288 to 416 wide | 3 by 3, small | portrait beside the name, no stats |
| **Desktop big**, up to 560 wide and 340 tall | 3 by 3, larger | portrait beside the name and the five stat lines |

**The way back** is a mark, nine small squares in a three by three, at the details' top left, and only when
there is somewhere to go back to. The pane's own mark is a head and shoulders in profile. Both are in
`Icons.tsx`, as `nine` and `figure`, and both are placeholders.

**The stats** are one line each, a mark, a word and a number: Age, Piety, Reason, Kindness, Physical. The five
resource marks move out of `HouseStatus.tsx` into one shared `marks/Mark.tsx`, keyed so that the stats' piety
and reason *are* the resources' cross and dividers rather than copies of them. Kindness is a heart, physical
an arm bent at the elbow, age an hourglass: placeholders, each a different outline first.

**Opened out on a desktop, the corner reaches along the bottom.** `SpreadWants` gains the corner's width,
read from the pane that is up when it is opened out; only `tilesOnAMap` changes. The corner takes that width,
never narrower than the column and never wider than leaves the bottom middle **281 pixels** (`MIDDLE_LEAST`),
and it is always capped, so a letter arriving never resizes it. The rail keeps the column's width. The bottom
middle starts where the corner ends. The floor sweep tightens from 260 to 281 and runs with the corner opened
out, as does the sweep that holds tiles apart. On a stage 1000 wide the letter then folds to its carousel,
the first time one tile's size has changed another's form. It amends 0041, whose pane declares "a height and
not a box, because the column's width is shared by everything in it", and 0042, whose tile is as tall as the
pane that is up and now as wide; **decision record 0056** is written with it.

**On a phone the stats go below the fold on purpose.** Other panes scroll, but this is the first to put what
it is showing out of view deliberately, which the `.bay` comment in `styles.css` calls a bug a scrollbar
hides. `RESPONSIVE-DESIGN.md` records it as a stated exception; a spread tile still never scrolls. The turned
strip joins the list at the end of `styles.css`, or it drops its name, which was decision 0046's defect.

**One frame for a face.** `Portrait.tsx` draws a 3:4 frame in the ornament's gold contours, holding the
portrait's picture, or a plain bust drawn inline when the key is missing or the file will not load. It is
shared from the start: the pane now, the inspect window and character dialogue later.

## The portraits

`world/portraits/` is Adam's folder, committed, as the master is.

- **Upright PNGs, 3:4, at least 768 by 1024**, each named for whom it suits: `woman-01.png`, `man-01.png`. The
  name without `.png` is the key a character keeps for life.
- **Replacing a picture is saving over it**, and adding one is saving a new name. There is no list to edit.
- **`npm run world:portraits --prefix frontend` draws the placeholders**, six women and six men as cut-paper
  silhouettes of the period, and **never overwrites a file that is already there**, the rule `world:master`
  keeps for a hand-painted master. What Adam saves in the folder stays his.
- **A test holds the folder honest**: every file is named for a sex, is a PNG, is 3:4 and at least 768 wide.
- **The server lists the folder** through a `Portraits` port, at a configurable path, which is a development
  coupling to the repository's layout and named as such. The dev server serves it with no caching, on the
  pattern of `worldApi.ts`, so a replaced picture shows on the next reload.

Figures that appeared before there was any art keep the plain bust until the debug panel swaps their
portrait.

## The debug panel

A new **Characters** section, after Resources. Its levers are words, like every other debug button:

- *add a key figure*, disabled with no house or with nine held, its hover saying which;
- for each key figure, a line with the name, age and sex, then *up* and *down* for each of the four stats,
  left enabled at the limits so the server's refusal shows in the log;
- *ten years older*, *ten years younger*, *another portrait*, *kill*;
- with the map, *put them here*, at the camera's centre as *found a house here* does, and *take off the map*.

Every press writes a line and every answer another, through `note('characters', ...)`. That needs `act()` in
`net/gateway.ts` to take an area, because today it files every command it sends under `resources`.

## The order it gets built in

A menu rather than a queue, one commit each.

| | what it produces | where it is seen |
|---|---|---|
| **0** | this document, decision record 0055, experiment 0010, the mechanics entries, the glossary | read |
| **1** | one root for events and one for refusals, the executor behind two ports, the catalogue's third *whose*; no change in behaviour | the checks, and a founding still showing its three events |
| **2** | a character appears and dies: the values, the id, `CharacterError`, the decider, fixtures, a second table in `EVENTS.md` | the decider's spec and the fixtures |
| **3** | a house gains and loses key figures: the nine, `ActThrough`, the room check | `HouseKeyFiguresSpec` |
| **4** | a character's record changes: `statChanged`, `aged`, `portraitChanged` | the decider's spec |
| **5** | the placeholder portraits in `world/portraits/`, their generator and their test | the folder, and a picture of it |
| **6** | a newcomer is rolled: `Dice`, `Portraits`, the list of names | the spec, and the names to read |
| **7** | a key figure is taken in and acted through: the order of the writes, and the refusal for anybody else's | the spec |
| **8** | the listener for character deaths | the spec |
| **9** | the characters projection: the ties, the rows, the reverse index | the spec |
| **10** | wire version 6 and the gateway: the commands, `yourKeyFigures`, the reason codes | the contract specs |
| **11** | the Characters section, `monthsBetween` in the browser's calendar, `ageOn`, `act()` by area | **the panel and `/admin/inspect-events`, the first thing to see** |
| **12** | the key figures pane, empty: the tab, the bust, the strip, the empty words, opening small | the corner's middle tab, and *Go to* on a phone |
| **13** | opened out, the corner reaches along the bottom; decision record 0056 | the corner opened out beside a letter |
| **14** | the grid and the portraits: the views, the frame, the nine squares, the folder served | the pane with one, two and nine key figures |
| **15** | the stats: the shared marks and the new ones, the layout for each size and cut | all six phone states and the spread |
| **16** | a character on the map and off it: `moved`, `leftTheMap`, the spans by cell | the projection's spec |
| **17** | wire version 7: characters ride the cells the browser holds, and leave them | the log's lines about cells |
| **18** | a key figure on the map: the sprite, its two forms, its colours, *put them here* | the map from zoom 9 |
| **19** | inspecting a key figure: the subject, the trail, the window, the click | a window opened from a figure on the map |
| *20* | optional: a lever to look at an earlier day, which nothing in the page does today | a figure absent on a day before they were placed |

**Where it stands, 2026-09-24: nought to nineteen are built**, one commit each, and twenty is not. The
wire is at version 8 rather than 7, for the correction above.

One to ten are seen only through their specs, and eleven is the first thing on the screen. Twelve and
thirteen need nothing from the server and can be taken at any point. Fourteen and fifteen could come before
the server too, against stand-in key figures behind a debug switch, at the cost of a small store thrown away
later and log lines that say *stand-in*.

The map's resolution is a month, which is a real day: everything done in one sitting happens on one world
day. A character placed and killed in the same sitting is therefore never on the map on any day, which is
correct and will surprise somebody the first time.

## What this does not do

- **Succession.** Nobody rises when a house loses its last key figure.
- **Old age.** Nobody dies of it and nobody has a lifespan.
- **Key figures from play**: from a choice, from a storyline, or with a founding.
- **One character serving two houses**, on the screen. The design allows it and the tests prove it; no lever
  makes it happen.
- **What another house sees** of your key figures, and whether the eye keeps them in sight far out.
- **What decides a character's significance** beyond the default of 10.
- **Joining a key figure's piety and reason to the house's.** The words and the marks are shared; the
  numbers are not yet.
- **Pets, loyalty, marriage and every other tie**, character dialogue, and the house's power state.
- **A world date that moves during a session.** The browser learns today once, at `welcome`, so an age can be
  a month stale across a UTC midnight. The answer is a frame when the month turns, and it is not here.
