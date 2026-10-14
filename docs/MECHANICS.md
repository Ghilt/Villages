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

The player presses **Take action** and pays for it. The game shows them every **omen** it took into account -
how the house stands, what they have open, where they are looking, the season, what changed since the last
roll - and rolls a **rarity**, then deals a hand of three **actions** of that rarity. The player takes one.
The rolling is done by the **fate engine**; see `ARCHITECTURE.md`. How it is built, step by step, is
`docs/plans/choice-roll.md`.

### What it is for

**Agency.** The player provokes a choice roll themselves, at the moments that seem interesting to them, and
by choosing where and when they influence what the roll can offer. It is the main way a player reaches
into the world on purpose rather than waiting to be asked. **They aim it by what they look at**: the inspect
windows they have open, the dialogue they are in, the key figure they have focused, and the part of the map
on their screen are all omens, and so is how the house stands. Each option carries the marks of the omens
that brought it, so a player learns that looking at rivers while pious brings river-and-faith things, and
aiming becomes a skill rather than superstition.

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

**It is clear when you provoke one.** One button does it, saying **Take action**, in words, Adam's call. It
gives **no hint beforehand** of what the roll will read: the omens are revealed only after paying, and finding
out what counts is part of the exploration.

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

The map's omens are worked out by the server from where the player is looking and how far they are zoomed in,
never taken from the page: zoomed out the omens are broad, zoomed in they are close, and only ground the house
has revealed counts. See decision record 0084. Where the master's real names are carried, the ground says
whether and the names say what: the river is *The Vistula* and the open sea *The German Ocean*, opening what any
river or open sea opens, and zoomed in as close as houses are named, a town of 1790 in view is an omen of its
own, *Near Dantzic*, which a questline can open on by the town's real identity. See decision record 0087.

### Look and feel

The roll plays like **a report card at the end of a level**, Balatro's scoring the reference: the omens slam
into a list one after another, each a mark, words and sometimes a value, and then the options pop in under it.
A click hurries the list. **The rarity is said by the options alone**, by the tag on each and its colour's glow,
Adam's word of 2026-10-05: nothing stamps it across the list. The list stays where it can be read, and each
option carries the marks of the omens that brought it, so the two can be matched.

The options are shown as **parchments**, edged in their rarity's colour, on a **wooden desktop with an
inkwell**. Hovering a parchment lifts it slightly, so it reads as something you can pick up. The shared
language this draws on - the diegetic rule, the rarity colours - is in `LOOK-AND-FEEL.md`.

### UI

A **pane** that is **always there** in the spread's bottom middle. Idle it is the Take action button; pressed,
it opens out and plays the roll; answered, it goes back to the button. On a desktop it has two sizes and on a
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
  which lay themselves out as though it were not there and always leave it room. On a phone it is a strip with
  its control, and a press anywhere on it but its buttons opens it out too.

**On a phone** a rolled hand is always the list and then the options under it, one under another, and the pane
scrolls when they do not fit. The founding letter keeps its own two drawings - three parchments across, and the
**carousel** - and arrives at half.

**On a desktop it glides** between its chip and its box over everything, the veil fading with it, and what it
says fades in once it has landed, the cards' details a beat after their titles. See decision record 0086.

**In the spread** it takes **bottom middle**, and it moves nothing whether it is put away or opened out. **On a
phone** a question takes the map's bay, opening it to half if it was a strip, and the pane beside it keeps the
other; a hand rolled from Take action lands where the letter already stands, and answering leaves it there,
back to Take action. See decision records 0044 and 0085.

### Not decided

- **How expiry is decided**: what makes a choice irrelevant, and whether the player is told it lapsed.
- **Whether a price ever changes** - with the house's standing, the rarity, or the omens - or is paid in
  anything but wealth. Ten wealth is a temporary number.
- **Whether an action can be dealt only when its omens are present**, rather than every action being in the
  always-open pool and the omens only tilting the draw. The first content is the second kind.
- **Hints on the button.** Settled as none for now; the old idea of a flourish when something new is among
  the omens is kept here rather than forgotten.

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

**On a phone** it is a pane like any other, with no special treatment: it takes a bay, and the player opens
it out when they want the whole screen for it.

**It arrives the usual way.** A dialogue offered opens the pane: in the spread it appears on the right, or
opens from its strip, and on a phone it takes the bay that is not the map's, at half, as an inspect window
does. A pane already open stays as the player left it. What arrives is a dialogue waiting that the page has
not been shown before, so the ones waiting when a page loads open it, as a letter does, and the same one
never opens it twice: a step taken, a reconnect or the list sent again is not a dialogue offered.

**A line can show something.** Shown, a line can take the camera to a place, or open an inspect window on
what it names - the house, a key figure, a place - so a conversation about the quay can show the quay. In
the spread the map moves beside the column and the window opens in the rail, as a click would open it. On a
phone the conversation goes to half in its bay and the other bay shows what the line names, the map or the
window. It is the page's, never the house's history, and the conversation is never what gives way to it.
Adam's idea, from the camera going home by accident when a line paid.

### Not decided

- **Who the characters are.** Any character can speak, whoever they are to the house, and so can somebody
  who is not a character at all, a messenger say. NPCs from the warped history, and whether another player's
  house ever appears as a speaker, are open.
- **What triggers one**, beyond "anything". The triggers are a list nobody has written, and so is where the
  dialogues themselves are written: the first is a sample in the server, offered from the debug panel.
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
The debug panel's Dialogues section offers a sample, a letter from the coast spoken by the house's first key
figure and a messenger, from wire version 15, and the event page shows what was offered whole. A read model
keeps every dialogue a house was offered and how far each has got, and the player is sent each one as far as
it has reached, from wire version 16: the lines past the next step, what a line will give and the
requirements stay on the server. An option can spend, from version 17, and is refused while the house cannot
pay, and from version 18 each option carries its reveal impact. A speaker's death ends every open dialogue they
speak in, as lost, naming who died. Nothing in the world offers one yet. The pane stands in the column
down the right from the house's first dialogue, at its three sizes, and on a phone navigation lists it;
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
camera to its place or opens its window, beside the conversation on a desktop and in the other bay on a
phone, where the two go to half each; once in the life of the page, and an option only once the house has
taken it. The debug panel's Dialogues section offers a dialogue and does nothing else, and a requirement is
never sent to a page. Its shape is decided in decision record 0071: a dialogue offered whole on the house's
stream; only its dialogue choices, and the lines that give something or end it, recorded; what a line gives
written as the world's own event beside the step; and hidden requirements that end a dialogue when one
fails, with the server holding back what the player has not reached.
`docs/plans/character-dialogue.md` is the order it is built in, one commit a step, and experiment 0014 is
what it is meant to show. `ARCHITECTURE.md` says what it asks of the server and the client.

---

## Inspect window

The way the game answers "what is that". Not the map's own: the map is only the first place a player
points at something.

### What it is

A window that says what one thing in the world is. That thing is its **subject** — today a house, an
area, a character or water - a river, a lake, the sea - later a holding, a work, a place named in a
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
from nothing, and the rest slide to where that leaves them; see decision record 0086. **On a phone** a window takes the bay that is not the
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

## Structure

Something built that stands on the map: a castle, a mill, a cathedral, a prison, a shipyard. In Adam's
words they "represent a structure of some kind", held by a house now and a faction later, and they "provide
its controller income of various resources". The pane that lists a house's own is **Holdings**.

### What it is

A thing in the world with a history of its own, not a part of a house. It has a **type** - one of sixteen
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

**The seat is a role one holding plays**: where the eye goes and the room is entered. Founding a house
raises a castle and names it the seat. A house that loses its seat plays on without one until it names
another.

**Destroyed, it leaves a ruin**: no holder, nothing given, its contents still in it, and something that can
be raised again.

A house gets its castle from founding and, for now, everything else from the debug panel. All four ways a
house will come by one are wanted: building it, a story handing it over, taking it, and finding it standing
in the world of 1790.

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
a mark, and a row of *Go to* on a phone. Its three sizes:

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
- **Factions** as holders, and the structures standing in the world of 1790 before any house arrives.
- **Upkeep**: whether holding costs as well as pays.
- **How a seatless house names another**, and what it lacks until it does.
- **The words**: every type's word in each culture is a first draft.
- **The numbers**: every yield, sight and level in the catalogue is a placeholder.

### Where it stands

The catalogue is: sixteen types in `world/structures.json`, read by the game server when it starts and listed at
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
icon and anything in vision is drawn over the fog. Decision record 0061 is the shape, 0062 how the fog is
drawn, 0063 which side of it each thing is on, and 0065 how revealed ground loses its colour.

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
