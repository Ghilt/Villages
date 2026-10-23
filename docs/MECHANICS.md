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

One of the primary mechanics of the game, and the core loop: what a player does when they want to do
something.

### What it is

The player takes action: they lift the **die** from its little podium and drop it or throw it on the map, and
pay for it once it comes to rest. The game shows them every **omen** it took into account - how the house
stands, what they have open, the ground round where the die landed, the season, what changed since the last
roll - and rolls a **rarity**, then deals a hand of three **actions** of that rarity. The player takes one.
The rolling is done by the **fate engine**; see `ARCHITECTURE.md`. How it was built, step by step, is
`docs/plans/choice-roll.md`, and how the die came to aim it is `docs/plans/choice-roll-podium.md` and decision
record 0118.

### What it is for

**Agency.** The player provokes a choice roll themselves, at the moments that seem interesting to them, and
by choosing where and when they influence what the roll can offer. It is the main way a player reaches
into the world on purpose rather than waiting to be asked. **They aim it with the die, and by what they look
at**: the ground round where the die lands, the inspect windows they have open, the dialogue they are in and
the key figure they have focused are all omens, and so is how the house stands. Each option carries the marks
of the omens that brought it, so a player learns that a die dropped on a river while pious brings
river-and-faith things, and aiming becomes a skill rather than superstition. Adam's word of 2026-10-22: the
die "will give the player more control and will feel more intuitive than jsut looking around".

**The rush of a good roll.** Rolling legendary actions should feel like a gamble paying off. For that to
work the odds have to be real, so:

- **The odds are fixed and the same for everyone**: 70 common, 22 uncommon, 7 rare, 1 legendary in a
  hundred. **Omens never move them.** What the player looks at decides what a hand is *about*; luck alone
  decides how *good* it is.
- **A hand is one rarity**, so the reveal is one moment, and a legendary never sits beside two commons.
- There must be **plenty of actions**, enough that repeats do not become noticeable.
- Rarity runs common, uncommon, rare, legendary, with the standard colours in `LOOK-AND-FEEL.md`.

**A decision that costs.** A roll costs **10 wealth** for now, and a house is founded with 50 so it can roll
at all. The hand **must be answered**: it can be set aside and come back to, and Take action stays greyed out
until it is, but it cannot be walked away from or rerolled. The price always buys something, and every roll
is a real decision.

**A way to do things at all.** A choice roll is how a player acquires resources, starts storylines and
dialogues, and one day interacts with other players. It is not a side activity.

**A component the world can use.** A choice roll can also one day happen *without* the player provoking one,
so that events and storylines can raise one as part of their flow.

**It is clear when you provoke one.** One thing does it: the die on its podium, over the words **Take action**,
Adam's call, picked up by a long press so that a tap meant for something else never lifts it. It gives **no
hint beforehand** of what the roll will read: the ring round the die's shadow shows only the ground that will
count, the omens are revealed only after paying, and finding out what counts is part of the exploration. A die
put back on its podium costs nothing.

**A choice can expire.** This is a multiplayer world that keeps moving. A player who rolls a choice and
leaves it for a real-life week comes back to a world that has gone on without them, and a choice that no
longer means anything stops being pending rather than waiting for ever.

### Omens, pools and actions

An **omen** is one thing the engine took into account: *Holdings in Sweden*, *Weak house*, *Pious*, *Piety
risen*, *Sir Jeoffrey*, *Inspecting the Vistula*, *Unresolved dialogue*, *Missing wealth*, *The Vistula*, *Near Dantzic*, *House Varga*,
*Unknown* where the fog covers everything, *Winter*. A **pool** is a named grouping of actions that omens open; an action can be in
many, and one the omens point at from two directions is likelier. **The player sees omens and never pools.**
An **action** is one thing a roll can offer, and it is dealt at the moment of the roll, so its details can come
from the world: gossip about the nearest house names that house.

The map's omens are worked out by the server from where the die landed, never taken from the page: the ground in
the **landing circle**, 25 km round the **landing** at every zoom, of which only ground the house has revealed
counts, and the ground under the die always. The die moves the circle and narrows it, and does nothing else: it
has no omen of its own and never moves the odds. A die in the fog is a valid roll, *Unknown*: a player who wants
to explore India goes there and rolls there. See decision records 0084 and 0118. Where the master's real names
are carried, the ground says whether and the names say what: the river is *The Vistula* and the open sea *The
German Ocean*, opening what any river or open sea opens, and a town of 1790 in the circle is an omen of its own,
*Near Dantzic*, which a questline can open on by the town's real identity. See decision record 0087.

### Look and feel

**The die is a fun flourish**, Adam's word, and plays like a real one thrown from near the eye. Held, it is the
size of a hand, hanging under the pointer or the finger with its shadow on the ground. Thrown, it flies one long
arc, a flick near the ground scaled up, growing a little as it rises and shrinking as it falls, and strikes the
ground still going, bouncing and rolling to rest; close in it lies there the size of a tree, and far out, where
the map draws only marks, it shrinks to almost nothing in the air and lands as a pin. The ring round it is a light
that breathes, like the selection ring under a castle. **The number it shows is the game's**: the page works out
the throw the moment it is let go and paints the number on the face that will come up, while the player alone
decides where it lands.

The roll then plays like **a report card at the end of a level**, Balatro's scoring the reference: the omens slam
into a list one after another, each a mark, words and sometimes a value, and then the options pop in under it.
A click hurries the list. **The rarity is said by the options alone**, by the tag on each and its colour's glow,
Adam's word of 2026-10-05: nothing stamps it across the list. The list stays where it can be read, and each
option carries the marks of the omens that brought it, so the two can be matched.

The options are shown as **parchments**, edged in their rarity's colour, on a **wooden desktop with an
inkwell**. Hovering a parchment lifts it slightly, so it reads as something you can pick up. The shared
language this draws on - the diegetic rule, the rarity colours - is in `LOOK-AND-FEEL.md`.

### UI

A **pane** that is **always there** in the spread's bottom middle. Idle it is the die on its podium, over
Take action and what a roll costs; once the die rests, it opens out and plays the roll, the die lying where it
fell; answered, the die goes back to its podium. On a desktop it has two sizes and on a
phone three, and the mechanic owns them all:

- **Full** - on a desktop it **lies over everything else**, 736 wide and up to 768 tall, centred on the stage, with
  the **veil** dimming the whole stage under it; pressing the veil puts it away. The report card on top, a
  divider, and the options in a row along the bottom. What every question opens at, the founding letter
  included, because reading it is the thing to do first. **At rest**, with nothing asked, opened out it is
  only as tall as Take action and what a roll costs, 256, rather than a box over most of the screen. **The options never scroll on a desktop**: they are
  written to fit.
- **Small** - a phone's only: the **carousel** for the founding letter, at half a phone.
- **Minimised** - set aside. Not closed: the question is still standing. **On a desktop it is a chip** in the
  middle of the bottom row: Take action and what a roll costs, or the hand that is waiting, and no size control,
  because a press anywhere on it but on Take action opens it out. It gives way to the corner and the dialogues,
  which lay themselves out as though it were not there and always leave it room. On a phone it is a strip
  below the map with no control, and a press anywhere on it but its buttons gives half each, as on any
  pane put away there.

**On a phone** a rolled hand is always the list and then the options under it, one under another, and the pane
scrolls when they do not fit. The founding letter keeps its own two drawings - three parchments across, and the
**carousel** - and arrives at half.

**On a desktop it glides** between its chip and its box over everything, the veil fading with it, and what it
says fades in once it has landed, the cards' details a beat after their titles. See decision record 0086.

**In the spread** it takes **bottom middle**, and it moves nothing whether it is put away or opened out. **On a
phone** a question takes the bay below the map, as every pane but a window does, opening it to half if it
was a strip, and the map stays on top; a hand rolled from Take action lands where the letter already stands,
and answering leaves it there, back to Take action. See decision records 0044, 0085 and 0109.

### Not decided

- **How expiry is decided**: what makes a choice irrelevant, and whether the player is told it lapsed.
- **Whether a price ever changes** - with the house's standing, the rarity, or the omens - or is paid in
  anything but wealth. Ten wealth is a temporary number.
- **Whether an action can be dealt only when its omens are present**, rather than every action being in the
  always-open pool and the omens only tilting the draw. The first content is the second kind.
- **Hints on Take action.** Settled as none for now; the old idea of a flourish when something new is among
  the omens is kept here rather than forgotten.
- **What the number on the die means.** The rarity is said by the options alone, so the first die shows a
  number the page chooses.
- **Whether the die strikes what is drawn on the map**, the trees and the buildings. Tried at the spike on a
  switch; Adam decides by feel.
- **Whether the landing circle grows** with the house's progression. One width for now, to experiment with.

### Where it stands

Built, from `docs/plans/choice-roll.md`, all seventeen steps. **Take action works**: it stands in the bottom middle once
there is a house, costs ten wealth, and deals a hand of three of one rarity from twenty resource actions in six
pools and one conversation, each option a card edged in its rarity; taking one gives what it says. The
conversation is **gossip**, a common: a servant brings word of the nearest other house within 1500 km, by name,
and the house spreads it for a little influence or keeps it to itself, in the dialogues pane. It reads the house - its
holdings, whether it is a weak house or pious, what rose since its last roll, a debt a dialogue is waiting on -
the inspect windows open, the dialogue being read, the key figure open, where the player is looking - the
coast, a river close in, the kinds of ground, the open sea, the river and the sea by their real names, houses
and towns of 1790 by name zoomed in, or *Unknown* under the fog - and the season. A hand the page rolled plays as the report card: the omens land and the
options pop in under them, the pane opened out over everything; a press hurries the omens, and a
hand already pending at a reload is drawn as it ends. What exists is in `BUILDING-A-MECHANIC.md` under the choice pattern, and in
decision records 0034 and 0083.

It is a pane with its three sizes as of 0044, which is also where the last media query in the app died: this
mechanic's one breakpoint asked the window rather than the stage and had never fired. On a desktop it has had two
since 0085.

**The die is being built** from `docs/plans/choice-roll-podium.md`. It has been felt at the spike,
`/admin/inspect-die`: picked up from its podium, dropped and thrown on the real map, its numbers on sliders. In the
game, Take action is the die on its podium: a long press lifts it, let go still it drops by its shadow onto the map
and with a flick it is thrown, and once it rests the roll is read 25 km round where it landed and the die lies there
until the hand is answered, after a reload too. All nine of the plan's steps are built.

---

## Character dialogue

People talking to each other. Nothing here is new to games, and it is not meant to be: what it is for is
making the world feel alive and personal.

### What it is

Two or more characters in conversation, shown as a back and forth of **speech bubbles** the player steps
through: *continue* for the next line, and where the conversation branches, a **dialogue choice** in its
place, whose options are what can be said or done next. An option can show what taking it will do before it
is taken, as whoever wrote the dialogue chose: what it gains and costs, that something will come of it but
not what, or nothing until it is done. What has already been said stays above, scrollable, so that it can
be read back.

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
Behind the whole of a conversation is a **scene**: thematic imagery of where it is happening, filling the
pane, Adam's word of 2026-10-02. The graphics so far are dry, and this is the place for the game to be rich.
Over the scene is the **feed**: the bubbles, each with its speaker's portrait and name beside it, coming
from the left or from the right by their party, so the speakers stand in the scene facing each other from
the two sides. What the house gains is a line in the same feed, the resource's own mark and the amount - the
coin, +100 - and a lapsed dialogue ends there on its closing line.

**Feel is the point of this one.** Characters should move — entering, leaving, reacting — and fade in
rather than appear. A dialogue that pops between static portraits would deliver the same words and none of
the aliveness it exists for.

### UI

A **pane**, there from the first dialogue a house is offered and never closed after that, in two states:

- **The list**: the dialogues waiting, and under them the ones finished, a lapsed one with why. It scrolls.
  Newest first in both, each with its title and who speaks in it, every name standing alone as it would on
  a bubble, and one waiting is marked *new* until a step has been taken in it and *begun* after.
- **A conversation**: pressing a dialogue opens it, from its start or from where it was left. The scene
  behind all of it, the feed over the scene, scrolling, and the stretch ahead shown a line at a time by
  *continue* at its foot. Moving past the last line of a stretch takes the step it ends in. A dialogue choice's options are the
  end of the feed and scroll with it, because a foot of options at half a phone leaves no room for what they
  answer. A finished one opens to be read back. *Continue* is a word, in the middle of the foot and in the
  same place every time, because it is the one thing to press while a conversation is read; it was a chevron
  in the corner first, and was too easily missed. The way back to the list is a mark, drawn as the list it
  goes back to. Both Adam's call. The options are what can be said, so they are words, each with what it
  shows taking it will do.

**In the spread** it takes a column down the right edge of the stage, set into it as the column on the left
is set into the left edge, and top to bottom, because a conversation is long:

- **Normal**: 480 wide, wider than the column on the left, so there is room for a picture in the scene. On a
  narrow stage it is squeezed to a third, as the column on the left is.
- **Opened out**: the right half of the stage.
- **Put away**: a strip at the bottom right, with its name, along the bottom with the corner's and the
  letter's chip.

It opens at the normal size. **It is never opened out with the corner**: opening either steps the other back
to its normal size. It runs top to bottom always, and leaves the letter's chip its room. The column is decision
record 0069's, and what it gives the letter is 0085's.

**On a phone** it is a pane like any other, with no special treatment: it stands below the map, and the
player puts the map away from the marks in the map's corner when they want the whole screen for it.

**It arrives the usual way.** A dialogue offered opens the pane: in the spread it appears on the right, or
opens from its strip, and on a phone it takes the bay below the map, at half, as every pane but a window
does. A pane already open stays as the player left it. What arrives is a dialogue waiting that the page has
not been shown before, so the ones waiting when a page loads open it, as a letter does, and the same one
never opens it twice: a step taken, a reconnect or the list sent again is not a dialogue offered.

**A line can show something.** Shown, a line can take the camera to a place, or open an inspect window on
what it names - the house, a key figure, a place - so a conversation about the quay can show the quay. In
the spread the map moves beside the column and the window opens in the rail, as a click would open it. On a
phone the conversation goes to half below and the top shows what the line names, the map or the window. It is the page's, never the house's history, and the conversation is never what gives way to it.
Adam's idea, from the camera going home by accident when a line paid.

### Not decided

- **Who the characters are.** Any character can speak, whoever they are to the house, and so can somebody
  who is not a character at all, a messenger say. NPCs from the warped history, and whether another player's
  house ever appears as a speaker, are open.
- **What triggers one**, beyond "anything". The triggers are a list nobody has written. Where the dialogues
  are written is decided: `world/catalogues/dialogues/`, a file each, offered from the debug panel by name
  (decision record 0097).
- **The characters' expressions**: whether a speaker's picture changes with what they say. The scenes are
  a folder of Adam's own pictures now, `world/scenes/`, as the portraits are, with placeholders until there
  are pictures.
- **How the world shapes a dialogue choice** at the moment it is reached, rather than when the dialogue is
  written, and which dialogue choices carry a roll's gamble.
- **Which other kinds of requirement there are**, and when they come. A building still standing and a day
  not yet come are the examples. Each is one more kind rather than new machinery, though a day also needs
  something to wake for it, because nothing writes that a day has come.
- **A conversation that comes back to a question** it has already asked, which the first ones cannot do.

### Where it stands

The offer is in the source. A dialogue checks itself when it is made, so
one that could loop, or that leads to a line it does not have, is refused before anything is written, and
`OfferDialogue` writes it whole on the house's stream, where the house keeps every one it has open. An
option of a choice can grant a resource too, on the wire from version 14. `CompleteDialogueStep` takes a step
where the walk says one is open, and writes what the line gives, and the end when it ends it, from the same
decision, so a reward is paid once on every path; a conversation of forty lines writes a handful of events.
The debug panel's Dialogues section offers a dialogue from `world/catalogues/dialogues/` by its name, the first a
letter from the coast spoken by the house's first key figure and a messenger, from wire version 15, and the events log shows what was offered whole. A read model
keeps every dialogue a house was offered and how far each has got, and the player is sent each one as far as
it has reached, from wire version 16: the lines past the next step, what a line will give and the
requirements stay on the server. An option can spend, from version 17, and is refused while the house cannot
pay, and from version 18 each option carries its reveal impact. A speaker's death ends every open dialogue they
speak in, as lost, naming who died. Nothing in the world offers one yet. The pane stands in the column
down the right from the house's first dialogue, at its three sizes, and on a phone it is a mark of the bottom bar;
it lists the dialogues waiting and finished, a lapsed one saying why, and a dialogue offered opens it;
pressing one opens the conversation, which is played through in the pane: the stretch a line at a time,
the options at the end of the feed, and each step sent from there, on the wire from version 19. The
speakers have a portrait and a name on every bubble, the key figures' own frame, and a messenger the
frame's bust. What a line gives or costs is written under it in the feed, the resource's mark and the
amount, as the house card moves with it; a lapsed dialogue ends on its closing line, *Sadly, X died before
this could be finished*, in the interface's words; and an option the house cannot pay for is refused in the
pane, under the options, as well as in the log. A conversation opens over its scene: the picture the
dialogue names, from `world/scenes/`, a cut-paper harbour for now, filling the pane, with the bubbles over
it on paper of their own. A line can show something, on the wire from version 21 and only while it is still
ahead, and the sample's show the seat, the house and the figure: reached while playing, a line takes the
camera to its place or opens its window, beside the conversation on a desktop and on top of a phone,
where the two go to half each; once in the life of the page, and an option only once the house has
taken it. The debug panel's Dialogues section offers a dialogue and does nothing else, and a requirement is
never sent to a page. Its shape is decided in decision record 0071: a dialogue offered whole on the house's
stream; only its dialogue choices, and the lines that give something or end it, recorded; what a line gives
written as the world's own event beside the step; and hidden requirements that end a dialogue when one
fails, with the server holding back what the player has not reached.
`docs/plans/character-dialogue.md` is the order it is built in, one commit a step, and experiment 0014 is
what it is meant to show. `ARCHITECTURE.md` says what it asks of the server and the client.

---

## Quest

A story with a goal, laid out as a road the player can see some of. Adam's own, described on 2026-10-15:
nodes joined by edges, drawn in a pane over a picture, as a dialogue is.

### What it is

A quest is **offered to the house** and starts at once. It is a set of **nodes** joined by **edges**, read
from the top down. It stands at one node at a time, and when that node is done it moves on along an edge to
the next. It ends when its last node is done, or it is lost. A house can have several open at once, and keeps
every one it has finished.

A quest has:

- **a title**, which the list shows;
- **a scene**, the picture behind it, from the same folder as the dialogues' scenes;
- **a start**, the node it begins at;
- **everything shown from the start**, or not: a quest can draw every node from the first moment, so the
  player can plan the whole road.

Every node has:

- **a title**, a line;
- **hidden**, or not: a hidden node is a question mark until the quest reaches it;
- **shown ahead**, or not: a node shown ahead is drawn from the moment the quest is offered, however far down
  it is, with its edges in and out. A hidden node shown ahead is a question mark from the start. This is how
  the final reward can be in view from the beginning, or a node half-way down can show three edges in and one
  out, hinting at a crescendo;
- **its edges out**, the nodes it leads to. More than one is a **fork**: the player will take one road and
  lose the others.

There are four kinds of node.

**A dialogue node** offers the house a **Dialogue** when the quest reaches it, which opens in the dialogue pane.
The node is done when the dialogue is finished, and **where the dialogue ends decides which edge is taken**:
answer one way and the quest goes one way, answer another and it goes the other. Its edges each name which
endings lead along them. If the dialogue lapses - a speaker dies before it is finished - the quest is lost
with it, with the same line saying why.

**An objective node** is a little **checklist** of one to six **objectives**. Every one of them must be ticked,
in any order, and then the node is done. Pressing the node opens it. Each objective is a row: what is asked, a
box, and a button when it is the player who meets it.

**A reward node** is what the house gets: some of one or more resources. It waits with *Collect*; collecting
pays it and the node is done. The last node of a quest is almost always a reward.

**A challenge node** puts a **Challenge** to the house: a debate in the square against a named opponent, say.
- **Pressing it** opens the choosing screen, where the player brings up to three of the house's slices; the
  opponent's slices are not shown.
- ***Accept challenge*** fights it out there and then. The player watches it, and the quest takes the result.
- **Its two edges are won and lost.** Winning is the cheaper road; losing leads to a node where the house pays. A draw
  is lost.
- **Nothing waits:** a challenge exists only once it is accepted, so none can sit waiting to be started after it has
  stopped making sense. Adam's word of 2026-10-23.

**An objective is met by the player or by the world.** Three kinds come first, and more are added beside them
without changing any of these:

| Objective | Met | How |
|---|---|---|
| **Deliver** an amount of a resource | by the player | pressing *Deliver* pays it, and it is gone; refused while the house has not that much free |
| **Pledge** an amount of a resource, for some months | by the player | pressing *Pledge* ties it to the quest's cause, and it comes back whole when the months are up; refused while not that much is free |
| **Hold a structure** of a type, anywhere or on an **island** | by the world | ticked the moment the house holds one; ticked at once if it already does when the node is reached; and once ticked it stays ticked |

*Defeat an enemy*, when there are enemies, is the next one the world will meet.

**What the player sees of a quest:**

- the nodes done, ticked;
- the node it stands at, lit;
- the nodes one edge ahead, as what they are, or as a question mark if hidden;
- the nodes shown ahead, however far down;
- the nodes **lost**: a node the house can no longer reach because the player took another road. It is drawn
  **crossed out**, and shown for what it is, question mark or not, so the player sees what they missed;
- and nothing else. An edge to a node that is not drawn is a short stub, so the player can see there is
  something there.

### What it is for

**Carrying a story somewhere.** A dialogue is a moment; a quest is a road made of moments, with something to do
between them and something at the end. It is what the other mechanics are strung on: a dialogue to open it,
a structure to hold, resources to hand over or pledge, and a reward to close it.

**Choices that cost.** A fork is a road lost for good, and the player sees what was on it. Answer the abbot
badly and the cheap road is crossed out, and the house must build instead.

**Planning.** What is shown ahead is the writer's to choose: a quest can keep everything a question mark, show
only its end, hint at a climax half-way, or lay the whole road out to be planned.

### Look and feel

The quest's **map** stands over its scene, read from the top down: a node is a seal with the mark of its kind,
the question mark for a hidden one, a cross over a lost one, and the one it stands at lit. The edges are lines
between them - walked, ahead, or lost - and a stub where the far end is not drawn. A node shown ahead stands as
far down as it really is, with the unknown above it left blank. A checklist opens from its node as a short list
of rows with boxes. Every picture is a placeholder until Adam's.

### UI

**A pane, the quests' tab of the right column**, beside the dialogues, from the first quest a house is offered.
Two states, as the dialogues have:

- **The list**: the quests open, then those finished and lost, newest first, each with its title and where it
  stands or how it ended.
- **A quest**: its map over its scene, on night of its own so its titles and roads read on any picture, read from
  the top down and scrolling when the road is longer than the column. A node pressed opens its card under the map: an objective node's checklist, with
  *Deliver* and *Pledge* greyed, and how much the house has free under them, while it cannot pay, and a line under
  an objective the world ticks; a reward's gifts and *Collect*; a question mark not yet known, and a node lost
  saying so. **A dialogue node pressed opens its conversation** on the dialogues' tab rather than a card, so no
  button stands between the node and the talk.
- **And back**: a conversation a quest led to, once it is finished, ends in a button where *continue* stood, the
  quest's name and the needle, which turns the column to that quest's map. Not before it is finished, because
  until then *continue* is the way on. Adam's word of 2026-10-15.

**The column down the right takes turns** between the dialogues and the quests, behind a tab bar of two marks, a
speech bubble and a little map of seals, as the corner's tabs are marks; the column is one size whichever is up.
A third tab, the challenges, joins them; see Challenge.
On a phone it is a pane like any other, below the map, and the little map of seals is its mark in the bottom bar.
**A quest offered opens it on the quest's map**: in the spread its tab comes up, from its strip if the column was
put away, and on a phone it takes the bay below the map, as every pane but a window does. The
dialogue a quest leads to arrives through the quest rather than on its own. *Deliver*, *Pledge*, *Collect* and
the quests' tab are all marks, Adam's word of 2026-10-15.

### Not decided

- **Where quests come from**: the world, a roll's option, arrival, a place gone to. Where they are written is
  decided: `world/catalogues/quests/`, a file each, naming its dialogues in `dialogues/` (decision record 0097).
- **More objectives**: defeating an enemy, reaching a place, holding a key figure; a checklist where any one row
  will do; a fork decided by whichever objective is met first.
- **A resource objective that ticks itself** when the house has the amount, rather than being handed over.
- **A dialogue node dealt by a roll** rather than offered when it is reached.
- **Turning a quest down, abandoning one, or one expiring**, and requirements of a quest's own.
- **A cause many houses pledge to.**
- **The feel**: nodes lighting, edges drawing themselves, a reward landing.
- **Every word and number of the sample**, *The abbot of the isle*.

### Where it stands

The quest itself is in the source: it checks itself when it is made, so one that could loop, that leads to a node it does not hold, or that forks where no dialogue's ending could decide it is refused before anything is written; and one walk works out from what a house recorded where it stands, what is done and lost, and what is drawn, as a question mark or as what it is. `OfferQuest` writes it whole on the house's stream, where the house keeps every one it has open, and a quest that starts at a dialogue node offers that dialogue from the same decision. An objective the player meets is ticked and paid from one decision - a delivery spent, a pledge tied under the quest's title - and one the world meets is ticked by a mark that costs nothing; the last tick moves the quest on, offering the next node's dialogue, and a reward collected pays once and finishes the quest. A dialogue node is done when its dialogue ends, in the same decision as the last step: the ending picks the edge, and every node the other roads led to is lost then, one event each. A dialogue that lapses at a quest's node loses the quest, naming the same requirement. Nothing in the world offers one yet: the debug panel's Quests section offers a sample, *the abbot of the isle*, from wire version 50, whose dialogue at the gate arrives in the dialogues pane and is played there. A read model keeps every quest a house was offered and what it recorded of each, and the player is sent each one as its walk draws it, from wire version 51: a question mark as no more than its place, a node shown for what it is with its checklist, its dialogue or its gifts, and an edge to a node not drawn as a stub; the log says where each stands. An objective the world meets is ticked by a listener a moment after: a castle raised for the house on an island, or handed to it, ticks *Hold a castle on an island*, and a house that holds one already has it ticked as the quest reaches the checklist. The challenge node is in the source, from wire version 70: a quest checks it as it is made - a kind, an opponent with a name and a colour, one to three slices, and roads by won and lost alone - and as the shelf is read its kind and its opponent's slices are held to the challenge catalogue; the debug panel offers *the debate in the square*, which stands at one, its card saying the challenge and where each road leads and nothing of the opponent's slices. Accepting one is built on the server, from wire version 71: *acceptChallenge* names one to three of the house's starting slices, the server fights the challenge out on the node's terms from a seed of its own, and the house takes it in one decision - `villages.player.resolvedChallenge.v1`, the whole challenge, then the quest's move along the road its outcome names, a draw lost - refusing slices it does not hold, more than three, one twice, or a node that is not where the quest stands. Every house holds six starting slices, the catalogue's. It is chosen for in the challenges' tab of the column down the right, which stands while a quest waits at a challenge: pressing the node opens its choosing, the opponent's name and the kind in the catalogue's words, the starting slices as chips up to three, and *Accept challenge*, after which the column turns back to the quest on its new road. A read model keeps every challenge a house fought, and the player is sent its history from wire version 72: away from a choosing the tab lists them newest first, each saying who stood against whom, the kind, who won and how it ended, and where its quest went on to. It is watched in the same tab, from wire version 73: accepted, the challenge is played as it lands in its spectacle held deep, each side's slices seen only now, and the result follows it - who won and how, what each side gained and lost, and where the quest goes on to - and any row of the history is watched again. A challenge watched is fought again from its recorded setup and seed, the outcome recorded standing, and says so when the challenges have changed since and it comes out otherwise (`docs/plans/challenges-in-the-game.md`). The quests' tab stands in the column down the right beside the dialogues from the house's first quest, and lists them; a quest offered opens it on the quest's map over its scene, laid out from the top down with the order in each row chosen to keep the roads from crossing, every node and road as its walk draws it. A quest is played in it, from wire version 52: a dialogue node pressed opens its conversation on the dialogues' tab, a checklist's *Deliver* and *Pledge* pay and tick from its card, and *Collect* pays a reward and finishes the quest, the road walked in gilt and the roads lost crossed out as it goes. Its shape is decision record 0096: a quest offered whole on the house's stream,
its moves and its lost nodes recorded, how it is shown worked out and never written, objectives met by the
player in the house's own rules and by the world through one listener. `docs/plans/quests.md` is the order it
is built in, one commit a step, and experiment 0020 is what it is meant to show.

---

## Inspect window

The way the game answers "what is that". Not the map's own: the map is only the first place a player
points at something.

### What it is

A window that says what one thing in the world is. That thing is its **subject** — today a house, an
area, a character, a structure, a settlement or water - a river, a lake, the sea - later a holding, a work, a place named in a
conversation. The window says what the
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
them. On a phone they get one, on top, and the same links, each of which opens in its place, with the trail
to go back by. Comparing two houses should not mean remembering one of them.

### Look and feel

A card, for now, with the subject's name at the top, what is known about it below, and its links at the
bottom. That is a description of what is there rather than a decision: the diegetic rule in
`LOOK-AND-FEEL.md` says what the player is shown should be part of the world, and a card is not, so this
is the shape most likely to change.

**Its first row is its mark, its name, its size control and, on a desktop, its close.** What kind of thing it is, is the
mark that kind is known by everywhere else rather than a word above the name: a **shield** for a house and
a **bust** for a person, the corner's own tabs, and for an area a **fence** stepping along square corners,
because an area is fenced between painted pixels, and for water two waves, a shore or an anchor. The words -
*Your house*, *Key figure*, *Area* - are the mark's label, for a player who hovers it or a screen reader.

**Water a click names sends a ripple of gold out along it.** A faint crackle of gold runs out from where the click
landed along the water it named: a river along the whole of its course as the names have it, every piece under
its name joined and every break in its painting leapt, a lake within its shores, a river or a lake nobody has
named all the water joined to the click, and the sea, which has no shores to stop at, about the click, stepped
along the master's own pixels rather than the diamonds the ground is drawn on. It runs like a current along a
wire - three sharp fronts close behind one another, the first the brightest and the other two fainter echoes of
it, travelling slowly together up and down the river, flickering, the first throwing sparks ahead, fading over
some ten seconds and some three and a half thousand screen pixels along it, never more than six hundred of the
master's pixels, and none at all for a reader who has asked for less motion. Nothing stays marked once it has
run. Only on ground the house has revealed, unless Adam's switch has lifted the fog: the server sends where the
water runs cut to the fog, and the page reads the painted water along it from its own tiles.

A link is **one button**, and *show it on the map* is the map's own mark rather than words. It carried a
pair of needles saying which bay to open into until 0049, which is one decision per link too many.

### UI

A **pane** per subject, opened on a click and closed by the player.

**Put away, a window is its first row**: its mark, which one it is, its size control and its close. The
strip says *Kettleby* rather than *House*, because a rail of three strips that all said *House* would say
nothing, and on a desktop it keeps its close so a window can be shut without being opened first.

**A window does not care where the map is.** One whose subject the camera has left, or the fog has covered, goes
on saying what it last said, its living numbers stood still, because a window is for reading about a thing and
going on from it, wherever the map happens to be: Adam's word of 2026-10-07. One this page has never been able to
say anything of - opened from the trail after a reload, or on a house far away - asks the gateway after its
subject, once, and says what it is answered: the house on ground the player's house has revealed, the person in
its vision, by the fog's own rule. Where the answer is nothing it says *Nothing known of it yet*, under the name
the **trail** last saw it under, or the word for its kind where nothing ever named it. It never sends the player
to pan back to it. A window out of what the camera holds asks the gateway once anyway, so what it says does not
hang on where the camera is. See decision record 0088.

**A window on a thing on the map says how fresh it is**, in a small, quiet tag beside its name: `current`, or the
day the fog hid it, `4 Mar 1793`, with the long form under the pointer. The server dates what it sends and the page
only shows it: a house on revealed ground by the end of the last stretch the house's vision covered its seat, or the
day it was revealed where only the surface tension ever did; somebody who has left its vision is shown where they
stood when last seen, dated by when the fog hid them. The player's own house and people are always current, and an
area has no tag. See decision record 0089.

**In the spread** the windows take **left** and stack on its rail, newest at the top, up to three; a fourth
pushes the oldest off rather than being refused. **When they no longer all fit, one stays open** and the
others are put away, and opening another - from its strip, or by asking for it again from the map - brings
it to the top and puts the rest away, so a rail out of room has one window open and the map rings that
one. Nothing reopens by itself when the room comes back. A window left alone on a rail too short for it
scrolls rather than losing its links off the bottom. See decision record 0058. **The windows glide** on a
desktop: one opened or put away grows or shrinks to its new height, its frame with it, one arriving grows in
from nothing, and the rest slide to where that leaves them; see decision record 0086. **On a phone** a
window takes the top, in the map's place, and opens it to half if it was a strip: the top of a phone is the
map or one window, Adam's word of 2026-10-08. A second window, from a link or the trail, takes the first
one's place, which stays open, in no bay and in the trail; *show it on the map* puts the map back on top.
**Its close is the way back to the map**, open or put away, and leaves the arrangement alone. In the spread
there is one place a window goes, and a link is a plain click. The player's own house arriving opens its
window on a phone too, on top while the camera flies to the seat, Adam's word of 2026-10-09; its close gives
the map back. See decision record 0109.

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
- **What else can be a subject.** Water is the first the server names rather than the browser: a click on a
  river, a lake or the sea asks, and the answer names it from the master's real names on ground the house has
  revealed (0087). A roll reads a window open on it as it reads one on a house, *Inspecting the Vistula*, from
  the place the window was opened at and never the page's word for what is there. A click anywhere on water
  whose window is open raises that window, named or not: water nobody has named is known by the water it is
  joined to on the ground, so one unnamed lake is one window however often it is clicked. Its window says its name and,
  for the great rivers, lakes and seas, a line or two about it as a reader of 1790 might be told it; what water
  is for is still to come.

### Where it stands

The shape of it is built and what it can say is thin. A **subject** covers a house, an area and a
character, one store for all three, which is what the two selections that used to run side by side became.
A window on a character is the first with a face: their portrait in its frame beside their name, their age,
whom they serve and where they stand, with a link to each house that holds them - and not their stats,
which are their house's own. A window renders a
description and knows nothing of what made it. Links go both ways between a house and the ground somebody
has fenced around it, and *show it on the map* moves the camera. Up to three stack in a rail in the spread,
a fourth pushing the oldest off; on a phone one of them stands on top, in the map's place, and its links open in its place.

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
**bar of the house's own levers** along its bottom, its six places empty for now: the eye that was the first
went when the house's own marks came to be drawn at every zoom (decision records 0038 and 0096).

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

**The house's own levers, in one place.** A lever there is not a setting and not a debug switch: it is
something the house does, and it belongs to the house rather than floating over the map. Everything of that kind
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
is 200 pixels of a phone's 844 that nobody has asked for yet. The map's size control, in its corner, is
the first thing there is to press, and it teaches the whole control; its middle mark gives half the stage,
enough for the shield, the blazon, the treasury and the bar of levers with the map still up above it. The
card below carries no control of its own, because the pane on top's names the arrangement (0109).

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
can be moved onto the map and taken off it again, at a significance of ten, drawn from zoom 7.5 like everything on the map,
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

**A pane of its own**: the middle tab of **bottom left** in the spread, between the shield and Recent,
and the second mark of the bottom bar on a phone. That bay is one size whichever tab is up, so changing tabs moves nothing.
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
- **Loyalty**, and what a key figure will do for the house. Character dialogue already wants it: a character
  loyal to the house can offer a reward the same character would not offer a stranger.
- **How the house's power state follows its key figures**, and the sacrificial knife of `SETTING.md`, which
  sacrifices one at great cost.

### Where it stands

The tie exists on the server and on the wire, and the debug panel's Characters section takes key
figures in and changes them. The pane is in the corner, the middle tab, and on the bottom bar on a phone, at its
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

## Structure

Something built that stands on the map: a castle, a mill, a cathedral, a prison, a shipyard. In Adam's
words they "represent a structure of some kind", held by a house now and a faction later, and they "provide
its controller income of various resources". The pane that lists a house's own is **Holdings**.

### What it is

A thing in the world with a history of its own, not a part of a house. It has a **type** - one of eighteen
in the catalogue, from a castle to a printing house - a name, a place, a **level**, higher being better,
and a **holder**: a house, or nobody. A structure seen from its holder is one of that house's
**holdings**, and a house may hold any number.

**It gives its holder standing effects** for as long as it is held: an income in one or more of the five
resources, and **sight** round it, every type a little and a watchtower most. A higher level gives more.

**It has slots**: a place in it that takes something, and its **content**. A prison has cells for
prisoners, a palace a throne for a king, a cathedral a reliquary for a relic, a shipyard a slipway for an
unfinished galley, a fort a garrison. A content is a **character** or an **item**: a relic, a galley, forty
soldiers, three hundred bushels of grain. Slots are permissive about what they take and strict about how
many: a story may set a relic on a throne. What fills a slot changes what the structure gives, in the way
its type says: an empty throne gives no influence, a pious bishop brings more piety than a worldly one,
and a relic brings piety of its own to whoever holds the cathedral keeping it. Some types have nobody in
them at all: a mill pays by its level, and its only slot is its granary.

**The seat is a role one holding plays**: where the room is entered. Founding a house
raises a castle and names it the seat. A house that loses its seat plays on without one until it names
another.

**Destroyed, it leaves a ruin**: no holder, nothing given, its contents still in it, and something that can
be raised again.

A house gets its castle from founding and, for now, everything else from the debug panel. All four ways a
house will come by one are wanted: building it, a story handing it over, taking it, and finding it standing
in the world of 1790.

**The first that stand in the world of 1790 are the settlements**: villages and fishing villages held by nobody,
dotted over the countryside the fall spared, beside the ruins and away from them, and joined by roads. Each is one
structure, a hamlet, a village or a large village by its level, its buildings laid out on worn ground of its own.
How a house comes to hold one, and what it gives, are not designed yet. See decision record 0114 and
`docs/plans/settlements-and-roads.md`.

### What it is for

Two things first, in Adam's words: they "should give vision to controller", and income.

**Income.** The first thing in the game that pays a house, and goes on paying while the player is away: a
number counting up in the house status rather than a reward handed over.

**Seeing further.** Every holding lights its patch of the map, so to hold more is to know more.

**Somewhere for a story to be.** A prisoner to free, a relic to steal, a galley to finish: a structure
gives a roll and a dialogue something to point at and change, and its slots are where a story leaves its
mark. No storyline uses one yet.

### Look and feel

On the map it is a picture drawn front-on from the camera's height, in its own colours and never tinted
(`LOOK-AND-FEEL.md`), in the building tradition of the ground it stands on: **European, Islamic, East Asian or
African**, each master having a culture map of its own and other ground borrowing the nearest. Far out it
becomes a mark of its type. Over it flies a **pennant** in its holder's colours, none when nobody holds it,
and a higher level is drawn a little larger. A ruin has a picture of its own. Some types have an
**influence zone**, a ground they reach, drawn only while the structure is selected; the castle's is the
ragged ground every seat used to have drawn about it, and what each type's means is not designed yet.

Clicking it opens **its window**, not its holder's: the name; the type, level and culture's word for it,
*great mosque* where another culture says *cathedral*; the holder, a link; whether it is a seat; what it
gives; its slots; and the map's mark.

**Slots are a row of sockets each**: the slot's name, then a socket for every place in it - a portrait for a
character, a picture with its amount for an item, an empty frame for an empty place - ending in *+3* when
there are more than fit, and *2 of 4* beside it. **Anything a house does not know is a question mark**: a
rival's cells show as many sockets as there are places, each a question mark. Which slots another house
may see into is the type's: a king on a throne is known to all, a prison's cells only to its holder.

### UI

**Holdings is a pane of its own**: a tab of **bottom left** in the spread beside the key figures, its button
a mark, and a mark of the bottom bar on a phone, the same tower. Its three sizes:

- **Minimised**: the strip, with the open holding's name or the pane's.
- **Normal**: a list, the seat first, then the rest in the order they were gained: each row the structure's
  picture, its name, its type and level, and what it gives. It scrolls; there is no limit.
- **Opened out**, or a holding pressed: one holding's details, the same sections as its window, the map's
  mark beside its name, and a way back to the list.

With none it says that holdings will be shown here. The structure's window is an inspect window like any
other and takes the same bays.

### Not decided

- **What each type's influence zone means**, and which types have one.
- **How a story changes what a structure gives.** Conditions hung on it - *cursed until the miller's
  daughter is freed* - were proposed and are out of scope for now.
- **Building one**: what it costs, how long it takes, where a house may raise it.
- **Taking one**: by force, by purchase, by inheritance, and what a garrison does about it.
- **Factions** as holders, all but the Vigil, which holds nothing in its own name (see *Faction*), and the
  structures standing in the world of 1790 before any house arrives, but for the settlements.
- **Upkeep**: whether holding costs as well as pays.
- **How a seatless house names another**, and what it lacks until it does.
- **The words**: every type's word in each culture is a first draft.
- **The numbers**: every yield, sight and level in the catalogue is a placeholder.

### Where it stands

The catalogue is: eighteen types in `world/catalogues/structures.json`, read by the game server when it starts and listed at
`/admin/inspect-structures`. A structure's history is on the server, and one of every type stands in Antarctica,
raised by the server when it starts while the instruments are open, and the debug panel's Structures section
raises one where the map looks. The page is sent them through the fog, each in the face its house last saw, and
draws them: a placeholder picture a type, drawn in code and the same in every culture, larger a level up, and the
pennant of the house holding it. A click opens its window: its name, its type, who holds it, its level and where it
stands. The debug panel's *take control of this building* hands the one whose window is open to the player's house,
which then flies their pennant and sees round it, as far as its type and level see, and is paid what it yields. Founding a
house raises its castle and names it the seat, and the castle's window says so. The **Holdings** tab lists what the
house holds, the seat first, and a holding pressed shows its details there. A structure can fall to ruin and be
rebuilt, from the debug panel; a ruin holds nobody and gives nothing. The debug panel raises and lowers a
structure's level, and its holder sees as far as the new level sees, and fills and empties its slots - a person in
one slot at a time, a thing with how many of it - strict about how many and permissive about what. A structure's
window draws its slots as sockets: its holder sees into every one, another house in sight into the public ones and a
question in each place of the rest, and nobody out of sight sees into any. A house is not drawn on the map:
its structures are, and its seat is the structure where it has its headquarters. A house without a seat is
drawn nowhere. What fills a slot changes what the
structure pays its holder, by the slot's rule: a throne left empty, a bishop's piety, a prisoner, a relic. A
structure is drawn, and its type named, in the culture of the ground it stands on, read off the master's culture
map: the same castle is a kasbah in the desert and a stockade south of it. A house whose castle changes hands or falls
loses its seat, and its sight from it, and plays on seatless; how it names another is not decided. Decision record 0093 is the shape and
`docs/plans/structures.md` the steps, one commit each; the hypothesis is experiment 0018. A castle's ragged gold ground is drawn only while it is selected, its influence zone. Every holding pays its holder
what its type yields a month at its level, and the house's resources count up from it; a structure's window, and a
holding's row in the tab, say what it yields and how far it sees.

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
and stops giving vision. Anything can give vision. Today every **structure** a house holds does, its seat
among them, as far as its type and level see, and each of its **key figures** standing on the map does, for as
long as they stand in one place, a circle about the size of Mallorca, which is as far as a castle sees at its
first level. Founding gives no vision of its own: the castle it raises does. A point that has ended leaves what it covered revealed. An event could give
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
every icon and the seats a choice offers are drawn over the fog, a structure or a person close in stands among the
trees under it, which is clear over them in vision, and what stands outside vision close in - a
castle, a person, the trees - is under it. How a thing's significance should enter
that, so that something seen from far out is never covered, waits on significance being worked out.

The switch for it is Adam's, in the debug panel's Debug map section: *fog of war: on* or *off*, in words. Off
lifts the whole of it for that window, drawn and held back alike, and every page load starts with it on.

### Not decided

- **What else gives vision**, and how big each circle is. Everything is a Mallorca today, and a watchtower, an
  ally or a storyline are all candidates.
- **What a really big event is.** The number is significance 80 and up, seen through the fog, and nothing in the
  world reaches it yet.
- **What a player sees before founding.** With no house there is nothing to see from, so the whole world is
  unknown, the seats a founding choice offers included.
- **Whether a house ever shares its vision** with another.

### Where it stands

Steps 1 to 7 of `docs/plans/fog-of-war.md` are built, and step 8's three commits. The server works out every house's vision points from
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
icon is drawn over the fog, and a structure or a person among the trees under it, where it is clear in vision.
Decision record 0061 is the shape, 0062 how the fog is drawn, 0063 which side of it each thing is on, 0110 a
structure's and a person's place among the trees, and 0065 how revealed ground loses its colour.

**The server holds back what the fog hides**, from wire version 11. A player is sent the houses on ground
their house has revealed and the people in its vision, their own house and key figures wherever they are,
and anything of significance 80 from anywhere, which nothing reaches yet. Nothing else in a cell reaches
them, in its snapshot or its changes, and what is held back is not counted either. When the house's sight
changes, every cell the player holds is answered again: a house on ground newly revealed appears, and
somebody no longer in vision goes. From wire version 27 a house sent from revealed ground carries the day the
fog hid it, which the same answer brings up to date. **Revealed ground shows its buildings as they were when the
fog hid it:** a house founded there since is not sent, and what happens to a house under the fog is not told
until the player sees it again. Turning the fog off lifts this as well as the drawing. See 0061's amendment.

**The edge has surface tension**, from wire version 12, which carries it: the ground a ball of 40 km cannot
get into between the circles is covered too, drawn and held back alike. It is one number,
`Vision.SURFACE_TENSION`, and the page follows it because the server sends it.

**No tree grows on unknown ground.** The scenery stands only where the house has revealed, so the trees stop
where the haze begins; the painted ground under the haze still shows where the woods are. With no house,
nothing grows anywhere, because nothing has been seen. **The trees are grown from what the server sends**, from
wire version 13: the stands of the scenery that touch the house's revealed ground and nothing else, which the
log counts under `stands` and the Scenery section says how many it holds. Every tree on revealed ground is
where it would be with every stand in the world, and when the house sees further the trees there grow as the
haze lifts. Without the game server nothing grows at all. The stand files are where only the game server reads
them, so a page cannot fetch one for itself.

---

## Challenge

Two things in the world measuring their strength against each other: a battle of armies, of wits, of coin, of
faith. In Adam's words it is "the thing that models a resolution of a conflict between two participants",
somewhere between a roll for a stat, which is too simple, and an autobattler, which is too complex.

### What it is

**Two sides and a rope.** At the middle of a challenge is the **tug**, one number from -100 to +100, and each
side pulls it toward itself. A side that pulls it to its end has won outright; otherwise, when the challenge's
seconds run out, the tug is the **outcome**: *+10 toward House Varga*. Won is ending on your side of the middle.
It is the same whoever is watching: a player sees it from their own side, and a spectator sees who is ahead.

**A progression of happenings.** A challenge lasts a number of seconds and is a **progression**: one
**happening** after another, spaced over it, the first at once - *Violence, Violence, Holy and Violence* for a
battle. A happening has one or more **aspects**, from ten in five linked pairs, each an aspect and its
**anti-aspect**: Violence and Diplomacy, Holy and Reason, Authority and Freedom, Greed and Generosity, Nature and
Industry. A pair is one dimension with two poles, and what links them is how their effects are made: a slice is
built to meet its anti-aspect's happenings well. **Challenge kinds** - a battle, a debate, a trade war, a
sermon - each draw progressions of their own flavour.

**Slices.** To enter a challenge a side brings one or more **slices**. A slice has an aspect, a **power**, an
**integrity**, a **summon count**, two **effects** of its own aspect, and the slots its effects bring, which take
a key figure or a structure. Every slice meets every happening. A slice's **aspect matches** while the latest
happening has its aspect - several of a side's slices may match, or none - and a matching slice gets the **aspect
boost**, half as much again on whatever it does: a buff, *empowered*, which the happening puts on whatever matches
it until it ends, and which an effect can put on out of its aspect too. A Diplomacy slice in a battle gets no boost, and still does what its
effects let it do there.

**Effects** are **triggers**, which fire as their slice meets a happening, and **passives**, which work from second to
second. An effect, or a kind of summon, that **needs a matching aspect** works only while its aspect matches; one
that **needs its anti-aspect** works only while the happening has its anti-aspect; one that needs neither works in
every happening. The mark is how an effect is balanced: what a house raises or builds waits for its moment, a person's
gift works anywhere, and each aspect has an effect that answers its anti-aspect - Diplomacy's Ceasefire stuns the
summons of a battle, Freedom's Defiance pulls and hastens in Authority's hour, Reason sows doubt in a sermon - so a
slice can meet its opposite's ground without the boost. Forty-two to begin with, four or five to an aspect: Violence's Sellswords hire Mercenaries, Holy's
Divine Rebuke wears the enemy's integrity down for its Priests to feed on, Greed's Collector costs its side now
and pours its **coffer** out later. Many **summon**: a Mercenary, a Rebel, a Machine, that stays on the field
and pulls once a second until it is killed, turned, or the challenge ends, a side holding as many as its slices'
summon counts add up to.

**Buffs and debuffs.** An effect or a summon may put a **buff**, which helps, or a **debuff**, which hinders, on a
slice or a summon for some seconds. Their names say what they do - *stunned*, *aspect-bound*, *weakened*, *eroding* -
and the effects that put them on carry the flavour: Authority's Curfew leaves every enemy summon aspect-bound, acting
only in happenings of its own aspect, and the Enforcer stuns the enemy's hardest puller; Reason sees through an enemy
summon's tricks and weakens it, and Nature's Dread of the Wilds weakens every enemy slice; as a happening leaves Nature
the briars close, and the enemy's summons are eroding, losing integrity at each act until they are gone. Authority's
Firm Hand lays down the law: every enemy slice is *penalised*, so a trigger it fires out of its aspect costs its side. Generosity's Tend the Wounded **cleanses** its side of every debuff.
Buffs help the same way: *empowered*, which is the aspect boost; *hastened*, acting again in some seconds, which
Violence's War Drums beat and Industry's Well-Oiled gives; *echoing*, a trigger firing twice, as the word spreads for
Freedom; *warded*, which no debuff takes, Reason's Foresight; and *steadfast*, never turned, sworn by Authority's Oaths
of Fealty. The same one put on again lasts from then and never stacks; different ones add up. The page charts them all.

**Things on the line.** A slot may put what is in it on the line: a building or a person then stands in the
challenge as a summon, stronger than most and paying its side as it arrives, and if it is killed the building
is **damaged** or the person **fatigued**, losing a tenth of their **effectiveness**. A building at nothing is a
ruin.

**It is resolved at once and shown after.** A challenge is worked out the instant it is raised and then played
in front of the player as a spectacle, so the synergies and the slices working with and against each other can
be watched. The outcome goes to whatever raised it: a battle's victor, a debate's winner, the piety Sanctuary
pays a victorious house.

### What it is for

**One way of settling any conflict.** Armies, wits, trade and faith are settled by the same machine, told apart
by the aspects of their happenings and the slices brought to them, so a new kind of conflict costs a challenge
kind and not a mechanic.

**Strength that depends on the ground it is tested on.** A violent slice shines in a battle and is worse than
useless in a sermon. What a house builds its slices for, and which challenges it can be drawn into, are where
the choice is.

**Stakes.** Putting the cathedral on the line pulls hard and risks it; the damage outlives the challenge.

### Look and feel

Resolved at once and played out, so the player sees what happened and why. **It is played out in a diorama**: a
small piece of the world seen as the map sees it, from the south and above, built from the map's own pictures, where
the summons stand, act and fall and the tug is drawn on the ground. Each kind of challenge has a **venue** of its own,
and the first is **the square**: a sermon in a town square, each house's speaker on a platform at the back of its bank
and the townsfolk between them, who walk over to whoever is winning them - so the tug is a share of the crowd, and a
swing is people crossing the square.

**Each house holds a bank**, left or right, turned three-quarters toward us, so no figure is ever seen from behind.
Held wide the stage is wide; held deep, on a tall screen, the same banks are deep, the ranks one behind another.

**A happening travels through the venue.** Each comes as a seal, a diamond tile bearing its aspect's mark laid as the
ground is, seen waiting faded in a patch of mist from the moment the one before it sets out - in the square, at the
palace doors - so the next is always in sight; it forms there a few seconds before it begins and slides along a gilt
channel in the
cobbles' joints to a font near the front, which it reaches on the very second it begins. Then lightning arches through
the air from the font to each slice it lights, which crackles and flashes. **It is watched for the first time**: a run plays
by itself from a moment before its first second, and nothing past the furthest second played is shown.

**Round it, everything folds away.** Each house's slices are chips in its tray along the bottom, lit while their
aspect matches, dim while nothing they carry can work, with the pips of what they bear; tap one and it opens to say
what each of its effects needs and whether it works now, tap the house's name and the tray folds to it. The tug is a
bar at the top in the two houses' colours. Along the
bottom the replay: play and pause, its pace, to the end, the happenings as bands with the tug drawn over them, and a
scrub to any second. The history, the tug second by second and what happened in the second shown, opens behind a
mark. Every control is a mark. Decision record 0116 is the shape; the steps are in `docs/plans/challenge-spectacle.md`.

### In the game

**A quest raises the first challenges**, through a challenge node (see Quest). Adam's word of 2026-10-23, in
`docs/plans/challenges-in-the-game.md`:
- **Pressing the node** opens the **challenges' tab** of the right column, beside the dialogues and the quests, on its
  choosing screen:
  - the opponent's name and the challenge's kind;
  - the house's **starting slices**, up to three of them brought;
  - not the opponent's slices, which are seen only once it starts.
- ***Accept challenge*** fights it out there and then, in one decision with the quest's next step, so a challenge never
  waits to be started.
- **The spectacle plays in the tab**, watched for the first time.
- **A result follows:** who won, how, and what the quest does next.
- **The tab keeps every challenge the house has fought,** newest first, each saying who stood against whom, the kind,
  and who won and how, and any of them can be watched again.

**Every house holds the same starting slices** until houses come by their own; making slices is a later part.

### Not decided

- **Who else raises a challenge, and when**: a battle over a structure, a debate a dialogue starts, a rival. A quest's
  node is the first.
- **The pane's place**: the challenges' tab is in the right column until the bays are reworked.
- **The other venues**: a ford, a siege, a trial were drawn; which kind is shown in which, and how many there are.
- **How a house comes by slices**: every house starts with the same set, and others are unlocked "in different
  ways" that are not named yet.
- **What damage and fatigue do in the world** beyond the number, and how either is mended.
- **Effects outside their slice's aspect**, which Adam named as a design space for later.
- **Relics and spirit items in slots**, and aspects beyond the first ten.
- **The numbers and the words**: every effect's numbers and name is a first draft, to be tuned on the page.

### Where it stands

Planned on 2026-10-20 and not in the game: its first iteration is an engine on the server and a simulator on
`/admin/inspect-challenges`. The content - thirty effects, nine summons, four kinds - is a catalogue that page shows
and edits, and the rules' own numbers are the balance's. The engine fights a challenge out on the server, second by
second, with all thirty effects, and buildings and people put on the line. On the page's simulator Adam builds
both sides and a progression, or has one drawn from a challenge kind, has the engine fight them out through one of his instruments, and reads every moment of
it, the tug drawn, and what it came to; a seed fights the same challenge again, and a batch of a hundred or ten
thousand says how often each side wins; a grid of matchups weighs every aspect against every other. Decision record 0107 is the shape and
`docs/plans/challenges.md` the rules as settled and the steps, one commit each. Its second part, matching aspect with
buffs and debuffs, is built too, in `docs/plans/challenge-matching.md`. The spectacle, the square watched on the same
page, was planned on 2026-10-21 in `docs/plans/challenge-spectacle.md` and is built: a single run on the page is
played out in the square, held wide or deep, with the replay, each side's slices and the history, from parts of the
component library. The square is the only venue so far. Challenges in the game, raised by a quest's challenge node,
chosen for and watched in the right column, were planned on 2026-10-23 in `docs/plans/challenges-in-the-game.md`, and
are built: a quest's challenge node is chosen for and accepted in the challenges' tab, fought on the server in the
decision that moves the quest on, watched there in its spectacle with the result after it, and kept in the house's
history, from which it is watched again. What a challenge gains and loses is shown and touches no house yet.

---

## Faction

An NPC power of the world, one for each of the five resources: a quest giver with a screen of its own and its own
ways to win its favour, whose places are held by houses. Adam's own, described on 2026-10-20: a force in the world
"based on real things", with "hierarchy and power", its places held by houses - house bots at first - and a player
who climbs it and "even one day might become on its highest council". Why the factions are everywhere, the five of
them and what feeds them is the fiction, `SETTING.md`'s. Designed on 2026-10-20 with the first of them, the
**Vigil**, the faction of piety; the other four follow it one at a time.

### What it is

**Every faction stands on one frame**, and what makes one different from another is mostly its door.

- **Circles.** A faction is ordered in circles, each above the last:
  - its **friends**, any house it favours, holding nothing;
  - the **first circle**, one by every great ruin, about five chairs: the same places the guides gather;
  - the **second circle**, one in each **province**, about nine chairs;
  - the **third circle**, one for the whole world, about seven chairs.

  Each faction names its circles and sizes them its own way.
- **Chairs.** A place in a circle, held by one house at a time, with one of the house's key figures sitting in
  it. A house holds one chair in a faction, and rising to the circle above gives up the one below. Not a
  **seat**, which is the house's own; and the top circle is never called a council, which is the gods'.
- **Favour.** How a house stands with one faction: earned in that faction's own ways, mostly its quests and the
  resource it stands for, and lost in them. Each faction has its own word for it.
- **The door.** How a faction fills an empty chair, and the one thing every faction does its own way: the Company
  sells stakes, the Republic of Letters elects for a work, the courts in exile appoint, the stewards seat whoever
  holds the land, and the Vigil has a sponsor, an ordeal and a black ball. All but the Vigil's are sketches.
- **House bots.** When the world opens, every chair is held by a house bot, so every circle is full from the
  first day. **A bot never stands in a player's way for long**: a bot in a chair steps aside for a house that
  passes the door.
- **The oath.** A house may be a friend of every faction and hold a first-circle chair in several. Above the
  first circle it holds chairs in one faction only.
- **Quests.** The head of a first circle gives quests, which are **Quest**s as they are, offered by the faction.
  They are most of how favour is earned.

**The contest.** The five contend in every province for **sway**, a share of how far the province leans their
way; the five shares make the whole.

- **A house moves it** by its quests for a faction, which push that faction's sway in the house's province.
- **What sway does is each faction's own.** Where the Vigil is strong, piety yields more and its lodges offer more.
- **It is held to a rubber band, tightly, behind the scenes.** Every share is pulled back toward an even share,
  the harder the further it has gone, and never crosses a floor or a ceiling. So no faction is weak for long and
  none ever wins. A player moves sway only by playing, never by a lever. It is a rate, as a resource is, so it
  moves with nothing written down until something changes it.
- **The player never sees a number.** Sway is told as rumour: a revival here, a schism there, a winter that filled
  the chapels. The world explains it its own way, as `SETTING.md` says it must.

**The Vigil**, the first faction, as a house meets it:

- **It is invisible until it finds the house.**
  1. *Watched.* A pious house that does what the Vigil values is noticed by the lodge by its ruin: a relic kept in
     a cathedral's reliquary, a pledge of piety kept, an abbey held. The house sees only signs: a rare action dealt
     from Faith, a stranger making a sign it does not know; a mark scratched on its seat's gate.
  2. *The letter.* An unsigned letter, a **Dialogue**, asks the house a question, and the answer opens the ordeal,
     a quest.
  3. *Sworn.* The ordeal walked, the house is a friend of the Vigil and is given a secret name, and only now is the
     Vigil's screen there.
- **Its circles**: a lodge by every great ruin, five chairs; a province, nine; the Seven, over the world.
- **Its masks.** A house knows the houses of its own circles, and the circle above only by their secret names. The
  Seven are known to nobody below them. It is a fog of war over the hierarchy, lifted by rising.
- **Its door, at every circle:**
  1. A chair-holder of the circle sponsors the house. **The Vigil comes to the house, which never applies**: a
     letter arrives when the house's favour is enough and a chair is empty.
  2. The house walks an ordeal, a quest, harder at each circle.
  3. The circle consents unless one of it casts **a black ball**, as a masonic lodge votes. A quest for the one who
     cast it can win it back.
  4. A bot in the chair steps aside: the old brother goes to a hermitage.
- **Its favour is trust.** It is earned by pledging piety and by the lodge's quests: carrying a relic out of a
  ruin, hiding a hunted teacher in a slot, putting a brother into an abbey's abbot slot or a cathedral's bishop
  slot, delivering wealth to a hidden house, holding an abbey on an island, sponsoring another house. It is lost by
  failing an ordeal, breaking a pledge, or sitting above the first circle of another faction.
- **Its wings.** Every chair-holder leans to the Penitents, the Pilgrims or the Listeners, and the wing that holds
  most of the Seven sets the Vigil's course for a while: what its lodges ask, and what they reward.
- **It holds nothing in its own name.** Every structure it commands is held by one of its houses, so it is the one
  faction that is never a structure's holder.
- **Each circle says a little more** about what its founders felt, in the words of the wing that holds it, and none
  of it right. The first says nothing. It is one road to the discovery `SETTING.md` keeps.

### What it is for

**Somewhere to rise to.** A house's power state rises and falls across the centuries, and a faction is a ladder
for it: chairs by every great ruin at the bottom, seven at the top, each circle harder to reach than the last.

**Somewhere for quests to come from**, which the **Quest** entry leaves open: a faction is one answer, with a
reason for every quest it gives.

**Something for a resource to be for.** Favour is earned with the resource the faction stands for, which is
what `ROADMAP.md`'s *Later* asks for.

**A world that moves without anyone.** The contest goes on whether anybody plays, and the rubber band keeps it
from ever settling.

**Saying what the house stands for.** Which faction a house swears to above the first circle is a statement, which
is the question `VISION.md` asks of a house.

### Look and feel

As diegetic as the rest: a faction's screen is what a house in it would keep on its desk. The Vigil's is a book of
ciphers and a case of letters, its circles a ring of seals, with a secret name under each seal the house cannot
see into. A faction's face changes with the ground, as a structure's word does: the Vigil's lodge meets in an
abbey's library on European ground and in a Sufi lodge on Islamic ground. Sway is told in rumours and never drawn
as a number or a bar. Every picture is a placeholder until it is Adam's.

### UI

Sketched, not designed. Each faction a house is a friend of has a pane of its own, which arrives the first time it
is: so the Vigil's arrives only when the house is sworn. It shows where the house stands and its favour; its
circle's chairs, with who holds them or their secret names; the quests its circle offers; and the rumours of its
sway. Which bay it takes, and whether the factions share one pane behind tabs, is decided when it is built, from
the component library first.

### Not decided

- **How a house comes down from the top circle**, and what its spirit keeps of it: tabled on 2026-10-20, so that
  it never feels bad for the player who climbed. `SETTING.md` has the reason ready.
- **When players hold every chair of a circle**, what the next house does. It must not make a faction
  player-versus-player first.
- **What a house bot does in a faction**: holding a chair, casting a ball, stepping aside. What a house bot is,
  and that it does nothing yet, is decision record 0108.
- **The other four factions**: their names, circles, doors and favour.
- **How sway is counted**, what each faction's does, and where the floor and the ceiling stand.
- **The provinces**: how many, and where their lines run - the cultures, the named regions, or lines of their own.
- **Which key figure sits in a chair**, and what becomes of the chair when they die.
- **The oath's edges**: whether a house can leave a faction, and what it costs.
- **Every name and number**: the Vigil's, its wings', the circles' sizes.

### Where it stands

Designed on 2026-10-20 and not built: nothing of it is in the source. A faction will be a history of its own and a
second kind of structure holder, which `StructureEvent` already expects, with a catalogue under `world/catalogues/`
and an inspect page of its own. Building it is planned first, its events named with Adam before anything is
written, in `docs/plans/factions.md` when that is the step chosen.
