# 0004. The first choice

- Status: open
- Started: 2026-09-15
- Closed:

## Hypothesis

Offered three seats on a parchment lying over the map, with no other instruction, a new player founds a
house within a minute and can say afterwards why they chose the seat they did.

If that is wrong, a choice is not enough of an opening on its own and the first parchment needs more
around it: a reason to prefer one place, a look at the ground, a name to weigh.

## Setup

The first gameplay loop, increments 1 to 8 of `docs/plans/2026-09-15-first-gameplay-loop.md`: a
player who says hello with no house is given three seats in three regions, each with a name and a
banner; the parchment shows them with one button each and folds to a corner; three marks on the map
show where they are; taking one founds the house there, the camera flies to it, and the house is a
castle with a fence of ground about it that can be selected and read in the inspector. A restart
button starts a player over, and a wipe empties the world. Nothing else: no second choice, no
resource that changes, no other house to meet.

## What we will look at

The experience:

- Does the player read the three options, or press the first button?
- Do they fold the parchment and look at the map first, and do the three marks make them pan to them?
- How long from the parchment appearing to the action taken?
- After the flight, what do they do: click the castle, pan away, or wait for something?
- Asked why that seat, is the answer about the place, the name, the banner, or nothing?

The architecture, answered in passing:

- Do the three events of one founding read as one story in the debug panel, with nothing else needed
  to see that they belong together?
- Does a hello that gives a choice, an action that founds, and a projection a moment behind ever leave
  the browser with a stale parchment or a missing house?
- Does the wipe leave anything behind: a session, a cell held, a row?

## Observations

**2026-09-15, the loop is built and nobody has played it yet.** The experience half of the hypothesis is
Adam's to observe; what follows is the architecture half, answered in passing while building it.

*The three events of one founding do read as one story.* The panel shows `house given choice`,
`house took action`, `house founded`, in that order, at stream versions one, two and three, wearing one
correlation tag. Nothing else was needed to see that they belong together, and the causation id on the
last two is the command id on the line above them in the log. Decision record 0035 earns itself here.

*The race between a hello and a projection is real, and the fix is to hand back what you wrote.* Giving
the choice writes an event; the projection that would answer "what is pending" folds on another thread.
Reading it in the same breath as writing it sometimes says nothing. `Arrival.arrive` returns the choice
it gave and the gateway sends that, and the projection's own word arrives later and is recognised as the
same choice rather than sent twice. The guard for that is `tellChoice`, and without it a player was told
the same thing twice on arriving.

*Whether a house is new cannot be read off a stream version any more.* It used to be that version one
meant a house had appeared. A house founded from a parchment arrives at version three, behind the choice
it was given and the action that took it, so the read model now says whether its put was a new row. A
rule that was true by accident stopped being true the moment one command wrote more than one event.

*A rule in a projection is a rule the interface has to respect too.* A new house has the founding
significance, which `coarsestZoom` makes zoom eight: below that the map is not told about it at all. The
flight to a new seat stopped at seven and landed on empty ground. The number was not wrong; the interface
did not know about it.

*The store gave no hook for the envelope, so the loop became ours.* Occurrent's decider extension does
read, fold, decide and append, and offers no way to put anything on the CloudEvent it writes. Provenance
has to go there, so those four steps are twelve lines we own now, retry included. Nothing above the ports
noticed.

*Naming the events for whose they are was worth doing and cost nothing.* The first cut called them
`HouseGivenChoice` and `HouseTookAction`, which put the mechanics of play in the same family as the
world's own happenings. They are `PlayerGivenChoice` and `PlayerTookAction` now, typed
`villages.player.*`, and the split is a type in the code as well as a prefix on the wire. Renaming two
event types is a breaking change under decision record 0011; it cost nothing at all, because the store
is in memory and nothing written before the change outlives the process that wrote it. That will not be
true after the world-persistence milestone, which is the point of naming the milestone.

*Two tests sharing one in-memory world share a player.* `HouseId.of(player)` means one token is one house
across a whole test class, so the second test to run found a house already standing. Each test needs a
player of its own, which is obvious in hindsight and was not.

## Result

## Decision

## Follow-ups

Open, in no order. The first two are the ones the loop asks for next.

- **A second kind of choice.** Everything above the effect is generic now, so the cost of one is an
  `Effect` case, a `decide` branch, a giver with the words, and rows for whatever it records. Until a
  second one exists, `docs/MECHANICS.md` is a claim rather than a demonstration.
- **A reason to prefer one seat over another.** Three places, three names, three banners, and nothing to
  weigh them by. Whatever the answer is - the ground, the neighbours, what a house would be good at
  there - it is the first thing that makes the opening a decision rather than a pick.
- **The seed takes one of its offered seats** instead of founding directly, so the bot swarm exercises
  the real loop and a seeded world is made of the same events a played one is.
- **The house card in the corner is still a mock.** It says "No house yet" while the inspector beside it
  names the house; roadmap 1.12 draws the banner, and this is where it goes.
- **Seats as authored data.** `world/seats.json` beside the other world files, so the gazetteer is
  Adam's to paint rather than the server's to hold. Decision record 0034 names this as the next step.
- **A chronicle view.** The debug panel's event list already carries the story tag; grouping by it would
  turn the log into what the vision calls a chronicle, and would be the first thing a player reads
  rather than an instrument.
- **The world's own port per worktree**, the way the web port already is, so a tree's backend address
  never moves and no `.env` file has to be written by hand.
