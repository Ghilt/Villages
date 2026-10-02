# 0074. A stored event is read as it was written

- Status: accepted
- Date: 2026-10-02

## Context

`HouseFounded` carries a stock of every resource and `CharacterAppeared` every stat, and both checked, as they
were constructed, that they carried exactly the resources and the stats there are: `Resource.entries` and
`Stat.entries`. A new event is complete by construction, so the check only ever ran when a stored event was read
back - and there it could only ever refuse. The day a sixth resource or a fifth stat arrives, every founding and
every appearance in the store would stop being readable, and every house and every character with them. Before
the world-persistence milestone that is a wipe; after it, an upcaster for every one of those events, written to
add a key nothing would have missed.

The review of 2026-10-02 found it. Nothing has tripped it yet, because nothing has been added.

## Decision

**A stored event is read as it was written, and never refused for what the code has learned since.** The two
checks leave the events. The folds fill in what an event written before an enum grew could not have known:

- a resource missing from a founding is an empty stock standing still, as of the founding, `everyStock`, because
  the house never had any of it;
- a stat missing from an appearance is the middle of the scale, `UNRECORDED_STAT`, 10, through `everyStat`, until
  somebody decides otherwise when the stat arrives - which is a decision about the game, and Adam's.

Both are functions rather than properties of the events, so Jackson writes nothing new into the store, and all
four folds use them: the house's, the character's, and the two read models built from those events. The rule
that a new house has every resource and a new character every stat stays where it always was enforced in fact,
where they are made: `emptyStocks` and `IntroduceCharacter`'s own check.

## Consequences

- Growing `Resource` or `Stat` is not a change to the events that carry a map of them, and needs neither a wipe
  nor an upcaster.
- The default for a stat is a guess, chosen to be harmless, and the day a stat is added is the day to choose it
  properly. A stat that should start somewhere else for those already in the world is one constant.
- A value that is removed from an enum is a different matter: the store would hold a key the code no longer
  knows, and that stays a change to the event.

## Alternatives considered

- **Keep the checks, and upcast when the time comes.** An upcaster per event per enum, for a key whose absence
  has an obvious meaning, is cost for no information.
- **Make the stats nullable, unknown until set.** Every reader would have to ask, and there are many; a default
  in one place is simpler and can be revisited.
