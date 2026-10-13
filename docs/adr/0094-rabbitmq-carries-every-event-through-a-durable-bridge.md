# 0094. RabbitMQ carries every event, through a durable bridge, in a virtual host the server makes

- Status: accepted
- Date: 2026-10-12, accepted 2026-10-13 once all of `docs/plans/broker.md` was built
- Amends 0003: one queue per follower, bound to everything, until a gateway filters by cell; and the routing
  key's shape. Amends 0029: the bridge has the checkpoint 0029 found missing, and a feed's live half is a
  parameter. Amends 0092: the server makes its own virtual host, and `drop-gone-worlds` drops a gone tree's.

## Context

Decision 0003 chose RabbitMQ to carry stored events to the projections and every gateway node: one topic
exchange, a durable subscription on the store bridging every stored event onto it, a routing key carrying
the aggregate, the event and the cell, and an exclusive queue per node. Decision 0092 put RabbitMQ on the
machine beside MongoDB, shared by every tree, each tree to keep to a virtual host of its own "with the
bridge of increment 1.6". None of it is built: the module is a placeholder, and all fourteen of the
store's readers follow it in-process, through Occurrent's subscriptions on MongoDB's change streams
(0029).

Adam's word of 2026-10-12: RabbitMQ is to really carry every stored event to the read models and every
window, nothing lost across a restart, each tree in its own virtual host, still one game server per tree.
The steps are `docs/plans/broker.md`; this record is why they are shaped as they are.

Four facts about the libraries, checked against Occurrent 0.33.0's own jars and source, decide most of it.
Occurrent 0.33 has a durable subscription, `DurableSubscriptionModel`, and a checkpoint storage for the
native driver, `NativeMongoCheckpointStorage`; it saves the checkpoint after the action returns, and
deletes it when a subscription is cancelled. It has no broker module: `occurrent-broker-rabbitmq-blocking`
is on its main branch and not in 0.33. The CloudEvents JSON format's module is on Jackson 2, and this
project is on Jackson 3. And AMQP cannot make a virtual host; only the management API or `rabbitmqctl`
can.

## Decision

1. **The bridge follows the store durably and publishes by hand.** A durable subscription of its own - its
   own subscription model, threads and retry, its checkpoint in the tree's database in `checkpoints` -
   publishes each stored event to `villages.events` with the plain AMQP client, and returns only when the
   broker has confirmed it. When it has not, the bridge lets its connection go and throws, and the
   subscription hands it the same event again after a wait that grows to five seconds, said once until an
   event is carried. So the checkpoint never passes an event the broker does not have. It is closed by
   shutting it down, never by cancelling it. With no checkpoint it starts from now: RabbitMQ carries every
   event written since the tree's bridge first ran. A checkpoint too old for MongoDB's oplog is said, and the
   bridge goes on from now.
2. **The routing key is `<aggregate>.<verb>.v<n>` and the cell, a word a digit**, `none` when the event
   has no place, so a tile binds as `*.*.*.1.2.0.#`. The bridge works out the place from the event and is
   handed the cell function by `app`, so `infrastructure-rabbit` needs no edge to `protocol`.
3. **A message is the event as the store holds it.** The body is its data byte for byte, the rest in the
   message's properties and headers under the names Occurrent writes them. The CloudEvents JSON format is
   not used, since its module is on Jackson 2.
4. **The read models follow the broker; the reactions follow the store.** The broker feed is the same
   `EventFeed` with its live half taken from RabbitMQ: a queue per follower, exclusive, bound to everything
   and named after it, over a connection of its own, subscribed before the history is replayed from the
   store. The reactions write, so they are the world's, and a broker outage must not stop the world: they
   follow the store's own feed, `storeFeed`.
5. **The world owns the wipe's markers, and both feeds share them.** The bridge carries the marker like any
   event and a marker passes through the hand-over, so a wipe waits for the broker's followers too.
6. **A follower makes its own connection again.** The client's automatic recovery would bind the queue
   again outside the wipe gate; instead the follower binds a new queue and replays the history inside it,
   and says so once as a fault. The live half tells its feed it missed some, and the feed listens again and
   reads the history once more, holding what arrives behind it, so the replay is written once. A queue
   deleted from under a follower counts the same.
7. **The server makes its virtual host** at start, idempotently, through the management API, named as its
   database is, and gives the `villages` user its permissions. RabbitMQ without MongoDB is refused at
   start.

## Consequences

The architecture diagram's RabbitMQ is no longer dashed, and the first message of every change goes
through it. A broker that is down leaves the world running and the read models behind until it is back,
and commands that read a read model are refused meanwhile. The read models still fold the whole history
on every start; a checkpoint for them is later work.

A queue per follower, bound to everything, is not 0003's one queue per node, and it is not the scale
principle's "one broker consumer per node" either. Both belong to a gateway that keeps no read models of
its own and binds only the cells its sessions watch, which this does not build. The routing key carries
the cell already, so that gateway changes a binding and not the bridge.

Most events have no place, so they carry `none`. A gateway that filters by cell will need the bridge to know
where each house and structure is.

The virtual hosts of gone trees are left behind as their databases are, and `drop-gone-worlds` drops both.

A read model one hop further behind is not a thing to ask about what was just written. Arrival hands back
the story it began with the choice it gave, and the window keeps it, so the action answering a choice
continues that story without asking the choices projection (0035).

What proves it: specs against a MongoDB and a RabbitMQ of their own - an event carried once under its key,
one written while the bridge or the broker was down carried when both are back, fifty from four threads
handed once each, a wipe that leaves no house behind - and the end-to-end test, whose world is carried by
RabbitMQ in a virtual host of its own whenever the stack is up.

## Alternatives considered

- **Occurrent's own broker module.** Not in 0.33. This answers experiment 0001's question: by hand.
- **Publish from the use case, after appending.** The dual write 0029 rejected.
- **The bridge from the beginning, deduped by position.** A change stream cannot start before the oplog,
  so it needs the catch-up model, whose own documents warn that deleting events while it runs loses some,
  and the wipe deletes. No queue lives long enough to want the history either: every follower reads it
  from the store.
- **One queue per server.** The design of 0003, for a node that filters by cell. One per follower keeps
  each follower on a thread of its own, as today, and the management page says who is behind.
- **The reactions on the broker too.** A broker outage would stop the world, not only the view of it.
- **A virtual host made by the quick start, or by a definitions file in `infra/`.** The quick start is not
  the only way a server starts - the end-to-end test starts its own - and a definitions file is a change
  to the stack, which is Adam's (0092).
