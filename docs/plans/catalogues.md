# Catalogues

**What belongs here:** how the game's content comes to live in files - the catalogues, the shelf the server
keeps them on, the one event that records a change, the way an inspect page edits one, each catalogue's page,
the rules that must hold, and the order it all gets built in. **What does not:** why it is shaped this way,
which is decision record 0097; the words, which are `GLOSSARY.md`; what each page does in the running program,
which is `RUNNING.md` as each one lands. When a part of it is decided, that part becomes a decision record and
leaves.

Planned on 2026-10-15 from Adam's brief and his answers, recorded in the sections they settled.

---

## The problem, in one paragraph

`/admin/inspect-structures` lists every type of structure, and it is the only page of its kind, because
structures are the only content kept in a file. The dialogues, the quests, the pools and the actions a roll
deals, the names newcomers are given and nearly every number Adam tunes are written in Kotlin: a word changed
is a rebuild, and nothing shows them but the game itself. Adam's brief asks for a page like the structures' one
for every kind of content, pages that can **change** what they show, and a rule that makes every later plan
with content in it build its page as it goes. It asks where content and balance should live, whether that is
MongoDB, and what a changed number means once the game is released and the world is never wiped again. Most of
the work is not the pages. It is moving the content out of the code into files the server checks, takes on
while it runs and records taking on.

## What Adam settled

On 2026-10-15, beside the brief:

- **Files, not MongoDB.** Content and balance are committed files under `world/catalogues/`. Mongo keeps only
  what happened.
- **`catalogueChanged`**, the one new event: the world took on a version of a catalogue it had not recorded.
- **Three pages more** than he named: the **balance**, the **character names**, and **portraits and scenes**,
  which stand with the sprites and the marks on one page of pictures. Founding choices are not in this plan.
- **Structures end to end first**: the whole way of editing, built on the one catalogue already in a file,
  before any content leaves the code.

## What is true today

- `world/structures.json` is read once by the game server as it starts (`StructuresConfig.kt`), and by the
  page and the game through the dev server (`vite/structuresApi.ts`). Both sides parse it, held to one shape by
  `contracts/fixtures/structures.json`.
- The rest is code. Dialogues are `SampleDialogues.kt`, quests `SampleQuests.kt`, pools and actions
  `fate/FirstContent.kt` over `fate/Pools.kt`, the names `Names.kt`, and the numbers are `const`s across
  `domain` and `application`. Two are copied into the page: the roll's price in `TakeAction.tsx` and the length
  of a month in `describe.ts`.
- MongoDB holds the events and the checkpoints, and nothing else.
- What happened is safe from a retune. An offered dialogue, quest or choice is written into its event whole
  (0071, 0096); what a structure paid and let its holder see is written into `incomeChanged` and
  `gainedVision` (0093); a stored event is read as it was written (0074).
- What a retune changes is not explained. The standing-effects listener sets every holding right once it has
  caught up, so a retuned catalogue already writes `incomeChanged` for every house at the next start, and
  nothing in the history says why.
- The inspect pages are routed by a chain of `if`s in `main.tsx`, each copies the same frame into its own
  stylesheet, the structures' page has no way back to `/admin`, and none writes anything.

## Catalogues

A **catalogue** is a file of the game's content under `world/catalogues/`, or a folder of them:

| Catalogue | What is in it | Comes from |
|---|---|---|
| `structures.json` | every type of structure: its words, its numbers by level, its slots | `world/structures.json`, moved |
| `balance.json` | every number that belongs to no one entry: the roll's price, the odds, the hand, what each rarity grants, founding wealth, the omens' thresholds, how small an island is, a newcomer's ages | `const`s in `domain` and `application` |
| `fate.json` | the pools, what opens each, and the actions: rarity, pools, words, what taking one does | `FirstContent.kt`, `Gossip.kt` |
| `character-names.json` | the given names by sex and the family names | `Names.kt` |
| `dialogues/<name>.json` | one dialogue a file | `SampleDialogues.kt` |
| `quests/<name>.json` | one quest a file, its dialogues named | `SampleQuests.kt` |

**An entry's own numbers live with the entry; a number that belongs to no one entry lives in the balance.** A
castle's yield is the castle's, so it is in `structures.json`; what any common action grants is nobody's, so it
is in `balance.json`. A number is balance when changing it changes how the game plays and nothing else has to
change with it: the most options a choice can have is a shape the pane is drawn for, and stays in the code.

**Each catalogue is the structures' pattern again**: a value in the domain, as `StructureCatalogue` is; a
Kotlin reader in `app` that refuses the whole file for one bad field; a TypeScript reader in `@villages/world`;
and a fixture in `contracts/fixtures/` both are held to.

**What must stay code stays code, and the data names it.** An action's `kind` is `grant`, all data, or
`gossip`, which reads the world in Kotlin and takes its numbers and its rumours from the catalogue. A pool
opens on a list of omen-key patterns rather than a function; today's pools are all a prefix or an equality, so
nothing is lost.

**A dialogue is filled in when it is offered.** It names a role, not a person: a speaker can be the house's
`keyFigure`, a line can say `{given}`, and what a line shows can be the house's `seat`. These are exactly what
`SampleDialogues.kt` fills in today. Its ids stay words, so a dialogue written by hand reads.

## The shelf

The game server keeps every catalogue on a **shelf**: a port in `application`, `Catalogues`, that answers with
the catalogue in force, and an adapter in `app` that reads `world/catalogues/` as the server starts. Everything
that reads a catalogue asks the shelf when it reads, never a value fixed at start: the structures' decider,
the standing-effects listener, Antarctica, the fate engine, and the dialogue and quest services.

**It takes a catalogue on only once it has passed every check**: the shape; the domain's own, such as a
dialogue's when it is made; every reference into another catalogue, such as a quest's *hold a castle* naming a
type that exists and an action's pools existing; and the content rules `FirstContentSpec` holds today. A file
that fails is refused, the catalogue in force goes on running, and the log says why.

**With `villages.catalogues.editable`**, which the quick start sets and a released server does not, the shelf
also watches the folder and takes on a file saved by hand while the server runs, and the server accepts a
revision from an inspect page.

## The event

| Event | Stream | What it means | Carries |
|---|---|---|---|
| `villages.world.catalogueChanged.v1` | `world` | the world took on a version of a catalogue it had not recorded | `catalogue`, its name; `fingerprint`, SHA-256 of its text; `previous`, the last one recorded or none; `changed`, the ids of the entries that differ; `text`, the whole catalogue |

**The world's own stream**, one for the whole world, because a catalogue belongs to no house, character or
structure. It is decided against that stream's history: a catalogue whose fingerprint is the last recorded for
its name writes nothing, so a restart on the same files is silent, and a fresh world's history opens with one
for each catalogue it was made of.

**It carries the whole text**, so the world's history alone says which numbers were in force at every moment,
as an offered quest carries its words. `changed` is worked out against the previous event's text.

**The standing-effects listener reacts to it**, setting every holding right with the change as its cause, so
the events page reads *the structures changed*, then each house's new income under it.

## The way an inspect page edits

**The game server is the one writer.** An inspect page reads its catalogue through the dev server, so it shows
something with nothing else running, and saves through the game server:

1. The page reads `/catalogues/<name>.json` from `vite/catalogueApi.ts`, which replaces `structuresApi.ts`,
   with the file's fingerprint beside it, and hears `villages:catalogue-changed` when the file moves on disk.
2. It sends `reviseCatalogue {catalogue, text, basedOn}` over the gateway, connected as the events page is: a
   lever of the instruments, refused `instrumentsClosed` when they are closed (0076).
3. The server refuses `catalogueStale` when `basedOn` is not the fingerprint on disk, so a hand edit made in
   between is never written over; checks the text as it checks a hand edit, and refuses it with the reason; or
   writes it in the file's one form, whole and at once, takes it on, records the event, and answers with the
   new fingerprint.
4. The page reads the file again, and says in its frame whether the server runs on what it shows.

**The file's one form** is two spaces, and a list or an object on one line whenever it fits in 120 columns:
what `world/structures.json` already is. The server writes every file in it, so a saved number is a diff of one
line.

## The inspect pages

**One table routes them all.** `INSPECT_VIEWS` gains `load`, the page's `import()`, and `catalogue`, the
catalogue it shows when it shows one; `main.tsx` routes from the table and its chain of `if`s goes.

**One frame holds them all**: `admin/frame/`, the title bar with its count, the way back to `/admin`, and the
line saying what the server runs on; and the editing parts the pages share - a number cell, a line of words,
the bar that saves and shows a refusal, and the whole file as text, which edits any catalogue before its page
has anything better. These are the admin pages' own and not the component library's, which is what the
player is shown.

| Page | Shows | Edits |
|---|---|---|
| `/admin/inspect-structures` | every type, as today | every number, every word |
| `/admin/inspect-balance` | every number, grouped by what it tunes, with a line on what it does | every number |
| `/admin/inspect-rolls` | the pools and what opens each, the actions by rarity, the odds; pick omens and see which pools open and each action's weight in the deal | words and what an action grants |
| `/admin/inspect-character-names` | the given names by sex, the family names | every name |
| `/admin/inspect-dialogues` | each dialogue as its tree, drawn with the xyflow and dagre the admin pages have | every line's words, every number |
| `/admin/inspect-quests` | each quest's road of nodes, its objectives, its rewards, its dialogues | every title, every number |
| `/admin/inspect-pictures` | the scenery, the structures by culture, the marks, the portraits, the scenes: each placeholder or painted, its size and where it comes from | nothing: Adam paints the files |

The architecture page draws the catalogues as files the game server and the page read.

## Every later plan

The rule is in `.claude/loop/plan.md` and in `BUILDING-A-MECHANIC.md`'s definition of done: **a plan that adds
a kind of content adds its catalogue and its page as steps of its own; a plan that adds to a catalogue points a
verification request at that page.** `admin/catalogues.test.ts` holds it: it fails for a catalogue under
`world/catalogues/` that no inspect view names, and for a view naming one that is not there.

## What must hold

| Rule | Held by | When |
|---|---|---|
| The server runs only on a catalogue that passed every check | the shelf: a refused file leaves the one in force | at the instant |
| Every catalogue the server runs on is recorded, once for each fingerprint | the world's stream, decided before the shelf swaps | at the instant |
| What happened is never rewritten | events carry the numbers they used (0074, 0093) | at the instant |
| Every house is paid and sees what the catalogue in force says | the standing-effects listener, reacting to `catalogueChanged` | a moment after |
| Every reference between catalogues resolves | the shelf's checks, and the same over the committed files in `gradlew check` | at the instant |
| A save never writes over a change it has not seen | `basedOn` against the file's fingerprint | at the instant |
| Every catalogue has its page | `admin/catalogues.test.ts` | in the checks |

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **The documents.** This plan, decision record 0097, the glossary's **Catalogue**, the rule in `.claude/loop/plan.md` and `BUILDING-A-MECHANIC.md`, the roadmap. | 1. Read decision record 0097: files and not Mongo, the one event, an id kept forever once released. 2. Read the rule for later plans in `BUILDING-A-MECHANIC.md`'s definition of done. |
| 2 | **One frame and one table** for every inspect page: `admin/frame/`, `INSPECT_VIEWS` with `load`, `main.tsx` routing from it, the structures' page given its way back. | 1. 👀 `/admin`, then every page: the same title bar and a way back on each. |
| 3 | **The catalogues' folder.** `world/structures.json` moves to `world/catalogues/`, `catalogueApi.ts` replaces `structuresApi.ts`, `admin/catalogues.test.ts`, and the architecture page's catalogue card. | 1. 👀 `/admin/inspect-structures` reads as before. 2. The checks, the page test broken once. |
| 4 | **The world records a catalogue it takes on**: the world's stream, `catalogueChanged`, its fixture and catalogue row, recorded as the server starts. | 1. 👀 `/admin/inspect-events`: one for the structures on a wiped world, none on a restart, one more after the file is edited and the server restarted. |
| 5 | **Taken on while it runs**: the shelf, the watch, everything reading through it, the standing-effects listener reacting. | 1. 👀 Edit the castle's yield by hand: the house's income moves with no restart, under the change. 2. 👀 Break the file: refused, and the old one runs on. |
| 6 | **The server takes a revision**: `reviseCatalogue`, its refusals, the one form, the write, the wire's version. | 1. The checks: stale, broken and closed are refused; the committed file is written back to itself byte for byte. |
| 7 | **The structures' page edits**: the number cell, the words, the save bar, the line saying what the server runs on. | 1. 👀 Change a yield on the page: `git diff`, the game and the events page agree. |
| 8 | **The balance in a file**: `balance.json`, the domain given its numbers, the page's copies replaced by the server's word. | 1. The checks, and the game plays as before. |
| 9 | **The balance page.** | 1. 👀 Change the roll's price: Take action asks the new one. |
| 10 | **The pools and the actions in a file**: `fate.json`, `FirstContentSpec` over the file. | 1. The checks, and a roll deals as before. |
| 11 | **The rolls' page**, picking omens to see the deal. | 1. 👀 The pools and the odds read right. 2. 👀 Edit an action's words, roll until it comes, and read them. |
| 12 | **The character names in a file**, every one a valid `CharacterName`, checked on taking it on. | 1. The checks, and newcomers are named as before. |
| 13 | **The character names' page.** | 1. 👀 Add a name, and see a newcomer given it. |
| 14 | **The dialogues in files**: the roles filled in when one is offered, the panel offering any of them by name. | 1. The checks. 2. 👀 The letter plays as before. |
| 15 | **The dialogues' page.** | 1. 👀 Edit a line, offer the dialogue, read it in the game. |
| 16 | **The quests in files**, their references checked. `MECHANICS.md`'s *where they are written* answered for both. | 1. The checks. 2. 👀 The abbot plays as before. |
| 17 | **The quests' page.** | 1. 👀 Edit the blessing, offer the quest, collect it. |
| 18 | **The pictures' page**, once the session working on the map's marks has landed. | 1. 👀 Every picture there, the placeholders marked. |

The order is a suggestion, as every order here is. Each run is whole on its own: 1 to 7 is the shelf and the
way of editing, 8 and 9 the balance, 10 and 11 the rolls, 12 and 13 the names, 14 to 17 the dialogues and
quests, and 18 the pictures, which needs nothing before it but step 2.

## Not in this plan

- The founding choices, the seats, the house names and the banners a new player is offered. The rule catches
  them the next time they change.
- The place names, the biomes and the cultures, which the world is built from rather than played with; the
  architecture page already draws their files.
- Items, which have no catalogue yet. Their plan makes one.
- A released page reading the catalogues, which has no dev server. Structures have the same gap today.
- Tuning a shared server while it runs, without a deploy: that is where a store of catalogues might earn its
  place, with Adam's own identity on the server.
- Reading an old catalogue's text in a shape the code has since outgrown. The text is a string and reads as
  written; only `changed` is worked out from it, and it says *everything* when the previous text no longer
  parses.
