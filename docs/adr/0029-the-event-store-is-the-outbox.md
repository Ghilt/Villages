# 0029. The event store is the outbox, and a feed says where it starts

- Status: accepted
- Date: 2026-09-05
- Amended 2026-10-02: **the hand-over from the history to what arrives live holds one lock.** The live side
  read "still replaying" and then queued, and the replay could empty the queue for the last time in between, so
  an event was handed to nobody; once the replay was done, the live side and the last of the queue could hand a
  subscriber two events at once, out of order. `Handoff` does all three under one lock now, and an event that
  cannot be read is said once as a fault rather than retried and dropped as already seen.
- Amended 2026-10-02: **a fault is anything acting on its own that throws**, not only a subscriber to the feed.
  The listeners scheduled their work on a timer whose future nobody read, so a release that failed, or a write
  that lost its race three times, vanished without a word. Now the feed, the timer and the listeners report to
  one `Faults` port, which the server's log and the gateway watch as they watched the feed; a feed's fault is
  said word for word as before. A pledge whose house went in a wipe is as settled as one already released, so a
  wipe is not a fault in every window.
- Amended 2026-10-12, as the broker was built (decision record 0094): **the checkpoint this record found missing
  exists for the bridge**, the relay from the store to RabbitMQ, which keeps its place in MongoDB once the broker
  has confirmed each event. The read models still read the whole history on every start. And **a feed's live half
  is a parameter**, the store's subscriptions or the broker's queues, with the same order on both: listen first,
  then read the history. A live half that missed some of what was written says so, and the feed listens again and
  reads the history once more, with what arrives meanwhile waiting behind it, so the gap costs duplicates and not
  losses, as the first subscribing does.

## Context

Adam asked whether we need the transactional outbox pattern, and whether we already have it. The question
recurs in every event-driven system, so the answer is written down here rather than given twice.

The outbox pattern exists to solve the **dual-write problem**: a system whose truth lives in a state table
must also tell a broker that the state changed, and those are two writes to two systems. Crash between them
and the state is right while nobody was told, with nothing left to say a notification was owed. The pattern
closes it by writing the event into an outbox table *inside the same transaction as the state*, and having a
separate relay - polling, or change data capture - ship rows from that table to the broker.

## Decision

**We do not need it, because we do not write twice.**

Villages is event-sourced. The only write is the append to the stream, and the event **is** the change
rather than a notification about a change recorded elsewhere. State - the read models the map is drawn from -
is derived afterwards by reading the store through a subscription. There is no second write to lose, so
there is no window to close.

Point for point against the pattern:

| The pattern | Villages |
|---|---|
| An outbox table inside the local database | The event store. It is not a copy of the news, it is the record |
| A relay that polls or reads the change log | The subscription. In MongoDB, a change stream, which is change data capture |
| Atomicity between the state write and the event write | Free: there is one operation |

So the pattern is what a state-oriented system bolts on to make its boundary behave a little like an
event-sourced one. We arrive there by construction, and that is one of the reasons to event-source in the
first place - not a happy accident.

**What a relay still owes, and what we now do about it.** The pattern's other half is delivery: the relay
remembers how far it got, so nothing is lost across a restart, and it delivers **at least once**. Ours did
not. `OccurrentEventFeed` subscribed with `StartAt.now()` and the `EventFeed` port let no caller say
otherwise, though the two callers want opposite things: a read model is the fold of *every* event and one it
never saw is one it is permanently wrong about, while the debug panel watches the world happening and would
not thank us for the whole chronicle on every connect.

It was harmless only because the store was in memory too - store and read model empty together on a restart,
wrong in step. With a database behind it, it becomes a silent data loss: a store full of houses, a map
showing none founded before the last restart, no error anywhere.

So the port now says where a subscription begins - `FROM_THE_BEGINNING` or `FROM_NOW` - and starting from
the beginning **subscribes first and replays second**. That order is the whole of it: replaying first and
subscribing after leaves a gap in which an event appended between the two is seen by neither. Done this way
the overlap costs a duplicate instead, and a subscriber drops it by the event's identity. Delivery is
therefore at least once, which is what a log reader is supposed to have, and folding the same event twice
has to be harmless - which for a read model keyed by identity it already was, now with a test that says so.

*Amended 2026-09-26:* a relay also owes saying so when a subscriber fails. One that threw used to be lost
without a word: Occurrent tried it again two hundred milliseconds later, the feed dropped the retry as
already seen, and the read model was missing the event with nothing anywhere to say so. That is how a
closing socket once cost the windows holding a cell some of the houses seeded into it, and it took a flight
recording to find out why. The feed now catches what a subscriber throws, tells whoever watches for faults,
and goes on to the next event, during the replay as well as live. The app writes the stack to the server's
log under `villages.feed`, and the gateway tells every window the one line of it, as an `error` frame with
the code `fault`, which the debug panel logs. The event is still not handed to that subscriber again: a
fold that throws on an event would throw on the retry too, and a retry that never succeeds would stop the
read model for good rather than leave it missing one event.

## Consequences

`EventFeed` is a plain interface rather than a `fun interface`, and every caller states its intent at the
call site with the reason beside it. The two fakes in the tests gained three lines each.

A projection built after events already exist now has them. That is one new test, and it fails the moment
the old behaviour is put back - which was checked by putting it back once.

What is still missing is durability across a restart of the *server* rather than of one subscription: a
checkpoint, so a relay resumes where it stopped instead of replaying everything. That needs MongoDB, which
needs Docker, and Occurrent ships it -
`occurrent-subscription-mongodb-spring-blocking-checkpoint-storage` and
`occurrent-subscription-durable-blocking`, neither yet in the version catalogue. This decision is the shape
those slot into; without it they would have had to slot into a port that could not express what they do.

Replaying the whole store on every start is fine at this size and will not stay fine. The checkpoint is the
answer, and until it exists the replay is bounded by a world small enough to hold in memory anyway.

## Alternatives considered

- **Add an outbox table.** A second copy of what the event store already is, plus a relay to keep the copy
  honest. It would be a state-oriented answer to a problem we do not have.
- **Publish to the broker from the use case, after appending.** The dual write, written by hand. This is the
  thing the pattern exists to prevent, and event sourcing already prevents it.
- **Leave the port alone and fix it when MongoDB lands.** The bug is invisible today, so it would have
  landed inside a much larger increment, in the one place where a silent wrong answer costs most. It was
  cheaper to fix while it could be proven in memory in an afternoon.
- **Let the projection replay by querying the store directly**, rather than through the feed. The projection
  would then depend on the store as well as the feed, and would have to solve the subscribe-then-replay race
  itself - once per read model, instead of once in the adapter.
