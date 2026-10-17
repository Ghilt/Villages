# 0077. A slow socket holds up only its own connection

- Status: accepted
- Date: 2026-10-02
- Amended 2026-10-17: **a send is a virtual thread**, behind a lock a virtual thread parks on rather than `synchronized`,
  which on JDK 21 would pin it for the length of a slow send. A platform thread a send had ten thousand players
  running 982 of them (experiment 0022); see experiment 0023.

## Context

Every frame the gateway sent went onto its socket on whichever thread had it. A connection's own house, its key
figures, its sight and its dialogues were sent from inside the read models' watchers, which run on the thread the
event feed hands events on; a batch of map changes was sent from the gateway's one coalescing timer, which batches
for every connection in turn; and a sight that moved answered every cell the connection held again, there and
then, on the feed's thread. So one socket that would not take a frame - a phone gone into a tunnel, a tab the
browser has stopped reading - held up the feed for everybody, and with it every read model and every other
connection's map. Scale principle 5 said outbound queues were bounded, and that was true of map changes only.

The review of 2026-10-02 found it. Nothing slow enough to show it has been connected yet.

## Decision

**Frames are queued where they come from and sent on the gateway's own threads.** Every frame to a connection
goes into its `Outbox`, which is bounded by the rules it states - a snapshot, a tile of stands or a `your…` frame
still waiting is replaced by a newer one of its kind, a watcher's events are capped, a command's answer always
goes - and is sent one at a time, in order, on the executor the gateway is handed. The app hands it a pool of its
own, `gatewaySending`, a thread a socket that is sending; a read model's watcher only ever queues, and so does the
coalescing timer.

**Answering every held cell again is planned once a connection**, on the same threads: a change to the way a
connection looks while an answer is still to come is answered by that one. A sight that moves ten times in a
breath is one answer, and none of it is worked out on the feed's thread.

**Undoing it is one line.** Without `sendOn = gatewaySending` in the gateway's wiring, frames are sent on the
thread that queued them, as before, and the specs run that way unless they ask for threads.

## Consequences

- A slow socket fills its own queue, bounded as above, and holds up its own frames and nobody else's.
  `GatewaySendingSpec` holds it on real threads, and fails against sending on the calling thread; `AppBootsTest`
  has two players over real sockets.
- A send that never finishes keeps one thread for as long as Tomcat's own send timeout allows. Threads are made as
  sockets want them and let go when idle, which is right for the hundreds this machine sees and is to be measured
  for the ten thousand the bot swarm proves. Virtual threads are the obvious next step once the JDK the server
  runs on no longer pins them inside `synchronized`, which Tomcat's sending uses.
- The page is told the same things in the same order. What is sent from a watcher now arrives a moment after the
  watcher has run rather than during it, which nothing on the page can tell apart.

## Alternatives considered

- **One sending thread for the whole gateway.** It keeps the feed free, and one slow socket still holds up
  everybody else's.
- **Closing a socket that falls behind.** Spring's concurrent session decorator can, past a time or a size. The
  outbox already keeps what falls behind small, and a player in a tunnel should come back to a map, not a closed
  socket; the decorator stays an option for a socket that is gone in all but name.
