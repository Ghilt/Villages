# 0023. The debug panel is Adam's verification instrument, and it shows the events

- Status: accepted
- Date: 2026-09-04

## Context

Adam does not read the code. Decision 0009 makes him the one who vets every change, and the working
agreement says the primary verification loop is a running program he can look at. For the map that has
worked, because a map is its own evidence. For everything from here on it will not: a command accepted,
an event stored, a projection updated, a delta fanned out to a second browser, none of it is visible on a
map until much later, and a screenshot cannot show that an event was stored with the right cell on it.

The debug panel began as a way to say what the renderer was doing so it could be pasted into a
conversation. Adam's instruction, on seeing it, was that it has to grow: it is how he will check what the
program does, and the first thing it needs to show is the events.

## Decision

The debug panel is a first-class verification instrument, not scaffolding, and it grows with the program.

- **Every increment that adds behaviour makes that behaviour visible in the panel.** The definition of
  done gains a line: what the increment does can be seen there. A behaviour the panel cannot show is a
  behaviour Adam cannot verify, and so is not done.
- **Events are shown simply, and expandably.** As the walking skeleton lands, the panel shows the domain
  events reaching the browser as one short line each, in order, in words: what happened, to which house,
  when. Each line opens to the whole thing, every field of the CloudEvent as stored, so that "simple" is
  the default view and never a ceiling.

  *Amended 2026-09-15:* this is true of the events but no longer of the panel. They moved to a page of
  their own, `/admin/inspect-events`, because a log wants a column and the panel is a corner of a map.
  The page watches without playing - it sends no hello, so the gateway knows of no player there and
  opening it neither founds anything nor takes a window over - and the game window stopped asking for
  raw events at all. Everything else here stands.
- **The panel must never lie.** Its frame-gap figure once reported seventeen-second stalls that were the
  page being hidden. A figure that can mislead is worse than no figure, so every number in it says what it
  measures and is checked by a test where there is arithmetic to check.
- **It stays out of a player's way.** It minimises to a chip, remembers that, and is not part of the
  interface a player will have. It is Adam's window, and a session's, and that is enough.
- Anything the program has to say goes through `note(area, message)` so it can be copied out in one
  click. The copy is how Adam tells a session what he sees.

## Consequences

Verification without code. Adam can watch a house being founded as a line in the panel, open it, and see
the event exactly as it will sit in the store, and paste that into a conversation when something is wrong.

Every increment costs a little more, because the panel is part of it. That is the price of being checked
by someone who is not reading the diff, and it is cheaper than the alternative, which is behaviour nobody
can see.

The panel is a second consumer of the protocol, after the map. Anything the gateway sends is something
the panel can show, which is a good discipline for the protocol too.

## Alternatives considered

- **The browser console.** Where the first attempt at this went. Unreadable to anyone but a developer,
  not copyable without devtools, gone on a reload.
- **Server logs.** Invisible from the browser, and the browser is where Adam is.
- **A separate admin application.** Possibly later, when there is more than one person looking. Today it
  would be a second app to keep alive for one viewer, and the panel already sits on the map it explains.
- **Leaving it as scaffolding to be removed.** What the code comments said until now. Wrong, because the
  person doing the vetting needs it more, not less, as the system grows.
