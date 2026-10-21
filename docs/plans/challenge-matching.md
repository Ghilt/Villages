# Challenges, part two: matching aspect, buffs and debuffs

**What belongs here:** how the challenge's second iteration gets built - the rule that replaces one slice a side on
stage, the mark that balances it, buffs and debuffs, the effects that change and the ones that are added, the rules
that must hold, and the order it gets built in. **What does not:** what the mechanic is for, which is `MECHANICS.md`;
why it is shaped this way, which becomes an amendment to decision record 0107; the words, which are `GLOSSARY.md`;
the first iteration, which is `challenges.md`. When a part of it is decided, that part becomes a decision record and
leaves.

Planned on 2026-10-21 from Adam's word, after the matchup grid showed Authority losing everywhere.

---

## The change, in one paragraph

Until now each happening put one slice of each side on stage - one of its aspect, else one of its anti-aspect, else
one drawn at random - and only that slice did anything, half as much again. From now on **every slice meets every
happening**. A slice's **aspect matches** while the latest happening has its aspect, so a side may have several
matching slices or none. Whether an effect works in a happening its slice's aspect does not match is the effect's
own: an effect, or a kind of summon, marked **needs a matching aspect** works only while its aspect matches, and an
unmarked one works always. The aspect boost goes only to a matching aspect. The anti-aspect is no longer a rule of
the engine: it becomes a rule of design, that a slice is built to meet its anti-aspect's happenings well - a
Diplomacy slice can stand in a battle without the boost, because its effects are made for it.

## Matching aspect

- **At every happening, every slice's triggers fire**, unless marked and its aspect does not match. A trigger fired
  on a happening its aspect matches is boosted; one fired on any other is not.
- **A passive works while its slice's aspect matches**, if it is marked; always, if not.
- **A summon acts every second**, unless its kind is marked and the happening does not have the summon's own aspect.
  A summon is judged by its own aspect, as the boost already does.
- **The boost** grows what a matching slice or summon does, half as much again; nothing else is boosted.
- **Freedom's two effects that leant on the draw keep their nearest meaning:** *Against the Grain* pulls its amount
  at each happening its slice's aspect does not match, and *Will of One's Own* keeps its slice's aspect matching
  through one happening that does not have it, once a challenge.
- *Sanctuary*, *Counting House* and *Works and Forges* put their building on the line the first time they fire, as
  before; whether that waits for a matching aspect is their mark.
- The moments say, at each happening, which slices' aspects match.

### The first marks

Adam's word: the agent marks them, and the page lets him change any. The principle: what a house raises or builds is
raised when its moment comes; what a person lends, and what a summon does once it is there, works anywhere. That is
what lets a Diplomacy slice meet a battle.

| Marked: needs a matching aspect | Unmarked: works in any happening |
|---|---|
| Sellswords, No Quarter; Ordination, Sanctuary, Divine Rebuke; Raise the Watch, Curfew, The Firm Hand; Counting House, Farm the Taxes; The Wild Hunt, Teeming Wilds; Raise the Engines, Works and Forges; Terror | Trusted Envoy, Learned Counsel, Open-Handed Patron (a person's gift works anywhere); Sweeter Terms, Endless Parley; Refutation, Seen Through; Raise the Commons, Against the Grain, Will of One's Own, The Word Spreads; Give Alms, Remembered Kindness, Tend the Wounded; Pick the Bones; Well-Oiled; Spoils of the Field and The Wild Remembers, which fire as the happening leaves their aspect |
| The Creature, among the summons | Every other summon |

## Buffs and debuffs

A **buff** helps and a **debuff** hinders. Each is put on a slice or on a summon by an effect, for a number of
seconds the effect says, and lifts when they are up. Each has an entry in the catalogue - its name, its words, what it
goes on, its own numbers - and code that does what it says, held to each other both ways as the effects are.

- **The same one never stacks:** put on again, it lasts from then, at the stronger of the two.
- **Different ones add up:** a summon may be silenced and seen through at once.
- **Effectiveness** is how much of itself a slice or a summon still is, from 100% down: a debuff that lowers it
  takes its share off everything the slice or summon pulls. It is the word already used for a damaged building and a
  fatigued person, now said of slices and summons for as long as a debuff lasts.
- **A summon's integrity can now fall**, and at nothing the summon is gone, counted as killed: *Pick the Bones* and
  *Remembered Kindness* hear of it, and a thing on the line is damaged or fatigued.
- **Cleansing** lifts every debuff on its own side.

The chart, as the page will show it:

| | Name | On | What it does | Put on by |
|---|---|---|---|---|
| Debuff | **Stunned** | summon | does not act | the Enforcer (*Raise the Watch*), as now |
| Debuff | **Aspect-bound** | summon | acts only while the happening has its own aspect: the mark, put on an enemy | *Curfew*, Authority, new |
| Debuff | **Eroding** | summon | each act costs it {integrity} integrity | *The Wild Remembers*, Nature, reworked |
| Debuff | **Weakened** | summon or slice | works {percent}% less | *Seen Through*, Reason, reworked; *Dread of the Wilds*, Nature, new |
| Debuff | **Penalised** | slice | each trigger it fires on a happening its aspect does not match costs its side {amount} | *The Firm Hand*, Authority, reworked |
| Buff | **Hastened** | summon | acts half again as often: each second, {rate}% chance of a second act | *Well-Oiled*, Industry, reworked |
| Buff | **Echoing** | slice | {chance}% more chance each trigger fires twice | *The Word Spreads*, Freedom, new |
| Cleanse | | | lifts every debuff on its side | *Tend the Wounded*, Generosity, new |

Each is named for what it does, not for one effect's flavour, so effects of many flavours can put on the same one
(Adam's word of 2026-10-21); the effects carry the flavour.

A trigger fires twice with the balance's `doubleTrigger` chance, nought to begin with, plus what buffs add.

## The effects that change, and the new ones

Led by flavour, as Adam asked. Names and numbers are first drafts, renamed on the page.

| Aspect | Effect | Now | Was |
|---|---|---|---|
| Authority | **Curfew** (trigger) | Rings the curfew bell: every enemy summon is *aspect-bound* for {seconds} s | replaces *By Decree*, which never fires against slices of equal numbers |
| Authority | **The Firm Hand** (trigger) | Lays down the law: every enemy slice is *penalised* for {seconds} s | lowered the opponent's power while ahead, which Authority never was |
| Nature | **The Wild Remembers** (passive) | As the happening changes away from Nature, the briars close: every enemy summon is *eroding* for {seconds} s | +30 as it changed away, the same as *Spoils of the Field* |
| Reason | **Seen Through** (passive) | An enemy summon acts: {chance}% chance it is *weakened* for {seconds} s | {chance}% chance of +5 |
| Industry | **Well-Oiled** (passive) | A summon of this side acts: {chance}% chance it is *hastened* for {seconds} s | {chance}% chance it pulled 5 more |
| Violence | **Terror** (trigger), new | Spreads terror: every enemy slice is *weakened* for {seconds} s | - |
| Freedom | **The Word Spreads** (trigger), new | Every slice of this side is *echoing* for {seconds} s | - |
| Generosity | **Tend the Wounded** (trigger), new | Binds wounds and lifts burdens: every debuff on this side is cleansed | - |
| Authority | *Raise the Watch* | The Enforcer's silence is the debuff *Stunned*, its seconds as before | silenced by a rule of its own |

Violence, Freedom and Generosity have four effects then, the rest three; a slice still carries two of its aspect's.

## The engine

- `Stage.kt` loses choosing: it says which slices' aspects match at each happening and keeps *Will of One's Own*'s
  hold. `onStage` goes; passives and triggers are asked of every slice, filtered by their mark.
- A new `Conditions.kt` holds what is on each slice and summon and until when: putting on, refreshing, lifting when
  the seconds are up, cleansing, and what each does when asked - a summon's effectiveness and acts, a slice's
  effectiveness and second firings.
- `ChallengeEffect` and `SummonSpec` gain `matching`; the catalogue gains `buffs` and `debuffs`; the balance gains
  `doubleTrigger`. Both readers, the fixture and `Catalogues.check()` follow.
- `Challenge.ENGINE` goes to 2: a seed replays a challenge only on the rules that fought it.
- The moments gain *matches*, *buffed*, *debuffed*, *lifted*, *cleansed*, *fires twice*, *acts again* and *worn*.
  They travel as words in the frame that exists, so the protocol stays at 62 unless a field is needed.

## The page

- Each effect and summon kind shows its mark, and it is edited as a tick; the slice builder shows it beside each
  effect's words.
- The chart of buffs and debuffs, read and edited as the summons are, under the summons.
- The moments table says which slices match at each happening, and what was put on, lifted and cleansed.

## No events

Nothing here is stored. The agreed `ChallengeResolved` carries the engine's version already, so a challenge fought
on these rules will say so when challenges reach the game.

## The rules that must hold

All held at once, inside the run.

| Rule | Held by |
|---|---|
| A slice's aspect matches exactly while the latest happening has it, bar *Will of One's Own*'s one hold | `Stage.kt`, at each happening |
| Only a matching slice or summon is boosted | `Scene.boost` |
| A marked effect works only while its slice's aspect matches; a marked summon acts only while the happening has its aspect | where triggers fire, where passives are asked, where summons act |
| A buff or debuff lasts its seconds and no longer, and the same one never stacks | `Conditions.kt`, at the start of each second and as one is put on |
| Effectiveness stays within nought and a hundred; a debuff's share is at most a hundred | the catalogue's own rules, and `Conditions.kt` |
| A summon's integrity never falls below nothing, and at nothing the summon is gone, as a kill | `Summons.kt`, with the kills as they land |
| A summon acts at most twice a second | `Conditions.kt` |
| Every buff and debuff in the catalogue has code, and every code an entry | `Catalogues.check()`; the shelf refuses a file that breaks it |
| The same setup, seed, catalogue and engine version give the same moments and outcome | SplitMix64; the property spec and the golden logs, recorded again |

Every new check is seen to fail once.

## The names to agree

Terms: **matching aspect** (Adam's), **needs a matching aspect** (the mark), **buff**, **debuff**, **cleanse**,
**effectiveness** said of slices and summons, **act rate**, **fires twice**. The eight buffs and debuffs, and the
three new effects and the five reworked, as the tables above name them.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 15 | **Matching aspect.** Every slice meets every happening; the mark on effects and summon kinds, with the first marks; the boost only on a match; Freedom's two kept to their meaning; the engine at version 2; the mark shown and ticked on the page; the moments say who matches; `MECHANICS.md`, `GLOSSARY.md`, 0107 amended, `RUNNING.md` | 👀 Run the sample: each happening says which slices match, and an unmarked trigger fires out of its aspect without the boost; 👀 untick a mark, save, run again and see it work in every happening; 👀 the matchup grid on Even: what dropping the old routing did |
| 16 | **Buffs and debuffs: the machinery and the chart.** The catalogue's buffs and debuffs, both readers and the check; putting on, refreshing, lifting, the moments; the Enforcer's silence as *Stunned*; *Curfew* in place of *By Decree*; the chart on the page | 👀 The chart lists each buff and debuff, what it does, on what, and which effect puts it on; 👀 Authority with Curfew against Industry: the Machines idle out of Industry's happenings until the curfew lifts, and the moments say so |
| 17 | **The summons' debuffs, and cleansing.** *Eroding* and a summon's integrity falling to its end; *Weakened* and effectiveness; *Tend the Wounded* | 👀 The briars wear an enemy summon down until it is gone, and Pick the Bones hears of it; 👀 a seen-through summon pulls its share less; 👀 Tend the Wounded lifts them |
| 18 | **Buffs, the aspect boost among them.** The boost becomes the buff *Empowered*, put on by a happening on whatever matches it, its share the buff's own number rather than the balance's; *Hastened*, acting again; *Echoing*, firing twice; *Warded*, no debuff taking; *Steadfast*, never turned; the effects that put them on - *Blessing*, *War Drums*, *The Word Spreads*, *Foresight*, *Oaths of Fealty*, and *Well-Oiled* reworked. Adam's word of 2026-10-21 | 👀 The chart lists the buffs, Empowered among them, and its share is edited there; 👀 a run says "buffed: empowered" on what matches each happening, and the boost's × follows it; 👀 hastened summons act again, echoing triggers fire twice, a warded summon wards off a debuff, a steadfast one is not turned |
| 19 | **The slices' debuffs.** *Weakened* on slices, put on by *Dread of the Wilds*, Nature's fourth effect, since Violence had four already and Nature three and among the weakest; *Penalised*, by *The Firm Hand* | 👀 Dread of the Wilds weakens the enemy slices, cutting what they pull while it lasts; 👀 a penalised trigger fired off its aspect costs its side |
| 20 | **The anti-aspect in the effects.** For each aspect, a way to meet its anti-aspect's happenings, proposed to Adam with names and numbers before anything is built; the grid weighed again | Read and agree the proposals first; 👀 the grid on Battle and on Sermon, Diplomacy holding in a battle |

Step 18 was re-cut on 2026-10-21, when Adam asked for the boost as a buff and buffs of the agent's making; the slices' debuffs moved to 19. 20 waits on Adam's word on its proposals.
