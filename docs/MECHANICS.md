# Mechanics

> **What belongs here:** what the mechanics of the game are — what the player is offered, what they can do
> about it, and what it is for. One entry per mechanic. **What does not:** how a mechanic is turned into
> commands and events (`BUILDING-A-MECHANIC.md`), the shared visual language its look and feel draws on
> (`LOOK-AND-FEEL.md`), how the stage and its bays work whatever is put in them (`RESPONSIVE-DESIGN.md`),
> what the world is (`SETTING.md`), when any of it gets built (`ROADMAP.md`).

**Every mechanic has a name**, and that name is the word used everywhere afterwards: in conversation, in the
glossary, in the code and in the interface. An entry has five parts — what it is, what it is for, its look
and feel, what is not decided about it, and where it stands in the source today — and a sixth, **UI**, for a
mechanic that is a pane: which bay it takes, what it draws at each of its sizes in each form, and how it
arrives. The rules every bay keeps are `RESPONSIVE-DESIGN.md`'s; what a pane does inside them is here.

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

### UI

A **pane** that exists only while a question is pending, and goes when it is answered. It has three sizes,
and the mechanic owns all three:

- **Full** — the prompt and every option laid out to read through. What a question arrives at, because
  reading it is the thing to do first. Three across a tile wide enough, three one under another in a bay
  tall enough, and the carousel in one that is neither.
- **Small** — the **carousel**: one option at a time, with the way between them. For deciding rather than
  reading, because the places being offered are drawn on the map and the option you are on stays on the
  screen beside the one it means.
- **Minimised** — set aside to a strip. Not closed: the question is still standing.

**In the spread** it takes **bottom middle**, one height at both of its drawings so the bottom of the stage
does not jump as it folds to the carousel; the 281 that bay is never narrower than is what the carousel
reads at. **On a phone** it takes the map's bay, opening it to half if it was a strip, and the pane beside
it keeps the other; answering puts the map back. **Its size is the player's**: the two forms are two ways
of using it and only they know which they are doing. See decision record 0044.

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
through: *next* for the next line, and where the conversation branches, a **dialogue choice** in its place,
whose options are what can be said or done next. An option can show what taking it will do before it is
taken, as whoever wrote the dialogue chose: what it gains and costs, that something will come of it but not
what, or nothing until it is done. What has already been said stays above, scrollable, so
that it can be read back.

The same shape covers three cases, and they are one mechanic rather than three:

- A **conversation** between two characters.
- A **monologue**, which is the same thing with one speaker.
- A **group discussion**, where more than one character stands on each side.

Who stands with whom is each speaker's **party**, a number given when the dialogue is written: the people
in one party are on one side of the conversation, and the people in the next are on the other.

**A dialogue is offered to the house** and waits until the player opens it. A house can have several
waiting at once, and keeps every one it has finished, to be read back. A dialogue can be triggered by
anything: a storyline reaching a beat, a place the player has gone, another house acting, a choice roll's
outcome.

**Saying something can pay.** A line can give the house something as it is said - a purse of wealth, say -
and the gain is written into the conversation where it happened.

**A dialogue is meant to be carried through at once.** One left half-way is picked up where it was left, but
the world goes on meanwhile. Every dialogue has **requirements** the player is never shown: that every speaker
who is a character stays alive, and whatever else it was written to depend on - a building still standing,
say. When one fails, the dialogue **lapses**: it ends where it stood, with a line saying why - *sadly, X died
before this could be finished*.

**A dialogue choice is not a choice roll**, though the two are alike. Some dialogue choices are plain choices
of what to say, some will one day have a roll's gamble in them, and what one offers can be shaped by the
rest of the world.

### What it is for

**Making the world personal.** The world is a map of houses and ground until somebody in it speaks. A
dialogue is where a key figure stops being a number on a card and becomes someone with a manner.

**Carrying storylines.** A storyline is told through dialogue rather than announced in a log. This is the
mechanic a quest, a pact or a betrayal is actually delivered in.

It is also the only place the setting's one secret is allowed to come out. `SETTING.md` records what is
actually happening to the world and states plainly that no player begins knowing it: **nothing in the
interface may say so**, and a mechanic that gives it away early spends the only card the setting is
holding. Dialogue, over a long time, is how it is meant to be found.

**Holding other mechanics inside it.** A dialogue is a place other mechanics happen, not only a thing to
read. A line can pay the house as it is said, an option can cost it something, and a dialogue choice can
carry the gamble of a roll, its options coming back into the conversation.

**Paying off what the house has built.** What a character says and what they will do for you depends on
what they are to your house. A character loyal to the house can offer a reward inside the conversation
that the same character would not offer a stranger. The house-spirit and whatever relationships the world
grows are inputs to a dialogue, the way the house's state is an input to a roll.

### Look and feel

A column of the interface is given over to dialogue, taking screen space rather than floating in a corner.
At its top is a **scene**: thematic imagery of where the conversation is happening, with the speakers
standing in it and facing each other from the two sides, stacked evenly on both sides in a group
discussion. The graphics so far are dry, and this is the place for the game to be rich. Under the scene is
the **feed**: the bubbles, each with its speaker's portrait and name beside it, coming from the left or from
the right by their party. What the house gains is a line in the same feed, the resource's own mark and the
amount - the coin, +100 - and a lapsed dialogue ends there on its closing line.

**Feel is the point of this one.** Characters should move — entering, leaving, reacting — and fade in
rather than appear. A dialogue that pops between static portraits would deliver the same words and none of
the aliveness it exists for.

### UI

A **pane**, there from the first dialogue a house is offered and never closed after that, in two states:

- **The list**: the dialogues waiting, and under them the ones finished, a lapsed one with why. It scrolls.
  Newest first in both, each with its title and who speaks in it, every name standing alone as it would on
  a bubble, and one waiting is marked *new* until a step has been taken in it and *begun* after.
- **A conversation**: pressing a dialogue opens it, from its start or from where it was left. The scene at
  the top, the feed under it, scrolling, and at its foot *next* or the dialogue choice's options. A finished
  one opens to be read back.

**In the spread** it takes a column down the right edge of the stage, set into it as the column on the left
is set into the left edge, and top to bottom, because a conversation is long:

- **Normal**: 480 wide, wider than the column on the left, so there is room for a picture in the scene. On a
  narrow stage it is squeezed to a third, as the column on the left is.
- **Opened out**: the right half of the stage.
- **Put away**: a strip at the top right, with its name.

It opens at the normal size. Where the column would meet the letter along the bottom on a narrow desktop,
the letter keeps its room and the column stops above it. The column is decision record 0069's.

**On a phone** it is a pane like any other, with no special treatment: it takes a bay, and the player opens
it out when they want the whole screen for it.

**It arrives the usual way.** A dialogue offered opens the pane: in the spread it appears on the right, or
opens from its strip, and on a phone it takes the bay that is not the map's, at half, as an inspect window
does. A pane already open stays as the player left it. What arrives is a dialogue waiting that the page has
not been shown before, so the ones waiting when a page loads open it, as a letter does, and the same one
never opens it twice: a step taken, a reconnect or the list sent again is not a dialogue offered.

### Not decided

- **Who the characters are.** Any character can speak, whoever they are to the house, and so can somebody
  who is not a character at all, a messenger say. NPCs from the warped history, and whether another player's
  house ever appears as a speaker, are open.
- **What triggers one**, beyond "anything". The triggers are a list nobody has written, and so is where the
  dialogues themselves are written: the first is a sample in the server, offered from the debug panel.
- **Where the art comes from.** The scenes are to be a folder of Adam's own pictures, as the portraits are,
  with placeholders until there are pictures; the characters' expressions are open.
- **How the world shapes a dialogue choice** at the moment it is reached, rather than when the dialogue is
  written, and which dialogue choices carry a roll's gamble.
- **Which other kinds of requirement there are**, and when they come. A building still standing and a day
  not yet come are the examples. Each is one more kind rather than new machinery, though a day also needs
  something to wake for it, because nothing writes that a day has come.
- **A conversation that comes back to a question** it has already asked, which the first ones cannot do.
- **Whether *next* is a mark or a word.**

### Where it stands

The offer is in the source. A dialogue checks itself when it is made, so
one that could loop, or that leads to a line it does not have, is refused before anything is written, and
`OfferDialogue` writes it whole on the house's stream, where the house keeps every one it has open. An
option of a choice can grant a resource too, on the wire from version 13. `CompleteDialogueStep` takes a step
where the walk says one is open, and writes what the line gives, and the end when it ends it, from the same
decision, so a reward is paid once on every path; a conversation of forty lines writes a handful of events.
The debug panel's Dialogues section offers a sample, a letter from the coast spoken by the house's first key
figure and a messenger, from wire version 14, and the event page shows what was offered whole. A read model
keeps every dialogue a house was offered and how far each has got, and the player is sent each one as far as
it has reached, from wire version 15: the lines past the next step, what a line will give and the
requirements stay on the server. An option can spend, from version 16, and is refused while the house cannot
pay, and from version 17 each option carries its reveal impact. A speaker's death ends every open dialogue they
speak in, as lost, naming who died. Nothing in the world offers one yet. The pane stands in the column
down the right from the house's first dialogue, at its three sizes, and on a phone navigation lists it;
it lists the dialogues waiting and finished, a lapsed one saying why, and a dialogue offered opens it;
pressing one in the list opens nothing yet. The debug
panel's Dialogues section lists every dialogue as the player may know it and can show its requirements,
and no command on the wire takes a step. Its shape is decided in decision record 0067: a dialogue offered
whole on the house's stream; only its dialogue choices, and the lines that give something or end it,
recorded; what a line gives written as the world's own event beside the step; and hidden requirements that
end a dialogue when one fails, with the server holding back what the player has not reached. `docs/plans/character-dialogue.md` is the order it is built in, one commit a step, and experiment
0014 is what it is meant to show. `ARCHITECTURE.md` says what it asks of the server and the client.

---

## Inspect window

The way the game answers "what is that". Not the map's own: the map is only the first place a player
points at something.

### What it is

A window that says what one thing in the world is. That thing is its **subject** — today a house, an
area or a character, later a holding, a work, a place named in a conversation. The window says what the
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

**Its first row is its mark, its name, its size control and, on a desktop, its close.** What kind of thing it is, is the
mark that kind is known by everywhere else rather than a word above the name: a **shield** for a house and
a **bust** for a person, the corner's own tabs, and for an area a **fence** stepping along square corners,
because an area is fenced between painted pixels. The words - *Your house*, *Key figure*, *Area* - are the
mark's label, for a player who hovers it or a screen reader.

A link is **one button**, and *show it on the map* is the map's own mark rather than words. It carried a
pair of needles saying which bay to open into until 0049, which is one decision per link too many.

### UI

A **pane** per subject, opened on a click and closed by the player.

**Put away, a window is its first row**: its mark, which one it is, its size control and its close. The
strip says *Kettleby* rather than *House*, because a rail of three strips that all said *House* would say
nothing, and on a desktop it keeps its close so a window can be shut without being opened first. A subject
that has left what this page can see keeps the name the **trail** last saw it under, and only one nothing
has ever named falls back to the word for its kind.

**In the spread** the windows take **left** and stack on its rail, newest at the top, up to three; a fourth
pushes the oldest off rather than being refused. **When they no longer all fit, one stays open** and the
others are put away, and opening another - from its strip, or by asking for it again from the map - brings
it to the top and puts the rest away, so a rail out of room has one window open and the map rings that
one. Nothing reopens by itself when the room comes back. A window left alone on a rail too short for it
scrolls rather than losing its links off the bottom. See decision record 0058. **On a phone** a window takes the bay that is not the
map's, because the thing clicked is on the map, and opens it to half if it was a strip; closing it puts
back what was there and leaves the arrangement alone. A link opens in the bay this window is not in, so the
window it came from stays on the screen; in the spread there is one place a window goes, and a link is a
plain click. **On a phone a window has no close**, open or put away: it is replaced by navigating to
something else, which is how any pane there leaves its bay.

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

The shape of it is built and what it can say is thin. A **subject** covers a house, an area and a
character, one store for all three, which is what the two selections that used to run side by side became.
A window on a character is the first with a face: their portrait in its frame beside their name, their age,
whom they serve and where they stand, with a link to each house that holds them - and not their stats,
which are their house's own. A window renders a
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
is the more urgent of the two.

### UI

A **pane**, never opened and never closed. Three sizes, and the mechanic owns all three:

- **Full** — everything above, with the bar beneath it on the bottom edge.
- **Small** — the shield, the name and the row of marks, with the bar under them. What it is when it is
  sharing a phone with something else. The row wraps to two lines in a bay too narrow for five marks, and
  the pane's height allows for that rather than clipping it.
- **Minimised** — a strip with the name on it and nothing more, so the player knows where it went.

**In the spread** it is the first tab of **bottom left**, sharing an edge with the rail above it (decision
record 0041). That bay is one size whichever tab is up and its normal size is the whole card, so on a
desktop the card is drawn full at both of its open sizes: opened out it is the same card with room to
spare, the shield and the name in the middle and the bar still on the bottom edge. The small form is a
phone's. The blazon line is the first thing to go when the column is squeezed. See decision record 0057.

**On a phone** it opens as a strip beneath the map opened out: the game is read off the map, and the card
is 200 pixels of a phone's 844 that nobody has asked for yet. Pressing the strip is the first gesture there
is, and it teaches the whole control; the middle mark gives half the stage, enough for the shield, the
blazon, the treasury and the bar of levers with the map still up above it.

It is **responsive from the start**, and it is the mechanic that proves the rule: the card has never fitted
a phone. It asked for `min-width: 26rem`, 416 pixels against a phone's 390, and that was the first thing
the phone toggle found; it fills whatever it is given now. **The bar of levers has six places**, and a
landscape bay half a phone wide is 422 pixels: 70 a place, which is fine, and put away the bar is not drawn
at all. The first thing to look at when the bar starts filling. See `RESPONSIVE-DESIGN.md`.

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
nothing about them changes. An age is worked out in the browser from the birthday and never stored. They
can be moved onto the map and taken off it again, at a significance of ten, which is drawn from zoom 9,
and the server keeps where they stood as spans of world-time by cell; a death leaves them where they
stood and off the map from that day. The refusals are named for their rules, and the stored form is
pinned by a fixture. From wire version 7 a cell's snapshot carries the characters standing in it, beside
its houses, and a move reaches whoever holds the cells either side of it as the one delta that fits:
arrived, changed or gone, because a thing that moves would otherwise stay drawn where it was. The page
draws them: a small standing figure close in and a head and shoulders far out, in their house's colours,
from the zoom 9 cells in, which is a camera at about 8.5. The debug panel puts one where the camera is
looking and takes them off the map again. Clicking one opens an inspect window on them, and so can a row
of the trail; from wire version 8 the map carries the birthday their age is counted from. Decision record 0055 says what a character is to the program, and
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

Its mark is a head and shoulders in profile, a placeholder.

**Two states.**

- **The grid**: small portraits, three by three, at most nine, in the order they joined, and it never
  scrolls. With none it says that key figures will be shown here. With exactly one there is no grid: the
  pane opens straight on them.
- **The details**: one key figure's portrait and name, and where there is room their stats, one to a line,
  each a mark, a word and a number: Age, Piety (the house card's cross), Reason (its dividers), Kindness,
  Physical. The way back to the grid is a mark of **nine small squares**, twice the size of the marks
  beside it. While they stand on the map, **the map's mark** is beside their name and shows the camera
  where, as it does in an inspect window; on no map, there is none.

### UI

**A pane of its own**: the middle tab of **bottom left** in the spread, between the shield and the compass,
and a row of *Go to* on a phone. That bay is one size whichever tab is up, so changing tabs moves nothing.
See decision record 0057.

**What each size shows**, the pane owning all three:

- **Phone, medium**: the portrait and the name, with the stats below a scroll, on purpose and one gesture
  off: there for a player who wants them and out of the way of one who does not, where squeezing all three
  into half a phone would make all three too small to read.
- **Phone, big**: the portrait, the name and the stats one under another; turned, the stats beside the
  portrait.
- **Desktop, medium**: the portrait and the name.
- **Desktop, big**: bottom left opened out, **wider than the column** along the bottom of the screen, with
  the portrait beside the name and the stats.
- **Minimised**: the strip, with the open figure's name or the pane's.

The grid is three by three at every size and never scrolls; on a phone it is as big as the bay allows,
with the given names under it where there is a line to spare.

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
figures in and changes them. The pane is in the corner, the middle tab, and in *Go to* on a phone, at its
three sizes: with nobody in it, it says key figures will be shown here; with one it opens on them; with
more it is a grid of their portraits in the order they joined, three by three, and one pressed opens on
them with nine small squares to go back by. Their details are the portrait and the name, with the map's
mark beside it while they stand on the map, and the age and four stats as a mark, a word and a number
wherever there is room: opened out in the spread, below a scroll at half a phone, and in view opened out
on one. A house gains and loses key figures in
its own history, holds nine at most and never the same character twice, and says
whether a character is one of its own without writing anything, which is how every lever naming a
character is let through or refused. When a character dies, every house that held them loses them. A player
is sent their living key figures, in the order they joined, on arriving and
whenever one of them changes, and the commands that take one in, change a stat, age one, give another
portrait and kill one are on the wire from version 6. Decision record 0055 is the shape.
`docs/plans/characters-and-key-figures.md` has the rest in order, one commit a step. Opened out, the
corner already reaches along the bottom to 560, wider than the column, which is decision record 0056.

---

## Fog of war

What a house knows about the world, by where it can see. In Adam's words, it "limits what info you get from
that area of the map, it does not limit anything else".

### What it is

A house sees the map at three levels:

- **Vision**: where the house can see right now. Everything there is shown.
- **Revealed**: where it has seen before. It still sees certain things there: what stands still - the
  ground, its trees and the buildings on it - and not what moves, which is people. Houses are not special
  in this: a house is the first building rather than the definition of one.
- **Unknown**: where it has never seen. Only the terrain, and really big events.

**What gives vision is a vision point**: a place, the size of the circle seen around it, and when it starts
and stops giving vision. Anything can give vision. Today a house's **seat** does, from the day it is founded,
and each of its **key figures** standing on the map does, for as long as they stand in one place; both see a
circle about the size of Mallorca. A point that has ended leaves what it covered revealed. An event could give
vision of another continent for a couple of in-game months, which is a vision point with a start and an end.

Nothing is stopped by the fog. A player can put a key figure or found a house in unknown ground; what the fog
decides is only what they are told about it.

### What it is for

**Knowing is earned.** A house knows its own ground and what its people have seen, and the rest of the world
is terrain and rumour. Sending someone somewhere is how a house comes to know a place, which gives a key figure
standing on the map a reason to be there.

**It holds in a shared world.** What a house cannot see is kept back by the server rather than hidden by the
browser, so the fog is not a curtain a player could simply stop drawing. Ideally that includes the trees: the
scenery of unknown ground is not sent until the house has revealed it.

### Look and feel

- **Vision** is completely unobscured.
- **Revealed** is a faded, colourless filter. If taking the colour out is hard with the stack, a faded colour
  laid over it will do.
- **Unknown** is a dark haze, slowly undulating when zoomed in. It is not completely opaque, and the contours
  of the map always show through it. The undulating can come last, and only if it can be made cheap.

**The edge of sight has surface tension.** Adam's words and his picture: circles close together bleed into
each other and the ground between them is seen too, but only over short distances. So vision and revealed
ground are each their circles and every gap or notch between them that a ball of 40 km cannot get into: a
notch where two overlap is rounded off, a gap up to about 56 km between two seat-sized circles is bridged,
and a lone circle stays exactly its circle. What the tension joins is seen in the full sense - a house in a
bridge is sent - and a spot seen again and again does not swell. Decision record 0064.

**The fog covers the world, not the signs for the things in it.** In Adam's words, it "should only cover 'the
world' not representations of important things when zoomed out", and a thing in sight is never under it. So
every icon, the seats a choice offers and anything standing in vision are drawn over the fog, and what stands
outside vision close in - a castle, a person, the trees - is under it. How a thing's significance should enter
that, so that something seen from far out is never covered, waits on significance being worked out.

The switch for it is Adam's, in the debug panel's Debug map section: *fog of war: on* or *off*, in words. Off
lifts the whole of it for that window, drawn and held back alike, and every page load starts with it on.

### Not decided

- **What else gives vision**, and how big each circle is. Everything is a Mallorca today, and a watchtower, an
  ally or a storyline are all candidates.
- **What a really big event is.** The number is significance 80 and up, drawn from zoom 2, and nothing in the
  world reaches it yet.
- **Whether revealed ground shows buildings as they were last seen** rather than as they are now. As they are
  now, for now; remembering what each player saw is a read model of its own.
- **What a player sees before founding.** With no house there is nothing to see from, so the whole world is
  unknown, the seats a founding choice offers included.
- **Whether a house ever shares its vision** with another.

### Where it stands

Steps 1 to 7 of `docs/plans/fog-of-war.md` are built. The server works out every house's vision points from
its seat and its key figures on the map, and sends them to the player as `yourSight` from wire version 9, on
arriving and whenever one opens or closes; the debug log says in one line what gives vision and how many
places the house has seen from.

**Vision can be given outright**, from wire version 10: `give vision here`, under the fog switch, gives the
house a circle where the camera is looking, as big as a seat's, and each one given is listed there with
`take it away` beside it. Both are real commands and both are recorded, as `house.gainedVision` and
`house.lostVision`; the size is on the event, so a later change to how far a house sees leaves what was given
alone. What a vision saw stays revealed once it is taken away. A vision that ends by itself after a span is
not built.

**The fog is drawn**, over the ground and everything standing on it: a dark haze over unknown ground that the
coast and the lie of the land show through, thickening and thinning a little in patches close in; revealed
ground with its colour taken out and faded a little, the terrain and the trees and castles on it alike, while
the houses' own signs keep their colours; and nothing at all over vision, whose edge is soft close in and
wanders a little. With no house the
whole world is under the haze. The switch is in the Debug map section. The haze lies in bands of mist
stretched along the screen, like mist over a field, flat far out; close in they swell, thin and drift while
its edge stays still, and only while some of it is on the screen. Every
icon and anything in vision is drawn over the fog. Decision record 0061 is the shape, 0062 how the fog is
drawn, 0063 which side of it each thing is on, and 0065 how revealed ground loses its colour.

**The server holds back what the fog hides**, from wire version 11. A player is sent the houses on ground
their house has revealed and the people in its vision, their own house and key figures wherever they are,
and anything of significance 80 from anywhere, which nothing reaches yet. Nothing else in a cell reaches
them, in its snapshot or its changes, and what is held back is not counted either. When the house's sight
changes, every cell the player holds is answered again: a house on ground newly revealed appears, and
somebody no longer in vision goes. Turning the fog off lifts this as well as the drawing.

**The edge has surface tension**, from wire version 12, which carries it: the ground a ball of 40 km cannot
get into between the circles is covered too, drawn and held back alike. It is one number,
`Vision.SURFACE_TENSION`, and the page follows it because the server sends it.

**No tree grows on unknown ground.** The scenery stands only where the house has revealed, so the trees stop
where the haze begins; the painted ground under the haze still shows where the woods are. With no house,
nothing grows anywhere, because nothing has been seen. The stands the trees are grown from are still a public
file, which step 8 of the plan takes back to the server.
