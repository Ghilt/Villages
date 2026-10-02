# 0010. A key figure is a tie

- Status: open
- Started: 2026-09-24

## Hypothesis

**Being a key figure can be a tie a house keeps rather than a kind of character.** A character's own history
never changes when a house takes them in; one character can be tied to two houses without either house's
history mentioning the other; and the next kind of tie a house can have to a person will change nothing
about the person.

It is wrong if a rule about key figures has to read a character's record to decide, if a field appears on
the character that only a key figure uses, or if the second kind of stream needs a parallel copy of the
machinery the first one runs on.

## Setup

The groundwork in `docs/plans/characters-and-key-figures.md`, shaped by decision record 0055: characters as
streams of their own, the tie in the house's history, the listener for character deaths to carry a death
across, and the key figures pane in the corner. No mechanic gives a house a key figure. The debug panel's
Characters section does, and it is the only way to make one.

As little as possible: no succession, no old age, no key figures from choices, no second tie of any kind.

## What we will look at

**The architecture**, answered as the steps land:

- Whether the second kind of stream costs one generic executor and no special cases, or grows a parallel
  stack beside the house's.
- Whether the nine and acting through are decided against the house's own stream alone, without reading the
  character's.
- Whether the listener for character deaths stays the only thing that carries a character's history into a
  house's.
- Whether two houses tied to one character, and a death reaching both, pass as tests without either house
  knowing the other exists.

**The experience**, by eye:

- The pane at all six phone states and in the spread, with none, one, two and nine key figures, and across
  the fold with the side grip.
- Whether nine faces read as nine people in a corner 288 pixels wide.
- Once there is art, whether faces make a house read as a family rather than a banner.

## Observations

**2026-09-24, the documents are written and nothing is built.** Two things came out of writing them down.
The documents had planned for the key figure to be the aggregate, which would have made a role into a
person; and a sentence in decision 0053, "a real year is a world year", was wrong about its own clock, which
matters here because at a month a real day a key figure ages a year every twelve real days.

**2026-09-24, built through step nineteen.** The architecture's four questions have answers.

- **The second kind of stream cost no parallel stack.** One executor loop, one converter and one type table
  serve both kinds; the only thing doubled is the port, because a fake cannot implement one generic
  interface twice on the JVM.
- **The nine and acting through are decided on the house's stream alone.** `TooManyKeyFigures`,
  `ActThrough` and the room check read the house's own ties and never the character's record, and a lever
  on somebody else's key figure is refused before the character's stream is touched.
- **The listener for character deaths is the only thing that writes a character's history into a house's.**
  The characters projection reads both kinds of stream, and writes nothing.
- **Two houses tied to one person, and a death reaching both, pass as tests** (the specs of the listener
  for character deaths and of the projection) without either house's history mentioning the other.

No field appeared on the character that only a key figure uses. What a key figure has that a character
does not - the stats on the owner's view - is a view, not the record. Two things bent. A character is the
first thing on the map that moves, so the wire needed a way for a thing to **leave** a cell, which a house
never did; and the first map view of a character left out the birthday its age is counted from, which
version 8 put back.

By eye, in the running program: the pane at its three sizes in the spread and at half and opened out on a
phone, upright and turned, with none, one, two, eight and nine key figures; the strip turned with a name
written down it; the corner opened out beside a letter that folded to its carousel. **Not checked:** across
the fold with the side grip, and a click on a figure on the map, because the browser pane was not displayed
and the map would not finish loading without it. Nine faces fit a corner 339 pixels wide as portraits 44 by
59; whether they read as nine people is Adam's eye, and the placeholders make it harder than art will.

## Result

Open: the architecture's half is answered above, and the experience's waits on Adam's eye and his art.

## Decision

Open.

## Follow-ups

Open.
