# 0043. The compass puts navigation in a bay, and every pane is equal in it

- Status: accepted
- Date: 2026-09-19
- Superseded 2026-10-08 by 0109 on a phone: the compass goes, a bar of marks chooses the bottom pane, and
  navigation is Recent alone. A pane is no longer equal in either bay: the top is the map's and the windows'.

## Context

Decision 0040 put a **kebab** on the seam between the two bays. It opened a menu listing every pane, each
row carrying **the arrows** so the player said not only which pane but which bay. Decision 0042 then built
**navigation** as a pane in its own right, with the **trail** in it, and gave the spread a tab bar to reach
it from the corner.

That left the phone with two answers to one question. The kebab listed the panes in a menu floating over the
world; navigation listed the trail in a bay. Two lists, two gestures, two things to learn, and the menu
covered the map it was for.

Adam said which one wins, in his words: the kebab "should be replaced with a stylish compass icon instead",
and "pressing this compass will replace the bottom/right pane in phone mode with the navigation pane".

He also chose what a row carries, when asked whether the needle is a choice or a label: **one needle on the
phone, a plain click on the desktop.** Built and looked at, that answer turned out to be wrong in a way the
question had not exposed. With one needle a row can only land in the bay navigation is standing in, and a
pane that is **already up** cannot be moved at all — so the map was pinned where it was and the house could
only ever open at the bottom. Adam's words on seeing it: all panes should be equal, and if they share a bay
on a desktop that should not matter.

## Decision

**The compass replaces the kebab, and it is not a menu.** One tap puts navigation in a bay. A menu is a
thing to read and then act on; this is one gesture, and what it opens is a pane like any other rather than a
list floating over the world. On a phone that matters twice over — the map stays up beside it, and a menu
that covers what it is about is a menu you have to dismiss in order to use.

**It takes the bay that is not the map's**, for the reason a clicked castle does: what a player wants next is
somewhere to go, and putting the list over the world would hide the thing they are navigating. Adam said
"the bottom/right pane", which is the same bay in the arrangement the stage opens on; reading it off the map
rather than off the number keeps his intent when the player has swapped the two.

**Pressing it again gives the bay back** to whatever navigation took it from. It is a toggle, not a door.

**Navigation has two forms, and it is the same difference as everywhere else.** In the **bays** it lists the
panes under a *Go to* heading, then a divider, then the **trail** under *Recent*. In the **spread** it is
the trail alone, because every pane a player might go to is already on the screen — the map is the floor,
the house is behind the other tab — so what is not on the screen is exactly what has been closed.

**Every row carries the arrows in the bays, and none in the spread.** A pair and not one: the player says
which bay, and the bay a pane is already in is **marked rather than taken away**, so anything can be moved
anywhere. In the spread a row is a plain click, because there are no bays to choose between — the same rule
that already drops the arrows from an inspect window's links there.

**Every pane is equal in the list, and the spread has no say in it.** The map is not pinned where it is, the
house does not open only at the bottom, and navigation itself is on the list so it can be moved off the bay
it is standing in. Which bay two panes share on a *desktop* is a fact about the spread — it is why the
corner has a tab bar — and it says nothing about where either of them can go on a phone.

**The needle is one drawing, turned**, and a pair of them is the arrows, which is what a row carries. It was
duplicated between `Arrows.tsx` and the compass mark and is now in one place, because a mark that is redrawn
is a mark that drifts.

**The compass is a full compass rose**: four cardinal points filled, and four between them drawn rather than
filled so that it reads as eight points and not as a blob at the size a tab draws it. It was a needle inside
a ring, which is a compass only to somebody who already knows it is one.

**A thing that has stopped existing leaves the trail with it.** An area the player deleted is not a way back
to anything, so the window that tidies itself away tidies the trail too. A house merely out of the cells this
page holds is the opposite case and stays: it still exists, and the window already knows how to say so.

## Consequences

**The kebab is gone**, along with the dismiss-on-click-outside and escape handling a floating menu needed.
A pane in a bay needs none of it.

**Navigation is now reachable three ways** and they are one thing: the compass on the seam in the bays, the
compass tab in the corner in the spread, and a row in navigation itself pointing back. The mark is the same
in all three.

**The arrows in a list are a row tall, not a glyph tall.** Two hit targets per row on a 390-wide stage was
the worry that made a single needle attractive, and it is answered by making them 32 pixels rather than by
taking one of them away.

The cost taken knowingly: **two targets per row is more to aim at than one.** It buys the thing one needle
cannot — every pane reachable in either bay — and a list whose rows are not all the same shape is a list
where the player has to work out which rows are the special ones.

## Alternatives considered

**Keep the kebab and add the compass beside it.** Two controls for two jobs: the kebab to place a pane
precisely, the compass to open navigation. Rejected because the jobs are the same job, and a phone's seam
has room for one round button, not two.

**The compass opens navigation as an overlay** rather than putting it in a bay. Less disruptive — nothing
gets displaced and nothing has to be given back. It loses the thing the two-bay form exists for: an overlay
covers the map, and the whole argument of 0040 is that the thing being talked about and the thing it is
about belong on the screen together.

**One needle per row, pointing at where it would land.** Adam's first answer, and what was built first. It
reads well and it halves the targets, but it cannot say *put that one over there*: a pane already up is
stuck, and everything else lands in the same place. Tried, looked at, and replaced by the pair above.
