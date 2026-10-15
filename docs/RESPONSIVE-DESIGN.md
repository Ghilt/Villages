# Designing for every screen

> **What belongs here:** how the interface works across screen sizes, whatever any of it is used for — the
> rule that we design for phone and desktop together, the two forms the stage takes, the bays there are and
> the rules each one keeps, a pane's three sizes and how they behave in each form, and the controls that
> move between them. **What does not:** any one pane — which bay it takes, what it draws at each size, how
> it opens — which is that mechanic's **UI** section in `MECHANICS.md`; and the shared visual language of
> colour and component style, which is `LOOK-AND-FEEL.md`.

## The rule

**Mobile is designed for from the start, not ported to later.** Every component is laid out for a phone and
for a desktop at the same time, in the increment that builds it. A component that only works at 1600 pixels
wide is not finished, and "we will make it responsive later" is how an interface ends up being rebuilt
instead.

This is a rule about when, not only about how. The cost of responsive layout is small while a component is
being written and large once a dozen of them assume a big screen.

**How the interface works is independent of what it is used for.** A bay has its rules whatever is put in
it, and a pane is placed by them rather than bending them. This document says what the stage does; each
mechanic says what it does with the room it is given.

## The two forms

The stage has two forms, and **one number picks between them: 600 pixels on the stage's shorter side.** Above
it, the spread; at or below it, the bays. There is no tablet shape in between. See decision record 0040.

**The spread shows everything at once.** It is **tiles on a floor**: one pane is the floor, filling the stage
and lying under everything, and the rest are tiles laid on it that never overlap each other. Seeing them
together is part of reading the world, and a large screen can hold them. See decision record 0041.

**The bays show two things at once.** The stage splits into two boxes along its **longer** dimension — a
portrait stage divides top and bottom, a landscape one left and right — and the player says what goes in
each.

Two, not one. A game read off a map, where the map disappears whenever something is read, is played from
memory; the thing being talked about and the thing it is about belong on the screen together.

**The spread shows everything; the bays choose.** That is the whole difference between them, and it is what
stops the phone from being a second design. A mechanic is written once, at up to three sizes.

**How the room is divided belongs to the fold, not to the panes in it.** A bay is not a pane's own room:
it is one end of a stage two things are sharing, and what happens to be standing in it has nothing to say
about how much of it there is. So there is one value with three settings, and there is no fourth
arrangement:

- **A strip and the rest** — one bay is put away to 44 pixels and the other takes everything else.
- **Half each** — measured, not declared. The middle size means the same thing on every pane.
- **The rest and a strip** — the same again, the other way round.

**The join between them is drawn**, as a moulding lying over it rather than as room cut out of either
side: three gold rules the length of the stage with a knot of ornament at the middle, turned a quarter
when the stage is. See decision record 0048 and `LOOK-AND-FEEL.md`.

**Both bays put away is not a state a player can reach**, and not because a rule forbids it: there is no
arrangement that says it. **Naming one bay's size names the whole arrangement**, so the two controls can
never disagree — they read one value rather than writing into each other.

**Nothing but the control moves the seam**, with one exception. Putting a different pane in a bay, pressing
the **compass**, closing a pane: none of them changes how the stage is divided. The exception is something
*arriving* in a bay that is a strip — something the player just clicked, or something the world has just
sent — which opens that bay to half, because a thing nobody can read is not an answer. A thing arriving that
is already standing in a bay stays where it is and only its bay opens, so a hand rolled from the letter lands
in the letter rather than swapping it with the map. The compass is not
one of those: what it opens is a list of ways on, and a strip of it is still a list of ways on. See decision
record 0046.

### What that looks like

The three arrangements, upright. The same three turned, cut into a left and a right.

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│             │   │             │   │ A           │
│             │   │      A      │   ├─────────────┤
│      A      │   │             │   │             │
│             │   │             │   │      B      │
│             │   ├─────────────┤   │             │
│             │   │      B      │   │             │
├─────────────┤   │             │   │             │
│ B       ▁▄█ │   │         ▁▄█ │   │         ▁▄█ │
└─────────────┘   └─────────────┘   └─────────────┘
 the rest and a      half each        a strip and
     strip                              the rest
```

Which two panes a phone opens on, and where a thing arriving goes, are the panes' own business: see each
mechanic's UI section in `MECHANICS.md`.

## The bays

**A bay is named for where it is, not for what goes in it**, and a pane says which one it takes. Nothing in
the layout knows what any pane is for. There are five in the spread and two in the bays.

### In the spread

```
┌────────────────────────────────────────────────────┐
│ VILLAGES                             ┌─────────────┤
│ ┌───────────┐                        │             │
│ │           │                        │             │
│ │   left:   │                        │   right     │
│ │  the rail │      the floor         │             │
│ │           │                        │             │
│ ├───────────┤                        │             │
│ │  bottom   │                        │             │
│ │   left    │   ┌───────────────┐    │             │
│ │           │   │ bottom middle │    │             │
│ └───────────┘   └───────────────┘    └─────────────┤
└────────────────────────────────────────────────────┘
```

Bottom middle is drawn put away, as its chip. Opened out it lies over all of it.

**The floor** is the whole stage, under everything, and the one bay exempt from the rule that nothing
overlaps, because everything lies on it on purpose. Its pane has no size in the spread: it is the ground the
tiles stand on. On a phone the floor's pane is a pane like any other, with one stated exception: put away,
its strip carries no size control and is itself the way back, because three marks in 44 pixels of it would
be three things to aim at where the only useful one is the thing itself.

**Left** is the upper tile of the column. **Its panes stack**: one under another on a **rail**, all of
them drawn, up to three, because they are about different things and comparing two of them should not mean
remembering one. It never grows tabs. **When the panes on the rail no longer all fit, every one but one is
put away, and opening another puts the rest away. Nothing reopens by itself.** See decision record 0058.

**Bottom left** is the corner, the lower tile of the column. **It takes tabs when more than one pane is put
there**: the panes take turns, and a strip of marks across its top says which is up. The panes declare that
they share by naming the same bay; the layout never decides it, so the tabs cannot appear and vanish as the
window is dragged. See decision record 0042 and `LOOK-AND-FEEL.md`.

**Bottom left is one size, whichever tab is up.** Pressing a tab never resizes anything. Its three sizes are
the bay's own — put away, a strip; normal, 232 tall; opened out, 340 tall and reaching along the bottom to
560 — and they are sized for the content that is meant to live there, not after whichever pane happens to
stand in it. A pane with no way to fill the biggest of them is given something to fill it with later,
flavour, rather than the bay shrinking to fit it. Its one size control stands at the end of the tab bar
rather than inside each pane. The desktop's form of the fold's rule: how big the corner is belongs to the
corner, not to whatever is standing in it. See decision record 0057.

**Opened out, bottom left reaches along the bottom**, the one tile whose width is not the column's: it grows
along the bottom edge and the rail above keeps the column's width. It stops where it would leave bottom
middle's chip and a right column at its normal width no room beside it, whether or not either is there, so
neither arriving resizes the corner. See decision records 0056 and 0085.

**Bottom middle is put away or opened out, and nothing between**, and either way it moves nothing. **Put away
it is a chip**, 280 wide where there is room and never less than 136, a gutter off the bottom edge, in the
middle of what the corner and the right column leave; they lay themselves out as though it were not there.
**Opened out it lies over everything**, 736 wide and up to 768 tall, centred on the stage and standing where
the chip stands, with the **veil** under it: the whole stage dimmed between it and everything else, the one
tile exempt from the rule that tiles never overlap besides the floor. Pressing the veil puts it away. See
decision records 0044 and 0085.

**Right** is a second column, set into the stage's right, top and bottom edges as the first is set into the
left, top to bottom. **It is cut last, from what the others leave**: never
within a gutter of the wider of the rail and the corner, the corner reaching along the bottom included, so
its coming and going resizes nothing on the left. Its three sizes are the layout's, as the left column's
width is: normal, 480, squeezed to a third of a narrow stage first and never below 288; opened out, half
the stage and never less than normal; put away, a strip 44 high across its **bottom**, so the three put away
stand along one edge. It runs top to bottom always, and it is never so wide that it leaves bottom middle's
chip less than its least. On a desktop both columns are at their own widths, and on a narrow stage both are a
third and the map is the middle one; below 744 wide the right column is what gives up width. **Its panes take
turns**, the dialogues and the quests, behind a tab bar across its top, as the corner's do: the column is one size
whichever is up, and put away its strip keeps room for the tab bar over it. See decision records 0069, 0085 and
0096.

**Only one of bottom left and right is opened out at a time.** Opening one out steps the other down to its
normal size, so the middle of the bottom row is always there for the chip. See decision record 0085.

**The column is one piece of furniture**, set into the stage's left and bottom edges rather than floating a
gutter off them. Its two tiles share a width and one gutter between them, so they read as a column and not
as two cards that happen to be near each other. It wants 416 pixels and gives that up to a third of the
stage before it gives up anything else.

**An empty tile takes no room.** Nothing in the corner and the column runs to the bottom; nothing along the
bottom and the floor keeps the whole bottom of the stage. A tile is never reserved against a future.

**A tile changing size glides there, in 160 milliseconds**, whenever a size was asked for: never the floor,
never while the stage itself is resized or crossing the fold, and never for a player who has asked for less
motion. The veil fades in and out with bottom middle, and what bottom middle says fades in once its box has
landed. The windows on the rail, which are not rectangles of the layout but stacked in it, glide too: they are
measured after every change and each is animated from where it stood. See decision record 0086.

**A tile that runs out of room draws what is in it smaller**, by a container query on the tile, which is the
same thing the pane does on a phone. It **never changes form**: only the stage's shorter side decides
whether it is the spread or the bays.

### In the bays

**First and second** are the two boxes the fold cuts: the top and the bottom upright, the left and the right
turned. A pane is in one of them or in neither, and putting one where the other already is swaps the two,
because with two bays there is nowhere else for the displaced one to go.

## Panes

**A pane is a thing that can occupy a bay.** It is declared once — what it is called, the mark it is known
by, which bay of the spread it takes — and the layout places it. No pane knows which bay it is in beyond
the room it was given.

**A pane has three sizes, and it owns all three.** Full, small, and minimised. The layout says how much
room there is and the pane says what it looks like in the room it got. **Nobody drags a divider** — the
split moves because the player named an arrangement, never because something was moved into a bay.

### The six states a pane has on a phone

**Three sizes, twice over: once upright and once turned.** A phone is 390 by 844 held one way and 844 by
390 held the other, so a bay is a low wide box in the first and a tall narrow one in the second. Three
sizes in two cuts is **six states**, and a pane is not finished until all six have been looked at. The
instrument has a toggle for each.

| | upright | turned |
|---|---|---|
| **Minimised** | a band across the stage, 44 tall, with the pane's name on it | a sliver down the stage, 44 wide, the same thing a quarter turn round |
| **Medium** | the top half or the bottom half | the left half or the right half |
| **Big** | the stage, less the other pane's strip | the same |

**Minimised is the same for every pane, and unless a pane says otherwise it is just the pane's name.** One
thickness, one shape, so that putting anything away looks like putting anything else away. **The controls
go to the end the compass is not standing at** — in from the right upright, and at the top turned, with
the name reading down from under them — because a strip's controls are the one thing on it that has to be
hittable. Two strips say otherwise and say why: the floor's pane, above, and navigation's, below. Both are
**stated** exceptions rather than quiet ones.

**Medium and big are the pane's own business, and may be one drawing or two.** A pane whose full form is a
list can draw the same list medium and simply show less of it, and another can draw something else
entirely. What is not allowed is a size that only works in one cut — a pane that reads at 390 by 422 and
not at 422 by 390 has five states and a hole.

### On a desktop

**The spread is not one of the six.** A tile's size there is its own - or the corner's, for the panes
taking turns in it - and the floor takes what is left, so the desktop is a separate set of requirements
and the section above does not speak for it. It has the same three sizes and the same one control; what
differs is who the room belongs to. See decision records 0045 and 0046.

**Every pane carries a pane size control** in both forms, bar the floor's — three marks saying how much of
the stage it is taking: put away, the normal size, opened out. In the **bays** it names the arrangement,
and the other bay follows because both of them are reading one value. In the **spread** each tile's size is
its own, because a tile is not dividing anything with anybody, and the panes taking turns in bottom left
share one control, in its tab bar. **In the spread a press anywhere on a pane put away opens it out**, but
on a button of its own, which does what it says: the strip is the way back, the marks are for the other sizes.
**Bottom middle offers two marks in the spread**, put away and opened
out, and its chip carries none, because pressing the chip opens it. See decision records 0045, 0046, 0057
and 0085 and `LOOK-AND-FEEL.md`.

**Where things open differs between the forms, and nothing else does.** In the spread everything is on the
screen, so a way on from a pane is a plain click and there is nothing to choose between; in the bays it
goes into the other bay, so the pane it came from stays beside it. Tabs are the spread's; the compass is the
bays'. **On a phone no pane has a close: a pane leaves its bay when the player navigates something else into
it.**

**A conversation's scene is the whole of its pane, in every state**, cropped to the pane's shape: a narrow
slice of the picture in the tall column on a desktop, most of it at half a phone. The conversation is drawn
over it, so the scene takes none of the room the lines are read in.

**A line of a dialogue that shows something is a way on the conversation takes rather than the player**, and
it follows the same rule: in the spread the camera moves beside the column or the window opens in the rail,
and in the bays the map or the window goes into the bay the conversation is not in. One thing more, Adam's
word: **the two go to half each** when the conversation had the stage opened out, because a thing shown in a
strip is not shown and the conversation is what the player was reading. It is the third thing that moves the
seam without being asked, after a letter and a window arriving, and for their reason: the world put it
there.

## The way between panes

**The compass in the corner is the way to everything else.** It stands in the stage's bottom right corner
and is in the same place however the split moves - it rode the divider until 0047, and the divider is the
one thing on the stage that moves. One tap puts **navigation** in the bay under the thumb, which is the
bottom one on a tall phone and the right one on a wide one, and navigation lists the panes above a divider
and the **trail**, where the player has been, below it. It **never resizes anything**, which is what lets
it land in a strip. See decision records 0043 and 0047 and `LOOK-AND-FEEL.md`.

**Put away, navigation is still a way somewhere**, which is the second stated exception to minimised being
just a name: its strip carries the marks of the panes it could put in the other bay, because a list of ways
on is what it is for and this is the strip a player arrives in by pressing the compass.

**Every row carries a needle to the other bay**, so any pane can be put in either and the one it is already
in is marked rather than taken away. **No pane is privileged there**: none is pinned where it is, and which
bay two panes share on a desktop has nothing to say about where either of them can go on a phone. In the
spread navigation is a tab in bottom left instead, a row there is a plain click, and put away it is its
name and nothing else, because there are no bays to send anything to.

## Container queries, not breakpoints

**A media query cannot see the stage.** The stage is a containing block, and it is 390 wide inside a window
that is 1280, so a breakpoint asking the window never fires. Anything inside the stage that reacts to its own
room uses a **container query**. The one exception is the fold itself, which is arithmetic on a measured size
in a module of its own, the way `stageBox.ts` already is.

This is a real constraint and it is the right one: a component that only reads correctly when it happens to
be the whole window is exactly what the rule at the top exists to prevent.

## The instrument

**Two toggles in the very top right of the debug panel confine the stage to a phone**, upright and in
landscape — 390 by 844, and the same turned. The landscape one is the only way to see the stage cut into a
**left and a right** rather than a top and a bottom, and the only shape short enough to find out whether a
pane lives in 390 pixels of height.

**The phone toggle confines the stage to 390 by 844.** The stage
is the box the player's interface is laid out in, and the panel takes room from it rather than floating over
it. Two grips resize it to anything in between. So the rule above is checkable while a component is being
written, at one click, on whatever monitor there happens to be. See decision record 0039.

**Dragging the side grip slowly across 600 is the test that matters.** It is the one thing that cannot be
faked: the layout folds and unfolds in place, and whether it does so gracefully is a thing to be looked at
rather than asserted.

**It folds at 600 and unfolds at 660**, which is not the same number on purpose. One threshold makes the
boundary a cliff, and a grip resting on it flickers between two whole layouts; sixty pixels of dead band
means the width that folds it is never the width that unfolds it. In between, the stage keeps what it had.
See decision record 0041.

**The debug panel is not in the picture.** It is Adam's instrument rather than a player's and does not get a
phone layout: it is the frame the phone is looked at inside, docked down the right and taking room from the
stage. The worktree tabs and the build badge are inside it for the same reason.

What the instrument found, and where each stands:

- **A breakpoint asked the window**, which is 1280 while the stage is 390, so it never fired. **Fixed**, by
  decision 0044, which deleted it and left no `@media` rule anywhere in the app.
- **A strip turned on its side dropped its name.** There is no room for a word across 44 pixels, so a
  put-away pane in landscape was two marks and nothing saying what it was. **Fixed** by decision 0046,
  which turns the name to read down the strip instead - there is eight hundred pixels of room along one.
  It was the floor's strip that forced it: that strip is its own way back and carries no marks, so dropping
  the name left a blank bar.
- What it found in particular panes is in their UI sections in `MECHANICS.md`.

## Not decided

- **Touch.** The one question the layout above does not answer, and the next thing this document owes.
  Things lift on hover and the map is driven by drag and wheel; neither has an answer on a finger. The
  compass, the needles and the tabs were drawn as taps rather than hovers on purpose, which is a start and
  not a design.
- **Whether 600 and 660 are right.** Two numbers somebody picked, not derived from anything: the first is
  where it folds and the gap between them is a guess about how fast a grip moves. Both move once there is
  enough at the boundary to judge them by. Two constants, in one place.
- **Whether a player can drag the split** after all, over the top of minimise. Nothing forecloses it.
- **What happens when a third thing wants the screen** on a phone. Two bays and three claimants is a queue
  nobody has designed.
