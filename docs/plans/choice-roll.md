# The choice roll

**What belongs here:** how the choice roll gets built as the core loop: the button and what it costs, the
omens the fate engine reads and where each comes from, the pools and the actions in them, the deal, the
commands and events, what crosses the wire, the pane and its report card, the debug section, and the order
it all gets built in. **What does not:** what the mechanic is for, which is `MECHANICS.md`; why it is shaped
this way, which is decision records 0083 and 0084; the words, which are `GLOSSARY.md`; the
hypothesis, which is experiment 0015. When a part of it is decided, that part becomes a decision record and
leaves.

Planned on 2026-10-04 from Adam's description and his answers to fifteen questions, which are recorded in
the sections they settled.

---

## The problem, in one paragraph

A house has five resources and nothing to do with them, and the choice roll the documents describe has
never been built: a choice today is only ever the founding one, handed out on arrival. The core loop is the
roll itself. The player presses **Take action**, pays for it, watches the things the game took into account
land one after another like the scores on a report card, sees the rarity stamped, and is dealt a hand of
options to choose from. What they were looking at, what they had open and how the house stands decide what
the hand is *about*; luck alone decides how *good* it is. The aim is agency and the gambler's rush at once:
the player aims the roll by what they look at, and the rarity is a real gamble.

## The words

- **Omen.** One thing the fate engine took into account for a roll: *Holdings in Sweden*, *Pious*,
  *Sir Jeoffrey*, *River*, *Winter*, *Unknown*, *Missing wealth*. Each has a stable key (`map.river`,
  `figure:<id>`), a kind saying where it came from, the words the player reads, a mark, and sometimes a
  value (*Pious 64*). Adam chose the word.
- A roll's omens are recorded whole on its event, in the order they are shown. They are not given a word of
  their own: *reading* was the candidate, and *reading place* already means something else.
- **Pool.** A named grouping of actions, opened by omens. An action can be in many pools. **The player never
  sees a pool**, only omens: pools are the game's own filing and can be reorganised without anybody
  noticing.
- **Action.** One thing a roll can offer: a rarity, the pools it is in, and a way of **dealing** it, which
  fills in its details from the omens and the world at the moment of the roll (*a visit from a stranger
  from the farthest house you know of*). Dealt, an action becomes an **option** of a choice, as today.
- **Take action.** The button that provokes a roll. Words, not a mark: Adam's call.

The existing words keep their meanings: a **choice** is a prompt and its options, **taking an action** is
picking one, **rarity** is common, uncommon, rare and legendary in grey, green, blue and orange.

## How a roll goes

1. The player presses **Take action** in the bottom middle pane. It is greyed out, and says why, while a
   choice is pending or the house has less than the price free.
2. The browser sends `roll` with **what it is looking at and nothing it could work out for itself**: the
   centre of the view and the zoom, which inspect windows are open, which dialogue is open, which key figure
   is focused. No terrain, no names, no omens.
3. The server works out the **omens**: every omen source is asked in turn (below). Whatever the browser named
   is checked, and anything the house may not see is dropped silently.
4. The **rarity** is rolled from fixed odds, **70 / 22 / 7 / 1**, the same for everyone. Omens never move
   the odds (Adam: *pools only, odds fixed*). The whole hand is that one rarity (Adam: *one rarity per
   roll*), so the reveal has one moment and a legendary never sits beside two commons.
5. The **open pools** are the ones an omen of the roll opens, and *Hearth*, which is always open.
6. The **candidates** are the actions of the rolled rarity in any open pool that can be dealt now. Each is
   weighted by **how many open pools it is in**, so an action the omens point at from two directions is
   likelier. **Three** are drawn without putting back, and each is dealt into an option that carries its
   rarity and **the omens that brought it**: those that opened its pools, other than Hearth.
7. One decision records it all: the roll, the price, the choice. The pane plays the report card and the
   hand.
8. **The player must take one of the three in the end** (Adam: *must pick, can set aside*). The hand can be
   minimised and left; Take action stays greyed out until it is answered. No walking away, no reroll.

The price is **10 wealth**, Adam's temporary number, and a house is founded with **50 wealth** so that it
can roll at all (Adam: *founded with some wealth*). The price is the application's, carried on the command
as a spend, so the domain stays content-free and the number can move without touching it.

## Where the omens come from

Each source is one small class asked for its omens; a new system that wants to colour the rolls adds a
source, and nothing else changes. These are the first ones, one at least from every kind Adam listed:

| Kind | Omens in this plan | Worked out from |
|---|---|---|
| House | *Holdings in &lt;region&gt;*, *Weak house*, *Pious* | the seat's region in the gazetteer; under two world-years since founding; piety at or above 100. Both numbers are Adam's to tune |
| Change | *Piety risen*, and the same for each resource | what the house had at its last roll, against now |
| Window | *Inspecting House Varga*, *Inspecting &lt;area&gt;* | the open inspect windows, each checked against the fog |
| Dialogue | *Unresolved: &lt;dialogue title&gt;*, *Missing wealth* | the open dialogue, if it is one of the house's own; *Missing wealth* when its next choice offers a spend the house cannot pay |
| Key figure | *Sir Jeoffrey* | the focused key figure, if they are the house's own |
| Map | *River*, *Coast*, *Forest*, *Mountains*, *Open sea*, *House Varga*, *Unknown* | the centre and the zoom, read against the **ground map** and the fog (below) |
| Season | *Spring*, *Summer*, *Autumn*, *Winter* | the world month |

**The map, read by the server.** The server cannot see the map today: terrain, rivers and coast exist only
in the pictures the browser draws. Adam's answer was to teach it rather than trust the browser, so the
browser sends only a coordinate and a zoom. A new world tool, `world:ground`, cuts each master into a
**ground map**: a coarse grid over the Mercator square of what the ground is at each cell - its terrain
class, whether a river runs through it, whether it is coast, its biome - written beside the stands and read
by the server through a port, as the stands are. The roll's **looking circle** is the centre and a radius
the zoom gives, as wide as an ordinary window would show; only ground the house has revealed counts.
Zoomed out, the circle is wide and the omens are broad (*Coast*, *Mountains*); zoomed in, it is narrow and
houses and characters inside it become omens by name. A circle with no revealed ground in it gives one omen,
*Unknown*, and no other map omens. Grid size and the thresholds for "present" are settled in that step, by
measuring.

## The pools and the first actions

Twenty actions, one of each rarity for each resource, and one dialogue, the gossip. Every action is in
**Hearth**, which is always open, so a hand can always be dealt at every rarity; the themed pools only make
the actions they hold likelier. The words below are a first draft for Adam to change.

| Pool | Opened by | Holds |
|---|---|---|
| Hearth | always | everything below |
| Coin | *Missing wealth*, *River*, *Coast*, *Weak house* | the wealth actions |
| Land | *Holdings*, *Forest*, *Mountains*, any terrain omen | the domain actions |
| Court | a house on screen, *Inspecting* a house, a key figure | the influence actions and the gossip |
| Learning | *Winter*, *Inspecting* a character | the reason actions |
| Faith | *Pious*, *Piety risen* | the piety actions |

| | Common (+15) | Uncommon (+40) | Rare (+120) | Legendary (+400) |
|---|---|---|---|---|
| Wealth | Collect the mill's dues | A merchant's debt is paid early | A wreck's cargo comes ashore on your land | Silver is found under the home farm |
| Domain | Take the lease of a neighbouring field | The widow's farm passes to the house | A border wood is granted by charter | A county falls to the house by marriage contract |
| Influence | Dine with the reeve | Stand godparent to a neighbour's child | A seat on the regional council | The Crown's ear |
| Reason | Read in the long evenings | Engage a tutor for the household | Correspond with a scholar abroad | A dead bishop's library comes to the house |
| Piety | Hear mass with the village | Endow the chapel's candles | Shelter a pilgrim of renown | A relic is entrusted to the house |

The amounts are Adam's: **15 / 40 / 120 / 400**, so a common pays the roll back and a little more, and a roll
is worth about 30 on average against a price of 10.

**The gossip** is a common in Hearth and Court: a servant brings news of **the nearest other house**, by
name, as a short dialogue ending in a dialogue choice, *spread it* (+5 influence) or *keep it to yourself*
(nothing). With no other house it cannot be dealt, and the hand is drawn without it. A real gossip engine is
its own later piece of work (Adam).

Two checks hold the content honest, and each is proved by breaking it once: every action is in Hearth and at
least one pool, and every rarity has at least three actions in Hearth that can be dealt with no omens at all.

## The commands and events

One new command and one new event; everything else is the existing choice pattern, with two fields more.

- **`Roll`**, decided by the choices part: the omens, the rarity, the price as a spend, and the choice the
  fate engine dealt. Refused as `NoSuchHouse` before founding, `ChoicePending` while one is pending, and as a
  spend is refused when the price is not free.
- **`villages.player.rolled.v1`**, `PlayerRolled`: `houseId`, `player`, `rollId`, `omens` (each one's key,
  kind, words and value), `rarity`. A player's event: the player reached into the world. Then, from the
  same decision, `villages.house.resourceSpent.v1` for the price and `villages.player.givenChoice.v1` for
  the hand, one correlation id, consecutive versions. The randomness is all in the application, before the
  command; `decide` only checks and records.
- **An option gains `rarity` and `omens`**, both absent on the founding options. Absent fields read as
  absent, so stored events are read as they were written (0074) and nothing is wiped.
- **`villages.house.founded.v1`** carries 50 wealth rather than none. Its shape does not change.
- **An effect that offers a dialogue**, `Effect.Converse`, for the gossip: taking the option writes
  `villages.player.offeredDialogue.v1` from the same decision, on the same stream.

This changes one sentence of `ARCHITECTURE.md`, which says a roll is not a decision of the domain and only
the taken option becomes an event. A roll that costs something is a decision, and its omens are the
house's history: the next roll's *Piety risen* is worked out against them, and they answer "why was I offered
this?" for ever. Decision record 0083 says so.

## What crosses the wire

- In: `roll { centre, zoom, inspecting, dialogue, figure }`, every field but the first two optional.
- Out: `yourChoice` as today, its options with `rarity` and `omens`, and the choice with the `omens` it
  was rolled from.
- `PROTOCOL_VERSION` goes up once, `contracts/protocol-v23.txt` is written, and the fixtures gain a roll
  and a rolled choice.

## The pane: a report card, then the hand

**The choice roll pane is always there now**, in bottom middle (Adam: *the bottom middle pane, grown*). Idle
it is the Take action button. Pressed, it opens to full in its own bay and plays the roll as **a list that
fills like a report card at the end of a level**, Balatro's scoring the reference: each omen slams into the
list as a row, its mark, its words and its value; then the rarity is stamped across it; then the three
options pop in. Once they are in, the list folds to **a strip of omen marks above the options** (Adam:
*stays, folded small*), each option carrying the marks of the omens that brought it, so the two can be
matched by eye. A click hurries the list, landing every remaining row at once, and **the stamp is never
skipped**, because that is the rush. A page reloaded mid-roll shows the end state, not the animation.

What it is made of goes into the component library first, each shown at `/admin/inspect-ui-components` in
every state before it is used: the omen row, the report-card list, the rarity stamp, the strip of omen
marks, and an option card edged in its rarity. Omen marks are placeholders copied from the moodboard, one
per kind to begin with; which pictures in `world/ui/` and at what size is said in that step.

## The Choice roll section

A folding section of its own in the debug panel, because that is where Adam verifies: the last roll's omens,
omen by omen with where each came from; the pools it opened; the candidates and their weights; the odds and
the rarity drawn. One lever, **next rarity**, which stands in for the world's luck and not for the player:
the next roll is that rarity, so a legendary can be seen without four hundred presses. Every roll is a
`note('roll', …)` line saying what was paid and what was dealt.

## The steps, one commit each

**Checkpoint 1: the shape in words.**

1. **The documents.** Done. Decision records 0083, *a roll is paid for and recorded with its omens*, and 0084,
   *the server reads the ground*; the choice roll entry in `MECHANICS.md` with everything Adam settled; the
   fate engine in `ARCHITECTURE.md`; *omen*, *pool*, *action*, *Take action* and *ground map* in
   `GLOSSARY.md`; experiment 0015's hypothesis.

**Checkpoint 2: a roll that costs, on the server.**

2. **A house is founded with 50 wealth.** Done. `foundingStocks` and `FOUNDING_WEALTH`; the resource specs stand on a house whose founding wealth is spent, so they still count from nothing. The founding stocks, the catalogue's words, the decider spec.
3. **`Roll` and `PlayerRolled`.** Done. `Roll.kt` holds the rarity, the omen and its kind; the choices part
   decides the roll, its price and its hand in that order; the choices projection hands the roll's omens on
   with the hand it dealt; the event samples moved out of `EventFormatSpec` into `EventSamples.kt` to make room
   under its ceiling. Rarity in the domain; an option's rarity and omens; the command, the event,
   the refusals, the store adapter, the catalogue and the fixtures. Decider specs for each refusal and for
   the three events of one decision.
4. **The fate engine.** Done. `villages.application.fate`: `Moment` and `Looking`, `OmenSource`, `Pool`,
   `Action`, `FateEngine` with `ODDS`, and `RollService` with `ROLL_PRICE`; specs with toy content. Omen, pool, action, the odds and the deal, in `application`, with the dice
   port; tests with fixed dice for the rarity, the weights and the draw without putting back; the two
   content checks.
5. **The first content.** Done. `FirstPools`, `ResourceActions` and `HouseOmens`, the keys in `OmenKeys`;
   `FirstContentSpec` holds the two rules, each seen to fail once. The twenty actions, the six pools, and the house omens: *Holdings*, *Weak house*,
   *Pious*.
6. **The wire.** The `roll` frame with only the centre and the zoom, the choice view's new fields, version 23
   and its recording, the client-core command.

**Checkpoint 3: Adam presses the button.**

7. **The Take action button and the rarity-edged option card,** in the library and on its page.
8. **The pane stands always.** Idle, the button, greyed with its reason; pressed, a roll; the hand shown
   plainly with its rarity, no animation yet. The Choice roll section and its lever. Adam plays the loop:
   press, pay, choose, see the resource go up.

**Checkpoint 4: omens from what is open.**

9. **The page says what it has open.** The open dialogue and the focused key figure move out of React state
   into stores the net layer can read; `roll` carries them and the open inspect windows.
10. **Window, dialogue and figure omens,** each checked against the fog or against the house's own.
11. **Season, change and *Missing wealth*.** The month through the calendar port; a projection of what each
    house had at its last roll; the spend an open dialogue is waiting on.

**Checkpoint 5: the server reads the ground.**

12. **`world:ground`.** The tool, its grid and its file per master, gitignored output beside the stands;
    the quick start makes it, `RUNNING.md` and the regeneration list in `CLAUDE.md` say so. Grid size by
    measuring.
13. **Map omens.** The ground port and its folder adapter; the looking circle from the centre and the zoom;
    terrain, river, coast, open sea, houses and characters through the fog, and *Unknown*.

**Checkpoint 6: the report card.**

14. **The parts of it in the library:** the omen row, the list, the stamp, the strip of marks, with
    placeholder marks.
15. **The roll plays.** The rows slam in, a click hurries them, the stamp, the options pop in, the list
    folds to the strip; a reload shows the end.

**Checkpoint 7: gossip.**

16. **An option can start a dialogue,** `Effect.Converse`, decided through `Follow` into the dialogues part.
17. **The gossip** about the nearest other house, in Hearth and Court.

## Not in this plan

- A roll the world raises without the player, inside an event or a storyline.
- A choice expiring once the world has moved past it.
- Any hint on the button of what the roll will read (Adam: *only after paying*).
- Odds that omens or anything else can move; prices other than wealth, or a price that changes.
- The house-spirit, and every pool it would open.
- The gossip engine, and an action that names a stranger from far away; both have the shape here and wait
  on content.
- Rich content. This plan builds the machine and twenty-one actions to prove it; filling the pools is every
  later mechanic's business.
