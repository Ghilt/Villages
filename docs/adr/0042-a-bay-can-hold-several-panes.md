# 0042. A bay can hold several panes, and the trail remembers where you have been

- Status: accepted
- Date: 2026-09-19

## Context

Decision 0041 gave the spread three tiles and a floor, and the column down the left has room for two things:
a rail of inspect windows above, and the house status in the corner below. That was all there was to put in
it. There is now a second thing that belongs in the corner — **navigation**, the way back to what has been
looked at — and a column has no room for a fourth tile.

The wider problem it stands for is that **there will always be more panes than tiles.** Character dialogue
is written down and coming; the choice roll wants the bottom middle; every mechanic after those will want
somewhere. A layout that grows a tile per pane is a layout that runs out of screen, and one that stacks
them is the overlapping furniture 0041 removed.

Adam's answer, in his words, was a tab bar: "a ui component we will utilize in some of these panes are the
concept of a tab bar. a tab bar can show different panes in the same space."

Navigation also needs something nothing on the stage has: **a memory of what has been looked at.**
`subjects.ts` holds what is *open*, three at most, and forgets a window the moment it closes — which is
exactly the wrong list, because the useful ones are the ones no longer open. `ARCHITECTURE.md` had already
written down what that memory should do, in one line: a trail that empties itself is not a trail.

## Decision

**A bay can hold several panes, and a tab bar says which is up.** The bay stays one rectangle; the panes
take turns in it. Everything 0041 built is untouched — the tiles still never overlap, and the arithmetic
learns only that a shared tile is `TAB_BAR` taller than whatever is in it.

**The panes declare that they share, and the layout never decides it.** A pane already said which tile it
sits in; two panes naming the same tile *is* a tabbed tile, and nothing else is needed. This is deliberately
not what `ARCHITECTURE.md` first guessed — that the layout would merge panes into a tab when they no longer
fit. That version makes the tabs appear and disappear as the window is dragged, which is the jerking 0041
exists to prevent, and it makes a pane's neighbours depend on the size of the screen.

**The tile is as tall as the pane that is up**, not as the tallest of them. A tab nobody can see is not
taking any room, and sizing the corner by something hidden would leave a band of nothing under whichever
pane is shorter.

**Tabs are marks and no words.** The column is 26rem at its widest and 18 when squeezed; two words on a tab
is a tab that wraps. Every pane declares the mark it is known by, drawn in one place so that the same thing
on a tab, in a list and wherever a pane is named later cannot drift apart. **The compass is the arrows'
needle inside a ring**, because the arrows say which bay a thing opens into and the compass opens the pane
that lists them — they are one family and should look like it.

**Only in the spread.** A phone reaches the same panes through the compass, because a row of tabs on a
390-wide stage is a row of things too small to hit. That is the next step and it is where the kebab becomes
a compass.

**The trail is what has been looked at, and it survives a reload.** Twelve steps, newest first, one entry per
thing however often it is looked at. It is the only thing on the stage that comes back from a previous page
load, and the asymmetry is the right way round: *where the panes are* is where the player is standing, which
a layout should not remember, and *where they have been* is the opposite.

**A step keeps the name it was looked at under.** The trail outlives what it points at: a house that has
left the cells this page holds has no name to look up, and "a house" is not a way back to anything. So the
name is recorded by the **window**, which is the only thing that knows one — a name is the description's,
and a description is what turns a subject into words.

**Navigation in the spread is the trail and nothing else**, because everything a player might navigate *to*
is already on the screen: the map is the floor and the house is behind the other tab. What is not on the
screen is exactly what has been closed, which is the trail.

## Consequences

**The corner opens on the house status**, because it is declared first and what a player wants on arriving
is their own house rather than a list of the nowhere they have been.

**The house card had to give ground.** At the column's squeezed width a house called Ravenscar fit with
nothing to spare, which means the next house over did not. The shield, the padding and the name all give a
little under a container query, and a name too long for any of that now truncates rather than breaking the
card. That the defect showed up at all is 0041 working: the card is a tile with a width that is not its own
to decide.

**Something persists that did not before**, and it is worth being explicit that this is the exception. The
phone toggle and the folded sections are Adam's and live in `debug/stage.ts`; everything else on the stage
is forgotten on reload on purpose. The trail joins that short list, and the reason is written into its
module so the next person does not undo it.

**What comes back from storage is not trusted.** It is the one input to the stage that a previous version of
this code wrote, and the shape of a `Subject` has already changed once. Anything that is not a step is
dropped rather than rendered, and a browser that refuses to remember is not a failure — the trail is a
convenience, not state.

The cost taken knowingly: **a tab is a place a player has to look.** A pending choice behind a tab is the
world asking something the player cannot see, which is why the choice roll is going in a tile of its own and
not into this one.

## Alternatives considered

**A tile each.** What 0041 would have done: give navigation its own rectangle. It loses immediately — the
column has two tiles and four things already want to be in it, and the next mechanic makes five.

**The layout merges panes into a tab when they stop fitting**, which is what `ARCHITECTURE.md` guessed.
Rejected above: it makes the tabs appear and vanish as the window is dragged.

**Navigation as a menu rather than a pane**, opened from a button and closed on picking. Fewer moving parts,
and it is what the kebab already is. It loses on the phone, where the whole point is that navigation
*occupies* a bay so the map stays on the screen beside it — and a pane that is a menu on one form and a pane
on the other is two designs, which is what `RESPONSIVE-DESIGN.md` exists to prevent.

**Keeping the trail in memory only.** Simpler, and consistent with everything else on the stage. It loses on
what the list is for: a refresh is not a decision to forget where you have been, and a Recent section that
is empty every time the page loads is a Recent section with one thing in it.
