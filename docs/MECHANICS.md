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

---

## Character dialogue

People talking to each other. Nothing here is new to games, and it is not meant to be: what it is for is
making the world feel alive and personal.

### What it is

Two or more characters in conversation, shown as a back and forth of **speech bubbles** the player steps
through. One character stands on the left, another on the right, and the bubbles run between them,
scrollable so that what has already been said can be read back. In a discussion of more than two, each
bubble carries a small tag saying who said it.

The same shape covers three cases, and they are one mechanic rather than three:

- A **conversation** between two characters.
- A **monologue**, which is the same thing with one speaker.
- A **group discussion**, where more than one character stands on each side.

A dialogue can be triggered by anything: a storyline reaching a beat, a place the player has gone, another
house acting, a choice roll's outcome.

### What it is for

**Making the world personal.** The world is a map of houses and ground until somebody in it speaks. A
dialogue is where a key figure stops being a number on a card and becomes someone with a manner.

**Carrying storylines.** A storyline is told through dialogue rather than announced in a log. This is the
mechanic a quest, a pact or a betrayal is actually delivered in.

**Holding other mechanics inside it.** Stepping through a dialogue can open an opportunity to take a
**choice roll**, and the roll's options come back into the conversation. A dialogue is a place other
mechanics happen, not only a thing to read.

**Paying off what the house has built.** What a character says and what they will do for you depends on
what they are to your house. A character loyal to the house can offer a reward inside the conversation
that the same character would not offer a stranger. The house-spirit and whatever relationships the world
grows are inputs to a dialogue, the way the house's state is an input to a roll.

### Look and feel

A section of the interface is given over to the dialogue while it runs, taking screen space rather than
floating in a corner. Characters face each other from the two sides; in a group discussion they stack
evenly on both sides. Behind them, preferably, a **background scene** rather than a flat panel.

**Feel is the point of this one.** Characters should move — entering, leaving, reacting — and fade in
rather than appear. A dialogue that pops between static portraits would deliver the same words and none of
the aliveness it exists for.

It is **responsive from the start**: on a desktop the dialogue sits beside what else is on screen, and on
a phone it is what is on screen. See `RESPONSIVE-DESIGN.md`.

### Not decided

- **Who the characters are.** Key figures of a house, NPCs from the warped history, and whether another
  player's house ever appears as a speaker.
- **What the world remembers of a dialogue.** Whether lines are events, or only their outcomes are, and
  what a reader of a house's stream sees of a conversation afterwards.
- **What triggers one**, beyond "anything". The triggers are a list nobody has written.
- **Where the art comes from** — the characters, their expressions, and the background scenes.
- **Whether a dialogue can be left and returned to**, and what happens to one the player walks away from.

### Where it stands

Nothing of it exists. No event, no frame, no component. `ARCHITECTURE.md` records what showing one would
ask of the client, and it is on the roadmap under Later.
