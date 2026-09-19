# 0036. Starting over: a player forgets who they were, and a development world can be emptied

- Status: accepted
- Date: 2026-09-15

## Context

Trying the first gameplay loop means being a player who has just arrived, many times an hour. A player
is a token in the browser's local storage (decision 0008), and the house is worked out from the player
(0028). Events are never deleted. Decision 0011 allows the event store to be wiped rather than migrated
before the world-persistence milestone, and asks that every such wipe be recorded in the experiment
journal.

Adam asked for a restart in the debug panel that removes all progress and starts a player over. Asked
which of two things that meant, he chose both.

## Decision

**Restart: the player forgets who they were.** The browser blanks its player token and reloads. It
says hello as a new player, who has no house and is given the founding choice at once. The house the
old player founded stays in the world as somebody's, because nothing is deleted; from the new player's
seat it is one more house on the map.

**Wipe: the development world is emptied.** A debug frame, `wipeWorld`, asks the gateway to empty the
event store and every projection. Every session is then told `worldWiped` and finished, the way a
session taken over is stood down; each browser notes it and reloads, and arrives as its player anew,
with a fresh founding choice at stream version one. Nothing about a session survives a wipe, and
nothing about a player does either, except the token in the browser.

**This is not the wipe of decision 0011.** That one is forced by a change to an event, on a world that
had players in it, and its record belongs in the journal because something was learned. This one
empties an in-memory world that dies at every restart of the server anyway, from a button that will be
pressed many times a day; its record is the line in the debug log.

Both are buttons in the debug panel, beside `copy` and `reset`, without a confirmation: the log line
says what happened, and the panel is Adam's window and not a player's (decision 0023).

*Amended 2026-09-19:* the panel is sections now, and these two are in the **World** section rather than
beside `copy` and `reset`, which are the log's. Where they sat was where the buttons happened to be;
both of these are about the world or the player beginning again. Still no confirmation on either, and
still the log line as the record. See decision record 0039.

## Consequences

The loop can be tried from nothing in one click, and a second browser can watch the first arrive.

Restart leaves abandoned houses behind. That is honest, a house nobody plays is a thing the world will
one day need a word for, and 0024 lists the question; until then a wipe clears them.

`wipeWorld` is a privileged frame with no authentication, on a gateway that trusts tokens and holds
nothing valuable (0008). It is acceptable exactly as long as that is true. Before the world-persistence
milestone it goes, or gains a guard, and this record is superseded when it does.

The projections gain a `reset`, and the in-memory world a `wipe`, that nothing else calls.

## Alternatives considered

- **Only restart.** Enough for one player; leaves the world filling with the houses of every trial.
  Adam wants both.
- **Only wipe.** One player's trial should not empty everyone's world; two people trying the loop at
  once would keep resetting each other.
- **An HTTP administration endpoint for the wipe.** A second surface to keep alive, for one viewer. The
  debug panel is already the protocol's second consumer (0023), and a frame is tested by the same
  gateway specs as everything else.
- **Restart by clearing site data in the browser.** Works today, and it is the browser's chrome rather
  than the program's, so it cannot be read in the log or done in one click.
