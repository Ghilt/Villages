# 0092. One stack serves every tree, and a tree keeps to its own database

- Status: accepted
- Date: 2026-10-11
- Amended 2026-10-11, as the database was built (increment 0.8): **the server works out its database from the
  checkout it runs in**, `villages` where `.git` is the repository itself and `villages-<folder>` where it is a
  file pointing at one, so a server keeps to its own tree's world however it was started; `villages.store=mongo`
  turns it on and the quick start passes it whenever Docker is running. The quick start starts the stack only
  when it is not running, and never brings a running one up, so it cannot make the containers again under
  another session. The welcome says where the world is kept, while the instruments are open, and the debug
  panel prints it. An event's time is kept as the text it was written as, because Occurrent refuses a date
  finer than a millisecond and the server's clock is finer than that.
- Amended 2026-10-13, as the broker was built (decision record 0094): **the server makes its own virtual host**
  as it starts, named as its database is, through RabbitMQ's management page, because AMQP cannot make one; the
  quick start passes `villages.broker=rabbit` with `villages.store=mongo` whenever the stack is up, and RabbitMQ
  without MongoDB is refused. The end-to-end test's world, `villages-e2e-<tree>`, has a virtual host of its own
  too, which it deletes after itself. `drop-gone-worlds` drops a gone tree's virtual host with its database, and
  leaves a live tree's test world alone. A test that needs RabbitMQ starts one of its own, as for MongoDB.

## Context

Increment 0.4 puts MongoDB and RabbitMQ on the machine, in Docker, from `infra/docker-compose.yml`. Until now
the event store and the broker have been in memory behind their ports, which is why nothing survives a
restart of the game server.

The machine is not one checkout any more. Every session works in a worktree of its own, there are dozens of
them, several serve at once, and each serves on its own pair of ports so that a page talks to its own tree's
world (0031). That rule exists because a page talking to another tree's server once put one branch's events
into another branch's store, and the mistake looked exactly like a bug in the change under review. A store
that outlives the server makes the same mistake permanent: an event written by one branch's code, read by
another branch's code that has a different idea of its shape, is a fault on every start (0074).

Adam's requirement, of 2026-10-11: **many sessions run in parallel, and none of them affects another.** So the
question 0031 answered for the servers has to be answered again for what they keep: one stack for the machine
or one for each tree, and how two trees sharing anything stay out of each other's way.

## Decision

**One Compose stack serves the whole machine, and every tree keeps to a part of it named after the tree.**
Adam's choice, between this and a stack for each tree.

- The project is named `villages` in the file itself, so the stack started from any tree is the same two
  containers, and starting it from a second tree finds it already up.
- **MongoDB is a one-member replica set** on `127.0.0.1:27017`, because Occurrent's subscriptions are change
  streams and a lone server has none (0002). The member calls itself `localhost:27017`, which is where a
  game server on this machine reaches it; its own health check starts the set the first time and finds it
  every time after, and calls it healthy once it can be written to.
- **RabbitMQ 4.3** on `127.0.0.1:5672`, with its management page on `http://localhost:15672`, as
  `villages` / `villages`.
- Both listen on the loopback address only. Neither has a password worth keeping secret, and nothing off the
  machine has any business with either.
- **A tree's world is named after it, in both.** In MongoDB it is a database, and in RabbitMQ a virtual host,
  which is RabbitMQ's own walled-off space inside one server: `villages` for the main checkout and
  `villages-<tree>` for a worktree, `<tree>` being the directory name `worktreePort.ts` already hashes. The
  database arrives when the game server first keeps its world in MongoDB, with increment 0.8, and the virtual
  host with the bridge of increment 1.6. A tree never reads another's, and a tree's wipe, the debug panel's
  (0036), empties its own and nobody else's.
- **The stack itself is Adam's.** Stopping it, restarting it, or forgetting what it holds - `down`,
  `restart`, `down -v` - stops or forgets every tree's world at once, so a session never does any of them;
  it resets only its own world, with the wipe. What the stack holds lives in named volumes inside Docker's
  own disk, on C:: `down` keeps it and `down -v` forgets it.
- **A change to `infra/docker-compose.yml` is a step of its own**, and says so when it is handed over,
  because bringing the stack up on a changed file makes its containers again under every tree. Adam brings
  it up, once he has seen it.
- **Tests do not use it.** A test that wants MongoDB or RabbitMQ starts its own container with
  Testcontainers and throws it away, as `TESTING.md` already requires, so a test can never read a world
  somebody is playing in.

## Consequences

- Two containers, about 400 megabytes of memory between them, however many trees there are.
- What two trees still share is the server underneath and its version, and the two rules above are what keep
  that from reaching anyone's world. A load test that hammers MongoDB would slow every tree; the bots are
  pointed at a container of their own when there are bots.
- A tree has a world of its own that outlives its server. Switching branches inside one tree, or merging main
  into it, can leave events in its database that the new code reads differently. Pre-alpha, that is a wipe
  of that tree's world, from the debug panel, recorded in `docs/experiments/` as every wipe is (0011).
- A deleted worktree leaves its database and its virtual host behind. They are small, and nothing reads
  them; `node drop-gone-worlds.ts --list`, in `scripts/`, says which belong to no checkout git still has, and
  `--drop` drops them, never a world whose checkout is still there.
- The standard ports are taken. Another MongoDB or RabbitMQ on this machine would clash, and there is none.
- Nothing on the machine stops one tree's server being pointed at another tree's database by hand. The name
  is worked out, not typed, so it takes doing on purpose.

## Alternatives considered

- **A stack for each tree, on ports hashed from its name as 0031 does for the servers.** The most isolated:
  a branch could even run another version of MongoDB without touching anyone. It costs about 400 megabytes
  and a few seconds of starting for every tree that serves, a quick start that starts and stops a stack, and
  containers and volumes left behind by every one of the dozens of trees ever served. The isolation the
  requirement asks for is between worlds, and a name inside one server gives that. Worth switching to if a
  branch ever needs a different MongoDB or RabbitMQ for longer than one step.
- **One database for every tree.** The mistake 0031 was written to stop, made permanent.
- **MongoDB without a replica set.** Simpler to start, and Occurrent's subscriptions would have nothing to
  subscribe to.
- **Users and passwords on both.** They protect nothing on a loopback address, and they would be one more
  secret for every tree and every test to be handed.
- **A database in the cloud.** A network and an account between Adam and his own world, for a game nobody
  else plays yet.
