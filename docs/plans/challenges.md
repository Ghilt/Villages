# Challenges

**What belongs here:** how the challenge gets built in its first iteration - the rules as settled, the thirty
effects, the challenge kinds, the simulator, the engine's shape on the server, the catalogue, the frames, the
page, the rules that must hold, and the order it all gets built in. **What does not:** what the mechanic is
for, which is `MECHANICS.md`; why it is shaped this way, which is decision record 0107; the words, which are
`GLOSSARY.md`. When a part of it is decided, that part becomes a decision record and leaves.

Planned on 2026-10-20 from Adam's description and his answers to thirty-four questions in nine rounds, which
are recorded in the sections they settled.

---

## The problem, in one paragraph

Two things in the world need a way to measure their strength against each other along different dimensions:
a battle of armies, of wits, of coin, of faith. A roll for a stat is too simple, an autobattler too complex,
and the challenge sits between them. It is resolved at once by a deterministic simulation and played back as
a spectacle, and its outcome - +X toward a side, with what each side gained and lost - goes to whatever asked
for it. **This first iteration is not in the game**: it is an engine on the server and a simulator on
`/admin/inspect-challenges`, so the rules can be tried, tuned and argued with before any pane exists.

## The rules

**Aspects.** Ten, in five linked pairs, each an aspect and its **anti-aspect**: Violence-Diplomacy,
Holy-Reason, Authority-Freedom, Greed-Generosity, Nature-Industry. Each pair is one dimension with two poles.
The word is *aspect* rather than *type*, which already means a structure's sort (Adam).

**A challenge.** Two sides, a duration in whole seconds, and a **progression** of **happenings**, each with one
or more aspects. The first happening is at second 0 and the rest are spaced evenly over the duration; a
progression of one happening lasts the whole challenge.

**The tug.** One value from -100 to +100, side A positive in the code, *+X toward a side* on the page.
Reaching an end stops the challenge in that second; otherwise the outcome is the value at the end. **Won** is
ending in your favour, the tug above 0 (Adam); an end at exactly 0 is won by nobody.

**A slice** has power and integrity on a scale of 0 to 100, the first slice 50 and 50 (Adam: *wider*); an
aspect; a **summon count**, the first slice 3; two effect spots, which take only effects of its own aspect, two
of its three (Adam: *its own aspect for now*; breaking that is a design space for later); and slots, which come
from its effects. A slot takes a key figure or a structure, and says whether what is put in it is **put on the
line** (Adam: *it's up to the slot*).

**The active slice.** Each happening activates one slice of each side: first one whose aspect is among the
happening's, then one whose anti-aspect is, then one drawn at random from the rest. Ties are drawn from the
seed. A slice chosen again at a change is activated again.

**The aspect boost, ×1.5**, when the happening's aspects include the slice's aspect or its anti-aspect, so both
poles shine in their pair's happenings (Adam: *both poles*). It multiplies what a thing does - tug amounts,
changes to power and integrity, a summon's pull, a coffer's deposit - and never a cost, a chance or a threshold
(Adam). It is judged at each moment, and a summon by its own aspect against the happening of the moment, so a
summon shines and fades as the progression moves (Adam).

**Passives work only while their slice is the active one**, and **summons stay** when their slice steps aside,
until they are killed or the challenge ends (Adam).

**The summon cap** is the sum of the summon counts of every slice the side brought, active or not (Adam). A
summon's integrity is its slice's integrity at the moment it was summoned, and stays so (Adam). A summon that
would turn while its new side is full **deserts**: it leaves both sides (Adam).

**Kills** compare the killer's slice power with the target's own integrity, and need it strictly greater; the
target is drawn at random among the enemy summons the kill can beat (Adam).

**A passive that holds *while* something is true is an aura**: a modifier that does not stack, for as long as
the condition holds (Adam). Two different effects' auras add.

**Seconds are simultaneous** (Adam). Everything in a moment reads the state the moment began with, and what it
asked for lands together at its end, so a summon killed in a second still acts in it. A second has two moments:

1. A happening due begins: *changes away* passives fire and coffers pour out, judged against the new
   happening; each side chooses its active slice; both sides' triggers fire, Refutation able to cancel an
   enemy's. What they asked for lands, and the tug is looked at.
2. Every summon acts and every per-second passive fires; what reacts to an act - Divine Rebuke, Seen Through,
   By Decree, Teeming Wilds, Well-Oiled - is judged in the same moment against the same state. What they asked
   for lands, and the tug is looked at again.

A moment lands in three passes: the tug and the coffers move first; then the dead fall, two kills on one target
killing it once, and killed beating turned; then summons turn and come, things come on the line, slices are worn
and summons silenced. So a summon turned as a happening begins acts for its new side in that second's second moment.
A new summon first acts the second after it arrives.

**Things on the line** (Adam). A slotted thing whose slot puts it on the line enters as a summon, once in a
challenge: it arrives paying an amount A, pulls A/5 a second, and has its slice's integrity and A/2 more. It is
not counted toward the cap and cannot be turned. A building's A is 10 × its level, so it pulls 2 × level and has
5 × level more integrity (Adam: *stands and pulls*); a figure's A is the stat it lends. A building killed is
**damaged** and a figure killed **fatigued**, each -10% **effectiveness**, and a building at 0% is ruined (Adam).
For now they are only reported in the outcome; the states in the world come when challenges reach the game
(Adam).

**Key figures in the first effects lend a stat each time their slice is activated**, and are not put on the
line: Learned Counsel reads reason, Trusted Envoy and Open-Handed Patron kindness (Adam). A figure on the line
lends only once, as its arrival. A character's stats run from 1 to 20 and a structure's level from 1 to 3.

**The outcome**: the end tug toward each side; how it ended, pulled to 100 or time ran out; what was gained if
won, +5 piety for Sanctuary and +5 wealth for Counting House, each only if its building went on the line; and
what was lost, damaged buildings and fatigued figures.

**Floors.** Power and integrity never go below 0. Divine Rebuke takes from every slice the enemy brought, never
from a summon, whose integrity is fixed.

## The thirty effects

A **trigger** (T) fires when a happening activates its slice; a **passive** (P) works while its slice is
active. Adam asked for flavourful names; these are a first draft for him to change on the page.

| Aspect | Effect | What it does |
|---|---|---|
| Violence | **Sellswords** (T) | Summon a Mercenary: pulls +10 a second |
| | **No Quarter** (P) | Each Mercenary act: 25% to kill an enemy summon it can beat |
| | **Spoils of the Field** (P) | +30 when the happening changes away from Violence |
| Diplomacy | **Trusted Envoy** (T, figure) | + the figure's kindness |
| | **Sweeter Terms** (T) | Each enemy summon turns: 50% if power is above its integrity, else 20%; it deserts if your side is full |
| | **Endless Parley** (P) | +2 a second; aura: the opponent's power -5 while the tug favours them |
| Holy | **Divine Rebuke** (P) | An enemy summon acts: 20% that every enemy slice's integrity -10 |
| | **Ordination** (T) | Summon a Priest: pulls the integrity of your active slice less the enemy's, never below 0 |
| | **Sanctuary** (P, building on the line) | The building enters the first time the slice is active; +5 piety if won |
| Reason | **Learned Counsel** (T, figure) | + the figure's reason |
| | **Refutation** (P) | 20% to cancel an enemy trigger |
| | **Seen Through** (P) | An enemy summon acts: 20% to give +5 |
| Authority | **Raise the Watch** (T) | Summon an Enforcer: costs its own side 5 a second; each act silences the enemy summon pulling hardest for 3 seconds - boosted, and cut to whole seconds - a silence refreshed rather than stacked |
| | **By Decree** (P) | 25% to stop each enemy summon's act, if power is above that summon's integrity |
| | **The Firm Hand** (P) | Aura: the opponent's power -5 while the tug favours you |
| Freedom | **Raise the Commons** (T) | Summon a Rebel: +5 a second, +10 while behind |
| | **Against the Grain** (P) | +20 when its slice is activated by the draw, matching neither aspect nor anti-aspect |
| | **Will of One's Own** (P) | Once in a challenge, at a change that would not keep its slice for its aspect, the slice stays active anyway; it is not spent on a change that boosts it, and a slice kept by it is not on stage by the draw |
| Greed | **Counting House** (T, building on the line) | The building enters on activation; +5 wealth if won |
| | **Farm the Taxes** (T) | Summon a Collector: costs its own side 3 a second and puts 6 an act into its **coffer**, which pours into the tug at the next change or at the end, and is lost if the Collector is killed |
| | **Pick the Bones** (P) | +10 whenever an enemy summon is killed |
| Generosity | **Open-Handed Patron** (T, figure) | + the figure's kindness |
| | **Give Alms** (T) | Summon a Benefactor: +5 a second, +10 while behind |
| | **Remembered Kindness** (P) | +15 whenever a friendly summon is killed |
| Nature | **The Wild Hunt** (T) | Summon a Predator: +5 a second, or instead 20% to kill an enemy summon it can beat |
| | **Teeming Wilds** (P) | An enemy summon acts: 20% to summon a Creature, +3 a second |
| | **The Wild Remembers** (P) | +30 when the happening changes away from Nature |
| Industry | **Raise the Engines** (T) | Summon a Machine: +10 a second |
| | **Works and Forges** (T, building on the line) | The building enters on activation |
| | **Well-Oiled** (P) | A friendly summon acts: 20% that it pulls 5 more |

Two of them were rebalanced in the planning. Adam's Enforcer and Collector took tug from their own side, and his
word was to keep the cost and buy something strong with it: the silence and the coffer. *Pulling hardest* is the
largest pull of one act, boost and all, ties drawn from the seed. *Behind* is the tug strictly favouring the
opponent. The Creature's +3 is a first number of the plan's, Adam having named none.

## The challenge kinds

The **challenge engine** draws progressions from named **challenge kinds** in the catalogue (Adam): Battle,
Debate, Trade war and Sermon to begin with. A kind has a duration range, a happening-count range, a weight for
each aspect, and a chance that a happening has two aspects, the second drawn by weight from the other nine. A
kind and a seed give a progression.

## The simulator

The lower half of `/admin/inspect-challenges`, under the catalogue, which the page reads and edits as every
inspect page does (Adam: all four of the extras):

- up to three slices a side;
- what goes in a slot is a **stand-in** made on the page (Adam): a key figure is a name and four stats, a
  building a name, a kind and a level, so nothing in the world is read and it works with no world;
- a progression drawn from a kind, or written by hand;
- a seed shown with every run, which typed back gives the same run;
- **Run** gives the run's **moments** as a table - second, happening, side, who, what, change, tug - with the
  tug drawn over time and the outcome under it;
- **Run 100** and **Run 10000** give how often each side won, how many were pulled to 100, and the mean end tug.
  Run 0 is the seed given and the log shown; under a kind each run draws its own progression.

What runs is the catalogue in force, not edits not yet saved, and the page says so beside Run.

## The events, named now and built later

Adam's word was to agree the names in this plan and build them when challenges reach the game. Approved on
2026-10-20:

| Event | Stream | What it means |
|---|---|---|
| `villages.challenge.resolved.v1`, `ChallengeResolved` | `challenge:<id>` | A challenge was fought out and settled: its kind, its progression, both sides' slices, the seed, the catalogue version, the engine version and the outcome. The outcome is the truth, and the spectacle is played again from the rest |
| `villages.structure.damaged.v1`, `StructureDamaged` | `structure:<id>` | A building lost a tenth, with its effectiveness now |
| `villages.character.fatigued.v1`, `CharacterFatigued` | `character:<id>` | A person lost a tenth, with their effectiveness now |
| `villages.house.gainedSlice.v1`, `HouseGainedSlice` | `house:<id>` | A house came to hold a slice: the first at its founding, others unlocked later |
| `villages.player.fittedSlice.v1`, `PlayerFittedSlice` | `house:<id>` | A player chose a slice's effects and what stands in its slots |

None is in `docs/EVENTS.md`, because its spec holds the catalogue and the code to each other both ways and none
of these is in the code. When they are built, a challenge's losses land on the structure's and the character's
streams a moment after `ChallengeResolved`, by a listener; until it acts, the thing still reads whole.

## The engine

**In the domain**, in a package of its own, `villages.domain.challenge`, because the event's payload is made of
its types and a run from a fixed seed is a rule. The luck is choosing the seed, and that stays in the
application, as the fate engine's does (decision record 0083). The numbers are drawn by a hand-written
SplitMix64, pinned by its reference values, so a seed gives the same run on every Kotlin version; the tug is a
`Double`, and the page shows it to one decimal. Decision record 0107 has the reasons.

In `backend/domain/src/main/kotlin/villages/domain/challenge/`, every file well under the ceiling:

- `Aspect.kt` - the aspects and their anti-aspects, and `Side`;
- `ChallengeCatalogue.kt` - `ChallengeEffect`, `ChallengeSlot` and what it `Fits` (a key figure or a structure;
  `Takes` is the structure slots' word), `SummonSpec`, `ChallengeKind`, its own rules `require`d as
  `StructureCatalogue` does;
- `ChallengeRules.kt` - the balance numbers;
- `ChallengeSetup.kt` - `ChallengeSlice`, the stand-ins, `Happening`, `Progression`, and what refuses a setup;
- `Rng.kt` - SplitMix64;
- `Moments.kt` - `ChallengeMoment`; `Outcome.kt`;
- `Contest.kt` - `Challenge.resolve(setup, seed, catalogue, rules)`, with one `pull()`, the only place the tug
  changes;
- `Stage.kt` - the active slice, the boost, the auras;
- `Summons.kt` - the cap, kills, turning, deserting, silences, things on the line;
- `Behaviours.kt` - the hooks an effect may hang on (activated, happeningChanged, everySecond, beforeEnemyActs,
  enemyActed, friendActed, enemyTriggered, summonKilled, aura, keepsStage), and `ChallengeBehaviours`, which
  holds the catalogue and the code to each other both ways; until the last pair was built, an effect not built
  yet was `Unbuilt` and said so in the log;
- `Shared.kt` - the behaviours several effects share: hiring, a slot asked for, a pull as the happening changes
  away, a summon's flat pull and its pull while behind;
- one file a pair: `ViolenceDiplomacy.kt`, `HolyReason.kt`, `AuthorityFreedom.kt`, `GreedGenerosity.kt`,
  `NatureIndustry.kt`;
- `Progressions.kt` - a progression drawn from a kind.

`ChallengeSimulator.kt` in the application, beside `DialogueService.kt`, takes the seed and the catalogue in
force. The specs are in `backend/domain/src/test/kotlin/villages/domain/challenge/`: one for each rule, a
property spec holding the tug within its ends and a seed to its run, and golden logs as text tables under
`domain/src/test/resources/challenge/`.

**The moments are data.** Each says the second, the happening, the side, who acted - a slice, a summon by its
serial, or the challenge - what was done, by which effect, to whom, how much, whether boosted, the change to the
tug and the tug after it. A moment changes the tug once at most, so the changes add up to the tug, and a summon
keeps its serial when it turns, so a spectacle later can follow it.

## The catalogue

`world/catalogues/challenges.json`, made as `fate.json` is: the effects by id, each with its aspect, its words
with `{number}` holes, its numbers, the summon it makes and its slot; the summons; the challenge kinds. The
numbers that belong to no one effect - the boost, the tug's ends, the factors for things on the line, the step
of effectiveness - are a `challenge` group of `balance.json`. It is read by `ChallengesFile.kt` beside
`FateFile.kt` and by `challenges.ts` beside `fate.ts` in the world package, both against
`contracts/fixtures/challenges.json`; the shelf reads it (`ShelfReader`, `Catalogues`, `Shelf`), and
`Catalogues.check()` refuses one whose effects and behaviours do not match.

## The frames

Three, all instruments, closed when the instruments are (decision record 0076), at protocol 58:
`simulateChallenge {id, a, b, progression?, seed?}`, answered by `challengeSimulated {id, seed, catalogue,
progression, outcome, moments}` or `simulationRefused {id, code, reason}`, the code `invalidSetup` or
`instrumentsClosed`. Protocol 59 adds a kind to draw from and 60 a number of runs and the batch's sums. They are
`ChallengeFrames.kt` and `challengeFrames.ts`, beside the catalogue frames, with their fixtures; `frames.ts`
is at 396 lines, so something leaves it before these arrive. The gateway's part is `ChallengesPart.kt`, a
mechanic that greets nobody and answers only the page that asked, and the server's wiring `ChallengesConfig.kt`.
At most 600 seconds, three slices a side and ten thousand runs.

## The page

`frontend/apps/web/src/admin/challenges/`, beside `rolls/`, at `/admin/inspect-challenges`, naming the
`challenges` catalogue: the catalogue in five columns of a pair each, then the summons and the kinds, edited with
the inspect pages' own fields; then the simulator, its sides, its progression, its seed, its table of moments
and its outcome. It connects as `useShelf.ts` does, with no hello, and takes nothing from the game but `net`.
It is Adam's page and not the player's interface, so nothing is added to the component library.

## The rules that must hold

All are held at once, inside the run; none spans two histories in this iteration.

| Rule | Held by |
|---|---|
| The tug stays within ±100, and the challenge stops at an end | `pull()` in `Contest.kt` |
| One active slice a side after the first happening | `Stage.kt` |
| No summon arrives past its side's cap | `Summons.kt` |
| A slice carries two effects of its own aspect; a slot holds only what it takes | the setup's refusals, before a run |
| A thing on the line enters once in a challenge at most | `Summons.kt` |
| The same setup, seed and catalogue give the same moments and outcome | SplitMix64; the property spec and the golden logs |
| Every effect in the catalogue has a behaviour, and every behaviour an entry | `Catalogues.check()`; the shelf refuses a file that breaks it |
| Later, in the game: a loss lands on the thing's own stream | a listener, a moment after `ChallengeResolved` |

Every new check is seen to fail once.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **The documents.** This plan; decision record 0107; the Challenge entry in `MECHANICS.md`; the words in `GLOSSARY.md`; the roadmap | Read the Challenge entry; the thirty names; the rules the plan filled in |
| 2 | **The catalogue on the shelf, and the page reading it.** `challenges.json`, its two readers and its fixture, the shelf, and `/admin/inspect-challenges` listing it; `RUNNING.md` | 👀 The page shows thirty effects in five pairs, nine summons and four kinds; 👀 a file broken by hand is refused and named |
| 3 | **Editing on the page, and the balance's challenge group** | 👀 A number saved is one line of diff and the server takes it on; 👀 the Balance page shows the group |
| 4 | **The engine with Violence and Diplomacy**, the behaviours held to the catalogue, the rest saying they are not built; *The challenge engine* in `ARCHITECTURE.md`. Nothing to see in the program: a golden log stands in | The golden log: Sellswords and No Quarter, Sweeter Terms turning and deserting, Endless Parley's aura; a simultaneous second |
| 5 | **The frames and the gateway's part**, protocol 58, and a button running the sample | 👀 The button runs and the outcome shows; 👀 with the instruments closed it is refused |
| 6 | **The simulator** - the first that can be played: sides of up to three slices with stand-ins, a progression by hand, the seed, the table, the tug drawn | 👀 Violence against Diplomacy, run; 👀 the same seed twice, the same moments; 👀 an effect not built says so |
| 7 | **Things on the line; Holy and Reason** | 👀 A building arrives for 10 × level, pulls, and killed is damaged in the outcome; 👀 the Priest grows as Divine Rebuke takes integrity; 👀 Refutation cancels a trigger |
| 8 | **Authority and Freedom** | 👀 The Enforcer costs and silences; 👀 By Decree stops acts; 👀 Will of One's Own keeps Freedom on once |
| 9 | **Greed and Generosity** | 👀 The coffer fills, pours at a change and at the end, and is lost with its Collector; 👀 the Benefactor pulls harder behind; 👀 piety and wealth when won |
| 10 | **Nature and Industry**, and nothing left unbuilt | 👀 The Predator kills instead of pulling, and the Creatures come; 👀 Machines and Well-Oiled |
| 11 | **The challenge kinds drawing progressions**, protocol 59 | 👀 Battle drawn, the same progression for the same seed; 👀 a kind's weights changed, and seen |
| 12 | **Batches**, protocol 60 | 👀 A thousand runs: who wins how often, how many pulled to 100; how long it takes |

Steps 7 to 10 do not lean on each other, and 11 could come straight after 6. Step 13 was asked for by Adam on
2026-10-21, once he had run batches:

| # | Step | Verification requests |
|---|---|---|
| 13 | **A batch drawn whole**, protocol 61: where every run stood each second as a heatmap, the two ends rows of their own, where the runs ended beside it, the seed's run over it | 👀 run 10000, and the heatmap reads; 👀 a cell and a bar say what they hold |

## Not in this plan

- Challenges in the game: who raises one, when, what a house brings, the pane, the spectacle played on it.
- How a house comes by slices, and the slice everyone starts with in the game.
- The damaged and fatigued states in the world, what effectiveness does there, and how either is mended.
- Effects outside their slice's aspect; relics and spirit items in slots; more aspects.
