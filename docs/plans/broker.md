# The broker

**What belongs here:** how RabbitMQ comes to carry every stored event - the event bridge from the store to the
exchange, the feed the read models follow through it, the virtual host each tree keeps to, what the tools and
the debug panel show of it, and the order it all gets built in. **What does not:** why it is shaped this way,
which is decision record 0094; why there is a broker at all, which is 0003; the stack and who may stop it,
which is 0092; the words, which are `GLOSSARY.md`. When a part of it is decided, that part becomes a decision
record and leaves.

**Built, all eleven steps, by 2026-10-13.** Decision record 0094 is accepted and says what was decided; this
file stays as the record of the order it was built in and the rules it holds.

---

## The problem, in one paragraph

MongoDB is done end to end: each tree keeps its world in a database of its own, which outlives the server.
RabbitMQ is only a running container. `infrastructure-rabbit` holds a placeholder, no virtual host exists,
nothing speaks AMQP, and the architecture diagram draws the broker dashed, not used until 1.6. Every event
reaches its fourteen readers inside one process, through Occurrent's subscriptions on MongoDB's change
streams. Adam's word of 2026-10-12: complete the infrastructure, so that RabbitMQ really carries every stored
event to the read models and every window, nothing is lost across a restart, and each tree keeps to a virtual
host of its own that the tools make and clean up - still one game server per tree.

## What it is

An **event bridge** in the game server follows the store durably - Occurrent's durable subscription over the
change streams, its checkpoint in MongoDB - and publishes every stored event to one topic exchange,
`villages.events`, in the tree's virtual host. It waits for the broker to confirm each event before the
checkpoint moves past it, so an event written while the server was down, or while the broker was, is
published when they are back.

The **broker feed** is the same `EventFeed` the read models follow today, with its live half taken from
RabbitMQ instead of the change stream. Each follower has an exclusive queue of its own, bound to
everything, and subscribes before it replays the history from the store, exactly as decision 0029 has it.
The read models, the event page and the recent events follow the broker. The **reactions stay on the
store's own feed**: they write, so they are the world's, and a broker that is down must not stop a castle
being raised.

The server makes its own virtual host when it starts, through RabbitMQ's management API, because AMQP
cannot. With no Docker nothing changes: the world in memory, the feed in-process.

## Names

Agreed with Adam on 2026-10-12, before anything was built.

| name | what it is |
|---|---|
| `villages.events` | the one topic exchange, durable, in each tree's virtual host |
| `<aggregate>.<verb>.v<n>.<d>.<d>…` | the routing key: the parts of the event's type after `villages.`, then the cell of the event's place as quadkey digits, one word each, so a tile binds as `*.*.*.1.2.0.#`; `….none` when the event has no place, which most have not yet |
| `feed.marker.none` | the wipe's marker, carried like any event |
| virtual host `villages`, `villages-<tree>` | the same name as the tree's database, whichever that is, so the end-to-end test's `villages-e2e-<tree>` has one too |
| `<Follower>.<8 hex>` | each follower's exclusive queue, named so the management page reads |
| `checkpoints` | the collection in the tree's database where the event bridge keeps its place |
| `villages.broker` | `rabbit` or `in-process`, the default; the quick start passes `rabbit` when the stack is up |
| `villages.rabbit.uri`, `.management`, `.vhost` | `amqp://villages:villages@localhost:5672`, `http://localhost:15672`, and the database's name |
| the event bridge, the broker feed | glossary terms |

No event is added.

## What a message carries

The body is the event's data as the store holds it, byte for byte. The rest is in the message's own
properties and headers: the event's id as the message id, its type, its time as the text it was written as
(0074, 0092), and `streamid`, `streamversion`, `correlationid` and `causationid`, under the names Occurrent
writes them. Not the CloudEvents JSON format, whose module is on Jackson 2. Persistent, and not mandatory:
an event no queue is bound for is dropped by the exchange, which is right, because nobody was following,
and whoever follows later reads the history from the store.

An event the code cannot read back is published all the same, under the cell `none`: the event bridge carries
the store, and saying what is wrong with an event is the feed's job (0036).

## Invariants

What must always hold, and what holds it.

1. **Every event written after a follower's queue is bound reaches that follower.** At the instant of
   subscribing: the broker feed is handed the event bridge already started, so the event bridge is always following
   the store before any queue is bound; then the history is read, after the bind, and what both deliver is
   dropped the second time by the event's id.
2. **The event bridge's checkpoint never passes an event the broker has not confirmed.** At the instant of
   publishing: Occurrent saves the checkpoint after the event bridge's action returns, and the action returns
   only once the broker has confirmed, trying again with a growing wait for as long as it has not. It is
   closed by shutting it down, never by cancelling it, which deletes the checkpoint.
3. **Nothing written before a wipe is in a read model after it.** At the instant of the wipe: one set of
   markers belongs to the world and both feeds join it, the event bridge publishes the marker, and a marker passes
   through the hand-over like any event, so a follower that has reached it has folded everything before it.
4. **A tree's messages never leave its virtual host.** The server names it from its database.
5. **RabbitMQ only with MongoDB.** Refused at start: in memory the wipe's wait cannot see the broker.
6. **Put right a moment after, not at the instant:**
   - A broker that goes away. The store's feed and the reactions go on. Each broker-fed follower makes its own
     connection again, binds a new queue and replays the history, inside the wipe gate. It is said once as a
     fault, and the read models are behind until it is done. Commands that read a read model are refused for as
     long as it lasts.
   - A checkpoint too old for MongoDB's oplog to resume from. Said as a fault, forgotten, and the event bridge starts
     from now. The read models lose nothing because they replay from the store; a queue bound by hand misses the
     gap.

What RabbitMQ carries, said plainly: every event written since the tree's event bridge first ran.

## Steps, one commit each

Each is handed over on its own. Adam looks at the running program at the three checkpoints.

| # | scope | what |
|---|---|---|
| 0 | docs | This plan, decision record 0094 proposed, the roadmap's 1.6 pointed here |
| 1 | occurrent | The feed's live half becomes a parameter, so replay, dedupe, hand-over and faults are written once; a marker passes through the hand-over; the hand-over can be armed again; the world owns the markers both feeds share. No change in behaviour |
| 2 | occurrent | The durable subscription the event bridge rides: its own subscription model, threads and retry, its checkpoint in `checkpoints`, closed by shutting down, a checkpoint too old said and forgotten. Specs, needing Docker: it resumes across a restart; closing keeps its place |
| 3 | rabbit | The AMQP client; the virtual host made through the management API, idempotently; the exchange declared; the routing key, from an event's place and the cell function handed in from `app`; the routing key's section of `EVENTS.md` |
| 4 | rabbit | The event bridge: what a message carries, a confirm awaited for each, an outage waited out. Specs, needing Docker: the key, the headers and the body; an event written while the event bridge was down is published when it is back; markers; a broker stopped and started loses nothing |
| 5 | app, infra | The settings; RabbitMQ refused without MongoDB, and a broker that does not answer stops the start; the event bridge wired, nothing yet following it; the welcome says "carried by RabbitMQ, virtual host …"; the quick start passes `villages.broker=rabbit` when the stack is up; `RUNNING.md` |
| — | **checkpoint A** | The panel's log says the world is carried by RabbitMQ in the tree's virtual host. The management page shows the virtual host and `villages.events` publishing as a house is founded. A queue bound by hand to `#` shows keys like `house.founded.v1.…` and fills again after a restart |
| 6 | rabbit | The broker feed: a queue per follower, its own reconnection inside the wipe gate, faults. Specs, needing Docker: no gap under writes from many threads; from now; a wipe waits for the broker's followers and leaves no house behind; a broker stopped and started is caught up from the store |
| 7 | app, gateway | The read models, the recent events and the event page follow the broker; the reactions stay on the store; a founding keeps the story of the choice the connection was told, rather than reading it from a read model one hop further behind (0035); `ARCHITECTURE.md`; 0003 and 0029 amended |
| — | **checkpoint B** | Nine queues named after the followers, with their rates. The event page shows a founding arriving through RabbitMQ. A consuming connection closed on the management page puts `error fault` in the panel, and the map goes on with nothing missing. A restart keeps the house |
| 8 | web | The architecture diagram: the event bridge in the event store's group, RabbitMQ no longer dashed, the arrows from the store through the event bridge and the broker to the read models |
| 9 | scripts | The end-to-end test on RabbitMQ when the stack is up, in a virtual host of its own that it deletes after; `drop-gone-worlds` lists and drops gone virtual hosts too, and leaves a live tree's test world alone; the check script says when RabbitMQ was not used; `TESTING.md` |
| — | **checkpoint C** | The diagram shows the event bridge. `node scripts/drop-gone-worlds.ts --list` lists virtual hosts. The check script passes, the end-to-end test on RabbitMQ |
| 10 | docs | 0094 accepted, 0092 amended, experiment 0001's question answered, `GLOSSARY.md`, 1.6 off the roadmap, and the stale lines the review found: `house.founded`'s consumers in `EVENTS.md`, the read models' row and drum in `ARCHITECTURE.md`, 0007 pointed at 0026 |

Offered at checkpoint B and not part of the plan: the routing key shown on the event page, which changes
the wire.

## Not in it

Several game servers on one world, which needs sessions, reactions and the wipe to reach across them.
Read models saved with a checkpoint, so that a start does not fold the whole history. Queues bound by cell,
which wait for a gateway that keeps no read models of its own. Versioned events and upcasters, which come
with the world-persistence milestone (0011, 0036).
