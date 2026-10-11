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

*Amended 2026-10-02:* the wipe empties every `Resettable` there is, which every read model and every
listener acting on its own is, rather than the list of them it was handed. The list had left out the pledge
release, whose wake-ups planned before a wipe then asked a house that was gone, or a new one founded by the
same player, for a pledge it never made. Such a wake-up now does nothing. See `Follower` in `ARCHITECTURE.md`.

*Amended 2026-10-11:* **the wipe is one moment that nothing written crosses**, and it says what that guarantees.
The feed hands an event on, on a thread of its own, a moment after it is written, and the wipe emptied the read
models without waiting for it. So an event written just before a wipe could reach a read model after it had been
emptied and be folded into the new world, where the event page showed it, or set a reaction off there: once
founding raised a castle a few milliseconds later, that was a castle for a house that no longer existed. Now
every command is run outside a wipe, `WipeGate`: a wipe waits for any under way, and holds any new one until it
is done. Inside it the streams go; then it waits until the feed has handed every subscriber everything it still
had for it, all of it written before the wipe because nothing could be written during it; and only then is every
`Resettable` emptied. A reaction checks that its plan is of this world and issues it in one step outside a wipe,
and a follower reads the history outside one. What a wipe guarantees, then:

- nothing written before it is folded into the world after it, or sets a reaction off in it;
- nothing written after it is forgotten with the world before it;
- whatever a reaction was issuing when it began is finished first, and goes with the world it was written in;
- the count it reports is every event it removed, because no event is half written while it counts.

Waiting, rather than marking each event with the world it was written in and having every follower drop the old
ones, because the in-memory store gives each event to every subscription as it is written and counts how many each
has still to hand on, so the wait is exact and between wipes costs a lock nobody waits for. A mark would be on every
event and checked in every fold, and the read models would still be emptied on one thread while they folded on
another. A subscriber that has not handed on what it has after ten seconds is stuck, which is said as a fault,
and the wipe goes on without it rather than leaving the world half emptied. `WipeSpec` holds the first three.

What it does not make whole is an action of several commands sent from a window. Taking a key figure in asks the
house for room, writes the newcomer, and then takes them in, and a wipe can still fall between two of those and
leave the newcomer standing alone in the new world. Each command is whole and the action is not; making it whole
would take the gateway handling each frame outside a wipe.

*Amended 2026-10-11, when the world went into MongoDB (0092):* the wait above is the in-memory subscription model's
own, and MongoDB's change streams have nothing like it. So in MongoDB the wipe writes one **marker** once the
streams are gone, an event of the feed's own on a stream of its own, which a change stream hands each subscription
after everything written before it; the wipe waits until every subscription live then has been handed it, and only
then empties every `Resettable`. The marker is handed to no subscriber and is deleted however the wait ends. It is
not the mark on every event turned down above: one event, written by a wipe and gone with it, and nothing folds it.
The same ten seconds, and the same fault when a subscription never gets there. `MongoWorldDockerSpec` holds the
first guarantee against a real MongoDB, and fails without the marker.

*Amended 2026-10-11, the same day:* **a world that outlives its server can hold events this code cannot read**,
and the wipe is the answer to that too, until the world-persistence milestone brings versioned events and reading
the old ones. Two kinds. An event of a shape the code has since changed - a field renamed or gone - which nothing
can fold, so the house whose history holds it refuses every command; and, rarer, one the store itself cannot read
back, left by a hand edit or a change to how the store writes, which stops a reading of the history there. So:

- **The server reads its whole world once as it starts**, tries every event as it would fold it, and says what it
  could not read: in its log, and to every window that says hello while the instruments are open, as the debug
  panel's line `error unreadableEvents`, which names the first and says to wipe. A wipe leaves nothing unreadable.
- **A follower whose history stops at an event the store cannot read back starts anyway**, and says so as a fault,
  because a server that cannot start is a world that cannot be wiped.
- **In MongoDB the wipe counts and deletes without reading an event back**, so a world holding one the store cannot
  read can still be wiped.
- **A subscription that fails is started again for ever while the failure is MongoDB's own** - a connection lost, a
  restart - because those heal, and **at once given up on otherwise**: an event it cannot read back fails the same
  way at every restart, which Occurrent's own setting retried forty times a second for as long as the server ran.
  Given up on, it is said once as a fault, and the world wants wiping and the server starting again.

`UnreadableSpec` holds the reading in memory, `MongoWorldDockerSpec` the store that cannot read an event back, and
`GatewayInstrumentsSpec` what a window is told; each failed without what it holds.

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
