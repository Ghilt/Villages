# 0078. The session is folded from what each mechanic folds

- Status: accepted
- Date: 2026-10-02

## Context

The page's side of the conversation with the gateway - what it knows of the world and of its own house, how it
follows the camera, its commands, its switches, and every line of the log - was one module in the web app,
`net/gateway.ts`, 807 lines with no test of its own. Each mechanic added a field to its state, a branch to its
one `switch` and a line or two of words in the middle of it, and the module imported how a key figure, a
dialogue and a sight are described, against the folder rule. The client core, where the layer rule says game
logic lives and is tested without a browser, held the connection and the cell maths and none of the session.

## Decision

**The session is the client core's, `createSession`, and its state is folded from slices, one a mechanic.**
A slice is `{initial, onFrame, onReset(state, cause)}`: what its part of the state starts as, how each frame it
cares about changes it, and what an end of the session does to it - pure, with nothing sent, waited on or said.
The parts are the connection, the cells, the house, the choice, the key figures, the sight, the dialogues and
the commands; `foldFrame` and `endState` run every part in turn.

**What a frame makes the session do is routed through one table that names every kind of frame**, so a new frame
does not compile until it has a route, even one that does nothing. The follower and the commands, already the
core's, are the session's; so are the two switches, the eye and the fog, which a welcome sends again.

**One end, `end(cause)`, keeps today's difference on purpose:** a closed connection keeps what the house had on its
cards for whoever reads them after, and a window taken over forgets it, because somebody else is playing it now.
Each part says which by its `onReset`. Making the two the same is a choice about the game, and Adam's.

The core gains `createStore`, the shape every watched state takes, and `Connection.onClose`. The web app's
`net/gateway.ts` is the browser's wiring and nothing else: the socket, the timers, the storage a player's token is
kept in, a reload, and the master, which `main.tsx` decides and App hands it. It keeps `gatewayState` and
`watchGateway` for the components that read them.

## Consequences

- A new mechanic's part of the session is a slice, a route, and its words in `sessionLog.ts`, and none of them is
  in a file every mechanic edits. `BUILDING-A-MECHANIC.md`'s checklist says so.
- The session is tested where it lives, `session.test.ts`, and the page's conversation is still held whole by
  `net/gateway.test.ts`, which passed unchanged through the move but for being handed the master.
- The folder rule's excuse for the session reading the master is gone.

## Alternatives considered

- **One reducer over the whole state.** It is what there was, with a `switch` every mechanic edits.
- **A slice a frame rather than a mechanic.** A frame is a fact on the wire, and several mechanics hear some of
  them; it is the mechanic whose state it is that should say what the frame does to it.

## Amendment, 2026-10-02: one store shape, and the switches held once

The session keeps its two switches in its state, a slice of their own, `seeAll` and `fogOfWar`: they were held
twice, once in the session to say again at a welcome and once in the page to draw by, and the page's copies are
gone. (The two are see everything and the fog. See everything is Adam's switch and not the player's eye, which
the paragraph above calls it.) `gatewayState` and `watchGateway` went with every store's own pair of functions:
the page reads the session as `sessionStore`, a `Readable`, through `useStore(store, select)`, as it reads every
other store, and each component picks the part it uses. See ARCHITECTURE's "Every piece of state the page
watches is one shape".
