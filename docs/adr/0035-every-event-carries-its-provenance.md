# 0035. Every event carries its provenance: an event id, a correlation id and a causation id

- Status: proposed
- Date: 2026-09-15

## Context

Decision 0024 fixed the envelope of an event: a fresh UUID as `id`, our source, the catalogued type,
the aggregate as subject, the instant, and Occurrent's stream id and version. It said nothing about
where an event came from, because one command made one event and the question did not arise.

The first gameplay loop writes two events from one command, an action and its consequence, and Adam
wants them read together: every event with an event id and a correlation id, to good event-sourcing
standards. Commands are not stored, by the glossary's definition, so whatever an event says about its
cause has to be enough on its own. And the browser mints a command's id today as free text, `c-1`,
which is not an identity anything downstream can rely on.

Occurrent's decider extension, `execute(streamId, command, decider)`, offers no hook to add attributes
to the events it writes; `ExecuteOptions` in 0.33 carries a filter, a side effect and a start version,
nothing more.

## Decision

**Every event carries three ids on its envelope.** The event id is the CloudEvent `id`, a UUID minted
when the event is written. The correlation id and the causation id are CloudEvent extensions,
`correlationid` and `causationid`, stamped by the command executor from a `Provenance` the application
layer hands it with the command. The domain event is untouched: provenance is a fact about messages,
not about the game.

**The first message of a story is its own correlation.** A command that starts something, arrival
giving the founding choice, carries `Provenance(id, id)`. Everything that follows from it carries the
same correlation id, and each event's causation id is the id of the message that directly caused it:
for an event from a command, the command's id.

**The browser mints a command's id, and it is a UUID.** The gateway refuses any other as malformed. That
id is the causation of the command's events, and it is on the command's line in the debug log, so a
causation id resolves to a line a reader can find even though the command itself is not stored.

**The server decides which story a command continues.** An action continues the story of the choice it
answers: the gateway reads the pending choice's correlation id from the choices projection. Anything
else starts a story of its own. Nothing about correlation crosses the wire from the client, because a
client cannot name a story that is not its own, in the spirit of 0028. If the projection has no pending
choice at that moment, the command's own id is the correlation: a story the server could not find,
which is the honest thing to record.

**The executor reads, folds, decides and writes explicitly.** `store.read`, the converter to domain
events, `HouseDecider.fold`, `HouseDecider.decide`, the converter back with the two extensions added,
`store.write` under the stream-version condition. Nothing is written when the decision is empty. A
write condition that fails is tried three times, which is what the decider extension did for us, and
then surfaces as `WriteConflict`, which the gateway answers as `commandRejected` with reason
`conflict`.

**The wire and the panel carry both ids.** `StoredEvent` and the `event` frame gain `correlationId` and
`causationId`. The debug panel tags every event line with the first characters of its correlation id,
so the lines that belong together can be seen to, and opens to both ids in full.

## Consequences

Two events from one command are visibly one story, and any event can be traced to the command line
above it in the log. A consumer that wants to deduplicate has the event id; one that wants to group has
the correlation id; one that wants the chain has the causation id.

The decider extension is gone from production code. What it did is now twelve lines we own, and
`ARCHITECTURE.md`'s account of what was verified about Occurrent says so. `occurrent-decider` stays for
the smoke test, which has its own decider.

Every command id in the tests and the fixtures became a UUID in the same change, and the seed button
mints one per house, because a free-text id is refused.

The cost accepted: two more strings on every event, and one read of a projection in the gateway to
find the story an action continues.

## Alternatives considered

- **Provenance as fields on the domain event.** Every payload in the catalogue would list two ids that
  have nothing to do with the game, and `decide` would have to fill them. Declined.
- **A correlation id sent by the client.** The client would name the story, which is the class of
  mischief 0028 removed. Declined.
- **A thread-local read by the converter.** Keeps the decider extension and hides how the ids arrive.
  A hack; declined.
- **Deterministic event ids from the command**, `nameUUID(commandId, ordinal)`, so a retried command
  writes the same events. Attractive for idempotence and not needed while there is one session a
  player; revisit with reconnection.
