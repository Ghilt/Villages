# Mechanics

> **What belongs here:** what the mechanics of the game are — what the player is offered, what they can do
> about it, and what it is for. One entry per mechanic. **What does not:** how a mechanic is turned into
> commands and events (`BUILDING-A-MECHANIC.md`), the shared visual language its look and feel draws on
> (`LOOK-AND-FEEL.md`), what the world is (`SETTING.md`), when any of it gets built (`ROADMAP.md`).

**Every mechanic has a name**, and that name is the word used everywhere afterwards: in conversation, in the
glossary, in the code and in the interface. An entry has four parts — what it is, what it is for, its look
and feel, and what is not decided about it.

Where a mechanic is driven by a part of the program, the entry names that part and points at
`ARCHITECTURE.md` rather than describing it. A mechanic is what the player meets; the engine behind it is
architecture.

---

## Choice roll

One of the primary mechanics of the game as it stands.

### What it is

The game presents a small set of choices, rolled from the state the house is in. The player picks one. The
rolling is done by the **fate engine**, which takes the house's stats, its house-spirit, where the player is
looking and what is around there; see `ARCHITECTURE.md`.

### What it is for

**Agency.** The player can provoke a choice roll themselves, at the moments that seem interesting to them,
and by choosing where and when they influence what the roll can offer. It is the main way a player reaches
into the world on purpose rather than waiting to be asked.

**The rush of a good roll.** Rolling legendary actions should feel like a gamble paying off. For that to
work the odds have to be real, so:

- There must be **plenty of rolls**, enough that repeated options do not become noticeable.
- A roll presents options of **comparable value**. If the player rolls legendary actions in a questline,
  every option offered is high value. A legendary is never presented alongside two commons.
- Rarity runs common, uncommon, rare, legendary, with the standard colours in `LOOK-AND-FEEL.md`.

**A way to do things at all.** A choice roll is how a player interacts with other players, progresses PvE
questlines, and acquires resources. It is not a side activity.

**A component the world can use.** A choice roll can also happen *without* the player provoking one, so that
events and storylines can raise one as part of their flow.

**It is clear when you provoke one.** A standardized button does it, so the player always knows that this is
the thing that rolls. The button can hint at what will go into the roll — if some other system gives us a
colour or a symbol, a flare or flourish of it on the button tells a player pursuing that thing to click now.
The flourish is a hint only: **timing the click to it must never matter**. That particular way of hinting is
an example rather than a decision.

**A choice can expire.** This is a multiplayer world that keeps moving. A player who rolls a choice and
leaves it for a real-life week comes back to a world that has gone on without them, and a choice that no
longer means anything stops being pending rather than waiting for ever.

### Look and feel

The options are shown as a **wooden desktop with an inkwell**, each choice a textbox styled as a
**parchment**. Hovering a parchment lifts it slightly, so it reads as something you can pick up. The shared
language this draws on — the diegetic rule, the rarity colours — is in `LOOK-AND-FEEL.md`.

### Not decided

- **What limits how many choice rolls a player can perform.** It is meant to cost something, and the
  candidate is resource use, but there is no resource system yet.
- **How a roll is hinted** on the button, beyond the example above.
- **How expiry is decided**: what makes a choice irrelevant, and whether the player is told it lapsed.

### Where it stands

Half built, under another name. The choice pattern runs end to end today — the world gives a choice, the
player takes an option, and the taken option's consequences are recorded from the same decision — but what
gives the choice is arrival rather than a roll, there is no fate engine, no rarity and no expiry. What
exists is in `BUILDING-A-MECHANIC.md` under the choice pattern, and in decision record 0034.
