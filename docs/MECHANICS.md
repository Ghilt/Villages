# Mechanics

> **What belongs here:** what the mechanics of the game are — what the player is offered, what they can do
> about it, and what it is for. One entry per mechanic. **What does not:** how a mechanic is turned into
> commands and events (`BUILDING-A-MECHANIC.md`), the shared visual language its look and feel draws on
> (`LOOK-AND-FEEL.md`), what the world is (`SETTING.md`), when any of it gets built (`ROADMAP.md`).

**Every mechanic has a name**, and that name is the word used everywhere afterwards: in conversation, in the
glossary, in the code and in the interface. An entry has five parts — what it is, what it is for, its look
and feel, what is not decided about it, and where it stands in the source today.

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

It is a **pane** with three sizes, and the mechanic owns all three:

- **Full** — the prompt and every option laid out to read through. What a question arrives at, because
  reading it is the thing to do first. The bottom middle of the spread; on a phone it takes the big bay and
  the pane beside it keeps the small one.
- **Small** — the **carousel**: one option at a time, with the way between them. For deciding rather than
  reading, because the places being offered are drawn on the map and the option you are on stays on the
  screen beside the one it means.
- **Minimised** — set aside to a strip. Not closed: the question is still standing.

**Its size is the player's**, which no other pane's is. The two forms are two ways of using it and only they
know which they are doing. See decision record 0044 and `RESPONSIVE-DESIGN.md`.

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

It is a pane with its three sizes as of 0044, which is also where the last media query in the app died: this
mechanic's one breakpoint asked the window rather than the stage and had never fired. There is no
standardised button that provokes a roll, because there is nothing to spend on one yet.

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

It is also the only place the setting's one secret is allowed to come out. `SETTING.md` records what is
actually happening to the world and states plainly that no player begins knowing it: **nothing in the
interface may say so**, and a mechanic that gives it away early spends the only card the setting is
holding. Dialogue, over a long time, is how it is meant to be found.

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

---

## Inspect window

The way the game answers "what is that". Not the map's own: the map is only the first place a player
points at something.

### What it is

A window that says what one thing in the world is. That thing is its **subject** — today a house or an
area, later a character, a holding, a work, a place named in a conversation. The window says what the
world knows about that subject, and then it offers **links**: the things worth looking at from here, each
of which opens on its own.

**A link is a way on, and there are two kinds.** One is another subject, which opens another inspect
window: from a house to the ground about its seat, from that ground to the house next door. The other is a
pane, which brings that pane up on this subject rather than opening a window — *show it on the map* is the
first of those, and it means the map, focused on the thing being looked at.

**Nothing about it belongs to the map.** A player points at a subject and a window opens; pointing at a
castle on the map is the first way to do that and not the only one. When **character dialogue** arrives,
a highlighted word in a line of speech — *Castle Erebus* — is the same pointing and opens the same window.
A mechanic that wants to say "and here is the thing I just mentioned" does not build anything.

### What it is for

**Knowing what a thing is.** A world of marks on a map is a world of marks until something says what they
are. This is the plainest need the interface has and the one everything else is built over.

**Getting somewhere from it.** A window is travelled from rather than read and closed. Following a link
from a house to the ground it holds, and from there to a neighbour who holds the ground beside it, is how
a player reads a neighbourhood — and it is reading, not searching, because the world hands over the next
question rather than making the player think of it.

**One window for every kind of thing.** The parchment renders any choice from its words and knows nothing
about what kind of choice it is showing; the inspect window renders any subject the same way. A new kind
of thing in the world costs a description of itself, not a component. This is the part that has to hold,
because everything the world grows will want to be looked at.

**Several at once, where there is room.** On a screen with space a player can have three open and compare
them. On a phone they get one, and the same links, each of which opens in the bay the window is not
next. Comparing two houses should not mean remembering one of them.

### Look and feel

A card, for now, with the subject's name at the top, what is known about it below, and its links at the
bottom. That is a description of what is there rather than a decision: the diegetic rule in
`LOOK-AND-FEEL.md` says what the player is shown should be part of the world, and a card is not, so this
is the shape most likely to change.

A link is **one button**, and it opens in the bay this window is not in, so the window it came from stays
on the screen; *show it on the map* is the map's own mark rather than words. It carried a pair of needles
saying which bay to open into until 0049, which is one decision per link too many.

It is **responsive from the start**: where there is room the windows stack in a rail, up to three, and on
a phone one of them takes a bay and its links open in the other one. See `RESPONSIVE-DESIGN.md`.

### Not decided

Most of what it will eventually say. **This entry is a foundation and not a design**, and what follows is
the list of what is still to be worked out.

- **What it says about each subject.** A house's window says its name, its banner, its seat, the day it
  was founded and its treasury, because that is everything the wire carries about a house. What a player
  actually wants to know — who holds what nearby, what this house has done, whether it is a friend — needs
  the things themselves before it needs a window.
- **Where the links come from.** Whether a subject describes its own links, or the world is asked what is
  near this thing and answers. The first is simple and the second is what a living world would do.
- **Whether it should be diegetic.** The desk is already under the map and the workbench is on the
  roadmap. A dossier, a letter or a page in a ledger would sit on it; a card floats over it.
- **Whether a window is kept.** Pinning one so a rail does not push it off, stepping back through what has
  been looked at, and whether any of it survives a reload.
- **What else can be a subject**, and whether a subject is ever something the server names rather than
  something the browser works out.

### Where it stands

The shape of it is built and what it can say is thin. A **subject** covers a house and an area, one store
for both, which is what the two selections that used to run side by side became. A window renders a
description and knows nothing of what made it. Links go both ways between a house and the ground somebody
has fenced around it, and *show it on the map* moves the camera. Up to three stack in a rail in the spread,
a fourth pushing the oldest off; on a phone one of them takes a bay and its links open in the other.

What it says is everything the wire carries and no more, which for a house is a name, a banner, a seat, a
founding day and one resource. It added no event and no frame, so the protocol version did not move. The
`Inspector` it replaces is gone, and so is `select/selection.ts`. The layout it sits in is decision record
0040.

---

## House status

How your own house stands, always to hand. The one thing on the screen that is yours rather than the
world's.

### What it is

A card saying how the player's own house is: who it is, what it has, and what it can do. It carries the
**bar of the house's own levers** along its bottom, and the **eye** is the first of them; five places
stand empty beside it (decision record 0038).

**This is the line between it and the inspect window, and it is worth stating plainly.** An inspect window
is *opened on* a thing and closed again; it can be about anybody's house. House status is never opened,
never closed, and is always about yours. One is a question the player asked; the other is the answer to a
question they did not have to.

**It can get out of the way.** Minimised, it collapses to a strip and gives its room back to whatever is
beside it. A player reading the map for a while should be able to have the map.

### What it is for

**Knowing where you stand without asking.** The treasury goes up while the player is looking at something
else. If seeing that costs a click, it will not be seen, and a resource nobody watches is a resource that
is not really in the game.

**The house's own levers, in one place.** The eye is not a setting and not a debug switch: it is something
the house does, and it belongs to the house rather than floating over the map. Everything of that kind
that comes later goes in the same bar, which is why the empty places are drawn rather than left out —
the bar is already the shape it will be and nothing moves as it fills.

**Making the house a face rather than a dot.** The banner and the name are what turn "my sprite" into "my
house". The player's own identity should be the best-looking thing on the screen, because it is the thing
they chose.

**Getting out of the way.** A status card that cannot be dismissed stops being read and becomes furniture.
Minimise is the mechanic admitting that the map is sometimes the whole point.

### Look and feel

A card in the corner, cut off by it: bordered on the two edges facing the world and flush against the two
that are the screen's, so it reads as part of the furniture rather than as a dialogue over it. The shield,
the name, the banner blazoned in words, and **the five resources as a row of marks** with a figure beside
each: a coin, a ridge of land, two rings that overlap, a pair of dividers, and a cross.

**Marks rather than words, and that was a decision.** Five words will not sit on one line of a phone, and
the small size of this card is one line. A mark is learnt once and then costs nothing; a word costs nothing
to learn and then has to keep fitting - in a column squeezed to 18rem, and in a language nobody has thought
about yet. The word is on the label until the mark is learnt. A resource with nothing pledged shows one
figure; one with a pledge against it shows what is free over the total, `65/100`, because what can be used
is the more urgent of the two. In the spread it is the lower tile of
the column, sharing an edge with the rail above it; see decision record 0041.

Three sizes, and the mechanic owns all three:

- **Full** — everything above, with the bar beneath it.
- **Small** — the shield, the name and the row of marks, with the bar under them. What it is when it is
  sharing a screen with something else. The row wraps to two lines in a bay too narrow for five marks, and
  the pane's height allows for that rather than clipping it.
- **Minimised** — a strip with the name on it and nothing more, so the player knows where it went.

It is **responsive from the start**, and it is the mechanic that proves the rule: the card has never fitted
a phone. See `RESPONSIVE-DESIGN.md`.

### Not decided

Nearly everything it will eventually say. **This entry is a foundation and not a design**, and it is thin
today because a house is thin today.

- **What a house does with what it has.** The five are there and the card says how much of each, but
  nothing in the game grants, spends or gates anything yet: no mechanic gives a house wealth, no rule asks
  whether it has enough domain, and a pledge is tied to a purpose written in free text because there is
  nothing yet for it to be tied to. The shape is built; what fills it is the next question.
- **What the marks actually are.** The five drawn today are **placeholders and were accepted as such**:
  they are distinct at seventeen pixels and they are learnable, which is what was asked of them, but
  whether a coin says wealth and a cross says piety to somebody who has not been told is a different
  question and has not been asked. The shapes can change without anything else moving. The fallback if
  marks turn out to be the wrong idea entirely - words at the full size, marks when squeezed - is open.
- **What the five empty places hold.** They are for the house's own levers and nobody has named the second
  one.
- **Whether it says what is happening as well as what is.** A choice pending, an event that just landed, a
  neighbour who did something — whether any of that belongs here or somewhere else entirely.
- **Whether it stays a card.** The workbench on the roadmap turns the desk under the map into a place with
  the house's papers on it, and the house's papers are this.
- **Whether it ever shows anything that is not yours** — a neighbour's standing beside your own, for
  instance — or whether everything about somebody else is an **inspect window** and this stays purely the
  player's.

### Where it stands

Named, and it fits. The house card from `1841023` is `HouseStatus` now, a **pane** the layout places rather
than a card positioned by hand, and it has the three sizes above: the corner card, one line and the bar, and
a strip. The `min-width: 26rem` that would not fit a 390-pixel phone - the first thing decision 0039's
instrument found - is gone.

It says a shield, a name, a blazon and **five figures** now: wealth, domain, influence, reason and piety,
each behind its own mark, and reason showing what is free over its total while something is pledged out of
it. That was what it was waiting on. What it is waiting on now is a reason for any of those numbers to
move on their own.

---

## Character

The people of the world: in Adam's words, the people and actors in it, and perhaps one day its pets.

### What it is

Someone in the world with a history of their own. A character has a name, is a woman or a man, is of a
**species** - a person, and only a person so far - and has a birthday and **four stats**. Their stats can
change, their age can be changed out of the ordinary, and they can die.

**The four stats are Piety, Reason, Kindness and Physical**, whole numbers from 1 to 20. Piety and Reason
are the house's Piety and Reason on purpose, the same words and the same marks, and one day they will be
connected. Nothing connects them yet.

**A character can be somewhere, or nowhere.** One with a place in the world is drawn there; one without
still exists, and is simply not on the map. They come onto it and leave it by what happens to them.

**A character ages with the world.** Their age is counted from their birthday rather than ticked: no event
marks a birthday. At a world month for every real day, that is a year every twelve real days - someone of
twenty-five is fifty-five after a real year - so a player watches the people of their house grow old.

### What it is for

**A world with people in it.** The world is a map of houses and ground until there is somebody on it. A
character is who a house acts through, who will speak in a **character dialogue**, and who can be standing
somewhere on the map when a player looks.

**Something to build on.** This is groundwork, and deliberately thin: "we will do more with key figures and
characters in the future". The one thing that has to hold is that a character is not a kind of anything.
What a character is to a house is a tie the house keeps, and a pet would be a character of another species
rather than a different sort of thing. See decision record 0055.

### Look and feel

- **A portrait**, one for life, from Adam's own hand-made art, in one frame wherever a face is shown. Until
  he has drawn them, placeholders stand in: cut-paper silhouettes of the period.
- **On the map, a small standing figure** drawn in code as the castle is, in the colours of the house they
  serve, with a ground form and an icon like everything else standing in the world. From zoom 9 by default,
  which "will depend greatly on the character".
- **Clicked on the map, an inspect window**: their name, their age, and whose key figure they are, with a
  link to that house.

### Not decided

- **What else a character carries.** Nothing is hidden today: no traits, no loyalty, no lifespan.
- **Other species**: what a pet's stats would be, and whether it has all four.
- **What decides how far out a character is drawn**, beyond the default.
- **Characters who belong to no house**: the famous characters of the warped history, who `SETTING.md` says
  have streams of their own and a decision AI to play them.
- **Dying of old age**, and whether anyone has a lifespan.
- **Whether a player can name one**, and whether a portrait ages with its sitter.

### Where it stands

The record exists on the server, and the one thing that makes one is a house taking a key figure in,
from the debug panel's Characters section. A character appears with a name, a sex, a species, a
birthday, four stats and a portrait's key, and is kept on a stream of their own; their stats move within
one to twenty, they can be aged out of the ordinary or given another portrait, and they die, after which
nothing about them changes. An age is worked out in the browser from the birthday and never stored. The
refusals are named for their rules, and the stored form is pinned by a fixture. Nothing draws a character
yet but the panel's lines. Decision record 0055 says what a character is to the program, and
`docs/plans/characters-and-key-figures.md` is the order the rest gets built in, one commit a step.

---

## Key figure

One of the few people a house acts through. In Adam's words it is a mechanic "kinda": a state a character
can be in, and the pane that shows them.

### What it is

A character a house has taken in. It is **a tie written in the house's history** - the house gained a key
figure, the house lost one - and **not a kind of character**: the character's own record does not change when
they become one. A house holds at most **nine**. One character may be the key figure of more than one house
at once, and what that means in the fiction is still open.

**Their power is their stats.** They "can become more powerful and lose power depending on what happens",
and what rises and falls is their four stats. Nothing else sits on the tie.

**When a key figure dies they leave**, and the loss is written into every house that held them. **A house
whose last key figure dies stays empty, for now.** `SETTING.md` says that if every key figure dies, someone
rises to the task: that is not built, and this is where it is recorded as deferred rather than forgotten.

For now a house gets key figures only from the debug panel, and starts with none.

### What it is for

**A house with faces.** A house is a bloodline acting through a handful of people (`SETTING.md`), and until
now the handful had no names. Key figures are those people, and the pane is where a player sees who they are,
how old they are and what they are good at - which is what turns a banner into a family.

**Power that moves.** A key figure's standing is their stats, so a mechanic that changes how pious or how
strong someone is changes what the house can do through them. Nothing does yet.

### Look and feel

**A pane of its own, in the corner with the house status**: its middle tab in the spread, between the shield
and the compass, and a row of *Go to* on a phone. Its mark is a head and shoulders in profile, a placeholder.
On a desktop it opens at the normal size, so changing tabs moves nothing.

**Two states.**

- **The grid**: small portraits, three by three, at most nine, in the order they joined, and it never
  scrolls. With none it says that key figures will be shown here. With exactly one there is no grid: the
  pane opens straight on them.
- **The details**: one key figure's portrait and name, and where there is room their stats, one to a line,
  each a mark, a word and a number: Age, Piety (the house card's cross), Reason (its dividers), Kindness,
  Physical. The way back to the grid is a mark of **nine small squares**.

**What each size shows**, the pane owning all three:

- **Phone, medium**: the portrait and the name, with the stats below a scroll.
- **Phone, big**: the same with room; turned, the stats beside the portrait.
- **Desktop, medium**: the portrait and the name.
- **Desktop, big**: the corner opens out **wider than the column**, along the bottom of the screen, with the
  portrait beside the name and the stats. The windows above keep the column's width, and a letter along the
  bottom moves over and never shrinks below the width it can be read at.
- **Minimised**: the strip, with the pane's name.

### Not decided

- **How a key figure is gained in play**: a choice, a storyline, or founding a house.
- **Succession**: someone rising when the last of them dies.
- **Being let go** rather than dying.
- **What another house sees** of your key figures, stats included.
- **What it means for one person to serve two houses**, and a way to see it happen on the screen.
- **Whether the eye keeps key figures in sight** far out, as it keeps the house's holdings.
- **Loyalty**, and what a key figure will do for the house. Character dialogue already wants it: a character
  loyal to the house can offer a reward the same character would not offer a stranger.
- **How the house's power state follows its key figures**, and the sacrificial knife of `SETTING.md`, which
  sacrifices one at great cost.

### Where it stands

The tie exists on the server and on the wire, and the debug panel's Characters section takes key
figures in and changes them; no pane shows them to a player yet. A house gains and loses key figures in
its own history, holds nine at most and never the same character twice, and says
whether a character is one of its own without writing anything, which is how every lever naming a
character is let through or refused. When a character dies the mourning writes the loss into every house
that held them. A player is sent their living key figures, in the order they joined, on arriving and
whenever one of them changes, and the commands that take one in, change a stat, age one, give another
portrait and kill one are on the wire from version 6. Decision record 0055 is the shape.
`docs/plans/characters-and-key-figures.md` has the rest in order, one commit a step, and the corner that
opens out wider than the column will get decision record 0056 when it is built.
