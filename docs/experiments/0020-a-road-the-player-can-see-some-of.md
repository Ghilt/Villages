# 0020. A road the player can see some of

- Status: open
- Started: 2026-10-15

## Hypothesis

**A quest can be offered whole and walked a node at a time on the house's own history, with what it costs and
gives as the house's own events, its forks lost for good and its question marks kept on the server, and read
as a road to plan rather than a list of chores.** A quest picked up again stands where it was left; a reward is
paid once on whichever road led to it; a fork loses the other road as one event a node and never reaches it;
an objective the world meets is ticked without the player asking; a new kind of objective costs only its own
case; and a map of seals over a scene, some question marks and one far down already in view, makes the player
want to see what is under them.

It is wrong if a quest reopened ever stands anywhere but where it was left, if a reward is paid twice or not at
all on any road, if a lost node can still be reached or is ever lost twice, if a page is ever sent what is
behind a question mark, if a castle held on an island is not ticked within a moment or a castle elsewhere is,
if a second kind of objective the world meets needs anything in the listener but one branch, or if, by eye,
the map reads as a to-do list rather than a road.

## Setup

The build in `docs/plans/quests.md`, shaped by decision record 0096: a quest offered whole on the house's
stream; its moves, its ticks and its lost nodes recorded, and how it is drawn worked out by one walk; the
objectives the player meets paid in the house's own rules, and those the world meets ticked by one listener;
the server taught what an island is; and a tab of the right column beside the dialogues. Nothing in the world
offers a quest. The debug panel's Quests section does, with one sample written in the server, *The abbot of
the isle*.

As little as possible: one sample, three kinds of objective, forks only at a dialogue node, no quest from a
roll, no quest turned down or abandoned, no cause shared between houses.

## What we will look at

**The architecture**, answered as the steps land:

- Whether both roads of the sample pay the blessing once, and a resent tick or collection writes nothing twice,
  as tests.
- Whether a fork writes one `lostQuestNode` for every node it cuts off, and the walk never allows one.
- Whether the page is ever sent a node it should not draw, or the contents of a question mark.
- How long a castle held on an island takes to be ticked, and whether the race with losing it ever shows.
- How many land masses the fill finds on the master, and where the smallest continent and the largest island
  fall.
- Whether a made-up second kind of world-met objective costs the listener one branch.

**The experience**, by eye:

- The map over its scene at the column's three sizes and on a phone, with the sample at its start, on each
  road, and finished.
- Whether a question mark half-way down with two edges in reads as something coming.
- Whether a road crossed out, shown for what it was, reads as a choice that cost rather than as an error.

## Observations

**2026-10-15, the documents are written and nothing is built.** Planning moved four things. A resource
objective is handed over rather than ticking itself, because a stock grows with nothing written and no event
marks the moment it passes a number. A reward is collected by a press. A lost node is its own event, on Adam's
word, rather than worked out from the graph. And *revealed*, Adam's word in the brief for a question mark
showing what it is, is already the fog's, so a quest's node is *shown for what it is* instead.
